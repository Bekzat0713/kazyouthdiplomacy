/**
 * KazYouthDiplomacy — Page Transitions
 * Safe cross-browser fade. Disabled on iOS Safari (known rAF/opacity bugs).
 */
(function () {
  'use strict';

  /* ── Detect iOS / Safari — transitions disabled there ───── */
  var ua = navigator.userAgent || '';
  var isIOS     = /iPhone|iPad|iPod/i.test(ua);
  var isSafari  = /^((?!chrome|android).)*safari/i.test(ua);
  var noAnim    = isIOS || isSafari;

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

  var DURATION_OUT = 220;
  var DURATION_IN  = 380;
  var KEY          = 'kyd_pt_v4';
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
      'opacity '  + DURATION_OUT + 'ms ease,' +
      'transform ' + DURATION_OUT + 'ms ease';
    html.style.opacity   = '0';
    html.style.transform = 'translateY(-8px)';

    /* Safety: navigate even if transition callback fails */
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

    var html = document.documentElement;
    var hasEntry = consume();

    if (!hasEntry) {
      ensureVisible();
      return;
    }

    /* Start hidden */
    html.style.transition = 'none';
    html.style.opacity    = '0';
    html.style.transform  = 'translateY(10px)';

    /* Hard safety: page MUST become visible within 600ms regardless */
    var safetyTimer = setTimeout(ensureVisible, 600);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        clearTimeout(safetyTimer);
        html.style.transition =
          'opacity '  + DURATION_IN + 'ms cubic-bezier(0.16,1,0.3,1),' +
          'transform ' + DURATION_IN + 'ms cubic-bezier(0.16,1,0.3,1)';
        html.style.opacity   = '1';
        html.style.transform = 'translateY(0)';

        setTimeout(ensureVisible, DURATION_IN + 80);
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
