/* =========================================================
   Zari Admin — discount coupons. Codes are never readable by the public;
   customers check a code through quote_cart(), which recomputes the discount
   from database prices and is rate-limited against guessing.
   ========================================================= */
(function () {
  var esc = ZA.esc;
  var table;

  function couponState(c) {
    var now = Date.now();
    if (!c.is_active) return ['disabled', 'Inactive'];
    if (c.starts_at && new Date(c.starts_at).getTime() > now) return ['scheduled', 'Scheduled'];
    if (c.expires_at && new Date(c.expires_at).getTime() < now) return ['expired', 'Expired'];
    if (c.usage_limit && c.used_count >= c.usage_limit) return ['expired', 'Used up'];
    return ['active', 'Active'];
  }
  function toLocalInput(iso) { if (!iso) return ''; var d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
  function describe(c) {
    return (c.discount_type === 'percent' ? Number(c.discount_value) + '% off' : ZA.money(c.discount_value) + ' off') +
      (c.max_discount ? ' (max ' + ZA.money(c.max_discount) + ')' : '');
  }

  function render(el) {
    ZA.setPage('Coupons', [['Sales']], '<button class="btn btn-primary btn-sm" data-action="coupon-edit">+ New coupon</button>');
    el.innerHTML = '<div id="couponTable"></div>';
    table = new ZA.DataTable({
      id: 'coupons', el: ZA.qs('#couponTable'), search: 'Search code', defaultSort: { col: 'created_at', asc: false },
      filters: [{ key: 'active', label: 'Status', options: [['true', 'Active'], ['false', 'Inactive']] }, { key: 'applies_to', label: 'Applies to', options: [['all', 'Whole order'], ['products', 'Selected products'], ['categories', 'Selected categories']] }],
      columns: [
        { label: 'Code', sort: 'code', render: function (c) { return '<span class="cell-title mono">' + esc(c.code) + '</span>' + (c.description ? '<div class="cell-sub">' + esc(c.description) + '</div>' : ''); } },
        { label: 'Discount', render: function (c) { return esc(describe(c)) + '<div class="cell-sub">' + ({ all: 'Whole order', products: 'Selected products', categories: 'Selected categories' })[c.applies_to] + (c.min_order_value > 0 ? ' · min ' + ZA.money(c.min_order_value) : '') + '</div>'; } },
        { label: 'Used', sort: 'used_count', render: function (c) { return ZA.num(c.used_count) + (c.usage_limit ? ' / ' + ZA.num(c.usage_limit) : '') + (c.per_customer_limit ? '<div class="cell-sub">' + c.per_customer_limit + ' per customer</div>' : ''); } },
        { label: 'Valid', render: function (c) { return '<span class="small">' + (c.starts_at ? ZA.date(c.starts_at) : 'Now') + ' → ' + (c.expires_at ? ZA.date(c.expires_at) : 'No expiry') + '</span>'; } },
        { label: 'Status', render: function (c) { var s = couponState(c); return ZA.pill(s[0], s[1]); } },
        { label: '', cls: 'actions', render: function (c) {
          return '<button class="link" data-action="coupon-edit" data-id="' + c.id + '">Edit</button>' +
            '<button class="link" data-action="coupon-toggle" data-id="' + c.id + '" data-on="' + c.is_active + '">' + (c.is_active ? 'Deactivate' : 'Activate') + '</button>' +
            (c.used_count ? '' : '<button class="link danger" data-action="coupon-delete" data-id="' + c.id + '">Delete</button>');
        } }
      ],
      query: function (st) {
        var q = ZA.db.from('coupons').select('*, coupon_products(product_id), coupon_categories(category_id)', { count: 'exact' });
        if (st.filters.active) q = q.eq('is_active', st.filters.active === 'true');
        if (st.filters.applies_to) q = q.eq('applies_to', st.filters.applies_to);
        return ZA.applyTableState(q, st, ['code', 'description']).then(function (res) { var rows = ZA.unwrap(res); table && (table._rows = rows); return { rows: rows, total: res.count || 0 }; });
      },
      emptyTitle: 'No coupons yet', emptyText: '<br>Create a code customers can enter at checkout.'
    });
  }

  ZA.actions['coupon-toggle'] = function (b) {
    var on = b.getAttribute('data-on') !== 'true';
    ZA.q(ZA.db.from('coupons').update({ is_active: on }).eq('id', b.getAttribute('data-id')).select('id')).then(function (r) {
      if (!r.length) throw new Error('You don’t have permission to do that.');
      ZA.ok(on ? 'Coupon activated' : 'Coupon deactivated'); table.reload();
    }).catch(ZA.fail);
  };
  ZA.actions['coupon-delete'] = function (b) {
    ZA.confirm('Delete this unused coupon?', { danger: true, confirmLabel: 'Delete' }).then(function (ok) {
      if (!ok) return;
      ZA.q(ZA.db.from('coupons').delete().eq('id', b.getAttribute('data-id')).select('id')).then(function (r) {
        if (!r.length) throw new Error('You don’t have permission to do that.');
        ZA.ok('Coupon deleted'); table.reload();
      }).catch(ZA.fail);
    });
  };

  ZA.actions['coupon-edit'] = function (b) {
    var id = b.getAttribute('data-id');
    var c = id ? (table._rows || []).find(function (x) { return x.id === id; }) : { discount_type: 'percent', is_active: true, applies_to: 'all', min_order_value: 0, coupon_products: [], coupon_categories: [] };
    var productIds = (c.coupon_products || []).map(function (x) { return x.product_id; });
    var categoryIds = (c.coupon_categories || []).map(function (x) { return x.category_id; });
    var chosen = []; // product rows for chips
    ZA.loadCategories().then(function (cats) {
      var tree = ZA.categoryTree(cats.filter(function (x) { return x.kind === 'saree_type' || x.kind === 'fabric' || x.kind === 'occasion' || x.kind === 'style'; }));
      ZA.modal({
        title: id ? 'Edit coupon ' + c.code : 'New coupon', wide: true,
        body: '<form id="cpForm" class="stack" novalidate>' +
          '<div class="grid-2"><div class="field"><label for="f_code">Code *</label><div class="row" style="flex-wrap:nowrap;"><input id="f_code" name="code" value="' + esc(c.code || '') + '" maxlength="30" class="mono" style="text-transform:uppercase;" placeholder="e.g. ONAM10"><button type="button" class="btn btn-sm" id="cpGen">Generate</button></div><span class="hint">3–30 letters, numbers, - or _</span></div>' +
          ZA.f.text('description', 'Internal note', c.description, { max: 200 }) + '</div>' +
          '<div class="grid-3">' + ZA.f.select('discount_type', 'Type', c.discount_type, [['percent', 'Percentage'], ['fixed', 'Fixed amount (₹)']]) +
          ZA.f.text('discount_value', 'Value', c.discount_value, { type: 'number', min: 0.01, step: '0.01', required: true }) +
          ZA.f.text('max_discount', 'Max discount (₹)', c.max_discount, { type: 'number', min: 0, step: '1', hint: 'Cap for % coupons (optional)' }) + '</div>' +
          '<div class="grid-3">' + ZA.f.text('min_order_value', 'Minimum order (₹)', c.min_order_value, { type: 'number', min: 0, step: '1' }) +
          ZA.f.text('usage_limit', 'Total uses allowed', c.usage_limit, { type: 'number', min: 1, step: '1', hint: 'Blank = unlimited' }) +
          ZA.f.text('per_customer_limit', 'Uses per customer', c.per_customer_limit, { type: 'number', min: 1, step: '1', hint: 'Blank = unlimited' }) + '</div>' +
          '<div class="grid-2">' + ZA.f.text('starts_at', 'Starts', toLocalInput(c.starts_at), { type: 'datetime-local', hint: 'Blank = immediately' }) + ZA.f.text('expires_at', 'Expires', toLocalInput(c.expires_at), { type: 'datetime-local', hint: 'Blank = never' }) + '</div>' +
          ZA.f.select('applies_to', 'Applies to', c.applies_to, [['all', 'Whole order'], ['products', 'Only selected products'], ['categories', 'Only products in selected categories']]) +
          '<div id="cpProducts" class="field"><span class="label">Products</span><div class="chips" id="cpChips"></div><button type="button" class="btn btn-sm" id="cpPick" style="align-self:flex-start;">+ Choose products</button></div>' +
          '<div id="cpCats" class="field"><span class="label">Categories (subcategories are included)</span><div class="check-grid">' +
          tree.map(function (t) { return '<label class="check-row"><input type="checkbox" name="category_ids" value="' + t.id + '"' + (categoryIds.indexOf(t.id) !== -1 ? ' checked' : '') + '>' + ' '.repeat(t.depth * 2) + esc(t.name) + '</label>'; }).join('') + '</div></div>' +
          ZA.f.switch('is_active', 'Active', c.is_active) + '</form>',
        foot: '<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="cpSave" data-busy="Saving…">Save coupon</button>',
        onOpen: function (m, api) {
          var form = m.querySelector('#cpForm');
          function sync() {
            var at = form.querySelector('[name=applies_to]').value;
            m.querySelector('#cpProducts').classList.toggle('hidden', at !== 'products');
            m.querySelector('#cpCats').classList.toggle('hidden', at !== 'categories');
            m.querySelector('[name=max_discount]').closest('.field').classList.toggle('hidden', form.querySelector('[name=discount_type]').value !== 'percent');
            m.querySelector('#cpChips').innerHTML = chosen.map(function (p) { return '<span class="chip">' + esc(p.name) + '<button type="button" data-unpick="' + p.id + '" aria-label="Remove">×</button></span>'; }).join('') || '<span class="small muted">None chosen</span>';
          }
          if (productIds.length) ZA.q(ZA.db.from('products').select('id,name').in('id', productIds)).then(function (rows) { chosen = rows; sync(); });
          form.addEventListener('change', sync);
          m.querySelector('#cpChips').addEventListener('click', function (e) { var u = e.target.closest('[data-unpick]'); if (u) { chosen = chosen.filter(function (p) { return p.id !== u.getAttribute('data-unpick'); }); sync(); } });
          m.querySelector('#cpPick').addEventListener('click', function () {
            ZA.pickProducts({ exclude: chosen.map(function (p) { return p.id; }) }).then(function (rows) { chosen = chosen.concat(rows); sync(); });
          });
          m.querySelector('#cpGen').addEventListener('click', function () {
            var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint32Array(8), s = 'ZARI-';
            crypto.getRandomValues(a); a.forEach(function (n) { s += abc[n % abc.length]; });
            form.querySelector('[name=code]').value = s;
          });
          sync();
          m.querySelector('#cpSave').addEventListener('click', function () {
            var v = ZA.readForm(form), btn = this;
            var code = String(v.code || '').toUpperCase().trim();
            var err = !/^[A-Z0-9_-]{3,30}$/.test(code) ? 'Code must be 3–30 letters, numbers, - or _.' :
              !(v.discount_value > 0) ? 'Enter a discount value above 0.' :
              v.discount_type === 'percent' && v.discount_value > 100 ? 'A percentage can’t be above 100.' :
              v.starts_at && v.expires_at && new Date(v.expires_at) <= new Date(v.starts_at) ? 'Expiry must be after the start.' :
              v.applies_to === 'products' && !chosen.length ? 'Choose at least one product.' :
              v.applies_to === 'categories' && !(v.category_ids || []).length ? 'Choose at least one category.' : '';
            if (err) { ZA.fail(err); return; }
            var row = {
              code: code, description: v.description || null, discount_type: v.discount_type, discount_value: v.discount_value,
              max_discount: v.discount_type === 'percent' ? v.max_discount : null, min_order_value: v.min_order_value || 0,
              usage_limit: v.usage_limit || null, per_customer_limit: v.per_customer_limit || null,
              starts_at: v.starts_at ? new Date(v.starts_at).toISOString() : null, expires_at: v.expires_at ? new Date(v.expires_at).toISOString() : null,
              applies_to: v.applies_to, is_active: v.is_active
            };
            if (!id) row.created_by = ZA.me.id;
            ZA.busy(btn, true);
            (id ? ZA.db.from('coupons').update(row).eq('id', id).select('id') : ZA.db.from('coupons').insert(row).select('id')).then(function (res) {
              var saved = ZA.unwrap(res);
              if (!saved.length) throw new Error('You don’t have permission to do that.');
              var cid = saved[0].id;
              return Promise.all([ZA.db.from('coupon_products').delete().eq('coupon_id', cid), ZA.db.from('coupon_categories').delete().eq('coupon_id', cid)]).then(function () {
                var w = [];
                if (row.applies_to === 'products') w.push(ZA.q(ZA.db.from('coupon_products').insert(chosen.map(function (p) { return { coupon_id: cid, product_id: p.id }; }))));
                if (row.applies_to === 'categories') w.push(ZA.q(ZA.db.from('coupon_categories').insert(v.category_ids.map(function (x) { return { coupon_id: cid, category_id: x }; }))));
                return Promise.all(w);
              });
            }).then(function () { api.close(); ZA.ok('Coupon saved'); table.reload(); })
              .catch(function (e) { ZA.busy(btn, false); ZA.fail(e); });
          });
        }
      });
    }).catch(ZA.fail);
  };

  ZA.routes.coupons = { perm: 'marketing', render: function (params, el) { render(el); } };
})();
