/*
 * afk-slotinfo.js — 選角/載入畫面的「額外掛機資訊」掛載外掛(桌機 + 手機共用)
 *
 * 職責:在原作者 openSlotSelect / renderLoadSelect 渲染的存檔位「下方附加」該角色的席琳世界狀態。
 *   (📍 掛機地圖與 ⏱ 已掛機多久 目前不顯示——資料源由暫停使用中的 afk-offline 蓋,見 read())
 *   只「附加」、絕不清空 → 原作者的單行 label(含經典/傳統標籤與配色)、大頭貼都原封不動,
 *   桌機與手機共用同一份附加邏輯(手機差異純由 afk-mobile.js 的 CSS 處理,不另外重建內容)。
 *   對外仍暴露 window.AFK_SLOTINFO.read(slot) → { mapName, idleText }(純資料、無 DOM)供他人取用。
 *
 * 資料來源:存檔 blob(lineage_idle_save_<slot>)的 player.sherineWorld / sherineMad。
 *
 * 優雅降級:openSlotSelect / __afk 不存在就安靜停用,不弄壞畫面。
 */
(function () {
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('slotinfo')) return;   // 🎚️ 外掛開關:關掉就透明放行原版行為
  // 唯一資料源:給一個存檔位編號,回「掛機地圖中文名」與「已掛機多久」文字(沒有就回空字串)
  function read(slot) {
    // 存檔解析一次:優先用原作的 _lzGet(解壓 LZ1) + _saveUnwrap(去簽章),才讀得到壓縮存檔的 ms/p。
    var save = null;
    try {
      var _raw = (typeof _lzGet === 'function') ? _lzGet('lineage_idle_save_' + slot) : localStorage.getItem('lineage_idle_save_' + slot);
      if (_raw && typeof _saveUnwrap === 'function') _raw = _saveUnwrap(_raw).payload;
      if (_raw) save = JSON.parse(_raw);
    } catch (e) {}

    // 📍 掛機地圖與 ⏱ 已掛機時間目前都不顯示——兩者的資料源(afk_map_/afk_ts_<slot>)都由暫停使用中的
    //   afk-offline 蓋:老玩家的值會凍在最後一次遊玩(顯示錯的圖、愈來愈大的假時間),
    //   而中文地圖名要走 window.__afk.mapName,該物件現在也不存在 → 會直接露出英文 id。
    //   afk-offline 恢復時把這兩段還原即可(回傳欄位刻意保留,呼叫端不必改)。
    var mapName = '';
    var idleText = '';

    // 🔮 席琳世界狀態:存於 player.sherineWorld / player.sherineMad(兩者互斥),回 '' / 'world' / 'mad'
    var p = save && save.p;
    var sherine = p ? (p.sherineMad ? 'mad' : (p.sherineWorld ? 'world' : '')) : '';

    return { mapName: mapName, idleText: idleText, sherine: sherine };
  }

  window.AFK_SLOTINFO = { version: '1.0.0', read: read };

  // --- 在原作者的存檔鈕下「附加」📍/⏱ 兩行(桌機 + 手機共用)-----------------------
  //   鈕本體是 flex 橫排(大頭貼 + 單行 label),設 flex-wrap 後把一個滿寬的資訊區塊擠到次行。
  //   只附加、不清空 → 原作者的單行 label、大頭貼、經典/傳統模式樣式都原封不動。手機差異交給 afk-mobile 的 CSS。
  function appendSlotInfo() {
    var list = document.getElementById('slot-list');
    if (!list) return;
    var rows = list.children;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row || row.querySelector('.afk-slot-extra')) continue;   // openSlotSelect 每次重建清單,理論上不會殘留;仍防呆去重
      var info = read(i + 1);
      if (!info.mapName && !info.idleText && !info.sherine) continue;
      // 🆕 上游新版選角：每列＝存檔鈕 + 固定寬匯入區(手機會把鈕擠窄)。改把資訊掛到「整列」下方滿寬一行，
      //   而非塞進被擠窄的按鈕內 → 桌機/手機都在按鈕列底下橫排一行，不再擠成直排。
      row.style.flexWrap = 'wrap';
      var box = document.createElement('span');
      box.className = 'afk-slot-extra';
      box.style.cssText = 'flex-basis:100%;width:100%;display:flex;flex-flow:row wrap;align-items:center;gap:2px 10px;margin-top:3px;padding:0 4px;font-size:.8rem;font-weight:400;color:#94a3b8;line-height:1.3;';
      // 🔮 席琳世界狀態:一般＝綠(同遊戲 c-sherine)、瘋狂＝猩紅(同瘋狂主題);用正式名稱
      if (info.sherine) {
        var s = document.createElement('span');
        s.textContent = info.sherine === 'mad' ? '🔥 瘋狂的席琳世界' : '🔮 席琳的世界';
        s.style.cssText = 'font-weight:700;color:' + (info.sherine === 'mad' ? '#fb7185' : '#4ade80') + ';';
        box.appendChild(s);
      }
      if (info.mapName) { var a = document.createElement('span'); a.textContent = '📍 ' + info.mapName; box.appendChild(a); }
      if (info.idleText) { var b = document.createElement('span'); b.textContent = info.idleText; box.appendChild(b); }
      row.appendChild(box);
    }
  }

  function wrapSlotSelect() {
    if (typeof window.openSlotSelect !== 'function' || window.openSlotSelect.__afkSlotInfo) return false;
    var orig = window.openSlotSelect;
    var wrapped = function () { orig.apply(this, arguments); try { appendSlotInfo(); } catch (e) {} };
    wrapped.__afkSlotInfo = true;
    window.openSlotSelect = wrapped;
    return true;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // --- 🆕 上游新版「卡片式」選角(openLoadSelect/renderLoadSelect)：卡片在 #load-slot-grid，每張是角色立繪。
  //   這才是「開始遊戲」實際走的畫面(舊 openSlotSelect 的 #slot-list 不是它)。掛機資訊直接疊在「每張卡底部」，
  //   一頁 4 張一眼全看到(使用者要求，不用只顯示選中角色的共用資訊面板)。read() 無資料的卡(空位)略過。
  var CAP_BASE = 'position:absolute;z-index:3;pointer-events:none;display:flex;flex-flow:column;align-items:center;gap:1px;padding:4px 5px 5px;font-size:.64rem;line-height:1.3;font-weight:700;text-align:center;text-shadow:0 1px 2px #000;';
  var CAP_ALONE = 'left:0;right:0;bottom:0;background:linear-gradient(to top,rgba(2,6,23,.95),rgba(2,6,23,.72) 62%,transparent);';
  var UPSTREAM_DETAIL_BOTTOM_PCT = 0.025;   // 上游 .load-offline-detail 的 bottom:2.5%

  // 上游 v3.7.39 起自己在卡片底部畫「離線 / 10分 · 經 xx 金 xx · 地圖名」(.load-offline-detail)，
  // 佔掉整條底緣 → 席琳標籤要疊到它上方，否則會把地圖名那行壓掉。該區塊由上游每 2 秒重繪
  // (出現/消失/高度都會變)，所以定位每次現量，並靠 grid 的 MutationObserver 跟著重算。
  function placeCaption(card, cap) {
    var det = card.querySelector('.load-offline-detail');
    if (!det) { cap.style.cssText = CAP_BASE + CAP_ALONE; return; }
    var gap = card.getBoundingClientRect().height * UPSTREAM_DETAIL_BOTTOM_PCT;
    cap.style.cssText = CAP_BASE
      + 'left:4%;right:4%;bottom:' + Math.round(det.getBoundingClientRect().height + gap) + 'px;'
      + 'background:rgba(2,6,23,.9);';
  }

  function decorateCards() {
    var grid = document.getElementById('load-slot-grid');
    if (!grid) return;
    var cards = grid.querySelectorAll('.load-slot-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var old = card.querySelector('.afk-card-slotinfo'); if (old) old.remove();   // 每次重繪清舊的
      var slot = parseInt(card.getAttribute('data-slot'), 10);
      if (!slot) continue;
      var info = read(slot);
      if (!info.mapName && !info.idleText && !info.sherine) continue;
      try { if (getComputedStyle(card).position === 'static') card.style.position = 'relative'; } catch (e) {}
      var html = '';
      if (info.sherine) html += '<span style="color:' + (info.sherine === 'mad' ? '#fb7185' : '#4ade80') + ';">' + (info.sherine === 'mad' ? '🔥 瘋狂席琳' : '🔮 席琳世界') + '</span>';
      if (info.mapName) html += '<span style="color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">📍 ' + esc(info.mapName) + '</span>';
      if (info.idleText) html += '<span style="color:#cbd5e1;">' + esc(info.idleText.replace('⏱ 已掛機 ', '⏱ ')) + '</span>';
      var cap = document.createElement('span');
      cap.className = 'afk-card-slotinfo';
      cap.innerHTML = html;
      card.appendChild(cap);
      placeCaption(card, cap);
    }
    watchGrid(grid);
  }

  var _watched = null;
  function watchGrid(grid) {
    if (_watched === grid || typeof MutationObserver !== 'function') return;
    _watched = grid;
    new MutationObserver(function () {
      grid.querySelectorAll('.afk-card-slotinfo').forEach(function (cap) { placeCaption(cap.parentNode, cap); });
    }).observe(grid, { childList: true, subtree: true });
  }
  function wrapRenderLoad() {
    if (typeof window.renderLoadSelect !== 'function' || window.renderLoadSelect.__afkSlotInfo) return false;
    var orig = window.renderLoadSelect;
    var wrapped = function () { orig.apply(this, arguments); try { decorateCards(); } catch (e) {} };
    wrapped.__afkSlotInfo = true;
    window.renderLoadSelect = wrapped;
    return true;
  }

  var okOld = wrapSlotSelect();      // 舊按鈕列 #slot-list(可能仍被某些流程用到)
  var okNew = wrapRenderLoad();      // 🆕 新卡片式選角：每張卡底部疊掛機資訊
  if (okOld || okNew) {
    console.log('[AFK-slotinfo] hooks OK — 選角畫面附加掛機地點/已掛機時間(舊列表' + (okOld ? '✓' : '✗') + ' / 新卡片' + (okNew ? '✓' : '✗') + ')。');
  } else {
    console.warn('[AFK-slotinfo] 找不到 openSlotSelect / renderLoadSelect,選角畫面掛機資訊停用。');
  }
})();
