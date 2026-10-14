#!/bin/bash
# Rebuild the local test database: Supabase-like stubs + every migration (+ "seed" to load the catalogue).
set -e
export LC_ALL=C
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$HERE/../../.." && pwd)
P="psql -h ${PGHOST:-127.0.0.1} -p ${PGPORT:-55432} -U ${PGUSER:-postgres} -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists zari" -c "create database zari"
$P -d zari -f "$HERE/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "== $(basename "$f")"; PGOPTIONS='-c client_min_messages=warning' $P -d zari -f "$f"; done
if [ "$1" = "seed" ]; then echo "== seed"; $P -d zari -f "$ROOT/supabase/seed/import_extracted_products.sql"; fi
echo OK
