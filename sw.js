// Online navigation always uses the latest release. API requests and projects stay outside the cache.
// v5.15: cache:"no-cache" makes the browser revalidate index.html on every visit, so a deploy is seen immediately
// even when the web server sends no Cache-Control header.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.mode !== "navigate" || request.destination !== "document") return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || ![scope.pathname, scope.pathname + "index.html"].includes(url.pathname)) return;
  event.respondWith(fetch(request, { cache: "no-cache" }).catch(() => new Response(
    '<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gitmapp · Çevrimdışı</title><body style="background:#101111;color:#eee;font:1rem system-ui;padding:12vw"><h1>Bağlantı bekleniyor</h1><p>Stüdyoya dönmek için internet bağlantınızı kontrol edin.</p><a style="color:#e4ff3d" href="">Yeniden dene</a></body></html>',
    {status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}}
  )));
});

// v5.64: Bildirime dokunulunca açık Gitmapp penceresine geçilir; yoksa yeni pencere açılır.
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || self.registration.scope, self.registration.scope);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if (new URL(client.url).origin === target.origin && "focus" in client) {
        if ("navigate" in client && client.url !== target.href) client.navigate(target.href).catch(() => {});
        return client.focus();
      }
    }
    return self.clients.openWindow(target.href);
  }));
});
