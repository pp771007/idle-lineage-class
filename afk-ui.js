/*
 * afk-ui.js — 統一自製彈窗:全域接管 window.alert
 *
 * 為什麼:原生 alert 在 iOS Safari 會被「抑制連續彈窗」,且外觀與遊戲不統一。
 *   alert 是「純通知、無回傳值」,可安全地全域換成自製非阻塞彈窗,原作者所有 alert 自動套用。
 *   ※ confirm/prompt 會「同步回傳」使用者的選擇,自製彈窗本質非同步、無法 drop-in 取代,
 *     不在本檔處理(要換得逐個攔按鈕重寫流程,如登出/倉庫的做法)。
 *
 * 行為:接管後 alert(msg) → 置中深色卡片 + 「確定」鈕(沿用登出視窗樣式)。
 *   多則 alert 自動排隊依序顯示。關閉:點確定 / 點背景 / Enter / Esc。
 *   保留原生 alert 作為極早期(DOM 未就緒)的兜底。
 *
 * 優雅降級:document.body 不存在時退回原生 alert,不影響遊戲。
 * 純接管 window.alert + 自注 DOM/CSS,無「必須命中的原作者 DOM 掛點」,故不列入 smoke-hooks。
 */

// ── 共用「返回鍵 / ESC 關閉最上層彈窗」管理器(window.AFK_UI) ─────────────────
//   任何自製 modal 開啟時呼叫 AFK_UI.openLayer(closeFn) 壓一層(同時壓一格瀏覽歷史),
//   主動關閉(✕ / 點背景 / 按鈕)呼叫 AFK_UI.closeLayer(layer);手機實體返回鍵與 ESC 會自動關掉最上層。
//   小百科/掉落查詢有自己一套等效實作(且需處理獨立頁常駐 modal),不改它們;本管理器供其餘 modal 共用。
(function () {
  var U = (window.AFK_UI = window.AFK_UI || {});
  if (U._backInit) return;
  U._backInit = true;
  var stack = [];          // LIFO:每層 { close: fn }
  var suppress = false;    // closeLayer 主動退歷史時,抑制隨之而來的 popstate(避免重複關)
  U.openLayer = function (closeFn) {
    var layer = { close: (typeof closeFn === 'function') ? closeFn : function () {} };
    stack.push(layer);
    try { history.pushState({ afkLayer: stack.length }, ''); } catch (e) {}
    return layer;
  };
  U.closeLayer = function (layer) {
    var i = stack.indexOf(layer);
    if (i < 0) return;
    stack.splice(i, 1);
    try { layer.close(); } catch (e) {}
    suppress = true;
    try { history.back(); } catch (e) { suppress = false; }   // 退掉開啟時壓的那格歷史
  };
  window.addEventListener('popstate', function () {
    if (suppress) { suppress = false; return; }   // 主動關自己 history.back() 觸發的,已處理過
    var layer = stack.pop();                       // 手機實體返回鍵:關掉最上層
    if (layer) { try { layer.close(); } catch (e) {} }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !stack.length) return;
    e.preventDefault();
    U.closeLayer(stack[stack.length - 1]);
  });
})();

