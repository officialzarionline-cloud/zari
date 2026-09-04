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
   - Run the migrations in order: `0001_init.sql`, `0002_banners_and_product_flags.sql`,
     `0003_product_type_hsn_bestseller.sql` (via `supabase db push` or the SQL editor).
   - Optionally run `supabase/seed/import_extracted_products.sql` — this loads 39 real
     inventory rows from the supplier's own product list as **draft** products (price 0,
     no images) so you have real SKUs to fill in rather than starting from zero. See
     "Imported inventory" below.
   - Update `SUPABASE_URL` / `SUPABASE_ANON_KEY` in [`supabase-client.js`](supabase-client.js).
   - Create your admin user, then insert their `auth.users.id` into the `admins` table.
   - **Create two Storage buckets, both set to Public**: `banners` and `products`.
     These back the image-upload UI in Admin → Banners and Admin → Products; until
     they exist, uploads fail with a clear toast telling you which bucket is missing.
2. **Add real products** via SQL/admin (never fake data — see rule in the build brief).
   Nothing renders until `products.status = 'active'` rows exist.

### Imported inventory
`supabase/seed/import_extracted_products.sql` was generated from
`ZARI_Product_Details_Extracted.docx` — 39 unique real SKUs (supplier product
codes/descriptions/quantities). That document had no prices or photos, so every
row lands as `status = 'draft'` with `price = 0` — invisible on the public site.
To publish one: open it in Admin → Products, set a real price, upload photos,
tidy up the name (several are raw supplier codes like "Kbu0200mulcotton"), then
switch Status to Active.
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
- Home page: admin-managed hero banner carousel (falls back to a static default hero
  when no banner is active), quick categories, new arrivals, shop by saree type/fabric/
  occasion, featured collection, best sellers (real order data only, hidden until there
  is any), offer products (admin-flagged on-sale items), live-campaign banner (hidden
  when none live), more styles, brand story, trust strip, verified reviews (hidden when
  none approved), newsletter.
- **Admin → Banner Management**: add/edit/delete homepage hero banners; enable/disable;
  set title, subtitle, offer badge text, CTA text + link, image (upload or URL), an
  occasion tag (Onam/Vishu/Wedding/Festive Sale/New Arrivals/Flash Sale/Diwali/Eid/
  Christmas/New Year/general), a priority (ties break by most recent), and an optional
  start/end date range for scheduling. Multiple enabled banners auto-rotate on the
  homepage hero with dot navigation; RLS hides anything disabled or outside its
  scheduled window from everyone except admins.
- **Admin → Products**: full CRUD plus quick hide/unhide, featured toggle, and on-sale
  toggle right from the list. The edit form covers every field from the brief — name,
  price, sale price, description, fabric, SKU, care, saree/blouse measurements — plus
  category tagging (checkboxes across saree type/fabric/occasion/style), a repeatable
  colour list (swatch colour picker + name), a repeatable variant list (colour + size +
  stock, the thing that actually drives Add to Cart), and multi-image upload to Supabase
  Storage with drag-free "make main" / remove controls on each thumbnail (first image =
  homepage/PDP thumbnail).
- Header: desktop nav + search + delivery-location pill + wishlist/account/cart;
  compact mobile header with search/location rows underneath.
- Catalog: filter sidebar (desktop) / bottom sheet (mobile) by saree type, fabric,
  occasion; sort by new/price/discount. Search queries name/sku/fabric/occasion/weave/description.
- Product cards: image (branded placeholder when none), category · type, name, product
  code/SKU, price + original price + discount %, short info, real stock status
  (In Stock / Only N left / Out of Stock), Best Seller/New/Sale badges, wishlist,
  Quick View, View Details, Add to Cart, and Buy Now. Responsive grid (4/3/2 cols).
- Product detail: image gallery, category/type, colour swatches, quantity selector,
  Add to Cart / Buy Now / Wishlist, PIN delivery check, description, a Product Details
  attribute table, Delivery Information and Return & Exchange accordions, and a
  "You May Also Like" related-products rail. Sticky mobile CTA; Notify Me when sold out.
- Buy Now (card + PDP) adds the item silently and jumps straight to checkout —
  distinct from Add to Cart, which opens the cart drawer.
- Quick View modal, wishlist (guest via localStorage, merges into Supabase on login),
  slide-out cart drawer AND a full-page cart (`#/cart`) with qty steppers, remove,
  Continue Shopping, and an order summary (subtotal · delivery · total). Cart count
  shows in the header. Recently-viewed tracking.
- Auth: email/password + Google OAuth + forgot password, all via Supabase Auth.
- Account: overview / orders (view-level hide only, no destructive delete) / addresses /
  wishlist / profile.
- Checkout: contact + address form with live PIN serviceability check, an itemized
  order summary (each line, subtotal, delivery charge, discount, final total), and a
  payment section structured for gateway integration — clearly stubbed pending
  Cashfree credentials.
- Homepage rails each have a "View All" link: New Arrivals, Featured Sarees, Best
  Sellers, Special Offers, Recommended, plus Shop by Category/Fabric/Occasion.
  Catalog supports `?featured=1`, `?best=1`, `?sale=1`, `/offers`, sort by discount.
- RLS on every customer-facing table; `is_admin()` gate for admin-only writes.

## Not yet built (next phases — see build brief phases G–J)
- Admin: shipping provider settings UI, media library (browse-all-uploads view),
  dedicated customers detail view.
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
