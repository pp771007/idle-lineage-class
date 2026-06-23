/* ============================================================================
 * afk-pwa.js — 把遊戲變成可「安裝成免網路遊玩」的 PWA，並管更新流程
 *
 * 行為（全在首頁 #main-menu，遊戲中不顯示）：
 *   ● 還沒安裝 → 顯示一條純文字連結「📥 安裝成免網路遊玩」。
 *       - Android/桌機 Chromium：點了叫出系統安裝視窗（beforeinstallprompt）。
 *       - iOS / 抓不到安裝事件：點了跳文字引導（分享→加入主畫面）。
 *   ● 安裝完（以 app 模式開啟）→ 連結換成 checkbox「自動更新至最新版本」（預設打勾），
 *       並在背景把全部圖（assets/）抓進圖桶，顯示「離線資源下載中 X%」直到 100%（之後就能完全離線）。
 *   ● 更新只在「開網頁／重整網頁」那一刻檢查一次（不常駐輪詢），所以判斷時必定停在首頁，不會在操作人物／戰鬥中途跳更新。
 *       - checkbox 有勾 → 偵測到新版直接重整套用（此時人在首頁）。
 *       - checkbox 沒勾 → 顯示「🔄 更新至最新版」連結，按了跳確認視窗，確認才更新。
 *
 * 設計重點：
 *   - SW 註冊沿用 afk-sw.js（已上線驗證過）；本檔只負責「觀察更新 / UI / 背景預抓」。
 *   - <head> 的 manifest / 圖示 / theme-color 用 JS 注入（比照 afk-fixes 注 favicon）——
 *     因為每小時自動同步會用原版整份覆蓋 index.html、只重插外掛 <script>，寫死在 <head> 會被洗掉。
 *   - 非安全環境（file://）自動略過 SW 相關功能，遊戲照舊、零錯誤。
 *
 * 掛接：index.html </body> 前 <script src="afk-pwa.js"></script>
 * ========================================================================== */
