/*
 * afk-training.js — 木人場外掛
 *
 * 在遊戲「⚙️ 自動化」面板加一顆「🥊 木人場」入口。進去後：
 *  - 選 1~5 隻怪（每隻可不同，預設第 1 格妖魔 orc），用 select+input 篩選挑選。
 *  - （原「世界模式」席琳／瘋狂席琳選單已隨席琳的世界關閉拿掉；worldMode 固定 'normal'）
 *  - 可勾「召喚骷髏」：死靈之書的骷髏只在「擊殺」時喚起，而木人場的怪打不死＝永遠沒有擊殺 → 不補這一手
 *    就永遠量不到骷髏的輸出。做法是缺額時呼叫原作的 necroBookOnKill（走原本那條路，不自己造骷髏）。
 *  - 怪打不死、玩家/傭兵/寵物/召喚物/城堡護衛也都打不死，跑「真實戰鬥」量輸出。
 *  - 旁邊 HUD 兩個檢視：「👥 來源」＝玩家／每個傭兵／每隻寵物／每種召喚物 各自的 DPS 長條圖，
 *    「🎯 目標」＝打在每隻訓練怪身上的 DPS；上方永遠是總 DPS（平均與近 10 秒即時）。
 *  - 「重新計算」＝重算角色數值(calcStats)＋重置怪＋DPS 歸零。
 *
 * 隊員（玩家/傭兵/寵物/召喚物/城堡護衛）打不死的做法：**不灌血量**，在會致死的那一步之前把 HP 補回牠自己的
 * 真實上限（見 HP_GUARDS）。灌大的血量會讓「跟血量掛勾」的機制算出荒謬結果，滿血則是合法狀態。
 *
 * 原理（一招同時做到打不死＋全傷害涵蓋）：訓練怪血量設成天文數字，每個 tick 結束量牠
 * 掉了多少血＝這拍受到的總傷害，再補回去。因為所有傷害（普攻/法術/連射/出血中毒/傭兵/
 * 反擊…）最終都是扣怪的 curHp，只量血量變化就涵蓋全部來源，免去逐一 hook 數十個扣血點。
 * 即死類特效會直接 killMob → 故另外包 killMob 在木人場內攔截復活。
 *
 * 來源拆帳：核心 js/03 本來就把傷害分成 玩家／每個傭兵／寵物總桶／召喚總桶（本圖效率統計用），
 * 每拍取這四類的增量即可；寵物與召喚要再拆成「每種」，則借核心仇恨制的 threatWrap（每個實體
 * 的一次攻擊各自包一個快照視窗）逐實體量。兩邊對不起來的殘量進「其他」列，確保各列相加＝總傷害。
 *
 * 全部 monkey-patch 全域函式、不動 index.html 遊戲碼。原作者更新只需把 <script> 貼回。
 */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('training')) return;   // 🎚️ 外掛開關:關掉就透明放行原版行為

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
  var TRAIN_BG = 'assets/area/1920x1080/新兵修練場.jpg';   // 木人場固定背景（主題相符；用上游現行 1920x1080 版，資產可純鏡像）
  // 訓練怪的天文血量。這是量測本身的地基，不能拿掉：怪一旦會在拍中被打死，(a) 溢殺的傷害會被核心
  // 的歸因夾成 0（那正是野外 DPS 不準的主因），(b) 我方把牠救回來時核心那一段視窗會反過來算成 0 傷害，
  // 來源拆帳整段消失。⚠️ 代價要知道：怪身上「看最大 HP 百分比」的機制會失真——已知有
  // 遺物即死 proc 的 hpBelow（低於 N% 才觸發）與 隱蔽的死亡草葉 instakillFull（滿血才觸發），
  // 以及頭目每 5 秒回最大 HP 的 0.5~2.5%（後者已在 processMobStatusTick 包裝處理掉）。
  // 隊伍那一側（玩家/傭兵/寵物/召喚物）刻意不用這招，改成「判定前補到真實上限」，見 HP_GUARDS。
  var TRAIN_HP = 1e9;
  var DEFAULT_MOB = 'orc';           // 妖魔
  var WINDOW_TICKS = 100;            // 即時 DPS 視窗 = 100 tick = 10 秒
  var HUD_W = 268;                   // HUD 寬度（要塞得下長條圖的 名稱／長條／數字 三欄;名稱欄要放得下「夥伴·小黑 Lv.30」這種長度）
  var SLOTS_KEY = 'afk_training_slots';
  var POS_KEY = 'afk_training_hudpos';   // HUD 拖曳後的位置記憶
  var MODE_KEY = 'afk_training_mode';    // 世界模式記憶（各存檔位各一組，同 slots）
  var NOMP_KEY = 'afk_training_nomp';    // 「MP 不消耗」記憶（同上）
  var SKELE_KEY = 'afk_training_skele';  // 「召喚骷髏」記憶（同上）
  var VIEW_KEY = 'afk_training_hudview'; // HUD 檢視分頁記憶（來源／目標）
  // 來源分類的排序與顏色：顏色沿用原版「本圖效率統計」那張圖，兩邊看起來才是同一套東西
  var SRC_ORD = { player: 0, ally: 1, pet: 2, summon: 3, other: 4 };
  var SRC_COLOR = { player: '#38bdf8', ally: '#fbbf24', pet: '#4ade80', summon: '#c084fc', other: '#94a3b8' };

  var slots = [DEFAULT_MOB, null, null, null, null];   // 各格選的怪 id  （無 active 旗標：是否在木人場一律以 inTrain()＝map===TRAIN_MAP 判斷）
  var worldMode = 'normal';              // 'normal' | 'sherine' | 'mad'（席琳／瘋狂席琳強度）
  // MP 不消耗（玩家／傭兵／寵物一起，三者一致）。預設關＝測到的是真實消耗下的輸出；
  // 勾起來才是「無限藍」的爆發上限，適合純比裝備／比寵物。
  // ⚠ 核心沒有「擊殺回魔」這回事（查過 killMob：跟擊殺有關的回復只有遺物頭盔的 killHealHp，回 HP 不回 MP）。
  //   野外撐得住是因為「怪死掉到下一隻出現之間沒目標＝不放招，自然回魔照跑」＋升級補滿；
  //   木人場一直有目標所以淨消耗快得多。故補 MP 只能是明確的選項，不能假裝在模擬野外。
  var noMp = false;
  // 🦴 召喚骷髏（死靈之書）。骷髏是「擊殺時喚起」的，而木人場的怪打不死＝一次擊殺都不會發生 → 不勾就
  // 永遠看不到骷髏、也就量不到牠的輸出。勾了之後在缺額時直接呼叫原作的 necroBookOnKill：喚不喚得起來、
  // 階級、上限、傷害全部仍由核心決定（我們不自己造骷髏，作者改設計自動跟上）。離場時只收回「在木人場
  // 多召出來的那幾隻」，進場前就跟著的留著——木人場的產物不外溢到野外。
  var skele = false;
  var skeleBefore = null;            // 進場前既有骷髏的 uid 集合（離場時據此分辨哪些是木人場召的）
  var backup = null;                 // 進場前的狀態（離場還原用）
  var dps = null;                    // { startTick, perUid:{uid:累計傷害}, window:[每tick總傷害] }
  var src = null;                    // 來源拆帳 { cum:{key:{name,kind,dmg}}, window:[{key:每tick傷害}] }
  var srcSnap = null;                // 開拍前核心 _dps 各桶讀數（收拍取增量）
  var entTick = null;                // 這拍 threatWrap/summonTick 逐實體量到的傷害 {key:{name,kind,dmg}}
  var petUids = null;                // 這拍出戰寵物的 uid 集合（用來分辨實體是寵物還是召喚物）
  var midDrain = null;               // 這拍在「頭目回血前」就先收走的傷害 {uid:量}（見 processMobStatusTick 包裝）
  var hudView = 'src';               // 'src'（來源）｜'mob'（目標）
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
    dismissExtraSkeletons();
    skeleBefore = null;
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
    var allies = (player && player.allies) || [];
    srcTickBegin();
    midDrain = {};
    _origTick.apply(this, arguments);
    // 收拍後：量每隻掉血＝這拍受到的傷害，累計後補回
    var tickTotal = 0;
    mobs = mapState.mobs;
    for (i = 0; i < mobs.length; i++) {
      m = mobs[i];
      if (m && m._train) {
        var base = (before[m.uid] != null) ? before[m.uid] : TRAIN_HP;
        var drain = (base - m.curHp) + (midDrain[m.uid] || 0);   // 加回怪物階段開始前就先收走的那段（見 processMobStatusTick 包裝）
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
    if (noMp && player.mp < player.mmp) player.mp = player.mmp;   // 「MP 不消耗」勾了才補（玩家/傭兵/寵物同一個開關，見 noMp）
    if (skele) keepSkeletons();
    // 🤝 傭兵收拍補滿（同玩家）：curHp/MP 回實際上限供顯示；清掉萬一殘留的倒地旗標與復活冷卻
    for (i = 0; i < allies.length; i++) { var _a = allies[i]; if (!_a) continue; _a.curHp = _a.mhp; if (noMp && _a.mp < _a.mmp) _a.mp = _a.mmp; if (_a._downed) { _a._downed = false; _a._reviveCd = 0; } }
    topUpMinions();
    srcTickCommit();
    if ((++hudTickAcc % 3) === 0) refreshHud();   // 節流：每 3 拍刷一次 HUD
  };

  // ---- 🛡️ 隊員（傭兵／寵物／召喚物／城堡護衛）在木人場打不死 ---------------------------
  //   做法：**不把血量灌大**，而是在「會扣血、可能致死的那一步」進去之前，先把該隊員的 HP 補回
  //   牠自己的真實上限；事後再補一道保險（萬一單一擊就超過滿血）。
  //   為什麼不灌大：血量一旦是天文數字，任何「跟血量掛勾」的機制都會算出荒謬結果——訓練怪那邊
  //   就實際踩過（頭目回血＝最大HP的 0.5~2.5%，血量灌到十億時一次回幾百萬直接補滿，把那一拍
  //   打進去的傷害整段抹掉、DPS 憑空少快兩成）。「滿血」是遊戲裡本來就存在的合法狀態，灌大的不是；
  //   之後上游再長出多少百分比血量、低血觸發的技能，都不會因為木人場而算錯。
  //   ⚠️ 補的是「自己的上限」還有另一個好處：寵物 HP 會被寫進共用桶(localStorage)、召喚物 HP 在
  //      玩家存檔裡，補到上限不管什麼時候被存到都無害。
  function petMax(p) { return (typeof window.petMhpEff === 'function') ? window.petMhpEff(p) : (p.mhp || 1); }
  function petMmp(p) { return (p.mmp || 0) + (((typeof window.petDerive === 'function' && window.petDerive(p)) || {}).mmpBonus || 0); }   // 含防具「精神」加成的有效 MP 上限（同 petsTick）
  function ownMax(e) { return e.mhp || 0; }
  // [核心函式名, 隊員在第幾個參數, 血量欄位, 上限算法]——怪物打到隊員的所有入口（含 DoT 與反射壁）
  var HP_GUARDS = [
    ['enemyAttackPet', 1, 'hp', petMax], ['applyMobMagicToPet', 2, 'hp', petMax],
    ['enemyAttackSummon', 1, 'hp', ownMax], ['applyMobMagicToSummon', 2, 'hp', ownMax],
    ['enemyAttackAlly', 1, 'curHp', ownMax], ['applyMobMagicToAlly', 2, 'curHp', ownMax],
    ['processAllyStatusTick', 0, 'curHp', ownMax], ['reflectWallOnDamage', 3, 'curHp', ownMax],
    ['enemyAttackGuard', 1, 'hp', ownMax], ['applyMobMagicToGuard', 2, 'hp', ownMax]   // 🏰 城堡護衛自成一套入口，不在寵物／召喚那幾支裡
  ];
  HP_GUARDS.forEach(function (g) {
    var name = g[0], at = g[1], hpKey = g[2], maxOf = g[3];
    var orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      var e = arguments[at], mx;
      if (!inTrain() || !e || typeof e !== 'object') return orig.apply(this, arguments);   // reflectWallOnDamage 打玩家時第 4 個參數是 null
      mx = maxOf(e);
      if (!(mx > 0)) return orig.apply(this, arguments);
      e[hpKey] = mx;
      // 補到滿血還是有可能被「單一擊就超過滿血」打倒（瘋狂席琳的高等怪對召喚物就會）。核心會就地
      // 標成倒地並寫一行戰鬥訊息——我們下一行就把牠扶起來，那行訊息是假的，會讓人以為還在一直死。
      // 死亡訊息是「標成倒地之後才寫的那一行」（其餘傷害訊息都在標記之前）→ 用這個時序把它濾掉，
      // 不必去比對訊息內容（上游改字也不會失效）。
      var r, prevLog = window.logCombat;
      if (typeof prevLog === 'function') window.logCombat = function () { if (e._downed) return; return prevLog.apply(this, arguments); };
      try { r = orig.apply(this, arguments); } finally { window.logCombat = prevLog; }
      if (e._downed) {
        e._downed = false; e._reviveCd = 0; e._diedAt = 0; e._animAct = null; e[hpKey] = mx;
        if (typeof window.renderSummonPanel === 'function') window.renderSummonPanel(true);   // 倒地那一瞬間核心已把面板畫成死掉的樣子，扶起來後要再畫一次
        if (typeof window.renderGuardPanel === 'function') window.renderGuardPanel(true);
        if (typeof window.renderSquadPanel === 'function') window.renderSquadPanel();
      }
      return r;
    };
  });
  // 寵物的持續傷害(_petStatusTick)是直接扣血、不經上面那些入口 → 倒地判定的唯一出口 _petDown 再補一道
  if (typeof window._petDown === 'function') {
    var _origPetDown = window._petDown;
    window._petDown = function (p) {
      if (inTrain() && p) { p.hp = petMax(p); return; }
      return _origPetDown.apply(this, arguments);
    };
  }
  // 護衛同理：_guardDown 是牠唯一的倒地出口（上面兩支打完會呼叫它），擋在這裡連「倒下了，30 秒後歸隊」
  // 那行訊息都不會寫出去
  if (typeof window._guardDown === 'function') {
    var _origGuardDown = window._guardDown;
    window._guardDown = function (s) {
      if (inTrain() && s) { s.hp = s.mhp || 1; return; }
      return _origGuardDown.apply(this, arguments);
    };
  }

  function petsOut() { return (typeof window.petsOutList === 'function') ? (window.petsOutList() || []) : []; }
  function eachSummon(fn) {
    var lists = [], i, j;
    if (typeof window.summonV2List === 'function') lists.push(window.summonV2List());          // 玩家的召喚術/造屍術/屬性精靈
    if (typeof window.necroSkeletonList === 'function') lists.push(window.necroSkeletonList()); // 死靈之書的骷髏
    var allies = (player && player.allies) || [];                                              // 傭兵各自的召喚物（不走 mercSummonList：它會濾掉倒地的，那正是要救起來的那些）
    for (i = 0; i < allies.length; i++) { if (allies[i] && allies[i].summon) lists.push([allies[i].summon]); }
    // 玩家迷魅(player.summon)不在此：核心設計上牠不進受害者池、本來就不會死
    for (i = 0; i < lists.length; i++) { var L = lists[i] || []; for (j = 0; j < L.length; j++) { if (L[j]) fn(L[j]); } }
  }
  // 收拍把寵物／召喚物補回上限：一來帶著倒地狀態走進木人場的也會被扶起來，二來血不會停在低點
  // （低血會去喝隊長的治癒藥水、缺貨還會自動買藥花金幣——在測 DPS 的地方不該發生）。
  function topUpMinions() {
    var outs = petsOut(), i, p, mx;
    for (i = 0; i < outs.length; i++) {
      p = outs[i]; if (!p) continue;
      if (p._downed) { p._downed = false; p._reviveCd = 0; p._animAct = null; p._statuses = window.newMobStatus(); }
      mx = petMax(p);
      if (p.hp < mx) p.hp = mx;
      if (noMp && p.mp < petMmp(p)) p.mp = petMmp(p);   // 「MP 不消耗」勾了才補（同玩家/傭兵）
    }
    eachSummon(function (s) {
      if (s._downed) { s._downed = false; s._diedAt = 0; s._animAct = null; }
      if ((s.mhp || 0) > 0 && s.hp < s.mhp) s.hp = s.mhp;
    });
    // 城堡護衛：帶著倒地狀態走進木人場的也扶起來（_reviveAt 是核心的 30 秒歸隊排程，一併清掉）
    var guards = (player && player.guardsV2) || [];
    for (i = 0; i < guards.length; i++) {
      var g = guards[i]; if (!g) continue;
      if (g._downed) { g._downed = false; g._diedAt = 0; g._reviveAt = 0; g._animAct = null; }
      if ((g.mhp || 0) > 0 && g.hp < g.mhp) g.hp = g.mhp;
    }
  }

  // ---- 🦴 召喚骷髏（死靈之書）：木人場沒有擊殺，缺額時替核心補一次「擊殺事件」 --------
  //   刻意呼叫核心的 necroBookOnKill 而不是自己 push 一隻骷髏：條件（有沒有裝書、學了沒、自動施放
  //   開了沒）、階級、上限、數值全部留在核心那一份，作者改設計時木人場自動跟上。
  function necroMax() { return (typeof NECRO_SKELETON_MAX !== 'undefined') ? NECRO_SKELETON_MAX : 6; }   // 頂層 const 不掛 window → 裸名讀
  function necroLive() {
    if (typeof window.necroSkeletonList !== 'function') return null;
    return window.necroSkeletonList().filter(function (s) { return s && !s._downed && (s.hp || 0) > 0; });
  }
  // 玩家或任一傭兵現在能不能靠死靈之書喚起骷髏（＝necroBookOnKill 會不會有動作）
  function necroReady() {
    if (typeof window.necroBookPassiveEnabled !== 'function' || typeof player === 'undefined' || !player) return false;
    if (window.necroBookPassiveEnabled(player)) return true;
    var allies = player.allies || [], i;
    for (i = 0; i < allies.length; i++) { if (allies[i] && window.necroBookPassiveEnabled(allies[i])) return true; }
    return false;
  }
  function keepSkeletons() {
    if (typeof window.necroBookOnKill !== 'function') return;
    var live = necroLive();
    if (!live || live.length >= necroMax()) return;
    if (!necroReady()) return;   // 沒書／沒學／沒開自動：先問過再呼叫，免得每拍白跑那段全隊回復
    var m = null, mobs = mapState.mobs, i;
    for (i = 0; i < mobs.length; i++) { if (mobs[i] && mobs[i]._train && mobs[i].race !== '建築') { m = mobs[i]; break; } }
    if (!m) return;   // 五格全選建築類：核心本來就不會因為打建築而喚起骷髏，這裡照樣不給
    window.necroBookOnKill(m);
  }
  // 收回「木人場召出來的」骷髏（進場前就跟著的留著）。離場與中途取消勾選都走這裡。
  function dismissExtraSkeletons() {
    // skeleBefore 是 null＝這不是一趟木人場（沒記到進場前的名單）→ 一隻都不能動：分不出誰是誰的時候
    // 全部清掉，會把玩家在野外辛苦召的骷髏一起收走。
    if (!skeleBefore || typeof window.necroSkeletonList !== 'function') return;
    var list = window.necroSkeletonList(), removed = 0, i, s;
    for (i = list.length - 1; i >= 0; i--) {
      s = list[i];
      if (!s || !skeleBefore[s.uid]) { list.splice(i, 1); removed++; }
    }
    if (removed && typeof window.renderSummonPanel === 'function') window.renderSummonPanel(true);
  }

  // ---- 📊 來源拆帳（玩家／每個傭兵／每種寵物·召喚物） ------------------------
  //   玩家與傭兵：核心 js/03 的 _dps 桶本來就逐傭兵分開記（原版「本圖效率統計」那張圖的資料源），
  //   每拍取增量即可，不必自己重做一套歸因。_dps 是 let 宣告→不在 window 上，用裸名讀。
  //   寵物與召喚：核心只有 pet／summon 兩個總桶 → 借 threatWrap／summonTick（每個實體的一次攻擊
  //   各自包一個快照視窗）逐實體量，再依名字併成「每種」一列。
  //   兩邊的差額（走不到上面兩條的來源，如寵物的中毒出血 DoT）進「其他」列——
  //   寧可有一列說不清楚，也不要讓各列相加對不上總 DPS。
  function coreDps() { return (typeof _dps !== 'undefined' && _dps) ? _dps : null; }
  function grow(now, before) { var d = (now || 0) - (before || 0); return d > 0 ? d : 0; }   // 中途被玩家按「重置」→ 桶歸零，增量以 0 計
  function resetSrc() { src = { cum: {}, window: [] }; srcSnap = null; entTick = null; }

  function srcTickBegin() {
    entTick = {}; petUids = {};
    var outs = petsOut(), i;
    for (i = 0; i < outs.length; i++) { if (outs[i] && outs[i].uid != null) petUids[outs[i].uid] = 1; }
    var c = coreDps();
    if (!c) { srcSnap = null; return; }
    var a = {}; for (var k in c.allies) a[k] = (c.allies[k] && c.allies[k].dmg) || 0;
    srcSnap = { player: c.player || 0, pet: c.pet || 0, summon: c.summon || 0, allies: a };
  }

  // 寵物**逐隻**分開（最多 4 隻、各自等級與裝備不同 → 木人場就是拿來看「哪隻打比較痛」的），
  // 召喚物則依名字併成**每種**（同種可能六七隻，一隻一列會把清單灌爆又無從分辨）。
  function petRowName(p) { return '夥伴·' + (p.name || p.form || '寵物') + ' Lv.' + (p.lv || 1); }
  function creditEnt(ent, amt) {
    if (!entTick || !ent || !(amt > 0)) return;
    var key, row;
    if (ent.uid != null && petUids && petUids[ent.uid]) {
      key = 'pet:' + ent.uid;
      row = entTick[key] || (entTick[key] = { name: petRowName(ent), kind: 'pet', dmg: 0 });
    } else {
      var form = ent.form || ent.n || '召喚物';
      key = 'sum:' + form;
      row = entTick[key] || (entTick[key] = { name: '召喚·' + form, kind: 'summon', dmg: 0 });
    }
    row.dmg += amt;
  }

  function srcTickCommit() {
    if (!src) return;
    var row = {};
    function seat(key, name, kind) {   // 佔一列（還沒有輸出也先列出來）
      var r = src.cum[key] || (src.cum[key] = { name: name, kind: kind, dmg: 0 });
      r.name = name;   // 傭兵改名／換人、寵物升級時名字跟著更新
      return r;
    }
    function put(key, name, kind, amt) {
      if (!(amt > 0)) return;
      row[key] = (row[key] || 0) + amt;
      seat(key, name, kind).dmg += amt;
    }
    var c = coreDps(), minion = 0, k, i;
    // 出戰的寵物一律先佔一列：沒打出傷害的那隻也要看得到（0 也是資訊），不能整列消失
    var outs = petsOut();
    for (i = 0; i < outs.length; i++) { if (outs[i] && outs[i].uid != null) seat('pet:' + outs[i].uid, petRowName(outs[i]), 'pet'); }
    if (c && srcSnap) {
      put('player', '玩家', 'player', grow(c.player, srcSnap.player));
      for (k in c.allies) {
        var rec = c.allies[k]; if (!rec) continue;
        put('ally:' + k, '傭兵·' + (rec.name || '傭兵'), 'ally', grow(rec.dmg, srcSnap.allies[k]));
      }
      minion = grow(c.pet, srcSnap.pet) + grow(c.summon, srcSnap.summon);
    }
    var entSum = 0;
    for (k in entTick) { entSum += entTick[k].dmg; put(k, entTick[k].name, entTick[k].kind, entTick[k].dmg); }
    put('other', '其他', 'other', minion - entSum);
    src.window.push(row);
    if (src.window.length > WINDOW_TICKS) src.window.shift();
  }

  // 逐實體量：包住核心「各實體攻擊各包一個仇恨快照視窗」的 threatWrap（寵物/召喚術/造屍術/精靈/骷髏/城堡護衛都走它）
  if (typeof window.threatWrap === 'function') {
    var _origThreatWrap = window.threatWrap;
    window.threatWrap = function (ent, fn) {
      if (!inTrain() || !entTick || typeof window._dpsSnap !== 'function') return _origThreatWrap.apply(this, arguments);
      var snap = window._dpsSnap();
      var r = _origThreatWrap.apply(this, arguments);
      creditEnt(ent, window._dpsDealt(snap));
      return r;
    };
  }
  // 舊制單體召喚（玩家迷魅／傭兵的召喚物）走 summonTick，沒有 threatWrap → 自己包一個視窗
  if (typeof window.summonTick === 'function') {
    var _origSummonTick = window.summonTick;
    window.summonTick = function (sm) {
      if (!inTrain() || !entTick || typeof window._dpsSnap !== 'function') return _origSummonTick.apply(this, arguments);
      var snap = window._dpsSnap();
      var r = _origSummonTick.apply(this, arguments);
      creditEnt(sm, window._dpsDealt(snap));
      return r;
    };
  }
  // ---- 🩹 別讓頭目的自我回血吃掉這拍的傷害：包住 processMobStatusTick ---------
  //   核心「頭目每 5 秒恢復最大 HP 的 0.5~2.5%」對訓練怪＝一次回幾百萬（血量是天文數字）→ 直接補滿，
  //   那一拍在此之前打進去的傷害就被抹平、收拍量不到（實測會整整少掉快兩成，且完全看不出來）。
  //   那段回血緊接在 processMobStatusTick 之後、且條件是「curHp < hp」→ 在這裡先把已掉的血收走並補滿，
  //   回血條件就不成立，一滴傷害都不會漏；收拍的量測再接手剩下的部分。
  //   ⚠️ 只對木人場假怪、且只在 midDrain 存在（＝木人場的那一拍）時動作，一般地圖完全不經過。
  if (typeof window.processMobStatusTick === 'function') {
    var _origProcessMobStatusTick = window.processMobStatusTick;
    window.processMobStatusTick = function (m) {
      var r = _origProcessMobStatusTick.apply(this, arguments);
      if (midDrain && m && m._train) {
        var d = TRAIN_HP - m.curHp;
        if (d > 0) { midDrain[m.uid] = (midDrain[m.uid] || 0) + d; m.curHp = TRAIN_HP; }
      }
      return r;
    };
  }

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

  // ---- 木人場禁止瞬移：包住 doTeleport（清空 mapState.mobs＝連訓練假怪一起清掉）與瞬移卷軸的 useItem。
  //   自動化的「遇BOSS自動逃離」與「自動瞬移找BOSS(傳送控制戒指)」都會在木人場成立——找BOSS那條的條件是
  //   「場上沒有BOSS就瞬移」，而訓練假怪多半不是BOSS → 進場沒幾秒就把假怪整批清光（看起來像怪被打死/消失），
  //   還會白吃卷軸（有勾自動購買就一直買）。原作的排除清單（村莊/攻城/純BOSS房/軍王之室/傲慢/裂痕/遺忘之島）
  //   認不得木人場這張外掛地圖，故在此擋掉：木人場本來就不需要換場。
  if (typeof window.doTeleport === 'function') {
    var _origDoTeleport = window.doTeleport;
    window.doTeleport = function () {
      if (inTrain()) return;
      return _origDoTeleport.apply(this, arguments);
    };
  }
  if (typeof window.useItem === 'function') {
    var _origUseItem = window.useItem;
    window.useItem = function (uidv) {
      if (inTrain() && player && player.inv) {
        var it = player.inv.find(function (i) { return i && i.uid === uidv; });
        if (it && it.id === 'scroll_teleport') return;   // 不消耗卷軸、不清場（自動與手動皆擋）
      }
      return _origUseItem.apply(this, arguments);
    };
  }
  // ---- 木人場禁止迷魅術：成功時原作直接把該怪從場上拿掉（mapState.mobs[idx]=null·js/07 mEff='charm'），
  //   不經 killMob → 繞過上面的「怪打不死」攔截，訓練怪會少一隻。迷魅術是手動技（type:'manual'），
  //   唯一入口是 manualCast；擋在這裡即可（不扣 MP、不變僕人）。
  if (typeof window.manualCast === 'function') {
    var _origManualCast = window.manualCast;
    window.manualCast = function (skId) {
      if (inTrain()) {
        var sk = (typeof DB !== 'undefined' && DB.skills) ? DB.skills[skId] : null;
        if (sk && sk.mEff === 'charm') {
          if (typeof window.logSys === 'function') window.logSys('<span class="text-amber-300">木人場內無法使用迷魅術（會把訓練用的怪帶走）。</span>');
          return;
        }
      }
      return _origManualCast.apply(this, arguments);
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
        if (bv) { bv.style.backgroundImage = 'url("' + TRAIN_BG + '")'; bv.style.backgroundSize = 'contain'; bv.classList.add('area-fit'); bv.classList.add('has-bg'); }   // area-fit→怪物用現在尺寸;boss 邊緣不裁的修正在 css/style.css(通用,非木人場特例)
        return;
      }
      return _origApplyBg.apply(this, arguments);
    };
  }

  // ---- 離場還原用：進場前真實 mapState 的全鍵快照(backup.ms),exitTraining 用它把 mapState 換回去。
  //   ⚠ 刻意「不」去包 saveGame：木人場是暫態地圖,就算存到 afk_dummy/假怪也無害——loadGame 會強制回村
  //   (setMapSelectors(回村)+changeMap(true) 整個重置地圖與怪),離線收益則由 js/offline.js(核心)偵測 afk_dummy 直接不結算。
  //   (包 saveGame 是高風險做法,曾把存檔寫壞成 Lv.1 null,故改走「不擋存檔+讀檔回村+離線略過」這條更安全的路。) ----
  var SAFE_MS = { current: 'town_kent', mobs: [null, null, null, null, null], targetIdx: -1, spawnAt: [null, null, null, null, null], forceBoss: false, suppressSiegeBoss: false };
  function swapAllKeys(target, src) {            // 用 src 的鍵完全覆蓋 target（含刪掉多出來的鍵）；離場還原用
    var k;
    for (k in target) { if (!(k in src)) delete target[k]; }
    for (k in src) target[k] = src[k];
  }

  // 出生序：核心 getTarget() 是「_born 最小＝在場上最久」的怪自動鎖定，缺這個欄位的怪一隻都選不上
  //   （比較是嚴格 <、bestBorn 初值 Infinity → 全員 Infinity 時回 null）→ 玩家與傭兵整場不出手，
  //   只剩持續傷害型增益與召喚物在打。跟核心 spawnMob 共用同一個全域序號。
  function nextBorn() {
    try { if (typeof _mobBornSeq !== 'undefined') return ++_mobBornSeq; } catch (e) { /* 核心沒這個全域→走下面的後備 */ }
    return ++bornFallback;
  }
  var bornFallback = 0;

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
        _born: nextBorn(), _bornMs: Date.now(),   // 欄位對齊核心 spawnMob（_born 是自動鎖定目標的依據，見上）
        _train: true, _slotLabel: i
      });
      if (base.hard && typeof window.initHardSkin === 'function') window.initHardSkin(inst);
      mapState.mobs[RENDER_ORDER[i]] = inst;
    }
    applyWorldMode();
    mapState.targetIdx = -1;   // 不自己指定:設 -1 讓遊戲 getTarget() 自動瞄(挑 _born 最小的→選怪格 #1,同一般地圖挑最早出生的那隻)
    if (typeof window.renderMobs === 'function') window.renderMobs();
  }

  // ---- 世界模式（席琳／瘋狂席琳）強度：重用原作 applySherineBuff ----------------
  //   原作函式讀 player.sherineWorld / player.sherineMad 旗標 → 呼叫前暫時設成所選模式、
  //   finally 立刻還原（同步執行、中間不可能存檔）。數值單一事實來源在原作，作者改倍率自動跟上。
  //   恩賜（applySherineGrace）是隨機 ×10 事件，量測要穩定 → 刻意不套。
  function applyWorldMode() {
    if (worldMode === 'normal') return;
    if (typeof window.applySherineBuff !== 'function' || typeof player === 'undefined' || !player) return;
    var sw = player.sherineWorld, sm = player.sherineMad;
    player.sherineWorld = (worldMode === 'sherine');
    player.sherineMad = (worldMode === 'mad');
    try {
      for (var i = 0; i < mapState.mobs.length; i++) {
        var m = mapState.mobs[i];
        if (!m || !m._train) continue;
        window.applySherineBuff(i);
        m.hp = TRAIN_HP; m.curHp = TRAIN_HP;   // buff 會把 HP ×3/×5，統一回木人場天文血量
      }
    } finally {
      player.sherineWorld = sw; player.sherineMad = sm;
    }
  }

  // ---- 進入木人場 ---------------------------------------------------------
  function enterTraining() {
    if (!player || !player.cls) { alert('請先載入角色，再進木人場。'); return; }
    // 防重入：人已在木人場地圖上 → 只重擺怪+DPS歸零，絕不重抓 backup（避免把木人場狀態記成「進場前」）
    if (inTrain()) { if (!skele) dismissExtraSkeletons(); refillTeam(); spawnTrainingMobs(); resetDps(); closePicker(); openHud(); refreshHud(); return; }
    // 進場前：把整個 mapState 全鍵快照存起來（離場還原用，確保離開時換回真實狀態）
    var msSnap = {}; for (var bk in mapState) msSnap[bk] = mapState[bk];
    backup = { ms: msSnap };
    skeleBefore = {};   // 進場前就跟著的骷髏：離場時要留下來（在這裡記，才分得出哪幾隻是木人場召的）
    if (typeof window.necroSkeletonList === 'function') {
      window.necroSkeletonList().forEach(function (s) { if (s && s.uid != null) skeleBefore[s.uid] = 1; });
    }
    if (player.dead) { player.dead = false; player.hp = player.mhp; }
    mapState.current = TRAIN_MAP;   // ← 設了這個 inTrain() 就成立(零旗標)
    mapState.mobs = [null, null, null, null, null];
    mapState.spawnAt = [null, null, null, null, null];
    mapState.forceBoss = false;
    mapState.suppressSiegeBoss = true;
    mapState.targetIdx = 0;
    spawnTrainingMobs();
    if (typeof window.calcStats === 'function') window.calcStats();
    refillTeam();   // 進場＝新的一輪，滿血滿魔起跑（省掉「回城補滿再進來」那趟）
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
    refillTeam();
    spawnTrainingMobs();
    resetDps();
    refreshHud();
  }

  // 開新一輪測試前把全隊 HP/MP 補滿＝等同「回城補滿再進來」，但不用真的跑一趟。
  // 這不會扭曲數字：測的仍是「滿藍起跑、之後真實消耗」那條曲線，只是省掉來回。
  function refillTeam() {
    var i;
    if (player) { player.hp = player.mhp; if (player.mp < player.mmp) player.mp = player.mmp; }
    var allies = (player && player.allies) || [];
    for (i = 0; i < allies.length; i++) { var a = allies[i]; if (!a) continue; a.curHp = a.mhp; if (a.mp < a.mmp) a.mp = a.mmp; }
    var outs = petsOut();
    for (i = 0; i < outs.length; i++) { var p = outs[i]; if (!p) continue; p.hp = petMax(p); if (p.mp < petMmp(p)) p.mp = petMmp(p); }
  }

  function resetDps() { dps = { startTick: (typeof state !== 'undefined' ? state.ticks : 0), perUid: {}, window: [] }; resetSrc(); }

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
    var mbtn = document.querySelector('#m-nav [data-view="center"]'); if (mbtn) mbtn.click();   // 📱 手機:從設定進木人場時順便切到「戰鬥」分頁(桌機無此鈕→略過),不用再手動切、較順暢。鈕的屬性是 data-view、戰鬥欄的值是 center(見 afk-mobile setView)
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
        '<div class="m-train-tabs">' +
        '<button id="m-train-tab-src" type="button" class="m-train-tab" data-view="src">👥 來源</button>' +
        '<button id="m-train-tab-mob" type="button" class="m-train-tab" data-view="mob">🎯 目標</button>' +
        '</div>' +
        '<div id="m-train-list" class="m-train-list"></div>' +
        '<div class="m-train-hud-btns">' +
        '<button id="m-train-pick" type="button" class="m-train-btn">⚙ 選怪</button>' +
        '<button id="m-train-recalc" type="button" class="m-train-btn m-train-btn-amber" title="重算角色數值、全隊補滿 HP/MP、DPS 歸零＝乾淨地重測一輪（不用回城）">🔄 重新計算</button>' +
        '<button id="m-train-exit" type="button" class="m-train-btn m-train-btn-red">✖ 離開</button>' +
        '</div></div>';
      document.body.appendChild(hud);
      hud.querySelectorAll('.m-train-tab').forEach(function (b) {
        b.addEventListener('click', function () { hudView = b.getAttribute('data-view'); saveHudView(); refreshHud(); });
      });
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

  // 手機(afk-mobile)在這兩種情況隱藏 HUD；桌機多欄同畫面故不隱藏：
  //   ① 非戰鬥視圖（背包/設定）→ 別擋住換裝
  //   ② 浮動日誌開著 → 日誌面板 z-index 9500 蓋過 HUD(9000)，留著也只是埋在底下的一塊，
  //      而且它就貼在日誌上緣、看起來像破圖
  // ⚠ afk-mobile 的檢視 class 是 mview-left/center/right，「戰鬥」＝mview-center（沒有 mview-battle
  //   這個名字——寫錯的話這裡恆為 true、HUD 在手機上永遠不會出現，畫面上完全看不出是誰把它藏起來）
  function isMobileHidden() {
    var b = document.body;
    if (!b.classList.contains('m-mobile')) return false;
    return !b.classList.contains('mview-center') || b.classList.contains('mlog-open');
  }
  function updateHudVisibility() {
    var hud = document.getElementById('m-train-hud');
    if (!hud) return;
    hud.style.display = (inTrain() && !isMobileHidden()) ? '' : 'none';
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
    try { localStorage.setItem(POS_KEY, JSON.stringify({ left: parseInt(hud.style.left, 10), top: parseInt(hud.style.top, 10) })); } catch (e) { /* ignore */ }
  }
  function saveHudView() { try { localStorage.setItem(VIEW_KEY, hudView); } catch (e) { /* ignore */ } }
  function loadHudView() { try { var v = localStorage.getItem(VIEW_KEY); if (v === 'src' || v === 'mob') hudView = v; } catch (e) { /* ignore */ } }
  function restoreHudPos(hud) {
    try {
      var raw = localStorage.getItem(POS_KEY); if (!raw) return;
      var p = JSON.parse(raw); if (!p || typeof p.left !== 'number') return;
      var w = HUD_W;   // 寬度一律吃 CSS 常數（長條圖要固定欄寬才對得齊），只記住位置
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

    var modeTag = '';
    if (noMp) modeTag += '<div class="m-train-mode-tag m-train-mode-nomp">💧 MP 不消耗</div>';   // 數字是「無限藍」下的，要標出來免得跟真實消耗的紀錄搞混
    totalEl.innerHTML = modeTag +
      '<div class="m-train-total-inst">即時 <b>' + fmt(instTotal) + '</b> <span>/秒</span></div>' +
      '<div class="m-train-total-avg">平均 ' + fmt(avgTotal) + ' /秒　·　' + elapsedSec.toFixed(0) + ' 秒</div>';

    var tabs = document.querySelectorAll('.m-train-tab');
    for (var t = 0; t < tabs.length; t++) tabs[t].classList.toggle('on', tabs[t].getAttribute('data-view') === hudView);
    listEl.innerHTML = (hudView === 'mob') ? mobRowsHtml(elapsedSec) : srcRowsHtml(elapsedSec);
  }

  // 🎯 目標：每隻訓練怪身上的 DPS（依選怪格 #1~#5 順序列 = 畫面左→右順序，與 spawnTrainingMobs 的擺位一致、不跳）
  function mobRowsHtml(elapsedSec) {
    var rows = '', list = [], i;
    for (i = 0; i < mapState.mobs.length; i++) { if (mapState.mobs[i] && mapState.mobs[i]._train) list.push(mapState.mobs[i]); }
    list.sort(function (a, b) { return (a._slotLabel || 0) - (b._slotLabel || 0); });
    for (i = 0; i < list.length; i++) {
      var m = list[i];
      var avg = elapsedSec > 0 ? (dps.perUid[m.uid] || 0) / elapsedSec : 0;
      rows += '<div class="m-train-row"><span class="m-train-row-name">' + esc(m.n) + ' <span class="m-train-lv">Lv.' + (m.lv || 0) + '</span></span>' +
        '<span class="m-train-row-dps">' + fmt(avg) + '</span></div>';
    }
    return rows || '<div class="m-train-empty">沒有怪</div>';
  }

  // 👥 來源：長條圖＝近 10 秒即時 DPS（跟上方大數字同一個口徑，各列相加≒總量）；滑過/長按看平均
  function srcRowsHtml(elapsedSec) {
    if (!src) return '<div class="m-train-empty">尚無輸出</div>';
    var win = {}, i, k;
    for (i = 0; i < src.window.length; i++) { var w = src.window[i]; for (k in w) win[k] = (win[k] || 0) + w[k]; }
    var winSec = src.window.length * tickMs() / 1000;
    var rows = [];
    for (k in src.cum) {
      var r = src.cum[k];
      rows.push({ name: r.name, kind: r.kind, inst: winSec > 0 ? (win[k] || 0) / winSec : 0, avg: elapsedSec > 0 ? r.dmg / elapsedSec : 0 });
    }
    if (!rows.length) return '<div class="m-train-empty">尚無輸出</div>';
    rows.sort(function (a, b) { return (SRC_ORD[a.kind] - SRC_ORD[b.kind]) || (b.avg - a.avg); });
    var max = 1;
    for (i = 0; i < rows.length; i++) max = Math.max(max, rows[i].inst);
    var html = '';
    for (i = 0; i < rows.length; i++) {
      var row = rows[i], c = SRC_COLOR[row.kind] || SRC_COLOR.other;
      var pct = Math.max(2, Math.round(row.inst / max * 100));
      html += '<div class="m-train-bar" title="' + esc(row.name) + '：即時 ' + fmt(row.inst) + ' /秒・平均 ' + fmt(row.avg) + ' /秒">' +
        '<span class="m-train-bar-n">' + esc(row.name) + '</span>' +
        '<span class="m-train-bar-t"><i class="m-train-bar-f" style="width:' + pct + '%;background:' + c + ';"></i></span>' +
        '<span class="m-train-bar-v" style="color:' + c + ';">' + fmt(row.inst) + '</span></div>';
    }
    return html;
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
        '<label class="m-train-opt-row" title="勾起來：玩家／傭兵／寵物的 MP 都不會見底，量的是無限藍的爆發上限。不勾＝真實消耗（想重來一輪按「重新計算」就會補滿）。">' +
        '<input type="checkbox" id="m-train-nomp"><span>MP 不消耗</span></label>' +
        '<label class="m-train-opt-row" title="木人場的怪不會死＝沒有擊殺，骷髏平常靠擊殺喚起。勾起來就直接補到滿，離開木人場時收回。">' +
        '<input type="checkbox" id="m-train-skele"><span>召喚骷髏（死靈之書）</span></label>' +
        '<div id="m-train-skele-hint" class="m-train-opt-hint"></div>' +
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
        var nchk = document.getElementById('m-train-nomp');
        if (nchk) noMp = !!nchk.checked;
        var schk = document.getElementById('m-train-skele');
        if (schk) skele = !!schk.checked;
        saveSlots();
        enterTraining();
      });
    }
    renderPickerRows();
    var nchk0 = document.getElementById('m-train-nomp');
    if (nchk0) nchk0.checked = noMp;
    var schk0 = document.getElementById('m-train-skele');
    if (schk0) schk0.checked = skele;
    // 條件不足時勾了也不會有骷髏出現（核心的 necroBookOnKill 會直接 return）→ 直接說出要補什麼
    var shint = document.getElementById('m-train-skele-hint');
    if (shint) {
      var necroOk = necroReady();
      shint.textContent = necroOk ? '' : '要裝上死靈之書、並在技能欄勾選造屍術的自動施放，骷髏才會出現。';
      shint.style.display = necroOk ? 'none' : '';
    }
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

  // 各角色（各存檔位）各記一組：key 帶 currentSlot。currentSlot 是 index.html 的 let 全域 → 用裸名
  function slotsKey() { return SLOTS_KEY + '_' + ((typeof currentSlot !== 'undefined') ? currentSlot : 1); }
  function modeKey() { return MODE_KEY + '_' + ((typeof currentSlot !== 'undefined') ? currentSlot : 1); }
  function nompKey() { return NOMP_KEY + '_' + ((typeof currentSlot !== 'undefined') ? currentSlot : 1); }
  function skeleKey() { return SKELE_KEY + '_' + ((typeof currentSlot !== 'undefined') ? currentSlot : 1); }
  function loadSlots() {
    slots = [DEFAULT_MOB, null, null, null, null];
    try {
      var raw = localStorage.getItem(slotsKey());
      if (raw) { var arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length === 5) slots = arr.map(function (x) { return (x && DB.mobs[x]) ? x : null; }); }
    } catch (e) { /* ignore */ }
    if (!slots.some(Boolean)) slots = [DEFAULT_MOB, null, null, null, null];
    worldMode = 'normal';
    // 🚫 2026-10-14 席琳的世界已關閉：世界模式選單拿掉，舊存的席琳／瘋狂一律當一般
    noMp = false;
    try { noMp = localStorage.getItem(nompKey()) === '1'; } catch (e) { /* ignore */ }
    skele = false;
    try { skele = localStorage.getItem(skeleKey()) === '1'; } catch (e) { /* ignore */ }
  }
  function saveSlots() { try { localStorage.setItem(slotsKey(), JSON.stringify(slots)); localStorage.setItem(modeKey(), worldMode); localStorage.setItem(nompKey(), noMp ? '1' : '0'); localStorage.setItem(skeleKey(), skele ? '1' : '0'); } catch (e) { /* ignore */ } }

  // ---- 入口：自動化面板「🔌 外掛」列加一顆鈕（沿用 afk-dex 的共用列 id；木人場自成一列、不擠進查詢鈕排） ----
  function injectAutoNav() {
    var panel = document.getElementById('tab-automation');   // v2.6.74 起自動化設定改為遊戲分頁(靜態 DOM,不會被重繪洗掉)
    if (!panel) return false;
    if (document.getElementById('m-afk-nav-train')) return true;
    var row = document.getElementById('m-afk-navrow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'm-afk-navrow';
      row.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700';
      row.innerHTML = '<div class="text-sm text-amber-400 mb-2 border-b border-slate-700 pb-1 font-bold">🔌 外掛</div>' +
        '<div id="m-afk-navrow-btns" style="display:flex;gap:8px;flex-wrap:wrap;"></div>';
      panel.appendChild(row);
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
      '#m-train-hud{position:fixed;bottom:12px;left:10px;z-index:9000;width:' + HUD_W + 'px;background:rgba(15,23,42,.96);border:1px solid #475569;border-radius:10px;color:#e2e8f0;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,.5);}',
      '.m-train-hud-head{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;font-weight:bold;color:#fbbf24;border-bottom:1px solid #334155;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;}',   /* 📱 touch-action:none → 拖曳把手不被瀏覽器當捲動手勢搶走(否則手機拖曳會中途 pointercancel、卡頓);user-select:none → 拖曳不選到標題字 */
      '.m-train-hud-head button{background:none;border:none;color:#94a3b8;font-size:16px;line-height:1;cursor:pointer;padding:0 4px;}',
      '#m-train-hud-body{padding:8px 10px;}',
      '.m-train-total{text-align:center;margin-bottom:8px;}',
      '.m-train-total-inst{font-size:15px;color:#fde68a;}.m-train-total-inst b{font-size:20px;color:#facc15;}.m-train-total-inst span{font-size:12px;color:#94a3b8;}',
      '.m-train-total-avg{font-size:11px;color:#94a3b8;margin-top:2px;}',
      '.m-train-mode-tag{font-size:12px;font-weight:bold;color:#a78bfa;margin-bottom:2px;}',
      '.m-train-mode-mad{color:#f87171;}',
      '.m-train-mode-nomp{color:#7dd3fc;}',
      '.m-train-mode-row{display:flex;align-items:center;gap:8px;padding:0 14px 10px;font-size:13px;color:#cbd5e1;}',
      '.m-train-mode-row span{flex:none;}',
      '.m-train-mode-row select{flex:1;min-width:0;background:#1e293b;border:1px solid #475569;border-radius:6px;color:#e2e8f0;padding:6px 4px;font-size:13px;outline:none;}',
      '.m-train-opt-row{display:flex;align-items:center;gap:8px;padding:0 14px 10px;font-size:13px;color:#cbd5e1;cursor:pointer;user-select:none;}',
      '.m-train-opt-row input{width:16px;height:16px;accent-color:#d97706;flex:none;}',
      '.m-train-opt-hint{padding:0 14px 10px 38px;margin-top:-8px;font-size:12px;color:#fca5a5;line-height:1.4;}',
      '.m-train-tabs{display:flex;gap:4px;margin-bottom:6px;}',
      '.m-train-tab{flex:1;cursor:pointer;border-radius:6px;padding:4px 2px;font-size:11px;background:#1e293b;border:1px solid #334155;color:#94a3b8;white-space:nowrap;}',
      '.m-train-tab.on{background:#334155;border-color:#64748b;color:#e2e8f0;font-weight:bold;}',
      '.m-train-list{display:flex;flex-direction:column;gap:3px;margin-bottom:8px;max-height:186px;overflow-y:auto;}',
      '.m-train-bar{display:flex;align-items:center;gap:5px;}',
      '.m-train-bar-n{flex:none;width:96px;font-size:11px;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.m-train-bar-t{flex:1;min-width:0;height:10px;background:#0b1220;border-radius:5px;overflow:hidden;}',
      '.m-train-bar-f{display:block;height:100%;transition:width .3s;}',
      '.m-train-bar-v{flex:none;width:54px;text-align:right;font-size:11px;font-weight:bold;}',
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
      // z-index 要壓過 afk-mobile 的浮動日誌(9500)與底部導覽(9600)：低於它們的話，手機把日誌開著時
      //   這個視窗整個被日誌蓋住、每顆鈕都點不到（只看座標驗不出來，要用 elementFromPoint 才會現形）。
      // 讓位同 afk-mobile 的 B 型彈窗：容器頂端讓開橫幅、底部讓開導覽，內卡再壓 max-height:100%——
      //   只給容器 padding 不夠，內卡比剩餘空間高時 flex 置中會上下均分溢出，下緣照樣鑽到導覽底下。
      '#m-train-modal{position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:9800;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;padding:14px 14px calc(14px + var(--m-nav-h,0px));}',
      // 卡片本身不捲、只讓「選怪的五列」捲：整張一起捲的話，矮螢幕上「進入木人場」會被捲到看不見的
      //   地方，玩家不會知道要往下拉（元素在、但點下去打到的是遮罩，只量座標驗不出來）。
      '.m-train-modal-box{display:flex;flex-direction:column;width:100%;max-width:460px;max-height:100%;overflow:hidden;background:#0f172a;border:1px solid #475569;border-radius:12px;color:#e2e8f0;}',
      '.m-train-modal-box>*{flex:none;}',
      '.m-train-modal-box>#m-train-rows{flex:1 1 auto;min-height:0;overflow-y:auto;}',
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
      // 底部讓開自製導覽列：一律讀 afk-mobile 實測的 --m-nav-h，不要寫死px——實機 iPhone 的導覽含
      //   home 條安全區會比視窗模擬高一截，寫死的值在模擬器剛好過、到手機上就把最下面那排鈕壓掉。
      '@media (max-width:640px){#m-train-hud{top:auto;bottom:calc(10px + var(--m-nav-h,0px));right:6px;left:6px;width:auto;}.m-train-list{max-height:120px;}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ---- 初始化 ------------------------------------------------------------
  function init() {
    if (!ready()) { console.warn('[AFK-training] 缺必要全域，停用'); return; }
    loadHudView();
    buildMobOpts();
    injectCss();
    // 核心 hook（tick/killMob/killPlayer 的包裝）在載入時即已安裝 → 此處即可視為就緒
    console.log('[AFK-training] hooks OK');
    // 入口按鈕：自動化面板可能晚於外掛才建立 → 重試注入（best-effort，不影響核心功能）
    var tries = 0;
    (function tryInject() {
      if (injectAutoNav()) return;
      if (++tries < 40) setTimeout(tryInject, 500);
      else console.warn('[AFK-training] 找不到 tab-automation，入口未注入（其餘功能仍可用）');
    })();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
