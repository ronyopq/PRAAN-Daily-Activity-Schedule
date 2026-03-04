// ===== Activity One Service Worker =====
const CACHE = 'activity-one-v1';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png'
];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=> c.addAll(APP_SHELL)).then(()=> self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=> Promise.all(keys.map(k=> k!==CACHE && caches.delete(k)))));
  self.clients.claim();
});

// Strategy: cache-first for app shell; network-first for API GET list (do not cache POST)
self.addEventListener('fetch', e=>{
  const req = e.request;
  const url = new URL(req.url);
  if(req.method==='GET' && url.pathname.includes('/macros/s/') && url.searchParams.get('action')==='list'){
    // network-first with fallback to cache
    e.respondWith((async()=>{
      try{
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      }catch(err){
        const cached = await caches.match(req);
        return cached || new Response(JSON.stringify({ok:false,error:'offline'}), {headers:{'Content-Type':'application/json'}});
      }
    })());
    return;
  }
  if(req.method==='GET'){
    e.respondWith(caches.match(req).then(r=> r || fetch(req)));
  }
});
