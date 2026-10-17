/* ============================================================================
 * afk-norelic.js — 隱藏遺物系統（不再掉落、不再有入口）（已鎖定：一律生效、無開關）
 *
 * 遺物＝上游 isRelic(d)（d.relic 為真）的道具。本檔在載入時：
 *   取得管道：怪物掉落表（MOB_DROPS 等）、玩家 NPC 遺物掉落池（_relicDropPool＝空）、
 *            潘朵拉抽獎（gachaWeight 歸 0）、商店清單、製作配方（成品是遺物）、收藏冊「有取得管道」名單，
 *            最後在 gainItem 兜底擋下。
 *   介面入口：收藏面板的「🏺 遺物」收集冊、潘朵拉（黑市）的遺物布告欄與遺物搜尋候補 —— 只藏不刪。
 * 已裝備/持有的遺物不動（照樣能用、能賣），只是拿不到新的。
 * 2026-10-14 起遺物系統永久關閉：不進外掛開關面板、玩家關不掉（舊版玩家存的 afk_toggle_norelic=0 一律忽略）。
 * 「席琳遺骸」另由核心 SHERINE_CLOSED（js/01）關閉取得管道，不在本檔。
 *
 * 掛接：在 index.html 的 </body> 前 <script src="afk-norelic.js">（核心之後）。
 * ========================================================================== */
(function () {
  'use strict';

  // 已鎖定：不 register、不問 AFK_TOGGLES（站長決定遺物系統永久關閉）。
  if (typeof DB === 'undefined' || !DB.items || typeof isRelic !== 'function') { console.warn('[AFK-norelic] 找不到 DB.items / isRelic，停用。'); return; }

  var blocked = {}, n = 0;
  Object.keys(DB.items).forEach(function (id) { if (isRelic(DB.items[id])) { blocked[id] = true; n++; } });

  // ── 掉落表 ──
  var cutDrops = 0;
  [typeof MOB_DROPS !== 'undefined' ? MOB_DROPS : null,
   typeof DARK_WEAPON_DROPS !== 'undefined' ? DARK_WEAPON_DROPS : null,
   typeof DARK_CRYSTAL_DROPS !== 'undefined' ? DARK_CRYSTAL_DROPS : null].forEach(function (tbl) {
    if (!tbl || typeof tbl !== 'object') return;
    Object.keys(tbl).forEach(function (mob) {
      var arr = tbl[mob]; if (!Array.isArray(arr)) return;
      for (var i = arr.length - 1; i >= 0; i--) { var id = Array.isArray(arr[i]) ? arr[i][0] : arr[i]; if (blocked[id]) { arr.splice(i, 1); cutDrops++; } }
    });
  });

  // ── 玩家 NPC 遺物掉落池：上游懶建立的快取（null 才建），給空陣列＝抽不到 ──
  try { _relicDropPool = []; } catch (e) { console.warn('[AFK-norelic] 遺物池無法清空', e); }

  // ── 抽獎／商店／製作／收藏冊名單 ──
  Object.keys(blocked).forEach(function (id) { if (DB.items[id].gachaWeight) DB.items[id].gachaWeight = 0; });
  try {
    if (typeof SHOP_LISTS === 'object' && SHOP_LISTS) Object.keys(SHOP_LISTS).forEach(function (k) {
      var l = SHOP_LISTS[k]; if (!Array.isArray(l)) return;
      for (var i = l.length - 1; i >= 0; i--) if (blocked[l[i]]) l.splice(i, 1);
    });
  } catch (e) {}
  function stripRecipes(arr) { if (!Array.isArray(arr)) return; for (var i = arr.length - 1; i >= 0; i--) if (arr[i] && blocked[arr[i].result]) arr.splice(i, 1); }
  try {
    if (typeof CRAFT_RECIPES === 'object' && CRAFT_RECIPES) Object.keys(CRAFT_RECIPES).forEach(function (k) { stripRecipes(CRAFT_RECIPES[k]); });
    if (typeof DEMONKING_RECIPES !== 'undefined') stripRecipes(DEMONKING_RECIPES);
    if (typeof MYSTICWAND_RECIPES !== 'undefined') stripRecipes(MYSTICWAND_RECIPES);
    if (typeof SLAYER_RECIPES !== 'undefined') stripRecipes(SLAYER_RECIPES);
  } catch (e) {}
  try { if (typeof OBTAINABLE_MISC === 'object' && OBTAINABLE_MISC) Object.keys(blocked).forEach(function (id) { delete OBTAINABLE_MISC[id]; }); } catch (e) {}

  // ── 兜底：任何來源要給遺物都不給（黑市遺物布告欄兌換等） ──
  if (typeof window.gainItem === 'function') {
    var _origGain = window.gainItem;
    window.gainItem = function (id) {
      if (blocked[id]) { console.info('[AFK-norelic] 擋下取得遺物：' + ((DB.items[id] && DB.items[id].n) || id)); return null; }
      return _origGain.apply(this, arguments);
    };
  }

  // ── 介面入口：只藏不刪 ──
  var st = document.createElement('style');
  st.id = 'afk-norelic-style';
  st.textContent = [
    'button[onclick^="collectionOpenRelic"]{display:none !important;}',   // 收藏面板「🏺 遺物」
    '#relic-book{display:none !important;}',                                // 遺物收集冊本體（萬一從別處被打開）
    '.pandora-relic-board,.pandora-relic-suggestion{display:none !important;}'   // 黑市遺物布告欄、遺物搜尋候補
  ].join('\n');
  (document.head || document.documentElement).appendChild(st);

  console.log('[AFK-norelic] hooks OK — 遺物 ' + n + ' 件不再取得（掉落表移除 ' + cutDrops + ' 筆），入口已隱藏。');
})();
