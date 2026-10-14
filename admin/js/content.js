/* =========================================================
   Zari Admin — content: About / Contact / policies / FAQ pages, FAQ
   questions and the footer. Text is stored as plain text with a few simple
   formatting rules (no HTML), so nothing typed here can inject script.
   ========================================================= */
(function () {
  var esc = ZA.esc;
  var BUILT_IN = ['about', 'contact', 'privacy', 'terms', 'shipping-info', 'returns', 'faq'];
  var HELP = '<details class="small muted"><summary>Formatting</summary><p style="margin:6px 0 0;">Blank line = new paragraph · <code>## Heading</code> · <code>- bullet</code> · <code>**bold**</code> · <code>[link text](https://…)</code> or <code>[link](#/sarees)</code></p></details>';

  function tabs(active) {
    return '<div class="tabs"><a href="#/content" class="' + (active === 'pages' ? 'active' : '') + '">Pages</a><a href="#/content/faq-items" class="' + (active === 'faq' ? 'active' : '') + '">FAQ questions</a><a href="#/content/footer" class="' + (active === 'footer' ? 'active' : '') + '">Footer</a></div>';
  }

  function renderPages(el) {
    ZA.setPage('Pages & FAQ', [['Content']], '<button class="btn btn-primary btn-sm" data-action="page-new">+ New page</button>');
    ZA.q(ZA.db.from('content_pages').select('slug,title,is_published,updated_at').order('title')).then(function (pages) {
      el.innerHTML = tabs('pages') + '<div class="card"><div class="table-wrap"><table class="data responsive"><thead><tr><th>Page</th><th>Address</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>' +
        pages.map(function (p) {
          return '<tr><td data-label="Page"><a class="cell-title" href="#/content/page/' + encodeURIComponent(p.slug) + '">' + esc(p.title) + '</a>' + (BUILT_IN.indexOf(p.slug) !== -1 ? '' : ' <span class="pill">Custom</span>') + '</td>' +
            '<td data-label="Address" class="mono small">/#/' + (BUILT_IN.indexOf(p.slug) !== -1 ? esc(p.slug) : 'page/' + esc(p.slug)) + '</td><td data-label="Status">' + ZA.pill(p.is_published ? 'published' : 'draft', p.is_published ? 'Published' : 'Hidden') + '</td>' +
            '<td data-label="Updated">' + ZA.ago(p.updated_at) + '</td><td class="actions"><a class="link" href="#/content/page/' + encodeURIComponent(p.slug) + '">Edit</a></td></tr>';
        }).join('') + '</tbody></table></div></div>' +
        '<p class="small muted">Contact details, social links and the store address are edited in ' + (ZA.can('settings') ? '<a href="#/settings/contact">Website settings</a>' : 'Website settings') + ' and appear on the Contact page and footer automatically.</p>';
    }).catch(function (e) { el.innerHTML = tabs('pages') + '<div class="notice danger">' + esc(e.message) + '</div>'; });
  }

  ZA.actions['page-new'] = function () {
    ZA.confirm('Custom pages are available at /#/page/your-address and can be linked from banners or other pages.', { title: 'New page', confirmLabel: 'Create', input: { label: 'Page title', required: true } }).then(function (title) {
      if (!title) return;
      var slug = ZA.slugify(title).slice(0, 60);
      if (slug.length < 2 || BUILT_IN.indexOf(slug) !== -1) { ZA.fail('Choose a different title.'); return; }
      ZA.q(ZA.db.from('content_pages').insert({ slug: slug, title: title.slice(0, 150), body: '', is_published: false }).select('slug')).then(function () {
        ZA.go('#/content/page/' + slug);
      }).catch(ZA.fail);
    });
  };

  function renderPage(slug, el) {
    ZA.setPage('Edit page', [['Content'], ['Pages', '#/content']]);
    ZA.q(ZA.db.from('content_pages').select('*').eq('slug', slug).maybeSingle()).then(function (p) {
      if (!p) { el.innerHTML = '<div class="empty"><strong>Page not found</strong></div>'; return; }
      var builtIn = BUILT_IN.indexOf(p.slug) !== -1;
      var href = '../#/' + (builtIn ? p.slug : 'page/' + p.slug);
      ZA.setPage(p.title, [['Content'], ['Pages', '#/content']], (p.is_published ? '<a class="btn btn-sm" href="' + esc(href) + '" target="_blank" rel="noopener">View page ↗</a>' : ''));
      el.innerHTML = '<form id="pageForm"><div class="cols"><div><div class="card"><div class="card-body stack">' +
        ZA.f.text('title', 'Title', p.title, { required: true, max: 150 }) +
        ZA.f.textarea('body', 'Content', p.body, { rows: 18, max: 50000 }) + HELP +
        (p.slug === 'faq' ? '<div class="notice">Questions from the <a href="#/content/faq-items">FAQ questions</a> tab are listed below this text on the FAQ page.</div>' : '') +
        (p.slug === 'contact' ? '<div class="notice">The contact form and your contact details from Website settings appear below this text.</div>' : '') +
        '</div></div><div class="card"><div class="card-head"><h3>Preview</h3></div><div class="card-body"><div class="prose-preview" id="pagePreview"></div></div></div></div><div>' +
        '<div class="card"><div class="card-head"><h3>Visibility</h3></div><div class="card-body stack">' + ZA.f.switch('is_published', 'Published', p.is_published) +
        '<p class="small muted" style="margin:0;">Address: <span class="mono">' + esc(href.replace('..', '')) + '</span></p></div></div>' +
        '<div class="card"><div class="card-head"><h3>Search engines</h3></div><div class="card-body stack">' +
        ZA.f.text('seo_title', 'SEO title', p.seo_title, { max: 70 }) + ZA.f.textarea('seo_description', 'SEO description', p.seo_description, { rows: 3, max: 170 }) + '</div></div>' +
        (!builtIn ? '<div class="card"><div class="card-body"><button type="button" class="btn btn-danger btn-block" data-action="page-delete" data-slug="' + esc(p.slug) + '">Delete page</button></div></div>' : '') +
        '</div></div><div class="sticky-actions"><span class="small muted"><span class="hidden" data-dirty-indicator><span class="dirty-dot"></span>Unsaved changes</span></span><div class="row"><a class="btn" href="#/content">Back</a><button class="btn btn-primary" type="submit" data-busy="Saving…">Save page</button></div></div></form>';
      var form = ZA.qs('#pageForm');
      function preview() { ZA.qs('#pagePreview').innerHTML = '<h2 style="margin:0 0 10px;">' + esc(form.querySelector('[name=title]').value) + '</h2>' + ZA.renderRichText(form.querySelector('[name=body]').value); }
      preview();
      form.addEventListener('input', ZA.debounce(preview, 200));
      ZA.markDirtyOnInput(form);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = ZA.readForm(form), btn = form.querySelector('[type=submit]');
        if (!v.title) { ZA.fail('Title is required.'); return; }
        ZA.busy(btn, true);
        ZA.q(ZA.db.from('content_pages').update({ title: v.title, body: v.body, is_published: v.is_published, seo_title: v.seo_title || null, seo_description: v.seo_description || null, updated_at: new Date().toISOString(), updated_by: ZA.me.id }).eq('slug', p.slug).select('slug')).then(function (r) {
          if (!r.length) throw new Error('You don’t have permission to do that.');
          ZA.dirty.set(false); ZA.ok('Page saved — live on the store'); ZA.app.route();
        }).catch(function (err) { ZA.busy(btn, false); ZA.fail(err); });
      });
    }).catch(function (e) { el.innerHTML = '<div class="notice danger">' + esc(e.message) + '</div>'; });
  }
  ZA.actions['page-delete'] = function (b) {
    ZA.confirm('Delete this page? Links to it will show “page not found”.', { danger: true, confirmLabel: 'Delete' }).then(function (ok) {
      if (!ok) return;
      ZA.q(ZA.db.from('content_pages').delete().eq('slug', b.getAttribute('data-slug')).select('slug')).then(function (r) {
        if (!r.length) throw new Error('You don’t have permission to do that.');
        ZA.dirty.set(false); ZA.ok('Page deleted'); ZA.go('#/content');
      }).catch(ZA.fail);
    });
  };

  /* ---------- FAQ questions ---------- */
  var faqs = [];
  function renderFaq(el) {
    ZA.setPage('Pages & FAQ', [['Content']], '<button class="btn btn-primary btn-sm" data-action="faq-edit">+ Add question</button>');
    ZA.q(ZA.db.from('faq_items').select('*').order('sort_order').order('created_at')).then(function (rows) {
      faqs = rows;
      el.innerHTML = tabs('faq') + '<div class="card">' + (rows.length ? '<ul class="list" id="faqList">' + rows.map(function (f) {
        return '<li data-id="' + f.id + '" draggable="true"><div class="row" style="flex:1;min-width:0;"><span class="handle" aria-hidden="true">⠿</span><div style="min-width:0;"><span class="cell-title">' + esc(f.question) + '</span><div class="cell-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:520px;">' + esc(f.answer) + '</div></div></div>' +
          '<div class="row"><label class="switch"><input type="checkbox" data-change="faq-visible" data-id="' + f.id + '"' + (f.is_visible ? ' checked' : '') + '><span class="track"></span><span class="small">' + (f.is_visible ? 'Shown' : 'Hidden') + '</span></label>' + ZA.moveButtons +
          '<button class="link" data-action="faq-edit" data-id="' + f.id + '">Edit</button><button class="link danger" data-action="faq-delete" data-id="' + f.id + '">Delete</button></div></li>';
      }).join('') + '</ul>' : '<div class="empty"><strong>No questions yet</strong>Add common questions about sizing, care, shipping and returns.</div>') + '</div>';
      var list = ZA.qs('#faqList');
      if (list) ZA.sortable(list, function (ids) {
        Promise.all(ids.map(function (id, i) { return ZA.db.from('faq_items').update({ sort_order: (i + 1) * 10 }).eq('id', id); })).then(function () { ZA.ok('Order saved'); });
      });
    }).catch(function (e) { el.innerHTML = tabs('faq') + '<div class="notice danger">' + esc(e.message) + '</div>'; });
  }
  ZA.actions['faq-visible'] = function (inp) {
    ZA.q(ZA.db.from('faq_items').update({ is_visible: inp.checked }).eq('id', inp.getAttribute('data-id')).select('id')).then(function (r) {
      if (!r.length) throw new Error('You don’t have permission to do that.');
      inp.parentElement.querySelector('.small').textContent = inp.checked ? 'Shown' : 'Hidden';
    }).catch(function (e) { inp.checked = !inp.checked; ZA.fail(e); });
  };
  ZA.actions['faq-edit'] = function (b) {
    var id = b.getAttribute('data-id'), f = id ? faqs.find(function (x) { return x.id === id; }) : { is_visible: true };
    ZA.modal({
      title: id ? 'Edit question' : 'New question', wide: true,
      body: '<form id="faqForm" class="stack">' + ZA.f.text('question', 'Question', f.question, { required: true, max: 300 }) + ZA.f.textarea('answer', 'Answer', f.answer, { rows: 6, max: 4000 }) + HELP + ZA.f.switch('is_visible', 'Show on the FAQ page', f.is_visible) + '</form>',
      foot: '<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="faqSave" data-busy="Saving…">Save</button>',
      onOpen: function (m, api) {
        m.querySelector('#faqSave').addEventListener('click', function () {
          var v = ZA.readForm(m.querySelector('#faqForm')), btn = this;
          if (!v.question || !v.answer) { ZA.fail('Question and answer are both required.'); return; }
          var row = { question: v.question, answer: v.answer, is_visible: v.is_visible, updated_at: new Date().toISOString() };
          if (!id) row.sort_order = (faqs.reduce(function (m2, x) { return Math.max(m2, x.sort_order || 0); }, 0)) + 10;
          ZA.busy(btn, true);
          (id ? ZA.db.from('faq_items').update(row).eq('id', id).select('id') : ZA.db.from('faq_items').insert(row).select('id')).then(function (res) {
            if (!ZA.unwrap(res).length) throw new Error('You don’t have permission to do that.');
            api.close(); ZA.ok('Saved'); renderFaq(ZA.qs('#content'));
          }).catch(function (e) { ZA.busy(btn, false); ZA.fail(e); });
        });
      }
    });
  };
  ZA.actions['faq-delete'] = function (b) {
    ZA.confirm('Delete this question?', { danger: true, confirmLabel: 'Delete' }).then(function (ok) {
      if (!ok) return;
      ZA.q(ZA.db.from('faq_items').delete().eq('id', b.getAttribute('data-id')).select('id')).then(function () { ZA.ok('Deleted'); renderFaq(ZA.qs('#content')); }).catch(ZA.fail);
    });
  };

  /* ---------- Footer ---------- */
  function renderFooter(el) {
    ZA.setPage('Pages & FAQ', [['Content']]);
    ZA.q(ZA.db.from('site_settings').select('value').eq('key', 'footer').maybeSingle()).then(function (row) {
      var f = (row && row.value) || {};
      el.innerHTML = tabs('footer') + '<div class="card" style="max-width:720px;"><div class="card-body"><form id="footForm" class="stack">' +
        ZA.f.textarea('tagline', 'Footer tagline', f.tagline, { rows: 2, max: 200 }) +
        ZA.f.text('bottom_note', 'Bottom line (next to the copyright)', f.bottom_note, { max: 100 }) +
        '<p class="small muted" style="margin:0;">Social links and contact details in the footer come from ' + (ZA.can('settings') ? '<a href="#/settings/social">Website settings</a>' : 'Website settings') + '.</p>' +
        '<div class="form-actions"><button class="btn btn-primary" type="submit" data-busy="Saving…">Save footer</button></div></form></div></div>';
      var form = ZA.qs('#footForm');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = ZA.readForm(form), btn = form.querySelector('[type=submit]');
        ZA.busy(btn, true);
        ZA.q(ZA.db.from('site_settings').update({ value: { tagline: v.tagline, bottom_note: v.bottom_note } }).eq('key', 'footer').select('key')).then(function (r) {
          if (!r.length) throw new Error('You don’t have permission to do that.');
          ZA.ok('Footer updated');
        }).catch(ZA.fail).then(function () { ZA.busy(btn, false); });
      });
    }).catch(function (e) { el.innerHTML = tabs('footer') + '<div class="notice danger">' + esc(e.message) + '</div>'; });
  }

  ZA.routes.content = {
    perm: 'content',
    render: function (params, el) {
      if (params[0] === 'page' && params[1]) return renderPage(params[1], el);
      if (params[0] === 'faq-items') return renderFaq(el);
      if (params[0] === 'footer') return renderFooter(el);
      renderPages(el);
    }
  };
})();
