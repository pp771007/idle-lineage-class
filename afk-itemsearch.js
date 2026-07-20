/* ============================================================================
 * afk-itemsearch.js — 背包(武器/防具/道具分頁)的「名稱搜尋」
 *
 * 作法:搜尋框放在 #tab-content-panel 層(分頁 div 的「外面」)——核心 renderTabs 只重建各分頁
 *   div 的內容、不動 panel 本身 → 搜尋框永遠是同一顆節點,打字(含中文組字)不會被戰鬥掉寶/裝備
 *   刷新的重繪打斷。三個分頁共用同一個關鍵字;只在 武器/防具/道具 分頁顯示。
 * 過濾:比對列的 textContent(含名稱/詞綴/強化值,子字串命中即顯示),純顯示層、不動遊戲資料。
 *   ⚠ 隱藏一律 style.setProperty('display','none','important')——條列式外掛(afk-invlist)給每列
 *   display:flex !important,一般 inline display:none 會被壓過(=搜尋看起來沒作用,踩過)。
 * 列的位置:上游 1.8 皮膚把列放在 .classic-inventory-viewport 內層,先找它、沒有才退回分頁 div。
 * 優雅降級:renderTabs 不存在就安靜停用。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('itemsearch')) return;   // 🎚️ 外掛開關:關掉就透明放行原版行為

  var q = '';   // 三分頁共用的查詢字串(單一事實來源;框是常駐節點,值也一直在)
  var TAB_IDS = ['tab-weapons', 'tab-armors', 'tab-items'];

  function injectCss() {
    if (document.getElementById('afk-isearch-css')) return;
    var st = document.createElement('style');
    st.id = 'afk-isearch-css';
    st.textContent = [
      '#afk-isearch{flex:none;padding:6px 10px 4px;background:#1e293b;display:none;}',
      '#afk-isearch.is-on{display:block;}',
      '#afk-isearch input{width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #475569;border-radius:8px;color:#e2e8f0;padding:6px 10px;font-size:16px;font-family:inherit;outline:none;}',   /* 📱 字級一定要 ≥16px:iOS Safari 對更小的輸入框會在聚焦時自動放大整頁、且不會自己縮回來(玩家回報「搜尋會自動放大」) */
      '#afk-isearch input:focus{border-color:#b89243;}',
      '#afk-isearch input::placeholder{color:#64748b;}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function norm(s) { return (s || '').toLowerCase(); }

  // 過濾「實際裝物品列的容器」的直接子元素:textContent 含關鍵字才顯示。
  function filterTab(tabId) {
    var tabDiv = document.getElementById(tabId);
    if (!tabDiv) return;
    var container = tabDiv.querySelector('.classic-inventory-viewport') || tabDiv;
    var kw = norm(q.trim());
    for (var i = 0; i < container.children.length; i++) {
      var el = container.children[i];
      if (el.id === 'afk-isearch') continue;
      if (el.classList.contains('classic-list-toolbar')) continue;   // 快速操作頭部不過濾
      if (!kw || norm(el.textContent).indexOf(kw) >= 0) el.style.removeProperty('display');
      else el.style.setProperty('display', 'none', 'important');     // !important:蓋過條列式的 display:flex !important
    }
  }
  function filterAll() { TAB_IDS.forEach(filterTab); }

  // 只在 武器/防具/道具 分頁顯示搜尋框
  function syncVisible() {
    var box = document.getElementById('afk-isearch');
    if (!box) return;
    var on = TAB_IDS.some(function (id) {
      var d = document.getElementById(id);
      return d && !d.classList.contains('hidden');
    });
    box.classList.toggle('is-on', on);
  }

  function ensureBox() {
    if (document.getElementById('afk-isearch')) return true;
    var panel = document.getElementById('tab-content-panel');
    var anchor = document.getElementById(TAB_IDS[0]);
    if (!panel || !anchor) return false;
    var box = document.createElement('div');
    box.id = 'afk-isearch';
    var inp = document.createElement('input');
    inp.id = 'afk-isearch-input'; inp.type = 'search'; inp.autocomplete = 'off';
    inp.placeholder = '🔍 搜尋名稱…(武/防/道具共用)';
    inp.addEventListener('input', function () { q = inp.value; filterAll(); });
    box.appendChild(inp);
    panel.insertBefore(box, panel.firstElementChild);   // 分頁 div 外面:核心重繪不會碰到
    syncVisible();
    return true;
  }

  if (typeof window.renderTabs === 'function' && !window.renderTabs.__afkISearch) {
    var _origTabs = window.renderTabs;
    var wrapped = function () {
      var r = _origTabs.apply(this, arguments);
      try { ensureBox(); filterAll(); } catch (e) {}   // 重建後的新列要重套目前的關鍵字
      return r;
    };
    wrapped.__afkISearch = true;
    window.renderTabs = wrapped;
  }

  if (typeof window.switchTab === 'function' && !window.switchTab.__afkISearch) {
    var _origSwitch = window.switchTab;
    var wrappedSwitch = function () {
      var r = _origSwitch.apply(this, arguments);
      try { ensureBox(); syncVisible(); } catch (e) {}
      return r;
    };
    wrappedSwitch.__afkISearch = true;
    window.switchTab = wrappedSwitch;
  }

  injectCss();
  ensureBox();
  if (typeof window.renderTabs === 'function') {
    console.log('[AFK-itemsearch] hooks OK — 背包(武/防/道)分頁支援名稱搜尋。');
  } else {
    console.warn('[AFK-itemsearch] 找不到 renderTabs,名稱搜尋停用。');
  }
})();
