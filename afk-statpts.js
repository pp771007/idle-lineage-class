/*
 * afk-statpts.js — 能力值面板:在每個能力值底下補一行「點數來源分解」（始/升/藥/總，不含裝備）。
 *
 * 始 = 出生點數 = player.base[s]（職業起始能力 ＋ 創角時分配的點，遊戲創角時就加進 base）
 * 升 = 升級點數 = player.alloc[s]（升級後分配的配點）
 * 藥 = 萬能藥點數 = player.panacea[s]
 * 總 = 始＋升＋藥 = naturalStat（不含裝備、不含 buff；面板右側那個大數字是含裝備的，會比「總」大）
 *
 * 註:用過「回憶蠟燭」重置後,創角分配的點會被併進 alloc(升),此時「始」只剩純職業基礎、
 *    「升」會含創角點;沒重置過的角色則 始/升 完全準確。總一定正確。
 *
 * 作法:monkey-patch 全域 updateUI——原函式跑完後,在六大屬性 grid 內、每個屬性「值欄」之後插一條
 *      橫跨整列(grid-column:1/-1)的分解行。
 *      原作把屬性值從「整格 div」改成「夾在 +/- 加點按鈕之間的窄 span(w-8)」後,不能再 append 進值元素
 *      (會被擠爆);改為插在值欄之後、獨立成一橫列,對「無加點」與「升級加點(+/- 顯示)」兩種狀態都不影響版面。
 *      分解行不再前綴屬性名——它就在該屬性(原作已標「力量 (STR)」)正下方,再標一次會變兩個名字、反而醜。
 *      優雅降級:找不到 updateUI / player.base / 屬性元素就安靜停用。
 */
(function () {
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('statpts')) return;   // 🎚️ 外掛開關:關掉就透明放行原版行為
  var STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  function n(o, s) { return (o && o[s]) || 0; }

  // updateUI 在戰鬥中每秒被呼叫上百次,而「始/升/藥」只在升級配點/用萬能藥/回憶蠟燭重置時才變、
  // 戰鬥中恆定。故用「數值簽章」短路:沒變就零 DOM 直接返回(絕大多數呼叫走這條);真的變了才就地
  // 改那行文字。分解行插入後常駐(tab-stats 是靜態 DOM,updateUI 只改 innerText、renderTabs 不重建它),
  // 所以快取行元素重用、不再每次 remove+createElement(免節點 churn 與 GC)。
  var lines = {};       // s -> 已插入的分解行元素(快取重用)
  var lastSig = null;   // 上次「始/升/藥」簽章

  function buildBreakdown() {
    if (typeof player === 'undefined' || !player || !player.base) return;
    var sig = '';
    for (var i = 0; i < STATS.length; i++) {
      var s0 = STATS[i];
      sig += n(player.base, s0) + ',' + n(player.alloc, s0) + ',' + n(player.panacea, s0) + ';';
    }
    // 數值沒變、且分解行還在 DOM 上 → 不動任何 DOM(isConnected 是純屬性讀取,不觸發 layout)
    if (sig === lastSig && lines.str && lines.str.isConnected) return;
    lastSig = sig;

    STATS.forEach(function (s) {
      var valEl = document.getElementById('dt-' + s);   // 原作:夾在 +/- 之間的屬性值 <span>
      if (!valEl) return;
      var cell = valEl.parentElement;                   // 值欄(grid 直接子元素;flex 容器含 - 值 +)
      if (!cell || !cell.parentElement) return;
      var bi = n(player.base, s), al = n(player.alloc, s), pa = n(player.panacea, s);
      var txt = '始' + bi + '／升' + al + '／藥' + pa + '／總' + (bi + al + pa);   // 總=不含裝備/buff

      var line = lines[s];
      if (!line || !line.isConnected) {                 // 尚未插入 / 被外力移除 → 接既有的或新建,插在值欄之後
        var nx = cell.nextElementSibling;
        line = (nx && nx.classList && nx.classList.contains('afk-stpts')) ? nx : null;
        if (!line) { line = document.createElement('div'); line.className = 'afk-stpts'; cell.after(line); }   // 靠 CSS grid-column:1/-1 撐成整列
        lines[s] = line;
      }
      if (line.textContent !== txt) line.textContent = txt;
    });
  }

  function hook() {
    if (typeof window.updateUI !== 'function') return false;
    if (window.updateUI.__afkStpts) return true;
    var orig = window.updateUI;
    window.updateUI = function () {
      var r = orig.apply(this, arguments);
      try { buildBreakdown(); } catch (e) {}
      return r;
    };
    window.updateUI.__afkStpts = true;
    return true;
  }

  var st = document.createElement('style');
  st.textContent =
    '.afk-stpts{grid-column:1 / -1;font-size:12px;font-weight:400;line-height:1.3;' +
    'color:#94a3b8;letter-spacing:0;margin:-4px 0 2px;white-space:nowrap;text-align:left;}';
  (document.head || document.documentElement).appendChild(st);

  // updateUI 可能還沒定義(遊戲腳本載入順序) → 輪詢幾次掛上
  var tries = 0;
  (function tryHook() {
    if (hook()) {
      buildBreakdown();
      console.log('[AFK-statpts] hooks OK — 能力值分解（始/升/藥/總，不含裝備）已掛上。');
      return;
    }
    if (++tries < 40) setTimeout(tryHook, 250);
    else console.warn('[AFK-statpts] 找不到 updateUI,能力值分解停用。');
  })();
})();
