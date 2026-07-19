function playerAttack() {
    let target = getTarget();
    if(!target) return;
    player._faceTgtUid = target.uid;   // 🧭 只記錄可序列化 UID；不可保存怪物物件，否則與 mob→player 面向參照形成循環而使存檔失敗
    delete player._faceTgt;
    if (typeof _playerMorphTrigger === 'function') { try { _playerMorphTrigger('attack'); } catch (e) {} }   // 🧝 v3.0.46 玩家變身 sprite：攻擊動作（含被迴避＝有揮擊）
    // 🔮 幻術士 奇古獸攻擊：裝備奇古獸(必中魔法)或魔劍精通(任意非弓武器套用奇古獸公式) → 走奇古獸路徑，繞過物理命中/迴避
    if (player.cls === 'illusion') {
        let _qw = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
        if (_qw && !_qw.isBow && (_qw.qigu || (player.mastery === 'i_magicsword' && !isWandWeapon(_qw)))) { qiguPlayerAttack(target, _qw); return; }   // 🔮 魔劍精通：排除魔杖（魔杖不轉奇古獸必中路徑）
    }

    let _sureHit = !!player._darkEvadeSure;   // 🔧 迴避精通：下一次一般攻擊必中（🔮 麗人5/5 已改為「未命中堆疊命中」，不再走必中）
    let _sureCrit = !!player._darkEvadeCrit;   // 🔧 迴避精通：迴避後下一次一般攻擊必定爆擊
    if (_sureHit || _sureCrit) { player._darkEvadeSure = false; player._darkEvadeCrit = false; }
    if (!_sureHit && target.er && roll(1, 100) <= target.er) {
        logCombat(`<span class="${getMobColor(target.lv)}">${target.n}</span> 成功迴避攻擊。`, 'evade');
        wandLightArrowProc(target);
        magicStrikeProc(target);
        weaponSpellProc(target, false);   // 🔧 附魔施放：一般武器照常判定；procOnHit 武器（長老的雷電能量）被迴避時不觸發
        return;
    }

    let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
    let arrowData = null;
    
    // 👇 如果拿弓，執行消耗箭矢判定
    if (wpn && wpn.isBow) {
        arrowData = consumeArrow();
        if (!arrowData) return; // 如果沒箭了，中斷攻擊
        if (typeof playArrowFx === 'function') playArrowFx(player, target);   // 🏹 v3.2.8 弓箭投射物（箭矢確實射出後才播）
    }

    let isLarge = target.s === 'L';
    let dice = wpn ? (isLarge ? wpn.dmgL : wpn.dmgS) : 2;
	if (arrowData) {
            // 弓的傷害加上箭的傷害
            dice = isLarge ? (wpn.dmgL + arrowData.dmgL) : (wpn.dmgS + arrowData.dmgS);
        }
    
    let _mainHardSkin = mobHardSkin(target);   // 🏅 穿透精通用：主目標被扣減前的硬皮值
    let result = getPhysicalDmg(dice, target, wpn, arrowData, false, false, _sureHit, _sureCrit);   // 🔮 麗人 5/5：必中（可自然重擊/爆擊）；🔧 迴避精通：必中且必爆
    if (!result.hit && wpn && wpn.missGrazeRate && Math.random() * 100 < wpn.missGrazeRate) result = getPhysicalDmg(dice, target, wpn, arrowData, false, false, false, false, player.eq.wpn, true);   // 🏺 水精靈王的撫摸：未命中時 30% 改判為擦傷（50% 傷害、不爆擊）

    if (result.hit) {
        try { playSfx(result.crit ? 'crit' : 'attack'); } catch(e){}   // 🔊 音效：普攻命中→普攻聲、爆擊→爆擊聲
        // --- 命中滿血的被動怪物且為遠距離攻擊時，賦予 3 秒延遲 ---
        if (target.curHp === target.hp && target.beh === '被動' && result.ranged) {
            target._delayTicks = 30;
        }

        if (wpn && (wpn.eff === 'mp_drain' || wpn.mpOnHit)) {   // 🔧 mpOnHit：eff 已被其他特效(如惡魔王魔杖魔爆)佔用仍可保留命中回MP
            let en = capWpnEn((player.eq.wpn && player.eq.wpn.en) || 0);
            let mpGain = mpOnHitAmount(wpn, en);   // 💧 單一真相 mpOnHitAmount（js/03）：固定量 → 基底＋突破安定值加成
            player.mp = Math.min(player.mmp, player.mp + mpGain); updateUI();
        }
		if (wpn && wpn.eff === 'dice_death') {
            // 1% 機率即死（對非 BOSS）。tag 為 null 代表不限怪物種類
            let diceIkParams = { p: 0.01, tag: null }; 
            
            if (tryInstakill(target, diceIkParams, "骰子匕首", mapState.targetIdx)) {
                // 即死成功發動，直接中斷這次攻擊的後續動作（不再執行一般扣血）
                return;
            }
        }
        // 🏺 遺物武器即死 proc（強韌的大腿骨：20% 對「等級 maxLv 以下」的指定 tag 生物即死）
        if (wpn && wpn.procInstakill) {
            let _pk = wpn.procInstakill;
            let _thp = target.hp || 1;   // 🐍 獻祭：先取被消滅敵人最大HP（即死後 target.hp 仍為滿值）
            if ((!_pk.maxLv || target.lv <= _pk.maxLv) && (!_pk.hpBelow || target.curHp <= Math.max(1, Math.floor((target.hp || 1) * _pk.hpBelow))) && tryInstakill(target, { p: _pk.p, tag: _pk.tag || null }, wpn.n, mapState.targetIdx)) {   // 🏺 v3.1.80 來自陰影的刺劍 hpBelow：僅對 HP 低於 N% 的目標觸發（tryInstakill 內建頭目免疫）
                if (_pk.healPct) { player.hp = Math.min(player.mhp, player.hp + Math.max(1, Math.floor(_thp * _pk.healPct))); updateUI(); }   // 🐍 阿茲特獻祭亡靈：即死後恢復被消滅敵人 HP% (對頭目 tryInstakill 內建免疫)
                return;
            }
        }
        // 🏺 遺物 隱蔽的死亡草葉：一般攻擊命中「滿血」非BOSS怪，instakillFull 機率即死（斗篷授予·此處 target.curHp 為命中前值）
        if (player.d.instakillFull && target.curHp === target.hp && tryInstakill(target, { p: player.d.instakillFull, tag: null }, '隱蔽的死亡草葉', mapState.targetIdx)) return;
        if (wpn && wpn.stoneInstakill && target.st && target.st.stone > 0 && tryInstakill(target, { p: 1, tag: null }, '蛇妖的無慈悲尾刺', mapState.targetIdx)) return;   // 🏺 蛇妖的無慈悲尾刺：命中石化敵人必定即死（tryInstakill 內建頭目免疫）
        // === 騎士被動：看破 / 殺戮 / 屠殺（僅對近距離普攻生效，兩者獨立判定，可同時觸發）===
        let killPrefix = '';
        if (player.cls === 'knight' && !result.ranged && !player.classicMode) {   // 🎮 經典模式：騎士無看破/殺戮被動
            // 看破：Lv1 起 5%，每10等+1%，上限 Lv100 的 15% → ×2 最終傷害
            let insightRate = Math.min(15, 5 + Math.floor(player.lv / 10));
            // 殺戮：Lv20 起 1%，每20等+1%，上限 Lv100 的 5% → ×3 最終傷害
            let slayRate = player.lv >= 20 ? Math.min(5, 1 + Math.floor((player.lv - 20) / 20)) : 0;
            let insight = Math.random() * 100 < insightRate;
            let slay = slayRate > 0 && (Math.random() * 100 < slayRate);
            if (insight && slay) {            // 兩者同時 → 屠殺 ×6
                result.dmg *= 6;
                killPrefix = '<span class="font-bold" style="color:#f0abfc;text-shadow:0 0 6px #d946ef,0 0 12px #a855f7;">【屠殺】你的意識已被戰鬥本能支配！</span> ';
            } else if (insight) {             // 看破 ×2
                result.dmg *= 2;
                killPrefix = '<span class="text-cyan-300 font-bold">【看破】你看穿敵人的破綻！</span> ';
            } else if (slay) {                // 殺戮 ×3
                result.dmg *= 3;
                killPrefix = '<span class="text-orange-400 font-bold">【殺戮】你戰鬥到渾然忘我！</span> ';
            }
        }
        // 🏅 劍術精通（妖精）：近距離攻擊 5+等級/10% 機率發動看破 ×2
        if (player.cls === 'elf' && hasMastery('e_sword') && !result.ranged) {
            let _ir = Math.min(15, 5 + Math.floor(player.lv / 10));
            if (Math.random() * 100 < _ir) {
                result.dmg *= 2;
                killPrefix = '<span class="text-cyan-300 font-bold">【看破】你看穿敵人的破綻！</span> ';
            }
        }
        // 🔧 黑暗妖精：燃燒鬥志（30% 傷害×1.5）、雙重破壞（持雙刀/鋼爪時，45級起10%機率傷害×2，每5級+1%，可與燃燒鬥志疊加）
        if (player.buffs && player.buffs.sk_dark_burn > 0 && Math.random() < 0.30) result.dmg = Math.floor(result.dmg * 1.5);
        if (player.buffs && player.buffs.sk_elf_attrfire > 0 && Math.random() < 0.30) result.dmg = Math.floor(result.dmg * 1.5);   // 🔧 妖精：屬性之火（一般攻擊30%機率傷害×1.5；與燃燒鬥志同效，火屬性妖精專用）
        if (player.buffs && player.buffs.sk_dark_double > 0) {
            let _dt = getWeaponTags(player.eq.wpn ? player.eq.wpn.id : '');
            if (_dt.includes('雙刀') || _dt.includes('鋼爪')) {
                let _dch = 10 + (player.lv >= 45 ? Math.floor((player.lv - 45) / 5) : 0);   // 45級起10%，每5級+1%
                if (Math.random() * 100 < _dch) result.dmg *= 2;
            }
        }
        if (player.buffs.sk_dragon_flameslash > 0 && !result.ranged) { result.dmg += 7; player.buffs.sk_dragon_flameslash = 0; player._flameSlashFire = true; }   // 🐉 燃燒擊砍：下一次近戰一般攻擊額外傷害+7並轉火屬性（一次性消耗）
        // 🏅 鎖刃精通：「每層弱點曝光最終傷害+10%」改為僅屠宰者生效（一般攻擊不再套用 weakExposeDmgMult）
        if (player.skills.includes('sk_warrior_berserk') && !result.ranged && Math.random() < 0.05) result.dmg *= 2;   // ⚔️ 狂暴：一般攻擊5%機率傷害x2
        if (player.buffs.sk_royal_bravewill > 0 && Math.random() < (player.mastery === 'k_royal_sword' ? 0.2 : 0.1)) result.dmg = Math.max(1, Math.floor(result.dmg * 1.5));   // 👑 勇猛意志：10%(🏅劍術精通20%)機率一般攻擊傷害×1.5
        if (wpn && wpn.hardSkinMult && _mainHardSkin > 0) result.dmg = Math.max(1, Math.floor(result.dmg * wpn.hardSkinMult));   // 🦀 巨大鱷魚的狩獵牙：目標有硬皮值時一般攻擊傷害 ×1.5（貫穿故傷害未被硬皮扣減）
        if (wpn && wpn.softMult && _mainHardSkin <= 0) result.dmg = Math.max(1, Math.floor(result.dmg * wpn.softMult));   // 🏺 不死將軍的珍愛巨劍：一般攻擊對「沒有硬皮值」的敵人傷害 ×1.3
        if (wpn && wpn.fullHpMult && target.curHp === target.hp) result.dmg = Math.max(1, Math.floor(result.dmg * wpn.fullHpMult));   // 🏺 遺忘者的狙擊弓：一般攻擊對滿血敵人傷害 ×3（傷害尚未扣、target.curHp 仍為滿血）
        if (wpn && wpn.silencedBonusDmg && target.st && target.st.magicseal > 0) result.dmg += wpn.silencedBonusDmg;   // 🏺 沉默的毒液：對「沉默(magicseal)」狀態敵人額外固定傷害 +20
        if (wpn && wpn.poisonedBonusDmg && target.st && target.st.poison > 0) result.dmg += wpn.poisonedBonusDmg;   // 🐍 艾庫卡伊拉的毒牙：對中毒狀態敵人額外固定傷害 +15
        if (wpn && wpn.slowedBonusDmg && target.st && target.st.slow > 0) result.dmg += wpn.slowedBonusDmg;   // 🐍 艾庫艾托的鞭笞藤：對緩速狀態敵人額外固定傷害 +10
        if (wpn && wpn.selfBreakProc && Math.random() < 0.03) { result.dmg = Math.max(1, Math.floor(result.dmg * 1.5)); if (player.statuses) player.statuses.broken = (wpn.selfBreakProc.dur || 5) * 10; }   // 🐍 特產易碎泥偶：一般攻擊 3% 機率傷害×1.5，並使自身陷入壞物術（下方 getPhysicalDmg 期間傷害 -20%）
        if (wpn && wpn.raceBonus && target.race === wpn.raceBonus.race) result.dmg = Math.max(1, Math.floor(result.dmg * (wpn.raceBonus.mult || 1)));   // 🕷️ 刺針：一般攻擊對特定種族（蜘蛛）造成傷害 ×N
        if (wpn && wpn.raceFlat && target.race === wpn.raceFlat.race) result.dmg = result.dmg + (wpn.raceFlat.add || 0);   // 🏺 遺物 上古蜘蛛之爪：一般攻擊對特定種族（動物）造成額外固定傷害 +N
        if (wpn && wpn.eleBonusDmg && target.e === wpn.eleBonusDmg.ele) result.dmg += (wpn.eleBonusDmg.add || 0);   // 🏺 兇殘惡鬼的毒牙：對特定屬性敵人額外固定傷害 +N（如對風屬性+10）
        if (wpn && wpn.immParalyzeBonusDmg && (target.boss || target.immParalyze || target.immStun)) result.dmg += wpn.immParalyzeBonusDmg;   // 🏺 屍毒之針：對免疫麻痺（頭目/免疫）目標額外固定傷害 +N
        target.curHp -= result.dmg;
        if (wpn && wpn.bonespike && (target._bonespike || 0) > 0 && target.curHp > 0) { let _bs = target._bonespike * 20; target._bonespike = 0; target.curHp -= _bs; target._spellHurt = true; mobWake(target); logCombat(`<span class="font-bold" style="color:#e5e7eb;text-shadow:0 0 6px #6b7280;">【骨刺爆裂】</span>引爆目標身上的骨刺，額外造成 ${_bs} 點固定傷害。`, 'player-special'); }   // 🏺 骸骨意志之弓：一般攻擊引爆所有骨刺（每層 20 固定傷害）
        reflectWallOnDamage(target, result.dmg, result.ranged ? 'ranged' : 'melee', null);   // 🌑 血壁空間（吉爾塔斯）：反彈同等傷害給攻擊方
        if (target.curHp > 0 && wpn && wpn.hitEchoMagic && Math.random() * 100 < (wpn.hitEchoMagic.rate || 0)) { let _he = wpn.hitEchoMagic; target.curHp -= result.dmg; if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(target, result.dmg, 'magic'); target.justHit = _he.ele || 'magic'; target._spellHurt = true; mobWake(target); logCombat(`<span class="font-bold" style="color:#fb923c;text-shadow:0 0 6px #dc2626;">【爆破】</span>烈焰爆開，額外造成 ${result.dmg} 點火屬性魔法傷害。`, 'player-special'); }   // 🏺 火精靈王的爆焰：命中 10% 追加等同本擊的火魔傷；🌅 巨大骷髏視為魔法
        if (target.curHp > 0) consumeStrawCurse(target);   // 🐍 詛咒稻草人：受到攻擊時額外扣 80 水魔傷（每次消耗 1 層·最多 3 層）
        if (result.dmg > 0) { try { playMobHurt(target); } catch(e){} }   // 🔊 音效：怪物受傷（依怪名對應；全域節流）
        if (player._setDragonblood2 && result.dmg > 0) player.hp = Math.min(player.mhp, player.hp + Math.max(1, Math.floor(result.dmg * (player.hp < player.mhp * 0.5 ? 0.05 : 0.01))));   // 🐉 龍血2/5：造成物理傷害吸血1%（自身HP<50%→5%）
        if (wpn && wpn.vampPct && result.dmg > 0) player.hp = Math.min(player.mhp, player.hp + Math.floor(result.dmg * wpn.vampPct));   // 🐉 嗜血者鎖鏈劍：吸取一般攻擊傷害的 % 為 HP
        if (wpn && wpn.procHealFlat && result.dmg > 0 && Math.random() * 100 < wpn.procHealFlat.rate) { player.hp = Math.min(player.mhp, player.hp + wpn.procHealFlat.hp); logCombat(`<span class="text-emerald-300 font-bold">【${wpn.n}】</span>恢復了 ${wpn.procHealFlat.hp} 點 HP。`, 'heal'); }   // 🏺 v3.1.80 處刑人的護身斧：一般攻擊命中 3% 機率恢復 10 HP
        if (wpn && wpn.procBurn && target.curHp > 0 && (!wpn.procBurn.rate || Math.random() * 100 < wpn.procBurn.rate)) target._burnDot = { left: (wpn.procBurn.dur || 6) * 10, dmg: wpn.procBurn.dmg || 10, tick: (wpn.procBurn.tick || 1) * 10 };   // 🏺 熔岩灼燒的雙拳：命中附加灼燒 DoT（每秒 dmg 火傷、持續 dur 秒·刷新）
        if (wpn && wpn.procPoisonPct && target.curHp > 0 && result.dmg > 0) { if (!target.st) target.st = newMobStatus(); let _ppd = Math.max(1, Math.floor(result.dmg * (wpn.procPoisonPct.pct || 50) / 100)); target.st.poison = (wpn.procPoisonPct.dur || 6) * 10; target.st.poisonTick = 10; target.st.poisonStacks = 1; target.st.poisonUnit = _ppd; target.st.poisonDmg = _ppd; target.st.poisonSrc = 'player'; }   // 🌅 遺物 毒鵺的黑尾：命中附加「每秒該次傷害 pct%」中毒（最多 1 層·dur 秒·刷新覆蓋）
        // 🔧 黑暗妖精：附加劇毒（命中 50%／劇毒精通 100% 使目標中毒：每秒該次攻擊 60%／劇毒精通 200% 傷害，持續 5 秒，最多 1 層，取較高傷害並刷新持續時間）
        if (player.buffs && player.buffs.sk_dark_poison > 0 && target.curHp > 0 && Math.random() < (hasMastery('d_poison') ? 1 : 0.5)) {
            if (!target.st) target.st = newMobStatus();
            let _pPct = hasMastery('d_poison') ? 2.0 : 0.6;   // 🔧 劇毒精通：每秒 200%；否則 60%
            let _pUnit = Math.max(1, Math.floor(result.dmg * _pPct * ((wpn && wpn.poisonMult) || 1)));   // 🏺 暗黑蠍的雙鉗：poisonMult 放大觸發的附加劇毒傷害（×1.2）
            // 🔧 新規則：未中毒、或新傷害「高於」現有時才上毒（取代傷害並刷新5秒）；新傷害未更高則完全不更新，須等舊毒5秒跑完、敵人脫離中毒後才能再上毒
            if ((target.st.poison || 0) <= 0 || _pUnit > (target.st.poisonUnit || 0)) {
                target.st.poison = 50; target.st.poisonTick = 10;   // 持續 5 秒、每秒一次
                target.st.poisonStacks = 1;                          // 中毒最多 1 層
                target.st.poisonUnit = _pUnit;
                target.st.poisonDmg = _pUnit;
            }
        }
        target.justHit = getWpnEle(player.eq.wpn, wpn);
        if (player._flameSlashFire) { target.justHit = 'fire'; player._flameSlashFire = false; logCombat('<span class="font-bold" style="color:#fb923c;text-shadow:0 0 6px #ea580c;">【燃燒擊砍】</span>烈焰隨刃迸發！', 'player'); }   // 🐉 燃燒擊砍：本擊轉火屬性
        // 🔮 麗人 5/5：已改為「未命中→額外命中+10可堆疊，命中歸零」（見 getPhysicalDmg），不再於重擊後給必中
        if (player._setWhiteBird5 && target.curHp > 0) { if (!target.st) target.st = newMobStatus(); target.st.fragile = 30; }   // 🔮 白鳥 5/5：脆弱 3 秒（重複觸發刷新）
        if (wpn && wpn.onHitEleVuln === 'fire' && target.curHp > 0) target._fireVulnUntil = state.ticks + 30;   // 🏺 遺物 灼熱蜥蜴長舌：命中使目標獲得火屬性弱點 3 秒（受火屬性攻擊 +30%·getPhysicalDmg 讀取）
        if (wpn && wpn.onHitWet && target.curHp > 0) target._wetUntil = state.ticks + 100;   // 🏺 遺物 海洋水晶球：命中使目標潮濕 10 秒（受下一次風屬性傷害 ×2 並解除·consumeWetMult 讀取）
        if (wpn && wpn.hasteStrike && player.buffs && player.buffs.haste > 0) { player.buffs.haste = 0; if (typeof calcStats === 'function') calcStats(); }   // 🏺 遺物 殺人蜂的尾刺：一般攻擊命中時失去加速狀態
        if (wpn && wpn.strawCurse && target.curHp > 0 && Math.random() * 100 < wpn.strawCurse.rate) { if (!target.st) target.st = newMobStatus(); target.st.strawCurse = Math.max(target.st.strawCurse || 0, wpn.strawCurse.stacks || 3); }   // 🐍 庫庫爾坎之矛/鐵手甲/蛇神獠牙：命中 rate% 種下詛咒稻草人（3 層）

		// 穿透（貝卡合金）：場上有兩名以上敵人時，普攻額外攻擊「主目標以外隨機一名敵人」，
		// 每個波及目標各自獨立判定是否命中，命中則造成與主目標相同的傷害與屬性；僅一名敵人時與一般近戰相同（不額外攻擊）。
        if (wpn && (wpn.eff === 'pierce' || wpn.alsoPierce) && (!player.classicMode || wpn.classicOk)) {   // 🎮 經典模式：停用穿透（⚔️ v3.2.38 classicOk 特例：黑虎的雙尾鞭經典亦觸發）；🌑 v3.3.33 alsoPierce＝主特效槽已被占用（吉爾塔斯之劍 cleave／腐壞的長弓 rapidfire）仍附帶貫穿
            let _pc = (wpn.pierceChance !== undefined) ? wpn.pierceChance : 100;   // 穿透發動機率(%)，未設定視為100%
            let otherIdx = [];
            mapState.mobs.forEach((m, i) => { if (m && m.curHp > 0 && !m._dead && m !== target) otherIdx.push(i); });
            if (otherIdx.length > 0 && roll(1, 100) <= _pc) {
                // 🏅 穿透精通：穿透變成全體攻擊（命中主目標以外的「所有」敵人）；否則隨機一名
                let _pTargets = hasMastery('k_pierce') ? otherIdx : [otherIdx[Math.floor(Math.random() * otherIdx.length)]];
                // 🏅 穿透精通：發動穿透時該次傷害 100% 無視硬皮值（把主目標被硬皮扣減的量加回）
                let _pierceDmg = result.dmg;
                if (hasMastery('k_pierce') && _mainHardSkin > 0) _pierceDmg += _mainHardSkin;
                _pTargets.forEach(exIdx => {
                    let exT = mapState.mobs[exIdx];
                    if (!exT || exT.curHp <= 0 || exT._dead) return;
                    // 🔧 穿透：每個波及目標各自獨立判定是否命中（依該怪 AC/等級），未命中則不造成傷害
                    let _exDice = wpn ? (exT.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;
                    if (arrowData) _exDice = (exT.s === 'L') ? (wpn.dmgL + arrowData.dmgL) : (wpn.dmgS + arrowData.dmgS);
                    if (!getPhysicalDmg(_exDice, exT, wpn, arrowData, false, false, false).hit) {
                        if (typeof vfxMiss === 'function') vfxMiss(exT);
                        logCombat(`【穿透】對 <span class="${getMobColor(exT.lv)}">${exT.n}</span> 的攻擊未命中。`, 'miss');
                        return;
                    }
                    exT.curHp -= _pierceDmg;
                    exT.justHit = getWpnEle(player.eq.wpn, wpn);
                    mobWake(exT);
                    logCombat(`【穿透】順勢命中 <span class="${getMobColor(exT.lv)}">${exT.n}</span>，造成 ${_pierceDmg} 點傷害。`, 'player');
                    if (exT.curHp <= 0) killMob(exIdx);
                });
            }
        }
		
        let tag = 'player';
        let ext = '';
        if(result.heavy && result.crit) { tag = 'player-crit'; ext = ' (會心一擊!)'; }
        else if(result.crit) { tag = 'player-crit'; ext = ' (爆擊!)'; }
        else if(result.heavy) { tag = 'player-heavy'; ext = result.crush ? ' (粉碎!)' : ' (重擊!)'; }
        else if(result.graze) { tag = 'player-graze'; ext = ' (擦傷!)'; }
        if(result.dualx2) ext += ' (雙刃×2!)';   // ⚔️ 雙刀內建特性：5% 傷害×2（可與爆擊/重擊並發）

        // 切割：雙手劍重擊時觸發，自身攻速+20%持續2秒（與其他加速相乘疊加）
        let _cleaveProc = false;
        if(result.heavy && wpn && wpn.eff === 'cleave' && !player.classicMode) {   // 🎮 經典模式：停用切割
            let _wasCleave = player.statuses.cleave > 0;
            player.statuses.cleave = hasMastery('k_cleave') ? 40 : 20;   // 2秒（🏅 切割精通：4秒）
            if(!_wasCleave) { calcStats(); _cleaveProc = true; }
        }

        // 簡化戰鬥資訊，不顯示遠/近距離[cite: 8]
        logCombat(`${killPrefix}命中 <span class="${getMobColor(target.lv)}">${target.n}</span>，造成 ${result.dmg} 點傷害。${ext}`, tag);
        if(_cleaveProc) logCombat('<span class="text-teal-300 font-bold">流暢的手感，讓你更快砍出下一刀</span>', 'player');
        
        // 匕首/矛出血（力量/60 機率）＋🔧 出血精通：雙刀也比照匕首觸發（力量/60）；匕首/矛/雙刀皆可疊 10 層、每秒總傷害 ×(1+0.1×層)
        let _bleedWpnId = player.eq.wpn ? player.eq.wpn.id : '';
        let _canBleed = weaponHasBleed(_bleedWpnId) || (hasMastery('d_bleed') && getWeaponTags(_bleedWpnId).includes('雙刀'));
        let _bleedChance = _canBleed ? ((player.d.str || 0) / 60) : 0;
        if (player.eq.wpn && target.curHp > 0 && !player.classicMode && Math.random() < _bleedChance) {   // 🎮 經典模式：停用出血
            applyBleed(target, result.dmg, hasMastery('d_bleed') ? 10 : 5, hasMastery('d_bleed'));   // 🔧 出血精通：上限 10 層 + 每層 +10% 傷害
        }
        if (player.buffs.sk_warrior_throwaxe > 0 && !result.ranged && target.curHp > 0) { applyBleed(target, result.dmg, 5, hasMastery('k_dualaxe')); try { _vfxProjectile(_vfxSlotRect(target.uid), 'axe'); } catch(e){} }   // ✨ VFX：每次觸發射出旋轉金屬斧   // ⚔️ v3.1.74 戰斧投擲：持續(64秒)期間內每次近戰一般攻擊都附加出血，不消耗 buff；不輸出逐擊日誌（同匕首出血，避免洗版，出血傷害本身每秒有日誌）；🏅 雙斧精通：每層+10%
        // 單手鈍器鈍擊：命中使目標攻擊延遲 1 秒；每個敵人攻擊週期僅延遲一次（攻擊後重置），故最多 +1 秒、不會無限延遲
        let _isBlunt1h = !player.classicMode && !!(player.eq.wpn && getWeaponTags(player.eq.wpn.id).includes('單手鈍器'));   // 🎮 經典模式：停用鈍擊（延遲＋硬皮-1）
        if (player.eq.wpn && target.curHp > 0 && _isBlunt1h) {
            target._bluntShow = state.ticks + 30;   // 圖示顯示計時器：每次命中刷新（穩定亮著不閃），停手約 3 秒後熄滅
            if (!target._bluntDelayed) {
                if (target._atkCd === undefined) target._atkCd = Math.max(1, Math.floor((target.atkSpd || 2) * 10));
                target._atkCd += 10;   // 延遲 1 秒（10 ticks）
                target._bluntDelayed = true;
            }
        }
        // 🔧 硬皮消磨：玩家一般攻擊命中時固定再磨 1（basic），並依重擊與武器（單手鈍器鈍擊 -1/重擊 -5、雙手鈍器/屠龍劍重擊 -20、其餘重擊 -2）疊加扣減
        if (target.curHp > 0) wearHardSkin(target, player.eq.wpn ? player.eq.wpn.id : null, result.heavy, _isBlunt1h, true, player.classicMode);
        if (target.curHp > 0 && !result.ranged) applyPlayerWeakExpose(target);   // 🐉 弱點曝光：近距離命中時依鎖鏈劍/弱點精通附加堆疊
        // 🔧 蕾雅魔杖：近距離一般攻擊命中觸發冰裂術
        if (!result.ranged && target.curHp > 0 && wpn && wpn.meleeHitSpell) laiaWandHitProc(target);
        // 🏺 v3.1.80 奪魂者雙刃劍：一般攻擊命中觸發寒冷戰慄（每 cdSec 秒最多 1 次·免費施放·同 procSkill 傷害公式）
        if (wpn && wpn.onHitCastSkill && target.curHp > 0 && state.ticks >= (player._onHitCastCd || 0)) { player._onHitCastCd = state.ticks + ((wpn.onHitCastSkill.cdSec || 5) * 10); procFreeMagicSkill(target, wpn.onHitCastSkill.skId, capWpnEn((player.eq.wpn && player.eq.wpn.en) || 0), false, wpn); }
        // 🏺 遺物 命中附加固定屬性傷害（幽光的殘念 30火／冰石的強襲鎚 10水·不受魔抗/防禦影響）
        if (target.curHp > 0 && wpn && wpn.onHitEleDmg && (!wpn.onHitEleDmg.rate || Math.random() * 100 < wpn.onHitEleDmg.rate)) { let _oh = wpn.onHitEleDmg; target.curHp -= _oh.dmg; target.justHit = _oh.ele; mobWake(target); logCombat(`<span class="font-bold" style="color:${RELIC_ELE_COLOR[_oh.ele] || '#e2e8f0'};">附加 ${_oh.dmg} 點${RELIC_ELE_LABEL[_oh.ele] || ''}屬性傷害。</span>`, 'player-special'); }   // 🏺 rate：灰燼戰士的火焰長劍 3% 機率；無 rate→必定（幽光/冰石鎚）
        // 🏺 v3.5.27 水靈的魔力珠：一般攻擊命中「冰凍中」的敵人 → 追加 50 點固定傷害（不受魔抗/防禦影響）
        if (target.curHp > 0 && wpn && wpn.frozenBonusDmg && target.st && target.st.freeze > 0) { target.curHp -= wpn.frozenBonusDmg; target.justHit = 'water'; mobWake(target); logCombat(`<span class="font-bold text-sky-300">【${wpn.n}】</span>寒氣共鳴，對冰凍目標追加 ${wpn.frozenBonusDmg} 點傷害。`, 'player-special'); }
        // 🏺 遺物 弱點洞察（巨大螞蟻的複眼）：以剋制目標屬性的武器屬性命中→額外固定傷害
        if (target.curHp > 0) { let _whb = _relicWeakHitBonus(player); if (_whb > 0) { let _we = getWpnEle(player.eq.wpn, wpn); if (_we && _we !== 'none' && elementCounterMult(_we, target.e) > 1) { target.curHp -= _whb; target.justHit = _we; mobWake(target); logCombat(`<span class="font-bold text-amber-300">【弱點洞察】</span>擊中屬性弱點，額外造成 ${_whb} 點傷害。`, 'player-special'); } } }
        if (target.curHp <= 0) killMob(mapState.targetIdx);
        else renderMobs();
    } else {
        if (typeof vfxMiss === 'function') vfxMiss(target);
        logCombat(`對 <span class="${getMobColor(target.lv)}">${target.n}</span> 的攻擊未命中。`, 'miss');
    }

    // 連射（弓）：發動攻擊即判定（不論主攻擊命中與否）；每箭各自接受命中判定
    rapidfireProc(arrowData);

    // 雙擊（鋼爪/雙刀）：發動攻擊即依武器 comboRate% 機率追加一次完整一般攻擊（不論主攻擊命中與否）
    if (wpn && wpn.eff === 'combo' && Math.random() * 100 < (wpn.comboRate || 0)) procCombo(target, true);
    if (player.eq.offwpn) dualWieldOffhandAttack(target);   // ⚔️ 迅猛雙斧：副手第二攻擊來源（發動即判定）
    if (result.hit && hasMastery('k_royal_magic') && Math.random() < 0.1) royalMagicFreeCast();   // 👑 魔法精通：一般攻擊命中 10% 免MP額外施放選定攻擊技
    // 🔧 爆擊精通：一般攻擊爆擊時，額外觸發一次攻擊
    if (result && result.crit && hasMastery('d_crit')) procCombo(target);

    // === 熾炎天使弓：發動攻擊時 8% 觸發「月光爆裂」（主目標死亡則自動轉移到其他存活怪）===
    moonburstProc(target);

    // 法杖共鳴：一般攻擊(命中或未命中皆然)依機率免費施展光箭
    wandLightArrowProc(target);

    // 魔擊：一般攻擊(命中或未命中皆然)依機率追加一次必定命中重擊
    magicStrikeProc(target);

    // 龍的一擊（屠龍劍）：一般攻擊(命中或未命中皆然) 12% 機率
    dragonStrikeProc();

    // 🔧 武器附魔施放：一般武器命中與否皆判定；procOnHit 武器僅命中時判定
    weaponSpellProc(target, !!result.hit);

    // 🐉 龍鱗臂甲 額外攻擊：每攻擊週期結束後追加 N 次全傷害近戰攻擊
    dragonExtraAttackProc(target);
}

// ===== 🔧 龍的一擊（屠龍劍 dragonStrike）：發動一般攻擊時（不論命中）依武器機率(12%)觸發，
// 對場上所有敵人造成必定命中 1D(力量)+25 的無屬性物理固定傷害（不受魔抗/防禦/減免影響）=====
function dragonStrikeProc() {
    let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
    if (!wpn || !wpn.dragonStrike) return;
    if (Math.random() * 100 >= wpn.dragonStrike) return;
    let targets = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
    if (!targets.length) return;
    logCombat(`<span class="font-bold" style="color:#fca5a5;text-shadow:0 0 6px #dc2626;">【龍的一擊】</span>劍中的龍魂咆哮，衝擊貫穿了所有敵人！`, 'player-special');
    targets.forEach(m => {
        if (!m || m.curHp <= 0 || m._dead) return;
        let dmg = roll(1, Math.max(1, Math.floor(player.d.str || 1))) + 25;
        dmg = Math.max(1, Math.floor(dmg * fragileMult(m)));   // 🔮 脆弱（白鳥5）仍適用
        dmg = Math.max(1, Math.floor(dmg * wpnEnFinalMult(player.eq.wpn)));   // 🔧 武器強化 +11~+20：最終傷害倍率
        dmg = Math.max(1, Math.floor(dmg * rlFuryMult()));   // 🔮 紅獅5/5(×1.2)＋😡狂怒5/5(失血造傷·最多+20%) 最終傷害
        m.curHp -= dmg;
        m.justHit = true;
        mobWake(m);
        logCombat(`龍之衝擊命中 <span class="${getMobColor(m.lv)}">${m.n}</span>，造成 ${dmg} 點固定傷害。`, 'player');
        if (m.curHp <= 0) { let ri = mapState.mobs.findIndex(x => x && x.uid === m.uid); if (ri !== -1) killMob(ri); }
    });
    renderMobs();
}

// 🌨️🔥 持續傷害型增益（在輔助欄勾選維持，但屬傷害技能）：每隔 sk.stormInterval ticks 對全體敵人造成 sk.dmgDice 該屬性魔法傷害（公式同 castSkill 全體魔法）；
//      若 sk.freezeHitOff 有定義，則依（魔法命中＋freezeHitOff）機率冰凍非頭目。冰雪颶風(水/4秒/冰凍-3)、火牢(火/2秒/無異常) 皆走此函式。
const STORM_BUFF_SKILLS = ['sk_blizzard_storm', 'sk_fire_prison'];
const STORM_ELE_GLOW = { fire: '#fca5a5;text-shadow:0 0 6px #dc2626', water: '#a5f3fc;text-shadow:0 0 6px #38bdf8', wind: '#67e8f9;text-shadow:0 0 6px #06b6d4', earth: '#fcd34d;text-shadow:0 0 6px #b45309', none: '#d8b4fe;text-shadow:0 0 6px #a855f7' };
const STORM_ELE_COUNTER = { fire: 'earth', earth: 'wind', wind: 'water', water: 'fire' };   // 攻擊屬性剋制的目標屬性（命中該屬性 +6 固定）
function stormBuffTick(sk, noMageBonus) {
    if (!sk) return;
    let targets = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
    if (!targets.length) return;
    let mageDmgMult = 1.0;
    let dice = sk.dmgDice || [1, 10];
    let canFreeze = (sk.freezeHitOff !== undefined);
    let glow = STORM_ELE_GLOW[sk.ele] || STORM_ELE_GLOW.none;
    let dmgLog = [], frozeLog = [];
    targets.forEach((t, _illusionIdx) => {
        if (t.curHp <= 0) return;
        let isCrit = Math.random() * 100 < (player.d.magicCrit || 0);
        let critMult = isCrit ? (1 + (player.d.magicCritDmg || 0) / 100) : 1.0;
        let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
        let mrFactor = mrMult(effMr);
        let baseRoll = sk.multiDmg ? sk.multiDmg.reduce((s, seg) => s + roll(seg[0], seg[1]), 0) : roll(dice[0], dice[1]);   // 🔧 支援多段 multiDmg(如冰雪暴 4×2D10)·單段 dmgDice(冰雪颶風)照舊
        let spCoef = magicDamageCoef(player.d, magicAttrDefense(t, sk.ele || 'none'), sk.tier);
        let core = magicBaseDamage(baseRoll, player.d, sk.dmgBase || 0, true) * spCoef * critMult;
        let d = Math.floor(core * mrFactor);
        d = Math.max(1, Math.floor(Math.max(1, d) * elementCounterMult(sk.ele, t.e)));   // ⚔️ 屬性剋制 ×1.4(剋)/×0.6(被剋)（取代舊 +6 固定）
        d = Math.floor(d * mageDmgMult);
        if (sk.n === '火牢' && player.eq && player.eq.armor && (DB.items[player.eq.armor.id] || {}).firePrisonMult) d = d * DB.items[player.eq.armor.id].firePrisonMult;   // 🏺 v3.5.27 黝黑的烈火皮囊：火牢傷害加倍
        d = Math.max(1, Math.floor(d * rlFuryMult()));   // 🔮 紅獅5/5＋😡狂怒5/5 最終傷害
        d = Math.max(1, Math.floor(d * fragileMult(t) * wpnEnFinalMult(player.eq && player.eq.wpn)));    // 🔮 脆弱（白鳥5）；🔧 武器強化 +11~+20 最終倍率（魔法 DoT，與玩家傷害魔法 castSkill 一致）
        d = illusionMagicDmg(d, true, _illusionIdx === 0); t.curHp -= d; t.justHit = (sk.ele && sk.ele !== 'none') ? sk.ele : 'magic'; mobWake(t);   // 🔮 幻覺2件每次法術僅回一次MP；5件仍逐目標二次傷害
        dmgLog.push(`<span class="${getMobColor(t.lv)}">${t.n}</span> ${d}${isCrit ? '(爆)' : ''}`);
        if (t.curHp <= 0) {
            let ri = mapState.mobs.findIndex(x => x && x.uid === t.uid); if (ri !== -1) killMob(ri);
        } else if (canFreeze && !(t.boss && BOSS_IMMUNE.includes('freeze')) && abnormalMagicHit(t, 20, sk.freezeHitOff)) {   // 冰凍：以（魔法命中+freezeHitOff）判定（頭目免疫冰凍）
            if (!t.st) t.st = newMobStatus();
            t.st.freeze = 60;   // 6 秒
            frozeLog.push(`<span class="${getMobColor(t.lv)}">${t.n}</span>`);
        }
    });
    if (dmgLog.length) logCombat(`<span class="font-bold" style="color:${glow};">【${sk.n}】</span>${dmgLog.join('、')}`, 'dot');   // 🟢 火牢/冰雪颶風＝持續傷害(DoT)→綠色 dot 分類(原 player-special 走藍色攻擊條·被誤看成一般攻擊)
    if (frozeLog.length) logCombat(`<span class="text-sky-300 font-bold">${sk.n}</span> 冰凍了 ${frozeLog.join('、')}！`, 'magic');
    if (!state.ff) renderMobs();
}

// ===== 🔧 武器附魔施放（spellProc）：發動一般攻擊時依機率「額外施放」武器內建的魔法（不需學會該技能）=====
// 機率依武器設定；必定命中；傷害套統一魔法公式，武器階級依潘朵拉權重／傳說／遺物判定，再經 MR、屬性剋制與武器強化倍率。
const ELE_CN = { fire: '火', water: '水', wind: '風', earth: '地', none: '無' };
// 🔧 武器毒咒 proc（死亡之指）：攻擊時 rate% 對目標施加中毒 DoT（每 tick 秒受到 dmg 點，持續 dur 秒）；玩家與傭兵共用
function applyWeaponProcPoison(target, pp, finalMult, src) {
    if (!pp) return;
    if (Math.random() * 100 >= (pp.rate || 2)) return;
    let t = (target && target.curHp > 0) ? target : null;
    if (!t) { let alive = mapState.mobs.filter(m => m && m.curHp > 0); if (!alive.length) return; t = alive[Math.floor(Math.random() * alive.length)]; }
    if (!t.st) t.st = newMobStatus();
    let _pd = Math.max(1, Math.floor(roll(pp.dmg[0], pp.dmg[1]) * (finalMult || 1)));   // 🔧 武器強化 +1~+20 最終倍率：固定中毒 DoT 也吃（由呼叫端傳入施法者武器倍率）
    t.st.poison = (pp.dur || 15) * 10;
    t.st.poisonTick = (pp.tick || 3) * 10;
    t.st.poisonStacks = Math.max(1, t.st.poisonStacks || 0);
    t.st.poisonUnit = Math.max(t.st.poisonUnit || 0, _pd);
    t.st.poisonDmg = t.st.poisonUnit * t.st.poisonStacks;
    t.st.poisonSrc = src || 'player';   // 🎯 DPS：武器毒咒 DoT 施加者（玩家路徑不傳→'player'）
    mobWake(t);
    // 🔧 死亡之指毒咒：不再輸出「敵人中毒」套用訊息（只保留每秒中毒傷害日誌）
}
// 💥 猛爆劇毒（破壞雙刀/破壞鋼爪）：依 (rateBase + ratePerEn×強化)% 機率對目標附加；每秒固定 100 真傷、持續 5 秒、最多 1 層（覆蓋刷新）。獨立 m._burstPoison 欄位（不與一般中毒 s.poison 衝突）。玩家與傭兵共用
function applyWeaponBurstPoison(target, cfg, en, finalMult, src) {
    if (!cfg) return;
    let rate = (cfg.rateBase != null ? cfg.rateBase : 1) + (cfg.ratePerEn != null ? cfg.ratePerEn : 1) * (en || 0);
    if (Math.random() * 100 >= rate) return;
    let t = (target && target.curHp > 0) ? target : null;
    if (!t) { let alive = mapState.mobs.filter(m => m && m.curHp > 0); if (!alive.length) return; t = alive[Math.floor(Math.random() * alive.length)]; }
    let _bd = Math.max(1, Math.floor(100 * (finalMult || 1)));   // 🔧 武器強化 +1~+20 最終倍率：固定 100/秒 真傷也吃（由呼叫端傳入施法者武器倍率）
    t._burstPoison = { dmg: _bd, left: 50, src: src || 'player' };   // (100×最終倍率)/秒 × 5 秒(50 ticks)，最多 1 層→覆蓋刷新；🎯 DPS src=施加者
    mobWake(t);
    logCombat(`<span class="font-bold" style="color:#a3e635;text-shadow:0 0 6px #65a30d;">【猛爆劇毒】</span><span class="${getMobColor(t.lv)}">${t.n}</span> 陷入猛爆劇毒（每秒 ${_bd} 真傷，5 秒）。`, 'player');
}
// 🏺 v3.1.80 火屬性傷害法術池（思克巴女皇的熱情魔杖 proc 用）：type:'atk' 且 ele:'fire' 且有傷害骰的技能（首次使用時建立一次·玩家與傭兵共用）
let _FIRE_PROC_POOL = null;
function _fireProcPool() {
    if (!_FIRE_PROC_POOL) _FIRE_PROC_POOL = Object.keys(DB.skills).filter(function(id){ let s = DB.skills[id]; return s && s.type === 'atk' && s.ele === 'fire' && (s.dmgDice || s.multiDmg) && !s.summon; });
    return _FIRE_PROC_POOL;
}
// 🌑 武器附帶狀態技能 proc（惡魔王武器・疾病術）：攻擊時 rate% 對目標施放指定技能的異常狀態（走 applyMobStatus，含魔法命中抵抗）；玩家與傭兵共用
function applyWeaponProcStatusSkill(target, cfg) {
    if (!cfg) return;
    if (Math.random() * 100 >= (cfg.rate || 10)) return;
    let t = (target && target.curHp > 0) ? target : null;
    if (!t) { let alive = mapState.mobs.filter(m => m && m.curHp > 0); if (!alive.length) return; t = alive[Math.floor(Math.random() * alive.length)]; }
    let sk = DB.skills[cfg.skId];
    if (!sk || !sk.status) return;
    applyMobStatus(t, sk.status, sk.n);
}
function weaponSpellProc(target, attackHit) {
    // 🪆 魔法娃娃 proc（玩家專用·攻擊時觸發；置於武器判定之前→無武器也生效；經典模式亦正常生效）
    {
        let _dl = player.eq.doll ? DB.items[player.eq.doll.id] : null;
        if (_dl) {
            if (_dl.procBonusDmg && target && target.curHp > 0 && Math.random() * 100 < _dl.procBonusDmg.rate) {
                let _add = _dl.procBonusDmg.dmg;
                target.curHp -= _add; target.justHit = target.justHit || 'phys'; mobWake(target);
                logCombat(`<span class="font-bold text-amber-300">【${_dl.n}】</span>額外造成 ${_add} 點傷害。`, 'player-special');
                let _ri = mapState.mobs.findIndex(m => m && m.uid === target.uid);
                if (target.curHp <= 0) { if (_ri !== -1) killMob(_ri); } else if (!state.ff) renderMobs();
            }
            if (_dl.procPoisonRate) applyWeaponProcPoison(target, { rate: _dl.procPoisonRate, dmg: [2, 5], dur: 10, tick: 3 }, wpnEnFinalMult(player.eq.wpn));
            if (_dl.procSkill && Math.random() * 100 < (_dl.procRateBase || 1)) {
                let _t2 = (target && target.curHp > 0) ? target : null;
                if (!_t2) { let _al = mapState.mobs.filter(m => m && m.curHp > 0); if (_al.length) _t2 = _al[Math.floor(Math.random() * _al.length)]; }
                if (_t2) procFreeMagicSkill(_t2, _dl.procSkill, 0, false, _dl);
            }
        }
    }
    let inst = player.eq.wpn;
    let wpn = inst ? DB.items[inst.id] : null;
    if (!wpn) return;
    if (wpn.procOnHit && !attackHit) return;   // 🏺 長老的雷電能量：僅一般攻擊實際命中才觸發極道落雷
    if (wpn.procPoison) applyWeaponProcPoison(target, wpn.procPoison, wpnEnFinalMult(inst));   // 🔧 死亡之指：攻擊時毒咒（吃武器強化最終倍率）
    if (wpn.procBurstPoison) applyWeaponBurstPoison(target, wpn.procBurstPoison, capWpnEn(inst.en), wpnEnFinalMult(inst));   // 💥 破壞雙刀/鋼爪：攻擊時猛爆劇毒（吃武器強化最終倍率）
    if (wpn.procStatusSkill) applyWeaponProcStatusSkill(target, wpn.procStatusSkill);   // 🌑 惡魔王武器：攻擊時 10% 施放疾病術
    // 🏺 v3.1.80 思克巴女皇的熱情魔杖：攻擊時 10% 機率隨機觸發一個火屬性傷害法術（免費施放·同 procSkill 公式·主目標死亡轉隨機敵人）
    if (wpn.procFireSkillRate && Math.random() * 100 < wpn.procFireSkillRate) {
        let _ft = (target && target.curHp > 0) ? target : null;
        if (!_ft) { let _fa = mapState.mobs.filter(m => m && m.curHp > 0); if (_fa.length) _ft = _fa[Math.floor(Math.random() * _fa.length)]; }
        let _fp = _fireProcPool();
        if (_ft && _fp.length) procFreeMagicSkill(_ft, _fp[Math.floor(Math.random() * _fp.length)], capWpnEn(inst.en), false, wpn);
    }
    // 👹 隱藏的魔族武器：紅惡靈逆襲(4D10水魔傷·受魔法傷害公式·吸10%HP) / 藍惡靈奪魔(回3D6 MP)，4% + 每強化 +1%（經典模式亦可觸發）
    if (wpn.redSpecter || wpn.blueSpecter) {
        let _en = capWpnEn(inst.en);
        if (wpn.redSpecter && Math.random() * 100 < (4 + _en)) {
            let t = (target && target.curHp > 0) ? target : null;
            if (!t) { let _al = mapState.mobs.filter(m => m && m.curHp > 0); if (_al.length) t = _al[Math.floor(Math.random() * _al.length)]; }
            if (t) {
                let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
                let core = magicBaseDamage(roll(4, 10), player.d, 0, true) * weaponMagicDamageCoef(player.d, wpn, t, 'water') * enhanceWpnFinalMult(_en, wpn);
                let dmg = Math.floor(core * mrMult(effMr));
                dmg = Math.max(1, Math.floor(Math.max(1, dmg) * fragileMult(t) * elementCounterMult('water', t.e)));   // ⚔️ 屬性剋制 ×1.4(剋)/×0.6(被剋)
                if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
                dmg = illusionMagicDmg(dmg, true);   // 🔮 幻覺2/5回MP＋5/5：紅惡靈逆襲屬免費觸發魔法
                let _hl = Math.floor(dmg * 0.10);
                t.curHp -= dmg; t.justHit = 'water'; mobWake(t);
                player.hp = Math.min(player.mhp, player.hp + _hl);
                logCombat(`<span class="font-bold" style="color:#f87171;text-shadow:0 0 6px #dc2626;">【紅惡靈逆襲】</span>對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dmg} 點水屬性魔法傷害，恢復 ${_hl} 點 HP。`, 'player-special');
                let _ri = mapState.mobs.findIndex(m => m && m.uid === t.uid);
                if (t.curHp <= 0) { if (_ri !== -1) killMob(_ri); } else if (!state.ff) renderMobs();
                updateUI();
            }
        }
        if (wpn.blueSpecter && Math.random() * 100 < (4 + _en)) {
            let _mp = rollDice(3, 6);
            player.mp = Math.min(player.mmp, player.mp + _mp);
            logCombat(`<span class="font-bold" style="color:#60a5fa;text-shadow:0 0 6px #2563eb;">【藍惡靈奪魔】</span>奪取魔力，恢復 ${_mp} 點 MP。`, 'player-special');
            updateUI();
        }
    }
    // 🌅 遺物 九尾妖狐的怒火 procSkill2：第二觸發槽（獨立機率 rate%·免費施放·同 procSkill 傷害公式）——與主 procSkill 各自判定互不影響
    if (wpn.procSkill2 && wpn.procSkill2.skId && Math.random() * 100 < (wpn.procSkill2.rate || 5)) {
        let _t2 = (target && target.curHp > 0) ? target : null;
        if (!_t2) { let _al2 = mapState.mobs.filter(m => m && m.curHp > 0); if (_al2.length) _t2 = _al2[Math.floor(Math.random() * _al2.length)]; }
        if (_t2) procFreeMagicSkill(_t2, wpn.procSkill2.skId, capWpnEn(inst.en), false, wpn);
    }
    if (!wpn.spellProc && !wpn.procSkill) return;
    let en = capWpnEn(inst.en);
    if (Math.random() * 100 >= ((wpn.procRateBase || 1) + (wpn.procRatePerEn != null ? wpn.procRatePerEn : 1) * en)) return;   // 預設 1% + 每強化 +1%；🔧 巴風特魔杖 procRateBase:2/procRatePerEn:2
    let t = (target && target.curHp > 0) ? target : null;
    if (!t) {
        let alive = mapState.mobs.filter(m => m && m.curHp > 0);
        if (!alive.length) return;
        t = alive[Math.floor(Math.random() * alive.length)];
    }
    if (wpn.spellProc) procWeaponSpell(t, wpn.spellProc, en);
    else if (wpn.procSkill) procFreeMagicSkill(t, wpn.procSkill, en, false, wpn);   // 🔧 武器免費施法：階級依潘朵拉權重／傳說／遺物判定
}
// 🐍 詛咒稻草人：目標帶 st.strawCurse 層數時，受到攻擊即消耗 1 層並額外承受 80 點水屬性魔法固定傷害（無視魔抗/防禦·比照 onHitEleDmg）。3 把武器種下(庫庫爾坎之矛/鐵手甲/蛇神倒勾獠牙)。掛玩家主攻擊(js/04)與傭兵主攻擊(js/06)兩處主命中。
function consumeStrawCurse(m) {
    if (!m || m.curHp <= 0 || !m.st || !(m.st.strawCurse > 0)) return;
    m.st.strawCurse--;
    m.curHp -= 80; if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(m, 80, 'magic'); m.justHit = 'water'; mobWake(m);
    logCombat(`<span class="font-bold" style="color:#60a5fa;">【詛咒稻草人】</span>對 <span class="${getMobColor(m.lv)}">${m.n}</span> 額外造成 80 點水屬性魔法傷害。`, 'player-special');
    if (m.curHp <= 0) { let ri = mapState.mobs.findIndex(x => x && x.uid === m.uid); if (ri !== -1) killMob(ri); }
}
// 🏺 遺物 特定技能傷害倍率：掃描所有裝備欄，若帶 skillDmgMult{skId或技能名:倍率} 則相乘（暴走兔胡蘿蔔=冰錐 sk_ice_spike ×1.5、光束強化魔杖=光箭 sk_lightarrow/究極光裂術 sk_disintegrate ×1.5）。施放(castSkill·js/07)與觸發(procFreeMagicSkill)兩路徑皆呼叫。
function equipSkillDmgMult(sk, skId, who) {
    let _w = who || player;   // 🩹 v3.1.76 傭兵吃遺物：可傳入傭兵（掃 ally.eq）·未傳維持玩家
    let m = 1; if (!_w || !_w.eq) return m;
    for (let k in _w.eq) { let e = _w.eq[k]; if (!e) continue; let dd = DB.items[e.id]; if (!dd || !dd.skillDmgMult) continue; let v = dd.skillDmgMult[skId] || (sk && sk.n && dd.skillDmgMult[sk.n]); if (v) m *= v; }
    return m;
}
// 🔧 免費施放傷害魔法（不耗MP/不需學習）：武器觸發取武器權重階級，其餘來源取技能本身階級。
function procFreeMagicSkill(t, skId, en, areaHit, sourceItem, illusionRecoverMp) {
    let sk = DB.skills[skId];
    if (!sk || !t || t.curHp <= 0) return;
    if (sk.reqJustice && typeof pvpIsJustice === 'function' && !pvpIsJustice()) return;   // 💙 v3.5.75 究極光裂術：限正義性向（免費 proc 施放亦擋·靜默）
    if (sk.target === 'all' && !areaHit) {
        let uids = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead).map(m => m.uid);
        uids.forEach((uid, i) => {
            let mob = mapState.mobs.find(m => m && m.uid === uid && m.curHp > 0 && !m._dead);
            if (mob) procFreeMagicSkill(mob, skId, en, true, sourceItem, i === 0);
        });
        return;
    }
    let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    let mrFactor = mrMult(effMr);
    let isCrit = Math.random() * 100 < player.d.magicCrit;
    let spCoef = (sourceItem && sourceItem.type === 'wpn')
        ? weaponMagicDamageCoef(player.d, sourceItem, t, sk.ele || 'none')
        : magicDamageCoef(player.d, magicAttrDefense(t, sk.ele || 'none'), sk.tier);
    let mageDmgMult = 1.0;
    let critMult = isCrit ? (1 + player.d.magicCritDmg / 100) : 1.0;
    let dmgArray = sk.multiDmg || (sk.dmgDice ? [[sk.dmgDice[0], sk.dmgDice[1]]] : []);
    let total = 0;
    dmgArray.forEach((dc, idx) => {
        let isLastHit = idx === dmgArray.length - 1;
        let core = magicBaseDamage(roll(dc[0], dc[1]), player.d, isLastHit ? (sk.dmgBase || 0) : 0, isLastHit) * spCoef * critMult;   // 🔧 強化改吃 +11 最終倍率（見迴圈後）
        let d = Math.floor(core * mrFactor);
        d = Math.max(1, Math.floor(Math.max(1, d) * elementCounterMult(sk.ele, t.e)));   // ⚔️ 屬性剋制 ×1.4(剋)/×0.6(被剋)（取代舊 +6）
        d = Math.max(1, Math.floor(d * consumeWetMult(t, sk.ele)));   // 🏺 海洋水晶球：潮濕目標受風屬性魔法傷害 ×2 並解除（免費施法路徑）
        d = Math.floor(d * mageDmgMult);
        d = Math.max(1, Math.floor(d * rlFuryMult()));   // 🔮 紅獅5/5＋😡狂怒5/5 最終傷害
        // 🔧 魔導精通同屬性傷害×2 已移除(2026-07 用戶要求)
        total += Math.max(1, Math.floor(d * fragileMult(t)));
    });
    total = Math.floor(total * enhanceWpnFinalMult(en, player.eq.wpn && DB.items[player.eq.wpn.id]));   // 🔧 武器強化 +11~+20：最終傷害倍率（取代舊 (1+強化/20)）
    if (total > 0) total = Math.max(1, Math.floor(total * equipSkillDmgMult(sk, skId)));   // 🏺 遺物 特定技能傷害倍率（觸發路徑：冰之女王魔杖觸發的冰錐等亦吃暴走兔胡蘿蔔 ×1.5）
    if (total > 0) total = illusionMagicDmg(total, true, illusionRecoverMp !== false);   // 🔮 全體免費施法只在第一個目標回MP；5件仍逐目標生效
    if (total > 0) {
        t.curHp -= total; if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(t, total, 'magic'); t.justHit = (sk.ele && sk.ele !== 'none') ? sk.ele : 'magic'; t._spellHurt = true; mobWake(t);   // 🎬 v3.0.14 法術傷害→hurt(含頭目)；🌅 巨大骷髏：免費觸發法術視為魔法
        if(typeof playSpellFx === 'function') { try { playSpellFx(sk.n, t); } catch(e){} }   // ⚡ v2.7.16 娃娃/寵物免費施放(如娃娃克特/聖伯納→極道落雷)也疊法術特效
        if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
        logCombat(`<span class="font-bold" style="color:#93c5fd;text-shadow:0 0 6px #2563eb;">【${sk.n}】</span>額外施放，對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 <span class="${isCrit ? 'text-yellow-500 font-bold' : 'text-cyan-300'}">${total}</span> 點傷害${isCrit ? '（爆擊!）' : ''}。`, 'player-special');
        if (sk.lifesteal) { let _h = Math.min(total, player.mhp - player.hp); if (_h > 0) { player.hp += _h; logCombat(`你吸取了 ${_h} 點生命。`, 'heal'); } }   // 🩸 v3.2.43 稽核修：吸血法術（冷徹寒顫等）proc 觸發也回血（比照 castSkill js/07:703·奪魂者雙刃劍 onHitCastSkill）
    }
    if (t.curHp > 0 && sk.freeze) applyMobStatus(t, { kind: 'freeze', pbase: sk.freeze, dur: 6 }, sk.n);
    if (t.curHp > 0 && sk.status) applyMobStatus(t, sk.status, sk.n, spCoef);
    if (t.curHp <= 0) { let ri = mapState.mobs.findIndex(x => x && x.uid === t.uid); if (ri !== -1) killMob(ri); }
    else if (!state.ff) renderMobs();
}
// 🔧 暈眩抵抗：掃描所有裝備欄位（含頭盔/盾牌），取 stunResist 最大值依機率抵抗
//    修正：原僅掃 ring/amulet/belt，漏掉 helm/shield → 混沌頭盔/死亡之盾(stunResist:100) 失效
function playerStunResisted() {
    let pct = 0;
    WEIGHT_COUNT_SLOTS.forEach(k => { let e = player.eq[k]; if (e && DB.items[e.id] && DB.items[e.id].stunResist) pct = Math.max(pct, DB.items[e.id].stunResist); });
    if (player.skills && player.skills.includes('sk_royal_kingguard')) pct = Math.max(pct, 20);   // 👑 王者加護（被動）：20% 抵抗暈眩
    return pct > 0 && Math.random() * 100 < pct;
}
// 🔧 裝備狀態抵抗（沉睡/冰凍等）：掃描所有裝備欄位，取該抵抗欄位最大值，依機率抵抗（曼波帽子/深淵戒指 sleepResist/freezeResist）
function playerEquipStatusResist(field) {
    let pct = 0;
    WEIGHT_COUNT_SLOTS.forEach(k => { let e = player.eq[k]; if (e && DB.items[e.id] && DB.items[e.id][field]) pct = Math.max(pct, DB.items[e.id][field]); });
    return pct > 0 && Math.random() * 100 < pct;
}
// 🪆 統一玩家狀態抵抗/免疫（含魔法娃娃 freezeResist/stunResist/immParalyze/immSlow/abnormalResist…）：
//    kind ∈ freeze|stun|paralyze|sleep|slow|poison；掃 WEIGHT_COUNT_SLOTS（含 doll 槽）取免疫旗標/抵抗%＋通用 abnormalResist，回傳 true=本次抵抗/免疫。
function playerStatusResisted(kind) {
    let immF = { freeze: 'immFreeze', stun: 'immStun', paralyze: 'immParalyze', sleep: 'immSleep', slow: 'immSlow', poison: 'immPoison', burn: 'immBurn' }[kind];   // 🏺 遺物 詛咒三頭獸的犄角：immBurn→免疫灼燒
    let resF = { freeze: 'freezeResist', stun: 'stunResist', paralyze: 'paralyzeResist', sleep: 'sleepResist', slow: 'slowResist', poison: 'poisonResist' }[kind];
    let pct = 0;
    WEIGHT_COUNT_SLOTS.forEach(k => {
        let e = player.eq[k]; if (!e) return; let dd = DB.items[e.id]; if (!dd) return;
        if (immF && dd[immF]) pct = 100;
        if (resF && dd[resF]) pct = Math.max(pct, dd[resF]);
        if (dd.abnormalResist) pct = Math.max(pct, dd.abnormalResist);
    });
    if (kind === 'stun' && player.skills && player.skills.includes('sk_royal_kingguard')) pct = Math.max(pct, 20);   // 👑 王者加護
    if (kind === 'poison' && player.d && player.d.immPoison) return true;   // 潔尼斯戒指/龍騎士覺醒/娃娃 immPoison（recompute 已併入 d.immPoison）
    return pct > 0 && Math.random() * 100 < pct;
}
// 🆕 v2.6.11 [傭兵能力補完 #4] 傭兵版裝備狀態抵抗/免疫（比照 playerStatusResisted·讀 ally.eq/skills/d；WEIGHT_COUNT_SLOTS 含 doll 槽→同時涵蓋娃娃 immFreeze/stunResist…）。kind ∈ freeze|stun|paralyze|sleep|slow|poison。
function allyStatusResisted(ally, kind) {
    let immF = { freeze: 'immFreeze', stun: 'immStun', paralyze: 'immParalyze', sleep: 'immSleep', slow: 'immSlow', poison: 'immPoison', burn: 'immBurn' }[kind];   // 🏺 遺物 詛咒三頭獸的犄角：immBurn→免疫灼燒
    let resF = { freeze: 'freezeResist', stun: 'stunResist', paralyze: 'paralyzeResist', sleep: 'sleepResist', slow: 'slowResist', poison: 'poisonResist' }[kind];
    let pct = 0;
    WEIGHT_COUNT_SLOTS.forEach(k => {
        let e = ally.eq && ally.eq[k]; if (!e) return; let dd = DB.items[e.id]; if (!dd) return;
        if (immF && dd[immF]) pct = 100;
        if (resF && dd[resF]) pct = Math.max(pct, dd[resF]);
        if (dd.abnormalResist) pct = Math.max(pct, dd.abnormalResist);
    });
    if (kind === 'stun' && ally.skills && ally.skills.includes('sk_royal_kingguard')) pct = Math.max(pct, 20);   // 👑 王者加護
    if (kind === 'poison' && ally.d && ally.d.immPoison) return true;
    return pct > 0 && Math.random() * 100 < pct;
}
// 🪆 受傷時機率傷害減免（魔法娃娃：史巴托/巫妖 procDmgReduce{rate,amount}）：回傳減免後傷害；經典模式停用
function dollDamageReduced(dmg) {
    let e = player.eq.doll; let dd = e ? DB.items[e.id] : null;   // 🪆 經典模式亦正常生效
    if (dd && dd.procDmgReduce && Math.random() * 100 < dd.procDmgReduce.rate) {
        let _r = Math.min(dmg, dd.procDmgReduce.amount);
        if (_r > 0) { dmg = Math.max(0, dmg - _r); logCombat(`<span class="text-sky-300">【${dd.n}】減免了 ${_r} 點傷害。</span>`, 'magic'); }
    }
    return dmg;
}
// 🆕 v2.6.10 [傭兵能力補完 #3] 傭兵魔法娃娃受傷機率減免（procDmgReduce{rate,amount}·讀 ally.eq.doll；比照玩家 dollDamageReduced）。傭兵受物理/魔法傷害皆套。
function allyDollDamageReduced(ally, dmg) {
    let dd = (ally && ally.eq && ally.eq.doll) ? DB.items[ally.eq.doll.id] : null;
    if (dd && dd.procDmgReduce && Math.random() * 100 < dd.procDmgReduce.rate) {
        let _r = Math.min(dmg, dd.procDmgReduce.amount);
        if (_r > 0) { dmg = Math.max(0, dmg - _r); logCombat(`<span class="text-sky-300">【協力·${ally._allyName}·${dd.n}】減免了 ${_r} 點傷害。</span>`, 'magic'); }
    }
    return dmg;
}
// 單體：對 t 計算並套用一次附魔施放傷害（不負責 render；回傳是否擊殺）。aoe 由 procWeaponSpell 統一在外層迴圈處理。
function _procWeaponSpellHit(t, sp, en, illusionRecoverMp) {
    if (!t || t.curHp <= 0) return false;
    let _procWpn = player.eq.wpn && DB.items[player.eq.wpn.id];
    let core = magicBaseDamage(roll(sp.dice[0], sp.dice[1]), player.d, sp.flat || 0, true) * weaponMagicDamageCoef(player.d, _procWpn, t, sp.ele);
    let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    let mrFactor = mrMult(effMr);
    let _cm = elementCounterMult(sp.ele, t.e);   // ⚔️ 屬性剋制倍率 ×1.4(剋)/×0.6(被剋)/×1
    let d = Math.floor(core * mrFactor);
    // 🔧 魔導精通同屬性傷害×2 已移除(2026-07 用戶要求)
    d = Math.max(1, Math.floor(Math.max(1, d) * fragileMult(t) * _cm));
    d = Math.max(1, Math.floor(d * enhanceWpnFinalMult(en, player.eq.wpn && DB.items[player.eq.wpn.id])));   // 🔧 武器強化 +11~+20：最終傷害倍率（取代舊 (1+強化/20)·與一般武器一致）
    d = Math.max(1, Math.floor(d * rlFuryMult()));   // 🔮 紅獅5/5＋😡狂怒5/5 最終傷害
    if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
    d = illusionMagicDmg(d, true, illusionRecoverMp !== false);   // 🔮 全體 spellProc 只在第一個目標回MP；5件仍逐目標生效
    t.curHp -= d;
    if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(t, d, 'magic');   // 🌅 巨大骷髏：spellProc 視為魔法
    t.justHit = (sp.ele && sp.ele !== 'none') ? sp.ele : 'magic';
    t._spellHurt = true;   // 🎬 v3.0.14 法術傷害→hurt(含頭目)
    mobWake(t);
    if(typeof playSpellFx === 'function') { try { playSpellFx(sp.skn, t); } catch(e){} }   // ⚡ v2.7.16 武器附魔施放(如克特之劍→極道落雷 15% proc)也疊法術特效
    if (sp.heal && d > 0) { player.hp = Math.min(player.mhp, player.hp + Math.floor(d * sp.heal)); }   // 🐉 寒冰鎖鏈劍·冰之地裂術：恢復造成傷害的指定比例 HP
    let glow = (sp.ele === 'fire') ? '#fca5a5;text-shadow:0 0 6px #dc2626'
             : (sp.ele === 'wind') ? '#67e8f9;text-shadow:0 0 6px #06b6d4'
             : (sp.ele === 'water') ? '#93c5fd;text-shadow:0 0 6px #2563eb'
             : (sp.ele === 'earth') ? '#fcd34d;text-shadow:0 0 6px #b45309'
             : '#d8b4fe;text-shadow:0 0 6px #a855f7';
    let counterTxt = (_cm > 1) ? ' <span class="text-emerald-300 font-bold">(剋屬性!)</span>' : (_cm < 1 ? ' <span class="text-rose-300 font-bold">(被剋!)</span>' : '');
    logCombat(`<span class="font-bold" style="color:${glow};">【${sp.skn}】</span>武器之力爆發，對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${d} 點${ELE_CN[sp.ele] || ''}屬性魔法傷害！${counterTxt}`, 'player-special');
    // ⚡ 固定機率附加異常狀態（電光衝擊→暈眩／水之矛→冰凍）：sp.status.pct% 自有擲骰，命中即套用（force 繞過魔抗命中判定，BOSS 免疫仍生效）
    if (t.curHp > 0 && sp.status && Math.random() * 100 < sp.status.pct) applyMobStatus(t, { kind: sp.status.kind, dur: sp.status.dur || 4, force: true }, sp.skn);
    if (t.curHp <= 0) {
        let realIdx = mapState.mobs.findIndex(m => m && m.uid === t.uid);
        if (realIdx !== -1) killMob(realIdx);
        return true;
    }
    return false;
}
function procWeaponSpell(t, sp, en) {
    if (sp.aoe) {
        // 🔧 地獄火：對敵方全體各自施放（每隻獨立計算魔防/剋屬性）。以 uid 快照避免 killMob 改動 mapState.mobs 索引造成漏算。
        let uids = mapState.mobs.filter(m => m && m.curHp > 0).map(m => m.uid);
        uids.forEach((uid, i) => { let mob = mapState.mobs.find(m => m && m.uid === uid && m.curHp > 0); if (mob) _procWeaponSpellHit(mob, sp, en, i === 0); });
        if (!state.ff) renderMobs();
        return;
    }
    if (!_procWeaponSpellHit(t, sp, en)) renderMobs();   // 擊殺時 killMob 已負責重繪
}

