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
    initTipPeek();   // 手機「長按物品看詳情」(取代桌機 hover tooltip)
    initWhQty();     // 手機倉庫存/取數量:自製視窗取代原生 prompt(iOS 連點會被抑制)

    // 手機:點「回村/回城」後自動收起日誌浮層。日誌展開時會蓋住村莊的 NPC/商店/倉庫,否則每次回村都要先手動關一次。
    //   回村兩顆鈕(桌機 #btn-return-town、手機 #mv-action-btn)都指向全域 returnToTown,包它最省。
    //   只在「地圖真的有換」時關(被石化/暈眩擋住而沒回成的情況 mapState 不變 → 不關,也不會吃掉那則提示)。
    if (typeof window.returnToTown === 'function' && !window.returnToTown.__afkWrapped) {
      var _returnToTown = window.returnToTown;
      window.returnToTown = function () {
        var before = (typeof mapState !== 'undefined' && mapState) ? mapState.current : null;
        var r = _returnToTown.apply(this, arguments);
        try {
          var after = (typeof mapState !== 'undefined' && mapState) ? mapState.current : null;
          if (after && after !== before && document.body.classList.contains('m-mobile')) closeLog();
        } catch (e) {}
        return r;
      };
      window.returnToTown.__afkWrapped = true;
    }

    // 手機戰鬥畫面:在怪物(#battle-view)正下方插「手動喝水列」(桌機隱藏)
    //   每列 = [藥水圖示][數量][按鈕];背包有安特的水果時自動多出第二列(食用)。
    var battleView = document.getElementById('battle-view');
    var healBar = null;
    if (battleView && battleView.parentNode) {
      healBar = buildHealBar();
      battleView.parentNode.insertBefore(healBar, battleView.nextSibling);
    }

    // 喝水列下方:鏡射「背包→技能」裡 type:manual 的主動施放技能(傳送/能量感測/迷魅/絕對屏障)成快捷鈕,
    //   點擊直接走遊戲原生 manualCast(skId) → 由它把關等級/冷卻/MP/目標等所有條件(與背包面板的施放鈕同一支)。
    var skillBar = null;
    if (healBar && healBar.parentNode) {
      skillBar = document.createElement('div');
      skillBar.id = 'm-skill-bar';
      healBar.parentNode.insertBefore(skillBar, healBar.nextSibling);
    }

    // 戰鬥畫面技能列下方:即時鏡射「背包→能力→狀態」(#dt-buffs:增益/減益)一份,
    //   讓戰鬥中不用切分頁也看得到當前狀態。內容由 mirror() 每 300ms 從 #dt-buffs 複製 innerHTML。
    var battleBuffs = null;
    var _buffAfter = skillBar || healBar;
    if (_buffAfter && _buffAfter.parentNode) {
      battleBuffs = document.createElement('div');
      battleBuffs.id = 'm-battle-buffs';
      _buffAfter.parentNode.insertBefore(battleBuffs, _buffAfter.nextSibling);
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
      // 左側兩個卷軸勾選:回填設定面板的當前值(從設定面板或讀檔改動時跟著動)
      var cbs = healBar.querySelectorAll('.m-scroll-cb');
      for (var i = 0; i < cbs.length; i++) {
        var t = document.getElementById(cbs[i].getAttribute('data-target'));
        if (t && cbs[i].checked !== t.checked) cbs[i].checked = t.checked;
      }
    }
    // 主動施放技能快捷鈕:只在「已學的 type:manual 技能」集合變動時重建按鈕(避免每 300ms 重畫);
    //   每次都更新「冷卻中／MP 不足」的灰階提示(純視覺,實際限制仍由 manualCast 把關)。
    var _skillSig = '';
    function syncSkillBar() {
      if (!skillBar) return;
      if (typeof player === 'undefined' || !player || !player.skills || typeof DB === 'undefined') { skillBar.classList.remove('m-has'); return; }
      var manual = player.skills.filter(function (id) { return DB.skills[id] && DB.skills[id].type === 'manual'; });
      manual.sort(function (a, b) { return (DB.skills[a].tier || 0) - (DB.skills[b].tier || 0); });   // 與背包-技能面板同序
      var sig = manual.join(',');
      if (sig !== _skillSig) {
        _skillSig = sig;
        skillBar.innerHTML = '';
        manual.forEach(function (id) {
          var sk = DB.skills[id];
          var btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'm-skill-go'; btn.setAttribute('data-sk', id);
          var img = document.createElement('img'); img.className = 'm-skill-ic'; img.alt = '';
          if (typeof getIconUrl === 'function') { var u = getIconUrl(sk, true); if (u) img.setAttribute('src', u); }
          img.onerror = function () { this.style.display = 'none'; };
          var name = document.createElement('span'); name.className = 'm-skill-n'; name.textContent = sk.n;
          btn.appendChild(img); btn.appendChild(name);
          btn.addEventListener('click', function () { if (typeof manualCast === 'function') manualCast(id); });
          skillBar.appendChild(btn);
        });
      }
      skillBar.classList.toggle('m-has', manual.length > 0);
      for (var i = 0; i < skillBar.children.length; i++) {
        var b = skillBar.children[i], sid = b.getAttribute('data-sk'), s = DB.skills[sid];
        if (!s) continue;
        var cd = (player.manualCd && player.manualCd[sid]) || 0;
        var cost = (s.mp && player.d && typeof player.d.getMpCost === 'function') ? player.d.getMpCost(s.mp, s.tier) : (s.mp || 0);
        b.classList.toggle('m-cd', cd > 0 || (player.mp || 0) < cost);
      }
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
        elAc = strip.querySelector('#ms-ac'), elMr = strip.querySelector('#ms-mr'),
        elHpBar = strip.querySelector('#ms-hp-bar'), elMpBar = strip.querySelector('#ms-mp-bar'),
        elExp = strip.querySelector('#ms-exp'), elVictory = strip.querySelector('#ms-victory');
    function txt(id) { var e = document.getElementById(id); return e ? e.textContent.trim() : ''; }
    function barW(id) { var e = document.getElementById(id); return e && e.style.width ? e.style.width : '0%'; }
    function mirror() {
      if (!document.body.classList.contains('m-mobile')) return;
      // 暱稱(st-class);沒取名就退回職業(st-classname),都沒有才 '--'
      if (elName) elName.textContent = txt('st-class') || txt('st-classname') || '--';
      if (elLv) elLv.textContent = txt('st-lv') || '--';
      if (elAc) elAc.textContent = txt('st-ac') || '--';   // 防禦 (AC)
      if (elMr) elMr.textContent = txt('st-mr') || '--';   // 魔防 (MR)
      if (elHp) elHp.textContent = txt('txt-hp') || '--';
      if (elMp) elMp.textContent = txt('txt-mp') || '--';
      if (elHpBar) elHpBar.style.width = barW('bar-hp');   // 跟原版血條同步寬度(讀遊戲自己算好的 %)
      if (elMpBar) elMpBar.style.width = barW('bar-mp');
      if (elGold) elGold.textContent = txt('st-gold') || '--';
      // 攻城獲勝才在金幣右邊亮出皇冠(讀全域 siegeVictoryActive,缺了就安靜不顯示)
      if (elVictory) elVictory.style.display = (typeof siegeVictoryActive === 'function' && siegeVictoryActive()) ? '' : 'none';
      var be = document.getElementById('bar-exp');
      if (elExp && be) elExp.style.width = be.style.width || '0%';
      // 手動喝水列:在村莊隱藏(本來就自動回滿)、更新圖示/數量/安特的水果列
      var townView = document.getElementById('town-view');
      document.body.classList.toggle('m-intown', !!(townView && !townView.classList.contains('hidden')));
      updateHealBar();
      syncSkillBar();
      // 戰鬥畫面狀態鏡射:把 #dt-buffs(背包→能力→狀態)同步到喝水列下方的 #m-battle-buffs
      if (battleBuffs) { var dtb = document.getElementById('dt-buffs'); battleBuffs.innerHTML = dtb ? dtb.innerHTML : ''; }
      // 村莊時遊戲會給 combat-log-panel 加 hidden(沒有戰鬥日誌):強制切系統日誌、隱藏「切到戰鬥」鈕
      var noCombat = !combatLog || combatLog.classList.contains('hidden');
      document.body.classList.toggle('mlog-nocombat', noCombat);
      if (noCombat && document.body.classList.contains('mlog-combat')) setLog('sys');
    }
    setInterval(mirror, 300);

    var mql = window.matchMedia(MQ);

    // 🔧 偵測手機:作者改版後新增 __mobileScaling,手機時把 viewport 設成固定 1180 等比縮放——這會讓
    //    純寬度的 matchMedia 判定失效(變成對 1180 比、永遠 >768),故優先用它的 isMobileDevice()
    //    (看 pointer:coarse / 螢幕短邊 / UA,不受 viewport 影響),再 OR 上 matchMedia(窄視窗也算)。
    function detectMobile() {
      var sc = window.__mobileScaling;
      var devMobile = (sc && typeof sc.isMobileDevice === 'function') ? sc.isMobileDevice() : false;
      return devMobile || mql.matches;
    }

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
        var sc = window.__mobileScaling;
        if (sc && typeof sc.apply === 'function') sc.apply(false);   // 🔧 關掉作者「viewport 1180 等比縮放」→ 回 device-width,本外掛自建版面才正確(否則 100vw=1180、版面爆開)
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

    apply(detectMobile());
    function onMobileChange() { apply(detectMobile()); }
    if (mql.addEventListener) mql.addEventListener('change', onMobileChange);
    else if (mql.addListener) mql.addListener(onMobileChange);
    window.addEventListener('orientationchange', onMobileChange);   // 裝置旋轉也重新判定

    window.__afkm = { version: '1.0.0', apply: apply, setView: setView, setLog: setLog, openLog: openLog, closeLog: closeLog, toggleLog: toggleLog, isMobile: detectMobile };

    wrapSlotSelect(mql);   // 手機:把存檔鈕單行文字重排成兩行(編號+職業 / 等級+暱稱)

    console.log('[AFK-mobile] hooks OK — 手機版面已啟用(目前:' + (detectMobile() ? '手機' : '桌機') + ')。');

    // --- 精簡一行式狀態列 --------------------------------------------------
    function buildStatusStrip() {
      var d = document.createElement('div');
      d.id = 'm-status';
      d.innerHTML =
        // 第一列:暱稱 / 等級 / 防 / 魔防 / 金幣(王冠與ⓘ移到第二列,避免暱稱+金幣太長把這列擠爆)
        '<div class="ms-row ms-row1">' +
          '<span class="ms-seg ms-name"><b id="ms-name">--</b></span>' +
          '<span class="ms-seg ms-lv">Lv <b id="ms-lv">--</b></span>' +
          '<span class="ms-seg ms-ac">防 <b id="ms-ac">--</b></span>' +
          '<span class="ms-seg ms-mr">魔防 <b id="ms-mr">--</b></span>' +
          '<span class="ms-seg ms-gold">💰 <span id="ms-gold">--</span></span>' +
        '</div>' +
        // 第二列:HP / MP 雙血條 + 攻城獲勝皇冠 + ⓘ提示(血條 flex 自動讓出空間給右邊兩顆)
        '<div class="ms-row ms-row2">' +
          '<div class="ms-bar ms-hp"><i class="ms-bar-fill" id="ms-hp-bar"></i><span class="ms-bar-txt"><b>HP</b> <span id="ms-hp">--</span></span></div>' +
          '<div class="ms-bar ms-mp"><i class="ms-bar-fill" id="ms-mp-bar"></i><span class="ms-bar-txt"><b>MP</b> <span id="ms-mp">--</span></span></div>' +
          '<span class="ms-seg ms-victory" id="ms-victory" title="攻城獲勝期間:全商店8折、開放城堡" style="display:none">👑</span>' +   // 攻城獲勝才顯示(mirror 切換)
          '<span class="ms-seg ms-info">ⓘ</span>' +    // 提示:整條可點 → 開角色資訊彈窗
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
      window.__afkLoggingOut = true;   // 告知 afk-fixes 的關閉前存檔別重存:本流程已存過,reload 觸發的 beforeunload/pagehide 不必再存(否則手機 toast 會跳兩次)
      try { if (typeof window.saveGame === 'function') window.saveGame(); } catch (e) {}   // 先存當前進度,避免漏掉上次自動存檔後的收益
      try { if (window.__afk && window.__afk.stamp) window.__afk.stamp(); } catch (e) {}   // 存完再蓋錨點 → 存檔時間=離線起算時間,離線結算不會漏算/重算
      showLogoutOverlay();   // 立刻蓋全螢幕遮罩:reload 是整頁重開機(手機要幾秒),期間舊頁仍在跑戰鬥,不蓋住會看起來像「還在打怪」
      // double rAF:確保遮罩先畫出來(rAF 在繪製前觸發,巢狀第二個在首次繪製後),再開始 reload
      requestAnimationFrame(function () { requestAnimationFrame(function () { try { location.reload(); } catch (e) {} }); });
    });
    return m;
  }
  // 登出遮罩:蓋在最上層(z-index 高過登出視窗/toast),純視覺,讓重開機那幾秒看到「回首頁中」而非殘留的戰鬥畫面。
  function showLogoutOverlay() {
    if (document.getElementById('m-logout-overlay')) return;
    var o = document.createElement('div');
    o.id = 'm-logout-overlay';
    o.innerHTML = '<div id="m-logout-overlay-spin"></div><div id="m-logout-overlay-txt">已自動存檔，正在回首頁…</div>';
    document.body.appendChild(o);
  }

  // --- 手機戰鬥畫面:怪物下方的「手動喝水列」 -------------------------------
  //   每列排版:[藥水圖示][數量][按鈕]。藥水列喝設定裡選的治癒藥水(set-pot:紅/橙/白),
  //   沒貨依紅→橙→白往下找;背包有安特的水果時自動多一列(食用)。
  //   全走遊戲原生 useItem(uid, false) → 由它處理回血/消耗/CD/UI 刷新(手動=寫日誌、吃 1 秒共用冷卻)。
  function buildHealBar() {
    var bar = document.createElement('div');
    bar.id = 'm-heal-bar';
    bar.appendChild(buildScrollToggles());   // 左側:鏡射自動化設定的「魔法卷軸/瞬移卷軸」兩個勾選
    var rows = document.createElement('div');
    rows.className = 'm-heal-rows';
    rows.appendChild(makeHealRow('pot'));
    rows.appendChild(makeHealRow('fruit'));
    bar.appendChild(rows);
    return bar;
  }
  // 手動喝水列左側的兩個 checkbox,直接鏡射自動化設定面板的 set-magicbarrier / set-teleport:
  //   勾選 → 把對應的設定 checkbox 設成同值(遊戲每 tick 直接讀 .checked,故不必另發事件);
  //   反向同步(從設定面板改動)由 updateHealBar 每 300ms 回填。
  function buildScrollToggles() {
    var wrap = document.createElement('div');
    wrap.className = 'm-scroll-toggles';
    wrap.appendChild(makeScrollToggle('set-magicbarrier', '魔法卷軸(魔法屏障)', 'text-cyan-300'));
    wrap.appendChild(makeScrollToggle('set-teleport', '瞬間移動卷軸(遇BOSS)', 'text-sky-300'));
    return wrap;
  }
  function makeScrollToggle(targetId, label, colorClass) {
    var lab = document.createElement('label');
    lab.className = 'm-scroll-tog';
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.className = 'm-scroll-cb'; cb.setAttribute('data-target', targetId);
    cb.addEventListener('change', function () {
      var t = document.getElementById(targetId);
      if (t && t.checked !== cb.checked) t.checked = cb.checked;
    });
    var span = document.createElement('span');
    span.className = 'm-scroll-lab ' + colorClass;
    span.textContent = label;
    lab.appendChild(cb); lab.appendChild(span);
    return lab;
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

  // --- 手機載入/創角畫面:把存檔鈕的單行文字重排成兩行 ---------------------------
  //   原作 label 是一整串「存檔 N　職業 Lv.X　暱稱」塞進按鈕,手機 2/3 寬會折得參差。
  //   包住 openSlotSelect:原函式渲染後,在手機用 slotSummary(n) 的原始資料把每個存檔鈕重排成
  //   兩行(第一行 編號+職業、第二行 等級+暱稱)。用 textContent 寫入,暱稱不會被當 HTML(防 XSS)。
  //   桌機(mql 不命中)維持原樣不動;原作改掉 openSlotSelect / slotSummary 即自動失效(優雅降級,不弄壞畫面)。
  // 把離線毫秒數格式化成「X 天 Y 小時 / X 小時 Y 分 / X 分鐘 / 剛剛」
  function _fmtIdle(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    if (s < 60) return '剛剛';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' 分鐘';
    var h = Math.floor(m / 60), rm = m % 60;
    if (h < 24) return rm ? (h + ' 小時 ' + rm + ' 分') : (h + ' 小時');
    var d = Math.floor(h / 24), rh = h % 24;
    return rh ? (d + ' 天 ' + rh + ' 小時') : (d + ' 天');
  }
  function wrapSlotSelect(mql) {
    if (typeof window.openSlotSelect !== 'function' || window.openSlotSelect.__afkmWrapped) return;
    var orig = window.openSlotSelect;
    function reformat() {
      var list = document.getElementById('slot-list');
      if (!list || typeof slotSummary !== 'function') return;
      var rows = list.children;
      for (var i = 0; i < rows.length; i++) {
        var btn = rows[i].children[0];
        if (!btn) continue;
        var sum = slotSummary(i + 1);
        if (!sum) continue;   // 空存檔位維持原本單行「存檔 N　（空）」
        btn.textContent = '';
        // 👤 補回作者新加的存檔大頭貼(原 textContent='' 會連 img 一起清掉);路徑規則同原作 assets/save/<avatar>.jpg
        if (sum.avatar) {
          var av = document.createElement('img'); av.className = 'm-slot-av'; av.alt = '';
          av.src = 'assets/save/' + String(sum.avatar).replace('黑暗妖精', '黑妖').replace('幻術士', '幻術師') + '.jpg';
          av.onerror = function () { this.style.display = 'none'; };   // 缺檔自動隱藏
          btn.appendChild(av);
        }
        var l1 = document.createElement('span'); l1.className = 'm-slot-l1'; l1.textContent = '存檔 ' + (i + 1) + '　' + sum.cls;
        var l2 = document.createElement('span'); l2.className = 'm-slot-l2'; l2.textContent = 'Lv.' + sum.lv + '　' + sum.name;
        btn.appendChild(l1); btn.appendChild(l2);
        // 📍 目前掛在哪張地圖:讀 afk-offline 的即時地圖記錄 afk_map_<slot>(較準);沒有就退回存檔 blob 的 ms.current
        var _mapId = '';
        try { _mapId = localStorage.getItem('afk_map_' + (i + 1)) || ''; } catch (e) {}
        if (!_mapId) { try { var _rs = JSON.parse(localStorage.getItem('lineage_idle_save_' + (i + 1))); _mapId = (_rs && _rs.ms && _rs.ms.current) || ''; } catch (e) {} }
        if (_mapId) {
          var _mn = (window.__afk && typeof window.__afk.mapName === 'function') ? window.__afk.mapName(_mapId) : _mapId;
          var l3m = document.createElement('span'); l3m.className = 'm-slot-l3'; l3m.textContent = '📍 ' + _mn;
          btn.appendChild(l3m);
        }
        // ⏱ 進匯入頁時讀一次「已掛機多久」(離線時間)＝now − afk-offline 的最後活躍心跳(afk_ts_<slot>);讀一次不更新
        var _ts = 0; try { _ts = +localStorage.getItem('afk_ts_' + (i + 1)) || 0; } catch (e) {}
        if (_ts > 0) {
          var l3 = document.createElement('span'); l3.className = 'm-slot-l3';
          var _idleMs = Date.now() - _ts;
          var _capH = (window.__afk && window.__afk.capHours) || 24;   // 離線收益上限(小時),讀 afk-offline
          var _txt = '⏱ 已掛機 ' + _fmtIdle(_idleMs);
          if (_idleMs >= _capH * 3600000) _txt += '（收益上限 ' + _capH + ' 小時）';   // 顯示真實時間,但超過上限時提醒收益封頂
          l3.textContent = _txt;
          btn.appendChild(l3);
        }
      }
    }
    var wrapped = function () { orig.apply(this, arguments); if (mql.matches) reformat(); };
    wrapped.__afkmWrapped = true;
    window.openSlotSelect = wrapped;
  }

  // --- 注入手機版 CSS(全部掛在 body.m-mobile 之下)--------------------------
  function injectCSS() {
    if (document.getElementById('m-style')) return;
    var css = [
      '#m-nav{display:none;}',

      /* 原作者後來自己加了一套原生手機支援(index.html 的 @media max-width:820px:置頂 #mobile-vitals
         血條列 + 把幾個面板壓成 flex:none 固定高)。那套和本外掛「單欄輪播 + 底部導覽」版面重疊衝突,
         於 m-mobile 下蓋回。scope 在 body.m-mobile #id,比原作者 #id 規則更specific 即可勝出;
         原作者哪天移除這些規則,選擇器不命中就自動失效(不會弄壞)。 */
      'body.m-mobile #mobile-vitals{display:none !important;}',   /* 原生置頂 HP/MP 細條 → 與本外掛 #m-status 重複(雙血條),隱藏 */
      'body.m-mobile #tab-content-panel{flex:1 1 auto !important;height:auto !important;min-height:0 !important;}',   /* 背包欄:原生 height:70vh 害底部留空 → 還原撐滿 */
      'body.m-mobile #automation-panel{flex:1 1 auto !important;}',   /* 設定欄:原生 flex:none 害填不滿 → 還原撐滿 */
      'body.m-mobile #automation-panel > div:last-child{max-height:none !important;}',   /* 解除原生 220px 內捲上限,讓內容隨欄高自然捲動 */

      'body.m-mobile{padding:0 !important;}',
      /* game-screen 用 fixed 釘在左上角:脫離原作者 body 的 flex 置中流,
         避免它比 body 矮時被垂直置中(→ 上方空白、底部 nav 被工具列遮住)。
         只動 game-screen,不動 body 對齊 → 開始選單/創角畫面照樣置中。
         不下 z-index(fixed 配 z-index:auto 不建立 stacking context,內部 modal 行為不變)。 */
      'body.m-mobile #game-screen{position:fixed !important;top:0 !important;left:0 !important;flex-direction:column !important;gap:0 !important;max-width:none !important;width:100vw !important;height:100vh !important;height:100dvh !important;height:var(--app-h,100dvh) !important;margin:0 !important;padding:0 !important;}',

      /* 精簡一行式狀態列(取代原本佔 1/3 高的大面板;原面板在手機隱藏) */
      /* 🔮 席琳的世界:整條頂部狀態列染紅,當「席琳世界開啟中」的辨識標。
         桌機靠整片底圖換色標示,手機底圖被面板蓋住看不到,故改染這條;紅色與正常的深藍狀態列對比明顯、好辨識。
         不另加元素 → 不會被金幣位數撐高。只在手機+席琳世界開啟時生效。 */
      'body.m-mobile.sherine-world #m-status{background:linear-gradient(#3a0d12,#1f0508) !important;border-bottom-color:#b91c1c !important;}',
      '#m-status{display:none;}',
      'body.m-mobile #status-panel{display:none !important;}',
      'body.m-mobile #m-status{display:flex !important;flex-direction:column;flex:0 0 auto !important;gap:6px;padding:7px 12px 9px;position:relative;background:#0f172a;border-bottom:1px solid #334155;font-size:13px;color:#e2e8f0;line-height:1.2;cursor:pointer;}',
      'body.m-mobile #m-status:active{background:#16233c;}',
      /* 第一列:暱稱 / 等級 / 金幣 / ⓘ */
      'body.m-mobile #m-status .ms-row{display:flex;align-items:center;}',
      'body.m-mobile #m-status .ms-row1{gap:7px 12px;flex-wrap:wrap;}',
      'body.m-mobile #m-status .ms-seg{white-space:nowrap;}',
      'body.m-mobile #m-status .ms-name #ms-name{display:inline-block;max-width:38vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom;color:#fff;font-weight:bold;font-size:14px;}',
      'body.m-mobile #m-status .ms-info{margin-left:auto;color:#94a3b8;font-size:13px;}',
      'body.m-mobile #m-status #ms-lv{color:#fff;font-size:15px;}',
      'body.m-mobile #m-status .ms-ac,body.m-mobile #m-status .ms-mr{color:#94a3b8;}',   /* 防禦(AC)/魔防(MR):標籤灰、數值亮藍 */
      'body.m-mobile #m-status #ms-ac,body.m-mobile #m-status #ms-mr{color:#bfdbfe;font-size:14px;}',
      'body.m-mobile #m-status .ms-gold{color:#fbbf24;font-weight:bold;}',
      'body.m-mobile #m-status .ms-victory{color:#fde68a;text-shadow:0 0 6px rgba(253,230,138,0.85);font-size:14px;}',   /* 攻城獲勝皇冠:淡金黃+光暈,好辨識 */
      /* 第二列:HP / MP 雙血條(底條 + 填色 + 數字疊上,仿原版) */
      'body.m-mobile #m-status .ms-row2{gap:8px;}',
      'body.m-mobile #m-status .ms-bar{position:relative;flex:1 1 0;min-width:0;height:20px;border-radius:5px;overflow:hidden;background:#1e293b;border:1px solid #334155;}',
      'body.m-mobile #m-status .ms-bar-fill{position:absolute;left:0;top:0;bottom:0;width:0%;transition:width .25s;}',
      'body.m-mobile #m-status .ms-hp .ms-bar-fill{background:#dc2626;}',
      'body.m-mobile #m-status .ms-mp .ms-bar-fill{background:#2563eb;}',
      'body.m-mobile #m-status .ms-bar-txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;color:#fff;font-weight:bold;text-shadow:0 1px 2px rgba(0,0,0,.75);}',
      'body.m-mobile #m-status .ms-bar-txt b{font-weight:bold;}',
      'body.m-mobile #m-status .ms-hp .ms-bar-txt b{color:#fecaca;}',
      'body.m-mobile #m-status .ms-mp .ms-bar-txt b{color:#bfdbfe;}',
      'body.m-mobile #m-status #ms-exp{position:absolute;left:0;bottom:0;height:3px;width:0%;background:#eab308;transition:width .25s;}',

      /* 手機戰鬥畫面:怪物下方的手動喝水列(桌機與非戰鬥/村莊一律隱藏)。每列=[圖示][數量][按鈕] */
      '#m-heal-bar{display:none;}',
      'body.m-mobile.mview-battle #m-heal-bar{display:flex;flex-direction:row;align-items:center;gap:10px;flex:0 0 auto;margin:10px 12px 2px;}',
      'body.m-mobile #m-heal-bar .m-heal-rows{display:flex;flex-direction:column;gap:8px;flex:1 1 auto;min-width:0;}',
      'body.m-mobile #m-heal-bar .m-scroll-toggles{display:flex;flex-direction:column;gap:8px;flex:0 0 auto;}',
      'body.m-mobile #m-heal-bar .m-scroll-tog{display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:bold;white-space:nowrap;}',
      'body.m-mobile #m-heal-bar .m-scroll-cb{width:18px;height:18px;flex:0 0 auto;margin:0;}',
      'body.m-mobile #m-heal-bar .m-scroll-lab.text-cyan-300{color:#67e8f9;}',
      'body.m-mobile #m-heal-bar .m-scroll-lab.text-sky-300{color:#7dd3fc;}',
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

      /* 喝水列下方:主動施放技能快捷鈕(琥珀色,與背包-技能面板的施放鈕同色系);沒學任何手動技能(無 .m-has)或村莊/桌機一律隱藏。一排兩顆 */
      '#m-skill-bar{display:none;}',
      'body.m-mobile.mview-battle #m-skill-bar.m-has{display:flex;flex-wrap:wrap;gap:8px;flex:0 0 auto;margin:2px 12px;}',
      'body.m-mobile #m-skill-bar .m-skill-go{flex:1 1 30%;min-width:28%;display:flex;align-items:center;justify-content:center;gap:5px;padding:11px 4px;border-radius:10px;font-size:13px;font-weight:bold;font-family:inherit;cursor:pointer;color:#fcd34d;border:1px solid #f59e0b;background:linear-gradient(#92400e,#78350f);box-shadow:0 2px 8px rgba(0,0,0,.4);}',
      'body.m-mobile #m-skill-bar .m-skill-go:active{filter:brightness(.85);transform:translateY(1px);}',
      'body.m-mobile #m-skill-bar .m-skill-ic{width:22px;height:22px;flex:0 0 auto;object-fit:contain;pointer-events:none;}',
      'body.m-mobile #m-skill-bar .m-skill-go.m-cd{filter:grayscale(.6);opacity:.5;}',
      'body.m-mobile.m-intown #m-skill-bar{display:none !important;}',

      /* 怪物名字與圖片之間的徽章列(頭目／異常狀態 tag):原作固定 height:18px + overflow:hidden + flex 不換行。
         手機三隻怪並排、單欄很窄,有 3 個以上 tag 時 flex 會把每個 tag 壓縮到只剩第一個字、其餘被裁掉看不見。
         手機改為:tag 不收縮(flex:0 0 auto)、整列可換行、取消固定高度,讓每個 tag 文字完整顯示。
         以行內 height:18px 屬性選擇器精準命中徽章列(狀態圖示列是 height:16px、血條無此值,皆不誤中);
         scope 在 body.m-mobile 的 #mob-list,桌機維持原本單行固定高;原作改掉 height:18px 寫法即自動失效。 */
      'body.m-mobile #mob-list .mob-target > div[style*="height:18px"]{height:auto !important;min-height:18px !important;flex-wrap:wrap !important;overflow:visible !important;row-gap:2px !important;}',
      'body.m-mobile #mob-list .mob-target > div[style*="height:18px"] > span{flex:0 0 auto !important;}',
      /* 怪物卡原作固定 height:224px + overflow:hidden + 內容置中:手機窄欄怪名常折成兩行,內容超過 224
         被裁掉 → 最底的血條看不見。手機改成「固定 252px(容得下兩行名稱)+ 名稱最多兩行截斷」:
         高度永遠一致 → 不會隨怪物換人/名稱長短抖動,血條也一定看得到。原作改掉固定高即自動失效。 */
      'body.m-mobile #mob-list .mob-target{height:252px !important;overflow:hidden !important;}',
      'body.m-mobile #mob-list .mob-target > div:first-child > span{display:-webkit-box !important;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.15;}',

      /* 喝水列下方:鏡射「背包→能力→狀態」(#dt-buffs)。只在戰鬥畫面顯示、村莊隱藏(同喝水列) */
      '#m-battle-buffs{display:none;}',
      'body.m-mobile.mview-battle #m-battle-buffs{display:block;flex:0 0 auto;margin:2px 12px 8px;padding:8px 12px;max-height:22vh;overflow-y:auto;background:#0f172a;border:1px solid #334155;border-radius:10px;color:#e2e8f0;font-size:13px;line-height:1.5;}',
      'body.m-mobile.m-intown #m-battle-buffs{display:none !important;}',

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
      /* 系統日誌標題列右側「黑市拍賣中:商品名」(原作 #syslog-pandora,帶 truncate):
         手機浮動面板寬度窄,扣掉標題與右側 ⇆/✕ 鈕後剩沒幾字 → 商品名被 truncate 切掉顯示不完整。
         有商品時(:not(:empty))讓它換到標題下方整行、正常折行不截斷;沒商品(:empty)維持原樣不佔行高。
         scope 在手機浮動日誌的 .m-log-hdr,桌機與原作改版皆不受影響。 */
      'body.m-mobile #m-log-body .panel-header.m-log-hdr{flex-wrap:wrap !important;row-gap:0 !important;}',
      'body.m-mobile #m-log-body .panel-header.m-log-hdr #syslog-pandora:not(:empty){flex:1 1 100% !important;white-space:normal !important;overflow:visible !important;text-overflow:clip !important;text-align:left !important;line-height:1.2 !important;margin-top:0 !important;}',

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

      /* 登出遮罩:按確定後立刻蓋住,撐過 reload 重開機的幾秒(否則舊頁戰鬥畫面還在跑) */
      '#m-logout-overlay{position:fixed;inset:0;z-index:100000;background:#020617;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;}',
      '#m-logout-overlay-spin{width:38px;height:38px;border:3px solid #334155;border-top-color:#f59e0b;border-radius:50%;animation:m-logout-spin 0.8s linear infinite;}',
      '#m-logout-overlay-txt{color:#e2e8f0;font-size:15px;letter-spacing:0.5px;}',
      '@keyframes m-logout-spin{to{transform:rotate(360deg);}}',

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

      /* 倉庫捲動的根因是「巢狀垂直捲動」:外層 #interaction-content 本身 overflow-y:auto 會捲,
         內層兩個清單(#wh-inv-list/#wh-store-list)又各自 overflow-y:auto + max-height:340px 會捲。
         iOS WebKit 無法乾淨判斷手勢屬於哪一層(原本鏈到外層→背景捲;之前用 -webkit-overflow-scrolling:touch
         反而讓內層變成另一個捲動圖層→要先點一下才捲)。
         解法:手機上讓兩個清單「不要自己捲」(取消 max-height/overflow),整個倉庫面板交給外層單一捲動 →
         沒有巢狀就沒有哪層的爭議,iOS/安卓都正常。桌機維持原本各自捲(滑鼠滾輪無此問題)。 */
      'body.m-mobile #wh-inv-list,body.m-mobile #wh-store-list{max-height:none !important;overflow:visible !important;}',

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

      /* 村莊頁頂部:村名(text-3xl)+「安全區域」提示在手機佔掉一截高度 → 縮字級與上下間距 */
      'body.m-mobile #town-view{padding:10px 12px !important;gap:5px !important;}',
      'body.m-mobile #town-name{font-size:19px !important;}',
      'body.m-mobile #town-view > p{font-size:12px !important;line-height:1.35 !important;}',
      'body.m-mobile #town-npc-container{margin-top:6px !important;}',

      /* 倉庫(warehouse NPC):金幣存取列 + 分類/一鍵列在手機窄寬下擠成一團 → 重排成整齊兩行。
         用倉庫專屬 id/onclick(#wh-gold-amt、whOneClickDeposit)定位,只命中倉庫;原作改版即失效不影響別頁。 */
      /* 金幣列:資訊一行、數量輸入一行,[存入][取出]自成一列各佔一半 */
      'body.m-mobile #interaction-content div:has(> #wh-gold-amt){gap:8px !important;}',
      'body.m-mobile #interaction-content div:has(> #wh-gold-amt) > span:first-child{flex:1 1 100% !important;}',
      'body.m-mobile #interaction-content #wh-gold-amt{flex:1 1 100% !important;width:auto !important;margin-left:0 !important;}',
      'body.m-mobile #interaction-content div:has(> #wh-gold-amt) > button{flex:1 1 40% !important;}',
      /* 分類列:[物品分類 + 下拉]一行,[一鍵存入][一鍵排列]整寬第二行;隱藏冗長的共用提示字 */
      'body.m-mobile #interaction-content div:has(> button[onclick^="whOneClickDeposit"]){flex-wrap:wrap !important;gap:8px !important;align-items:center !important;}',
      'body.m-mobile #interaction-content div:has(> button[onclick^="whOneClickDeposit"]) > select{flex:1 1 160px !important;}',
      'body.m-mobile #interaction-content div:has(> button[onclick^="whOneClickDeposit"]) > span.text-slate-500{display:none !important;}',
      'body.m-mobile #interaction-content div:has(> button[onclick^="whOneClickDeposit"]) > button{flex:1 1 40% !important;margin-left:0 !important;}',

      /* 血盟 NPC(依詩蒂/特羅斯):桌機 flex-row + 200px 立繪,手機窄寬下右側對話被擠成一字一行。
         改直向堆疊:立繪縮小置中、對話/按鈕整寬。招募與已加入兩種版面皆適用;原作改版規則自動失效。 */
      'body.m-mobile #interaction-content > .flex-row{flex-direction:column !important;align-items:center !important;gap:14px !important;padding:12px !important;}',
      'body.m-mobile #interaction-content > .flex-row > div:first-child{width:150px !important;height:210px !important;}',
      'body.m-mobile #interaction-content > .flex-row > div:last-child{width:100% !important;}',

      /* 手機長按看詳情:資訊卡彈窗(取代桌機 hover tooltip);短按維持原動作,長按那下不誤觸 */
      '#m-tip-modal{display:none;}',
      'body.m-mobile #m-tip-modal.open{display:flex !important;position:fixed;inset:0;z-index:85;align-items:flex-start;justify-content:center;padding:60px 12px 16px;background:rgba(2,6,23,0.6);}',
      'body.m-mobile #m-tip-card{position:relative;width:min(94vw,420px);max-height:72vh;overflow-y:auto;background:rgba(15,23,42,0.98);border:1px solid #64748b;border-radius:10px;padding:14px 14px 16px;box-shadow:0 12px 40px rgba(0,0,0,.7);color:#e2e8f0;}',
      'body.m-mobile #m-tip-card .m-tip-x{position:absolute;top:6px;right:6px;width:32px;height:32px;border:1px solid rgba(100,116,139,.7);background:rgba(30,41,59,.9);color:#e2e8f0;border-radius:7px;font-size:15px;line-height:1;cursor:pointer;font-family:inherit;padding:0;}',
      'body.m-mobile #m-tip-card .m-tip-x:active{background:rgba(71,85,105,.95);}',
      'body.m-mobile #m-tip-card .m-tip-name{font-weight:bold;font-size:16px;margin:0 36px 6px 0;}',
      'body.m-mobile #m-tip-card .m-tip-body{font-size:13px;line-height:1.6;}',
      'body.m-mobile .tip-host,body.m-mobile #interaction-content [title]{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;}',

      /* 創角畫面手機化:外框釘在頂端、用可視高度(--app-h)當上限,避免 94vh 延伸到 Brave 底部
         工具列後面把「開始冒險」鈕蓋住;內層原本 flex-row + 固定寬高(會爆寬)→ 全改直向堆疊、滿版 */
      'body.m-mobile #creation-screen{position:fixed !important;top:0 !important;left:50% !important;transform:translateX(-50%) !important;margin:0 !important;width:96vw !important;max-width:96vw !important;height:auto !important;max-height:var(--app-h,94vh) !important;overflow-y:auto !important;padding:16px 16px 28px !important;}',
      'body.m-mobile #creation-panel{flex-direction:column !important;gap:12px !important;align-items:stretch !important;}',
      'body.m-mobile .m-cre-avatar{width:100% !important;height:220px !important;}',
      'body.m-mobile .m-cre-right{width:100% !important;height:auto !important;}',
      'body.m-mobile .m-cre-row{flex-direction:column !important;height:auto !important;gap:12px !important;}',
      'body.m-mobile .m-cre-classbox{width:100% !important;height:auto !important;}',
      'body.m-mobile #stat-allocation{width:100% !important;height:auto !important;}',
      'body.m-mobile #class-desc{max-height:110px !important;flex:0 0 auto !important;}',

      /* 載入進度畫面(#slot-list):原作每列是 [載入存檔 flex-1][動作區固定 w-56=224px → 匯入進度(+復原備份)]。
         手機窄寬下 224px 的動作區吃掉約 6 成,左側真正要點的「載入存檔」被擠成細條、存檔名稱被迫折成多行。
         改成左 2/3 給載入存檔、右 1/3 放動作區,匯入/復原在右側上下堆疊。scope 在 #slot-list 直接子層,
         原作改版(換 id / 重排)規則自動失效、桌機不受影響。
         #slot-list 改 grid + grid-auto-rows:1fr → 每列自動拉成跟最高那列等高(有/無備份、名稱折一行或兩行都一致),
         不寫死高度、名稱變長也會自己同步。 */
      'body.m-mobile #slot-list{display:grid !important;grid-template-columns:minmax(0,1fr) !important;grid-auto-rows:1fr !important;}',
      'body.m-mobile #slot-list > div{flex-wrap:nowrap !important;align-items:stretch !important;}',
      'body.m-mobile #slot-list > div > button:first-child{flex:2 1 0 !important;min-width:0 !important;display:flex !important;flex-direction:column !important;align-items:center !important;justify-content:center !important;gap:3px !important;line-height:1.25 !important;}',   /* 載入存檔鈕:左 2/3,文字直向兩行 */
      'body.m-mobile #slot-list .m-slot-av{width:40px;height:40px;border-radius:6px;object-fit:cover;object-position:top;border:1px solid rgba(148,163,184,.55);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 1px 2px rgba(0,0,0,.5);}',   /* 👤 存檔大頭貼:置中直欄最上方 */
      'body.m-mobile #slot-list .m-slot-l1{font-size:1rem;}',   /* 第一行:存檔編號 + 職業 */
      'body.m-mobile #slot-list .m-slot-l2{font-size:.9rem;font-weight:bold;color:#cbd5e1;}',   /* 第二行:等級 + 暱稱 */
      'body.m-mobile #slot-list .m-slot-l3{font-size:.78rem;color:#94a3b8;}',   /* ⏱ 第三行:已掛機多久 */
      'body.m-mobile #slot-list > div > div{width:auto !important;flex:1 1 0 !important;min-width:0 !important;flex-direction:column !important;}',   /* 動作區:右 1/3,蓋掉固定 w-56,匯入/復原改上下堆疊 */
      'body.m-mobile #slot-list > div > div > button{flex:1 1 0 !important;padding:.5rem .25rem !important;font-size:.8rem !important;}'   /* 匯入/復原:各佔右側一半高 */
    ].join('\n');
    var s = document.createElement('style');
    s.id = 'm-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // --- 手機「長按物品看詳情」:取代桌機 hover tooltip(原作只綁 mousemove,手機觸發不到)。
  //   長按任一 .tip-host(倉庫/背包/商店/製作/裝備欄的物品)約 350ms → 彈出資訊卡;短按維持原動作。
  //   內容沿用原作全域函式(getItemFullName/buildItemDescHTML/getItemColor),不重寫資料、不改原作碼。
  // --- 手機倉庫存/取數量:用自製數量視窗取代原生 prompt。
  //   iOS Safari 連續跳幾次原生 prompt 後會「抑制後續對話框」→ 按了沒反應、要重開分頁(使用者回報)。
  //   原作 whDeposit/whWithdraw 的第二參數 qty 有給就不會 prompt → 我們選好數量後帶 qty 呼叫原函式即可,完全不動原作碼。
  function initWhQty() {
    if (document.getElementById('m-whqty-modal')) return;
    var st = document.createElement('style');
    st.id = 'm-whqty-style';
    st.textContent = [
      '#m-whqty-modal{display:none;position:fixed;inset:0;z-index:100000;background:rgba(2,6,23,.75);align-items:center;justify-content:center;padding:24px;font-family:system-ui,"Segoe UI",sans-serif;}',
      '#m-whqty-modal.open{display:flex;}',
      '#m-whqty-card{width:min(360px,92vw);background:#0f172a;border:1px solid #475569;border-radius:12px;padding:18px;box-shadow:0 16px 50px rgba(0,0,0,.6);}',
      '#m-whqty-title{color:#e2e8f0;font-size:15px;font-weight:bold;margin-bottom:14px;text-align:center;line-height:1.5;}',
      '#m-whqty-row{display:flex;align-items:center;gap:8px;margin-bottom:16px;}',
      '#m-whqty-row button{flex:0 0 auto;width:44px;height:44px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;border-radius:8px;font-size:18px;cursor:pointer;padding:0;}',
      '#m-whqty-row #m-whqty-all{width:auto;padding:0 12px;font-size:14px;font-weight:bold;color:#fcd34d;}',
      '#m-whqty-input{flex:1 1 auto;min-width:0;height:44px;text-align:center;background:#1e293b;border:1px solid #334155;color:#fff;border-radius:8px;font-size:18px;font-weight:bold;font-family:inherit;}',
      '#m-whqty-btns{display:flex;gap:10px;}',
      '#m-whqty-btns button{flex:1 1 0;height:46px;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer;border:1px solid #334155;font-family:inherit;}',
      '#m-whqty-cancel{background:#1e293b;color:#cbd5e1;}',
      '#m-whqty-ok{background:#15803d;color:#fff;border-color:#16a34a;}',
      '#m-whqty-row button:active,#m-whqty-btns button:active{filter:brightness(1.25);}'
    ].join('\n');
    document.head.appendChild(st);

    var modal = document.createElement('div');
    modal.id = 'm-whqty-modal';
    modal.innerHTML =
      '<div id="m-whqty-card">' +
        '<div id="m-whqty-title"></div>' +
        '<div id="m-whqty-row">' +
          '<button type="button" id="m-whqty-dec" aria-label="減一">−</button>' +
          '<input id="m-whqty-input" type="number" inputmode="numeric" min="1">' +
          '<button type="button" id="m-whqty-inc" aria-label="加一">＋</button>' +
          '<button type="button" id="m-whqty-all">全部</button>' +
        '</div>' +
        '<div id="m-whqty-btns">' +
          '<button type="button" id="m-whqty-cancel">取消</button>' +
          '<button type="button" id="m-whqty-ok">確定</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    var input = modal.querySelector('#m-whqty-input');
    var titleEl = modal.querySelector('#m-whqty-title');
    var curMax = 1, curCb = null;
    function clampV(v) { v = Math.floor(Number(v) || 0); if (!(v > 0)) v = 1; if (v > curMax) v = curMax; return v; }
    function openQty(name, max, cb) {
      curMax = Math.max(1, max | 0); curCb = cb;
      titleEl.textContent = '「' + name + '」要幾個？（1 ~ ' + curMax + '）';
      input.max = curMax; input.value = curMax;
      modal.classList.add('open');
      // 不自動 focus input:手機上會每次都彈出鍵盤。預設值＝全部、又有 −/＋/全部 鈕,多數情況直接按確定即可;要改數字再自己點輸入框。
    }
    function closeQty() { modal.classList.remove('open'); curCb = null; }
    modal.querySelector('#m-whqty-dec').addEventListener('click', function () { input.value = clampV((Number(input.value) || 0) - 1); });
    modal.querySelector('#m-whqty-inc').addEventListener('click', function () { input.value = clampV((Number(input.value) || 0) + 1); });
    modal.querySelector('#m-whqty-all').addEventListener('click', function () { input.value = curMax; });
    modal.querySelector('#m-whqty-cancel').addEventListener('click', closeQty);
    modal.querySelector('#m-whqty-ok').addEventListener('click', function () { var v = clampV(input.value); var cb = curCb; closeQty(); if (cb) cb(v); });
    modal.addEventListener('click', function (e) { if (e.target === modal) closeQty(); });

    // 包住原作的 whDeposit/whWithdraw:手機 + 未指定數量 + 可堆疊(>1) → 改用自製視窗;否則照原行為。
    function wrap(fnName, lookup) {
      var orig = window[fnName];
      if (typeof orig !== 'function') return;
      window[fnName] = function (uidv, qty) {
        if (qty === undefined && document.body.classList.contains('m-mobile')) {
          var info = lookup(uidv);
          if (info && info.total > 1) {
            openQty(info.name, info.total, function (chosen) { orig(uidv, chosen); });
            return;
          }
        }
        return orig.apply(this, arguments);
      };
    }
    function nameOf(it) { try { return (DB.items[it.id] && DB.items[it.id].n) || it.id; } catch (e) { return it.id; } }
    wrap('whDeposit', function (uidv) {   // 背包 → 倉庫:查 player.inv
      try { var it = (player.inv || []).filter(function (x) { return x.uid === uidv; })[0]; return it ? { name: nameOf(it), total: it.cnt || 1 } : null; } catch (e) { return null; }
    });
    wrap('whWithdraw', function (uidv) {   // 倉庫 → 背包:查 loadWarehouse()
      try { var w = (typeof loadWarehouse === 'function') ? loadWarehouse() : null; var it = (w && w.items ? w.items : []).filter(function (x) { return x.uid === uidv; })[0]; return it ? { name: nameOf(it), total: it.cnt || 1 } : null; } catch (e) { return null; }
    });
  }

  function initTipPeek() {
    if (document.getElementById('m-tip-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'm-tip-modal';
    var card = document.createElement('div');
    card.id = 'm-tip-card';
    modal.appendChild(card);
    document.body.appendChild(modal);

    var modalOpen = false, swallow = false, swallowTimer = null, ICON2ID = null;

    // 圖示 src → 基底物品 id(商店/製作清單的圖示沒有 data-tip-uid,只能靠圖反查)
    function iconToId(src) {
      if (typeof DB === 'undefined' || !DB.items || typeof getIconUrl !== 'function') return null;
      if (!ICON2ID) { ICON2ID = {}; for (var id in DB.items) { var d = DB.items[id]; if (d) { try { ICON2ID[getIconUrl(d)] = id; } catch (e) {} } } }
      return ICON2ID[src] || null;
    }
    // 解析一個 .tip-host 對應的物品 → {name, body, color};解析不出(非物品)回 null,讓它走一般操作
    function resolve(host) {
      var base = null;
      var uid = host.getAttribute('data-tip-uid');
      if (uid) {
        var src = host.getAttribute('data-tip-src') || 'inv';
        try {
          if (src === 'wh' && typeof loadWarehouse === 'function') { var w = loadWarehouse(); base = (w && w.items) ? w.items.filter(function (x) { return x.uid === uid; })[0] : null; }
          else if (typeof player !== 'undefined' && player && player.inv) { base = player.inv.filter(function (x) { return x.uid === uid; })[0]; }
        } catch (e) {}
        if (!base) return null;
      } else {
        var img = host.querySelector('img');
        var s = img ? img.getAttribute('src') : null;
        var rid = s ? iconToId(s) : null;
        if (!rid) return null;
        base = { id: rid, en: 0 };
      }
      return {
        name: (typeof getItemFullName === 'function') ? getItemFullName(base) : (base.id || ''),
        body: (typeof buildItemDescHTML === 'function') ? buildItemDescHTML(base) : '',
        color: (typeof getItemColor === 'function') ? (getItemColor(base) || '') : ''
      };
    }
    // 解析「靠 title 顯示說明」的元素(如 50 等漢的專精選擇按鈕,完整效果說明放在 title)。
    function resolveTitle(host) {
      var t = (host.getAttribute('title') || '').trim();
      if (!t) return null;
      var nameEl = host.querySelector ? host.querySelector('.font-bold, b, strong') : null;   // 按鈕內粗體=該項名稱(如精通名)
      return { name: nameEl ? nameEl.textContent.trim() : '', body: t.replace(/\n/g, '<br>'), color: '' };
    }
    function open(c) {
      card.innerHTML = '<button type="button" class="m-tip-x">✕</button>'
        + '<div class="m-tip-name ' + c.color + '">' + c.name + '</div>'
        + '<div class="m-tip-body">' + c.body + '</div>';
      card.querySelector('.m-tip-x').addEventListener('click', function (e) { e.stopPropagation(); close(); });
      modal.classList.add('open'); modalOpen = true;
    }
    function close() { modal.classList.remove('open'); modalOpen = false; }
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });

    // 長按開卡後,吞掉緊接而來那一下 click(避免長按結束被當成存入/取出/購買);卡片內的點擊不吞
    function arm() { swallow = true; clearTimeout(swallowTimer); swallowTimer = setTimeout(function () { swallow = false; }, 800); }
    document.addEventListener('click', function (e) {
      if (swallow && !modal.contains(e.target)) { swallow = false; clearTimeout(swallowTimer); e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);

    var timer = null, sx = 0, sy = 0, host = null, hostKind = 'item';
    document.addEventListener('touchstart', function (e) {
      if (!document.body.classList.contains('m-mobile') || modalOpen) return;
      if (!e.target || !e.target.closest) return;
      var h = e.target.closest('.tip-host'), titleEl = null;
      if (!h) {   // 不是物品圖示 → 看是不是 NPC 面板裡「靠 title 顯示說明」的元素(如專精按鈕)
        var ic = document.getElementById('interaction-content');
        var te = e.target.closest('[title]');
        if (te && ic && ic.contains(te) && (te.getAttribute('title') || '').trim()) titleEl = te;
      }
      if (!h && !titleEl) return;
      host = h || titleEl; hostKind = h ? 'item' : 'title';
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY;
      clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        var c = (hostKind === 'item') ? resolve(host) : resolveTitle(host);
        if (!c) return;        // 解析不出內容 → 不開卡,維持一般操作
        open(c); arm();
      }, 350);
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (timer === null) return;
      var t = e.touches[0]; if (!t) return;
      if (Math.abs(t.clientX - sx) > 12 || Math.abs(t.clientY - sy) > 12) { clearTimeout(timer); timer = null; }   // 移動=捲動,取消長按
    }, { passive: true });
    function endPress() { clearTimeout(timer); timer = null; }
    document.addEventListener('touchend', endPress, { passive: true });
    document.addEventListener('touchcancel', endPress, { passive: true });
    // 壓抑 Android/iOS 長按在圖示/說明按鈕上跳出的選單、儲存圖片 callout、選字
    document.addEventListener('contextmenu', function (e) {
      if (!document.body.classList.contains('m-mobile') || !e.target || !e.target.closest) return;
      var ic = document.getElementById('interaction-content');
      if (e.target.closest('.tip-host') || (ic && e.target.closest('[title]') && ic.contains(e.target.closest('[title]')))) e.preventDefault();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
