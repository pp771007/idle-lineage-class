/* ============================================================================
 * afk-notice.js — 首頁公告卡（臨時：更新去留投票）
 *
 * 在首頁左側標題區(#login-title-layer，標題下方)放一張公告卡，請玩家到 Google 表單
 * 投票，決定這個加掛版要「繼續跟進上游更新」還是「退回舊版本」。純顯示、
 * 全程唯讀，不動存檔。
 *   - 放 #login-title-layer 而非 #main-menu：桌機寬版是左右分欄(左=標題區、右=按鈕)，
 *     放標題區才會落在使用者說的「左邊那塊」；手機單欄時標題區在最上、卡片自然落在
 *     標題與按鈕之間，兩種佈局同一個注入點就都對(實測桌機/手機皆不擋按鈕、不破版)。
 *   - #login-title-layer 是上游靜態 DOM(穩定 id)；讀不到才退回 #main-menu。
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
      desc: '首頁顯示「填 Google 表單投票決定更新去留」的公告卡（投票活動結束後會移除）'
    });
    if (!AFK_TOGGLES.enabled('notice')) return;
  }

  var VOTE_URL = 'https://forms.gle/eaNeqVAYFxnhLwTE9';   // 更新去留投票 Google 表單

  function ensureCard() {
    if (document.getElementById('afk-notice')) return;
    // 左側標題區(桌機=左框、手機=最上)；上游若移除該 id 才退回按鈕欄頂部
    var host = document.getElementById('login-title-layer') || document.getElementById('main-menu');
    if (!host) return;
    var el = document.createElement('div');
    el.id = 'afk-notice';
    el.style.cssText = 'width:100%;max-width:20rem;margin:12px auto 8px;padding:10px 12px;box-sizing:border-box;'
      + 'background:#1e293b;border:2px solid #38bdf8;border-radius:10px;color:#e0f2fe;'
      + 'font-size:13px;line-height:1.7;text-align:left;';
    el.innerHTML = '<div style="font-weight:700;font-size:14px;color:#7dd3fc;margin-bottom:4px;">📢 更新去留投票</div>'
      + '請幫忙投票，決定這個加掛版接下來要<b>繼續跟進上游更新</b>還是<b>退回舊版本</b>：'
      + '<br><a href="' + VOTE_URL + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;padding:5px 12px;background:#0284c7;color:#fff;border-radius:6px;font-weight:700;text-decoration:none;">👉 點我填投票表單</a>';
    host.appendChild(el);
  }

  // 只在首頁可見時插卡；每次回到首頁確保還在（比照 afk-quotawarn 的可見性守衛）
  //   可見性沿用 #main-menu(進遊戲後會被切 .hidden)；卡片本體則掛在標題區。
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
