/*
 * afk-training.js — 木人場外掛
 *
 * 在遊戲「⚙️ 自動化」面板加一顆「🥊 木人場」入口。進去後：
 *  - 選 1~5 隻怪（每隻可不同，預設第 1 格妖魔 orc），用 select+input 篩選挑選。
 *  - 怪打不死、玩家也打不死，跑「真實戰鬥」量輸出。
 *  - 旁邊 HUD 即時顯示「每隻 DPS」＋「總 DPS」（平均與近 10 秒即時）。
 *  - 「重新計算」＝重算角色數值(calcStats)＋重置怪＋DPS 歸零。
 *
 * 原理（一招同時做到打不死＋全傷害涵蓋）：訓練怪血量設成天文數字，每個 tick 結束量牠
 * 掉了多少血＝這拍受到的總傷害，再補回去。因為所有傷害（普攻/法術/連射/出血中毒/傭兵/
 * 反擊…）最終都是扣怪的 curHp，只量血量變化就涵蓋全部來源，免去逐一 hook 數十個扣血點。
 * 即死類特效會直接 killMob → 故另外包 killMob 在木人場內攔截復活。
 *
 * 全部 monkey-patch 全域函式、不動 index.html 遊戲碼。原作者更新只需把 <script> 貼回。
 */
