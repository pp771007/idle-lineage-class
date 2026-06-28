function gainItem(id, cnt=1, silent=false, forceNormal=false, affixOld=false) {
    // 🏛️ 傳統模式：任何來源都不產生施法卷軸（武器/盔甲/飾品＋祝福/詛咒變體）——掉落／黑市／歐西里斯寶箱／血盟入盟禮／兌換等全擋
    if (TRAD_NO_SCROLLS[id] && traditionalActive()) return null;
    // 卷軸變祝福／詛咒機率：各 1%（互斥）
    if (!forceNormal && (id === 'scroll_weapon' || id === 'scroll_armor')) {
        let _r = Math.random();
        if (_r < 0.01) id = id + '_b';        // 1% 變成祝福的
        else if (_r < 0.02) id = id + '_c';   // 1% 變成詛咒的
    }

    let d = DB.items[id];
    
    // 安全防護：若資料庫還沒設定 _b 祝福／_c 詛咒卷軸，退回給普通版
    if (!d) {
        id = id.replace('_b', '').replace('_c', '');
        d = DB.items[id];
    }

    // 🗡️ 裝備收集冊：獲得任何武器/防具/飾品(非箭矢)即登錄圖鑑（永久·只增不減）
    if (typeof registerEquipObtained === 'function') registerEquipObtained(id);

    // 🔧 持有上限 maxHold（如精靈的私語=10）：裁切本次獲得量使總持有不超過上限；已達上限則不獲得
    if (d && d.maxHold) {
        let _held = player.inv.reduce((s, i) => s + (i.id === id ? (i.cnt || 0) : 0), 0);
        if (_held >= d.maxHold) return null;
        if (_held + cnt > d.maxHold) cnt = d.maxHold - _held;
    }

    let bless = false;
    let anc = false;
    let attr = false;   
    
    if (!forceNormal && d && ((d.type === 'wpn' && !d.isArrow) || d.type === 'arm' || d.type === 'acc')) {
        // 詞綴：怪物掉落/製作走新制(單1%/雙0.1%/三0.01%)；潘朵拉/血盟(affixOld=true)沿用舊制(各1%)。箭矢不附加。
        let _af = affixOld ? rollAffixesOld() : rollAffixesNew();
        attr = _af.attr; bless = _af.bless; anc = _af.anc;
    }

    // 🔮 席琳套裝效果：指定部位（武器/頭盔/盔甲/手套/長靴/斗篷/腰帶）※項鍊已改為腰帶
    //  - 席琳的世界擊殺掉落：一般怪0.1%、恩賜怪0.5%、頭目5%（9 組均勻抽一；🔮 瘋狂的席琳世界再 ×3）
    //  - 席琳製作（_forceSherineSet）：必定附帶隨機一種
    let seteff = false;
    if (d) {
        let _slotOk = sherineSetEligible(d);
        if (_slotOk && _sherineLootCtx && Math.random() < (_sherineLootCtx.boss ? 0.05 : (_sherineLootCtx.grace ? 0.005 : 0.001)) * (_sherineLootCtx.mad ? 3 : 1)) {
            seteff = SHERINE_EFFECTS[Math.floor(Math.random() * SHERINE_EFFECTS.length)];
            logSys(`<span class="c-sherine font-bold">✦ 掉落的裝備蘊含著席琳的祝福：【${seteff}】！</span>`);
        }
        if (_slotOk && !seteff && _forceSherineSet) {
            seteff = SHERINE_EFFECTS[Math.floor(Math.random() * SHERINE_EFFECTS.length)];
            logSys(`<span class="c-sherine font-bold">✦ 席琳結晶引導出套裝效果：【${seteff}】！</span>`);
        }
    }

    // 🏛️ 傳統模式：掉落／黑市／製作的「裝備」隨機自帶強化值（_tradLootCtx 期間；商店 forceNormal=true 不設→恆 +0；箭矢/材料/消耗品不套）
    let _tEn = (_tradLootCtx && !forceNormal && d && !d.noEnhance && ((d.type === 'wpn' && !d.isArrow) || d.type === 'arm' || d.type === 'acc') && traditionalActive()) ? rollTraditionalEnhance(d) : 0;   // 🏛️ 無法強化的裝備（古老系列 noEnhance）恆 +0，不自帶強化值
    let _probe = { id: id, en: _tEn, bless: bless, anc: anc, attr: attr, seteff: seteff };
    let ex = _tEn > 0 ? null : player.inv.find(i => (i.en || 0) === 0 && sameItemSig(i, _probe));   // 🔧 架構#3：統一簽章比對（並容忍舊存檔 en 為 undefined）；🏛️ 自帶強化(en>0)獨立成堆、不併入 +0
    if(ex) ex.cnt += cnt;   // 不論是否鎖定都疊加；僅加數量、不更動既有堆疊的鎖定/廢品狀態
    else player.inv.push({ id: id, uid: uid(), cnt: cnt, en: _tEn, bless: bless, anc: anc, attr: attr, seteff: seteff, lock: false, junk: !!(player.junkPrefs && player.junkPrefs[itemSig(_probe)]) && !(d && d.noJunk) });   // 🔧 廢品記憶改以完整簽章比對：詞綴物品也可自動標記，但僅限「完全相同詞綴」者；🎴 noJunk(收集冊)永不自動標記

    // 紀錄這次產生的物品屬性
    let itemInfo = { id: id, cnt: cnt, en: _tEn, bless: bless, anc: anc, attr: attr, seteff: seteff };
    
    if (!silent && d) {
        logSys(`獲得物品: <span class="font-bold">${getItemFullName(itemInfo)}</span>`);
    }
    renderTabs();
    if(DB.items[id] && DB.items[id].grantSkills) { calcStats(); renderSkillSelects(); }   // 取得授予技能的頭盔：立即生效
    
    if(typeof auditTrackGain === 'function') auditTrackGain(itemInfo);   // 統計：掉落計數
    try { if (_vfxLootCtx && d && d.gachaWeight === 1 && typeof vfxRareDrop === 'function') vfxRareDrop(d.n); } catch(e){}   // ✨ VFX：潘朵拉權重=1 的稀有掉落金色閃光
    return itemInfo; // 👈 讓拉霸機可以讀取最終產生的物品
}

// ===== 屬性詞綴定義（12種，武器/防具/飾品皆可出現） =====
// fix = 武器固定傷害；counter = 武器對剋屬性怪物的額外固定傷害；ele = 武器轉變的屬性
// res = 防具/飾品對應元素抗性%；mr = 防具/飾品魔防
const ATTR_AFFIX = {
    fire1:  { n: '火之', ele: 'fire',  fix: 1, counter: 6,  res: 1, mr: 1 },
    water1: { n: '水之', ele: 'water', fix: 1, counter: 6,  res: 1, mr: 1 },
    wind1:  { n: '風之', ele: 'wind',  fix: 1, counter: 6,  res: 1, mr: 1 },
    earth1: { n: '地之', ele: 'earth', fix: 1, counter: 6,  res: 1, mr: 1 },
    fire3:  { n: '爆炎', ele: 'fire',  fix: 3, counter: 9,  res: 2, mr: 2 },
    water3: { n: '海嘯', ele: 'water', fix: 3, counter: 9,  res: 2, mr: 2 },
    wind3:  { n: '暴風', ele: 'wind',  fix: 3, counter: 9,  res: 2, mr: 2 },
    earth3: { n: '崩裂', ele: 'earth', fix: 3, counter: 9,  res: 2, mr: 2 },
    fire5:  { n: '火靈', ele: 'fire',  fix: 5, counter: 12, res: 3, mr: 3 },
    water5: { n: '水靈', ele: 'water', fix: 5, counter: 12, res: 3, mr: 3 },
    wind5:  { n: '風靈', ele: 'wind',  fix: 5, counter: 12, res: 3, mr: 3 },
    earth5: { n: '地靈', ele: 'earth', fix: 5, counter: 12, res: 3, mr: 3 },
};
// 隨機產生一個屬性詞綴代碼：之60% / 中階30% / 靈10%，四元素均分
function rollAttrAffix() {
    let r = Math.random();
    let tier = r < 0.60 ? 1 : (r < 0.90 ? 3 : 5);
    let ele = ['fire', 'water', 'wind', 'earth'][Math.floor(Math.random() * 4)];
    return ele + tier;
}
// 取得詞綴定義（相容舊存檔：attr 為非法值/true 時回傳 null）
function getAttrAffix(attr) {
    return (typeof attr === 'string' && ATTR_AFFIX[attr]) ? ATTR_AFFIX[attr] : null;
}
// 武器實際屬性（屬性詞綴優先，否則用基底物品 ele）
function getWpnEle(wpnInst, wpnBase) {
    let a = wpnInst && getAttrAffix(wpnInst.attr);
    if (a) return a.ele;
    return (wpnBase && wpnBase.ele) ? wpnBase.ele : 'normal';
}
// 屬性剋制判定（攻擊屬性 e 是否剋制怪物屬性 te），加成量由各詞綴的 counter 決定
// 🔧 統一：抗魔係數（MR 折減倍率，邊際效益遞減）。回傳「魔法傷害通過率」(=1-減傷%)。
//   0–100：每+1 MR +0.5% 減傷（→50%）｜100–200：+0.1%（→60%）｜200–400：+0.075%（→75%）｜
//   400–600：+0.06%（→87%）｜600–800：+0.04%（→95%）｜800–1000：+0.02%（→99%）｜MR≥1000：上限 99% 減傷（係數 0.01，無完全免疫）。
//   供 castSkill／各 proc／傭兵魔法／玩家受魔法傷害共用。
function mrMult(mr) {
    if (mr <= 100)  return (100 - mr / 2) / 100;          // 1.00 → 0.50（0→50% 減傷）
    if (mr <= 200)  return 0.50 - (mr - 100) / 1000;       // 0.50 → 0.40（50→60%）
    if (mr <= 400)  return 0.40 - (mr - 200) * 0.00075;    // 0.40 → 0.25（60→75%）
    if (mr <= 600)  return 0.25 - (mr - 400) * 0.0006;     // 0.25 → 0.13（75→87%）
    if (mr <= 800)  return 0.13 - (mr - 600) * 0.0004;     // 0.13 → 0.05（87→95%）
    if (mr <= 1000) return 0.05 - (mr - 800) * 0.0002;     // 0.05 → 0.01（95→99%）
    return 0.01;                                           // 上限 99% 減傷（係數 0.01）
}
function isElementCounter(e, te) {
    return (e === 'fire'  && te === 'earth') ||
           (e === 'earth' && te === 'wind')  ||
           (e === 'wind'  && te === 'water') ||
           (e === 'water' && te === 'fire');
}

function getItemColor(item) {
    let d = DB.items[item.id];
    // 🏅 傳說武器：琥珀金，優先於套裝與所有詞綴（即使帶套裝效果，名稱仍為琥珀金）
    if (d && d.legend) return 'c-legend';
    // 🔮 席琳套裝效果：鮮綠＋呼吸綠光，優先於所有詞綴顏色
    if (item.seteff) return 'c-sherine';
    // 名字顏色 = 套裝 > 祝福(金)/詛咒(紅) > 基底色
    // 🔧 屬性詞綴與遠古系詞綴（遠古/永恆/不朽/太初）不再影響裝備名稱顏色，
    //    詞綴字本身仍保留各自專屬色（見 getItemFullName）
    if (item.bless) return blessColorClass(item.bless);
    if (d && d.isB) return 'c-blessed';
    if (d && d.isC) return 'c-cursed';   // 詛咒的卷軸：名稱紅色
    return d.c || 'text-white';
}

