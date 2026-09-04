/* =========================================================
   Zari — customer site logic.
   Architecture mirrors You & Me (SPA-in-one-page, hash router, Supabase for data,
   localStorage for guest cart/wishlist/recently-viewed) but is a fresh, independent
   codebase: no baby/kids logic, no shared data, no shared credentials.
   ========================================================= */

document.getElementById('footerYear').textContent = new Date().getFullYear();

/* ---------------------------------------------------------
   Helpers
   --------------------------------------------------------- */
function formatPrice(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function discountPercent(price, oldPrice) { return oldPrice ? Math.round((1 - price / oldPrice) * 100) : 0; }
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function slugify(s) { return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

function toast(msg) {
  var el = qs('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
}

function openOverlay(scrimAlso) {
  if (scrimAlso !== false) qs('#overlayScrim').classList.add('open');
}
function closeAllOverlays() {
  qs('#overlayScrim').classList.remove('open');
  qsa('.drawer.open, .modal-overlay.open, .bottom-sheet.open').forEach(function (el) { el.classList.remove('open'); });
  document.body.style.overflow = '';
}
qs('#overlayScrim').addEventListener('click', closeAllOverlays);

/* ---------------------------------------------------------
   Reveal-on-scroll
   --------------------------------------------------------- */
var revealObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-visible'); revealObserver.unobserve(e.target); } });
}, { threshold: 0.12 });
function observeReveal(root) { qsa('.reveal', root).forEach(function (el) { revealObserver.observe(el); }); }

/* ---------------------------------------------------------
   Cart (localStorage; guest cart merges into the same store after login —
   there is nothing server-side to migrate since it's all client-held)
   --------------------------------------------------------- */
var Cart = {
  KEY: 'zari_cart_v1',
  items: [],
  load: function () { try { this.items = JSON.parse(localStorage.getItem(this.KEY)) || []; } catch (e) { this.items = []; } },
  persist: function () { try { localStorage.setItem(this.KEY, JSON.stringify(this.items)); } catch (e) {} this.updateBadge(); },
  add: function (product, variant, qty) {
    qty = qty || 1;
    var variantId = variant ? variant.id : null;
    var existing = this.items.find(function (i) { return i.productId === product.id && i.variantId === variantId; });
    if (existing) { existing.qty += qty; }
    else {
      this.items.push({
        productId: product.id, variantId: variantId, name: product.name, sku: product.sku,
        image: product.images && product.images[0], price: product.price,
        color: variant ? variant.color : null, size: variant ? variant.size : null, qty: qty
      });
    }
    this.persist();
    toast('Added to bag');
    Cart.open();
  },
  remove: function (productId, variantId) {
    this.items = this.items.filter(function (i) { return !(i.productId === productId && i.variantId === variantId); });
    this.persist(); Cart.render();
  },
  setQty: function (productId, variantId, qty) {
    var it = this.items.find(function (i) { return i.productId === productId && i.variantId === variantId; });
    if (it) { it.qty = Math.max(1, qty); this.persist(); Cart.render(); }
  },
  subtotal: function () { return this.items.reduce(function (s, i) { return s + i.price * i.qty; }, 0); },
  count: function () { return this.items.reduce(function (s, i) { return s + i.qty; }, 0); },
  updateBadge: function () {
    var n = this.count();
    [qs('#cartCount'), qs('#mobileCartCount')].forEach(function (el) { if (!el) return; el.textContent = n; el.classList.toggle('hidden', n === 0); });
  },
  open: function () { Cart.render(); openOverlay(); qs('#cartDrawer').classList.add('open'); document.body.style.overflow = 'hidden'; },
  close: function () { qs('#cartDrawer').classList.remove('open'); closeAllOverlays(); },
  render: function () {
    var body = qs('#cartDrawerBody'), footer = qs('#cartDrawerFooter');
    if (!this.items.length) {
      body.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><p>Your bag is empty.</p></div>';
      footer.innerHTML = '<a href="#/sarees" class="btn btn-dark" data-link style="width:100%;justify-content:center;" onclick="Cart.close()">Continue Shopping</a>';
      return;
    }
    body.innerHTML = this.items.map(function (i) {
      return '<div class="cart-line">' +
        '<img src="' + escapeHtml(i.image || '') + '" onerror="this.style.visibility=\'hidden\'">' +
        '<div class="cart-line-info">' +
        '<p class="name">' + escapeHtml(i.name) + '</p>' +
        '<p class="meta">' + [i.color, i.size].filter(Boolean).map(escapeHtml).join(' &middot; ') + '</p>' +
        '<p class="price" style="margin:6px 0 0;">' + formatPrice(i.price) + '</p>' +
        '<div class="qty-stepper">' +
        '<button onclick="Cart.setQty(\'' + i.productId + '\',' + (i.variantId ? "'" + i.variantId + "'" : 'null') + ',' + (i.qty - 1) + ')">&minus;</button>' +
        '<span>' + i.qty + '</span>' +
        '<button onclick="Cart.setQty(\'' + i.productId + '\',' + (i.variantId ? "'" + i.variantId + "'" : 'null') + ',' + (i.qty + 1) + ')">+</button>' +
        '</div>' +
        '<div style="margin-top:8px;display:flex;gap:14px;">' +
        '<button class="link-btn" onclick="Cart.remove(\'' + i.productId + '\',' + (i.variantId ? "'" + i.variantId + "'" : 'null') + ')">Remove</button>' +
        '<button class="link-btn" onclick="Cart.saveForLater(\'' + i.productId + '\',' + (i.variantId ? "'" + i.variantId + "'" : 'null') + ')">Save for Later</button>' +
        '</div>' +
        '</div></div>';
    }).join('');
    footer.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:14px;font-weight:700;">' +
      '<span>Subtotal</span><span>' + formatPrice(this.subtotal()) + '</span></div>' +
      '<a href="#/cart" class="btn btn-ghost" data-link style="width:100%;justify-content:center;margin-bottom:8px;" onclick="Cart.close()">View Bag</a>' +
      '<a href="#/checkout" class="btn btn-dark" data-link style="width:100%;justify-content:center;" onclick="Cart.close()">Checkout</a>';
  },
  saveForLater: function (productId, variantId) {
    var it = this.items.find(function (i) { return i.productId === productId && i.variantId === variantId; });
    if (!it) return;
    Wishlist.add({ id: productId });
    this.remove(productId, variantId);
    toast('Moved to wishlist');
  }
};
Cart.load();

/* ---------------------------------------------------------
   Wishlist (localStorage for guest; syncs to Supabase table when logged in)
   --------------------------------------------------------- */
var Wishlist = {
  KEY: 'zari_wishlist_v1',
  ids: [],
  load: function () { try { this.ids = JSON.parse(localStorage.getItem(this.KEY)) || []; } catch (e) { this.ids = []; } },
  persist: function () { try { localStorage.setItem(this.KEY, JSON.stringify(this.ids)); } catch (e) {} this.updateBadge(); },
  has: function (id) { return this.ids.indexOf(id) !== -1; },
  toggle: function (id) {
    if (this.has(id)) { this.ids = this.ids.filter(function (x) { return x !== id; }); toast('Removed from wishlist'); }
    else { this.ids.push(id); toast('Added to wishlist'); }
    this.persist();
    if (Auth.user) {
      if (this.has(id)) supabaseClient.from('wishlist_items').upsert({ customer_id: Auth.user.id, product_id: id }, { onConflict: 'customer_id,product_id' }).then(function () {});
      else supabaseClient.from('wishlist_items').delete().eq('customer_id', Auth.user.id).eq('product_id', id).then(function () {});
    }
    qsa('[data-wishlist-id="' + id + '"]').forEach(function (btn) { btn.classList.toggle('active', Wishlist.has(id)); });
  },
  add: function (product) { if (!this.has(product.id)) this.toggle(product.id); },
  updateBadge: function () {
    var el = qs('#wishlistCount'); if (!el) return;
    el.textContent = this.ids.length; el.classList.toggle('hidden', this.ids.length === 0);
  }
};
Wishlist.load();

/* ---------------------------------------------------------
   Recently viewed
   --------------------------------------------------------- */
var RecentlyViewed = {
  KEY: 'zari_recently_viewed_v1',
  record: function (productId) {
    var list = this.get().filter(function (id) { return id !== productId; });
    list.unshift(productId);
    try { localStorage.setItem(this.KEY, JSON.stringify(list.slice(0, 12))); } catch (e) {}
  },
  get: function () { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch (e) { return []; } }
};

/* ---------------------------------------------------------
   Auth (Supabase)
   --------------------------------------------------------- */
var Auth = {
  user: null,
  init: function () {
    supabaseClient.auth.getSession().then(function (res) { Auth.user = res.data.session ? res.data.session.user : null; Auth.onChange(); });
    supabaseClient.auth.onAuthStateChange(function (event, session) { Auth.user = session ? session.user : null; Auth.onChange(); });
  },
  onChange: function () {
    if (Auth.user) Wishlist.mergeFromServer();
  },
  mergeFromServer: function () {
    supabaseClient.from('wishlist_items').select('product_id').eq('customer_id', Auth.user.id).then(function (res) {
      if (res.error) return;
      var serverIds = (res.data || []).map(function (r) { return r.product_id; });
      var merged = Array.from(new Set(serverIds.concat(Wishlist.ids)));
      var toInsert = merged.filter(function (id) { return serverIds.indexOf(id) === -1; });
      Wishlist.ids = merged; Wishlist.persist();
      if (toInsert.length) supabaseClient.from('wishlist_items').insert(toInsert.map(function (id) { return { customer_id: Auth.user.id, product_id: id }; })).then(function () {});
    });
  },
  login: function (email, password) { return supabaseClient.auth.signInWithPassword({ email: email, password: password }); },
  register: function (email, password, fullName) {
    return supabaseClient.auth.signUp({ email: email, password: password, options: { data: { full_name: fullName } } });
  },
  loginWithGoogle: function () { return supabaseClient.auth.signInWithOAuth({ provider: 'google' }); },
  resetPassword: function (email) { return supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname + '#/reset-password' }); },
  logout: function () { return supabaseClient.auth.signOut(); },
  friendlyError: function (err) {
    if (!err) return '';
    var m = err.message || String(err);
    if (/invalid login credentials/i.test(m)) return 'Incorrect email or password.';
    if (/already registered/i.test(m)) return 'An account with this email already exists.';
    if (/password.*(6|weak)/i.test(m)) return 'Password must be at least 6 characters.';
    return m;
  }
};

