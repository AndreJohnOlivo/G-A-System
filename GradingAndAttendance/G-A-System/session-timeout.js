(() => {
  const WARNING_DELAY_MS = 3 * 60 * 1000;
  const LOGOUT_DELAY_MS = 5 * 60 * 1000;
  let warningTimer;
  let logoutTimer;
  let warningShown = false;

  function hasSession() {
    return Boolean(sessionStorage.getItem('uccAccessToken'));
  }

  function clearTimers() {
    clearTimeout(warningTimer);
    clearTimeout(logoutTimer);
  }

  function removeWarning() {
    document.getElementById('idle-timeout-warning')?.remove();
    warningShown = false;
  }

  async function logout(message) {
    clearTimers();
    removeWarning();
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {
      // The local session must still be cleared if the server is unavailable.
    }
    sessionStorage.removeItem('uccAccessRole');
    sessionStorage.removeItem('uccAccessToken');
    sessionStorage.removeItem('currentStudentName');
    window.location.replace(`index.html?message=${encodeURIComponent(message)}`);
  }

  function showWarning() {
    if (!hasSession() || warningShown) return;
    warningShown = true;
    const warning = document.createElement('div');
    warning.id = 'idle-timeout-warning';
    warning.setAttribute('role', 'alertdialog');
    warning.setAttribute('aria-modal', 'true');
    warning.style.cssText = 'position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:24px;background:rgba(0,0,0,.45)';
    warning.innerHTML = '<div style="max-width:420px;padding:24px;background:#fff;color:#1f2937;border-radius:8px;box-shadow:0 18px 50px rgba(0,0,0,.3)"><h2 style="margin-top:0">Still working?</h2><p>Your session will end in two minutes because there has been no activity.</p><div style="display:flex;gap:12px;justify-content:flex-end"><button type="button" class="btn btn-secondary" data-idle-logout>Logout</button><button type="button" class="btn btn-primary" data-idle-continue>Stay signed in</button></div></div>';
    warning.querySelector('[data-idle-continue]').addEventListener('click', startTimer);
    warning.querySelector('[data-idle-logout]').addEventListener('click', () => logout('You have been logged out.'));
    document.body.appendChild(warning);
  }

  function startTimer() {
    if (!hasSession()) return;
    clearTimers();
    removeWarning();
    warningTimer = setTimeout(showWarning, WARNING_DELAY_MS);
    logoutTimer = setTimeout(() => logout('You were logged out after 5 minutes of inactivity.'), LOGOUT_DELAY_MS);
  }

  function recordActivity() {
    if (hasSession() && !warningShown) startTimer();
  }

  function addManualLogoutButton() {
    if (document.querySelector('#logout-btn, #student-logout-btn, #session-logout-btn')) return;
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;
    let actions = topbar.querySelector('.topbar-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'topbar-actions';
      topbar.appendChild(actions);
    }
    const button = document.createElement('button');
    button.id = 'session-logout-btn';
    button.type = 'button';
    button.className = 'btn btn-secondary';
    button.textContent = 'Logout';
    button.addEventListener('click', () => logout('You have been logged out.'));
    actions.appendChild(button);
  }

  for (const eventName of ['pointerdown', 'keydown', 'input', 'scroll', 'touchstart']) {
    window.addEventListener(eventName, recordActivity, { passive: true });
  }
  window.addEventListener('ucc:session-start', startTimer);
  window.addEventListener('DOMContentLoaded', () => {
    addManualLogoutButton();
    startTimer();
  });
})();