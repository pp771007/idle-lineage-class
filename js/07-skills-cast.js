function isMageSummonMastered(sm, owner) {
    return !!(sm && owner && owner.mastery === 'm_summon' && (sm.skId === 'sk_zombie' || sm.skId === 'sk_summon'));
}
function summonAttackCount(sm, owner) {
    owner = owner || player;
    let cha = Math.min(60, (owner.d && owner.d.cha) || 0);
    if(sm.kind === 'melee') return 1 + Math.floor(cha / 20);
    // 👑 v3.2.25 精靈精通改版：不再增加精靈數量/攻擊段數（改為 召喚強力屬性精靈→精靈王·見 _elfSpiritKingOverride）
    return 1;
}
// 👑 v3.2.26→v3.4.11 屬性精靈規格鏡像（buildSummon/refreshSummonBalance 兩處套用）：
//   玩家與傭兵都讀 js/23 四屬性表；傭兵保持無敵抽象召喚，但攻擊轉交 spiritAttackOnce 共用命中、傷害與精靈王 AOE。
function _elfSpiritKingOverride(sm, owner) {
    if (!sm || (sm.skId !== 'sk_elf_summon' && sm.skId !== 'sk_elf_summon2') || typeof _spiritSpec !== 'function') return sm;
    const king = sm.skId === 'sk_elf_summon2' && owner && owner.mastery === 'e_spirit';
    const spec = _spiritSpec(sm.skId, sm.ele, king);
    sm.dmgDice = spec.dice; sm.elemScale = spec.scale; sm.dmgMult = spec.dmgMult;
    sm.mrPenBase = spec.mrPenBase; sm.hitLvOff = spec.hitLvOff; sm.interval = spec.aspd;
    if (king && typeof SPIRIT_ELE_ZH !== 'undefined' && sm.ele && SPIRIT_ELE_ZH[sm.ele]) sm.n = '夥伴：' + SPIRIT_ELE_ZH[sm.ele] + '之精靈王';
    sm._king = king;   // 🧝 傭兵走無敵抽象召喚管線，但保留玩家 v2 的精靈王判定與 15% 全體技能
    sm.form = sm.n || sm.form;
    return sm;
}
function summonDamageMult(sm, owner, magicBased, teamMagicDmg) {
    let magicDmg = Math.min(12, Math.max(0, ((owner.d && owner.d.magicDmg) || 0) + (teamMagicDmg || 0)));
    let mult = (sm.dmgMult || 1) * (1 + magicDmg / (magicBased ? 40 : 80));
    if(isMageSummonMastered(sm, owner)) mult *= 1.20;
    if(owner && owner !== player && typeof royalAllyMult === 'function') mult *= royalAllyMult();   // 👑 傭兵召喚傷害亦吃隊長魅力倍率；玩家召喚不受影響
    return mult;
}
function summonHitValue(sm, owner, target, gearHit) {
    let cha = (owner.d && owner.d.cha) || 0;
    let growth = Math.floor((owner.lv || 1) * 0.75 + cha * 0.35);
    let masteryHit = isMageSummonMastered(sm, owner) ? 5 : 0;
    let raw = (owner.lv || 1) + (sm.hitLvOff || 0) + growth + masteryHit - target.lv + mobEffAC(target)
        + (gearHit || 0);   // 🚫 v3.2.19 召喚控制戒指不再附加效果（原 命中+5 移除·戒指只決定能否挑選召喚物）
    return stretchHitValue(raw);
}

function summonAttack(sm, owner) {
    owner = owner || player;   // 🩸 v2.6.25 owner 參數化：owner=player（預設·玩家召喚）或 ally（傭兵召喚）；讀 owner.d.cha/lv/mastery/eq，killMob 仍歸真隊長（不換身）
    if(!sm) return;
    // 🧙 v3.3.23 傭兵召喚術／🧟 v3.3.24 造屍術 v2 抽象輸出：本體不上場（無血條/不被攻擊）·每攻擊週期對目標打 count 隻份的玩家 v2 傷害（召喚術含 water bubble 等 proc·造屍術 '人形殭屍' 不在 SUMMON_TIERS→proc 自動略過）；擊殺歸真隊長（summonV2AttackOnce 內 killMob·不換身）。
    if(sm._v2form && typeof summonV2AttackOnce === 'function') {
        let _s0, _d;
        if(sm._v2zmb) {   // 🧟 造屍術：依殭屍階級 lv 走 _zmbDerive
            _s0 = { skId: 'sk_zombie', form: sm._v2form, lv: sm._v2lv || 10 };
            _d = _zmbDerive(_s0, owner);
        } else {          // 🧙 召喚術：SUMMON_TIERS 選怪 → _sumDerive
            let _lvm = _sumTierOf(sm._v2form);
            _s0 = { skId: 'sk_summon', form: sm._v2form, lv: (_lvm && _lvm.mob && _lvm.mob.lv) || sm._v2lv || 1 };
            _d = _sumDerive({ form: sm._v2form, n: sm._v2form }, owner);
        }
        let _cnt = Math.max(1, sm._v2count || 1);
        for(let i = 0; i < _cnt; i++) { let _t = getTarget(); if(!_t) break; summonV2AttackOnce(_s0, _d, _t, owner); }
        return;
    }
    // 🧝 傭兵屬性精靈保持無敵抽象實體，但攻擊完整改走玩家 v2 精靈公式：四屬性骰值/攻速、命中、裝備、MR穿透、剋制、幻覺光環及精靈王15%全體技。
    if((sm.skId === 'sk_elf_summon' || sm.skId === 'sk_elf_summon2') && typeof spiritAttackOnce === 'function') {
        let _st = getTarget(); if(!_st) return;
        sm.form = sm.form || sm.n || '屬性精靈';
        sm._king = sm.skId === 'sk_elf_summon2' && owner.mastery === 'e_spirit';
        spiritAttackOnce(sm, _st, owner);
        return;
    }
    let t = getTarget(); if(!t) return;
    let cha = (owner.d && owner.d.cha) || 0;
    let _sgb = (typeof summonGearBonus === 'function') ? summonGearBonus(owner) : { dmg: 0, hit: 0 };   // 🏺 喚獸師的訓練鞭：召喚物額外傷害/命中（掃 owner 裝備欄）
    let _teamAtk = (typeof teamIlluAura === 'function') ? teamIlluAura(sm, true) : null;   // 👑 灼熱武器／幻覺攻擊光環：舊式迷魅與抽象召喚也取得全隊一般攻擊加成
    let idx = mapState.mobs.findIndex(m => m && m.uid === t.uid);

    // === 迷魅術：被迷魅怪物（單次攻擊，額外獲得 =魅力 的命中與傷害）===
    if(sm.skId === 'sk_charm') {
        let hv = Math.max(1, Math.min(20, owner.lv + sm.hitBonus + cha - t.lv + mobEffAC(t) + _sgb.hit + (_teamAtk ? _teamAtk.eh : 0)));   // 🏺 喚獸師鞭＋👑灼熱武器／幻覺光環命中（🚫 召喚控制戒指命中+5 已移除）
        let r = roll(1, 20);
        if(!((r === 20) || (r !== 1 && hv >= r))) { if (typeof vfxMiss === 'function') vfxMiss(t); logCombat(`${sm.n} 的攻擊未命中。`, 'miss'); return; }
        let dmg = Math.max(1, roll(sm.dmgDice[0], sm.dmgDice[1]) + cha + _sgb.dmg + (_teamAtk ? _teamAtk.ed : 0) - (t.dr || 0));
        markBossPhysicalHit(t);
        t.justHit = 'normal'; t.curHp -= dmg; mobWake(t);
        logCombat(`<span class="text-purple-300">${sm.n}</span> 攻擊 <span class="${getMobColor(t.lv)}">${t.n}</span>，造成 ${dmg} 點傷害。`, 'player');
        if(t.curHp <= 0 && idx !== -1) killMob(idx); else renderMobs();
        return;
    }

    // 魅力每 20 點增加一段完整攻擊（最多4段）；精靈精通同樣以4隻為上限。
    // 命中另取得等級/魅力成長並走柔性地板，避免中後期怪物AC使召喚物長期只剩5%命中。
    let hits = summonAttackCount(sm, owner);
    for(let i = 0; i < hits; i++) {
        if(t.curHp <= 0) break;
        let hv = summonHitValue(sm, owner, t, _sgb.hit + (_teamAtk ? _teamAtk.eh : 0));
        let r = roll(1, 20);
        if(!((r === 20) || (r !== 1 && hv >= r))) { if (typeof vfxMiss === 'function') vfxMiss(t); logCombat(`${sm.n} 的攻擊未命中。`, 'miss'); continue; }   // 🚫 v3.2.19 戒指「骰19視為命中」已移除
        let dmg;
        if(sm.kind === 'ranged') {
            let flat = Math.floor(cha * owner.lv / (sm.elemScale || 20));   // 屬性精靈：魅力 x (等級/scale)
            let mrPen = (sm.mrPenBase || 0) + Math.floor(cha / 10);
            dmg = summonElementDamage(sm.dmgDice, sm.ele, t, flat + _sgb.dmg + (_teamAtk ? _teamAtk.royalEd || 0 : 0), summonDamageMult(sm, owner, true), mrPen);
            t.justHit = sm.ele !== 'none' ? sm.ele : 'magic';
        } else {
            let flatBase = cha / (sm.dmgDiv || 5);
            let flat = sm.dmgLvDiv ? Math.floor(flatBase * (1 + owner.lv / sm.dmgLvDiv)) : Math.floor(flatBase);   // 造屍術等具 dmgLvDiv：再乘上 (1+召喚者等級/dmgLvDiv)
            let hardSkin = Math.floor(mobHardSkin(t) * (1 - (sm.hardSkinPen || 0)));
            let raw = (roll(sm.dmgDice[0], sm.dmgDice[1]) + flat + _sgb.dmg + (_teamAtk ? _teamAtk.ed : 0)) * summonDamageMult(sm, owner, false);
            dmg = Math.max(1, Math.floor(raw) - (t.dr || 0) - hardSkin);
            t.justHit = 'normal';
            markBossPhysicalHit(t);
        }
        t.curHp -= dmg; mobWake(t);
        logCombat(`<span class="text-purple-300">${sm.n}</span> 攻擊 <span class="${getMobColor(t.lv)}">${t.n}</span>，造成 ${dmg} 點傷害。`, 'player');
    }
    if(t.curHp <= 0 && idx !== -1) killMob(idx);
    else renderMobs();
}
function summonTick(sm, clearFn, owner) {
    owner = owner || player;   // 🩸 v2.6.25 owner 參數化（傭兵召喚共用）
    if(!sm) return;
    if(state.ticks >= sm.endTick || (sm.skId && ((owner.buffs && owner.buffs[sm.skId]) || 0) <= 0)) {
        logCombat(`<span class="text-purple-300">${sm.n}</span> 消失了。`, 'magic');
        clearFn(); return;
    }
    if(--sm.cd <= 0) { sm.cd = sm.interval; summonAttack(sm, owner); }
    // 高階召喚物技能固定間隔施放；召喚精通使間隔縮短15%。
    if(sm.proc) {
        let procCd = Math.max(1, Math.floor(sm.proc.cd * (isMageSummonMastered(sm, owner) ? 0.85 : 1)));
        if(sm.proc.cdCur > procCd) sm.proc.cdCur = procCd;   // 已召喚後才選精通時，剩餘冷卻立即套用縮短效果
        if(--sm.proc.cdCur <= 0) {
            sm.proc.cdCur = procCd;
            let t = getTarget();
            if(t && Math.random() < sm.proc.p) {
                let cha = (owner.d && owner.d.cha) || 0;
                let procFlat = cha + Math.floor((owner.lv || 1) / 2);
                let pd;
                if(sm.proc.ele && sm.proc.ele !== 'none') {
                    let mrPen = (sm.mrPenBase || 0) + Math.floor(cha / 10);
                    pd = summonElementDamage(sm.proc.dmgDice, sm.proc.ele, t, procFlat, summonDamageMult(sm, owner, true), mrPen);
                } else {
                    let hardSkin = Math.floor(mobHardSkin(t) * (1 - (sm.hardSkinPen || 0)));
                    let raw = (roll(sm.proc.dmgDice[0], sm.proc.dmgDice[1]) + procFlat) * summonDamageMult(sm, owner, false);
                    pd = Math.max(1, Math.floor(raw) - (t.dr || 0) - hardSkin);
                }
                t.curHp -= pd; t.justHit = sm.proc.ele !== 'none' ? sm.proc.ele : 'magic';
                logCombat(`${sm.n} 發動 ${sm.proc.name}，額外造成 ${pd} 點傷害。`, 'magic');
                let idx = mapState.mobs.findIndex(m => m && m.uid === t.uid);
                if(t.curHp <= 0 && idx !== -1) killMob(idx); else renderMobs();
            }
        }
    }
}

