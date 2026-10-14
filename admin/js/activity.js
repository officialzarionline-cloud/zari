/* =========================================================
   Zari Admin — activity log. Rows are written by database triggers on every
   admin change (and by sign-in/out/export events); they can't be edited or
   deleted by anyone through the API.
   ========================================================= */
(function () {
  var esc = ZA.esc;
  var ENTITIES = ['products', 'product_variants', 'product_images', 'product_categories', 'categories', 'banners', 'campaigns', 'coupons', 'orders',
    'customer_profiles', 'reviews', 'content_pages', 'faq_items', 'homepage_sections', 'site_settings', 'admins', 'admin_roles', 'session'];
  var table;

  function fmt(v) {
    if (v == null) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    var s = String(v);
    return s.length > 140 ? s.slice(0, 140) + '…' : s;
  }
  function changesHtml(a) {
    var c = a.changes || {};
    if (a.action === 'update') {
      return Object.keys(c).map(function (k) { return '<div><strong>' + esc(ZA.label(k)) + ':</strong> ' + esc(fmt(c[k].from)) + ' → ' + esc(fmt(c[k].to)) + '</div>'; }).join('');
    }
    return '<pre class="diff">' + esc(JSON.stringify(c, null, 2)) + '</pre>';
  }

  ZA.routes.activity = {
    perm: 'activity',
    render: function (params, el) {
      ZA.setPage('Activity log', [['Administration']]);
      el.innerHTML = '<div id="actTable"></div>';
      table = new ZA.DataTable({
        id: 'activity', el: ZA.qs('#actTable'), search: 'Search admin email or item', defaultSort: { col: 'created_at', asc: false }, pageSize: 50,
        filters: [
          { key: 'entity', label: 'Area', options: ENTITIES.map(function (e) { return [e, ZA.label(e)]; }) },
          { key: 'action', label: 'Action', options: [['insert', 'Created'], ['update', 'Updated'], ['delete', 'Deleted'], ['login', 'Signed in'], ['logout', 'Signed out'], ['orders_exported', 'Exported orders'], ['customers_exported', 'Exported customers']] },
          { key: 'period', label: 'When', options: [['1', 'Last 24 hours'], ['7', 'Last 7 days'], ['30', 'Last 30 days']] }
        ],
        columns: [
          { label: 'When', sort: 'created_at', cls: 'nowrap', render: function (a) { return ZA.dateTime(a.created_at); } },
          { label: 'Admin', render: function (a) { return esc(a.actor_email || 'System'); } },
          { label: 'Action', render: function (a) { return esc(ZA.activityVerb ? ZA.activityVerb(a) : a.action) + (a.summary && a.entity !== 'session' ? ' <strong>' + esc(a.summary) + '</strong>' : ''); } },
          { label: '', cls: 'actions', render: function (a) { return (a.changes && Object.keys(a.changes).length) ? '<button class="link" data-action="act-details" data-id="' + a.id + '">Details</button>' : ''; } }
        ],
        query: function (st) {
          var q = ZA.db.from('admin_activity_log').select('*', { count: 'exact' });
          if (st.filters.entity) q = q.eq('entity', st.filters.entity);
          if (st.filters.action) q = q.eq('action', st.filters.action);
          if (st.filters.period) q = q.gte('created_at', new Date(Date.now() - Number(st.filters.period) * 86400000).toISOString());
          return ZA.applyTableState(q, st, ['actor_email', 'summary', 'entity']).then(function (res) { var rows = ZA.unwrap(res); table && (table._rows = rows); return { rows: rows, total: res.count || 0 }; });
        },
        emptyTitle: 'No activity recorded'
      });
    }
  };
  ZA.actions['act-details'] = function (b) {
    var a = (table._rows || []).find(function (x) { return String(x.id) === b.getAttribute('data-id'); });
    if (!a) return;
    ZA.modal({ title: ZA.label(a.action) + ' · ' + ZA.label(a.entity), wide: true,
      body: '<dl class="kv"><dt>When</dt><dd>' + ZA.dateTime(a.created_at) + '</dd><dt>Admin</dt><dd>' + esc(a.actor_email || 'System') + '</dd><dt>Item</dt><dd>' + esc(a.summary || a.entity_id || '—') + '</dd></dl><div style="margin-top:14px;" class="small">' + changesHtml(a) + '</div>' });
  };
})();
