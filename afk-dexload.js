/* ============================================================================
 * afk-dexload.js — 怪物/掉落查詢(afk-dex.js)的「點開才下載」載入器
 *
 * afk-dex.js 約 85KB,開關預設關、會開的人也不是每次都查 → 不在開頁時下載,省下手機第一次開/無痕的頻寬。
 * 這支只做兩件事(開關關著就什麼都不做、什麼都不抓):
 *   - 遊戲中:在自動化分頁「🔌 外掛」列放「📖 掉落查詢」鈕,點了才載入 afk-dex.js,載完直接開查詢面板。
 *     afk-dex 載入後自己的 injectAutoNav 看到同 id 的鈕已存在就不再加,鈕沿用這裡的 handler。
 *   - 獨立頁(?view=dex,afk-dex 面板的「新分頁開啟」):直接載入,afk-dex 自己鋪滿整頁。
 * 檔案位址(含 ?v=)寫在 index.html 的 <template id="afk-lazy-dex" data-file="afk-dex.js?v=…">:
 *   <template> 不會被下載,但 stamp-code-versions 照樣對齊它的 ?v=(換版就換 URL,不會吃到舊快取)。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('dex')) return;   // 🎚️ 開關關著:不放鈕、不下載

  var file = null;   // init 時才讀:<template> 排在本支 <script> 後面,同步執行當下還沒被解析
  var loaded = false, loading = false, waiters = [];
  function loadDex(cb) {
    if (loaded) { cb(true); return; }
    waiters.push(cb);
    if (loading) return;
    loading = true;
    var s = document.createElement('script');
    s.src = file;
    // afk-dex 的 init 排在下一輪(見它的 ready):等面板真的建好才回報,不然 goto 會開到空氣
    s.onload = function () {
      var tries = 0;
      (function wait() {
        if (document.getElementById('m-dex-modal') || ++tries > 60) { loading = false; loaded = true; flush(true); return; }
        setTimeout(wait, 50);
      })();
    };
    s.onerror = function () { loading = false; s.remove(); flush(false); };   // 沒載到:下次再按可重試
    document.head.appendChild(s);
  }
  function flush(ok) {
    var w = waiters; waiters = [];
    w.forEach(function (f) { try { f(ok); } catch (e) { console.warn('[AFK-dexload]', e); } });
  }

  function isStandalone() {
    try { return new URLSearchParams(location.search).get('view') === 'dex'; } catch (e) { return false; }
  }

  function onNavClick() {
    var btn = this;
    if (btn.disabled) return;
    btn.disabled = true;
    loadDex(function (ok) {
      btn.disabled = false;
      if (ok && window.AFK_DEX_API && AFK_DEX_API.goto) { AFK_DEX_API.goto({}); return; }
      console.warn('[AFK-dexload] afk-dex.js 載入失敗或未提供 AFK_DEX_API');
      alert('掉落查詢沒有載入成功，請確認網路後再按一次。');
    });
  }

  // 與 afk-dex / afk-training 的 injectAutoNav 同一列、同一份 markup(誰先載入誰建列)。
  function injectAutoNav() {
    var panel = document.getElementById('tab-automation');
    if (!panel) { console.warn('[AFK-dexload] 找不到 #tab-automation,掉落查詢入口停用。'); return; }
    var row = document.getElementById('m-afk-navrow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'm-afk-navrow';
      row.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700';
      row.innerHTML = '<div class="text-sm text-amber-400 mb-2 border-b border-slate-700 pb-1 font-bold">🔌 外掛</div>' +
        '<div id="m-afk-navrow-btns" style="display:flex;gap:8px;"></div>';
      panel.appendChild(row);
    }
    if (document.getElementById('m-afk-nav-dex')) return;
    var b = document.createElement('button');
    b.id = 'm-afk-nav-dex'; b.type = 'button';
    b.className = 'btn py-2 text-sm bg-slate-700 hover:bg-slate-600 border-slate-500';
    b.style.flex = '1';
    b.textContent = '📖 掉落查詢';
    b.addEventListener('click', onNavClick);
    row.querySelector('#m-afk-navrow-btns').appendChild(b);
  }

  function init() {
    var tpl = document.getElementById('afk-lazy-dex');
    file = tpl && tpl.getAttribute('data-file');
    if (!file) { console.warn('[AFK-dexload] 找不到 #afk-lazy-dex,掉落查詢停用。'); return; }
    if (isStandalone()) { loadDex(function () {}); return; }
    injectAutoNav();
    console.log('[AFK-dexload] hooks OK — 掉落查詢入口已就緒(點開才下載)。');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
