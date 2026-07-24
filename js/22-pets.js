// ============================================================
// js/22-pets.js — 🐾 夥伴系統 v2（v3.2.17 依「夥伴更新.md」全面取代舊項圈系統）
//   ・寵物＝獨立實體（等級/經驗/HP/MP/技能），非道具；捕捉入「寵物保管」（同模式全角色共通、上限＝PET_STORAGE_MAX·v3.6.37 用戶調整為 32）
//   ・出戰上限 4 隻＋魅力門檻（6/12/15/20）；每隻未倒地寵物各得玩家完整經驗；升級需求＝玩家表 1/10
//   ・死亡 5 秒後復活卷軸自動復活；返生術可立即復活；回到安全區（非野外）免費復活
//   ・戰鬥：無敵人在狩獵區八方向閒晃；有敵人自動攻擊最近的敵人（受擊權重 物理4/特殊3/魔法2）
//   ・進化（包武·Lv30+·僅一般型態·v3.2.63）：一般＋進化果實→對應高等；一般＋勝利果實→黃金龍（兩果實都有→可選）；高等/黃金龍皆最終型態；進化後 Lv1、HP/MP=進化前 50%
// ============================================================
'use strict';

// ---------- 一、寵物圖鑑（唯一真相）----------
// kind: phys(物理·受擊權重4) / spec(特殊·3) / mag(魔法·2)；tier: 0基礎 1高等 2黃金龍
// hpUp/mpUp: 升級隨機成長區間；reg: 每5秒恢復；apm/capm: 每分鐘攻擊/施法次數；stun: 硬直秒
// sk: 技能清單（w=權重擇一）；kind:'magic'(魔法傷害) 'extra'(額外普攻) 'debuff'(異常)；drainHalf=吸傷害一半HP
const PET_BOOK = {
    // ===== 基礎（起始等級 5）=====
    '牧羊犬':   { kind:'phys', tier:0, lv0:5, hp0:30, mp0:5,  hpUp:[5,8],  mpUp:[1,2], hpReg:5, mpReg:0, apm:50,    capm:0,     stun:0.58, cha:6,  evo:'高等牧羊犬', sk:[] },
    '貓':       { kind:'mag',  tier:0, lv0:5, hp0:20, mp0:30, hpUp:[3,6],  mpUp:[3,5], hpReg:2, mpReg:5, apm:55.38, capm:51.43, stun:0.58, cha:6,  evo:'高等貓', sk:[{ n:'貓寒冷戰慄', mp:7, kind:'magic', d:[1,10], ele:'none', drainHalf:true }] },
    '熊':       { kind:'phys', tier:0, lv0:5, hp0:50, mp0:0,  hpUp:[8,15], mpUp:[1,2], hpReg:8, mpReg:0, apm:38.8,  capm:0,     stun:0.67, cha:6,  evo:'高等熊', sk:[] },
    '杜賓狗':   { kind:'phys', tier:0, lv0:5, hp0:20, mp0:5,  hpUp:[3,6],  mpUp:[1,2], hpReg:5, mpReg:0, apm:60,    capm:0,     stun:0.58, cha:6,  evo:'高等杜賓狗', sk:[] },
    '狼':       { kind:'phys', tier:0, lv0:5, hp0:30, mp0:5,  hpUp:[3,8],  mpUp:[1,2], hpReg:5, mpReg:0, apm:57.6,  capm:0,     stun:0.58, cha:6,  evo:'高等狼', sk:[] },
    '浣熊':     { kind:'mag',  tier:0, lv0:5, hp0:30, mp0:20, hpUp:[3,9],  mpUp:[2,4], hpReg:2, mpReg:5, apm:49.66, capm:72,    stun:0.58, cha:6,  evo:'高等浣熊', sk:[{ n:'浣熊緩速術', mp:15, kind:'debuff', debuff:'slow', acc:50 }] },
    '小獵犬':   { kind:'mag',  tier:0, lv0:5, hp0:30, mp0:20, hpUp:[4,8],  mpUp:[2,4], hpReg:2, mpReg:5, apm:60,    capm:43.64, stun:0.58, cha:6,  evo:'高等小獵犬', sk:[{ n:'小獵犬地獄之牙', mp:6, kind:'magic', d:[1,15], ele:'earth' }] },
    '聖伯納犬': { kind:'mag',  tier:0, lv0:5, hp0:30, mp0:30, hpUp:[6,10], mpUp:[2,4], hpReg:2, mpReg:5, apm:40,    capm:38.92, stun:0.58, cha:6,  evo:'高等聖伯納犬', sk:[{ n:'聖伯納犬風刃', mp:6, kind:'magic', d:[1,15], ele:'wind' }] },
    '狐狸':     { kind:'mag',  tier:0, lv0:5, hp0:15, mp0:30, hpUp:[3,9],  mpUp:[2,3], hpReg:2, mpReg:5, apm:48,    capm:40,    stun:0.58, cha:6,  evo:'高等狐狸', sk:[{ n:'狐狸火箭', mp:6, kind:'magic', d:[1,15], ele:'fire' }] },
    '暴走兔':   { kind:'mag',  tier:0, lv0:5, hp0:20, mp0:30, hpUp:[3,8],  mpUp:[2,5], hpReg:2, mpReg:5, apm:51.43, capm:51.43, stun:0.58, cha:6,  evo:'高等暴走兔', sk:[{ n:'暴走兔冰錐', mp:8, kind:'magic', d:[1,20], ele:'water' }] },
    '哈士奇':   { kind:'phys', tier:0, lv0:5, hp0:50, mp0:5,  hpUp:[8,12], mpUp:[1,2], hpReg:5, mpReg:0, apm:55.38, capm:0,     stun:0.5,  cha:6,  evo:'高等哈士奇', sk:[] },
    '柯利':     { kind:'phys', tier:0, lv0:5, hp0:40, mp0:5,  hpUp:[8,11], mpUp:[3,4], hpReg:5, mpReg:0, apm:60,    capm:0,     stun:0.54, cha:6,  evo:'高等柯利', sk:[] },
    '虎男':     { kind:'spec', tier:0, lv0:5, hp0:40, mp0:5,  hpUp:[8,14], mpUp:[3,5], hpReg:5, mpReg:0, apm:72,    capm:0,     stun:0.58, cha:12, evo:'真‧虎男', sk:[] },
    '高麗幼犬': { kind:'spec', tier:0, lv0:5, hp0:30, mp0:30, hpUp:[3,6],  mpUp:[3,5], hpReg:5, mpReg:5, apm:45,    capm:51.43, stun:0.58, cha:12, evo:'高麗犬', sk:[{ n:'瘋狂咬擊', mp:10, kind:'magic', d:[2,10], ele:'none' }] },
    '袋鼠':     { kind:'spec', tier:0, lv0:5, hp0:25, mp0:5,  hpUp:[3,8],  mpUp:[2,5], hpReg:2, mpReg:3, apm:90,    capm:72,    stun:0.58, cha:12, drPierce:0.35, evo:'高等袋鼠', sk:[{ n:'袋鼠火焰拳', mp:6, kind:'magic', d:[1,18], ele:'fire' }] },
    '熊貓':     { kind:'spec', tier:0, lv0:5, hp0:30, mp0:10, hpUp:[8,11], mpUp:[2,4], hpReg:2, mpReg:3, apm:60,    capm:68.57, stun:0.58, cha:12, evo:'高等熊貓', sk:[{ n:'熊貓爆擊', mp:9, kind:'extra', crit:true, add:0 }] },
    '猴子':     { kind:'spec', tier:0, lv0:5, hp0:30, mp0:30, hpUp:[3,8],  mpUp:[3,5], hpReg:2, mpReg:3, apm:51.43, capm:51.43, stun:0.58, cha:12, evo:'超級猴子', sk:[{ n:'猴子氣功波', mp:8, kind:'magic', d:[1,20], ele:'none' }] },
    '頑皮龍':   { kind:'spec', tier:0, lv0:5, hp0:40, mp0:10, hpUp:[8,14], mpUp:[3,5], hpReg:5, mpReg:8, apm:53.33, capm:48,    stun:0.58, cha:15, evo:'高等頑皮龍', sk:[{ n:'頑皮龍火球', mp:10, kind:'magic', d:[2,10], ele:'fire' }] },
    '淘氣龍':   { kind:'spec', tier:0, lv0:5, hp0:40, mp0:10, hpUp:[8,14], mpUp:[3,5], hpReg:8, mpReg:1, apm:60,    capm:0,     stun:0.58, cha:15, evo:'高等淘氣龍', sk:[] },
    // ===== 高等（一般型態＋進化果實進化取得·Lv1 起·最終型態不可再進化）=====
    '高等牧羊犬':   { kind:'phys', tier:1, lv0:1, hpUp:[5,8],   mpUp:[1,2], hpReg:8,  mpReg:0,  apm:55.38, capm:0,     stun:0.58, cha:6,  evo:null, sk:[] },
    '高等貓':       { kind:'mag',  tier:1, lv0:1, hpUp:[3,6],   mpUp:[3,5], hpReg:2,  mpReg:10, apm:57.6,  capm:51.43, stun:0.58, cha:6,  evo:null, sk:[{ n:'高等貓寒冷戰慄', mp:10, kind:'magic', d:[2,10], ele:'none', drainHalf:true }] },
    '高等熊':       { kind:'phys', tier:1, lv0:1, hpUp:[10,15], mpUp:[1,2], hpReg:10, mpReg:0,  apm:45,    capm:0,     stun:0.58, cha:6,  evo:null, sk:[] },
    '高等杜賓狗':   { kind:'phys', tier:1, lv0:1, hpUp:[4,6],   mpUp:[1,2], hpReg:8,  mpReg:0,  apm:65.45, capm:0,     stun:0.58, cha:6,  evo:null, sk:[] },
    '高等狼':       { kind:'phys', tier:1, lv0:1, hpUp:[3,9],   mpUp:[1,2], hpReg:8,  mpReg:0,  apm:65.45, capm:0,     stun:0.58, cha:6,  evo:null, sk:[] },
    '高等浣熊':     { kind:'mag',  tier:1, lv0:1, hpUp:[5,9],   mpUp:[3,5], hpReg:2,  mpReg:5,  apm:65.45, capm:80,    stun:0.58, cha:6,  evo:null, sk:[{ n:'高等浣熊弱化術', mp:5, kind:'debuff', debuff:'weaken', w:30, acc:60 }, { n:'高等浣熊疾病術', mp:10, kind:'debuff', debuff:'disease', w:30, acc:55 }, { n:'高等浣熊緩速術', mp:15, kind:'debuff', debuff:'slow', w:50, acc:50 }] },
    '高等小獵犬':   { kind:'mag',  tier:1, lv0:1, hpUp:[4,8],   mpUp:[2,4], hpReg:2,  mpReg:8,  apm:60,    capm:53.33, stun:0.58, cha:6,  evo:null, sk:[{ n:'高等小獵犬地獄之牙', mp:10, kind:'magic', d:[2,15], ele:'earth' }] },
    '高等聖伯納犬': { kind:'mag',  tier:1, lv0:1, hpUp:[6,10],  mpUp:[2,4], hpReg:2,  mpReg:8,  apm:55.38, capm:48,    stun:0.58, cha:6,  evo:null, sk:[{ n:'高等聖伯納犬風刃', mp:10, kind:'magic', d:[2,15], ele:'wind' }] },
    '高等狐狸':     { kind:'mag',  tier:1, lv0:1, hpUp:[3,9],   mpUp:[2,4], hpReg:2,  mpReg:8,  apm:49.66, capm:48,    stun:0.5,  cha:6,  evo:null, sk:[{ n:'高等狐狸火箭', mp:10, kind:'magic', d:[2,15], ele:'fire' }] },
    '高等暴走兔':   { kind:'mag',  tier:1, lv0:1, hpUp:[3,8],   mpUp:[2,5], hpReg:2,  mpReg:10, apm:55.38, capm:51.43, stun:0.58, cha:6,  evo:null, sk:[{ n:'高等暴走兔冰錐', mp:15, kind:'magic', d:[2,20], ele:'water' }] },
    '高等哈士奇':   { kind:'phys', tier:1, lv0:1, hpUp:[10,15], mpUp:[1,2], hpReg:8,  mpReg:0,  apm:55.38, capm:0,     stun:0.5,  cha:6,  evo:null, sk:[] },
    '高等柯利':     { kind:'phys', tier:1, lv0:1, hpUp:[10,14], mpUp:[3,4], hpReg:8,  mpReg:0,  apm:60,    capm:0,     stun:0.54, cha:6,  evo:null, sk:[] },
    '真‧虎男':     { kind:'spec', tier:1, lv0:1, hpUp:[10,15], mpUp:[3,5], hpReg:5,  mpReg:5,  apm:72,    capm:60,    stun:0.58, cha:12, evo:null, sk:[{ n:'爆裂勾爪', mp:5, kind:'extra', add:5 }] },
    '高麗犬':       { kind:'spec', tier:1, lv0:1, hpUp:[3,8],   mpUp:[3,5], hpReg:2,  mpReg:10, apm:60,    capm:51.43, stun:0.58, cha:12, evo:null, sk:[{ n:'瘋狂咬擊', mp:10, kind:'magic', d:[2,10], ele:'none', w:50 }, { n:'汪汪咬擊', mp:10, kind:'magic', d:[3,10], ele:'none', w:50 }] },
    '高等袋鼠':     { kind:'spec', tier:1, lv0:1, hpUp:[3,8],   mpUp:[3,5], hpReg:2,  mpReg:5,  apm:90,    capm:72,    stun:0.58, cha:12, drPierce:0.35, evo:null, sk:[{ n:'高等袋鼠火焰拳', mp:12, kind:'magic', d:[2,18], ele:'fire' }] },
    '高等熊貓':     { kind:'spec', tier:1, lv0:1, hpUp:[8,16],  mpUp:[2,4], hpReg:2,  mpReg:5,  apm:60,    capm:68.57, stun:0.58, cha:12, evo:null, sk:[{ n:'高等熊貓爆擊', mp:18, kind:'extra', crit:true, add:10 }] },
    '超級猴子':     { kind:'spec', tier:1, lv0:1, hpUp:[3,8],   mpUp:[3,5], hpReg:2,  mpReg:5,  apm:51.43, capm:51.43, stun:0.58, cha:12, evo:null, sk:[{ n:'超級猴子氣功波', mp:15, kind:'magic', d:[2,20], ele:'none' }] },
    '高等頑皮龍':   { kind:'spec', tier:1, lv0:1, hpUp:[10,15], mpUp:[3,5], hpReg:5,  mpReg:8,  apm:55.38, capm:51.43, stun:0.58, cha:15, evo:null, sk:[{ n:'頑皮龍火球', mp:10, kind:'magic', d:[2,10], ele:'fire', w:50 }, { n:'頑皮龍大火球', mp:12, kind:'magic', d:[2,12], ele:'fire', w:50 }] },
    '高等淘氣龍':   { kind:'spec', tier:1, lv0:1, hpUp:[10,15], mpUp:[3,5], hpReg:8,  mpReg:1,  apm:65.45, capm:0,     stun:0.58, cha:15, evo:null, sk:[] },
    // ===== 黃金龍（v3.2.63：任一「一般型態」＋勝利果實可直接進化取得·與高等型態並列·Lv1 起·最終型態不可再進化）=====
    '黃金龍':       { kind:'spec', tier:2, lv0:1, hpUp:[8,12],  mpUp:[2,4], hpReg:8,  mpReg:4,  apm:72,    capm:45,    stun:0.58, cha:20, evo:null, sk:[{ n:'火焰噴射', mp:15, kind:'magic', d:[1,15], ele:'fire', aoe:true, w:50 }, { n:'火球', mp:10, kind:'magic', d:[2,10], ele:'fire', w:50 }] },
    // ===== 蜥蜴四型態（🦎 v3.6.43 用戶規格·獲得管道待補·tier0＋evo:null＝無法進化·魅力 15 比照龍系〔規格未給·暫定〕）=====
    '厄運蜥蜴': { kind:'spec', tier:0, goldenAtk:1.60, goldenMagic:1.60, lv0:5, hp0:150, mp0:40, hpUp:[12,24], mpUp:[5,8],  hpReg:15, mpReg:10, apm:72, capm:48, stun:0.58, cha:15, evo:null, sk:[{ n:'火焰噴射', mp:20, kind:'magic', d:[1,25], ele:'fire',  aoe:true, w:90 }, { n:'炎爪', mp:0, kind:'dot', dot:'burn',   dps:10, dur:6, w:10 }] },
    '災厄蜥蜴': { kind:'spec', tier:0, goldenAtk:2.05, goldenMagic:2.05, acMod:-5, mrBonus:20, lv0:5, hp0:160, mp0:20, hpUp:[12,26], mpUp:[5,7],  hpReg:15, mpReg:10, apm:60, capm:48, stun:0.50, cha:15, evo:null, sk:[{ n:'大地震裂', mp:20, kind:'magic', d:[1,25], ele:'earth', aoe:true, w:90 }, { n:'堅硬', mp:0, kind:'selfbuff', dr:10, dur:6, w:10 }] },
    '破滅蜥蜴': { kind:'spec', tier:0, goldenAtk:2.10, goldenMagic:1.05, drPierce:0.35, lv0:5, hp0:150, mp0:40, hpUp:[12,22], mpUp:[5,7],  hpReg:15, mpReg:10, apm:90, capm:48, stun:0.58, cha:15, evo:null, sk:[{ n:'龍捲風', mp:20, kind:'magic', d:[1,25], ele:'wind',  aoe:true, w:90 }, { n:'風刃', mp:0, kind:'dot', dot:'bleed',  dps:10, dur:6, w:10 }] },
    '詛咒蜥蜴': { kind:'spec', tier:0, goldenAtk:1.35, goldenMagic:2.60, lv0:5, hp0:120, mp0:60, hpUp:[10,20], mpUp:[6,10], hpReg:10, mpReg:15, apm:60, capm:48, stun:0.58, cha:15, evo:null, sk:[{ n:'冰雪暴', mp:20, kind:'magic', d:[1,25], ele:'water', aoe:true, freezeCh:3, w:90 }, { n:'汙濁', mp:0, kind:'dot', dot:'poison', dps:10, dur:6, w:10 }] }
};
const PET_KIND_WEIGHT = { phys: 4, spec: 3, mag: 2 };   // 受擊權重（怪物一般攻擊選目標）
const PET_KIND_LABEL = { phys: '物理型', spec: '特殊型', mag: '魔法型' };
const PET_STORAGE_MAX = 32;   // 寵物保管上限（含出戰中·v3.6.37 用戶調整 20→32；v3.7.7 保管人＝亞丁 包武／古魯丁 奧斯丁·同一個桶）
const PET_CARRY_MAX = 4;      // 同時出戰上限

