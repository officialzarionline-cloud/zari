/* =========================================================
   Zari — Supabase client + shared row/product normalizers.
   Loaded before script.js. Mirrors the You & Me pattern: one place both the
   customer site and admin panel get their Supabase client and agree on how a
   raw Postgres row becomes the product shape the rest of the app expects.

   TODO (before going live): replace SUPABASE_URL / SUPABASE_ANON_KEY below with
   Zari's own Supabase project values. This is a fresh project — it must NOT
   point at You & Me's Supabase project. The anon key is meant to be public;
   every table has RLS (see supabase/migrations/0001_init.sql), so access is
   controlled by policy, not by this key being secret.
   ========================================================= */
var SUPABASE_URL = 'https://YOUR-ZARI-PROJECT.supabase.co';
var SUPABASE_ANON_KEY = 'YOUR-ZARI-ANON-KEY';

var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    price: row.sale_price || row.price,
    oldPrice: row.sale_price ? row.price : null,
    images: images.map(function (i) { return i.image_url; }),
    imageObjects: images,
    colors: colors,
    variants: variants,
    stock: totalStock,
    featured: !!row.featured,
    newArrival: !!row.new_arrival,
    status: row.status,
    categories: categories.map(function (c) { return { kind: c.kind, name: c.name, slug: c.slug }; }),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

var PRODUCT_SELECT = '*, product_images(*), product_colors(*), product_variants(*), product_categories(categories(kind,name,slug))';