// ===== 🔧 蕾雅魔杖：一般攻擊命中時觸發「冰裂術」（必中、受魔法傷害影響；對冰凍目標額外傷害並碎冰，否則機率冰凍）=====
function laiaWandHitProc(t) {
    let inst = player.eq.wpn; let w = inst ? DB.items[inst.id] : null;
    if (!w || !w.meleeHitSpell || !t || t.curHp <= 0) return;
    let sp = w.meleeHitSpell; let en = capWpnEn(inst.en);
    let core = magicBaseDamage(roll(sp.dice[0], sp.dice[1]), player.d, sp.flat || 0, true) * weaponMagicDamageCoef(player.d, w, t, sp.ele);
    let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    let mrFactor = mrMult(effMr);
    let wasFrozen = !!(t.st && t.st.freeze > 0);
    let d = Math.floor(core * mrFactor);
    d = Math.max(1, d);   // 武器 proc 的 ×(1+階級/10) 已由 weaponMagicDamageCoef 統一套用。
    if (wasFrozen) { d += (sp.shatter || 0); t.st.freeze = 0; }   // 冰凍目標：額外傷害並解除冰凍
    d = Math.max(1, Math.floor(Math.max(1, d) * fragileMult(t) * elementCounterMult(sp.ele, t.e)));   // ⚔️ 屬性剋制 ×1.4(剋)/×0.6(被剋)（取代舊 +6）
    d = Math.max(1, Math.floor(d * enhanceWpnFinalMult(en, w)));   // 🔧 武器強化 +11~+20：最終傷害倍率（取代舊 (1+強化/10)）
    d = Math.max(1, Math.floor(d * rlFuryMult()));   // 🔮 紅獅5/5＋😡狂怒5/5 最終傷害
    if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
    t.curHp -= d; if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(t, d, 'magic'); t.justHit = sp.ele; t._spellHurt = true; mobWake(t);   // 🎬 v3.0.14 法術傷害→hurt(含頭目)；🌅 巨大骷髏：冰裂術視為魔法
    if(typeof playSpellFx === 'function') { try { playSpellFx(sp.skn || '冰裂術', t); } catch(e){} }   // ⚡ v2.7.16 蕾雅魔杖命中觸發也疊法術特效（未註冊者自動略過）
    logCombat(`<span class="font-bold" style="color:#93c5fd;text-shadow:0 0 6px #2563eb;">【${sp.skn || '冰裂術'}】</span>對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${d} 點水屬性魔法傷害${wasFrozen ? '（冰碎!）' : ''}。`, 'player-special');
    if (t.curHp <= 0) { let ri = mapState.mobs.findIndex(x => x && x.uid === t.uid); if (ri !== -1) killMob(ri); return; }
    applyMobStatus(t, { kind: 'freeze', pbase: sp.freezePbase, dur: 6 }, sp.skn || '冰裂術');   // 機率冰凍目標
    if (!state.ff) renderMobs();
}

