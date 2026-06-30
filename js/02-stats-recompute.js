function recomputeStats() {
    let p = player, d = p.d, b = p.base, a = p.alloc;
    if (typeof p.lv === 'number') p.lv = Math.max(1, Math.min(100, Math.floor(p.lv) || 1));   // 🛡️ 等級硬夾 [1,100]：即時中和「改 player.lv」的外掛，避免職業成長值被放大

    // 先把「上一輪由裝備授予的技能」從技能欄移除（卸下裝備時生效）；sk_helm_* 玩家無法學習，不會誤刪已學技能
    if (player.grantedSkills && player.grantedSkills.length) {
        player.skills = player.skills.filter(s => !player.grantedSkills.includes(s));
    }
    player.grantedSkills = [];
    // ===== Phase 0：基礎屬性 + 衍生欄位歸零（依基本設定，起始值0；AC起始10）=====
    let pn = player.panacea || {};
    d.str = b.str + a.str + (pn.str||0); d.dex = b.dex + a.dex + (pn.dex||0); d.con = b.con + a.con + (pn.con||0); d.int = b.int + a.int + (pn.int||0); d.wis = b.wis + a.wis + (pn.wis||0);
    d.cha = (b.cha || 0) + (a.cha || 0) + (pn.cha||0);   // 魅力：第六屬性（配點＋萬能藥本就≤60；裝備／buff 可突破 60）

    d.ac = 10; d.er = 0; d.dr = 0;
    d.meleeDmg = 0; d.meleeHit = 0; d.meleeCrit = 0;
    d.rangedDmg = 0; d.rangedHit = 0; d.rangedCrit = 0;
    d.extraDmg = 0; d.extraHit = 0; d.equipExtraAtk = 0;   // 🐉 d.equipExtraAtk：裝備授予的額外一般攻擊次數（龍鱗臂甲）
    d.magicDmg = 0; d.magicHit = 0; d.magicCrit = 0; d.extraMp = 0; d.mpReduce = 0;
    let _baseCritDmg = (p.cls === 'dark') ? 100 : 50;   // 🔧 黑暗妖精基礎爆擊傷害 100%（其餘職業 50%）；裝備/精通等加成於其上疊加
    d.meleeCritDmg = _baseCritDmg; d.rangedCritDmg = _baseCritDmg; d.magicCritDmg = _baseCritDmg;
    d.resFire = 0; d.resWater = 0; d.resEarth = 0; d.resWind = 0;
    d.immStone = false;      // 免疫石化（紅騎士盾牌）
    d.immPoison = false;     // 免疫中毒/猛毒/麻痺（潔尼斯戒指）
    d.magicDrNonEle = 0;     // 無屬性魔法傷害減免 %（紅騎士盾牌）

    // ===== Phase 1：先把所有「屬性(STR/DEX/INT/CON/WIS)」來源加總完畢 =====
    // 【修正】裝備與增益提供的屬性，必須在換算戰鬥數值「之前」全部計入，
    //         否則屬性數字會變，但近/遠/魔法傷害·命中·爆擊·AC·ER·HP·MP 不會跟著變。
    if (p.eq.wpn) { let w = DB.items[p.eq.wpn.id]; if (w.str) d.str += w.str; if (w.dex) d.dex += w.dex; if (w.int) d.int += w.int; if (w.con) d.con += w.con; if (w.wis) d.wis += w.wis; if (w.cha) d.cha += w.cha; }   // 🔧 與防具迴圈一致讀取六項屬性（含魅力 cha）
    for (let k in p.eq) {
        let e = p.eq[k];
        if (!e || k === 'wpn') continue;
        let ed = DB.items[e.id];
        if (ed.str) d.str += ed.str;
        if (ed.dex) d.dex += ed.dex;
        if (ed.int) d.int += ed.int;
        if (ed.con) d.con += ed.con;
        if (ed.wis) d.wis += ed.wis;
        if (ed.cha) d.cha += ed.cha;   // 🔧 裝備魅力(cha)：可突破 60 上限
    }
    // 👑 同名 buff 去重（頭盔版「力盔/敏盔」優先，蓋掉法師魔法版／王族魔法精通版，避免同效果疊加）：頭盔版生效時把對應法師版 buff 歸零
    if (p.buffs.sk_helm_str1 > 0) p.buffs.sk_ench_wpn = 0;   // 擬似魔法武器（extraDmg）
    if (p.buffs.sk_helm_dex1 > 0) p.buffs.sk_dex_up = 0;     // 通暢氣脈術（dex）
    if (p.buffs.sk_helm_str2 > 0) p.buffs.sk_reveal = 0;     // 無所遁形術
    for (let k in p.buffs) {
        if (p.buffs[k] > 0 && DB.skills[k] && DB.skills[k].d) {
            let bd = DB.skills[k].d;
            if (bd.str) d.str += bd.str;   // 體魄強健術
            if (bd.dex) d.dex += bd.dex;   // 通暢氣脈術
            if (bd.int) d.int += bd.int;
            if (bd.con) d.con += bd.con;
            if (bd.wis) d.wis += bd.wis;   // 淨化精神
            if (bd.cha) d.cha += bd.cha;   // 🔧 魅力增益(cha)
        }
    }

    // ❄️ 套裝「屬性」加成提前套用：力量/體質須在 Phase 2 換算近傷/HP 之前計入，才會實際吃進戰鬥與 HP；其餘 flat 加成（AC/HP+100/恢復/抗性）仍於 Phase 3 套裝段套用。
    { let _setEarly = {}, _ssEarly = {};
      for (let _k in p.eq) { let _e = p.eq[_k]; if (!_e || _k === 'wpn' || _k === 'offwpn') continue; let _ed = DB.items[_e.id]; if (_ed && _ed.set && !_ssEarly[_e.id]) { _ssEarly[_e.id] = true; _setEarly[_ed.set] = (_setEarly[_ed.set] || 0) + 1; } }
      if (_setEarly['icequeen_charm'] >= 3) { d.str += 2; d.cha += 2; }   // 冰之女王魅力：力量+2/魅力+2（提前→力量實際吃近距傷害/命中/爆擊）
      if (_setEarly['frost'] >= 3) { d.con += 3; }                         // 寒冰：體質+3（提前→實際吃 HP 與 HP 自然恢復上限）
      if (_setEarly['orin'] >= 2) { d.str += 1; d.dex += 1; d.con += 1; d.int += 1; d.wis += 1; d.cha += 1; }   // 🔱 歐林西瑪：全六屬性+1（提前→實際吃進 AC/MR/HP/MP/近遠傷害/命中/爆擊等衍生值，否則只改顯示數字不入戰鬥）
      if (_setEarly['darkelf'] >= 3) { d.str -= 2; d.dex += 2; }   // 🏝️ 黑暗妖精：力量-2/敏捷+2（提前→敏捷實際吃 AC/迴避/遠距傷害命中、力量實際吃近距傷害命中，否則只改顯示數字不入戰鬥）
      if (_setEarly['bluepirate'] >= 4) { d.int += 1; }   // 🏴‍☠️ 藍海賊套裝：智力+1（提前→吃進 MP/魔法；AC-1/HP+10 flat 於 Phase 3 套裝段）
    }
    // 🦻 詛咒耳環套裝：淨化之耳環 + 對應色詛咒耳環 同時裝備 → 屬性提前套用（吃進近/遠/魔/HP/MP 等衍生值）
    { let _eqHas = id => Object.values(p.eq).some(e => e && e.id === id);
      if (_eqHas('acc_purify_earring')) {
          if (_eqHas('acc_curse_red'))   { d.str += 2; d.con -= 2; }
          if (_eqHas('acc_curse_blue'))  { d.int += 2; d.wis -= 2; }
          if (_eqHas('acc_curse_green')) { d.dex += 2; d.cha -= 2; }
      }
    }
    // 🪆 魔法娃娃全收集：裝備收集冊 doll 部位全收集(50 隻) → 六維各 +1（提前套用→吃進 AC/HP/MP/近遠魔傷害/命中/爆擊等衍生值；受下方 80 上限夾擠）。
    //    收集判定走 player.equipDex(共用桶)；recomputeStats 只對玩家執行(p 恆＝player)，傭兵不走此路徑故不吃。label 由 js/16 EQUIP_CAT_BONUS.doll 顯示。
    if (typeof equipCatComplete === 'function' && equipCatComplete('doll')) { d.str += 1; d.dex += 1; d.con += 1; d.int += 1; d.wis += 1; d.cha += 1; }

    // 🎯 六維屬性效果上限 80：效果表(getStr/Dex/Int/Con/Wis... 系列)最高只設定到 80，超過 80 無對應能力。
    //    故在此(Phase 1 加總完、Phase 2 換算前)把最終屬性夾擠至 ≤80：
    //    ① 讓 HP/MP 線性成長(getConGrowth/getWisGrowth·原本無上限)亦止於 80；② 資訊欄(讀 d.str)顯示不超過 80，避免玩家誤會配更高有加成。
    //    註：只夾「衍生最終值 d.*」，不動 player.base/alloc/panacea(原始配點保留、可回憶蠟燭退還)；各效果自身更低的內部上限(ER封60/MpReduce封45/MR封60)不受影響。
    { let _ATTR_CAP = 80;
      d.str = Math.min(_ATTR_CAP, d.str); d.dex = Math.min(_ATTR_CAP, d.dex); d.int = Math.min(_ATTR_CAP, d.int);
      d.con = Math.min(_ATTR_CAP, d.con); d.wis = Math.min(_ATTR_CAP, d.wis); d.cha = Math.min(_ATTR_CAP, d.cha); }

    // ===== Phase 2：依「最終屬性」一次性換算所有衍生戰鬥數值 =====
    // 職業基礎 MR 與 等級成長
    if (p.cls === 'knight') {
        d.mr = 0;
        d.ac -= Math.floor(p.lv / 6);          // 每提升6 AC-1
        d.mr += Math.floor(p.lv / 12);         // 每提升12 MR+1
        d.meleeDmg += Math.floor(p.lv / 4);    // 每提升4 近距離傷害+1
        d.rangedDmg += Math.floor(p.lv / 10);  // 每提升10 遠距離傷害+1
        d.extraHit += Math.floor(p.lv / 3);    // 每提升3 額外命中+1
        d.er += Math.floor(p.lv / 4);          // 每提升4 ER+1
    } else if (p.cls === 'elf') {
        d.mr = 25;
        d.ac -= Math.floor(p.lv / 7);          // 每提升7 AC-1
        d.mr += Math.floor(p.lv / 3);          // 每提升3 MR+1
        d.rangedDmg += Math.floor(p.lv / 4);   // 每提升4 遠距離傷害+1
        d.meleeDmg += Math.floor(p.lv / 7);    // 每提升7 近距離傷害+1
        d.extraHit += Math.floor(p.lv / 5);    // 每提升5 額外命中+1
        d.er += Math.floor(p.lv / 6);          // 每提升6 ER+1
    } else if (p.cls === 'dark') {             // 黑暗妖精
        d.mr = 10;                             // 基本 MR = 10
        d.ac -= Math.floor(p.lv / 6);          // 每提升6 AC-1
        d.mr += Math.floor(p.lv / 2);          // 每提升2 MR+1
        d.er += Math.floor(p.lv / 4);          // 每提升4 ER+1
        d.meleeDmg += Math.floor(p.lv / 5);    // 每提升5 近距離傷害+1
        d.rangedDmg += Math.floor(p.lv / 8);   // 每提升8 遠距離傷害+1
        d.extraHit += Math.floor(p.lv / 3);    // 每提升3 額外命中+1（額外命中＝近+遠命中，對近/遠攻擊皆生效）
    } else if (p.cls === 'illusion') {         // 幻術士
        d.mr = 20;                             // 基本 MR = 20
        d.ac -= Math.floor(p.lv / 7);          // 每提升7 AC-1
        d.mr += Math.floor(p.lv / 2);          // 每提升2 MR+1
        d.er += Math.floor(p.lv / 4);          // 每提升4 ER+1
        d.extraDmg += Math.floor(p.lv / 5);    // 每提升5 額外傷害+1
        d.extraHit += Math.floor(p.lv / 5);    // 每提升5 額外命中+1
    } else if (p.cls === 'dragon') {           // 龍騎士
        d.mr = 18;                             // 基本 MR = 18
        d.ac -= Math.floor(p.lv / 7);          // 每提升7 AC-1
        d.mr += Math.floor(p.lv / 2);          // 每提升2 MR+1
        d.er += Math.floor(p.lv / 4);          // 每提升4 ER+1
        d.extraDmg += Math.floor(p.lv / 3);    // 每提升3 額外傷害+1
        d.extraHit += Math.floor(p.lv / 3);    // 每提升3 額外命中+1
    } else if (p.cls === 'warrior') {          // ⚔️ 戰士
        d.mr = 0;                              // 基本 MR = 0
        d.ac -= Math.floor(p.lv / 8);          // 每提升8 AC-1
        d.mr += Math.floor(p.lv / 10);         // 每提升10 MR+1
        d.er += Math.floor(p.lv / 4);          // 每提升4 ER+1
        d.extraDmg += Math.floor(p.lv / 4);    // 每提升4 額外傷害+1
        d.extraHit += Math.floor(p.lv / 3);    // 每提升3 額外命中+1
    } else if (p.cls === 'royal') {            // 👑 王族
        d.mr = 10;                             // 基本 MR = 10
        d.ac -= Math.floor(p.lv / 7);          // 每提升7 AC-1
        d.mr += Math.floor(p.lv / 2);          // 每提升2 MR+1
        d.er += Math.floor(p.lv / 8);          // 每提升8 ER+1
        d.extraDmg += Math.floor(p.lv / 5);    // 每提升5 額外傷害+1
        d.extraHit += Math.floor(p.lv / 4);    // 每提升4 額外命中+1
    } else { // mage
        d.mr = 15;
        d.ac -= Math.floor(p.lv / 8);          // 每提升8 AC-1
        d.mr += Math.floor(p.lv / 8);          // 每提升8 MR+1
        d.er += Math.floor(p.lv / 10);         // 每提升10 ER+1
    }

    // 力量（近距離）
    d.meleeDmg  += getStrMeleeDmg(d.str);
    d.meleeHit  += getStrMeleeHit(d.str);
    d.meleeCrit += getStrMeleeCrit(d.str);
    // 敏捷（遠距離 / AC / ER）
    d.rangedDmg  += getDexRangedDmg(d.dex);
    d.rangedHit  += getDexRangedHit(d.dex);
    d.rangedCrit += getDexRangedCrit(d.dex);
    d.ac += getDexAC(d.dex);
    d.er += getDexER(d.dex);
    if (player.cls === 'dark') { d.meleeCrit += 3; d.rangedCrit += 3; }   // 🔧 黑暗妖精職業天賦：Lv1 起基礎近/遠爆擊率各 +3%
    if (hasMastery('d_crit')) { d.meleeCrit += 3; d.rangedCrit += 3; }   // 🔧 黑暗妖精爆擊精通：近/遠爆擊率各 +3%
    if (hasMastery('d_evade')) d.er += (p._darkEvadeStack || 0);   // 🔧 迴避精通：受擊累積的 ER（觸發迴避時清空）
    // 智力（魔法）
    d.magicDmg  += getIntMagicDmg(d.int);
    d.magicHit  += getIntMagicHit(d.int);
    d.magicCrit += getIntMagicCrit(d.int);
    d.extraMp   += getIntExtraMp(d.int);
    d.mpReduce  += getIntMpReduce(d.int);
    // 精神（MR / MP恢復）
    d.mr  += getWisMR(d.wis);
    if (p.skills && p.skills.includes('sk_royal_kingguard')) d.mr += 10;   // 👑 王者加護（被動）：MR+10
    d.mpR  = getWisMpRegen(d.wis);
    d.hpR  = 0;   // HP自然恢復量(裝備/精靈斗篷加成)：每次重算先歸零，避免持續疊加且卸下不還原
    // 體質（HP自然恢復量上限）
    d.hpRegenMax = getConHpRegenMax(d.con);

    // MP消耗（技能實際消耗 = ceil(原始 x (1 - MP消耗減少)) ）
    d.getMpCost = function(baseMp, tier) {
        let c = Math.max(1, Math.ceil(baseMp * (1 - d.mpReduce / 100)));
        if (p._setApprentice5 && p.mp < p.mmp * 0.3) c = Math.max(1, Math.ceil(c / 2));   // 🔮 學徒 5/5：MP 低於最大值 30% 時，所有技能耗魔減半
        if (p.mastery === 'i_mana') c *= 2;   // 🔮 魔力精通：所有技能MP消耗加倍（與 MP 上限加倍配套）
        return c;
    };

    // HP / MP（職業等級1基礎 + (等級-1) x (職業加成 + 屬性加成)，依最終 CON / WIS）
    let hpBase   = p.cls === 'knight' ? 16 : (p.cls === 'elf' ? 15 : (p.cls === 'dark' ? 12 : (p.cls === 'illusion' ? 14 : (p.cls === 'dragon' ? 16 : (p.cls === 'warrior' ? 16 : (p.cls === 'royal' ? 14 : 12))))));
    let hpClsInc = p.cls === 'knight' ? 8.5 : (p.cls === 'elf' ? 7.3 : (p.cls === 'dark' ? 10.5 : (p.cls === 'illusion' ? 7.5 : (p.cls === 'dragon' ? 4.5 : (p.cls === 'warrior' ? 9 : (p.cls === 'royal' ? 10 : 4.3))))));
    let conInc   = getConGrowth(d.con, p.cls);
    p.mhp = hpBase + (p.lv - 1) * (hpClsInc + conInc);   // 小數隱藏不捨去（顯示時取floor）

    let mpBase   = p.cls === 'knight' ? 1 : (p.cls === 'elf' ? 5 : (p.cls === 'dark' ? 3 : (p.cls === 'illusion' ? 5 : (p.cls === 'dragon' ? 2 : (p.cls === 'warrior' ? 1 : (p.cls === 'royal' ? 2 : 6))))));
    let mpClsInc = p.cls === 'knight' ? 1 : (p.cls === 'elf' ? 2.83 : (p.cls === 'dark' ? 3 : (p.cls === 'illusion' ? 3.2 : (p.cls === 'dragon' ? 0.7 : (p.cls === 'warrior' ? 0.5 : (p.cls === 'royal' ? 1.5 : 4.5))))));
    let wisInc   = getWisGrowth(d.wis);
    p.mmp = mpBase + (p.lv - 1) * (mpClsInc + wisInc);

    d.aspd = 1.0;

    // ===== Phase 3：非屬性加成（武器傷害 / 裝備防禦 / 套裝 / 增益 / 變身） =====
    // 武器：依遠近距離分別計入（w.str 已於 Phase 1 計入屬性）
    if (p.eq.wpn) {
        let w = DB.items[p.eq.wpn.id];
        let isRanged = !!w.ranged;
        let _enW = enhanceWpnBonus(p.eq.wpn.en);   // 🔧 武器強化固定加成（傷害每階+1延伸到+20、命中+1~+10後依表續加）
        // 武器自身固定傷害/命中：只加武器本身的攻擊類型（近戰武器→近距離、遠程武器→遠距離）
        if (isRanged) { d.rangedDmg += (w.dmgBonus||0); d.rangedHit += (w.hit||0); }
        else { d.meleeDmg += (w.dmgBonus||0); d.meleeHit += (w.hit||0); }
        // 🔧 武器「強化」固定加成：近距離與遠距離 傷害＋命中 同時各加（每強化+1→四者各+1）。⚠️ 與「最終傷害倍率」wpnEnFinalMult 各自獨立疊加（依使用者指定·+20 武器明顯變強）
        d.meleeDmg += _enW.dmg; d.rangedDmg += _enW.dmg;
        d.meleeHit += _enW.hit; d.rangedHit += _enW.hit;
        d.aspd = w.spd;
        if(w.mdmg) d.magicDmg += w.mdmg;
        if(w.mpR) d.mpR += w.mpR;
        if(w.hpR) d.hpR += w.hpR;   // 🗡️ 武器 HP 自然恢復量加成/扣減（血紅慾望短劍 HP自然恢復 -3）
        if(w.mhp) p.mhp += w.mhp;   // 🏛️ 武器 HP 上限加成（古代黑暗妖精之劍 HP+50；同步修正深紅長矛既有 HP+50 失效）
        if(w.mmp) p.mmp += w.mmp;   // 🏛️ 武器 MP 上限加成（聖晶魔杖 MP+50；防具/飾品 mmp 走另一迴圈·武器需此處）
        let _wEn = capWpnEn(p.eq.wpn.en);   // 🔧 超過 +20 一律以 +20 計算所有隨強化提升的能力
        if(w.mpROverSafe && _wEn > (w.safe || 0)) d.mpR += (_wEn - (w.safe || 0)) * w.mpROverSafe;   // 突破安定值：每超過1階，MP自然恢復量 +mpROverSafe
        if(w.extraMpPerEn)  d.extraMp  += _wEn * w.extraMpPerEn;    // 每強化+1 → 額外魔法點數
        if(w.meleeHitPerEn) d.meleeHit += _wEn * w.meleeHitPerEn;   // 每強化+1 → 近距離命中
        if(w.mpRPerEn)      d.mpR      += _wEn * w.mpRPerEn;        // 🔮 每強化+1 → MP自然恢復量（冥想奇古獸）
        if(w.mdmgEnFrom7Max3) d.magicDmg += Math.min(3, Math.max(0, _wEn - 6));   // 🔧 巴風特魔杖：強化+7 魔法傷害+1，之後每+1再+1，最高+3
        // 武器祝福/遠古：依規格計入（同時影響遠近距離）
        // 祝福的武器：額外傷害+1、額外魔法點數+2、額外命中+1
        applyBlessStats(d, p.eq.wpn.bless, 'wpn');   // 祝福的/詛咒的
        // 遠古武器：額外傷害+2、魔法傷害+1
        applyAncStats(d, p.eq.wpn.anc, 'wpn');   // 遠古系變體能力
		
    }

    // ⚔️ 迅猛雙斧副手武器：祝福/遠古比照主武器計入 global d（與其他裝備一致疊加；玩家＋傭兵 buildAlly 換身共用本函式）。屬性詞綴走 getPhysicalDmg 副手揮擊（用 offwpn 自身屬性）
    if (p.eq.offwpn) { applyBlessStats(d, p.eq.offwpn.bless, 'wpn'); applyAncStats(d, p.eq.offwpn.anc, 'wpn'); }

    let setCheck = {}, _setSeen = {};
    p._equipHaste = false;   // 裝備常駐加速（如伊娃之盾）：每次重算先清除，卸下即消失（同 _setPoly 模式）
    if (p.eq.wpn) { let _hw = DB.items[p.eq.wpn.id]; if (_hw && (_hw.eff === 'haste' || _hw.equipHaste)) p._equipHaste = true; }   // 🔧 武器常駐加速（惡魔之劍 eff:haste／惡魔雙刀·鋼爪·十字弓 equipHaste）
    for (let k in p.eq) {
        let e = p.eq[k];
        if (!e || k === 'wpn' || k === 'offwpn') continue;   // ⚔️ offwpn=副手武器：不走防具/飾品加成（只作第二攻擊來源，stats 不重複計）
        let ed = DB.items[e.id];
        d.ac -= (ed.ac||0);   // 基礎 AC（防具/飾品皆套用）
        if (ed.type === 'arm' && !ed.armguard) d.ac -= enhanceArmAc(e.en);   // 🔧 防具強化AC（+11~+15分段；🛡️ 臂甲不吃此AC，強化改為加 HP）
        else if (ed.type === 'acc') {   // 🔧 飾品強化（上限+5）：戒指 每+1 AC-1；項鍊 每+1 MR+3；腰帶 每+1 負重上限+20（於負重系統計算）
            let _ae = Math.min(e.en || 0, 5);
            if (ed.slot === 'ring') d.ac -= _ae;
            else if (ed.slot === 'amulet') d.mr += _ae * 3;
            else if (ed.slot === 'ear') d.mr += _ae * 2;   // 🦻 耳環：每強化 +1 → MR +2（上限 +5）
        }
        // 計算防具的基礎 MR 與強化的額外 MR 加成
let baseMr = ed.mr || 0;
let bonusMr = (ed.mrPerEn || 0) * capEn(e.en, ed);   // 🔧 超過上限以上限計算（防具+15/飾品+5）
d.mr += (baseMr + bonusMr);
        if(ed.mdmgEnFrom4) d.magicDmg += Math.min(6, Math.max(0, capEn(e.en, ed) - 3));   // 🧙 巫妖斗篷：強化+4 魔法傷害+1，之後每+1再+1，最高 +9（魔法傷害 +6）；+10 以上不再增加
        if(ed.mdmgEnFrom7Max3) d.magicDmg += Math.min(3, Math.max(0, capEn(e.en, ed) - 6));   // 🔧 巴風特魔杖：強化+7 魔法傷害+1，之後每+1再+1，最高+3
        if(ed.mdmg) d.magicDmg += ed.mdmg;   // 🔧 飾品/防具的固定魔法傷害（如底比斯賀洛斯戒指 mdmg:2）；武器的 mdmg 走武器區塊(4143)，此迴圈已 skip wpn 故不重複
        // ed.str/dex/int/con/wis 已於 Phase 1 計入屬性
        if(ed.mhp) p.mhp += ed.mhp;
        if(ed.mmp) p.mmp += ed.mmp;
        if(ed.mpR) d.mpR += ed.mpR;
		if(ed.hpR) d.hpR += ed.hpR;
        if(ed.resFire)  d.resFire  += ed.resFire;
        if(ed.resWater) d.resWater += ed.resWater;
        if(ed.resEarth) d.resEarth += ed.resEarth;
        if(ed.resWind)  d.resWind  += ed.resWind;
        // 防具/飾品的命中與傷害加成（如腕甲 rangedHit）
        if(ed.meleeHit)  d.meleeHit  += ed.meleeHit;
        if(ed.rangedHit) d.rangedHit += ed.rangedHit;
        if(ed.meleeDmg)  d.meleeDmg  += ed.meleeDmg;
        if(ed.rangedDmg) d.rangedDmg += ed.rangedDmg;
        if(ed.extraHit)  d.extraHit  += ed.extraHit;          // 🐉 裝備額外命中（龍鱗臂甲 +2）
        if(ed.extraDmg)  d.extraDmg  += ed.extraDmg;          // 🐉 裝備額外傷害
        if(ed.magicHit)  d.magicHit  += ed.magicHit;          // 🪆 裝備固定魔法命中（魔法娃娃：墮落/巴風特）
        if(ed.er)        d.er         += ed.er;                // 🪆 裝備固定 ER（魔法娃娃：飛龍/吸血鬼/林德拜爾）
        if(ed.extraMp)   d.extraMp    += ed.extraMp;          // 🪆 裝備固定額外魔法點數（魔法娃娃：思克巴女皇）
        if(ed.extraAtk)  d.equipExtraAtk += ed.extraAtk;      // 🐉 裝備額外一般攻擊次數（龍鱗臂甲 +1）
        if(ed.immStone) d.immStone = true;                    // 紅騎士盾牌：免疫石化
        if(ed.immPoison) d.immPoison = true;                  // 潔尼斯戒指：免疫中毒/猛毒/麻痺
        if(ed.magicDrNonEle) d.magicDrNonEle += ed.magicDrNonEle; // 紅騎士盾牌：無屬性魔法減傷
        if(ed.dr) d.dr += ed.dr;   // 🛡️ 防具/飾品固定傷害減免（信念之盾 +2、巴風特盔甲 +2）
        // 🛡️ 臂甲（副手）：每強化+1 → HP+10；門檻特效（達 +5/+7/+9 套用對應階、取最高階、非累加）
        if(ed.armguard) {
            let _agEn = capEn(e.en, ed);
            p.mhp += _agEn * 10;
            let _ag = ed.armguard;
            let _agV = (_ag.base || 0) + (_agEn >= 9 ? _ag.th[2] : _agEn >= 7 ? _ag.th[1] : _agEn >= 5 ? _ag.th[0] : 0);
            if(_agV) { if(_ag.stat === 'dr') d.dr += _agV; else if(_ag.stat === 'magicDmg') d.magicDmg += _agV; else if(_ag.stat === 'mhp') p.mhp += _agV; else if(_ag.stat === 'rangedDmg') d.rangedDmg += _agV; else if(_ag.stat === 'meleeDmg') d.meleeDmg += _agV; }
        }
        if((ed.eff && ed.eff === 'haste') || ed.equipHaste) p._equipHaste = true;   // 不再借用 buffs.haste 計時通道，避免卸裝後永久加速殘留；🔧 equipHaste：eff 已被 combo/連射等佔用時仍可賦予加速
        
        // 祝福的：防具→AC-1、傷害減免+1；飾品→AC-1、MR+1
        applyBlessStats(d, e.bless, (ed.slot==='ring'||ed.slot==='amulet'||ed.slot==='belt'||ed.slot==='ear') ? 'acc' : 'arm');   // 祝福的/詛咒的
        applyAncStats(d, e.anc, (ed.slot==='ring'||ed.slot==='amulet'||ed.slot==='belt'||ed.slot==='ear') ? 'acc' : 'arm');   // 遠古系變體能力
        // 屬性詞綴（防具/飾品）：對應元素抗性 + MR，依階級 1/2/3
        let _aAff = getAttrAffix(e.attr);
        if(_aAff) {
            if(_aAff.ele === 'fire')  d.resFire  += _aAff.res;
            else if(_aAff.ele === 'water') d.resWater += _aAff.res;
            else if(_aAff.ele === 'wind')  d.resWind  += _aAff.res;
            else if(_aAff.ele === 'earth') d.resEarth += _aAff.res;
            d.mr += _aAff.mr;
        }
        if(ed.set && !_setSeen[e.id]) { _setSeen[e.id] = true; setCheck[ed.set] = (setCheck[ed.set]||0) + 1; }   // 🔧 以「不重複物品」計件：兩枚同款戒指只算 1 件，杜絕灌水湊套裝
        
        // 🔧 架構#4：移除 ed.skAdd 死碼 —— 全資料庫無任何物品使用此欄位，且其語意（永久寫入 player.skills、
        // 卸裝不回收）與 grantSkills（每次重算先回收、卸裝即消失）矛盾，留著只會誘發未來的 bug。授予技能一律走 grantSkills。
        if (ed.grantSkills) {
            ed.grantSkills.forEach(sk => {
                if (!player.grantedSkills.includes(sk)) player.grantedSkills.push(sk);
                if (!player.skills.includes(sk)) player.skills.push(sk);
            });
        }
    
        // ===== 妖精專屬裝備隱藏效果 =====
        if (player.cls === 'elf') {
            if (e.id === 'shd_elf') {
                d.mr += 5; // 精靈盾牌：妖精裝備時額外 MR+5
            }
            if (e.id === 'clk_elf') {
                d.hpR = (d.hpR || 0) + 1; 
            }
        }
    }
    
    // 騎士／王族／戰士：背包中持有的魔法頭盔也授予技能（擁有即可、不需裝備；背包與裝備都沒有對應頭盔時技能才會消失）
    if (p.cls === 'knight' || p.cls === 'royal' || p.cls === 'warrior') {
        (p.inv || []).forEach(it => {
            let _gd = DB.items[it.id];
            if (_gd && _gd.grantSkills) {
                _gd.grantSkills.forEach(sk => {
                    if (!player.grantedSkills.includes(sk)) player.grantedSkills.push(sk);
                    if (!player.skills.includes(sk)) player.skills.push(sk);
                });
            }
        });
    }
    p._setPoly = null;   // 套裝變身僅在穿著時生效；每次重算先清除，卸下套裝即消失
    if(setCheck['leather'] >= 4) { d.ac -= 3; }   // 皮套裝（原作未實作，依 DB.sets 補上）
    if(setCheck['bone'] >= 3) { d.ac -= 2; p.mhp += 10; }
    if(setCheck['dk'] >= 4) { d.ac -= 4; p._setPoly = Object.assign({}, SET_POLY_FORMS.dk); }   // 🔧 死亡騎士套裝：變身升級為 真‧死亡騎士
    if(setCheck['silver'] >= 4) { d.ac -= 3; }
    if(setCheck['oasis'] >= 4) { d.ac -= 3; }
    if(setCheck['gnome'] >= 3) { d.ac -= 1; p.mhp += 5; }
    if(setCheck['mage'] >= 2) { p.mmp += 50; }
    if(setCheck['kurt'] >= 4) { d.ac -= 4; p._setPoly = Object.assign({}, SET_POLY_FORMS.kurt); }   // 🔧 克特套裝：變身升級為 真‧克特
    if(setCheck['steel'] >= 5) { d.ac -= 2; d.dr += 2; }
    if(setCheck['mr'] >= 3) { d.mr += 5; }
    if(setCheck['guard'] >= 3) { d.ac -= 1; }
    if(setCheck['kinglord'] >= 4) { p.mhp += 30; p.mmp += 30; d.hpR += 10; d.mpR += 10; d.cha += 3; }   // 🔧 四大軍王套裝：HP/MP+30、HP/MP自然恢復+10、魅力+3
    if(setCheck['demon'] >= 4) { d.ac -= 2; d.hpR += 5; p._setPoly = Object.assign({}, SET_POLY_FORMS.demon); }   // 🗼 惡魔套裝：AC-2、HP自然恢復+5、變身惡魔（額外傷害/命中/魔法傷害/MP/攻速由變身提供）
    if(setCheck['darkelf'] >= 3) { d.ac -= 3; d.hpR -= 2; d.mpR -= 7; p._setPoly = Object.assign({}, SET_POLY_FORMS.darkelf); }   // 🏝️ 黑暗妖精套裝：AC-3、HP自然恢復-2、MP自然恢復-7、變身高等黑暗精靈（遠距離傷害/命中+5、攻速+30%）（力量-2/敏捷+2 已於 Phase 1 前 _setEarly 提前套用→吃進近/遠戰鬥值）
    if(setCheck['orin'] >= 2) { d.ac -= 5; p.mhp += 50; }   // 🔱 歐林西瑪套裝：AC-5、HP+50（全六屬性+1 已於 Phase 1 前 _setEarly 提前套用→吃進 AC/MR/HP/MP/傷害等衍生值）
    if(setCheck['icequeen_charm'] >= 3) { d.ac -= 5; p.mhp += 100; d.mpR += 4; d.resWater += 20; }   // ❄️👸 冰之女王魅力套裝（公主限定）：AC-5、HP+100、MP自然恢復+4、水屬性抗性+20（力量+2/魅力+2 已於 Phase 1 前提前套用）
    if(setCheck['frost'] >= 3) { d.ac -= 5; p.mhp += 100; d.hpR += 8; d.mpR += 4; d.mr += 15; d.resWater += 20; }   // ❄️ 寒冰套裝（王族／龍騎士）：AC-5、HP+100、HP自然恢復+8、MP自然恢復+4、MR+15、水屬性抗性+20（體質+3 已於 Phase 1 前提前套用）
    if(setCheck['bluepirate'] >= 4) { d.ac -= 1; p.mhp += 10; }   // 🏴‍☠️ 藍海賊套裝（頭巾＋皮盔甲＋手套＋長靴）：AC-1、HP+10（智力+1 已於 Phase 1 前提前套用）

    // ===== 🔮 席琳套裝效果：以「相同套裝名、不同部位」的件數計（同名不同部位即累計；不再要求五種不同詞綴）=====
    // 同步寫入傭兵快照：buildAlly 換身重算時 p=ally，旗標自然存於傭兵物件上
    let _shSets = {};
    for (let k in p.eq) {
        let e = p.eq[k];
        if (e && e.seteff) { let g = e.seteff.slice(0, 2); _shSets[g] = (_shSets[g] || 0) + 1; }   // 計件＝帶該套裝名的「部位數」（每個裝備欄各算一件）
    }
    let _shN = (g) => (_shSets[g] || 0);
    p._sherineSetCnt = {};   // 🔮 各組件數（部位數）：供狀態面板（n/5 徽章）與裝備欄底色判定使用
    for (let g in _shSets) p._sherineSetCnt[g] = _shSets[g];
    if (_shN('紅獅') >= 2) { d.extraDmg += 5; d.extraMp += 3; }
    if (_shN('紅獅') >= 3) { d.dr += 10; }
    p._setRedLion5 = _shN('紅獅') >= 5;          // 最終傷害 +20%（普攻於 getPhysicalDmg、技能於 castSkill、各 proc 套用）
    if (_shN('白鳥') >= 2) { d.extraHit += 5; }
    if (_shN('白鳥') >= 3) { d.cha += 10; }   // 白鳥3件：魅力+10（可突破 60 上限）
    p._setWhiteBird5 = _shN('白鳥') >= 5;        // 一般攻擊命中附加「脆弱」3 秒
    if (_shN('鐵衛') >= 2) { d.ac -= 3; d.dr += 5; }
    p._setIron3 = _shN('鐵衛') >= 3;             // 受到傷害 −20%（受擊時·乘算）
    p._setIron5 = _shN('鐵衛') >= 5;             // 🔧 受到傷害時，額外對全體敵人造成一次必中的一般攻擊（受擊處觸發）
    if (_shN('麗人') >= 2) { d.meleeDmg += 3; d.meleeHit += 3; }
    if (_shN('麗人') >= 3) { d.meleeCrit += 3; }
    p._setBeauty5 = _shN('麗人') >= 5;           // 🔧 每次攻擊未命中→額外命中+10可堆疊，直到一次物理命中歸零（getPhysicalDmg）
    if (!p._setBeauty5) p._beautyMissStack = 0;  // 卸下套裝即清未命中堆疊
    if (_shN('疾風') >= 2) { d.rangedDmg += 3; d.rangedHit += 3; }
    if (_shN('疾風') >= 3) { d.rangedCrit += 3; }
    p._setGale5 = _shN('疾風') >= 5;             // 連射傷害 30%→80%
    if (_shN('月光') >= 2) { d.extraDmg += 2; d.extraHit += 3; }
    if (_shN('月光') >= 3) { d.er += 5; d.mr += 10; }
    p._setMoon5 = _shN('月光') >= 5;             // ER 可迴避魔法（applyMobMagic 套用）
    if (_shN('學徒') >= 2) { d.mpR += 5; d.extraMp += 6; }
    if (_shN('學徒') >= 3) { d.magicCrit += 3; }
    p._setApprentice5 = _shN('學徒') >= 5;       // MP<30% 時技能耗魔減半（getMpCost 套用）
    if (_shN('魔女') >= 2) { d.magicDmg += 3; }
    if (_shN('魔女') >= 3) { d.resWater += 10; d.extraMp += 5; }
    p._setWitch5 = _shN('魔女') >= 5;            // 🔧 每 5 次共鳴 → 免費冰雪暴（冰雪颶風風暴傷害·不受法師階級加成）
    if (!p._setWitch5) p._witchResCnt = 0;       // 卸下套裝即重置共鳴計數
    if (_shN('暗影') >= 2) { d.extraDmg += 7; }   // 🔧 暗影 2/5：額外傷害+7
    p._setShadow3 = _shN('暗影') >= 3;            // 🔧 暗影 3/5：觸發迴避時恢復 2% HP（迴避處套用）
    p._setShadow5 = _shN('暗影') >= 5;            // 🔧 暗影 5/5：雙擊額外攻擊傷害加倍（×2·procCombo/allyComboAttack 套用）
    // 🔮 幻覺：2件 魔傷命中回「Lv/10」MP；3件 輔助技耗MP-50%；5件 敵人受非自動攻擊魔法傷害再受一次同傷（不再觸發套裝效果）
    p._setIllusion2 = _shN('幻覺') >= 2;
    p._setIllusion3 = _shN('幻覺') >= 3;
    p._setIllusion5 = _shN('幻覺') >= 5;
    // 🐉 龍血：2件 造物理傷害吸血1%(自身HP<50%→5%)；3件 放HP消耗技得「龍裔」10秒受傷-15%；5件 HP消耗技傷害+20%
    p._setDragonblood2 = _shN('龍血') >= 2;
    p._setDragonblood3 = _shN('龍血') >= 3;
    p._setDragonblood5 = _shN('龍血') >= 5;
    // 😡 狂怒：2件 負重+500（負重段）、3件 最大HP+20%（HP段）皆於下方以 _shN('狂怒') 套用；5件 血量每少10%造傷+4%/受傷-4%(最多±20%)
    p._setFury5 = _shN('狂怒') >= 5;

    // 🎴 卡片收集：各地區「完成」加成（HP/MP/抗性/負重等；只取該區最高已達階；weight 累積到 d._cardWeightBonus 供下方負重段）
    if (typeof cardCollectionBonus === 'function') cardCollectionBonus(p, d);
    // 🗡️ 裝備收集冊：各部位「全收集」加成（HP/MP/傷害減免/MR/恢復/ER/AC/負重/夥伴命中；weight→d._equipWeightBonus 供下方負重段、petHit→p._equipPetHit 供 petGearBonus）
    if (typeof equipCollectionBonus === 'function') equipCollectionBonus(p, d);
    // 🧰 道具收集冊：各類「全收集」加成（藥水/卷軸→負重、技能書→MP恢復、材料/其他→藥水恢復%；weight→d._miscWeightBonus 供負重段、potion→p._miscPotionBonus 供 js/08）
    if (typeof miscCollectionBonus === 'function') miscCollectionBonus(p, d);

    // 🏅 生存精通：MR+15（藥水恢復 +25% 於 useItem 套用）
    if (p.mastery === 'k_survive') d.mr += 15;
    if (player.skills.includes('sk_warrior_crush')) d.meleeDmg += 2 + Math.max(0, p.lv - 44);   // ⚔️ 粉碎：近距離傷害+2；玩家等級45起每升一級+1
    
    let spdMult = 1.0;
    if(p.buffs.haste > 0 || p._equipHaste) spdMult *= 0.67;   // 自我加速 / 加速 / 裝備常駐加速 +33%
    if(p.buffs.brave > 0) spdMult *= 0.67;   // 勇敢藥水 +33%
    if(p.buffs.elfcookie > 0) spdMult *= 0.85; // 精靈餅乾 +15%
    if(p.buffs.sk_dark_walkhaste > 0) spdMult *= 0.85; // 🔧 行走加速：攻速+15%（與加速術等相乘疊加）
    { let _clvW = p.eq.wpn ? DB.items[p.eq.wpn.id] : null; let _clvOn = !p.classicMode && ((p.statuses && p.statuses.cleave > 0) || (p.mastery === 'k_cleave' && _clvW && _clvW.eff === 'cleave')); if(_clvOn) spdMult *= (p.mastery === 'k_cleave' ? 0.50 : 0.80); }   // 切割：攻速+20%（🏅 切割精通：+50%・持切割武器常駐），與其他加速相乘疊加；🎮 經典模式停用
    { let _swMelee = p.eq.wpn ? DB.items[p.eq.wpn.id] : null; if(p.mastery === 'e_sword' && _swMelee && !_swMelee.w2h && !_swMelee.isBow && !_swMelee.ranged) spdMult *= (1/1.5); }   // 🏅 劍術精通：持單手近戰武器攻速+50%（與加速/勇敢/餅乾/變身相乘疊加）
    { let _aw = p.eq.wpn ? getWeaponTags(p.eq.wpn.id) : []; let _ow = p.eq.offwpn ? getWeaponTags(p.eq.offwpn.id) : []; if(p.mastery === 'k_giantaxe' && (_aw.includes('雙手鈍器') || _ow.includes('雙手鈍器'))) spdMult *= (1/1.3); else if(p.mastery === 'k_dualaxe' && _aw.includes('單手鈍器') && p.eq.offwpn && _ow.includes('單手鈍器')) spdMult *= (1/1.3); }   // ⚔️ 巨斧精通(主手或副手任一持雙手鈍器·符合「持雙手鈍器+30%」描述·含混裝)／雙斧精通(主副手皆單手鈍器)：攻速+30%
    { let _rw = p.eq.wpn ? getWeaponTags(p.eq.wpn.id) : []; if(p.mastery === 'k_royal_sword' && (_rw.includes('單手劍') || _rw.includes('雙手劍'))) spdMult *= (1/1.5); }   // 👑 劍術精通：裝單手劍／雙手劍攻速+50%
    { let _iw = p.eq.wpn ? DB.items[p.eq.wpn.id] : null; if(p.cls === 'illusion' && _iw && !_iw.isBow && ((p.mastery === 'i_qigu' && _iw.qigu) || (p.mastery === 'i_magicsword' && !_iw.qigu && !isWandWeapon(_iw)))) spdMult *= (1/1.3); }   // 🔮 奇古獸精通(裝奇古獸)／魔劍精通(裝非奇古獸·排除魔杖)：攻速+30%
    if(p.buffs.blue > 0) d.mpR += getWisBlueBonus(d.wis);          // 藍色藥水：依精神提升MP恢復
    if(p.buffs.cautious > 0) { d.magicDmg += 2; d.mpR += 2; }      // 慎重藥水
    if(p.buffs.sk_reduction_armor > 0) d.dr += Math.floor(p.lv/10);   // 增幅防禦：等同傷害減免 floor(等級/10)，併入 DR 顯示與計算
    if(p.statuses && p.statuses.evilAura > 0) { d.ac += 10; d.er -= 10; }   // 🔧 邪靈之氣減益：AC+10、ER−10（持續6秒，由黑暗精靈使施放）
    
    // 技能buff（非屬性部分；STR/DEX/INT/CON/WIS 已於 Phase 1 計入）
    // meleeDmg/meleeHit -> 近距離；rangedDmg/rangedHit -> 遠距離（彼此獨立，依武器種類生效）
    for(let k in p.buffs) {
        if(p.buffs[k] > 0 && DB.skills[k] && DB.skills[k].d) {
            let bd = DB.skills[k].d;
            if(bd.meleeDmg) d.meleeDmg += bd.meleeDmg;
            if(bd.meleeHit) d.meleeHit += bd.meleeHit;
            if(bd.rangedDmg) d.rangedDmg += bd.rangedDmg;
            if(bd.rangedHit) d.rangedHit += bd.rangedHit;
            if(bd.extraDmg) d.extraDmg += bd.extraDmg;
            if(bd.extraHit) d.extraHit += bd.extraHit;
            if(bd.magicDmg) d.magicDmg += bd.magicDmg;
            if(bd.ac) d.ac -= bd.ac;
            if(bd.er) d.er += bd.er;
            if(bd.mpR) d.mpR += bd.mpR;
            if(bd.dr) d.dr += bd.dr;
            if(bd.mr) d.mr += bd.mr;
            if(bd.resFire)  d.resFire  += bd.resFire;
            if(bd.resWater) d.resWater += bd.resWater;
            if(bd.resEarth) d.resEarth += bd.resEarth;
            if(bd.resWind)  d.resWind  += bd.resWind;
        }
    }

    // 單屬性防禦：所選屬性抗性 +50
    if(p.buffs.sk_elf_singleres > 0 && p.elfEle) {
        if(p.elfEle === 'fire')  d.resFire  += 50;
        if(p.elfEle === 'water') d.resWater += 50;
        if(p.elfEle === 'earth') d.resEarth += 50;
        if(p.elfEle === 'wind')  d.resWind  += 50;
    }

    // 變身：套裝變身（_setPoly，僅穿著套裝時生效、卸下立即消失）優先於藥水變身（buffs.poly 計時）
    let _polyForm = p._setPoly || ((p.buffs.poly > 0 && p.poly) ? p.poly : null);
    if(_polyForm) {
        let pf = _polyForm;
        d.meleeDmg  += (pf.md  || 0); d.meleeHit  += (pf.mh || 0);   // 近距離傷害 / 命中
        d.rangedDmg += (pf.rd  || 0); d.rangedHit += (pf.rh || 0);   // 遠距離傷害 / 命中
        d.extraDmg  += (pf.ed  || 0); d.extraHit  += (pf.eh || 0);   // 額外傷害 / 命中
        d.magicDmg  += (pf.mgd || 0);                                // 魔法傷害
        d.extraMp   += (pf.sp  || 0);                                // 額外魔法點數
        d.mpR       += (pf.mpr || 0);                                // MP 自然恢復量
        d.ac        += (pf.ac  || 0);                                // AC（規格 AC-1 以 ac:-1 表示）
        d.er        += (pf.er  || 0);                                // ER
        d.mr        += (pf.mr  || 0);                                // MR
        if(pf.spd) spdMult *= (1 - pf.spd/100);                      // 攻速加快%（與藥水/餅乾相乘疊加）
    }
    
    if(p.buffs.sk_soul_up > 0) { p.mhp = Math.floor(p.mhp * 1.2); p.mmp = Math.floor(p.mmp * 1.2); }
    if (player.skills.includes('sk_warrior_armorbody')) d.dr += Math.floor((10 - d.ac) / (hasMastery('k_tough') ? 5 : 10));   // ⚔️ 護甲身軀：傷害減免 +[(10-AC)/10]；🏅 堅韌精通改 /5
    if (p.buffs.sk_warrior_endurance > 0) p.mhp = Math.floor(p.mhp * (1 + (p.lv / 2) / 100));   // ⚔️ 體能強化：HP上限 +(等級/2)%
    if (_shN('狂怒') >= 3) p.mhp = Math.floor(p.mhp * 1.2);   // 😡 狂怒 3/5：最大HP +20%（於各 flat HP 加成後套用）
    if(p.mastery === 'i_mana') p.mmp = Math.floor(p.mmp * 2);   // 🔮 魔力精通：MP 上限加倍（耗魔亦加倍，見 getMpCost）
    // 盟主的祝福（8 小時，存檔保留、死亡清空）：依到期時間判斷是否生效
    if(p.blessings) {
        let _now = Date.now();
        if(p.blessings.precise > _now) d.extraHit += 3;                    // 精準目標
        if(p.blessings.blaze   > _now) { d.hpR += 15; d.mpR += 3; }        // 灼熱靈氣
        if(p.blessings.brave   > _now) { d.extraDmg += 3; d.extraMp += 6; }// 勇敢靈氣
        if(p.blessings.support > _now) d.dr += 3;                          // 援護盟友
    }

    // 🐉 龍騎士 覺醒（安塔瑞斯/法利昂/巴拉卡斯）：d:{} 內的 AC/抗性/屬性/額外命中已由上方 buff 迴圈套用；此處補非標準效果與攻速
    {
        let _awakenOn = false;
        if(p.buffs.sk_dragon_awaken_antares > 0) { _awakenOn = true; d.immPoison = true; p.mhp += 2 * p.lv; }   // 安塔瑞斯：免疫中毒與麻痺、HP+(2×等級)
        if(p.buffs.sk_dragon_awaken_falion > 0)  { _awakenOn = true; d.mr = Math.floor(d.mr * 1.15); }          // 法利昂：MR+15%
        if(p.buffs.sk_dragon_awaken_baraka > 0)  { _awakenOn = true; }                                          // 巴拉卡斯：屬性/額外命中已由 buff 迴圈套用
        if(_awakenOn) spdMult *= (p.mastery === 'k_awaken' ? (1/1.5) : (1/1.2));   // 覺醒攻速：🏅覺醒精通+50%、否則+20%（不疊加；多覺醒只算一次）
    }
    if(p.buffs.sk_dragon_bloodlust > 0) spdMult *= 0.85;   // 🐉 血之渴望：攻速+15%（與加速/覺醒/變身相乘疊加）
    d.spdMult = spdMult;   // 速度倍率（受加速/勇敢藥水/精靈餅乾/變身影響），供自動施法間隔使用
    d.aspd = d.aspd * spdMult;

    // ===== 🔧 負重系統：上限=(floor((3力+2體)/5)+1)×50；腰帶/負重強化提供額外上限；依%套用攻速懲罰 =====
    {
        let _wbase = (Math.floor((3 * d.str + 2 * d.con) / 5) + 1) * 50;
        let _cap = 0, _cur = 0;
        for (let _k of WEIGHT_COUNT_SLOTS) {
            let _it = p.eq && p.eq[_k]; if (!_it) continue;
            let _ed = DB.items[_it.id]; if (!_ed) continue;
            _cur += (ITEM_WEIGHTS[_ed.n] || 0);
            if (_ed.weightCap) _cap += _ed.weightCap;
            if (_ed.slot === 'belt') _cap += Math.min(_it.en || 0, 5) * 20;   // 🔧 腰帶強化：每+1 負重上限+20
        }
        if (p.buffs && p.buffs.sk_load_up > 0) _cap += 50;   // 負重強化增益：負重上限 +50
        if (d._cardWeightBonus) _cap += d._cardWeightBonus;   // 🎴 卡片收集：風木/奇岩完成 → 負重上限加成
        if (d._equipWeightBonus) _cap += d._equipWeightBonus;   // 🗡️ 裝備收集冊：單手/雙手鈍器/臂甲/腰帶部位全收集 → 負重上限加成
        if (d._miscWeightBonus) _cap += d._miscWeightBonus;   // 🧰 道具收集冊：藥水/卷軸類全收集 → 負重上限加成
        if (_shN('狂怒') >= 2) _cap += 500;   // 😡 狂怒 2/5：負重上限 +500
        let _limit = _wbase + _cap;
        let _pct = _limit > 0 ? Math.floor(_cur / _limit * 100) : 999;
        let _tier = _pct <= 49 ? 0 : (_pct <= 81 ? 1 : (_pct <= 99 ? 2 : 3));
        d.weightCur = _cur; d.weightLimit = _limit; d.weightPct = _pct; d.loadTier = _tier;
        if (_tier === 2) d.aspd = d.aspd * 2;        // 82~99%：攻擊速度 -100%（間隔×2）
        else if (_tier === 3) d.aspd = d.aspd * 3;   // 100%+：攻擊速度 -200%（間隔×3）
    }

    p.hp = Math.min(p.hp, p.mhp);
    p.mp = Math.min(p.mp, p.mmp);
}