(function () {
  'use strict';

  var PREF_AUTOUPDATE = 'afk_pwa_autoupdate';   // '0'=關閉自動更新；其餘（含未設）=開啟（預設打勾）
  var PRECACHE_DONE = 'afk_pwa_precached';       // '1'=離線資源已抓滿，跳過自動預抓
  var ICON = 'pwa-icon-192.png';

  var reg = null;            // ServiceWorkerRegistration
  var waitingSW = null;      // 等待接管的新版 SW
  var refreshing = false;    // 防止 controllerchange 無限重整
  var updateApplied = false;  // 是否「我們主動套用更新」(只有這種 controllerchange 才重整)
  var precaching = false, precacheDone = 0, precacheTotal = 0, precacheFinished = false;
  var deferredPrompt = null; // 攔下來的 beforeinstallprompt，供安裝連結點擊時用
  var buildId = '';          // 目前這版的 build 時間(向控制中的 SW 問,僅供畫面辨識)

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  // 自動更新偏好是「全網域共用的一個 pin」——本來就只能這樣:一個 origin 只有一個 Service Worker,
  //   App 與瀏覽器分頁共用它(也共用這個 localStorage 旗標)。cache-first 下不可能 App 留舊版、瀏覽器跑新版並存,
  //   誰把新版 SW 啟用(skip-waiting)就是全體一起換。故「關閉自動更新」= App 與瀏覽器都不會被自動推上去,
  //   要更新得自己按更新鈕(App 與瀏覽器都有提供,見 renderBar)。這樣「開瀏覽器」不會反過來把想留舊版的 App 強推到新版。
  function autoUpdateOn() { return localStorage.getItem(PREF_AUTOUPDATE) !== '0'; }
  function isStandalone() {
    return (window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches)) ||
           window.navigator.standalone === true;
  }
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent || '') && !window.MSStream;
  }
  // 是否正停在首頁(主選單可見)。遊戲中 #main-menu 會被加上 .hidden(見 index.html 的 startGame/loadGame)。
  //   自動更新只在首頁套用——避免在操作人物/戰鬥中突然刷新打斷遊玩。
  function onHomePage() {
    var m = document.getElementById('main-menu');
    return !!(m && !m.classList.contains('hidden'));
  }
  // 真的能跑 PWA/SW 的環境:有 serviceWorker、是安全環境、且 protocol 是 http/https。
  //   用「正面表列 http(s)」而不是排除 file://:SW 本來就只在 http(s) 跑,這樣連 data:/blob: 等
  //   origin 為 null 的環境一併擋掉,且不必去猜各家瀏覽器怎麼回報 origin
  //   (file:// 的 location.origin:Chromium 回 'file://'、Firefox 回 'null',但 protocol 兩家都是 'file:')。
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
    // manifest 只在 http(s) 注入:file:// 下瀏覽器抓 manifest 會被 CORS 擋(origin null)、console 噴紅字,且 PWA 本來就只在 http(s) 能用
    if (/^https?:$/.test(location.protocol) && !document.querySelector('link[rel="manifest"]')) add('link', { rel: 'manifest', href: 'manifest.webmanifest' });
    if (!document.querySelector('link[rel="apple-touch-icon"]')) add('link', { rel: 'apple-touch-icon', href: ICON });
    if (!document.querySelector('meta[name="theme-color"]')) add('meta', { name: 'theme-color', content: '#0f141d' });
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    if (!document.querySelector('meta[name="mobile-web-app-capable"]')) add('meta', { name: 'mobile-web-app-capable', content: 'yes' });
    if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) add('meta', { name: 'apple-mobile-web-app-title', content: '放置天堂' });
  }

  function injectCSS() {
    if (document.getElementById('afk-pwa-style')) return;
    var s = document.createElement('style');
    s.id = 'afk-pwa-style';
    s.textContent =
      '#afk-pwa-bar{margin-top:6px;text-align:center;font-size:13px;color:#94a3b8;line-height:1.8;}' +
      '#afk-pwa-bar .afk-pwa-link{color:#7dd3fc;text-decoration:underline;cursor:pointer;background:none;border:0;padding:0;font:inherit;}' +
      '#afk-pwa-bar .afk-pwa-link:hover{color:#bae6fd;}' +
      '#afk-pwa-bar .afk-pwa-chk{display:inline-flex;align-items:center;gap:6px;cursor:pointer;justify-content:center;}' +
      '#afk-pwa-bar .afk-pwa-chk input{width:15px;height:15px;cursor:pointer;}' +
      '#afk-pwa-bar .afk-pwa-update{color:#fbbf24;font-weight:bold;}' +
      '#afk-pwa-bar .afk-pwa-prog{color:#34d399;}' +
      '#afk-pwa-bar .afk-pwa-done{color:#34d399;}' +
      '#afk-pwa-bar .afk-pwa-ver{color:#64748b;font-size:11px;margin-top:2px;letter-spacing:.3px;}' +
      // 更新過場：套用更新到實際重整之間（SW skip-waiting→activate 有秒級延遲），蓋全螢幕轉圈避免「沒反應」的錯覺
      '#afk-pwa-updating{position:fixed;inset:0;z-index:100000;background:rgba(8,12,20,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#e2e8f0;font-size:15px;}' +
      '#afk-pwa-updating .afk-pwa-spin{width:42px;height:42px;border:4px solid #334155;border-top-color:#7dd3fc;border-radius:50%;animation:afkPwaSpin .8s linear infinite;}' +
      '#afk-pwa-updating .afk-pwa-updating-text{letter-spacing:.5px;}' +
      '@keyframes afkPwaSpin{to{transform:rotate(360deg);}}';
    document.head.appendChild(s);
  }

  // ----- 首頁 UI ----------------------------------------------------------
  function bar() {
    var b = document.getElementById('afk-pwa-bar');
    if (!b) {
      var menu = document.getElementById('main-menu');
      if (!menu) return null;
      b = document.createElement('div');
      b.id = 'afk-pwa-bar';
      menu.appendChild(b);
    }
    return b;
  }

  function renderBar() {
    var b = bar();
    if (!b) return;
    if (!pwaCapable() && !isStandalone()) { b.innerHTML = ''; return; }   // file:// 等非 PWA 環境:不顯示任何 PWA UI(裝不了,顯示只會誤導)
    var html = '';
    // 關了自動更新 + 有等待中的新版 → 顯示手動更新連結。App 與瀏覽器分頁都要顯示:
    //   關閉是全網域共用的 pin,瀏覽器分頁也不會被自動推上去,所以這裡要給它一個手動更新的入口,
    //   否則「不自動更新、又沒得手動更新」就會卡死(使用者回報過的舊 bug)。
    var updateLink = (!autoUpdateOn() && waitingSW)
      ? '<div><button type="button" class="afk-pwa-link afk-pwa-update" id="afk-pwa-update">🔄 更新至最新版</button></div>'
      : '';
    if (!isStandalone()) {
      // 還沒安裝：純文字連結（非大按鈕）
      html = '<button type="button" class="afk-pwa-link" id="afk-pwa-install">📥 安裝成免網路遊玩</button>' + updateLink;
    } else {
      // 已安裝：自動更新 checkbox（預設打勾）
      html = '<label class="afk-pwa-chk"><input type="checkbox" id="afk-pwa-auto"' + (autoUpdateOn() ? ' checked' : '') + '> 自動更新至最新版本</label>';
      html += updateLink;
      // 背景預抓進度
      if (precaching) {
        var pct = precacheTotal ? Math.floor(precacheDone / precacheTotal * 100) : 0;
        html += '<div class="afk-pwa-prog">離線資源下載中 ' + pct + '%（' + precacheDone + '/' + precacheTotal + '）</div>';
      } else if (precacheFinished) {
        html += '<div class="afk-pwa-done">✅ 已可完全離線遊玩</div>';
      }
    }
    if (buildId) html += '<div class="afk-pwa-ver">版本 ' + buildId + '</div>';
    b.innerHTML = html;

    var inst = document.getElementById('afk-pwa-install');
    if (inst) inst.addEventListener('click', onInstallClick);
    var auto = document.getElementById('afk-pwa-auto');
    if (auto) auto.addEventListener('change', function () {
      localStorage.setItem(PREF_AUTOUPDATE, this.checked ? '1' : '0');
      renderBar();
      if (this.checked && waitingSW) applyUpdate();   // 勾回自動更新且有等待中新版 → 立刻套用
    });
    var upd = document.getElementById('afk-pwa-update');
    if (upd) upd.addEventListener('click', function () {
      confirmBox('要更新到最新版本嗎？更新後會重新載入遊戲（進度已存檔，不會遺失）。', applyUpdate);
    });
  }

  // 自製確認視窗（不用原生 confirm：iOS 會抑制；樣式比照登出視窗的深色卡片）
  function confirmBox(msg, onOk) {
    var m = document.createElement('div');
    m.setAttribute('style', 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:24px;');
    m.innerHTML =
      '<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;max-width:360px;width:100%;padding:20px;color:#e2e8f0;text-align:center;">' +
      '<div style="line-height:1.7;margin-bottom:16px;">' + msg + '</div>' +
      '<div style="display:flex;gap:10px;">' +
      '<button type="button" id="afk-pwa-cancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid #475569;background:#334155;color:#e2e8f0;cursor:pointer;">取消</button>' +
      '<button type="button" id="afk-pwa-ok" style="flex:1;padding:10px;border-radius:8px;border:1px solid #16a34a;background:#15803d;color:#fff;cursor:pointer;">確定更新</button>' +
      '</div></div>';
    document.body.appendChild(m);
    function close() { if (m.parentNode) m.parentNode.removeChild(m); }
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    m.querySelector('#afk-pwa-cancel').addEventListener('click', close);
    m.querySelector('#afk-pwa-ok').addEventListener('click', function () { close(); onOk(); });
  }

  // 點「安裝」先彈一張說明卡：提醒「日後移除安裝」各瀏覽器對存檔的處理不一定一樣，
  //   保險起見先匯出存檔再移除。用籠統寫法（不同瀏覽器/系統行為確實不一致，講死反而會誤導）。
  function onInstallClick() {
    installNoticeBox(doInstall);
  }
  function installNoticeBox(onOk) {
    var m = document.createElement('div');
    m.setAttribute('style', 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:24px;');
    m.innerHTML =
      '<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;max-width:380px;width:100%;padding:20px;color:#e2e8f0;text-align:left;">' +
      '<div style="font-weight:bold;font-size:15px;margin-bottom:12px;text-align:center;">📥 安裝成免網路遊玩</div>' +
      '<div style="line-height:1.8;font-size:13px;color:#cbd5e1;margin-bottom:16px;">' +
      '安裝後可以離線開啟，存檔會保存在這個瀏覽器／裝置上。<br><br>' +
      '<b style="color:#fbbf24;">提醒：</b>日後若要「移除安裝」，<b>部分瀏覽器或系統會連同存檔一起清掉，部分則會保留</b>——各家行為不一定相同。為了保險，移除前建議先到遊戲內<b>匯出存檔</b>備份，日後重裝或換裝置都能再匯入回來。' +
      '</div>' +
      '<div style="display:flex;gap:10px;">' +
      '<button type="button" id="afk-pwa-ni-cancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid #475569;background:#334155;color:#e2e8f0;cursor:pointer;">取消</button>' +
      '<button type="button" id="afk-pwa-ni-ok" style="flex:1;padding:10px;border-radius:8px;border:1px solid #16a34a;background:#15803d;color:#fff;cursor:pointer;">知道了，開始安裝</button>' +
      '</div></div>';
    document.body.appendChild(m);
    function close() { if (m.parentNode) m.parentNode.removeChild(m); }
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    m.querySelector('#afk-pwa-ni-cancel').addEventListener('click', close);
    m.querySelector('#afk-pwa-ni-ok').addEventListener('click', function () { close(); onOk(); });
  }

  function doInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      var dp = deferredPrompt;
      (dp.userChoice || Promise.resolve()).then(function () { deferredPrompt = null; renderBar(); });
      return;
    }
    // 抓不到安裝事件（iOS，或瀏覽器尚未允許）→ 文字引導
    var guide = isIOS()
      ? 'iPhone / iPad 安裝方式：\n在 Safari 點下方的「分享」鈕 → 往下找「加入主畫面」→ 加入。\n之後從桌面圖示開啟，即可離線遊玩。'
      : '安裝方式：\n點瀏覽器右上角「⋮」選單 → 選「安裝應用程式」或「加到主畫面」。\n之後從桌面圖示開啟，即可離線遊玩。';
    alert(guide);   // afk-ui 會把 alert 美化成深色卡片
  }

  // ----- 更新流程 ---------------------------------------------------------
  function onUpdateReady() {
    waitingSW = (reg && reg.waiting) || waitingSW;
    if (!waitingSW) return;
    if (autoUpdateOn()) autoApply();     // 自動：只在首頁套用(見 autoApply)
    else renderBar();                    // 手動：顯示「更新至最新版」
  }
  // 自動更新只在「停在首頁」時才重整套用。更新偵測本來就只發生在開網頁/重整那一刻(見 watchUpdates 註解),
  //   此時必定停在首頁,所以實務上一定會套到;這道 onHomePage 檢查純粹保險——萬一偵測稍慢、使用者已點進遊戲,
  //   就不在操作人物/戰鬥途中強制刷新打斷(使用者回報過的干擾),這個等待中的新版會留到下次開網頁/重整時自然套用。
  function autoApply() {
    if (onHomePage()) applyUpdate();
  }
  function applyUpdate() {
    if (!waitingSW) return;
    updateApplied = true;
    showUpdatingOverlay();   // 立刻給回饋，使用者按完「確定更新」不會覺得沒反應
    waitingSW.postMessage({ type: 'skip-waiting' });
    // 保險：萬一 controllerchange 沒如期觸發（卡 waiting），逾時也強制重整，不讓過場停在那
    setTimeout(function () { if (!refreshing) { refreshing = true; location.reload(); } }, 8000);
  }
  function showUpdatingOverlay() {
    if (document.getElementById('afk-pwa-updating')) return;
    var o = document.createElement('div');
    o.id = 'afk-pwa-updating';
    o.innerHTML = '<div class="afk-pwa-spin"></div><div class="afk-pwa-updating-text">正在更新至最新版…</div>';
    document.body.appendChild(o);
  }

  function watchUpdates() {
    navigator.serviceWorker.ready.then(function (r) {
      reg = r;
      if (reg.waiting && navigator.serviceWorker.controller) onUpdateReady();
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) onUpdateReady();
        });
      });
      // 只在「開網頁/重整」時檢查一次更新,不做常駐輪詢——避免遊戲中途偵測到新版而打斷遊玩。
      //   (瀏覽器本來在每次導覽就會自動重抓 sw.js 比對,這裡再主動 update() 一次確保不吃 HTTP 快取。)
      reg.update().catch(function () {});
      syncImages(false);   // 每次載入:對帳清舊圖(線上/已安裝都跑)+(已安裝未抓滿則)背景預抓
    }).catch(function () {});

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      // 只有「我們主動套用更新(skip-waiting)」才重整;首次安裝 SW 透過 clients.claim 接管不重整(避免初訪白白 reload 一次)。
      if (refreshing || !updateApplied) return;
      refreshing = true;
      location.reload();
    });

    navigator.serviceWorker.addEventListener('message', function (e) {
      var d = e.data || {};
      if (d.type === 'precache-progress') { precacheDone = d.done; precacheTotal = d.total; renderBar(); }
      else if (d.type === 'precache-done') { precaching = false; precacheFinished = true; localStorage.setItem(PRECACHE_DONE, '1'); renderBar(); }
      else if (d.type === 'version') { if (d.build && d.build !== '0000-0000') { buildId = d.build; renderBar(); } }
    });

    askVersion();
    navigator.serviceWorker.addEventListener('controllerchange', askVersion);
  }

  // 向「控制這個分頁的 SW」問現在這版的 build 時間(僅供畫面辨識)
  function askVersion() {
    var ctrl = navigator.serviceWorker.controller;
    if (ctrl) ctrl.postMessage({ type: 'get-version' });
  }

  // ----- 圖桶對帳 + 背景預抓 ----------------------------------------------
  // 抓最新 assets-manifest.json(每筆 [path, sha];manifest 走網路、永遠最新),交給 cb 用。
  function withManifest(cb) {
    fetch('assets-manifest.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (manifest) { if (manifest && manifest.length) cb(manifest); })
      .catch(function () {});
  }
  // 每次載入都把最新 manifest 送給 SW:
  //   ● reconcile(線上逛、已安裝都跑)→ 只清掉 sha 對不上的舊圖,作者換一張只重抓一張、不重載整包。
  //   ● precache(只在「已安裝且尚未抓滿」或剛安裝 forcePrecache)→ 把整包圖抓進圖桶,抓滿即可完全離線。
  //   precache 不會樂觀補記 sha(只在實際抓到才記),故與 reconcile 同時跑也不會記錯,毋須等待排序。
  //   首次安裝尚未接管(無 controller)→ 等接管後再跑(此時快取為空,reconcile 是 no-op、precache 照抓)。
  function syncImages(forcePrecache) {
    var ctrl = navigator.serviceWorker.controller;
    if (!ctrl) {
      navigator.serviceWorker.addEventListener('controllerchange', function once() {
        navigator.serviceWorker.removeEventListener('controllerchange', once);
        syncImages(forcePrecache);
      });
      return;
    }
    var precacheDoneFlag = localStorage.getItem(PRECACHE_DONE) === '1';
    var doPrecache = forcePrecache || (isStandalone() && !precacheDoneFlag);
    if (!doPrecache && isStandalone() && precacheDoneFlag) { precacheFinished = true; renderBar(); }
    withManifest(function (manifest) {
      ctrl.postMessage({ type: 'reconcile-images', manifest: manifest });
      if (doPrecache) {
        precaching = true; precacheTotal = manifest.length; precacheDone = 0; renderBar();
        ctrl.postMessage({ type: 'precache-images', manifest: manifest });
      }
    });
  }

  // ----- 安裝事件 ---------------------------------------------------------
  function bindInstallEvents() {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      renderBar();
    });
    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      renderBar();
      syncImages(true);   // 剛裝好就開始把圖抓滿(forcePrecache:此刻分頁仍是瀏覽器模式、isStandalone 還是 false)
    });
  }

  function init() {
    injectHead();
    injectCSS();
    renderBar();
    bindInstallEvents();
    if (pwaCapable()) {
      watchUpdates();
    }
    console.log('[AFK-pwa] hooks OK — PWA 安裝/離線/更新已就緒。');
  }

  ready(init);
})();