// 誘捕 buff（player.buffs 鍵·值=秒）→ 可捕捉怪（key=怪物名精確比對·value=獲得的寵物型態）
const PET_LURES = {
    lure_general:  { n: '一般誘捕',     mobs: { '狼':'狼', '牧羊犬':'牧羊犬', '杜賓狗':'杜賓狗', '哈士奇':'哈士奇', '熊':'熊', '貓':'貓', '浣熊':'浣熊', '聖伯納犬':'聖伯納犬', '狐狸':'狐狸', '小獵犬':'小獵犬', '柯利':'柯利' } },   // 🐾 v3.2.32 高麗幼犬改為專屬誘捕（lure_koreadog）獨佔，不吃一般誘捕
    lure_rabbit:   { n: '暴走兔誘捕',   mobs: { '暴走兔':'暴走兔' } },
    lure_tiger:    { n: '虎男誘捕',     mobs: { '老虎':'虎男' } },
    lure_kangaroo: { n: '袋鼠誘捕',     mobs: { '袋鼠':'袋鼠' } },
    lure_panda:    { n: '熊貓誘捕',     mobs: { '熊貓':'熊貓' } },
    lure_monkey:   { n: '猴子誘捕',     mobs: { '猴子':'猴子' } },
    lure_koreadog: { n: '高麗幼犬誘捕', mobs: { '高麗幼犬':'高麗幼犬' } }
};

// ---------- 二、能力成長模型（依攻速/類型/階級平衡·各等級推導）----------
// 設計：三型 DPS 對齊（攻速快→單發低），物理重普攻與防禦、魔法重技能與 MR、特殊居中。
//   一般攻擊傷害 = 1D(dice)+flat；dice/flat 依 (類型基準+等級成長)×攻速正規化×階級乘數
//   技能傷害加成 skillFlat（平加進技能骰）；AC 越低越好（與玩家同向）；DR/ER/MR 各型速率不同
const _PET_G = {
    phys: { atk0:3, atkG:0.52, hit0:6, hitG:0.55, acDiv:2,   acTier:3, drDiv:10, drTier:2, erDiv:5, erCap:25, mr0:10, mrG:0.35, mrTier:4, mrCap:70,  skillG:0.55 },
    spec: { atk0:2, atkG:0.40, hit0:5, hitG:0.50, acDiv:2.7, acTier:2, drDiv:14, drTier:1, erDiv:6, erCap:20, mr0:18, mrG:0.55, mrTier:6, mrCap:95,  skillG:0.65 },
    mag:  { atk0:1, atkG:0.27, hit0:3, hitG:0.42, acDiv:3.4, acTier:1, drDiv:20, drTier:0, erDiv:8, erCap:15, mr0:25, mrG:0.75, mrTier:8, mrCap:120, skillG:0.85 }
};
// 兩隻同等寵物的持續輸出以接近一名同等玩家為目標；裝備、魅力與遺物仍作為額外養成收益。
const PET_DMG_TUNE = { basic: 1.20, skill: 1.10 };
const PET_TIER_DMG_MULT = [1.14, 1.46, 1.00];   // 🐾 與下方生存力曲線合併後：一般平均總傷約+20%、高等約+50%；黃金龍維持原值
const PET_HIT_TUNE = 5;                         // 🐾 全寵物命中補強（仍受等級差、目標 AC 與骰 1 必失影響）
function _petClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function _petPowerCurve(def, lv) {
    let g = _PET_G[def.kind], t = def.tier || 0;
    let speedMul = _petClamp(Math.sqrt(60 / Math.max(1, def.apm)), 0.80, 1.25);
    let hpAvg = ((def.hpUp && def.hpUp[0]) || 0) / 2 + ((def.hpUp && def.hpUp[1]) || 0) / 2;
    let oldDurableMul = hpAvg <= 5 ? 1.05 : (hpAvg <= 8 ? 1 : (hpAvg <= 11 ? 0.92 : 0.85));
    let durableMul = t === 2 ? oldDurableMul : 1;
    let skills = def.sk || [];
    let hasMagic = skills.some(s => s.kind === 'magic');
    let hasExtra = skills.some(s => s.kind === 'extra');
    let hasDebuff = skills.some(s => s.kind === 'debuff');
    let skillMul = !skills.length ? 1.08 : (hasMagic ? 0.72 : (hasExtra ? 0.85 : (hasDebuff ? 0.98 : 1)));
    let tierAtk = [1, 1.18, 1.35][t] || 1;
    let castMul = def.capm > 0 ? _petClamp(Math.sqrt(50 / def.capm), 0.80, 1.25) : 1;
    let skillTier = [1, 1.15, 1.25][t] || 1;
    return { avgAtk: Math.max(1, (g.atk0 + lv * g.atkG) * speedMul * durableMul * skillMul * tierAtk * PET_DMG_TUNE.basic),
        skillFlat: Math.floor(lv * g.skillG * castMul * skillTier * PET_DMG_TUNE.skill) };
}
function petDerive(p) {
    let def = PET_BOOK[p.form]; if (!def) return null;
    let g = _PET_G[def.kind], lv = p.lv || 1, t = def.tier || 0;
    let hpAvg = ((def.hpUp && def.hpUp[0]) || 0) / 2 + ((def.hpUp && def.hpUp[1]) || 0) / 2;
    // 生存力換輸出：低血成長寵物明顯偏攻擊，高血成長寵物偏坦；一般／高等的普攻與技能都套用。
    const survivalDmgMult = hpAvg <= 5 ? 1.25 : (hpAvg <= 8 ? 1.08 : (hpAvg <= 11 ? 0.90 : 0.75));
    let hpAc = hpAvg > 11 ? -2 : (hpAvg > 8 ? -1 : (hpAvg <= 5 ? 1 : 0));
    let hpDr = hpAvg > 11 ? 2 : (hpAvg > 8 ? 1 : 0);
    let power = _petPowerCurve(def, lv);
    if ((def.goldenAtk || def.goldenMagic) && PET_BOOK['黃金龍']) {
        let golden = _petPowerCurve(PET_BOOK['黃金龍'], lv);
        if (def.goldenAtk) power.avgAtk = Math.max(power.avgAtk, golden.avgAtk);
        if (def.goldenMagic) power.skillFlat = Math.max(power.skillFlat, golden.skillFlat);
    }
    let avgAtk = power.avgAtk;
    let flat = Math.floor(avgAtk * 0.35), dice = Math.max(1, Math.ceil(avgAtk * 1.30));
    let speedHit = _petClamp(Math.round((60 - def.apm) / 12), -3, 3);
    let elite = t === 2 ? { hit:2, ac:-4, dr:2, mr:10 } : { hit:0, ac:0, dr:0, mr:0 };
    let mr = g.mr0 + Math.floor(lv * g.mrG) + t * g.mrTier + elite.mr;
    // 🛡️ v3.2.37 寵物個別防具（p.eq.arm）：petAc(+強化每+1再-1)→AC、petMr→MR、petInt→技能傷害+1/點、petWis→MP上限+5·MP恢復+1/點
    let _ga = (p.eq && p.eq.arm) ? DB.items[p.eq.arm.id] : null;
    let _gaEn = _ga ? capEn(p.eq.arm.en || 0, _ga) : 0;
    let _gAc = _ga ? (_ga.petAc || 0) + _gaEn : 0;
    let _gInt = _ga ? (_ga.petInt || 0) : 0;
    let _gWis = _ga ? (_ga.petWis || 0) : 0;
    return {
        kind: def.kind, tier: t,
        dice: dice,
        flat: flat,
        attackMult: Math.max(1, def.goldenAtk || 1),
        magicMult: Math.max(1, def.goldenMagic || 1),
        drPierce: Math.max(0, Math.min(0.95, def.drPierce || 0)),
        damageMult: ((def.goldenAtk || def.goldenMagic) ? 1 : (t === 2 ? 1 : (PET_TIER_DMG_MULT[t] || 1) * survivalDmgMult)) * petMasteryDmgMult(),   // 🦎 四蜥蜴以黃金龍為基準，普攻／魔法各自套用角色倍率；👑 夥伴精通 ×1.5
        hit: Math.floor((g.hit0 + Math.floor(lv * g.hitG) + speedHit + t * 3 + elite.hit + PET_HIT_TUNE) * petMasteryHitMult()),   // 👑 夥伴精通 ×1.5
        skillFlat: power.skillFlat + _gInt + (typeof petAuraSum === 'function' ? petAuraSum('petMdmgAll') : 0),   // 🏺 v3.7.20 蜥蜴領主的王冠 +3／珍藏的巨大胡蘿蔔 +1：寵物魔法（技能）傷害光環
        ac: 10 - Math.floor(lv / g.acDiv) - t * g.acTier + hpAc + elite.ac + (def.acMod || 0) - _gAc,
        dr: Math.floor(lv / g.drDiv) + t * g.drTier + hpDr + elite.dr,
        er: Math.min(g.erCap, Math.floor(lv / g.erDiv)),                // ER
        mr: Math.min(t === 2 ? 110 : g.mrCap, mr + (def.mrBonus || 0)) + (_ga ? (_ga.petMr || 0) : 0),
        mmpBonus: _gWis * 5,                                            // 精神：MP 上限 +5/點（regen/施放/顯示用有效上限）
        mpRegBonus: _gWis + (typeof petAuraSum === 'function' ? petAuraSum('petMpRAll') : 0),   // 精神：MP 恢復 +1/點；🏺 v3.7.20 蜥蜴領主的王冠：全寵物 MP 自然恢復 +5
        atkItv: Math.max(3, Math.round(600 / def.apm)),                 // 攻擊間隔（ticks·600=每分鐘tick數）
        castItv: def.capm > 0 ? Math.max(5, Math.round(600 / def.capm)) : 0,
        stunTicks: Math.round((def.stun || 0.58) * 10)
    };
}
function petExpReq(lv) { return Math.max(1, Math.floor(getExpReq(lv) / 10)); }   // 升級需求＝玩家的 1/10（v3.2.71 用戶調整·原 1/4）
const PET_EXP_REQ_VERSION = 3;
function petMigrateExpReqV3(p) {   // Lv70+ 玩家需求改版時，寵物同樣保留當級進度百分比
    if (!p || (p.expReqV || 0) >= PET_EXP_REQ_VERSION) return false;
    let lv = Math.max(1, Math.min(100, Math.floor(p.lv || 1)));
    if (lv >= 100) p.exp = 0;
    else if (lv >= 70) {
        let oldReq = Math.max(1, Math.floor(_expReqClassicV2(lv) / 10));
        let newReq = petExpReq(lv);
        p.exp = Math.min(Math.floor(Math.max(0, p.exp || 0) / oldReq * newReq), newReq - 1);
    }
    p.expReqV = PET_EXP_REQ_VERSION;
    return true;
}
function petCharmCombatBonus() {
    // 🐾 v3.2.24 每一隻獨立計算：移除 /sqrt(出戰隻數) 稀釋——每隻寵物都拿完整魅力加成（隻數多寡不影響個體）
    // 👑 v3.4.28 魅力係數固定 0.10（原「夥伴精通→0.12」已移除·精通效果見下）
    let cha = Math.max(0, (player && player.d && player.d.cha) || 0);
    let v = Math.floor(cha * 0.10);
    return { dmg: v, hit: v };
}
// 👑 v3.4.36 王族「夥伴精通」(k_royal_pet)（用戶指定）：出戰寵物 傷害 ×1.5、命中 ×1.5、受到傷害 −50%（v3.4.29 為 −30%）。
//   HP 不再有加成（v3.4.28 的「HP 上限 ×2」已取消·petEffMaxHp 一併移除→各處回頭直接讀存檔值 p.mhp）。
function petMasteryOn()        { return (typeof hasMastery === 'function') && hasMastery('k_royal_pet'); }
function petMasteryDmgMult()   { return petMasteryOn() ? 1.5 : 1; }   // 折進 petDerive 的 damageMult＝普攻／傷害技能／extra 技三路徑一次覆蓋
function petMasteryHitMult()   { return petMasteryOn() ? 1.5 : 1; }   // 折進 petDerive 的 hit＝命中判定（petAttackOnce）與保管清單顯示一次覆蓋
function petMasteryTakenMult() { return petMasteryOn() ? 0.5 : 1; }   // 受到傷害 −50%：掛怪物普攻／怪物魔法兩處（與 teamDmgReduceMult 同列；DoT 依既有設計為固定真傷·不受任何減免）
// 🏺 遺物 馴獸師手做寵物專用盔甲：該寵物裝備的護甲（p.eq.arm）帶 petDmgReduce → 受到傷害 ×(1−petDmgReduce)。與 petMasteryTakenMult 同列乘算。
function petArmorDmgReduceMult(p) { let a = p && p.eq && p.eq.arm; let d = a ? DB.items[a.id] : null; return (d && d.petDmgReduce) ? Math.max(0, 1 - d.petDmgReduce) : 1; }
// 🏺 v3.7.20 蜥蜴領主的王冠等「全寵物光環」欄位加總：掃玩家＋未倒地傭兵全部裝備欄（範圍與 petGearBonus 的 petDmgAll 一致）
function petAuraSum(field) {
    let s = 0;
    let _scan = function (c) { if (!c || !c.eq) return; for (let k in c.eq) { let e = c.eq[k]; if (!e) continue; let d = DB.items[e.id]; if (d && d[field]) s += d[field]; } };
    if (typeof player !== 'undefined' && player) { _scan(player); (player.allies || []).forEach(a => { if (a && !a._downed) _scan(a); }); }
    return s;
}
// 🏺 v3.7.20 寵物有效 HP 上限＝存檔 mhp ＋ 光環加成（petHpAll·蜥蜴領主的王冠 +100）。恢復/治癒/顯示皆以此為上限；不改寫存檔 p.mhp。
function petMhpEff(p) { return Math.max(1, (p && p.mhp || 1) + petAuraSum('petHpAll')); }
function petRandomPhysicalDr(p, d) {
    let k = (d && d.kind) || ((p && PET_BOOK[p.form]) || {}).kind || 'mag';
    let div = k === 'phys' ? 3 : (k === 'spec' ? 4 : 5);
    let teamAc = (typeof teamAcBonus === 'function') ? teamAcBonus(p, true) : 0;
    let max = Math.floor(Math.max(0, 10 - ((d && d.ac) || 0) + teamAc) / div);
    let min = Math.floor(max / 3);
    return min + Math.floor(Math.random() * (max - min + 1));
}
// 🎬 v3.2.73 寵物/召喚物 sprite 動作動畫單一設定點：背景補跑(state.ff)期間不設 _animAct→切分頁回來不會全隊寵/召同步爆播（比照 v3.2.72 _mobAnimTrigger 對怪物的處理）。
//   死亡不需另播——渲染層 _petAnimApply 對 _downed 者以 _animAct.t||0 推算→無 _animAct 時直接 hold 死亡末幀（顯示倒地）。共用於 js/22（寵物）與 js/23（召喚物·同欄位協定）。
function _petAnimAct(o, k, faceUid) {
    if (!o) return;
    if (typeof state !== 'undefined' && state.ff) return;   // 補跑中：純視覺·不設動畫（傷害/狀態邏輯不經此·照跑）
    o._animAct = { k: k, t: Date.now() };
    if (faceUid !== undefined) o._faceMobUid = faceUid;
}

