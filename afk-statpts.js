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
    // 🆕 上游新版「能力」面板＝一張背景圖(.ability-window-shell·position:relative·overflow:hidden)上
    //   把六屬性值絕對定位(.ability-primary-*)。舊版「每格底下插一行」在這種版面會亂 → 改成把六屬性的
    //   點數來源合成「一個區塊」放在能力圖「下方」(shell 的下一個兄弟),不碰圖內排版。
    var block = document.getElementById('afk-stpts-block');
    if (sig === lastSig && block && block.isConnected) return;
    lastSig = sig;

    var shell = document.querySelector('.ability-window-shell');
    if (!shell || !shell.parentElement) return;
    if (!block || !block.isConnected) {
      block = document.createElement('div');
      block.id = 'afk-stpts-block';
      block.className = 'afk-stpts';
      shell.parentElement.insertBefore(block, shell.nextSibling);
    }
    var LBL = { str: '力量', dex: '敏捷', con: '體質', int: '智力', wis: '精神', cha: '魅力' };
    var html = '<div class="afk-stpts-hd">點數來源（始出生／升升級／藥萬能藥／總＝不含裝備 buff）</div>';
    STATS.forEach(function (s) {
      var bi = n(player.base, s), al = n(player.alloc, s), pa = n(player.panacea, s);
      html += '<div class="afk-stpts-row"><b>' + LBL[s] + '</b><span>始 ' + bi + '</span><span>升 ' + al + '</span><span>藥 ' + pa + '</span><span class="afk-stpts-tot">總 ' + (bi + al + pa) + '</span></div>';
    });
    if (block._h !== html) { block.innerHTML = html; block._h = html; }
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
    '.afk-stpts{margin:8px auto 0;max-width:400px;padding:8px 10px;background:rgba(15,23,42,.55);border:1px solid #334155;border-radius:8px;font-size:12px;color:#cbd5e1;line-height:1.4;}' +
    '.afk-stpts-hd{font-size:11px;color:#94a3b8;margin-bottom:5px;}' +
    '.afk-stpts-row{display:flex;flex-wrap:wrap;gap:2px 12px;align-items:baseline;padding:3px 0;border-top:1px solid rgba(51,65,85,.5);}' +
    '.afk-stpts-row:first-of-type{border-top:none;}' +
    '.afk-stpts-row b{min-width:2.6em;color:#e2e8f0;font-weight:700;}' +
    '.afk-stpts-tot{color:#fbbf24;font-weight:700;margin-left:auto;}';
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