function calcStats() {   // 🔧 架構#4：對外介面不變（重算 + UI 刷新）
    recomputeStats();
    applyElfBorder();
    updateUI();
    applyDollCursor();   // 🪆 魔法娃娃：依 eq.doll 更新滑鼠游標（裝/卸/載入都會經過 calcStats）
}
// 🪆 娃娃游標點擊熱點光點：在滑鼠座標(＝cursor hotspot 4,4，點擊實際發生處)顯示淡淡圓點光；顏色＝娃娃名稱顏色。
let _dollGlow = null, _dollGlowColorCache = {};
function _dollNameColor(cls) {   // Tailwind 文字色 class → 實際 rgb（快取；供 currentColor 用）
    cls = cls || 'text-slate-200';
    if (_dollGlowColorCache[cls]) return _dollGlowColorCache[cls];
    let e = document.createElement('span'); e.className = cls; e.style.cssText = 'position:absolute;left:-9999px;top:-9999px;opacity:0;pointer-events:none;';
    document.body.appendChild(e); let c = getComputedStyle(e).color || 'rgb(226,232,240)'; document.body.removeChild(e);
    _dollGlowColorCache[cls] = c; return c;
}
function _ensureDollGlow() {   // 單例：建立光點 div＋掛 mousemove/mouseleave（只掛一次）
    if (_dollGlow || typeof document === 'undefined' || !document.body) return _dollGlow;
    _dollGlow = document.createElement('div'); _dollGlow.id = 'doll-cursor-glow'; _dollGlow.classList.add('offscreen');   // 起始隱藏，待首次移動才現身（不在 0,0 閃一下）
    document.body.appendChild(_dollGlow);
    document.addEventListener('mousemove', function (ev) {
        if (!_dollGlow.classList.contains('active')) return;   // 未裝娃娃：零成本略過
        _dollGlow.style.left = ev.clientX + 'px'; _dollGlow.style.top = ev.clientY + 'px';
        if (_dollGlow.classList.contains('offscreen')) _dollGlow.classList.remove('offscreen');
    }, { passive: true });
    document.addEventListener('mouseleave', function () { if (_dollGlow) _dollGlow.classList.add('offscreen'); }, { passive: true });   // 滑鼠離開視窗：隱藏，避免光點卡在邊緣
    return _dollGlow;
}
// 🪆 魔法娃娃：裝備 slot:doll 時把滑鼠游標換成 assets/doll/<物品名稱>.png（可用 d.dollImg 自訂圖名）；未裝則回預設。游標圖需 ≤32×32 否則瀏覽器忽略→fallback auto
function applyDollCursor() {
    if (typeof document === 'undefined' || !document.body) return;
    let e = player && player.eq && player.eq.doll;
    let ed = e ? DB.items[e.id] : null;
    if (ed) {
        let img = ed.dollImg || ed.n;
        document.body.style.cursor = "url('assets/doll/" + img + ".png') 4 4, auto";
        document.body.classList.add('has-doll-cursor');     // 🪆 連可點擊處也套娃娃游標（見 css：body.has-doll-cursor *）
        let glow = _ensureDollGlow();                        // 🪆 點擊熱點光點：顏色＝娃娃名稱顏色（currentColor）
        if (glow) { glow.style.color = _dollNameColor(ed.c); glow.classList.add('active'); }
    } else {
        document.body.style.cursor = '';   // 未裝魔法娃娃 → 回預設游標
        document.body.classList.remove('has-doll-cursor');  // 卸下娃娃：必須移除 class，否則全頁強制 inherit 'auto' 會失去手指提示
        if (_dollGlow) _dollGlow.classList.remove('active');   // 🪆 卸下娃娃：關閉光點
    }
}

