/* ============================================================================
 * afk-anyclass.js — 去除裝備的職業與性別限制（預設關）
 *
 * 開啟後:武器/防具/飾品(含遺物)一律不看職業與性別,任何角色都能裝
 *   (法師拿雙手劍、騎士拿弓、男角穿「冰之女王魅力禮服」…)。
 *
 * 作法:核心的裝備資格判定只有一個入口 —— js/08 的 checkCanEquip(裝備、背包紅底、
 *   物品視窗的「裝備」鈕、飾品商店清單、傭兵能不能穿隊長的裝備,全都問它)。本檔包住它,
 *   **只在它執行的那一瞬間**把兩道閘拿掉、跑完立刻還原:
 *     ① 職業:reqAllowsClass / darkEquipOk / royalEquipOk 一律放行
 *     ② 性別:把該件的 d.reqAvatar 暫時拿掉(核心是寫死在 checkCanEquip 裡的 if,沒有函式可換)
 *   這樣做的理由是**不重寫規則**:遺物、負重強化、劍術精通例外全部照作者原本的邏輯跑,
 *   上游改規則我們自動跟著改;我們只讓「職業」與「性別」那兩關永遠過。
 *   ⚠️ 反過來說,絕不可把 reqAllowsClass 永久換掉 —— 它同時管職業限定藥水(慎重/勇敢/精靈餅乾)
 *   與物品資訊框的「適用職業」圖示,永久換掉會連那些一起解除、資訊框也會變成全職業都能用。
 *   同理 d.reqAvatar 是 DB 共用資料,只在這一次呼叫內拿掉、finally 一定放回去。
 *
 * 已知的連帶效果(都是「同一個判定」的必然結果,不是 bug):
 *   ・飾品商店會列出原本職業不符而看不到的飾品(武器/防具本來就全列)。
 *   ・傭兵也能穿隊長給的跨職業裝備(核心用同一支 checkCanEquip 判隊員)。
 *   ・關掉本外掛後再讀檔,核心會把「現在穿不上的」自動卸回背包(作者原本就有的機制,
 *     訊息寫的是「因負重強化改版」;裝備只是回背包,不會消失)。
 *
 * 另補兩處「裝得上卻沒作用」——穿戴限制一解除就會浮現,兩處都跟著本開關走:
 *   ① 真夏納變身的跨職業武器速度(見下方 patchTrueShanna)
 *   ② 死靈之書的骷髏復生(見下方 patchNecroBook)
 *
 * 掛接:在 index.html 的 </body> 前 <script src="afk-anyclass.js">。
 * ========================================================================== */
