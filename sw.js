// Kukkaro – service worker: sovellus aukeaa myös ilman verkkoa.
// Kun päivität sovelluksen tiedostoja GitHubiin, kasvata versionumeroa.
const CACHE = "kukkaro-v5";
const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const SHELL = ["./", "./index.html", "./styles.css", "./firebase-config.js", "./manifest.json",
  "./js/main.js", "./js/core.js", "./js/money.js", "./js/calc.js", "./js/theme.js", "./js/actions.js", "./js/lock.js",
  "./js/views/koti.js", "./js/views/jakso.js", "./js/views/toistuvat.js", "./js/views/tilastot.js", "./js/views/kategoriat.js",
  "./js/views/asetukset.js", "./js/views/teemat.js", "./js/views/rows.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];
const SDK_FILES = ["firebase-app.js", "firebase-auth.js", "firebase-firestore.js"].map(f => SDK + f);

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all([...SHELL, ...SDK_FILES].map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("kukkaro-") && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
// Omat tiedostot: verkosta ensin (päivitykset tulevat heti), välimuistista jos verkko ei vastaa 3,5 s:ssa.
function networkFirst(req) {
  return new Promise(resolve => {
    let done = false;
    const fromCache = () => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("./index.html"));
    // Hidas verkko: käytetään välimuistia vain, jos siellä on tiedosto (muuten odotetaan verkkoa)
    const timer = setTimeout(async () => {
      const r = await caches.match(req, { ignoreSearch: true });
      if (r && !done) { done = true; resolve(r); }
    }, 3500);
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      if (!done) { done = true; clearTimeout(timer); resolve(res); }
    }).catch(async () => { clearTimeout(timer); if (!done) { done = true; resolve(await fromCache()); } });
  });
}
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.href.startsWith(SDK)) { e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; }))); return; }
  if (url.origin === location.origin) e.respondWith(networkFirst(req));
});