// ===== 變形卷軸：變身資料（依規格文件） =====
// 欄位：md/mh=近距離傷害/命中, rd/rh=遠距離傷害/命中, ed/eh=額外傷害/命中,
//       mgd=魔法傷害, sp=額外魔法點數, mpr=MP自然恢復量, ac=AC(負值代表AC-x),
//       er=ER, mr=MR, spd=攻擊速度加快(%)
// 顏色：Lv49以下白色、Lv50~51淡黃色、Lv52以上金色
const POLY_TIERS = [
    { min:0,  max:14, color:"text-white", forms:[
        { n:"妖魔", md:1, mh:1 },
        { n:"骷髏", md:1, mh:1 },
        { n:"那魯加妖魔", md:1, mh:1 },
        { n:"妖魔弓箭手", rd:1, rh:1 },
        { n:"長者", sp:2, mpr:1 },
        { n:"侏儒", ac:-1, spd:10 },
        { n:"歐姆", ed:1, eh:1 },
        { n:"巨蟻", eh:1, spd:10 },
        { n:"奇異鸚鵡", ed:1, sp:1 },
        { n:"浣熊", eh:1, sp:1 },
        { n:"果凍怪", mr:4, sp:1 },
    ]},
    { min:15, max:29, color:"text-white", forms:[
        { n:"妖魔鬥士", md:2, mh:1 },
        { n:"狼人", md:1, mh:2 },
        { n:"食人妖精", md:2, mh:2 },
        { n:"妖魔巡守", rd:2, rh:1 },
        { n:"夏洛伯", ac:-2, spd:15 },
        { n:"黑暗妖精運送員", rd:1, rh:2 },
        { n:"巨大兵蟻", ed:2, eh:1 },
        { n:"紙人", sp:2, mpr:2 },
        { n:"雪人", mgd:1 },
    ]},
    { min:30, max:44, color:"text-white", forms:[
        { n:"萊肯", md:2, mh:2 },
        { n:"思克巴", mgd:1, mpr:2 },
        { n:"食人妖精王", md:3, mh:2 },
        { n:"黑暗妖精警衛(矛)", md:1, mh:3 },
        { n:"強盜(弓)", rd:2, rh:2 },
        { n:"黑暗妖精盜賊", rd:2, rh:3 },
        { n:"黑暗妖精法師", sp:3, mpr:1 },
        { n:"亞力安", md:1, mh:1, sp:2 },
        { n:"曼波兔", er:1, spd:15 },
    ]},
    { min:45, max:49, color:"text-white", forms:[
        { n:"德雷克", md:3, mh:3 },
        { n:"布雷哲", md:2, mh:4 },
        { n:"庫曼", md:1, mh:1, spd:15 },
        { n:"黑暗妖精警衛(弓)", rd:1, rh:1, spd:15 },
        { n:"黑暗妖精巡守", rd:3, rh:3 },
        { n:"巴風特", mgd:1, sp:2, mpr:2 },
    ]},
    { min:50, max:51, color:"text-yellow-200", forms:[
        { n:"克特", md:3, mh:3, spd:15 },
        { n:"刺客首領", md:2, mh:2, spd:20 },
        { n:"小惡魔", rd:1, mgd:1, mpr:3, spd:15 },
        { n:"黑騎士", md:1, mh:4, spd:10 },
        { n:"火焰弓箭手", rd:3, rh:3, spd:10 },
        { n:"黑法師", mgd:1, sp:3, mpr:2, spd:10 },
    ]},
    { min:52, max:54, color:"text-yellow-400", forms:[
        { n:"死亡騎士", md:3, mh:3, spd:20 },
        { n:"狂暴將軍", md:5, spd:15 },
        { n:"黑暗精靈", rd:3, rh:3, spd:20 },
        { n:"黑長者", mgd:2, sp:1, mpr:2, spd:15 },
        { n:"巴列斯", mgd:1, sp:2, mpr:4, spd:10 },
    ]},
    { min:55, max:59, color:"text-yellow-400", forms:[
        { n:"黑暗騎士", md:4, mh:3, spd:20 },
        { n:"黑暗刺客", md:3, mh:4, spd:20 },
        { n:"黑暗巡守", rd:4, rh:3, spd:20 },
        { n:"黑暗法師", mgd:2, sp:2, mpr:3, spd:15 },
    ]},
    { min:60, max:64, color:"text-yellow-400", forms:[
        { n:"銀光騎士", md:4, mh:3, spd:25 },
        { n:"銀光刺客", md:3, mh:4, spd:25 },
        { n:"銀光巡守", rd:4, rh:3, spd:25 },
        { n:"銀光法師", mgd:2, sp:3, mpr:3, spd:20 },
    ]},
    { min:65, max:69, color:"text-yellow-400", forms:[
        { n:"黃金騎士", md:4, mh:4, spd:25 },
        { n:"黃金刺客", md:3, mh:5, spd:25 },
        { n:"黃金巡守", rd:4, rh:4, spd:25 },
        { n:"黃金法師", mgd:2, sp:5, mpr:3, spd:20 },
    ]},
    { min:70, max:74, color:"text-yellow-400", forms:[
        { n:"白金騎士", md:4, mh:4, spd:30 },
        { n:"白金刺客", md:3, mh:5, spd:30 },
        { n:"白金巡守", rd:4, rh:4, spd:30 },
        { n:"白金法師", mgd:2, sp:5, mpr:3, spd:25 },
    ]},
    { min:75, max:9999, color:"text-yellow-400", forms:[
        { n:"反王肯特", md:4, mh:6, spd:33 },
        { n:"丹特斯", md:6, mh:4, spd:33 },
        { n:"海露拜", rd:4, rh:6, spd:33 },
        { n:"絲莉安", rd:6, rh:4, spd:33 },
        { n:"賽尼斯", mgd:3, sp:5, mpr:5, spd:30 },
        { n:"宙斯", mgd:3, sp:6, mpr:4, spd:30 },
    ]},
];

