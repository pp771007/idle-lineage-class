/* ============================================================================
 * sync-upstream.mjs — 自動把原作者最新 index.html 合併進本專案(供 GitHub Action 用)
 *
 * 做的事(等同手動「合併原版」流程,跑在 Linux runner 上,中文檔名直接用 URL 不必走 blob SHA):
 *   1. 抓原作者 GitHub Pages 的最新 index.html
 *   2. 把本專案六支外掛的 <script>(保留各自現有的 ?v= 版本號)插回 </body> 前
 *   3. 跟現有 index.html 比對 → 一模一樣就什麼都不做(changed=false)
 *   4. 比對原作者 repo 檔案樹,補下載本地缺少的 assets 新圖
 *   5. 把結果寫進 GITHUB_OUTPUT(changed / assets_added),由 workflow 決定要不要推
 *
 * 不在這裡 commit/push;那由 workflow 在「冒煙測試通過」後才做。
 * ========================================================================== */
import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { stampSwVersion } from './stamp-sw-version.mjs';

// 算 git blob SHA(跟 GitHub 樹狀 API 回的 .sha 同演算法),用來判斷既有 asset 內容有沒有被作者換過
function gitBlobSha(buf) {
  return createHash('sha1').update('blob ' + buf.length + '\0').update(buf).digest('hex');
}

// 所有下載都是逐檔序列跑,單一連線僵住就會卡死整條同步、把後續每 15 分的排程全堵在 concurrency 後面
// (2026-07-04 踩過:一輪卡 2 小時,站台停在舊版)→ 每個 fetch 一律帶逾時,逾時/網路錯誤重試幾次再放棄。
async function fetchRetry(url, opts = {}, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fetch(url, { ...opts, signal: AbortSignal.timeout(60_000) });
    } catch (e) {
      if (i >= tries) throw e;
      console.warn(`[warn] fetch 失敗(第 ${i}/${tries} 次,${e.name}: ${e.message}),重試: ${url}`);
    }
  }
}

const UPSTREAM_USER = 'shines871';
const REPO          = 'idle-lineage-class';
const UPSTREAM_HTML = `https://${UPSTREAM_USER}.github.io/${REPO}/index.html`;
const TREE_API      = `https://api.github.com/repos/${UPSTREAM_USER}/${REPO}/git/trees/main?recursive=1`;
const rawUrl = (p) => `https://raw.githubusercontent.com/${UPSTREAM_USER}/${REPO}/main/` +
                      p.split('/').map(encodeURIComponent).join('/');

