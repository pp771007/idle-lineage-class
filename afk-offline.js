/* ============================================================================
 * afk-offline.js — 離線掛機外掛(關閉瀏覽器也能結算掛機收益)
 *
 * 設計原則:完全不改原作者程式碼,只從外面「包住」全域函式(monkey-patch)。
 *   - 時間戳存在自己的 localStorage 鍵(afk_ts_<slot>),不碰原存檔格式。
 *   - 離線戰鬥直接呼叫原作者的 tick(),平衡/掉落跟著原版自動同步。
 *   - 撞死即停、結算到死亡前(不做不死,避免無敵 exploit);存活則結算後接回原狩獵圖續掛。
 *   - per-slot 心跳:多分頁掛不同角色用各自的 afk_ts_<slot>,互不干擾。
 *   - 時間切片 + 進度遮罩,8 小時補跑也不會凍結頁面。
 *
 * 掛接方式:在 index.html 的 </body> 前加一行
 *   <script src="afk-offline.js"></script>
 * 更新版本時通常只要重新加回這一行即可。
 * ========================================================================== */
(function () {
  'use strict';

  // ----- 可調參數 ---------------------------------------------------------
  var CAP_HOURS        = 24;                      // 離線收益上限(小時)
  var CAP_MS           = CAP_HOURS * 3600 * 1000;
  var HEARTBEAT_MS     = 5 * 1000;              // 活著時多久蓋一次時間戳
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
  function validSlot() { var n = +currentSlot; return Number.isInteger(n) && n >= 1 && n <= 6; }  // 原作存檔位 1~6(upstream: showSlotSelect 的 for n=1..6);原作加格時這裡上限要跟著調
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
  // 蓋時間戳,順手記下「即時所在地圖」(changeMap 不會存檔,光看存檔 blob 會誤判還在村莊)
  function stamp() {
    try {
      if (!validSlot()) return;
      // 只在「真的進到遊戲畫面」時記錄。開始選單/創角/載入前 game-screen 是 hidden,此時
      // mapState 還是模組預設的 'training'、currentSlot 又預設 1 → 在這 stamp 會把「第一隻」的
      // afk_map 蓋成 training(且只波及 slot 1),害離線結算跑錯地圖。守在這裡根治。
      var gs = document.getElementById('game-screen');
      if (!gs || gs.classList.contains('hidden')) return;
      localStorage.setItem(tsKey(), Date.now());
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

  // ----- 進度遮罩 ---------------------------------------------------------
  var overlayEl = null, overlayBar = null, overlayTxt = null;
  function showOverlay(totalTicks) {
    if (overlayEl) return;
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
    overlayBar.setAttribute('style', 'height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#86efac);transition:width .1s linear');
    barWrap.appendChild(overlayBar);
    overlayTxt = document.createElement('div');
    overlayTxt.setAttribute('style', 'font-size:13px;color:#94a3b8');
    overlayTxt.textContent = '0%';
    overlayEl.appendChild(title);
    overlayEl.appendChild(barWrap);
    overlayEl.appendChild(overlayTxt);
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
    overlayEl = overlayBar = overlayTxt = null;
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
  // 地圖 id → 顯示名稱(查原作者的 MAP_CATEGORIES);查不到就回 id 本身
  function mapName(id) {
    try {
      var pm = (typeof id === 'string') ? id.match(/^pride_f(\d+)$/) : null;   // 攀登樓層不在 MAP_CATEGORIES,自己組名
      if (pm) return '傲慢之塔 ' + pm[1] + ' 樓';
      if (id === 'oblivion_island') return '遺忘之島';   // 遺忘之島地圖不在 MAP_CATEGORIES,自己組名
      if (id === 'oblivion_travel') return '遺忘之島途中';
      if (id && typeof MAP_CATEGORIES !== 'undefined') {
        for (var c in MAP_CATEGORIES) {
          for (var i = 0; i < MAP_CATEGORIES[c].length; i++) if (MAP_CATEGORIES[c][i].v === id) return MAP_CATEGORIES[c][i].t;
        }
      }
    } catch (e) {}
    return id || '?';
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
      var sel = document.getElementById('map-select'); if (sel) sel.value = mapKey;
      if (typeof changeMap === 'function') changeMap(true);
    } catch (e) { console.warn('[AFK] gotoMap(' + mapKey + ') 失敗:', e); }
  }
  function homeTown() {
    try { return (typeof getHomeTown === 'function') ? getHomeTown() : 'town_silver_knight'; }
    catch (e) { return 'town_silver_knight'; }
  }

  // ----- 離線補跑(時間切片) ----------------------------------------------
  var catchingUp = false;
  async function runCatchup(totalTicks, withOverlay, huntMap, prePride, preObl) {
    if (catchingUp) return;
    catchingUp = true;

    var sliceMs = sliceFor(totalTicks);   // 依補跑長短決定畫面更新間隔:短→順、長→快
    var isClimb = !!(prePride && prePride.climb && !prePride.ranked && typeof enterPrideFloor === 'function');   // 排名挑戰不自動續
    var isObl = !isClimb && !!(preObl && preObl.phase && typeof enterOblivionMap === 'function');   // 🏝️ 遺忘之島旅程:同攀登,還原 state.oblivion 後用 enterOblivionMap 進場(島地圖非選單地圖)
    // ⚔ 軍王之室:選單地圖,走通用 gotoMap 即可重進;補跑時數「擊敗輪數/消耗鑰匙/是否因鑰匙用完被傳回村」供摘要顯示
    var isKing = !isClimb && !isObl && (typeof KING_ROOMS !== 'undefined') && !!KING_ROOMS[huntMap];
    var kingKeysBefore = isKing ? countKingKeys() : 0;
    var kingLeftRoom = false;   // 補跑期間因鑰匙用完被原作傳回村(離開了軍王之室)

    // 暫停 live loop,避免結算期間與主迴圈交錯;結算後再以全新計時重啟
    try { if (typeof _gameLoopId !== 'undefined' && _gameLoopId !== null) { clearInterval(_gameLoopId); _gameLoopId = null; } } catch (e) {}

    var prevFf0 = state.ff, prevInTick0 = state.inTick;
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

    var done = 0, died = false;
    try {
      while (done < totalTicks) {
        if (player.dead || !state.running) { died = !!player.dead; break; }
        var t0 = performance.now();
        while (done < totalTicks && !player.dead && state.running &&
               (performance.now() - t0) < sliceMs) {
          tick();
          settleDeadMobs();
          done++;
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
        await raf();
      }
    } catch (e) {
      console.error('[AFK] 離線補跑發生例外，已中止:', e);
    } finally {
      settleDeadMobs();
    }

    var after = snapshot();
    var oblEndMap = isObl ? (mapState && mapState.current) : null;   // 落點前先記下旅程實際結束地圖(死亡會被改成村莊,先存起來給摘要用)
    // 攀登:封最後一段(還停在某層 → 用該層;已結束則 segFloor 已是 0,改記在最後到過的真實樓層)
    if (climbSegs && segFloor > 0) climbSegs.push(climbSegDelta(segFloor, segStart, after));

    // 結算後落點:陣亡(或拿不到狩獵圖)→ 回村莊甦醒;存活 → 接回原本掛機的位置繼續掛。
    // 回狩獵圖前先補滿 HP/MP(等同「甦醒」),避免一上圖就低血暴斃。
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
    try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    removeOverlay();
    // 手機:離線結算摘要寫在系統日誌,自動打開日誌浮動面板(切到系統)讓玩家一進來就看到
    try {
      if (window.__afkm && window.__afkm.isMobile && window.__afkm.isMobile()) {
        if (window.__afkm.setLog) window.__afkm.setLog('sys');
        if (window.__afkm.openLog) window.__afkm.openLog();
      }
    } catch (e) {}
    stamp();
    catchingUp = false;
  }

  // 載入後決定要不要結算離線。preMap/preTs 由 loadGame wrapper 在「原 loadGame 執行前」擷取——
  // 因為原 loadGame 會在村莊甦醒(內部呼叫 changeMap),而 changeMap 已被攔截會 stamp(),會把
  // afk_map/afk_ts 覆寫成現在(村莊),晚讀就拿不到真正的離線狀態。
  function maybeCatchup(preMap, preTs, prePride, preObl) {
    if (!validSlot() || !state || !state.running) return;
    var last = preTs;
    var savedMap = preMap;
    if (!savedMap) {   // 後援:舊資料沒有 afk_map,退回讀存檔 blob
      try { var raw = JSON.parse(localStorage.getItem('lineage_idle_save_' + currentSlot)); savedMap = (raw && raw.ms && raw.ms.current) || ''; } catch (e) {}
    }
    var isClimb = !!(prePride && prePride.climb && !prePride.ranked);   // 排名挑戰不自動續(防重載刷分/閃死),只續一般攀登
    var isObl = !!(preObl && preObl.phase && typeof enterOblivionMap === 'function');   // 🏝️ 上次在遺忘之島旅程中(島/途中):同攀登,還原旅程並接回島上續掛
    if (isObl && !savedMap) savedMap = (preObl.phase === 'island') ? 'oblivion_island' : 'oblivion_travel';   // afk_map 缺值時用旅程階段推地圖
    var now = Date.now();
    stamp(); // 不論如何先更新自己的心跳/錨點(宣告此分頁佔用此 slot)
    if (prePride && prePride.climb && prePride.ranked) {
      // 排名挑戰:依原作設計「重載＝回城放棄該次排名」,不自動續(stamp 已把 game-screen 開啟後的非攀登狀態清掉攀登旗標)
      console.info('[AFK] 上次在傲慢之塔排名挑戰中：依設計不自動續(重載＝回城、該次排名作廢)。');
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
        return;
      }
      if (typeof isSiegeArea === 'function' && isSiegeArea(savedMap)) {
        console.info('[AFK] 關閉時位於攻城區，略過離線結算。');
        return;
      }
    }

    var ms = Math.min(gap, CAP_MS);
    var ticks = Math.floor(ms / TICK_MS);
    if (ticks <= 0 && !isClimb && !isObl) return;   // 一般圖 gap≈0 直接 no-op;攀登/遺忘之島 gap≈0 仍要回到原地(ticks=0 補跑空轉,落點會 enterPrideFloor/enterOblivionMap)
    runCatchup(Math.max(0, ticks), ticks > OVERLAY_MIN_TICK, savedMap, prePride, preObl);
  }

  // ----- 包裹 saveGame / loadGame -----------------------------------------
  var _save = window.saveGame;
  window.saveGame = function () {
    var r = _save.apply(this, arguments);
    stamp();
    return r;
  };

  var _load = window.loadGame;
  window.loadGame = function () {
    // 必須在原 loadGame 之前擷取:它會「在村莊甦醒」呼叫 changeMap → 被攔截 stamp() 覆寫 afk_map/afk_ts/afk_pride
    var preMap = readMap();
    var preTs = readTs();
    var prePride = readPride();
    var preObl = readObl();
    var r = _load.apply(this, arguments);
    try { maybeCatchup(preMap, preTs, prePride, preObl); } catch (e) { console.warn('[AFK] maybeCatchup error:', e); }
    return r;
  };

  // 攔截 changeMap:切地圖的「當下」就立即記錄即時地圖(+時間戳)。
  // 解決「切圖後馬上關瀏覽器」時,5 秒心跳還沒輪到、手機又常不觸發 beforeunload 的情況。
  if (typeof window.changeMap === 'function') {
    var _changeMap = window.changeMap;
    window.changeMap = function () {
      var r = _changeMap.apply(this, arguments);
      stamp();
      return r;
    };
  }

  // ----- 心跳 + 關閉前蓋章 -------------------------------------------------
  setInterval(function () {
    if (validSlot() && state && state.running) stamp();
  }, HEARTBEAT_MS);
  window.addEventListener('beforeunload', stamp);
  window.addEventListener('pagehide', stamp);

  // ----- 除錯介面 ----------------------------------------------------------
  window.__afk = {
    version: '1.0.0',
    capHours: CAP_HOURS,
    stamp: stamp,
    readTs: readTs,
    forceCatchup: function (mins) { runCatchup(Math.floor((mins || 60) * 60000 / TICK_MS), true); }
  };

  console.log('[AFK] hooks OK — 離線掛機外掛已啟用(上限 ' + CAP_HOURS + ' 小時，撞死即停，存活回原狩獵圖)。');
})();
