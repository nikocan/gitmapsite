// Online navigation always uses the latest release. API requests and projects stay outside the cache.
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.mode !== "navigate" || request.destination !== "document") return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || ![scope.pathname, scope.pathname + "index.html"].includes(url.pathname)) return;
  event.respondWith(fetch(request).catch(() => new Response(
    '<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gitmapp · Çevrimdışı</title><body style="background:#101111;color:#eee;font:1rem system-ui;padding:12vw"><h1>Bağlantı bekleniyor</h1><p>Stüdyoya dönmek için internet bağlantınızı kontrol edin.</p><a style="color:#e4ff3d" href="">Yeniden dene</a></body></html>',
    {status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}}
  )));
});
