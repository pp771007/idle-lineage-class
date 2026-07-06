/*
 * afk-autobuy.js — 外掛自動購買:在「自動買銀箭」下方加一個「外掛」框,提供
 *   ① 肉耗盡時自動購買        (寵物項圈每 2 秒消耗 = 總項圈數 的肉,沒肉夥伴就停手)
 *   ② 自動購買魔法卷軸(魔法屏障) (原版只有自動「施放」、沒有自動「補貨」,卷軸用完屏障就斷)
 *
 * 設計:完全不改原作者程式碼。
 *   - UI:把一個自製框注入到原設定面板「自動買銀箭」那張卡片下方(找 #set-auto-buy-arrow 定位)。
 *   - 邏輯:包住全域 tick(),每隔幾 tick 檢查庫存,低於門檻就照原版商店價買一批補滿。
 *           「補庫存」而非攔截消耗點 → 遊戲原本的消耗邏輯(寵物吃肉/屏障施放)一直有貨可用。
 *   - 離線:afk-offline 的離線結算是「迴圈呼叫真正的 tick()」,故本檔掛在 tick 上 →
 *           正常與離線共用同一套邏輯,自動一致,不必為離線另寫。離線(state.ff)時不寫日誌避免洗頻。
 *   - 設定持久化:原版存檔只記內建的 set-* 勾選;本檔兩個勾選「依存檔位(currentSlot)分開」存
 *     localStorage(afk_autobuy_<key>_<slot>),每個角色各自獨立。localStorage 是唯一真實來源、
 *     購買判斷直接讀它(不靠勾選框 DOM,避免離線結算在 loadGame 內就開跑 tick 時勾選框尚未同步的時序問題);
 *     勾選框只是 UI 鏡射:change 時寫回該 slot、進遊戲(loadGame/startGame)時依該 slot 還原。
 *
 * 優雅降級:缺核心全域(tick/player/shopPrice/gainItem)或找不到注入點 → console.warn 後安靜停用,不影響遊戲。
 * 純包 tick + 自注 DOM,無「必須命中的原作者 DOM 掛點」(設定面板找不到只是不注入 UI),故不列入 smoke-hooks。
 */