// ---------- 三、寵物保管（同模式共通·localStorage 共用桶·_lz+SIG1）----------
const PET_ROSTER_KEY = 'fb5_pet_roster';
let _petRoster = [];            // 執行期名冊（唯一真相鏡像）
let _petRosterKey = null;       // 已載入的桶 key（切換模式/角色時重載）
let _petRosterDirty = false;
let _petReleasedUids = {};      // 本分頁放生過的 uid（合併時防其他分頁殘影復活）
// 🪣 v3.5.88 本地新增但尚未確認寫進共用桶的 uid（petStoreAdd 登記·寫入成功即清空）。
//    用途：petRosterSave 合併後若超過 PET_STORAGE_MAX，只有「這批」才可被回滾——
//    共用桶已持有的條目永遠不得因上限被丟棄（那正是 v3.5.87 修掉的資料遺失 bug）。
let _petPendingAddUids = {};
function _petBucketKey() { return PET_ROSTER_KEY + (typeof modeSuffix === 'function' ? modeSuffix(!!(player && player.classicMode), false) : ''); }
// 🕐 共用桶欄位版本戳（裝備 eqV／出戰 outV）：時間戳加入分頁亂數與本地單調遞增，
//    避免兩個角色同時掛網、同一毫秒存檔時產生相同版本戳而各自保留不同出戰歸屬。
let _petStampLast = 0;
let _petStampSalt = Math.floor(Math.random() * 256);
try { if (typeof crypto !== 'undefined' && crypto.getRandomValues) { let _ps = new Uint16Array(1); crypto.getRandomValues(_ps); _petStampSalt = _ps[0] % 256; } } catch (e) {}
function _petNowStamp() {
    let _slotBits = Math.max(0, Math.min(3, (Number(currentSlot) || 1) - 1));
    let n = Date.now() * 1024 + _petStampSalt * 4 + _slotBits;   // 不同存檔格同毫秒也不撞戳，且長期維持 Number 安全整數
    if (n <= _petStampLast) n = _petStampLast + 1;
    _petStampLast = n;
    return n;
}
// 出戰歸屬必須用「角色唯一識別」，不能只用存檔格。
// 不同帳號在同一瀏覽器內都可能使用第 1 格；若只存 outSlot=1，低魅力角色會把王族的寵物當成自己的並自動收回。
// enSeed 於創角時隨機產生並永久存檔，可作為跨分頁穩定的角色 ID。
function _petOwnerKeyFor(p) {
    if (!p || !p.cls || !p.enSeed) return '';
    return 'char:' + String(p.enSeed);
}
function _petCurrentOwnerKey() { return _petOwnerKeyFor(typeof player !== 'undefined' ? player : null); }
function _petOutStateKey(p) {
    if (!p) return '';
    if (p.outOwner) return String(p.outOwner);
    return (p.outSlot != null) ? ('legacy-slot:' + String(p.outSlot)) : '';
}
function _petRosterRead(key) {
    try {
        let raw = _lzGet(key);
        if (raw == null) return [];
        let un = _saveUnwrap(raw);
        if (!un.ok) { console.warn('petRoster 簽章不符，拒讀'); return null; }   // 毀損：回 null → 拒寫防洗掉
        let arr = JSON.parse(un.payload);
        return Array.isArray(arr) ? arr : [];
    } catch (e) { console.warn('petRoster 解析失敗', e); return null; }
}
function petRoster() {
    if (typeof player === 'undefined' || !player) return _petRoster;
    let key = _petBucketKey();
    if (_petRosterKey !== key) {
        let arr = _petRosterRead(key);
        if (arr === null) { try { let bak = _petRosterRead(key + '_bak'); if (bak !== null) arr = bak; } catch (e) {} }
        _petRoster = (arr || []).filter(p => p && PET_BOOK[p.form]);
        _petRoster.forEach(p => {
            if (petMigrateExpReqV3(p)) _petRosterDirty = true;
            // 🩸 v3.5.94 夾擠只套用在「非倒地」的寵物：倒地寵桶內存的就是 hp:0，無條件夾成 1 會讓牠在
            //    重新整理／換角後免費原地復活（滿血、不耗復活卷軸、不等冷卻、異常全清）。配合 _petPersist
            //    now 序列化 _downed/_reviveCd，重載後 _downed 仍在 → 維持倒地，需照規則復活。
            if ((p.hp || 0) <= 0 && !p._downed) p.hp = 1;
            p.locked = !!p.locked;
            if (p.eq) {   // 🦴 v3.2.39 稽核修：載入端容錯——物品已不存在或缺 id 的裝備直接剔除
                for (let k of ['wpn', 'arm']) { let g = p.eq[k]; if (!g || !g.id || !DB.items[g.id]) delete p.eq[k]; }
                if (!p.eq.wpn && !p.eq.arm) delete p.eq;
            }
            // 舊版只用 out/outSlot 記格號，無法分辨「不同帳號的同一格」。
            // 升級時一律安全返回保管一次；之後領出會寫入 outOwner，不再跨帳號互相收回。
            if (!p.outOwner && (p.outSlot != null || p.out)) {
                p.outOwner = null; p.outSlot = null; p.outV = _petNowStamp(); _petRosterDirty = true;
            }
            if (p.outOwner) p.outOwner = String(p.outOwner);
            if (p.outSlot != null) p.outSlot = String(p.outSlot); else p.outSlot = null;
            delete p.out;
            p.eqV = p.eqV || 0; p.outV = p.outV || 0;   // 🕐 版本戳（舊桶無→0；首次變更才蓋章）
        });
        _petRosterKey = key;
        _petEnforceCarry();
    }
    return _petRoster;
}
// 🐾 共用桶合併（純記憶體·不寫入）：把桶陣列 cur 併入本地 _petRoster——外來新 uid 併入、放生墓碑濾除、
//   進度(form/lv/exp)取領先、裝備(eq)/出戰(outSlot)依版本戳(eqV/outV)「最後變更者勝」。回傳合併後的墓碑物件（供 petRosterSave 持久化；storage 事件唯讀路徑忽略）。
// 🩸 v3.5.96 倒地狀態的「採用桶值」單一真相（_petMergeFromBucket 內兩個掛點共用）。
//   ⚠️ 刻意不寫成 `if (f._downed !== undefined)` 這種存在性守衛：_petPersist 以「缺欄位＝未倒地」編碼
//   （見該函式），缺欄時必須**顯式清除**本地的 _downed／_reviveCd，否則「已復活」這件事永遠傳不到其他分頁。
//   ⚠️ 日後新增任何「需要持久化的寵物執行期欄位」，這裡與 _petPersist 要一起加，否則多分頁會靜默洗掉它。
function _petAdoptBucketDownState(p, f) {
    if (!p || !f) return;
    if (f._downed) { p._downed = 1; p._reviveCd = Number(f._reviveCd) || 0; }
    else { delete p._downed; p._reviveCd = 0; }
}
function _petMergeFromBucket(cur, key) {
    // 🪦 放生墓碑：其他分頁放生的寵物不得被本地舊快照寫回復活
    let tombs = _petTombsRead(key);
    Object.keys(_petReleasedUids).forEach(u => tombs[u] = 1);
    _petRoster = _petRoster.filter(p => !tombs[p.uid]);
    cur.forEach(p => { if (p) petMigrateExpReqV3(p); });   // 其他分頁仍是舊刻度時，先轉換再比較進度
    let mine = {}; _petRoster.forEach(p => mine[p.uid] = true);
    let curBy = {}; cur.forEach(p => { if (p && p.uid) curBy[p.uid] = p; });
    // 🪣 v3.5.87 外來 uid 無條件併入：共用桶持有的條目不得因本地上限截斷而被寫回時刪除（否則 petRosterSave 會把截斷後的 roster
    //    覆寫回桶＝永久刪掉別分頁/別角色的寵物）；上限只擋本地新增（petStoreAdd／孵化／誘捕入口各自有滿量檢查）。
    cur.forEach(p => { if (p && p.uid && !mine[p.uid] && !tombs[p.uid] && PET_BOOK[p.form]) _petRoster.push(p); });   // 其他角色/分頁新捕獲併入
    _petRoster.forEach(p => {
        let f = curBy[p.uid];
        if (!f || f === p) return;
        // 📈 進度：form 感知（v3.2.68）——進化會 Lv 重置＋HP/MP 減半，桶內進化前副本不得因等級高而被判「領先」吃回。
        //   form 不同＝一邊進化過：桶內 tier 較高→採用其 form＋進度；否則以本地為準。form 相同→等級/經驗取領先。
        if (f.form !== p.form) {
            let ft = (PET_BOOK[f.form] && PET_BOOK[f.form].tier) || 0, pt = (PET_BOOK[p.form] && PET_BOOK[p.form].tier) || 0;
            if (ft > pt && PET_BOOK[f.form]) {
                p.form = f.form; p.lv = f.lv || 1; p.exp = f.exp || 0; p.expReqV = f.expReqV || PET_EXP_REQ_VERSION;
                p.mhp = f.mhp || p.mhp; p.mmp = (f.mmp != null ? f.mmp : p.mmp);
                p.hp = Math.min(p.hp, p.mhp); p.mp = Math.min(p.mp, p.mmp);
            }
        } else if ((f.lv || 1) > (p.lv || 1) || ((f.lv || 1) === (p.lv || 1) && (f.exp || 0) > (p.exp || 0))) {
            p.lv = f.lv; p.exp = f.exp || 0; p.expReqV = f.expReqV || PET_EXP_REQ_VERSION;
            if ((f.mhp || 0) > (p.mhp || 0)) p.mhp = f.mhp;
            if ((f.mmp || 0) > (p.mmp || 0)) p.mmp = f.mmp;
            p.hp = Math.min(p.hp, p.mhp); p.mp = Math.min(p.mp, p.mmp);
        }
        // 🕐 裝備：版本戳較新者勝（v3.3.16）——修「別角色剛換的裝備被過期分頁/自動存檔洗掉＝裝備蒸發」。
        if ((f.eqV || 0) > (p.eqV || 0)) {
            p.eqV = f.eqV || 0;
            if (f.eq && (f.eq.wpn || f.eq.arm)) p.eq = JSON.parse(JSON.stringify(f.eq)); else delete p.eq;
        }
        // 🕐 出戰：版本戳較新者勝；舊資料若同戳卻不同歸屬，依固定排序收斂，避免雙視窗反覆互洗。
        let _fOutV = Number(f.outV) || 0, _pOutV = Number(p.outV) || 0;
        if (_fOutV > _pOutV || (_fOutV === _pOutV && _petOutStateKey(f) > _petOutStateKey(p))) {
            p.outOwner = f.outOwner ? String(f.outOwner) : null;
            p.outSlot = (f.outSlot == null ? null : String(f.outSlot));
            p.outV = _fOutV;
            // 🩸 v3.5.96 出戰歸屬改變（換人／被收回保管）時，本地鏡像的 hp/倒地狀態已失去依據，一併採用桶值。
            //   ⚠️ 這一段不能省：上面剛把 p.outOwner 設成 null 的話，下面「狀態來源」區塊的第一個條件
            //   `_petOutStateKey(p)` 就是空字串 → 整段跳過 → 陳舊的 _downed:1 + hp:0 會留在鏡像上，
            //   而本分頁下次 saveGame 時 _petPersist 會把它們寫回共用桶，覆蓋掉對方角色「已復活」的寵物，
            //   且該寵已非出戰狀態、清除分支永遠碰不到＝救不回來。（此洞由 v3.5.95 讓鏡像開始帶 _downed 而產生。）
            _petAdoptBucketDownState(p, f);
            if (f.hp !== undefined) p.hp = f.hp;
        }
        // 其他角色出戰中的寵物，以共用桶為即時狀態來源；本角色不可用過期鏡像覆蓋其 HP/MP/等級。
        if (_petOutStateKey(p) && _petOutStateKey(p) !== _petCurrentOwnerKey() && _petOutStateKey(f) === _petOutStateKey(p) && _fOutV === (Number(p.outV) || 0)) {
            for (let k of ['form','lv','exp','expReqV','mhp','mmp','hp','mp','potPct','name','locked']) if (f[k] !== undefined) p[k] = f[k];
            // 🩸 v3.5.95 倒地狀態必須跟著 hp 一起搬（上面那行搬 hp 卻不搬 _downed → 多分頁可繞過 v3.5.94 的防免費復活）：
            //   分頁A 寵物倒地寫桶(hp:0,_downed:1) → 分頁B 合併只拿到 hp:0、_downed 仍 undefined → 分頁B 下次
            //   petRosterSave 時 _petPersist 的 `if (p._downed)` 為假 → 把 _downed 從共用桶抹掉、hp:0 留著 →
            //   分頁A 一重整就被 `!p._downed` 夾成 hp=1 ＝ 免費原地復活。
            _petAdoptBucketDownState(p, f);
        }
    });
    return tombs;
}
function petRosterSave() {   // merge-on-write：重讀桶→版本戳合併（進度領先／裝備·出戰最後變更者勝）→外來新 uid 併入＋寫前備份
    try {
        petRoster();
        let key = _petBucketKey();
        let cur = _petRosterRead(key);
        let bucketOk = (cur !== null);
        if (!bucketOk) { console.warn('petRoster 桶毀損，僅覆寫 _bak 之後仍以本地為準'); cur = []; }
        let tombs = _petMergeFromBucket(cur, key);
        // 🪣 v3.5.88 上限守衛（v3.5.87「外來 uid 無條件併入」的後半段）：本地鏡像過閘時是 19 隻，
        //    但別分頁在這中間也捕到一隻並先寫回桶 → 合併後變 21 隻並被寫回共用桶＝上限被永久突破。
        //    這裡在寫入前重算：超額時只回滾「本次本地新增、且桶裡還沒有」的那幾隻（由新到舊），
        //    回滾後直接 return false 讓上層交易整筆還原（誘捕狀態／頑皮幼龍蛋會退回，不會白白消耗）。
        //    ⚠️ 桶已持有的條目一律不動；桶讀取失敗（bucketOk=false）時不做任何截斷，避免誤刪。
        if (bucketOk && _petRoster.length > PET_STORAGE_MAX) {
            let inBucket = {}; cur.forEach(p => { if (p && p.uid) inBucket[p.uid] = 1; });
            let drop = {}, dropN = 0, names = [];
            for (let i = _petRoster.length - 1; i >= 0 && _petRoster.length - dropN > PET_STORAGE_MAX; i--) {
                let p = _petRoster[i];
                if (!p || !p.uid || !_petPendingAddUids[p.uid] || inBucket[p.uid]) continue;
                drop[p.uid] = 1; dropN++;
                try { names.push(petDisplayName(p)); } catch (e) { names.push(p.form); }
            }
            if (dropN) {
                _petRoster = _petRoster.filter(p => !(p && drop[p.uid]));
                Object.keys(drop).forEach(u => { delete _petPendingAddUids[u]; });
                logSys(`<span class="text-red-400">寵物保管已滿（上限 ${PET_STORAGE_MAX} 隻·其他角色／分頁剛剛存入），${names.join('、')} 本次取得已取消。</span>`);
                return false;
            }
            // 沒有可回滾的本地新增（超額全來自桶內既有條目·例如舊版遺留）→ 照原樣寫回，絕不刪桶內資料。
        }
        let json = JSON.stringify(_petRoster.map(_petPersist));
        let old = _lzGet(key); if (old != null && !_lzSet(key + '_bak', old)) return false;
        if (!_lzSet(key, _saveWrap(json))) return false;
        _petTombsWrite(key, tombs);
        _petPendingAddUids = {};   // 寫入成功＝本地每一筆都已進桶，待確認清單清空
        _petRosterDirty = false;
        return true;
    } catch (e) { console.warn('petRosterSave 失敗', e); return false; }
}
// 🔄 與共用桶同步：先把本地未存進度 flush 進桶→失效快取→從桶重載合併（拿到別角色最新裝備/出戰狀態）。
//   用於：切換角色（loadGame）、開啟寵物保管面板、出戰切換前。
function _petRosterResync() {
    try { if (_petRosterDirty) petRosterSave(); } catch (e) {}
    // ⚠️ petRoster() 會整份重建陣列，而 _petPersist 不保存這些「純執行期」欄位 → 直接重載會把它們洗掉。
    //    後果最嚴重的是 _downed：配合上面 `if ((p.hp||0)<=0) p.hp = 1;` 的夾擠，一隻倒地的出戰寵物會在
    //    每次同步時免費原地復活（hp=1、無冷卻、無 MP 消耗、不需復活卷軸），順便清光身上所有異常狀態。
    let _rt = {};
    try { (_petRoster || []).forEach(p => { if (p && p.uid) _rt[p.uid] = { _downed: p._downed, _reviveCd: p._reviveCd, _statuses: p._statuses, _px: p._px, _py: p._py }; }); } catch (e) {}
    _petRosterKey = null;
    let list = petRoster();
    try { (list || []).forEach(p => { let s = p && p.uid ? _rt[p.uid] : null; if (!s) return; for (let k in s) if (s[k] !== undefined) p[k] = s[k]; }); } catch (e) {}
    // 🩸 v3.5.95 回貼後補夾擠：桶內 _downed:1 會讓 petRoster 的夾擠跳過（hp 保持 0），但快照可能把 _downed 蓋回 false
    //   （已復活卻因 petRosterSave 失敗＝上限回滾／配額不足，來不及寫進桶）→ 產生「hp=0 但非倒地」的殭屍態：
    //   攻擊/施法全早退、petRevive 又因 !_downed 拒絕。此狀態在 v3.5.94 之前不可達（舊夾擠無條件給 hp=1）。
    try { (list || []).forEach(p => { if (p && !p._downed && (p.hp || 0) <= 0) p.hp = 1; }); } catch (e) {}
    return list;
}
function _petTombsRead(key) {   // 🪦 放生墓碑桶（key_rm）：{uid:1}·解不開視為空
    try { let raw = _lzGet(key + '_rm'); if (raw == null) return {}; let un = _saveUnwrap(raw); if (!un.ok) return {}; let o = JSON.parse(un.payload); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; } catch (e) { return {}; }
}
function _petTombsWrite(key, tombs) {   // 只留最近 300 筆（uid 不重複使用·舊墓碑可安全淘汰）
    try { let ks = Object.keys(tombs); if (ks.length > 300) ks.slice(0, ks.length - 300).forEach(k => delete tombs[k]); _lzSet(key + '_rm', _saveWrap(JSON.stringify(tombs))); } catch (e) {}
}
function _petPersist(p) {   // 只序列化長生欄位（戰鬥暫存 _ 前綴不入桶）
    let o = { uid: p.uid, form: p.form, lv: p.lv, exp: p.exp, expReqV: p.expReqV || PET_EXP_REQ_VERSION, mhp: p.mhp, mmp: p.mmp, hp: p.hp, mp: p.mp, outOwner: p.outOwner ? String(p.outOwner) : null, outSlot: p.outSlot == null ? null : String(p.outSlot), outV: p.outV || 0, eqV: p.eqV || 0, potPct: p.potPct || 0, name: p.name || '', locked: !!p.locked };
    // 🩸 v3.5.94 倒地狀態必須入桶（例外於「_ 前綴不入桶」通則）：不存的話重新整理後 _downed 消失、
    //    hp 被夾成 1 ＝ 免費復活。_reviveCd 一併存，避免重整規避 5 秒冷卻。
    if (p._downed) { o._downed = 1; if (p._reviveCd > 0) o._reviveCd = p._reviveCd; }
    if (p.eq && (p.eq.wpn || p.eq.arm)) {   // 🦴 v3.2.39 稽核修：個別裝備隨寵物入桶（漏存＝重載後裝備蒸發）；v3.2.40 改 _petGearPack 保留祝福/屬性/鎖定
        o.eq = {};
        for (let k of ['wpn', 'arm']) { let g = p.eq[k]; if (g && g.id) o.eq[k] = _petGearPack(g); }
        if (!o.eq.wpn && !o.eq.arm) delete o.eq;
    }
    return o;
}
function petMarkDirty() { _petRosterDirty = true; }
// Pet progress must never be persisted on a different cadence from the owning character.
// saveGame() commits both stores; before unload, use that same paired path.
window.addEventListener('beforeunload', () => { if (_petRosterDirty && typeof saveGame === 'function') saveGame(); });
// 🔄 多分頁即時同步：別分頁寫共用桶→本地唯讀合併（不回寫·避免 ping-pong）＋刷新開著的面板。守衛標題 stub（player.cls=null）。
window.addEventListener('storage', ev => {
    try {
        if (!ev || !ev.key || typeof player === 'undefined' || !player || !player.cls) return;
        let key = _petBucketKey();
        if (ev.key !== key) return;   // 只認當前模式桶（含別模式/倉庫/圖鑑桶一律略過）
        let cur = _petRosterRead(key);
        if (cur === null) return;   // 桶毀損：不動本地
        petRoster();                // 確保 _petRoster 已對應此 key
        _petMergeFromBucket(cur, key);   // 唯讀合併：進度取領先、裝備/出戰依版本戳採最新（別角色接手的寵會退出本地出戰）
        try { _petEnforceCarry(); } catch (e) {}
        let _d = document.getElementById('interaction-content');
        if (_d && _d.querySelector('[data-petui]')) { try { renderPetStorageNPC(_d); } catch (e) {} }
        try { if (typeof renderSquadPanel === 'function') renderSquadPanel(); } catch (e) {}
    } catch (e) {}
});

function petsOutList() { let owner = _petCurrentOwnerKey(); return owner ? petRoster().filter(p => String(p.outOwner || '') === owner) : []; }
function petChaUsed() { return petsOutList().reduce((s, p) => s + ((PET_BOOK[p.form] || {}).cha || 6), 0); }
function _petEnforceCarry() {   // 換角色載入：魅力不足/超過4隻→自動收回超出的
    let out = petsOutList();
    if (!player || !player.cls || !player.d || !Number.isFinite(Number(player.d.cha))) return;   // 載入/重算未完成時不可誤用魅力0收回寵物
    let cha = Number(player.d.cha), used = 0, n = 0;
    out.forEach(p => {
        let need = (PET_BOOK[p.form] || {}).cha || 6;
        if (n >= PET_CARRY_MAX || used + need > cha) {
            p.outOwner = null; p.outSlot = null; p.outV = _petNowStamp(); _petRosterDirty = true;
            // 🐾 v3.3.30 補訊息（用戶回報黃金龍「莫名自己收回」＝原本靜默）：說明原因（魅力不足/超過上限）·同一寵收回後不再入 petsOutList→不會重複洗版
            try { logSys(`<span class="text-amber-300">⚠ ${n >= PET_CARRY_MAX ? `超過攜帶上限 ${PET_CARRY_MAX} 隻` : `魅力不足（${petDisplayName(p)} 需 ${need}·已用 ${used}／目前魅力 ${cha}）`}，${petDisplayName(p)} 已自動返回寵物保管。</span>`); } catch (e) {}
        }
        else { used += need; n++; }
    });
}
function petNewInstance(form, lv) {
    let def = PET_BOOK[form]; if (!def) return null;
    let L = lv || def.lv0 || 5;
    let hp = def.hp0 != null ? def.hp0 : 30, mp = def.mp0 != null ? def.mp0 : 0;
    for (let i = (def.lv0 || 1); i < L; i++) { hp += def.hpUp[0]; mp += def.mpUp[0]; }   // 補起始等級前成長（保守取下限）
    return { uid: uid(), form: form, lv: L, exp: 0, expReqV: PET_EXP_REQ_VERSION, mhp: hp, mmp: mp, hp: hp, mp: mp, outOwner: null, outSlot: null, outV: 0, eqV: 0, potPct: 0, name: '', locked: false };
}
// 捕獲/獲得寵物入保管（滿→false）
function petStoreAdd(form, srcLabel, deferCommit) {
    let list = petRoster();
    if (list.length >= PET_STORAGE_MAX) { logSys(`<span class="text-red-400">寵物保管已滿（上限 ${PET_STORAGE_MAX} 隻），無法收留 ${form}。</span>`); return false; }
    let p = petNewInstance(form);
    if (!p) return false;
    list.push(p); _petPendingAddUids[p.uid] = 1;   // 🪣 v3.5.88 登記為「尚未進桶的本地新增」：只有這批可被上限守衛回滾
    petMarkDirty();
    if (!deferCommit && !petRosterSave()) { _petRoster = list.filter(x => x.uid !== p.uid); delete _petPendingAddUids[p.uid]; petMarkDirty(); logSys('<span class="text-red-400">寵物保管寫入失敗，本次取得已取消。</span>'); return false; }
    if (!deferCommit) logSys(`<span class="text-green-300 font-bold">🐾 ${srcLabel || '捕獲成功'}！${form}（Lv.${p.lv}）已送往寵物保管。</span>`);
    try { renderTabs(); } catch (e) {}
    return p;
}

