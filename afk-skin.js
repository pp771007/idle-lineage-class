/* ============================================================================
 * afk-skin.js — 首頁外掛入口收納（純視覺、不動遊戲邏輯）
 *
 * 只動首頁 #creation-screen / #main-menu 的外觀,不碰存檔/遊戲函式:
 *   (「加掛版」雲朵徽章與公告跑馬燈已移除(使用者要求);ensureBadge/ensureMarquee 留檔備用但不呼叫)
 *   1. 外掛入口(掉落查詢/小百科/原作者資訊/設定)的擺放,分裝置:
 *      - 桌機:作者 v3.0.40 起首頁是固定 4:3 藝術舞台,右側 #main-menu 高度固定、不捲動 →
 *        入口塞不進去。故改把整塊入口搬到「左欄版本號正上方」的空白處(#afk-plugin-panel,
 *        絕對定位在 #login-art-stage 上、左緣與寬度對齊 #login-meta-layer),
 *        一層攤開、沒有「先點一顆按鈕再開 Modal」那層(與手機一致)。
 *      - 手機:首頁是可捲動單欄,入口自然往下排、不擠 → 入口直接以
 *        #main-menu 直接子元素依序排列,只套原版按鈕皮(使用者要求與原版同樣式)。
 *   3. 外掛入口按鈕套用原版首頁按鈕的皮(深藍漸層+金邊,抄 css/style.css 的
 *      #main-menu > button),讓外掛鈕與作者的按鈕風格一致。
 *
 * 作法:外掛元素是別支外掛(afk-dex/afk-wiki/afk-syncinfo/afk-storage)append 到 #main-menu 的,
 *   本檔載入順序排最後、並用 MutationObserver + 重試,等它們到齊再依序排好(idempotent)。
 * 掛接:在 </body> 前 <script src="afk-skin.js?v=..."></script>(排在其他 afk-* 之後)。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('skin')) return;   // 🎚️ 外掛開關:關掉就透明放行原版行為

  // 外掛入口的「顯示順序」(別支外掛都 append 到 #main-menu;本檔依此序重排,桌機再整塊搬進 #afk-plugin-panel)。
  //   原作者+正版最後同步(#afk-syncinfo)置頂,接掉落查詢/小百科,再巴哈/Line(#afk-syncinfo-links),最後設定。
  var FRAME_ORDER = ['#afk-syncinfo', '.m-dex-entry-row', '.m-wiki-entry-row', '#afk-syncinfo-links', '#afk-stg-wrap'];

  // 🚨 不可只看 body.m-mobile：那個 class 由 afk-mobile 掛，而 afk-mobile 可以被玩家關掉
  //    → 在手機上關掉「手機版面」就會被判成桌機，入口整塊被搬進桌機那塊絕對定位的 #afk-plugin-panel；
  //      那塊的座標是照桌機 4:3 舞台算的，手機幾何下會跑到奇怪的位置甚至看不到（同類問題回報過）。
  //    afk-mobile 在時以它為準（它另有 UA/實測判斷），不在時用同一組規則自己判。
  function isMobileNow() {
    if (document.body.classList.contains('m-mobile')) return true;
    try {
      if (window.__afkm && typeof window.__afkm.isMobile === 'boolean') return window.__afkm.isMobile;
      return (window.matchMedia && matchMedia('(pointer:coarse)').matches) || (window.innerWidth || 9999) <= 820;
    } catch (e) { return false; }
  }

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

    /* 外掛入口按鈕套原版皮:作者新登入頁的按鈕樣式只吃 #main-menu 的「直接子」button
       (css/style.css 的 #main-menu > button),我們的按鈕包在 row/外框裡吃不到 → 在這裡抄同一組
       宣告套上(深藍漸層+金邊)。⚠ 作者若改 css/style.css 該段風格,這裡要跟著換。 */
    '#main-menu .m-dex-entry-row > button,#main-menu .m-wiki-entry-row > button,#main-menu #afk-stg-gear,',
    '#afk-plugin-panel .m-dex-entry-row > button,#afk-plugin-panel .m-wiki-entry-row > button,#afk-plugin-panel #afk-stg-gear{',
      'border-color:#b68a39;background:linear-gradient(180deg,rgba(35,55,83,.94),rgba(10,22,42,.96));',
      'color:#f8e7bb;text-shadow:0 1px 2px #000;box-shadow:inset 0 0 9px rgba(116,165,219,.35),0 2px 5px #000;}',
    '#main-menu .m-dex-entry-row > button:hover,#main-menu .m-wiki-entry-row > button:hover,#main-menu #afk-stg-gear:hover,',
    '#afk-plugin-panel .m-dex-entry-row > button:hover,#afk-plugin-panel .m-wiki-entry-row > button:hover,#afk-plugin-panel #afk-stg-gear:hover{filter:brightness(1.18);}',
    /* 主入口鈕的字級/內距也對齊原版(↗ 鈕與 ⚙ 鈕維持各自尺寸,只換皮) */
    '#main-menu .m-dex-entry-main,#main-menu .m-wiki-entry-main{',
      'padding:clamp(5px,.72vw,11px) 4px;font-size:clamp(9px,1.03vw,16px);line-height:1.1;}',
    /* 手機:afk-mobile 把原版按鈕釘在 16px/14px 12px(vw 字級在縮放 viewport 下失準),主入口鈕跟進 */
    'body.m-mobile #main-menu .m-dex-entry-main,body.m-mobile #main-menu .m-wiki-entry-main{',
      'font-size:16px;padding:14px 12px;}',
    /* ↗ 鈕去掉自身上下內距(原 py-4 會把整列撐得比原版按鈕高);列高由主鈕決定,↗ 靠 stretch 等高 */
    '#main-menu .m-dex-entry-newtab,#main-menu .m-wiki-entry-newtab{padding-top:0;padding-bottom:0;}',

    /* 🔌 桌機:整塊外掛入口放在左欄「版本號正上方」的空白處(標題與 #login-meta-layer 之間)。
       左緣/寬度對齊版本號那層;bottom 貼在版本號上方一點、內容 justify-content:flex-end 由下往上長
       → 入口幾條都貼齊版本號、不會因為多一條就整塊往下擠到版號。
       字級用 min(1.25vh,.94vw)=「舞台高度的 1.25%」(舞台是 4:3、高=min(100vh,75vw)):
       整塊隨舞台等比縮放,小視窗才不會漲上去壓到標題。⚠ 上限別調太高——一調高,在小視窗
       (整塊還沒縮到上限以下)就會頂到標題;smoke 第一輪有驗「不壓到標題/版號」。
       上游 v3.9 把標題下的副標換成多行更新說明(#login-update-notes),標題底到原版號位置(41.5%)
       只剩 ~13%、塞不下入口(~16%)→ 有 panel 時把版本號層(#login-meta-layer)往下挪到 47.5%
       (版權字底端約 54%,仍在金框內 ~57%),panel 底緣跟著貼在新版號上方 1.3%。
       只在 panel 存在時挪(stage 掛 .afk-has-panel,見 ensurePanel)→ 關掉本外掛首頁就是原版版面。 */
    '#login-art-stage.afk-has-panel #login-meta-layer{top:47.5%;}',
    '#afk-plugin-panel{position:absolute;z-index:5;left:5.8%;width:25.4%;top:21.8%;bottom:53.8%;',
      'display:flex;flex-direction:column;align-items:center;justify-content:flex-end;',
      'gap:.42em;font-size:clamp(8px,min(1.25vh,.94vw),16px);}',
    /* 選角/創角時作者會把 #main-menu 加 .hidden,入口要跟著收起來。
       靠 DOM 順序:panel 一定 append 在 #main-menu 之後(見 ensurePanel),故用一般兄弟選擇器。 */
    '#main-menu.hidden ~ #afk-plugin-panel{display:none;}',
    /* 入口列的排版:afk-dex/afk-wiki 那兩份是 `#main-menu …` scoped(手機用),搬出 #main-menu 就吃不到
       → 這裡為 panel 補一份等效的(順便縮成適合左欄空白處的尺寸)。⚠ 那兩支改了入口結構,這裡要跟著改。 */
    '#afk-plugin-panel .m-dex-entry-row,#afk-plugin-panel .m-wiki-entry-row{display:flex;gap:.45em;align-items:stretch;justify-content:center;width:100%;}',
    '#afk-plugin-panel .m-dex-entry-row > button,#afk-plugin-panel .m-wiki-entry-row > button{width:auto !important;max-width:none !important;}',
    '#afk-plugin-panel .m-dex-entry-main,#afk-plugin-panel .m-wiki-entry-main{flex:1 1 auto;padding:.36em .3em;font-size:.95em;line-height:1.12;}',
    '#afk-plugin-panel .m-dex-entry-newtab,#afk-plugin-panel .m-wiki-entry-newtab{flex:0 0 auto;padding:0 .7em;font-size:1.05em;line-height:1;}',
    '#afk-plugin-panel #afk-syncinfo,#afk-plugin-panel #afk-syncinfo-links{font-size:.86em;line-height:1.42;}',
    '#afk-plugin-panel #afk-stg-wrap{margin-top:0;}',
    '#afk-plugin-panel #afk-stg-gear{font-size:.86em;padding:.24em 1em;border-radius:.55em;}',
    /* ⚙ 其他功能的選單原本往「上」彈(它在手機是排在最底下的)。搬到左欄後上方只剩到標題那點距離,
       選單一長就會被 #login-art-stage 的 overflow:hidden 從頂端切掉、玩家滑不到 → 這裡改成往下彈,
       並用 min(vh,vw)(=舞台高度的百分比)封頂 + 自己捲,視窗再小也不會有項目掉在舞台外。 */
    '#afk-plugin-panel #afk-stg-menu{top:100%;bottom:auto;margin:.6em 0 0;max-height:min(50vh,37.5vw);overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,.55);}',

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

  // ---- 共用:把入口依 FRAME_ORDER 排進 host --------------------------------
  //   已經排好就完全不動 → appendChild 不空轉,MutationObserver 不迴圈。
  var _busy = false;
  function entries() {
    var els = [];
    FRAME_ORDER.forEach(function (s) { var el = document.querySelector(s); if (el) els.push(el); });
    return els;
  }
  function orderInto(host, els) {
    var ok = true;
    for (var i = 0; i < els.length; i++) {
      if (els[i].parentElement !== host) { ok = false; break; }
      if (i && !(els[i - 1].compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_FOLLOWING)) { ok = false; break; }
    }
    if (!ok) els.forEach(function (el) { host.appendChild(el); });
  }

  // ---- 手機:入口直接排在 #main-menu(與原版按鈕同樣式)---------------------
  function ensureInline(menu) {
    var els = entries();
    if (els.length) orderInto(menu, els);
  }

  // ---- 桌機:入口整塊排在左欄版本號上方(#afk-plugin-panel)-----------------
  function ensurePanel(menu) {
    var stage = document.getElementById('login-art-stage');
    if (!stage) { ensureInline(menu); return; }   // 上游換版面 → 退回排在選單裡,入口至少不消失
    var els = entries();
    if (!els.length) return;   // 外掛元素都還沒 append 進來
    var panel = document.getElementById('afk-plugin-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'afk-plugin-panel';
      stage.appendChild(panel);   // 一定排在 #main-menu 之後 → CSS 的 `#main-menu.hidden ~ #afk-plugin-panel` 才成立
    }
    stage.classList.add('afk-has-panel');   // 讓版本號層往下讓位(見 CSS 的 .afk-has-panel)
    orderInto(panel, els);
  }

  // 切回手機:入口還原成 #main-menu 直接子、拆掉 panel
  function teardownPanel(menu) {
    var panel = document.getElementById('afk-plugin-panel');
    if (!panel) return;
    while (panel.firstChild) menu.appendChild(panel.firstChild);
    panel.remove();
    var stage = document.getElementById('login-art-stage');
    if (stage) stage.classList.remove('afk-has-panel');
  }

  function apply() {
    if (_busy) return; _busy = true;
    try {
      injectCss();   // 🚫 「加掛版」雲朵徽章與公告跑馬燈已移除(使用者要求)——只留外掛入口擺放
      var menu = document.getElementById('main-menu');
      if (menu) {
        if (isMobileNow()) { teardownPanel(menu); ensureInline(menu); }
        else ensurePanel(menu);
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
