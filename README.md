# Tokyo 2027 Eats

Our group-trip restaurant list (🍜 **Eats**), things to do (📍 **Places**), day-by-day plan for both (🗓 **Plan**) and neighbourhood guides (🗺️ **Areas**) and shared bill splitting with receipt scanning (🧾 **Bills**) for Micro Bua 💜 and Fair Bee 🐝. Terms are defined in [`CONTEXT.md`](CONTEXT.md).

Vite + React + TypeScript, Tailwind v4, TanStack Query, Supabase (Postgres, Storage, Realtime), deployed on Vercel. Bills → Scan reads receipts with Claude through a Vercel function. Installable as a PWA.

## Run locally

```bash
npm install
cp .env.example .env   # leave Supabase keys empty to run in demo mode
npm run dev
```

**Demo mode:** if the Supabase keys are empty, the app keeps its data in the browser's localStorage. Use it to try things out before setting up a backend.

## Setup checklist

1. **Supabase:** use a dedicated free project for this app.
   - Run `supabase link --project-ref <ref>`, then `supabase db push`. This applies [`supabase/migrations/`](supabase/migrations/): the tables, access rules, realtime and the `foodlist-covers` photo bucket.
   - Or paste the migration into the SQL Editor instead.
   - Optional: run [`supabase/seed.sql`](supabase/seed.sql) in the SQL Editor for some test restaurants.
   - Copy the **Project URL** and the **publishable key** (the legacy `anon` key also works). Never use the service_role or secret key.
   - **Authentication → Users → Add user:** the trip account, with the email in `VITE_APP_EMAIL` and the password everyone types on the lock screen. Tick **Auto Confirm User**.
   - **Authentication → Sign In / Providers:** turn off **Allow new users to sign up**.
2. **`.env`:** set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_APP_EMAIL`. The email is also written in [`supabase/migrations/20261102000000_trip_account.sql`](supabase/migrations/20261102000000_trip_account.sql); change both together.
3. **Vercel:** import the repo. The framework preset is Vite. Add the same three environment variables and deploy.
   - For Bills → Scan, also add `ANTHROPIC_API_KEY` (from console.anthropic.com; a few dollars of credit covers a trip at roughly $0.04 per scan) and optionally `SCAN_DAILY_LIMIT` (default 30). Without the key, bills still work; lines are added by hand.
   - [`vercel.json`](vercel.json) schedules a daily cron to [`api/keepalive.ts`](api/keepalive.ts), which pings the database so the free Supabase project never pauses.
4. **Phones:** open the site, enter the password once, then use Share → **Add to Home Screen**.

## Security

- The lock screen signs in to Supabase as the one trip account. The password is never in the bundle; only the email is.
- The database only answers that signed-in account: every table, the scan counter and photo uploads (see the `trip_account` migration). The publishable key alone gets nothing.
- `/api/scan` asks Supabase who the caller is and only scans for the trip account, under a daily cap.
- Photos are in a public bucket, so anyone holding a photo's exact URL can open it. The paths are long and random.
- Each phone signs in once and stays signed in (the session renews itself) until its site data is cleared or the session is revoked in Supabase. A new password doesn't necessarily sign out phones that are already in.

## Next trip

Everything trip-specific is in [`src/trip.config.ts`](src/trip.config.ts): name, dates, couples, people (for Bills), meal and place slots, place categories, Good for tags, preset areas, category emoji and main colour. For a new trip:

1. Edit that file.
2. Point `.env` at a fresh Supabase project and run `supabase db push`.
3. Update the PWA name in [`vite.config.ts`](vite.config.ts).
4. Redeploy.

## Where things live

| Path | What |
| --- | --- |
| `src/lib/api.ts` | The only module that talks to storage (Supabase or demo localStorage) |
| `src/lib/data.ts` | TanStack Query hooks, optimistic ♥ toggles, live updates |
| `src/lib/sections.ts` | What differs between Eats and Places (names, category picker, plan slots) |
| `src/features/items/` | The Eats and Places tabs: list, cards, filters, add/edit form, detail and delete sheets |
| `src/features/areas/` | Areas list, detail, form (with restaurant/place pickers) and delete sheet |
| `src/features/plan/` | Eats / Places switch, two-lane day timeline, "Not scheduled yet", plan entry sheet |
| `src/features/bills/` | Bills tab (Meal / Person / Date views, who owes whom, mark paid), bill detail, the three-step add/edit sheet, and `split.ts` with all the money maths |
| `api/scan.ts` | Vercel function that reads receipt photos into lines with Claude (`ANTHROPIC_API_KEY` stays server-side) |
| `src/features/sheets.tsx` | Opens and closes every bottom sheet |