// 圖示光芒：依詞綴組合決定顏色與顯眼度（與文字顏色獨立）。
//   單祝福→金光、單遠古→紫光（原樣）；屬性+遠古→紫光(加強)、屬性+祝福→金光(加強)，顯眼度比照雙詞綴；
//   遠古+祝福→紫金交替(顯眼)；三詞綴→變色循環，顯眼度最高。
function getGlowClass(item, d) {
    // 🔮 席琳結晶：圖示帶與套裝文字同款的呼吸綠光
    if ((item && item.id === 'sherine_crystal') || (d && d.n === '席琳結晶')) return 'sherine-glow-icon';
    // 🔮 席琳套裝效果裝備：套裝光芒優先於傳說圖示光（名稱仍由 getItemColor 決定為琥珀金）
    if (item && item.seteff) return 'sherine-glow-icon';
    if ((item && item.id === 'wpn_manadagger') || (d && d.n === '魔力短劍')) return 'mana-glow';   // 🔧 魔力短劍：專屬藍色圖示光芒（凌駕傳說琥珀金光）
    if (d && d.legend) return 'legend-glow';   // 🏅 傳說武器：琥珀金圖示光芒
    let bless = (item && item.bless) || (d && d.isB);
    let cursed = !!(item && item.bless === 'cursed') || !!(d && d.isC);   // 詛咒裝備或詛咒卷軸：紅光
    let anc = (item && item.anc) || (d && d.isAnc);
    let attr = !!(item && getAttrAffix(item.attr));
    if (cursed) return 'curse-glow';   // 含詛咒：一律單詛咒紅光（即使二/三詞綴）
    if (attr && anc && bless) return 'tri-glow';           // 三詞綴：高亮變色循環（顯眼度最高）
    if (anc && bless) return 'anc-bless-glow';             // 遠古+祝福：紫金交替（顯眼）
    if (attr && anc) return 'ancient-glow-strong';         // 屬性+遠古：紫光（顯眼度＝雙詞綴）
    if (attr && bless) return 'bless-glow-strong';         // 屬性+祝福：金光（顯眼度＝雙詞綴）
    if (anc) return 'ancient-glow';                        // 單遠古：紫光（原樣）
    if (bless) return 'bless-glow';   // 單祝福（詛咒已於上方優先處理）                        // 單祝福：金光（原樣）
    return '';
}

// 物品全名（HTML：各詞綴分段各自上色；順序 屬性→遠古→祝福的→[+N]名字；名字顏色＝最靠近的詞綴）
// 遠古系詞綴變體：遠古(基礎,anc=true) / 永恆(eternal) / 不朽(immortal) / 太初(primordial)
function ancName(anc) {
    if (!anc) return '';
    return ({ eternal: '永恆', immortal: '不朽', primordial: '太初' })[anc] || '遠古';
}
function ancColorClass(anc) {   // 遠古=紫、永恆=紅、不朽=綠、太初=藍
    return ({ eternal: 'c-eternal', immortal: 'c-immortal', primordial: 'c-primordial' })[anc] || 'c-ancient';
}
// 祝福系：祝福的(bless=true) / 詛咒的(bless='cursed')
function blessName(bless) { return !bless ? '' : (bless === 'cursed' ? '詛咒的' : '祝福的'); }
function blessColorClass(bless) { return (bless === 'cursed') ? 'c-cursed' : 'c-blessed'; }
function applyBlessStats(d, bless, slot) {   // slot: 'wpn' | 'arm' | 'acc'；詛咒的＝祝福的負鏡像
    if (!bless) return;
    let sg = (bless === 'cursed') ? -1 : 1;
    if (slot === 'wpn') { d.extraDmg += sg*1; d.extraHit += sg*1; d.extraMp += sg*2; }   // 武器：傷害/命中/額外魔法點數
    else if (slot === 'arm') { d.ac -= sg*1; d.dr += sg*1; }                              // 防具：AC(祝-1/詛+1)、傷害減免
    else { d.ac -= sg*1; d.mr += sg*1; }                                                  // 飾品：AC、MR
}
function applyAncStats(d, anc, slot) {   // slot: 'wpn' | 'arm' | 'acc'
    if (!anc) return;
    let v = (anc === true) ? 'ancient' : anc;
    if (slot === 'wpn') {
        if (v === 'ancient') { d.extraDmg += 2; d.magicDmg += 1; }
        else if (v === 'eternal') d.extraDmg += 4;
        else if (v === 'immortal') d.extraHit += 4;
        else if (v === 'primordial') d.magicDmg += 2;
    } else if (slot === 'arm') {
        if (v === 'ancient') d.dr += 2;
        else if (v === 'eternal') d.ac -= 2;
        else if (v === 'immortal') d.er += 2;
        else if (v === 'primordial') d.mr += 4;
    } else {
        if (v === 'ancient') { d.dr += 1; d.mr += 1; }
        else if (v === 'eternal') { d.extraDmg += 1; d.ac -= 1; }
        else if (v === 'immortal') { d.extraDmg += 1; d.extraHit += 1; }
        else if (v === 'primordial') { d.mr += 2; d.extraMp += 2; }
    }
}
function getItemFullName(item) {
    let d = DB.items[item.id];
    if(!d) return "未知的物品";
    let segs = '';
    let aff = getAttrAffix(item.attr);
    if (aff) {
        let acls = 'c-attr-' + item.attr + (item.attr.charAt(item.attr.length - 1) === '5' ? ' c-attr-glow' : '');
        segs += `<span class="${acls}">${aff.n} </span>`;   // 屬性詞綴：12 種專屬色
    }
    if (item.anc)   segs += `<span class="${ancColorClass(item.anc)}">${ancName(item.anc)} </span>`;   // 遠古系：遠古紫/永恆紅/不朽綠/太初藍
    if (item.bless) segs += `<span class="${blessColorClass(item.bless)}">${blessName(item.bless)} </span>`;   // 祝福的金/詛咒的紅
    let en = (item.en > 0) ? (`+${capEn(item.en, d)} `) : "";   // 🔧 一律顯示 +N（夾擠至上限：武器+20/防具+15/飾品+5；過往超過上限的資料以上限顯示）
    let cnt = item.cnt > 1 ? ` (${item.cnt})` : "";
    let setPrefix = item.seteff ? item.seteff.slice(0, 2) : "";   // 🔮 席琳套裝：套裝名冠在裝備名稱前（如「紅獅環甲」）；顏色沿用 getItemColor（規則同前）
    return `${segs}<span class="${getItemColor(item)}">${en}${setPrefix}${d.n}${cnt}</span>`;
}

