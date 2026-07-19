// BaseFlow Service Worker
// Strategia NETWORK-FIRST + CACHE_NAME versionato (bump = invalida la cache vecchia).
// activate: cancella le cache vecchie + clients.claim(). Offline: fallback alla cache.
const CACHE_NAME = 'baseflow-v18';

const PRECACHE = [
  '/', 'index.html', 'style.css', 'manifest.json', 'img/icon.png', 'img/logoBaseFlow.png',
  'js/core/state.js', 'js/core/fileFormat.js', 'js/core/safeEval.js', 'js/core/utils.js', 'js/core/variables.js', 'js/core/layout.js',
  'js/core/rendering.js', 'js/core/popups.js', 'js/core/interaction.js', 'js/core/fileIO.js',
  'js/core/theme.js', 'js/core/i18n.js', 'js/core/draw.js', 'js/core/ux.js', 'js/core/init.js',
  'js/execute.js', 'js/saveOpen.js', 'js/pythonTranslation.js', 'js/multiTranslation.js',
  'js/exportUnified.js', 'js/tutorial.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const file of PRECACHE) {
      try { await cache.add(file); } catch (err) { /* ignora file mancanti */ }
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200 && fresh.type === 'basic') cache.put(req, fresh.clone());
      return fresh;
    } catch (e) {
      const cached = await cache.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const idx = await cache.match('index.html');
        if (idx) return idx;
      }
      throw e;
    }
  })());
});
