function newMobStatus() {
    return { freeze:0, stun:0, stone:0, sleep:0, poison:0, poisonTick:30, poisonDmg:0, poisonStacks:0, poisonUnit:0,
             blind:0, blindVal:0, weaken:0, disease:0, vacuum:0, broken:0, slow:0, mrhalf:0, magicseal:0, armorbreak:0, confuse:0, panic:0, guardbreak:0, terror:0, doom:0 };
}
function mobEffAC(m) { return (m.ac || 0) + ((m.st && m.st.disease > 0) ? 8 : 0) + ((m.st && (m.st.confuse > 0 || m.st.panic > 0)) ? 5 : 0) + ((m.st && m.st.guardbreak > 0) ? 10 : 0) + ((m.weakExpose > 0 && hasMastery('k_weakness')) ? 3 * Math.min(5, m.weakExpose) : 0) - ((m._acGuardEnd > state.ticks) ? (m._acGuardVal || 0) : 0); }   // 🔮 混亂/恐慌：AC+5；🐉 護衛毀滅：AC+10；🐉 弱點精通：每層弱點曝光 AC+3（更易被命中）   // 🗼 鋼鐵防護：暫時降低 AC
function mobActDisabled(m) {
    let s = m.st; if(!s) return false;
    return s.freeze > 0 || s.stun > 0 || s.stone > 0 || s.sleep > 0;
}
// 怪物受到任何傷害時觸發（解除沉睡）
function mobWake(m) {
    if(m.st && m.st.sleep > 0) { m.st.sleep = 0; logCombat(`<span class="${getMobColor(m.lv)}">${m.n}</span> 從沉睡中醒來。`, 'magic'); }
}
const STATUS_NAME = { freeze:'冰凍', stun:'暈眩', stone:'石化', sleep:'沉睡', poison:'中毒',
    blind:'目盲', weaken:'弱化', disease:'疾病', vacuum:'真空', broken:'損壞', slow:'緩速', mrhalf:'魔抗減半', magicseal:'魔法封印', armorbreak:'破甲', fragile:'脆弱', confuse:'混亂', panic:'恐慌', guardbreak:'護衛毀滅', terror:'恐懼', doom:'死神' };   // 🔮 脆弱（白鳥5）：受所有傷害+20%；🐉 護衛毀滅/恐懼/死神
// 特定狀態的專屬套用訊息（接於怪物名稱後）
const STATUS_MSG = { magicseal:'的魔法遭到封印了。' };
// 對 BOSS 無效的行動限制類狀態
const BOSS_IMMUNE = ['freeze','stun','stone','sleep'];
// 異常魔法命中判定（玩家對怪物，共用）：命中值 = 玩家等級 + 魔法命中 − (怪等級−10) − 怪MR/10，
// clamp[0,20]，擲 1d20（與一般攻擊相同：擲20必中、擲1必失、其餘 命中值≥骰值 即命中），命中率 5%~95%。
// 異常魔法命中（玩家對怪物）：d20 機制，命中值 hv 上限預設 20（最高 95%）。
// 🔧 傳入 maxHv 可降低成功率上限：maxHv=12 → 最高 60%（起死回生術、迷魅術用）。自然20必中、自然1必失。
function abnormalMagicHit(m, maxHv, hitOff) {
    let hv = player.lv + (player.d.magicHit || 0) + (hitOff || 0) - ((m.lv || 0) - 10) - ((m.mr || 0) / 10);
    hv = Math.max(0, Math.min(maxHv || 20, hv));
    let r = roll(1, 20);
    return (r === 20) || (r !== 1 && hv >= r);
}
function applyMobStatus(m, st, skillName) {
    if(!m.st) m.st = newMobStatus();
    if(BOSS_IMMUNE.includes(st.kind) && m.boss) return;
    // 異常狀態魔法命中（玩家對怪物）：見 abnormalMagicHit；st.hitOff＝命中加值（🏛️ 真．冥皇執行劍 衝擊之暈 +4≈命中率+20%）
    // ⚡ st.force：跳過魔抗命中判定，由呼叫端自行擲固定機率（雷神之鎚電光衝擊／伊娃的責罵水之矛的 5% 固定附加）；BOSS 免疫仍上方先擋
    if(!st.force && !abnormalMagicHit(m, undefined, st.hitOff)) {
        logCombat(`<span class="${getMobColor(m.lv)}">${m.n}</span> 抵抗了${skillName || '異常狀態'}。`, 'miss');
        return;
    }
    // 持續時間：支援固定 dur(秒) 或隨機 durRand:[最小,最大]（秒）
    let durSec = st.durRand ? roll(st.durRand[0], st.durRand[1]) : (st.dur || 6);
    let dur = durSec * 10;
    let k = st.kind;
    if(k === 'poison') {
        m.st.poison = dur; m.st.poisonTick = (st.tick || 3) * 10;
        m.st.poisonDmg = Math.max(1, Math.floor(roll(st.dmg[0], st.dmg[1]) * wpnEnFinalMult(player && player.eq && player.eq.wpn)));   // 🔧 武器強化 +1~+20 最終倍率：毒咒等技能固定 DoT 也吃（applyMobStatus 內部 player＝施法者：玩家或暫換身的傭兵）
        m.st.poisonStacks = 1; m.st.poisonUnit = m.st.poisonDmg;   // 技能類中毒：單層（不疊加），仍顯示層數符號
    } else if(k === 'blind') {
        m.st.blind = dur; m.st.blindVal = st.hit || 4;
    } else if(k in m.st) {
        m.st[k] = dur;
    }
    
    // 👇 統一將狀態改變改寫為「施展 XXX，對 OOO 造成 XX 狀態」（🔧 中毒不輸出「敵人中毒」套用訊息，只保留每秒中毒傷害日誌）
    if(k !== 'poison') {
        let prefix = skillName ? `施展 ${skillName}，` : ``;
        if(STATUS_MSG[k]) {
            logCombat(`${prefix}<span class="${getMobColor(m.lv)}">${m.n}</span> ${STATUS_MSG[k]}`, 'magic');
        } else {
            logCombat(`${prefix}對 <span class="${getMobColor(m.lv)}">${m.n}</span> 造成 ${STATUS_NAME[k]||k} 狀態。`, 'magic');
        }
    }
}
function mobHasTag(m, tag) {
    if(tag === 'undead') return !!m.un;
    // 元素生物標籤：在怪物定義中加入「elem: true」即視為元素生物，
    //   會被「釋放元素(sk_elf_release)」依機率即死。範例見 salamander(火蜥蜴)。
    if(tag === 'element') return !!m.elem;
    if(tag === '硬皮') return !!m.hard;   // 🔧 硬皮：額外物理減傷（魔法不減），會被攻擊消磨、每10秒再生
    return false;
}

// ===== 🔧 硬皮系統 =====
// 硬皮值＝額外的「物理」傷害減免（魔法傷害不減）。最大值：一般怪 等級÷2、頭目 等級×1、四大龍(法利昂/安塔瑞斯/巴拉卡斯/林德拜爾) 等級×2、
// 城門 = 玩家等級、守護塔 = 玩家等級÷2；席琳的世界 ×1（不再加成）。
// 消磨：玩家/傭兵一般攻擊命中固定 -1（與下列各項疊加）；單手鈍器鈍擊 -1、單手鈍器重擊 -5、
//       雙手鈍器/屠龍劍重擊 -20、其餘一般攻擊重擊 -2、粉碎武器未重擊命中 -1；
//       傭兵以外的召喚物重擊不消磨。每 10 秒恢復 3% 最大值。
function initHardSkin(m) {
    if (!m || !m.hard) return;
    let mx;
    if (m.n === '肯特城門' || m.n === '風木城門') mx = Math.max(1, player.lv);              // 🔧 城門：硬皮 = 玩家等級
    else if (m.n === '肯特守護塔' || m.n === '風木守護塔') mx = Math.max(1, Math.floor(player.lv / 2));   // 🔧 守護塔：硬皮 = 玩家等級÷2
    else {
        let per = ['安塔瑞斯', '法利昂', '巴拉卡斯', '林德拜爾'].includes(m.n) ? 2 : (m.boss ? 1 : 0.5);   // 四大龍×2、其餘頭目×1、一般怪×0.5
        mx = Math.max(1, Math.floor((m.lv || 1) * per));   // 席琳的世界 ×1（不再加成；攻城區不觸發 _sherine，城門/守護塔不受影響）
    }
    m.hardSkinMax = mx;
    m.hardSkin = mx;
}
function mobHardSkin(m) { return (m && m.hardSkin > 0) ? m.hardSkin : 0; }   // 物理減傷量（供傷害公式扣減）
// 依武器特效與重擊/鈍擊消磨硬皮值；wpnId 為攻擊者（玩家或傭兵）的武器 id
function wearHardSkin(target, wpnId, heavy, bluntProc, basic, suppressEff) {
    if (!target || !(target.hardSkin > 0)) return;
    let dec = 0;
    let _wd = wpnId ? DB.items[wpnId] : null;
    let _isCrush = !suppressEff && !!(_wd && _wd.eff === 'crush');   // 🎮 經典模式：停用重擊(粉碎)
    // 🔧 2026-06 取消「重擊(heavy)額外削減硬皮值」(原 -20粉碎/屠龍、-5單手鈍器、-2通用 全移除)；魔擊以 heavy 呼叫→隨之不再削減→魔法與共鳴皆不削減硬皮值
    if (_isCrush) dec += 1;   // 🔧 粉碎武器：一般攻擊命中磨 1 硬皮值（保留·非重擊額外）
    if (bluntProc) dec += 1;   // 單手鈍器鈍擊
    if (basic) dec += 1;   // 🔧 玩家/傭兵一般攻擊命中：固定再磨 1 硬皮值（與上述重擊/粉碎/鈍擊削減疊加）
    if (_wd && _wd.hardWear) dec += _wd.hardWear;   // 🔧 大馬士革鋼爪/雙刀：一般攻擊命中額外削減硬皮值
    if (dec > 0) target.hardSkin = Math.max(0, target.hardSkin - dec);
}
function tryInstakill(m, ik, skillName, idx, deferKill) {
    if(m.boss) return false;

    // 👇 加上 ik.tag 的存在判定：只有在規定了特定 tag 時，才去檢查怪物有沒有該 tag
    if(ik.tag && !mobHasTag(m, ik.tag)) return false;

    // 固定機率即死（骰子匕首 ik.p=0.01 → 1%）；技能型即死(無 ik.p)才用異常魔法命中公式
    // 🔧 ik.cap 限制成功率上限（起死回生術 cap=12 → 最高 60%）；未設定則維持 5%~95%
    if(typeof ik.p === 'number') { if(Math.random() >= ik.p) return false; }
    else if(!abnormalMagicHit(m, ik.cap)) return false;

    logCombat(`${skillName} 使 <span class="${getMobColor(m.lv)}">${m.n}</span> 立即死亡！`, 'player-special');
    m.curHp = 0;
    // 🔧 deferKill：傭兵即死技在「player 暫時換身成傭兵」的視窗內呼叫；此時不可結算 killMob
    //    （否則經驗/金幣/掉落會加到傭兵身上隨即遺失、且 killMob 結尾的 updateUI 會閃現傭兵資料）。
    //    改由呼叫端在「還原 player 之後」再對該怪 killMob，確保結算與 UI 都歸真實玩家。
    if(!deferKill) killMob(idx);
    return true;
}
// 出血：對怪物施加一層出血（每秒造成 hitDmg 的 20%，持續 8 秒）。預設最多 5 層；🔧 出血精通：匕首/矛/雙刀可達 10 層、每秒總傷害 ×(1+0.1×層數)；已滿時新層取代最舊層。
function applyBleed(m, hitDmg, maxLayers, masteryBoost) {
    if(!m.bleeds) m.bleeds = [];
    let cap = Math.max(maxLayers || 5, m._bleedCap || 0);   // 🔧 多來源共用同一出血層陣列：取「本段出血曾出現過的最高上限」，避免低上限來源(如玩家匕首5層)把高上限來源(黑妖傭兵出血精通10層)的層數砍掉
    m._bleedCap = cap;
    let dps = Math.max(1, Math.floor(hitDmg * 0.20));
    while(m.bleeds.length >= cap) m.bleeds.shift();      // 超過上限：移除最舊的，由新層取代
    m.bleeds.push({ dmg: dps, ticksLeft: 80 });          // 8 秒 = 80 ticks
    if(masteryBoost) m._bleedMastery = true;             // 🔧 出血精通：此怪出血每秒總傷害 ×(1+0.1×層數)（10 層 = +100%）
    // 🔧 不再輸出「敵人陷入出血」套用訊息（依需求只保留每秒出血傷害日誌）
}
// 每 tick 處理怪物身上的狀態（倒數、中毒 DoT）。回傳 true 代表該怪物已死亡。
function processMobStatusTick(m, i) {
    if(!m.st) { m.st = newMobStatus(); return false; }
    let s = m.st;
    ['freeze','stun','stone','sleep','blind','weaken','disease','vacuum','broken','slow','mrhalf','magicseal','fragile','armorbreak','confuse','panic','guardbreak','terror','doom'].forEach(k => {   // 🔮 含脆弱、🔧 含破壞盔甲、🔮 含混亂/恐慌、🐉 含護衛毀滅/恐懼/死神
        if(s[k] > 0) s[k]--;
    });
    if(s.blind <= 0) s.blindVal = 0;
    if(s.poison > 0) {
        s.poison--;
        if(state.ticks % (s.poisonTick || 30) === 0) {
            m.curHp -= s.poisonDmg; m.justHit = 'magic'; mobWake(m); _dps.player += s.poisonDmg;   // 🎯 DPS：中毒 DoT 歸玩家（一般情況毒/血由玩家附加；傭兵附加之 DoT 亦計入玩家為已知簡化）
            logCombat(`<span class="${getMobColor(m.lv)}">${m.n}</span> 受到中毒傷害 ${s.poisonDmg} 點。`, 'dot');   // 🟢 中毒 DoT→綠色持續傷害分類
            if(m.curHp <= 0) { killMob(i); return true; }
        }
        if(s.poison <= 0) { s.poisonStacks = 0; s.poisonUnit = 0; s.poisonDmg = 0; }   // 中毒結束：清空層數
    }
    // 出血 DoT：可疊 5 層，每層各自獨立計時，每秒(10 ticks)造成一次傷害；同 tick 觸發的多層合併為一次顯示
    if(m.bleeds && m.bleeds.length) {
        let bleedTotal = 0;
        for(let bi = m.bleeds.length - 1; bi >= 0; bi--) {
            let b = m.bleeds[bi];
            b.ticksLeft--;
            if(b.ticksLeft % 10 === 0) bleedTotal += b.dmg;
            if(b.ticksLeft <= 0) m.bleeds.splice(bi, 1);
        }
        if(bleedTotal > 0) {
            // 🔧 出血精通：每秒出血總傷害 ×(1 + 0.1×層數)（每層 +10%、10 層 = +100%）
            if(m._bleedMastery) bleedTotal = Math.floor(bleedTotal * (1 + 0.10 * m.bleeds.length));
            m.curHp -= bleedTotal; m.justHit = 'magic'; mobWake(m); _dps.player += bleedTotal;   // 🎯 DPS：出血 DoT 歸玩家（同中毒，已知簡化）
            logCombat(`<span class="${getMobColor(m.lv)}">${m.n}</span> 受到出血傷害 ${bleedTotal} 點（${m.bleeds.length} 層）。`, 'dot');   // 🟢 出血 DoT→綠色持續傷害分類(原 'player' 藍色一般攻擊)
            if(m.curHp <= 0) { killMob(i); return true; }
            if(!state.ff) renderMobs();
        }
        if(m.bleeds.length === 0) { m._bleedMastery = false; m._bleedCap = 0; }   // 出血結束：清除精通旗標與層數上限
    }
    // 💥 猛爆劇毒 DoT：每秒(10 ticks)固定 100 真傷（無視硬皮/魔抗），持續 5 秒(50 ticks)、最多 1 層；獨立於一般中毒/出血
    if(m._burstPoison && m._burstPoison.left > 0) {
        m._burstPoison.left--;
        if(m._burstPoison.left % 10 === 0) {
            m.curHp -= m._burstPoison.dmg; m.justHit = 'magic'; mobWake(m); _dps.player += m._burstPoison.dmg;   // 🎯 DPS：猛爆劇毒 DoT 歸玩家（同中毒，已知簡化）
            logCombat(`<span class="${getMobColor(m.lv)}">${m.n}</span> 受到猛爆劇毒傷害 ${m._burstPoison.dmg} 點。`, 'dot');   // 🟢 猛爆劇毒 DoT→綠色持續傷害分類(原 'player' 藍色一般攻擊)
            if(m.curHp <= 0) { m._burstPoison = null; killMob(i); return true; }
            if(!state.ff) renderMobs();
        }
        if(m._burstPoison.left <= 0) m._burstPoison = null;
    }
    return m.curHp <= 0;
}

