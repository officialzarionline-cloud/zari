/* =========================================================
   Zari — preview/demo mode.
   Active ONLY while supabase-client.js still has the placeholder project URL.
   Serves clearly-labelled sample products + categories (with generated
   placeholder artwork) so the storefront layout can be reviewed before the
   real Supabase project exists. Everything else (reviews, banners, orders,
   auth, newsletter…) still goes to the real client — no invented reviews or
   order data. Once SUPABASE_URL is set to the real project this file is inert.
   Loaded after supabase-client.js and before script.js (storefront only).
   ========================================================= */
var DEMO_MODE = /YOUR-ZARI-PROJECT/.test(SUPABASE_URL);
var DEMO_ID_PREFIX = 'demo-';

(function () {
  if (!DEMO_MODE) return;

  // Editorial placeholder: palette-coloured drape with pleats and a zari border.
  function placeholderArt(bg, fold, zari, variant) {
    var pleats = '';
    for (var i = 0; i < 7; i++) {
      var x = 70 + i * 26 + (variant ? 8 : 0);
      pleats += '<path d="M' + x + ' 40 C ' + (x - 14) + ' 160, ' + (x + 18) + ' 260, ' + (x - 6) + ' 330" fill="none" stroke="' + fold + '" stroke-width="' + (i % 2 ? 1.2 : 2.4) + '" opacity=".55"/>';
    }
    var buta = '';
    for (var j = 0; j < 9; j++) buta += '<path d="M' + (18 + j * 34) + ' 356c-6 7-6 15 0 22 6-7 6-15 0-22z" fill="' + zari + '"/>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">' +
      '<rect width="300" height="400" fill="' + bg + '"/>' +
      '<path d="M40 40 L260 40 L250 330 L50 330 Z" fill="' + fold + '" opacity=".12"/>' + pleats +
      '<rect y="338" width="300" height="62" fill="' + fold + '" opacity=".35"/>' +
      '<rect y="338" width="300" height="2" fill="' + zari + '"/><rect y="396" width="300" height="2" fill="' + zari + '"/>' + buta +
      '<text x="150" y="26" font-family="Manrope,sans-serif" font-size="9" letter-spacing="3" fill="' + zari + '" text-anchor="middle">SAMPLE</text>' +
      '</svg>');
  }
  var palettes = [
    ['#591c1c', '#9c3838', '#e0bd82'], ['#f5ead8', '#b8874a', '#7a2828'], ['#3d1414', '#7a2828', '#cba05f'],
    ['#ecdcc0', '#cba05f', '#591c1c'], ['#7a2828', '#3d1414', '#e0bd82'], ['#f8f0e4', '#e0bd82', '#9c3838']
  ];

  // 4 real ZARI categories (saree types) from the supplier product list.
  var cats = [
    { id: DEMO_ID_PREFIX + 'cat-0', kind: 'saree_type', name: 'Saree', slug: 'saree', sort_order: 0 },
    { id: DEMO_ID_PREFIX + 'cat-1', kind: 'saree_type', name: 'Churidar Material', slug: 'churidar-material', sort_order: 1 },
    { id: DEMO_ID_PREFIX + 'cat-2', kind: 'saree_type', name: 'Set Mundu', slug: 'set-mundu', sort_order: 2 },
    { id: DEMO_ID_PREFIX + 'cat-3', kind: 'saree_type', name: 'Set Saree', slug: 'set-saree', sort_order: 3 }
  ];
  function catBySlug(s) { return cats.filter(function (c) { return c.slug === s; })[0]; }

  // 39 real products: exact names + codes (SKU) + category + HSN where supplied.
  // Price, stock, fabric and other specs are intentionally UNSET — not invented —
  // until the store owner supplies them via the admin panel / live DB.
  // [code, name, categorySlug, hsn]
  var rows = [
    ['6842', 'cotton saree gtha', 'saree', null],
    ['11789', 'KBU0200MULCOTTON', 'saree', null],
    ['2207', '9001', 'saree', null],
    ['11659', 'PRINT COTTON C MATERIAL', 'churidar-material', null],
    ['9150', 'MALMAL COTTON 990', 'saree', null],
    ['11786', 'KSY0040MALCOTTON', 'saree', null],
    ['11698', 'COTTON CHECK SHAHID Rs 405', 'saree', null],
    ['11552', 'CHIRALASILKSAREE', 'saree', null],
    ['417616', 'SAREES RAJKUNWAR 1', 'saree', '52081110'],
    ['426602', 'SAREES NATURAL KALAMKARI 1', 'saree', '52085910'],
    ['420051', 'SAREES MADRASI CHEX 1', 'saree', '54075420'],
    ['426312', 'SAREES ONAM DIGITAL 1', 'saree', '54075420'],
    ['425815', 'SAREES KHADICTN PALLU ZARI ST 1', 'saree', '54075210'],
    ['426671', 'SAREES MUL CTN NW MATHA 2', 'saree', '52081120'],
    ['426371', 'SAREES SAMPAL PURI SILK 1', 'saree', '54071019'],
    ['425479', 'SAREES MULCTN JKRD 1', 'saree', '52081120'],
    ['425760', 'SAREES MUL MATHA-2 1', 'saree', '52084110'],
    ['426457', 'SAREES MUL BLU BDR 8', 'saree', '52081120'],
    ['425367', 'SAREES SAMBSLPURI SILK 1', 'saree', '54071019'],
    ['426507', 'SAREES MUL 1SIDE FWR EMB 2', 'saree', '52081120'],
    ['366959', 'SAREES 6213 K SET 1', 'saree', '52081110'],
    ['416762', 'SAREES 53420 SET WB 1', 'saree', '52081120'],
    ['426498', 'SAREES A-2851 SET 2. 1', 'saree', '52081120'],
    ['417452', 'SAREES 83450 SET WB 2', 'saree', '52081120'],
    ['362300', 'SAREES 10 1/2 KK SET 3', 'saree', '52081110'],
    ['426497', 'SAREES A-1759 SET 1. 1', 'saree', '52081120'],
    ['418682', 'SAREES 156-Q 1', 'saree', '52084110'],
    ['417791', 'SAREES 706K 4', 'saree', '52101120'],
    ['341787', 'SAREES KATTI BATTI 1', 'saree', '54075420'],
    ['424404', 'SAREES KASAVU SILK 1', 'saree', '54075420'],
    ['414008', 'SAREES AMRITH BHARAT D1', 'saree', '54071019'],
    ['337540', 'SAREES CREPE 1', 'saree', '54075210'],
    ['8483', 'SETMUNDU 650', 'set-mundu', null],
    ['10547', 'KERALASAREE2026', 'saree', null],
    ['9252', 'SET SAREE 650', 'set-saree', null],
    ['8330', '2*3SETMUNDU', 'set-mundu', null],
    ['9329', 'PULIYILA SET MUNDU RM TEX 495', 'set-mundu', null],
    ['8740', 'set mundu430', 'set-mundu', null],
    ['8048', 'setmunduajkpy', 'set-mundu', null]
  ];
  var products = rows.map(function (r, i) {
    var pal = palettes[i % palettes.length];
    var cat = catBySlug(r[2]);
    return {
      id: DEMO_ID_PREFIX + 'p' + i, sku: r[0], slug: DEMO_ID_PREFIX + (r[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || ('p' + i)) + '-' + r[0],
      name: r[1], status: 'active',
      description: 'Shown in preview mode. Price, stock and photos will appear once the store owner adds them.',
      fabric: null, saree_length_m: null, blouse_included: false, blouse_length_m: null, weave: null, work_type: null,
      border_type: null, occasion: null, wash_care: null, country_of_origin: null,
      product_type: cat ? cat.name : null, hsn_code: r[3],
      price: null, sale_price: null,
      new_arrival: false, featured: false, best_seller: false, on_sale: false,
      created_at: new Date(Date.UTC(2026, 0, 1) + (rows.length - i) * 864e5).toISOString(),
      product_images: [{ image_url: placeholderArt(pal[0], pal[1], pal[2], 0), sort_order: 0 }],
      product_colors: [],
      product_variants: [{ id: DEMO_ID_PREFIX + 'v' + i, variant_sku: r[0] + '-A', color: null, size: null, stock: null }],
      product_categories: cat ? [{ categories: cat }] : []
    };
  });

  var demoTables = { products: products, categories: cats };

  // Minimal read-only query builder covering the calls script.js makes.
  function DemoQuery(table) { this.t = table; this.preds = []; this.sorts = []; this.lim = null; this.one = false; }
  DemoQuery.prototype.select = function () { return this; };
  DemoQuery.prototype.eq = function (col, val) {
    if (col === 'product_categories.categories.slug') {
      this.preds.push(function (r) { return (r.product_categories || []).some(function (pc) { return pc.categories.slug === val; }); });
    } else this.preds.push(function (r) { return r[col] === val; });
    return this;
  };
  DemoQuery.prototype.in = function (col, vals) { this.preds.push(function (r) { return vals.indexOf(r[col]) !== -1; }); return this; };
  DemoQuery.prototype.gte = function (col, v) { this.preds.push(function (r) { return r[col] >= v; }); return this; };
  DemoQuery.prototype.lte = function (col, v) { this.preds.push(function (r) { return r[col] <= v; }); return this; };
  DemoQuery.prototype.or = function (expr) {
    // Only the search form "col.ilike.%term%,col.ilike.%term%" is used.
    var parts = expr.split(',').map(function (p) { var m = p.match(/^(\w+)\.ilike\.%(.*)%$/); return m && { col: m[1], term: m[2].toLowerCase() }; }).filter(Boolean);
    this.preds.push(function (r) { return parts.some(function (p) { return String(r[p.col] || '').toLowerCase().indexOf(p.term) !== -1; }); });
    return this;
  };
  DemoQuery.prototype.order = function (col, opts) { this.sorts.push({ col: col, asc: !opts || opts.ascending !== false }); return this; };
  DemoQuery.prototype.limit = function (n) { this.lim = n; return this; };
  DemoQuery.prototype.maybeSingle = DemoQuery.prototype.single = function () { this.one = true; return this; };
  DemoQuery.prototype.then = function (ok, bad) {
    var rows = (demoTables[this.t] || []).filter(function (r) { return this.preds.every(function (p) { return p(r); }); }, this);
    this.sorts.forEach(function (s) {
      rows.sort(function (a, b) { var x = a[s.col], y = b[s.col]; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * (s.asc ? 1 : -1); });
    });
    var count = rows.length;
    if (this.lim) rows = rows.slice(0, this.lim);
    return Promise.resolve({ data: this.one ? (rows[0] || null) : rows, count: count, error: null }).then(ok, bad);
  };
  DemoQuery.prototype.catch = function (f) { return this.then(null, f); };

  var realFrom = supabaseClient.from.bind(supabaseClient);
  supabaseClient.from = function (table) { return demoTables[table] ? new DemoQuery(table) : realFrom(table); };
})();