(function () {
  'use strict';

  var MEAT_ID   = 'new_item_143';        // 肉:商店一份 1000 個,單價 shopPrice(100)
  var MEAT_MIN  = 2000;                   // 低於這個量就補(緩衝要高於寵物單輪總消耗)
  var MEAT_BUNDLES = 3;                   // 每次補 3 份 = 3000 個
  var MEAT_BUNDLE_UNIT = 100;            // 一份 1000 個的金幣單價(對齊原版 buyItem)
  var MEAT_BUNDLE_AMT  = 1000;

  var SCROLL_ID = 'scroll_magicbarrier';  // 魔法卷軸(魔法屏障):商店單買,單價 = DB.items 的 p(1500)
  var SCROLL_MIN = 3;                      // 低於這個量就補
  var SCROLL_REFILL = 5;                   // 每次補到手 5 張

  var CHECK_EVERY = 10;                    // 每 10 tick(約 1 秒)檢查一次,夠用又省

  var LS_PREFIX = 'afk_autobuy_';          // 實際鍵為 afk_autobuy_<base>_<slot>(per 存檔位)

  // ----- 自我檢查:核心全域都在才啟用 -------------------------------------
  if (typeof window.tick !== 'function' ||
      typeof window.shopPrice !== 'function' ||
      typeof window.gainItem !== 'function') {
    console.warn('[AFK-autobuy] 缺少核心全域(tick/shopPrice/gainItem),外掛自動購買停用。');
    return;
  }

  // 依存檔位分開的設定鍵 / 讀寫(有選到存檔位即有效,不綁格數;currentSlot 由原作設成真實格號)
  function validSlot() { var n = +currentSlot; return Number.isInteger(n) && n >= 1; }
  function prefKey(base) { return LS_PREFIX + base + '_' + currentSlot; }
  // 🚀 偏好快取:prefOn 每次查 localStorage(同步 IO)很貴,tick 迴圈裡定期打。本外掛是唯一寫入者
  //   (prefSet 同步更新快取),快取鍵含存檔位,切角色自然分開。多分頁同開同角極端情境下另一頁改設定
  //   本頁要重整才吃到——可接受(原本 UI 勾選狀態也不跨頁同步)。
  var _prefCache = {};
  function prefOn(base) {
    if (!validSlot()) return false;
    var k = base + '_' + currentSlot;
    if (k in _prefCache) return _prefCache[k];
    var v; try { v = localStorage.getItem(prefKey(base)) === '1'; } catch (e) { v = false; }
    _prefCache[k] = v;
    return v;
  }
  function prefSet(base, on) { try { if (validSlot()) { localStorage.setItem(prefKey(base), on ? '1' : '0'); _prefCache[base + '_' + currentSlot] = !!on; } } catch (e) {} }

  function invCount(id) {
    var c = 0, inv = (typeof player !== 'undefined' && player && player.inv) ? player.inv : [];
    for (var i = 0; i < inv.length; i++) if (inv[i] && inv[i].id === id) c += (inv[i].cnt || 1);
    return c;
  }

  // 安靜時(離線結算 state.ff)不寫日誌,避免補跑數千 tick 洗頻
  function buyLog(msg) {
    try { if (typeof state !== 'undefined' && state && state.ff) return; if (typeof logSys === 'function') logSys(msg); } catch (e) {}
  }

  function autoBuyCheck() {
    if (typeof player === 'undefined' || !player) return;

    if (prefOn('meat') && invCount(MEAT_ID) < MEAT_MIN) {
      var mCost = shopPrice(MEAT_BUNDLE_UNIT) * MEAT_BUNDLES;
      if (player.gold >= mCost) {
        player.gold -= mCost;
        gainItem(MEAT_ID, MEAT_BUNDLE_AMT * MEAT_BUNDLES, true, true);
        buyLog('自動花費 ' + mCost + ' 金幣補充了 ' + (MEAT_BUNDLE_AMT * MEAT_BUNDLES) + ' 個肉。');
      }
    }

    if (prefOn('magicbarrier') && invCount(SCROLL_ID) < SCROLL_MIN) {
      var def = (typeof DB !== 'undefined' && DB.items) ? DB.items[SCROLL_ID] : null;
      if (def) {
        var sCost = shopPrice(def.p) * SCROLL_REFILL;
        if (player.gold >= sCost) {
          player.gold -= sCost;
          gainItem(SCROLL_ID, SCROLL_REFILL, true, true);
          buyLog('自動花費 ' + sCost + ' 金幣補充了 ' + SCROLL_REFILL + ' 張魔法卷軸(魔法屏障)。');
        }
      }
    }
  }

  // ----- 包住 tick:正常與離線(離線=迴圈呼叫 tick)共用 --------------------
  // 🚀 快轉(state.ff)時降頻 ×10(每 100 拍=遊戲 10 秒檢查一次):肉/卷軸消耗速度慢,10 秒內見底
  //   再補完全來得及;invCount 每次全背包掃兩趟,離線補跑 86 萬拍時降頻省下 90% 的掃描。
  var _tick = window.tick;
  window.tick = function () {
    var r = _tick.apply(this, arguments);
    try {
      var every = (state.ff ? CHECK_EVERY * 10 : CHECK_EVERY);
      if (typeof state !== 'undefined' && state && (state.ticks % every === 0)) autoBuyCheck();
    } catch (e) {}
    return r;
  };
  // ⚡ 供 afk-offline 的「混合快速結算」在不跑 tick 的快速段呼叫(肉/魔法卷軸見底時補貨,行為與線上一致)
  window.__afkAutobuyCheck = autoBuyCheck;

  // ----- 注入「外掛」框到設定面板「自動買銀箭」卡片下方 -------------------
  function injectUI() {
    if (document.getElementById('afk-autobuy-box')) return true;
    var anchor = document.getElementById('set-auto-buy-arrow');
    if (!anchor) return false;
    var card = anchor.closest('.bg-slate-800');
    if (!card || !card.parentNode) return false;

    var box = document.createElement('div');
    box.id = 'afk-autobuy-box';
    box.className = 'bg-slate-800 p-3 rounded-lg border border-amber-600';
    box.innerHTML =
      '<div class="text-sm text-amber-400 mb-2 border-b border-slate-700 pb-1 font-bold">🔌 外掛</div>' +
      '<div class="flex flex-col gap-2 text-sm">' +
        '<label class="cursor-pointer flex items-center gap-2"><input type="checkbox" id="set-auto-buy-meat" class="w-4 h-4"><span class="text-rose-300">自動購買肉（' + (MEAT_BUNDLE_AMT * MEAT_BUNDLES) + '）</span></label>' +
        '<label class="cursor-pointer flex items-center gap-2"><input type="checkbox" id="set-auto-buy-magicbarrier" class="w-4 h-4"><span class="text-cyan-300">自動購買魔法卷軸(魔法屏障)（' + SCROLL_REFILL + '）</span></label>' +
      '</div>';
    card.parentNode.insertBefore(box, card.nextSibling);

    bindChange('set-auto-buy-meat', 'meat');
    bindChange('set-auto-buy-magicbarrier', 'magicbarrier');
    restoreForSlot();   // 注入當下若已在遊戲中(熱重載/外掛後載)也立即還原該角色設定
    return true;
  }

  // 勾選框改動 → 寫回「目前存檔位」的設定(localStorage 是真實來源)
  function bindChange(id, base) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', function () { prefSet(base, el.checked); });
  }

  // 進到某角色時,把勾選框 UI 同步成該存檔位存的設定
  function restoreForSlot() {
    var m = document.getElementById('set-auto-buy-meat');
    var s = document.getElementById('set-auto-buy-magicbarrier');
    if (m) m.checked = prefOn('meat');
    if (s) s.checked = prefOn('magicbarrier');
  }

  // 載入存檔 / 新建角色後,currentSlot 已確定 → 還原該角色的勾選 UI
  ['loadGame', 'startGame'].forEach(function (fn) {
    if (typeof window[fn] === 'function') {
      var orig = window[fn];
      window[fn] = function () {
        var r = orig.apply(this, arguments);
        try { restoreForSlot(); } catch (e) {}
        return r;
      };
    }
  });

  function init() {
    if (!injectUI()) console.warn('[AFK-autobuy] 找不到設定面板的「自動買銀箭」(#set-auto-buy-arrow),UI 未注入(自動購買邏輯仍會運作)。');
    console.log('[AFK-autobuy] hooks OK — 外掛自動購買(肉 / 魔法卷軸)已啟用(設定依存檔位分開)。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
