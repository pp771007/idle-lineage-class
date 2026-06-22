/* ============================================================================
 * stamp-sw-version.mjs — 依「index.html ＋ 全部外掛 js 的內容」算 hash，
 *   覆寫 sw.js 的 CODE_VERSION（程式桶版本）。
 *
 * 為什麼：PWA 要靠「sw.js 內容變了」來偵測更新。只要程式有任何改動（原版同步換了
 *   index.html、或我改了某支 afk-*.js），這支算出來的 hash 就會變 → CODE_VERSION 變 →
 *   玩家端瀏覽器發現新 sw.js → 觸發更新流程。把外掛 js 內容也納入 hash，
 *   即使忘了 bump 該外掛的 ?v= 版本號，SW 版本一樣會跟著變，不會漏更新。
 *
 * 何時跑：
 *   - 自動同步流程（sync-upstream.mjs）改完 index.html 後會自動呼叫。
 *   - 我手動改外掛、push 前，跑一次：node scripts/stamp-sw-version.mjs
 *   （從 repo 根目錄跑）。
 * ========================================================================== */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SW_FILE = 'sw.js';

// 台灣時間 MMDD-HHMM(畫面辨識版本用)
function nowTaipei() {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const o = {};
  p.forEach((x) => { o[x.type] = x.value; });
  return `${o.month}${o.day}-${o.hour}${o.minute}`;
}

export function stampSwVersion() {
  if (!existsSync(SW_FILE)) { console.warn('[stamp] 找不到 sw.js，略過'); return null; }
  const parts = [];
  if (existsSync('index.html')) parts.push(readFileSync('index.html'));
  for (const f of readdirSync('.').filter((n) => /^afk-.*\.js$/.test(n)).sort()) parts.push(readFileSync(f));
  const hash = createHash('sha1').update(Buffer.concat(parts)).digest('hex').slice(0, 12);
  const version = 'code-' + hash;

  const sw = readFileSync(SW_FILE, 'utf8');
  const m = sw.match(/const CODE_VERSION = '([^']*)';/);
  if (!m) { console.warn('[stamp] sw.js 找不到 CODE_VERSION 宣告，未能覆寫'); return null; }
  const codeChanged = m[1] !== version;

  let next = sw.replace(m[0], `const CODE_VERSION = '${version}';`);
  // BUILD_ID 只在「程式真的變了」時才更新成現在時間,避免自動同步每小時都改 sw.js(內容沒變卻被當改版)。
  if (codeChanged) {
    const build = nowTaipei();
    next = next.replace(/const BUILD_ID\s*=\s*'[^']*';/, `const BUILD_ID     = '${build}';`);
    console.log('[stamp] BUILD_ID →', build);
  }

  if (next !== sw) { writeFileSync(SW_FILE, next); console.log('[stamp] CODE_VERSION →', version); }
  else console.log('[stamp] CODE_VERSION 不變（內容相同）:', version);
  return version;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) stampSwVersion();