// ⚠ 此陣列的「順序」會原樣寫進 index.html 的 <script>,有兩個「換順序會默默退化、測不出來」的點:
//   1) afk-extradata 建議在 afk-dex / afk-wiki 之前(它定義 AFK_EXTRA,後兩者讀;晚載最壞是補充
//      文字暫時讀不到、優雅降級,不會當掉)。
//   2) afk-fixes 建議在 afk-offline 之後——防呆包在最外層最乾淨(空白時最先擋、連 stamp 都不跑)。
//      註:就算順序反了,saveGame 空白角色防呆仍夾在「呼叫端→原作 saveGame」之間、照樣擋住毀檔
//      (已實測),只是 offline 的 stamp 在選單會多跑一次 no-op。真正會失去存檔保護的是「afk-fixes
//      整支沒載入」,不是順序錯。
//   重排前留意上面兩點即可。
const PLUGINS = [
  { file: 'afk-offline.js', comment: '離線掛機外掛(包 saveGame/loadGame;建議讓 afk-fixes 的存檔防呆排在此之後最乾淨;可獨立維護,原作者更新後重新加回此行即可)' },
  { file: 'afk-mobile.js',  comment: '手機版介面外掛(可獨立維護;原作者更新後重新加回此行即可)' },
  { file: 'afk-backnav.js', comment: '手機返回鍵/手勢:在「選存檔位/創角」子畫面回首頁(History API,無 DOM 掛點;可獨立維護,原作者更新後重新加回此行即可)' },
  { file: 'afk-slotinfo.js', comment: '選角畫面掛機資訊提供者(📍掛機地點/⏱已掛機時間;桌機附加渲染+手機共用資料源 AFK_SLOTINFO.read;可獨立維護,原作者更新後重新加回此行即可)' },
  { file: 'afk-extradata.js', comment: '共用補充資料(掉落查詢+小百科共用的手動清單;純資料無 DOM,需先於 dex/wiki 載入)' },
  { file: 'afk-dex.js',     comment: '怪物/掉落查詢外掛(可獨立維護;原作者更新後重新加回此行即可)' },
  { file: 'afk-wiki.js',    comment: '小百科外掛(專精/武器特性/職業魔法;可獨立維護,原作者更新後重新加回此行即可)' },
  { file: 'afk-fixes.js',   comment: '通用修正外掛(補原作者坑,桌機/手機通用;含 saveGame 空白角色防呆,建議排在 afk-offline 之後最乾淨——順序反了防呆仍擋得住毀檔,只是不夠乾淨;可獨立維護,原作者更新後重新加回此行即可)' },
  { file: 'afk-sw.js',      comment: '背景大圖快取 Service Worker 註冊(可獨立維護;原作者更新後重新加回此行即可)' },
  { file: 'afk-toast.js',   comment: '手機 toast 提示(點按鈕的系統日誌訊息浮現;可獨立維護,原作者更新後重新加回此行即可)' },
  { file: 'afk-statpts.js', comment: '能力值面板補點數分解 始/升/藥/總(可獨立維護;原作者更新後重新加回此行即可)' },
  { file: 'afk-syncinfo.js', comment: '首頁顯示原版最後同步時間(可獨立維護;原作者更新後重新加回此行即可)' },
  { file: 'afk-ui.js',       comment: '統一自製彈窗:全域接管 window.alert(可獨立維護;原作者更新後重新加回此行即可)' },
  { file: 'afk-autobuy.js',  comment: '外掛自動購買:肉 / 魔法屏障卷軸(可獨立維護;原作者更新後重新加回此行即可)' },
  { file: 'afk-pwa.js',      comment: 'PWA:安裝成免網路遊玩 + 自動/手動更新 + 背景預抓離線資源(可獨立維護;原作者更新後重新加回此行即可)' },
  { file: 'afk-storage.js',  comment: '首頁設定鈕:檢查存檔大小(純唯讀列出 localStorage 各 key 用量;可獨立維護,原作者更新後重新加回此行即可)' },
  { file: 'afk-history.js',  comment: '離線掛機歷史紀錄:首頁設定選單列出各角色最近 5 筆離線收益(純唯讀讀 afk_hist_<slot>;可獨立維護,原作者更新後重新加回此行即可)' },
  { file: 'afk-mobname.js',  comment: '顯示怪物名稱模式:首頁設定選單三選一(全部常駐/鎖定中常駐/原版;純 CSS+body 屬性;可獨立維護,原作者更新後重新加回此行即可)' },
  { file: 'afk-training.js', comment: '木人場:選怪→打不死木人→量即時DPS(純測試,效果只在 afk_dummy 假地圖,不擋存檔、離線不結算;可獨立維護,原作者更新後重新加回此行即可)' },
  { file: 'afk-analytics.js', comment: 'Cloudflare Web Analytics beacon 注入:統計人數/開啟次數(只在正式站台送;可獨立維護,原作者更新後重新加回此行即可)' },
  { file: 'afk-skin.js', comment: '首頁「加掛版」品牌標記 + 外掛區外框(純視覺;需排在其他 afk-* 之後;可獨立維護,原作者更新後重新加回此行即可)' },
];

