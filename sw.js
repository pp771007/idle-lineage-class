/* ============================================================================
 * sw.js — PWA Service Worker：程式桶 / 圖桶「分離快取」
 *
 * 兩個快取桶,刻意分開,這樣「改程式不會害人重載 30MB 圖」：
 *   ● 程式桶 CODE_CACHE：index.html + 所有外掛 js + manifest + PWA 圖示 + 外部 CDN(Tailwind/placehold)。
 *       cache-first；版本 CODE_VERSION 由 scripts/stamp-sw-version.mjs 依「index.html＋全部外掛 js 的內容 hash」
 *       自動覆寫 → 程式一變就換新桶 → 瀏覽器偵測到 sw.js 變了 → 觸發更新流程(由頁面 afk-pwa.js 決定何時接管)。
 *   ● 圖桶 IMG_CACHE：assets/ 全部圖。cache-first＋連網補抓(on-demand)＋可由頁面驅動「背景全預抓」。
 *       桶名 IMG_VERSION 是「固定不變」的快取名(不再隨改版 bump、不整桶倒掉)。
 *       失效改走「逐張對帳」：assets-manifest.json 每張圖帶一個 git blob sha,SW 記下「自己快取的是哪個 sha」;
 *       頁面(afk-pwa)每次載入送來最新 manifest → SW 比對 → 只刪掉 sha 對不上的那幾張(reconcileImages),
 *       不碰其餘的圖 → 作者換一張圖只重抓那一張,不會害人重載整包 30MB。
 *       沒記過 sha 的舊快取(本機制上線前就存在的)→ 用實際 bytes 算 sha 補對帳,相符就補記、不符才清。
 *
 * 更新控制(配合 afk-pwa.js 的自動更新 checkbox)：
 *   - install 不自動 skipWaiting。首次安裝(沒有舊 SW 控制)會自動啟用；之後的更新會停在 waiting,
 *     由頁面送 'skip-waiting' 訊息才接管 → 達成「自動更新 / 手動更新」由使用者偏好決定。
 *
 * 背景預抓：頁面送 {type:'precache-images', manifest:[[path,sha],...]} → 此處分批抓進圖桶並回報進度,讓安裝後可完全離線。
 * ========================================================================== */
const CODE_VERSION = 'code-dcfa6f480335';   // ← scripts/stamp-sw-version.mjs 自動覆寫,勿手改
const BUILD_ID     = '0623-1606'; // ← stamp 在 CODE_VERSION 變動時一起更新成台灣時間 MMDD-HHMM(僅供畫面辨識版本)
const IMG_VERSION  = 'img-v3';    // 固定桶名,不再 bump(失效改走逐張對帳,見 reconcileImages)
const CODE_CACHE = CODE_VERSION;
const IMG_CACHE  = IMG_VERSION;

// 圖桶內一個合成 entry,存「path → 已快取版本的 git blob sha」對照表,供逐張對帳判斷哪張該重抓。
const IMG_HASH_KEY = '/__afk-img-hashes__';

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
  if (d.type === 'reconcile-images' && Array.isArray(d.manifest)) {
    e.waitUntil(reconcileImages(d.manifest, e.source));
    return;
  }
  if (d.type === 'precache-images' && Array.isArray(d.manifest || d.urls)) {
    e.waitUntil(precacheImages(d.manifest || d.urls, e.source));
  }
});

// manifest 每筆可能是 [path, sha](新格式)或純 path 字串(舊格式/降級)→ 統一成 {path, sha}。
function manifestEntries(manifest) {
  return (manifest || []).map((e) => (Array.isArray(e) ? { path: e[0], sha: e[1] } : { path: e, sha: null }));
}

