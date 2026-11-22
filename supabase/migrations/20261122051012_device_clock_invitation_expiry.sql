create function public.create_reusable_invite_until(p_trip_id uuid, p_expires_at timestamptz)
returns table(id uuid, token text)
language plpgsql security definer set search_path = '' as $$
declare
  v_random text := replace(gen_random_uuid()::text, '-', '');
  v_token text := left(v_random, 12) || right(v_random, 4);
  v_id uuid;
begin
  perform private.assert_organizer(p_trip_id);
  perform 1 from public.trips
    where trips.id = p_trip_id and status = 'active' for update;
  if not found then raise exception 'Trip archived'; end if;

  if p_expires_at is null or not isfinite(p_expires_at) or p_expires_at <= now() then
    raise exception 'Invalid expiry';
  end if;

  update public.trip_invites set revoked_at = now()
    where trip_id = p_trip_id and max_uses is null and revoked_at is null;
  insert into public.trip_invites (trip_id, token_hash, expires_at, max_uses)
    values (p_trip_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), p_expires_at, null)
    returning trip_invites.id into v_id;
  return query select v_id, v_token;
end;
$$;

revoke all on function public.create_reusable_invite_until(uuid, timestamptz) from public, anon;
grant execute on function public.create_reusable_invite_until(uuid, timestamptz) to authenticated;

notify pgrst, 'reload schema';
