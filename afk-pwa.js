/* ============================================================================
 * afk-pwa.js — 把遊戲變成可「安裝成 APP」的 PWA(安裝 UI + 圖桶對帳)
 *
 * 行為（全在首頁 #main-menu 的「⚙ 設定」選單，遊戲中不顯示）：
 *   ● 還沒安裝 → 設定選單出現「📥 安裝成 APP」。
 *       - Android/桌機 Chromium：點了叫出系統安裝視窗（beforeinstallprompt）。
 *       - iOS / 抓不到安裝事件：點了跳文字引導（分享→加入主畫面）。
 *   ● 手機／平板在登入畫面右上角另有一顆「📲 安裝到桌面」(同一個流程;Android 叫出系統安裝,iPhone 跳加入主畫面教學)。
 *     桌機不顯示(桌機用設定選單那項就好)。已安裝(從桌面圖示開的)或 file:// 都不顯示。
 *   ● 安裝後從桌面/主畫面像 App 一樣開啟;圖片一律「用到才抓」(SW cache-first 圖桶,
 *     玩過的會留著、離線也能看),不預先下載整包圖。
 *
 * 不做「離線資源預抓」了（為什麼）：
 *   原本安裝後會把 assets/ 全部圖(約 50MB)抓進圖桶,流量太兇(GitHub Pages 100GB/月軟上限)。
 *   改為純 on-demand——玩到哪張抓哪張、抓到就進圖桶持久留著,回訪/離線都用得上。
 *   故移除:背景預抓、「N 張新圖待下載」提示、預抓進度 UI、PRECACHE_DONE/MANIFEST_SIG 旗標。
 *
 * 仍保留「圖桶對帳」(reconcileImages)：每次載入把最新 manifest 送進 SW,清掉「作者換過、
 *   內容對不上的舊圖」(下次用到才 on-demand 抓新版)。它不下載圖、幾乎不耗流量,只確保圖桶不餵舊圖;
 *   沒有它,作者換圖後玩家會永遠看到快取的舊版。
 * 另有「程式桶對帳」(reconcileCode)：程式桶桶名固定、換版不倒桶(改動的檔靠 ?v= 換 URL 自然抓新),
 *   每次載入把「本頁實際引用的 js/css 清單」送進 SW,清掉舊 ?v= 殘留,桶不會越長越肥。
 *
 * 程式更新：
 *   sw.js 已把導覽文件改 network-first——線上開頁一律最新「殼」,JS 帶 ?v= 換版即換 URL,
 *   「線上＝永遠最新」自動且無條件,不需強制刷新。離線退快取照常。
 *   但「一直開著沒重新開頁」的玩家拿不到新版 → 畫面上方的「有新版本」按鈕(watchNewVersion,站長 2026-10-16)。
 *
 * 設計重點：
 *   - SW 註冊沿用 afk-sw.js;本檔只負責「安裝 UI / 圖桶對帳」。
 *   - <head> 的 manifest / 圖示 / theme-color 用 JS 注入(每小時自動同步會整份覆蓋 index.html、洗掉寫死的)。
 *   - 非安全環境(file://)自動略過 SW 相關功能,遊戲照舊、零錯誤。
 *
 * 掛接：index.html </body> 前 <script src="afk-pwa.js"></script>
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('pwa')) return;   // 🎚️ 外掛開關:關掉就透明放行原版行為

  var ICON = 'pwa-icon-192.png';
  var reg = null;            // ServiceWorkerRegistration
  var deferredPrompt = null; // 攔下來的 beforeinstallprompt，供安裝連結點擊時用

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function isStandalone() {
    return (window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches)) ||
           window.navigator.standalone === true;
  }
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent || '') && !window.MSStream;
  }
  // 真的能跑 PWA/SW 的環境:有 serviceWorker、是安全環境、且 protocol 是 http/https。
  function pwaCapable() {
    return ('serviceWorker' in navigator) && window.isSecureContext && /^https?:$/.test(location.protocol);
  }

  // ----- <head> 注入：manifest / 圖示 / theme-color（同步會洗掉寫死的，故用 JS 補）-------
  function injectHead() {
    function add(tag, attrs) {
      var el = document.createElement(tag);
      for (var k in attrs) el.setAttribute(k, attrs[k]);
      document.head.appendChild(el);
    }
    // manifest 只在 http(s) 注入:file:// 下瀏覽器抓 manifest 會被 CORS 擋(origin null)、console 噴紅字
    if (/^https?:$/.test(location.protocol) && !document.querySelector('link[rel="manifest"]')) add('link', { rel: 'manifest', href: 'manifest.webmanifest' });
    if (!document.querySelector('link[rel="apple-touch-icon"]')) add('link', { rel: 'apple-touch-icon', href: ICON });
    if (!document.querySelector('meta[name="theme-color"]')) add('meta', { name: 'theme-color', content: '#0f141d' });
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    if (!document.querySelector('meta[name="mobile-web-app-capable"]')) add('meta', { name: 'mobile-web-app-capable', content: 'yes' });
    if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) add('meta', { name: 'apple-mobile-web-app-title', content: '放置天堂' });
  }

  // ----- 安裝 UI ----------------------------------------------------------
  // 點「安裝」：能叫出系統安裝視窗就直接叫，不能就只顯示安裝步驟（2026-10-14 站長：說明只寫步驟）。
  //   舊的「移除安裝前先匯出存檔」說明卡（installNoticeBox）先留著不用。
  function onInstallClick() {
    doInstall();
  }
  function installNoticeBox(onOk) {
    var m = document.createElement('div');
    m.setAttribute('style', 'position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:24px;');
    m.innerHTML =
      '<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;max-width:380px;width:100%;padding:20px;color:#e2e8f0;text-align:left;">' +
      '<div style="font-weight:bold;font-size:15px;margin-bottom:12px;text-align:center;">📥 安裝成 APP</div>' +
      '<div style="line-height:1.8;font-size:13px;color:#cbd5e1;margin-bottom:16px;">' +
      '安裝後可從桌面／主畫面像 App 一樣開啟，存檔保存在這個瀏覽器／裝置上。圖片會在你玩到時自動下載並快取，玩過的內容離線也能看。<br><br>' +
      '<b style="color:#fbbf24;">提醒：</b>日後若要「移除安裝」，<b>部分瀏覽器或系統會連同存檔一起清掉，部分則會保留</b>——各家行為不一定相同。為了保險，移除前建議先到遊戲內<b>匯出存檔</b>備份，日後重裝或換裝置都能再匯入回來。' +
      '</div>' +
      '<div style="display:flex;gap:10px;">' +
      '<button type="button" id="afk-pwa-ni-cancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid #475569;background:#334155;color:#e2e8f0;cursor:pointer;">取消</button>' +
      '<button type="button" id="afk-pwa-ni-ok" style="flex:1;padding:10px;border-radius:8px;border:1px solid #16a34a;background:#15803d;color:#fff;cursor:pointer;">知道了，開始安裝</button>' +
      '</div></div>';
    document.body.appendChild(m);
    function remove() { if (m.parentNode) m.parentNode.removeChild(m); }
    var layer = window.AFK_UI ? AFK_UI.openLayer(remove) : null;   // 手機返回鍵 / ESC 可關
    function close() { if (layer && window.AFK_UI) AFK_UI.closeLayer(layer); else remove(); }
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    m.querySelector('#afk-pwa-ni-cancel').addEventListener('click', close);
    m.querySelector('#afk-pwa-ni-ok').addEventListener('click', function () { close(); onOk(); });
  }
  function doInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      var dp = deferredPrompt;
      (dp.userChoice || Promise.resolve()).then(function () { deferredPrompt = null; });
      return;
    }
    // 抓不到安裝事件（iOS，或瀏覽器尚未允許）→ 文字引導
    var guide = isIOS()
      ? '安裝步驟\n1. 用 Safari 開啟這個網頁\n2. 點下方的「分享」鈕\n3. 選「加入主畫面」→「加入」'
      : '安裝步驟\n1. 點瀏覽器右上角的「⋮」\n2. 選「安裝應用程式」或「加到主畫面」\n3. 按「安裝」';
    alert(guide);   // afk-ui 會把 alert 美化成深色卡片
  }
  // 把「安裝成 APP」註冊成首頁「⚙ 設定」選單的一項(由 afk-storage 渲染)。
  //   visible 於開選單時才求值:未安裝且環境支援 PWA 才出現,裝好後自動消失。
  function registerInstallSetting() {
    window.AFK_SETTINGS = window.AFK_SETTINGS || { _items: [], add: function (it) { this._items.push(it); } };
    AFK_SETTINGS.add({
      label: '📥 安裝成 APP',
      visible: function () { return pwaCapable() && !isStandalone(); },
      onClick: onInstallClick
    });
  }
  // 登入畫面右上角的「📲 安裝到桌面」：只給手機／平板。
  //   判斷手機：觸控為主(pointer:coarse)且 UA 是 Android／iPhone／iPad(iPadOS 會冒充 Mac → 再看有沒有觸控點)。
  //   只在登入畫面(#main-menu 看得到、還沒進遊戲)顯示；掛在 body 上(#login-art-stage 會把不認得的子元素藏掉)。
  function isMobileDevice() {
    var ua = navigator.userAgent || '';
    var touchMac = /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1;   // iPadOS
    var coarse = !window.matchMedia || window.matchMedia('(pointer: coarse)').matches;
    return coarse && (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || touchMac);
  }
  function mountInstallFab() {
    if (!pwaCapable() || isStandalone() || !isMobileDevice()) return;
    if (!document.getElementById('afk-pwa-fab-style')) {
      var st = document.createElement('style');
      st.id = 'afk-pwa-fab-style';
      st.textContent = '#afk-pwa-fab{position:fixed;top:calc(var(--orig-bar-h,0px) + 12px);right:12px;z-index:60;display:none;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;' +
        'border:1px solid #b08a4a;background:linear-gradient(#3a2d1c,#1b140c);color:#f3dfae;font-size:15px;font-weight:700;letter-spacing:1px;box-shadow:0 2px 8px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,230,170,.25);cursor:pointer;-webkit-tap-highlight-color:transparent;}' +
        '#afk-pwa-fab.on{display:flex;}#afk-pwa-fab:active{filter:brightness(1.2);}';
      document.head.appendChild(st);
    }
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'afk-pwa-fab'; b.textContent = '📲 安裝到桌面';
    b.addEventListener('click', onInstallClick);
    document.body.appendChild(b);
    function sync() {
      var mm = document.getElementById('main-menu'), gs = document.getElementById('game-screen');
      var onLogin = !!(mm && mm.getClientRects().length) && !(gs && !gs.classList.contains('hidden'));
      var show = onLogin && !isStandalone();
      if (b.classList.contains('on') !== show) b.classList.toggle('on', show);
    }
    sync();
    setInterval(sync, 1000);
  }
  function bindInstallEvents() {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
    });
    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
    });
  }

  // ----- 圖桶對帳(不下載圖,只清作者換過的舊圖,下次 on-demand 抓新版)-----------
  // 抓最新對帳清單(走網路、永遠最新),交給 cb 用。
  function withJson(url, cb) {
    fetch(url, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { if (data && data.length) cb(data); })
      .catch(function () {});
  }
  // 首次安裝尚未接管(無 controller)→ 等接管後再把 fn 跑起來。
  function whenController(fn) {
    var ctrl = navigator.serviceWorker.controller;
    if (ctrl) { fn(ctrl); return; }
    navigator.serviceWorker.addEventListener('controllerchange', function once() {
      navigator.serviceWorker.removeEventListener('controllerchange', once);
      whenController(fn);
    });
  }
  // 每次載入把最新 assets-manifest 送給 SW reconcile:只清掉 sha 對不上的舊圖(作者換一張只清那一張,
  //   下次用到才 on-demand 抓新版),不下載整包。
  //   這次開頁不是由 SW 接手的(第一次開／無痕每次都是／強制重整)→ 跳過:圖桶裡只有這次剛抓的最新圖，沒東西要對，
  //   清單卻有 600KB,會跟登入圖、地圖搶頻寬。跳過是安全的:沒記過 sha 的圖下次對帳時會用實際內容補驗(見 sw.js)。
  var controlledAtLoad = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  function reconcileImages() {
    if (!controlledAtLoad) return;
    whenController(function (ctrl) {
      withJson('assets-manifest.json', function (manifest) {
        ctrl.postMessage({ type: 'reconcile-images', manifest: manifest });
      });
    });
  }
  // 怪物動畫幀「一怪一雜湊」對帳:anim/ 幀太多不進 assets-manifest,改用 anim-manifest.json(每個怪資料夾一個合併 sha),
  //   送給 SW 逐「怪」比對——某怪的幀被作者換過 → 該怪快取整包清掉、下次看到時 on-demand 抓新版。不下載整包。
  function reconcileAnim() {
    whenController(function (ctrl) {
      withJson('anim-manifest.json', function (folders) {
        ctrl.postMessage({ type: 'reconcile-anim', folders: folders });
      });
    });
  }
  // 程式桶對帳:程式桶桶名固定不隨版本換(檔案以 ?v= 定址,換版即換 URL、快取續用),代價是
  //   「舊 ?v= 的 js/css」會殘留在桶裡 → 把「本頁實際引用的 js/css URL 清單」送給 SW,清掉不在清單上的殘留。
  //   清單從 DOM 收集(script[src] + link[rel=stylesheet]),永遠跟當下載入的 index.html 一致,零手動維護。
  function reconcileCode() {
    whenController(function (ctrl) {
      var keep = [];
      var scripts = document.querySelectorAll('script[src]');
      for (var i = 0; i < scripts.length; i++) keep.push(scripts[i].src);
      var links = document.querySelectorAll('link[rel="stylesheet"][href]');
      for (var j = 0; j < links.length; j++) keep.push(links[j].href);
      if (keep.length) ctrl.postMessage({ type: 'reconcile-code', keep: keep });
    });
  }

  // ----- SW 觀察:nudge 重抓 sw.js 比對 + 圖桶對帳(更新接管交給瀏覽器,本檔不主導)-----------
  function watchUpdates() {
    navigator.serviceWorker.ready.then(function (r) {
      reg = r;
      // 載入時 nudge 瀏覽器重抓 sw.js 比對。更新接管走瀏覽器標準流程即可(導覽已 network-first,
      //   使用者看到的程式碼本來就一律最新,不需頁面端 skip-waiting/強制 reload)。
      reg.update().catch(function () {});
      reconcileImages();   // 每次載入:清掉作者換過的舊圖(下次用到才 on-demand 抓新版)
      reconcileAnim();     // 同上,但針對怪物動畫幀(逐「怪」對帳,見 reconcileAnim)
      reconcileCode();     // 程式桶:清掉換版後殘留的舊 ?v= js/css(桶名固定不倒桶,見 sw.js reconcileCode)
    }).catch(function () {});
  }

  // ----- 有新版本：畫面上方一顆按鈕，點了重新載入 -----------------------------------
  //   每 3 分鐘、切回前景時讀一次 version.json(SW 不攔、走網路),code 跟這次開頁時讀到的不同＝網站換版了。
  //   重新載入＝跟關掉再開一樣:核心在 pagehide/beforeunload 會先把存檔寫好(js/13 _flushSaveNow、js/27 離線結算),這裡不碰存檔。
  //   開頁基準也取自 version.json(頁面沒有內嵌版本碼);讀不到(file://、離線)就整個不做,不打擾遊戲。
  //   點按鈕先開「更新內容」視窗(changelog.json,根目錄、SW 不攔):列出開頁那版之後的每一筆,裡面再按「點此更新」。
  //   changelog.json＝[{ at:'YYYY-MM-DD HH:MM', items:['玩家看得懂的一句', …] }, …] 新的在前;
  //   發布時新增一筆,at 寫發布當下(介於上一版與這一版的 buildAt 之間即可),只寫玩家有感的、白話(同 CLAUDE.md「玩家看得到的字」)。
  //   另有「更新紀錄」(站長要求隨時能看):設定視窗最上排、登入畫面「其他功能」選單各一顆,同一個視窗列出全部紀錄;有新版本時底下才有「點此更新」。
  var VER_POLL_MS = 3 * 60 * 1000;
  var verBaseAt = '';   // 開頁那版的 buildAt:更新內容只列這之後的
  var updAvail = false;   // 網站已經換版(上方按鈕出現了)
  function watchNewVersion() {
    if (!/^https?:$/.test(location.protocol)) return;
    var base = null, last = 0;
    function check() {
      if (updAvail || document.hidden) return;
      last = Date.now();
      fetch('version.json?t=' + last, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (v) {
          var code = v && v.code; if (!code) return;
          if (base == null) { base = code; verBaseAt = v.buildAt || ''; return; }
          if (code !== base && !updAvail) { updAvail = true; showUpdateBtn(); }
        })
        .catch(function () {});
    }
    check();
    setInterval(check, VER_POLL_MS);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - last > 30000) check(); });
  }
  function showUpdateBtn() {
    if (document.getElementById('afk-upd')) return;
    updStyle();
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'afk-upd'; b.textContent = '🔄 有新版本・點此更新';
    b.addEventListener('click', function () { openUpdateWin(false); });
    document.body.appendChild(b);
  }
  function updStyle() {
    if (document.getElementById('afk-upd-style')) return;
    var st = document.createElement('style');
    st.id = 'afk-upd-style';
    // 頭像列下方置中(上緣那排左邊是頭像、右邊是狀態圖示);層級比工具列、視窗都高
    st.textContent = '#afk-upd{position:fixed;top:calc(var(--orig-bar-h,0px) + 70px);left:50%;transform:translateX(-50%);z-index:99990;display:flex;align-items:center;gap:6px;padding:8px 18px;' +
      'border-radius:999px;border:1px solid #e0b04a;background:linear-gradient(#5a3d12,#2a1b07);color:#ffe6a8;font-size:15px;font-weight:700;letter-spacing:1px;white-space:nowrap;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.7),0 0 12px rgba(240,190,80,.45);cursor:pointer;-webkit-tap-highlight-color:transparent;font-family:inherit;animation:afkUpdGlow 1.6s ease-in-out infinite;}' +
      '#afk-upd:active{filter:brightness(1.2);}' +
      '@keyframes afkUpdGlow{50%{box-shadow:0 2px 10px rgba(0,0,0,.7),0 0 20px rgba(255,210,110,.85);}}' +
      // 更新內容視窗(樣式同遊戲內視窗:深棕底、金框、標題列右上角 ✕)
      '#afk-updwin{position:fixed;inset:0;z-index:99991;display:flex;align-items:center;justify-content:center;padding:calc(var(--orig-bar-h,0px) + 16px) 14px 16px;background:rgba(0,0,0,.6);}' +
      '#afk-updwin .box{width:min(100%,420px);max-height:100%;display:flex;flex-direction:column;background:linear-gradient(#1f1813,#120d09);border:1px solid #8a6a3a;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,.9);overflow:hidden;color:#e9dcc0;}' +
      '#afk-updwin .hd{position:relative;flex:none;height:40px;display:flex;align-items:center;justify-content:center;background:linear-gradient(#4a4038,#221d19);border-bottom:1px solid #2a241e;font-size:17px;font-weight:700;letter-spacing:.2em;color:#f1e3c4;text-shadow:0 1px 2px #000;}' +
      '#afk-updwin .hd button{position:absolute;right:5px;top:50%;transform:translateY(-50%);width:32px;height:28px;padding:0;border:1px solid #8a6f52;border-radius:4px;background:linear-gradient(#6a3026,#2e140f);color:#fbe3d2;font-size:17px;line-height:1;cursor:pointer;}' +
      '#afk-updwin .bd{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:10px 14px;}' +
      '#afk-updwin .bd:empty{display:none;}' +
      '#afk-updwin .day{margin:2px 0 4px;font-size:13px;color:#c9a463;}' +
      '#afk-updwin ul{margin:0 0 10px;padding-left:20px;list-style:disc;}' +
      '#afk-updwin li{margin:3px 0;font-size:15px;line-height:1.5;list-style:disc;}' +
      '#afk-updwin li::marker{color:#c9a463;}' +
      '#afk-updwin .ft{flex:none;padding:10px 14px 14px;display:flex;justify-content:center;}' +
      '#afk-updwin .go{min-width:60%;padding:10px 18px;border-radius:6px;border:1px solid #e0b04a;background:linear-gradient(#7a5a1e,#3f2c0c);color:#ffe6a8;font-size:16px;font-weight:700;letter-spacing:1px;cursor:pointer;font-family:inherit;}' +
      '#afk-updwin .go:active{filter:brightness(1.2);}';
    document.head.appendChild(st);
  }
  function escHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // all＝更新紀錄(列全部、有新版本才有「點此更新」)；否則＝更新內容(列開頁那版之後的)
  function openUpdateWin(all) {
    if (document.getElementById('afk-updwin')) return;
    updStyle();
    var title = all ? '更新紀錄' : '更新內容', canGo = !all || updAvail;
    var w = document.createElement('div');
    w.id = 'afk-updwin';
    w.innerHTML = '<div class="box" role="dialog" aria-label="' + title + '"><div class="hd">' + title + '<button type="button" aria-label="關閉">✕</button></div>' +
      '<div class="bd"></div>' + (canGo ? '<div class="ft"><button type="button" class="go">點此更新</button></div>' : '') + '</div>';
    document.body.appendChild(w);
    function remove() { if (w.parentNode) w.parentNode.removeChild(w); }
    var layer = window.AFK_UI ? AFK_UI.openLayer(remove) : null;   // 手機返回鍵 / ESC 可關
    function close() { if (layer && window.AFK_UI) AFK_UI.closeLayer(layer); else remove(); }
    w.addEventListener('click', function (e) { if (e.target === w) close(); });
    w.querySelector('.hd button').addEventListener('click', close);
    var go = w.querySelector('.go');
    if (go) go.addEventListener('click', function () { go.disabled = true; go.textContent = '更新中…'; location.reload(); });
    // 更新內容：讀不到就只留「點此更新」(不擋更新)
    fetch('changelog.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (list) {
        if (!Array.isArray(list) || !w.parentNode) return;
        var ok = function (e) { return e && e.at && Array.isArray(e.items); };
        var news = all ? list.filter(ok) : list.filter(function (e) { return ok(e) && (!verBaseAt || e.at > verBaseAt); });
        if (!news.length) news = list.slice(0, 1).filter(ok);
        var days = [], byDay = {};   // 同一天的併成一組（一天常發好幾次）
        news.slice(0, all ? 60 : 12).forEach(function (e) {
          var d = String(e.at).slice(0, 10);
          if (!byDay[d]) { byDay[d] = []; days.push(d); }
          byDay[d] = byDay[d].concat(e.items);
        });
        w.querySelector('.bd').innerHTML = days.map(function (d) {
          return '<div class="day">' + escHtml(d) + '</div><ul>' + byDay[d].map(function (t) { return '<li>' + escHtml(t) + '</li>'; }).join('') + '</ul>';
        }).join('');
      })
      .catch(function () {});
  }

  // 更新紀錄按鈕：設定視窗最上排、回選角旁邊（#settings-top-row，原本「NPC AI 對話」的位置）＋登入畫面「其他功能」選單。直接開檔案(file://)讀不到紀錄 → 不放
  function mountChangelogBtn() {
    if (!/^https?:$/.test(location.protocol)) return;
    window.AFK_SETTINGS = window.AFK_SETTINGS || { _items: [], add: function (it) { this._items.push(it); } };
    AFK_SETTINGS.add({ label: '📜 更新紀錄', onClick: function () { openUpdateWin(true); } });
    var row = document.getElementById('settings-top-row');
    if (!row) { console.warn('[AFK-pwa] 找不到設定視窗的 #settings-top-row，遊戲內的更新紀錄按鈕停用。'); return; }
    if (document.getElementById('afk-changelog-btn')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'afk-changelog-btn';
    b.className = 'btn py-1 px-3 text-sm font-bold bg-slate-700 hover:bg-slate-600 border-slate-500 text-slate-100';   // 同排「回選角」的樣式
    b.textContent = '📜 更新紀錄';
    b.addEventListener('click', function () { openUpdateWin(true); });
    row.appendChild(b);
  }

  function init() {
    injectHead();
    registerInstallSetting();
    bindInstallEvents();
    mountInstallFab();
    watchNewVersion();
    mountChangelogBtn();
    if (pwaCapable()) {
      watchUpdates();
    }
    console.log('[AFK-pwa] hooks OK — PWA 安裝/圖桶對帳已就緒(不預抓,圖片用到才抓)。');
  }

  ready(init);
})();
