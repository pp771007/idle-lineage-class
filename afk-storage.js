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
    var m;
    if ((m = /^lineage_idle_save_(\d+)_bak$/.exec(key))) return '存檔 ' + m[1] + ' 的匯入前備份';
    if ((m = /^lineage_idle_save_(\d+)$/.exec(key))) return '存檔 ' + m[1];
    if (/warehouse/i.test(key)) return '共用倉庫';
    if (/^afk[-_]/i.test(key) || /combat.*filter|audit/i.test(key)) return '外掛設定';
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
  function openModal(title, bodyHTML, afterRender) {
    var m = document.getElementById('m-stg-modal'); if (!m) return;
    document.getElementById('m-stg-title').textContent = title || '📦 存檔空間用量';
    document.getElementById('m-stg-body').innerHTML = (bodyHTML != null) ? bodyHTML : renderBody();
    if (afterRender) afterRender();
    m.classList.add('open');
    _layer = window.AFK_UI ? AFK_UI.openLayer(hideModal) : null;   // 手機返回鍵 / ESC 可關
  }
  function hideModal() { var m = document.getElementById('m-stg-modal'); if (m) m.classList.remove('open'); _layer = null; }   // 實際收起,不自行動歷史
  function closeModal() { if (_layer && window.AFK_UI) AFK_UI.closeLayer(_layer); else hideModal(); }   // 主動關(✕ / 點背景)

  // ===== 匯入／匯出整包存檔(全部 localStorage;只在網址帶 ?test=1 時於選單顯示) =====
  //   格式:純 JSON 文字 { app, ts, data:{key:value} }——不壓縮、不 base64(純文字最小且零跨瀏覽器問題)。
  //   匯入:解析→驗證 app 標記→自製確認(顯示匯出時間)→localStorage.clear()+逐筆還原→reload。不呼叫 saveGame、不碰遊戲狀態。
  var IO_APP = 'afk-idle-lineage';   // 備份標記:匯入時擋「貼錯東西」
  function isTest() { try { return new URLSearchParams(location.search).get('test') === '1'; } catch (e) { return false; } }
  function ioMsg(html, color) { var el = document.getElementById('m-io-msg'); if (el) { el.innerHTML = html; el.style.color = color || '#94a3b8'; } }
  function ioBody() {
    return '<div class="m-io-desc">把整包瀏覽器存檔（所有 localStorage）匯出成一段文字（自動複製到剪貼簿）；或把先前匯出的字串貼進來按「匯入」，會<b style="color:#fca5a5">清空目前全部存檔並還原</b>成那份（完成後自動重整）。</div>' +
      '<div class="m-io-btns">' +
        '<button id="m-io-export" type="button" class="m-io-btn m-io-exp">📤 匯出（複製）</button>' +
        '<button id="m-io-import" type="button" class="m-io-btn m-io-imp">📥 匯入</button>' +
      '</div>' +
      '<textarea id="m-io-text" class="m-io-ta" spellcheck="false" placeholder="匯出的備份字串會出現在這；或把先前匯出的字串貼進來，再按「匯入」。"></textarea>' +
      '<div id="m-io-msg" class="m-io-msg"></div>';
  }
  function openIO(keepText) {
    openModal('💾 匯入 / 匯出存檔', ioBody(), function () {
      document.getElementById('m-io-export').addEventListener('click', ioExport);
      document.getElementById('m-io-import').addEventListener('click', ioImport);
      if (keepText) { var t = document.getElementById('m-io-text'); if (t) t.value = keepText; }
    });
  }
  function ioExport() {
    var data = {};
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); data[k] = localStorage.getItem(k); }
    var str = JSON.stringify({ app: IO_APP, ts: Date.now(), data: data });
    var ta = document.getElementById('m-io-text'); ta.value = str; ta.focus(); ta.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).then(
        function () { ioMsg('✅ 已匯出並複製到剪貼簿（' + fmtKB(str.length) + '）。貼到安全的地方保存。', '#86efac'); },
        function () { ioMsg('已匯出（' + fmtKB(str.length) + '）。剪貼簿不可用，請手動全選複製上面文字。', '#fcd34d'); }
      );
    } else { ioMsg('已匯出（' + fmtKB(str.length) + '）。請手動全選複製上面文字。', '#fcd34d'); }
  }
  function ioImport() {
    var raw = (document.getElementById('m-io-text').value || '').trim();
    if (!raw) { ioMsg('⚠ 上面是空的，請先貼上備份字串。', '#fcd34d'); return; }
    var obj;
    try { obj = JSON.parse(raw); } catch (e) { ioMsg('❌ 這不是有效的備份字串（解析失敗）。', '#fca5a5'); return; }
    if (!obj || typeof obj !== 'object' || obj.app !== IO_APP || !obj.data || typeof obj.data !== 'object') { ioMsg('❌ 這不是有效的備份字串（缺少正確標記）。', '#fca5a5'); return; }
    ioConfirm(obj, raw);
  }
  function fmtTs(ts) {
    try { var d = new Date(ts), p = function (x) { return (x < 10 ? '0' : '') + x; }; return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
    catch (e) { return '（時間不明）'; }
  }
  function ioConfirm(obj, raw) {
    var when = (typeof obj.ts === 'number') ? fmtTs(obj.ts) : '（時間不明）';
    document.getElementById('m-stg-title').textContent = '💾 匯入 / 匯出存檔';
    document.getElementById('m-stg-body').innerHTML =
      '<div class="m-io-confirm">' +
        '<div class="m-io-warn">⚠ 確定要匯入嗎？</div>' +
        '<div class="m-io-cdesc">這份備份是 <b>' + esc(when) + '</b> 匯出的。<br>匯入會<b style="color:#fca5a5">清空目前瀏覽器內全部存檔</b>並還原成這份，<b>無法復原</b>。</div>' +
        '<div class="m-io-btns">' +
          '<button id="m-io-cancel" type="button" class="m-io-btn">取消</button>' +
          '<button id="m-io-go" type="button" class="m-io-btn m-io-danger">確定覆蓋並重整</button>' +
        '</div>' +
      '</div>';
    document.getElementById('m-io-cancel').addEventListener('click', function () { openIO(raw); });   // 回匯入頁,文字保留
    document.getElementById('m-io-go').addEventListener('click', function () { ioApply(obj); });
  }
  function ioApply(obj) {
    try {
      localStorage.clear();
      Object.keys(obj.data).forEach(function (k) { localStorage.setItem(k, obj.data[k]); });
    } catch (e) {
      document.getElementById('m-stg-body').innerHTML = '<div class="m-io-msg" style="color:#fca5a5;padding:20px;line-height:1.7;">❌ 寫入失敗：' + esc(e.message) + '<br>（可能空間不足）建議重整後檢查存檔。</div>';
      return;
    }
    document.getElementById('m-stg-body').innerHTML = '<div style="color:#86efac;padding:28px;text-align:center;font-size:15px;">✅ 匯入完成，正在重新整理…</div>';
    setTimeout(function () { location.reload(); }, 700);   // 寫完立即重載:讓還原好的 localStorage 生效(不留記憶體舊狀態)
  }

  // 將來要加別的設定項,往這裡加一筆 { label, onClick, visible? } 即可
  var MENU_ITEMS = [
    { label: '🔍 檢查存檔大小', onClick: function () { openModal('📦 存檔空間用量', renderBody()); } },
    { label: '💾 匯入／匯出存檔', onClick: function () { openIO(); }, visible: isTest }
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
      '.m-stg-foot{color:#64748b;font-size:12px;text-align:center;margin-top:14px;line-height:1.6;}',
      /* 匯入／匯出 */
      '.m-io-desc{color:#cbd5e1;font-size:13.5px;line-height:1.7;margin-bottom:12px;}',
      '.m-io-btns{display:flex;gap:10px;margin-bottom:10px;}',
      '.m-io-btn{flex:1;padding:10px;font-size:14px;font-weight:bold;border-radius:9px;cursor:pointer;font-family:inherit;border:1px solid #334155;background:#1e293b;color:#e2e8f0;}',
      '.m-io-btn:hover{background:#273449;}',
      '.m-io-exp{background:#155e3a;border-color:#16a34a;color:#bbf7d0;}',
      '.m-io-exp:hover{background:#166e44;}',
      '.m-io-imp{background:#1e3a5f;border-color:#3b82f6;color:#bfdbfe;}',
      '.m-io-imp:hover{background:#234670;}',
      '.m-io-ta{width:100%;box-sizing:border-box;height:160px;resize:vertical;background:#0b1220;border:1px solid #334155;border-radius:9px;color:#cbd5e1;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;padding:9px;line-height:1.5;}',
      '.m-io-msg{font-size:13px;margin-top:9px;min-height:18px;line-height:1.6;}',
      '.m-io-confirm{padding:6px 2px;}',
      '.m-io-warn{font-size:17px;font-weight:bold;color:#fcd34d;margin-bottom:10px;}',
      '.m-io-cdesc{color:#cbd5e1;font-size:14px;line-height:1.8;margin-bottom:16px;}',
      '.m-io-danger{background:#7f1d1d;border-color:#b91c1c;color:#fecaca;}',
      '.m-io-danger:hover{background:#991b1b;}'
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
