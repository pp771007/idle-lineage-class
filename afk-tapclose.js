/* ============================================================================
 * afk-tapclose.js — 點視窗外面的空白處＝關掉視窗
 *
 * 一次點擊只關「最上面那一個」視窗；判斷順序：
 *   ① 找出目前開著的視窗（清單見 WINDOWS 與 afk-banner 的 MODAL_HOSTS／Tailwind 的 .fixed.inset-0 遮罩）
 *   ② 依 z-index（同層看 DOM 先後）挑最上面那個
 *   ③ 點的位置不在它裡面 → 走它「自己的」關閉路徑（核心關閉函式或視窗裡的 ✕／關閉鈕），不直接刪 DOM
 *      —— 有的視窗關閉時要收尾，有的是常駐節點只切 class，刪了下次就開不起來（同 afk-lmui closeAllWindows 的理由）。
 *
 * 點在視窗外面（遮罩本身，或視窗外的其他介面，例如另一位 NPC、背包裡另一件物品）→ 只關視窗、吃掉這次點擊：
 *   底下的東西不會被點到（玩家要求：點空白＝關閉，不要順便跳出點到位置的視窗）。
 *
 * 不關：
 *   ・找不到 ✕／關閉／返回 鈕的遮罩型視窗（例如只有「領取」的離線結算）——沒有「取消」語意的視窗不能被誤關
 *   ・點在底部導覽列（#m-nav）：切分頁時 afk-lmui 自己會收視窗；這裡再關一次會跟「再點一次＝開/關」的鈕打架
 *   ・點在提示框、懸停資料框、官方橫幅上
 *
 * 優雅降級：任何一步出錯就放手，不擋原本的點擊。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('tapclose')) return;   // 🎚️ 外掛開關（目錄在 afk-toggles）

  var MODAL_HOSTS = (window.AFK_BANNER && AFK_BANNER.MODAL_HOSTS) || '';

  function $(id) { return document.getElementById(id); }
  function shown(e) {
    if (!e || !e.getClientRects().length) return false;
    var cs = getComputedStyle(e);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }

  // 「盒子型」視窗：沒有遮罩，點在盒子外面＝外面
  var WINDOWS = [
    { el: function () { var e = $('item-modal'); return e && !e.classList.contains('hidden') ? e : null; },
      close: function () { if (typeof closeModal === 'function') closeModal(); } },
    { el: function () { var w = $('warehouse-window'); return w && !w.classList.contains('hidden') ? $('warehouse-window-frame') : null; },
      close: function () { if (typeof closeWarehouseWindow === 'function') closeWarehouseWindow(); } },
    // NPC 對話／商店：只有天堂M介面的村莊裡才是浮在上面的視窗；原版版面是排在欄位裡的面板，不算
    { el: function () { var e = $('town-interaction-container'); return e && !e.classList.contains('hidden') && document.body.classList.contains('lmui-town') ? e : null; },
      close: function () { var b = $('town-interaction-close'); if (b) b.click(); } },
    { el: function () { return document.body.classList.contains('lmui-maps') ? $('lmui-maps') : null; },
      close: function () { document.body.classList.remove('lmui-maps'); } },
    { el: function () { return document.body.classList.contains('lmui-mobinfo') ? $('lmui-mobinfo') : null; },
      close: function () { document.body.classList.remove('lmui-mobinfo'); } }
  ];

  var CLOSE_TEXT = /^(✕|×|x|X|關閉|返回|Close)$/;
  function findCloseBtn(root) {
    var cand = root.querySelectorAll('button, [role="button"], .close, [aria-label*="關閉"]');
    for (var i = 0; i < cand.length; i++) {
      var c = cand[i];
      if (!c.getClientRects().length) continue;
      var label = (c.getAttribute('aria-label') || '') + ' ' + (c.className && c.className.baseVal == null ? c.className : '');
      if (CLOSE_TEXT.test((c.textContent || '').trim()) || /關閉|close/i.test(label)) return c;
    }
    return null;
  }

  // 疊放順序：往上找第一個有 z-index 的祖先（含自己），取最大的那個數字
  function zOf(e) {
    var z = 0;
    for (var n = e; n && n !== document.body; n = n.parentElement) {
      var v = parseInt(getComputedStyle(n).zIndex, 10);
      if (!isNaN(v)) z = Math.max(z, v);
    }
    return z;
  }

  function openWindows() {
    var out = [];
    WINDOWS.forEach(function (w) {
      try { var e = w.el(); if (e && shown(e)) out.push({ box: e, close: w.close }); } catch (err) {}
    });
    // 遮罩型：整片蓋住畫面的底，點在「底」本身才算外面
    var sel = (MODAL_HOSTS ? MODAL_HOSTS + ',' : '') + '.fixed.inset-0,#my-mailbox,#m-dex-modal,#m-train-modal';
    var list = document.querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      if (h.id === 'game-screen' || h.id === 'app-stage' || h.closest('#lmui-hud') || h.closest('#lmui-ashost')) continue;
      if (!shown(h) || getComputedStyle(h).pointerEvents === 'none') continue;
      if (out.some(function (o) { return o.box === h || o.box.contains(h) || h.contains(o.box); })) continue;
      var btn = findCloseBtn(h);
      if (!btn) continue;   // 沒有「關閉」語意的視窗不碰
      out.push({ box: h, overlay: true, close: (function (b) { return function () { b.click(); }; })(btn) });
    }
    return out;
  }

  function topmost(list) {
    var best = null, bz = -Infinity;
    list.forEach(function (w) {
      var z = zOf(w.box);
      if (z > bz || (z === bz && best && (best.box.compareDocumentPosition(w.box) & Node.DOCUMENT_POSITION_FOLLOWING))) { best = w; bz = z; }
    });
    return best;
  }

  function exempt(t) {
    return !!t.closest('#m-nav, #m-toast-wrap, .game-tooltip, .tooltip, [id*="tooltip"]')
      || (document.body.contains(t) && parseInt(getComputedStyle(t.closest('body > *') || t).zIndex, 10) >= 2000000000 && !t.closest('#my-mailbox'));
  }

  document.addEventListener('click', function (e) {
    try {
      var t = e.target;
      if (!t || !t.closest || !document.body.contains(t) || exempt(t)) return;
      var w = topmost(openWindows());
      if (!w) return;
      // 點在視窗內容上 → 不動。（遮罩型點在遮罩本身不算「內容」；盒子型點在盒子自己的邊框空隙仍算裡面；天堂M介面會把遮罩縮到下半部，點在遮罩範圍外也算外面）
      if (w.box.contains(t) && !(w.overlay && t === w.box)) return;
      w.close();
      e.stopPropagation(); e.preventDefault();   // 吃掉：底下的介面不會被點到（也免得視窗自己的遮罩處理再關一次）
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    } catch (err) { console.warn('[AFK-tapclose]', err); }
  }, true);

  console.log('[AFK-tapclose] hooks OK — 點視窗外空白處關閉視窗。');
})();
