/* =========================================================
   Zari Admin — shell, navigation and router. Loaded last.
   Each module registers ZA.routes[key] = { perm, render(params, el) }.
   ========================================================= */
(function () {
  var esc = ZA.esc;
  var ICONS = {
    dashboard: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
    products: '<path d="M20 7l-8-4-8 4 8 4 8-4zM4 7v10l8 4 8-4V7M12 11v10"/>',
    categories: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    homepage: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    orders: '<path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
    customers: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-7 7-7s7 3 7 7M16 4a4 4 0 0 1 0 8M22 21c0-3-2-5.5-4.5-6.5"/>',
    coupons: '<path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6zM14 5v14"/>',
    reviews: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    marketing: '<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM17 8a5 5 0 0 1 0 8"/>',
    content: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    admins: '<path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>'
  };
  var NAV = [
    ['Overview', [['dashboard', 'Dashboard', 'dashboard', '#/']]],
    ['Catalogue', [['products', 'Products', 'products', '#/products'], ['categories', 'Categories', 'categories', '#/categories'], ['homepage', 'Homepage', 'homepage', '#/homepage']]],
    ['Sales', [['orders', 'Orders', 'orders', '#/orders'], ['customers', 'Customers', 'customers', '#/customers'], ['coupons', 'Coupons', 'marketing', '#/coupons'], ['reviews', 'Reviews', 'reviews', '#/reviews']]],
    ['Marketing & content', [['marketing', 'Banners & promotions', 'marketing', '#/marketing'], ['content', 'Pages & FAQ', 'content', '#/content']]],
    ['Administration', [['settings', 'Website settings', 'settings', '#/settings'], ['admins', 'Admin users', 'admins', '#/admins'], ['activity', 'Activity log', 'activity', '#/activity']]]
  ];

  ZA.app = {};
  var currentHash = location.hash;

  ZA.app.renderShell = function () {
    var me = ZA.me;
    ZA.qs('#sidebarNav').innerHTML = NAV.map(function (group) {
      var items = group[1].filter(function (it) { return ZA.can(it[2]); });
      if (!items.length) return '';
      return '<div class="nav-group">' + esc(group[0]) + '</div>' + items.map(function (it) {
        return '<a href="' + it[3] + '" data-nav="' + it[0] + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + ICONS[it[0]] + '</svg>' + esc(it[1]) +
          (it[0] === 'orders' ? '<span class="nav-badge hidden" id="navPendingOrders"></span>' : '') + '</a>';
      }).join('');
    }).join('');
    ZA.qs('#userName').textContent = me.full_name || me.email;
    ZA.qs('#userRole').textContent = me.role_name;
    ZA.qs('#userAvatar').textContent = ZA.initials(me.full_name || me.email);
    ZA.app.refreshBadges();
  };

  ZA.app.refreshBadges = function () {
    if (!ZA.can('orders')) return;
    ZA.db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending').then(function (res) {
      var b = ZA.qs('#navPendingOrders');
      if (!b || res.error) return;
      b.textContent = res.count; b.classList.toggle('hidden', !res.count);
    });
  };

  // Each view calls this to set the header.
  ZA.setPage = function (title, crumbs, actionsHtml) {
    ZA.qs('#pageTitle').textContent = title;
    document.title = title + ' · Zari Admin';
    ZA.qs('#pageCrumb').innerHTML = (crumbs || []).map(function (c) { return c[1] ? '<a href="' + c[1] + '">' + esc(c[0]) + '</a>' : esc(c[0]); }).join(' / ');
    ZA.qs('#topbarActions').innerHTML = actionsHtml || '';
  };

  function noAccess(el) {
    ZA.setPage('No access', []);
    el.innerHTML = '<div class="card"><div class="empty"><strong>You don’t have access to this section</strong>Ask a Super Admin to add it to your role.</div></div>';
  }

  ZA.app.route = function () {
    var hash = location.hash.replace(/^#\/?/, '');
    if (/access_token=|type=recovery|error_description=/.test(hash)) return; // auth redirect fragment, handled by supabase-js
    var parts = hash.split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
    var key = parts[0] || 'dashboard';
    var route = ZA.routes[key];
    var el = ZA.qs('#content');
    if (typeof ZA.cleanup === 'function') { try { ZA.cleanup(); } catch (e) {} }
    ZA.cleanup = null;
    ZA.dirty.set(false);
    ZA.qsa('#sidebarNav a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-nav') === key); });
    closeSidebar();
    window.scrollTo(0, 0);
    if (!route) { ZA.setPage('Not found', []); el.innerHTML = '<div class="card"><div class="empty"><strong>Page not found</strong><a href="#/">Go to dashboard</a></div></div>'; return; }
    if (route.perm && !ZA.can(route.perm)) { noAccess(el); return; }
    el.innerHTML = '<p class="muted"><span class="spinner"></span> Loading…</p>';
    try { route.render(parts.slice(1), el); }
    catch (err) { console.error(err); el.innerHTML = '<div class="notice danger">' + esc(err.message) + '</div>'; }
    el.focus({ preventScroll: true });
  };

  window.addEventListener('hashchange', function () {
    if (!ZA.me) return;
    if (ZA.dirty.on && !ZA.dirty.confirmLeave()) { history.replaceState(null, '', currentHash); return; }
    currentHash = location.hash;
    ZA.app.route();
  });
  ZA.go = function (hash) { if (location.hash === hash) ZA.app.route(); else location.hash = hash; };

  /* ---------- Mobile sidebar + user menu ---------- */
  function closeSidebar() { ZA.qs('#sidebar').classList.remove('open'); ZA.qs('#sidebarScrim').classList.remove('open'); }
  ZA.qs('#menuBtn').addEventListener('click', function () { ZA.qs('#sidebar').classList.add('open'); ZA.qs('#sidebarScrim').classList.add('open'); });
  ZA.qs('#sidebarScrim').addEventListener('click', closeSidebar);
  ZA.qs('#userBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    var pop = ZA.qs('#userPop'), open = pop.classList.toggle('hidden') === false;
    this.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.user-menu')) ZA.qs('#userPop').classList.add('hidden'); });
  ZA.qs('#logoutBtn').addEventListener('click', function () {
    if (ZA.dirty.on && !ZA.dirty.confirmLeave()) return;
    ZA.auth.logout();
  });

  ZA.app.start = function () {
    ZA.qs('#authScreen').classList.add('hidden');
    ZA.qs('#app').classList.remove('hidden');
    ZA.app.renderShell();
    ZA.auth.startIdleTimer();
    currentHash = location.hash;
    ZA.app.route();
  };

  /* ---------- Boot ---------- */
  function boot() {
    // Never render inside a frame (clickjacking). Hosting should also send
    // X-Frame-Options / frame-ancestors headers — see ADMIN_SETUP.md.
    if (window.top !== window.self) { document.body.innerHTML = ''; return; }
    if (!ZA.db || /YOUR-ZARI/.test(window.SUPABASE_ANON_KEY || '') || /YOUR-ZARI/.test(window.SUPABASE_URL || '')) {
      ZA.qs('#authScreen').classList.remove('hidden');
      ZA.qs('#authBox').innerHTML = '<p class="eyebrow">Zari Admin</p><h1>Connect the database</h1><p class="lede">The admin panel needs the store’s Supabase project. Set <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> in <code>supabase-client.js</code>, then reload. See <code>ADMIN_SETUP.md</code>.</p>';
      return;
    }
    var resetFlow = /[?&]reset=1/.test(location.search);
    ZA.db.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (resetFlow && session) { ZA.auth.showSetPassword(); return; }
      if (!session) { ZA.auth.showLogin(resetFlow ? 'This reset link is invalid or has expired. Request a new one.' : null, 'warn'); return; }
      ZA.auth.loadAdmin().then(function (me) {
        if (!me) { ZA.db.auth.signOut({ scope: 'local' }); ZA.auth.showLogin('This account does not have admin access.'); return; }
        ZA.app.start();
      });
    });
  }
  boot();
})();