function _petMutationSnapshot() {
    return {
        roster: JSON.parse(JSON.stringify(petRoster())),
        inv: JSON.parse(JSON.stringify(player.inv || [])),
        buffs: JSON.parse(JSON.stringify(player.buffs || {})),
        gold: player.gold || 0,
        lootSeq: player.lootSeq || 0
    };
}
function _petMutationRestore(s) {
    _petRoster = s.roster; player.inv = s.inv; player.buffs = s.buffs;
    player.gold = s.gold; player.lootSeq = s.lootSeq; petMarkDirty();
}
function _petCommitMutation(s) {
    if (typeof saveGame === 'function' && saveGame()) return true;
    _petMutationRestore(s);
    try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}
    logSys('<span class="text-red-400 font-bold">寵物與角色進度未能同步儲存，本次操作已取消。</span>');
    return false;
}
function _petCommitRosterOnly(before) {
    if (petRosterSave()) return true;
    _petRoster = before; petMarkDirty();
    logSys('<span class="text-red-400 font-bold">寵物保管寫入失敗，本次變更已取消。</span>');
    return false;
}

// 覆蓋存檔格建立新角色時，舊角色留在該格的出戰寵物全部安全回到保管。
// 同時掃一般／經典兩個桶，避免新角色模式不同造成寵物永久卡在已不存在的角色名下。
function petReleaseSlotAssignments(slot) {
    let legacyOwner = String(slot), owner = '';
    // 覆蓋前先讀該格舊存檔，只釋放真正屬於舊角色的寵物，不影響其他帳號同格角色。
    try {
        let raw = _lzGet('lineage_idle_save_' + slot), un = _saveUnwrap(raw);
        if (un && un.ok && un.payload) { let d = JSON.parse(un.payload); owner = _petOwnerKeyFor(d && d.p); }
    } catch (e) {}
    let changed = false;
    for (let key of [PET_ROSTER_KEY, PET_ROSTER_KEY + '_classic']) {
        let list = _petRosterRead(key); if (!Array.isArray(list) || !list.length) continue;
        let dirty = false;
        list.forEach(p => {
            if (!p) return;
            let owned = owner && String(p.outOwner || '') === owner;
            let legacy = !p.outOwner && p.outSlot != null && String(p.outSlot) === legacyOwner;
            if (owned || legacy) { p.outOwner = null; p.outSlot = null; p.outV = _petNowStamp(); dirty = true; }
        });
        if (!dirty) continue;
        let old = _lzGet(key); if (old != null) _lzSet(key + '_bak', old);
        if (_lzSet(key, _saveWrap(JSON.stringify(list.map(_petPersist))))) changed = true;
    }
    if (changed) _petRosterKey = null;
    return changed;
}

// ---------- 四、道具使用（誘捕/幼龍蛋）與擊殺捕捉 ----------
function petUseLureItem(d, silent) {   // eff:'petlure' → 掛 600 秒誘捕 buff（重複使用重置時間）
    let key = d.lure, cfg = PET_LURES[key];
    if (!cfg) return false;
    player.buffs[key] = d.dur || 600;
    if (!silent) logSys(`你使用了 ${d.n}，獲得增益 <span class="text-pink-300 font-bold">${cfg.n}</span>，持續 ${d.dur || 600} 秒。擊殺對應動物即可捕獲！`);
    try { updateUI(); } catch (e) {}
    return true;   // 呼叫端 fallthrough 消耗道具
}
function petUseDragonEgg(item) {   // 🐉 v3.7.56 幼龍蛋定向孵化：保管未滿→消耗·依蛋種 eggPet 孵出（頑皮幼龍蛋→頑皮龍、淘氣幼龍蛋→淘氣龍）
    if (petRoster().length >= PET_STORAGE_MAX) { logSys(`<span class="text-red-400">寵物保管已滿（上限 ${PET_STORAGE_MAX} 隻），無法孵化。</span>`); return; }
    let snap = _petMutationSnapshot();
    let form = (DB.items[item.id] && DB.items[item.id].eggPet) || '頑皮龍';
    item.cnt--; if (item.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== item.uid);
    let added = petStoreAdd(form, null, true);
    if (!added || !_petCommitMutation(snap)) return;
    logSys(`<span class="text-amber-300 font-bold">蛋殼裂開了！</span>一隻幼龍探出頭來……`);
    logSys(`<span class="text-green-300 font-bold">🐾 孵化成功！${form}（Lv.${added.lv}）已送往寵物保管。</span>`);
    try { renderTabs(); updateUI(); } catch (e) {}
    try { if (!document.getElementById('item-modal').classList.contains('hidden')) closeModal(); } catch (e) {}
}
function petUseCursedEgg(item, petName, crackMsg) {   // 🏺 v3.6.44 充滿詛咒氣息的蛋：保管未滿→消耗·獲得 詛咒蜥蜴；已滿→不可使用·蛋不消失。v3.6.47 泛化：厄運蛋(doomegg)共用此管道改傳 petName/crackMsg
    petName = petName || '詛咒蜥蜴';
    if (petRoster().length >= PET_STORAGE_MAX) { logSys(`<span class="text-red-400">寵物保管已滿（上限 ${PET_STORAGE_MAX} 隻），無法使用——蛋沒有消失。</span>`); return; }
    let snap = _petMutationSnapshot();
    item.cnt--; if (item.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== item.uid);
    let added = petStoreAdd(petName, null, true);
    if (!added || !_petCommitMutation(snap)) return;
    logSys(crackMsg || `<span class="text-purple-300 font-bold">蛋殼在詛咒的氣息中碎裂……</span>`);
    logSys(`<span class="text-green-300 font-bold">🐾 孵化成功！${petName}（Lv.${added.lv}）已送往寵物保管。</span>`);
    try { renderTabs(); updateUI(); } catch (e) {}
    try { if (!document.getElementById('item-modal').classList.contains('hidden')) closeModal(); } catch (e) {}
}
function petCaptureOnKill(mob) {   // killMob 掛點：專屬誘捕優先於一般誘捕（高麗幼犬僅高麗幼犬誘捕可捕）
    if (!mob || !player || !player.buffs) return;
    let order = ['lure_koreadog', 'lure_rabbit', 'lure_tiger', 'lure_kangaroo', 'lure_panda', 'lure_monkey', 'lure_general'];
    for (let key of order) {
        if (!(player.buffs[key] > 0) && !player._allLures) continue;   // 🐾 馴獸師的飼料袋：裝備時所有誘捕狀態皆視為生效
        let form = PET_LURES[key].mobs[mob.n];
        if (!form) continue;
        if (petRoster().length >= PET_STORAGE_MAX) { logSys(`<span class="text-red-400">寵物保管已滿，${PET_LURES[key].n} 未消耗——請先整理保管。</span>`); return; }
        let snap = _petMutationSnapshot();
        if (!player._allLures) player.buffs[key] = 0;   // 🐾 一般誘捕道具捕獲後消耗；飼料袋提供的誘捕不消耗（卸下即失效）
        let added = petStoreAdd(form, null, true);
        if (!added || !_petCommitMutation(snap)) return;
        logSys(`<span class="text-green-300 font-bold">🐾 誘捕成功！${form}（Lv.${added.lv}）已送往寵物保管。</span>`);
        return;
    }
}

// ---------- 五、出戰／放生／進化（包武）----------
function _petFind(uidv) { return petRoster().find(p => p.uid === uidv); }
function _petFindFresh(uidv) { _petRosterResync(); return _petFind(uidv); }   // 寫入前重讀共用桶，封住點擊與另一視窗存檔交界的舊鏡像
function _petOwnedByOther(p) { return !!(p && _petOutStateKey(p) && _petOutStateKey(p) !== _petCurrentOwnerKey()); }
function _petRejectForeignMutation(p) {
    if (!_petOwnedByOther(p)) return false;
    logSys(`<span class="text-amber-300">${petDisplayName(p)} 正由其他角色出戰，為避免多視窗資料錯亂，請先由原角色收回寵物。</span>`);
    return true;
}
function petDeployToggle(uidv) {
    _petRosterResync();   // 🔄 先與共用桶同步（拿到別角色最新出戰狀態）再判定→重新取得寵物參照
    let p = _petFind(uidv); if (!p) return;
    let before = JSON.parse(JSON.stringify(petRoster()));
    let slot = String(currentSlot), owner = _petCurrentOwnerKey(), isOut = !!owner && String(p.outOwner || '') === owner;
    if (!isOut && _petRejectForeignMutation(p)) return;   // 不再允許直接從另一個正在掛網的角色身上接手寵物
    if (isOut) { p.outOwner = null; p.outSlot = null; p.outV = _petNowStamp(); logSys(`${petDisplayName(p)} 返回了寵物保管。`); }
    else {
        let outs = petsOutList();
        if (outs.length >= PET_CARRY_MAX) { logSys(`<span class="text-red-400">最多同時攜帶 ${PET_CARRY_MAX} 隻寵物。</span>`); return; }
        let need = (PET_BOOK[p.form] || {}).cha || 6;
        if (petChaUsed() + need > (player.d.cha || 0)) { logSys(`<span class="text-red-400">魅力不足：攜帶 ${p.form} 需要魅力 ${need}（目前已用 ${petChaUsed()}/${player.d.cha || 0}）。</span>`); return; }
        p.outOwner = owner; p.outSlot = slot; p.outV = _petNowStamp(); p.hp = Math.max(1, p.hp);
        logSys(`<span class="text-green-300 font-bold">${petDisplayName(p)} 加入了隊伍！</span>`);
    }
    petMarkDirty(); if (!_petCommitRosterOnly(before)) return;
    try { renderSquadPanel(); } catch (e) {}
    let _d = document.getElementById('interaction-content'); if (_d && _d.querySelector('[data-petui]')) renderPetStorageNPC(_d);
}
function petRelease(uidv) {   // 第一段：彈出確認
    let p = _petFindFresh(uidv); if (!p) return;
    if (_petRejectForeignMutation(p)) return;
    if (p.locked) { logSys(`<span class="text-amber-300">${petDisplayName(p)} 已鎖定，無法放生。</span>`); return; }
    let _d = document.getElementById('interaction-content'); if (_d) renderPetStorageNPC(_d, uidv);
}
function petReleaseConfirm(uidv, yes) {
    let _d = document.getElementById('interaction-content');
    if (!yes) { if (_d) renderPetStorageNPC(_d); return; }
    let p = _petFindFresh(uidv); if (!p) { if (_d) renderPetStorageNPC(_d); return; }
    if (_petRejectForeignMutation(p)) { if (_d) renderPetStorageNPC(_d); return; }
    if (p.locked) { logSys(`<span class="text-amber-300">${petDisplayName(p)} 已鎖定，無法放生。</span>`); if (_d) renderPetStorageNPC(_d); return; }
    // 🦴 v3.2.42 稽核修：放生改走完整快照交易（roster＋背包＋退裝一次 commit·失敗全還原；原本退裝在桶寫入後才入包＋saveGame 失敗不回滾＝寵物與裝備雙失）
    let snap = _petMutationSnapshot();
    let _gearBack = [];   // 放生退裝：身上的武器/防具退回背包
    if (p.eq) { for (let _k of ['wpn', 'arm']) { if (p.eq[_k]) _gearBack.push(p.eq[_k]); } }
    _petRoster = petRoster().filter(x => x.uid !== uidv);
    _gearBack.forEach(g => player.inv.push(_petGearUnpack(g)));
    petMarkDirty();
    if (!_petCommitMutation(snap)) { if (_d) renderPetStorageNPC(_d); return; }
    _petReleasedUids[uidv] = true;   // 墓碑於成功後才標記（失敗回滾時寵物須能寫回桶）·補寫一次讓 _rm 立即持久化
    try { petRosterSave(); } catch (e) {}
    if (_gearBack.length) {
        logSys(`<span class="text-amber-200">牠身上的 ${_gearBack.map(g => (DB.items[g.id] ? DB.items[g.id].n : g.id) + ((g.en || 0) > 0 ? '+' + g.en : '')).join('、')} 已放回你的背包。</span>`);
    }
    logSys(`<span class="text-slate-300">你放生了 ${petDisplayName(p)}（Lv.${p.lv}），牠頭也不回地跑進了森林……</span>`);
    try { renderSquadPanel(); } catch (e) {}
    if (_d) renderPetStorageNPC(_d);
}
function petToggleLock(uidv) {
    let p = _petFindFresh(uidv); if (!p) return;
    if (_petRejectForeignMutation(p)) return;
    let before = JSON.parse(JSON.stringify(petRoster()));
    p.locked = !p.locked;
    petMarkDirty();
    if (!_petCommitRosterOnly(before)) return;
    logSys(`<span class="${p.locked ? 'text-amber-300' : 'text-slate-300'}">${petDisplayName(p)} 已${p.locked ? '鎖定，不會顯示放生選項' : '解除鎖定'}。</span>`);
    let _d = document.getElementById('interaction-content'); if (_d) renderPetStorageNPC(_d);
}
// 🐉 v3.2.63 進化樹改制：只有「一般型態(tier 0)」可進化，並有兩條路——①進化果實→對應高等(def.evo) ②勝利果實→黃金龍。
//   高等型態(tier 1)與黃金龍皆為最終型態、不可再進化。回傳本寵物的可進化選項清單 [{fruitId, target}]。
function petEvoOptions(p) {
    let def = p && PET_BOOK[p.form]; if (!def) return [];
    if ((def.tier || 0) !== 0 || !def.evo) return [];   // 只有一般型態可進化
    let opts = [{ fruitId: 'item_evo_fruit', target: def.evo }];   // 進化果實 → 高等
    if (PET_BOOK['黃金龍']) opts.push({ fruitId: 'item_victory_fruit', target: '黃金龍' });   // 勝利果實 → 黃金龍
    return opts;
}
function petEvolve(uidv, fruitId) {   // Lv30+；一般型態：進化果實→高等 或 勝利果實→黃金龍（兩果實都有→跳選擇框）；進化後 Lv1、HP/MP=進化前 50%
    let p = _petFindFresh(uidv); if (!p) return;
    if (_petRejectForeignMutation(p)) return;
    let def = PET_BOOK[p.form]; if (!def) return;
    if ((p.lv || 1) < 30) { logSys('<span class="text-red-400">寵物等級 30 以上才能進化。</span>'); return; }
    let opts = petEvoOptions(p);
    if (!opts.length) { logSys('<span class="text-red-400">此寵物已是最終型態，無法再進化。</span>'); return; }
    let avail = opts.filter(o => player.inv.some(i => i.id === o.fruitId && (i.cnt || 0) > 0));
    if (!avail.length) {
        let names = opts.map(o => DB.items[o.fruitId] ? DB.items[o.fruitId].n : o.fruitId).join(' 或 ');
        logSys(`<span class="text-red-400">身上沒有 ${names}，無法進化。</span>`); return;
    }
    let chosen = fruitId ? avail.find(o => o.fruitId === fruitId) : (avail.length === 1 ? avail[0] : null);
    if (!chosen) { if (avail.length > 1) petEvoChoose(p, avail); return; }   // 兩種果實都有→讓玩家選
    let fruit = player.inv.find(i => i.id === chosen.fruitId && (i.cnt || 0) > 0);
    if (!fruit) return;
    let snap = _petMutationSnapshot();
    fruit.cnt--; if (fruit.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== fruit.uid);
    let from = p.form;
    p.form = chosen.target; p.lv = 1; p.exp = 0;
    p.mhp = Math.max(1, Math.floor(p.mhp * 0.5)); p.mmp = Math.max(0, Math.floor(p.mmp * 0.5));
    p.hp = p.mhp; p.mp = p.mmp;
    petMarkDirty();
    if (!_petCommitMutation(snap)) return;
    logSys(`<span class="c-legend font-bold">✨ 進化成功！</span><span class="text-amber-200">${from} 進化為 </span><span class="text-amber-300 font-bold">${p.form}</span><span class="text-amber-200">（Lv.1·HP/MP 為進化前的 50%）！</span>`);
    try { renderTabs(); renderSquadPanel(); } catch (e) {}
    let _d = document.getElementById('interaction-content'); if (_d) renderPetStorageNPC(_d);
}
function petEvoChoose(p, avail) {   // 🐉 v3.2.63 兩種果實都有時的進化方向選擇框
    let old = document.getElementById('pet-evo-overlay'); if (old) old.remove();
    let btns = avail.map(o => {
        let fN = DB.items[o.fruitId] ? DB.items[o.fruitId].n : o.fruitId;
        let cnt = player.inv.filter(i => i.id === o.fruitId).reduce((s, i) => s + (i.cnt || 0), 0);
        return `<button onclick="document.getElementById('pet-evo-overlay').remove(); petEvolve('${p.uid}','${o.fruitId}')" class="btn" style="display:block;width:100%;text-align:left;padding:9px 12px;margin:5px 0;border:1px solid #eab308;border-radius:6px;background:linear-gradient(135deg,#713f12,#ca8a04);color:#fef9c3;font-weight:bold;">
            進化為 ${o.target}<br><span style="font-size:11px;opacity:.85;font-weight:normal;">消耗 ${fN}（擁有 ${cnt}）</span></button>`;
    }).join('');
    let ov = document.createElement('div');
    ov.id = 'pet-evo-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:97;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
    ov.addEventListener('click', ev => { if (ev.target === ov) ov.remove(); });
    ov.innerHTML = `<div style="width:320px;background:#0b1220;border:1px solid #6d28d9;border-radius:8px;padding:14px;font-size:13px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span class="text-purple-300 font-bold">🐾 ${petDisplayName(p)}：選擇進化方向</span>
            <button onclick="document.getElementById('pet-evo-overlay').remove()" class="btn" style="padding:2px 10px;border:1px solid #475569;border-radius:4px;">✕</button>
        </div>
        <div class="text-slate-400" style="font-size:11px;margin-bottom:6px;">你同時擁有兩種果實，請選擇要用哪一種進化（進化後 Lv.1·HP/MP 為進化前的 50%）：</div>
        ${btns}
    </div>`;
    document.body.appendChild(ov);
}
function petDisplayName(p) { return (p.name ? p.name + '（' + p.form + '）' : p.form); }
function petSetPotPct(uidv, v) { let p = _petFindFresh(uidv); if (!p || _petRejectForeignMutation(p)) return; p.potPct = Math.max(0, Math.min(95, parseInt(v, 10) || 0)); petMarkDirty(); }