function useItem(u, silent = false) {
    let item = player.inv.find(i => i.uid === u);
    if (!item) return;
    if (player.dead) { if (!silent) logSys(`死亡狀態無法使用道具，請先復活。`); return; }   // 死亡(未復活前)鎖住手動使用
    if (inAbsBarrier()) { if(!silent) logSys('絕對屏障期間與世界隔絕，無法使用藥水與道具。'); return; }   // 🛡️ 絕對屏障：禁止使用任何道具（自動使用 silent 亦略過）
    if (item.id === 'scroll_revive') { if(!silent) logSys(`復活卷軸無法從道具欄使用，死亡時可於畫面下方點選『原地復活』。`); return; }
    let d = DB.items[item.id];
    if (d.noUse) { if(!silent) logSys(`此物品無法直接使用。`); return; }

    // 🎴 卡片收集冊：翻開全螢幕書頁；卡片：登錄圖鑑（已收錄則改賣出）
    if (d.eff === 'cardbook') { if (silent) return; if (typeof openCardBook === 'function') openCardBook(); return; }
    if (d.eff === 'equipbook') { if (silent) return; if (typeof openEquipBook === 'function') openEquipBook(); return; }   // 🗡️ 裝備收集冊
    if (d.eff === 'card') { if (silent) return; if (typeof useCardItem === 'function') useCardItem(item); return; }
    if (d.eff === 'doll_bag') { if (silent) return; if (typeof openDollBag === 'function') openDollBag(item, false); return; }   // 🪆 開啟魔法娃娃的袋子

    // 🗼 封印的傲慢之塔傳送符：使用後解封，獲得對應的 傲慢之塔傳送符（消耗 1 個）
    if (d.eff === 'pride_unseal') {
        if (silent) return;
        let _passId = 'item_pride_pass_' + (d.prideTier || 11);
        if (!DB.items[_passId]) { logSys('<span class="text-red-400">解封失敗：找不到對應的傳送符。</span>'); return; }
        item.cnt--; if (item.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== item.uid);
        gainItem(_passId, 1);
        logSys(`<span class="text-amber-300 font-bold">封印解除！</span>你獲得了 <span class="text-amber-300 font-bold">${DB.items[_passId].n}</span>，攜帶在身上即可進入對應樓層。`);
        renderTabs(); updateUI(); saveGame();
        if (!document.getElementById('item-modal').classList.contains('hidden')) closeModal();
        return;
    }

    // 🐾 進化果實：玩家等級30以上、且道具欄有對應基礎項圈才能使用 → 消耗 1 基礎項圈 + 1 果實，獲得 1 進化項圈
    if (d.eff === 'evolve') {
        if (silent) return;
        if ((player.lv || 1) < 30) { logSys('<span class="text-red-400">等級不足：進化果實需要玩家等級 30 以上才能使用。</span>'); return; }
        let baseId = d.evolveFrom, toId = d.evolveTo;
        let baseStack = player.inv.find(i => i.id === baseId && (i.cnt || 0) > 0);
        if (!baseStack) { logSys(`<span class="text-red-400">你沒有可進化的 ${DB.items[baseId] ? DB.items[baseId].n : '對應項圈'}，無法使用此進化果實。</span>`); return; }
        baseStack.cnt--; if (baseStack.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== baseStack.uid);   // 消耗 1 基礎項圈
        item.cnt--; if (item.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== item.uid);                 // 消耗 1 果實
        gainItem(toId, 1);                                                                                       // 獲得 1 進化項圈
        logSys(`<span class="text-amber-300 font-bold">進化成功！</span>你的 ${DB.items[baseId].n} 進化為 <span class="text-amber-300 font-bold">${DB.items[toId].n}</span>！`);
        renderTabs(); updateUI(); saveGame();
        if (!document.getElementById('item-modal').classList.contains('hidden')) closeModal();
        return;
    }

    // 🏛️ 上鎖的歐西里斯寶箱：開啟選擇數量，每開 1 個消耗 1 顆 龜裂之核，依機率獲得底比斯寶物
    if (d.eff === 'osiris_box') {
        if (silent) return;
        openOsirisBox(item.uid);
        return;
    }

    // 🔧 靈魂之球：身上有「失去魔力的巴列斯魔杖」→ 兩者各消耗 1 個，獲得「巴列斯魔杖」；否則只顯示訊息、不消耗
    //   ・優先消耗「帶席琳套裝效果」的失去魔力魔杖；兌換出的巴列斯魔杖繼承相同套裝效果
    if (d.eff === 'soulorb') {
        if (silent) return;
        // 🔧 靈魂之球：可恢復「失去魔力的巴列斯魔杖→巴列斯魔杖」或「失去魔力的巴風特魔杖→巴風特魔杖」；兩者皆有則出現選項。
        let _restore = (powerlessId, resultId, resultName, powerlessName) => {
            let _wands = player.inv.filter(i => i.id === powerlessId && i.cnt > 0);
            if (!_wands.length) return false;
            let _wand = _wands.find(i => i.seteff) || _wands[0];   // 優先選有套裝效果者
            let _seteff = _wand.seteff || false;
            item.cnt--; if (item.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== item.uid);   // 消耗靈魂之球 ×1
            _wand.cnt--; if (_wand.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== _wand.uid);   // 消耗失去魔力魔杖 ×1
            let _probe = { id:resultId, en:0, bless:false, anc:false, attr:false, seteff:_seteff };
            let _ex = player.inv.find(i => (i.en||0)===0 && sameItemSig(i, _probe));
            if (_ex) _ex.cnt += 1;
            else player.inv.push({ id:resultId, uid:uid(), cnt:1, en:0, bless:false, anc:false, attr:false, seteff:_seteff, lock:false, junk:false });
            logSys(`<span class="c-legend font-bold">靈魂之球與${powerlessName}發出強烈的銀色光芒！</span><span class="text-amber-200">你獲得了 ${resultName}${_seteff ? `（<span class="c-sherine font-bold">${_seteff}</span>）` : ''}！</span>`);
            renderTabs(); updateUI(); saveGame();
            if (!document.getElementById('item-modal').classList.contains('hidden')) closeModal();
            return true;
        };
        let hasBaless = player.inv.some(i => i.id === 'wpn_powerless_baless' && i.cnt > 0);
        let hasBaph = player.inv.some(i => i.id === 'wpn_powerless_baphomet' && i.cnt > 0);
        if (!hasBaless && !hasBaph) { logSys('<span class="text-slate-300">靈魂之球發出微弱的光芒，什麼事都沒發生。</span>'); return; }
        if (hasBaless && hasBaph) {
            let pickBaless = confirm('靈魂之球同時感應到兩把失去魔力的魔杖，只能喚回一把。\n\n【確定】＝巴列斯魔杖\n【取消】＝巴風特魔杖');
            if (pickBaless) _restore('wpn_powerless_baless', 'wpn_baless', '巴列斯魔杖', '失去魔力的巴列斯魔杖');
            else _restore('wpn_powerless_baphomet', 'wpn_baphomet_wand', '巴風特魔杖', '失去魔力的巴風特魔杖');
            return;
        }
        if (hasBaless) _restore('wpn_powerless_baless', 'wpn_baless', '巴列斯魔杖', '失去魔力的巴列斯魔杖');
        else _restore('wpn_powerless_baphomet', 'wpn_baphomet_wand', '巴風特魔杖', '失去魔力的巴風特魔杖');
        return;
    }

    if (d.type === 'pot' || d.eff === 'poly' || d.eff === 'reset' || d.eff === 'magicbarrier' || d.eff === 'teleport_scroll' || d.eff === 'panacea') {   // 變形卷軸(eff:poly)、回憶蠟燭(eff:reset)、魔法卷軸(eff:magicbarrier)、瞬間移動卷軸(eff:teleport_scroll)亦走此消耗品分支
        // 職業限定檢查（如慎重藥水=法師、勇敢藥水=騎士、精靈餅乾=妖精）
        if (!reqAllowsClass(d, player.cls)) {
            if (!silent) logSys(`無法使用 ${d.n}，職業不符。`);
            return;
        }
        if (item.id.includes('potion_heal') || item.id === 'potion_strong' || item.id === 'potion_ult') {
            if (player.cds.pot > 0) return;
            let h = Math.floor(d.val * (1 + (getConPotionPct(player.d.con) + dollFieldVal('potionBonus')) / 100));   // 🪆 魔法娃娃 potionBonus%（吸血鬼）
            if (hasMastery('k_survive')) h = Math.floor(h * 1.25);   // 🏅 生存精通：治癒藥水恢復 +25%
            if (hasMastery('k_tough') && player.hp < player.mhp * 0.4) h = Math.floor(h * 1.5);   // ⚔️ 堅韌精通：HP<40% 時藥水治癒量 +50%
            if (hasMastery('k_dragonblood')) h = Math.floor(h * 1.15);   // 🐉 龍血精通：治癒藥水恢復 +15%
            player.hp = Math.min(player.mhp, player.hp + h);
            player.cds.pot = 1;
            if(!silent) logSys(`飲用 ${d.n}，恢復 ${h} HP。`);
        } else if (item.id === 'new_item_141') {
            // 安特的水果：只能手動使用，恢復 44~107 HP（自動使用會帶 silent=true，直接略過不消耗）
            if (silent) return;
            if (player.cds.pot > 0) return;
            let h = 44 + Math.floor(Math.random() * (107 - 44 + 1));
            if (hasMastery('k_survive')) h = Math.floor(h * 1.25);   // 🏅 生存精通：安特的水果恢復 +25%
            player.hp = Math.min(player.mhp, player.hp + h);
            player.cds.pot = 1;
            logSys(`食用 ${d.n}，恢復 ${h} HP。`);
        } else if (d.eff === 'poly') {
            let ringOn = hasPolyRing();
            if (!silent && ringOn) {
                // 手動從道具欄使用 + 持有變形控制戒指（裝備或背包攜帶皆可）：開啟選擇選單（變身與消耗在選定後才執行）
                openPolySelect(item.uid);
                return;
            }
            if (silent && ringOn && player.poly) {
                // 自動使用 + 持有變形控制戒指：維持上次的變身狀態（不重抽、不跳選單）
                // 保留 player.poly 不變，僅於下方重置持續時間。
            } else {
                // 其餘情況（手動且無戒指 / 自動但尚無變身紀錄）：依等級隨機抽取一種
                player.poly = getPolyState();
            }
            player.buffs.poly = d.dur;
            if(!silent) logSys(`使用變形卷軸，變身為 <span class="${player.poly.c}">${player.poly.n}</span>。`);
		} else if (d.eff === 'meat') {
            // 肉：食用後獲得「誘捕」狀態；但 8 種項圈(杜賓狗/狼/哈士奇/牧羊犬/聖伯納/暴走兔/狐狸/小獵犬)總數達到 floor(魅力/7) 時無法誘捕
            let limit = Math.min(8, Math.floor((player.d.cha || 0) / 7));   // 🔧 硬上限 8：不論魅力多高，項圈夥伴攜帶上限封頂 8
            if (totalCollarCount() >= limit) {
                if(!silent) logSys(`你持有的項圈數量已達上限，無法再進行誘捕。`);
                return;   // 不消耗肉
            }
            player.buffs.taming = 300;
            if(!silent) logSys(`你吃下了肉，獲得增益 <span class="text-pink-300 font-bold">誘捕</span>，持續300秒。`);
            // 落到下方 consume(item)，消耗一塊肉
        } else if (d.eff === 'whistle') {
            // 哨子：使用不消耗。身上有任一夥伴 → 解除全部；否則依持有的各種項圈獲得對應夥伴（可多種並存）
            if (!player.partners) player.partners = [];
            if (player.partners.length > 0) {
                player.partners = [];
                if(!silent) logSys(`你收起了哨子，所有夥伴都離開了。`);
            } else {
                let added = [];
                for (let nm in PET_DEF) {
                    let cnt = petCollarCount(nm);
                    if (cnt > 0) { player.partners.push(nm); added.push(`夥伴：${nm}${cnt > 1 ? (' ' + cnt) : ''}`); }
                }
                if (added.length) { if(!silent) logSys(`吹響哨子！獲得增益 ${added.join('、')}，持續到關閉遊戲或再次使用哨子。`); }
                else { if(!silent) logSys(`你沒有任何項圈，哨子沒有作用。`); }
            }
            updateUI();
            return;   // 哨子不消耗
        } else if (d.eff === 'magicbarrier') {
            // 魔法卷軸：與魔法屏障法術共用 player.buffs.sk_magic_shield，不可疊加
            if ((player.magicShieldCd || 0) > 0) {
                // 抵擋技能後冷卻中：無法施放、且不消耗卷軸
                if(!silent) logSys(`魔法屏障冷卻中（剩餘 ${player.magicShieldCd} 秒），無法使用魔法卷軸。`);
                return;
            }
            if (player.buffs.sk_magic_shield > 0) {
                // 已有魔法屏障 → 手動使用取消（不消耗卷軸）
                player.buffs.sk_magic_shield = 0;
                if(!silent) logSys(`取消了魔法屏障狀態。`);
                updateUI();
                return;
            }
            player.buffs.sk_magic_shield = 16;   // 與魔法屏障法術相同：16 秒
            if(!silent) logSys(`使用魔法卷軸，獲得 <span class="text-cyan-300 font-bold">魔法屏障</span> 狀態。`);
            // 落到下方 consume(item)，消耗一張卷軸
        } else if (d.eff === 'teleport_scroll') {
            // 行動限制狀態（石化／麻痺／冰凍／暈眩）無法使用瞬間移動卷軸
            if (player.statuses && (player.statuses.stone > 0 || player.statuses.paralyze > 0 || player.statuses.freeze > 0 || player.statuses.stun > 0 || player.statuses.sleep > 0)) {
                if (!silent) logSys('你目前無法行動（石化／麻痺／冰凍／暈眩），無法使用瞬間移動卷軸。');
                return;
            }
            // 🔧 魔獸軍王之室：瞬間移動卷軸無效（不消耗卷軸）
            if (KING_ROOMS[mapState.current]) { if (!silent) logSys('<span class="text-red-400">軍王之室的封印之力壓制了傳送，瞬間移動卷軸無法生效。</span>'); return; }
            // 🗼 傲慢之塔：排名模式一律禁止；11F+ 樓層需持有對應支配符（不消耗卷軸）
            if (prideTeleportBlocked()) { if (!silent) logSys('<span class="text-red-400">' + (state.riftRun ? '時空裂痕中無法使用瞬間移動卷軸。' : (state.prideRanked ? '排名挑戰中無法使用瞬間移動卷軸。' : '在此樓層需持有對應的傲慢之塔支配符才能使用瞬間移動卷軸。')) + '</span>'); return; }
            // 🏝️ 遺忘之島：途中與本島皆禁用瞬間移動卷軸（不消耗卷軸）
            if (state.oblivion) { if (!silent) logSys('<span class="text-red-400">遺忘之島的迷霧壓制了傳送，瞬間移動卷軸無法生效。</span>'); return; }
            // 瞬間移動卷軸：效果同傳送術。手動(非silent)+傳送控制戒指 → 必定遭遇BOSS；自動使用(silent) → 必定無戒指效果。
            if (!silent && HIDDEN_AREA_PARENT[mapState.current]) {   // 🏛️ 對應地圖手動用卷軸→進入隱藏狩獵區域（自動瞬移 silent 不進入、照常逃離頭目）；下方仍 consume 卷軸
                enterHiddenArea(HIDDEN_AREA_PARENT[mapState.current]);
            } else {
                let forceBoss = !silent && hasTeleportRing();
                doTeleport(forceBoss);
                if(!silent) logSys(`使用瞬間移動卷軸，當前的怪物消失了${forceBoss ? '；傳送控制戒指引動了強敵的氣息……' : ''}。`);
            }
            // 落到下方 consume(item)，消耗一張卷軸
        } else if (d.eff === 'panacea') {
            const STAT_CN = { str:'力量', dex:'敏捷', con:'體質', int:'智力', wis:'精神', cha:'魅力' };
            let st = d.pstat, cap = 60;
            // 萬能藥已取消等級限制（不再檢查 plv）
            if ((player.panaceaUsed || 0) >= 60) { if(!silent) logSys(`萬能藥最多只能使用 60 瓶，使用回憶蠟燭後可重新使用。`); return; }   // 🔧 上限 20→30→50→60
            if (naturalStat(st) >= cap) { if(!silent) logSys(`${STAT_CN[st]}已達上限（${cap}），無法再使用 ${d.n}。`); return; }
            if (!player.panacea) player.panacea = { str:0, dex:0, con:0, int:0, wis:0, cha:0 };
            player.panacea[st] = (player.panacea[st] || 0) + 1;
            player.panaceaUsed = (player.panaceaUsed || 0) + 1;
            if(!silent) logSys(`使用了 ${d.n}，${STAT_CN[st]} 永久 +1！（萬能藥已使用 ${player.panaceaUsed}/60）`);
            // 落到下方 consume(item) + calcStats()，由 useItem 結尾 updateUI 刷新
        } else if (d.eff === 'reset') {
            startRespec(); return;   // 🕯️ 回憶蠟燭：改為「資訊面板配點重置」流程（確認時才消耗蠟燭，故此處不 consume）
        } else {
            player.buffs[d.eff] = d.dur;
            if(!silent) logSys(`使用了 ${d.n}。`);
        }
        consume(item);
        calcStats();
    } else if (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') {
        equipItem(item);
    } else if (d.type === 'scroll') {
        openEnhanceModal(item);
    } else if (d.type === 'skillbk') {
        let sd = DB.skills[d.sk];
        let reqLv = skillReqLv(sd, d.sk);   // 🏅 集中化：含魔導精通特例（妖精可學四項法師法術）
        if(reqLv === undefined) { logSys(`你的職業無法學習「${sd.n}」。`); return; }
        if(player.lv < reqLv) { logSys(`等級不足，需要等級 ${reqLv} 才能學習「${sd.n}」。`); return; }
        
        // 👇 補上這兩行：確保屬性相符才能吃水晶！
        if(sd.reqEle && player.elfEle !== sd.reqEle) { logSys(`屬性不符，無法學習「${sd.n}」。`); return; }
        if(sd.reqEleAny && !player.elfEle) { logSys(`尚未選擇屬性，無法學習「${sd.n}」。`); return; }

        if(!player.skills.includes(d.sk)) {
            player.skills.push(d.sk);
            logSys(`學習了技能: <span class="text-cyan-300">${DB.skills[d.sk].n}</span>`);
            consume(item);
            renderTabs();
            renderSkillSelects();
        } else logSys(`你已經學過這個技能了。`);
    }
    updateUI();
    if(!silent && document.getElementById('item-modal').classList.contains('hidden') === false && (d.type !== 'scroll' || d.eff === 'poly' || d.eff === 'magicbarrier' || d.eff === 'teleport_scroll')) {
        closeModal();
    }
}

