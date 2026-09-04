/* =========================================================
   Zari Admin — operational console. No decorative animation (spec §38).
   Every write here relies on RLS policy `is_admin()` from
   supabase/migrations/0001_init.sql — a non-admin session simply gets
   rejected by Postgres, this file does not re-implement that check.
   ========================================================= */
function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function formatPrice(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function slugify(s) { return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
function toast(msg) {
  var el = qs('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
}
function statusPill(s) { return '<span class="status-pill status-' + escapeHtml(s) + '">' + escapeHtml(String(s).replace(/_/g, ' ')) + '</span>'; }

/* ---------------------------------------------------------
   Shared image upload helper (Supabase Storage).
   Buckets used: "banners" and "products" — create both as PUBLIC buckets
   in the Supabase dashboard (Storage) before using upload here; until then
   this rejects with a clear error instead of failing silently.
   --------------------------------------------------------- */
function uploadImageToStorage(bucket, file) {
  var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  var path = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  return supabaseClient.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false })
    .then(function (res) {
      if (res.error) throw res.error;
      var pub = supabaseClient.storage.from(bucket).getPublicUrl(path);
      return pub.data.publicUrl;
    });
}
// Wires a hidden <input type=file multiple> + "Upload" button to append resulting
// URLs into a target <textarea> (one URL per line/comma), with a live thumbnail
// preview strip. Used by both the banner form (single image) and product form
// (multiple images with a "make main" affordance).
function wireImageUploader(opts) {
  var input = qs('#' + opts.inputId);
  var preview = qs('#' + opts.previewId);
  var textarea = opts.textareaId ? qs('#' + opts.textareaId) : null;
  function currentUrls() {
    if (!textarea) return [];
    return textarea.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function renderPreview() {
    var urls = currentUrls();
    preview.innerHTML = urls.length ? urls.map(function (u, i) {
      return '<div style="position:relative;display:inline-block;margin:0 8px 8px 0;">' +
        '<img src="' + escapeHtml(u) + '" style="width:64px;height:84px;object-fit:cover;border-radius:6px;' + (i === 0 ? 'outline:2px solid var(--maroon-900);' : '') + '">' +
        (i === 0 ? '<span style="position:absolute;bottom:2px;left:2px;background:var(--maroon-900);color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;">MAIN</span>' :
          '<button type="button" title="Make main image" onclick="makeMainImage(\'' + opts.textareaId + '\',' + i + ')" style="position:absolute;bottom:2px;left:2px;background:rgba(255,255,255,.9);border:none;font-size:9px;padding:1px 5px;border-radius:3px;">Make main</button>') +
        '<button type="button" title="Remove" onclick="removeImageAt(\'' + opts.textareaId + '\',' + i + ')" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.55);color:#fff;border:none;width:16px;height:16px;border-radius:50%;font-size:10px;line-height:1;">&times;</button>' +
        '</div>';
    }).join('') : '<p style="color:var(--ink-soft);font-size:12.5px;">No images yet.</p>';
  }
  input.addEventListener('change', function () {
    var files = Array.prototype.slice.call(input.files || []);
    if (!files.length) return;
    toast('Uploading ' + files.length + ' image(s)…');
    Promise.all(files.map(function (f) { return uploadImageToStorage(opts.bucket, f); }))
      .then(function (urls) {
        if (textarea) textarea.value = currentUrls().concat(urls).join(', ');
        renderPreview();
        toast('Uploaded');
      })
      .catch(function (err) {
        toast('Upload failed — has the "' + opts.bucket + '" Storage bucket been created yet?');
        console.error(err);
      });
    input.value = '';
  });
  if (textarea) textarea.addEventListener('input', renderPreview);
  renderPreview();
}
function removeImageAt(textareaId, idx) {
  var textarea = qs('#' + textareaId);
  var urls = textarea.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  urls.splice(idx, 1);
  textarea.value = urls.join(', ');
  textarea.dispatchEvent(new Event('input'));
}
function makeMainImage(textareaId, idx) {
  var textarea = qs('#' + textareaId);
  var urls = textarea.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var picked = urls.splice(idx, 1)[0];
  urls.unshift(picked);
  textarea.value = urls.join(', ');
  textarea.dispatchEvent(new Event('input'));
}

/* ---------------------------------------------------------
   Auth gate — must be logged in AND present in `admins` table
   --------------------------------------------------------- */
var AdminAuth = { user: null, isAdmin: false };

function checkAdminSession() {
  return supabaseClient.auth.getSession().then(function (res) {
    var session = res.data.session;
    if (!session) return false;
    AdminAuth.user = session.user;
    return supabaseClient.from('admins').select('id').eq('id', session.user.id).maybeSingle().then(function (r) {
      AdminAuth.isAdmin = !!r.data;
      return AdminAuth.isAdmin;
    });
  }).catch(function () { return false; });
}

function showAdminApp() { qs('#adminGate').classList.add('hidden'); qs('#adminApp').classList.remove('hidden'); AdminRouter.handle(); }
function showAdminGate(msg) { qs('#adminApp').classList.add('hidden'); qs('#adminGate').classList.remove('hidden'); if (msg) { var e = qs('#adminLoginError'); e.textContent = msg; e.classList.remove('hidden'); } }

checkAdminSession().then(function (ok) { ok ? showAdminApp() : showAdminGate(); });

qs('#adminLoginForm').addEventListener('submit', function (e) {
  e.preventDefault();
  supabaseClient.auth.signInWithPassword({ email: qs('#adminEmail').value, password: qs('#adminPassword').value }).then(function (res) {
    if (res.error) { showAdminGate(res.error.message); return; }
    checkAdminSession().then(function (ok) {
      if (ok) { showAdminApp(); }
      else { supabaseClient.auth.signOut(); showAdminGate('This account is not an admin.'); }
    });
  });
});
qs('#adminLogoutBtn').addEventListener('click', function () { supabaseClient.auth.signOut().then(function () { showAdminGate(); }); });

/* ---------------------------------------------------------
   Router
   --------------------------------------------------------- */
var AdminRouter = {
  handle: function () {
    var hash = window.location.hash.replace(/^#\/admin\/?/, '') || 'dashboard';
    var key = hash.split('/')[0];
    qsa('[data-admin-link]').forEach(function (a) { a.classList.toggle('active', a.dataset.key === key); });
    var titles = { dashboard: 'Dashboard', banners: 'Banner Management', products: 'Products', orders: 'Orders', customers: 'Customers', categories: 'Categories', collections: 'Collections', campaigns: 'Campaigns & Offers', reviews: 'Reviews' };
    qs('#adminPageTitle').textContent = titles[key] || 'Dashboard';
    var renderers = { dashboard: renderDashboard, banners: renderBanners, products: renderProducts, orders: renderOrders, customers: renderCustomers, categories: renderCategories, collections: renderCollections, campaigns: renderCampaigns, reviews: renderReviews };
    (renderers[key] || renderDashboard)(hash.split('/').slice(1));
  }
};
window.addEventListener('hashchange', function () { if (!qs('#adminApp').classList.contains('hidden')) AdminRouter.handle(); });

/* ---------------------------------------------------------
   Dashboard — real data only (spec §39)
   --------------------------------------------------------- */
function renderDashboard() {
  var el = qs('#adminContent');
  el.innerHTML = '<div class="admin-kpis">' + new Array(5).fill('<div class="admin-kpi"><div class="skeleton skeleton-line" style="width:60%"></div><div class="skeleton skeleton-line" style="width:40%;height:20px;"></div></div>').join('') + '</div>';

  Promise.all([
    supabaseClient.from('orders').select('id', { count: 'exact', head: true }),
    supabaseClient.from('orders').select('total').eq('payment_status', 'paid'),
    supabaseClient.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseClient.from('customer_profiles').select('id', { count: 'exact', head: true }),
    supabaseClient.from('product_variants').select('id', { count: 'exact', head: true }).lte('stock', 3)
  ]).then(function (r) {
    var totalOrders = r[0].count || 0;
    var revenue = (r[1].data || []).reduce(function (s, o) { return s + Number(o.total); }, 0);
    var newOrders = r[2].count || 0;
    var customers = r[3].count || 0;
    var lowStock = r[4].count || 0;
    el.innerHTML = '<div class="admin-kpis">' +
      kpiHtml('Total Orders', totalOrders) +
      kpiHtml('Paid Revenue', formatPrice(revenue)) +
      kpiHtml('Pending Orders', newOrders) +
      kpiHtml('Customers', customers) +
      kpiHtml('Low Stock Variants', lowStock) +
      '</div>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Recent Orders</th><th>Status</th><th>Payment</th><th>Total</th></tr></thead><tbody id="dashRecentOrders"></tbody></table></div>';
    supabaseClient.from('orders').select('order_number,status,payment_status,total').order('created_at', { ascending: false }).limit(8).then(function (res) {
      var rows = res.data || [];
      qs('#dashRecentOrders').innerHTML = rows.length ? rows.map(function (o) {
        return '<tr><td>#' + escapeHtml(o.order_number) + '</td><td>' + statusPill(o.status) + '</td><td>' + statusPill(o.payment_status) + '</td><td>' + formatPrice(o.total) + '</td></tr>';
      }).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--ink-soft);">No orders yet.</td></tr>';
    });
  }).catch(function () { el.innerHTML = '<div class="empty-state">Couldn’t load dashboard data — check your Supabase connection.</div>'; });
}
function kpiHtml(label, value) { return '<div class="admin-kpi"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>'; }

/* ---------------------------------------------------------
   Banner Management — homepage hero banners, schedulable per occasion.
   --------------------------------------------------------- */
var BANNER_OCCASIONS = [
  ['', 'General / No occasion'], ['onam', 'Onam'], ['vishu', 'Vishu'], ['wedding', 'Wedding Season'],
  ['festive-sale', 'Festive Sale'], ['new-arrivals', 'New Arrivals'], ['flash-sale', 'Flash Sale'],
  ['diwali', 'Diwali'], ['eid', 'Eid'], ['christmas', 'Christmas'], ['new-year', 'New Year']
];
function renderBanners(parts) {
  if (parts[0] === 'new' || parts[0] === 'edit') { renderBannerForm(parts[1]); return; }
  var el = qs('#adminContent');
  el.innerHTML = '<div class="admin-toolbar"><p style="color:var(--ink-soft);font-size:13px;max-width:520px;">Banners shown here appear in the homepage hero, highest priority first, only while enabled and inside their scheduled dates.</p><a href="#/admin/banners/new" class="btn btn-dark">+ Add Banner</a></div>' +
    '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th></th><th>Title</th><th>Occasion</th><th>Schedule</th><th>Priority</th><th>Status</th><th></th></tr></thead><tbody id="bannersTbody"><tr><td colspan="7">Loading…</td></tr></tbody></table></div>';

  function load() {
    supabaseClient.from('banners').select('*').order('priority', { ascending: false }).order('created_at', { ascending: false }).then(function (res) {
      if (res.error) { qs('#bannersTbody').innerHTML = '<tr><td colspan="7">Couldn’t load banners.</td></tr>'; return; }
      var rows = res.data || [];
      qs('#bannersTbody').innerHTML = rows.length ? rows.map(function (b) {
        var occLabel = (BANNER_OCCASIONS.find(function (o) { return o[0] === b.occasion; }) || [null, b.occasion || '—'])[1];
        var schedule = (b.starts_at || b.ends_at)
          ? (b.starts_at ? new Date(b.starts_at).toLocaleDateString() : 'Always') + ' → ' + (b.ends_at ? new Date(b.ends_at).toLocaleDateString() : 'Always')
          : 'Always on';
        return '<tr><td>' + (b.image_url ? '<img class="thumb" style="width:56px;height:34px;object-fit:cover;" src="' + escapeHtml(b.image_url) + '">' : '') + '</td>' +
          '<td>' + escapeHtml(b.title) + '</td><td>' + escapeHtml(occLabel) + '</td><td style="font-size:12px;">' + schedule + '</td><td>' + b.priority + '</td>' +
          '<td>' + (b.is_enabled ? statusPill('active') : statusPill('draft')) + '</td>' +
          '<td style="white-space:nowrap;"><a href="#/admin/banners/edit/' + b.id + '" class="link-btn">Edit</a> ' +
          '<button class="link-btn" onclick="toggleBannerEnabled(\'' + b.id + '\',' + !b.is_enabled + ')">' + (b.is_enabled ? 'Disable' : 'Enable') + '</button> ' +
          '<button class="link-btn" onclick="deleteBanner(\'' + b.id + '\')">Delete</button></td></tr>';
      }).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--ink-soft);">No banners yet — add your first one for the homepage hero.</td></tr>';
    }).catch(function () { qs('#bannersTbody').innerHTML = '<tr><td colspan="7">Couldn’t load banners.</td></tr>'; });
  }
  load();
  window.__reloadBanners = load;
}
function toggleBannerEnabled(id, enabled) {
  supabaseClient.from('banners').update({ is_enabled: enabled }).eq('id', id).then(function (res) {
    if (res.error) { toast('Error: ' + res.error.message); return; }
    toast(enabled ? 'Banner enabled' : 'Banner disabled');
    if (window.__reloadBanners) window.__reloadBanners();
  });
}
function deleteBanner(id) {
  if (!confirm('Delete this banner? This cannot be undone.')) return;
  supabaseClient.from('banners').delete().eq('id', id).then(function (res) {
    if (res.error) { toast('Error: ' + res.error.message); return; }
    toast('Banner deleted');
    if (window.__reloadBanners) window.__reloadBanners();
  });
}
function renderBannerForm(id) {
  var el = qs('#adminContent');
  var editing = !!id;
  el.innerHTML = 'Loading…';

  function draw(b) {
    b = b || {};
    var toLocalDate = function (iso) { return iso ? new Date(iso).toISOString().slice(0, 10) : ''; };
    el.innerHTML =
      '<form id="bannerForm" class="admin-form-grid">' +
      field('Title', 'bTitle', b.title) + field('Subtitle', 'bSubtitle', b.subtitle) +
      field('Offer text (small badge, e.g. "Flat 30% Off")', 'bOfferText', b.offer_text) +
      '<div class="field"><label>Occasion</label><select id="bOccasion">' + BANNER_OCCASIONS.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === (b.occasion || '') ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      field('CTA button text', 'bCtaText', b.cta_text || 'Shop Now') + field('CTA button link (e.g. #/sarees?occasion=wedding)', 'bCtaLink', b.cta_link || '#/sarees') +
      field('Priority (higher shows first)', 'bPriority', b.priority != null ? b.priority : 0, 'number') +
      '<div class="admin-checkbox"><input type="checkbox" id="bEnabled" ' + (b.is_enabled !== false ? 'checked' : '') + '> Enabled</div>' +
      field('Start date (optional)', 'bStartsAt', toLocalDate(b.starts_at), 'date') + field('End date (optional)', 'bEndsAt', toLocalDate(b.ends_at), 'date') +
      '<div class="field full"><label>Banner Image</label>' +
      '<input type="file" id="bImageFile" accept="image/*"> ' +
      '<textarea id="bImageUrl" rows="1" placeholder="Image URL (or upload above)" style="margin-top:8px;">' + escapeHtml(b.image_url || '') + '</textarea>' +
      '<div id="bImagePreview" style="margin-top:10px;"></div></div>' +
      '<div class="full" style="display:flex;gap:10px;margin-top:8px;"><button class="btn btn-dark" type="submit">' + (editing ? 'Save Changes' : 'Create Banner') + '</button><a href="#/admin/banners" class="btn btn-ghost">Cancel</a></div>' +
      '</form>';

    // Single-image uploader: reuse the shared helper but treat the textarea as a one-URL list.
    wireImageUploader({ bucket: 'banners', inputId: 'bImageFile', previewId: 'bImagePreview', textareaId: 'bImageUrl' });

    qs('#bannerForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var firstUrl = qs('#bImageUrl').value.split(',')[0].trim();
      if (!firstUrl) { toast('Please add a banner image'); return; }
      var payload = {
        title: qs('#bTitle').value, subtitle: qs('#bSubtitle').value || null,
        offer_text: qs('#bOfferText').value || null, occasion: qs('#bOccasion').value || null,
        cta_text: qs('#bCtaText').value || null, cta_link: qs('#bCtaLink').value || null,
        priority: parseInt(qs('#bPriority').value, 10) || 0, is_enabled: qs('#bEnabled').checked,
        starts_at: qs('#bStartsAt').value ? new Date(qs('#bStartsAt').value).toISOString() : null,
        ends_at: qs('#bEndsAt').value ? new Date(qs('#bEndsAt').value + 'T23:59:59').toISOString() : null,
        image_url: firstUrl
      };
      var save = editing ? supabaseClient.from('banners').update(payload).eq('id', id) : supabaseClient.from('banners').insert(payload);
      save.then(function (res) {
        if (res.error) { toast('Error: ' + res.error.message); return; }
        toast('Saved'); window.location.hash = '#/admin/banners';
      });
    });
  }

  if (editing) { supabaseClient.from('banners').select('*').eq('id', id).single().then(function (res) { draw(res.data); }); }
  else { draw(); }
}