function getPolyTier(lv) {
    for (const t of POLY_TIERS) if (lv >= t.min && lv <= t.max) return t;
    return POLY_TIERS[POLY_TIERS.length - 1];
}
function findPolyForm(name) {
    for (const t of POLY_TIERS) for (const f of t.forms) if (f.n === name) return { form: f, color: t.color };
    return null;
}
function makePolyState(form, color) { return Object.assign({ c: color }, form); }
// 🗼 套裝專屬變身（不進入隨機變形池）：死亡騎士套裝→真‧死亡騎士、克特套裝→真‧克特、惡魔套裝→惡魔
const SET_POLY_FORMS = {
    dk:    { n: "真‧死亡騎士", ed: 6, eh: 6, spd: 35, c: "text-yellow-400" },
    kurt:  { n: "真‧克特",     ed: 4, eh: 8, spd: 35, c: "text-yellow-400" },
    demon: { n: "惡魔", ed: 4, eh: 4, mgd: 3, sp: 3, mpr: 3, spd: 33, c: "text-red-400" },
    darkelf: { n: "高等黑暗精靈", rd: 5, rh: 5, spd: 30, c: "text-violet-300" }
};

// 是否持有「變形控制戒指」(acc_117)
// 🔧 改為「背包攜帶即可觸發」：裝備中或背包內任一處有戒指都算持有，不需佔用戒指欄位
function hasPolyRing() {
    return [player.eq.ring1, player.eq.ring2, player.eq.ring3, player.eq.ring4].some(e => e && e.id === 'acc_117')
        || (player.inv && player.inv.some(i => i && i.id === 'acc_117' && (i.cnt || 0) > 0));
}
// 是否持有傳送控制戒指 (acc_116)
// 🔧 改為「背包攜帶即可觸發」：裝備中或背包內任一處有戒指都算持有，不需佔用戒指欄位
function hasTeleportRing() {
    return [player.eq.ring1, player.eq.ring2, player.eq.ring3, player.eq.ring4].some(e => e && e.id === 'acc_116')
        || (player.inv && player.inv.some(i => i && i.id === 'acc_116' && (i.cnt || 0) > 0));
}
// 傳送：清空當前怪物並重置生怪排程；forceBoss=true 時讓下一次生怪必定為 BOSS
function doTeleport(forceBoss) {
    saveSiegeBossHp();   // 傳送前保存攻城塔/門血量
    mapState.mobs = [null, null, null, null, null];
    mapState.spawnAt = [null, null, null, null, null];
    if(forceBoss) mapState.forceBoss = true;
    mapState.suppressSiegeBoss = !forceBoss;   // 無戒指傳送：必不出現城門/守護塔；持戒指：forceBoss 必定出現
    renderMobs();
}

