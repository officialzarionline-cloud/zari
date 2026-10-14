/* =========================================================
   Zari Admin — dashboard. Every number comes from admin_dashboard()
   (real rows, computed in the database). Nothing is estimated.
   ========================================================= */
(function () {
  var esc = ZA.esc;

  function kpi(label, value, sub, href, alert) {
    return '<' + (href ? 'a href="' + href + '"' : 'div') + ' class="kpi' + (alert ? ' alert' : '') + '"><div class="label">' + esc(label) + '</div><div class="value">' + value + '</div>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</' + (href ? 'a' : 'div') + '>';
  }

  // Daily paid revenue, last 30 days. Single series: no legend; hover/focus shows the value.
  function salesChart(days) {
    var W = 720, H = 220, padL = 52, padB = 26, padT = 10, padR = 8;
    var max = Math.max.apply(null, days.map(function (d) { return Number(d.revenue); }).concat([0]));
    var nice = max <= 0 ? 1000 : Math.pow(10, Math.floor(Math.log10(max))) * Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max))));
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var slot = plotW / days.length, bw = Math.max(2, slot - 2); // 2px gap between bars
    var ticks = [0, nice / 2, nice];
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Daily paid revenue for the last 30 days" preserveAspectRatio="none">';
    ticks.forEach(function (t) {
      var y = padT + plotH - (t / nice) * plotH;
      svg += '<line class="axis" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + (t >= 1000 ? '₹' + (t / 1000) + 'k' : '₹' + t) + '</text>';
    });
    days.forEach(function (d, i) {
      var v = Number(d.revenue), h = (v / nice) * plotH, x = padL + i * slot + 1, y = padT + plotH - h;
      var r = Math.min(4, h, bw / 2);
      var label = ZA.date(d.day) + ': ' + ZA.money(v) + ' · ' + d.orders + ' order' + (d.orders === 1 ? '' : 's');
      // Tall invisible hit target per day so tiny bars are still hoverable.
      svg += '<g tabindex="0" aria-label="' + esc(label) + '"><title>' + esc(label) + '</title>' +
        '<rect x="' + (padL + i * slot) + '" y="' + padT + '" width="' + slot + '" height="' + plotH + '" fill="transparent"/>' +
        (h > 0 ? '<path class="bar" d="M' + x + ' ' + (padT + plotH) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + bw - r) + 'Q' + (x + bw) + ' ' + y + ' ' + (x + bw) + ' ' + (y + r) + 'V' + (padT + plotH) + 'Z"/>' : '') +
        '</g>';
      if (i % 7 === 0 || i === days.length - 1) {
        svg += '<text x="' + (padL + i * slot + slot / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(new Date(d.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })) + '</text>';
      }
    });
    svg += '</svg>';
    var table = '<table class="sr-only"><caption>Daily paid revenue</caption><tr><th>Day</th><th>Revenue</th><th>Orders</th></tr>' +
      days.map(function (d) { return '<tr><td>' + esc(ZA.date(d.day)) + '</td><td>' + ZA.money(d.revenue) + '</td><td>' + d.orders + '</td></tr>'; }).join('') + '</table>';
    return svg + table;
  }

  ZA.routes.dashboard = {
    perm: 'dashboard',
    render: function (params, el) {
      ZA.setPage('Dashboard', [['Overview']], '<button class="btn btn-sm" data-action="dash-refresh">Refresh</button>');
      ZA.rpc('admin_dashboard').then(function (d) {
        var total30 = d.sales.reduce(function (s, x) { return s + Number(x.revenue); }, 0);
        var orders30 = d.sales.reduce(function (s, x) { return s + Number(x.orders); }, 0);
        el.innerHTML =
          '<div class="kpis">' +
          kpi('Total products', ZA.num(d.total_products), ZA.num(d.draft_products) + ' draft', ZA.can('products') ? '#/products' : '') +
          kpi('Active products', ZA.num(d.active_products), 'Visible on the store', ZA.can('products') ? '#/products' : '') +
          kpi('Out of stock', ZA.num(d.out_of_stock_products), 'Active &amp; priced, 0 stock', ZA.can('products') ? '#/products' : '', d.out_of_stock_products > 0) +
          kpi('Total customers', ZA.num(d.total_customers), '', ZA.can('customers') ? '#/customers' : '') +
          kpi('Total orders', ZA.num(d.total_orders), ZA.num(d.open_orders) + ' open', ZA.can('orders') ? '#/orders' : '') +
          kpi('Pending orders', ZA.num(d.pending_orders), 'Awaiting confirmation', ZA.can('orders') ? '#/orders' : '', d.pending_orders > 0) +
          kpi('Completed orders', ZA.num(d.completed_orders), 'Delivered', ZA.can('orders') ? '#/orders' : '') +
          kpi('Total revenue', ZA.money(d.total_revenue), 'Paid orders, net of refunds') +
          '</div>' +
          '<div class="cols"><div>' +
          '<div class="card"><div class="card-head"><h3>Sales overview · last 30 days</h3><div class="chart-legend"><span>Revenue <b>' + ZA.money(total30) + '</b></span><span>Orders <b>' + ZA.num(orders30) + '</b></span></div></div>' +
          '<div class="card-body">' + (orders30 ? salesChart(d.sales) : '<div class="empty"><strong>No sales yet</strong>Paid orders from the last 30 days will appear here.</div>') + '</div></div>' +
          '<div class="card"><div class="card-head"><h3>Recent orders</h3>' + (ZA.can('orders') ? '<a class="link" href="#/orders">All orders</a>' : '') + '</div>' +
          (d.recent_orders.length ? '<div class="table-wrap"><table class="data responsive"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th class="right">Total</th></tr></thead><tbody>' +
            d.recent_orders.map(function (o) {
              return '<tr><td data-label="Order">' + (ZA.can('orders') ? '<a class="cell-title" href="#/orders/' + o.id + '">#' + esc(o.order_number) + '</a>' : '#' + esc(o.order_number)) + '<div class="cell-sub">' + ZA.ago(o.created_at) + '</div></td>' +
                '<td data-label="Customer">' + esc(o.contact_name) + '</td><td data-label="Status">' + ZA.pill(o.status) + '</td><td data-label="Payment">' + ZA.pill(o.payment_status) + '</td><td data-label="Total" class="right">' + ZA.money(o.total) + '</td></tr>';
            }).join('') + '</tbody></table></div>' : '<div class="empty"><strong>No orders yet</strong>New orders show up here as soon as they’re placed.</div>') +
          '</div></div><div>' +
          '<div class="card"><div class="card-head"><h3>Low-stock alerts</h3></div>' +
          (d.low_stock.length ? '<ul class="list">' + d.low_stock.map(function (v) {
            return '<li><span><a class="cell-title" href="#/products/' + v.product_id + '">' + esc(v.name) + '</a><br><span class="cell-sub">' + esc([v.variant_sku, v.color, v.size].filter(Boolean).join(' · ')) + '</span></span>' +
              (v.stock === 0 ? ZA.pill('out', 'Out') : ZA.pill('low', v.stock + ' left')) + '</li>';
          }).join('') + '</ul>' : '<div class="empty small">No active product is at or below its low-stock level.</div>') + '</div>' +
          (ZA.can('activity') ? '<div class="card"><div class="card-head"><h3>Recent activity</h3><a class="link" href="#/activity">Activity log</a></div>' +
            (d.recent_activity.length ? '<ul class="list">' + d.recent_activity.map(function (a) {
              return '<li style="display:block;"><strong>' + esc(a.actor_email || 'System') + '</strong> <span class="muted">' + esc(activityVerb(a)) + '</span> ' + (a.entity === 'session' ? '' : esc(a.summary || '')) + '<div class="cell-sub">' + ZA.ago(a.created_at) + '</div></li>';
            }).join('') + '</ul>' : '<div class="empty small">No admin activity yet.</div>') + '</div>' : '') +
          '</div></div>';
      }).catch(function (err) { el.innerHTML = '<div class="notice danger">' + esc(err.message) + '</div>'; });
    }
  };
  ZA.actions['dash-refresh'] = function () { ZA.app.route(); ZA.app.refreshBadges(); };

  function activityVerb(a) {
    var what = ZA.label(String(a.entity || '').replace(/_/g, ' ')).replace(/s$/, '');
    if (a.entity === 'session') return ZA.label(a.action);
    return ({ insert: 'created ' + what, update: 'updated ' + what, delete: 'deleted ' + what })[a.action] || a.action;
  }
  ZA.activityVerb = activityVerb;
})();