/* ---------------------------------------------------------
   Products
   --------------------------------------------------------- */
function renderProducts(parts) {
  if (parts[0] === 'new' || parts[0] === 'edit') { renderProductForm(parts[1]); return; }
  var el = qs('#adminContent');
  el.innerHTML = '<div class="admin-toolbar"><input type="text" id="productSearch" placeholder="Search by name or SKU" style="border:1px solid var(--line);border-radius:6px;padding:9px 14px;min-width:260px;"><a href="#/admin/products/new" class="btn btn-dark">+ Add Product</a></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th></th><th>Name</th><th>SKU</th><th>Price</th><th>Stock</th><th>Status</th><th>Featured</th><th>Sale</th><th></th></tr></thead><tbody id="productsTbody"><tr><td colspan="9">Loading…</td></tr></tbody></table></div>';

  function load(term) {
    var q = supabaseClient.from('products').select('*, product_images(image_url,sort_order), product_variants(stock)').order('created_at', { ascending: false });
    if (term) q = q.or('name.ilike.%' + term + '%,sku.ilike.%' + term + '%');
    q.then(function (res) {
      var rows = res.data || [];
      qs('#productsTbody').innerHTML = rows.length ? rows.map(function (p) {
        var img = (p.product_images || []).sort(function (a, b) { return a.sort_order - b.sort_order; })[0];
        var stock = (p.product_variants || []).reduce(function (s, v) { return s + v.stock; }, 0);
        return '<tr><td>' + (img ? '<img class="thumb" src="' + escapeHtml(img.image_url) + '">' : '') + '</td>' +
          '<td>' + escapeHtml(p.name) + '</td><td>' + escapeHtml(p.sku) + '</td><td>' + formatPrice(p.sale_price || p.price) + '</td>' +
          '<td>' + stock + '</td><td>' + statusPill(p.status) + '</td>' +
          '<td><input type="checkbox" ' + (p.featured ? 'checked' : '') + ' onchange="toggleProductFlag(\'' + p.id + '\',\'featured\',this.checked)"></td>' +
          '<td><input type="checkbox" ' + (p.on_sale ? 'checked' : '') + ' onchange="toggleProductFlag(\'' + p.id + '\',\'on_sale\',this.checked)"></td>' +
          '<td style="white-space:nowrap;"><a href="#/admin/products/edit/' + p.id + '" class="link-btn">Edit</a> ' +
          '<button class="link-btn" onclick="toggleProductStatus(\'' + p.id + '\',\'' + (p.status === 'active' ? 'draft' : 'active') + '\')">' + (p.status === 'active' ? 'Hide' : 'Unhide') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--ink-soft);">No products yet — add your first one.</td></tr>';
    }).catch(function () { qs('#productsTbody').innerHTML = '<tr><td colspan="9">Couldn’t load products.</td></tr>'; });
  }
  load();
  window.__reloadProducts = load;
  qs('#productSearch').addEventListener('input', function () { load(this.value.trim()); });
}
function toggleProductFlag(id, field, value) {
  var payload = {}; payload[field] = value;
  supabaseClient.from('products').update(payload).eq('id', id).then(function (res) { toast(res.error ? 'Error: ' + res.error.message : 'Updated'); });
}
function toggleProductStatus(id, status) {
  supabaseClient.from('products').update({ status: status }).eq('id', id).then(function (res) {
    if (res.error) { toast('Error: ' + res.error.message); return; }
    toast(status === 'active' ? 'Product is now visible on the site' : 'Product hidden');
    if (window.__reloadProducts) window.__reloadProducts();
  });
}

function renderProductForm(id) {
  var el = qs('#adminContent');
  var editing = !!id;
  el.innerHTML = 'Loading…';

  // In-memory working copies of the repeatable sub-lists (colors / variants) —
  // edited via add/remove rows, then written out on submit.
  var colorRows = [];
  var variantRows = [];

  function renderColorRows() {
    var wrap = qs('#pColorRows');
    wrap.innerHTML = colorRows.map(function (c, i) {
      return '<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">' +
        '<input type="color" value="' + escapeHtml(c.hex || '#7a2828') + '" style="width:36px;height:32px;padding:0;border:1px solid var(--line);" onchange="updateColorRow(' + i + ',\'hex\',this.value)">' +
        '<input type="text" placeholder="Colour name (e.g. Maroon)" value="' + escapeHtml(c.name || '') + '" style="flex:1;border:1px solid var(--line);border-radius:6px;padding:8px 10px;" onchange="updateColorRow(' + i + ',\'name\',this.value)">' +
        '<button type="button" class="link-btn" onclick="removeColorRow(' + i + ')">Remove</button></div>';
    }).join('') || '<p style="color:var(--ink-soft);font-size:12.5px;">No colours added.</p>';
  }
  function renderVariantRows() {
    var wrap = qs('#pVariantRows');
    wrap.innerHTML = variantRows.map(function (v, i) {
      var colorOptions = ['<option value="">— No colour —</option>'].concat(colorRows.map(function (c) { return '<option value="' + escapeHtml(c.name) + '"' + (v.color === c.name ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>'; }));
      return '<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">' +
        '<select onchange="updateVariantRow(' + i + ',\'color\',this.value)" style="flex:1;">' + colorOptions.join('') + '</select>' +
        '<input type="text" placeholder="Size (optional)" value="' + escapeHtml(v.size || '') + '" style="width:110px;border:1px solid var(--line);border-radius:6px;padding:8px 10px;" onchange="updateVariantRow(' + i + ',\'size\',this.value)">' +
        '<input type="number" placeholder="Stock" value="' + (v.stock != null ? v.stock : 0) + '" style="width:90px;border:1px solid var(--line);border-radius:6px;padding:8px 10px;" onchange="updateVariantRow(' + i + ',\'stock\',this.value)">' +
        '<button type="button" class="link-btn" onclick="removeVariantRow(' + i + ')">Remove</button></div>';
    }).join('') || '<p style="color:var(--ink-soft);font-size:12.5px;">No variants yet — add at least one so this product can be added to cart.</p>';
  }
  window.updateColorRow = function (i, key, val) { colorRows[i][key] = val; if (key === 'name') renderVariantRows(); };
  window.removeColorRow = function (i) { colorRows.splice(i, 1); renderColorRows(); renderVariantRows(); };
  window.updateVariantRow = function (i, key, val) { variantRows[i][key] = key === 'stock' ? (parseInt(val, 10) || 0) : val; };
  window.removeVariantRow = function (i) { variantRows.splice(i, 1); renderVariantRows(); };

  function draw(p, categories, productCategoryIds) {
    p = p || {};
    colorRows = (p.product_colors || []).map(function (c) { return { name: c.name, hex: c.hex }; });
    variantRows = (p.product_variants || []).map(function (v) { return { color: v.color, size: v.size, stock: v.stock }; });
    productCategoryIds = productCategoryIds || [];

    var catGroups = ['saree_type', 'fabric', 'occasion', 'style'].map(function (kind) {
      var items = categories.filter(function (c) { return c.kind === kind; });
      if (!items.length) return '';
      return '<div style="margin-bottom:10px;"><strong style="font-size:12px;text-transform:uppercase;color:var(--ink-soft);">' + kind.replace('_', ' ') + '</strong><div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:6px;">' +
        items.map(function (c) {
          return '<label class="admin-checkbox"><input type="checkbox" value="' + c.id + '" class="pCategoryCheckbox" ' + (productCategoryIds.indexOf(c.id) !== -1 ? 'checked' : '') + '> ' + escapeHtml(c.name) + '</label>';
        }).join('') + '</div></div>';
    }).join('');

    el.innerHTML =
      '<form id="productForm" class="admin-form-grid">' +
      field('Name', 'pName', p.name) + field('SKU / Product Code', 'pSku', p.sku) +
      field('Slug (auto if blank)', 'pSlug', p.slug) + field('Price (₹)', 'pPrice', p.price, 'number') +
      field('Sale / Offer Price (₹, optional)', 'pSalePrice', p.sale_price, 'number') + field('Stock (total, informational — variant stock below is authoritative)', 'pStockInfo', (p.product_variants || []).reduce(function (s, v) { return s + v.stock; }, 0), 'number') +
      field('Fabric / Material', 'pFabric', p.fabric) + field('Occasion (free text tag)', 'pOccasion', p.occasion) +
      field('Weave', 'pWeave', p.weave) + field('Work Type', 'pWorkType', p.work_type) +
      field('Border Type', 'pBorder', p.border_type) + field('Pattern', 'pPattern', p.pattern) +
      field('Saree Length (m)', 'pSareeLength', p.saree_length_m, 'number') + field('Blouse Length (m)', 'pBlouseLength', p.blouse_length_m, 'number') +
      field('Blouse Colour', 'pBlouseColour', p.blouse_colour) + field('Country of Origin', 'pOrigin', p.country_of_origin) +
      '<div class="admin-checkbox full"><input type="checkbox" id="pBlouseIncluded" ' + (p.blouse_included ? 'checked' : '') + '> Blouse piece included</div>' +
      '<div class="admin-checkbox full"><input type="checkbox" id="pReadyToWear" ' + (p.ready_to_wear ? 'checked' : '') + '> Ready to wear (no size selection needed)</div>' +
      '<div class="admin-checkbox"><input type="checkbox" id="pFeatured" ' + (p.featured ? 'checked' : '') + '> Featured</div>' +
      '<div class="admin-checkbox"><input type="checkbox" id="pNewArrival" ' + (p.new_arrival ? 'checked' : '') + '> New Arrival</div>' +
      '<div class="admin-checkbox"><input type="checkbox" id="pOnSale" ' + (p.on_sale ? 'checked' : '') + '> On Sale (shows in homepage Offer Products)</div>' +
      '<div class="field"><label>Status</label><select id="pStatus"><option value="draft"' + (p.status === 'draft' || !p.status ? ' selected' : '') + '>Draft (hidden)</option><option value="active"' + (p.status === 'active' ? ' selected' : '') + '>Active (visible on site)</option><option value="archived"' + (p.status === 'archived' ? ' selected' : '') + '>Archived</option></select></div>' +
      '<div class="field full"><label>Description</label><textarea id="pDescription" rows="4">' + escapeHtml(p.description || '') + '</textarea></div>' +
      '<div class="field full"><label>Wash Care</label><input id="pWashCare" value="' + escapeHtml(p.wash_care || '') + '"></div>' +
      '<div class="field full"><label>Categories / Tags</label>' + (catGroups || '<p style="color:var(--ink-soft);font-size:12.5px;">No categories set up yet — add some under Categories first.</p>') + '</div>' +
      '<div class="field full"><label>Colours</label><div id="pColorRows"></div><button type="button" class="btn btn-ghost" onclick="colorRows.push({name:\'\',hex:\'#7a2828\'});renderColorRows();renderVariantRows();">+ Add Colour</button></div>' +
      '<div class="field full"><label>Variants (colour + size + stock — this drives Add to Cart)</label><div id="pVariantRows"></div><button type="button" class="btn btn-ghost" onclick="variantRows.push({color:(colorRows[0]||{}).name||\'\',size:\'\',stock:0});renderVariantRows();">+ Add Variant</button></div>' +
      '<div class="field full"><label>Product Images</label>' +
      '<input type="file" id="pImageFiles" accept="image/*" multiple> ' +
      '<textarea id="pImages" rows="2" placeholder="Image URLs (or upload above) — first image is the main thumbnail" style="margin-top:8px;">' + (p.product_images || []).slice().sort(function (a, b) { return a.sort_order - b.sort_order; }).map(function (i) { return i.image_url; }).join(', ') + '</textarea>' +
      '<div id="pImagePreview" style="margin-top:10px;"></div></div>' +
      '<div class="full" style="display:flex;gap:10px;margin-top:8px;"><button class="btn btn-dark" type="submit">' + (editing ? 'Save Changes' : 'Create Product') + '</button><a href="#/admin/products" class="btn btn-ghost">Cancel</a></div>' +
      '</form>';

    renderColorRows(); renderVariantRows();
    window.colorRows = colorRows; window.variantRows = variantRows; window.renderColorRows = renderColorRows; window.renderVariantRows = renderVariantRows;
    wireImageUploader({ bucket: 'products', inputId: 'pImageFiles', previewId: 'pImagePreview', textareaId: 'pImages' });

    qs('#productForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var payload = {
        name: qs('#pName').value, sku: qs('#pSku').value,
        slug: qs('#pSlug').value.trim() || slugify(qs('#pName').value),
        price: parseFloat(qs('#pPrice').value) || 0,
        sale_price: qs('#pSalePrice').value ? parseFloat(qs('#pSalePrice').value) : null,
        fabric: qs('#pFabric').value || null, occasion: qs('#pOccasion').value || null,
        weave: qs('#pWeave').value || null, work_type: qs('#pWorkType').value || null,
        border_type: qs('#pBorder').value || null, pattern: qs('#pPattern').value || null,
        saree_length_m: qs('#pSareeLength').value ? parseFloat(qs('#pSareeLength').value) : null,
        blouse_length_m: qs('#pBlouseLength').value ? parseFloat(qs('#pBlouseLength').value) : null,
        blouse_colour: qs('#pBlouseColour').value || null, country_of_origin: qs('#pOrigin').value || null,
        blouse_included: qs('#pBlouseIncluded').checked, ready_to_wear: qs('#pReadyToWear').checked,
        featured: qs('#pFeatured').checked, new_arrival: qs('#pNewArrival').checked, on_sale: qs('#pOnSale').checked,
        status: qs('#pStatus').value, description: qs('#pDescription').value || null,
        wash_care: qs('#pWashCare').value || null
      };
      var save = editing ? supabaseClient.from('products').update(payload).eq('id', id) : supabaseClient.from('products').insert(payload).select().single();
      save.then(function (res) {
        if (res.error) { toast('Error: ' + res.error.message); return; }
        var productId = editing ? id : res.data.id;
        var urls = qs('#pImages').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        var checkedCatIds = qsa('.pCategoryCheckbox:checked').map(function (cb) { return cb.value; });

        Promise.all([
          supabaseClient.from('product_images').delete().eq('product_id', productId),
          supabaseClient.from('product_colors').delete().eq('product_id', productId),
          supabaseClient.from('product_variants').delete().eq('product_id', productId),
          supabaseClient.from('product_categories').delete().eq('product_id', productId)
        ]).then(function () {
          var writes = [];
          if (urls.length) writes.push(supabaseClient.from('product_images').insert(urls.map(function (u, i) { return { product_id: productId, image_url: u, sort_order: i }; })));
          var validColors = colorRows.filter(function (c) { return c.name && c.name.trim(); });
          if (validColors.length) writes.push(supabaseClient.from('product_colors').insert(validColors.map(function (c, i) { return { product_id: productId, name: c.name.trim(), hex: c.hex, sort_order: i }; })));
          if (variantRows.length) writes.push(supabaseClient.from('product_variants').insert(variantRows.map(function (v, i) { return { product_id: productId, variant_sku: payload.sku + '-V' + (i + 1), color: v.color || null, size: v.size || null, stock: v.stock || 0 }; })));
          if (checkedCatIds.length) writes.push(supabaseClient.from('product_categories').insert(checkedCatIds.map(function (cid) { return { product_id: productId, category_id: cid }; })));
          Promise.all(writes).then(function () { toast('Saved'); window.location.hash = '#/admin/products'; });
        });
      });
    });
  }

  Promise.all([
    editing ? supabaseClient.from('products').select('*, product_images(*), product_colors(*), product_variants(*)').eq('id', id).single() : Promise.resolve({ data: null }),
    supabaseClient.from('categories').select('*').order('kind').order('sort_order'),
    editing ? supabaseClient.from('product_categories').select('category_id').eq('product_id', id) : Promise.resolve({ data: [] })
  ]).then(function (r) {
    draw(r[0].data, r[1].data || [], (r[2].data || []).map(function (x) { return x.category_id; }));
  }).catch(function () { el.innerHTML = '<div class="empty-state">Couldn’t load this form — check your Supabase connection and try again.</div>'; });
}
function field(label, id, value, type) {
  return '<div class="field"><label>' + label + '</label><input type="' + (type || 'text') + '" id="' + id + '" value="' + escapeHtml(value == null ? '' : value) + '"></div>';
}

/* ---------------------------------------------------------
   Orders
   --------------------------------------------------------- */
function renderOrders() {
  var el = qs('#adminContent');
  el.innerHTML = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th>Total</th><th>Placed</th><th></th></tr></thead><tbody id="ordersTbody"><tr><td colspan="7">Loading…</td></tr></tbody></table></div>';
  supabaseClient.from('orders').select('*').order('created_at', { ascending: false }).then(function (res) {
    var rows = res.data || [];
    qs('#ordersTbody').innerHTML = rows.length ? rows.map(function (o) {
      return '<tr><td>#' + escapeHtml(o.order_number) + '</td><td>' + escapeHtml(o.contact_name) + '</td><td>' +
        statusSelect(o.id, o.status) + '</td><td>' + statusPill(o.payment_status) + '</td><td>' + formatPrice(o.total) + '</td>' +
        '<td>' + new Date(o.created_at).toLocaleDateString() + '</td><td></td></tr>';
    }).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--ink-soft);">No orders yet.</td></tr>';
  }).catch(function () { qs('#ordersTbody').innerHTML = '<tr><td colspan="7">Couldn’t load orders.</td></tr>'; });
}
function statusSelect(orderId, current) {
  var opts = ['pending', 'confirmed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
  return '<select onchange="updateOrderStatus(\'' + orderId + '\', this.value)">' + opts.map(function (o) { return '<option value="' + o + '"' + (o === current ? ' selected' : '') + '>' + o.replace(/_/g, ' ') + '</option>'; }).join('') + '</select>';
}
function updateOrderStatus(orderId, status) {
  supabaseClient.from('orders').update({ status: status }).eq('id', orderId).then(function (res) { toast(res.error ? 'Failed to update' : 'Order updated'); });
}

/* ---------------------------------------------------------
   Customers (read-only list for now)
   --------------------------------------------------------- */
function renderCustomers() {
  var el = qs('#adminContent');
  el.innerHTML = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Name</th><th>Phone</th><th>Joined</th></tr></thead><tbody id="customersTbody"><tr><td colspan="3">Loading…</td></tr></tbody></table></div>';
  supabaseClient.from('customer_profiles').select('*').order('created_at', { ascending: false }).then(function (res) {
    var rows = res.data || [];
    qs('#customersTbody').innerHTML = rows.length ? rows.map(function (c) {
      return '<tr><td>' + escapeHtml(c.full_name || '—') + '</td><td>' + escapeHtml(c.phone || '—') + '</td><td>' + new Date(c.created_at).toLocaleDateString() + '</td></tr>';
    }).join('') : '<tr><td colspan="3" style="text-align:center;color:var(--ink-soft);">No customers yet.</td></tr>';
  }).catch(function () { qs('#customersTbody').innerHTML = '<tr><td colspan="3">Couldn’t load customers.</td></tr>'; });
}

/* ---------------------------------------------------------
   Categories / Collections (simple CRUD)
   --------------------------------------------------------- */
function renderCategories() {
  renderTaxonomyList('categories', [
    ['saree_type', 'Saree Type'], ['fabric', 'Fabric'], ['occasion', 'Occasion'], ['style', 'Style']
  ]);
}
function renderTaxonomyList(table, kinds) {
  var el = qs('#adminContent');
  el.innerHTML = '<div class="admin-toolbar"><form id="taxAddForm" style="display:flex;gap:8px;">' +
    '<select id="taxKind">' + kinds.map(function (k) { return '<option value="' + k[0] + '">' + k[1] + '</option>'; }).join('') + '</select>' +
    '<input type="text" id="taxName" placeholder="Name" required>' +
    '<button class="btn btn-dark" type="submit">+ Add</button></form></div>' +
    '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Kind</th><th>Name</th><th>Slug</th><th></th></tr></thead><tbody id="taxTbody"><tr><td colspan="4">Loading…</td></tr></tbody></table></div>';

  function load() {
    supabaseClient.from(table).select('*').order('kind').order('sort_order').then(function (res) {
      var rows = res.data || [];
      qs('#taxTbody').innerHTML = rows.length ? rows.map(function (r) {
        return '<tr><td>' + escapeHtml(r.kind.replace('_', ' ')) + '</td><td>' + escapeHtml(r.name) + '</td><td>' + escapeHtml(r.slug) + '</td><td><button class="link-btn" onclick="deleteTaxonomy(\'' + table + '\',\'' + r.id + '\')">Delete</button></td></tr>';
      }).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--ink-soft);">None yet.</td></tr>';
    }).catch(function () { qs('#taxTbody').innerHTML = '<tr><td colspan="4">Couldn’t load.</td></tr>'; });
  }
  qs('#taxAddForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = qs('#taxName').value.trim();
    supabaseClient.from(table).insert({ kind: qs('#taxKind').value, name: name, slug: slugify(name) }).then(function (res) {
      if (res.error) { toast('Error: ' + res.error.message); return; }
      qs('#taxName').value = ''; load();
    });
  });
  load();
}
function deleteTaxonomy(table, id) {
  if (!confirm('Delete this?')) return;
  supabaseClient.from(table).delete().eq('id', id).then(function () { AdminRouter.handle(); });
}
function renderCollections() {
  var el = qs('#adminContent');
  el.innerHTML = '<div class="admin-toolbar"><form id="collAddForm" style="display:flex;gap:8px;"><input type="text" id="collName" placeholder="Collection name" required><button class="btn btn-dark" type="submit">+ Add</button></form></div>' +
    '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Name</th><th>Slug</th><th>Active</th><th></th></tr></thead><tbody id="collTbody"><tr><td colspan="4">Loading…</td></tr></tbody></table></div>';
  function load() {
    supabaseClient.from('collections').select('*').order('sort_order').then(function (res) {
      var rows = res.data || [];
      qs('#collTbody').innerHTML = rows.length ? rows.map(function (c) {
        return '<tr><td>' + escapeHtml(c.name) + '</td><td>' + escapeHtml(c.slug) + '</td><td>' + (c.is_active ? 'Yes' : 'No') + '</td><td><button class="link-btn" onclick="deleteTaxonomy(\'collections\',\'' + c.id + '\')">Delete</button></td></tr>';
      }).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--ink-soft);">None yet.</td></tr>';
    }).catch(function () { qs('#collTbody').innerHTML = '<tr><td colspan="4">Couldn’t load.</td></tr>'; });
  }
  qs('#collAddForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = qs('#collName').value.trim();
    supabaseClient.from('collections').insert({ name: name, slug: slugify(name) }).then(function (res) {
      if (res.error) { toast('Error: ' + res.error.message); return; }
      qs('#collName').value = ''; load();
    });
  });
  load();
}