// 雙手武器判定：弓(isBow)或雙手武器(w2h)，皆不可與盾牌並存
function isTwoHandedWpn(d) {
    return !!(d && (d.isBow || d.w2h) && !d.oneHand);   // 🏝️ oneHand：單手武器（古老的弩槍＝單手弓）即使是弓也可與盾牌/臂甲並用
}
// 隱身狀態：施放隱身術(buff)期間，或穿著隱身斗篷(arm_88)時皆成立；卸下斗篷即失效
function isInvisible() {
    return player.buffs.sk_invisible > 0 || (player.eq.cloak && DB.items[player.eq.cloak.id] && (DB.items[player.eq.cloak.id].stealth || player.eq.cloak.id === 'arm_88'));   // 🔧 stealth flag：泛用隱身斗篷（炎魔的血光斗篷等）
}
// 將某裝備欄位的裝備退回背包（不關閉視窗，供 equipItem 內部互斥處理用）
function returnEquipToInv(slot) {
    let e = player.eq[slot];
    if (!e) return;
    let ex = player.inv.find(i => sameItemSig(i, e) && !i.lock && !i.junk);   // 🔧 架構#3：統一簽章比對
    if (ex) ex.cnt += e.cnt;
    else player.inv.push(e);
    player.eq[slot] = null;
}

// 負重強化(sk_load_up)讓法師/妖精能使用的擴充裝備清單（單一來源，裝備判定與商店過濾共用）
const LOAD_UP_EXTRA = {
    mage: ['shd_gnome', 'arm_63', 'arm_64', 'arm_69'],   // 侏儒圓盾, 鏈甲, 歐西斯鏈甲, 抗魔法鏈甲
    elf:  ['arm_108', 'hlm_steel', 'arm_113', 'arm_79']  // 塔盾, 鋼鐵頭盔, 鋼鐵盾牌, 鋼鐵金屬盔甲
};
function loadUpAllows(itemId) {
    return false;   // 🔧 負重改版：負重強化不再開放裝備重甲（改為負重上限增益）
    /* eslint-disable-next-line */
    return player.skills.includes('sk_load_up') && LOAD_UP_EXTRA[player.cls] && LOAD_UP_EXTRA[player.cls].includes(itemId);
}
// ===== 黑暗妖精裝備使用規則 =====
// 負重強化(sk_load_up)解鎖的重甲（依名稱）
const DARK_LOADUP = ['鋼鐵頭盔','鋼鐵金屬盔甲','騎士面甲','青銅盔甲','鋼鐵盾牌'];
// 黑暗妖精無法使用的防具/頭盔/手套/斗篷/盾/T恤/長靴/長袍（依名稱，負重強化清單除外）
const DARK_BLOCK = [
    '藤甲','皮甲','死亡騎士盔甲','金屬盔甲','克特盔甲',
    '死亡騎士長靴','克特長靴','黑長者涼鞋',
    '法師長袍','黑長者長袍',
    '騎士頭巾','西瑪之帽','馬庫爾之帽','巴土瑟之帽','卡士柏之帽','法師之帽','紅騎士頭巾',
    '力量魔法頭盔','敏捷魔法頭盔','治癒魔法頭盔','精靈體質頭盔','精靈敏捷頭盔','艾爾穆的祝福','死亡騎士頭盔','克特頭盔',
    '保護者手套','死亡騎士手套','克特手套','水晶手套',
    '瑪那斗篷',
    '銀騎士之盾','紅騎士之盾','魔法能量之書','塔盾',
    '精靈T恤',
    '神官頭飾','神官法袍','神官長靴','神官斗篷','神官手套',   // 🔧 神官系列：黑暗妖精禁用（僅法師/妖精）
    '巨蟻女皇的金翅膀'   // 🔧 依文本（騎士/妖精）：黑暗妖精禁用（銀翅膀文本含黑暗妖精則可用）
];
// 🔧 既有十字弓白名單：這些（輸入此規則前已存在的）十字弓黑暗妖精照舊可用；其餘/之後新增的十字弓改依文本(req)
const DARK_XBOW_LEGACY = ['wpn_31', 'wpn_xbow_dark', 'wpn_xbow_gloom', 'wpn_xbow_rasta'];
function darkEquipOk(d, id) {
    if (!d) return false;
    if (d.type === 'wpn') {
        if (d.isArrow) return true;
        if (id === 'wpn_siruge') return false;                          // 瑟魯基：禁用
        if (id === 'wpn_demon_sword_hidden') return false;              // 👹 隱藏的魔族之劍：適用王族/騎士/妖精/龍騎士（黑暗妖精改用 隱藏的魔族鋼爪）
        let tags = getWeaponTags(id);
        if (tags.includes('匕首') || tags.includes('單手劍') || tags.includes('鋼爪') || tags.includes('雙刀') || tags.includes('武士刀')) return true;   // 🔧 黑暗妖精亦可使用武士刀
        if (d.isBow) {
            // 🔧 既有十字弓：黑暗妖精照舊可用（沿用通用規則的既有清單）；之後新增的十字弓一律依文本（req 含 dark 才可用）
            if (DARK_XBOW_LEGACY.includes(id)) return true;
            return (d.n || '').includes('十字弓') && (d.req || '').includes('dark');
        }
        return false;                                                   // 單手鈍器/雙手鈍器/魔杖/雙手劍/矛 等：禁用
    }
    let nm = d.n || '';
    if (DARK_LOADUP.includes(nm)) return false;   // 🔧 負重改版：負重強化不再開放重甲
    if (DARK_BLOCK.includes(nm)) return false;
    if (nm === '水晶盔甲') return true;                                 // 可使用水晶盔甲
    return reqAllowsClass(d, 'elf') || reqAllowsClass(d, 'dark');   // 其餘比照妖精可用
}
// 🔮 幻術士裝備規則：全職業裝備(req:all/無req)除「匕首」外皆可用＋下列開放清單(特定職業限定→開放給幻術士)；不可使用任何匕首。
const ILLUSION_WHITELIST = new Set([
    '黑法師項鍊','蕾雅項鍊','法令軍王之鍊','冥法軍王之戒','古老的皮盔甲','鏈甲','抗魔法鏈甲','鱗甲','黑長者涼鞋','黑暗棲林者長靴','神官長靴',
    '神官頭飾','銀光斗篷','巨蟻女皇的銀翅膀','神官斗篷','馬昆斯斗篷','水晶手套','神官手套','腕甲','抗魔法頭盔',
    '精靈皮盔','古老的長袍','巫妖斗篷','黑長者長袍','神官法袍','拉斯塔巴德長袍','喚獸師長袍','黑法師長袍','蕾雅長袍','伊娃之盾',
    '骷髏盾牌','神官魔法書','魔法能量之書','銀釘皮盾','梅杜莎盾牌','幻象眼魔的心眼','皮盾牌','木盾','小盾牌','阿克海盾牌',
    '惡魔斧頭','牛人斧頭','巨斧','狂戰士斧','戰斧','侏儒鐵斧','銀斧','戰錘','流星錘','木棒',
    '弗萊爾','釘錘','亞連','斧','力量魔法杖','神官魔杖','紅水晶魔杖','巴風特魔杖','瑪那魔杖','美基魔法杖',
    '橡木魔法杖','冰之女王魔杖','拉斯塔巴德魔杖','巫術魔法杖','巴列斯魔杖','惡魔鐮刀','黑法師之杖','蕾雅魔杖','暗黑十字弓','十字弓',
    '幽暗十字弓','尤米弓','古老的弩槍','拉斯塔巴德重十字弓','短弓','歐西斯弓','獵人之弓','精靈弓','拉斯塔巴德弓','黑暗十字弓'
]);
function illusionEquipOk(d, id) {
    if (!d) return false;
    if (d.type === 'wpn' && getWeaponTags(id).includes('匕首')) return false;   // 🔮 幻術士無法使用任何匕首（含全職業匕首）
    if (reqAllowsClass(d, 'illusion')) return true;   // 全職業(req:all/無req·匕首已排除)或 req 含 illusion（奇古獸/幻術士專屬裝備）
    if (ILLUSION_WHITELIST.has(d.n || '')) return true;   // 開放清單（特定職業限定→開放給幻術士）
    return false;
}
// 🐉 龍騎士裝備規則：全職業裝備(req:all/無req)除「匕首」外皆可用＋下列開放清單(特定職業限定→開放給龍騎士)；不可使用任何匕首。
const DRAGON_WHITELIST = new Set([
    '古老的鱗甲','金屬蜈蚣皮盔甲','死亡盔甲','鏈甲','抗魔法鏈甲','精靈鏈甲','鱗甲',
    '巴列斯長靴','黑暗棲林者長靴','武官長靴','巨蟻女皇的金翅膀','銀光斗篷','武官斗篷','馬昆斯斗篷',
    '水晶手套','巴蘭卡手套','墮落手套','武官手套','腕甲','抗魔法頭盔','巴蘭卡頭盔','武官頭盔','精靈皮盔',
    '伊娃之盾','骷髏盾牌','武官之盾','銀釘皮盾','侏儒圓盾','拉斯塔巴德圓盾','大盾牌','反射之盾','梅杜莎盾牌','皮盾牌','木盾','小盾牌','阿克海盾牌','死亡之盾',
    '巨斧','狂戰士斧','戰斧','侏儒鐵斧','銀斧','戰錘','流星錘','木棒','弗萊爾','釘錘','亞連','斧',
    '古老的劍','惡魔之劍','黑焰之劍','瑟魯基之劍','克特之劍','黑暗之劍','細劍','大馬士革刀','武士刀','拉斯塔巴德長劍','侵略者之劍','精靈短劍','彎刀','長劍','紅騎士之劍','銀長劍','小侏儒短劍','銀劍','奧里哈魯根的劍身','歐西斯短劍','鎖子甲破壞者','闊劍','長劍的劍身','短劍的劍身',
    '屠龍劍','古老的巨劍','騎士范德之劍','復仇之劍','巨劍','武官雙手劍','雙手劍','血色巨劍'
]);
function dragonEquipOk(d, id) {
    if (!d) return false;
    if (d.type === 'wpn' && getWeaponTags(id).includes('匕首')) return false;   // 🐉 龍騎士無法使用任何匕首（含全職業匕首）
    if (reqAllowsClass(d, 'dragon')) return true;   // 全職業(req:all/無req·匕首已排除)或 req 含 dragon（龍騎士專屬裝備）
    if (DRAGON_WHITELIST.has(d.n || '')) return true;   // 開放清單（特定職業限定→開放給龍騎士）
    return false;
}
// 🔧 物品職業限制（白名單）單一事實來源：無 req、'all'、或 req（逗號分隔）含該職業即可使用/裝備。
//    全遊戲一律採「白名單」寫法（無「黑名單禁止職業」機制）；各處請呼叫此函式，勿再各自手寫 d.req 比對。
function reqAllowsClass(d, cls) {
    if (!d || !d.req || d.req === 'all') return true;
    return typeof d.req === 'string' && d.req.split(',').includes(cls);
}
// ⚔️ 戰士裝備規則（白名單制）：武器僅限「單手鈍器／雙手鈍器」(或 req 含 warrior 的戰士專屬武器)；
//    防具僅「標註全職業(req:all)的非盾牌防具」＋下列具名開放清單(含臂甲 slot:shield、職業限定防具、勇敢皮帶)；飾品＝全職業(req:all)的戒指／項鍊／腰帶皆可裝＋勇敢皮帶(req:knight 具名)；其餘(劍/弓/匕首/魔杖/盾牌/職業限定飾品)一律不可裝備。
const WARRIOR_WHITELIST = new Set([
    '勇敢皮帶','古老的金屬盔甲','巴風特盔甲','金屬蜈蚣皮盔甲','巴蘭卡盔甲','死亡盔甲','克特盔甲','金屬盔甲','鋼鐵金屬盔甲','死亡騎士盔甲','武官護鎧','皮甲','藤甲','青銅盔甲','精靈金屬盔甲','鏈甲','抗魔法鏈甲','精靈鏈甲','精靈護胸金屬板','鱗甲','歐西斯鏈甲','小藤甲',
    '克特長靴','死亡騎士長靴','巴列斯長靴','黑暗棲林者長靴','武官長靴','巨蟻女皇的金翅膀',
    '水晶手套','巴蘭卡手套','克特手套','死亡騎士手套','武官手套','腕甲','守護者臂甲','體力臂甲',
    '騎士面甲','鋼鐵頭盔','克特頭盔','死亡騎士頭盔','巴蘭卡頭盔','武官頭盔','治癒魔法頭盔','敏捷魔法頭盔','力量魔法頭盔'
]);
// ⚔️ 戰士額外開放使用的具名武器（矛／槍類等非鈍器；使用者指定開放清單，依名稱比對 d.n）
const WARRIOR_WEAPON_WHITELIST = new Set([
    '古代神之槍','深紅長矛','貝卡合金','露西錘','法丘','吉薩','闊矛','拉斯塔巴德矛',
    '覆上奧里哈魯根的角','精靈之矛','帕提森','槍','覆上米索莉的角','三叉戟','歐西斯之矛','潘的角'
]);
function warriorEquipOk(d, id) {
    if (!d) return false;
    if (d.type === 'wpn') {
        if (d.isArrow) return false;                                                   // 戰士不用弓箭
        let tags = getWeaponTags(id);
        if (tags.includes('單手鈍器') || tags.includes('雙手鈍器')) return true;        // 所有單手／雙手鈍器
        if (WARRIOR_WEAPON_WHITELIST.has(d.n || '')) return true;                       // ⚔️ 具名開放武器（矛／槍等）
        return !!(d.req && typeof d.req === 'string' && d.req.split(',').includes('warrior'));   // 戰士專屬武器（保險；古代神之斧等本就具鈍器 tag）
    }
    if (WARRIOR_WHITELIST.has(d.n || '')) return true;                                 // 具名開放清單（職業限定防具／臂甲／勇敢皮帶[req:knight]）
    if (d.type === 'acc' && reqAllowsClass(d, 'warrior')) return true;                 // ⚔️ 標註全職業(req:all)的飾品（戒指／項鍊／腰帶）皆可裝（2026-06 使用者要求）
    if (d.type === 'arm' && d.slot !== 'shield' && reqAllowsClass(d, 'warrior')) return true;   // 標註全職業的非盾牌防具
    if (d.type === 'arm' && d.armguard && reqAllowsClass(d, 'warrior')) return true;   // 🛡️ 全職業臂甲（req:all·副手非真盾）：戰士可用（古代鬥士/神射臂甲等；職業限定臂甲仍由 req 擋）
    return false;
}
// 👑 王族裝備規則：全職業(req:all/無req)武器/飾品/防具＋req 含 royal（黃金權杖等）＋下列具名開放清單（特定職業限定→開放給王族）
const ROYAL_WHITELIST = new Set([
    '冥法軍王之戒',
    '小藤甲','歐西斯鏈甲','鱗甲','精靈護胸金屬板','精靈鏈甲','抗魔法鏈甲','鏈甲','青銅盔甲','藤甲','皮甲','金屬盔甲','死亡盔甲','水晶盔甲','古老的鱗甲',
    '墮落長靴','木乃伊王的王冠','紅騎士頭巾','巨蟻女皇的金翅膀','墮落手套','體力臂甲','守護者臂甲','抗魔法頭盔','治癒魔法頭盔','敏捷魔法頭盔','力量魔法頭盔',
    '死亡之盾','阿克海盾牌','小盾牌','木盾','皮盾牌','梅杜莎盾牌','反射之盾','大盾牌','拉斯塔巴德圓盾','侏儒圓盾','銀釘皮盾','骷髏盾牌','伊娃之盾',
    '斧','亞連','釘錘','弗萊爾','木棒','流星錘','戰錘','銀斧','侏儒鐵斧','戰斧','巨斧','牛人斧頭','惡魔斧頭',
    '骰子匕首','歐西斯匕首','拉斯塔巴德短劍','精靈匕首','匕首','魔力短劍','米索莉短劍','奧里哈魯根短劍','小武士刀','水晶短劍','混沌之刺',
    '橡木魔法杖','短劍的劍身','長劍的劍身','闊劍','鎖子甲破壞者','歐西斯短劍','奧里哈魯根的劍身','短劍','銀劍','小侏儒短劍','銀長劍','紅騎士之劍','長劍','彎刀','精靈短劍','侵略者之劍','武士刀','大馬士革刀','細劍','黑暗之劍','克特之劍','死亡騎士的烈炎之劍','惡魔之劍','古老的劍',
    '雙手劍','巨劍','底比斯歐西里斯雙手劍','古老的巨劍','屠龍劍',
    '拉斯塔巴德弓','獵人之弓','歐西斯弓','短弓'
]);
function royalEquipOk(d, id) {
    if (!d) return false;
    if (reqAllowsClass(d, 'royal')) return true;   // 👑 全職業(req:all/無req) 或 req 含 royal（黃金權杖／王族裝備等）
    if (ROYAL_WHITELIST.has(d.n || '')) return true;   // 具名開放清單（特定職業限定→開放給王族）
    return false;
}
function checkCanEquip(item) {
    let d = DB.items[item.id];
    if (d && d.reqAvatar && player && player.avatar && player.avatar !== d.reqAvatar) return false;   // 👸 性別頭像限定（公主/王子…）：單一真實裝備閘，套用於所有職業；缺 avatar(舊檔)不硬擋。職業適用顯示走 *EquipOk（純粹·不讀玩家狀態）
    if (player.cls === 'dark') return darkEquipOk(d, item.id);   // 🔧 黑暗妖精專屬裝備規則
    if (player.cls === 'illusion') return illusionEquipOk(d, item.id);   // 🔮 幻術士專屬裝備規則（除匕首外的全職業裝備＋開放清單）
    if (player.cls === 'dragon') return dragonEquipOk(d, item.id);   // 🐉 龍騎士專屬裝備規則（除匕首外的全職業裝備＋開放清單）
    if (player.cls === 'warrior') return warriorEquipOk(d, item.id);   // ⚔️ 戰士專屬裝備規則（白名單制：鈍器＋全職非盾防具＋開放清單）
    if (player.cls === 'royal') return royalEquipOk(d, item.id);   // 👑 王族專屬裝備規則（全職業裝備＋具名開放清單）
    // 1. 基本職業判定
    let canEquip = reqAllowsClass(d, player.cls);

    // 2. 負重強化的擴充判定
    if (!canEquip && loadUpAllows(item.id)) canEquip = true;
    // 3. 🏅 劍術精通：妖精可裝備騎士限定的單手武器（非雙手、非弓）
    if (!canEquip && hasMastery('e_sword') && d.type === 'wpn' && !d.w2h && !d.isBow && d.req && d.req.includes('knight')) canEquip = true;
    return canEquip;
}

