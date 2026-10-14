/* =========================================================
   Zari Admin — admin users & roles (Super Admin only).
   Creating logins, disabling and resetting access run in the `admin-api`
   Edge Function (needs the service-role key). Role definitions are plain
   table writes, allowed only for Super Admins by RLS.
   ========================================================= */
(function () {
  var esc = ZA.esc;
  var MODULES = [
    ['dashboard', 'Dashboard', 'Sales and stock overview'],
    ['products', 'Products', 'Add, edit, price, stock, images'],
    ['categories', 'Categories', 'Categories, fabrics, occasions'],
    ['homepage', 'Homepage', 'Section order, text, product rails'],
    ['marketing', 'Marketing', 'Banners, announcement, campaigns, coupons'],
    ['orders', 'Orders', 'Status, shipping, refunds, invoices'],
    ['customers', 'Customers', 'Profiles, addresses, suspend accounts'],
    ['reviews', 'Reviews', 'Approve / reject reviews'],
    ['content', 'Content', 'Pages, FAQ, footer'],
    ['settings', 'Website settings', 'Store details, shipping, tax, payments'],
    ['activity', 'Activity log', 'See every admin change']
  ];
  var roles = [], admins = [];

  function tabs(a) { return '<div class="tabs"><a href="#/admins" class="' + (a === 'users' ? 'active' : '') + '">Admin users</a><a href="#/admins/roles" class="' + (a === 'roles' ? 'active' : '') + '">Roles &amp; permissions</a></div>'; }
  function loadRoles() { return ZA.q(ZA.db.from('admin_roles').select('*').order('is_system', { ascending: false }).order('name')).then(function (r) { roles = r; }); }

  function renderUsers(el) {
    ZA.setPage('Admin users', [['Administration']], '<button class="btn btn-primary btn-sm" data-action="admin-new">+ Add admin</button>');
    Promise.all([loadRoles(), ZA.rpc('admin_list_admins').then(function (a) { admins = a; })]).then(function () {
      el.innerHTML = tabs('users') + '<div class="card"><div class="table-wrap"><table class="data responsive"><thead><tr><th>Admin</th><th>Role</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead><tbody>' +
        admins.map(function (a) {
          var self = a.id === ZA.me.id;
          return '<tr><td data-label="Admin"><span class="cell-title">' + esc(a.full_name || a.email) + '</span>' + (self ? ' <span class="pill">You</span>' : '') + '<div class="cell-sub">' + esc(a.email) + '</div></td>' +
            '<td data-label="Role">' + (self ? esc(a.role_name) : '<select data-change="admin-role" data-id="' + a.id + '" aria-label="Role">' + roles.map(function (r) { return '<option value="' + r.id + '"' + (r.id === a.role_id ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('') + '</select>') + '</td>' +
            '<td data-label="Status">' + (a.is_active ? ZA.pill('active') : ZA.pill('disabled')) + '</td>' +
            '<td data-label="Last sign-in">' + (a.last_sign_in_at ? ZA.ago(a.last_sign_in_at) : '<span class="muted">Never</span>') + '</td>' +
            '<td class="actions">' + (self ? '<a class="link" href="#/account">My account</a>' :
              '<button class="link" data-action="admin-reset" data-id="' + a.id + '" data-email="' + esc(a.email) + '">Reset access</button>' +
              '<button class="link ' + (a.is_active ? 'danger' : '') + '" data-action="admin-active" data-id="' + a.id + '" data-on="' + a.is_active + '">' + (a.is_active ? 'Disable' : 'Enable') + '</button>' +
              '<button class="link danger" data-action="admin-remove" data-id="' + a.id + '" data-email="' + esc(a.email) + '">Remove</button>') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' +
        '<p class="small muted">Disabling an admin blocks access immediately — their current session stops working and they can’t sign back in. Everything they did stays in the activity log.</p>';
    }).catch(function (e) { el.innerHTML = tabs('users') + '<div class="notice danger">' + esc(e.message) + '</div>'; });
  }

  function call(body, okMsg) {
    return ZA.fn('admin-api', body).then(function () { ZA.ok(okMsg); renderUsers(ZA.qs('#content')); })
      .catch(function (e) {
        ZA.fail(/Failed to send|FunctionsFetchError|not found/i.test(e.message) ? 'The admin-api Edge Function isn’t deployed yet (see ADMIN_SETUP.md).' : e.message);
        renderUsers(ZA.qs('#content'));
      });
  }
  ZA.actions['admin-role'] = function (sel) { call({ action: 'set_role', admin_id: sel.getAttribute('data-id'), role_id: sel.value }, 'Role updated'); };
  ZA.actions['admin-active'] = function (b) {
    var on = b.getAttribute('data-on') !== 'true';
    ZA.confirm(on ? 'Re-enable this admin’s access?' : 'Disable this admin? They are signed out and blocked straight away.', { danger: !on, confirmLabel: on ? 'Enable' : 'Disable' }).then(function (ok) {
      if (ok) call({ action: 'set_active', admin_id: b.getAttribute('data-id'), active: on }, on ? 'Admin enabled' : 'Admin disabled');
    });
  };
  ZA.actions['admin-reset'] = function (b) {
    ZA.confirm('Send a password-reset email to ' + b.getAttribute('data-email') + '? The link lets them choose a new password.', { confirmLabel: 'Send email' }).then(function (ok) {
      if (ok) call({ action: 'reset_access', admin_id: b.getAttribute('data-id') }, 'Reset email sent');
    });
  };
  ZA.actions['admin-remove'] = function (b) {
    ZA.confirm('Remove admin access for ' + b.getAttribute('data-email') + '? Their login is blocked. Their past actions stay in the activity log.', { title: 'Remove admin', danger: true, confirmLabel: 'Remove' }).then(function (ok) {
      if (ok) call({ action: 'remove', admin_id: b.getAttribute('data-id') }, 'Admin removed');
    });
  };
  ZA.actions['admin-new'] = function () {
    ZA.modal({
      title: 'Add an admin',
      body: '<form id="anForm" class="stack" novalidate>' + ZA.f.text('email', 'Email', '', { type: 'email', required: true, hint: 'Use an email that is not already a customer account on the store.' }) +
        ZA.f.text('full_name', 'Name', '', { max: 120 }) +
        ZA.f.select('role_id', 'Role', (roles.find(function (r) { return r.key === 'store_manager'; }) || {}).id, roles.map(function (r) { return [r.id, r.name]; })) +
        '<div class="field"><span class="label">How should they sign in?</span><label class="check-row"><input type="radio" name="method" value="invite" checked> Email them an invitation to set their own password (recommended)</label>' +
        '<label class="check-row"><input type="radio" name="method" value="password"> Set a temporary password now</label></div>' +
        '<div id="anPw" class="hidden">' + ZA.f.text('password', 'Temporary password', '', { type: 'password', autocomplete: 'new-password', hint: 'At least 12 characters with letters and numbers. Share it securely and ask them to change it.' }) + '</div></form>',
      foot: '<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="anGo" data-busy="Creating…">Add admin</button>',
      onOpen: function (m, api) {
        var form = m.querySelector('#anForm');
        form.addEventListener('change', function () { m.querySelector('#anPw').classList.toggle('hidden', ZA.readForm(form).method !== 'password'); });
        m.querySelector('#anGo').addEventListener('click', function () {
          var v = ZA.readForm(form), btn = this;
          if (!/^\S+@\S+\.\S+$/.test(v.email)) { ZA.fail('Enter a valid email.'); return; }
          if (v.method === 'password') { var p = ZA.auth.passwordProblem(v.password); if (p) { ZA.fail(p); return; } }
          ZA.busy(btn, true);
          ZA.fn('admin-api', { action: 'create', email: v.email, full_name: v.full_name, role_id: v.role_id, password: v.method === 'password' ? v.password : '' }).then(function (r) {
            api.close(); ZA.ok(r.invited ? 'Invitation sent to ' + v.email : 'Admin created'); renderUsers(ZA.qs('#content'));
          }).catch(function (e) { ZA.busy(btn, false); ZA.fail(/Failed to send|FunctionsFetchError/i.test(e.message) ? 'The admin-api Edge Function isn’t deployed yet (see ADMIN_SETUP.md).' : e.message); });
        });
      }
    });
  };

  /* ---------- Roles ---------- */
  function renderRoles(el) {
    ZA.setPage('Admin users', [['Administration']], '<button class="btn btn-primary btn-sm" data-action="role-edit">+ New role</button>');
    Promise.all([loadRoles(), ZA.rpc('admin_list_admins').then(function (a) { admins = a; })]).then(function () {
      el.innerHTML = tabs('roles') + '<div class="card"><div class="table-wrap"><table class="data responsive"><thead><tr><th>Role</th><th>Access</th><th>Admins</th><th></th></tr></thead><tbody>' +
        roles.map(function (r) {
          var n = admins.filter(function (a) { return a.role_id === r.id; }).length;
          var perms = r.permissions.indexOf('*') !== -1 ? '<strong>Everything</strong>, including admin users' : MODULES.filter(function (mo) { return r.permissions.indexOf(mo[0]) !== -1; }).map(function (mo) { return mo[1]; }).join(', ') || '<span class="muted">No access</span>';
          return '<tr><td data-label="Role"><span class="cell-title">' + esc(r.name) + '</span>' + (r.is_system ? ' <span class="pill">Built-in</span>' : '') + (r.description ? '<div class="cell-sub">' + esc(r.description) + '</div>' : '') + '</td>' +
            '<td data-label="Access" class="small">' + perms + '</td><td data-label="Admins">' + n + '</td>' +
            '<td class="actions">' + (r.key === 'super_admin' ? '' : '<button class="link" data-action="role-edit" data-id="' + r.id + '">Edit</button>' + (r.is_system ? '' : '<button class="link danger" data-action="role-delete" data-id="' + r.id + '">Delete</button>')) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' +
        '<p class="small muted">Only Super Admins can manage admin users and roles. Every permission is enforced by the database, not just hidden in the menu.</p>';
    }).catch(function (e) { el.innerHTML = tabs('roles') + '<div class="notice danger">' + esc(e.message) + '</div>'; });
  }
  ZA.actions['role-edit'] = function (b) {
    var id = b.getAttribute('data-id'), r = id ? roles.find(function (x) { return x.id === id; }) : { permissions: ['dashboard'] };
    ZA.modal({
      title: id ? 'Edit role' : 'New role', wide: true,
      body: '<form id="roleForm" class="stack">' + '<div class="grid-2">' + ZA.f.text('name', 'Role name', r.name, { required: true, max: 80 }) + ZA.f.text('description', 'Description', r.description, { max: 200 }) + '</div>' +
        '<div class="field"><span class="label">Can access</span><div class="check-grid">' + MODULES.map(function (mo) {
          return '<label class="check-row" style="align-items:flex-start;"><input type="checkbox" name="permissions" value="' + mo[0] + '"' + (r.permissions.indexOf(mo[0]) !== -1 ? ' checked' : '') + '><span>' + esc(mo[1]) + '<br><span class="cell-sub">' + esc(mo[2]) + '</span></span></label>';
        }).join('') + '</div></div></form>',
      foot: '<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="roleSave" data-busy="Saving…">Save role</button>',
      onOpen: function (m, api) {
        m.querySelector('#roleSave').addEventListener('click', function () {
          var v = ZA.readForm(m.querySelector('#roleForm')), btn = this;
          if (!v.name) { ZA.fail('Role name is required.'); return; }
          var row = { name: v.name, description: v.description || null, permissions: v.permissions };
          if (!id) row.key = (ZA.slugify(v.name).replace(/-/g, '_').replace(/^[^a-z]+/, '') || 'role') .slice(0, 30) + '_' + Math.random().toString(36).slice(2, 6);
          ZA.busy(btn, true);
          (id ? ZA.db.from('admin_roles').update(row).eq('id', id).select('id') : ZA.db.from('admin_roles').insert(row).select('id')).then(function (res) {
            if (!ZA.unwrap(res).length) throw new Error('You don’t have permission to do that.');
            api.close(); ZA.ok('Role saved'); renderRoles(ZA.qs('#content'));
          }).catch(function (e) { ZA.busy(btn, false); ZA.fail(e); });
        });
      }
    });
  };
  ZA.actions['role-delete'] = function (b) {
    ZA.confirm('Delete this role? It must not be assigned to anyone.', { danger: true, confirmLabel: 'Delete' }).then(function (ok) {
      if (!ok) return;
      ZA.q(ZA.db.from('admin_roles').delete().eq('id', b.getAttribute('data-id')).select('id')).then(function (r) {
        if (!r.length) throw new Error('You don’t have permission to do that.');
        ZA.ok('Role deleted'); renderRoles(ZA.qs('#content'));
      }).catch(ZA.fail);
    });
  };

  ZA.routes.admins = {
    perm: 'admins',
    render: function (params, el) { if (params[0] === 'roles') renderRoles(el); else renderUsers(el); }
  };
})();
