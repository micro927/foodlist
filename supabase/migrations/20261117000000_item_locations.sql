-- Where each Restaurant or Place is, read from its Google Maps link, so Eats can show a map.
-- Only adds a new table (see docs/adr/0001-new-features-in-new-tables-only.md).
-- item_id has no foreign key (like areas): it may be a restaurant or a place, and rows for deleted items are ignored.

create table public.item_locations (
  item_id     uuid primary key,
  maps_url    text not null,             -- the link these coordinates came from; stale once the item's link changes
  lat         double precision,          -- null = this link couldn't be located (not retried until the link changes)
  lng         double precision,
  updated_at  timestamptz not null default now()
);

create trigger item_locations_touch before update on public.item_locations
  for each row execute function public.touch_updated_at();

alter table public.item_locations enable row level security;

create policy "trip account" on public.item_locations
  for all to authenticated using (public.is_trip_account()) with check (public.is_trip_account());

-- Live updates between phones.
alter publication supabase_realtime add table public.item_locations;
