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

// Clean branded placeholder used whenever a product has no image yet (spec §10).
var PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">' +
  '<rect width="300" height="400" fill="#f5ead8"/>' +
  '<text x="150" y="195" font-family="Cormorant Garamond,Georgia,serif" font-size="42" font-style="italic" fill="#7a2828" text-anchor="middle">Zari</text>' +
  '<text x="150" y="225" font-family="Manrope,sans-serif" font-size="12" letter-spacing="2" fill="#b8874a" text-anchor="middle">IMAGE COMING SOON</text></svg>');
function imgSrc(url) { return url && String(url).trim() ? url : PLACEHOLDER_IMG; }

// Products are cached by id as they render so card action buttons (Add / Buy Now)
// can act without re-fetching or embedding the whole object in an onclick attribute.
var ProductCache = {};
function cacheProduct(p) { if (p && p.id) ProductCache[p.id] = p; return p; }
function stockLabel(p) {
  if (p.stock <= 0) return { text: 'Out of Stock', cls: 'oos' };
  if (p.stock <= 3) return { text: 'Only ' + p.stock + ' left', cls: 'low' };
  return { text: 'In Stock', cls: 'in' };
}
// Shared: resolve the variant to add for a card/PDP given the currently-picked colour.
function pickVariant(p, colorName) {
  if (!p.variants || !p.variants.length) return null;
  return (colorName && p.variants.find(function (v) { return v.color === colorName; })) || p.variants[0];
}
function cardAddToCart(id) {
  var p = ProductCache[id]; if (!p) return;
  if (p.stock <= 0) { openNotifyMe(p.id); return; }
  if (p.colors && p.colors.length > 1) { openQuickView(p.slug); return; } // let them pick colour
  Cart.add(p, pickVariant(p), 1);
}
function cardBuyNow(id) {
  var p = ProductCache[id]; if (!p) return;
  if (p.stock <= 0) { toast('This item is out of stock'); return; }
  if (p.colors && p.colors.length > 1) { openQuickView(p.slug); return; }
  Cart.add(p, pickVariant(p), 1, { silent: true });
  Router.go('/checkout');
}

