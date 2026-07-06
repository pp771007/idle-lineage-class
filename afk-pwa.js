/* ============================================================================
 * afk-pwa.js — 把遊戲變成可「安裝成 APP」的 PWA(安裝 UI + 圖桶對帳)
 *
 * 行為（全在首頁 #main-menu 的「⚙ 設定」選單，遊戲中不顯示）：
 *   ● 還沒安裝 → 設定選單出現「📥 安裝成 APP」。
 *       - Android/桌機 Chromium：點了叫出系統安裝視窗（beforeinstallprompt）。
 *       - iOS / 抓不到安裝事件：點了跳文字引導（分享→加入主畫面）。
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
 *
 * 沒有「程式更新」UI 的原因：
 *   sw.js 已把導覽文件改 network-first——線上開頁一律最新「殼」,JS 帶 ?v= 換版即換 URL,
 *   「線上＝永遠最新」自動且無條件,不需頁面端偵測落後/強制刷新/讓使用者選自動更新。離線退快取照常。
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
  // 點「安裝」先彈一張說明卡：提醒「日後移除安裝」各瀏覽器對存檔的處理不一定一樣，先匯出存檔再移除較保險。
  function onInstallClick() {
    installNoticeBox(doInstall);
  }
  function installNoticeBox(onOk) {
    var m = document.createElement('div');
    m.setAttribute('style', 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:24px;');
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
      ? 'iPhone / iPad 安裝方式：\n在 Safari 點下方的「分享」鈕 → 往下找「加入主畫面」→ 加入。\n之後從桌面圖示開啟，即可像 App 一樣遊玩。'
      : '安裝方式：\n點瀏覽器右上角「⋮」選單 → 選「安裝應用程式」或「加到主畫面」。\n之後從桌面圖示開啟，即可像 App 一樣遊玩。';
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
  function reconcileImages() {
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

  // ----- SW 觀察:nudge 重抓 sw.js 比對 + 圖桶對帳(更新接管交給瀏覽器,本檔不主導)-----------
  function watchUpdates() {
    navigator.serviceWorker.ready.then(function (r) {
      reg = r;
      // 載入時 nudge 瀏覽器重抓 sw.js 比對。更新接管走瀏覽器標準流程即可(導覽已 network-first,
      //   使用者看到的程式碼本來就一律最新,不需頁面端 skip-waiting/強制 reload)。
      reg.update().catch(function () {});
      reconcileImages();   // 每次載入:清掉作者換過的舊圖(下次用到才 on-demand 抓新版)
      reconcileAnim();     // 同上,但針對怪物動畫幀(逐「怪」對帳,見 reconcileAnim)
    }).catch(function () {});
  }

  function init() {
    injectHead();
    registerInstallSetting();
    bindInstallEvents();
    if (pwaCapable()) {
      watchUpdates();
    }
    console.log('[AFK-pwa] hooks OK — PWA 安裝/圖桶對帳已就緒(不預抓,圖片用到才抓)。');
  }

  ready(init);
})();