// 🔮 幻術士 立方（持續期間的週期性效果）：每 cube.iv ticks 觸發一次（dmg=全體傷害 / slow=全體緩速 / mrdown=目標魔抗下降 / mp=恢復MP）
// 🔮 幻覺3/5：輔助技能(buff/heal/轉換/淨化等·非直接攻擊) MP 消耗 -50%
const _SUPPORT_SKILL_TYPES = ['buff','self_buff','self_haste','heal','self_heal','heal_allies','convert','pray','bless','call_ally','dispel'];
function isSupportSkill(sk){ return !!sk && _SUPPORT_SKILL_TYPES.indexOf(sk.type) >= 0; }
let _lastHealFxTarget = null;   // 🩹 最近一次治癒魔法的實際受益者（供 castSkill 把治癒特效疊在其身上·非施法者）
function cubeTick() {
    if (player.dead || !state.running || !player.skills) return;
    player._cubeCd = player._cubeCd || {};
    player.skills.forEach(sid => {
        let sk = DB.skills[sid];
        if (!sk || !sk.cube || (player.buffs[sid] || 0) <= 0) return;
        if ((player._cubeCd[sid] = (player._cubeCd[sid] || sk.cube.iv) - 1) > 0) return;
        player._cubeCd[sid] = sk.cube.iv;
        let c = sk.cube;
        if (c.kind === 'mp') { player.mp = Math.min(player.mmp, (player.mp || 0) + (c.val || 5)); return; }   // 純回MP立方（保留·目前無技能使用）
        if (c.kind === 'dmgmp') {   // 🔮 立方：和諧 → 對「當前目標」單體屬性傷害 ＋ 回全隊MP（每觸發一次；回MP不需目標）
            teamRecoverMp(c.val || 5);   // 🔮 v2.6.4：回全隊 MP（玩家＋全體非倒地傭兵）
            let t = getTarget();
            if (t && t.curHp > 0 && !t._dead) {
                let d = Math.max(1, Math.floor(summonElementDamage(c.dice, c.ele || 'none', t, player.d.magicDmg || 0, magicDamageCoef(player.d, magicAttrDefense(t, c.ele || 'none'), sk.tier)) * illuLvMult(player) * wpnEnFinalMult(player.eq && player.eq.wpn)));   // 🔮 立方：SP／屬性防禦公式 ×(1+專屬法術階級/10)
                d = illusionMagicDmg(d, true);   // 🔮 幻覺2/5回MP＋5/5二次傷害（比照立方dmg）
                t.curHp -= d; t.justHit = (c.ele && c.ele !== 'none') ? c.ele : 'magic'; mobWake(t);
                logCombat(`<span class="font-bold" style="color:#fb923c;text-shadow:0 0 6px #ea580c;">【${sk.n}】</span>對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${d} 點傷害。`, 'dot', 'player');   // 🟢 立方傷害＝DoT(綠)、玩家來源
                if (t.curHp <= 0) { let i = mapState.mobs.findIndex(x => x && x.uid === t.uid); if (i !== -1) killMob(i); }
                renderMobs();
            }
            return;
        }
        let live = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
        if (!live.length) return;
        if (c.kind === 'dmg') {
            let txt = [];
            live.forEach((m, i) => { let d = Math.max(1, Math.floor(summonElementDamage(c.dice, c.ele || 'none', m, player.d.magicDmg || 0, magicDamageCoef(player.d, magicAttrDefense(m, c.ele || 'none'), sk.tier)) * illuLvMult(player) * wpnEnFinalMult(player.eq && player.eq.wpn))); d = illusionMagicDmg(d, true, i === 0); m.curHp -= d; m.justHit = (c.ele && c.ele !== 'none') ? c.ele : 'magic'; mobWake(m); txt.push(d); });   // 🔮 全體立方每次發動只回一次MP，5件仍逐目標生效
            logCombat(`<span class="font-bold" style="color:#fb923c;text-shadow:0 0 6px #ea580c;">【${sk.n}】</span>對全體造成 ${txt.join('、')} 點傷害。`, 'dot', 'player');   // 🟢 立方傷害＝持續傷害(DoT)→綠色 dot 分類＋玩家來源(src 顯式'player'蓋過 cubeTick 所處的 _combatSrc='summon')
            live.forEach(m => { if (m.curHp <= 0) { let i = mapState.mobs.findIndex(x => x && x.uid === m.uid); if (i !== -1) killMob(i); } });
            renderMobs();
        } else if (c.kind === 'slow') {
            live.forEach(m => applyMobStatus(m, { kind: 'slow', pbase: 150, dur: 4 }, sk.n));
        } else if (c.kind === 'mrdown') {
            let t = getTarget(); if (t && t.curHp > 0) applyMobStatus(t, { kind: 'mrhalf', pbase: 200, dur: c.dur || 4 }, sk.n);   // 以魔抗減半近似 MR 大幅下降
        }
    });
}
// 🔮 幻術精通（i_illusion）：持有 幻覺：歐吉/巫妖/鑽石高崙 增益時，產生對應幻象一同攻擊
//   歐吉：每2秒 3D20+(智力/5)×(1+等級/10) 近戰，命中=等級+10-怪等+智力+怪AC；巫妖：每3秒 同骰魔法必中受MR；鑽石高崙：每1秒 2D20+(智力/5)×(1+等級/5) 近戰，命中+20，10%冰矛圍籬
function illuSummonTick(owner) {
    owner = owner || player;   // 🩸 v2.6.26 owner 參數化：owner=player 或 i_illusion 傭兵(ally)
    if ((owner === player ? player.dead : owner._downed) || !state.running || owner.mastery !== 'i_illusion') return;
    const MAP = {
        sk_illu_ogre:  { iv: 20, dice: [3, 20], div: 10, kind: 'melee', hitOff: 10, n: '歐吉' },
        sk_illu_lich:  { iv: 30, dice: [3, 20], div: 10, kind: 'magic', n: '巫妖' },
        sk_illu_golem: { iv: 10, dice: [2, 20], div: 5,  kind: 'melee', hitOff: 20, n: '鑽石高崙', iceLance: true }
    };
    owner._illuCd = owner._illuCd || {};
    let d = owner.d || {};
    for (let sid in MAP) {
        // 🔮 v3.2.2 玩家與傭兵統一：需該幻覺 buff 生效才召幻象（原傭兵「學過即召」＝隊伍面板關掉也照打·開關名不符實）。
        //    傭兵現可於隊伍面板勾選自動維持幻覺（_isMercSelfBuff 已放行 illuSummon）；未勾＝無 buff＝不召幻象、也不提供光環。
        let _active = (owner.buffs && (owner.buffs[sid] || 0) > 0);
        if (!_active) { owner._illuCd[sid] = 0; continue; }
        let c = MAP[sid];
        if ((owner._illuCd[sid] = (owner._illuCd[sid] || c.iv) - 1) > 0) continue;
        owner._illuCd[sid] = c.iv;
        let t = getTarget(); if (!t || t.curHp <= 0) continue;
        let baseRoll = roll(c.dice[0], c.dice[1]) + Math.floor((d.int || 0) / 5) * (1 + owner.lv / c.div);
        let _illuTier = (DB.skills[sid] && DB.skills[sid].tier) || 0;
        let base = magicBaseDamage(baseRoll, d, 0, true) * magicDamageCoef(d, magicAttrDefense(t, c.ele || 'none'), _illuTier);   // 🔮 幻象：SP／屬性防禦公式 ×(1+幻術專屬法術階級/10)
        let dmg;
        if (c.kind === 'magic') {
            let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr; if (t.st && (t.st.confuse > 0 || t.st.panic > 0)) effMr -= 10;
            dmg = Math.max(1, Math.floor(base * mrMult(Math.max(0, effMr))));   // 巫妖：必中、受MR
        } else {
            let hv = Math.max(1, Math.min(20, owner.lv + c.hitOff - t.lv + (d.int || 0) + mobEffAC(t)));
            let r = roll(1, 20);
            if (!(r === 20 || (r !== 1 && hv >= r))) { if (typeof vfxMiss === 'function') vfxMiss(t); logCombat(`<span class="text-purple-300 font-bold">【幻覺：${c.n}】</span> 的攻擊未命中。`, 'miss', 'summon'); continue; }
            dmg = Math.max(1, Math.floor(base) - (t.dr || 0));
        }
        dmg = Math.max(1, Math.floor(dmg * fragileMult(t) * illuLvMult(owner)));   // 🔮 幻覺召喚物：幻術士等級加成 ×(1+等級/50)
        t.curHp -= dmg; t.justHit = (c.kind === 'magic') ? 'magic' : 'none'; mobWake(t);
        logCombat(`<span class="text-purple-300 font-bold">【幻覺：${c.n}】</span>對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dmg} 點傷害。`, 'magic', 'summon');
        let idx = mapState.mobs.findIndex(m => m && m.uid === t.uid);
        if (t.curHp <= 0) { if (idx !== -1) killMob(idx); continue; }
        if (c.iceLance && Math.random() < 0.10) { if (owner === player) { if (typeof witchIceLance === 'function') witchIceLance(); } else if (typeof allyWitchIceLance === 'function') { allyWitchIceLance(owner); } }   // 鑽石高崙：10% 冰矛圍籬（傭兵走 allyWitchIceLance）
        renderMobs();
    }
}
// ---------- 手動施放技能 ----------
function manualCast(skId) {
    let sk = DB.skills[skId];
    if(!sk || !player.skills.includes(skId)) return;
    if(inAbsBarrier()) { logSys('絕對屏障期間與世界隔絕，無法行動。'); return; }   // 🛡️ 屏障中不得手動施放任何技能（含本技能再施放）
    if(player.statuses && (player.statuses.silence > 0 || player.statuses.magicseal > 0)) { logSys('你被沉默／魔法封印，無法施放魔法。'); return; }   // 🤐 v3.1.77 稽核中#10：手動施放補沉默/魔法封印閘（castSkillInner 有、原手動沒有→沉默中可傳送逃脫）
    if(sk.reqJustice && typeof pvpIsJustice === 'function' && !pvpIsJustice()) { logSys(`<span class="text-sky-300">${sk.n} 需要正義性向（性向值 ≥ 1000）才能施放。</span>`); return; }   // 💙 v3.5.75 究極光裂術：限正義性向
    // 傳送術：行動限制狀態（石化／麻痺／冰凍／暈眩）無法手動施放
    if(sk.mEff === 'teleport' && player.statuses &&
       (player.statuses.stone > 0 || player.statuses.paralyze > 0 || player.statuses.freeze > 0 || player.statuses.stun > 0 || player.statuses.sleep > 0)) {
        logSys('你目前無法行動（石化／麻痺／冰凍／暈眩），無法使用傳送術。');
        return;
    }
    let __granted = player.grantedSkills && player.grantedSkills.includes(skId);
    let needLv = skillReqLv(sk, skId);   // 🏅 集中化：含魔導精通特例
    if(!__granted && needLv === undefined) { logSys('你的職業無法使用此技能。'); return; }
    if(!__granted && player.lv < needLv) { logSys('等級不足，無法使用此技能。'); return; }
    if((player.manualCd[skId] || 0) > 0) { logSys('技能冷卻中。'); return; }
    let cost = sk.mp ? player.d.getMpCost(sk.mp, sk.tier) : 0;
    if (player._setIllusion3 && isSupportSkill(sk)) cost = Math.max(1, Math.ceil(cost / 2));   // 🔮 幻覺3/5：輔助技能 MP 消耗 -50%
    if (cost > 0 && player.cls === 'elf' && hasMastery('e_magic') && sk.ele && sk.ele !== 'none' && sk.ele === player.elfEle) cost = Math.max(1, Math.ceil(cost * 0.5));   // 🏅 魔導精通：同屬性魔法消耗MP -50%(2026-07 30%→50%)
    if ((sk.n === '加速術' || sk.n === '強力加速術') && playerHasWindHelm()) cost = 0;   // 🏝️ 風之頭盔：加速術/強力加速術免MP（裝備或放在背包皆可）
    if (sk.n === '寒冰氣息' && player.eq && player.eq.wpn && DB.items[player.eq.wpn.id] && DB.items[player.eq.wpn.id].freeChill) cost = 0;   // ❄️ 殘冰的死亡氣息：施放寒冰氣息不消耗 MP
    if(player.mp < cost) { logSys('MP 不足。'); return; }
    if(sk.hpCost && player.hp <= sk.hpCost) { logSys('HP 不足。'); return; }

    let _mpBeforeManual = player.mp;   // 🔮 魔力精通：手動施法亦回饋傭兵（manualCast 不經 castSkill 包裝，故此處自行依差額回饋）
    let t = getTarget();
    if(sk.mEff === 'teleport') {
        if(KING_ROOMS[mapState.current]) { logSys('<span class="text-red-400">軍王之室的封印之力壓制了傳送術，無法生效。</span>'); return; }
        if(prideTeleportBlocked()) { logSys('<span class="text-red-400">' + (state.riftRun ? '時空裂痕中無法使用傳送術。' : (state.prideRanked ? '排名挑戰中無法使用傳送術。' : '在此樓層需持有對應的傲慢之塔支配符才能使用傳送術。')) + '</span>'); return; }
        if(state.oblivion) { logSys('<span class="text-red-400">遺忘之島的迷霧壓制了傳送術，無法生效。</span>'); return; }
        // 🌀 v3.0.102 傳送術特效＋玩家 sprite 暫隱已移入 doTeleport / enterHiddenArea（涵蓋技能與瞬移卷軸所有路徑）
        if (HIDDEN_AREA_PARENT[mapState.current]) {   // 🏛️ 對應地圖手動施放傳送術→進入隱藏狩獵區域（MP 已扣、冷卻照走）
            enterHiddenArea(HIDDEN_AREA_PARENT[mapState.current]);
        } else {
            let forceBoss = hasTeleportRing();
            doTeleport(forceBoss);
            logCombat(`你使用了傳送術，當前的怪物消失了${forceBoss ? '；傳送控制戒指引動了強敵的氣息……' : ''}。`, 'magic');
        }
    } else if(sk.mEff === 'sense') {
        if(!t) { logSys('沒有目標可以偵測。'); return; }
        let weak = { fire:'water', water:'wind', wind:'earth', earth:'fire' }[t.e];
        let eName = { fire:'火', water:'水', wind:'風', earth:'地' }[weak];
        logCombat(eName ? `<span class="${getMobColor(t.lv)}">${t.n}</span> 弱點是 ${eName}屬性。`
                        : `<span class="${getMobColor(t.lv)}">${t.n}</span> 沒有明顯的屬性弱點。`, 'magic');
        if(typeof playSpellFx === 'function') { try { playSpellFx(sk.n, t); } catch(e){} }   // 🔮 v2.7.44 能量感測：依目標屬性(t.e)播對應變體動畫(byEle·無屬性怪引擎靜默略過)
    // 🔧 魔力奪取已改為轉換技能（type:'convert', drain:true），改由 castSkill 的 convert 分支處理：
    //    命中判定改用 abnormalMagicHit（與迷魅術一致，吃魔法命中/怪MR/等級差），吸取量＝怪物等級/2
    } else if(sk.mEff === 'charm') {
        if(!t) { logSys('沒有目標。'); return; }
        if(t.boss) { logSys('無法魅惑 BOSS。'); return; }
        player.mp -= cost; cost = 0;
        // 🏅 召喚精通：對等級比自己低的非 BOSS 怪物，迷魅必定成功；否則一般迷魅成功率最高 60%（cap=12）
        if(!t.noCharm && ((hasMastery('m_summon') && !t.boss && (t.lv || 1) < player.lv) || abnormalMagicHit(t, 12))) {   // 🔧 不可迷魅(noCharm)標籤：帶此旗標的非頭目怪物迷魅必定失敗（覆蓋召喚精通的必定成功）
            let idx = mapState.mobs.findIndex(m => m && m.uid === t.uid);
            player.buffs['sk_charm'] = 3600;
            player.charmed = {
                skId:'sk_charm', n:'迷魅：' + t.n, dmgDice: t.dmg && t.dmg[1] ? t.dmg : [1,4],
                interval: Math.max(10, Math.floor((t.atkSpd || 2) * 10)), ele:'none', kind:'melee',
                hitBonus:(t.hit||0), proc:null, cd:10, endTick: state.ticks + 36000
            };
            logCombat(`<span class="${getMobColor(t.lv)}">${t.n}</span> 成為你的僕人。`, 'magic');
            if(typeof playSpellFx === 'function') { try { playSpellFx(sk.n, t); } catch(e){} }   // 🔮 迷魅術特效疊在目標身上（於移除前·否則卡片消失無法錨定）
            if(idx !== -1) { mapState.mobs[idx] = null; renderMobs(); }
        } else logCombat('迷魅術失敗了。', 'miss');
    } else if(sk.mEff === 'barrier') {
        // 🛡️ 絕對屏障：施放後進入隔絕狀態（持續 sk.dur 秒；無敵且無法行動）
        player.buffs.sk_abs_barrier = sk.dur;
        logCombat(`<span class="font-bold" style="color:#7dd3fc;text-shadow:0 0 8px #38bdf8;">${sk.msg || '你感覺身體與這個世界隔絕了。'}</span>`, 'magic');
        if(typeof playSelfFx === 'function') { try { playSelfFx(sk.n); } catch(e){} }   // 🛡️ 絕對屏障特效疊在玩家頭上（手動技·不經 castSkill 的 isSupportSkill 掛點）
    }
    player.mp -= cost;
    if (player.mastery === 'i_mana' && player.mp < _mpBeforeManual) manaMasteryRefund(_mpBeforeManual - player.mp);   // 🔮 魔力精通：手動施法消耗MP→傭兵回饋10%
    player.manualCd[skId] = (sk.mEff === 'barrier') ? (sk.dur * 10 + 120) : getAutoCastInterval(player, isSupportSkill(sk), player.manualCd[skId]);   // 🛡️ 絕對屏障保留專屬長冷卻；其餘手動施法套用攻擊／輔助施法速度
    calcStats(); updateUI();
}

