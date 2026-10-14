/* =========================================================
   Zari Admin — website settings (site_settings rows). Everything here is
   public, non-secret configuration. Payment gateway credentials are NEVER
   stored or entered here: they live in Supabase Edge Function secrets, and
   this page only shows whether they've been set.
   ========================================================= */
(function () {
  var esc = ZA.esc;
  var TABS = [['general', 'Store'], ['contact', 'Contact'], ['social', 'Social links'], ['shipping', 'Shipping'], ['tax', 'Tax'], ['payment', 'Payments'], ['seo', 'SEO']];
  var KEY_FOR = { general: 'store', contact: 'contact', social: 'social', shipping: 'shipping', tax: 'tax', payment: 'payment', seo: 'seo' };

  function save(key, value, btn) {
    ZA.busy(btn, true);
    return ZA.q(ZA.db.from('site_settings').update({ value: value }).eq('key', key).select('key')).then(function (r) {
      if (!r.length) throw new Error('You don’t have permission to do that.');
      ZA.ok('Settings saved — live on the store');
    }).catch(ZA.fail).then(function () { ZA.busy(btn, false); ZA.dirty.set(false); });
  }

  function render(tab, el) {
    tab = KEY_FOR[tab] ? tab : 'general';
    var key = KEY_FOR[tab];
    ZA.setPage('Website settings', [['Administration']]);
    ZA.q(ZA.db.from('site_settings').select('value').eq('key', key).maybeSingle()).then(function (row) {
      var s = (row && row.value) || {};
      var body = '', extra = null;
      if (tab === 'general') {
        body = '<div class="grid-2">' + ZA.f.text('name', 'Store name', s.name, { required: true, max: 60 }) + ZA.f.text('tagline', 'Tagline', s.tagline, { max: 120, hint: 'Used in the browser title on the homepage.' }) + '</div>' +
          '<div class="field"><span class="label">Logo</span><div id="logoImg"></div></div>' +
          '<div class="field"><span class="label">Favicon (browser tab icon)</span><div id="favImg"></div></div>' +
          '<div class="grid-2">' + ZA.f.select('currency', 'Currency', s.currency || 'INR', [['INR', 'Indian Rupee (INR)']], { hint: 'Prices and checkout are in INR.' }) + ZA.f.text('currency_symbol', 'Currency symbol', s.currency_symbol || '₹', { max: 4 }) + '</div>';
      }
      if (tab === 'contact') {
        body = '<div class="grid-2">' + ZA.f.text('email', 'Contact email', s.email, { type: 'email', max: 120 }) + ZA.f.text('phone', 'Contact number', s.phone, { type: 'tel', max: 20 }) +
          ZA.f.text('whatsapp', 'WhatsApp number', s.whatsapp, { type: 'tel', max: 20, hint: 'With country code, e.g. 919876543210' }) + ZA.f.text('hours', 'Support hours', s.hours, { max: 80, placeholder: 'Mon–Sat, 10am–7pm' }) + '</div>' +
          ZA.f.textarea('address', 'Business address', s.address, { rows: 3, max: 400, hint: 'Shown on the Contact page and on invoices.' });
      }
      if (tab === 'social') {
        body = '<div class="grid-2">' + ['instagram', 'facebook', 'youtube', 'pinterest'].map(function (k) { return ZA.f.text(k, ZA.label(k), s[k], { type: 'url', max: 300, placeholder: 'https://' }); }).join('') + '</div>' +
          '<p class="small muted" style="margin:0;">Only filled-in links are shown in the footer. They must start with https://</p>';
      }
      if (tab === 'shipping') {
        body = '<div class="grid-2">' + ZA.f.text('free_shipping_over', 'Free delivery on orders over', s.free_shipping_over, { type: 'number', min: 0, step: '1', prefix: '₹', hint: '0 = never free' }) +
          ZA.f.text('flat_fee', 'Delivery charge below that', s.flat_fee, { type: 'number', min: 0, step: '1', prefix: '₹' }) +
          ZA.f.text('dispatch_days', 'Dispatch time', s.dispatch_days, { max: 60, hint: 'Shown on product pages, e.g. “2–4 business days”' }) + '</div>' +
          ZA.f.switch('cod_enabled', 'Cash on delivery available', s.cod_enabled) +
          '<p class="small muted" style="margin:0;">Checkout calculates delivery on the server from these numbers. Courier/serviceability integrations are configured separately (see ADMIN_SETUP.md).</p>';
      }
      if (tab === 'tax') {
        body = ZA.f.switch('enabled', 'Charge GST', s.enabled) +
          '<div class="grid-3">' + ZA.f.text('rate_percent', 'GST rate', s.rate_percent, { type: 'number', min: 0, max: 28, step: '0.01', hint: '%' }) +
          ZA.f.text('gstin', 'GSTIN', s.gstin, { max: 15, placeholder: '22AAAAA0000A1Z5' }) + ZA.f.text('hsn_default', 'Default HSN code', s.hsn_default, { max: 10, hint: 'Used on invoices when a product has none' }) + '</div>' +
          ZA.f.switch('prices_include_tax', 'Product prices already include GST', s.prices_include_tax !== false) +
          '<p class="small muted" style="margin:0;">With inclusive prices the store shows “Inclusive of all taxes” and invoices split out the GST amount.</p>';
      }
      if (tab === 'payment') {
        body = '<div class="grid-2">' + ZA.f.select('provider', 'Payment gateway', s.provider || 'cashfree', [['cashfree', 'Cashfree']]) + ZA.f.select('mode', 'Mode', s.mode || 'sandbox', [['sandbox', 'Sandbox (test payments)'], ['production', 'Production (real payments)']]) + '</div>' +
          ZA.f.switch('online_enabled', 'Accept online payments at checkout', s.online_enabled) +
          '<div class="card" style="margin-top:8px;"><div class="card-head"><h3>Gateway credentials</h3></div><div class="card-body stack" id="payStatus"><p class="muted"><span class="spinner"></span> Checking…</p></div></div>';
        extra = function () {
          ZA.fn('admin-api', { action: 'payment_status' }).then(function (st) {
            var row = function (label, ok) { return '<li><span>' + esc(label) + '</span>' + (ok ? ZA.pill('active', 'Set') : ZA.pill('failed', 'Missing')) + '</li>'; };
            ZA.qs('#payStatus').innerHTML = '<ul class="list" style="margin:-18px;">' + row('CASHFREE_APP_ID', st.cashfree_app_id) + row('CASHFREE_SECRET_KEY', st.cashfree_secret_key) + row('CASHFREE_WEBHOOK_SECRET', st.cashfree_webhook_secret) + '</ul>' +
              '<p class="small muted" style="margin:24px 0 0;">For security, gateway keys are never typed into or shown in this panel. Set them in Supabase → Edge Functions → Secrets (see ADMIN_SETUP.md). Values are only ever used server-side.</p>';
          }).catch(function () {
            ZA.qs('#payStatus').innerHTML = '<div class="notice warn">Couldn’t check the credentials. Deploy the <code>admin-api</code> Edge Function (see ADMIN_SETUP.md).</div>';
          });
        };
      }
      if (tab === 'seo') {
        body = ZA.f.text('meta_title', 'Homepage title', s.meta_title, { max: 70, hint: 'Shown in Google results and the browser tab.' }) +
          ZA.f.textarea('meta_description', 'Homepage description', s.meta_description, { rows: 3, max: 170 }) +
          '<div class="field"><span class="label">Social share image</span><div id="ogImg"></div></div>';
      }
      el.innerHTML = '<div class="tabs">' + TABS.map(function (t) { return '<a href="#/settings/' + t[0] + '" class="' + (t[0] === tab ? 'active' : '') + '">' + esc(t[1]) + '</a>'; }).join('') + '</div>' +
        '<div class="card" style="max-width:860px;"><div class="card-body"><form id="setForm" class="stack" novalidate>' + body +
        '<div class="form-actions"><span class="small muted" style="margin-right:auto;"><span class="hidden" data-dirty-indicator><span class="dirty-dot"></span>Unsaved changes</span></span><button class="btn btn-primary" type="submit" data-busy="Saving…">Save</button></div></form></div></div>';
      var form = ZA.qs('#setForm');
      var logo, fav, og;
      if (tab === 'general') {
        logo = ZA.singleImage(ZA.qs('#logoImg'), s.logo_url, { bucket: 'site', keepPng: true, maxSide: 1200, hint: 'PNG with a transparent background works best. Blank = the built-in Zari logo.', onChange: function () { ZA.dirty.set(true); } });
        fav = ZA.singleImage(ZA.qs('#favImg'), s.favicon_url, { bucket: 'site', square: true, keepPng: true, allowIcon: true, maxSide: 256, hint: 'Square PNG, 64–256px.', onChange: function () { ZA.dirty.set(true); } });
      }
      if (tab === 'seo') og = ZA.singleImage(ZA.qs('#ogImg'), s.og_image, { bucket: 'site', maxSide: 1600, hint: '1200 × 630 recommended.', onChange: function () { ZA.dirty.set(true); } });
      if (extra) extra();
      ZA.markDirtyOnInput(form);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = ZA.readForm(form), btn = form.querySelector('[type=submit]');
        var value = Object.assign({}, s, v);
        if (tab === 'general') {
          if (!v.name) { ZA.fail('Store name is required.'); return; }
          value.logo_url = logo.get(); value.favicon_url = fav.get();
        }
        if (tab === 'contact' && v.email && !/^\S+@\S+\.\S+$/.test(v.email)) { ZA.fail('Enter a valid email.'); return; }
        if (tab === 'social') {
          var bad = Object.keys(v).find(function (k) { return v[k] && !ZA.isHttpUrl(v[k]); });
          if (bad) { ZA.fail(ZA.label(bad) + ' link must start with https://'); return; }
        }
        if (tab === 'shipping' && ((v.free_shipping_over || 0) < 0 || (v.flat_fee || 0) < 0)) { ZA.fail('Amounts can’t be negative.'); return; }
        if (tab === 'tax') {
          if (v.rate_percent != null && (v.rate_percent < 0 || v.rate_percent > 28)) { ZA.fail('GST rate must be between 0 and 28%.'); return; }
          if (v.gstin && !/^[0-9]{2}[A-Z0-9]{13}$/i.test(v.gstin)) { ZA.fail('GSTIN should be 15 characters.'); return; }
          value.gstin = (v.gstin || '').toUpperCase();
        }
        if (tab === 'payment' && v.mode === 'production' && v.online_enabled) {
          ZA.confirm('Switch to production? Customers will be charged real money. Make sure the production Cashfree keys are set and a test order has been completed.', { title: 'Accept real payments', confirmLabel: 'Switch to production' }).then(function (ok) { if (ok) save(key, value, btn); });
          return;
        }
        if (tab === 'seo') value.og_image = og.get();
        save(key, value, btn).then(function () { if (logo) logo.committed(); if (fav) fav.committed(); if (og) og.committed(); });
      });
    }).catch(function (e) { el.innerHTML = '<div class="notice danger">' + esc(e.message) + '</div>'; });
  }

  ZA.routes.settings = { perm: 'settings', render: function (params, el) { render(params[0] || 'general', el); } };
})();
