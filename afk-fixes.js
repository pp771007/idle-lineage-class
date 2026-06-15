/* ============================================================================
 * afk-fixes.js — 通用修正外掛(補原作者上游坑;桌機 / 手機皆適用,與裝置判定無關)
 *
 * 收容「不綁手機 / 不綁離線 / 不綁查詢」的通用修正。每一段都要:
 *   1) 優雅降級——抓不到掛點就安靜停用,不弄壞遊戲;
 *   2) 在段落檔頭寫明「原作者怎麼改就能整段刪」。
 *      (見 CLAUDE.md 外掛原則:只有『過時後仍會主動執行』的補坑碼才標移除條件,本檔即屬此類。)
 *
 * 掛接:在 index.html </body> 前加一行
 *   <script src="afk-fixes.js"></script>
 * ========================================================================== */
(function () {
  'use strict';

  /* --------------------------------------------------------------------------
   * 修正#1:renderTabs select-guard — 戰鬥中操作下拉選單不被刷掉
   *
   * 問題:「快速強化(批次衝裝)」的目標等級是分頁 / 物品彈窗裡的原生 <select>。戰鬥中
   *   掉寶 / 扣箭 / 夥伴耗肉會讓背包內容簽章改變 → renderTabs 整塊重建分頁 DOM → 開著的
   *   下拉連同元素被刪掉,點開瞬間被關(手機尤其明顯,桌機點開亦然,故與裝置無關)。
   * 解法:偵測焦點落在這些容器的 <select> 上時,延後該次 renderTabs;選單關閉(change /
   *   blur)後再 force 補繪一次,追上延後期間的背包變動。
   * 涵蓋:武器 / 防具分頁的「快速強化(批次)」+ 物品彈窗的「一鍵強化到指定值」三處下拉。
   *   彈窗(#item-modal)本來就不被戰鬥重繪、不會被關,一併納入當保險、行為一致。
   * 何時可移除:原作者把 renderTabs 改成不整塊重建分頁 DOM(diff 更新、不刪 <select>)時,
   *   本段即成多餘,可整段刪掉。在那之前留著無害(抓不到掛點自動 no-op,不會弄壞遊戲)。
   * ------------------------------------------------------------------------ */
  (function () {
    var TAB_SEL = '#tab-weapons,#tab-armors,#tab-items,#tab-equip,#tab-skill,#item-modal';

    function selectOpenInTabs() {
      var ae = document.activeElement;
      return !!(ae && ae.tagName === 'SELECT' && ae.closest && ae.closest(TAB_SEL));
    }

    function install() {
      if (typeof window.renderTabs !== 'function' || window.renderTabs.__qeGuard) return true;
      var orig = window.renderTabs;
      var pending = false;

      var guarded = function () {
        // 包住自己的偵測:萬一原作者哪天改了 DOM 害這裡丟錯,也絕不能波及遊戲的 renderTabs → 出錯就直接走原版
        try { if (selectOpenInTabs()) { pending = true; return; } } catch (e) {}
        return orig.apply(this, arguments);
      };
      guarded.__qeGuard = true;
      // orig 內部以全域名稱 renderTabs 讀寫 _sig 快取,改指到 guarded 後快取仍是同一份,無雙快取問題。
      window.renderTabs = guarded;

      function flush() {
        if (!pending || selectOpenInTabs()) return;   // 沒延後過、或還停在另一個下拉上就先不補
        pending = false;
        orig.call(window, true);                       // 一律 force,確保追上延後期間的背包變動
      }
      // 用 setTimeout 讓 inline onchange(更新 quickEnh.target)先跑完、選單也確實關閉後再補繪
      function onSelectDone(e) {
        var t = e.target;
        if (t && t.tagName === 'SELECT' && t.closest && t.closest(TAB_SEL)) setTimeout(flush, 0);
      }
      document.addEventListener('change', onSelectDone, true);
      document.addEventListener('blur', onSelectDone, true);

      console.log('[AFK-fixes] renderTabs select-guard 已掛上');
      return true;
    }

    try {
      if (!install()) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
        else setTimeout(install, 0);
      }
    } catch (e) {
      // 補坑碼自己掛掉不該拖垮整支外掛(也不該害冒煙測試誤判) → 安靜停用即可
      console.warn('[AFK-fixes] select-guard 安裝失敗,已略過:', e);
    }
  })();

  console.log('[AFK-fixes] hooks OK — 通用修正外掛已啟用。');
})();
