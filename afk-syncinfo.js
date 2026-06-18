/* ============================================================================
 * afk-syncinfo.js — 首頁顯示「原版最後同步時間」
 *
 * 自動同步流程(sync-upstream)每次把原作者更新合併進來時,會在 last-sync.json
 * 寫下當下時間。本外掛在首頁(#main-menu)最下方讀出並顯示,讓玩家一眼知道
 * 「目前這版是什麼時候從原作者那邊同步來的」。
 *   - 純讀取根目錄 last-sync.json,讀不到就安靜隱藏,不影響遊戲。
 *   - 時間一律換算成台灣時間顯示(與自動同步打的 tag 同時區)。
 *
 * 掛接:在 index.html 的 </body> 前加一行 <script src="afk-syncinfo.js"></script>
 * ========================================================================== */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  // ISO 時間 → 台灣時間字串「YYYY/MM/DD HH:mm」
  function fmtTpe(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var parts = new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(d);
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    return o.year + '/' + o.month + '/' + o.day + ' ' + o.hour + ':' + o.minute;
  }

  function injectCSS() {
    if (document.getElementById('afk-syncinfo-style')) return;
    var s = document.createElement('style');
    s.id = 'afk-syncinfo-style';
    s.textContent =
      '#afk-syncinfo{color:#64748b;font-size:12px;text-align:center;letter-spacing:.3px;margin-top:2px;line-height:1.6;}' +
      '#afk-syncinfo .afk-si-sep{margin:0 6px;opacity:.6;}';
    document.head.appendChild(s);
  }

  function init() {
    var menu = document.getElementById('main-menu');
    if (!menu) { console.warn('[AFK-syncinfo] 找不到 #main-menu,原作者/最後同步資訊不顯示。'); return; }
    if (document.getElementById('afk-syncinfo')) return;
    injectCSS();
    var foot = document.createElement('div');
    foot.id = 'afk-syncinfo';
    foot.innerHTML =
      '<span class="afk-si-author">原作者：秋玥</span>' +
      '<span class="afk-si-sep">·</span>' +
      '<span class="afk-si-time">原版最後同步：載入中…</span>';
    menu.appendChild(foot);
    console.log('[AFK-syncinfo] hooks OK — 首頁顯示原作者與原版最後同步時間。');

    var timeEl = foot.querySelector('.afk-si-time'), sepEl = foot.querySelector('.afk-si-sep');
    fetch('last-sync.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var t = j && j.syncedAt ? fmtTpe(j.syncedAt) : '';
        if (t) { timeEl.textContent = '原版最後同步：' + t; }
        else { timeEl.style.display = 'none'; sepEl.style.display = 'none'; }   // 讀不到時間只藏時間段,作者照顯示
      })
      .catch(function () { timeEl.style.display = 'none'; sepEl.style.display = 'none'; });
  }

  ready(init);
})();
