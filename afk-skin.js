/* ============================================================================
 * afk-skin.js — 首頁「加掛版」品牌標記 + 外掛入口收納（純視覺、不動遊戲邏輯）
 *
 * 只動首頁 #creation-screen / #main-menu 的外觀,不碰存檔/遊戲函式:
 *   1. 標題下方放一個會上下微微飄動的「加掛版」雲朵副標。
 *   2. 外掛入口(掉落查詢/小百科/原作者資訊/設定)的收納,分裝置:
 *      - 桌機:作者 v3.0.40 起首頁改成固定 4:3 藝術舞台,右側 #main-menu 高度固定、
 *        不捲動 → 入口全展開會擠爆、溢出被裁。故桌機收成「一顆 🔌 外掛工具 按鈕」,
 *        點了用 Modal 攤開全部入口(Modal 掛在 #main-menu 內,保留 `#main-menu …`
 *        scoped 樣式;桌機祖先無 transform,position:fixed 對齊 viewport 正常)。
 *      - 手機:首頁是可捲動單欄,入口自然往下排、不擠 → 維持原本「🔌 外掛」半透明
 *        外框(afk-plugin-frame),不改(手機版型現況良好,勿動)。
 *   3. 外掛入口按鈕套用原版首頁按鈕的皮(深藍漸層+金邊,抄 css/style.css 的
 *      #main-menu > button),讓外掛鈕與作者的按鈕風格一致。
 *
 * 作法:外掛元素是別支外掛(afk-dex/afk-wiki/afk-syncinfo/afk-storage)append 到 #main-menu 的,
 *   本檔載入順序排最後、並用 MutationObserver + 重試,等它們到齊再把它們收進 Modal/外框(idempotent)。
 * 掛接:在 </body> 前 <script src="afk-skin.js?v=..."></script>(排在其他 afk-* 之後)。
 * ========================================================================== */
