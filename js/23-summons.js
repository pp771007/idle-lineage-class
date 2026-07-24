// ============================================================
// js/23-summons.js — 🧙 玩家召喚術 v2（v3.2.19 依「召喚怪物.md」全面改版）
//   ・sk_summon 改為「多實體召喚物」：每隻有固定 HP、可被怪物攻擊、死亡會消失
//   ・召喚控制戒指（acc_summon_ctrl）不再附加效果：單純決定「能否開選單挑選特定召喚物」＋28~48階上限5→6
//   ・無戒指＝固定召喚「已解鎖最高階（上限 52 魔熊階）」的預設怪；有戒指＝技能清單點『選擇』開選單
//   ・攻速＝該怪攻擊動畫幀數決定（幀數/8fps＋0.7s 收招·轉檔時實測 baked）；傷害依階級解鎖等級與 HP 設計（血少傷高）；命中隨玩家等級
//   ・隊伍面板顯示每隻血量＋重新施放鈕；時間到或全滅自動重施；戰場八方向 sprite 走 js/22 寵物圖層
//   🧟 v3.2.21 擴充：玩家的 造屍術(sk_zombie)／召喚屬性精靈(sk_elf_summon)／召喚強力屬性精靈(sk_elf_summon2) 也走本模組
//     ・三系互斥（SUMMON_BUFF_IDS）→ 共用 player.summonsV2 實體清單＋隊伍面板＋js/22 渲染＋js/04 受害者池（權重 召喚術/造屍術＝4·屬性精靈＝3·見 js/04 summonAggroWeight）
//     ・造屍術：玩家等級分階（法師 24/32/40/44/48/52 → Lv10~20 殭屍·HP100~800；妖精 48+ 固定 Lv10/HP100）·傷害比照召喚術模型
//     ・屬性精靈：v3.2.26 四屬性獨立表（骰/縮放逐屬性·攻速 16~18 ticks）走 spiritAttackOnce·精靈精通→精靈王升級（_elfSpiritKingOverride·js/07）——HP 實體＋戰場動態
//   ⚠️ 迷魅／傭兵的召喚 維持舊管線（setupSummon/summonTick）不動——只有「玩家」的上述技能走本模組
// ============================================================
'use strict';

// ---------- 一、召喚表（11 階·31 怪）----------
// aspd(ticks)＝攻擊動畫幀數×1.25＋7（= 幀數/8fps＋0.7 秒收招·summon-frames.json 實測）
// ring:true＝需召喚控制戒指才能選；每階第一隻＝無戒指時的預設怪（52 階以上全部需戒指·無戒上限＝魔熊階預設）
// proc：攻擊時機率觸發（kind: magic單體魔法 / magicAll全體魔法 / poison單體中毒 / poisonAll全體中毒；heavy=傷害倍率）
const SUMMON_TIERS = [
    { reqLv: 28, div: 8,  cap: 5, ringCap: 6, mobs: [
        { n: '哈柏哥布林', lv: 20, hp: 300, aspd: 16 },
        { n: '艾多倫',     lv: 20, hp: 180, aspd: 17, ring: true },
        { n: '安普',       lv: 20, hp: 120, aspd: 12, ring: true } ] },
    { reqLv: 32, div: 8,  cap: 5, ringCap: 6, mobs: [
        { n: '甘地妖魔',     lv: 24, hp: 350, aspd: 12 },
        { n: '都達瑪拉妖魔', lv: 24, hp: 210, aspd: 15, ring: true },
        { n: '妖魔巡守',     lv: 24, hp: 140, aspd: 12, ring: true } ] },
    { reqLv: 36, div: 8,  cap: 5, ringCap: 6, mobs: [
        { n: '狂野毒牙', lv: 28, hp: 400, aspd: 16 },
        { n: '狂野之毒', lv: 28, hp: 240, aspd: 16, ring: true, proc: [{ kind: 'poison', p: 0.10, name: '劇毒撕咬' }] },
        { n: '狂野之魔', lv: 28, hp: 160, aspd: 16, ring: true, proc: [{ kind: 'magic', p: 0.10, name: '水泡', ele: 'water' }] } ] },
    { reqLv: 40, div: 8,  cap: 5, ringCap: 6, mobs: [
        { n: '食人妖精',   lv: 32, hp: 450, aspd: 13 },
        { n: '食人妖精王', lv: 32, hp: 400, aspd: 13, ring: true },
        { n: '冰人',       lv: 32, hp: 180, aspd: 17, ring: true, proc: [{ kind: 'magic', p: 0.10, name: '冰錐', ele: 'water' }] } ] },
    { reqLv: 44, div: 8,  cap: 5, ringCap: 6, mobs: [
        { n: '狂暴蜥蜴人', lv: 36, hp: 500, aspd: 17 },
        { n: '重裝蜥蜴人', lv: 36, hp: 300, aspd: 18, ring: true },
        { n: '高等蜥蜴人', lv: 36, hp: 200, aspd: 17, ring: true, proc: [{ kind: 'magic', p: 0.10, name: '水泡', ele: 'water' }] } ] },
    { reqLv: 48, div: 8,  cap: 5, ringCap: 6, mobs: [
        { n: '火蜥蜴',     lv: 40, hp: 550, aspd: 16 },
        { n: '火焰戰士',   lv: 40, hp: 330, aspd: 17, ring: true },
        { n: '火焰弓箭手', lv: 40, hp: 220, aspd: 21, ring: true } ] },
    { reqLv: 52, div: 8,  cap: 5, ringCap: 5, mobs: [
        { n: '魔熊',   lv: 44, hp: 600, aspd: 15 },
        { n: '魔狼',   lv: 44, hp: 360, aspd: 17, ring: true },
        { n: '魔蝙蝠', lv: 44, hp: 240, aspd: 22, ring: true, proc: [{ kind: 'magic', p: 0.10, name: '超音波', ele: 'none' }] } ] },
    { reqLv: 56, div: 10, cap: 4, ringCap: 4, mobs: [
        { n: '巨大守護螞蟻',   lv: 48, hp: 650, aspd: 13, ring: true },
        { n: '強化白螞蟻群',   lv: 48, hp: 390, aspd: 17, ring: true },
        { n: '巨大強化白螞蟻', lv: 48, hp: 260, aspd: 15, ring: true, proc: [{ kind: 'poisonAll', p: 0.10, name: '噴射毒液' }] } ] },
    { reqLv: 60, div: 12, cap: 4, ringCap: 4, mobs: [
        { n: '地獄奴隸', lv: 52, hp: 700, aspd: 13, ring: true },
        { n: '闇精靈王', lv: 52, hp: 420, aspd: 18, ring: true },
        { n: '食腐獸',   lv: 52, hp: 280, aspd: 15, ring: true, proc: [{ kind: 'poisonAll', p: 0.10, name: '噴射毒液' }] } ] },
    { reqLv: 64, div: 20, cap: 2, ringCap: 2, mobs: [
        { n: '地獄束縛犬', lv: 50, hp: 750, aspd: 15, ring: true, proc: [{ kind: 'magicAll', p: 0.10, name: '火焰噴吐', ele: 'fire' }] } ] },
    { reqLv: 68, reqCha: 36, fixedCount: 1, cap: 1, ringCap: 1, mobs: [
        { n: '變形怪首領', lv: 53, hp: 800, aspd: 17, ring: true, proc: [{ kind: 'magic', p: 0.15, name: '冰裂術', ele: 'water' }, { kind: 'magic', p: 0.15, name: '烈炎術', ele: 'fire' }] } ] },
    { reqLv: 72, reqCha: 36, fixedCount: 1, cap: 1, ringCap: 1, mobs: [
        { n: '巨大牛人', lv: 53, hp: 1000, aspd: 15, ring: true, proc: [{ kind: 'magic', p: 0.20, name: '寒冰鎚', ele: 'water', heavy: 1.6, slow: true }] } ] },
    { reqLv: 72, reqCha: 44, fixedCount: 1, cap: 1, ringCap: 1, premium: 1.15, mobs: [
        { n: '黑豹', lv: 63, hp: 2000, aspd: 22, ring: true, proc: [{ kind: 'magic', p: 0.20, name: '地面震裂', ele: 'earth', heavy: 1.6, stun: true }] } ] }
];
const SUMMON_NO_RING_MAX_LV = 52;   // 無戒指：固定召喚「已解鎖最高階」預設怪，上限 52 魔熊階