// ===== 🏛️ 隱藏狩獵區域系統（由對應地圖手動傳送/瞬移卷軸進入；不列於地圖選單、魔物追蹤無法指定；區域規則同地監狩獵地圖） =====
const HIDDEN_AREA_PARENT = { zone_37: 'hidden_lab_nolife', zone_38: 'hidden_lab_darkmagic', zone_39: 'hidden_seal_spirit', zone_40: 'hidden_seal_monster', zone_41: 'hidden_seal_demon', zone_33: 'hidden_antqueen' };
const HIDDEN_AREA_NAMES = { hidden_lab_nolife: '無生物研究室', hidden_lab_darkmagic: '黑魔法研究室', hidden_seal_spirit: '惡靈封印室', hidden_seal_monster: '魔物封印室', hidden_seal_demon: '惡魔封印室', hidden_antqueen: '巨蟻女皇棲息地' };
const HIDDEN_AREA_BG = { hidden_lab_nolife: '象牙塔4樓', hidden_lab_darkmagic: '象牙塔5樓', hidden_seal_spirit: '象牙塔6樓', hidden_seal_monster: '象牙塔7樓', hidden_seal_demon: '象牙塔8樓', hidden_antqueen: '螞蟻洞穴2樓' };   // 🏛️ 隱藏區域背景＝對應母地圖樓層同名圖（applyAreaBackground 探測 assets/area/<樓層>.jpg；不存在則退回 SPECIAL_AREA_BG）
function isHiddenArea(m) { return !!(m && HIDDEN_AREA_NAMES[m]); }
function enterHiddenArea(hiddenId) {
    let sel = document.getElementById('map-select');
    if (sel && !Array.from(sel.options).some(o => o.value === hiddenId)) {   // 隱藏地圖不在選單→臨時補一個 option 供 changeMap 讀值
        let o = document.createElement('option'); o.value = hiddenId; o.textContent = HIDDEN_AREA_NAMES[hiddenId] || hiddenId; sel.appendChild(o);
    }
    if (sel) sel.value = hiddenId;
    changeMap(true);   // force：繞過權限/鑰匙/受控限制；changeMap 讀 #map-select.value=hiddenId 進入並記入 lastBattleMap（供村莊「出發」一鍵返回）
    logCombat(`<span class="font-bold" style="color:#e879f9;text-shadow:0 0 8px #c026d3;">空間的裂隙在你眼前展開，你踏入了 ${HIDDEN_AREA_NAMES[hiddenId] || '隱藏狩獵區域'}。</span>`, 'magic');
}
// 🌀 順移按鈕：已學傳送術且 MP 足夠→傳送術；否則消耗瞬間移動卷軸；皆無則提示
function playerTeleport() {
    if (player.skills && player.skills.includes('sk_teleport')) {
        let _sk = DB.skills.sk_teleport;
        if (player.mp >= player.d.getMpCost(_sk.mp, _sk.tier)) { state._manualTpUntil = (state.ticks || 0) + 50; manualCast('sk_teleport'); return; }   // 🕒 手動瞬移後 5 秒內抑制自動瞬移/自動購買
    }
    let _it = player.inv.find(i => i.id === 'scroll_teleport' && (i.cnt || 1) >= 1);
    if (_it) { state._manualTpUntil = (state.ticks || 0) + 50; useItem(_it.uid, false); return; }   // 🕒 手動瞬移後 5 秒內抑制自動瞬移/自動購買
    logSys('<span class="text-slate-400">你尚未學會傳送術，也沒有瞬間移動卷軸。</span>');
}

