function playerAttack() {
    let target = getTarget();
    if(!target) return;
    // 🔮 幻術士 奇古獸攻擊：裝備奇古獸(必中魔法)或魔劍精通(任意非弓武器套用奇古獸公式) → 走奇古獸路徑，繞過物理命中/迴避
    if (player.cls === 'illusion') {
        let _qw = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
        if (_qw && !_qw.isBow && (_qw.qigu || (player.mastery === 'i_magicsword' && !isWandWeapon(_qw)))) { qiguPlayerAttack(target, _qw); return; }   // 🔮 魔劍精通：排除魔杖（魔杖不轉奇古獸必中路徑）
    }

    let _sureHit = !!((player._setBeauty5 && player._beautyNextSure) || player._darkEvadeSure);   // 🔮 麗人5/5 或 🔧 迴避精通：下一次一般攻擊必中
    let _sureCrit = !!player._darkEvadeCrit;   // 🔧 迴避精通：迴避後下一次一般攻擊必定爆擊
    if (_sureHit || _sureCrit) { player._beautyNextSure = false; player._darkEvadeSure = false; player._darkEvadeCrit = false; }
    if (!_sureHit && target.er && roll(1, 100) <= target.er) {
        logCombat(`<span class="${getMobColor(target.lv)}">${target.n}</span> 成功迴避攻擊。`, 'evade');
        wandLightArrowProc(target);
        magicStrikeProc(target);
        weaponSpellProc(target);   // 🔧 附魔施放(克特之劍/烈炎之劍/冰之女王魔杖等)：攻擊時觸發，不論命中與否（含被迴避）
        return;
    }

    let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
    let arrowData = null;
    
    // 👇 如果拿弓，執行消耗箭矢判定
    if (wpn && wpn.isBow) {
        arrowData = consumeArrow();
        if (!arrowData) return; // 如果沒箭了，中斷攻擊
    }

    let isLarge = target.s === 'L';
    let dice = wpn ? (isLarge ? wpn.dmgL : wpn.dmgS) : 2;
	if (arrowData) {
            // 弓的傷害加上箭的傷害
            dice = isLarge ? (wpn.dmgL + arrowData.dmgL) : (wpn.dmgS + arrowData.dmgS);
        }
    
    let _mainHardSkin = mobHardSkin(target);   // 🏅 穿透精通用：主目標被扣減前的硬皮值
    let result = getPhysicalDmg(dice, target, wpn, arrowData, false, false, _sureHit, _sureCrit);   // 🔮 麗人 5/5：必中（可自然重擊/爆擊）；🔧 迴避精通：必中且必爆

    if (result.hit) {
        // --- 命中滿血的被動怪物且為遠距離攻擊時，賦予 3 秒延遲 ---
        if (target.curHp === target.hp && target.beh === '被動' && result.ranged) {
            target._delayTicks = 30;
        }

        if (wpn && (wpn.eff === 'mp_drain' || wpn.mpOnHit)) {   // 🔧 mpOnHit：eff 已被其他特效(如惡魔王魔杖魔爆)佔用仍可保留命中回MP
            let en = capWpnEn((player.eq.wpn && player.eq.wpn.en) || 0);
            let mpGain = 1 + Math.max(0, en - 6);   // +0~+6：恢復1MP；之後每+1多恢復1（+7:2、+8:3…）
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
        target.curHp -= result.dmg;
        if (wpn && wpn.vampPct && result.dmg > 0) player.hp = Math.min(player.mhp, player.hp + Math.floor(result.dmg * wpn.vampPct));   // 🐉 嗜血者鎖鏈劍：吸取一般攻擊傷害的 % 為 HP
        // 🔧 黑暗妖精：附加劇毒（命中 50%／劇毒精通 100% 使目標中毒：每秒該次攻擊 60%／劇毒精通 200% 傷害，持續 5 秒，最多 1 層，取較高傷害並刷新持續時間）
        if (player.buffs && player.buffs.sk_dark_poison > 0 && target.curHp > 0 && Math.random() < (hasMastery('d_poison') ? 1 : 0.5)) {
            if (!target.st) target.st = newMobStatus();
            let _pPct = hasMastery('d_poison') ? 2.0 : 0.6;   // 🔧 劇毒精通：每秒 200%；否則 60%
            let _pUnit = Math.max(1, Math.floor(result.dmg * _pPct));
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
        if (player._setBeauty5 && result.heavy) player._beautyNextSure = true;   // 🔮 麗人 5/5：觸發重擊 → 下一次一般攻擊必中
        if (player._setWhiteBird5 && target.curHp > 0) { if (!target.st) target.st = newMobStatus(); target.st.fragile = 30; }   // 🔮 白鳥 5/5：脆弱 3 秒（重複觸發刷新）

		// 穿透（貝卡合金）：場上有兩名以上敵人時，普攻額外攻擊「主目標以外隨機一名敵人」，
		// 每個波及目標各自獨立判定是否命中，命中則造成與主目標相同的傷害與屬性；僅一名敵人時與一般近戰相同（不額外攻擊）。
        if (wpn && wpn.eff === 'pierce' && !player.classicMode) {   // 🎮 經典模式：停用穿透
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
        if (player.buffs.sk_warrior_throwaxe > 0 && !result.ranged) { if (target.curHp > 0) applyBleed(target, result.dmg, 5, hasMastery('k_dualaxe')); player.buffs.sk_warrior_throwaxe = 0; try { _vfxProjectile(_vfxSlotRect(target.uid), 'axe'); } catch(e){} logCombat('<span class="font-bold" style="color:#f87171;">【戰斧投擲】</span>斧刃撕裂了敵人，造成出血！', 'player'); }   // ✨ VFX：戰斧投擲觸發時射出旋轉金屬斧   // ⚔️ 戰斧投擲：下一次近戰一般攻擊附加出血（一次性消耗）；🏅 雙斧精通：每層+10%
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
        if (target.curHp <= 0) killMob(mapState.targetIdx);
        else renderMobs();
    } else {
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

    // 🔧 武器附魔施放：一般攻擊(命中或未命中皆然) 依武器機率額外施放內建魔法（死亡騎士的烈炎之劍／克特之劍）
    weaponSpellProc(target);

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
        if (player._setRedLion5) dmg = Math.max(1, Math.floor(dmg * 1.2));   // 🔮 紅獅 5/5：最終傷害 +20%
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
function stormBuffTick(sk) {
    if (!sk) return;
    let targets = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
    if (!targets.length) return;
    let tier = sk.tier || 1;
    let spCoef = (1 + 3 * (player.d.magicDmg || 0) / 16) * (1 + tier / 3);
    let mageDmgMult = (player.cls === 'mage') ? (1.5 + tier / 20) : 1.0;   // 法師攻擊魔法最終加成
    let dice = sk.dmgDice || [1, 10];
    let canFreeze = (sk.freezeHitOff !== undefined);
    let counterEle = STORM_ELE_COUNTER[sk.ele];
    let glow = STORM_ELE_GLOW[sk.ele] || STORM_ELE_GLOW.none;
    let dmgLog = [], frozeLog = [];
    targets.forEach(t => {
        if (t.curHp <= 0) return;
        let isCrit = Math.random() * 100 < (player.d.magicCrit || 0);
        let critMult = isCrit ? (1 + (player.d.magicCritDmg || 0) / 100) : 1.0;
        let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
        let mrFactor = mrMult(effMr);
        let core = roll(dice[0], dice[1]) * spCoef * critMult;
        let fixed = (counterEle && t.e === counterEle) ? 6 : 0;   // 屬性剋制 +6 固定
        let d = Math.floor((core + (player.d.extraMp || 0)) * mrFactor) - (t.dr || 0);
        d = Math.max(1, d) + fixed;
        d = Math.floor(d * mageDmgMult);
        if (player._setRedLion5) d = Math.floor(d * 1.2);   // 🔮 紅獅 5/5
        d = Math.max(1, Math.floor(d * fragileMult(t)));    // 🔮 脆弱（白鳥5）
        t.curHp -= d; t.justHit = (sk.ele && sk.ele !== 'none') ? sk.ele : 'magic'; mobWake(t);
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
// 機率 = (1 + 武器強化值)%；必定命中；基礎傷害 = 骰值 ×(1+強化/20)，受魔法傷害(magicDmg)影響，再經怪物魔防(MR)折減與屬性剋制(+6)。
const ELE_CN = { fire: '火', water: '水', wind: '風', earth: '地', none: '無' };
// 🔧 武器毒咒 proc（死亡之指）：攻擊時 rate% 對目標施加中毒 DoT（每 tick 秒受到 dmg 點，持續 dur 秒）；玩家與傭兵共用
function applyWeaponProcPoison(target, pp) {
    if (!pp) return;
    if (Math.random() * 100 >= (pp.rate || 2)) return;
    let t = (target && target.curHp > 0) ? target : null;
    if (!t) { let alive = mapState.mobs.filter(m => m && m.curHp > 0); if (!alive.length) return; t = alive[Math.floor(Math.random() * alive.length)]; }
    if (!t.st) t.st = newMobStatus();
    let _pd = Math.max(1, roll(pp.dmg[0], pp.dmg[1]));
    t.st.poison = (pp.dur || 15) * 10;
    t.st.poisonTick = (pp.tick || 3) * 10;
    t.st.poisonStacks = Math.max(1, t.st.poisonStacks || 0);
    t.st.poisonUnit = Math.max(t.st.poisonUnit || 0, _pd);
    t.st.poisonDmg = t.st.poisonUnit * t.st.poisonStacks;
    mobWake(t);
    // 🔧 死亡之指毒咒：不再輸出「敵人中毒」套用訊息（只保留每秒中毒傷害日誌）
}
// 💥 猛爆劇毒（破壞雙刀/破壞鋼爪）：依 (rateBase + ratePerEn×強化)% 機率對目標附加；每秒固定 100 真傷、持續 5 秒、最多 1 層（覆蓋刷新）。獨立 m._burstPoison 欄位（不與一般中毒 s.poison 衝突）。玩家與傭兵共用
function applyWeaponBurstPoison(target, cfg, en) {
    if (!cfg) return;
    let rate = (cfg.rateBase != null ? cfg.rateBase : 1) + (cfg.ratePerEn != null ? cfg.ratePerEn : 1) * (en || 0);
    if (Math.random() * 100 >= rate) return;
    let t = (target && target.curHp > 0) ? target : null;
    if (!t) { let alive = mapState.mobs.filter(m => m && m.curHp > 0); if (!alive.length) return; t = alive[Math.floor(Math.random() * alive.length)]; }
    t._burstPoison = { dmg: 100, left: 50 };   // 100/秒 × 5 秒(50 ticks)，最多 1 層→覆蓋刷新
    mobWake(t);
    logCombat(`<span class="font-bold" style="color:#a3e635;text-shadow:0 0 6px #65a30d;">【猛爆劇毒】</span><span class="${getMobColor(t.lv)}">${t.n}</span> 陷入猛爆劇毒（每秒 100 真傷，5 秒）。`, 'player');
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
function weaponSpellProc(target) {
    let inst = player.eq.wpn;
    let wpn = inst ? DB.items[inst.id] : null;
    if (!wpn) return;
    if (wpn.procPoison) applyWeaponProcPoison(target, wpn.procPoison);   // 🔧 死亡之指：攻擊時毒咒
    if (wpn.procBurstPoison) applyWeaponBurstPoison(target, wpn.procBurstPoison, capWpnEn(inst.en));   // 💥 破壞雙刀/鋼爪：攻擊時猛爆劇毒
    if (wpn.procStatusSkill) applyWeaponProcStatusSkill(target, wpn.procStatusSkill);   // 🌑 惡魔王武器：攻擊時 10% 施放疾病術
    // 👹 隱藏的魔族武器：紅惡靈逆襲(4D10水魔傷·受魔法傷害公式·吸10%HP) / 藍惡靈奪魔(回3D6 MP)，4% + 每強化 +1%（經典模式亦可觸發）
    if (wpn.redSpecter || wpn.blueSpecter) {
        let _en = capWpnEn(inst.en);
        if (wpn.redSpecter && Math.random() * 100 < (4 + _en)) {
            let t = (target && target.curHp > 0) ? target : null;
            if (!t) { let _al = mapState.mobs.filter(m => m && m.curHp > 0); if (_al.length) t = _al[Math.floor(Math.random() * _al.length)]; }
            if (t) {
                let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
                let core = roll(4, 10) * (1 + 3 * (player.d.magicDmg || 0) / 16);
                let fixed = isElementCounter('water', t.e) ? 6 : 0;
                let dmg = Math.floor(core * mrMult(effMr)) + fixed - (t.dr || 0);
                dmg = Math.max(1, Math.floor(Math.max(1, dmg) * fragileMult(t)));
                dmg = Math.max(1, Math.floor(dmg * enhanceWpnFinalMult(_en)));   // 🔧 武器強化 +11~+20：最終傷害倍率（與其他武器特效一致）
                if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
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
    else if (wpn.procSkill) procFreeMagicSkill(t, wpn.procSkill, en);   // 🔧 冰之女王魔杖：免費施放法師技能（冰錐），傷害依強化值 ×(1+強化/20)
}
// 🔧 免費施放法師單體傷害魔法（不耗MP/不需學習）：套用與一般魔法相同的魔攻係數/法師加成/屬性剋制/魔防；並依武器強化值 ×(1+強化/20)
function procFreeMagicSkill(t, skId, en) {
    let sk = DB.skills[skId];
    if (!sk || !t || t.curHp <= 0) return;
    let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    let mrFactor = mrMult(effMr);
    let isCrit = Math.random() * 100 < player.d.magicCrit;
    let tier = sk.tier || 1;
    let spCoef = (1 + (3 * player.d.magicDmg / 16)) * (1 + (tier / 3));
    let mageDmgMult = (player.cls === 'mage') ? (1.5 + tier / 20) : 1.0;
    let critMult = isCrit ? (1 + player.d.magicCritDmg / 100) : 1.0;
    let dmgArray = sk.multiDmg || (sk.dmgDice ? [[sk.dmgDice[0], sk.dmgDice[1]]] : []);
    let total = 0;
    dmgArray.forEach((dc, idx) => {
        let core = roll(dc[0], dc[1]) * spCoef * critMult;   // 🔧 強化改吃 +11 最終倍率（見迴圈後，原 ×(1+強化/20) 移除）
        let fixed = 0, extra = 0;
        if (idx === dmgArray.length - 1) {
            extra = player.d.extraMp;
            if (isElementCounter(sk.ele, t.e)) fixed += 6;
        }
        let d = Math.floor((core + extra) * mrFactor) - (t.dr || 0);
        d = Math.max(1, d) + fixed;
        d = Math.floor(d * mageDmgMult);
        if (player._setRedLion5) d = Math.floor(d * 1.2);
        if (player.cls === 'elf' && hasMastery('e_magic') && sk.ele && sk.ele !== 'none' && sk.ele === player.elfEle) d = Math.floor(d * 2);
        total += Math.max(1, Math.floor(d * fragileMult(t)));
    });
    total = Math.floor(total * enhanceWpnFinalMult(en));   // 🔧 武器強化 +11~+20：最終傷害倍率（取代舊 (1+強化/20)）
    if (total > 0) {
        t.curHp -= total; t.justHit = (sk.ele && sk.ele !== 'none') ? sk.ele : 'magic'; mobWake(t);
        if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
        logCombat(`<span class="font-bold" style="color:#93c5fd;text-shadow:0 0 6px #2563eb;">【${sk.n}】</span>額外施放，對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 <span class="${isCrit ? 'text-yellow-500 font-bold' : 'text-cyan-300'}">${total}</span> 點傷害${isCrit ? '（爆擊!）' : ''}。`, 'player-special');
    }
    if (t.curHp > 0 && sk.freeze) applyMobStatus(t, { kind: 'freeze', pbase: sk.freeze, dur: 6 }, sk.n);
    if (t.curHp > 0 && sk.status) applyMobStatus(t, sk.status, sk.n);
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
// 單體：對 t 計算並套用一次附魔施放傷害（不負責 render；回傳是否擊殺）。aoe 由 procWeaponSpell 統一在外層迴圈處理。
function _procWeaponSpellHit(t, sp, en) {
    if (!t || t.curHp <= 0) return false;
    let base = roll(sp.dice[0], sp.dice[1]);   // 🔧 基礎傷害（強化改吃 +11 最終倍率·見下方，原 ×(1+強化/20) 移除）
    let core = base * (1 + 3 * (player.d.magicDmg || 0) / 16);            // 受魔法傷害影響（同一般魔法的魔攻係數）
    let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    let mrFactor = mrMult(effMr);
    let fixed = (sp.ele && sp.ele !== 'none' && isElementCounter(sp.ele, t.e)) ? 6 : 0;   // 屬性剋制 +6（與一般魔法一致）
    let d = Math.floor(core * mrFactor) + fixed - (t.dr || 0);
    if (player.cls === 'elf' && hasMastery('e_magic') && sp.ele && sp.ele !== 'none' && sp.ele === player.elfEle) d = Math.floor(Math.max(1, d) * 2);   // 🏅 魔導精通：武器附帶施放的同屬性傷害魔法 ×2（與 castSkill 一致）
    d = Math.max(1, Math.floor(Math.max(1, d) * fragileMult(t)));
    d = Math.max(1, Math.floor(d * enhanceWpnFinalMult(en)));   // 🔧 武器強化 +11~+20：最終傷害倍率（取代舊 (1+強化/20)·與一般武器一致）
    if (player._setRedLion5) d = Math.max(1, Math.floor(d * 1.2));   // 🔮 紅獅 5/5：最終傷害 +20%
    if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
    t.curHp -= d;
    t.justHit = (sp.ele && sp.ele !== 'none') ? sp.ele : 'magic';
    mobWake(t);
    if (sp.heal && d > 0) { player.hp = Math.min(player.mhp, player.hp + Math.floor(d * sp.heal)); }   // 🐉 寒冰鎖鏈劍·冰之地裂術：恢復造成傷害的指定比例 HP
    let glow = (sp.ele === 'fire') ? '#fca5a5;text-shadow:0 0 6px #dc2626'
             : (sp.ele === 'wind') ? '#67e8f9;text-shadow:0 0 6px #06b6d4'
             : (sp.ele === 'water') ? '#93c5fd;text-shadow:0 0 6px #2563eb'
             : (sp.ele === 'earth') ? '#fcd34d;text-shadow:0 0 6px #b45309'
             : '#d8b4fe;text-shadow:0 0 6px #a855f7';
    let counterTxt = fixed ? ' <span class="text-emerald-300 font-bold">(剋屬性!)</span>' : '';
    logCombat(`<span class="font-bold" style="color:${glow};">【${sp.skn}】</span>劍中之力爆發，對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${d} 點${ELE_CN[sp.ele] || ''}屬性魔法傷害！${counterTxt}`, 'player-special');
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
        uids.forEach(uid => { let mob = mapState.mobs.find(m => m && m.uid === uid && m.curHp > 0); if (mob) _procWeaponSpellHit(mob, sp, en); });
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
    let _spTier = 8;   // 🔧 冰裂術改套「法師 8 階法術傷害公式」：階級係數 (1+階/3) ＋ 最終倍率 (1.5+階/20)
    let core = roll(sp.dice[0], sp.dice[1]) * (1 + 3 * (player.d.magicDmg || 0) / 16) * (1 + _spTier / 3);   // 🔧 基礎×魔攻係數×8階階級係數（強化改吃 +11 最終倍率·見下方，原 ×(1+強化/10) 移除）
    let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    let mrFactor = mrMult(effMr);
    let fixed = (sp.ele && sp.ele !== 'none' && isElementCounter(sp.ele, t.e)) ? 6 : 0;
    let wasFrozen = !!(t.st && t.st.freeze > 0);
    let d = Math.floor(core * mrFactor) + fixed - (t.dr || 0);
    d = Math.floor(Math.max(1, d) * (1.5 + _spTier / 20));   // 🔧 法師 8 階法術最終傷害倍率 (=1.9)
    if (wasFrozen) { d += (sp.shatter || 0); t.st.freeze = 0; }   // 冰凍目標：額外傷害並解除冰凍
    d = Math.max(1, Math.floor(Math.max(1, d) * fragileMult(t)));
    d = Math.max(1, Math.floor(d * enhanceWpnFinalMult(en)));   // 🔧 武器強化 +11~+20：最終傷害倍率（取代舊 (1+強化/10)）
    if (player._setRedLion5) d = Math.max(1, Math.floor(d * 1.2));   // 🔮 紅獅 5/5：最終傷害 +20%
    if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
    t.curHp -= d; t.justHit = sp.ele; mobWake(t);
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

function enemyPhysicalAttack(mob, idx, stunChance = 0, atkDmg = null, atkDb = null) {   // atkDmg/atkDb：連擊技覆寫骰子/加值（如鐮刀劍氣斬 9×3D70+99，與一般攻擊不同）
    if(player.dead) return;
    if(inAbsBarrier()) return;   // 🛡️ 絕對屏障：不受任何傷害（敵方一般/連擊攻擊完全無效，亦不觸發反擊）
    if(!mob || mob.curHp <= 0) return;   // 🔧 攻擊者已死亡（如連擊中被反擊/居合反殺）：死怪不得繼續攻擊

    // 🗼 沉睡：必定被命中、無法迴避，受擊後立即清醒
    let _asleep = !!(player.statuses && player.statuses.sleep > 0);
    // 🔧 暗隱術：100% 迴避一次物理攻擊（迴避後失效並進入 5 秒冷卻）；否則依 ER 有效迴避率判定
    let _stealthDodge = !!(player.buffs && player.buffs.sk_dark_stealth > 0);
    let _titanEr = (player.skills.includes('sk_warrior_titan_bullet') && player.hp < player.mhp * titanThreshold()) ? 50 : 0;   // ⚔️ 泰坦：子彈：HP<40%(反彈精通 80%) 時 ER+50（即時判定，不入 recomputeStats）
    if (!_asleep && (_stealthDodge || roll(1, 100) <= effResistPct(player.d.er + _titanEr))) {
        logCombat(`${player.name || '你'} 成功迴避攻擊。`, 'evade');
        if (hasMastery('d_evade')) { let _s = player._darkEvadeStack || 0; player._darkEvadeStack = 0; if (player.d) player.d.er -= _s; player._darkEvadeSure = true; player._darkEvadeCrit = true; }   // 🔧 迴避精通：清空累積ER，下次一般攻擊必中且必爆
        if (player._setShadow3) { player.hp = Math.min(player.mhp, player.hp + 20); }   // 🔧 暗影 3/5：觸發迴避恢復 20 HP
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
    let mobHitBonus = (mob.hit || 0) - (st.blindVal || 0) - (st.weaken > 0 ? 2 : 0) - (st.disease > 0 ? 4 : 0) + ((mob._siegeHitEnd > state.ticks) ? 2 : 0) + tamerAuraHit(mob);   // 暴風神射：額外命中+2；🔧 馴獸光環
    let rawHitValue = mob.lv + mobHitBonus - player.lv + player.d.ac;
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
        let diceCount = (atkDmg ? atkDmg[0] : mob.dmg[0]) || 1;
        let diceSides = (atkDmg ? atkDmg[1] : mob.dmg[1]) || 1;
        let baseWeaponDmg = heavy ? (diceCount * diceSides) : roll(diceCount, diceSides);
        let dmgBonus = (atkDb != null ? atkDb : (mob.db || 0)) - (st.weaken > 0 ? 4 : 0) - (st.broken > 0 ? 2 : 0) - ((st.confuse > 0 || st.panic > 0) ? 10 : 0) - (st.doom > 0 ? 20 : 0) + ((mob._siegeDmgEnd > state.ticks) ? 4 : 0);   // 暴風神射：額外傷害+4；🔮 混亂/恐慌：一般攻擊傷害-10；🐉 驚悚死神：一般攻擊傷害-20
        let totalDmg = baseWeaponDmg + dmgBonus;
        if (mob._sherine) totalDmg = Math.floor(totalDmg * 2);   // 🔮 席琳的世界：怪物一般攻擊傷害 ×2
        if (mob._grace) totalDmg = Math.floor(totalDmg * 1.5);   // 🔮 席琳的恩賜：再 ×1.5

        let resFactor = 1.0;
        if(mob.e === 'fire' && player.d.resFire) resFactor -= effResistPct(player.d.resFire)/100;
        if(mob.e === 'water' && player.d.resWater) resFactor -= effResistPct(player.d.resWater)/100;
        if(mob.e === 'earth' && player.d.resEarth) resFactor -= effResistPct(player.d.resEarth)/100;
        if(mob.e === 'wind' && player.d.resWind) resFactor -= effResistPct(player.d.resWind)/100;

        resFactor = Math.max(0, Math.min(1, resFactor));
        totalDmg = Math.floor(totalDmg * resFactor);

        // 隨機減免：騎士 (10-AC)/2；妖精/黑暗妖精/龍騎士/戰士 (10-AC)/3；幻術士 (10-AC)/4；王族/法師等 (10-AC)/5
        let rndDrMax = 0;
        let acGap = Math.max(0, 10 - player.d.ac);
        if (player.cls === 'knight')         rndDrMax = Math.floor(acGap / 2);
        else if (player.cls === 'elf')       rndDrMax = Math.floor(acGap / 3);
        else if (player.cls === 'dark')      rndDrMax = Math.floor(acGap / 3);   // 🔧 黑暗妖精：(10-AC)/3（同妖精）
        else if (player.cls === 'dragon')    rndDrMax = Math.floor(acGap / 3);   // 🐉 龍騎士：(10-AC)/3
        else if (player.cls === 'warrior')   rndDrMax = Math.floor(acGap / 3);   // ⚔️ 戰士：(10-AC)/3
        else if (player.cls === 'illusion')  rndDrMax = Math.floor(acGap / 4);   // 🔮 幻術士：(10-AC)/4
        else                                 rndDrMax = Math.floor(acGap / 5);   // 👑 王族／法師等：(10-AC)/5
        rndDrMax = Math.max(0, rndDrMax);
        let randomDr = Math.floor(Math.random() * (rndDrMax + 1));

        totalDmg -= player.d.dr; // 傷害減免（已含增幅防禦）
        totalDmg -= randomDr;    // 隨機減免
        if (player._setIron3) totalDmg = Math.floor(totalDmg * 0.8);   // 🔮 鐵衛 3/5：受到傷害減少 20%

        if(player.buffs.sk_holy_barrier > 0) totalDmg = Math.floor(totalDmg * 0.7);
        if(player.statuses.freeze > 0) {
            totalDmg = Math.floor(totalDmg * 1.5);                              // 冰凍中：受到物理傷害 +50%
            player.statuses.freeze = Math.max(0, player.statuses.freeze - 10); // 並使冰凍剩餘時間 -1 秒(10 ticks)
        }
        if(player.statuses.armorBreak > 0) totalDmg = Math.floor(totalDmg * 1.5);   // 破壞盔甲：一般攻擊受傷 +50%
        if(player.buffs.sk_illu_avatar > 0) totalDmg = Math.max(0, Math.floor(totalDmg * 0.90));   // 🔮 幻覺：化身：受到所有傷害 -10%

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
        if(player.eq.shield && !player.classicMode) {   // 🎮 經典模式：盾牌無格檔
            let _sh = DB.items[player.eq.shield.id];
            let _blockChance = (_sh && _sh.block) ? (heavy ? _sh.block : _sh.block * 0.3) : 0;   // 🛡️ 非重擊：格檔發動率為重擊的 30%
            if(_blockChance > 0 && Math.random() * 100 < _blockChance) { let _before = totalDmg; totalDmg = Math.floor(totalDmg * 0.5); blockReduced = _before - totalDmg; blocked = true; }
        }

        totalDmg = Math.max(1, totalDmg);
        totalDmg = castleGuardAbsorb(totalDmg, 'phys');   // 🏰 肯特城護衛：承擔 10% 一般攻擊
        totalDmg = Math.floor(totalDmg * riftDamageMult());   // 🌀 時空裂痕 30 分後每分鐘 +20% 怪物攻擊力
        player.hp -= totalDmg;
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

        let atkMsg = `${mobInsightPrefix}<span class="${getMobColor(mob.lv)}">${mob.n}</span> 擊中你，造成 ${totalDmg} 點傷害。`;
        if(heavy) atkMsg += " (重擊!)";
        if(blocked) atkMsg += ` <span class="text-cyan-300 font-bold">(格檔！減少 ${blockReduced} 點傷害)</span>`;
        logCombat(atkMsg, 'enemy');
        if (_asleep && player.statuses.sleep > 0) { player.statuses.sleep = 0; logCombat('<span class="text-sky-200">你從沉睡中驚醒！</span>', 'magic'); }   // 🗼 沉睡：受擊即醒

        if (player.hp <= 0) killPlayer();
        else if (stunChance > 0 && Math.random() * 100 < stunChance) {   // 衝擊之暈：命中後依機率附加暈眩
            if (playerStunResisted()) { logCombat('<span class="text-sky-300 font-bold">你抵抗了暈眩！</span>', 'magic'); updateUI(); }
            else { player.statuses.stun = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 的衝擊使你暈眩了！`, 'enemy'); }
        }
        else updateUI();

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

function killPlayer() {
    player.hp = 0;
    player.dead = true; // 保持死亡狀態，停止遊戲計時
    // 死亡時清除所有召喚物與召喚 buff（迷魅術/造屍術/召喚屬性精靈/召喚強力屬性精靈一致處理），
    // 與復活流程同步，避免狀態殘留；復活後由自動施放重新召喚。
    player.summon = null;
    player.charmed = null;
    player.buffs.sk_charm = 0;
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
    // 🔧 盟主祝福不再因死亡清空：只有時間到才會消失（亦不受攻城影響）
    let msg = "你的角色已經死亡。（死亡不損失經驗值。）";
    // 🎮 經典模式：死亡損失「該等級最大經驗」的 10%（per-level 進度，最多扣到該等級 0% → 不會降等）
    if (player.classicMode) {
        let _lossCap = Math.floor((getExpReq(player.lv) || 0) * 0.1);
        let _before = player.exp;
        player.exp = Math.max(0, player.exp - _lossCap);
        msg = `你的角色已經死亡。<span class="text-red-300">（經典模式：損失了 ${_before - player.exp} 點經驗）</span>`;
    }

    // 顯示系統與戰鬥日誌
    logSys(`<span class="text-red-500 font-bold text-lg">${msg}</span>`);
    logCombat(`你的角色已經死亡。`, 'enemy');
    
    // 重新顯示「祈求復活」按鈕
    document.getElementById('btn-revive').classList.remove('hidden');
    updateReviveInPlaceBtn();   // 視條件顯示「原地復活」按鈕
    updateUI();
}

function applyMobMagic(mob, sk) {
    if(!sk) return;
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
        if(Math.random() * 100 < chance && !player.dead) { player.statuses.paralyze = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，你被麻痺了！`, 'enemy'); }
        return;
    }
    if(sk.type === 'silence') {
        let base = (sk.pbase !== undefined ? sk.pbase : 60);
        if(sk.cd === 100 && mob.n === "卡司特王") base = 100;
        let chance = Math.max(0, (base - player.d.mr) / 2);
        if(Math.random() * 100 < chance && !player.dead) { player.statuses.silence = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，你被沉默了！`, 'enemy'); }
        return;
    }
    if(sk.type === 'magicseal') {
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 100) - player.d.mr) / 2);
        if(Math.random() * 100 < chance && !player.dead) { player.statuses.magicseal = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，你的魔法遭到封印了！`, 'enemy'); }
        return;
    }
    if(sk.type === 'freeze') {
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 200) - player.d.mr) / 2);
        if(Math.random() * 100 < chance && !player.dead) { if(playerEquipStatusResist('freezeResist')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了冰凍！</span>', 'magic'); } else { player.statuses.freeze = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，你被冰凍了！`, 'enemy'); } }
        return;
    }
    if(sk.type === 'scald') {
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 200) - player.d.mr) / 2);
        if(Math.random() * 100 < chance && !player.dead) {
            let _scD = ((mob._sherine ? 2 : 1) * (mob._grace ? 2 : 1)) * (sk.d||100);   // 🔮 席琳的世界：持續傷害×2
            player.statuses.scald = (sk.dur||15) * 10; player.statuses.scaldDmg = _scD; player.statuses.scaldTick = (sk.tick||3) * 10;
            logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，你被燙傷了！每 ${sk.tick||3} 秒受到 ${_scD} 點固定傷害。`, 'enemy');
        }
        return;
    }
    if(sk.type === 'stun') {
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 150) - player.d.mr) / 2);
        if(Math.random() * 100 < chance && !player.dead) {
            if(playerStunResisted()) { logCombat('<span class="text-sky-300 font-bold">你抵抗了暈眩！</span>', 'magic'); }
            else { player.statuses.stun = 60; logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，你被暈眩了！`, 'enemy'); }
        }
        return;
    }
    // 地面障礙：((pbase − 玩家MR)/2)% 機率使玩家陷入緩速（攻擊速度大幅減慢），持續 dur 秒
    if(sk.type === 'slowatk') {
        if(player.dead) return;
        let chance = Math.max(0, ((sk.pbase !== undefined ? sk.pbase : 150) - player.d.mr) / 2);
        if(Math.random() * 100 < chance) {
            player.statuses.slowAtk = (sk.dur || 8) * 10;
            calcStats();
            logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '緩速'}，使你的攻擊速度大幅減慢！（持續 ${sk.dur || 8} 秒）`, 'enemy');
            updateUI();
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
            let _poD = ((mob._sherine ? 2 : 1) * (mob._grace ? 2 : 1)) * sk.d;   // 🔮 席琳的世界：持續傷害×2
            player.statuses.poison = sk.dur * 10;
            player.statuses.poisonDmg = _poD;
            player.statuses.poisonTick = sk.tick * 10;
            logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，你中毒了！每 ${sk.tick} 秒受到 ${_poD} 點固定傷害。`, 'enemy');
        }
        return;
    }
    
    if(sk.type === 'burn') {
        let _buD = ((mob._sherine ? 2 : 1) * (mob._grace ? 2 : 1)) * sk.d;   // 🔮 席琳的世界：持續傷害×2
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
            player.statuses.slowAtk = (sk.dur || 8) * 10;
            calcStats();
            logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '寒冰吐息'}，驅散了你的增益狀態，並使你的攻擊速度大幅減慢！（持續 ${sk.dur || 8} 秒）`, 'enemy');
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
        resFactor = Math.max(0, Math.min(1, resFactor));
        
        // 屬性抗性與魔防一律生效：有屬性者受該屬性抗性折減、所有魔法傷害受抗魔(MR)折減（alwaysHit 不再無視防禦）
        // 怪物技能傷害公式: (怪物技能傷害 × 屬抗係數) × 抗魔係數 - 傷害減免
        let dmg;
        if (sk.fixedDmg) {
            dmg = baseMagicDmg + extraMagicDmg;   // 🔧 固定傷害（如 卡瑞·龍的一擊）：不受屬性抗性/抗魔/傷害減免影響
        } else {
            dmg = Math.floor(Math.floor((baseMagicDmg + extraMagicDmg) * resFactor) * mrFactor) - player.d.dr - ((mob.st && (mob.st.confuse > 0 || mob.st.panic > 0)) ? 10 : 0) - ((mob.st && mob.st.doom > 0) ? 20 : 0);   // 🔮 混亂/恐慌：怪物技能傷害-10；🐉 驚悚死神：怪物技能傷害-20（下方 Math.max(1,dmg) 保底）
        }
        if(sk.ext_freeze && player.statuses.freeze > 0) { dmg += sk.ext_freeze; if(sk.extUnfreeze) player.statuses.freeze = 0; }   // 🔧 冰裂：對冰凍目標額外傷害，並解除冰凍

        if(player.buffs.sk_holy_barrier > 0) dmg = Math.floor(dmg * 0.7);
        // 紅騎士盾牌：受到「無屬性」魔法傷害時減少（fire/water/earth/wind 以外視為無屬性）
        if(player.d.magicDrNonEle > 0 && !['fire','water','earth','wind'].includes(sk.ele)) {
            dmg = Math.floor(dmg * (1 - player.d.magicDrNonEle / 100));
        }
        if (mob._sherine) dmg = Math.floor(dmg * 2);            // 🔮 席琳的世界：技能最終傷害 ×2
        if (mob._grace) dmg = Math.floor(dmg * 2);              // 🔮 席琳的恩賜：再 ×2
        if (player._setIron3) dmg = Math.floor(dmg * 0.8);      // 🔮 鐵衛 3/5：受到傷害減少 20%
        if (player.buffs.sk_illu_avatar > 0) dmg = Math.floor(dmg * 0.90);   // 🔮 幻覺：化身：受到所有傷害 -10%（魔法路徑，比照物理 enemyPhysicalAttack）
        dmg = Math.max(1, dmg);
        dmg = castleGuardAbsorb(dmg, 'magic');   // 🏰 風木城護衛：承擔 10% 魔法攻擊
        dmg = Math.floor(dmg * riftDamageMult());   // 🌀 時空裂痕 30 分後每分鐘 +20% 怪物技能傷害

        player.hp -= dmg;
        logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，對你造成 ${dmg} 點魔法傷害。`, 'enemy');
        if (_asleepM && player.statuses.sleep > 0) { player.statuses.sleep = 0; logCombat('<span class="text-sky-200">你從沉睡中驚醒！</span>', 'magic'); }   // 🗼 沉睡：受到魔法攻擊即醒
        
        if(sk.vamp || sk.vampFull) {
            let heal = sk.vampFull ? dmg : roll(sk.vamp[0], sk.vamp[1]);   // vampFull：恢復等同本次傷害量
            mob.curHp = Math.min(mob.hp, mob.curHp + heal);
            logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 吸取了生命，恢復 ${heal} HP！`, 'enemy');
        }
        
        if(sk.sec) {
            if(sk.sec.type === 'freeze') {
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 200) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) { if(playerEquipStatusResist('freezeResist')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了冰凍！</span>', 'magic'); } else { player.statuses.freeze = 60; logCombat(`你被冰凍了！`, 'enemy'); } }
            }
            if(sk.sec.type === 'burn') {
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 100) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) {
                    let _sbD = ((mob._sherine ? 2 : 1) * (mob._grace ? 2 : 1)) * sk.sec.d;   // 🔮 席琳的世界：持續傷害×2
                    player.statuses.burn = sk.sec.dur * 10; player.statuses.burnDmg = _sbD; player.statuses.burnTick = sk.sec.tick * 10;
                    logCombat(`你陷入了灼燒！每 ${sk.sec.tick} 秒受到 ${_sbD} 點固定傷害。`, 'enemy');
                }
            }
            if(sk.sec.type === 'scald') {
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 200) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) {
                    let _ssD = ((mob._sherine ? 2 : 1) * (mob._grace ? 2 : 1)) * sk.sec.d;   // 🔮 席琳的世界：持續傷害×2
                    player.statuses.scald = sk.sec.dur * 10; player.statuses.scaldDmg = _ssD; player.statuses.scaldTick = sk.sec.tick * 10;
                    logCombat(`你被燙傷了！每 ${sk.sec.tick} 秒受到 ${_ssD} 點固定傷害。`, 'enemy');
                }
            }
            if(sk.sec.type === 'bleed') {
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 200) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) {
                    let _sbD = ((mob._sherine ? 2 : 1) * (mob._grace ? 2 : 1)) * sk.sec.d;   // 🔮 席琳的世界：持續傷害×2
                    player.statuses.bleed = sk.sec.dur * 10; player.statuses.bleedDmg = _sbD; player.statuses.bleedTick = sk.sec.tick * 10;
                    logCombat(`你陷入了出血！每 ${sk.sec.tick} 秒受到 ${_sbD} 點固定傷害。`, 'enemy');
                }
            }
            if(sk.sec.type === 'poison' && !player.d.immPoison) {   // 潔尼斯戒指免疫中毒
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 100) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) {
                    let _spD = ((mob._sherine ? 2 : 1) * (mob._grace ? 2 : 1)) * sk.sec.d;   // 🔮 席琳的世界：持續傷害×2
                    player.statuses.poison = sk.sec.dur * 10; player.statuses.poisonDmg = _spD; player.statuses.poisonTick = sk.sec.tick * 10;
                    logCombat(`你中毒了！每 ${sk.sec.tick} 秒受到 ${_spD} 點固定傷害。`, 'enemy');
                }
            }
            if(sk.sec.type === 'stun') {
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 150) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) {
                    if(playerStunResisted()) { logCombat('<span class="text-sky-300 font-bold">你抵抗了暈眩！</span>', 'magic'); }
                    else { player.statuses.stun = (sk.sec.dur || 6) * 10; logCombat(`你被暈眩了！`, 'enemy'); }
                }
            }
            if(sk.sec.type === 'sleep') {
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 150) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) { if(playerEquipStatusResist('sleepResist')) { logCombat('<span class="text-sky-300 font-bold">你抵抗了沉睡！</span>', 'magic'); } else { player.statuses.sleep = (sk.sec.dur || 6) * 10; logCombat(`你陷入了沉睡！`, 'enemy'); } }
            }
            if(sk.sec.type === 'paralyze' && !player.d.immPoison) {   // 潔尼斯戒指：免疫麻痺（與主 paralyze 分支一致）
                let chance = Math.max(0, ((sk.sec.pbase !== undefined ? sk.sec.pbase : 50) - player.d.mr) / 2);
                if(Math.random() * 100 < chance && !player.dead) { player.statuses.paralyze = (sk.sec.dur || 6) * 10; logCombat(`你被麻痺了！`, 'enemy'); }
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

        if(player.hp <= 0) killPlayer();
        else updateUI();
    }
}

// 野外+血盟掉寶的強化等級機率：安定值+1/+2/+3/+4 = 0.1%/0.01%/0.001%/0.0001%，其餘平分 +0~+安定值
function rollPledgeDropEnhance(safe) {
    safe = safe || 0;
    let r = Math.random();
    if (r < 0.000001) return safe + 4;   // 0.0001%
    if (r < 0.000011) return safe + 3;   // 0.001%
    if (r < 0.000111) return safe + 2;   // 0.01%
    if (r < 0.001111) return safe + 1;   // 0.1%
    // 其餘機率平均分配給 +0 ~ +安定值（安定值=0 時即固定 +0）
    let buckets = safe + 1;
    let lvl = Math.floor(((r - 0.001111) / (1 - 0.001111)) * buckets);
    return Math.min(lvl, safe);
}

// 野外+血盟敵人擊殺掉寶：1% 機率獲得 1 件物品（抽法同潘朵拉抽獎卷；詞綴走新制——只可能獲得「祝福的」1%，屬性/遠古改由象牙塔『碧恩』取得；仍依安定值附帶強化等級）
function pledgeBonusDrop(mob) {
    if (Math.random() >= 0.01 * classicDropMult()) return;   // 1% 機率（🎮 經典模式：×1/10）
    let id = getWeightedGachaResult(true);   // 🔧 血盟野外＋攻城敵人：權重 1 以外的物品以 2 倍權重抽取（權重100→200）
    let d0 = DB.items[id];
    if (!d0) return;
    let isEquip = ((d0.type === 'wpn' && !d0.isArrow) || d0.type === 'arm' || d0.type === 'acc');
    let item;
    if (isEquip) {
        // 🔧 詞綴改走新制（同 gainItem/rollAffixesNew）：只可能獲得「祝福的」1%；屬性/遠古不再隨機掉落（改由象牙塔『碧恩』取得）
        let _af = rollAffixesNew();
        let attr = _af.attr, bless = _af.bless, anc = _af.anc;
        let en = traditionalActive() ? rollTraditionalEnhance(d0) : rollPledgeDropEnhance(d0.safe || 0);   // 依物品安定值決定強化等級（🏛️ 傳統模式改用傳統權重表）
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