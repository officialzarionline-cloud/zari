# Zari — local tests for the admin system

These run against a **throwaway local Postgres** with Supabase-like roles
(`anon`, `authenticated`, `service_role`), an `auth.users` table and
`auth.uid()` reading the request's JWT claims — the same mechanism Supabase
uses — so row-level security and every function permission check are the real
ones from `supabase/migrations/`.

Nothing here touches a real Supabase project.

## Permission & workflow tests (`admin_security.sql`)

89 assertions covering: anonymous visitors, customers (including the two holes
fixed in `0004`), each admin role, disabled admins, Super Admin guard rails,
product save/duplicate/bulk/import validation, the order workflow, invoices,
coupons (server-side pricing, expiry, per-customer limits, rate limiting),
settings immutability and the audit log.

```bash
# one-time: a local cluster on port 55432 (any Postgres 15+ works)
initdb -D /path/to/pgdata -U postgres --auth=trust --locale=C
pg_ctl -D /path/to/pgdata -o "-p 55432" start

bash supabase/tests/local/run_tests.sh      # prints every "pass:"; exits non-zero on failure
```

## Clicking through the admin locally (`local/local_api.py`)

A small stand-in for the Supabase API (REST/RPC subset, password login,
Storage under the same RLS) so `/admin` and the store can be used against the
local database:

```bash
bash supabase/tests/local/reset_db.sh seed
python3 supabase/tests/local/local_api.py        # http://localhost:8936/  and  /admin/
```

Create a login for yourself first (local only):

```sql
insert into auth.users (email, encrypted_password) values ('you@example.test', crypt('a-long-test-password', gen_salt('bf')));
select public.bootstrap_super_admin('you@example.test', 'You');
```

The stand-in rewrites `supabase-client.js` on the fly to point at itself. It is
test tooling only — never deploy it. Edge Functions are not emulated, so
"Add admin", "Reset access" and the payment-key status need the real project.
