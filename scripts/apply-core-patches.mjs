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
//   上游把格數硬寫死在多處：js/13 匯入時的「同角色重複」掃描、js/06 allySlotList（招募）與傭兵受僱
//   登記的四處掃描、js/05 安塔瑞斯每日通關遷移、js/25 clanScanRoles（血盟成員/盟主判定）、
//   js/28 PVP 挑戰自己其他角色的清單。
//   改成用 SAVE_SLOT_MAX=16（定義於 js/13，執行期全域，afk-loadslots/afk-wiki/afk-diag 的選角面板也讀它）。
//   選角畫面本身不必改核心：上游是分頁式卡片（每頁 4 格），afk-loadslots 自行擴充頁數。
function patch16Slots() {
  // js/13：定義 SAVE_SLOT_MAX + 匯入重複掃描涵蓋全部格
  const F13 = 'js/13-shop-save.js';
  let s13 = readFileSync(F13, 'utf8');
  if (!s13.includes('SAVE_SLOT_MAX')) {
    const A1 = "function slotSummary(n){ return _summaryFromRaw(_lzGet('lineage_idle_save_' + n)); }";
    if (s13.indexOf(A1) < 0) throw new Error(`[${F13}] 找不到 slotSummary 錨點——上游可能改了存檔位邏輯。`);
    s13 = s13.replace(A1,
      "const SAVE_SLOT_MAX = 16;   // 🔌 加掛版補丁：存檔位 8 → 16（匯入重複掃描/傭兵招募/選角面板共用）\n" + A1);
    // 匯入存檔時掃「同一角色是否已存在別格」——沒放大就掃不到第 9~16 格，會讓同角色重複進來
    const A2 = "for(let slotN = 1; slotN <= 8; slotN++){";
    if (s13.indexOf(A2) < 0) throw new Error(`[${F13}] 找不到匯入重複掃描 8 格迴圈錨點。`);
    s13 = s13.replace(A2, "for(let slotN = 1; slotN <= SAVE_SLOT_MAX; slotN++){");
    if (!CHECK) writeFileSync(F13, s13);
    changed++;
    console.log(`[patch] 存檔位 16 格（${F13}）`);
  } else { already++; }

  // js/06：傭兵招募可選存檔位 + 傭兵受僱登記的存檔位掃描
  const F06 = 'js/06-status-allies.js';
  let s06 = readFileSync(F06, 'utf8');
  let dirty06 = false;
  const A3 = "['1','2','3','4','5','6','7','8'].filter(n => n !== String(currentSlot))";
  if (s06.indexOf(A3) >= 0) {
    s06 = s06.replace(A3, "(function(){ let a=[]; for(let n=1;n<=SAVE_SLOT_MAX;n++){ if(String(n)!==String(currentSlot)) a.push(String(n)); } return a; })()");
    dirty06 = true;
    changed++;
    console.log(`[patch] 傭兵招募 16 格（${F06}）`);
  } else if (!s06.includes('SAVE_SLOT_MAX')) {
    throw new Error(`[${F06}] 找不到 allySlotList 8 格錨點——上游可能改了招募邏輯。`);
  } else { already++; }

  // 傭兵受僱登記（bootstrap 遷移／受僱查詢／選角徽章／獨佔判定）四處各自掃全部存檔位。
  //   漏放大 → 僱主在第 9~16 格時，傭兵不顯示徽章、不受安全區限制、也擋不住被第二位僱主重複招募。
  const A3B_FROM = 'for (let n = 1; n <= 8; n++) {';
  const A3B_TO = 'for (let n = 1; n <= SAVE_SLOT_MAX; n++) {';
  if (s06.indexOf(A3B_FROM) >= 0) {
    s06 = s06.split(A3B_FROM).join(A3B_TO);
    dirty06 = true;
    changed++;
    console.log(`[patch] 傭兵受僱掃描 16 格（${F06}）`);
  } else if (s06.indexOf(A3B_TO) < 0) {
    throw new Error(`[${F06}] 找不到傭兵受僱登記的 8 格迴圈錨點——上游可能改了受僱判定，請確認第 9~16 格仍被掃到。`);
  } else { already++; }
  if (dirty06 && !CHECK) writeFileSync(F06, s06);

  // js/05：安塔瑞斯副本「模式共用每日通關」的舊資料遷移掃描
  const F05 = 'js/05-kill-progression.js';
  let s05 = readFileSync(F05, 'utf8');
  if (s05.indexOf(A3B_FROM) >= 0) {
    s05 = s05.split(A3B_FROM).join(A3B_TO);
    if (!CHECK) writeFileSync(F05, s05);
    changed++;
    console.log(`[patch] 安塔瑞斯通關遷移掃描 16 格（${F05}）`);
  } else if (s05.indexOf(A3B_TO) < 0) {
    throw new Error(`[${F05}] 找不到 antharasSharedClearDay 的 8 格迴圈錨點——上游可能改了副本每日通關遷移。`);
  } else { already++; }

  // js/25：血盟成員掃描（成員清單＋貢獻度、clanLeaderRole 找盟主、城鎮 NPC 的「有無君主」判斷都經這裡）
  const F25 = 'js/25-clan-system.js';
  let s25 = readFileSync(F25, 'utf8');
  const A4 = "for (let slot = 1; slot <= 8; slot++) {";
  if (s25.indexOf(A4) >= 0) {
    s25 = s25.replace(A4, "for (let slot = 1; slot <= SAVE_SLOT_MAX; slot++) {");
    if (!CHECK) writeFileSync(F25, s25);
    changed++;
    console.log(`[patch] 血盟成員掃描 16 格（${F25}）`);
  } else if (!s25.includes('SAVE_SLOT_MAX')) {
    throw new Error(`[${F25}] 找不到 clanScanRoles 8 格迴圈錨點——上游可能改了血盟成員掃描。`);
  } else { already++; }

  // js/28：PVP 面板「挑戰自己其他角色」的候選清單
  const F28 = 'js/28-pvp-arena.js';
  let s28 = readFileSync(F28, 'utf8');
  const A5 = "for (let n = 1; n <= 8; n++) {";
  if (s28.indexOf(A5) >= 0) {
    s28 = s28.replace(A5, "for (let n = 1; n <= SAVE_SLOT_MAX; n++) {");
    if (!CHECK) writeFileSync(F28, s28);
    changed++;
    console.log(`[patch] PVP 對手清單 16 格（${F28}）`);
  } else if (!s28.includes('SAVE_SLOT_MAX')) {
    throw new Error(`[${F28}] 找不到 PVP 對手清單 8 格迴圈錨點——上游可能改了 PVP 面板。`);
  } else { already++; }
}

