function summonAttack(sm) {
    if(!sm) return;
    let t = getTarget(); if(!t) return;
    let cha = player.d.cha || 0;
    let idx = mapState.mobs.findIndex(m => m && m.uid === t.uid);

    // === 迷魅術：被迷魅怪物（單次攻擊，額外獲得 =魅力 的命中與傷害）===
    if(sm.skId === 'sk_charm') {
        let hv = Math.max(1, Math.min(20, player.lv + sm.hitBonus + cha - t.lv + mobEffAC(t) + (hasSummonCtrlRing() ? 5 : 0)));   // 🔧 召喚控制戒指：召喚物命中+5
        let r = roll(1, 20);
        if(!((r === 20) || (r !== 1 && hv >= r) || (r === 19 && hasSummonCtrlRing()))) { logCombat(`${sm.n} 的攻擊未命中。`, 'miss'); return; }
        let dmg = Math.max(1, roll(sm.dmgDice[0], sm.dmgDice[1]) + cha - (t.dr || 0));
        t.justHit = 'normal'; t.curHp -= dmg; mobWake(t);
        logCombat(`<span class="text-purple-300">${sm.n}</span> 攻擊 <span class="${getMobColor(t.lv)}">${t.n}</span>，造成 ${dmg} 點傷害。`, 'player');
        if(t.curHp <= 0 && idx !== -1) killMob(idx); else renderMobs();
        return;
    }

    // === 魅力召喚物：近戰多段(floor(魅力/6)次) / 屬性精靈(單次遠距) ===
    // 🏅 精靈精通：屬性精靈/強力屬性精靈 數量＝1+魅力/10（60魅力上限7隻，各自完整攻擊一次）
    // 🔧 召喚「數量」(段數/隻數) 以魅力 60 封頂；超過 60 只提升下方的傷害與命中，不再增加數量
    let chaCnt = Math.min(60, cha);
    let hits = (sm.kind === 'melee') ? Math.max(1, Math.floor(chaCnt / 6))
        : ((hasMastery('e_spirit') && (sm.skId === 'sk_elf_summon' || sm.skId === 'sk_elf_summon2')) ? Math.min(7, 1 + Math.floor(chaCnt / 10)) : 1);
    let hitLvOff = sm.hitLvOff || 0;
    // 🏅 召喚精通：造屍術/召喚術的「傷害與命中判定魅力」改為 魅力×1.2（攻擊段數仍依原魅力）
    let chaEff = (hasMastery('m_summon') && (sm.skId === 'sk_zombie' || sm.skId === 'sk_summon')) ? cha * 1.2 : cha;
    for(let i = 0; i < hits; i++) {
        if(t.curHp <= 0) break;
        // 命中值 = 玩家等級 + 偏移 + 魅力 - 目標等級 + 目標AC（d20）
        let hv = Math.max(1, Math.min(20, player.lv + hitLvOff + chaEff - t.lv + mobEffAC(t) + (hasSummonCtrlRing() ? 5 : 0)));   // 🔧 召喚控制戒指：召喚物命中+5
        let r = roll(1, 20);
        if(!((r === 20) || (r !== 1 && hv >= r) || (r === 19 && hasSummonCtrlRing()))) { logCombat(`${sm.n} 的攻擊未命中。`, 'miss'); continue; }
        let dmg;
        if(sm.kind === 'ranged') {
            let flat = Math.floor(cha * player.lv / (sm.elemScale || 20));   // 屬性精靈：魅力 x (等級/scale)
            dmg = summonElementDamage(sm.dmgDice, sm.ele, t, flat);
            t.justHit = sm.ele !== 'none' ? sm.ele : 'magic';
        } else {
            let flatBase = chaEff / (sm.dmgDiv || 5);                          // 近戰固定加成基底 = 魅力/dmgDiv（🏅 召喚精通 ×1.2）
            let flat = sm.dmgLvDiv ? Math.floor(flatBase * (1 + player.lv / sm.dmgLvDiv)) : Math.floor(flatBase);   // 造屍術等具 dmgLvDiv：再乘上 (1+玩家等級/dmgLvDiv)
            dmg = Math.max(1, roll(sm.dmgDice[0], sm.dmgDice[1]) + flat - (t.dr || 0) - mobHardSkin(t));   // 🔧 硬皮：額外物理減傷（召喚物近戰；但不消磨硬皮值）
            t.justHit = 'normal';
        }
        t.curHp -= dmg; mobWake(t);
        logCombat(`<span class="text-purple-300">${sm.n}</span> 攻擊 <span class="${getMobColor(t.lv)}">${t.n}</span>，造成 ${dmg} 點傷害。`, 'player');
    }
    if(t.curHp <= 0 && idx !== -1) killMob(idx);
    else renderMobs();
}
function summonTick(sm, clearFn) {
    if(!sm) return;
    if(state.ticks >= sm.endTick || (sm.skId && (player.buffs[sm.skId] || 0) <= 0)) {
        logCombat(`<span class="text-purple-300">${sm.n}</span> 消失了。`, 'magic');
        clearFn(); return;
    }
    if(--sm.cd <= 0) { sm.cd = sm.interval; summonAttack(sm); }
    // 觸發技：每 5 秒(50 tick)判定一次，傷害 = roll(骰子)+魅力
    if(sm.proc) {
        if(--sm.proc.cdCur <= 0) {
            sm.proc.cdCur = sm.proc.cd;
            let t = getTarget();
            if(t && Math.random() < sm.proc.p) {
                let cha = player.d.cha || 0;
                let pd = summonElementDamage(sm.proc.dmgDice, sm.proc.ele, t, cha, Math.max(1, Math.floor(cha / 6)));   // 觸發技：(roll+魅力) x floor(魅力/6)
                t.curHp -= pd; t.justHit = sm.proc.ele !== 'none' ? sm.proc.ele : 'magic';
                logCombat(`${sm.n} 發動 ${sm.proc.name}，額外造成 ${pd} 點傷害。`, 'magic');
                let idx = mapState.mobs.findIndex(m => m && m.uid === t.uid);
                if(t.curHp <= 0 && idx !== -1) killMob(idx); else renderMobs();
            }
        }
    }
}

