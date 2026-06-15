if ('serviceWorker' in navigator) {
  var hadController = Boolean(navigator.serviceWorker.controller);
  var hasRefreshedForNewWorker = false;

  function isAuthPage() {
    return ['/login', '/login.html', '/register', '/register.html'].indexOf(window.location.pathname) !== -1;
  }

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!hadController || hasRefreshedForNewWorker || isAuthPage()) {
      return;
    }

    hasRefreshedForNewWorker = true;
    window.location.reload();
  });

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (registration) {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.addEventListener('updatefound', function () {
        var installingWorker = registration.installing;
        if (!installingWorker) {
          return;
        }

        installingWorker.addEventListener('statechange', function () {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            installingWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      registration.update().catch(function () {});
    }).catch(function () {});
  });
}