qs('#authModal').addEventListener('click', function (e) { if (e.target === this) closeAllOverlays(); });
function openAuthModal(mode) {
  renderAuthModal(mode || 'login');
  openOverlay(); qs('#authModal').classList.add('open'); document.body.style.overflow = 'hidden';
}
function renderAuthModal(mode) {
  var body = qs('#authModalBody');
  if (mode === 'login') {
    body.innerHTML =
      '<div style="padding:32px;">' +
      '<h3 class="display" style="margin:0 0 6px;">Welcome back</h3>' +
      '<p style="color:var(--ink-soft);font-size:13.5px;margin:0 0 22px;">Log in to continue.</p>' +
      '<button class="btn btn-ghost" style="width:100%;justify-content:center;margin-bottom:14px;" onclick="Auth.loginWithGoogle()">Continue with Google</button>' +
      '<div style="text-align:center;color:var(--ink-soft);font-size:12px;margin-bottom:14px;">or</div>' +
      '<form id="loginForm">' +
      '<div class="field"><label>Email</label><input type="email" required id="loginEmail"></div>' +
      '<div class="field"><label>Password</label><input type="password" required id="loginPassword"></div>' +
      '<div class="field-error hidden" id="loginError"></div>' +
      '<button class="btn btn-dark" style="width:100%;justify-content:center;" type="submit">Log In</button>' +
      '</form>' +
      '<p style="text-align:center;font-size:13px;margin-top:16px;"><a href="#" onclick="renderAuthModal(\'forgot\');return false;">Forgot password?</a></p>' +
      '<p style="text-align:center;font-size:13px;">New here? <a href="#" onclick="renderAuthModal(\'signup\');return false;">Create an account</a></p>' +
      '</div>';
    qs('#loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      Auth.login(qs('#loginEmail').value, qs('#loginPassword').value).then(function (res) {
        if (res.error) { qs('#loginError').textContent = Auth.friendlyError(res.error); qs('#loginError').classList.remove('hidden'); return; }
        closeAllOverlays(); toast('Welcome back'); Router.go(Router.pendingAfterLogin || '/account'); Router.pendingAfterLogin = null;
      });
    });
  } else if (mode === 'signup') {
    body.innerHTML =
      '<div style="padding:32px;">' +
      '<h3 class="display" style="margin:0 0 6px;">Create your account</h3>' +
      '<form id="signupForm">' +
      '<div class="field"><label>Full name</label><input type="text" required id="signupName"></div>' +
      '<div class="field"><label>Email</label><input type="email" required id="signupEmail"></div>' +
      '<div class="field"><label>Password</label><input type="password" required minlength="6" id="signupPassword"></div>' +
      '<div class="field-error hidden" id="signupError"></div>' +
      '<button class="btn btn-dark" style="width:100%;justify-content:center;" type="submit">Sign Up</button>' +
      '</form>' +
      '<p style="text-align:center;font-size:13px;margin-top:16px;">Already have an account? <a href="#" onclick="renderAuthModal(\'login\');return false;">Log in</a></p>' +
      '</div>';
    qs('#signupForm').addEventListener('submit', function (e) {
      e.preventDefault();
      Auth.register(qs('#signupEmail').value, qs('#signupPassword').value, qs('#signupName').value).then(function (res) {
        if (res.error) { qs('#signupError').textContent = Auth.friendlyError(res.error); qs('#signupError').classList.remove('hidden'); return; }
        closeAllOverlays(); toast('Account created'); Router.go(Router.pendingAfterLogin || '/account'); Router.pendingAfterLogin = null;
      });
    });
  } else if (mode === 'forgot') {
    body.innerHTML =
      '<div style="padding:32px;">' +
      '<h3 class="display" style="margin:0 0 6px;">Reset password</h3>' +
      '<form id="forgotForm">' +
      '<div class="field"><label>Email</label><input type="email" required id="forgotEmail"></div>' +
      '<button class="btn btn-dark" style="width:100%;justify-content:center;" type="submit">Send Reset Link</button>' +
      '</form>' +
      '<p style="text-align:center;font-size:13px;margin-top:16px;"><a href="#" onclick="renderAuthModal(\'login\');return false;">Back to login</a></p>' +
      '</div>';
    qs('#forgotForm').addEventListener('submit', function (e) {
      e.preventDefault();
      Auth.resetPassword(qs('#forgotEmail').value).then(function () {
        body.innerHTML = '<div style="padding:32px;text-align:center;"><h3 class="display">Check your email</h3><p style="color:var(--ink-soft);">We\'ve sent a reset link if that account exists.</p></div>';
      });
    });
  }
}

/* ---------------------------------------------------------
   Delivery location (PIN-based, no ugly native select)
   --------------------------------------------------------- */
