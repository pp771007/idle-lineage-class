/**
 * apply-core-patches.mjs — 在「拉進上游原版核心」之後，自動把加掛版必要的核心鉤子補回去。
 *
 * 設計原則（給自動更新流程用，取代舊的整檔合併）：
 *   - 冪等：已補過就跳過（可重複跑）。
 *   - 錨點式：靠「函式/註解特徵字串」定位，不寫死行號 → 上游小改版大多仍插得進去。
 *   - 失敗大聲：錨點找不到就 throw（exit 1）→ CI 紅，讓人知道要修錨點，而不是默默讓離線壞掉。
 *
 * 目前的核心補丁（越少越好）：
 *   1. maybeSpawnMobs — 把 js/03 tick() 內「出怪排程」那一塊 { } 抽成具名函式，讓離線快速結算
 *      能用「與線上同一份」的出怪排程（出怪延遲/BOSS 節流/後排格/席琳日光加速全照原作）。
 *      其餘離線鉤子（saveGame/loadGame/changeMap/killMob/gainItem 包裝、結算期間靜音渲染）
 *      一律由 afk-offline.js 外掛自己 monkey-patch，不動核心。
 *
 * 用法：node scripts/apply-core-patches.mjs        （--check 只驗證是否已全部補上、不寫檔）
 */
import { readFileSync, writeFileSync } from 'node:fs';

const CHECK = process.argv.includes('--check');
let changed = 0, already = 0;

// ── 小工具：從指定 index 的 '{' 找到配對的 '}'（略過字串/註解外的括號；此處程式碼夠單純故用簡易配對）──
function matchBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  throw new Error('matchBrace: 找不到配對的 }（自 index ' + openIdx + '）');
}

// ── 補丁 1：抽出 maybeSpawnMobs ────────────────────────────────
function patchMaybeSpawnMobs() {
  const FILE = 'js/03-combat-core.js';
  let s = readFileSync(FILE, 'utf8');

  if (/function\s+maybeSpawnMobs\s*\(/.test(s)) { already++; return; }   // 冪等

  // 錨點：出怪判定那段的開頭註解（上游原文，穩定）
  const ANCHOR = '// === 出怪判定：以邏輯 tick';
  const aIdx = s.indexOf(ANCHOR);
  if (aIdx < 0) throw new Error(`[${FILE}] 找不到出怪判定錨點「${ANCHOR}」——上游可能改寫了 tick 出怪段，請人工檢查後更新錨點。`);

  // 錨點之後第一個 '{' 就是那塊的開頭；找它的配對 '}'
  const openIdx = s.indexOf('{', aIdx);
  if (openIdx < 0) throw new Error(`[${FILE}] 錨點後找不到出怪塊的 '{'。`);
  const closeIdx = matchBrace(s, openIdx);
  const body = s.slice(openIdx + 1, closeIdx);   // 塊內程式碼（不含外層大括號）

  // 在 function tick() 之前插入具名函式；把原塊替換成呼叫
  const TICK_ANCHOR = 'function tick() {';
  const tIdx = s.indexOf(TICK_ANCHOR);
  if (tIdx < 0) throw new Error(`[${FILE}] 找不到「${TICK_ANCHOR}」錨點。`);

  const fnDef =
    '// 🔌 加掛版補丁(apply-core-patches)：出怪排程抽成具名函式，供 afk-offline 離線快速結算與 tick() 共用同一份排程。\n' +
    'function maybeSpawnMobs() {' + body + '}\n';

  // 先替換塊（用 index 由後往前處理避免位移）
  s = s.slice(0, openIdx) + '{ maybeSpawnMobs(); }' + s.slice(closeIdx + 1);
  // 重新定位 tick 錨點（前面替換過，位置變了，但 tick 在 aIdx 之前，未受影響——保險起見重找）
  const tIdx2 = s.indexOf(TICK_ANCHOR);
  s = s.slice(0, tIdx2) + fnDef + s.slice(tIdx2);

  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] maybeSpawnMobs 抽取完成（${FILE}）`);
}

// ── 補丁 2：gainItem 自帶強化值鉤子（偽傳統／自動衝裝）────────────
//   上游把傳統模式挖掉後 `let _tEn = 0;` 寫死。改成呼叫外掛鉤子 window.__afkTradRollEn(d, forceNormal, _noAffixCtx)：
//   afk-traditional.js 提供它 → 對「該角色有開偽傳統 + 非商店(forceNormal 假) + 裝備」回傳隨機強化值，其餘回 0。
//   未載外掛/未開 → 恆 0，與原版完全一致。詞綴/疊加/簽章全走上游原路（en 在簽章之前就定好，堆疊正確）。
function patchTradEnHook() {
  const FILE = 'js/08-items-equip.js';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes('__afkTradRollEn')) { already++; return; }

  const ANCHOR = 'let _tEn = 0;   // 🏛️ v3.0.83 傳統模式已取消：掉落自帶強化值停用（任何來源恆 +0·手動強化照常）';
  if (s.indexOf(ANCHOR) < 0) throw new Error(`[${FILE}] 找不到 gainItem 的 _tEn 錨點——上游可能改寫了掉落強化段，請人工檢查後更新錨點。`);

  const REPLACE = "let _tEn = (typeof window.__afkTradRollEn === 'function') ? (window.__afkTradRollEn(d, forceNormal, _noAffixCtx) || 0) : 0;   // 🔌 加掛版補丁：偽傳統(自動衝裝)自帶強化值鉤子（外掛 afk-traditional 提供；未載/未開→0）";
  s = s.replace(ANCHOR, REPLACE);

  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] gainItem _tEn 偽傳統鉤子（${FILE}）`);
}

