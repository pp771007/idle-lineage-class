/* ============================================================================
 * afk-dex.js — 怪物 / 掉落查詢(圖鑑)
 *
 * 首頁(#main-menu)加一顆「📖 怪物 / 掉落查詢」按鈕,開搜尋面板。
 *   - 單一搜尋框:可同時搜 怪物名 / 地圖名 / 掉落物名;有輸入才顯示結果(空的不渲染,不卡)。
 *   - 每筆結果是「怪物卡」:數值 + 出沒地圖 + 掉落清單(物品名 + 機率%)。
 *   - 「掉落率模式」下拉(一般/席琳的世界 ×3/瘋狂的席琳世界 ×5/經典模式 ×1/10):重算怪卡掉落率顯示(席琳上限 100%)。
 *   - 純讀取遊戲全域資料(DB.mobs / DB.maps / MOB_DROPS / DB.items),不改遊戲;桌機手機共用。
 *
 * 掛接:在 index.html 的 </body> 前加一行 <script src="afk-dex.js"></script>
 * ========================================================================== */
(function () {
  'use strict';

  var MAX_RESULTS = 60;
  var INDEX = [];   // [{ id, mob, maps:[名稱], drops:[[id,名稱,pct]], hay:可搜尋字串(小寫) }]
  // 搜尋打字防抖:每次按鍵只重設計時器,停手這麼久才真的過濾+重渲染(降低逐字輸入的 INP)。
  var SEARCH_DEBOUNCE_MS = 150;
  var _searchTimer = null;
  function debouncedSearch() { if (_searchTimer) clearTimeout(_searchTimer); _searchTimer = setTimeout(function () { _searchTimer = null; doSearch(); }, SEARCH_DEBOUNCE_MS); }
  var DROPPED_SET = {};   // itemId -> true:被任一隻怪掉落過(由 buildIndexes 統一收集;用於判斷物品「有沒有怪掉的固定來源」)

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  ready(init);

  // 獨立頁:網址帶 ?view=dex 時,把掉落查詢鋪滿整頁(藏掉遊戲畫面),像一個獨立網頁。
  var VIEW = 'dex';
  function isStandalone() {
    try { return new URLSearchParams(location.search).get('view') === VIEW; } catch (e) { return false; }
  }
  function standaloneUrl() {
    return location.href.split('?')[0].split('#')[0] + '?view=' + VIEW;
  }
  // 🔗 通用跨頁:是否在「獨立頁」(任一 ?view=,不限本外掛)→ 決定連結走「網址」還是「模態」
  function inStandaloneView() { try { return !!new URLSearchParams(location.search).get('view'); } catch (e) { return false; } }

  // 🔇 獨立頁(?view=wiki / ?view=dex)不播背景音樂:小百科 / 掉落查詢是當「靜態查詢工具頁」開,
  //   不該有遊戲 BGM。作法:遊戲 BGM 引擎(js/17-audio.js)是在 DOMContentLoaded 才自我初始化的,
  //   而本外掛同步執行、早於 DOMContentLoaded,故在它啟動「之前」把 _bgmInit / _bgmSwitch 換成 no-op
  //   → 音樂從不啟動。刻意不呼叫 setBgmOn(false)(那會寫存檔 fb5_bgm、關掉玩家在遊戲內的 BGM 偏好);
  //   防呆:萬一載入順序意外、引擎已先跑,補呼叫 _bgmStopAll 收掉。本外掛在任一 ?view= 皆載入,
  //   inStandaloneView() 對 wiki / dex 都為真,故一處即同時涵蓋兩個獨立頁。
  (function () {
    if (!inStandaloneView()) return;
    try {
      if (typeof window._bgmInit === 'function') window._bgmInit = function () {};
      if (typeof window._bgmSwitch === 'function') window._bgmSwitch = function () {};
      if (typeof window._bgmStopAll === 'function') { try { window._bgmStopAll(); } catch (e) {} }
    } catch (e) {}
  })();
  // 🔗 通用「前往掉落查詢」(供小百科等任何跨頁連結重用):模態連模態、網址連網址。
  //    opts.q = 預設搜尋字。獨立頁 → 導去 ?view=dex&q=(dex 初始化讀 q 自動搜);模態(遊戲內) → 開 dex 模態並搜尋。
  function gotoDex(opts) {
    opts = opts || {};
    if (inStandaloneView()) {   // 網址連網址
      location.href = location.href.split('?')[0].split('#')[0] + '?view=' + VIEW + (opts.q ? '&q=' + encodeURIComponent(opts.q) : '');
      return;
    }
    var sib = !!(window.AFK_WIKI_API && AFK_WIKI_API.isOpen && AFK_WIKI_API.isOpen());   // 來源(小百科)模態是否開著
    if (sib && AFK_WIKI_API.close) AFK_WIKI_API.close();   // 模態連模態:先關來源模態(否則 dex 同 z-index 被它蓋住),它會交出歷史層
    if (_isPop()) userCloseTop();   // 在 dex 詳情彈窗內先關它(退一層歷史)
    openModal(sib);   // 從小百科切過來→接手它那層歷史(不另壓),返回鍵才不殘留
    var i = document.getElementById('m-dex-input'); if (i) i.value = opts.q || '';
    doSearch();
    var r = document.getElementById('m-dex-results'); if (r) r.scrollTop = 0;
  }
  // 跨頁切換用:關掉掉落查詢模態(含物品彈窗)並交出一層歷史(不 history.back,避免誤觸小百科 popstate),供對方接手顯示
  function closeForNav() { var m = document.getElementById('m-dex-modal'); if (m && !m.getAttribute('data-standalone')) m.classList.remove('open'); if (_isPop()) document.getElementById('m-dex-itempop').classList.remove('open'); if (_navDepth > 0) _navDepth--; }
  // 獨立頁:把目前搜尋字寫進網址(replaceState,不灌爆上一頁/下一頁),方便複製連結分享給別人
  function syncUrl() {
    if (!isStandalone()) return;
    try {
      var inp = document.getElementById('m-dex-input');
      var q = inp ? inp.value.trim() : '';
      history.replaceState(null, '', location.pathname + '?view=' + VIEW + (q ? '&q=' + encodeURIComponent(q) : ''));
    } catch (e) {}
  }

  function init() {
    if (typeof DB === 'undefined' || !DB || !DB.mobs || !DB.maps || !DB.items || typeof MOB_DROPS === 'undefined') {
      console.warn('[AFK-dex] 缺少遊戲資料(DB.mobs/maps/items/MOB_DROPS),查詢功能停用。');
      return;
    }
    injectCSS();
    buildIndexes();
    buildItemIndex();
    if (isStandalone()) { buildModal(); enterStandalone(); console.log('[AFK-dex] hooks OK — 掉落查詢獨立頁(' + INDEX.length + ' 隻怪)。'); return; }
    var menu = document.getElementById('main-menu');
    if (!menu) { console.warn('[AFK-dex] 找不到 #main-menu,查詢功能停用。'); return; }
    injectButton(menu);
    buildModal();
    injectAutoNav('m-afk-nav-dex', '📖 掉落查詢', openModal);   // 自動化設定面板:遊戲中也能開
    console.log('[AFK-dex] hooks OK — 怪物/掉落查詢已啟用(' + INDEX.length + ' 隻怪)。');
  }

  // 獨立頁:藏掉創角/遊戲畫面、改標題、隱藏關閉鈕,把面板常駐展開,並加頁首導覽。
  function enterStandalone() {
    var cs = document.getElementById('creation-screen'); if (cs) cs.style.display = 'none';
    var gs = document.getElementById('game-screen'); if (gs) gs.style.display = 'none';
    document.title = '怪物 / 掉落查詢 — 放置天堂';
    var m = document.getElementById('m-dex-modal');
    if (m) {
      m.setAttribute('data-standalone', '1');
      var x = document.getElementById('m-dex-close'); if (x) x.style.display = 'none';
    }
    buildStandaloneNav('dex');
    openModal();
    // 網址帶 ?q= 時自動帶入搜尋(分享連結用)
    try { var q0 = new URLSearchParams(location.search).get('q'); if (q0) { var inp = document.getElementById('m-dex-input'); if (inp) { inp.value = q0; doSearch(); } } } catch (e) {}
  }

  // 獨立頁頁首:首頁 / 小百科 / 掉落查詢 互切(與 afk-wiki 共用同一條,只在 active 標亮)。
  function buildStandaloneNav(active) {
    if (document.getElementById('m-standalone-nav')) return;
    var base = location.href.split('?')[0].split('#')[0];
    var nav = document.createElement('div');
    nav.id = 'm-standalone-nav';
    nav.innerHTML =
      '<a href="' + base + '">🏠 首頁</a>' +
      '<a href="' + base + '?view=wiki"' + (active === 'wiki' ? ' class="on"' : '') + '>📚 小百科</a>' +
      '<a href="' + base + '?view=dex"' + (active === 'dex' ? ' class="on"' : '') + '>📖 掉落查詢</a>';
    document.body.appendChild(nav);
  }

  // ----- 名稱查詢 ---------------------------------------------------------
  // CASTLE_EXTRA 類地圖(如風木地監)只有 getCastleAreas() 動態才有中文名、靜態表查不到,在這補上
  // 地圖 id → 中文名：統一委派 afk-extradata 的共用解析(唯一一份,涵蓋隱藏區/攀登/遺忘之島/攻城/村莊…)
  // 出沒地圖帶「領域」前綴(地圖改版後新人找圖用):「領域·地圖名」;委派共用解析,讀不到 helper 才退回純名
  function mapNameOf(id) { try { return (window.AFK_EXTRA && AFK_EXTRA.mapNameWithRegion) ? AFK_EXTRA.mapNameWithRegion(id) : ((window.AFK_EXTRA && AFK_EXTRA.mapName) ? AFK_EXTRA.mapName(id) : id); } catch (e) { return id; } }
  // 隱藏地圖(hidden_*)→ 進入方式說明:這些圖不在地圖選單,要在母樓層手動施放傳送術/用瞬間移動卷軸進入。key 用 mapNameOf(與 h.maps 同一套解析,確保對得上)。lazy 建一次。
  var _hiddenEntry = null;
  function hiddenEntryOf(mapName) {
    if (_hiddenEntry === null) {
      _hiddenEntry = {};
      try {
        if (typeof HIDDEN_AREA_NAMES !== 'undefined' && typeof HIDDEN_AREA_PARENT !== 'undefined') {
          var h2p = {}; for (var z in HIDDEN_AREA_PARENT) h2p[HIDDEN_AREA_PARENT[z]] = z;   // hidden_id → 母樓層 zone id
          for (var hid in HIDDEN_AREA_NAMES) { var pz = h2p[hid]; _hiddenEntry[mapNameOf(hid)] = pz ? ('隱藏區域：在「' + mapNameOf(pz) + '」手動施放傳送術／用瞬間移動卷軸進入') : '隱藏區域'; }
        }
      } catch (e) {}
    }
    return _hiddenEntry[mapName] || '';
  }
  // CASTLE_EXTRA 地圖(風木地監):攻城獲勝後才臨時開放的城堡狩獵區,不在地圖選單→出沒地圖後補上進入說明(同 hiddenEntryOf 模式)。key 用 mapNameOf,與 h.maps 同一套解析。lazy 建一次。
  var _castleCity = { windwood_dungeon: '風木城' };   // 城堡狩獵區→要攻下哪座城(作者新增別的城堡狩獵區時補這裡;小百科 afk-wiki 亦有一份)
  var _castleEntry = null;
  function castleEntryOf(mapName) {
    if (_castleEntry === null) {
      _castleEntry = {};
      try {
        if (typeof CASTLE_EXTRA !== 'undefined') CASTLE_EXTRA.forEach(function (v) { _castleEntry[mapNameOf(v)] = '攻下' + (_castleCity[v] || '對應城池') + '後才開放，勝利後 24 小時內'; });
      } catch (e) {}
    }
    return _castleEntry[mapName] || '';
  }
  function itemNameOf(id) { return (DB.items[id] && DB.items[id].n) ? DB.items[id].n : id; }
  // 職業限定掉落附註:試煉/兌換道具(TRIAL_ITEM_CLASS)僅該職業擊殺才掉,標「🔒僅X」讓所有職業都看得到是誰限定;非限定道具(書板/鎖鏈劍/印記等全職可掉)不在表內→回 null 不附註。
  var _CLS_CN = { knight: '騎士', mage: '法師', elf: '妖精', dark: '黑暗妖精', illusion: '幻術士', dragon: '龍騎士', warrior: '戰士', royal: '王族' };
  function trialClassOf(id) {
    try {
      if (typeof TRIAL_ITEM_CLASS !== 'undefined' && TRIAL_ITEM_CLASS[id]) {
        var c = TRIAL_ITEM_CLASS[id]; return (Array.isArray(c) ? c : [c]).map(function (x) { return _CLS_CN[x] || x; });
      }
    } catch (e) {}
    return null;
  }
  function trialClassNote(id) { var a = trialClassOf(id); return a ? ('🔒僅' + a.join('／')) : null; }

  // ----- 預先建索引(只跑一次) ---------------------------------------------
  function buildIndexes() {
    DROPPED_SET = {};
    var mobToMaps = {};
    for (var mid in DB.maps) (DB.maps[mid] || []).forEach(function (mob) { (mobToMaps[mob] = mobToMaps[mob] || []).push(mid); });
    for (var id in DB.mobs) {
      var mob = DB.mobs[id];
      // 去重:原作者的地圖怪物清單可能把同一隻怪列兩次(如 windwood 重複列杜賓狗),否則出沒地圖會出現兩個同名
      var maps = (mobToMaps[id] || []).map(mapNameOf).filter(function (n, i, a) { return a.indexOf(n) === i; });
      // 合併「全部掉落表」——必須與原作 _auditMobDrops 讀的「同一組」表,否則他統計查得到、我們查不到(戰士印記那批踩過)。
      // 目前 6 張:MOB_DROPS、黑暗武器(DARK_WEAPON_DROPS)、三階黑精靈水晶(DARK_CRYSTAL_DROPS)、龍騎士(DRAGON_DROPS)、戰士印記(WARRIOR_DROPS)、記憶水晶(MEM_DROPS·幻術士法術書)。
      // 都用「怪物名」當 key、格式 [[id,%]]。任何表裡的職業限定試煉道具(TRIAL_ITEM_CLASS)一律附註「🔒僅X」;非限定道具(書板/鎖鏈劍/戰士印記/記憶水晶等全職可掉)→trialClassNote 回 null、不附註。
      function _tagged(list) { return (list || []).map(function (e) { return [e[0], e[1], trialClassNote(e[0])]; }); }
      var raw = [].concat(
        _tagged((typeof MOB_DROPS !== 'undefined') ? MOB_DROPS[mob.n] : null),
        _tagged((typeof DARK_WEAPON_DROPS !== 'undefined') ? DARK_WEAPON_DROPS[mob.n] : null),
        _tagged((typeof DARK_CRYSTAL_DROPS !== 'undefined') ? DARK_CRYSTAL_DROPS[mob.n] : null),
        _tagged((typeof DRAGON_DROPS !== 'undefined') ? DRAGON_DROPS[mob.n] : null),
        _tagged((typeof WARRIOR_DROPS !== 'undefined') ? WARRIOR_DROPS[mob.n] : null),
        _tagged((typeof MEM_DROPS !== 'undefined') ? MEM_DROPS[mob.n] : null)
      );
      var drops = raw
        .map(function (e) { return [e[0], itemNameOf(e[0]), e[1], e[2]]; })   // [id, 名稱, 機率%, 附註]
        .filter(function (d) { return DB.items[d[0]]; });
      drops.forEach(function (d) { DROPPED_SET[d[0]] = true; });   // 記錄「這個物品有怪會掉」
      drops.sort(function (a, b) { return b[2] - a[2]; });   // 機率高→低
      var hay = (mob.n + ' ' + maps.join(' ') + ' ' + drops.map(function (d) { return d[1]; }).join(' ')).toLowerCase();
      INDEX.push({ id: id, mob: mob, maps: maps, drops: drops, hay: hay });
    }
    // 怪物等級低→高排序(同級以名稱排,讓結果順序穩定);所有搜尋結果都依此順序顯示
    INDEX.sort(function (a, b) { return (a.mob.lv || 0) - (b.mob.lv || 0) || String(a.mob.n).localeCompare(String(b.mob.n)); });
  }

  // 物品名稱索引:讓搜尋能直接點出物品看詳情——
  //   ① 所有裝備(武器/防具/飾品):含製作/兌換/任務取得、沒有怪會掉的(如 50 級試煉獎勵、傳說裝備)
  //   ② 商店有賣的非裝備(魔法書/藥水/卷軸/布料/精靈・黑暗水晶…):這些既不一定被怪掉、又不是裝備,
  //      不收的話「只有商店賣」的東西完全搜不到(使用者回報的就是這個);收進來才查得到、點開看「商店販售」。
  var ITEM_INDEX = [];
  function buildItemIndex() {
    ITEM_INDEX = [];
    var shopSet = {};
    if (typeof SHOP_LISTS !== 'undefined' && SHOP_LISTS) {
      for (var k in SHOP_LISTS) (SHOP_LISTS[k] || []).forEach(function (sid) { shopSet[sid] = true; });
    }
    if (_craftIndex === null) buildCraftIndex();   // ⑥ 需要「可製作」當收錄條件之一(下方)
    for (var id in DB.items) {
      var d = DB.items[id];
      if (!d || !d.n) continue;
      var isEquip = (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc');
      // ③ 有手動「取得方式」(itemAcquire)的:如龍騎士書板(skillbk、非商店、無怪掉)→ 兌換取得,收進來才搜得到
      var hasAcq = !!(window.AFK_EXTRA && AFK_EXTRA.itemAcquire && AFK_EXTRA.itemAcquire[id]);
      // ④ 在潘朵拉抽獎池(gachaWeight>0)的:雖無固定來源,但確實抽得到 → 也收進來,搜得到名字、詳情卡自動標「目前沒有固定取得途徑」
      //    (避免「明明拿得到卻完全查無」的死角;真正純內部用、gachaWeight=0 又無任何來源的維持排除、不灌爆搜尋)
      var inGacha = (d.gachaWeight > 0);
      // ⑤ 被任一隻怪掉落的(DROPPED_SET,buildIndexes 已先建好):非裝備但有怪掉的法術書/材料(如記憶水晶=幻術士法術書·gachaWeight=0 那批)
      //    才搜得到名字、詳情卡會列出哪些怪會掉。掉落查詢本就是查「掉落」,有怪掉的東西理應能直接搜名字。
      var isDropped = !!DROPPED_SET[id];
      // ⑥ 可製作的成品/中間材料(如「黑色米索莉金屬板」=炎魔鐵匠製作、無怪掉、非商店、gachaWeight=0)→ 收進來才搜得到名字,
      //    詳情卡已有 🔨 製作 區塊(craftInfoHTML)會列出在哪個 NPC、用什麼材料。沒這條這類材料整個查無(使用者常被問怎麼拿)。
      var isCraftable = !!(_craftIndex && _craftIndex[id]);
      if (!isEquip && !shopSet[id] && !hasAcq && !inGacha && !isDropped && !isCraftable) continue;
      ITEM_INDEX.push({ id: id, n: d.n, hay: String(d.n).toLowerCase() });
    }
    ITEM_INDEX.sort(function (a, b) { return a.n.length - b.n.length || a.n.localeCompare(b.n); });   // 名稱短的(較接近完整匹配)排前面
  }
  var ITEM_MATCH_MAX = 24;
  function itemMatchesHTML(q) {
    var ms = [];
    for (var i = 0; i < ITEM_INDEX.length && ms.length <= ITEM_MATCH_MAX; i++) if (ITEM_INDEX[i].hay.indexOf(q) >= 0) ms.push(ITEM_INDEX[i]);
    if (!ms.length) return '';
    var more = ms.length > ITEM_MATCH_MAX; if (more) ms = ms.slice(0, ITEM_MATCH_MAX);
    var names = ms.map(function (it) { return '<span class="m-dex-iname" data-id="' + esc(it.id) + '" title="看數值">' + hl(it.n, q) + '</span>'; }).join('、');
    return '<div class="m-dex-card"><div class="m-dex-imatch-h">🔎 符合的物品（點名稱看詳情）</div><div class="m-dex-imatch">' + names + (more ? '　…還有更多，請輸入更精確的名稱' : '') + '</div></div>';
  }

  // ----- 跨外掛統一搜尋 ---------------------------------------------------
  // 供小百科呼叫:回傳命中的怪物/物品名稱摘要(不渲染、不動面板;索引在 init 就建好,隨時可查)
  function searchSummary(q, max) {
    q = String(q || '').trim().toLowerCase();
    if (!q || !INDEX.length) return null;
    max = max || 16;
    var qs = [q];
    if (q.indexOf(' ') >= 0) qs = qs.concat(q.split(/\s+/).filter(Boolean));   // 多詞時整串優先、再各詞補位(本索引是單字串比對)
    var mobs = [], items = [], seen = {};
    qs.forEach(function (w) {
      for (var i = 0; i < INDEX.length && mobs.length < max; i++) {
        var e = INDEX[i];
        if (e.hay.indexOf(w) >= 0 && !seen['m' + e.mob.n]) { seen['m' + e.mob.n] = 1; mobs.push({ n: e.mob.n, lv: e.mob.lv || 0 }); }
      }
      for (var j = 0; j < ITEM_INDEX.length && items.length < max; j++) {
        var it = ITEM_INDEX[j];
        if (it.hay.indexOf(w) >= 0 && !seen['i' + it.n]) { seen['i' + it.n] = 1; items.push(it.n); }
      }
    });
    return { mobs: mobs, items: items };
  }
  // 📚 小百科的命中摘要卡(點任一項→AFK_WIKI_API.goto({q}) 開小百科統一搜尋;gotoWiki 會自動關本模態/獨立頁走網址)
  function wikiHitsHTML(qRaw) {
    try {
      if (!window.AFK_WIKI_API || !AFK_WIKI_API.searchHits) return '';
      var ws = AFK_WIKI_API.searchHits(qRaw, 8);
      if (!ws || !ws.length) return '';
      var rows = ws.map(function (w) {
        return '<div class="m-dex-wikihit" data-q="' + esc(qRaw) + '">【' + esc(w.label) + '】' + hl(w.title, qRaw.toLowerCase()) + '</div>';
      }).join('');
      return '<div class="m-dex-card"><div class="m-dex-imatch-h">📚 小百科相關內容（點任一項前往搜尋）</div>' + rows + '</div>';
    } catch (e) { return ''; }
  }

  // ----- 搜尋 + 渲染 ------------------------------------------------------
  function doSearch() {
    if (_searchTimer) { clearTimeout(_searchTimer); _searchTimer = null; }   // 直接呼叫(清除鈕/書籤/URL)蓋過待觸發的防抖
    var input = document.getElementById('m-dex-input');
    var results = document.getElementById('m-dex-results');
    if (!input || !results) return;
    syncUrl();   // 同步搜尋字到網址(獨立頁才會動)
    var modeEl = document.getElementById('m-dex-mode');
    var mult = modeEl ? parseFloat(modeEl.value) : 1;
    var clearBtn = document.getElementById('m-dex-clear');
    if (clearBtn) clearBtn.classList.toggle('show', !!input.value);   // 有字才顯示清除鈕
    var q = (input.value || '').trim().toLowerCase();
    if (!q) { results.innerHTML = '<div class="m-dex-hint">輸入 怪物名 / 地圖 / 掉落物 開始搜尋；搜物品名可直接點看詳情</div>'; return; }
    // 全域特殊掉落規則:每條只要「內文含查詢字」或「關鍵字雙向命中」就展開+金框+標色,可同時多條(如搜「祝福」會中 賦予祝福卷軸 與 施法卷軸)
    var special = false, firstHit = null;
    Array.prototype.forEach.call(document.querySelectorAll('.m-dex-sp-item'), function (it) {
      it.classList.remove('m-dex-sp-hit'); clearMarksIn(it);
      var b = SPECIAL_BY_ID[it.getAttribute('data-spid')];
      var textMatch = it.textContent.toLowerCase().indexOf(q) >= 0;
      var keyMatch = b && b.keys.some(function (k) { k = k.toLowerCase(); return k.indexOf(q) >= 0 || q.indexOf(k) >= 0; });
      if (textMatch || keyMatch) { special = true; if (!firstHit) firstHit = it; it.open = true; it.classList.add('m-dex-sp-hit'); markIn(it, q); }
    });
    if (special) { var sp = document.getElementById('m-dex-special'); if (sp) sp.open = true; if (firstHit) try { firstHit.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
    var itemHTML = itemMatchesHTML(q);   // 先列出名稱符合的裝備(可點看數值;含沒被怪掉的)
    var wikiHTML = wikiHitsHTML(input.value.trim());   // 📚 小百科命中一併附在結果尾端(統一搜尋)
    var hits = [];
    for (var i = 0; i < INDEX.length && hits.length <= MAX_RESULTS; i++) if (INDEX[i].hay.indexOf(q) >= 0) hits.push(INDEX[i]);
    if (!hits.length) {
      if (itemHTML) { results.innerHTML = itemHTML + (special ? '<div class="m-dex-hint">另見下方<b>「全域特殊掉落規則」</b>。</div>' : '<div class="m-dex-hint">（上面這些物品沒有固定掉落的怪，多為商店／製作／兌換／任務取得）</div>') + wikiHTML; return; }
      results.innerHTML = (special
        ? '<div class="m-dex-hint">「' + esc(input.value.trim()) + '」沒有固定掉落的怪物，請見下方<b>「全域特殊掉落規則」</b>。</div>'
        : '<div class="m-dex-hint">找不到符合的怪物或裝備</div>') + wikiHTML;
      return;
    }
    var truncated = hits.length > MAX_RESULTS;
    if (truncated) hits = hits.slice(0, MAX_RESULTS);
    var html = itemHTML + hits.map(function (h) { return cardHTML(h, mult, q); }).join('');
    if (truncated) html += '<div class="m-dex-hint">符合的太多,只顯示前 ' + MAX_RESULTS + ' 筆,請輸入更精確的關鍵字。</div>';
    results.innerHTML = html + wikiHTML;
  }

  var ELE = { fire: '🔥 火', water: '💧 水', earth: '🪨 地', wind: '🌪 風', none: '無' };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // 把符合搜尋字串的部分用 <mark> 標色(不分大小寫;在已跳脫的字串上比對,Chinese 無大小寫問題)
  function hl(text, q) {
    var s = esc(text);
    if (!q) return s;
    var eq = esc(q); if (!eq) return s;
    var low = s.toLowerCase(), elow = eq.toLowerCase(), out = '', i = 0, idx;
    while ((idx = low.indexOf(elow, i)) >= 0) {
      out += s.slice(i, idx) + '<mark class="m-dex-hl">' + s.slice(idx, idx + eq.length) + '</mark>';
      i = idx + eq.length;
    }
    return out + s.slice(i);
  }
  // DOM 版高亮(給已渲染好的靜態區塊用,如特殊掉落規則):只動文字節點、不破壞既有 <b> 標籤
  function clearMarksIn(el) {
    if (!el) return;
    var ms = el.querySelectorAll('mark.m-dex-hl');
    for (var i = 0; i < ms.length; i++) { var m = ms[i]; m.parentNode.replaceChild(document.createTextNode(m.textContent), m); }
    el.normalize();
  }
  function markIn(el, q) {
    clearMarksIn(el);
    if (!el || !q) return;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var txt = node.nodeValue, low = txt.toLowerCase(), idx = low.indexOf(q);
      if (idx < 0) return;
      var frag = document.createDocumentFragment(), pos = 0;
      while (idx >= 0) {
        if (idx > pos) frag.appendChild(document.createTextNode(txt.slice(pos, idx)));
        var mk = document.createElement('mark'); mk.className = 'm-dex-hl'; mk.textContent = txt.slice(idx, idx + q.length);
        frag.appendChild(mk);
        pos = idx + q.length; idx = low.indexOf(q, pos);
      }
      if (pos < txt.length) frag.appendChild(document.createTextNode(txt.slice(pos)));
      node.parentNode.replaceChild(frag, node);
    });
  }
  function fmt(n) { try { return (n == null ? '-' : Number(n).toLocaleString()); } catch (e) { return '' + n; } }
  function fmtPct(p) { return p < 0.01 ? (p < 0.001 ? p.toFixed(4) : p.toFixed(3)) : (p < 1 ? p.toFixed(2) : (Number.isInteger(p) ? '' + p : p.toFixed(1))); }
  function st(k, v) { return '<span class="m-dex-stat"><b>' + k + '</b> ' + esc(v) + '</span>'; }
  function sgn(v) { return (v > 0 ? '+' : '') + v; }   // 帶正負號:正數加「+」、負數本身就有「-」(避免「+-10」)

  // ----- 製作資訊:讀遊戲 CRAFT_RECIPES(物品→在哪個 NPC、要什麼材料);作者加新配方自動出現 ------
  var _craftIndex = null;   // itemId -> [{npcId, req, yield}]
  var _npcInfo = null;      // npcId -> {name, town}
  function buildCraftIndex() {
    _craftIndex = {};
    if (typeof CRAFT_RECIPES === 'undefined' || !CRAFT_RECIPES) return;
    for (var npcId in CRAFT_RECIPES) {
      (CRAFT_RECIPES[npcId] || []).forEach(function (r) {
        if (!r || !r.result) return;
        (_craftIndex[r.result] = _craftIndex[r.result] || []).push({ npcId: npcId, req: r.req || [], yield: r.yield || 1 });
      });
    }
    // 👑 惡魔王武器:炎魔之影客製製作(消耗 +11 以上指定惡魔武器 + 素材,不在 CRAFT_RECIPES 裡,要另外補)
    if (typeof DEMONKING_RECIPES !== 'undefined' && DEMONKING_RECIPES) {
      var dkMats = (typeof DEMONKING_MATS !== 'undefined' && DEMONKING_MATS) ? DEMONKING_MATS : [];
      DEMONKING_RECIPES.forEach(function (r) {
        if (!r || !r.result) return;
        var req = [{ id: r.src, cnt: 1, plus11: true }].concat(dkMats);
        (_craftIndex[r.result] = _craftIndex[r.result] || []).push({ npcId: 'npc_flame_shadow', req: req, yield: 1, note: '消耗 +11 以上的指定惡魔武器，會繼承它的強化值／詞綴／席琳套裝效果' });
      });
    }
    // ⚔️ 神聖執行團裝備:琉米埃爾客製製作(消耗 +7 以上戰士團頭盔/斗篷 + 素材,不在 CRAFT_RECIPES 裡,要另外補)
    if (typeof LUMIEL_RECIPES !== 'undefined' && LUMIEL_RECIPES) {
      LUMIEL_RECIPES.forEach(function (r) {
        if (!r || !r.result) return;
        var req = [{ id: r.src, cnt: 1, plus7: true }].concat(r.mats || []);
        (_craftIndex[r.result] = _craftIndex[r.result] || []).push({ npcId: 'npc_lumiel', req: req, yield: 1, note: '消耗 +7 以上的「' + (r.srcName || r.src) + '」，會繼承它的強化值／詞綴／席琳套裝效果' });
      });
    }
  }
  function buildNpcInfo() {
    _npcInfo = {};
    try {
      if (typeof DB === 'undefined' || !DB.towns) return;
      for (var tid in DB.towns) {
        var t = DB.towns[tid]; if (!t || !t.npcs) continue;
        t.npcs.forEach(function (n) { if (n && n.id && !_npcInfo[n.id]) _npcInfo[n.id] = { name: n.n, town: t.n }; });
      }
    } catch (e) {}
  }
  function craftInfoHTML(id) {
    if (_craftIndex === null) buildCraftIndex();
    if (_npcInfo === null) buildNpcInfo();
    var recs = _craftIndex[id];
    if (!recs || !recs.length) return '';
    var blocks = recs.map(function (rec) {
      var npc = _npcInfo[rec.npcId] || { name: rec.npcId, town: '' };
      var where = esc(npc.name) + (npc.town ? '（' + esc(npc.town) + '）' : '');
      var mats = rec.req.map(function (m) {
        if (m.id === 'gold') return '金幣 ×' + m.cnt;   // 金幣是貨幣(存 player.gold、不在 DB.items)→ 給中文、不做 dexlink(否則 fallback 會露出英文 "gold")
        var mn = (DB.items[m.id] && DB.items[m.id].n) || m.id;
        return '<span class="m-dexlink" data-dexq="' + esc(mn) + '">' + esc(mn) + '</span>' + (m.plus11 ? '（須 +11 以上）' : m.plus7 ? '（須 +7 以上）' : '') + ' ×' + m.cnt;   // 🔗 材料名可點→查它哪來
      }).join('、');
      var y = (rec.yield && rec.yield > 1) ? '（一次產出 ' + rec.yield + ' 個）' : '';
      return '<div class="m-dex-craft-where">在 <b>' + where + '</b> 製作' + y + '</div>' +
        '<div class="m-dex-craft-mats">材料：' + (mats || '—') + '</div>' +
        (rec.note ? '<div class="m-dex-craft-mats">' + esc(rec.note) + '</div>' : '');
    }).join('');
    return '<div class="m-dex-craft"><div class="m-dex-craft-h">🔨 製作</div>' + blocks + '</div>';
  }

  // ----- 商店販售:讀遊戲 SHOP_LISTS(NPC→販售物品)+ DB.towns(NPC→村莊) ------------
  //   潘朵拉黑市是 type:"exchange"、不在 SHOP_LISTS,故自然不列入(使用者要求不列)。
  //   通用消耗品(SHOP_LISTS.default,各村雜貨商人都賣)歸成一句「各村莊雜貨商人」,不逐家列;
  //   具名商人(武器商溫諾、魔法商巴耶斯、精靈水晶琳達…)只列「該商人獨有/非通用」的品項。
  var _shopIndex = null;   // itemId -> { specific: [{name, town}], general: bool }
  function buildShopIndex() {
    _shopIndex = {};
    if (typeof SHOP_LISTS === 'undefined' || !SHOP_LISTS) return;
    if (_npcInfo === null) buildNpcInfo();
    var defaultSet = {};
    (SHOP_LISTS.default || []).forEach(function (id) { defaultSet[id] = true; });
    for (var npcId in SHOP_LISTS) {
      if (npcId === 'default') continue;
      var info = _npcInfo[npcId] || { name: npcId, town: '' };
      (SHOP_LISTS[npcId] || []).forEach(function (id) {
        if (defaultSet[id]) return;   // 通用消耗品 → 歸「各村莊雜貨商人」,不重複掛在具名商人下
        var e = (_shopIndex[id] = _shopIndex[id] || { specific: [], general: false });
        if (!e.specific.some(function (s) { return s.name === info.name && s.town === info.town; })) e.specific.push({ name: info.name, town: info.town });
      });
    }
    (SHOP_LISTS.default || []).forEach(function (id) {
      (_shopIndex[id] = _shopIndex[id] || { specific: [], general: false }).general = true;
    });
  }
  // 箭/銀箭/肉:商店以「1000 個一組」的固定價賣,不是用 d.p(對齊遊戲 renderShopItems 的特例);其餘用定價 d.p。
  var SHOP_BUNDLE_PRICE = {
    wpn_5: { base: 100, unit: '1000 根' }, wpn_22: { base: 200, unit: '1000 根' }, new_item_143: { base: 100, unit: '1000 個' }
  };
  function shopBuyPrice(id) {
    if (SHOP_BUNDLE_PRICE[id]) return SHOP_BUNDLE_PRICE[id];
    var d = DB.items[id];
    return (d && d.p) ? { base: d.p, unit: '' } : null;
  }
  function shopInfoHTML(id) {
    if (_shopIndex === null) buildShopIndex();
    var e = _shopIndex[id];
    if (!e) return '';
    var lines = e.specific.map(function (s) {
      return '<div class="m-dex-craft-where">在 <b>' + esc(s.name) + (s.town ? '（' + esc(s.town) + '）' : '') + '</b> 販售</div>';
    });
    if (e.general) lines.push('<div class="m-dex-craft-where">各村莊雜貨商人皆有販售</div>');
    if (!lines.length) return '';
    var pr = shopBuyPrice(id);
    var priceLine = pr ? '<div class="m-dex-craft-mats">售價：' + pr.base.toLocaleString() + ' 金幣' + (pr.unit ? '（' + pr.unit + '）' : '') + '；攻城獲勝期間 8 折</div>' : '';
    return '<div class="m-dex-craft"><div class="m-dex-craft-h">🏪 商店販售</div>' + priceLine + lines.join('') + '</div>';
  }

  // 物品「有沒有固定取得來源」:怪掉 / 商店 / 製作 / 手動取得方式(itemAcquire,含兌換·試煉·靈魂之球喚回)。
  //   不含潘朵拉抽獎(隨機池,依規則不算取得方式)。用於詳情卡:有來源就由各區塊各自呈現;查無才補中性句。
  function hasFixedSource(id) {
    if (DB.items[id] && DB.items[id].slot === 'doll') return true;            // 🎎 魔法娃娃:袋子/盒子/合成/卡片兌換/商人購買(非 MOB_DROPS),取得方式見 acquireHTML
    if (DROPPED_SET[id]) return true;                                         // 有怪會掉
    if (_craftIndex === null) buildCraftIndex();
    if (_craftIndex[id]) return true;                                         // 可製作
    if (_shopIndex === null) buildShopIndex();
    if (_shopIndex[id]) return true;                                          // 商店販售
    var acq = (window.AFK_EXTRA && AFK_EXTRA.itemAcquire) ? AFK_EXTRA.itemAcquire[id] : null;
    if (acq && acq.short) return true;                                        // 手動補的取得方式(兌換/試煉/喚回…)
    var bt = boxTiersOf(id); if (bt && bt.length) return true;                // 歐西里斯寶箱開出(底比斯武器)
    return !!trialSourceOf(id);                                               // 各職業試煉/兌換結構成品(50級試煉/希蓮恩/多文/普洛凱爾/尤麗婭/黑暗試煉)
  }

  // ===== 對外 API:給小百科「裝備」分頁重用「取得方式」呈現(手動/製作/商店/怪物掉落) =====
  //   小百科裝備頁的「數值」用遊戲自己的 buildItemDescHTML,取得方式則接這裡(與掉落查詢同一套來源判斷)。
  var _dropBy = null;   // itemId -> [怪名…](去重):哪些怪會掉這件
  function buildDropBy() {
    _dropBy = {};
    INDEX.forEach(function (h) {
      (h.drops || []).forEach(function (dr) {
        var iid = dr[0]; if (!iid) return;
        var arr = (_dropBy[iid] = _dropBy[iid] || []);
        if (arr.indexOf(h.mob.n) < 0) arr.push(h.mob.n);
      });
    });
  }
  // 歐西里斯寶箱開出的物品(讀遊戲獎勵池 OSIRIS_BOX_*,作者改池自動跟上);底比斯武器只此來源,否則會誤標「沒有固定取得途徑」
  var _boxBy = null;   // itemId -> { 初級, 高級 }
  function buildBoxBy() {
    _boxBy = {};
    function add(tbl, label) { if (typeof tbl === 'undefined' || !tbl) return; tbl.forEach(function (e) { var iid = e[0]; if (!iid) return; (_boxBy[iid] = _boxBy[iid] || {})[label] = 1; }); }
    try { add(OSIRIS_BOX_BASIC, '初級'); } catch (e) {}
    try { add(OSIRIS_BOX_HIGH, '高級'); } catch (e) {}
  }
  function boxTiersOf(id) { if (_boxBy === null) buildBoxBy(); return _boxBy[id] ? Object.keys(_boxBy[id]) : null; }
  // 各種「試煉／兌換設定結構」的成品(讀遊戲全域設定,作者改設定自動跟上)。這些不在 MOB_DROPS/商店/製作,
  //   否則會誤標「沒有固定取得途徑」(瑪那水晶球等踩過)。回傳一句白話來源,沒有則 null。
  var _trialBy = null;   // itemId -> 來源說明
  // NPC 名 → 所在村莊名(掃 DB.towns,作者搬 NPC 自動跟上);查不到回空字串、顯示端不加括號
  function npcTownName(npc) {
    try { for (var tid in DB.towns) { var tw = DB.towns[tid]; if ((tw.npcs || []).some(function (n) { return n && n.n === npc; })) return tw.n || ''; } } catch (e) {}
    return '';
  }
  function npcWithTown(npc) { var t = npcTownName(npc); return (npc || '') + (t ? '（' + t + '）' : ''); }
  function buildTrialBy() {
    _trialBy = {};
    var put = function (id, label) { if (id && !_trialBy[id]) _trialBy[id] = label; };
    try { for (var c in TRIAL_50_CFG) { var t = TRIAL_50_CFG[c]; (t.rewards || []).forEach(function (r) { put(r.id || r, npcWithTown(t.npc) + ' 的 50 級試煉：以「' + (t.exMatNm || '指定材料') + '」兌換'); }); } } catch (e) {}
    try { for (var k in DARK_TRIAL_CFG) { var c2 = DARK_TRIAL_CFG[k]; put(c2.reward, npcWithTown(c2.npc) + '：以「' + (c2.reqName || '指定道具') + '」兌換'); } } catch (e) {}
    try { for (var k2 in SHENIEN_EX) (SHENIEN_EX[k2].rewards || []).forEach(function (id) { put(id, '希蓮恩（希培利亞村莊）試煉兌換'); }); } catch (e) {}
    try { for (var k3 in WARRIOR_EX) (WARRIOR_EX[k3].rewards || []).forEach(function (id) { put(id, '多文（海音）戰士試煉兌換'); }); } catch (e) {}
    try { for (var k4 in PROCEL_EX) (PROCEL_EX[k4].rewards || []).forEach(function (id) { put(id, '普洛凱爾（貝希摩斯）龍騎士兌換'); }); } catch (e) {}
    try { YURIA_REWARDS.forEach(function (r) { put(r.id, '尤麗婭（說話之島）：以「歐林的日記本」兌換（三選一）'); }); } catch (e) {}
    try { YURIA_HATIN_REWARDS.forEach(function (r) { put(r.id, '尤麗婭（說話之島）：以「黑暗哈汀的日記本」兌換（六選一）'); }); } catch (e) {}   // 👹 隱藏的魔族武器
    try { SHIMIZHE_REWARDS.forEach(function (id) { put(id, '希米哲（海賊島村莊）：以「兒子的信＋遺骸＋肖像畫」各 1 兌換（五選一・無限次）'); }); } catch (e) {}   // 🏴‍☠️ 藍海賊裝備
    try { put('acc_summon_ctrl', '雷德（銀騎士村）：以五枚部下證明戒指＋魔法寶石 ×100 兌換'); } catch (e) {}   // RED_QUEST_REQS / doRedExchange 的成品(召喚控制戒指)
  }
  function trialSourceOf(id) { if (_trialBy === null) buildTrialBy(); return _trialBy[id] || null; }
  function acquireHTML(id) {
    if (!INDEX.length) buildIndexes();
    if (_dropBy === null) buildDropBy();
    var d = DB.items[id]; if (!d) return '';
    var parts = [];
    var _tc = trialClassOf(id);
    if (_tc) parts.push('<div class="m-dex-craft"><div class="m-dex-craft-h">🔒 職業限定</div><div class="m-dex-craft-mats">只有 <b>' + _tc.join('／') + '</b> 擊殺對應怪物才會掉落（其他職業打同一隻怪不會掉、掉落查詢也標「🔒僅' + _tc.join('／') + '」）。</div></div>');
    var exa = (window.AFK_EXTRA && AFK_EXTRA.itemAcquire) ? AFK_EXTRA.itemAcquire[id] : null;
    if (exa && exa.short) parts.push('<div class="m-dex-craft"><div class="m-dex-craft-h">🔑 取得方式</div><div class="m-dex-craft-mats">' + esc(exa.short) + '</div></div>');
    parts.push(craftInfoHTML(id));
    parts.push(shopInfoHTML(id));
    var mobs = _dropBy[id];
    if (mobs && mobs.length) {
      var cap = 12, more = mobs.length > cap;
      parts.push('<div class="m-dex-craft"><div class="m-dex-craft-h">👹 怪物掉落</div><div class="m-dex-craft-mats">' +
        mobs.slice(0, cap).map(esc).join('、') + (more ? ' …等 ' + mobs.length + ' 種' : '') + '（機率見掉落查詢）</div></div>');
    }
    var tiers = boxTiersOf(id);
    if (tiers && tiers.length) {
      parts.push('<div class="m-dex-craft"><div class="m-dex-craft-h">🎁 寶箱開出</div><div class="m-dex-craft-mats">開「上鎖的歐西里斯寶箱（' + tiers.join('／') + '）」隨機獲得，每開消耗 1 顆 龜裂之核（寶箱由碎片合成；碎片／高級寶箱由底比斯怪掉落）</div></div>');
    }
    var ts = (exa && exa.short) ? null : trialSourceOf(id);   // 已有手動 note 就不重複;否則補試煉/兌換來源
    if (ts) parts.push('<div class="m-dex-craft"><div class="m-dex-craft-h">🎓 試煉／兌換</div><div class="m-dex-craft-mats">' + esc(ts) + '</div></div>');
    if (d.slot === 'doll') parts.push('<div class="m-dex-craft"><div class="m-dex-craft-h">🎎 魔法娃娃</div><div class="m-dex-craft-mats">開「魔法娃娃的袋子／高級魔法娃娃的盒子」隨機取得，或由低一階娃娃合成。袋子用重複「銀卡」兌換、盒子用重複「金卡」兌換（需該怪卡片圖鑑已開到金階）。</div></div>');
    var body = parts.filter(Boolean).join('');
    if (body) return body;
    return '<div class="m-dex-craft"><div class="m-dex-craft-mats" style="color:#94a3b8;">目前沒有固定取得途徑</div></div>';
  }
  window.AFK_DEX_API = { acquireHTML: acquireHTML, itemDetailHTML: itemDetailHTML, goto: gotoDex, close: closeForNav, isOpen: _isModalClosable, searchSummary: searchSummary };   // goto({q}) 通用跨頁前往掉落查詢;close/isOpen 供跨頁切換(關閉來源、接手歷史層);searchSummary 供小百科統一搜尋

  // ----- 物品詳情彈窗(點掉落物名字 → 顯示遊戲內數值與圖示) ------------------
  var IT_TYPE = { wpn: '武器', arm: '防具', acc: '飾品', pot: '藥水', scroll: '卷軸', skillbk: '魔法書', misc: '道具', etc: '道具' };
  var IT_SLOT = { helm: '頭盔', armor: '盔甲', boots: '長靴', gloves: '手套', shield: '盾牌', cloak: '斗篷', belt: '腰帶', ring: '戒指', amulet: '項鍊', doll: '娃娃' };
  function _baseInst(id) { return { id: id, uid: 0, cnt: 1, en: 0, bless: false, anc: false, attr: false, seteff: false, lock: false, junk: false }; }
  function itemDetailHTML(id, opts) {
    opts = opts || {};   // 🔧 noHead:不要圖示+名稱列(呼叫端自己有名稱,如小百科裝備卡)。「查掉落」鈕一律帶(只在有怪掉時)、click 走全域 handler,dex 內或小百科裝備頁皆可用
    var d = DB.items[id];
    if (!d) return '<div class="m-dex-hint">查無此物品資料。</div>';
    var icon = '';
    try { icon = (typeof getIconUrl === 'function') ? getIconUrl(d) : ''; } catch (e) {}
    var img = icon ? '<img class="m-dex-iimg" src="' + esc(icon) + '" alt="" onerror="this.style.display=\'none\'">' : '';
    var nameCls = d.legend ? ' c-legend' : '';
    var head = opts.noHead ? '' : ('<div class="m-dex-ihead">' + img + '<div class="m-dex-iname-big' + nameCls + '">' + esc(d.n) + '</div></div>');
    var handTxt = (d.type === 'wpn' && typeof isTwoHandedWpn === 'function') ? ('・' + (isTwoHandedWpn(d) ? '雙手' : '單手')) : '';   // 🗡️ 武器標單手/雙手(用遊戲 isTwoHandedWpn:弓或w2h且非oneHand=雙手)
    var typeLine = '<div style="color:#94a3b8;font-size:12px;margin:2px 0 4px;">' + esc(IT_TYPE[d.type] || d.type || '道具') + (d.slot ? '・' + esc(IT_SLOT[d.slot] || d.slot) : '') + handTxt + '</div>';
    // 數值/說明:用遊戲自己的 buildItemDescHTML(全物品共用、與遊戲內顯示一致、作者新增裝備/特效自動跟上),
    //   base 實例(en:0、無詞綴)。失敗或空(如無描述材料)則退回顯示物品說明文字。適用職業 logo 由它產生,點擊有 tip(afk-fixes#7)。
    var gameHTML = '';
    try { if (typeof buildItemDescHTML === 'function') gameHTML = buildItemDescHTML(_baseInst(id)); } catch (e) {}
    if (!gameHTML) gameHTML = d.d || '';
    var body = gameHTML ? '<div style="line-height:1.8;margin:4px 0;">' + gameHTML + '</div>' : '';
    // 攻擊速度:遊戲的 buildItemDescHTML 不顯示武器攻速,在這補回(讀 DB 的 spd=每次攻擊間隔秒數,越低越快;未填預設 1.0,與戰鬥碼 wpn.spd 同源)
    var spdLine = '';
    if (d.type === 'wpn') {
      var spd = (d.spd != null) ? d.spd : 1.0;
      spdLine = '<div style="line-height:1.8;margin:4px 0;"><span class="text-orange-300">攻擊速度: 每 ' + spd + ' 秒一次（數值越低攻擊越快）</span></div>';
      // 強化最終傷害上限:依稀有度分五檔(讀遊戲 wpnEnCurveMax,作者調整分檔自動跟上);noEnhance 武器不能強化故不顯示
      if (!d.noEnhance && typeof wpnEnCurveMax === 'function') {
        spdLine += '<div style="line-height:1.8;margin:4px 0;"><span class="text-amber-300">強化最終傷害: +20 時最高 ×' + wpnEnCurveMax(d).toFixed(2) + '（依稀有度分檔 ×1.50～×2.50，越強化倍率越高）</span></div>';
      }
    }
    var priceLine = d.p ? '<div class="m-dex-craft-mats" style="color:#cbd5e1;">賣店價：' + Math.floor(d.p * 0.3).toLocaleString() + ' 金幣</div>' : '';
    // 取得方式:手動補(itemAcquire)/ 歐西里斯寶箱 / 中性句;製作、商店、查掉落鈕沿用
    var acq = '';
    var exAcq = (window.AFK_EXTRA && AFK_EXTRA.itemAcquire) ? AFK_EXTRA.itemAcquire[id] : null;
    var tiers = boxTiersOf(id);
    if (exAcq && exAcq.short) acq += '<div class="m-dex-craft"><div class="m-dex-craft-h">🔑 取得方式</div><div class="m-dex-craft-mats">' + esc(exAcq.short) + '</div></div>';
    if (tiers && tiers.length) acq += '<div class="m-dex-craft"><div class="m-dex-craft-h">🎁 寶箱開出</div><div class="m-dex-craft-mats">開「上鎖的歐西里斯寶箱（' + tiers.join('／') + '）」隨機獲得（每開消耗 1 顆 龜裂之核）</div></div>';
    var ts2 = (exAcq && exAcq.short) ? null : trialSourceOf(id);
    if (ts2) acq += '<div class="m-dex-craft"><div class="m-dex-craft-h">🎓 試煉／兌換</div><div class="m-dex-craft-mats">' + esc(ts2) + '</div></div>';
    if (!(exAcq && exAcq.short) && !(tiers && tiers.length) && !ts2 && !hasFixedSource(id)) acq += '<div class="m-dex-craft"><div class="m-dex-craft-mats" style="color:#94a3b8;">取得方式：目前沒有固定取得途徑</div></div>';
    var _tc = trialClassOf(id);
    var trialLine = _tc ? '<div class="m-dex-craft" style="margin:4px 0;border-left:3px solid #b45309;padding-left:7px;"><div class="m-dex-craft-h">🔒 職業限定</div><div class="m-dex-craft-mats">只有 <b>' + _tc.join('／') + '</b> 擊殺對應怪物才會掉落（其他職業打同一隻怪不會掉）。</div></div>' : '';
    // 「查有哪些怪會掉這件」鈕:只在真的有怪會掉時顯示(純製作/兌換成品不顯示);click 由全域 handler 接 → dex 詳情彈窗內 或 小百科裝備頁 點到都會開掉落查詢並以物品名搜尋
    if (_dropBy === null) buildDropBy();
    var tail = (_dropBy[id] && _dropBy[id].length) ? '<button class="m-dex-pop-search" data-item="' + esc(d.n) + '">🔍 查有哪些怪會掉這件</button>' : '';
    return head + typeLine + trialLine + body + spdLine + priceLine + craftInfoHTML(id) + shopInfoHTML(id) + acq + tail;
  }
  function openItemPop(id) {
    var pop = document.getElementById('m-dex-itempop'); if (!pop) return;
    var wasOpen = pop.classList.contains('open');
    document.getElementById('m-dex-itempop-body').innerHTML = itemDetailHTML(id);
    pop.classList.add('open');
    var c = document.getElementById('m-dex-itempop-card'); if (c) c.scrollTop = 0;
    if (!wasOpen) _pushNav();   // 開啟(非同層換內容)才壓一層歷史 → 手機返回鍵可關
  }
  function closeItemPop() { var pop = document.getElementById('m-dex-itempop'); if (pop) pop.classList.remove('open'); }

  // ----- 手機返回鍵 / ESC 關閉(以 history state 鏡射 modal→物品彈窗 兩層) -----
  var _navDepth = 0, _suppressPop = false;
  function _isPop() { var p = document.getElementById('m-dex-itempop'); return !!(p && p.classList.contains('open')); }
  function _isModalClosable() { var m = document.getElementById('m-dex-modal'); return !!(m && m.classList.contains('open') && !m.getAttribute('data-standalone')); }   // 獨立頁的常駐 modal 不算可關層
  function _hideTop() {   // 關掉最上層(彈窗優先,其次 modal);有關到回 true
    if (_isPop()) { document.getElementById('m-dex-itempop').classList.remove('open'); return true; }
    if (_isModalClosable()) { document.getElementById('m-dex-modal').classList.remove('open'); return true; }
    return false;
  }
  function _pushNav() { _navDepth++; try { history.pushState({ afkDexNav: _navDepth }, ''); } catch (e) {} }
  function userCloseTop() {   // X鈕 / 點背景 / ESC:關最上層,並把對應的歷史也退掉(讓返回鍵堆疊一致)
    if (!_hideTop()) return;
    if (_navDepth > 0) { _navDepth--; _suppressPop = true; try { history.back(); } catch (e) { _suppressPop = false; } }
  }
  window.addEventListener('popstate', function () {
    if (_suppressPop) { _suppressPop = false; return; }   // 由 userCloseTop 程式觸發的 back,已關過,不重複
    if (_navDepth > 0) { _navDepth--; _hideTop(); }        // 手機實體返回鍵
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && (_isPop() || _isModalClosable())) { e.preventDefault(); userCloseTop(); }
  });

  function cardHTML(h, mult, q) {
    var modeLabel = mult >= 5 ? '（瘋狂的席琳世界 ×5）' : (mult > 1 ? '（席琳的世界 ×3）' : (mult < 1 ? '（經典模式 ×1/10）' : ''));
    var m = h.mob;
    var tags = '';
    if (m.boss) tags += '<span class="m-dex-tag tag-boss">BOSS</span>';
    if (m.hard) tags += '<span class="m-dex-tag tag-hard">硬皮</span>';
    var dmg = m.dmg ? (m.dmg[0] + '~' + m.dmg[1]) : '-';
    var gold = (m.goldMin != null) ? (fmt(m.goldMin) + '~' + fmt(m.goldMax)) : '-';
    var stats = '<div class="m-dex-stats">' +
      st('等級', m.lv) + st('屬性', ELE[m.e] || m.e || '無') + st('種族', m.race || '-') + st('行為', m.beh || '-') +
      st('HP', fmt(m.hp)) + st('攻擊', dmg) + st('命中', m.hit != null ? m.hit : '-') +
      st('AC', m.ac != null ? m.ac : '-') + st('魔防', m.mr != null ? m.mr : '-') +
      st('經驗', fmt(m.exp)) + st('金幣', gold) + '</div>';
    var mapsHTML = h.maps.length
      ? h.maps.map(function (nm) {
          var link = '<span class="m-dex-maplink" data-map="' + esc(nm) + '">' + hl(nm, q) + '</span>';
          var ent = hiddenEntryOf(nm) || castleEntryOf(nm);   // 隱藏地圖/城堡狩獵區(風木地監):後面附進入方式
          return link + (ent ? '<span class="m-dex-hidden-entry">（' + esc(ent) + '）</span>' : '');
        }).join('、')
      : '—';
    var dropsHTML = h.drops.length
      ? '<table class="m-dex-drops"><tbody>' + h.drops.map(function (d) {
          // 經典 ×1/10 例外(鏡像遊戲 killMob 的 trialItemDropMult＋卡瑞屠龍劍特判):職業試煉道具與卡瑞的屠龍劍不打折;席琳 ×3/×5 沒有這些例外照乘
          var effMult = (mult < 1 && ((typeof TRIAL_ITEM_CLASS !== 'undefined' && TRIAL_ITEM_CLASS[d[0]]) || (m.n === '卡瑞' && d[0] === 'wpn_dragonslayer'))) ? 1 : mult;
          var pct = d[2] * effMult; if (pct > 100) pct = 100;
          var tag = d[3] ? ' <span class="m-dex-droptag">' + esc(d[3]) + '</span>' : '';
          return '<tr>' +
            '<td><span class="m-dex-iname" data-id="' + esc(d[0]) + '" title="看詳情">' + hl(d[1], q) + '</span>' + tag + '</td>' +
            '<td class="m-dex-pct">' + fmtPct(pct) + '%</td>' +
            '</tr>';
        }).join('') + '</tbody></table>'
      : '<div class="m-dex-nodrop">無專屬掉落表</div>';
    return '<div class="m-dex-card">' +
      '<div class="m-dex-name">' + hl(m.n, q) + ' ' + tags + '</div>' + stats +
      '<div class="m-dex-sub">出沒地圖</div><div class="m-dex-maps">' + mapsHTML + '</div>' +
      '<div class="m-dex-sub">掉落' + modeLabel + '</div>' + dropsHTML +
      '</div>';
  }

  // ----- 首頁入口按鈕 -----------------------------------------------------
  function injectButton(menu) {
    if (document.getElementById('m-dex-open')) return;
    var row = document.createElement('div');
    row.className = 'm-dex-entry-row';
    var b = document.createElement('button');
    b.id = 'm-dex-open';
    b.type = 'button';
    b.className = 'btn text-xl py-4 bg-amber-700 hover:bg-amber-600 border-amber-500 m-dex-entry-main';
    b.textContent = '📖 怪物 / 掉落查詢';
    b.addEventListener('click', openModal);
    var nt = document.createElement('button');
    nt.id = 'm-dex-newtab';
    nt.type = 'button';
    nt.className = 'btn py-4 bg-amber-700 hover:bg-amber-600 border-amber-500 m-dex-entry-newtab';
    nt.textContent = '↗';
    nt.title = '在新分頁開啟掉落查詢';
    nt.setAttribute('aria-label', '在新分頁開啟掉落查詢');
    nt.addEventListener('click', function () { window.open(standaloneUrl(), '_blank'); });
    row.appendChild(b);
    row.appendChild(nt);
    menu.appendChild(row);
  }

  // ----- 自動化設定面板「🔌 外掛」列:遊戲中也能開掉落查詢/小百科/木人場 ------
  // dex/wiki/training 各自注入自己的鈕到同一列(共用 id m-afk-navrow),呼叫各自功能,零耦合;誰先載入誰建列。
  // 標題統一「🔌 外掛」(這列不只查詢,還有木人場)→ 三支建列字串一致,不靠事後改名。
  function injectAutoNav(btnId, label, onClick) {
    var panel = document.getElementById('tab-automation');   // v2.6.74 起自動化設定改為遊戲分頁(靜態 DOM,不會被重繪洗掉)
    var scroll = panel;
    if (!panel) { panel = document.getElementById('automation-panel'); scroll = panel && (panel.querySelector('.overflow-y-auto') || panel); }   // 舊版面後備
    if (!panel) return;
    var row = document.getElementById('m-afk-navrow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'm-afk-navrow';
      row.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700';
      row.innerHTML = '<div class="text-sm text-amber-400 mb-2 border-b border-slate-700 pb-1 font-bold">🔌 外掛</div>' +
        '<div id="m-afk-navrow-btns" style="display:flex;gap:8px;"></div>';
      scroll.appendChild(row);
    }
    if (document.getElementById(btnId)) return;
    var b = document.createElement('button');
    b.id = btnId; b.type = 'button';
    b.className = 'btn py-2 text-sm bg-slate-700 hover:bg-slate-600 border-slate-500';
    b.style.flex = '1';
    b.textContent = label;
    b.addEventListener('click', onClick);
    row.querySelector('#m-afk-navrow-btns').appendChild(b);
  }

  // ----- 全域特殊掉落規則 -------------------------------------------------
  // 這些不在任一隻怪的 MOB_DROPS 表內,是遊戲依「等級/類型/地圖/技能」即時判定的條件掉落,
  // 所以不會出現在上面的怪物卡掉落清單。整理成一個預設收合的面板,點開才展開,不佔主版面。
  // 全域特殊掉落規則:每條一個可摺疊區塊(預設收合,面板保持精簡);搜到該條關鍵字會自動展開+高亮+捲到它
  var SPECIAL_BLOCKS = [
    { id: 'dropmult', title: '🔮 掉落倍率：席琳的世界 ×3、瘋狂的席琳世界 ×5、恩賜怪 ×10、經典 ×1/10', keys: ['掉落倍率', '倍率', '席琳的世界', '瘋狂的席琳世界', '經典模式', '恩賜怪', '恩賜'], lines: [
      '<b>怪物卡上顯示的是「一般」掉落機率</b>，下列狀態會整體放大／縮小：',
      '<b>席琳的世界</b>：被席琳化的怪掉落機率 <b>×3</b>（<b>瘋狂的席琳世界</b> <b>×5</b>）；其中「恩賜怪」更高，<b>×10</b>',
      '<b>經典模式</b>：所有物品掉落機率 <b>×1/10</b>（<b>職業試煉／任務道具</b>與<b>卡瑞的屠龍劍</b>除外，照原機率掉）',
      '<b>固定、不受倍率影響的例外</b>：席琳結晶、萬能藥（屬性藥）、黑魔石、銀礦石、進化果實（各條另有標註）；其餘怪卡掉落都會被倍率放大／縮小',
      '上方的「<b>掉落率模式</b>」下拉可把席琳／經典倍率直接套到怪卡的掉落數字'
    ] },
    { id: 'panacea', title: '🧪 萬能藥（屬性藥）', keys: ['萬能藥', '屬性藥'], lines: [
      '條件：怪物等級 40 以上、且不是血盟',
      '一般怪 0.01%、頭目 1%，掉落時隨機給 力量／敏捷／體質／智力／精神／魅力 萬能藥之一',
      '夢幻之島的頭目不走這條，改走自己的一般掉落表（搜該頭目可看到牠固定掉的萬能藥）',
      '機率固定，<b>不受</b>「席琳的世界 ×3」影響'
    ] },
    { id: 'sherine', title: '🔮 席琳結晶（席琳的世界限定）', keys: ['席琳結晶'], lines: [
      '條件：開啟「席琳的世界」後，被席琳化的怪掉（血盟怪、等級 20 以下不掉）',
      '一般怪：等級 21~30 為 0.001%、31~40 為 0.002%、41 以上為 0.003%',
      '頭目：一般頭目 0.1%、夢幻之島頭目 0.01%',
      '三大龍（安塔瑞斯／法利昂／巴拉卡斯）：10%',
      '機率固定，<b>不受</b>席琳世界 ×3 影響'
    ] },
    { id: 'blessscroll', title: '✦ 賦予祝福卷軸（等級 40 以上頭目）', keys: ['賦予祝福', '祝福卷軸'], lines: [
      '條件：等級 40 以上頭目，夢幻之島、攻城區除外',
      '賦予武器祝福卷軸 0.1%、賦予盔甲祝福卷軸 0.1%、賦予飾品祝福卷軸 0.01%',
      '會受「席琳的世界 ×3」加成'
    ] },
    { id: 'castscroll', title: '📜 施法卷軸掉落時變祝福／詛咒', keys: ['施法卷軸', '詛咒'], lines: [
      '打怪掉到「對武器施法的卷軸」或「對盔甲施法的卷軸」時，<b>各有 1% 變成「祝福的」、1% 變成「詛咒的」</b>（兩者互斥）。',
      '「對飾品施法的卷軸」沒有這個隨機（要靠肯特城伊賽馬利或活動取得）。祝福的／詛咒的效果見小百科「強化」分頁。'
    ] },
    { id: 'fruit', title: '🐾 進化果實（寵物進化用）', keys: ['進化果實', '暴走兔', '狐狸', '小獵犬', '聖伯納'], lines: [
      '打死「有屬性」的怪有機率掉對應的進化果實，機率 ＝ <b>0.0001% × 怪物等級</b>（怪越高機率越大）。',
      '水屬性怪 → 暴走兔；火 → 狐狸；地 → 小獵犬；風 → 聖伯納。進化玩法見小百科「帶寵物」分頁。'
    ] },
    { id: 'areadrop', title: '🌿 區域額外掉落（妖精森林周邊、眠龍洞穴 1~3 樓）', keys: ['米索莉', '精靈玉', '元素石'], lines: [
      '該區所有怪：粗糙的米索莉塊／精靈玉／元素石 各 20%',
      '學會「世界樹的呼喚」則各 30%',
      '會受「席琳的世界 ×3」加成'
    ] },
    { id: 'blackstone', title: '⛏ 黑魔石（黑暗妖精素材）', keys: ['黑魔石'], lines: [
      '沉默洞穴周邊：二級黑魔石 20%、三級黑魔石 10%（學「提煉魔石」提高為 30%／15%）',
      '其他野外／地監：需學「提煉魔石」才掉，二級黑魔石 1%、三級黑魔石 0.5%、四級黑魔石 0.1%',
      '機率固定，<b>不受</b>席琳世界 ×3 影響'
    ] },
    { id: 'silverore', title: '🪙 銀礦石（黑暗妖精製作材料）', keys: ['銀礦石'], lines: [
      '石頭高崙／鋼鐵高崙：100%',
      '侏儒／侏儒戰士／黑騎士／哈柏哥布林／蜥蜴人：各 50%'
    ] },
    { id: 'dragonegg', title: '🐉 幼龍蛋（三大龍擊殺必得）', keys: ['幼龍蛋', '林德拜爾'], lines: [
      '擊敗安塔瑞斯／法利昂／巴拉卡斯<b>必得</b>（100%）；身上已有一枚就不再掉，<b>不受</b>經典模式掉率影響',
      '唯一道具、無法存入倉庫；售價 0，可隨時賣出',
      '持有時於<b>任何野外地圖</b>有 <b>1%</b> 機率改為刷出隱藏 BOSS 風龍「林德拜爾」（Lv90）——場上沒有其他頭目時才出現、同時最多一隻；賣掉幼龍蛋即不再遭遇'
    ] },
    { id: 'pledgedrop', title: '🎁 野外血盟敵人／攻城敵人 額外掉落', keys: ['攜帶物'], lines: [
      '擊殺時 1% 機率額外掉一件物品：從幾乎所有可掉物依稀有度隨機抽（越稀有越難中、常見物權重加倍）',
      '抽到裝備一定帶強化：多在 +0～該裝備安定值；超出安定值的機率 +1 為 0.1%、+2 0.01%、+3 0.001%、+4 0.0001%。另 1% 帶「祝福的」'
    ] },
    { id: 'holyrelic', title: '🏛️ 聖地遺物（拉斯塔巴德傳說武器材料）', keys: ['聖地遺物', '聖地的遺物', '死亡騎士之印記'], lines: [
      '<b>取得</b>：持有「死亡騎士之印記」時，在<b>拉斯塔巴德區域</b>擊敗<b>任何</b>怪物，<b>0.1%</b> 機率掉落（經典模式 ×1/10）。不在任何怪的固定掉落表內，所以直接搜怪查不到。',
      '「死亡騎士之印記」哪來：拉斯塔巴德地監的「長老．X」系列怪掉（各約 3%）——可直接搜「死亡騎士之印記」看是哪些怪。印記唯一、不佔倉、可賣。',
      '用途：可羅蘭斯（沉默洞穴）製作拉斯塔巴德五件傳說武器（每件需聖地遺物 ×100）。'
    ] }
  ];
  var SPECIAL_KEYS = SPECIAL_BLOCKS.reduce(function (a, b) { return a.concat(b.keys); }, []);
  var SPECIAL_BY_ID = {}; SPECIAL_BLOCKS.forEach(function (b) { SPECIAL_BY_ID[b.id] = b; });
  function matchSpecialId(q) {
    if (!q) return null;
    // 雙向比對:關鍵字含查詢字(搜「席琳」中「席琳結晶」)或查詢字含關鍵字(搜「屬性萬能藥」中「萬能藥」)都算命中
    for (var i = 0; i < SPECIAL_BLOCKS.length; i++) { var b = SPECIAL_BLOCKS[i]; for (var j = 0; j < b.keys.length; j++) { var k = b.keys[j].toLowerCase(); if (k.indexOf(q) >= 0 || q.indexOf(k) >= 0) return b.id; } }
    return null;
  }
  function matchesSpecial(q) { return matchSpecialId(q) !== null; }
  function specialPanelHTML() {
    var body = SPECIAL_BLOCKS.map(function (b) {
      return '<details class="m-dex-sp-item" data-spid="' + b.id + '"><summary class="m-dex-sp-h">' + b.title + '</summary>' +
        '<ul>' + b.lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul></details>';
    }).join('');
    return '<details id="m-dex-special">' +
      '<summary><span class="m-dex-sp-label">📋 全域特殊掉落規則（依條件觸發，不列在各怪掉落表內）</span></summary>' +
      '<div class="m-dex-sp-body">' + body + '</div>' +
      '</details>';
  }

  // ----- 搜尋面板 ---------------------------------------------------------
  function buildModal() {
    if (document.getElementById('m-dex-modal')) return;
    var m = document.createElement('div');
    m.id = 'm-dex-modal';
    m.innerHTML =
      '<div id="m-dex-card-wrap">' +
        '<div id="m-dex-head">' +
          '<span id="m-dex-inwrap">' +
            '<input id="m-dex-input" type="text" placeholder="搜尋 怪物 / 地圖 / 掉落物 / 物品…" autocomplete="off">' +
            '<button id="m-dex-clear" type="button" title="清除" aria-label="清除">✕</button>' +
          '</span>' +
          '<button id="m-dex-close" type="button" title="關閉">✕</button>' +
        '</div>' +
        '<div id="m-dex-sherine-row"><label for="m-dex-mode">掉落率模式</label>' +
          '<select id="m-dex-mode"><option value="1">一般模式</option><option value="3">席琳的世界（×3）</option><option value="5">瘋狂的席琳世界（×5）</option><option value="0.1">經典模式（×1/10）</option></select></div>' +
        '<div id="m-dex-results"><div class="m-dex-hint">輸入 怪物名 / 地圖 / 掉落物 開始搜尋；搜物品名可直接點看詳情</div></div>' +
        specialPanelHTML() +
      '</div>' +
      '<div id="m-dex-itempop"><div id="m-dex-itempop-card"><button id="m-dex-itempop-close" type="button" title="關閉" aria-label="關閉">✕</button><div id="m-dex-itempop-body"></div></div></div>';
    document.body.appendChild(m);
    document.getElementById('m-dex-input').addEventListener('input', debouncedSearch);
    document.getElementById('m-dex-mode').addEventListener('change', doSearch);
    document.getElementById('m-dex-close').addEventListener('click', userCloseTop);
    document.getElementById('m-dex-clear').addEventListener('click', function () {
      var i = document.getElementById('m-dex-input');
      i.value = ''; doSearch(); i.focus();
    });
    // 點「出沒地圖」→ 查該圖所有怪;點「掉落物」→ 查所有會掉這件的怪。事件委派,結果重繪也持續有效。
    document.getElementById('m-dex-results').addEventListener('click', function (e) {
      if (!e.target.closest) return;
      var iname = e.target.closest('.m-dex-iname');
      if (iname) { openItemPop(iname.getAttribute('data-id')); return; }   // 點物品名 → 看詳情(數值/圖片/掉落來源)
      var link = e.target.closest('.m-dex-maplink');   // 點出沒地圖 → 查該圖的怪
      if (!link) return;
      var i = document.getElementById('m-dex-input');
      i.value = link.getAttribute('data-map') || '';
      doSearch();
      var r = document.getElementById('m-dex-results'); if (r) r.scrollTop = 0;
    });
    m.addEventListener('click', function (e) { if (e.target === m) userCloseTop(); });   // 點背景關閉
    document.getElementById('m-dex-itempop-close').addEventListener('click', userCloseTop);
    document.getElementById('m-dex-itempop').addEventListener('click', function (e) { if (e.target.id === 'm-dex-itempop') userCloseTop(); });   // 點彈窗背景關閉
    // 通用跨頁委派:「查掉落」鈕(.m-dex-pop-search,data-item) + 任何「名字連結」([data-dexq]) → gotoDex(模態連模態、網址連網址)。小百科/掉落查詢頁皆可用。
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.m-dex-pop-search,[data-dexq]') : null;
      if (!b) return;
      gotoDex({ q: b.getAttribute('data-dexq') || b.getAttribute('data-item') || '' });
    });
    // 📚 統一搜尋:點「小百科相關內容」列 → 前往小百科開同字搜尋(gotoWiki 會關本模態/獨立頁走網址)
    document.addEventListener('click', function (e) {
      var w = e.target.closest ? e.target.closest('.m-dex-wikihit') : null;
      if (!w || !window.AFK_WIKI_API || !AFK_WIKI_API.goto) return;
      AFK_WIKI_API.goto({ q: w.getAttribute('data-q') || '' });
    });
  }
  function openModal(adopt) { var m = document.getElementById('m-dex-modal'); if (m) { var wasOpen = m.classList.contains('open'); m.classList.add('open'); var i = document.getElementById('m-dex-input'); if (i) i.focus(); if (!wasOpen && !m.getAttribute('data-standalone')) { if (adopt === true) { if (_navDepth < 1) _navDepth = 1; } else _pushNav(); } } }   // adopt===true:接手來源模態交出的歷史層、不另壓(跨頁切換用,避免返回鍵殘留)。嚴格比對 true:按鈕 onclick 會把 MouseEvent 當參數傳進來,不可當 adopt
  function closeModal() { var m = document.getElementById('m-dex-modal'); if (!m || m.getAttribute('data-standalone')) return; m.classList.remove('open'); }

  // ----- CSS --------------------------------------------------------------
  function injectCSS() {
    if (document.getElementById('m-dex-style')) return;
    var css = [
      '#main-menu .m-dex-entry-row{display:flex;gap:8px;align-items:stretch;justify-content:center;width:100%;max-width:18rem;margin:0 auto;}',   /* 整列總寬對齊原生首頁按鈕 w-72(18rem);主按鈕 flex 撐滿、扣掉 ↗ 鈕 */
      '#main-menu .m-dex-entry-row > button{width:auto !important;max-width:none !important;}',
      '#main-menu .m-dex-entry-main{flex:1 1 auto;}',
      '#main-menu .m-dex-entry-newtab{flex:0 0 auto;font-size:1.4rem;line-height:1;padding-left:16px;padding-right:16px;}',
      '#m-standalone-nav{position:fixed;top:0;left:0;right:0;height:46px;z-index:1001;display:flex;align-items:center;gap:6px;padding:0 10px;background:#0b1220;border-bottom:1px solid #334155;font-family:system-ui,"Segoe UI",sans-serif;}',
      '#m-standalone-nav a{color:#cbd5e1;text-decoration:none;font-size:14px;font-weight:bold;padding:7px 12px;border-radius:8px;border:1px solid transparent;white-space:nowrap;}',
      '#m-standalone-nav a:hover{background:#1e293b;}',
      '#m-standalone-nav a.on{background:#1e293b;color:#fcd34d;border-color:#475569;}',
      '#m-dex-modal{display:none;position:fixed;inset:0;z-index:1000;background:rgba(2,6,23,0.82);align-items:flex-start;justify-content:center;padding:20px 10px;}',
      '#m-dex-modal.open{display:flex;}',
      '#m-dex-modal[data-standalone]{padding-top:58px;}',
      '#m-dex-card-wrap{width:min(680px,96vw);max-height:92vh;max-height:calc(100dvh - 40px);display:flex;flex-direction:column;background:#0f172a;border:1px solid #334155;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden;font-family:system-ui,"Segoe UI",sans-serif;}',
      '#m-dex-modal[data-standalone] #m-dex-card-wrap{max-height:calc(100dvh - 78px);}',   /* 獨立頁:頂部 58px 給導覽列+底部 20px,卡片高度要扣掉,否則最底的「全域特殊掉落規則」會被切掉 */
      '#m-dex-modal[data-standalone] #m-dex-itempop{top:58px;}',   /* 獨立頁:物品詳情彈窗在 modal 的堆疊脈絡內(z 低於頂部導覽列),整個下移 58px 才不會被導覽列蓋住上緣 */
      '#m-dex-modal[data-standalone] #m-dex-itempop-card{max-height:calc(100dvh - 110px);}',
      '#m-dex-head{display:flex;gap:8px;padding:12px;border-bottom:1px solid #1e293b;flex:0 0 auto;}',
      '#m-dex-inwrap{position:relative;flex:1 1 auto;min-width:0;display:flex;}',
      '#m-dex-input{flex:1 1 auto;min-width:0;background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:8px;padding:10px 40px 10px 12px;font-size:15px;outline:none;font-family:inherit;}',
      '#m-dex-input:focus{border-color:#eab308;}',
      '#m-dex-clear{display:none;position:absolute;right:6px;top:50%;transform:translateY(-50%);width:26px;height:26px;border:none;background:#475569;color:#e2e8f0;border-radius:50%;font-size:12px;line-height:1;cursor:pointer;padding:0;}',
      '#m-dex-clear.show{display:block;}',
      '#m-dex-clear:active{background:#64748b;}',
      '#m-dex-close{flex:0 0 auto;width:42px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;border-radius:8px;font-size:16px;cursor:pointer;font-family:inherit;}',
      '#m-dex-close:active{background:#334155;}',
      '#m-dex-sherine-row{display:flex;align-items:center;gap:8px;padding:9px 14px;color:#cbd5e1;font-size:14px;border-bottom:1px solid #1e293b;flex:0 0 auto;}',
      '#m-dex-sherine-row label{flex:0 0 auto;}',
      '#m-dex-mode{background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:6px;padding:4px 8px;font-size:14px;font-family:inherit;outline:none;cursor:pointer;}',
      '#m-dex-results{flex:1 1 auto;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;}',
      '.m-dex-hint{color:#94a3b8;text-align:center;padding:22px 8px;font-size:14px;line-height:1.6;}',
      '.m-dex-card{background:#111c30;border:1px solid #334155;border-radius:10px;padding:12px;}',
      '.m-dex-name{font-size:16px;font-weight:bold;color:#fff;margin-bottom:8px;}',
      '.m-dex-hl{background:#fde047;color:#1e293b;border-radius:3px;padding:0 2px;font-weight:bold;}',
      '.m-dex-tag{font-size:11px;font-weight:bold;padding:1px 6px;border-radius:6px;margin-left:6px;vertical-align:middle;}',
      '.tag-boss{background:#7f1d1d;color:#fecaca;}',
      '.tag-hard{background:#1e3a5f;color:#bfdbfe;}',
      '.m-dex-stats{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px;color:#cbd5e1;margin-bottom:6px;}',
      '.m-dex-stat b{color:#94a3b8;font-weight:normal;margin-right:2px;}',
      '.m-dex-sub{font-size:12px;color:#fcd34d;font-weight:bold;margin:8px 0 3px;}',
      '.m-dex-maps{font-size:13px;color:#e2e8f0;line-height:1.6;}',
      '.m-dex-droptag{font-size:11px;color:#fca5a5;background:#3b1d2a;border:1px solid #7f3a4a;border-radius:4px;padding:0 5px;margin-left:2px;white-space:nowrap;}',
      '.m-dex-maplink{color:#7dd3fc;text-decoration:underline;cursor:pointer;}',
      '.m-dex-hidden-entry{color:#94a3b8;font-size:11px;}',   // 隱藏地圖進入方式註記(暗色小字)
      '.m-dex-maplink:active{color:#38bdf8;}',
      /* 掉落物:點名稱=看詳情(慣例:點物品就是看它);查掉落來源的按鈕收進詳情卡裡。 */
      '.m-dex-iname{color:#7dd3fc;text-decoration:underline;cursor:pointer;}',
      '.m-dex-iname:active{color:#38bdf8;}',
      '.m-dex-imatch-h{color:#fcd34d;font-weight:bold;font-size:13.5px;margin-bottom:6px;}',
      '.m-dex-wikihit{color:#cbd5e1;font-size:13.5px;padding:5px 6px;border-radius:6px;cursor:pointer;}',
      '.m-dex-wikihit:hover{background:#1e293b;color:#fcd34d;}',
      '.m-dex-imatch{font-size:13.5px;line-height:1.9;color:#64748b;}',
      '#m-dex-itempop{display:none;position:absolute;inset:0;z-index:1002;background:rgba(2,6,23,.66);align-items:center;justify-content:center;padding:24px 14px;}',
      '#m-dex-itempop.open{display:flex;}',
      '#m-dex-itempop-card{position:relative;width:min(420px,94vw);max-height:84vh;overflow-y:auto;background:#0f172a;border:1px solid #475569;border-radius:12px;padding:16px;box-shadow:0 16px 50px rgba(0,0,0,.6);}',
      '#m-dex-itempop-close{position:absolute;top:8px;right:8px;width:30px;height:30px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;border-radius:8px;cursor:pointer;font-size:14px;line-height:1;}',
      '#m-dex-itempop-close:active{background:#334155;}',
      '.m-dex-ihead{display:flex;align-items:center;gap:12px;margin-bottom:10px;padding-right:34px;}',
      '.m-dex-iimg{width:56px;height:56px;object-fit:contain;background:#1e293b;border:1px solid #334155;border-radius:8px;flex:0 0 auto;}',
      '.m-dex-iname-big{font-size:17px;font-weight:bold;color:#fff;}',
      '.m-dex-itable{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px;}',
      '.m-dex-itable td{padding:4px 6px;border-bottom:1px solid #1e293b;color:#e2e8f0;vertical-align:top;}',
      '.m-dex-ik{color:#94a3b8;white-space:nowrap;width:1%;}',
      '.m-dex-idesc{font-size:12.5px;color:#cbd5e1;line-height:1.6;background:#111c30;border:1px solid #1e293b;border-radius:8px;padding:9px 11px;}',
      '.m-dex-craft{margin-top:10px;background:#111c30;border:1px solid #1e293b;border-radius:8px;padding:9px 11px;font-size:12.5px;line-height:1.55;}',
      '.m-dex-craft-h{color:#fcd34d;font-weight:bold;margin-bottom:3px;}',
      '.m-dex-craft-where{color:#e2e8f0;}',
      '.m-dex-craft-mats{color:#94a3b8;}',
      '.m-dex-pop-search{margin-top:12px;width:100%;border:1px solid #334155;background:#1e293b;color:#7dd3fc;border-radius:8px;padding:11px;font-size:13.5px;font-weight:bold;cursor:pointer;font-family:inherit;}',
      '.m-dex-pop-search:active{background:#334155;}',
      '.m-dexlink{color:#7dd3fc;cursor:pointer;border-bottom:1px dotted #38bdf8;}',   // 🔗 通用「名字 → 跳掉落查詢搜尋」inline 連結(配 data-dexq);小百科/掉落查詢共用(dex CSS 全頁可見)
      '.m-dexlink:active{color:#bae6fd;}',
      '.m-dex-nodrop{font-size:13px;color:#64748b;}',
      '.m-dex-drops{width:100%;border-collapse:collapse;font-size:13px;}',
      '.m-dex-drops td{padding:3px 4px;border-bottom:1px solid #1e293b;color:#e2e8f0;}',
      '.m-dex-pct{text-align:right;color:#fcd34d;white-space:nowrap;width:1%;}',
      '#m-dex-special{flex:0 0 auto;border-top:1px solid #1e293b;}',
      '#m-dex-special > summary{padding:10px 14px;color:#fcd34d;font-size:12.5px;font-weight:bold;cursor:pointer;list-style:none;user-select:none;}',
      '.m-dex-sp-label{text-decoration:underline;}',   /* 標題加底線,看起來像可點(展開/收合) */
      '#m-dex-special > summary::-webkit-details-marker{display:none;}',
      '#m-dex-special > summary::before{content:"▸ ";color:#94a3b8;}',
      '#m-dex-special[open] > summary::before{content:"▾ ";}',
      '#m-dex-special > summary:hover{color:#fde047;}',
      '.m-dex-sp-body{max-height:42vh;overflow-y:auto;padding:6px 12px 12px;}',
      '.m-dex-sp-item{margin-top:6px;border:1px solid #1e293b;border-radius:7px;background:#0f1a2e;overflow:hidden;}',
      '.m-dex-sp-item > summary.m-dex-sp-h{font-size:13px;font-weight:bold;color:#e2e8f0;padding:7px 10px;cursor:pointer;list-style:none;user-select:none;}',
      '.m-dex-sp-item > summary::-webkit-details-marker{display:none;}',
      '.m-dex-sp-item > summary.m-dex-sp-h::before{content:"▸ ";color:#64748b;}',
      '.m-dex-sp-item[open] > summary.m-dex-sp-h::before{content:"▾ ";}',
      '.m-dex-sp-item > summary.m-dex-sp-h:hover{color:#fde047;}',
      '.m-dex-sp-item.m-dex-sp-hit{border-color:#fcd34d;box-shadow:0 0 0 1px rgba(252,211,77,.35);}',
      '.m-dex-sp-item ul{margin:0;padding:0 12px 9px 28px;list-style:disc;}',
      '.m-dex-sp-item li{font-size:12px;color:#94a3b8;line-height:1.55;margin:1px 0;}',
      '.m-dex-sp-item b{color:#cbd5e1;}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = 'm-dex-style';
    s.textContent = css;
    document.head.appendChild(s);
  }
})();
