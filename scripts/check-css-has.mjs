#!/usr/bin/env node
/* ============================================================================
 * check-css-has.mjs — 擋下「:has() 參數裡看 .hidden」這種會讓手機一直卡頓的 CSS
 *
 * 為什麼要這支:`祖先:has(#某元素:not(.hidden)) …` 讓畫面上「任何」元素切換 hidden 時,瀏覽器都得把
 *   那個祖先底下整棵子樹重算樣式。遊戲戰鬥中每秒切 hidden 幾十次 → 手機長時間卡頓、發熱。
 *   踩過:10 條這種規則讓手機模擬(CPU 4x)掛機 30 秒樣式重算 4.8~7.8 秒、長任務 30 次;
 *   改成核心 js/10 的 syncViewStateClasses(只盯那個元素自己,同步成 body class)後 ~1 秒、4 次。
 *
 * 判準:CSS 規則(css/*.css、index.html、外掛/核心 JS 裡注入的樣式字串)出現 `:has(…)`,且括號內提到 `.hidden`。
 *   要「某元素顯示時改別的東西的樣式」→ 把那個元素加進 js/10 syncViewStateClasses 的 MAP,CSS 改讀 body class。
 *   (怪物列等 `:has(.mob-back)` 這類不看 .hidden、只在小範圍內的不擋——實測對效能沒影響。)
 *
 * 掛在:prepush-guard.mjs(push 前硬擋)。exit 1 = 有違規規則。
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ls = (dir, re) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => re.test(f)).map((f) => (dir === '.' ? f : `${dir}/${f}`));
const FILES = [...ls('css', /\.css$/), 'index.html', ...ls('js', /\.js$/), ...ls('.', /^afk-.*\.js$/)];

// 從 `:has(` 之後抓到對應的右括號(參數本身可能還有 :not(...) 等巢狀括號)
function hasArgs(line) {
  const out = [];
  let i = 0;
  while ((i = line.indexOf(':has(', i)) >= 0) {
    let depth = 0, j = i + 4;
    for (; j < line.length; j++) {
      if (line[j] === '(') depth++;
      else if (line[j] === ')' && --depth === 0) break;
    }
    out.push(line.slice(i + 5, j));
    i = j;
  }
  return out;
}

const bad = [];
for (const f of FILES) {
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/);   // Windows 的 CRLF：行尾留著 \r 會讓下面「註解行不算」的 .*$ 對不上
  lines.forEach((line, n) => {
    const code = line.replace(/^\s*(\/\/|\*|\/\*).*$/, '');   // 註解行不算
    for (const arg of hasArgs(code)) if (/\.hidden\b/.test(arg)) bad.push(`${f}:${n + 1}  :has(${arg})`);
  });
}

if (bad.length) {
  console.error(`❌ ${bad.length} 條 CSS 用 :has() 看 .hidden(手機會一直整頁重算樣式而卡頓):`);
  bad.forEach((b) => console.error('  ' + b));
  console.error('  改法:把那個元素加進 js/10-ui-tabs.js syncViewStateClasses 的 MAP,CSS 改讀它同步到 body 的 class。');
  process.exit(1);
}
console.log('✅ 沒有 :has() 看 .hidden 的 CSS。');
