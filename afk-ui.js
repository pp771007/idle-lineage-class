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

// ── 全站唯一的瀏覽歷史層管理器(window.AFK_NAV;AFK_UI.openLayer/closeLayer 是它的別名) ──────
//
// 為什麼要「唯一」:popstate 是 window 級事件——任何一次 history.back() 都會通知**所有**監聽器。
//   過去彈窗(afk-ui)、返回鍵(afk-backnav)、掉落查詢、小百科各自管一套「計數器 + 抑制旗標」,
//   而抑制旗標只擋得住「自己發的 back」,擋不住別人發的 → 在掉落查詢裡跳個提示視窗再關掉,
//   掉落查詢就會把別人的 back 當成自己的、把計數器減掉卻沒退掉自己那格歷史 → 留下一格沒人認領的
//   死歷史。每跑一輪多留一格,玩家最後得按好幾下返回鍵才離得開 PWA(而且按下去畫面毫無反應)。
//
// 作法:改用「序號對齊」取代計數器+旗標。每壓一層就給一個遞增序號寫進 history.state.afkNav,
//   popstate 時**只看目前歷史停在第幾號**,把序號比它大的層全部關掉。誰發的 back 都算得對、
//   重複觸發也冪等,因此不需要任何抑制旗標。
//
// 用法:h = AFK_NAV.push(closeFn) 開層;主動關(✕/點背景/按鈕)呼叫 AFK_NAV.pop(h)。
//   跨頁交接(掉落查詢↔小百科 互相切換,共用同一格歷史):來源 AFK_NAV.handoff(h),目的地 AFK_NAV.claim()。
(function () {
  var N = (window.AFK_NAV = window.AFK_NAV || {});
  if (N._init) return;
  N._init = true;

  var stack = [];        // LIFO:每層 { seq, close };與「基準點以上的歷史格」一一對應
  var seq = 0;           // 全站共用的遞增序號(寫進 history.state.afkNav)
  var parked = null;     // handoff 暫存的層(等對方 claim)
  var pendingBack = 0, flushing = false;

  function curSeq() { try { return (history.state && history.state.afkNav) || 0; } catch (e) { return 0; } }

  // 把「還沒發出的 back」集中到下一個 task 一次發:同一輪事件裡連關兩層時,
  //   history.back() 是非同步的,逐次比對歷史位置會誤判(第二次看到的還是舊位置)。
  function scheduleBack(n) {
    pendingBack += n;
    if (flushing) return;
    flushing = true;
    setTimeout(function () {
      var k = pendingBack; pendingBack = 0; flushing = false;
      if (k > 0) { try { history.go(-k); } catch (e) {} }
    }, 0);
  }

  N.push = function (closeFn) {
    var h = { seq: ++seq, close: (typeof closeFn === 'function') ? closeFn : function () {} };
    stack.push(h);
    // 有還沒發出的 back → 一退一進互相抵銷,就地換掉那格的擁有者即可(跨頁切換走這條,不會多留歷史)
    if (pendingBack > 0) { pendingBack--; try { history.replaceState({ afkNav: h.seq }, ''); } catch (e) {} }
    else { try { history.pushState({ afkNav: h.seq }, ''); } catch (e) {} }
    return h;
  };

  N.pop = function (h) {
    var i = h ? stack.indexOf(h) : -1;
    if (i < 0) return;
    var doomed = stack.splice(i);        // 自己與壓在自己上面的層一起收(歷史格是連續的)
    for (var k = doomed.length - 1; k >= 0; k--) { try { doomed[k].close(); } catch (e) {} }
    scheduleBack(doomed.length);
  };

  N.top = function () { return stack.length ? stack[stack.length - 1] : null; };
  N.depth = function () { return stack.length; };
  // 跨頁交接:來源不關歷史、把層寄放著,目的地 claim 後改指向自己的關閉函式(整段切換只佔一格歷史)
  N.handoff = function (h) { if (h && stack.indexOf(h) >= 0) parked = h; };
  N.claim = function (closeFn) {
    var h = parked; parked = null;
    if (!h || stack.indexOf(h) < 0) return null;
    if (typeof closeFn === 'function') h.close = closeFn;
    return h;
  };

  window.addEventListener('popstate', function () {
    var cur = curSeq();
    // ⚠ 先把要關的層全部從 stack 摘下來再逐一 close():close() 裡可能又 push 新層
    //   (如返回鍵從創角退回角色選擇後要重新押一格),邊走邊關會把剛押的那格立刻again關掉。
    var doomed = [];
    while (stack.length && stack[stack.length - 1].seq > cur) doomed.push(stack.pop());
    for (var i = 0; i < doomed.length; i++) { try { doomed[i].close(); } catch (e) {} }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !stack.length) return;
    e.preventDefault();
    N.pop(N.top());
  });

  // 相容既有呼叫端(afk-storage / afk-diag / afk-history / afk-mobname / afk-reissueid / afk-battlehud / afk-pwa)
  var U = (window.AFK_UI = window.AFK_UI || {});
  U.openLayer = function (closeFn) { return N.push(closeFn); };
  U.closeLayer = function (layer) { return N.pop(layer); };
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
