/* =========================================================
   Zari Admin — my account: name, password change (re-verifies the current
   password first), and signing out of every device.
   ========================================================= */
(function () {
  var esc = ZA.esc;
  ZA.routes.account = {
    perm: null,
    render: function (params, el) {
      var me = ZA.me;
      ZA.setPage('My account', []);
      el.innerHTML = '<div class="cols"><div>' +
        '<div class="card"><div class="card-head"><h3>Profile</h3></div><div class="card-body"><form id="profForm" class="stack">' +
        ZA.f.text('full_name', 'Your name', me.full_name, { max: 120 }) +
        '<div class="field"><span class="label">Email</span><input type="email" value="' + esc(me.email) + '" disabled></div>' +
        '<div class="form-actions"><button class="btn btn-primary" type="submit" data-busy="Saving…">Save</button></div></form></div></div>' +
        '<div class="card"><div class="card-head"><h3>Change password</h3></div><div class="card-body"><form id="pwForm" class="stack" autocomplete="off">' +
        ZA.f.text('current', 'Current password', '', { type: 'password', autocomplete: 'current-password', required: true }) +
        '<div class="grid-2">' + ZA.f.text('next', 'New password', '', { type: 'password', autocomplete: 'new-password', required: true, hint: 'At least 12 characters, letters and numbers.' }) +
        ZA.f.text('next2', 'Repeat new password', '', { type: 'password', autocomplete: 'new-password', required: true }) + '</div>' +
        '<div class="form-actions"><button class="btn btn-primary" type="submit" data-busy="Updating…">Change password</button></div></form></div></div>' +
        '</div><div>' +
        '<div class="card"><div class="card-head"><h3>Access</h3></div><div class="card-body"><dl class="kv" style="grid-template-columns:110px 1fr;"><dt>Role</dt><dd>' + esc(me.role_name) + '</dd>' +
        '<dt>Can manage</dt><dd>' + me.permissions.map(function (p) { return '<span class="pill" style="margin:0 4px 4px 0;">' + esc(ZA.label(p)) + '</span>'; }).join('') + '</dd>' +
        '<dt>Last sign-in</dt><dd>' + (me.last_sign_in_at ? ZA.dateTime(me.last_sign_in_at) : '—') + '</dd></dl></div></div>' +
        '<div class="card"><div class="card-head"><h3>Sessions</h3></div><div class="card-body stack"><p class="small muted" style="margin:0;">You’re signed out automatically after 30 minutes without activity. If you used a shared computer or think someone else has your password, sign out everywhere and change it.</p>' +
        '<button class="btn btn-danger" data-action="sign-out-all">Sign out of all devices</button></div></div>' +
        '</div></div>';
      var pf = ZA.qs('#profForm');
      pf.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = ZA.readForm(pf), btn = pf.querySelector('[type=submit]');
        ZA.busy(btn, true);
        ZA.rpc('update_my_admin_profile', { p_full_name: v.full_name }).then(function () {
          ZA.me.full_name = v.full_name || null; ZA.app.renderShell(); ZA.ok('Saved');
        }).catch(ZA.fail).then(function () { ZA.busy(btn, false); });
      });
      var pw = ZA.qs('#pwForm');
      pw.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = ZA.readForm(pw), btn = pw.querySelector('[type=submit]');
        var problem = ZA.auth.passwordProblem(v.next) || (v.next !== v.next2 ? 'New passwords don’t match.' : '') || (v.next === v.current ? 'Choose a password you haven’t used here.' : '');
        if (problem) { ZA.fail(problem); return; }
        ZA.busy(btn, true);
        // Re-verify the current password so an unattended open session can't change it.
        ZA.db.auth.signInWithPassword({ email: me.email, password: v.current }).then(function (res) {
          if (res.error) throw new Error('Current password is incorrect.');
          return ZA.db.auth.updateUser({ password: v.next });
        }).then(function (res) {
          if (res.error) throw new Error(res.error.message);
          ZA.logEvent('password_changed');
          pw.reset(); ZA.ok('Password changed');
        }).catch(ZA.fail).then(function () { ZA.busy(btn, false); });
      });
    }
  };
  ZA.actions['sign-out-all'] = function () {
    ZA.confirm('Sign out of the admin panel and the store on every device, including this one?', { confirmLabel: 'Sign out everywhere', danger: true }).then(function (ok) {
      if (!ok) return;
      ZA.logEvent('sessions_revoked').then(function () { return ZA.db.auth.signOut({ scope: 'global' }); }).then(function () {
        ZA.me = null; ZA.auth.showLogin('Signed out on all devices.', 'ok');
      });
    });
  };
})();