// ── 補丁 4：js/22 寵/召 sprite ticker 改「間接呼叫」──────────────
//   上游 setInterval(_petAnimApply, …) 直接捕捉原函式參照 → afk-powersave 的 wrapper 攔不到
//   (關戰鬥動畫後寵物/召喚照樣動)。改箭頭間接呼叫=每次經全域解析,外掛包得住。
function patchPetAnimTicker() {
  const FILE = 'js/22-pets.js';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes('setInterval(() => { _petAnimApply(); }')) { already++; return; }
  const ANCHOR = 'setInterval(_petAnimApply, 1000 / PET_ANIM_FPS);';
  if (s.indexOf(ANCHOR) < 0) throw new Error(`[${FILE}] 找不到 _petAnimApply ticker 錨點——上游可能改寫了寵物動畫排程。`);
  s = s.replace(ANCHOR, 'setInterval(() => { _petAnimApply(); }, 1000 / PET_ANIM_FPS);   // 🔌 加掛版補丁:間接呼叫讓外掛(省電模式)wrapper 攔得住;直接傳參照會被捕死原函式');
  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] 寵/召 sprite ticker 間接呼叫（${FILE}）`);
}

// ── 補丁 5：js/07 迴避頭目 與 外掛「自動找BOSS」互斥 ─────────────
//   afk-bossring 召來的王若被「迴避頭目(瞬移卷軸)」自動逃離立刻瞬移走=功能互咬。
//   逃離條件加 !_huntBoss(讀外掛暴露的 AFK_BOSSRING.huntActive();外掛未載=false 照常)。
function patchBossHuntEscape() {
  const FILE = 'js/07-skills-cast.js';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes('AFK_BOSSRING')) { already++; return; }
  const A1 = "let tChk = document.getElementById('set-teleport');";
  const A2 = 'if (tChk && tChk.checked && mapState.mobs.some(m => m && m.boss && !m.noAutoTeleport)';
  if (s.indexOf(A1) < 0 || s.indexOf(A2) < 0) throw new Error(`[${FILE}] 找不到迴避頭目錨點——上游可能改寫了自動瞬移段。`);
  s = s.replace(A1, A1 + "\n        let _huntBoss = !!(window.AFK_BOSSRING && window.AFK_BOSSRING.huntActive && window.AFK_BOSSRING.huntActive());   // 🔌 加掛版補丁:外掛「自動找BOSS」進行中→抑制逃離(否則剛召來的王立刻被瞬移走);外掛未載入=false 照常");
  s = s.replace(A2, 'if (tChk && tChk.checked && !_huntBoss && mapState.mobs.some(m => m && m.boss && !m.noAutoTeleport)');
  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] 迴避頭目×自動找BOSS互斥（${FILE}）`);
}