// ---------- 五之二、寵物個別裝備（v3.2.37：武器 slot:petwpn／防具 slot:petarm·裝備存在寵物身上 p.eq={wpn,arm}·共用桶隨寵物走）----------
const PET_GEAR_SLOT = { wpn: { slot: 'petwpn', n: '寵物武器' }, arm: { slot: 'petarm', n: '寵物防具' } };
function _petGearPack(it) {   // 🦴 v3.2.40 稽核修：裝備快照除 cnt 外保留長生欄位（祝福/屬性強化/鎖定不再被洗成白板）
    let o = { id: it.id, uid: it.uid, en: it.en || 0 };
    for (let k of ['bless', 'anc', 'attr', 'lock']) { if (it[k] !== undefined && it[k] !== null && it[k] !== false) o[k] = it[k]; }
    return o;
}
function _petGearUnpack(g) {   // 退回背包用：還原完整欄位·cnt=1·缺 uid 補發
    let o = Object.assign({}, g, { cnt: 1 });
    if (!o.uid) o.uid = (typeof uid === 'function' ? uid() : 'pg' + Date.now() + Math.random().toString(36).slice(2, 6));
    return o;
}
function petGearOpen(uidv, key) {   // 點按鈕 → 清單：背包同部位物品（點=裝上/替換）＋已裝備時的「卸下」
    let p = _petFindFresh(uidv); if (!p || !PET_GEAR_SLOT[key]) return;
    if (_petRejectForeignMutation(p)) return;
    let old = document.getElementById('pet-gear-overlay'); if (old) { old.remove(); }
    let cfg = PET_GEAR_SLOT[key];
    let cur = p.eq && p.eq[key];
    let list = (player.inv || []).filter(i => { let dd = DB.items[i.id]; return dd && dd.slot === cfg.slot; });
    let rows = list.map(i => {
        let dd = DB.items[i.id];
        return `<button onclick="petGearEquip('${p.uid}','${key}','${i.uid}')" class="btn" style="display:block;width:100%;text-align:left;padding:5px 10px;margin:2px 0;border:1px solid #334155;border-radius:4px;background:#0f172a;">
            <b class="text-slate-100">${dd.n}${(i.en || 0) > 0 ? '<span class="text-amber-300">+' + i.en + '</span>' : ''}</b></button>`;
    }).join('');
    let ov = document.createElement('div');
    ov.id = 'pet-gear-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:96;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
    ov.addEventListener('click', ev => { if (ev.target === ov) ov.remove(); });
    ov.innerHTML = `<div style="width:340px;max-height:70vh;overflow-y:auto;background:#0b1220;border:1px solid #6d28d9;border-radius:8px;padding:12px;font-size:13px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span class="text-purple-300 font-bold">🐾 ${petDisplayName(p)}：${cfg.n}</span>
            <button onclick="document.getElementById('pet-gear-overlay').remove()" class="btn" style="padding:2px 10px;border:1px solid #475569;border-radius:4px;">✕</button>
        </div>
        <div class="text-slate-400" style="font-size:11px;margin-bottom:6px;">目前：<b class="text-amber-300">${cur && DB.items[cur.id] ? DB.items[cur.id].n + ((cur.en || 0) > 0 ? '+' + cur.en : '') : '（無）'}</b></div>
        ${cur ? `<button onclick="petGearUnequip('${p.uid}','${key}')" class="btn" style="display:block;width:100%;text-align:left;padding:5px 10px;margin:2px 0;border:1px solid #b91c1c;border-radius:4px;background:#1f0a0a;color:#fecaca;font-weight:bold;">卸下 ${DB.items[cur.id] ? DB.items[cur.id].n : ''}${(cur.en || 0) > 0 ? '+' + cur.en : ''}</button>` : ''}
        ${rows || '<div class="text-slate-500" style="text-align:center;padding:12px 0;">背包沒有可用的' + cfg.n + '——可到 亞丁 諾斯 處鍛造。</div>'}
    </div>`;
    document.body.appendChild(ov);
}
function petGearEquip(uidv, key, invUid) {
    let p = _petFindFresh(uidv); if (!p || !PET_GEAR_SLOT[key]) return;
    if (_petRejectForeignMutation(p)) return;
    let idx = (player.inv || []).findIndex(i => i.uid === invUid);
    if (idx < 0) { logSys('<span class="text-red-400">找不到該物品。</span>'); return; }
    let item = player.inv[idx];
    let dd = DB.items[item.id];
    if (!dd || dd.slot !== PET_GEAR_SLOT[key].slot) return;
    let snap = _petMutationSnapshot();
    let old = p.eq && p.eq[key];
    p.eq = p.eq || {};
    if ((item.cnt || 1) > 1) {   // 🦴 v3.2.39 稽核修：疊裝只取一件（原本整疊 splice＝其餘蒸發），寵物那件配新 uid 與留在背包的疊區隔
        item.cnt--;
        p.eq[key] = Object.assign(_petGearPack(item), { uid: (typeof uid === 'function' ? uid() : 'pg' + Date.now() + Math.random().toString(36).slice(2, 6)) });
    } else {
        p.eq[key] = _petGearPack(item);
        player.inv.splice(idx, 1);
    }
    if (old) player.inv.push(_petGearUnpack(old));
    p.eqV = _petNowStamp();   // 🕐 裝備版本戳＝最後變更（防別角色/自動存檔洗掉）
    petMarkDirty();
    if (!_petCommitMutation(snap)) return;   // 失敗＝背包與寵物一併還原
    logSys(`<span class="text-green-300">${petDisplayName(p)} 裝上了 <b>${dd.n}${(item.en || 0) > 0 ? '+' + item.en : ''}</b>。</span>`);
    let ov = document.getElementById('pet-gear-overlay'); if (ov) ov.remove();
    let _d = document.getElementById('interaction-content'); if (_d && _d.querySelector('[data-petui]')) renderPetStorageNPC(_d);
    try { renderSquadPanel(); } catch (e) {}
}
function petGearUnequip(uidv, key) {
    let p = _petFindFresh(uidv); if (!p || !p.eq || !p.eq[key]) return;
    if (_petRejectForeignMutation(p)) return;
    let snap = _petMutationSnapshot();
    let g = p.eq[key];
    p.eq[key] = null; delete p.eq[key];
    player.inv.push(_petGearUnpack(g));
    p.eqV = _petNowStamp();   // 🕐 裝備版本戳＝最後變更（卸下也算）
    petMarkDirty();
    if (!_petCommitMutation(snap)) return;
    logSys(`<span class="text-slate-300">已卸下 ${petDisplayName(p)} 的 ${DB.items[g.id] ? DB.items[g.id].n : g.id}${(g.en || 0) > 0 ? '+' + g.en : ''}，放回背包。</span>`);
    let ov = document.getElementById('pet-gear-overlay'); if (ov) ov.remove();
    let _d = document.getElementById('interaction-content'); if (_d && _d.querySelector('[data-petui]')) renderPetStorageNPC(_d);
    try { renderSquadPanel(); } catch (e) {}
}

// ---------- 六、經驗（每隻未倒地出戰寵物各得玩家完整份額·需求=玩家1/10；玩家滿等仍可養寵）----------
function petsGainExp(playerGain) {
    if (!(playerGain > 0)) return;
    let outs = petsOutList().filter(p => !p._downed);
    if (!outs.length) return;
    let _cap = Math.min(100, (player.lv || 1));   // 🐾 v3.2.40 用戶指定：寵物等級不得超過玩家等級（達上限比照 Lv100 不累積經驗·玩家升級後恢復成長）
    outs.forEach(p => { if ((p.lv || 1) >= _cap) p.exp = 0; });   // 滿等者不囤經驗（原規則）
    // 🐾 v3.7.62 經驗不再由寵物平分：每隻未滿等且未倒地的出戰寵物都拿完整份額。
    let elig = outs.filter(p => (p.lv || 1) < _cap);
    if (!elig.length) { petMarkDirty(); return; }
    let each = Math.floor(playerGain);
    if (each <= 0) return;
    elig.forEach(p => {
        p.exp = (p.exp || 0) + each;
        let up = 0;
        while (p.lv < _cap && p.exp >= petExpReq(p.lv)) {
            p.exp -= petExpReq(p.lv);
            p.lv++; up++;
            let def = PET_BOOK[p.form];
            let hg = def.hpUp[0] + Math.floor(lootRng('petHp') * (def.hpUp[1] - def.hpUp[0] + 1));   // committed RNG：SL 重讀同結果
            let mg = def.mpUp[0] + Math.floor(lootRng('petMp') * (def.mpUp[1] - def.mpUp[0] + 1));
            p.mhp += hg; p.mmp += mg; p.hp += hg; p.mp += mg;
        }
        if (p.lv >= _cap) p.exp = 0;
        if (up > 0) { logCombat(`<span class="text-yellow-300 font-bold">寵物 ${petDisplayName(p)} 升級了！目前 Lv.${p.lv}</span>`, 'player-special'); petMarkDirty(); try { renderSquadPanel(); } catch (e) {} }
    });
    petMarkDirty();
}

