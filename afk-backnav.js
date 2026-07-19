/* ============================================================================
 * afk-backnav.js — 手機「返回鍵 / 返回手勢」回首頁
 *
 * 需求:在「選擇存檔位(載入進度 / 新遊戲)」與「創角」這兩個子畫面,按 Android 返回鍵 /
 *   iOS 返回手勢時 → 回到首頁主選單,而不是離開頁面 / 關掉 PWA。
 *
 * 作法(History API,完全不改作者碼,只包住作者的畫面切換函式 + 聽 popstate):
 *   - 進入子畫面(openSlotSelect / showCreation)後補一個 history「攔截狀態」→ 讓返回有東西可 pop。
 *   - 使用者按返回(popstate)且目前在子畫面 → 呼叫作者原生返回(slotBackToMenu / backToMenu)回首頁。
 *   - 使用者改用畫面上的「返回」鈕、或選存檔位進了遊戲(slotBackToMenu/backToMenu/startGame/loadGame)
 *     → 同步把攔截狀態 pop 掉,免 history 殘留、免在首頁/遊戲中多一次「空返回」。
 *   整個子流程(選存檔位→創角)只押一個攔截狀態,故從創角按一次返回即直接回首頁(與原生返回鈕一致)。
 *
 * 範圍:只在手機啟用(桌機瀏覽器返回鍵維持原生行為);非子畫面(首頁 / 遊戲中)一律放行原生行為。
 *   遊戲中的「回首頁」另由 afk-mobile 的 🚪登出鈕處理,不在本檔範圍。
 *
 * 優雅降級:抓不到作者函式就輪詢幾次,真的沒有就安靜停用,不影響遊戲。
 * 掛接:在 index.html </body> 前 <script src="afk-backnav.js">(無必須命中的 DOM 掛點,不列入 smoke)。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('backnav')) return;   // 🎚️ 外掛開關:關掉就透明放行原版行為

  function isMobile() {
    try {
      var sc = window.__mobileScaling;
      if (sc && typeof sc.isMobileDevice === 'function' && sc.isMobileDevice()) return true;
    } catch (e) {}
    return (navigator.maxTouchPoints || 0) > 0
      || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches)
      || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || navigator.standalone === true;
  }

  var SUBS = ['slot-select-panel', 'creation-panel'];
  function vis(id) { var e = document.getElementById(id); return !!(e && !e.classList.contains('hidden')); }
  function subVisible() { for (var i = 0; i < SUBS.length; i++) if (vis(SUBS[i])) return true; return false; }

  var trapped = false;     // 目前是否押著一個 history 攔截狀態
  var ignorePop = false;   // 下一個 popstate 是我們自己 history.back() 觸發的 → 略過處理

  function pushTrap() {
    if (trapped) return;
    try { history.pushState({ afkBack: 1 }, ''); trapped = true; } catch (e) {}
  }
  function consumeTrap() {
    if (!trapped) return;
    trapped = false; ignorePop = true;
    try { history.back(); } catch (e) { ignorePop = false; }
  }

  function routeHome() {
    // 依目前所在子畫面呼叫作者原生返回(兩者都會回到 #main-menu)
    if (vis('creation-panel') && typeof window.backToMenu === 'function') window.backToMenu();
    else if (vis('slot-select-panel') && typeof window.slotBackToMenu === 'function') window.slotBackToMenu();
  }

  window.addEventListener('popstate', function () {
    if (ignorePop) { ignorePop = false; return; }
    if (!isMobile()) return;            // 桌機:維持原生返回行為
    // ⚠ 別的歷史管理器(afk-ui 接管的 alert 彈窗,用 AFK_UI.openLayer/closeLayer 壓/退一格歷史)在子畫面上方
    //   開關彈窗時,它自己的 closeLayer 會呼叫 history.back() → 這個「程式化的 back」也會觸發本監聽器。
    //   若退回後「還停在我們自己的攔截狀態(afkBack)或某個彈窗層(afkLayer)上」→ 表示被 pop 掉的是壓在我們上方的
    //   彈窗歷史、我們的攔截狀態其實沒被動到,不是「使用者要離開子畫面」→ 不可路由回首頁、也不可清掉 trapped
    //   (否則匯入後關閉提示彈窗會被誤判成返回→自動跳回首頁,且 trapped 殘留、每匯入一次累積一格歷史。踩過)。
    var st = history.state;
    if (st && (st.afkBack || st.afkLayer)) return;
    if (subVisible()) {
      trapped = false;                  // 瀏覽器已 pop 掉我們的攔截狀態
      routeHome();
    }
    // 非子畫面(首頁 / 遊戲中):不攔,放行原生行為
  });

  // 包住「進入子畫面」的函式 → 進去後押上攔截狀態(整個子流程只押一個)
  function wrapEnter(name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__afkBack) return;
    var w = function () {
      var r = orig.apply(this, arguments);
      try { if (isMobile() && subVisible()) pushTrap(); } catch (e) {}
      return r;
    };
    w.__afkBack = true; window[name] = w;
  }
  // 包住「用按鈕回首頁 / 進遊戲」的函式 → 同步 pop 掉攔截狀態(保持 history 與畫面一致)
  function wrapLeave(name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__afkBack) return;
    var w = function () {
      var r = orig.apply(this, arguments);
      try { consumeTrap(); } catch (e) {}
      return r;
    };
    w.__afkBack = true; window[name] = w;
  }

  function install() {
    if (typeof window.openSlotSelect !== 'function') return false;
    wrapEnter('openSlotSelect');   // 首頁 → 選擇存檔位
    wrapEnter('showCreation');     // 選存檔位 → 創角
    wrapLeave('slotBackToMenu');   // 選存檔位「返回」鈕 → 首頁
    wrapLeave('backToMenu');       // 創角「返回」鈕 → 首頁
    wrapLeave('startGame');        // 創角 → 進遊戲
    wrapLeave('loadGame');         // 選存檔位(載入)→ 進遊戲
    return true;
  }

  if (!install()) {
    var n = 0, iv = setInterval(function () { if (install() || ++n > 40) { clearInterval(iv); } }, 150);
  }
  console.log('[AFK-backnav] hooks OK — 手機返回鍵/手勢在「選存檔位/創角」回首頁已掛上。');
})();