// 🔧 馴獸光環：場上有馴獸師(tamerAura)存活時，黑虎／地獄束縛犬(tamedByAura) 一般攻擊命中 +30
function tamerAuraHit(mob) {
    if (!mob || !mob.tamedByAura) return 0;
    if (typeof mapState === 'undefined' || !mapState.mobs) return 0;
    let hasTamer = mapState.mobs.some(m => m && m.curHp > 0 && !m._dead && m.tamerAura);
    return hasTamer ? 30 : 0;
}

// 🔧 屬性抗性 / ER 換算為有效百分比：≤50 時 1=1%；>50 時每 +5 才 +1%（例：55→51%、60→52%）
function effResistPct(v) {
    v = v || 0;
    if (v <= 50) return Math.max(0, v);
    return 50 + Math.floor((v - 50) / 5);
}
// 😡 狂怒 5/5 戰意比例：HP 每少 10% → 0.04（造傷+4%/受傷-4%），最多 0.20（HP≤50% 達上限）。未裝狂怒5→0。
function furyRageRatio() {
    if (!player || !player._setFury5) return 0;
    let miss = 1 - ((player.curHp != null ? player.curHp : player.hp) / Math.max(1, player.mhp));   // 🆕 v2.6.18：傭兵 getPhysicalDmg 換身路徑(會心一擊)讀 live curHp；真玩家無 curHp→退回 hp（不變·已 grep 確認 player 永無 curHp）
    return Math.min(0.20, Math.max(0, Math.floor(miss * 10 + 1e-9) * 0.04));   // +1e-9：吸收浮點誤差（如 1-0.9=0.0999…→floor 應得 1），確保「每少 10% 血」邊界正確
}
// 🔮 紅獅5/5(最終傷害×1.2) ＋ 😡 狂怒5/5(每少10%血造傷+4%·最多+20%) 的「玩家最終傷害」共用乘數（套用於所有原本掛 _setRedLion5 的點，無套裝時＝1.0）
function rlFuryMult() { return (player && player._setRedLion5 ? 1.2 : 1.0) * (1 + furyRageRatio()); }
// 🆕 v2.6.12 [傭兵能力補完 #5a] 傭兵版狂怒失血減傷比例（比照 furyRageRatio·用 ally.curHp/mhp）。
function allyFuryRageRatio(ally) {
    if (!ally || !ally._setFury5) return 0;
    let miss = 1 - ((ally.curHp || 0) / Math.max(1, ally.mhp || 1));
    return Math.min(0.20, Math.max(0, Math.floor(miss * 10 + 1e-9) * 0.04));
}
// 🆕 v2.6.18 [傭兵能力補完·中影響] 傭兵版最終傷害共用乘數＝🔴紅獅5(×1.2) × (1+😡狂怒5造傷)。對稱玩家 rlFuryMult()，套用於所有傭兵攻擊最終傷害輸出點（讀 ally.curHp·無套裝＝1.0）。原本傭兵只在部分魔法點吃紅獅5、物理全無→本版統一補齊紅獅5＋狂怒5。
function allyRlFuryMult(ally) { return (ally && ally._setRedLion5 ? 1.2 : 1.0) * (1 + allyFuryRageRatio(ally)); }
// 🆕 v2.6.12 #5a 傭兵受擊減傷 buff/套裝乘數（比照玩家 _drMult 的 holy_barrier/dragonscion/fury5；聖結界由 #1a 維持·龍裔由 allyDragonAct 施HP技時授予·狂怒5為套裝旗標）。物理/魔法受擊共用。
function allyBuffDmgReduceMult(ally) {
    let m = 1;
    if (ally && ally.buffs) {
        if (ally.buffs.sk_holy_barrier > 0) m *= 0.7;          // 聖結界：-30%
        if (ally.buffs.sk_set_dragonscion > 0) m *= 0.85;      // 🐉 龍血·龍裔：-15%
    }
    if (ally && ally._setFury5) m *= (1 - allyFuryRageRatio(ally));   // 😡 狂怒 5/5：依失血最多 -20%
    return m;
}
// 🔮 幻覺套裝魔法傷害鉤子：「非自動攻擊法術」＝不能在攻擊技能下拉選單選擇的傷害來源。
//   canTrigger=true：立方(和諧/燃燒)、冰雪颶風/火牢 DoT、魔爆、spellProc、procSkill 等免費觸發魔法；false：一般傷害法術、共鳴與反射。
//   2件→每次法術事件回一次「Lv/10」MP（AOE 不逐目標回）；5件→每個目標再受一次同傷（以 ×2 實現·防遞迴）。
function illusionMagicDmg(dmg, canTrigger, recoverMp) {
    if (!player || dmg <= 0 || !canTrigger) return dmg;
    if (player._setIllusion2 && recoverMp !== false) { let r = Math.floor((player.lv || 1) / 10); if (r > 0) player.mp = Math.min(player.mmp, player.mp + r); }   // 2件：每次法術事件回一次 Lv/10 MP
    if (player._setIllusion5) dmg = dmg * 2;   // 5件：符合條件的非自動攻擊法術傷害加倍（＝再受一次同傷）
    return dmg;
}

