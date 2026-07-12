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
      '.afk-isearch{position:sticky;top:0;z-index:5;padding:2px 0 4px;background:inherit;flex:none;}',
      '.afk-isearch input{width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #475569;border-radius:8px;color:#e2e8f0;padding:6px 10px;font-size:13px;font-family:inherit;outline:none;}',
      '.afk-isearch input:focus{border-color:#b89243;}',
      '.afk-isearch input::placeholder{color:#64748b;}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function norm(s) { return (s || '').toLowerCase(); }

  // 過濾 container 的「直接子元素」:textContent 含關鍵字才顯示。skipEl=搜尋框自己(不過濾)。
  function filterChildren(container, kw, skipEl) {
    if (!container) return;
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
    wrap.className = 'afk-isearch';
    wrap.dataset.afkPersist = '1';   // 背包重建(_clearInvTab)時保留此節點:輸入框若被換新,手機打字中的焦點與軟鍵盤會被中斷
    var inp = document.createElement('input');
    inp.id = inputId; inp.type = 'search'; inp.autocomplete = 'off';
    inp.placeholder = '🔍 搜尋名稱…';
    inp.value = q[key];
    inp.addEventListener('input', function () { q[key] = inp.value; onChange(); });
    wrap.appendChild(inp);
    return wrap;
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
      filterChildren(div, q[t.key], document.getElementById(inputId) && document.getElementById(inputId).parentElement);
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

  injectCss();
  if (typeof window.renderTabs === 'function') {
    console.log('[AFK-itemsearch] hooks OK — 背包(武/防/道)分頁支援名稱搜尋。');
  } else {
    console.warn('[AFK-itemsearch] 找不到 renderTabs,名稱搜尋停用。');
  }
})();
