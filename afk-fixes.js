/* ============================================================================
 * afk-fixes.js — 通用修正外掛(補原作者上游坑;桌機 / 手機皆適用,與裝置判定無關)
 *
 * 收容「不綁手機 / 不綁離線 / 不綁查詢」的通用修正。每一段都要:
 *   1) 優雅降級——抓不到掛點就安靜停用,不弄壞遊戲;
 *   2) 在段落檔頭寫明「原作者怎麼改就能整段刪」。
 *      (見 CLAUDE.md 外掛原則:只有『過時後仍會主動執行』的補坑碼才標移除條件,本檔即屬此類。)
 *
 * 掛接:在 index.html </body> 前加一行
 *   <script src="afk-fixes.js"></script>
 * ========================================================================== */
(function () {
  'use strict';

  /* --------------------------------------------------------------------------
   * 修正#1:renderTabs select-guard — 戰鬥中操作下拉選單不被刷掉
   *
   * 問題:「快速強化(批次衝裝)」的目標等級是分頁 / 物品彈窗裡的原生 <select>。戰鬥中
   *   掉寶 / 扣箭 / 夥伴耗肉會讓背包內容簽章改變 → renderTabs 整塊重建分頁 DOM → 開著的
   *   下拉連同元素被刪掉,點開瞬間被關(手機尤其明顯,桌機點開亦然,故與裝置無關)。
   * 解法:偵測焦點落在這些容器的 <select> 上時,延後該次 renderTabs;選單關閉(change /
   *   blur)後再 force 補繪一次,追上延後期間的背包變動。
   * 涵蓋:武器 / 防具分頁的「快速強化(批次)」+ 物品彈窗的「一鍵強化到指定值」三處下拉。
   *   彈窗(#item-modal)本來就不被戰鬥重繪、不會被關,一併納入當保險、行為一致。
   * 何時可移除:原作者把 renderTabs 改成不整塊重建分頁 DOM(diff 更新、不刪 <select>)時,
   *   本段即成多餘,可整段刪掉。在那之前留著無害(抓不到掛點自動 no-op,不會弄壞遊戲)。
   * ------------------------------------------------------------------------ */
  (function () {
    var TAB_SEL = '#tab-weapons,#tab-armors,#tab-items,#tab-equip,#tab-skill,#item-modal';

    function selectOpenInTabs() {
      var ae = document.activeElement;
      return !!(ae && ae.tagName === 'SELECT' && ae.closest && ae.closest(TAB_SEL));
    }

    function install() {
      if (typeof window.renderTabs !== 'function' || window.renderTabs.__qeGuard) return true;
      var orig = window.renderTabs;
      var pending = false;

      var guarded = function () {
        // 包住自己的偵測:萬一原作者哪天改了 DOM 害這裡丟錯,也絕不能波及遊戲的 renderTabs → 出錯就直接走原版
        try { if (selectOpenInTabs()) { pending = true; return; } } catch (e) {}
        return orig.apply(this, arguments);
      };
      guarded.__qeGuard = true;
      // orig 內部以全域名稱 renderTabs 讀寫 _sig 快取,改指到 guarded 後快取仍是同一份,無雙快取問題。
      window.renderTabs = guarded;

      function flush() {
        if (!pending || selectOpenInTabs()) return;   // 沒延後過、或還停在另一個下拉上就先不補
        pending = false;
        orig.call(window, true);                       // 一律 force,確保追上延後期間的背包變動
      }
      // 用 setTimeout 讓 inline onchange(更新 quickEnh.target)先跑完、選單也確實關閉後再補繪
      function onSelectDone(e) {
        var t = e.target;
        if (t && t.tagName === 'SELECT' && t.closest && t.closest(TAB_SEL)) setTimeout(flush, 0);
      }
      document.addEventListener('change', onSelectDone, true);
      document.addEventListener('blur', onSelectDone, true);

      console.log('[AFK-fixes] renderTabs select-guard 已掛上');
      return true;
    }

    try {
      if (!install()) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
        else setTimeout(install, 0);
      }
    } catch (e) {
      // 補坑碼自己掛掉不該拖垮整支外掛(也不該害冒煙測試誤判) → 安靜停用即可
      console.warn('[AFK-fixes] select-guard 安裝失敗,已略過:', e);
    }
  })();

  /* --------------------------------------------------------------------------
   * 修正#2:戰鬥 / 系統日誌「鎖定捲動」防飄移(桌機 / 手機皆然,與裝置無關)
   *
   * 問題:鎖定捲動(向上看舊訊息)時,新訊息進來仍會把超量的舊行從「頂端」裁掉
   *   (logCombat / logSys 內 while removeChild firstChild)。頂端一被移除,整個內容往上
   *   位移 → 即使沒自動捲到底,畫面仍一直飄,鎖定形同無效。
   * 解法:包住 logCombat / logSys,鎖定時錨定「視窗頂端那則訊息」,原函式跑完後依錨點的位移
   *   把 scrollTop 補回去,讓使用者正在看的那段完全不動。未鎖定時走原行為(自動捲到底)。
   * 何時可移除:原作者改成「鎖定時不裁頂端」或自行做了捲動錨定時,本段可整段刪。
   * ------------------------------------------------------------------------ */
  (function () {
    // 「使用者已往上捲離底部」= 遊戲的鎖定條件(同 _combatLogIsAtBottom 的反向)。直接看 DOM,
    //  不依賴 index.html 的內部變數(跨腳本讀 let 不可靠),自成一格、最穩。
    function scrolledUp(el) { return (el.scrollHeight - el.scrollTop - el.clientHeight) >= 24; }
    function patch(fnName, elId) {
      var orig = window[fnName];
      if (typeof orig !== 'function' || orig.__lockAnchor) return false;
      var wrapped = function () {
        var el = document.getElementById(elId);
        if (!el || !scrolledUp(el)) return orig.apply(this, arguments);   // 在底部(未鎖定):原行為(自動捲到底)
        // 已往上看舊訊息:錨定視窗頂端那則訊息。原函式用 innerHTML+= 會「重建全部子節點」,故不能持有
        //   元素參照(會變 stale),改記「索引 + 與視窗頂的像素差」,事後依被裁掉的數量重算索引、補回 scrollTop。
        var st = el.scrollTop, kids = el.children, n = kids.length, anchorIndex = -1, delta = 0;
        for (var i = 0; i < n; i++) {
          if (kids[i].offsetTop + kids[i].offsetHeight > st) { anchorIndex = i; delta = st - kids[i].offsetTop; break; }
        }
        var r = orig.apply(this, arguments);
        try {
          if (anchorIndex >= 0) {
            var after = el.children, trimmed = (n + 1) - after.length;   // logCombat/logSys 每次固定新增 1 則
            var ni = anchorIndex - trimmed;
            if (ni >= 0 && ni < after.length) el.scrollTop = after[ni].offsetTop + delta;
          }
        } catch (e) {}
        return r;
      };
      wrapped.__lockAnchor = true;
      window[fnName] = wrapped;
      return true;
    }
    function install() {
      var a = patch('logCombat', 'combat-log');
      var b = patch('logSys', 'sys-log');
      if (a || b) console.log('[AFK-fixes] 日誌鎖定捲動防飄移 已掛上');
      return typeof window.logCombat === 'function' && window.logCombat.__lockAnchor;
    }
    try {
      if (!install()) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
        else setTimeout(install, 0);
      }
    } catch (e) { console.warn('[AFK-fixes] 日誌鎖定捲動防飄移 安裝失敗,已略過:', e); }
  })();

  /* --------------------------------------------------------------------------
   * 修正#3:關閉 / 切走頁面前自動存一次檔(桌機 / 手機皆然)
   *
   * 問題:原版只每 5 分鐘自動存檔一次 + 少數事件存檔,且沒有任何 beforeunload/pagehide
   *   存檔。直接關分頁時進度只停在上一次自動存檔,最多會丟近 5 分鐘的進度。
   *   (afk-offline 雖在關閉時掛了監聽,但只 stamp 離線錨點、不存角色進度。)
   * 解法:在 pagehide / beforeunload / visibilitychange(切到背景)補呼叫一次 saveGame。
   *   afk-fixes 在 afk-offline 之後載入,此時 window.saveGame 已被 afk-offline 包過 → 這一存
   *   同時也蓋上離線時間戳,一舉兩得。
   *   特別補 visibilitychange→hidden:手機被系統殺背景時 pagehide/beforeunload 常不觸發,切到
   *   背景(切 App / 鎖屏 / 切分頁)的 hidden 才是手機最可靠的存檔時機。代價是每次切背景都會存
   *   一次,但 saveGame 本來就頻繁呼叫(每 5 分鐘 + 多種事件),多這一次無妨。
   * 守門:必須跟 stamp() 一樣只在「真的在遊戲畫面」時存——原版 saveGame 會讀 set-pot 等只存在
   *   於遊戲畫面的 DOM、也吃 player,在開始選單 / 創角時呼叫會直接拋錯或寫壞 slot。
   * 何時可移除:原作者自行加了關閉前存檔(beforeunload/pagehide/visibilitychange 存檔)時,
   *   本段即成多餘,可整段刪掉。在那之前留著無害(抓不到 saveGame / 不在遊戲畫面自動 no-op)。
   * ------------------------------------------------------------------------ */
  (function () {
    function inGame() {
      var gs = document.getElementById('game-screen');
      return !!(gs && !gs.classList.contains('hidden'));
    }
    function saveOnExit() {
      if (window.__afkLoggingOut) return;   // 手機登出流程已自己存過(且排了 stamp);這裡再存會讓手機 toast 跳兩次
      try { if (inGame() && typeof window.saveGame === 'function') window.saveGame(); } catch (e) {}
    }
    window.addEventListener('pagehide', saveOnExit);
    window.addEventListener('beforeunload', saveOnExit);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') saveOnExit();
    });
    console.log('[AFK-fixes] 關閉前自動存檔 已掛上');
  })();

  // 修正#4(favicon 注入)已移除:原作者 V2.32 起已在 index.html <head> 自宣告 favicon(assets/favicon.png,1.63 天堂圖),本段多餘。

  /* --------------------------------------------------------------------------
   * 修正#5:saveGame 空白角色防呆 — 攔下「未載入角色就存檔」避免覆蓋真實存檔
   *
   * 問題:原作 saveGame 只防 player.dead,沒防「未載入角色」。主選單時 player 是空白預設
   *   (cls:null, lv:1),此時若有任何程式(早年的存檔轉移外掛踩過、或未來新外掛手滑)呼叫
   *   saveGame,會把空白 player 寫進 lineage_idle_save_<currentSlot>(currentSlot 預設 1)→
   *   覆蓋第 1 格真實存檔成 Lv.1 null,且原作此路徑不留備份 → 永久損失。
   * 解法:在最外層包住 saveGame,偵測「player 空白(cls 為 null)」就攔下不存(console.warn 留痕)。
   *   cls 在創角 startGame() 一開始(player.cls = curCreate.cls)就設好、之後才有任何遊戲內存檔,
   *   故此防呆只擋「主選單空白」這唯一壞狀態,不會誤擋任何一次合法存檔。判斷本身若出錯則放行走
   *   原存檔(fail-open,不新增風險)。afk-fixes 在 afk-offline 之後載入 → 此包裝是最外層,
   *   空白時連離線錨點 stamp 都不會跑。
   * 何時可移除:原作者自己在 saveGame 開頭加了「未載入角色(!player.cls)就 return」防呆時,
   *   本段即多餘,可整段刪掉。
   * ------------------------------------------------------------------------ */
  (function () {
    try {
      if (typeof window.saveGame !== 'function' || window.saveGame.__blankGuard) return;
      var orig = window.saveGame;
      var guarded = function () {
        try {
          if (typeof player === 'undefined' || !player || !player.cls) {   // 空白/未載入角色:擋
            console.warn('[AFK-fixes] saveGame 在未載入角色狀態被呼叫,已攔截(避免空白存檔覆蓋真實存檔)。');
            return;
          }
        } catch (e) { /* 判斷本身出錯 → 不擋,走原存檔(維持原行為) */ }
        return orig.apply(this, arguments);
      };
      guarded.__blankGuard = true;
      window.saveGame = guarded;
      console.log('[AFK-fixes] saveGame 空白角色防呆 已掛上');
    } catch (e) { console.warn('[AFK-fixes] saveGame 空白角色防呆 安裝失敗,已略過:', e); }
  })();

  /* --------------------------------------------------------------------------
   * 修正#6:存檔匯出在 Android 行動模式下載 0 byte — 改用 Web Share API
   *
   * 問題:原作 downloadSaveFile 用 blob: + <a download> 觸發下載。Android Chrome 行動模式
   *   的下載管理員是非同步的,blob URL 常在下載管理員讀取前被 revoke,導致下載 0 byte。
   *   切到「桌面版網站」模式就正常:該模式下 window.showSaveFilePicker 可用,exportSave 走
   *   File System API 路徑,根本不進 downloadSaveFile。
   * 解法:只在 Android 行動模式(UA 含 Android)包住 downloadSaveFile,改用 Web Share API
   *   (navigator.share with files)。Share API 不走下載管理員,直接交給 Android 系統的
   *   分享 / 存檔對話框,Android Chrome 75+ 皆支援。
   *   切桌面版時 UA 不含 Android → 自動走原版(且 showSaveFilePicker 也先攔住,不到這裡);
   *   iOS / 桌機走原版不動。
   * 何時可移除:原作者把 downloadSaveFile 改成 Android 可靠的下載方式時,本段即多餘,
   *   可整段刪掉(抓不到 downloadSaveFile 自動 no-op)。
   * ------------------------------------------------------------------------ */
  (function () {
    var isAndroidMobile = /Android/i.test(navigator.userAgent || '');

    function install() {
      if (!isAndroidMobile) return true;
      if (typeof window.downloadSaveFile !== 'function' || window.downloadSaveFile.__androidShareDl) return false;
      var orig = window.downloadSaveFile;
      var patched = function (data, fname) {
        try {
          var file = new File([data], fname, { type: 'application/json' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: fname })
              .then(function () {
                try {
                  if (typeof window.logSys === 'function')
                    window.logSys('<span class="text-indigo-300 font-bold">✔ 存檔已匯出：' + fname + '</span>');
                } catch (e) {}
              })
              .catch(function (err) {
                if (err && err.name === 'AbortError') return;   // 使用者取消分享
                try { orig(data, fname); } catch (e) {}         // share 失敗才退回原版
              });
            return;
          }
        } catch (e) {}
        return orig.apply(this, arguments);   // canShare 不支援(舊版 Android)→ 退回原版
      };
      patched.__androidShareDl = true;
      window.downloadSaveFile = patched;
      console.log('[AFK-fixes] 匯出下載 Android 改用 Web Share API(修手機 0 byte) 已掛上;非 Android 走原版');
      return true;
    }

    try {
      if (!install()) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
        else setTimeout(install, 0);
      }
    } catch (e) { console.warn('[AFK-fixes] Android 匯出 Web Share 安裝失敗,已略過:', e); }
  })();

  /* --------------------------------------------------------------------------
   * 修正#7:適用職業 logo 點擊浮現職業名 tip(桌機 / 手機皆然)
   *
   * 問題:物品顯示的「適用職業」是一排職業 logo 圖示(原作者 buildItemDescHTML 產生,帶 title/alt
   *   ＝職業中文名)。桌機滑鼠 hover 看得到 title,但<b>手機沒有 hover</b> → 點了沒反應,玩家
   *   不知道那個圖是哪個職業。小百科「裝備」分頁重用同一段顯示,同樣問題。
   * 解法:全域(capture)監聽點擊 `img.class-eq-icon`,讀它的 title/alt,浮現一個小 tip 顯示
   *   「可裝備：<職業>」,1.6 秒後淡出。因為遊戲內物品卡與小百科裝備頁用的是<b>同一個
   *   class-eq-icon</b>,一個全域 handler 兩邊一起補,且不動原作者碼。
   * 何時可移除:原作者自己讓職業 logo 點擊/長按顯示職業名時,本段即多餘,可整段刪。
   * ------------------------------------------------------------------------ */
  (function () {
    var tip = null, hideT = null;
    function ensureTip() {
      if (tip) return tip;
      tip = document.createElement('div');
      tip.id = 'afk-eqicon-tip';
      tip.setAttribute('style', 'position:fixed;z-index:100000;pointer-events:none;background:#0f172a;border:1px solid #475569;color:#e2e8f0;font-size:13px;font-weight:bold;padding:4px 10px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.5);opacity:0;transition:opacity .12s;white-space:nowrap;');
      document.body.appendChild(tip);
      return tip;
    }
    function showTip(icon, name) {
      var t = ensureTip();
      t.textContent = '可裝備：' + name;
      t.style.opacity = '1';   // 先顯示才量得到尺寸
      var r = icon.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
      var left = Math.min(window.innerWidth - tw - 6, Math.max(6, r.left + r.width / 2 - tw / 2));
      var top = r.top - th - 6; if (top < 6) top = r.bottom + 6;
      t.style.left = left + 'px'; t.style.top = top + 'px';
      if (hideT) clearTimeout(hideT);
      hideT = setTimeout(function () { if (tip) tip.style.opacity = '0'; }, 1600);
    }
    document.addEventListener('click', function (e) {
      var ic = (e.target && e.target.closest) ? e.target.closest('img.class-eq-icon') : null;
      if (!ic) return;
      var name = ic.getAttribute('title') || ic.getAttribute('alt');
      if (name) { e.preventDefault(); showTip(ic, name); }
    }, true);
    console.log('[AFK-fixes] 適用職業 logo 點擊 tip 已掛上');
  })();

  // 🐉 修正#: 邊緣格的頭目(boss-zoom)被畫面裁切。作者讓頭目圖 scale 1.78× 由「bottom center」放大,
  //   落在最左/最右那格時放大後會脹出戰鬥框(overflow:hidden)被裁掉(任何地圖都會,木人場放多隻時最明顯)。
  //   通用修正:最左那隻改由「bottom left」放大(只往右脹)、最右那隻由「bottom right」放大(只往左脹)→ 不超出畫面、不被裁;中間維持中心。
  //   作者若日後改成不裁(或頭目不再落邊格),這段選擇器不命中即回原樣,留著無害。
  (function () {
    try {
      var st = document.createElement('style');
      st.id = 'afk-fix-bosszoom-edge';
      st.textContent =
        '#battle-view.area-fit .boss-zoom:first-child .mob-img-inner{transform-origin:bottom left !important;}\n' +
        '#battle-view.area-fit .boss-zoom:last-child .mob-img-inner{transform-origin:bottom right !important;}';
      (document.head || document.documentElement).appendChild(st);
      console.log('[AFK-fixes] 邊緣頭目放大裁切修正已套用');
    } catch (e) {}
  })();

  console.log('[AFK-fixes] hooks OK — 通用修正外掛已啟用。');
})();
