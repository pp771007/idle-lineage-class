/* ============================================================================
 * afk-toast.js — 手機:點按鈕觸發的系統日誌訊息,同時用 toast 浮出提示
 *
 * 為什麼:手機版系統日誌是「可開關的浮動面板」,平常收起來。像倉庫「一鍵存入」這種
 *   按鈕的回饋(寫進 logSys)收進日誌就看不到了,使用者點下去毫無感覺。本外掛把
 *   「使用者點擊當下、同步寫進 logSys 的訊息」抓出來,用 toast 浮現一份。
 *
 * 怎麼避免洗頻(核心):只抓「click 事件同步派發期間」呼叫的 logSys。
 *   戰鬥/掛機是 tick(setInterval)在跑,掉落/金幣/升級那些洗版訊息不在任何 click 的
 *   同步窗內,自然不會被抓到 → 只有「真的點了按鈕」才會冒 toast。
 *   另一道防線:一次點擊若同步吐出大量 logSys(如載入存檔時把整段離線掛機掉落一次性
 *   寫進日誌),屬「批次洗版」非按鈕回饋 → 超過 FLOOD_CAP 就整批略過(不會冒幾百則)。
 *
 * 範圍:只在 body.m-mobile(手機版面,由 afk-mobile.js 依 matchMedia 切換)顯示;
 *   桌機系統日誌常駐可見,不需要 toast。
 *
 * 優雅降級:沒有 logSys 就 console.warn 後安靜停用,不影響遊戲。
 *
 * 掛接:在 index.html </body> 前加一行 <script src="afk-toast.js"></script>
 *   (純包 logSys + 自注 DOM,無「必須命中的原作者 DOM 掛點」,故不列入 smoke-hooks。)
 * ========================================================================== */
(function () {
  'use strict';

  var TOAST_MS = 3500;          // 每則 toast 停留時間(毫秒)
  var MAX_TOASTS = 3;           // 畫面同時最多幾張,超過移除最舊
  var MAX_LINES_PER_CLICK = 4;  // 單次點擊抓到多則(如某些一鍵操作)時最多顯示幾則
  var FLOOD_CAP = 6;            // 單次點擊產生超過這麼多則 logSys → 視為結算/批次洗版,整批不冒 toast
  var NAV_H = 56;               // 配合 afk-mobile #m-nav 高度,toast 浮在導覽列上方

  function init() {
    if (typeof window.logSys !== 'function') {
      console.warn('[AFK-toast] 找不到 logSys,toast 停用。');
      return;
    }

    injectCSS();

    var container = null;
    function ensureContainer() {
      if (container && document.body.contains(container)) return container;
      container = document.createElement('div');
      container.id = 'm-toast-wrap';
      document.body.appendChild(container);
      return container;
    }

    // click 派發是同步的:capture 階段先把旗標立起來(早於各 onclick),
    // onclick 同步呼叫的 logSys 會被收進 buf;本輪 task 跑完後用 setTimeout(0) flush。
    // 一次點擊若同步吐出大量 logSys(如載入存檔時的離線結算把整段掛機掉落一次性寫日誌),
    // 是「批次洗版」而非按鈕回饋 → 超過 FLOOD_CAP 就標記整批略過,不冒 toast。
    var inClick = false;
    var buf = [];
    var flooded = false;
    document.addEventListener('click', function () {
      inClick = true;
      buf = [];
      flooded = false;
      setTimeout(function () {
        var msgs = buf;
        var wasFlood = flooded;
        buf = [];
        inClick = false;
        flooded = false;
        if (wasFlood || !msgs.length) return;                        // 批次洗版整批略過
        if (!document.body.classList.contains('m-mobile')) return;   // 只手機顯示
        showToast(msgs);
      }, 0);
    }, true);

    // 包住 logSys:原行為照跑(訊息照樣進日誌);若在點擊同步窗內,順手收進 buf。
    // 補跑/結算期間(state.ff)的訊息不收(那是背景批次,不是使用者點按鈕的即時回饋)。
    var orig = window.logSys;
    window.logSys = function (msg) {
      var r = orig.apply(this, arguments);
      if (inClick && typeof msg === 'string' && !(window.state && window.state.ff)) {
        if (buf.length >= FLOOD_CAP) flooded = true;   // 超量 → 標記整批洗版,停止累積
        else buf.push(msg);
      }
      return r;
    };

    function showToast(msgs) {
      var wrap = ensureContainer();
      var card = document.createElement('div');
      card.className = 'm-toast';
      var shown = msgs.slice(-MAX_LINES_PER_CLICK);
      // logSys 訊息本身帶顏色 span,直接以 innerHTML 呈現保留配色(遊戲自家內容,可信)。
      card.innerHTML = shown.map(function (m) {
        return '<div class="m-toast-line">' + m + '</div>';
      }).join('');
      if (msgs.length > shown.length) {
        card.insertAdjacentHTML('afterbegin',
          '<div class="m-toast-more">…(共 ' + msgs.length + ' 則,顯示最後 ' + shown.length + ' 則)</div>');
      }
      wrap.appendChild(card);
      while (wrap.children.length > MAX_TOASTS) wrap.removeChild(wrap.firstChild);

      requestAnimationFrame(function () { card.classList.add('m-toast-in'); });

      var killed = false;
      function kill() {
        if (killed) return;
        killed = true;
        card.classList.remove('m-toast-in');
        card.addEventListener('transitionend', function () {
          if (card.parentNode) card.parentNode.removeChild(card);
        });
        setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, 400);
      }
      card.addEventListener('click', kill);   // 點 toast 一下提早關
      setTimeout(kill, TOAST_MS);
    }

    function injectCSS() {
      var css = [
        '#m-toast-wrap{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(' + NAV_H + 'px + 14px);z-index:99999;display:flex;flex-direction:column;gap:8px;width:min(92vw,420px);pointer-events:none;}',
        '#m-toast-wrap .m-toast{pointer-events:auto;background:rgba(15,23,42,.96);border:1px solid #334155;border-left:3px solid #38bdf8;border-radius:10px;padding:10px 14px;box-shadow:0 6px 20px rgba(0,0,0,.5);color:#e2e8f0;font-size:14px;line-height:1.5;word-break:break-word;opacity:0;transform:translateY(10px);transition:opacity .22s ease,transform .22s ease;}',
        '#m-toast-wrap .m-toast.m-toast-in{opacity:1;transform:translateY(0);}',
        '#m-toast-wrap .m-toast-line + .m-toast-line{margin-top:4px;}',
        '#m-toast-wrap .m-toast-more{color:#94a3b8;font-size:12px;margin-bottom:4px;}'
      ].join('\n');
      var st = document.createElement('style');
      st.id = 'm-toast-style';
      st.textContent = css;
      document.head.appendChild(st);
    }

    console.log('[AFK-toast] hooks OK');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
