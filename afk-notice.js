/* ============================================================================
 * afk-notice.js — 首頁公告卡（通用框架；目前沒有公告 → 整支安靜停用）
 *
 * 要發新公告：把下面的 NOTICE 從 null 改成一組設定即可（title / html / 連結），
 * 不必動 index.html、smoke 或其他外掛。公告結束就把 NOTICE 改回 null。
 *
 * 卡片插在首頁左側標題區(#login-title-layer，標題下方)。純顯示、全程唯讀，不動存檔。
 *   - 放 #login-title-layer 而非 #main-menu：桌機寬版是左右分欄(左=標題區、右=按鈕)，
 *     放標題區才會落在「左邊那塊」；手機單欄時標題區在最上、卡片自然落在標題與按鈕之間，
 *     兩種佈局同一個注入點就都對(實測桌機/手機皆不擋按鈕、不破版)。
 *   - #login-title-layer 是上游靜態 DOM(穩定 id)；讀不到才退回 #main-menu。
 *
 * 掛接：index.html </body> 前 <script src="afk-notice.js">。
 * ========================================================================== */
(function () {
  'use strict';

  // ── 公告設定：沒有公告時保持 null ────────────────────────────
  // 範例（2026-07 的「更新去留投票」就是這樣設的，要發新公告照抄改字即可）：
  //   var NOTICE = {
  //     title: '📢 更新去留投票',
  //     html: '請幫忙投票，決定這個加掛版接下來要<b>繼續跟進上游更新</b>還是<b>退回舊版本</b>：',
  //     linkText: '👉 點我填投票表單',
  //     linkUrl: 'https://forms.gle/eaNeqVAYFxnhLwTE9'
  //   };
  var NOTICE = null;

  if (!NOTICE) {   // 沒有公告：不註冊開關(免開關面板多一列沒用的)、不插任何 DOM
    console.log('[AFK-notice] hooks OK — 目前沒有公告，未顯示任何卡片。');
    return;
  }

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'notice', name: '首頁公告', group: '系統與其他', def: true,
      desc: '首頁顯示作者的公告卡（有公告時才出現）'
    });
    if (!AFK_TOGGLES.enabled('notice')) return;
  }

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
    var html = '<div style="font-weight:700;font-size:14px;color:#7dd3fc;margin-bottom:4px;">' + NOTICE.title + '</div>' + NOTICE.html;
    if (NOTICE.linkUrl) {
      html += '<br><a href="' + NOTICE.linkUrl + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;padding:5px 12px;background:#0284c7;color:#fff;border-radius:6px;font-weight:700;text-decoration:none;">'
        + (NOTICE.linkText || '👉 點我看看') + '</a>';
    }
    el.innerHTML = html;
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

  console.log('[AFK-notice] hooks OK — 首頁公告卡已啟用。');
})();