var Location = {
  KEY: 'zari_delivery_location_v1',
  current: null,
  load: function () { try { this.current = JSON.parse(localStorage.getItem(this.KEY)); } catch (e) { this.current = null; } this.updateLabel(); },
  persist: function () { try { localStorage.setItem(this.KEY, JSON.stringify(this.current)); } catch (e) {} this.updateLabel(); },
  updateLabel: function () {
    var label = this.current ? (this.current.city || this.current.pincode) : 'your area';
    [qs('#deliveryPillLabel'), qs('#deliveryPillLabelMobile')].forEach(function (el) { if (el) el.textContent = label; });
  },
  open: function () {
    qs('#locationModalBody').innerHTML =
      '<div style="padding:28px;">' +
      '<h3 class="display" style="margin:0 0 18px;">Delivery Location</h3>' +
      '<button class="btn btn-ghost" style="width:100%;justify-content:center;margin-bottom:10px;" onclick="Location.useCurrentLocation()">Use My Current Location</button>' +
      '<div class="field" style="margin-top:16px;"><label>Enter PIN code</label>' +
      '<div style="display:flex;gap:8px;"><input type="text" id="pinInput" maxlength="6" placeholder="e.g. 400001">' +
      '<button class="btn btn-dark" onclick="Location.checkPin()">Check</button></div></div>' +
      '<div id="pinResult" style="margin-top:8px;font-size:13.5px;"></div>' +
      '<div id="savedAddressesForLocation" style="margin-top:20px;"></div>' +
      '</div>';
    if (Auth.user) {
      supabaseClient.from('addresses').select('*').eq('customer_id', Auth.user.id).then(function (res) {
        var list = res.data || [];
        if (!list.length) return;
        qs('#savedAddressesForLocation').innerHTML = '<h4 style="font-size:12.5px;text-transform:uppercase;color:var(--maroon-900);margin-bottom:10px;">Saved Addresses</h4>' +
          list.map(function (a) {
            return '<div class="filter-option" style="cursor:pointer;" onclick=\'Location.selectAddress(' + JSON.stringify(a).replace(/'/g, "&#39;") + ')\'>' +
              '<span>' + escapeHtml(a.label || a.city) + ' &mdash; ' + escapeHtml(a.pincode) + '</span></div>';
          }).join('');
      });
    }
    openOverlay(); qs('#locationModal').classList.add('open'); document.body.style.overflow = 'hidden';
  },
  selectAddress: function (a) { this.current = { city: a.city, pincode: a.pincode }; this.persist(); closeAllOverlays(); toast('Delivery location updated'); },
  useCurrentLocation: function () {
    if (!navigator.geolocation) { toast('Location not supported on this device'); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      supabaseClient.functions.invoke('reverse-geocode', { body: { lat: pos.coords.latitude, lng: pos.coords.longitude } }).then(function (res) {
        if (res.error || !res.data) { toast('Could not detect location'); return; }
        Location.current = res.data; Location.persist(); closeAllOverlays(); toast('Delivery location updated');
      });
    }, function () { toast('Location permission denied'); });
  },
  checkPin: function () {
    var pin = qs('#pinInput').value.trim();
    if (!/^\d{6}$/.test(pin)) { qs('#pinResult').innerHTML = '<span style="color:var(--danger);">Enter a valid 6-digit PIN.</span>'; return; }
    qs('#pinResult').textContent = 'Checking…';
    supabaseClient.functions.invoke('check-delivery', { body: { pincode: pin } }).then(function (res) {
      var ok = res.data && res.data.serviceable;
      qs('#pinResult').innerHTML = ok
        ? '<span style="color:var(--success);">Delivery available to ' + escapeHtml(pin) + '.</span>'
        : '<span style="color:var(--danger);">Currently unavailable at this PIN.</span>';
      if (ok) { Location.current = { pincode: pin, city: (res.data && res.data.city) || pin }; Location.persist(); }
    }).catch(function () { qs('#pinResult').innerHTML = '<span style="color:var(--danger);">Could not check right now.</span>'; });
  }
};
Location.load();
[qs('#deliveryPillBtn'), qs('#deliveryPillBtnMobile')].forEach(function (btn) { if (btn) btn.addEventListener('click', function () { Location.open(); }); });

/* ---------------------------------------------------------
   Search (Supabase full text across name/sku/fabric/occasion/etc.)
   --------------------------------------------------------- */
var Search = {
  KEY: 'zari_recent_searches_v1',
  getRecent: function () { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch (e) { return []; } },
  record: function (term) {
    var list = this.getRecent().filter(function (t) { return t.toLowerCase() !== term.toLowerCase(); });
    list.unshift(term);
    try { localStorage.setItem(this.KEY, JSON.stringify(list.slice(0, 8))); } catch (e) {}
  },
  clearRecent: function () { try { localStorage.removeItem(this.KEY); } catch (e) {} },
  run: function (term) {
    if (!term || !term.trim()) return;
    this.record(term.trim());
    closeAllOverlays();
    Router.go('/search?q=' + encodeURIComponent(term.trim()));
  },
  openMobile: function () {
    qs('#searchSheetBody').innerHTML =
      '<div style="display:flex;gap:10px;align-items:center;padding:16px;border-bottom:1px solid var(--line);">' +
      '<input type="text" id="searchSheetInput" placeholder="Search sarees, fabric, colour&hellip;" style="flex:1;border:1px solid var(--line);border-radius:999px;padding:10px 16px;" autofocus>' +
      '<button class="link-btn" onclick="closeAllOverlays()">Cancel</button></div>' +
      '<div style="padding:16px;" id="searchSheetResults"></div>';
    var recent = this.getRecent();
    if (recent.length) {
      qs('#searchSheetResults').innerHTML = '<h4 style="font-size:12px;text-transform:uppercase;color:var(--ink-soft);margin-bottom:10px;">Recent</h4>' +
        recent.map(function (t) { return '<div class="filter-option" style="cursor:pointer;" onclick="Search.run(\'' + escapeHtml(t).replace(/'/g, "\\'") + '\')">' + escapeHtml(t) + '</div>'; }).join('');
    }
    qs('#searchSheetInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') Search.run(this.value); });
    openOverlay(); qs('#searchSheet').classList.add('open'); document.body.style.overflow = 'hidden';
  }
};
['#headerSearchInput', '#headerSearchInputMobile'].forEach(function (sel) {
  var el = qs(sel); if (!el) return;
  el.addEventListener('focus', function () { if (window.innerWidth <= 900) { Search.openMobile(); this.blur(); } });
  el.addEventListener('keydown', function (e) { if (e.key === 'Enter') Search.run(this.value); });
});

/* ---------------------------------------------------------
   Data layer (Supabase queries)
   --------------------------------------------------------- */
var Data = {
  // Every method below swallows fetch/network failures (e.g. Supabase not configured
  // yet, offline, RLS misconfigured) into a safe empty default instead of leaving
  // callers hanging on a rejected promise — renderers distinguish "loaded, nothing
  // there" from "couldn't load" via the `error` flag where present. See spec §67.
  categoriesCache: null,
  getCategories: function (kind) {
    var self = this;
    var p = this.categoriesCache ? Promise.resolve(this.categoriesCache) : supabaseClient.from('categories').select('*').order('sort_order').then(function (res) { self.categoriesCache = res.data || []; return self.categoriesCache; }).catch(function () { return []; });
    return p.then(function (all) { return kind ? all.filter(function (c) { return c.kind === kind; }) : all; });
  },
  listProducts: function (filters) {
    filters = filters || {};
    var query = supabaseClient.from('products').select(PRODUCT_SELECT, { count: 'exact' }).eq('status', 'active');
    if (filters.categorySlug) query = query.eq('product_categories.categories.slug', filters.categorySlug);
    if (filters.featured) query = query.eq('featured', true);
    if (filters.newArrival) query = query.eq('new_arrival', true);
    if (filters.fabric) query = query.eq('fabric', filters.fabric);
    if (filters.occasion) query = query.eq('occasion', filters.occasion);
    if (filters.minPrice) query = query.gte('price', filters.minPrice);
    if (filters.maxPrice) query = query.lte('price', filters.maxPrice);
    if (filters.search) {
      var t = filters.search.replace(/[%]/g, '');
      query = query.or(['name.ilike.%' + t + '%', 'sku.ilike.%' + t + '%', 'fabric.ilike.%' + t + '%', 'occasion.ilike.%' + t + '%', 'weave.ilike.%' + t + '%', 'description.ilike.%' + t + '%'].join(','));
    }
    if (filters.sort === 'price-asc') query = query.order('price', { ascending: true });
    else if (filters.sort === 'price-desc') query = query.order('price', { ascending: false });
    else query = query.order('created_at', { ascending: false });
    if (filters.limit) query = query.limit(filters.limit);
    return query.then(function (res) { return { products: (res.data || []).map(mapSupabaseProduct), count: res.count || 0, error: res.error }; })
      .catch(function (err) { return { products: [], count: 0, error: err }; });
  },
  getProductBySlug: function (slug) {
    return supabaseClient.from('products').select(PRODUCT_SELECT).eq('slug', slug).eq('status', 'active').maybeSingle()
      .then(function (res) { return res.data ? mapSupabaseProduct(res.data) : null; })
      .catch(function () { return null; });
  },
  getProductsByIds: function (ids) {
    if (!ids.length) return Promise.resolve([]);
    return supabaseClient.from('products').select(PRODUCT_SELECT).in('id', ids).eq('status', 'active')
      .then(function (res) { return (res.data || []).map(mapSupabaseProduct); })
      .catch(function () { return []; });
  },
  getLiveCampaign: function () {
    return supabaseClient.from('campaigns').select('*').eq('status', 'live').limit(1).maybeSingle().then(function (res) { return res.data; }).catch(function () { return null; });
  },
  getApprovedReviews: function (limit) {
    return supabaseClient.from('reviews').select('*, products(name)').eq('status', 'approved').order('created_at', { ascending: false }).limit(limit || 6)
      .then(function (res) { return res.data || []; })
      .catch(function () { return []; });
  },
  // Banners already come back RLS-filtered to "enabled and within schedule" for a
  // non-admin session (see supabase/migrations/0002_banners_and_product_flags.sql),
  // so no date-window filtering needs to happen here.
  getActiveBanners: function () {
    return supabaseClient.from('banners').select('*').order('priority', { ascending: false })
      .then(function (res) { return res.data || []; })
      .catch(function () { return []; });
  },
  listOnSale: function (limit) {
    return supabaseClient.from('products').select(PRODUCT_SELECT).eq('status', 'active').eq('on_sale', true).order('created_at', { ascending: false }).limit(limit || 8)
      .then(function (res) { return { products: (res.data || []).map(mapSupabaseProduct), error: res.error }; })
      .catch(function (err) { return { products: [], error: err }; });
  },
  // Real "best sellers" — ranked by units actually sold (paid orders only), never a
  // guess. Hidden on the homepage entirely until there's real order history.
  getBestSellers: function (limit) {
    return supabaseClient.from('order_items').select('product_id, qty, orders!inner(payment_status)').eq('orders.payment_status', 'paid')
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) return { products: [], error: res.error };
        var totals = {};
        res.data.forEach(function (row) { totals[row.product_id] = (totals[row.product_id] || 0) + row.qty; });
        var rankedIds = Object.keys(totals).sort(function (a, b) { return totals[b] - totals[a]; }).slice(0, limit || 8);
        return Data.getProductsByIds(rankedIds).then(function (products) {
          products.sort(function (a, b) { return rankedIds.indexOf(a.id) - rankedIds.indexOf(b.id); });
          return { products: products, error: null };
        });
      })
      .catch(function (err) { return { products: [], error: err }; });
  }
};

