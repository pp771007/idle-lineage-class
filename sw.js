/* ============================================================================
 * sw.js — PWA Service Worker：程式桶 / 圖桶「分離快取」
 *
 * 兩個快取桶,刻意分開,這樣「改程式不會害人重載 30MB 圖」：
 *   ● 程式桶 CODE_CACHE：index.html + 所有外掛 js + manifest + PWA 圖示 + 外部 CDN(Tailwind/placehold)。
 *       cache-first；版本 CODE_VERSION 由 scripts/stamp-sw-version.mjs 依「index.html＋全部外掛 js 的內容 hash」
 *       自動覆寫 → 程式一變就換新桶 → 瀏覽器偵測到 sw.js 變了 → 觸發更新流程(由頁面 afk-pwa.js 決定何時接管)。
 *   ● 圖桶 IMG_CACHE：assets/ 全部圖。cache-first＋連網補抓(on-demand)＋可由頁面驅動「背景全預抓」。
 *       版本 IMG_VERSION 只在「既有圖被作者換掉內容」時才 bump(承接舊 bg 快取機制) → 程式更新完全不動圖桶。
 *
 * 更新控制(配合 afk-pwa.js 的自動更新 checkbox)：
 *   - install 不自動 skipWaiting。首次安裝(沒有舊 SW 控制)會自動啟用；之後的更新會停在 waiting,
 *     由頁面送 'skip-waiting' 訊息才接管 → 達成「自動更新 / 手動更新」由使用者偏好決定。
 *
 * 背景預抓：頁面送 {type:'precache-images', urls:[...]} → 此處分批抓進圖桶並回報進度,讓安裝後可完全離線。
 * ========================================================================== */
const CODE_VERSION = 'code-1bebd1fe279d';   // ← scripts/stamp-sw-version.mjs 自動覆寫,勿手改
const BUILD_ID     = '0622-0953'; // ← stamp 在 CODE_VERSION 變動時一起更新成台灣時間 MMDD-HHMM(僅供畫面辨識版本)
const IMG_VERSION  = 'img-v3';    // 既有圖被換才 +1(承接舊 bg-v3)
const CODE_CACHE = CODE_VERSION;
const IMG_CACHE  = IMG_VERSION;

// 外部 CDN：離線也要能用(Tailwind 沒了整個版面會爆),用 cache-first 收進程式桶(opaque 也存)。
const EXTERNAL_HOSTS = ['cdn.tailwindcss.com', 'placehold.co'];

self.addEventListener('install', () => {
  // 不 skipWaiting：首次安裝會自動啟用;更新則停 waiting,等頁面決定何時接管(自動/手動更新)。
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CODE_CACHE && k !== IMG_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d === 'skip-waiting' || d.type === 'skip-waiting') { self.skipWaiting(); return; }
  if (d.type === 'get-version') { if (e.source) e.source.postMessage({ type: 'version', code: CODE_VERSION, build: BUILD_ID }); return; }
  if (d.type === 'precache-images' && Array.isArray(d.urls)) {
    e.waitUntil(precacheImages(d.urls, e.source));
  }
});

// 背景把圖桶抓滿:分批、跳過已快取的,逐批回報進度給發起的分頁。
async function precacheImages(urls, client) {
  const cache = await caches.open(IMG_CACHE);
  const total = urls.length;
  let done = 0;
  const BATCH = 8;
  for (let i = 0; i < total; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    await Promise.all(batch.map(async (u) => {
      try {
        if (!(await cache.match(u))) {
          const res = await fetch(u, { cache: 'no-cache' });
          if (res && (res.ok || res.type === 'opaque')) await cache.put(u, res.clone());
        }
      } catch (err) { /* 單張失敗不中斷整批 */ }
      done++;
    }));
    if (client) client.postMessage({ type: 'precache-progress', done, total });
  }
  if (client) client.postMessage({ type: 'precache-done', total });
}

// cache-first + 連網補存。ok(200)或 opaque(跨網域)都存。
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const fallback = await cache.match(req);
    if (fallback) return fallback;
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  const sameOrigin = url.origin === self.location.origin;

  // 圖桶:同源 assets 圖
  if (sameOrigin && url.pathname.includes('/assets/')) {
    e.respondWith(cacheFirst(req, IMG_CACHE));
    return;
  }

  // 程式桶:同源的 導覽/js/html/manifest/PWA 圖示,以及外部 CDN
  const isCodePath = sameOrigin && (
    req.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    /\.(?:js|html|webmanifest)$/.test(url.pathname) ||
    /pwa-icon[^/]*\.png$/.test(url.pathname)
  );
  if (isCodePath || EXTERNAL_HOSTS.includes(url.hostname)) {
    e.respondWith(cacheFirst(req, CODE_CACHE));
    return;
  }

  // 其餘(last-sync.json / assets-manifest.json / 其它)→ 不攔截,直接走網路、永遠最新。
});
