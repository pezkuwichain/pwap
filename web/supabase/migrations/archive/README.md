# Archived migrations

Superseded by `../00000000000000_baseline.sql` on 2026-08-01. Kept, not deleted:
they are the only record of why parts of the schema look the way they do, even
where they no longer describe it.

**Do not run these.** They are not a working migration set and several are unsafe
to replay.

## Why they were replaced

These files were applied by hand through the Supabase SQL editor over months —
most still carry `-- Run this in Supabase SQL Editor` headers. Some runs stopped
partway and were recorded as applied regardless, so the recorded history stopped
matching the database. Three things made that concrete:

**Functions declared but absent.** 25 functions across six migrations, all marked
applied, did not exist in the database. Their tables did. Two were reached by the
app, so merchant tier upgrades and post-trade reputation updates had been quietly
dead. Found on 2026-07-30 only because a user hit
`Could not find the function public.upsert_user_profile(...)` while toggling a
notification setting.

**Conflicting definitions.** `admin_roles` is defined three different ways and
production matches none of them:

| source | columns |
|---|---|
| `001_initial_schema.sql` | id, user_id, role, granted_by, granted_at |
| `COMBINED_p2p_full_system.sql` | user_id, role, created_at |
| production | id, user_id, role, permissions, created_at, updated_at |

**Not replayable.** Applied to an empty database, five of them fail. The legacy
`0NN` filenames sort before the 14-digit timestamps they depend on — `"013"` <
`"20241117054600"` — so `013` runs before the migration that creates the table it
alters. That ordering could never have worked from scratch.

## What replaced them

A `pg_dump` of the live `public` schema, which matches production by
construction. Verified: applying it to an empty database produces 83 tables, 39
functions, 222 indexes and 360 policies — identical counts to production.

CI now applies migrations to an empty Postgres on every PR, so a migration that
cannot run from scratch fails there instead of on the production host. That check
was impossible while this set was the starting point.

## If you need something from here

Read it, take the statement you need, and write a new forward migration against
the baseline. Do not re-run the file — `20241117054601` inserts payment methods
with no `ON CONFLICT`, `015` has 17 unguarded inserts, and `018` overwrites the
live hot wallet address.
