-- Storage evaluates INSERT authorization before the actual file is written.
-- The client permission probe supplies `mimetype` and `contentLength`, while
-- the final Storage row later records `mimetype` and `size`. Do not authorize
-- upload based on metadata that is unavailable during the probe. The private
-- bucket still enforces JPEG-only uploads and the 512 KiB limit, and receipt
-- finalization still checks the final object's MIME type and actual size.
drop policy expense_receipts_objects_insert on storage.objects;
create policy expense_receipts_objects_insert on storage.objects for insert to authenticated
with check (bucket_id='expense-receipts' and exists(
  select 1 from public.expense_receipts r
  join public.trips t on t.id=r.trip_id and t.status='active'
  join public.expenses e on e.trip_id=r.trip_id and e.id=r.expense_id and e.deleted_at is null
  where r.object_path=name and r.status='pending' and r.uploaded_by=(select auth.uid())
    and public.is_trip_member(r.trip_id)));