/* ---------------------------------------------------------
   Product card / grid rendering
   --------------------------------------------------------- */
function productCardHtml(p) {
  var img1 = p.images[0] || '';
  var img2 = p.images[1] || img1;
  var disc = discountPercent(p.price, p.oldPrice);
  var outOfStock = p.stock <= 0;
  return '<div class="product-card reveal">' +
    '<a href="#/product/' + p.slug + '" data-link>' +
    '<div class="product-media">' +
    '<div class="product-badges">' +
    (p.newArrival ? '<span class="badge badge-new">New</span>' : '') +
    (disc > 0 ? '<span class="badge badge-sale">' + disc + '% Off</span>' : '') +
    (outOfStock ? '<span class="badge badge-oos">Out of Stock</span>' : '') +
    '</div>' +
    '<img class="img-main" src="' + escapeHtml(img1) + '" alt="' + escapeHtml(p.name) + '" loading="lazy">' +
    (img2 !== img1 ? '<img class="img-alt" src="' + escapeHtml(img2) + '" alt="" loading="lazy">' : '') +
    '</div></a>' +
    '<button class="wishlist-toggle ' + (Wishlist.has(p.id) ? 'active' : '') + '" data-wishlist-id="' + p.id + '" onclick="Wishlist.toggle(\'' + p.id + '\')" style="top:10px;right:10px;position:absolute;">' +
    '<svg viewBox="0 0 24 24" fill="' + (Wishlist.has(p.id) ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.7-10-9.3C.5 8 2.3 4 6.3 4c2 0 3.6 1.1 4.7 2.8C12.1 5.1 13.7 4 15.7 4c4 0 5.8 4 4.3 7.7-2.5 4.6-10 9.3-10 9.3z"/></svg></button>' +
    '<div class="quick-actions">' +
    '<button onclick="openQuickView(\'' + p.slug + '\')">Quick View</button>' +
    (p.readyToWear && !outOfStock ? '<button class="primary" onclick="Cart.add(' + JSON.stringify(p).replace(/'/g, "&#39;") + ', ' + (p.variants[0] ? JSON.stringify(p.variants[0]).replace(/'/g, "&#39;") : 'null') + ')">Quick Add</button>' :
      '<button class="primary" onclick="openQuickView(\'' + p.slug + '\')">' + (outOfStock ? 'Notify Me' : 'Select Options') + '</button>') +
    '</div>' +
    '<div class="product-info">' +
    '<p class="name">' + escapeHtml(p.name) + '</p>' +
    '<div class="price-row"><span class="price">' + formatPrice(p.price) + '</span>' +
    (p.oldPrice ? '<span class="price-old">' + formatPrice(p.oldPrice) + '</span><span class="discount">' + disc + '% off</span>' : '') +
    '</div>' +
    (p.colors.length > 1 ? '<div class="swatches">' + p.colors.map(function (c) { return '<span class="swatch" style="background:' + escapeHtml(c.hex || '#ccc') + '" title="' + escapeHtml(c.name) + '"></span>'; }).join('') + '</div>' : '') +
    '</div></div>';
}

