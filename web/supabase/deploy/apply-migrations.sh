#!/usr/bin/env bash
#
# apply-migrations.sh — idempotent, tracked migration applier for the self-hosted
# Supabase Postgres. Runs ON the Supabase host (invoked by the deploy-supabase CI
# job over SSH). Applies every versioned migration in $MIGRATIONS_DIR that is not
# yet recorded in supabase_migrations.schema_migrations, in ascending version
# order, each inside a single transaction together with its own tracking-row
# insert — so a failed migration rolls back cleanly and is never half-recorded.
#
# Safe to re-run: already-recorded versions are skipped. Non-versioned files
# (e.g. COMBINED_*.sql consolidated snapshots) are ignored.
#
# Usage: apply-migrations.sh <migrations_dir> [db_container]
set -euo pipefail

MIGRATIONS_DIR="${1:?migrations dir required}"
DB_CONTAINER="${2:-supabase-db}"
PSQL=(docker exec -i "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 --single-transaction -q)
PSQL_Q=(docker exec -i "$DB_CONTAINER" psql -U postgres -tAq)

echo "▶ apply-migrations: dir=$MIGRATIONS_DIR container=$DB_CONTAINER"

# Ensure the tracking schema/table exists (matches the Supabase CLI layout).
"${PSQL[@]}" >/dev/null <<'SQL'
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements text[],
  name text
);
SQL

# Snapshot the already-applied versions once.
applied="$("${PSQL_Q[@]}" -c "SELECT version FROM supabase_migrations.schema_migrations;")"
is_applied() { grep -qxF "$1" <<<"$applied"; }

pending=0 done=0
# Sort by filename so version order == chronological order (14-digit timestamps
# and zero-padded legacy 0NN prefixes both sort correctly).
for f in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  base="$(basename "$f")"
  # Versioned migrations only: <digits>_<name>.sql. Skips COMBINED_*, README, etc.
  if [[ ! "$base" =~ ^([0-9]+)_(.+)\.sql$ ]]; then
    echo "  ↷ skip (not a versioned migration): $base"
    continue
  fi
  version="${BASH_REMATCH[1]}"
  name="${BASH_REMATCH[2]}"

  if is_applied "$version"; then
    continue
  fi

  pending=$((pending+1))
  if [[ "${DRY_RUN:-}" == "1" ]]; then
    echo "  → [dry-run] WOULD apply $version ($name)"
    continue
  fi
  echo "  → applying $version ($name)"
  # Migration body + its tracking insert in ONE transaction (--single-transaction):
  # if the body errors, ON_ERROR_STOP aborts and the whole tx (including the insert)
  # rolls back, so the version is never recorded for a failed apply.
  # version is always digits and name always [a-z0-9_] (captured from the filename
  # regex above), so direct single-quoting is safe — no injection surface.
  {
    cat "$f"
    printf "\nINSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('%s','%s');\n" \
      "$version" "$name"
  } | "${PSQL[@]}"
  echo "    ✓ applied and recorded $version"
  done=$((done+1))
done

if [[ $pending -eq 0 ]]; then
  echo "✔ up to date — no pending migrations"
else
  echo "✔ applied $done migration(s)"
fi

# ── Drift check ───────────────────────────────────────────────────────────────
# Being recorded as applied is not proof of having been applied. Six migrations
# carry "Run this in Supabase SQL Editor" headers and were pasted in by hand
# before this runner existed; at least one run stopped partway — the tables
# landed, the function bodies did not — and the version was recorded anyway.
# This runner then skipped them forever, so the gap stayed invisible until a
# user hit "Could not find the function ..." in production.
#
# So after applying, compare what the migrations declare against what the
# database actually has. Known, accepted gaps live in known-schema-gaps.txt;
# anything outside that list is new drift and gets surfaced loudly.
echo "▶ drift check: declared functions vs database"

gaps_file="$MIGRATIONS_DIR/../deploy/known-schema-gaps.txt"
declared="$(grep -rhoiE 'create (or replace )?function (public\.)?[a-z0-9_]+' "$MIGRATIONS_DIR"/*.sql 2>/dev/null \
  | awk '{print tolower($NF)}' | sed 's/^public\.//' | sort -u)"
present="$("${PSQL_Q[@]}" -c \
  "SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public';" \
  | sort -u)"

missing="$(comm -23 <(echo "$declared") <(echo "$present") || true)"

if [[ -n "$missing" ]]; then
  if [[ -f "$gaps_file" ]]; then
    known="$(grep -vE '^\s*(#|$)' "$gaps_file" | tr -d ' \t' | sort -u)"
    unexpected="$(comm -23 <(echo "$missing") <(echo "$known") || true)"
  else
    unexpected="$missing"
  fi

  known_count="$(echo "$missing" | grep -c . || true)"
  new_count="$(echo "$unexpected" | grep -c . || true)"

  if [[ -n "$unexpected" ]]; then
    echo "::warning::schema drift — $new_count function(s) declared in migrations but absent from the database:"
    echo "$unexpected" | sed 's/^/    ✗ /'
    echo "    A migration is recorded as applied but its functions are not there."
    echo "    Fix with a forward-only repair migration, or add to known-schema-gaps.txt if intentional."
  else
    echo "  ✔ no new drift ($known_count known gap(s), see known-schema-gaps.txt)"
  fi
else
  echo "  ✔ every declared function is present"
fi
