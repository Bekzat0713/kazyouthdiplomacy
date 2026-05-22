/**
 * KazYouthDiplomacy — Page Transitions
 * Intercepts all same-origin <a> links automatically.
 * No route-page / route-link classes required on any page.
 *
 * OUT: entire page fades out + slides up ~10px (240 ms)
 * IN : new page fades in + rises up from 12px offset (400 ms)
 */
(function () {
  'use strict';

  var DURATION_OUT = 240;   // ms — how long the fade-out takes before navigation
  var DURATION_IN  = 420;   // ms — how long the new page fades in
  var KEY          = 'kyd_pt_v3';
  var TTL          = 5000;  // discard stale entries

  /* ── SessionStorage helpers ─────────────────────────── */

  function save(dir) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ d: dir, ts: Date.now() }));
    } catch (_) {}
  }

  function consume() {
    try {
      var raw = sessionStorage.getItem(KEY);
      sessionStorage.removeItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.ts || (Date.now() - data.ts) > TTL) return null;
      return data;
    } catch (_) { return null; }
  }

  /* ── Helpers ────────────────────────────────────────── */

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

  /* ── OUT transition (on link click) ─────────────────── */

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

    var dir = link.dataset.transitionDirection || 'right';
    save(dir);

    /* Fade the whole page out */
    var html = document.documentElement;
    html.style.transition =
      'opacity '   + DURATION_OUT + 'ms cubic-bezier(0.4,0,1,1),' +
      'transform '  + DURATION_OUT + 'ms cubic-bezier(0.4,0,1,1)';
    html.style.opacity   = '0';
    html.style.transform = 'translateY(-10px)';

    setTimeout(function () {
      window.location.href = href;
    }, DURATION_OUT + 30);
  }

  /* ── IN transition (on page load) ───────────────────── */

  function playIn() {
    var state = consume();

    /* Homepage — let the splash screen handle the intro */
    if (window.location.pathname === '/') return;

    var html = document.documentElement;

    if (!state) {
      /* Direct load / refresh — just make sure html is fully visible */
      html.style.opacity   = '';
      html.style.transform = '';
      html.style.transition = '';
      return;
    }

    /* Start invisible + offset, then animate in */
    html.style.transition = 'none';
    html.style.opacity   = '0';
    html.style.transform = 'translateY(12px)';

    /* Double-rAF ensures the browser actually renders the initial hidden state
       before we kick off the transition */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        html.style.transition =
          'opacity '   + DURATION_IN + 'ms cubic-bezier(0.16,1,0.3,1),' +
          'transform '  + DURATION_IN + 'ms cubic-bezier(0.16,1,0.3,1)';
        html.style.opacity   = '1';
        html.style.transform = 'translateY(0)';

        setTimeout(function () {
          html.style.transition = '';
          html.style.opacity    = '';
          html.style.transform  = '';
        }, DURATION_IN + 100);
      });
    });
  }

  /* ── Bind all same-origin links ──────────────────────── */

  function bindLinks() {
    document.querySelectorAll('a[href]').forEach(function (link) {
      if (link.dataset.ptBound) return;
      var href = link.getAttribute('href');
      if (!isInternal(href)) return;

      link.dataset.ptBound = '1';
      link.addEventListener('click', handleLinkClick);
    });
  }

  /* ── Init ─────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', function () {
    playIn();
    bindLinks();
  });

  /* Re-bind any links that might be injected dynamically */
  var bindTimer = null;
  var observer = new MutationObserver(function () {
    clearTimeout(bindTimer);
    bindTimer = setTimeout(bindLinks, 120);
  });
  document.addEventListener('DOMContentLoaded', function () {
    observer.observe(document.body, { childList: true, subtree: true });
  });

  /* ── bfcache restore (browser back / forward) ────────── */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      navigating = false;
      var html = document.documentElement;
      html.style.transition = '';
      html.style.opacity    = '';
      html.style.transform  = '';
    }
  });

  /* Safety: if navigation stalls for whatever reason, restore visibility */
  window.addEventListener('pagehide', function () {
    navigating = false;
  });
})();
