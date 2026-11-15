-- Issue #40: retain financial history while excluding deleted expenses from
-- active totals. Receipt files remain in Storage until the client cleans them.
alter table public.expenses
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id);

create or replace function public.create_expense(
  p_trip_id uuid,p_payer_member_id uuid,p_amount_minor text,p_currency text,
  p_description text,p_shares jsonb,p_operation_id uuid,
  p_expense_date date default null,p_expense_time time default null
) returns public.expenses
language plpgsql security definer set search_path='' as $$
declare v_expense public.expenses; v_existing public.expenses;
begin
  perform public.assert_member_row(p_trip_id,p_payer_member_id);
  perform private.assert_active_trip(p_trip_id);
  if p_expense_time is not null and p_expense_date is null then raise exception 'Expense time requires date'; end if;
  select * into v_existing from public.expenses
    where trip_id=p_trip_id and client_operation_id=p_operation_id for update;
  if found and v_existing.deleted_at is not null then
    raise exception 'Deleted expense operation cannot be replayed' using errcode='42501';
  end if;
  if found and (v_existing.expense_date is distinct from p_expense_date
      or v_existing.expense_time is distinct from p_expense_time) then
    raise exception 'Operation ID payload mismatch' using errcode='22023';
  end if;
  v_expense:=private.create_expense(p_trip_id,p_payer_member_id,p_amount_minor,
    p_currency,p_description,p_shares,p_operation_id);
  if v_existing.id is null then
    update public.expenses set expense_date=p_expense_date,expense_time=p_expense_time,
      occurrence_timezone=(select timezone from public.trips where id=p_trip_id)
      where id=v_expense.id returning * into v_expense;
  end if;
  return v_expense;
end;
$$;

-- Keep the original correction implementation private and guard even its
-- idempotent replay path before delegating.
alter function public.correct_expense(uuid,uuid,integer,uuid,text,text,text,jsonb,uuid,date,time)
  set schema private;
revoke all on function private.correct_expense(uuid,uuid,integer,uuid,text,text,text,jsonb,uuid,date,time)
  from public,anon,authenticated;
create function public.correct_expense(
  p_trip_id uuid,p_expense_id uuid,p_expected_version integer,p_payer_member_id uuid,
  p_amount_minor text,p_currency text,p_description text,p_shares jsonb,p_operation_id uuid,
  p_expense_date date default null,p_expense_time time default null
) returns public.expenses
language plpgsql security definer set search_path='' as $$
declare v_expense public.expenses;
begin
  perform private.assert_organizer(p_trip_id);
  perform private.assert_active_trip(p_trip_id);
  select * into v_expense from public.expenses
    where trip_id=p_trip_id and id=p_expense_id for update;
  if not found then raise exception 'Expense not found in trip' using errcode='22023'; end if;
  if v_expense.deleted_at is not null then
    raise exception 'Deleted expenses cannot be corrected' using errcode='42501';
  end if;
  return private.correct_expense(p_trip_id,p_expense_id,p_expected_version,p_payer_member_id,
    p_amount_minor,p_currency,p_description,p_shares,p_operation_id,p_expense_date,p_expense_time);
end;
$$;
revoke all on function public.correct_expense(uuid,uuid,integer,uuid,text,text,text,jsonb,uuid,date,time)
  from public,anon,authenticated;
grant execute on function public.correct_expense(uuid,uuid,integer,uuid,text,text,text,jsonb,uuid,date,time)
  to authenticated;

create function public.delete_expense(p_trip_id uuid,p_expense_id uuid,p_expected_version integer)
returns public.expenses
language plpgsql security definer set search_path='' as $$
declare v_expense public.expenses;
begin
  perform private.assert_organizer(p_trip_id);
  perform private.assert_active_trip(p_trip_id);
  select * into v_expense from public.expenses
    where id=p_expense_id and trip_id=p_trip_id for update;
  if not found then raise exception 'Expense not found in trip' using errcode='22023'; end if;
  if v_expense.deleted_at is not null then return v_expense; end if;
  if v_expense.version is distinct from p_expected_version then
    raise exception 'Expense changed; refresh before deleting' using errcode='40001';
  end if;
  update public.expenses set deleted_at=pg_catalog.now(),deleted_by=auth.uid(),version=version+1
    where id=p_expense_id and trip_id=p_trip_id returning * into v_expense;
  return v_expense;
