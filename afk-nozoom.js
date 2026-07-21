/* ============================================================================
 * afk-nozoom.js — 手機取消「連點兩下放大」（雙擊縮放）
 *
 * 手機瀏覽器預設把「快速點兩下」當成放大手勢。遊戲裡有大量需要連點的按鈕
 * （魔法娃娃合成、NPC 兌換、商店數量…），連點時整頁被放大、又不會自己縮回來。
 *
 * 作法：對 body 設 touch-action:manipulation —— 這個值等於「保留單指捲動＋兩指捏合縮放，
 *   只拿掉雙擊縮放與它附帶的 300ms 點擊延遲」，一條規則蓋全站：
 *   - 兩指捏合放大（無障礙需求）照常可用，不是把縮放整個關掉；
 *   - touch-action 沿觸控鏈取交集 → 其他外掛/上游已寫 none 或 pinch-zoom 的拖曳把手、
 *     裝備框/倉庫框行為完全不受影響（交集後仍是原本更嚴格的那個）；
 *   - 背包「雙擊＝裝備/使用」的 dblclick 事件照發（manipulation 只擋縮放手勢）。
 *
 * 手機判定用「與核心手機版面同一條 media query」自己判，不讀 afk-mobile 掛的 body.m-mobile
 *   ——那支可被玩家關掉，靠它會變成「關了手機版面連雙擊放大也一起回來」的跨外掛耦合。
 * 掛接：在 index.html 的 </body> 前 <script src="afk-nozoom.js">。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('nozoom')) return;   // 🎚️ 外掛開關:關掉就回瀏覽器預設(雙擊會放大)

  // 與 css/style.css 手機版面那條完全一致(其他外掛 afk-mapbar/afk-battlehud 也用同一條)
  var MOBILE_MQ = '(max-width: 768px), (max-height: 520px) and (pointer: coarse)';

  function init() {
    if (document.getElementById('afk-nozoom-style')) return;
    var s = document.createElement('style');
    s.id = 'afk-nozoom-style';
    s.textContent = '@media ' + MOBILE_MQ + '{body{touch-action:manipulation;}}';
    (document.head || document.documentElement).appendChild(s);
    console.log('[AFK-nozoom] hooks OK — 手機已取消雙擊放大（兩指捏合縮放保留）。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
