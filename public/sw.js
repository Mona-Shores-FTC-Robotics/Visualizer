// The offline copy of the site.
//
// The app's own code and pages (HTML, JS, CSS, samples) are fetched from the
// network first, so an ordinary reload always gets the version just deployed;
// the saved copy is only used offline, or when the network takes longer than
// NETWORK_TIMEOUT_MS (a slow venue Wi-Fi). Images and fonts are served from
// the saved copy and refreshed in the background.
//
// A new version of this file takes over at once (skipWaiting + claim) instead
// of waiting for every tab of the old one to close.
//
// VERSION names the cache. The GitHub Pages workflow replaces "dev" with the
// commit it builds, so each deploy starts a fresh cache and drops the old one.
const VERSION = "dev";
const CACHE_NAME = `auto-builder-${VERSION}`;
const NETWORK_TIMEOUT_MS = 4000;

const APP_STATIC_RESOURCES = [
  // Relative, so they resolve against this worker's own folder: the app may be
  // served from a sub-path (https://<org>.github.io/Visualizer/).
  "./",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./fields/centerstage.webp",
  "./fields/intothedeep.webp",
  "./fields/decode.webp",
  "./fields/biobuzz.webp",
  "./robot.png",
  "./assets/index.js",
  "./assets/index.css",
  "./fonts/Poppins-Regular.ttf",
  "./fonts/Poppins-SemiBold.ttf",
  "./fonts/Poppins-Light.ttf",
  "./fonts/Poppins-ExtraLight.ttf",
];

/** The app's own code and pages: these must never be served stale when online. */
function isAppCode(url) {
  return /\.(js|css|html|webmanifest|pp)$/.test(url.pathname) || url.pathname.endsWith("/");
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // One missing file must not stop the rest from being saved.
      await Promise.allSettled(
        APP_STATIC_RESOURCES.map((url) => cache.add(new Request(url, { cache: "no-cache" }))),
      );
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

/** Fetch past the browser's HTTP cache (GitHub Pages allows 10 minutes), within a time limit. */
async function fromNetwork(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: "no-cache", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function networkFirst(event, cacheKey) {
  const cache = await caches.open(CACHE_NAME);
  const network = fromNetwork(event.request.url, NETWORK_TIMEOUT_MS).then((response) => {
    if (response.ok) cache.put(cacheKey, response.clone());
    return response;
  });
  try {
    return await network;
  } catch {
    const saved = await cache.match(cacheKey);
    if (saved) return saved;
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function savedFirst(event) {
  const cache = await caches.open(CACHE_NAME);
  const saved = await cache.match(event.request);
  const refresh = fetch(event.request)
    .then((response) => {
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })
    .catch(() => null);
  if (saved) {
    event.waitUntil(refresh);
    return saved;
  }
  return (await refresh) ?? new Response(null, { status: 404 });
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Only this site's own GET requests; anything else goes to the network untouched.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    // A single page app: every page is index.html, saved as "./".
    event.respondWith(networkFirst(event, new URL("./", self.location).href));
  } else if (isAppCode(url)) {
    event.respondWith(networkFirst(event, event.request.url));
  } else {
    event.respondWith(savedFirst(event));
  }
});
