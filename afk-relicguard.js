/* ============================================================================
 * afk-relicguard.js — 背包「快速廢品」的全選不要把遺物一起標成廢品
 *
 * 上游的快速廢品面板按「全選」＝該分頁所有未鎖定物品全部勾起來，遺物（🏺）也在內；
 * 玩家想一次清掉一堆雜物時，很容易連遺物一起標成廢品被自動賣掉（玩家回報）。
 *
 * 本外掛只縮小「全選」這顆的作用範圍：
 *   ・全選／取消全選 → 只動非遺物；已經手動勾起來的遺物不會被它連帶勾起或取消。
 *   ・全選框的打勾狀態（含半選）也只看非遺物，否則會出現「明明全選了框卻沒滿」。
 *   ・遺物仍可逐件手動勾選 → 真的想丟的人照樣丟得掉，只是不會「順手」被丟。
 *
 * 作法：包核心的 quickJunkSelectAll()（換掉全選行為）與 buildQuickHeader()（修正表頭那顆
 *   checkbox 的狀態），資格判定沿用核心的 _qjEligibleItems/isRelic（單一真相，上游改規則自動跟著改）。
 *   任何一支核心函式不在 → 印 warn 後安靜停用，不影響遊戲。
 *
 * 掛接：在 index.html 的 </body> 前 <script src="afk-relicguard.js">。
 * ========================================================================== */
(function () {
  'use strict';

  function on() { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('relicguard'); }

  // 全選的作用範圍＝核心認定「可批次標記廢品」的物品扣掉遺物
  function selectable(type) {
    return _qjEligibleItems(type).filter(function (i) { return !isRelic(DB.items[i.id]); });
  }

  function init() {
    var missing = ['quickJunkSelectAll', 'buildQuickHeader', '_qjEligibleItems', 'isRelic', 'renderTabs']
      .filter(function (n) { return typeof window[n] !== 'function'; });
    if (missing.length || typeof quickJunk === 'undefined') {
      console.warn('[AFK-relicguard] 缺少核心函式/狀態（' + (missing.join(',') || 'quickJunk') + '），遺物保護停用。');
      return;
    }

    var origSelectAll = window.quickJunkSelectAll;
    window.quickJunkSelectAll = function (type, checked) {
      if (!on()) return origSelectAll.apply(this, arguments);
      var st = quickJunk[type];
      selectable(type).forEach(function (i) { if (checked) st.sel[i.uid] = true; else delete st.sel[i.uid]; });
      renderTabs(true);
    };

    var origHeader = window.buildQuickHeader;
    window.buildQuickHeader = function (type) {
      var hdr = origHeader.apply(this, arguments);
      if (!on() || !quickJunk[type] || !quickJunk[type].active) return hdr;
      try {
        var cb = hdr.querySelector('label input[type="checkbox"]');
        if (!cb) return hdr;
        var list = selectable(type), sel = quickJunk[type].sel;
        var all = list.length > 0 && list.every(function (i) { return sel[i.uid]; });
        cb.checked = all;
        cb.indeterminate = !all && list.some(function (i) { return sel[i.uid]; });
      } catch (e) {}
      return hdr;
    };

    console.log('[AFK-relicguard] hooks OK — 快速廢品的「全選」不再包含遺物。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
