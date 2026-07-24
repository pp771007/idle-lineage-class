// ============================================================
// js/31-castle-guards.js — 🏰 城堡護衛 v2（可招募的協同作戰角色）
//   舊制「承擔 10% 傷害的城堡護衛」已移除；改為與召喚物同性質的可上場實體：
//   ・招募後，同模式（一般/經典）所有主操作角色都會獲得護衛跟隨（血盟共用名冊）。
//   ・可與召喚物、寵物、傭兵並存（不互斥）。
//   ・護衛死亡 30 秒後自動復活（不消耗復活卷軸）。
//   ・可攜帶數量＝血盟創盟王族盟主魅力 / 15，最多 4 個；每招募一隻 100 萬金幣。
//   ・持續到「宣戰其他城堡」或「失去城堡」（見 castleGuardRosterActive 的動態驗證＋宣戰清空）。
//
//   三城堡各自綁定一支部隊（打下哪座城，只能在該城招募對應護衛）：
//     肯特 kent → 藍色鯊魚｜風木 windwood → 暴風之刃｜海音 heine → 毒蛇之牙
//
//   數值以「杜賓狗（裸身·剔除夥伴精通）在玩家等級的每擊平均」為單一真相反推 DPS（見 _guardDobBaseDps）：
//     用戶指定傷害＝DPS 比例，不是每擊傷害。等級＝跟隨的當前操作角色等級。
//   ⚠️ 執行期實體 player.guardsV2 不入檔（比照 summonsV2）；名冊在血盟共用狀態持久（js/25）。
// ============================================================
'use strict';

// city（血盟城堡 key）→ 護衛規格。dpsRatio＝相對裸杜賓 DPS；aspdSec＝攻擊間隔秒；
//   hpPerLv/acFn/mrFn 依規格；aggroWeight＝受擊權重（進 js/04 受害者池）；
//   threat＝傷害仇恨累積係數（⚠️ 仇恨制尚未實作·先存備用·見 [[aggro-threat-system-design]]）。
const CASTLE_GUARD_BOOK = {
    kent:     { form: '藍色鯊魚', city: 'kent',     label: '肯特',
        hpPerLv: 16, dpsRatio: 0.50, aspdSec: 1.0,
        acBase: -10, acLvDiv: 4, mrBase: 10, mrLvDiv: 5,
        aggroWeight: 5, threat: 5,
        d: '肯特守衛隊長麾下的藍色鯊魚部隊：血厚耐打的前排護衛（受擊機率高、承受敵方火力）。' },
    windwood: { form: '暴風之刃', city: 'windwood', label: '風木',
        hpPerLv: 10, dpsRatio: 0.70, aspdSec: 0.5,
        acBase: -10, acLvDiv: 4, mrBase: 25, mrLvDiv: 2,
        aggroWeight: 3, threat: 1,
        d: '風木傭兵隊長麾下的暴風之刃部隊：攻速最快、輸出最高的突擊護衛（不易被鎖定）。' },
    heine:    { form: '毒蛇之牙', city: 'heine',    label: '海音',
        hpPerLv: 13, dpsRatio: 0.60, aspdSec: 0.7,
        acBase: -15, acLvDiv: 4, mrBase: 15, mrLvDiv: 2,
        aggroWeight: 4, threat: 3,
        d: '海音神官隊長麾下的毒蛇之牙部隊：攻守均衡的護衛（魔法防禦與迴避兼具）。' },
};
const CASTLE_GUARD_MAX = 4;                 // 攜帶數量硬上限
const CASTLE_GUARD_COST = 1000000;          // 每招募一隻的金幣
const CASTLE_GUARD_REVIVE_MS = 30000;       // 死亡後 30 秒自動復活（不耗卷軸）
const CASTLE_GUARD_HIRE_TICKS = Math.round(CASTLE_GUARD_REVIVE_MS / 100);   // 引擎 tick=100ms → 300 ticks

function _guardSpecForCity(city) { return CASTLE_GUARD_BOOK[city] || null; }
function _guardSpecForForm(form) { for (const k in CASTLE_GUARD_BOOK) if (CASTLE_GUARD_BOOK[k].form === form) return CASTLE_GUARD_BOOK[k]; return null; }

