/* ============================================================================
 * afk-mobile.js — 手機版介面外掛(底部導覽列版面)
 *
 * 設計:CSS 為主 + 少量 JS,完全不改原作者程式碼。
 *   - 不重建 DOM,只「辨識三欄(靠內容裡的穩定 id,比位置順序耐改版)」並加 class。
 *   - 把 #status-panel(HP/MP/金幣)移到最上方常駐;三欄一次只顯示一欄。
 *   - 注入底部導覽列:⚔️戰鬥 / ⚙️設定 / 🎒背包 / 📜日誌(日誌=底部浮動面板,可切戰鬥/系統、有✕關閉)。
 *   - 用 matchMedia 偵測手機;切回桌機自動還原,桌面版面 100% 不受影響。
 *   - 所有手機樣式都掛在 body.m-mobile 之下,JS 沒判定是手機就完全不生效。
 *
 * 掛接:在 index.html </body> 前加一行
 *   <script src="afk-mobile.js"></script>
 * ========================================================================== */
(function () {
  'use strict';

  var MQ = '(max-width: 768px)';

  function init() {
    var gs = document.getElementById('game-screen');
    if (!gs) { console.warn('[AFK-mobile] 找不到 #game-screen,手機版停用。'); return; }

    // --- 辨識三欄(用內容裡的穩定 id,而非位置順序)---------------------------
    function findCol(sel) {
      var kids = gs.children;
      for (var i = 0; i < kids.length; i++) {
        try { if (kids[i].querySelector && kids[i].querySelector(sel)) return kids[i]; } catch (e) {}
      }
      return null;
    }
    var colLeft   = findCol('#status-panel');
    var colCenter = findCol('#combat-log-panel') || findCol('#battle-view');
    var colRight  = findCol('#tab-stats') || findCol('.tab-bar');
    if (!colLeft || !colCenter || !colRight) {
      console.warn('[AFK-mobile] 三欄辨識失敗,手機版停用。', { left: !!colLeft, center: !!colCenter, right: !!colRight });
      return;
    }
    colLeft.classList.add('m-col-left');
    colCenter.classList.add('m-col-center');
    colRight.classList.add('m-col-right');

    trackAppHeight();      // 量真實可視高度寫進 --app-h,蓋掉不可靠的 100vh
    tagCreationPanel();    // 標記創角面板子層,給 CSS 改成手機直向堆疊
    injectCSS();
    var strip = buildStatusStrip();
    gs.insertBefore(strip, gs.firstChild);
    var statModal = buildStatModal();
    gs.appendChild(statModal);
    strip.addEventListener('click', openStatModal);   // 點整條狀態列 → 彈出桌面版角色資訊塊(內含改名)
    var nav = buildNav();
    gs.appendChild(nav);

    // 手機戰鬥畫面:在怪物(#battle-view)正下方插「手動喝水列」(桌機隱藏)
    //   每列 = [藥水圖示][數量][按鈕];背包有安特的水果時自動多出第二列(食用)。
    var battleView = document.getElementById('battle-view');
    var healBar = null;
    if (battleView && battleView.parentNode) {
      healBar = buildHealBar();
      battleView.parentNode.insertBefore(healBar, battleView.nextSibling);
    }
    function setHealRow(row, itemId, cnt, empty) {
      if (!row) return;
      var ic = row.querySelector('.m-heal-ic'), c = row.querySelector('.m-heal-cnt');
      if (ic && typeof getIconUrl === 'function' && typeof DB !== 'undefined' && DB.items[itemId]) {
        var url = getIconUrl(DB.items[itemId]);
        if (ic.getAttribute('src') !== url) ic.setAttribute('src', url);
      }
      if (c) c.textContent = '×' + cnt;
      row.classList.toggle('m-empty', !!empty);
    }
    function updateHealBar() {
      if (!healBar) return;
      var pot = pickHealPot();
      var sel = document.getElementById('set-pot');
      var dispId = pot ? pot.id : ((sel && sel.value) || 'potion_heal');   // 沒貨也顯示設定選的那種圖示(變灰)
      setHealRow(healBar.querySelector('.m-heal-pot'), dispId, pot ? (pot.cnt || 0) : 0, !pot);
      var fruit = (typeof player !== 'undefined' && player && player.inv) ? player.inv.find(function (x) { return x.id === 'new_item_141' && (x.cnt || 0) > 0; }) : null;
      var fruitRow = healBar.querySelector('.m-heal-fruit');
      if (fruitRow) { fruitRow.classList.toggle('m-show', !!fruit); if (fruit) setHealRow(fruitRow, 'new_item_141', fruit.cnt || 0, false); }
    }

    // 戰鬥日誌 / 系統日誌:手機上做成「底部浮動面板」(從導覽列開,浮在畫面上,不擠壓戰鬥畫面)
    var combatLog = document.getElementById('combat-log-panel');
    var sysPanel = (function () { var s = document.getElementById('sys-log'); return s && s.closest ? s.closest('.panel') : null; })();
    var logSheet = null;
    if (combatLog && sysPanel) {
      sysPanel.classList.add('m-syslog');
      logSheet = buildLogSheet();
      gs.appendChild(logSheet);
      decorateLogHeader(combatLog, 'sys');     // 戰鬥日誌標題列:⇆ 切到系統 / ✕ 關閉
      decorateLogHeader(sysPanel, 'combat');   // 系統日誌標題列:⇆ 切到戰鬥 / ✕ 關閉
    }
    var logBody = logSheet ? logSheet.querySelector('#m-log-body') : null;
    // 手機:把兩個日誌面板移進浮動面板;桌機:移回中欄原位(最後兩個子元素,順序還原)
    function logsIntoSheet() { if (logBody && combatLog && sysPanel) { logBody.appendChild(combatLog); logBody.appendChild(sysPanel); } }
    function logsToColumn() { if (combatLog) colCenter.appendChild(combatLog); if (sysPanel) colCenter.appendChild(sysPanel); }

    // 手機上拿掉「冒險地圖」標題文字(騰空間 + 控制項靠左不撐開);保留 status-alerts/siege-timer
    (function () {
      var mapSel = document.getElementById('map-select');
      var mapHdr = mapSel && mapSel.closest ? mapSel.closest('.panel-header') : null;
      if (!mapHdr) return;
      mapHdr.classList.add('m-maphdr');
      var sa = document.getElementById('status-alerts');
      var lbl = sa ? sa.parentNode : null;
      if (!lbl) return;
      Array.prototype.slice.call(lbl.childNodes).forEach(function (n) {
        if (n.nodeType === 3 && n.textContent.trim()) {   // 非空白文字節點 = 「冒險地圖」
          var w = document.createElement('span');
          w.className = 'm-maptitle';
          w.textContent = n.textContent;
          lbl.replaceChild(w, n);
        }
      });
    })();

    // 精簡狀態列:每 300ms 把遊戲的 Lv/HP/MP/金幣/EXP 鏡射到 #m-status(只讀 id,低耦合)
    var elName = strip.querySelector('#ms-name'),
        elLv = strip.querySelector('#ms-lv'), elHp = strip.querySelector('#ms-hp'),
        elMp = strip.querySelector('#ms-mp'), elGold = strip.querySelector('#ms-gold'),
        elHpBar = strip.querySelector('#ms-hp-bar'), elMpBar = strip.querySelector('#ms-mp-bar'),
        elExp = strip.querySelector('#ms-exp');
    function txt(id) { var e = document.getElementById(id); return e ? e.textContent.trim() : ''; }
    function barW(id) { var e = document.getElementById(id); return e && e.style.width ? e.style.width : '0%'; }
    function mirror() {
      if (!document.body.classList.contains('m-mobile')) return;
      // 暱稱(st-class);沒取名就退回職業(st-classname),都沒有才 '--'
      if (elName) elName.textContent = txt('st-class') || txt('st-classname') || '--';
      if (elLv) elLv.textContent = txt('st-lv') || '--';
      if (elHp) elHp.textContent = txt('txt-hp') || '--';
      if (elMp) elMp.textContent = txt('txt-mp') || '--';
      if (elHpBar) elHpBar.style.width = barW('bar-hp');   // 跟原版血條同步寬度(讀遊戲自己算好的 %)
      if (elMpBar) elMpBar.style.width = barW('bar-mp');
      if (elGold) elGold.textContent = txt('st-gold') || '--';
      var be = document.getElementById('bar-exp');
      if (elExp && be) elExp.style.width = be.style.width || '0%';
      // 手動喝水列:在村莊隱藏(本來就自動回滿)、更新圖示/數量/安特的水果列
      var townView = document.getElementById('town-view');
      document.body.classList.toggle('m-intown', !!(townView && !townView.classList.contains('hidden')));
      updateHealBar();
      // 村莊時遊戲會給 combat-log-panel 加 hidden(沒有戰鬥日誌):強制切系統日誌、隱藏「切到戰鬥」鈕
      var noCombat = !combatLog || combatLog.classList.contains('hidden');
      document.body.classList.toggle('mlog-nocombat', noCombat);
      if (noCombat && document.body.classList.contains('mlog-combat')) setLog('sys');
    }
    setInterval(mirror, 300);

    var mql = window.matchMedia(MQ);

    function setView(v) {
      document.body.classList.remove('mview-battle', 'mview-config', 'mview-bag');
      document.body.classList.add('mview-' + v);
      var kids = nav.children;
      for (var i = 0; i < kids.length; i++) {
        kids[i].classList.toggle('m-active', kids[i].getAttribute('data-v') === v);
      }
      closeLog();   // 切換下方選單時一併關閉浮動日誌
    }

    function setLog(v) {
      document.body.classList.remove('mlog-combat', 'mlog-sys');
      document.body.classList.add('mlog-' + v);
    }
    function updateLogNavActive(on) { var b = nav.querySelector('[data-nav="log"]'); if (b) b.classList.toggle('m-active', !!on); }
    function openLog() { document.body.classList.add('mlog-open'); updateLogNavActive(true); }
    function closeLog() { document.body.classList.remove('mlog-open'); updateLogNavActive(false); }
    function toggleLog() { if (document.body.classList.contains('mlog-open')) closeLog(); else openLog(); }

    function apply(on) {
      if (on) {
        document.body.classList.add('m-mobile');
        logsIntoSheet();
        if (!/mview-(battle|config|bag)/.test(document.body.className)) setView('battle');
        if (!/mlog-(combat|sys)/.test(document.body.className)) setLog('combat');
        mirror();
      } else {
        document.body.classList.remove('m-mobile');
        document.body.classList.remove('mlog-open');
        logsToColumn();
      }
    }

    apply(mql.matches);
    if (mql.addEventListener) mql.addEventListener('change', function (e) { apply(e.matches); });
    else if (mql.addListener) mql.addListener(function (e) { apply(e.matches); });

    window.__afkm = { version: '1.0.0', apply: apply, setView: setView, setLog: setLog, openLog: openLog, closeLog: closeLog, toggleLog: toggleLog, isMobile: function () { return mql.matches; } };
    console.log('[AFK-mobile] hooks OK — 手機版面已啟用(目前:' + (mql.matches ? '手機' : '桌機') + ')。');

    // --- 精簡一行式狀態列 --------------------------------------------------
    function buildStatusStrip() {
      var d = document.createElement('div');
      d.id = 'm-status';
      d.innerHTML =
        // 第一列:暱稱 / 等級 / 金幣 / 點我提示
        '<div class="ms-row ms-row1">' +
          '<span class="ms-seg ms-name"><b id="ms-name">--</b></span>' +
          '<span class="ms-seg ms-lv">Lv <b id="ms-lv">--</b></span>' +
          '<span class="ms-seg ms-gold">💰 <span id="ms-gold">--</span></span>' +
          '<span class="ms-seg ms-info">ⓘ</span>' +    // 提示:整條可點 → 開角色資訊彈窗
        '</div>' +
        // 第二列:HP / MP 雙血條(仿原版:底條 + 填色 + 數字疊在上面)
        '<div class="ms-row ms-row2">' +
          '<div class="ms-bar ms-hp"><i class="ms-bar-fill" id="ms-hp-bar"></i><span class="ms-bar-txt"><b>HP</b> <span id="ms-hp">--</span></span></div>' +
          '<div class="ms-bar ms-mp"><i class="ms-bar-fill" id="ms-mp-bar"></i><span class="ms-bar-txt"><b>MP</b> <span id="ms-mp">--</span></span></div>' +
        '</div>' +
        '<div id="ms-exp"></div>';
      return d;
    }

    // --- 底部導覽列(第 4 顆「日誌」切換浮動面板)----------------------------
    function buildNav() {
      var n = document.createElement('div');
      n.id = 'm-nav';
      [['battle', '⚔️', '戰鬥', 'view'], ['config', '⚙️', '設定', 'view'], ['bag', '🎒', '背包', 'view'], ['log', '📜', '日誌', 'log'], ['logout', '🚪', '登出', 'logout']].forEach(function (it) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('data-nav', it[0]);
        b.innerHTML = '<span style="font-size:20px;line-height:1">' + it[1] + '</span><span style="font-size:11px;line-height:1.2">' + it[2] + '</span>';
        if (it[3] === 'view') { b.setAttribute('data-v', it[0]); b.addEventListener('click', function () { setView(it[0]); }); }
        else if (it[3] === 'logout') { b.addEventListener('click', doLogout); }
        else { b.addEventListener('click', function () { toggleLog(); }); }
        n.appendChild(b);
      });
      return n;
    }

    // --- 底部浮動日誌面板(只有內容容器;切換/關閉做成小鈕注入原本的 panel 標題列)------
    function buildLogSheet() {
      var sheet = document.createElement('div');
      sheet.id = 'm-log-sheet';
      var body = document.createElement('div');
      body.id = 'm-log-body';
      sheet.appendChild(body);
      return sheet;
    }

    // 把「⇆ 切換 / ✕ 關閉」兩顆小鈕注入原本的日誌標題列(整合進原列,不再另開一排)。
    // otherType:點 ⇆ 要切到的另一種日誌(看戰鬥就切系統,反之亦然)。
    function decorateLogHeader(panel, otherType) {
      var hdr = panel.querySelector('.panel-header');
      if (!hdr || hdr.querySelector('.m-log-ctrls')) return;
      hdr.classList.add('m-log-hdr');
      var ctrls = document.createElement('span');
      ctrls.className = 'm-log-ctrls';
      var sw = document.createElement('button');
      sw.type = 'button'; sw.className = 'm-log-sw'; sw.textContent = '⇆'; sw.title = '切換戰鬥/系統日誌';
      // 村莊(mlog-nocombat)時戰鬥日誌不存在 → 不給切
      sw.addEventListener('click', function (e) { e.stopPropagation(); if (document.body.classList.contains('mlog-nocombat')) return; setLog(otherType); });
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'm-log-x'; x.textContent = '✕'; x.title = '關閉';
      x.addEventListener('click', function (e) { e.stopPropagation(); closeLog(); });
      ctrls.appendChild(sw); ctrls.appendChild(x);
      hdr.appendChild(ctrls);
    }
  }

  // --- 角色資訊彈窗:桌面左上的 #status-panel(等級/AC/MR/金幣/HP·MP·EXP + 可點改名的職業列)
  //   在手機被隱藏 → 點暱稱把它「移進」彈窗顯示(移動而非複製,資料才會即時更新);✕/點背景關閉、移回原欄。
  //   名字仍可在彈窗內點 st-class 用遊戲原生 startEditName 修改,不另作取名 UI。
  function buildStatModal() {
    var m = document.createElement('div');
    m.id = 'm-stat-modal';
    var card = document.createElement('div');
    card.id = 'm-stat-card';
    var bar = document.createElement('div');
    bar.id = 'm-stat-bar';
    var x = document.createElement('button');
    x.type = 'button'; x.id = 'm-stat-close'; x.textContent = '✕'; x.title = '關閉';
    x.addEventListener('click', function (e) { e.stopPropagation(); closeStatModal(); });
    bar.appendChild(x);
    var body = document.createElement('div');
    body.id = 'm-stat-body';
    card.appendChild(bar); card.appendChild(body);
    m.appendChild(card);
    m.addEventListener('click', function () { closeStatModal(); });           // 點背景關閉
    card.addEventListener('click', function (e) { e.stopPropagation(); });     // 點卡片內不關
    return m;
  }
  function openStatModal() {
    var sp = document.getElementById('status-panel');
    var body = document.getElementById('m-stat-body');
    if (!sp || !body) return;
    body.appendChild(sp);                          // 把資訊塊移進彈窗
    document.body.classList.add('m-stat-open');
  }
  function closeStatModal() {
    document.body.classList.remove('m-stat-open');
    var sp = document.getElementById('status-panel');
    var col = document.querySelector('.m-col-left');   // 左欄(init 給它加了 m-col-left);此函式在 IIFE 層拿不到 init 的 colLeft
    if (sp && col) col.insertBefore(sp, col.firstChild);   // 移回左欄原位(手機仍隱藏)
  }

  // --- 登出回首頁:跳「自製」確認視窗(不用原生 confirm:iOS Safari 會抑制原生彈窗導致按了沒反應) ---
  //   按確定 → 先存檔(補上原作每 5 分一次自動存檔的空窗,登出無損)、再記離線錨點(時間+當前狩獵地圖,手機 beforeunload 常不觸發,故主動 stamp),最後 reload 回首頁。
  function doLogout() {
    var m = document.getElementById('m-logout-modal') || buildLogoutModal();
    m.classList.add('open');
  }
  function buildLogoutModal() {
    var m = document.createElement('div');
    m.id = 'm-logout-modal';
    m.innerHTML =
      '<div id="m-logout-card">' +
        '<div id="m-logout-msg">回首頁前會<b>自動幫你存檔</b>，進度不會遺失。<br>登出後會開始離線掛機（上限 24 小時）。<br>確定回首頁？</div>' +
        '<div id="m-logout-btns">' +
          '<button id="m-logout-cancel" type="button">取消</button>' +
          '<button id="m-logout-ok" type="button">確定回首頁</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    function close() { m.classList.remove('open'); }
    m.addEventListener('click', function (e) { if (e.target === m) close(); });   // 點背景關閉
    m.querySelector('#m-logout-cancel').addEventListener('click', close);
    m.querySelector('#m-logout-ok').addEventListener('click', function () {
      try { if (typeof window.saveGame === 'function') window.saveGame(); } catch (e) {}   // 先存當前進度,避免漏掉上次自動存檔後的收益
      try { if (window.__afk && window.__afk.stamp) window.__afk.stamp(); } catch (e) {}   // 存完再蓋錨點 → 存檔時間=離線起算時間,離線結算不會漏算/重算
      try { location.reload(); } catch (e) {}
    });
    return m;
  }

  // --- 手機戰鬥畫面:怪物下方的「手動喝水列」 -------------------------------
  //   每列排版:[藥水圖示][數量][按鈕]。藥水列喝設定裡選的治癒藥水(set-pot:紅/橙/白),
  //   沒貨依紅→橙→白往下找;背包有安特的水果時自動多一列(食用)。
  //   全走遊戲原生 useItem(uid, false) → 由它處理回血/消耗/CD/UI 刷新(手動=寫日誌、吃 1 秒共用冷卻)。
  function buildHealBar() {
    var bar = document.createElement('div');
    bar.id = 'm-heal-bar';
    bar.appendChild(makeHealRow('pot'));
    bar.appendChild(makeHealRow('fruit'));
    return bar;
  }
  function makeHealRow(kind) {
    var row = document.createElement('div');
    row.className = 'm-heal-row m-heal-' + kind;
    var img = document.createElement('img');
    img.className = 'm-heal-ic'; img.alt = '';
    var cnt = document.createElement('span');
    cnt.className = 'm-heal-cnt';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'm-heal-go' + (kind === 'fruit' ? ' m-fruit-go' : '');
    btn.textContent = kind === 'fruit' ? '食用' : '喝水';
    btn.addEventListener('click', kind === 'fruit' ? eatFruit : manualDrink);
    row.appendChild(img); row.appendChild(cnt); row.appendChild(btn);
    return row;
  }
  // 找出「這次手動喝水實際會喝的那瓶」:優先設定選的,其次紅→橙→白,都沒貨回 null。
  function pickHealPot() {
    if (typeof player === 'undefined' || !player || !player.inv) return null;
    var sel = document.getElementById('set-pot');
    var ids = [];
    if (sel && sel.value) ids.push(sel.value);
    ['potion_heal', 'potion_strong', 'potion_ult'].forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
    for (var i = 0; i < ids.length; i++) {
      var it = player.inv.find(function (x) { return x.id === ids[i]; });
      if (it && (it.cnt || 0) > 0) return it;
    }
    return null;
  }
  function manualDrink() {
    if (typeof useItem !== 'function') return;
    var pot = pickHealPot();
    if (!pot) { if (typeof logSys === 'function') logSys('沒有可用的治癒藥水。'); return; }
    useItem(pot.uid, false);   // false=手動:回血+消耗+寫日誌,並受 player.cds.pot(1 秒)限制
  }
  function eatFruit() {
    if (typeof useItem !== 'function') return;
    var f = (typeof player !== 'undefined' && player && player.inv) ? player.inv.find(function (x) { return x.id === 'new_item_141' && (x.cnt || 0) > 0; }) : null;
    if (!f) { if (typeof logSys === 'function') logSys('沒有安特的水果。'); return; }
    useItem(f.uid, false);   // 安特的水果:恢復 44~107 HP,同樣吃 1 秒共用冷卻
  }

  // --- 創角面板手機化:原作是 flex-row + 一堆固定寬高,手機會爆寬。標記關鍵子層讓 CSS 改直向堆疊 ---
  function tagCreationPanel() {
    var cp = document.getElementById('creation-panel');
    if (!cp) return;
    if (cp.children[0]) cp.children[0].classList.add('m-cre-avatar');     // 立繪框
    var right = cp.children[1];
    if (right) {
      right.classList.add('m-cre-right');                                // 右側(職業/能力 + 按鈕)
      var row = right.children[0];
      if (row) {
        row.classList.add('m-cre-row');                                  // 職業欄 + 能力欄(原並排)
        if (row.children[0]) row.children[0].classList.add('m-cre-classbox');
      }
    }
  }

  // --- 把「實際可視高度」(已扣掉手機瀏覽器上下工具列)寫進 --app-h --------------
  //   100vh 在手機是「工具列收起時」的高度,比當下可視區高 → 底部 nav 被頂到工具列底下看不到。
  //   優先用 visualViewport.height:它是「真正看得到的那塊」高度,會扣掉像 Brave 那種
  //   常駐在內容上的底部工具列,比 innerHeight / 100dvh 都可靠;不支援時退回 innerHeight。
  //   刻意不開 viewport-fit=cover:開了畫面會畫到系統列底下,高度變成全螢幕、nav 反而又被
  //   工具列蓋住,頂部還會多一塊留白。維持預設讓瀏覽器自動避開系統列。
  function trackAppHeight() {
    var vv = window.visualViewport;
    function set() {
      var h = (vv && vv.height) ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty('--app-h', Math.round(h) + 'px');
    }
    set();
    window.addEventListener('resize', set);
    window.addEventListener('orientationchange', function () { setTimeout(set, 250); });
    if (vv) vv.addEventListener('resize', set);
  }

  // --- 注入手機版 CSS(全部掛在 body.m-mobile 之下)--------------------------
  function injectCSS() {
    if (document.getElementById('m-style')) return;
    var css = [
      '#m-nav{display:none;}',

      'body.m-mobile{padding:0 !important;}',
      /* game-screen 用 fixed 釘在左上角:脫離原作者 body 的 flex 置中流,
         避免它比 body 矮時被垂直置中(→ 上方空白、底部 nav 被工具列遮住)。
         只動 game-screen,不動 body 對齊 → 開始選單/創角畫面照樣置中。
         不下 z-index(fixed 配 z-index:auto 不建立 stacking context,內部 modal 行為不變)。 */
      'body.m-mobile #game-screen{position:fixed !important;top:0 !important;left:0 !important;flex-direction:column !important;gap:0 !important;max-width:none !important;width:100vw !important;height:100vh !important;height:100dvh !important;height:var(--app-h,100dvh) !important;margin:0 !important;padding:0 !important;}',

      /* 精簡一行式狀態列(取代原本佔 1/3 高的大面板;原面板在手機隱藏) */
      '#m-status{display:none;}',
      'body.m-mobile #status-panel{display:none !important;}',
      'body.m-mobile #m-status{display:flex !important;flex-direction:column;flex:0 0 auto !important;gap:6px;padding:7px 12px 9px;position:relative;background:#0f172a;border-bottom:1px solid #334155;font-size:13px;color:#e2e8f0;line-height:1.2;cursor:pointer;}',
      'body.m-mobile #m-status:active{background:#16233c;}',
      /* 第一列:暱稱 / 等級 / 金幣 / ⓘ */
      'body.m-mobile #m-status .ms-row{display:flex;align-items:center;}',
      'body.m-mobile #m-status .ms-row1{gap:14px;}',
      'body.m-mobile #m-status .ms-seg{white-space:nowrap;}',
      'body.m-mobile #m-status .ms-name #ms-name{display:inline-block;max-width:46vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom;color:#fff;font-weight:bold;font-size:14px;}',
      'body.m-mobile #m-status .ms-info{margin-left:auto;color:#94a3b8;font-size:13px;}',
      'body.m-mobile #m-status #ms-lv{color:#fff;font-size:15px;}',
      'body.m-mobile #m-status .ms-gold{color:#fbbf24;font-weight:bold;}',
      /* 第二列:HP / MP 雙血條(底條 + 填色 + 數字疊上,仿原版) */
      'body.m-mobile #m-status .ms-row2{gap:8px;}',
      'body.m-mobile #m-status .ms-bar{position:relative;flex:1 1 0;min-width:0;height:20px;border-radius:5px;overflow:hidden;background:#1e293b;border:1px solid #334155;}',
      'body.m-mobile #m-status .ms-bar-fill{position:absolute;left:0;top:0;bottom:0;width:0%;transition:width .25s;}',
      'body.m-mobile #m-status .ms-hp .ms-bar-fill{background:#dc2626;}',
      'body.m-mobile #m-status .ms-mp .ms-bar-fill{background:#2563eb;}',
      'body.m-mobile #m-status .ms-bar-txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:5px;font-size:12px;color:#fff;font-weight:bold;text-shadow:0 1px 2px rgba(0,0,0,.75);}',
      'body.m-mobile #m-status .ms-bar-txt b{font-weight:bold;}',
      'body.m-mobile #m-status .ms-hp .ms-bar-txt b{color:#fecaca;}',
      'body.m-mobile #m-status .ms-mp .ms-bar-txt b{color:#bfdbfe;}',
      'body.m-mobile #m-status #ms-exp{position:absolute;left:0;bottom:0;height:3px;width:0%;background:#eab308;transition:width .25s;}',

      /* 手機戰鬥畫面:怪物下方的手動喝水列(桌機與非戰鬥/村莊一律隱藏)。每列=[圖示][數量][按鈕] */
      '#m-heal-bar{display:none;}',
      'body.m-mobile.mview-battle #m-heal-bar{display:flex;flex-direction:column;gap:8px;flex:0 0 auto;margin:10px 12px 2px;}',
      'body.m-mobile #m-heal-bar .m-heal-row{display:flex;align-items:center;gap:10px;}',
      'body.m-mobile #m-heal-bar .m-heal-fruit{display:none;}',                /* 沒有安特的水果就不顯示這列 */
      'body.m-mobile #m-heal-bar .m-heal-fruit.m-show{display:flex;}',
      'body.m-mobile #m-heal-bar .m-heal-ic{width:36px;height:36px;flex:0 0 auto;border-radius:7px;background:#1e293b;border:1px solid #334155;object-fit:contain;padding:2px;}',
      'body.m-mobile #m-heal-bar .m-heal-cnt{flex:0 0 auto;min-width:44px;color:#e2e8f0;font-size:15px;font-weight:bold;}',
      'body.m-mobile #m-heal-bar .m-heal-go{flex:1 1 auto;padding:13px;border-radius:10px;color:#fff;font-size:16px;font-weight:bold;font-family:inherit;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4);border:1px solid #ef4444;background:linear-gradient(#dc2626,#b91c1c);}',
      'body.m-mobile #m-heal-bar .m-heal-go:active{filter:brightness(.85);transform:translateY(1px);}',
      'body.m-mobile #m-heal-bar .m-fruit-go{border-color:#22c55e;background:linear-gradient(#16a34a,#15803d);}',   /* 安特的水果列用綠色區分 */
      'body.m-mobile #m-heal-bar .m-heal-row.m-empty .m-heal-ic,body.m-mobile #m-heal-bar .m-heal-row.m-empty .m-heal-cnt,body.m-mobile #m-heal-bar .m-heal-row.m-empty .m-heal-go{filter:grayscale(.65);opacity:.5;}',
      'body.m-mobile.m-intown #m-heal-bar{display:none !important;}',

      /* 三欄:滿寬,一次只顯示一欄,內部自行捲動 */
      'body.m-mobile .m-col-left,body.m-mobile .m-col-center,body.m-mobile .m-col-right{width:100% !important;max-width:none !important;flex:1 1 auto !important;min-height:0 !important;gap:8px !important;overflow:hidden;}',
      'body.m-mobile .m-col-left,body.m-mobile .m-col-center,body.m-mobile .m-col-right{display:none !important;}',
      'body.m-mobile.mview-battle .m-col-center{display:flex !important;}',
      'body.m-mobile.mview-config .m-col-left{display:flex !important;}',
      'body.m-mobile.mview-bag .m-col-right{display:flex !important;}',

      /* 底部導覽列 */
      'body.m-mobile #m-nav{display:flex !important;flex:0 0 auto !important;height:56px;background:#0f172a;border-top:1px solid #334155;}',
      'body.m-mobile #m-nav button{flex:1;background:transparent;border:none;color:#94a3b8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;font-family:inherit;}',
      'body.m-mobile #m-nav button.m-active{color:#fcd34d;background:#1e293b;}',
      'body.m-mobile #m-nav button:active{background:#334155;}',

      /* 戰鬥/系統日誌:底部浮動面板。切換/關閉做成 ⇆/✕ 兩顆小鈕注入原本標題列,不再另開一排。
         原標題列半透明(讓血條透出),日誌內文(.log-bg 自帶深色底)維持不透明保持可讀。 */
      '#m-log-sheet{display:none;}',
      'body.m-mobile #m-log-sheet{display:none;position:fixed;left:0;right:0;bottom:calc(56px + env(safe-area-inset-bottom,0px));height:45dvh;height:45vh;z-index:50;flex-direction:column;background:transparent;border-top:2px solid #475569;box-shadow:0 -12px 34px rgba(0,0,0,.6);}',
      'body.m-mobile.mlog-open #m-log-sheet{display:flex !important;}',
      'body.m-mobile #m-log-body{flex:1 1 auto;min-height:0;display:flex;overflow:hidden;background:transparent;}',
      'body.m-mobile #m-log-body #combat-log-panel,body.m-mobile #m-log-body .m-syslog{flex:1 1 auto !important;width:100%;height:auto !important;min-height:0 !important;margin:0 !important;border-radius:0 !important;background:transparent !important;border:none !important;box-shadow:none !important;}',
      /* 原標題列:半透明 + 模糊(血條透出),右側留位放控制鈕 */
      'body.m-mobile #m-log-body .panel-header.m-log-hdr{position:relative;background:rgba(15,23,42,0.45) !important;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);padding-right:86px !important;}',
      '.m-log-ctrls{display:none;}',
      'body.m-mobile #m-log-body .panel-header.m-log-hdr .m-log-ctrls{display:flex;position:absolute;right:6px;top:50%;transform:translateY(-50%);gap:6px;}',
      'body.m-mobile .m-log-ctrls button{width:34px;height:30px;border:1px solid rgba(51,65,85,0.85);background:rgba(30,41,59,0.7);color:#e2e8f0;border-radius:7px;font-size:15px;line-height:1;cursor:pointer;font-family:inherit;padding:0;}',
      'body.m-mobile .m-log-ctrls button:active{background:rgba(71,85,105,0.9);}',
      /* 村莊:沒有戰鬥日誌可切 → 藏起「⇆ 切換」鈕(只剩 ✕ 關閉) */
      'body.m-mobile.mlog-nocombat .m-log-sw{display:none !important;}',
      'body.m-mobile.mlog-sys #m-log-body #combat-log-panel{display:none !important;}',
      'body.m-mobile.mlog-combat #m-log-body .m-syslog{display:none !important;}',

      /* 地圖標題列:手機隱藏「冒險地圖」文字,控制項靠左不撐開 */
      'body.m-mobile .m-maptitle{display:none !important;}',
      'body.m-mobile .m-maphdr{justify-content:flex-start !important;gap:6px !important;flex-wrap:wrap !important;}',

      /* 細節:縮一點字與間距讓內容更好塞 */
      'body.m-mobile #game-screen .panel-header{padding-top:6px !important;padding-bottom:6px !important;}',

      /* 物品操作 Modal:手機上比較面板+主面板改「上下堆疊」並限寬,避免並排爆出畫面 */
      'body.m-mobile #item-modal{flex-direction:column !important;align-items:stretch !important;width:94vw !important;max-width:94vw !important;max-height:90dvh !important;max-height:90vh !important;overflow-y:auto !important;gap:8px !important;z-index:70 !important;}',
      'body.m-mobile #item-modal > div{min-width:0 !important;max-width:100% !important;width:100% !important;flex:0 0 auto !important;}',
      'body.m-mobile #item-modal #modal-compare{max-width:100% !important;max-height:42vh !important;}',

      /* 登出確認視窗(自製,取代原生 confirm:iOS 會抑制原生彈窗) */
      '#m-logout-modal{display:none;position:fixed;inset:0;z-index:90;background:rgba(2,6,23,0.7);align-items:center;justify-content:center;padding:24px;}',
      '#m-logout-modal.open{display:flex;}',
      '#m-logout-card{width:min(360px,92vw);background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.6);}',
      '#m-logout-msg{color:#e2e8f0;font-size:15px;line-height:1.7;text-align:center;margin-bottom:18px;}',
      '#m-logout-btns{display:flex;gap:10px;}',
      '#m-logout-btns button{flex:1;padding:11px;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer;font-family:inherit;border:1px solid #334155;}',
      '#m-logout-cancel{background:#1e293b;color:#cbd5e1;}',
      '#m-logout-cancel:active{background:#334155;}',
      '#m-logout-ok{background:#b45309;color:#fff;border-color:#d97706;}',
      '#m-logout-ok:active{background:#92400e;}',

      /* 角色資訊彈窗:點暱稱叫出桌面版 #status-panel(手機平時隱藏);✕/點背景關閉 */
      '#m-stat-modal{display:none;}',
      'body.m-mobile.m-stat-open #m-stat-modal{display:flex;position:fixed;inset:0;z-index:80;align-items:center;justify-content:center;background:rgba(2,6,23,0.72);padding:16px;}',
      'body.m-mobile #m-stat-card{position:relative;width:min(92vw,420px);max-height:84vh;max-height:calc(var(--app-h,84vh) - 32px);overflow-y:auto;}',
      'body.m-mobile #m-stat-bar{display:flex;justify-content:flex-end;margin-bottom:6px;}',
      'body.m-mobile #m-stat-close{width:36px;height:36px;border:1px solid rgba(51,65,85,0.85);background:rgba(30,41,59,0.92);color:#e2e8f0;border-radius:8px;font-size:17px;cursor:pointer;font-family:inherit;}',
      'body.m-mobile #m-stat-close:active{background:rgba(71,85,105,0.92);}',
      'body.m-mobile #m-stat-body{width:100%;}',
      'body.m-mobile #m-stat-body #status-panel{display:flex !important;width:100% !important;margin:0 !important;}',

      /* NPC 互動列(商店/製作 等共用同款 .list-item):手機窄寬下名稱用了 truncate 但文字容器沒 min-w-0,
         名稱會整行溢出壓到右側的數量框/製作鈕(看不清買/做什麼)。粗粒度修法:讓文字容器可縮、名稱改換行、
         數量框縮窄、間距縮小。scope 在穩定的 #interaction-content .list-item → 商店+製作+同款 NPC 一次涵蓋;
         作者若重排,規則失效即回原樣(不會壞)。 */
      'body.m-mobile #interaction-content .list-item{flex-wrap:wrap !important;gap:8px;}',   /* 控制區太寬(如製作含兩顆鈕)時整塊換到第二行,資訊區就有整行空間 */
      'body.m-mobile #interaction-content .list-item > div:first-child{min-width:45% !important;gap:8px !important;}',   /* 資訊區保底 45%:商店(控制窄)維持一行;製作(控制寬)放不下→控制整塊換行 */
      'body.m-mobile #interaction-content .list-item > div:first-child > div{min-width:0 !important;}',
      'body.m-mobile #interaction-content .list-item > div:first-child span{white-space:normal !important;overflow-wrap:break-word;}',
      'body.m-mobile #interaction-content .list-item input{width:44px !important;}',
      'body.m-mobile #interaction-content .list-item > div:last-child{gap:6px !important;flex-wrap:wrap;justify-content:flex-end;margin-left:auto;}',

      /* 潘朵拉黑市卡片:原作用「左圖固定 112px + 右購買鈕固定 84px」的橫向列(行內 height:120px),
         手機窄寬下中間名稱/說明/價格欄被擠到只剩約 20px → 文字一字一行整個糊掉。改成直向堆疊:
         圖示置中、資訊欄取消固定高度與 truncate 正常換行、購買鈕整條寬。scope 在卡片唯一的 .max-w-xl,
         作者若重排此卡規則自動失效(不會壞);桌機(無 m-mobile)完全不受影響。 */
      'body.m-mobile #interaction-content .max-w-xl .items-stretch{flex-direction:column !important;height:auto !important;align-items:center !important;gap:10px !important;}',
      'body.m-mobile #interaction-content .max-w-xl .items-stretch > div{width:100% !important;height:auto !important;}',
      'body.m-mobile #interaction-content .max-w-xl .items-stretch > div:first-child{width:96px !important;height:96px !important;align-self:center !important;}',   /* 圖示框維持方形、置中 */
      'body.m-mobile #interaction-content .max-w-xl .items-stretch > div:nth-child(2){height:auto !important;text-align:center !important;}',
      'body.m-mobile #interaction-content .max-w-xl .items-stretch > div:nth-child(2) .truncate{white-space:normal !important;overflow:visible !important;}',   /* 名稱/價格不再被 truncate 切掉 */
      'body.m-mobile #interaction-content .max-w-xl .items-stretch > div:nth-child(2) .overflow-y-auto{overflow:visible !important;max-height:none !important;}',   /* 說明欄不限高、整段顯示 */
      'body.m-mobile #interaction-content .max-w-xl .items-stretch > div:last-child button{width:100% !important;height:auto !important;flex-direction:row !important;gap:8px !important;padding:11px !important;}',   /* 購買鈕整條寬、圖示+字並排 */

      /* 創角畫面手機化:外框釘在頂端、用可視高度(--app-h)當上限,避免 94vh 延伸到 Brave 底部
         工具列後面把「開始冒險」鈕蓋住;內層原本 flex-row + 固定寬高(會爆寬)→ 全改直向堆疊、滿版 */
      'body.m-mobile #creation-screen{position:fixed !important;top:0 !important;left:50% !important;transform:translateX(-50%) !important;margin:0 !important;width:96vw !important;max-width:96vw !important;height:auto !important;max-height:var(--app-h,94vh) !important;overflow-y:auto !important;padding:16px 16px 28px !important;}',
      'body.m-mobile #creation-panel{flex-direction:column !important;gap:12px !important;align-items:stretch !important;}',
      'body.m-mobile .m-cre-avatar{width:100% !important;height:220px !important;}',
      'body.m-mobile .m-cre-right{width:100% !important;height:auto !important;}',
      'body.m-mobile .m-cre-row{flex-direction:column !important;height:auto !important;gap:12px !important;}',
      'body.m-mobile .m-cre-classbox{width:100% !important;height:auto !important;}',
      'body.m-mobile #stat-allocation{width:100% !important;height:auto !important;}',
      'body.m-mobile #class-desc{max-height:110px !important;flex:0 0 auto !important;}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = 'm-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