// ── 補丁 6：js/08 useItem 加 keepModal 參數 ─────────────────────
//   外掛自動瞬移(afk-bossring)非 silent 使用卷軸時,上游會 closeModal() 把玩家開著的物品視窗關掉。
//   加第三參數 keepModal 讓自動路徑保留視窗(未傳=false,原行為不變)。
function patchUseItemKeepModal() {
  const FILE = 'js/08-items-equip.js';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes('keepModal')) { already++; return; }
  const A1 = 'function useItem(u, silent = false) {';
  const A2 = "if(!silent && document.getElementById('item-modal').classList.contains('hidden') === false";
  if (s.indexOf(A1) < 0 || s.indexOf(A2) < 0) throw new Error(`[${FILE}] 找不到 useItem 錨點——上游可能改寫了簽名或關窗段。`);
  s = s.replace(A1, 'function useItem(u, silent = false, keepModal = false) {   // 🔌 加掛版補丁 keepModal:自動觸發(如外掛自動瞬移)非 silent 使用時,不關玩家開著的物品視窗');
  s = s.replace(A2, "if(!silent && !keepModal && document.getElementById('item-modal').classList.contains('hidden') === false");
  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] useItem keepModal（${FILE}）`);
}

// ── 補丁 7：js/10 「立即賣出」不再無條件強制套規則 ─────────────────
//   上游 sellAutoSellItemsNow 無條件 applyAutoSellRules(true)(force)→玩家把自動販賣總開關關掉後
//   按「立即賣出」,仍當場依規則把沒標過的裝備標成廢品賣掉(玩家回報:武官護鎧被莫名賣掉;舊 main ab230707dc)。
//   改為只有總開關開著才 force;關閉時只賣玩家已手動標記的廢品(applyAutoSellRules(false) 會清規則舊標記)。
function patchSellNowNoForce() {
  const FILE = 'js/10-ui-tabs.js';
  let s = readFileSync(FILE, 'utf8');
  if (s.includes('applyAutoSellRules(player.autoSellOn!==false)')) { already++; return; }
  const ANCHOR = 'function sellAutoSellItemsNow(){_readAutoSellForm();_asBackup=null;applyAutoSellRules(true);';
  if (s.indexOf(ANCHOR) < 0) throw new Error(`[${FILE}] 找不到 sellAutoSellItemsNow 錨點——上游可能改寫了立即賣出,請人工檢查(此補丁防「關閉自動販賣仍被強制套規則賣裝」)。`);
  s = s.replace(ANCHOR, 'function sellAutoSellItemsNow(){_readAutoSellForm();_asBackup=null;applyAutoSellRules(player.autoSellOn!==false);   /* 🔌 加掛版補丁:總開關關閉→不套規則,只賣手動標記的廢品 */');
  s = s.replace('// 🔧 v2.6.91 force=true：即使開關關閉也強制依規則標記後立即賣', '// 🔌 加掛版補丁:開關開著才 force 套規則;關閉時只賣手動標記(上游原為無條件 force)');
  if (!CHECK) writeFileSync(FILE, s);
  changed++;
  console.log(`[patch] 立即賣出不強制套規則（${FILE}）`);
}


const PATCHES = [patchMaybeSpawnMobs, patchTradEnHook, patch16Slots, patchPetAnimTicker, patchBossHuntEscape, patchUseItemKeepModal, patchSellNowNoForce];

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