// 血盟創盟王族盟主的魅力（跨存檔位讀·非當前角色）→ 可攜帶數量上限。
function castleGuardLeaderCha() {
    let role = (typeof clanLeaderRole === 'function') ? clanLeaderRole(player) : null;
    let lp = role && role.player;
    if (!lp) return 0;
    // 盟主的 d 可能未重算（讀自存檔）；優先取 d.cha，退而取六維 cha。
    let cha = (lp.d && Number(lp.d.cha)) || Number(lp.cha) || 0;
    return Math.max(0, Math.floor(cha));
}
function castleGuardCapacity() {   // floor(盟主魅力/15)·封頂 4
    return Math.max(0, Math.min(CASTLE_GUARD_MAX, Math.floor(castleGuardLeaderCha() / 15)));
}

// 名冊（血盟模式共用）：{ city, count, hiredAt }｜null。
//   動態驗證：血盟目前必須「持有 guards.city 這座城」，否則名冊失效（失去城堡／已佔領別城）。
function castleGuardRosterActive() {
    if (typeof player === 'undefined' || !player || !player.cls) return null;
    let info = (typeof clanGetModeInfo === 'function') ? clanGetModeInfo(player) : null;
    if (!info || !info.guards) return null;
    let owned = (typeof clanGetCastleCity === 'function') ? clanGetCastleCity(player) : null;
    if (!owned || owned !== info.guards.city) return null;   // 沒城 / 換城 → 失效
    if (!_guardSpecForCity(info.guards.city)) return null;
    return info.guards;
}
// 實際跟隨數＝min(名冊已招募數, 目前魅力容量)。
function castleGuardFollowCount() {
    let r = castleGuardRosterActive();
    if (!r) return 0;
    return Math.max(0, Math.min(r.count || 0, castleGuardCapacity()));
}

// ---------- 招募 / 遣散 / 失效 ----------
function _guardWriteRoster(mutator) {
    if (typeof _clanWithLock !== 'function') return { ok: false, error: '血盟系統未就緒。' };
    let mode = (typeof clanModeKey === 'function') ? clanModeKey(player) : 'normal';
    return _clanWithLock(st => {
        let info = st.modes[mode];
        if (!info) return { commit: false, error: '你尚未加入血盟。' };
        return mutator(info) || {};
    });
}
function hireCastleGuard(city) {
    let spec = _guardSpecForCity(city);
    if (!spec) return;
    if (typeof siegeVictoryActive !== 'function' || !siegeVictoryActive()) { logSys('<span class="text-red-400">攻城獲勝（擁有城堡）期間才能招募城堡護衛。</span>'); return; }
    let owned = (typeof clanGetCastleCity === 'function') ? clanGetCastleCity(player) : null;
    if (owned !== city) { logSys(`<span class="text-red-400">你的血盟目前並未持有${spec.label}城，無法招募${spec.form}。</span>`); return; }
    let cap = castleGuardCapacity();
    if (cap <= 0) { logSys('<span class="text-red-400">盟主魅力不足（需魅力 15 以上才能攜帶 1 名護衛）。</span>'); return; }
    let cur = castleGuardRosterActive();
    let curCount = (cur && cur.city === city) ? (cur.count || 0) : 0;
    if (curCount >= cap) { logSys(`<span class="text-amber-300">已達可攜帶上限（${cap} 名·盟主魅力 ${castleGuardLeaderCha()}）。</span>`); return; }
    if ((player.gold || 0) < CASTLE_GUARD_COST) { logSys(`<span class="text-red-400">金幣不足，招募 ${spec.form} 需要 ${CASTLE_GUARD_COST.toLocaleString()} 金幣。</span>`); return; }

    let res = _guardWriteRoster(info => {
        // 城堡不符或未持有 → 名冊視為空（換城時舊部隊本就失效）
        let g = info.guards && info.guards.city === city ? info.guards : null;
        let count = g ? (g.count || 0) : 0;
        if (count >= cap) return { commit: false, error: 'full' };
        info.guards = { city: city, count: count + 1, hiredAt: (g && g.hiredAt) || Date.now() };
        return { count: info.guards.count };
    });
    if (!res.ok) { if (res.error && res.error !== 'full') logSys(`<span class="text-red-400">${res.error}</span>`); return; }
    player.gold -= CASTLE_GUARD_COST;
    logSys(`<span class="text-emerald-300 font-bold">招募了 ${spec.form}（第 ${res.count} 名·${spec.label}城）。</span>同盟同模式的角色都將獲得其跟隨。`);
    try { saveGame(); } catch (e) {}
    castleGuardSync(true);
    updateUI();
    let el = document.getElementById('interaction-content'); if (el) renderCastleGuard(el, city);
}
function disbandCastleGuards(city) {
    let res = _guardWriteRoster(info => {
        if (!info.guards || (city && info.guards.city !== city)) return { commit: false };
        info.guards = null;
        return {};
    });
    if (res.ok) {
        logSys('<span class="text-slate-300">已遣散城堡護衛。</span>');
        try { saveGame(); } catch (e) {}
    }
    if (player) player.guardsV2 = [];
    castleGuardSync(true);
    updateUI();
    let el = document.getElementById('interaction-content'); if (el && city) renderCastleGuard(el, city);
}
// 「宣戰其他城堡」時清空名冊（startSiege 成功後呼叫；宣戰自己的城會被上游 held===city 擋掉）。
function castleGuardsOnSiegeDeclared() {
    let info = (typeof clanGetModeInfo === 'function') ? clanGetModeInfo(player) : null;
    if (!info || !info.guards) return;
    _guardWriteRoster(i => { i.guards = null; return {}; });
    if (player) player.guardsV2 = [];
}

