// Service worker template; the build (vite.config.ts) fills in the version and the precache list.
// - App shell + entry assets are precached at install (paths relative to the worker's scope).
// - Hashed build assets and static files are served cache-first and cached on first use
//   (this includes the lazily loaded 3D chunks and the label font, so they also work offline).
// - Navigations are network-first so a new deployment is picked up, falling back to the cached shell.
// A new worker waits until old tabs are closed (no skipWaiting), so a page never loses its chunks.

const APP_PREFIX = 'pwa_pcb-tht-holder_';
const CACHE_NAME = APP_PREFIX + 'v1.15.0';
const PRECACHE = JSON.parse('["./","index.html","manifest.webmanifest","favicon.png","pcb-board-32.png","pcb-board-128.png","pcb-board-512.png","assets/index-11jFPIlG.js","assets/index-DtSJL2or.css"]');

const scopeUrl = (path) => new URL(path, self.registration.scope).href;

const cacheFirst = async (event) => {
	const cache = await caches.open(CACHE_NAME);
	const cached = await cache.match(event.request);
	if (cached) return cached;

	const response = await fetch(event.request);
	if (response.ok) event.waitUntil(cache.put(event.request, response.clone()));
	return response;
};

const networkFirst = async (event) => {
	const cache = await caches.open(CACHE_NAME);
	try {
		const response = await fetch(event.request);
		if (response.ok) event.waitUntil(cache.put(event.request, response.clone()));
		return response;
	} catch (error) {
		const cached =
			(await cache.match(event.request)) ?? (await cache.match(scopeUrl('index.html')));
		if (cached) return cached;
		throw error;
	}
};

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE.map((path) => scopeUrl(path))))
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key.startsWith(APP_PREFIX) && key !== CACHE_NAME)
						.map((key) => caches.delete(key))
				)
			)
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;

	event.respondWith(request.mode === 'navigate' ? networkFirst(event) : cacheFirst(event));
});