// 🏺 遺物 白螞蟻蛋殼：受到傷害時，對自身施展不消耗 MP 的初級治癒術（每 5 秒最多 1 次·物理/魔法受擊共用）
function _relicOnDamageHeal() {
    if (!player.d.onDmgHeal) return;
    if (state.ticks < (player._shellHealCd || 0)) return;
    let hsk = DB.skills[player.d.onDmgHeal]; if (!hsk || (!hsk.healDice && !hsk.classicHeal)) return;
    let amt = rollHealingSpell(hsk, player.d, player, player);
    player.hp = Math.min(player.mhp, player.hp + amt);
    player._shellHealCd = state.ticks + (player.d.onDmgHealCd || 5) * 10;   // 冷卻秒數（10 ticks/秒·白螞蟻蛋殼5秒/孵育螞蟻精華8秒）
    logCombat(`<span class="font-bold" style="color:#86efac;">【${player.d.onDmgHealName || '白螞蟻蛋殼'}】</span>受擊自癒，恢復 ${amt} 點 HP。`, 'heal');
    updateUI();
}
// 🏺 遺物 法師的護身短刀：受到傷害時 rate% 免費施放「自動攻擊技能設定(sel-atk-skill)」的傷害法術（不消耗 MP·物理/魔法受擊共用·玩家專用）。
function _relicOnHurtCast(mob) {
    let w = player.eq && player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
    if (!w || !w.castOnHurt) return;
    if (Math.random() * 100 >= (w.castOnHurt.rate || 0)) return;
    let el = (typeof document !== 'undefined') ? document.getElementById('sel-atk-skill') : null;
    let skId = el ? el.value : '';
    let sk = skId ? DB.skills[skId] : null;
    if (!sk || sk.dmgType === 'physical' || (!sk.dmgDice && !sk.multiDmg)) return;   // 只免費放傷害法術（物理技能不適用）
    let t = (typeof getTarget === 'function') ? getTarget() : null;
    if (!t || t.curHp <= 0) { t = (mob && mob.curHp > 0) ? mob : (mapState.mobs.filter(m => m && m.curHp > 0)[0] || null); }
    if (!t) return;
    let en = capWpnEn((player.eq.wpn && player.eq.wpn.en) || 0);
    logCombat(`<span class="font-bold" style="color:#c4b5fd;text-shadow:0 0 6px #7c3aed;">【護身短刀】</span>受擊反擊，免費施放 <span class="text-violet-300">${sk.n}</span>。`, 'player-special');
    procFreeMagicSkill(t, skId, en, false, w);
}
// 🏺 v3.1.76 傭兵版受擊自癒（傭兵吃遺物·物理/魔法受擊共用·每傭兵獨立冷卻 ally._shellHealCd·回復戰鬥HP curHp·可救回 <=0 血）
function _allyRelicOnDamageHeal(ally) {
    let _d = ally.d || {};
    if (!_d.onDmgHeal) return;
    if (state.ticks < (ally._shellHealCd || 0)) return;
    let hsk = DB.skills[_d.onDmgHeal]; if (!hsk || (!hsk.healDice && !hsk.classicHeal)) return;
    let amt = rollHealingSpell(hsk, _d, ally, ally);
    ally.curHp = Math.min(ally.mhp || 1, (ally.curHp || 0) + amt);
    ally._shellHealCd = state.ticks + (_d.onDmgHealCd || 5) * 10;
    logCombat(`<span class="font-bold" style="color:#86efac;">【${_d.onDmgHealName || '白螞蟻蛋殼'}】</span>協力·${ally._allyName} 受擊自癒，恢復 ${amt} 點 HP。`, 'heal', 'mercenary');
}
// 💥 遺物 爆彈花蕊（頭盔）：受到傷害時，對自己與全體敵人各造成 hurtExplode 點火屬性魔法傷害（受魔法傷害影響）。
//    自傷只扣 player.hp、不在此呼叫 killPlayer——由呼叫端既有死亡檢查統一結算（避免 loop 中 killMob 與玩家死亡交錯）。
function bombFlowerExplode(who) {
    let _w = who || player;   // 🩹 v3.1.76 傭兵吃遺物：可傳入傭兵（讀 ally.d·自傷扣 curHp）·未傳維持玩家
    if (!_w.d || !_w.d.hurtExplode) return;
    let base = _w.d.hurtExplode;
    let coef = 1 + 3 * (_w.d.magicDmg || 0) / 16;   // 受魔法傷害影響（同一般魔攻係數）
    let uids = mapState.mobs.filter(m => m && m.curHp > 0).map(m => m.uid);   // uid 快照·避免 killMob 改索引
    let hitAny = false;
    uids.forEach(function (uid) {
        let t = mapState.mobs.find(m => m && m.uid === uid && m.curHp > 0);
        if (!t) return;
        let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
        let dd = Math.floor(base * coef * mrMult(effMr)) - (t.dr || 0);
        dd = Math.max(1, Math.floor(Math.max(1, dd) * fragileMult(t) * elementCounterMult('fire', t.e)));
        if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
        t.curHp -= dd; t.justHit = 'fire'; mobWake(t);
        logCombat(`<span class="font-bold" style="color:#fca5a5;text-shadow:0 0 6px #dc2626;">【爆彈花蕊】</span>爆裂波及 <span class="${getMobColor(t.lv)}">${t.n}</span>，造成 ${dd} 點火屬性魔法傷害。`, 'player-special');
        if (t.curHp <= 0) { let ri = mapState.mobs.findIndex(m => m && m.uid === uid); if (ri !== -1) killMob(ri); }
        hitAny = true;
    });
    // 反噬屬於火屬性魔法傷害：玩家與傭兵皆套用自身 MR、火屬性抗性；不套用對敵剋制與物理 DR。
    let selfMrFactor = mrMult(_w.d.mr || 0);
    let selfFireFactor = Math.max(0, Math.min(1, 1 - effResistPct(_w.d.resFire || 0) / 100));
    let self = Math.max(1, Math.floor(base * coef * selfMrFactor * selfFireFactor));
    if (_w === player) { player.hp -= self; logCombat(`<span class="font-bold" style="color:#fca5a5;">【爆彈花蕊】</span>爆裂反噬，你受到 ${self} 點火屬性魔法傷害。`, 'player'); }
    else { _w.curHp -= self; logCombat(`<span class="font-bold" style="color:#fca5a5;">【爆彈花蕊】</span>爆裂反噬，協力·${_w._allyName} 受到 ${self} 點火屬性魔法傷害。`, 'enemy'); }   // 🩹 v3.1.76 傭兵自傷扣 curHp（倒地由呼叫端既有檢查結算）
    if (hitAny && !state.ff) renderMobs();
}
// 頭目狂暴：當前 HP 嚴格低於門檻時才生效；資料未設定時維持既有戰鬥數值。
function mobRageActive(mob) {
    let hpPct = Number(mob && mob.rageHpPct) || 0;
    return hpPct > 0 && mob.hp > 0 && mob.curHp < mob.hp * hpPct;
}
function mobRageHitBonus(mob) {
    let baseHit = (mob && mob.hit) || 0;
    return mobRageActive(mob) ? baseHit * (Number(mob.rageHitMult) || 1) : baseHit;
}
function mobRageDmgMult(mob) {
    return mobRageActive(mob) ? (Number(mob.rageDmgMult) || 1) : 1;
}

