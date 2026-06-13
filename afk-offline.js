/* ============================================================================
 * afk-offline.js — 離線掛機外掛(關閉瀏覽器也能結算掛機收益)
 *
 * 設計原則:完全不改原作者程式碼,只從外面「包住」全域函式(monkey-patch)。
 *   - 時間戳存在自己的 localStorage 鍵(afk_ts_<slot>),不碰原存檔格式。
 *   - 離線戰鬥直接呼叫原作者的 tick(),平衡/掉落跟著原版自動同步。
 *   - 撞死即停、結算到死亡前(不做不死,避免無敵 exploit);存活則結算後接回原狩獵圖續掛。
 *   - per-slot 心跳:3 分頁掛 3 個不同角色用各自的 afk_ts_<slot>,互不干擾。
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
  var SLICE_MS         = 28;                    // 每個 frame 最多跑這麼久就讓出,避免凍結
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
  function validSlot() { return currentSlot === 1 || currentSlot === 2 || currentSlot === 3 || currentSlot === '1' || currentSlot === '2' || currentSlot === '3'; }
  function tsKey()      { return TS_PREFIX + currentSlot; }
  function mapKey()     { return 'afk_map_' + currentSlot; }
  function readTs()     { try { return +localStorage.getItem(tsKey()) || 0; } catch (e) { return 0; } }
  function readMap()    { try { return localStorage.getItem(mapKey()) || ''; } catch (e) { return ''; } }
  // 蓋時間戳,順手記下「即時所在地圖」(changeMap 不會存檔,光看存檔 blob 會誤判還在村莊)
  function stamp() {
    try {
      if (!validSlot()) return;
      localStorage.setItem(tsKey(), Date.now());
      if (typeof mapState !== 'undefined' && mapState && mapState.current) localStorage.setItem(mapKey(), mapState.current);
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
    overlayTxt.textContent = pct + '%  (' + done + ' / ' + total + ' tick)';
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
  function summarize(before, after, doneTicks, died) {
    var mins = Math.round(doneTicks * TICK_MS / 60000);
    var dGold = (after.gold || 0) - (before.gold || 0);
    var dExp  = (after.exp  || 0) - (before.exp  || 0);
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
    var itemStr = items.slice(0, 12).map(function (it) { return it.n + '×' + it.d; }).join('、');
    if (items.length > 12) itemStr += ` …等 ${items.length} 種`;

    window.__afk.last = { mins: mins, gold: dGold, exp: dExp, lv: dLv, died: !!died, ticks: doneTicks, items: items.length };

    var line = `<span class="text-sky-300 font-bold">🌙 離線掛機 ${mins} 分鐘</span>，獲得：`;
    var parts = [];
    if (dGold > 0) parts.push(`<span class="text-yellow-400 font-bold">${fmt(dGold)} 金幣</span>`);
    if (dLv   > 0) parts.push(`<span class="text-green-400 font-bold">升 ${dLv} 級</span>`);
    if (dExp  > 0) parts.push(`${fmt(dExp)} 經驗`);
    if (itemStr)   parts.push(itemStr);
    line += parts.length ? parts.join('、') : '（無明顯收益）';
    line += '。';
    try { logSys(line); } catch (e) { console.log('[AFK]', line.replace(/<[^>]+>/g, '')); }
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
  async function runCatchup(totalTicks, withOverlay, huntMap) {
    if (catchingUp) return;
    catchingUp = true;

    // 暫停 live loop,避免結算期間與主迴圈交錯;結算後再以全新計時重啟
    try { if (typeof _gameLoopId !== 'undefined' && _gameLoopId !== null) { clearInterval(_gameLoopId); _gameLoopId = null; } } catch (e) {}

    var prevFf0 = state.ff, prevInTick0 = state.inTick;
    state.ff = true; state.inTick = true;        // 先靜音,再切到關閉時所在的狩獵圖
    gotoMap(huntMap);

    var before = snapshot();
    if (withOverlay) showOverlay(totalTicks);

    var done = 0, died = false;
    try {
      while (done < totalTicks) {
        if (player.dead || !state.running) { died = !!player.dead; break; }
        var t0 = performance.now();
        while (done < totalTicks && !player.dead && state.running &&
               (performance.now() - t0) < SLICE_MS) {
          tick();
          settleDeadMobs();
          done++;
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

    // 結算後落點:陣亡(或拿不到狩獵圖)→ 回村莊甦醒;存活 → 接回原本掛機的狩獵圖繼續掛。
    // 回狩獵圖前先補滿 HP/MP(等同「甦醒」),避免一上圖就低血暴斃。
    player.dead = false;
    if (!died && huntMap) {
      try { if (player.mhp) player.hp = player.mhp; if (player.mmp) player.mp = player.mmp; } catch (e) {}
      gotoMap(huntMap);
    } else {
      gotoMap(homeTown());
    }
    state.ff = prevFf0; state.inTick = prevInTick0;

    // 重啟 live loop(startGameTimers 內含去重,且重設 _loopLast=null → 不會把結算花掉的真實秒數再補一次)
    try { startGameTimers(); } catch (e) {}

    // 持久化離線收益(否則玩家在下次自動存檔前重載會丟失);saveGame 同時會蓋上新時間戳
    try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}

    summarize(before, after, done, died);
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
  function maybeCatchup(preMap, preTs) {
    if (!validSlot() || !state || !state.running) return;
    var last = preTs;
    var savedMap = preMap;
    if (!savedMap) {   // 後援:舊資料沒有 afk_map,退回讀存檔 blob
      try { var raw = JSON.parse(localStorage.getItem('lineage_idle_save_' + currentSlot)); savedMap = (raw && raw.ms && raw.ms.current) || ''; } catch (e) {}
    }
    var now = Date.now();
    stamp(); // 不論如何先更新自己的心跳/錨點(宣告此分頁佔用此 slot)
    if (!last) return;                         // 沒有舊時間戳(外掛剛裝 / 全新角色)→ 不結算
    var gap = now - last;
    // 不設「近期活躍就略過」的鎖:重新整理也照常結算那一小段 → 配合存活回原狩獵圖,刷新不會被丟回村莊。
    // (gap < 一個 tick 會在下方 ticks<=0 自然 no-op;結算會更新時間戳,連續刷新不會重複給獎勵。)
    if (!savedMap || savedMap.indexOf('town_') === 0) {
      // 在村莊登出(安全區)→ 離線沒有戰鬥收益,不結算
      console.info('[AFK] 關閉時位於村莊/無有效地圖，無離線戰鬥收益。');
      return;
    }
    if (typeof isSiegeArea === 'function' && isSiegeArea(savedMap)) {
      console.info('[AFK] 關閉時位於攻城區，略過離線結算。');
      return;
    }

    var ms = Math.min(gap, CAP_MS);
    var ticks = Math.floor(ms / TICK_MS);
    if (ticks <= 0) return;
    runCatchup(ticks, ticks > OVERLAY_MIN_TICK, savedMap);
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
    // 必須在原 loadGame 之前擷取:它會「在村莊甦醒」呼叫 changeMap → 被攔截 stamp() 覆寫 afk_map/afk_ts
    var preMap = readMap();
    var preTs = readTs();
    var r = _load.apply(this, arguments);
    try { maybeCatchup(preMap, preTs); } catch (e) { console.warn('[AFK] maybeCatchup error:', e); }
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
