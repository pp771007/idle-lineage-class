/* ============================================================================
 * afk-wpnfix.js — 補上游漏掉的武器設定（說明有寫、資料沒實作的那種）
 *
 * 新武器的說明文字會列出特效（「切割；貫穿；弱點曝光…」），但真正讓特效生效的是
 * 物品資料上的欄位、以及 js/10 的武器分類表 `WEAPON_TAGS`。作者漏填時武器照樣能穿能打，
 * 只有那個特效安靜地不觸發——沒有錯誤訊息，玩家只覺得「這把怪怪的」。
 *
 * 本檔逐件補回「說明已經寫、資料卻沒有」的部分（2026-08-03 全武器掃過一輪，玩家回報三件）：
 *   飛翼的混沌雙刀   缺分類「雙刀」→ 出血精通不出血、雙刃 5%、黑妖雙重破壞、暗影套裝 3 件爆擊
 *                     全部不觸發，攻速還被當成雙手劍（雙擊照常，因為 comboRate 直接寫在資料上）
 *   猴子的金箍棒     缺分類「單手鈍器」→ 說明寫的鈍擊（命中後拖慢敵人出手 1 秒）不觸發（貫穿它本來就有，寫在物品資料上）
 *   烈炎燒灼的滾燙巨劍 缺 eff:'cleave' → 說明寫的切割（重擊後攻速 +20%）不觸發
 *
 * 一律「只在上游是空的時候才補」，作者哪天自己填了就原樣放行，不會蓋掉他的值、
 * 也不必回頭刪這支（自動讓路）。
 *
 * 另一類（2026-08-15 加）：**資料有、但程式碼那條路沒接上**——
 *   解除封印的巴風特魔杖「熾焰地裂術」的內建魔法傷害，沒有經過幻覺套裝的鉤子 illusionMagicDmg()，
 *   於是 2 件的回 MP、5 件的傷害加倍都吃不到。而幻覺套裝的說明就寫著「魔爆及**武器內建**／
 *   免費觸發魔法」，同一批的 spellProc / procSkill / 立方 / 魔爆 / 紅惡靈逆襲也全都接上了；
 *   上游刻意排除的三種（一般傷害法術／共鳴／反射）則是「有呼叫但傳 false」並附註解 → 這把是漏接。
 *   這一條外掛包不住（傷害在核心函式內部算完就直接扣血），走核心補丁 12 開一個鉤子回來問這支，
 *   本檔只回答「要不要修」＝同一個 wpnfix 開關。玩家關掉＝原版行為，不必重載頁面。
 *
 * 掛接：在 index.html 的 </body> 前 <script src="afk-wpnfix.js">。
 * ========================================================================== */
(function () {
  'use strict';

  // 分類表（js/10 WEAPON_TAGS）漏登記的
  var MISSING_TAGS = {
    relic_wing_chaos_blades: ['雙刀'],      // 飛翼的混沌雙刀（黑暗妖精遺物）
    relic_monkey_staff: ['單手鈍器']        // 猴子的金箍棒（說明就寫「單手鈍器。」）
  };
  // 物品資料漏填的欄位（值＝說明文字承諾的那個特效所需要的）
  var MISSING_FIELDS = {
    relic_scorch_greatsword: { eff: 'cleave' }    // 說明第一項就是「切割」
  };
  // ⚠ 金箍棒不必補貫穿：js/10 有條「所有鈍器/鋼爪都給 ignHardSkin」的批次規則是照分類表跑的，
  //   它沒分類本該漏掉，但作者在物品資料上直接寫了 ignHardSkin: true → 已經有了，別再補一次。

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'wpnfix', name: '補武器漏掉的特效', group: '遊戲玩法', def: true,
      desc: '幾把武器的說明有寫、原版卻沒生效的特效（切割、鈍擊、內建魔法沒吃到幻覺套裝…）補回來'
    });
  }
  function on() { try { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('wpnfix'); } catch (e) { return true; } }

  // 核心補丁 12 在巴風特杖的扣血點（玩家／傭兵）問這支：回 true 才讓那筆傷害走幻覺套裝的鉤子。
  // 每次觸發才問一次（巴風特杖 25%），成本可忽略；不快取才能即時反映開關。
  window.__afkIlluWpnFix = on;

  // ⚠ getWeaponTags 只有下面的分類補丁需要，缺了不能讓整支停掉——幻覺那條（上面的鉤子）跟它無關。
  if (typeof window.getWeaponTags === 'function') {
    var _orig = window.getWeaponTags;
    window.getWeaponTags = function (id) {
      var tags = _orig.apply(this, arguments);
      if (tags && tags.length) return tags;   // 上游有登記（含日後補上）→ 一律以上游為準
      var fix = on() ? MISSING_TAGS[id] : null;
      return fix || tags;                     // 回同一個陣列實例，與上游一致（呼叫端只讀不改）
    };
  } else {
    console.warn('[AFK-wpnfix] 找不到 getWeaponTags，武器分類補丁停用（其餘照常）。');
  }

  // 欄位型的補丁沒有「每次呼叫」的掛點，只能在載入時寫進 DB.items；
  // 玩家關掉這支要重載頁面才會退回原版（開關面板本來就要重載，與其他外掛一致）。
  var patched = 0;
  try {
    if (on() && typeof DB !== 'undefined' && DB.items) {
      for (var id in MISSING_FIELDS) {
        var d = DB.items[id]; if (!d) continue;
        var f = MISSING_FIELDS[id];
        for (var k in f) { if (!d[k]) { d[k] = f[k]; patched++; } }   // 上游已填就不動
      }
    }
    // 攻速家族(js/01 atkSpdFamily)會把結果快取在 d._spdFam；若在本檔載入前已被算過，
    // 那份是「沒有分類」時算出來的，要丟掉才會用補上的分類重算。
    if (typeof DB !== 'undefined' && DB.items) {
      for (var tid in MISSING_TAGS) { if (DB.items[tid]) delete DB.items[tid]._spdFam; }
    }
  } catch (e) {}

  console.log('[AFK-wpnfix] hooks OK — 補了 ' + Object.keys(MISSING_TAGS).length + ' 件武器的分類、' + patched + ' 個漏填欄位，幻覺套裝鉤子已就位。');
})();