function renderGridInto(sel, products, emptyMsg, isError) {
  var el = qs(sel); if (!el) return;
  if (!products.length) { el.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">' + (isError ? 'Couldn’t load products right now — please try again shortly.' : (emptyMsg || 'No products yet — check back soon.')) + '</div>'; return; }
  el.innerHTML = products.map(productCardHtml).join('');
  observeReveal(el);
}
function renderSkeletonGrid(sel, count) {
  var el = qs(sel); if (!el) return;
  el.innerHTML = new Array(count || 4).fill('<div class="skeleton-card"><div class="skeleton skeleton-media"></div><div class="skeleton skeleton-line" style="width:70%"></div><div class="skeleton skeleton-line" style="width:40%"></div></div>').join('');
}

/* ---------------------------------------------------------
   Hero banner carousel — admin-managed via /admin/banners. Falls back to the
   static default hero markup already in index.html when no banner is active.
   --------------------------------------------------------- */
var HeroBanner = {
  banners: [], index: 0, timer: null, defaultHtml: null,
  load: function () {
    var hero = qs('#homeHero');
    if (this.defaultHtml == null) this.defaultHtml = qs('#heroContent').innerHTML;
    Data.getActiveBanners().then(function (banners) {
      HeroBanner.banners = banners;
      HeroBanner.index = 0;
      clearInterval(HeroBanner.timer);
      if (!banners.length) {
        hero.classList.remove('has-banner-image');
        hero.style.backgroundImage = '';
        qs('#heroContent').innerHTML = HeroBanner.defaultHtml;
        qs('#heroDots').innerHTML = '';
        return;
      }
      HeroBanner.render();
      if (banners.length > 1) {
        HeroBanner.timer = setInterval(function () { HeroBanner.go((HeroBanner.index + 1) % HeroBanner.banners.length); }, 5500);
      }
    });
  },
  go: function (i) { this.index = i; this.render(); },
  render: function () {
    var b = this.banners[this.index];
    var hero = qs('#homeHero');
    hero.classList.add('has-banner-image');
    hero.style.backgroundImage = 'linear-gradient(180deg, rgba(31,10,10,.15), rgba(31,10,10,.55)), url("' + b.image_url.replace(/"/g, '') + '")';
    qs('#heroContent').innerHTML =
      (b.offer_text ? '<span class="hero-offer-badge">' + escapeHtml(b.offer_text) + '</span><br>' : '') +
      '<div class="eyebrow">' + escapeHtml(b.subtitle ? '' : 'The Zari Edit') + '</div>' +
      '<h1>' + escapeHtml(b.title) + '</h1>' +
      (b.subtitle ? '<p>' + escapeHtml(b.subtitle) + '</p>' : '') +
      '<div style="display:flex;gap:14px;flex-wrap:wrap;">' +
      '<a href="' + escapeHtml(b.cta_link || '#/sarees') + '" class="btn btn-primary" ' + (String(b.cta_link || '').indexOf('#/') === 0 ? 'data-link' : 'target="_blank" rel="noopener"') + '>' + escapeHtml(b.cta_text || 'Shop Now') + '</a>' +
      '</div>';
    qs('#heroDots').innerHTML = this.banners.length > 1 ? this.banners.map(function (bn, i) {
      return '<button class="' + (i === HeroBanner.index ? 'active' : '') + '" onclick="HeroBanner.go(' + i + ')" aria-label="Show banner ' + (i + 1) + '"></button>';
    }).join('') : '';
  }
};

/* ---------------------------------------------------------
   Home view
   --------------------------------------------------------- */
function renderHome() {
  renderSkeletonGrid('#newArrivalsGrid', 4);
  renderSkeletonGrid('#featuredGrid', 4);
  renderSkeletonGrid('#moreStylesGrid', 4);
  HeroBanner.load();

  Data.getCategories('saree_type').then(function (cats) {
    var wrap = qs('#quickCategories');
    if (!cats.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = cats.slice(0, 6).map(function (c) {
      return '<a href="#/sarees?type=' + c.slug + '" class="quick-cat" data-link><div class="thumb"><img src="assets/category-placeholder.jpg" onerror="this.parentElement.style.background=\'var(--cream-300)\'" alt=""></div><span>' + escapeHtml(c.name) + '</span></a>';
    }).join('');
    var chipsWrap = qs('#shopByTypeChips');
    chipsWrap.innerHTML = cats.map(function (c) { return '<a href="#/sarees?type=' + c.slug + '" class="chip" data-link>' + escapeHtml(c.name) + '</a>'; }).join('');
  });

  Data.getCategories('fabric').then(function (cats) {
    var wrap = qs('#shopByFabricChips');
    document.getElementById('sectionShopByFabric').style.display = cats.length ? '' : 'none';
    wrap.innerHTML = cats.map(function (c) { return '<a href="#/sarees?fabric=' + c.slug + '" class="chip" data-link>' + escapeHtml(c.name) + '</a>'; }).join('');
  });

  Data.getCategories('occasion').then(function (cats) {
    var wrap = qs('#shopByOccasionChips');
    document.getElementById('sectionShopByOccasion').style.display = cats.length ? '' : 'none';
    wrap.innerHTML = cats.map(function (c) { return '<a href="#/sarees?occasion=' + c.slug + '" class="chip" data-link>' + escapeHtml(c.name) + '</a>'; }).join('');
  });

  Data.listProducts({ newArrival: true, limit: 8 }).then(function (r) { renderGridInto('#newArrivalsGrid', r.products, 'New arrivals will appear here soon.', !!r.error); });
  Data.listProducts({ featured: true, limit: 8 }).then(function (r) {
    document.getElementById('sectionFeaturedCollection').style.display = (r.products.length || r.error) ? '' : 'none';
    renderGridInto('#featuredGrid', r.products, 'Featured picks are on the way.', !!r.error);
  });
  Data.listProducts({ limit: 8 }).then(function (r) { renderGridInto('#moreStylesGrid', r.products, 'Our collection is on its way.', !!r.error); });

  Data.getBestSellers(8).then(function (r) {
    document.getElementById('sectionBestSellers').style.display = (r.products.length || r.error) ? '' : 'none';
    renderGridInto('#bestSellersGrid', r.products, '', !!r.error);
  });
  Data.listOnSale(8).then(function (r) {
    document.getElementById('sectionOfferProducts').style.display = (r.products.length || r.error) ? '' : 'none';
    renderGridInto('#offerProductsGrid', r.products, '', !!r.error);
  });

  Data.getLiveCampaign().then(function (c) {
    var section = document.getElementById('sectionCampaign');
    if (!c) { section.style.display = 'none'; return; }
    section.style.display = '';
    qs('#campaignBanner').innerHTML = '<div class="hero" style="min-height:40vh;border-radius:var(--radius-lg);"><div class="hero-content"><div class="eyebrow">Live Now</div><h2 style="color:#fff;">' + escapeHtml(c.name) + '</h2></div></div>';
  });

  Data.getApprovedReviews(3).then(function (reviews) {
    document.getElementById('sectionReviews').style.display = reviews.length ? '' : 'none';
    qs('#reviewsGrid').innerHTML = reviews.map(function (r) {
      return '<div class="review-card"><div class="stars">' + '&#9733;'.repeat(r.rating) + '</div><p style="margin:12px 0;font-size:14px;">' + escapeHtml(r.review_text || '') + '</p><p style="font-size:12.5px;color:var(--ink-soft);">Verified purchase &middot; ' + escapeHtml((r.products && r.products.name) || '') + '</p></div>';
    }).join('');
  });

  observeReveal(document);
}

/* ---------------------------------------------------------
   Catalog view (sarees / new-arrivals / collections / occasions / search)
   --------------------------------------------------------- */
var CatalogState = { filters: {}, sort: 'new' };
function renderCatalog(routeParams, query) {
  var title = 'Sarees';
  var filters = {};
  if (query.q) { title = 'Search: "' + query.q + '"'; filters.search = query.q; }
  if (query.type) filters.categorySlug = query.type;
  if (query.fabric) filters.fabric = query.fabric;
  if (query.occasion) filters.occasion = query.occasion;
  if (routeParams === 'new-arrivals') { title = 'New Arrivals'; filters.newArrival = true; }
  filters.sort = CatalogState.sort;
  qs('#catalogTitle').textContent = title;
  renderSkeletonGrid('#catalogGrid', 8);
  renderFilterSidebar();

  Data.listProducts(filters).then(function (r) {
    renderGridInto('#catalogGrid', r.products, 'No products match yet.', !!r.error);
    qs('#catalogCount').textContent = r.count ? (r.count + ' piece' + (r.count === 1 ? '' : 's')) : '';
  });
}
function renderFilterSidebar() {
  Promise.all([Data.getCategories('saree_type'), Data.getCategories('fabric'), Data.getCategories('occasion')]).then(function (r) {
    var html =
      filterGroupHtml('Saree Type', r[0], 'type') +
      filterGroupHtml('Fabric', r[1], 'fabric') +
      filterGroupHtml('Occasion', r[2], 'occasion');
    qs('#filterSidebar').innerHTML = html || '<p style="color:var(--ink-soft);font-size:13px;">Filters will appear once categories are set up.</p>';
    qs('#filterSheetBody').innerHTML = html;
  });
}
function filterGroupHtml(label, cats, param) {
  if (!cats.length) return '';
  return '<div class="filter-group"><h4>' + label + '</h4>' + cats.map(function (c) {
    return '<label class="filter-option"><input type="checkbox" onchange="location.hash=\'#/sarees?' + param + '=' + c.slug + '\'"> ' + escapeHtml(c.name) + '</label>';
  }).join('') + '</div>';
}
qs('#sortSelect').addEventListener('change', function () { CatalogState.sort = this.value; Router.rerender(); });
qs('#openFilterSheet').addEventListener('click', function () { openOverlay(); qs('#filterSheet').classList.add('open'); document.body.style.overflow = 'hidden'; });
qs('#openSortSheet').addEventListener('click', function () {
  qs('#sortSheetBody').innerHTML = ['new:New Arrivals', 'price-asc:Price: Low to High', 'price-desc:Price: High to Low', 'discount:Discount'].map(function (o) {
    var parts = o.split(':'); return '<div class="filter-option" style="cursor:pointer;" onclick="CatalogState.sort=\'' + parts[0] + '\';Router.rerender();closeAllOverlays();">' + parts[1] + '</div>';
  }).join('');
  openOverlay(); qs('#sortSheet').classList.add('open'); document.body.style.overflow = 'hidden';
});

/* ---------------------------------------------------------
   Product detail view
   --------------------------------------------------------- */
var PDPState = { product: null, activeImage: 0, activeColor: null };
function renderProductDetail(slug) {
  qs('#pdpContainer').innerHTML = '<div class="skeleton skeleton-media" style="border-radius:var(--radius-md);"></div><div><div class="skeleton skeleton-line" style="width:60%;height:28px;"></div><div class="skeleton skeleton-line" style="width:30%;"></div></div>';
  Data.getProductBySlug(slug).then(function (p) {
    if (!p) { qs('#pdpContainer').innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Product not found.</div>'; return; }
    PDPState.product = p; PDPState.activeImage = 0; PDPState.activeColor = p.colors[0] ? p.colors[0].name : null;
    RecentlyViewed.record(p.id);
    document.title = p.name + ' | Zari';
    var disc = discountPercent(p.price, p.oldPrice);
    var outOfStock = p.stock <= 0;

    var details = [
      ['Fabric', p.fabric], ['Saree Length', p.sareeLengthM ? p.sareeLengthM + ' m' : null],
      ['Blouse Piece', p.blouseIncluded ? 'Included' : null], ['Blouse Length', p.blouseLengthM ? p.blouseLengthM + ' m' : null],
      ['Work / Weave', [p.workType, p.weave].filter(Boolean).join(', ') || null], ['Border', p.borderType],
      ['Occasion', p.occasion], ['Care Instructions', p.washCare], ['Country of Origin', p.countryOfOrigin], ['SKU', p.sku]
    ].filter(function (d) { return d[1]; });

    qs('#pdpContainer').innerHTML =
      '<div>' +
      '<div class="pdp-gallery-main"><img id="pdpMainImg" src="' + escapeHtml(p.images[0] || '') + '"></div>' +
      '<div class="pdp-thumbs">' + p.images.map(function (img, i) { return '<img src="' + escapeHtml(img) + '" class="' + (i === 0 ? 'active' : '') + '" onclick="setPdpImage(' + i + ')">'; }).join('') + '</div>' +
      '</div>' +
      '<div class="pdp-info">' +
      (p.newArrival ? '<span class="badge badge-new">New</span>' : '') +
      '<h1 class="name">' + escapeHtml(p.name) + '</h1>' +
      '<div class="price-row"><span class="price">' + formatPrice(p.price) + '</span> ' +
      (p.oldPrice ? '<span class="price-old">' + formatPrice(p.oldPrice) + '</span> <span class="discount">' + disc + '% off</span>' : '') + '</div>' +
      '<p class="sku">SKU: ' + escapeHtml(p.sku) + '</p>' +
      (p.colors.length ? '<div class="field"><label>Colour: ' + escapeHtml(PDPState.activeColor || '') + '</label><div class="swatches">' +
        p.colors.map(function (c) { return '<span class="swatch ' + (c.name === PDPState.activeColor ? 'active' : '') + '" style="width:26px;height:26px;background:' + escapeHtml(c.hex || '#ccc') + '" onclick="setPdpColor(\'' + escapeHtml(c.name) + '\')" title="' + escapeHtml(c.name) + '"></span>'; }).join('') + '</div></div>' : '') +
      '<div id="pdpDeliveryBlock" style="margin:18px 0;padding:14px;background:var(--cream-100);border-radius:var(--radius-sm);font-size:13px;">' +
      '<button class="link-btn" onclick="Location.open()">Check delivery to your PIN</button></div>' +
      '<div style="display:flex;gap:12px;margin-bottom:24px;">' +
      (outOfStock
        ? '<button class="btn btn-ghost" style="flex:1;justify-content:center;" onclick="openNotifyMe(\'' + p.id + '\')">Notify Me</button>'
        : '<button class="btn btn-dark" style="flex:1;justify-content:center;" onclick="addPdpToCart()">Add to Cart</button><button class="btn btn-primary" style="flex:1;justify-content:center;" onclick="addPdpToCart(true)">Buy Now</button>') +
      '</div>' +
      '<div id="pdpAccordion">' + details.map(function (d, i) { return accordionItemHtml(d[0], escapeHtml(String(d[1])), i === 0); }).join('') + '</div>' +
      '</div>';

    var stickyCta = qs('#pdpStickyCta');
    stickyCta.classList.add('show');
    stickyCta.innerHTML = '<div style="flex:1;"><div class="price">' + formatPrice(p.price) + '</div></div>' +
      (outOfStock ? '<button class="btn btn-ghost" onclick="openNotifyMe(\'' + p.id + '\')">Notify Me</button>' : '<button class="btn btn-dark" style="flex:1;" onclick="addPdpToCart()">Add to Cart</button>');

    // Similar styles
    var simFilters = { limit: 8 };
    if (p.fabric) simFilters.fabric = p.fabric;
    Data.listProducts(simFilters).then(function (r) {
      var sims = r.products.filter(function (x) { return x.id !== p.id; }).slice(0, 4);
      document.getElementById('sectionMoreStyles') && renderGridInto('#pdpSimilar', sims);
    });
    observeReveal(document);
  });
}
function accordionItemHtml(title, body, open) {
  return '<div class="accordion-item ' + (open ? 'open' : '') + '"><div class="accordion-head" onclick="this.parentElement.classList.toggle(\'open\')"><span>' + title + '</span><span class="accordion-icon" style="transition:transform .2s;">+</span></div><div class="accordion-body"><div class="inner">' + body + '</div></div></div>';
}
function setPdpImage(i) { PDPState.activeImage = i; qs('#pdpMainImg').src = PDPState.product.images[i]; qsa('.pdp-thumbs img').forEach(function (img, idx) { img.classList.toggle('active', idx === i); }); }
function setPdpColor(name) { PDPState.activeColor = name; renderProductDetail(PDPState.product.slug); }
function addPdpToCart(buyNow) {
  var p = PDPState.product;
  var variant = p.variants.find(function (v) { return v.color === PDPState.activeColor; }) || p.variants[0] || null;
  Cart.add(p, variant, 1);
  if (buyNow) Router.go('/checkout');
}
function openNotifyMe(productId) {
  var email = prompt('Enter your email and we’ll let you know when this is back in stock:');
  if (!email) return;
  supabaseClient.from('notify_me').insert({ product_id: productId, email: email }).then(function (res) {
    toast(res.error ? 'Could not save — try again' : 'We’ll notify you!');
  });
}

/* ---------------------------------------------------------
   Quick View modal
   --------------------------------------------------------- */
function openQuickView(slug) {
  qs('#quickViewBody').innerHTML = '<div style="padding:40px;"><div class="skeleton skeleton-line"></div></div>';
  openOverlay(); qs('#quickViewModal').classList.add('open'); document.body.style.overflow = 'hidden';
  Data.getProductBySlug(slug).then(function (p) {
    if (!p) return;
    var disc = discountPercent(p.price, p.oldPrice);
    qs('#quickViewBody').innerHTML = '<button class="modal-close" onclick="closeAllOverlays()">&times;</button>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">' +
      '<div class="product-media" style="aspect-ratio:auto;height:100%;"><img src="' + escapeHtml(p.images[0] || '') + '" style="width:100%;height:100%;object-fit:cover;"></div>' +
      '<div style="padding:32px;">' +
      '<h3 class="display">' + escapeHtml(p.name) + '</h3>' +
      '<div class="price-row"><span class="price">' + formatPrice(p.price) + '</span> ' + (p.oldPrice ? '<span class="price-old">' + formatPrice(p.oldPrice) + '</span><span class="discount"> ' + disc + '% off</span>' : '') + '</div>' +
      (p.fabric ? '<p style="color:var(--ink-soft);font-size:13.5px;margin:10px 0;">Fabric: ' + escapeHtml(p.fabric) + (p.blouseIncluded ? ' &middot; Blouse included' : '') + '</p>' : '') +
      '<p style="font-size:13px;color:' + (p.stock > 0 ? 'var(--success)' : 'var(--danger)') + ';margin-bottom:18px;">' + (p.stock > 0 ? 'In Stock' : 'Out of Stock') + '</p>' +
      '<div style="display:flex;gap:10px;">' +
      (p.stock > 0 ? '<button class="btn btn-dark" onclick="Cart.add(' + JSON.stringify(p).replace(/'/g, "&#39;") + ', ' + (p.variants[0] ? JSON.stringify(p.variants[0]).replace(/'/g, "&#39;") : 'null') + ');closeAllOverlays();">Add to Cart</button>' : '<button class="btn btn-ghost" onclick="openNotifyMe(\'' + p.id + '\')">Notify Me</button>') +
      '<a href="#/product/' + p.slug + '" class="btn btn-ghost" data-link onclick="closeAllOverlays()">View Full Details</a>' +
      '</div></div></div>';
  });
}

/* ---------------------------------------------------------
   Checkout (payment intentionally stubbed — see supabase/functions/cashfree-*)
   --------------------------------------------------------- */
function renderCheckout() {
  if (!Cart.items.length) { qs('#checkoutContainer').innerHTML = '<div class="empty-state">Your bag is empty. <a href="#/sarees" data-link>Continue shopping</a>.</div>'; return; }
  if (!Auth.user) {
    qs('#checkoutContainer').innerHTML = '<div class="empty-state"><p>Please log in to continue to checkout.</p><button class="btn btn-dark" onclick="Router.pendingAfterLogin=\'/checkout\';openAuthModal(\'login\')">Log In</button></div>';
    return;
  }
  qs('#checkoutContainer').innerHTML =
    '<form id="checkoutForm">' +
    '<h3 style="font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:var(--maroon-900);">Contact</h3>' +
    '<div class="field-row"><div class="field"><label>Full Name</label><input required id="ckName"></div><div class="field"><label>Mobile</label><input required id="ckPhone"></div></div>' +
    '<div class="field"><label>Email</label><input type="email" id="ckEmail" value="' + escapeHtml(Auth.user.email || '') + '"></div>' +
    '<h3 style="font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:var(--maroon-900);margin-top:24px;">Shipping Address</h3>' +
    '<div class="field"><label>House / Flat No.</label><input required id="ckHouse"></div>' +
    '<div class="field"><label>Street / Area</label><input required id="ckStreet"></div>' +
    '<div class="field"><label>Landmark (optional)</label><input id="ckLandmark"></div>' +
    '<div class="field-row"><div class="field"><label>City</label><input required id="ckCity"></div><div class="field"><label>State</label><input required id="ckState"></div></div>' +
    '<div class="field-row"><div class="field"><label>District</label><input id="ckDistrict"></div><div class="field"><label>PIN Code</label><input required maxlength="6" id="ckPincode"></div></div>' +
    '<div id="checkoutServiceabilityMsg" style="font-size:13px;margin-bottom:14px;"></div>' +
    '<div style="background:var(--cream-100);border-radius:var(--radius-sm);padding:16px;margin-bottom:20px;">' +
    '<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Subtotal</span><span>' + formatPrice(Cart.subtotal()) + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;font-weight:700;"><span>Total</span><span>' + formatPrice(Cart.subtotal()) + '</span></div>' +
    '</div>' +
    '<button class="btn btn-primary" type="submit" style="width:100%;justify-content:center;">Proceed to Payment</button>' +
    '<p style="font-size:11.5px;color:var(--ink-soft);text-align:center;margin-top:10px;">Payment via Cashfree is not yet configured for this store — see supabase/functions/cashfree-*.</p>' +
    '</form>';

  qs('#ckPincode').addEventListener('blur', function () {
    var pin = this.value.trim();
    if (!/^\d{6}$/.test(pin)) return;
    var msg = qs('#checkoutServiceabilityMsg');
    msg.textContent = 'Checking delivery to ' + pin + '…';
    supabaseClient.functions.invoke('check-delivery', { body: { pincode: pin } }).then(function (res) {
      var ok = res.data && res.data.serviceable;
      msg.innerHTML = ok ? '<span style="color:var(--success);">Delivery available.</span>' : '<span style="color:var(--danger);">This PIN is currently unserviceable. Please use a different address.</span>';
      qs('#checkoutForm button[type=submit]').disabled = !ok;
    }).catch(function () { msg.textContent = ''; });
  });

  qs('#checkoutForm').addEventListener('submit', function (e) {
    e.preventDefault();
    toast('Payment integration is not yet configured for Zari (Cashfree sandbox keys required).');
    // Real flow (once Cashfree creds exist): create a `pending` order row, then
    // supabaseClient.functions.invoke('cashfree-create-order', { body: {...} })
    // and redirect to the hosted checkout link it returns. Payment is only ever
    // confirmed server-side via the cashfree-webhook function — never from this callback.
  });
}

/* ---------------------------------------------------------
   Account
   --------------------------------------------------------- */
function renderAccount(sub) {
  if (!Auth.user) { qs('#accountContainer').innerHTML = ''; openAuthModal('login'); Router.pendingAfterLogin = '/account'; return; }
  var tabs = [['overview', 'Overview'], ['orders', 'My Orders'], ['addresses', 'Addresses'], ['wishlist', 'Wishlist'], ['profile', 'Profile']];
  sub = sub || 'overview';
  var nav = tabs.map(function (t) { return '<a href="#/account/' + t[0] + '" data-link class="chip ' + (t[0] === sub ? 'active' : '') + '" style="margin-right:8px;">' + t[1] + '</a>'; }).join('');
  var body = '<p>Loading&hellip;</p>';
  qs('#accountContainer').innerHTML = '<h2 class="display">My Account</h2><div style="margin:20px 0 30px;">' + nav + ' <button class="link-btn" onclick="Auth.logout().then(function(){Router.go(\'/\')})">Logout</button></div><div id="accountBody">' + body + '</div>';

  if (sub === 'orders') {
    supabaseClient.from('orders').select('*, order_items(*)').eq('customer_id', Auth.user.id).is('customer_hidden_at', null).order('created_at', { ascending: false }).then(function (res) {
      var orders = res.data || [];
      qs('#accountBody').innerHTML = orders.length ? orders.map(orderRowHtml).join('') : '<div class="empty-state">No orders yet.</div>';
    });
  } else if (sub === 'addresses') {
    supabaseClient.from('addresses').select('*').eq('customer_id', Auth.user.id).then(function (res) {
      var list = res.data || [];
      qs('#accountBody').innerHTML = (list.length ? list.map(function (a) {
        return '<div class="review-card" style="margin-bottom:12px;"><strong>' + escapeHtml(a.label || 'Address') + '</strong><p style="margin:6px 0 0;font-size:13.5px;color:var(--ink-soft);">' + [a.house, a.street, a.landmark, a.city, a.district, a.state, a.pincode].filter(Boolean).map(escapeHtml).join(', ') + '</p></div>';
      }).join('') : '<div class="empty-state">No saved addresses yet.</div>');
    });
  } else if (sub === 'wishlist') {
    Data.getProductsByIds(Wishlist.ids).then(function (products) { renderGridInto('#accountBody', products, 'Your wishlist is empty.'); qs('#accountBody').classList.add('product-grid'); });
  } else if (sub === 'profile') {
    supabaseClient.from('customer_profiles').select('*').eq('id', Auth.user.id).maybeSingle().then(function (res) {
      var prof = res.data || {};
      qs('#accountBody').innerHTML = '<form id="profileForm" style="max-width:420px;">' +
        '<div class="field"><label>Full Name</label><input id="profName" value="' + escapeHtml(prof.full_name || '') + '"></div>' +
        '<div class="field"><label>Phone</label><input id="profPhone" value="' + escapeHtml(prof.phone || '') + '"></div>' +
        '<div class="field"><label>Email</label><input value="' + escapeHtml(Auth.user.email || '') + '" disabled></div>' +
        '<button class="btn btn-dark" type="submit">Save</button></form>';
      qs('#profileForm').addEventListener('submit', function (e) {
        e.preventDefault();
        supabaseClient.from('customer_profiles').upsert({ id: Auth.user.id, full_name: qs('#profName').value, phone: qs('#profPhone').value }).then(function () { toast('Profile updated'); });
      });
    });
  } else {
    qs('#accountBody').innerHTML = '<p style="color:var(--ink-soft);">Welcome back, ' + escapeHtml(Auth.user.email) + '.</p>';
  }
}
function orderRowHtml(o) {
  var statusSteps = ['pending', 'confirmed', 'shipped', 'out_for_delivery', 'delivered'];
  var idx = statusSteps.indexOf(o.status);
  return '<div class="review-card" style="margin-bottom:14px;">' +
    '<div style="display:flex;justify-content:space-between;"><strong>#' + escapeHtml(o.order_number) + '</strong><span>' + formatPrice(o.total) + '</span></div>' +
    '<p style="font-size:12.5px;color:var(--ink-soft);margin:4px 0 12px;">' + new Date(o.created_at).toLocaleDateString() + ' &middot; ' + (o.order_items || []).length + ' item(s)</p>' +
    '<div style="font-size:12.5px;font-weight:700;color:var(--maroon-900);text-transform:capitalize;">' + o.status.replace(/_/g, ' ') + '</div>' +
    '</div>';
}

/* ---------------------------------------------------------
   Static pages
   --------------------------------------------------------- */
var STATIC_PAGES = {
  about: { title: 'About Zari', body: '<p>Zari is a home for sarees that carry craft, colour and story in every fold. We work with weavers and mills to bring silk, cotton and handloom drapes to your everyday and your biggest occasions.</p>' },
  contact: { title: 'Contact Us', body: '<p>Have a question about an order or a saree? Write to us and we’ll get back within 24 hours.</p><div class="field"><label>Email</label><input type="email" id="contactEmail"></div><div class="field"><label>Message</label><textarea rows="5" id="contactMsg"></textarea></div><button class="btn btn-dark" onclick="toast(\'Message sent\')">Send</button>' },
  privacy: { title: 'Privacy Policy', body: '<p>This Privacy Policy explains how Zari collects, uses and protects your personal information when you shop with us. (Add your finalized policy text here before launch.)</p>' },
  terms: { title: 'Terms of Service', body: '<p>By using the Zari website you agree to these terms. (Add your finalized terms text here before launch.)</p>' },
  'shipping-info': { title: 'Shipping Information', body: '<p>We currently check delivery serviceability by PIN code at checkout. Shipping partners and timelines will be listed here once finalized.</p>' },
  faq: { title: 'Frequently Asked Questions', body: '<p>Answers to common questions about sizing, fabric care, shipping and returns will appear here.</p>' }
};
function renderStatic(key) {
  var page = STATIC_PAGES[key];
  if (!page) { Router.notFound(); return; }
  document.title = page.title + ' | Zari';
  qs('#staticContainer').innerHTML = '<h1 class="display">' + page.title + '</h1><div style="color:var(--ink-soft);line-height:1.8;margin-top:16px;">' + page.body + '</div>';
}

/* ---------------------------------------------------------
   Newsletter
   --------------------------------------------------------- */
qs('#newsletterForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var email = qs('#newsletterEmail').value;
  supabaseClient.from('newsletter_subscribers').upsert({ email: email }, { onConflict: 'email' }).then(function (res) {
    toast(res.error ? 'Could not subscribe' : 'Subscribed! Welcome to the Zari circle.');
    if (!res.error) qs('#newsletterForm').reset();
  });
});

/* ---------------------------------------------------------
   Header icon wiring
   --------------------------------------------------------- */
qs('#cartBtn').addEventListener('click', function () { Cart.open(); });
qs('#mobileCartBtn').addEventListener('click', function () { Cart.open(); });
qs('#closeCartDrawer').addEventListener('click', function () { Cart.close(); });
qs('#wishlistBtn').addEventListener('click', function () { Router.go('/wishlist'); });
qs('#accountBtn').addEventListener('click', function () { Auth.user ? Router.go('/account') : openAuthModal('login'); });
qs('#mobileMenuBtn').addEventListener('click', function () {
  qs('#mobileNavSheetBody').innerHTML = ['Home:/', 'New Arrivals:/new-arrivals', 'Sarees:/sarees', 'Collections:/collections', 'Occasions:/occasions', 'About:/about', 'Contact:/contact'].map(function (l) {
    var p = l.split(':'); return '<a href="#' + p[1] + '" data-link class="filter-option" style="font-size:15px;" onclick="closeAllOverlays()">' + p[0] + '</a>';
  }).join('');
  openOverlay(); qs('#mobileNavSheet').classList.add('open'); document.body.style.overflow = 'hidden';
});

/* ---------------------------------------------------------
   Router
   --------------------------------------------------------- */
var Router = {
  pendingAfterLogin: null,
  go: function (path) { window.location.hash = '#' + path; },
  rerender: function () { this.handle(); },
  notFound: function () { this.show('notfound'); },
  show: function (viewName) {
    if (viewName !== 'home') clearInterval(HeroBanner.timer);
    qsa('.view').forEach(function (v) { v.classList.remove('active'); });
    qs('#view-' + viewName).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'auto' });
    qs('#pdpStickyCta').classList.remove('show');
  },
  handle: function () {
    var hash = window.location.hash.replace(/^#/, '') || '/';
    var qIndex = hash.indexOf('?');
    var path = qIndex === -1 ? hash : hash.slice(0, qIndex);
    var queryStr = qIndex === -1 ? '' : hash.slice(qIndex + 1);
    var query = {};
    queryStr.split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    var parts = path.split('/').filter(Boolean);

    closeAllOverlays();

    if (path === '/') { this.show('home'); renderHome(); }
    else if (parts[0] === 'sarees' || parts[0] === 'new-arrivals' || parts[0] === 'collections' || parts[0] === 'occasions' || parts[0] === 'search') { this.show('catalog'); renderCatalog(parts[0], query); }
    else if (parts[0] === 'product' && parts[1]) { this.show('product'); renderProductDetail(parts[1]); }
    else if (parts[0] === 'wishlist') { this.show('wishlist'); Data.getProductsByIds(Wishlist.ids).then(function (products) { renderGridInto('#wishlistGrid', products, 'Your wishlist is empty.'); }); }
    else if (parts[0] === 'checkout') { this.show('checkout'); renderCheckout(); }
    else if (parts[0] === 'cart') { this.show('checkout'); qs('#checkoutContainer').innerHTML = ''; Cart.open(); }
    else if (parts[0] === 'account') { this.show('account'); renderAccount(parts[1]); }
    else if (STATIC_PAGES[parts[0]]) { this.show('static'); renderStatic(parts[0]); }
    else { this.notFound(); }
  }
};
window.addEventListener('hashchange', function () { Router.handle(); });

document.addEventListener('click', function (e) {
  var link = e.target.closest('[data-link]');
  if (link) { /* let default hash navigation happen; overlays close in Router.handle */ closeAllOverlays(); }
});

/* ---------------------------------------------------------
   Init
   --------------------------------------------------------- */
Auth.init();
Cart.updateBadge();
Wishlist.updateBadge();
Router.handle();
