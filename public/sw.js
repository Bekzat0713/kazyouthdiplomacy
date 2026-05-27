var CACHE_NAME = 'kyd-v1';
var PRECACHE_URLS = ['/', '/dashboard'];
var STATIC_EXTENSIONS = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.woff', '.woff2', '.ttf'];

function isStaticAsset(url) {
  var pathname = new URL(url).pathname;
  return STATIC_EXTENSIONS.some(function (ext) {
    return pathname.endsWith(ext);
  });
}

function shouldSkipCache(url) {
  var pathname = new URL(url).pathname;
  return pathname.startsWith('/api/') || pathname === '/app-config.js';
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
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  if (shouldSkipCache(request.url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (isStaticAsset(request.url)) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) return cached;
        return fetch(request).then(function (response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).then(function (response) {
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, clone);
        });
      }
      return response;
    }).catch(function () {
      return caches.match(request);
    })
  );
});
