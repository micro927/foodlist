# Places, Areas and Place plans live in new tables only

The app was already running on the production Supabase database when Places and Areas were added, so the existing `restaurants` and `plan_entries` tables were left untouched. Plan entries for Places get their own `place_plan_entries` table instead of a generalised `plan_entries` (whose `restaurant_id` is `NOT NULL` with a foreign key to `restaurants`). Areas hold `restaurant_ids` and `place_ids` as plain `uuid[]` with no foreign keys or join tables, so an Area never depends on, or cascades from, the things it lists; the app hides IDs that no longer exist and drops them when the Area is next saved.

## Consequences

- Eats and Places plans are two parallel tables with near-identical shape; code that reads "the plan" reads both.
- Deleting a Restaurant or Place does not touch any Area row; stale IDs are expected and must be tolerated wherever an Area's lists are read.
- `place_plan_entries.place_id` does reference `places` with `on delete cascade`, matching how Eats plans already behave. Both tables are new, so this is allowed.