(function () {
  'use strict';

  // 外掛入口的「顯示順序」(都是 #main-menu 的子孫;依此序排入 Modal/外框)。
  //   原作者+正版最後同步(#afk-syncinfo)置頂,接掉落查詢/小百科,再巴哈/Line(#afk-syncinfo-links),最後設定。
  var FRAME_ORDER = ['#afk-syncinfo', '.m-dex-entry-row', '.m-wiki-entry-row', '#afk-syncinfo-links', '#afk-stg-wrap'];

  function isMobileNow() { return document.body.classList.contains('m-mobile'); }

  // ---- CSS ----------------------------------------------------------------
  var CSS = [
    /* 右上「加掛版」浮動副標 + 半透明裝飾底(圓角膠囊;之後可換雲形) */
    /* 浮在副標下方、置中、絕對定位(不佔版面、不把按鈕往下推);內層 afk-brand-inner 負責上下飄 */
    '#afk-brand-badge{position:absolute;left:50%;bottom:-34px;transform:translateX(-50%);z-index:6;pointer-events:none;}',
    '#afk-brand-badge .afk-brand-inner{position:relative;display:inline-block;padding:9px 26px 7px;animation:afkBrandFloat 3.2s ease-in-out infinite;}',
    '#afk-brand-badge .afk-brand-text{position:relative;z-index:1;font-size:15px;font-weight:800;letter-spacing:2px;color:#fde68a;text-shadow:0 1px 2px rgba(0,0,0,.75),0 0 6px rgba(0,0,0,.4);white-space:nowrap;}',
    /* ☁️ 雲朵底:body(膠囊)+ 兩團 puff(圓),全用「同色不透明」疊出輪廓→無接縫,再對整層 opacity 半透明 */
    '#afk-brand-badge .afk-cloud{position:absolute;left:0;right:0;top:30%;bottom:10%;opacity:.5;filter:drop-shadow(0 2px 5px rgba(0,0,0,.4));}',
    '#afk-brand-badge .afk-cloud,#afk-brand-badge .afk-cloud::before,#afk-brand-badge .afk-cloud::after{background:#e6ecf7;border-radius:999px;}',
    '#afk-brand-badge .afk-cloud::before{content:"";position:absolute;width:38%;height:155%;left:11%;top:-82%;border-radius:50%;}',
    '#afk-brand-badge .afk-cloud::after{content:"";position:absolute;width:50%;height:180%;right:7%;top:-100%;border-radius:50%;}',
    '@keyframes afkBrandFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}',
    /* 桌機:作者藝術舞台的標題層(#login-title-layer,text-center)是獨立圖層,原本 absolute
       bottom:-34px 會讓雲朵懸空、脫離標題看起來很怪 → 改成正常流、置中排在副標下方,像標題的一部分。
       (手機維持 absolute;現況良好、勿動) */
    'body:not(.m-mobile) #afk-brand-badge{position:static;left:auto;bottom:auto;transform:none;display:block;margin:6px auto 0;text-align:center;}',
    /* 手機(body.m-mobile;此版用 viewport=1180 縮放,純寬度 media query 失效,故靠 m-mobile class)：字略縮一點 */
    'body.m-mobile #afk-brand-badge .afk-brand-text{font-size:13px;letter-spacing:1px;}',

    /* 外掛區外框(半透明、像遊戲內面板) */
    '#afk-plugin-frame{position:relative;width:100%;max-width:20rem;margin:8px auto 0;padding:20px 14px 16px;',
      'border:1px solid rgba(148,163,184,.30);border-radius:16px;background:rgba(15,23,42,.22);',
      'box-shadow:inset 0 0 24px rgba(148,163,184,.05),0 4px 18px rgba(0,0,0,.20);',
      'display:flex;flex-direction:column;gap:14px;align-items:center;}',
    /* 框上的「外掛」標籤,坐在上緣(像 fieldset 標題) */
    '#afk-plugin-frame .afk-frame-label{position:absolute;top:-12px;left:50%;transform:translateX(-50%);',
      'padding:2px 14px;font-size:12.5px;font-weight:700;letter-spacing:2px;color:#cbd5e1;',
      'background:linear-gradient(180deg,rgba(40,52,72,.96),rgba(28,38,56,.96));',
      'border:1px solid rgba(148,163,184,.4);border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.4);white-space:nowrap;}',

    /* 外掛入口按鈕套原版皮:作者新登入頁的按鈕樣式只吃 #main-menu 的「直接子」button
       (css/style.css 的 #main-menu > button),我們的按鈕包在 row/外框裡吃不到 → 在這裡抄同一組
       宣告套上(深藍漸層+金邊)。⚠ 作者若改 css/style.css 該段風格,這裡要跟著換。 */
    '#main-menu .m-dex-entry-row > button,#main-menu .m-wiki-entry-row > button,#main-menu #afk-stg-gear,#main-menu > #afk-plugin-btn{',
      'border-color:#b68a39;background:linear-gradient(180deg,rgba(35,55,83,.94),rgba(10,22,42,.96));',
      'color:#f8e7bb;text-shadow:0 1px 2px #000;box-shadow:inset 0 0 9px rgba(116,165,219,.35),0 2px 5px #000;}',
    '#main-menu .m-dex-entry-row > button:hover,#main-menu .m-wiki-entry-row > button:hover,#main-menu #afk-stg-gear:hover,#main-menu > #afk-plugin-btn:hover{filter:brightness(1.18);}',
    /* 主入口鈕的字級/內距也對齊原版(↗ 鈕與 ⚙ 鈕維持各自尺寸,只換皮) */
    '#main-menu .m-dex-entry-main,#main-menu .m-wiki-entry-main{',
      'padding:clamp(5px,.72vw,11px) 4px;font-size:clamp(9px,1.03vw,16px);line-height:1.1;}',
    /* 手機:afk-mobile 把原版按鈕釘在 16px/14px 12px(vw 字級在縮放 viewport 下失準),主入口鈕跟進 */
    'body.m-mobile #main-menu .m-dex-entry-main,body.m-mobile #main-menu .m-wiki-entry-main{',
      'font-size:16px;padding:14px 12px;}',
    /* ↗ 鈕去掉自身上下內距(原 py-4 會把整列撐得比原版按鈕高);列高由主鈕決定,↗ 靠 stretch 等高 */
    '#main-menu .m-dex-entry-newtab,#main-menu .m-wiki-entry-newtab{padding-top:0;padding-bottom:0;}',

    /* 🔌 桌機外掛 Modal:一顆按鈕點開、攤開全部入口。z-index 900 < 掉落查詢/小百科/存檔 Modal(1000)
       → 在 Modal 內點入口,對方 Modal 會疊在上面正常顯示。Modal 掛在 #main-menu 內,故 `#main-menu …`
       scoped 樣式(入口列寬/皮)照樣命中;桌機祖先無 transform,position:fixed 對齊 viewport。 */
    '#afk-plugin-modal{display:none;position:fixed;inset:0;z-index:900;background:rgba(2,6,23,.72);align-items:center;justify-content:center;padding:24px;}',
    '#afk-plugin-modal.is-open{display:flex;}',
    '#afk-plugin-modal .afk-pm-panel{position:relative;width:100%;max-width:22rem;max-height:86vh;overflow-y:auto;',
      'padding:28px 18px 20px;border:1px solid rgba(182,138,57,.5);border-radius:16px;',
      'background:linear-gradient(180deg,rgba(20,28,44,.98),rgba(11,17,30,.98));box-shadow:0 18px 60px rgba(0,0,0,.6);',
      'display:flex;flex-direction:column;gap:14px;align-items:center;}',
    '#afk-plugin-modal .afk-pm-title{position:absolute;top:-12px;left:50%;transform:translateX(-50%);padding:2px 16px;',
      'font-size:13px;font-weight:800;letter-spacing:2px;color:#f8e7bb;',
      'background:linear-gradient(180deg,rgba(40,52,72,.98),rgba(28,38,56,.98));',
      'border:1px solid rgba(182,138,57,.6);border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.5);white-space:nowrap;}',
    '#afk-plugin-modal .afk-pm-close{position:absolute;top:9px;right:11px;width:30px;height:30px;border-radius:8px;',
      'border:1px solid rgba(148,163,184,.4);background:rgba(15,23,42,.6);color:#cbd5e1;font-size:16px;line-height:1;',
      'cursor:pointer;display:flex;align-items:center;justify-content:center;}',
    '#afk-plugin-modal .afk-pm-close:hover{filter:brightness(1.4);}',
    '#afk-plugin-modal-body{display:flex;flex-direction:column;gap:12px;align-items:center;width:100%;}',

    /* 📢 公告跑馬燈:放在 #main-menu 第一個子層(首頁按鈕上方);紅底捲動,游標移上去暫停。
       (v3.0.40 作者登入頁改成藝術舞台後,標題不再是 #creation-screen 直接子層,改錨定 #main-menu。) */
    /* flex:0 0 auto + min-height:#main-menu 是 flex column 且自身 overflow:hidden
       →min-height:auto 退化成 0→會被 flex-shrink 壓扁、把文字上下裁掉(使用者回報「高度被裁」)。鎖死不縮、給足高度。 */
    '#afk-marquee{position:relative;flex:0 0 auto;width:100%;max-width:34rem;min-height:30px;margin:0 auto;overflow:hidden;border-radius:8px;border:1px solid rgba(230,110,110,.5);background:linear-gradient(180deg,rgba(96,16,16,.82),rgba(58,8,8,.82));padding:6px 0;box-shadow:inset 0 0 14px rgba(0,0,0,.35);}',
    /* 框窄(對齊按鈕欄寬)、文字長 → 捲動文字在兩端被硬切在字中間,看起來像「被切掉」。
       對整個框(靜止的可視窗)加水平淡出遮罩:文字/紅底/邊框在兩端柔化淡出,不再是突兀的硬切直角。
       (遮罩要放在靜止的 #afk-marquee;放在會位移的 track 上淡出會跟著文字跑,固定不住框兩端。) */
    '#afk-marquee{-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 26px,#000 calc(100% - 26px),transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 26px,#000 calc(100% - 26px),transparent 100%);}',
    /* 無縫捲動:track 放兩份相同文字,translateX 只移 -50%(=一份寬)→ 看起來連續、且第一份一開始就在可視區
       (動畫沒跑/還沒開始也看得到字,不會像「padding-left:100%」那樣有一段空白期 → 修「字沒出現」)。 */
    '#afk-marquee .afk-mq-track{display:flex;width:max-content;animation:afkMq 26s linear infinite;}',
    '#afk-marquee .afk-mq-seg{flex:0 0 auto;white-space:nowrap;padding:0 1.8rem;font-size:13px;font-weight:700;letter-spacing:1px;color:#fff2f2;text-shadow:0 1px 2px #000,0 0 4px rgba(0,0,0,.8);}',
    '#afk-marquee:hover .afk-mq-track{animation-play-state:paused;}',
    '@keyframes afkMq{from{transform:translateX(0)}to{transform:translateX(-50%)}}',
    'body.m-mobile #afk-marquee{max-width:94%;}',
    'body.m-mobile #afk-marquee .afk-mq-seg{font-size:12px;letter-spacing:.5px;padding:0 1.3rem;}',
    ''
  ].join('');

  // 📢 公告跑馬燈文字
  var MARQUEE_TEXT = '伺服器永久開放，但不再跟進原作者版本';

  function injectCss() {
    if (document.getElementById('afk-skin-css')) return;
    var s = document.createElement('style'); s.id = 'afk-skin-css'; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  // ---- 右上副標 -----------------------------------------------------------
  function ensureBadge() {
    var cs = document.getElementById('creation-screen'); if (!cs) return;
    if (document.getElementById('afk-brand-badge')) return;
    // 錨定在「標題區(h1+副標 的容器)」的右下角=使用者示意圖框的位置(副標右側、標題下方、分隔線上方)。
    var h1 = cs.querySelector('h1');
    var header = h1 ? h1.parentElement : cs;
    header.style.position = 'relative';   // 讓 badge 以這塊為定位基準(桌機/手機一致)
    var b = document.createElement('div'); b.id = 'afk-brand-badge';
    b.innerHTML = '<span class="afk-brand-inner"><span class="afk-cloud"></span><span class="afk-brand-text">加掛版</span></span>';
    header.appendChild(b);
  }

  // ---- 公告跑馬燈(首頁按鈕上方) ------------------------------------------
  //   v3.0.40 作者登入頁改成藝術舞台(標題被包進 #login-art-stage>#login-title-layer),
  //   舊錨點「h1 父層是 #creation-screen 直接子層」不再成立、跑馬燈整個不插入(玩家回報消失)。
  //   改插在 #main-menu 第一個子層:視覺位置同樣在標題之下、按鈕之上,且不依賴作者標題結構。
  function ensureMarquee() {
    if (document.getElementById('afk-marquee')) return;
    var menu = document.getElementById('main-menu'); if (!menu) return;
    var mq = document.createElement('div'); mq.id = 'afk-marquee';
    var track = document.createElement('div'); track.className = 'afk-mq-track';
    for (var i = 0; i < 2; i++) {   // 兩份文字→無縫捲動;第一份開場即在可視區
      var seg = document.createElement('span'); seg.className = 'afk-mq-seg';
      if (i === 1) seg.setAttribute('aria-hidden', 'true');
      seg.textContent = MARQUEE_TEXT;
      track.appendChild(seg);
    }
    mq.appendChild(track);
    menu.insertBefore(mq, menu.firstChild);
  }

  // ---- 手機:外掛外框(inline,現況良好、勿動)------------------------------
  var _busy = false;
  // 找某 selector 的元素(可能已在外框內、或還在 #main-menu 直接子層)
  function findEl(menu, sel) {
    return document.querySelector('#afk-plugin-frame > ' + sel) || menu.querySelector(':scope > ' + sel);
  }
  function ensureFrame() {
    var menu = document.getElementById('main-menu'); if (!menu) return;
    var els = [];
    FRAME_ORDER.forEach(function (s) { var el = findEl(menu, s); if (el) els.push(el); });
    if (!els.length) return;   // 外掛元素都還沒 append 進來
    var frame = document.getElementById('afk-plugin-frame');
    if (!frame) {
      frame = document.createElement('div'); frame.id = 'afk-plugin-frame';
      var label = document.createElement('div'); label.className = 'afk-frame-label'; label.textContent = '🔌 外掛';
      frame.appendChild(label);
      // 外框插在「#main-menu 內最早出現的那個外掛元素」位置(=作者按鈕/說明之後)
      var firstInMenu = null;
      FRAME_ORDER.forEach(function (s) { if (!firstInMenu) { var el = menu.querySelector(':scope > ' + s); if (el) firstInMenu = el; } });
      menu.insertBefore(frame, firstInMenu);
    }
    // 依 FRAME_ORDER 重新 append → 框內順序固定(把散在 #main-menu 的也一起收進來;idempotent)
    els.forEach(function (el) { frame.appendChild(el); });
  }

  // ---- 桌機:一顆按鈕 + Modal 收納外掛入口 ---------------------------------
  function ensureModal(menu) {
    var modal = document.getElementById('afk-plugin-modal');
    if (modal) return modal;
    modal = document.createElement('div'); modal.id = 'afk-plugin-modal';
    var panel = document.createElement('div'); panel.className = 'afk-pm-panel';
    var title = document.createElement('div'); title.className = 'afk-pm-title'; title.textContent = '🔌 外掛工具';
    var close = document.createElement('button'); close.type = 'button'; close.className = 'afk-pm-close';
    close.textContent = '✕'; close.setAttribute('aria-label', '關閉');
    var body = document.createElement('div'); body.id = 'afk-plugin-modal-body';
    panel.appendChild(title); panel.appendChild(close); panel.appendChild(body);
    modal.appendChild(panel);
    menu.appendChild(modal);   // 掛在 #main-menu 內 → 保留 `#main-menu …` scoped 樣式
    function closeModal() { modal.classList.remove('is-open'); }
    close.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });   // 點背景關
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    return modal;
  }
  function ensureButton(menu) {
    var btn = document.getElementById('afk-plugin-btn');
    if (btn) return btn;
    btn = document.createElement('button'); btn.id = 'afk-plugin-btn'; btn.type = 'button';
    btn.className = 'btn text-base w-72 py-2.5';   // 尺寸對齊選單按鈕;金皮由本檔 CSS(#main-menu>#afk-plugin-btn)套
    btn.textContent = '🔌 外掛工具';
    btn.addEventListener('click', function () {
      var m = document.getElementById('afk-plugin-modal'); if (m) m.classList.add('is-open');
    });
    menu.appendChild(btn);   // 直接子 → 排在遊戲按鈕/說明之後(=原本外框的位置)
    return btn;
  }
  function ensureModalUI(menu) {
    ensureModal(menu); ensureButton(menu);
    var body = document.getElementById('afk-plugin-modal-body');
    // 把散在 #main-menu 各處的外掛入口依 FRAME_ORDER 收進 Modal(idempotent;移動不動 menu 直接子→不觸發 observer 迴圈)
    FRAME_ORDER.forEach(function (s) { var el = menu.querySelector(s); if (el) body.appendChild(el); });
    // 清掉手機外框(切窄視窗回桌機的殘留)
    var frame = document.getElementById('afk-plugin-frame');
    if (frame) { while (frame.firstChild) { if (frame.firstChild.className === 'afk-frame-label') frame.removeChild(frame.firstChild); else body.appendChild(frame.firstChild); } frame.remove(); }
  }

  // 切回手機:把 Modal 拆掉、入口還原成 #main-menu 直接子,交還給 ensureFrame
  function teardownModalUI(menu) {
    var body = document.getElementById('afk-plugin-modal-body');
    if (body) { while (body.firstChild) menu.appendChild(body.firstChild); }
    var modal = document.getElementById('afk-plugin-modal'); if (modal) modal.remove();
    var btn = document.getElementById('afk-plugin-btn'); if (btn) btn.remove();
  }

  function apply() {
    if (_busy) return; _busy = true;
    try {
      injectCss(); ensureBadge(); ensureMarquee();
      var menu = document.getElementById('main-menu');
      if (menu) {
        if (isMobileNow()) { teardownModalUI(menu); ensureFrame(); }
        else ensureModalUI(menu);
      }
    } catch (e) { /* 視覺外掛,出錯不影響遊戲 */ }
    _busy = false;
  }

  // ---- 啟動:套用 + 觀察(其他外掛 append 是非同步的)----------------------
  function start() {
    apply();
    var menu = document.getElementById('main-menu');
    if (menu && window.MutationObserver) {
      var obs = new MutationObserver(function () { apply(); });
      obs.observe(menu, { childList: true });
    }
    // 後援:外掛可能延遲 append,前幾秒多試幾次
    var n = 0, iv = setInterval(function () { apply(); if (++n > 20) clearInterval(iv); }, 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  console.log('[AFK-skin] hooks OK');
})();
