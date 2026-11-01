-- Bills: shared purchases split per person. Stands alone: no references to restaurants, plans or areas.
-- Only adds new tables (see docs/adr/0001-new-features-in-new-tables-only.md).
-- Same access model as the first migration: anon gets full read/write.

create table public.bills (
  id             uuid primary key,                  -- made on the phone so receipt photos can upload first
  shop           text not null default '',
  day            date not null,
  time           text not null,                     -- 'HH:MM'
  payer          text not null,                     -- person id from trip.config.ts
  sharing        text[] not null,                   -- person ids
  lines          jsonb not null default '[]',       -- receipt lines with who ate each unit (see BillLine in src/lib/types.ts)
  receipt_total  integer,                           -- yen as printed, to check the lines against
  paid           jsonb not null default '{}',       -- person id → yen they had paid back when marked paid
  photo_paths    text[] not null default '{}',      -- paths inside the "foodlist-covers" bucket, under bills/…
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index bills_day_idx on public.bills (day desc, time desc);

create trigger bills_touch before update on public.bills
  for each row execute function public.touch_updated_at();

-- One row per receipt scan, so /api/scan can cap scans per day.
create table public.bill_scans (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now()
);

alter table public.bills enable row level security;
alter table public.bill_scans enable row level security;

create policy "public full access" on public.bills
  for all to anon, authenticated using (true) with check (true);
create policy "public read" on public.bill_scans
  for select to anon, authenticated using (true);
create policy "public insert" on public.bill_scans
  for insert to anon, authenticated with check (true);

-- Live updates between phones.
alter publication supabase_realtime add table public.bills;
