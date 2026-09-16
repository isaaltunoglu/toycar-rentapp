const CACHE = "joyride-v5";
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./auth.js", "./firebase-config.js", "./manifest.webmanifest", "./assets/toy-cars-hero.webp"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener("fetch", event => event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request))));
