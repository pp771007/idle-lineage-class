/* ============================================================================
 * sw.js — PWA Service Worker：程式桶 / 圖桶「分離快取」
 *
 * 兩個快取桶,刻意分開,這樣「改程式不會害人重載 30MB 圖」：
 *   ● 程式桶 CODE_CACHE：index.html + 所有外掛 js + 遊戲 js/css(含 tailwind-built.css) + manifest + PWA 圖示 + 外部 CDN(placehold)。
 *       桶名固定(比照圖桶),「不」隨版本換名:程式檔已用 ?v=(逐檔內容 sha)定址,換版即換 URL,
 *       cache-first 自然抓新版;沒改到的檔 URL 沒變、快取直接續用 → 一次更新只重新下載真的有改的那幾個檔。
 *       (舊設計「桶名=CODE_VERSION、activate 整桶倒掉」害每次發版全站 ~4MB 重載,已廢。老玩家升上來
 *        走「懶搬家」:cacheFirst 在固定桶 miss 時翻舊制 code-<hash> 桶,命中就搬進固定桶直接回用,
 *        不用重新下載;舊桶等頁面載完由 reconcileCode 收尾刪除。)
 *       舊版殘留 entry(?v= 已變的 js/css)由頁面(afk-pwa)每次載入送「現行引用清單」來對帳清掉(reconcileCode)。
 *       CODE_VERSION 仍由 scripts/stamp-sw-version.mjs 依「全部程式檔內容 hash」自動覆寫——它現在只負責
 *       「讓 sw.js 位元組變動 → 瀏覽器偵測到新版 SW」這件事,不再當桶名。
 *       ▸ 「導覽文件」(index.html / 目錄 '/')走 network-first：線上一律抓最新「殼」,根除 cache-first 把舊版釘死、
 *         又得靠 SW 換版才更新得了的老問題(iOS 換版尤其不穩);離線/網路慢退快取,離線遊玩照常(見 navFirst)。
 *       ▸ js / manifest / 圖示走 cache-first：它們帶 ?v= 版本號,換版即換 URL,撲空就抓新、不會被釘舊版,故維持 cache-first(秒開、省流量)。
 *   ● 圖桶 IMG_CACHE：assets/ 全部圖。cache-first＋連網補抓(on-demand)——用到才抓、不預抓整包。
 *       桶名 IMG_VERSION 是「固定不變」的快取名(不再隨改版 bump、不整桶倒掉)。
 *       失效改走「逐張對帳」：assets-manifest.json 每張圖帶一個 git blob sha,SW 記下「自己快取的是哪個 sha」;
 *       頁面(afk-pwa)每次載入送來最新 manifest → SW 比對 → 只刪掉 sha 對不上的那幾張(reconcileImages),
 *       不碰其餘的圖 → 作者換一張圖只重抓那一張,不會害人重載整包 30MB。
 *       沒記過 sha 的舊快取(本機制上線前就存在的)→ 用實際 bytes 算 sha 補對帳,相符就補記、不符才清。
 *
 * 更新控制：
 *   - 導覽走 network-first → 線上開頁本來就是最新程式碼,SW 何時換版不影響使用者看到的畫面。
 *   - 新版 sw.js 安裝後「停在 waiting」,等所有分頁/App 關閉後自然接手(⚠️ 刻意不 skipWaiting,
 *     原因見 activate 前的說明——強行交接會和頁面的常駐請求互等死鎖,把更新後的第一次重整/登出卡住幾十秒)。
 *     導覽 network-first＋js/css 以 ?v= 定址 → 舊 SW 服務新內容零差異,晚點接手沒有任何代價。
 *
 * 圖桶失效走 reconcileImages 逐張對帳(見上);不再背景預抓——圖片一律 on-demand 用到才抓、不主動下載整包。
 * ========================================================================== */
const CODE_VERSION = 'code-652c2c961f34';   // ← scripts/stamp-sw-version.mjs 自動覆寫,勿手改(只用來讓 sw.js 內容變動→觸發更新偵測,不是桶名)
const BUILD_ID     = '0718-1349'; // ← stamp 在 CODE_VERSION 變動時一起更新成台灣時間 MMDD-HHMM(僅供畫面辨識版本)
const IMG_VERSION  = 'img-v3';    // 固定桶名,不再 bump(失效改走逐張對帳,見 reconcileImages)
const CODE_CACHE = 'code-v1';     // 固定桶名,不隨版本換(檔案以 ?v= 定址;殘留由 reconcileCode 對帳清掉)
const IMG_CACHE  = IMG_VERSION;

