// Service worker template; the build (vite.config.ts) fills in the version and the precache list.
// - App shell + entry assets are precached at install (paths relative to the worker's scope).
// - Hashed build assets and static files are served cache-first and cached on first use
//   (this includes the lazily loaded 3D chunks and the label font, so they also work offline).
// - Navigations are network-first so a new deployment is picked up, falling back to the cached shell
//   when the network fails or takes longer than NAVIGATION_TIMEOUT_MS.
// A new worker waits until old tabs are closed (no skipWaiting), so a page never loses its chunks.

const APP_PREFIX = 'pwa_pcb-tht-holder_';
const CACHE_NAME = APP_PREFIX + 'v1.15.1';
const PRECACHE = JSON.parse('["./","index.html","manifest.webmanifest","favicon.png","pcb-board-32.png","pcb-board-128.png","pcb-board-512.png","assets/index-Coqa57VK.js","assets/index-BNb5QacG.css","assets/modalStore-Cfmt_aFq.js","assets/modalStore-TEGbWNJa.css","assets/AppDesigner-ZzsqbaiZ.js","assets/AppDesigner-DjZYZZI9.css","assets/math-Cg1NFMMu.js"]');

const scopeUrl = (path) => new URL(path, self.registration.scope).href;

const cacheFirst = async (event) => {
	const cache = await caches.open(CACHE_NAME);
	const cached = await cache.match(event.request);
	if (cached) return cached;

	const response = await fetch(event.request);
	if (response.ok) event.waitUntil(cache.put(event.request, response.clone()));
	return response;
};

const NAVIGATION_TIMEOUT_MS = 3000;

const networkFirst = async (event) => {
	const cache = await caches.open(CACHE_NAME);
	const network = fetch(event.request).then((response) => {
		if (response.ok) event.waitUntil(cache.put(event.request, response.clone()));
		return response;
	});
	event.waitUntil(network.catch(() => {})); // keeps refreshing the cache after a timeout fallback

	// A slow network must not hold the page back when the shell is cached
	const timeout = new Promise((resolve) => setTimeout(resolve, NAVIGATION_TIMEOUT_MS));
	try {
		const response = await Promise.race([network, timeout]);
		if (response) return response;
	} catch {
		/* offline: fall through to the cache */
	}

	const cached = (await cache.match(event.request)) ?? (await cache.match(scopeUrl('index.html')));
	return cached ?? network;
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
