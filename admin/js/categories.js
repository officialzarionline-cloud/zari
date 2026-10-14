/* =========================================================
   Zari Admin — categories (with subcategories), fabrics, occasions, styles.
   Hidden categories disappear from the store's navigation and filters
   (RLS: public sees only is_visible rows); their products stay visible.
   ========================================================= */
(function () {
  var esc = ZA.esc;
  var KINDS = [['saree_type', 'Categories', 'Category'], ['fabric', 'Fabrics', 'Fabric'], ['occasion', 'Occasions', 'Occasion'], ['style', 'Styles', 'Style']];
  var state = { kind: 'saree_type', cats: [], counts: {} };

  function load() {
    return Promise.all([
      ZA.q(ZA.db.from('categories').select('*').order('sort_order').order('name')),
      ZA.q(ZA.db.from('product_categories').select('category_id'))
    ]).then(function (r) {
      state.cats = r[0];
      state.counts = {};
      r[1].forEach(function (x) { state.counts[x.category_id] = (state.counts[x.category_id] || 0) + 1; });
    });
  }

  function render(el) {
    var kindLabel = KINDS.find(function (k) { return k[0] === state.kind; });
    ZA.setPage('Categories', [['Catalogue']], '<button class="btn btn-primary btn-sm" data-action="cat-new">+ New ' + esc(kindLabel[2].toLowerCase()) + '</button>');
    var list = state.cats.filter(function (c) { return c.kind === state.kind; });
    function branch(pid, depth) {
      var kids = list.filter(function (c) { return (c.parent_id || null) === pid; });
      if (!kids.length) return '';
      return '<ul class="list" data-parent="' + (pid || '') + '"' + (depth ? ' style="margin-top:8px;border-left:1px solid var(--line);"' : '') + '>' + kids.map(function (c) {
        return '<li data-id="' + c.id + '" draggable="true" style="display:block;padding-right:18px;' + (depth ? 'padding-left:24px;' : '') + '">' +
          '<div class="row-between"><div class="row" style="flex:1;min-width:0;"><span class="handle" aria-hidden="true">⠿</span>' +
          (c.image_url ? '<img src="' + esc(c.image_url) + '" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:2px;">' : '') +
          '<div style="min-width:0;"><span class="cell-title">' + esc(c.name) + '</span>' + (depth ? ' <span class="pill">Subcategory</span>' : '') +
          '<div class="cell-sub">/' + esc(c.slug) + ' · <a href="#/products" data-action="cat-products" data-id="' + c.id + '">' + (state.counts[c.id] || 0) + ' products</a></div></div></div>' +
          '<div class="row">' +
          '<label class="switch" title="Show on store"><input type="checkbox" data-change="cat-visible" data-id="' + c.id + '"' + (c.is_visible ? ' checked' : '') + '><span class="track"></span><span class="small">' + (c.is_visible ? 'Visible' : 'Hidden') + '</span></label>' +
          ZA.moveButtons +
          '<button class="link" data-action="cat-edit" data-id="' + c.id + '">Edit</button>' +
          '<button class="link danger" data-action="cat-delete" data-id="' + c.id + '">Delete</button></div></div>' +
          branch(c.id, depth + 1) + '</li>';
      }).join('') + '</ul>';
    }
    el.innerHTML = '<div class="tabs" role="tablist">' + KINDS.map(function (k) {
      return '<button role="tab" aria-selected="' + (k[0] === state.kind) + '" class="' + (k[0] === state.kind ? 'active' : '') + '" data-action="cat-kind" data-kind="' + k[0] + '">' + esc(k[1]) + ' (' + state.cats.filter(function (c) { return c.kind === k[0]; }).length + ')</button>';
    }).join('') + '</div>' +
      '<div class="card">' + (list.length ? branch(null, 0) : '<div class="empty"><strong>No ' + esc(kindLabel[1].toLowerCase()) + ' yet</strong>Create the first one to start organising products.</div>') + '</div>' +
      '<p class="small muted">Drag ⠿ or use ↑ ↓ to set the display order on the store. Subcategories are ordered within their parent.</p>';
    ZA.qsa('ul.list[data-parent]', el).forEach(function (ul) {
      ZA.sortable(ul, function (ids) {
        Promise.all(ids.map(function (id, i) { return ZA.db.from('categories').update({ sort_order: (i + 1) * 10 }).eq('id', id); })).then(function (res) {
          var err = res.find(function (r) { return r.error; });
          if (err) { ZA.fail(ZA.errorMessage(err.error)); return; }
          ids.forEach(function (id, i) { var c = state.cats.find(function (x) { return x.id === id; }); if (c) c.sort_order = (i + 1) * 10; });
          ZA.ok('Order saved');
        });
      });
    });
  }

  ZA.actions['cat-kind'] = function (b) { state.kind = b.getAttribute('data-kind'); render(ZA.qs('#content')); };
  ZA.actions['cat-products'] = function (b) {
    try {
      var saved = JSON.parse(sessionStorage.getItem('za_tbl_products') || '{}');
      saved.filters = { category: b.getAttribute('data-id') }; saved.page = 1;
      sessionStorage.setItem('za_tbl_products', JSON.stringify(saved));
    } catch (e) {}
    ZA.go('#/products');
  };
  ZA.actions['cat-visible'] = function (inp) {
    var id = inp.getAttribute('data-id');
    ZA.q(ZA.db.from('categories').update({ is_visible: inp.checked }).eq('id', id).select('id')).then(function (r) {
      if (!r.length) throw new Error('You don’t have permission to do that.');
      state.cats.find(function (c) { return c.id === id; }).is_visible = inp.checked;
      inp.parentElement.querySelector('.small').textContent = inp.checked ? 'Visible' : 'Hidden';
      ZA.ok(inp.checked ? 'Category visible on the store' : 'Category hidden from the store');
    }).catch(function (e) { inp.checked = !inp.checked; ZA.fail(e); });
  };
  ZA.actions['cat-new'] = function () { edit(null); };
  ZA.actions['cat-edit'] = function (b) { edit(state.cats.find(function (c) { return c.id === b.getAttribute('data-id'); })); };
  ZA.actions['cat-delete'] = function (b) {
    var c = state.cats.find(function (x) { return x.id === b.getAttribute('data-id'); });
    var n = state.counts[c.id] || 0, kids = state.cats.filter(function (x) { return x.parent_id === c.id; }).length;
    ZA.confirm('Delete “' + c.name + '”? ' + (n ? n + ' product' + (n === 1 ? ' is' : 's are') + ' unlinked from it (the products themselves stay). ' : '') + (kids ? kids + ' subcategor' + (kids === 1 ? 'y moves' : 'ies move') + ' to the top level. ' : '') + 'Coupons limited to this category stop applying to it.', { title: 'Delete category', danger: true, confirmLabel: 'Delete' }).then(function (ok) {
      if (!ok) return;
      ZA.q(ZA.db.from('categories').delete().eq('id', c.id).select('id')).then(function (r) {
        if (!r.length) throw new Error('You don’t have permission to do that.');
        ZA.ok('Category deleted'); return load().then(function () { render(ZA.qs('#content')); });
      }).catch(ZA.fail);
    });
  };

  function edit(c) {
    var isNew = !c;
    c = c || { kind: state.kind, is_visible: true };
    // Valid parents: same kind, not itself or one of its descendants.
    var blocked = {};
    if (!isNew) { (function mark(id) { blocked[id] = true; state.cats.filter(function (x) { return x.parent_id === id; }).forEach(function (x) { mark(x.id); }); })(c.id); }
    var parents = ZA.categoryTree(state.cats.filter(function (x) { return x.kind === c.kind && !blocked[x.id]; }));
    var image;
    ZA.modal({
      title: isNew ? 'New ' + KINDS.find(function (k) { return k[0] === c.kind; })[2].toLowerCase() : 'Edit “' + c.name + '”',
      body: '<form id="catForm" class="stack" novalidate>' +
        '<div class="grid-2">' + ZA.f.text('name', 'Name', c.name, { required: true, max: 80 }) + ZA.f.text('slug', 'URL slug', c.slug, { max: 80, hint: 'Used in store links. Blank = from name.' }) + '</div>' +
        '<div class="grid-2">' + ZA.f.select('kind', 'Type', c.kind, KINDS.map(function (k) { return [k[0], k[2]]; })) +
        ZA.f.select('parent_id', 'Parent (for subcategories)', c.parent_id || '', [['', '— None (top level) —']].concat(parents.map(function (p) { return [p.id, '  '.repeat(p.depth) + p.name]; }))) + '</div>' +
        ZA.f.textarea('description', 'Description', c.description, { rows: 3, max: 1000 }) +
        '<div class="field"><span class="label">Category image</span><div id="catImg"></div></div>' +
        ZA.f.switch('is_visible', 'Show on the store', c.is_visible) + '</form>',
      foot: '<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="catSave" data-busy="Saving…">' + (isNew ? 'Create' : 'Save') + '</button>',
      onOpen: function (m, api) {
        image = ZA.singleImage(m.querySelector('#catImg'), c.image_url, { bucket: 'site', square: true, maxSide: 1200 });
        var form = m.querySelector('#catForm');
        form.querySelector('[name=kind]').addEventListener('change', function () { form.querySelector('[name=parent_id]').value = ''; form.querySelector('[name=parent_id]').disabled = this.value !== c.kind; });
        m.querySelector('#catSave').addEventListener('click', function () {
          var v = ZA.readForm(form), btn = this;
          if (!v.name) { form.querySelector('[name=name]').setAttribute('aria-invalid', 'true'); ZA.fail('Name is required.'); return; }
          var row = { name: v.name, slug: ZA.slugify(v.slug || v.name), kind: v.kind, parent_id: v.kind === c.kind ? (v.parent_id || null) : null, description: v.description || null, image_url: image.get() || null, is_visible: v.is_visible };
          if (!row.slug) { ZA.fail('Enter a name with letters or numbers.'); return; }
          if (isNew) row.sort_order = (state.cats.filter(function (x) { return x.kind === v.kind; }).reduce(function (mx, x) { return Math.max(mx, x.sort_order || 0); }, 0)) + 10;
          ZA.busy(btn, true);
          (isNew ? ZA.db.from('categories').insert(row).select('id') : ZA.db.from('categories').update(row).eq('id', c.id).select('id')).then(function (res) {
            var data = ZA.unwrap(res);
            if (!data.length) throw new Error('You don’t have permission to do that.');
            image.committed();
            ZA.ok(isNew ? 'Created' : 'Saved');
            api.close();
            state.kind = v.kind;
            return load().then(function () { render(ZA.qs('#content')); });
          }).catch(function (e) { ZA.busy(btn, false); ZA.fail(e); });
        });
      }
    });
  }

  ZA.routes.categories = {
    perm: 'categories',
    render: function (params, el) { load().then(function () { render(el); }).catch(function (e) { el.innerHTML = '<div class="notice danger">' + esc(e.message) + '</div>'; }); }
  };
})();