// 我們自己放在 assets/ 底下、非上游的檔案白名單(孤兒清理時略過,不會被當「作者移除的圖」刪掉)。
//   目前為空:本專案自有圖示(favicon / pwa-icon-*)都在「根目錄」、不在 assets/。將來若在 assets/ 放自有圖,把路徑加進這裡。
const OWN_ASSETS = new Set([]);

function setOutput(k, v) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
  console.log(`[out] ${k}=${v}`);
}

const ghHeaders = process.env.GH_TOKEN
  ? { Authorization: `Bearer ${process.env.GH_TOKEN}`, 'User-Agent': 'sync-upstream' }
  : { 'User-Agent': 'sync-upstream' };

// 1. 抓原版 index.html
const upstream = await fetchRetry(UPSTREAM_HTML, { cache: 'no-store' }).then((r) => {
  if (!r.ok) throw new Error('抓原版 index.html 失敗: HTTP ' + r.status);
  return r.text();
});
if (!upstream.includes('</body>')) throw new Error('原版 index.html 找不到 </body>,中止');
for (const p of PLUGINS) {
  if (upstream.includes(p.file)) throw new Error('原版竟已含外掛 ' + p.file + ',中止(避免重複插入)');
}

// 2. 讀現有 index.html,擷取各外掛現有的 ?v= 版本號保留下來
const current = existsSync('index.html') ? readFileSync('index.html', 'utf8') : '';
const block = PLUGINS.map((p) => {
  const m = current.match(new RegExp(p.file.replace('.', '\\.') + '(\\?v=[^"\\s]*)?'));
  const ver = m && m[1] ? m[1] : '';
  return `<!-- ${p.comment} -->\n<script src="${p.file}${ver}"></script>`;
}).join('\n') + '\n';

// === 同步作者外部子資源(作者已把遊戲程式碼/樣式從單一 index.html 拆成 js/*.js 與 css/*.css)===
//   同步必須一起把這些檔抓進來,否則:缺 js → 遊戲全域(DB/tick/saveGame…)全無、外掛掛不上(smoke 擋);缺 css → 背景/版面樣式掉光(白底)。
//   防「作者改了檔、玩家卻讀到舊快取」:每個檔都用「內容 sha1」當 ?v= 掛在 index.html 引用上——內容一變 hash 就變
//   → URL 變 → 瀏覽器 / PWA(sw.js 對 .js/.css 走 cache-first 且尊重 query)一定重抓新版,不會讀到舊的;沒變的維持 hash、續用快取。
//   作者日後新增/改名/移除這些檔都自動跟上(順著 index.html 的引用走 + 清孤兒)。
const SUBRES_DIRS = ['js', 'css'];
// 引用可能帶作者自己的 ?v= query(如 js/19-equipment-window.js?v=20260702c)——比對要容許 query、只擷取路徑,
// 否則帶 query 的新檔會被漏抓,站台 404(裝備視窗踩過 2026-07-02)。
const SUBRES_RE = new RegExp('(?:src|href)="((?:' + SUBRES_DIRS.join('|') + ')\\/[^"?]+\\.(?:js|css))(?:\\?[^"]*)?"', 'g');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const subFiles = [...new Set([...upstream.matchAll(SUBRES_RE)].map((m) => m[1]))];
const subAdded = [], subChanged = [], subRemoved = [];
const subHash = {};
for (const path of subFiles) {
  const buf = Buffer.from(await fetchRetry(`https://${UPSTREAM_USER}.github.io/${REPO}/` + path.split('/').map(encodeURIComponent).join('/'),
    { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error('抓 ' + path + ' 失敗: HTTP ' + r.status); return r.arrayBuffer(); }));
  subHash[path] = createHash('sha1').update(buf).digest('hex').slice(0, 10);
  const isNew = !existsSync(path);
  if (isNew || !readFileSync(path).equals(buf)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, buf);
    (isNew ? subAdded : subChanged).push(path);
  }
}
// 清孤兒:本地 js/ css/ 有、但作者新版已不再引用的 → 刪(避免留舊檔害誤載)
const wantedSub = new Set(subFiles);
for (const dir of SUBRES_DIRS) {
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    const p = dir + '/' + name;
    if (/\.(js|css)$/.test(name) && statSync(p).isFile() && !wantedSub.has(p)) { rmSync(p); subRemoved.push(p); }
  }
}
// 把 index.html 的 js/css 引用改寫成帶內容 hash 的 ?v=(破快取);作者自帶的 ?v= 一併換成內容 hash。
// 沒有引用時 upstreamHtml === upstream(相容舊單檔版)
let upstreamHtml = upstream;
for (const path of subFiles) {
  upstreamHtml = upstreamHtml.replace(
    new RegExp('"' + escRe(path) + '(?:\\?[^"]*)?"', 'g'),
    '"' + path + '?v=' + subHash[path] + '"');
}

