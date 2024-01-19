/* eslint-disable no-console */
const GHPATH = 'https://segmentcontroller.github.io/pcb-tht-holder/';

const APP_PREFIX = 'pwa_pcb-tht-holder_';

const VERSION = 'v1.0.0';

// The files to make available for offline use. make sure to add others to this list
const URLS = [
	`${GHPATH}/`,
	`${GHPATH}/index.html`,
	`${GHPATH}/favicon.png`,
	`${GHPATH}/pcb-board-32.png`,
	`${GHPATH}/pcb-board-128.png`,
	`${GHPATH}/pcb-board-512.png`,
	`${GHPATH}/manifest.webmanifest`
];

const CACHE_NAME = APP_PREFIX + VERSION;
self.addEventListener('fetch', function (event_) {
	console.log('Fetch request : ' + event_.request.url);
	event_.respondWith(
		caches.match(event_.request).then(function (request) {
			if (request) {
				console.log('Responding with cache : ' + event_.request.url);
				return request;
			} else {
				console.log('File is not cached, fetching : ' + event_.request.url);
				return fetch(event_.request);
			}
		})
	);
});

self.addEventListener('install', function (event_) {
	event_.waitUntil(
		caches.open(CACHE_NAME).then(function (cache) {
			console.log('Installing cache : ' + CACHE_NAME);
			return cache.addAll(URLS);
		})
	);
});

self.addEventListener('activate', function (event_) {
	event_.waitUntil(
		caches.keys().then(function (keyList) {
			var cacheWhitelist = keyList.filter(function (key) {
				return key.indexOf(APP_PREFIX);
			});
			cacheWhitelist.push(CACHE_NAME);
			return Promise.all(
				keyList.map(function (key, index) {
					if (!cacheWhitelist.includes(key)) {
						console.log('Deleting cache : ' + keyList[index]);
						return caches.delete(keyList[index]);
					}
				})
			);
		})
	);
});
