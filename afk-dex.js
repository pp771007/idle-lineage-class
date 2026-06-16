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

  function init() {
    if (typeof DB === 'undefined' || !DB || !DB.mobs || !DB.maps || !DB.items || typeof MOB_DROPS === 'undefined') {
      console.warn('[AFK-dex] 缺少遊戲資料(DB.mobs/maps/items/MOB_DROPS),查詢功能停用。');
      return;
    }
    var menu = document.getElementById('main-menu');
    if (!menu) { console.warn('[AFK-dex] 找不到 #main-menu,查詢功能停用。'); return; }

    injectCSS();
    buildIndexes();
    injectButton(menu);
    buildModal();
    console.log('[AFK-dex] hooks OK — 怪物/掉落查詢已啟用(' + INDEX.length + ' 隻怪)。');
  }

  // ----- 名稱查詢 ---------------------------------------------------------
  // CASTLE_EXTRA 類地圖(如風木地監)只有 getCastleAreas() 動態才有中文名、靜態表查不到,在這補上
  var EXTRA_MAP_NAMES = { windwood_dungeon: '風木地監' };
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
  }

  // ----- 搜尋 + 渲染 ------------------------------------------------------
  function doSearch() {
    var input = document.getElementById('m-dex-input');
    var results = document.getElementById('m-dex-results');
    if (!input || !results) return;
    var sherine = document.getElementById('m-dex-sherine').checked;
    var clearBtn = document.getElementById('m-dex-clear');
    if (clearBtn) clearBtn.classList.toggle('show', !!input.value);   // 有字才顯示清除鈕
    var q = (input.value || '').trim().toLowerCase();
    if (!q) { results.innerHTML = '<div class="m-dex-hint">輸入 怪物名 / 地圖 / 掉落物 開始搜尋</div>'; return; }
    var hits = [];
    for (var i = 0; i < INDEX.length && hits.length <= MAX_RESULTS; i++) if (INDEX[i].hay.indexOf(q) >= 0) hits.push(INDEX[i]);
    if (!hits.length) { results.innerHTML = '<div class="m-dex-hint">找不到符合的怪物</div>'; return; }
    var truncated = hits.length > MAX_RESULTS;
    if (truncated) hits = hits.slice(0, MAX_RESULTS);
    var html = hits.map(function (h) { return cardHTML(h, sherine, q); }).join('');
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
  function fmt(n) { try { return (n == null ? '-' : Number(n).toLocaleString()); } catch (e) { return '' + n; } }
  function fmtPct(p) { return p < 0.01 ? p.toFixed(3) : (p < 1 ? p.toFixed(2) : (Number.isInteger(p) ? '' + p : p.toFixed(1))); }
  function st(k, v) { return '<span class="m-dex-stat"><b>' + k + '</b> ' + esc(v) + '</span>'; }

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
          return '<tr><td><span class="m-dex-droplink" data-item="' + esc(d[1]) + '">' + hl(d[1], q) + '</span></td><td class="m-dex-pct">' + fmtPct(pct) + '%</td></tr>';
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
    var b = document.createElement('button');
    b.id = 'm-dex-open';
    b.type = 'button';
    b.className = 'btn text-xl w-72 py-4 bg-amber-700 hover:bg-amber-600 border-amber-500';
    b.textContent = '📖 怪物 / 掉落查詢';
    b.addEventListener('click', openModal);
    menu.appendChild(b);
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
            '<input id="m-dex-input" type="text" placeholder="搜尋 怪物名 / 地圖 / 掉落物…" autocomplete="off">' +
            '<button id="m-dex-clear" type="button" title="清除" aria-label="清除">✕</button>' +
          '</span>' +
          '<button id="m-dex-close" type="button" title="關閉">✕</button>' +
        '</div>' +
        '<label id="m-dex-sherine-row"><input id="m-dex-sherine" type="checkbox"> 席琳的世界掉落率（×3）</label>' +
        '<div id="m-dex-results"><div class="m-dex-hint">輸入 怪物名 / 地圖 / 掉落物 開始搜尋</div></div>' +
        '<div id="m-dex-note">※ 妖精森林周邊、眠龍洞穴1~3樓 的所有怪另有「區域額外掉落」：粗糙的米索莉塊／精靈玉／元素石 各 20%（學會「世界樹的呼喚」則各 30%），此清單未含這部分。</div>' +
      '</div>';
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
      var link = e.target.closest('.m-dex-maplink') || e.target.closest('.m-dex-droplink');
      if (!link) return;
      var i = document.getElementById('m-dex-input');
      i.value = link.getAttribute('data-map') || link.getAttribute('data-item') || '';
      doSearch();
      var r = document.getElementById('m-dex-results'); if (r) r.scrollTop = 0;
    });
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(); });   // 點背景關閉
  }
  function openModal() { var m = document.getElementById('m-dex-modal'); if (m) { m.classList.add('open'); var i = document.getElementById('m-dex-input'); if (i) i.focus(); } }
  function closeModal() { var m = document.getElementById('m-dex-modal'); if (m) m.classList.remove('open'); }

  // ----- CSS --------------------------------------------------------------
  function injectCSS() {
    if (document.getElementById('m-dex-style')) return;
    var css = [
      '#m-dex-modal{display:none;position:fixed;inset:0;z-index:1000;background:rgba(2,6,23,0.82);align-items:flex-start;justify-content:center;padding:20px 10px;}',
      '#m-dex-modal.open{display:flex;}',
      '#m-dex-card-wrap{width:min(680px,96vw);max-height:92vh;max-height:calc(100dvh - 40px);display:flex;flex-direction:column;background:#0f172a;border:1px solid #334155;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden;font-family:system-ui,"Segoe UI",sans-serif;}',
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
      '.m-dex-droplink{color:#7dd3fc;text-decoration:underline;cursor:pointer;}',
      '.m-dex-droplink:active{color:#38bdf8;}',
      '.m-dex-nodrop{font-size:13px;color:#64748b;}',
      '.m-dex-drops{width:100%;border-collapse:collapse;font-size:13px;}',
      '.m-dex-drops td{padding:3px 4px;border-bottom:1px solid #1e293b;color:#e2e8f0;}',
      '.m-dex-pct{text-align:right;color:#fcd34d;white-space:nowrap;width:1%;}',
      '#m-dex-note{flex:0 0 auto;padding:10px 14px;border-top:1px solid #1e293b;color:#94a3b8;font-size:12px;line-height:1.5;}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = 'm-dex-style';
    s.textContent = css;
    document.head.appendChild(s);
  }
})();