// ---------- 數值反推（單一真相＝裸杜賓狗每擊平均·剔除夥伴精通） ----------
function _guardDobBaseDps(lv) {
    // 杜賓狗 apm=60（1 秒/擊）→ 每擊平均＝DPS。剔除 petMasteryDmgMult（護衛不吃寵物精通）。
    if (typeof petDerive !== 'function' || typeof PET_BOOK === 'undefined' || !PET_BOOK['杜賓狗']) return Math.max(1, lv * 1.2);
    let d = petDerive({ form: '杜賓狗', lv: Math.max(1, lv) });
    if (!d) return Math.max(1, lv * 1.2);
    let perHit = (d.flat + (d.dice + 1) / 2) * (d.damageMult || 1) * (d.attackMult || 1);
    let mm = (typeof petMasteryDmgMult === 'function') ? (petMasteryDmgMult() || 1) : 1;
    return Math.max(1, perHit / mm);
}
function _guardHit(lv) {   // 命中沿用裸杜賓命中（剔除夥伴精通命中加成），維持與寵物同水準
    if (typeof petDerive === 'function' && typeof PET_BOOK !== 'undefined' && PET_BOOK['杜賓狗']) {
        let d = petDerive({ form: '杜賓狗', lv: Math.max(1, lv) });
        let hm = (typeof petMasteryHitMult === 'function') ? (petMasteryHitMult() || 1) : 1;
        if (d) return Math.max(1, Math.round((d.hit || 0) / hm));
    }
    return Math.max(1, Math.round(lv * 1.2));
}
function guardDerive(g) {
    let spec = _guardSpecForForm(g.form); if (!spec) return { flat: 0, dice: 1, aspd: 10, hit: 1, ac: 10, dr: 0, mr: 0 };
    let lv = Math.max(1, g.lv || 1);
    let dps = spec.dpsRatio * _guardDobBaseDps(lv);
    let perHit = dps * spec.aspdSec;                 // 每擊平均傷害
    let flat = Math.max(0, Math.round(perHit * 0.55));
    let dice = Math.max(1, Math.round((perHit - flat) * 2));
    return {
        flat: flat, dice: dice,
        aspd: Math.max(3, Math.round(spec.aspdSec * 10)),   // 秒 → ticks（10 tps）
        hit: _guardHit(lv),
        ac: spec.acBase - Math.floor(lv / spec.acLvDiv),
        dr: Math.floor(lv / 12),
        mr: spec.mrBase + Math.floor(lv / spec.mrLvDiv),
        aggroWeight: spec.aggroWeight,
    };
}

// ---------- 執行期實體同步（每個角色各自持有·依名冊維持隊形） ----------
function guardRenderList() {   // 供 js/22 寵物圖層渲染（含死亡殘影 2 秒）
    if (typeof player === 'undefined' || !player || !player.cls) return [];
    const now = Date.now();
    return (player.guardsV2 || []).filter(s => !s._downed || (now - (s._diedAt || 0)) < 2000);
}
function guardV2List() { return (player && player.guardsV2) || []; }
function guardAliveList() { return guardV2List().filter(s => s && !s._downed && (s.hp || 0) > 0); }   // 受害者池候選（未倒地·有血）
function guardAggroWeight(s) { let sp = _guardSpecForForm(s && s.form); return sp ? sp.aggroWeight : 4; }   // 受擊權重（進 js/04 受害者池）