function _sumTierOf(name) { for (const t of SUMMON_TIERS) { const m = t.mobs.find(x => x.n === name); if (m) return { tier: t, mob: m }; } return null; }
// 🩸 v3.3.23 owner 參數化（預設玩家·傭兵召喚術傳 ally）：選怪/數量/傷害/命中皆依 owner 的等級·魅力·召喚控制戒指。
function _sumQualified(name, owner) {   // owner 目前可召喚此怪？（等級＋魅力＋戒指）
    owner = owner || player;
    const e = _sumTierOf(name); if (!e) return false;
    if ((owner.lv || 1) < e.tier.reqLv) return false;
    if (e.tier.reqCha && ((owner.d && owner.d.cha) || 0) < e.tier.reqCha) return false;
    if (e.mob.ring && !hasSummonCtrlRing(owner)) return false;
    return true;
}
function _sumDefaultForm(owner) {   // 無戒指（或未選擇）的預設：已解鎖最高階（≤52）的第一隻
    owner = owner || player;
    let best = null;
    for (const t of SUMMON_TIERS) {
        if (t.reqLv > SUMMON_NO_RING_MAX_LV) continue;
        if ((owner.lv || 1) >= t.reqLv) best = t.mobs[0].n;
    }
    return best;
}
function _sumCountFor(name, owner) {   // 數量：floor((魅力+6)/div)·上限 cap（28~48 階有戒指 ringCap=6）；68/72 階固定 1
    owner = owner || player;
    const e = _sumTierOf(name); if (!e) return 0;
    if (e.tier.fixedCount) return e.tier.fixedCount;
    const cha = (owner.d && owner.d.cha) || 0;
    const n = Math.floor((cha + 6) / e.tier.div);
    const cap = hasSummonCtrlRing(owner) ? e.tier.ringCap : e.tier.cap;
    return Math.max(0, Math.min(cap, n));
}
// 傷害設計：整隊基準 DPS 由「魅力×玩家等級」連續成長，再由召喚階級按比例逐階增加。
//   同階以中位 HP 為基準套用溫和反向曲線：(中位HP/自身HP)^0.35；血越少 DPS 越高、血越多 DPS 越低。
//   🧙 v3.2.23 混合制（用戶拍板）：每隻單價＝隊伍基準 ÷ 該階數量上限（固定·不隨實際隻數變）
//   → 多隻＝成倍疊加（5 隻＝單隻的 5 倍·「單隻與多隻有正常倍數差」）；
//   → 後期階級上限縮小（64 階 2 隻·68/72 階固定 1 隻）→ 單隻天生承載半隊/整隊基準，
//     滿編時（1~2 隻）總傷仍嚴格超越所有前面階級的滿隊（基準每階 +7 遞增）；
//   🧙 v3.2.24 每一隻完全獨立（用戶拍板「依數量真實出現·每隻血量/傷害獨立計算」）：
//   → 戒指加召的第 6 隻也是全額單價（總傷 6/5×基準）——隻數只增不稀釋，任何一隻的數值不受其他隻影響。
//   🧙 v3.2.27 魅力曲線：隊伍基準=(39+0.09×魅力×玩家等級)×(1+階級×6%)。
//   → 50級滿編無精通召喚略勝無精靈精通的強力精靈；階級倍率同時保證 68級單隻仍高於所有低階滿編（含第6隻）。
// 🏺 v3.7.20 珍藏的巨大胡蘿蔔（summonMdmg）：掃 owner 全裝備欄的「召喚物魔法傷害+N」，併入 dmgMult 的 magicDmg 基底
function _sumOwnerMdBonus(owner) { let s = 0; if (owner && owner.eq) { for (let k in owner.eq) { let e = owner.eq[k]; if (!e) continue; let d = DB.items[e.id]; if (d && d.summonMdmg) s += d.summonMdmg; } } return s; }
function _sumScaledHit(mobLv, tierIdx, mastery, owner) {
    owner = owner || player;
    const lv = Math.max(1, owner.lv || 1);
    const cha = Math.max(0, (owner.d && owner.d.cha) || 0);
    return lv + Math.floor(lv * 0.75 + cha * 0.35)
        + Math.floor((mobLv || 1) / 8) + Math.max(0, tierIdx || 0) + (mastery ? 5 : 0);
}
function _sumSkillPower(s, owner) {
    owner = owner || player;
    const e = _sumTierOf(s && s.form);
    const tierIdx = e ? Math.max(0, SUMMON_TIERS.indexOf(e.tier)) : 0;
    const cha = Math.max(0, (owner.d && owner.d.cha) || 0);
    return Math.max(1, Math.floor((s && s.lv || 1) + (owner.lv || 1) * 0.35 + tierIdx * 2 + cha * 0.5));
}
function _sumHpDpsMult(t, m) {   // 同階生存力換輸出：低血較痛、高血較坦；0.35 次方避免血量差距被放大成失衡
    const hps = ((t && t.mobs) || []).map(x => Math.max(1, x.hp || 1)).sort((a, b) => a - b);
    if (!hps.length) return 1;
    const refHp = hps[Math.floor(hps.length / 2)];
    return Math.pow(refHp / Math.max(1, (m && m.hp) || refHp), 0.35);
}
function _sumDerive(mob, owner) {
    owner = owner || player;
    const e = _sumTierOf(mob.form || mob.n) || _sumTierOf(mob.n);
    if (!e) return { flat: 0, dice: 1, aspd: 20, dmgMult: 1, hit: 0, ac: 10, dr: 0 };   // 🛡️ v3.2.40 防呆：未知 form（改名/殘留實體）回安全預設，不 null-deref（js/04 呼叫端無 try/catch）
    const t = e.tier, m = e.mob;
    const tierIdx = Math.max(0, SUMMON_TIERS.indexOf(t));
    const cha = Math.max(0, (owner.d && owner.d.cha) || 0);
    const squadDps = (39 + 0.09 * cha * (owner.lv || 1)) * (1 + tierIdx * 0.06) * (t.premium || 1) * _sumHpDpsMult(t, m);
    const designCount = Math.max(1, t.cap || 1);   // 🧙 v3.2.24 單價＝基準/上限·恆定（每隻獨立·第 6 隻同為全額不稀釋）
    const mean = (squadDps / designCount) * (m.aspd / 10);
    const flat = Math.round(mean * 0.55);
    const dice = Math.max(1, Math.round((mean - flat) * 2));
    const mastery = (owner.mastery === 'm_summon');   // 🧙 召喚精通沿用：傷害×1.2、命中+5
    return {
        flat, dice, aspd: m.aspd,
        dmgMult: (mastery ? 1.2 : 1) * (1 + Math.min(12, Math.max(0, ((owner.d && owner.d.magicDmg) || 0) + _sumOwnerMdBonus(owner))) / 80),   // 🏺 v3.7.20 +summonMdmg
        hit: _sumScaledHit(m.lv, tierIdx, mastery, owner),
        ac: 10 - Math.floor(m.lv / 4),   // 被打時的防禦（越低越難被命中）
        dr: Math.floor(m.lv / 10)
    };
}

