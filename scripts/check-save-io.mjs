/* ============================================================================
 * check-save-io.mjs — 盯住上游的「存檔寫入/壓縮」那段，改了就大聲失敗
 *
 * 為什麼要這支:`afk-synccompress`(存檔即時壓縮)是全專案唯一會「替換掉核心存檔寫入函式」
 *   的外掛——它把 `_lzSet` 換成同步壓縮版,並自己去動 `_lzWorkerRev`、直接呼叫 `_lsSet`、
 *   自己拼 `'LZ1:' + LZString.compressToUTF16(...)` 的格式。這些全是「上游現在剛好長這樣」
 *   的假設。作者一旦改了存檔格式/前綴/Worker 對帳邏輯,外掛還照舊寫,寫出去的就是
 *   **格式不對的存檔** → 玩家讀不回來 = 存檔損壞,而且 smoke 只驗掛點、驗不到這個。
 *
 * 做法:抽出下面 WATCHED 那幾支核心函式的原始碼,逐支 sha256,與
 *   `upstream-checkpoint.json` 的 `saveIo` 基準比對。
 *     - 完全一致 → exit 0(同步照常往下走)
 *     - 有任何一支變了/不見了 → exit 1,列出是哪幾支,要求人工比對 diff 後再決定
 * 人工看過、確認 afk-synccompress 仍然安全(或已改好)後,跑 `node scripts/check-save-io.mjs --accept`
 *   把新的 sha 收進 checkpoint,同步才會再度綠燈。
 *
 * 用法:
 *   node scripts/check-save-io.mjs            # 檢查(sync-upstream 會自動跑)
 *   node scripts/check-save-io.mjs --accept   # 人工複核過後收下新版本
 * ========================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const SRC = 'js/00-data.js';
const CKPT = 'upstream-checkpoint.json';

// 這幾支＝afk-synccompress 的假設所繫。少一支或內容變了都要人工看過。
const WATCHED = [
  '_lsSet',              // 外掛直接呼叫它寫 localStorage
  '_lzSet',              // 外掛整支覆寫它(同步壓縮版)
  '_lzGet',              // 讀取端:'LZ1:' 前綴的解讀方式
  '_lzSetStoredRaw',     // 直接覆寫原文時如何讓在途 Worker 結果失效
  '_lzRemoveStored',
  '_getLzWorker',        // 背景壓縮 Worker 本體(壓出來的格式)
  '_queueLzCompression', // rev/raw 對帳機制(外掛靠 bump rev 讓舊結果失效)
];
// 全域變數宣告那行(外掛會去 bump `_lzWorkerRev`)
const WATCHED_DECL = '_lzWorker';

function fnSource(src, name) {
  const at = src.indexOf('\nfunction ' + name + '(');
  if (at < 0) return null;
  const start = at + 1;
  let i = src.indexOf('{', start);
  if (i < 0) return null;
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}
function declSource(src, name) {
  const m = new RegExp('^var ' + name + ' = .*$', 'm').exec(src);
  return m ? m[0] : null;
}
const sha = (s) => createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex').slice(0, 16);

const src = readFileSync(SRC, 'utf8');
const now = {};
const missing = [];
for (const name of WATCHED) {
  const body = fnSource(src, name);
  if (body == null) { missing.push('function ' + name); continue; }
  now[name] = sha(body);
}
const decl = declSource(src, WATCHED_DECL);
if (decl == null) missing.push('var ' + WATCHED_DECL); else now['var ' + WATCHED_DECL] = sha(decl);

const ck = JSON.parse(readFileSync(CKPT, 'utf8'));

if (process.argv.includes('--accept')) {
  if (missing.length) {
    console.error('❌ 還有抓不到的目標,不能收下:' + missing.join('、'));
    console.error('   代表上游把它改名/移除了 → 先確認 afk-synccompress.js 要怎麼跟上,再更新本腳本的 WATCHED。');
    process.exit(1);
  }
  const t = new Date(Date.now() + 8 * 3600 * 1000);   // 台灣時間(不可依賴 TZ 環境變數)
  ck.saveIo = {
    note: '存檔寫入/壓縮相關核心函式的 sha(見 scripts/check-save-io.mjs)。變動代表 afk-synccompress 的假設要重新確認,人工複核後才用 --accept 更新。',
    reviewedAt: t.toISOString().slice(0, 16).replace('T', ' ') + ' (UTC+8)',
    fns: now,
  };
  writeFileSync(CKPT, JSON.stringify(ck, null, 2) + '\n');
  console.log('✅ 已收下目前版本的存檔 I/O 基準(' + Object.keys(now).length + ' 項)。');
  process.exit(0);
}

const base = (ck.saveIo && ck.saveIo.fns) || null;
if (!base) {
  console.error('❌ upstream-checkpoint.json 還沒有 saveIo 基準。');
  console.error('   先人工確認 afk-synccompress.js 與現行核心相容,再跑:node scripts/check-save-io.mjs --accept');
  process.exit(1);
}

const changed = Object.keys(now).filter((k) => base[k] && base[k] !== now[k]);
const added = Object.keys(now).filter((k) => !base[k]);
const gone = Object.keys(base).filter((k) => !(k in now));

if (!missing.length && !changed.length && !added.length && !gone.length) {
  console.log('✅ 存檔寫入/壓縮那段與基準一致(' + Object.keys(now).length + ' 項),afk-synccompress 的假設仍成立。');
  process.exit(0);
}

console.error('❌ 上游動到「存檔寫入/壓縮」了——afk-synccompress(存檔即時壓縮)可能會寫出讀不回來的存檔。');
if (missing.length) console.error('   找不到(改名/移除?):' + missing.join('、'));
if (changed.length) console.error('   內容變了:' + changed.join('、'));
if (added.length) console.error('   新增受監控項:' + added.join('、'));
if (gone.length) console.error('   基準裡有、現在抓不到:' + gone.join('、'));
console.error('');
console.error('   要做的事:');
console.error('     1. 讀上游這幾支的 diff(js/00-data.js),看存檔前綴/Worker 對帳/失敗退路有沒有變。');
console.error('     2. 對照 afk-synccompress.js:它覆寫 _lzSet、bump _lzWorkerRev、自己拼 "LZ1:"+compressToUTF16、退路呼叫 _lsSet。');
console.error('     3. 有影響就先改外掛(或先把該外掛鎖成不可勾),沒影響再跑:node scripts/check-save-io.mjs --accept');
process.exit(1);