/* ---------------------------------------------------------
   Campaigns
   --------------------------------------------------------- */
function renderCampaigns() {
  var el = qs('#adminContent');
  el.innerHTML = '<div class="admin-toolbar"><form id="campAddForm" style="display:flex;gap:8px;flex-wrap:wrap;">' +
    '<input type="text" id="campName" placeholder="Campaign name" required>' +
    '<select id="campDiscountType"><option value="percent">% off</option><option value="flat">₹ off</option></select>' +
    '<input type="number" id="campDiscountValue" placeholder="Value" style="width:100px;">' +
    '<button class="btn btn-dark" type="submit">+ Add (Draft)</button></form></div>' +
    '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Name</th><th>Discount</th><th>Status</th><th></th></tr></thead><tbody id="campTbody"><tr><td colspan="4">Loading…</td></tr></tbody></table></div>';
  function load() {
    supabaseClient.from('campaigns').select('*').order('created_at', { ascending: false }).then(function (res) {
      var rows = res.data || [];
      qs('#campTbody').innerHTML = rows.length ? rows.map(function (c) {
        return '<tr><td>' + escapeHtml(c.name) + '</td><td>' + (c.discount_value ? (c.discount_type === 'percent' ? c.discount_value + '%' : formatPrice(c.discount_value)) : '—') + '</td><td>' + statusPill(c.status) + '</td>' +
          '<td>' + campaignActionsHtml(c) + '</td></tr>';
      }).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--ink-soft);">None yet.</td></tr>';
    }).catch(function () { qs('#campTbody').innerHTML = '<tr><td colspan="4">Couldn’t load.</td></tr>'; });
  }
  qs('#campAddForm').addEventListener('submit', function (e) {
    e.preventDefault();
    supabaseClient.from('campaigns').insert({
      name: qs('#campName').value, discount_type: qs('#campDiscountType').value,
      discount_value: parseFloat(qs('#campDiscountValue').value) || null, status: 'draft'
    }).then(function (res) { if (res.error) { toast('Error: ' + res.error.message); return; } qs('#campAddForm').reset(); load(); });
  });
  load();
}
function campaignActionsHtml(c) {
  if (c.status === 'live') return '<button class="link-btn" onclick="setCampaignStatus(\'' + c.id + '\',\'disabled\')">Disable</button>';
  return '<button class="link-btn" onclick="setCampaignStatus(\'' + c.id + '\',\'live\')">Go Live</button>';
}
function setCampaignStatus(id, status) { supabaseClient.from('campaigns').update({ status: status }).eq('id', id).then(function () { AdminRouter.handle(); }); }