(function () {
  'use strict';

  // ⚠️ 這支預設「關」,所以讀不到 AFK_TOGGLES 時要當**關閉**——不可沿用其他外掛那條
  //    「讀不到就當開啟」(那是給預設開的外掛用的,套在這裡會變成沒有開關就自動改動遊戲規則)。
  function on() { return !!(window.AFK_TOGGLES && AFK_TOGGLES.enabled('anyclass')); }

  // 職業那幾關(js/08):checkCanEquip 執行期間暫時一律放行;不在的就跳過(上游改名不會壞)
  var CLASS_GATES = ['reqAllowsClass', 'darkEquipOk', 'royalEquipOk'];
  function pass() { return true; }

  function init() {
    if (typeof window.checkCanEquip !== 'function') {
      console.warn('[AFK-anyclass] 找不到核心 checkCanEquip,裝備職業限制解除停用。');
      return;
    }
    var origCheck = window.checkCanEquip;
    window.checkCanEquip = function (item) {
      if (!on()) return origCheck.apply(this, arguments);
      var saved = [];
      CLASS_GATES.forEach(function (n) {
        if (typeof window[n] !== 'function') return;
        saved.push([n, window[n]]);
        window[n] = pass;
      });
      // 性別那關寫死在 checkCanEquip 內,沒有函式可換 → 只好把這一件的 reqAvatar 暫時拿掉
      //    ⚠️ DB 是 `const DB`(js/00),**不會**掛上 window → 只能 `typeof DB` 探,寫 window.DB 一律 undefined
      //       (踩過:寫成 window.DB 時整段安靜不生效,職業解除了、性別那 4 件還是穿不上)
      var d = null, avatarReq;
      try { d = (item && typeof DB !== 'undefined' && DB.items) ? DB.items[item.id] : null; } catch (e) {}
      if (d && d.reqAvatar) { avatarReq = d.reqAvatar; d.reqAvatar = ''; }
      try { return origCheck.apply(this, arguments); }
      finally {   // 一定還原,原函式丟例外也一樣
        saved.forEach(function (kv) { window[kv[0]] = kv[1]; });
        if (avatarReq !== undefined) d.reqAvatar = avatarReq;
      }
    };

    patchTrueShanna();
    patchNecroBook();
    console.log('[AFK-anyclass] hooks OK — 裝備職業/性別限制解除（預設關，於外掛開關面板開啟）。');
  }

  // ── 真夏納變身:跨職業武器也要有攻速/硬直 ────────────────────────────────
  // 核心的真夏納速度表是「逐職業一份」,而每一份只列**那個職業原本能用的武器種類**
  //   (js/02 SHANNA_APM_PROFILES:原版拿不到魔杖的職業,那份就沒有魔杖)。
  //   本外掛讓他拿得到之後,那個組合在核心眼中是不存在的 → apm/hitstun 回 null →
  //   變身資訊連「攻擊間隔」「受擊硬直」兩行都不顯示,退回角色自己的速度(當時實測拿魔杖
  //   每分 51.4 下,而長劍是 124 下),看起來就像沒拿武器(玩家回報)。
  //
  // 補法:只在原函式「查不到值」時,改用核心自己那張全職業共用的逐武器表 TRUE_SHANNA_APM 補上,
  //   硬直與走速的算式原封不動抄核心同一行 —— 等於把「可用武器家族」那道閘打開,速度數值仍由核心決定。
  //   ⚠️ 這會改到平衡(拿魔杖 51.4→124),所以跟著 anyclass 這個開關走:關掉就完全是原版。
  //   ⚠️ TRUE_SHANNA_APM / SHANNA_DAGGER_LONG_HITSTUN 都是 `const`,**不在 window 上**(同 DB/player),
  //      一律用 typeof 探,寫 window.X 會安靜失效。
  function patchTrueShanna() {
    if (typeof window.trueShannaSpeedForActor !== 'function' || window.trueShannaSpeedForActor.__afkAnyClass) return;
    if (typeof TRUE_SHANNA_APM === 'undefined') {
      console.warn('[AFK-anyclass] 找不到真夏納速度表，跨職業武器的變身速度維持原版（其餘功能不受影響）。');
      return;
    }
    var origTS = window.trueShannaSpeedForActor;
    window.trueShannaSpeedForActor = function () {
      var r = origTS.apply(this, arguments);
      if (!on() || !r || r.apm != null) return r;          // 沒開／本來就查得到 → 原樣
      var fam = r.family;
      if (!fam || TRUE_SHANNA_APM[fam] == null) return r;   // 空手、或連核心那張表都沒有的家族 → 維持原版
      r.apm = TRUE_SHANNA_APM[fam];
      var longStun = (typeof SHANNA_DAGGER_LONG_HITSTUN !== 'undefined') && SHANNA_DAGGER_LONG_HITSTUN.has(r.avatar);
      r.hitstun = (fam === '匕首' && longStun) ? 2.6 : 2.1;   // 抄 js/02 同一行
      r.wlk = (fam === '單手劍') ? 15 : 16;                   // 抄 js/02 同一行
      return r;
    };
    window.trueShannaSpeedForActor.__afkAnyClass = true;
  }

  // ── 死靈之書:跨職業也能喚起骷髏 ──────────────────────────────────────────
  // 核心把「骷髏復生」綁在造屍術(sk_zombie)身上——死靈之書只是把那個技能改寫成擊殺觸發
  //   (js/07 的 castSkill 直接 return、不施法不耗 MP),所以 js/23 necroBookPassiveEnabled
  //   除了「裝著書」還要求「學過造屍術」與「造屍術那一列的自動有勾」。
  //   而造屍術是**六階**法師魔法(js/00 tier:6),依 js/01 skillReqLv 只有法師(Lv24)與
  //   妖精(Lv48)學得到——王族只能學一/二階(魔法精通再開到三~五階)、騎士/黑暗妖精
  //   也各自沒有 → 他們裝上書只有「擊殺全隊回 1%」那半段有效
  //   (那段只看有沒有裝),骷髏永遠不會出現(玩家回報)。
  //
  // 補法同 checkCanEquip:只在 necroBookPassiveEnabled 執行的那一瞬間放行那兩支、跑完還原,
  //   「活著沒」「有沒有裝書」仍由核心自己判;骷髏的階級/數值/上限/清除也全部沒動。
  //   ⚠️ **已經學過造屍術的一律照原本規則走**:他技能面板上有那一列勾選框,關掉是他的意思,
  //      硬開回來等於搶走玩家的控制。沒學過的職業面板上根本沒那一列可勾 → 只能「裝上書＝開」,
  //      卸下書或關掉本外掛,核心 necroSkeletonTick 自己會把骷髏收掉。
  //   ⚠️ 這會改到平衡(王族等職業多了六隻骷髏),所以跟著 anyclass 開關走:關掉就完全是原版。
  var NECRO_GATES = ['_necroKnows', '_necroAutoEnabled'];

  function patchNecroBook() {
    if (typeof window.necroBookPassiveEnabled !== 'function' || window.necroBookPassiveEnabled.__afkAnyClass) return;
    var missing = NECRO_GATES.filter(function (n) { return typeof window[n] !== 'function'; });
    if (missing.length) {
      console.warn('[AFK-anyclass] 找不到核心 ' + missing.join('／') + '，跨職業的骷髏復生停用（其餘功能不受影響）。');
      return;
    }
    var origPassive = window.necroBookPassiveEnabled;
    var origKnows = window._necroKnows;   // 先留原函式參照:下面會暫時把 window._necroKnows 換掉
    window.necroBookPassiveEnabled = function (owner) {
      var r = origPassive.apply(this, arguments);
      if (r || !on() || origKnows(owner)) return r;   // 本來就成立／沒開／學得會 → 原樣
      var saved = [];
      NECRO_GATES.forEach(function (n) { saved.push([n, window[n]]); window[n] = pass; });
      try { return origPassive.apply(this, arguments); }
      finally { saved.forEach(function (kv) { window[kv[0]] = kv[1]; }); }
    };
    window.necroBookPassiveEnabled.__afkAnyClass = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
