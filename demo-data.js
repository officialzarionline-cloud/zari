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

  var cats = [
    ['saree_type', 'Kanjivaram', 'kanjivaram'], ['saree_type', 'Banarasi', 'banarasi'], ['saree_type', 'Kerala Kasavu', 'kasavu'],
    ['saree_type', 'Chanderi', 'chanderi'], ['saree_type', 'Organza', 'organza'], ['saree_type', 'Linen', 'linen'],
    ['fabric', 'Silk', 'silk'], ['fabric', 'Cotton', 'cotton'], ['fabric', 'Tissue', 'tissue'], ['fabric', 'Linen', 'linen'],
    ['occasion', 'Wedding', 'wedding'], ['occasion', 'Festive', 'festive'], ['occasion', 'Everyday', 'everyday'], ['occasion', 'Office', 'office']
  ].map(function (c, i) { return { id: DEMO_ID_PREFIX + 'cat-' + i, kind: c[0], name: c[1], slug: c[2], sort_order: i }; });

  // [name, typeIdx, fabric, occasion, price, salePrice, stock, flags]
  var rows = [
    ['Temple Border Kanjivaram', 0, 'silk', 'wedding', 18900, null, 6, 'nf'],
    ['Brocade Banarasi', 1, 'silk', 'wedding', 30600, 24500, 4, 'fbs'],
    ['Gold Line Kasavu', 2, 'tissue', 'festive', 6900, null, 9, 'n'],
    ['Leaf Buta Chanderi', 3, 'cotton', 'office', 8400, null, 2, 'f'],
    ['Zari Edge Organza', 4, 'silk', 'festive', 14000, 11200, 7, 'nfs'],
    ['Handloom Linen', 5, 'linen', 'everyday', 4900, null, 0, 'f'],
    ['Peacock Pallu Kanjivaram', 0, 'silk', 'wedding', 21500, null, 5, 'nfb'],
    ['Meenakari Banarasi', 1, 'silk', 'festive', 27800, null, 3, 'n'],
    ['Kasavu Tissue Set', 2, 'tissue', 'festive', 9200, 7400, 8, 's'],
    ['Chanderi Silk Cotton', 3, 'cotton', 'everyday', 6200, null, 10, 'n'],
    ['Floral Organza', 4, 'silk', 'festive', 11800, null, 6, 'b'],
    ['Stripe Linen', 5, 'linen', 'office', 5600, null, 12, '']
  ];
  var products = rows.map(function (r, i) {
    var pal = palettes[i % palettes.length];
    var slug = DEMO_ID_PREFIX + r[0].toLowerCase().replace(/[^a-z0-9]+/g, '-');
    var multi = i % 2 === 1;
    return {
      id: DEMO_ID_PREFIX + 'p' + i, sku: 'DEMO-' + String(i + 1).padStart(3, '0'), slug: slug, name: r[0], status: 'active',
      description: 'Sample product shown in preview mode. Real products, prices and photos appear here once the store is connected.',
      fabric: r[2], saree_length_m: 5.5, blouse_included: true, blouse_length_m: 0.8, weave: 'Handloom', work_type: 'Zari',
      border_type: 'Temple', occasion: r[3], wash_care: 'Dry clean only', country_of_origin: 'India', product_type: 'Saree', hsn_code: null,
      price: r[4], sale_price: r[5],
      new_arrival: r[7].indexOf('n') !== -1, featured: r[7].indexOf('f') !== -1, best_seller: r[7].indexOf('b') !== -1, on_sale: r[7].indexOf('s') !== -1,
      created_at: new Date(Date.UTC(2026, 0, 1) + (rows.length - i) * 864e5).toISOString(),
      product_images: [{ image_url: placeholderArt(pal[0], pal[1], pal[2], 0), sort_order: 0 }, { image_url: placeholderArt(pal[1], pal[0], pal[2], 1), sort_order: 1 }],
      product_colors: multi
        ? [{ name: 'Maroon', hex: '#7a2828', sort_order: 0 }, { name: 'Gold', hex: '#cba05f', sort_order: 1 }, { name: 'Ivory', hex: '#f8f0e4', sort_order: 2 }]
        : [{ name: 'Maroon', hex: '#7a2828', sort_order: 0 }],
      product_variants: [{ id: DEMO_ID_PREFIX + 'v' + i, variant_sku: 'DEMO-' + (i + 1) + '-A', color: 'Maroon', size: 'Free Size', stock: r[6] }],
      product_categories: [{ categories: cats[r[1]] }, { categories: cats.filter(function (c) { return c.kind === 'fabric' && c.slug === r[2]; })[0] }].filter(function (pc) { return pc.categories; })
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