// 隨機變身（套裝強制變身沿用同一函式：isDKSet→死亡騎士、isKurtSet→克特）
function getPolyState(isDKSet=false, isKurtSet=false) {
    if (isDKSet)   { let r = findPolyForm("死亡騎士"); return makePolyState(r.form, r.color); }
    if (isKurtSet) { let r = findPolyForm("克特");     return makePolyState(r.form, r.color); }
    let tier = getPolyTier(player.lv);
    let form = tier.forms[Math.floor(Math.random() * tier.forms.length)];
    return makePolyState(form, tier.color);
}

// 依名稱取得指定變身（變形控制戒指鎖定用）
function getPolyStateByName(name) {
    let r = findPolyForm(name);
    if (!r) return getPolyState();
    return makePolyState(r.form, r.color);
}

function applyPolyForce(stateObj) {
    player.poly = stateObj;
    player.buffs.poly = 1800;
}

// 將變身能力整理成可讀文字（給選單顯示）
function polyFormDesc(f) {
    let p = [];
    if (f.md)  p.push(`近距離傷害+${f.md}`);
    if (f.mh)  p.push(`近距離命中+${f.mh}`);
    if (f.rd)  p.push(`遠距離傷害+${f.rd}`);
    if (f.rh)  p.push(`遠距離命中+${f.rh}`);
    if (f.ed)  p.push(`額外傷害+${f.ed}`);
    if (f.eh)  p.push(`額外命中+${f.eh}`);
    if (f.mgd) p.push(`魔法傷害+${f.mgd}`);
    if (f.sp)  p.push(`額外魔法點數+${f.sp}`);
    if (f.mpr) p.push(`MP恢復+${f.mpr}`);
    if (f.ac)  p.push(`AC${f.ac}`);
    if (f.er)  p.push(`ER+${f.er}`);
    if (f.mr)  p.push(`MR+${f.mr}`);
    if (f.spd) p.push(`攻速+${f.spd}%`);
    return p.join('，');
}

