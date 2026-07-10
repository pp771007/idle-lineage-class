/* ============================================================================
 * js/offline.js — 離線掛機(核心模組;關閉瀏覽器也能結算掛機收益)
 *
 * 2026-07-10 由外掛 afk-offline.js 移入核心(git mv,歷史保留)。對外相容不變:
 *   - localStorage 鍵沿用 afk_ts_/afk_map_/afk_pride_/afk_obl_/afk_hist_<slot>(玩家零遷移)。
 *   - window.__afk 介面沿用(afk-mobile 用 stamp、afk-slotinfo 用 mapName/capHours、afk-history 用 histKey)。
 *   - 開機訊息沿用「[AFK] hooks OK」(smoke 檢查認這個前綴)。
 *
 * 設計原則:
 *   - 離線戰鬥直接跑核心 tick()/killMob() 管線,平衡/掉落與在線一致。
 *   - 撞死即停、結算到死亡前(不做不死,避免無敵 exploit);存活則結算後接回原狩獵圖續掛。
 *   - per-slot 心跳:多分頁掛不同角色用各自的 afk_ts_<slot>,互不干擾。
 *   - 時間切片 + 進度遮罩,長補跑不凍結頁面。
 *   - 💾 分段檢查點:結算每 ~CKPT_MS 就 saveGame 並把錨點推進到「已結算到的時間點」——
 *     結算中被關頁/重整/系統殺掉,下次載入只補剩下沒算的,整晚收益不再無聲蒸發。
 *
 * 掛接點(核心直呼,不再 monkey-patch):
 *   - js/13 loadGame:開頭 offlinePreLoad() 擷取離線錨點 → 載入成功結尾 offlineAfterLoad(pre) 結算。
 *   - js/13 saveGame / js/11 changeMap:結尾 offlineStamp() 蓋錨點。
 *   - js/05 killMob / js/08 gainItem:結算期間經 window.__afkKillTally/__afkGainTally 計數(平時 null 零開銷)。
 * ========================================================================== */