// 🏝️ 沙哈之弓：裝備時自動賦予「彈藥無限的沙哈之箭」；卸下/換成其他武器時移除。每次裝備變動後呼叫（冪等）。
function syncShahaArrow() {
    let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
    let isShahaBow = !!(wpn && wpn.shahaBow);
    let arrowIsShaha = !!(player.eq.arrow && player.eq.arrow.id === 'wpn_shaha_arrow');
    if (isShahaBow && !arrowIsShaha) {
        if (player.eq.arrow) {   // 先把原本的真實箭矢退回背包，再換上虛擬箭
            let e = player.eq.arrow, ex = player.inv.find(i => sameItemSig(i, e) && !i.lock && !i.junk);
            if (ex) ex.cnt += e.cnt; else player.inv.push(e);
        }
        player.eq.arrow = { id: 'wpn_shaha_arrow', cnt: 1, uid: uid() };
    } else if (!isShahaBow && arrowIsShaha) {
        player.eq.arrow = null;   // 卸下沙哈之弓：虛擬箭消失（不退背包）
    }
}
// 🏝️ 風之頭盔：裝備中或背包內任一即可（加速術/強力加速術免MP）
function playerHasWindHelm() {
    return !!((player.eq && player.eq.helm && player.eq.helm.id === 'hlm_wind') || (player.inv && player.inv.some(i => i.id === 'hlm_wind')));
}

