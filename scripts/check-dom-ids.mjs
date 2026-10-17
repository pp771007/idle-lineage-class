#!/usr/bin/env node
/* ============================================================================
 * check-dom-ids.mjs — 抓外掛「問一個不存在的 DOM id」這種靜默失效
 *
 * 為什麼要這支:外掛靠 getElementById 讀上游的設定勾選框。上游改版把某個 id 刪掉時,
 *   getElementById 回 null → 依賴它的條件永遠是假 → 那段功能安靜消失,無錯誤、無警告。
 *   踩過:afk-offline 的快速段補瞬移卷軸讀 set-auto-buy-teleport(上游 v3.3.15 把「自動購買」
 *   併進「自動使用」時刪掉了)→「迴避頭目」在整個快速段等於沒勾,離線把玩家想躲的 BOSS 全殺了。
 *
 * 判準:afk-*.js 引用的字面 id,若在「產生端」(index.html / js/*.js / afk-*.js 的 id= 屬性、
 *   .id 賦值、setAttribute('id',…))完全找不到 → 可疑。動態拼接的 id 抽不到字面值,自然略過。
 *
 * 掛在:sync-upstream.mjs 流程尾端(上游刪 id 的當天就抓到)＋ prepush-guard.mjs(push 前兜底,
 *   以 --check 呼叫——本腳本無參數差異,行為一致)。exit 1 = 有外掛在問已不存在的上游 id。
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const ls = (dir, re) => fs.readdirSync(path.join(ROOT, dir)).filter(f => re.test(f)).map(f => (dir === '.' ? f : `${dir}/${f}`));

const PLUGINS = ls('.', /^afk-.*\.js$/);
const CORE_JS = ls('js', /\.js$/);
const ALL_SOURCES = ['index.html', ...CORE_JS, ...PLUGINS];

// ---- 產生端:這個 id 有沒有任何地方「做出來」過 -----------------------------
const produced = new Set();
const PRODUCERS = [
  /\bid\s*=\s*"([A-Za-z][\w:-]*)"/g,              // <div id="x">
  /\bid\s*=\s*'([A-Za-z][\w:-]*)'/g,
  /\.id\s*=\s*['"`]([A-Za-z][\w:-]*)['"`]/g,      // el.id = 'x'
  /setAttribute\(\s*['"`]id['"`]\s*,\s*['"`]([A-Za-z][\w:-]*)['"`]/g,
];
for (const f of ALL_SOURCES) {
  const src = read(f);
  for (const re of PRODUCERS) { let m; re.lastIndex = 0; while ((m = re.exec(src))) produced.add(m[1]); }
}

// ---- 引用端:外掛去問了哪些字面 id -----------------------------------------
const CONSUMERS = [
  /getElementById\(\s*['"`]([^'"`$)]+)['"`]\s*\)/g,          // getElementById('x')
  /querySelector(?:All)?\(\s*['"`]#([A-Za-z][\w:-]*)/g,      // querySelector('#x …')
  /\bclosest\(\s*['"`]#([A-Za-z][\w:-]*)/g,
];
const refs = new Map();   // id → Set<檔名:行號>
for (const f of PLUGINS) {
  const src = read(f);
  const lineOf = i => src.slice(0, i).split('\n').length;
  for (const re of CONSUMERS) {
    let m; re.lastIndex = 0;
    while ((m = re.exec(src))) {
      const id = m[1];
      if (!/^[A-Za-z][\w:-]*$/.test(id)) continue;   // 拼接/含變數 → 抽不到字面值,略過
      if (/-$/.test(id)) continue;                    // '#tab-' + tab 這種前綴拼接 → 同上略過
      if (!refs.has(id)) refs.set(id, new Set());
      refs.get(id).add(`${f}:${lineOf(m.index)}`);
    }
  }
}

const missing = [...refs.keys()].filter(id => !produced.has(id)).sort();
// afk- 前綴＝外掛自建(命名慣例)。自建的 id 若經 helper 傳參建立(mk('afk-wh-allin',…)),本工具抓不到
//   產生端 → 只提醒不擋。會靜默失效的是「我方引用上游的 id」,那才是要擋的。
const mine = missing.filter(id => /^afk-/.test(id));
const upstream = missing.filter(id => !/^afk-/.test(id));

console.log(`掃了 ${PLUGINS.length} 支外掛,引用到 ${refs.size} 個字面 DOM id。`);
if (mine.length) {
  console.log(`\n⚠️  ${mine.length} 個外掛自建 id 找不到產生端(多半是經 helper 傳參建立,工具看不到;順手確認一下就好):`);
  for (const id of mine) console.log(`  ${id}  ← ${[...refs.get(id)].join('、')}`);
}
if (!upstream.length) { console.log('\n✅ 沒有外掛在問「上游已不存在」的 DOM id。'); process.exit(0); }
console.log(`\n❌ ${upstream.length} 個上游 id 找不到任何產生端(上游改版刪掉了、或打錯字)。`);
console.log('   依賴它的條件會永遠不成立,而 getElementById 回 null 不報錯 → 那段功能安靜消失:');
for (const id of upstream) console.log(`  ${id}\n    ← ${[...refs.get(id)].join('、')}`);
process.exit(1);