// ---------- 七、戰鬥（tick 掛點：js/03 呼叫 petsTick）----------
function _petInWild() {   // 狩獵區判定：該圖有出怪池（村莊/安全區不在 DB.maps）或場上實際有怪（涵蓋裂痕/攻城等特殊模式）
    try {
        if (typeof state !== 'undefined' && state && state.riftRun) return true;   // 🌀 時空裂痕：rift_battle 不在 DB.maps→原僅靠「場上有怪」判野外·波次間無怪時會誤判安全區→寵物/召喚圖層被清空再重建（閃爍）。裂痕進行中全程視為野外。
        if (typeof player !== 'undefined' && player && player.siege && player.siege.active) return true;   // ⚔️ 攻城戰：全程視為野外（攻城圖雖在 DB.maps·此為顯式保險·防波次/守護塔切換時誤判）
        if (Array.isArray(DB.maps[mapState.current]) && DB.maps[mapState.current].length) return true;
        return !!(mapState.mobs && mapState.mobs.some(m => m && m.curHp > 0));
    } catch (e) { return false; }
}
function petsTick() {
    let outs = petsOutList();
    if (!outs.length) return;
    let wild = _petInWild();
    outs.forEach(p => {
        let d = petDerive(p); if (!d) return;
        // 倒地：非野外（安全區）免費復活；野外等 5 秒復活卷軸
        if (p._downed) {
            if (!wild) { _petReviveDone(p, '安全區'); return; }
            p._reviveCd = (p._reviveCd || 0) - 1;
            if (p._reviveCd <= 0 || (typeof playerHasAutoReviveEarring === 'function' && playerHasAutoReviveEarring())) {   // 🏺 巨靈的承諾耳環：跳過冷卻立即復活（仍消耗卷軸）
                let sc = player.inv.find(i => i.id === 'scroll_revive' && (i.cnt || 0) > 0);
                if (sc) { sc.cnt--; if (sc.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== sc.uid); _petReviveDone(p, '復活卷軸（自動）'); }
            }
            return;
        }
        _petStatusTick(p);
        if (p._downed) return;
        // 每 5 秒恢復（比照規格 HP恢復/MP恢復）
        let def = PET_BOOK[p.form];
        if (state.ticks % 50 === 0) {
            { let _me = petMhpEff(p); if (p.hp < _me && def.hpReg) p.hp = Math.min(_me, p.hp + def.hpReg); }   // 🏺 v3.7.20 恢復上限含 petHpAll 光環
            let _mmpEff = p.mmp + (d.mmpBonus || 0);   // 🛡️ v3.2.37 寵物防具 精神：MP上限+5/點·MP恢復+1/點
            if (p.mp < _mmpEff && ((def.mpReg || 0) + (d.mpRegBonus || 0) > 0)) p.mp = Math.min(_mmpEff, p.mp + (def.mpReg || 0) + (d.mpRegBonus || 0));
        }
        // HP<X% 喝隊長的治癒藥水（邏輯同傭兵：讀 #set-pot 藥水·缺貨可自動補貨）
        petTryPotion(p);
        if (!wild || player.dead) return;
        let pst = p._statuses || {};
        if ((pst.freeze || 0) > 0 || (pst.stun || 0) > 0 || (pst.stone || 0) > 0 || (pst.sleep || 0) > 0 || (pst.paralyze || 0) > 0) return;
        if ((p._actionCd || 0) > 0) p._actionCd--;
        // 選目標：最近的敵人（依戰場座標；無座標退 getTarget）
        let tgt = _petPickTarget(p);
        if (!tgt) return;
        // 技能（依施法速度節奏·MP 足夠才放）
        if (d.castItv > 0 && def.sk.length && !((pst.silence || 0) > 0 || (pst.magicseal || 0) > 0)) {
            p._castCd = (p._castCd != null ? p._castCd : (d.castItv - 1)) - 1;
            if (p._castCd <= 0 && (p._actionCd || 0) <= 0) {
                let _ok; if (typeof threatWrap === 'function') threatWrap(p, () => { _ok = petCastSkill(p, d, tgt); }); else _ok = petCastSkill(p, d, tgt);   // 🎯 v3.7.97 仇恨：寵物技能傷害→記給該寵物
                if (_ok) { p._castCd = d.castItv; p._actionCd = 4; }
                else p._castCd = Math.min(10, d.castItv);
            }
        }
        // 一般攻擊（依攻擊速度）
        p._atkCd = (p._atkCd != null ? p._atkCd : (d.atkItv - 1)) - 1;
        p._stunCycle = false;
        if (p._atkCd <= 0 && (p._actionCd || 0) <= 0) {
            tgt = _petPickTarget(p);   // 技能可能已擊殺
            if (tgt) { if (typeof threatWrap === 'function') threatWrap(p, () => petAttackOnce(p, d, tgt)); else petAttackOnce(p, d, tgt); p._actionCd = 3; }   // 🎯 v3.7.97 仇恨：寵物普攻傷害→記給該寵物
            p._atkCd = Math.ceil(d.atkItv * ((pst.slowAtk || 0) > 0 ? 2 : 1));
        }
    });
}
function _petDown(p, cause) {
    if (!p || p._downed) return;
    p.hp = 0; p._downed = true; p._reviveCd = 50;   // 5 秒（50 tick）後復活卷軸自動復活
    _petAnimAct(p, 'death');   // 🎬 v3.2.73 補跑中不設→回前景靠 _downed hold 死亡末幀（不補播倒下動畫）
    logCombat(`<span class="text-red-400 font-bold">寵物 ${p.form} 倒下了！</span>${cause ? `（${cause}）` : '（5 秒後可用復活卷軸自動復活，或立即施放返生術）'}`, 'enemy-attack', 'enemy');
    petMarkDirty();
    try { renderSquadPanel(); } catch (e) {}
}
function _petStatusTick(p) {
    let st = p._statuses; if (!st) return;
    let dots = [['poison','poisonDmg','poisonTick'],['burn','burnDmg','burnTick'],['scald','scaldDmg','scaldTick'],['bleed','bleedDmg','bleedTick']];
    for (let x of dots) {
        if ((st[x[0]] || 0) > 0 && state.ticks % Math.max(1, st[x[2]] || 10) === 0) p.hp -= Math.max(1, st[x[1]] || 1);
    }
    ['freeze','stun','stone','sleep','paralyze','silence','magicseal','slowAtk','poison','burn','scald','bleed','weaken','disease','blind','potionFrost','foulWater'].forEach(k => { if ((st[k] || 0) > 0) st[k]--; });   // 🌊 v3.6.20 含汙濁之水
    if (p.hp <= 0) _petDown(p, '持續傷害');
}
function _petPickTarget(p) {
    if (typeof mapState === 'undefined' || !mapState.mobs) return null;
    let alive = mapState.mobs.filter(m => m && m.curHp > 0);
    if (!alive.length) return null;
    // 最近的敵人：以寵物戰場位置 vs 怪物卡片位置（無渲染資訊時退最早出生）
    // 🐾 v3.2.42 稽核修：距離選出的目標與出生序備援分開存——原本剛出生尚未渲染的怪會以出生序「搶走」已依距離選定的目標
    let best = null, bd = Infinity, fb = null;
    let pr = p._px != null ? { x: p._px, y: p._py } : null;
    for (let m of alive) {
        let r = (pr && typeof _vfxSlotRect === 'function') ? _vfxSlotRect(m.uid) : null;
        if (pr && r && r.width) {
            let host = _petLayerHost();
            if (host) {
                let hr = host.getBoundingClientRect();
                let mx = (r.left + r.width / 2 - hr.left) / Math.max(1, hr.width), my = (r.top + r.height / 2 - hr.top) / Math.max(1, hr.height);
                let dd = (mx - pr.x) * (mx - pr.x) + (my - pr.y) * (my - pr.y);
                if (dd < bd) { bd = dd; best = m; }
                continue;
            }
        }
        if (!fb || (m._born || 0) < (fb._born || 0)) fb = m;
    }
    return best || fb;
}
function petAttackOnce(p, d, target, forceCrit, addDmg, skName) {
    if (!target || target.curHp <= 0) return;
    _combatSrc = 'pet';
    let _snap = (typeof _dpsSnap === 'function') ? _dpsSnap() : null;
    try {
        let pg = (typeof petGearBonus === 'function') ? petGearBonus(p) : { dmg: 0, hit: 0 };   // 🦴 v3.2.37 讀該寵物自身的武器（p.eq.wpn）
        let cb = petCharmCombatBonus();
        let _ia = (typeof teamIlluAura === 'function') ? teamIlluAura(p, true) : null;   // 🩹 v3.2.67 幻覺攻擊光環（化身+10傷／歐吉+4傷+4命）全隊生效→注入出戰寵物普攻
        let _pst = p._statuses || {};
        let rawHit = p.lv + d.hit + cb.hit + pg.hit + (_ia ? _ia.eh : 0) - target.lv + mobEffAC(target) + (typeof _relicPartnerHit === 'function' ? _relicPartnerHit(p.form) : 0) - (_pst.weaken > 0 ? 2 : 0) - (_pst.disease > 0 ? 4 : 0) - (_pst.blind > 0 ? 6 : 0);
        let hv = stretchHitValue(rawHit);
        let r = roll(1, 20);
        let heavy = (r === 20) || !!forceCrit;
        if (heavy || (r !== 1 && hv >= r)) {
            let targetDr = Math.floor((target.dr || 0) * (1 - (d.drPierce || 0)));
            let dmg = (heavy ? d.dice : roll(1, d.dice)) + d.flat + cb.dmg + (addDmg || 0) + pg.dmg + (_ia ? _ia.ed : 0) + (_ia ? (_ia.mel || 0) : 0) + (petDevotionGuardOn(p) ? 8 : 0) - targetDr - (_pst.weaken > 0 ? 5 : 0);   // 🏺 v3.6.44 珍愛夥伴的執念：復活後 8 秒額外傷害 +8；🔥 v3.8.3 _ia.mel＝舞躍之火團隊光環近距離傷害+3（寵物普攻＝近距離）
            dmg = Math.max(1, Math.floor(dmg));
            dmg += traumaPhysicalBonus(target);
            let atkMult = (d.damageMult || 1) * (d.attackMult || 1);
            dmg = Math.max(1, (d.attackMult || 1) > 1 ? Math.ceil(dmg * atkMult) : Math.floor(dmg * atkMult));   // 🦎 蜥蜴普攻以同級黃金龍為底再套角色倍率；其餘寵物維持原取整
            if (skName && typeof _relicPetSkillMult === 'function') dmg = Math.max(1, Math.floor(dmg * _relicPetSkillMult()));
            markBossPhysicalHit(target);
            target.curHp -= dmg; if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(target, dmg, skName ? 'magic' : 'melee'); target.justHit = 'none'; mobWake(target);   // 🌅 巨大骷髏：寵物普攻＝近距離、寵物技能＝魔法
            let _pw = p && p.eq && p.eq.wpn ? DB.items[p.eq.wpn.id] : null;
            if (_pw && _pw.petBleed && target.curHp > 0 && typeof applyBleed === 'function') applyBleed(target, dmg, 5, 'pet');   // 🏺 遺物 仿製小惡魔尖牙套：寵物一般攻擊命中造成出血；🎯 DPS 歸夥伴
            _petAnimAct(p, 'attack', target.uid);
            logCombat(`寵物 [${p.form}] ${skName ? `<span class="text-pink-300 font-bold">${skName}</span> ` : ''}攻擊 <span class="${getMobColor(target.lv)}">${target.n}</span>，造成 ${dmg}${heavy ? '（重擊）' : ''} 點傷害！`, 'player-special');
            _petAfterDamage(target);
        } else {
            _petAnimAct(p, 'attack', target.uid);
            if (typeof vfxMiss === 'function') vfxMiss(target);
            logCombat(`寵物 [${p.form}] 的攻擊未命中。`, 'miss');
        }
    } catch (e) {}
    if (_snap && typeof _dpsDealt === 'function') { let _dd = _dpsDealt(_snap); if (_dd > 0) _dps.pet += _dd; }
    _combatSrc = null;
}
function petDebuffChance(p, d, target, sk) {
    let effMr = (target.st && target.st.mrhalf > 0) ? Math.floor((target.mr || 0) / 2) : (target.mr || 0);
    let ch = (sk.acc || 50) + d.tier * 8 + ((p.lv || 1) - (target.lv || 1)) * 0.5 - effMr * 0.35 + petCharmCombatBonus().hit * 0.5 - (target.boss ? 10 : 0);
    return _petClamp(ch, 5, 90);
}
function petCastSkill(p, d, target) {
    let def = PET_BOOK[p.form];
    let usable = def.sk.filter(s => p.mp >= s.mp);
    if (!usable.length) return false;
    // 權重擇一（w 欄位·未標=均分）
    let sk;
    if (usable.length === 1) sk = usable[0];
    else { let tw = usable.reduce((s, x) => s + (x.w || 100 / usable.length), 0); let rr = Math.random() * tw; for (let x of usable) { rr -= (x.w || 100 / usable.length); if (rr < 0) { sk = x; break; } } sk = sk || usable[usable.length - 1]; }
    p.mp -= sk.mp;
    _combatSrc = 'pet';
    let _snap = (sk.kind !== 'extra' && typeof _dpsSnap === 'function') ? _dpsSnap() : null;
    try {
        _petAnimAct(p, 'skill', target.uid);
        if (sk.kind === 'extra') {   // 額外一次一般攻擊（熊貓爆擊=必定重擊；勾爪=+add）
            petAttackOnce(p, d, target, !!sk.crit, sk.add || 0, sk.n);
        } else if (sk.kind === 'debuff') {
            let ch = petDebuffChance(p, d, target, sk);
            if (Math.random() * 100 < ch) {
                target.st = target.st || newMobStatus();
                if (sk.debuff === 'slow') target.st.slow = Math.max(target.st.slow || 0, 100);
                if (sk.debuff === 'weaken') target.st.weaken = Math.max(target.st.weaken || 0, 100);
                if (sk.debuff === 'disease') target.st.disease = Math.max(target.st.disease || 0, 100);
                logCombat(`寵物 [${p.form}] 施放 <span class="text-pink-300 font-bold">${sk.n}</span>，<span class="${getMobColor(target.lv)}">${target.n}</span> 陷入${sk.debuff === 'slow' ? '緩速' : sk.debuff === 'weaken' ? '弱化' : '疾病'}！（命中率 ${Math.round(ch)}%）`, 'player-special');
            } else logCombat(`寵物 [${p.form}] 施放 <span class="text-pink-300 font-bold">${sk.n}</span>，但被抵抗了。（命中率 ${Math.round(ch)}%）`, 'miss');
        } else if (sk.kind === 'dot') {   // 🦎 v3.6.43 蜥蜴固定 DoT（必中·每秒 dps 點固定傷害·dur 秒）：burn=_burnDot／bleed=bleeds 層／poison=st.poison*（皆走既有 tick 管線·DPS 歸 'pet'）
            let _t = (sk.dur || 6) * 10, _dm = (sk.dps || 10) + Math.floor(Math.max(1, p.lv || 1) / 5);
            if (sk.dot === 'burn') target._burnDot = { left: _t, dmg: _dm, tick: 10, src: 'pet' };
            else if (sk.dot === 'bleed') {
                target.bleeds = target.bleeds || [];
                target._bleedCap = Math.max(target._bleedCap || 0, 5);
                while (target.bleeds.length >= target._bleedCap) target.bleeds.shift();
                target.bleeds.push({ dmg: _dm, ticksLeft: _t });
                target._bleedSrc = 'pet';
            } else if (sk.dot === 'poison') {
                let st2 = target.st = target.st || newMobStatus();
                st2.poison = Math.max(st2.poison || 0, _t);
                st2.poisonTick = Math.min(st2.poisonTick || 999, 10);
                st2.poisonStacks = Math.max(1, st2.poisonStacks || 0);
                st2.poisonUnit = Math.max(st2.poisonUnit || 0, _dm);
                st2.poisonDmg = st2.poisonUnit * st2.poisonStacks;
                st2.poisonSrc = 'pet';
            }
            mobWake(target);
            logCombat(`寵物 [${p.form}] 施放 <span class="text-pink-300 font-bold">${sk.n}</span>，<span class="${getMobColor(target.lv)}">${target.n}</span> 陷入${sk.dot === 'burn' ? '灼燒' : sk.dot === 'bleed' ? '出血' : '中毒'}！（每秒 ${_dm} 點·持續 ${sk.dur || 6} 秒）`, 'player-special');
        } else if (sk.kind === 'selfbuff') {   // 🦎 災厄蜥蜴堅硬：自身傷害減免 +dr·dur 秒（petHardenDr 於受擊時消費·runtime 欄位不入桶）
            let _hd = (sk.dr || 10) + Math.floor(Math.max(1, p.lv || 1) / 10);
            p._hardenDr = _hd;
            p._hardenUntil = (state.ticks || 0) + (sk.dur || 6) * 10;
            logCombat(`寵物 [${p.form}] 施放 <span class="text-pink-300 font-bold">${sk.n}</span>，傷害減免 +${_hd}！（持續 ${sk.dur || 6} 秒）`, 'player-special');
        } else {   // magic：骰值+技能傷害加成·吃魔抗/DR/屬性剋制；必定命中
            let targets = sk.aoe ? mapState.mobs.filter(m => m && m.curHp > 0) : [target];
            let texts = [];
            let _iaMd = (typeof teamIlluAura === 'function' && teamIlluAura(p, true)) ? (teamIlluAura(p, true).md || 0) : 0;   // 🩹 v3.2.67 幻覺攻擊光環（巫妖+2魔傷）全隊生效→注入寵物法術
            targets.forEach(m => {
                let effMr = (m.st && m.st.mrhalf > 0) ? Math.floor((m.mr || 0) / 2) : (m.mr || 0);
                let core = roll(sk.d[0], sk.d[1]) + d.skillFlat + _iaMd;   // 👑 v3.4.28 移除舊「夥伴精通 +魅力全額法傷」（改為 damageMult ×1.5）
                let dmg = Math.floor(core * mrMult(effMr));
                if (sk.ele && sk.ele !== 'none' && m.e && m.e !== 'none' && typeof elementCounterMult === 'function') dmg = Math.floor(dmg * elementCounterMult(sk.ele, m.e));
                dmg = Math.max(1, dmg - (m.dr || 0));
                let magicMult = (d.damageMult || 1) * (d.magicMult || 1);
                dmg = Math.max(1, (d.magicMult || 1) > 1 ? Math.ceil(dmg * magicMult) : Math.floor(dmg * magicMult));   // 🦎 蜥蜴魔法以同級黃金龍為底再套角色倍率；其餘寵物維持原取整
                if (typeof _relicPetSkillMult === 'function') dmg = Math.max(1, Math.floor(dmg * _relicPetSkillMult()));   // 🏺 馴獸師的訓狗棒：寵物技能×1.5
                if (sk.n && sk.n.includes('冰錐') && typeof equipSkillDmgMult === 'function') dmg = Math.max(1, Math.floor(dmg * equipSkillDmgMult(DB.skills.sk_ice_spike, 'sk_ice_spike')));   // 🏺 v3.2.35 暴走兔最愛的胡蘿蔔：攜帶的暴走兔/高等暴走兔施放的冰錐也 ×1.5（掃玩家裝備 skillDmgMult.sk_ice_spike·與訓狗棒相乘）
                m.curHp -= dmg; if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(m, dmg, 'magic'); m.justHit = sk.ele || 'none'; mobWake(m);   // 🌅 巨大骷髏：寵物傷害技能視為魔法
                let _fz = false;   // 🦎 v3.6.43 詛咒蜥蜴冰雪暴：freezeCh% 機率冰凍 4 秒（頭目免疫冰凍·比照 js/04 BOSS_IMMUNE）
                if (sk.freezeCh && m.curHp > 0 && Math.random() * 100 < sk.freezeCh && !(m.boss && typeof BOSS_IMMUNE !== 'undefined' && BOSS_IMMUNE.includes('freeze'))) {
                    m.st = m.st || newMobStatus(); m.st.freeze = Math.max(m.st.freeze || 0, 40); _fz = true;
                }
                texts.push(`<span class="${getMobColor(m.lv)}">${m.n}</span> ${dmg}${_fz ? '<span class="text-sky-300 font-bold">（冰凍！）</span>' : ''}`);
                if (sk.drainHalf) { let heal = Math.floor(dmg / 2); if (heal > 0) p.hp = Math.min(petMhpEff(p), p.hp + heal); }
            });
            logCombat(`寵物 [${p.form}] 施放 <span class="text-pink-300 font-bold">${sk.n}</span> → ${texts.join('、')}${sk.drainHalf ? '（吸收傷害一半 HP）' : ''}`, 'player-special');
            targets.forEach(m => _petAfterDamage(m));
        }
    } catch (e) {}
    if (_snap && typeof _dpsDealt === 'function') { let _dd = _dpsDealt(_snap); if (_dd > 0) _dps.pet += _dd; }
    _combatSrc = null;
    return true;
}
function _petAfterDamage(m) {
    if (m.curHp <= 0) { let idx = mapState.mobs.findIndex(x => x && x.uid === m.uid); if (idx !== -1) killMob(idx); }
    else { try { renderMobs(); } catch (e) {} }
}
// 🦎 v3.6.43 災厄蜥蜴「堅硬」buff：生效中傷害減免 +dr（物理/魔法兩掛點皆吃·runtime 欄位不入桶）
function petHardenDr(p) { return (p && p._hardenUntil && (state.ticks || 0) < p._hardenUntil) ? (p._hardenDr || 10) : 0; }
// 怪物一般攻擊打寵物（js/04 enemyAttackChooseVictim 掛點）
function enemyAttackPet(mob, p) {
    if (!mob || mob.curHp <= 0 || !p || p._downed || (p.hp || 0) <= 0) return;
    if (typeof _mobAnimTrigger === 'function') _mobAnimTrigger(mob, 'attack');
    mob._facePartyKey = null; delete mob._faceTgt;   // 面向寵物暫不支援（寵物位置動態）→ 用預設
    let d = petDerive(p); if (!d) return;
    // ER 迴避
    if (roll(1, 100) <= effResistPct(d.er)) { logCombat(`寵物 <span class="text-sky-300 font-bold">${p.form}</span> 迴避了 <span class="${getMobColor(mob.lv)}">${mob.n}</span> 的攻擊。`, 'evade', 'enemy'); return; }
    let st = mob.st || newMobStatus();
    if (st.terror > 0 && Math.random() < 0.90) return;
    let mobHitBonus = (mob.hit || 0) - (st.blindVal || 0) - (st.weaken > 0 ? 2 : 0) - (st.disease > 0 ? 4 : 0) + tamerAuraHit(mob);
    let _pst = p._statuses || {};
    let hv = stretchHitValue(mob.lv + mobHitBonus - (p.lv || 1) + (d.ac - (typeof teamAcBonus === 'function' ? teamAcBonus(p, true) : 0)) + (_pst.disease > 0 ? 8 : 0));
    let r = roll(1, 20), hit = false, heavy = false;
    if (r === 20) { hit = true; heavy = true; } else if (r !== 1 && hv >= r) hit = true;
    if (!hit) { logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 對寵物 <span class="text-sky-300 font-bold">${p.form}</span> 的攻擊未命中。`, 'miss', 'enemy'); return; }
    let dc = (mob.dmg && mob.dmg[0]) || 1, ds = (mob.dmg && mob.dmg[1]) || 1;
    let dmg = (heavy ? dc * ds : roll(dc, ds)) + ((mob.db || 0) - (st.weaken > 0 ? 4 : 0) - (st.broken > 0 ? 2 : 0));
    if (mob._sherine) dmg = Math.floor(dmg * (mob._sherineMad ? 3 : 2));
    if (mob._grace) dmg = Math.floor(dmg * 1.5);
    dmg -= (d.dr || 0) + petRandomPhysicalDr(p, d) + petHardenDr(p);
    dmg = Math.floor(Math.max(1, dmg) * (typeof teamDmgReduceMult === 'function' ? teamDmgReduceMult(true) : 1) * petMasteryTakenMult() * petArmorDmgReduceMult(p));   // 👑 夥伴精通：受到傷害 −50%；🏺 寵物專用盔甲：受傷 ×(1−petDmgReduce)
    dmg = Math.max(1, Math.floor(dmg * riftDamageMult()));
    if (petDevotionGuardOn(p)) dmg = 0;   // 🏺 v3.6.44 珍愛夥伴的執念：復活後 8 秒受到傷害 −100%
    p.hp -= dmg;
    _petAnimAct(p, 'hurt');
    if (!p._stunCycle) { p._atkCd = (p._atkCd || 0) + d.stunTicks; p._stunCycle = true; }   // 硬直：延後下次攻擊
    logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 攻擊寵物 <span class="text-sky-300 font-bold">${p.form}</span>，造成 ${dmg} 點傷害。`, 'enemy-attack', 'enemy');
    if (p.hp <= 0) {
        _petDown(p);
    }
    petMarkDirty();
}
function applyMobMagicToPet(mob, sk, p) {
    if (!mob || mob.curHp <= 0 || !sk || !p || p._downed || (p.hp || 0) <= 0) return;
    let d = petDerive(p); if (!d) return;
    let st = p._statuses || (p._statuses = newMobStatus());
    let mr = d.mr || 0, nm = '寵物·' + p.form;
    let shMul = (mob._sherine ? (mob._sherineMad ? 3 : 2) : 1) * (mob._grace ? 2 : 1);
    let chance = (base, src) => Math.random() * 100 < Math.max(0, (((src && src.pbase) !== undefined ? src.pbase : (sk.pbase !== undefined ? sk.pbase : base)) - mr) / 2);
    let applyPure = (type, dur, label, base) => { if (chance(base)) { st[type] = Math.max(st[type] || 0, dur); logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，${nm}${label}！`, 'enemy'); } };
    if (sk.type === 'stone') { applyPure('stone', 60, '被石化了', 100); return; }
    if (sk.type === 'paralyze') { applyPure('paralyze', 60, '被麻痺了', 50); return; }
    if (sk.type === 'silence') { applyPure('silence', 60, '被沉默了', 60); return; }
    if (sk.type === 'magicseal') { applyPure('magicseal', 60, '的魔法被封印了', 100); return; }
    if (sk.type === 'freeze') { applyPure('freeze', 60, '被冰凍了', 200); return; }
    if (sk.type === 'sleep') { applyPure('sleep', (sk.dur || 6) * 10, '陷入沉睡', 150); return; }
    if (sk.type === 'stun') { applyPure('stun', 60, '被暈眩了', 150); return; }
    if (sk.type === 'slowatk') { applyPure('slowAtk', (sk.dur || 8) * 10, '的攻擊速度大幅減慢', 150); return; }
    if (sk.type === 'weaken') { applyPure('weaken', (sk.dur || 15) * 10, '陷入弱化', 150); return; }
    if (sk.type === 'disease') { applyPure('disease', (sk.dur || 20) * 10, '陷入疾病', 150); return; }
    if (sk.type === 'potionfrost') { applyPure('potionFrost', (sk.dur || 8) * 10, '陷入藥水霜化', 150); return; }
    if (sk.type === 'foulwater') { st.foulWater = Math.max(st.foulWater || 0, (sk.dur || 8) * 10); logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '汙濁之水'}，${nm} 陷入汙濁之水！（受到的治癒效果減半·持續 ${sk.dur || 8} 秒）`, 'enemy'); return; }   // 🌊 v3.6.20 必中（規格無機率項·不走 applyPure 的 pbase 判定）
    if (sk.type === 'frost_breath') { applyPure('slowAtk', (sk.dur || 8) * 10, '的攻擊速度大幅減慢', 200); return; }
    if (sk.type === 'scald') { if (chance(200)) { st.scald=(sk.dur||15)*10; st.scaldDmg=shMul*(sk.d||100); st.scaldTick=(sk.tick||3)*10; } return; }
    if (sk.type === 'poison') { if (chance(100)) { st.poison=(sk.dur||6)*10; st.poisonDmg=shMul*(sk.d||1); st.poisonTick=(sk.tick||1)*10; } return; }
    if (sk.type === 'burn') { st.burn=(sk.dur||6)*10; st.burnDmg=shMul*(sk.d||1); st.burnTick=(sk.tick||1)*10; return; }
    if (sk.type === 'bleed') { if (chance(200)) { st.bleed=(sk.dur||6)*10; st.bleedDmg=shMul*(sk.d||1); st.bleedTick=(sk.tick||1)*10; } return; }
    if (!sk.dmg) return;
    let baseM = roll(sk.dmg[0], sk.dmg[1]);
    let extra = (sk.db || 0) + (sk.dbLv ? (mob.lv || 0) * (sk.dbLvMult || 1) : 0);
    let dmg = sk.fixedDmg ? (baseM + extra) : (Math.floor((baseM + extra) * mrMult(mr)) - (d.dr || 0) - petHardenDr(p));
    if (st.freeze > 0 && sk.ext_freeze) { dmg += sk.ext_freeze; if (sk.extUnfreeze) st.freeze = 0; }
    dmg = Math.max(1, Math.floor(Math.max(1, dmg * shMul) * (typeof teamDmgReduceMult === 'function' ? teamDmgReduceMult(true) : 1) * petMasteryTakenMult() * petArmorDmgReduceMult(p)));   // 👑 夥伴精通：受到傷害 −50%；🏺 寵物專用盔甲：受傷 ×(1−petDmgReduce)
    dmg = Math.max(1, Math.floor(dmg * riftDamageMult()));
    if (petDevotionGuardOn(p)) dmg = 0;   // 🏺 v3.6.44 珍愛夥伴的執念：復活後 8 秒受到傷害 −100%（魔法亦免）
    p.hp -= dmg; _petAnimAct(p, 'hurt');
    if (!p._stunCycle) { p._atkCd = (p._atkCd || 0) + d.stunTicks; p._stunCycle = true; }
    logCombat(`<span class="${getMobColor(mob.lv)}">${mob.n}</span> 施放${sk.skn || '魔法'}，對 ${nm} 造成 ${dmg} 點魔法傷害。`, 'enemy');
    if (sk.vamp || sk.vampFull) { let heal = sk.vampFull ? dmg : roll(sk.vamp[0], sk.vamp[1]); mob.curHp = Math.min(mob.hp, mob.curHp + heal); }
    if (sk.sec) {
        let s = sk.sec;
        if (s.type === 'blind' && chance(200, s)) st.blind = (s.dur || 15) * 10;
        else if (s.type === 'freeze' && chance(200, s)) st.freeze = (s.dur || 6) * 10;
        else if (s.type === 'stun' && chance(150, s)) st.stun = (s.dur || 6) * 10;
        else if (s.type === 'sleep' && chance(150, s)) st.sleep = (s.dur || 6) * 10;
        else if (s.type === 'paralyze' && chance(50, s)) st.paralyze = (s.dur || 6) * 10;
        else if (s.type === 'burn' && chance(100, s)) { st.burn=(s.dur||6)*10; st.burnDmg=shMul*(s.d||1); st.burnTick=(s.tick||1)*10; }
        else if (s.type === 'scald' && chance(200, s)) { st.scald=(s.dur||6)*10; st.scaldDmg=shMul*(s.d||1); st.scaldTick=(s.tick||1)*10; }
        else if (s.type === 'bleed' && chance(200, s)) { st.bleed=(s.dur||6)*10; st.bleedDmg=shMul*(s.d||1); st.bleedTick=(s.tick||1)*10; }
        else if (s.type === 'poison' && chance(100, s)) { st.poison=(s.dur||6)*10; st.poisonDmg=shMul*(s.d||1); st.poisonTick=(s.tick||1)*10; }
    }
    if (p.hp <= 0) _petDown(p);
    petMarkDirty();
}
function petTryPotion(p) {   // HP<X% 用治癒藥水（邏輯同傭兵 allyTryPotion：喝「隊長設定的藥水」·缺貨且勾自動購買→補到100瓶）
    if (typeof pvpArenaPotionBlocked === 'function' && pvpArenaPotionBlocked()) return;   // 🚫 v3.7.17 決鬥中禁治癒藥水（⚠️寵物不像傭兵會被移到場邊·決鬥時仍在場上→這道閘是真的會擋到東西的那一個）
    if (!(p.potPct > 0) || p._downed) return;
    if ((p._potCd || 0) > 0) { p._potCd--; return; }
    if (p.hp <= 0 || p.hp > petMhpEff(p) * (p.potPct / 100)) return;
    let potSel = (typeof document !== 'undefined') ? document.getElementById('set-pot') : null;
    let potId = potSel ? potSel.value : 'potion_heal';
    let pdef = DB.items[potId];
    if (!pdef || pdef.val == null) return;   // 只認固定 val 的治癒藥水（紅/橙/白）
    let stack = player.inv && player.inv.find(i => i.id === potId && (i.cnt || 0) > 0);
    if (!stack) {
        let _buyChk = (typeof document !== 'undefined') ? document.getElementById('set-auto-buy-pot') : null;
        if (!_buyChk || !_buyChk.checked) return;
        let _unit = (typeof shopPrice === 'function') ? shopPrice(pdef.p || 0) : (pdef.p || 0);
        let _need = 100;
        if ((player.gold || 0) < _need * _unit) return;
        player.gold -= _need * _unit;
        gainItem(potId, _need, true, true);
        logSys(`自動消耗 ${_need * _unit} 金幣購買了 ${_need} 瓶${pdef.n}（供寵物飲用）。`);
        stack = player.inv.find(i => i.id === potId && (i.cnt || 0) > 0);
        if (!stack) return;
    }
    stack.cnt--; if (stack.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== stack.uid);   // 🛡️ v3.2.42 稽核修：只移除喝空的那疊（原全背包 filter 會誤刪 cnt 為 undefined 的舊物品）
    let h = Math.max(1, Math.floor(potionHealBase(pdef) * (1 + getConPotionPct((player.d && player.d.con) || 0) / 100)));
    if (p._statuses && p._statuses.potionFrost > 0) h = Math.max(1, Math.floor(h * 0.5));   // 🌅 藥水霜化：寵物也以自己的 MR/狀態判定，不再借用主角色結果
    if (p._statuses && p._statuses.foulWater > 0) h = Math.max(1, Math.floor(h * 0.5));   // 🌊 v3.6.20 汙濁之水：治癒藥水也減半
    p.hp = Math.min(petMhpEff(p), p.hp + h);
    p._potCd = 10;
    logCombat(`寵物 <span class="text-emerald-300 font-bold">${p.form}</span> 飲用 ${pdef.n}，恢復 ${h} 點 HP。`, 'heal');
    petMarkDirty();
}
function _petReviveDone(p, via) {
    p._downed = false; p._reviveCd = 0;
    p.hp = Math.max(1, Math.floor(petMhpEff(p) * 0.5)); p.mp = p.mmp + (((typeof petDerive === 'function' && petDerive(p)) || {}).mmpBonus || 0);   // 🦴 v3.2.42 稽核修：復活 MP 補到含防具精神加成的有效上限（與 petsTick _mmpEff 一致）
    p._animAct = null; p._statuses = newMobStatus();
    logCombat(`<span class="text-green-300 font-bold">寵物 ${p.form} 復活了！</span>（${via}）`, 'heal');
    petDevotionGrant(p);   // 🏺 v3.6.44 珍愛夥伴的執念：復活後 8 秒受傷 −100%＋額外傷害 +8
    petMarkDirty();
    try { renderSquadPanel(); } catch (e) {}
}
// 🏺 v3.6.44 珍愛夥伴的執念（relic_pet_devotion·項鍊）：寵物復活後 8 秒——受到傷害 −100%（物理/魔法皆免）＋一般攻擊額外傷害 +8（runtime 欄位不入桶）
function petDevotionGrant(p) {
    if (!(player && player.eq && player.eq.amulet && (DB.items[player.eq.amulet.id] || {}).petReviveBuff)) return;
    p._reviveGuardUntil = ((typeof state !== 'undefined' && state.ticks) || 0) + 80;
    logCombat(`<span class="font-bold text-pink-300">【珍愛夥伴的執念】</span>守護 ${p.form}：8 秒內受到傷害 −100%、額外傷害 +8。`, 'player-special');
}
function petDevotionGuardOn(p) { return !!(p && (p._reviveGuardUntil || 0) > (((typeof state !== 'undefined' && state.ticks) || 0))); }
// 🐾 v3.6.29 回村/回城（js/11 changeMap 村莊分支呼叫·比照傭兵 reviveDownedMercsAtTown）：
//    出戰寵物倒地者免費復活＋全體補滿 HP/MP（MP 含防具精神加成的有效上限·同 petsTick _mmpEff）＋清異常狀態。
//    petsOutList 已依目前角色過濾——他角色出戰中的寵物不動（多分頁共用桶慣例）。
function petsReviveAtTown() {
    let outs = (typeof petsOutList === 'function') ? petsOutList() : [];
    if (!outs.length) return;
    let n = 0;
    outs.forEach(p => {
        if (p._downed) { p._downed = false; p._reviveCd = 0; p._animAct = null; n++; petDevotionGrant(p); }   // 🏺 v3.6.44 回村復活亦觸發珍愛夥伴 buff
        p.hp = petMhpEff(p);   // 🏺 v3.7.20 回村補滿含 petHpAll 光環
        p.mp = (p.mmp || 0) + (((typeof petDerive === 'function' && petDerive(p)) || {}).mmpBonus || 0);
        p._statuses = newMobStatus();
    });
    petMarkDirty();
    if (n) { try { logCombat(`<span class="text-green-300 font-bold">回到安全區，${n} 隻倒下的寵物已恢復。</span>`, 'heal'); } catch (e) {} }
    try { renderSquadPanel(); } catch (e) {}
}
function petRevive(uidv, method) {   // 隊伍面板按鈕：rez=返生術（立即·耗玩家MP）/ scroll=復活卷軸（需滿 5 秒·_petDown 設 _reviveCd=50 tick）
    let p = _petFind(uidv); if (!p || !p._downed) return;
    if (method === 'rez') {
        if (!(player.skills || []).includes('sk_resurrection')) { logSys('<span class="text-red-400">你尚未習得 返生術。</span>'); return; }
        // 🪄 v3.5.88 修：原呼叫不存在的裸函式 getMpCost(技能物件)→typeof 守衛永遠不成立→固定收硬編 50，
        //    耗魔加成/折扣（mpReduce／學徒5 MP<30% 減半／fullHpMpHalf 滿血減半／魔力精通 ×2）全失效，
        //    且與 js/06 傭兵返生（allyRevive）同技能兩套價錢。改用全專案慣例 player.d.getMpCost(mp, tier)。
        let _rk = DB.skills.sk_resurrection;
        let cost = (player.d && typeof player.d.getMpCost === 'function' && _rk) ? player.d.getMpCost(_rk.mp, _rk.tier) : 50;
        if (player.mp < cost) { logSys('<span class="text-red-400">MP 不足，無法施放返生術。</span>'); return; }
        player.mp -= cost;
        _petReviveDone(p, '返生術');
    } else {
        if ((p._reviveCd || 0) > 0) { logSys(`<span class="text-red-400">復活卷軸尚需 ${Math.ceil(p._reviveCd / 10)} 秒才能對 ${p.form} 生效。</span>`); return; }
        let sc = player.inv.find(i => i.id === 'scroll_revive' && (i.cnt || 0) > 0);
        if (!sc) { logSys('<span class="text-red-400">身上沒有復活卷軸。</span>'); return; }
        sc.cnt--; if (sc.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== sc.uid);
        _petReviveDone(p, '復活卷軸');
    }
}