// 依名冊維持場上護衛數量（缺補、換城/失效清空）；每次角色等級變動也重算數值。
function castleGuardSync(force) {
    if (typeof player === 'undefined' || !player || !player.cls) return;
    let r = castleGuardRosterActive();
    let want = r ? castleGuardFollowCount() : 0;
    let spec = r ? _guardSpecForCity(r.city) : null;
    if (!player.guardsV2) player.guardsV2 = [];
    let list = player.guardsV2;

    // 名冊失效或城堡種類改變 → 清空重建
    if (!want || !spec) { if (list.length) { player.guardsV2 = []; if (force) renderGuardPanel(true); } return; }
    if (list.length && list[0].form !== spec.form) { player.guardsV2 = []; list = player.guardsV2; }

    // 補齊到 want 隻（新生成的立即可戰）
    let lvNow = Math.max(1, player.lv || 1);
    for (let s of list) s.lv = lvNow;   // 跟隨當前操作角色等級
    if (list.length < want) {
        for (let i = list.length; i < want; i++) {
            let mhp = spec.hpPerLv * lvNow;
            list.push({ uid: uid(), form: spec.form, city: spec.city, lv: lvNow, hp: mhp, mhp: mhp, _atkCd: 5 + i * 3 });
        }
        if (force) renderGuardPanel(true);
    } else if (list.length > want) {
        player.guardsV2 = list.slice(0, want);   // 魅力下降 → 收回多餘
        if (force) renderGuardPanel(true);
    }
    // 同步每隻血量上限（等級變動）
    for (let s of player.guardsV2) { let mx = spec.hpPerLv * s.lv; if (s.mhp !== mx) { let ratio = s.mhp ? s.hp / s.mhp : 1; s.mhp = mx; if (!s._downed) s.hp = Math.max(1, Math.round(mx * ratio)); } }
}

// ---------- tick（js/03 召喚階段呼叫） ----------
let _guardSyncCd = 0;   // 🩹 v3.8.0 名冊驗證節流計數：castleGuardSync 會讀血盟共用狀態（localStorage＋LZ＋簽章＋JSON.parse），每 tick 讀取在補跑時嚴重拖慢
function castleGuardTick() {
    if (typeof player === 'undefined' || !player || !player.cls) return;
    if (player.dead) { if ((player.guardsV2 || []).length) { player.guardsV2 = []; renderGuardPanel(true); } return; }
    // 名冊驗證改「每 ~1 秒一次」，且補跑期間完全跳過（此期間玩家無法招募/遣散·名冊不會變）→ 免去補跑每 tick 的血盟狀態重讀
    if (!(typeof catchupActive === 'function' && catchupActive())) {
        if ((_guardSyncCd = (_guardSyncCd | 0) - 1) <= 0) { _guardSyncCd = 10; castleGuardSync(false); }
    }
    let list = player.guardsV2 || [];
    if (!list.length) return;

    // 30 秒自動復活（不耗卷軸）
    let now = Date.now();
    let revived = false;
    for (let s of list) {
        if (s._downed && s._reviveAt && now >= s._reviveAt) {
            s._downed = false; s.hp = s.mhp; s._reviveAt = 0; s._diedAt = 0; s._atkCd = 5;
            revived = true;
            logCombat(`<span class="text-cyan-300 font-bold">${s.form}</span> 重整旗鼓，歸隊繼續作戰。`, 'magic', 'summon');
        }
    }
    if (revived) renderGuardPanel(true);

    if (typeof _petInWild === 'function' && !_petInWild()) return;   // 安全區不行動
    for (let s of list) {
        if (s._downed) continue;
        s._atkCd = (s._atkCd != null ? s._atkCd : 5) - 1;
        if (s._atkCd > 0) continue;
        let d = guardDerive(s);
        s._atkCd = d.aspd;
        let t = (typeof _petPickTarget === 'function') ? _petPickTarget(s) : (typeof getTarget === 'function' ? getTarget() : null);
        if (!t) continue;
        if (typeof threatWrap === 'function') threatWrap(s, () => guardAttackOnce(s, d, t)); else guardAttackOnce(s, d, t);   // 🎯 v3.7.97 仇恨：護衛傷害→記給該護衛實體
    }
    // 死亡殘影過期清理（渲染保留 2 秒·倒地實體本身保留待復活）
    renderGuardPanel();
}

