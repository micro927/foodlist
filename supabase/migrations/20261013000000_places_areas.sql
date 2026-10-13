-- Places, their plan entries, and Areas. Only adds new tables: restaurants and plan_entries
-- stay exactly as they are (see docs/adr/0001-new-features-in-new-tables-only.md).
-- Same access model as the first migration: anon gets full read/write.

create table public.places (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default '',      -- Shopping, Activity, Photo or Chill (trip.config.ts)
  area        text not null default '',
  maps_url    text,
  inspo_url   text,
  notes       text,
  cover_path  text,                           -- path inside the "foodlist-covers" bucket
  interested  text[] not null default '{}',   -- couple ids from trip.config.ts
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.place_plan_entries (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references public.places (id) on delete cascade,
  day         date not null,
  slot        text not null,                  -- place slot id from trip.config.ts
  time        text,                           -- optional 'HH:MM'
  going       text[] not null,                -- couple ids; all couples = together
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index place_plan_entries_day_idx on public.place_plan_entries (day, slot);
create index place_plan_entries_place_idx on public.place_plan_entries (place_id);

-- restaurant_ids / place_ids are deliberately plain arrays with no foreign keys:
-- deleting a restaurant or place never touches an area, and the app ignores ids that are gone.
create table public.areas (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  maps_url        text,
  good_for        text[] not null default '{}',   -- good-for ids from trip.config.ts
  inspo_urls      text[] not null default '{}',
  restaurant_ids  uuid[] not null default '{}',
  place_ids       uuid[] not null default '{}',
  notes           text,
  cover_path      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger places_touch before update on public.places
  for each row execute function public.touch_updated_at();
create trigger areas_touch before update on public.areas
  for each row execute function public.touch_updated_at();

alter table public.places enable row level security;
alter table public.place_plan_entries enable row level security;
alter table public.areas enable row level security;

create policy "public full access" on public.places
  for all to anon, authenticated using (true) with check (true);
create policy "public full access" on public.place_plan_entries
  for all to anon, authenticated using (true) with check (true);
create policy "public full access" on public.areas
  for all to anon, authenticated using (true) with check (true);

-- Live updates between phones.
alter publication supabase_realtime add table public.places, public.place_plan_entries, public.areas;

-- Covers reuse the existing "foodlist-covers" bucket under places/… and areas/… paths.