// ── 補丁 3：存檔位 8 → 16（加掛版原有功能，上游只有 8 格）──────────
//   上游把格數硬寫死在 3 處：js/13 anySaveExists、js/13 選檔清單渲染迴圈、js/06 allySlotList（招募）。
//   改成用 SAVE_SLOT_MAX=16（定義於 js/13，執行期全域，afk-wiki/afk-diag/afk-traditional 的選角面板也讀它）。
function patch16Slots() {
  // js/13：定義 SAVE_SLOT_MAX + anySaveExists + 選檔渲染迴圈
  const F13 = 'js/13-shop-save.js';
  let s13 = readFileSync(F13, 'utf8');
  if (!s13.includes('SAVE_SLOT_MAX')) {
    const A1 = "function anySaveExists(){ return ['1','2','3','4','5','6','7','8'].some(n => _lsGet('lineage_idle_save_' + n)); }";
    if (s13.indexOf(A1) < 0) throw new Error(`[${F13}] 找不到 anySaveExists 8 格錨點——上游可能改了存檔位邏輯。`);
    s13 = s13.replace(A1,
      "const SAVE_SLOT_MAX = 16;   // 🔌 加掛版補丁：存檔位 8 → 16（選檔清單/anySaveExists/傭兵招募/選角面板共用）\n"
      + "function anySaveExists(){ for(let n=1;n<=SAVE_SLOT_MAX;n++){ if(_lsGet('lineage_idle_save_'+n)) return true; } return false; }");
    const A2 = "for(let n = 1; n <= 8; n++){";   // 單行錨點（檔案為 CRLF，避開跨行 \n）；js/13 唯一
    if (s13.indexOf(A2) < 0) throw new Error(`[${F13}] 找不到選檔渲染 8 格迴圈錨點。`);
    s13 = s13.replace(A2, "for(let n = 1; n <= SAVE_SLOT_MAX; n++){");
    if (!CHECK) writeFileSync(F13, s13);
    changed++;
    console.log(`[patch] 存檔位 16 格（${F13}）`);
  } else { already++; }

  // js/06：傭兵招募可選存檔位
  const F06 = 'js/06-status-allies.js';
  let s06 = readFileSync(F06, 'utf8');
  const A3 = "['1','2','3','4','5','6','7','8'].filter(n => n !== String(currentSlot))";
  if (s06.indexOf(A3) >= 0) {
    s06 = s06.replace(A3, "(function(){ let a=[]; for(let n=1;n<=SAVE_SLOT_MAX;n++){ if(String(n)!==String(currentSlot)) a.push(String(n)); } return a; })()");
    if (!CHECK) writeFileSync(F06, s06);
    changed++;
    console.log(`[patch] 傭兵招募 16 格（${F06}）`);
  } else if (!s06.includes('SAVE_SLOT_MAX')) {
    throw new Error(`[${F06}] 找不到 allySlotList 8 格錨點——上游可能改了招募邏輯。`);
  } else { already++; }
}

const PATCHES = [patchMaybeSpawnMobs, patchTradEnHook, patch16Slots];

try {
  for (const p of PATCHES) p();
} catch (e) {
  console.error('❌ apply-core-patches 失敗：' + e.message);
  process.exit(1);
}

if (CHECK) {
  if (changed > 0) { console.error(`❌ --check：有 ${changed} 個核心補丁尚未套用（請跑 node scripts/apply-core-patches.mjs）`); process.exit(1); }
  console.log(`✅ --check：全部 ${already} 個核心補丁均已就位。`);
} else {
  console.log(`✅ apply-core-patches 完成：新套用 ${changed}、已存在 ${already}。`);
}