function rollDice(count, sides) { let s = 0; for(let i = 0; i < count; i++) s += roll(1, sides); return s; }
// 🔮 castSkill 包裝：魔力精通時，依本次施法實際消耗的 MP，回饋傭兵 10%（以 MP 差額判定，涵蓋所有施法分支；轉換類增MP不觸發）
let _reqWpnWarnAt = -9999;   // 🛡️ v2.6.69 審計#15：reqWpn 不符提示節流（每 60 秒最多一次）
let _costItemWarnAt = -9999;   // 🌀 costItem 施法材料不足提示節流（每 60 秒最多一次）
function castSkill(skId) {
    let r;
    if (!(player && player.mastery === 'i_mana')) { r = castSkillInner(skId); }
    else {
        let _before = player.mp;
        r = castSkillInner(skId);
        if (player.mp < _before) manaMasteryRefund(_before - player.mp);
    }
    if (r) { try { playSpellCast(DB.skills[skId] ? DB.skills[skId].n : null); } catch(e){} }   // 🔊 音效：施法成功才出聲（依技能名對應專屬施展音，查無→通用魔法音）
    if (r && typeof playSelfFx === 'function' && DB.skills[skId] && isSupportSkill(DB.skills[skId])) {   // 🙏 v2.7.48 自我增益特效：buff→玩家頭上(overHead)·heal→被治療目標身上（未註冊靜默略過）
        try {
            let _sk = DB.skills[skId];
            let _anchor = (_sk.type === 'heal' && typeof _partyMemberRect === 'function') ? _partyMemberRect(_lastHealFxTarget || player) : null;   // 🩹 治癒特效疊在實際受益者身上；其餘 buff 走 playSelfFx 內 overHead（玩家頭上）
            playSelfFx(_sk.n, _anchor);
        } catch(e){}
    }
    return r;
}
// 👑 魔法精通：免費額外施放「目前設定的攻擊技能」（_royalFreeCast → 不耗MP、不受攻擊冷卻；castSkill 內部仍會驗證等級/目標/MP，可施放才施放）
function royalMagicFreeCast() {
    let _sel = (typeof document !== 'undefined') ? document.getElementById('sel-atk-skill') : null;
    let _id = _sel ? _sel.value : '';
    if (!_id || !DB.skills[_id]) return;
    _royalFreeCast = true;
    // 👑 v3.5.94 攻擊技冷卻快照還原：免費追加施放是「額外的一次」，不得吃掉已累積的冷卻進度。
    //    原本只在物理／魔法兩條分支加 `if (!_royalFreeCast)` 守衛，但 _royalFreeCast 能繞過 atkSk 閘門進場，
    //    該區塊內共有 7 處 `player.cds.atkSk = getAutoCastInterval(...)`——屠宰者／咆哮／呼喚盟友／固定狀態／
    //    武器傷害五條分支都沒守衛，其中「呼喚盟友」(sk_royal_callally) 是王族自己的 Lv30 攻擊技＝可實際觸發的活路徑。
    //    改成在這裡快照還原：一次覆蓋所有分支，日後新增 atk 分支也不會再漏改。
    //    （655／727 兩處的守衛保留：不寫入優於寫了再還原，且具自我說明作用。）
    let _cdSnap = (player.cds && player.cds.atkSk !== undefined) ? player.cds.atkSk : undefined;
    try { castSkill(_id); } finally {
        _royalFreeCast = false;
        if (_cdSnap !== undefined && player.cds) player.cds.atkSk = _cdSnap;
    }
}
let _silenceLogAt = 0;   // ⏱️ 沉默／魔法封印提示節流：自動施法每 tick 會重試→原本每 tick 洗一次頻。共用時間戳，最多每 1 秒顯示 1 次。
function _logSilenceOnce(msg){ let now = (typeof Date !== 'undefined') ? Date.now() : 0; if(now - _silenceLogAt < 1000) return; _silenceLogAt = now; logSys(msg); }
// 🏺 遺物 烈焰巫師的正式長袍：裝備者已學會「燃燒的火球」時，其化為「爆裂的火球」。回傳實際要施放的 skId。
function _fireballMorphId(skId) {
    if (skId !== 'sk_fireball') return skId;
    let a = player.eq && player.eq.armor;
    if (a && DB.items[a.id] && DB.items[a.id].fireballBurst && player.skills && player.skills.includes('sk_fireball')) return 'sk_fireball_burst';
    return skId;
}
function applyMoveDashBuffMutex(owner, sid) {
    if (!owner || !owner.buffs || (sid !== 'sk_holy_dash' && sid !== 'sk_elf_winddash')) return;
    owner.buffs[sid === 'sk_holy_dash' ? 'sk_elf_winddash' : 'sk_holy_dash'] = 0;
}