(function () {
  'use strict';

  // ---- 依賴檢查（缺了優雅降級，不弄壞遊戲） --------------------------------
  // 注意：mapState/DB/state/player/TICK_MS 在 index.html 是 let/const，不會掛上 window（只有 var/function 會），
  // 但裸名可跨 script 存取（共用全域語彙環境）；故資料全域一律用裸名，被包裝的函式才用 window.*
  function ready() {
    return typeof mapState !== 'undefined' && typeof DB !== 'undefined' && DB.mobs &&
      typeof uid === 'function' && typeof newMobStatus === 'function' &&
      typeof renderMobs === 'function' && typeof tick === 'function' &&
      typeof killMob === 'function' && typeof killPlayer === 'function' &&
      typeof calcStats === 'function';
  }

  var TRAIN_MAP = 'afk_dummy';       // 獨立 map id：不可用 'training'——那是原作既有的新手地圖「新兵修練場」(有怪池)，會撞號
  var TRAIN_BG = 'assets/area/新兵修練場.jpg';   // 木人場固定背景（主題相符）
  var TRAIN_HP = 1e9;                 // 天文血量：一拍傷害不可能打穿；本作無「依目標最大HP%」的玩家傷害，故安全
  var DEFAULT_MOB = 'orc';           // 妖魔
  var WINDOW_TICKS = 100;            // 即時 DPS 視窗 = 100 tick = 10 秒
  var SLOTS_KEY = 'afk_training_slots';
  var POS_KEY = 'afk_training_hudpos';   // HUD 拖曳後的位置記憶

  var slots = [DEFAULT_MOB, null, null, null, null];   // 各格選的怪 id  （無 active 旗標：是否在木人場一律以 inTrain()＝map===TRAIN_MAP 判斷）
  var backup = null;                 // 進場前的狀態（離場還原用）
  var dps = null;                    // { startTick, perUid:{uid:累計傷害}, window:[每tick總傷害] }
  var hudTickAcc = 0;                // HUD 更新節流計數
  var MOB_OPTS = null;               // [{id,n,lv}] 排序後的怪清單

  function tickMs() { return (typeof TICK_MS !== 'undefined') ? TICK_MS : 100; }

  // ---- 怪物選項清單（依等級、名稱排序） -----------------------------------
  function buildMobOpts() {
    MOB_OPTS = Object.keys(DB.mobs).map(function (id) {
      var d = DB.mobs[id];
      return { id: id, n: d.n || id, lv: d.lv || 0 };
    }).sort(function (a, b) { return (a.lv - b.lv) || a.n.localeCompare(b.n, 'zh-Hant'); });
  }

  // 🔒 木人場效果的「唯一判準」：純看人在不在木人場假地圖（mapState.current === TRAIN_MAP）。**零旗標、唯一真實來源就是地圖**。
  //    一旦玩家用遊戲自身的回村/地圖選單離開（mapState.current 變了），inTrain() 立即為 false，
  //    所有效果（玩家不死/怪不死/不出怪/換背景）同時失效 → 絕對不可能外溢到一般地圖（正常圖 id 永遠不是 afk_dummy）。
  function inTrain() { return typeof mapState !== 'undefined' && mapState && mapState.current === TRAIN_MAP; }
  function hudShown() { var h = document.getElementById('m-train-hud'); return !!h && h.style.display !== 'none'; }   // 取代 active 旗標當「有沒有訓練 session 要收尾」的判斷(純看 HUD 是否還開著)

  // 收尾木人場模式（不導頁）：清掉殘留的 _train 假怪、收 HUD。供「玩家自行離開木人場地圖」時自動呼叫。
  function deactivate() {
    if (typeof mapState !== 'undefined' && mapState.mobs) {
      for (var i = 0; i < mapState.mobs.length; i++) { if (mapState.mobs[i] && mapState.mobs[i]._train) mapState.mobs[i] = null; }
    }
    closeHud();
  }

  // ---- DPS 量測：包住 tick ------------------------------------------------
  var _origTick = window.tick;
  window.tick = function () {
    // 玩家沒按「離開」、改用遊戲自身回村/地圖選單離開木人場 → 自動收尾（避免 HUD 殘留;假怪 changeMap 已清）
    if (!inTrain() && hudShown()) deactivate();
    if (!inTrain()) return _origTick.apply(this, arguments);
    // 開拍前：把訓練怪補滿，記下基準（以 uid 為 key，避免死亡輸送帶換格錯亂）
    var before = {};
    var i, m, mobs = mapState.mobs;
    for (i = 0; i < mobs.length; i++) {
      m = mobs[i];
      if (m && m._train) { m.curHp = TRAIN_HP; m._dead = false; before[m.uid] = TRAIN_HP; }
    }
    _origTick.apply(this, arguments);
    // 收拍後：量每隻掉血＝這拍受到的傷害，累計後補回
    var tickTotal = 0;
    mobs = mapState.mobs;
    for (i = 0; i < mobs.length; i++) {
      m = mobs[i];
      if (m && m._train) {
        var base = (before[m.uid] != null) ? before[m.uid] : TRAIN_HP;
        var drain = base - m.curHp;
        if (drain > 0) { dps.perUid[m.uid] = (dps.perUid[m.uid] || 0) + drain; tickTotal += drain; }
        m.curHp = TRAIN_HP; m._dead = false;
        // 傷害飄字(09-vfx-render 的 _vfxQueueDmg)是「tick 結束後 flushTickRender 才取樣 curHp、用跨幀差反推傷害」。
        // 木人場已在這裡把 curHp 補回 TRAIN_HP→若不處理,flush 取樣到的差是 0、永遠不飄字(DPS 仍準,那是上面自己量的)。
        // 解法:把特效層基準 _vfxHp 墊成「補滿值＋這拍傷害」→ flush 取樣時 差值=這拍真實傷害 → 每拍跳一個總傷數字。
        m._vfxHp = TRAIN_HP + drain;
      }
    }
    dps.window.push(tickTotal);
    if (dps.window.length > WINDOW_TICKS) dps.window.shift();
    // 玩家打不死：收拍補滿（被打才會觸發反擊/居合，故不在開拍前補）
    if (player.hp < player.mhp) player.hp = player.mhp;
    player.dead = false;
    if ((++hudTickAcc % 3) === 0) refreshHud();   // 節流：每 3 拍刷一次 HUD
  };

  // ---- 怪打不死：包住 killMob（順帶擋即死）；僅木人場假怪生效 ----------------
  var _origKillMob = window.killMob;
  window.killMob = function (idx) {
    if (inTrain()) {
      var m = mapState.mobs[idx];
      if (m && m._train) { m.curHp = TRAIN_HP; m._dead = false; return; }   // 不結算獎勵、不移除
    }
    return _origKillMob.apply(this, arguments);
  };

  // ---- 木人場不自動出怪：包住 spawnMob（我方怪直接造實例、不走它，故不受影響） ----
  if (typeof window.spawnMob === 'function') {
    var _origSpawnMob = window.spawnMob;
    window.spawnMob = function () {
      if (inTrain()) return;
      return _origSpawnMob.apply(this, arguments);
    };
  }

  // ---- 玩家打不死：包住 killPlayer。**只看地圖 mapState.current === TRAIN_MAP**（不靠 active 旗標）：
  //   最穩——人在木人場就絕不會死(連被秒殺也是),旗標若殘留也不影響;正常地圖 id 永遠不是 afk_dummy → 攔截絕不洩到一般遊戲(在外面照常會死)。
  var _origKillPlayer = window.killPlayer;
  window.killPlayer = function () {
    if (typeof mapState !== 'undefined' && mapState && mapState.current === TRAIN_MAP) {
      player.dead = false;
      player.hp = player.mhp;
      if (player.statuses) { player.statuses.poison = 0; player.statuses.burn = 0; player.statuses.scald = 0; player.statuses.bleed = 0; }
      return;
    }
    return _origKillPlayer.apply(this, arguments);
  };

  // ---- 木人場固定背景：包住 applyAreaBackground（它在每次 UI 更新都會跑，會洗掉 inline 背景） ----
  //   TRAIN_BG 是 1920×580 條狀圖 → 比照作者 area-fit 地圖：backgroundSize:contain + 加 area-fit class，
  //   怪物才會用「現在版本」的尺寸(填滿戰鬥區、腳齊底)。少了 area-fit 會退回舊的固定 224px 尺寸。
  if (typeof window.applyAreaBackground === 'function') {
    var _origApplyBg = window.applyAreaBackground;
    window.applyAreaBackground = function () {
      if (inTrain()) {
        var bv = document.getElementById('battle-view');
        if (bv) { bv.style.backgroundImage = 'url("' + TRAIN_BG + '")'; bv.style.backgroundSize = 'contain'; bv.classList.add('area-fit'); bv.classList.add('has-bg'); }   // area-fit→怪物用現在尺寸;boss 邊緣不裁的修正改放全域 afk-fixes(通用,非木人場特例)
        return;
      }
      return _origApplyBg.apply(this, arguments);
    };
  }

  // ---- 離場還原用：進場前真實 mapState 的全鍵快照(backup.ms),exitTraining 用它把 mapState 換回去。
  //   ⚠ 刻意「不」去包 saveGame：木人場是暫態地圖,就算存到 afk_dummy/假怪也無害——loadGame 會強制回村
  //   (setMapSelectors(回村)+changeMap(true) 整個重置地圖與怪),離線收益則由 afk-offline 偵測 afk_dummy 直接不結算。
  //   (包 saveGame 是高風險做法,曾把存檔寫壞成 Lv.1 null,故改走「不擋存檔+讀檔回村+離線略過」這條更安全的路。) ----
  var SAFE_MS = { current: 'town_kent', mobs: [null, null, null, null, null], targetIdx: -1, spawnAt: [null, null, null, null, null], forceBoss: false, suppressSiegeBoss: false };
  function swapAllKeys(target, src) {            // 用 src 的鍵完全覆蓋 target（含刪掉多出來的鍵）；離場還原用
    var k;
    for (k in target) { if (!(k in src)) delete target[k]; }
    for (k in src) target[k] = src[k];
  }

  // ---- 造訓練怪 -----------------------------------------------------------
  function spawnTrainingMobs() {
    mapState.mobs = [null, null, null, null, null];
    // 選怪格 #1~#5 直接對應「畫面左→右」第 1~5 個位置:畫面渲染序是 [0,3,1,4,2](五怪前後排,見 js renderMobs),
    // 故把第 i 格的怪擺進 mobs[RENDER_ORDER[i]]。這樣 #2 不會跑到正中、選格編號=畫面位置、不跳來跳去。
    var RENDER_ORDER = [0, 3, 1, 4, 2];
    for (var i = 0; i < slots.length; i++) {
      var id = slots[i];
      if (!id || !DB.mobs[id]) continue;
      var base = DB.mobs[id];
      var inst = Object.assign({}, base, {
        hp: TRAIN_HP, curHp: TRAIN_HP, uid: window.uid(),
        _magCd: {}, justHit: false, st: window.newMobStatus(),
        _train: true, _slotLabel: i
      });
      if (base.hard && typeof window.initHardSkin === 'function') window.initHardSkin(inst);
      mapState.mobs[RENDER_ORDER[i]] = inst;
    }
    mapState.targetIdx = -1;   // 不硬鎖最左:設 -1 讓遊戲 getTarget() 自動瞄(優先序中央→左→右,同一般地圖)→ 木人場也是一開始瞄中間
    if (typeof window.renderMobs === 'function') window.renderMobs();
  }

  // ---- 進入木人場 ---------------------------------------------------------
  function enterTraining() {
    if (!player || !player.cls) { alert('請先載入角色，再進木人場。'); return; }
    // 防重入：人已在木人場地圖上 → 只重擺怪+DPS歸零，絕不重抓 backup（避免把木人場狀態記成「進場前」）
    if (inTrain()) { spawnTrainingMobs(); resetDps(); openHud(); refreshHud(); return; }
    // 進場前：把整個 mapState 全鍵快照存起來（離場還原用，確保離開時換回真實狀態）
    var msSnap = {}; for (var bk in mapState) msSnap[bk] = mapState[bk];
    backup = { ms: msSnap };
    if (player.dead) { player.dead = false; player.hp = player.mhp; }
    mapState.current = TRAIN_MAP;   // ← 設了這個 inTrain() 就成立(零旗標)
    mapState.mobs = [null, null, null, null, null];
    mapState.spawnAt = [null, null, null, null, null];
    mapState.forceBoss = false;
    mapState.suppressSiegeBoss = true;
    mapState.targetIdx = 0;
    spawnTrainingMobs();
    if (typeof window.calcStats === 'function') window.calcStats();
    resetDps();
    showBattleView();
    if (typeof window.logSys === 'function') window.logSys('<span class="text-amber-300 font-bold">--- 🥊 木人場（怪打不死，量 DPS）---</span>');
    closePicker();
    openHud();
    refreshHud();
  }

  function exitTraining() {
    if (!inTrain()) return;
    // 先把 mapState 還原成進場前真實狀態 → current 不再是 afk_dummy（之後任何時點存檔都安全）
    swapAllKeys(mapState, (backup && backup.ms) ? backup.ms : SAFE_MS);
    deactivate();   // 清掉殘留 _train 假怪 + 收 HUD
    player.dead = false;
    if (player.hp < player.mhp) player.hp = player.mhp;
    // 回村最安全（避免非選單地圖的還原坑）
    if (typeof window.returnToTown === 'function') {
      try { window.returnToTown(); } catch (e) { /* fallback below */ }
    }
    if (mapState.current === TRAIN_MAP) {   // 理論上不會再是 afk_dummy；保留兜底
      if (typeof window.setMapSelectors === 'function') window.setMapSelectors('town_kent');
      if (typeof window.changeMap === 'function') window.changeMap(true);
    }
    if (typeof window.calcStats === 'function') window.calcStats();
    if (typeof window.updateUI === 'function') window.updateUI();
  }

  function recalc() {
    if (!inTrain()) return;
    if (typeof window.calcStats === 'function') window.calcStats();
    spawnTrainingMobs();
    resetDps();
    refreshHud();
  }

  function resetDps() { dps = { startTick: (typeof state !== 'undefined' ? state.ticks : 0), perUid: {}, window: [] }; }

  function showBattleView() {
    var tv = document.getElementById('town-view');
    var bv = document.getElementById('battle-view');
    if (tv && bv) {
      var mapPanel = tv.parentElement;
      bv.classList.remove('hidden');
      var clp = document.getElementById('combat-log-panel'); if (clp) clp.classList.remove('hidden');
      tv.classList.add('hidden'); tv.classList.remove('flex');
      if (mapPanel) mapPanel.classList.remove('flex-1', 'overflow-hidden');
    }
    if (typeof window.applyAreaBackground === 'function') window.applyAreaBackground();   // 立即套木人場背景
    if (typeof window.renderMobs === 'function') window.renderMobs();
    if (typeof window.updateUI === 'function') window.updateUI();
    var mbtn = document.querySelector('#m-nav [data-nav="battle"]'); if (mbtn) mbtn.click();   // 📱 手機:從設定進木人場時順便切到「戰鬥」分頁(桌機無此鈕→略過),不用再手動切、較順暢
  }

  // ---- DPS HUD（浮動面板） ------------------------------------------------
  function openHud() {
    var hud = document.getElementById('m-train-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'm-train-hud';
      hud.innerHTML =
        '<div class="m-train-hud-head">🥊 木人場 DPS' +
        '<button id="m-train-hud-min" type="button" title="收合/展開">－</button></div>' +
        '<div id="m-train-hud-body">' +
        '<div id="m-train-total" class="m-train-total"></div>' +
        '<div id="m-train-list" class="m-train-list"></div>' +
        '<div class="m-train-hud-btns">' +
        '<button id="m-train-pick" type="button" class="m-train-btn">⚙ 選怪</button>' +
        '<button id="m-train-recalc" type="button" class="m-train-btn m-train-btn-amber">🔄 重新計算</button>' +
        '<button id="m-train-exit" type="button" class="m-train-btn m-train-btn-red">✖ 離開</button>' +
        '</div></div>';
      document.body.appendChild(hud);
      document.getElementById('m-train-pick').addEventListener('click', openPicker);
      document.getElementById('m-train-recalc').addEventListener('click', recalc);
      document.getElementById('m-train-exit').addEventListener('click', exitTraining);
      document.getElementById('m-train-hud-min').addEventListener('click', function () {
        var body = document.getElementById('m-train-hud-body');
        var btn = document.getElementById('m-train-hud-min');
        var hidden = body.style.display === 'none';
        body.style.display = hidden ? '' : 'none';
        btn.textContent = hidden ? '－' : '＋';
      });
      makeHudDraggable(hud);
      restoreHudPos(hud);
      // 手機切到背包/設定視圖時自動隱藏 HUD（換裝不被擋）；回戰鬥視圖再現
      if (typeof MutationObserver === 'function' && !hud._viewObs) {
        hud._viewObs = new MutationObserver(updateHudVisibility);
        hud._viewObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      }
    }
    updateHudVisibility();
  }
  function closeHud() { var hud = document.getElementById('m-train-hud'); if (hud) hud.style.display = 'none'; }

  // 手機(afk-mobile)非戰鬥視圖（背包/設定）時隱藏 HUD，避免擋住換裝；桌機多欄同畫面故不隱藏
  function isMobileNonBattle() {
    var b = document.body;
    return b.classList.contains('m-mobile') && !b.classList.contains('mview-battle');
  }
  function updateHudVisibility() {
    var hud = document.getElementById('m-train-hud');
    if (!hud) return;
    hud.style.display = (inTrain() && !isMobileNonBattle()) ? '' : 'none';
  }

  // HUD 可拖曳（抓標題列；收合鈕不觸發）＋位置記憶
  function makeHudDraggable(hud) {
    var head = hud.querySelector('.m-train-hud-head');
    if (!head) return;
    head.style.cursor = 'move';
    var dragging = false, sx, sy, ox, oy;
    head.addEventListener('pointerdown', function (e) {
      if (e.target && e.target.id === 'm-train-hud-min') return;
      dragging = true;
      var r = hud.getBoundingClientRect();
      ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
      hud.style.left = ox + 'px'; hud.style.top = oy + 'px';
      hud.style.right = 'auto'; hud.style.bottom = 'auto'; hud.style.width = r.width + 'px';
      try { head.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    head.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var w = hud.offsetWidth, h = hud.offsetHeight;
      var nx = Math.max(0, Math.min(window.innerWidth - w, ox + (e.clientX - sx)));
      var ny = Math.max(0, Math.min(window.innerHeight - h, oy + (e.clientY - sy)));
      hud.style.left = nx + 'px'; hud.style.top = ny + 'px';
    });
    function end(e) { if (!dragging) return; dragging = false; try { head.releasePointerCapture(e.pointerId); } catch (_) {} saveHudPos(hud); }
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);
  }
  function saveHudPos(hud) {
    try { localStorage.setItem(POS_KEY, JSON.stringify({ left: parseInt(hud.style.left, 10), top: parseInt(hud.style.top, 10), w: parseInt(hud.style.width, 10) })); } catch (e) { /* ignore */ }
  }
  function restoreHudPos(hud) {
    try {
      var raw = localStorage.getItem(POS_KEY); if (!raw) return;
      var p = JSON.parse(raw); if (!p || typeof p.left !== 'number') return;
      var w = p.w || hud.offsetWidth || 212;
      hud.style.width = w + 'px';
      hud.style.left = Math.max(0, Math.min(window.innerWidth - w, p.left)) + 'px';
      hud.style.top = Math.max(0, Math.min(window.innerHeight - 60, p.top)) + 'px';
      hud.style.right = 'auto'; hud.style.bottom = 'auto';
    } catch (e) { /* ignore */ }
  }

  function fmt(n) {
    n = Math.round(n);
    if (n >= 1e8) return (n / 1e8).toFixed(2) + '億';
    if (n >= 1e4) return (n / 1e4).toFixed(2) + '萬';
    return String(n);
  }

  function refreshHud() {
    if (!inTrain() || !dps) return;
    updateHudVisibility();
    var totalEl = document.getElementById('m-train-total');
    var listEl = document.getElementById('m-train-list');
    if (!totalEl || !listEl) return;

    var elapsedSec = Math.max(0, (state.ticks - dps.startTick)) * tickMs() / 1000;
    var totalDmg = 0; for (var k in dps.perUid) totalDmg += dps.perUid[k];
    var avgTotal = elapsedSec > 0 ? totalDmg / elapsedSec : 0;
    var winSec = dps.window.length * tickMs() / 1000;
    var winDmg = 0; for (var w = 0; w < dps.window.length; w++) winDmg += dps.window[w];
    var instTotal = winSec > 0 ? winDmg / winSec : 0;

    totalEl.innerHTML =
      '<div class="m-train-total-inst">即時 <b>' + fmt(instTotal) + '</b> <span>/秒</span></div>' +
      '<div class="m-train-total-avg">平均 ' + fmt(avgTotal) + ' /秒　·　' + elapsedSec.toFixed(0) + ' 秒</div>';

    // 每隻 DPS（依選怪格 #1~#5 順序列 = 畫面左→右順序，與 spawnTrainingMobs 的擺位一致、不跳）
    var rows = '';
    var list = [];
    for (var i = 0; i < mapState.mobs.length; i++) { if (mapState.mobs[i] && mapState.mobs[i]._train) list.push(mapState.mobs[i]); }
    list.sort(function (a, b) { return (a._slotLabel || 0) - (b._slotLabel || 0); });
    for (var j = 0; j < list.length; j++) {
      var m = list[j];
      var d = dps.perUid[m.uid] || 0;
      var avg = elapsedSec > 0 ? d / elapsedSec : 0;
      rows += '<div class="m-train-row"><span class="m-train-row-name">' + esc(m.n) + ' <span class="m-train-lv">Lv.' + (m.lv || 0) + '</span></span>' +
        '<span class="m-train-row-dps">' + fmt(avg) + '</span></div>';
    }
    listEl.innerHTML = rows || '<div class="m-train-empty">沒有怪</div>';
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---- 選怪面板（select + input 篩選） ------------------------------------
  function buildSelectOptions(filter, selectedId) {
    filter = (filter || '').trim().toLowerCase();
    var list = MOB_OPTS;
    if (filter) list = list.filter(function (o) { return o.n.toLowerCase().indexOf(filter) >= 0 || o.id.toLowerCase().indexOf(filter) >= 0; });
    var html = '<option value="">（空）</option>';
    var seen = false;
    for (var i = 0; i < list.length && i < 400; i++) {
      var o = list[i];
      if (o.id === selectedId) seen = true;
      html += '<option value="' + o.id + '"' + (o.id === selectedId ? ' selected' : '') + '>' + esc(o.n) + '（Lv.' + o.lv + '）</option>';
    }
    // 篩掉了目前選的也要留著（保持選取）
    if (selectedId && !seen && DB.mobs[selectedId]) {
      html += '<option value="' + selectedId + '" selected>' + esc(DB.mobs[selectedId].n) + '（Lv.' + (DB.mobs[selectedId].lv || 0) + '）</option>';
    }
    return html;
  }

  function openPicker() {
    loadSlots();   // 依當前角色（存檔位）讀回上次選的怪
    var modal = document.getElementById('m-train-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'm-train-modal';
      modal.innerHTML =
        '<div class="m-train-modal-box">' +
        '<div class="m-train-modal-head">🥊 木人場 — 選擇怪物' +
        '<button id="m-train-modal-x" type="button">✕</button></div>' +
        '<div class="m-train-modal-note">選 1~5 隻怪（每隻可不同）。怪打不死、你也打不死，旁邊即時顯示 DPS。<br>每格先在左邊輸入關鍵字篩選，再從右邊下拉選怪。</div>' +
        '<div id="m-train-rows"></div>' +
        '<div class="m-train-modal-btns">' +
        '<button id="m-train-go" type="button" class="m-train-btn m-train-btn-amber">進入木人場</button>' +
        '<button id="m-train-close" type="button" class="m-train-btn">關閉</button>' +
        '</div></div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', function (e) { if (e.target === modal) closePicker(); });
      document.getElementById('m-train-modal-x').addEventListener('click', closePicker);
      document.getElementById('m-train-close').addEventListener('click', closePicker);
      document.getElementById('m-train-go').addEventListener('click', function () {
        readSlotsFromUI();
        if (!slots.some(Boolean)) { alert('至少選 1 隻怪。'); return; }
        saveSlots();
        enterTraining();
      });
    }
    renderPickerRows();
    document.getElementById('m-train-go').textContent = inTrain() ? '套用變更' : '進入木人場';
    modal.style.display = 'flex';
  }
  function closePicker() { var m = document.getElementById('m-train-modal'); if (m) m.style.display = 'none'; }

  function renderPickerRows() {
    var box = document.getElementById('m-train-rows');
    if (!box) return;
    var html = '';
    for (var i = 0; i < 5; i++) {
      html += '<div class="m-train-prow" data-idx="' + i + '">' +
        '<span class="m-train-pnum">#' + (i + 1) + '</span>' +
        '<input class="m-train-pfilter" type="text" placeholder="搜尋怪名…" data-idx="' + i + '">' +
        '<select class="m-train-pselect" data-idx="' + i + '">' + buildSelectOptions('', slots[i]) + '</select>' +
        '<button type="button" class="m-train-pclear" data-idx="' + i + '" title="清除這格">✖</button>' +
        '</div>';
    }
    box.innerHTML = html;
    var filters = box.querySelectorAll('.m-train-pfilter');
    filters.forEach(function (inp) {
      inp.addEventListener('input', function () {
        var idx = +inp.getAttribute('data-idx');
        var sel = box.querySelector('.m-train-pselect[data-idx="' + idx + '"]');
        sel.innerHTML = buildSelectOptions(inp.value, slots[idx]);
      });
    });
    var sels = box.querySelectorAll('.m-train-pselect');
    sels.forEach(function (sel) {
      sel.addEventListener('change', function () {
        var idx = +sel.getAttribute('data-idx');
        slots[idx] = sel.value || null;
      });
    });
    // ✖ 快速清除這格：清掉選擇與搜尋字、下拉回「（空）」
    box.querySelectorAll('.m-train-pclear').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = +btn.getAttribute('data-idx');
        slots[idx] = null;
        var inp = box.querySelector('.m-train-pfilter[data-idx="' + idx + '"]');
        var sel = box.querySelector('.m-train-pselect[data-idx="' + idx + '"]');
        if (inp) inp.value = '';
        if (sel) sel.innerHTML = buildSelectOptions('', null);
      });
    });
  }

  function readSlotsFromUI() {
    var box = document.getElementById('m-train-rows'); if (!box) return;
    box.querySelectorAll('.m-train-pselect').forEach(function (sel) {
      var idx = +sel.getAttribute('data-idx');
      slots[idx] = sel.value || null;
    });
  }

  // 各角色（各存檔位）各記一組：key 帶 currentSlot（1~8）。currentSlot 是 index.html 的 let 全域 → 用裸名
  function slotsKey() { return SLOTS_KEY + '_' + ((typeof currentSlot !== 'undefined') ? currentSlot : 1); }
  function loadSlots() {
    slots = [DEFAULT_MOB, null, null, null, null];
    try {
      var raw = localStorage.getItem(slotsKey());
      if (raw) { var arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length === 5) slots = arr.map(function (x) { return (x && DB.mobs[x]) ? x : null; }); }
    } catch (e) { /* ignore */ }
    if (!slots.some(Boolean)) slots = [DEFAULT_MOB, null, null, null, null];
  }
  function saveSlots() { try { localStorage.setItem(slotsKey(), JSON.stringify(slots)); } catch (e) { /* ignore */ } }

  // ---- 入口：自動化面板「🔌 外掛」列加一顆鈕（沿用 afk-dex 的共用列 id；木人場自成一列、不擠進查詢鈕排） ----
  function injectAutoNav() {
    var panel = document.getElementById('automation-panel');
    if (!panel) return false;
    if (document.getElementById('m-afk-nav-train')) return true;
    var scroll = panel.querySelector('.overflow-y-auto') || panel;
    var row = document.getElementById('m-afk-navrow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'm-afk-navrow';
      row.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700';
      row.innerHTML = '<div class="text-sm text-amber-400 mb-2 border-b border-slate-700 pb-1 font-bold">🔌 外掛</div>' +
        '<div id="m-afk-navrow-btns" style="display:flex;gap:8px;flex-wrap:wrap;"></div>';
      scroll.appendChild(row);
    }
    var hdr = row.querySelector('.text-amber-400');   // 防呆:dex/wiki/training 現在建列都用「🔌 外掛」,此改名只為兜「舊快取的 dex/wiki 還寫『外掛 · 查詢』」的情況
    if (hdr) hdr.textContent = '🔌 外掛';
    var b = document.createElement('button');
    b.id = 'm-afk-nav-train'; b.type = 'button';
    b.className = 'btn py-2 text-sm bg-slate-700 hover:bg-slate-600 border-slate-500';
    b.style.width = '100%';
    b.style.marginTop = '8px';
    b.textContent = '🥊 木人場';
    b.addEventListener('click', openPicker);
    row.appendChild(b);   // 掛在 row 底部（btns 排之下）→ 木人場自成一整列
    return true;
  }

  // ---- CSS ---------------------------------------------------------------
  function injectCss() {
    if (document.getElementById('m-train-css')) return;
    var st = document.createElement('style');
    st.id = 'm-train-css';
    st.textContent = [
      '#m-train-hud{position:fixed;bottom:12px;left:10px;z-index:9000;width:212px;background:rgba(15,23,42,.96);border:1px solid #475569;border-radius:10px;color:#e2e8f0;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,.5);}',
      '.m-train-hud-head{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;font-weight:bold;color:#fbbf24;border-bottom:1px solid #334155;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;}',   /* 📱 touch-action:none → 拖曳把手不被瀏覽器當捲動手勢搶走(否則手機拖曳會中途 pointercancel、卡頓);user-select:none → 拖曳不選到標題字 */
      '.m-train-hud-head button{background:none;border:none;color:#94a3b8;font-size:16px;line-height:1;cursor:pointer;padding:0 4px;}',
      '#m-train-hud-body{padding:8px 10px;}',
      '.m-train-total{text-align:center;margin-bottom:8px;}',
      '.m-train-total-inst{font-size:15px;color:#fde68a;}.m-train-total-inst b{font-size:20px;color:#facc15;}.m-train-total-inst span{font-size:12px;color:#94a3b8;}',
      '.m-train-total-avg{font-size:11px;color:#94a3b8;margin-top:2px;}',
      '.m-train-list{display:flex;flex-direction:column;gap:3px;margin-bottom:8px;max-height:170px;overflow-y:auto;}',
      '.m-train-row{display:flex;justify-content:space-between;align-items:center;gap:6px;background:#1e293b;border:1px solid #334155;border-radius:6px;padding:3px 7px;}',
      '.m-train-row-name{color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.m-train-lv{color:#64748b;font-size:11px;}',
      '.m-train-row-dps{color:#86efac;font-weight:bold;white-space:nowrap;}',
      '.m-train-empty{color:#64748b;text-align:center;padding:4px;}',
      '.m-train-hud-btns{display:flex;gap:5px;}',
      '.m-train-btn{flex:1;cursor:pointer;border-radius:6px;padding:6px 4px;font-size:12px;background:#334155;border:1px solid #475569;color:#e2e8f0;white-space:nowrap;}',
      '.m-train-btn:hover{background:#475569;}',
      '.m-train-btn-amber{background:#b45309;border-color:#d97706;}.m-train-btn-amber:hover{background:#d97706;}',
      '.m-train-btn-red{background:#991b1b;border-color:#dc2626;}.m-train-btn-red:hover{background:#dc2626;}',
      '#m-train-modal{position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;padding:14px;}',
      '.m-train-modal-box{width:100%;max-width:460px;max-height:88vh;overflow-y:auto;background:#0f172a;border:1px solid #475569;border-radius:12px;color:#e2e8f0;}',
      '.m-train-modal-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;font-size:16px;font-weight:bold;color:#fbbf24;border-bottom:1px solid #334155;}',
      '.m-train-modal-head button{background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;}',
      '.m-train-modal-note{padding:10px 14px;font-size:12px;color:#94a3b8;line-height:1.5;}',
      '#m-train-rows{padding:0 14px 6px;display:flex;flex-direction:column;gap:8px;}',
      '.m-train-prow{display:flex;align-items:center;gap:6px;}',
      '.m-train-pnum{color:#64748b;font-size:13px;width:24px;flex:none;}',
      '.m-train-pfilter{flex:1;min-width:0;background:#1e293b;border:1px solid #475569;border-radius:6px;color:#e2e8f0;padding:6px 8px;font-size:13px;outline:none;}',
      '.m-train-pselect{flex:1.4;min-width:0;background:#1e293b;border:1px solid #475569;border-radius:6px;color:#e2e8f0;padding:6px 4px;font-size:13px;outline:none;}',
      '.m-train-pclear{flex:none;width:30px;height:30px;border-radius:6px;background:#3f1d1d;border:1px solid #7f1d1d;color:#fca5a5;font-size:13px;line-height:1;cursor:pointer;padding:0;touch-action:manipulation;}.m-train-pclear:hover{background:#7f1d1d;color:#fee2e2;}',
      '.m-train-modal-btns{display:flex;gap:8px;padding:12px 14px;}',
      '@media (max-width:640px){#m-train-hud{top:auto;bottom:74px;right:6px;left:6px;width:auto;}.m-train-list{max-height:120px;}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ---- 初始化 ------------------------------------------------------------
  function init() {
    if (!ready()) { console.warn('[AFK-training] 缺必要全域，停用'); return; }
    buildMobOpts();
    injectCss();
    // 核心 hook（tick/killMob/killPlayer 的包裝）在載入時即已安裝 → 此處即可視為就緒
    console.log('[AFK-training] hooks OK');
    // 入口按鈕：自動化面板可能晚於外掛才建立 → 重試注入（best-effort，不影響核心功能）
    var tries = 0;
    (function tryInject() {
      if (injectAutoNav()) return;
      if (++tries < 40) setTimeout(tryInject, 500);
      else console.warn('[AFK-training] 找不到 automation-panel，入口未注入（其餘功能仍可用）');
    })();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
