/* ============================================================================
 * afk-itemsearch.js — 背包(武器/防具/道具分頁)的「名稱搜尋」
 *
 * 作法:包住 renderTabs,每次重繪後把搜尋框「重新注入」清單頂端,
 *   查詢字串存在外掛自己的狀態(不存 DOM)→ 重繪不會弄丟;比對用列的 textContent
 *   (含名稱/詞綴/強化值,子字串命中即顯示),不動遊戲資料、純顯示層過濾。
 * 重繪時機:背包分頁只有內容簽章變了才重建(renderTabs 分區重建),打字本身不觸發重繪;
 *   狩獵中掉寶重建會換掉輸入框 → 重注入時還原字串與焦點(游標移到最後),打字不中斷。
 * ※ 倉庫的名稱搜尋在核心 js/12(背包側與倉庫側共用單一關鍵字,見 whSetSearch)。
 * 優雅降級:renderTabs 不存在就安靜停用。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('itemsearch')) return;   // 🎚️ 外掛開關:關掉就透明放行原版行為

  var q = { wpn: '', arm: '', item: '' };   // 各清單的查詢字串(單一事實來源)
  var TAB_KEYS = [
    { key: 'wpn', tabId: 'tab-weapons' },
    { key: 'arm', tabId: 'tab-armors' },
    { key: 'item', tabId: 'tab-items' }
  ];

  function injectCss() {
    if (document.getElementById('afk-isearch-css')) return;
    var st = document.createElement('style');
    st.id = 'afk-isearch-css';
    st.textContent = [
      // top 由 ensureTabSearch 依「快速操作頭部」的實際高度逐輪設定(它也是 sticky，見下)；這裡的 0 只是沒有頭部時的預設。
      // 背景必須不透明(與 .panel/頭部同為 slate-800)：sticky 釘住時，捲上來的物品列會從半透明背景後透出。
      '.afk-isearch{position:sticky;top:0;z-index:5;padding:2px 0 4px;background:#1e293b;flex:none;}',
      '.afk-isearch input{width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #475569;border-radius:8px;color:#e2e8f0;padding:6px 10px;font-size:13px;font-family:inherit;outline:none;}',
      '.afk-isearch input:focus{border-color:#b89243;}',
      '.afk-isearch input::placeholder{color:#64748b;}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function norm(s) { return (s || '').toLowerCase(); }

  // 過濾「實際裝物品列的容器」的直接子元素:textContent 含關鍵字才顯示。skipEl=搜尋框自己(不過濾)。
  //   ⚠ 上游 1.8 皮膚把列搬進 .classic-inventory-viewport 內層——過濾分頁 div 的直接子層打不到任何列
  //   (搜尋看起來沒作用),一律先找 viewport、沒有才退回分頁 div。
  function filterChildren(tabDiv, kw, skipEl) {
    if (!tabDiv) return;
    var container = tabDiv.querySelector('.classic-inventory-viewport') || tabDiv;
    kw = norm(kw.trim());
    for (var i = 0; i < container.children.length; i++) {
      var el = container.children[i];
      if (el === skipEl || el.classList.contains('afk-isearch')) continue;
      if (el.dataset.afkKeep === '1') continue;   // 標記不過濾的列(快速操作頭部)
      el.style.display = (!kw || norm(el.textContent).indexOf(kw) >= 0) ? '' : 'none';
    }
  }

  function makeBox(inputId, key, onChange) {
    var wrap = document.createElement('div');
    // ⚠ 'sticky' class 是保命符:上游 decorateClassicInventoryTab 會把「沒有 sticky/toolbar class 的分頁子元素」
    //   全部搬進 viewport 物品格裡——搜尋框被搬走就變成格子裡的一格(版面亂+每輪重繪都被搬=打字中斷)。
    wrap.className = 'afk-isearch sticky';
    wrap.dataset.afkPersist = '1';   // 背包重建(_clearInvTab)時保留此節點:輸入框若被換新,手機打字中的焦點與軟鍵盤會被中斷
    var inp = document.createElement('input');
    inp.id = inputId; inp.type = 'search'; inp.autocomplete = 'off';
    inp.placeholder = '🔍 搜尋名稱…';
    inp.value = q[key];
    inp.addEventListener('input', function () { q[key] = inp.value; onChange(); });
    wrap.appendChild(inp);
    return wrap;
  }

  // 搜尋框釘住的位置＝「快速操作頭部」釘住後的底緣。
  //   頭部(核心 js/10 產生)本身就是 sticky top:-12px、z-10、不透明底色;搜尋框若也釘在 top:0,
  //   兩者位置重疊 → 頭部 z 較高又不透明 → 捲動後搜尋框整個被蓋住看不見(表現得像「沒有 sticky」)。
  //   頭部高度會隨版面(桌機/手機、按鈕換行)變,故每輪重繪都重算,不寫死。
  //   ⚠ 未顯示的分頁(display:none)量到的高度是 0 → 此時不可覆寫成 top:0(那等於沒修),
  //     留著上次的值,等 switchTab 切到它、量得到真高度時再設(故本檔也包住 switchTab)。
  function stickBelowHeader(div, box) {
    var hdr = div.firstElementChild;
    if (!hdr || hdr === box) return;
    var hs = getComputedStyle(hdr);
    if (hs.position !== 'sticky') return;   // 沒有 sticky 頭部 → 維持 CSS 預設 top:0
    var h = hdr.offsetHeight;
    if (!h) return;                          // 分頁隱藏中,量不到
    box.style.top = Math.max(0, (parseFloat(hs.top) || 0) + h) + 'px';
  }

  // ---- 背包三分頁 -----------------------------------------------------------
  function ensureTabSearch() {
    TAB_KEYS.forEach(function (t) {
      var div = document.getElementById(t.tabId);
      if (!div) return;
      var inputId = 'afk-isearch-' + t.key;
      // 快速操作頭部每次重建都是新節點 → 每輪都要重新標記「不過濾」
      if (div.firstElementChild && !div.firstElementChild.classList.contains('afk-isearch')) div.firstElementChild.dataset.afkKeep = '1';
      if (!document.getElementById(inputId)) {
        var box = makeBox(inputId, t.key, function () { filterChildren(div, q[t.key], box); });
        div.insertBefore(box, div.firstElementChild ? div.firstElementChild.nextSibling : null);
      }
      var cur = document.getElementById(inputId);
      cur = cur && cur.parentElement;
      // 舊輪次被搬進 viewport 的框撈回分頁層(頭部之後);位置不對的框留著會被當物品格
      if (cur && cur.parentElement !== div) {
        var hdr = div.firstElementChild;
        div.insertBefore(cur, hdr && hdr !== cur ? hdr.nextSibling : div.firstChild);
      }
      if (cur) stickBelowHeader(div, cur);
      filterChildren(div, q[t.key], cur);
    });
  }

  if (typeof window.renderTabs === 'function' && !window.renderTabs.__afkISearch) {
    var _origTabs = window.renderTabs;
    var wrapped = function () {
      // 重繪會換掉輸入框:先記住「正在打字的是我們的框嗎」,重注入後還原焦點(游標移到最後)
      var ae = document.activeElement;
      var refocus = (ae && ae.id && ae.id.indexOf('afk-isearch-') === 0) ? ae.id : null;
      var r = _origTabs.apply(this, arguments);
      try {
        ensureTabSearch();
        if (refocus) { var ni = document.getElementById(refocus); if (ni && document.activeElement !== ni) { ni.focus(); try { ni.setSelectionRange(ni.value.length, ni.value.length); } catch (e) {} } }
      } catch (e) {}
      return r;
    };
    wrapped.__afkISearch = true;
    window.renderTabs = wrapped;
  }

  // 切分頁後該分頁才「量得到」頭部高度(隱藏時是 0)→ 顯示的當下重算搜尋框要釘在哪。
  if (typeof window.switchTab === 'function' && !window.switchTab.__afkISearch) {
    var _origSwitch = window.switchTab;
    var wrappedSwitch = function () {
      var r = _origSwitch.apply(this, arguments);
      try { ensureTabSearch(); } catch (e) {}
      return r;
    };
    wrappedSwitch.__afkISearch = true;
    window.switchTab = wrappedSwitch;
  }

  injectCss();
  if (typeof window.renderTabs === 'function') {
    console.log('[AFK-itemsearch] hooks OK — 背包(武/防/道)分頁支援名稱搜尋。');
  } else {
    console.warn('[AFK-itemsearch] 找不到 renderTabs,名稱搜尋停用。');
  }
})();
