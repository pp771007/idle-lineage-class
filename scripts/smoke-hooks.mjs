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
import { chromium } from 'playwright';

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
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(m.text()));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

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

// 各外掛的開機 log:'[AFK] hooks OK' / '[AFK-mobile] hooks OK' / '[AFK-dex] hooks OK' / '[AFK-wiki] hooks OK' / '[AFK-fixes] hooks OK'
const need = ['[AFK]', '[AFK-mobile]', '[AFK-slotinfo]', '[AFK-dex]', '[AFK-wiki]', '[AFK-fixes]', '[AFK-syncinfo]', '[AFK-statpts]', '[AFK-pwa]', '[AFK-storage]', '[AFK-history]', '[AFK-training]', '[AFK-skin]'];
const okMap = {};
for (const n of need) okMap[n] = logs.some((l) => l.includes(n) && l.includes('hooks OK'));
const allOK = Object.values(okMap).every(Boolean);

console.log('外掛掛點檢查:', JSON.stringify(okMap, null, 0));
if (!allOK) {
  console.error('冒煙測試失敗:有外掛沒有成功 hook(原作者可能改了 DOM / id)。');
  process.exit(1);
}

if (untranslatedMaps.length) {
  console.error('冒煙測試失敗:掉落查詢有地圖名未翻譯(會顯示英文 id),請補進 afk-extradata.js 的 AFK_EXTRA.mapName:');
  for (const [id, nm] of untranslatedMaps) console.error(`  ${id}  ->  ${nm}`);
  process.exit(1);
}

console.log('冒煙測試通過:外掛 hooks OK,且掉落查詢地圖名全部已翻譯。');
