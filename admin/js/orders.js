/* =========================================================
   Zari Admin — orders. Status/shipping/refund changes go through
   admin_update_order() / admin_cancel_order(), which validate transitions,
   record history and never let the admin mark an order paid (that is the
   payment gateway webhook's job). Orders can't be deleted.
   ========================================================= */
(function () {
  var esc = ZA.esc;
  var table;
  var STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
  var SHIPPING = ['not_shipped', 'packed', 'in_transit', 'out_for_delivery', 'delivered', 'returned_to_origin'];
  var REFUND = ['none', 'requested', 'processing', 'refunded', 'rejected'];
  var PAYMENT = ['pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded'];
  var opts = function (list) { return list.map(function (s) { return [s, ZA.label(s)]; }); };

  function applyFilters(q, st) {
    if (st.filters.status) q = q.eq('status', st.filters.status);
    if (st.filters.payment_status) q = q.eq('payment_status', st.filters.payment_status);
    if (st.filters.shipping_status) q = q.eq('shipping_status', st.filters.shipping_status);
    if (st.filters.refund_status) q = q.eq('refund_status', st.filters.refund_status);
    if (st.filters.period) q = q.gte('created_at', new Date(Date.now() - Number(st.filters.period) * 86400000).toISOString());
    return q;
  }

  function renderList(el) {
    ZA.setPage('Orders', [['Sales']], '<button class="btn btn-sm" data-action="orders-export">Export CSV</button>');
    el.innerHTML = '<div id="ordersTable"></div>';
    table = new ZA.DataTable({
      id: 'orders', el: ZA.qs('#ordersTable'), search: 'Order no., name, phone or email', defaultSort: { col: 'created_at', asc: false },
      filters: [
        { key: 'status', label: 'Status', options: opts(STATUSES) },
        { key: 'payment_status', label: 'Payment', options: opts(PAYMENT) },
        { key: 'shipping_status', label: 'Shipping', options: opts(SHIPPING) },
        { key: 'refund_status', label: 'Refund', options: opts(REFUND) },
        { key: 'period', label: 'Placed', options: [['1', 'Last 24 hours'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['365', 'Last year']] }
      ],
      columns: [
        { label: 'Order', sort: 'created_at', render: function (o) { return '<a class="cell-title" href="#/orders/' + o.id + '">#' + esc(o.order_number) + '</a><div class="cell-sub">' + ZA.dateTime(o.created_at) + '</div>'; } },
        { label: 'Customer', sort: 'contact_name', render: function (o) { return esc(o.contact_name) + '<div class="cell-sub">' + esc(o.contact_phone) + ((o.shipping_address || {}).city ? ' · ' + esc(o.shipping_address.city) : '') + '</div>'; } },
        { label: 'Items', render: function (o) { return String(o.item_count); } },
        { label: 'Total', sort: 'total', cls: 'nowrap', render: function (o) { return '<strong>' + ZA.money(o.total) + '</strong>' + (o.coupon_code ? '<div class="cell-sub mono">' + esc(o.coupon_code) + '</div>' : ''); } },
        { label: 'Payment', render: function (o) { return ZA.pill(o.payment_status); } },
        { label: 'Status', render: function (o) { return ZA.pill(o.status) + (o.refund_status !== 'none' ? '<div class="cell-sub">Refund: ' + esc(ZA.label(o.refund_status)) + '</div>' : ''); } },
        { label: 'Shipping', render: function (o) { return ZA.pill(o.shipping_status) + (o.tracking_number ? '<div class="cell-sub mono">' + esc(o.tracking_number) + '</div>' : ''); } },
        { label: '', cls: 'actions', render: function (o) { return '<a class="link" href="#/orders/' + o.id + '">Open</a>'; } }
      ],
      query: function (st) {
        var q = applyFilters(ZA.db.from('admin_orders_view').select('*', { count: 'exact' }), st);
        return ZA.applyTableState(q, st, ['order_number', 'contact_name', 'contact_phone', 'contact_email']).then(function (res) { return { rows: ZA.unwrap(res), total: res.count || 0 }; });
      },
      emptyTitle: 'No orders found', emptyText: '<br>Orders placed on the store appear here.'
    });
  }

  ZA.actions['orders-export'] = function (b) {
    if (!table) return;
    ZA.busy(b, true);
    table.fetchAll(10000).then(function (rows) {
      var a = function (r, k) { return (r.shipping_address || {})[k] || ''; };
      var csv = ZA.csv.stringify(rows, [
        { label: 'Order', key: 'order_number' }, { label: 'Placed', value: function (r) { return new Date(r.created_at).toISOString(); } },
        { label: 'Status', key: 'status' }, { label: 'Payment', key: 'payment_status' }, { label: 'Shipping', key: 'shipping_status' }, { label: 'Refund', key: 'refund_status' },
        { label: 'Customer', key: 'contact_name' }, { label: 'Phone', key: 'contact_phone' }, { label: 'Email', key: 'contact_email' },
        { label: 'City', value: function (r) { return a(r, 'city'); } }, { label: 'State', value: function (r) { return a(r, 'state'); } }, { label: 'PIN', value: function (r) { return a(r, 'pincode'); } },
        { label: 'Items', key: 'item_count' }, { label: 'Subtotal', key: 'subtotal' }, { label: 'Shipping fee', key: 'shipping_fee' }, { label: 'Discount', key: 'discount' },
        { label: 'Tax', key: 'tax_amount' }, { label: 'Total', key: 'total' }, { label: 'Refunded', key: 'refund_amount' }, { label: 'Coupon', key: 'coupon_code' },
        { label: 'Courier', key: 'courier' }, { label: 'Tracking no.', key: 'tracking_number' }, { label: 'Invoice no.', key: 'invoice_number' }
      ]);
      ZA.csv.download('zari-orders-' + new Date().toISOString().slice(0, 10) + '.csv', csv);
      ZA.logEvent('orders_exported', { count: rows.length, filters: table.state.filters });
      ZA.ok('Exported ' + rows.length + ' orders');
    }).catch(ZA.fail).then(function () { ZA.busy(b, false); });
  };

  /* ---------- Detail ---------- */
  function renderDetail(id, el) {
    ZA.setPage('Order', [['Sales'], ['Orders', '#/orders']]);
    Promise.all([
      ZA.q(ZA.db.from('orders').select('*, order_items(*), payments(*), shipments(*)').eq('id', id).maybeSingle()),
      ZA.q(ZA.db.from('order_status_history').select('*').eq('order_id', id).order('created_at', { ascending: false }))
    ]).then(function (r) {
      var o = r[0], history = r[1];
      if (!o) { el.innerHTML = '<div class="card"><div class="empty"><strong>Order not found</strong></div></div>'; return; }
      var closed = o.status === 'cancelled' || o.status === 'returned';
      var addr = o.shipping_address || {};
      var actorIds = history.map(function (h) { return h.changed_by; }).filter(Boolean);
      ZA.setPage('Order #' + o.order_number, [['Sales'], ['Orders', '#/orders']],
        '<button class="btn btn-sm" data-action="order-invoice" data-id="' + o.id + '">Download invoice</button>' +
        (closed || o.status === 'delivered' ? '' : '<button class="btn btn-sm btn-danger" data-action="order-cancel" data-id="' + o.id + '">Cancel order</button>'));
      el.innerHTML = '<div class="cols"><div>' +
        '<div class="card"><div class="card-head"><h3>Items</h3><span class="small muted">Placed ' + ZA.dateTime(o.created_at) + '</span></div><div class="table-wrap"><table class="data responsive"><thead><tr><th>Product</th><th>Variant</th><th class="right">Price</th><th class="right">Qty</th><th class="right">Total</th></tr></thead><tbody>' +
        (o.order_items || []).map(function (it) {
          return '<tr><td data-label="Product">' + (it.product_id ? '<a class="cell-title" href="#/products/' + it.product_id + '">' + esc(it.name_snapshot) + '</a>' : esc(it.name_snapshot)) + '<div class="cell-sub mono">' + esc(it.sku_snapshot) + '</div></td>' +
            '<td data-label="Variant">' + esc([it.color_snapshot, it.size_snapshot].filter(Boolean).join(' · ') || '—') + '</td><td data-label="Price" class="right">' + ZA.money(it.price_snapshot) + '</td><td data-label="Qty" class="right">' + it.qty + '</td><td data-label="Total" class="right">' + ZA.money(it.price_snapshot * it.qty) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="card-body"><dl class="kv" style="max-width:360px;margin-left:auto;">' +
        '<dt>Subtotal</dt><dd class="right">' + ZA.money(o.subtotal) + '</dd>' +
        (Number(o.discount) ? '<dt>Discount' + (o.coupon_code ? ' (' + esc(o.coupon_code) + ')' : '') + '</dt><dd class="right">− ' + ZA.money(o.discount) + '</dd>' : '') +
        '<dt>Shipping</dt><dd class="right">' + (Number(o.shipping_fee) ? ZA.money(o.shipping_fee) : 'Free') + '</dd>' +
        (Number(o.tax_amount) ? '<dt>Tax (incl.)</dt><dd class="right">' + ZA.money(o.tax_amount) + '</dd>' : '') +
        '<dt><strong>Total</strong></dt><dd class="right"><strong>' + ZA.money(o.total) + '</strong></dd>' +
        (o.refund_amount ? '<dt>Refunded</dt><dd class="right">− ' + ZA.money(o.refund_amount) + '</dd>' : '') +
        '</dl></div></div>' +
        '<div class="card"><div class="card-head"><h3>Timeline</h3></div><div class="card-body">' +
        '<form id="noteForm" class="row" style="margin-bottom:16px;flex-wrap:nowrap;"><input type="text" name="note" maxlength="1000" placeholder="Add an internal note (not shown to the customer)"><button class="btn btn-sm" type="submit">Add note</button></form>' +
        (history.length ? '<ul class="timeline">' + history.map(function (h) {
          var what = h.field === 'note' ? esc(h.note) : '<strong>' + esc(ZA.label(h.field)) + '</strong>: ' + esc(ZA.label(h.from_value || '—')) + ' → ' + esc(ZA.label(h.to_value || '—'));
          return '<li>' + what + '<div class="cell-sub">' + ZA.dateTime(h.created_at) + '<span data-actor="' + esc(h.changed_by || '') + '"></span></div></li>';
        }).join('') + '</ul>' : '<p class="muted small" style="margin:0;">No changes yet.</p>') +
        '<p class="cell-sub" style="margin-top:6px;">Order placed ' + ZA.dateTime(o.created_at) + '</p></div></div>' +
        '</div><div>' +
        // Status
        '<div class="card"><div class="card-head"><h3>Order status</h3>' + ZA.pill(o.status) + '</div><div class="card-body">' +
        (closed ? '<p class="muted small" style="margin:0;">This order is ' + esc(o.status) + (o.cancel_reason ? ' — ' + esc(o.cancel_reason) : '') + '. It can no longer change.</p>' :
          '<form id="statusForm" class="stack">' + ZA.f.select('status', 'Status', o.status, opts(STATUSES).filter(function (s) { return s[0] !== 'cancelled' && (s[0] !== 'returned' || o.status === 'delivered'); })) +
          '<button class="btn btn-primary btn-sm" type="submit" data-busy="Updating…">Update status</button></form>') + '</div></div>' +
        // Shipping
        '<div class="card"><div class="card-head"><h3>Shipping &amp; tracking</h3>' + ZA.pill(o.shipping_status) + '</div><div class="card-body"><form id="shipForm" class="stack">' +
        ZA.f.select('shipping_status', 'Shipping status', o.shipping_status, opts(SHIPPING)) +
        ZA.f.text('courier', 'Courier', o.courier, { max: 80, placeholder: 'e.g. Delhivery' }) +
        ZA.f.text('tracking_number', 'Tracking number', o.tracking_number, { max: 80 }) +
        ZA.f.text('tracking_url', 'Tracking link', o.tracking_url, { type: 'url', max: 500, placeholder: 'https://…' }) +
        '<button class="btn btn-sm" type="submit" data-busy="Saving…">Save shipping</button></form></div></div>' +
        // Payment / refund
        '<div class="card"><div class="card-head"><h3>Payment &amp; refund</h3>' + ZA.pill(o.payment_status) + '</div><div class="card-body stack">' +
        ((o.payments || []).length ? '<ul class="list" style="margin:-8px -18px 0;">' + o.payments.map(function (p) { return '<li><span>' + esc(ZA.label(p.provider)) + ' · ' + ZA.money(p.amount) + '<br><span class="cell-sub mono">' + esc(p.provider_payment_id || p.provider_order_id || '—') + '</span></span>' + ZA.pill(p.status) + '</li>'; }).join('') + '</ul>' : '<p class="small muted" style="margin:0;">No payment records yet. Payment status is set automatically by the payment gateway.</p>') +
        '<form id="refundForm" class="stack">' + ZA.f.select('refund_status', 'Refund status', o.refund_status, opts(REFUND)) +
        ZA.f.text('refund_amount', 'Refund amount', o.refund_amount, { type: 'number', min: 0, step: '0.01', prefix: '₹', hint: 'Record the amount refunded through the payment gateway.' }) +
        '<button class="btn btn-sm" type="submit" data-busy="Saving…">Save refund</button></form></div></div>' +
        // Customer
        '<div class="card"><div class="card-head"><h3>Customer</h3>' + (o.customer_id && ZA.can('customers') ? '<a class="link" href="#/customers/' + o.customer_id + '">Profile</a>' : '') + '</div><div class="card-body"><dl class="kv" style="grid-template-columns:90px 1fr;">' +
        '<dt>Name</dt><dd>' + esc(o.contact_name) + '</dd><dt>Phone</dt><dd><a href="tel:' + esc(o.contact_phone) + '">' + esc(o.contact_phone) + '</a></dd>' +
        (o.contact_email ? '<dt>Email</dt><dd><a href="mailto:' + esc(o.contact_email) + '">' + esc(o.contact_email) + '</a></dd>' : '') +
        '<dt>Ship to</dt><dd>' + esc([addr.full_name, addr.house, addr.street, addr.landmark, addr.city, addr.district, addr.state, addr.pincode].filter(Boolean).join(', ') || '—') + '</dd>' +
        (addr.phone && addr.phone !== o.contact_phone ? '<dt>Phone 2</dt><dd>' + esc(addr.phone) + '</dd>' : '') +
        '</dl></div></div>' +
        // Admin notes
        '<div class="card"><div class="card-head"><h3>Internal notes</h3></div><div class="card-body"><form id="adminNotesForm" class="stack">' +
        ZA.f.textarea('admin_notes', 'Notes', o.admin_notes, { rows: 3, max: 4000 }) + '<button class="btn btn-sm" type="submit" data-busy="Saving…">Save notes</button></form></div></div>' +
        '</div></div>';

      function patch(form, body, note, okMsg) {
        var btn = form.querySelector('[type=submit]');
        ZA.busy(btn, true);
        return ZA.rpc('admin_update_order', { p_order_id: o.id, p_patch: body, p_note: note || null }).then(function () { ZA.ok(okMsg || 'Order updated'); ZA.app.refreshBadges(); ZA.app.route(); })
          .catch(function (e) { ZA.busy(btn, false); ZA.fail(e); });
      }
      var sf = ZA.qs('#statusForm');
      if (sf) sf.addEventListener('submit', function (e) { e.preventDefault(); var v = ZA.readForm(sf); if (v.status === o.status) { ZA.toast('Status unchanged'); return; } patch(sf, { status: v.status }, null, 'Status changed to ' + ZA.label(v.status)); });
      var shf = ZA.qs('#shipForm');
      shf.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = ZA.readForm(shf);
        if (v.tracking_url && !ZA.isHttpUrl(v.tracking_url)) { ZA.fail('Tracking link must start with https://'); return; }
        patch(shf, v, null, 'Shipping details saved');
      });
      var rf = ZA.qs('#refundForm');
      rf.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = ZA.readForm(rf), body = { refund_status: v.refund_status, refund_amount: v.refund_amount == null ? '' : v.refund_amount };
        if (v.refund_amount != null && (v.refund_amount < 0 || v.refund_amount > Number(o.total))) { ZA.fail('Refund must be between 0 and the order total.'); return; }
        if (v.refund_status === 'refunded' && o.payment_status !== 'pending' && v.refund_amount > 0) body.payment_status = v.refund_amount >= Number(o.total) ? 'refunded' : 'partially_refunded';
        patch(rf, body, null, 'Refund details saved');
      });
      var nf = ZA.qs('#adminNotesForm');
      nf.addEventListener('submit', function (e) { e.preventDefault(); patch(nf, { admin_notes: ZA.readForm(nf).admin_notes }, null, 'Notes saved'); });
      var tf = ZA.qs('#noteForm');
      tf.addEventListener('submit', function (e) {
        e.preventDefault();
        var note = ZA.readForm(tf).note;
        if (!note) return;
        ZA.rpc('admin_update_order', { p_order_id: o.id, p_patch: {}, p_note: note }).then(function () { ZA.ok('Note added'); ZA.app.route(); }).catch(ZA.fail);
      });
      // Show who made each change (admin emails visible to admins with access).
      if (actorIds.length && ZA.can('activity')) {
        ZA.db.from('admins').select('id,email').in('id', actorIds).then(function (res) {
          (res.data || []).forEach(function (a) { ZA.qsa('[data-actor="' + a.id + '"]').forEach(function (s) { s.textContent = ' · ' + a.email; }); });
        });
      }
    }).catch(function (e) { el.innerHTML = '<div class="notice danger">' + esc(e.message) + '</div>'; });
  }

  ZA.actions['order-cancel'] = function (b) {
    ZA.confirm('Cancel this order? The customer can’t be charged again for it. If it was paid, the refund status becomes “Requested” — issue the refund in your payment gateway, then record it here.', {
      title: 'Cancel order', danger: true, confirmLabel: 'Cancel order',
      input: { label: 'Reason (kept in the order history)', required: true, multiline: true },
      checkbox: { label: 'Put the items back into stock', checked: true }
    }).then(function (res) {
      if (!res) return;
      ZA.rpc('admin_cancel_order', { p_order_id: b.getAttribute('data-id'), p_reason: res.value, p_restock: res.checked }).then(function () {
        ZA.ok('Order cancelled'); ZA.app.refreshBadges(); ZA.app.route();
      }).catch(ZA.fail);
    });
  };

  /* ---------- Invoice (printable; save as PDF from the print dialog) ---------- */
  ZA.actions['order-invoice'] = function (b) {
    var id = b.getAttribute('data-id');
    ZA.busy(b, true);
    Promise.all([
      ZA.rpc('admin_ensure_invoice_number', { p_order_id: id }),
      ZA.q(ZA.db.from('orders').select('*, order_items(*)').eq('id', id).single()),
      ZA.q(ZA.db.from('site_settings').select('key,value').in('key', ['store', 'contact', 'tax']))
    ]).then(function (r) {
      var invNo = r[0], o = r[1], s = {};
      r[2].forEach(function (x) { s[x.key] = x.value || {}; });
      var productIds = (o.order_items || []).map(function (i) { return i.product_id; }).filter(Boolean);
      return (productIds.length ? ZA.q(ZA.db.from('products').select('id,hsn_code').in('id', productIds)) : Promise.resolve([])).then(function (prods) {
        var hsn = {}; prods.forEach(function (p) { hsn[p.id] = p.hsn_code; });
        var tax = s.tax || {}, store = s.store || {}, contact = s.contact || {}, addr = o.shipping_address || {};
        var rate = tax.enabled ? Number(tax.rate_percent || 0) : 0;
        var inclusive = tax.prices_include_tax !== false;
        var taxable = rate ? (inclusive ? (o.total - o.shipping_fee) / (1 + rate / 100) : (o.total - o.shipping_fee - (o.tax_amount || 0))) : 0;
        var taxAmt = rate ? (o.tax_amount && Number(o.tax_amount) > 0 ? Number(o.tax_amount) : (o.total - o.shipping_fee) - taxable) : 0;
        var html = '<!doctype html><html><head><meta charset="utf-8"><title>Invoice ' + esc(invNo) + '</title><style>' +
          'body{font:13px/1.5 -apple-system,Segoe UI,sans-serif;color:#26201d;margin:32px;}h1{font:500 28px Georgia,serif;color:#3d1414;margin:0;}table{width:100%;border-collapse:collapse;margin-top:18px;}' +
          'th{text-align:left;border-bottom:1px solid #3d1414;font-size:11px;text-transform:uppercase;letter-spacing:.08em;padding:6px;}td{padding:6px;border-bottom:1px solid #e8ddcb;}.r{text-align:right;}' +
          '.top{display:flex;justify-content:space-between;gap:24px;}.muted{color:#6b5f57;}.tot td{border:none;padding:3px 6px;}.tot tr:last-child td{font-weight:700;font-size:15px;border-top:1px solid #3d1414;}' +
          '@media print{body{margin:12mm;}}</style></head><body>' +
          '<div class="top"><div><h1>' + esc(store.name || 'Zari') + '</h1><div class="muted">' + esc(contact.address || '') + '</div>' +
          (contact.phone ? '<div class="muted">' + esc(contact.phone) + '</div>' : '') + (contact.email ? '<div class="muted">' + esc(contact.email) + '</div>' : '') +
          (tax.gstin ? '<div>GSTIN: <strong>' + esc(tax.gstin) + '</strong></div>' : '') + '</div>' +
          '<div style="text-align:right;"><h1 style="font-size:22px;">Tax Invoice</h1><div>Invoice no. <strong>' + esc(invNo) + '</strong></div><div>Order #' + esc(o.order_number) + '</div><div>Date ' + esc(ZA.date(o.created_at)) + '</div></div></div>' +
          '<div style="margin-top:20px;"><strong>Bill / ship to</strong><br>' + esc(o.contact_name) + '<br>' + esc([addr.house, addr.street, addr.landmark, addr.city, addr.district, addr.state, addr.pincode].filter(Boolean).join(', ')) + '<br>' + esc(o.contact_phone) + (o.contact_email ? ' · ' + esc(o.contact_email) : '') + '</div>' +
          '<table><thead><tr><th>Item</th><th>HSN</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead><tbody>' +
          (o.order_items || []).map(function (it) {
            return '<tr><td>' + esc(it.name_snapshot) + '<div class="muted">' + esc([it.sku_snapshot, it.color_snapshot, it.size_snapshot].filter(Boolean).join(' · ')) + '</div></td><td>' + esc(hsn[it.product_id] || tax.hsn_default || '') + '</td><td class="r">' + it.qty + '</td><td class="r">' + ZA.money(it.price_snapshot) + '</td><td class="r">' + ZA.money(it.price_snapshot * it.qty) + '</td></tr>';
          }).join('') + '</tbody></table>' +
          '<table class="tot" style="width:320px;margin-left:auto;"><tr><td>Subtotal</td><td class="r">' + ZA.money(o.subtotal) + '</td></tr>' +
          (Number(o.discount) ? '<tr><td>Discount' + (o.coupon_code ? ' (' + esc(o.coupon_code) + ')' : '') + '</td><td class="r">− ' + ZA.money(o.discount) + '</td></tr>' : '') +
          '<tr><td>Shipping</td><td class="r">' + ZA.money(o.shipping_fee) + '</td></tr>' +
          (rate ? '<tr><td class="muted">Taxable value</td><td class="r muted">' + ZA.money(Math.round(taxable * 100) / 100) + '</td></tr><tr><td class="muted">GST ' + rate + '% ' + (inclusive ? '(included)' : '') + '</td><td class="r muted">' + ZA.money(Math.round(taxAmt * 100) / 100) + '</td></tr>' : '') +
          '<tr><td>Total</td><td class="r">' + ZA.money(o.total) + '</td></tr></table>' +
          '<p class="muted" style="margin-top:28px;">Payment: ' + esc(ZA.label(o.payment_status)) + '. This is a computer-generated invoice.</p></body></html>';
        // Print from a hidden frame (no pop-up needed). "Save as PDF" in the print dialog downloads it.
        var old = ZA.qs('#invoiceFrame'); if (old) old.remove();
        var frame = document.createElement('iframe');
        frame.id = 'invoiceFrame'; frame.title = 'Invoice';
        frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
        frame.srcdoc = html;
        frame.addEventListener('load', function () { frame.contentWindow.focus(); frame.contentWindow.print(); });
        document.body.appendChild(frame);
        ZA.ok('Invoice ' + invNo + ' ready — choose “Save as PDF” to download');
        ZA.logEvent('invoice_downloaded', { order: o.order_number, invoice: invNo });
      });
    }).catch(ZA.fail).then(function () { ZA.busy(b, false); });
  };

  ZA.routes.orders = {
    perm: 'orders',
    render: function (params, el) { if (params[0]) renderDetail(params[0], el); else renderList(el); }
  };
})();