// ---------- 八、包武 寵物保管 UI（傭兵公會式介面）----------
function _petStorageScrollState(div) {
    if (!div || !div.querySelector || !div.querySelector('[data-petui]')) return { host: 0, list: 0 };
    let list = div && div.querySelector ? div.querySelector('[data-pet-storage-list]') : null;
    return {
        host: div && Number.isFinite(div.scrollTop) ? div.scrollTop : 0,
        list: list && Number.isFinite(list.scrollTop) ? list.scrollTop : 0
    };
}
function _petStorageRestoreScroll(div, pos) {
    if (!div || !pos) return;
    let apply = function () {
        try {
            div.scrollTop = pos.host || 0;
            let list = div.querySelector ? div.querySelector('[data-pet-storage-list]') : null;
            if (list) list.scrollTop = Math.min(pos.list || 0, Math.max(0, list.scrollHeight - list.clientHeight));
        } catch (e) {}
    };
    apply();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(apply);
}
function renderPetStorageNPC(div, confirmUid) {
    // 🏘️ v3.7.7 保管人不只一位（亞丁 包武／古魯丁 奧斯丁·同一個保管桶）→ 台詞取當前互動視窗的 NPC 名，不再寫死
    let hostName = ((document.getElementById('interaction-npc-name') || {}).innerText || '').trim() || '包武';
    let scrollState = _petStorageScrollState(div);
    let list = petRoster();
    let cha = (player.d && player.d.cha) || 0;
    let rows = list.map(p => {
        let def = PET_BOOK[p.form] || {};
        let d = petDerive(p) || {};
        let cb = petCharmCombatBonus();
        let need = def.cha || 6;
        let _evoOpts = petEvoOptions(p);   // 🐉 v3.2.63 一般型態才可進化（進化果實→高等／勝利果實→黃金龍）
        let canEvo = _evoOpts.length > 0;
        let _evoTip = _evoOpts.map(o => (DB.items[o.fruitId] ? DB.items[o.fruitId].n : o.fruitId) + '→' + o.target).join('　或　');
        let thumb = 'assets/anim/' + encodeURIComponent(p.form) + '/d6/idle_0.png';
        let expPct = Math.min(100, Math.floor((p.exp || 0) / petExpReq(p.lv) * 100));
        let isOut = !!_petCurrentOwnerKey() && String(p.outOwner || '') === _petCurrentOwnerKey();
        let otherOut = !!_petOutStateKey(p) && !isOut;
        if (confirmUid === p.uid && !p.locked) {
            return `<div class="flex items-center justify-between gap-2 bg-red-950/60 border border-red-700 rounded px-2 py-2 text-sm">
                <span class="text-red-300 font-bold">確定要放生 ${petDisplayName(p)}（Lv.${p.lv}）嗎？放生後將永遠消失！</span>
                <span class="flex gap-2 shrink-0">
                    <button onclick="petReleaseConfirm('${p.uid}',true)" class="btn px-3 py-1 text-xs font-bold" style="background:linear-gradient(135deg,#7f1d1d,#b91c1c);color:#fecaca;border-color:#dc2626;">確定放生</button>
                    <button onclick="petReleaseConfirm('${p.uid}',false)" class="btn px-3 py-1 text-xs font-bold">取消</button>
                </span>
            </div>`;
        }
        return `<div class="flex items-center gap-2 bg-slate-800 border ${isOut ? 'border-emerald-600' : 'border-slate-600'} rounded px-2 py-1.5 text-sm"${otherOut ? ' style="opacity:.5;filter:grayscale(.9);" title="其他角色出戰中，無法選取——請由原角色收回"' : ''}>
            <button type="button" onclick="petToggleLock('${p.uid}')" ${otherOut ? 'disabled' : ''} class="btn shrink-0" style="width:24px;height:30px;padding:0;display:flex;align-items:center;justify-content:center;font-size:14px;background:${p.locked ? 'linear-gradient(135deg,#713f12,#a16207)' : '#1e293b'};border-color:${p.locked ? '#eab308' : '#475569'};color:${p.locked ? '#fef3c7' : '#94a3b8'};${otherOut ? 'opacity:.4;' : ''}" title="${otherOut ? '其他角色出戰中，無法修改' : (p.locked ? '解除鎖定' : '鎖定寵物並隱藏放生選項')}" aria-label="${p.locked ? '解除鎖定' : '鎖定寵物'}">${p.locked ? '🔒' : '🔓'}</button>
            <span class="shrink-0" style="width:44px;height:40px;display:flex;align-items:center;justify-content:center;overflow:hidden;"><img src="${thumb}" alt="" style="max-width:44px;max-height:40px;image-rendering:pixelated;" onerror="this.style.display='none'"></span>
            <span class="flex-1 min-w-0">
                <span class="font-bold ${isOut ? 'text-emerald-300' : 'text-white'}">${p.form}</span>
                <span class="text-amber-300"> Lv.${p.lv}</span>
                <span class="text-slate-400 text-xs">（${PET_KIND_LABEL[def.kind] || ''}·魅力${need}${isOut ? '·本角色出戰中' : (otherOut ? '·其他角色出戰中' : '')}）</span><br>
                <span class="text-xs text-slate-300">HP ${p.hp}/${p.mhp}　MP ${p.mp}/${p.mmp + (d.mmpBonus || 0)}　EXP ${expPct}%　攻1D${Math.max(1, Math.round(d.dice * (d.damageMult || 1) * (d.attackMult || 1)))}+${Math.round((d.flat + cb.dmg) * (d.damageMult || 1) * (d.attackMult || 1))} 命中${d.hit + cb.hit} AC${d.ac} 減免${d.dr} ER${d.er} MR${d.mr}</span>
            </span>
            <span class="flex gap-1 shrink-0 flex-wrap justify-end" style="max-width:210px">
                ${!otherOut && canEvo && p.lv >= 30 ? `<button onclick="petEvolve('${p.uid}')" class="btn px-2 py-1 text-xs font-bold" style="background:linear-gradient(135deg,#713f12,#ca8a04);color:#fef9c3;border-color:#eab308;" title="進化：${_evoTip}（兩種果實都有可選擇）">進化</button>` : ''}
                <button onclick="petGearOpen('${p.uid}','wpn')" ${otherOut ? 'disabled' : ''} class="btn px-2 py-1 text-xs font-bold" style="border-color:${p.eq && p.eq.wpn ? '#f59e0b' : '#475569'};color:${p.eq && p.eq.wpn ? '#fcd34d' : '#94a3b8'};${otherOut ? 'opacity:.4;' : ''}" title="${p.eq && p.eq.wpn && DB.items[p.eq.wpn.id] ? DB.items[p.eq.wpn.id].n + ((p.eq.wpn.en || 0) > 0 ? '+' + p.eq.wpn.en : '') : '未裝備寵物武器'}">武器</button>
                <button onclick="petGearOpen('${p.uid}','arm')" ${otherOut ? 'disabled' : ''} class="btn px-2 py-1 text-xs font-bold" style="border-color:${p.eq && p.eq.arm ? '#f59e0b' : '#475569'};color:${p.eq && p.eq.arm ? '#fcd34d' : '#94a3b8'};${otherOut ? 'opacity:.4;' : ''}" title="${p.eq && p.eq.arm && DB.items[p.eq.arm.id] ? DB.items[p.eq.arm.id].n + ((p.eq.arm.en || 0) > 0 ? '+' + p.eq.arm.en : '') : '未裝備寵物防具'}">防具</button>
                <button onclick="petDeployToggle('${p.uid}')" ${otherOut ? 'disabled' : ''} class="btn px-2 py-1 text-xs font-bold" style="background:linear-gradient(135deg,${isOut ? '#374151,#4b5563' : (otherOut ? '#334155,#475569' : '#065f46,#059669')});color:${isOut ? '#e5e7eb' : (otherOut ? '#94a3b8' : '#a7f3d0')};border-color:${isOut ? '#6b7280' : (otherOut ? '#64748b' : '#10b981')};${otherOut ? 'opacity:.65;' : ''}">${isOut ? '收回' : (otherOut ? '使用中' : '出戰')}</button>
                ${otherOut || p.locked ? '' : `<button onclick="petRelease('${p.uid}')" class="btn px-2 py-1 text-xs font-bold" style="background:linear-gradient(135deg,#7f1d1d,#991b1b);color:#fecaca;border-color:#b91c1c;">放生</button>`}
            </span>
        </div>`;
    }).join('');
    let evoCnt = player.inv.filter(i => i.id === 'item_evo_fruit').reduce((s, i) => s + (i.cnt || 0), 0);
    let vicCnt = player.inv.filter(i => i.id === 'item_victory_fruit').reduce((s, i) => s + (i.cnt || 0), 0);
    div.innerHTML = `
    <div class="flex flex-col gap-3 p-1" data-petui="1">
        <div class="text-slate-300 text-sm leading-relaxed">${hostName}：我幫你照顧捕獲的寵物。<b class="text-amber-300">最多保管 ${PET_STORAGE_MAX} 隻，同一模式的角色共通</b>。其他角色出戰中的寵物會顯示「使用中」，<b class="text-amber-200">必須先由原角色收回，不能直接轉移</b>。使用誘捕道具後擊殺對應的動物即可捕獲；點「出戰」讓寵物加入隊伍（最多 ${PET_CARRY_MAX} 隻·依寵物需求消耗魅力）。<b class="text-amber-300">只有「一般型態」的寵物（Lv30 以上）可進化，且有兩條路</b>：用「進化果實」→對應的高等型態，或用「勝利果實」→黃金龍；兩種果實都帶在身上時，進化前可自行選擇要走哪條路。高等型態與黃金龍都是最終型態、不會再進化——身上沒有果實可是不能進化的喔。</div>
        <div class="flex items-center gap-4 bg-slate-800/60 border border-slate-600 rounded p-3 text-sm flex-wrap">
            <span>保管：<span class="text-amber-300 font-bold">${list.length}/${PET_STORAGE_MAX}</span></span>
            <span>出戰：<span class="text-emerald-300 font-bold">${petsOutList().length}/${PET_CARRY_MAX}</span></span>
            <span>魅力：<span class="${petChaUsed() > cha ? 'text-red-400' : 'text-green-400'} font-bold">${petChaUsed()}/${cha}</span></span>
            <span>進化果實×<span class="text-amber-300 font-bold">${evoCnt}</span>　勝利果實×<span class="text-amber-300 font-bold">${vicCnt}</span></span>
        </div>
        <div class="flex flex-col gap-1 overflow-y-auto pr-1" data-pet-storage-list="1" style="max-height:380px">${rows || '<div class="text-slate-500 text-sm text-center py-6">保管箱空空如也——去使用誘捕道具捕捉寵物吧！</div>'}</div>
    </div>`;
    _petStorageRestoreScroll(div, scrollState);
}

