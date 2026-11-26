#!/usr/bin/env bash
# Applies every migration, in order, to an EMPTY Postgres and runs the security checks.
# Usage: DATABASE_URL=postgres://user:pass@host:5432/db supabase/ci/run_db_checks.sh
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point at an empty, disposable Postgres database}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q)

echo "== Supabase platform stub"
"${PSQL[@]}" -f "$DIR/ci/00_supabase_stub.sql"

echo "== Project URL setting (the migrations deliberately do not set it)"
DBNAME="$(psql "$DATABASE_URL" -Atc 'SELECT current_database()')"
"${PSQL[@]}" -c "ALTER DATABASE \"$DBNAME\" SET app.settings.supabase_url = 'https://ci-project.supabase.co';"
# ALTER DATABASE only affects new connections; each psql call below opens a fresh one.

for f in $(ls "$DIR"/migrations/*.sql | sort); do
  echo "== Applying $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

echo "== Security checks"
"${PSQL[@]}" -f "$DIR/ci/verify.sql"
echo "OK: migrations applied and all checks passed"
