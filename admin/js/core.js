/* =========================================================
   Zari Admin — core helpers shared by every module.
   No inline event handlers anywhere (the page CSP forbids them): elements
   declare data-action="name" and ZA.actions[name](el, event) runs on click.
   All authorisation is enforced by the database (RLS + RPC checks); the
   permission checks here only decide what to show.
   ========================================================= */
var ZA = window.ZA = {
  db: window.supabaseClient,
  me: null,            // { id, email, full_name, role_key, role_name, permissions[], is_super_admin }
  actions: {},
  routes: {},
  cleanup: null        // set by a view to run when navigating away
};

/* ---------- Formatting ---------- */
ZA.esc = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"'`]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c];
  });
};
ZA.money = function (n) {
  var v = Number(n || 0);
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
};
ZA.num = function (n) { return Number(n || 0).toLocaleString('en-IN'); };
ZA.date = function (iso) { return iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; };
ZA.dateTime = function (iso) { return iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; };
ZA.ago = function (iso) {
  if (!iso) return '—';
  var s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 86400 * 30) return Math.floor(s / 86400) + ' d ago';
  return ZA.date(iso);
};
ZA.label = function (s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); };
ZA.slugify = function (s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); };
ZA.initials = function (s) { return String(s || '?').trim().split(/[\s@.]+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('') || '?'; };
ZA.maskPhone = function (p) { p = String(p || ''); return p.length > 4 ? '•••• ' + p.slice(-4) : p; };
ZA.isHttpUrl = function (u) { return /^https?:\/\/[^\s]+$/i.test(String(u || '').trim()); };
ZA.safeUrl = function (u) { return ZA.isHttpUrl(u) ? String(u).trim() : ''; };
// Values used inside PostgREST or()/ilike filters: strip characters that have
// syntax meaning there so a search box can't change the query's structure.
ZA.searchTerm = function (s) { return String(s || '').replace(/[,()*%\\:"']/g, ' ').trim().slice(0, 80); };

ZA.qs = function (sel, root) { return (root || document).querySelector(sel); };
ZA.qsa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
ZA.debounce = function (fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms || 300); }; };
ZA.can = function (perm) { return !!(ZA.me && ZA.me.permissions.indexOf(perm) !== -1); };

/* ---------- Errors / API ---------- */
ZA.errorMessage = function (err) {
  if (!err) return 'Something went wrong.';
  var code = err.code || '';
  var msg = err.message || String(err);
  if (code === '42501' || /row-level security|permission denied|not authorised/i.test(msg)) return 'You don’t have permission to do that.';
  if (code === '23505') {
    if (/sku/i.test(msg)) return 'Another product already uses this SKU.';
    if (/slug/i.test(msg)) return 'That URL slug is already in use.';
    if (/code/i.test(msg)) return 'That code already exists.';
    return 'That value already exists.';
  }
  if (code === '23503') return 'This item is still in use elsewhere and can’t be removed.';
  if (code === '23514') return 'One of the values isn’t allowed. Please check the form.';
  if (code === 'PGRST301' || /JWT expired|invalid jwt/i.test(msg)) { ZA.sessionExpired && ZA.sessionExpired(); return 'Your session expired. Please sign in again.'; }
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Network error — check your connection and try again.';
  return msg.replace(/^ERROR:\s*/, '');
};
// Resolve a supabase-js result or throw an Error with a friendly message.
ZA.unwrap = function (res) {
  if (res && res.error) { var e = new Error(ZA.errorMessage(res.error)); e.raw = res.error; throw e; }
  return res ? res.data : null;
};
ZA.q = function (promise) { return Promise.resolve(promise).then(ZA.unwrap); };
ZA.rpc = function (fn, args) { return ZA.q(ZA.db.rpc(fn, args || {})); };
ZA.fn = function (name, body) {
  return ZA.db.functions.invoke(name, { body: body }).then(function (res) {
    if (res.error) {
      // supabase-js wraps non-2xx bodies; surface the server's message when present.
      var ctx = res.error.context;
      if (ctx && typeof ctx.json === 'function') {
        return ctx.json().then(function (b) { throw new Error((b && b.error) || res.error.message); }, function () { throw new Error(res.error.message); });
      }
      throw new Error(res.error.message || 'Request failed');
    }
    return res.data;
  });
};
ZA.logEvent = function (action, detail) { return ZA.db.rpc('admin_log_event', { p_action: action, p_detail: detail || {} }).then(function () {}, function () {}); };

/* ---------- Events (CSP-safe delegation) ---------- */
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  var fn = ZA.actions[el.getAttribute('data-action')];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('change', function (e) {
  var el = e.target.closest('[data-change]');
  if (!el) return;
  var fn = ZA.actions[el.getAttribute('data-change')];
  if (fn) fn(el, e);
});

/* ---------- Busy buttons ---------- */
ZA.busy = function (btn, on) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> ' + (btn.dataset.busy || 'Saving…'); }
  else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
};

/* ---------- Toasts ---------- */
ZA.toast = function (msg, type) {
  var el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = msg;
  ZA.qs('#toasts').appendChild(el);
  setTimeout(function () { el.remove(); }, type === 'error' ? 6000 : 3000);
};
ZA.ok = function (msg) { ZA.toast(msg, 'ok'); };
ZA.fail = function (err) { ZA.toast(typeof err === 'string' ? err : (err && err.message) || ZA.errorMessage(err), 'error'); };

/* ---------- CSV ---------- */
ZA.csv = {
  parse: function (text) {
    var rows = [], row = [], cell = '', q = false, i, c;
    text = String(text || '').replace(/^﻿/, '');
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else cell += c;
    }
    row.push(cell);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    if (!rows.length) return [];
    var head = rows.shift().map(function (h) { return h.trim().toLowerCase().replace(/\s+/g, '_'); });
    return rows.map(function (r) { var o = {}; head.forEach(function (h, idx) { o[h] = (r[idx] || '').trim(); }); return o; });
  },
  // Cells starting with = + - @ are prefixed so spreadsheet apps don't run them as formulas.
  cell: function (v) {
    var s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  },
  stringify: function (rows, columns) {
    var lines = [columns.map(function (c) { return ZA.csv.cell(c.label); }).join(',')];
    rows.forEach(function (r) { lines.push(columns.map(function (c) { return ZA.csv.cell(typeof c.value === 'function' ? c.value(r) : r[c.key]); }).join(',')); });
    return lines.join('\r\n');
  },
  download: function (filename, text) {
    var blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
};

/* ---------- Images: validate, optimise in the browser, upload ---------- */
ZA.images = {
  ACCEPT: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  MAX_BYTES: 15 * 1024 * 1024,
  // Resize to fit maxSide and re-encode (WebP where supported, else JPEG).
  // Keeps quality high (0.86) — enough to remove camera bloat without visible loss.
  optimise: function (file, opts) {
    opts = opts || {};
    var maxSide = opts.maxSide || 2000;
    var keepPng = opts.keepPng && file.type === 'image/png';
    return new Promise(function (resolve, reject) {
      if (ZA.images.ACCEPT.indexOf(file.type) === -1 && !(opts.allowIcon && /icon/.test(file.type))) {
        reject(new Error(file.name + ': use a JPG, PNG, WebP or AVIF image.')); return;
      }
      if (file.size > ZA.images.MAX_BYTES) { reject(new Error(file.name + ' is larger than 15 MB.')); return; }
      if (opts.allowIcon && /icon/.test(file.type)) { resolve({ blob: file, ext: 'ico', type: file.type }); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        if (!keepPng) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        var type = keepPng ? 'image/png' : 'image/webp';
        var original = { blob: file, ext: file.type.split('/')[1].replace('jpeg', 'jpg'), type: file.type, width: w, height: h };
        // Use the re-encoded image only if it was resized or actually came out smaller.
        function pick(blob, ext, mime) {
          if (blob && (scale < 1 || blob.size < file.size)) resolve({ blob: blob, ext: ext, type: mime, width: w, height: h });
          else resolve(original);
        }
        canvas.toBlob(function (blob) {
          if (blob && blob.type === type) { pick(blob, keepPng ? 'png' : 'webp', type); return; }
          // Browser can't encode WebP (older Safari): fall back to JPEG.
          canvas.toBlob(function (jpg) {
            if (!jpg) { reject(new Error('Could not process ' + file.name)); return; }
            pick(jpg, 'jpg', 'image/jpeg');
          }, 'image/jpeg', 0.86);
        }, type, 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error(file.name + ' is not a readable image.')); };
      img.src = url;
    });
  },
  upload: function (bucket, file, opts) {
    return ZA.images.optimise(file, opts).then(function (o) {
      var d = new Date();
      var rand = (crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2))).replace(/-/g, '').slice(0, 20);
      var path = d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + rand + '.' + o.ext;
      return ZA.db.storage.from(bucket).upload(path, o.blob, { cacheControl: '31536000', upsert: false, contentType: o.type }).then(function (res) {
        if (res.error) {
          var m = res.error.message || '';
          if (/bucket not found/i.test(m)) throw new Error('Storage bucket "' + bucket + '" is missing — run the latest database migration.');
          throw new Error(ZA.errorMessage(res.error));
        }
        return { url: ZA.db.storage.from(bucket).getPublicUrl(path).data.publicUrl, storage_path: path, bucket: bucket };
      });
    });
  },
  remove: function (bucket, paths) {
    paths = (paths || []).filter(Boolean);
    if (!paths.length) return Promise.resolve();
    return ZA.db.storage.from(bucket).remove(paths).then(function () {}, function () {});
  }
};

