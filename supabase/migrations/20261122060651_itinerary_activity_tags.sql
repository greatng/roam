alter table public.itinerary_items
  add column activity_tag text
  check (activity_tag in ('transport', 'food', 'shopping', 'sightseeing', 'must-go', 'other'));

create function public.upsert_tagged_itinerary_item(
  p_trip_id uuid,
  p_title text,
  p_activity_tag text,
  p_starts_at timestamptz default null,
  p_address text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_meeting_info text default null,
  p_notes text default null,
  p_position integer default 0,
  p_transport_mode text default null,
  p_item_id uuid default null,
  p_expected_version integer default null,
  p_plan_date date default null
)
returns public.itinerary_items
language plpgsql security definer set search_path = '' as $$
declare
  v_item public.itinerary_items;
begin
  -- Reuse the permission, date, and optimistic version checks in the existing editor.
  v_item := public.upsert_itinerary_item(
    p_trip_id, p_title, p_starts_at, p_address, p_latitude, p_longitude,
    p_meeting_info, p_notes, p_position, p_transport_mode, p_item_id,
    p_expected_version, p_plan_date
  );
  update public.itinerary_items set activity_tag = p_activity_tag
    where id = v_item.id returning * into v_item;
  return v_item;
end;
$$;

revoke all on function public.upsert_tagged_itinerary_item(uuid,text,text,timestamptz,text,double precision,double precision,text,text,integer,text,uuid,integer,date) from public, anon;
grant execute on function public.upsert_tagged_itinerary_item(uuid,text,text,timestamptz,text,double precision,double precision,text,text,integer,text,uuid,integer,date) to authenticated;

notify pgrst, 'reload schema';
