# Zari Admin — setup & operations

The admin panel lives at **`/admin`** on the same site (e.g. `https://your-domain/admin/`).
It talks to the store's Supabase project directly. Every permission is enforced in
the database (row-level security + checks inside each function), not just hidden in
the menu.

---

## 1. Connect the project

`supabase-client.js` already points at the Zari project
(`https://sjtrbsocepsfmrvgwuei.supabase.co`). Paste its **anon / publishable key**:

Supabase → Project Settings → API → copy the `anon` `public` key into
`SUPABASE_ANON_KEY`.

Never paste the `service_role` key anywhere in the site's files.

Until the key is set, the store stays in preview mode (sample products) and `/admin`
shows a “Connect the database” screen.

## 2. Apply the database migrations

**Option A — Supabase CLI** (installed on this Mac):

```bash
supabase login
```

```bash
supabase link --project-ref sjtrbsocepsfmrvgwuei
```

```bash
supabase db push
```

**Option B — SQL editor:** run the files in `supabase/migrations/` in order. If
`0001`–`0003` were already run on this project (the Table Editor already shows
`products`, `orders`, `banners`), run **only `0004_admin_system.sql`**.

`0004` is safe on a project that already has data: it never deletes products,
customers, orders or payments, and it can be run again.

Optional: load the 39 real products from the supplier list (they arrive hidden,
with no price, ready to complete in the admin):
`supabase/seed/import_extracted_products.sql`.

## 3. Create the first Super Admin (one time)

No credentials are stored in the code. Instead:

1. Supabase → **Authentication → Users → Add user → Create new user**. Use an
   email that is **not** a customer account, a strong password (12+ characters),
   and tick **Auto Confirm User**.
2. Supabase → **SQL Editor**, run:

   ```sql
   select public.bootstrap_super_admin('you@your-domain.com', 'Your Name');
   ```

   This only works while no Super Admin exists, and it can't be called through
   the website's API.
3. Sign in at `/admin`. Add other admins from **Admin users**.

## 4. Deploy the `admin-api` Edge Function

Needed for adding admins, disabling them, sending access-reset emails, and showing
whether payment keys are set:

```bash
supabase functions deploy admin-api
```

Recommended secrets (Supabase → Edge Functions → Secrets):

- `ADMIN_SITE_URL` = `https://your-domain` (used in invite / reset links)
- `ADMIN_ALLOWED_ORIGINS` = `https://your-domain,https://www.your-domain`

## 5. Supabase Auth settings

Authentication → URL Configuration:

- **Site URL**: `https://your-domain`
- **Redirect URLs**: add `https://your-domain/admin/?reset=1` (admin invites and
  password resets) and `https://your-domain/#/reset-password` (shoppers).

Authentication → Settings / Policies:

- Minimum password length **12**; turn on leaked-password protection if your plan
  has it.
- Keep the default sign-in rate limits on (they protect both shoppers and admins).
- Set up custom SMTP before launch — Supabase's built-in email is heavily
  rate-limited, so invites and reset emails may be delayed without it.

## 6. Hosting headers

`_headers` in the repo root sets anti-framing and no-index headers for `/admin`
on Netlify and Cloudflare Pages. On Vercel, add the same headers in
`vercel.json`. GitHub Pages can't set headers (the admin also refuses to render
inside a frame as a fallback).

## 7. Payment keys

Payment gateway credentials are **never** typed into or stored by the admin
panel. Set them as Edge Function secrets:

```bash
supabase secrets set CASHFREE_APP_ID=your-app-id CASHFREE_SECRET_KEY=your-secret CASHFREE_WEBHOOK_SECRET=your-webhook-secret
```

Website settings → Payments then shows them as **Set** / **Missing** (never the
values). Online checkout itself is still the stub described in the README — see
the notes in `supabase/functions/cashfree-*` for exactly what remains (they now
reference `quote_cart`, stock decrement and coupon redemption).

---

## Roles

| Role | Can manage |
|---|---|
| Super Admin | Everything, including admin users, roles and website settings |
| Store Manager | Everything except admin users and website settings |
| Catalogue Manager | Products, categories, homepage, banners/promotions, coupons |
| Order Manager | Orders, customers, reviews |
| Content Editor | Pages & FAQ, homepage, banners/promotions |

Super Admins can create custom roles from any combination of modules. There must
always be at least one active Super Admin, and nobody can change their own role
or disable themselves.

## What updates the store, and when

Everything the store shows is read from the database on each page load: products,
prices, images, stock, categories (including hidden/visible), homepage section
order/visibility/text, hero and promo banners (respecting their schedule), the
announcement bar, campaign band, pages, FAQ, footer, social links, contact
details, delivery charges, tax display and SEO text. There's no cache to clear —
a shopper sees a change on their next page load (or when they return to a tab
after a minute).

## Security summary

- **Server-side authorisation:** RLS on every table; admin functions check the
  caller's role and module permission themselves. Disabled admins lose access
  immediately.
- **Fixed in this release:** the `admins` table had no RLS (any signed-in user
  could have made themselves an admin through the API), and customers could edit
  any column of their own orders (status, payment status, totals). Both closed.
- **Separate admin login:** the admin uses its own session, separate from shopper
  sessions; customer accounts are rejected at sign-in; admin emails must not be
  customer accounts.
- **Sessions:** 30-minute idle sign-out, “sign out of all devices”, password change
  re-checks the current password, reset links expire.
- **Audit log:** every admin insert/update/delete (with before/after values),
  sign-ins, exports and invoice downloads — written by database triggers and
  impossible to edit or delete through the API.
- **Input validation & XSS:** every write is validated in the database
  (prices, SKUs, statuses, transitions, links); admin-entered text is stored as
  plain text and escaped when shown; links must be store links (`#/…`) or
  `https://`.
- **SQL injection:** all access goes through PostgREST / parameterised
  functions; search boxes strip filter syntax.
- **Rate limiting:** Supabase Auth limits sign-in attempts; the admin login also
  backs off after repeated failures; coupon checks are limited per user.
- **Uploads:** admin-only, per-module storage policies; JPEG/PNG/WebP/AVIF only
  (no SVG); 5 MB cap; images resized to ≤2000 px and re-encoded (WebP) in the
  browser before upload.
- **CSRF:** not applicable — the API uses bearer tokens, not cookies.

## Tests

See `supabase/tests/README.md` — 89 database assertions plus a local stand-in to
click through `/admin` against a local copy of the schema.
