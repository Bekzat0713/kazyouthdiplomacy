/**
 * KazYouthDiplomacy — Onboarding & Persistent Greeting
 *
 * 1. Always shows the user's name in the page heading area (permanent).
 * 2. Shows the welcome banner once per user (key tied to email so
 *    different users on the same browser each see it fresh).
 */
(function () {
  'use strict';

  var KEY_PREFIX = 'kyd_onb_v2_';   // per-user key prefix
  var DELAY_MS   = 600;              // wait for dashboard.js first render

  /* ── Per-user storage helpers ──────────────────────────────────── */
  function storageKey(email) {
    return KEY_PREFIX + (email || 'anon');
  }

  function isBannerDone(email) {
    try { return localStorage.getItem(storageKey(email)) === '1'; } catch (_) { return true; }
  }

  function markBannerDone(email) {
    try { localStorage.setItem(storageKey(email), '1'); } catch (_) {}
  }

  /* ── DOM readers ────────────────────────────────────────────────── */
  function readName() {
    var el = document.getElementById('dashboardProfileName');
    if (!el) return null;
    var t = (el.textContent || '').trim();
    if (!t || t.includes('загружается') || t === '-' || t === 'Профиль пользователя') return null;
    // Return just the first name for a friendly greeting
    return t.split(/\s+/)[0];
  }

  function readEmail() {
    var el = document.getElementById('dashboardProfileEmail');
    if (!el) return null;
    var t = (el.textContent || '').trim();
    return (t && t !== '-') ? t : null;
  }

  function readCareerPct() {
    var el = document.getElementById('dashboardCareerBadge');
    if (!el) return 0;
    var n = parseInt((el.textContent || '').replace('%', ''), 10);
    return isNaN(n) ? 0 : Math.min(n, 100);
  }

  /* ── Permanent page greeting (always visible) ───────────────────── */
  function updatePageGreeting() {
    var name  = readName();
    var line  = document.getElementById('dashboardWelcomeLine');
    var title = document.getElementById('dashboardPageTitle');
    if (!line) return;

    if (name) {
      line.textContent = 'Привет, ' + name + '! 👋 Рады видеть вас снова.';
      line.hidden = false;
      if (title) title.textContent = 'Личный кабинет';
    } else {
      line.hidden = true;
    }
  }

  /* ── Onboarding banner ──────────────────────────────────────────── */
  function applyBannerName() {
    var name  = readName();
    var title = document.getElementById('onboardingWelcomeTitle');
    if (title) {
      title.textContent = name ? 'Привет, ' + name + '! 👋' : 'Добро пожаловать! 👋';
    }
  }

  function applyBannerProgress() {
    var pct  = readCareerPct();
    var fill = document.getElementById('onboardingProgressFill');
    var val  = document.getElementById('onboardingProgressVal');
    if (fill) fill.style.width = pct + '%';
    if (val)  val.textContent  = pct + '%';
  }

  function showBanner() {
    var email  = readEmail();
    var banner = document.getElementById('onboardingBanner');
    if (!banner) return;
    if (isBannerDone(email)) return;   // already seen by this user

    applyBannerName();
    applyBannerProgress();

    banner.hidden = false;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.classList.add('onboarding-visible');
      });
    });
  }

  function hideBanner() {
    var email  = readEmail();
    var banner = document.getElementById('onboardingBanner');
    if (!banner) return;
    banner.classList.remove('onboarding-visible');
    banner.classList.add('onboarding-hiding');
    setTimeout(function () { banner.hidden = true; }, 380);
    markBannerDone(email);
  }

  /* ── MutationObserver helper ────────────────────────────────────── */
  function watchElement(id, cb) {
    var el = document.getElementById(id);
    if (!el) return;
    var observer = new MutationObserver(function () {
      // Disconnect and re-observe prevents double-firing
      cb();
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true });
  }

  /* ── Init ──────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('dashboardProfileName')) return;

    // Bind dismiss
    var btn = document.getElementById('onboardingDismiss');
    if (btn) btn.addEventListener('click', hideBanner);

    // Watch async data from dashboard.js
    watchElement('dashboardProfileName', function () {
      updatePageGreeting();
      applyBannerName();
    });
    watchElement('dashboardProfileEmail', function () {
      // Re-check banner eligibility once we know the email
      var email = readEmail();
      if (!isBannerDone(email)) {
        applyBannerName();
        var banner = document.getElementById('onboardingBanner');
        if (banner && banner.hidden) showBanner();
      }
    });
    watchElement('dashboardCareerBadge', applyBannerProgress);

    // Initial render after brief delay (dashboard.js may already be done)
    setTimeout(function () {
      updatePageGreeting();
      showBanner();
    }, DELAY_MS);
  });
})();
