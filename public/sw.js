/* Offline shell for this MELA-hosted Savanna demo, never registered on unrelated hosts. */
const CACHE = "mela-public-v6-visual-teacher";
const PAGES = [
  "/jobs",
  "/support",
  "/docs",
  "/demo/digital-foundations",
  "/demo/blank.html",
  "/demo/sdk.html",
  "/savanna/pages/paced.html",
  "/savanna/pages/self-paced.html",
  "/savanna/pages/lesson.html",
  "/savanna/pages/homepage-v1-paced.html",
  "/savanna/pages/homepage-v1-self-paced.html",
  "/savanna/pages/concept-with-navigation.html",
  "/savanna/pages/offline-first-localized-ai.html",
  "/savanna/pages/programming-for-beginners.html",
];
const ASSETS = [
  "/db-assistant.js",
  "/avatar-view.js",
  "/savanna-integration.js",
  "/course-media.js",
  "/mela-sdk.js",
  "/sdk/index.js",
  "/sdk/react.js",
  "/transcripts/9hE5-98ZeCg.json",
  "/content.json",
  "/savanna/mela-integration.css",
  "/savanna/assets/css/application_alx.css",
  "/savanna/assets/css/app.css",
  "/savanna/assets/css/static-page.css",
  "/savanna/assets/css/typekit-xgz4ilr-css.css",
  "/savanna/assets/js/popper.js",
  "/savanna/assets/js/bootstrap.bundle.js",
  "/savanna/assets/js/static-page.js",
  "/savanna/assets/img/holberton-logo-full-alx.png",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const path of [...PAGES, ...ASSETS]) {
        try {
          const response = await fetch(path, { cache: "reload" });
          if (!response.ok) continue;
          await cache.put(path, response.clone());
          if (PAGES.includes(path)) {
            const html = await response.text();
            const assets = [
              ...html.matchAll(
                /(?:src|href)="(\/_next\/static\/[^"?]+(?:\?[^" ]*)?)"/g,
              ),
            ].map((match) => match[1].replaceAll("&amp;", "&"));
            for (const asset of new Set(assets)) {
              try {
                const r = await fetch(asset);
                if (r.ok) await cache.put(asset, r);
              } catch {}
            }
          }
        } catch {}
      }
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("mela-public-") && name !== CACHE)
          await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== location.origin ||
    request.headers.has("authorization") ||
    request.headers.has("rsc")
  )
    return;
  if (
    request.mode === "navigate" &&
    (url.pathname === "/" || url.pathname === "/learn")
  ) {
    event.respondWith(
      Response.redirect(
        new URL(
          url.pathname === "/learn"
            ? "/savanna/pages/concept-with-navigation.html"
            : "/savanna/pages/homepage-v1-self-paced.html",
          url.origin,
        ),
        302,
      ),
    );
    return;
  }
  const publicPage = PAGES.includes(url.pathname);
  const asset =
    ASSETS.includes(url.pathname) ||
    url.pathname === "/avatar/teacher-3d.js" ||
    url.pathname === "/avatar/storyboard.json" ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/savanna/assets/");
  if (!publicPage && !asset) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const key = publicPage ? url.pathname : request;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(key, response.clone());
        return response;
      } catch {
        return (await cache.match(key)) || Response.error();
      }
    })(),
  );
});