const merged = upstreamHtml.replace('</body>', block + '</body>');

// 3. 比對:合出來的結果跟現有檔一字不差 → 原作者沒更新
const htmlChanged = merged !== current;
if (htmlChanged) writeFileSync('index.html', merged);

// 4. 補下載缺少的 assets,並重抓「內容被作者換過的既有 assets」(比對 git blob SHA)
//    Linux 上中文檔名直接用 URL;既有檔則先比 SHA,一樣就跳過、不一樣才重抓。
const assetsAdded = [];
const assetsChanged = [];
const assetsRemoved = [];
try {
  const tree = await fetchRetry(TREE_API, { headers: ghHeaders }).then((r) => r.json());
  // ⚠ 作者把靜態圖分放兩處:大宗在 assets/,但登入畫面圖(v3.0.40 起首頁改版的 4:3 藝術舞台背景＋逐幀動畫,
  //   public/assets/login/273~300,310.png)放在 public/ 底下。只抓 assets/ 會漏掉整組登入圖 → 首頁背景/動畫 404、
  //   手機首頁版型連帶爆掉(踩過 2026-07-06)。故 assets/ 與 public/ 都要抓。
  const wanted = (tree.tree || []).filter(
    (t) => t.type === 'blob'
      && (t.path.startsWith('assets/') || t.path.startsWith('public/'))
      && !t.path.endsWith('desktop.ini')
  );
  for (const item of wanted) {
    let isNew = false;
    if (existsSync(item.path)) {
      if (gitBlobSha(readFileSync(item.path)) === item.sha) continue;   // 內容一樣 → 跳過
    } else {
      isNew = true;
    }
    const buf = Buffer.from(await fetchRetry(rawUrl(item.path)).then((r) => {
      if (!r.ok) throw new Error('下載 ' + item.path + ' 失敗: HTTP ' + r.status);
      return r.arrayBuffer();
    }));
    mkdirSync(dirname(item.path), { recursive: true });
    writeFileSync(item.path, buf);
    (isNew ? assetsAdded : assetsChanged).push(item.path);   // 新增 vs 既有被換
  }

  // 4b. 清除孤兒圖:作者上游已移除、本地卻還留著的 assets/ 檔 → 直接刪。
  //   刪了本地檔 → assets-manifest.json(下面 4c 走訪本地產生)就不再含它 → 玩家端 SW reconcileImages
  //   下次載入發現「快取有、manifest 沒有」會自動 evict,死圖一路收乾淨。
  //   ⚠ 只在「成功取得上游檔案樹(wanted)」時才跑(在本 try 內);上面 fetch 失敗就不會走到這、不刪,避免誤判把圖清空。
  if (existsSync('assets')) {
    const upstreamSet = new Set(wanted.map((t) => t.path));
    for (const p of walkAssets('assets')) {
      if (upstreamSet.has(p) || OWN_ASSETS.has(p)) continue;   // 上游現有、或我們自己的 → 保留
      rmSync(p);
      assetsRemoved.push(p);
    }
  }
} catch (e) {
  console.warn('[warn] 補圖階段出錯(不致命,繼續):', e.message);
}