/* ---------- Unsaved-changes guard ---------- */
ZA.dirty = {
  on: false,
  set: function (v) { ZA.dirty.on = !!v; var d = ZA.qs('[data-dirty-indicator]'); if (d) d.classList.toggle('hidden', !v); },
  confirmLeave: function () { return !ZA.dirty.on || window.confirm('You have unsaved changes. Leave without saving?'); }
};
window.addEventListener('beforeunload', function (e) { if (ZA.dirty.on) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- Status pills ---------- */
ZA.STATUS_TONE = {
  active: 'ok', paid: 'ok', delivered: 'ok', approved: 'ok', refunded: 'info', published: 'ok', in: 'ok', visible: 'ok',
  pending: 'warn', processing: 'info', confirmed: 'info', shipped: 'info', out_for_delivery: 'info', in_transit: 'info', packed: 'info',
  requested: 'warn', low: 'warn', draft: '', archived: '', not_shipped: '', none: '', unpriced: '', hidden: '',
  cancelled: 'danger', failed: 'danger', rejected: 'danger', returned: 'danger', suspended: 'danger', out: 'danger',
  disabled: 'danger', expired: 'danger', returned_to_origin: 'danger', partially_refunded: 'info', scheduled: 'info', live: 'ok'
};
ZA.pill = function (status, text) {
  return '<span class="pill ' + (ZA.STATUS_TONE[status] || '') + '">' + ZA.esc(text || ZA.label(status)) + '</span>';
};
