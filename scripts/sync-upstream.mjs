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
import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

const BG_PREFIX = 'assets/background/';   // 場景大圖目錄(由 sw.js 做 cache-first 快取)
const SW_FILE = 'sw.js';

// 算 git blob SHA(跟 GitHub 樹狀 API 回的 .sha 同演算法),用來判斷既有 asset 內容有沒有被作者換過
function gitBlobSha(buf) {
  return createHash('sha1').update('blob ' + buf.length + '\0').update(buf).digest('hex');
}

const UPSTREAM_USER = 'shines871';
const REPO          = 'idle-lineage-class';
const UPSTREAM_HTML = `https://${UPSTREAM_USER}.github.io/${REPO}/index.html`;
const TREE_API      = `https://api.github.com/repos/${UPSTREAM_USER}/${REPO}/git/trees/main?recursive=1`;
const rawUrl = (p) => `https://raw.githubusercontent.com/${UPSTREAM_USER}/${REPO}/main/` +
                      p.split('/').map(encodeURIComponent).join('/');

const PLUGINS = [
  { file: 'afk-offline.js', comment: '離線掛機外掛(可獨立維護;原作者更新後重新加回此行即可)' },
  { file: 'afk-mobile.js',  comment: '手機版介面外掛(可獨立維護;原作者更新後重新加回此行即可)' },
  { file: 'afk-extradata.js', comment: '共用補充資料(掉落查詢+小百科共用的手動清單;純資料無 DOM,需先於 dex/wiki 載入)' },
  { file: 'afk-dex.js',     comment: '怪物/掉落查詢外掛(可獨立維護;原作者更新後重新加回此行即可)' },
  { file: 'afk-wiki.js',    comment: '小百科外掛(專精/武器特性/職業魔法;可獨立維護,原作者更新後重新加回此行即可)' },
  { file: 'afk-fixes.js',   comment: '通用修正外掛(補原作者坑,桌機/手機通用;可獨立維護,原作者更新後重新加回此行即可)' },
  { file: 'afk-sw.js',      comment: '背景大圖快取 Service Worker 註冊(可獨立維護;原作者更新後重新加回此行即可)' },
  { file: 'afk-toast.js',   comment: '手機 toast 提示(點按鈕的系統日誌訊息浮現;可獨立維護,原作者更新後重新加回此行即可)' },
  { file: 'afk-syncinfo.js', comment: '首頁顯示原版最後同步時間(可獨立維護;原作者更新後重新加回此行即可)' },
];

function setOutput(k, v) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
  console.log(`[out] ${k}=${v}`);
}

const ghHeaders = process.env.GH_TOKEN
  ? { Authorization: `Bearer ${process.env.GH_TOKEN}`, 'User-Agent': 'sync-upstream' }
  : { 'User-Agent': 'sync-upstream' };

// 1. 抓原版 index.html
const upstream = await fetch(UPSTREAM_HTML, { cache: 'no-store' }).then((r) => {
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

const merged = upstream.replace('</body>', block + '</body>');

// 3. 比對:合出來的結果跟現有檔一字不差 → 原作者沒更新
const htmlChanged = merged !== current;
if (htmlChanged) writeFileSync('index.html', merged);

// 4. 補下載缺少的 assets,並重抓「內容被作者換過的既有 assets」(比對 git blob SHA)
//    Linux 上中文檔名直接用 URL;既有檔則先比 SHA,一樣就跳過、不一樣才重抓。
const assetsAdded = [];
const assetsChanged = [];
try {
  const tree = await fetch(TREE_API, { headers: ghHeaders }).then((r) => r.json());
  const wanted = (tree.tree || []).filter(
    (t) => t.type === 'blob' && t.path.startsWith('assets/') && !t.path.endsWith('desktop.ini')
  );
  for (const item of wanted) {
    let isNew = false;
    if (existsSync(item.path)) {
      if (gitBlobSha(readFileSync(item.path)) === item.sha) continue;   // 內容一樣 → 跳過
    } else {
      isNew = true;
    }
    const buf = Buffer.from(await fetch(rawUrl(item.path)).then((r) => {
      if (!r.ok) throw new Error('下載 ' + item.path + ' 失敗: HTTP ' + r.status);
      return r.arrayBuffer();
    }));
    mkdirSync(dirname(item.path), { recursive: true });
    writeFileSync(item.path, buf);
    (isNew ? assetsAdded : assetsChanged).push(item.path);   // 新增 vs 既有被換
  }
} catch (e) {
  console.warn('[warn] 補圖階段出錯(不致命,繼續):', e.message);
}

// 4b. 既有「背景大圖」被換 → bump sw.js 的 CACHE_VERSION,讓玩家端 Service Worker 自動清舊快取、重抓新圖
//     (新增背景圖不必 bump:新檔名新 URL,cache-first 本來就會抓。只有同名換內容才需要。)
const bgChanged = assetsChanged.filter((p) => p.startsWith(BG_PREFIX));
let swVersion = '';
if (bgChanged.length && existsSync(SW_FILE)) {
  const sw = readFileSync(SW_FILE, 'utf8');
  const m = sw.match(/const CACHE_VERSION = 'bg-v(\d+)';/);
  if (m) {
    swVersion = 'bg-v' + (parseInt(m[1], 10) + 1);
    writeFileSync(SW_FILE, sw.replace(m[0], `const CACHE_VERSION = '${swVersion}';`));
    console.log(`[sw] 既有背景圖更新 ${bgChanged.length} 張 → bump CACHE_VERSION 至 ${swVersion}`);
  } else {
    console.warn('[warn] 找不到 sw.js 的 CACHE_VERSION,未能自動 bump,請手動處理。');
  }
}

const changed = htmlChanged || assetsAdded.length > 0 || assetsChanged.length > 0;
// 記錄本次同步時間,供玩家端首頁(afk-syncinfo)顯示「原版最後同步」。
// 無條件寫;但 workflow 只在 changed 時才 commit 這檔,故倉庫裡的時間=最後一次真的有合併更新的時間。
writeFileSync('last-sync.json', JSON.stringify({ syncedAt: new Date().toISOString() }) + '\n');
// 從 <title> 動態抓遊戲名(原作者改名也會自動正確),給 release 標題/說明用
const titleMatch = merged.match(/<title>([^<]*)<\/title>/);
const gameTitle = (titleMatch ? titleMatch[1] : '放置天堂').trim();
setOutput('changed', changed ? 'true' : 'false');
setOutput('html_changed', htmlChanged ? 'true' : 'false');
setOutput('assets_added', String(assetsAdded.length));
setOutput('assets_changed', String(assetsChanged.length));   // 既有 asset 被換過(全部,含非背景)
setOutput('bg_changed', String(bgChanged.length));           // 其中屬於背景大圖的張數(驅動 commit/release 警示)
setOutput('sw_version', swVersion);                          // bump 後的新版本(沒 bump 則為空字串)
setOutput('game_title', gameTitle);
console.log(`index.html 變更: ${htmlChanged} | 新增圖檔: ${assetsAdded.length} | 更新既有圖: ${assetsChanged.length}`);
if (assetsAdded.length) console.log('新增:\n' + assetsAdded.join('\n'));
if (assetsChanged.length) console.log('更新:\n' + assetsChanged.join('\n'));
