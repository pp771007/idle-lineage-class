/* ============================================================================
 * afk-quotawarn.js — 存檔空間快滿時在首頁顯示警告(防玩家角色/倉庫默默消失)
 *
 * 背景:瀏覽器給每個網站的 localStorage 只有約 5MB。上游改版持續新增儲存項目
 * (收集冊/戰鬥暫存/離線收益…),加上加掛版把存檔位開到 16 格,重度玩家可能把
 * 配額用滿——滿了之後 setItem 會失敗,輕則進度存不進去,重則角色/倉庫資料
 * 消失(已有玩家中獎)。核心存檔失敗時只在 console 警告,玩家根本看不到。
 *
 * 本外掛在「首頁」檢查 localStorage 用量,超過 80% 就在選單頂端放一張紅色
 * 警告卡,用白話請玩家刪掉不玩的角色釋放空間。只在首頁顯示(選角/遊戲中不打
 * 擾);每次回到首頁重新計算,降到門檻以下自動消失。全程唯讀,不動任何存檔。
 *
 * 用量估算與「⚙ 設定 → 檢查存檔大小」(afk-storage)同一套:Σ(key+value 字元數)
 * ÷ 5MiB 字元。配額實際因瀏覽器而異,故文案寫「約」。
 *
 * 掛接:在 index.html 的 </body> 前 <script src="afk-quotawarn.js">。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'quotawarn', name: '存檔空間警告', group: '系統與其他', def: true,
      desc: '瀏覽器存檔空間(localStorage)使用超過 80% 時,在首頁顯示紅色警告,提醒刪除不玩的角色,避免存檔爆滿造成角色/倉庫消失'
    });
    if (!AFK_TOGGLES.enabled('quotawarn')) return;
  }

  var WARN_PCT = 80;                 // 超過這個百分比才警告
  var CAP_CHARS = 5 * 1024 * 1024;   // 配額參考上限(與 afk-storage 檢查存檔大小同一套;實測此引擎約 520 萬字元)

  function usagePct() {
    var total = 0;
    try {
      for (var k in localStorage) {
        if (!Object.prototype.hasOwnProperty.call(localStorage, k)) continue;
        var v = null;
        try { v = localStorage.getItem(k); } catch (e) {}
        total += k.length + (v ? v.length : 0);
      }
    } catch (e) { return 0; }
    return total / CAP_CHARS * 100;
  }

  function ensureBanner(pct) {
    var menu = document.getElementById('main-menu');
    if (!menu) return;
    var el = document.getElementById('afk-quotawarn');
    if (pct < WARN_PCT) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'afk-quotawarn';
      el.style.cssText = 'width:100%;max-width:18rem;margin:0 auto 10px;padding:10px 12px;box-sizing:border-box;'
        + 'background:#450a0a;border:2px solid #dc2626;border-radius:10px;color:#fecaca;'
        + 'font-size:13px;line-height:1.7;text-align:left;';
      menu.insertBefore(el, menu.firstChild);
    }
    el.innerHTML = '<div style="font-weight:700;font-size:14px;color:#fca5a5;margin-bottom:4px;">⚠️ 存檔空間快滿了（已用約 ' + Math.round(pct) + '%）</div>'
      + '瀏覽器給這個遊戲的儲存空間快用完了，<b>滿了之後新的進度會存不進去，角色或倉庫資料可能會消失</b>。'
      + '<br>請<b>刪掉幾個不玩的角色</b>釋放空間（想留下的角色可先在選角畫面點「匯出進度」存成備份檔）。';
  }

  // 只在首頁可見時計算(全掃 localStorage 有成本);每次「回到首頁」重算一次
  var _wasVisible = false;
  function tick() {
    var menu = document.getElementById('main-menu');
    var visible = !!menu && !menu.classList.contains('hidden');
    if (visible && !_wasVisible) ensureBanner(usagePct());
    _wasVisible = visible;
  }
  tick();
  setInterval(tick, 1000);

  console.log('[AFK-quotawarn] hooks OK — 存檔空間超過 ' + WARN_PCT + '% 時首頁會顯示警告。');
})();
