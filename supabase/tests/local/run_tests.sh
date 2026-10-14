#!/bin/bash
# Fresh database + the permission/workflow test suite. Prints every assertion; exits non-zero on failure.
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$HERE/../../.." && pwd)
"$HERE/reset_db.sh" seed >/dev/null || exit 1
OUT=$(LC_ALL=C psql -h ${PGHOST:-127.0.0.1} -p ${PGPORT:-55432} -U ${PGUSER:-postgres} -d zari -q -At -f "$ROOT/supabase/tests/admin_security.sql" 2>&1)
echo "$OUT" | sed -n 's/.*NOTICE:  //p; s/.*ERROR:  /ERROR: /p; /ALL TESTS PASSED/p'
echo "$OUT" | grep -q "ALL TESTS PASSED"