// Preview mode (demo-data.js): sample items saved to the bag/wishlist during preview
// are dropped once the real store is connected, so they never reach checkout.
var IS_DEMO = typeof DEMO_MODE !== 'undefined' && DEMO_MODE;
function isStaleDemoId(id) { return !IS_DEMO && String(id || '').indexOf('demo-') === 0; }
if (IS_DEMO) {
  var demoBar = document.createElement('div');
  demoBar.className = 'demo-bar';
  demoBar.textContent = 'Preview mode — sample products with placeholder images. Real products appear once the store is connected.';
  document.body.insertBefore(demoBar, document.body.firstChild);
}

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
  qsa('.drawer.open, .modal-overlay.open, .bottom-sheet.open, .search-sheet.open').forEach(function (el) { el.classList.remove('open'); });
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
  load: function () { try { this.items = JSON.parse(localStorage.getItem(this.KEY)) || []; } catch (e) { this.items = []; } this.items = this.items.filter(function (i) { return !isStaleDemoId(i.productId); }); },
  persist: function () { try { localStorage.setItem(this.KEY, JSON.stringify(this.items)); } catch (e) {} this.updateBadge(); },
  // opts.silent = don't toast / don't open the drawer (used by Buy Now, which
  // navigates straight to checkout instead).
  add: function (product, variant, qty, opts) {
    qty = qty || 1;
    opts = opts || {};
    var variantId = variant ? variant.id : null;
    var existing = this.items.find(function (i) { return i.productId === product.id && i.variantId === variantId; });
    if (existing) { existing.qty += qty; }
    else {
      this.items.push({
        productId: product.id, variantId: variantId, name: product.name, sku: product.sku,
        image: (product.images && product.images[0]) || '', price: product.price,
        color: variant ? variant.color : null, size: variant ? variant.size : null, qty: qty
      });
    }
    this.persist();
    if (opts.silent) return;
    toast('Added to bag');
    Cart.open();
  },
  remove: function (productId, variantId) {
    this.items = this.items.filter(function (i) { return !(i.productId === productId && i.variantId === variantId); });
    this.persist(); Cart.render();
  },
  setQty: function (productId, variantId, qty) {
    var it = this.items.find(function (i) { return i.productId === productId && i.variantId === variantId; });
    if (it) { it.qty = Math.max(1, qty); this.persist(); Cart.render(); if (qs('#cartPageContainer') && qs('#view-cart').classList.contains('active')) renderCartPage(); }
  },
  subtotal: function () { return this.items.reduce(function (s, i) { return s + i.price * i.qty; }, 0); },
  count: function () { return this.items.reduce(function (s, i) { return s + i.qty; }, 0); },
  // Delivery: free over the free-shipping threshold, else a flat fee. These are the
  // store's stated rules (announcement bar: free over ₹2,999), not invented per-order.
  FREE_SHIP_OVER: 2999,
  FLAT_SHIP: 79,
  deliveryFee: function () { return this.subtotal() >= this.FREE_SHIP_OVER || this.subtotal() === 0 ? 0 : this.FLAT_SHIP; },
  total: function () { return this.subtotal() + this.deliveryFee(); },
  updateBadge: function () {
    var n = this.count();
    [qs('#cartCount'), qs('#mobileCartCount')].forEach(function (el) { if (!el) return; el.textContent = n; el.classList.toggle('hidden', n === 0); });
  },
  open: function () { Cart.render(); openOverlay(); qs('#cartDrawer').classList.add('open'); document.body.style.overflow = 'hidden'; },
  close: function () { qs('#cartDrawer').classList.remove('open'); closeAllOverlays(); },
  render: function () {
    var body = qs('#cartDrawerBody'), footer = qs('#cartDrawerFooter');
    if (!this.items.length) {
      body.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg><h3>Your bag is empty</h3><p>Find something you’ll love.</p></div>';
      footer.innerHTML = '<a href="#/sarees" class="btn btn-primary btn-block" data-link onclick="Cart.close()">Continue Shopping</a>';
      return;
    }
    body.innerHTML = this.items.map(function (i) {
      var vid = i.variantId ? "'" + i.variantId + "'" : 'null';
      return '<div class="cart-line">' +
        '<img src="' + escapeHtml(imgSrc(i.image)) + '" alt="" onerror="this.src=PLACEHOLDER_IMG">' +
        '<div class="cart-line-info">' +
        '<div class="cart-line-top"><p class="name">' + escapeHtml(i.name) + '</p><span class="price">' + formatPrice(i.price) + '</span></div>' +
        '<p class="meta">' + [i.color, i.size].filter(Boolean).map(escapeHtml).join(' &middot; ') + '</p>' +
        '<div class="cart-line-bottom">' +
        '<div class="qty-stepper">' +
        '<button aria-label="Decrease" onclick="Cart.setQty(\'' + i.productId + '\',' + vid + ',' + (i.qty - 1) + ')">&minus;</button>' +
        '<span>' + i.qty + '</span>' +
        '<button aria-label="Increase" onclick="Cart.setQty(\'' + i.productId + '\',' + vid + ',' + (i.qty + 1) + ')">+</button>' +
        '</div>' +
        '<div class="cart-line-links">' +
        '<button class="link-btn" onclick="Cart.saveForLater(\'' + i.productId + '\',' + vid + ')">Save</button>' +
        '<button class="link-btn" onclick="Cart.remove(\'' + i.productId + '\',' + vid + ')">Remove</button>' +
        '</div></div>' +
        '</div></div>';
    }).join('');
    var fee = this.deliveryFee();
    footer.innerHTML = '<div class="drawer-total"><span>Subtotal</span><strong>' + formatPrice(this.subtotal()) + '</strong></div>' +
      '<p class="drawer-note">' + (fee === 0 ? 'Complimentary delivery on this order.' : 'Add ' + formatPrice(this.FREE_SHIP_OVER - this.subtotal()) + ' more for complimentary delivery.') + '</p>' +
      '<a href="#/checkout" class="btn btn-primary btn-block" data-link onclick="Cart.close()">Checkout</a>' +
      '<a href="#/cart" class="btn btn-ghost btn-block" data-link onclick="Cart.close()">View Bag</a>';
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
  load: function () { try { this.ids = JSON.parse(localStorage.getItem(this.KEY)) || []; } catch (e) { this.ids = []; } this.ids = this.ids.filter(function (id) { return !isStaleDemoId(id); }); },
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
      '<button class="modal-close" onclick="closeAllOverlays()" aria-label="Close">&times;</button>' +
      '<div class="modal-pad">' +
      '<p class="eyebrow">Account</p>' +
      '<h3 class="modal-title">Welcome <em>back</em></h3>' +
      '<p class="modal-sub">Log in to continue.</p>' +
      '<form id="loginForm">' +
      '<div class="field"><label for="loginEmail">Email</label><input type="email" required id="loginEmail" autocomplete="email"></div>' +
      '<div class="field"><label for="loginPassword">Password</label><input type="password" required id="loginPassword" autocomplete="current-password"></div>' +
      '<div class="field-error hidden" id="loginError"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Log In</button>' +
      '</form>' +
      '<div class="divider-or">or</div>' +
      '<button class="btn btn-ghost btn-block" onclick="Auth.loginWithGoogle()">Continue with Google</button>' +
      '<p class="modal-foot"><a href="#" onclick="renderAuthModal(\'forgot\');return false;">Forgot password?</a></p>' +
      '<p class="modal-foot" style="margin-top:8px;">New here? <a href="#" onclick="renderAuthModal(\'signup\');return false;">Create an account</a></p>' +
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
      '<button class="modal-close" onclick="closeAllOverlays()" aria-label="Close">&times;</button>' +
      '<div class="modal-pad">' +
      '<p class="eyebrow">Join Zari</p>' +
      '<h3 class="modal-title">Create your <em>account</em></h3>' +
      '<p class="modal-sub">Save your wishlist, track orders and check out faster.</p>' +
      '<form id="signupForm">' +
      '<div class="field"><label for="signupName">Full name</label><input type="text" required id="signupName" autocomplete="name"></div>' +
      '<div class="field"><label for="signupEmail">Email</label><input type="email" required id="signupEmail" autocomplete="email"></div>' +
      '<div class="field"><label for="signupPassword">Password</label><input type="password" required minlength="6" id="signupPassword" autocomplete="new-password"></div>' +
      '<div class="field-error hidden" id="signupError"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Sign Up</button>' +
      '</form>' +
      '<p class="modal-foot">Already have an account? <a href="#" onclick="renderAuthModal(\'login\');return false;">Log in</a></p>' +
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
      '<button class="modal-close" onclick="closeAllOverlays()" aria-label="Close">&times;</button>' +
      '<div class="modal-pad">' +
      '<h3 class="modal-title">Reset <em>password</em></h3>' +
      '<p class="modal-sub">We’ll email you a link to set a new one.</p>' +
      '<form id="forgotForm">' +
      '<div class="field"><label for="forgotEmail">Email</label><input type="email" required id="forgotEmail" autocomplete="email"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Send Reset Link</button>' +
      '</form>' +
      '<p class="modal-foot"><a href="#" onclick="renderAuthModal(\'login\');return false;">Back to login</a></p>' +
      '</div>';
    qs('#forgotForm').addEventListener('submit', function (e) {
      e.preventDefault();
      Auth.resetPassword(qs('#forgotEmail').value).then(function () {
        body.innerHTML = '<button class="modal-close" onclick="closeAllOverlays()" aria-label="Close">&times;</button><div class="modal-pad text-center"><h3 class="modal-title">Check your <em>email</em></h3><p class="modal-sub" style="margin:0;">We\'ve sent a reset link if that account exists.</p></div>';
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
      '<button class="modal-close" onclick="closeAllOverlays()" aria-label="Close">&times;</button>' +
      '<div class="modal-pad">' +
      '<p class="eyebrow">Delivery</p>' +
      '<h3 class="modal-title">Where should we <em>deliver?</em></h3>' +
      '<p class="modal-sub">Check availability for your PIN code.</p>' +
      '<div class="field"><label for="pinInput">PIN code</label>' +
      '<div class="inline-field"><input type="text" id="pinInput" maxlength="6" inputmode="numeric" placeholder="e.g. 400001">' +
      '<button class="btn btn-primary btn-sm" onclick="Location.checkPin()">Check</button></div></div>' +
      '<div id="pinResult" style="font-size:13.5px;min-height:20px;"></div>' +
      '<div class="divider-or">or</div>' +
      '<button class="btn btn-ghost btn-block" onclick="Location.useCurrentLocation()">Use My Current Location</button>' +
      '<div id="savedAddressesForLocation" style="margin-top:24px;"></div>' +
      '</div>';
    if (Auth.user) {
      supabaseClient.from('addresses').select('*').eq('customer_id', Auth.user.id).then(function (res) {
        var list = res.data || [];
        if (!list.length) return;
        qs('#savedAddressesForLocation').innerHTML = '<p class="pdp-option-label">Saved Addresses</p>' +
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
    if (!/^\d{6}$/.test(pin)) { qs('#pinResult').innerHTML = '<span class="msg-err">Enter a valid 6-digit PIN.</span>'; return; }
    qs('#pinResult').textContent = 'Checking…';
    supabaseClient.functions.invoke('check-delivery', { body: { pincode: pin } }).then(function (res) {
      var ok = res.data && res.data.serviceable;
      qs('#pinResult').innerHTML = ok
        ? '<span class="msg-ok">Delivery available to ' + escapeHtml(pin) + '.</span>'
        : '<span class="msg-err">Currently unavailable at this PIN.</span>';
      if (ok) { Location.current = { pincode: pin, city: (res.data && res.data.city) || pin }; Location.persist(); }
    }).catch(function () { qs('#pinResult').innerHTML = '<span class="msg-err">Could not check right now.</span>'; });
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
      '<div class="search-sheet-bar">' +
      '<input type="text" id="searchSheetInput" placeholder="Search sarees&hellip;" aria-label="Search">' +
      '<button class="close-btn" onclick="closeAllOverlays()" aria-label="Close search">&times;</button></div>' +
      '<div class="search-sheet-results" id="searchSheetResults"></div>';
    var recent = this.getRecent();
    if (recent.length) {
      qs('#searchSheetResults').innerHTML = '<h4>Recent searches</h4><div class="link-list">' +
        recent.map(function (t) { return '<a href="#" onclick="Search.run(\'' + escapeHtml(t).replace(/'/g, "\\'") + '\');return false;">' + escapeHtml(t) + '</a>'; }).join('') + '</div>';
    }
    qs('#searchSheetInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') Search.run(this.value); });
    openOverlay(); qs('#searchSheet').classList.add('open'); document.body.style.overflow = 'hidden';
    setTimeout(function () { var i = qs('#searchSheetInput'); if (i) i.focus(); }, 50);
  }
};
qs('#headerSearchInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { Search.run(this.value); this.value = ''; this.blur(); } });
qs('#mobileSearchBtn').addEventListener('click', function () { Search.openMobile(); });

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
    if (filters.bestSeller) query = query.eq('best_seller', true);
    if (filters.onSale) query = query.eq('on_sale', true);
    if (filters.fabric) query = query.eq('fabric', filters.fabric);
    if (filters.productType) query = query.eq('product_type', filters.productType);
    if (filters.occasion) query = query.eq('occasion', filters.occasion);
    if (filters.minPrice) query = query.gte('price', filters.minPrice);
    if (filters.maxPrice) query = query.lte('price', filters.maxPrice);
    if (filters.search) {
      var t = filters.search.replace(/[%]/g, '');
      query = query.or(['name.ilike.%' + t + '%', 'sku.ilike.%' + t + '%', 'fabric.ilike.%' + t + '%', 'occasion.ilike.%' + t + '%', 'weave.ilike.%' + t + '%', 'description.ilike.%' + t + '%'].join(','));
    }
    if (filters.sort === 'price-asc') query = query.order('price', { ascending: true });
    else if (filters.sort === 'price-desc') query = query.order('price', { ascending: false });
    else if (filters.sort === 'discount') query = query.order('sale_price', { ascending: true, nullsFirst: false });
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
  // Best sellers: admin-flagged best_seller products first (lets the store hand-pick
  // before there is any order history); if none are flagged, fall back to a real
  // ranking by units sold in paid orders. Never invented — empty when neither exists.
  getBestSellers: function (limit) {
    limit = limit || 8;
    return supabaseClient.from('products').select(PRODUCT_SELECT).eq('status', 'active').eq('best_seller', true).order('created_at', { ascending: false }).limit(limit)
      .then(function (res) {
        var flagged = (res.data || []).map(mapSupabaseProduct);
        if (flagged.length) return { products: flagged, error: res.error };
        return supabaseClient.from('order_items').select('product_id, qty, orders!inner(payment_status)').eq('orders.payment_status', 'paid')
          .then(function (r2) {
            if (r2.error || !r2.data || !r2.data.length) return { products: [], error: r2.error };
            var totals = {};
            r2.data.forEach(function (row) { totals[row.product_id] = (totals[row.product_id] || 0) + row.qty; });
            var rankedIds = Object.keys(totals).sort(function (a, b) { return totals[b] - totals[a]; }).slice(0, limit);
            return Data.getProductsByIds(rankedIds).then(function (products) {
              products.sort(function (a, b) { return rankedIds.indexOf(a.id) - rankedIds.indexOf(b.id); });
              return { products: products, error: null };
            });
          });
      })
      .catch(function (err) { return { products: [], error: err }; });
  }
};

/* ---------------------------------------------------------
   Product card / grid rendering
   --------------------------------------------------------- */
function productCardHtml(p) {
  cacheProduct(p);
  var img1 = imgSrc(p.images[0]);
  var img2 = p.images[1] ? p.images[1] : img1;
  var disc = discountPercent(p.price, p.oldPrice);
  var outOfStock = p.stock <= 0;
  var stk = stockLabel(p);
  var meta = [p.primaryCategory, p.productType].filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
  // Short info line: description first sentence, else fabric/blouse summary.
  var shortInfo = p.description ? String(p.description).replace(/\s+/g, ' ').slice(0, 64) + (p.description.length > 64 ? '…' : '')
    : [p.fabric, p.blouseIncluded ? 'Blouse included' : null].filter(Boolean).join(' · ');
  return '<div class="product-card reveal">' +
    '<div class="card-media-wrap">' +
    '<a href="#/product/' + p.slug + '" data-link>' +
    '<div class="product-media">' +
    '<div class="product-badges">' +
    (p.newArrival ? '<span class="badge badge-new">New</span>' : '') +
    (disc > 0 ? '<span class="badge badge-sale">' + disc + '% Off</span>' : '') +
    (p.bestSeller ? '<span class="badge badge-best">Best Seller</span>' : '') +
    (outOfStock ? '<span class="badge badge-oos">Sold Out</span>' : '') +
    '</div>' +
    '<img class="img-main" src="' + escapeHtml(img1) + '" alt="' + escapeHtml(p.name) + '" loading="lazy" onerror="this.src=PLACEHOLDER_IMG">' +
    (img2 !== img1 ? '<img class="img-alt" src="' + escapeHtml(img2) + '" alt="" loading="lazy">' : '') +
    '</div></a>' +
    '<button class="wishlist-toggle ' + (Wishlist.has(p.id) ? 'active' : '') + '" data-wishlist-id="' + p.id + '" onclick="Wishlist.toggle(\'' + p.id + '\')" aria-label="Add to wishlist">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7.5-4.7-10-9.3C.5 8 2.3 4 6.3 4c2 0 3.6 1.1 4.7 2.8C12.1 5.1 13.7 4 15.7 4c4 0 5.8 4 4.3 7.7-2.5 4.6-10 9.3-10 9.3z"/></svg></button>' +
    '<div class="quick-actions">' +
    '<button onclick="openQuickView(\'' + p.slug + '\')">Quick View</button>' +
    (outOfStock
      ? '<button class="primary" onclick="openNotifyMe(\'' + p.id + '\')">Notify Me</button>'
      : '<button class="primary" onclick="cardAddToCart(\'' + p.id + '\')">Add to Bag</button>') +
    '</div></div>' +
    '<div class="product-info">' +
    (meta.length ? '<p class="card-meta">' + meta.map(escapeHtml).join(' · ') + '</p>' : '') +
    '<a href="#/product/' + p.slug + '" data-link><h3 class="name">' + escapeHtml(p.name) + '</h3></a>' +
    '<p class="card-sku">Code ' + escapeHtml(p.sku) + '</p>' +
    '<div class="price-row"><span class="price">' + (p.price > 0 ? formatPrice(p.price) : 'Price on request') + '</span>' +
    (p.oldPrice ? '<span class="price-old">' + formatPrice(p.oldPrice) + '</span><span class="discount">' + disc + '% off</span>' : '') +
    '</div>' +
    (shortInfo ? '<p class="card-short">' + escapeHtml(shortInfo) + '</p>' : '') +
    '<div class="card-foot">' +
    '<p class="stock-status stock-' + stk.cls + '">' + stk.text + '</p>' +
    (p.colors.length > 1 ? '<div class="swatches">' + p.colors.slice(0, 5).map(function (c) { return '<span class="swatch" style="background:' + escapeHtml(c.hex || '#ccc') + '" title="' + escapeHtml(c.name) + '"></span>'; }).join('') + '</div>' : '') +
    '</div>' +
    '<div class="card-actions">' +
    (outOfStock
      ? '<button class="link-btn strong" onclick="openNotifyMe(\'' + p.id + '\')">Notify Me</button>'
      : '<button class="link-btn strong" onclick="cardAddToCart(\'' + p.id + '\')">Add to Bag</button>' +
        '<button class="link-btn" onclick="cardBuyNow(\'' + p.id + '\')">Buy Now</button>') +
    '<a class="link-btn" href="#/product/' + p.slug + '" data-link>Details</a>' +
    '</div>' +
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
  el.innerHTML = new Array(count || 4).fill('<div class="skeleton-card"><div class="skeleton skeleton-media"></div><div class="skeleton skeleton-line" style="width:40%"></div><div class="skeleton skeleton-line" style="width:75%;height:18px;"></div><div class="skeleton skeleton-line" style="width:30%"></div></div>').join('');
}

/* ---------------------------------------------------------
   Hero banner carousel — admin-managed via /admin/banners. Falls back to the
   static default hero markup already in index.html when no banner is active.
   --------------------------------------------------------- */
var HeroBanner = {
  banners: [], index: 0, timer: null, defaultHtml: null, defaultMedia: null,
  load: function () {
    if (this.defaultHtml == null) this.defaultHtml = qs('#heroContent').innerHTML;
    if (this.defaultMedia == null) this.defaultMedia = qs('#heroMedia').innerHTML;
    Data.getActiveBanners().then(function (banners) {
      HeroBanner.banners = banners;
      HeroBanner.index = 0;
      clearInterval(HeroBanner.timer);
      if (!banners.length) {
        qs('#heroContent').innerHTML = HeroBanner.defaultHtml;
        qs('#heroMedia').innerHTML = HeroBanner.defaultMedia;
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
    qs('#heroMedia').innerHTML = b.image_url
      ? '<img src="' + escapeHtml(b.image_url) + '" alt="' + escapeHtml(b.title || '') + '">'
      : HeroBanner.defaultMedia;
    qs('#heroContent').innerHTML =
      (b.offer_text ? '<span class="hero-offer-badge">' + escapeHtml(b.offer_text) + '</span>' : '') +
      '<p class="eyebrow">The Zari Edit</p>' +
      '<h1 class="hero-title">' + escapeHtml(b.title) + '</h1>' +
      (b.subtitle ? '<p class="hero-lede">' + escapeHtml(b.subtitle) + '</p>' : '') +
      '<div class="hero-actions">' +
      '<a href="' + escapeHtml(b.cta_link || '#/sarees') + '" class="btn btn-primary" ' + (String(b.cta_link || '').indexOf('#/') === 0 ? 'data-link' : 'target="_blank" rel="noopener"') + '>' + escapeHtml(b.cta_text || 'Shop Now') + '</a>' +
      '<a href="#/sarees" class="link-arrow" data-link>All Sarees</a>' +
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
  renderSkeletonGrid('#featuredGrid', 5);
  renderSkeletonGrid('#moreStylesGrid', 4);
  HeroBanner.load();

  Data.getCategories('saree_type').then(function (cats) {
    document.getElementById('sectionShopByType').style.display = cats.length ? '' : 'none';
    qs('#shopByTypeList').innerHTML = cats.map(function (c, i) {
      return '<a href="#/sarees?type=' + c.slug + '" class="weave-row" data-link>' +
        '<span class="weave-num">' + (i < 9 ? '0' : '') + (i + 1) + '</span>' +
        '<span class="weave-name">' + escapeHtml(c.name) + '</span>' +
        '<span class="weave-arrow">&rarr;</span></a>';
    }).join('');
  });

  Promise.all([Data.getCategories('fabric'), Data.getCategories('occasion')]).then(function (r) {
    document.getElementById('sectionShopByFabric').style.display = r[0].length ? '' : 'none';
    document.getElementById('sectionShopByOccasion').style.display = r[1].length ? '' : 'none';
    document.getElementById('sectionShopBy').style.display = (r[0].length || r[1].length) ? '' : 'none';
    qs('#shopByFabricList').innerHTML = r[0].map(function (c) { return '<a href="#/sarees?fabric=' + c.slug + '" data-link>' + escapeHtml(c.name) + '</a>'; }).join('');
    qs('#shopByOccasionList').innerHTML = r[1].map(function (c) { return '<a href="#/sarees?occasion=' + c.slug + '" data-link>' + escapeHtml(c.name) + '</a>'; }).join('');
  });

  Data.listProducts({ newArrival: true, limit: 8 }).then(function (r) { renderGridInto('#newArrivalsGrid', r.products, 'New arrivals will appear here soon.', !!r.error); });
  // Featured grid leads with one large card (2x2) + four regular — 5 fills the layout cleanly.
  Data.listProducts({ featured: true, limit: 5 }).then(function (r) {
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
    qs('#campaignBanner').innerHTML = '<div class="campaign"><p class="eyebrow">Live Now</p><h2>' + escapeHtml(c.name) + '</h2><a href="#/offers" class="link-arrow link-arrow-light" data-link>Shop the offer</a></div>';
  });

  Data.getApprovedReviews(3).then(function (reviews) {
    document.getElementById('sectionReviews').style.display = reviews.length ? '' : 'none';
    qs('#reviewsGrid').innerHTML = reviews.map(function (r) {
      return '<figure class="quote-card reveal" style="margin:0;"><div class="stars">' + '&#9733;'.repeat(r.rating) + '</div><blockquote>&ldquo;' + escapeHtml(r.review_text || '') + '&rdquo;</blockquote><figcaption class="who">Verified purchase &middot; ' + escapeHtml((r.products && r.products.name) || '') + '</figcaption></figure>';
    }).join('');
    observeReveal(qs('#reviewsGrid'));
  });

  observeReveal(document);
}

/* ---------------------------------------------------------
   Catalog view (sarees / new-arrivals / collections / occasions / search)
   --------------------------------------------------------- */
var CatalogState = { filters: {}, sort: 'new' };
function renderCatalog(routeParams, query) {
  var title = 'All Sarees';
  var filters = {};
  if (query.q) { title = 'Search: "' + query.q + '"'; filters.search = query.q; }
  if (query.type) { filters.categorySlug = query.type; title = 'Sarees'; }
  if (query.fabric) { filters.fabric = query.fabric; title = query.fabric.charAt(0).toUpperCase() + query.fabric.slice(1) + ' Sarees'; }
  if (query.occasion) { filters.occasion = query.occasion; title = 'Shop by Occasion'; }
  if (query.featured) { filters.featured = true; title = 'Featured Sarees'; }
  if (query.sale) { filters.onSale = true; title = 'Special Offers'; }
  if (query.best) { filters.bestSeller = true; title = 'Best Sellers'; }
  if (routeParams === 'new-arrivals') { title = 'New Arrivals'; filters.newArrival = true; }
  if (routeParams === 'offers') { title = 'Special Offers'; filters.onSale = true; }
  filters.sort = CatalogState.sort;
  qs('#catalogTitle').textContent = title;
  qs('#catalogCrumb').textContent = title;
  qs('#sortSelect').value = CatalogState.sort;
  qs('#catalogCount').textContent = '';
  renderSkeletonGrid('#catalogGrid', 6);
  renderFilterSidebar(query);

  Data.listProducts(filters).then(function (r) {
    renderGridInto('#catalogGrid', r.products, 'No products match yet.', !!r.error);
    qs('#catalogCount').textContent = r.count ? (r.count + ' piece' + (r.count === 1 ? '' : 's')) : '';
  });
}
function renderFilterSidebar(query) {
  query = query || {};
  Promise.all([Data.getCategories('saree_type'), Data.getCategories('fabric'), Data.getCategories('occasion')]).then(function (r) {
    var html =
      filterGroupHtml('Saree Type', r[0], 'type', query) +
      filterGroupHtml('Fabric', r[1], 'fabric', query) +
      filterGroupHtml('Occasion', r[2], 'occasion', query);
    qs('#filterSidebar').innerHTML = html || '<p style="color:var(--ink-soft);font-size:13px;">Filters will appear once categories are set up.</p>';
    qs('#filterSheetBody').innerHTML = '<h3 class="sheet-title">Filter</h3>' + html;
    // Active filter tags above the grid, each clearing back to the full catalog.
    var all = r[0].map(function (c) { return ['type', c]; }).concat(r[1].map(function (c) { return ['fabric', c]; }), r[2].map(function (c) { return ['occasion', c]; }));
    var active = all.filter(function (x) { return query[x[0]] === x[1].slug; });
    qs('#activeFilters').innerHTML = active.map(function (x) {
      return '<a href="#/sarees" class="filter-tag" data-link>' + escapeHtml(x[1].name) + '<span aria-label="Clear">&times;</span></a>';
    }).join('');
  });
}
function filterGroupHtml(label, cats, param, query) {
  if (!cats.length) return '';
  return '<div class="filter-group"><h4>' + label + '</h4>' + cats.map(function (c) {
    var on = query && query[param] === c.slug;
    return '<label class="filter-option' + (on ? ' is-active' : '') + '"><input type="checkbox"' + (on ? ' checked' : '') + ' onchange="location.hash=this.checked?\'#/sarees?' + param + '=' + c.slug + '\':\'#/sarees\'"> ' + escapeHtml(c.name) + '</label>';
  }).join('') + '</div>';
}
qs('#sortSelect').addEventListener('change', function () { CatalogState.sort = this.value; Router.rerender(); });
qs('#openFilterSheet').addEventListener('click', function () { openOverlay(); qs('#filterSheet').classList.add('open'); document.body.style.overflow = 'hidden'; });
qs('#openSortSheet').addEventListener('click', function () {
  qs('#sortSheetBody').innerHTML = '<h3 class="sheet-title">Sort by</h3>' + ['new:New Arrivals', 'price-asc:Price: Low to High', 'price-desc:Price: High to Low', 'discount:Discount'].map(function (o) {
    var parts = o.split(':'); return '<div class="filter-option' + (CatalogState.sort === parts[0] ? ' is-active' : '') + '" onclick="CatalogState.sort=\'' + parts[0] + '\';Router.rerender();closeAllOverlays();">' + parts[1] + '</div>';
  }).join('');
  openOverlay(); qs('#sortSheet').classList.add('open'); document.body.style.overflow = 'hidden';
});

/* ---------------------------------------------------------
   Product detail view
   --------------------------------------------------------- */
var PDPState = { product: null, activeImage: 0, activeColor: null, qty: 1 };
function pdpSetQty(delta) {
  PDPState.qty = Math.max(1, PDPState.qty + delta);
  var el = qs('#pdpQtyVal'); if (el) el.textContent = PDPState.qty;
}
function renderProductDetail(slug) {
  qs('#pdpContainer').innerHTML = '<div class="skeleton skeleton-media"></div><div><div class="skeleton skeleton-line" style="width:30%;"></div><div class="skeleton skeleton-line" style="width:80%;height:44px;margin-top:20px;"></div><div class="skeleton skeleton-line" style="width:25%;height:20px;margin-top:20px;"></div></div>';
  Data.getProductBySlug(slug).then(function (p) {
    if (!p) { qs('#pdpContainer').innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Product not found.</div>'; return; }
    PDPState.product = p; PDPState.activeImage = 0; PDPState.activeColor = p.colors[0] ? p.colors[0].name : null; PDPState.qty = 1;
    RecentlyViewed.record(p.id);
    document.title = p.name + ' | Zari';
    var disc = discountPercent(p.price, p.oldPrice);
    var outOfStock = p.stock <= 0;
    var stk = stockLabel(p);
    var images = p.images.length ? p.images : [PLACEHOLDER_IMG];

    var details = [
      ['Category', p.primaryCategory], ['Product Type', p.productType],
      ['Fabric / Material', p.fabric], ['Colour', p.colors.map(function (c) { return c.name; }).join(', ') || null],
      ['Saree Length', p.sareeLengthM ? p.sareeLengthM + ' m' : null],
      ['Blouse Piece', p.blouseIncluded ? 'Included' : null], ['Blouse Length', p.blouseLengthM ? p.blouseLengthM + ' m' : null],
      ['Work / Weave', [p.workType, p.weave].filter(Boolean).join(', ') || null], ['Border', p.borderType],
      ['Occasion', p.occasion], ['Care Instructions', p.washCare], ['Country of Origin', p.countryOfOrigin],
      ['Product Code', p.sku], ['HSN Code', p.hsnCode]
    ].filter(function (d) { return d[1]; });

    var metaLine = [p.primaryCategory, p.productType].filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var deliveryLabel = Location.current ? 'Delivering to <strong>' + escapeHtml(Location.current.city || Location.current.pincode) + '</strong>' : 'Check delivery to your PIN';
    qs('#pdpContainer').innerHTML =
      '<div class="pdp-gallery">' +
      '<div class="pdp-thumbs">' + images.map(function (img, i) { return '<img src="' + escapeHtml(img) + '" alt="View ' + (i + 1) + '" class="' + (i === 0 ? 'active' : '') + '" onclick="setPdpImage(' + i + ')" onerror="this.src=PLACEHOLDER_IMG">'; }).join('') + '</div>' +
      '<div class="pdp-gallery-main"><img id="pdpMainImg" src="' + escapeHtml(images[0]) + '" alt="' + escapeHtml(p.name) + '" onerror="this.src=PLACEHOLDER_IMG"></div>' +
      '</div>' +
      '<div class="pdp-info">' +
      '<nav class="crumbs"><a href="#/" data-link>Home</a><span>/</span><a href="#/sarees" data-link>Sarees</a>' + (p.primaryCategory ? '<span>/</span><span>' + escapeHtml(p.primaryCategory) + '</span>' : '') + '</nav>' +
      (metaLine.length ? '<p class="eyebrow">' + metaLine.map(escapeHtml).join(' · ') + '</p>' : '') +
      '<h1 class="name">' + escapeHtml(p.name) + '</h1>' +
      ((p.newArrival || p.bestSeller) ? '<div class="pdp-badges">' + (p.newArrival ? '<span class="badge badge-sale">New</span>' : '') + (p.bestSeller ? '<span class="badge badge-best">Best Seller</span>' : '') + '</div>' : '') +
      '<div class="price-row"><span class="price">' + (p.price > 0 ? formatPrice(p.price) : 'Price on request') + '</span>' +
      (p.oldPrice ? '<span class="price-old">' + formatPrice(p.oldPrice) + '</span><span class="discount">' + disc + '% off</span>' : '') + '</div>' +
      '<p class="pdp-tax">Inclusive of all taxes</p>' +
      '<div class="pdp-meta-row"><span>Code ' + escapeHtml(p.sku) + '</span><span class="stock-status stock-' + stk.cls + '">' + stk.text + '</span></div>' +
      (p.colors.length ? '<div class="pdp-option"><p class="pdp-option-label">Colour<span>' + escapeHtml(PDPState.activeColor || '') + '</span></p><div class="swatches">' +
        p.colors.map(function (c) { return '<span class="swatch ' + (c.name === PDPState.activeColor ? 'active' : '') + '" style="background:' + escapeHtml(c.hex || '#ccc') + '" onclick="setPdpColor(\'' + escapeHtml(c.name) + '\')" title="' + escapeHtml(c.name) + '"></span>'; }).join('') + '</div></div>' : '') +
      (outOfStock
        ? '<div class="pdp-buy-row"><button class="btn btn-primary" onclick="openNotifyMe(\'' + p.id + '\')">Notify Me When Available</button>' + pdpWishBtn(p) + '</div>'
        : '<div class="pdp-buy">' +
          '<div class="qty-stepper qty-stepper-lg"><button type="button" aria-label="Decrease" onclick="pdpSetQty(-1)">&minus;</button><span id="pdpQtyVal">1</span><button type="button" aria-label="Increase" onclick="pdpSetQty(1)">+</button></div>' +
          '<button class="btn btn-primary" onclick="addPdpToCart()">Add to Bag</button></div>' +
          '<div class="pdp-buy-row"><button class="btn btn-ghost" onclick="addPdpToCart(true)">Buy Now</button>' + pdpWishBtn(p) + '</div>') +
      '<div class="pdp-delivery" id="pdpDeliveryBlock">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/></svg>' +
      '<span style="flex:1;">' + deliveryLabel + '</span>' +
      '<button class="link-btn" onclick="Location.open()">' + (Location.current ? 'Change' : 'Check') + '</button></div>' +
      (p.description ? '<p class="pdp-desc">' + escapeHtml(p.description) + '</p>' : '') +
      '<div id="pdpAccordion">' +
        accordionItemHtml('Product Details', '<table class="pdp-detail-table">' + details.map(function (d) { return '<tr><td>' + escapeHtml(d[0]) + '</td><td>' + escapeHtml(String(d[1])) + '</td></tr>'; }).join('') + '</table>', true) +
        accordionItemHtml('Delivery Information', 'Delivery availability is checked by PIN code at checkout. Serviceable orders are typically dispatched within 2–4 business days. Enter your PIN above to confirm delivery to your area.', false) +
        accordionItemHtml('Return &amp; Exchange', 'Returns and exchanges are handled on a case-by-case basis for damaged or wrong items. Please contact support within 48 hours of delivery with your order number and photos. (Final return policy to be confirmed by Zari.)', false) +
      '</div>' +
      '</div>';

    var stickyCta = qs('#pdpStickyCta');
    stickyCta.classList.add('show');
    stickyCta.innerHTML = '<span class="price">' + (p.price > 0 ? formatPrice(p.price) : 'Price on request') + '</span>' +
      (outOfStock ? '<button class="btn btn-primary" onclick="openNotifyMe(\'' + p.id + '\')">Notify Me</button>' : '<button class="btn btn-ghost" onclick="addPdpToCart(true)">Buy Now</button><button class="btn btn-primary" onclick="addPdpToCart()">Add to Bag</button>');

    // Related products — prefer same category/fabric, exclude current, in-stock first.
    var simFilters = { limit: 12 };
    if (p.fabric) simFilters.fabric = p.fabric;
    Data.listProducts(simFilters).then(function (r) {
      var sims = r.products.filter(function (x) { return x.id !== p.id; });
      if (sims.length < 4) {
        // top up with any active products
        Data.listProducts({ limit: 12 }).then(function (r2) {
          var extra = r2.products.filter(function (x) { return x.id !== p.id && !sims.find(function (s) { return s.id === x.id; }); });
          finishRelated(sims.concat(extra).slice(0, 4));
        });
      } else { finishRelated(sims.slice(0, 4)); }
    });
    function finishRelated(list) {
      var sec = document.getElementById('sectionRelated');
      if (!list.length) { sec.style.display = 'none'; return; }
      sec.style.display = '';
      renderGridInto('#pdpSimilar', list);
    }
    observeReveal(document);
  });
}
function pdpWishBtn(p) {
  return '<button class="pdp-wish' +(Wishlist.has(p.id) ? ' active' : '') + '" data-wishlist-id="' + p.id + '" onclick="Wishlist.toggle(\'' + p.id + '\')" aria-label="Add to wishlist">' +
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7.5-4.7-10-9.3C.5 8 2.3 4 6.3 4c2 0 3.6 1.1 4.7 2.8C12.1 5.1 13.7 4 15.7 4c4 0 5.8 4 4.3 7.7-2.5 4.6-10 9.3-10 9.3z"/></svg></button>';
}
function accordionItemHtml(title, body, open) {
  return '<div class="accordion-item ' + (open ? 'open' : '') + '"><div class="accordion-head" role="button" tabindex="0" onclick="this.parentElement.classList.toggle(\'open\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click();}"><span>' + title + '</span><span class="accordion-icon">+</span></div><div class="accordion-body"><div class="inner">' + body + '</div></div></div>';
}
function setPdpImage(i) { PDPState.activeImage = i; qs('#pdpMainImg').src = PDPState.product.images[i]; qsa('.pdp-thumbs img').forEach(function (img, idx) { img.classList.toggle('active', idx === i); }); }
function setPdpColor(name) { PDPState.activeColor = name; renderProductDetail(PDPState.product.slug); }
function addPdpToCart(buyNow) {
  var p = PDPState.product;
  var variant = pickVariant(p, PDPState.activeColor);
  Cart.add(p, variant, PDPState.qty, buyNow ? { silent: true } : {});
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
  qs('#quickViewBody').innerHTML = '<div class="qv-grid"><div class="skeleton qv-media"></div><div class="qv-info"><div class="skeleton skeleton-line" style="width:40%"></div><div class="skeleton skeleton-line" style="height:36px;"></div></div></div>';
  openOverlay(); qs('#quickViewModal').classList.add('open'); document.body.style.overflow = 'hidden';
  Data.getProductBySlug(slug).then(function (p) {
    if (!p) return;
    cacheProduct(p);
    var disc = discountPercent(p.price, p.oldPrice);
    var stk = stockLabel(p);
    qs('#quickViewBody').innerHTML = '<button class="modal-close" onclick="closeAllOverlays()" aria-label="Close">&times;</button>' +
      '<div class="qv-grid">' +
      '<div class="qv-media"><img src="' + escapeHtml(imgSrc(p.images[0])) + '" alt="' + escapeHtml(p.name) + '" onerror="this.src=PLACEHOLDER_IMG"></div>' +
      '<div class="qv-info">' +
      (p.primaryCategory ? '<p class="eyebrow">' + escapeHtml(p.primaryCategory) + '</p>' : '') +
      '<h3 class="name">' + escapeHtml(p.name) + '</h3>' +
      '<div class="price-row"><span class="price">' + (p.price > 0 ? formatPrice(p.price) : 'Price on request') + '</span>' + (p.oldPrice ? '<span class="price-old">' + formatPrice(p.oldPrice) + '</span><span class="discount">' + disc + '% off</span>' : '') + '</div>' +
      (p.fabric ? '<p class="qv-meta">Fabric: ' + escapeHtml(p.fabric) + (p.blouseIncluded ? ' &middot; Blouse included' : '') + '</p>' : '') +
      '<p class="stock-status stock-' + stk.cls + '">' + stk.text + '</p>' +
      '<div class="qv-actions">' +
      (p.stock > 0 ? '<button class="btn btn-primary btn-block" onclick="closeAllOverlays();Cart.add(ProductCache[\'' + p.id + '\'], pickVariant(ProductCache[\'' + p.id + '\']));">Add to Bag</button>' : '<button class="btn btn-primary btn-block" onclick="openNotifyMe(\'' + p.id + '\')">Notify Me</button>') +
      '<a href="#/product/' + p.slug + '" class="btn btn-ghost btn-block" data-link onclick="closeAllOverlays()">View Full Details</a>' +
      '</div></div></div>';
  });
}

/* ---------------------------------------------------------
   Dedicated cart page (full-page view, distinct from the slide-out drawer).
   --------------------------------------------------------- */
function renderCartPage() {
  var el = qs('#cartPageContainer');
  if (!Cart.items.length) {
    el.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg><h3>Your bag is empty</h3><p>Six yards of possibility are waiting.</p><a href="#/sarees" class="btn btn-primary" data-link>Continue Shopping</a></div>';
    return;
  }
  var lines = Cart.items.map(function (i) {
    var vid = i.variantId ? "'" + i.variantId + "'" : 'null';
    return '<div class="cart-page-line">' +
      '<img src="' + escapeHtml(imgSrc(i.image)) + '" alt="" onerror="this.src=PLACEHOLDER_IMG">' +
      '<div>' +
      '<p class="name">' + escapeHtml(i.name) + '</p>' +
      '<p class="meta">' + [i.color, i.size, 'Code ' + i.sku].filter(Boolean).map(escapeHtml).join(' · ') + '</p>' +
      '<div class="cart-page-controls">' +
      '<div class="qty-stepper"><button aria-label="Decrease" onclick="Cart.setQty(\'' + i.productId + '\',' + vid + ',' + (i.qty - 1) + ')">&minus;</button><span>' + i.qty + '</span><button aria-label="Increase" onclick="Cart.setQty(\'' + i.productId + '\',' + vid + ',' + (i.qty + 1) + ')">+</button></div>' +
      '<button class="link-btn" onclick="Cart.remove(\'' + i.productId + '\',' + vid + ');renderCartPage();">Remove</button>' +
      '</div></div>' +
      '<div class="line-total">' + formatPrice(i.price * i.qty) + '</div>' +
      '</div>';
  }).join('');
  var fee = Cart.deliveryFee();
  el.innerHTML =
    '<div class="cart-page-layout">' +
    '<div><div class="cart-page-list">' + lines + '</div><p style="margin-top:32px;"><a href="#/sarees" class="link-arrow" data-link>Continue Shopping</a></p></div>' +
    '<aside class="cart-summary">' +
    '<h3>Order Summary</h3>' +
    '<div class="sum-row"><span>Subtotal (' + Cart.count() + ' item' + (Cart.count() === 1 ? '' : 's') + ')</span><span>' + formatPrice(Cart.subtotal()) + '</span></div>' +
    '<div class="sum-row"><span>Delivery</span><span>' + (fee === 0 ? 'Complimentary' : formatPrice(fee)) + '</span></div>' +
    (fee > 0 ? '<p class="sum-note">Complimentary delivery on orders over ' + formatPrice(Cart.FREE_SHIP_OVER) + '.</p>' : '') +
    '<div class="sum-row sum-total"><span>Total</span><span>' + formatPrice(Cart.total()) + '</span></div>' +
    '<a href="#/checkout" class="btn btn-primary btn-block" data-link>Proceed to Checkout</a>' +
    '</aside></div>';
}

/* ---------------------------------------------------------
   Checkout (payment intentionally stubbed — see supabase/functions/cashfree-*)
   --------------------------------------------------------- */
function renderCheckout() {
  if (!Cart.items.length) { qs('#checkoutContainer').innerHTML = '<div class="empty-state"><h3>Your bag is empty</h3><a href="#/sarees" class="btn btn-primary" data-link>Continue Shopping</a></div>'; return; }
  if (!Auth.user) {
    qs('#checkoutContainer').innerHTML = '<div class="empty-state"><h3>Log in to <em>continue</em></h3><p>Sign in to save your address and track this order.</p><button class="btn btn-primary" onclick="Router.pendingAfterLogin=\'/checkout\';openAuthModal(\'login\')">Log In</button></div>';
    return;
  }
  qs('#checkoutContainer').innerHTML =
    '<form id="checkoutForm" class="checkout-layout">' +
    '<div>' +
    '<div class="checkout-step"><h3 class="checkout-step-title"><span>01</span>Contact</h3>' +
    '<div class="field-row"><div class="field"><label for="ckName">Full Name</label><input required id="ckName" autocomplete="name"></div><div class="field"><label for="ckPhone">Mobile</label><input required id="ckPhone" type="tel" autocomplete="tel"></div></div>' +
    '<div class="field"><label for="ckEmail">Email</label><input type="email" id="ckEmail" autocomplete="email" value="' + escapeHtml(Auth.user.email || '') + '"></div></div>' +
    '<div class="checkout-step"><h3 class="checkout-step-title"><span>02</span>Shipping Address</h3>' +
    '<div class="field-row"><div class="field"><label for="ckHouse">House / Flat No.</label><input required id="ckHouse"></div><div class="field"><label for="ckStreet">Street / Area</label><input required id="ckStreet"></div></div>' +
    '<div class="field"><label for="ckLandmark">Landmark (optional)</label><input id="ckLandmark"></div>' +
    '<div class="field-row"><div class="field"><label for="ckCity">City</label><input required id="ckCity"></div><div class="field"><label for="ckState">State</label><input required id="ckState"></div></div>' +
    '<div class="field-row"><div class="field"><label for="ckDistrict">District</label><input id="ckDistrict"></div><div class="field"><label for="ckPincode">PIN Code</label><input required maxlength="6" inputmode="numeric" id="ckPincode"></div></div>' +
    '<div id="checkoutServiceabilityMsg" style="font-size:13px;"></div></div>' +
    '<div class="checkout-step"><h3 class="checkout-step-title"><span>03</span>Payment</h3>' +
    '<div class="pay-placeholder">Online payment (Cashfree) will appear here once configured. Structure is ready for gateway integration.</div></div>' +
    '</div>' +
    '<aside class="cart-summary">' +
    '<h3>Your Order</h3>' +
    '<div class="sum-lines">' +
    Cart.items.map(function (i) {
      return '<div class="sum-line"><img src="' + escapeHtml(imgSrc(i.image)) + '" alt="" onerror="this.src=PLACEHOLDER_IMG">' +
        '<span>' + escapeHtml(i.name) + '<small>' + [i.color, 'Qty ' + i.qty].filter(Boolean).map(escapeHtml).join(' · ') + '</small></span>' +
        '<span style="white-space:nowrap;">' + formatPrice(i.price * i.qty) + '</span></div>';
    }).join('') +
    '</div>' +
    '<div class="sum-row"><span>Subtotal</span><span>' + formatPrice(Cart.subtotal()) + '</span></div>' +
    '<div class="sum-row"><span>Delivery Charge</span><span>' + (Cart.deliveryFee() === 0 ? 'Complimentary' : formatPrice(Cart.deliveryFee())) + '</span></div>' +
    '<div class="sum-row"><span>Discount</span><span>&minus; ' + formatPrice(0) + '</span></div>' +
    '<div class="sum-row sum-total"><span>Total</span><span>' + formatPrice(Cart.total()) + '</span></div>' +
    '<button class="btn btn-primary btn-block" type="submit">Place Order</button>' +
    '<p class="fine-print">Payment via Cashfree is not yet configured for this store — see supabase/functions/cashfree-*.</p>' +
    '</aside>' +
    '</form>';

  qs('#ckPincode').addEventListener('blur', function () {
    var pin = this.value.trim();
    if (!/^\d{6}$/.test(pin)) return;
    var msg = qs('#checkoutServiceabilityMsg');
    msg.textContent = 'Checking delivery to ' + pin + '…';
    supabaseClient.functions.invoke('check-delivery', { body: { pincode: pin } }).then(function (res) {
      var ok = res.data && res.data.serviceable;
      msg.innerHTML = ok ? '<span class="msg-ok">Delivery available.</span>' : '<span class="msg-err">This PIN is currently unserviceable. Please use a different address.</span>';
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
  var nav = tabs.map(function (t) { return '<a href="#/account/' + t[0] + '" data-link class="' + (t[0] === sub ? 'active' : '') + '">' + t[1] + '</a>'; }).join('');
  var current = tabs.filter(function (t) { return t[0] === sub; })[0] || tabs[0];
  qs('#accountContainer').innerHTML =
    '<div class="page-head"><nav class="crumbs"><a href="#/" data-link>Home</a><span>/</span><span>Account</span></nav><h1 class="page-title">My <em>Account</em></h1></div>' +
    '<div class="account-layout">' +
    '<nav class="account-nav">' + nav + '<button onclick="Auth.logout().then(function(){Router.go(\'/\')})">Log Out</button></nav>' +
    '<div><p class="eyebrow">' + current[1] + '</p><div id="accountBody"><p>Loading&hellip;</p></div></div>' +
    '</div>';

  if (sub === 'orders') {
    supabaseClient.from('orders').select('*, order_items(*)').eq('customer_id', Auth.user.id).is('customer_hidden_at', null).order('created_at', { ascending: false }).then(function (res) {
      var orders = res.data || [];
      qs('#accountBody').innerHTML = orders.length ? orders.map(orderRowHtml).join('') : '<div class="empty-state" style="text-align:left;padding:24px 0;"><h3>No orders yet</h3><a href="#/sarees" class="link-arrow" data-link>Start shopping</a></div>';
    });
  } else if (sub === 'addresses') {
    supabaseClient.from('addresses').select('*').eq('customer_id', Auth.user.id).then(function (res) {
      var list = res.data || [];
      qs('#accountBody').innerHTML = (list.length ? list.map(function (a) {
        return '<div class="account-card"><strong>' + escapeHtml(a.label || 'Address') + '</strong><p>' + [a.house, a.street, a.landmark, a.city, a.district, a.state, a.pincode].filter(Boolean).map(escapeHtml).join(', ') + '</p></div>';
      }).join('') : '<div class="empty-state" style="text-align:left;padding:24px 0;"><h3>No saved addresses yet</h3><p>Addresses you use at checkout will appear here.</p></div>');
    });
  } else if (sub === 'wishlist') {
    Data.getProductsByIds(Wishlist.ids).then(function (products) { qs('#accountBody').classList.add('product-grid', 'product-grid-3'); renderGridInto('#accountBody', products, 'Your wishlist is empty.'); });
  } else if (sub === 'profile') {
    supabaseClient.from('customer_profiles').select('*').eq('id', Auth.user.id).maybeSingle().then(function (res) {
      var prof = res.data || {};
      qs('#accountBody').innerHTML = '<form id="profileForm" style="max-width:480px;">' +
        '<div class="field"><label for="profName">Full Name</label><input id="profName" value="' + escapeHtml(prof.full_name || '') + '"></div>' +
        '<div class="field"><label for="profPhone">Phone</label><input id="profPhone" type="tel" value="' + escapeHtml(prof.phone || '') + '"></div>' +
        '<div class="field"><label>Email</label><input value="' + escapeHtml(Auth.user.email || '') + '" disabled></div>' +
        '<button class="btn btn-primary" type="submit">Save Changes</button></form>';
      qs('#profileForm').addEventListener('submit', function (e) {
        e.preventDefault();
        supabaseClient.from('customer_profiles').upsert({ id: Auth.user.id, full_name: qs('#profName').value, phone: qs('#profPhone').value }).then(function () { toast('Profile updated'); });
      });
    });
  } else {
    qs('#accountBody').innerHTML = '<p class="account-welcome">Welcome back.</p><p style="color:var(--ink-soft);margin:0 0 28px;">Signed in as ' + escapeHtml(Auth.user.email) + '.</p>' +
      '<div class="link-list"><a href="#/account/orders" data-link>View orders</a><a href="#/account/addresses" data-link>Saved addresses</a><a href="#/account/wishlist" data-link>Wishlist</a></div>';
  }
}
function orderRowHtml(o) {
  return '<div class="account-card">' +
    '<div class="order-head"><strong>#' + escapeHtml(o.order_number) + '</strong><span class="price">' + formatPrice(o.total) + '</span></div>' +
    '<p>' + new Date(o.created_at).toLocaleDateString() + ' &middot; ' + (o.order_items || []).length + ' item(s)</p>' +
    '<span class="order-status">' + escapeHtml(o.status.replace(/_/g, ' ')) + '</span>' +
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
  qs('#staticContainer').innerHTML = '<div class="page-head"><nav class="crumbs"><a href="#/" data-link>Home</a><span>/</span><span>' + page.title + '</span></nav><h1 class="page-title">' + page.title + '</h1></div><div class="prose">' + page.body + '</div>';
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
qs('#closeCartDrawer').addEventListener('click', function () { Cart.close(); });
qs('#wishlistBtn').addEventListener('click', function () { Router.go('/wishlist'); });
qs('#accountBtn').addEventListener('click', function () { Auth.user ? Router.go('/account') : openAuthModal('login'); });
qs('#mobileMenuBtn').addEventListener('click', function () {
  qs('#mobileNavSheetBody').innerHTML = '<nav class="mobile-nav-links">' + ['Home:/', 'New Arrivals:/new-arrivals', 'Sarees:/sarees', 'Collections:/collections', 'Occasions:/occasions', 'Offers:/offers', 'Our Story:/about'].map(function (l) {
    var p = l.split(':'); return '<a href="#' + p[1] + '" data-link onclick="closeAllOverlays()">' + p[0] + '</a>';
  }).join('') + '</nav>' +
    '<div class="mobile-nav-sub">' +
    '<a href="#/wishlist" data-link>Wishlist (' + Wishlist.ids.length + ')</a>' +
    '<button onclick="closeAllOverlays();' + (Auth.user ? 'Router.go(\'/account\')' : 'openAuthModal(\'login\')') + '">' + (Auth.user ? 'My Account' : 'Log In / Sign Up') + '</button>' +
    '<a href="#/contact" data-link>Help &amp; Contact</a>' +
    '</div>';
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
    var navKey = parts[0] || 'home';
    if (navKey === 'sarees' && (query.featured || query.best || query.sale)) navKey = '';
    qsa('#mainNav a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-nav') === navKey); });
    document.title = 'Zari | Sarees for Every Story'; // PDP / static pages override this

    if (path === '/') { this.show('home'); renderHome(); }
    else if (parts[0] === 'sarees' || parts[0] === 'new-arrivals' || parts[0] === 'collections' || parts[0] === 'occasions' || parts[0] === 'offers' || parts[0] === 'search') { this.show('catalog'); renderCatalog(parts[0], query); }
    else if (parts[0] === 'product' && parts[1]) { this.show('product'); renderProductDetail(parts[1]); }
    else if (parts[0] === 'wishlist') { this.show('wishlist'); Data.getProductsByIds(Wishlist.ids).then(function (products) { renderGridInto('#wishlistGrid', products, 'Your wishlist is empty.'); }); }
    else if (parts[0] === 'checkout') { this.show('checkout'); renderCheckout(); }
    else if (parts[0] === 'cart') { this.show('cart'); renderCartPage(); }
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