// 4b. 圖桶失效不再「整桶倒掉」(舊作法:既有圖被換就 bump IMG_VERSION → 重抓全部 30MB)。
//     改走「逐張對帳」:manifest 帶每張圖的 git blob sha,玩家端 SW(sw.js reconcileImages)
//     比對只清掉 sha 對不上的那幾張。所以這裡不動 sw.js,只負責把帶 sha 的 manifest 產出來(見 4c)。

// 4c. 重產 assets-manifest.json(PWA 預抓清單 + 逐張對帳依據):走訪本地 assets/,列出 [路徑, git blob sha]。
//     sha 由 4 階段已抓好的本地檔即時算;內容沒變時 sha 不變 → git 不視為改動,assets/sha 有變才進 commit。
function walkAssets(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'desktop.ini') continue;
    const p = dir + '/' + name;
    if (statSync(p).isDirectory()) out.push(...walkAssets(p));
    else out.push(p);
  }
  return out;
}
if (existsSync('assets')) {
  // ⚠ 排除 assets/anim/(怪物動畫序列幀,~3 萬檔 / 62MB):這份 manifest 每次開頁都會被 afk-pwa 抓來做圖桶對帳,
  //   把 3 萬筆塞進去會讓它膨脹到 ~2-3MB、每次載入都多抓一次(踩 GitHub Pages 100GB/月流量)。
  //   動畫幀改走「一怪一雜湊」的 anim-manifest.json 對帳(見 4c-2)——作者換幀後玩家端會逐「怪」清舊快取、
  //   下次 on-demand 抓新版,不會像純 on-demand 那樣卡舊動畫。故這裡只把 anim/ 排除在「逐張」清單外。
  const manifest = walkAssets('assets').filter((p) => !p.startsWith('assets/anim/')).sort().map((p) => [p, gitBlobSha(readFileSync(p))]);
  writeFileSync('assets-manifest.json', JSON.stringify(manifest) + '\n');
}

// 4c-2. anim-manifest.json — 怪物動畫幀「一怪一雜湊」的輕量對帳清單。
//   assets/anim/ 幀太多(~3 萬)不進 assets-manifest(見 4c);但作者會「換掉」既有幀(踩過:一次同步換 1418 張),
//   純 on-demand 的舊快取不會被逐張 evict → 玩家會一直卡舊動畫、且無從自我修正(anim/ 不在對帳裡)。
//   折衷:把每個 assets/anim/<怪>/ 資料夾底下所有幀算一個「合併 sha」,只列 ~425 筆(約 40KB,開頁抓它幾乎零流量)。
//   玩家端 SW(sw.js reconcileAnim)依資料夾雜湊逐「怪」對帳:某怪的幀一有增/刪/換 → 該怪雜湊變 →
//   清掉該怪的快取(只清那一隻,不整包 62MB)→ 下次看到該怪時 on-demand 抓新版。每次同步都重算,故日後換幀自動跟上。
if (existsSync('assets/anim')) {
  const byFolder = {};
  for (const p of walkAssets('assets/anim')) {
    const parts = p.split('/');           // assets/anim/<怪>/<file…>
    if (parts.length < 4) continue;       // 只收「怪資料夾底下」的幀,anim/ 直屬檔(若有)略過
    const folder = parts.slice(0, 3).join('/');
    (byFolder[folder] ||= []).push(p);
  }
  const animManifest = Object.keys(byFolder).sort().map((folder) => {
    // 該資料夾內每個檔的 (path, blobSha) 排序後串起再 sha1 → 幀有增/刪/換,資料夾雜湊就變。
    const combined = byFolder[folder].sort().map((p) => p + '\0' + gitBlobSha(readFileSync(p))).join('\n');
    return [folder, createHash('sha1').update(combined).digest('hex')];
  });
  writeFileSync('anim-manifest.json', JSON.stringify(animManifest) + '\n');
}