// 圖桶內一個合成 entry,存「path → 已快取版本的 git blob sha」對照表,供逐張對帳判斷哪張該重抓。
const IMG_HASH_KEY = '/__afk-img-hashes__';
// 圖桶內另一個合成 entry,存「assets/anim/<怪>資料夾 → 已快取版本的合併 sha」,供動畫幀逐「怪」對帳(見 reconcileAnim)。
const ANIM_HASH_KEY = '/__afk-anim-hashes__';

// 外部 CDN：離線也要能用,用 cache-first 收進程式桶(opaque 也存)。
//   placehold.co=怪物圖載入失敗的備援圖。(Tailwind 已由作者改成本機 css/tailwind-built.css,
//   走 .css 副檔名進程式桶,不再需要列外部主機;原本的 cdn.tailwindcss.com 已移除。)
const EXTERNAL_HOSTS = ['placehold.co'];

// 導覽文件 network-first:有快取墊底時,等網路最多這麼久還沒回就先回快取(背景仍把快取更新到最新)。
//   離線時 fetch 會更快直接失敗、不會等滿這段;這只是「連得到但很慢/卡住」時不讓開場被網路拖死的安全閥。
const NAV_TIMEOUT_MS = 4000;

// ⚠️ 這裡「刻意沒有 install + skipWaiting」——新版 SW 停在 waiting,等所有分頁/App 關閉後自然接手。
//   skipWaiting 會死鎖(2026-07-15 headless 實測 3 次中 2 次重現):主選單 BGM 是 <audio> Range 串流、
//   登入畫面立繪逐幀輪播,頁面永遠有進行中的 fetch 事件 → 舊 SW 靜不下來、交接一直 pending;
//   此時使用者按重整/登出 → 導覽等交接、交接等頁面安靜、頁面等導覽完成才卸載 → 三方互等,
//   卡到導覽逾時(45 秒以上)。這正是「每次更新後首頁/登出要等很久」的另一半成因(前一半是舊制整桶倒掉)。
//   晚接手沒有代價:導覽 network-first＋?v= 定址,舊 SW 服務新內容零差異;新 SW 的快取策略改動
//   等 App 下次重啟生效即可。(代價僅剩:若還有人卡在 2026-06-24 前的舊 cache-first SW,要多一次
//   「關閉再開」才會換到 network-first;該批使用者事實上早已換完。)

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    // 舊制「桶名=版本號」的程式桶(code-<hash>)「不」在這裡刪:它是懶搬家的來源(見 cacheFirst 的
    //   legacy 翻找),等頁面載完、該搬的都搬進固定桶後,由 reconcileCode 收尾刪除。
    //   (不把搬家寫在 activate 的原因:遊戲頁面持續在發請求,舊 SW 一直有進行中的 fetch 事件,
    //    skipWaiting 的交接會被拖到不知何時,activate 的執行時機完全不可控——實測過會卡住。)
    //   其餘不明桶照舊清掉。
    await Promise.all(keys
      .filter((k) => k !== CODE_CACHE && k !== IMG_CACHE && !/^code-/.test(k))
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  const d = e.data || {};
  // 沒有 skip-waiting 訊息:現行頁面不會送;舊版頁面殘留的送過來也一律忽略(skipWaiting 會觸發上述死鎖)。
  if (d.type === 'reconcile-images' && Array.isArray(d.manifest)) {
    e.waitUntil(reconcileImages(d.manifest, e.source));
  }
  if (d.type === 'reconcile-anim' && Array.isArray(d.folders)) {
    e.waitUntil(reconcileAnim(d.folders, e.source));
  }
  if (d.type === 'reconcile-code' && Array.isArray(d.keep)) {
    e.waitUntil(reconcileCode(d.keep));
  }
});

