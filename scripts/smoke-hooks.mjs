/* ============================================================================
 * smoke-hooks.mjs — 冒煙測試:用無頭瀏覽器載入 index.html,確認五支外掛都 hook 成功
 *
 * 用途:自動同步原作者 index.html 後,驗證原作者沒有改壞外掛掛點(改 id / DOM 結構)。
 *   - 全部 hooks OK → exit 0(workflow 才會 commit/push)
 *   - 任一外掛沒掛上 → exit 1(workflow 改為開 issue 通知,不自動推壞掉的版本)
 * ========================================================================== */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium, devices } from 'playwright';

const PORT = 8799;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = join(process.cwd(), normalize(p).replace(/^(\.\.[/\\])+/, ''));
    const buf = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const logs = [];

// 各外掛的開機 log:'[AFK] hooks OK' / '[AFK-mobile] hooks OK' / …(集中定義,goto 後輪詢等待 + 最後判定共用)
// afk-mobile 為「桌機零接觸」設計——只有偵測到手機尺寸/裝置才會 init 並印出 hooks OK(見 afk-mobile.js);
//   故它單獨在「手機模擬」那一輪驗,桌機那輪不列入(否則桌機永遠等不到它、smoke 假性失敗)。
// afk-battlehud 桌機也會 init(只是 CSS 讓它不顯示)→ 放 need 即可;它取代的是核心手機版 #mobile-vitals。
// afk-touchtip 只在觸控裝置 init(桌機有 hover,本來就不該掛)→ 桌機那輪永遠等不到,必須放手機輪。
const needMobileOnly = ['[AFK-touchtip]'];
// ⚠ '[AFK]'(afk-offline)已暫停使用、不印掛點訊息 → 不列入;恢復該外掛時要一併加回來
const need = ['[AFK-lzcache]', '[AFK-mobile]', '[AFK-backnav]', '[AFK-battlehud]', '[AFK-mapbar]', '[AFK-nozoom]', '[AFK-trackinfo]', '[AFK-relicguard]', '[AFK-battlebuffs]', '[AFK-slotinfo]', '[AFK-dex]', '[AFK-wiki]', '[AFK-syncinfo]', '[AFK-statpts]', '[AFK-pwa]', '[AFK-storage]', '[AFK-history]', '[AFK-reissueid]', '[AFK-diag]', '[AFK-mobname]', '[AFK-training]', '[AFK-itemsearch]', '[AFK-eqlist]', '[AFK-npclist]', '[AFK-skin]'];
const seen = (list) => list.every((n) => logs.some((l) => l.includes(n) && l.includes('hooks OK')));

// ⚠ 不用 waitUntil:'networkidle':作者新版(.49 起)加了背景音樂 assets/bgm/*.mp3，<audio> 媒體串流會讓網路
//   「永遠不靜止」→ networkidle 等不到逾時、smoke 假性失敗、自動同步整個卡住(踩過 2026-06-30,掛點其實全正常)。
//   改成 domcontentloaded + 輪詢「外掛是否都印出 hooks OK」,既驗到掛點、又完全不受媒體/長連線影響。

// --- 第一輪:桌機視窗,驗桌機面向的 12 支外掛 + 地圖翻譯 ---
const page = await browser.newPage();
page.on('console', (m) => logs.push(m.text()));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
const _deadline = Date.now() + 20000;   // 最多等 20 秒讓全部外掛初始化(CI 較慢)
while (Date.now() < _deadline && !seen(need)) await page.waitForTimeout(200);
await page.waitForTimeout(300);   // 緩衝:讓 hooks 之後的索引(dex/wiki)與 AFK_EXTRA 建好,再做地圖翻譯檢查

// --- 第二輪:手機模擬(iPhone 13),專驗 afk-mobile 的三欄掛點在作者最新 DOM 上仍成立 ---
//   afk-mobile 只在手機時 init,桌機那輪印不出 hooks OK;用真手機模擬(pointer:coarse/UA)讓它跑起來才驗得到。
const mctx = await browser.newContext({ ...devices['iPhone 13'] });
const mpage = await mctx.newPage();
mpage.on('console', (m) => logs.push(m.text()));
await mpage.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
const _mDeadline = Date.now() + 20000;
while (Date.now() < _mDeadline && !seen(needMobileOnly)) await mpage.waitForTimeout(200);

