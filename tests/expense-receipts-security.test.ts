// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { test, expect } from "vitest";
import { storageBootstrap } from "./helpers/storage-bootstrap";

test("private expense receipt metadata and Storage objects follow trip membership and receipt ownership", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, is_anonymous boolean default false, email text, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;`);
    await db.exec(storageBootstrap);
    for (const file of readdirSync("supabase/migrations")
      .filter((name) => name.endsWith(".sql"))
      .sort())
      await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));

    const organizer = "00000000-0000-4000-8000-000000000001";
    const uploader = "00000000-0000-4000-8000-000000000002";
    const member = "00000000-0000-4000-8000-000000000003";
    const removed = "00000000-0000-4000-8000-000000000004";
    const pending = "00000000-0000-4000-8000-000000000005";
    const outsider = "00000000-0000-4000-8000-000000000006";
    const otherOrganizer = "00000000-0000-4000-8000-000000000007";
    await db.exec(`insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
      ('${organizer}','o@example.com',now(),false),('${uploader}','u@example.com',now(),false),
      ('${member}','m@example.com',now(),false),('${removed}','r@example.com',now(),false),
      ('${pending}','p@example.com',now(),false),('${outsider}','x@example.com',now(),false),
      ('${otherOrganizer}','z@example.com',now(),false);
      set role authenticated; set request.jwt.claim.sub='${organizer}'`);
    const trip1 = (
      await db.query<{ id: string }>(
        `select create_trip('Receipts','Organizer','UTC','USD','2026-11-01','2026-11-05') id`,
      )
    ).rows[0].id;
    await db.exec("reset role");
    const trip2 = (
      await db.query<{ id: string }>(
        `insert into trips(owner_user_id,title,timezone,base_currency,start_date,end_date) values ('${otherOrganizer}','Other','UTC','USD','2026-11-01','2026-11-05') returning id`,
      )
    ).rows[0].id;
    const expense1 = "10000000-0000-4000-8000-000000000001";
    const expense2 = "10000000-0000-4000-8000-000000000002";
    const expense3 = "10000000-0000-4000-8000-000000000003";
    const expense4 = "10000000-0000-4000-8000-000000000004";
    const member1 = "20000000-0000-4000-8000-000000000001";
    const member2 = "20000000-0000-4000-8000-000000000002";
    const member3 = "20000000-0000-4000-8000-000000000003";
    const otherTripMember = "20000000-0000-4000-8000-000000000004";
    await db.exec(`insert into trip_members(id,trip_id,user_id,display_name,role,status) values
      ('${member1}','${trip1}','${uploader}','Uploader','member','approved'),
      ('${member2}','${trip1}','${member}','Member','member','approved'),
      ('${member3}','${trip1}','${removed}','Removed','member','removed'),
      ('${otherTripMember}','${trip2}','${otherOrganizer}','Other organizer','organizer','approved');
      insert into expenses(id,trip_id,paid_by_member_id,amount_minor,currency,description,client_operation_id) values
      ('${expense1}','${trip1}','${member1}',100,'USD','Dinner','30000000-0000-4000-8000-000000000001'),
      ('${expense2}','${trip1}','${member1}',200,'USD','Taxi','30000000-0000-4000-8000-000000000002'),
      ('${expense3}','${trip2}','${otherTripMember}',300,'USD','Train','30000000-0000-4000-8000-000000000003'),
      ('${expense4}','${trip1}','${member1}',400,'USD','Hotel','30000000-0000-4000-8000-000000000004');
      insert into trip_invites(trip_id,token_hash,expires_at,max_uses) values ('${trip1}',repeat('b',64),now()+interval '1 day',1);
      insert into trip_join_requests(trip_id,invite_id,auth_user_id,requested_display_name) select '${trip1}',id,'${pending}','Pending' from trip_invites where trip_id='${trip1}'`);

    await db.exec(
      `set role authenticated; set request.jwt.claim.sub='${uploader}'`,
    );
    const receipt = (
      await db.query<{ id: string; object_path: string }>(
        `insert into expense_receipts(trip_id,expense_id,byte_size) values ('${trip1}','${expense1}',1200) returning id,object_path`,
      )
    ).rows[0];
    expect(receipt.object_path).toBe(`${trip1}/${expense1}/${receipt.id}.jpg`);
    expect(
      (
        await db.query<{ status: string; uploaded_by: string }>(
          `select status,uploaded_by from expense_receipts where id='${receipt.id}'`,
        )
      ).rows[0],
    ).toEqual({ status: "pending", uploaded_by: uploader });

    // Storage checks INSERT authorization before the actual upload has written
    // its final object metadata. The uploader's permission probe includes
    // contentLength, not the final metadata.size field. Keep the probe isolated
    // in a savepoint so this test never leaves a Storage object behind.
    const probeAs = async (
      userId: string,
      objectPath: string,
      metadata: Record<string, unknown> = { mimetype: "image/jpeg", contentLength: 1200 },
    ) => {
      await db.exec(`set request.jwt.claim.sub='${userId}'; begin; savepoint receipt_permission_probe`);
      let allowed = false;
      try {
        await db.query(
          `insert into storage.objects(bucket_id,name,metadata) values ('expense-receipts',$1,$2::jsonb)`,
          [objectPath, JSON.stringify(metadata)],
        );
        allowed = true;
      } catch {
        // An RLS error aborts the statement; rollback keeps the session usable.
      } finally {
        await db.exec("rollback to savepoint receipt_permission_probe; rollback");
      }
      return allowed;
    };
    expect(await probeAs(uploader, receipt.object_path)).toBe(true);
    // Older Storage permission probes may send empty metadata.
    expect(await probeAs(uploader, receipt.object_path, {})).toBe(true);
    expect(await probeAs(member, receipt.object_path)).toBe(false);
    expect(await probeAs(removed, receipt.object_path)).toBe(false);
    expect(await probeAs(outsider, receipt.object_path)).toBe(false);
    await db.exec(`set request.jwt.claim.sub='${uploader}'`);
    const deletedExpenseReceipt = (
      await db.query<{ id: string; object_path: string }>(
        `insert into expense_receipts(trip_id,expense_id,byte_size) values ('${trip1}','${expense4}',1200) returning id,object_path`,
      )
    ).rows[0];
    await db.exec("reset role");
    await db.query(`update expenses set deleted_at=now() where id='${expense4}'`);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${uploader}'`);
    expect(await probeAs(uploader, deletedExpenseReceipt.object_path)).toBe(false);
    await expect(
      db.query(
        `insert into expense_receipts(id,trip_id,expense_id,uploaded_by,byte_size) values ('40000000-0000-4000-8000-000000000001','${trip1}','${expense2}','${member}',1200)`,
      ),
    ).rejects.toThrow(/created pending by its uploader/i);
    await expect(
      db.query(
        `insert into expense_receipts(trip_id,expense_id,byte_size) values ('${trip1}','${expense1}',1200)`,
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        `insert into expense_receipts(trip_id,expense_id,byte_size) values ('${trip2}','${expense3}',1200)`,
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        `insert into expense_receipts(trip_id,expense_id,byte_size) values ('${trip1}','${expense2}',524289)`,
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        `insert into expense_receipts(trip_id,expense_id,byte_size,status) values ('${trip1}','${expense2}',1200,'ready')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        `update expense_receipts set byte_size=2 where id='${receipt.id}'`,
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        `update expense_receipts set status='ready' where id='${receipt.id}'`,
      ),
    ).rejects.toThrow(/matching JPEG receipt object/i);
    await expect(
      db.query(
        `insert into storage.objects(bucket_id,name,metadata) values ('expense-receipts','${trip1}/wrong.jpg','{"mimetype":"image/jpeg","size":1200}')`,
      ),
    ).rejects.toThrow();
    // Raw SQL can model metadata that the Storage API's bucket configuration
    // would reject (wrong MIME or excessive actual object size). The database
    // finalization trigger must still reject mismatched final object metadata.
    await db.query(
      `insert into storage.objects(bucket_id,name,metadata) values ('expense-receipts','${receipt.object_path}','{"mimetype":"image/png","size":1200}')`,
    );
    await expect(
      db.query(`update expense_receipts set status='ready' where id='${receipt.id}'`),
    ).rejects.toThrow(/matching JPEG receipt object/i);
    await db.query(`delete from storage.objects where name='${receipt.object_path}'`);
    await db.query(
      `insert into storage.objects(bucket_id,name,metadata) values ('expense-receipts','${receipt.object_path}','{"mimetype":"image/jpeg","size":1199}')`,
    );
    await expect(
      db.query(`update expense_receipts set status='ready' where id='${receipt.id}'`),
    ).rejects.toThrow(/matching JPEG receipt object/i);
    await db.query(`delete from storage.objects where name='${receipt.object_path}'`);
    await db.query(
      `insert into storage.objects(bucket_id,name,metadata) values ('expense-receipts','${receipt.object_path}','{"mimetype":"image/jpeg","size":1200}')`,
    );
    await db.query(
      `update expense_receipts set status='ready' where id='${receipt.id}'`,
    );
    await db.query(
      `update expense_receipts set status='ready' where id='${receipt.id}'`,
    );
    expect(
      (
        await db.query<{ status: string }>(
          `select status from expense_receipts where id='${receipt.id}'`,
        )
      ).rows[0].status,
    ).toBe("ready");
    await expect(
      db.query(
        `update expense_receipts set status='pending' where id='${receipt.id}'`,
      ),
    ).rejects.toThrow(/only pending receipts can become ready/i);
    await expect(
      db.query(
        `insert into storage.objects(bucket_id,name,metadata) values ('expense-receipts','${receipt.object_path}','{"mimetype":"image/jpeg","size":1200}')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.query(`delete from expense_receipts where id='${receipt.id}'`),
    ).rejects.toThrow(/delete the receipt object/i);

    await db.exec(`set request.jwt.claim.sub='${member}'`);
    expect(
      (
        await db.query(
          `select id from expense_receipts where id='${receipt.id}'`,
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          `select name from storage.objects where name='${receipt.object_path}'`,
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          `delete from storage.objects where name='${receipt.object_path}'`,
        )
      ).rowCount,
    ).toBe(0);
    await db.exec(`set request.jwt.claim.sub='${uploader}'`);
    const pendingReceipt = (
      await db.query<{ id: string; object_path: string }>(
        `insert into expense_receipts(trip_id,expense_id,byte_size) values ('${trip1}','${expense2}',1300) returning id,object_path`,
      )
    ).rows[0];
    await db.exec(`set request.jwt.claim.sub='${member}'`);
    expect(
      (
        await db.query(
          `select id from expense_receipts where id='${pendingReceipt.id}'`,
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          `select name from storage.objects where name='${pendingReceipt.object_path}'`,
        )
      ).rows,
    ).toHaveLength(0);

    await db.exec(`set request.jwt.claim.sub='${removed}'`);
    expect(
      (
        await db.query(
          `select id from expense_receipts where id='${receipt.id}'`,
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query(`delete from expense_receipts where id='${receipt.id}'`))
        .rowCount,
    ).toBe(0);
    await db.exec(`set request.jwt.claim.sub='${pending}'`);
    expect(
      (
        await db.query(
          `select id from expense_receipts where id='${receipt.id}'`,
        )
      ).rows,
    ).toHaveLength(0);
    await db.exec(`set request.jwt.claim.sub='${outsider}'`);
    expect(
      (
        await db.query(
          `select id from expense_receipts where id='${receipt.id}'`,
        )
      ).rows,
    ).toHaveLength(0);
    await db.exec("set role anon");
    await expect(
      db.query(`select id from expense_receipts where id='${receipt.id}'`),
    ).rejects.toThrow();
    await db.exec(
      "reset role; set role authenticated; set request.jwt.claim.sub='" +
        uploader +
        "'",
    );

    await db.query(
      `delete from storage.objects where name='${receipt.object_path}'`,
    );
    await db.query(`delete from expense_receipts where id='${receipt.id}'`);
    // An organizer can remove another uploader's orphaned object and metadata.
    await db.exec(`set request.jwt.claim.sub='${uploader}'`);
    const organizerReceipt = (
      await db.query<{ id: string; object_path: string }>(
        `insert into expense_receipts(trip_id,expense_id,byte_size) values ('${trip1}','${expense1}',1200) returning id,object_path`,
      )
    ).rows[0];
    await db.exec(
      `insert into storage.objects(bucket_id,name,metadata) values ('expense-receipts','${organizerReceipt.object_path}','{"mimetype":"image/jpeg","size":1200}')`,
    );
    await db.exec(`set request.jwt.claim.sub='${organizer}'`);
    await db.query(
      `delete from storage.objects where name='${organizerReceipt.object_path}'`,
    );
    await db.query(
      `delete from expense_receipts where id='${organizerReceipt.id}'`,
    );
    await db.exec(`set request.jwt.claim.sub='${uploader}'`);
    const archivedReceipt = (
      await db.query<{ id: string; object_path: string }>(
        `insert into expense_receipts(trip_id,expense_id,byte_size) values ('${trip1}','${expense1}',1200) returning id,object_path`,
      )
    ).rows[0];
    await db.query(
      `insert into storage.objects(bucket_id,name,metadata) values ('expense-receipts','${archivedReceipt.object_path}','{"mimetype":"image/jpeg","size":1200}')`,
    );
    await db.query(
      `update expense_receipts set status='ready' where id='${archivedReceipt.id}'`,
    );
    await db.query(
      `insert into storage.objects(bucket_id,name,metadata) values ('expense-receipts','${pendingReceipt.object_path}','{"mimetype":"image/jpeg","size":1300}')`,
    );
    await db.query(
      `update expense_receipts set status='ready' where id='${pendingReceipt.id}'`,
    );
    await db.exec(`set request.jwt.claim.sub='${organizer}'`);
    await db.query(`select archive_trip('${trip1}')`);
    await db.exec(`set request.jwt.claim.sub='${member}'`);
    expect(
      (
        await db.query(
          `select id from expense_receipts where id='${archivedReceipt.id}'`,
        )
      ).rows,
    ).toHaveLength(1);
    await db.exec(`set request.jwt.claim.sub='${uploader}'`);
    await db.query(
      `delete from storage.objects where name='${archivedReceipt.object_path}'`,
    );
    await db.query(
      `delete from expense_receipts where id='${archivedReceipt.id}'`,
    );
    await db.exec(`set request.jwt.claim.sub='${organizer}'`);
    await expect(
      db.query(`select delete_trip('${trip1}','Receipts')`),
    ).rejects.toThrow(/delete the receipt object from storage before deleting its metadata/i);
    expect(
      (
        await db.query(
          `select name from storage.objects where name='${pendingReceipt.object_path}'`,
        )
      ).rows,
    ).toHaveLength(1);
    await db.query(
      `delete from storage.objects where name='${pendingReceipt.object_path}'`,
    );
    await db.query(`select delete_trip('${trip1}','Receipts')`);
    expect(
      (await db.query(`select id from trips where id='${trip1}'`)).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          `select id from expense_receipts where id='${pendingReceipt.id}'`,
        )
      ).rows,
    ).toHaveLength(0);
    await db.exec("reset role");
    const bucket = (
      await db.query<{
        public: boolean;
        file_size_limit: number;
        allowed_mime_types: string[];
      }>(
        "select public,file_size_limit,allowed_mime_types from storage.buckets where id='expense-receipts'",
      )
    ).rows[0];
    expect(bucket).toEqual({
      public: false,
      file_size_limit: 524288,
      allowed_mime_types: ["image/jpeg"],
    });
    const grants = (
      await db.query<{
        can_change_path: boolean;
        can_change_size: boolean;
        can_set_status_on_insert: boolean;
      }>(`
      select has_column_privilege('authenticated','public.expense_receipts','object_path','UPDATE') can_change_path,
        has_column_privilege('authenticated','public.expense_receipts','byte_size','UPDATE') can_change_size,
        has_column_privilege('authenticated','public.expense_receipts','status','INSERT') can_set_status_on_insert
    `)
    ).rows[0];
    expect(grants).toEqual({
      can_change_path: false,
      can_change_size: false,
      can_set_status_on_insert: false,
    });
  } finally {
    await db.close();
  }
}, 60000);
