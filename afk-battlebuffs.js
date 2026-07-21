/* ============================================================================
 * afk-battlebuffs.js — 手機戰鬥畫面下方鏡射一整條「狀態」欄（增益／異常／魔物追蹤）
 *
 * 上游把狀態欄（#dt-buffs：「狀態: 加速 / 保護罩 …」＋「異常: 中毒 …」）放在背包→能力分頁裡，
 * 手機一次只顯示一欄 → 打怪時看不到自己身上有什麼 buff、有沒有中毒，得切分頁去看。
 * 本外掛在戰鬥框正下方插一塊 #m-battle-buffs，把那條狀態欄「整條」鏡射過來（不是挑幾樣），
 * 內容包含 afk-trackinfo 補上去的「🔍 追蹤:怪名 X時Y分」——所以載入順序必須排在它後面。
 *
 * 作法：包核心 renderStatusEffects()（狀態欄本來就是它在寫），原函式跑完後把 innerHTML 複製一份。
 *   ・不另開 timer：狀態欄何時更新，鏡射就何時更新（上游每 tick 會呼叫一次）。
 *   ・內容字串沒變就不寫 DOM（每 tick 都會經過，避免無謂的 innerHTML 重排）。
 *   ・state.ff（離線補跑）期間直接不做事，比照原函式。
 *
 * 顯示時機一律自己判，不讀 afk-mobile 掛的 body class（那支可被玩家關掉）：
 *   ・手機與否 → 與核心手機版面同一條 media query；桌機永遠 display:none（那裡本來就看得到狀態欄）。
 *   ・在不在戰鬥 → 看 #battle-view 有沒有 .hidden（村莊/城鎮時整塊自動收起）。
 *   ・切到背包/隊伍欄時，這塊在 #col-center 裡會跟著整欄隱藏，不必特別處理。
 *
 * 掛接：在 index.html 的 </body> 前 <script src="afk-battlebuffs.js">；DOM 掛點 #m-battle-buffs。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('battlebuffs')) return;   // 🎚️ 外掛開關:關掉就沒有這塊(狀態欄仍在能力分頁裡)

  // 與 css/style.css 手機版面那條完全一致（afk-mapbar / afk-battlehud 也用同一條）
  var MOBILE_MQ = '(max-width: 768px), (max-height: 520px) and (pointer: coarse)';
  var host = null, lastHTML = '';

  function injectCSS() {
    if (document.getElementById('afk-battlebuffs-style')) return;
    var s = document.createElement('style');
    s.id = 'afk-battlebuffs-style';
    s.textContent = [
      '#m-battle-buffs{display:none;}',
      '@media ' + MOBILE_MQ + '{',
      /* .on 由 JS 掛（＝現在在戰鬥畫面且狀態欄有內容）；max-height 讓 buff 一多時自己捲，不把戰鬥框擠掉 */
      '#m-battle-buffs.on{display:block;flex:0 0 auto;margin:2px 12px 8px;padding:8px 12px;max-height:22vh;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y pinch-zoom;overscroll-behavior:contain;background:#0f172a;border:1px solid #334155;border-radius:10px;color:#e2e8f0;font-size:13px;line-height:1.5;}',
      '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  function inBattle() {
    var bv = document.getElementById('battle-view');
    return !!(bv && !bv.classList.contains('hidden'));
  }

  function sync() {
    var src = document.getElementById('dt-buffs');
    if (!host || !src) return;
    var show = inBattle();
    if (host.classList.contains('on') !== show) host.classList.toggle('on', show);
    if (!show) return;                       // 村莊/城鎮：收起來就不必再同步內容
    var html = src.innerHTML;
    if (html === lastHTML) return;           // 每 tick 都會經過 → 沒變就不動 DOM
    host.innerHTML = html;
    lastHTML = html;
  }

  function init() {
    var bv = document.getElementById('battle-view');
    if (!bv || !bv.parentNode || typeof window.renderStatusEffects !== 'function') {
      console.warn('[AFK-battlebuffs] 找不到 #battle-view 或 renderStatusEffects（上游可能改了結構），戰鬥狀態欄停用。');
      return;
    }
    injectCSS();
    host = document.createElement('div');
    host.id = 'm-battle-buffs';
    bv.parentNode.insertBefore(host, bv.nextSibling);   // 戰鬥框正下方

    var orig = window.renderStatusEffects;
    window.renderStatusEffects = function () {
      var r = orig.apply(this, arguments);
      if (typeof state !== 'undefined' && state.ff) return r;   // 離線補跑期間不動畫面
      try { sync(); } catch (e) {}
      return r;
    };
    console.log('[AFK-battlebuffs] hooks OK — 手機戰鬥畫面下方已鏡射狀態欄。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
