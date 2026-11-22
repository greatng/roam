alter table public.trip_invites alter column max_uses drop not null;

create function public.create_reusable_invite(p_trip_id uuid, p_expiry_date date)
returns table(id uuid, token text)
language plpgsql security definer set search_path = '' as $$
declare
  v_timezone text;
  v_random text := replace(gen_random_uuid()::text, '-', '');
  v_token text := left(v_random, 12) || right(v_random, 4);
  v_expiry timestamptz;
  v_id uuid;
begin
  perform private.assert_organizer(p_trip_id);
  select timezone into v_timezone from public.trips
    where trips.id = p_trip_id and status = 'active' for update;
  if not found then raise exception 'Trip archived'; end if;

  v_expiry := (p_expiry_date + 1)::timestamp at time zone v_timezone;
  if v_expiry is null or not isfinite(v_expiry) or v_expiry <= now() then
    raise exception 'Invalid expiry';
  end if;

  update public.trip_invites set revoked_at = now()
    where trip_id = p_trip_id and max_uses is null and revoked_at is null;
  insert into public.trip_invites (trip_id, token_hash, expires_at, max_uses)
    values (p_trip_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_expiry, null)
    returning trip_invites.id into v_id;
  return query select v_id, v_token;
end;
$$;

revoke all on function public.create_reusable_invite(uuid, date) from public, anon;
grant execute on function public.create_reusable_invite(uuid, date) to authenticated;

notify pgrst, 'reload schema';