// 程式桶對帳:桶名固定不隨版本換 → 換版後「舊 ?v= 的 js/css」會殘留在桶裡佔空間。
//   頁面(afk-pwa)每次載入把「現行 index.html 實際引用的 js/css URL 清單」送進來,
//   只清「同源、副檔名 .js/.css、且不在清單上」的 entry;殼(index.html)/manifest/PWA 圖示/外部 CDN
//   一律不動(它們量小、URL 穩定,且不在清單的判斷範圍,誤刪風險為零)。
async function reconcileCode(keep) {
  const keepSet = new Set();
  for (const u of keep) {
    try { const x = new URL(u, self.location.href); keepSet.add(x.pathname + x.search); } catch (err) { /* 壞 URL 略過 */ }
  }
  const cache = await caches.open(CODE_CACHE);
  for (const req of await cache.keys()) {
    let u; try { u = new URL(req.url); } catch (err) { continue; }
    if (u.origin !== self.location.origin) continue;
    if (!/\.(?:js|css)$/.test(u.pathname)) continue;
    if (!keepSet.has(u.pathname + u.search)) await cache.delete(req);
  }
  // 舊制 code-<hash> 桶收尾:此訊息由頁面「載入完成後」送來,頁面需要的檔早已在載入期間
  //   經 cacheFirst 的懶搬家進了固定桶,舊桶剩的都是用不到的舊版 → 整桶刪掉。
  for (const k of await caches.keys()) {
    if (/^code-/.test(k) && k !== CODE_CACHE) await caches.delete(k);
  }
  // 無版號 entry(manifest.webmanifest / PWA 圖示,URL 沒帶 ?v=)的刷新:桶名固定後沒有「整桶倒掉」
  //   兜底了,靠「CODE_VERSION 變了(=有發版)才清掉這幾個、下次用到重抓」,與舊行為等價但只刷這幾 KB。
  const VER_KEY = '/__afk-code-version__';
  let prevVer = '';
  try { const r = await cache.match(VER_KEY); if (r) prevVer = await r.text(); } catch (err) { /* 壞了當沒記過 */ }
  if (prevVer !== CODE_VERSION) {
    for (const req of await cache.keys()) {
      let u; try { u = new URL(req.url); } catch (err) { continue; }
      if (u.origin !== self.location.origin) continue;
      if (/\.webmanifest$/.test(u.pathname) || /pwa-icon[^/]*\.png$/.test(u.pathname)) await cache.delete(req);
    }
    await cache.put(VER_KEY, new Response(CODE_VERSION)).catch(() => {});
  }
}

// manifest 每筆可能是 [path, sha](新格式)或純 path 字串(舊格式/降級)→ 統一成 {path, sha}。
function manifestEntries(manifest) {
  return (manifest || []).map((e) => (Array.isArray(e) ? { path: e[0], sha: e[1] } : { path: e, sha: null }));
}

// git blob sha(跟 GitHub 樹狀 API 同演算法):sha1("blob "+len+"\0"+bytes)。
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
//   - 內容對不上(作者換過該圖)→ 清掉舊圖,下次 on-demand 用到才抓新版。
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

async function readAnimHashes(cache) {
  try {
    const res = await cache.match(ANIM_HASH_KEY);
    if (res) return await res.json();
  } catch (err) { /* 壞了當空表重建 */ }
  return {};
}
// 回傳「有沒有寫進去」而不是往外拋:失敗往外拋會把整支 reconcileAnim 帶走(其餘 4 個 cache.put 一律掛 catch,
//   這支原本漏了)。呼叫端要靠這個布林決定「敢不敢清圖」——記不住就不能清,見 reconcileAnim。
async function writeAnimHashes(cache, map) {
  try {
    await cache.put(ANIM_HASH_KEY, new Response(JSON.stringify(map), { headers: { 'content-type': 'application/json' } }));
    return true;
  } catch (err) { return false; }
}

