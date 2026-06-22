/* ============================================================================
 * afk-pwa.js — 把遊戲變成可「安裝成免網路遊玩」的 PWA，並管更新流程
 *
 * 行為（全在首頁 #main-menu，遊戲中不顯示）：
 *   ● 還沒安裝 → 顯示一條純文字連結「📥 安裝成免網路遊玩」。
 *       - Android/桌機 Chromium：點了叫出系統安裝視窗（beforeinstallprompt）。
 *       - iOS / 抓不到安裝事件：點了跳文字引導（分享→加入主畫面）。
 *   ● 安裝完（以 app 模式開啟）→ 連結換成 checkbox「自動更新至最新版本」（預設打勾），
 *       並在背景把全部圖（assets/）抓進圖桶，顯示「離線資源下載中 X%」直到 100%（之後就能完全離線）。
 *   ● 有新版時：
 *       - checkbox 有勾 → 自動接管、重整到最新版。
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
  var precaching = false, precacheDone = 0, precacheTotal = 0, precacheFinished = false;
  var deferredPrompt = null; // 攔下來的 beforeinstallprompt，供安裝連結點擊時用

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function autoUpdateOn() { return localStorage.getItem(PREF_AUTOUPDATE) !== '0'; }
  function isStandalone() {
    return (window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches)) ||
           window.navigator.standalone === true;
  }
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent || '') && !window.MSStream;
  }

  // ----- <head> 注入：manifest / 圖示 / theme-color（同步會洗掉寫死的，故用 JS 補）-------
  function injectHead() {
    function add(tag, attrs) {
      var el = document.createElement(tag);
      for (var k in attrs) el.setAttribute(k, attrs[k]);
      document.head.appendChild(el);
    }
    if (!document.querySelector('link[rel="manifest"]')) add('link', { rel: 'manifest', href: 'manifest.webmanifest' });
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
      '#afk-pwa-bar .afk-pwa-done{color:#34d399;}';
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
    var html = '';
    if (!isStandalone()) {
      // 還沒安裝：純文字連結（非大按鈕）
      html = '<button type="button" class="afk-pwa-link" id="afk-pwa-install">📥 安裝成免網路遊玩</button>';
    } else {
      // 已安裝：自動更新 checkbox（預設打勾）
      html = '<label class="afk-pwa-chk"><input type="checkbox" id="afk-pwa-auto"' + (autoUpdateOn() ? ' checked' : '') + '> 自動更新至最新版本</label>';
      // 沒勾 + 有等待中的新版 → 顯示手動更新連結
      if (!autoUpdateOn() && waitingSW) {
        html += '<div><button type="button" class="afk-pwa-link afk-pwa-update" id="afk-pwa-update">🔄 更新至最新版</button></div>';
      }
      // 背景預抓進度
      if (precaching) {
        var pct = precacheTotal ? Math.floor(precacheDone / precacheTotal * 100) : 0;
        html += '<div class="afk-pwa-prog">離線資源下載中 ' + pct + '%（' + precacheDone + '/' + precacheTotal + '）</div>';
      } else if (precacheFinished) {
        html += '<div class="afk-pwa-done">✅ 已可完全離線遊玩</div>';
      }
    }
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

  function onInstallClick() {
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
    if (autoUpdateOn()) applyUpdate();   // 自動：直接接管
    else renderBar();                    // 手動：顯示「更新至最新版」
  }
  function applyUpdate() {
    if (waitingSW) waitingSW.postMessage({ type: 'skip-waiting' });
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
      setInterval(function () { reg.update().catch(function () {}); }, 60000);
      maybePrecache();
    }).catch(function () {});

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });

    navigator.serviceWorker.addEventListener('message', function (e) {
      var d = e.data || {};
      if (d.type === 'precache-progress') { precacheDone = d.done; precacheTotal = d.total; renderBar(); }
      else if (d.type === 'precache-done') { precaching = false; precacheFinished = true; localStorage.setItem(PRECACHE_DONE, '1'); renderBar(); }
    });
  }

  // ----- 背景預抓（安裝後把整包圖抓進圖桶，抓滿即可完全離線）---------------
  function maybePrecache() {
    if (!isStandalone()) return;                      // 只有「裝成 app」的人才抓那 30MB，純線上逛的人不抓
    if (localStorage.getItem(PRECACHE_DONE) === '1') { precacheFinished = true; renderBar(); return; }
    startPrecache();
  }
  function startPrecache() {
    var ctrl = navigator.serviceWorker.controller;
    if (!ctrl) {   // SW 還沒接管這個分頁 → 等接管後再抓
      navigator.serviceWorker.addEventListener('controllerchange', function once() {
        navigator.serviceWorker.removeEventListener('controllerchange', once);
        startPrecache();
      });
      return;
    }
    fetch('assets-manifest.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (urls) {
        if (!urls || !urls.length) return;
        precaching = true; precacheTotal = urls.length; precacheDone = 0; renderBar();
        ctrl.postMessage({ type: 'precache-images', urls: urls });
      })
      .catch(function () {});
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
      startPrecache();   // 剛裝好就開始把圖抓滿
    });
  }

  function init() {
    injectHead();
    injectCSS();
    renderBar();
    bindInstallEvents();
    if (window.isSecureContext && 'serviceWorker' in navigator) {
      watchUpdates();
    }
    console.log('[AFK-pwa] hooks OK — PWA 安裝/離線/更新已就緒。');
  }

  ready(init);
})();
