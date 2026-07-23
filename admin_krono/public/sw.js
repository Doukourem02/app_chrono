/* Service worker minimal — notifications Web Push page suivi Krono */
self.addEventListener('push', (event) => {
  let payload = { title: 'Krono', body: '', openPath: '/' }
  try {
    if (event.data) {
      const t = event.data.text()
      payload = { ...payload, ...JSON.parse(t) }
    }
  } catch {
    /* ignore */
  }
  const url =
    payload.openPath && String(payload.openPath).startsWith('http')
      ? payload.openPath
      : new URL(payload.openPath || '/', self.location.origin).href

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Krono', {
      body: payload.body || '',
      icon: '/favicon.ico',
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || self.location.origin
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === target && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })
  )
})
