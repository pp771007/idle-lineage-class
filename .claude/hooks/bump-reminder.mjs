/* ============================================================================
 * bump-reminder.mjs — PostToolUse hook:改到 afk-*.js 後提醒 bump ?v=
 *
 * GitHub Pages / 瀏覽器(尤其 Brave)會死命快取 JS;只改檔內容、沒改 index.html 裡
 * script src 的 ?v=,使用者載到的還是舊外掛 → debug 鬼打牆(CLAUDE.md 踩過一整輪)。
 * 改完即時提醒,不自動改版本號(避免亂動)。push 前的硬把關交給 prepush-guard。
 * ========================================================================== */
import { basename } from 'node:path';

function readStdin() {
  return new Promise((r) => {
    let s = '';
    process.stdin.on('data', (c) => (s += c));
    process.stdin.on('end', () => r(s));
    process.stdin.on('error', () => r(s));
  });
}

const raw = await readStdin();
let data = {};
try { data = JSON.parse(raw); } catch {}

const fp = data?.tool_input?.file_path || '';
if (/^afk-.*\.js$/.test(basename(fp))) {
  console.error(`📌 改了 ${basename(fp)}:push 前記得跑 node scripts/stamp-code-versions.mjs(自動對齊 ?v=,含 afk-*.js)與 node scripts/stamp-sw-version.mjs(/prepush 內含)。`);
  process.exit(2); // PostToolUse exit 2:把這段提醒回饋給 Claude(不會擋下已完成的編輯)
}
process.exit(0);
