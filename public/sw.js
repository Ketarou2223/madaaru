const CACHE_NAME = "madaaru-shell-v1"

// App shell files to cache for offline
const SHELL_URLS = ["/", "/shopping", "/icon.svg"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
  )
  self.clients.claim()
})

// Network-first strategy: try network, fall back to cache for navigation requests
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/").then((r) => r ?? fetch(event.request))
      )
    )
  }
})
