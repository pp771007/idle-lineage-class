/* ============================================================================
 * afk-nobanner.js — 隱藏「非官方轉載版本」橫幅（已鎖定：一律隱藏、無開關）
 *
 * 站長決定所有玩家都不顯示橫幅。原作授權是「可非商業轉載、須標示出處」,
 *   目前的出處只剩首頁 afk-syncinfo 那列「原作者:秋玥(原版連結)」——動那支之前先想到這點。
 *
 * 橫幅是上游 js/00 的 _origEnforce 在非官方網域蓋的一條 fixed 列（id `_orig_pbar`）,
 *   而 js/03 gameLoop **每 100ms 檢查一次、被移掉就重蓋** —— 所以只能「藏」不能「刪」:
 *   注一條 `#_orig_pbar{display:none}` 就好,元素還在 → _origEnforce 的
 *   `getElementById('_orig_pbar')` 仍為真 → 它自己就不會再蓋一次,不必跟 gameLoop 打架。
 *   藏起來之後 afk-banner 量到高度 0 → --orig-bar-h 歸零、body.afk-bar 拿掉,
 *   讓位規則整組自動失效,版面把那條空間收回去(所以要 remeasure 一次,不必等它輪詢)。
 *
 * 掛接:在 index.html 的 </body> 前 <script src="afk-nobanner.js">(排在 afk-banner 之後)。
 * ========================================================================== */
(function () {
  'use strict';

  var STYLE_ID = 'afk-nobanner-style';

  function init() {
    if (!document.getElementById(STYLE_ID)) {
      var st = document.createElement('style');
      st.id = STYLE_ID;
      st.textContent = '#_orig_pbar{display:none !important;}';
      (document.head || document.documentElement).appendChild(st);
    }
    if (window.AFK_BANNER && typeof AFK_BANNER.remeasure === 'function') AFK_BANNER.remeasure();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
