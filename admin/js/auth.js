/* =========================================================
   Zari Admin — sign in, password reset, session lifetime.
   Uses Supabase Auth. Having a login is not enough: after every sign-in the
   account must also be an *active* row in `admins` (checked server-side by
   admin_me()), otherwise it is signed straight back out. Customer accounts
   therefore can never reach the dashboard, and admin data is protected by RLS
   regardless of what this page shows.
   ========================================================= */
(function () {
  var esc = ZA.esc;
  var IDLE_MINUTES = 30;
  var LOCK_KEY = 'za_login_lock';

  ZA.auth = {};

  function box(html) { ZA.qs('#authBox').innerHTML = html; }
  function showAuth() { ZA.qs('#app').classList.add('hidden'); ZA.qs('#authScreen').classList.remove('hidden'); }

  /* ---------- Client-side throttle (Supabase Auth also rate-limits server-side) ---------- */
  function lockState() { try { return JSON.parse(localStorage.getItem(LOCK_KEY) || '{"fails":0,"until":0}'); } catch (e) { return { fails: 0, until: 0 }; } }
  function setLock(s) { try { localStorage.setItem(LOCK_KEY, JSON.stringify(s)); } catch (e) {} }
  function recordFail() {
    var s = lockState(); s.fails += 1;
    if (s.fails >= 5) { s.until = Date.now() + Math.min(15, Math.pow(2, s.fails - 5)) * 60 * 1000; }
    setLock(s);
  }

  ZA.auth.showLogin = function (message, tone) {
    showAuth();
    box('<p class="eyebrow">Zari Admin</p><h1>Sign in</h1><p class="lede">Use your admin account. Customer accounts can’t sign in here.</p>' +
      (message ? '<div class="notice ' + (tone || 'danger') + '" style="margin-bottom:16px;">' + esc(message) + '</div>' : '') +
      '<form id="loginForm" class="stack" novalidate>' +
      ZA.f.text('email', 'Email', '', { type: 'email', required: true, autocomplete: 'username' }) +
      ZA.f.text('password', 'Password', '', { type: 'password', required: true, autocomplete: 'current-password' }) +
      '<div class="error small" id="loginErr" role="alert"></div>' +
      '<button class="btn btn-primary btn-block" type="submit" data-busy="Signing in…">Sign in</button></form>' +
      '<p class="alt"><button class="link" data-action="auth-forgot">Forgot password?</button></p>');
    var form = ZA.qs('#loginForm');
    ZA.qs('#f_email').focus();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = ZA.readForm(form), err = ZA.qs('#loginErr'), btn = form.querySelector('button[type=submit]');
      var lock = lockState();
      if (lock.until > Date.now()) { err.textContent = 'Too many attempts. Try again in ' + Math.ceil((lock.until - Date.now()) / 60000) + ' min.'; return; }
      if (!v.email || !v.password) { err.textContent = 'Enter your email and password.'; return; }
      err.textContent = '';
      ZA.busy(btn, true);
      ZA.db.auth.signInWithPassword({ email: v.email, password: v.password }).then(function (res) {
        if (res.error) {
          recordFail();
          ZA.busy(btn, false);
          err.textContent = /invalid login/i.test(res.error.message) ? 'Incorrect email or password.' :
            /rate limit|too many/i.test(res.error.message) ? 'Too many attempts. Please wait and try again.' : res.error.message;
          return;
        }
        return ZA.auth.loadAdmin().then(function (me) {
          if (!me) {
            recordFail();
            return ZA.db.auth.signOut({ scope: 'local' }).then(function () {
              ZA.busy(btn, false);
              err.textContent = 'This account does not have admin access.';
            });
          }
          setLock({ fails: 0, until: 0 });
          ZA.logEvent('login');
          ZA.app.start();
        });
      }).catch(function (e2) { ZA.busy(btn, false); err.textContent = ZA.errorMessage(e2); });
    });
  };

  ZA.actions['auth-forgot'] = function () {
    box('<p class="eyebrow">Zari Admin</p><h1>Reset password</h1><p class="lede">We’ll email a reset link if the address belongs to an admin account.</p>' +
      '<form id="forgotForm" class="stack">' + ZA.f.text('email', 'Email', '', { type: 'email', required: true, autocomplete: 'username' }) +
      '<button class="btn btn-primary btn-block" type="submit" data-busy="Sending…">Send reset link</button></form>' +
      '<p class="alt"><button class="link" data-action="auth-login">Back to sign in</button></p>');
    var form = ZA.qs('#forgotForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = ZA.readForm(form).email, btn = form.querySelector('button');
      if (!/^\S+@\S+\.\S+$/.test(email)) { ZA.fail('Enter a valid email.'); return; }
      ZA.busy(btn, true);
      var redirect = location.origin + location.pathname + '?reset=1';
      ZA.db.auth.resetPasswordForEmail(email, { redirectTo: redirect }).then(function () {
        // Same message either way — doesn't reveal whether the account exists.
        box('<h1>Check your email</h1><p class="lede">If that address belongs to an admin account, a reset link is on its way. It expires after one hour.</p>' +
          '<button class="btn btn-block" data-action="auth-login">Back to sign in</button>');
      });
    });
  };
  ZA.actions['auth-login'] = function () { ZA.auth.showLogin(); };

  ZA.auth.passwordProblem = function (pw) {
    if (!pw || pw.length < 12) return 'Use at least 12 characters.';
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Include letters and numbers.';
    return '';
  };

  // Shown after following a reset/invite email link (Supabase signs the user in
  // with a short-lived recovery session).
  ZA.auth.showSetPassword = function () {
    showAuth();
    box('<p class="eyebrow">Zari Admin</p><h1>Set a new password</h1><p class="lede">At least 12 characters, with letters and numbers.</p>' +
      '<form id="newPwForm" class="stack">' +
      ZA.f.text('password', 'New password', '', { type: 'password', required: true, autocomplete: 'new-password' }) +
      ZA.f.text('password2', 'Repeat new password', '', { type: 'password', required: true, autocomplete: 'new-password' }) +
      '<div class="error small" id="pwErr" role="alert"></div>' +
      '<button class="btn btn-primary btn-block" type="submit" data-busy="Saving…">Save password</button></form>');
    var form = ZA.qs('#newPwForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = ZA.readForm(form), err = ZA.qs('#pwErr'), btn = form.querySelector('button');
      var problem = ZA.auth.passwordProblem(v.password) || (v.password !== v.password2 ? 'Passwords don’t match.' : '');
      if (problem) { err.textContent = problem; return; }
      ZA.busy(btn, true);
      ZA.db.auth.updateUser({ password: v.password }).then(function (res) {
        if (res.error) { ZA.busy(btn, false); err.textContent = res.error.message; return; }
        history.replaceState(null, '', location.pathname + '#/');
        ZA.auth.loadAdmin().then(function (me) {
          if (!me) { ZA.db.auth.signOut({ scope: 'local' }); ZA.auth.showLogin('Password saved, but this account does not have admin access.'); return; }
          ZA.logEvent('password_changed', { via: 'reset_link' });
          ZA.ok('Password saved');
          ZA.app.start();
        });
      });
    });
  };

  ZA.auth.loadAdmin = function () {
    return ZA.db.rpc('admin_me').then(function (res) {
      ZA.me = res.error ? null : res.data;
      return ZA.me;
    }, function () { ZA.me = null; return null; });
  };

  ZA.auth.logout = function (reason) {
    var done = function () {
      ZA.me = null; ZA.dirty.set(false);
      ZA.auth.showLogin(reason || 'You have been signed out.', reason ? 'warn' : 'ok');
    };
    ZA.logEvent('logout').then(function () { return ZA.db.auth.signOut({ scope: 'local' }); }).then(done, done);
  };
  ZA.sessionExpired = function () { if (ZA.me) ZA.auth.logout('Your session expired. Please sign in again.'); };

  /* ---------- Idle timeout ---------- */
  var idleTimer = null;
  function resetIdle() {
    clearTimeout(idleTimer);
    if (!ZA.me) return;
    idleTimer = setTimeout(function () {
      if (ZA.dirty.on) { resetIdle(); return; } // don't throw away unsaved work; re-arm instead
      ZA.auth.logout('Signed out after ' + IDLE_MINUTES + ' minutes of inactivity.');
    }, IDLE_MINUTES * 60 * 1000);
  }
  ['click', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, ZA.debounce(resetIdle, 1000), { passive: true }); });
  ZA.auth.startIdleTimer = resetIdle;

  // Another tab signed out / password changed elsewhere / account disabled.
  ZA.db.auth.onAuthStateChange(function (event) {
    if (event === 'PASSWORD_RECOVERY') { ZA.auth.showSetPassword(); return; }
    if (event === 'SIGNED_OUT' && ZA.me) { ZA.me = null; ZA.auth.showLogin('You were signed out.', 'warn'); }
  });
  // Re-check admin status when the tab regains focus (picks up a disabled account or role change).
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || !ZA.me) return;
    var prev = JSON.stringify(ZA.me.permissions);
    ZA.auth.loadAdmin().then(function (me) {
      if (!me) { ZA.db.auth.signOut({ scope: 'local' }); ZA.auth.showLogin('Your admin access has changed. Please sign in again.', 'warn'); return; }
      if (JSON.stringify(me.permissions) !== prev) { ZA.app.renderShell(); ZA.app.route(); }
    });
  });
})();