// --- 第三輪:手機 + 「手機版面」外掛關閉 ---
//   為什麼要驗這個:玩家可以逐支關外掛,但 afk-toggles 的逃生門按鈕與各外掛入口「不可以跟著消失」——
//   否則玩家關掉某支外掛後連把它開回來的入口都沒有,變成死結(2026-07-20 實際回報)。
//   歷史成因都是「基礎設施依賴了可被關掉的外掛」:逃生門的 top 讀 afk-mobile 設的 --orig-bar-h、
//   afk-skin 靠 afk-mobile 掛的 body.m-mobile 判斷手機。前兩輪都是「全開」狀態,永遠測不到。
const octx = await browser.newContext({ ...devices['iPhone 13'] });
const opage = await octx.newPage();
await opage.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
await opage.evaluate(() => localStorage.setItem('afk_toggle_mobile', '0'));
await opage.reload({ waitUntil: 'domcontentloaded' });
await opage.waitForTimeout(3000);
// 模擬線上的非官方橫幅(本機沒有;逃生門必須避開它)
await opage.evaluate(() => {
  if (document.getElementById('_orig_pbar')) return;
  const d = document.createElement('div');
  d.id = '_orig_pbar';
  d.style.cssText = 'position:fixed;left:0;right:0;top:0;height:92px;background:#123;z-index:2147483647;';   // z-index 要用線上實測值(遊戲橫幅是 int 上限);設低了會蓋不住按鈕、測不出遮蔽
  // ⚠ 文字不可省:外掛認橫幅是靠文字比對(/shines871|官方|非官方|轉載/,見 afk-mobile/afk-battlehud 的 findBanner)。
  //   沒文字的假橫幅在偵測邏輯眼中根本不存在 → 只測得到「z-index 硬蓋」,完全驗不到「量測→讓位」那條路徑。
  d.textContent = '這是非官方轉載版本，前往官方最新版：shines871.github.io/idle-lineage-class';
  document.body.appendChild(d);
});
await opage.waitForTimeout(1500);
const toggleOffProblems = await opage.evaluate(() => {
  const bad = [];
  const btn = document.getElementById('afk-toggles-entry');
  if (!btn) bad.push('左上角「外掛開關」逃生門按鈕不存在');
  else {
    const r = btn.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!(r.width > 0 && r.height > 0)) bad.push('逃生門按鈕沒有尺寸');
    else if (!(top === btn || btn.contains(top))) bad.push(`逃生門按鈕被「${(top && (top.id || top.tagName)) || '未知元素'}」蓋住,點不到`);
  }
  // 入口(掉落查詢/小百科)在手機上必須直接可見,不可被收進桌機用的 Modal
  for (const [sel, nm] of [['.m-dex-entry-main', '掉落查詢入口'], ['.m-wiki-entry-main', '小百科入口']]) {
    const el = document.querySelector(sel);
    if (!el) { bad.push(nm + '不存在'); continue; }
    if (el.getBoundingClientRect().height <= 0) bad.push(nm + '高度為 0(被收進桌機 Modal?)');
  }
  return bad;
});

// 🗺️ 地圖名翻譯覆蓋檢查:掉落查詢的「出沒地圖」來源＝DB.maps 的 key,經 AFK_EXTRA.mapName 解析。
//   mapName 查不到任一中文來源時會原樣回傳英文 id(name === id),這就是「漏翻」的精準訊號。
//   作者新增「不在 MAP_CATEGORIES/MAP_REGIONS/DB.towns…」的地圖結構時會被這裡擋下 → 提醒補進 mapName。
const untranslatedMaps = await page.evaluate(() => {
  const out = [];
  try {
    const mn = (window.AFK_EXTRA && AFK_EXTRA.mapName) ? AFK_EXTRA.mapName : null;
    if (mn && typeof DB !== 'undefined' && DB.maps) {
      for (const id of Object.keys(DB.maps)) {
        const nm = String(mn(id));
        if (nm === id || /[A-Za-z]/.test(nm)) out.push([id, nm]);   // 原樣回傳 id 或仍含英文字母 = 漏翻
      }
    }
  } catch (e) {}
  return out;
});

await browser.close();
server.close();

const okMap = {};
for (const n of [...need, ...needMobileOnly]) okMap[n] = logs.some((l) => l.includes(n) && l.includes('hooks OK'));
const allOK = Object.values(okMap).every(Boolean);

console.log('外掛掛點檢查:', JSON.stringify(okMap, null, 0));
if (!allOK) {
  console.error('冒煙測試失敗:有外掛沒有成功 hook(原作者可能改了 DOM / id)。');
  process.exit(1);
}

if (toggleOffProblems.length) {
  console.error('冒煙測試失敗:關掉「手機版面」外掛後,手機上的逃生門/入口不見了(玩家會無法把外掛開回來):');
  for (const p of toggleOffProblems) console.error('  ' + p);
  console.error('  判準:不可停用的基礎設施不能依賴可被關掉的外掛提供的 CSS 變數 / body class。');
  process.exit(1);
}

if (untranslatedMaps.length) {
  console.error('冒煙測試失敗:掉落查詢有地圖名未翻譯(會顯示英文 id),請補進 afk-extradata.js 的 AFK_EXTRA.mapName:');
  for (const [id, nm] of untranslatedMaps) console.error(`  ${id}  ->  ${nm}`);
  process.exit(1);
}

console.log('冒煙測試通過:外掛 hooks OK,且掉落查詢地圖名全部已翻譯。');