(function () {
  'use strict';

  // ----- 可調參數 ---------------------------------------------------------
  var CAP_HOURS        = 24;                      // 離線收益上限(小時)
  var CAP_MS           = CAP_HOURS * 3600 * 1000;
  var HEARTBEAT_MS     = 5 * 1000;              // 活著時多久蓋一次時間戳
  var CKPT_MS          = 5 * 1000;              // 💾 結算檢查點間隔(真實毫秒):每滿就把已結算收益 saveGame＋錨點推進到已結算時點;結算被中斷最多丟這麼久的量
  var OVERLAY_MIN_TICK = 3000;                  // 補跑超過這麼多 tick 才顯示進度遮罩(約 5 分鐘)
  // 「每段最多跑這麼久就 await raf 讓出一次」＝畫面更新間隔(進度遮罩只在讓出時重繪、期間頁面凍結)。
  //   值小→讓出多、畫面順但等影格開銷大、結算慢;值大→相反。故依「要補跑的時間長短」動態取值:
  //   短離線(本來就快)用小值求順,長離線(才需要快)用大值求速度,中間線性漸變 → 兼顧順暢與速度。
  var SLICE_MIN_MS     = 28;                    // 短離線:接近一個影格(~16ms),畫面順
  var SLICE_MAX_MS     = 250;                   // 長離線:讓出少、結算快
  var SLICE_SHORT_TICK = 3000;                  // ≤5 分鐘(=遮罩門檻)以下一律用最小值(順)
  var SLICE_LONG_TICK  = 36000;                 // ≥1 小時一律用最大值(快);兩者之間線性內插
  function sliceFor(totalTicks) {
    if (totalTicks <= SLICE_SHORT_TICK) return SLICE_MIN_MS;
    if (totalTicks >= SLICE_LONG_TICK) return SLICE_MAX_MS;
    var f = (totalTicks - SLICE_SHORT_TICK) / (SLICE_LONG_TICK - SLICE_SHORT_TICK);
    return Math.round(SLICE_MIN_MS + f * (SLICE_MAX_MS - SLICE_MIN_MS));
  }
  // tick 數 → 友善時間字串(進度遮罩顯示「已結算 X / 共 Y」用)
  function fmtCatchupTime(ticks) {
    var s = Math.round(ticks * TICK_MS / 1000);
    if (s < 60) return s + ' 秒';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' 分' + (s % 60 ? ' ' + (s % 60) + ' 秒' : '');
    var h = Math.floor(m / 60);
    return h + ' 小時' + (m % 60 ? ' ' + (m % 60) + ' 分' : '');
  }
  var TS_PREFIX        = 'afk_ts_';

  // ----- 自我檢查:核心掛點都在才啟用,否則安靜退出(遊戲照常運作) ----------
  if (typeof window.saveGame !== 'function' ||
      typeof window.loadGame !== 'function' ||
      typeof window.tick !== 'function' ||
      typeof window.settleDeadMobs !== 'function' ||
      typeof window.startGameTimers !== 'function') {
    console.warn('[AFK] 缺少核心函式掛點(saveGame/loadGame/tick/...),離線功能停用。');
    return;
  }
  try { void state; void player; void currentSlot; void TICK_MS; }
  catch (e) {
    console.warn('[AFK] 缺少核心全域(state/player/currentSlot/TICK_MS),離線功能停用。');
    return;
  }

  // ----- 小工具 -----------------------------------------------------------
  function validSlot() { var n = +currentSlot; return Number.isInteger(n) && n >= 1; }  // 「有沒有選到存檔位」即可,不綁格數:currentSlot 由原作設成真實格號,故無需追蹤上限(原作加格不必再改這)
  function tsKey()      { return TS_PREFIX + currentSlot; }
  function mapKey()     { return 'afk_map_' + currentSlot; }
  function prideKey()   { return 'afk_pride_' + currentSlot; }
  function oblKey()     { return 'afk_obl_' + currentSlot; }
  function readTs()     { try { return +localStorage.getItem(tsKey()) || 0; } catch (e) { return 0; } }
  function readMap()    { try { return localStorage.getItem(mapKey()) || ''; } catch (e) { return ''; } }
  // 攀登狀態:原作 saveGame 不存 state.prideClimb/...(且 loadGame 一律回村),所以由外掛自己記一份,
  //   登入後才能還原並回到那層續爬。樓層區間(pride_x_y)是選單地圖,走 afk_map 即可,不靠這份。
  function readPride()  { try { var s = localStorage.getItem(prideKey()); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  // 遺忘之島旅程:原作 saveGame 不存 state.oblivion(且 loadGame 一律回村),同攀登由外掛自己記一份,
  //   登入後還原並接回島上續掛。島/途中地圖(oblivion_island/oblivion_travel)非選單地圖,走 enterOblivionMap 進場(不能用 gotoMap)。
  function readObl()    { try { var s = localStorage.getItem(oblKey()); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  // 蓋時間戳(=現在),順手記下「即時所在地圖」(changeMap 不會存檔,光看存檔 blob 會誤判還在村莊)。
  // ⚠ 結算期間(catchingUp)一律跳過:錨點只能由檢查點以「已結算到的時間點」推進——
  //   否則心跳/存檔/落點 changeMap 把錨點蓋成「現在」,結算一被中斷整段離線時間就此蒸發(2026-07-10 修)。
  function stamp() {
    if (catchingUp) return;
    stampCore(Date.now());
  }
  function stampCore(ts) {
    try {
      if (!validSlot()) return;
      // 只在「真的進到遊戲畫面」時記錄。開始選單/創角/載入前 game-screen 是 hidden,此時
      // mapState 還是模組預設的 'training'、currentSlot 又預設 1 → 在這 stamp 會把「第一隻」的
      // afk_map 蓋成 training(且只波及 slot 1),害離線結算跑錯地圖。守在這裡根治。
      var gs = document.getElementById('game-screen');
      if (!gs || gs.classList.contains('hidden')) return;
      localStorage.setItem(tsKey(), ts);
      if (typeof mapState !== 'undefined' && mapState && mapState.current) localStorage.setItem(mapKey(), mapState.current);
      // 攀登中才記攀登狀態(在第幾樓/是否排名);非攀登就清掉,避免下次登入誤判
      if (typeof state !== 'undefined' && state && state.prideClimb) {
        localStorage.setItem(prideKey(), JSON.stringify({ climb: true, ranked: !!state.prideRanked, floor: state.prideFloor || 2, startMs: state.prideStartMs || 0 }));
      } else {
        localStorage.removeItem(prideKey());
      }
      // 🏝️ 遺忘之島旅程中才記旅程狀態(島/途中);非旅程就清掉,避免下次登入誤判
      if (typeof state !== 'undefined' && state && state.oblivion) {
        localStorage.setItem(oblKey(), JSON.stringify({ phase: state.oblivion }));
      } else {
        localStorage.removeItem(oblKey());
      }
    } catch (e) {}
  }
  function raf() {
    return new Promise(function (resolve) {
      var done = false;
      var fin = function () { if (!done) { done = true; resolve(); } };
      try { requestAnimationFrame(fin); } catch (e) { /* ignore */ }
      setTimeout(fin, 50); // 後援:分頁在背景時 rAF 可能不觸發
    });
  }

  // ----- 背景節拍器(Worker)----------------------------------------------
  // 分頁切到背景時,瀏覽器把 rAF / setTimeout 嚴重降速(背景 setTimeout 最低約 1 秒)→ 補跑幾乎停住、
  // 切走就不算。用一個 Web Worker 當「不被降速的計時器」在背景催補跑繼續。只動「催下一段」這層,
  // 不碰戰鬥/存檔邏輯,結算結果與前景完全一致。
  //   - 前景(可見):仍走 rAF(順、快、與原本行為一致,零回歸)。
  //   - 背景(隱藏):走 Worker,且「算一段留一段空隙」(約 6 成工作週期=溫和),單分頁不吃滿一核、
  //     多隻角色多分頁同時背景跑也不會把 CPU 榨乾。
  //   - Worker 起不來(CSP / 本機 file://)→ 自動退回 setTimeout(最壞=跟以前一樣會被降速,不會更糟)。
  var _ticker = null, _tickerBad = false;
  function ticker() {
    if (_ticker || _tickerBad) return _ticker;
    try {
      var src = 'onmessage=function(e){setTimeout(function(){postMessage(1)},(e.data&&e.data.gap)||0)}';
      _ticker = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })));
    } catch (e) { _tickerBad = true; _ticker = null; }
    return _ticker;
  }
  function killTicker() { try { if (_ticker) _ticker.terminate(); } catch (e) {} _ticker = null; }
  function workerGap(gap) {
    return new Promise(function (resolve) {
      var w = ticker(), done = false;
      var fin = function () { if (done) return; done = true; resolve(); };
      if (!w) { setTimeout(fin, gap); return; }   // Worker 不可用 → 退回 setTimeout
      var on = function () { try { w.removeEventListener('message', on); } catch (e) {} fin(); };
      w.addEventListener('message', on);
      setTimeout(fin, gap + 2000);                 // 保險:Worker 沒回(被凍/出錯)也不會卡死
      try { w.postMessage({ gap: gap }); } catch (e) { fin(); }
    });
  }
  // 補跑每段之間的「讓出」:前景 rAF(順、快);背景 Worker 溫和節拍(續跑不卡、不榨乾 CPU)。
  function pace(sliceMs) {
    var hidden = (typeof document !== 'undefined' && document.visibilityState === 'hidden');
    if (!hidden) return raf();
    var gap = Math.max(16, Math.round((sliceMs || 60) * 0.6));   // 背景空隙≈算一段的 0.6 倍 → 約 6 成工作週期(溫和)
    return workerGap(gap);
  }

  // ----- 進度遮罩 ---------------------------------------------------------
  var overlayEl = null, overlayBar = null, overlayTxt = null, overlayFill = null;
  // 「長按放棄剩餘收益」:_holdStart=按住起始時間(0=沒按住);_abortCatchup=放棄旗標(迴圈會跳出)。
  var HOLD_MS = 1500;           // 按住這麼久才放棄
  var HOLD_SLICE_MS = 30;       // 按住期間把結算切片縮小,讓「按滿 1.5 秒就立刻停」不延遲
  var _holdStart = 0, _abortCatchup = false;
  function showOverlay(totalTicks) {
    if (overlayEl) return;
    _abortCatchup = false; _holdStart = 0;
    overlayEl = document.createElement('div');
    overlayEl.setAttribute('style', [
      'position:fixed', 'inset:0', 'z-index:99999',
      'background:rgba(2,6,23,0.92)', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'gap:16px',
      'font-family:system-ui,sans-serif', 'color:#e2e8f0'
    ].join(';'));
    var title = document.createElement('div');
    title.textContent = '離線掛機結算中…';
    title.setAttribute('style', 'font-size:20px;font-weight:bold;color:#fcd34d');
    var barWrap = document.createElement('div');
    barWrap.setAttribute('style', 'width:min(70vw,420px);height:14px;background:#1e293b;border-radius:8px;overflow:hidden;border:1px solid #334155');
    overlayBar = document.createElement('div');
    overlayBar.setAttribute('style', 'height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#86efac)');   // ⚠ 不要加 transition：補跑迴圈每 250ms 同步卡住主執行緒,寬度動畫跑不動會讓進度條看起來一直空著(踩過);直接瞬間套用寬度最準
    barWrap.appendChild(overlayBar);
    overlayTxt = document.createElement('div');
    overlayTxt.setAttribute('style', 'font-size:13px;color:#94a3b8');
    overlayTxt.textContent = '0%';
    overlayEl.appendChild(title);
    overlayEl.appendChild(barWrap);
    overlayEl.appendChild(overlayTxt);

    // 「長按放棄剩餘收益」按鈕 + 上方「放棄中」讀條。
    //   ⚠ 讀條用 transform:scaleX(走合成器/GPU 執行緒),不用 width transition——補跑會卡住主執行緒,
    //     width 動畫跑不動(空白條踩過);transform 不受主執行緒阻塞,按住時照樣順順填滿。
    var holdLabel = document.createElement('div');
    holdLabel.setAttribute('style', 'font-size:12px;color:#fca5a5;height:15px;opacity:0;transition:opacity .15s;margin-top:6px;');
    holdLabel.textContent = '放棄中…';
    var holdTrack = document.createElement('div');
    holdTrack.setAttribute('style', 'width:min(60vw,260px);height:6px;background:#3f1d1d;border-radius:4px;overflow:hidden;opacity:0;transition:opacity .15s;');
    overlayFill = document.createElement('div');
    overlayFill.setAttribute('style', 'height:100%;width:100%;background:#ef4444;transform-origin:left;transform:scaleX(0);');
    holdTrack.appendChild(overlayFill);
    var abandonBtn = document.createElement('button');
    abandonBtn.setAttribute('style', 'margin-top:4px;padding:10px 22px;font-size:14px;font-weight:bold;color:#fecaca;background:#7f1d1d;border:1px solid #b91c1c;border-radius:10px;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none;');
    abandonBtn.textContent = '長按放棄剩餘收益';
    overlayEl.appendChild(holdLabel);
    overlayEl.appendChild(holdTrack);
    overlayEl.appendChild(abandonBtn);

    function startHold(e) {
      if (e) e.preventDefault();
      if (_holdStart) return;
      _holdStart = performance.now();
      holdLabel.style.opacity = '1'; holdTrack.style.opacity = '1';
      overlayFill.style.transition = 'none'; overlayFill.style.transform = 'scaleX(0)';
      void overlayFill.offsetWidth;   // 強制重排,讓接下來的 transition 確實從 0 開始
      overlayFill.style.transition = 'transform ' + HOLD_MS + 'ms linear';
      overlayFill.style.transform = 'scaleX(1)';
    }
    function cancelHold() {
      if (!_holdStart) return;
      _holdStart = 0;
      holdLabel.style.opacity = '0'; holdTrack.style.opacity = '0';
      overlayFill.style.transition = 'transform .12s ease-out'; overlayFill.style.transform = 'scaleX(0)';
    }
    abandonBtn.addEventListener('pointerdown', startHold);
    abandonBtn.addEventListener('pointerup', cancelHold);
    abandonBtn.addEventListener('pointerleave', cancelHold);
    abandonBtn.addEventListener('pointercancel', cancelHold);

    document.body.appendChild(overlayEl);
  }
  function updateOverlay(frac, done, total) {
    if (!overlayBar) return;
    var pct = Math.min(100, Math.round(frac * 100));
    overlayBar.style.width = pct + '%';
    overlayTxt.textContent = pct + '%　已結算 ' + fmtCatchupTime(done) + ' / 共 ' + fmtCatchupTime(total);
  }
  function removeOverlay() {
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = overlayBar = overlayTxt = overlayFill = null;
    _holdStart = 0;   // _abortCatchup 留給摘要判斷,下次 showOverlay 才重置
  }

  // ----- 收益快照 / 摘要 --------------------------------------------------
  function snapshot() {
    var inv = {};
    try { (player.inv || []).forEach(function (i) { if (i && i.id) inv[i.id] = (inv[i.id] || 0) + (i.cnt || 1); }); } catch (e) {}
    return { gold: player.gold || 0, exp: player.exp || 0, lv: player.lv || 0, inv: inv };
  }
  function fmt(n) { try { return (n || 0).toLocaleString(); } catch (e) { return '' + n; } }
  // 軍王之室:背包現有「軍王的鑰匙」總數(供離線摘要算消耗了幾把)
  function countKingKeys() {
    try { return (player.inv || []).reduce(function (s, i) { return s + ((i && i.id === 'item_king_key') ? (i.cnt || 1) : 0); }, 0); }
    catch (e) { return 0; }
  }

  // ----- 📜 離線掛機歷史紀錄(只寫自己的 afk_hist_<slot>,絕不呼叫 saveGame、不碰原作者存檔) ----
  var HIST_PREFIX = 'afk_hist_';
  var HIST_MAX    = 5;                          // 每個角色最多保留最近幾筆(同一個 key 一個陣列)
  function histKey() { return HIST_PREFIX + currentSlot; }
  // 背包前後差 → [{n,cnt,c}](c=品階顏色 class,取 DB.items[id].c 基底色);依數量多→少排序(顯示用)
  function invDeltaList(before, after) {
    var ids = {}, out = [];
    for (var k in before.inv) ids[k] = 1;
    for (var k2 in after.inv) ids[k2] = 1;
    for (var id in ids) {
      var d = (after.inv[id] || 0) - (before.inv[id] || 0);
      if (d > 0) {
        var dd = (typeof DB !== 'undefined' && DB.items && DB.items[id]) ? DB.items[id] : null;
        out.push({ n: dd ? dd.n : id, cnt: d, c: dd ? (dd.c || '') : '' });
      }
    }
    out.sort(function (a, b) { return b.cnt - a.cnt; });
    return out;
  }
  // ⚠ 唯一寫入點:把一筆紀錄寫進 afk_hist_<slot> 陣列、截到上限。純 localStorage.setItem,不動玩家存檔、不 saveGame。
  //   同 closeTs 覆寫(upsert):檢查點期間反覆更新「進行中」的同一筆、結算完成時覆寫成最終版,
  //   同一段離線不會拆成多筆、中斷也不會漏記。
  function recordHistory(rec) {
    try {
      if (!validSlot()) return;
      var arr = [];
      try { var raw = localStorage.getItem(histKey()); if (raw) arr = JSON.parse(raw) || []; } catch (e) { arr = []; }
      if (!Array.isArray(arr)) arr = [];
      var hit = -1;
      for (var j = 0; j < arr.length; j++) { if (arr[j] && arr[j].closeTs === rec.closeTs) { hit = j; break; } }
      if (hit >= 0) arr[hit] = rec; else arr.unshift(rec);
      if (arr.length > HIST_MAX) arr = arr.slice(0, HIST_MAX);
      localStorage.setItem(histKey(), JSON.stringify(arr));
    } catch (e) { console.warn('[AFK] recordHistory error:', e); }
  }
  // 地圖 id → 顯示名稱(查原作者的 MAP_CATEGORIES);查不到就回 id 本身
  // 地圖 id → 中文名：統一委派 afk-extradata 共用解析(離線收益摘要 + 選角掛機地點 afk-slotinfo 委派此函式都走這份)。
  //   本檔(核心)比外掛 afk-extradata 早載入,但本函式在「執行期」才被呼叫,屆時 AFK_EXTRA 已就緒;缺了則退回 id。
  function mapName(id) { try { return (window.AFK_EXTRA && AFK_EXTRA.mapName) ? AFK_EXTRA.mapName(id) : (id || '?'); } catch (e) { return id || '?'; } }
  // 略過離線結算時,在系統日誌講一句白話原因(先前只寫 console,玩家只看到「載入很快、什麼都沒有」,無從判斷;2026-07-10 加)
  function skipNote(msg) {
    try { if (typeof logSys === 'function') logSys('<span class="text-slate-400">🌙 ' + msg + '</span>'); } catch (e) {}
  }
  // 累積總經驗(等級已過的各級需求總和 + 目前這級經驗)。player.exp 是「當級經驗」升級會歸零,
  // 直接相減在升級時會變負;改用累積值相減才正確(getExpReq=每級所需經驗,核心遊戲全域函式)。
  function expTotal(lv, exp) {
    var t = exp || 0;
    if (typeof getExpReq === 'function') {
      for (var i = 1; i < (lv || 1); i++) { var r = getExpReq(i); if (!isFinite(r)) break; t += r; }
    }
    return t;
  }
  // 攀登:把某一樓的 before→after 快照差,整理成 { floor, exp, gold, lv, items } 一行用
  function climbSegDelta(floor, b, a) {
    var exp = expTotal(a.lv, a.exp) - expTotal(b.lv, b.exp); if (exp < 0) exp = 0;
    var items = [], ids = {};
    for (var k in b.inv) ids[k] = 1; for (var k2 in a.inv) ids[k2] = 1;
    for (var id in ids) { var d = (a.inv[id] || 0) - (b.inv[id] || 0); if (d > 0) items.push({ n: (typeof DB !== 'undefined' && DB.items && DB.items[id]) ? DB.items[id].n : id, d: d }); }
    items.sort(function (x, y) { return y.d - x.d; });
    return { floor: floor, exp: exp, gold: (a.gold || 0) - (b.gold || 0), lv: (a.lv || 0) - (b.lv || 0), items: items };
  }
  // 攀登專屬的離線摘要:逐層列出收益(一層一行),樓層用中文。沒有任何收益的樓層省略不列。
  function summarizeClimb(segs, doneTicks, died) {
    var mins = Math.round(doneTicks * TICK_MS / 60000);
    var timeStr = mins < 60 ? (mins + ' 分鐘') : (Math.floor(mins / 60) + ' 小時' + (mins % 60 ? ' ' + (mins % 60) + ' 分鐘' : ''));
    var reached = segs.length ? segs[segs.length - 1].floor : (segs[0] ? segs[0].floor : 0);
    var fromFloor = segs.length ? segs[0].floor : 0;
    var head = `<span class="text-sky-300 font-bold">🌙 離線攀登傲慢之塔 ${timeStr}</span>（${fromFloor} 樓 → ${reached} 樓）：`;
    try { logSys(head); } catch (e) { console.log('[AFK]', head.replace(/<[^>]+>/g, '')); }
    var shown = 0;
    segs.forEach(function (s) {
      var parts = [];
      if (s.gold > 0) parts.push(`<span class="text-yellow-400 font-bold">${fmt(s.gold)} 金幣</span>`);
      if (s.lv   > 0) parts.push(`<span class="text-green-400 font-bold">升 ${s.lv} 級</span>`);
      if (s.exp  > 0) parts.push(`<span class="text-purple-400 font-bold">${fmt(s.exp)} 經驗</span>`);
      if (s.items.length) parts.push(s.items.map(function (it) { return it.n + '×' + it.d; }).join('、'));
      if (!parts.length) return;   // 該樓沒收益就省略
      shown++;
      var ln = `<span class="text-rose-200">傲慢之塔 ${s.floor} 樓</span>：` + parts.join('、') + '。';
      try { logSys(ln); } catch (e) { console.log('[AFK]', ln.replace(/<[^>]+>/g, '')); }
    });
    if (!shown) { try { logSys('（本次攀登無明顯收益）'); } catch (e) {} }
    if (died) { try { logSys('<span class="text-red-500 font-bold">離線攀登中陣亡，已結算至死亡前並送回村莊。</span>'); } catch (e) {} }
  }
  function summarize(before, after, doneTicks, died, huntMap, kingInfo) {
    var mins = Math.round(doneTicks * TICK_MS / 60000);
    var dGold = (after.gold || 0) - (before.gold || 0);
    var dExp  = expTotal(after.lv, after.exp) - expTotal(before.lv, before.exp);
    if (dExp < 0) dExp = 0;   // 保險:經驗只增不減,理論上不會 < 0
    var dLv   = (after.lv   || 0) - (before.lv   || 0);
    var items = [];
    var ids = {};
    for (var k in before.inv) ids[k] = 1;
    for (var k2 in after.inv) ids[k2] = 1;
    for (var id in ids) {
      var delta = (after.inv[id] || 0) - (before.inv[id] || 0);
      if (delta > 0) {
        var nm = (typeof DB !== 'undefined' && DB.items && DB.items[id]) ? DB.items[id].n : id;
        items.push({ n: nm, d: delta });
      }
    }
    items.sort(function (a, b) { return b.d - a.d; });
    var itemStr = items.map(function (it) { return it.n + '×' + it.d; }).join('、');

    window.__afk.last = { mins: mins, gold: dGold, exp: dExp, lv: dLv, died: !!died, ticks: doneTicks, items: items.length };

    var timeStr = mins < 60 ? (mins + ' 分鐘')
                : (Math.floor(mins / 60) + ' 小時' + (mins % 60 ? ' ' + (mins % 60) + ' 分鐘' : ''));   // ≥60 分進位成「X 小時 Y 分鐘」
    var line = `<span class="text-sky-300 font-bold">🌙 離線掛機 ${timeStr}</span>（在 <b>${mapName(huntMap)}</b>），獲得：`;
    var parts = [];
    if (dGold > 0) parts.push(`<span class="text-yellow-400 font-bold">${fmt(dGold)} 金幣</span>`);
    if (dLv   > 0) parts.push(`<span class="text-green-400 font-bold">升 ${dLv} 級</span>`);
    if (dExp  > 0) parts.push(`<span class="text-purple-400 font-bold">${fmt(dExp)} 經驗</span>`);
    if (itemStr)   parts.push(itemStr);
    line += parts.length ? parts.join('、') : '（無明顯收益）';
    line += '。';
    try { logSys(line); } catch (e) { console.log('[AFK]', line.replace(/<[^>]+>/g, '')); }
    // ⚔ 軍王之室:附帶「擊敗輪數 / 消耗鑰匙」;若因鑰匙用完被傳回村,多一行提示
    if (kingInfo && kingInfo.kills > 0) {
      var kl = `<span class="text-amber-300">⚔ 軍王之室：本次擊敗軍王 <b>${kingInfo.kills}</b> 輪`
        + (kingInfo.keysUsed > 0 ? `，消耗 <b>${kingInfo.keysUsed}</b> 把軍王的鑰匙` : ``) + `。</span>`;
      try { logSys(kl); } catch (e) { console.log('[AFK]', kl.replace(/<[^>]+>/g, '')); }
    }
    if (kingInfo && kingInfo.depleted) {
      try { logSys('<span class="text-amber-300 font-bold">🔑 軍王的鑰匙已用完，已自動傳回村莊。</span>'); }
      catch (e) { console.log('[AFK] 軍王的鑰匙已用完，已自動傳回村莊。'); }
    }
    // 平均效率(對齊遊戲「本圖效率統計」的 經驗/10分、金幣/10分):用實際補跑時間換算
    var preciseMin = doneTicks * TICK_MS / 60000;
    if (preciseMin > 0 && (dExp > 0 || dGold > 0)) {
      var exp10 = Math.floor(dExp / preciseMin * 10);
      var gold10 = Math.floor(dGold / preciseMin * 10);
      try { logSys(`<span class="text-amber-300">📊 平均效率：經驗 ${fmt(exp10)} / 10分、金幣 ${fmt(gold10)} / 10分</span>`); }
      catch (e) { console.log('[AFK] 平均效率: 經驗 ' + exp10 + '/10分, 金幣 ' + gold10 + '/10分'); }
    }
    if (died) {
      try { logSys('<span class="text-red-500 font-bold">離線期間角色陣亡，進度已結算至死亡前。</span>'); }
      catch (e) { console.log('[AFK] 離線期間陣亡，結算至死亡前。'); }
    }
  }

  // 切換地圖(關閉 ff 下的 log,switchMap 內部 logSys 會被靜音)
  function gotoMap(mapKey) {
    try {
      if (typeof setMapSelectors === 'function') setMapSelectors(mapKey);
      var sel = document.getElementById('map-select');
      if (sel) {
        // 🏛️ 通用支援「非選單地圖」(隱藏狩獵區域等只在 DB.maps、不在地圖選單的房間圖):選單沒有就臨時補一個 option,
        //    changeMap(true) 才讀得到值進得去(等同 enterHiddenArea 的通用化)。免為每張新隱藏圖各寫特例。
        //    註:真正「有旅程進度」的攀登/遺忘之島仍走各自的 enterPrideFloor/enterOblivionMap(要還原狀態),不適用此通用路。
        if (!Array.prototype.some.call(sel.options, function (o) { return o.value === mapKey; })) {
          var o = document.createElement('option'); o.value = mapKey;
          o.textContent = (typeof mapName === 'function' ? mapName(mapKey) : mapKey);
          sel.appendChild(o);
        }
        sel.value = mapKey;
      }
      if (typeof changeMap === 'function') changeMap(true);
    } catch (e) { console.warn('[AFK] gotoMap(' + mapKey + ') 失敗:', e); }
  }
  function homeTown() {
    try { return (typeof getHomeTown === 'function') ? getHomeTown() : 'town_silver_knight'; }
    catch (e) { return 'town_silver_knight'; }
  }

  // ----- 離線補跑(時間切片) ----------------------------------------------
  var catchingUp = false;
  var killTally = null;   // 📜 非 null 時(只在補跑中)累計各怪擊殺數 {怪名:次數};線上遊玩為 null → killMob 的計數判斷零開銷
  var gainTally = null;   // ⚡ 非 null 時(只在補跑中)累計各物品獲得數 {物品id:數量};供快速結算把「淨變化」還原成「真實消耗」(消耗=期初+獲得−期末)
  var _forceNoFast = false;   // 🧪 debug:forceCatchup(mins, true) 可強制全模擬(A/B 比對快速結算保真度用)
  async function runCatchup(totalTicks, withOverlay, huntMap, prePride, preObl, timing) {
    if (catchingUp) return;
    catchingUp = true;
    killTally = {};   // 📜 本次補跑的擊殺計數歸零
    gainTally = {};   // ⚡ 本次補跑的獲得計數歸零
    window.__afkKillTally = killTally;   // 核心 killMob/gainItem 在結算期間經這兩個計數(平時 null → 零開銷)
    window.__afkGainTally = gainTally;
    var prevFf0, prevInTick0;   // 先宣告在 try 外:例外時 finally 才有得還原
    try {   // 🛡️ 全程包死:任何一步丟例外都不可讓 catchingUp 卡在 true——否則同頁面之後所有角色載入都會靜默跳過結算(2026-07-10 修)

    // 🎯 魔物追蹤:until 是牆鐘時間,離線中過期的話補跑時 spawnMob 的「until > Date.now()」整段不成立
    //   → 明明關遊戲時追蹤還有效,離線收益卻完全吃不到追蹤。使用者決定(2026-07-07):離線當下追蹤仍有效
    //   → 整段離線時間都視為有效——補跑期間暫時把 until 撐到結算之後,結束時還原原值
    //   (過期的照樣過期、沒過期的剩餘時數不變,線上行為零影響)。
    //   offStart=離線起點:真實離線用心跳 closeTs;debug forceCatchup 無 timing → 視同「剛剛過去 totalTicks」。
    var offStart = (timing && timing.closeTs) || (Date.now() - totalTicks * TICK_MS);
    var trackUntil0 = null;
    if (player.tracking && player.tracking.until && player.tracking.until > offStart) {
      trackUntil0 = player.tracking.until;
      player.tracking.until = Date.now() + totalTicks * TICK_MS + 3600000;   // 撐過整段補跑(含結算本身的真實耗時)綽綽有餘
    }

    var sliceMs = sliceFor(totalTicks);   // 依補跑長短決定畫面更新間隔:短→順、長→快
    var isClimb = !!(prePride && prePride.climb && !prePride.ranked && typeof enterPrideFloor === 'function');   // 排名挑戰不自動續
    var isObl = !isClimb && !!(preObl && preObl.phase && typeof enterOblivionMap === 'function');   // 🏝️ 遺忘之島旅程:同攀登,還原 state.oblivion 後用 enterOblivionMap 進場(島地圖非選單地圖)
    // ⚔ 軍王之室:選單地圖,走通用 gotoMap 即可重進;補跑時數「擊敗輪數/消耗鑰匙/是否因鑰匙用完被傳回村」供摘要顯示
    var isKing = !isClimb && !isObl && (typeof KING_ROOMS !== 'undefined') && !!KING_ROOMS[huntMap];
    var kingKeysBefore = isKing ? countKingKeys() : 0;
    var kingLeftRoom = false;   // 補跑期間因鑰匙用完被原作傳回村(離開了軍王之室)

    // 暫停 live loop,避免結算期間與主迴圈交錯;結算後再以全新計時重啟
    try { if (typeof _gameLoopId !== 'undefined' && _gameLoopId !== null) { clearInterval(_gameLoopId); _gameLoopId = null; } } catch (e) {}

    prevFf0 = state.ff; prevInTick0 = state.inTick;
    state.ff = true; state.inTick = true;        // 先靜音,再切到關閉時所在的位置
    if (isClimb) {
      // 攀登:還原原作不存檔的攀登旗標,用 enterPrideFloor 進場(ff=true 故不碰 DOM);補跑期間照常爬樓/撞死即停
      state.prideClimb = true;
      state.prideRanked = !!prePride.ranked;
      state.prideFloor = prePride.floor || 2;
      if (prePride.startMs) state.prideStartMs = prePride.startMs;
      enterPrideFloor(state.prideFloor);
    } else if (isObl) {
      // 遺忘之島:還原原作不存檔的旅程旗標,用 enterOblivionMap 進場(ff=true 故不碰 DOM)。
      // 補跑期間「途中擊敗傳送門→進本島」由原作 settleDeadMobs 內的 state._oblivionAdvance 流程自動處理。
      state.oblivion = preObl.phase;
      state._oblivionAdvance = false;
      enterOblivionMap(huntMap);
    } else {
      gotoMap(huntMap);
    }

    var before = snapshot();
    if (withOverlay) showOverlay(totalTicks);

    // 攀登:逐層記錄收益。segStart=本層起始快照、segFloor=本層樓層;偵測 state.prideFloor 變動(往上爬或結束)就封一段。
    var climbSegs = isClimb ? [] : null;
    var segStart = isClimb ? before : null;
    var segFloor = isClimb ? (state.prideFloor || 2) : 0;

    // ═══ ⚡ 混合快速結算(2026-07-06 上線;2026-07-10 改「事件驅動」,使用者核可) ═══════
    // 長離線先「真模擬取樣」量出平均殺速與安全度;夠安全就把剩餘時間改成「事件驅動逐殺」:
    //   出怪走核心 maybeSpawnMobs()(js/03 與 tick() 同一份排程——出怪延遲/長老之室 BOSS 節流/
    //   後排格/席琳與日光加速全部照原作生效,時間直接跳到「下一隻出怪/殺完這隻」的事件點),
    //   殺怪走 killMob → settleDeadMobs 真實獎勵管線——掉落表擲骰/經驗/升級/任務/卡片/收集冊/
    //   誘捕/傭兵經驗一律照真;只有「殺一隻的純戰鬥耗時(svcPerKill)」與「消耗品每拍耗率」是取樣平均。
    //   (2026-07-08 曾實測舊寫法「spawnMob(0) 連續出怪」在長老之室這類節流圖收益偏高 ~13%,
    //    事件驅動重用真實排程+真實場面佔位後,節流自然生效,結構上不再分歧。)
    // 一律退回全模擬的情況:特殊地圖(攀登/遺忘之島「途中」/軍王之室,由 fastEligible 排除;
    //   遺忘之島「本島」是無限刷怪圖 → 2026-07-10 起納入快速)、取樣最低血量過低
    //   (可能會死→維持撞死即停的忠實性)、殺太少(樣本不可信)、消耗品斷貨且自動購買補不上(戰局質變)。
    // 升級 → 戰力變了殺速會變 → 退回真模擬重新取樣。HP/MP 軌跡不用模擬:結算存活本就補滿(見下方落點)。
    var FAST_SAMPLE_TICKS = 3000;     // 首次取樣:5 分鐘(3000 拍)
    var FAST_RESAMPLE_TICKS = 1200;   // 升級後重取樣:2 分鐘
    var FAST_MIN_KILLS = 8;           // 取樣至少殺 8 隻,平均殺速才勉強可信(低於此→延長,仍不足→全模擬)
    var FAST_GOOD_KILLS = 60;         // 樣本殺數低於此 → 平均殺速統計誤差偏大(~±13%),延長取樣一次收斂
    var FAST_MIN_HP_PCT = 70;         // 血量安全門檻起點 %(取樣 + BOSS safe 共用):真模擬 done=0 時的門檻
    var HP_FLOOR_ZERO_TICKS = 12000;  // 血量門檻「線性降到 0」的時點:真模擬連續存活滿 20 分鐘(12000 拍)沒死 → 門檻歸 0(之後一律切快速、BOSS 一律 safe)。撐過這段=打得過→完全信任;死了外層撞死即停,根本走不到門檻歸 0。
    var FAST_MIN_REMAIN = 6000;       // 取樣後剩不到 10 分鐘 → 全模擬本來就快,不值得切
    // 🏝️ 遺忘之島「本島」納入快速(2026-07-10 使用者提議):本島=無限刷怪圖、無後續推進,與一般圖同等待遇;
    //   「途中」(travel)維持全模擬——它是「打倒傳送門 BOSS 才進本島」的過場,怪組與本島不同、取樣不能混用。
    var fastEligible = !isClimb && !isKing && (!isObl || (preObl && preObl.phase === 'island'))
      && totalTicks >= (FAST_SAMPLE_TICKS + FAST_MIN_REMAIN) && !_forceNoFast;
    _forceNoFast = false;   // 🧪 一次性:用過即歸零,不影響之後的真實離線結算
    var fastMode = false, fastOff = false;   // fastOff = 本次補跑永久退出快速段
    // 血量安全門檻(取樣 + BOSS safe 共用):隨真模擬存活拍數 done 從 70% 線性降到 0(20 分鐘歸 0)。
    //   即時用 done 算,故取樣評估、BOSS safe 判定各自用「當下」的門檻;越撐越信任,撐滿 20 分鐘完全放行。
    function hpFloorNow() { return Math.max(0, (FAST_MIN_HP_PCT / 100) * (1 - done / HP_FLOOR_ZERO_TICKS)); }
    // 🐲 BOSS 策略(懶驗證):每「種」BOSS(按名字)第一次遇到 → 逐拍真模擬打到倒下,記錄實際耗時與安全度;
    //   之後同名 BOSS:安全的 → 即殺但時間按「該 BOSS 實測耗時」推進(不是小怪均速);對打時血量掉太深的 → 每次都真打。
    //   打輸=外層撞死即停;打不動=照實耗完時間。純 BOSS 圖因此自然接近全真模擬。
    var fastBossUid = null, fastBossName = '', fastBossStart = 0, fastBossMinHp = 1, fastBossKills0 = 0;
    var BOSS_REVERIFY_P = 0.05;   // 🐲 抽驗:每 ~20 隻「已驗證安全」的同名 BOSS 抽 1 隻真打,實測耗時/同場小怪數做移動平均——單一首打樣本變異極大(同隻 BOSS 兩輪量到 27 vs 316 拍),外推整晚會嚴重失真
    var bossStats = {};   // {怪名: {ticks:實測耗時(移動平均), safe:對打全程血量未低於安全線, minor:對戰期間同場被清掉的小怪數(移動平均)}}
    // ⚡ 批次擊殺模型:AOE 角色一次法術同時清多隻,「一次殺一隻、每殺推進一次」的串行模型會把清場速度壓低、
    //   出怪跟不上 → 高吞吐圖(龍之谷/火龍窟)收益偏低 30~40%(2026-07-10 真實存檔實測)。改成取樣量「死亡事件」:
    //   svcPerEvent=平均每次死亡事件的純戰鬥拍數(場上有怪的拍數÷死亡事件數)、batchPerEvent=平均每次事件同時死幾隻;
    //   快速段一個事件殺一批、推進一個事件間隔。單體角色 batch≈1,行為同舊;AOE 角色 batch>1,清場速度跟上真實。
    var svcPerEvent = 0, batchPerEvent = 1, busyTicks = 0, deathEvents = 0, _prevKillSum = 0;
    var consumePerTick = null, consumeAcc = null, buffSecAcc = 0;
    var sampleFrom = 0, sampleKills0 = 0, sampleBusy0 = 0, sampleEvents0 = 0, sampleCnt0 = null, sampleGain0 = null, sampleMinHp = 1;
    var sampleEnd = fastEligible ? FAST_SAMPLE_TICKS : Infinity, sampleGrew = false;
    var lastLv = player.lv;
    var _junkEvery = (typeof JUNK_AUTOSELL_TICKS !== 'undefined') ? JUNK_AUTOSELL_TICKS : 100;

    // ═══ 💾 結算統計快取(2026-07-10,使用者核可) ═══════════════════════════════
    // 結算量到的統計(殺速/每種 BOSS 實測/消耗率)存進存檔(player._offStats)帶簽章;下次同簽章
    // 直接進快速段 → 跳過 5 分鐘取樣與每種 BOSS 首打,同圖同實力的每日結算恆定秒級。
    // 簽章=引擎版+地圖+等級+世界模式(席琳/瘋狂/經典/傳統)+全裝備(id+強化) → 任一變動即失效重取樣;
    // 另設 72h 時效(防遊戲平衡改版後舊統計久留);撞死時清除(這套統計不可信)。
    var OFFSTATS_MAX_AGE_MS = 72 * 3600 * 1000;
    function offStatsSig() {
      var eq = [];
      try { for (var k in player.eq) { var e = player.eq[k]; if (e && e.id) eq.push(k + ':' + e.id + ':' + (e.en || 0)); } } catch (e) {}
      eq.sort();
      return ['v1', mapState.current, player.lv, player.sherineWorld ? 1 : 0, player.sherineMad ? 1 : 0,
        player.classicMode ? 1 : 0, player.traditionalMode ? 1 : 0, eq.join(',')].join('|');
    }
    function saveOffStats() {   // 量到新統計就更新快取(隨檢查點/結算尾的 saveGame 固化進存檔)
      try {
        if (!(svcPerEvent > 0)) return;
        player._offStats = { v: 1, sig: offStatsSig(), svcE: svcPerEvent, batch: batchPerEvent, consume: consumePerTick || {}, boss: bossStats, savedAt: Date.now() };
      } catch (e) {}
    }
    // ═══ 結算統計快取(宣告結束) ═══════════════════════════════════════════════

    function invCntMap() {   // 全部持有量(背包+裝備欄,箭矢掛在 eq.arrow 的 cnt 上)
      var m = {};
      try {
        (player.inv || []).forEach(function (i) { if (i && i.id) m[i.id] = (m[i.id] || 0) + (i.cnt || 1); });
        for (var k in player.eq) { var e = player.eq[k]; if (e && e.id && e.cnt) m[e.id] = (m[e.id] || 0) + e.cnt; }
      } catch (e) {}
      return m;
    }
    function tallySum(t) { var s = 0; for (var k in t) s += t[k]; return s; }
    function beginSample(from) {
      sampleFrom = from; sampleKills0 = tallySum(killTally); sampleBusy0 = busyTicks; sampleEvents0 = deathEvents; sampleCnt0 = invCntMap();
      _prevKillSum = sampleKills0;
      sampleGain0 = {}; for (var k in gainTally) sampleGain0[k] = gainTally[k];
      sampleMinHp = 1;
    }
    function evalSample() {   // 取樣窗結束:夠安全 → 進快速段;殺數不足 → 延長一次;血量沒過(隨時間下降的)門檻 → 繼續真模擬觀察
      var kills = tallySum(killTally) - sampleKills0;
      // 血量門檻隨真模擬存活拍數線性下降(hpFloorNow,70% → 20 分鐘歸 0):穩定低血但打不死的角色(吸血流卡低檔)
      //   撐越久門檻越低,最晚 20 分鐘門檻歸 0 必過 → 不會整晚全模擬。done 在「尚未切快速」期間就等於真模擬存活拍數;
      //   角色若真的會被磨死,取樣期間就死了、外層撞死即停,根本走不到這裡評估。
      if (sampleMinHp < hpFloorNow()) { sampleGrew = false; beginSample(done); sampleEnd = done + FAST_SAMPLE_TICKS; return; }   // 沒過→再真模擬一段(那時門檻更低),直到過關或時間耗盡
      if (kills < FAST_GOOD_KILLS && !sampleGrew) { sampleGrew = true; sampleEnd = done + FAST_SAMPLE_TICKS * 2; return; }   // 殺數不足以收斂平均殺速 → 延長取樣(再 +10 分鐘)
      if (kills < FAST_MIN_KILLS) {
        fastOff = true; console.info('[AFK] 快速結算不啟用:取樣擊殺數太少(' + kills + '),樣本不可信,全程真模擬。'); return;
      }
      var winTicks = Math.max(1, done - sampleFrom);
      // ⚡ 事件驅動:只取「純戰鬥」拍數(場上有怪的拍),出怪等待交給真實排程推進——
      //   否則等待時間被算進殺速、事件迴圈又再等一次出怪 → 雙重計時、收益偏低。
      var evs = Math.max(1, deathEvents - sampleEvents0);
      svcPerEvent = Math.max(1, (busyTicks - sampleBusy0) / evs);
      batchPerEvent = Math.max(1, kills / evs);
      var cnt1 = invCntMap(), ids = {}, k;
      for (k in sampleCnt0) ids[k] = 1;
      for (k in cnt1) ids[k] = 1;
      consumePerTick = {}; consumeAcc = {};
      for (k in ids) {
        var d = DB.items[k]; if (!d) continue;
        // 只認消耗品(藥水/卷軸/箭/肉):避免把「掉落的裝備被自動賣廢品」誤判成消耗
        if (!(d.type === 'pot' || d.type === 'scroll' || d.isArrow || k === 'new_item_143')) continue;
        var used = (sampleCnt0[k] || 0) + ((gainTally[k] || 0) - (sampleGain0[k] || 0)) - (cnt1[k] || 0);
        if (used > 0) consumePerTick[k] = used / winTicks;   // 每「拍」速率:消耗跟時間走(BOSS 一場耗時長、耗得多,按殺算會低估)
      }
      fastMode = true;
      saveOffStats();   // 💾 新量到的殺速/消耗率 → 更新統計快取
      console.info('[AFK] ⚡ 快速結算啟動(事件驅動):每事件 ' + svcPerEvent.toFixed(1) + ' 拍、同時死 ' + batchPerEvent.toFixed(2) + ' 隻,每拍消耗 ' + JSON.stringify(consumePerTick));
    }
    // 🧪 線上會被 autoActions 自動續期的 buff(勾選的藥水/卷軸增益+勾選自動施放的技能 buff):
    //   快速段不跑 autoActions,這些 buff 的秒數若自然歸零就沒人續 → 加速類一掉,出怪延遲從 ~20 拍變 ~33 拍,
    //   spawn-limited 圖收益被砍 2~3 成(2026-07-10 真實存檔實測龍之谷 -24% 的主因)。
    //   解法:快速段把「有勾自動維持」的 buff 秒數扣到 1 就停住(視同線上持續續期);藥水消耗量本就由
    //   consumePerTick(取樣的每拍耗率)扣帳,不會少扣錢/藥。
    var _maintainedBuffs = null;
    function maintainedBuffSet() {
      var s = {};
      try {
        [['set-haste', 'haste'], ['set-brave', 'brave'], ['set-blue', 'blue'], ['set-cautious', 'cautious'],
         ['set-elfcookie', 'elfcookie'], ['set-poly', 'poly'], ['set-magicbarrier', 'sk_magic_shield']].forEach(function (c) {
          var el = document.getElementById(c[0]); if (el && el.checked) s[c[1]] = 1;
        });
        (player.skills || []).forEach(function (sid) {
          var chk = document.getElementById('auto-sk-' + sid); if (chk && chk.checked) s[sid] = 1;
        });
      } catch (e) {}
      return s;
    }
    function fastRefill(id) {   // 斷貨 → 比照原作 autoActions / 外掛 autobuy 的自動購買;補不了 → false(退回全模擬)
      try {
        var on = function (cid) { var el = document.getElementById(cid); return !!(el && el.checked); };
        var potSel = document.getElementById('set-pot');
        if (potSel && potSel.value === id && on('set-auto-buy-pot')) {   // 治癒藥水:自動補貨 100 瓶(同 autoActions)
          var unit = shopPrice(DB.items[id].p);
          if (player.gold >= 100 * unit) { player.gold -= 100 * unit; gainItem(id, 100, true, true); return true; }
          return false;
        }
        var buyChk = { potion_haste: 'set-auto-buy-haste', potion_brave: 'set-auto-buy-brave', potion_blue: 'set-auto-buy-blue', new_item_140: 'set-auto-buy-cautious', new_item_139: 'set-auto-buy-elfcookie', scroll_poly: 'set-auto-buy-poly', scroll_teleport: 'set-auto-buy-teleport' }[id];
        if (buyChk && on(buyChk)) {   // 增益藥水/卷軸:買 1 瓶(同 autoActions)
          var p = shopPrice(DB.items[id].p);
          if (player.gold >= p) { player.gold -= p; gainItem(id, 1, true, true); return true; }
          return false;
        }
        if (typeof window.__afkAutobuyCheck === 'function') {   // 肉/魔法屏障卷軸:外掛 autobuy(玩家有開才會補)
          window.__afkAutobuyCheck();
          for (var i = 0; i < player.inv.length; i++) if (player.inv[i] && player.inv[i].id === id) return true;
        }
      } catch (e) {}
      return false;
    }
    function fastConsumeOne(id) {   // 消耗 1 個;箭矢直接走原作 consumeArrow(自動換裝/自動買箭/沙哈之箭不扣,行為 1:1)
      try {
        var d = DB.items[id] || {};
        if (d.isArrow) return (typeof consumeArrow === 'function') ? consumeArrow() !== null : false;
        var idx = -1, i;
        for (i = 0; i < player.inv.length; i++) if (player.inv[i] && player.inv[i].id === id) { idx = i; break; }
        if (idx < 0) {
          if (!fastRefill(id)) return false;
          for (i = 0; i < player.inv.length; i++) if (player.inv[i] && player.inv[i].id === id) { idx = i; break; }
          if (idx < 0) return false;
        }
        var it = player.inv[idx];
        if ((it.cnt || 1) > 1) it.cnt = (it.cnt || 1) - 1; else player.inv.splice(idx, 1);
        return true;
      } catch (e) { return false; }
    }
    function fastAdvance(adv) {   // 推進虛擬時間 adv 拍:done / state.ticks / 消耗品(每拍速率) / 自動賣廢品;回 false = 消耗品斷貨補不上
      done += adv; if (done > totalTicks) done = totalTicks;
      state.ticks += Math.round(adv);   // 絕對拍計數跟上(召喚/buff 的 endTick、賣廢品排程都依此)
      // ⏳ 玩家 buff 是「秒數」計時、只在 tick() 每秒遞減 → 快速段不跑 tick() 會凍結。
      //   凍結的後果:召喚物依絕對 endTick 在快速段照樣到期消失,但召喚 buff 的秒數還是正的
      //   → 回線上後自動施放判定「buff 還在」不重新召喚,精靈就這樣不見(2026-07-07 玩家回報,妖精強力屬性精靈)。
      //   同步扣秒讓 buff 跟時間走:歸零後回線上第一輪 autoActions 即自動重施(含重新召喚),與在線掛機行為一致。
      buffSecAcc += adv / 10;
      var _secs = Math.floor(buffSecAcc);
      if (_secs > 0 && player && player.buffs) {
        buffSecAcc -= _secs;
        if (_maintainedBuffs == null) _maintainedBuffs = maintainedBuffSet();   // 每次結算建一次(設定在結算期間不變)
        var _ended = false;
        for (var bk in player.buffs) {
          if (player.buffs[bk] > 0) {
            if (_maintainedBuffs[bk]) { player.buffs[bk] = Math.max(1, player.buffs[bk] - _secs); continue; }   // 🧪 線上會自動續期的 buff → 扣到 1 停住不歸零(見 maintainedBuffSet 註解)
            player.buffs[bk] -= _secs;
            if (player.buffs[bk] <= 0) { player.buffs[bk] = 0; _ended = true; }
          }
        }
        if (_ended) { try { calcStats(); } catch (e) {} }   // 到期重算(比照 tick() 的 _buffEnded → calcStats)
      }
      for (var id in consumePerTick) {   // 消耗品照取樣「每拍」速率扣;斷貨且補不上 → 戰局質變,退回全模擬
        consumeAcc[id] = (consumeAcc[id] || 0) + consumePerTick[id] * adv;
        while (consumeAcc[id] >= 1) { consumeAcc[id] -= 1; if (!fastConsumeOne(id)) return false; }
      }
      try {   // 自動賣廢品:照原作 tick 的排程(state._junkSellAt,每 100 拍),避免 24h 掉落塞爆背包/超重
        if (state._junkSellAt == null) state._junkSellAt = state.ticks + _junkEvery;
        if (state.ticks >= state._junkSellAt) {
          if (typeof autoSellJunk === 'function' && (!player || player.autoSellOn !== false)) autoSellJunk();
          state._junkSellAt = state.ticks + _junkEvery;
        }
      } catch (e) {}
      return true;
    }
    function fastTeleportAwayBoss(m) {   // 🌀 快速段模擬「遇 BOSS 自動瞬移逃離」:1:1 重放線上 autoActions 的瞬移分支;成功甩掉回 true
      try {
        var tChk = document.getElementById('set-teleport');
        if (!(tChk && tChk.checked)) return false;                                   // 未勾選自動瞬移 → 照打
        if (!m || !m.boss || m.noAutoTeleport) return false;                         // 非 BOSS、或 noAutoTeleport(卡瑞/樓梯/傳送門)→ 不瞬移
        // 頂層條件照 autoActions(js/07):攻城區/純BOSS房 BOSS 即目標不逃;攀登/時空裂痕本就不走快速段;
        // 遺忘之島本島雖走快速段,但島上禁傳送(與線上一致)→ 這裡照 autoActions 一樣早退、照打
        if (isSiegeArea(mapState.current) || PURE_BOSS_MAPS.includes(mapState.current)) return false;
        if (state.prideClimb || state.oblivion || state.riftRun) return false;
        // 找卷軸,沒有就依 set-auto-buy-teleport 自動買 1 張(與 autoActions 完全一致)
        var item = player.inv.find(function (i) { return i && i.id === 'scroll_teleport'; });
        if (!item) {
          var buyChk = document.getElementById('set-auto-buy-teleport');
          var cost = shopPrice(DB.items.scroll_teleport.p);
          if (buyChk && buyChk.checked && player.gold >= cost) { player.gold -= cost; gainItem('scroll_teleport', 1, true, true); item = player.inv.find(function (i) { return i && i.id === 'scroll_teleport'; }); }
        }
        if (!item) return false;                                                     // 沒卷軸又補不到 → 退回硬打,同線上
        var bossUid = m.uid;
        // ⭐ 直接走原作 useItem(silent):它自己套用「行動限制/軍王之室/prideTeleportBlocked(排名·11F+無支配符)/遺忘之島」全部守衛,
        //    被擋下就不 consume、不 doTeleport(卷軸不會白扣)。不自己刻地圖清單 → 永遠與原作瞬移規則同步,不分歧。
        useItem(item.uid, true);
        return !mapState.mobs.some(function (x) { return x && x.uid === bossUid; });  // BOSS 已被 doTeleport 清掉 → 瞬移成功;仍在(被守衛擋下)→ 回 false 照打
      } catch (e) { return false; }
    }
    function fastAliveIdx() {   // 場上「最早出生」的活怪格位(=原作 getTarget 的鎖定序);-1=空場
      var best = -1, bestBorn = Infinity;
      for (var i = 0; i < mapState.mobs.length; i++) {
        var m = mapState.mobs[i];
        if (m && !m._dead && (m._born || 0) < bestBorn) { best = i; bestBorn = m._born || 0; }
      }
      return best;
    }
    function fastKillMinors(n) {   // 🐲 BOSS 秒殺時,補回「對戰那段時間同場被 AOE/傭兵/寵物清掉的小怪」收益。
      //   事件驅動版:優先殺「真實場上」的小怪(騰出格位讓排程自然補怪),差額再找空格臨時 spawn 補殺。
      //   ⚠ 補殺抽到 BOSS 不可丟棄(2026-07-10 修):BOSS 對打期間出的怪照樣可能抽中下一隻 BOSS(可共存圖如火龍窟/龍之谷,
      //   全模擬 BOSS 率=出怪數的 1%)。丟棄=BOSS 率被砍近半。改成「留在場上」,由後續事件走 BOSS 路徑處理(不計入本次補殺配額)。
      //   只走 killMob→settleDeadMobs 拿真實掉落/經驗;不推進時間、不扣消耗品——那段時間與消耗已由呼叫端 fastAdvance(_bs.ticks) 一次涵蓋。
      var e, i, idx;
      for (e = 0; e < n; e++) {
        idx = -1;
        for (i = 0; i < mapState.mobs.length; i++) { var m = mapState.mobs[i]; if (m && !m._dead && !m.boss) { idx = i; break; } }
        if (idx < 0) break;
        try { killMob(idx); settleDeadMobs(); } catch (e1) { return; }
      }
      for (; e < n; e++) {
        idx = -1;
        for (i = 0; i < mapState.mobs.length; i++) if (!mapState.mobs[i]) { idx = i; break; }
        if (idx < 0) break;
        try {
          spawnMob(idx);
          var mm = mapState.mobs[idx];
          if (!mm) break;
          if (mm.boss) { e--; continue; }   // 抽到 BOSS → 留在場上待後續事件處理;不計入小怪配額。同名 BOSS 不會出現在這:視窗主 BOSS 尚在場上,核心 spawnMob 的同名限制會擋(可共存圖的「異名 BOSS」才進得來,對應線上行為)
          killMob(idx);
          settleDeadMobs();
        } catch (e2) { break; }
      }
    }
    function fastEventStep() {   // ⚡ 事件驅動快速段的一步:原作排程出怪 → 殺「最早出生」那隻(或推進到下一個出怪時點);回 false = 退回全模擬
      try {
        maybeSpawnMobs();   // 核心 js/03 與 tick() 同一份排程:空格排 delay、到時 spawnMob——出怪延遲/長老之室節流/後排格/加速效果全照原作
        var ti = fastAliveIdx();
        if (ti < 0) {   // 空場:時間直接跳到「最近的出怪時點」,下一輪由排程出怪
          var nextAt = Infinity;
          for (var i = 0; i < (mapState.spawnAt || []).length; i++) {
            if (mapState.spawnAt[i] != null && mapState.spawnAt[i] < nextAt) nextAt = mapState.spawnAt[i];
          }
          if (!isFinite(nextAt)) return false;   // 沒怪又沒有任何出怪排程(地圖異常)→ 退回全模擬
          return fastAdvance(Math.max(1, nextAt - state.ticks));
        }
        var _m0 = mapState.mobs[ti];
        if (_m0.boss) {   // 🐲 BOSS:第一次(或未驗證安全、或 5% 抽驗)→ 真模擬對打;其餘 → 即殺但時間按「該 BOSS 實測耗時」推進
          if (fastTeleportAwayBoss(_m0)) return fastAdvance(1);   // 🌀 勾了自動瞬移且該圖可瞬移 → 甩掉不打(約當一拍;下輪排程重出)
          var _bs = bossStats[_m0.n];
          if (_bs && _bs.safe && Math.random() >= BOSS_REVERIFY_P) {
            // 🐲 秒殺(時間按實測移動平均推進)。順序刻意是「先補小怪 → 推進視窗時間 → 最後才殺 BOSS」:
            //   對打視窗期間 BOSS 留在場上,補殺與視窗內的出怪抽選經過核心 spawnMob 的
            //   「同名限一隻/bossInBattle/長老節流」時看得到它——單一 BOSS 種的圖(傲慢樓層)才不會
            //   在視窗內又抽出同名 BOSS(2026-07-10 修:先殺後補會讓 BOSS 率超發 +30%)。
            var _uid0 = _m0.uid;
            fastKillMinors(_bs.minor || 0);   // 補回這隻 BOSS 對戰期間同場小怪的收益(時間/消耗由下方 fastAdvance 一次涵蓋)
            var _okAdv = fastAdvance(_bs.ticks);
            for (var bi = 0; bi < mapState.mobs.length; bi++) {
              var _bm2 = mapState.mobs[bi];
              if (_bm2 && _bm2.uid === _uid0 && !_bm2._dead) { killMob(bi); settleDeadMobs(); maybeSpawnMobs(); break; }
            }
            return _okAdv;
          }
          fastBossUid = _m0.uid; fastBossName = _m0.n || '?'; fastBossStart = done; fastBossMinHp = 1; fastBossKills0 = tallySum(killTally);   // 記真打起始殺數 → 倒下時算對戰期間清掉的小怪數
          console.info('[AFK] ⚔ 快速結算遇到 BOSS「' + fastBossName + '」(' + (_bs && _bs.safe ? '抽驗' : '首次') + ')→ 切回真模擬對打,倒下後同名 BOSS 才可快轉。');
          return true;   // 不推進時間、不扣消耗品——接下來的真模擬拍會照實計(場上其他怪由真模擬一併處理)
        }
        // ⚡ 批次擊殺:一個「死亡事件」殺 batchPerEvent 隻(小數位用機率補整),AOE 角色一次清一批與線上一致;
        //   批次只吃小怪,輪到 BOSS(最早出生)時本事件收尾,下一事件走上面的 BOSS 路徑。
        var _want = Math.floor(batchPerEvent) + ((Math.random() < (batchPerEvent % 1)) ? 1 : 0);
        var _killed = 0;
        while (_killed < _want) {
          var ki = fastAliveIdx();
          if (ki < 0) break;
          if (mapState.mobs[ki].boss) break;
          killMob(ki);
          settleDeadMobs();
          _killed++;
        }
        maybeSpawnMobs();   // ⏱ 殺完「立刻」把空格排上重生計時——重生計時起點=怪死當下(與線上一致)。
                            //   若等下一輪(時間已推進)才排,每殺晚一拍 → 出怪率被系統性壓低(spawn-limited 圖對這個順序很敏感)。
      } catch (e) { console.warn('[AFK] 快速結算步驟出錯,退回全模擬:', e); return false; }
      // 時間按「實際殺數」比例推進:場上不夠殺滿一批(供給不足/被 BOSS 截斷)時只付對應比例——
      //   否則出怪跟不上時每 1 隻也付整批的時間,殺速被人為拖慢(供給受限圖 -20% 的來源之一)。
      return fastAdvance(svcPerEvent * (_killed / batchPerEvent));
    }
    // 💾 統計快取命中 → 直接進快速段(跳過取樣與 BOSS 首打);未命中 → 照常從取樣開始
    if (fastEligible && player._offStats && player._offStats.v === 1 && player._offStats.svcE > 0
        && player._offStats.sig === offStatsSig()
        && (Date.now() - (player._offStats.savedAt || 0)) < OFFSTATS_MAX_AGE_MS) {
      svcPerEvent = player._offStats.svcE;
      batchPerEvent = Math.max(1, player._offStats.batch || 1);
      consumePerTick = {}; for (var _ck in player._offStats.consume) consumePerTick[_ck] = player._offStats.consume[_ck];
      consumeAcc = {};
      bossStats = player._offStats.boss || {};
      fastMode = true;
      console.info('[AFK] 💾 統計快取命中:跳過取樣與 BOSS 首打,直接快速結算(每事件 ' + svcPerEvent.toFixed(1) + ' 拍×' + batchPerEvent.toFixed(2) + ' 隻,BOSS 快取 ' + Object.keys(bossStats).length + ' 種)。');
    }
    if (fastEligible && !fastMode) beginSample(0);
    // ═══ 混合快速結算(宣告結束;主迴圈內 fastMode 分支使用) ═════════════════════

    var done = 0, died = false;

    // ═══ 💾 分段檢查點 ══════════════════════════════════════════════════════
    // 每 CKPT_MS 真實毫秒把「已結算到的收益」saveGame 固化,並把錨點推進到「closeTs + 已結算拍數」
    // (絕不是「現在」)。結算中被關頁/重整/PWA 被系統殺掉 → 下次載入從錨點續算剩餘,整晚收益不再無聲蒸發。
    // stamp() 在 catchingUp 期間一律跳過(心跳/存檔/落點 changeMap 都蓋不了錨點),錨點只由這裡推進。
    // debug forceCatchup 無 timing → 不做檢查點、不動錨點(維持既有 debug 行為:不寫紀錄、結束才 stamp)。
    var _ckptLastMs = performance.now();
    function buildHistRec() {   // 組一筆離線紀錄:檢查點=「進行中」版本、結算完成=最終版本;同 closeTs 由 recordHistory 覆寫
      var a2 = snapshot();
      var hKills = [];
      for (var kn in killTally) hKills.push({ n: kn, cnt: killTally[kn] });
      hKills.sort(function (x, y) { return x.cnt - y.cnt; });   // 數量「少 → 多」(稀有/BOSS 殺得少自然排前面)
      var hKind, hMap;
      if (climbSegs && (climbSegs.length || segFloor > 0)) {
        hKind = 'climb';
        var _f0 = climbSegs.length ? climbSegs[0].floor : segFloor;
        var _f1 = segFloor > 0 ? segFloor : (climbSegs.length ? climbSegs[climbSegs.length - 1].floor : _f0);
        hMap = '傲慢之塔（' + _f0 + ' → ' + _f1 + ' 樓）';
      } else if (isObl) { hKind = 'oblivion'; hMap = mapName(oblEndMap || (mapState && mapState.current) || huntMap); }
      else if (isKing)  { hKind = 'king';     hMap = mapName(huntMap); }
      else              { hKind = 'normal';   hMap = mapName(huntMap); }
      var hExp = expTotal(a2.lv, a2.exp) - expTotal(before.lv, before.exp); if (hExp < 0) hExp = 0;
      var loginTs2 = (timing && timing.loginTs) || Date.now();
      return {
        v: 1,
        closeTs: timing.closeTs,            // 關閉(離線開始)時間
        loginTs: loginTs2,                  // 登入(離線結束)時間
        realMs: Math.max(0, loginTs2 - timing.closeTs),   // 真實離線時間(未封頂)→ 顯示「共 X 時 Y 分」
        settledMs: done * TICK_MS,          // 實際結算時間 → 算平均效率用
        capped: (loginTs2 - timing.closeTs) > CAP_MS,     // 真實時間是否超過 24h 上限(超過時實際只結算到上限)
        kind: hKind,                        // normal / climb / oblivion / king
        map: hMap,
        exp: hExp,
        gold: (a2.gold || 0) - (before.gold || 0),
        lv: (a2.lv || 0) - (before.lv || 0),
        items: invDeltaList(before, a2),
        kills: hKills,
        died: !!(died || player.dead),
        keysUsed: isKing ? Math.max(0, kingKeysBefore - countKingKeys()) : 0
      };
    }
    function doCheckpoint() {
      try {
        if (typeof saveGame === 'function') saveGame();   // ff 下 logSys 靜音,不會洗「進度已儲存」;saveGame 尾端的 offlineStamp 被 catchingUp 擋掉,不影響錨點
        stampCore(timing.closeTs + done * TICK_MS);       // 錨點=已結算到的時間點(絕不用 now,剩餘離線時間才不會被吃掉)
        recordHistory(buildHistRec());                    // 已結算部分先寫進離線紀錄(同 closeTs 覆寫,不會多筆)
      } catch (eCk) {}
      _ckptLastMs = performance.now();
    }
    // ═══ 分段檢查點(宣告結束) ═══════════════════════════════════════════════

    try {
      while (done < totalTicks && !_abortCatchup) {
        if (player.dead || !state.running) { died = !!player.dead; break; }
        var t0 = performance.now();
        while (done < totalTicks && !player.dead && state.running && !_abortCatchup &&
               (performance.now() - t0) < (_holdStart ? HOLD_SLICE_MS : sliceMs)) {   // 按住放棄時切片縮小,讓 1.5 秒一到就立刻停
          if (fastMode) {
            if (fastBossUid != null) {   // 🐲 BOSS 對打中:逐拍真模擬(死亡由外層撞死即停接手;打不動就照實耗完時間)
              tick();
              settleDeadMobs();
              done++;
              var _hpB = (player.mhp > 0) ? (player.hp / player.mhp) : 1;
              if (_hpB < fastBossMinHp) fastBossMinHp = _hpB;
              var _bAlive = mapState.mobs.some(function (x) { return x && x.uid === fastBossUid && !x._dead; });   // 事件驅動:BOSS 可能在任一格位,依 uid 掃全場
              if (!_bAlive) {   // BOSS 倒下(或場面被重置)→ 記錄實測耗時/安全度,回快速段
                fastBossUid = null;
                var _durB = Math.max(1, done - fastBossStart);
                var _safeB = fastBossMinHp >= hpFloorNow();   // 安全線跟取樣共用同一條門檻(隨存活時間降到 0):撐滿 20 分鐘後 BOSS 首遇打得贏就 safe → 秒殺
                var _minorB = Math.max(0, (tallySum(killTally) - fastBossKills0) - 1);   // 對戰期間總殺數 − BOSS 本身 1 = 同場被 AOE/傭兵/寵物清掉的小怪數
                var _prevB = bossStats[fastBossName];
                // 🐲 移動平均:抽驗(已有安全實測)→ 與舊值各半混合;首次/上次不安全 → 直接採用本次。
                //   單一樣本的對打耗時變異極大(同 BOSS 27 vs 316 拍),平均化避免一次幸運/倒楣樣本外推整晚。
                bossStats[fastBossName] = (_prevB && _prevB.safe && _safeB)
                  ? { ticks: (_prevB.ticks + _durB) / 2, safe: true, minor: Math.round(((_prevB.minor || 0) + _minorB) / 2) }
                  : { ticks: _durB, safe: _safeB, minor: _minorB };
                saveOffStats();   // 💾 新量到的 BOSS 實測 → 更新統計快取(下次同簽章連首打都免)
                console.info('[AFK] ⚔ BOSS「' + fastBossName + '」倒下:實測 ' + Math.round(_durB) + ' 拍、同場小怪 ' + _minorB + ' 隻' + (_safeB ? ',之後同名 BOSS 即殺、時間按實測(移動平均)推進並補回小怪。' : ',對打時血量偏低(' + Math.round(fastBossMinHp * 100) + '%) → 之後每次都真打。'));
              }
              if (fastBossUid == null && player.lv !== lastLv) {   // BOSS 經驗大,常直接升級 → 重新取樣殺速
                lastLv = player.lv;
                fastMode = false; sampleGrew = false; sampleEnd = done + FAST_RESAMPLE_TICKS;
                beginSample(done);
              }
              continue;
            }
            // ⚡ 快速段:一次一個事件(出怪排程推進/一殺真實獎勵管線);失敗(斷貨/出怪異常)→ 退回全模擬跑完剩餘
            if (!fastEventStep()) { fastMode = false; fastOff = true; console.info('[AFK] ⚡ 快速結算退回全模擬(消耗品斷貨或步驟異常),剩餘時間照真模擬。'); continue; }
            if (player.lv !== lastLv) {   // 升級 → 戰力變了 → 重新取樣殺速
              lastLv = player.lv;
              fastMode = false; sampleGrew = false; sampleEnd = done + FAST_RESAMPLE_TICKS;
              beginSample(done);
            }
            continue;
          }
          tick();
          settleDeadMobs();
          done++;
          if (fastEligible && !fastOff) {   // 取樣段:記錄最低血量+「場上有怪」拍數(純戰鬥耗時)+死亡事件數(AOE 同拍多殺=1 事件),窗滿就評估要不要切快速
            if (mapState.mobs.some(function (m) { return m && !m._dead; })) busyTicks++;
            var _ks = tallySum(killTally);
            if (_ks > _prevKillSum) { deathEvents++; _prevKillSum = _ks; }
            var _hpP = (player.mhp > 0) ? (player.hp / player.mhp) : 1;
            if (_hpP < sampleMinHp) sampleMinHp = _hpP;
            if (player.lv !== lastLv) lastLv = player.lv;   // 取樣中升級:樣本自然涵蓋新戰力,不需特別處理
            if (done >= sampleEnd) {
              if (totalTicks - done >= FAST_MIN_REMAIN) evalSample();
              else fastOff = true;   // 剩太少,全模擬跑完就好
            }
          }
          if (isKing && !kingLeftRoom && mapState && mapState.current !== huntMap) kingLeftRoom = true;   // 鑰匙用完→原作已把人傳出軍王之室
          if (climbSegs) {
            var nf = state.prideFloor || 0;
            if (nf !== segFloor) {   // 樓層變了(爬上去或攀登結束)→ 結算剛剛那一層
              var sNow = snapshot();
              climbSegs.push(climbSegDelta(segFloor, segStart, sNow));
              segStart = sNow; segFloor = nf;
            }
          }
        }
        if (withOverlay) updateOverlay(done / totalTicks, done, totalTicks);
        if (timing && timing.closeTs && done > 0 && !player.dead && state.running &&
            (performance.now() - _ckptLastMs) >= CKPT_MS) doCheckpoint();   // 💾 分段檢查點(見上方宣告)
        await pace(sliceMs);   // 前景 rAF / 背景 Worker 溫和節拍(切走也續算)
        // 「長按放棄剩餘收益」按滿 HOLD_MS → 設旗標跳出(已算到的收益本就累積保留,等同撞死即停)
        if (_holdStart && (performance.now() - _holdStart) >= HOLD_MS) _abortCatchup = true;
      }
    } catch (e) {
      console.error('[AFK] 離線補跑發生例外，已中止:', e);
    } finally {
      killTicker();   // 補跑結束(完成/死亡/例外)→ 關掉背景節拍器 Worker,不殘留
      settleDeadMobs();
    }

    var after = snapshot();
    var oblEndMap = isObl ? (mapState && mapState.current) : null;   // 落點前先記下旅程實際結束地圖(死亡會被改成村莊,先存起來給摘要用)
    // 攀登:封最後一段(還停在某層 → 用該層;已結束則 segFloor 已是 0,改記在最後到過的真實樓層)
    if (climbSegs && segFloor > 0) climbSegs.push(climbSegDelta(segFloor, segStart, after));

    // 結算後落點:陣亡(或拿不到狩獵圖)→ 回村莊甦醒;存活 → 接回原本掛機的位置繼續掛。
    // 回狩獵圖前先補滿 HP/MP(等同「甦醒」),避免一上圖就低血暴斃。
    if (died) { try { delete player._offStats; } catch (e) {} }   // 💾 撞死 → 這套統計不可信(快取簽章代表的配置會死),清除、下次照常取樣
    player.dead = false;
    if (isClimb) {
      if (died) {
        // 撞死即停:比照原作 revive() 的「塔中死亡回城」——排名先依目前樓層結算,再結束攀登、回村
        try { if (state.prideClimb && state.prideRanked && typeof prideRecord === 'function') prideRecord(state.prideFloor || 2); } catch (e) {}
        state.prideClimb = false; state.prideRanked = false; state.prideFloor = 0;
        gotoMap(homeTown());
      } else if (state.prideClimb) {
        // 存活且仍在攀登 → 補滿 HP/MP,回到目前樓層(補跑期間可能已往上爬)繼續
        try { if (player.mhp) player.hp = player.mhp; if (player.mmp) player.mp = player.mmp; } catch (e) {}
        state.ff = prevFf0; state.inTick = prevInTick0;   // 攀登存活:先還原 ff,enterPrideFloor 才會渲染戰鬥畫面
        enterPrideFloor(state.prideFloor || 2);
      } else {
        // 攀登於補跑期間自然結束(爬到頂被原作結算)→ 落到村莊
        gotoMap(homeTown());
      }
    } else if (isObl) {
      if (died) {
        // 撞死即停:比照原作 revive() 的「旅程中死亡回村並結束旅程」
        state.oblivion = null; state._oblivionAdvance = false;
        gotoMap(homeTown());
      } else {
        // 存活 → 補滿 HP/MP,留在島上(補跑期間可能已從途中進到本島)續掛;state.oblivion 維持不動,saveGame 後由 stamp 續記旅程
        try { if (player.mhp) player.hp = player.mhp; if (player.mmp) player.mp = player.mmp; } catch (e) {}
        state.ff = prevFf0; state.inTick = prevInTick0;   // 先還原 ff,enterOblivionMap 才會渲染戰鬥畫面
        enterOblivionMap(mapState.current);
      }
    } else if (!died && huntMap) {
      // 🔧 軍王之室:只有「補跑期間真的因鑰匙用完被原作傳回村(kingLeftRoom)」才把落點放村莊。
      //   不要只看「背包 0 鑰匙」——用最後一把鑰匙進場(進場即扣→0 鑰匙)、軍王還沒打死就短暫離線回來的人,
      //   應留在房內續打,不能因「0 鑰匙」被誤傳回村。
      if (isKing && kingLeftRoom) {
        gotoMap(homeTown());
      } else {
        try { if (player.mhp) player.hp = player.mhp; if (player.mmp) player.mp = player.mmp; } catch (e) {}
        gotoMap(huntMap);
      }
    } else {
      gotoMap(homeTown());
    }
    if (state.ff !== prevFf0) { state.ff = prevFf0; state.inTick = prevInTick0; }   // 還原 ff(攀登存活分支上面已還原 → 此處不動作)
    if (trackUntil0 !== null && player.tracking) player.tracking.until = trackUntil0;   // 🎯 還原魔物追蹤原到期時間(見補跑開頭;一定要在下方 saveGame 之前,免得撐長的假 until 被存進存檔)

    // 重啟 live loop(startGameTimers 內含去重,且重設 _loopLast=null → 不會把結算花掉的真實秒數再補一次)
    try { startGameTimers(); } catch (e) {}

    // 持久化離線收益(否則玩家在下次自動存檔前重載會丟失);saveGame 同時會蓋上新時間戳
    try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}

    var kingInfo = null;
    if (isKing) {
      var kingKeysUsed = Math.max(0, kingKeysBefore - countKingKeys());
      kingInfo = { keysUsed: kingKeysUsed, kills: kingKeysUsed + (kingLeftRoom ? 1 : 0), depleted: kingLeftRoom };
    }
    if (climbSegs && climbSegs.length) summarizeClimb(climbSegs, done, died);   // 攀登:逐層摘要
    else summarize(before, after, done, died, (isObl && oblEndMap) ? oblEndMap : huntMap, kingInfo);   // 遺忘之島:用實際結束地圖顯示地圖名;軍王之室:附帶擊敗輪數/鑰匙消耗摘要
    if (_abortCatchup) {   // 玩家長按放棄:標一句「已略過剩餘」(收益只算到放棄當下,剩餘時間不再結算、不會重算)
      var _skipMin = Math.max(0, Math.round((totalTicks - done) * TICK_MS / 60000));
      try { if (typeof logSys === 'function') logSys('<span style="color:#fca5a5;font-weight:bold;">⏭ 已放棄剩餘約 ' + _skipMin + ' 分鐘的離線收益（你提前結束了結算）。</span>'); } catch (e) {}
    }

    // 📜 寫離線掛機歷史紀錄(僅在「有 timing(真實離線)且真的結算了 done>0 tick」時記;debug forceCatchup 無 timing → 不記)
    //   與檢查點共用 buildHistRec/recordHistory:同 closeTs 覆寫 → 檢查點寫的「進行中」版本在此被最終版取代。
    try {
      if (timing && timing.closeTs && done > 0) recordHistory(buildHistRec());
    } catch (e) { console.warn('[AFK] 寫離線紀錄失敗:', e); }
    try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    // 手機:離線結算摘要寫在系統日誌,自動打開日誌浮動面板(切到系統)讓玩家一進來就看到
    try {
      if (window.__afkm && window.__afkm.isMobile && window.__afkm.isMobile()) {
        if (window.__afkm.setLog) window.__afkm.setLog('sys');
        if (window.__afkm.openLog) window.__afkm.openLog();
      }
    } catch (e) {}

    } catch (eRun) {   // 🛡️ 結算流程例外:已結算的收益由檢查點/期間的 saveGame 保留,絕不讓旗標卡死
      console.error('[AFK] 離線結算發生例外，已中止:', eRun);
      try { if (typeof logSys === 'function') logSys('<span class="text-red-400">離線結算發生錯誤而提前中止，已保留結算到目前為止的收益。</span>'); } catch (e2) {}
    } finally {
      killTicker();                                        // 冪等:正常路徑內層 finally 已關過
      killTally = null; gainTally = null;                  // 回到「線上不計數」狀態
      window.__afkKillTally = null; window.__afkGainTally = null;
      if (prevFf0 !== undefined && state.ff !== prevFf0) { state.ff = prevFf0; state.inTick = prevInTick0; }   // 例外時的保險還原(正常路徑已還原 → 此處不動作)
      try { if (typeof startGameTimers === 'function') startGameTimers(); } catch (e3) {}   // 內含去重,正常路徑已重啟 → 無事
      removeOverlay();
      catchingUp = false;   // 先解旗標再 stamp(stamp 在 catchingUp 期間一律跳過)
      stamp();
    }
  }

  // 載入後決定要不要結算離線。preMap/preTs 由 loadGame 開頭的 offlinePreLoad() 在「回村甦醒之前」擷取——
  // 因為 loadGame 會在村莊甦醒(內部呼叫 changeMap → offlineStamp),會把 afk_map/afk_ts 覆寫成
  // 現在(村莊),晚讀就拿不到真正的離線狀態。
  function maybeCatchup(preMap, preTs, prePride, preObl) {
    if (!validSlot() || !state || !state.running) return;
    var last = preTs;
    var savedMap = preMap;
    if (!savedMap) {   // 後援:舊資料沒有 afk_map,退回讀存檔 blob(存檔為 LZ 壓縮＋簽章,要走核心解包;2026-07-10 修——先前直接 JSON.parse 原文必失敗)
      try {
        var _u = (typeof _saveUnwrap === 'function' && typeof _lzGet === 'function') ? _saveUnwrap(_lzGet('lineage_idle_save_' + currentSlot)) : null;
        var _pj = (_u && _u.payload) ? JSON.parse(_u.payload) : null;
        savedMap = (_pj && _pj.ms && _pj.ms.current) || '';
      } catch (e) {}
    }
    var isClimb = !!(prePride && prePride.climb && !prePride.ranked);   // 排名挑戰不自動續(防重載刷分/閃死),只續一般攀登
    var isObl = !!(preObl && preObl.phase && typeof enterOblivionMap === 'function');   // 🏝️ 上次在遺忘之島旅程中(島/途中):同攀登,還原旅程並接回島上續掛
    if (isObl && !savedMap) savedMap = (preObl.phase === 'island') ? 'oblivion_island' : 'oblivion_travel';   // afk_map 缺值時用旅程階段推地圖
    var now = Date.now();
    // ⚠ 這裡「不可」先 stamp:結算完成前錨點必須停在 closeTs——先蓋成「現在」的話,結算一被中斷
    //   (關頁/重整/PWA 被系統殺)整段離線時間就此蒸發(2026-07-10 修)。略過結算的情況由 5 秒心跳自然接手蓋新錨點。
    if (prePride && prePride.climb && prePride.ranked) {
      // 排名挑戰:依原作設計「重載＝回城放棄該次排名」,不自動續(心跳 stamp 會把 game-screen 開啟後的非攀登狀態清掉攀登旗標)
      console.info('[AFK] 上次在傲慢之塔排名挑戰中：依設計不自動續(重載＝回城、該次排名作廢)。');
      skipNote('上次在傲慢之塔「排名挑戰」中：依設計重載＝回城、該次排名作廢，不結算離線收益。');
      return;
    }
    if (savedMap === 'rift_battle') {
      // 🌀 時空裂痕:時間排名挑戰(停留越久排名/獎勵越高、每 5 分鐘強制頭目逐漸把你打死)。
      //   非選單地圖(enterRiftMap 進場、不走 changeMap)、state.riftRun 在暫態 state 上不存檔 → reload 一律已回村。
      //   離線自動續＝刷排名/刷獎勵 exploit;比照排名攀登,離線不續、不結算(等同原作「中途離開＝該次作廢」)。
      //   若不擋:savedMap='rift_battle' 非 town_/非攻城 → 會被當一般圖跑 gotoMap('rift_battle'),
      //   但它不是選單地圖 → setMapSelectors 設不上 → mapState.current 變空 → 空轉、收益歸零(同遺忘之島舊雷)。
      console.info('[AFK] 上次在時空裂痕(時間排名挑戰)中：依設計不自動續、不結算離線收益。');
      skipNote('上次在「時空裂痕」中：時間排名挑戰依設計不結算離線收益（該次挑戰已作廢）。');
      return;
    }
    if (savedMap === 'afk_dummy') {
      // 🥊 木人場(afk-training 外掛):打不死的木人、純測 DPS,沒有經驗/掉落/金錢。關在木人場時 afk_map 戳成 afk_dummy
      //   → 離線一律不結算(本來就沒收益可算);重開後 loadGame 強制回村(setMapSelectors+changeMap(true)),假地圖/假怪都被覆蓋。
      console.info('[AFK] 上次在木人場(測 DPS)中：不結算離線收益。');
      skipNote('上次在木人場（測 DPS）：木人無獎勵，離線期間無收益。');
      return;
    }
    if (!last) {
      // 沒有舊時間戳(外掛剛裝 / 全新角色)→ 不結算離線收益;但若上次在攀登/遺忘之島,仍要把人帶回原地(零補跑)
      if (isClimb || isObl) runCatchup(0, false, savedMap, prePride, preObl);
      return;
    }
    var gap = now - last;
    // 不設「近期活躍就略過」的鎖:重新整理也照常結算那一小段 → 配合存活回原狩獵圖,刷新不會被丟回村莊。
    // 攀登/遺忘之島不受「村莊/攻城」這兩道略過閘:它本來就不是村莊/攻城圖,且即使 gap≈0(立即重整)也要把人放回原地續掛。
    if (!isClimb && !isObl) {
      if (!savedMap || savedMap.indexOf('town_') === 0) {
        console.info('[AFK] 關閉時位於村莊/無有效地圖，無離線戰鬥收益。');
        skipNote('上次關閉時人在村莊/安全區（' + (savedMap ? mapName(savedMap) : '無地圖') + '），離線期間沒有戰鬥收益。要離線掛機請先前往狩獵地圖再關閉遊戲。');
        return;
      }
      if (typeof isSiegeArea === 'function' && isSiegeArea(savedMap)) {
        console.info('[AFK] 關閉時位於攻城區，略過離線結算。');
        skipNote('上次關閉時位於攻城區：攻城戰不結算離線收益。');
        return;
      }
      // 🛡️ 通用保險:地圖不在 DB.maps(無怪池可撈)→ 一律略過,不硬跑(避免空轉)。
      //   涵蓋未來「還沒補邏輯的新特殊戰場」(時空裂痕式暫態戰場等)。隱藏狩獵區域在 DB.maps,不受影響、照常結算。
      if (typeof DB !== 'undefined' && DB.maps && !DB.maps[savedMap]) {
        console.info('[AFK] 上次地圖「' + savedMap + '」非標準狩獵圖(不在 DB.maps)，離線略過以免空轉。');
        skipNote('上次所在的「' + mapName(savedMap) + '」屬特殊戰場，不支援離線結算。');
        return;
      }
    }

    var ms = Math.min(gap, CAP_MS);
    var ticks = Math.floor(ms / TICK_MS);
    if (ticks <= 0 && !isClimb && !isObl) return;   // 一般圖 gap≈0 直接 no-op;攀登/遺忘之島 gap≈0 仍要回到原地(ticks=0 補跑空轉,落點會 enterPrideFloor/enterOblivionMap)
    runCatchup(Math.max(0, ticks), ticks > OVERLAY_MIN_TICK, savedMap, prePride, preObl, { closeTs: last, loginTs: now });   // timing → 供寫離線歷史紀錄(done>0 才會真的記)
  }

  // ----- 核心掛點(loadGame / saveGame / changeMap 直呼;2026-07-10 起不再 monkey-patch) -------
  // 蓋錨點:js/13 saveGame 與 js/11 changeMap 的結尾呼叫(「切圖後馬上關瀏覽器」時 5 秒心跳來不及,由 changeMap 當下記錄)
  window.offlineStamp = stamp;
  // js/13 loadGame 開頭呼叫:必須在「回村甦醒(內部 changeMap → offlineStamp 覆寫 afk_map/afk_ts/afk_pride)」之前擷取上次離線狀態
  window.offlinePreLoad = function () {
    return { map: readMap(), ts: readTs(), pride: readPride(), obl: readObl() };
  };
  // js/13 loadGame 成功載入(state.running=true 之後)呼叫:決定要不要結算離線
  window.offlineAfterLoad = function (pre) {
    if (!pre) return;
    try { maybeCatchup(pre.map, pre.ts, pre.pride, pre.obl); } catch (e) { console.warn('[AFK] offlineAfterLoad error:', e); }
  };

  // 📜⚡ 擊殺/獲得計數:js/05 killMob、js/08 gainItem 直接讀 window.__afkKillTally/__afkGainTally
  //   (只在結算期間指向 killTally/gainTally 同一物件,平時 null → 熱路徑只多一次 truthy 判斷、零累計開銷)。
  window.__afkKillTally = null;
  window.__afkGainTally = null;

  // 入口提示(時空裂痕/排名攀登不支援離線)已直接寫進核心 renderRiftEntrance(js/05)/renderPrideEntrance(js/11),不再包 wrapper 注入。

  // ----- 心跳 + 關閉前蓋章 -------------------------------------------------
  setInterval(function () {
    if (validSlot() && state && state.running) stamp();
  }, HEARTBEAT_MS);
  window.addEventListener('beforeunload', stamp);
  window.addEventListener('pagehide', stamp);

  // ----- 除錯介面 ----------------------------------------------------------
  window.__afk = {
    version: '2.0.0',   // 2.x=核心版(js/offline.js);1.x=外掛版(afk-offline.js,已退役)
    capHours: CAP_HOURS,
    stamp: stamp,
    readTs: readTs,
    mapName: mapName,   // 對外:地圖 id→中文名(供 afk-mobile 在匯入頁顯示「掛在哪張地圖」)
    histKey: histKey,   // 對外:目前角色的離線紀錄 key(供 afk-history)
    setCkptMs: function (ms) { CKPT_MS = Math.max(200, +ms || 5000); },   // 🧪 測試用:縮短檢查點間隔(驗「結算中斷只丟尾段」)
    forceCatchup: function (mins, noFast) { _forceNoFast = !!noFast; runCatchup(Math.floor((mins || 60) * 60000 / TICK_MS), true, (typeof mapState !== 'undefined' && mapState && mapState.current) || ''); }   // 帶當前地圖,否則 gotoMap(undefined) 空轉零收益;noFast=true 強制全模擬(A/B 用)
  };

  console.log('[AFK] hooks OK — 離線掛機(核心)已啟用(上限 ' + CAP_HOURS + ' 小時，撞死即停，存活回原狩獵圖，分段檢查點防中斷)。');
})();
