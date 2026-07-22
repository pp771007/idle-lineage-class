/* ============================================================================
 * afk-enhtarget.js — 快速強化目標值上限 +12 → +15
 *
 * 核心的「⚡ 快速強化」(背包武器/防具分頁的批次強化)目標下拉硬寫 +1~+12
 * (js/10 buildQuickEnhanceHeader),有玩家嫌太低。其實執行端(_quickEnhanceUnit)
 * 只鉗各裝備自己的強化上限(enhanceCap=淬鍊),+13~+15 本來就能單抽衝到——
 * 純粹是下拉選單沒給選項。本外掛把選項補到 +15;超過個別裝備上限的目標,
 * 核心本來就會逐件夾到該裝備的上限,不會衝過頭。
 *
 * 作法:包 buildQuickEnhanceHeader,在回傳表頭裡的目標 select 補 +13~+15 選項
 * (玩家選過的目標 >12 時重繪也保得住選取狀態)。核心函式不在 → warn 後停用。
 *
 * 掛接:在 index.html 的 </body> 前 <script src="afk-enhtarget.js">。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'enhtarget', name: '快速強化可衝到 +15', group: '遊戲介面', def: true,
      desc: '背包「⚡ 快速強化」的目標值選單從最高 +12 補到 +15（超過個別裝備上限的部分仍會被上限擋住，不會衝過頭）'
    });
  }
  function on() { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('enhtarget'); }

  var MAX_TARGET = 15;   // 上游下拉硬寫 12;執行端只鉗 enhanceCap(各裝備淬鍊上限),15 在單抽本來就衝得到

  function init() {
    if (typeof window.buildQuickEnhanceHeader !== 'function' || typeof quickEnh === 'undefined') {
      console.warn('[AFK-enhtarget] 缺少核心函式/狀態(buildQuickEnhanceHeader/quickEnh),快速強化上限擴充停用。');
      return;
    }
    var orig = window.buildQuickEnhanceHeader;
    window.buildQuickEnhanceHeader = function (type) {
      var hdr = orig.apply(this, arguments);
      try {
        if (!on()) return hdr;
        var st = quickEnh[type];
        var sel = hdr && hdr.querySelector ? hdr.querySelector('select[id^="qe-target-"]') : null;
        if (!st || !st.active || !sel) return hdr;
        for (var t = 13; t <= MAX_TARGET; t++) {
          var op = document.createElement('option');
          op.value = t; op.textContent = '+' + t;
          if ((st.target || 0) === t) op.selected = true;
          sel.appendChild(op);
        }
      } catch (e) {}
      return hdr;
    };
    console.log('[AFK-enhtarget] hooks OK — 快速強化目標值可選到 +' + MAX_TARGET + '。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
