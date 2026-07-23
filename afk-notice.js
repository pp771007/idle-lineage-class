/* ============================================================================
 * afk-notice.js — 首頁公告卡（臨時：更新去留投票）
 *
 * 在首頁(#main-menu)頂端放一張公告卡，請玩家到巴哈 301 樓留言處投票，決定
 * 這個加掛版要「繼續跟進上游更新」還是「退回舊版本」。純顯示、全程唯讀，不動存檔。
 *
 * ⚠️ 這是「一次性活動公告」——投票結束後整支檔案連同 index.html / afk-plugin-block.html /
 *    smoke need 的引用一起移除即可（沒有其他外掛依賴它）。
 *
 * 掛接：index.html </body> 前 <script src="afk-notice.js">。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'notice', name: '首頁投票公告', group: '系統與其他', def: true,
      desc: '首頁頂端顯示「到巴哈 301 樓投票決定更新去留」的公告卡（投票活動結束後會移除）'
    });
    if (!AFK_TOGGLES.enabled('notice')) return;
  }

  var VOTE_URL = 'https://forum.gamer.com.tw/Co.php?bsn=84452&sn=37297';   // 巴哈 301 樓（本加掛版發布樓層）

  function ensureCard() {
    var menu = document.getElementById('main-menu');
    if (!menu) return;
    if (document.getElementById('afk-notice')) return;
    var el = document.createElement('div');
    el.id = 'afk-notice';
    el.style.cssText = 'width:100%;max-width:18rem;margin:0 auto 10px;padding:10px 12px;box-sizing:border-box;'
      + 'background:#1e293b;border:2px solid #38bdf8;border-radius:10px;color:#e0f2fe;'
      + 'font-size:13px;line-height:1.7;text-align:left;';
    el.innerHTML = '<div style="font-weight:700;font-size:14px;color:#7dd3fc;margin-bottom:4px;">📢 更新去留投票</div>'
      + '請到 <a href="' + VOTE_URL + '" target="_blank" rel="noopener" style="color:#7dd3fc;text-decoration:underline;">巴哈 301 樓</a> 的<b>留言處</b>投票，決定這個加掛版接下來要：'
      + '<br>・<b>繼續跟進更新</b> → 留言 <b>B2106</b>'
      + '<br>・<b>退回舊版本</b> → 留言 <b>B2107</b>';
    menu.insertBefore(el, menu.firstChild);
  }

  // 只在首頁可見時插卡；每次回到首頁確保還在（比照 afk-quotawarn 的可見性守衛）
  var _wasVisible = false;
  function tick() {
    var menu = document.getElementById('main-menu');
    var visible = !!menu && !menu.classList.contains('hidden');
    if (visible && !_wasVisible) ensureCard();
    _wasVisible = visible;
  }
  tick();
  setInterval(tick, 1000);

  console.log('[AFK-notice] hooks OK — 首頁投票公告卡已啟用。');
})();