// ---------- 召喚物 ----------
function summonTierByLevel(lv) {
    // dmgDiv：近戰額外傷害 = floor((魅力/dmgDiv) x (1+等級/dmgLvDiv))；hitLvOff：命中的等級偏移；觸發技傷害 = (roll(dmgDice)+魅力) x floor(魅力/6)
    if(lv >= 72) return { n:'召喚：黑豹', dmgDice:[2,14], dmgDiv:6, dmgLvDiv:10, interval:10, kind:'melee', hitLvOff:20, proc:{ p:0.20, cd:50, dmgDice:[6,10], ele:'none', name:'撕咬' } };
    if(lv >= 64) return { n:'召喚：地獄束縛犬', dmgDice:[3,15], dmgDiv:4, dmgLvDiv:15, interval:20, kind:'melee', hitLvOff:15, proc:{ p:0.15, cd:50, dmgDice:[4,12], ele:'fire', name:'噴火' } };
    if(lv >= 60) return { n:'召喚：地獄奴隸', dmgDice:[3,12], dmgDiv:4, dmgLvDiv:20, interval:20, kind:'melee', hitLvOff:12, proc:{ p:0.10, cd:50, dmgDice:[1,32], ele:'earth', name:'地獄之牙' } };
    if(lv >= 52) return { n:'召喚：魔狼', dmgDice:[1,15], dmgDiv:5, dmgLvDiv:25, interval:10, kind:'melee', hitLvOff:10 };   // 🔧 攻速低於2秒的召喚物：固定加成貼近前階（dmgDiv 8→5，Lv52/魅30 加成 11→18，對照食人妖精 20）
    if(lv >= 40) return { n:'召喚：食人妖精', dmgDice:[2,11], dmgDiv:4, dmgLvDiv:30, interval:20, kind:'melee', hitLvOff:7 };
    if(lv >= 32) return { n:'召喚：甘地妖魔', dmgDice:[2,8], dmgDiv:5, dmgLvDiv:35, interval:20, kind:'melee', hitLvOff:3 };
    return { n:'召喚：哈柏哥布林', dmgDice:[1,15], dmgDiv:5, dmgLvDiv:40, interval:20, kind:'melee', hitLvOff:0 };
}
function buildSummon(skId, def, durSec) {
    let base = def.tiered ? summonTierByLevel(player.lv) : def;
    let ele = base.ele || 'none';
    if(def.eleFromPlayer) ele = player.elfEle || 'none';
    let nm = base.n;
    if(def.eleFromPlayer) {
        let eleZh = { fire:'火', water:'水', wind:'風', earth:'地', none:'無' }[ele] || '';
        nm = base.n.replace('{ele}', eleZh);
    }
    return {
        skId: skId, n: nm, dmgDice: base.dmgDice, interval: base.interval || 20,
        ele: ele, kind: base.kind || 'melee', hitLvOff: base.hitLvOff || 0,
        dmgDiv: base.dmgDiv || 5, dmgLvDiv: base.dmgLvDiv || 0, elemScale: base.elemScale || 20,
        proc: base.proc ? { ...base.proc, cdCur: base.proc.cd } : null,
        cd: base.interval || 20, endTick: state.ticks + (durSec || 3600) * 10
    };
}
function setupSummon(skId, sk) {
    // 同時只能有一個召喚物：清除其他召喚 buff
    player.skills.forEach(s => { let d = DB.skills[s]; if(d && d.summon) player.buffs[s] = 0; });
    if(skId !== 'sk_charm') player.buffs[skId] = sk.dur || 3600;
    player.summon = buildSummon(skId, sk.summon, sk.dur || 3600);
    if(sk.eleFromPlayer) player.summon.ele = player.elfEle || 'none';
    logCombat(`你召喚了 <span class="text-purple-300">${player.summon.n}</span>。`, 'magic', 'summon');
}
function summonElementDamage(dice, ele, t, flatBonus, mult) {
    let mrBase = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    let mrFactor = mrMult(mrBase);
    let base = (roll(dice[0], dice[1]) + (flatBonus || 0)) * (mult || 1);
    return Math.max(1, Math.floor((Math.max(1, Math.floor(base * mrFactor) - (t.dr || 0))) * fragileMult(t) * elementCounterMult(ele, t.e)));   // 🔮 脆弱（白鳥5）＋⚔️屬性剋制 ×1.4(剋)/×0.6(被剋)
}
// ===== 協力角色：讀取其他存檔位(非當前)的角色，以其真實戰力(等級/能力/裝備)一起作戰 =====
function allySlotList() { return ['1','2','3','4','5','6','7','8'].filter(n => n !== String(currentSlot)); }   // 🔧 8 格存檔：可招募自身以外 7 格（但同時上場上限仍為 3，見 toggleAlly / ALLY_ACTIVE_MAX）
const ALLY_ACTIVE_MAX = 3;   // 🔧 協力傭兵同時上場上限（不論存檔格數多少，最多 3 名）
function allyActiveCap() { return ALLY_ACTIVE_MAX; }   // 🔧 v2.5.4：全職業同時上場上限 3（王族原本 3＋魅力/15 封頂 7 已取消，改為傭兵/夥伴吃魅力加成 royalAllyMult）
// 👑 王族魅力加成：王族攜帶的傭兵與項圈夥伴 造成傷害/HP/MP ×(1+魅力/100)（非王族＝×1）。讀主玩家 player.d.cha（六維效果上限 80→最高 ×1.8）。
function royalAllyMult() { return (player && player.cls === 'royal') ? (1 + (((player.d && player.d.cha) || 0)) / 100) : 1; }
function isAllyActive(slotN) { return !!(player.allies && player.allies.some(a => a && a._slot === String(slotN))); }
// 由存檔位建立協力角色：載入該存檔 player → 暫時切換全域 player 跑 calcStats 取得真實衍生戰力 → 還原
// 協力顯示名稱：有取名→角色名；否則用職業中文（騎士/法師/妖精）
function allyName(a) {
    if (!a) return '';
    if (a.name) return a.name;
    return ({ knight: '騎士', mage: '法師', elf: '妖精', dark: '黑暗妖精', illusion: '幻術士', dragon: '龍騎士', warrior: '戰士', royal: '王族' })[a.cls] || a.cls || ('存檔' + (a._slot || ''));
}
function buildAlly(slotN) {
    slotN = String(slotN);
    let raw = _saveUnwrap(_lzGet('lineage_idle_save_' + slotN)).payload;   // 🛡️ 先解存檔簽章（招募傭兵讀別的存檔位；不驗章、僅取 payload）
    if (!raw) return null;
    let p; try { p = JSON.parse(raw).p; } catch(e) { return null; }
    if (!p || !p.cls) return null;
    let ally = JSON.parse(JSON.stringify(p));   // 深拷貝，不動原存檔
    // 安全防護：補齊 calcStats 會取用的欄位，並清掉協力者自身的召喚/夥伴/變身
    ally.buffs = ally.buffs || {}; ally.statuses = ally.statuses || {}; ally.eq = ally.eq || {}; ally.skills = ally.skills || [];
    ally.blessings = (ally.blessings && typeof ally.blessings === 'object') ? ally.blessings : {};
    ally.alloc = ally.alloc || { str:0,dex:0,con:0,int:0,wis:0,cha:0 };
    ally.panacea = ally.panacea || { str:0,dex:0,con:0,int:0,wis:0,cha:0 };
    ally.poly = null; ally.summon = null; ally.charmed = null; ally.partners = []; ally.allies = [];
    let _save = player; player = ally; let ok = true;
    try { recomputeStats(); } catch(e) { ok = false; }   // 🔧 架構#4：換身重算改用純計算版，不觸發 UI 副作用
    player = _save; calcStats();   // 還原真實玩家的衍生值並刷新 UI
    if (!ok) return null;
    { let _rm = royalAllyMult(); if (_rm !== 1) { ally.mhp = Math.max(1, Math.floor((ally.mhp || 1) * _rm)); ally.mmp = Math.floor((ally.mmp || 0) * _rm); } }   // 👑 王族魅力加成：傭兵 HP/MP ×(1+魅力/100)（招募當下快照·主玩家 player 已於上行還原）
    ally._slot = slotN; ally._allyName = allyName(ally); ally._atkCd = 0; ally.curHp = ally.mhp;
    ally._downed = false;   // 🤝 Phase 3：倒地旗標（curHp 歸零→true·停止行動/不被選為目標·須隊伍面板手動復活）
    ally._reviveCd = 0;   // 🤝 Phase 3：倒地後復活冷卻（ticks 倒數；倒地時設 150＝15秒·每 tick 於 alliesTick 遞減·存檔安全相對值）
    ally.statuses = {};   // 🤝 Phase4：招募即清空異常狀態（避免繼承來源存檔殘留的中毒/冰凍等）
    ally.exp = 0;   // 🤝 當前等級的經驗進度（升級時歸零再累積）
    ally._expGained = 0;   // 🤝 受雇期間「賺到的經驗總量」（含已被即時升級消耗的）→ 解雇時 delta-merge 加回該存檔角色（多開安全）
    ally._atkSkill = (ally.config && ally.config.selAtkSkill) || '';   // 攻擊技能選擇（快照；法師施法 / 妖精三重矢）
    ally._healSkill = (ally.config && ally.config.selHealSkill) || '';   // 🤝 治癒魔法選擇（快照預設，可於隊伍面板改）·Phase 3 傭兵自動補血讀取
    ally._healHpPct = 70;   // 🤝 治癒施放 HP% 門檻預設（可於隊伍面板改）
    ally.mp = ally.mmp;   // 召喚時滿魔
    { let _w = (ally.eq && ally.eq.wpn) ? DB.items[ally.eq.wpn.id] : null; ally._rapidfire = (_w && _w.isBow && _w.rapidfire) ? _w.rapidfire : 0; }   // 妖精弓：記錄連射發動機率
    return ally;
}
// 協力角色攻擊一次（自包含，直接用 ally 的真實衍生值；法師走魔法、其餘走物理）
// 🔧 對不死/狼人加成（傭兵版，比照玩家 getPhysicalDmg）：武器帶 unBonus/unDice/精靈套裝、且目標為不死(un)或狼人(isWolf) → 額外 +1D20 固定傷害
function allyUnbonusBonus(ally, t) {
    let w = (ally.eq && ally.eq.wpn) ? DB.items[ally.eq.wpn.id] : null;
    return (w && (w.unBonus || w.unDice || w.sp === 'elf') && t && (t.un || t.isWolf)) ? roll(1, 20) : 0;
}
// 🔮 幻術士傭兵 奇古獸攻擊：公式同玩家 qiguPlayerAttack，改用傭兵自身衍生值；奇古獸精通無視MR
function allyQiguAttack(ally, t, wpn) {
    let d = ally.d || {};
    let dice = (t.s === 'L') ? wpn.dmgL : wpn.dmgS;
    let core = roll(1, dice) * (1 + (d.magicDmg || 0) / 16);
    let raw = core + (d.extraMp || 0) + (d.extraDmg || 0);
    let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    let ignoreMr = (ally.mastery === 'i_qigu' && wpn.qigu);
    let dmg = Math.max(1, Math.floor(raw * (ignoreMr ? 1 : mrMult(effMr))));
    let ele = 'none';
    if (ally.eq.wpn && ally.eq.wpn.attr && ATTR_AFFIX[ally.eq.wpn.attr]) { ele = ATTR_AFFIX[ally.eq.wpn.attr].ele; }
    dmg = Math.max(1, Math.floor(dmg * wpnEnFinalMult(ally.eq.wpn)));
    if (ally._setRedLion5) dmg = Math.floor(dmg * 1.2);
    dmg = Math.max(1, Math.floor(dmg * fragileMult(t) * illuLvMult(ally)));   // 🔮 幻術士(傭兵)等級加成 ×(1+等級/50)
    dmg = Math.max(1, Math.floor(dmg * elementCounterMult(ele, t.e)));   // ⚔️ 屬性剋制倍率（取代舊 +6 固定加值）
    dmg = Math.max(1, Math.floor(dmg * royalAllyMult()));   // 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100)
    t.curHp -= dmg; t.justHit = (ele !== 'none') ? ele : 'magic';
    if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
    mobWake(t);
    if (ally._setWhiteBird5 && t.curHp > 0 && !t._dead) { if (!t.st) t.st = newMobStatus(); t.st.fragile = 30; }   // 🔮 白鳥 5/5（傭兵奇古獸）：命中附加脆弱（魔法路徑不經 allyOnHitEffects，故此處補上）
    logCombat(`<span class="text-emerald-300 font-bold">【協力·${ally._allyName}】</span>奇古獸對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dmg} 點魔法傷害。`, 'magic');
    // 奇古獸特效（幻影衝擊/心靈破壞，用傭兵最大MP）
    if (wpn.qiguProc) {
        let en = capWpnEn((ally.eq.wpn && ally.eq.wpn.en) || 0);
        if (t.curHp > 0 && Math.random() < (1 + en) / 100) {
            let pd = 0, lb = '';
            if (wpn.qiguProc === 'phantom') { pd = 79 + roll(1, 81); lb = '幻影衝擊'; }
            else if (wpn.qiguProc === 'mindbreak') { let _m = (t.st && t.st.mrhalf > 0) ? t.mr/2 : t.mr; pd = Math.max(1, Math.floor((ally.mmp||0) * 0.05 * (1 + ((ally.d && ally.d.magicDmg) || 0) / 16) * ((ally.mastery==='i_qigu' && wpn.qigu)?1:mrMult(_m)))); lb = '心靈破壞'; }   // 🔮 比照技能：×(1+魔法傷害/16)
            if (pd > 0) { pd = Math.max(1, Math.floor(pd * fragileMult(t) * illuLvMult(ally) * enhanceWpnFinalMult(en))); pd = Math.max(1, Math.floor(pd * royalAllyMult()));   /* 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100) */ t.curHp -= pd; t.justHit = 'magic'; mobWake(t); logCombat(`<span class="font-bold" style="color:#a78bfa;">【協力·${lb}】</span>對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${pd} 點傷害！`, 'magic'); }
        }
    }
    let ri = mapState.mobs.findIndex(m => m && m.uid === t.uid);
    if (t.curHp <= 0) { if (ri !== -1) killMob(ri); } else renderMobs();
    allyWeaponProcs(ally, t, { hit: true, dmg: dmg });   // 🔮 共鳴等（幻術士魔杖；非共鳴武器內部 no-op，主目標已死自動轉移）
}
function allyAttackOnce(ally) {
    if (!ally || !ally.d) return;
    let t = getTarget(); if (!t || t.curHp <= 0) return;
    let d = ally.d;
    // 🔮 幻術士傭兵 奇古獸攻擊（公式同玩家，用傭兵自身衍生值；裝奇古獸或魔劍精通）
    if (ally.cls === 'illusion') {
        let _qw = (ally.eq && ally.eq.wpn) ? DB.items[ally.eq.wpn.id] : null;
        if (_qw && !_qw.isBow && (_qw.qigu || (ally.mastery === 'i_magicsword' && !isWandWeapon(_qw)))) { allyQiguAttack(ally, t, _qw); return; }   // 🔮 魔劍精通：排除魔杖
    }
    if (ally.cls === 'mage') {
        let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
        let mrFactor = mrMult(effMr);
        let isCrit = Math.random()*100 < (d.magicCrit || 0);
        let spCoef = (1 + 3*(d.magicDmg||0)/16) * (1 + 1/3);
        let critMult = isCrit ? (1 + (d.magicCritDmg||0)/100) : 1;
        let base = roll(1,6) * spCoef * critMult;
        let dmg = Math.max(1, Math.floor((Math.max(1, Math.floor((base + (d.extraMp||0)) * mrFactor) - (t.dr||0))) * 1.55));
        dmg = Math.max(1, Math.floor(dmg * fragileMult(t)));   // 🔮 脆弱（白鳥5）
        dmg = Math.max(1, Math.floor(dmg * wpnEnFinalMult(ally.eq && ally.eq.wpn)));   // 🔧 武器強化 +11~+20：最終傷害倍率（傭兵法師光箭普攻·與玩家普攻一致）
        dmg = Math.max(1, Math.floor(dmg * royalAllyMult()));   // 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100)
        t.curHp -= dmg; t.justHit = 'magic'; mobWake(t);
        logCombat(`<span class="text-emerald-300 font-bold">【協力·${ally._allyName}】</span>魔法攻擊 <span class="${getMobColor(t.lv)}">${t.n}</span>，造成 <span class="${isCrit?'text-yellow-500 font-bold':'text-emerald-200'}">${dmg}</span> 點傷害。`, 'magic');
        allyWeaponProcs(ally, t, { hit: true, dmg: dmg });   // 🔧 法師普攻（光箭）也觸發武器特效：共鳴/魔擊/瑪那回魔
        if (ally._setWhiteBird5 && t.curHp > 0 && !t._dead) { if (!t.st) t.st = newMobStatus(); t.st.fragile = 30; }   // 🔮 白鳥 5/5（傭兵法師光箭）：一般攻擊命中附加脆弱（物理分支於 allyOnHitEffects 套用、魔法分支不經該函式，故此處補上）
    } else {
        let wpn = (ally.eq && ally.eq.wpn) ? DB.items[ally.eq.wpn.id] : null;
        let isLarge = t.s === 'L';
        let dice = wpn ? (isLarge ? wpn.dmgL : wpn.dmgS) : 2;
        let isRanged = !!(wpn && wpn.ranged);
        let hitB = (isRanged ? (d.rangedHit||0) : (d.meleeHit||0)) + (d.extraHit||0);
        let dmgB = isRanged ? (d.rangedDmg||0) : (d.meleeDmg||0);
        let critR = isRanged ? (d.rangedCrit||0) : (d.meleeCrit||0);
        let critD = isRanged ? (d.rangedCritDmg||0) : (d.meleeCritDmg||0);
        let _sureBeauty = !!(ally._setBeauty5 && ally._beautyNextSure);   // 🔮 麗人5/5（傭兵）：上一擊重擊 → 本次必中
        if (_sureBeauty) ally._beautyNextSure = false;
        let hv = Math.max(0, Math.min(20, (ally.lv||1) + hitB - t.lv + mobEffAC(t)));
        let r = roll(1,20);
        if (!_sureBeauty && !((r === 20) || (r !== 1 && hv >= r) || (r === 1 && ally.buffs && ally.buffs.sk_elf_preciseshot > 0))) { logCombat(`<span class="text-sky-300 font-bold">【協力·${ally._allyName}】</span>的攻擊未命中。`, 'miss'); allyWeaponProcs(ally, t, { hit: false, dmg: 0 }); if (wpn && wpn.eff === 'combo' && Math.random() * 100 < (wpn.comboRate || 0)) allyComboAttack(ally, t, true); if (ally.eq && ally.eq.offwpn) allyDualWieldOffhandAttack(ally, t); return; }   // 🔧 未命中也判定共鳴/魔擊/月光爆裂/連擊/迅猛雙斧（與玩家一致）
        let heavy = (r === 20);
        if (heavy && ally._setBeauty5) ally._beautyNextSure = true;   // 🔮 麗人5/5（傭兵）：觸發重擊 → 下次一般攻擊必中
        let isCrit = Math.random()*100 < critR;
        let critMult = isCrit ? (1 + critD/100) : 1;
        let wpnRoll = heavy ? dice : roll(1, dice);
        let _hsT = mobHardSkin(t);   // 🔧 穿透精通用：被硬皮扣減前的量
        let _hsSub = (wpn && wpn.ignHardSkin) ? 0 : _hsT;   // 🗡️ 貫穿（暗黑十字弓）：傭兵攻擊無視硬皮額外減傷（_hsT 仍保留供穿透精通加回）
        let dmg = Math.max(1, Math.floor((wpnRoll + dmgB) * critMult) + (d.extraDmg||0) - (t.dr||0) - _hsSub);   // 🔧 硬皮：額外物理減傷（貫穿時不扣）
        { let _unb = allyUnbonusBonus(ally, t); if (_unb) dmg += _unb; }   // 🔧 對不死/狼人加成 +1D20（與玩家一致；在看破/殺戮倍率前加入）
        // 騎士被動（依協力者等級，僅近戰）：看破 Lv1起5%/每10等+1%上限15%→×2；殺戮 Lv20起1%/每20等+1%上限5%→×3；兩者同時=屠殺→×6
        let kp = '';
        let _meleePassive = (ally.cls === 'knight') || allyHasMastery(ally, 'e_sword');   // 🔧 劍術精通：妖精傭兵近戰也可看破
        if (_meleePassive && !isRanged && !ally.classicMode) {   // 🎮 經典模式：傭兵騎士無看破/殺戮被動
            let lv = ally.lv || 1;
            let insightRate = Math.min(15, 5 + Math.floor(lv / 10));
            let slayRate = (ally.cls === 'knight' && lv >= 20) ? Math.min(5, 1 + Math.floor((lv - 20) / 20)) : 0;   // 殺戮/屠殺僅騎士
            let insight = Math.random() * 100 < insightRate;
            let slay = slayRate > 0 && (Math.random() * 100 < slayRate);
            if (insight && slay) { dmg *= 6; kp = '<span class="font-bold" style="color:#f0abfc;text-shadow:0 0 6px #d946ef;">【屠殺】</span>'; }
            else if (insight) { dmg *= 2; kp = '<span class="text-cyan-300 font-bold">【看破】</span>'; }
            else if (slay) { dmg *= 3; kp = '<span class="text-orange-400 font-bold">【殺戮】</span>'; }
        }
        if (heavy && allyHasMastery(ally, 'k_cleave') && wpn && wpn.eff === 'cleave') dmg = Math.max(1, Math.floor(dmg * 1.5));   // 🏅 切割精通（傭兵）：觸發重擊時傷害 ×1.5
        dmg = Math.max(1, Math.floor(dmg * fragileMult(t)));   // 🔮 脆弱（白鳥5）
        if (ally.skills.includes('sk_warrior_berserk') && !isRanged && Math.random() < 0.05) dmg = Math.max(1, dmg * 2);   // ⚔️ 狂暴（傭兵）：一般攻擊5%機率傷害x2
        dmg = Math.max(1, Math.floor(dmg * wpnEnFinalMult(ally.eq && ally.eq.wpn)));   // 🔧 武器強化 +11~+20：最終傷害倍率（傭兵物理普攻·與玩家普攻 getPhysicalDmg 一致）
        dmg = Math.max(1, Math.floor(dmg * elementCounterMult(getWpnEle(ally.eq ? ally.eq.wpn : null, wpn), t.e)));   // ⚔️ 武器屬性剋制倍率（物理普攻）
        dmg = Math.max(1, Math.floor(dmg * royalAllyMult()));   // 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100)
        t.curHp -= dmg; t.justHit = getWpnEle(ally.eq ? ally.eq.wpn : null, wpn); mobWake(t);
        // 🔧 黑暗妖精傭兵：預設攻擊自動維持附加劇毒（學過 sk_dark_poison 即視為常駐增益）；命中 50%／劇毒精通 100% 使目標中毒（與玩家同規則）
        if (ally.cls === 'dark' && ally.skills && ally.skills.includes('sk_dark_poison') && t.curHp > 0 && Math.random() < (allyHasMastery(ally, 'd_poison') ? 1 : 0.5)) {
            if (!t.st) t.st = newMobStatus();
            let _pPct = allyHasMastery(ally, 'd_poison') ? 2.0 : 0.6;   // 🔧 劇毒精通：每秒 200%；否則 60%
            let _pUnit = Math.max(1, Math.floor(dmg * _pPct));
            // 🔧 新規則（與玩家一致）：未中毒、或新傷害高於現有時才上毒（取代並刷新5秒）；否則不更新，須等舊毒跑完
            if ((t.st.poison || 0) <= 0 || _pUnit > (t.st.poisonUnit || 0)) {
                t.st.poison = 50; t.st.poisonTick = 10;                      // 持續 5 秒、1 層
                t.st.poisonStacks = 1;
                t.st.poisonUnit = _pUnit;
                t.st.poisonDmg = _pUnit;
            }
        }
        let mark = (heavy && isCrit) ? '會心一擊' : (isCrit ? '爆擊' : (heavy ? '重擊' : ''));
        logCombat(`${kp}<span class="text-sky-300 font-bold">【協力·${ally._allyName}】</span>攻擊 <span class="${getMobColor(t.lv)}">${t.n}</span>，造成 ${dmg} 點傷害${mark?'（'+mark+'!）':''}。`, 'player');
        // 🔧 硬皮消磨：傭兵一般攻擊命中固定再磨 1（basic，與玩家同規則）；單手鈍器鈍擊另由 allyOnHitEffects 觸發
        if (t.curHp > 0) wearHardSkin(t, ally.eq && ally.eq.wpn ? ally.eq.wpn.id : null, heavy, false, true, ally.classicMode);
        allyOnHitEffects(ally, t, { dmg: dmg, heavy: heavy, hardSkin: _hsT });        // 🔧 命中後特效：穿透/即死/出血/鈍擊/切割（hardSkin 供穿透精通無視判定）
        if (wpn && wpn.vampPct && dmg > 0 && ally.hp != null) ally.hp = Math.min(ally.mhp || ally.hp, (ally.hp || 0) + Math.floor(dmg * wpn.vampPct));   // 🐉 嗜血者鎖鏈劍（傭兵）
        if (t.curHp > 0 && !isRanged && wpn && (wpn.weakExpose || allyHasMastery(ally, 'k_weakness'))) {   // 🐉 弱點曝光（傭兵）：鎖鏈劍/弱點精通
            let _always = allyHasMastery(ally, 'k_chainblade') || allyHasMastery(ally, 'k_weakness');
            if (_always || Math.random() < 0.12) { let _max = allyHasMastery(ally, 'k_chainblade') ? 5 : 3; t.weakExpose = Math.min(_max, (t.weakExpose || 0) + 1); }
        }
        allyWeaponProcs(ally, t, { hit: true, dmg: dmg });            // 🔧 普攻判定特效：瑪那回魔/共鳴/魔擊/月光爆裂
        if (wpn && wpn.eff === 'combo' && Math.random() * 100 < (wpn.comboRate || 0)) allyComboAttack(ally, t, true);     // 雙擊：命中後依 comboRate% 追加一次完整一般攻擊
        if (isCrit && allyHasMastery(ally, 'd_crit')) allyComboAttack(ally, t);   // 🔧 黑暗妖精爆擊精通：傭兵爆擊時追加一次連擊
        if (ally.eq && ally.eq.offwpn) allyDualWieldOffhandAttack(ally, t);   // ⚔️ 迅猛雙斧（傭兵）：副手第二攻擊來源
    }
    let ri = mapState.mobs.findIndex(m => m && m.uid === t.uid);
    if (t.curHp <= 0) { if (ri !== -1) killMob(ri); } else renderMobs();
}
// 傭兵雙擊（鋼爪/雙刀）：依武器 comboRate% 追加一次完整一般攻擊，獨立判定命中（🔮 暗影5/5→額外攻擊×1.5）；fullDmg=false（爆擊精通沿用）保留舊倍率×0.5；不遞迴
function allyComboAttack(ally, t, fullDmg) {
    if (!t || t.curHp <= 0 || t._dead) return;
    let r = allyStrikeRoll(ally, t, {});   // 獨立命中判定
    if (!r.hit) { logCombat(`<span class="font-bold" style="color:#c4b5fd;">【協力·${ally._allyName}·雙擊】</span>追擊 <span class="${getMobColor(t.lv)}">${t.n}</span> 未命中。`, 'miss'); return; }
    let dmg = Math.max(1, Math.floor(r.dmg * (fullDmg ? (ally._setShadow5 ? 2.0 : 1.0) : (ally._setShadow5 ? 1.0 : 0.5))));   // 🔧 雙擊(fullDmg)：完整一般攻擊·暗影5/5傷害加倍(×2)；爆擊精通(legacy)×0.5
    dmg = Math.max(1, Math.floor(dmg * elementCounterMult(getWpnEle(ally.eq.wpn, DB.items[ally.eq.wpn.id]), t.e)));   // ⚔️ 武器屬性剋制倍率（雙擊）
    if (t.curHp > 0) wearHardSkin(t, ally.eq && ally.eq.wpn ? ally.eq.wpn.id : null, r.heavy, false, true, ally.classicMode);
    logCombat(`<span class="font-bold" style="color:#c4b5fd;text-shadow:0 0 6px #8b5cf6;">【協力·${ally._allyName}·雙擊】</span>追擊 <span class="${getMobColor(t.lv)}">${t.n}</span>，造成 ${dmg} 點傷害。`, 'player');
    _allyDamageMob(ally, t, dmg, getWpnEle(ally.eq.wpn, DB.items[ally.eq.wpn.id]));
}
// ⚔️ 迅猛雙斧（傭兵）：主手是否可雙持（單手鈍器／巨斧精通的雙手鈍器）
function allyWarriorDualWieldWpnOk(ally, id) {
    if (!id) return false;
    let tags = getWeaponTags(id);
    if (tags.includes('單手鈍器')) return true;
    return !!(ally && ally.cls === 'warrior' && allyHasMastery(ally, 'k_giantaxe') && tags.includes('雙手鈍器'));
}
function allyDualWieldOffhandOk(ally) {
    return !!(ally && ally.cls === 'warrior' && ally.skills && ally.skills.includes('sk_warrior_dualaxe')
        && ally.eq && ally.eq.wpn && allyWarriorDualWieldWpnOk(ally, ally.eq.wpn.id));
}
// ⚔️ 迅猛雙斧（傭兵）：副手單手鈍器追加一次完整一般攻擊（第二攻擊來源·獨立命中·吃狂暴·磨硬皮；不另計強化、不重複觸發主手特效，與玩家版一致）
function allyDualWieldOffhandAttack(ally, t) {
    if (!t || t.curHp <= 0 || t._dead) return;
    if (!allyDualWieldOffhandOk(ally) || !ally.eq.offwpn || !allyWarriorDualWieldWpnOk(ally, ally.eq.offwpn.id)) return;
    let owpn = DB.items[ally.eq.offwpn.id];
    let r = allyStrikeRoll(ally, t, { wpnInst: ally.eq.offwpn, noEnhance: true });   // 副手獨立命中（基礎骰＋近戰加成；不另計強化）
    if (!r.hit) { logCombat(`<span class="font-bold" style="color:#fbbf24;">【協力·${ally._allyName}·迅猛雙斧】</span>副手追擊 <span class="${getMobColor(t.lv)}">${t.n}</span> 未命中。`, 'miss'); return; }
    let dmg = r.dmg;
    if (ally.skills.includes('sk_warrior_berserk') && Math.random() < 0.05) dmg = Math.max(1, dmg * 2);   // ⚔️ 狂暴：副手亦為一般攻擊
    dmg = Math.max(1, Math.floor(dmg * elementCounterMult(getWpnEle(ally.eq.offwpn, owpn), t.e)));   // ⚔️ 副手武器屬性剋制倍率
    if (t.curHp > 0) wearHardSkin(t, ally.eq.offwpn.id, r.heavy, false, true, ally.classicMode);
    let mark = (r.heavy && r.crit) ? '會心一擊' : (r.crit ? '爆擊' : (r.heavy ? '重擊' : ''));
    logCombat(`<span class="font-bold" style="color:#fbbf24;text-shadow:0 0 6px #d97706;">【協力·${ally._allyName}·迅猛雙斧】</span>副手 ${owpn.n} 追擊 <span class="${getMobColor(t.lv)}">${t.n}</span>，造成 ${dmg} 點傷害${mark?'（'+mark+'!）':''}。`, 'player');
    _allyDamageMob(ally, t, dmg, getWpnEle(ally.eq.offwpn, owpn));
}
// 法師協力：依其選定攻擊魔法施放（手動重現 castSkill 魔法傷害公式：單體/全體、魔攻係數、法師倍率、魔暴、MR減免、剋屬性固定加值）
function allyCastMagic(ally, sk) {
    let d = ally.d || {};
    let targets = (sk.target === 'all') ? mapState.mobs.filter(m => m && m.curHp > 0) : [getTarget()].filter(m => m && m.curHp > 0);
    if (!targets.length) return;
    let tier = sk.tier || 1;
    let spCoef = (1 + (3 * (d.magicDmg||0) / 16)) * (1 + (tier / 3));
    let mageMult = (ally.cls === 'mage') ? (1.5 + tier / 20) : 1.0;   // 法師專屬倍率；妖精等其他職業施放魔法不享有
    let texts = [], _burstDmg = 0;   // 🔧 神官魔杖·魔爆：累計本次魔法總傷害
    targets.forEach(t => {
        let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
        let mrFactor = mrMult(effMr);
        let isCrit = Math.random()*100 < (d.magicCrit||0);
        let critMult = isCrit ? (1 + (d.magicCritDmg||0)/100) : 1;
        let dmgArray = sk.multiDmg || (sk.dmgDice ? [[sk.dmgDice[0], sk.dmgDice[1]]] : []);
        let totalDmg = 0;
        dmgArray.forEach((dc, idx) => {
            let baseMagic = roll(dc[0], dc[1]);
            let core = baseMagic * spCoef * critMult;
            let extra = 0;
            if (idx === dmgArray.length - 1) {
                extra = (sk.dmgBase||0) + (d.extraMp||0);
            }
            let dd = Math.max(1, Math.floor((core + extra) * mrFactor) - (t.dr||0));
            dd = Math.floor(dd * mageMult);
            if (ally._setRedLion5) dd = Math.floor(dd * 1.2);   // 🔮 紅獅 5/5（傭兵快照）
            if (allyHasMastery(ally, 'e_magic') && sk.ele && sk.ele !== 'none' && sk.ele === ally.elfEle) dd = Math.floor(dd * 2);   // 🔧 傭兵魔導精通：同屬性傷害魔法 ×2
            dd = Math.max(1, Math.floor(dd * fragileMult(t) * illuLvMult(ally)));   // 🔮 脆弱（白鳥5）；🔮 幻術士(傭兵)等級加成 ×(1+等級/50)
            dd = Math.max(1, Math.floor(dd * wpnEnFinalMult(ally.eq && ally.eq.wpn)));   // 🔧 武器強化 +11~+20：最終傷害倍率（也影響傭兵施放的傷害魔法；物理技走 allyStrikeRoll 已含）
            dd = Math.max(1, Math.floor(dd * elementCounterMult(sk.ele, t.e)));   // ⚔️ 屬性剋制倍率（取代舊 +6 固定加值）
            totalDmg += dd;
        });
        totalDmg = Math.max(1, Math.floor(totalDmg * royalAllyMult()));   // 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100)
        t.curHp -= totalDmg;
        _burstDmg += totalDmg;   // 🔧 魔爆累計
        t.justHit = (sk.ele && sk.ele !== 'none') ? sk.ele : 'magic';
        if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
        mobWake(t);
        // 🔮 白鳥 5/5：傭兵「施放傷害魔法技能」不觸發脆弱（2026-06 用戶要求：只有一般攻擊/基礎普攻才觸發）；基礎普攻(法師光箭/幻術士奇古獸/物理 on-hit)仍於各自路徑套用脆弱
        texts.push(`<span class="${getMobColor(t.lv)}">${t.n}</span> ${totalDmg}${isCrit?'(爆)':''}`);
    });
    if (sk.status) { let _svS = player; player = ally; try { targets.forEach(t => { if (t && t.curHp > 0) applyMobStatus(t, sk.status, sk.n); }); } finally { player = _svS; } }   // 🔧 傷害魔法附帶異常狀態（🐉 奪命之雷暈 / 🔮 混亂 / 幻想沉睡）：以傭兵自身魔法命中判定（與玩家魔法分支 9367 一致）
    logCombat(`<span class="text-emerald-300 font-bold">【協力·${ally._allyName}】</span>施放 ${sk.n} → ${texts.join('、')}`, 'magic');
    targets.forEach(t => { if (t.curHp <= 0) { let ri = mapState.mobs.findIndex(m => m && m.uid === t.uid); if (ri !== -1) killMob(ri); } });
    // 🔧 神官魔杖·魔爆（傭兵版）：施放傷害魔法時依機率(單體 智力/100、全體 智力/60)對全場額外造成本次傷害30%的無屬性傷害
    {
        let _bw = (ally.eq && ally.eq.wpn) ? DB.items[ally.eq.wpn.id] : null;
        if (_bw && _bw.eff === 'magicburst' && _burstDmg > 0 && !ally.classicMode) {   // 🎮 經典模式：傭兵停用魔爆
            let _aoe = (sk.target === 'all') || (targets.length > 1);
            if (Math.random() < ((d.int || 0) / (_aoe ? 60 : 100))) {
                let _ex = Math.max(1, Math.floor(_burstDmg * 0.3));
                let _live = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
                if (_live.length) {
                    logCombat(`<span class="font-bold" style="color:#f0abfc;text-shadow:0 0 6px #c026d3;">【協力·${ally._allyName}·魔爆】</span>魔力過載爆炸，波及全場！`, 'player-special');
                    _live.forEach(m => {
                        let _d = Math.max(1, Math.floor(_ex * fragileMult(m)));
                        _d = Math.max(1, Math.floor(_d * royalAllyMult()));   // 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100)
                        m.curHp -= _d; m.justHit = 'magic'; mobWake(m);
                        logCombat(`魔爆波及 <span class="${getMobColor(m.lv)}">${m.n}</span>，造成 ${_d} 點無屬性傷害。`, 'magic');
                        if (m.curHp <= 0) { let ri = mapState.mobs.findIndex(x => x && x.uid === m.uid); if (ri !== -1) killMob(ri); }
                    });
                }
            }
        }
    }
    renderMobs();
    // 🔧 傭兵迴響精通：(11-階級)×10% 機率不消耗MP立刻再施放一次（迴響觸發的不再連鎖）
    let _aEchoRate = (11 - (sk.tier || 1)) / 10;
    if (sk.target !== 'all') _aEchoRate *= 2;   // 🏅 迴響精通（傭兵）：單體傷害魔法觸發機率加倍（全體沿用原機率）
    if (allyHasMastery(ally, 'm_echo') && !ally._echoing && Math.random() < _aEchoRate) {
        ally._echoing = true;
        logCombat(`<span class="font-bold" style="color:#93c5fd;text-shadow:0 0 6px #3b82f6;">【協力·${ally._allyName}·迴響】</span>${sk.n} 的魔力迴盪不息，再次轟出！`, 'magic');
        try { allyCastMagic(ally, sk); } finally { ally._echoing = false; }
    }
}
// 🔧 傭兵施放「非傷害」攻擊技能：純異常狀態（緩速/弱化/疾病/魔法消除/封印禁地/沉睡之霧/木乃伊詛咒/毒咒/壞物/闇盲/黑闇之影/破壞盔甲…）
//    與即死類（起死回生術=不死、釋放元素=元素）。比照玩家 castSkill 的非傷害分支，以傭兵自身魔法命中(abnormalMagicHit)判定（player=ally 換身）。
//    回傳 true=已施放並扣 MP；false=不適用（無目標 / 目標皆已具該狀態 / 無可即死目標 / MP 不足）→ 由呼叫端退回一般攻擊。
function allyCastNonDamage(ally, sk) {
    if (!sk || sk.type !== 'atk' || sk.dmgDice || sk.multiDmg || sk.dmgType === 'physical') return false;   // 僅處理「無傷害骰的魔法狀態/即死技」
    if (!sk.status && !sk.instakill) return false;
    let d = ally.d || {};
    let targets = (sk.target === 'all') ? mapState.mobs.filter(m => m && m.curHp > 0) : [getTarget()].filter(m => m && m.curHp > 0);
    if (!targets.length) return false;
    // 即死技：需有「非BOSS且具對應tag」的目標，否則退回一般攻擊（避免對無效目標空放浪費 MP，與玩家 autoCastSpells 一致）
    if (sk.instakill) {
        let tag = sk.instakill.tag;
        if (!targets.some(m => !m.boss && (!tag || mobHasTag(m, tag)))) return false;
    }
    // 純異常狀態：所有存活目標皆已具該狀態 → 退回一般攻擊（不重複施放、不浪費 MP，與玩家 castSkill 8235 一致）
    if (sk.status && targets.every(m => m.st && m.st[sk.status.kind] > 0)) return false;
    let cost = Math.max(1, Math.ceil((sk.mp || 0) * (1 - (d.mpReduce || 0) / 100)));
    if (ally._setApprentice5 && (ally.mp || 0) < (ally.mmp || 0) * 0.3) cost = Math.max(1, Math.ceil(cost / 2));   // 🔮 學徒 5/5（傭兵）：MP<30% 耗魔減半（與魔導精通疊加）
    if (allyHasMastery(ally, 'e_magic') && sk.ele && sk.ele !== 'none' && sk.ele === ally.elfEle) cost = Math.max(1, Math.ceil(cost * 0.7));   // 🏅 魔導精通（傭兵）：同屬性 MP -30%
    if ((ally.mp || 0) < cost) return false;
    ally.mp -= cost;
    let _sv = player; player = ally;   // 以傭兵自身魔法命中判定（applyMobStatus/tryInstakill 內部讀 player）
    let _ikKills = [];                  // 🔧 即死成功的目標 uid：延後到還原 player 後再 killMob（結算與 UI 歸真實玩家）
    try {
        logCombat(`<span class="text-emerald-300 font-bold">【協力·${ally._allyName}】</span>施放 ${sk.n}。`, 'magic');
        targets.forEach(t => {
            if (!t || t.curHp <= 0) return;
            if (sk.status) applyMobStatus(t, sk.status, sk.n);
            if (sk.instakill && t.curHp > 0) { let idx = mapState.mobs.findIndex(m => m && m.uid === t.uid); if (idx !== -1 && tryInstakill(t, sk.instakill, sk.n, idx, true)) _ikKills.push(t.uid); }
        });
    } finally { player = _sv; }
    // 🔧 還原 player 後才結算擊殺：經驗/金幣/掉落歸玩家、killMob 結尾的 updateUI 顯示玩家資料（修正換身期間 killMob 造成的左上面板閃爍與獎勵遺失）
    _ikKills.forEach(uid => { let i = mapState.mobs.findIndex(m => m && m.uid === uid); if (i !== -1) killMob(i); });
    renderMobs();
    return true;
}
// 🔧 傭兵施放「物理」攻擊技能（騎士衝擊之暈等：以武器揮擊造成物理傷害，命中後附加暈眩/異常/即死）。
//    比照玩家 castSkill 物理分支(8161~8227)，用 allyStrikeRoll 計傷（含硬皮減傷/脆弱/武器最終倍率）、player=ally 換身判定異常命中。
//    回傳 true=已施放並扣 MP；false=不適用（無目標 / 武器需求不符 / MP 不足）→ 由呼叫端退回一般攻擊。
function allyCastPhysicalSkill(ally, sk) {
    if (!sk || sk.type !== 'atk' || sk.dmgType !== 'physical') return false;
    let t = getTarget(); if (!t || t.curHp <= 0) return false;
    let d = ally.d || {};
    let wpn = (ally.eq && ally.eq.wpn) ? DB.items[ally.eq.wpn.id] : null;
    if (sk.reqWpn === 'w2h'    && !(wpn && wpn.w2h))    return false;   // 需雙手武器
    if (sk.reqWpn === 'bow'    && !(wpn && wpn.isBow))  return false;   // 需弓
    if (sk.reqWpn === 'nonbow' && !(wpn && !wpn.isBow)) return false;   // 需「有武器且非弓」（衝擊之暈）
    let cost = Math.max(1, Math.ceil((sk.mp || 0) * (1 - (d.mpReduce || 0) / 100)));
    if (ally._setApprentice5 && (ally.mp || 0) < (ally.mmp || 0) * 0.3) cost = Math.max(1, Math.ceil(cost / 2));   // 🔮 學徒 5/5（傭兵）：MP<30% 耗魔減半
    if ((ally.mp || 0) < cost) return false;
    ally.mp -= cost;
    let hits = sk.hits || 1, totalDmg = 0, landed = 0, logHits = [];
    let _royalMult = royalAllyMult();   // 👑 換身前先取王族魅力加成（換身期間 player=ally 會讀到傭兵自身職業，故先快照主玩家的倍率）
    let _sv = player; player = ally;   // 異常命中(applyMobStatus/tryInstakill)以傭兵自身判定
    try {
        for (let h = 0; h < hits; h++) {
            if (t.curHp <= 0) break;
            let res = allyStrikeRoll(ally, t, {});   // 一般命中判定（可重擊/爆擊）
            if (!res.hit) { logHits.push('Miss'); continue; }
            landed++;
            res.dmg = Math.floor(res.dmg * illuLvMult(ally));   // 🔮 幻術士(傭兵)骷髏毀壞：等級加成 ×(1+等級/50)（非幻術士回 1，不影響騎士/龍騎物理技）
            res.dmg = Math.max(1, Math.floor(res.dmg * _royalMult));   // 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100)（換身前已快照）
            t.curHp -= res.dmg; t.justHit = getWpnEle(ally.eq ? ally.eq.wpn : null, wpn); mobWake(t);
            totalDmg += res.dmg;
            let mark = (res.heavy && res.crit) ? '會心' : (res.crit ? '爆' : (res.heavy ? '重' : ''));
            logHits.push(res.dmg + (mark ? '(' + mark + ')' : ''));
            if (sk.stun) applyMobStatus(t, { kind: 'stun', pbase: sk.stun, dur: 6, hitOff: (wpn && wpn.stunHitBonus) ? Math.round(wpn.stunHitBonus / 5) : 0 }, sk.n);   // 🏛️ 傭兵持真．冥皇執行劍：衝擊之暈暈眩命中率 +20%
            if (sk.status) applyMobStatus(t, sk.status, sk.n);
            if (t.curHp > 0 && sk.instakill) { let idx = mapState.mobs.findIndex(m => m && m.uid === t.uid); if (idx !== -1) tryInstakill(t, sk.instakill, sk.n, idx, true); }   // 🔧 deferKill：換身期間不結算，由下方還原 player 後的 killMob 處理
        }
    } finally { player = _sv; }
    if (landed > 0) {
        let detail = hits > 1 ? `[${logHits.join(', ')}] 共 ${totalDmg}` : `${totalDmg}`;
        let tag = logHits.some(x => x.includes('爆') || x.includes('會心')) ? 'player-crit' : 'player';
        logCombat(`<span class="text-sky-300 font-bold">【協力·${ally._allyName}】</span>施放 ${sk.n}，對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${detail} 點物理傷害。`, tag);
    } else {
        logCombat(`<span class="text-sky-300 font-bold">【協力·${ally._allyName}】</span>施放 ${sk.n} 未命中 <span class="${getMobColor(t.lv)}">${t.n}</span>。`, 'miss');
    }
    let ri = mapState.mobs.findIndex(m => m && m.uid === t.uid);
    if (t.curHp <= 0) { if (ri !== -1) killMob(ri); } else renderMobs();
    return true;
}
// 法師協力的一次行動：有選攻擊魔法且 MP 足夠→施放並扣 MP；否則退回免費基礎光箭
function allyMageAct(ally) {
    let t = getTarget(); if (!t || t.curHp <= 0) return;
    let sk = DB.skills[ally._atkSkill];
    let d = ally.d || {};
    if (sk && sk.type === 'atk' && sk.dmgType !== 'physical' && (sk.dmgDice || sk.multiDmg)) {
        let cost = Math.max(1, Math.ceil((sk.mp || 0) * (1 - (d.mpReduce || 0) / 100)));
        if (ally._setApprentice5 && (ally.mp || 0) < (ally.mmp || 0) * 0.3) cost = Math.max(1, Math.ceil(cost / 2));   // 🔮 學徒 5/5（傭兵）：MP<30% 耗魔減半
        if ((ally.mp || 0) >= cost) { ally.mp -= cost; allyCastMagic(ally, sk); return; }
    } else if (sk && sk.type === 'atk' && (sk.status || sk.instakill)) {
        if (allyCastNonDamage(ally, sk)) return;   // 🔧 非傷害攻擊技能（緩速/弱化/疾病/即死…）；不適用則退回基礎光箭
    }
    allyAttackOnce(ally);   // 沒選攻擊魔法 / MP 不足 → 免費基礎光箭
}
// 妖精協力：連射（弓）— 依記錄的發動機率追加 1~3 箭，每箭約 30% 傷害，隨機命中場上敵人
function allyRapidfire(ally) {
    if (ally.classicMode) return;   // 🎮 經典模式：傭兵停用連射
    let d = ally.d || {};
    let wpn = (ally.eq && ally.eq.wpn) ? DB.items[ally.eq.wpn.id] : null;
    let rate = (wpn && wpn.isBow && wpn.rapidfire) ? wpn.rapidfire : (ally._rapidfire || 0);   // 直接讀當前弓的連射機率（相容舊協力快照，確保普攻與三重矢都能連射）
    if (!rate || roll(1, 100) > rate) return;
    let _allyRapid = allyHasMastery(ally, 'e_rapid');   // 🔧 傭兵連射精通：箭數隨機 1~5、傷害 50%（疊疾風5/5 → 100%）
    let n = roll(1, _allyRapid ? 5 : 3);
    let _rfMult = ally._setGale5 ? (_allyRapid ? 1.00 : 0.80) : (_allyRapid ? 0.50 : 0.30);
    for (let i = 0; i < n; i++) {
        let alive = []; mapState.mobs.forEach((m, idx) => { if (m && m.curHp > 0) alive.push(idx); });
        if (!alive.length) break;
        let ti = alive[Math.floor(Math.random() * alive.length)];
        let mt = mapState.mobs[ti];
        let dice = wpn ? (mt.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;
        let _hsSub = (wpn && wpn.ignHardSkin) ? 0 : mobHardSkin(mt);   // 🗡️ 貫穿（暗黑十字弓）：傭兵連射亦無視硬皮額外減傷
        let dmg = Math.max(1, Math.floor((roll(1, dice) + (d.rangedDmg||0) + (d.extraDmg||0) - (mt.dr||0) - _hsSub + allyUnbonusBonus(ally, mt)) * _rfMult * fragileMult(mt) * ((wpn && wpn.finalMult) ? wpn.finalMult : 1) * wpnEnFinalMult(ally.eq && ally.eq.wpn)));   // 🔧 硬皮：額外物理減傷（貫穿時不扣）；對不死/狼人 +1D20；連射倍率（疾風5/5/連射精通）；脆弱；🏛️ 武器最終傷害倍率（古老武器×2·若有）＋武器強化 +11~+20 最終倍率（與玩家連射一致）
        dmg = Math.max(1, Math.floor(dmg * elementCounterMult(getWpnEle(ally.eq ? ally.eq.wpn : null, wpn), mt.e)));   // ⚔️ 武器屬性剋制倍率（連射）
        dmg = Math.max(1, Math.floor(dmg * royalAllyMult()));   // 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100)
        mt.curHp -= dmg; mt.justHit = getWpnEle(ally.eq ? ally.eq.wpn : null, wpn); mobWake(mt);
        logCombat(`<span class="text-amber-300 font-bold">【協力·${ally._allyName}·連射】</span>箭矢命中 <span class="${getMobColor(mt.lv)}">${mt.n}</span>，造成 ${dmg} 點傷害。`, 'player');
        if (mt.curHp <= 0) killMob(ti);
        if (wpn && wpn.eff === 'moonburst' && Math.random() < 0.08) { let _mb = _allyProcTarget(mt); if (_mb) allyProcMoonburst(ally, _mb); }   // 🔧 熾炎天使弓：每支連射箭也可觸發月光爆裂（與玩家一致）
    }
    renderMobs();
}

// ===== 🔧 傭兵武器特效系統 =====
// 傭兵普通攻擊會觸發「存檔當下裝備武器」的特效（規則同玩家、數值用傭兵自身衍生值）：
// 共鳴(免費光箭，回魔給傭兵)、魔擊、月光爆裂、瑪那魔杖回魔(mp_drain→傭兵MP)、穿透、骰子匕首即死、
// 匕首/矛出血、單手鈍器鈍擊、雙手劍切割(自身攻速+20%/2秒)、弓連射(原有)。
// 受擊觸發類改為判定「主操控玩家」：反擊＝傭兵持單手劍，玩家被命中50%（玩家格檔則必發）；
// 居合＝傭兵持武士刀且未裝盾，玩家迴避或敵人未命中時50%。由 enemyPhysicalAttack 呼叫。

// 特效目標選擇：主目標存活優先，否則隨機轉移到場上存活怪（同玩家 proc 規則）
function _allyProcTarget(target) {
    let t = (target && target.curHp > 0 && !target._dead) ? target : null;
    if (!t) {
        let alive = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
        if (!alive.length) return null;
        t = alive[Math.floor(Math.random() * alive.length)];
    }
    return t;
}
// 對怪物套用傭兵特效傷害並處理擊殺
function _allyDamageMob(ally, t, dmg, ele) {
    dmg = Math.max(1, Math.floor(dmg * royalAllyMult()));   // 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100)（非王族＝×1·涵蓋所有走本函式的傭兵輸出：連擊/雙持/各 proc/魔擊/穿透/龍擊/反擊/居合等）
    let _dpsBf = t.curHp;   // 🎯 DPS：扣血前 HP（量測實際輸出·溢殺以剩餘 HP 計）
    t.curHp -= dmg;
    t.justHit = ele;
    mobWake(t);
    if (!_dpsAllyTurn) _dpsAddAlly(ally, Math.max(0, Math.min(dmg, _dpsBf)));   // 🎯 回合外傭兵輸出（反擊/居合）直接歸該傭兵；回合內由 alliesTick HP-delta 涵蓋，避免重複
    let ri = mapState.mobs.findIndex(m => m && m.uid === t.uid);
    if (t.curHp <= 0) { if (ri !== -1) killMob(ri); } else renderMobs();
}
// 傭兵的一次物理打擊計算（沿用 allyAttackOnce 的簡化公式）
// opts: forceHit=必中(可自然重擊) / forceHeavy=必中+必重擊 / noHeavy=不重擊 / mult=傷害倍率
function allyStrikeRoll(ally, t, opts) {
    opts = opts || {};
    let d = ally.d || {};
    let wpnInst = opts.wpnInst || (ally.eq && ally.eq.wpn) || null;   // ⚔️ 可指定武器實例（迅猛雙斧副手＝offwpn）
    let wpn = wpnInst ? DB.items[wpnInst.id] : null;
    let dice = wpn ? (t.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;
    let isRanged = !!(wpn && wpn.ranged);
    let hitB = (isRanged ? (d.rangedHit||0) : (d.meleeHit||0)) + (d.extraHit||0);
    let dmgB = isRanged ? (d.rangedDmg||0) : (d.meleeDmg||0);
    let critR = isRanged ? (d.rangedCrit||0) : (d.meleeCrit||0);
    let critD = isRanged ? (d.rangedCritDmg||0) : (d.meleeCritDmg||0);
    let hit = true, heavy = false;
    if (opts.forceHeavy) { heavy = true; }
    else if (opts.forceHit) { heavy = !opts.noHeavy && (roll(1, 20) === 20); }
    else {
        let hv = Math.max(0, Math.min(20, (ally.lv||1) + hitB - t.lv + mobEffAC(t)));
        let r = roll(1, 20);
        hit = ((r === 20) || (r !== 1 && hv >= r) || (r === 1 && ally.buffs && ally.buffs.sk_elf_preciseshot > 0));   // 🏹 精準射擊（妖精傭兵·存檔時持有此buff）：擲骰1由必定未命中→必定命中
        heavy = !opts.noHeavy && (r === 20);
    }
    if (!hit) return { hit: false, dmg: 0, heavy: false, crit: false };
    let isCrit = opts.forceCrit || (Math.random()*100 < critR);   // 🏅 反擊精通（傭兵）：反擊/居合必定爆擊
    let critMult = isCrit ? (1 + critD/100) : 1;
    let wpnRoll = heavy ? dice : roll(1, dice);
    let dmg = Math.max(1, Math.floor((wpnRoll + dmgB) * critMult) + (d.extraDmg||0) - (t.dr||0) - mobHardSkin(t));   // 🔧 硬皮：額外物理減傷
    { let _unb = allyUnbonusBonus(ally, t); if (_unb) dmg += _unb; }   // 🔧 對不死/狼人加成 +1D20（與玩家一致；連擊/魔擊共用此計算）
    if (opts.mult) dmg = Math.max(1, Math.floor(dmg * opts.mult));
    dmg = Math.max(1, Math.floor(dmg * fragileMult(t)));   // 🔮 脆弱（白鳥5）
    dmg = Math.max(1, Math.floor(dmg * (opts.noEnhance ? 1 : wpnEnFinalMult(wpnInst))));   // 🔧 武器強化 +11~+20：最終傷害倍率（noEnhance＝副手不另計強化）
    { let _aw = wpn; if (_aw && _aw.finalMult) dmg = Math.max(1, Math.floor(dmg * _aw.finalMult)); }   // 🏛️ 武器最終傷害倍率（古老武器 ×2）
    return { hit: true, dmg: dmg, heavy: heavy, crit: isCrit };
}
// 共鳴光箭（傭兵版）：公式同玩家 procLightArrow；回魔（傷害/10、至少1）恢復到傭兵自身 MP
function allyProcLightArrow(ally, t) {
    if (ally.classicMode) return;   // 🎮 經典模式：傭兵停用共鳴
    let sk = DB.skills['sk_lightarrow'];
    if (!sk || !t || t.curHp <= 0) return;
    let d = ally.d || {};
    let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    let mrFactor = allyHasMastery(ally, 'm_resonance') ? 1 : mrMult(effMr);   // 🏅 共鳴精通（傭兵）：光箭無視魔抗
    let isCrit = Math.random()*100 < (d.magicCrit||0);
    let tier = sk.tier || 1;
    let spCoef = (1 + 3*(d.magicDmg||0)/16);   // 🔧 武器特效：不吃法師技能階級係數(1+tier/3)（與 mageMult 一同移除）
    let mageMult = 1.0;   // 🔧 傭兵共鳴(光箭)為武器特效，不再吃法師「法術階級加成」(1.5+階/20)
    let critMult = isCrit ? (1 + (d.magicCritDmg||0)/100) : 1;
    let core = roll(sk.dmgDice[0], sk.dmgDice[1]) * spCoef * critMult;
    let dmg = Math.max(1, Math.floor((core + (sk.dmgBase||0) + (d.extraMp||0)) * mrFactor) - (t.dr||0));
    dmg = Math.floor(dmg * mageMult);
    dmg = Math.max(1, Math.floor(dmg * wpnEnFinalMult(ally.eq && ally.eq.wpn)));   // 🔧 武器強化 +11~+20：最終傷害倍率（共鳴光箭·鏡像玩家 procLightArrow）
    let _allyReso = allyHasMastery(ally, 'm_resonance');   // 🔧 傭兵共鳴精通：光箭+5、回魔/5
    if (_allyReso) dmg = Math.max(1, dmg + 5);
    if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
    ally.mp = Math.min(ally.mmp||0, (ally.mp||0) + Math.max(1, Math.floor(dmg/(_allyReso ? 5 : 10))));   // 共鳴回魔 → 傭兵自身
    logCombat(`<span class="text-cyan-300 font-bold">【協力·${ally._allyName}·共鳴】</span>光箭對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dmg} 點傷害。${isCrit?' (爆擊!)':''}`, 'magic');
    _allyDamageMob(ally, t, dmg, 'magic');
    // 🔮 魔女 5/5（傭兵）：每 5 次共鳴 → 免費施放冰矛圍籬
    if (ally._setWitch5) { ally._witchResCnt = (ally._witchResCnt || 0) + 1; if (ally._witchResCnt >= 5) { ally._witchResCnt = 0; if (typeof allyStormTick === 'function' && DB.skills['sk_blizzard_storm']) allyStormTick(ally, DB.skills['sk_blizzard_storm'], true); } }   // 🔮 魔女5/5(傭兵)：每5共鳴→免費冰雪暴(不吃法師階級加成)
}
// 🔮 魔女 5/5（傭兵）：免費冰矛圍籬（公式同 witchIceLance，但用傭兵 d / 旗標）
function allyWitchIceLance(ally) {
    let sk = DB.skills['sk_ice_lance']; if (!sk) return;
    let t = getTarget();
    if (!t || t.curHp <= 0 || t._dead) { let alive = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead); if (!alive.length) return; t = alive[Math.floor(Math.random() * alive.length)]; }
    let d = ally.d || {};
    let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    let mrFactor = mrMult(effMr);
    let isCrit = Math.random() * 100 < (d.magicCrit || 0);
    let tier = sk.tier || 1;
    let spCoef = (1 + 3 * (d.magicDmg || 0) / 16);   // 🔧 武器特效：不吃法師技能階級係數(1+tier/3)（與 mageMult 一同移除）
    let mageMult = 1.0;   // 🔧 傭兵魔女5/5(共鳴觸發)為武器特效，不再吃法師「法術階級加成」(1.5+階/20)
    let critMult = isCrit ? (1 + (d.magicCritDmg || 0) / 100) : 1;
    let core = roll(sk.dmgDice[0], sk.dmgDice[1]) * spCoef * critMult;
    let dmg = Math.max(1, Math.floor((core + (d.extraMp || 0)) * mrFactor) - (t.dr || 0));
    dmg = Math.floor(dmg * mageMult);
    if (ally._setRedLion5) dmg = Math.floor(dmg * 1.2);
    dmg = Math.max(1, Math.floor(dmg * fragileMult(t)));
    dmg = Math.max(1, Math.floor(dmg * elementCounterMult('water', t.e)));   // ⚔️ 屬性剋制倍率（取代舊 水剋火 +6 固定加值）
    if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
    if (sk.freeze && t.curHp > 0) applyMobStatus(t, { kind: 'freeze', pbase: sk.freeze, dur: 6 }, sk.n);
    logCombat(`<span class="font-bold" style="color:#7dd3fc;text-shadow:0 0 6px #0ea5e9;">【協力·${ally._allyName}·魔女5/5】</span>共鳴引動了冰矛圍籬，對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dmg} 點傷害。${isCrit ? ' (爆擊!)' : ''}`, 'magic');
    _allyDamageMob(ally, t, dmg, 'water');
}
// 月光爆裂（傭兵版）：1D30 + 2×武器強化 風屬性固定傷害（剋水 +6）
function allyProcMoonburst(ally, t) {
    if (!t || t.curHp <= 0) return;
    let en = capWpnEn((ally.eq && ally.eq.wpn && ally.eq.wpn.en) || 0);
    let dmg = roll(1, 30) + 2 * en;
    let _cm = elementCounterMult('wind', t.e);   // ⚔️ 屬性剋制倍率（取代舊 +6 固定加值）
    let counterTxt = (_cm > 1) ? ' <span class="text-emerald-300 font-bold">(剋屬性!)</span>' : (_cm < 1 ? ' <span class="text-rose-400 font-bold">(被剋!)</span>' : '');
    dmg = Math.max(1, Math.floor(dmg * enhanceWpnFinalMult(en)));   // 🔧 武器強化 +11~+20：最終傷害倍率
    dmg = Math.max(1, Math.floor(dmg * _cm));
    logCombat(`<span class="font-bold" style="color:#67e8f9;text-shadow:0 0 6px #06b6d4;">【協力·${ally._allyName}·月光爆裂】</span>對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dmg} 點風屬性傷害！${counterTxt}`, 'player-special');
    _allyDamageMob(ally, t, dmg, 'wind');
}
// 🔧 武器附魔施放（spellProc，傭兵版）：死亡騎士的烈炎之劍・烈炎術／克特之劍・極道落雷（必中、受傭兵魔法傷害影響、屬性剋制+6、魔導精通同屬性×2）
function _allyProcWeaponSpellHit(ally, t, sp, en) {
    if (!t || t.curHp <= 0) return;
    let d = ally.d || {};
    let base = roll(sp.dice[0], sp.dice[1]) + (sp.flat || 0);   // 🔧 基礎傷害（含 sp.flat 固定加值·與玩家版一致；強化改吃 +11 最終倍率·原 ×(1+強化/20) 移除）
    let core = base * (1 + 3 * (d.magicDmg || 0) / 16);
    let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    let mrFactor = mrMult(effMr);
    let _cm = elementCounterMult(sp.ele, t.e);   // ⚔️ 屬性剋制倍率（取代舊 +6 固定加值）
    let dd = Math.floor(core * mrFactor) - (t.dr || 0);
    if (allyHasMastery(ally, 'e_magic') && sp.ele && sp.ele !== 'none' && sp.ele === ally.elfEle) dd = Math.floor(Math.max(1, dd) * 2);   // 🏅 傭兵魔導精通：同屬性 ×2
    dd = Math.max(1, Math.floor(Math.max(1, dd) * fragileMult(t)));
    dd = Math.max(1, Math.floor(dd * enhanceWpnFinalMult(en)));   // 🔧 武器強化 +11~+20：最終傷害倍率（取代舊 (1+強化/20)）
    dd = Math.max(1, Math.floor(dd * _cm));
    if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
    let glow = (sp.ele === 'fire') ? '#fca5a5;text-shadow:0 0 6px #dc2626'
             : (sp.ele === 'wind') ? '#67e8f9;text-shadow:0 0 6px #06b6d4'
             : (sp.ele === 'water') ? '#93c5fd;text-shadow:0 0 6px #2563eb'
             : (sp.ele === 'earth') ? '#fcd34d;text-shadow:0 0 6px #b45309'
             : '#d8b4fe;text-shadow:0 0 6px #a855f7';
    let counterTxt = (_cm > 1) ? ' <span class="text-emerald-300 font-bold">(剋屬性!)</span>' : (_cm < 1 ? ' <span class="text-rose-400 font-bold">(被剋!)</span>' : '');
    logCombat(`<span class="font-bold" style="color:${glow};">【協力·${ally._allyName}·${sp.skn}】</span>武器之力爆發，對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dd} 點${ELE_CN[sp.ele] || ''}屬性魔法傷害！${counterTxt}`, 'player-special');
    _allyDamageMob(ally, t, dd, (sp.ele && sp.ele !== 'none') ? sp.ele : 'magic');
    // ⚡ 固定機率附加異常狀態（與玩家版一致；force 繞過魔抗命中判定，BOSS 免疫仍生效）
    if (t.curHp > 0 && sp.status && Math.random() * 100 < sp.status.pct) applyMobStatus(t, { kind: sp.status.kind, dur: sp.status.dur || 4, force: true }, sp.skn);
}
function allyProcWeaponSpell(ally, t, sp, en) {
    if (sp.aoe) {
        // 🔧 地獄火（傭兵版）：對敵方全體各自施放，uid 快照避免擊殺改動索引
        let uids = mapState.mobs.filter(m => m && m.curHp > 0).map(m => m.uid);
        uids.forEach(uid => { let mob = mapState.mobs.find(m => m && m.uid === uid && m.curHp > 0); if (mob) _allyProcWeaponSpellHit(ally, mob, sp, en); });
        return;
    }
    _allyProcWeaponSpellHit(ally, t, sp, en);
}
// 🔧 免費施放法師單體傷害魔法（procSkill，傭兵版）：冰之女王魔杖・冰錐（不耗MP/不需學會；依傭兵魔法傷害、武器強化 ×(1+強化/20)）
function allyProcFreeMagicSkill(ally, t, skId, en) {
    let sk = DB.skills[skId];
    if (!sk || !t || t.curHp <= 0) return;
    let d = ally.d || {};
    let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    let mrFactor = mrMult(effMr);
    let isCrit = Math.random() * 100 < (d.magicCrit || 0);
    let tier = sk.tier || 1;
    let spCoef = (1 + (3 * (d.magicDmg || 0) / 16));   // 🔧 武器特效：不吃法師技能階級係數(1+tier/3)（與 mageMult 一同移除）
    let mageDmgMult = 1.0;   // 🔧 傭兵武器免費施法(冰之女王魔杖等)為武器特效，不再吃法師「法術階級加成」(1.5+階/20)
    let critMult = isCrit ? (1 + (d.magicCritDmg || 0) / 100) : 1.0;
    let dmgArray = sk.multiDmg || (sk.dmgDice ? [[sk.dmgDice[0], sk.dmgDice[1]]] : []);
    let total = 0;
    dmgArray.forEach((dc, idx) => {
        let core = roll(dc[0], dc[1]) * spCoef * critMult;   // 🔧 強化改吃 +11 最終倍率（見迴圈後，原 ×(1+強化/20) 移除）
        let extra = 0;
        if (idx === dmgArray.length - 1) {
            extra = (d.extraMp || 0);
        }
        let dd = Math.floor((core + extra) * mrFactor) - (t.dr || 0);
        dd = Math.max(1, dd);
        dd = Math.floor(dd * mageDmgMult);
        if (ally._setRedLion5) dd = Math.floor(dd * 1.2);
        if (allyHasMastery(ally, 'e_magic') && sk.ele && sk.ele !== 'none' && sk.ele === ally.elfEle) dd = Math.floor(dd * 2);
        total += Math.max(1, Math.floor(dd * fragileMult(t)));
    });
    total = Math.floor(total * enhanceWpnFinalMult(en));   // 🔧 武器強化 +11~+20：最終傷害倍率（取代舊 (1+強化/20)）
    total = Math.max(1, Math.floor(total * elementCounterMult(sk.ele, t.e)));   // ⚔️ 屬性剋制倍率（取代舊 +6 固定加值）
    if (total > 0) {
        if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
        logCombat(`<span class="font-bold" style="color:#93c5fd;text-shadow:0 0 6px #2563eb;">【協力·${ally._allyName}·${sk.n}】</span>額外施放，對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 <span class="${isCrit ? 'text-yellow-500 font-bold' : 'text-cyan-300'}">${total}</span> 點傷害${isCrit ? '（爆擊!）' : ''}。`, 'player-special');
        _allyDamageMob(ally, t, total, (sk.ele && sk.ele !== 'none') ? sk.ele : 'magic');
    }
    if (t.curHp > 0 && sk.freeze) applyMobStatus(t, { kind: 'freeze', pbase: sk.freeze, dur: 6 }, sk.n);
    if (t.curHp > 0 && sk.status) applyMobStatus(t, sk.status, sk.n);
}
// 🔧 蕾雅魔杖（meleeHitSpell，傭兵版）：命中時觸發冰裂術（必中、受傭兵魔法傷害影響；對冰凍目標碎冰額外傷害，否則機率冰凍）
function allyLaiaWandHitProc(ally, t) {
    let inst = ally.eq && ally.eq.wpn; let w = inst ? DB.items[inst.id] : null;
    if (!w || !w.meleeHitSpell || !t || t.curHp <= 0) return;
    let d = ally.d || {};
    let sp = w.meleeHitSpell; let en = capWpnEn(inst.en);
    let core = roll(sp.dice[0], sp.dice[1]) * (1 + 3 * (d.magicDmg || 0) / 16);   // 🔧 武器特效(傭兵蕾雅魔杖冰裂術)：不吃法師階級係數(原 ×(1+8/3) 已移除)；強化改吃 +11 最終倍率
    let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    let mrFactor = mrMult(effMr);
    let wasFrozen = !!(t.st && t.st.freeze > 0);
    let dd = Math.floor(core * mrFactor) - (t.dr || 0);
    dd = Math.max(1, dd);   // 🔧 武器 proc 不吃法師「法術階級加成」(1.5+階/20)：原 8 階 ×1.9 已移除（spCoef 階級係數仍保留）
    if (wasFrozen) { dd += (sp.shatter || 0); t.st.freeze = 0; }
    dd = Math.max(1, Math.floor(Math.max(1, dd) * fragileMult(t)));
    dd = Math.max(1, Math.floor(dd * enhanceWpnFinalMult(en)));   // 🔧 武器強化 +11~+20：最終傷害倍率（取代舊 (1+強化/10)）
    dd = Math.max(1, Math.floor(dd * elementCounterMult(sp.ele, t.e)));   // ⚔️ 屬性剋制倍率（取代舊 +6 固定加值）
    if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
    logCombat(`<span class="font-bold" style="color:#93c5fd;text-shadow:0 0 6px #2563eb;">【協力·${ally._allyName}·${sp.skn || '冰裂術'}】</span>對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dd} 點水屬性魔法傷害${wasFrozen ? '（冰碎!）' : ''}。`, 'player-special');
    _allyDamageMob(ally, t, dd, sp.ele);
    if (t.curHp > 0) applyMobStatus(t, { kind: 'freeze', pbase: sp.freezePbase, dur: 6 }, sp.skn || '冰裂術');   // 機率冰凍
}
// 普攻後判定（命中與否皆判定，與玩家一致）：瑪那回魔(僅命中) / 共鳴 / 魔擊 / 月光爆裂
function allyWeaponProcs(ally, target, hitInfo) {
    let wpnInst = ally.eq && ally.eq.wpn;
    if (!wpnInst) return;
    let wpn = DB.items[wpnInst.id];
    if (!wpn) return;
    if (wpn.procPoison) applyWeaponProcPoison(target, wpn.procPoison, wpnEnFinalMult(wpnInst));   // 🔧 死亡之指：傭兵攻擊時毒咒（與玩家一致·吃武器強化最終倍率）
    if (wpn.procBurstPoison) applyWeaponBurstPoison(target, wpn.procBurstPoison, capWpnEn(wpnInst.en), wpnEnFinalMult(wpnInst));   // 💥 破壞雙刀/鋼爪：傭兵攻擊時猛爆劇毒（與玩家一致·吃武器強化最終倍率）
    if (wpn.procStatusSkill) { let _sv = player; player = ally; try { applyWeaponProcStatusSkill(target, wpn.procStatusSkill); } finally { player = _sv; } }   // 🌑 惡魔王武器：傭兵攻擊時施放疾病術（以傭兵自身魔法命中判定）
    let d = ally.d || {};
    // 👹 隱藏的魔族武器（傭兵）：紅惡靈逆襲(4D10水魔傷·吸10%HP) / 藍惡靈奪魔(回3D6 MP)，4% + 每強化 +1%（與玩家一致；經典模式亦可觸發）
    if (wpn.redSpecter || wpn.blueSpecter) {
        let _en = capWpnEn(wpnInst.en);
        if (wpn.redSpecter && Math.random() * 100 < (4 + _en)) {
            let t = _allyProcTarget(target);
            if (t) {
                let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
                let core = roll(4, 10) * (1 + 3 * (d.magicDmg || 0) / 16) * enhanceWpnFinalMult(_en);   // 🔧 武器強化倍率改在「扣 dr 前」併入核心（原本套在最後→被 dr 壓成 1 後再乘＝白加）
                let dmg = Math.floor(core * mrMult(effMr)) - (t.dr || 0);
                dmg = Math.max(1, Math.floor(Math.max(1, dmg) * fragileMult(t)));
                dmg = Math.max(1, Math.floor(dmg * elementCounterMult('water', t.e)));   // ⚔️ 屬性剋制倍率（取代舊 +6 固定加值）
                if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
                let _hl = Math.floor(dmg * 0.10);
                if (ally.hp != null) ally.hp = Math.min(ally.mhp || ally.hp, (ally.hp || 0) + _hl);
                logCombat(`<span class="font-bold" style="color:#f87171;text-shadow:0 0 6px #dc2626;">【協力·${ally._allyName}·紅惡靈逆襲】</span>對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dmg} 點水屬性魔法傷害，恢復 ${_hl} 點 HP。`, 'player-special');
                _allyDamageMob(ally, t, dmg, 'water');
            }
        }
        if (wpn.blueSpecter && Math.random() * 100 < (4 + _en)) {
            let _mp = rollDice(3, 6);
            ally.mp = Math.min(ally.mmp || 0, (ally.mp || 0) + _mp);
            logCombat(`<span class="font-bold" style="color:#60a5fa;text-shadow:0 0 6px #2563eb;">【協力·${ally._allyName}·藍惡靈奪魔】</span>奪取魔力，恢復 ${_mp} 點 MP。`, 'player-special');
        }
    }
    if (hitInfo && hitInfo.hit && (wpn.eff === 'mp_drain' || wpn.mpOnHit)) {   // 瑪那魔杖/惡魔王魔杖(mpOnHit)：命中恢復MP → 傭兵自身（恢復量同玩家：1 + max(0, 強化-6)）
        let en = capWpnEn(wpnInst.en);
        ally.mp = Math.min(ally.mmp||0, (ally.mp||0) + 1 + Math.max(0, en - 6));
    }
    if (typeof WAND_LIGHTARROW_IDS !== 'undefined' && WAND_LIGHTARROW_IDS.includes(wpnInst.id) && Math.random() < ((d.int||0)/60)) {
        let t = _allyProcTarget(target); if (t) allyProcLightArrow(ally, t);
    }
    if (wpn.eff === 'magicstrike' && !ally.classicMode && Math.random() < ((d.str||0)/60)) {   // 🎮 經典模式：傭兵停用魔擊
        let t = _allyProcTarget(target);
        if (t) {
            let res = allyStrikeRoll(ally, t, { forceHeavy: true });
            logCombat(`<span class="font-bold" style="color:#d8b4fe;text-shadow:0 0 6px #a855f7;">【協力·${ally._allyName}·魔擊】</span>對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${res.dmg} 點傷害（${res.crit?'會心一擊':'重擊'}!）。`, res.crit ? 'player-crit' : 'player-special');
            wearHardSkin(t, null, true, false);   // 🔧 硬皮消磨：傭兵魔擊重擊 -2
            _allyDamageMob(ally, t, res.dmg, getWpnEle(wpnInst, wpn));
            // 🔧 傭兵魔擊精通：必定額外擴散魔擊（對全體各打一次，不再連鎖）
            if (allyHasMastery(ally, 'm_strike')) {
                let _all = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
                if (_all.length) {
                    logCombat(`<span class="font-bold" style="color:#e9d5ff;text-shadow:0 0 8px #a855f7;">【協力·${ally._allyName}·魔擊精通】</span>魔力向四方擴散！`, 'player-special');
                    _all.forEach(m => { let r2 = allyStrikeRoll(ally, m, { forceHeavy: true }); logCombat(`擴散魔擊命中 <span class="${getMobColor(m.lv)}">${m.n}</span>，造成 ${r2.dmg} 點傷害。`, 'player-special'); _allyDamageMob(ally, m, r2.dmg, getWpnEle(wpnInst, wpn)); });
                }
            }
        }
    }
    if (wpn.eff === 'moonburst' && Math.random() < 0.08) {
        let t = _allyProcTarget(target); if (t) allyProcMoonburst(ally, t);
    }
    if (wpn.dragonStrike && Math.random() * 100 < wpn.dragonStrike) {   // 🔧 龍的一擊（傭兵版）：用傭兵力量
        let _ts = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
        if (_ts.length) {
            logCombat(`<span class="font-bold" style="color:#fca5a5;text-shadow:0 0 6px #dc2626;">【協力·${ally._allyName}·龍的一擊】</span>劍中的龍魂咆哮！`, 'player-special');
            _ts.forEach(m => {
                if (!m || m.curHp <= 0 || m._dead) return;
                let dmg = roll(1, Math.max(1, Math.floor(d.str || 1))) + 25;
                dmg = Math.max(1, Math.floor(dmg * wpnEnFinalMult(wpnInst)));   // 🔧 武器強化 +11~+20：最終傷害倍率
                logCombat(`龍之衝擊命中 <span class="${getMobColor(m.lv)}">${m.n}</span>，造成 ${dmg} 點固定傷害。`, 'player');
                _allyDamageMob(ally, m, dmg, true);
            });
        }
    }
    // 🔧 武器附魔施放（spellProc/procSkill，與玩家一致）：死亡騎士的烈炎之劍／克特之劍／冰之女王魔杖；1% + 每強化 +1%，命中與否皆判定
    if (wpn.spellProc || wpn.procSkill) {
        let _en = capWpnEn(wpnInst.en);
        if (Math.random() * 100 < ((wpn.procRateBase || 1) + (wpn.procRatePerEn != null ? wpn.procRatePerEn : 1) * _en)) {
            let st = _allyProcTarget(target);
            if (st) { if (wpn.spellProc) allyProcWeaponSpell(ally, st, wpn.spellProc, _en); else allyProcFreeMagicSkill(ally, st, wpn.procSkill, _en); }
        }
    }
    // 🔧 蕾雅魔杖（meleeHitSpell）：命中時觸發冰裂術（與玩家一致；作用於命中的目標）
    if (hitInfo && hitInfo.hit && wpn.meleeHitSpell && target && target.curHp > 0) allyLaiaWandHitProc(ally, target);
}
// 命中後物理特效：穿透 / 骰子匕首即死 / 匕首·矛出血 / 單手鈍器鈍擊 / 雙手劍切割
function allyOnHitEffects(ally, t, res) {
    let wpnInst = ally.eq && ally.eq.wpn;
    if (!wpnInst) return;
    let wpn = DB.items[wpnInst.id];
    if (!wpn) return;
    let d = ally.d || {};
    if (wpn.eff === 'pierce' && !ally.classicMode) {   // 穿透：場上有其他敵人時，依機率額外攻擊另一名敵人（各自獨立判定命中）；🎮 經典模式：傭兵停用穿透
        let pc = (wpn.pierceChance !== undefined) ? wpn.pierceChance : 100;
        let others = [];
        mapState.mobs.forEach((m, i) => { if (m && m.curHp > 0 && !m._dead && m.uid !== t.uid) others.push(i); });
        if (others.length > 0 && roll(1, 100) <= pc) {
            // 🔧 傭兵穿透精通：穿透變全體攻擊；該傷害 100% 無視硬皮值（加回主目標硬皮量）
            let _allyPierce = allyHasMastery(ally, 'k_pierce');
            let _pT = _allyPierce ? others : [others[Math.floor(Math.random() * others.length)]];
            let _pd = res.dmg;
            if (_allyPierce && (res.hardSkin || 0) > 0) _pd += res.hardSkin;
            _pT.forEach(_ix => {
                let exT = mapState.mobs[_ix];
                if (!exT || exT.curHp <= 0 || exT._dead) return;
                // 🔧 穿透：每個波及目標各自獨立判定是否命中（依該怪 AC/等級），未命中則不造成傷害
                if (!allyStrikeRoll(ally, exT, {}).hit) {
                    logCombat(`<span class="text-sky-300 font-bold">【協力·${ally._allyName}·穿透】</span>對 <span class="${getMobColor(exT.lv)}">${exT.n}</span> 的攻擊未命中。`, 'miss');
                    return;
                }
                logCombat(`<span class="text-sky-300 font-bold">【協力·${ally._allyName}·穿透】</span>順勢命中 <span class="${getMobColor(exT.lv)}">${exT.n}</span>，造成 ${_pd} 點傷害。`, 'player');
                _allyDamageMob(ally, exT, _pd, getWpnEle(wpnInst, wpn));
            });
        }
    }
    if (wpn.eff === 'dice_death' && t.curHp > 0 && !t._dead) {   // 骰子匕首：1% 即死（非 BOSS）
        let ri = mapState.mobs.findIndex(m => m && m.uid === t.uid);
        if (ri !== -1) tryInstakill(t, { p: 0.01, tag: null }, `【協力·${ally._allyName}】骰子匕首`, ri);
    }
    // 匕首/矛：力量/60 機率出血；🔧 出血精通：雙刀也比照匕首觸發（力量/60）；匕首/矛/雙刀皆可疊 10 層、每秒總傷害 ×(1+0.1×層)
    let _allyCanBleed = weaponHasBleed(wpnInst.id) || (allyHasMastery(ally, 'd_bleed') && getWeaponTags(wpnInst.id).includes('雙刀'));
    let _bleedChance = _allyCanBleed ? ((d.str||0)/60) : 0;
    if (_bleedChance > 0 && t.curHp > 0 && !t._dead && !ally.classicMode && Math.random() < _bleedChance) {   // 🎮 經典模式：傭兵停用出血
        applyBleed(t, res.dmg, allyHasMastery(ally, 'd_bleed') ? 10 : 5, allyHasMastery(ally, 'd_bleed'));   // 🔧 出血精通：上限 10 層 + 每層 +10%
    }
    if (getWeaponTags(wpnInst.id).includes('單手鈍器') && t.curHp > 0 && !t._dead && !ally.classicMode) {   // 鈍擊：延遲目標攻擊 1 秒；🎮 經典模式：傭兵停用鈍擊
        t._bluntShow = state.ticks + 30;
        if (!t._bluntDelayed) {
            if (t._atkCd === undefined) t._atkCd = Math.max(1, Math.floor((t.atkSpd || 2) * 10));
            t._atkCd += 10;
            t._bluntDelayed = true;
        }
        wearHardSkin(t, wpnInst.id, false, true);   // 🔧 硬皮消磨：傭兵單手鈍器鈍擊 -1
    }
    if (res.heavy && wpn.eff === 'cleave' && !ally.classicMode) {   // 切割：重擊時自身攻速 +20%；🎮 經典模式：傭兵停用切割
        if (!(ally._cleaveTicks > 0)) logCombat(`<span class="text-teal-300 font-bold">【協力·${ally._allyName}】流暢的手感，攻速提升！</span>`, 'player');
        ally._cleaveTicks = allyHasMastery(ally, 'k_cleave') ? 40 : 20;   // 🔧 傭兵切割精通：持續4秒
    }
    if (ally._setWhiteBird5 && t.curHp > 0 && !t._dead) { if (!t.st) t.st = newMobStatus(); t.st.fragile = 30; }   // 🔮 白鳥 5/5（傭兵快照）：命中附加脆弱
}
// 🔧 受擊觸發（判定「主操控玩家」受擊/迴避，傭兵代為反制攻擊者）
// 反擊：傭兵持單手劍 → 玩家被命中 50%（玩家觸發格檔則必定）；必中、不重擊、傷害 50%
// 🔮 鐵衛 5/5（傭兵）：觸發反擊/居合時，額外對全體敵人各做一次一般攻擊（各自正常命中判定）
function allyIronGuardSweep(ally, triggerName) {
    if (!ally || !ally._setIron5) return;
    let targets = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
    if (!targets.length) return;
    logCombat(`<span class="font-bold" style="color:#93c5fd;text-shadow:0 0 6px #3b82f6;">【協力·${ally._allyName}·鐵衛5/5】</span>${triggerName}引動鋼鐵之勢，橫掃全體敵人！`, 'player');
    targets.forEach(m => {
        if (!m || m.curHp <= 0 || m._dead) return;
        let r = allyStrikeRoll(ally, m, {});
        if (!r.hit) { logCombat(`橫掃 <span class="${getMobColor(m.lv)}">${m.n}</span> 未命中。`, 'miss'); return; }
        logCombat(`橫掃命中 <span class="${getMobColor(m.lv)}">${m.n}</span>，造成 ${r.dmg} 點傷害。`, 'player');
        _allyDamageMob(ally, m, r.dmg, getWpnEle(ally.eq.wpn, DB.items[ally.eq.wpn.id]));
    });
}
function allyReactCounter(mob, blocked) {
    if (!player.allies || !player.allies.length) return;
    player.allies.forEach(ally => {
        if (!ally || !ally.eq || !ally.eq.wpn) return;
        if (ally.classicMode) return;   // 🎮 經典模式：傭兵停用反擊
        if (!mob || mob._dead || mob.curHp <= 0) return;   // 攻擊者已被前一位傭兵反殺則停止
        if (!getWeaponTags(ally.eq.wpn.id).includes('單手劍')) return;
        if (getWeaponTags(ally.eq.wpn.id).includes('武士刀') && !(ally.eq.shield && !_isArmguard(ally.eq.shield))) return;   // 🛡️ 反擊/居合雙標籤武器「無真盾牌(空手或臂甲)」時→走居合、不發動反擊（唯獨裝真盾牌才反擊）
        let _ctr = allyHasMastery(ally, 'k_counter');   // 🔧 傭兵反擊精通：必定發動、傷害+30%
        if (!_ctr && Math.random() >= (blocked ? 1 : 0.50)) return;
        let res = allyStrikeRoll(ally, mob, { forceHit: true, noHeavy: true, mult: _ctr ? 0.65 : 0.50, forceCrit: _ctr });
        logCombat(`<span class="font-bold" style="color:#fbbf24;text-shadow:0 0 6px #f59e0b;">【協力·${ally._allyName}·反擊】</span>對 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 造成 ${res.dmg} 點傷害${res.crit?'（爆擊!）':''}。`, 'player');
        if (_ctr) wearHardSkin(mob, null, false, false, true);   // 🏅 傭兵反擊精通：反擊命中削減 1 硬皮值
        _allyDamageMob(ally, mob, res.dmg, getWpnEle(ally.eq.wpn, DB.items[ally.eq.wpn.id]));
        allyIronGuardSweep(ally, '反擊');   // 🔮 鐵衛 5/5（傭兵）
    });
}
// 居合：傭兵持武士刀且未裝「真盾牌」（臂甲可發動） → 玩家迴避或敵人未命中時 50%；必中、可自然重擊/爆擊
function allyReactIai(mob) {
    if (!player.allies || !player.allies.length) return;
    player.allies.forEach(ally => {
        if (!ally || !ally.eq || !ally.eq.wpn || (ally.eq.shield && !_isArmguard(ally.eq.shield))) return;
        if (ally.classicMode) return;   // 🎮 經典模式：傭兵停用居合
        if (!mob || mob._dead || mob.curHp <= 0) return;
        if (!getWeaponTags(ally.eq.wpn.id).includes('武士刀')) return;
        let _iai = allyHasMastery(ally, 'k_counter');   // 🔧 傭兵反擊精通：居合必定發動、傷害+30%
        if (!_iai && Math.random() >= 0.50) return;
        let res = allyStrikeRoll(ally, mob, { forceHit: true, forceCrit: _iai });
        if (_iai) res.dmg = Math.max(1, Math.floor(res.dmg * 1.3));
        let mark = (res.heavy && res.crit) ? '會心一擊' : (res.crit ? '爆擊' : (res.heavy ? '重擊' : ''));
        logCombat(`<span class="font-bold" style="color:#a5f3fc;text-shadow:0 0 6px #06b6d4;">【協力·${ally._allyName}·居合】</span>對 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 造成 ${res.dmg} 點傷害${mark?'（'+mark+'!）':''}。`, 'player');
        wearHardSkin(mob, null, res.heavy, false, _iai);   // 🔧 傭兵居合重擊 -2；🏅 反擊精通：居合命中再削減 1 硬皮值（疊加）
        _allyDamageMob(ally, mob, res.dmg, getWpnEle(ally.eq.wpn, DB.items[ally.eq.wpn.id]));
        allyIronGuardSweep(ally, '居合');   // 🔮 鐵衛 5/5（傭兵）
    });
}

// 妖精協力：三重矢（3 次物理攻擊）後整體判定一次連射
function allyTripleShot(ally) {
    logCombat(`<span class="text-sky-300 font-bold">【協力·${ally._allyName}】</span>施放 三重矢！`, 'player');
    for (let h = 0; h < 3; h++) {
        let t = getTarget(); if (!t || t.curHp <= 0) break;
        allyAttackOnce(ally);
    }
    allyRapidfire(ally);
}
// 妖精協力一次行動：選定三重矢且裝弓且 MP 足夠→優先施放三重矢；否則一般攻擊；攻擊後判定連射
function allyElfAct(ally) {
    let t = getTarget(); if (!t || t.curHp <= 0) return;
    let d = ally.d || {};
    let sk = DB.skills[ally._atkSkill];
    if (ally._atkSkill === 'sk_elf_triple' && sk) {
        // 三重矢優先：裝弓且 MP 足夠
        let wpn = (ally.eq && ally.eq.wpn) ? DB.items[ally.eq.wpn.id] : null;
        let hasBow = !!(wpn && wpn.isBow);
        let cost = Math.max(1, Math.ceil((sk.mp||0) * (1 - (d.mpReduce||0)/100)));
        if (ally._setApprentice5 && (ally.mp||0) < (ally.mmp||0) * 0.3) cost = Math.max(1, Math.ceil(cost / 2));   // 🔮 學徒 5/5（傭兵）：MP<30% 耗魔減半
        if (hasBow && (ally.mp||0) >= cost) { ally.mp -= cost; allyTripleShot(ally); return; }
    } else if (sk && sk.type === 'atk' && sk.dmgType !== 'physical' && (sk.dmgDice || sk.multiDmg)) {
        // 傷害魔法：比照法師，MP 足夠則優先施放（妖精魔法不享有法師倍率，由 allyCastMagic 依職業處理）
        let cost = Math.max(1, Math.ceil((sk.mp||0) * (1 - (d.mpReduce||0)/100)));
        if (ally._setApprentice5 && (ally.mp||0) < (ally.mmp||0) * 0.3) cost = Math.max(1, Math.ceil(cost / 2));   // 🔮 學徒 5/5（傭兵）：MP<30% 耗魔減半（與魔導精通疊加）
        if (allyHasMastery(ally, 'e_magic') && sk.ele && sk.ele !== 'none' && sk.ele === ally.elfEle) cost = Math.max(1, Math.ceil(cost * 0.7));   // 🏅 魔導精通（傭兵）：同屬性魔法消耗MP -30%
        if ((ally.mp||0) >= cost) { ally.mp -= cost; allyCastMagic(ally, sk); return; }
    } else if (sk && sk.type === 'atk' && (sk.status || sk.instakill)) {
        if (allyCastNonDamage(ally, sk)) return;   // 🔧 非傷害攻擊技能（地面障礙/魔法消除/封印禁地/釋放元素…）；不適用則退回物理攻擊+連射
    }
    // 退回一般物理攻擊 + 連射（三重矢/魔法 MP 不足、或未選攻擊技能時）
    allyAttackOnce(ally);
    allyRapidfire(ally);
}
// 黑暗妖精協力一次行動：依設定攻擊技能施放破壞盔甲(目標無此狀態且MP足夠)或會心一擊(MP滿)；否則一般攻擊（含連擊與精通）
function allyDarkAct(ally) {
    let t = getTarget(); if (!t || t.curHp <= 0) return;
    if (ally._atkSkill === 'sk_dark_armorbreak') {
        let sk = DB.skills['sk_dark_armorbreak']; let d = ally.d || {};
        let cost = Math.max(1, Math.ceil(((sk && sk.mp) || 0) * (1 - (d.mpReduce || 0) / 100)));
        if (ally._setApprentice5 && (ally.mp || 0) < (ally.mmp || 0) * 0.3) cost = Math.max(1, Math.ceil(cost / 2));   // 🔮 學徒 5/5（傭兵）：MP<30% 耗魔減半
        if (sk && sk.status && !(t.st && t.st[sk.status.kind] > 0) && (ally.mp || 0) >= cost) {
            ally.mp -= cost;
            logCombat(`<span class="text-emerald-300 font-bold">【協力·${ally._allyName}】</span>施放 ${sk.n}，撕裂 <span class="${getMobColor(t.lv)}">${t.n}</span> 的防護！（受傷提高，持續 ${sk.status.dur||8} 秒）`, 'magic');
            let _sv = player; player = ally; try { applyMobStatus(t, sk.status, sk.n); } finally { player = _sv; }   // 以傭兵自身魔法命中判定
            return;
        }
    } else if (ally._atkSkill === 'sk_dark_crit') {
        // 🔧 會心一擊（傭兵版）：只有 MP 滿才施放，且只消耗 MP（不扣 HP）
        if ((ally.mmp || 0) > 0 && (ally.mp || 0) >= (ally.mmp || 0)) { allyDarkCrit(ally, t); return; }
    } else {
        let _sk = DB.skills[ally._atkSkill];   // 🔧 其他非傷害攻擊技能（純異常狀態/即死）：通用施放；不適用則退回一般攻擊
        if (_sk && _sk.type === 'atk' && (_sk.status || _sk.instakill) && allyCastNonDamage(ally, _sk)) return;
    }
    allyAttackOnce(ally);
}
// 騎士協力一次行動：依設定攻擊技能施放——物理技(衝擊之暈)、傷害魔法(光箭/冰箭/風刃)、或非傷害狀態/即死技；皆不適用(無目標/武器不符/MP不足)則退回一般攻擊(含看破/殺戮被動)
function allyKnightAct(ally) {
    let t = getTarget(); if (!t || t.curHp <= 0) { allyAttackOnce(ally); return; }
    let sk = DB.skills[ally._atkSkill];
    let d = ally.d || {};
    if (sk && sk.type === 'atk') {
        if (sk.dmgType === 'physical') {
            if (allyCastPhysicalSkill(ally, sk)) return;                                   // 衝擊之暈等物理技
        } else if (sk.dmgDice || sk.multiDmg) {
            let cost = Math.max(1, Math.ceil((sk.mp || 0) * (1 - (d.mpReduce || 0) / 100)));   // 騎士可學的傷害魔法（光箭/冰箭/風刃；無法師倍率，由 allyCastMagic 依職業處理）
            if (ally._setApprentice5 && (ally.mp || 0) < (ally.mmp || 0) * 0.3) cost = Math.max(1, Math.ceil(cost / 2));   // 🔮 學徒 5/5（傭兵）：MP<30% 耗魔減半
            if ((ally.mp || 0) >= cost) { ally.mp -= cost; allyCastMagic(ally, sk); return; }
        } else if (sk.status || sk.instakill) {
            if (allyCastNonDamage(ally, sk)) return;                                       // 非傷害狀態/即死技（騎士目前學不到，保留通用分支）
        }
    }
    allyAttackOnce(ally);
}
// ⚔️ 戰士協力一次行動：依設定攻擊技能施放——咆哮（roarFixed・對全體造成 50+(等級-30) 固定無屬性傷害，不計 MR/DR/元素）；無此技／MP不足／無敵人則退回一般攻擊（含迅猛雙斧/狂暴等普攻特效）
function allyWarriorAct(ally) {
    let t = getTarget(); if (!t || t.curHp <= 0) { allyAttackOnce(ally); return; }
    let sk = DB.skills[ally._atkSkill];
    let d = ally.d || {};
    if (sk && sk.type === 'atk' && sk.roarFixed) {                                          // ⚔️ 咆哮：全體固定傷害（戰士唯一主動攻擊技）
        let targets = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
        if (targets.length) {
            let cost = Math.max(1, Math.ceil((sk.mp || 0) * (1 - (d.mpReduce || 0) / 100)));
            if (ally._setApprentice5 && (ally.mp || 0) < (ally.mmp || 0) * 0.3) cost = Math.max(1, Math.ceil(cost / 2));   // 🔮 學徒 5/5（傭兵）：MP<30% 耗魔減半
            if ((ally.mp || 0) >= cost) {
                ally.mp -= cost;
                let base = 50 + Math.max(0, (ally.lv || 1) - 30);
                targets.forEach(m => { if (!m || m.curHp <= 0 || m._dead) return; let dmg = Math.max(1, Math.floor(base * fragileMult(m))); dmg = Math.max(1, Math.floor(dmg * royalAllyMult()));   /* 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100) */ m.curHp -= dmg; m.justHit = 'magic'; mobWake(m); });
                logCombat(`<span class="font-bold" style="color:#fca5a5;text-shadow:0 0 6px #dc2626;">【協力·${ally._allyName}·咆哮】</span>咆哮震懾全場，對所有敵人造成約 ${base} 點固定傷害。`, 'player-special');   // _combatSrc='mercenary' 期間→自動歸傭兵來源
                targets.forEach(m => { if (m && m.curHp <= 0 && !m._dead) { let i = mapState.mobs.findIndex(x => x && x.uid === m.uid); if (i !== -1) killMob(i); } });
                renderMobs();
                return;
            }
        }
    }
    allyAttackOnce(ally);
}
// 👑 王族協力一次行動：依設定攻擊技能施放——呼喚盟友（callAllies・所有上場傭兵立即各發動一次額外一般攻擊）；無傭兵／MP不足則退回一般攻擊。其餘王族技皆為增益(buff)/被動，傭兵不自動施放（與其他職業傭兵一致；王者加護被動由 recomputeStats 已套）
function allyRoyalAct(ally) {
    let t = getTarget(); if (!t || t.curHp <= 0) { allyAttackOnce(ally); return; }
    let sk = DB.skills[ally._atkSkill];
    let d = ally.d || {};
    if (sk && sk.type === 'atk' && sk.callAllies) {                                          // 👑 呼喚盟友：號召所有傭兵各補一刀
        let allies = (player.allies || []).filter(a => a && a.curHp > 0);
        let cost = Math.max(1, Math.ceil((sk.mp || 0) * (1 - (d.mpReduce || 0) / 100)));
        if (allyHasMastery(ally, 'k_royal_pledge')) cost = Math.ceil(cost / 2);              // 🏅 血盟精通（傭兵）：呼喚盟友消耗 MP 減半
        if (ally._setApprentice5 && (ally.mp || 0) < (ally.mmp || 0) * 0.3) cost = Math.max(1, Math.ceil(cost / 2));   // 🔮 學徒 5/5（傭兵）：MP<30% 耗魔減半
        if (allies.length && (ally.mp || 0) >= cost) {
            ally.mp -= cost;
            logCombat(`<span class="text-amber-300 font-bold">【協力·${ally._allyName}·呼喚盟友】</span>號召盟友一同出擊！`, 'player-special');   // _combatSrc='mercenary' 期間→自動歸傭兵來源
            allies.forEach(a => { try { allyAttackOnce(a); } catch(e){} });                 // 含自己在內各補一次普攻；allyAttackOnce 為純普攻不會再觸發技能→無遞迴
            return;
        }
    }
    allyAttackOnce(ally);
}
// 🐉 龍騎士協力一次行動：依設定攻擊技能施放——傷害魔法(岩漿噴吐/岩漿之箭/奪命之雷)、屠宰者(物理多段)、控制(護衛毀滅/恐懼無助/驚悚死神)；皆不適用則退回一般攻擊(含鎖鏈劍特效/弱點曝光/吸血)
// ⚠️ 傭兵不付技能 HP 消耗：傭兵無 HP 再生且不被攻擊(ally.hp 僅吸血會增)，若扣 HP 則龍騎士 mp:0 的技能只能放數次後永久停擺；故僅付 MP（MP 有再生），效果等同玩家被再生支撐的連續施放。
function allyDragonAct(ally) {
    let t = getTarget(); if (!t || t.curHp <= 0) { allyAttackOnce(ally); return; }
    let sk = DB.skills[ally._atkSkill];
    if (sk && sk.type === 'atk') {
        // 🐉 龍騎士傭兵改吃 HP（資源＝HP，顯示也以 HP 為準）：HP 不足以負擔技能消耗 → 退回普攻；施放成功才扣 HP，且絕不會把傭兵打死（下限 1，傭兵不陣亡）。其餘 ally 子函式對 sk.mp=0 只扣 0 MP，故不重複扣。
        let _hpCost = sk.hpCost || 0;
        // 🛡️ HP 安全線（隊伍面板設定）：HP% 低於安全線→暫停施放「消耗 HP 的技能」(退回普攻·不再自殘)；安全線=0＝關閉（維持原行為）
        let _safe = ally._hpSafePct || 0;
        let _aboveSafe = (_safe <= 0) || ((ally.curHp || 0) > (ally.mhp || 1) * _safe / 100);
        if (_aboveSafe && (ally.curHp || 0) > _hpCost) {
            let _cast = false;
            if (sk.dmgDice || sk.multiDmg) { allyCastMagic(ally, sk); _cast = true; }   // 岩漿噴吐/岩漿之箭/奪命之雷（傷害魔法；奪命之雷的暈由 allyCastMagic 套狀態）
            else if (sk.slaughter) { _cast = allyCastSlaughter(ally, sk); }              // 屠宰者
            else if (sk.fixedStatus) { _cast = allyCastFixedStatus(ally, sk); }          // 護衛毀滅/恐懼無助/驚悚死神
            else if (sk.dmgType === 'physical') { _cast = allyCastPhysicalSkill(ally, sk); }
            else if (sk.status || sk.instakill) { _cast = allyCastNonDamage(ally, sk); }
            if (_cast) { ally.curHp = Math.max(1, (ally.curHp || 0) - _hpCost); return; }
        }
    }
    allyAttackOnce(ally);
}
// 🔮 幻術士協力一次行動：依設定攻擊技能施放——心靈破壞(消耗MP=傷害)、粉碎能量/骷髏毀壞(物理)、混亂/幻想(傷害魔法+附帶混亂/沉睡)、恐慌(純狀態)；皆不適用則退回奇古獸/一般攻擊
function allyIllusionAct(ally) {
    let t = getTarget(); if (!t || t.curHp <= 0) { allyAttackOnce(ally); return; }
    let sk = DB.skills[ally._atkSkill]; let d = ally.d || {};
    if (sk && sk.type === 'atk') {
        if (sk.tagReq && !mobHasTag(t, sk.tagReq)) { allyAttackOnce(ally); return; }   // 骷髏毀壞：只對不死，否則退回奇古獸普攻（與玩家 9196 一致）
        if (sk.mpDmgPct) {                                          // 心靈破壞
            if (allyCastMpDmg(ally, sk)) return;
        } else if (sk.magScale) {                                   // 粉碎能量：武器傷害＋近/遠傷害＋強化值，整體乘魔法傷害加成
            if (allyCastCrush(ally, sk)) return;
        } else if (sk.weaponDmg || sk.dmgType === 'physical') {     // 骷髏毀壞（物理武器傷害）
            if (allyCastPhysicalSkill(ally, sk)) return;
        } else if (sk.dmgDice || sk.multiDmg) {                     // 混亂/幻想（傷害魔法 + 附帶 混亂/沉睡，由 allyCastMagic 套狀態）
            let cost = (sk.mp || 0) > 0 ? Math.max(1, Math.ceil(sk.mp * (1 - (d.mpReduce || 0) / 100))) : 0;
            if (cost > 0 && ally._setApprentice5 && (ally.mp || 0) < (ally.mmp || 0) * 0.3) cost = Math.max(1, Math.ceil(cost / 2));   // 🔮 學徒 5/5（傭兵）：MP<30% 耗魔減半
            if ((ally.mp || 0) >= cost) { ally.mp -= cost; allyCastMagic(ally, sk); return; }
        } else if (sk.status || sk.instakill) {                     // 恐慌（純狀態）
            if (allyCastNonDamage(ally, sk)) return;
        }
    }
    allyAttackOnce(ally);
}
// 🔮 幻術士傭兵 立方（常駐光環）：已學會的立方即視為常駐展開（傭兵無手動開關），每 cube.iv ticks 觸發一次。效果同玩家 cubeTick（dmg=全體傷害/slow=全體緩速/mrdown=目標魔抗減半/mp=自身回MP），但改用傭兵自身等級/MP；
//   狀態命中換身用傭兵衍生值（abnormalMagicHit 讀 player.*），傷害換算 summonElementDamage 為純函式（不需換身），擊殺仍由 killMob 歸玩家（經驗/金錢）。安全區(村莊)不展開。
function allyCubeTick(ally) {
    if (!ally || ally.dead || !state.running || ally.cls !== 'illusion' || !ally.skills) return;
    if (mapState.current && mapState.current.startsWith('town_')) return;   // 🔮 安全區(村莊)不展開（同玩家 cubeTick gate）
    ally._cubeCd = ally._cubeCd || {};
    ally.skills.forEach(sid => {
        let sk = DB.skills[sid];
        if (!sk || !sk.cube) return;   // 🔮 已學會的立方＝常駐光環（不需 buffs 開關）
        if ((ally._cubeCd[sid] = (ally._cubeCd[sid] || sk.cube.iv) - 1) > 0) return;
        ally._cubeCd[sid] = sk.cube.iv;
        let c = sk.cube;
        if (c.kind === 'mp') { ally.mp = Math.min(ally.mmp || 0, (ally.mp || 0) + (c.val || 5)); return; }   // 純回MP立方（保留·目前無技能使用）
        if (c.kind === 'dmgmp') {   // 🔮 立方：和諧（傭兵）→ 對「當前目標」單體屬性傷害 ＋ 傭兵自身回MP
            ally.mp = Math.min(ally.mmp || 0, (ally.mp || 0) + (c.val || 5));
            let t = getTarget();
            if (t && t.curHp > 0 && !t._dead) {
                let dd = Math.max(1, Math.floor(summonElementDamage(c.dice, c.ele || 'none', t, 0, 1) * illuLvMult(ally) * wpnEnFinalMult(ally.eq && ally.eq.wpn)));   // 🔮 傭兵等級加成；固定數值DoT→乘武器最終傷害加成
                dd = Math.max(1, Math.floor(dd * royalAllyMult()));   // 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100)
                t.curHp -= dd; t.justHit = (c.ele && c.ele !== 'none') ? c.ele : 'magic'; mobWake(t);
                logCombat(`<span class="text-emerald-300 font-bold">【協力·${ally._allyName}】</span>的【${sk.n}】對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dd} 點傷害。`, 'dot', 'mercenary');   // 🟢 立方傷害＝DoT(綠)、傭兵來源
                if (t.curHp <= 0) { let i = mapState.mobs.findIndex(x => x && x.uid === t.uid); if (i !== -1) killMob(i); }   // 擊殺歸玩家（killMob 不換身）
                renderMobs();
            }
            return;
        }
        let live = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
        if (!live.length) return;
        if (c.kind === 'dmg') {
            let txt = [];
            live.forEach(m => { let dd = Math.max(1, Math.floor(summonElementDamage(c.dice, c.ele || 'none', m, 0, 1) * illuLvMult(ally) * wpnEnFinalMult(ally.eq && ally.eq.wpn))); dd = Math.max(1, Math.floor(dd * royalAllyMult()));   /* 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100) */ m.curHp -= dd; m.justHit = (c.ele && c.ele !== 'none') ? c.ele : 'magic'; mobWake(m); txt.push(dd); });   // 🔮 立方傷害：傭兵等級加成 ×(1+等級/50)；🔧 固定數值DoT→乘武器最終傷害加成(施法者武器 +11~+20)
            logCombat(`<span class="text-emerald-300 font-bold">【協力·${ally._allyName}】</span>的【${sk.n}】對全體造成 ${txt.join('、')} 點傷害。`, 'dot', 'mercenary');   // 🟢 立方傷害＝DoT(綠)、傭兵來源
            live.forEach(m => { if (m.curHp <= 0) { let i = mapState.mobs.findIndex(x => x && x.uid === m.uid); if (i !== -1) killMob(i); } });   // 擊殺歸玩家（killMob 不換身）
            renderMobs();
        } else {   // slow / mrdown：狀態命中換身用傭兵 lv/magicHit（abnormalMagicHit 讀 player.*）
            let _sv = player; player = ally;
            try {
                if (c.kind === 'slow') live.forEach(m => applyMobStatus(m, { kind: 'slow', pbase: 150, dur: 4 }, sk.n));
                else if (c.kind === 'mrdown') { let t = getTarget(); if (t && t.curHp > 0) applyMobStatus(t, { kind: 'mrhalf', pbase: 200, dur: c.dur || 4 }, sk.n); }
            } finally { player = _sv; }
        }
    });
}
// 🌨️🔥 傭兵 持續傷害型增益（冰雪颶風/火牢）：已學會即視為常駐展開（傭兵無手動開關），每 stormInterval ticks 對全體造成該屬性魔法傷害。
//   公式鏡像玩家 stormBuffTick（js/04），改用傭兵自身 magicDmg/cls/magicCrit/武器最終倍率；冰凍命中換身用傭兵 lv/magicHit；擊殺仍歸玩家（killMob 不換身）。
function allyStormTick(ally, sk, noMageBonus) {
    if (!ally || ally.dead || !sk || !state.running) return;
    let targets = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
    if (!targets.length) return;
    let d = ally.d || {};
    let tier = sk.tier || 1;
    let spCoef = (1 + 3 * (d.magicDmg || 0) / 16) * (1 + tier / 3);
    let mageDmgMult = (!noMageBonus && ally.cls === 'mage') ? (1.5 + tier / 20) : 1.0;   // 🔮 魔女5/5 免費冰雪暴：noMageBonus 不吃法師階級加成
    let dice = sk.dmgDice || [1, 10];
    let canFreeze = (sk.freezeHitOff !== undefined);
    let glow = STORM_ELE_GLOW[sk.ele] || STORM_ELE_GLOW.none;
    let wpnMult = wpnEnFinalMult(ally.eq && ally.eq.wpn);   // 🔧 武器強化 +11~+20 最終倍率
    let dmgLog = [], frozeLog = [];
    targets.forEach(t => {
        if (t.curHp <= 0) return;
        let isCrit = Math.random() * 100 < (d.magicCrit || 0);
        let critMult = isCrit ? (1 + (d.magicCritDmg || 0) / 100) : 1.0;
        let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
        let mrFactor = mrMult(effMr);
        let core = roll(dice[0], dice[1]) * spCoef * critMult;
        let dmg = Math.floor((core + (d.extraMp || 0)) * mrFactor) - (t.dr || 0);
        dmg = Math.max(1, dmg);
        dmg = Math.floor(dmg * mageDmgMult);
        if (ally._setRedLion5) dmg = Math.floor(dmg * 1.2);   // 🔮 紅獅 5/5（傭兵）
        dmg = Math.max(1, Math.floor(dmg * fragileMult(t) * wpnMult));   // 🔮 脆弱（白鳥5）；🔧 武器最終倍率
        dmg = Math.max(1, Math.floor(dmg * elementCounterMult(sk.ele, t.e)));   // ⚔️ 屬性剋制倍率（取代舊 +6 固定加值）
        dmg = Math.max(1, Math.floor(dmg * royalAllyMult()));   // 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100)
        t.curHp -= dmg; t.justHit = (sk.ele && sk.ele !== 'none') ? sk.ele : 'magic'; mobWake(t);
        dmgLog.push(`<span class="${getMobColor(t.lv)}">${t.n}</span> ${dmg}${isCrit ? '(爆)' : ''}`);
        if (t.curHp <= 0) {
            let ri = mapState.mobs.findIndex(x => x && x.uid === t.uid); if (ri !== -1) killMob(ri);   // 擊殺歸玩家
        } else if (canFreeze && !(t.boss && BOSS_IMMUNE.includes('freeze'))) {
            let _sv = player; player = ally; let _hit = false;   // 冰凍命中換身用傭兵 lv/magicHit
            try { _hit = abnormalMagicHit(t, 20, sk.freezeHitOff); } finally { player = _sv; }
            if (_hit) { if (!t.st) t.st = newMobStatus(); t.st.freeze = 60; frozeLog.push(`<span class="${getMobColor(t.lv)}">${t.n}</span>`); }
        }
    });
    if (dmgLog.length) logCombat(`<span class="font-bold" style="color:${glow};">【協力·${ally._allyName}】${sk.n}</span> ${dmgLog.join('、')}`, 'dot', 'mercenary');
    if (frozeLog.length) logCombat(`<span class="text-sky-300 font-bold">${ally._allyName} 的 ${sk.n}</span> 冰凍了 ${frozeLog.join('、')}！`, 'magic', 'mercenary');
    if (!state.ff) renderMobs();
}
// 🔮 傭兵粉碎能量：基礎＝武器傷害(目標大小)＋近/遠距離傷害(依武器)＋強化值，整體乘魔法傷害加成(1+魔法傷害/16)，不計武器特效；🔮 魔法技能→必定命中、不扣 DR/硬皮。回傳 true=已施放；false=MP不足→退回普攻
function allyCastCrush(ally, sk) {
    let t = getTarget(); if (!t || t.curHp <= 0) return false;
    let d = ally.d || {};
    let cost = (sk.mp || 0) > 0 ? Math.max(1, Math.ceil(sk.mp * (1 - (d.mpReduce || 0) / 100))) : 0;
    if ((ally.mp || 0) < cost) return false;
    ally.mp -= cost;
    // 🦴 骷髏毀壞（傭兵）：先即死判定（起死回生式·vs不死非BOSS·以傭兵魔法命中換身判定）；成功則擊殺、不造成傷害（粉碎能量無 instakill→跳過）
    if (sk.instakill) {
        let _sv = player; player = ally; let _ok = false;
        try { let _idx = mapState.mobs.findIndex(m => m && m.uid === t.uid); if (_idx !== -1 && tryInstakill(t, sk.instakill, sk.n, _idx, true)) _ok = true; } finally { player = _sv; }
        if (_ok) { let _i = mapState.mobs.findIndex(m => m && m.uid === t.uid); if (_i !== -1) killMob(_i); renderMobs(); return true; }
    }
    let wpn = (ally.eq && ally.eq.wpn) ? DB.items[ally.eq.wpn.id] : null;
    let dice = wpn ? (t.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;
    let enB = (wpn && ally.eq.wpn) ? enhanceWpnBonus(ally.eq.wpn.en).dmg : 0;   // 強化值加成
    let _rng = !!(wpn && (wpn.isBow || wpn.ranged));
    let _dmgB = _rng ? (d.rangedDmg || 0) : (d.meleeDmg || 0);
    let _base = roll(1, dice) + _dmgB + enB + (sk.weaponFlat || 0);
    let dmg = Math.max(1, Math.floor(_base * (1 + (d.magicDmg || 0) / 16))) + (sk.flatBonus || 0);   // 🔮 魔法技能：必定命中、不受DR/硬皮；🦴 骷髏毀壞 +flatBonus(20) 固定傷害（粉碎能量無此欄位→+0）
    dmg = Math.max(1, Math.floor(dmg * fragileMult(t) * illuLvMult(ally) * wpnEnFinalMult(ally.eq && ally.eq.wpn)));   // 🔮 幻術士(傭兵)等級加成 ×(1+等級/50)；🔧 武器強化 +11~+20 最終倍率
    dmg = Math.max(1, Math.floor(dmg * elementCounterMult(getWpnEle(ally.eq ? ally.eq.wpn : null, wpn), t.e)));   // ⚔️ 武器屬性剋制倍率（粉碎能量）
    dmg = Math.max(1, Math.floor(dmg * royalAllyMult()));   // 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100)
    t.curHp -= dmg; t.justHit = getWpnEle(ally.eq ? ally.eq.wpn : null, wpn); mobWake(t);
    logCombat(`<span class="text-emerald-300 font-bold">【協力·${ally._allyName}】</span>施放 ${sk.n}，對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dmg} 點傷害。`, 'magic');
    let ri = mapState.mobs.findIndex(m => m && m.uid === t.uid);
    if (t.curHp <= 0) { if (ri !== -1) killMob(ri); } else renderMobs();
    return true;
}
// 🐉 傭兵控制系異常技（護衛毀滅/恐懼無助/驚悚死神）：固定機率施加自訂異常狀態（比照玩家 castSkillInner 9178；傭兵不付 HP，僅付 MP）。回傳 true=已施放；false=已有狀態/MP不足→退回普攻
function allyCastFixedStatus(ally, sk) {
    let t = getTarget(); if (!t || t.curHp <= 0) return false;
    let fs = sk.fixedStatus; if (!fs) return false;
    if (sk.noRecastStatus && t.st && t.st[sk.noRecastStatus] > 0) return false;   // 已有狀態：不重複（不耗 MP）
    let d = ally.d || {};
    let cost = (sk.mp || 0) > 0 ? Math.max(1, Math.ceil(sk.mp * (1 - (d.mpReduce || 0) / 100))) : 0;
    if ((ally.mp || 0) < cost) return false;
    ally.mp -= cost;
    if (Math.random() < fs.chance) {
        if (!t.st) t.st = newMobStatus();
        t.st[fs.kind] = (fs.dur || 16) * 10;
        logCombat(`<span class="text-sky-300 font-bold">【協力·${ally._allyName}】</span>施放 ${sk.n}，<span class="${getMobColor(t.lv)}">${t.n}</span> 陷入了「${STATUS_NAME[fs.kind] || sk.n}」。`, 'magic');
        if (!state.ff) renderMobs();
    } else {
        logCombat(`<span class="text-sky-300 font-bold">【協力·${ally._allyName}】</span>施放 ${sk.n}，但未能影響 <span class="${getMobColor(t.lv)}">${t.n}</span>。`, 'miss');
    }
    return true;
}
// 🐉 傭兵屠宰者：立即 3 次近距離打擊，命中吃弱點曝光(每層+10、三刀每擊皆生效)，鎖刃精通每層最終傷害+10%、弱點精通不消耗（比照玩家 9151；傭兵不付 HP）。回傳 true=已施放；false=無近戰武器/MP不足→退回普攻
function allyCastSlaughter(ally, sk) {
    let t = getTarget(); if (!t || t.curHp <= 0) return false;
    let wpn = (ally.eq && ally.eq.wpn) ? DB.items[ally.eq.wpn.id] : null;
    if (!wpn || wpn.isBow || wpn.ranged) return false;   // 需近距離武器
    let d = ally.d || {};
    let cost = (sk.mp || 0) > 0 ? Math.max(1, Math.ceil(sk.mp * (1 - (d.mpReduce || 0) / 100))) : 0;
    if ((ally.mp || 0) < cost) return false;
    ally.mp -= cost;
    let layers = t.weakExpose || 0, bonus = layers > 0 ? 10 * layers : 0;
    let consume = layers > 0 && !allyHasMastery(ally, 'k_weakness');   // 🏅 弱點精通（傭兵）：屠宰者不消耗弱點曝光
    let _chain = allyHasMastery(ally, 'k_chainblade');
    let times = sk.hits || 3, total = 0, log = [], applied = false;
    for (let h = 0; h < times; h++) {
        if (t.curHp <= 0) break;
        let res = allyStrikeRoll(ally, t, {});
        if (!res.hit) { log.push('Miss'); continue; }
        let dmg = res.dmg;
        if (bonus > 0) { dmg += bonus; applied = true; }   // 🐉 弱點曝光（傭兵）：成功觸發後，三刀每一擊命中都吃 +10/層（不再僅首擊）
        if (_chain && t.weakExpose > 0) dmg = Math.floor(dmg * (1 + 0.1 * Math.min(5, t.weakExpose)));   // 🏅 鎖刃精通（傭兵）：每層弱點曝光最終傷害 +10%
        dmg = Math.max(1, Math.floor(dmg * elementCounterMult(getWpnEle(ally.eq ? ally.eq.wpn : null, wpn), t.e)));   // ⚔️ 武器屬性剋制倍率（屠宰者每擊）
        dmg = Math.max(1, Math.floor(dmg * royalAllyMult()));   // 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100)
        t.curHp -= dmg; t.justHit = getWpnEle(ally.eq ? ally.eq.wpn : null, wpn); total += dmg; mobWake(t);
        log.push(dmg + (res.heavy ? '(重)' : ''));
        if (t.curHp > 0) wearHardSkin(t, ally.eq && ally.eq.wpn ? ally.eq.wpn.id : null, res.heavy, false, true, ally.classicMode);
    }
    if (consume && applied) t.weakExpose = 0;
    if (total > 0) logCombat(`<span class="text-sky-300 font-bold">【協力·${ally._allyName}】</span>施放 ${sk.n}，連續斬擊 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 [${log.join(', ')}] 共 ${total} 點傷害${bonus > 0 ? `（弱點曝光 每擊+${bonus}）` : ''}。`, 'player');
    else logCombat(`<span class="text-sky-300 font-bold">【協力·${ally._allyName}】</span>施放 ${sk.n} 未命中 <span class="${getMobColor(t.lv)}">${t.n}</span>。`, 'miss');
    let ri = mapState.mobs.findIndex(m => m && m.uid === t.uid);
    if (t.curHp <= 0) { if (ri !== -1) killMob(ri); } else renderMobs();
    return true;
}
// 🔮 傭兵心靈破壞：傷害＝消耗 MP 量(最大MP5%)，無屬性受 MR（混亂/恐慌再 -10）。比照玩家 9198。回傳 true=已施放；false=MP不足→退回普攻
function allyCastMpDmg(ally, sk) {
    let t = getTarget(); if (!t || t.curHp <= 0) return false;
    let spend = Math.max(1, Math.floor((ally.mmp || 0) * sk.mpDmgPct));
    if ((ally.mp || 0) < spend) return false;
    ally.mp -= spend;
    let dmg = spend;
    let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    if (t.st && (t.st.confuse > 0 || t.st.panic > 0)) effMr -= 10;   // 🔮 混亂/恐慌：MR -10（與玩家心靈破壞一致）
    dmg = Math.max(1, Math.floor(dmg * (1 + (((ally.d && ally.d.magicDmg) || 0)) / 16) * mrMult(Math.max(0, effMr))));   // 🔮 基礎=消耗MP量，再依魔法傷害加成(1+魔法傷害/16)放大
    dmg = Math.max(1, Math.floor(dmg * fragileMult(t) * illuLvMult(ally) * wpnEnFinalMult(ally.eq && ally.eq.wpn)));   // 🔮 幻術士(傭兵)等級加成 ×(1+等級/50)；🔧 武器強化 +11~+20 最終倍率
    dmg = Math.max(1, Math.floor(dmg * royalAllyMult()));   // 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100)
    t.curHp -= dmg; t.justHit = 'magic'; mobWake(t);
    if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
    logCombat(`<span class="text-emerald-300 font-bold">【協力·${ally._allyName}】</span>施放 ${sk.n}，撕裂 <span class="${getMobColor(t.lv)}">${t.n}</span> 的心靈，造成 ${dmg} 點傷害。`, 'magic');
    let ri = mapState.mobs.findIndex(m => m && m.uid === t.uid);
    if (t.curHp <= 0) { if (ri !== -1) killMob(ri); } else renderMobs();
    return true;
}
// 🔧 會心一擊（傭兵版）：必定命中、套用物理傷害公式、固定 ×10（需 MP 滿）；只消耗全部 MP，不扣 HP
function allyDarkCrit(ally, t) {
    let wpn = (ally.eq && ally.eq.wpn) ? DB.items[ally.eq.wpn.id] : null;
    let dice = wpn ? (t.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;
    ally.buffs = ally.buffs || {}; ally.statuses = ally.statuses || {}; ally.eq = ally.eq || {};   // 安全：getPhysicalDmg 會取用 player.buffs/statuses/eq
    let _sv = player; player = ally; let base;
    try { base = getPhysicalDmg(dice, t, wpn, null, true, false); } finally { player = _sv; }   // forceHeavy：必中必重，套用傭兵自身物理公式
    let raw = (base.dmg || 1) + mobHardSkin(t);                                                  // 無視硬皮：加回硬皮扣減量
    let dmg = Math.max(1, Math.floor(raw * (1 + ((ally.d && ally.d.meleeCritDmg) || 0) / 100) * 10));   // 必定爆擊 ×10
    if (t.race === '血盟') dmg *= 2;                                                              // 對血盟敵人 x2
    // ⚔️ 屬性剋制已由 getPhysicalDmg(line 1389) 套用過、此處不再重複乘（與玩家會心一擊 js/07 一致）
    ally.mp = 0;   // 只消耗 MP（全部），不扣 HP
    dmg = Math.max(1, Math.floor(dmg * royalAllyMult()));   // 👑 王族魅力加成：傭兵造成傷害 ×(1+魅力/100)
    t.curHp -= dmg; t.justHit = getWpnEle(ally.eq ? ally.eq.wpn : null, wpn); mobWake(t);
    logCombat(`<span class="font-bold" style="color:#f0abfc;text-shadow:0 0 8px #d946ef;">【協力·${ally._allyName}·會心一擊】</span>對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dmg} 點致命傷害！`, 'player-crit');
    let i = mapState.mobs.findIndex(m => m && m.uid === t.uid);
    if (t.curHp <= 0) { if (i !== -1) killMob(i); } else renderMobs();
}
// 🤝 Phase4：傭兵異常狀態結算（比照玩家 tick：遞減時長＋持續傷害扣 curHp，可致倒地）。回傳 true＝本 tick 因 DoT 倒地（呼叫端跳過行動）。CC/施法限制由 alliesTick 讀 ally.statuses 判定。
function processAllyStatusTick(ally) {
    if (!ally || ally._downed) return false;
    let st = ally.statuses; if (!st) { ally.statuses = {}; return false; }
    for (let k in st) {
        if (st[k] > 0 && k !== 'poisonDmg' && k !== 'poisonTick' && k !== 'burnDmg' && k !== 'burnTick' && k !== 'scaldDmg' && k !== 'scaldTick' && k !== 'bleedDmg' && k !== 'bleedTick') st[k]--;
    }
    let nm = '協力·' + ally._allyName;
    if (st.poison > 0 && st.poisonTick > 0 && state.ticks % st.poisonTick === 0) { ally.curHp -= st.poisonDmg; logCombat(`${nm} 受到劇毒傷害 ${st.poisonDmg} 點。`, 'enemy'); }
    if (ally.curHp > 0 && st.burn > 0 && st.burnTick > 0 && state.ticks % st.burnTick === 0) { ally.curHp -= st.burnDmg; logCombat(`${nm} 受到灼燒傷害 ${st.burnDmg} 點。`, 'enemy'); }
    if (ally.curHp > 0 && st.scald > 0 && st.scaldTick > 0 && state.ticks % st.scaldTick === 0) { ally.curHp -= st.scaldDmg; logCombat(`${nm} 受到燙傷傷害 ${st.scaldDmg} 點。`, 'enemy'); }
    if (ally.curHp > 0 && st.bleed > 0 && st.bleedTick > 0 && state.ticks % st.bleedTick === 0) { ally.curHp -= st.bleedDmg; logCombat(`${nm} 受到出血傷害 ${st.bleedDmg} 點。`, 'enemy'); }
    if (ally.curHp <= 0) {
        ally.curHp = 0; ally._downed = true; ally._reviveCd = 150;
        logCombat(`<span class="text-amber-400 font-bold">協力傭兵 ${ally._allyName} 因持續傷害倒下了！（15 秒後可用復活卷軸，或回村免費復活）</span>`, 'enemy');
        try { renderSquadPanel(); } catch (e) {}
        return true;
    }
    return false;
}
// 每 tick 處理協力角色攻擊（間隔依武器攻速，最快 8 ticks）
function alliesTick() {
    if (!player.allies || !player.allies.length) return;
    player.allies.forEach(ally => {
        if (!ally) return;
        if (ally._downed) { if ((ally._reviveCd || 0) > 0) ally._reviveCd--; return; }   // 🤝 Phase 3：倒地傭兵完全停止行動（不立方/不颶風/不回魔/不攻擊），僅倒數復活冷卻（含背景補跑）
        if (processAllyStatusTick(ally)) return;   // 🤝 Phase4：異常狀態 DoT 結算（中毒/灼燒/燙傷/出血→可致倒地）；倒地則本回合不行動
        if ((ally._potCd || 0) > 0) ally._potCd--;   // 🍶 傭兵自動喝藥水冷卻（每 tick 遞減·~1 秒）
        allyTryPotion(ally);   // 🍶 HP% 低於安全線→消耗隊長設定的藥水回血（獨立於行動·硬控中仍可喝·安全線=0 則略過）
        let _ast = ally.statuses || {};
        let _ccBlock = (_ast.stun > 0 || _ast.freeze > 0 || _ast.stone > 0 || _ast.paralyze > 0 || _ast.sleep > 0);   // 🤝 Phase4：硬控（暈眩/冰凍/石化/麻痺/睡眠）→完全無法行動
        let _castBlock = (_ast.silence > 0 || _ast.magicseal > 0);   // 🤝 Phase4：沉默/魔法封印→不可施放技能/治癒，僅能基本攻擊
        let _dpsASnap = _dpsSnap(); _dpsAllyTurn = true;   // 🎯 DPS：逐傭兵量測本回合輸出（攻擊/立方/持續增益），_dpsAllyTurn 期間 _allyDamageMob 不重複計入
        try {
        if (!_ccBlock && ally.cls === 'illusion') allyCubeTick(ally);   // 🔮 幻術士傭兵：立方常駐光環（硬控中不展開）
        if (!_ccBlock && ally.skills && ally.skills.length) for (let _ssid of STORM_BUFF_SKILLS) { let _ssk = DB.skills[_ssid]; if (ally.skills.includes(_ssid) && _ssk && !mapState.current.startsWith('town_') && state.ticks % (_ssk.stormInterval || 40) === 0) allyStormTick(ally, _ssk); }   // 🌨️🔥 傭兵 冰雪颶風/火牢（已學會→常駐，依各自 stormInterval 觸發；安全區不展開）
        // 回魔：比照玩家每 160 ticks(16秒) +mpR（法師施法 / 妖精三重矢皆需 MP）
        if (state.ticks % 160 === 0 && (ally.mp||0) < (ally.mmp||0) && ((ally.d && ally.d.mpR) || 0) > 0) {   // 🔧 mpR 可能因套裝懲罰（黑暗妖精套裝 -7）為負 → 與玩家回魔一致，只在 >0 時回魔，避免扣傭兵MP
            ally.mp = Math.min(ally.mmp, (ally.mp||0) + ((ally.d && ally.d.mpR) || 0));
        }
        // 🐉 龍騎士傭兵：技能改吃 HP（見 allyDragonAct），故每 160 ticks 給予 HP 自然回復避免永久停擺；以 hpRegenMax+hpR 為基底再＋max HP 5% 保底（比照玩家但確保一定能回復、施放仍受限）
        if (state.ticks % 160 === 0 && ally.cls === 'dragon' && (ally.curHp||0) < (ally.mhp||0)) {
            let _hr = Number(((ally.d && ally.d.hpRegenMax) > 0) ? roll(1, ally.d.hpRegenMax) : 0) + Number((ally.d && ally.d.hpR) || 0) + Math.ceil((ally.mhp||0) * 0.05);
            ally.curHp = Math.min(ally.mhp, (ally.curHp||0) + _hr);
        }
        if (ally._cleaveTicks > 0) ally._cleaveTicks--;   // 🔧 切割（雙手劍重擊觸發）：攻速+20% 持續倒數
        if (!_ccBlock && (ally._atkCd = (ally._atkCd || 0) - 1) <= 0) {
            if (_castBlock) {   // 🤝 Phase4：沉默/魔法封印→只能基本攻擊（不施放 _atkSkill 與治癒）
                ally._atkCd = (_ast.slowAtk > 0 ? 40 : 20); allyAttackOnce(ally);
            } else if (ally._healSkill && allyTryHeal(ally)) {   // 🤝 Phase 3：隊伍有人低於門檻→改施放治癒（消耗本回合行動）
                ally._atkCd = 20;
            } else if (ally.cls === 'mage') {
                ally._atkCd = (_ast.slowAtk > 0 ? 40 : 20);   // 法師施法間隔 ~2 秒（緩速×2）
                allyMageAct(ally);
            } else {
                let wpn = (ally.eq && ally.eq.wpn) ? DB.items[ally.eq.wpn.id] : null;
                let _itv = Math.max(8, Math.round((wpn && wpn.spd ? wpn.spd : 1.0) * 10));
                { let _aClvW = wpn && wpn.eff === 'cleave'; if (!ally.classicMode && (ally._cleaveTicks > 0 || (allyHasMastery(ally, 'k_cleave') && _aClvW))) _itv = Math.max(8, Math.round(_itv * (allyHasMastery(ally, 'k_cleave') ? 0.50 : 0.8))); }   // 🔧 切割：攻速+20%（🏅 切割精通 +50%・持切割武器常駐）；🎮 經典模式停用
                if (allyHasMastery(ally, 'e_sword') && wpn && !wpn.w2h && !wpn.isBow && !wpn.ranged) _itv = Math.max(8, Math.round(_itv * (1/1.5)));   // 🏅 劍術精通（傭兵）：持單手近戰武器攻速+50%
                if (ally.cls === 'illusion' && wpn && !wpn.isBow && ((allyHasMastery(ally, 'i_qigu') && wpn.qigu) || (allyHasMastery(ally, 'i_magicsword') && !wpn.qigu && !isWandWeapon(wpn)))) _itv = Math.max(8, Math.round(_itv * (1/1.3)));   // 🔮 奇古獸/魔劍精通（傭兵·排除魔杖）：攻速+30%（鏡像玩家 recomputeStats spdMult）
                ally._atkCd = _itv;
                if (ally.cls === 'elf') allyElfAct(ally); else if (ally.cls === 'dark') allyDarkAct(ally); else if (ally.cls === 'knight') allyKnightAct(ally); else if (ally.cls === 'dragon') allyDragonAct(ally); else if (ally.cls === 'illusion') allyIllusionAct(ally); else if (ally.cls === 'warrior') allyWarriorAct(ally); else if (ally.cls === 'royal') allyRoyalAct(ally); else allyAttackOnce(ally);
            }
        }
        } finally { _dpsAllyTurn = false; let _ad = _dpsDealt(_dpsASnap); if (_ad > 0) _dpsAddAlly(ally, _ad); }   // 🎯 DPS：結算該傭兵本回合輸出
    });
}
// 🤝 Phase 3：傭兵自動治癒——若已設定治癒魔法且隊伍(玩家＋自己＋其他非倒地傭兵)中有人 HP% 低於該傭兵門檻，對最低者施放（消耗 MP）。回傳是否施放（true→佔用本回合行動）。
// 治癒量比照玩家 castSkillInner：(XdY healDice + healBase)×(1+3×magicDmg/16)，或 valBase+valDice+magicDmg；不套水之元氣（玩家專屬）。HoT/淨化/吸血(autoBuff/healSlot)不在此（已被 isHeal 過濾）。
function allyTryHeal(ally) {
    let sid = ally._healSkill; if (!sid) return false;
    let sk = DB.skills[sid]; if (!sk) return false;
    let isHeal = (sk.type === 'heal' && !sk.autoBuff && !sk.hot && !['sk_antidote', 'sk_holy_light', 'sk_cancel'].includes(sid));
    if (!isHeal) return false;
    let cost = sk.mp || 0;
    if ((ally.mp || 0) < cost) return false;
    let thr = ((ally._healHpPct != null ? ally._healHpPct : 70) / 100);
    let cand = [];
    if (!player.dead) cand.push(player);
    cand.push(ally);
    if (player.allies) for (let a of player.allies) if (a && a !== ally && !a._downed && (a.curHp || 0) > 0) cand.push(a);
    let lowest = null, lowestPct = thr;   // 只考慮低於門檻者
    for (let c of cand) {
        let cur = (c === player) ? c.hp : c.curHp, max = c.mhp || 1;
        let pct = (cur || 0) / max;
        if (pct < lowestPct) { lowestPct = pct; lowest = c; }
    }
    if (!lowest) return false;   // 無人需要治癒
    ally.mp -= cost;
    let d = ally.d || {};
    let _coef = 1 + (3 * (d.magicDmg || 0) / 16);
    let heal = sk.healDice
        ? Math.max(1, Math.floor((rollDice(sk.healDice[0], sk.healDice[1]) + (sk.healBase || 0)) * _coef))
        : Math.max(1, (sk.valBase || 0) + roll(sk.valDice[0], sk.valDice[1]) + (d.magicDmg || 0));
    if (lowest === player) { player.hp = Math.min(player.mhp, player.hp + heal); }
    else { lowest.curHp = Math.min(lowest.mhp, (lowest.curHp || 0) + heal); }
    let _who = (lowest === player) ? (player.name || '你') : ('協力·' + lowest._allyName);
    logCombat(`<span class="text-emerald-300 font-bold">協力·${ally._allyName}</span> 施放 ${sk.n}，為 ${_who} 恢復 ${heal} 點 HP。`, 'heal', 'mercenary');
    return true;
}
// 🍶 傭兵自動喝藥水：當傭兵 HP% 低於「HP 安全線」(_hpSafePct·隊伍面板設定)，消耗「隊長設定的藥水」(自動化設定的 set-pot·紅/橙/白藥水)回血。
//   ・藥水從隊長(玩家)道具欄扣 1 瓶；恢復量＝藥水 val ×(1+傭兵自身 CON 藥水加成%)（夾到傭兵上限）。每 ~1 秒冷卻 1 次（_potCd），獨立於攻擊行動、硬控中仍可喝。
//   ・安全線=0／無設定＝關閉；隊長無該藥水＝略過（不自動購買；隊長若開自動補貨會自行補滿庫存）。只認 val 型治癒藥水（紅/橙/白），加速/勇敢等無 val 藥水不喝。
function allyTryPotion(ally) {
    if (!ally || ally._downed) return;
    let thr = ally._hpSafePct || 0;
    if (thr <= 0) return;                                   // 安全線=0＝關閉
    if ((ally._potCd || 0) > 0) return;                     // 冷卻中
    let mhp = ally.mhp || 1, cur = ally.curHp || 0;
    if (cur <= 0) return;                                   // 倒地（理論上已被上面 return 擋掉）
    if (cur > mhp * thr / 100) return;                      // HP 仍在安全線之上→不喝
    let potSel = (typeof document !== 'undefined') ? document.getElementById('set-pot') : null;
    let potId = potSel ? potSel.value : 'potion_heal';      // 隊長設定的藥水
    let pdef = DB.items[potId];
    if (!pdef || pdef.val == null) return;                  // 只認固定 val 的治癒藥水（紅/橙/白）
    let stack = player.inv && player.inv.find(i => i.id === potId && (i.cnt || 0) > 0);
    if (!stack) return;                                     // 隊長身上沒有這瓶藥水
    stack.cnt--; player.inv = player.inv.filter(i => (i.cnt || 0) > 0);   // 消耗隊長 1 瓶
    let _conPct = (typeof getConPotionPct === 'function') ? getConPotionPct((ally.d && ally.d.con) || 0) : 0;   // 比照玩家：CON 提升藥水恢復%
    let h = Math.max(1, Math.floor(pdef.val * (1 + _conPct / 100)));
    ally.curHp = Math.min(mhp, cur + h);
    ally._potCd = 10;                                       // ~1 秒冷卻（10 ticks·比照玩家 cds.pot=1 秒）
    logCombat(`<span class="text-emerald-300 font-bold">協力·${ally._allyName}</span> 飲用 ${pdef.n}，恢復 ${h} 點 HP。`, 'heal', 'mercenary');
}
// 🤝 Phase 3：原地復活倒地傭兵（隊伍面板按鈕）。限定使用「復活卷軸」(scroll_revive·與玩家原地復活同物品)；倒地後 15 秒冷卻內不可用；無卷軸只能回村免費復活。復活至 HP 50%、滿魔。
// 傭兵原地復活：玩家可選「返生術」(消耗 MP·無冷卻·死亡後立即可用) 或「復活卷軸」(消耗1張·須死亡 15 秒後 _reviveCd 歸零才能用)。
// method='rez' → 返生術；'scroll'(或省略) → 復活卷軸。效果相同：HP 50%、MP 滿、清異常、留原地。
function reviveMercenary(slotN, method) {
    slotN = String(slotN);
    let ally = (player.allies || []).find(a => a && String(a._slot) === slotN);
    if (!ally) return;
    if (!ally._downed) { logSys(`<span class="text-slate-400">${ally._allyName} 並未倒地。</span>`); return; }
    if (method === 'rez') {
        // 🪄 返生術：消耗玩家 MP、無冷卻、死亡後可馬上使用
        if (player.dead) { logSys(`<span class="text-red-400">你已死亡，無法施放 返生術。</span>`); return; }
        if (!player.skills || !player.skills.includes('sk_resurrection')) { logSys(`<span class="text-red-400">尚未學會 返生術，無法立即復活（可改用復活卷軸·死亡 15 秒後）。</span>`); return; }
        let rk = DB.skills.sk_resurrection;
        let cost = rk ? player.d.getMpCost(rk.mp, rk.tier) : Infinity;
        if ((player.mp || 0) < cost) { logSys(`<span class="text-red-400">MP 不足以施放 返生術（需 ${cost}）。</span>`); return; }
        player.mp -= cost;
        _reviveAllyDone(ally, '返生術');
        return;
    }
    // 🎫 復活卷軸：須死亡 15 秒後（_reviveCd 歸零）
    if ((ally._reviveCd || 0) > 0) { logSys(`<span class="text-slate-400">復活卷軸須死亡 15 秒後才能使用，${ally._allyName} 還需 ${Math.ceil(ally._reviveCd / 10)} 秒（或用返生術立即復活）。</span>`); return; }
    let sc = player.inv && player.inv.find(i => i.id === 'scroll_revive');
    if (!sc || (sc.cnt || 0) <= 0) { logSys(`<span class="text-red-400">需要「復活卷軸」才能於原地復活 ${ally._allyName}（或用返生術、或回村免費復活全體倒地傭兵）。</span>`); return; }
    sc.cnt--; player.inv = player.inv.filter(i => i.cnt > 0);   // 消耗 1 張復活卷軸
    _reviveAllyDone(ally, '復活卷軸');
}
function _reviveAllyDone(ally, via) {
    ally._downed = false;
    ally.curHp = Math.max(1, Math.floor((ally.mhp || 1) * 0.5));
    ally.mp = ally.mmp || 0;
    ally._reviveCd = 0;
    ally.statuses = {};   // 🤝 Phase4：復活清空所有異常狀態
    logSys(`<span class="text-emerald-300 font-bold">使用 ${via}，協力傭兵 ${ally._allyName} 原地復活（HP 50%）！</span>`);
    saveGame(); updateUI();
    try { renderSquadPanel(); } catch (e) {}
}
// 🤝 Phase 3：回村/回城（進入 town_ 安全區）免費復活全體倒地傭兵至滿血滿魔（由 changeMap 村莊分支呼叫）
function reviveDownedMercsAtTown() {
    if (!player || !player.allies) return;
    let n = 0;
    player.allies.forEach(a => { if (a) { let _wd = a._downed; a._downed = false; a.curHp = a.mhp; a.mp = a.mmp; a._reviveCd = 0; a.statuses = {}; if (_wd) n++; } });   // 🤝 Phase4：回村→全體傭兵回滿 HP/MP 並清除異常狀態（倒地者亦復活，計入訊息）
    if (n) { try { logSys(`<span class="text-emerald-300">回到安全區，${n} 名倒地的協力傭兵已恢復。</span>`); } catch (e) {} try { renderSquadPanel(); } catch (e) {} }
}
// 🤝 傭兵升級重算戰力：暫時把全域 player 換成該傭兵跑 recomputeStats（純計算·比照 buildAlly），取得新等級的衍生戰力後還原；保留當前 HP/MP（夾到新上限·不滿血）。
function _allyLevelRecompute(ally) {
    let _keepHp = ally.curHp, _keepMp = ally.mp;
    let _save = player; player = ally; let ok = true;
    try { recomputeStats(); } catch (e) { ok = false; }
    player = _save; calcStats();   // 還原真實玩家的衍生值並刷新 UI（同 buildAlly）
    if (ok) { let _rm = royalAllyMult(); if (_rm !== 1) { ally.mhp = Math.max(1, Math.floor((ally.mhp || 1) * _rm)); ally.mmp = Math.floor((ally.mmp || 0) * _rm); } ally.curHp = Math.max(1, Math.min(_keepHp != null ? _keepHp : ally.mhp, ally.mhp || 1)); ally.mp = Math.min(_keepMp != null ? _keepMp : ally.mmp, ally.mmp || 0); }   // 👑 王族魅力加成：升級重算後重新套用 HP/MP ×(1+魅力/100)
}
// 城鎮 NPC：召喚/解除協力角色
function allyCost(slotN) { let sum = slotSummary(slotN); return sum ? (sum.lv || 1) * 10000 : 0; }   // 招募費用 = 角色等級 × 10000
// 🤝 解雇結算：把傭兵受雇期間累積的 ally.exp 回存到「該存檔角色」的存檔（同職業＋同名守衛·SIG1 重簽·套用升級曲線）。回傳給 logSys 用的訊息片段；失敗（存檔不存在/被換角/解析失敗）回空字串、不動存檔。
function _settleAllyExp(ally) {
    try {
        if (!ally) return '';
        let slot = String(ally._slot);
        let banked = Math.floor(ally._expGained || 0);   // 🤝 delta-merge：回寫「受雇期間賺到的總經驗」（含即時升級已消耗的），加到該存檔角色「當前」進度上→多開時是合併而非整個覆蓋
        if (banked <= 0) return '';
        let raw = _saveUnwrap(_lzGet('lineage_idle_save_' + slot)).payload;
        if (!raw) return '';
        let obj; try { obj = JSON.parse(raw); } catch (e) { return ''; }
        let p = obj && obj.p;
        if (!p || !p.cls) return '';
        if (p.cls !== ally.cls || (p.name || '') !== (ally.name || '')) return '';   // 🛡️ 守衛：存檔位必須仍是同一角色，避免被換角後寫錯
        let before = p.lv || 1;
        p.exp = (p.exp || 0) + banked;
        while ((p.lv || 1) < 100 && p.exp >= getExpReq(p.lv)) { p.exp -= getExpReq(p.lv); p.lv++; if (p.lv >= 50) p.bonus = (p.bonus || 0) + 1; }   // 比照 checkLvUp 升級曲線（升等只動 lv/exp/bonus；載入該角色時自會 recompute 衍生戰力）
        if ((p.lv || 1) >= 100) p.exp = 0;   // 滿等不留溢出經驗
        obj.p = p;
        _lzSet('lineage_idle_save_' + slot, _saveWrap(JSON.stringify(obj)));   // 🛡️ SIG1 重簽寫回
        ally.exp = 0; ally._expGained = 0;
        let gained = (p.lv || 1) - before;
        return `<span class="text-emerald-300">累積的 ${banked.toLocaleString()} 經驗已回存至 ${ally._allyName}（存檔 ${slot}）${gained > 0 ? `，升 ${gained} 級至 Lv.${p.lv}` : ''}。</span>`;
    } catch (e) { return ''; }
}
function toggleAlly(slotN) {
    slotN = String(slotN);
    if (!player.allies) player.allies = [];
    if (isAllyActive(slotN)) {
        let _dis = player.allies.find(a => a && a._slot === slotN);
        let _expMsg = _dis ? _settleAllyExp(_dis) : '';   // 🤝 解雇前先把累積經驗回存到該存檔角色
        player.allies = player.allies.filter(a => a && a._slot !== slotN);
        logSys(`協力傭兵（存檔 ${slotN}）已解散（招募費用不退還）。${_expMsg}`);
    } else {
        let _allyCap = allyActiveCap();
        if ((player.allies.length || 0) >= _allyCap) {   // 🔧 同時上場上限：全職業 3 名（王族原 3＋魅力/15 封頂 7 已取消，改吃 royalAllyMult 魅力加成）
            logSys(`<span class="text-red-400">協力傭兵最多同時上場 ${_allyCap} 名，請先解除一名再招募。</span>`);
            saveGame(); updateUI();
            let _c2 = document.getElementById('interaction-content'); if(_c2) renderAllyNPC(_c2);
            return;
        }
        let sum = slotSummary(slotN);
        if (!sum) { logSys(`<span class="text-red-400">存檔 ${slotN} 沒有可用的角色。</span>`); }
        else if (modeSuffix(!!sum.classic, !!sum.traditional) !== modeSuffix(!!player.classicMode, !!player.traditionalMode)) {   // 🎮🏛️ 一般／經典／傳統／經典＋傳統 不可跨模式組合招募
            logSys(`<span class="text-red-400">只能招募與本角色「相同模式組合（一般／經典／傳統／經典＋傳統）」的存檔傭兵。</span>`);
        }
        else {
            let cost = (sum.lv || 1) * 10000;
            if ((player.gold || 0) < cost) { logSys(`<span class="text-red-400">招募 ${sum.name}（Lv.${sum.lv}）需要 ${cost.toLocaleString()} 金幣，你的金幣不足。</span>`); }
            else {
                let a = buildAlly(slotN);
                if (!a) { logSys(`<span class="text-red-400">存檔 ${slotN} 沒有可用的角色。</span>`); }
                else { player.gold -= cost; player.allies.push(a); logSys(`<span class="text-emerald-300 font-bold">花費 ${cost.toLocaleString()} 金幣招募 ${a._allyName}（存檔 ${slotN}，Lv.${sum.lv}）加入作戰！</span>`); }
            }
        }
    }
    saveGame(); updateUI();
    let _c = document.getElementById('interaction-content'); if(_c) renderAllyNPC(_c);
}
function renderAllyNPC(div) {
    let rows = allySlotList().map(n => {
        let sum = slotSummary(n);
        let active = isAllyActive(n);
        if (!sum) return `<div class="w-full text-left py-2 px-3 text-sm bg-slate-900/60 border border-slate-700 rounded opacity-60">存檔 ${n}：<span class="text-slate-500">（空）</span></div>`;
        let _classic = !!sum.classic;                                  // 🎮 經典模式存檔
        let _trad = !!sum.traditional;                                 // 🏛️ 傳統模式存檔
        let _modeMatch = (modeSuffix(_classic, _trad) === modeSuffix(!!player.classicMode, !!player.traditionalMode));   // 🎮🏛️ 只能招募與自己同模式組合（一般/經典/傳統/經典＋傳統）的存檔
        let _tag = (_classic && _trad) ? '<span style="color:#fbbf24;font-weight:bold;">⚔經典</span> <span style="color:#c4b5fd;font-weight:bold;">🏛️傳統</span> ' : (_trad ? '<span style="color:#c4b5fd;font-weight:bold;">🏛️傳統</span> ' : (_classic ? '<span style="color:#fbbf24;font-weight:bold;">⚔經典</span> ' : ''));
        let _nameStyle = (_classic && _trad) ? 'style="color:#2dd4bf;"' : (_trad ? 'style="color:#c4b5fd;"' : (_classic ? 'style="color:#fbbf24;"' : 'class="text-amber-300"'));   // 經典＋傳統＝青綠
        let _btn = active
            ? `<button onclick="toggleAlly('${n}')" class="btn py-1 px-4 text-sm font-bold bg-red-900 border-red-700 text-red-200">解除</button>`
            : (_modeMatch
                ? `<button onclick="toggleAlly('${n}')" class="btn py-1 px-4 text-sm font-bold bg-emerald-900 border-emerald-700 text-emerald-200">召喚　${((sum.lv||1)*10000).toLocaleString()}金</button>`
                : `<span class="text-xs text-slate-500 px-2 text-right">非同模式存檔<br>不可招募</span>`);
        // 🔋 出戰中傭兵剩餘資源：騎士/戰士(純物理)不顯示；龍騎士以 HP 為資源(技能吃HP)；其餘職業顯示 MP
        let _res = '';
        if (active) {
            let _la = (player.allies || []).find(a => a && String(a._slot) === String(n));
            if (_la) {
                if (_la.cls === 'dragon') _res = `　<span class="text-rose-300 font-bold">HP ${Math.max(0, Math.floor(_la.curHp||0))}/${Math.floor(_la.mhp||0)}</span>`;
                else if (_la.cls !== 'knight' && _la.cls !== 'warrior') _res = `　<span class="text-sky-300 font-bold">MP ${Math.max(0, Math.floor(_la.mp||0))}/${Math.floor(_la.mmp||0)}</span>`;
            }
        }
        return `<div class="flex items-center justify-between gap-2 bg-slate-800/60 border ${_classic ? 'border-amber-600/70' : 'border-slate-600'} rounded p-3 text-sm">
            <span>${_tag}存檔 ${n}：<b ${_nameStyle}>${sum.cls} Lv.${sum.lv}</b>　${sum.name}${_res}</span>
            ${_btn}
        </div>`;
    }).join('');
    div.innerHTML = `<div class="flex flex-col gap-3 p-1">
        <div class="text-slate-300 text-sm leading-relaxed">招募其他存檔位的角色一起作戰，<b class="text-amber-300">費用＝該角色等級 × 10000 金幣</b>。協力傭兵戰鬥中不會陣亡，<b class="text-emerald-300">你死亡並回城／原地復活後仍會留在身邊，只有在此處點「解除」才會解散（費用不退還）</b>；存讀檔不會使其消失。法師以魔法、妖精以弓/三重矢、騎士以物理（含看破/殺戮）出手。<br><span class="text-slate-400">提示：切換那名角色的裝備或升級後，需「解除→重新招募」才會更新戰力快照。</span></div>
        <div class="flex items-center justify-between gap-2">
            <div class="text-sm">你的金幣：<span class="text-yellow-400 font-bold">${(player.gold||0).toLocaleString()}</span></div>
            ${(player.allies||[]).length ? `<button onclick="dismissAllAllies()" class="btn py-1 px-3 text-xs font-bold bg-red-950 border-red-700 text-red-200" title="解除目前全部協力傭兵（含異常卡住、找不到對應存檔的傭兵）">⚠ 全員退出（${(player.allies||[]).length}）</button>` : ''}
        </div>
        ${rows}
    </div>`;
}
// 🔧 全員退出：無條件清空 player.allies（含 _slot 對不到任何存檔列、卡在場上無法解除的傭兵）。player.allies 是傭兵唯一真相（isAllyActive/alliesTick 皆讀它），清空即完全脫困。
function dismissAllAllies() {
    let n = (player.allies || []).length;
    if (!n) { logSys('<span class="text-slate-400">目前沒有上場的協力傭兵。</span>'); return; }
    if (!confirm(`確定要解除全部 ${n} 名協力傭兵嗎？\n（招募費用不退還，累積經驗會回存至各自存檔角色，可之後重新招募）`)) return;
    (player.allies || []).forEach(a => { let m = _settleAllyExp(a); if (m) logSys(m); });   // 🤝 各自回存累積經驗到對應存檔角色
    player.allies = [];
    logSys(`<span class="text-amber-300">已解除全部協力傭兵（共 ${n} 名）。</span>`);
    saveGame(); updateUI();
    let _c = document.getElementById('interaction-content'); if (_c) renderAllyNPC(_c);
}
// 🔧 召喚控制戒指（acc_summon_ctrl）：裝備於任一戒指欄即生效——召喚物擲骰 19 視為命中
function hasSummonCtrlRing() {
    let r1 = player.eq && player.eq.ring1, r2 = player.eq && player.eq.ring2, r3 = player.eq && player.eq.ring3, r4 = player.eq && player.eq.ring4;
    return !!((r1 && r1.id === 'acc_summon_ctrl') || (r2 && r2.id === 'acc_summon_ctrl') || (r3 && r3.id === 'acc_summon_ctrl') || (r4 && r4.id === 'acc_summon_ctrl'));
}
