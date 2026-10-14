/* =========================================================
   Zari Admin — customers. Data comes from admin_customers() /
   admin_customer_detail() (customers permission checked in the database;
   emails come from Supabase Auth and are never exposed publicly).
   Phone numbers are masked in lists and shown in full only on the profile.
   Suspended customers can still sign in but can't place orders or reviews.
   ========================================================= */
(function () {
  var esc = ZA.esc;
  var table;

  function renderList(el) {
    ZA.setPage('Customers', [['Sales']], '<button class="btn btn-sm" data-action="customers-export">Export CSV</button>');
    el.innerHTML = '<div id="custTable"></div>';
    table = new ZA.DataTable({
      id: 'customers', el: ZA.qs('#custTable'), search: 'Name, email or phone',
      filters: [{ key: 'status', label: 'Status', options: [['active', 'Active'], ['suspended', 'Suspended']] }],
      columns: [
        { label: 'Customer', render: function (c) { return '<a class="cell-title" href="#/customers/' + c.id + '">' + esc(c.full_name || '(no name)') + '</a><div class="cell-sub">' + esc(c.email || '') + '</div>'; } },
        { label: 'Phone', render: function (c) { return c.phone ? '<span class="mono">' + esc(ZA.maskPhone(c.phone)) + '</span>' : ''; } },
        { label: 'Orders', render: function (c) { return ZA.num(c.order_count); } },
        { label: 'Spent', cls: 'nowrap', render: function (c) { return ZA.money(c.total_spent); } },
        { label: 'Last order', render: function (c) { return c.last_order_at ? ZA.ago(c.last_order_at) : ''; } },
        { label: 'Joined', render: function (c) { return ZA.date(c.created_at); } },
        { label: 'Status', render: function (c) { return ZA.pill(c.account_status); } },
        { label: '', cls: 'actions', render: function (c) { return '<a class="link" href="#/customers/' + c.id + '">View</a>'; } }
      ],
      query: function (st) {
        return ZA.rpc('admin_customers', { p_search: ZA.searchTerm(st.search) || null, p_status: st.filters.status || null, p_limit: st.pageSize, p_offset: (st.page - 1) * st.pageSize })
          .then(function (r) { return { rows: r.rows, total: r.total }; });
      },
      emptyTitle: 'No customers yet', emptyText: '<br>Customers appear here after they create an account.'
    });
  }

  ZA.actions['customers-export'] = function (b) {
    ZA.confirm('The export contains personal data (names, emails, phone numbers). Store it securely and delete it when you no longer need it.', { title: 'Export customers', confirmLabel: 'Export' }).then(function (ok) {
      if (!ok) return;
      ZA.busy(b, true);
      table.fetchAll(20000).then(function (rows) {
        var csv = ZA.csv.stringify(rows, [{ label: 'Name', key: 'full_name' }, { label: 'Email', key: 'email' }, { label: 'Phone', key: 'phone' }, { label: 'Status', key: 'account_status' },
          { label: 'Orders', key: 'order_count' }, { label: 'Total spent', key: 'total_spent' }, { label: 'Last order', key: 'last_order_at' }, { label: 'Joined', key: 'created_at' }]);
        ZA.csv.download('zari-customers-' + new Date().toISOString().slice(0, 10) + '.csv', csv);
        ZA.logEvent('customers_exported', { count: rows.length });
      }).catch(ZA.fail).then(function () { ZA.busy(b, false); });
    });
  };

  function renderDetail(id, el) {
    ZA.setPage('Customer', [['Sales'], ['Customers', '#/customers']]);
    ZA.rpc('admin_customer_detail', { p_id: id }).then(function (d) {
      var p = d.profile;
      if (!p) { el.innerHTML = '<div class="card"><div class="empty"><strong>Customer not found</strong></div></div>'; return; }
      var suspended = p.account_status === 'suspended';
      var spent = d.orders.filter(function (o) { return o.payment_status === 'paid'; }).reduce(function (s, o) { return s + Number(o.total); }, 0);
      ZA.setPage(p.full_name || p.email || 'Customer', [['Sales'], ['Customers', '#/customers']],
        '<button class="btn btn-sm ' + (suspended ? '' : 'btn-danger') + '" data-action="customer-status" data-id="' + p.id + '" data-to="' + (suspended ? 'active' : 'suspended') + '">' + (suspended ? 'Reactivate account' : 'Suspend account') + '</button>');
      el.innerHTML = (suspended ? '<div class="notice danger" style="margin-bottom:16px;">This account is suspended: the customer can’t place orders or write reviews.</div>' : '') +
        '<div class="kpis">' +
        '<div class="kpi"><div class="label">Orders</div><div class="value">' + d.orders.length + '</div></div>' +
        '<div class="kpi"><div class="label">Total spent</div><div class="value">' + ZA.money(spent) + '</div><div class="sub">Paid orders</div></div>' +
        '<div class="kpi"><div class="label">Wishlist</div><div class="value">' + d.wishlist_count + '</div><div class="sub">saved items</div></div>' +
        '<div class="kpi"><div class="label">Reviews</div><div class="value">' + d.reviews.length + '</div></div></div>' +
        '<div class="cols"><div>' +
        '<div class="card"><div class="card-head"><h3>Order history</h3></div>' + (d.orders.length ? '<div class="table-wrap"><table class="data responsive"><thead><tr><th>Order</th><th>Status</th><th>Payment</th><th class="right">Total</th></tr></thead><tbody>' +
          d.orders.map(function (o) {
            return '<tr><td data-label="Order">' + (ZA.can('orders') ? '<a class="cell-title" href="#/orders/' + o.id + '">#' + esc(o.order_number) + '</a>' : '#' + esc(o.order_number)) + '<div class="cell-sub">' + ZA.dateTime(o.created_at) + '</div></td>' +
              '<td data-label="Status">' + ZA.pill(o.status) + '</td><td data-label="Payment">' + ZA.pill(o.payment_status) + '</td><td data-label="Total" class="right">' + ZA.money(o.total) + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<div class="empty small">No orders yet.</div>') + '</div>' +
        '<div class="card"><div class="card-head"><h3>Reviews</h3></div>' + (d.reviews.length ? '<ul class="list">' + d.reviews.map(function (r) {
          return '<li><span>' + '★'.repeat(r.rating) + ' · ' + esc(r.product) + '<div class="cell-sub">' + ZA.date(r.created_at) + '</div></span>' + ZA.pill(r.status) + '</li>';
        }).join('') + '</ul>' : '<div class="empty small">No reviews.</div>') + '</div>' +
        '</div><div>' +
        '<div class="card"><div class="card-head"><h3>Profile</h3>' + ZA.pill(p.account_status) + '</div><div class="card-body"><dl class="kv" style="grid-template-columns:110px 1fr;">' +
        '<dt>Name</dt><dd>' + esc(p.full_name || '—') + '</dd><dt>Email</dt><dd>' + (p.email ? '<a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>' + (p.email_confirmed_at ? '' : ' <span class="pill warn">unverified</span>') : '—') + '</dd>' +
        '<dt>Phone</dt><dd>' + (p.phone ? '<a href="tel:' + esc(p.phone) + '">' + esc(p.phone) + '</a>' : '—') + '</dd>' +
        '<dt>Joined</dt><dd>' + ZA.date(p.created_at) + '</dd><dt>Last sign-in</dt><dd>' + (p.last_sign_in_at ? ZA.ago(p.last_sign_in_at) : '—') + '</dd></dl></div></div>' +
        '<div class="card"><div class="card-head"><h3>Addresses</h3></div>' + (d.addresses.length ? '<ul class="list">' + d.addresses.map(function (a) {
          return '<li style="display:block;"><strong>' + esc(a.label || a.full_name) + '</strong>' + (a.is_default ? ' <span class="pill">Default</span>' : '') + '<div class="small">' + esc([a.full_name, a.house, a.street, a.landmark, a.city, a.district, a.state, a.pincode].filter(Boolean).join(', ')) + '</div><div class="cell-sub">' + esc(a.phone) + '</div></li>';
        }).join('') + '</ul>' : '<div class="empty small">No saved addresses.</div>') + '</div>' +
        '</div></div>';
    }).catch(function (e) { el.innerHTML = '<div class="notice danger">' + esc(e.message) + '</div>'; });
  }

  ZA.actions['customer-status'] = function (b) {
    var to = b.getAttribute('data-to');
    ZA.confirm(to === 'suspended' ? 'Suspend this customer? They will be blocked from placing orders and writing reviews. Existing orders are not affected.' : 'Reactivate this customer’s account?', {
      title: to === 'suspended' ? 'Suspend account' : 'Reactivate account', danger: to === 'suspended', confirmLabel: to === 'suspended' ? 'Suspend' : 'Reactivate'
    }).then(function (ok) {
      if (!ok) return;
      ZA.rpc('admin_set_customer_status', { p_id: b.getAttribute('data-id'), p_status: to }).then(function () { ZA.ok(to === 'suspended' ? 'Account suspended' : 'Account reactivated'); ZA.app.route(); }).catch(ZA.fail);
    });
  };

  ZA.routes.customers = {
    perm: 'customers',
    render: function (params, el) { if (params[0]) renderDetail(params[0], el); else renderList(el); }
  };
})();