function equipItem(item) {
    let d = DB.items[item.id];
    let slot = d.type === 'wpn' ? 'wpn' : d.slot;
    if (d.isArrow) slot = 'arrow'; // 如果是箭矢，強制分配到 arrow 欄位
    // ⚔️ 迅猛雙斧雙持：已學迅猛雙斧且主手已是單手鈍器時，再裝單手鈍器 → 放副手 offwpn 欄
    if (slot === 'wpn' && !d.isArrow && warriorDualWieldWpnOk(item.id) && dualWieldOffhandOk()) slot = 'offwpn';

    // 職業/裝備資格統一走 checkCanEquip（含黑暗妖精規則、負重強化、劍術精通例外），與顯示用判定同一來源
    if (!checkCanEquip(item)) {
        logSys(`無法裝備，職業不符。`);
        return;
    }

    // 🔧 唯一標記：身上最多只能裝備 1 個同一件唯一物品
    if (d.unique && Object.values(player.eq).some(e => e && e !== item && e.id === item.id)) {
        logSys(`<span class="text-amber-300">「${d.n}」帶有「唯一」標記，身上最多只能裝備 1 個。</span>`);
        return;
    }

    if (slot === 'ring') {
        if(!player.eq.ring1) slot = 'ring1';
        else if(!player.eq.ring2) slot = 'ring2';
        else if(player.lv >= 55 && !player.eq.ring3) slot = 'ring3';   // 第3戒指欄：需 Lv55
        else if(player.lv >= 65 && !player.eq.ring4) slot = 'ring4';   // 第4戒指欄：需 Lv65
        else slot = 'ring1';
    }

    // 🦻 耳環欄位分配：一開始 1 個（ear1），Lv50 開放第 2 個（ear2），最多 2 個
    if (slot === 'ear') {
        if(!player.eq.ear1) slot = 'ear1';
        else if(player.lv >= 50 && !player.eq.ear2) slot = 'ear2';   // 第2耳環欄：需 Lv50
        else slot = 'ear1';
    }
    // 🦻 不能同時裝備兩個名字相同的耳環
    if (slot === 'ear1' || slot === 'ear2') {
        let _other = (slot === 'ear1') ? player.eq.ear2 : player.eq.ear1;
        if (_other && DB.items[_other.id] && DB.items[_other.id].n === d.n) {
            logSys(`<span class="text-amber-300">「${d.n}」無法同時裝備兩個名字相同的耳環。</span>`);
            return;
        }
    }

    // 💍 相同名字戒指最多裝兩顆：目標欄以外的戒指欄已有 2 顆同款（同 id）→ 阻擋裝第 3 顆（換上同款升級/不同強化值不受影響）
    if ((slot === 'ring1' || slot === 'ring2' || slot === 'ring3' || slot === 'ring4')
        && ['ring1','ring2','ring3','ring4'].filter(rs => rs !== slot && player.eq[rs] && player.eq[rs].id === item.id).length >= 2) {
        logSys(`<span class="text-amber-300">「${d.n}」相同的戒指最多只能同時裝備 2 顆。</span>`);
        return;
    }

    // 🔧 詛咒鎖定：欲換裝的欄位若有詛咒裝備，無法替換（等同被迫卸下）
    if (isEquipCursed(slot)) { logSys('<span class="text-red-400 font-bold">原本的裝備被詛咒纏身，無法更換！</span><span class="text-red-300">請先解除詛咒。</span>'); return; }
    // 雙手武器（弓 / w2h）無法與盾牌並存：裝雙手武器自動卸盾、裝盾自動卸雙手武器
    // 🛡️ 臂甲（armguard）例外：可與雙手武器並用，故不互相卸下（仍與盾牌共用副手欄、自然互斥）
    if (slot === 'wpn' && effTwoHanded(d, item.id) && player.eq.shield && !DB.items[player.eq.shield.id].armguard) {
        if (isEquipCursed('shield')) { logSys('<span class="text-red-400 font-bold">被詛咒的盾牌無法卸下，無法裝備雙手武器！</span>'); return; }
        returnEquipToInv('shield');
        logSys(`雙手武器無法持盾，已卸下盾牌。`);
    } else if (slot === 'shield' && !d.armguard && player.eq.wpn && effTwoHanded(DB.items[player.eq.wpn.id], player.eq.wpn.id)) {
        if (isEquipCursed('wpn')) { logSys('<span class="text-red-400 font-bold">被詛咒的雙手武器無法卸下，無法裝備盾牌！</span>'); return; }
        returnEquipToInv('wpn');
        logSys(`裝備盾牌，已卸下雙手武器。`);
    }

    let invItem = player.inv.find(i => i.uid === item.uid);
    if (!invItem) return;

    let isStackable = (slot === 'arrow'); // 箭矢支援整組堆疊裝備

    // 如果該欄位已經有裝備，先退回背包。
    // 必須在快照 singleItem「之前」執行：同種箭矢會併入即將裝備的同一堆疊，
    // 若先快照數量再合併，整疊移除時舊箭會憑空消失（如身上500+背包1000 → 裝備後只剩1000）。
    if (player.eq[slot]) {
        let oldEq = player.eq[slot];
        let ex = player.inv.find(i => sameItemSig(i, oldEq) && !i.lock && !i.junk);   // 🔧 架構#3：統一簽章比對
        if(ex) ex.cnt += oldEq.cnt;
        else player.inv.push(oldEq);
        player.eq[slot] = null;
    }

    let singleItem = { ...invItem, cnt: isStackable ? invItem.cnt : 1, uid: isStackable ? invItem.uid : uid() };   // 非堆疊裝備：裝上的實例給新 uid，避免與背包剩餘堆疊共用同一 uid 而造成物品消失
    
    // 從背包扣除 (箭矢直接移除整把，其他扣 1 個)
    if (isStackable) {
        player.inv = player.inv.filter(i => i.uid !== invItem.uid);
    } else {
        invItem.cnt--;
        if (invItem.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== invItem.uid);
    }
    
    player.eq[slot] = singleItem;
    syncShahaArrow();   // 🏝️ 沙哈之弓：裝備/換武器後同步無限箭
    syncDualWield();    // ⚔️ 迅猛雙斧：換主手後若副手條件失效則退回背包

    logSys(`裝備了 ${getItemFullName(singleItem)}。`);
    calcStats();
    renderTabs();
    renderSkillSelects();   // 穿戴裝備後即時更新自動化技能選項（如魔法頭盔授予的法術）
    closeModal();
}

// 🔧 詛咒鎖定：裝備出現「詛咒的」時無法卸下，也無法被換裝退回背包；需先用解除詛咒卷軸消除詛咒
function isEquipCursed(slot) { let e = player.eq[slot]; return !!(e && e.bless === 'cursed'); }

function unequipItem(slot) {
    if (isEquipCursed(slot)) { logSys('<span class="text-red-400 font-bold">這件裝備被詛咒纏身，無法卸下！</span><span class="text-red-300">請至象牙塔『碧恩』處使用 解除詛咒的卷軸 消除詛咒。</span>'); return; }
    if (player.eq[slot]) {
        let e = player.eq[slot];
        if (e.id === 'wpn_shaha_arrow') {   // 🏝️ 沙哈之箭＝虛擬無限箭：卸下不回背包（避免外洩→販售/存倉/複製）；仍裝沙哈之弓則由 syncShahaArrow 重新注入
            player.eq[slot] = null;
        } else {
            let ex = player.inv.find(i => sameItemSig(i, e) && !i.lock && !i.junk);   // 🔧 架構#3：統一簽章比對
            if(ex) ex.cnt += e.cnt;
            else player.inv.push(e);
            player.eq[slot] = null;
        }
        syncShahaArrow();   // 🏝️ 卸下沙哈之弓 → 移除無限箭
        syncDualWield();    // ⚔️ 迅猛雙斧：卸下主手後副手條件失效則退回背包
        calcStats();
        renderTabs();
        renderSkillSelects();   // 卸下裝備後即時更新自動化技能選項
    }
    closeModal();
}

function consume(item) {
    item.cnt--;
    if (item.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== item.uid);
    renderTabs();
}

function buyItem(id, qty) {
    qty = Math.max(1, Math.floor(Number(qty) || 1));   // 數量正規化，至少 1

    // 箭 / 銀箭 / 肉：一「份」= 1000，單價固定，qty 代表份數
    let bundle = (id === 'wpn_5')        ? { unit: 100, amount: 1000, n: '箭',   suffix: '根' }
               : (id === 'wpn_22')       ? { unit: 200, amount: 1000, n: '銀箭', suffix: '根' }
               : (id === 'new_item_143') ? { unit: 100, amount: 1000, n: '肉',   suffix: '個' }
               : null;
    if (bundle) {
        let cost = shopPrice(bundle.unit) * qty;
        if (player.gold < cost) { logSys(`金幣不足。`); return; }
        player.gold -= cost;
        gainItem(id, bundle.amount * qty, true, true);
        logSys(`購買了 ${bundle.n} (${(bundle.amount * qty).toLocaleString()}${bundle.suffix})。`);
        updateUI();
        return;
    }

    // 一般物品：單價 p × 數量
    let p = shopPrice(DB.items[id].p || 0);
    let cost = p * qty;
    if (player.gold < cost) { logSys(`金幣不足。`); return; }
    player.gold -= cost;
    gainItem(id, qty, true, true);
    logSys(`購買了 ${DB.items[id].n}${qty > 1 ? ` ×${qty}` : ''}。`);
    updateUI();
}

let activeScroll = null;
function openEnhanceModal(scroll) {
    if (traditionalActive()) { logSys('<span class="text-amber-300">🏛️ 傳統模式無法強化裝備。</span>'); return; }   // 🏛️ 縱深防護：傳統模式封鎖卷軸強化路徑
    activeScroll = scroll;
    let targets = Object.values(player.eq).filter(e => e && DB.items[e.id].type === scroll.target && !isMaxEnhanced(e) && !DB.items[e.id].noEnhance);   // 🔧 已達強化上限者不列入；🏛️ 無法強化的裝備（古老系列）不列入
    
    document.getElementById('modal-item-name').innerHTML = getItemFullName(scroll) + " (選擇目標)";
    document.getElementById('modal-item-name').className = `text-xl font-bold mb-3 border-b border-slate-600 pb-3 ${getItemColor(scroll)}`;
    document.getElementById('modal-item-desc').innerHTML = "請選擇身上要強化的裝備：";
    
    let act = '';
    if (targets.length === 0) {
        act = '<p class="text-slate-400">身上沒有可以強化的對應裝備。</p>';
    } else {
        targets.forEach(t => {
            // 👇 修改點：傳入 true 確保相容新的 isEq 參數
            act += `<button class="w-full btn border-slate-600 bg-slate-800 hover:bg-slate-700 py-2 text-base font-bold ${getItemColor(t)}" onclick="doEnhance('${t.uid}', true)">${getItemFullName(t)}</button>`;
        });
    }
    
    document.getElementById('modal-actions').innerHTML = act;
    document.getElementById('item-modal').classList.remove('hidden');
}

function doEnhance(targetUid, isEq = true) {
    if (traditionalActive()) return;   // 🏛️ 縱深防護：傳統模式不可強化
    if(!activeScroll) return;
    
    let target, slot;
    if (isEq) {
        target = Object.values(player.eq).find(e => e && e.uid === targetUid);
        slot = Object.keys(player.eq).find(k => player.eq[k] === target);
    } else {
        target = player.inv.find(i => i.uid === targetUid);
    }
    
    if(!target) return;

    let d = DB.items[target.id];
    let _cap = enhanceCap(d);   // 🔧 強化上限：武器+20 / 防具+15 / 飾品+10
    if ((Number(target.en) || 0) >= _cap) {   // 已達上限：不消耗卷軸，提示後返回
        logSys(`<span class="text-amber-300">${getItemFullName(target)} 已達強化上限（+${_cap}），無法再強化。</span>`);
        activeScroll = null; closeModal();
        return;
    }
    let scroll = activeScroll;
    activeScroll = null;
    consume(scroll); // 消耗卷軸
    
    // 👇 核心邏輯：如果強化的是「背包」裡的裝備，且數量 > 1，則拆分出一件來衝，保護其餘裝備不被波及
    if (!isEq && target.cnt > 1) {
        target.cnt--;
        let singleItem = { ...target, cnt: 1, uid: uid() }; 
        player.inv.push(singleItem);
        target = singleItem; 
    }
    
    let success = false, destroy = false, nochange = false;
    let safe = d.safe || 0;
    // 防呆：強化值正規化為有效數字。若 en 為 undefined/NaN，(undefined < safe) 會是 false 而誤入失敗/爆裝分支，
    //        導致看似 +0 的武器仍可能消失。此處統一視為 0，確保 +0(含未初始化 en)在安定值內必定成功、不會爆裝。
    target.en = Number(target.en) || 0;
    
    // 強化成功率：採用固定值（非浮動公式）。
    //   安定值之前(en < safe)一律 100% 成功；祝福卷軸跳級到安定值以上也不套用失敗/爆裝（成功在加值前判定）。
    //   武器(安定值6)：+6→60%、+7→50%、+8→40%、+9以上→35%
    //   防具安定值0：+0~+4→50%、+5→40%、+6→30%、+7以上→20%
    //   防具安定值4：+4→50%、+5→40%、+6→30%、+7以上→20%
    //   防具安定值6：+6→30%、+7以上→20%
    if (target.en < safe) {
        success = true;   // 安定值之前必定成功（祝福卷軸跳級超過安定值也算這次，不爆裝）
    } else {
        let en = target.en, rate;
        if (d.type === 'wpn') {                       // 武器一律安定值6
            rate = en === 6 ? 0.60 : en === 7 ? 0.50 : en === 8 ? 0.40 : 0.35;
        } else if (d.type === 'acc') {                // 飾品：一律安定值0（+0 50%、+1 40%、+2 30%、+3↑ 20%）
            rate = en === 0 ? 0.50 : en === 1 ? 0.40 : en === 2 ? 0.30 : 0.20;
        } else if (safe === 0) {                      // 防具：安定值0
            rate = en <= 4 ? 0.50 : en === 5 ? 0.40 : en === 6 ? 0.30 : 0.20;
        } else if (safe === 4) {                      // 防具：安定值4
            rate = en === 4 ? 0.50 : en === 5 ? 0.40 : en === 6 ? 0.30 : 0.20;
        } else {                                      // 防具：安定值6（其餘安定值防呆比照）
            rate = en === safe ? 0.30 : 0.20;
        }
        if (enRandom(target) < rate) success = true;  // 🎲 決定論：成敗由 (enSeed,uid,en) 決定，讀檔/匯入舊檔回到強化前算出相同結果（不可 save/load 刷）
        else destroy = true;                          // 失敗即爆裝
    }
    
    let fn = getItemFullName(target);
    if (success) {
        let add = (DB.items[scroll.id] && DB.items[scroll.id].isB) ? (1 + Math.floor(enRandom(target, 'amt') * 3)) : 1;   // 🎲 祝福加值也決定論化（防 save/load 重洗 +2/+3）
        target.en = Math.min(_cap, target.en + add);   // 🔧 祝福卷軸跳級不超過上限
        let prefix = (target.en > (d.safe||0)) ? "持續" : "";
        let _enTxt = '+' + capEn(target.en, d);   // 🔧 顯示 +N（夾擠至強化上限）
        logSys(`<span class="text-yellow-400 font-bold">${_enTxt} ${d.n} ${prefix}發出銀色的光芒。</span>`);
    } else if (destroy) {
        logSys(`<span class="text-red-500 font-bold">${fn} 強烈的發出銀色的光芒就消失了。</span>`);
        if (isEq) {
            player.eq[slot] = null; // 碎掉身上裝備
        } else {
            player.inv = player.inv.filter(i => i.uid !== target.uid); // 碎掉背包裝備
        }
    } else {
        logSys(`<span class="text-slate-400">${fn} 一瞬間發出銀色的光芒。</span>`);
    }
    
    calcStats();
    renderTabs();
    closeModal();
    
    // 👇 自動存檔機制：不論成功、失敗或無變化，結算完立刻強制儲存進度！
    saveGame(); 
}

