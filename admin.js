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
    var titles = { dashboard: 'Dashboard', products: 'Products', orders: 'Orders', customers: 'Customers', categories: 'Categories', collections: 'Collections', campaigns: 'Campaigns & Offers', reviews: 'Reviews' };
    qs('#adminPageTitle').textContent = titles[key] || 'Dashboard';
    var renderers = { dashboard: renderDashboard, products: renderProducts, orders: renderOrders, customers: renderCustomers, categories: renderCategories, collections: renderCollections, campaigns: renderCampaigns, reviews: renderReviews };
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
   Products
   --------------------------------------------------------- */
function renderProducts(parts) {
  if (parts[0] === 'new' || parts[0] === 'edit') { renderProductForm(parts[1]); return; }
  var el = qs('#adminContent');
  el.innerHTML = '<div class="admin-toolbar"><input type="text" id="productSearch" placeholder="Search by name or SKU" style="border:1px solid var(--line);border-radius:6px;padding:9px 14px;min-width:260px;"><a href="#/admin/products/new" class="btn btn-dark">+ Add Product</a></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th></th><th>Name</th><th>SKU</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody id="productsTbody"><tr><td colspan="7">Loading…</td></tr></tbody></table></div>';

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
          '<td><a href="#/admin/products/edit/' + p.id + '" class="link-btn">Edit</a></td></tr>';
      }).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--ink-soft);">No products yet — add your first one.</td></tr>';
    }).catch(function () { qs('#productsTbody').innerHTML = '<tr><td colspan="7">Couldn’t load products.</td></tr>'; });
  }
  load();
  qs('#productSearch').addEventListener('input', function () { load(this.value.trim()); });
}

function renderProductForm(id) {
  var el = qs('#adminContent');
  var editing = !!id;
  el.innerHTML = '<div id="productFormWrap">Loading…</div>';

  function draw(p) {
    p = p || {};
    el.innerHTML =
      '<form id="productForm" class="admin-form-grid">' +
      field('Name', 'pName', p.name) + field('SKU', 'pSku', p.sku) +
      field('Slug (auto if blank)', 'pSlug', p.slug) + field('Price (₹)', 'pPrice', p.price, 'number') +
      field('Compare-at Price (₹, optional)', 'pOldPrice', p.sale_price ? p.price : '', 'number') +
      field('Sale Price (₹, optional)', 'pSalePrice', p.sale_price, 'number') +
      field('Fabric', 'pFabric', p.fabric) + field('Occasion', 'pOccasion', p.occasion) +
      field('Weave', 'pWeave', p.weave) + field('Work Type', 'pWorkType', p.work_type) +
      field('Border Type', 'pBorder', p.border_type) + field('Pattern', 'pPattern', p.pattern) +
      field('Saree Length (m)', 'pSareeLength', p.saree_length_m, 'number') + field('Blouse Length (m)', 'pBlouseLength', p.blouse_length_m, 'number') +
      field('Blouse Colour', 'pBlouseColour', p.blouse_colour) + field('Country of Origin', 'pOrigin', p.country_of_origin) +
      '<div class="admin-checkbox full"><input type="checkbox" id="pBlouseIncluded" ' + (p.blouse_included ? 'checked' : '') + '> Blouse piece included</div>' +
      '<div class="admin-checkbox full"><input type="checkbox" id="pReadyToWear" ' + (p.ready_to_wear ? 'checked' : '') + '> Ready to wear (no size selection needed)</div>' +
      '<div class="admin-checkbox"><input type="checkbox" id="pFeatured" ' + (p.featured ? 'checked' : '') + '> Featured</div>' +
      '<div class="admin-checkbox"><input type="checkbox" id="pNewArrival" ' + (p.new_arrival ? 'checked' : '') + '> New Arrival</div>' +
      '<div class="field full"><label>Status</label><select id="pStatus"><option value="draft"' + (p.status === 'draft' ? ' selected' : '') + '>Draft</option><option value="active"' + (p.status === 'active' ? ' selected' : '') + '>Active</option><option value="archived"' + (p.status === 'archived' ? ' selected' : '') + '>Archived</option></select></div>' +
      '<div class="field full"><label>Description</label><textarea id="pDescription" rows="4">' + escapeHtml(p.description || '') + '</textarea></div>' +
      '<div class="field full"><label>Wash Care</label><input id="pWashCare" value="' + escapeHtml(p.wash_care || '') + '"></div>' +
      '<div class="field full"><label>Image URLs (comma-separated — Storage upload UI is a follow-up)</label><textarea id="pImages" rows="2">' + (p.product_images || []).map(function (i) { return i.image_url; }).join(', ') + '</textarea></div>' +
      '<div class="full" style="display:flex;gap:10px;margin-top:8px;"><button class="btn btn-dark" type="submit">' + (editing ? 'Save Changes' : 'Create Product') + '</button><a href="#/admin/products" class="btn btn-ghost">Cancel</a></div>' +
      '</form>';

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
        featured: qs('#pFeatured').checked, new_arrival: qs('#pNewArrival').checked,
        status: qs('#pStatus').value, description: qs('#pDescription').value || null,
        wash_care: qs('#pWashCare').value || null
      };
      var save = editing ? supabaseClient.from('products').update(payload).eq('id', id) : supabaseClient.from('products').insert(payload).select().single();
      save.then(function (res) {
        if (res.error) { toast('Error: ' + res.error.message); return; }
        var productId = editing ? id : res.data.id;
        var urls = qs('#pImages').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        supabaseClient.from('product_images').delete().eq('product_id', productId).then(function () {
          if (!urls.length) { toast('Saved'); window.location.hash = '#/admin/products'; return; }
          supabaseClient.from('product_images').insert(urls.map(function (u, i) { return { product_id: productId, image_url: u, sort_order: i }; })).then(function () {
            toast('Saved'); window.location.hash = '#/admin/products';
          });
        });
      });
    });
  }

  if (editing) {
    supabaseClient.from('products').select('*, product_images(*)').eq('id', id).single().then(function (res) { draw(res.data); });
  } else { draw(); }
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
    });
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
    });
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
    });
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
