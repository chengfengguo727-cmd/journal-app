/* eslint-disable */
/**
 * 私人日誌 service worker
 * - 安裝時 cache 殼 / 圖示
 * - 對 GET 走 stale-while-revalidate（離線可看舊內容）
 * - 對 /api/entries POST 不快取，但失敗時讓 client 走 IndexedDB queue
 * - 收到 push 顯示通知
 */

const SW_VERSION = 'v3'
const STATIC_CACHE = `journal-static-${SW_VERSION}`
const RUNTIME_CACHE = `journal-runtime-${SW_VERSION}`
const SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.all(
          SHELL.map((url) =>
            cache.add(url).catch(() => {
              /* 缺檔不要 abort install */
            }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // 不要 cache auth / API mutating endpoints
  if (url.pathname.startsWith('/api/')) {
    // 對 /api/entries 等 GET 用 network-first 但失敗回 cache
    event.respondWith(networkFirst(request))
    return
  }

  // 頁面 / 靜態資源走 stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request))
})

async function networkFirst(request) {
  try {
    const fresh = await fetch(request)
    const cache = await caches.open(RUNTIME_CACHE)
    cache.put(request, fresh.clone()).catch(() => {})
    return fresh
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone()).catch(() => {})
      }
      return response
    })
    .catch(() => cached)
  return cached || fetchPromise
}

/* ----------------------- Push notifications ----------------------- */

self.addEventListener('push', (event) => {
  let payload = { title: '私人日誌', body: '別忘了今天的記錄', url: '/' }
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() }
    } catch {
      payload.body = event.data.text()
    }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url || '/' },
      tag: payload.tag || 'journal-reminder',
      renotify: true,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url).catch(() => {})
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    }),
  )
})
