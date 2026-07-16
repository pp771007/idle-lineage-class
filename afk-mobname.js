/* ============================================================================
 * afk-mobname.js — 顯示怪物名稱模式(首頁「⚙ 其他功能」設定項)
 *
 * 原版行為:戰鬥畫面的怪物名字平常隱藏(opacity:0),滑鼠移到「怪物圖片」上才浮出。
 * 本外掛加一個三選一設定,讓玩家自選名字顯示方式:
 *   - all     全部常駐顯示   :場上所有怪的名字一直顯示
 *   - locked  鎖定中常駐顯示 :只有目前鎖定攻擊的那隻(.mob-target.active)名字常駐,其餘維持移游標才顯示
 *   - vanilla 原版行為       :維持原版(移游標到圖片才顯示)
 *
 * 實作:純 CSS + body 上一個 data 屬性驅動,不碰原作者的渲染邏輯。
 *   戰鬥畫面每 tick 會整列重繪 #mob-list,但屬性掛在 body、規則走後代選擇器,
 *   新生成的怪卡自動套用,無需在每次重繪後補 JS(零 per-tick 成本)。
 *   只「加上 opacity:1」,原版的 hover 顯示規則照常運作(任何模式下 hover 都會顯示)。
 *
 * 設定存自己的 localStorage 鍵(afk_mobname_mode),不碰原作者存檔。
 * 優雅降級:抓不到 #main-menu / AFK_SETTINGS 也照樣套用已存的顯示模式,只是少了設定入口。
 * 掛接:在 index.html 的 </body> 前加一行 <script src="afk-mobname.js"></script>
 * ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'afk_mobname_mode';
  var DEFAULT_MODE = 'vanilla';
  var MODES = [
    { k: 'all',     label: '全部常駐顯示',   desc: '場上所有怪物的名字一直顯示，不用移游標。' },
    { k: 'locked',  label: '鎖定中常駐顯示', desc: '只有目前鎖定攻擊的那隻怪名字常駐顯示，其餘維持移游標到圖片才顯示。' },
    { k: 'vanilla', label: '原版行為',       desc: '名字平常隱藏，滑鼠移到怪物圖片上才顯示（遊戲預設）。' }
  ];

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function readMode() {
    try { var v = localStorage.getItem(STORAGE_KEY); return (v && MODES.some(function (m) { return m.k === v; })) ? v : DEFAULT_MODE; }
    catch (e) { return DEFAULT_MODE; }
  }
  function saveMode(mode) { try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) {} }
  function applyMode(mode) { if (document.body) document.body.setAttribute('data-afk-mobname', mode); }

  function injectCSS() {
    if (document.getElementById('afk-mobname-style')) return;
    var s = document.createElement('style');
    s.id = 'afk-mobname-style';
    // 只加 opacity:1(原版 hover 規則不動)。選擇器特異性高於原版 `#battle-view .mob-name`,再加 !important 保險。
    s.textContent = [
      'body[data-afk-mobname="all"] #battle-view .mob-name{opacity:1 !important;}',
      'body[data-afk-mobname="locked"] #battle-view .mob-target.active .mob-name{opacity:1 !important;}',
      /* 手機:顯示模式開啟時讓怪名「完整顯示」——覆蓋原版/手機版的截斷(area-fit 五格的 nowrap+省略號、
         非 area-fit 的 -webkit-line-clamp:2)。使用者指定:不換行、直接超出卡片、左右置中(靠 .mob-name 的
         flex justify-center,超寬的單行 span 會置中並往左右對稱溢出;battle-view overflow:hidden 在框邊收邊)。
         那些遊戲規則都沒帶 !important,故此處 !important 即蓋過。 */
      'body.m-mobile[data-afk-mobname="all"] #battle-view .mob-name,body.m-mobile[data-afk-mobname="locked"] #battle-view .mob-target.active .mob-name{white-space:nowrap !important;overflow:visible !important;}',
      'body.m-mobile[data-afk-mobname="all"] #battle-view .mob-name>span,body.m-mobile[data-afk-mobname="locked"] #battle-view .mob-target.active .mob-name>span{white-space:nowrap !important;overflow:visible !important;text-overflow:clip !important;max-width:none !important;-webkit-line-clamp:unset !important;}',
      /* 設定 modal */
      '#m-mobname-modal{display:none;position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:1000;background:rgba(2,6,23,0.82);align-items:flex-start;justify-content:center;padding:24px 12px;font-family:system-ui,"Segoe UI",sans-serif;}',
      '#m-mobname-modal.open{display:flex;}',
      '#m-mobname-card{width:min(460px,96vw);max-height:calc(100dvh - 48px);display:flex;flex-direction:column;background:#0f172a;border:1px solid #334155;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden;}',
      '#m-mobname-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #1e293b;flex:0 0 auto;}',
      '#m-mobname-title{font-size:16px;font-weight:bold;color:#fff;}',
      '#m-mobname-close{width:34px;height:34px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;border-radius:8px;font-size:15px;cursor:pointer;line-height:1;}',
      '#m-mobname-close:active{background:#334155;}',
      '#m-mobname-body{flex:1 1 auto;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}',
      '.m-mobname-opt{display:flex;gap:10px;align-items:flex-start;background:#111c30;border:1px solid #1e293b;border-radius:9px;padding:11px 12px;cursor:pointer;transition:border-color .12s,background .12s;}',
      '.m-mobname-opt:hover{background:#16233b;}',
      '.m-mobname-opt.on{border-color:#38bdf8;background:#16273f;}',
      '.m-mobname-opt input{margin-top:2px;flex:0 0 auto;width:16px;height:16px;accent-color:#38bdf8;cursor:pointer;}',
      '.m-mobname-opt-txt{display:flex;flex-direction:column;gap:3px;}',
      '.m-mobname-opt-label{font-size:14.5px;font-weight:bold;color:#e2e8f0;}',
      '.m-mobname-opt-desc{font-size:12.5px;color:#94a3b8;line-height:1.5;}',
      '.m-mobname-foot{color:#64748b;font-size:12px;text-align:center;margin-top:4px;line-height:1.6;}'
    ].join('');
    document.head.appendChild(s);
  }

  var _layer = null;
  function renderBody() {
    var cur = readMode();
    var body = document.getElementById('m-mobname-body');
    if (!body) return;
    body.innerHTML = '';
    MODES.forEach(function (m) {
      var lab = document.createElement('label');
      lab.className = 'm-mobname-opt' + (m.k === cur ? ' on' : '');
      lab.innerHTML =
        '<input type="radio" name="afk-mobname" value="' + m.k + '"' + (m.k === cur ? ' checked' : '') + '>' +
        '<span class="m-mobname-opt-txt">' +
          '<span class="m-mobname-opt-label">' + m.label + '</span>' +
          '<span class="m-mobname-opt-desc">' + m.desc + '</span>' +
        '</span>';
      lab.querySelector('input').addEventListener('change', function () {
        saveMode(m.k); applyMode(m.k); renderBody();   // 立即套用 + 重繪高亮
      });
      body.appendChild(lab);
    });
    var foot = document.createElement('div');
    foot.className = 'm-mobname-foot';
    foot.textContent = '選好即時生效，設定會記住。';
    body.appendChild(foot);
  }
  function openModal() {
    var m = document.getElementById('m-mobname-modal'); if (!m) return;
    renderBody();
    m.classList.add('open');
    _layer = window.AFK_UI ? AFK_UI.openLayer(hideModal) : null;   // 手機返回鍵 / ESC 可關
  }
  function hideModal() { var m = document.getElementById('m-mobname-modal'); if (m) m.classList.remove('open'); _layer = null; }
  function closeModal() { if (_layer && window.AFK_UI) AFK_UI.closeLayer(_layer); else hideModal(); }

  function buildModal() {
    if (document.getElementById('m-mobname-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'm-mobname-modal';
    modal.innerHTML =
      '<div id="m-mobname-card">' +
        '<div id="m-mobname-head">' +
          '<span id="m-mobname-title">🏷️ 顯示怪物名稱</span>' +
          '<button id="m-mobname-close" title="關閉">✕</button>' +
        '</div>' +
        '<div id="m-mobname-body"></div>' +
      '</div>';
    document.body.appendChild(modal);
    document.getElementById('m-mobname-close').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  }

  function init() {
    injectCSS();
    applyMode(readMode());   // 先套用已存的顯示模式(即使沒有設定入口也生效)

    var menu = document.getElementById('main-menu');
    if (!menu) { console.warn('[AFK-mobname] 找不到 #main-menu,顯示模式仍已套用,但少了設定入口。'); return; }
    buildModal();
    window.AFK_SETTINGS = window.AFK_SETTINGS || { _items: [], add: function (it) { this._items.push(it); } };
    AFK_SETTINGS.add({ label: '🏷️ 顯示怪物名稱', onClick: openModal });
    console.log('[AFK-mobname] hooks OK — 顯示怪物名稱設定已加入首頁設定選單。');
  }

  ready(init);
})();