// ---------- 一之二、造屍術 v2＋屬性精靈 v2（v3.2.21）----------
// 🧟 造屍術：玩家等級決定殭屍階級（用戶指定 HP 表）；妖精 48 級以上固定最低階（Lv10/HP100）。
//   傷害比照召喚術 v2 模型：DPS＝(4＋解鎖等級×0.55)×2.2（單體隨從≒半隊召喚物）；攻速＝攻擊動畫 4 幀×1.25＋7＝12 ticks。
const ZOMBIE_TIERS = [
    { reqLv: 24, lv: 10, hp: 100 },
    { reqLv: 32, lv: 12, hp: 200 },
    { reqLv: 40, lv: 14, hp: 400 },
    { reqLv: 44, lv: 16, hp: 500 },
    { reqLv: 48, lv: 18, hp: 600 },
    { reqLv: 52, lv: 20, hp: 800 }
];
const ZOMBIE_ASPD = 12;   // 人形殭屍 attack 4 幀 ×1.25＋7（summon-frames 實測）
function _zmbTierForPlayer(owner) {
    owner = owner || player;   // 🩸 v3.3.24 owner 參數化（傭兵造屍術傳 ally）
    if (owner.cls === 'elf') return (owner.lv || 1) >= 48 ? ZOMBIE_TIERS[0] : null;   // 妖精：48+ 固定 Lv10/HP100
    let best = null;
    for (const t of ZOMBIE_TIERS) if ((owner.lv || 1) >= t.reqLv) best = t;
    return best;
}
function _zmbDerive(s, owner) {
    owner = owner || player;
    const t = ZOMBIE_TIERS.find(x => x.lv === s.lv) || ZOMBIE_TIERS[0];
    const tierIdx = Math.max(0, ZOMBIE_TIERS.indexOf(t));
    const dps = 22 + (owner.lv || 1) * 0.45 + tierIdx * 5;
    const mean = dps * (ZOMBIE_ASPD / 10);
    const flat = Math.round(mean * 0.55);
    const dice = Math.max(1, Math.round((mean - flat) * 2));
    const mastery = (owner.mastery === 'm_summon');   // 🧙 召喚精通沿用：造屍術隨從傷害×1.2、命中+5
    return {
        flat, dice, aspd: ZOMBIE_ASPD,
        dmgMult: (mastery ? 1.2 : 1) * (1 + Math.min(12, Math.max(0, ((owner.d && owner.d.magicDmg) || 0) + _sumOwnerMdBonus(owner))) / 80),   // 🏺 v3.7.20 +summonMdmg
        hit: _sumScaledHit(s.lv, tierIdx, mastery, owner),
        ac: 10 - Math.floor(s.lv / 4),
        dr: Math.floor(s.lv / 10)
    };
}
// 🧝 屬性精靈：v3.2.26 四屬性獨立表走 spiritAttackOnce（骰/縮放逐屬性·攻速 16~18 ticks 依 _spiritDerive）；HP/等級為實體設計值。
// 👑 v3.2.25 精靈精通改版（用戶拍板）：不再增加數量（一律 1 隻）——有精靈精通時，
//    「召喚強力屬性精靈」改為召喚更強大的「<屬性>精靈王」（SPIRIT_KING 獨立參數·使用原強力精靈的動態）；
//    無精通的強力屬性精靈動態改用一般屬性精靈的圖（強力圖成為精靈王專屬）——由 formGfx 欄位分派（js/22 渲染層）。
// 🧝 v3.2.26 四屬性獨立數值（用戶 HP 表）＋攻速改依動態幀數（幀數×1.25＋7：水/風 9幀→1.8s·火/地 7幀→1.6s）。
//   傷害設計：單發＝原 DPS×攻擊間隔（攻速慢→單發重）；強力/精靈王再依 HP 曲線反比（血厚傷低·(基準HP/自身HP)^0.7：風最坦最輕·水火最痛）。
//   欄位：dice=[顆數,面數]·scale=固定值除數(魅力×等級/scale·可小數)·hp/aspd 依屬性。
const SPIRIT_DEF = {
    sk_elf_summon:  { lv: 40, strong: false, mrPenBase: 10, hitLvOff: 10, dmgMult: 1.00, ele: {
        water: { hp: 400, aspd: 18, dice: [2, 38], scale: 11 },
        wind:  { hp: 400, aspd: 18, dice: [2, 38], scale: 11 },
        fire:  { hp: 400, aspd: 16, dice: [2, 33], scale: 12.5 },
        earth: { hp: 400, aspd: 16, dice: [2, 33], scale: 12.5 } } },
    sk_elf_summon2: { lv: 50, strong: true, mrPenBase: 20, hitLvOff: 20, dmgMult: 1.18, ele: {
        water: { hp: 600, aspd: 18, dice: [3, 48], scale: 5.5 },
        fire:  { hp: 600, aspd: 16, dice: [3, 43], scale: 6.2 },
        earth: { hp: 650, aspd: 16, dice: [3, 40], scale: 6.6 },
        wind:  { hp: 720, aspd: 18, dice: [3, 42], scale: 6.3 } } }
};
// 👑 精靈王（精靈精通專屬）：HP＝強力×2 循曲線·單發約強力 1.6 倍；攻擊命中後 15% 機率釋放「同屬性全體法術」（每目標約半發威力·吃魔抗/剋制）
const SPIRIT_KING = { lv: 60, mrPenBase: 30, hitLvOff: 25, dmgMult: 1.30,
    aoe: { p: 0.15, names: { water: '冰雪暴', fire: '火風暴', wind: '龍捲風', earth: '震裂術' } },
    ele: {
        water: { hp: 1200, aspd: 18, dice: [4, 54], scale: 3.9 },
        fire:  { hp: 1200, aspd: 16, dice: [4, 48], scale: 4.4 },
        earth: { hp: 1300, aspd: 16, dice: [4, 45], scale: 4.6 },
        wind:  { hp: 1440, aspd: 18, dice: [4, 48], scale: 4.4 } } };
const SPIRIT_ELE_ZH = { fire: '火', water: '水', wind: '風', earth: '地' };
function _spiritSpec(skId, ele, king) {   // 實體規格（依技能/屬性/是否精靈王合併）
    const base = king ? SPIRIT_KING : (SPIRIT_DEF[skId] || SPIRIT_DEF.sk_elf_summon);
    const e = (base.ele && (base.ele[ele] || base.ele.water)) || {};
    return { lv: base.lv, mrPenBase: base.mrPenBase, hitLvOff: base.hitLvOff, dmgMult: base.dmgMult, aoe: king ? SPIRIT_KING.aoe : null, hp: e.hp || 400, aspd: e.aspd || 16, dice: e.dice || [1, 40], scale: e.scale || 20 };
}
function _spiritIsKing(skId) { return skId === 'sk_elf_summon2' && player && player.mastery === 'e_spirit'; }
function _spiritFormName(skId, ele) {
    if (_spiritIsKing(skId)) return (SPIRIT_ELE_ZH[ele] || '') + '之精靈王';   // 🏷️ v3.2.27 更名：〈屬〉之精靈系（圖檔資料夾仍為 X屬性精靈·由 formGfx 對應）
    return (SPIRIT_DEF[skId].strong ? '強力' : '') + (SPIRIT_ELE_ZH[ele] || '') + '之精靈';
}
function _spiritDerive(s) {
    const spec = _spiritSpec(s.skId, s.ele, !!s._king);
    return {
        aspd: spec.aspd,   // 🧝 v3.2.26 攻速＝動態幀數×1.25＋7（水/風 18 ticks·火/地 16 ticks）
        ac: 10 - Math.floor(spec.lv / 4),
        dr: Math.floor(spec.lv / 10)
    };
}
// 依實體所屬技能分派衍生數值（攻速/防禦；召喚術另含傷害）
function _sumDeriveAny(s) {
    if (s.skId === 'sk_zombie') return _zmbDerive(s);
    if (s.skId === 'sk_elf_summon' || s.skId === 'sk_elf_summon2') return _spiritDerive(s);
    return _sumDerive(s);   // 🧙 v3.2.24 單價恆定＝基準/cap·與在場隻數無關（_squadSize 已停用）
}
const SUMMON_V2_SKILLS = ['sk_summon', 'sk_zombie', 'sk_elf_summon', 'sk_elf_summon2'];
const SUMMON_V2_TITLES = { sk_summon: '召喚物', sk_zombie: '殭屍隨從', sk_elf_summon: '精靈', sk_elf_summon2: '精靈' };
function summonV2ActiveSk() { return (player && player._summonV2Sk) || 'sk_summon'; }