// 變形控制戒指：手動使用時開啟「指定變身」選單
function openPolySelect(uid) {
    let tier = getPolyTier(player.lv);
    let modal = document.getElementById('poly-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'poly-modal';
        modal.className = 'hidden fixed inset-0 z-[60] flex items-center justify-center';
        modal.innerHTML =
            '<div class="absolute inset-0 bg-black/60" onclick="closePolyModal()"></div>' +
            '<div class="panel border-slate-500 p-5 relative w-[440px] max-h-[80vh] flex flex-col">' +
              '<div class="panel-header rounded-md mb-3">變形控制戒指 — 選擇變身</div>' +
              '<div id="poly-modal-list" class="flex flex-col gap-2 overflow-y-auto pr-1"></div>' +
              '<button class="btn mt-4" onclick="closePolyModal()">取消</button>' +
            '</div>';
        document.body.appendChild(modal);
    }
    let listEl = modal.querySelector('#poly-modal-list');
    listEl.innerHTML = tier.forms.map(f =>
        '<button class="btn text-left !py-2 !px-3" onclick="confirmPolySelect(\'' + uid + '\',\'' + f.n + '\')">' +
            '<span class="' + tier.color + ' font-bold">' + f.n + '</span>' +
            '<span class="text-slate-400 text-xs block mt-0.5">' + polyFormDesc(f) + '</span>' +
        '</button>'
    ).join('');
    modal.classList.remove('hidden');
}
function closePolyModal() {
    let m = document.getElementById('poly-modal');
    if (m) m.classList.add('hidden');
}
// 玩家在選單中選定變身：套用、鎖定、消耗卷軸
function confirmPolySelect(uid, name) {
    let item = player.inv.find(i => i.uid === uid);
    if (!item) { closePolyModal(); return; }
    let st = getPolyStateByName(name);
    player.poly = st;                             // 設為當前變身；之後自動使用會維持此狀態
    player.buffs.poly = DB.items[item.id].dur;
    logSys(`使用變形卷軸（指定），變身為 <span class="${st.c}">${st.n}</span>。`);
    consume(item);
    calcStats();
    closePolyModal();
    if (document.getElementById('item-modal').classList.contains('hidden') === false) closeModal();
    updateUI();
}

