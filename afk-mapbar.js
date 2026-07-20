/* ============================================================================
 * afk-mapbar.js — 手機「冒險地圖」標題列壓成兩排（純 CSS，不動任何 DOM 與行為）
 *
 * 上游手機版把這列排成三排（實測 390px 寬：標題 28px + 控制 124px ＝ 176px）：
 *   ①「冒險地圖」標題　②黑市｜瞬移　③出發｜地區下拉　④地圖下拉
 *   每顆按鈕都吃 flex:1 1 50% → 短標籤（黑市/瞬移/出發）也各佔半排，很快就換行。
 * 本外掛壓成兩排（實測降到 ~85px，省一半）：
 *   ① 黑市｜瞬移｜出發（短按鈕改成等分同一排）　② 地區下拉｜地圖下拉
 *   「冒險地圖」四個字在手機上是廢話（人就在戰鬥畫面），字級歸零讓它不佔高度，
 *   但同一行裡的狀態提示(#status-alerts)與攻城倒數(#siege-timer)有自己的字級，照常顯示。
 *
 * ⚠ 按鈕高度維持 38px 不縮：這裡是點擊目標，省高度要從「排數」省，不是從「好不好點」省。
 * ⚠ 復活鈕（祈求復活／原地復活）標籤長又要緊急點，獨佔整排不參與擠壓；樓層提示同理。
 *
 * 手機判定用「與核心的手機版面同一條 media query」寫在 @media 裡，桌機完全不受影響；
 *   不讀 afk-mobile 的 body.m-mobile（那支可被玩家關掉，靠它會變成關了就恢復三排）。
 * 掛接：在 index.html 的 </body> 前 <script src="afk-mapbar.js">。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('mapbar')) return;   // 🎚️ 外掛開關:關掉就回上游三排

  // 與 css/style.css 手機版面那條完全一致(改一邊要改兩邊,不一致會出現「桌機被壓」或「手機沒壓到」)
  var MOBILE_MQ = '(max-width: 768px), (max-height: 520px) and (pointer: coarse)';
  var HDR = '#map-view-panel > .panel-header';

  function injectCSS() {
    if (document.getElementById('afk-mapbar-style')) return;
    var s = document.createElement('style');
    s.id = 'afk-mapbar-style';
    s.textContent = [
      '@media ' + MOBILE_MQ + '{',
      /* 「冒險地圖」字級歸零 → 不佔高度;子元素(狀態提示/攻城倒數)自己有字級,不受繼承影響 */
      /* ⚠ 字級歸零還不夠:沒訊息時 #status-alerts 是「空但存在」的行內元素,仍用自己的字級撐出一整行行高
         → 整排照樣佔 28px。要把空的收起來 + 行高歸零,這排才真的塌掉(留訊息時再由子元素自己撐開)。 */
      HDR + ' > span{font-size:0 !important;line-height:0 !important;gap:4px !important;}',
      HDR + ' > span > span:empty{display:none !important;}',
      HDR + ' > span > span{line-height:1.4 !important;}',
      /* 短按鈕(黑市/瞬移/出發·回村)改成等分一排:原本 flex:1 1 50% 兩顆就換行 */
      HDR + ' > div > button{flex:1 1 0 !important;min-width:0 !important;padding:4px 6px !important;}',
      /* 復活鈕要緊急點且標籤長 → 不參與擠壓,獨佔整排 */
      HDR + ' #btn-revive,' + HDR + ' #btn-revive-inplace{flex:1 0 100% !important;}',
      '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  function init() {
    if (!document.querySelector(HDR)) {
      console.warn('[AFK-mapbar] 找不到冒險地圖標題列（上游可能改了結構），壓排停用。');
      return;
    }
    injectCSS();
    console.log('[AFK-mapbar] hooks OK — 手機冒險地圖標題列已壓成兩排。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
