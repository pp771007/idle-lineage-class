/* ============================================================================
 * afk-backnav.js — 手機「返回鍵 / 返回手勢」回首頁
 *
 * 需求:在「角色選擇(載入進度 / 新遊戲)」與「創角」這兩個子畫面,按 Android 返回鍵 /
 *   iOS 返回手勢時 → 回到首頁主選單,而不是離開頁面 / 關掉 PWA。
 *
 * 作法(完全不改作者碼,只包住作者的畫面切換函式 + 向 AFK_NAV 押一層歷史):
 *   - 每次畫面切換後 syncTrap():「人在子畫面就恰好押一格 history 攔截層,回到首頁/進遊戲就退掉那格」。
 *   - 使用者按返回 → AFK_NAV 回呼本檔的 onBack → 呼叫作者原生返回(loadBackToMenu / backToMenu)退一層。
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
  // ⚠ 不能只看自己有沒有 .hidden:loadGame 進遊戲時只把外層 #creation-screen 藏起來、
  //   不會去動 #load-select-panel 自己的 class → 只看 class 會誤判「還在選角畫面」→ 攔截層退不掉,
  //   留在歷史上變孤兒格;登出 reload 後更沒人認領,每輪迴一次就多按一下返回鍵(玩家回報)。
  //   getClientRects 為空 = 自己或任一祖先被藏起來,才是真的看不到。
  function vis(id) {
    var e = document.getElementById(id);
    return !!(e && !e.classList.contains('hidden') && e.getClientRects().length);
  }
  function subVisible() { for (var i = 0; i < SUBS.length; i++) if (vis(SUBS[i])) return true; return false; }

  var trap = null;   // 目前押著的攔截層(AFK_NAV 的 handle);null = 沒押

  function pushTrap() {
    if (trap || !window.AFK_NAV) return;
    trap = AFK_NAV.push(onBack);
  }
  function consumeTrap() {
    if (!trap) return;
    var h = trap; trap = null;
    AFK_NAV.pop(h);
  }
  // 使用者按了返回鍵 → AFK_NAV 已經把這層摘掉,先清 trap 再退一層畫面,
  //   退完若還在子畫面(創角→角色選擇)由 syncTrap 重新押一格。
  function onBack() {
    trap = null;
    if (!subVisible()) return;
    routeBack();
    syncTrap();
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

  // ⚠ 本檔不自己聽 popstate:歷史層統一由 AFK_NAV 管(它會在退到本層下方時呼叫上面的 onBack)。
  //   各自聽 popstate 正是「返回鍵要按好多下」的成因——別人發的 back 也會通知自己,誤判成使用者要離開。

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
