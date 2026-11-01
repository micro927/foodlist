# Bills are split by Person, not by Couple

Everywhere else in the app the "who" is a Couple. Bills break that rule: Items, Shares and Balances are per Person (Micro, Bua, Fair, Bee in `trip.config.ts`), because who ate the third beer is a person, not a pair. We considered splitting by Couple (only two parties, matching the rest of the app) and rolling People up to Couples for Balances, and chose plain per-Person balances. Each Person still records their Couple, but has their own colour so the four are easy to tell apart.

## Consequences

- Bills store person ids (`payer`, `sharing`, inside `lines` and `paid`), never couple ids. Changing to Couples later means migrating every saved Bill.
- "Me" (this phone's Couple) has no meaning in Bills.
- Bills stand alone: no Bill refers to a Restaurant, Plan entry or Area, so deleting those never touches a Bill.