end;
$$;
revoke all on function public.delete_expense(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.delete_expense(uuid,uuid,integer) to authenticated;

create or replace function public.trip_balances(p_trip_id uuid)
returns table(trip_member_id uuid,net_minor text)
language sql stable security definer set search_path='' as $$
  select m.id,
    (coalesce((select sum(e.amount_minor) from public.expenses e
      where e.trip_id=p_trip_id and e.paid_by_member_id=m.id and e.deleted_at is null),0)
      - coalesce((select sum(s.owed_minor) from public.expense_shares s
        join public.expenses e on e.trip_id=s.trip_id and e.id=s.expense_id
        where s.trip_id=p_trip_id and s.trip_member_id=m.id and e.deleted_at is null),0)
      + coalesce((select sum(x.amount_minor) from public.settlements x where x.trip_id=p_trip_id and x.from_member_id=m.id and x.status='confirmed'),0)
      - coalesce((select sum(x.amount_minor) from public.settlements x where x.trip_id=p_trip_id and x.to_member_id=m.id and x.status='confirmed'),0))::text
  from public.trip_members m
  where m.trip_id=p_trip_id and public.is_trip_member(p_trip_id)
  order by m.id;
$$;

-- Prevent a correction from mutating a deleted expense through older RPC code.
create function private.reject_deleted_expense_update() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.deleted_at is not null then
    raise exception 'Deleted expenses cannot be corrected' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function private.reject_deleted_expense_update() from public,anon,authenticated;
create trigger expenses_reject_deleted_update before update on public.expenses
  for each row execute function private.reject_deleted_expense_update();

-- Pending receipt jobs cannot insert metadata, complete uploads, or add files
-- after the parent expense has been marked deleted. Existing rows stay readable
-- and deletable for retry-safe cleanup.
create or replace function private.validate_expense_receipt_write() returns trigger
language plpgsql security definer set search_path='' set row_security=off as $$
declare v_mime text; v_size text;
begin
  if not exists(select 1 from public.expenses e
      where e.trip_id=new.trip_id and e.id=new.expense_id and e.deleted_at is null) then
    raise exception 'Receipt expense is deleted or missing' using errcode='42501';
  end if;
  if tg_op='INSERT' then
    if new.uploaded_by is distinct from auth.uid() or new.status<>'pending' then
      raise exception 'Receipt must be created pending by its uploader' using errcode='42501';
    end if;
    return new;
  end if;
  if new.id is distinct from old.id or new.trip_id is distinct from old.trip_id
    or new.expense_id is distinct from old.expense_id or new.uploaded_by is distinct from old.uploaded_by
    or new.byte_size is distinct from old.byte_size or new.created_at is distinct from old.created_at
    or old.status not in ('pending','ready') or new.status<>'ready' then
    raise exception 'Receipt identity is immutable and only pending receipts can become ready' using errcode='42501';
  end if;
  select o.metadata->>'mimetype',o.metadata->>'size' into v_mime,v_size
    from storage.objects o where o.bucket_id='expense-receipts' and o.name=old.object_path;
  if not found or v_mime is distinct from 'image/jpeg' or v_size is null
    or v_size !~ '^[0-9]+$' or v_size::bigint<>old.byte_size then
    raise exception 'Matching JPEG receipt object with expected size is required' using errcode='23514';
  end if;
  return new;
end;
$$;

drop policy expense_receipts_insert on public.expense_receipts;
create policy expense_receipts_insert on public.expense_receipts for insert to authenticated
with check (uploaded_by=(select auth.uid()) and status='pending'
  and public.is_trip_member(trip_id)
  and exists(select 1 from public.trips t where t.id=trip_id and t.status='active')
  and exists(select 1 from public.expenses e
    where e.trip_id=public.expense_receipts.trip_id
      and e.id=public.expense_receipts.expense_id and e.deleted_at is null));
drop policy expense_receipts_update on public.expense_receipts;
create policy expense_receipts_update on public.expense_receipts for update to authenticated
using (uploaded_by=(select auth.uid()) and status in ('pending','ready')
  and public.is_trip_member(trip_id)
  and exists(select 1 from public.trips t where t.id=trip_id and t.status='active')
  and exists(select 1 from public.expenses e
    where e.trip_id=public.expense_receipts.trip_id
      and e.id=public.expense_receipts.expense_id and e.deleted_at is null))
with check (uploaded_by=(select auth.uid()) and status='ready'
  and public.is_trip_member(trip_id)
  and exists(select 1 from public.trips t where t.id=trip_id and t.status='active')
  and exists(select 1 from public.expenses e
    where e.trip_id=public.expense_receipts.trip_id
      and e.id=public.expense_receipts.expense_id and e.deleted_at is null));

drop policy expense_receipts_objects_insert on storage.objects;
create policy expense_receipts_objects_insert on storage.objects for insert to authenticated
with check (bucket_id='expense-receipts' and exists(
  select 1 from public.expense_receipts r
  join public.trips t on t.id=r.trip_id and t.status='active'
  join public.expenses e on e.trip_id=r.trip_id and e.id=r.expense_id and e.deleted_at is null
  where r.object_path=name and r.status='pending' and r.uploaded_by=(select auth.uid())
    and public.is_trip_member(r.trip_id) and metadata->>'mimetype'='image/jpeg'
    and metadata->>'size' ~ '^[0-9]+$' and metadata->>'size'=r.byte_size::text));

-- A failed cleanup must not leave a deleted expense's photo visible to the
-- whole trip. Keep access for the uploader and organizer so cleanup can retry.
drop policy expense_receipts_objects_read on storage.objects;
create policy expense_receipts_objects_read on storage.objects for select to authenticated
using (bucket_id='expense-receipts' and exists(
  select 1 from public.expense_receipts r
  join public.expenses e on e.trip_id=r.trip_id and e.id=r.expense_id
  where r.object_path=name and public.is_trip_member(r.trip_id)
    and ((e.deleted_at is null and (r.status='ready'
          or r.uploaded_by=(select auth.uid()) or public.is_trip_organizer(r.trip_id)))
      or (e.deleted_at is not null
          and (r.uploaded_by=(select auth.uid()) or public.is_trip_organizer(r.trip_id))))));

notify pgrst, 'reload schema';
