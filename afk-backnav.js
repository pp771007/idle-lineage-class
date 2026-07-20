/* ============================================================================
 * afk-backnav.js — 手機「返回鍵 / 返回手勢」回首頁
 *
 * 需求:在「角色選擇(載入進度 / 新遊戲)」與「創角」這兩個子畫面,按 Android 返回鍵 /
 *   iOS 返回手勢時 → 回到首頁主選單,而不是離開頁面 / 關掉 PWA。
 *
 * 作法(History API,完全不改作者碼,只包住作者的畫面切換函式 + 聽 popstate):
 *   - 每次畫面切換後 syncTrap():「人在子畫面就恰好押一格 history 攔截狀態,回到首頁/進遊戲就退掉那格」。
 *   - 使用者按返回(popstate)且目前在子畫面 → 呼叫作者原生返回(loadBackToMenu / backToMenu)退一層。
 *   返回鍵的每一層都對齊畫面上「返回」鈕的行為:創角 →(backToMenu)角色選擇 →(loadBackToMenu)首頁。
 *   ⚠ 因此創角退回角色選擇後「還在子畫面」,必須再押回一格,否則下一次返回就直接關掉 PWA。
 *
 * ⚠ 掛的函式名/面板 id 要跟著上游走:上游把選角畫面換成卡片式的 #load-select-panel + openLoadSelect/
 *   loadBackToMenu 後,舊的 openSlotSelect/#slot-select-panel 整組不存在 → install() 抓不到函式會安靜
 *   停用(輪詢 40 次後放棄),返回鍵直接關掉 PWA、沒有任何錯誤訊息。同步上游後要順手確認這幾個名字還在。
 *
 * 範圍:只在手機啟用(桌機瀏覽器返回鍵維持原生行為);非子畫面(首頁 / 遊戲中)一律放行原生行為。
 *   遊戲中的「回首頁」另由 afk-mobile 的 🚪登出鈕處理,不在本檔範圍。
 *
 * 優雅降級:抓不到作者函式就輪詢幾次,真的沒有就安靜停用,不影響遊戲。
 * 掛接:在 index.html </body> 前 <script src="afk-backnav.js">;smoke 以本檔的 hooks OK log 驗它還掛得上。
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

  var SUBS = ['load-select-panel', 'creation-panel'];
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

  // 人在子畫面就恰好押著一格攔截狀態,否則退掉——每次畫面切換後呼叫,history 永遠跟畫面一致
  function syncTrap() {
    if (!isMobile()) return;
    if (subVisible()) pushTrap(); else consumeTrap();
  }

  function routeBack() {
    // 依目前所在子畫面呼叫作者原生返回(與畫面上的「返回」鈕同一層邏輯:創角→角色選擇→首頁)
    if (vis('creation-panel') && typeof window.backToMenu === 'function') window.backToMenu();
    else if (vis('load-select-panel') && typeof window.loadBackToMenu === 'function') window.loadBackToMenu();
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
      routeBack();
      syncTrap();                       // 退一層後若還在子畫面(創角→角色選擇)要再押回去
    }
    // 非子畫面(首頁 / 遊戲中):不攔,放行原生行為
  });

  // 包住「進入子畫面」的函式 → 進去後押上攔截狀態(整個子流程只押一個)
  function wrapEnter(name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__afkBack) return;
    var w = function () {
      var r = orig.apply(this, arguments);
      try { syncTrap(); } catch (e) {}
      return r;
    };
    w.__afkBack = true; window[name] = w;
  }
  // 包住「用按鈕退一層 / 進遊戲」的函式 → 同步 history(離開子畫面才 pop;創角→角色選擇仍在子畫面,那格要留著)
  function wrapLeave(name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__afkBack) return;
    var w = function () {
      var r = orig.apply(this, arguments);
      try { syncTrap(); } catch (e) {}
      return r;
    };
    w.__afkBack = true; window[name] = w;
  }

  function install() {
    if (typeof window.openLoadSelect !== 'function') return false;
    wrapEnter('openLoadSelect');   // 首頁 → 角色選擇
    wrapEnter('showCreation');     // 角色選擇 → 創角
    wrapLeave('loadBackToMenu');   // 角色選擇「返回」鈕 → 首頁
    wrapLeave('backToMenu');       // 創角「返回」鈕 → 首頁
    wrapLeave('startGame');        // 創角 → 進遊戲
    wrapLeave('loadGame');         // 角色選擇(載入)→ 進遊戲
    return true;
  }

  // ⚠ 「hooks OK」只有在真的包上作者函式後才印:smoke 就是靠這行判定本外掛還活著,無條件印會讓
  //   「上游改了函式名 → 整支安靜停用」照樣測得過(踩過,選角畫面換成 openLoadSelect 後失效沒人發現)。
  function announce() {
    console.log('[AFK-backnav] hooks OK — 手機返回鍵/手勢在「角色選擇/創角」回上層已掛上。');
  }
  if (install()) announce();
  else {
    var n = 0, iv = setInterval(function () {
      if (install()) { clearInterval(iv); announce(); }
      else if (++n > 40) { clearInterval(iv); console.warn('[AFK-backnav] 找不到 openLoadSelect(上游可能改了選角畫面的函式名/面板 id),返回鍵處理停用。'); }
    }, 150);
  }
})();
