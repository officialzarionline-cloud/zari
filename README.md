# Zari — Saree Ecommerce

Independent codebase, built with the same architecture principles as the You & Me
project (static SPA + Supabase + edge functions) but with **zero shared code,
data, credentials, or branding**. Brand: **Zari** — deep oxblood/maroon + cream +
gold, script wordmark (see `assets/logo-source.png` for the supplied brand art).

## Stack
Static HTML/CSS/JS SPA (`index.html`, `style.css`, `script.js`) + Supabase
(Postgres + Auth + Storage + Edge Functions). No build step.

## Before this goes live

1. **Create a new Supabase project for Zari** (separate from You & Me's). Then:
   - Run `supabase/migrations/0001_init.sql` (via `supabase db push` or the SQL editor).
   - Update `SUPABASE_URL` / `SUPABASE_ANON_KEY` in [`supabase-client.js`](supabase-client.js).
   - Create your admin user, then insert their `auth.users.id` into the `admins` table.
2. **Add real products** via SQL/admin (never fake data — see rule in the build brief).
   Nothing renders until `products.status = 'active'` rows exist.
3. **Payment (Cashfree)** is intentionally stubbed — see `supabase/functions/cashfree-*`.
   Get Zari's own **sandbox** Cashfree App ID/Secret, set them as Edge Function secrets,
   and implement the TODOs in those three functions before enabling checkout.
4. **Shipping serviceability** (`check-delivery` function) currently returns
   `serviceable: true` as a placeholder once any `shipping_providers` row is active,
   or `false` with `no_provider_configured` otherwise. Wire a real provider
   (Delhivery/Shiprocket/Fship) before launch.
5. **Google OAuth** for login needs a Google Cloud OAuth client configured against
   Zari's own Supabase Auth settings (Authentication → Providers → Google).
6. Deploy: any static host (GitHub Pages, Netlify, Vercel) pointed at this repo's
   root. Do **not** deploy over `officialyouandme.in`.

## What's implemented (MVP)
- Home page: hero, quick categories, new arrivals, shop by saree type/fabric/occasion,
  featured collection, live-campaign banner (hidden when none live), more styles,
  brand story, trust strip, verified reviews (hidden when none approved), newsletter.
- Header: desktop nav + search + delivery-location pill + wishlist/account/cart;
  compact mobile header with search/location rows underneath.
- Catalog: filter sidebar (desktop) / bottom sheet (mobile) by saree type, fabric,
  occasion; sort by new/price/discount. Search queries name/sku/fabric/occasion/weave/description.
- Product detail: gallery, colour swatches, accordion for saree-specific attributes
  (only fields with real values are shown — no invented measurements), sticky mobile CTA,
  Notify Me for out-of-stock.
- Quick View modal, wishlist (guest via localStorage, merges into Supabase on login),
  cart drawer with Save for Later, recently-viewed tracking.
- Auth: email/password + Google OAuth + forgot password, all via Supabase Auth.
- Account: overview / orders (view-level hide only, no destructive delete) / addresses /
  wishlist / profile.
- Checkout: contact + address form with live PIN serviceability check; payment step
  clearly stubbed pending Cashfree credentials.
- RLS on every customer-facing table; `is_admin()` gate for admin-only writes.

## Not yet built (next phases — see build brief phases G–J)
- Admin console (products/orders/customers/inventory/shipping/categories/collections/
  media library/campaigns/reviews/settings).
- Live payment + live shipping provider wiring (needs Zari's own credentials).
- Realtime shipment tracking UI, secondary delivery number, invoices.
- Complete the Look / accessories cross-sell (schema is ready — `complete_the_look` table —
  UI is scaffolded but hidden until admin links real products).
- Find Your Saree quiz, shop-by-budget ranges, verified-review submission flow,
  campaign-only animated hero, SEO meta/structured data, full motion/polish pass.

## Confirmed
- You & Me's production project/repo was **not** touched by this build.
- No You & Me customer, order, payment, or shipment data was copied here.
- No secrets from You & Me were reused — `supabase-client.js` above has clearly
  marked placeholder values for a project that does not exist yet.
