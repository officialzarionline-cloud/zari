/* =========================================================
   Zari Admin — products: list, search/filter/sort, bulk edit, CSV
   import/export, duplicate, delete, and the full product editor.
   Saves go through admin_save_product() (validated server-side, one
   transaction, variants updated in place so carts keep working).
   ========================================================= */
(function () {
  var esc = ZA.esc;
  var table = null;
  var KIND_LABEL = { saree_type: 'Category', fabric: 'Fabric', occasion: 'Occasion', style: 'Style' };
  var PRODUCT_TYPES = ['Saree', 'Set Saree', 'Set Mundu', 'Churidar Material', 'Kerala Saree', 'Silk Saree', 'Cotton Saree'];
  var CSV_COLUMNS = ['sku', 'name', 'status', 'price', 'sale_price', 'mrp', 'stock', 'categories', 'product_type', 'hsn_code', 'fabric', 'occasion', 'weave', 'work_type',
    'featured', 'new_arrival', 'best_seller', 'on_sale', 'seo_title', 'seo_description', 'description'];
  var BOOL_COLS = ['featured', 'new_arrival', 'best_seller', 'on_sale', 'blouse_included', 'ready_to_wear'];
  var NUM_COLS = ['price', 'sale_price', 'mrp', 'stock', 'saree_length_m', 'blouse_length_m', 'low_stock_threshold'];

  function loadCategories() {
    return ZA.q(ZA.db.from('categories').select('id,name,kind,parent_id,sort_order,is_visible').order('kind').order('sort_order').order('name'));
  }
  // Flatten categories into display order with depth (parents before children).
  function categoryTree(cats) {
    var byParent = {};
    cats.forEach(function (c) { var k = c.parent_id || 'root'; (byParent[k] = byParent[k] || []).push(c); });
    var out = [];
    (function walk(pid, depth) {
      (byParent[pid] || []).forEach(function (c) { out.push(Object.assign({ depth: depth }, c)); walk(c.id, depth + 1); });
    })('root', 0);
    // Orphans whose parent was hidden from this list
    cats.forEach(function (c) { if (!out.find(function (o) { return o.id === c.id; })) out.push(Object.assign({ depth: 0 }, c)); });
    return out;
  }
  ZA.categoryTree = categoryTree;
  ZA.loadCategories = loadCategories;

  /* =====================================================
     LIST
     ===================================================== */
  function renderList(el) {
    ZA.setPage('Products', [['Catalogue']],
      '<button class="btn btn-sm" data-action="products-import"><span class="label">Import CSV</span><span aria-hidden="true">⇪</span></button>' +
      '<button class="btn btn-sm" data-action="products-export"><span class="label">Export</span><span aria-hidden="true">⇩</span></button>' +
      '<a class="btn btn-primary btn-sm" href="#/products/new">+ <span class="label">Add product</span></a>');
    loadCategories().then(function (cats) {
      var tree = categoryTree(cats);
      el.innerHTML = '<div id="productsTable"></div>';
      table = new ZA.DataTable({
        id: 'products', el: ZA.qs('#productsTable'), search: 'Search name or SKU', selectable: true,
        defaultSort: { col: 'updated_at', asc: false },
        filters: [
          { key: 'status', label: 'Status', options: [['active', 'Active (visible)'], ['draft', 'Draft (hidden)'], ['archived', 'Archived']] },
          { key: 'stock_state', label: 'Stock', options: [['in', 'In stock'], ['low', 'Low stock'], ['out', 'Out of stock'], ['unpriced', 'No price yet']] },
          { key: 'category', label: 'Category', options: tree.map(function (c) { return [c.id, '  '.repeat(c.depth) + c.name + ' (' + KIND_LABEL[c.kind] + ')']; }) },
          { key: 'flag', label: 'Flag', options: [['featured', 'Featured'], ['new_arrival', 'New arrival'], ['best_seller', 'Best seller'], ['on_sale', 'On sale']] }
        ],
        columns: [
          { label: '', cls: 'nowrap', render: function (p) { return p.main_image ? '<img class="thumb" src="' + esc(p.main_image) + '" alt="" loading="lazy">' : '<span class="thumb" style="display:block;width:40px;height:52px;background:var(--cream-200);"></span>'; } },
          { label: 'Product', sort: 'name', render: function (p) { return '<a class="cell-title" href="#/products/' + p.id + '">' + esc(p.name) + '</a><div class="cell-sub mono">' + esc(p.sku) + '</div>' + (p.category_names ? '<div class="cell-sub">' + esc(p.category_names) + '</div>' : ''); } },
          { label: 'Price', sort: 'price', cls: 'nowrap', render: function (p) {
            if (!(p.price > 0)) return '<span class="muted">Price on request</span>';
            return (p.sale_price != null ? '<strong>' + ZA.money(p.sale_price) + '</strong> <s class="muted small">' + ZA.money(p.price) + '</s>' : '<strong>' + ZA.money(p.price) + '</strong>') +
              (p.mrp && p.mrp > p.price ? '<div class="cell-sub">MRP ' + ZA.money(p.mrp) + '</div>' : '');
          } },
          { label: 'Stock', sort: 'total_stock', cls: 'nowrap', render: function (p) { return ZA.num(p.total_stock) + ' ' + ZA.pill(p.stock_state, { in: 'In stock', low: 'Low', out: 'Out', unpriced: 'No price' }[p.stock_state]) + (p.variant_count > 1 ? '<div class="cell-sub">' + p.variant_count + ' variants</div>' : ''); } },
          { label: 'Status', render: function (p) { return ZA.pill(p.status, { active: 'Active', draft: 'Hidden', archived: 'Archived' }[p.status]); } },
          { label: 'Flags', render: function (p) {
            return ['featured', 'new_arrival', 'best_seller', 'on_sale'].filter(function (f) { return p[f]; }).map(function (f) { return '<span class="pill">' + { featured: 'Featured', new_arrival: 'New', best_seller: 'Best seller', on_sale: 'Sale' }[f] + '</span>'; }).join(' ');
          } },
          { label: 'Updated', sort: 'updated_at', cls: 'nowrap', render: function (p) { return '<span class="small">' + ZA.ago(p.updated_at) + '</span>'; } },
          { label: '', cls: 'actions', render: function (p) {
            return '<a class="link" href="#/products/' + p.id + '">Edit</a>' +
              '<button class="link" data-action="product-toggle" data-id="' + p.id + '" data-status="' + p.status + '">' + (p.status === 'active' ? 'Hide' : 'Activate') + '</button>' +
              '<button class="link" data-action="product-duplicate" data-id="' + p.id + '">Duplicate</button>' +
              (p.status === 'active' ? '<a class="link" href="../#/product/' + encodeURIComponent(p.slug) + '" target="_blank" rel="noopener">View</a>' : '') +
              '<button class="link danger" data-action="product-delete" data-id="' + p.id + '" data-name="' + esc(p.name) + '">Delete</button>';
          } }
        ],
        query: function (st) {
          var q = ZA.db.from('admin_products_view').select('id,name,sku,slug,status,price,sale_price,mrp,total_stock,stock_state,variant_count,main_image,category_names,featured,new_arrival,best_seller,on_sale,updated_at', { count: 'exact' });
          if (st.filters.status) q = q.eq('status', st.filters.status);
          if (st.filters.stock_state) q = q.eq('stock_state', st.filters.stock_state);
          if (st.filters.category) q = q.contains('category_ids', [st.filters.category]);
          if (st.filters.flag) q = q.eq(st.filters.flag, true);
          return ZA.applyTableState(q, st, ['name', 'sku']).then(function (res) { return { rows: ZA.unwrap(res), total: res.count || 0 }; });
        },
        emptyTitle: 'No products match', emptyText: '<br><a href="#/products/new">Add a product</a> or change the filters.',
        bulk: [
          { label: 'Show on site', run: function (rows) { bulk(rows, { status: 'active' }, 'now visible'); } },
          { label: 'Hide', run: function (rows) { bulk(rows, { status: 'draft' }, 'hidden'); } },
          { label: 'Flags…', run: bulkFlags },
          { label: 'Price…', run: bulkPrice },
          { label: 'Category…', run: function (rows) { bulkCategory(rows, tree); } },
          { label: 'Stock…', run: bulkStock },
          { label: 'Export', run: function (rows) { exportProducts(rows.map(function (r) { return r.id; })); } },
          { label: 'Delete', danger: true, run: function (rows) { deleteProducts(rows); } }
        ]
      });
      ZA.cleanup = function () { table = null; };
    }).catch(function (err) { el.innerHTML = '<div class="notice danger">' + esc(err.message) + '</div>'; });
  }

  function bulk(rows, patch, doneText) {
    return ZA.rpc('admin_bulk_update_products', { p_ids: rows.map(function (r) { return r.id; }), p_patch: patch }).then(function (n) {
      ZA.ok(n + ' product' + (n === 1 ? '' : 's') + ' ' + (doneText || 'updated'));
      if (table) { table.clearSelection(); table.reload(); }
    }).catch(ZA.fail);
  }
  function bulkFlags(rows) {
    var sel = function (name, label) { return ZA.f.select(name, label, '', [['', 'No change'], ['true', 'Turn on'], ['false', 'Turn off']]); };
    ZA.modal({
      title: 'Set flags on ' + rows.length + ' products',
      body: '<form id="bfForm" class="grid-2">' + sel('featured', 'Featured') + sel('new_arrival', 'New arrival') + sel('best_seller', 'Best seller') + sel('on_sale', 'On sale') + '</form>',
      foot: '<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="bfGo">Apply</button>',
      onOpen: function (m, api) {
        m.querySelector('#bfGo').addEventListener('click', function () {
          var v = ZA.readForm(m.querySelector('#bfForm')), patch = {};
          Object.keys(v).forEach(function (k) { if (v[k] !== '') patch[k] = v[k] === 'true'; });
          if (!Object.keys(patch).length) { api.close(); return; }
          bulk(rows, patch).then(api.close);
        });
      }
    });
  }
  function bulkPrice(rows) {
    ZA.confirm('Change the selling, discount and original price of ' + rows.length + ' products by a percentage. Prices are rounded to whole rupees. Use a negative number to lower prices.', {
      title: 'Adjust prices', confirmLabel: 'Apply', input: { label: 'Change by % (e.g. 10 or -15)', required: true }
    }).then(function (v) {
      if (v === false) return;
      var pct = Number(v);
      if (!isFinite(pct) || pct === 0) { ZA.fail('Enter a non-zero percentage.'); return; }
      bulk(rows, { price_change_percent: pct }, 'repriced');
    });
  }
  function bulkCategory(rows, tree) {
    ZA.modal({
      title: 'Category for ' + rows.length + ' products',
      body: '<form id="bcForm" class="stack">' + ZA.f.select('category', 'Category', '', tree.map(function (c) { return [c.id, '  '.repeat(c.depth) + c.name + ' (' + KIND_LABEL[c.kind] + ')']; })) +
        '<div class="row"><label class="check-row"><input type="radio" name="mode" value="add" checked> Add to this category</label><label class="check-row"><input type="radio" name="mode" value="remove"> Remove from it</label></div></form>',
      foot: '<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="bcGo">Apply</button>',
      onOpen: function (m, api) {
        m.querySelector('#bcGo').addEventListener('click', function () {
          var v = ZA.readForm(m.querySelector('#bcForm')), patch = {};
          patch[v.mode === 'remove' ? 'remove_category_id' : 'add_category_id'] = v.category;
          bulk(rows, patch).then(api.close);
        });
      }
    });
  }
  function bulkStock(rows) {
    ZA.confirm('Set the stock of every variant of the ' + rows.length + ' selected products to the same number.', {
      title: 'Set stock', confirmLabel: 'Set stock', input: { label: 'Stock per variant', required: true }
    }).then(function (v) {
      if (v === false) return;
      var n = Number(v);
      if (!Number.isInteger(n) || n < 0) { ZA.fail('Stock must be a whole number, 0 or more.'); return; }
      bulk(rows, { stock: n }, 'restocked');
    });
  }
  function deleteProducts(rows) {
    ZA.confirm('Permanently delete ' + rows.length + ' product' + (rows.length === 1 ? '' : 's') + '? Past orders keep their item names and prices, but reviews of these products are removed and this can’t be undone. To take a product off the store without losing it, use Hide instead.', {
      title: 'Delete products', danger: true, confirmLabel: 'Delete permanently'
    }).then(function (ok) {
      if (!ok) return;
      var ids = rows.map(function (r) { return r.id; });
      ZA.q(ZA.db.from('product_images').select('storage_path').in('product_id', ids)).then(function (imgs) {
        return ZA.q(ZA.db.from('products').delete().in('id', ids).select('id')).then(function (deleted) {
          if (!deleted.length) throw new Error('Nothing was deleted — you may not have permission.');
          ZA.images.remove('products', imgs.map(function (i) { return i.storage_path; }));
          ZA.ok(deleted.length + ' deleted');
          if (table) { table.clearSelection(); table.reload(); }
          else ZA.go('#/products');
        });
      }).catch(ZA.fail);
    });
  }

  ZA.actions['product-toggle'] = function (b) {
    var next = b.getAttribute('data-status') === 'active' ? 'draft' : 'active';
    ZA.busy(b, true);
    ZA.q(ZA.db.from('products').update({ status: next }).eq('id', b.getAttribute('data-id')).select('id')).then(function (r) {
      if (!r.length) throw new Error('You don’t have permission to do that.');
      ZA.ok(next === 'active' ? 'Product is now visible on the store' : 'Product hidden from the store');
      if (table) table.reload();
    }).catch(function (e) { ZA.busy(b, false); ZA.fail(e); });
  };
  ZA.actions['product-duplicate'] = function (b) {
    ZA.busy(b, true);
    ZA.rpc('admin_duplicate_product', { p_id: b.getAttribute('data-id') }).then(function (id) {
      ZA.ok('Duplicated as a hidden draft');
      ZA.go('#/products/' + id);
    }).catch(function (e) { ZA.busy(b, false); ZA.fail(e); });
  };
  ZA.actions['product-delete'] = function (b) { deleteProducts([{ id: b.getAttribute('data-id'), name: b.getAttribute('data-name') }]); };

  /* ---------- CSV export ---------- */
  function exportProducts(ids) {
    var run = function (rows) {
      var csv = ZA.csv.stringify(rows, CSV_COLUMNS.map(function (c) {
        return { label: c, value: function (r) {
          if (c === 'stock') return r.total_stock;
          if (c === 'categories') return r.category_names;
          if (BOOL_COLS.indexOf(c) !== -1) return r[c] ? 'yes' : 'no';
          return r[c];
        } };
      }));
      ZA.csv.download('zari-products-' + new Date().toISOString().slice(0, 10) + '.csv', csv);
      ZA.logEvent('products_exported', { count: rows.length });
      ZA.ok('Exported ' + rows.length + ' products');
    };
    if (ids) { ZA.q(ZA.db.from('admin_products_view').select('*').in('id', ids)).then(run).catch(ZA.fail); return; }
    if (!table) return;
    var origQuery = table.opts.query;
    // Same filters as the list, but every column.
    table.opts.query = function (st) {
      var q = ZA.db.from('admin_products_view').select('*', { count: 'exact' });
      if (st.filters.status) q = q.eq('status', st.filters.status);
      if (st.filters.stock_state) q = q.eq('stock_state', st.filters.stock_state);
      if (st.filters.category) q = q.contains('category_ids', [st.filters.category]);
      if (st.filters.flag) q = q.eq(st.filters.flag, true);
      return ZA.applyTableState(q, st, ['name', 'sku']).then(function (res) { return { rows: ZA.unwrap(res), total: res.count || 0 }; });
    };
    table.fetchAll(5000).then(run).catch(ZA.fail).then(function () { table.opts.query = origQuery; });
  }
  ZA.actions['products-export'] = function () { exportProducts(null); };

  /* ---------- CSV import ---------- */
  ZA.actions['products-import'] = function () {
    ZA.modal({
      title: 'Import products from CSV', wide: true,
      body: '<div class="stack"><p class="muted" style="margin:0;">Rows are matched by <strong>SKU</strong>: existing products are updated, new SKUs are created as products. Blank cells leave the current value unchanged. ' +
        'Categories are comma-separated names that already exist (e.g. <em>Saree, Silk</em>). Yes/no columns accept yes, no, true, false.</p>' +
        '<div class="row"><button class="btn btn-sm" type="button" id="impTemplate">Download template</button><label class="btn btn-sm btn-primary">Choose CSV file<input type="file" accept=".csv,text/csv" id="impFile" hidden></label></div>' +
        '<div id="impPreview"></div></div>',
      foot: '<button class="btn" data-close>Close</button><button class="btn btn-primary hidden" id="impGo" data-busy="Importing…">Import</button>',
      onOpen: function (m) {
        var rows = [];
        m.querySelector('#impTemplate').addEventListener('click', function () {
          ZA.csv.download('zari-products-template.csv', CSV_COLUMNS.join(',') + '\r\nZR-1001,Kasavu Set Mundu,draft,3200,,3600,5,Set Mundu,Set Mundu,6211,Cotton,Festive,Handloom,Zari,no,yes,no,no,,,Handwoven kasavu set mundu.');
        });
        m.querySelector('#impFile').addEventListener('change', function () {
          var file = this.files[0];
          if (!file) return;
          if (file.size > 5 * 1024 * 1024) { ZA.fail('CSV is larger than 5 MB.'); return; }
          file.text().then(function (text) {
            var parsed = ZA.csv.parse(text);
            var unknown = parsed.length ? Object.keys(parsed[0]).filter(function (k) { return CSV_COLUMNS.concat(['weave', 'work_type', 'border_type', 'pattern', 'wash_care', 'blouse_colour', 'country_of_origin', 'saree_length_m', 'blouse_length_m', 'blouse_included', 'ready_to_wear', 'low_stock_threshold', 'slug']).indexOf(k) === -1; }) : [];
            rows = parsed.map(function (r) {
              var o = {};
              Object.keys(r).forEach(function (k) {
                if (unknown.indexOf(k) !== -1) return;
                var v = r[k];
                if (NUM_COLS.indexOf(k) !== -1) v = v === '' ? '' : String(v).replace(/[₹,\s]/g, '');
                if (BOOL_COLS.indexOf(k) !== -1 && v !== '') v = /^(y|yes|true|1|on)$/i.test(v) ? 'true' : 'false';
                o[k] = v;
              });
              return o;
            }).filter(function (r) { return r.sku; });
            var missing = parsed.length - rows.length;
            m.querySelector('#impPreview').innerHTML =
              '<div class="notice ' + (rows.length ? 'ok' : 'danger') + '">' + rows.length + ' row' + (rows.length === 1 ? '' : 's') + ' ready to import' + (missing ? ' · ' + missing + ' skipped (no SKU)' : '') + '.</div>' +
              (unknown.length ? '<div class="notice warn" style="margin-top:8px;">Ignored columns: ' + esc(unknown.join(', ')) + '</div>' : '') +
              (rows.length ? '<div class="table-wrap" style="margin-top:10px;"><table class="data"><thead><tr><th>SKU</th><th>Name</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead><tbody>' +
                rows.slice(0, 8).map(function (r) { return '<tr><td class="mono">' + esc(r.sku) + '</td><td>' + esc(r.name || '(unchanged)') + '</td><td>' + esc(r.price || '') + '</td><td>' + esc(r.stock || '') + '</td><td>' + esc(r.status || '') + '</td></tr>'; }).join('') +
                '</tbody></table></div>' + (rows.length > 8 ? '<p class="small muted">…and ' + (rows.length - 8) + ' more.</p>' : '') : '');
            m.querySelector('#impGo').classList.toggle('hidden', !rows.length);
          });
        });
        m.querySelector('#impGo').addEventListener('click', function () {
          var btn = this, results = [], chunks = [];
          for (var i = 0; i < rows.length; i += 200) chunks.push(rows.slice(i, i + 200));
          ZA.busy(btn, true);
          chunks.reduce(function (p, chunk, ci) {
            return p.then(function () {
              return ZA.rpc('admin_import_products', { p_rows: chunk }).then(function (res) {
                res.forEach(function (r) { r.row += ci * 200; });
                results = results.concat(res);
              });
            });
          }, Promise.resolve()).then(function () {
            var ok = results.filter(function (r) { return r.ok; }), bad = results.filter(function (r) { return !r.ok; });
            var created = ok.filter(function (r) { return r.action === 'created'; }).length;
            ZA.logEvent('products_imported', { created: created, updated: ok.length - created, failed: bad.length });
            m.querySelector('#impPreview').innerHTML = '<div class="notice ' + (bad.length ? 'warn' : 'ok') + '">' + created + ' created · ' + (ok.length - created) + ' updated · ' + bad.length + ' failed</div>' +
              (bad.length ? '<div class="table-wrap" style="margin-top:10px;"><table class="data"><thead><tr><th>Row</th><th>SKU</th><th>Problem</th></tr></thead><tbody>' +
                bad.map(function (r) { return '<tr><td>' + (r.row + 1) + '</td><td class="mono">' + esc(r.sku) + '</td><td>' + esc(r.error) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '');
            btn.classList.add('hidden');
            if (table) table.reload();
          }).catch(function (e) { ZA.fail(e); }).then(function () { ZA.busy(btn, false); });
        });
      }
    });
  };

  /* =====================================================
     EDITOR
     ===================================================== */
  function renderEditor(id, el) {
    var isNew = id === 'new';
    ZA.setPage(isNew ? 'New product' : 'Edit product', [['Catalogue'], ['Products', '#/products']]);
    Promise.all([
      isNew ? Promise.resolve(null) : ZA.q(ZA.db.from('products').select('*, product_images(*), product_colors(*), product_variants(*), product_categories(category_id)').eq('id', id).maybeSingle()),
      loadCategories()
    ]).then(function (r) {
      var p = r[0], cats = r[1];
      if (!isNew && !p) { el.innerHTML = '<div class="card"><div class="empty"><strong>Product not found</strong><a href="#/products">Back to products</a></div></div>'; return; }
      p = p || { status: 'draft', low_stock_threshold: 3, product_variants: [{ stock: 0 }], product_colors: [], product_images: [], product_categories: [], country_of_origin: 'India' };
      draw(p, cats, isNew, el);
    }).catch(function (err) { el.innerHTML = '<div class="notice danger">' + esc(err.message) + '</div>'; });
  }

  function draw(p, cats, isNew, el) {
    var colors = (p.product_colors || []).slice().sort(function (a, b) { return a.sort_order - b.sort_order; }).map(function (c) { return { name: c.name, hex: c.hex || '#7a2828' }; });
    var variants = (p.product_variants || []).slice().sort(function (a, b) { return String(a.variant_sku || '').localeCompare(String(b.variant_sku || '')); })
      .map(function (v) { return { id: v.id, color: v.color || '', size: v.size || '', stock: v.stock || 0, variant_sku: v.variant_sku || '' }; });
    var catIds = (p.product_categories || []).map(function (x) { return x.category_id; });
    var tree = categoryTree(cats);
    var images = (p.product_images || []).slice().sort(function (a, b) { return a.sort_order - b.sort_order; });

    if (!isNew) {
      ZA.setPage(p.name, [['Catalogue'], ['Products', '#/products']],
        (p.status === 'active' ? '<a class="btn btn-sm" href="../#/product/' + encodeURIComponent(p.slug) + '" target="_blank" rel="noopener">View on store ↗</a>' : '') +
        '<button class="btn btn-sm" data-action="product-duplicate" data-id="' + p.id + '">Duplicate</button>');
    }
    var catGroups = ['saree_type', 'fabric', 'occasion', 'style'].map(function (kind) {
      var list = tree.filter(function (c) { return c.kind === kind; });
      if (!list.length) return '';
      return '<div style="margin-bottom:12px;"><div class="label small muted" style="font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">' + KIND_LABEL[kind] + '</div>' +
        list.map(function (c) { return '<label class="check-row" style="padding-left:' + (c.depth * 18) + 'px;margin-bottom:4px;"><input type="checkbox" name="category_ids" value="' + c.id + '"' + (catIds.indexOf(c.id) !== -1 ? ' checked' : '') + '> ' + esc(c.name) + (c.is_visible ? '' : ' <span class="pill">hidden</span>') + '</label>'; }).join('') + '</div>';
    }).join('') || '<p class="muted small">No categories yet. <a href="#/categories">Create one</a>.</p>';

    el.innerHTML = '<form id="productForm" novalidate><div class="cols"><div>' +
      // Basics
      '<div class="card"><div class="card-head"><h3>Product</h3></div><div class="card-body stack">' +
      ZA.f.text('name', 'Product name', p.name, { required: true, max: 200 }) +
      '<div class="grid-2">' + ZA.f.text('sku', 'Product code / SKU', p.sku, { required: true, max: 60, hint: 'Letters, numbers, . _ / - · shown to customers' }) +
      '<div class="field"><label for="f_product_type">Product type</label><input type="text" id="f_product_type" name="product_type" list="ptypes" value="' + esc(p.product_type || '') + '" maxlength="80"><datalist id="ptypes">' + PRODUCT_TYPES.map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist></div></div>' +
      ZA.f.textarea('description', 'Description', p.description, { rows: 6, max: 10000 }) +
      '</div></div>' +
      // Images
      '<div class="card"><div class="card-head"><h3>Images</h3></div><div class="card-body"><div id="imgMgr"></div></div></div>' +
      // Pricing
      '<div class="card"><div class="card-head"><h3>Pricing</h3><span class="small muted" id="discountNote"></span></div><div class="card-body"><div class="grid-3">' +
      ZA.f.text('price', 'Selling price', p.price, { type: 'number', min: 0, step: '1', prefix: '₹', required: true, hint: '0 = “Price on request” (can’t be bought)' }) +
      ZA.f.text('sale_price', 'Discount price', p.sale_price, { type: 'number', min: 0, step: '1', prefix: '₹', hint: 'Optional — shown with the selling price struck through' }) +
      ZA.f.text('mrp', 'Original price (MRP)', p.mrp, { type: 'number', min: 0, step: '1', prefix: '₹', hint: 'Optional — shown struck through when higher' }) +
      '</div></div></div>' +
      // Variants
      '<div class="card"><div class="card-head"><h3>Inventory, colours &amp; sizes</h3><span class="small muted" id="stockTotal"></span></div><div class="card-body stack">' +
      '<div><div class="row-between"><span class="label small" style="font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--maroon-900);">Colour options</span><button type="button" class="btn btn-sm" data-act="add-color">+ Add colour</button></div><div id="colorRows" style="margin-top:8px;"></div></div>' +
      '<div><div class="row-between"><span class="label small" style="font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--maroon-900);">Variants &amp; stock</span><span class="row"><button type="button" class="btn btn-sm" data-act="variants-from-colors">One per colour</button><button type="button" class="btn btn-sm" data-act="add-variant">+ Add variant</button></span></div>' +
      '<p class="small muted" style="margin:6px 0 8px;">Each variant is a colour/size combination with its own stock. Products need at least one variant to be added to the bag. Size is optional (leave blank for free-size sarees).</p><div id="variantRows"></div></div>' +
      ZA.f.text('low_stock_threshold', 'Low-stock alert at', p.low_stock_threshold, { type: 'number', min: 0, step: '1', hint: 'Dashboard warns when a variant’s stock is at or below this' }) +
      '</div></div>' +
      // Attributes
      '<div class="card"><div class="card-head"><h3>Saree details</h3><span class="small muted">Shown on the product page when filled in</span></div><div class="card-body"><div class="grid-2">' +
      ZA.f.text('fabric', 'Fabric / material', p.fabric, { max: 80 }) + ZA.f.text('occasion', 'Occasion', p.occasion, { max: 80 }) +
      ZA.f.text('weave', 'Weave', p.weave, { max: 80 }) + ZA.f.text('work_type', 'Work type', p.work_type, { max: 80 }) +
      ZA.f.text('border_type', 'Border', p.border_type, { max: 80 }) + ZA.f.text('pattern', 'Pattern', p.pattern, { max: 80 }) +
      ZA.f.text('saree_length_m', 'Saree length (m)', p.saree_length_m, { type: 'number', min: 0, step: '0.01' }) + ZA.f.text('blouse_length_m', 'Blouse length (m)', p.blouse_length_m, { type: 'number', min: 0, step: '0.01' }) +
      ZA.f.text('blouse_colour', 'Blouse colour', p.blouse_colour, { max: 80 }) + ZA.f.text('country_of_origin', 'Country of origin', p.country_of_origin, { max: 80 }) +
      '<div class="span-2">' + ZA.f.text('wash_care', 'Care instructions', p.wash_care, { max: 500 }) + '</div>' +
      '<div class="row span-2">' + ZA.f.switch('blouse_included', 'Blouse piece included', p.blouse_included) + ZA.f.switch('ready_to_wear', 'Ready to wear', p.ready_to_wear) + '</div>' +
      '</div></div></div>' +
      '</div><div>' +
      // Visibility
      '<div class="card"><div class="card-head"><h3>Availability</h3></div><div class="card-body stack">' +
      ZA.f.select('status', 'Status', p.status, [['active', 'Active — visible on the store'], ['draft', 'Hidden (draft)'], ['archived', 'Archived']]) +
      '<div class="stack" style="gap:10px;">' + ZA.f.switch('featured', 'Featured', p.featured) + ZA.f.switch('new_arrival', 'New arrival', p.new_arrival) + ZA.f.switch('best_seller', 'Best seller', p.best_seller) + ZA.f.switch('on_sale', 'On sale (Special Offers)', p.on_sale) + '</div>' +
      '</div></div>' +
      // Categories
      '<div class="card"><div class="card-head"><h3>Categories</h3><a class="link" href="#/categories">Manage</a></div><div class="card-body">' + catGroups +
      ZA.f.text('hsn_code', 'HSN code', p.hsn_code, { max: 20 }) + '</div></div>' +
      // SEO
      '<div class="card"><div class="card-head"><h3>Search engine listing</h3></div><div class="card-body stack">' +
      ZA.f.text('seo_title', 'SEO title', p.seo_title, { max: 70, hint: '<span id="seoTitleCount"></span> Up to 70 characters. Defaults to the product name.' }) +
      ZA.f.textarea('seo_description', 'SEO description', p.seo_description, { rows: 3, max: 170, hint: '<span id="seoDescCount"></span> Up to 170 characters.' }) +
      ZA.f.text('slug', 'URL slug', p.slug, { max: 120, hint: 'Leave blank to generate from the name.' }) +
      '<div class="serp" id="serp"></div></div></div>' +
      '</div></div>' +
      '<div class="sticky-actions"><span class="small muted"><span class="hidden" data-dirty-indicator><span class="dirty-dot"></span>Unsaved changes</span></span>' +
      '<div class="row">' + (!isNew ? '<button type="button" class="btn btn-danger" data-act="delete">Delete</button>' : '') +
      '<a class="btn" href="#/products">Cancel</a><button type="submit" class="btn btn-primary" data-busy="Saving…">' + (isNew ? 'Create product' : 'Save changes') + '</button></div></div>' +
      '</form>';

    var form = ZA.qs('#productForm');
    var imgs = ZA.imageManager(ZA.qs('#imgMgr'), images, { bucket: 'products', onChange: function () { ZA.dirty.set(true); } });

    function colorRowsHtml() {
      return colors.length ? colors.map(function (c, i) {
        return '<div class="repeater-row" style="grid-template-columns:44px 1fr auto;"><input type="color" value="' + esc(c.hex) + '" data-color="' + i + '" data-k="hex" aria-label="Swatch colour">' +
          '<input type="text" value="' + esc(c.name) + '" placeholder="Colour name (e.g. Maroon)" maxlength="60" data-color="' + i + '" data-k="name">' +
          '<button type="button" class="link danger" data-act="del-color" data-i="' + i + '">Remove</button></div>';
      }).join('') : '<p class="small muted" style="margin:0;">No colour options.</p>';
    }
    function variantRowsHtml() {
      var opts = ['<option value="">— Any colour —</option>'].concat(colors.filter(function (c) { return c.name; }).map(function (c) { return '<option>' + esc(c.name) + '</option>'; }));
      return (variants.length ? '<div class="repeater-row small muted" style="grid-template-columns:1.2fr .8fr 1.2fr 90px auto;font-weight:700;"><span>Colour</span><span>Size</span><span>Variant SKU</span><span>Stock</span><span></span></div>' : '') +
        variants.map(function (v, i) {
          return '<div class="repeater-row" style="grid-template-columns:1.2fr .8fr 1.2fr 90px auto;">' +
            '<select data-var="' + i + '" data-k="color" aria-label="Variant colour">' + opts.join('').replace('<option>' + esc(v.color) + '</option>', '<option selected>' + esc(v.color) + '</option>') + '</select>' +
            '<input type="text" value="' + esc(v.size) + '" placeholder="Free size" maxlength="30" data-var="' + i + '" data-k="size" aria-label="Variant size">' +
            '<input type="text" value="' + esc(v.variant_sku) + '" placeholder="Auto" maxlength="60" data-var="' + i + '" data-k="variant_sku" aria-label="Variant SKU" class="mono">' +
            '<input type="number" min="0" step="1" value="' + esc(v.stock) + '" data-var="' + i + '" data-k="stock" aria-label="Stock">' +
            '<button type="button" class="link danger" data-act="del-variant" data-i="' + i + '">Remove</button></div>';
        }).join('') || '<div class="notice warn">No variants — this product can’t be added to the bag. Add at least one.</div>';
    }
    function refreshRepeaters() { ZA.qs('#colorRows').innerHTML = colorRowsHtml(); ZA.qs('#variantRows').innerHTML = variantRowsHtml(); refreshSummary(); }
    function refreshSummary() {
      var total = variants.reduce(function (s, v) { return s + (Number(v.stock) || 0); }, 0);
      ZA.qs('#stockTotal').textContent = 'Total stock: ' + total;
      var v = ZA.readForm(form);
      var note = '';
      if (v.price > 0 && v.sale_price != null && v.sale_price < v.price) note = Math.round((1 - v.sale_price / v.price) * 100) + '% off selling price';
      else if (v.price > 0 && v.mrp > v.price) note = Math.round((1 - v.price / v.mrp) * 100) + '% off MRP';
      ZA.qs('#discountNote').textContent = note;
      var title = v.seo_title || v.name || 'Product name';
      var desc = v.seo_description || (v.description || '').slice(0, 160) || 'Product description…';
      ZA.qs('#serp').innerHTML = '<div class="u">' + esc(location.host || 'zari') + ' › product › ' + esc(v.slug || ZA.slugify(v.name) || '…') + '</div><div class="t">' + esc(title + ' | Zari') + '</div><div class="d">' + esc(desc) + '</div>';
      ZA.qs('#seoTitleCount').textContent = (v.seo_title || '').length + '/70.';
      ZA.qs('#seoDescCount').textContent = (v.seo_description || '').length + '/170.';
    }
    refreshRepeaters();
    ZA.markDirtyOnInput(form);
    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-color')) { colors[Number(t.getAttribute('data-color'))][t.getAttribute('data-k')] = t.value; if (t.getAttribute('data-k') === 'name') ZA.qs('#variantRows').innerHTML = variantRowsHtml(); }
      if (t.hasAttribute('data-var')) { var k = t.getAttribute('data-k'); variants[Number(t.getAttribute('data-var'))][k] = k === 'stock' ? t.value : t.value; }
      refreshSummary();
    });
    form.addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-var')) { variants[Number(t.getAttribute('data-var'))][t.getAttribute('data-k')] = t.value; refreshSummary(); }
    });
    form.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act'), i = Number(b.getAttribute('data-i'));
      if (act === 'add-color') colors.push({ name: '', hex: '#7a2828' });
      if (act === 'del-color') { var gone = colors.splice(i, 1)[0]; variants.forEach(function (v) { if (v.color === gone.name) v.color = ''; }); }
      if (act === 'add-variant') variants.push({ color: '', size: '', stock: 0, variant_sku: '' });
      if (act === 'del-variant') variants.splice(i, 1);
      if (act === 'variants-from-colors') {
        var named = colors.filter(function (c) { return c.name.trim(); });
        if (!named.length) { ZA.fail('Add colour options first.'); return; }
        named.forEach(function (c) { if (!variants.some(function (v) { return v.color === c.name; })) variants.push({ color: c.name, size: '', stock: 0, variant_sku: '' }); });
        variants = variants.filter(function (v) { return v.color || variants.length === 1; });
      }
      if (act === 'delete') { deleteProducts([{ id: p.id, name: p.name }]); return; }
      ZA.dirty.set(true);
      refreshRepeaters();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = ZA.readForm(form), btn = form.querySelector('button[type=submit]');
      ZA.qsa('[aria-invalid]', form).forEach(function (x) { x.removeAttribute('aria-invalid'); });
      var problems = [];
      function bad(name, msg) { var f = form.querySelector('[name="' + name + '"]'); if (f) f.setAttribute('aria-invalid', 'true'); problems.push(msg); }
      if (!v.name) bad('name', 'Product name is required.');
      if (!/^[A-Za-z0-9][A-Za-z0-9._\/-]{0,59}$/.test(v.sku || '')) bad('sku', 'SKU may only use letters, numbers and . _ / - (max 60).');
      if (v.price == null || v.price < 0) bad('price', 'Selling price must be 0 or more.');
      if (v.sale_price != null && (v.sale_price < 0 || v.sale_price > (v.price || 0))) bad('sale_price', 'Discount price must be lower than the selling price.');
      if (v.mrp != null && v.mrp < (v.price || 0)) bad('mrp', 'MRP can’t be lower than the selling price.');
      if (variants.some(function (x) { return !(Number(x.stock) >= 0) || String(x.stock) === ''; })) problems.push('Every variant needs a stock number (0 or more).');
      if (v.status === 'active' && !variants.length && v.price > 0) problems.push('Add at least one variant before activating a priced product.');
      if (imgs.busy()) problems.push('Wait for image uploads to finish.');
      if (problems.length) { ZA.fail(problems[0]); var first = form.querySelector('[aria-invalid]'); if (first) first.focus(); return; }

      var payload = Object.assign({}, v, {
        id: isNew ? null : p.id,
        category_ids: v.category_ids || [],
        images: imgs.get(),
        colors: colors.filter(function (c) { return c.name.trim(); }),
        variants: variants.map(function (x) { return { id: x.id || null, color: x.color, size: x.size, stock: Number(x.stock) || 0, variant_sku: x.variant_sku }; })
      });
      ZA.busy(btn, true);
      ZA.rpc('admin_save_product', { p: payload }).then(function (savedId) {
        imgs.committed();
        ZA.dirty.set(false);
        ZA.ok(isNew ? 'Product created' : 'Saved — live on the store' + (v.status === 'active' ? '' : ' (hidden)'));
        if (isNew) ZA.go('#/products/' + savedId); else ZA.app.route();
      }).catch(function (err) { ZA.busy(btn, false); ZA.fail(err); });
    });
    // Leaving without saving: delete images uploaded in this session that never got saved.
    ZA.cleanup = function () { imgs.discard(); };
  }

  ZA.routes.products = {
    perm: 'products',
    render: function (params, el) { if (params[0]) renderEditor(params[0], el); else renderList(el); }
  };
})();