// ===== 🌅 牛鬼之子的黑戒 statusHealHp：受到異常狀態影響時恢復 N HP =====
//  玩家「中招」無統一入口（狀態賦值散落 applyMobMagic 各分支＋enemyPhysicalAttack 的暈眩/onHitPoison）→ 用「進入前快照 / 離開後比對」包裝兩個函式：
//  快照記下當下 >0 的狀態鍵，函式跑完後出現「新轉正的鍵」＝本次中招 → 恢復裝備上 statusHealHp 總和（一次中招只觸發一次；刷新既有狀態不觸發）。
let _statusHealDepth = 0;   // 🌅 審查修：巢狀 wrapper 守衛——applyMobMagic(extra_attack 等) 內層又呼叫被包裝的 enemyPhysicalAttack 時，只有最外層比對補血（防一次中招 +50×2）
function _playerStatusSnap() {
    if (!player || !player.statuses) return null;
    let s = {}; for (let k in player.statuses) if (player.statuses[k] > 0) s[k] = 1;
    return s;
}
function _statusInflictHeal(beforeKeys) {
    if (!beforeKeys || !player || !player.statuses || player.dead) return;
    let heal = 0;
    if (player.eq) for (let k in player.eq) { let it = player.eq[k]; if (!it || !it.id) continue; let d0 = DB.items[it.id]; if (d0 && d0.statusHealHp) heal += d0.statusHealHp; }
    if (!heal) return;
    for (let k in player.statuses) {
        if (player.statuses[k] > 0 && !beforeKeys[k]) {
            player.hp = Math.min(player.mhp, player.hp + heal);
            logCombat(`<span class="text-emerald-300 font-bold">【牛鬼之子的黑戒】</span>異常狀態激發生機，恢復了 ${heal} 點 HP。`, 'heal');
            return;
        }
    }
}
function enemyPhysicalAttack(mob, idx, stunChance = 0, atkDmg = null, atkDb = null) {
    let _snap = _playerStatusSnap(); _statusHealDepth++;
    try { return _enemyPhysicalAttackInner(mob, idx, stunChance, atkDmg, atkDb); }
    finally { _statusHealDepth--; if (_statusHealDepth === 0) _statusInflictHeal(_snap); }
}
function _enemyPhysicalAttackInner(mob, idx, stunChance = 0, atkDmg = null, atkDb = null) {   // atkDmg/atkDb：連擊技覆寫骰子/加值（如鐮刀劍氣斬 9×3D70+99，與一般攻擊不同）
    if(player.dead) return;
    if(inAbsBarrier()) return;   // 🛡️ 絕對屏障：不受任何傷害（敵方一般/連擊攻擊完全無效，亦不觸發反擊）
    if(!mob || mob.curHp <= 0) return;   // 🔧 攻擊者已死亡（如連擊中被反擊/居合反殺）：死怪不得繼續攻擊
    if (typeof _mobAnimTrigger === 'function') _mobAnimTrigger(mob, 'attack');   // 🎞️ 序列幀：攻擊動作（有 attack_*.png 幀才會播·登場/技能鎖定播放中會被忽略·見 js/09）
    mob._facePartyKey = 'P';   // 🧭 只記錄隊伍位置鍵；避免 mob→player 與 player→mob 形成循環參照
    delete mob._faceTgt;

    // 🗼 沉睡：必定被命中、無法迴避，受擊後立即清醒
    let _asleep = !!(player.statuses && player.statuses.sleep > 0);
    // 🔧 暗隱術：100% 迴避一次物理攻擊（迴避後失效並進入 5 秒冷卻）；否則依 ER 有效迴避率判定
    let _stealthDodge = !!(player.buffs && player.buffs.sk_dark_stealth > 0);
    let _titanEr = (player.skills.includes('sk_warrior_titan_bullet') && player.hp < player.mhp * titanThreshold()) ? 50 : 0;   // ⚔️ 泰坦：子彈：HP<40%(反彈精通 80%) 時 ER+50（即時判定，不入 recomputeStats）
    if (!mob.magicMelee && !_asleep && !(player.d && player.d.noEvade && !_stealthDodge) && (_stealthDodge || roll(1, 100) <= effResistPct(player.d.er + _titanEr))) {   // 😤 magicMelee(白目幻術士)：一般攻擊視為魔法·必定命中不可迴避   // 🏺 笨重的鋼鐵石盾 noEvade：無法迴避（暗隱術 100% 迴避不受限）
        logCombat(`${player.name || '你'} 成功迴避攻擊。`, 'evade');
        if (hasMastery('d_evade')) { let _s = player._darkEvadeStack || 0; player._darkEvadeStack = 0; if (player.d) player.d.er -= _s; player._darkEvadeSure = true; player._darkEvadeCrit = true; }   // 🔧 迴避精通：清空累積ER，下次一般攻擊必中且必爆
        if (player._setShadow3) { player.hp = Math.min(player.mhp, player.hp + Math.floor(player.mhp * 0.02)); }   // 🔧 暗影 3/5：觸發迴避恢復 2% HP
        // 🔧 暗隱術：消耗該次 100% 迴避後失效，並進入 5 秒冷卻
        if (_stealthDodge) {
            player.buffs.sk_dark_stealth = 0; player._darkStealthCd = state.ticks + 50; calcStats();
            logCombat('<span class="text-fuchsia-300">暗影隱蔽消散了。</span>', 'magic');
        }
        // 武士刀居合：無「真盾牌」（臂甲可發動）且敵人攻擊被迴避時，50% 對攻擊者打一次必定命中的一般攻擊（🏅 反擊精通：100%）
        if (!player.dead && (!player.eq.shield || _isArmguard(player.eq.shield)) && mob.curHp > 0 && player.eq.wpn && getWeaponTags(player.eq.wpn.id).includes('武士刀') && (hasMastery('k_counter') || Math.random() < 0.50)) {
            procIai(mob);
        }
        if (!player.dead) { _combatSrc = 'mercenary'; allyReactIai(mob); _combatSrc = null; }   // 🔧 傭兵居合：判定主玩家迴避成功
        return;
    }

    // 🔧 迴避精通：未觸發迴避（受到敵人攻擊）→ 累積 ER+1，提高下次迴避機率，直到觸發迴避才清空
    if (hasMastery('d_evade')) { player._darkEvadeStack = (player._darkEvadeStack || 0) + 1; if (player.d) player.d.er += 1; }

    let st = mob.st || newMobStatus();
    if (st.terror > 0 && !_asleep && Math.random() < 0.90) { logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 陷入恐懼，攻擊落空。`, 'miss'); return; }   // 🐉 恐懼無助：90% 攻擊落空
    let mobHitBonus = mobRageHitBonus(mob) - (st.blindVal || 0) - (st.weaken > 0 ? 2 : 0) - (st.disease > 0 ? 4 : 0) + ((mob._siegeHitEnd > state.ticks) ? 2 : 0) + tamerAuraHit(mob);   // 暴風神射：額外命中+2；🔧 馴獸光環；頭目狂暴倍率只放大自身 hit
    let rawHitValue = mob.lv + mobHitBonus - player.lv + (player.d.ac - teamAcBonus(player)) + ((player.statuses && player.statuses.disease > 0) ? 8 : 0);   // 🌟 v3.0.99 傭兵提供的大地祝福/高崙 全隊AC-（排除玩家自身·其自身已計入 player.d.ac）；🌅 疾病：玩家 AC +8（更易被命中）
    let hitValue = stretchHitValue(rawHitValue);
    
    let rollHit = roll(1, 20);
    let hit = false, heavy = false;

    if (rollHit === 20) { hit = true; heavy = true; }
    else if (rollHit !== 1 && hitValue >= rollHit) hit = true;
    if (_asleep) hit = true;   // 🗼 沉睡：必定命中

    if (hit) {
        // 大地屏障：免疫一般攻擊傷害
        if(player.buffs.sk_elf_earthshield > 0) {
            logCombat(`大地屏障 抵擋了 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 的攻擊！`, 'magic');
            return;
        }
        // 🏺 v3.1.77 稽核中#9 火熱愛意：火屬性怪物的一般攻擊也免疫（原僅攔火法術·與魔法路徑共用 10 秒節流 _fireNullCd；灼燒等持續傷害不在免疫範圍）
        if (mob.e === 'fire' && player.d.fireNullify && state.ticks >= (player._fireNullCd || 0)) {
            player._fireNullCd = state.ticks + 100;
            logCombat(`<span class="font-bold" style="color:#fca5a5;">【火熱愛意】</span>你化解了 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 的火屬性攻擊。`, 'magic');
            return;
        }
        let diceCount = (atkDmg ? atkDmg[0] : mob.dmg[0]) || 1;
        let diceSides = (atkDmg ? atkDmg[1] : mob.dmg[1]) || 1;
        let baseWeaponDmg = heavy ? (diceCount * diceSides) : roll(diceCount, diceSides);
        let dmgBonus = (atkDb != null ? atkDb : (mob.db || 0)) - (st.weaken > 0 ? 4 : 0) - (st.broken > 0 ? 2 : 0) - ((st.confuse > 0 || st.panic > 0) ? 10 : 0) - (st.doom > 0 ? 20 : 0) + ((mob._siegeDmgEnd > state.ticks) ? 4 : 0);   // 暴風神射：額外傷害+4；🔮 混亂/恐慌：一般攻擊傷害-10；🐉 驚悚死神：一般攻擊傷害-20
        let totalDmg = baseWeaponDmg + dmgBonus;
        if (mob._sherine) totalDmg = Math.floor(totalDmg * (mob._sherineMad ? 3 : 2));   // 🔮 席琳的世界：怪物一般攻擊傷害 ×2（瘋狂×3）
        if (mob._grace) totalDmg = Math.floor(totalDmg * 1.5);   // 🔮 席琳的恩賜：再 ×1.5

        let resFactor = 1.0;
        if(mob.e === 'fire' && player.d.resFire) resFactor -= effResistPct(player.d.resFire)/100;
        if(mob.e === 'water' && player.d.resWater) resFactor -= effResistPct(player.d.resWater)/100;
        if(mob.e === 'earth' && player.d.resEarth) resFactor -= effResistPct(player.d.resEarth)/100;
        if(mob.e === 'wind' && player.d.resWind) resFactor -= effResistPct(player.d.resWind)/100;

        resFactor = Math.max(0, Math.min(1, resFactor));
        totalDmg = Math.floor(totalDmg * resFactor);
        if (player.d.wearerEle && mob.e && mob.e !== 'none') totalDmg = Math.max(1, Math.floor(totalDmg * elementCounterMult(mob.e, player.d.wearerEle)));   // 🏺 遺物 火焰/寒冷化身：裝備者化屬性→受剋屬性一般攻擊傷害↑(×1.4)、受剋制屬性傷害↓(×0.6)

        // 隨機減免：騎士 (10-AC)/2；妖精/黑暗妖精/龍騎士/戰士 (10-AC)/3；幻術士 (10-AC)/4；王族/法師等 (10-AC)/5
        // 🔧 v2.6.64：取值範圍由「0 ~ (10-AC)/Y」改為「(10-AC)/3Y ~ (10-AC)/Y」（下限=上限的1/3）
        let rndDrMax = 0;
        let acGap = Math.max(0, 10 - (player.d.ac - teamAcBonus(player)));   // 🌟 v3.0.99 傭兵團隊AC光環（隨機減傷上限亦提高）
        if (player.cls === 'knight')         rndDrMax = Math.floor(acGap / 2);
        else if (player.cls === 'elf')       rndDrMax = Math.floor(acGap / 3);
        else if (player.cls === 'dark')      rndDrMax = Math.floor(acGap / 3);   // 🔧 黑暗妖精：(10-AC)/3（同妖精）
        else if (player.cls === 'dragon')    rndDrMax = Math.floor(acGap / 3);   // 🐉 龍騎士：(10-AC)/3
        else if (player.cls === 'warrior')   rndDrMax = Math.floor(acGap / 3);   // ⚔️ 戰士：(10-AC)/3
        else if (player.cls === 'illusion')  rndDrMax = Math.floor(acGap / 4);   // 🔮 幻術士：(10-AC)/4
        else                                 rndDrMax = Math.floor(acGap / 5);   // 👑 王族／法師等：(10-AC)/5
        rndDrMax = Math.max(0, rndDrMax);
        let rndDrMin = Math.floor(rndDrMax / 3);   // floor(floor(x/Y)/3)===floor(x/3Y)
        let randomDr = rndDrMin + Math.floor(Math.random() * (rndDrMax - rndDrMin + 1));

        totalDmg -= player.d.dr; // 傷害減免（已含增幅防禦）
        totalDmg -= randomDr;    // 隨機減免
        // 🔧 百分比受傷「增加」效果（冰凍/破壞盔甲）：仍各自相乘
        if(player.statuses.freeze > 0) {
            totalDmg = Math.floor(totalDmg * 1.5);                              // 冰凍中：受到物理傷害 +50%
            player.statuses.freeze = Math.max(0, player.statuses.freeze - 10); // 並使冰凍剩餘時間 -1 秒(10 ticks)
        }
        if(player.statuses.armorBreak > 0) totalDmg = Math.floor(totalDmg * 1.5);   // 破壞盔甲：一般攻擊受傷 +50%
        // 🔧 百分比受傷「減免」統一乘算（多層疊加採乘算：例 鐵衛20%×聖結界30%＝1−0.8×0.7＝44%，非相加 50%）
        { let _drMult = 1.0;
          if (player._setIron3) _drMult *= 0.8;                          // 🔮 鐵衛 3/5：-20%
          if (player.buffs.sk_holy_barrier > 0) _drMult *= 0.7;          // 聖結界：-30%
          if (player.buffs.sk_set_dragonscion > 0) _drMult *= 0.85;      // 🐉 龍血·龍裔：-15%
          if (player._setFury5) _drMult *= (1 - furyRageRatio());        // 😡 狂怒 5/5：依失血最多 -20%
          _drMult *= avatarSelfDmgReduceMult(player);                    // 🔮 v3.4.45 化身（單體）：自身持有→受傷 -3%
          if (heavy && player.d.crushDr > 0) _drMult *= (1 - Math.min(80, player.d.crushDr) / 100);   // 🏺 遺物 妖魔的兜襠布：受到重擊(敵人骰20)時傷害 -crushDr%（上限 80%）
          if (player.d.physDrGated > 0 && state.ticks >= (player._physDrCd || 0)) { _drMult *= (1 - Math.min(90, player.d.physDrGated) / 100); player._physDrCd = state.ticks + 30; }   // 🐍 祭祀儀式陶罐：受一般攻擊傷害 -physDrGated%，每 3 秒(30 ticks)最多觸發 1 次
          totalDmg = Math.max(0, Math.floor(totalDmg * _drMult)); }

        // 常駐被動：看破（敵人版）— 命中時依機率造成兩倍傷害（5 + 等級/10 %）
        let mobInsightPrefix = '';
        if((mob.seeInsight || mob.siegeInsight) && !player.classicMode) {   // 🎮 經典模式：移除敵人看破（阿頓/鋼鐵阿頓/依詩蒂等血盟敵人·與經典停用玩家/傭兵看破/殺戮一致）
            let insightRate = Math.min(15, 5 + Math.floor((mob.lv || 1) / 10));
            if(Math.random() * 100 < insightRate) {
                totalDmg *= 2;
                mobInsightPrefix = `<span class="text-fuchsia-300 font-bold">【看破】${mob.n}看穿了你的破綻！</span> `;
            }
        }
        // 常駐被動：雙重破壞（闇影格立特）— 命中時依機率造成兩倍最終傷害（5%，50級6%，之後每5級+1%）
        if(mob.doubleDestroy) {
            let ddRate = (mob.lv >= 50) ? (6 + Math.floor((mob.lv - 50) / 5)) : 5;
            if(Math.random() * 100 < ddRate) {
                totalDmg *= 2;
                mobInsightPrefix += `<span class="text-fuchsia-400 font-bold">【雙重破壞】${mob.n}撕裂了你的防禦！</span> `;
            }
        }
        // 🌑 雙刀暴擊（死亡）：一般攻擊依固定機率造成兩倍傷害（常駐被動）
        if(mob.atkDoubleChance && Math.random() < mob.atkDoubleChance) {
            totalDmg *= 2;
            mobInsightPrefix += `<span class="text-rose-400 font-bold">【雙刀暴擊】${mob.n}的雙刀撕裂了你！</span> `;
        }

        // 盾牌格檔：受到傷害減少50%。發動率＝受重擊時為盾牌格檔值（如100%盾→100%）；受非重擊一般攻擊時為其 30%（如100%盾→30%）
        let blocked = false;
        let blockReduced = 0;
        let _lancePair = player.eq.shield && player.eq.shield.id === 'relic_guard_towershield' && player.eq.wpn && player.eq.wpn.id === 'relic_bk_lance';   // 🏺 v3.5.27 黑騎士的精銳長槍＋漆黑塔盾：格檔100%（重擊/非重擊皆同）·經典模式亦可觸發
        if(player.eq.shield && (!player.classicMode || _lancePair)) {   // 🎮 經典模式：盾牌無格檔（長槍＋塔盾成對＝例外放行）
            let _sh = DB.items[player.eq.shield.id];
            let _blockChance = _lancePair ? 100 : ((_sh && _sh.block) ? (heavy ? _sh.block : _sh.block * 0.3) : 0);   // 🛡️ 非重擊：格檔發動率為重擊的 30%
            if(_blockChance > 0 && Math.random() * 100 < _blockChance) { let _before = totalDmg; totalDmg = Math.floor(totalDmg * 0.5); blockReduced = _before - totalDmg; blocked = true; }
        }

        totalDmg = Math.floor(totalDmg * mobRageDmgMult(mob));   // 🔥 HP<門檻：一般攻擊／連擊最終傷害倍率
        totalDmg = Math.max(1, totalDmg);
        totalDmg = castleGuardAbsorb(totalDmg, 'phys');   // 🏰 肯特城護衛：承擔 10% 一般攻擊
        totalDmg = Math.floor(totalDmg * riftDamageMult());   // 🌀 時空裂痕 30 分後每分鐘 +20% 怪物攻擊力
        totalDmg = dollDamageReduced(totalDmg);   // 🪆 魔法娃娃：受傷機率傷害減免（史巴托/巫妖）
        totalDmg = shieldDmgReduceProc(player, totalDmg);   // 🌑 v3.3.33 反叛者的盾牌：受傷 1%(+2%/強化) 機率傷害 -50（物理）
        // 🏺 v3.1.80 魅魔女皇的誘惑：受到一般攻擊時 dmgReflect% 機率使攻擊者受到相同傷害，自身免疫此次傷害
        if (player.d.dmgReflect > 0 && totalDmg > 0 && mob && mob.curHp > 0 && Math.random() * 100 < player.d.dmgReflect) {
            let _rf = Math.max(1, Math.floor(totalDmg * fragileMult(mob)));
            mob.curHp -= _rf; mob.justHit = 'magic'; mobWake(mob);
            logCombat(`<span class="font-bold" style="color:#f0abfc;text-shadow:0 0 6px #d946ef;">【魅魔女皇的誘惑】</span>魅惑反噬！<span class="${getMobColor(mob.lv)}">${mob.n}</span> 承受了 ${_rf} 點傷害，你免疫了此次攻擊。`, 'magic');
            if (mob.curHp <= 0) killMob(idx);
            updateUI();
            return;
        }
        player.hp -= totalDmg;
        if (totalDmg > 0 && typeof applyPlayerHitstun === 'function') applyPlayerHitstun();   // ⚔️ 天堂職業硬直：被物理直接命中→延遲下次攻擊
        if (totalDmg > 0) { try { playSfx('hurt'); } catch(e){} }   // 🔊 音效：玩家受到物理傷害
        if (player._setIron5 && totalDmg > 0 && player.hp > 0) ironGuardSweep();   // 🔮 鐵衛 5/5：受到（物理）傷害時，對全體必中反擊（每 tick 節流）
        try { vfxPlayerHit(totalDmg); } catch(e){}   // ✨ VFX：較大一擊→戰場震動＋HP條紅閃
        if(player.buffs.sk_illu_pain > 0 && mob && mob.curHp > 0 && totalDmg > 0) {   // 🔮 疼痛的歡愉：受傷時對攻擊者反射等量（損失HP）的無屬性魔法傷害
            let _rf = Math.max(1, Math.floor(totalDmg * fragileMult(mob)));
            mob.curHp -= _rf; mob.justHit = 'magic'; mobWake(mob);
            logCombat(`<span class="font-bold" style="color:#f472b6;text-shadow:0 0 6px #ec4899;">【疼痛的歡愉】</span>痛楚化為反擊，對 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 造成 ${_rf} 點傷害。`, 'magic');
            if(mob.curHp <= 0) { killMob(idx); if(player.hp <= 0) killPlayer(); return; }   // 🔧 同歸於盡：反擊殺死敵人時仍須結算玩家死亡（否則殘血<=0卻未死、被回血復活）
        }
        if(player.buffs.sk_dragon_deadlybody > 0 && mob && mob.curHp > 0 && totalDmg > 0 && Math.random() < 0.23) {   // 🐉 致命身軀：受到攻擊時 23% 機率反射相同傷害
            let _rf = Math.max(1, Math.floor(totalDmg * fragileMult(mob)));
            mob.curHp -= _rf; mob.justHit = 'magic'; mobWake(mob);
            logCombat(`<span class="font-bold" style="color:#fbbf24;text-shadow:0 0 6px #d97706;">【致命身軀】</span>反射相同傷害，對 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 造成 ${_rf} 點傷害。`, 'magic');
            if(mob.curHp <= 0) { killMob(idx); if(player.hp <= 0) killPlayer(); return; }
        }
        if(player.skills.includes('sk_warrior_titan_rock') && player.hp < player.mhp * titanThreshold() && mob && mob.curHp > 0 && totalDmg > 0) {   // ⚔️ 泰坦：岩石：HP<40%(反彈精通 80%) 受一般攻擊反射相同傷害
            let _tr = Math.max(1, Math.floor(totalDmg * fragileMult(mob)));
            mob.curHp -= _tr; mob.justHit = 'magic'; mobWake(mob);
            logCombat(`<span class="font-bold" style="color:#d6d3d1;text-shadow:0 0 6px #78716c;">【泰坦：岩石】</span>反射相同傷害，對 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 造成 ${_tr} 點傷害。`, 'magic');
            if(mob.curHp <= 0) { killMob(idx); if(player.hp <= 0) killPlayer(); return; }
            if(hasMastery('k_rebound')) reboundExtraAttack(mob);   // 🏅 反彈精通：觸發忍耐被動→額外普攻
        }
        if(player.d.thornsDmg > 0 && mob && mob.curHp > 0 && totalDmg > 0) {   // 🦔 遺物 犰狳尖刺頭盔：受擊時對攻擊者造成固定反傷（不乘脆弱·固定值）
            let _th = player.d.thornsDmg;
            mob.curHp -= _th; mob.justHit = 'magic'; mobWake(mob);
            logCombat(`<span class="font-bold" style="color:#a3a3a3;">【尖刺】</span>尖刺回擊，對 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 造成 ${_th} 點傷害。`, 'magic');
            if(mob.curHp <= 0) { killMob(idx); if(player.hp <= 0) killPlayer(); return; }
        }
        if(player.d.hurtExplode > 0 && totalDmg > 0) { bombFlowerExplode(); if(player.hp <= 0) { killPlayer(); return; } }   // 💥 遺物 爆彈花蕊：受物理傷害時爆裂（自傷可致死→補死亡結算）
        if(totalDmg > 0) _relicOnDamageHeal();   // 🏺 遺物 白螞蟻蛋殼：受擊自癒（5 秒節流·可救回 <=0 血）
        if(totalDmg > 0) _relicOnHurtCast(mob);   // 🏺 遺物 法師的護身短刀：受物理傷害時 20% 免費施放自動攻擊法術
        if(totalDmg > 0 && player.hp > 0) hurtRapidfireProc();   // 🏺 地精靈王的抗拒：受物理傷害時強制連射（經典亦可）

        let atkMsg = `${mobInsightPrefix}<span class="${getMobColor(mob.lv)}">${mob.n}</span> 擊中你，造成 ${totalDmg} 點傷害。`;
        if(heavy) atkMsg += " (重擊!)";
        if(blocked) atkMsg += ` <span class="text-cyan-300 font-bold">(格檔！減少 ${blockReduced} 點傷害)</span>`;
        logCombat(atkMsg, 'enemy');
        if (_asleep && player.statuses.sleep > 0) { player.statuses.sleep = 0; logCombat('<span class="text-sky-200">你從沉睡中驚醒！</span>', 'magic'); }   // 🗼 沉睡：受擊即醒

        if (player.hp <= 0) killPlayer();
        else if (stunChance > 0 && Math.random() * 100 < stunChance) {   // 衝擊之暈：命中後依機率附加暈眩
            if (playerStatusResisted('stun')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了暈眩！</span>', 'magic'); updateUI(); }
            else { player.statuses.stun = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 的衝擊使你暈眩了！`, 'enemy'); }
        }
        else updateUI();

        // 🌅 onHitPoison（牛鬼之子·毒素／牛鬼·猛毒）：一般攻擊命中時 ((pbase − 玩家MR)/2)% 機率使玩家中毒（每 tick 秒 d 點固定傷害·持續 dur 秒·刷新）
        if (!player.dead && mob.onHitPoison && !player.d.immPoison) {
            let _ohp = mob.onHitPoison;
            let _ohc = Math.max(0, ((_ohp.pbase !== undefined ? _ohp.pbase : 150) - player.d.mr) / 2);
            if (Math.random() * 100 < _ohc) {
                if (playerStatusResisted('poison')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了中毒！</span>', 'magic'); }
                else {
                    let _ohD = Math.floor(((mob._sherine ? (mob._sherineMad ? 3 : 2) : 1) * (mob._grace ? 2 : 1)) * (_ohp.d || 10) * mobRageDmgMult(mob));   // 席琳／頭目狂暴倍率（比照施法中毒）
                    player.statuses.poison = (_ohp.dur || 20) * 10;
                    player.statuses.poisonDmg = _ohD;
                    player.statuses.poisonTick = (_ohp.tick || 5) * 10;
                    logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 的${_ohp.skn || '毒素'}使你中毒了！每 ${_ohp.tick || 5} 秒受到 ${_ohD} 點固定傷害。`, 'enemy');
                }
            }
        }

        // 單手劍反擊：受到敵人一般攻擊命中時觸發。一般 50% 機率；若裝備盾牌且本次觸發格檔(blocked)則必定反擊
        // 🏅 反擊精通：100% 觸發
        if (!player.dead && mob.curHp > 0 && player.eq.wpn && (getWeaponTags(player.eq.wpn.id).includes('單手劍') || (player.buffs.sk_counter_barrier > 0 && DB.items[player.eq.wpn.id].w2h)) && !(getWeaponTags(player.eq.wpn.id).includes('武士刀') && !(player.eq.shield && !_isArmguard(player.eq.shield)))) {   // 🔧 反擊屏障：雙手武器亦可反擊；🛡️ 反擊/居合雙標籤武器「無真盾牌(空手或臂甲)」時→改走居合、不發動反擊（唯獨裝真盾牌才反擊）
            if (blocked || hasMastery('k_counter') || Math.random() < 0.50) procCounter(mob);
        }
        if (!player.dead) { _combatSrc = 'mercenary'; allyReactCounter(mob, blocked); _combatSrc = null; }   // 🔧 傭兵反擊：判定主玩家受擊（玩家格檔則必定反擊）
    } else {
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 的攻擊未命中。`, 'miss', 'enemy');   // ⚔️ 敵人攻擊未命中（miss色，但歸入「敵人」來源）
        // 武士刀居合：無「真盾牌」（臂甲可發動）且敵人攻擊未命中時，50% 對攻擊者打一次必定命中的一般攻擊（🏅 反擊精通：100%）
        if (!player.dead && (!player.eq.shield || _isArmguard(player.eq.shield)) && mob.curHp > 0 && player.eq.wpn && getWeaponTags(player.eq.wpn.id).includes('武士刀') && (hasMastery('k_counter') || Math.random() < 0.50)) {
            procIai(mob);
        }
        _combatSrc = 'mercenary'; allyReactIai(mob); _combatSrc = null;   // 🔧 傭兵居合：判定敵人未命中主玩家
    }
}

// 🤝 仇恨權重（玩家與傭兵同規則，不分身分）：法師/幻術士、或持弓/遠程武器(弓・十字弓)者＝1；近戰 騎士/戰士/龍騎士＝5；近戰 妖精/黑暗妖精/王族＝4；其餘＝1。（v2.6.30 近戰重裝 3→4・近戰輕裝 2→3；v3.2.81 近戰重裝 4→5・近戰輕裝 3→4）
function mercAggroWeight(c) {
    if (!c) return 0;
    let _agB = 0;   // 🐍 艾庫卡伊拉的華麗兜帽：裝備 aggroWeight → 提高被攻擊權重（玩家/傭兵通用）
    if (c.eq) for (let k in c.eq) { let e = c.eq[k]; if (e) { let d = DB.items[e.id]; if (d && d.aggroWeight) _agB += d.aggroWeight; } }
    if (c.cls === 'mage' || c.cls === 'illusion') return 1 + _agB;   // 施法者：恆 1
    let w = (c.eq && c.eq.wpn) ? DB.items[c.eq.wpn.id] : null;
    if (w && (w.isBow || w.ranged)) return 1 + _agB;   // 持弓/遠程：恆 1（弓・十字弓）
    if (c.cls === 'knight' || c.cls === 'warrior' || c.cls === 'dragon') return 5 + _agB;   // 近戰重裝（v3.2.81 4→5）
    if (c.cls === 'elf' || c.cls === 'dark' || c.cls === 'royal') return 4 + _agB;          // 近戰輕裝（v3.2.81 3→4）
    return 1 + _agB;
}
// 🐾 v3.2.82 寵物被攻擊權重（物理/魔法受害者池共用）：預設吃 PET_KIND_WEIGHT（phys4/spec3/mag2）；PET_AGGRO_OVERRIDE 個別覆寫（用戶指定杜賓狗系/狼系物理寵降為 3）。
const PET_AGGRO_OVERRIDE = { '杜賓狗': 3, '高等杜賓狗': 3, '狼': 3, '高等狼': 3 };
function petAggroWeight(p) { if (!p) return 2; if (PET_AGGRO_OVERRIDE[p.form] != null) return PET_AGGRO_OVERRIDE[p.form]; let d = (typeof PET_BOOK !== 'undefined') && PET_BOOK[p.form]; return (d && PET_KIND_WEIGHT[d.kind]) || 2; }
// 🧙 v3.2.82 召喚物被攻擊權重（物理/魔法受害者池共用）：召喚術/造屍術＝4·屬性精靈＝3。
function summonAggroWeight(s) { return (s && (s.skId === 'sk_elf_summon' || s.skId === 'sk_elf_summon2')) ? 3 : 4; }
// 🏺 聖甲蟲的孵育巢（aggroHide 旗標）：掃 entity 全部裝備欄是否裝備「迴避仇恨」物品（玩家/傭兵通用）。
function _hasAggroHide(c) {
    if (!c || !c.eq) return false;
    for (let k in c.eq) { let e = c.eq[k]; if (e) { let d = DB.items[e.id]; if (d && d.aggroHide) return true; } }
    return false;
}
// 🏺 單體「指定攻擊」候選池過濾（物理普攻＋單體魔法共用·全體攻擊不經此）：
//   隊伍(玩家+非倒地傭兵)中存在「未裝備」孵育巢者 → 裝備者退出候選、敵人只在未裝備者中加權抽；
//   全員皆裝備（或僅剩裝備者存活）→ 視同無效果、照原池加權（裝備者成為最後目標）。
function aggroVictimPool(allies) {
    let pH = _hasAggroHide(player);
    let nh = allies.filter(a => !_hasAggroHide(a));
    if (!pH) return { playerIn: true, allies: nh };            // 玩家未裝備：踢掉裝備的傭兵（nh 可能＝原名單）
    if (nh.length) return { playerIn: false, allies: nh };     // 玩家裝備、尚有未裝備傭兵：只打未裝備傭兵
    return { playerIn: true, allies: allies };                 // 全員裝備：照常
}
// 🤝 Phase 3：怪物一般攻擊的「受害者選擇」——玩家與每名非倒地傭兵各依 mercAggroWeight 加權隨機（不分玩家/傭兵）；魔法/狀態攻擊不在此（仍只打玩家）。
function enemyAttackChooseVictim(mob, idx) {
    try { if (typeof playMobAttack === 'function') playMobAttack(mob); } catch (e) {}   // 🔊 怪物一般攻擊音（每次普攻動作一次·不分打玩家/傭兵·查無對應則靜音）
    if (player.dead) { enemyPhysicalAttack(mob, idx); return; }   // 玩家已死：照舊（enemyPhysicalAttack 內部即 return）
    let allies = (player.allies || []).filter(a => a && !a._downed && (a.curHp || 0) > 0);
    // 🐾 v3.2.17 出戰寵物加入受害者池：受擊權重 物理4／特殊3／魔法2（PET_KIND_WEIGHT）
    let pets = (typeof petsOutList === 'function') ? petsOutList().filter(p => p && !p._downed && (p.hp || 0) > 0) : [];
    // 🧙 v3.2.21 召喚物 v2 加入受害者池（可被打死→全滅自動重施）：權重見下方 _sumW——v3.2.81 召喚術/造屍術＝4·屬性精靈＝3（原全 3）
    let sums = (typeof summonV2List === 'function') ? summonV2List().filter(s => s && !s._downed && (s.hp || 0) > 0) : [];
    if (typeof mercSummonList === 'function') sums = sums.concat(mercSummonList());   // 🧱 v3.4.50 傭兵召喚物（無 sprite·有血量）也入受害者池·受擊走同一 enemyAttackSummon
    if (!allies.length && !pets.length && !sums.length && !_hasAggroHide(player)) { enemyPhysicalAttack(mob, idx); return; }   // 無傭兵無寵物無召喚且玩家未裝孵育巢：照舊打玩家（快速路徑）
    let pool = aggroVictimPool(allies);   // 🏺 聖甲蟲的孵育巢：未裝備者優先被指定攻擊（寵物無裝備·不參與孵育巢過濾）
    allies = pool.allies;
    let _petW = petAggroWeight, _sumW = summonAggroWeight;   // 🐾🧙 v3.2.82 改用模組共用權重（含四寵覆寫·與魔法受害者池一致）
    let pw = pool.playerIn ? mercAggroWeight(player) : 0;
    let total = pw; for (let a of allies) total += mercAggroWeight(a);
    for (let p of pets) total += _petW(p);
    for (let s of sums) total += _sumW(s);
    if (total <= 0) { enemyPhysicalAttack(mob, idx); return; }
    let r = Math.random() * total;
    r -= pw;
    if (r < 0) { enemyPhysicalAttack(mob, idx); return; }   // 抽中玩家
    for (let a of allies) { r -= mercAggroWeight(a); if (r < 0) { enemyAttackAlly(mob, a); return; } }
    for (let p of pets) { r -= _petW(p); if (r < 0) { if (typeof enemyAttackPet === 'function') enemyAttackPet(mob, p); else enemyPhysicalAttack(mob, idx); return; } }
    for (let s of sums) { r -= _sumW(s); if (r < 0) { if (typeof enemyAttackSummon === 'function') enemyAttackSummon(mob, s); else enemyPhysicalAttack(mob, idx); return; } }
    // Floating-point fallback must respect aggro hiding and keep pets in the candidate pool.
    if (pool.playerIn) enemyPhysicalAttack(mob, idx);
    else if (allies.length) enemyAttackAlly(mob, allies[allies.length - 1]);
    else if (pets.length && typeof enemyAttackPet === 'function') enemyAttackPet(mob, pets[pets.length - 1]);
    else enemyPhysicalAttack(mob, idx);
}

// 🤝 Phase 3：怪物對「協力傭兵」的一般物理攻擊（enemyPhysicalAttack 的精簡版：保留 ER迴避/命中/元素抗/固定+隨機減免/鐵衛3/盾牌格檔/裂痕加成；移除玩家專屬的反擊·反射·看破·狀態附加·死亡）。
// 🌿🛡️ 全隊防禦增益：大地的祝福由任一玩家／傭兵維持時，全隊（玩家、傭兵、寵物、召喚物）AC-7；鋼鐵防護則由 recomputeStats 套在施法者自身，AC-10。
//   🌟 v3.0.99 改「任一隊員(玩家/傭兵)維持團隊光環即全隊生效」：teamAcBonus/teamIlluAura 傳「受益者 forWho」排除自身（其自身光環已由 recomputeStats buff 迴圈套進自身 d·避免雙算）。
//   玩家自身：AC 由 recomputeStats(buff d:{ac})＋teamAcBonus(player)(只補其他來源)；傭兵同理走 teamAcBonus(ally)；幻覺攻擊光環走 teamIlluAura(ally) 注入。⚠️玩家吃「傭兵提供的幻覺攻擊光環(化身+10攻擊)」暫未實裝(玩家仍只吃自身幻覺攻擊)。
// 🤝 v3.4.45 第二參 forMinion：鑽石高崙 AC 已改「單體」(玩家/傭兵靠各自 recompute d)→只有寵物/召喚(forMinion=true·無法持有 buff)仍走光環。大地祝福 AC 維持全隊。
function teamAcBonus(forWho, forMinion) { let v = 0; if (_teamAuraHas('sk_elf_earthbless', forWho)) v += ((DB.skills.sk_elf_earthbless && DB.skills.sk_elf_earthbless.d && DB.skills.sk_elf_earthbless.d.ac) || 0); if (forMinion && _teamAuraHas('sk_illu_golem', forWho)) v += ((DB.skills.sk_illu_golem && DB.skills.sk_illu_golem.d && DB.skills.sk_illu_golem.d.ac) || 0); if (!(forWho && forWho.buffs && (forWho.buffs.sk_royal_shield || 0) > 0) && _teamAuraHas('sk_royal_shield', forWho)) v += ((DB.skills.sk_royal_shield && DB.skills.sk_royal_shield.d && DB.skills.sk_royal_shield.d.ac) || 0); return v; }
// 🤝 v3.4.45 第一參 forMinion：化身受傷減免已改「單體」(玩家/傭兵靠 avatarSelfDmgReduceMult 逐實體讀自身 buff)→只有寵物/召喚仍走此光環。鋼鐵防護已恢復為施法者自身 AC-10，不走本函式。
function teamDmgReduceMult(forMinion) { let m = 1; if (forMinion && _teamAuraHas('sk_illu_avatar')) m *= (1 - (((DB.skills.sk_illu_avatar && DB.skills.sk_illu_avatar.dmgTakenReduce) || 0) / 100)); return m; }
// 🤝 v3.4.45 化身「單體」受傷減免：逐實體讀自身 buff（玩家/傭兵受擊時 _drMult 各自套；寵物/召喚不走此路·由 teamDmgReduceMult(true) 光環覆蓋）
function avatarSelfDmgReduceMult(ent) { if (ent && ent.buffs && (ent.buffs.sk_illu_avatar || 0) > 0) return (1 - (((DB.skills.sk_illu_avatar && DB.skills.sk_illu_avatar.dmgTakenReduce) || 0) / 100)); return 1; }
// 🔮 幻覺攻擊光環在 v3.4.45 改為只有寵物/召喚(forMinion=true)走光環；玩家/傭兵靠各自持有 buff。
// 👑 灼熱武器維持真正全隊光環：玩家/傭兵由既有注入點取得其他來源加成，寵物/召喚由 forMinion 路徑取得；受益者自己已持有時不再注入，避免同技能重複疊加。royalEd 供魔法型精靈的一般攻擊辨識灼熱武器固定傷害。
function teamIlluAura(forWho, forMinion) {
    let ed = 0, eh = 0, md = 0, royalEd = 0;
    if (forMinion) {
        if (_teamAuraHas('sk_illu_ogre', forWho))   { let o = (DB.skills.sk_illu_ogre   && DB.skills.sk_illu_ogre.d)   || {}; ed += o.extraDmg || 0; eh += o.extraHit || 0; }   // 歐吉：額外傷害+4·額外命中+4
        if (_teamAuraHas('sk_illu_avatar', forWho)) { let a = (DB.skills.sk_illu_avatar && DB.skills.sk_illu_avatar.d) || {}; ed += a.extraDmg || 0; }                            // 化身：額外傷害+10
        if (_teamAuraHas('sk_illu_lich', forWho))   { let l = (DB.skills.sk_illu_lich   && DB.skills.sk_illu_lich.d)   || {}; md += l.magicDmg || 0; }                            // 巫妖：魔法傷害+2
    }
    if (!(forWho && forWho.buffs && (forWho.buffs.sk_royal_burnweapon || 0) > 0) && _teamAuraHas('sk_royal_burnweapon', forWho)) {
        let r = (DB.skills.sk_royal_burnweapon && DB.skills.sk_royal_burnweapon.d) || {};
        royalEd = r.extraDmg || 0; ed += royalEd; eh += r.extraHit || 0;
    }
    if (ed === 0 && eh === 0 && md === 0) return null;
    return { ed: ed, eh: eh, md: md, royalEd: royalEd };
}
function enemyAttackAlly(mob, ally) {
    if (!mob || mob.curHp <= 0 || !ally || ally._downed || (ally.curHp || 0) <= 0) return;
    if (!ally.statuses) ally.statuses = {};
    if (typeof _mobAnimTrigger === 'function') _mobAnimTrigger(mob, 'attack');   // 🎞️ 序列幀：攻擊動作（打傭兵也播·鏡像 enemyPhysicalAttack·鎖定播放中會被忽略）
    mob._facePartyKey = 'A:' + String(ally._slot || '');   // 🧭 可序列化隊員鍵；不保存傭兵物件參照
    delete mob._faceTgt;
    let d = ally.d || {};
    // 迴避（基礎 ER；🆕 v2.6.13 #5b 補：泰坦子彈殘血ER+50／迴避精通累積ER＋迴避後必中必爆／暗影3迴避回2%HP。比照玩家 enemyPhysicalAttack）
    {
        let _titanEr = (ally.skills && ally.skills.includes('sk_warrior_titan_bullet') && (ally.curHp || 0) < (ally.mhp || 1) * ((ally.cls === 'warrior' && allyHasMastery(ally, 'k_rebound')) ? 0.8 : 0.4)) ? 50 : 0;   // ⚔️ 泰坦：子彈
        let _evStack = allyHasMastery(ally, 'd_evade') ? (ally._darkEvadeStack || 0) : 0;   // 🖤 迴避精通：累積 ER（直接加進判定·不動 ally.d 避免重算失同步）
        let _stealthDodge = !!(ally.buffs && ally.buffs.sk_dark_stealth > 0);   // 🖤 v2.7.92 暗隱術（傭兵）：100% 迴避一次物理攻擊（迴避後失效並進入 5 秒冷卻·鏡像玩家 enemyPhysicalAttack）
        if (_stealthDodge || roll(1, 100) <= effResistPct((d.er || 0) + _titanEr + _evStack)) {
            logCombat(`<span class="text-sky-300 font-bold">協力·${ally._allyName}</span> 迴避了 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 的攻擊。`, 'evade', 'enemy');
            if (allyHasMastery(ally, 'd_evade')) { ally._darkEvadeStack = 0; ally._darkEvadeSure = true; ally._darkEvadeCrit = true; }   // 迴避精通：清空累積·下次一般攻擊必中必爆
            if (ally._setShadow3) ally.curHp = Math.min(ally.mhp || 1, (ally.curHp || 0) + Math.floor((ally.mhp || 1) * 0.02));   // 🔮 暗影3/5：迴避恢復 2% HP
            if (_stealthDodge) { ally.buffs.sk_dark_stealth = 0; ally._darkStealthCd = state.ticks + 50; logCombat(`<span class="text-fuchsia-300">協力·${ally._allyName} 的暗影隱蔽消散了。</span>`, 'magic', 'mercenary'); }   // 🖤 v2.7.92 消耗該次 100% 迴避後失效＋5 秒冷卻（allyMaintainBuffs 冷卻閘讀 _darkStealthCd）
            return;
        }
        if (allyHasMastery(ally, 'd_evade')) ally._darkEvadeStack = (ally._darkEvadeStack || 0) + 1;   // 未迴避→累積 ER（下次更易閃）
    }
    let st = mob.st || newMobStatus();
    if (st.terror > 0 && Math.random() < 0.90) { logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 陷入恐懼，攻擊落空。`, 'miss', 'enemy'); return; }
    let mobHitBonus = mobRageHitBonus(mob) - (st.blindVal || 0) - (st.weaken > 0 ? 2 : 0) - (st.disease > 0 ? 4 : 0) + ((mob._siegeHitEnd > state.ticks) ? 2 : 0) + tamerAuraHit(mob);
    let hitValue = stretchHitValue(mob.lv + mobHitBonus - (ally.lv || 1) + ((d.ac || 0) - teamAcBonus(ally)) + (ally.statuses.disease > 0 ? 8 : 0));   // 🌿 大地的祝福：全隊 AC-7；🌅 疾病：傭兵 AC +8（更易被命中）
    let rollHit = roll(1, 20), hit = false, heavy = false;
    if (rollHit === 20) { hit = true; heavy = true; }
    else if (rollHit !== 1 && hitValue >= rollHit) hit = true;
    if (!hit) { logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 對 <span class="text-sky-300 font-bold">協力·${ally._allyName}</span> 的攻擊未命中。`, 'miss', 'enemy'); return; }
    // 🌍 v3.4.47 大地屏障（傭兵鏡像·物理）：v3.4.45 共享機制可把大地屏障分享給傭兵，但原本只有玩家路徑(js/04:824)讀此 buff→傭兵收到＝白耗 MP 零效果。鏡像玩家：hit 判定後、傷害計算前完全免疫一般攻擊（順序同玩家：屏障先於火熱愛意）
    if ((ally.buffs && ally.buffs.sk_elf_earthshield > 0)) {
        logCombat(`大地屏障 抵擋了 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 對 協力·${ally._allyName} 的攻擊！`, 'magic');
        return;
    }
    // 🏺 v3.2.40 稽核修 火熱愛意（傭兵鏡像·物理）：火屬性怪物的一般攻擊免疫·每傭兵獨立 10 秒節流（鏡像玩家 js/04:797·同批 wearerEle 已有鏡像唯此欄漏接）
    if (mob.e === 'fire' && d.fireNullify && state.ticks >= (ally._fireNullCd || 0)) {
        ally._fireNullCd = state.ticks + 100;
        logCombat(`<span class="font-bold" style="color:#fca5a5;">【火熱愛意】</span>協力·${ally._allyName} 化解了 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 的火屬性攻擊。`, 'magic');
        return;
    }
    let dc = (mob.dmg && mob.dmg[0]) || 1, ds = (mob.dmg && mob.dmg[1]) || 1;
    let totalDmg = (heavy ? dc * ds : roll(dc, ds)) + ((mob.db || 0) - (st.weaken > 0 ? 4 : 0) - (st.broken > 0 ? 2 : 0) - ((st.confuse > 0 || st.panic > 0) ? 10 : 0) - (st.doom > 0 ? 20 : 0) + ((mob._siegeDmgEnd > state.ticks) ? 4 : 0));
    if (mob._sherine) totalDmg = Math.floor(totalDmg * (mob._sherineMad ? 3 : 2));
    if (mob._grace) totalDmg = Math.floor(totalDmg * 1.5);
    let resFactor = 1.0;
    if (mob.e === 'fire' && d.resFire) resFactor -= effResistPct(d.resFire) / 100;
    if (mob.e === 'water' && d.resWater) resFactor -= effResistPct(d.resWater) / 100;
    if (mob.e === 'earth' && d.resEarth) resFactor -= effResistPct(d.resEarth) / 100;
    if (mob.e === 'wind' && d.resWind) resFactor -= effResistPct(d.resWind) / 100;
    totalDmg = Math.floor(totalDmg * Math.max(0, Math.min(1, resFactor)));
    if (d.wearerEle && mob.e && mob.e !== 'none') totalDmg = Math.max(1, Math.floor(totalDmg * elementCounterMult(mob.e, d.wearerEle)));   // 🏺 v3.1.76 火焰/寒冷化身（傭兵）：化屬性→受剋屬性一般攻擊×1.4、受剋制屬性×0.6（鏡像玩家 js/04:779）
    let acGap = Math.max(0, 10 - ((d.ac || 0) - teamAcBonus(ally)));   // 🌿 大地的祝福：全隊 AC-7（隨機減傷上限亦提高）
    let rndDrMax = (ally.cls === 'knight') ? Math.floor(acGap / 2) : ((ally.cls === 'elf' || ally.cls === 'dark' || ally.cls === 'dragon' || ally.cls === 'warrior') ? Math.floor(acGap / 3) : (ally.cls === 'illusion' ? Math.floor(acGap / 4) : Math.floor(acGap / 5)));
    rndDrMax = Math.max(0, rndDrMax);
    let rndDrMin = Math.floor(rndDrMax / 3);   // 🔧 v2.6.64：隨機減免下限 0 → (10-AC)/3Y（與玩家路徑一致）
    totalDmg -= (d.dr || 0) + rndDrMin + Math.floor(Math.random() * (rndDrMax - rndDrMin + 1));
    if (ally._setIron3) totalDmg = Math.floor(totalDmg * 0.8);   // 🔮 鐵衛 3/5：-20%（傭兵套裝旗標·常數，不讀玩家狀態）
    totalDmg = Math.floor(totalDmg * avatarSelfDmgReduceMult(ally));   // 🔮 v3.4.45 化身（單體）：傭兵自身持有→受傷 -3%
    totalDmg = Math.floor(totalDmg * allyBuffDmgReduceMult(ally));   // 🆕 v2.6.12 #5a：傭兵聖結界-30%/龍裔-15%/狂怒5-20%（讀傭兵自身 buff/套裝）
    if (heavy && (d.crushDr || 0) > 0) totalDmg = Math.floor(totalDmg * (1 - Math.min(80, d.crushDr) / 100));   // 🏺 v3.1.76 妖魔的兜襠布（傭兵）：受重擊傷害 -crushDr%（上限80%·鏡像玩家 js/04:811）
    if ((d.physDrGated || 0) > 0 && state.ticks >= (ally._physDrCd || 0)) { totalDmg = Math.floor(totalDmg * (1 - Math.min(90, d.physDrGated) / 100)); ally._physDrCd = state.ticks + 30; }   // 🐍 v3.1.76 祭祀儀式陶罐（傭兵）：受一般攻擊傷害 -%·每 3 秒 1 次（每傭兵獨立節流·鏡像玩家 js/04:812）
    // 盾牌/臂甲格檔（同玩家公式；經典模式停用·🏺 v3.5.27 長槍＋塔盾成對＝100%且經典亦可·鏡像玩家）
    { let _alp = ally.eq && ally.eq.shield && ally.eq.shield.id === 'relic_guard_towershield' && ally.eq.wpn && ally.eq.wpn.id === 'relic_bk_lance';
      if (ally.eq && ally.eq.shield && (!player.classicMode || _alp)) { let _sh = DB.items[ally.eq.shield.id]; let _bc = _alp ? 100 : ((_sh && _sh.block) ? (heavy ? _sh.block : _sh.block * 0.3) : 0); if (_bc > 0 && Math.random() * 100 < _bc) totalDmg = Math.floor(totalDmg * 0.5); } }
    totalDmg = Math.floor(totalDmg * mobRageDmgMult(mob));   // 🔥 HP<門檻：攻擊傭兵也套用狂暴傷害
    totalDmg = Math.max(1, Math.floor(Math.max(1, totalDmg) * riftDamageMult()));   // 🌀 裂痕加成（與玩家一致）
    totalDmg = allyDollDamageReduced(ally, totalDmg);   // 🆕 v2.6.10 #3：魔法娃娃機率減免（受物理傷害）
    totalDmg = shieldDmgReduceProc(ally, totalDmg);   // 🌑 v3.3.33 反叛者的盾牌（傭兵鏡像·物理）
    // 🏺 v3.1.80 魅魔女皇的誘惑（傭兵）：受一般攻擊 dmgReflect% 機率反射相同傷害＋免疫（鏡像玩家 enemyPhysicalAttack）
    if ((d.dmgReflect || 0) > 0 && totalDmg > 0 && mob.curHp > 0 && Math.random() * 100 < d.dmgReflect) {
        let _rf = Math.max(1, Math.floor(totalDmg * fragileMult(mob)));
        let _rfBf = mob.curHp;
        mob.curHp -= _rf; mob.justHit = 'magic'; mobWake(mob);
        _dpsAllyReact(ally, _rfBf, _rf);   // 🎯 DPS：反射傷害歸該傭兵（並供玩家反應視窗扣除）
        logCombat(`<span class="font-bold" style="color:#f0abfc;text-shadow:0 0 6px #d946ef;">【魅魔女皇的誘惑】</span>魅惑反噬！<span class="${getMobColor(mob.lv)}">${mob.n}</span> 承受了 ${_rf} 點傷害，協力·${ally._allyName} 免疫了此次攻擊。`, 'magic');
        if (mob.curHp <= 0) { let _mi = mapState.mobs.findIndex(m => m && m.uid === mob.uid); if (_mi !== -1) killMob(_mi); }
        return;
    }
    ally.curHp -= totalDmg;
    if (totalDmg > 0 && !ally._stunCycle) { ally._atkCd = (ally._atkCd || 0) + ((ally.d && ally.d.hitstun) || 0); ally._stunCycle = true; }   // ⚔️ 天堂職業硬直（傭兵·物理）：延遲下次攻擊·每週期一次
    logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 攻擊 <span class="text-sky-300 font-bold">協力·${ally._allyName}</span>，造成 ${totalDmg} 點傷害。`, 'enemy', 'enemy');
    allyReflectOnHit(ally, mob, totalDmg, false);   // 🆕 v2.6.14 #5c：受物理反射（疼痛歡愉/致命身軀/泰坦岩石）
    if (ally._setIron5 && ally.eq && ally.eq.wpn && ally._ironSweepTick !== state.ticks) { ally._ironSweepTick = state.ticks; allyIronGuardSweep(ally, '受擊'); }   // 🆕 v2.6.14 #5c：鐵衛5/5 受擊橫掃（每 tick 節流）
    if ((d.thornsDmg || 0) > 0 && mob.curHp > 0 && totalDmg > 0) {   // 🦔 v3.1.76 犰狳尖刺頭盔（傭兵）：受擊固定反傷（鏡像玩家 js/04:875）
        let _th = d.thornsDmg;
        let _thBf = mob.curHp;
        mob.curHp -= _th; mob.justHit = 'magic'; mobWake(mob);
        _dpsAllyReact(ally, _thBf, _th);   // 🎯 DPS：荊棘反傷歸該傭兵（並供玩家反應視窗扣除）
        logCombat(`<span class="font-bold" style="color:#a3a3a3;">【尖刺】</span>協力·${ally._allyName} 的尖刺回擊，對 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 造成 ${_th} 點傷害。`, 'magic');
        if (mob.curHp <= 0) { let _mi = mapState.mobs.findIndex(m => m && m.uid === mob.uid); if (_mi !== -1) killMob(_mi); }
    }
    if ((d.hurtExplode || 0) > 0 && totalDmg > 0) _dpsAllyReactWrap(ally, () => bombFlowerExplode(ally));   // 💥 v3.1.76 爆彈花蕊（傭兵）：受物理傷害爆裂（自傷扣 curHp·倒地由下方檢查結算）；🎯 DPS 歸該傭兵
    if (totalDmg > 0) _allyRelicOnDamageHeal(ally);   // 🏺 v3.1.76 白螞蟻蛋殼（傭兵）：受擊自癒（每傭兵獨立冷卻·可救回 <=0 血）
    // 🌅 牛鬼之子／牛鬼：一般攻擊命中傭兵時，以該傭兵自己的 MR、毒免疫與異常抵抗判定中毒。
    if (ally.curHp > 0 && mob.onHitPoison && !d.immPoison) {
        let _ohp = mob.onHitPoison;
        let _ohc = Math.max(0, ((_ohp.pbase !== undefined ? _ohp.pbase : 150) - (d.mr || 0)) / 2);
        if (Math.random() * 100 < _ohc) {
            if (allyStatusResisted(ally, 'poison')) logCombat(`<span class="text-sky-300 font-bold">協力·${ally._allyName} 抵抗了中毒！</span>`, 'magic');
            else {
                let _ohD = Math.floor(((mob._sherine ? (mob._sherineMad ? 3 : 2) : 1) * (mob._grace ? 2 : 1)) * (_ohp.d || 10) * mobRageDmgMult(mob));
                ally.statuses.poison = (_ohp.dur || 20) * 10;
                ally.statuses.poisonDmg = _ohD;
                ally.statuses.poisonTick = (_ohp.tick || 5) * 10;
                logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 的${_ohp.skn || '毒素'}使協力·${ally._allyName}中毒了！每 ${_ohp.tick || 5} 秒受到 ${_ohD} 點固定傷害。`, 'enemy');
            }
        }
    }
    if (totalDmg > 0 && ally.curHp > 0 && typeof allyRapidfire === 'function') _dpsAllyReactWrap(ally, () => allyRapidfire(ally, true, true));   // 🏺 地精靈王的抗拒（傭兵）：受擊強制連射，經典亦可；🎯 DPS 歸該傭兵
    if (ally.curHp <= 0) { ally.curHp = 0; ally._downed = true; ally._reviveCd = 150; logCombat(`<span class="text-amber-400 font-bold">協力傭兵 ${ally._allyName} 倒下了！（可用返生術立即復活，或 15 秒後自動使用復活卷軸，或回村免費復活）</span>`, 'enemy', 'enemy'); try { renderSquadPanel(); } catch (e) {} }
}

