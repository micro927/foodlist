-- Access model: the app is gated by a client-side password only, so the public (anon) role
-- gets full read/write on these tables and the foodlist-covers bucket.

create table public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default '',
  area        text not null default '',
  maps_url    text,
  inspo_url   text,
  notes       text,
  cover_path  text,                           -- path inside the "foodlist-covers" bucket
  interested  text[] not null default '{}',   -- couple ids from trip.config.ts
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.plan_entries (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  day            date not null,
  slot           text not null,               -- meal slot id from trip.config.ts
  time           text,                        -- optional 'HH:MM'
  going          text[] not null,             -- couple ids; all couples = shared meal
  position       integer not null default 0,
  created_at     timestamptz not null default now()
);

create index plan_entries_day_idx on public.plan_entries (day, slot);
create index plan_entries_restaurant_idx on public.plan_entries (restaurant_id);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger restaurants_touch before update on public.restaurants
  for each row execute function public.touch_updated_at();

alter table public.restaurants enable row level security;
alter table public.plan_entries enable row level security;

create policy "public full access" on public.restaurants
  for all to anon, authenticated using (true) with check (true);
create policy "public full access" on public.plan_entries
  for all to anon, authenticated using (true) with check (true);

-- Live updates between phones.
alter publication supabase_realtime add table public.restaurants, public.plan_entries;

-- Cover photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foodlist-covers', 'foodlist-covers', true, 5242880, array['image/webp', 'image/jpeg', 'image/png']);

create policy "foodlist covers read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'foodlist-covers');
create policy "foodlist covers insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'foodlist-covers');
create policy "foodlist covers update" on storage.objects
  for update to anon, authenticated using (bucket_id = 'foodlist-covers');
create policy "foodlist covers delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'foodlist-covers');
