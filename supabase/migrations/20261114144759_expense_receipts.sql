-- Issue #37: one private, JPEG-only receipt per saved expense.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expense-receipts', 'expense-receipts', false, 524288, array['image/jpeg']::text[])
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.expense_receipts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  expense_id uuid not null unique,
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  object_path text generated always as (trip_id::text || '/' || expense_id::text || '/' || id::text || '.jpg') stored,
  byte_size integer not null check (byte_size between 1 and 524288),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  created_at timestamptz not null default now(),
  foreign key (trip_id, expense_id) references public.expenses(trip_id, id) on delete cascade
);
create index expense_receipts_trip on public.expense_receipts(trip_id);

alter table public.expense_receipts enable row level security;
create policy expense_receipts_read on public.expense_receipts for select to authenticated
  using (public.is_trip_member(trip_id));
create policy expense_receipts_insert on public.expense_receipts for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and status = 'pending'
    and public.is_trip_member(trip_id)
    and exists (select 1 from public.trips t where t.id = trip_id and t.status = 'active')
  );
create policy expense_receipts_update on public.expense_receipts for update to authenticated
  using (
    uploaded_by = (select auth.uid())
    and status in ('pending', 'ready')
    and public.is_trip_member(trip_id)
    and exists (select 1 from public.trips t where t.id = trip_id and t.status = 'active')
  )
  with check (
    uploaded_by = (select auth.uid())
    and status = 'ready'
    and public.is_trip_member(trip_id)
    and exists (select 1 from public.trips t where t.id = trip_id and t.status = 'active')
  );
create policy expense_receipts_delete on public.expense_receipts for delete to authenticated
  using (
    public.is_trip_member(trip_id)
    and (uploaded_by = (select auth.uid()) or public.is_trip_organizer(trip_id))
  );

revoke all on public.expense_receipts from public, anon, authenticated;
grant select on public.expense_receipts to authenticated;
grant insert (id, trip_id, expense_id, uploaded_by, byte_size) on public.expense_receipts to authenticated;
grant update (status) on public.expense_receipts to authenticated;
grant delete on public.expense_receipts to authenticated;

-- Enforce the lifecycle even for future privileged write paths.  The storage
-- metadata row is checked under the trigger owner's privileges (not caller RLS).
create function private.validate_expense_receipt_write() returns trigger
language plpgsql security definer set search_path = '' set row_security = off as $$
declare v_mime text; v_size text;
begin
  if tg_op = 'INSERT' then
    if new.uploaded_by is distinct from auth.uid() or new.status <> 'pending' then
      raise exception 'Receipt must be created pending by its uploader' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.trip_id is distinct from old.trip_id
    or new.expense_id is distinct from old.expense_id
    or new.uploaded_by is distinct from old.uploaded_by
    or new.byte_size is distinct from old.byte_size
    or new.created_at is distinct from old.created_at
    or old.status not in ('pending', 'ready') or new.status <> 'ready' then
    raise exception 'Receipt identity is immutable and only pending receipts can become ready' using errcode = '42501';
  end if;

  select o.metadata ->> 'mimetype', o.metadata ->> 'size'
    into v_mime, v_size
    from storage.objects o
    where o.bucket_id = 'expense-receipts' and o.name = old.object_path;
  if not found or v_mime is distinct from 'image/jpeg'
    or v_size is null or v_size !~ '^[0-9]+$' or v_size::bigint <> old.byte_size then
    raise exception 'Matching JPEG receipt object with expected size is required' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_expense_receipt_write() from public, anon, authenticated;
create trigger expense_receipts_validate_write
  before insert or update on public.expense_receipts
  for each row execute function private.validate_expense_receipt_write();

create function private.guard_expense_receipt_delete() returns trigger
language plpgsql security definer set search_path = '' set row_security = off as $$
begin
  if exists (select 1 from storage.objects o
      where o.bucket_id = 'expense-receipts' and o.name = old.object_path) then
    raise exception 'Delete the receipt object from Storage before deleting its metadata' using errcode = '23503';
  end if;
  return old;
end;
$$;
revoke all on function private.guard_expense_receipt_delete() from public, anon, authenticated;
create trigger expense_receipts_storage_delete_guard
  before delete on public.expense_receipts
  for each row execute function private.guard_expense_receipt_delete();

-- Storage grants no upload by default.  There is deliberately no UPDATE policy:
-- clients must use a non-upsert upload and handle a conflict by verifying the
-- existing immutable path before marking metadata ready.
create policy expense_receipts_objects_read on storage.objects for select to authenticated
  using (
    bucket_id = 'expense-receipts'
    and exists (
      select 1 from public.expense_receipts r
      where r.object_path = name
        and public.is_trip_member(r.trip_id)
        and (r.status = 'ready' or r.uploaded_by = (select auth.uid())
          or public.is_trip_organizer(r.trip_id))
    )
  );
create policy expense_receipts_objects_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'expense-receipts'
    and exists (
      select 1 from public.expense_receipts r
      join public.trips t on t.id = r.trip_id and t.status = 'active'
      where r.object_path = name and r.status = 'pending'
        and r.uploaded_by = (select auth.uid())
        and public.is_trip_member(r.trip_id)
        and metadata ->> 'mimetype' = 'image/jpeg'
        and metadata ->> 'size' ~ '^[0-9]+$'
        and metadata ->> 'size' = r.byte_size::text
    )
  );
create policy expense_receipts_objects_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'expense-receipts'
    and exists (
      select 1 from public.expense_receipts r
      where r.object_path = name
        and public.is_trip_member(r.trip_id)
        and (r.uploaded_by = (select auth.uid()) or public.is_trip_organizer(r.trip_id))
    )
  );
