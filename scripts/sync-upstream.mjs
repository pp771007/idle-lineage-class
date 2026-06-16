/* ============================================================================
 * sync-upstream.mjs — 自動把原作者最新 index.html 合併進本專案(供 GitHub Action 用)
 *
 * 做的事(等同手動「合併原版」流程,跑在 Linux runner 上,中文檔名直接用 URL 不必走 blob SHA):
 *   1. 抓原作者 GitHub Pages 的最新 index.html
 *   2. 把本專案五支外掛的 <script>(保留各自現有的 ?v= 版本號)插回 </body> 前
 *   3. 跟現有 index.html 比對 → 一模一樣就什麼都不做(changed=false)
 *   4. 比對原作者 repo 檔案樹,補下載本地缺少的 assets 新圖
 *   5. 把結果寫進 GITHUB_OUTPUT(changed / assets_added),由 workflow 決定要不要推
 *
 * 不在這裡 commit/push;那由 workflow 在「冒煙測試通過」後才做。
 * ========================================================================== */
import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { dirname } from 'node:path';

const UPSTREAM_USER = 'shines871';
const REPO          = 'idle-lineage-class';
const UPSTREAM_HTML = `https://${UPSTREAM_USER}.github.io/${REPO}/index.html`;
const TREE_API      = `https://api.github.com/repos/${UPSTREAM_USER}/${REPO}/git/trees/main?recursive=1`;
const rawUrl = (p) => `https://raw.githubusercontent.com/${UPSTREAM_USER}/${REPO}/main/` +
                      p.split('/').map(encodeURIComponent).join('/');

const PLUGINS = [
  { file: 'afk-offline.js', comment: '離線掛機外掛(可獨立維護;原作者更新後重新加回此行即可)' },
  { file: 'afk-mobile.js',  comment: '手機版介面外掛(可獨立維護;原作者更新後重新加回此行即可)' },
  { file: 'afk-dex.js',     comment: '怪物/掉落查詢外掛(可獨立維護;原作者更新後重新加回此行即可)' },
  { file: 'afk-wiki.js',    comment: '小百科外掛(專精/武器特性/職業魔法;可獨立維護,原作者更新後重新加回此行即可)' },
  { file: 'afk-fixes.js',   comment: '通用修正外掛(補原作者坑,桌機/手機通用;可獨立維護,原作者更新後重新加回此行即可)' },
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

// 4. 補下載缺少的 assets 圖檔(Linux 上中文檔名直接用 URL,不必走 blob SHA)
const assetsAdded = [];
try {
  const tree = await fetch(TREE_API, { headers: ghHeaders }).then((r) => r.json());
  const wanted = (tree.tree || []).filter(
    (t) => t.type === 'blob' && t.path.startsWith('assets/') && !t.path.endsWith('desktop.ini')
  );
  for (const item of wanted) {
    if (existsSync(item.path)) continue;
    const buf = Buffer.from(await fetch(rawUrl(item.path)).then((r) => {
      if (!r.ok) throw new Error('下載 ' + item.path + ' 失敗: HTTP ' + r.status);
      return r.arrayBuffer();
    }));
    mkdirSync(dirname(item.path), { recursive: true });
    writeFileSync(item.path, buf);
    assetsAdded.push(item.path);
  }
} catch (e) {
  console.warn('[warn] 補圖階段出錯(不致命,繼續):', e.message);
}

const changed = htmlChanged || assetsAdded.length > 0;
// 從 <title> 動態抓遊戲名(原作者改名也會自動正確),給 release 標題/說明用
const titleMatch = merged.match(/<title>([^<]*)<\/title>/);
const gameTitle = (titleMatch ? titleMatch[1] : '放置天堂').trim();
setOutput('changed', changed ? 'true' : 'false');
setOutput('html_changed', htmlChanged ? 'true' : 'false');
setOutput('assets_added', String(assetsAdded.length));
setOutput('game_title', gameTitle);
console.log(`index.html 變更: ${htmlChanged} | 新增圖檔: ${assetsAdded.length}`);
if (assetsAdded.length) console.log(assetsAdded.join('\n'));