// 玩家身上的「減益(debuff)」狀態對照表（player.statuses 內具持續時間的鍵）
const PLAYER_DEBUFF_NAME = {
    stun: '暈眩', freeze: '冰凍', stone: '石化', paralyze: '麻痺',
    silence: '沉默', magicseal: '魔法封印', poison: '中毒',
    burn: '灼燒', scald: '燙傷', evilAura: '邪靈之氣'
};

// 增益顏色設定：
// 1) 想單獨指定某個技能的顏色，直接在 BUFF_COLOR_OVERRIDE 加一行即可（key = 技能ID）
// 2) 未指定者，依技能效果類別自動上色（攻擊/防禦/能力/回復/召喚/加速）
const BUFF_COLOR_OVERRIDE = {
    // 範例： "sk_shield": "text-cyan-300", "sk_berserk": "text-red-400",
};

function getBuffColor(k, def) {
    if(BUFF_COLOR_OVERRIDE[k]) return BUFF_COLOR_OVERRIDE[k];
    if(def.summon) return 'text-pink-400';            // 召喚類 (粉紅)
    if(def.haste)  return 'text-emerald-400';         // 加速類 (翠綠)
    let d = def.d || {};
    if(['meleeDmg','rangedDmg','extraDmg','magicDmg','meleeHit','rangedHit','extraHit','magicHit'].some(s => d[s]))
        return 'text-rose-400';                       // 攻擊增益 (玫瑰紅)
    if(['ac','er','mr','dr','resFire','resWater','resEarth','resWind'].some(s => d[s]))
        return 'text-sky-300';                        // 防禦增益 (天藍)
    if(['str','dex','con','int','wis'].some(s => d[s]))
        return 'text-violet-400';                     // 能力增益 (紫羅蘭)
    if(d.mpR || d.extraMp) return 'text-blue-400';    // 回復/魔力 (深藍)
    return 'text-amber-300';                          // 其他 (琥珀黃)
}

// 統一渲染「狀態」欄：魔法/藥水增益(buff) + 受到的減益(debuff)
function renderStatusEffects() {
    if(state.ff) return; // 補跑期間不刷新畫面
    let el = document.getElementById('dt-buffs');
    if(!el) return;

    // ===== 增益 BUFF =====
    let buffs = [];
    if(player.buffs.haste>0 || player._equipHaste) buffs.push(`<span class="text-emerald-400 font-bold">加速</span>`);
    if(player.buffs.brave>0) buffs.push(`<span class="text-fuchsia-400 font-bold">勇水</span>`);
    if(player.buffs.blue>0) buffs.push(`<span class="text-blue-400 font-bold">藍水</span>`);
    if(player.buffs.cautious>0) buffs.push(`<span class="text-violet-400 font-bold">慎水</span>`);
    if(player.buffs.elfcookie>0) buffs.push(`<span class="text-yellow-300 font-bold">精靈餅乾</span>`);
    // 變身顯示：套裝變身(_setPoly，僅穿著時生效)優先於藥水變身，與 recomputeStats 的數值優先序一致 → 穿上惡魔/死亡騎士/克特套裝會立即取代卷軸變身的名稱顯示
    { let _polyDisp = player._setPoly || ((player.buffs.poly>0 && player.poly) ? player.poly : null);
      if(_polyDisp) buffs.push(`<span class="${_polyDisp.c} font-bold">變身:${_polyDisp.n}</span>`); }

    // 協力角色顯示
    if(player.allies && player.allies.length) {
        player.allies.forEach(a => { if(a){ let _mp = (a.cls === 'mage' || a.cls === 'elf') ? ` <span class="text-blue-300">MP ${Math.floor(a.mp||0)}</span>` : ''; buffs.push(`<span class="text-emerald-300 font-bold">協力：${allyName(a)}</span>${_mp}`); } });
    }
    // 👇 補上夥伴與誘捕狀態的顯示（可同時多種夥伴，數字=持有項圈數量，為1不顯示）
    if(player.partners && player.partners.length) {
        player.partners.forEach(nm => {
            let cnt = petCollarCount(nm);
            buffs.push(`<span class="text-orange-400 font-bold">夥伴：${nm}${cnt > 1 ? (' ' + cnt) : ''}</span>`);
        });
    }
    if(player.buffs.taming > 0) buffs.push(`<span class="text-pink-300 font-bold">誘捕</span>`);

    // 🔮 席琳套裝：達 2 件以上（觸發套裝能力）的組別顯示於資訊面板（n/5）
    if (player._sherineSetCnt) {
        for (let _g in player._sherineSetCnt) {
            let _n = Math.min(5, player._sherineSetCnt[_g]);
            if (_n >= 2) buffs.push(`<span class="c-sherine font-bold">${_g} ${_n}/5</span>`);
        }
    }

    // 魔法技能增益：凡是 player.buffs 中對應到 DB.skills 的鍵且 >0，皆顯示（僅中文名稱，依類別上色）
    for(let k in player.buffs) {
        if(player.buffs[k] > 0 && DB.skills[k]) {
            // 迷魅術：狀態欄改顯示「迷魅：怪物名稱」，並以實際被迷魅的僕人(player.summon)為準；
            //   僕人不存在（死亡解除 / 被新召喚取代 / 已消失）時就不顯示，避免殘留。
            // 迷魅術 / 各召喚術：狀態欄改顯示召喚物名稱（近戰召喚附上隨從數字 floor(魅力/6)，為1則不顯示）；
            //   召喚物不存在（死亡解除 / 被新召喚取代 / 已消失）時就不顯示，避免殘留。
            if(k === 'sk_charm' || DB.skills[k].summon) {
                let _creature = (k === 'sk_charm') ? player.charmed : player.summon;
                if(_creature && _creature.skId === k) {
                    let _chaC = Math.min(60, player.d.cha || 0);
                    let cnt = (k === 'sk_charm') ? 0
                        : (_creature.kind === 'melee') ? Math.floor(_chaC / 6)
                        : (hasMastery('e_spirit') && (k === 'sk_elf_summon' || k === 'sk_elf_summon2')) ? Math.min(7, 1 + Math.floor(_chaC / 10))   // 🏅 精靈精通：屬性精靈顯示數量 1+魅力/10（上限7）
                        : 0;
                    let suffix = cnt > 1 ? ` ${cnt}` : '';
                    buffs.push(`<span class="${getBuffColor(k, DB.skills[k])} font-bold">${_creature.n}${suffix}</span>`);
                }
                continue;
            }
            buffs.push(`<span class="${getBuffColor(k, DB.skills[k])} font-bold">${DB.skills[k].n}</span>`);
        }
    }

    // ===== 減益 DEBUFF（玩家受到的異常狀態）=====
    // 為不同減益設定專屬對應顏色
    const DEBUFF_COLORS = {
        stun: 'text-yellow-500',     // 暈眩 (金黃)
        freeze: 'text-cyan-400',     // 冰凍 (青藍)
        stone: 'text-stone-400',     // 石化 (石頭灰)
        paralyze: 'text-indigo-400', // 麻痺 (靛藍)
        silence: 'text-slate-400',   // 沉默 (鐵灰)
        magicseal: 'text-fuchsia-500',// 魔法封印 (紫紅)
        poison: 'text-green-500',    // 中毒 (毒綠)
        burn: 'text-red-500',        // 灼燒 (火紅)
        scald: 'text-orange-500',    // 燙傷 (橘紅)
        evilAura: 'text-purple-400'  // 邪靈之氣 (邪紫)
    };

    let debuffs = [];
    for(let k in PLAYER_DEBUFF_NAME) {
        if(player.statuses[k] > 0) {
            let c = DEBUFF_COLORS[k] || 'text-red-400';
            debuffs.push(`<span class="${c} font-bold">${PLAYER_DEBUFF_NAME[k]}</span>`);
        }
    }

    let html = `狀態: ${buffs.length ? buffs.join(" / ") : "正常"}`;
    if(debuffs.length) html += `<div class="mt-2 font-bold border-t border-slate-700 pt-1">異常: ${debuffs.join(" / ")}</div>`;
    el.innerHTML = html;
}