function pvpChaoticDeathItemLoss() {
    if (!player || !player.eq || !Array.isArray(player.inv)) return;
    if (typeof pvpClampAlignment === 'function' && pvpClampAlignment(player.alignmentValue) >= -10000) return;
    if (typeof pvpClampAlignment !== 'function' && (Number(player.alignmentValue) || 0) >= -10000) return;
    if (Math.random() >= 0.01) return;
    let candidates = [];
    for (let slot in player.eq) {
        let it = player.eq[slot];
        if (it && it.id && DB.items[it.id]) candidates.push({ kind: 'eq', slot: slot, item: it });
    }
    player.inv.forEach((it, index) => {
        if (it && it.id && DB.items[it.id]) candidates.push({ kind: 'inv', index: index, item: it });
    });
    if (!candidates.length) return;
    let pick = candidates[Math.floor(Math.random() * candidates.length)];
    let name = (typeof getItemFullName === 'function') ? getItemFullName(pick.item) : (DB.items[pick.item.id] ? DB.items[pick.item.id].n : pick.item.id);
    // 🗃️ v3.5.74 遺失紀錄（用戶拍板）：系統背後保存完整物品快照 player.pvpLostItems（含強化/詞綴/屬性·上限 50 筆·目前無 UI·供未來復原機制使用）
    try {
        if (!Array.isArray(player.pvpLostItems)) player.pvpLostItems = [];
        player.pvpLostItems.push({ t: Date.now(), from: pick.kind, slot: pick.kind === 'eq' ? pick.slot : null, item: JSON.parse(JSON.stringify(Object.assign({}, pick.item, { cnt: 1 }))) });
        if (player.pvpLostItems.length > 50) player.pvpLostItems = player.pvpLostItems.slice(-50);
    } catch (e) {}
    if (pick.kind === 'eq') {
        if ((pick.item.cnt || 1) > 1) pick.item.cnt -= 1;
        else player.eq[pick.slot] = null;
    } else {
        let live = player.inv[pick.index];
        if (!live || live !== pick.item) live = player.inv.find(it => it === pick.item || (pick.item.uid && it && it.uid === pick.item.uid));
        if (live) {
            if ((live.cnt || 1) > 1) live.cnt -= 1;
            else player.inv = player.inv.filter(it => it !== live);
        }
    }
    logSys(`<span class="text-red-400 font-bold">邪惡值過低，死亡時遺失了 ${name}。</span>`);
    try { calcStats(); renderTabs(true); updateUI(); } catch (e) {}
}

function killPlayer() {
    player.hp = 0;
    player.dead = true; // 保持死亡狀態，停止遊戲計時
    let _pvpKillers = mapState.mobs.filter(m => m && m.trollPlayer);
    if (_pvpKillers.length && typeof pvpOnPlayerDeath === 'function') pvpOnPlayerDeath(_pvpKillers);
    if (player.trollPlayers && player.trollPlayers.length) {   // 😤 被白目玩家擊殺(場上有白目即視為其戰果)：仇恨解除·離場；🐛 v3.5.74 稽核修#3：付費復仇追殺(pvpRevenge/noExpire)不因死亡解除（10 萬不蒸發·之後仍會遭遇）
        let _tn = mapState.mobs.filter(m => m && m.trollPlayer).map(m => m.n);
        if (_tn.length) {
            let _n0 = player.trollPlayers.length;
            player.trollPlayers = player.trollPlayers.filter(t => t && (t.pvpRevenge || t.noExpire || !_tn.includes(t.n)));
            if (player.trollPlayers.length !== _n0) logSys("<span class=\"text-rose-300\">白目玩家心滿意足地離開了……</span>");
        }
    }
    // 死亡時清除所有召喚物與召喚 buff（迷魅術/造屍術/召喚屬性精靈/召喚強力屬性精靈一致處理），
    // 與復活流程同步，避免狀態殘留；復活後由自動施放重新召喚。
    player.summon = null;
    player.charmed = null;
    player.buffs.sk_charm = 0;
    // 🧙 v3.2.39 稽核修：v2 召喚實體也在死亡當下消散（summonV2Tick 被 !player.dead 閘住，死亡期間跑不到它的清理分支）
    if (player.summonsV2 && player.summonsV2.length) { player.summonsV2 = []; try { if (typeof renderSummonPanel === 'function') renderSummonPanel(true); } catch (e) {} }
    // 協力傭兵：死亡當下不解散；改由「祈求復活回城」時解散（原地復活/返生術/復活卷軸則保留）
    player.skills.forEach(s => { if(DB.skills[s] && DB.skills[s].summon) player.buffs[s] = 0; });
    // 🔮 幻術士：死亡時一併清除立方/幻象/化身/疼痛等增益（與召喚一致；復活後由自動施放重新展開）
    if(player.cls === 'illusion') player.skills.forEach(s => { let _d = DB.skills[s]; if(_d && (_d.cube || _d.illuSummon || _d.painReflect || _d.dmgTakenReduce)) player.buffs[s] = 0; });
    // 🌀 時空裂痕：死亡＝結束挑戰——不損失經驗（含經典模式）、不需手動復活，自動回到時空裂痕入口（無原地復活）
    if (state.riftRun) {
        logSys('<span class="text-red-500 font-bold text-lg">你在時空裂痕中力竭倒下……（時空裂痕：死亡不損失經驗）</span>');
        logCombat('你的角色已經死亡。', 'enemy');
        riftEndRun();   // 結算停留時間排名＋產生待領獎勵（並清 state.riftRun）
        player.dead = false;
        player.statuses = { stun: 0, freeze: 0, stone: 0, poison: 0, poisonDmg: 0, poisonTick: 0, burn: 0, burnDmg: 0, burnTick: 0, scald: 0, scaldDmg: 0, scaldTick: 0, bleed: 0, bleedDmg: 0, bleedTick: 0, sleep: 0, silence: 0, paralyze: 0, magicseal: 0 };
        document.getElementById('btn-revive').classList.add('hidden');
        { let ip = document.getElementById('btn-revive-inplace'); if(ip) ip.classList.add('hidden'); }
        setMapSelectors('town_rift');
        calcStats();
        changeMap(true);   // 進入入口安全區：補滿 HP/MP、清狀態、渲染入口（含領獎按鈕）
        saveGame();
        return;
    }
    pvpChaoticDeathItemLoss();
    // 🔧 盟主祝福不再因死亡清空：只有時間到才會消失（亦不受攻城影響）
    let msg = "你的角色已經死亡。（死亡不損失經驗值。）";
    // 🎮 經典模式：死亡損失「該等級最大經驗」的 5%（v3.0.15 由 10% 調降·per-level 進度，最多扣到該等級 0% → 不會降等）
    if (player.classicMode) {
        let _lossCap = Math.floor((getExpReq(player.lv) || 0) * 0.05);
        let _before = player.exp;
        player.exp = Math.max(0, player.exp - _lossCap);
        let _actualLoss = _before - player.exp;
        msg = `你的角色已經死亡。<span class="text-red-300">（經典模式：損失了 ${_actualLoss} 點經驗）</span>`;
        // 🕊️ 死亡紀錄（聖使阿卡塔·亞丁·經典限定）：只記「實際扣掉的經驗」（下限夾 0 後的差額）——當級 0% 死亡損失 0 → 不建檔，杜絕買回沒失去的經驗；上限 10 筆，滿了淘汰最舊；隨 player 入存檔（逐角色獨立）
        if (_actualLoss > 0) {
            if (!Array.isArray(player.deathLog)) player.deathLog = [];
            player.deathLog.push({ lv: player.lv, loss: _actualLoss, t: Date.now() });
            while (player.deathLog.length > 10) player.deathLog.shift();
        }
    }

    // 顯示系統與戰鬥日誌
    logSys(`<span class="text-red-500 font-bold text-lg">${msg}</span>`);
    logCombat(`你的角色已經死亡。`, 'enemy');
    
    // 重新顯示「祈求復活」按鈕
    document.getElementById('btn-revive').classList.remove('hidden');
    updateReviveInPlaceBtn();   // 視條件顯示「原地復活」按鈕
    updateUI();
}