// 4d. stamp sw.js 的 CODE_VERSION(程式桶版本):依 index.html＋全部外掛 js 內容算 hash。
//     index.html 一變(原版同步)hash 就變 → 玩家端偵測到新 sw.js → 觸發 PWA 更新流程。
const codeVersion = stampSwVersion() || '';

const changed = htmlChanged || assetsAdded.length > 0 || assetsChanged.length > 0 || assetsRemoved.length > 0
  || subAdded.length > 0 || subChanged.length > 0 || subRemoved.length > 0;
// 記錄本次同步時間,供玩家端首頁(afk-syncinfo)顯示「原版最後同步」。
// 無條件寫;但 workflow 只在 changed 時才 commit 這檔,故倉庫裡的時間=最後一次真的有合併更新的時間。
writeFileSync('last-sync.json', JSON.stringify({ syncedAt: new Date().toISOString() }) + '\n');
// 從 <title> 動態抓遊戲名(原作者改名也會自動正確),給 release 標題/說明用
const titleMatch = merged.match(/<title>([^<]*)<\/title>/);
const gameTitle = (titleMatch ? titleMatch[1] : '放置天堂').trim();
// 抓原作者遊戲版本號(單一真相來源 GAME_VERSION,在 js/00-data.js;作者搬檔也容錯掃整個 js/),給 release 標題用;抓不到回空字串
let gameVersion = '';
try {
  const jsFiles = existsSync('js') ? readdirSync('js').filter((f) => f.endsWith('.js')).map((f) => 'js/' + f) : [];
  for (const f of ['js/00-data.js', ...jsFiles]) {
    if (!existsSync(f)) continue;
    const vm = readFileSync(f, 'utf8').match(/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
    if (vm) { gameVersion = vm[1].trim(); break; }
  }
} catch (e) {}
setOutput('changed', changed ? 'true' : 'false');
setOutput('html_changed', htmlChanged ? 'true' : 'false');
setOutput('assets_added', String(assetsAdded.length));
setOutput('assets_changed', String(assetsChanged.length));   // 既有 asset 被換過(玩家端逐張對帳只重抓這些)
setOutput('assets_removed', String(assetsRemoved.length));   // 作者移除的孤兒圖(已從本地刪除;玩家端 SW 下次載入自動 evict)
setOutput('code_version', codeVersion);                      // 程式桶版本(依 index.html＋外掛＋js/＋css/ 內容 hash)
setOutput('code_added', String(subAdded.length));            // 作者外部 js/css 新增
setOutput('code_changed', String(subChanged.length));        // 作者外部 js/css 內容被換(玩家端靠引用 ?v=內容hash 自動重抓)
setOutput('code_removed', String(subRemoved.length));        // 作者移除的孤兒 js/css(已從本地刪)
setOutput('game_title', gameTitle);
setOutput('game_version', gameVersion);                      // 原作者遊戲版本號(GAME_VERSION,如 v2.4.15),給 release 標題用
console.log(`index.html 變更: ${htmlChanged} | 程式/樣式: +${subAdded.length}/~${subChanged.length}/-${subRemoved.length} | 新增圖檔: ${assetsAdded.length} | 更新既有圖: ${assetsChanged.length} | 移除孤兒圖: ${assetsRemoved.length}`);
if (subAdded.length) console.log('新增 js/css:\n' + subAdded.join('\n'));
if (subChanged.length) console.log('更新 js/css:\n' + subChanged.join('\n'));
if (subRemoved.length) console.log('移除 js/css(孤兒):\n' + subRemoved.join('\n'));
if (assetsAdded.length) console.log('新增:\n' + assetsAdded.join('\n'));
if (assetsChanged.length) console.log('更新:\n' + assetsChanged.join('\n'));
if (assetsRemoved.length) console.log('移除(孤兒):\n' + assetsRemoved.join('\n'));