// 🔮 幻術士 立方（持續期間的週期性效果）：每 cube.iv ticks 觸發一次（dmg=全體傷害 / slow=全體緩速 / mrdown=目標魔抗下降 / mp=恢復MP）
function cubeTick() {
    if (player.dead || !state.running || !player.skills) return;
    player._cubeCd = player._cubeCd || {};
    player.skills.forEach(sid => {
        let sk = DB.skills[sid];
        if (!sk || !sk.cube || (player.buffs[sid] || 0) <= 0) return;
        if ((player._cubeCd[sid] = (player._cubeCd[sid] || sk.cube.iv) - 1) > 0) return;
        player._cubeCd[sid] = sk.cube.iv;
        let c = sk.cube;
        if (c.kind === 'mp') { player.mp = Math.min(player.mmp, (player.mp || 0) + (c.val || 5)); return; }   // 立方：和諧（自身回MP，不需目標）
        let live = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
        if (!live.length) return;
        if (c.kind === 'dmg') {
            let txt = [];
            live.forEach(m => { let d = Math.max(1, Math.floor(summonElementDamage(c.dice, c.ele || 'none', m, 0, 1) * illuLvMult(player))); m.curHp -= d; m.justHit = (c.ele && c.ele !== 'none') ? c.ele : 'magic'; mobWake(m); txt.push(d); });   // 🔮 立方傷害：幻術士等級加成 ×(1+等級/50)
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
function illuSummonTick() {
    if (player.dead || !state.running || player.mastery !== 'i_illusion') return;
    const MAP = {
        sk_illu_ogre:  { iv: 20, dice: [3, 20], div: 10, kind: 'melee', hitOff: 10, n: '歐吉' },
        sk_illu_lich:  { iv: 30, dice: [3, 20], div: 10, kind: 'magic', n: '巫妖' },
        sk_illu_golem: { iv: 10, dice: [2, 20], div: 5,  kind: 'melee', hitOff: 20, n: '鑽石高崙', iceLance: true }
    };
    player._illuCd = player._illuCd || {};
    let d = player.d;
    for (let sid in MAP) {
        if ((player.buffs[sid] || 0) <= 0) { player._illuCd[sid] = 0; continue; }
        let c = MAP[sid];
        if ((player._illuCd[sid] = (player._illuCd[sid] || c.iv) - 1) > 0) continue;
        player._illuCd[sid] = c.iv;
        let t = getTarget(); if (!t || t.curHp <= 0) continue;
        let base = roll(c.dice[0], c.dice[1]) + Math.floor((d.int || 0) / 5) * (1 + player.lv / c.div);
        let dmg;
        if (c.kind === 'magic') {
            let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr; if (t.st && (t.st.confuse > 0 || t.st.panic > 0)) effMr -= 10;
            dmg = Math.max(1, Math.floor(base * mrMult(Math.max(0, effMr))));   // 巫妖：必中、受MR
        } else {
            let hv = Math.max(1, Math.min(20, player.lv + c.hitOff - t.lv + (d.int || 0) + mobEffAC(t)));
            let r = roll(1, 20);
            if (!(r === 20 || (r !== 1 && hv >= r))) { logCombat(`<span class="text-purple-300 font-bold">【幻覺：${c.n}】</span> 的攻擊未命中。`, 'miss', 'summon'); continue; }
            dmg = Math.max(1, Math.floor(base) - (t.dr || 0));
        }
        dmg = Math.max(1, Math.floor(dmg * fragileMult(t) * illuLvMult(player)));   // 🔮 幻覺召喚物：幻術士等級加成 ×(1+等級/50)
        t.curHp -= dmg; t.justHit = (c.kind === 'magic') ? 'magic' : 'none'; mobWake(t);
        logCombat(`<span class="text-purple-300 font-bold">【幻覺：${c.n}】</span>對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dmg} 點傷害。`, 'magic', 'summon');
        let idx = mapState.mobs.findIndex(m => m && m.uid === t.uid);
        if (t.curHp <= 0) { if (idx !== -1) killMob(idx); continue; }
        if (c.iceLance && Math.random() < 0.10 && typeof witchIceLance === 'function') witchIceLance();   // 鑽石高崙：10% 冰矛圍籬
        renderMobs();
    }
}
// ---------- 手動施放技能 ----------
function manualCast(skId) {
    let sk = DB.skills[skId];
    if(!sk || !player.skills.includes(skId)) return;
    if(inAbsBarrier()) { logSys('絕對屏障期間與世界隔絕，無法行動。'); return; }   // 🛡️ 屏障中不得手動施放任何技能（含本技能再施放）
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
    if (cost > 0 && player.cls === 'elf' && hasMastery('e_magic') && sk.ele && sk.ele !== 'none' && sk.ele === player.elfEle) cost = Math.max(1, Math.ceil(cost * 0.7));   // 🏅 魔導精通：同屬性魔法消耗MP -30%
    if ((sk.n === '加速術' || sk.n === '強力加速術') && playerHasWindHelm()) cost = 0;   // 🏝️ 風之頭盔：加速術/強力加速術免MP（裝備或放在背包皆可）
    if(player.mp < cost) { logSys('MP 不足。'); return; }
    if(sk.hpCost && player.hp <= sk.hpCost) { logSys('HP 不足。'); return; }

    let _mpBeforeManual = player.mp;   // 🔮 魔力精通：手動施法亦回饋傭兵（manualCast 不經 castSkill 包裝，故此處自行依差額回饋）
    let t = getTarget();
    if(sk.mEff === 'teleport') {
        if(KING_ROOMS[mapState.current]) { logSys('<span class="text-red-400">軍王之室的封印之力壓制了傳送術，無法生效。</span>'); return; }
        if(prideTeleportBlocked()) { logSys('<span class="text-red-400">' + (state.riftRun ? '時空裂痕中無法使用傳送術。' : (state.prideRanked ? '排名挑戰中無法使用傳送術。' : '在此樓層需持有對應的傲慢之塔支配符才能使用傳送術。')) + '</span>'); return; }
        if(state.oblivion) { logSys('<span class="text-red-400">遺忘之島的迷霧壓制了傳送術，無法生效。</span>'); return; }
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
            if(idx !== -1) { mapState.mobs[idx] = null; renderMobs(); }
        } else logCombat('迷魅術失敗了。', 'miss');
    } else if(sk.mEff === 'barrier') {
        // 🛡️ 絕對屏障：施放後進入隔絕狀態（持續 sk.dur 秒；無敵且無法行動）
        player.buffs.sk_abs_barrier = sk.dur;
        logCombat(`<span class="font-bold" style="color:#7dd3fc;text-shadow:0 0 8px #38bdf8;">${sk.msg || '你感覺身體與這個世界隔絕了。'}</span>`, 'magic');
    }
    player.mp -= cost;
    if (player.mastery === 'i_mana' && player.mp < _mpBeforeManual) manaMasteryRefund(_mpBeforeManual - player.mp);   // 🔮 魔力精通：手動施法消耗MP→傭兵回饋10%
    player.manualCd[skId] = (sk.mEff === 'barrier') ? (sk.dur * 10 + 120) : 10;   // 🛡️ 絕對屏障：效果(dur秒)結束後再等 12 秒；其餘手動技 1 秒冷卻
    calcStats(); updateUI();
}

function rollDice(count, sides) { let s = 0; for(let i = 0; i < count; i++) s += roll(1, sides); return s; }
// 🔮 castSkill 包裝：魔力精通時，依本次施法實際消耗的 MP，回饋傭兵 10%（以 MP 差額判定，涵蓋所有施法分支；轉換類增MP不觸發）
function castSkill(skId) {
    if (!(player && player.mastery === 'i_mana')) return castSkillInner(skId);
    let _before = player.mp;
    let r = castSkillInner(skId);
    if (player.mp < _before) manaMasteryRefund(_before - player.mp);
    return r;
}
// 👑 魔法精通：免費額外施放「目前設定的攻擊技能」（_royalFreeCast → 不耗MP、不受攻擊冷卻；castSkill 內部仍會驗證等級/目標/MP，可施放才施放）
function royalMagicFreeCast() {
    let _sel = (typeof document !== 'undefined') ? document.getElementById('sel-atk-skill') : null;
    let _id = _sel ? _sel.value : '';
    if (!_id || !DB.skills[_id]) return;
    _royalFreeCast = true;
    try { castSkill(_id); } finally { _royalFreeCast = false; }
}
function castSkillInner(skId) {
    let sk = DB.skills[skId];
    if(!sk) return false;
    if(inAbsBarrier()) return false;   // 🛡️ 絕對屏障：無法施法（自動/手動皆擋）
    if(skId === 'sk_sunlight' && KING_ROOMS[mapState.current]) { logSys('<span class="text-red-400">此區域中，日光術無法生效。</span>'); return false; }   // 🔧 軍王之室／底比斯祭壇：日光術無效
    if(skId === 'sk_magic_shield' && (player.magicShieldCd || 0) > 0) return false;   // 魔法屏障抵擋技能後冷卻中，無法施放
    
    if(player.statuses.silence > 0) {   // 🔧 沉默：所有魔法皆無法施放（含魔法相消術——只有沉默/魔法封印能擋下相消術）
        logSys(`沉默狀態中，無法施展魔法。`);
        return false;
    }
    if(player.statuses.magicseal > 0) {   // 🔧 魔法封印（怪物技能「沉默」所施加）：同上，魔法相消術亦遭封印
        logSys(`魔法封印狀態中，無法施展技能。`);
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
        if (player.hp <= player.mhp * 0.5) return false;   // HP 不足以負擔代價
        let mult = (player.mmp > 0 ? player.mp / player.mmp : 0) * 10;   // 100%MP→×10、50%→×5
        player.hp = Math.max(1, Math.floor(player.hp - player.mhp * 0.5));
        player.mp = 0;
        let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
        let dice = wpn ? (_t.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;
        let base = getPhysicalDmg(dice, _t, wpn, null, true, false);    // forceHeavy：必中必重
        let raw = (base.dmg || 1) + mobHardSkin(_t);                     // 無視硬皮：加回硬皮扣減量
        let dmg = Math.max(1, Math.floor(raw * (1 + (player.d.meleeCritDmg || 0) / 100) * mult));   // 必定爆擊
        if (_t.race === '血盟') dmg *= 2;                                 // 對血盟敵人 x2
        _t.curHp -= dmg; _t.justHit = getWpnEle(player.eq.wpn, wpn); mobWake(_t);
        logCombat(`<span class="font-bold" style="color:#f0abfc;text-shadow:0 0 8px #d946ef;">【會心一擊】</span>對 <span class="${getMobColor(_t.lv)}">${_t.n}</span> 造成 ${dmg} 點致命傷害！`, 'player-crit');
        let _i = mapState.mobs.findIndex(m => m && m.uid === _t.uid);
        if (_t.curHp <= 0) { if (_i !== -1) killMob(_i); } else renderMobs();
        calcStats(); updateUI(); return true;
    }

    let cost = sk.mp ? player.d.getMpCost(sk.mp, sk.tier) : 0;
    if (cost > 0 && player.cls === 'elf' && hasMastery('e_magic') && sk.ele && sk.ele !== 'none' && sk.ele === player.elfEle) cost = Math.max(1, Math.ceil(cost * 0.7));   // 🏅 魔導精通：同屬性魔法消耗MP -30%
    if ((sk.n === '加速術' || sk.n === '強力加速術') && playerHasWindHelm()) cost = 0;   // 🏝️ 風之頭盔：加速術/強力加速術免MP（裝備或放在背包皆可）
    if (_echoFree) cost = 0;   // 🏅 迴響精通：連發那次不消耗 MP
    if (_royalFreeCast) cost = 0;   // 👑 魔法精通：免費額外施放選定攻擊技
    if (sk.throwAxe && hasMastery('k_dualaxe')) cost = 0;   // ⚔️ 雙斧精通：戰斧投擲不消耗 MP
    if (sk.callAllies && hasMastery('k_royal_pledge')) cost = Math.ceil(cost / 2);   // 👑 血盟精通：呼喚盟友消耗 MP 減半
    if(player.mp < cost) return false;
    if(sk.hpCost && player.hp <= sk.hpCost + 5) return false;  // HP 不足，拒絕施放
    if(sk.hpCost && sk.type !== 'convert') { let _hpSkEl = document.getElementById('set-hp-skill'); let _hpSkThr = _hpSkEl ? (parseFloat(_hpSkEl.value) || 0) : 0; if(_hpSkThr > 0 && (player.mhp || 0) > 0 && (player.hp / player.mhp * 100) < _hpSkThr) return false; }   // 🐉 消耗HP技能：HP 低於自訂門檻(%)時暫停自動施放（自動路徑專用；轉換魔法另有 set-hp-convert 門檻，故排除避免重複）
    if(sk.hpCost && sk.mp && sk.type !== 'convert') { let _mpSkEl = document.getElementById('set-mp-atk'); let _mpSkThr = _mpSkEl ? (parseFloat(_mpSkEl.value) || 0) : 0; if(_mpSkThr > 0 && (player.mmp || 0) > 0 && (player.mp / player.mmp * 100) < _mpSkThr) return false; }   // 🔧 同時消耗HP與MP的技能：MP 低於「攻擊技能MP門檻(set-mp-atk)」時亦暫停自動施放→與HP門檻(set-hp-skill)取「任一不符即停」（攻擊型本就在 autoCastSpells 先擋過此門檻，這裡再涵蓋增益型如覺醒/冥想/隱身/堅固防護）

    if(sk.type === 'convert') {
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
            calcStats(); updateUI(); return true;
        }
        // 心靈轉換 / 魂體轉換（輔助類）：消耗 HP 換取 MP，不佔用攻擊/治癒冷卻
        player.mp -= cost;
        player.hp = Math.max(1, player.hp - (sk.hpCost || 0));
        player.mp = Math.min(player.mmp, player.mp + sk.mpGain);
        logCombat(`施放 ${sk.n}，消耗 ${sk.hpCost} HP，恢復了 ${sk.mpGain} 點 MP。`, 'heal');
        calcStats(); updateUI(); return true;
    }

    // 🔧 淨化類（解毒術/聖潔之光/魔法相消術）：改用獨立冷卻 purifySk，不再與治癒魔法共用 healSk
    //（先前掛體力回復術時 healSk 被鎖至 HoT 結束，最長 15 秒無法自動解毒；淨化施放也會反過來吃掉治癒冷卻、延後補血）
    if(sk.type === 'heal' && !sk.hot && !sk.valDice) {
        if((player.cds.purifySk || 0) > 0) return false;
        // 僅在「有對應可解除的負面狀態」時才施放：解毒術→中毒；聖潔之光→石化/麻痺；魔法相消術→暈眩/冰凍/石化/中毒/麻痺
        let _purifyOk = (skId === 'sk_antidote') ? (player.statuses.poison > 0)
            : (skId === 'sk_holy_light') ? (player.statuses.stone > 0 || player.statuses.paralyze > 0)
            : (skId === 'sk_cancel') ? (player.statuses.freeze > 0 || player.statuses.stone > 0 || player.statuses.poison > 0 || player.statuses.paralyze > 0 || player.statuses.burn > 0 || player.statuses.scald > 0)
            : true;
        if(!_purifyOk) return false;   // 無對應負面狀態：不施放、不耗 MP
        player.mp -= cost;
        if(skId === 'sk_cancel') {
            player.statuses.freeze = 0; player.statuses.stone = 0; player.statuses.poison = 0; player.statuses.paralyze = 0; player.statuses.burn = 0; player.statuses.scald = 0;
        } else if(skId === 'sk_antidote') {
            player.statuses.poison = 0;
        } else if(skId === 'sk_holy_light') {
            player.statuses.stone = 0; player.statuses.paralyze = 0;
        }
        player.cds.purifySk = getAutoCastInterval();
        logCombat(`施放 ${sk.n}。${sk.msg || ''}`, 'heal');
        return true;
    }

    if(sk.type === 'heal' && player.cds.healSk <= 0) {
        // 體力回復術 / 生命的祝福：HoT 持續回復
        if(sk.hot) {
            if(player.hot && player.hot.ticksLeft > 0) return false;  // 已在持續中，不重複施放
            player.mp -= cost;
            player.hot = { skId: skId, valDice: sk.valDice, healDice: sk.healDice, healBase: sk.healBase, tier: sk.tier, interval: sk.hot.interval, ticksLeft: sk.hot.ticks,
                           cd: sk.hot.interval, skName: sk.n, msg: sk.msg };   // 🔧 skId：供「取消打勾立即結束」精準比對是哪個 HoT
            player.cds.healSk = getAutoCastInterval();  // 🔧 HoT 不再把共用治癒冷卻鎖到結束：重複施放已由上方 player.hot 守衛擋住；長鎖會餓死其他自動治癒（高級治癒術/生命之泉等）
            logCombat(`施放 ${sk.n}，開始持續回復 HP。`, 'heal');
            return true;
        }
        // 一般瞬間治癒
        player.mp -= cost;
        let _spCoefHeal = (1 + (3 * player.d.magicDmg / 16));   // 治癒：只套魔法傷害部分，不含階級係數
        let heal = sk.healDice
            ? Math.max(1, Math.floor((rollDice(sk.healDice[0], sk.healDice[1]) + (sk.healBase || 0)) * _spCoefHeal))   // (XdY + healBase) × 魔法傷害公式
            : Math.max(1, (sk.valBase || 0) + roll(sk.valDice[0], sk.valDice[1]) + player.d.magicDmg);
        heal = waterVitalHeal(heal);   // 🔧 水之元氣：下次恢復魔法治癒加倍
        player.hp = Math.min(player.mhp, player.hp + heal);
        player.cds.healSk = getAutoCastInterval();
        logCombat(`施放 ${sk.n}，恢復了 ${heal} 點 HP。${sk.msg || ''}`, 'heal');
        return true;
    }
    
    if(sk.type === 'atk' && (player.cds.atkSk <= 0 || _echoFree || _royalFreeCast)) {   // 🏅 迴響精通／👑 魔法精通：免費施放不受攻擊冷卻限制
        // 🐉 屠宰者：立即額外進行 3 次近距離一般攻擊；命中消耗目標弱點曝光（每層 +10 傷害）
        if (sk.slaughter) {
            let t = getTarget(); if (!t || t.curHp <= 0) return false;
            let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
            if (!wpn || wpn.isBow || wpn.ranged) return false;   // 需近距離武器
            player.mp -= cost; player.cds.atkSk = getAutoCastInterval();
            if (sk.hpCost) player.hp = Math.max(1, player.hp - effHpCost(sk));
            let layers = t.weakExpose || 0, bonus = layers > 0 ? 10 * layers : 0;
            let consume = layers > 0 && !hasMastery('k_weakness');   // 🏅 弱點精通：屠宰者不消耗弱點曝光
            let times = sk.hits || 3, total = 0, log = [], applied = false;
            for (let h = 0; h < times; h++) {
                if (t.curHp <= 0) break;
                let dice = t.s === 'L' ? wpn.dmgL : wpn.dmgS;
                let res = getPhysicalDmg(dice, t, wpn, null);
                if (!res.hit) { log.push('Miss'); continue; }
                let dmg = res.dmg;
                if (bonus > 0) { dmg += bonus; applied = true; }   // 🐉 弱點曝光：成功觸發後，一次施放的三刀「每一擊命中」都吃 +10/層（不再僅首擊）
                dmg = Math.floor(dmg * weakExposeDmgMult(t));   // 🏅 鎖刃精通：每層弱點曝光最終傷害+10%
                t.curHp -= dmg; t.justHit = getWpnEle(player.eq.wpn, wpn); total += dmg; mobWake(t);
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
            player.mp -= cost; player.cds.atkSk = getAutoCastInterval();
            if (sk.hpCost) player.hp = Math.max(1, player.hp - effHpCost(sk));
            let base = 50 + Math.max(0, (player.lv || 1) - 30);
            targets.forEach(m => { if (!m || m.curHp <= 0 || m._dead) return; let dmg = Math.max(1, Math.floor(base * fragileMult(m))); m.curHp -= dmg; m.justHit = 'magic'; mobWake(m); });
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
            player.mp -= cost; player.cds.atkSk = getAutoCastInterval();
            logCombat(`<span class="text-amber-300 font-bold">${sk.n}！</span>你號召盟友一同出擊。`, 'player');
            allies.forEach(a => { try { allyAttackOnce(a); } catch(e){} });
            return true;
        }
        // 🐉 控制系異常技（護衛毀滅/恐懼無助/驚悚死神）：固定機率施加自訂異常狀態（驚悚死神無視 MR，已以固定機率處理）
        if (sk.fixedStatus) {
            let t = getTarget(); if (!t || t.curHp <= 0) return false;
            let fs = sk.fixedStatus;
            if (sk.noRecastStatus && t.st && t.st[sk.noRecastStatus] > 0) return false;   // 已有狀態：不重複（不耗 HP/CD）
            player.mp -= cost; player.cds.atkSk = getAutoCastInterval();
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
            player.mp -= spend; player.cds.atkSk = getAutoCastInterval();
            if (sk.instakill && tryInstakill(t, sk.instakill, sk.n, mapState.targetIdx)) return true;   // 🦴 骷髏毀壞：先即死判定（起死回生式·vs不死非BOSS）；成功即死、不再造成傷害
            let dmg;
            if (sk.weaponDmg) {
                let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
                let dice = wpn ? (t.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;
                let enB = (wpn && player.eq.wpn) ? enhanceWpnBonus(player.eq.wpn.en).dmg : 0;   // 強化值加成
                if (sk.magScale) {
                    // 🔮 粉碎能量：以物理公式算底傷(武器傷害(目標大小)＋近/遠距離傷害(依武器)＋強化值)，整體乘魔法傷害加成(1+魔法傷害/16)，不計武器特效；🔮 為魔法技能→必定命中(無命中判定)、不受目標防禦(DR)與硬皮(物理減傷)減免
                    let _rng = !!(wpn && (wpn.isBow || wpn.ranged));
                    let _dmgB = _rng ? (player.d.rangedDmg || 0) : (player.d.meleeDmg || 0);
                    let _base = roll(1, dice) + _dmgB + enB + (sk.weaponFlat || 0);
                    dmg = Math.max(1, Math.floor(_base * (1 + (player.d.magicDmg || 0) / 16))) + (sk.flatBonus || 0);   // 🦴 骷髏毀壞：粉碎能量公式 + flatBonus(20) 固定傷害（粉碎能量無此欄位→+0）
                } else {
                    dmg = Math.max(1, roll(1, dice) + (player.d.meleeDmg || 0) + enB + (sk.weaponFlat || 0) - (t.dr || 0) - mobHardSkin(t));
                }
            } else {
                dmg = spend;   // 心靈破壞：基礎傷害＝消耗的 MP 量；再依魔法傷害加成(1+魔法傷害/16)放大，無屬性、受 MR
                let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr; if (t.st && (t.st.confuse > 0 || t.st.panic > 0)) effMr -= 10;
                dmg = Math.max(1, Math.floor(dmg * (1 + (player.d.magicDmg || 0) / 16) * mrMult(Math.max(0, effMr))));
            }
            dmg = Math.max(1, Math.floor(dmg * fragileMult(t) * illuLvMult(player) * wpnEnFinalMult(player.eq.wpn)));   // 🔮 幻術士等級加成 ×(1+等級/50)；🔧 武器強化 +11~+20 最終倍率（粉碎能量/骷髏毀壞/心靈破壞）
            t.curHp -= dmg; t.justHit = sk.weaponDmg ? getWpnEle(player.eq.wpn, player.eq.wpn ? DB.items[player.eq.wpn.id] : null) : 'magic'; mobWake(t);
            if (sk.mpDmgPct && t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;   // 🔧 心靈破壞（魔法）：受一次魔法傷害後解除魔抗減半（與其他魔法路徑一致）
            logCombat(`施放 <span style="font-weight:700;color:#7dd3fc">${sk.n}</span>，對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dmg} 點傷害。`, 'skill');
            if (t.curHp > 0 && sk.status) applyMobStatus(t, sk.status, sk.n);
            if (t.curHp <= 0) killMob(mapState.targetIdx); else renderMobs();
            return true;
        }
        if(sk.dmgType === 'physical') {
            let t = getTarget();
            if(!t) return false;
            if(sk.reqWpn === 'w2h' && (!player.eq.wpn || !DB.items[player.eq.wpn.id].w2h)) return false;
            // 三重矢：必須裝備弓
            if(sk.reqWpn === 'bow' && (!player.eq.wpn || !DB.items[player.eq.wpn.id].isBow)) return false;
            // 衝擊之暈：必須裝備弓以外的武器（需有武器，且非弓）
            if(sk.reqWpn === 'nonbow' && (!player.eq.wpn || DB.items[player.eq.wpn.id].isBow)) return false;
            let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
            let arrowData = null;

            // 👇 施放三重矢等技能時也要扣箭矢（🔧 改在扣 MP/設冷卻「之前」：沒箭時不再空耗 MP 與整段攻擊冷卻）
            if (wpn && wpn.isBow) {
                arrowData = consumeArrow();
                if (!arrowData) return false;
            }
            player.mp -= cost;
            player.cds.atkSk = getAutoCastInterval();

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
                let res = getPhysicalDmg(dice, t, wpn, arrowData);
                if(!res.hit) { hitsLog.push('Miss'); continue; }
                landed++;
                // 🔮 紅獅 5/5 已於 getPhysicalDmg 內套用（避免重複），此處不再乘
                // 遠距離物理技能命中滿血被動怪物，賦予 3 秒延遲（整段只觸發一次）
                if(!delayDone && t.curHp === t.hp && t.beh === '被動' && res.ranged) { t._delayTicks = 30; delayDone = true; }
                t.curHp -= res.dmg;
                t.justHit = getWpnEle(player.eq.wpn, wpn);
                totalDmg += res.dmg;
                let mark = (res.heavy && res.crit) ? '會心' : (res.crit ? '爆' : (res.heavy ? '重' : ''));
                hitsLog.push(res.dmg + (mark ? '(' + mark + ')' : ''));
                mobWake(t);
                if(sk.stun) applyMobStatus(t, { kind:'stun', pbase:sk.stun, dur:6, hitOff: (wpn && wpn.stunHitBonus && !wpn.isBow) ? Math.round(wpn.stunHitBonus / 5) : 0 }, sk.n);   // 🏛️ 真．冥皇執行劍：施展衝擊之暈時暈眩命中率 +20%（hitOff +4，d20 每點≈5%）
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
            let targets = sk.target === 'all' ? mapState.mobs.filter(m => m) : [getTarget()].filter(m => m);
            if(targets.length === 0) return false;

            // 防止對「已具有該異常狀態」的目標重複施放異常：
            //   僅限「純異常技」（無傷害骰 dmgDice / multiDmg）；可造成傷害又附加異常的技能（如冰矛圍籬）不在此限。
            //   單體：目標已有該狀態即跳過；範圍(target:'all')：所有存活目標都已有該狀態才跳過。跳過時不消耗 MP / 冷卻。
            if(sk.status && !sk.multiDmg && !sk.dmgDice) {
                let live = targets.filter(m => m && m.curHp > 0);
                if(live.length > 0 && live.every(m => m.st && m.st[sk.status.kind] > 0)) return false;
            }
            
            player.mp -= cost;
            player.cds.atkSk = getAutoCastInterval();
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
    
    // 取得該技能的魔法階級，若無則預設為 1
    let skillTier = sk.tier || 1; 
    // 套用新的魔攻係數 (SP Coefficient) 公式
    let spCoef = (1 + (3 * player.d.magicDmg / 16)) * (1 + (skillTier / 3));
    // 法師專屬：一般攻擊魔法（排除精靈魔法 sk_elf_*、裝備授予技能）最終傷害 ×(1.5 + 法術階級/20)；僅影響傷害，不影響命中/治癒/回血
    let mageDmgMult = (player.cls === 'mage' && !__granted && !skId.startsWith('sk_elf_')) ? (1.5 + skillTier / 20) : 1.0;
    
    let magicCritMult = isCrit ? (1 + player.d.magicCritDmg / 100) : 1.0;

                dmgArray.forEach((diceArr, idx) => {
                    let baseMagicDmg = roll(diceArr[0], diceArr[1]);
                    let core = baseMagicDmg * spCoef * magicCritMult;

                    let extraMagicDmg = 0;
                    let fixed = 0;
                    if(idx === dmgArray.length - 1) {
                        extraMagicDmg = (sk.dmgBase || 0) + player.d.extraMp;
                        if(sk.ele) {
                            if(isElementCounter(sk.ele, t.e)) fixed += 6;
                        }
                    }

                    let d = Math.floor((core + extraMagicDmg) * mrFactor) - (t.dr || 0);
                    d = Math.max(1, d) + fixed;
                    d = Math.floor(d * mageDmgMult);   // 法師一般攻擊魔法：最終傷害再乘上 (1.5 + 階級/20)
                    if (player._setRedLion5) d = Math.floor(d * 1.2);   // 🔮 紅獅 5/5：攻擊技能最終傷害 +20%
                    if (player.cls === 'elf' && hasMastery('e_magic') && sk.ele && sk.ele !== 'none' && sk.ele === player.elfEle) d = Math.floor(d * 2);   // 🏅 魔導精通：同屬性傷害魔法 ×2
                    d = Math.max(1, Math.floor(d * fragileMult(t) * illuLvMult(player)));    // 🔮 脆弱（白鳥5）；🔮 幻術士等級加成 ×(1+等級/50)（幻想/混亂）
                    d = Math.max(1, Math.floor(d * wpnEnFinalMult(player.eq.wpn)));   // 🔧 武器強化 +11~+20：最終傷害倍率（也影響玩家施放的傷害魔法；物理技能走 getPhysicalDmg 已含、不在此處）
                    totalDmg += d;
                    hitsLog.push(d);
                });
                
                if(dmgArray.length > 0) {
                    t.curHp -= totalDmg;
                    _burstDmg += totalDmg;   // 🔧 魔爆累計
                    t.justHit = (sk.ele && sk.ele !== 'none') ? sk.ele : 'magic';
                    let multiText = hitsLog.length > 1 ? `[${hitsLog.join(", ")}] (總和: ${totalDmg})` : `${totalDmg}`;
                    if (isCrit) multiText += " (爆擊!)";
                    totalDmgText.push(`對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 <span class="${isCrit?'text-yellow-500 font-bold':'text-cyan-300'}">${multiText} 點傷害</span>`);
                } else {
                    // 純狀態/秒殺類魔法（無傷害骰）：不造成直接傷害，只施加效果
                    t.justHit = (sk.ele && sk.ele !== 'none') ? sk.ele : 'magic';
                    totalDmgText.push(`對 <span class="${getMobColor(t.lv)}">${t.n}</span> 施放`);
                }
                mobWake(t);
                if(t.st && t.st.mrhalf > 0) t.st.mrhalf = 0; // 受一次魔法傷害後解除魔抗減半
                if(sk.lifesteal) { let h = Math.min(totalDmg, player.mhp - player.hp); if(h > 0){ player.hp += h; logCombat(`你吸取了 ${h} 點生命。`, 'heal'); } }
                if(sk.freeze) applyMobStatus(t, { kind:'freeze', pbase:sk.freeze, dur:6 }, sk.n);
                if(sk.status) applyMobStatus(t, sk.status, sk.n);
                if(t.curHp > 0 && sk.instakill) tryInstakill(t, sk.instakill, sk.n, mapState.mobs.findIndex(m => m && m.uid === t.uid));
            });
            
            logCombat(`施放 <span style="font-weight:700;color:#7dd3fc">${sk.n}</span> -> ${totalDmgText.join(" | ")}`, 'skill');
            
            targets.forEach((t) => {
                if(t.curHp <= 0) {
                    let realIdx = mapState.mobs.findIndex(m => m && m.uid === t.uid);
                    if(realIdx !== -1) killMob(realIdx);
                }
            });
            // 🔧 神官魔杖·魔爆：施放傷害魔法時依機率(單體 智力/100、全體 智力/60)對全場額外造成本次傷害30%的無屬性傷害
            {
                let _bw = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
                if (_bw && _bw.eff === 'magicburst' && _burstDmg > 0 && !player.classicMode) {   // 🎮 經典模式：停用魔爆
                    let _aoe = (sk.target === 'all') || (targets.length > 1);
                    if (Math.random() < (player.d.int || 0) / (_aoe ? 60 : 100)) {
                        let _ex = Math.max(1, Math.floor(_burstDmg * 0.3));
                        let _live = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
                        if (_live.length) {
                            logCombat(`<span class="font-bold" style="color:#f0abfc;text-shadow:0 0 6px #c026d3;">【魔爆】</span>魔力過載爆炸，波及全場！`, 'player-special');
                            _live.forEach(m => {
                                let _d = Math.max(1, Math.floor(_ex * fragileMult(m)));
                                m.curHp -= _d; m.justHit = 'magic'; mobWake(m);
                                logCombat(`魔爆波及 <span class="${getMobColor(m.lv)}">${m.n}</span>，造成 ${_d} 點無屬性傷害。`, 'player');
                                if (m.curHp <= 0) { let ri = mapState.mobs.findIndex(x => x && x.uid === m.uid); if (ri !== -1) killMob(ri); }
                            });
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
        if(sk.summon) { setupSummon(skId, sk); player.mp -= cost; calcStats(); return true; }
        // 淨化類：無對應可解除的負面狀態則不施放
        if(skId === 'sk_antidote' || skId === 'sk_holy_light' || skId === 'sk_cancel') {
            let _purifyOk = (skId === 'sk_antidote') ? (player.statuses.poison > 0)
                : (skId === 'sk_holy_light') ? (player.statuses.stone > 0 || player.statuses.paralyze > 0)
                : (player.statuses.freeze > 0 || player.statuses.stone > 0 || player.statuses.poison > 0 || player.statuses.paralyze > 0 || player.statuses.burn > 0 || player.statuses.scald > 0);
            if(!_purifyOk) return false;
        }
        if(skId === 'sk_cancel') {
            player.statuses.freeze = 0; player.statuses.stone = 0; player.statuses.poison = 0; player.statuses.paralyze = 0; player.statuses.burn = 0; player.statuses.scald = 0;
        } else if(skId === 'sk_antidote') {
            player.statuses.poison = 0;
        } else if(skId === 'sk_holy_light') {
            player.statuses.stone = 0; player.statuses.paralyze = 0;
        } else {
            player.buffs[skId] = sk.dur;
            if(sk.awaken && player.mastery !== 'k_awaken') { ['sk_dragon_awaken_antares','sk_dragon_awaken_falion','sk_dragon_awaken_baraka'].forEach(_ak => { if(_ak !== skId) player.buffs[_ak] = 0; }); }   // 🐉 覺醒互斥：非覺醒精通時同時只能維持一種覺醒
        }
        if(sk.haste) player.buffs.haste = Math.max(player.buffs.haste || 0, sk.dur); // 加速術 → 套用 haste 效果
        player.mp -= cost;
        if(sk.hpCost) player.hp = Math.max(1, player.hp - effHpCost(sk));  // 消耗 HP（冥想術/堅固防護/隱身術；🐉 龍血精通減半）
        logCombat(`施放 ${sk.n}。${sk.msg || ''}`, 'magic');
        calcStats();
        return true;
    }
    return false;
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
    
    const buffs = [
        { id: 'set-haste', pot: 'potion_haste', b: 'haste', buyId: 'set-auto-buy-haste' },
        { id: 'set-brave', pot: 'potion_brave', b: 'brave', req: 'knight,dragon,warrior,royal', buyId: 'set-auto-buy-brave' },
        { id: 'set-blue', pot: 'potion_blue', b: 'blue', buyId: 'set-auto-buy-blue' },
        { id: 'set-cautious', pot: 'new_item_140', b: 'cautious', req: 'mage,illusion', buyId: 'set-auto-buy-cautious' },
        { id: 'set-elfcookie', pot: 'new_item_139', b: 'elfcookie', req: 'elf', buyId: 'set-auto-buy-elfcookie' },
        { id: 'set-poly', pot: 'scroll_poly', b: 'poly', buyId: 'set-auto-buy-poly' },
        { id: 'set-magicbarrier', pot: 'scroll_magicbarrier', b: 'sk_magic_shield' }
    ];
    buffs.forEach(cfg => {
        if (cfg.b === 'haste' && player._equipHaste) return;   // 裝備常駐加速（伊娃之盾）：不重複喝加速藥水
        if (document.getElementById(cfg.id).checked && (player.buffs[cfg.b] || 0) <= 0) {
            if(cfg.req && !cfg.req.split(',').includes(player.cls)) return;   // 🎮 支援逗號多職業（勇敢藥水 knight,dragon）
            let item = player.inv.find(i => i.id === cfg.pot);
            if(item) {
                 useItem(item.uid, true);
            } else if (document.getElementById(cfg.buyId) && document.getElementById(cfg.buyId).checked) {
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
        if (tChk && tChk.checked && mapState.mobs.some(m => m && m.boss && !m.noAutoTeleport) && !isSiegeArea(mapState.current) && !PURE_BOSS_MAPS.includes(mapState.current) && !state.prideClimb && !state.oblivion && !state.riftRun && (state._manualTpUntil == null || (state.ticks || 0) >= state._manualTpUntil)) {   // 🕒 手動瞬移後 5 秒內不自動瞬移/自動購買；攻城區與純BOSS房(安塔瑞斯/法利昂/巴拉卡斯)：BOSS為目標，不自動瞬移；🔧 卡瑞(noAutoTeleport)不觸發自動瞬移；🗼 傲慢之塔攀登中不自動瞬移；🌀 時空裂痕不自動瞬移逃離頭目
            let item = player.inv.find(i => i.id === 'scroll_teleport');
            if (!item) {
                let buyChk = document.getElementById('set-auto-buy-teleport');
                let _tpCost = shopPrice(DB.items.scroll_teleport.p);   // 攻城獲勝 8 折亦適用
                if (buyChk && buyChk.checked && player.gold >= _tpCost) {
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
            if(sid === 'sk_sunlight' && KING_ROOMS[mapState.current]) return;   // 🔧 軍王之室／底比斯祭壇：日光術無效，跳過自動施放（否則每 tick 被擋下並狂洗系統日誌）
            if(sk.darkStealth && player._darkStealthCd > state.ticks) return;   // 🔧 暗隱術：冷卻中不自動施放（須身上無暗隱術且冷卻結束才再施放）
            if(sk.awaken && player.mastery !== 'k_awaken' && ['sk_dragon_awaken_antares','sk_dragon_awaken_falion','sk_dragon_awaken_baraka'].some(a => (player.buffs[a]||0) > 0)) return;   // 🐉 覺醒互斥：已有一種覺醒生效時不自動施放其他覺醒（避免互相清除而反覆耗HP/MP）；覺醒精通可同時三種
            if(sk.cube && mapState.current.startsWith('town_')) return;   // 🔮 立方：安全區(村莊)不自動施放，進入狩獵區(非 town_)才展開
            if(sk.stormInterval && mapState.current.startsWith('town_')) return;   // 🌨️🔥 火牢/冰雪颶風等持續傷害增益(STORM_BUFF_SKILLS)：安全區(村莊)無敵人→不自動施放(免空耗 MP/洗版)，與立方/轉換魔法一致
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

    // 轉換魔法（妖精/法師下拉，單選）：每 3 秒一次；安全區(村莊)暫停；MP 達 90% 以上不轉換；
    // 僅在 HP 高於玩家自訂門檻時施放（避免把 HP 轉到危險值；單選天然避免兩個同時使用）
    // 魔力奪取：另需場上有存活目標（castSkill 內判定，無目標不施放、不耗 HP）
    if((player.d.loadTier||0) < 2 && state.ticks % 30 === 0 && !mapState.current.startsWith('town_')) {
        let convSel = document.getElementById('sel-convert-skill');
        let convId = convSel ? convSel.value : '';
        if(convId && player.skills.includes(convId) && DB.skills[convId] && DB.skills[convId].type === 'convert') {
            let thEl = document.getElementById('set-hp-convert');
            let th = thEl ? (parseFloat(thEl.value) || 0) : 0;
            if(hpPct > th && player.mp < player.mmp * 0.9) castSkill(convId);
        }
    }
}

// 🔧 行動不能（石化/冰凍/暈眩/麻痺/沉睡）期間的自救：仍嘗試自動施放「魔法相消術／聖潔之光」解除負面狀態。
//    沉默/魔法封印中無法施展魔法（靜默跳過、不洗版）；其餘條件（勾選/負重/MP/冷卻/有可解狀態）由 castSkill 內部把關。
//    相消術涵蓋石化/麻痺/冰凍等，啟用時優先且足夠（與 autoActions「相消已涵蓋解毒/聖潔之光則跳過」一致）；
//    未啟用相消術時，聖潔之光（解石化/麻痺）亦走此自救路徑。解毒術不納入：中毒不會行動不能、平時即可自動施放。
function tryEmergencyDispel() {
    if(!state.running || player.dead) return;
    if((player.d.loadTier||0) >= 2) return;                                          // 負重 82%+：暫停所有技能自動施放（與 autoCastSpells/autoActions 一致）
    if(player.statuses.silence > 0 || player.statuses.magicseal > 0) return;         // 沉默/魔法封印：無法施展魔法（靜默跳過，避免洗版）
    let cancelChk = document.getElementById('auto-sk-sk_cancel');
    if(cancelChk && cancelChk.checked && player.skills.includes('sk_cancel')) { castSkill('sk_cancel'); return; }   // 魔法相消術已涵蓋石化/麻痺/冰凍等
    let holyChk = document.getElementById('auto-sk-sk_holy_light');
    if(holyChk && holyChk.checked && player.skills.includes('sk_holy_light')) castSkill('sk_holy_light');           // 聖潔之光：解石化/麻痺；castSkill 內 _purifyOk 守衛僅在有可解狀態時施放
}

// 自動施放攻擊/治癒法術的基礎間隔：2 秒(20 tick)，並受攻速倍率(加速/勇敢藥水/精靈餅乾/變身)影響
function getAutoCastInterval() {
    return Math.max(1, Math.round(20 * (player.d.spdMult || 1)));
}

// 自動施放攻擊/治癒法術：每個 tick 呼叫一次，實際施放間隔由 player.cds.atkSk / healSk 控制
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
    if(atkSk && mpPct >= atkThr && atkTarget) {
        // 標籤型即死技能（起死回生術→不死、釋放元素→元素）：
        //   僅在「目標具備對應標籤且非 BOSS」時才自動施放，避免對多羅等無效目標空放、浪費 MP 與冷卻。
        let skDef = DB.skills[atkSk];
        let ikTag = (skDef && skDef.instakill && skDef.instakill.tag) || null;   // 即死技 tag：需非 BOSS 且具該 tag
        let needTag = (skDef && skDef.tagReq) || null;   // 🔮 一般 tag 需求（骷髏毀壞=不死；BOSS 亦可，僅暈眩對 BOSS 無效）
        let _noRecast = skDef && skDef.noRecastStatus && atkTarget.st && atkTarget.st[skDef.noRecastStatus] > 0;   // 🔮 混亂/恐慌：目標已有該狀態則不重複施放
        let _tagOk = (!ikTag || (!atkTarget.boss && mobHasTag(atkTarget, ikTag))) && (!needTag || mobHasTag(atkTarget, needTag));
        if(!_noRecast && _tagOk) castSkill(atkSk);
    }

    let healSk = document.getElementById('sel-heal-skill').value;
    let healThr = parseInt(document.getElementById('set-mp-heal').value) || 0;
    // 治癒魔法改為「HP <= X%」觸發（與恢復生命藥水相同機制）；MP 是否足夠由 castSkill 內部判斷
    if(healSk && hpPct <= healThr) castSkill(healSk);
}

// 詞綴抽取（新制）：掉落/製作/潘朵拉/血盟 等管道只會隨機產生「祝福的」(bless) 1%；不再有單/雙/三詞綴或屬性/遠古的隨機掉落。
// 🔧 詞綴抽取：怪物掉落 / 製作 / 潘朵拉 / 血盟怪掉落 等管道「只可能獲得 祝福的」詞綴（1%）。
//    屬性詞綴與遠古系詞綴不再由這些管道隨機產生（改由象牙塔『碧恩』的賦予祝福卷軸取得）。
//    🔮 席琳的世界擊殺掉落仍套用 ×3（祝福機率 3%）。
function rollAffixesNew() {
    let m = _sherineLootCtx ? (_sherineLootCtx.mad ? 5 : 3) : 1;   // 🔮 席琳的世界 祝福機率 ×3（瘋狂×5）
    return { attr: false, bless: (Math.random() < 0.01 * m), anc: false };
}
function rollAffixesOld() {
    let m = _sherineLootCtx ? (_sherineLootCtx.mad ? 5 : 3) : 1;   // 🔮 席琳的世界 祝福機率 ×3（瘋狂×5）
    return { attr: false, bless: (Math.random() < 0.01 * m), anc: false };
}