// 🤝 Phase4：怪物魔法施放分派。攻擊型(傷害 sk.dmg／CC・DoT 異常狀態)→「全體名單」打玩家+全部傭兵·否則依仇恨權重抽單一受害者(玩家或某傭兵)。其餘(自我增益/治癒/驅散/破甲/邪氣/物理追擊)照原樣交給 applyMobMagic(對玩家或自身)。
// 🌑 v3.3.33 血壁空間（吉爾塔斯·黑暗妖精聖地.md）：mob._reflectWall={kind,until} 期間內，受到該類型（近距離/遠距離/魔法）傷害→反彈同等傷害給攻擊方（玩家或該傭兵）。
//    🌑 v3.4.14 覆蓋規則統一（玩家傭兵完全一致）：反射＝「普攻主擊＋主動技能直擊」（物理依武器近/遠、魔法=magic）；不反射＝武器特效 proc/雙擊/副手/連射/魔擊/魔爆/龍擊/穿透波及/反擊/居合/受擊荊棘/DoT(毒血灼燒立方風暴)/寵物/召喚。玩家掛點 js/04:132＋js/03 奇古獸＋js/07(魔法/物理/屠宰/咆哮/粉碎/心破/會心)；傭兵掛點 js/06 鏡像同名路徑；傭兵中央匯流 _allyDamageMob 已移除反射（僅承載 proc 類）。
//    掛點＝玩家一般攻擊(playerAttack)/玩家法術(js/07 castSkill)/傭兵一般攻擊(js/06)；DoT/寵物/召喚物傷害不反彈（召喚物無HP池概念沿用舊規）。
// 🌅 巨大骷髏的「恐怖的面貌」僅共用 _reflectWall 資料，不共用血壁覆蓋範圍：另由 terrorVisageOnDamage 補上玩家/傭兵觸發魔法、雙擊/副手、連射、寵物與召喚；中毒、灼燒、出血等持續傷害不掛免疫。
function reflectWallOnDamage(mob, dmg, kind, ally) {
    if (!mob || !mob._reflectWall || !(dmg > 0)) return;
    let rw = mob._reflectWall;
    if (state.ticks > rw.until) { mob._reflectWall = null; return; }
    if (rw.kind !== kind) return;
    // 🌅 恐怖的面貌（block:true·巨大骷髏）：攔截該類傷害——把剛扣的血補回（含致死打擊：所有掛點的 killMob 判定都在本呼叫之後，故補血先於死亡判定）；訊息每秒節流
    if (rw.block) {
        if (mob._dead) return;
        mob.curHp = Math.min(mob.hp, mob.curHp + dmg);
        let _now = Date.now();
        if (!reflectWallOnDamage._blockLogAt || _now - reflectWallOnDamage._blockLogAt >= 1000) {
            reflectWallOnDamage._blockLogAt = _now;
            logCombat(`<span class="font-bold" style="color:#a78bfa;">【恐怖的面貌】</span><span class="${getMobColor(mob.lv)}">${mob.n}</span> 免疫了${{ melee: '近距離', ranged: '遠距離', magic: '魔法' }[rw.kind] || rw.kind}傷害！`, 'enemy');
        }
        return;
    }
    if (mob.curHp <= 0) return;
    let _k = { melee: '近距離', ranged: '遠距離', magic: '魔法' }[rw.kind] || rw.kind;
    if (ally) {
        ally.curHp -= dmg;
        logCombat(`<span class="font-bold" style="color:#f87171;text-shadow:0 0 6px #dc2626;">【血壁空間】</span><span class="${getMobColor(mob.lv)}">${mob.n}</span> 反彈了${_k}傷害，協力·${ally._allyName} 受到 ${dmg} 點傷害！`, 'enemy');
        if (ally.curHp <= 0) { ally.curHp = 0; ally._downed = true; ally._reviveCd = 150; logCombat(`<span class="text-amber-400 font-bold">協力傭兵 ${ally._allyName} 倒下了！（可用返生術立即復活，或 15 秒後自動使用復活卷軸，或回村免費復活）</span>`, 'enemy'); try { renderSquadPanel(); } catch (e) {} }
    } else {
        player.hp -= dmg;
        logCombat(`<span class="font-bold" style="color:#f87171;text-shadow:0 0 6px #dc2626;">【血壁空間】</span><span class="${getMobColor(mob.lv)}">${mob.n}</span> 反彈了${_k}傷害，你受到 ${dmg} 點傷害！`, 'enemy');
        if (player.hp <= 0 && typeof killPlayer === 'function') killPlayer();
    }
}
// 🌅 恐怖的面貌專用補掛點：只處理巨大骷髏的 block，不改吉爾塔斯血壁的反射範圍。
// 傷害必須已先從 curHp 扣除；回傳 true 代表本次傷害被對應免疫完整抵銷。
function terrorVisageOnDamage(mob, dmg, kind) {
    if (!mob || !mob._reflectWall || !mob._reflectWall.block || !(dmg > 0)) return false;
    let before = mob.curHp;
    reflectWallOnDamage(mob, dmg, kind, null);
    return mob.curHp > before;
}
// 🛡️ v3.3.33 反叛者的盾牌（黑暗妖精聖地.md）：受到傷害時 rate(+per×強化)% 機率該次傷害 -amt（玩家＋傭兵、物理＋魔法四路徑共用）
function shieldDmgReduceProc(who, dmg) {
    if (!(dmg > 0) || !who || !who.eq || !who.eq.shield) return dmg;
    let it = who.eq.shield, d0 = DB.items[it.id];
    if (!d0 || !d0.dmgReduceProc) return dmg;
    let p = d0.dmgReduceProc, rate = (p.rate || 0) + (p.per || 0) * (it.en || 0);
    if (Math.random() * 100 >= rate) return dmg;
    logCombat(`<span class="font-bold" style="color:#93c5fd;">【${d0.n}】</span>盾牌吸收了部分衝擊（傷害 -${p.amt || 50}）。`, 'player');
    return Math.max(0, dmg - (p.amt || 50));
}
function castMobMagic(mob, sk) {
    if (!sk) return;
    if (mob && mob.curHp > 0 && typeof _mobAnimTrigger === 'function') _mobAnimTrigger(mob, 'skill');   // 🎞️ 序列幀：技能動作（🔒 鎖定·強制放完·播放中的新觸發被忽略）
    if (mob && mob.curHp > 0) { try { if (typeof playMobSkill === 'function') playMobSkill(mob); } catch (e) {} }   // 🔊 怪物技能(施法)音（查 MOB_SKILL_SFX·查無/缺檔靜音·冰之女王 3564）
    if (mob && mob.curHp > 0 && (mob.n === '死亡騎士' || mob.n === '真‧死亡騎士 冥皇丹特斯')) { try { if (typeof vfxCastShake === 'function') vfxCastShake(); } catch (e) {} }   // ✨ 死亡騎士／真‧死亡騎士 冥皇丹特斯 施放死亡騎士技能特效→整個戰場震動（v3.4.8·cosmetic·吃 __vfxOff）
    let redirectable = !!sk.dmg || ['stone', 'paralyze', 'silence', 'magicseal', 'freeze', 'sleep', 'scald', 'stun', 'slowatk', 'poison', 'burn', 'bleed', 'frost_breath', 'weaken', 'disease', 'potionfrost'].includes(sk.type);
    if (!redirectable) { applyMobMagic(mob, sk); return; }
    let allies = (player.allies || []).filter(a => a && !a._downed && (a.curHp || 0) > 0);
    let pets = (typeof petsOutList === 'function') ? petsOutList().filter(p => p && !p._downed && (p.hp || 0) > 0) : [];
    let sums = (typeof summonV2List === 'function') ? summonV2List().filter(s => s && !s._downed && (s.hp || 0) > 0) : [];   // 🧙 v3.2.82 召喚物加入魔法受害者池
    if (typeof mercSummonList === 'function') sums = sums.concat(mercSummonList());   // 🧱 v3.4.50 傭兵召喚物也入魔法受害者池（AOE 波及＋傷害型單體加權·applyMobMagicToSummon 通用）
    let petWeight = petAggroWeight;   // 🐾 v3.2.82 共用模組權重（含四寵覆寫）
    let sumIn = !!sk.dmg && sums.length;   // 🧙 v3.2.82 召喚物僅「傷害型魔法」納入單體加權池（召喚物無狀態系統→純 CC/DoT 不重導向·以免免疫怪魔法變成召喚物 CC 海綿）；全體型一律波及（AOE 分支·純狀態對其自然無效）
    if ((typeof MOB_PARTY_AOE_SKILLS !== 'undefined') && MOB_PARTY_AOE_SKILLS.has(sk.skn)) {   // 全體：玩家＋全部非倒地傭兵/寵物/召喚物
        if (!player.dead) applyMobMagic(mob, sk);
        for (let a of allies) { if (mob.curHp <= 0) break; applyMobMagicToAlly(mob, sk, a); }
        for (let p of pets) { if (mob.curHp <= 0) break; if (typeof applyMobMagicToPet === 'function') applyMobMagicToPet(mob, sk, p); }
        for (let s of sums) { if (mob.curHp <= 0) break; if (typeof applyMobMagicToSummon === 'function') applyMobMagicToSummon(mob, sk, s); }   // 🧙 v3.2.82 全體魔法波及召喚物（只吃傷害·純狀態內部略過）
        return;
    }
    if (!allies.length && !pets.length && !sumIn) { applyMobMagic(mob, sk); return; }
    let pool = aggroVictimPool(allies);   // 🏺 聖甲蟲的孵育巢：單體指定魔法同樣「未裝備者優先」（全體魔法走上方 AOE 分支不受影響）
    allies = pool.allies;
    let pw = pool.playerIn ? mercAggroWeight(player) : 0, total = pw; for (let a of allies) total += mercAggroWeight(a);
    for (let p of pets) total += petWeight(p);
    if (sumIn) for (let s of sums) total += summonAggroWeight(s);   // 🧙 v3.2.82 傷害型魔法：召喚物入池
    if (total <= 0) { applyMobMagic(mob, sk); return; }
    let r = Math.random() * total; r -= pw;
    if (r < 0) { applyMobMagic(mob, sk); return; }
    for (let a of allies) { r -= mercAggroWeight(a); if (r < 0) { applyMobMagicToAlly(mob, sk, a); return; } }
    for (let p of pets) { r -= petWeight(p); if (r < 0) { if (typeof applyMobMagicToPet === 'function') applyMobMagicToPet(mob, sk, p); return; } }
    if (sumIn) for (let s of sums) { r -= summonAggroWeight(s); if (r < 0) { if (typeof applyMobMagicToSummon === 'function') applyMobMagicToSummon(mob, sk, s); return; } }   // 🧙 v3.2.82
    if (pool.playerIn) applyMobMagic(mob, sk);
    else if (allies.length) applyMobMagicToAlly(mob, sk, allies[allies.length - 1]);
    else if (pets.length && typeof applyMobMagicToPet === 'function') applyMobMagicToPet(mob, sk, pets[pets.length - 1]);
    else applyMobMagic(mob, sk);
}
// 🤝 Phase4：怪物攻擊型魔法作用於「協力傭兵」（applyMobMagic 玩家路徑的精簡鏡像：傷害＋CC/DoT 狀態·用 ally.d.mr/屬抗/dr·扣 ally.curHp·倒地）。玩家專屬層（娃娃抵抗/月光/暗影閃避/魔法屏障/鐵衛5/反射/castleGuard/魔法屏障卷軸）一律不套用。
function applyMobMagicToAlly(mob, sk, ally) {
    if (!mob || mob.curHp <= 0 || !ally || ally._downed || (ally.curHp || 0) <= 0 || !sk) return;
    let d = ally.d || {};
    if (!ally.statuses) ally.statuses = {};
    let st = ally.statuses, mr = d.mr || 0, nm = '協力·' + ally._allyName;
    let _shMul = (mob._sherine ? (mob._sherineMad ? 3 : 2) : 1) * (mob._grace ? 2 : 1);   // 🔮 席琳：傷害/持續傷害倍率
    let _ch = (base) => Math.max(0, ((sk.pbase !== undefined ? sk.pbase : base) - mr) / 2);
    { let _rk = { freeze: 'freeze', stun: 'stun', paralyze: 'paralyze', slowatk: 'slow', poison: 'poison' }[sk.type]; if (_rk && allyStatusResisted(ally, _rk)) return; }   // 🆕 v2.6.11 #4：裝備型異常抵抗/免疫（主 CC 型入口·純狀態技無傷害→抵抗即整個略過）
    if (sk.type === 'stone') { if (d.immStone) return; if (Math.random() * 100 < _ch(100)) { st.stone = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，${nm} 被石化了！`, 'enemy'); } return; }
    if (sk.type === 'paralyze') { if (d.immPoison) return; if (Math.random() * 100 < _ch(50)) { st.paralyze = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，${nm} 被麻痺了！`, 'enemy'); } return; }
    if (sk.type === 'silence') { if (Math.random() * 100 < _ch(60)) { st.silence = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，${nm} 被沉默了！`, 'enemy'); } return; }
    if (sk.type === 'magicseal') { if (Math.random() * 100 < _ch(100)) { st.magicseal = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，${nm} 的魔法被封印了！`, 'enemy'); } return; }
    if (sk.type === 'freeze') { if (Math.random() * 100 < _ch(200)) { st.freeze = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，${nm} 被冰凍了！`, 'enemy'); } return; }
    if (sk.type === 'stun') { if (Math.random() * 100 < _ch(150)) { st.stun = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，${nm} 被暈眩了！`, 'enemy'); } return; }
    if (sk.type === 'slowatk') { if (Math.random() * 100 < _ch(150)) { st.slowAtk = (sk.dur || 8) * 10; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，${nm} 攻擊速度大幅減慢！`, 'enemy'); } return; }
    if (sk.type === 'scald') { if (Math.random() * 100 < _ch(200)) { st.scald = (sk.dur || 15) * 10; st.scaldDmg = _shMul * (sk.d || 100); st.scaldTick = (sk.tick || 3) * 10; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，${nm} 被燙傷了！`, 'enemy'); } return; }
    if (sk.type === 'poison') { if (d.immPoison) return; if (Math.random() * 100 < _ch(100)) { st.poison = sk.dur * 10; st.poisonDmg = Math.floor(_shMul * sk.d * mobRageDmgMult(mob)); st.poisonTick = sk.tick * 10; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，${nm} 中毒了！`, 'enemy'); } return; }
    if (sk.type === 'burn') { if (allyStatusResisted(ally, 'burn')) return; st.burn = sk.dur * 10; st.burnDmg = Math.floor(_shMul * sk.d * mobRageDmgMult(mob)); st.burnTick = sk.tick * 10; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，${nm} 陷入灼燒！`, 'enemy'); return; }   // 🏺 v3.1.76 immBurn（詛咒三頭獸的犄角·傭兵）：主型灼燒查免疫（映射 js/04 allyStatusResisted 原本無人呼叫）
    // 🌅 日出之國純減益：每名傭兵各自以自身 MR 與裝備異常抵抗判定，不再借用主角色狀態。
    if (sk.type === 'weaken') {
        if (Math.random() * 100 < _ch(150)) {
            if (allyStatusResisted(ally, 'weaken')) logCombat(`<span class="text-sky-300 font-bold">${nm} 抵抗了弱化！</span>`, 'magic');
            else { st.weaken = (sk.dur || 15) * 10; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '弱化術'}，${nm} 陷入弱化！（攻擊傷害與命中下降·持續 ${sk.dur || 15} 秒）`, 'enemy'); }
        }
        return;
    }
    if (sk.type === 'disease') {
        if (Math.random() * 100 < _ch(150)) {
            if (allyStatusResisted(ally, 'disease')) logCombat(`<span class="text-sky-300 font-bold">${nm} 抵抗了疾病！</span>`, 'magic');
            else { st.disease = (sk.dur || 20) * 10; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '疾病術'}，${nm} 陷入疾病！（防禦與命中下降·持續 ${sk.dur || 20} 秒）`, 'enemy'); }
        }
        return;
    }
    if (sk.type === 'potionfrost') {
        if (Math.random() * 100 < _ch(150)) {
            if (allyStatusResisted(ally, 'potionFrost')) logCombat(`<span class="text-sky-300 font-bold">${nm} 抵抗了藥水霜化！</span>`, 'magic');
            else { st.potionFrost = (sk.dur || 8) * 10; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '枯竭詛咒'}，${nm} 陷入藥水霜化！（治癒藥水恢復量減少 50%·持續 ${sk.dur || 8} 秒）`, 'enemy'); }
        }
        return;
    }
    // ❄️ 寒冰吐息：(pbase − 傭兵MR)/2 % 機率驅散該傭兵所有增益（保留變身/迷魅/誘捕/召喚），並使其攻擊速度減慢100%（比照玩家 js/04:1330·全體 AoE 同時打玩家與各傭兵）
    if (sk.type === 'frost_breath') {
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 200) - mr) / 2);
        if (Math.random() * 100 < chance) {
            if (ally.buffs) { let kept = {}; for (let k in ally.buffs) { let skd = DB.skills[k]; if (k === 'sk_charm' || k === 'taming' || k === 'poly' || (skd && skd.summon)) kept[k] = ally.buffs[k]; } ally.buffs = kept; }
            let _slowed = !allyStatusResisted(ally, 'slow');
            if (_slowed) st.slowAtk = (sk.dur || 8) * 10;
            if (typeof _allyLevelRecompute === 'function') _allyLevelRecompute(ally);   // 驅散後即時重算 ally.d（否則增益效果殘留到下次 allyMaintainBuffs）
            logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '寒冰吐息'}，驅散了 ${nm} 的增益狀態${_slowed ? '，並使其攻擊速度大幅減慢！' : '。'}`, 'enemy');
        }
        return;
    }
    if (sk.dmg) {
        let _asleepA = st.sleep > 0;   // 🆕 v2.6.13 #5b 魔法迴避層（比照玩家·作用於傷害魔法；睡眠中不可迴避）
        if (!_asleepA && ally._setMoon5 && roll(1, 100) <= effResistPct((d.er || 0))) { logCombat(`<span class="font-bold" style="color:#c4b5fd;">【月光 5/5】</span>協力·${ally._allyName} 迴避掉 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 的 ${sk.skn || '魔法'}。`, 'evade', 'enemy'); return; }   // 🔮 月光5：ER 也能閃魔法
        if (!_asleepA && ally.buffs && ally.buffs.sk_dark_dodge > 0 && sk.alwaysHit && Math.random() < 0.5) { logCombat(`<span class="font-bold" style="color:#c4b5fd;">【暗影閃避】</span>協力·${ally._allyName} 看穿並閃過了 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 的 ${sk.skn || '魔法'}。`, 'evade', 'enemy'); return; }   // 🖤 暗影閃避：50% 閃「必中」傷害魔法
        let baseM = roll(sk.dmg[0], sk.dmg[1]);
        let extra = (sk.db || 0) + (sk.dbLv ? (mob.lv || 0) * (sk.dbLvMult || 1) : 0);
        let resF = 1.0;
        if (sk.ele === 'fire' && d.resFire) resF -= effResistPct(d.resFire) / 100;
        if (sk.ele === 'water' && d.resWater) resF -= effResistPct(d.resWater) / 100;
        if (sk.ele === 'earth' && d.resEarth) resF -= effResistPct(d.resEarth) / 100;
        if (sk.ele === 'wind' && d.resWind) resF -= effResistPct(d.resWind) / 100;
        if ((!sk.ele || sk.ele === 'none') && d.resNone) resF -= effResistPct(d.resNone) / 100;   // 🛡️ v3.3.29 無屬性抗性（傭兵鏡像·只對魔法）
        resF = Math.max(0, Math.min(1, resF));
        // 🏺 v3.2.40 稽核修 火熱愛意（傭兵鏡像·魔法）：免疫火屬性法術·與物理路徑共用每傭兵 10 秒節流（鏡像玩家 js/04:1523）
        if (sk.ele === 'fire' && d.fireNullify && state.ticks >= (ally._fireNullCd || 0)) {
            ally._fireNullCd = state.ticks + 100;
            logCombat(`<span class="font-bold" style="color:#fca5a5;">【火熱愛意】</span>協力·${ally._allyName} 化解了 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 的火屬性傷害。`, 'magic');
            return;
        }
        let dmg = sk.fixedDmg ? (baseM + extra) : (Math.floor(Math.floor((baseM + extra) * resF) * mrMult(mr)) - (d.dr || 0));
        if (!sk.fixedDmg && d.wearerEle && sk.ele && sk.ele !== 'none') dmg = Math.max(1, Math.floor(dmg * elementCounterMult(sk.ele, d.wearerEle)));   // 🏺 v3.1.76 火焰/寒冷化身（傭兵）：受剋屬性魔法×1.4、受剋制×0.6（固定傷害不受影響·鏡像玩家 js/04:1445）
        if (st.freeze > 0 && sk.ext_freeze) { dmg += sk.ext_freeze; if (sk.extUnfreeze) st.freeze = 0; }
        dmg = Math.floor(dmg * _shMul);
        if (ally._setIron3) dmg = Math.floor(dmg * 0.8);
        dmg = Math.floor(dmg * avatarSelfDmgReduceMult(ally));   // 🔮 v3.4.45 化身（單體）：傭兵自身持有→受傷 -3%
        dmg = Math.floor(dmg * allyBuffDmgReduceMult(ally));   // 🆕 v2.6.12 #5a：傭兵聖結界-30%/龍裔-15%/狂怒5-20%（受魔法傷害）
        dmg = Math.floor(dmg * mobRageDmgMult(mob));   // 🔥 HP<門檻：技能傷害倍率
        dmg = Math.max(1, Math.floor(Math.max(1, dmg) * riftDamageMult()));
        dmg = allyDollDamageReduced(ally, dmg);   // 🆕 v2.6.10 #3：魔法娃娃機率減免（受魔法傷害）
        dmg = shieldDmgReduceProc(ally, dmg);   // 🌑 v3.3.33 反叛者的盾牌（傭兵鏡像·魔法）
        ally.curHp -= dmg;
        if (dmg > 0 && !ally._stunCycle) { ally._atkCd = (ally._atkCd || 0) + ((ally.d && ally.d.hitstun) || 0); ally._stunCycle = true; }   // ⚔️ 天堂職業硬直（傭兵·魔法）：延遲下次攻擊·每週期一次
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，對 ${nm} 造成 ${dmg} 點魔法傷害。`, 'enemy');
        if (sk.vamp || sk.vampFull) { let heal = sk.vampFull ? dmg : roll(sk.vamp[0], sk.vamp[1]); mob.curHp = Math.min(mob.hp, mob.curHp + heal); }
        if (sk.sec) {   // 二次狀態（比照玩家：blind/freeze/stun/sleep/paralyze/burn/scald/bleed/poison）；傷害照樣結算，只擋附帶狀態
            let s = sk.sec, _sc = (b) => Math.random() * 100 < Math.max(0, ((s.pbase !== undefined ? s.pbase : b) - mr) / 2);
            if (s.type === 'blind' && _sc(200)) {
                if (allyStatusResisted(ally, 'blind')) logCombat(`<span class="text-sky-300 font-bold">${nm} 抵抗了目盲！</span>`, 'magic');
                else { st.blind = (s.dur || 15) * 10; logCombat(`${nm} 陷入目盲！（命中大幅下降·持續 ${s.dur || 15} 秒）`, 'enemy'); }
            }
            else if (s.type === 'freeze') { if (!allyStatusResisted(ally, 'freeze') && _sc(200)) st.freeze = 60; }
            else if (s.type === 'stun') { if (!allyStatusResisted(ally, 'stun') && _sc(150)) st.stun = (s.dur || 6) * 10; }
            else if (s.type === 'sleep') { if (!allyStatusResisted(ally, 'sleep') && _sc(150)) st.sleep = (s.dur || 6) * 10; }
            else if (s.type === 'paralyze') { if (!d.immPoison && !allyStatusResisted(ally, 'paralyze') && _sc(50)) st.paralyze = (s.dur || 6) * 10; }
            else if (s.type === 'burn') { if (!allyStatusResisted(ally, 'burn') && _sc(100)) { st.burn = s.dur * 10; st.burnDmg = Math.floor(_shMul * s.d * mobRageDmgMult(mob)); st.burnTick = s.tick * 10; } }   // 🏺 v3.1.76 immBurn（傭兵）：二次狀態灼燒亦查免疫
            else if (s.type === 'scald') { if (_sc(200)) { st.scald = s.dur * 10; st.scaldDmg = _shMul * s.d; st.scaldTick = s.tick * 10; } }
            else if (s.type === 'bleed') { if (_sc(200)) { st.bleed = s.dur * 10; st.bleedDmg = _shMul * s.d; st.bleedTick = s.tick * 10; } }
            else if (s.type === 'poison') { if (!d.immPoison && !allyStatusResisted(ally, 'poison') && _sc(100)) { st.poison = s.dur * 10; st.poisonDmg = Math.floor(_shMul * s.d * mobRageDmgMult(mob)); st.poisonTick = s.tick * 10; } }
        }
        allyReflectOnHit(ally, mob, dmg, true);   // 🆕 v2.6.14 #5c：受魔法反射（疼痛歡愉/致命身軀/泰坦魔法/鏡反射）·置於 vamp/sec 後→反射擊殺不被 mob vamp 復活
        if (ally._setIron5 && ally.eq && ally.eq.wpn && ally._ironSweepTick !== state.ticks) { ally._ironSweepTick = state.ticks; allyIronGuardSweep(ally, '受擊'); }   // 🆕 v2.6.14 #5c：鐵衛5/5 受擊橫掃
        if ((d.hurtExplode || 0) > 0 && dmg > 0) bombFlowerExplode(ally);   // 💥 v3.1.76 爆彈花蕊（傭兵）：受魔法傷害亦爆裂（鏡像玩家 js/04）
        if (dmg > 0) _allyRelicOnDamageHeal(ally);   // 🏺 v3.1.76 白螞蟻蛋殼（傭兵）：受魔法傷害亦自癒（物理/魔法共用每傭兵冷卻）
        if (dmg > 0 && ally.curHp > 0 && typeof allyRapidfire === 'function') allyRapidfire(ally, true, true);   // 🏺 地精靈王的抗拒（傭兵）：受魔法傷害時強制連射
        if (ally.curHp <= 0) { ally.curHp = 0; ally._downed = true; ally._reviveCd = 150; logCombat(`<span class="text-amber-400 font-bold">協力傭兵 ${ally._allyName} 倒下了！（可用返生術立即復活，或 15 秒後自動使用復活卷軸，或回村免費復活）</span>`, 'enemy'); try { renderSquadPanel(); } catch (e) {} }
        return;
    }
}
function applyMobMagic(mob, sk) {   // 🌅 statusHealHp 包裝：進入前快照玩家狀態→跑完比對新中招（見 _statusInflictHeal·巢狀時只有最外層補血）
    let _snap = _playerStatusSnap(); _statusHealDepth++;
    try { return _applyMobMagicInner(mob, sk); }
    finally { _statusHealDepth--; if (_statusHealDepth === 0) _statusInflictHeal(_snap); }
}
function _applyMobMagicInner(mob, sk) {
    if(!sk) return;
    // 🌑 v3.3.33 血壁空間（吉爾塔斯）：自我增益·隨機獲得 近距離/遠距離/魔法 反射之一（持續 dur 秒），期間受該類型傷害→反彈同等傷害給攻擊方（不受絕對屏障影響·置於屏障檢查前）
    if(sk.type === 'reflectwall') {
        if(!mob || mob.curHp <= 0) return;
        let _kinds = ['melee', 'ranged', 'magic'];
        let _k = _kinds[Math.floor(Math.random() * _kinds.length)];
        mob._reflectWall = { kind: _k, until: state.ticks + (sk.dur || 10) * 10 };
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放 ${sk.skn || '血壁空間'}，獲得了<span class="font-bold" style="color:#f87171;">${{ melee: '近距離', ranged: '遠距離', magic: '魔法' }[_k]}反射</span>（10 秒）！`, 'enemy');
        return;
    }
    // 🌅 恐怖的面貌（巨大骷髏）：自我增益·隨機免疫 近距離/遠距離/魔法 傷害之一（持續 dur 秒）——重用血壁 _reflectWall 結構（block:true→reflectWallOnDamage 改攔截回復而非反彈·所有直擊掛點自動涵蓋·DoT/寵物/召喚沿血壁慣例不受影響）
    if(sk.type === 'terror_visage') {
        if(!mob || mob.curHp <= 0) return;
        let _kinds = ['melee', 'ranged', 'magic'];
        let _k = _kinds[Math.floor(Math.random() * _kinds.length)];
        mob._reflectWall = { kind: _k, until: state.ticks + (sk.dur || 10) * 10, block: true };
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 展露 ${sk.skn || '恐怖的面貌'}，<span class="font-bold" style="color:#a78bfa;">免疫${{ melee: '近距離', ranged: '遠距離', magic: '魔法' }[_k]}傷害</span>（${sk.dur || 10} 秒）！`, 'enemy');
        return;
    }
    if(inAbsBarrier()) return;   // 🛡️ 絕對屏障：與世界隔絕，敵方魔法（傷害與異常狀態）一律無效
    if(!mob || mob.curHp <= 0) return;   // 🔧 施法者已死亡（如 mag1 追加攻擊期間被反殺）：mag2/mag3 不得以死怪身分施放
    if(mob.st && mob.st.confuse > 0 && !mob.boss) { logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 思緒混亂，無法施放技能。`, 'magic'); return; }   // 🔮 混亂：非BOSS敵人無法施放技能
    
    // 衝擊之暈：追加一次一般攻擊（含看破判定），命中時依機率附加暈眩
    if(sk.type === 'extra_attack') {
        if(player.dead) return;
        let idx = mapState.mobs.indexOf(mob);
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 使出 ${sk.skn || '衝擊之暈'}，追加一次攻擊！`, 'enemy');
        enemyPhysicalAttack(mob, idx, sk.stunChance || 0, sk.atkDmg || null, (sk.atkDb != null ? sk.atkDb : null));
        return;
    }
    // 三重矢：立即額外進行多次一般攻擊（各自依一般攻擊計算命中）
    if(sk.type === 'multi_attack') {
        if(player.dead) return;
        let idx = mapState.mobs.indexOf(mob);
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 使出 ${sk.skn || '三重矢'}，連續攻擊！`, 'enemy');
        let times = sk.times || 3;
        for(let t = 0; t < times; t++) { if(player.dead || mob.curHp <= 0) break; enemyPhysicalAttack(mob, idx, 0, sk.atkDmg || null, (sk.atkDb != null ? sk.atkDb : null)); }   // 🔧 連擊中攻擊者被反殺即中止剩餘攻擊
        return;
    }
    // 呼喚盟友：場上敵人未滿 3 人時，立即追加一次一般攻擊（命中依機率附加暈眩）
    if(sk.type === 'call_ally') {
        if(player.dead) return;
        if(mapState.mobs.filter(x => x).length >= 3) return;
        let idx = mapState.mobs.indexOf(mob);
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 使出 ${sk.skn || '呼喚盟友'}，追加一次攻擊！`, 'enemy');
        enemyPhysicalAttack(mob, idx, sk.stunChance || 0);
        return;
    }
    // 自我增益：堅固防護(傷害減免) / 暴風神射(額外傷害+命中)
    if(sk.type === 'self_buff') {
        if(sk.buffKind === 'guard') {
            mob._siegeDrVal = (mob.lv >= 50) ? (2 + Math.floor((mob.lv - 50) / 10)) : 1;
            mob._siegeDrEnd = state.ticks + 150;
            logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 使出 ${sk.skn || '堅固防護'}，傷害減免提升了！`, 'enemy');
        } else if(sk.buffKind === 'volley') {
            mob._siegeDmgEnd = state.ticks + 120; mob._siegeHitEnd = state.ticks + 120;
            logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 使出 ${sk.skn || '暴風神射'}，攻勢更猛了！`, 'enemy');
        } else if(sk.buffKind === 'acguard') {   // 🗼 鋼鐵防護：自身 AC 暫時下降（更難被命中），持續 dur 秒
            mob._acGuardVal = sk.acDown || 7;
            mob._acGuardEnd = state.ticks + (sk.dur || 30) * 10;
            logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 使出 ${sk.skn || '鋼鐵防護'}，防護大幅提升！（AC-${mob._acGuardVal}，持續 ${sk.dur || 30} 秒）`, 'enemy');
        }
        return;
    }
    // 破壞盔甲：使玩家陷入「破壞盔甲」，之後受到的一般攻擊傷害 +50%，持續 8 秒
    if(sk.type === 'armor_break') {
        if(player.dead) return;
        player.statuses.armorBreak = 80;
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 使出 ${sk.skn || '破壞盔甲'}，破壞了你的防禦！（一般攻擊受傷 +50%，持續 8 秒）`, 'enemy');
        return;
    }
    // 邪靈之氣：必定命中，使玩家 AC+10、ER−10，持續 dur 秒（數值套用於 calcStats 的 evilAura 判定）
    if(sk.type === 'stat_debuff') {
        if(player.dead) return;
        player.statuses.evilAura = (sk.dur || 6) * 10;
        calcStats();   // 立即套用 AC/ER 變化
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放 ${sk.skn || '邪靈之氣'}，邪氣纏身！（AC+${sk.acUp || 10}、ER−${sk.erDown || 10}，持續 ${sk.dur || 6} 秒）`, 'enemy');
        return;
    }
    // 😤 v3.5.59 初級治癒術（白目玩家·王族）：恢復自身 healDice HP（滿血不施放）
    if(sk.type === 'self_heal') {
        if (mob.curHp >= mob.hp) return;
        let _min = sk.healDice ? sk.healDice[0] : 30, _max = sk.healDice ? sk.healDice[1] : 60;
        let _h = _min + Math.floor(Math.random() * (_max - _min + 1));   // healDice=[最小,最大] 均勻取值（勿用 roll＝N顆骰）
        mob.curHp = Math.min(mob.hp, mob.curHp + _h);
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放 ${sk.skn || "初級治癒術"}，恢復了 ${_h} 點 HP。`, "enemy");
        renderMobs();
        return;
    }
    // 生命的祝福：場上所有血盟怪物（含自己）每 interval 秒回復 healDice + 等級/3 HP，持續 dur 秒
    if(sk.type === 'pledge_bless') {
        mapState.pledgeBless = {
            left: (sk.dur || 18) * 10,
            interval: (sk.interval || 3) * 10,
            nextIn: (sk.interval || 3) * 10,
            dice: sk.healDice || [1, 20],
            bonus: Math.floor((mob.lv || 1) / 3)
        };
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放 ${sk.skn || '生命的祝福'}，血盟同伴開始恢復生命！`, 'enemy');
        return;
    }
    // 初級治癒術：恢復施法者自身 heal 骰點數 HP（不超過自身 HP 上限）
    if(sk.type === 'self_heal') {
        let _amt = roll(sk.heal[0], sk.heal[1]);
        mob.curHp = Math.min(mob.hp, mob.curHp + _amt);
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放 ${sk.skn || '治癒術'}，恢復了 ${_amt} 點生命。`, 'enemy');
        return;
    }

    // 抗魔係數
    let mrFactor = mrMult(player.d.mr);
    
    if(sk.type === 'stone') {
        if(player.d.immStone) return; // 紅騎士盾牌：免疫石化
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 100) - player.d.mr) / 2);
        if(Math.random() * 100 < chance && !player.dead) { player.statuses.stone = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，你被石化了！`, 'enemy'); }
        return;
    }
    if(sk.type === 'paralyze') {
        if(player.d.immPoison) return; // 潔尼斯戒指：免疫麻痺
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 50) - player.d.mr) / 2);
        if(Math.random() * 100 < chance && !player.dead) { if(playerStatusResisted('paralyze')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了麻痺！</span>', 'magic'); } else { player.statuses.paralyze = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，你被麻痺了！`, 'enemy'); } }
        return;
    }
    if(sk.type === 'silence') {
        let base = (sk.pbase !== undefined ? sk.pbase : 60);
        if(sk.cd === 100 && mob.n === "卡司特王") base = 100;
        let chance = Math.max(0, (base - player.d.mr) / 2);
        if(Math.random() * 100 < chance && !player.dead) {
            if (player.d && player.d.immSilence) { logCombat(`<span class="text-amber-300 font-bold">【被敲爛的半邊頭盔】</span>抵擋了 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 的沉默！`, 'player-special'); }   // 🏺 v3.5.27 免疫沉默
            else { player.statuses.silence = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，你被沉默了！`, 'enemy'); }
        }
        return;
    }
    if(sk.type === 'magicseal') {
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 100) - player.d.mr) / 2);
        if(Math.random() * 100 < chance && !player.dead) { player.statuses.magicseal = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，你的魔法遭到封印了！`, 'enemy'); }
        return;
    }
    if(sk.type === 'freeze') {
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 200) - player.d.mr) / 2);
        if(Math.random() * 100 < chance && !player.dead) { if(playerStatusResisted('freeze')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了冰凍！</span>', 'magic'); } else { player.statuses.freeze = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，你被冰凍了！`, 'enemy'); } }
        return;
    }
    if(sk.type === 'scald') {
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 200) - player.d.mr) / 2);
        if(Math.random() * 100 < chance && !player.dead) {
            if(playerStatusResisted('scald')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了燙傷！</span>', 'magic'); return; }   // 🪆 抵抗異常（娃娃 abnormalResist）涵蓋 DoT
            let _scD = ((mob._sherine ? (mob._sherineMad ? 3 : 2) : 1) * (mob._grace ? 2 : 1)) * (sk.d||100);   // 🔮 席琳的世界：持續傷害×2
            player.statuses.scald = (sk.dur||15) * 10; player.statuses.scaldDmg = _scD; player.statuses.scaldTick = (sk.tick||3) * 10;
            logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，你被燙傷了！每 ${sk.tick||3} 秒受到 ${_scD} 點固定傷害。`, 'enemy');
        }
        return;
    }
    if(sk.type === 'stun') {
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 150) - player.d.mr) / 2);
        if(Math.random() * 100 < chance && !player.dead) {
            if(playerStatusResisted('stun')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了暈眩！</span>', 'magic'); }
            else { player.statuses.stun = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，你被暈眩了！`, 'enemy'); }
        }
        return;
    }
    // 地面障礙：((pbase − 玩家MR)/2)% 機率使玩家陷入緩速（攻擊速度大幅減慢），持續 dur 秒
    if(sk.type === 'slowatk') {
        if(player.dead) return;
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 150) - player.d.mr) / 2);
        if(Math.random() * 100 < chance) {
            if (playerStatusResisted('slow')) {
                logCombat('<span class="text-sky-300 font-bold">你抵抗了緩速！</span>', 'magic');
            } else {
                player.statuses.slowAtk = (sk.dur || 8) * 10;
                calcStats();
                logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '緩速'}，使你的攻擊速度大幅減慢！（持續 ${sk.dur || 8} 秒）`, 'enemy');
                updateUI();
            }
        }
        return;
    }
    // 🌅 弱化（轆轤首·弱化術）：((pbase − 玩家MR)/2)% 機率使玩家陷入弱化——攻擊傷害 −5、命中 −2（getPhysicalDmg 消費），持續 dur 秒
    if(sk.type === 'weaken') {
        if(player.dead) return;
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 150) - player.d.mr) / 2);
        if(Math.random() * 100 < chance) {
            if(playerStatusResisted('weaken')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了弱化！</span>', 'magic'); return; }   // 🪆 抵抗異常（娃娃 abnormalResist 等通用抵抗）
            player.statuses.weaken = (sk.dur || 15) * 10;
            logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '弱化術'}，你陷入了<span class="font-bold" style="color:#fbbf24;">弱化</span>！（攻擊傷害與命中下降·持續 ${sk.dur || 15} 秒）`, 'enemy');
        }
        return;
    }
    // 🌅 疾病（唐傘小僧·疾病術）：((pbase − 玩家MR)/2)% 機率使玩家陷入疾病——AC +8（更易被命中）、命中 −4，持續 dur 秒
    if(sk.type === 'disease') {
        if(player.dead) return;
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 150) - player.d.mr) / 2);
        if(Math.random() * 100 < chance) {
            if(playerStatusResisted('disease')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了疾病！</span>', 'magic'); return; }
            player.statuses.disease = (sk.dur || 20) * 10;
            logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '疾病術'}，你陷入了<span class="font-bold" style="color:#a3e635;">疾病</span>！（防禦與命中下降·持續 ${sk.dur || 20} 秒）`, 'enemy');
        }
        return;
    }
    // 🌅 藥水霜化（巨大骷髏·枯竭詛咒）：全體技會逐一呼叫玩家/傭兵路徑，各自用自身 MR 判定並只影響自己的治癒藥水。
    if(sk.type === 'potionfrost') {
        if(player.dead) return;
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 150) - player.d.mr) / 2);
        if(Math.random() * 100 < chance) {
            if(playerStatusResisted('potionFrost')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了藥水霜化！</span>', 'magic'); return; }
            player.statuses.potionFrost = (sk.dur || 8) * 10;
            logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '枯竭詛咒'}，你陷入了<span class="font-bold" style="color:#93c5fd;">藥水霜化</span>！（治癒藥水恢復量減少 50%·持續 ${sk.dur || 8} 秒）`, 'enemy');
        }
        return;
    }
    if(sk.type === 'self_haste') {
        if(mob._baseAtkSpd === undefined) mob._baseAtkSpd = mob.atkSpd;
        mob.atkSpd = sk.spd;
        mob._hasteTicks = (sk.dur || 8) * 10;   // 持續時間(秒)→ticks
        mob._atkCd = Math.max(1, Math.floor(mob.atkSpd * 10));
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 對自己施放了 ${sk.skn || '加速術'}，攻擊速度提升！`, 'enemy');
        return;
    }
    
    if(sk.type === 'poison') {
        if(player.d.immPoison) return; // 潔尼斯戒指：免疫中毒/猛毒
        let base = (sk.pbase !== undefined ? sk.pbase : 100);
        if(sk.pbase === undefined && (mob.n === "妖魔殭屍" || mob.n === "蟑螂人")) base = 60;
        let chance = Math.max(0, (base - player.d.mr) / 2);
        if(Math.random() * 100 < chance && !player.dead) {
            if(playerStatusResisted('poison')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了中毒！</span>', 'magic'); return; }   // 🪆 抵抗異常（娃娃 abnormalResist）涵蓋 DoT；immPoison 已於上方早退
            let _poD = Math.floor(((mob._sherine ? (mob._sherineMad ? 3 : 2) : 1) * (mob._grace ? 2 : 1)) * sk.d * mobRageDmgMult(mob));   // 🔮 席琳的世界／🔥頭目狂暴：持續傷害倍率
            player.statuses.poison = sk.dur * 10;
            player.statuses.poisonDmg = _poD;
            player.statuses.poisonTick = sk.tick * 10;
            logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，你中毒了！每 ${sk.tick} 秒受到 ${_poD} 點固定傷害。`, 'enemy');
        }
        return;
    }
    
    if(sk.type === 'burn') {
        if(playerStatusResisted('burn')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了灼燒！</span>', 'magic'); return; }   // 🪆 抵抗異常（娃娃 abnormalResist）涵蓋 DoT
        let _buD = Math.floor(((mob._sherine ? (mob._sherineMad ? 3 : 2) : 1) * (mob._grace ? 2 : 1)) * sk.d * mobRageDmgMult(mob));   // 🔮 席琳的世界／🔥頭目狂暴：持續傷害倍率
        player.statuses.burn = sk.dur * 10;
        player.statuses.burnDmg = _buD;
        player.statuses.burnTick = sk.tick * 10;
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，你陷入了火牢灼燒！每 ${sk.tick} 秒受到 ${_buD} 點固定傷害。`, 'enemy');
        return;
    }

    // 寒冰吐息：(200 − 玩家MR)/2 % 機率，驅散玩家所有增益（夥伴與召喚保留），並使攻擊速度減慢100%，持續 dur 秒
    if(sk.type === 'frost_breath') {
        if(player.dead) return;
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 200) - player.d.mr) / 2);
        if(Math.random() * 100 < chance) {
            let kept = {};
            for(let k in player.buffs) {
                let skd = DB.skills[k];
                if(k === 'sk_charm' || k === 'taming' || k === 'poly' || (skd && skd.summon)) kept[k] = player.buffs[k];
            }
            player.buffs = kept;
            let _frostSlowed = !playerStatusResisted('slow');   // 🪆 寒冰吐息：驅散增益必發生；緩速可被免疫/抵抗
            if (_frostSlowed) player.statuses.slowAtk = (sk.dur || 8) * 10;
            else logCombat('<span class="text-sky-300 font-bold">你抵抗了緩速！</span>', 'magic');
            calcStats();
            logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '寒冰吐息'}，驅散了你的增益狀態${_frostSlowed ? '，並使你的攻擊速度大幅減慢！（持續 ' + (sk.dur || 8) + ' 秒）' : '。'}`, 'enemy');
            updateUI();
        }
        return;
    }

    // 🗼 集體相消（幻象眼魔）：必定生效，驅散玩家身上的增益（保留 傭兵/召喚/夥伴/迷魅/誘捕/變形）
    if(sk.type === 'dispel') {
        if(player.dead) return;
        let kept = {};
        for(let k in player.buffs) {
            let skd = DB.skills[k];
            if(k === 'sk_charm' || k === 'taming' || k === 'poly' || (skd && skd.summon)) kept[k] = player.buffs[k];
        }
        player.buffs = kept;
        calcStats();
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '集體相消'}，驅散了你身上的增益狀態！`, 'enemy');
        updateUI();
        return;
    }

    // 🔧 治癒場上全體：為包含自己在內所有存活怪物恢復 HP（如 蕾雅·高級治癒術）
    if(sk.type === 'heal_allies') {
        let heal = roll(sk.healDice[0], sk.healDice[1]);
        let any = false;
        mapState.mobs.forEach(m => { if(m && m.curHp > 0 && !m._dead) { m.curHp = Math.min(m.hp, m.curHp + heal); any = true; } });
        if(any) { logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '治癒術'}，為場上怪物各恢復 ${heal} HP！`, 'enemy'); if(!state.ff) renderMobs(); }
        return;
    }

    if(sk.dmg) {
        let _asleepM = !!(player.statuses && player.statuses.sleep > 0);   // 🗼 沉睡：必定被命中、受擊即醒（無法迴避魔法）
        // 🔮 月光 5/5：ER 也能迴避魔法攻擊（必中技能改為先判定 ER）
        if (!_asleepM && player._setMoon5 && roll(1, 100) <= effResistPct(player.d.er)) {
            logCombat(`<span class="font-bold" style="color:#c4b5fd;">【月光 5/5】</span>你迴避掉 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放的 ${sk.skn || '魔法'}。`, 'evade');
            return;
        }
        // 🔧 暗影閃避：50% 迴避「必定命中」的傷害魔法，成功後失效並冷卻 5 秒
        if (!_asleepM && player.buffs && player.buffs.sk_dark_dodge > 0 && sk.alwaysHit && Math.random() < 0.5) {
            player.buffs.sk_dark_dodge = 0; player._darkDodgeCd = state.ticks + 50; calcStats();
            logCombat(`<span class="font-bold" style="color:#c4b5fd;">【暗影閃避】</span>你看穿並閃過了 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 的 ${sk.skn || '魔法'}。`, 'evade');
            return;
        }
        // 魔法屏障：僅吸收「會造成魔法傷害」的技能。衝擊之暈/三重矢(一般攻擊)與純異常狀態技能都在更早的分支已 return，不會進入此處，故無法被吸收。
        if(player.buffs.sk_magic_shield > 0) { player.buffs.sk_magic_shield = 0; player.magicShieldCd = 3; logCombat(`魔法屏障吸收了攻擊！（3 秒內無法再次施展魔法屏障）`, 'magic'); return; }
        let baseMagicDmg = roll(sk.dmg[0], sk.dmg[1]);
        let extraMagicDmg = (sk.db || 0) + (sk.dbLv ? (mob.lv || 0) * (sk.dbLvMult || 1) : 0);   // dbLv：傷害加值=怪物等級(=玩家等級)×dbLvMult(預設1)
        
        let resFactor = 1.0;
        if(sk.ele === 'fire' && player.d.resFire) resFactor -= effResistPct(player.d.resFire)/100;
        if(sk.ele === 'water' && player.d.resWater) resFactor -= effResistPct(player.d.resWater)/100;
        if(sk.ele === 'earth' && player.d.resEarth) resFactor -= effResistPct(player.d.resEarth)/100;
        if(sk.ele === 'wind' && player.d.resWind) resFactor -= effResistPct(player.d.resWind)/100;
        if((!sk.ele || sk.ele === 'none') && player.d.resNone) resFactor -= effResistPct(player.d.resNone)/100;   // 🛡️ v3.3.29 無屬性抗性：無屬性魔法比照屬性抗性折減（取代舊 magicDrNonEle 乘法減免·只對魔法）
        resFactor = Math.max(0, Math.min(1, resFactor));
        // 🏺 遺物 火熱愛意：免疫受到的火屬性傷害（每 10 秒最多觸發 1 次·player._fireNullCd 節流）
        if (sk.ele === 'fire' && player.d.fireNullify && state.ticks >= (player._fireNullCd || 0)) {
            player._fireNullCd = state.ticks + 100;   // 10 秒（100 ticks）節流
            logCombat(`<span class="font-bold" style="color:#fca5a5;">【火熱愛意】</span>你化解了 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 的火屬性傷害。`, 'magic');
            return;
        }

        // 屬性抗性與魔防一律生效：有屬性者受該屬性抗性折減、所有魔法傷害受抗魔(MR)折減（alwaysHit 不再無視防禦）
        // 怪物技能傷害公式: (怪物技能傷害 × 屬抗係數) × 抗魔係數 - 傷害減免
        let dmg;
        if (sk.fixedDmg) {
            dmg = baseMagicDmg + extraMagicDmg;   // 🔧 固定傷害（如 卡瑞·龍的一擊）：不受屬性抗性/抗魔/傷害減免影響
        } else {
            dmg = Math.floor(Math.floor((baseMagicDmg + extraMagicDmg) * resFactor) * mrFactor) - player.d.dr - ((mob.st && (mob.st.confuse > 0 || mob.st.panic > 0)) ? 10 : 0) - ((mob.st && mob.st.doom > 0) ? 20 : 0);   // 🔮 混亂/恐慌：怪物技能傷害-10；🐉 驚悚死神：怪物技能傷害-20（下方 Math.max(1,dmg) 保底）
            if (player.d.wearerEle && sk.ele && sk.ele !== 'none') dmg = Math.max(1, Math.floor(dmg * elementCounterMult(sk.ele, player.d.wearerEle)));   // 🏺 遺物 火焰/寒冷化身：裝備者化屬性→受剋屬性魔法傷害↑(×1.4)、受剋制屬性傷害↓(×0.6)（固定傷害 fixedDmg 不受影響）
        }
        if(sk.ext_freeze && player.statuses.freeze > 0) { dmg += sk.ext_freeze; if(sk.extUnfreeze) player.statuses.freeze = 0; }   // 🔧 冰裂：對冰凍目標額外傷害，並解除冰凍

        if (mob._sherine) dmg = Math.floor(dmg * (mob._sherineMad ? 3 : 2));            // 🔮 席琳的世界：技能最終傷害 ×2（瘋狂×3·增傷）
        if (mob._grace) dmg = Math.floor(dmg * 2);              // 🔮 席琳的恩賜：再 ×2（增傷）
        // 🔧 百分比受傷「減免」統一乘算（多層疊加採乘算：例 鐵衛20%×聖結界30%＝1−0.8×0.7＝44%，非相加 50%）
        { let _drMult = 1.0;
          if (player.buffs.sk_holy_barrier > 0) _drMult *= 0.7;                                                  // 聖結界：-30%
          if (player._setIron3) _drMult *= 0.8;                                                                  // 🔮 鐵衛 3/5：-20%
          if (player.buffs.sk_set_dragonscion > 0) _drMult *= 0.85;                                              // 🐉 龍血·龍裔：-15%
          if (player._setFury5) _drMult *= (1 - furyRageRatio());                                                // 😡 狂怒 5/5：依失血最多 -20%
          _drMult *= avatarSelfDmgReduceMult(player);                                                            // 🔮 v3.4.45 化身（單體）：自身持有→受傷 -3%
          dmg = Math.floor(dmg * _drMult); }
        dmg = Math.floor(dmg * mobRageDmgMult(mob));   // 🔥 HP<門檻：技能傷害倍率
        dmg = Math.max(1, dmg);
        dmg = castleGuardAbsorb(dmg, 'magic');   // 🏰 風木城護衛：承擔 10% 魔法攻擊
        dmg = Math.floor(dmg * riftDamageMult());   // 🌀 時空裂痕 30 分後每分鐘 +20% 怪物技能傷害

        dmg = dollDamageReduced(dmg);   // 🪆 魔法娃娃：受傷機率傷害減免（史巴托/巫妖）
        dmg = shieldDmgReduceProc(player, dmg);   // 🌑 v3.3.33 反叛者的盾牌：受傷 proc（魔法亦適用）
        player.hp -= dmg;
        if (dmg > 0) _relicOnDamageHeal();   // 🏺 遺物 白螞蟻蛋殼：受魔法傷害時亦觸發受擊自癒（5 秒節流·physical/magic 共用冷卻）
        if (dmg > 0) _relicOnHurtCast(mob);   // 🏺 遺物 法師的護身短刀：受魔法傷害時亦 20% 免費施放自動攻擊法術
        if (dmg > 0 && typeof applyPlayerHitstun === 'function') applyPlayerHitstun();   // ⚔️ 天堂職業硬直：被魔法直接命中→延遲下次攻擊
        if (dmg > 0) { try { playSfx('hurt'); } catch(e){} }   // 🔊 音效：玩家受到魔法傷害
        if (player._setIron5 && dmg > 0 && player.hp > 0) ironGuardSweep();   // 🔮 鐵衛 5/5：受到（魔法）傷害時亦觸發（每 tick 節流）
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，對你造成 ${dmg} 點魔法傷害。`, 'enemy');
        if (_asleepM && player.statuses.sleep > 0) { player.statuses.sleep = 0; logCombat('<span class="text-sky-200">你從沉睡中驚醒！</span>', 'magic'); }   // 🗼 沉睡：受到魔法攻擊即醒
        
        if(sk.vamp || sk.vampFull) {
            let heal = sk.vampFull ? dmg : roll(sk.vamp[0], sk.vamp[1]);   // vampFull：恢復等同本次傷害量
            mob.curHp = Math.min(mob.hp, mob.curHp + heal);
            logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 吸取了生命，恢復 ${heal} HP！`, 'enemy');
        }
        
        if(sk.sec) {
            // 🌅 目盲（鵺·夢咒副狀態）：((pbase − 玩家MR)/2)% 機率使玩家陷入目盲——命中 −6（getPhysicalDmg 消費），持續 dur 秒
            if(sk.sec.type === 'blind') {
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 200) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) {
                    if(playerStatusResisted('blind')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了目盲！</span>', 'magic'); }
                    else {
                        player.statuses.blind = (sk.sec.dur || 15) * 10;
                        logCombat(`你陷入了<span class="font-bold" style="color:#c084fc;">目盲</span>！（命中大幅下降·持續 ${sk.sec.dur || 15} 秒）`, 'enemy');
                    }
                }
            }
            if(sk.sec.type === 'freeze') {
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 200) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) { if(playerStatusResisted('freeze')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了冰凍！</span>', 'magic'); } else { player.statuses.freeze = 60; logCombat(`你被冰凍了！`, 'enemy'); } }
            }
            if(sk.sec.type === 'burn') {
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 100) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) {
                    if(playerStatusResisted('burn')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了灼燒！</span>', 'magic'); } else {   // 🪆 抵抗異常（娃娃 abnormalResist）涵蓋 DoT
                    let _sbD = Math.floor(((mob._sherine ? (mob._sherineMad ? 3 : 2) : 1) * (mob._grace ? 2 : 1)) * sk.sec.d * mobRageDmgMult(mob));   // 🔮 席琳的世界／🔥頭目狂暴：持續傷害倍率
                    player.statuses.burn = sk.sec.dur * 10; player.statuses.burnDmg = _sbD; player.statuses.burnTick = sk.sec.tick * 10;
                    logCombat(`你陷入了灼燒！每 ${sk.sec.tick} 秒受到 ${_sbD} 點固定傷害。`, 'enemy');
                    }
                }
            }
            if(sk.sec.type === 'scald') {
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 200) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) {
                    if(playerStatusResisted('scald')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了燙傷！</span>', 'magic'); } else {   // 🪆 抵抗異常（娃娃 abnormalResist）涵蓋 DoT
                    let _ssD = Math.floor(((mob._sherine ? (mob._sherineMad ? 3 : 2) : 1) * (mob._grace ? 2 : 1)) * sk.sec.d * mobRageDmgMult(mob));   // 🔮 席琳的世界／🔥頭目狂暴：持續傷害倍率
                    player.statuses.scald = sk.sec.dur * 10; player.statuses.scaldDmg = _ssD; player.statuses.scaldTick = sk.sec.tick * 10;
                    logCombat(`你被燙傷了！每 ${sk.sec.tick} 秒受到 ${_ssD} 點固定傷害。`, 'enemy');
                    }
                }
            }
            if(sk.sec.type === 'bleed') {
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 200) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) {
                    if(playerStatusResisted('bleed')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了出血！</span>', 'magic'); } else {   // 🪆 抵抗異常（娃娃 abnormalResist）涵蓋 DoT
                    let _sbD = Math.floor(((mob._sherine ? (mob._sherineMad ? 3 : 2) : 1) * (mob._grace ? 2 : 1)) * sk.sec.d * mobRageDmgMult(mob));   // 🔮 席琳的世界／🔥頭目狂暴：持續傷害倍率
                    player.statuses.bleed = sk.sec.dur * 10; player.statuses.bleedDmg = _sbD; player.statuses.bleedTick = sk.sec.tick * 10;
                    logCombat(`你陷入了出血！每 ${sk.sec.tick} 秒受到 ${_sbD} 點固定傷害。`, 'enemy');
                    }
                }
            }
            if(sk.sec.type === 'poison' && !player.d.immPoison) {   // 潔尼斯戒指免疫中毒
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 100) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) {
                    if(playerStatusResisted('poison')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了中毒！</span>', 'magic'); } else {   // 🪆 抵抗異常（娃娃 abnormalResist）涵蓋 DoT
                    let _spD = Math.floor(((mob._sherine ? (mob._sherineMad ? 3 : 2) : 1) * (mob._grace ? 2 : 1)) * sk.sec.d * mobRageDmgMult(mob));   // 🔮 席琳的世界／🔥頭目狂暴：持續傷害倍率
                    player.statuses.poison = sk.sec.dur * 10; player.statuses.poisonDmg = _spD; player.statuses.poisonTick = sk.sec.tick * 10;
                    logCombat(`你中毒了！每 ${sk.sec.tick} 秒受到 ${_spD} 點固定傷害。`, 'enemy');
                    }
                }
            }
            if(sk.sec.type === 'stun') {
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 150) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) {
                    if(playerStatusResisted('stun')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了暈眩！</span>', 'magic'); }
                    else { player.statuses.stun = (sk.sec.dur || 6) * 10; logCombat(`你被暈眩了！`, 'enemy'); }
                }
            }
            if(sk.sec.type === 'sleep') {
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 150) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) { if(playerStatusResisted('sleep')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了沉睡！</span>', 'magic'); } else { player.statuses.sleep = (sk.sec.dur || 6) * 10; logCombat(`你陷入了沉睡！`, 'enemy'); } }
            }
            if(sk.sec.type === 'paralyze' && !player.d.immPoison) {   // 潔尼斯戒指：免疫麻痺（與主 paralyze 分支一致）
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 50) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) { if(playerStatusResisted('paralyze')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了麻痺！</span>', 'magic'); } else { player.statuses.paralyze = (sk.sec.dur || 6) * 10; logCombat(`你被麻痺了！`, 'enemy'); } }
            }
        }

        // 🪞 鏡反射（精靈五階・增益）：受到魔法傷害時，精神% 機率（每 1 點精神 +1%）對施法者造成與所受傷害等量的必中固定傷害
        if(player.buffs && player.buffs.sk_elf_mirror > 0 && dmg > 0 && mob.curHp > 0 && (Math.random() * 100 < (player.d.wis || 0))) {
            mob.curHp -= dmg;
            logCombat(`<span class="font-bold" style="color:#a5f3fc;text-shadow:0 0 8px #22d3ee;">【鏡反射】</span>你將 ${dmg} 點傷害原樣返還給 <span class="${getMobColor(mob.lv)}">${mob.n}</span>！`, 'magic');
            if(mob.curHp <= 0) { let _ri = mapState.mobs.findIndex(m => m && m.uid === mob.uid); if(_ri !== -1) killMob(_ri); }
        }
        // 🔮 疼痛的歡愉：受到魔法「直接」傷害時亦對施法者反射等量無屬性傷害（與物理一致；灼燒/中毒/出血等持續傷害不反射，因其在狀態結算另計）
        if(player.buffs.sk_illu_pain > 0 && dmg > 0 && mob.curHp > 0) {
            let _rf = Math.max(1, Math.floor(dmg * fragileMult(mob)));
            mob.curHp -= _rf; mob.justHit = 'magic'; mobWake(mob);
            logCombat(`<span class="font-bold" style="color:#f472b6;text-shadow:0 0 6px #ec4899;">【疼痛的歡愉】</span>痛楚化為反擊，對 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 造成 ${_rf} 點傷害。`, 'magic');
            if(mob.curHp <= 0) { let _ri = mapState.mobs.findIndex(m => m && m.uid === mob.uid); if(_ri !== -1) killMob(_ri); }
        }
        if(player.skills.includes('sk_warrior_titan_magic') && player.hp < player.mhp * titanThreshold() && dmg > 0 && mob.curHp > 0) {   // ⚔️ 泰坦：魔法：HP<40%(反彈精通 80%) 受技能攻擊反射相同傷害
            let _tm = Math.max(1, Math.floor(dmg * fragileMult(mob)));
            mob.curHp -= _tm; mob.justHit = 'magic'; mobWake(mob);
            logCombat(`<span class="font-bold" style="color:#d6d3d1;text-shadow:0 0 6px #78716c;">【泰坦：魔法】</span>反射相同傷害，對 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 造成 ${_tm} 點傷害。`, 'magic');
            if(mob.curHp <= 0) { let _ri = mapState.mobs.findIndex(m => m && m.uid === mob.uid); if(_ri !== -1) killMob(_ri); }
            else if(hasMastery('k_rebound')) reboundExtraAttack(mob);   // 🏅 反彈精通：觸發忍耐被動→額外普攻
        }
        // 🐉 致命身軀：受到魔法傷害時 23% 機率反射相同傷害（與物理一致）
        if(player.buffs.sk_dragon_deadlybody > 0 && dmg > 0 && mob.curHp > 0 && Math.random() < 0.23) {
            let _rf = Math.max(1, Math.floor(dmg * fragileMult(mob)));
            mob.curHp -= _rf; mob.justHit = 'magic'; mobWake(mob);
            logCombat(`<span class="font-bold" style="color:#fbbf24;text-shadow:0 0 6px #d97706;">【致命身軀】</span>反射相同傷害，對 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 造成 ${_rf} 點傷害。`, 'magic');
            if(mob.curHp <= 0) { let _ri = mapState.mobs.findIndex(m => m && m.uid === mob.uid); if(_ri !== -1) killMob(_ri); }
        }

        if(player.d.hurtExplode > 0 && dmg > 0) bombFlowerExplode();   // 💥 遺物 爆彈花蕊：受魔法傷害時亦爆裂（自傷由下方死亡檢查結算）
        if (dmg > 0 && player.hp > 0) hurtRapidfireProc();   // 🏺 地精靈王的抗拒：受魔法傷害時強制連射（經典亦可）
        if(player.hp <= 0) killPlayer();
        else updateUI();
    }
}

