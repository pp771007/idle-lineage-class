/* ============================================================================
 * afk-storage.js — 首頁「設定」鈕 → 展開選單 → 檢查存檔大小
 *
 * 在首頁(#main-menu)加一顆小的「⚙ 設定」鈕,點開後展開一個小選單,目前放一項
 * 「🔍 檢查存檔大小」。點下去彈出 modal,把瀏覽器 localStorage 裡每個 key 佔的
 * 大小由大到小列出來,並算總用量與離 ~5MB 上限的比例。
 *
 * 純唯讀:只 getItem 量字數,不做任何刪除/覆寫。設計成將來要再加別的設定項很容易
 * (往 MENU_ITEMS 陣列加一筆即可)。
 *
 * 優雅降級:抓不到 #main-menu 就安靜停用,不影響遊戲。
 * 掛接:在 index.html 的 </body> 前加一行 <script src="afk-storage.js"></script>
 * ========================================================================== */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  // 量到的字數 ÷ 1024 當 KB 顯示(localStorage 配額約以字元數計;實測這引擎約 5,200,000 字元上限)
  var CAP_CHARS = 5 * 1024 * 1024;   // ~5MB 參考上限
  function fmtKB(chars) { return (chars / 1024).toFixed(chars < 102.4 ? 2 : 1) + ' KB'; }

  // key → 給人看的說明(認得的標註,認不得就只顯示原始 key)
  function friendlyLabel(key) {
    var m, sfx = /_trad$/.test(key) ? '（傳統模式）' : (/_classic$/.test(key) ? '（經典模式）' : '');   // 倉庫/收集冊依模式分桶,標出是哪一桶
    if ((m = /^lineage_idle_save_(\d+)_bak$/.exec(key))) return '存檔 ' + m[1] + ' 的匯入前備份';
    if ((m = /^lineage_idle_save_(\d+)$/.exec(key))) return '存檔 ' + m[1];
    if (/warehouse/i.test(key)) return '共用倉庫' + sfx;
    if (/carddex/i.test(key)) return '卡片收集冊（怪物卡收集進度）' + sfx;       // 🎴 作者新增
    if (/equipdex/i.test(key)) return '裝備收集冊（裝備收集進度）' + sfx;         // 🗡️ 作者新增
    if (/mob_hp/i.test(key)) return '場上怪物 HP（戰鬥暫存）';
    if (/mob_status/i.test(key)) return '場上怪物異常狀態（戰鬥暫存）';
    if (/vfx_off/i.test(key)) return '特效開關設定';
    if (/combat_filter/i.test(key)) return '戰鬥訊息過濾設定';
    if (/audit_watch/i.test(key)) return '統計追蹤清單';
    if (/^afk[-_]/i.test(key)) return '外掛設定';
    return '';
  }

  function collect() {
    var rows = [], total = 0;
    for (var k in localStorage) {
      if (!Object.prototype.hasOwnProperty.call(localStorage, k)) continue;
      var v;
      try { v = localStorage.getItem(k); } catch (e) { v = ''; }
      var n = (k.length + (v ? v.length : 0));   // key 名本身也佔配額,一起算
      rows.push({ key: k, chars: n });
      total += n;
    }
    rows.sort(function (a, b) { return b.chars - a.chars; });
    return { rows: rows, total: total };
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function renderBody() {
    var data = collect();
    var maxChars = data.rows.length ? data.rows[0].chars : 1;
    var pctCap = (data.total / CAP_CHARS * 100);

    var html = '';
    html += '<div class="m-stg-total">' +
      '目前共用 <b>' + fmtKB(data.total) + '</b>' +
      '<span class="m-stg-cap">（約佔 ~5 MB 上限的 ' + pctCap.toFixed(1) + '%）</span>' +
      '<div class="m-stg-capbar"><div class="m-stg-capbar-fill" style="width:' + Math.min(100, pctCap).toFixed(1) + '%"></div></div>' +
      '</div>';

    if (!data.rows.length) {
      html += '<div class="m-stg-empty">localStorage 目前是空的（沒有任何存檔）。</div>';
    } else {
      html += '<div class="m-stg-list">';
      data.rows.forEach(function (r) {
        var lbl = friendlyLabel(r.key);
        var share = r.chars / data.total * 100;
        var barW = r.chars / maxChars * 100;
        html += '<div class="m-stg-item">' +
          '<div class="m-stg-item-head">' +
            '<span class="m-stg-key" title="' + esc(r.key) + '">' + esc(r.key) + (lbl ? ' <span class="m-stg-lbl">' + esc(lbl) + '</span>' : '') + '</span>' +
            '<span class="m-stg-size">' + fmtKB(r.chars) + '</span>' +
          '</div>' +
          '<div class="m-stg-bar"><div class="m-stg-bar-fill" style="width:' + barW.toFixed(1) + '%"></div></div>' +
          '<div class="m-stg-share">' + share.toFixed(1) + '% of 已用</div>' +
        '</div>';
      });
      html += '</div>';
    }
    html += '<div class="m-stg-foot">純檢查、不會更動任何資料。存檔由原作者管理,本頁只是讓你看用量。</div>';
    return html;
  }

  var _layer = null;
  function openModal() {
    var m = document.getElementById('m-stg-modal'); if (!m) return;
    document.getElementById('m-stg-body').innerHTML = renderBody();
    m.classList.add('open');
    _layer = window.AFK_UI ? AFK_UI.openLayer(hideModal) : null;   // 手機返回鍵 / ESC 可關
  }
  function hideModal() { var m = document.getElementById('m-stg-modal'); if (m) m.classList.remove('open'); _layer = null; }   // 實際收起,不自行動歷史
  function closeModal() { if (_layer && window.AFK_UI) AFK_UI.closeLayer(_layer); else hideModal(); }   // 主動關(✕ / 點背景)

  // 將來要加別的設定項,往這裡加一筆 { label, onClick } 即可
  var MENU_ITEMS = [
    { label: '🔍 檢查存檔大小', onClick: openModal }
  ];

  function buildModal() {
    if (document.getElementById('m-stg-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'm-stg-modal';
    modal.innerHTML =
      '<div id="m-stg-card">' +
        '<div id="m-stg-head">' +
          '<span id="m-stg-title">📦 存檔空間用量</span>' +
          '<button id="m-stg-close" title="關閉">✕</button>' +
        '</div>' +
        '<div id="m-stg-body"></div>' +
      '</div>';
    document.body.appendChild(modal);
    document.getElementById('m-stg-close').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    // ESC / 手機返回鍵改由 AFK_UI 共用管理器處理(openModal 時已 openLayer)
  }

  function injectCSS() {
    if (document.getElementById('m-stg-style')) return;
    var s = document.createElement('style');
    s.id = 'm-stg-style';
    s.textContent = [
      /* 首頁的小設定鈕 + 展開選單 */
      '#afk-stg-wrap{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:-6px;}',
      '#afk-stg-gear{background:#1e293b;border:1px solid #334155;color:#cbd5e1;border-radius:8px;font-size:13px;font-weight:bold;padding:5px 14px;cursor:pointer;font-family:inherit;line-height:1.2;}',
      '#afk-stg-gear:hover{background:#273449;color:#e2e8f0;}',
      '#afk-stg-gear.on{background:#273449;color:#fcd34d;border-color:#475569;}',
      /* 選單往「上方」浮出(absolute,不佔版面流、不把下方內容撐開);bottom:100% 貼齊設定鈕上緣 */
      '#afk-stg-menu{display:none;position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:8px;z-index:1001;flex-direction:column;gap:4px;background:#0f172a;border:1px solid #334155;border-radius:10px;padding:6px;box-shadow:0 -8px 30px rgba(0,0,0,.55);min-width:200px;}',
      '#afk-stg-menu.open{display:flex;}',
      '#afk-stg-menu button{background:transparent;border:1px solid transparent;color:#e2e8f0;border-radius:7px;padding:8px 12px;font-size:14px;text-align:left;cursor:pointer;font-family:inherit;}',
      '#afk-stg-menu button:hover{background:#1e293b;border-color:#334155;}',
      /* modal */
      '#m-stg-modal{display:none;position:fixed;inset:0;z-index:1000;background:rgba(2,6,23,0.82);align-items:flex-start;justify-content:center;padding:24px 12px;font-family:system-ui,"Segoe UI",sans-serif;}',
      '#m-stg-modal.open{display:flex;}',
      '#m-stg-card{width:min(560px,96vw);max-height:calc(100dvh - 48px);display:flex;flex-direction:column;background:#0f172a;border:1px solid #334155;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden;}',
      '#m-stg-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #1e293b;flex:0 0 auto;}',
      '#m-stg-title{font-size:16px;font-weight:bold;color:#fff;}',
      '#m-stg-close{width:34px;height:34px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;border-radius:8px;font-size:15px;cursor:pointer;line-height:1;}',
      '#m-stg-close:active{background:#334155;}',
      '#m-stg-body{flex:1 1 auto;overflow-y:auto;padding:14px;}',
      '.m-stg-total{color:#cbd5e1;font-size:14px;margin-bottom:12px;}',
      '.m-stg-total b{color:#fcd34d;font-size:16px;}',
      '.m-stg-cap{color:#94a3b8;font-size:12.5px;margin-left:4px;}',
      '.m-stg-capbar{height:8px;background:#1e293b;border-radius:5px;overflow:hidden;margin-top:7px;}',
      '.m-stg-capbar-fill{height:100%;background:linear-gradient(90deg,#22c55e,#eab308,#ef4444);}',
      '.m-stg-list{display:flex;flex-direction:column;gap:9px;}',
      '.m-stg-item{background:#111c30;border:1px solid #1e293b;border-radius:9px;padding:9px 11px;}',
      '.m-stg-item-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;}',
      '.m-stg-key{font-size:13px;color:#e2e8f0;word-break:break-all;font-family:ui-monospace,Menlo,Consolas,monospace;}',
      '.m-stg-lbl{font-family:system-ui,"Segoe UI",sans-serif;color:#7dd3fc;font-size:12px;}',
      '.m-stg-size{flex:0 0 auto;font-size:14px;font-weight:bold;color:#fcd34d;white-space:nowrap;}',
      '.m-stg-bar{height:6px;background:#1e293b;border-radius:4px;overflow:hidden;margin:7px 0 3px;}',
      '.m-stg-bar-fill{height:100%;background:#38bdf8;}',
      '.m-stg-share{font-size:11.5px;color:#64748b;}',
      '.m-stg-empty{color:#94a3b8;text-align:center;padding:20px 8px;font-size:14px;}',
      '.m-stg-foot{color:#64748b;font-size:12px;text-align:center;margin-top:14px;line-height:1.6;}'
    ].join('');
    document.head.appendChild(s);
  }

  function init() {
    var menu = document.getElementById('main-menu');
    if (!menu) { console.warn('[AFK-storage] 找不到 #main-menu,設定鈕停用。'); return; }
    if (document.getElementById('afk-stg-wrap')) return;
    injectCSS();
    buildModal();

    var wrap = document.createElement('div');
    wrap.id = 'afk-stg-wrap';
    var gear = document.createElement('button');
    gear.id = 'afk-stg-gear';
    gear.type = 'button';
    gear.textContent = '⚙ 其他功能';
    var list = document.createElement('div');
    list.id = 'afk-stg-menu';
    wrap.appendChild(gear);
    wrap.appendChild(list);
    menu.appendChild(wrap);

    // 開選單時才重建項目:合併外掛註冊的(AFK_SETTINGS,如「安裝成免網路遊玩」)＋本檔內建項;
    //   外掛項在前、內建項在後;帶 visible() 的條件項(安裝裝好後即隱藏)於此時求值。
    function renderMenu() {
      var ext = (window.AFK_SETTINGS && AFK_SETTINGS._items) || [];
      list.innerHTML = '';
      ext.concat(MENU_ITEMS).forEach(function (it) {
        if (it.visible && !it.visible()) return;
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = it.label;
        b.addEventListener('click', function () { closeMenu(); it.onClick(); });
        list.appendChild(b);
      });
    }
    function openMenu() { renderMenu(); list.classList.add('open'); gear.classList.add('on'); }
    function closeMenu() { list.classList.remove('open'); gear.classList.remove('on'); }
    gear.addEventListener('click', function (e) {
      e.stopPropagation();
      if (list.classList.contains('open')) closeMenu(); else openMenu();
    });
    // 點選單外面就收起來
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) closeMenu(); });

    console.log('[AFK-storage] hooks OK — 首頁設定鈕(檢查存檔大小)已啟用。');
  }

  ready(init);
})();
