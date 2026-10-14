/* =========================================================
   Zari Admin — banners & promotions: hero/promo banners (with image upload,
   scheduling and visibility), the announcement bar, and campaigns.
   The store only ever receives banners that are enabled and inside their
   schedule (enforced by RLS), so scheduling works without code changes.
   ========================================================= */
(function () {
  var esc = ZA.esc;
  var TABS = [['banners', 'Banners'], ['announcement', 'Announcement bar'], ['campaigns', 'Campaigns']];
  var OCCASIONS = [['', 'General'], ['onam', 'Onam'], ['vishu', 'Vishu'], ['wedding', 'Wedding season'], ['festive-sale', 'Festive sale'], ['new-arrivals', 'New arrivals'],
    ['flash-sale', 'Flash sale'], ['diwali', 'Diwali'], ['eid', 'Eid'], ['christmas', 'Christmas'], ['new-year', 'New year']];

  function tabs(active) {
    return '<div class="tabs">' + TABS.map(function (t) { return '<a href="#/marketing/' + t[0] + '" class="' + (t[0] === active ? 'active' : '') + '">' + esc(t[1]) + '</a>'; }).join('') + '</div>';
  }
  function bannerState(b) {
    var now = Date.now();
    if (!b.is_enabled) return ['disabled', 'Off'];
    if (b.starts_at && new Date(b.starts_at).getTime() > now) return ['scheduled', 'Scheduled'];
    if (b.ends_at && new Date(b.ends_at).getTime() < now) return ['expired', 'Ended'];
    return ['live', 'Live'];
  }
  function toLocalInput(iso) { if (!iso) return ''; var d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
  function fromLocalInput(v) { return v ? new Date(v).toISOString() : null; }
  function storagePathFromUrl(url, bucket) { var m = String(url || '').match(new RegExp('/storage/v1/object/public/' + bucket + '/(.+)$')); return m ? decodeURIComponent(m[1]) : null; }
  function validLink(v) { return !v || /^#\//.test(v) || ZA.isHttpUrl(v); }

  /* ---------- Banners list ---------- */
  var bannerTable;
  function renderBanners(el) {
    ZA.setPage('Banners & promotions', [['Marketing']], '<a class="btn btn-primary btn-sm" href="#/marketing/banner/new">+ New banner</a>');
    el.innerHTML = tabs('banners') + '<div id="bannerTable"></div>' +
      '<p class="small muted"><strong>Hero</strong> banners rotate at the top of the homepage (highest priority first). <strong>Promo</strong> banners appear as promotional blocks further down. Only enabled banners inside their dates are shown.</p>';
    bannerTable = new ZA.DataTable({
      id: 'banners', el: ZA.qs('#bannerTable'), search: 'Search banners', defaultSort: { col: 'priority', asc: false },
      filters: [{ key: 'placement', label: 'Placement', options: [['hero', 'Hero'], ['promo', 'Promo']] }, { key: 'enabled', label: 'Enabled', options: [['true', 'On'], ['false', 'Off']] }],
      columns: [
        { label: '', render: function (b) { return '<img src="' + esc(b.image_url) + '" alt="" style="width:88px;height:50px;object-fit:cover;border-radius:2px;background:var(--cream-200);">'; } },
        { label: 'Banner', sort: 'title', render: function (b) { return '<a class="cell-title" href="#/marketing/banner/' + b.id + '">' + esc(b.title) + '</a>' + (b.offer_text ? '<div class="cell-sub">' + esc(b.offer_text) + '</div>' : ''); } },
        { label: 'Placement', render: function (b) { return '<span class="pill">' + (b.placement === 'promo' ? 'Promo' : 'Hero') + '</span>'; } },
        { label: 'Schedule', cls: 'nowrap', render: function (b) { return '<span class="small">' + (b.starts_at ? ZA.dateTime(b.starts_at) : 'Now') + ' → ' + (b.ends_at ? ZA.dateTime(b.ends_at) : 'No end') + '</span>'; } },
        { label: 'Priority', sort: 'priority', render: function (b) { return String(b.priority); } },
        { label: 'Status', render: function (b) { var s = bannerState(b); return ZA.pill(s[0], s[1]); } },
        { label: '', cls: 'actions', render: function (b) {
          return '<a class="link" href="#/marketing/banner/' + b.id + '">Edit</a><button class="link" data-action="banner-toggle" data-id="' + b.id + '" data-on="' + b.is_enabled + '">' + (b.is_enabled ? 'Turn off' : 'Turn on') + '</button>' +
            '<button class="link danger" data-action="banner-delete" data-id="' + b.id + '" data-url="' + esc(b.image_url) + '">Delete</button>';
        } }
      ],
      query: function (st) {
        var q = ZA.db.from('banners').select('*', { count: 'exact' });
        if (st.filters.placement) q = q.eq('placement', st.filters.placement);
        if (st.filters.enabled) q = q.eq('is_enabled', st.filters.enabled === 'true');
        return ZA.applyTableState(q, st, ['title', 'subtitle', 'offer_text']).then(function (res) { return { rows: ZA.unwrap(res), total: res.count || 0 }; });
      },
      emptyTitle: 'No banners yet', emptyText: '<br>Without a live hero banner, the homepage shows the default hero text.'
    });
  }
  ZA.actions['banner-toggle'] = function (b) {
    var on = b.getAttribute('data-on') !== 'true';
    ZA.q(ZA.db.from('banners').update({ is_enabled: on }).eq('id', b.getAttribute('data-id')).select('id')).then(function (r) {
      if (!r.length) throw new Error('You don’t have permission to do that.');
      ZA.ok(on ? 'Banner turned on' : 'Banner turned off'); bannerTable.reload();
    }).catch(ZA.fail);
  };
  ZA.actions['banner-delete'] = function (b) {
    ZA.confirm('Delete this banner? It disappears from the store immediately.', { title: 'Delete banner', danger: true, confirmLabel: 'Delete' }).then(function (ok) {
      if (!ok) return;
      ZA.q(ZA.db.from('banners').delete().eq('id', b.getAttribute('data-id')).select('id')).then(function (r) {
        if (!r.length) throw new Error('You don’t have permission to do that.');
        ZA.images.remove('banners', [storagePathFromUrl(b.getAttribute('data-url'), 'banners')]);
        ZA.ok('Banner deleted'); bannerTable.reload();
      }).catch(ZA.fail);
    });
  };

  /* ---------- Banner editor ---------- */
  function renderBannerForm(id, el) {
    var isNew = id === 'new';
    ZA.setPage(isNew ? 'New banner' : 'Edit banner', [['Marketing'], ['Banners', '#/marketing']]);
    (isNew ? Promise.resolve({ is_enabled: true, priority: 0, placement: 'hero', cta_text: 'Shop now', cta_link: '#/sarees' }) : ZA.q(ZA.db.from('banners').select('*').eq('id', id).maybeSingle())).then(function (b) {
      if (!b) { el.innerHTML = '<div class="empty"><strong>Banner not found</strong></div>'; return; }
      var oldUrl = b.image_url;
      el.innerHTML = '<form id="bannerForm" novalidate><div class="cols"><div>' +
        '<div class="card"><div class="card-head"><h3>Image</h3></div><div class="card-body"><div id="bImg"></div></div></div>' +
        '<div class="card"><div class="card-head"><h3>Text &amp; button</h3></div><div class="card-body stack">' +
        ZA.f.text('title', 'Heading', b.title, { required: true, max: 120 }) +
        ZA.f.textarea('subtitle', 'Description', b.subtitle, { rows: 3, max: 300 }) +
        ZA.f.text('offer_text', 'Offer badge (optional)', b.offer_text, { max: 40, hint: 'Small label above the heading, e.g. “Flat 20% off”' }) +
        '<div class="grid-2">' + ZA.f.text('cta_text', 'Button text', b.cta_text, { max: 40 }) + ZA.f.text('cta_link', 'Button link', b.cta_link, { max: 300, hint: '#/sarees, #/sarees?occasion=wedding, #/product/… or https://…' }) + '</div>' +
        '</div></div></div><div>' +
        '<div class="card"><div class="card-head"><h3>Visibility</h3></div><div class="card-body stack">' +
        ZA.f.switch('is_enabled', 'Enabled', b.is_enabled) +
        ZA.f.select('placement', 'Placement', b.placement, [['hero', 'Hero (top of homepage)'], ['promo', 'Promo block (further down)']]) +
        ZA.f.text('priority', 'Priority', b.priority, { type: 'number', step: '1', hint: 'Higher shows first' }) +
        ZA.f.text('starts_at', 'Start', toLocalInput(b.starts_at), { type: 'datetime-local', hint: 'Blank = start now' }) +
        ZA.f.text('ends_at', 'End', toLocalInput(b.ends_at), { type: 'datetime-local', hint: 'Blank = no end date' }) +
        ZA.f.select('occasion', 'Occasion tag', b.occasion || '', OCCASIONS) +
        '</div></div></div></div>' +
        '<div class="sticky-actions"><span class="small muted"><span class="hidden" data-dirty-indicator><span class="dirty-dot"></span>Unsaved changes</span></span><div class="row"><a class="btn" href="#/marketing">Cancel</a><button class="btn btn-primary" type="submit" data-busy="Saving…">' + (isNew ? 'Create banner' : 'Save changes') + '</button></div></div></form>';
      var form = ZA.qs('#bannerForm');
      var img = ZA.singleImage(ZA.qs('#bImg'), b.image_url, { bucket: 'banners', maxSide: 2400, hint: 'Wide image, at least 1600px across. Faces/subject toward the centre — it’s cropped on phones.', onChange: function () { ZA.dirty.set(true); } });
      ZA.markDirtyOnInput(form);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = ZA.readForm(form), btn = form.querySelector('[type=submit]');
        if (!v.title) { ZA.fail('Heading is required.'); return; }
        if (!img.get()) { ZA.fail('Add a banner image.'); return; }
        if (!validLink(v.cta_link)) { ZA.fail('Button link must start with #/ or https://'); return; }
        var row = { title: v.title, subtitle: v.subtitle || null, offer_text: v.offer_text || null, cta_text: v.cta_text || null, cta_link: v.cta_link || null,
          is_enabled: v.is_enabled, placement: v.placement, priority: Math.round(v.priority || 0), occasion: v.occasion || null,
          starts_at: fromLocalInput(v.starts_at), ends_at: fromLocalInput(v.ends_at), image_url: img.get() };
        if (row.starts_at && row.ends_at && row.ends_at <= row.starts_at) { ZA.fail('End must be after start.'); return; }
        ZA.busy(btn, true);
        (isNew ? ZA.db.from('banners').insert(row).select('id') : ZA.db.from('banners').update(row).eq('id', b.id).select('id')).then(function (res) {
          var d = ZA.unwrap(res);
          if (!d.length) throw new Error('You don’t have permission to do that.');
          img.committed();
          if (!isNew && oldUrl && oldUrl !== row.image_url) ZA.images.remove('banners', [storagePathFromUrl(oldUrl, 'banners')]);
          ZA.dirty.set(false); ZA.ok('Banner saved'); ZA.go('#/marketing');
        }).catch(function (err) { ZA.busy(btn, false); ZA.fail(err); });
      });
    }).catch(function (e) { el.innerHTML = '<div class="notice danger">' + esc(e.message) + '</div>'; });
  }

  /* ---------- Announcement bar ---------- */
  function renderAnnouncement(el) {
    ZA.setPage('Banners & promotions', [['Marketing']]);
    ZA.q(ZA.db.from('site_settings').select('value').eq('key', 'announcement').maybeSingle()).then(function (row) {
      var a = (row && row.value) || {};
      el.innerHTML = tabs('announcement') + '<div class="card" style="max-width:720px;"><div class="card-head"><h3>Announcement bar</h3></div><div class="card-body"><form id="annForm" class="stack">' +
        ZA.f.switch('enabled', 'Show the announcement bar', a.enabled !== false) +
        ZA.f.text('text', 'Message', a.text, { max: 140, hint: 'Shown in the thin bar at the very top of every page.' }) +
        ZA.f.text('link', 'Link (optional)', a.link, { max: 300, hint: '#/offers or https://…' }) +
        '<div class="form-actions"><button class="btn btn-primary" type="submit" data-busy="Saving…">Save</button></div></form></div></div>';
      var form = ZA.qs('#annForm');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = ZA.readForm(form), btn = form.querySelector('[type=submit]');
        if (!validLink(v.link)) { ZA.fail('Link must start with #/ or https://'); return; }
        ZA.busy(btn, true);
        ZA.q(ZA.db.from('site_settings').update({ value: { enabled: v.enabled, text: v.text, link: v.link } }).eq('key', 'announcement').select('key')).then(function (r) {
          if (!r.length) throw new Error('You don’t have permission to do that.');
          ZA.ok('Announcement updated on the store');
        }).catch(ZA.fail).then(function () { ZA.busy(btn, false); });
      });
    }).catch(function (e) { el.innerHTML = tabs('announcement') + '<div class="notice danger">' + esc(e.message) + '</div>'; });
  }

  /* ---------- Campaigns ---------- */
  var campTable;
  function renderCampaigns(el) {
    ZA.setPage('Banners & promotions', [['Marketing']], '<button class="btn btn-primary btn-sm" data-action="camp-edit">+ New campaign</button>');
    el.innerHTML = tabs('campaigns') + '<div class="notice" style="margin-bottom:16px;">A <strong>live</strong> campaign shows as a band on the homepage linking to its page. It doesn’t change prices by itself — use <a href="#/coupons">coupons</a> or products’ discount prices for that.</div><div id="campTable"></div>';
    campTable = new ZA.DataTable({
      id: 'campaigns', el: ZA.qs('#campTable'), search: 'Search campaigns', defaultSort: { col: 'created_at', asc: false },
      filters: [{ key: 'status', label: 'Status', options: [['draft', 'Draft'], ['scheduled', 'Scheduled'], ['live', 'Live'], ['expired', 'Expired'], ['disabled', 'Disabled']] }],
      columns: [
        { label: 'Campaign', sort: 'name', render: function (c) { return '<span class="cell-title">' + esc(c.name) + '</span>' + ((c.banner_config || {}).text ? '<div class="cell-sub">' + esc(c.banner_config.text) + '</div>' : ''); } },
        { label: 'Dates', render: function (c) { return '<span class="small">' + (c.starts_at ? ZA.date(c.starts_at) : '—') + ' → ' + (c.ends_at ? ZA.date(c.ends_at) : '—') + '</span>'; } },
        { label: 'Status', render: function (c) { return ZA.pill(c.status); } },
        { label: '', cls: 'actions', render: function (c) {
          return '<button class="link" data-action="camp-edit" data-id="' + c.id + '">Edit</button>' +
            (c.status === 'live' ? '<button class="link" data-action="camp-status" data-id="' + c.id + '" data-s="disabled">Turn off</button>' : '<button class="link" data-action="camp-status" data-id="' + c.id + '" data-s="live">Go live</button>') +
            '<button class="link danger" data-action="camp-delete" data-id="' + c.id + '">Delete</button>';
        } }
      ],
      query: function (st) {
        var q = ZA.db.from('campaigns').select('*', { count: 'exact' });
        if (st.filters.status) q = q.eq('status', st.filters.status);
        return ZA.applyTableState(q, st, ['name']).then(function (res) { campTable && (campTable._rows = ZA.unwrap(res)); return { rows: ZA.unwrap(res), total: res.count || 0 }; });
      },
      emptyTitle: 'No campaigns yet'
    });
  }
  ZA.actions['camp-status'] = function (b) {
    var s = b.getAttribute('data-s');
    var go = function () {
      ZA.q(ZA.db.from('campaigns').update({ status: s }).eq('id', b.getAttribute('data-id')).select('id')).then(function (r) {
        if (!r.length) throw new Error('You don’t have permission to do that.');
        ZA.ok(s === 'live' ? 'Campaign is live on the homepage' : 'Campaign turned off'); campTable.reload();
      }).catch(ZA.fail);
    };
    if (s !== 'live') { go(); return; }
    // Only one campaign is shown at a time; turn the others off first.
    ZA.db.from('campaigns').update({ status: 'disabled' }).eq('status', 'live').neq('id', b.getAttribute('data-id')).then(go);
  };
  ZA.actions['camp-delete'] = function (b) {
    ZA.confirm('Delete this campaign?', { danger: true, confirmLabel: 'Delete' }).then(function (ok) {
      if (!ok) return;
      ZA.q(ZA.db.from('campaigns').delete().eq('id', b.getAttribute('data-id')).select('id')).then(function (r) {
        if (!r.length) throw new Error('You don’t have permission to do that.');
        ZA.ok('Deleted'); campTable.reload();
      }).catch(ZA.fail);
    });
  };
  ZA.actions['camp-edit'] = function (b) {
    var id = b.getAttribute('data-id');
    var c = id ? (campTable._rows || []).find(function (x) { return x.id === id; }) : { status: 'draft', banner_config: {} };
    var bc = c.banner_config || {};
    ZA.modal({
      title: id ? 'Edit campaign' : 'New campaign',
      body: '<form id="campForm" class="stack">' + ZA.f.text('name', 'Campaign headline', c.name, { required: true, max: 100, hint: 'Shown large on the homepage band, e.g. “Onam Festive Edit”.' }) +
        ZA.f.text('text', 'Supporting text', bc.text, { max: 200 }) +
        '<div class="grid-2">' + ZA.f.text('link_text', 'Link text', bc.link_text || 'Shop the offer', { max: 40 }) + ZA.f.text('link', 'Link', bc.link || '#/offers', { max: 300 }) + '</div>' +
        '<div class="grid-2">' + ZA.f.text('starts_at', 'Starts', toLocalInput(c.starts_at), { type: 'datetime-local' }) + ZA.f.text('ends_at', 'Ends', toLocalInput(c.ends_at), { type: 'datetime-local' }) + '</div>' +
        ZA.f.select('status', 'Status', c.status, [['draft', 'Draft'], ['scheduled', 'Scheduled'], ['live', 'Live'], ['expired', 'Expired'], ['disabled', 'Disabled']]) + '</form>',
      foot: '<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="campSave" data-busy="Saving…">Save</button>',
      onOpen: function (m, api) {
        m.querySelector('#campSave').addEventListener('click', function () {
          var v = ZA.readForm(m.querySelector('#campForm')), btn = this;
          if (!v.name) { ZA.fail('Headline is required.'); return; }
          if (!validLink(v.link)) { ZA.fail('Link must start with #/ or https://'); return; }
          var row = { name: v.name, status: v.status, starts_at: fromLocalInput(v.starts_at), ends_at: fromLocalInput(v.ends_at), banner_config: Object.assign({}, bc, { text: v.text, link_text: v.link_text, link: v.link }) };
          ZA.busy(btn, true);
          (id ? ZA.db.from('campaigns').update(row).eq('id', id).select('id') : ZA.db.from('campaigns').insert(row).select('id')).then(function (res) {
            if (!ZA.unwrap(res).length) throw new Error('You don’t have permission to do that.');
            api.close(); ZA.ok('Campaign saved'); campTable.reload();
          }).catch(function (e) { ZA.busy(btn, false); ZA.fail(e); });
        });
      }
    });
  };

  ZA.routes.marketing = {
    perm: 'marketing',
    render: function (params, el) {
      if (params[0] === 'banner' && params[1]) return renderBannerForm(params[1], el);
      if (params[0] === 'announcement') return renderAnnouncement(el);
      if (params[0] === 'campaigns') return renderCampaigns(el);
      renderBanners(el);
    }
  };
})();
