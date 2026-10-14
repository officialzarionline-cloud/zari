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
  deliveryFee: function () { var s = this.subtotal(); return s === 0 || (this.FREE_SHIP_OVER > 0 && s >= this.FREE_SHIP_OVER) ? 0 : this.FLAT_SHIP; },
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
      '<p class="drawer-note">' + (fee === 0 ? 'Complimentary delivery on this order.' : this.FREE_SHIP_OVER > 0 ? 'Add ' + formatPrice(this.FREE_SHIP_OVER - this.subtotal()) + ' more for complimentary delivery.' : 'Delivery: ' + formatPrice(fee) + '.') + '</p>' +
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
    if (Auth.user) Auth.mergeFromServer();
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
  // Product ids in a category (by slug), including its subcategories. Filtering on an
  // embedded column doesn't narrow the parent rows in PostgREST, so resolve ids first.
  productIdsInCategory: function (slug) {
    return Data.getCategories().then(function (all) {
      var root = all.filter(function (c) { return c.slug === slug; })[0];
      if (!root) return null;
      var ids = [root.id];
      (function add(pid) { all.forEach(function (c) { if (c.parent_id === pid) { ids.push(c.id); add(c.id); } }); })(root.id);
      return supabaseClient.from('product_categories').select('product_id').in('category_id', ids).then(function (r) {
        return { category: root, ids: Array.from(new Set((r.data || []).map(function (x) { return x.product_id; }))) };
      });
    });
  },
  listProducts: function (filters) {
    filters = filters || {};
    // Category / fabric / occasion pages: resolve to product ids via the category tree.
    var slugFilter = filters.categorySlug || filters.fabric || filters.occasion;
    if (slugFilter && !IS_DEMO && !filters._resolved) {
      return Data.productIdsInCategory(slugFilter).then(function (res) {
        var rest = Object.assign({}, filters, { categorySlug: null, _resolved: true });
        if (res) { rest.fabric = null; rest.occasion = null; rest.ids = res.ids.length ? res.ids : ['00000000-0000-0000-0000-000000000000']; rest.category = res.category; }
        else if (filters.categorySlug) return { products: [], count: 0, error: null };
        return Data.listProducts(rest).then(function (r) { r.category = rest.category || null; return r; });
      }).catch(function (err) { return { products: [], count: 0, error: err }; });
    }
    var query = supabaseClient.from('products').select(PRODUCT_SELECT, { count: 'exact' }).eq('status', 'active');
    if (filters.ids) query = query.in('id', filters.ids);
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
      // Strip characters that have meaning in PostgREST filter syntax.
      var t = String(filters.search).replace(/[,()*%\\:"']/g, ' ').trim().slice(0, 80);
      if (t) query = query.or(['name.ilike.*' + t + '*', 'sku.ilike.*' + t + '*', 'fabric.ilike.*' + t + '*', 'occasion.ilike.*' + t + '*', 'weave.ilike.*' + t + '*', 'description.ilike.*' + t + '*'].join(','));
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
  getActiveBanners: function (placement) {
    return supabaseClient.from('banners').select('*').eq('placement', placement || 'hero').order('priority', { ascending: false }).order('created_at', { ascending: false })
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
        // Order lines are private, so the ranking by paid quantity is computed in the database.
        return supabaseClient.rpc('public_best_seller_ids', { p_limit: limit })
          .then(function (r2) {
            if (r2.error || !r2.data || !r2.data.length) return { products: [], error: null };
            var rankedIds = r2.data.map(function (x) { return typeof x === 'string' ? x : x.public_best_seller_ids || x.id; });
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
   Website settings, homepage layout and content pages — all managed in /admin
   and read live from the database on every page load (no code changes needed).
   Anything missing falls back to what the page already shows.
   --------------------------------------------------------- */
// Links typed into the admin may only be store pages (#/...) or http(s) URLs.
function safeLink(u, fallback) {
  u = String(u == null ? '' : u).trim();
  return /^#\//.test(u) || /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : (fallback || '#/');
}
function linkAttrs(u) { return /^#\//.test(u) ? 'data-link' : 'target="_blank" rel="noopener noreferrer"'; }
// "New *Arrivals*" → New <em>Arrivals</em> (text is escaped first).
function titleHtml(t) { return escapeHtml(t).replace(/\*([^*]+)\*/g, '<em>$1</em>'); }
// Same plain-text rules as the admin editor: paragraphs, ## headings, - bullets,
// **bold**, [text](https://… | #/… | mailto:…). Everything else is escaped.
function richText(src) {
  function inline(x) {
    return escapeHtml(x).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|#\/[^\s)]*|mailto:[^\s)]+)\)/g, function (m, t, u) { return '<a href="' + u + '"' + (/^#\//.test(u) ? ' data-link' : /^https?:/.test(u) ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + t + '</a>'; });
  }
  return String(src || '').split(/\n{2,}/).map(function (block) {
    block = block.trim();
    if (!block) return '';
    if (/^##\s+/.test(block)) return '<h2>' + inline(block.replace(/^##\s+/, '')) + '</h2>';
    var lines = block.split('\n');
    if (lines.every(function (l) { return /^\s*[-•]\s+/.test(l); })) return '<ul>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^\s*[-•]\s+/, '')) + '</li>'; }).join('') + '</ul>';
    return '<p>' + lines.map(inline).join('<br>') + '</p>';
  }).join('');
}

var Site = {
  settings: {}, sections: {}, sectionOrder: [], pages: {}, ready: null, loadedAt: 0,
  load: function () {
    Site.loadedAt = Date.now();
    Site.ready = Promise.all([
      supabaseClient.from('site_settings').select('key,value').then(function (r) { return r.data || []; }, function () { return []; }),
      supabaseClient.from('homepage_sections').select('*').order('sort_order').then(function (r) { return r.data || []; }, function () { return []; })
    ]).then(function (r) {
      Site.settings = {};
      r[0].forEach(function (row) { Site.settings[row.key] = row.value || {}; });
      Site.sections = {}; Site.sectionOrder = [];
      r[1].forEach(function (sec) { Site.sections[sec.key] = sec; Site.sectionOrder.push(sec.key); });
      Site.apply();
    }).catch(function () {});
    return Site.ready;
  },
  get: function (key) { return Site.settings[key] || {}; },
  storeName: function () { return Site.get('store').name || 'Zari'; },
  apply: function () {
    var store = Site.get('store'), ship = Site.get('shipping'), ann = Site.settings.announcement, foot = Site.get('footer'), social = Site.get('social'), seo = Site.get('seo');
    // Delivery rules shown in the bag (checkout re-prices on the server with the same settings).
    if (ship.free_shipping_over != null && isFinite(Number(ship.free_shipping_over))) Cart.FREE_SHIP_OVER = Number(ship.free_shipping_over);
    if (ship.flat_fee != null && isFinite(Number(ship.flat_fee))) Cart.FLAT_SHIP = Number(ship.flat_fee);
    Cart.updateBadge();
    // Announcement bar
    var bar = qs('#announcementBar');
    if (bar && ann) {
      bar.classList.toggle('hidden', ann.enabled === false || !ann.text);
      var link = ann.link ? safeLink(ann.link, '') : '';
      bar.innerHTML = link ? '<a href="' + escapeHtml(link) + '" ' + linkAttrs(link) + '>' + escapeHtml(ann.text || '') + '</a>' : escapeHtml(ann.text || '');
    }
    // Footer
    if (foot.tagline && qs('#footerTagline')) qs('#footerTagline').textContent = foot.tagline;
    if (foot.bottom_note && qs('#footerNote')) qs('#footerNote').textContent = foot.bottom_note;
    var soc = ['instagram', 'facebook', 'youtube', 'pinterest'].filter(function (k) { return social[k] && /^https?:\/\//i.test(social[k]); });
    if (qs('#footerSocial')) qs('#footerSocial').innerHTML = soc.map(function (k) { return '<a href="' + escapeHtml(safeLink(social[k])) + '" target="_blank" rel="noopener noreferrer">' + k.charAt(0).toUpperCase() + k.slice(1) + '</a>'; }).join('');
    // Branding
    if (store.logo_url && /^https?:\/\//i.test(store.logo_url)) qsa('img[src$="assets/logo.png"]').forEach(function (img) { img.src = store.logo_url; });
    if (store.favicon_url && /^https?:\/\//i.test(store.favicon_url)) { var fav = qs('link[rel="icon"]'); if (fav) fav.href = store.favicon_url; }
    if (seo.meta_description) { var md = qs('meta[name="description"]'); if (md) md.setAttribute('content', seo.meta_description); }
    if (location.hash.replace(/^#\/?/, '') === '') document.title = seo.meta_title || (Site.storeName() + ' | ' + (store.tagline || 'Sarees for Every Story'));
  },
  pageTitle: function (t) { return t + ' | ' + Site.storeName(); },
  // Content pages, cached for this page load.
  page: function (slug) {
    if (Site.pages[slug]) return Promise.resolve(Site.pages[slug]);
    return supabaseClient.from('content_pages').select('*').eq('slug', slug).eq('is_published', true).maybeSingle()
      .then(function (r) { if (r.data) Site.pages[slug] = r.data; return r.data || null; }, function () { return null; });
  }
};
Site.load();
// Pick up admin changes when the shopper comes back to the tab after a while.
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && Date.now() - Site.loadedAt > 60000) {
    Data.categoriesCache = null; Site.pages = {};
    Site.load().then(function () { if (location.hash.replace(/^#\/?/, '') === '') Router.handle(); });
  }
});

// Homepage: section order, visibility and copy from homepage_sections.
var HOME_SECTION_EL = {
  hero: '#homeHero', marquee: '#sectionMarquee', new_arrivals: '#sectionNewArrivals', shop_by_type: '#sectionShopByType',
  featured: '#sectionFeaturedCollection', promo: '#sectionPromo', shop_by: '#sectionShopBy', story: '#sectionStory',
  best_sellers: '#sectionBestSellers', offers: '#sectionOfferProducts', campaign: '#sectionCampaign', more_styles: '#sectionMoreStyles',
  reviews: '#sectionReviews', newsletter: '#sectionNewsletter'
};
function sectionLimit(key, fallback) {
  var c = (Site.sections[key] || {}).config || {};
  var n = Number(c.limit);
  return n >= 4 && n <= 24 ? Math.round(n) : fallback;
}
function heroDefaultHtml() {
  var h = Site.sections.hero, c = (h && h.config) || {};
  if (!h) return null;
  var cta = safeLink(c.cta_link, '#/sarees'), sec = c.secondary_link ? safeLink(c.secondary_link, '') : '';
  return (h.eyebrow ? '<p class="eyebrow">' + escapeHtml(h.eyebrow) + '</p>' : '') +
    '<h1 class="hero-title">' + titleHtml(h.title || 'Sarees woven for *every story*') + '</h1>' +
    (h.subtitle ? '<p class="hero-lede">' + escapeHtml(h.subtitle) + '</p>' : '') +
    '<div class="hero-actions"><a href="' + escapeHtml(cta) + '" class="btn btn-primary" ' + linkAttrs(cta) + '>' + escapeHtml(c.cta_text || 'Shop Sarees') + '</a>' +
    (sec && c.secondary_text ? '<a href="' + escapeHtml(sec) + '" class="link-arrow" ' + linkAttrs(sec) + '>' + escapeHtml(c.secondary_text) + '</a>' : '') + '</div>';
}
function applyHomeSections() {
  if (!Site.sectionOrder.length) return;
  var home = qs('#view-home');
  var tail = qs('#sectionCompleteLook');
  Site.sectionOrder.forEach(function (key) {
    var sec = Site.sections[key], el = qs(HOME_SECTION_EL[key] || '#none');
    if (!el) return;
    home.insertBefore(el, tail);
    el.classList.toggle('admin-hidden', !sec.is_visible);
    var head = el.querySelector('.section-head, .weave-intro, .story-inner, .newsletter > div:first-child');
    if (head && key !== 'hero') {
      var eb = head.querySelector('.eyebrow'), tt = head.querySelector('.section-title, .story-quote'), sub = head.querySelector('.section-copy, .story-copy');
      if (eb && sec.eyebrow != null) eb.textContent = sec.eyebrow;
      if (tt && sec.title) tt.innerHTML = key === 'story' ? escapeHtml(sec.title) : titleHtml(sec.title);
      if (sub && sec.subtitle != null) sub.textContent = sec.subtitle;
    }
    var c = sec.config || {};
    if (key === 'story' && c.link) { var a = el.querySelector('.link-arrow'); if (a) { var l = safeLink(c.link, '#/about'); a.setAttribute('href', l); a.textContent = c.link_text || a.textContent; } }
    if (key === 'marquee' && Array.isArray(c.items) && c.items.length) {
      var once = c.items.map(function (t) { return '<span>' + escapeHtml(t) + '</span><i>&#10022;</i>'; }).join('');
      el.querySelector('.marquee-track').innerHTML = once + once;
    }
  });
  var hero = heroDefaultHtml();
  if (hero) HeroBanner.defaultHtml = hero;
}

// Promotional banners (placement = promo), shown as editorial blocks on the homepage.
function renderPromoBanners() {
  Data.getActiveBanners('promo').then(function (rows) {
    var sec = qs('#sectionPromo');
    if (!sec) return;
    sec.style.display = rows.length ? '' : 'none';
    qs('#promoBanners').innerHTML = rows.map(function (b, i) {
      var link = safeLink(b.cta_link, '#/sarees');
      return '<div class="promo-card' + (i % 2 ? ' promo-card-flip' : '') + ' reveal">' +
        '<a class="promo-media" href="' + escapeHtml(link) + '" ' + linkAttrs(link) + '><img src="' + escapeHtml(b.image_url) + '" alt="' + escapeHtml(b.title) + '" loading="lazy"></a>' +
        '<div class="promo-copy">' + (b.offer_text ? '<span class="hero-offer-badge">' + escapeHtml(b.offer_text) + '</span>' : '') +
        '<h2 class="section-title">' + titleHtml(b.title) + '</h2>' + (b.subtitle ? '<p class="section-copy">' + escapeHtml(b.subtitle) + '</p>' : '') +
        '<a href="' + escapeHtml(link) + '" class="link-arrow" ' + linkAttrs(link) + '>' + escapeHtml(b.cta_text || 'Shop now') + '</a></div></div>';
    }).join('');
    observeReveal(sec);
  });
}

/* ---------------------------------------------------------
   Product card / grid rendering
   --------------------------------------------------------- */
function productCardHtml(p) {
  cacheProduct(p);
  var img1 = imgSrc(p.images[0]);
  var img2 = p.images[1] ? p.images[1] : img1;
  var disc = discountPercent(p.price, p.oldPrice);
  var priced = p.price > 0;              // no price yet => catalogue-only card (no cart/stock)
  var outOfStock = priced && p.stock <= 0;
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
    (!priced
      ? '<a class="primary" href="#/product/' + p.slug + '" data-link>View Details</a>'
      : outOfStock
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
    (priced ? '<p class="stock-status stock-' + stk.cls + '">' + stk.text + '</p>' : '<p class="stock-status stock-in">Available to order</p>') +
    (p.colors.length > 1 ? '<div class="swatches">' + p.colors.slice(0, 5).map(function (c) { return '<span class="swatch" style="background:' + escapeHtml(c.hex || '#ccc') + '" title="' + escapeHtml(c.name) + '"></span>'; }).join('') + '</div>' : '') +
    '</div>' +
    '<div class="card-actions">' +
    (!priced
      ? '<a class="link-btn strong" href="#/product/' + p.slug + '" data-link>View Details</a>'
      : outOfStock
        ? '<button class="link-btn strong" onclick="openNotifyMe(\'' + p.id + '\')">Notify Me</button>'
        : '<button class="link-btn strong" onclick="cardAddToCart(\'' + p.id + '\')">Add to Bag</button>' +
          '<button class="link-btn" onclick="cardBuyNow(\'' + p.id + '\')">Buy Now</button>') +
    (priced ? '<a class="link-btn" href="#/product/' + p.slug + '" data-link>Details</a>' : '') +
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
      '<a href="' + escapeHtml(safeLink(b.cta_link, '#/sarees')) + '" class="btn btn-primary" ' + linkAttrs(safeLink(b.cta_link, '#/sarees')) + '>' + escapeHtml(b.cta_text || 'Shop Now') + '</a>' +
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
  // Section order / visibility / copy come from the admin; hero waits for them so the
  // default hero text shown when no banner is live is the admin's text.
  (Site.ready || Promise.resolve()).then(function () { applyHomeSections(); HeroBanner.load(); renderHomeRails(); });
  renderPromoBanners();

  Data.getCategories('saree_type').then(function (cats) {
    cats = cats.filter(function (c) { return !c.parent_id; }); // subcategories live on the category page filters
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

  Data.getLiveCampaign().then(function (c) {
    var section = document.getElementById('sectionCampaign');
    if (!c) { section.style.display = 'none'; return; }
    section.style.display = '';
    var bc = c.banner_config || {}, link = safeLink(bc.link, '#/offers');
    qs('#campaignBanner').innerHTML = '<div class="campaign"><p class="eyebrow">Live Now</p><h2>' + escapeHtml(c.name) + '</h2>' +
      (bc.text ? '<p class="story-copy" style="margin:-12px auto 28px;">' + escapeHtml(bc.text) + '</p>' : '') +
      '<a href="' + escapeHtml(link) + '" class="link-arrow link-arrow-light" ' + linkAttrs(link) + '>' + escapeHtml(bc.link_text || 'Shop the offer') + '</a></div>';
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

function renderHomeRails() {
  Data.listProducts({ newArrival: true, limit: sectionLimit('new_arrivals', 8) }).then(function (r) { renderGridInto('#newArrivalsGrid', r.products, 'New arrivals will appear here soon.', !!r.error); });
  // Featured grid leads with one large card (2x2) + four regular — 5 fills the layout cleanly.
  Data.listProducts({ featured: true, limit: 5 }).then(function (r) {
    document.getElementById('sectionFeaturedCollection').style.display = (r.products.length || r.error) ? '' : 'none';
    renderGridInto('#featuredGrid', r.products, 'Featured picks are on the way.', !!r.error);
  });
  Data.listProducts({ limit: sectionLimit('more_styles', 8) }).then(function (r) { renderGridInto('#moreStylesGrid', r.products, 'Our collection is on its way.', !!r.error); });
  Data.getBestSellers(sectionLimit('best_sellers', 8)).then(function (r) {
    document.getElementById('sectionBestSellers').style.display = (r.products.length || r.error) ? '' : 'none';
    renderGridInto('#bestSellersGrid', r.products, '', !!r.error);
  });
  Data.listOnSale(sectionLimit('offers', 8)).then(function (r) {
    document.getElementById('sectionOfferProducts').style.display = (r.products.length || r.error) ? '' : 'none';
    renderGridInto('#offerProductsGrid', r.products, '', !!r.error);
  });
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
    if (r.category) { qs('#catalogTitle').textContent = r.category.name; qs('#catalogCrumb').textContent = r.category.name; document.title = Site.pageTitle(r.category.name); }
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
  // Parents first, each followed by its subcategories (indented).
  var ordered = [], depth = {};
  (function walk(pid, d) {
    cats.filter(function (c) { return (c.parent_id || null) === pid; }).forEach(function (c) { depth[c.id] = d; ordered.push(c); walk(c.id, d + 1); });
  })(null, 0);
  cats.forEach(function (c) { if (ordered.indexOf(c) === -1) { depth[c.id] = 0; ordered.push(c); } });
  return '<div class="filter-group"><h4>' + label + '</h4>' + ordered.map(function (c) {
    var on = query && query[param] === c.slug;
    return '<label class="filter-option' + (on ? ' is-active' : '') + '"' + (depth[c.id] ? ' style="padding-left:' + (depth[c.id] * 18) + 'px"' : '') + '><input type="checkbox"' + (on ? ' checked' : '') + ' onchange="location.hash=this.checked?\'#/sarees?' + param + '=' + c.slug + '\':\'#/sarees\'"> ' + escapeHtml(c.name) + '</label>';
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
    document.title = Site.pageTitle(p.seoTitle || p.name);
    var metaDesc = qs('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', p.seoDescription || String(p.description || '').replace(/\s+/g, ' ').slice(0, 160) || (Site.get('seo').meta_description || ''));
    var disc = discountPercent(p.price, p.oldPrice);
    var priced = p.price > 0;
    var outOfStock = priced && p.stock <= 0;
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
      (priced && Site.get('tax').prices_include_tax !== false ? '<p class="pdp-tax">Inclusive of all taxes</p>' : priced && Site.get('tax').enabled ? '<p class="pdp-tax">Plus GST at checkout</p>' : '') +
      '<div class="pdp-meta-row"><span>Code ' + escapeHtml(p.sku) + '</span><span class="stock-status stock-' + (priced ? stk.cls : 'in') + '">' + (priced ? stk.text : 'Available to order') + '</span></div>' +
      (p.colors.length ? '<div class="pdp-option"><p class="pdp-option-label">Colour<span>' + escapeHtml(PDPState.activeColor || '') + '</span></p><div class="swatches">' +
        p.colors.map(function (c) { return '<span class="swatch ' + (c.name === PDPState.activeColor ? 'active' : '') + '" style="background:' + escapeHtml(c.hex || '#ccc') + '" onclick="setPdpColor(\'' + escapeHtml(c.name) + '\')" title="' + escapeHtml(c.name) + '"></span>'; }).join('') + '</div></div>' : '') +
      (!priced
        ? '<div class="pdp-buy-row"><button class="btn btn-primary" onclick="openNotifyMe(\'' + p.id + '\')">Enquire About This Product</button>' + pdpWishBtn(p) + '</div><p class="pdp-tax">Price and availability will be confirmed by Zari.</p>'
        : outOfStock
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
        accordionItemHtml('Delivery Information', 'Delivery availability is checked by PIN code at checkout. Serviceable orders are typically dispatched within ' + escapeHtml(Site.get('shipping').dispatch_days || '2–4 business days') + '. Enter your PIN above to confirm delivery to your area.' +
          (Cart.FREE_SHIP_OVER > 0 ? ' Delivery is complimentary on orders over ' + formatPrice(Cart.FREE_SHIP_OVER) + '.' : ''), false) +
        '<div id="pdpReturns">' + accordionItemHtml('Return &amp; Exchange', 'Returns and exchanges are handled on a case-by-case basis for damaged or wrong items. Please contact support within 48 hours of delivery with your order number and photos. (Final return policy to be confirmed by Zari.)', false) + '</div>' +
      '</div>' +
      '</div>';

    var stickyCta = qs('#pdpStickyCta');
    stickyCta.classList.add('show');
    stickyCta.innerHTML = '<span class="price">' + (p.price > 0 ? formatPrice(p.price) : 'Price on request') + '</span>' +
      (!priced ? '<button class="btn btn-primary" onclick="openNotifyMe(\'' + p.id + '\')">Enquire</button>'
        : outOfStock ? '<button class="btn btn-primary" onclick="openNotifyMe(\'' + p.id + '\')">Notify Me</button>'
        : '<button class="btn btn-ghost" onclick="addPdpToCart(true)">Buy Now</button><button class="btn btn-primary" onclick="addPdpToCart()">Add to Bag</button>');

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
    // Return policy text comes from the admin-managed "returns" page when it exists.
    Site.page('returns').then(function (pg) {
      var box = qs('#pdpReturns');
      if (pg && pg.body && box) box.innerHTML = accordionItemHtml('Return &amp; Exchange', richText(pg.body) + '<p><a href="#/returns" data-link>Read the full policy</a></p>', false);
    });
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
    var priced = p.price > 0;
    var stk = stockLabel(p);
    qs('#quickViewBody').innerHTML = '<button class="modal-close" onclick="closeAllOverlays()" aria-label="Close">&times;</button>' +
      '<div class="qv-grid">' +
      '<div class="qv-media"><img src="' + escapeHtml(imgSrc(p.images[0])) + '" alt="' + escapeHtml(p.name) + '" onerror="this.src=PLACEHOLDER_IMG"></div>' +
      '<div class="qv-info">' +
      (p.primaryCategory ? '<p class="eyebrow">' + escapeHtml(p.primaryCategory) + '</p>' : '') +
      '<h3 class="name">' + escapeHtml(p.name) + '</h3>' +
      '<div class="price-row"><span class="price">' + (p.price > 0 ? formatPrice(p.price) : 'Price on request') + '</span>' + (p.oldPrice ? '<span class="price-old">' + formatPrice(p.oldPrice) + '</span><span class="discount">' + disc + '% off</span>' : '') + '</div>' +
      (p.fabric ? '<p class="qv-meta">Fabric: ' + escapeHtml(p.fabric) + (p.blouseIncluded ? ' &middot; Blouse included' : '') + '</p>' : '') +
      '<p class="qv-meta">Code: ' + escapeHtml(p.sku) + '</p>' +
      '<p class="stock-status stock-' + (priced ? stk.cls : 'in') + '">' + (priced ? stk.text : 'Available to order') + '</p>' +
      '<div class="qv-actions">' +
      (!priced ? '' : p.stock > 0 ? '<button class="btn btn-primary btn-block" onclick="closeAllOverlays();Cart.add(ProductCache[\'' + p.id + '\'], pickVariant(ProductCache[\'' + p.id + '\']));">Add to Bag</button>' : '<button class="btn btn-primary btn-block" onclick="openNotifyMe(\'' + p.id + '\')">Notify Me</button>') +
      '<a href="#/product/' + p.slug + '" class="btn ' + (priced ? 'btn-ghost' : 'btn-primary') + ' btn-block" data-link onclick="closeAllOverlays()">View Full Details</a>' +
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
    (fee > 0 && Cart.FREE_SHIP_OVER > 0 ? '<p class="sum-note">Complimentary delivery on orders over ' + formatPrice(Cart.FREE_SHIP_OVER) + '.</p>' : '') +
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
    '<div class="coupon-row"><label class="sr-only" for="ckCoupon">Coupon code</label><input id="ckCoupon" maxlength="30" placeholder="Coupon code" autocomplete="off"><button type="button" class="btn btn-ghost btn-sm" id="ckApplyCoupon">Apply</button></div>' +
    '<p class="sum-note" id="ckCouponMsg" role="status"></p>' +
    '<div class="sum-row"><span>Subtotal</span><span id="ckSubtotal">' + formatPrice(Cart.subtotal()) + '</span></div>' +
    '<div class="sum-row"><span>Delivery Charge</span><span id="ckShip">' + (Cart.deliveryFee() === 0 ? 'Complimentary' : formatPrice(Cart.deliveryFee())) + '</span></div>' +
    '<div class="sum-row"><span>Discount</span><span id="ckDiscount">&minus; ' + formatPrice(0) + '</span></div>' +
    '<div class="sum-row hidden" id="ckTaxRow"><span id="ckTaxLabel">GST</span><span id="ckTax"></span></div>' +
    '<div class="sum-row sum-total"><span>Total</span><span id="ckTotal">' + formatPrice(Cart.total()) + '</span></div>' +
    '<div id="ckAccountMsg"></div>' +
    '<button class="btn btn-primary btn-block" type="submit">Place Order</button>' +
    '<p class="fine-print">Payment via Cashfree is not yet configured for this store — see supabase/functions/cashfree-*.</p>' +
    '</aside>' +
    '</form>';

  // Totals are re-priced on the server from database prices and the store's
  // shipping/tax settings; a coupon is validated there too.
  var appliedCoupon = null;
  function quote(code) {
    if (IS_DEMO) return;
    var items = Cart.items.map(function (i) { return { product_id: i.productId, qty: i.qty }; });
    supabaseClient.rpc('quote_cart', { p_items: items, p_coupon: code || null }).then(function (res) {
      var msg = qs('#ckCouponMsg');
      if (res.error) { if (code) msg.innerHTML = '<span class="msg-err">' + escapeHtml(/too many/i.test(res.error.message) ? res.error.message : 'Couldn’t check that coupon right now.') + '</span>'; return; }
      var q = res.data;
      qs('#ckSubtotal').textContent = formatPrice(q.subtotal);
      qs('#ckShip').textContent = Number(q.shipping_fee) === 0 ? 'Complimentary' : formatPrice(q.shipping_fee);
      qs('#ckDiscount').innerHTML = '&minus; ' + formatPrice(q.discount);
      qs('#ckTotal').textContent = formatPrice(q.total);
      var tax = Site.get('tax');
      qs('#ckTaxRow').classList.toggle('hidden', !(Number(q.tax) > 0));
      qs('#ckTaxLabel').textContent = 'GST' + (tax.rate_percent ? ' ' + tax.rate_percent + '%' : '') + (tax.prices_include_tax !== false ? ' (included)' : '');
      qs('#ckTax').textContent = formatPrice(q.tax);
      if (q.coupon) {
        appliedCoupon = q.coupon.valid ? q.coupon.code : null;
        msg.innerHTML = '<span class="' + (q.coupon.valid ? 'msg-ok' : 'msg-err') + '">' + escapeHtml(q.coupon.message || '') + '</span>';
      } else msg.textContent = '';
    });
  }
  quote(null);
  qs('#ckApplyCoupon').addEventListener('click', function () {
    var code = qs('#ckCoupon').value.trim().toUpperCase();
    if (!code) { appliedCoupon = null; quote(null); return; }
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) { qs('#ckCouponMsg').innerHTML = '<span class="msg-err">This coupon code is not valid.</span>'; return; }
    quote(code);
  });
  qs('#ckCoupon').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); qs('#ckApplyCoupon').click(); } });
  // Suspended accounts can't place orders (also enforced on the server).
  supabaseClient.rpc('is_customer_active').then(function (res) {
    if (res.data === false) {
      qs('#ckAccountMsg').innerHTML = '<p class="sum-note msg-err">Your account can’t place orders right now. Please contact us.</p>';
      qs('#checkoutForm button[type=submit]').disabled = true;
    }
  });

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
  faq: { title: 'Frequently Asked Questions', body: '<p>Answers to common questions about sizing, fabric care, shipping and returns will appear here.</p>' },
  returns: { title: 'Return &amp; Refund Policy', body: '<p>Returns and exchanges are handled on a case-by-case basis for damaged or wrong items. Please contact support within 48 hours of delivery with your order number and photos. (Final return policy to be confirmed by Zari.)</p>' }
};
// Page text comes from the admin (content_pages); the built-in text above is the
// fallback if the database can't be reached. Custom pages live at #/page/<slug>.
function renderStatic(key, isCustom) {
  var fallback = isCustom ? null : STATIC_PAGES[key];
  var box = qs('#staticContainer');
  box.innerHTML = '<div class="page-head"><div class="skeleton skeleton-line" style="width:40%;height:44px;"></div></div>';
  Site.page(key).then(function (pg) {
    if (!pg && !fallback) { Router.notFound(); return; }
    var title = pg ? escapeHtml(pg.title) : fallback.title;
    var body = pg ? richText(pg.body) : fallback.body;
    document.title = Site.pageTitle(pg ? (pg.seo_title || pg.title) : fallback.title.replace(/&amp;/g, '&'));
    if (pg && pg.seo_description) { var md = qs('meta[name="description"]'); if (md) md.setAttribute('content', pg.seo_description); }
    var extra = '';
    if (key === 'contact') {
      var c = Site.get('contact');
      var rows = [
        c.email ? '<p><strong>Email</strong><br><a href="mailto:' + escapeHtml(c.email) + '">' + escapeHtml(c.email) + '</a></p>' : '',
        c.phone ? '<p><strong>Phone</strong><br><a href="tel:' + escapeHtml(c.phone.replace(/\s+/g, '')) + '">' + escapeHtml(c.phone) + '</a></p>' : '',
        c.whatsapp ? '<p><strong>WhatsApp</strong><br><a href="https://wa.me/' + escapeHtml(String(c.whatsapp).replace(/\D/g, '')) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(c.whatsapp) + '</a></p>' : '',
        c.address ? '<p><strong>Address</strong><br>' + escapeHtml(c.address).replace(/\n/g, '<br>') + '</p>' : '',
        c.hours ? '<p><strong>Hours</strong><br>' + escapeHtml(c.hours) + '</p>' : ''
      ].join('');
      extra = rows + (c.email ? '<p><a class="btn btn-primary" href="mailto:' + escapeHtml(c.email) + '">Email us</a></p>' : '');
    }
    box.innerHTML = '<div class="page-head"><nav class="crumbs"><a href="#/" data-link>Home</a><span>/</span><span>' + title + '</span></nav><h1 class="page-title">' + title + '</h1></div><div class="prose">' + body + extra + '</div><div id="faqList"></div>';
    if (key === 'faq') {
      supabaseClient.from('faq_items').select('question,answer').eq('is_visible', true).order('sort_order').then(function (r) {
        var items = r.data || [];
        if (items.length) qs('#faqList').innerHTML = '<div style="max-width:720px;margin-top:32px;">' + items.map(function (f) { return accordionItemHtml(escapeHtml(f.question), richText(f.answer), false); }).join('') + '</div>';
      });
    }
  });
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
    document.title = (Site.get('seo').meta_title) || 'Zari | Sarees for Every Story'; // PDP / static pages override this

    if (path === '/') { this.show('home'); renderHome(); }
    else if (parts[0] === 'sarees' || parts[0] === 'new-arrivals' || parts[0] === 'collections' || parts[0] === 'occasions' || parts[0] === 'offers' || parts[0] === 'search') { this.show('catalog'); renderCatalog(parts[0], query); }
    else if (parts[0] === 'product' && parts[1]) { this.show('product'); renderProductDetail(parts[1]); }
    else if (parts[0] === 'wishlist') { this.show('wishlist'); Data.getProductsByIds(Wishlist.ids).then(function (products) { renderGridInto('#wishlistGrid', products, 'Your wishlist is empty.'); }); }
    else if (parts[0] === 'checkout') { this.show('checkout'); renderCheckout(); }
    else if (parts[0] === 'cart') { this.show('cart'); renderCartPage(); }
    else if (parts[0] === 'account') { this.show('account'); renderAccount(parts[1]); }
    else if (STATIC_PAGES[parts[0]]) { this.show('static'); renderStatic(parts[0]); }
    else if (parts[0] === 'page' && parts[1] && /^[a-z0-9-]{2,60}$/.test(parts[1])) { this.show('static'); renderStatic(parts[1], true); }
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
