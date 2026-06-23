/* ============================================================================
 * afk-dex.js — 怪物 / 掉落查詢(圖鑑)
 *
 * 首頁(#main-menu)加一顆「📖 怪物 / 掉落查詢」按鈕,開搜尋面板。
 *   - 單一搜尋框:可同時搜 怪物名 / 地圖名 / 掉落物名;有輸入才顯示結果(空的不渲染,不卡)。
 *   - 每筆結果是「怪物卡」:數值 + 出沒地圖 + 掉落清單(物品名 + 機率%)。
 *   - 「席琳的世界」checkbox:勾選時掉落率顯示 ×3(上限 100%)。
 *   - 純讀取遊戲全域資料(DB.mobs / DB.maps / MOB_DROPS / DB.items),不改遊戲;桌機手機共用。
 *
 * 掛接:在 index.html 的 </body> 前加一行 <script src="afk-dex.js"></script>
 * ========================================================================== */
(function () {
  'use strict';

  var MAX_RESULTS = 60;
  var INDEX = [];   // [{ id, mob, maps:[名稱], drops:[[id,名稱,pct]], hay:可搜尋字串(小寫) }]

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
  // 遺忘之島地圖(oblivion_*)是搭船前往的特殊離島,不在 MAP_CATEGORIES/DB.maps 靜態表,自己補名
  var EXTRA_MAP_NAMES = { windwood_dungeon: '風木地監', oblivion_island: '遺忘之島', oblivion_travel: '遺忘之島途中' };
  function mapNameOf(id) {
    try {
      if (EXTRA_MAP_NAMES[id]) return EXTRA_MAP_NAMES[id];
      // 🗼 傲慢之塔:樓層(pride_fN)與區間(pride_a_b)地圖無靜態中文名,比照遊戲內命名動態產生
      var _pf = /^pride_f(\d+)$/.exec(id); if (_pf) return '傲慢之塔 ' + _pf[1] + 'F';
      var _pr = /^pride_(\d+)_(\d+)$/.exec(id); if (_pr) return '傲慢之塔 ' + _pr[1] + '~' + _pr[2] + '樓（直接挑戰）';
      if (typeof MAP_CATEGORIES !== 'undefined') {
        for (var c in MAP_CATEGORIES) {
          for (var i = 0; i < MAP_CATEGORIES[c].length; i++) if (MAP_CATEGORIES[c][i].v === id) return MAP_CATEGORIES[c][i].t;
        }
      }
      if (typeof SIEGE_CITY !== 'undefined') {
        for (var k in SIEGE_CITY) { var s = SIEGE_CITY[k]; if (s.outer === id) return s.outerName; if (s.inner === id) return s.innerName; if (s.castle === id) return s.castleName; }
      }
      if (DB.towns && DB.towns[id]) return DB.towns[id].n;
    } catch (e) {}
    return id;
  }
  function itemNameOf(id) { return (DB.items[id] && DB.items[id].n) ? DB.items[id].n : id; }

  // ----- 預先建索引(只跑一次) ---------------------------------------------
  function buildIndexes() {
    var mobToMaps = {};
    for (var mid in DB.maps) (DB.maps[mid] || []).forEach(function (mob) { (mobToMaps[mob] = mobToMaps[mob] || []).push(mid); });
    for (var id in DB.mobs) {
      var mob = DB.mobs[id];
      // 去重:原作者的地圖怪物清單可能把同一隻怪列兩次(如 windwood 重複列杜賓狗),否則出沒地圖會出現兩個同名
      var maps = (mobToMaps[id] || []).map(mapNameOf).filter(function (n, i, a) { return a.indexOf(n) === i; });
      // 合併「全部掉落表」:除了 MOB_DROPS,還有黑暗武器(DARK_WEAPON_DROPS)、三階黑暗精靈水晶(DARK_CRYSTAL_DROPS)
      // 也是獨立掉落表、不在 MOB_DROPS,漏了就查不到。三張都用「怪物名」當 key、同格式 [[id,%]]。
      var raw = [].concat(
        (typeof MOB_DROPS !== 'undefined' && MOB_DROPS[mob.n]) || [],
        (typeof DARK_WEAPON_DROPS !== 'undefined' && DARK_WEAPON_DROPS[mob.n]) || [],
        (typeof DARK_CRYSTAL_DROPS !== 'undefined' && DARK_CRYSTAL_DROPS[mob.n]) || []
      );
      var drops = raw
        .map(function (e) { return [e[0], itemNameOf(e[0]), e[1]]; })
        .filter(function (d) { return DB.items[d[0]]; });
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
    for (var id in DB.items) {
      var d = DB.items[id];
      if (!d || !d.n) continue;
      var isEquip = (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc');
      if (!isEquip && !shopSet[id]) continue;
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

  // ----- 搜尋 + 渲染 ------------------------------------------------------
  function doSearch() {
    var input = document.getElementById('m-dex-input');
    var results = document.getElementById('m-dex-results');
    if (!input || !results) return;
    syncUrl();   // 同步搜尋字到網址(獨立頁才會動)
    var sherine = document.getElementById('m-dex-sherine').checked;
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
    var hits = [];
    for (var i = 0; i < INDEX.length && hits.length <= MAX_RESULTS; i++) if (INDEX[i].hay.indexOf(q) >= 0) hits.push(INDEX[i]);
    if (!hits.length) {
      if (itemHTML) { results.innerHTML = itemHTML + (special ? '<div class="m-dex-hint">另見下方<b>「全域特殊掉落規則」</b>。</div>' : '<div class="m-dex-hint">（上面這些物品沒有固定掉落的怪，多為商店／製作／兌換／任務取得）</div>'); return; }
      results.innerHTML = special
        ? '<div class="m-dex-hint">「' + esc(input.value.trim()) + '」沒有固定掉落的怪物，請見下方<b>「全域特殊掉落規則」</b>。</div>'
        : '<div class="m-dex-hint">找不到符合的怪物或裝備</div>';
      return;
    }
    var truncated = hits.length > MAX_RESULTS;
    if (truncated) hits = hits.slice(0, MAX_RESULTS);
    var html = itemHTML + hits.map(function (h) { return cardHTML(h, sherine, q); }).join('');
    if (truncated) html += '<div class="m-dex-hint">符合的太多,只顯示前 ' + MAX_RESULTS + ' 筆,請輸入更精確的關鍵字。</div>';
    results.innerHTML = html;
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
        var mn = (DB.items[m.id] && DB.items[m.id].n) || m.id;
        return esc(mn) + (m.plus11 ? '（須 +11 以上）' : '') + ' ×' + m.cnt;
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

  // ----- 物品詳情彈窗(點掉落物名字 → 顯示遊戲內數值與圖示) ------------------
  var IT_TYPE = { wpn: '武器', arm: '防具', acc: '飾品', pot: '藥水', scroll: '卷軸', skillbk: '魔法書', misc: '道具', etc: '道具' };
  var IT_REQ = { knight: '騎士', mage: '法師', elf: '妖精', dark: '黑暗妖精', all: '全職業' };
  var IT_SLOT = { helm: '頭盔', armor: '盔甲', boots: '長靴', gloves: '手套', shield: '盾牌', cloak: '斗篷', belt: '腰帶', ring: '戒指', amulet: '項鍊' };
  var IT_RES = { resFire: '火', resWater: '水', resWind: '風', resEarth: '地' };
  var IT_STAT = { str: '力量', dex: '敏捷', con: '體質', int: '智力', wis: '精神', cha: '魅力' };
  // 武器特性(eff)→白話名稱(對齊小百科「武器特性」分頁);消耗品的 eff(藥水/卷軸等)不會走到武器分支故不列
  var IT_EFF = (window.AFK_EXTRA && AFK_EXTRA.weaponTraitEff) || {};   // 武器 eff→特性白話,共用清單 afk-extradata.js
  // 由武器種類(getWeaponTags)推出的內建特性(看種類、不寫在 eff);共用清單 afk-extradata.js
  var IT_TAG_TRAIT = (window.AFK_EXTRA && AFK_EXTRA.weaponTagTrait) || {};
  function itReqCN(r) { return String(r == null ? '' : r).split(',').map(function (x) { return IT_REQ[x] || x; }).join('／'); }
  function itemDetailHTML(id) {
    var d = DB.items[id];
    if (!d) return '<div class="m-dex-hint">查無此物品資料。</div>';
    var rows = [];
    function add(k, v) { if (v !== undefined && v !== null && v !== '') rows.push('<tr><td class="m-dex-ik">' + esc(k) + '</td><td>' + esc(String(v)) + '</td></tr>'); }
    add('類型', IT_TYPE[d.type] || d.type || '道具');
    if (d.req) add('需求職業', itReqCN(d.req));
    if (d.slot) add('部位', IT_SLOT[d.slot] || d.slot);
    if (d.type === 'wpn') {
      if (d.dmgS != null) add('攻擊力', '對小型 ' + d.dmgS + '／對大型 ' + d.dmgL);
      add('額外傷害', d.dmgBonus);
      add('命中', d.hit);
      add('魔法傷害', d.mdmg);
      add('攻擊速度', d.spd);
      if (d.w2h || d.twohanded) add('持用', '雙手武器');
      if (d.isBow || d.ranged) add('射程', '遠距離');
      var tags = (typeof getWeaponTags === 'function') ? (getWeaponTags(id) || []) : [];
      if (tags.length) add('種類', tags.join('／'));
      var wt = [];
      if (d.eff && IT_EFF[d.eff]) wt.push(IT_EFF[d.eff]);
      tags.forEach(function (tg) { if (IT_TAG_TRAIT[tg]) wt.push(IT_TAG_TRAIT[tg]); });   // 武士刀=居合、單手劍=反擊、匕首/矛=出血…
      if (d.rapidfire) wt.push('連射');
      if (d.unBonus) wt.push('對不死／狼人額外傷害');
      wt = wt.filter(function (v, i) { return wt.indexOf(v) === i; });   // 去重(eff 與種類可能指到同一特性)
      if (wt.length) add('武器特性', wt.join('、'));
    } else if (d.ac != null && (d.type === 'arm' || d.type === 'acc')) {
      add('防禦(AC)', sgn(-d.ac));   // 比照遊戲內裝備欄:AC 越低越強，正常防具顯示負值(遊戲是 -d.ac)；負 ac 的下行向裝備則顯示 +，避免「--1」
    }
    // 🦴 寵物裝備（之牙）:petDmg/petHit 只加成項圈夥伴(不影響玩家);每強化 +1 傷害與命中各 +1(欄位/上限見下方說明)
    if (d.slot === 'pet' && (d.petDmg || d.petHit)) {
      var pp = [];
      if (d.petDmg) pp.push('傷害 ' + sgn(d.petDmg));
      if (d.petHit) pp.push('命中 ' + sgn(d.petHit));
      add('寵物加成', pp.join('、'));
      add('每強化 +1', '寵物傷害 +1、命中 +1');
    }
    Object.keys(IT_STAT).forEach(function (k) { if (d[k]) add(IT_STAT[k], sgn(d[k])); });
    if (d.mr) add('魔防', sgn(d.mr));
    if (d.mhp) add('HP 上限', sgn(d.mhp));
    if (d.hpR) add('HP 自然恢復', sgn(d.hpR));
    if (d.mmp) add('MP 上限', sgn(d.mmp));
    if (d.mpR) add('MP 自然恢復', sgn(d.mpR));
    Object.keys(IT_RES).forEach(function (k) { if (d[k]) add(IT_RES[k] + '屬性抗性', sgn(d[k])); });
    if (d.block) add('格擋', d.block);
    if (d.weightCap) add('負重上限', sgn(d.weightCap));
    // 每強化 +1 的額外加成(部分裝備有)
    var enBon = [];
    if (d.mrPerEn) enBon.push('魔防 +' + d.mrPerEn);
    if (d.extraMpPerEn) enBon.push('額外 MP +' + d.extraMpPerEn);
    if (d.meleeHitPerEn) enBon.push('近距命中 +' + d.meleeHitPerEn);
    if (d.rangedHit) enBon.push('遠距命中 +' + d.rangedHit);
    if (enBon.length) add('每強化 +1', enBon.join('、'));
    var traits = [];
    if (d.immStone) traits.push('免疫石化');
    if (d.immPoison) traits.push('免疫中毒');
    if (d.stunResist) traits.push(d.stunResist + '% 抵抗暈眩');
    if (d.magicDrNonEle) traits.push('受無屬性魔法傷害 −' + d.magicDrNonEle + '%');
    if (traits.length) add('特性', traits.join('、'));
    // 取得方式:讀共用清單 afk-extradata.js 的手動補充(短版,小百科讀同一份);只標可控取得,潘朵拉黑市抽獎(隨機池)不列。製作/掉落另由 craftInfoHTML 與搜尋鈕呈現
    var exAcq = (window.AFK_EXTRA && AFK_EXTRA.itemAcquire) ? AFK_EXTRA.itemAcquire[id] : null;
    if (exAcq && exAcq.short) add('取得方式', exAcq.short);
    if (d.safe != null) add('安定值', d.safe);
    if (d.p) add('賣店價', Math.floor(d.p * 0.3).toLocaleString() + ' 金幣');   // 賣給商店約得定價(p)的 3 成;祝福/屬性/遠古詞綴各再 ×10
    var icon = '';
    try { icon = (typeof getIconUrl === 'function') ? getIconUrl(d) : ''; } catch (e) {}
    var img = icon ? '<img class="m-dex-iimg" src="' + esc(icon) + '" alt="" onerror="this.style.display=\'none\'">' : '';
    var nameCls = d.legend ? ' c-legend' : '';
    var desc = d.d ? '<div class="m-dex-idesc">' + d.d + '</div>' : '';   // d 為遊戲內建文字(可含 <br>),原樣顯示
    var searchBtn = '<button class="m-dex-pop-search" data-item="' + esc(d.n) + '">🔍 查有哪些怪會掉這件</button>';
    return '<div class="m-dex-ihead">' + img + '<div class="m-dex-iname-big' + nameCls + '">' + esc(d.n) + '</div></div>' +
      (rows.length ? '<table class="m-dex-itable"><tbody>' + rows.join('') + '</tbody></table>' : '') + desc + craftInfoHTML(id) + shopInfoHTML(id) + searchBtn;
  }
  function openItemPop(id) {
    var pop = document.getElementById('m-dex-itempop'); if (!pop) return;
    document.getElementById('m-dex-itempop-body').innerHTML = itemDetailHTML(id);
    pop.classList.add('open');
    var c = document.getElementById('m-dex-itempop-card'); if (c) c.scrollTop = 0;
  }
  function closeItemPop() { var pop = document.getElementById('m-dex-itempop'); if (pop) pop.classList.remove('open'); }

  function cardHTML(h, sherine, q) {
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
      ? h.maps.map(function (nm) { return '<span class="m-dex-maplink" data-map="' + esc(nm) + '">' + hl(nm, q) + '</span>'; }).join('、')
      : '—';
    var dropsHTML = h.drops.length
      ? '<table class="m-dex-drops"><tbody>' + h.drops.map(function (d) {
          var pct = d[2] * (sherine ? 3 : 1); if (pct > 100) pct = 100;
          return '<tr>' +
            '<td><span class="m-dex-iname" data-id="' + esc(d[0]) + '" title="看詳情">' + hl(d[1], q) + '</span></td>' +
            '<td class="m-dex-pct">' + fmtPct(pct) + '%</td>' +
            '</tr>';
        }).join('') + '</tbody></table>'
      : '<div class="m-dex-nodrop">無專屬掉落表</div>';
    return '<div class="m-dex-card">' +
      '<div class="m-dex-name">' + hl(m.n, q) + ' ' + tags + '</div>' + stats +
      '<div class="m-dex-sub">出沒地圖</div><div class="m-dex-maps">' + mapsHTML + '</div>' +
      '<div class="m-dex-sub">掉落' + (sherine ? '（席琳的世界 ×3）' : '') + '</div>' + dropsHTML +
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

  // ----- 全域特殊掉落規則 -------------------------------------------------
  // 這些不在任一隻怪的 MOB_DROPS 表內,是遊戲依「等級/類型/地圖/技能」即時判定的條件掉落,
  // 所以不會出現在上面的怪物卡掉落清單。整理成一個預設收合的面板,點開才展開,不佔主版面。
  // 全域特殊掉落規則:每條一個可摺疊區塊(預設收合,面板保持精簡);搜到該條關鍵字會自動展開+高亮+捲到它
  var SPECIAL_BLOCKS = [
    { id: 'dropmult', title: '🔮 掉落倍率：席琳的世界 ×3、恩賜怪 ×10、經典 ×1/10', keys: ['掉落倍率', '倍率', '席琳的世界', '經典模式', '恩賜怪', '恩賜'], lines: [
      '<b>怪物卡上顯示的是「一般」掉落機率</b>，下列狀態會整體放大／縮小：',
      '<b>席琳的世界</b>：被席琳化的怪掉落機率 <b>×3</b>；其中「恩賜怪」更高，<b>×10</b>',
      '<b>經典模式</b>：所有物品掉落機率 <b>×1/10</b>',
      '<b>會被上述倍率影響</b>：怪物卡掉落、黑暗妖精武器、黑精靈水晶、龍騎士掉落、等級 40+ 頭目的賦予祝福卷軸、區域額外掉落',
      '<b>固定、不受倍率影響</b>：席琳結晶、萬能藥（屬性藥）、黑魔石、銀礦石、進化果實（各條另有標註）'
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
      '其他野外／地監：需學「提煉魔石」才掉，二級 1%、三級 0.5%、四級 0.1%',
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
        '<label id="m-dex-sherine-row"><input id="m-dex-sherine" type="checkbox"> 席琳的世界掉落率（×3）</label>' +
        '<div id="m-dex-results"><div class="m-dex-hint">輸入 怪物名 / 地圖 / 掉落物 開始搜尋；搜物品名可直接點看詳情</div></div>' +
        specialPanelHTML() +
      '</div>' +
      '<div id="m-dex-itempop"><div id="m-dex-itempop-card"><button id="m-dex-itempop-close" type="button" title="關閉" aria-label="關閉">✕</button><div id="m-dex-itempop-body"></div></div></div>';
    document.body.appendChild(m);
    document.getElementById('m-dex-input').addEventListener('input', doSearch);
    document.getElementById('m-dex-sherine').addEventListener('change', doSearch);
    document.getElementById('m-dex-close').addEventListener('click', closeModal);
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
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(); });   // 點背景關閉
    document.getElementById('m-dex-itempop-close').addEventListener('click', closeItemPop);
    document.getElementById('m-dex-itempop').addEventListener('click', function (e) { if (e.target.id === 'm-dex-itempop') closeItemPop(); });   // 點彈窗背景關閉
    // 詳情卡裡的「查有哪些怪會掉這件」→ 關卡片 + 以物品名搜尋
    document.getElementById('m-dex-itempop-body').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.m-dex-pop-search') : null;
      if (!b) return;
      closeItemPop();
      var i = document.getElementById('m-dex-input');
      if (i) { i.value = b.getAttribute('data-item') || ''; doSearch(); }
      var r = document.getElementById('m-dex-results'); if (r) r.scrollTop = 0;
    });
  }
  function openModal() { var m = document.getElementById('m-dex-modal'); if (m) { m.classList.add('open'); var i = document.getElementById('m-dex-input'); if (i) i.focus(); } }
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
      '#m-dex-sherine-row{display:flex;align-items:center;gap:8px;padding:9px 14px;color:#cbd5e1;font-size:14px;border-bottom:1px solid #1e293b;cursor:pointer;flex:0 0 auto;}',
      '#m-dex-sherine-row input{width:17px;height:17px;}',
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
      '.m-dex-maplink{color:#7dd3fc;text-decoration:underline;cursor:pointer;}',
      '.m-dex-maplink:active{color:#38bdf8;}',
      /* 掉落物:點名稱=看詳情(慣例:點物品就是看它);查掉落來源的按鈕收進詳情卡裡。 */
      '.m-dex-iname{color:#7dd3fc;text-decoration:underline;cursor:pointer;}',
      '.m-dex-iname:active{color:#38bdf8;}',
      '.m-dex-imatch-h{color:#fcd34d;font-weight:bold;font-size:13.5px;margin-bottom:6px;}',
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