function guardAttackOnce(s, d, t) {
    if (typeof _petAnimAct === 'function') _petAnimAct(s, 'attack', t.uid);
    let hv = stretchHitValue(d.hit - t.lv + mobEffAC(t));
    let r = roll(1, 20);
    if (!((r === 20) || (r !== 1 && hv >= r))) { if (typeof vfxMiss === 'function') vfxMiss(t); logCombat(`<span class="text-cyan-300">${s.form}</span> 的攻擊未命中。`, 'miss'); return; }
    let dmg = (r === 20 ? d.dice : roll(1, d.dice)) + d.flat;
    dmg = Math.max(1, Math.floor(dmg) - (t.dr || 0));
    dmg += (typeof traumaPhysicalBonus === 'function') ? traumaPhysicalBonus(t) : 0;
    if (typeof markBossPhysicalHit === 'function') markBossPhysicalHit(t);
    t.curHp -= dmg; if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(t, dmg, 'melee'); t.justHit = 'normal'; mobWake(t);
    logCombat(`<span class="text-cyan-300">${s.form}</span> 攻擊 <span class="${getMobColor(t.lv)}">${t.n}</span>，造成 ${dmg}${r === 20 ? '（重擊）' : ''} 點傷害。`, 'player');
    if (t.curHp <= 0) { let i = mapState.mobs.findIndex(x => x && x.uid === t.uid); if (i !== -1) killMob(i); }
    else { try { renderMobs(); } catch (e2) {} }
}