// ---------- 九、隊伍清單（renderSquadPanel 掛點：傭兵卡下方）----------
function renderPetTeamHTML() {
    let outs = petsOutList();
    if (!outs.length) return '';
    return outs.map(p => {
        let _mmpEff = p.mmp + (((typeof petDerive === 'function' && petDerive(p)) || {}).mmpBonus || 0);   // 🦴 v3.2.42 稽核修：MP 條/浮標含防具精神加成（原本米索莉寵顯示 35/30 爆表）
        let _mhpE = petMhpEff(p); let hpPct = Math.max(0, Math.min(100, Math.floor(p.hp / Math.max(1, _mhpE) * 100)));
        let mpPct = Math.max(0, Math.min(100, Math.floor(p.mp / Math.max(1, _mmpEff) * 100)));
        let expPct = Math.min(100, Math.floor((p.exp || 0) / petExpReq(p.lv) * 100));
        let thumb = 'assets/anim/' + encodeURIComponent(p.form) + '/d6/idle_0.png';
        // 🐾 v3.2.33 高度減半（用戶指示·樣式/元素不變）：縮圖 36×32→26×22、內距/條高/字級/間距減半（用 inline style 避開預編譯 Tailwind 任意值缺漏）
        if (p._downed) {
            return `<div class="bg-slate-800/80 border border-red-800 rounded text-xs flex items-center gap-2" style="padding:3px 6px;">
                <img src="${thumb}" alt="" style="width:26px;height:22px;object-fit:contain;image-rendering:pixelated;filter:grayscale(1);" onerror="this.style.display='none'">
                <span class="flex-1" style="font-size:10px;line-height:1.3;"><span class="text-red-400 font-bold">🐾 ${p.form}</span> <span class="text-slate-400">Lv.${p.lv}·倒地</span><br>
                <span class="text-slate-400">${(p._reviveCd || 0) > 0 ? `卷軸復活倒數 ${Math.ceil(p._reviveCd / 10)} 秒` : '可用卷軸復活'}</span></span>
                <span class="flex gap-1">
                    <button onclick="petRevive('${p.uid}','rez')" class="btn font-bold" style="padding:0 6px;font-size:10px;height:18px;background:linear-gradient(135deg,#065f46,#059669);color:#a7f3d0;border-color:#10b981;">返生術</button>
                    <button onclick="petRevive('${p.uid}','scroll')" class="btn font-bold" style="padding:0 6px;font-size:10px;height:18px;">卷軸</button>
                </span>
            </div>`;
        }
        return `<div class="bg-slate-800/80 border border-slate-600 rounded text-xs" style="padding:3px 6px;">
            <div class="flex items-center gap-2">
                <img src="${thumb}" alt="" style="width:26px;height:22px;object-fit:contain;image-rendering:pixelated;" onerror="this.style.display='none'">
                <span class="flex-1 min-w-0" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><span class="text-emerald-300 font-bold">🐾 ${p.form}</span> <span class="text-amber-300">Lv.${p.lv}</span> <span class="text-slate-400" style="font-size:10px;">EXP ${expPct}%</span></span>
                <span class="text-slate-400 whitespace-nowrap" style="font-size:10px;">HP&lt;<input type="number" min="0" max="95" value="${p.potPct || 0}" onchange="petSetPotPct('${p.uid}',this.value)" class="w-11 bg-slate-900 border border-slate-600 rounded px-1 text-center" style="font-size:10px;height:16px;padding-top:0;padding-bottom:0;">%喝水</span>
            </div>
            <div class="compact-dual-vitals" style="margin-top:2px;">
                <div class="bar-bg compact-team-bar" title="HP ${p.hp}/${_mhpE}"><div class="bar-fill" style="width:${hpPct}%;background:linear-gradient(90deg,#dc2626,#f87171);"></div><div class="bar-text text-white">${p.hp}/${_mhpE}</div></div>
                <div class="bar-bg compact-team-bar" title="MP ${p.mp}/${_mmpEff}"><div class="bar-fill" style="width:${mpPct}%;background:linear-gradient(90deg,#2563eb,#60a5fa);"></div><div class="bar-text text-white">${p.mp}/${_mmpEff}</div></div>
            </div>
        </div>`;
    }).join('');
}

// ---------- 十、狩獵區渲染（八方向閒晃＋朝向攻擊·獨立時鐘·不動 js/09）----------
let _pet8Cache = {};   // '<form>#<dir>' → {walk,idle,attack,skill,hurt,death, shadow:{...}} | 'probing' | null
const PET_ANIM_FPS = 8, PET_ANIM_MAXF = 40;
function _pet8Probe(form, dir) {
    let key = form + '#' + dir;
    if (_pet8Cache[key] !== undefined) return;
    _pet8Cache[key] = 'probing';
    let folder = 'assets/anim/' + encodeURIComponent(form) + '/d' + dir + '/';
    let out = { shadow: {} };
    let acts = ['walk', 'idle', 'attack', 'skill', 'hurt', 'death'];
    let pending = acts.length * 2;
    let finish = () => { if (--pending > 0) return; _pet8Cache[key] = out.idle ? out : null; };
    let probeSeq = (target, k, pfx, minF) => {   // 🚀 v3.4.37 平行探測（滑動窗口·共用 js/09 _probeFramesWin）
        _probeFramesWin(i => folder + pfx + i + '.png', PET_ANIM_MAXF, minF || 2, frames => { target[k] = frames; finish(); });
    };
    acts.forEach(a => { probeSeq(out, a, a + '_', a === 'hurt' ? 1 : 2); probeSeq(out.shadow, a, a + '_s_', 1); });
}
function _petLayerHost() { return document.getElementById('battle-view') || document.getElementById('mob-list'); }   // ⚠️ 不能掛 #mob-list：renderMobs() 重寫其 innerHTML 會把圖層洗掉；#battle-view(.area-fit 800×242·relative·hidden) 穩定
function _petLayerEl() {
    let host = _petLayerHost(); if (!host) return null;
    let layer = document.getElementById('pet-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'pet-layer';
        layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;overflow:hidden;';
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        host.appendChild(layer);
    } else if (layer.parentNode !== host) { try { host.appendChild(layer); } catch (e) {} }
    return layer;
}
function _petSpriteEl(layer, p) {
    let el = layer.querySelector('[data-pet="' + p.uid + '"]');
    if (!el) {
        el = document.createElement('div');
        el.setAttribute('data-pet', p.uid);
        el.style.cssText = 'position:absolute;transform:translate(-50%,-100%);will-change:left,top;transition:left .14s linear,top .14s linear;';   // 🐾 v3.2.31 位置補間：位置每 125ms 更新一格，交給 CSS 在格間平滑內插（移動不再一頓一頓）
        let sh = document.createElement('img'); sh.className = 'pet-shadow'; sh.style.cssText = 'position:absolute;left:0;top:0;image-rendering:pixelated;';
        let im = document.createElement('img'); im.className = 'pet-body'; im.style.cssText = 'position:relative;image-rendering:pixelated;';
        el.appendChild(sh); el.appendChild(im);
        layer.appendChild(el);
    }
    return el;
}
function _petWanderStep(p, host, hostRect) {
    // 位置以 0..1 正規化（x 4%~96%·y 55%~95% 地面帶）
    if (p._px == null) { p._px = 0.15 + Math.random() * 0.5; p._py = 0.6 + Math.random() * 0.3; p._wt = 0; }
    let alive = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs.filter(m => m && m.curHp > 0) : [];
    let speed = 0.06 / PET_ANIM_FPS;   // 每幀移動量（約 5%/秒）
    if (alive.length && !p._downed) {
        // 交戰：走向目標怪（保持一小段距離）
        let tgt = alive.find(m => m.uid === p._faceMobUid) || alive[0];
        let r = (typeof _vfxSlotRect === 'function') ? _vfxSlotRect(tgt.uid) : null;
        let hr = hostRect || host.getBoundingClientRect();
        if (r && r.width && hr.width) {
            let tx = (r.left + r.width / 2 - hr.left) / hr.width, ty = Math.min(0.95, Math.max(0.55, (r.top + r.height * 0.9 - hr.top) / hr.height));
            let dx = tx - p._px, dy = ty - p._py, dist = Math.sqrt(dx * dx + dy * dy);
            let stop = 0.10;   // 靠近到 10% 距離就停下攻擊
            if (dist > stop) {
                p._px += dx / dist * speed * 1.6; p._py += dy / dist * speed * 1.6;
                p._dir = _vec2dir(dx * hr.width, dy * hr.height);
                p._moving = true;
            } else { p._moving = false; p._dir = _vec2dir(dx * hr.width, dy * hr.height); }
        } else p._moving = false;
    } else {
        // 閒晃：隨機遊走＋停留
        p._wt = (p._wt || 0) - 1;
        if (p._wt <= 0) {
            if (p._wx == null || Math.random() < 0.5) { p._wx = 0.05 + Math.random() * 0.9; p._wy = 0.55 + Math.random() * 0.4; p._wt = 30 + Math.floor(Math.random() * 50); }
            else { p._wx = null; p._wt = 15 + Math.floor(Math.random() * 40); }   // 原地休息
        }
        if (p._wx != null) {
            let dx = p._wx - p._px, dy = p._wy - p._py, dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0.015) {
                p._px += dx / dist * speed; p._py += dy / dist * speed;
                let hr = hostRect || host.getBoundingClientRect();
                p._dir = _vec2dir(dx * (hr.width || 800), dy * (hr.height || 242));
                p._moving = true;
            } else { p._wx = null; p._moving = false; }
        } else p._moving = false;
    }
    p._px = Math.max(0.03, Math.min(0.97, p._px)); p._py = Math.max(0.52, Math.min(0.97, p._py));
}
function _petAnimApply() {
    try {
        if (typeof document !== 'undefined' && document.hidden) return;
        let bv = document.getElementById('battle-view');
        let host = _petLayerHost();
        let layer = _petLayerEl();
        if (!host || !layer) return;
        let outs = (typeof player !== 'undefined' && player && player.cls) ? petsOutList() : [];
        if (typeof summonRenderList === 'function') outs = outs.concat(summonRenderList());   // 🧙 v3.2.19 召喚物 v2 共用寵物圖層（同欄位協定：uid/form/_px/_py/_dir/_animAct/_downed）
        if (typeof guardRenderList === 'function') outs = outs.concat(guardRenderList());   // 🏰 城堡護衛 v2 共用寵物圖層（同欄位協定·八方向 assets/anim/<form>/d<dir>）
        let show = _petInWild() && !(bv && bv.classList.contains('hidden'));
        // 清掉不在場的
        layer.querySelectorAll('[data-pet]').forEach(el => { if (!show || !outs.some(p => p.uid === el.getAttribute('data-pet'))) el.remove(); });
        if (!show) return;
        let hostRect = host.getBoundingClientRect();
        for (let p of outs) {
            if (!p._downed) _petWanderStep(p, host, hostRect);   // 倒地/死亡殘影不再移動（v3.2.19 修：原本倒地仍會閒晃漂移）
            let dir = (p._dir != null) ? p._dir : 6;
            let gfxForm = p.formGfx || p.form;   // 👑 v3.2.25 動態別名：顯示名≠圖檔資料夾（精靈王借用強力精靈圖·強力精靈改用一般精靈圖）
            let a = _pet8Cache[gfxForm + '#' + dir];
            if (a === undefined) _pet8Probe(gfxForm, dir);
            if (!a || a === 'probing') {
                let fb = (p._dirLoaded != null) ? p._dirLoaded : 6;
                a = _pet8Cache[gfxForm + '#' + fb];
                if (a === undefined) _pet8Probe(gfxForm, fb);
                if (!a || a === 'probing') continue;
            } else p._dirLoaded = dir;
            let el = _petSpriteEl(layer, p);
            el.style.left = (p._px * 100) + '%';
            el.style.top = (p._py * 100) + '%';
            // 動作選擇：倒地=death 末幀 hold；單次動作(attack/skill/hurt/death)播完回 walk/idle
            let act = null, f = 0;
            if (p._downed) {
                let seq = a.death;
                if (seq) { let ff = Math.floor((Date.now() - ((p._animAct && p._animAct.t) || 0)) / (1000 / PET_ANIM_FPS)); act = 'death'; f = Math.min(seq.length - 1, ff); }
            } else if (p._animAct) {
                let k = p._animAct.k, seq = a[k] || (k === 'skill' ? a.attack : null);
                if (seq) {
                    let ff = Math.floor((Date.now() - p._animAct.t) / (1000 / PET_ANIM_FPS));
                    if (ff < seq.length) { act = a[k] ? k : 'attack'; f = ff; } else p._animAct = null;
                } else p._animAct = null;
            }
            if (act === null) {
                let seq = (p._moving && a.walk) ? a.walk : a.idle;
                act = (p._moving && a.walk) ? 'walk' : 'idle';
                let ofs = 0; { let s = String(p.uid); for (let j = 0; j < s.length; j++) ofs += s.charCodeAt(j); }
                f = (Math.floor(Date.now() / (1000 / PET_ANIM_FPS)) + ofs) % seq.length;
            }
            let seq = a[act]; if (!seq || !seq[f]) continue;
            let im = el.querySelector('.pet-body'), sh = el.querySelector('.pet-shadow');
            if (im.src !== seq[f].src) im.src = seq[f].src;
            let sseq = a.shadow && a.shadow[act];
            if (sh) {
                if (sseq && sseq.length) { let sf = f < sseq.length ? f : f % sseq.length; if (sh.style.visibility === 'hidden') sh.style.visibility = ''; if (sh.src !== sseq[sf].src) sh.src = sseq[sf].src; }
                else if (sh.style.visibility !== 'hidden') sh.style.visibility = 'hidden';
            }
            if (p._downed && im.style.opacity !== '0.75') im.style.opacity = '0.75';
            else if (!p._downed && im.style.opacity) im.style.opacity = '';
        }
    } catch (e) {}
}
setInterval(() => { _petAnimApply(); }, 1000 / PET_ANIM_FPS);   // 🔌 加掛版補丁:間接呼叫讓外掛(省電模式)wrapper 攔得住;直接傳參照會被捕死原函式

// ---------- 十一、舊項圈系統存檔遷移（loadGame 掛點：js/13 呼叫 petMigrateLegacy）----------
const _PET_LEGACY_COLLARS = { 'new_item_184': '杜賓狗', 'new_item_185': '狼', 'new_item_collar_husky': '哈士奇', 'new_item_238': '牧羊犬', 'new_collar_rabbit': '暴走兔', 'new_collar_fox': '狐狸', 'new_collar_beagle': '小獵犬', 'new_collar_stbernard': '聖伯納犬' };
const _PET_LEGACY_REMOVE = ['new_item_143', 'new_item_142', 'new_fruit_rabbit', 'new_fruit_fox', 'new_fruit_beagle', 'new_fruit_stbernard'];   // 肉/哨子/舊進化果實
function petMigrateLegacy() {
    try {
        if (!player) return;
        // 🦴 v3.2.37 玩家「寵物裝備」欄移除：欄上的之牙退回背包（一次性遷移）
        if (player.eq && player.eq.pet) {
            let _pg = player.eq.pet;
            if (typeof _pg.cnt === 'undefined') _pg.cnt = 1;
            player.inv.push(_pg);
            player.eq.pet = null; delete player.eq.pet;
            logSys(`<span class="text-amber-200">寵物裝備改為每隻寵物個別穿戴：原「寵物裝備」欄上的 ${DB.items[_pg.id] ? DB.items[_pg.id].n : _pg.id}${(_pg.en || 0) > 0 ? '+' + _pg.en : ''} 已放回背包，請至寵物保管（亞丁 包武／古魯丁 奧斯丁）為寵物裝上。</span>`);
        }
        let converted = 0, lost = 0;
        let convert = (id, cnt) => {
            let form = _PET_LEGACY_COLLARS[id]; if (!form) return false;
            for (let i = 0; i < cnt; i++) {
                if (petRoster().length >= PET_STORAGE_MAX) { lost++; continue; }
                let inst = petNewInstance(form); if (inst) { petRoster().push(inst); converted++; }
            }
            return true;
        };
        // 背包舊項圈 → 新寵物；肉/哨子/舊果實 → 移除
        let dead = Object.keys(_PET_LEGACY_COLLARS).concat(_PET_LEGACY_REMOVE);
        (player.inv || []).forEach(i => { if (_PET_LEGACY_COLLARS[i.id]) convert(i.id, i.cnt || 1); });
        player.inv = (player.inv || []).filter(i => !dead.includes(i.id));
        // 舊 petStorage（項圈保管）→ 新寵物
        if (Array.isArray(player.petStorage)) {
            player.petStorage.forEach(s => { if (s && _PET_LEGACY_COLLARS[s.id]) convert(s.id, s.cnt || 1); });
            delete player.petStorage;
        }
        if (Array.isArray(player.partners) && player.partners.length) player.partners = [];
        if (player.buffs && player.buffs.taming) delete player.buffs.taming;   // 舊誘捕 buff 移除
        if (converted || lost) {
            petMarkDirty(); petRosterSave();
            logSys(`<span class="text-amber-300 font-bold">🐾 夥伴系統改版：</span>你的 ${converted} 個項圈已轉換為寵物並送往包武的寵物保管${lost ? `（保管已滿，${lost} 個項圈中的夥伴自行離去了）` : ''}。肉、哨子與舊版進化果實已停用回收。`);
        }
    } catch (e) { console.warn('petMigrateLegacy 失敗', e); }
}
