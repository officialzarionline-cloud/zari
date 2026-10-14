/* =========================================================
   Zari — Supabase client + shared row/product normalizers.
   Loaded before script.js. Mirrors the You & Me pattern: one place both the
   customer site and admin panel get their Supabase client and agree on how a
   raw Postgres row becomes the product shape the rest of the app expects.

   Zari's own Supabase project. TODO (before going live): paste the project's
   anon / publishable key below (Supabase → Project Settings → API). It must NOT
   point at You & Me's project. The anon key is meant to be public; every table
   has RLS (see supabase/migrations/), so access is controlled by policy, not by
   this key being secret. Never put the service-role key in this file.
   Until the key is set, the storefront runs in preview mode (demo-data.js) and
   the admin panel shows a "connect the database" screen.
   ========================================================= */
var SUPABASE_URL = 'https://sjtrbsocepsfmrvgwuei.supabase.co';
var SUPABASE_ANON_KEY = 'YOUR-ZARI-ANON-KEY';

// The admin panel (/admin) keeps its own login session, separate from shoppers'
// sessions on the store, so signing in/out of one never affects the other.
var IS_ADMIN_APP = /\/admin(\/|\/index\.html)?$/.test(location.pathname);
var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY,
  IS_ADMIN_APP ? { auth: { storageKey: 'zari-admin-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } } : undefined);

var BASE_PATH = '';

function isPlaceholderImageUrl(url) { return typeof url === 'string' && url.indexOf('placeholder:') === 0; }

// Raw Postgres row (snake_case, nested foreign-table arrays) -> camelCase product
// shape every render function in script.js expects.
function mapSupabaseProduct(row) {
  var images = (row.product_images || []).slice().sort(function (a, b) { return a.sort_order - b.sort_order; });
  var colors = (row.product_colors || []).slice().sort(function (a, b) { return a.sort_order - b.sort_order; }).map(function (c) { return { name: c.name, hex: c.hex }; });
  var variants = (row.product_variants || []).map(function (v) { return { id: v.id, variantSku: v.variant_sku, color: v.color, size: v.size, stock: v.stock }; });
  var totalStock = variants.reduce(function (sum, v) { return sum + v.stock; }, 0);
  var categories = (row.product_categories || []).map(function (pc) { return pc.categories; }).filter(Boolean);

  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    description: row.description,
    fabric: row.fabric,
    sareeLengthM: row.saree_length_m,
    blouseIncluded: !!row.blouse_included,
    blouseLengthM: row.blouse_length_m,
    blouseColour: row.blouse_colour,
    workType: row.work_type,
    weave: row.weave,
    pattern: row.pattern,
    borderType: row.border_type,
    occasion: row.occasion,
    washCare: row.wash_care,
    readyToWear: !!row.ready_to_wear,
    countryOfOrigin: row.country_of_origin,
    productType: row.product_type,
    hsnCode: row.hsn_code,
    price: row.sale_price != null && Number(row.sale_price) > 0 ? row.sale_price : row.price,
    // Struck-through price: the selling price when a discount price is set, or the MRP when it's higher.
    oldPrice: (function () {
      var sell = row.sale_price != null && Number(row.sale_price) > 0 ? Number(row.sale_price) : Number(row.price);
      var was = Math.max(row.sale_price != null && Number(row.sale_price) > 0 ? Number(row.price) : 0, Number(row.mrp || 0));
      return was > sell ? was : null;
    })(),
    mrp: row.mrp,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    hasRealPrice: Number(row.price) > 0,
    images: images.map(function (i) { return i.image_url; }),
    imageObjects: images,
    colors: colors,
    variants: variants,
    stock: totalStock,
    featured: !!row.featured,
    newArrival: !!row.new_arrival,
    bestSeller: !!row.best_seller,
    onSale: !!row.on_sale,
    status: row.status,
    categories: categories.map(function (c) { return { kind: c.kind, name: c.name, slug: c.slug }; }),
    // First saree_type category, if any — used as the card's "category" line.
    primaryCategory: (categories.filter(function (c) { return c.kind === 'saree_type'; })[0] || categories[0] || {}).name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

var PRODUCT_SELECT = '*, product_images(*), product_colors(*), product_variants(*), product_categories(categories(kind,name,slug))';
