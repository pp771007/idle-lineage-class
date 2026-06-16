/* ============================================================================
 * sw.js — 只快取「背景 / 場景大圖」的 Service Worker(cache-first)
 *
 * 為什麼要它:背景那幾張 3~4MB 的大圖,GitHub Pages 只給 max-age=600(10 分鐘)、
 *   而且每次我們 push 改版、Pages 重新部署就會換掉 ETag → 玩家下次開又重抓整張。
 *   把這些圖交給 SW 做 cache-first:第一次載過後吃本機快取,之後重整 / 回訪 / 我們改版
 *   通通秒出、不再重抓,也不受 Pages 那兩個限制影響。
 *
 * 安全範圍(這段是「不會害玩家卡舊版」的關鍵):
 *   - 只攔截「同源 + GET + 路徑含 /assets/background/」的請求 → cache-first。
 *   - index.html、所有 *.js(遊戲本體與全部外掛)、其它資源一律「不攔截」,直接走網路、永遠最新。
 *     → 所以改了遊戲碼 / 外掛照樣即時生效,SW 只碰那幾張裝飾用的大圖。
 *
 * 何時要 bump CACHE_VERSION:
 *   - 只有「原作者換掉某張『既有同名』背景圖的內容」時才需要(很少見)。bump 後舊快取會在新 SW
 *     啟用時清掉、重新抓最新。
 *   - 日常新增背景圖(新檔名)不需要 bump:URL 不一樣,本來就會去抓新的。
 * ========================================================================== */
const CACHE_VERSION = 'bg-v3';
const SCENE_PATH = '/assets/background/';

self.addEventListener('install', () => {
  self.skipWaiting();   // 新版 SW 裝好立刻接管,不等舊分頁全關
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));   // 清掉舊版快取
    await self.clients.claim();   // 立刻接管現有分頁
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;       // 只管自家網域(CDN / 字型等放行)
  if (url.pathname.indexOf(SCENE_PATH) === -1) return;   // 只管背景 / 場景大圖;其餘(含 index.html / 外掛 JS)一律放行

  e.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const hit = await cache.match(req);
    if (hit) return hit;                                  // cache-first:本機有就直接給,不連網
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());       // 第一次抓到(200)才存起來
    return res;
  })());
});