// ===== 🏛️ 底比斯·上鎖的歐西里斯寶箱：開啟（選擇數量，每個消耗 1 顆 龜裂之核，依機率獲得寶物；機率合計 100%＝每開 1 個必得 1 件） =====
const OSIRIS_BOX_BASIC = [
    ['wpn_thebes_2hsword', 0.25], ['wpn_thebes_dual', 0.25], ['wpn_thebes_bow', 0.25], ['wpn_thebes_wand', 0.25],
    ['scroll_weapon', 3], ['scroll_armor', 4],
    ['new_item_151', 15], ['new_item_154', 15], ['new_item_160', 15], ['new_item_157', 15],
    ['new_item_152', 8], ['new_item_155', 8], ['new_item_158', 8], ['new_item_161', 8]
];
const OSIRIS_BOX_HIGH = [
    ['wpn_thebes_2hsword', 0.75], ['wpn_thebes_dual', 0.75], ['wpn_thebes_bow', 0.75], ['wpn_thebes_wand', 0.75],
    ['scroll_weapon', 4], ['scroll_armor', 5],
    ['new_item_151', 14], ['new_item_154', 14], ['new_item_160', 14], ['new_item_157', 14],
    ['new_item_152', 8], ['new_item_155', 8], ['new_item_158', 8], ['new_item_161', 8]
];
function osirisBoxRoll(table) {
    if (tradNoScrolls()) table = table.filter(e => !TRAD_NO_SCROLLS[e[0]]);   // 🏛️ 僅經典+傳統：寶箱不開出施法卷軸（改抽其餘獎品，不浪費龜裂之核）；一般+傳統照常
    let total = 0; for (let e of table) total += e[1];   // 過濾後重算總權重（一般情況=100）
    let r = lootRng('osiris') * total, acc = 0;   // 🎲 committed RNG（防 SL 重抽歐西里斯寶箱開到哪件）
    for (let e of table) { acc += e[1]; if (r < acc) return e[0]; }
    return table[table.length - 1][0];
}
function playerCoreCount() { return player.inv.filter(i => i.id === 'mat_crack_core').reduce((s, i) => s + (i.cnt || 0), 0); }
function openOsirisBox(uid) {
    let item = player.inv.find(i => i.uid === uid);
    if (!item) return;
    let d = DB.items[item.id]; if (!d) return;
    let coreCnt = playerCoreCount();
    if (coreCnt < 1) { logSys('<span class="text-red-400">缺少 龜裂之核：開啟歐西里斯寶箱每個需消耗 1 顆 龜裂之核（希培利亞・巴特爾可用時空裂痕碎片×100 製作）。</span>'); return; }
    let maxN = Math.min(item.cnt || 1, coreCnt);
    let modal = document.getElementById('osiris-box-modal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'osiris-box-modal'; modal.className = 'hidden fixed inset-0 z-[60] flex items-center justify-center'; document.body.appendChild(modal); }
    modal.innerHTML =
        '<div class="absolute inset-0 bg-black/60" onclick="closeOsirisBoxModal()"></div>' +
        '<div class="panel border-amber-500 p-5 relative w-[420px] flex flex-col">' +
          `<div class="panel-header rounded-md mb-3">${d.n} — 選擇開啟數量</div>` +
          `<div class="text-sm text-slate-300 mb-3">每開啟 1 個消耗 <span class="text-amber-300">1 顆 龜裂之核</span>。<br>持有寶箱 <span class="text-amber-300">${item.cnt || 1}</span> 個、龜裂之核 <span class="text-amber-300">${coreCnt}</span> 顆，最多可開啟 <span class="text-amber-300">${maxN}</span> 個。</div>` +
          `<input id="osiris-box-qty" type="number" min="1" max="${maxN}" value="${maxN}" class="w-full mb-3 px-2 py-1 rounded bg-slate-800 border border-slate-600 text-center text-lg">` +
          `<div class="flex gap-2"><button class="btn flex-1 bg-amber-800 hover:bg-amber-700 font-bold" onclick="confirmOsirisBox('${uid}')">開啟</button><button class="btn flex-1" onclick="closeOsirisBoxModal()">取消</button></div>` +
        '</div>';
    modal.classList.remove('hidden');
    if (!document.getElementById('item-modal').classList.contains('hidden')) closeModal();
}
function confirmOsirisBox(uid) {
    let inp = document.getElementById('osiris-box-qty');
    let n = Math.max(1, parseInt(inp && inp.value) || 1);
    doOpenOsirisBox(uid, n);
}
function closeOsirisBoxModal() { let m = document.getElementById('osiris-box-modal'); if (m) m.classList.add('hidden'); }
function doOpenOsirisBox(uid, n) {
    let item = player.inv.find(i => i.uid === uid);
    if (!item) { closeOsirisBoxModal(); return; }
    let d = DB.items[item.id];
    let table = (d.boxTier === 'high') ? OSIRIS_BOX_HIGH : OSIRIS_BOX_BASIC;
    n = Math.max(1, Math.floor(n));
    let opened = 0, gained = {};
    for (let k = 0; k < n; k++) {
        if ((item.cnt || 0) < 1) break;
        let core = player.inv.find(i => i.id === 'mat_crack_core' && (i.cnt || 0) > 0);
        if (!core) break;   // 龜裂之核 用罄
        core.cnt--; if (core.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== core.uid);
        item.cnt--;          // 消耗 1 寶箱（迴圈結束後統一清除空堆疊）
        let rw = osirisBoxRoll(table);
        gainItem(rw, 1);
        gained[rw] = (gained[rw] || 0) + 1;
        opened++;
    }
    if ((item.cnt || 0) <= 0) player.inv = player.inv.filter(i => i.uid !== item.uid);
    if (opened > 0) {
        let parts = Object.keys(gained).map(id => `${DB.items[id] ? DB.items[id].n : id}×${gained[id]}`);
        logSys(`<span class="text-amber-300 font-bold">開啟了 ${opened} 個 ${d.n}：</span>${parts.join('、')}`);
    } else {
        logSys('<span class="text-red-400">沒有足夠的 龜裂之核 或寶箱，未能開啟。</span>');
    }
    renderTabs(true); updateUI(); saveGame();
    closeOsirisBoxModal();
}

// 主迴圈：依「真實經過的時間」補跑對應數量的邏輯 tick。
// 這樣即使分頁切到背景被瀏覽器降速、或機器卡頓導致 setInterval 延遲，
// 遊戲時間仍會以正確速率前進（回到分頁時自動快轉補上落後的進度）。