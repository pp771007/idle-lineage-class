/* ==========================================================================
 * afk-reissueid.js — 換發身分證(重新發放所有角色的身分碼 enSeed)
 *
 * 解決什麼:
 *   核心以 player.enSeed 當「唯一角色識別」。用匯出/匯入複製角色會讓多格共用同一組
 *   enSeed,在遊戲眼中就是同一個人 → 寵物歸屬(js/22 'char:'+enSeed)、血盟成員記錄
 *   (js/25 clanRoleId)、傭兵換角判定(js/06 purgeReplacedAllies)全部互相打架。
 *   上游因此在 importSave(js/13:517-528)加了重複身分掃描,撞號一律擋下不給匯入。
 *
 *   本外掛把「現行所有存檔位」各換一組全新身分碼,於是:
 *     ① 各格身分獨立 → 寵物/血盟/傭兵不再互相干擾
 *     ② 手上的舊備份檔(帶舊碼)全部變成「陌生人」→ 可以直接匯入當成不同角色
 *
 * 為什麼全部換而不是只換撞號的:
 *   只換撞號的話,沒被換到的那格仍持有舊碼 → 匯入同一份舊備份還是會撞。全換才能讓
 *   所有舊備份一律成為陌生人,這正是玩家要的「同一份存檔匯入成不同人」。
 *
 * 🚨 安全前提(缺一不可,程式內都有檔):
 *   - 只在「主選單/未載入角色」時可用。已載入角色時記憶體 player 仍是舊碼,磁碟換新後
 *     _roleFingerprint 對不上 → _roleSaveAllowed() 恆 false → 該格從此靜默存不進去(死鎖)。
 *   - 全程直接讀寫 localStorage,不呼叫任何原作寫檔函式(saveGame/petRosterSave/…)。
 *   - 逐 key 驗證寫入成功,任何一步失敗立刻中止並回報,不做「寫一半」。
 *
 * 連帶資料一起改(不改的話換完更亂):
 *   存檔      p.enSeed / p._roleEpoch / p.allies[].enSeed / p.mercPrefs / p.mercLedgerOutbox
 *   寵物名冊  outOwner 'char:<舊碼>' → 新碼(靠 outSlot 決定歸屬;判不出來就收回,見下)
 *   血盟      members[<舊碼>] 與 modes[].leaderId → 新碼
 *   傭兵帳本  fb5_merc_exp_ledger 內 {slot,enSeed} 的 enSeed → 新碼(待領經驗才不會失效)
 *
 * 優雅降級:核心函式/常數缺任何一個就安靜停用,不影響遊戲。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('reissueid')) return;

  // 核心常數優先取用(別自己寫死,上游改了才不會默默對不上);取不到才用已知預設值兜底
  function core(name, fallback) { try { return eval(name); } catch (e) { return fallback; } }   // eslint-disable-line no-eval
  var SAVE_PREFIX = 'lineage_idle_save_';
  var PET_ROSTER = core('PET_ROSTER_KEY', 'fb5_pet_roster');
  var CLAN_KEY = core('CLAN_STATE_KEY', 'fb5_clan_state_v1');
  var MERC_KEY = core('MERC_LEDGER_KEY', 'fb5_merc_exp_ledger');
  var REISSUE_LOG_KEY = 'afk_reissue_log';    // 換發對照表(舊碼→新碼),很小,留著方便事後查帳
  var CONFIRM_PHRASE = '換發身分證';          // 執行前要玩家手動打進去(擋手滑;同上游刪角要打角色名)

  function slotMax() { return (typeof SAVE_SLOT_MAX !== 'undefined') ? SAVE_SLOT_MAX : 16; }

  // 舊檔沒有 enSeed 時核心的衍生式。⚠️ 必須與 js/13:1436 / js/13:342 / js/13:518 逐字相同,
  //   不同就會算出兩個指紋 → _roleSaveAllowed 永遠 false(上游在 js/13:339-341 有重話警告)。
  function deriveSeed(p) {
    return 'es' + _seedHash((p.name || '') + '|' + (p.cls || '') + '|lz').toString(36);
  }
  function newSeed() {
    return 'es' + (typeof uid === 'function' ? uid() + uid()
      : Math.random().toString(36).slice(2, 11) + Math.random().toString(36).slice(2, 11));
  }
  function newEpoch() { return 're_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2); }
  function petStamp() { return (typeof _petNowStamp === 'function') ? _petNowStamp() : Date.now(); }

  // 簽章包裝的三種資料(存檔/寵物名冊/血盟)讀寫格式一致:_lzSet(key, _saveWrap(JSON))
  //   簽章不符一律回 null → 呼叫端跳過不動它(絕不覆蓋讀不懂的資料)
  function readWrapped(key) {
    var raw = _lzGet(key);
    if (raw == null) return null;
    var un = _saveUnwrap(raw);
    if (!un.ok) return null;
    try { return JSON.parse(un.payload); } catch (e) { return null; }
  }
  function writeWrapped(key, obj) { return !!_lzSet(key, _saveWrap(JSON.stringify(obj))); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── 掃描:每格現況與新碼(純唯讀,產生「打算怎麼換」的計畫) ────────────────────
  function buildPlan() {
    var plan = [], seen = {};
    for (var s = 1; s <= slotMax(); s++) {
      var obj = readWrapped(SAVE_PREFIX + s);
      if (!obj || !obj.p || !obj.p.cls) continue;
      var oldSeed = obj.p.enSeed || deriveSeed(obj.p);
      seen[oldSeed] = (seen[oldSeed] || 0) + 1;
      plan.push({
        slot: s, oldSeed: oldSeed, newSeed: newSeed(),
        name: obj.p.name || '(未命名)', cls: obj.p.cls, lv: obj.p.lv || obj.p.level || '?'
      });
    }
    plan.forEach(function (e) { e.dup = seen[e.oldSeed] > 1; });
    return plan;
  }

  // ── 換發本體 ──────────────────────────────────────────────────────────────
  //   回傳 {ok, steps:[...], error}。任何一步寫入失敗就 ok:false,呼叫端據此提示玩家。
  function reissue(plan) {
    var bySlot = {}, byOldSeed = {}, claim = {};
    plan.forEach(function (e) {
      bySlot[String(e.slot)] = e;
      (byOldSeed[e.oldSeed] = byOldSeed[e.oldSeed] || []).push(e);
      // 一組舊碼被多格共用時,「單一份」的連帶資料(血盟成員記錄)只能給一格 → 給格號最小的
      if (!claim[e.oldSeed] || e.slot < claim[e.oldSeed].slot) claim[e.oldSeed] = e;
    });

    var steps = [], fail = null;
    function note(t) { steps.push(t); }

    // 1) 各存檔位:身分碼 + 角色世代 + 檔內以身分碼為鍵的傭兵資料
    for (var i = 0; i < plan.length && !fail; i++) {
      var e = plan[i], key = SAVE_PREFIX + e.slot;
      var obj = readWrapped(key);
      if (!obj || !obj.p) { fail = '第 ' + e.slot + ' 格讀取失敗(簽章不符?),已中止'; break; }
      var p = obj.p;
      p.enSeed = e.newSeed;
      p._roleEpoch = newEpoch();   // 世代一併換新:舊分頁若還開著,它會失去寫入權(正是我們要的)

      // 傭兵快照的 enSeed = 「來源角色」的身分碼;靠 ally._slot 判斷是哪一格,對得上才換。
      //   換掉才不會被 purgeReplacedAllies(js/06:423)判成「來源格換人了」而自動解散。
      if (Array.isArray(p.allies)) {
        p.allies.forEach(function (a) {
          if (!a || !a.enSeed) return;
          var src = bySlot[String(a._slot)];
          if (src && a.enSeed === src.oldSeed) a.enSeed = src.newSeed;
        });
      }
      // mercPrefs 以「來源角色身分碼」為鍵,但鍵本身不帶格號 → 撞號時分不出是哪一格。
      //   保守做法:同一組舊碼的設定複製給所有共用它的新碼(設定記憶是無害的偏好值,寧可多留)。
      if (p.mercPrefs && typeof p.mercPrefs === 'object') {
        var np = {};
        Object.keys(p.mercPrefs).forEach(function (k) {
          var group = byOldSeed[k];
          if (group) group.forEach(function (g) { np[g.newSeed] = p.mercPrefs[k]; });
          else np[k] = p.mercPrefs[k];
        });
        p.mercPrefs = np;
      }
      if (Array.isArray(p.mercLedgerOutbox)) {
        p.mercLedgerOutbox.forEach(function (r) {
          if (!r) return;
          var src = bySlot[String(r.slot)];
          if (src && r.enSeed === src.oldSeed) r.enSeed = src.newSeed;
        });
      }
      if (!writeWrapped(key, obj)) { fail = '第 ' + e.slot + ' 格寫入失敗(空間不足?),已中止'; break; }
      note('第 ' + e.slot + ' 格 ' + e.name + ' → ' + e.newSeed);
    }
    if (fail) return { ok: false, error: fail, steps: steps };

    // 2) 寵物名冊(一般 / 經典兩桶,各含匯入前備份)
    //    outOwner 判不出歸屬時一律收回(outOwner=null)——留著指向舊碼會被每一格都判成
    //    「其他角色出戰中」,連放生鈕與收回鈕都不顯示(js/22:1212),那是救不回來的死結。
    var petMoved = 0, petFreed = 0;
    [PET_ROSTER, PET_ROSTER + '_classic'].forEach(function (base) {
      [base, base + '_bak'].forEach(function (k) {
        var arr = readWrapped(k);
        if (!Array.isArray(arr)) return;
        var touched = false;
        arr.forEach(function (pet) {
          if (!pet || !pet.outOwner) return;
          var src = bySlot[String(pet.outSlot)];
          if (src && pet.outOwner === 'char:' + src.oldSeed) {
            pet.outOwner = 'char:' + src.newSeed; pet.outV = petStamp(); touched = true; petMoved++;
          } else {
            pet.outOwner = null; pet.outSlot = null; pet.outV = petStamp(); touched = true; petFreed++;
          }
        });
        if (touched && !writeWrapped(k, arr)) fail = fail || ('寵物名冊 ' + k + ' 寫入失敗');
      });
    });
    if (fail) return { ok: false, error: fail, steps: steps };
    if (petMoved || petFreed) {
      note('寵物歸屬:' + petMoved + ' 隻改掛新身分' + (petFreed ? '、' + petFreed + ' 隻判不出歸屬已收回' : ''));
    }

    // 3) 血盟:成員記錄與盟主 id 都是身分碼
    var st = readWrapped(CLAN_KEY);
    if (st && st.members && typeof st.members === 'object') {
      var nm = {}, moved = 0;
      Object.keys(st.members).forEach(function (id) {
        var e2 = claim[id];
        if (e2) { nm[e2.newSeed] = st.members[id]; moved++; } else { nm[id] = st.members[id]; }
      });
      st.members = nm;
      ['normal', 'classic'].forEach(function (m) {
        var info = st.modes && st.modes[m];
        if (info && info.leaderId && claim[info.leaderId]) info.leaderId = claim[info.leaderId].newSeed;
      });
      if (!writeWrapped(CLAN_KEY, st)) return { ok: false, error: '血盟資料寫入失敗', steps: steps };
      if (moved) note('血盟成員記錄:' + moved + ' 筆改掛新身分(貢獻度保留)');
    }

    // 4) 傭兵待領經驗帳本(無簽章包裝的純 JSON;有跨分頁鎖,拿得到就照規矩拿)
    try {
      var raw = _lzGet(MERC_KEY);
      if (raw) {
        var list = JSON.parse(raw), n = 0;
        if (Array.isArray(list)) {
          list.forEach(function (r) {
            if (!r) return;
            var src = bySlot[String(r.slot)];
            if (src && r.enSeed === src.oldSeed) { r.enSeed = src.newSeed; n++; }
          });
          var writeLedger = function () { _lzSet(MERC_KEY, JSON.stringify(list)); };
          if (typeof _mercLedgerLocked === 'function') { if (!_mercLedgerLocked(writeLedger)) writeLedger(); }
          else writeLedger();
          if (n) note('傭兵待領經驗:' + n + ' 筆改掛新身分');
        }
      }
    } catch (e) { note('⚠️ 傭兵帳本處理略過(' + (e.message || e) + '),不影響其他項'); }

    // 5) 對照表留檔(很小,事後查帳用)
    try {
      var log = { at: Date.now(), map: plan.map(function (e) { return { slot: e.slot, from: e.oldSeed, to: e.newSeed }; }) };
      localStorage.setItem(REISSUE_LOG_KEY, JSON.stringify(log));
    } catch (e) {}

    return { ok: true, steps: steps };
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  var modal = null, layer = null;

  function injectCss() {
    if (document.getElementById('m-rid-css')) return;
    var s = document.createElement('style');
    s.id = 'm-rid-css';
    s.textContent = [
      '#m-rid-modal{display:none;position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:1000;background:rgba(2,6,23,0.85);align-items:flex-start;justify-content:center;padding:24px 12px;font-family:system-ui,"Segoe UI",sans-serif;}',
      '#m-rid-modal.open{display:flex;}',
      '#m-rid-card{width:min(600px,96vw);max-height:calc(100dvh - var(--orig-bar-h,0px) - 48px);display:flex;flex-direction:column;background:#0f172a;border:1px solid #334155;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden;}',
      '#m-rid-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #1e293b;flex:0 0 auto;}',
      '#m-rid-title{font-size:16px;font-weight:bold;color:#fff;}',
      '#m-rid-close{width:34px;height:34px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;border-radius:8px;font-size:15px;cursor:pointer;line-height:1;}',
      '#m-rid-body{flex:1 1 auto;overflow-y:auto;padding:14px;color:#cbd5e1;font-size:13.5px;line-height:1.65;}',
      '#m-rid-foot{flex:0 0 auto;padding:12px 14px;border-top:1px solid #1e293b;display:flex;flex-direction:column;gap:10px;}',
      '.m-rid-h{color:#fcd34d;font-weight:bold;font-size:14px;margin:14px 0 6px;}',
      '.m-rid-h:first-child{margin-top:0;}',
      '.m-rid-box{background:#1e293b;border-radius:8px;padding:10px 12px;}',
      '.m-rid-warn{background:#3f1d1d;border:1px solid #7f1d1d;border-radius:8px;padding:10px 12px;color:#fecaca;}',
      '.m-rid-stop{background:#450a0a;border:2px solid #dc2626;border-radius:8px;padding:12px;color:#fee2e2;margin-bottom:4px;}',
      '.m-rid-stop b{color:#fca5a5;}',
      '.m-rid-type{color:#e2e8f0;font-size:13px;}',
      '.m-rid-type b{color:#fca5a5;font-family:ui-monospace,Consolas,monospace;}',
      '#m-rid-phrase{width:100%;margin-top:6px;padding:9px 10px;border:1px solid #475569;border-radius:8px;background:#0b1220;color:#e2e8f0;font-size:14px;}',
      '.m-rid-ok{background:#052e1a;border:1px solid #14532d;border-radius:8px;padding:10px 12px;color:#bbf7d0;}',
      '.m-rid-row{display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px solid #263449;}',
      '.m-rid-row:last-child{border-bottom:0;}',
      '.m-rid-seed{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;color:#94a3b8;}',
      '.m-rid-dup{color:#fca5a5;}',
      '.m-rid-chk{display:flex;align-items:flex-start;gap:9px;color:#e2e8f0;font-size:13px;cursor:pointer;}',
      '.m-rid-chk input{margin-top:3px;width:17px;height:17px;flex:0 0 auto;cursor:pointer;}',
      '#m-rid-go{width:100%;padding:11px;border:0;border-radius:8px;background:#b91c1c;color:#fff;font-size:14.5px;font-weight:bold;cursor:pointer;}',
      '#m-rid-go:disabled{background:#334155;color:#64748b;cursor:not-allowed;}',
      '#m-rid-ul{margin:0;padding-left:20px;}',
      '#m-rid-ul li{margin:4px 0;}'
    ].join('');
    document.head.appendChild(s);
  }

  function build() {
    injectCss();
    modal = document.createElement('div');
    modal.id = 'm-rid-modal';
    modal.innerHTML =
      '<div id="m-rid-card">' +
        '<div id="m-rid-head"><span id="m-rid-title">🆔 換發身分證</span>' +
        '<button id="m-rid-close" title="關閉">✕</button></div>' +
        '<div id="m-rid-body"></div>' +
        '<div id="m-rid-foot"></div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.getElementById('m-rid-close').addEventListener('click', close);
  }

  function hide() { if (modal) modal.classList.remove('open'); layer = null; }
  function close() { if (layer && window.AFK_UI) AFK_UI.closeLayer(layer); else hide(); }

  function open() {
    if (!modal) build();
    var body = document.getElementById('m-rid-body');
    var foot = document.getElementById('m-rid-foot');

    // 已載入角色時嚴禁執行:磁碟換新碼而記憶體還是舊碼 → 該格從此靜默存不進去。
    //   ⚠️ 核心是 `let player`(js/01:1264),let 宣告的全域「不會」掛上 window ——
    //      寫成 window.player 會恆為 undefined、這道保護等於沒有(測試抓到過)。一律用 typeof 判。
    if (typeof player !== 'undefined' && player && player.cls) {
      body.innerHTML = '<div class="m-rid-warn"><b>請先回到主選單再操作</b><br>' +
        '目前正在遊玩角色。換發身分證必須在「還沒載入任何角色」的狀態下進行,' +
        '否則這個角色的進度會從此存不進去。<br><br>請先回主選單(或重新整理頁面),再從設定選單開啟本功能。</div>';
      foot.innerHTML = '';
      show();
      return;
    }

    var plan = buildPlan();
    if (!plan.length) {
      body.innerHTML = '<div class="m-rid-box">目前沒有任何角色存檔,不需要換發。</div>';
      foot.innerHTML = '';
      show();
      return;
    }

    var dupCount = plan.filter(function (e) { return e.dup; }).length;
    var rows = plan.map(function (e) {
      return '<div class="m-rid-row"><span>第 ' + e.slot + ' 格　' + esc(e.name) + '</span>' +
        '<span class="m-rid-seed' + (e.dup ? ' m-rid-dup' : '') + '">' + esc(e.oldSeed) +
        (e.dup ? ' ⚠ 撞號' : '') + '</span></div>';
    }).join('');

    body.innerHTML =
      '<div class="m-rid-stop"><b>🛑 大部分玩家用不到這個功能,也不需要用。</b><br>' +
      '它會動到你<b>每一格</b>存檔,而且<b>沒有復原鈕</b>。只有在你曾經用匯出/匯入複製過角色、' +
      '而且正遇到下面其中一種狀況時才需要:<br>' +
      '<ul id="m-rid-ul"><li>匯入存檔時被擋下,出現「<b>相同角色已存在於存檔 N</b>」</li>' +
      '<li>寵物在不同角色之間互相搶,或是<b>放生鈕、收回鈕整個不見</b></li>' +
      '<li>血盟貢獻度、盟主身分好像和另一個角色<b>共用</b></li></ul>' +
      '沒有上述狀況的話,請直接關掉這個視窗,不要動它。</div>' +

      '<div class="m-rid-h">這是什麼</div>' +
      '<div class="m-rid-box">遊戲用一組看不見的「身分碼」分辨每個角色。用匯出/匯入複製出來的角色會共用同一組碼,' +
      '在遊戲眼中就是<b>同一個人</b>——寵物歸屬、血盟成員、傭兵都會互相打架,而且相同的存檔再也匯入不進來' +
      '(會出現「相同角色已存在」)。<br><br>本功能<b>把每一格都換發一組全新的身分碼</b>。換完之後:' +
      '<br>• 各格身分互相獨立,寵物/血盟/傭兵不再打架<br>' +
      '• 你手上的舊備份檔全部變成「陌生人」,<b>同一份存檔可以重複匯入成不同角色</b></div>' +

      '<div class="m-rid-h">目前狀況（' + plan.length + ' 個角色' +
        (dupCount ? '，其中 <span class="m-rid-dup">' + dupCount + ' 格身分碼重複</span>' : '') + '）</div>' +
      '<div class="m-rid-box">' + rows + '</div>' +

      '<div class="m-rid-h">⚠️ 換發後會有這些影響</div>' +
      '<div class="m-rid-warn"><ul id="m-rid-ul">' +
      '<li><b>寵物</b>——出戰中的寵物會跟著改掛到新身分,正常可用。但若名冊裡有<b>判斷不出屬於哪一格</b>的寵物,' +
      '會一律先<b>收回保管</b>(不會消失,自己重新出戰即可)。</li>' +
      '<li><b>血盟</b>——血盟本身、名稱、陣營、等級都不受影響,下次載入角色會自動重新加入。' +
      '但同一組舊碼被多格共用時,<b>成員記錄(含貢獻度)只會保留給格號最小的那一格</b>,其餘各格貢獻度從 0 開始' +
      '(貢獻度不足 5 點時開不了血盟 Buff,捐一點金幣就補回來)。<b>盟主身分</b>同樣只留給格號最小的那格。</li>' +
      '<li><b>傭兵</b>——招募中的傭兵會跟著改掛新身分,不會被解散;待領經驗紀錄也會一併轉過去。' +
      '少數對不上來源存檔位的舊傭兵仍可能在下次載入時自動解散(設定會被記住、經驗會結算)。</li>' +
      '<li><b>其他分頁</b>——如果你在別的分頁或另一台裝置開著同一個角色,那邊會停止寫入存檔' +
      '(這是刻意的保護)。換發後請把其他分頁全部關掉重開。</li>' +
      '<li><b>不受影響</b>——等級、裝備、背包、金幣、倉庫、收集冊、離線掛機紀錄完全不動。</li>' +
      '</ul></div>' +

      '<div class="m-rid-h">動手前請先備份</div>' +
      '<div class="m-rid-box">這個動作<b>沒有復原鈕</b>。請先回主選單用原本的<b>「匯出存檔」</b>把每一格都存成檔案再繼續。' +
      '<br>(換發後這些備份檔依然能匯入,而且會被當成全新的角色。)</div>';

    // 兩道閘(勾選已備份 + 手動打字)才解鎖。打字這關沿用上游刪角的作法(js/13:844 要求輸入角色名),
    //   目的就是讓「手滑點到」不可能執行到底。
    foot.innerHTML =
      '<label class="m-rid-chk"><input type="checkbox" id="m-rid-agree">' +
      '<span>我已經把要保留的存檔<b>匯出成檔案備份</b>了,並且看完了上面的影響說明。</span></label>' +
      '<div class="m-rid-type">確認執行請輸入 <b>' + esc(CONFIRM_PHRASE) + '</b>:' +
      '<input type="text" id="m-rid-phrase" autocomplete="off" spellcheck="false" placeholder="' + esc(CONFIRM_PHRASE) + '"></div>' +
      '<button id="m-rid-go" disabled>開始換發全部 ' + plan.length + ' 個角色的身分證</button>';

    var agree = document.getElementById('m-rid-agree');
    var phrase = document.getElementById('m-rid-phrase');
    var go = document.getElementById('m-rid-go');
    function sync() { go.disabled = !(agree.checked && phrase.value.trim() === CONFIRM_PHRASE); }
    agree.addEventListener('change', sync);
    phrase.addEventListener('input', sync);
    go.addEventListener('click', function () { confirmRun(plan); });
    show();
  }

  function show() {
    modal.classList.add('open');
    layer = window.AFK_UI ? AFK_UI.openLayer(hide) : null;   // 手機返回鍵 / ESC 可關
  }

  function confirmRun(plan) {
    var msg = '即將把 ' + plan.length + ' 個角色全部換發新的身分碼,' +
      '每一格存檔都會被改寫。\n\n這個動作沒有復原鈕,做完只能靠你剛剛匯出的備份檔還原。\n\n確定要繼續嗎?';
    var run = function () { doRun(plan); };
    if (window.AFK_UI && AFK_UI.confirm) {
      AFK_UI.confirm({ title: '最後確認', message: msg, okText: '確定換發', cancelText: '再想想', danger: true, onOk: run });
    } else if (window.confirm(msg)) { run(); }
  }

  function doRun(plan) {
    var body = document.getElementById('m-rid-body');
    var foot = document.getElementById('m-rid-foot');
    var r;
    try { r = reissue(plan); }
    catch (e) { r = { ok: false, error: '發生未預期錯誤:' + (e.message || e), steps: [] }; }

    var list = r.steps.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    if (r.ok) {
      body.innerHTML = '<div class="m-rid-ok"><b>✅ 換發完成</b><br>' +
        '所有角色都拿到新的身分碼了。你手上的舊備份檔現在可以直接匯入成不同角色。</div>' +
        '<div class="m-rid-h">做了這些</div><div class="m-rid-box"><ul id="m-rid-ul">' + list + '</ul></div>' +
        '<div class="m-rid-h">接下來</div><div class="m-rid-box">按下面的按鈕重新整理頁面讓變更生效。' +
        '若你有其他分頁開著這個遊戲,請一併關掉重開。</div>';
      foot.innerHTML = '<button id="m-rid-go">重新整理頁面</button>';
      document.getElementById('m-rid-go').addEventListener('click', function () { location.reload(); });
    } else {
      body.innerHTML = '<div class="m-rid-warn"><b>❌ 換發中止</b><br>' + esc(r.error) + '</div>' +
        (list ? '<div class="m-rid-h">中止前已完成的部分</div><div class="m-rid-box"><ul id="m-rid-ul">' + list + '</ul></div>' +
          '<div class="m-rid-warn">已完成的部分是有效的,但整體只做了一半。<b>請重新整理頁面後再執行一次</b>' +
          '(已換過的格會拿到再一組新碼,不影響正確性);若持續失敗,請用備份檔還原。</div>' : '');
      foot.innerHTML = '<button id="m-rid-go">重新整理頁面</button>';
      document.getElementById('m-rid-go').addEventListener('click', function () { location.reload(); });
    }
  }

  // ── 掛載 ──────────────────────────────────────────────────────────────────
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    if (typeof _lzGet !== 'function' || typeof _lzSet !== 'function' ||
        typeof _saveWrap !== 'function' || typeof _saveUnwrap !== 'function' ||
        typeof _seedHash !== 'function') {
      console.warn('[AFK-reissueid] 缺少核心存檔函式,已停用。');
      return;
    }
    if (window.AFK_TOGGLES) {
      AFK_TOGGLES.register({
        id: 'reissueid', name: '換發身分證', group: '存檔工具', def: true,
        desc: '⚠️ 進階工具,平常用不到。把所有角色的身分碼換新:讓複製出來的角色各自獨立,' +
          '舊備份檔也能重複匯入成不同角色。會改寫每一格存檔且無法復原,只在遇到「相同角色已存在」' +
          '或寵物/血盟互相打架時才需要。'
      });
    }
    window.AFK_SETTINGS = window.AFK_SETTINGS || { _items: [], add: function (it) { this._items.push(it); } };
    // 標籤就要看得出是危險工具:它跟同選單裡那些純唯讀的查看工具(存檔大小/掛機紀錄/快取診斷)
    //   不同,會實際改寫每一格存檔,不能長得像「點點看也沒差」。
    AFK_SETTINGS.add({ label: '🆔 換發身分證（進階·會改存檔）', onClick: open });
    console.log('[AFK-reissueid] hooks OK — 設定選單已加入「換發身分證」。');
  });
})();
