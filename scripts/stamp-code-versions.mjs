// 把 index.html 裡 js/*.js、css/*.css、根目錄 afk-*.js 的 ?v= 對齊「檔案內容的 sha1 前 10 碼」。
//   (2026-07-18 起 afk-*.js 也納入自動化:原本 afk-*.js 的 ?v= 是手動 date 版本,反覆漏 bump——
//    今天 afk-wiki 改了內容卻沒換號,已載入舊版的玩家吃快取、看不到新功能。改成內容雜湊後永不再漏。)
//
// 為什麼需要這支:?v= 是快取破口——URL 一樣,瀏覽器/Service Worker 就沿用舊快取。
// 改了檔案卻沒 bump ?v=,玩家拿到的是「他當初第一次抓到的那份」,而同一頁其他有 bump 的檔卻是新的
// → 新舊混搭。2026-07-11 踩過:遺物移植同時改了 js/04(新增 equipSkillDmgMult)與 js/07(呼叫它),
//   兩個 ?v= 都沒 bump → 先快取過舊 js/04、之後才抓 js/07 的玩家就拿到「新 07 + 舊 04」,
//   一施放技能就 ReferenceError,離線結算整段中斷(畫面只顯示「離線掛機 0 分鐘」)。看誰何時快取而定,故低機率、難重現。
//
// 用法:
//   node scripts/stamp-code-versions.mjs           → 對齊(會改寫 index.html)
//   node scripts/stamp-code-versions.mjs --check   → 只檢查,有不一致就 exit 1(給 prepush / hook 擋)
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'index.html');
const CHECK_ONLY = process.argv.includes('--check');

const hashOf = (rel) => createHash('sha1').update(readFileSync(join(ROOT, rel))).digest('hex').slice(0, 10);

let html = readFileSync(INDEX, 'utf8');
const stale = [];

html = html.replace(/((?:js|css)\/[\w.-]+\.(?:js|css)|afk-[\w.-]+\.js)\?v=([0-9a-z]+)/g, (whole, path, cur) => {
  let want;
  try { want = hashOf(path); } catch { return whole; }   // 檔案不存在(外部路徑等)→ 原樣保留
  if (cur === want) return whole;
  stale.push({ path, cur, want });
  return `${path}?v=${want}`;
});

if (!stale.length) {
  console.log('[code-ver] 所有 js/css/afk-*.js 的 ?v= 都與內容一致。');
  process.exit(0);
}

if (CHECK_ONLY) {
  console.error(`[code-ver] 🚨 ${stale.length} 個檔案改過但 ?v= 沒 bump → 玩家會拿到新舊混搭的程式碼:`);
  stale.forEach(s => console.error(`  ${s.path}  ${s.cur} → 應為 ${s.want}`));
  console.error('[code-ver] 執行 `node scripts/stamp-code-versions.mjs` 修正後再 push。');
  process.exit(1);
}

writeFileSync(INDEX, html);
console.log(`[code-ver] 已更新 ${stale.length} 個 ?v=:`);
stale.forEach(s => console.log(`  ${s.path}  ${s.cur} → ${s.want}`));