// 怪物動畫幀逐「怪」對帳:anim/ 幀太多不進逐張 manifest(見檔頭),改用 anim-manifest.json——
//   每個 assets/anim/<怪>/ 資料夾一個「合併 sha」(幀有增/刪/換該 sha 就變)。SW 記下「自己快取的某怪是哪個 sha」,
//   比對後只把「sha 對不上的那一隻怪」整包快取清掉(下次看到該怪時 on-demand 抓新版),不碰其他怪、不重載整包 62MB。
//   ▸ 首次上線(還沒記過任何 anim 雜湊):對「已快取過的怪」一律先清一次再記(因無從得知舊快取是否過期)——
//     這正是修掉「換過的動畫幀卡舊快取」的一次性代價,清掉的只在玩家下次看到該怪時才 on-demand 重抓。
//   ▸ 沒快取過的怪:只記雜湊、不動作,日後該怪被換才會觸發清除。
//   ▸ 作者移除的怪(不在 manifest):連快取帶記錄一起清掉。
async function reconcileAnim(folders, client) {
  const wanted = new Map(folders.filter((e) => Array.isArray(e) && e[1]).map((e) => [e[0], e[1]]));
  const cache = await caches.open(IMG_CACHE);
  const recorded = await readAnimHashes(cache);

  // 走訪一次圖桶,把已快取的動畫幀依「資料夾」分組,避免每個資料夾各掃一次全桶。anim=怪物幀、classanim=職業戰鬥幀(v3.0.67),同走一資料夾一雜湊。
  // ⚠️ cache.keys() 在「筆數夠多」的桶上會拋 Operation too large(玩家實機:圖桶塞滿動畫幀後必炸,
  //    而同一 SW 的 reconcileImages 不用 keys() 故安然無恙——「圖片有記錄、怪物無記錄」就是這支死掉的鐵證)。
  //    列舉不到 = 不知道哪些幀在快取裡,此時「清掉」與「採信」都是瞎猜 → 什麼都不做,維持現狀。
  let entries;
  try { entries = await cache.keys(); }
  catch (err) {
    if (client) client.postMessage({ type: 'reconcile-anim-done', evicted: 0, skipped: 'keys: ' + (err && err.message || err) });
    return;
  }
  const byFolder = new Map();
  for (const req of entries) {
    let path; try { path = decodeURIComponent(new URL(req.url).pathname); } catch (err) { continue; }  // 中文資料夾名在 URL 是 %XX,要 decode 才對得上 manifest 的原始名
    const m = path.match(/\/(assets\/(?:anim|classanim)\/[^/]+)\//);
    if (!m) continue;
    if (!byFolder.has(m[1])) byFolder.set(m[1], []);
    byFolder.get(m[1]).push(req);
  }
  async function evictFolder(folder) {
    const reqs = byFolder.get(folder);
    if (!reqs) return 0;
    for (const r of reqs) await cache.delete(r);
    return reqs.length;
  }

  // 動手清之前,先確認這台機器「記得住」:拿現有記錄試寫一次,寫不進去就一張都別清。
  //   原本是「先清光 → 再寫記錄」,寫入一失敗記錄就永遠是空的 → 下次載入每隻怪又全部對不上 → 再清一次
  //   → 無限重抓(玩家回報「每次更新怪物圖都要重載」的成因之一)。清得掉卻記不住,比不清還糟。
  if (!(await writeAnimHashes(cache, recorded))) {
    if (client) client.postMessage({ type: 'reconcile-anim-done', evicted: 0, skipped: '記錄寫不進去,不敢清' });
    return;
  }

  let evicted = 0;
  for (const [folder, sha] of wanted) {
    if (recorded[folder] === sha) continue;   // 記錄相符 → 該怪是最新,跳過
    evicted += await evictFolder(folder);     // 換過 / 首次未記過且有快取 → 清該怪快取(下次 on-demand 抓新)
    recorded[folder] = sha;                    // 記成最新(沒快取的怪也記,日後才偵測得到變動)
  }
  for (const folder of Object.keys(recorded)) {  // 作者移除的怪 → 清快取與記錄
    if (!wanted.has(folder)) { evicted += await evictFolder(folder); delete recorded[folder]; }
  }
  await writeAnimHashes(cache, recorded);
  if (client) client.postMessage({ type: 'reconcile-anim-done', evicted });
}

// cache-first + 連網補存。只存 status 200 或 opaque(跨網域);206(Range 部分回應,如 <audio> 串流音檔)
//   不能進 Cache(cache.put 對 206 會 reject:Partial response unsupported)→ 必須排除,否則丟出未捕捉的 rejection。
//   put 一律掛 .catch:任何寫入失敗(配額滿/極端 race)都不該變成頁面端看到的錯誤、也不該影響回傳 res。
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  // 程式桶 miss → 先翻「舊制 code-<hash> 桶」(桶名綁版本的舊設計)懶搬家:同 URL 的檔內容必同
  //   (?v= 就是內容 sha),搬進固定桶直接回用,免重新下載。舊桶由 reconcileCode 在頁面載完後收尾刪除,
  //   刪完後這段只多一次 caches.keys()(比對不到 code- 舊桶,零額外 IO)。
  if (cacheName === CODE_CACHE) {
    for (const k of await caches.keys()) {
      if (k === CODE_CACHE || !/^code-/.test(k)) continue;
      const legacy = await (await caches.open(k)).match(req);
      if (legacy) {
        cache.put(req, legacy.clone()).catch(() => {});
        return legacy;
      }
    }
  }
  try {
    const res = await fetch(req);
    if (res && (res.status === 200 || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const fallback = await cache.match(req);
    if (fallback) return fallback;
    throw err;
  }
}

// 導覽文件 network-first(配合 fetch 分流):線上拿最新殼、離線退快取。
//   ① 有快取墊底 → 等網路最多 NAV_TIMEOUT_MS:拿到最新就回最新;逾時/失敗先回快取,
//      但背景那筆 fetch 會繼續把快取更新到最新(下次載入就新),不讓慢網路把開場卡死。
//   ② 沒有快取(第一次載入)→ 只能等網路;離線就如實 throw(瀏覽器顯示無法連線,屬正常)。
//   ③ 寫快取用「去掉 query 的路徑」當 key → ?__afkfresh / ?cb 等變體不會在桶裡累積,離線退快取也用 ignoreSearch 找得到。
async function navFirst(e, req) {
  const cache = await caches.open(CODE_CACHE);
  const u = new URL(req.url);
  const putKey = u.origin + u.pathname;
  const netP = fetch(req).then((res) => {
    if (res && res.ok) cache.put(putKey, res.clone()).catch(() => {});
    return res;
  });
  e.waitUntil(netP.catch(() => {}));   // 背景抓取+寫快取確保跑完,不被 SW 提早回收

  const cached = await cache.match(req, { ignoreSearch: true })
              || await cache.match(putKey)
              || await cache.match('index.html')
              || await cache.match('./');
  if (!cached) return netP;            // 沒有墊底 → 等網路(離線會 throw,正常)

  const winner = await Promise.race([
    netP.catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT_MS)),
  ]);
  return (winner && winner.ok) ? winner : cached;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  const sameOrigin = url.origin === self.location.origin;

  // 音檔(bgm/sfx)不攔截:<audio> 走 Range 串流,回應是 206、本來就進不了 Cache(cache.put 對 206 會
  //   reject,離線行為不變);讓它流經 SW 只會讓 SW 掛著長壽的 fetch 事件(BGM 一放就是整首)、無法閒置。
  if (sameOrigin && /\/assets\/(?:bgm|sfx)\//.test(url.pathname)) return;

  // 圖桶:同源 assets 圖
  if (sameOrigin && url.pathname.includes('/assets/')) {
    e.respondWith(cacheFirst(req, IMG_CACHE));
    return;
  }

  // 導覽文件(整頁 navigate / 目錄 '/' / *.html)→ network-first:線上一律拿最新殼,離線退快取。
  const isNav = sameOrigin && (
    req.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    /\.html$/.test(url.pathname)
  );
  if (isNav) {
    e.respondWith(navFirst(e, req));
    return;
  }

  // 程式桶:js / css / manifest / PWA 圖示,以及外部 CDN → cache-first(帶 ?v= 版本號,換版即換 URL,不會被釘舊版)
  const isCodePath = sameOrigin && (
    /\.(?:js|css|webmanifest)$/.test(url.pathname) ||
    /pwa-icon[^/]*\.png$/.test(url.pathname)
  );
  if (isCodePath || EXTERNAL_HOSTS.includes(url.hostname)) {
    e.respondWith(cacheFirst(req, CODE_CACHE));
    return;
  }

  // 其餘(assets-manifest.json / version.json / 其它)→ 不攔截,直接走網路、永遠最新。
});