// 怪物一般攻擊打護衛（js/04 受害者池呼叫·比照 enemyAttackSummon）
function enemyAttackGuard(mob, s) {
    if (!mob || mob.curHp <= 0 || !s || s._downed || (s.hp || 0) <= 0) return;
    if (typeof _mobAnimTrigger === 'function') _mobAnimTrigger(mob, 'attack');
    let d = guardDerive(s);
    let st = mob.st || newMobStatus();
    if (st.terror > 0 && Math.random() < 0.90) return;
    let mobHitBonus = (mob.hit || 0) - (st.blindVal || 0) - (st.weaken > 0 ? 2 : 0) - (st.disease > 0 ? 4 : 0) + (typeof tamerAuraHit === 'function' ? tamerAuraHit(mob) : 0);
    let hv = stretchHitValue(mob.lv + mobHitBonus - s.lv + (d.ac - (typeof teamAcBonus === 'function' ? teamAcBonus(s, true) : 0)));
    let r = roll(1, 20);
    let hit = false, heavy = false;
    if (r === 20) { hit = true; heavy = true; } else if (r !== 1 && hv >= r) hit = true;
    if (!hit) { logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 對 <span class="text-cyan-300">${s.form}</span> 的攻擊未命中。`, 'miss', 'enemy'); return; }
    let dc = (mob.dmg && mob.dmg[0]) || 1, ds = (mob.dmg && mob.dmg[1]) || 1;
    let dmg = (heavy ? dc * ds : roll(dc, ds)) + ((mob.db || 0) - (st.weaken > 0 ? 4 : 0) - (st.broken > 0 ? 2 : 0));
    if (mob._sherine) dmg = Math.floor(dmg * (mob._sherineMad ? 3 : 2));
    if (mob._grace) dmg = Math.floor(dmg * 1.5);
    dmg = Math.max(1, Math.floor(dmg * (typeof riftDamageMult === 'function' ? riftDamageMult() : 1)) - d.dr);
    dmg = Math.max(1, Math.floor(dmg * (typeof teamDmgReduceMult === 'function' ? teamDmgReduceMult(true) : 1)));
    s.hp -= dmg;
    if (typeof _petAnimAct === 'function') _petAnimAct(s, 'hurt');
    logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 攻擊 <span class="text-cyan-300">${s.form}</span>，造成 ${dmg} 點傷害。`, 'enemy-attack', 'enemy');
    if (s.hp <= 0) _guardDown(s);
    renderGuardPanel();
}
// 怪物攻擊型魔法作用於護衛（比照 applyMobMagicToSummon：只吃傷害型·純 CC/DoT 對其無效）
function applyMobMagicToGuard(mob, sk, s) {
    if (!mob || mob.curHp <= 0 || !sk || !sk.dmg || !s || s._downed || (s.hp || 0) <= 0) return;
    let d = guardDerive(s);
    let mr = d.mr || 0, dr = d.dr || 0;
    let shMul = (mob._sherine ? (mob._sherineMad ? 3 : 2) : 1) * (mob._grace ? 2 : 1);
    let baseM = roll(sk.dmg[0], sk.dmg[1]);
    let extra = (sk.db || 0) + (sk.dbLv ? (mob.lv || 0) * (sk.dbLvMult || 1) : 0);
    let dmg = sk.fixedDmg ? (baseM + extra) : (Math.floor((baseM + extra) * (typeof mrMult === 'function' ? mrMult(mr) : 1)) - dr);
    dmg = Math.max(1, Math.floor(Math.max(1, dmg * shMul) * (typeof teamDmgReduceMult === 'function' ? teamDmgReduceMult(true) : 1)));
    dmg = Math.max(1, Math.floor(dmg * (typeof riftDamageMult === 'function' ? riftDamageMult() : 1)));
    s.hp -= dmg;
    if (typeof _petAnimAct === 'function') _petAnimAct(s, 'hurt');
    logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，對 <span class="text-cyan-300">${s.form}</span> 造成 ${dmg} 點魔法傷害。`, 'enemy');
    if (sk.vamp || sk.vampFull) { let heal = sk.vampFull ? dmg : roll(sk.vamp[0], sk.vamp[1]); mob.curHp = Math.min(mob.hp, mob.curHp + heal); }
    if (s.hp <= 0) _guardDown(s);
    renderGuardPanel();
}
function _guardDown(s) {
    s.hp = 0; s._downed = true; s._diedAt = Date.now();
    s._reviveAt = Date.now() + CASTLE_GUARD_REVIVE_MS;
    if (typeof _petAnimAct === 'function') _petAnimAct(s, 'death');
    logCombat(`<span class="text-cyan-300">${s.form}</span> 倒下了，將於 30 秒後自動歸隊。`, 'magic', 'summon');
}

// ---------- 隊伍面板 HP 卡（比照召喚物·由 renderSquadPanel 併入） ----------
let _guardPanelSig = '';
function guardTeamSignature() {
    try {
        let list = guardV2List();
        return list.map(s => [s.uid, s.form, s.lv || 1, s._downed ? -1 : Math.round((s.hp || 0) / Math.max(1, s.mhp || 1) * 20)].join(':')).join('|');
    } catch (e) { return ''; }
}
function renderGuardTeamHTML() {
    try {
        let list = guardV2List();
        if (!list.length) return '';
        let now = Date.now();
        let rows = list.map(s => {
            let hpPct = Math.max(0, Math.min(100, Math.floor((s.hp || 0) / Math.max(1, s.mhp || 1) * 100)));
            let reviveSec = s._downed && s._reviveAt ? Math.max(0, Math.ceil((s._reviveAt - now) / 1000)) : 0;
            return `<div class="bg-slate-800/80 border border-cyan-800 rounded px-2 py-1 text-xs flex items-center gap-2">
                <span class="text-cyan-300 font-bold shrink-0 overflow-hidden text-ellipsis whitespace-nowrap" style="width:5.5rem;">${s.form}</span>
                <div class="bar-bg flex-1 !h-3">
                    <div class="bar-fill ${s._downed ? 'bg-slate-600' : 'bg-red-600'}" style="width:${hpPct}%;"></div>
                    <div class="bar-text text-white" style="font-size:10px;line-height:12px;">${s._downed ? '復活 ' + reviveSec + 's' : (s.hp || 0) + '/' + (s.mhp || 0)}</div>
                </div>
            </div>`;
        }).join('');
        return `<div class="flex items-center justify-between gap-2 pt-1 border-t border-cyan-900/70">
                <span class="text-cyan-300 font-bold text-xs">城堡護衛（${list.length}）</span>
            </div>${rows}`;
    } catch (e) { return ''; }
}
function renderGuardPanel(force) {
    if (!force && typeof catchupActive === 'function' && catchupActive()) return;   // 🩹 v3.8.0 補跑期間不重繪隊伍面板（renderSquadPanel 無補跑閘·會每 tick 全量重建 DOM）；補跑結束後下一個 tick 自動刷新
    try {
        let sig = guardTeamSignature();
        if (!force && sig === _guardPanelSig) return;
        _guardPanelSig = sig;
        if (typeof _squadSigTeam !== 'undefined') _squadSigTeam = '';
        if (typeof renderSquadPanel === 'function') renderSquadPanel();
    } catch (e) {}
}
setInterval(() => { try { renderGuardPanel(); } catch (e) {} }, 500);

// ---------- 招募視窗（三城堡 NPC 分派） ----------
function renderCastleGuard(div, city) {
    if (typeof _activePanel !== 'undefined') _activePanel = null;
    let spec = _guardSpecForCity(city); if (!spec || !div) return;
    let owned = (typeof clanGetCastleCity === 'function') ? clanGetCastleCity(player) : null;
    let held = (typeof siegeVictoryActive === 'function') && siegeVictoryActive() && owned === city;
    let cap = castleGuardCapacity();
    let r = castleGuardRosterActive();
    let curCount = (r && r.city === city) ? (r.count || 0) : 0;
    let sample = { form: spec.form, lv: Math.max(1, player.lv || 1) };
    let d = guardDerive(sample);
    let mhp = spec.hpPerLv * sample.lv;

    let intro = `招募 <b class="text-cyan-300">${spec.form}</b> 作為協同作戰的護衛：與召喚物、寵物、傭兵並存，`
        + `<b class="text-emerald-300">死亡 30 秒後自動復活（不消耗復活卷軸）</b>。`
        + `招募後，同盟同模式的所有角色都會獲得其跟隨。<br>`
        + `<span class="text-slate-400">可攜帶數量＝盟主魅力 / 15，最多 ${CASTLE_GUARD_MAX} 名；每招募一隻 ${(CASTLE_GUARD_COST / 10000)} 萬金幣，`
        + `持續到你的血盟宣戰其他城堡或失去本城為止。</span>`;

    let statLine = `<div class="text-slate-300 text-xs mt-1">Lv.${sample.lv}（你的等級）　HP ${mhp}　攻 1D${d.dice}+${d.flat}／${spec.aspdSec}s　AC ${d.ac}　MR ${d.mr}　受擊權重 ${spec.aggroWeight}</div>`;

    let statusHtml;
    if (!held) {
        statusHtml = `<div class="bg-slate-800/70 border border-slate-600 rounded p-3 text-sm text-amber-300">攻城獲勝並持有【${spec.label}城】期間才能招募此護衛。</div>`;
    } else {
        let curHtml = curCount > 0
            ? `<div class="bg-slate-800/70 border border-cyan-700 rounded p-2 text-sm mb-2 flex items-center justify-between gap-2">
                 <span class="text-cyan-300 font-bold">目前 ${spec.form} ×${Math.min(curCount, cap)}${curCount > cap ? `（名冊 ${curCount}·魅力上限 ${cap}）` : ''}</span>
                 <button onclick="disbandCastleGuards('${city}')" class="btn px-3 py-1 text-xs bg-red-900 hover:bg-red-800 border-red-600 text-red-200 font-bold">遣散全部</button>
               </div>`
            : '';
        let full = curCount >= cap;
        let noGold = (player.gold || 0) < CASTLE_GUARD_COST;
        let dis = cap <= 0 || full || noGold;
        let btnLabel = cap <= 0 ? '盟主魅力不足' : (full ? `已達上限（${cap}）` : (noGold ? '金幣不足' : `招募 1 名（${(CASTLE_GUARD_COST / 10000)} 萬金幣）`));
        statusHtml = curHtml + `<button ${dis ? 'disabled' : ''} onclick="hireCastleGuard('${city}')" class="btn w-full py-2 text-sm font-bold ${dis ? 'bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed' : 'bg-emerald-800 hover:bg-emerald-700 border-emerald-600 text-emerald-100'}">${btnLabel}</button>
            <div class="text-slate-500 text-xs mt-1">盟主魅力 ${castleGuardLeaderCha()} → 可攜帶 ${cap} 名</div>`;
    }
    div.innerHTML = `<div class="flex flex-col gap-1 p-1">
        <div class="text-slate-300 text-sm leading-relaxed">${intro}</div>
        ${statLine}
        <div class="mt-1">${statusHtml}</div>
    </div>`;
}
