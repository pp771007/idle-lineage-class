/**
 * afk-bossavoid.js — 只迴避指定頭目：上游的「迴避頭目(瞬移卷軸)」原本全部都躲，改成每張地圖各自挑要躲哪幾隻
 *
 * 為什麼是「借上游的 noAutoTeleport 旗標」而不是自己攔瞬移：
 *   上游決定要不要逃的那行條件是 `mapState.mobs.some(m => m && m.boss && !m.noAutoTeleport)`（js/07 autoActions），
 *   而 `mapState.mobs[i]` 是 `{...DB.mobs[id]}` 展開出來的**實例副本**——在條件跑之前把「玩家沒挑到的王」
 *   暫時標成 noAutoTeleport、跑完立刻還原，上游自己的 .some() 就自然只看得到玩家挑的那幾隻。不必動核心。
 *
 * 為什麼沿用上游的瞬移而不是「讓牠不要生出來」：
 *   瞬移是走上游的 useItem，**「哪些地圖不能傳送」整套守衛由上游自己套用**（行動限制／軍王之室／
 *   傲慢之塔排名 11F 無支配符／遺忘之島…），被擋下就不消耗卷軸。自己做「不出現」則必須維護一張地圖排除
 *   清單，上游每加一個副本就可能漏掉，而漏掉的症狀是安靜的。
 *
 * 資料模型：{ 地圖key: [怪id…] }，**依存檔位(角色)分開**。
 *   某張圖沒有條目或條目是空的 = 那張圖全部迴避 = 上游今天的行為（所以沒設定過的玩家體驗完全不變）。
 *
 * ⚠️ 還原一定要放 finally：mapState.mobs 會被序列化進存檔，殘留的 noAutoTeleport 會被 js/27 的離線收益
 *    估算讀到（它也看這個旗標），變成看不出來的髒資料。
 *
 * ⚠️ DB / mapState / player / currentSlot 都是核心的 const/let，不掛 window：一律裸名存取。
 */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('bossavoid')) return;   // 🎚️ 外掛開關（id 已列在 afk-toggles 內建目錄）

  if (typeof window.autoActions !== 'function' || typeof DB === 'undefined' || !DB.maps || !DB.mobs) {
    try { console.warn('[AFK-bossavoid] 缺核心 autoActions / DB，只迴避指定頭目停用。'); } catch (e) {}
    return;
  }

  var LS_PREFIX = 'afk_bossavoid_';

  // ── 清單 ──────────────────────────────────────────────────────────
  var _slot = -1;          // 已載入的存檔位（-1＝還沒載過）
  var _byMap = null;       // { 地圖key: [怪id…] }
  var _nameMapKey = '';    // 名字集合的快取（場上的怪實例只有 n、沒有 id）
  var _nameSet = null;

  function slotOf() { var n = +currentSlot; return (Number.isInteger(n) && n >= 1) ? n : 0; }

  function load() {
    var s = slotOf();
    if (_slot === s) return _byMap;
    _slot = s; _byMap = null; _nameMapKey = ''; _nameSet = null;
    if (!s) return null;
    try {
      var o = JSON.parse(localStorage.getItem(LS_PREFIX + s) || 'null');
      if (o && typeof o === 'object' && !Array.isArray(o)) _byMap = o;
    } catch (e) {}
    return _byMap;
  }

  function save() {
    var s = slotOf();
    if (!s) return;
    try { localStorage.setItem(LS_PREFIX + s, JSON.stringify(_byMap || {})); } catch (e) {}
    _nameMapKey = ''; _nameSet = null;
  }

  function pickedIds(mapKey) {
    var m = load();
    var a = m && m[mapKey];
    return (a && a.length) ? a : null;
  }

  /** 這張圖玩家挑了哪幾隻（名字集合）；null＝沒挑＝全部迴避 */
  function pickedNames(mapKey) {
    var ids = pickedIds(mapKey);
    if (!ids) return null;
    if (_nameMapKey === mapKey && _nameSet) return _nameSet;
    var set = Object.create(null);
    for (var i = 0; i < ids.length; i++) { var d = DB.mobs[ids[i]]; if (d) set[d.n] = 1; }   // 認不得的 id 忽略：上游改 id 只會讓那一條失效
    _nameMapKey = mapKey; _nameSet = set;
    return set;
  }

  function setPicked(mapKey, ids) {
    load();
    if (!_byMap) _byMap = {};
    if (ids && ids.length) _byMap[mapKey] = ids.slice();
    else delete _byMap[mapKey];   // 空的就不留條目，語意＝回到「全部迴避」
    save();
  }

  // ── 核心掛點 ──────────────────────────────────────────────────────
  var _origAutoActions = window.autoActions;
  window.autoActions = function () {
    var picked = null;
    try {
      var cur = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
      if (cur) picked = pickedNames(cur);
    } catch (e) {}
    if (!picked) return _origAutoActions.apply(this, arguments);   // 沒挑＝全部迴避＝上游原行為，完全不介入

    var touched = null;
    try {
      var mobs = mapState.mobs;
      for (var i = 0; i < mobs.length; i++) {
        var m = mobs[i];
        if (!m || !m.boss || m.noAutoTeleport) continue;   // 上游本來就標了不躲的（樓梯／傳送門／卡瑞）不碰
        if (picked[m.n]) continue;                         // 玩家挑了要躲 → 保持原樣，讓上游照常瞬移
        m.noAutoTeleport = true;                           // 沒挑到 → 暫時偽裝成「不該被迴避頭目甩掉」
        (touched || (touched = [])).push(m);
      }
    } catch (e) {}

    try { return _origAutoActions.apply(this, arguments); }
    finally { if (touched) for (var j = 0; j < touched.length; j++) delete touched[j].noAutoTeleport; }
  };

  /**
   * 給 afk-offline 的快速段用。
   * 快速段不跑 autoActions（它自己 1:1 重放瞬移分支，見 afk-offline 的 fastTeleportAwayBoss），
   * 所以上面那招在那裡吃不到，要由它主動問一次。
   * 回 true＝這隻該躲（等同上游今天的行為）。
   */
  function shouldAvoid(m) {
    try {
      if (!m || !m.boss || m.noAutoTeleport) return false;
      var picked = pickedNames((typeof mapState !== 'undefined' && mapState) ? mapState.current : '');
      return !picked || !!picked[m.n];
    } catch (e) { return true; }   // 判斷不出來就照上游原行為（全部躲），不要因為外掛出錯而改變遊戲
  }

  window.AFK_BOSSAVOID = {
    shouldAvoid: shouldAvoid,
    picked: function (mapKey) { var a = pickedIds(mapKey); return a ? a.slice() : []; },
    set: setPicked,
    open: function () { openPanel(); }
  };

  // ── 這張圖有哪些「躲得掉」的頭目 ──────────────────────────────────
  //   帶 noAutoTeleport 的排除：上游對牠們從來就不會瞬移，列出來讓玩家勾等於騙人。
  function bossesOf(mapKey) {
    var out = [];
    try {
      var pool = DB.maps[mapKey];
      if (!Array.isArray(pool)) return out;
      var seen = Object.create(null);
      for (var i = 0; i < pool.length; i++) {
        var id = pool[i], d = DB.mobs[id];
        if (!d || !d.boss || d.noAutoTeleport || seen[id]) continue;
        seen[id] = 1;
        out.push({ id: id, n: d.n, lv: d.lv || 0 });
      }
    } catch (e) {}
    out.sort(function (a, b) { return (a.lv - b.lv) || (a.n < b.n ? -1 : 1); });
    return out;
  }

  function curMap() { try { return (mapState && mapState.current) || ''; } catch (e) { return ''; } }
  function mapLabel(k) {
    try {
      if (typeof _CARD_MAP_NAMES !== 'undefined' && _CARD_MAP_NAMES[k]) return _CARD_MAP_NAMES[k];
      return (typeof mapDisplayName === 'function' ? mapDisplayName(k) : null) || '';
    } catch (e) { return ''; }
  }

  // ── 面板 ──────────────────────────────────────────────────────────
  var layer = null, _panelMap = '';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function renderRows() {
    var box = document.getElementById('m-bav-list');
    if (!box) return;
    var list = bossesOf(_panelMap);
    if (!list.length) { box.innerHTML = '<div class="m-bav-empty">這張地圖沒有頭目。</div>'; return; }
    var pick = {};
    AFK_BOSSAVOID.picked(_panelMap).forEach(function (id) { pick[id] = 1; });
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      html += '<div class="m-bav-row' + (pick[e.id] ? ' on' : '') + '" data-id="' + esc(e.id) + '">'
        + '<div class="m-bav-cb"></div>'
        + '<div class="m-bav-nm">' + esc(e.n) + '<span class="m-bav-lv">Lv.' + e.lv + '</span></div>'
        + '</div>';
    }
    box.innerHTML = html;
    var clr = document.getElementById('m-bav-clear');
    if (clr) clr.disabled = !AFK_BOSSAVOID.picked(_panelMap).length;
  }

  function toggleId(id) {
    var ids = AFK_BOSSAVOID.picked(_panelMap);
    var at = ids.indexOf(id);
    if (at < 0) ids.push(id); else ids.splice(at, 1);
    setPicked(_panelMap, ids);
    renderRows();
    syncButton();
  }

  function buildModal() {
    if (document.getElementById('m-bav-modal')) return;
    var wrap = document.createElement('div');
    wrap.id = 'm-bav-modal';
    wrap.innerHTML =
      '<div class="m-bav-box">'
      + '<div class="m-bav-head"><span id="m-bav-title">迴避哪些頭目</span><button type="button" id="m-bav-x">✕</button></div>'
      + '<div id="m-bav-list"></div>'
      + '<div class="m-bav-foot"><button type="button" class="m-bav-btn" id="m-bav-clear">全部迴避</button></div>'
      + '</div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    document.getElementById('m-bav-x').addEventListener('click', close);
    document.getElementById('m-bav-clear').addEventListener('click', function () {
      setPicked(_panelMap, []); renderRows(); syncButton();
    });
    document.getElementById('m-bav-list').addEventListener('click', function (e) {
      var row = e.target.closest ? e.target.closest('.m-bav-row') : null;
      if (row) toggleId(row.getAttribute('data-id'));
    });
  }

  function openPanel() {
    buildModal();
    _panelMap = curMap();
    var t = document.getElementById('m-bav-title');
    var lab = mapLabel(_panelMap);
    if (t) t.textContent = '迴避哪些頭目' + (lab ? ' · ' + lab : '');
    renderRows();
    document.getElementById('m-bav-modal').style.display = 'flex';
    layer = (window.AFK_UI && AFK_UI.openLayer) ? AFK_UI.openLayer(doClose) : null;   // 手機返回鍵 / ESC 可關
  }
  function close() { if (layer && window.AFK_UI) AFK_UI.closeLayer(layer); else doClose(); }
  function doClose() {
    layer = null;
    var m = document.getElementById('m-bav-modal');
    if (m) m.style.display = 'none';
  }

  // ── 入口：緊接在上游「迴避頭目(瞬移卷軸)」那一列下面 ───────────────
  //   放這裡而不是自動化分頁底部的外掛列：這是那顆勾選框的細部設定，隔一整頁玩家不會把兩件事聯想在一起。
  function syncButton() {
    var b = document.getElementById('m-bav-entry');
    if (!b) return;
    var map = curMap();
    var ids = AFK_BOSSAVOID.picked(map);
    var txt;
    if (!bossesOf(map).length) txt = '迴避對象：這張圖沒有頭目';
    else if (!ids.length) txt = '迴避對象：全部';
    else if (ids.length === 1 && DB.mobs[ids[0]]) txt = '迴避對象：' + DB.mobs[ids[0]].n;
    else txt = '迴避對象：' + ids.length + ' 隻';
    if (b.textContent !== txt) b.textContent = txt;
  }

  function injectEntry() {
    if (document.getElementById('m-bav-entry')) { syncButton(); return true; }
    var tp = document.getElementById('set-teleport');
    if (!tp) return false;
    var host = tp.closest('label');
    if (!host || !host.parentElement) return false;
    var b = document.createElement('button');
    b.id = 'm-bav-entry'; b.type = 'button';
    // col-span-2:那一排勾選框是 grid-cols-2,不佔滿兩欄的話按鈕會被塞進單一窄格、文字折成好幾行。
    //   (上游自己的「弓箭耗盡自動購買」那列也是這樣佔滿;此 class 在 index.html 已字面出現過＝預建置 css 裡有)
    b.className = 'm-bav-entrybtn';   // 佔一欄：右邊那格放「寵物自動復活」
    b.addEventListener('click', openPanel);
    host.parentElement.insertBefore(b, host.nextSibling);
    syncButton();
    return true;
  }

  function injectCss() {
    if (document.getElementById('m-bav-css')) return;
    var st = document.createElement('style');
    st.id = 'm-bav-css';
    // z-index 9800：比照 afk-junkmgr——壓過手機底部導覽列(9600)與浮動日誌(9500)，仍低於 AFK_UI 的 alert/confirm。
    st.textContent = [
      // justify-self:start → 在 grid 裡不要被撐滿整列,按鈕貼著文字寬度;左邊縮排表示它屬於上面那顆勾選框
      '.m-bav-entrybtn{justify-self:start;margin:2px 0 4px 24px;padding:3px 10px;font-size:12px;font-family:inherit;white-space:nowrap;cursor:pointer;background:#1e293b;border:1px solid #475569;border-radius:6px;color:#93c5fd;}',
      '.m-bav-entrybtn:hover{background:#334155;}',
      '#m-bav-modal{position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:9800;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;padding:14px;}',
      '.m-bav-box{width:100%;max-width:420px;max-height:calc((100dvh - var(--orig-bar-h,0px)) * .9);display:flex;flex-direction:column;overflow:hidden;background:#0f172a;border:1px solid #475569;border-radius:12px;color:#e2e8f0;box-shadow:0 20px 60px rgba(0,0,0,.6);}',
      '.m-bav-head{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;font-size:15px;font-weight:bold;color:#fbbf24;border-bottom:1px solid #334155;}',
      '.m-bav-head button{background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:0 4px;flex:none;}',
      '#m-bav-list{flex:1;min-height:80px;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;border-top:1px solid #1e293b;border-bottom:1px solid #1e293b;background:#0b1220;}',
      '.m-bav-row{display:flex;align-items:center;gap:9px;padding:9px 12px;border-bottom:1px solid #1e293b;cursor:pointer;user-select:none;-webkit-user-select:none;}',
      '.m-bav-row:hover{background:#152034;}',
      '.m-bav-row.on{background:#3b2a08;}',
      '.m-bav-cb{flex:none;width:17px;height:17px;border:1px solid #64748b;border-radius:4px;background:#0f172a;position:relative;}',
      '.m-bav-row.on .m-bav-cb{background:#b45309;border-color:#d97706;}',
      '.m-bav-row.on .m-bav-cb::after{content:"✓";position:absolute;left:2px;top:-2px;font-size:14px;color:#fff;font-weight:bold;}',
      '.m-bav-nm{flex:1;min-width:0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.m-bav-lv{color:#64748b;font-size:11px;margin-left:6px;}',
      '.m-bav-empty{padding:26px 14px;text-align:center;color:#64748b;font-size:13px;}',
      '.m-bav-foot{flex:none;display:flex;gap:8px;padding:10px 14px;}',
      '.m-bav-btn{flex:1;cursor:pointer;border-radius:6px;padding:8px 6px;font-size:13px;background:#334155;border:1px solid #475569;color:#e2e8f0;font-family:inherit;}',
      '.m-bav-btn:hover{background:#475569;}',
      '.m-bav-btn:disabled{opacity:.45;cursor:default;background:#334155;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
  }

  function init() {
    injectCss();
    injectEntry();
    // 勾選框那一列是靜態 DOM，但換地圖/換角色時按鈕文字要跟著變；順便兜「入口被重繪洗掉」的情況。
    setInterval(function () { if (document.hidden) return; if (!injectEntry()) return; syncButton(); }, 1500);   // 純 DOM,背景分頁跳過(迴避邏輯在 autoActions wrapper,不受影響)
    try { console.log('[AFK-bossavoid] hooks OK — 只迴避指定頭目已啟用。'); } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
