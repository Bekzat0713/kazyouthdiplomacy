var CACHE_NAME = 'kyd-v22';
var PRECACHE_URLS = ['/'];
var STATIC_EXTENSIONS = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.woff', '.woff2', '.ttf'];
var NETWORK_FIRST_EXTENSIONS = ['.css', '.js', '.svg'];
var AUTH_PAGE_PATHS = ['/login', '/login.html', '/register', '/register.html'];

function isStaticAsset(url) {
  var pathname = new URL(url).pathname;
  return STATIC_EXTENSIONS.some(function (ext) {
    return pathname.endsWith(ext);
  });
}

function isNetworkFirstAsset(url) {
  var pathname = new URL(url).pathname;
  return NETWORK_FIRST_EXTENSIONS.some(function (ext) {
    return pathname.endsWith(ext);
  });
}

function shouldSkipCache(url) {
  var pathname = new URL(url).pathname;
  return pathname.startsWith('/api/') || pathname.startsWith('/auth/') || pathname === '/app-config.js';
}

function fetchAndCache(request) {
  return fetch(request).then(function (response) {
    if (response && response.status === 200 && response.type === 'basic') {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function (cache) {
        cache.put(request, clone);
      });
    }
    return response;
  });
}

function reloadAuthClients() {
  return self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  }).then(function (clientList) {
    return Promise.all(
      clientList.map(function (client) {
        var pathname = new URL(client.url).pathname;
        if (AUTH_PAGE_PATHS.indexOf(pathname) === -1 || !client.navigate) {
          return Promise.resolve();
        }
        return client.navigate(client.url).catch(function () {});
      })
    );
  });
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (name) {
          return name !== CACHE_NAME;
        }).map(function (name) {
          return caches.delete(name);
        })
      );
    }).then(function () {
      return self.clients.claim();
    }).then(function () {
      return reloadAuthClients();
    })
  );
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  if (shouldSkipCache(request.url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match('/');
      })
    );
    return;
  }

  if (isNetworkFirstAsset(request.url)) {
    event.respondWith(
      fetchAndCache(request).catch(function () {
        return caches.match(request);
      })
    );
    return;
  }

  if (isStaticAsset(request.url)) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) return cached;
        return fetchAndCache(request);
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(function () {
      return caches.match(request);
    })
  );
});
