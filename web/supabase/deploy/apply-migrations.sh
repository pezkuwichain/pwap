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