function castSkillInner(skId) {
    skId = _fireballMorphId(skId);   // 🏺 烈焰巫師的正式長袍：燃燒的火球→爆裂的火球
    let sk = DB.skills[skId];
    if(!sk) return false;
    if(inAbsBarrier()) return false;   // 🛡️ 絕對屏障：無法施法（自動/手動皆擋）
    if(skId === 'sk_sunlight' && KING_ROOMS[mapState.current]) { logSys('<span class="text-red-400">此區域中，日光術無法生效。</span>'); return false; }   // 🔧 軍王之室／底比斯祭壇：日光術無效
    if(skId === 'sk_magic_shield' && (player.magicShieldCd || 0) > 0) return false;   // 魔法屏障抵擋技能後冷卻中，無法施放
    if(sk.reqJustice && typeof pvpIsJustice === 'function' && !pvpIsJustice()) {   // 💙 v3.5.75 究極光裂術：限正義性向（性向值 ≥ 1000）·自動施放節流提示防洗頻
        _logSilenceOnce(`<span class="text-sky-300">${sk.n} 需要正義性向才能施放。</span>`);
        return false;
    }

    if(player.statuses.silence > 0) {   // 🔧 沉默：所有魔法皆無法施放（含魔法相消術——只有沉默/魔法封印能擋下相消術）
        _logSilenceOnce(`沉默狀態中，無法施展魔法。`);   // ⏱️ 節流：最多每秒 1 次，避免自動施法洗頻
        return false;
    }
    if(player.statuses.magicseal > 0) {   // 🔧 魔法封印（怪物技能「沉默」所施加）：同上，魔法相消術亦遭封印
        _logSilenceOnce(`魔法封印狀態中，無法施展技能。`);   // ⏱️ 節流：共用沉默時間戳
        return false;
    }
    
    let __granted = player.grantedSkills && player.grantedSkills.includes(skId);
    let needLv = skillReqLv(sk, skId);   // 🏅 集中化：含魔導精通特例
    if(!__granted && (needLv === undefined || player.lv < needLv)) return false;
    if(!__granted && sk.reqEle && player.elfEle !== sk.reqEle) return false;      // 屬性不符
    if(!__granted && sk.reqEleAny && !player.elfEle) return false;                 // 尚未選擇屬性

    // 🔧 黑暗妖精：會心一擊（消耗 HP 50% + 剩餘所有 MP；傷害 = 重擊一般攻擊(無視硬皮)×爆擊×(消耗MP佔上限%×10)；對血盟 x2）
    if (sk.darkCrit) {
        let _t = getTarget(); if (!_t || _t.curHp <= 0) return false;
        if (player.cds.atkSk > 0) return false;   // ⚔️ v3.1.77 稽核中#11：比照其他攻擊技吃攻擊技冷卻（原分支位於冷卻閘之前＝唯一不受冷卻的 atk 技）
        if ((player.mp || 0) <= 0) return false;   // 🩸 v3.1.77 稽核中#11：MP=0 時倍率為 0 → 燒半血只打 1 點且不觸發 castLock 可反覆自殘·必須有 MP 才施放
        if (player.hp <= player.mhp * 0.5) return false;   // HP 不足以負擔代價
        let mult = (player.mmp > 0 ? player.mp / player.mmp : 0) * 10;   // 100%MP→×10、50%→×5
        player.hp = Math.max(1, Math.floor(player.hp - player.mhp * 0.5));
        player.mp = 0;
        let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
        let dice = wpn ? (_t.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;
        let base = getPhysicalDmg(dice, _t, wpn, null, true, false, false, true);    // forceHeavy＋forceCrit：必中必重必爆（🛡️ v2.6.69 審計#6：爆擊改由 getPhysicalDmg 內部套用一次；原外層再乘(1+爆傷%)＝自然爆擊時重複乘算變 ×4）
        let raw = (base.dmg || 1) + mobHardSkin(_t);                     // 無視硬皮：加回硬皮扣減量
        let dmg = Math.max(1, Math.floor(raw * mult));   // MP 佔比倍率（必定爆擊已含於 base.dmg）
        if (_t.race === '血盟') dmg *= 2;                                 // 對血盟敵人 x2
        _t.curHp -= dmg; _t.justHit = getWpnEle(player.eq.wpn, wpn); mobWake(_t);
        if (typeof reflectWallOnDamage === 'function') reflectWallOnDamage(_t, dmg, (wpn && (wpn.isBow || wpn.ranged)) ? 'ranged' : 'melee', null);   // 🌑 v3.4.14 血壁空間：會心一擊＝技能直擊反射（玩家傭兵一致）
        if (player.dead) return true;   // ☠️ v3.5.87 反射可反殺施放者：死後中止收尾（不結算擊殺經驗/掉落·比照 js/04 playerAttack）
        logCombat(`<span class="font-bold" style="color:#f0abfc;text-shadow:0 0 8px #d946ef;">【會心一擊】</span>對 <span class="${getMobColor(_t.lv)}">${_t.n}</span> 造成 ${dmg} 點致命傷害！`, 'player-crit');
        let _i = mapState.mobs.findIndex(m => m && m.uid === _t.uid);
        if (_t.curHp <= 0) { if (_i !== -1) killMob(_i); } else renderMobs();
        player.cds.atkSk = getAutoCastInterval(player, false, player.cds.atkSk);   // ⚔️ v3.1.77 稽核中#11：施放後進入攻擊技冷卻（比照其他 atk 技）
        calcStats(); updateUI(); return true;
    }

    let cost = sk.mp ? player.d.getMpCost(sk.mp, sk.tier) : 0;
    if (player._setIllusion3 && isSupportSkill(sk)) cost = Math.max(1, Math.ceil(cost / 2));   // 🔮 幻覺3/5：輔助技能 MP 消耗 -50%
    if (cost > 0 && player.cls === 'elf' && hasMastery('e_magic') && sk.ele && sk.ele !== 'none' && sk.ele === player.elfEle) cost = Math.max(1, Math.ceil(cost * 0.5));   // 🏅 魔導精通：同屬性魔法消耗MP -50%(2026-07 30%→50%)
    if ((sk.n === '加速術' || sk.n === '強力加速術') && playerHasWindHelm()) cost = 0;   // 🏝️ 風之頭盔：加速術/強力加速術免MP（裝備或放在背包皆可）
    if (sk.n === '寒冰氣息' && player.eq && player.eq.wpn && DB.items[player.eq.wpn.id] && DB.items[player.eq.wpn.id].freeChill) cost = 0;   // ❄️ 殘冰的死亡氣息：施放寒冰氣息不消耗 MP
    if (_echoFree) cost = 0;   // 🏅 迴響精通：連發那次不消耗 MP
    if (_royalFreeCast) cost = 0;   // 👑 魔法精通：免費額外施放選定攻擊技
    if (sk.throwAxe && hasMastery('k_dualaxe')) cost = 0;   // ⚔️ 雙斧精通：戰斧投擲不消耗 MP
    if (sk.callAllies && hasMastery('k_royal_pledge')) cost = Math.ceil(cost / 2);   // 👑 血盟精通：呼喚盟友消耗 MP 減半
    if (_autoCastNow && sk.dmgType === 'magic' && cost > 0) { let _mm = _equipWpnField('autoCastMpMult'); if (_mm) cost = Math.round(cost * _mm); }   // 🐍 枯竭魔杖：自動施放傷害魔法 MP×autoCastMpMult(2)
    if(player.mp < cost) return false;
    if(sk.hpCost && player.hp <= sk.hpCost + 5) return false;  // HP 不足，拒絕施放
    if(sk.hpCost && sk.type !== 'convert') { let _hpSkEl = document.getElementById('set-hp-skill'); let _hpSkThr = _hpSkEl ? (parseFloat(_hpSkEl.value) || 0) : 0; if(_hpSkThr > 0 && (player.mhp || 0) > 0 && (player.hp / player.mhp * 100) < _hpSkThr) return false; }   // 🐉 消耗HP技能：HP 低於自訂門檻(%)時暫停自動施放（自動路徑專用；轉換魔法另有 set-hp-convert 門檻，故排除避免重複）
    if(sk.hpCost && sk.mp && sk.type !== 'convert') { let _mpSkEl = document.getElementById('set-mp-atk'); let _mpSkThr = _mpSkEl ? (parseFloat(_mpSkEl.value) || 0) : 0; if(_mpSkThr > 0 && (player.mmp || 0) > 0 && (player.mp / player.mmp * 100) < _mpSkThr) return false; }   // 🔧 同時消耗HP與MP的技能：MP 低於「攻擊技能MP門檻(set-mp-atk)」時亦暫停自動施放→與HP門檻(set-hp-skill)取「任一不符即停」（攻擊型本就在 autoCastSpells 先擋過此門檻，這裡再涵蓋增益型如覺醒/冥想/隱身/堅固防護）
    if(sk.costItem) {   // 🌀 施法材料：背包＋倉庫合併計量（比照製作系統），不足則不施放（提示 60 秒節流）
        let _ciQ = sk.costItem.qty || 1;
        if(typeof invCountId !== 'function' || invCountId(sk.costItem.id) < _ciQ) {
            if(state.ticks - _costItemWarnAt > 600) { _costItemWarnAt = state.ticks; logSys(`${(DB.items[sk.costItem.id] || {}).n || '施法材料'}不足，無法施放 ${sk.n}。`); }
            return false;
        }
    }

    if(sk.type === 'convert') {
        if((player.cds.convertSk || 0) > 0) return false;   // 🔄 轉換與攻擊／治癒使用相同施法間隔公式，但保留獨立欄位避免彼此餓死
        // 🔧 魔力奪取（drain）：消耗 HP，必須對怪物施展；以異常魔法命中（abnormalMagicHit，與迷魅術一致，
        //    吃魔法命中/怪物MR/等級差）判定，命中才吸取 MP＝怪物等級/2。其餘機制（自動施放條件、不佔冷卻）比照魂體轉換。
        if(sk.drain) {
            let _t = getTarget();
            if(!_t || _t.curHp <= 0) return false;   // 沒有目標：不施放、不耗 HP
            player.mp -= cost;
            player.hp = Math.max(1, player.hp - (sk.hpCost || 0));
            if(abnormalMagicHit(_t)) {
                let gain = roll(1, Math.max(1, Math.floor((_t.lv || 1) / 2)));   // 🔧 吸取量＝1D(怪物等級/2)
                player.mp = Math.min(player.mmp, player.mp + gain);
                logCombat(`施放 ${sk.n}，從 <span class="${getMobColor(_t.lv)}">${_t.n}</span> 吸取了 ${gain} 點魔力。`, 'heal');
            } else {
                logCombat(`${sk.n} 未能命中 <span class="${getMobColor(_t.lv)}">${_t.n}</span>。`, 'miss');
            }
            player.cds.convertSk = getAutoCastInterval(player, true, player.cds.convertSk);
            calcStats(); updateUI(); return true;
        }
        // 心靈轉換 / 魂體轉換（輔助類）：消耗 HP 換取 MP，不佔用攻擊/治癒冷卻
        player.mp -= cost;
        player.hp = Math.max(1, player.hp - (sk.hpCost || 0));
        player.mp = Math.min(player.mmp, player.mp + sk.mpGain);
        player.cds.convertSk = getAutoCastInterval(player, true, player.cds.convertSk);
        logCombat(`施放 ${sk.n}，消耗 ${sk.hpCost} HP，恢復了 ${sk.mpGain} 點 MP。`, 'heal');
        calcStats(); updateUI(); return true;
    }

    // 🔧 淨化類（解毒術/聖潔之光/魔法相消術）：改用獨立冷卻 purifySk，不再與治癒魔法共用 healSk
    //（先前掛體力回復術時 healSk 被鎖至 HoT 結束，最長 15 秒無法自動解毒；淨化施放也會反過來吃掉治癒冷卻、延後補血）
    if(sk.type === 'heal' && !sk.hot && !sk.valDice) {
        if((player.cds.purifySk || 0) > 0) return false;
        // 🆕 v2.6.28 淨化改「團隊清除」→ v2.6.29 改「一次只解一人·優先主要玩家」：施法者(玩家自己)受 石化/冰凍/暈眩/麻痺/沉睡/沉默/魔封 時無法使用；否則解隊列首位(玩家排首→傭兵)有可解狀態者一人。
        let _dk = (skId === 'sk_antidote') ? ['poison']
            : (skId === 'sk_holy_light') ? ['stone', 'paralyze']
            : (skId === 'sk_cancel') ? ['freeze', 'stone', 'poison', 'paralyze', 'burn', 'scald', 'weaken', 'disease', 'blind', 'potionFrost', 'foulWater'] : null;   // 🌅 審查修：魔法相消術可解日出之國四新異常；🌊 v3.6.20 含汙濁之水
        if(!_dk) { player.mp -= cost; player.cds.purifySk = getAutoCastInterval(player, true, player.cds.purifySk); logCombat(`施放 ${sk.n}。${sk.msg || ''}`, 'heal'); return true; }   // 非淨化 heal（保底·理論上無此類）
        if(dispelCasterBlocked(player.statuses)) return false;   // 🆕 自己硬控/沉默/魔封→無法使用
        let _tgt = teamCleanseOne(_dk);
        if (_tgt) _lastHealFxTarget = _tgt;   // ✨ 淨化類技能的治癒特效要錨在「實際被解狀態的對象」上；不設的話會沿用上一次被治癒的隊員（或 fallback 到玩家）   // 🆕 v2.6.29 一次只解一人·優先主要玩家
        if(!_tgt) return false;           // 隊伍(含自己)無對應可解狀態：不施放、不耗 MP
        player.mp -= cost;
        player.cds.purifySk = getAutoCastInterval(player, true, player.cds.purifySk);
        logCombat(`施放 ${sk.n}，解除了 ${_dispelTargetName(_tgt)} 的負面狀態。${sk.msg || ''}`, 'heal');
        return true;
    }

    let _healOwnCd = (player.cds.healSkillCds && player.cds.healSkillCds[skId]) || 0;
    if(sk.type === 'heal' && player.cds.healSk <= 0 && _healOwnCd <= 0) {
        // 體力回復術 / 生命的祝福：HoT 持續回復
        if(sk.hot) {
            if(player.hots && player.hots[skId] && player.hots[skId].ticksLeft > 0) return false;  // 🍃 該技能團隊 HoT 已在持續中→不重複(防自動施放洗版/耗MP)；不同技能(生命的祝福/體力回復術)可並存、同技能後放取代先放
            player.mp -= cost;
            applyTeamHot(skId, sk, player.d, player);   // 🍃 施放時全隊(玩家＋全體傭兵)持續回復；🏺 v3.1.80 傳施放者供團體治癒強化(groupHealMult)快照
            player.cds.healSk = getAutoCastInterval(player, true, player.cds.healSk);  // 🔧 HoT 不再把共用治癒冷卻鎖到結束：重複施放已由上方守衛擋住；長鎖會餓死其他自動治癒（高級治癒術/生命之泉等）
            logCombat(`施放 ${sk.n}，全隊開始持續回復 HP。`, 'heal');
            return true;
        }
        // 舊版方向瞬間治癒：基本骰數＋INT治癒加成，×2 為 classicHeal 基礎倍率（與正義值無關·正義加成由 justiceHeal 旗標在 rollHealingSpell 另乘）；不吃魔法傷害／SP／法術階級。
        // 團體治癒對每名存活成員獨立擲骰；生命之泉則直接恢復目標全部已損失HP。
        let _cands = (typeof healBeneficiaries === 'function') ? healBeneficiaries() : [player];
        if (!_cands.length) return false;
        let _hTgt = player, _hPct = Infinity;
        _cands.forEach(c => { let _mx = (typeof _supMhp === 'function') ? _supMhp(c) : (c.mhp || 1); if (_mx > 0) { let _p2 = ((typeof _supHp === 'function') ? _supHp(c) : (c === player ? player.hp : c.curHp) || 0) / _mx; if (_p2 < _hPct) { _hPct = _p2; _hTgt = c; } } });
        player.mp -= cost;
        _lastHealFxTarget = _hTgt;   // 🩹 記錄受益者→castSkill 把治癒特效疊在其身上（寵物/召喚物 _partyMemberRect 回 null→退預設錨點）
        player.cds.healSk = getAutoCastInterval(player, true, player.cds.healSk);
        if (sk.healCooldownTicks) { if (!player.cds.healSkillCds) player.cds.healSkillCds = {}; player.cds.healSkillCds[skId] = sk.healCooldownTicks; }
        if (sk.groupHeal) {
            let _total = 0, _hit = 0;
            _cands.forEach(c => {
                let _before = (typeof _supHp === 'function') ? _supHp(c) : (c === player ? player.hp : (c.curHp != null ? c.curHp : c.hp));
                let _heal = rollHealingSpell(sk, player.d, player, c);
                if (!sk.ignoreWaterVital) _heal = waterVitalHeal(_heal, c);
                if (typeof _supHeal === 'function') _supHeal(c, _heal); else if (c === player) player.hp = Math.min(player.mhp, player.hp + _heal); else if (c.curHp != null) c.curHp = Math.min(c.mhp, (c.curHp || 0) + _heal); else c.hp = Math.min(c.mhp, (c.hp || 0) + _heal);
                let _after = (typeof _supHp === 'function') ? _supHp(c) : (c === player ? player.hp : (c.curHp != null ? c.curHp : c.hp));
                _total += Math.max(0, _after - _before); _hit++;
            });
            logCombat(`施放 ${sk.n}，立即治癒全隊 ${_hit} 名成員，共恢復 ${_total} 點 HP。${sk.msg || ''}`, 'heal');
        } else {
            let heal = rollHealingSpell(sk, player.d, player, _hTgt);
            if (!sk.ignoreWaterVital) heal = waterVitalHeal(heal, _hTgt);   // 生命之泉本身已補滿，不消耗水之元氣
            let _before = (typeof _supHp === 'function') ? _supHp(_hTgt) : (_hTgt === player ? player.hp : (_hTgt.curHp != null ? _hTgt.curHp : _hTgt.hp));
            if (typeof _supHeal === 'function') _supHeal(_hTgt, heal); else if (_hTgt === player) player.hp = Math.min(player.mhp, player.hp + heal); else if (_hTgt.curHp != null) _hTgt.curHp = Math.min(_hTgt.mhp, (_hTgt.curHp || 0) + heal); else _hTgt.hp = Math.min(_hTgt.mhp, (_hTgt.hp || 0) + heal);
            let _after = (typeof _supHp === 'function') ? _supHp(_hTgt) : (_hTgt === player ? player.hp : (_hTgt.curHp != null ? _hTgt.curHp : _hTgt.hp));
            let _actual = Math.max(0, _after - _before);
            logCombat(`施放 ${sk.n}，恢復了${_hTgt === player ? '' : (' ' + ((typeof _supName === 'function') ? _supName(_hTgt) : ('協力·' + _hTgt._allyName)))} ${_actual} 點 HP。${sk.msg || ''}`, 'heal');
        }
        return true;
    }
    
    if(sk.type === 'atk' && (player.cds.atkSk <= 0 || _echoFree || _royalFreeCast)) {   // 🏅 迴響精通／👑 魔法精通：免費施放不受攻擊冷卻限制
        // 🐉 屠宰者：立即額外進行 3 次近距離一般攻擊；命中消耗目標弱點曝光（每層 +10 傷害）
        if (sk.slaughter) {
            let t = getTarget(); if (!t || t.curHp <= 0) return false;
            let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
            if (!wpn || wpn.isBow || wpn.ranged) return false;   // 需近距離武器
            player.mp -= cost; player.cds.atkSk = getAutoCastInterval(player, false, player.cds.atkSk);
            if (sk.hpCost) player.hp = Math.max(1, player.hp - effHpCost(sk));
            let layers = t.weakExpose || 0, bonus = layers > 0 ? 10 * layers : 0;
            let consume = layers > 0 && !hasMastery('k_weakness');   // 🏅 弱點精通：屠宰者不消耗弱點曝光
            let times = sk.hits || 3, total = 0, log = [], applied = false;
            for (let h = 0; h < times; h++) {
                if (t.curHp <= 0) break;
                let dice = t.s === 'L' ? wpn.dmgL : wpn.dmgS;
                let res = getPhysicalDmg(dice, t, wpn, null);
                if (!res.hit) { if (typeof vfxMiss === 'function') vfxMiss(t); log.push('Miss'); continue; }
                let dmg = res.dmg;
                if (bonus > 0) { dmg += bonus; applied = true; }   // 🐉 弱點曝光：成功觸發後，一次施放的三刀「每一擊命中」都吃 +10/層（不再僅首擊）
                dmg = Math.floor(dmg * weakExposeDmgMult(t));   // 🏅 鎖刃精通：每層弱點曝光最終傷害+10%
                if (sk.hpCost && player._setDragonblood5) dmg = Math.max(1, Math.floor(dmg * 1.2));   // 🐉 龍血5/5：HP消耗技傷害+20%（屠宰者＝物理HP消耗技·與魔法路徑 js/07 一致）
                t.curHp -= dmg; t.justHit = getWpnEle(player.eq.wpn, wpn); total += dmg; mobWake(t);
                if (typeof reflectWallOnDamage === 'function') reflectWallOnDamage(t, dmg, 'melee', null);   // 🌑 v3.4.14 血壁空間：屠宰者每擊＝近距離技能直擊反射（玩家傭兵一致）
                if (player.dead) { if (consume && applied) t.weakExpose = 0; return true; }   // ☠️ v3.5.87 反射反殺：死後中止後續斬擊與擊殺結算　⚡ v3.5.89 早退前補做弱點曝光消耗（否則玩家已吃到 +10/層加成、目標層數卻沒清）
                log.push(dmg + (res.heavy ? '(重)' : ''));
                if (t.curHp > 0) wearHardSkin(t, player.eq.wpn ? player.eq.wpn.id : null, res.heavy, false, true, player.classicMode);
            }
            if (consume && applied) t.weakExpose = 0;
            if (total > 0) { logCombat(`施放 <span style="font-weight:700;color:#7dd3fc">${sk.n}</span>，連續斬擊 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 [${log.join(', ')}] 共 ${total} 點傷害${bonus > 0 ? `（弱點曝光 每擊+${bonus}）` : ''}。`, 'skill'); if (t.curHp <= 0) killMob(mapState.targetIdx); else renderMobs(); }
            else logCombat(`施放 ${sk.n} 未命中 <span class="${getMobColor(t.lv)}">${t.n}</span>。`, 'miss');
            return true;
        }
        // ⚔️ 咆哮：對所有敵人造成 50+(等級-30) 的固定無屬性傷害（不計 MR / DR / 元素）
        if (sk.roarFixed) {
            let targets = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
            if (!targets.length) return false;
            if (player.mp < cost) return false;
            player.mp -= cost; player.cds.atkSk = getAutoCastInterval(player, false, player.cds.atkSk);
            if (sk.hpCost) player.hp = Math.max(1, player.hp - effHpCost(sk));
            let base = 50 + Math.max(0, (player.lv || 1) - 30);
            targets.forEach(m => { if (player.dead) return; if (!m || m.curHp <= 0 || m._dead) return; let dmg = Math.max(1, Math.floor(base * fragileMult(m))); m.curHp -= dmg; m.justHit = 'magic'; m._spellHurt = true; mobWake(m); if (typeof reflectWallOnDamage === 'function') reflectWallOnDamage(m, dmg, 'magic', null); });   // 🎬 v3.0.14 _spellHurt：法術傷害→hurt 動畫(含頭目)；🌑 v3.3.33 血壁空間魔法反射
            if (player.dead) return true;   // ☠️ v3.5.87 反射反殺：死後不結算擊殺
            logCombat(`施放 <span style="font-weight:700;color:#7dd3fc">${sk.n}</span>，咆哮震懾全場，對所有敵人造成約 ${base} 點固定傷害。`, 'skill');
            targets.forEach(m => { if (m && m.curHp <= 0 && !m._dead) { let i = mapState.mobs.findIndex(x => x && x.uid === m.uid); if (i !== -1) killMob(i); } });
            renderMobs();
            return true;
        }
        // 👑 呼喚盟友：所有上場傭兵立即各發動一次額外攻擊（需有目標與傭兵；消耗 MP30＋攻擊冷卻）
        if (sk.callAllies) {
            let t = getTarget(); if (!t || t.curHp <= 0) return false;
            let allies = (player.allies || []).filter(a => a && a.curHp > 0);
            if (!allies.length) return false;
            if (player.mp < cost) return false;
            player.mp -= cost; player.cds.atkSk = getAutoCastInterval(player, false, player.cds.atkSk);
            logCombat(`<span class="text-amber-300 font-bold">${sk.n}！</span>你號召盟友一同出擊。`, 'player');
            allies.forEach(a => { try { allyAttackOnce(a); } catch(e){} });
            return true;
        }
        // 🐉 控制系異常技（護衛毀滅/恐懼無助/驚悚死神）：固定機率施加自訂異常狀態（驚悚死神無視 MR，已以固定機率處理）
        if (sk.fixedStatus) {
            let t = getTarget(); if (!t || t.curHp <= 0) return false;
            let fs = sk.fixedStatus;
            if (sk.noRecastStatus && t.st && t.st[sk.noRecastStatus] > 0) return false;   // 已有狀態：不重複（不耗 HP/CD）
            player.mp -= cost; player.cds.atkSk = getAutoCastInterval(player, false, player.cds.atkSk);
            if (sk.hpCost) player.hp = Math.max(1, player.hp - effHpCost(sk));
            if (Math.random() < fs.chance) {
                if (!t.st) t.st = newMobStatus();
                t.st[fs.kind] = (fs.dur || 16) * 10;
                logCombat(`施放 ${sk.n}，<span class="${getMobColor(t.lv)}">${t.n}</span> 陷入了「${STATUS_NAME[fs.kind] || sk.n}」。`, 'magic');
                if (!state.ff) renderMobs();
            } else {
                logCombat(`施放 ${sk.n}，但未能影響 <span class="${getMobColor(t.lv)}">${t.n}</span>。`, 'miss');
            }
            return true;
        }
        // 🔮 幻術士自訂傷害攻擊：粉碎能量/骷髏毀壞（武器傷害＋強化值，不計武器特效）、心靈破壞（傷害＝消耗MP量＝最大MP5%）
        if (sk.weaponDmg || sk.mpDmgPct) {
            let t = getTarget(); if (!t) return false;
            if (sk.tagReq && !mobHasTag(t, sk.tagReq)) return false;   // 骷髏毀壞：只能對不死
            let spend = cost;
            if (sk.mpDmgPct) { spend = Math.max(1, Math.floor((player.mmp || 0) * sk.mpDmgPct)); if (player.mp < spend) return false; }
            player.mp -= spend; player.cds.atkSk = getAutoCastInterval(player, false, player.cds.atkSk);
            if (sk.instakill && tryInstakill(t, sk.instakill, sk.n, mapState.targetIdx)) return true;   // 🦴 骷髏毀壞：先即死判定（起死回生式·vs不死非BOSS）；成功即死、不再造成傷害
            let dmg;
            if (sk.weaponDmg) {
                let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
                let dice = wpn ? (t.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;
                let enB = (wpn && player.eq.wpn) ? enhanceWpnBonus(player.eq.wpn.en).dmg : 0;   // 強化值加成
                if (sk.magScale) {
                    // 🔮 粉碎能量：以武器骰作底傷，套原版方向 SP／屬性防禦係數；不計武器特效、必定命中、不受 DR／硬皮減免
                    let _rng = !!(wpn && (wpn.isBow || wpn.ranged));
                    let _dmgB = _rng ? (player.d.rangedDmg || 0) : (player.d.meleeDmg || 0);
                    let _base = roll(1, dice) + _dmgB + enB + (sk.weaponFlat || 0);
                    dmg = Math.max(1, Math.floor(magicBaseDamage(_base, player.d, 0, true) * magicDamageCoef(player.d, magicAttrDefense(t, getWpnEle(player.eq.wpn, wpn)), sk.tier))) + (sk.flatBonus || 0);   // 🦴 骷髏毀壞：統一魔法公式 ×(1+幻術專屬階級/10)＋固定傷害20
                } else {
                    dmg = Math.max(1, roll(1, dice) + (player.d.meleeDmg || 0) + enB + (sk.weaponFlat || 0) - (t.dr || 0) - mobHardSkin(t));
                }
            } else {
                dmg = spend;   // 心靈破壞：基礎傷害＝消耗 MP，套統一魔法公式與幻術士專屬階級，無屬性、受 MR
                let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr; if (t.st && (t.st.confuse > 0 || t.st.panic > 0)) effMr -= 10;
                dmg = Math.max(1, Math.floor(magicBaseDamage(dmg, player.d, 0, true) * magicDamageCoef(player.d, magicAttrDefense(t, 'none'), sk.tier) * mrMult(Math.max(0, effMr))));
            }
            dmg = Math.max(1, Math.floor(dmg * fragileMult(t) * illuLvMult(player) * wpnEnFinalMult(player.eq.wpn) * elementCounterMult(sk.weaponDmg ? getWpnEle(player.eq.wpn, player.eq.wpn ? DB.items[player.eq.wpn.id] : null) : 'none', t.e)));   // 🔮 幻術士等級加成 ×(1+等級/50)；🔧 武器強化 +11~+20 最終倍率；⚔️ 屬性剋制(僅武器傷害技吃武器屬性)
            t.curHp -= dmg; t.justHit = sk.weaponDmg ? getWpnEle(player.eq.wpn, player.eq.wpn ? DB.items[player.eq.wpn.id] : null) : 'magic'; if (!sk.weaponDmg) t._spellHurt = true; mobWake(t);   // 🎬 v3.0.14 純魔法技→hurt(含頭目)
            if (typeof reflectWallOnDamage === 'function' && t._reflectWall) { let _rwW = player.eq.wpn && DB.items[player.eq.wpn.id]; reflectWallOnDamage(t, dmg, sk.weaponDmg ? ((_rwW && (_rwW.isBow || _rwW.ranged)) ? 'ranged' : 'melee') : 'magic', null); }   // 🌑 v3.3.33 血壁空間：玩家技能傷害反射
            if (player.dead) return true;   // ☠️ v3.5.87 反射反殺：死後中止收尾（不結算擊殺）
            if (sk.mpDmgPct && t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;   // 🔧 心靈破壞（魔法）：受一次魔法傷害後解除魔抗減半（與其他魔法路徑一致）
            logCombat(`施放 <span style="font-weight:700;color:#7dd3fc">${sk.n}</span>，對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dmg} 點傷害。`, 'skill');
            if (t.curHp > 0 && sk.status) applyMobStatus(t, sk.status, sk.n, magicDamageCoef(player.d, 0));
            if (t.curHp <= 0) killMob(mapState.targetIdx); else renderMobs();
            return true;
        }
        if(sk.dmgType === 'physical') {
            let t = getTarget();
            if(!t) return false;
            if(sk.reqWpn === 'w2h' && (!player.eq.wpn || !DB.items[player.eq.wpn.id].w2h || DB.items[player.eq.wpn.id].isBow)) {   // 🛡️ v2.6.69 審計#4：「雙手且非弓」——維持雙手限定的同時保留舊版排除弓的設計（w2h 弓不得施放衝擊之暈）
                if (state.ticks - _reqWpnWarnAt > 600) { _reqWpnWarnAt = state.ticks; logSys(`<span class="text-slate-400">${sk.n} 需要「雙手（非弓）武器」，目前武器不符，已暫停施放。</span>`); }   // 🛡️ 審計#15：原本靜默不施放零提示→每 60 秒提示一次
                return false;
            }
            // 三重矢：必須裝備弓（🧹 v3.1.79 大掃除：移除 reqWpn 'nonbow' 死閘——全技能無此值·衝擊之暈實際用 'w2h'·原註解誤導）
            if(sk.reqWpn === 'bow' && (!player.eq.wpn || !DB.items[player.eq.wpn.id].isBow)) return false;
            let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
            let arrowData = null;

            // 👇 施放三重矢等技能時也要扣箭矢（🔧 改在扣 MP/設冷卻「之前」：沒箭時不再空耗 MP 與整段攻擊冷卻）
            if (wpn && wpn.isBow) {
                arrowData = consumeArrow();
                if (!arrowData) return false;
            }
            player.mp -= cost;
            // 👑 魔法精通的免費追加施放是「額外的一次」，它繞過了 521 行的 atkSk 閘門進場，
            //    若在這裡照樣重設冷卻，會把玩家原本已累積的冷卻進度整段吃掉（nextCastCooldown
            //    對正值 current 直接丟棄 carry）→ 平均只剩名目效益的一半。物理與魔法兩條分支都要擋。
            if (!_royalFreeCast) player.cds.atkSk = getAutoCastInterval(player, false, player.cds.atkSk);

            let dice = wpn ? (t.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;
            if (arrowData) {
                dice = t.s === 'L' ? arrowData.dmgL : arrowData.dmgS;
            }

            let hits = sk.hits || 1;
            // 🗼 騎士范德之劍：施展 衝擊之暈 時，本次技能近距離命中 +1（getPhysicalDmg 讀取，迴圈結束後重置）
            player._skillHitBonus = (skId === 'sk_shock_stun' && wpn && wpn.vanderStunHit && !wpn.isBow) ? 1 : 0;
            let totalDmg = 0, landed = 0, hitsLog = [], killed = false, delayDone = false;

            for(let h = 0; h < hits; h++) {
                if(t.curHp <= 0) break;
                if (typeof playArrowFx === 'function') playArrowFx(player, t, h * 90);   // 🏹 v3.2.14 三重矢：每箭一支箭矢序列幀投射物·錯開 90ms 快速連發（取代原 CSS 風彈·非弓技能如衝擊之暈內部 no-op）
                let res = getPhysicalDmg(dice, t, wpn, arrowData);
                if(!res.hit) { if (typeof vfxMiss === 'function') vfxMiss(t); hitsLog.push('Miss'); continue; }
                landed++;
                if(sk.skillAddDmg) res.dmg = Math.max(1, res.dmg + sk.skillAddDmg);   // ⚔️ 衝擊之暈：一般攻擊傷害 +10
                if(skId === 'sk_elf_triple' && wpn && wpn.fullHpMultTriple && t.curHp === t.hp) res.dmg = Math.max(1, Math.floor(res.dmg * wpn.fullHpMultTriple));   // 🏺 遺忘者的狙擊弓：三重矢對滿血敵人傷害 ×2（僅第一箭·命中後 curHp 已降·gate skId 避免衝擊之暈共用此迴圈時誤觸）
                // 🔮 紅獅 5/5 已於 getPhysicalDmg 內套用（避免重複），此處不再乘
                // 遠距離物理技能命中滿血被動怪物，賦予 3 秒延遲（整段只觸發一次）
                if(!delayDone && t.curHp === t.hp && t.beh === '被動' && res.ranged) { t._delayTicks = 30; delayDone = true; }
                t.curHp -= res.dmg;
                t.justHit = getWpnEle(player.eq.wpn, wpn);
                if (typeof reflectWallOnDamage === 'function') reflectWallOnDamage(t, res.dmg, res.ranged ? 'ranged' : 'melee', null);   // 🌑 v3.4.14 血壁空間：物理技能每擊反射（衝擊之暈/三重矢·玩家傭兵一致）
                if (player.dead) { player._skillHitBonus = 0; return true; }   // ☠️ v3.5.87 反射反殺：死後中止後續箭/擊與收尾（⚠️ 記得歸零范德命中加成）
                totalDmg += res.dmg;
                let mark = (res.heavy && res.crit) ? '會心' : (res.crit ? '爆' : (res.heavy ? '重' : ''));
                hitsLog.push(res.dmg + (mark ? '(' + mark + ')' : ''));
                mobWake(t);
                if(sk.stun && (sk.stunChance == null || Math.random() < sk.stunChance)) applyMobStatus(t, { kind:'stun', pbase:sk.stun, dur:6, hitOff: (wpn && wpn.stunHitBonus && !wpn.isBow) ? Math.round(wpn.stunHitBonus / 5) : 0 }, sk.n);   // ⚔️ 衝擊之暈：命中時 stunChance(10%) 機率暈眩；🏛️ 真．冥皇執行劍：暈眩命中率 +20%（hitOff +4）
                if(sk.status) applyMobStatus(t, sk.status, sk.n);
                if(t.curHp > 0 && sk.instakill && tryInstakill(t, sk.instakill, sk.n, mapState.targetIdx)) { killed = true; break; }
            }
            player._skillHitBonus = 0;   // 🗼 重置：范德之劍命中加成僅作用於本次技能

            if(landed > 0) {
                let detail = hits > 1 ? `[${hitsLog.join(', ')}] 共 ${totalDmg}` : `${totalDmg}`;
                let tag = totalDmg > 0 && hitsLog.some(x => x.includes('爆') || x.includes('會心')) ? 'player-crit' : 'player';
                logCombat(`施放 <span style="font-weight:700;color:#7dd3fc">${sk.n}</span>，對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${detail} 點物理傷害。`, 'skill');
                if(t.curHp <= 0) { if(!killed) killMob(mapState.targetIdx); }
                else renderMobs();
            } else {
                logCombat(`施放 ${sk.n} 未命中 <span class="${getMobColor(t.lv)}">${t.n}</span>。`, 'miss');
            }

            // 三重矢：連射發動即判定一次；月光爆裂依「命中次數」判定（每命中一箭各判定一次）
            if (skId === 'sk_elf_triple') {
                rapidfireProc(arrowData);   // 連射：發動攻擊即判定（不論三箭是否命中）；每箭各自命中判定
                for (let _m = 0; _m < landed; _m++) moonburstProc(t);   // 月光爆裂：等同命中次數，各 8% 獨立判定（主目標死亡自動轉移）
                wandLightArrowProc(t);   // 共鳴（裝弓時不生效，保留以求一致）
                magicStrikeProc(t);      // 魔擊（裝弓時不生效，保留以求一致）
            }
            return true;
        } else {
            let targets = sk.target === 'all' ? mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead) : [getTarget()].filter(m => m && m.curHp > 0);   // 🛡️ v2.6.69 審計#7：排除同 tick 已死屍體（killMob 只標記·settleDeadMobs 才移除）——原本對屍體結算的傷害會灌進 _burstDmg 使魔爆總量膨脹；與傭兵 allyCastMagic 過濾一致
            if(sk.bossOnly) targets = targets.filter(m => m && m.boss);   // 🌊 頭目限定技能（污濁之水）：非頭目不施放、不扣 MP／冷卻
            if(targets.length === 0) return false;

            // 防止對「已具有該異常狀態」的目標重複施放異常：
            //   僅限「純異常技」（無傷害骰 dmgDice / multiDmg）；可造成傷害又附加異常的技能（如冰矛圍籬）不在此限。
            //   單體：目標已有該狀態即跳過；範圍(target:'all')：所有存活目標都已有該狀態才跳過。跳過時不消耗 MP / 冷卻。
            if(sk.status && !sk.multiDmg && !sk.dmgDice) {
                let live = targets.filter(m => m && m.curHp > 0);
                if(live.length > 0 && live.every(m => m.st && m.st[sk.status.kind] > 0)) return false;
            }
            
            player.mp -= cost;
            // 👑 魔法精通的免費追加施放是「額外的一次」，它繞過了 521 行的 atkSk 閘門進場，
            //    若在這裡照樣重設冷卻，會把玩家原本已累積的冷卻進度整段吃掉（nextCastCooldown
            //    對正值 current 直接丟棄 carry）→ 平均只剩名目效益的一半。物理與魔法兩條分支都要擋。
            if (!_royalFreeCast) player.cds.atkSk = getAutoCastInterval(player, false, player.cds.atkSk);
            if(sk.hpCost && !_echoFree) player.hp = Math.max(1, player.hp - effHpCost(sk));   // 🔮 混亂/幻想/恐慌：扣除 HP 消耗（迴響連發那次免費；🐉 龍血精通減半）

            let totalDmgText = [];
            let _burstDmg = 0;   // 🔧 神官魔杖·魔爆：累計本次魔法總傷害
            targets.forEach((t, tidx) => {
                // --- 魔法技能命中滿血被動怪物，賦予 3 秒延遲 ---
                if (t.curHp === t.hp && t.beh === '被動') {
                    t._delayTicks = 30;
                }

                let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
                let mrFactor = mrMult(effMr);

                let dmgArray = sk.multiDmg || (sk.dmgDice ? [[sk.dmgDice[0], sk.dmgDice[1]]] : []);
                let totalDmg = 0;
                let hitsLog = [];
                let isCrit = Math.random() * 100 < player.d.magicCrit;
    
    // SP／屬性防禦係數後乘上 ×(1+法術階級/10)；屬性防禦依每個目標分別計入。
    let spCoef = magicDamageCoef(player.d, magicAttrDefense(t, sk.ele || 'none'), sk.tier);
    let mageDmgMult = 1.0;
    
    let magicCritMult = isCrit ? (1 + player.d.magicCritDmg / 100) : 1.0;

                dmgArray.forEach((diceArr, idx) => {
                    let baseMagicDmg = roll(diceArr[0], diceArr[1]);
                    let isLastHit = idx === dmgArray.length - 1;
                    let core = magicBaseDamage(baseMagicDmg, player.d, isLastHit ? (sk.dmgBase || 0) : 0, isLastHit) * spCoef * magicCritMult;

                    let extraMagicDmg = 0;
                    let fixed = 0;

                    let d = Math.floor((core + extraMagicDmg) * mrFactor);
                    d = Math.max(1, d) + fixed;
                    d = Math.max(1, Math.floor(d * elementCounterMult(sk.ele, t.e)));   // ⚔️ 屬性剋制：魔法剋怪 ×1.4、被剋 ×0.6（無屬性→×1）
                    if (idx === 0) d = Math.max(1, Math.floor(d * consumeWetMult(t, sk.ele)));   // 🏺 海洋水晶球：潮濕目標受風屬性魔法傷害 ×2 並解除（只在首段骰結算·避免多段各×2）
                    d = Math.floor(d * mageDmgMult);   // 保留流程相容性；目前不再追加舊法師專屬倍率
                    d = Math.max(1, Math.floor(d * rlFuryMult()));   // 🔮 紅獅5/5(×1.2)＋😡狂怒5/5：攻擊技能最終傷害
                    // 🔧 魔導精通同屬性傷害×2 已移除(2026-07 用戶要求)
                    d = Math.max(1, Math.floor(d * fragileMult(t) * illuLvMult(player)));    // 🔮 脆弱（白鳥5）；🔮 幻術士等級加成 ×(1+等級/50)（幻想/混亂）
                    d = Math.max(1, Math.floor(d * wpnEnFinalMult(player.eq.wpn)));   // 🔧 武器強化 +11~+20：最終傷害倍率（也影響玩家施放的傷害魔法；物理技能走 getPhysicalDmg 已含、不在此處）
                    totalDmg += d;
                    hitsLog.push(d);
                });
                
                if(dmgArray.length > 0) {
                    if (sk.hpCost && player._setDragonblood5) totalDmg = Math.max(1, Math.floor(totalDmg * 1.2));   // 🐉 龍血5/5：HP消耗技傷害+20%
                    totalDmg = illusionMagicDmg(totalDmg, false);   // 🔮 攻擊技能下拉選單可選的一般傷害法術，不觸發幻覺2/5與5/5
                    totalDmg = Math.max(1, Math.floor(totalDmg * equipSkillDmgMult(sk, skId) * (_autoCastNow ? (_equipWpnField('autoCastDmgMult') || 1) : 1)));   // 🏺 遺物 特定技能傷害倍率（冰錐/光箭/究極光裂術 ×1.5）；🐍 枯竭魔杖：auto 施放傷害 ×autoCastDmgMult(1.5)
                    t.curHp -= totalDmg;
                    _burstDmg += totalDmg;   // 🔧 魔爆累計
                    t.justHit = (sk.ele && sk.ele !== 'none') ? sk.ele : 'magic';
                    t._spellHurt = true;   // 🎬 v3.0.14 法術傷害→hurt 動畫(含頭目·renderMobs 頭目閘放行)
                    if (typeof reflectWallOnDamage === 'function') reflectWallOnDamage(t, totalDmg, 'magic', null);   // 🌑 v3.4.14 血壁空間：傷害魔法技能（單體/全體）＝魔法反射（玩家傭兵一致）
                    let multiText = hitsLog.length > 1 ? `[${hitsLog.join(", ")}] (總和: ${totalDmg})` : `${totalDmg}`;
                    if (isCrit) multiText += " (爆擊!)";
                    totalDmgText.push(`對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 <span class="${isCrit?'text-yellow-500 font-bold':'text-cyan-300'}">${multiText} 點傷害</span>`);
                    if (player.dead) return;   // ☠️ v3.5.87 反射反殺：跳過本目標其餘附帶效果（forEach 內·外層另有總守衛）
                                               // ⚡ v3.5.89 守衛移到傷害訊息 push 之後：原本擋在前面會讓被反殺當下印出「施放 冰矛 -> 」的空箭頭殘缺日誌
                } else {
                    // 純狀態/秒殺類魔法（無傷害骰）：不造成直接傷害，只施加效果
                    t.justHit = (sk.ele && sk.ele !== 'none') ? sk.ele : 'magic';
                    totalDmgText.push(`對 <span class="${getMobColor(t.lv)}">${t.n}</span> 施放`);
                }
                mobWake(t);
                if(typeof playSpellFx === 'function') { try { playSpellFx(sk.n, t); } catch(e){} }   // ⚡ v2.7.15 法術特效：技能有註冊 SPELL_FX 者於目標身上疊播天堂原版特效(純視覺·只有註冊者會播)
                if(t.st && t.st.mrhalf > 0) t.st.mrhalf = 0; // 受一次魔法傷害後解除魔抗減半
                if(sk.lifesteal) { let h = Math.min(totalDmg, player.mhp - player.hp); if(h > 0){ player.hp += h; logCombat(`你吸取了 ${h} 點生命。`, 'heal'); } }
                if(sk.freeze) applyMobStatus(t, { kind:'freeze', pbase:sk.freeze, dur:6 }, sk.n);
                if(sk.status) applyMobStatus(t, sk.status, sk.n, spCoef);
                // 🏺 v3.5.27 水靈的魔力珠：原本不具冰凍效果的水屬性傷害魔法 → pct% 機率附加冰凍 dur 秒（頭目免疫冰凍照舊·經典模式停用特效）
                { let _wfW = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
                  if (_wfW && _wfW.waterFreezeProc && sk.ele === 'water' && dmgArray.length > 0 && !sk.freeze && !(sk.status && sk.status.kind === 'freeze') && !player.classicMode
                      && t.curHp > 0 && !(t.boss && BOSS_IMMUNE.includes('freeze')) && Math.random() * 100 < _wfW.waterFreezeProc.pct) {
                      if (!t.st) t.st = newMobStatus();
                      t.st.freeze = (_wfW.waterFreezeProc.dur || 4) * 10;
                      logCombat(`<span class="font-bold text-sky-300">【${_wfW.n}】</span><span class="${getMobColor(t.lv)}">${t.n}</span> 被寒流冰凍了！`, 'player-special');
                  } }
                if(t.curHp > 0 && sk.instakill) tryInstakill(t, sk.instakill, sk.n, mapState.mobs.findIndex(m => m && m.uid === t.uid));
            });
            
            logCombat(`施放 <span style="font-weight:700;color:#7dd3fc">${sk.n}</span> -> ${totalDmgText.join(" | ")}`, 'skill');
            if (player.dead) return true;   // ☠️ v3.5.87 反射反殺：死後不結算擊殺經驗/掉落與後續 proc
            targets.forEach((t) => {
                if(t.curHp <= 0) {
                    let realIdx = mapState.mobs.findIndex(m => m && m.uid === t.uid);
                    if(realIdx !== -1) killMob(realIdx);
                }
            });
            // 🏺 風精靈王的狂嘯：主動施展風屬性傷害魔法時，15% 免費追加一次龍捲風（武器 proc 路徑不會回到此處，避免遞迴）。
            {
                let _ww = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
                if (_ww && _ww.windSpellProcRate && sk.ele === 'wind' && _burstDmg > 0 && Math.random() * 100 < _ww.windSpellProcRate) {
                    let _wt = mapState.mobs.find(m => m && m.curHp > 0 && !m._dead);
                    if (_wt) { logCombat(`<span class="font-bold" style="color:#86efac;text-shadow:0 0 6px #16a34a;">【${_ww.n}】</span>狂風共振，額外觸發龍捲風！`, 'player-special'); procFreeMagicSkill(_wt, 'sk_tornado', capWpnEn((player.eq.wpn && player.eq.wpn.en) || 0), false, _ww); }
                }
            }
            // 🔧 神官魔杖·魔爆：施放傷害魔法時依機率(單體 智力/100、全體 智力/60)引爆本次傷害30%的無屬性傷害，均分給場上所有敵人
            {
                let _bw = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
                if (_bw && _bw.eff === 'magicburst' && _burstDmg > 0 && !player.classicMode) {   // 🎮 經典模式：停用魔爆
                    let _aoe = (sk.target === 'all') || (targets.length > 1);
                    let _msB = hasMastery('m_strike');   // 🏅 v2.6.71：改發魔擊時觸發率比照原生魔擊＝力量/60（不再吃智力/100或/60）
                    if (Math.random() < (_msB ? ((player.d.str || 0) / 60) : ((player.d.int || 0) / (_aoe ? 60 : 100)))) {
                        if (_msB) {   // 🏅 v2.6.70 魔擊精通：持魔爆武器時，魔爆觸發改為發動魔擊（對施放目標·含擴散·不再引爆30%均分）
                            let _mt = (targets && targets.find(x => x && x.curHp > 0)) || mapState.mobs.find(m => m && m.curHp > 0 && !m._dead);
                            if (_mt) procMagicStrike(_mt);
                        } else {
                        let _live = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
                        if (_live.length) {
                            let _ex = Math.max(1, Math.floor(_burstDmg * 0.3 / _live.length));   // 🔧 v2.6.63：總量30%均分給場上敵人（原每隻各吃30%）
                            logCombat(`<span class="font-bold" style="color:#f0abfc;text-shadow:0 0 6px #c026d3;">【魔爆】</span>魔力過載爆炸，波及全場！`, 'player-special');
                            _live.forEach((m, i) => {
                                let _d = Math.max(1, Math.floor(_ex * fragileMult(m)));
                                _d = illusionMagicDmg(_d, true, i === 0); m.curHp -= _d; if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(m, _d, 'magic'); m.justHit = 'magic'; mobWake(m);   // 🔮 魔爆每次發動只回一次MP，5件仍逐目標生效；🌅 巨大骷髏視為魔法
                                logCombat(`魔爆波及 <span class="${getMobColor(m.lv)}">${m.n}</span>，造成 ${_d} 點無屬性傷害。`, 'player');
                                if (m.curHp <= 0) { let ri = mapState.mobs.findIndex(x => x && x.uid === m.uid); if (ri !== -1) killMob(ri); }
                            });
                        }
                        }
                    }
                }
            }
            renderMobs();
            // 🏅 迴響精通：(11-法術階級)×10% 機率不消耗 MP 立刻再施放一次（連發那次不再觸發迴響）
            let _echoRate = (11 - (sk.tier || 1)) / 10;
            if (sk.target !== 'all') _echoRate *= 2;   // 🏅 迴響精通：單體傷害魔法觸發機率加倍（全體傷害魔法沿用原機率）
            if (hasMastery('m_echo') && !_echoFree && Math.random() < _echoRate) {
                logCombat(`<span class="font-bold" style="color:#93c5fd;text-shadow:0 0 6px #3b82f6;">【迴響精通】</span>${sk.n} 的魔力迴盪不息，再次轟出！`, 'magic');
                _echoFree = true;
                try { castSkill(skId); } finally { _echoFree = false; }
            }
            return true;
        }
    }
    
    if(sk.type === 'buff') {
        if(sk.noRefresh && (player.buffs[skId] || 0) > 0) return false;   // 🔧 烈焰之魂等：效果未結束不可再施放（不刷新）
        if(sk.reqWpn === 'w2h' && (!player.eq.wpn || !DB.items[player.eq.wpn.id].w2h)) return false;
        if(sk.reqWpnMelee && (!player.eq.wpn || DB.items[player.eq.wpn.id].isBow || DB.items[player.eq.wpn.id].ranged)) return false;   // 🐉 燃燒擊砍：須裝備近距離武器
        if(sk.reqWpnBlunt && (!player.eq.wpn || !(getWeaponTags(player.eq.wpn.id).includes('單手鈍器') || getWeaponTags(player.eq.wpn.id).includes('雙手鈍器')))) return false;   // ⚔️ 戰斧投擲：須裝備單手／雙手鈍器
        if(sk.reqShield && !player.eq.shield && !(player.eq.wpn && getWeaponTags(player.eq.wpn.id).includes('武士刀'))) return false;   // 武士刀：免盾亦可施展
        // 🧙 v3.2.21 玩家召喚類 v2：sk_summon／sk_zombie（造屍術）／sk_elf_summon(2)（屬性精靈）分流到 js/23（多實體·可被攻擊·浮動框）；迷魅與傭兵維持舊 setupSummon 管線
        if(sk.summon) {
            if (typeof SUMMON_V2_SKILLS !== 'undefined' && SUMMON_V2_SKILLS.includes(skId) && typeof summonV2CastFor === 'function') {
                if (!summonV2CastFor(skId, false)) return false;
                player.mp -= cost; calcStats(); return true;
            }
            setupSummon(skId, sk); player.mp -= cost; calcStats(); return true;
        }
        // 🧹 v3.1.79 大掃除：移除不可達的舊版淨化分支（sk_antidote/sk_holy_light/sk_cancel 的 type 皆為 'heal'→一律在上方 heal 淨化分支處理並 return·永遠到不了本 buff 分支；現行規則＝teamCleanseOne 一次只解一人·舊分支「只解玩家自身」語意已過時）
        player.buffs[skId] = sk.dur;
        applyMoveDashBuffMutex(player, skId);
        if(sk.awaken && player.mastery !== 'k_awaken') { ['sk_dragon_awaken_antares','sk_dragon_awaken_falion','sk_dragon_awaken_baraka'].forEach(_ak => { if(_ak !== skId) player.buffs[_ak] = 0; }); }   // 🐉 覺醒互斥：非覺醒精通時同時只能維持一種覺醒
        if(sk.haste) player.buffs.haste = Math.max(player.buffs.haste || 0, sk.dur); // 加速術 → 套用 haste 效果
        player.mp -= cost;
        if(sk.hpCost) player.hp = Math.max(1, player.hp - effHpCost(sk));  // 消耗 HP（冥想術/堅固防護/隱身術；🐉 龍血精通減半）
        if(sk.costItem && typeof consumeMaterialById === 'function') consumeMaterialById(sk.costItem.id, sk.costItem.qty || 1);   // 🌀 施法材料扣除（背包優先、不足取倉庫；上方已驗存量。目前僅增益型技能使用 costItem，其他類型若要用需自行在該分支扣除）
        logCombat(`施放 ${sk.n}。${sk.msg || ''}`, 'magic');
        calcStats();
        return true;
    }
    return false;
}

// 💤 【休眠機制】團隊 HoT（持續回復）：整條鏈路目前不可達——DB.skills 內已無任何技能宣告 hot/autoBuff
//    （sk_regen 體力回復術／sk_elf_lifebless 生命的祝福 已改為 classicHeal+groupHeal 的「瞬間全隊治癒」）。
//    機制本身完整且正確，刻意保留以便日後新增持續回復技能：只要在 js/00-data.js 該技能加回
//    `hot: { interval: <每跳 tick 數>, ticks: <總跳數> }` 與 `autoBuff: true`，整條鏈路即自動復活。
//    相關落點：js/03 tick 回復迴圈、js/07 applyTeamHot＋施放分支、js/06 傭兵施放、js/08 狀態圖示、js/10 取消打勾結束。
// 🍃 團隊 HoT（生命的祝福 / 體力回復術）單一真相：施放時登錄「全隊持續回復」到 player.hots[skId]。
//   ・player.hots 為 dict(skId→HoT 實例)→不同技能可並存；同 skId 後放覆蓋先放（取代/刷新）。
//   ・dStats＝施法者衍生值(玩家 player.d 或傭兵 ally.d)→spCoef 由施法者魔法傷害決定；每 interval 於 js/03 tick 對「玩家＋全體非倒地傭兵」各回復一次。
function applyTeamHot(skId, sk, dStats, caster) {
    if (!player.hots) player.hots = {};
    let mDmg = (dStats && dStats.magicDmg) || 0;
    // 🏺 v3.1.80 治癒者的恢復魔棒：施放者（玩家或傭兵）持有團體治癒強化武器 → 此 HoT 每跳回復 ×N（施放時快照·中途換武器不影響已存在的 HoT）
    // 🔧 v3.5.94 斷鏈修復：舊碼讀的 hotHealMult 欄位在 DB.items 已零定義（relic_healer_wand 早已遷移為 groupHealMult），
    //    照橫幅配方復活時 _hm 會恆為 1、魔棒對 HoT 完全失效。改走單一真相 healingSpellCasterMult(js/03)，與瞬間治癒同一份欄位。
    //    ⚠️ 該 helper 以 sk.groupHeal 為閘：日後復活的 HoT 技能若要吃魔棒加成，技能定義須保留 groupHeal:true（sk_regen／sk_elf_lifebless 現況即是）。
    let _hm = 1;
    try { if (typeof healingSpellCasterMult === 'function') _hm = Math.max(0, Number(healingSpellCasterMult(sk, caster)) || 1); } catch (e) {}
    player.hots[skId] = { skId: skId, healDice: sk.healDice, healBase: sk.healBase, valDice: sk.valDice, magicDmg: mDmg, spCoef: 1 + (3 * mDmg / 32), interval: sk.hot.interval, ticksLeft: sk.hot.ticks, cd: sk.hot.interval, skName: sk.n, msg: sk.msg, healMult: _hm };
}
function autoActions() {
    let hpPct = (player.hp / player.mhp) * 100;
    let mpPct = (player.mp / player.mmp) * 100;
    
    let potId = document.getElementById('set-pot').value;
    let potThr = parseInt(document.getElementById('set-hp-pot').value) || 0;
    
    if (hpPct <= potThr && player.cds.pot <= 0) {
        let item = player.inv.find(i => i.id === potId);
        if (item) useItem(item.uid, true);
        else if (document.getElementById('set-auto-buy-pot').checked) {
            // 自動補貨至100瓶 (三種治癒藥水皆適用)
            let current = player.inv.find(i => i.id === potId);
            let count = current ? current.cnt : 0;
            let needed = 100 - count;
            let unitPrice = shopPrice(DB.items[potId].p);   // 攻城獲勝 8 折亦適用
            if (needed > 0 && player.gold >= needed * unitPrice) {
                player.gold -= needed * unitPrice;
                gainItem(potId, needed, true, true);
                logSys(`自動消耗 ${needed * unitPrice} 金幣購買了 ${needed} 瓶${DB.items[potId].n}。`);
                let fresh = player.inv.find(i => i.id === potId);
                if(fresh) useItem(fresh.uid, true);
            }
        }
    }
    
    const buffs = [   // 🗑️ v3.5.87 刪除六筆 buyId 欄位：v3.3.15「自動購買併入自動使用」時對應 DOM id 已移除·欄位零讀取（自動補購改由缺貨自動買一瓶邏輯處理）
        { id: 'set-haste', pot: 'potion_haste', b: 'haste' },
        { id: 'set-brave', pot: 'potion_brave', b: 'brave', req: 'knight,dragon,warrior,royal' },
        { id: 'set-blue', pot: 'potion_blue', b: 'blue' },
        { id: 'set-cautious', pot: 'new_item_140', b: 'cautious', req: 'mage,illusion' },
        { id: 'set-elfcookie', pot: 'new_item_139', b: 'elfcookie', req: 'elf' },
        { id: 'set-poly', pot: 'scroll_poly', b: 'poly' },
        { id: 'set-magicbarrier', pot: 'scroll_magicbarrier', b: 'sk_magic_shield' }
    ];
    buffs.forEach(cfg => {
        if (cfg.b === 'haste' && player._equipHaste) return;   // 裝備常駐加速（伊娃之盾）：不重複喝加速藥水
        if (document.getElementById(cfg.id).checked && (player.buffs[cfg.b] || 0) <= 0) {
            if(cfg.req && !cfg.req.split(',').includes(player.cls)) return;   // 🎮 支援逗號多職業（勇敢藥水 knight,dragon）
            let item = player.inv.find(i => i.id === cfg.pot);
            if(item) {
                 useItem(item.uid, true);
            } else {   // 🧪 v3.3.15 自動使用＝自動購買合併：勾選使用且缺貨→自動買一瓶再用（不再需要獨立「自動購買」勾選；魔法屏障卷軸亦同）
                 let price = shopPrice(DB.items[cfg.pot].p);   // 攻城獲勝 8 折亦適用
                 if(player.gold >= price) {
                     player.gold -= price;
                     gainItem(cfg.pot, 1, true, true);
                     useItem(player.inv.find(i => i.id === cfg.pot).uid, true);
                 }
            }
        }
    });

    // 瞬間移動卷軸：戰鬥中出現 BOSS 時自動使用（自動使用必定為未裝備傳送控制戒指的傳送術效果）
    {
        let tChk = document.getElementById('set-teleport');
        let _huntBoss = !!(window.AFK_BOSSRING && window.AFK_BOSSRING.huntActive && window.AFK_BOSSRING.huntActive());   // 🔌 加掛版補丁:外掛「自動找BOSS」進行中→抑制逃離(否則剛召來的王立刻被瞬移走);外掛未載入=false 照常
        if (tChk && tChk.checked && !_huntBoss && mapState.mobs.some(m => m && m.boss && !m.noAutoTeleport) && !isSiegeArea(mapState.current) && !PURE_BOSS_MAPS.includes(mapState.current) && !state.prideClimb && !state.oblivion && !state.riftRun && (state._manualTpUntil == null || (state.ticks || 0) >= state._manualTpUntil)) {   // 🕒 手動瞬移後 5 秒內不自動瞬移/自動購買；攻城區與純BOSS房(安塔瑞斯/法利昂/巴拉卡斯)：BOSS為目標，不自動瞬移；🔧 卡瑞(noAutoTeleport)不觸發自動瞬移；🗼 傲慢之塔攀登中不自動瞬移；🌀 時空裂痕不自動瞬移逃離頭目
            let item = player.inv.find(i => i.id === 'scroll_teleport');
            if (!item) {
                let _tpCost = shopPrice(DB.items.scroll_teleport.p);   // 攻城獲勝 8 折亦適用
                if (player.gold >= _tpCost) {   // 🧪 v3.3.15 自動使用＝自動購買合併：勾選瞬移且缺貨→自動買一張
                    player.gold -= _tpCost;
                    gainItem('scroll_teleport', 1, true, true);
                    item = player.inv.find(i => i.id === 'scroll_teleport');
                }
            }
            if (item) useItem(item.uid, true);   // silent → 不強制 BOSS
        }
    }

    if((player.d.loadTier||0) < 2) player.skills.forEach(sid => {
        let sk = DB.skills[sid];
        if(sk.type === 'buff') {
            if(sk.haste && (player.buffs.haste > 0 || player._equipHaste)) return;  // 已有加速來源（含裝備常駐），不重複施放
            if(typeof TEAM_AURA_SKILLS !== 'undefined' && TEAM_AURA_SKILLS.includes(sid) && _teamAuraHas(sid, player)) return;   // 團隊光環已有其他隊員維持時不重複施放／扣魔
            // 💨 v3.0.94 強力加速術優先：加速術/強力加速術同時勾選→只施放強力加速術（加速術讓位；原本加速術先施放後 buffs.haste>0 會永遠擋住強力加速術→其 buff 鍵不存在、狀態圖示也不顯示）
            if(sid === 'sk_haste_spell') { let _g = document.getElementById('auto-sk-sk_greater_haste'); if (_g && _g.checked && player.skills.includes('sk_greater_haste')) return; }
            if(sid === 'sk_sunlight' && KING_ROOMS[mapState.current]) return;   // 🔧 軍王之室／底比斯祭壇：日光術無效，跳過自動施放（否則每 tick 被擋下並狂洗系統日誌）
            if(sk.darkStealth && player._darkStealthCd > state.ticks) return;   // 🔧 暗隱術：冷卻中不自動施放（須身上無暗隱術且冷卻結束才再施放）
            if(sk.awaken && player.mastery !== 'k_awaken' && ['sk_dragon_awaken_antares','sk_dragon_awaken_falion','sk_dragon_awaken_baraka'].some(a => (player.buffs[a]||0) > 0)) return;   // 🐉 覺醒互斥：已有一種覺醒生效時不自動施放其他覺醒（避免互相清除而反覆耗HP/MP）；覺醒精通可同時三種
            if(sk.cube && mapState.current.startsWith('town_')) return;   // 🔮 立方：安全區(村莊)不自動施放，進入狩獵區(非 town_)才展開
            if(sk.stormInterval && mapState.current.startsWith('town_')) return;   // 🌨️🔥 火牢/冰雪颶風等持續傷害增益(STORM_BUFF_SKILLS)：安全區(村莊)無敵人→不自動施放(免空耗 MP/洗版)，與立方/轉換魔法一致
            if(sk.summon && typeof _petInWild === 'function' && !_petInWild()) return;   // 🧟 v3.2.21 召喚類增益：安全區/無怪區不自動施放（v2 施放會被擋→免反覆嘗試洗版·比照立方/颶風）
            if(sk.costItem && mapState.current.startsWith('town_')) return;   // 🌀 消耗道具型增益：安全區無戰鬥損耗，不自動施放以免白耗材料（手動施放不受限）
            // 👑 力盔/敏盔版同效果已生效：跳過自動施放對應的法師/王族魔法版（recomputeStats@4037 會把同名 buff 歸零；若仍自動施放會每 tick 被歸零後反覆重施＝無限洗版）
            if((sid === 'sk_ench_wpn' && (player.buffs.sk_helm_str1||0) > 0) || (sid === 'sk_dex_up' && (player.buffs.sk_helm_dex1||0) > 0) || (sid === 'sk_reveal' && (player.buffs.sk_helm_str2||0) > 0)) return;
            let chk = document.getElementById(`auto-sk-${sid}`);
            if(chk && chk.checked && (!player.buffs[sid] || player.buffs[sid] <= 0)) {
                castSkill(sid);
            }
        } else if(sk.type === 'heal' && sk.autoBuff) {
            // 體力回復術 / 生命的祝福：以增益勾選框維持；castSkill 內部的 healSk 冷卻與 HoT 持續守衛會防止重複施放
            let chk = document.getElementById(`auto-sk-${sid}`);
            if(chk && chk.checked) castSkill(sid);
        } else if(sid === 'sk_antidote' || sid === 'sk_holy_light' || sid === 'sk_cancel') {
            // 淨化類：勾選即自動施放；castSkill 內 _purifyOk 守衛確保僅在有對應負面狀態時才施放、否則不耗 MP/CD
            let chk = document.getElementById(`auto-sk-${sid}`);
            if(!chk || !chk.checked) return;
            if((sid === 'sk_antidote' || sid === 'sk_holy_light') && document.getElementById('auto-sk-sk_cancel')?.checked) return;   // 相消已涵蓋解毒/聖潔之光，跳過
            castSkill(sid);
        }
    });
    // 🤝 v3.4.45 單體輔助共享：玩家有清單內 buff→幫缺的隊友(傭兵)補（負重過重時與 buff 迴圈一致不施放）
    if((player.d.loadTier||0) < 2) { try { if (typeof shareTeamBuffs === 'function') shareTeamBuffs(player); } catch(e){} }

    // 轉換魔法已移至 autoCastSpells 每 tick 檢查，實際頻率由 convertSk＋職業／變身 cast 控制。
}

// 🆕 v2.6.28 移除「行動不能中自救淨化」（tryEmergencyDispel）：改為硬控(石化/冰凍/暈眩/麻痺/沉睡)中無法施放淨化，由自由隊員(玩家/傭兵)幫全隊解除（見 castSkillInner heal 分支 + allyTryDispel + teamCleanseStatus）。

// 攻擊／輔助施法各自讀取職業／變身速度；current 用來承接小數 tick 的超時餘數。
function getAutoCastInterval(actor, support, current) {
    let who = actor || player;
    return arguments.length >= 3 ? nextCastCooldown(current, who, !!support) : castIntervalTicks(who, !!support);
}

// 🐍 艾庫艾托的枯竭魔杖：自動施放的傷害技能 消耗MP×2、傷害×1.5（僅 auto 施放路徑；手動施放不受影響）
let _autoCastNow = false;
function _equipWpnField(f) { let w = (player.eq && player.eq.wpn) ? DB.items[player.eq.wpn.id] : null; return (w && w[f]) || 0; }
// 自動施放攻擊／治癒／轉換法術：每個 tick 呼叫一次，各欄位獨立冷卻但共用 castIntervalTicks 速度公式
function autoCastSpells() {
    if(!state.running || player.dead) return;
    if((player.d.loadTier||0) >= 2) return;   // 🔧 負重 82%+：暫停所有技能自動施放
    let mpPct = (player.mp / player.mmp) * 100;
    let hpPct = (player.hp / player.mhp) * 100;

    // 場上三格皆無敵人時，讓攻擊技能冷卻立即歸零，待怪物一出現即可立即施放
    let hasEnemy = mapState.mobs.some(m => m && m.curHp > 0);
    if(!hasEnemy) player.cds.atkSk = 0;

    let atkSk = document.getElementById('sel-atk-skill').value;
    let atkThr = parseInt(document.getElementById('set-mp-atk').value) || 0;
    let atkTarget = getTarget();
    if(atkSk && mpPct >= atkThr && atkTarget && (player.cds.castLock || 0) <= 0) {   // 🔮 天堂職業施法冷卻下限：castLock 未歸零前不自動施放攻擊魔法（法師快·王族/黑妖慢）
        // 標籤型即死技能（起死回生術→不死、釋放元素→元素）：
        //   僅在「目標具備對應標籤且非 BOSS」時才自動施放，避免對多羅等無效目標空放、浪費 MP 與冷卻。
        let skDef = DB.skills[atkSk];
        let ikTag = (skDef && skDef.instakill && skDef.instakill.tag) || null;   // 即死技 tag：需非 BOSS 且具該 tag
        let needTag = (skDef && skDef.tagReq) || null;   // 🔮 一般 tag 需求（骷髏毀壞=不死；BOSS 亦可，僅暈眩對 BOSS 無效）
        let _noRecast = skDef && skDef.noRecastStatus && atkTarget.st && atkTarget.st[skDef.noRecastStatus] > 0;   // 🔮 混亂/恐慌：目標已有該狀態則不重複施放
        let _tagOk = (!ikTag || (!atkTarget.boss && mobHasTag(atkTarget, ikTag))) && (!needTag || mobHasTag(atkTarget, needTag));
        if(!_noRecast && _tagOk) { let _castOk = false; _autoCastNow = true; try { _castOk = castSkill(atkSk); } finally { _autoCastNow = false; } if(_castOk) player.cds.castLock = getAutoCastInterval(player, false, player.cds.castLock); }   // 🔮 實際施放成功才設攻擊施法鎖（含零MP／耗HP技）；🐍 _autoCastNow：枯竭魔杖 auto 施放 MP×2/傷害×1.5
    }

    let healSk = document.getElementById('sel-heal-skill').value;
    let healThr = parseInt(document.getElementById('set-mp-heal').value) || 0;
    // 治癒魔法改為「HP <= X%」觸發（與恢復生命藥水相同機制）；MP 是否足夠由 castSkill 內部判斷
    // 🤝 v3.0.94→v3.2.68 隊長治癒也幫隊員/寵物/召喚物：觸發條件改看「全受益池(玩家＋傭兵＋出戰寵物＋召喚物)最低 HP%」——任何成員低於門檻即施放（castSkill 治癒分支自會選 HP% 最低者；原只掃玩家＋傭兵→寵物/召喚受傷不會觸發玩家自動治癒＝與傭兵 allyTryHeal 行為不一致）
    let _teamLowPct = hpPct;
    if (typeof healBeneficiaries === 'function') {
        healBeneficiaries().forEach(m => { if (m === player) return; let _mx = _supMhp(m); if (_mx > 0) { let _p2 = (_supHp(m) / _mx) * 100; if (_p2 < _teamLowPct) _teamLowPct = _p2; } });
    } else {
        (player.allies || []).forEach(a => { if (a && !a._downed && (a.curHp || 0) > 0 && (a.mhp || 0) > 0) { let _p2 = (a.curHp / a.mhp) * 100; if (_p2 < _teamLowPct) _teamLowPct = _p2; } });
    }
    if(healSk && _teamLowPct <= healThr) castSkill(healSk);

    // 轉換魔法（妖精／法師下拉，單選）：安全區暫停、MP 達 90% 以上不轉換；
    // 實際頻率由 convertSk 控制，與攻擊／治癒套用相同職業／變身 cast，不再固定每 3 秒。
    let convSel = document.getElementById('sel-convert-skill');
    let convId = convSel ? convSel.value : '';
    if((player.d.loadTier||0) < 2 && !mapState.current.startsWith('town_') && convId && player.skills.includes(convId) && DB.skills[convId] && DB.skills[convId].type === 'convert') {
        let thEl = document.getElementById('set-hp-convert');
        let th = thEl ? (parseFloat(thEl.value) || 0) : 0;
        if(hpPct > th && player.mp < player.mmp * 0.9) castSkill(convId);
    }
}

// 詞綴抽取（新制）：掉落/製作/潘朵拉/血盟 等管道只會隨機產生「祝福的」(bless) 1%；不再有單/雙/三詞綴或屬性/遠古的隨機掉落。
// 🔧 詞綴抽取：怪物掉落 / 製作 / 潘朵拉 / 血盟怪掉落 等管道「只可能獲得 祝福的」詞綴（1%）。
//    屬性詞綴與遠古系詞綴不再由這些管道隨機產生（改由象牙塔『碧恩』的賦予祝福卷軸取得）。
//    🔮 席琳的世界擊殺掉落仍套用 ×3（祝福機率 3%）。
function rollAffixesNew() {
    let m = _sherineLootCtx ? (_sherineLootCtx.mad ? 5 : 3) : 1;   // 🔮 席琳的世界 祝福機率 ×3（瘋狂×5）
    return { attr: false, bless: (lootRng('affixb') < 0.01 * m), anc: false };   // 🎲 committed RNG（防 SL 重抽祝福詞綴）
}
// 🗑️ v3.5.87 移除 rollAffixesOld()：與 rollAffixesNew 早已 byte-identical（新舊詞綴制 v3.1 期合一），
//    唯一呼叫點 js/08 gainItem 已改恆走 rollAffixesNew；affixOld 參數槽保留（位置相容）但不再分派。
