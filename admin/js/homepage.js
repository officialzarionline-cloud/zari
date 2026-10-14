/* =========================================================
   Zari Admin — homepage: section order, visibility and copy, plus the
   product rails (Featured / New arrivals / Best sellers / Special offers),
   which are driven by product flags.
   ========================================================= */
(function () {
  var esc = ZA.esc;
  var sections = [];
  var RAILS = [
    ['featured', 'Featured sarees', 'Shown in the Featured section (first product appears large).'],
    ['new_arrival', 'New arrivals', 'Shown in New Arrivals and on the New Arrivals page.'],
    ['best_seller', 'Best sellers', 'Hand-picked best sellers. If none are picked, the store ranks by real paid orders.'],
    ['on_sale', 'Special offers', 'Shown in Special Offers and on the Offers page.']
  ];
  var LIMITED = ['new_arrivals', 'best_sellers', 'offers', 'more_styles'];

  function validLink(v) { return !v || /^#\//.test(v) || ZA.isHttpUrl(v); }

  function render(el) {
    ZA.setPage('Homepage', [['Catalogue']], '<a class="btn btn-sm" href="../" target="_blank" rel="noopener">View homepage ↗</a>');
    el.innerHTML = '<div class="cols"><div>' +
      '<div class="card"><div class="card-head"><h3>Sections</h3><span class="small muted">Drag or use ↑ ↓ to reorder · switch to show/hide</span></div>' +
      '<ul class="list" id="secList">' + sections.map(function (s) {
        return '<li data-id="' + esc(s.key) + '" draggable="true"><div class="row" style="flex:1;min-width:0;"><span class="handle" aria-hidden="true">⠿</span><div><span class="cell-title">' + esc(s.label) + '</span>' +
          (s.title ? '<div class="cell-sub">' + esc(s.title.replace(/\*/g, '')) + '</div>' : '') + '</div></div>' +
          '<div class="row"><label class="switch"><input type="checkbox" data-change="sec-visible" data-key="' + esc(s.key) + '"' + (s.is_visible ? ' checked' : '') + '><span class="track"></span><span class="small">' + (s.is_visible ? 'Shown' : 'Hidden') + '</span></label>' +
          ZA.moveButtons + '<button class="link" data-action="sec-edit" data-key="' + esc(s.key) + '">Edit</button></div></li>';
      }).join('') + '</ul></div>' +
      '<p class="small muted">Sections with no content (e.g. Best Sellers before any are chosen, or no live campaign) stay hidden on the store automatically.</p>' +
      '</div><div>' +
      '<div class="card"><div class="card-head"><h3>Hero banners</h3></div><div class="card-body small">The hero shows live banners from <a href="#/marketing">Banners &amp; promotions</a> (they rotate if there are several). When none are live, it shows the Hero section text on the left.</div></div>' +
      (ZA.can('products') ? RAILS.map(function (r) {
        return '<div class="card"><div class="card-head"><h3>' + esc(r[1]) + '</h3><button class="btn btn-sm" data-action="rail-add" data-flag="' + r[0] + '">+ Add</button></div>' +
          '<div class="card-body small muted" style="padding-bottom:0;">' + esc(r[2]) + '</div><div id="rail_' + r[0] + '"><p class="muted" style="padding:12px 18px;"><span class="spinner"></span></p></div></div>';
      }).join('') : '<div class="card"><div class="card-body small muted">Featured / New / Best seller / Offer products are managed by users with Products access.</div></div>') +
      '</div></div>';
    ZA.sortable(ZA.qs('#secList'), function (keys) {
      Promise.all(keys.map(function (k, i) { return ZA.db.from('homepage_sections').update({ sort_order: (i + 1) * 10 }).eq('key', k).select('key'); })).then(function (res) {
        var err = res.find(function (r) { return r.error || !(r.data || []).length; });
        if (err) { ZA.fail(err.error ? ZA.errorMessage(err.error) : 'You don’t have permission to do that.'); return; }
        ZA.ok('Homepage order saved');
      });
    });
    if (ZA.can('products')) RAILS.forEach(function (r) { loadRail(r[0]); });
  }

  function loadRail(flag) {
    var box = ZA.qs('#rail_' + flag);
    if (!box) return;
    ZA.q(ZA.db.from('admin_products_view').select('id,name,sku,status,main_image,price').eq(flag, true).order('updated_at', { ascending: false }).limit(60)).then(function (rows) {
      box.innerHTML = rows.length ? '<ul class="list">' + rows.map(function (p) {
        return '<li><span class="row" style="min-width:0;">' + (p.main_image ? '<img src="' + esc(p.main_image) + '" alt="" style="width:30px;height:40px;object-fit:cover;">' : '') +
          '<span><a class="cell-title" href="#/products/' + p.id + '">' + esc(p.name) + '</a><br><span class="cell-sub">' + esc(p.sku) + (p.status !== 'active' ? ' · <span class="pill">hidden — not shown</span>' : '') + '</span></span></span>' +
          '<button class="link danger" data-action="rail-remove" data-flag="' + flag + '" data-id="' + p.id + '">Remove</button></li>';
      }).join('') + '</ul>' : '<div class="empty small">None selected.</div>';
    }).catch(function (e) { box.innerHTML = '<div class="notice danger">' + esc(e.message) + '</div>'; });
  }

  ZA.actions['rail-add'] = function (b) {
    var flag = b.getAttribute('data-flag');
    ZA.pickProducts({ title: 'Add to ' + RAILS.find(function (r) { return r[0] === flag; })[1] }).then(function (picked) {
      if (!picked.length) return;
      var patch = {}; patch[flag] = true;
      ZA.rpc('admin_bulk_update_products', { p_ids: picked.map(function (p) { return p.id; }), p_patch: patch }).then(function () {
        ZA.ok('Added ' + picked.length); loadRail(flag);
      }).catch(ZA.fail);
    });
  };
  ZA.actions['rail-remove'] = function (b) {
    var flag = b.getAttribute('data-flag'), patch = {}; patch[flag] = false;
    ZA.rpc('admin_bulk_update_products', { p_ids: [b.getAttribute('data-id')], p_patch: patch }).then(function () { ZA.ok('Removed'); loadRail(flag); }).catch(ZA.fail);
  };
  ZA.actions['sec-visible'] = function (inp) {
    var key = inp.getAttribute('data-key');
    ZA.q(ZA.db.from('homepage_sections').update({ is_visible: inp.checked }).eq('key', key).select('key')).then(function (r) {
      if (!r.length) throw new Error('You don’t have permission to do that.');
      sections.find(function (s) { return s.key === key; }).is_visible = inp.checked;
      inp.parentElement.querySelector('.small').textContent = inp.checked ? 'Shown' : 'Hidden';
      ZA.ok(inp.checked ? 'Section shown on the homepage' : 'Section hidden from the homepage');
    }).catch(function (e) { inp.checked = !inp.checked; ZA.fail(e); });
  };
  ZA.actions['sec-edit'] = function (b) {
    var s = sections.find(function (x) { return x.key === b.getAttribute('data-key'); });
    var c = s.config || {};
    var hasCopy = ['marquee', 'promo', 'campaign', 'shop_by'].indexOf(s.key) === -1;
    var extra = '';
    if (s.key === 'hero') extra = '<div class="grid-2">' + ZA.f.text('cta_text', 'Button text', c.cta_text, { max: 40 }) + ZA.f.text('cta_link', 'Button link', c.cta_link, { max: 300, hint: 'e.g. #/sarees or https://…' }) +
      ZA.f.text('secondary_text', 'Second link text', c.secondary_text, { max: 40 }) + ZA.f.text('secondary_link', 'Second link', c.secondary_link, { max: 300 }) + '</div>';
    if (s.key === 'marquee') extra = ZA.f.textarea('items', 'Scrolling messages (one per line)', (c.items || []).join('\n'), { rows: 6, hint: 'Keep each short. Up to 10.' });
    if (LIMITED.indexOf(s.key) !== -1) extra = ZA.f.text('limit', 'Products to show', c.limit || 8, { type: 'number', min: 4, max: 24, step: '1' });
    if (s.key === 'story') extra = '<div class="grid-2">' + ZA.f.text('link_text', 'Link text', c.link_text, { max: 40 }) + ZA.f.text('link', 'Link', c.link, { max: 300 }) + '</div>';
    if (!hasCopy && !extra) extra = '<p class="muted">This section’s content comes from ' + (s.key === 'promo' ? '<a href="#/marketing">promotional banners</a>' : s.key === 'campaign' ? '<a href="#/marketing">campaigns</a>' : '<a href="#/categories">fabrics and occasions</a>') + '. You can show, hide or move it here.</p>';
    ZA.modal({
      title: s.label,
      body: '<form id="secForm" class="stack">' + (hasCopy ? ZA.f.text('eyebrow', 'Small heading', s.eyebrow, { max: 60 }) +
        ZA.f.text('title', 'Title', s.title, { max: 160, hint: 'Wrap words in *asterisks* for the italic accent, e.g. New *Arrivals*.' }) +
        ZA.f.textarea('subtitle', 'Text', s.subtitle, { rows: 3, max: 400 }) : '') + extra + '</form>',
      foot: '<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="secSave" data-busy="Saving…">Save</button>',
      onOpen: function (m, api) {
        m.querySelector('#secSave').addEventListener('click', function () {
          var v = ZA.readForm(m.querySelector('#secForm')), btn = this;
          var cfg = Object.assign({}, c);
          ['cta_text', 'cta_link', 'secondary_text', 'secondary_link', 'link_text', 'link'].forEach(function (k) { if (k in v) cfg[k] = v[k]; });
          if ('items' in v) cfg.items = v.items.split('\n').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 10).map(function (x) { return x.slice(0, 60); });
          if ('limit' in v) cfg.limit = Math.min(24, Math.max(4, Math.round(v.limit || 8)));
          var badLink = ['cta_link', 'secondary_link', 'link'].find(function (k) { return k in v && !validLink(v[k]); });
          if (badLink) { ZA.fail('Links must start with #/ (a store page) or https://'); return; }
          var row = { config: cfg };
          if (hasCopy) { row.eyebrow = v.eyebrow || null; row.title = v.title || null; row.subtitle = v.subtitle || null; }
          ZA.busy(btn, true);
          ZA.q(ZA.db.from('homepage_sections').update(row).eq('key', s.key).select('*')).then(function (r) {
            if (!r.length) throw new Error('You don’t have permission to do that.');
            Object.assign(s, r[0]); api.close(); ZA.ok('Saved — live on the homepage'); render(ZA.qs('#content'));
          }).catch(function (e) { ZA.busy(btn, false); ZA.fail(e); });
        });
      }
    });
  };

  ZA.routes.homepage = {
    perm: 'homepage',
    render: function (params, el) {
      ZA.q(ZA.db.from('homepage_sections').select('*').order('sort_order')).then(function (rows) { sections = rows; render(el); })
        .catch(function (e) { el.innerHTML = '<div class="notice danger">' + esc(e.message) + '</div>'; });
    }
  };
})();
