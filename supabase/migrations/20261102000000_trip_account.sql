-- Only the trip's one Supabase account gets in. The app signs in as VITE_APP_EMAIL with the lock screen's
-- password; until then the publishable key alone reads and writes nothing. Create that user in
-- Authentication → Users, and turn off new sign-ups so nobody else can make an account.

create or replace function public.is_trip_account() returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'sitthiphon.s@outlook.com'
$$;

-- Tables: replace "anyone with the key" with "the signed-in trip account".
drop policy "public full access" on public.restaurants;
drop policy "public full access" on public.plan_entries;
drop policy "public full access" on public.places;
drop policy "public full access" on public.place_plan_entries;
drop policy "public full access" on public.areas;
drop policy "public full access" on public.bills;
drop policy "public read" on public.bill_scans;
drop policy "public insert" on public.bill_scans;

create policy "trip account" on public.restaurants
  for all to authenticated using (public.is_trip_account()) with check (public.is_trip_account());
create policy "trip account" on public.plan_entries
  for all to authenticated using (public.is_trip_account()) with check (public.is_trip_account());
create policy "trip account" on public.places
  for all to authenticated using (public.is_trip_account()) with check (public.is_trip_account());
create policy "trip account" on public.place_plan_entries
  for all to authenticated using (public.is_trip_account()) with check (public.is_trip_account());
create policy "trip account" on public.areas
  for all to authenticated using (public.is_trip_account()) with check (public.is_trip_account());
create policy "trip account" on public.bills
  for all to authenticated using (public.is_trip_account()) with check (public.is_trip_account());
-- /api/scan counts and records scans with the caller's own session.
create policy "trip account read" on public.bill_scans
  for select to authenticated using (public.is_trip_account());
create policy "trip account insert" on public.bill_scans
  for insert to authenticated with check (public.is_trip_account());

-- Photos: only the trip account can upload, replace, delete or list them. The bucket stays public, so a
-- photo's own URL still loads in an <img> (paths are long and random).
drop policy "foodlist covers read" on storage.objects;
drop policy "foodlist covers insert" on storage.objects;
drop policy "foodlist covers update" on storage.objects;
drop policy "foodlist covers delete" on storage.objects;

create policy "foodlist covers read" on storage.objects
  for select to authenticated using (bucket_id = 'foodlist-covers' and public.is_trip_account());
create policy "foodlist covers insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'foodlist-covers' and public.is_trip_account());
create policy "foodlist covers update" on storage.objects
  for update to authenticated using (bucket_id = 'foodlist-covers' and public.is_trip_account());
create policy "foodlist covers delete" on storage.objects
  for delete to authenticated using (bucket_id = 'foodlist-covers' and public.is_trip_account());
