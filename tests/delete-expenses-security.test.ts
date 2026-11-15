// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { storageBootstrap } from "./helpers/storage-bootstrap";

test("expense deletion preserves history, blocks replay and rejects stale receipt work", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key, is_anonymous boolean default false,
      email text, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;`);
    await db.exec(storageBootstrap);
    for (const file of readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort())
      await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));

    const organizer = "00000000-0000-4000-8000-000000000001";
    const guest = "00000000-0000-4000-8000-000000000002";
    const outsider = "00000000-0000-4000-8000-000000000003";
    await db.exec(`insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
      ('${organizer}','o@example.com',now(),false),('${guest}','g@example.com',now(),false),
      ('${outsider}','x@example.com',now(),false);
      set role authenticated; set request.jwt.claim.sub='${organizer}'`);
    const trip = (await db.query<{ id: string }>(
      `select create_trip('Delete test','Organizer','UTC','USD','2026-11-01','2026-11-05') id`,
    )).rows[0].id;
    await db.exec("reset role");
    expect((await db.query<{ can_execute: boolean }>(
      `select has_function_privilege('authenticated',
        'private.correct_expense(uuid,uuid,integer,uuid,text,text,text,jsonb,uuid,date,time)','EXECUTE') can_execute`,
    )).rows[0].can_execute).toBe(false);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${organizer}'`);
    const payer = (await db.query<{ id: string }>(
      `select id from trip_members where trip_id='${trip}'`,
    )).rows[0].id;
    const guestMember = (await db.query<{ id: string }>(
      `select add_managed_member('${trip}','Guest') id`,
    )).rows[0].id;
    await db.exec(`reset role; update trip_members set user_id='${guest}',managed_by_user_id=null
      where trip_id='${trip}' and id='${guestMember}'; set role authenticated;
      set request.jwt.claim.sub='${organizer}'`);
    const observerMember = (await db.query<{ id: string }>(
      `select add_managed_member('${trip}','Observer') id`,
    )).rows[0].id;
    await db.exec(`reset role; update trip_members set user_id='${outsider}',managed_by_user_id=null
      where trip_id='${trip}' and id='${observerMember}'; set role authenticated;
      set request.jwt.claim.sub='${organizer}'`);
    const expense = (await db.query<{ id: string }>(
      `select (create_expense('${trip}','${payer}','1200','USD','Dinner',
        '[{"member_id":"${payer}","owed_minor":"600"},{"member_id":"${guestMember}","owed_minor":"600"}]'::jsonb,
        '30000000-0000-4000-8000-000000000001')).id`,
    )).rows[0].id;
    const correctionOperation = "30000000-0000-4000-8000-000000000003";
    await db.query(`select correct_expense('${trip}','${expense}',1,'${payer}','1200','USD','Dinner corrected',
      '[{"member_id":"${payer}","owed_minor":"600"},{"member_id":"${guestMember}","owed_minor":"600"}]'::jsonb,
      '${correctionOperation}')`);
    const settlement = (await db.query<{ id: string }>(
      `select (record_settlement('${trip}','${guestMember}','${payer}','200',
        '30000000-0000-4000-8000-000000000002')).id`,
    )).rows[0].id;
    await db.query(`select confirm_settlement('${trip}','${settlement}')`);
    const receipt = (await db.query<{ id: string; object_path: string }>(
      `insert into expense_receipts(trip_id,expense_id,byte_size) values ('${trip}','${expense}',1200) returning id,object_path`,
    )).rows[0];
    await db.query(`insert into storage.objects(bucket_id,name,metadata) values
      ('expense-receipts','${receipt.object_path}','{"mimetype":"image/jpeg","size":1200}')`);
    await db.query(`update expense_receipts set status='ready' where id='${receipt.id}'`);

    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${guest}'`);
    await expect(db.query(`select delete_expense('${trip}','${expense}',1)`)).rejects.toThrow(/Organizer access required/i);
    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${organizer}'`);
    await expect(db.query(`select delete_expense('${trip}','${expense}',9)`)).rejects.toThrow(/changed/i);
    await expect(db.query(`select delete_expense('${trip}','ffffffff-ffff-4fff-8fff-ffffffffffff',1)`)).rejects.toThrow(/not found/i);

    await db.query(`select delete_expense('${trip}','${expense}',2)`);
    await db.query(`select delete_expense('${trip}','${expense}',2)`);
    const retained = (await db.query<{ version: number; deleted_at: string; deleted_by: string }>(
      `select version,deleted_at::text,deleted_by from expenses where id='${expense}'`,
    )).rows[0];
    expect(retained.version).toBe(3);
    expect(retained.deleted_at).toBeTruthy();
    expect(retained.deleted_by).toBe(organizer);
    expect((await db.query(`select id from expense_revisions where expense_id='${expense}'`)).rows).toHaveLength(1);
    expect((await db.query<{ status: string }>(`select status from settlements where id='${settlement}'`)).rows[0].status).toBe("confirmed");
    expect((await db.query<{ net_minor: string }>(
      `select net_minor from trip_balances('${trip}') where trip_member_id='${payer}'`,
    )).rows[0].net_minor).toBe("-200");
    expect((await db.query<{ net_minor: string }>(
      `select net_minor from trip_balances('${trip}') where trip_member_id='${guestMember}'`,
    )).rows[0].net_minor).toBe("200");
    await expect(db.query(`select create_expense('${trip}','${payer}','1200','USD','Replay',
      '[{"member_id":"${payer}","owed_minor":"600"},{"member_id":"${guestMember}","owed_minor":"600"}]'::jsonb,
      '30000000-0000-4000-8000-000000000001')`)).rejects.toThrow(/cannot be replayed/i);
    await expect(db.query(`select correct_expense('${trip}','${expense}',3,'${payer}','1200','USD','Dinner corrected',
      '[{"member_id":"${payer}","owed_minor":"600"},{"member_id":"${guestMember}","owed_minor":"600"}]'::jsonb,
      '${correctionOperation}')`)).rejects.toThrow(/cannot be corrected/i);

    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${guest}'`);
    await expect(db.query(`insert into expense_receipts(trip_id,expense_id,byte_size)
      values ('${trip}','${expense}',800)`)).rejects.toThrow();
    expect((await db.query(`update expense_receipts set status='ready' where id='${receipt.id}'`)).affectedRows).toBe(0);
    await expect(db.query(`insert into storage.objects(bucket_id,name,metadata)
      values ('expense-receipts','${trip}/${expense}/40000000-0000-4000-8000-000000000001.jpg',
      '{"mimetype":"image/jpeg","size":800}')`)).rejects.toThrow();
    expect((await db.query(`select id from expense_receipts where id='${receipt.id}'`)).rows).toHaveLength(1);

    // Existing receipt visibility and uploader cleanup remain available after soft deletion.
    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${outsider}'`);
    expect((await db.query(`select name from storage.objects where name='${receipt.object_path}'`)).rows).toHaveLength(0);
    expect((await db.query(`select id from expense_receipts where id='${receipt.id}'`)).rows).toHaveLength(1);
    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${organizer}'`);
    expect((await db.query(`select id from expense_receipts where id='${receipt.id}'`)).rows).toHaveLength(1);
    expect((await db.query(`select name from storage.objects where name='${receipt.object_path}'`)).rows).toHaveLength(1);
    await db.query(`delete from storage.objects where name='${receipt.object_path}'`);
    await db.query(`delete from expense_receipts where id='${receipt.id}'`);
    expect((await db.query(`select id from expense_receipts where id='${receipt.id}'`)).rows).toHaveLength(0);
  } finally {
    await db.close();
  }
}, 15000);
