const CACHE_NAME = 'stratfolioui-v2'
const BASE_PATH = new URL('./', self.location.href).pathname
const APP_SHELL = [BASE_PATH, `${BASE_PATH}manifest.webmanifest`, `${BASE_PATH}favicon.svg`]

/**
 * Backend service prefixes (plan D7). These are network-only: a cached
 * portfolio, position list or order outcome served from disk is a lie about
 * the system of record, and a stale idempotent POST replay is worse. Keep in
 * sync with `SERVICE_BASE` in `src/api/http/env.ts`.
 */
const API_PREFIXES = ['/plt', '/ai', '/bkt', '/mnd']

function isApiRequest(url) {
  if (url.origin !== self.location.origin) return false
  const path = url.pathname.startsWith(BASE_PATH)
    ? `/${url.pathname.slice(BASE_PATH.length)}`
    : url.pathname
  return API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Bypass entirely — do not even respondWith — so the request goes straight
  // to the network with its own headers (Idempotency-Key included) untouched.
  if (isApiRequest(new URL(event.request.url))) return

  if (event.request.method !== 'GET') return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE_NAME).then((cache) => cache.put(BASE_PATH, copy))
          return response
        })
        .catch(() => caches.match(BASE_PATH)),
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok && new URL(event.request.url).origin === self.location.origin) {
            const copy = response.clone()
            void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          }
          return response
        }),
    ),
  )
})