(function () {
  var nativeAlert = (typeof window.alert === 'function') ? window.alert.bind(window) : null;
  var queue = [];
  var modal = null, msgEl = null, okBtn = null, showing = false, layer = null;

  function injectCss() {
    if (document.getElementById('afk-ui-css')) return;
    var s = document.createElement('style');
    s.id = 'afk-ui-css';
    s.textContent = [
      '#afk-alert-modal{display:none;position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:10000;background:rgba(2,6,23,0.7);align-items:center;justify-content:center;padding:24px;}',
      '#afk-alert-modal.open{display:flex;}',
      '#afk-alert-card{width:min(360px,92vw);background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.6);}',
      '#afk-alert-msg{color:#e2e8f0;font-size:15px;line-height:1.7;text-align:center;margin-bottom:18px;word-break:break-word;}',
      '#afk-alert-ok{display:block;width:100%;padding:11px;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer;font-family:inherit;border:1px solid #d97706;background:#b45309;color:#fff;}',
      '#afk-alert-ok:active{background:#92400e;}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  function build() {
    injectCss();
    modal = document.createElement('div');
    modal.id = 'afk-alert-modal';
    modal.innerHTML =
      '<div id="afk-alert-card">' +
        '<div id="afk-alert-msg"></div>' +
        '<button id="afk-alert-ok" type="button">確定</button>' +
      '</div>';
    document.body.appendChild(modal);
    msgEl = modal.querySelector('#afk-alert-msg');
    okBtn = modal.querySelector('#afk-alert-ok');
    okBtn.addEventListener('click', requestClose);
    modal.addEventListener('click', function (e) { if (e.target === modal) requestClose(); });   // 點背景關閉
    document.addEventListener('keydown', function (e) {                                          // Enter 關閉(Esc / 返回鍵交給 AFK_UI 共用管理器)
      if (showing && e.key === 'Enter') { e.preventDefault(); requestClose(); }
    });
  }
  // 主動關(確定鈕 / 點背景 / Enter):走 AFK_UI 退一格歷史並觸發 dismiss;沒有 AFK_UI 時直接 dismiss
  function requestClose() {
    if (!showing) return;
    if (layer && window.AFK_UI) AFK_UI.closeLayer(layer); else dismiss();
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function showNext() {
    if (showing || !queue.length) return;
    if (!modal) build();
    showing = true;
    var msg = queue.shift();
    msgEl.innerHTML = esc(msg).replace(/\n/g, '<br>');   // 原生 alert 的 \n 換行 → <br>;內容先逸出避免 HTML 注入
    modal.classList.add('open');
    layer = window.AFK_UI ? AFK_UI.openLayer(dismiss) : null;   // 壓一層 → 手機返回鍵 / ESC 可關
    try { okBtn.focus(); } catch (e) {}
  }

  // 實際收起(由 AFK_UI 在返回鍵 / closeLayer 時呼叫;不自行動歷史)
  function dismiss() {
    if (!showing) return;
    showing = false;
    layer = null;
    modal.classList.remove('open');
    if (queue.length) setTimeout(showNext, 0);   // 還有排隊的下一則接著顯示
  }

  window.alert = function (msg) {
    if (!document.body) { if (nativeAlert) nativeAlert(msg); return; }   // 極早期(body 未就緒)退回原生
    queue.push(msg == null ? '' : msg);
    showNext();
  };

  console.log('[AFK-ui] hooks OK(window.alert 已接管為自製彈窗)');
})();

// ── 共用「確認彈窗」AFK_UI.confirm(opts) ─────────────────────────────
//   opts:{ title, message, okText='確定', cancelText='取消', danger=false, onOk, onCancel, onDismiss }
//   非阻塞(confirm 無法同步回傳,故用 callback):確定→onOk();取消鈕→onCancel()。
//   點背景/ESC/返回鍵=「沒做決定」→ onDismiss();沒給 onDismiss 才退回 onCancel()(與舊行為相容)。
//   ⚠ 兩個鈕代表「二選一」(如靈魂之球選哪把魔杖)時務必給 onDismiss,否則誤觸背景會幫玩家做掉決定。
//   深色雙鈕卡片,沿用 alert 卡片樣式;透過 AFK_UI.openLayer 壓一層→手機返回鍵/ESC 可關。
//   優雅降級:document.body 未就緒退回原生 confirm。
(function () {
  var U = (window.AFK_UI = window.AFK_UI || {});
  var modal = null, titleEl, msgEl, okBtn, cancelBtn, layer = null, showing = false, cb = {}, pendingOk = false, decided = false;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function injectCss() {
    if (document.getElementById('afk-confirm-css')) return;
    var s = document.createElement('style');
    s.id = 'afk-confirm-css';
    s.textContent = [
      '#afk-confirm-modal{display:none;position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:10001;background:rgba(2,6,23,0.7);align-items:center;justify-content:center;padding:24px;}',
      '#afk-confirm-modal.open{display:flex;}',
      '#afk-confirm-card{width:min(380px,92vw);background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.6);}',
      '#afk-confirm-title{color:#f8fafc;font-size:16px;font-weight:bold;text-align:center;margin-bottom:10px;}',
      '#afk-confirm-msg{color:#cbd5e1;font-size:14px;line-height:1.7;text-align:center;margin-bottom:18px;word-break:break-word;}',
      '#afk-confirm-btns{display:flex;gap:10px;}',
      '.afk-confirm-btn{flex:1;padding:11px;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer;font-family:inherit;border:1px solid;}',
      '#afk-confirm-cancel{border-color:#475569;background:#334155;color:#e2e8f0;}',
      '#afk-confirm-cancel:active{background:#1e293b;}',
      '#afk-confirm-ok{border-color:#d97706;background:#b45309;color:#fff;}',
      '#afk-confirm-ok:active{background:#92400e;}',
      '#afk-confirm-ok.danger{border-color:#dc2626;background:#b91c1c;}',
      '#afk-confirm-ok.danger:active{background:#991b1b;}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }
  function build() {
    injectCss();
    modal = document.createElement('div');
    modal.id = 'afk-confirm-modal';
    modal.innerHTML =
      '<div id="afk-confirm-card">' +
        '<div id="afk-confirm-title"></div>' +
        '<div id="afk-confirm-msg"></div>' +
        '<div id="afk-confirm-btns">' +
          '<button id="afk-confirm-cancel" class="afk-confirm-btn" type="button"></button>' +
          '<button id="afk-confirm-ok" class="afk-confirm-btn" type="button"></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    titleEl = modal.querySelector('#afk-confirm-title');
    msgEl = modal.querySelector('#afk-confirm-msg');
    okBtn = modal.querySelector('#afk-confirm-ok');
    cancelBtn = modal.querySelector('#afk-confirm-cancel');
    okBtn.addEventListener('click', function () { closeWith(true); });
    cancelBtn.addEventListener('click', function () { closeWith(false); });
    modal.addEventListener('click', function (e) { if (e.target === modal) dismiss(); });   // 點背景=沒做決定
  }
  // 按鈕:記下選擇(decided)→走 AFK_UI 退一格歷史並觸發 doClose
  function closeWith(ok) {
    if (!showing) return;
    pendingOk = ok; decided = true;
    if (layer && U.closeLayer) U.closeLayer(layer); else doClose();
  }
  // 點背景:不記選擇 → doClose 走 onDismiss
  function dismiss() {
    if (!showing) return;
    if (layer && U.closeLayer) U.closeLayer(layer); else doClose();
  }
  // 實際收起(由 AFK_UI 於返回鍵/ESC/closeLayer 呼叫;返回鍵/ESC 未經 closeWith→decided=false)
  function doClose() {
    if (!showing) return;
    showing = false;
    modal.classList.remove('open');
    var fn = decided ? (pendingOk ? cb.onOk : cb.onCancel) : (cb.onDismiss || cb.onCancel);
    layer = null; cb = {}; pendingOk = false; decided = false;
    if (typeof fn === 'function') { try { fn(); } catch (e) {} }
  }
  U.confirm = function (opts) {
    opts = opts || {};
    if (!document.body) {   // 極早期(body 未就緒)退回原生 confirm
      if (window.confirm((opts.title ? opts.title + '\n' : '') + (opts.message || ''))) { if (opts.onOk) opts.onOk(); }
      else { if (opts.onCancel) opts.onCancel(); }
      return;
    }
    if (!modal) build();
    if (showing) return;   // 一次只顯示一個
    showing = true; pendingOk = false; decided = false;
    cb = { onOk: opts.onOk, onCancel: opts.onCancel, onDismiss: opts.onDismiss };
    titleEl.innerHTML = esc(opts.title || '確認');
    titleEl.style.display = (opts.title === '') ? 'none' : '';
    msgEl.innerHTML = esc(opts.message || '').replace(/\n/g, '<br>');
    okBtn.textContent = opts.okText || '確定';
    cancelBtn.textContent = opts.cancelText || '取消';
    okBtn.classList.toggle('danger', !!opts.danger);
    modal.classList.add('open');
    layer = U.openLayer ? U.openLayer(doClose) : null;   // ESC/返回鍵/背景=取消
    try { okBtn.focus(); } catch (e) {}
  };
})();