/* ---------------------------------------------------------
   Reviews moderation
   --------------------------------------------------------- */
function renderReviews() {
  var el = qs('#adminContent');
  el.innerHTML = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Product</th><th>Rating</th><th>Review</th><th>Status</th><th></th></tr></thead><tbody id="reviewsTbody"><tr><td colspan="5">Loading…</td></tr></tbody></table></div>';
  supabaseClient.from('reviews').select('*, products(name)').order('created_at', { ascending: false }).then(function (res) {
    var rows = res.data || [];
    qs('#reviewsTbody').innerHTML = rows.length ? rows.map(function (r) {
      return '<tr><td>' + escapeHtml((r.products && r.products.name) || '') + '</td><td>' + '★'.repeat(r.rating) + '</td><td>' + escapeHtml(r.review_text || '') + '</td><td>' + statusPill(r.status) + '</td>' +
        '<td>' + (r.status === 'pending' ? '<button class="link-btn" onclick="setReviewStatus(\'' + r.id + '\',\'approved\')">Approve</button> <button class="link-btn" onclick="setReviewStatus(\'' + r.id + '\',\'rejected\')">Reject</button>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--ink-soft);">No reviews yet.</td></tr>';
  }).catch(function () { qs('#reviewsTbody').innerHTML = '<tr><td colspan="5">Couldn’t load reviews.</td></tr>'; });
}
function setReviewStatus(id, status) { supabaseClient.from('reviews').update({ status: status }).eq('id', id).then(function () { AdminRouter.handle(); }); }
