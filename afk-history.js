/* ============================================================================
 * afk-history.js — 首頁「⚙ 設定」選單 → 離線掛機歷史紀錄
 *
 * 把「📜 離線掛機紀錄」註冊成首頁設定選單的一項(選單本身由 afk-storage 渲染)。
 * 點開後彈出 modal,把每個存檔位角色「最近 5 筆離線掛機」列成可比較的卡片:
 *   時間範圍(關閉→登入、真實時長)、地點、經驗/金錢(含 /10分 平均)、升級、
 *   獲得道具(依品階上色)、擊殺各怪數量(多→少)。
 *
 * 上方工具列可:① 選只看某個存檔位 / 全部;② 多選要顯示哪些欄位(經驗/金錢/道具/擊殺),方便整理。
 *
 * 資料來源:afk-offline.js 結算離線時寫進的 localStorage 鍵 afk_hist_<slot>(陣列)。
 * 角色身分:呼叫遊戲全域 slotSummary(n) 唯讀讀存檔摘要(名稱/職業/等級),讀不到就只顯示存檔位。
 *
 * 🔒 對玩家存檔唯讀:只讀 afk_hist_<slot> 與存檔摘要,絕不寫入遊戲存檔、不呼叫 saveGame、不碰任何遊戲資料。
 *           (顯示偏好——存檔篩選 / 排序 / 欄位多選——會存進我們自己的 afk_hist_prefs 記住,跨開啟保留;這是外掛自己的 key,與遊戲存檔無關。)
 *
 * 優雅降級:抓不到 #main-menu 就安靜停用,不影響遊戲。
 * 掛接:在 index.html 的 </body> 前加一行 <script src="afk-history.js"></script>
 * ========================================================================== */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  var HIST_RE = /^afk_hist_(\d+)$/;
  var CLS_NAME = { knight: '騎士', mage: '法師', elf: '妖精', dark: '黑暗妖精', illusion: '幻術士', dragon: '龍騎士', warrior: '戰士', royal: '王族' };
  var FIELD_DEFS = [{ k: 'exp', label: '經驗' }, { k: 'gold', label: '金錢' }, { k: 'items', label: '道具' }, { k: 'kills', label: '擊殺' }];

  // ----- 顯示偏好(存進外掛自己的 afk_hist_prefs 記住,不碰遊戲存檔):看哪個存檔位、排序方式、顯示哪些欄位 -----
  var slotFilter = 'all';
  var sortMode = 'slot';   // 'slot'=依存檔分組(預設);'time'=全部攤平依時間新→舊
  var fState = { exp: true, gold: true, items: true, kills: true };

  var PREFS_KEY = 'afk_hist_prefs';
  function loadPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(PREFS_KEY));
      if (!p || typeof p !== 'object') return;
      if (typeof p.slotFilter === 'string') slotFilter = p.slotFilter;   // 存檔已無紀錄時 renderToolbar 會自動回退 'all'
      if (p.sortMode === 'slot' || p.sortMode === 'time') sortMode = p.sortMode;
      if (p.fState && typeof p.fState === 'object') FIELD_DEFS.forEach(function (f) { if (typeof p.fState[f.k] === 'boolean') fState[f.k] = p.fState[f.k]; });
    } catch (e) {}
  }
  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ slotFilter: slotFilter, sortMode: sortMode, fState: fState })); } catch (e) {}
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function fmtNum(n) { try { return (n || 0).toLocaleString(); } catch (e) { return '' + (n || 0); } }

  // epoch ms → 本地時間「M月D日 HH:mm」(玩家裝置在地時間=他離線/登入的當地時刻)
  function fmtClock(ms) {
    var d = new Date(ms);
    if (isNaN(d.getTime())) return '?';
    var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hh + ':' + mm;
  }
  // 時長(ms)→「X 時 Y 分」/「X 分」/「X 秒」
  function fmtDur(ms) {
    var totalMin = Math.floor(ms / 60000);
    if (totalMin < 1) return Math.max(1, Math.round(ms / 1000)) + ' 秒';
    var h = Math.floor(totalMin / 60), m = totalMin % 60;
    if (h <= 0) return m + ' 分';
    return h + ' 時' + (m ? ' ' + m + ' 分' : '');
  }
  // 平均效率(對齊遊戲「經驗/10分、金幣/10分」);分母用「實際結算時間 settledMs」才不會被 24h 上限/陣亡稀釋
  function per10(val, settledMs) {
    if (!settledMs || settledMs <= 0) return 0;
    return Math.floor(val / (settledMs / 600000));
  }

  // 掃 localStorage 取得「有離線紀錄」的存檔位(由小到大),每個附 records
  function collectSlots() {
    var slots = [];
    for (var k in localStorage) {
      if (!Object.prototype.hasOwnProperty.call(localStorage, k)) continue;
      var m = HIST_RE.exec(k);
      if (!m) continue;
      var recs = [];
      try { recs = JSON.parse(localStorage.getItem(k)) || []; } catch (e) { recs = []; }
      if (!Array.isArray(recs) || !recs.length) continue;
      slots.push({ slot: m[1], recs: recs });
    }
    slots.sort(function (a, b) { return (+a.slot) - (+b.slot); });
    return slots;
  }

  // 角色摘要(唯讀讀存檔);回 { name, cls(中文) } 或 null
  function slotInfo(slot) {
    var sum = null;
    try { if (typeof slotSummary === 'function') sum = slotSummary(slot); } catch (e) {}
    if (!sum) return null;
    var cls = sum.cls || ''; if (CLS_NAME[cls]) cls = CLS_NAME[cls];
    return { name: sum.name || '未命名', cls: cls, lv: sum.lv || 1 };
  }
  function slotHeadHTML(slot, count) {
    var info = slotInfo(slot);
    var title = info
      ? '存檔 ' + slot + ' · <span class="m-hist-cname">' + esc(info.name) + '</span> <span class="m-hist-cmeta">' + esc(info.cls) + ' Lv.' + info.lv + '</span>'
      : '存檔 ' + slot;
    return '<div class="m-hist-slot-head">' + title + '<span class="m-hist-count">最近 ' + count + ' 筆</span></div>';
  }
  // 存檔下拉選項的純文字標籤(option 不放 HTML)
  function slotOptLabel(slot) {
    var info = slotInfo(slot);
    return info ? ('存檔 ' + slot + ' · ' + info.name + '（' + info.cls + ' Lv.' + info.lv + '）') : ('存檔 ' + slot);
  }

  function kindBadge(kind) {
    if (kind === 'climb') return '<span class="m-hist-badge bg-sky">攀登</span>';
    if (kind === 'oblivion') return '<span class="m-hist-badge bg-teal">遺忘之島</span>';
    if (kind === 'king') return '<span class="m-hist-badge bg-amber">軍王之室</span>';
    return '';
  }

  // 依時間排序時,卡片內標出這筆是哪個存檔/角色(依存檔分組時已有區塊標題,不需要)
  function cardSlotTag(slot) {
    var info = slotInfo(slot);
    var t = info
      ? '存檔 ' + slot + ' · <span class="m-hist-cname">' + esc(info.name) + '</span> <span class="m-hist-cmeta">' + esc(info.cls) + ' Lv.' + info.lv + '</span>'
      : '存檔 ' + slot;
    return '<div class="m-hist-cardslot">' + t + '</div>';
  }

  function recordCard(r, slotTagHTML) {
    var html = '<div class="m-hist-card">';
    if (slotTagHTML) html += slotTagHTML;   // 時間排序模式:標出來自哪個存檔/角色
    // 時間列(永遠顯示)
    html += '<div class="m-hist-time">🕒 <b>' + fmtClock(r.closeTs) + '</b> → <b>' + fmtClock(r.loginTs) + '</b>'
      + '<span class="m-hist-dur">（共 ' + fmtDur(r.realMs) + '）</span>';
    if (r.capped) html += '<span class="m-hist-flag flag-cap" title="離線超過 24 小時,實際只結算到上限">已達 24h 上限</span>';
    if (r.died) html += '<span class="m-hist-flag flag-died">陣亡</span>';
    html += '</div>';
    // 地點(永遠顯示)
    html += '<div class="m-hist-map">📍 ' + esc(r.map || '?') + ' ' + kindBadge(r.kind) + '</div>';
    // 經驗 / 升級 / 金錢(升級跟著「經驗」一起開關)
    var stats = [];
    if (fState.exp && r.exp > 0) stats.push('<span class="m-hist-stat"><span class="lbl">經驗</span> <b class="v-exp">+' + fmtNum(r.exp) + '</b>'
      + '<span class="avg">平均 ' + fmtNum(per10(r.exp, r.settledMs)) + ' / 10分</span></span>');
    if (fState.exp && r.lv > 0) stats.push('<span class="m-hist-stat"><span class="lbl">升級</span> <b class="v-lv">+' + r.lv + ' 級</b></span>');
    if (fState.gold && r.gold > 0) stats.push('<span class="m-hist-stat"><span class="lbl">金錢</span> <b class="v-gold">+' + fmtNum(r.gold) + '</b>'
      + '<span class="avg">平均 ' + fmtNum(per10(r.gold, r.settledMs)) + ' / 10分</span></span>');
    if (stats.length) html += '<div class="m-hist-stats">' + stats.join('') + '</div>';
    // 道具(依品階上色)
    if (fState.items && r.items && r.items.length) {
      var its = r.items.map(function (it) {
        return '<span class="m-hist-item ' + esc(it.c || 'text-slate-200') + '">' + esc(it.n) + ' ×' + fmtNum(it.cnt) + '</span>';
      }).join('');
      html += '<div class="m-hist-row"><span class="m-hist-rowlbl">道具</span><span class="m-hist-rowval">' + its + '</span></div>';
    }
    // 擊殺:顯示一律「多 → 少」(不管儲存順序,先複製再排序、不動原陣列)
    if (fState.kills && r.kills && r.kills.length) {
      var ks = r.kills.slice().sort(function (a, b) { return b.cnt - a.cnt; }).map(function (k) {
        return '<span class="m-hist-kill">' + esc(k.n) + ' ×' + fmtNum(k.cnt) + '</span>';
      }).join('');
      html += '<div class="m-hist-row"><span class="m-hist-rowlbl">擊殺</span><span class="m-hist-rowval">' + ks + '</span></div>';
    }
    if (r.keysUsed > 0) html += '<div class="m-hist-keys">🔑 消耗軍王的鑰匙 ' + r.keysUsed + ' 把</div>';
    html += '</div>';
    return html;
  }

  // 工具列:存檔下拉 + 欄位多選 chips。slotFilter / fState 變動時只重畫清單。
  function renderToolbar() {
    var tb = document.getElementById('m-hist-toolbar');
    if (!tb) return;
    var slots = collectSlots();
    if (slotFilter !== 'all' && !slots.some(function (s) { return s.slot === slotFilter; })) slotFilter = 'all';   // 選的存檔已無紀錄 → 回全部
    var opts = '<option value="all">全部存檔</option>';
    slots.forEach(function (s) { opts += '<option value="' + s.slot + '">' + esc(slotOptLabel(s.slot)) + '</option>'; });
    var chips = FIELD_DEFS.map(function (f) {
      return '<span class="m-hist-chip' + (fState[f.k] ? ' on' : '') + '" data-field="' + f.k + '">' + f.label + '</span>';
    }).join('');
    tb.innerHTML =
      '<div class="m-hist-tb-row"><span class="m-hist-tb-lbl">存檔</span>' +
        '<select id="m-hist-slot-sel" class="m-hist-sel">' + opts + '</select></div>' +
      '<div class="m-hist-tb-row"><span class="m-hist-tb-lbl">排序</span>' +
        '<select id="m-hist-sort-sel" class="m-hist-sel">' +
          '<option value="slot">依存檔分組</option>' +
          '<option value="time">依時間（新 → 舊）</option>' +
        '</select></div>' +
      '<div class="m-hist-tb-row"><span class="m-hist-tb-lbl">顯示</span>' +
        '<div class="m-hist-chips">' + chips + '</div></div>';
    var sel = tb.querySelector('#m-hist-slot-sel');
    sel.value = slotFilter;
    sel.addEventListener('change', function () { slotFilter = this.value; savePrefs(); renderList(); });
    var sortSel = tb.querySelector('#m-hist-sort-sel');
    sortSel.value = sortMode;
    sortSel.addEventListener('change', function () { sortMode = this.value; savePrefs(); renderList(); });
    tb.querySelectorAll('.m-hist-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        var k = this.getAttribute('data-field');
        fState[k] = !fState[k];
        this.classList.toggle('on', fState[k]);
        savePrefs();
        renderList();
      });
    });
  }

  function renderList() {
    var list = document.getElementById('m-hist-list');
    if (!list) return;
    var slots = collectSlots().filter(function (s) { return slotFilter === 'all' || s.slot === slotFilter; });
    if (!slots.length) {
      list.innerHTML = '<div class="m-hist-none">目前還沒有任何離線掛機紀錄。<br>離線掛機並重新登入結算後,這裡就會逐筆累積(每個角色保留最近 5 筆)。</div>';
      return;
    }
    if (sortMode === 'time') {
      // 全部攤平,依「登入(結算)時間」新 → 舊排;跨存檔時每張卡標出來自哪個角色(單一存檔篩選時不必標)
      var flat = [];
      slots.forEach(function (s) { s.recs.forEach(function (r) { flat.push({ slot: s.slot, r: r }); }); });
      flat.sort(function (a, b) { return (b.r.loginTs || b.r.closeTs || 0) - (a.r.loginTs || a.r.closeTs || 0); });
      var showTag = (slotFilter === 'all');
      var thtml = '';
      flat.forEach(function (x) { thtml += recordCard(x.r, showTag ? cardSlotTag(x.slot) : ''); });
      list.innerHTML = thtml;
      return;
    }
    var html = '';
    slots.forEach(function (s) {
      html += '<div class="m-hist-slot">' + slotHeadHTML(s.slot, s.recs.length);
      s.recs.forEach(function (r) { html += recordCard(r); });
      html += '</div>';
    });
    list.innerHTML = html;
  }

  var _layer = null;
  function openModal() {
    var m = document.getElementById('m-hist-modal'); if (!m) return;
    renderToolbar();
    renderList();
    m.classList.add('open');
    _layer = window.AFK_UI ? AFK_UI.openLayer(hideModal) : null;
  }
  function hideModal() { var m = document.getElementById('m-hist-modal'); if (m) m.classList.remove('open'); _layer = null; }
  function closeModal() { if (_layer && window.AFK_UI) AFK_UI.closeLayer(_layer); else hideModal(); }

  function buildModal() {
    if (document.getElementById('m-hist-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'm-hist-modal';
    modal.innerHTML =
      '<div id="m-hist-card">' +
        '<div id="m-hist-head">' +
          '<span id="m-hist-title">📜 離線掛機紀錄</span>' +
          '<button id="m-hist-close" title="關閉">✕</button>' +
        '</div>' +
        '<div id="m-hist-body">' +
          '<div id="m-hist-toolbar"></div>' +
          '<div id="m-hist-list"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    document.getElementById('m-hist-close').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  }

  function injectCSS() {
    if (document.getElementById('m-hist-style')) return;
    var s = document.createElement('style');
    s.id = 'm-hist-style';
    s.textContent = [
      '#m-hist-modal{display:none;position:fixed;inset:0;z-index:1000;background:rgba(2,6,23,0.82);align-items:flex-start;justify-content:center;padding:24px 12px;font-family:system-ui,"Segoe UI",sans-serif;}',
      '#m-hist-modal.open{display:flex;}',
      '#m-hist-card{width:min(620px,96vw);max-height:calc(100dvh - 48px);display:flex;flex-direction:column;background:#0f172a;border:1px solid #334155;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden;}',
      '#m-hist-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #1e293b;flex:0 0 auto;}',
      '#m-hist-title{font-size:16px;font-weight:bold;color:#fff;}',
      '#m-hist-close{width:34px;height:34px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;border-radius:8px;font-size:15px;cursor:pointer;line-height:1;}',
      '#m-hist-close:active{background:#334155;}',
      '#m-hist-body{flex:1 1 auto;overflow-y:auto;padding:14px;}',
      // 工具列:吸頂,滑動清單時固定在上方
      '#m-hist-toolbar{position:sticky;top:0;z-index:2;background:#0f172a;margin:-14px -14px 12px;padding:12px 14px;border-bottom:1px solid #1e293b;display:flex;flex-direction:column;gap:8px;}',
      '.m-hist-tb-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
      '.m-hist-tb-lbl{color:#94a3b8;font-size:12px;flex:0 0 auto;width:30px;}',
      '.m-hist-sel{flex:1 1 auto;min-width:0;background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:7px;padding:6px 9px;font-size:13px;font-family:inherit;}',
      '.m-hist-chips{display:flex;flex-wrap:wrap;gap:6px;}',
      '.m-hist-chip{cursor:pointer;user-select:none;font-size:12.5px;border-radius:999px;padding:4px 13px;border:1px solid #334155;background:#1e293b;color:#64748b;}',
      '.m-hist-chip.on{background:#1d4ed8;border-color:#3b82f6;color:#fff;font-weight:bold;}',
      '.m-hist-none{color:#94a3b8;text-align:center;padding:26px 10px;font-size:14px;line-height:1.8;}',
      '.m-hist-slot{margin-bottom:18px;}',
      '.m-hist-slot:last-child{margin-bottom:0;}',
      '.m-hist-slot-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:14px;color:#e2e8f0;font-weight:bold;padding:0 2px 7px;border-bottom:1px solid #1e293b;margin-bottom:9px;}',
      '.m-hist-cname{color:#fcd34d;}',
      '.m-hist-cmeta{color:#94a3b8;font-weight:normal;font-size:12px;}',
      '.m-hist-count{flex:0 0 auto;color:#64748b;font-size:11.5px;font-weight:normal;}',
      '.m-hist-card{background:#111c30;border:1px solid #1e293b;border-radius:9px;padding:10px 11px;margin-bottom:9px;}',
      '.m-hist-card:last-child{margin-bottom:0;}',
      '.m-hist-cardslot{font-size:12.5px;color:#e2e8f0;font-weight:bold;margin-bottom:7px;padding-bottom:6px;border-bottom:1px dashed #334155;}',
      '.m-hist-time{font-size:13px;color:#cbd5e1;display:flex;align-items:center;flex-wrap:wrap;gap:4px 6px;}',
      '.m-hist-time b{color:#e2e8f0;}',
      '.m-hist-dur{color:#7dd3fc;}',
      '.m-hist-flag{font-size:11px;font-weight:bold;border-radius:6px;padding:1px 7px;}',
      '.flag-cap{background:rgba(180,83,9,.22);color:#fcd34d;border:1px solid #b45309;}',
      '.flag-died{background:rgba(220,38,38,.18);color:#fca5a5;border:1px solid #b91c1c;}',
      '.m-hist-map{font-size:13.5px;color:#fda4af;margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}',
      '.m-hist-badge{font-size:11px;font-weight:bold;border-radius:6px;padding:1px 7px;color:#0f172a;}',
      '.m-hist-badge.bg-sky{background:#7dd3fc;}',
      '.m-hist-badge.bg-teal{background:#5eead4;}',
      '.m-hist-badge.bg-amber{background:#fcd34d;}',
      '.m-hist-stats{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px;}',
      '.m-hist-stat{font-size:13px;color:#cbd5e1;display:inline-flex;align-items:baseline;gap:5px;}',
      '.m-hist-stat .lbl{color:#94a3b8;font-size:12px;}',
      '.m-hist-stat .v-exp{color:#c4b5fd;}',
      '.m-hist-stat .v-gold{color:#fde047;}',
      '.m-hist-stat .v-lv{color:#86efac;}',
      '.m-hist-stat .avg{color:#64748b;font-size:11.5px;margin-left:3px;}',
      '.m-hist-row{display:flex;gap:8px;margin-top:8px;font-size:13px;}',
      '.m-hist-rowlbl{flex:0 0 auto;color:#94a3b8;font-size:12px;padding-top:1px;}',
      '.m-hist-rowval{flex:1 1 auto;display:flex;flex-wrap:wrap;gap:4px 8px;}',
      '.m-hist-item{font-weight:bold;}',
      '.m-hist-kill{color:#e2e8f0;}',
      '.m-hist-keys{margin-top:7px;font-size:12.5px;color:#fcd34d;}'
    ].join('');
    document.head.appendChild(s);
  }

  function init() {
    var menu = document.getElementById('main-menu');
    if (!menu) { console.warn('[AFK-history] 找不到 #main-menu,離線紀錄停用。'); return; }
    loadPrefs();   // 還原上次的顯示偏好(存檔篩選/排序/欄位)
    injectCSS();
    buildModal();
    // 註冊進首頁「⚙ 設定」選單(由 afk-storage 渲染合併;此處只負責 add 一項)
    window.AFK_SETTINGS = window.AFK_SETTINGS || { _items: [], add: function (it) { this._items.push(it); } };
    AFK_SETTINGS.add({ label: '📜 離線掛機紀錄', onClick: openModal });
    console.log('[AFK-history] hooks OK — 離線掛機紀錄已加入首頁設定選單。');
  }

  ready(init);
})();
