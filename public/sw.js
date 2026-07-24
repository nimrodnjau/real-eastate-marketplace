self.addEventListener('install', (event) => {
  // Don't wait for old tabs to close before activating — take over
  // as soon as install finishes. Without this, a freshly registered
  // worker can sit in "waiting" state and `serviceWorker.ready` never
  // resolves until every open tab for this origin is closed.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of any already-open pages immediately, rather than
  // waiting for the next navigation/reload.
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});