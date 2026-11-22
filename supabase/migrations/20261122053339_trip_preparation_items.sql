create table public.trip_preparation_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  created_at timestamptz not null default now()
);

create index trip_preparation_items_trip_order
  on public.trip_preparation_items (trip_id, created_at, id);

alter table public.trip_preparation_items enable row level security;
revoke all on public.trip_preparation_items from public, anon, authenticated;
grant select, delete on public.trip_preparation_items to authenticated;
grant insert (trip_id, title), update (title) on public.trip_preparation_items to authenticated;

create policy preparation_read on public.trip_preparation_items for select to authenticated
  using (public.is_trip_member(trip_id));
create policy preparation_add on public.trip_preparation_items for insert to authenticated
  with check (public.is_trip_organizer(trip_id));
create policy preparation_edit on public.trip_preparation_items for update to authenticated
  using (public.is_trip_organizer(trip_id))
  with check (public.is_trip_organizer(trip_id));
create policy preparation_remove on public.trip_preparation_items for delete to authenticated
  using (public.is_trip_organizer(trip_id));

notify pgrst, 'reload schema';