function _updateUIImpl() {
    if(state.ff) return; // 補跑期間不刷新畫面
    updatePrideFloorIndicator();   // 🗼 攀登中右上角顯示目前樓層（背景補跑後回到前景時同步）
    try { renderPandoraBanner(); } catch (e) {}   // 🔧 潘朵拉黑市稀有商品公告橫幅
    try { renderSyslogPandora(); } catch (e) {}   // 🔧 系統日誌標題列右側：黑市拍賣中商品
    document.getElementById('st-lv').innerText = player.lv;
    { let _inTown = mapState.current.startsWith('town_');   // 🔧 村莊→藍色「出發」一鍵回上一張戰鬥地圖；戰鬥地圖→綠色回村/回城
      let _txt = _inTown ? '出發' : (siegeVictoryActive() ? '回城' : '回村');
      let _fn  = _inTown ? departToLastBattle : returnToTown;
      let _riftLock = (state.riftRun && mapState.current === 'rift_battle');   // 🌀 裂痕內：回村/出發 → 紫色「撤離」（主動結算，照樣記時間＋發獎勵；不可一般回村/傳送）
      if (_riftLock) { _txt = '撤離'; _fn = riftEvacuate; }
      let rb = document.getElementById('btn-return-town');
      if (rb) { rb.style.display = ''; rb.textContent = _txt; rb.onclick = _fn; rb.style.background = _riftLock ? '#7c3aed' : (_inTown ? '#1d4ed8' : ''); rb.style.borderColor = _riftLock ? '#c4b5fd' : (_inTown ? '#93c5fd' : ''); }
      // 📱 手機常駐快捷鍵：與桌機按鈕同步（藍＝出發、綠＝回村/回城、紫＝撤離）
      let mb = document.getElementById('mv-action-btn');
      if (mb) { mb.style.display = ''; mb.textContent = _txt; mb.onclick = _fn; mb.style.background = _riftLock ? '#7c3aed' : (_inTown ? '#1d4ed8' : '#047857'); mb.style.borderColor = _riftLock ? '#c4b5fd' : (_inTown ? '#93c5fd' : '#34d399'); }
      // 🌀 順移按鈕：固定顯示（含村莊/野外/狩獵/隱藏區域），不隨敵人或每幀重繪閃爍；僅在「傳送會破壞玩法」的鎖定模式隱藏（裂痕/傲慢之塔封鎖樓/遺忘之島/軍王之室）。
      // ⚠️ 用「狀態改變才寫 DOM」的守衛：避免每個 tick 重複 toggle class / 設 display 造成按鈕閃爍。
      { let tpb = document.getElementById('btn-teleport'); if (tpb) { let _hideTp = !!(KING_ROOMS[mapState.current] || (typeof prideTeleportBlocked === 'function' && prideTeleportBlocked()) || state.oblivion); if (tpb.classList.contains('hidden') !== _hideTp) { tpb.classList.toggle('hidden', _hideTp); tpb.style.display = _hideTp ? 'none' : ''; } } } }   // ⚠️ _hideTp 必須 !! 強轉布林：否則 (undefined||false||undefined)===undefined → 守衛 (boolean!==undefined) 恆真 → toggle('hidden', undefined) 變成「無參數 bare toggle」每幀翻轉 → 按鈕閃爍
    { let vb = document.getElementById('victory-badge'); if (vb) { let _va = siegeVictoryActive(); vb.style.display = _va ? 'inline-flex' : 'none'; if (_va) vb.title = `攻城獲勝期間：全商店8折、開放${victoryCityCfg().castleName}`; } }   // 攻城獲勝淡金黃標記（inline-flex 讓👑與文字水平置中；🔧 tooltip 依實際獲勝城池動態，不再固定肯特）
    { let cb = document.getElementById('classic-badge'); if (cb) cb.style.display = (player.classicMode && !player.traditionalMode) ? 'inline' : 'none'; let tb = document.getElementById('traditional-badge'); if (tb) tb.style.display = player.traditionalMode ? 'inline' : 'none'; }   // 🎮 經典／🏛️ 傳統模式標記（傳統角色顯示傳統徽章、不重複顯示經典）
    applyAreaBackground();   // 區域背景：地監/攻城→戰鬥區、城堡→村莊畫面
    
    // 處理顯示文字：只顯示 騎士、法師、妖精、黑暗妖精
    let clsDisplayName = '';
    if (player.cls === 'knight') clsDisplayName = '騎士';
    else if (player.cls === 'mage') clsDisplayName = '法師';
    else if (player.cls === 'elf') clsDisplayName = '妖精';
    else if (player.cls === 'dark') clsDisplayName = '黑暗妖精';   // 🔧 黑暗妖精職業名
    else if (player.cls === 'illusion') clsDisplayName = '幻術士';   // 🔧 幻術士職業名
    else if (player.cls === 'dragon') clsDisplayName = '龍騎士';   // 🐉 龍騎士職業名
    else if (player.cls === 'warrior') clsDisplayName = '戰士';   // ⚔️ 戰士職業名
    else if (player.cls === 'royal') clsDisplayName = '王族';   // 👑 王族職業名
    if(document.getElementById('st-classname')) document.getElementById('st-classname').innerText = clsDisplayName;   // 🏅 精通徽記已移除，僅顯示職業名
    if(!window._editingName) document.getElementById('st-class').innerText = (player.name || '');   // 未取名則不顯示任何文字（仍可點擊命名）

    // 處理背景圖片：抓取 player.avatar 決定背景圖 (加上 bg-top 防止頭部裁切)
    let bgImageName = player.avatar || clsDisplayName;
    let bgExt = (player.cls === 'dark' || player.cls === 'illusion' || player.cls === 'dragon' || player.cls === 'warrior' || player.cls === 'royal') ? 'png' : 'jpg';   // 🔧 黑暗妖精／幻術士／龍騎士／戰士／王族頭像為 png，其餘職業為 jpg
    document.getElementById('status-panel').style.backgroundImage = `url('assets/character/${bgImageName}.${bgExt}')`;
    document.getElementById('status-panel').classList.add('bg-top'); // 確保圖片從頂部對齊

    document.getElementById('st-ac').innerText = player.d.ac;
    document.getElementById('st-mr').innerText = player.d.mr;
    document.getElementById('st-gold').innerText = player.gold.toLocaleString();
    
    document.getElementById('txt-hp').innerText = `${Math.floor(player.hp)}/${Math.floor(player.mhp)}`;
    document.getElementById('bar-hp').style.width = `${Math.max(0, (player.hp/player.mhp)*100)}%`;
    document.getElementById('txt-mp').innerText = `${Math.floor(player.mp)}/${Math.floor(player.mmp)}`;
    document.getElementById('bar-mp').style.width = `${Math.max(0, (player.mp/player.mmp)*100)}%`;
    // 📱 手機置頂常駐 HP/MP 細條：同步主血條數值（桌機隱藏，更新無副作用）
    { let _mh = document.getElementById('mv-hp-fill'); if (_mh) {
        _mh.style.width = `${Math.max(0, (player.hp/player.mhp)*100)}%`;
        document.getElementById('mv-hp-txt').innerText = `${Math.floor(player.hp)}/${Math.floor(player.mhp)}`;
        document.getElementById('mv-mp-fill').style.width = `${Math.max(0, (player.mp/player.mmp)*100)}%`;
        document.getElementById('mv-mp-txt').innerText = `${Math.floor(player.mp)}/${Math.floor(player.mmp)}`;
    } }
    // 🏰 城堡護衛：狀態欄顯示名字＋HP
    { let _gr = document.getElementById('castle-guard-row'), _g = player.castleGuard;
      if (_gr) { if (_g && siegeVictoryActive()) { _gr.classList.remove('hidden');
          let _heal = _g.mode === 'heal';
          let _cur = _heal ? _g.mp : _g.hp, _max = _heal ? _g.maxMp : _g.maxHp;
          document.getElementById('cg-name').innerText = _g.name + (_g.disabled ? (_heal ? '(耗盡)' : '(力竭)') : '');
          document.getElementById('cg-txt').innerText = `${Math.floor(_cur)}/${_max} ${_heal ? 'MP' : ''}`.trim();
          let _bar = document.getElementById('cg-bar');
          _bar.className = `bar-fill ${_heal ? 'bg-green-500' : 'bg-amber-500'}`;
          _bar.style.width = `${Math.max(0, (_cur/_max)*100)}%`;
        } else { _gr.classList.add('hidden'); } } }
    
    let nxtE = getExpReq(player.lv);
    let pct = player.lv >= 100 ? 100 : (nxtE > 0 && isFinite(nxtE) ? (player.exp / nxtE) * 100 : 0);
    document.getElementById('txt-exp').innerText = `${pct.toFixed(2)}%`;
    document.getElementById('bar-exp').style.width = `${Math.min(100, pct)}%`;
    
    if (_respec) {   // 🕯️ 回憶蠟燭配點重置中：六大屬性顯示「Lv1 基礎 + 草稿配點」（確認後才真正套用）
        let _b = createBase[player.cls];
        ['str','dex','con','int','wis','cha'].forEach(s => { let el = document.getElementById('dt-'+s); if (el) el.innerText = _b[s] + _respec.draft[s]; });
    } else {
        document.getElementById('dt-str').innerText = player.d.str;
        document.getElementById('dt-dex').innerText = player.d.dex;
        document.getElementById('dt-con').innerText = player.d.con;
        document.getElementById('dt-int').innerText = player.d.int;
        document.getElementById('dt-wis').innerText = player.d.wis;
        if(document.getElementById('dt-cha')) document.getElementById('dt-cha').innerText = player.d.cha;
    }
    
    const sign = v => (v >= 0 ? '+' : '') + v;
    // 額外傷害/命中：折入近距離與遠距離的顯示（兩者都 +）
    let _ed = player.d.extraDmg || 0, _eh = player.d.extraHit || 0;
    // 近距離
    document.getElementById('dt-mdmg').innerText = sign(player.d.meleeDmg + _ed);
    document.getElementById('dt-mhit').innerText = sign(player.d.meleeHit + _eh);
    document.getElementById('dt-mcrit-p').innerText = `${player.d.meleeCrit}%`;
    // 遠距離
    document.getElementById('dt-rdmg').innerText = sign(player.d.rangedDmg + _ed);
    document.getElementById('dt-rhit').innerText = sign(player.d.rangedHit + _eh);
    document.getElementById('dt-rcrit').innerText = `${player.d.rangedCrit}%`;
    // 額外（已折入近/遠距離，列固定隱藏）
    document.getElementById('dt-edmg').innerText = sign(_ed);
    document.getElementById('dt-ehit').innerText = sign(_eh);
    // 依目前武器類型切換顯示：弓(遠距離武器)→隱藏近距離列；否則→隱藏遠距離列。箭矢在 arrow 欄，不影響判定。
    let _wpnRanged = !!(player.eq.wpn && DB.items[player.eq.wpn.id] && DB.items[player.eq.wpn.id].ranged === true);
    document.querySelectorAll('[data-grp="melee"]').forEach(e => e.classList.toggle('row-hidden', _wpnRanged));
    document.querySelectorAll('[data-grp="ranged"]').forEach(e => e.classList.toggle('row-hidden', !_wpnRanged));
    document.querySelectorAll('[data-grp="extra"]').forEach(e => e.classList.add('row-hidden'));
    // 魔法
    document.getElementById('dt-mgdmg').innerText = sign(player.d.magicDmg);
    document.getElementById('dt-sp').innerText = sign(player.d.extraMp);
    document.getElementById('dt-mhit-mag').innerText = sign(player.d.magicHit);
    document.getElementById('dt-mcrit').innerText = `${player.d.magicCrit}%`;
    document.getElementById('dt-mpreduce').innerText = `${player.d.mpReduce}%`;
	if(document.getElementById('dt-mpr')) document.getElementById('dt-mpr').innerText = formatBonus(player.d.mpR);
	if(document.getElementById('dt-hpr')) document.getElementById('dt-hpr').innerText = formatBonus(player.d.hpR || 0);
    document.getElementById('dt-er').innerText = `${effResistPct(player.d.er)}%`;   // 🔧 顯示有效迴避率（>50 每+5才+1%）
    document.getElementById('dt-dr').innerText = player.d.dr;
    document.getElementById('dt-spd').innerText = `${player.d.aspd.toFixed(2)}s`;
    if(document.getElementById('dt-resfire')) {
        document.getElementById('dt-resfire').innerText  = `${effResistPct(player.d.resFire  || 0)}%`;   // 🔧 顯示有效減傷%（>50 每+5才+1%）
        document.getElementById('dt-reswater').innerText = `${effResistPct(player.d.resWater || 0)}%`;
        document.getElementById('dt-reswind').innerText  = `${effResistPct(player.d.resWind  || 0)}%`;
        document.getElementById('dt-researth').innerText = `${effResistPct(player.d.resEarth || 0)}%`;
    }
    
    renderStatusEffects();
    
    {   // 🕯️ 配點工具列：回憶蠟燭重置中(可 +/- 並確認/取消) 或 有未分配升級點數(僅 +) 時顯示
        let _respecOn = !!_respec;
        let _editing = _respecOn || (player.bonus || 0) > 0;
        let _ptsLeft = _respecOn ? respecPtsLeft() : (player.bonus || 0);
        document.querySelectorAll('.alloc-plus').forEach(el => el.classList.toggle('hidden', !_editing));
        document.querySelectorAll('.alloc-minus').forEach(el => el.classList.toggle('hidden', !_respecOn));   // 只有蠟燭重置可退點
        let _bar = document.getElementById('alloc-edit-bar');
        if (_bar) {
            _bar.classList.toggle('hidden', !_editing);
            let _lbl = document.getElementById('alloc-bar-label'); if (_lbl) _lbl.textContent = (_respecOn ? '剩餘配點：' : '升級點數：') + _ptsLeft;
            let _hint = document.getElementById('alloc-bar-hint'); if (_hint) _hint.classList.toggle('hidden', !_respecOn);
            let _cf = document.getElementById('alloc-confirm-btn'); if (_cf) _cf.classList.toggle('hidden', !_respecOn);
            let _cc = document.getElementById('alloc-cancel-btn'); if (_cc) _cc.classList.toggle('hidden', !_respecOn);
        }
    }
    updateSummonLock();   // 同步召喚類技能互斥鎖定（含迷魅生效時鎖定召喚增益）
}