// git blob sha(跟 GitHub 樹狀 API、sync-upstream 同演算法):sha1("blob "+len+"\0"+bytes)。
async function gitBlobSha(buf) {
  const bytes = new Uint8Array(buf);
  const header = new TextEncoder().encode('blob ' + bytes.length + '\x00');
  const all = new Uint8Array(header.length + bytes.length);
  all.set(header, 0);
  all.set(bytes, header.length);
  const digest = await crypto.subtle.digest('SHA-1', all);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function readImgHashes(cache) {
  try {
    const res = await cache.match(IMG_HASH_KEY);
    if (res) return await res.json();
  } catch (err) { /* 壞了當空表重建 */ }
  return {};
}
async function writeImgHashes(cache, map) {
  await cache.put(IMG_HASH_KEY, new Response(JSON.stringify(map), { headers: { 'content-type': 'application/json' } }));
}

// 逐張對帳:比對「快取記錄的 sha」與「最新 manifest 的 sha」,只清掉對不上的那幾張(下次 on-demand/預抓再抓新的)。
//   - 記錄相符 → 一定是最新,跳過(快路徑,不讀 bytes)。
//   - 沒記過 sha 的舊快取 → 用實際 bytes 算 sha:相符就補記、不符才清(讓本機制上線前的舊快取也能被healed)。
//   - 作者已移除的圖(不在 manifest)→ 連快取帶記錄一起清掉。
async function reconcileImages(manifest, client) {
  const entries = manifestEntries(manifest);
  const cache = await caches.open(IMG_CACHE);
  const hashes = await readImgHashes(cache);
  const manifestPaths = new Set(entries.map((en) => en.path));
  let evicted = 0;
  for (const en of entries) {
    if (!en.sha) continue;                          // manifest 沒帶 sha 無從比對
    if (hashes[en.path] === en.sha) continue;       // 記錄相符 → 最新
    const cached = await cache.match(en.path);
    if (!cached) { if (en.path in hashes) delete hashes[en.path]; continue; }  // 沒快取 → 之後抓的就是新的
    if (hashes[en.path] === undefined) {
      let actual = null;
      try { actual = await gitBlobSha(await cached.clone().arrayBuffer()); } catch (err) { /* 算不出當作要清 */ }
      if (actual === en.sha) { hashes[en.path] = en.sha; continue; }   // 舊快取內容其實是最新 → 補記、免重抓
    }
    await cache.delete(en.path);                    // 內容對不上 → 清掉舊圖
    delete hashes[en.path];
    evicted++;
  }
  for (const path of Object.keys(hashes)) {         // 作者移除的圖 → 清快取與記錄
    if (!manifestPaths.has(path)) { await cache.delete(path); delete hashes[path]; evicted++; }
  }
  await writeImgHashes(cache, hashes);
  if (client) client.postMessage({ type: 'reconcile-done', evicted });
}

// 背景把圖桶抓滿:分批、跳過已是最新的,逐批回報進度給發起的分頁。順手把每張的 sha 記進對照表。
async function precacheImages(manifest, client) {
  const entries = manifestEntries(manifest);
  const cache = await caches.open(IMG_CACHE);
  const hashes = await readImgHashes(cache);
  const total = entries.length;
  let done = 0;
  const BATCH = 8;
  for (let i = 0; i < total; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    await Promise.all(batch.map(async (en) => {
      try {
        const cached = await cache.match(en.path);
        // 對不上(沒快取、或記錄的 sha≠manifest)就重抓。不樂觀補記:沒記過 sha 的舊快取交給 reconcile
        // 用實際 bytes 驗證,這裡若硬補記可能把破損期殘留的舊圖誤標成最新。
        const stale = !cached || (en.sha && hashes[en.path] !== en.sha);
        if (stale) {
          const res = await fetch(en.path, { cache: 'no-cache' });
          if (res && (res.ok || res.type === 'opaque')) {
            await cache.put(en.path, res.clone());
            if (en.sha) hashes[en.path] = en.sha;
          }
        }
      } catch (err) { /* 單張失敗不中斷整批 */ }
      done++;
    }));
    if (client) client.postMessage({ type: 'precache-progress', done, total });
  }
  await writeImgHashes(cache, hashes);
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
