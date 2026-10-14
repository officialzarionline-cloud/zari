/* =========================================================
   Zari Admin — UI components: modal, confirm, data table, form fields,
   image manager, single image, sortable list, product picker.
   ========================================================= */
(function () {
  var esc = ZA.esc;

  /* ---------- Modal ---------- */
  ZA.modal = function (opts) {
    var root = ZA.qs('#modalRoot');
    var scrim = document.createElement('div');
    scrim.className = 'modal-scrim';
    scrim.innerHTML = '<div class="modal ' + (opts.wide ? 'wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="mTitle">' +
      '<div class="modal-head"><h2 id="mTitle">' + esc(opts.title || '') + '</h2><button class="icon-btn" data-close aria-label="Close">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="modal-body">' + (opts.body || '') + '</div>' +
      (opts.foot !== false ? '<div class="modal-foot">' + (opts.foot || '<button class="btn" data-close>Close</button>') + '</div>' : '') +
      '</div>';
    root.appendChild(scrim);
    var prevFocus = document.activeElement;
    var closed = false;
    function close(value) {
      if (closed) return; closed = true;
      scrim.remove();
      document.removeEventListener('keydown', onKey);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      if (opts.onClose) opts.onClose(value);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    scrim.addEventListener('click', function (e) {
      if (e.target === scrim || e.target.closest('[data-close]')) close();
    });
    var modal = scrim.querySelector('.modal');
    var first = modal.querySelector('input, select, textarea, button:not([data-close])');
    setTimeout(function () { (first || modal.querySelector('[data-close]')).focus(); }, 20);
    var api = { el: modal, close: close };
    if (opts.onOpen) opts.onOpen(modal, api);
    return api;
  };

  // Promise-based confirm. opts.input = {label, placeholder, required} turns it into a prompt.
  ZA.confirm = function (message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var m = ZA.modal({
        title: opts.title || 'Are you sure?',
        body: '<p style="margin:0 0 ' + (opts.input || opts.checkbox ? '14px' : '0') + ';">' + esc(message) + '</p>' +
          (opts.input ? '<div class="field"><label for="cfInput">' + esc(opts.input.label || '') + '</label>' +
            (opts.input.multiline ? '<textarea id="cfInput" rows="3" placeholder="' + esc(opts.input.placeholder || '') + '"></textarea>'
              : '<input id="cfInput" type="text" placeholder="' + esc(opts.input.placeholder || '') + '">') + '</div>' : '') +
          (opts.checkbox ? '<label class="check-row" style="margin-top:12px;"><input type="checkbox" id="cfCheck"' + (opts.checkbox.checked ? ' checked' : '') + '> ' + esc(opts.checkbox.label) + '</label>' : ''),
        foot: '<button class="btn" data-close>Cancel</button><button class="btn ' + (opts.danger ? 'btn-danger solid' : 'btn-primary') + '" data-ok>' + esc(opts.confirmLabel || 'Confirm') + '</button>',
        onClose: function () { resolve(false); },
        onOpen: function (el, api) {
          el.querySelector('[data-ok]').addEventListener('click', function () {
            var val = true;
            if (opts.input) {
              val = el.querySelector('#cfInput').value.trim();
              if (opts.input.required && !val) { el.querySelector('#cfInput').setAttribute('aria-invalid', 'true'); el.querySelector('#cfInput').focus(); return; }
            }
            if (opts.checkbox) val = { value: val, checked: el.querySelector('#cfCheck').checked };
            resolve(val);
            opts.onClose = null;
            api.close(val);
          });
        }
      });
      // resolve(false) happens via onClose for cancel/escape; prevent double resolve
      var origClose = m.close;
      m.close = function (v) { origClose(v); };
    });
  };

  /* ---------- Form fields (HTML builders) ---------- */
  function attrs(o) {
    return Object.keys(o || {}).filter(function (k) { return o[k] !== false && o[k] != null; })
      .map(function (k) { return o[k] === true ? k : k + '="' + esc(o[k]) + '"'; }).join(' ');
  }
  ZA.f = {
    text: function (name, label, value, o) {
      o = o || {};
      var id = 'f_' + name;
      return '<div class="field ' + (o.cls || '') + '"><label for="' + id + '">' + esc(label) + (o.required ? ' *' : '') + '</label>' +
        (o.prefix ? '<div class="input-group"><span>' + esc(o.prefix) + '</span>' : '') +
        '<input ' + attrs({ id: id, name: name, type: o.type || 'text', value: value == null ? '' : value, required: !!o.required, placeholder: o.placeholder, maxlength: o.max, min: o.min, step: o.step, 'data-type': o.dataType || (o.type === 'number' ? 'number' : null), autocomplete: o.autocomplete || 'off', inputmode: o.inputmode, pattern: o.pattern }) + '>' +
        (o.prefix ? '</div>' : '') +
        (o.hint ? '<span class="hint">' + o.hint + '</span>' : '') + '</div>';
    },
    textarea: function (name, label, value, o) {
      o = o || {};
      return '<div class="field ' + (o.cls || '') + '"><label for="f_' + name + '">' + esc(label) + '</label>' +
        '<textarea ' + attrs({ id: 'f_' + name, name: name, rows: o.rows || 4, maxlength: o.max, placeholder: o.placeholder }) + '>' + esc(value || '') + '</textarea>' +
        (o.hint ? '<span class="hint">' + o.hint + '</span>' : '') + '</div>';
    },
    select: function (name, label, value, options, o) {
      o = o || {};
      return '<div class="field ' + (o.cls || '') + '"><label for="f_' + name + '">' + esc(label) + '</label>' +
        '<select ' + attrs({ id: 'f_' + name, name: name, 'data-type': o.dataType }) + '>' +
        options.map(function (opt) {
          var v = Array.isArray(opt) ? opt[0] : opt, l = Array.isArray(opt) ? opt[1] : opt;
          return '<option value="' + esc(v) + '"' + (String(v) === String(value == null ? '' : value) ? ' selected' : '') + '>' + esc(l) + '</option>';
        }).join('') + '</select>' + (o.hint ? '<span class="hint">' + o.hint + '</span>' : '') + '</div>';
    },
    switch: function (name, label, checked, o) {
      o = o || {};
      return '<label class="switch ' + (o.cls || '') + '"><input type="checkbox" name="' + esc(name) + '" data-type="bool"' + (checked ? ' checked' : '') + '><span class="track"></span><span>' + esc(label) + '</span></label>';
    },
    check: function (name, label, checked, value) {
      return '<label class="check-row"><input type="checkbox" name="' + esc(name) + '"' + (value != null ? ' value="' + esc(value) + '"' : ' data-type="bool"') + (checked ? ' checked' : '') + '> ' + esc(label) + '</label>';
    }
  };

  // Read a form into an object: data-type="number" → Number|null, data-type="bool"
  // → boolean, repeated checkbox names with values → arrays.
  ZA.readForm = function (form) {
    var out = {};
    ZA.qsa('input[name], select[name], textarea[name]', form).forEach(function (el) {
      var name = el.name, type = el.getAttribute('data-type');
      if (el.type === 'checkbox' && el.hasAttribute('value')) {
        if (!out[name]) out[name] = [];
        if (el.checked) out[name].push(el.value);
        return;
      }
      if (el.type === 'checkbox' || type === 'bool') { out[name] = el.checked; return; }
      if (el.type === 'radio') { if (el.checked) out[name] = el.value; return; }
      var v = el.value;
      if (type === 'number') { out[name] = v === '' ? null : Number(v); return; }
      out[name] = typeof v === 'string' ? v.trim() : v;
    });
    return out;
  };

  ZA.markDirtyOnInput = function (form) {
    form.addEventListener('input', function () { ZA.dirty.set(true); });
    form.addEventListener('change', function () { ZA.dirty.set(true); });
  };

  /* ---------- Data table (server-side search / filter / sort / paging) ---------- */
  var SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>';
  ZA.DataTable = function (opts) {
    var self = this;
    this.opts = opts;
    var saved = {};
    try { saved = JSON.parse(sessionStorage.getItem('za_tbl_' + opts.id) || '{}'); } catch (e) { saved = {}; }
    this.state = {
      page: saved.page || 1, pageSize: saved.pageSize || opts.pageSize || 25, search: saved.search || '',
      filters: Object.assign({}, opts.defaultFilters || {}, saved.filters || {}),
      sort: saved.sort || opts.defaultSort || null
    };
    if (opts.initialFilters) Object.assign(this.state.filters, opts.initialFilters);
    this.rows = []; this.total = 0; this.selected = {};
    var el = opts.el;
    el.innerHTML = '<div class="card">' +
      '<div class="table-tools">' +
      (opts.search !== false ? '<div class="search">' + SEARCH_ICON + '<input type="search" placeholder="' + esc(opts.search || 'Search') + '" value="' + esc(this.state.search) + '" aria-label="Search"></div>' : '') +
      (opts.filters || []).map(function (f) {
        return '<select data-filter="' + esc(f.key) + '" aria-label="' + esc(f.label) + '">' +
          '<option value="">' + esc(f.label) + ': All</option>' +
          f.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(self.state.filters[f.key] || '') === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') +
          '</select>';
      }).join('') + (opts.toolsExtra || '') + '</div>' +
      '<div class="bulk-bar hidden"></div>' +
      '<div class="table-wrap"><table class="data responsive"><thead></thead><tbody></tbody></table></div>' +
      '<div class="pager"></div></div>';
    this.tbody = el.querySelector('tbody');
    this.thead = el.querySelector('thead');
    this.pager = el.querySelector('.pager');
    this.bulkBar = el.querySelector('.bulk-bar');

    var search = el.querySelector('.search input');
    if (search) search.addEventListener('input', ZA.debounce(function () { self.state.search = search.value; self.state.page = 1; self.load(); }, 350));
    ZA.qsa('[data-filter]', el).forEach(function (s) {
      s.addEventListener('change', function () { self.state.filters[s.getAttribute('data-filter')] = s.value; self.state.page = 1; self.load(); });
    });
    this.thead.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sort]');
      if (b) {
        var col = b.getAttribute('data-sort');
        self.state.sort = self.state.sort && self.state.sort.col === col ? { col: col, asc: !self.state.sort.asc } : { col: col, asc: true };
        self.load(); return;
      }
      var all = e.target.closest('[data-check-all]');
      if (all) { self.rows.forEach(function (r) { if (all.checked) self.selected[self.rowId(r)] = r; else delete self.selected[self.rowId(r)]; }); self.renderRows(); self.renderBulk(); }
    });
    this.tbody.addEventListener('change', function (e) {
      var c = e.target.closest('[data-check]');
      if (!c) return;
      var row = self.rows.find(function (r) { return String(self.rowId(r)) === c.getAttribute('data-check'); });
      if (c.checked) self.selected[c.getAttribute('data-check')] = row; else delete self.selected[c.getAttribute('data-check')];
      c.closest('tr').classList.toggle('selected', c.checked);
      self.renderBulk();
    });
    this.pager.addEventListener('click', function (e) {
      var b = e.target.closest('[data-page]');
      if (b && !b.disabled) { self.state.page = Number(b.getAttribute('data-page')); self.load(); }
    });
    this.pager.addEventListener('change', function (e) {
      if (e.target.matches('[data-page-size]')) { self.state.pageSize = Number(e.target.value); self.state.page = 1; self.load(); }
    });
    this.bulkBar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-bulk]');
      if (!b) return;
      var action = (opts.bulk || [])[Number(b.getAttribute('data-bulk'))];
      var rows = Object.keys(self.selected).map(function (k) { return self.selected[k]; });
      if (b.hasAttribute('data-bulk-clear')) { self.selected = {}; self.renderRows(); self.renderBulk(); return; }
      if (action) action.run(rows, b);
    });
    this.renderHead();
    this.load();
  };
  ZA.DataTable.prototype.rowId = function (r) { return this.opts.rowId ? this.opts.rowId(r) : r.id; };
  ZA.DataTable.prototype.renderHead = function () {
    var s = this.state.sort, o = this.opts;
    this.thead.innerHTML = '<tr>' + (o.selectable ? '<th class="check"><input type="checkbox" data-check-all aria-label="Select all on this page"></th>' : '') +
      o.columns.map(function (c) {
        var arrow = s && s.col === c.sort ? (s.asc ? ' ↑' : ' ↓') : '';
        return '<th class="' + (c.cls || '') + '">' + (c.sort ? '<button data-sort="' + esc(c.sort) + '">' + esc(c.label) + arrow + '</button>' : esc(c.label)) + '</th>';
      }).join('') + '</tr>';
  };
  ZA.DataTable.prototype.load = function () {
    var self = this, o = this.opts;
    try { sessionStorage.setItem('za_tbl_' + o.id, JSON.stringify({ page: this.state.page, pageSize: this.state.pageSize, search: this.state.search, filters: this.state.filters, sort: this.state.sort })); } catch (e) {}
    this.renderHead();
    var cols = o.columns.length + (o.selectable ? 1 : 0);
    this.tbody.innerHTML = '<tr><td colspan="' + cols + '" class="muted"><span class="spinner"></span> Loading…</td></tr>';
    var token = this._token = {};
    Promise.resolve(o.query(this.state)).then(function (res) {
      if (token !== self._token) return;
      self.rows = res.rows || []; self.total = res.total || 0;
      var maxPage = Math.max(1, Math.ceil(self.total / self.state.pageSize));
      if (self.state.page > maxPage && self.total > 0) { self.state.page = maxPage; self.load(); return; }
      self.renderRows(); self.renderPager(); self.renderBulk();
    }).catch(function (err) {
      if (token !== self._token) return;
      self.tbody.innerHTML = '<tr><td colspan="' + cols + '"><div class="notice danger">' + esc(err.message || ZA.errorMessage(err)) + '</div></td></tr>';
      self.pager.innerHTML = '';
    });
  };
  ZA.DataTable.prototype.reload = function () { this.load(); };
  ZA.DataTable.prototype.renderRows = function () {
    var self = this, o = this.opts;
    if (!this.rows.length) {
      this.tbody.innerHTML = '<tr><td colspan="' + (o.columns.length + (o.selectable ? 1 : 0)) + '"><div class="empty"><strong>' + esc(o.emptyTitle || 'Nothing here yet') + '</strong>' + (o.emptyText || '') + '</div></td></tr>';
      return;
    }
    this.tbody.innerHTML = this.rows.map(function (r) {
      var id = String(self.rowId(r)), sel = !!self.selected[id];
      return '<tr class="' + (sel ? 'selected' : '') + '">' +
        (o.selectable ? '<td class="check"><input type="checkbox" data-check="' + esc(id) + '"' + (sel ? ' checked' : '') + ' aria-label="Select row"></td>' : '') +
        o.columns.map(function (c) {
          var v = c.render ? c.render(r) : esc(r[c.key]);
          return '<td class="' + (c.cls || '') + '"' + (c.label && c.cls !== 'actions' ? ' data-label="' + esc(c.label) + '"' : '') + '>' + (v == null || v === '' ? '<span class="muted">—</span>' : v) + '</td>';
        }).join('') + '</tr>';
    }).join('');
  };
  ZA.DataTable.prototype.renderPager = function () {
    var st = this.state, total = this.total;
    var from = total ? (st.page - 1) * st.pageSize + 1 : 0, to = Math.min(st.page * st.pageSize, total);
    var maxPage = Math.max(1, Math.ceil(total / st.pageSize));
    this.pager.innerHTML = '<span>' + ZA.num(from) + '–' + ZA.num(to) + ' of ' + ZA.num(total) + '</span>' +
      '<div class="row"><select data-page-size aria-label="Rows per page">' + [10, 25, 50, 100].map(function (n) { return '<option' + (n === st.pageSize ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>' +
      '<button class="btn btn-sm" data-page="' + (st.page - 1) + '"' + (st.page <= 1 ? ' disabled' : '') + '>‹ Prev</button>' +
      '<span>Page ' + st.page + ' / ' + maxPage + '</span>' +
      '<button class="btn btn-sm" data-page="' + (st.page + 1) + '"' + (st.page >= maxPage ? ' disabled' : '') + '>Next ›</button></div>';
  };
  ZA.DataTable.prototype.renderBulk = function () {
    var n = Object.keys(this.selected).length, o = this.opts;
    if (!o.selectable || !n) { this.bulkBar.classList.add('hidden'); return; }
    this.bulkBar.classList.remove('hidden');
    this.bulkBar.innerHTML = '<strong>' + n + ' selected</strong>' + (o.bulk || []).map(function (b, i) {
      return '<button class="btn btn-sm ' + (b.danger ? 'btn-danger' : '') + '" data-bulk="' + i + '">' + esc(b.label) + '</button>';
    }).join('') + '<button class="link" data-bulk data-bulk-clear>Clear selection</button>';
  };
  ZA.DataTable.prototype.clearSelection = function () { this.selected = {}; this.renderRows(); this.renderBulk(); };
  // Paginate through every matching row (for exports), up to a safety cap.
  ZA.DataTable.prototype.fetchAll = function (cap) {
    var self = this, all = [], page = 1, size = 500;
    cap = cap || 5000;
    function next() {
      var st = Object.assign({}, self.state, { page: page, pageSize: size });
      return Promise.resolve(self.opts.query(st)).then(function (res) {
        all = all.concat(res.rows || []);
        if (all.length < res.total && all.length < cap && (res.rows || []).length) { page++; return next(); }
        return all.slice(0, cap);
      });
    }
    return next();
  };
  // Apply state (search/filters/sort/paging) to a supabase-js query builder.
  ZA.applyTableState = function (q, st, searchCols) {
    var term = ZA.searchTerm(st.search);
    if (term && searchCols) q = q.or(searchCols.map(function (c) { return c + '.ilike.*' + term + '*'; }).join(','));
    if (st.sort) q = q.order(st.sort.col, { ascending: st.sort.asc, nullsFirst: false });
    var from = (st.page - 1) * st.pageSize;
    return q.range(from, from + st.pageSize - 1);
  };

  /* ---------- Image manager (multiple images, reorder, main, replace, delete) ---------- */
  var UP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>';
  ZA.imageManager = function (el, images, opts) {
    opts = opts || {};
    var bucket = opts.bucket || 'products';
    var items = (images || []).map(function (im) { return { url: im.url || im.image_url, storage_path: im.storage_path || null, alt_text: im.alt_text || '', saved: true }; });
    var removed = [];     // storage paths of saved images to delete after a successful save
    var uploading = 0;
    var dragIndex = null;

    function render() {
      el.innerHTML = '<div class="img-grid">' + items.map(function (it, i) {
        return '<div class="img-tile" draggable="' + (it.pending ? 'false' : 'true') + '" data-i="' + i + '">' +
          '<img src="' + esc(it.preview || it.url) + '" alt="">' +
          (i === 0 ? '<span class="tag">MAIN</span>' : '') +
          (it.pending ? '<div class="progress"><span class="spinner"></span>&nbsp;Uploading</div>' :
            '<div class="tools">' +
            (i > 0 ? '<button type="button" data-img="left" title="Move left">◀</button>' : '<span></span>') +
            (i > 0 ? '<button type="button" data-img="main" title="Make main image">Main</button>' : '') +
            '<button type="button" data-img="replace" title="Replace">Replace</button>' +
            '<button type="button" class="del" data-img="del" title="Delete" aria-label="Delete image">✕</button>' +
            (i < items.length - 1 ? '<button type="button" data-img="right" title="Move right">▶</button>' : '') +
            '</div>') + '</div>';
      }).join('') +
      (opts.max && items.length >= opts.max ? '' : '<label class="img-drop" tabindex="0">' + UP_ICON + '<span>Add images</span><span class="small">or drop files here</span>' +
        '<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden></label>') + '</div>' +
      '<p class="hint small muted" style="margin:8px 0 0;">First image is the main image on listings. Drag to reorder. JPG, PNG, WebP or AVIF — resized to ' + (opts.maxSide || 2000) + 'px and compressed automatically.</p>';
      var input = el.querySelector('input[type=file]');
      if (input) input.addEventListener('change', function () { addFiles(Array.prototype.slice.call(input.files)); input.value = ''; });
    }
    function changed() { if (opts.onChange) opts.onChange(); }
    function addFiles(files, replaceIndex) {
      files.forEach(function (file, k) {
        var target = { pending: true, preview: URL.createObjectURL(file) };
        if (replaceIndex != null && k === 0) {
          var old = items[replaceIndex];
          items.splice(replaceIndex, 1, target);
          target.replacing = old;
        } else items.push(target);
        uploading++; render();
        ZA.images.upload(bucket, file, { maxSide: opts.maxSide || 2000 }).then(function (res) {
          target.url = res.url; target.storage_path = res.storage_path; target.pending = false;
          if (target.replacing) forget(target.replacing);
          URL.revokeObjectURL(target.preview); target.preview = null;
          changed();
        }).catch(function (err) {
          var idx = items.indexOf(target);
          if (idx !== -1) { if (target.replacing) items.splice(idx, 1, target.replacing); else items.splice(idx, 1); }
          ZA.fail(err);
        }).then(function () { uploading--; render(); });
      });
    }
    function forget(it) {
      if (!it || !it.storage_path) return;
      if (it.saved) removed.push(it.storage_path);         // delete after the record is saved
      else ZA.images.remove(bucket, [it.storage_path]);    // never saved: delete now
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-img]');
      if (!b) return;
      var i = Number(b.closest('.img-tile').getAttribute('data-i'));
      var act = b.getAttribute('data-img');
      if (act === 'left' && i > 0) { items.splice(i - 1, 0, items.splice(i, 1)[0]); }
      if (act === 'right' && i < items.length - 1) { items.splice(i + 1, 0, items.splice(i, 1)[0]); }
      if (act === 'main') { items.unshift(items.splice(i, 1)[0]); }
      if (act === 'del') { forget(items[i]); items.splice(i, 1); }
      if (act === 'replace') {
        var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/jpeg,image/png,image/webp,image/avif';
        inp.addEventListener('change', function () { if (inp.files[0]) addFiles([inp.files[0]], i); });
        inp.click(); return;
      }
      render(); changed();
    });
    el.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('img-drop')) { e.preventDefault(); e.target.querySelector('input').click(); } });
    // Drag to reorder tiles; drop files onto the grid to upload.
    el.addEventListener('dragstart', function (e) { var t = e.target.closest('.img-tile'); if (!t) return; dragIndex = Number(t.getAttribute('data-i')); t.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    el.addEventListener('dragend', function () { dragIndex = null; ZA.qsa('.img-tile', el).forEach(function (t) { t.classList.remove('dragging', 'drop-target'); }); });
    el.addEventListener('dragover', function (e) {
      e.preventDefault();
      var t = e.target.closest('.img-tile');
      ZA.qsa('.img-tile', el).forEach(function (x) { x.classList.toggle('drop-target', x === t && dragIndex !== null); });
      var d = el.querySelector('.img-drop'); if (d) d.classList.toggle('over', dragIndex === null);
    });
    el.addEventListener('drop', function (e) {
      e.preventDefault();
      var d = el.querySelector('.img-drop'); if (d) d.classList.remove('over');
      if (dragIndex === null) { if (e.dataTransfer.files.length) addFiles(Array.prototype.slice.call(e.dataTransfer.files)); return; }
      var t = e.target.closest('.img-tile');
      if (!t) return;
      var to = Number(t.getAttribute('data-i'));
      if (to !== dragIndex) { items.splice(to, 0, items.splice(dragIndex, 1)[0]); render(); changed(); }
    });
    render();
    return {
      get: function () { return items.filter(function (it) { return !it.pending && it.url; }).map(function (it) { return { url: it.url, storage_path: it.storage_path, alt_text: it.alt_text }; }); },
      busy: function () { return uploading > 0; },
      // Call after the record saved successfully.
      committed: function () { ZA.images.remove(bucket, removed); removed = []; items.forEach(function (it) { it.saved = true; }); },
      // Call when the user abandons the form: delete uploads that were never saved.
      discard: function () { ZA.images.remove(bucket, items.filter(function (it) { return !it.saved && it.storage_path; }).map(function (it) { return it.storage_path; })); }
    };
  };

  /* ---------- Single image (logo, favicon, banner, category image) ---------- */
  ZA.singleImage = function (el, url, opts) {
    opts = opts || {};
    var current = url || '', path = null, previousSaved = url || '', newPaths = [];
    function render() {
      el.innerHTML = '<div class="single-img"><div class="preview ' + (opts.square ? 'square' : '') + '" style="' + (current ? 'background-image:url(&quot;' + esc(current) + '&quot;)' : '') + '">' + (current ? '' : 'No image') + '</div>' +
        '<div class="stack" style="flex:1;min-width:200px;"><div class="row"><label class="btn btn-sm">' + (current ? 'Replace' : 'Upload') + ' image<input type="file" accept="' + (opts.allowIcon ? 'image/x-icon,image/vnd.microsoft.icon,' : '') + 'image/jpeg,image/png,image/webp,image/avif" hidden></label>' +
        (current ? '<button type="button" class="link danger" data-si-remove>Remove</button>' : '') + '</div>' +
        (opts.urlInput !== false ? '<input type="url" placeholder="…or paste an image URL (https://)" value="' + esc(current) + '" data-si-url>' : '') +
        (opts.hint ? '<span class="hint small muted">' + opts.hint + '</span>' : '') + '</div></div>';
      var f = el.querySelector('input[type=file]');
      f.addEventListener('change', function () {
        if (!f.files[0]) return;
        var prev = el.querySelector('.preview'); prev.innerHTML = '<span class="spinner"></span>';
        ZA.images.upload(opts.bucket || 'site', f.files[0], { maxSide: opts.maxSide || 2400, keepPng: opts.keepPng, allowIcon: opts.allowIcon }).then(function (res) {
          current = res.url; path = res.storage_path; newPaths.push(res.storage_path); render(); if (opts.onChange) opts.onChange();
        }).catch(function (err) { ZA.fail(err); render(); });
      });
      var u = el.querySelector('[data-si-url]');
      if (u) u.addEventListener('change', function () {
        var v = u.value.trim();
        if (v && !ZA.isHttpUrl(v)) { ZA.fail('Image URL must start with https://'); u.value = current; return; }
        current = v; render(); if (opts.onChange) opts.onChange();
      });
      var r = el.querySelector('[data-si-remove]');
      if (r) r.addEventListener('click', function () { current = ''; render(); if (opts.onChange) opts.onChange(); });
    }
    render();
    return {
      get: function () { return current; },
      path: function () { return path; },
      // after save: delete uploads that were replaced before saving
      committed: function () {
        var keep = path;
        ZA.images.remove(opts.bucket || 'site', newPaths.filter(function (p) { return p !== keep; }));
        newPaths = keep ? [keep] : []; previousSaved = current;
      }
    };
  };

  /* ---------- Sortable list (drag + keyboard-friendly up/down buttons) ---------- */
  ZA.sortable = function (listEl, onChange) {
    var drag = null;
    listEl.classList.add('sort-list');
    function own(node) { var li = node && node.closest('li[data-id]'); while (li && li.parentElement !== listEl) li = li.parentElement.closest('li[data-id]'); return li; }
    listEl.addEventListener('dragstart', function (e) {
      // Only handle drags of this list's own items (nested lists handle theirs).
      var li = e.target.closest('li[data-id]');
      if (!li || li.parentElement !== listEl) return;
      e.stopPropagation();
      drag = li; drag.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move';
    });
    listEl.addEventListener('dragend', function () { if (drag) drag.classList.remove('dragging'); drag = null; });
    listEl.addEventListener('dragover', function (e) {
      if (!drag) return;
      e.preventDefault();
      var over = own(e.target);
      if (!over || over === drag) return;
      var r = over.getBoundingClientRect();
      listEl.insertBefore(drag, e.clientY > r.top + r.height / 2 ? over.nextSibling : over);
    });
    listEl.addEventListener('drop', function (e) { if (drag) { e.preventDefault(); e.stopPropagation(); onChange(order()); } });
    listEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-move]');
      if (!b) return;
      var li = b.closest('li[data-id]');
      if (!li || li.parentElement !== listEl) return;
      e.stopPropagation();
      if (b.getAttribute('data-move') === 'up' && li.previousElementSibling) listEl.insertBefore(li, li.previousElementSibling);
      else if (b.getAttribute('data-move') === 'down' && li.nextElementSibling) listEl.insertBefore(li.nextElementSibling, li);
      else return;
      onChange(order()); b.focus();
    });
    function order() { return Array.prototype.filter.call(listEl.children, function (li) { return li.matches('li[data-id]'); }).map(function (li) { return li.getAttribute('data-id'); }); }
  };
  ZA.moveButtons = '<button type="button" class="btn btn-sm" data-move="up" aria-label="Move up">↑</button><button type="button" class="btn btn-sm" data-move="down" aria-label="Move down">↓</button>';

  /* ---------- Product picker ---------- */
  ZA.pickProducts = function (opts) {
    opts = opts || {};
    var picked = {};
    return new Promise(function (resolve) {
      var resolved = false;
      ZA.modal({
        title: opts.title || 'Choose products', wide: true,
        body: '<div class="search" style="position:relative;margin-bottom:12px;"><input type="search" id="ppSearch" placeholder="Search by name or SKU"></div><div id="ppList" style="max-height:52vh;overflow:auto;"></div>',
        foot: '<span class="muted small" id="ppCount" style="margin-right:auto;">0 selected</span><button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="ppDone">Add selected</button>',
        onClose: function () { if (!resolved) resolve([]); },
        onOpen: function (el, api) {
          var list = el.querySelector('#ppList');
          function load() {
            var term = ZA.searchTerm(el.querySelector('#ppSearch').value);
            var q = ZA.db.from('admin_products_view').select('id,name,sku,status,price,main_image').order('name').limit(40);
            if (term) q = q.or('name.ilike.*' + term + '*,sku.ilike.*' + term + '*');
            if (opts.activeOnly) q = q.eq('status', 'active');
            list.innerHTML = '<p class="muted"><span class="spinner"></span> Loading…</p>';
            ZA.q(q).then(function (rows) {
              var exclude = opts.exclude || [];
              rows = rows.filter(function (r) { return exclude.indexOf(r.id) === -1; });
              list.innerHTML = rows.length ? '<ul class="list">' + rows.map(function (r) {
                return '<li><label class="check-row" style="flex:1;"><input type="checkbox" value="' + r.id + '"' + (picked[r.id] ? ' checked' : '') + '>' +
                  (r.main_image ? '<img src="' + esc(r.main_image) + '" alt="" style="width:32px;height:42px;object-fit:cover;">' : '') +
                  '<span><span class="cell-title">' + esc(r.name) + '</span><br><span class="cell-sub">' + esc(r.sku) + ' · ' + (r.price > 0 ? ZA.money(r.price) : 'No price') + '</span></span></label>' + ZA.pill(r.status) + '</li>';
              }).join('') + '</ul>' : '<div class="empty">No matching products.</div>';
              list._rows = rows;
            }).catch(function (e) { list.innerHTML = '<div class="notice danger">' + esc(e.message) + '</div>'; });
          }
          el.querySelector('#ppSearch').addEventListener('input', ZA.debounce(load, 300));
          list.addEventListener('change', function (e) {
            if (!e.target.matches('input[type=checkbox]')) return;
            var r = (list._rows || []).find(function (x) { return x.id === e.target.value; });
            if (e.target.checked) picked[r.id] = r; else delete picked[r.id];
            el.querySelector('#ppCount').textContent = Object.keys(picked).length + ' selected';
          });
          el.querySelector('#ppDone').addEventListener('click', function () { resolved = true; resolve(Object.keys(picked).map(function (k) { return picked[k]; })); api.close(); });
          load();
        }
      });
    });
  };

  /* ---------- Simple safe text → HTML (used for content previews; same rules as the storefront) ---------- */
  // Supports: blank-line paragraphs, "## " headings, "- " bullet lists, **bold**,
  // and [text](https://link). Everything else is escaped.
  ZA.renderRichText = function (src) {
    function inline(s) {
      return esc(s)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|#\/[^\s)]*|mailto:[^\s)]+)\)/g, function (m, t, u) { return '<a href="' + u + '"' + (/^https?:/.test(u) ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + t + '</a>'; });
    }
    return String(src || '').split(/\n{2,}/).map(function (block) {
      block = block.trim();
      if (!block) return '';
      if (/^##\s+/.test(block)) return '<h3>' + inline(block.replace(/^##\s+/, '')) + '</h3>';
      var lines = block.split('\n');
      if (lines.every(function (l) { return /^\s*[-•]\s+/.test(l); })) return '<ul>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^\s*[-•]\s+/, '')) + '</li>'; }).join('') + '</ul>';
      return '<p>' + lines.map(inline).join('<br>') + '</p>';
    }).join('');
  };
})();