// 野外+血盟掉寶的強化等級機率：安定值+1/+2/+3/+4 = 0.1%/0.01%/0.001%/0.0001%，其餘平分 +0~+安定值
function rollPledgeDropEnhance(safe) {
    safe = safe || 0;
    let r = lootRng('pledgeen');   // 🎲 committed RNG（防 SL 重抽血盟/攻城掉落預附強化）
    if (r < 0.000001) return safe + 4;   // 0.0001%
    if (r < 0.000011) return safe + 3;   // 0.001%
    if (r < 0.000111) return safe + 2;   // 0.01%
    if (r < 0.001111) return safe + 1;   // 0.1%
    // 其餘機率平均分配給 +0 ~ +安定值（安定值=0 時即固定 +0）
    let buckets = safe + 1;
    let lvl = Math.floor(((r - 0.001111) / (1 - 0.001111)) * buckets);
    return Math.min(lvl, safe);
}

// 野外+血盟敵人擊殺掉寶：1% 機率獲得 1 件物品（抽法同潘朵拉黑市權重 getWeightedGachaResult；詞綴走新制——只可能獲得「祝福的」1%，屬性/遠古改由象牙塔『碧恩』取得；仍依安定值附帶強化等級）
function pledgeBonusDrop(mob, rate) {
    if (Math.random() >= (rate || 0.01) * classicDropMult()) return;   // 預設 1% 機率（😤 白目玩家傳 0.10＝10%；🎮 經典模式：×1/10）
    let id = getWeightedGachaResult(true);   // 🔧 血盟野外＋攻城敵人：權重 1 以外的物品以 2 倍權重抽取（權重100→200）
    let d0 = DB.items[id];
    if (!d0) return;
    let isEquip = ((d0.type === 'wpn' && !d0.isArrow) || d0.type === 'arm' || d0.type === 'acc') && !isRelic(d0);   // 🏺 遺物不會祝福
    let item;
    if (isEquip) {
        // 🔧 詞綴改走新制（同 gainItem/rollAffixesNew）：只可能獲得「祝福的」1%；屬性/遠古不再隨機掉落（改由象牙塔『碧恩』取得）
        let _af = rollAffixesNew();
        let attr = _af.attr, bless = _af.bless, anc = _af.anc;
        let en = rollPledgeDropEnhance(d0.safe || 0);   // 依物品安定值決定強化等級（🏛️v3.0.83 傳統權重表分流已移除）
        let _jProbe = { id: id, en: en, bless: bless, anc: anc, attr: attr, seteff: false };   // 🔧 廢品記憶：血盟/攻城掉寶比照 gainItem，依完整簽章（含強化/祝福/詞綴）自動標記
        player.inv.push({ id: id, uid: uid(), cnt: 1, en: en, bless: bless, anc: anc, attr: attr, seteff: false, lock: false, junk: !!(player.junkPrefs && player.junkPrefs[itemSig(_jProbe)]) });
        renderTabs();
        if (d0.grantSkills) { calcStats(); renderSkillSelects(); }
        item = { id: id, en: en, bless: bless, anc: anc, attr: attr, cnt: 1 };
    } else {
        // 非裝備：交給 gainItem 處理（含卷軸變祝福與堆疊），靜默後自行顯示掉落訊息
        let info = gainItem(id, 1, true, false);
        item = info || { id: id, en: 0, bless: false, anc: false, attr: false, cnt: 1 };
    }
    let fullName = getItemFullName(item);
    let colorClass = getItemColor(item);
    logSys(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 攜帶的 <span class="${colorClass} font-bold">${fullName}</span> 掉落了！`);
}

// ===== 內建效率/掉落統計（接在 killMob/gainItem，換地圖重置；不靠函數劫持）=====
