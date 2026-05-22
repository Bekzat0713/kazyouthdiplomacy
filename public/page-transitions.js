/**
 * KazYouthDiplomacy — Page Transitions v5
 *
 * Strategy:
 *   OUT  – fade the *departing* page to opacity 0 before navigating.
 *   IN   – slide the *arriving* page up from a slight offset.
 *         The arriving page is NEVER set to opacity 0 — avoids
 *         any risk of black-screen hangs on iOS Safari / slow devices.
 *
 * iOS / Safari: transitions disabled entirely via UA detection.
 */
(function () {
  'use strict';

  /* ── Detect iOS / Safari — transitions disabled there ───── */
  var ua = navigator.userAgent || '';
  var isIOS    = /iPhone|iPad|iPod/i.test(ua);
  var isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  var noAnim   = isIOS || isSafari;

  /* Always ensure the page is visible on load */
  function ensureVisible() {
    var html = document.documentElement;
    html.style.opacity    = '';
    html.style.transform  = '';
    html.style.transition = '';
  }

  /* On iOS/Safari: just make sure page stays visible, do nothing else */
  if (noAnim) {
    document.addEventListener('DOMContentLoaded', ensureVisible);
    window.addEventListener('pageshow', ensureVisible);
    return;
  }

  var DURATION_OUT = 200;
  var DURATION_IN  = 340;
  var KEY          = 'kyd_pt_v5';
  var TTL          = 4000;

  /* ── SessionStorage ──────────────────────────────────────── */
  function save() {
    try { sessionStorage.setItem(KEY, String(Date.now())); } catch (_) {}
  }
  function consume() {
    try {
      var ts = parseInt(sessionStorage.getItem(KEY), 10);
      sessionStorage.removeItem(KEY);
      if (!ts || (Date.now() - ts) > TTL) return false;
      return true;
    } catch (_) { return false; }
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function isInternal(href) {
    if (!href) return false;
    if (href.charAt(0) === '#') return false;
    try {
      var url = new URL(href, window.location.href);
      return url.origin === window.location.origin;
    } catch (_) { return false; }
  }
  function isSamePage(href) {
    try {
      var url = new URL(href, window.location.href);
      return url.pathname === window.location.pathname && !url.search;
    } catch (_) { return false; }
  }

  /* ── OUT transition ──────────────────────────────────────── */
  var navigating = false;

  function handleLinkClick(e) {
    if (navigating) return;
    var link = e.currentTarget;
    var href = link.getAttribute('href');
    if (!href || !isInternal(href))  return;
    if (isSamePage(href))            return;
    if (link.dataset.noTransition !== undefined) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (link.target && link.target !== '_self') return;

    e.preventDefault();
    navigating = true;
    save();

    var html = document.documentElement;
    html.style.transition =
      'opacity '   + DURATION_OUT + 'ms ease,' +
      'transform ' + DURATION_OUT + 'ms ease';
    html.style.opacity   = '0';
    html.style.transform = 'translateY(-6px)';

    /* Safety: navigate even if transitionend never fires */
    var done = false;
    function navigate() {
      if (done) return;
      done = true;
      window.location.href = href;
    }
    setTimeout(navigate, DURATION_OUT + 40);
  }

  /* ── IN transition ───────────────────────────────────────── */
  function playIn() {
    if (window.location.pathname === '/') return;

    var hasEntry = consume();

    /* No session key — page visited directly, no animation needed */
    if (!hasEntry) {
      ensureVisible();
      return;
    }

    var html = document.documentElement;

    /*
     * SAFE slide-in:
     *   - Opacity stays at 1 the entire time — page is always readable.
     *   - Only translateY is animated, from +10px to 0.
     *   - One rAF pair to allow the browser to paint the initial state.
     *   - ensureVisible() called after to clean up any stale inline styles.
     */
    requestAnimationFrame(function () {
      html.style.transition = 'none';
      html.style.transform  = 'translateY(10px)';

      requestAnimationFrame(function () {
        html.style.transition =
          'transform ' + DURATION_IN + 'ms cubic-bezier(0.16,1,0.3,1)';
        html.style.transform = 'translateY(0)';

        setTimeout(ensureVisible, DURATION_IN + 60);
      });
    });
  }

  /* ── Bind links ──────────────────────────────────────────── */
  function bindLinks() {
    document.querySelectorAll('a[href]').forEach(function (link) {
      if (link.dataset.ptBound) return;
      var href = link.getAttribute('href');
      if (!isInternal(href)) return;
      link.dataset.ptBound = '1';
      link.addEventListener('click', handleLinkClick);
    });
  }

  /* ── Init ────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    playIn();
    bindLinks();
    new MutationObserver(function () {
      clearTimeout(window._ptBindTimer);
      window._ptBindTimer = setTimeout(bindLinks, 150);
    }).observe(document.body, { childList: true, subtree: true });
  });

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { navigating = false; ensureVisible(); }
  });
  window.addEventListener('pagehide', function () { navigating = false; });
})();