// ---------- 二、施放／解散／自動重施 ----------
// 執行期實體：player.summonsV2 = [{ uid, form, lv, hp, mhp, _atkCd, _animAct, _px.. }]（不入存檔；讀檔後 buff 仍在→自動重施）
// 玩家選擇：player.summonChoice（入存檔·僅有戒指且資格符合時生效）
function summonV2List() { return (player && player.summonsV2) || []; }
// 🧱 v3.4.50 傭兵召喚物清單（可被攻擊的抽象實體·無 sprite）：ally.summon 帶 hp/mhp(由 js/06 _mercSummonAttachEntity 附加)→進 js/04 受害者池。
//   只收「有血量欄位且存活」者（舊存檔未遷移的召喚物自然排除·到期重召後補齊）；玩家迷魅(player.summon)不在此（維持無敵抽象）。
function mercSummonList() {
    if (typeof player === 'undefined' || !player || !player.allies || !player.allies.length) return [];
    let out = [];
    for (let a of player.allies) { let s = a && !a._downed && a.summon; if (s && (s.mhp || 0) > 0 && !s._downed && (s.hp || 0) > 0) out.push(s); }
    return out;
}
function summonV2Knows(skId) { skId = skId || 'sk_summon'; return ((player.skills || []).includes(skId) || (player.grantedSkills || []).includes(skId)); }   // 已習得（比照 castSkillInner 的 grantedSkills 旁路）
function summonRenderList() {   // 供 js/22 寵物圖層渲染（含死亡殘影 2 秒）
    if (typeof player === 'undefined' || !player || !player.cls) return [];
    const now = Date.now();
    return summonV2List().filter(s => !s._downed || (now - (s._diedAt || 0)) < 2000);
}
function summonV2ActiveForm(owner) {   // 本次施放要召的怪（owner 預設玩家·傭兵召喚術傳 ally）
    owner = owner || player;
    let form = null;
    if (hasSummonCtrlRing(owner) && owner.summonChoice && _sumQualified(owner.summonChoice, owner) && _sumCountFor(owner.summonChoice, owner) > 0) form = owner.summonChoice;   // v3.2.39 稽核修：數量0（魅力不足）的選擇回退預設，避免施放卡死＋每秒紅字
    if (!form) form = _sumDefaultForm(owner);
    return form;
}
// 🧙 v3.3.23 傭兵召喚術 v2 抽象輸出計畫：依傭兵（owner）等級＋召喚控制戒指選怪·回 { form, count, lv }（純供傷害計算·不生成戰場實體/血條/面板）；無法召喚回 null（呼叫端落回舊分階模型）。
function mercSummonV2Plan(owner) {
    owner = owner || player;
    const form = summonV2ActiveForm(owner);
    if (!form) return null;
    const cnt = _sumCountFor(form, owner);
    if (cnt <= 0) return null;
    const e = _sumTierOf(form);
    return { form: form, count: cnt, lv: (e && e.mob && e.mob.lv) || 1 };
}
function summonV2CastFor(skId, silent) {   // castSkill 分流入口（sk_summon/sk_zombie/sk_elf_summon/sk_elf_summon2）：true=成功（MP 由 castSkillInner 扣）
    if (typeof _petInWild === 'function' && !_petInWild()) { if (!silent) logSys('安全區內無法召喚（請到狩獵區再施放）。'); return false; }
    let ents = [], castMsg = '';
    if (skId === 'sk_summon') {
        const form = summonV2ActiveForm();
        if (!form) { if (!silent) logSys('<span class="text-red-400">等級不足：召喚術需要等級 28 以上。</span>'); return false; }
        const cnt = _sumCountFor(form);
        if (cnt <= 0) { if (!silent) logSys(`<span class="text-red-400">魅力不足：無法召喚 ${form}（數量=(魅力+6)/${(_sumTierOf(form).tier.div || 8)}）。</span>`); return false; }
        const e = _sumTierOf(form);
        for (let i = 0; i < cnt; i++) ents.push({ uid: uid(), skId: skId, form: form, lv: e.mob.lv, hp: e.mob.hp, mhp: e.mob.hp, _atkCd: 5 + i * 3 });
        castMsg = `你召喚了 <span class="text-purple-300">${form}</span> ×${cnt}。`;
    } else if (skId === 'sk_zombie') {   // 🧟 造屍術：單一殭屍·階級依玩家等級/職業
        const t = _zmbTierForPlayer();
        if (!t) { if (!silent) logSys('<span class="text-red-400">等級不足，無法施展造屍術。</span>'); return false; }
        ents.push({ uid: uid(), skId: skId, form: '人形殭屍', lv: t.lv, hp: t.hp, mhp: t.hp, _atkCd: 5 });
        castMsg = `你施放造屍術，喚起了 <span class="text-purple-300">人形殭屍</span>（Lv.${t.lv}·HP ${t.hp}）。`;
    } else if (skId === 'sk_elf_summon' || skId === 'sk_elf_summon2') {   // 🧝 屬性精靈：依玩家屬性·一律 1 隻（👑 v3.2.25 精靈精通改為昇華精靈王·不再加隻數）
        const ele = player.elfEle;
        if (!ele || !SPIRIT_ELE_ZH[ele]) { if (!silent) logSys('<span class="text-red-400">尚未選擇屬性，無法召喚屬性精靈。</span>'); return false; }
        const king = _spiritIsKing(skId);
        const spec = _spiritSpec(skId, ele, king);
        const form = _spiritFormName(skId, ele);
        // 動態分派：精靈王＝原「強力X屬性精靈」圖（專屬）；強力屬性精靈（無精通）與一般精靈＝「X屬性精靈」圖
        const gfx = (king ? '強力' : '') + SPIRIT_ELE_ZH[ele] + '屬性精靈';
        ents.push({ uid: uid(), skId: skId, form: form, formGfx: gfx, ele: ele, lv: spec.lv, hp: spec.hp, mhp: spec.hp, _king: king, _atkCd: 5 });
        castMsg = king
            ? `精靈之力在你的精通下昇華——你召喚了 <span class="text-purple-300 font-bold">${form}</span>！`
            : `你召喚了 <span class="text-purple-300">${form}</span>。`;
    } else return false;
    // 同時只能有一種召喚：清除其他召喚 buff＋舊管線殘留（比照 setupSummon 的清除迴圈）
    (player.skills || []).forEach(s => { const d = DB.skills[s]; if (d && d.summon) player.buffs[s] = 0; });
    if (player.summon && player.summon.skId !== 'sk_charm') player.summon = null;
    player.buffs[skId] = (DB.skills[skId].dur || 3600);
    player.summonsV2 = ents;
    player._summonV2Sk = skId;
    player._summonV2On = true;   // 自動重施開關（取消勾選/手動解散時關閉）
    logCombat(castMsg, 'magic', 'summon');
    renderSummonPanel(true);
    return true;
}
function summonV2Cast(silent) { return summonV2CastFor('sk_summon', silent); }   // 相容舊呼叫點
function summonV2DismissAll(quiet) {
    if (player.summonsV2 && player.summonsV2.length && !quiet) logCombat('召喚物解散了。', 'magic', 'summon');
    player.summonsV2 = [];
    player._summonV2On = false;
    player.buffs[summonV2ActiveSk()] = 0;
    renderSummonPanel(true);
}
function summonV2Recast() {   // 隊伍面板「重新施放」鈕：走正規 castSkill（檢查 MP/沉默）
    const skId = summonV2ActiveSk();
    if (!summonV2Knows(skId)) return;
    if (typeof castSkill === 'function') castSkill(skId);
}

