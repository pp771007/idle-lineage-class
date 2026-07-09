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
        // 快轉(離線/背景補跑)時原函式第一行就 return、不會動 DOM,錨定完全多餘——
        // 而 scrolledUp 讀 scrollHeight 會強制排版,補跑每則訊息都白付一次,直接走原函式。
        if (typeof state !== 'undefined' && state && state.ff) return orig.apply(this, arguments);
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
   * 修正#8:快轉(離線 / 背景補跑)時靜音音效 + 不跳戰鬥特效(省效能、不洗畫面 / 耳朵)
   *
   * 問題:作者 .49 起的音效(js/17-audio.js)與戰鬥特效(js/09-vfx-render.js)從戰鬥 / 擊殺碼
   *   「無條件」呼叫,只看自己的開關,都沒檢查 state.ff(快轉旗標)。快轉(離線結算 24h≈86 萬拍、
   *   背景分頁批次補跑)會逐拍播擊殺 / 受擊 / 升級音、跳金色稀有掉落等特效:洗畫面 / 耳朵又白吃效能。
   * 解法:不列舉個別函式(作者每新增一個音效 / 特效就要補名單),改抓「作者所有相關函式都會先檢查的
   *   總開關」這一層,把它改成「計算屬性」,快轉(state.ff)時自動視為關閉——現有與未來的音效 / 特效
   *   全部一併納管、零維護:
   *     - 音效總開關 _sfxCfg.on:每支發聲函式(playSfx / playMobHurt / playMobKill / playSpellCast)
   *       開頭都 `if (!_sfxCfg.on) return;` → 改成 getter =「玩家原設定 && 非快轉」,ff 時第一行就 return
   *       (連音檔懶載 / 查表都不做、零副作用)。
   *     - 特效總開關 window.__vfxOff:每支 vfx 函式開頭都 `if (window.__vfxOff) return;` → 改成 getter =
   *       「玩家原設定 || 快轉中」。
   *   兩者 setter 都把值存進私有變數,玩家在設定 / 標題畫面的開關照常運作。完全不碰遊戲數值 / 掉落結算
   *   (音效 / 特效與收益無關,一字不差)。
   * 何時可移除:原作者自己在音效 / 特效函式開頭加了 state.ff 判斷時,本段即多餘,可整段刪掉
   *   (抓不到 _sfxCfg / __vfxOff 會自動略過,不弄壞遊戲)。
   * ------------------------------------------------------------------------ */
  (function () {
    function ffOn() { try { return typeof state !== 'undefined' && state && !!state.ff; } catch (e) { return false; } }

    // 音效總開關:_sfxCfg.on 改成 getter =「玩家原設定 && 非快轉」。
    //   ⚠ 必須 enumerable:true——_sfxSaveCfg 用 JSON.stringify(_sfxCfg) 存檔,非列舉屬性會被漏掉而存不回 on。
    //   ⚠ 用私有 _realSfxOn 保存玩家真值;作者的 _sfxLoadCfg / setSfxOn 寫 _sfxCfg.on 會走 setter 自動同步。
    try {
      var sc = window._sfxCfg;
      if (sc) {
        var d1 = Object.getOwnPropertyDescriptor(sc, 'on');
        if (!d1 || !d1.get) {   // 尚未被本段接管(避免重複安裝)
          var _realSfxOn = d1 ? (d1.value !== false) : true;
          Object.defineProperty(sc, 'on', {
            enumerable: true, configurable: true,
            get: function () { return _realSfxOn && !ffOn(); },
            set: function (v) { _realSfxOn = !!v; }
          });
        }
      }
    } catch (e) {}

    // 特效總開關:window.__vfxOff 改成 getter =「玩家原設定 || 快轉中」。玩家標題畫面的開關寫入走 setter。
    try {
      var d2 = Object.getOwnPropertyDescriptor(window, '__vfxOff');
      if (!d2 || !d2.get) {
        var _realVfxOff = !!window.__vfxOff;
        Object.defineProperty(window, '__vfxOff', {
          configurable: true,
          get: function () { return _realVfxOff || ffOn(); },
          set: function (v) { _realVfxOff = !!v; }
        });
      }
    } catch (e) {}

    console.log('[AFK-fixes] 快轉補跑靜音 / 不跳特效 已掛上(音效 / 特效總開關 ff-aware)');
  })();

  console.log('[AFK-fixes] hooks OK — 通用修正外掛已啟用。');
})();