// ---------- 三、tick（js/03 召喚階段呼叫）----------
function summonV2Tick() {
    if (typeof player === 'undefined' || !player || !player.cls) return;
    const skId = summonV2ActiveSk();
    const list = player.summonsV2 || [];
    // 玩家死亡：召喚物全數消散（比照舊制 killPlayer 清 player.summon）
    if (player.dead) { if (list.length) { player.summonsV2 = []; renderSummonPanel(true); } return; }
    // 到期：全滅處理交由下方自動重施
    if ((player.buffs[skId] || 0) <= 0 && list.length) {
        logCombat(`<span class="text-purple-300">${SUMMON_V2_TITLES[skId] || '召喚物'}</span> 的契約到期消失了。`, 'magic', 'summon');
        player.summonsV2 = [];
        renderSummonPanel(true);
    }
    const alive = (player.summonsV2 || []).filter(s => !s._downed);
    // 自動重施：開關開啟＋已習得＋在狩獵區＋(全滅或到期)→每 2 秒嘗試一次（castSkill 內部把關 MP/沉默）
    if (player._summonV2On && !alive.length && summonV2Knows(skId)
        && (typeof _petInWild !== 'function' || _petInWild())
        && state.ticks >= (player._summonV2RecastCd || 0)) {
        player._summonV2RecastCd = state.ticks + 20;
        if (typeof castSkill === 'function') castSkill(skId);
        return;
    }
    if (!alive.length) return;
    if (typeof _petInWild === 'function' && !_petInWild()) return;   // 安全區：不行動（不會有怪）
    for (const s of alive) {
        s._atkCd = (s._atkCd != null ? s._atkCd : 5) - 1;
        if (s._atkCd > 0) continue;
        const d = _sumDeriveAny(s);
        s._atkCd = d.aspd;
        const t = (typeof _petPickTarget === 'function') ? _petPickTarget(s) : getTarget();
        if (!t) continue;
        // 🎯 v3.7.97 仇恨：召喚物攻擊傷害（含 proc/AOE 波及）→記給該召喚物實體
        if (typeof threatWrap === 'function') threatWrap(s, () => { if (s.skId === 'sk_elf_summon' || s.skId === 'sk_elf_summon2') spiritAttackOnce(s, t); else summonV2AttackOnce(s, d, t); });
        else if (s.skId === 'sk_elf_summon' || s.skId === 'sk_elf_summon2') spiritAttackOnce(s, t);   // 🧝 屬性精靈：玩家／傭兵共用公式（傭兵呼叫點見 js/07）
        else summonV2AttackOnce(s, d, t);   // 召喚術/造屍術：flat＋1D骰 模型（殭屍無 proc·由 _sumTierOf 守衛跳過）
    }
    // 死亡殘影過期清理（渲染保留 2 秒）
    const now = Date.now();
    const before = (player.summonsV2 || []).length;
    player.summonsV2 = (player.summonsV2 || []).filter(s => !s._downed || (now - (s._diedAt || 0)) < 2200);
    if ((player.summonsV2 || []).length !== before) renderSummonPanel(true);
}
function summonV2AttackOnce(s, d, t, owner) {
    owner = owner || player;   // 🩸 v3.3.23 owner 參數化：傭兵召喚術抽象輸出共用（讀 owner 裝備/精通；killMob 仍歸真隊長·不換身）
    const _ownerDmgMult = (owner !== player && typeof royalAllyMult === 'function') ? royalAllyMult() : 1;   // 👑 傭兵召喚物比照傭兵本體吃隊長魅力；玩家召喚固定1
    const _sgb = (typeof summonGearBonus === 'function') ? summonGearBonus(owner) : { dmg: 0, hit: 0 };   // 🏺 喚獸師的訓練鞭等
    const _ia = (typeof teamIlluAura === 'function') ? teamIlluAura(s, true) : null;   // 🩹 v3.2.67 幻覺攻擊光環（化身+10傷／歐吉+4傷+4命）全隊生效→注入召喚物普攻（s 非提供者·排除無效果=取全隊）
    const _ownerIa = (owner !== player && !((owner.buffs || {}).sk_illu_lich > 0) && typeof teamIlluAura === 'function') ? teamIlluAura(owner, true) : null;   // 傭兵 d 已含自身光環；補入其他隊員提供的巫妖魔傷。🩹 v3.4.47：owner 自身已持有巫妖(共享會鋪給全隊)→own(+2 在 d)＋others(+2)＝雙算→自身持有時不再補差額
    const _baseMd = Math.min(12, Math.max(0, (owner.d && owner.d.magicDmg) || 0));
    const _teamMd = Math.min(12, Math.max(0, _baseMd + ((_ownerIa && _ownerIa.md) || 0)));
    const _magicAuraRatio = (1 + _teamMd / 80) / (1 + _baseMd / 80);   // _sumDerive/_zmbDerive 已含自身 magicDmg，只補差額避免雙算
    const _attackMult = d.dmgMult * _magicAuraRatio;
    const hv = stretchHitValue(d.hit + _sgb.hit + (_ia ? _ia.eh : 0) - t.lv + mobEffAC(t));
    const r = roll(1, 20);
    _petAnimAct(s, 'attack', t.uid);   // 🎬 v3.2.73 補跑中不設→回前景不同步爆播
    if (!((r === 20) || (r !== 1 && hv >= r))) { if (typeof vfxMiss === 'function') vfxMiss(t); logCombat(`<span class="text-purple-300">${s.form}</span> 的攻擊未命中。`, 'miss'); return; }
    let dmg = ((r === 20 ? d.dice : roll(1, d.dice)) + d.flat + _sgb.dmg) * _attackMult + (_ia ? _ia.ed : 0);
    dmg = Math.max(1, Math.floor(dmg) - (t.dr || 0));
    dmg += traumaPhysicalBonus(t);
    dmg = Math.max(1, Math.floor(dmg * _ownerDmgMult));
    markBossPhysicalHit(t);
    t.curHp -= dmg; if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(t, dmg, 'melee'); t.justHit = 'normal'; mobWake(t);   // 🌅 巨大骷髏：召喚物一般攻擊視為近距離
    logCombat(`<span class="text-purple-300">${s.form}</span> 攻擊 <span class="${getMobColor(t.lv)}">${t.n}</span>，造成 ${dmg}${r === 20 ? '（重擊）' : ''} 點傷害。`, 'player');
    // 技能觸發（10/15/20%·僅召喚術怪有 proc；造屍術殭屍不在 SUMMON_TIERS → e=null 直接跳過）
    const e = _sumTierOf(s.form);
    if (e && e.mob.proc && t.curHp > 0) {
        const skillPower = _sumSkillPower(s, owner);
        for (const pr of e.mob.proc) {
            if (Math.random() >= pr.p) continue;
            _petAnimAct(s, 'skill');
            if (pr.kind === 'poison') {   // 單體中毒（比照技能類中毒：單層固定 DoT）
                t.st = t.st || newMobStatus();
                t.st.poison = 150; t.st.poisonDmg = Math.max(1, Math.floor(skillPower / 2 * _ownerDmgMult)); t.st.poisonStacks = 1; t.st.poisonUnit = t.st.poisonDmg; t.st.poisonTick = 30; t.st.poisonSrc = 'summon';   // 🎯 DPS：召喚中毒歸召喚
                logCombat(`<span class="text-purple-300">${s.form}</span> 發動 <span class="text-green-300 font-bold">${pr.name}</span>，<span class="${getMobColor(t.lv)}">${t.n}</span> 中毒了！`, 'magic');
            } else if (pr.kind === 'poisonAll') {   // 全體中毒
                const all = mapState.mobs.filter(m => m && m.curHp > 0);
                all.forEach(m => { m.st = m.st || newMobStatus(); m.st.poison = 150; m.st.poisonDmg = Math.max(1, Math.floor(skillPower / 2 * _ownerDmgMult)); m.st.poisonStacks = 1; m.st.poisonUnit = m.st.poisonDmg; m.st.poisonTick = 30; m.st.poisonSrc = 'summon'; });   // 🎯 DPS：召喚全體中毒歸召喚
                if (all.length) logCombat(`<span class="text-purple-300">${s.form}</span> 發動 <span class="text-green-300 font-bold">${pr.name}</span>，敵方全體中毒！`, 'magic');
            } else {   // magic / magicAll：屬性魔法傷害（吃魔抗/DR/屬性剋制·summonElementDamage）
                const targets = (pr.kind === 'magicAll') ? mapState.mobs.filter(m => m && m.curHp > 0) : [t];
                const texts = [];
                targets.forEach(m => {
                    let pd = summonElementDamage([2, Math.max(2, Math.ceil(s.lv * 0.6))], pr.ele || 'none', m, skillPower, _attackMult * (pr.heavy || 1), 0);
                    pd = Math.max(1, Math.floor(pd * _ownerDmgMult));
                    m.curHp -= pd; if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(m, pd, 'magic'); m.justHit = (pr.ele && pr.ele !== 'none') ? pr.ele : 'magic'; mobWake(m);   // 🌅 巨大骷髏：召喚物技能視為魔法
                    texts.push(`<span class="${getMobColor(m.lv)}">${m.n}</span> ${pd}`);
                    if (pr.slow && Math.random() * 100 < Math.max(0, (100 - (m.mr || 0)) / 2)) { m.st = m.st || newMobStatus(); m.st.slow = Math.max(m.st.slow || 0, 80); }
                    if (pr.stun && Math.random() * 100 < Math.max(0, (100 - (m.mr || 0)) / 2)) { m.st = m.st || newMobStatus(); m.st.stun = Math.max(m.st.stun || 0, 30); }
                });
                if (texts.length) logCombat(`<span class="text-purple-300">${s.form}</span> 發動 <span class="text-pink-300 font-bold">${pr.name}</span> → ${texts.join('、')}`, 'magic');
                targets.forEach(m => { if (m.curHp <= 0) { const i = mapState.mobs.findIndex(x => x && x.uid === m.uid); if (i !== -1) killMob(i); } });
            }
        }
    }
    if (t.curHp <= 0) { const i = mapState.mobs.findIndex(x => x && x.uid === t.uid); if (i !== -1) killMob(i); }
    else { try { renderMobs(); } catch (e2) {} }
}
// 🧝 屬性精靈攻擊（v3.4.11 玩家實體／傭兵無敵抽象召喚共用）：
//   固定值＝owner魅力×owner等級/elemScale、魔抗穿透＝mrPenBase＋魅力/10；吃 owner 裝備/精通、魔抗/剋制/DR、幻覺光環，傭兵另吃王族隊長倍率。
function spiritAttackOnce(s, t, owner) {
    owner = owner || player;   // 🧝 玩家實體／傭兵無敵抽象精靈共用同一傷害公式
    const spec = _spiritSpec(s.skId, s.ele, !!s._king);   // 🧝 v3.2.26 四屬性獨立參數（dice/scale/攻速依屬性·王含 AOE）
    const cha = (owner.d && owner.d.cha) || 0;
    const _sgb = (typeof summonGearBonus === 'function') ? summonGearBonus(owner) : { dmg: 0, hit: 0 };
    const _ia = (typeof teamIlluAura === 'function') ? teamIlluAura(s, true) : null;   // 🩹 幻覺光環：精靈命中吃 eh；md 由 owner.d＋下方其他隊員差額進 summonDamageMult，避免重複計算
    const _ownerIa = (owner !== player && !((owner.buffs || {}).sk_illu_lich > 0) && typeof teamIlluAura === 'function') ? teamIlluAura(owner, true) : null;   // 傭兵補其他隊員的巫妖魔傷；自身光環已在 owner.d。🩹 v3.4.47：owner 自身已持有巫妖→不再補差額（共享使全隊持有＝原寫法必雙算）
    const smLike = { skId: s.skId, hitLvOff: spec.hitLvOff || 0, dmgMult: spec.dmgMult || 1 };
    _petAnimAct(s, 'attack', t.uid);   // 🎬 v3.2.73 補跑中不設→回前景不同步爆播
    const hv = summonHitValue(smLike, owner, t, _sgb.hit + (_ia ? _ia.eh : 0));
    const r = roll(1, 20);
    if (!((r === 20) || (r !== 1 && hv >= r))) { if (typeof vfxMiss === 'function') vfxMiss(t); logCombat(`<span class="text-purple-300">${s.form}</span> 的攻擊未命中。`, 'miss'); return; }
    const flat = Math.floor(cha * (owner.lv || 1) / (spec.scale || 20));
    const mrPen = (spec.mrPenBase || 0) + Math.floor(cha / 10);
    const mult = summonDamageMult(smLike, owner, true, (_ownerIa && _ownerIa.md) || 0);
    const dmg = summonElementDamage(spec.dice || [1, 40], s.ele, t, flat + _sgb.dmg + ((_ia && _ia.royalEd) || 0), mult, mrPen);   // 👑 灼熱武器：魔法型屬性精靈的一般攻擊亦取得全隊額外傷害
    t.justHit = (s.ele && s.ele !== 'none') ? s.ele : 'magic';
    t.curHp -= dmg; if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(t, dmg, 'melee'); mobWake(t);   // 🌅 巨大骷髏：屬性精靈一般攻擊視為近距離
    logCombat(`<span class="text-purple-300">${s.form}</span> 攻擊 <span class="${getMobColor(t.lv)}">${t.n}</span>，造成 ${dmg} 點傷害。`, 'player');
    // 👑 v3.2.26 精靈王：攻擊命中後 15% 機率釋放「同屬性全體法術」（冰雪暴/火風暴/龍捲風/震裂術·每目標約半發威力·吃魔抗/剋制/DR）
    if (spec.aoe && Math.random() < spec.aoe.p) {
        const spellN = (spec.aoe.names && spec.aoe.names[s.ele]) || '元素風暴';
        const targets = mapState.mobs.filter(m => m && m.curHp > 0);
        const texts = [];
        targets.forEach(m => {
            const pd = summonElementDamage([2, spec.dice[1]], s.ele, m, Math.floor(flat / 2), mult, mrPen);
            m.curHp -= pd; if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(m, pd, 'magic'); m.justHit = s.ele; mobWake(m);   // 🌅 巨大骷髏：精靈王範圍技能視為魔法
            texts.push(`<span class="${getMobColor(m.lv)}">${m.n}</span> ${pd}`);
        });
        if (texts.length) logCombat(`<span class="text-purple-300 font-bold">${s.form}</span> 釋放 <span class="text-cyan-300 font-bold">${spellN}</span> → ${texts.join('、')}`, 'magic');
        _petAnimAct(s, 'skill');
        targets.forEach(m => { if (m.curHp <= 0) { const i = mapState.mobs.findIndex(x => x && x.uid === m.uid); if (i !== -1) killMob(i); } });
    }
    if (t.curHp <= 0) { const i = mapState.mobs.findIndex(x => x && x.uid === t.uid); if (i !== -1) killMob(i); }
    else { try { renderMobs(); } catch (e2) {} }
}
// 怪物一般攻擊打召喚物（js/04 受害者池·權重 召喚術/造屍術＝4·屬性精靈＝3·見 js/04 summonAggroWeight·v3.2.21 含殭屍/屬性精靈）
function enemyAttackSummon(mob, s) {
    if (!mob || mob.curHp <= 0 || !s || s._downed || (s.hp || 0) <= 0) return;
    if (typeof _mobAnimTrigger === 'function') _mobAnimTrigger(mob, 'attack');
    const d = _sumDeriveAny(s);
    const st = mob.st || newMobStatus();
    if (st.terror > 0 && Math.random() < 0.90) return;
    const mobHitBonus = (mob.hit || 0) - (st.blindVal || 0) - (st.weaken > 0 ? 2 : 0) - (st.disease > 0 ? 4 : 0) + tamerAuraHit(mob);
    const hv = stretchHitValue(mob.lv + mobHitBonus - s.lv + (d.ac - (typeof teamAcBonus === 'function' ? teamAcBonus(s, true) : 0)));   // 🩹 v3.2.67 大地祝福/高崙 全隊 AC 減免也惠及召喚物（比照寵物）
    const r = roll(1, 20);
    let hit = false, heavy = false;
    if (r === 20) { hit = true; heavy = true; } else if (r !== 1 && hv >= r) hit = true;
    if (!hit) { logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 對 <span class="text-purple-300">${s.form}</span> 的攻擊未命中。`, 'miss', 'enemy'); return; }
    const dc = (mob.dmg && mob.dmg[0]) || 1, ds = (mob.dmg && mob.dmg[1]) || 1;
    let dmg = (heavy ? dc * ds : roll(dc, ds)) + ((mob.db || 0) - (st.weaken > 0 ? 4 : 0) - (st.broken > 0 ? 2 : 0));
    if (mob._sherine) dmg = Math.floor(dmg * (mob._sherineMad ? 3 : 2));
    if (mob._grace) dmg = Math.floor(dmg * 1.5);
    dmg = Math.max(1, Math.floor(dmg * riftDamageMult()) - d.dr);
    dmg = Math.max(1, Math.floor(dmg * (typeof teamDmgReduceMult === 'function' ? teamDmgReduceMult(true) : 1)));   // 🔮 化身對寵物／召喚物保留受傷減免；鋼鐵防護只作用於施法者自身 AC
    s.hp -= dmg;
    _petAnimAct(s, 'hurt');
    logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 攻擊 <span class="text-purple-300">${s.form}</span>，造成 ${dmg} 點傷害。`, 'enemy-attack', 'enemy');
    if (s.hp <= 0) {
        s.hp = 0; s._downed = true; s._diedAt = Date.now();
        _petAnimAct(s, 'death');   // 🎬 v3.2.73 補跑中不設→回前景靠 _downed hold 死亡末幀
        logCombat(`<span class="text-purple-300">${s.form}</span> 倒下消散了。`, 'magic', 'summon');
    }
    renderSummonPanel();
}
// 🧙 v3.2.82 怪物攻擊型魔法作用於召喚物（applyMobMagicToPet 的精簡鏡像）：召喚物無狀態系統→只吃「傷害型」魔法(sk.dmg)·純 CC/DoT 狀態技對其無效（守衛 !sk.dmg 直接 return，故 castMobMagic 全體 AOE 分支對召喚物呼叫此函式時純狀態自然略過）。
function applyMobMagicToSummon(mob, sk, s) {
    if (!mob || mob.curHp <= 0 || !sk || !sk.dmg || !s || s._downed || (s.hp || 0) <= 0) return;
    const d = _sumDeriveAny(s) || {};
    const mr = d.mr || 0, dr = d.dr || 0;
    const shMul = (mob._sherine ? (mob._sherineMad ? 3 : 2) : 1) * (mob._grace ? 2 : 1);
    let baseM = roll(sk.dmg[0], sk.dmg[1]);
    let extra = (sk.db || 0) + (sk.dbLv ? (mob.lv || 0) * (sk.dbLvMult || 1) : 0);
    let dmg = sk.fixedDmg ? (baseM + extra) : (Math.floor((baseM + extra) * mrMult(mr)) - dr);
    dmg = Math.max(1, Math.floor(Math.max(1, dmg * shMul) * (typeof teamDmgReduceMult === 'function' ? teamDmgReduceMult(true) : 1)));
    dmg = Math.max(1, Math.floor(dmg * riftDamageMult()));
    s.hp -= dmg;
    _petAnimAct(s, 'hurt');
    logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，對 <span class="text-purple-300">${s.form}</span> 造成 ${dmg} 點魔法傷害。`, 'enemy');
    if (sk.vamp || sk.vampFull) { let heal = sk.vampFull ? dmg : roll(sk.vamp[0], sk.vamp[1]); mob.curHp = Math.min(mob.hp, mob.curHp + heal); }
    if (s.hp <= 0) { s.hp = 0; s._downed = true; s._diedAt = Date.now(); _petAnimAct(s, 'death'); logCombat(`<span class="text-purple-300">${s.form}</span> 倒下消散了。`, 'magic', 'summon'); }
    renderSummonPanel();
}

// ---------- 四、隊伍面板召喚物清單（每隻血量＋重新施放）----------
let _sumPanelSig = '';
function summonTeamSignature() {
    try {
        const list = summonV2List().filter(s => s && !s._downed && (s.hp || 0) > 0);
        const skId = summonV2ActiveSk();
        const remain = Math.max(0, Math.ceil((player && player.buffs && player.buffs[skId]) || 0));
        return list.map(s => [s.uid, s.form, s.lv || 1, Math.round((s.hp || 0) / Math.max(1, s.mhp || 1) * 20)].join(':')).join('|')
            + '#' + skId + '#' + (player && player._summonV2On ? 1 : 0) + '#' + remain   // v3.2.42 稽核修：倒數逐秒刷新（原 /10 分桶＝顯示最多滯後 10 秒）
            + '#M:' + ((typeof mercSummonList === 'function') ? mercSummonList().map(s => [s.uid, s.form, Math.round((s.hp || 0) / Math.max(1, s.mhp || 1) * 20)].join(':')).join('|') : '');   // 🧱 v3.4.51 傭兵召喚物血量(5%階)入簽章→掉血/死亡/重施 500ms 內刷新 team 分頁
    } catch (e) { return ''; }
}

function renderSummonTeamHTML() {
    try {
        const list = summonV2List().filter(s => s && !s._downed && (s.hp || 0) > 0);
        const skId = summonV2ActiveSk();
        const show = list.length > 0 || !!(player && player._summonV2On && skId && summonV2Knows(skId));
        if (!show) return '';
        const remain = Math.max(0, Math.ceil((player && player.buffs && player.buffs[skId]) || 0));
        const time = Math.floor(remain / 60) + ':' + String(remain % 60).padStart(2, '0');
        const rows = list.map(s => {
            const hpPct = Math.max(0, Math.min(100, Math.floor((s.hp || 0) / Math.max(1, s.mhp || 1) * 100)));
            return `<div class="bg-slate-800/80 border border-purple-800 rounded px-2 py-1 text-xs flex items-center gap-2">
                <span class="text-purple-300 font-bold shrink-0 overflow-hidden text-ellipsis whitespace-nowrap" style="width:5.5rem;">${s.form}</span>
                <div class="bar-bg flex-1 !h-3">
                    <div class="bar-fill bg-red-600" style="width:${hpPct}%;"></div>
                    <div class="bar-text text-white" style="font-size:10px;line-height:12px;">${s.hp || 0}/${s.mhp || 0}</div>
                </div>
            </div>`;
        }).join('');
        return `<div class="flex items-center justify-between gap-2 pt-1 border-t border-purple-900/70">
                <span class="text-purple-300 font-bold text-xs">${SUMMON_V2_TITLES[skId] || '召喚物'}${list.length ? `（${list.length}）` : ''}</span>
                <span class="text-slate-400 text-xs">${remain > 0 ? time : ''}</span>
            </div>
            ${rows || '<div class="bg-slate-800/80 border border-purple-900 rounded px-2 py-1 text-xs text-slate-400">等待重新召喚</div>'}
            <button onclick="summonV2Recast()" class="btn w-full text-xs font-bold" style="padding:3px 0;background:linear-gradient(135deg,#4c1d95,#6d28d9);border:1px solid #7c3aed;color:#ddd6fe;border-radius:4px;">重新施放</button>`;
    } catch (e) { return ''; }
}
// 🧱 v3.4.51 傭兵召喚物 HP 卡（比照玩家召喚物呈現·接在其後）：v3.4.50 起傭兵召喚物無 sprite 但有血量·此為唯一血量可視化。
//   標示「協力名·召喚物名」＋同款血條；無「重新施放」鈕（被打死由 allyMaintainBuffs 自動重施·扣該傭兵 MP）、無倒數（到期同樣自動重施）。
function renderMercSummonTeamHTML() {
    try {
        if (typeof player === 'undefined' || !player || !player.allies || !player.allies.length) return '';
        const rows = [];
        for (const a of player.allies) {
            const s = a && !a._downed && a.summon;
            if (!s || !(s.mhp > 0) || s._downed || !(s.hp > 0)) continue;
            const hpPct = Math.max(0, Math.min(100, Math.floor((s.hp || 0) / Math.max(1, s.mhp || 1) * 100)));
            rows.push(`<div class="bg-slate-800/80 border border-purple-800 rounded px-2 py-1 text-xs flex items-center gap-2">
                <span class="shrink-0 overflow-hidden text-ellipsis whitespace-nowrap" style="width:8rem;" title="${(a._allyName || '協力')} 的召喚物"><span class="text-emerald-300">${a._allyName || '協力'}</span><span class="text-slate-500">·</span><span class="text-purple-300 font-bold">${s.form || s.n || '召喚物'}</span></span>
                <div class="bar-bg flex-1 !h-3">
                    <div class="bar-fill bg-red-600" style="width:${hpPct}%;"></div>
                    <div class="bar-text text-white" style="font-size:10px;line-height:12px;">${s.hp || 0}/${s.mhp || 0}</div>
                </div>
            </div>`);
        }
        if (!rows.length) return '';
        return `<div class="flex items-center justify-between gap-2 pt-1 border-t border-purple-900/70">
                <span class="text-purple-300 font-bold text-xs">傭兵召喚物（${rows.length}）</span>
            </div>` + rows.join('');
    } catch (e) { return ''; }
}

function renderSummonPanel(force) {
    try {
        // 🗑️ v3.5.83 移除 #summon-panel 的殘留清理：專案內沒有任何地方建立這個 id（召喚面板是由
        //    renderSquadPanel 畫進隊伍分頁），查找恆為 null。
        const sig = summonTeamSignature();
        if (!force && sig === _sumPanelSig) return;
        _sumPanelSig = sig;
        if (force && typeof _squadSigTeam !== 'undefined') _squadSigTeam = '';   // 🩹 v3.2.74 召喚物 HP 條在 team 分頁→強制重建 team（skill 分頁不受影響·下拉不被關）
        if (typeof renderSquadPanel === 'function') renderSquadPanel();
    } catch (e) {}
}
setInterval(() => { try { renderSummonPanel(); } catch (e) {} }, 500);

// ---------- 五、召喚選單（有召喚控制戒指才可開）----------
function openSummonSelect() {
    if (!hasSummonCtrlRing(player)) { logSys('<span class="text-red-400">需要裝備「召喚控制戒指」才能挑選召喚物。</span>'); return; }
    let ov = document.getElementById('summon-select-overlay');
    if (ov) { ov.remove(); return; }
    ov = document.createElement('div');
    ov.id = 'summon-select-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:95;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
    ov.addEventListener('click', ev => { if (ev.target === ov) ov.remove(); });
    const cur = player.summonChoice || '';
    const rows = SUMMON_TIERS.map(t => {
        const mobs = t.mobs.map(m => {
            const ok = _sumQualified(m.n);
            const cnt = ok ? _sumCountFor(m.n) : 0;
            const usable = ok && cnt > 0;   // v3.2.39 稽核修：已解鎖但數量0（魅力不足）也不可選，否則施放永遠失敗
            const d = ok ? _sumDerive({ n: m.n }) : null;
            const sel = cur === m.n;
            return `<button ${usable ? `onclick="chooseSummon('${m.n}')"` : 'disabled'} class="btn" style="display:flex;justify-content:space-between;gap:8px;width:100%;text-align:left;padding:4px 8px;margin:2px 0;border-radius:4px;border:1px solid ${sel ? '#a78bfa' : '#334155'};background:${sel ? 'linear-gradient(135deg,#4c1d95,#5b21b6)' : '#0f172a'};${usable ? '' : 'opacity:0.45;cursor:not-allowed;'}">
                <span><b class="${sel ? 'text-purple-200' : 'text-slate-200'}">${m.n}</b> <span class="text-slate-400" style="font-size:11px;">Lv.${m.lv}·HP${m.hp}</span></span>
                <span class="text-slate-400" style="font-size:11px;white-space:nowrap;">${usable ? `×${cnt}·攻1D${d.dice}+${d.flat}·${(m.aspd / 10).toFixed(1)}s` : (ok ? `魅力不足（數量 0·需(魅力+6)/${t.div}≥1）` : (t.reqCha && (player.d.cha || 0) < t.reqCha ? `需魅力${t.reqCha}` : '未解鎖'))}</span>
            </button>`;
        }).join('');
        return `<div style="margin-bottom:6px;"><div class="text-amber-300 font-bold" style="font-size:12px;">${t.reqLv} 級以上${t.reqCha ? '·魅力 ' + t.reqCha : ''}<span class="text-slate-500">（數量 ${t.fixedCount ? '固定 1 隻' : `(魅力+6)/${t.div}·最多 ${t.cap}${t.ringCap > t.cap ? '（戒指 ' + t.ringCap + '）' : ''} 隻`}）</span></div>${mobs}</div>`;
    }).join('');
    ov.innerHTML = `<div style="width:460px;max-height:82vh;overflow-y:auto;background:#0b1220;border:1px solid #6d28d9;border-radius:8px;padding:12px;font-size:13px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span class="text-purple-300 font-bold" style="font-size:15px;">🧙 召喚術：選擇召喚物</span>
            <button onclick="document.getElementById('summon-select-overlay').remove()" class="btn" style="padding:2px 10px;border:1px solid #475569;border-radius:4px;">✕</button>
        </div>
        <div class="text-slate-400" style="font-size:11px;margin-bottom:8px;">選定後，手動與自動施放的召喚術都會召喚該怪物；取消選擇則召喚已解鎖最高階的預設怪（無戒指亦同·上限 魔熊）。目前：<b class="text-purple-200">${cur || '（預設）'}</b>　<button onclick="chooseSummon('')" class="text-cyan-300 underline">改回預設</button></div>
        ${rows}
    </div>`;
    document.body.appendChild(ov);
}
function chooseSummon(name) {
    player.summonChoice = name || null;
    logSys(name ? `召喚術目標已設定為 <span class="text-purple-300 font-bold">${name}</span>。` : '召喚術已改回預設（已解鎖最高階）。');
    const ov = document.getElementById('summon-select-overlay'); if (ov) ov.remove();
    try { saveGame(); } catch (e) {}
    // 已有「召喚術」召喚物在場且選擇改變 → 立即重施一次（消耗 MP）
    // v3.2.40 稽核修：明確施放 sk_summon——原 summonV2Recast() 施的是當前技能，造屍術/屬性精靈在場時會誤重施它白花 MP
    if (player._summonV2On && summonV2ActiveSk() === 'sk_summon' && summonV2List().some(s => !s._downed && s.form !== (name || summonV2ActiveForm())) && typeof castSkill === 'function') castSkill('sk_summon');
}
