// ===== 🎴 卡片收集系統（依 Downloads\卡片收集系統 (1).md）=====
// 載入順序最後：可安全引用 DB.mobs / DB.maps（js/00）、MAP_REGIONS（js/11）、HIDDEN_AREA_NAMES（js/02）。
// recompute/掉落/使用 等鉤子由各檔以 typeof 守衛呼叫本檔函式（皆執行期才呼叫，故順序無虞）。

// ---- 卡片收集冊本體：唯一・無法販賣・無法存倉・創角預設・使用開啟全螢幕書頁 ----
DB.items['item_card_book'] = {
    n: '卡片收集冊', type: 'misc', eff: 'cardbook', c: 'text-amber-300',
    img: 'assets/icons/items/卡片收集冊.png', p: 0, gachaWeight: 0,
    unique: true, noSell: true, noJunk: true, maxHold: 1,
    d: '記錄你討伐過的怪物之證。使用以翻開收集冊。<br>唯一、無法販賣、無法存入倉庫。'
};

// ---- 卡片階級 ----
const CARD_TIERS = [
    { t: 1, key: 'p', sfx: '普卡', col: 'c-card-common', img: 'assets/icons/items/普卡.png', price: 100 },
    { t: 2, key: 's', sfx: '銀卡', col: 'c-card-silver', img: 'assets/icons/items/銀卡.png', price: 1000 },
    { t: 3, key: 'g', sfx: '金卡', col: 'c-card-gold',   img: 'assets/icons/items/金卡.png', price: 10000 }
];
function cardId(name, tier) { return 'card_' + CARD_TIERS[tier - 1].key + '_' + name; }

// ---- 卡片地區（大區域；小區域與對應隱藏區整併；只含有怪物的圖）----
//  stat：完成加成屬性；vals：[全普卡, 全銀卡, 全金卡]；maps：DB.maps key（'__pride__' 動態展開為全部 pride_* 樓層池）。
const CARD_REGIONS = [
    { key: 'silverknight', name: '銀騎士村',   stat: 'mhp',      vals: [3, 5, 10],  maps: ['silver_knight', 'training'] },
    { key: 'fairyforest',  name: '妖精森林',   stat: 'mmp',      vals: [3, 5, 10],  maps: ['zone_01', 'zone_15', 'zone_16', 'zone_17'] },
    { key: 'talkingisland',name: '說話之島',   stat: 'mpR',      vals: [1, 2, 3],   maps: ['talking_island_port', 'talking_island', 'zone_13', 'zone_14'] },
    { key: 'burningwillow',name: '燃柳',       stat: 'hpR',      vals: [1, 2, 3],   maps: ['elf_forest', 'pirate_wild', 'pirate_dungeon', 'elf_grave', 'hidden_cave'] },
    { key: 'gludin',       name: '古魯丁',     stat: 'dr',       vals: [1, 2, 3],   maps: ['gludio', 'zone_06', 'zone_07', 'zone_08', 'zone_09', 'zone_10', 'zone_11', 'zone_12'] },
    { key: 'kent',         name: '肯特',       stat: 'mhp',      vals: [3, 5, 10],  maps: ['kent'] },
    { key: 'windwood',     name: '風木',       stat: 'weight',   vals: [10, 30, 50],maps: ['windwood_dungeon', 'windwood', 'desert', 'zone_22', 'zone_23', 'zone_24', 'zone_25', 'zone_32', 'zone_33', 'hidden_antqueen'] },
    { key: 'heine',        name: '海音',       stat: 'extraMp',  vals: [1, 2, 3],   maps: ['heine', 'mirror_forest', 'zone_34', 'zone_35', 'zone_36', 'eva_kingdom', 'fafurion_lair'] },
    { key: 'giran',        name: '奇岩',       stat: 'weight',   vals: [10, 20, 30],maps: ['giran', 'zone_18', 'zone_19', 'zone_20', 'zone_21'] },
    { key: 'dragonvalley', name: '龍之谷',     stat: 'extraDmg', vals: [1, 2, 3],   maps: ['dragon_valley', 'zone_26', 'zone_27', 'zone_28', 'zone_29', 'zone_30', 'zone_31', 'antaras_lair', 'silent_outer'] },
    { key: 'witon',        name: '威頓',       stat: 'resFire',  vals: [1, 2, 3],   maps: ['fire_dragon', 'valakas_lair'] },
    { key: 'oren',         name: '歐瑞',       stat: 'resWater', vals: [1, 2, 3],   maps: ['zone_02', 'zone_03', 'zone_04', 'zone_05', 'zone_37', 'zone_38', 'zone_39', 'zone_40', 'zone_41', 'hidden_lab_nolife', 'hidden_lab_darkmagic', 'hidden_seal_spirit', 'hidden_seal_monster', 'hidden_seal_demon', 'crystal_cave1', 'crystal_cave2', 'crystal_cave3', 'shadow_temple'] },
    { key: 'aden',         name: '亞丁',       stat: 'resWind',  vals: [1, 2, 3],   maps: ['twilight_mt', 'dream_island'] },
    { key: 'tower',        name: '傲慢之塔',   stat: 'extraHit', vals: [1, 2, 3],   maps: '__pride__' },
    { key: 'rastabad',     name: '拉斯塔巴德', stat: 'mr',       vals: [1, 3, 5],   maps: ['rastabad_cave1', 'rastabad_cave2', 'rastabad_cave3', 'rastabad_gate', 'giant_tomb', 'demon_temple', 'rastabad_beast', 'dark_magic_lab', 'necro_training', 'elder_room', 'king_baranka_room', 'law_king_room', 'necro_king_room', 'assassin_king_room'] },
    { key: 'rift',         name: '時空裂痕',   stat: 'resEarth', vals: [1, 2, 3],   maps: ['thebes_desert', 'thebes_pyramid', 'thebes_temple'] }
];
const CARD_STAT_LABEL = { mhp: 'HP', mmp: 'MP', mpR: 'MP自動恢復量', hpR: 'HP自動恢復量', dr: '傷害減免', weight: '負重上限', extraMp: '額外魔法點數', extraDmg: '額外傷害', extraHit: '額外命中', mr: 'MR', resFire: '火屬性抗性', resWater: '水屬性抗性', resWind: '風屬性抗性', resEarth: '地屬性抗性' };

// ---- 地圖 key → 中文名（供金卡「出沒地圖」顯示）----
const _CARD_MAP_NAMES = {};
(function () {
    if (typeof MAP_REGIONS !== 'undefined') MAP_REGIONS.forEach(r => r.maps.forEach(m => { _CARD_MAP_NAMES[m.v] = m.t; }));
    if (typeof HIDDEN_AREA_NAMES !== 'undefined') for (let k in HIDDEN_AREA_NAMES) _CARD_MAP_NAMES[k] = HIDDEN_AREA_NAMES[k];
    _CARD_MAP_NAMES['windwood_dungeon'] = '風木地監';
})();
function _cardMapName(k) {
    if (_CARD_MAP_NAMES[k]) return _CARD_MAP_NAMES[k];
    let m = k.match(/^pride_f(\d+)$/); if (m) return '傲慢之塔' + m[1] + '樓';
    m = k.match(/^pride_(\d+)_(\d+)$/); if (m) return '傲慢之塔' + m[1] + '~' + m[2] + '樓';
    return k;
}

// ---- 由地圖反推：地區→怪物名單、怪物→代表資料/地區/出沒圖 ----
const CARD_REGION_MOBS = {};   // regionKey -> [mobName,...]（依等級排序）
const CARD_MOB_INFO = {};      // mobName -> { id, mob }
const CARD_MOB_REGIONS = {};   // mobName -> [regionKey,...]
const CARD_MOB_MAPS = {};      // mobName -> [mapKey,...]
(function buildCardIndex() {
    let prideMaps = Object.keys(DB.maps).filter(k => /^pride_/.test(k));
    CARD_REGIONS.forEach(reg => {
        let maps = (reg.maps === '__pride__') ? prideMaps : reg.maps;
        let names = [];
        maps.forEach(mk => {
            let pool = DB.maps[mk]; if (!pool) return;
            pool.forEach(mid => {
                let mob = DB.mobs[mid]; if (!mob || !mob.n) return;
                if (mob.race === '血盟' || mob.race === '建築') return;   // 血盟／建築標籤排除（不收集、不掉卡：守護塔/城門/樓梯/傳送門等）
                let nm = mob.n;
                if (names.indexOf(nm) === -1) names.push(nm);
                if (!CARD_MOB_INFO[nm]) CARD_MOB_INFO[nm] = { id: mid, mob: mob };
                (CARD_MOB_REGIONS[nm] = CARD_MOB_REGIONS[nm] || []);
                if (CARD_MOB_REGIONS[nm].indexOf(reg.key) === -1) CARD_MOB_REGIONS[nm].push(reg.key);
                (CARD_MOB_MAPS[nm] = CARD_MOB_MAPS[nm] || []);
                if (CARD_MOB_MAPS[nm].indexOf(mk) === -1) CARD_MOB_MAPS[nm].push(mk);
            });
        });
        names.sort((a, b) => (CARD_MOB_INFO[a].mob.lv || 0) - (CARD_MOB_INFO[b].mob.lv || 0));
        CARD_REGION_MOBS[reg.key] = names;
    });
})();

// ---- 程式化生成卡片物品（每個怪名 3 張）----
(function generateCardItems() {
    Object.keys(CARD_MOB_INFO).forEach(nm => {
        CARD_TIERS.forEach(ct => {
            DB.items[cardId(nm, ct.t)] = {
                n: nm + ' 的' + ct.sfx, type: 'misc', eff: 'card', cardTier: ct.t, cardMob: nm,
                c: ct.col, img: ct.img, p: ct.price, gachaWeight: 0,
                d: '怪物卡片。使用以在卡片收集冊中登錄「' + nm + '」（' + ct.sfx + '效果）。'
            };
        });
    });
})();

// ---- 圖鑑狀態助手（player.cardDex：怪名 -> 已開啟最高階 1/2/3）----
function cardDexTier(name) { return (player.cardDex && player.cardDex[name]) || 0; }
function cardSetDex(name, tier) { if (!player.cardDex) player.cardDex = {}; if ((player.cardDex[name] || 0) < tier) player.cardDex[name] = tier; }
function cardRegionTier(key) {   // 該地區「全部怪物皆達」的最高階（0=未完成）
    let names = CARD_REGION_MOBS[key]; if (!names || !names.length) return 0;
    let minT = 3;
    for (let i = 0; i < names.length; i++) { let t = cardDexTier(names[i]); if (t < minT) minT = t; if (minT === 0) return 0; }
    return minT;
}

// ---- 創角/讀檔保底：確保道具欄有一本收集冊 ----
function ensureCardBook() {
    if (!player || !Array.isArray(player.inv)) return;
    if (!player.cardDex) player.cardDex = {};
    if (!player.inv.some(i => i.id === 'item_card_book')) gainItem('item_card_book', 1, true, true);
    let _cb = player.inv.find(i => i.id === 'item_card_book'); if (_cb && _cb.junk) _cb.junk = false;   // 🎴 收集冊不可為廢品：清除舊存檔殘留的廢品標記
}

// ---- 掉落（killMob 呼叫）：血盟以外、且該怪屬於某卡片地區才有卡；三階各自獨立、一般＝經典機率（不乘 classicDropMult）----
function rollCardDrops(mob) {
    if (!mob || mob.race === '血盟' || mob.race === '建築') return;
    if (!CARD_MOB_INFO[mob.n]) return;
    _cardDropRoll(mob.n, 3, 0.000001);   // 金卡 0.0001%
    _cardDropRoll(mob.n, 2, 0.00001);    // 銀卡 0.001%
    _cardDropRoll(mob.n, 1, 0.0001);     // 普卡 0.01%
}
function _cardDropRoll(name, tier, rate) {
    if (Math.random() >= rate) return;
    let ct = CARD_TIERS[tier - 1];
    if (cardDexTier(name) >= tier) {   // 已收錄（含更高階）→ 自動賣出
        player.gold += ct.price;
        logSys(`<span class="${ct.col} font-bold">${name} 的${ct.sfx}</span><span class="text-slate-400"> 已收錄，自動賣出 +${ct.price} 金幣。</span>`);
    } else {
        gainItem(cardId(name, tier), 1);
    }
}

// ---- 使用一張卡片（useItem 分派）：登錄圖鑑並消耗；若已達該階則改為販賣 ----
function useCardItem(item) {
    let d = DB.items[item.id]; if (!d || !d.cardMob) return;
    let nm = d.cardMob, tier = d.cardTier, ct = CARD_TIERS[tier - 1];
    if (cardDexTier(nm) >= tier) {   // 已收錄 → 賣出（沿用既有販賣管線）
        if (typeof sellItem === 'function') sellItem(item.uid, 1, d.p);
        return;
    }
    cardSetDex(nm, tier);
    if ((item.cnt || 1) > 1) item.cnt -= 1; else player.inv = player.inv.filter(i => i.uid !== item.uid);
    logSys(`<span class="${ct.col} font-bold">卡片收集冊登錄了「${nm}」（${ct.sfx}）！</span>`);
    if (typeof calcStats === 'function') calcStats();   // 套用可能的地區完成加成
    if (typeof renderTabs === 'function') renderTabs(true);
    if (typeof updateUI === 'function') updateUI();
    if (typeof saveGame === 'function') saveGame();
    if (_cardBookOpen) renderCardBook();
    if (typeof closeModal === 'function') closeModal();
}

// ---- recomputeStats 鉤子：套用各地區「完成」加成（只取該區最高已達階；金=普+銀）----
function cardCollectionBonus(p, d) {
    d._cardWeightBonus = 0;
    if (!p || !p.cardDex) return;
    for (let r = 0; r < CARD_REGIONS.length; r++) {
        let reg = CARD_REGIONS[r];
        let tier = cardRegionTier(reg.key); if (tier <= 0) continue;
        let val = reg.vals[tier - 1];
        switch (reg.stat) {
            case 'mhp': p.mhp += val; break;
            case 'mmp': p.mmp += val; break;
            case 'mpR': d.mpR += val; break;
            case 'hpR': d.hpR += val; break;
            case 'dr': d.dr += val; break;
            case 'extraMp': d.extraMp += val; break;
            case 'extraDmg': d.extraDmg += val; break;
            case 'extraHit': d.extraHit += val; break;
            case 'mr': d.mr += val; break;
            case 'resFire': d.resFire += val; break;
            case 'resWater': d.resWater += val; break;
            case 'resWind': d.resWind += val; break;
            case 'resEarth': d.resEarth += val; break;
            case 'weight': d._cardWeightBonus += val; break;
        }
    }
}

// ===== 全螢幕書頁 UI =====
const _CARD_ELE = { fire: '火', water: '水', wind: '風', earth: '地', none: '無', holy: '聖', dark: '闇', undead: '不死', light: '光' };
let _cardBookOpen = false;
let _cardBookRegion = CARD_REGIONS[0].key;

function openCardBook() {
    if (!player.cardDex) player.cardDex = {};
    if (typeof closeModal === 'function') closeModal();   // 先關掉物品操作彈窗（z-50），避免書頁(z-45)開在其後方
    _cardBookOpen = true;
    let el = document.getElementById('card-book'); if (!el) return;
    el.classList.remove('hidden');
    renderCardBook();
}
function closeCardBook() {
    _cardBookOpen = false;
    let el = document.getElementById('card-book'); if (el) el.classList.add('hidden');
}
function cardBookTab(key) { _cardBookRegion = key; renderCardBook(); }
function cardBookBackdrop(ev) { if (ev && ev.target && ev.target.id === 'card-book') closeCardBook(); }

function _cardMobImg(mob, name) { return mob.img || ('assets/icons/monsters/' + name + '.png'); }

function renderCardBook() {
    let host = document.getElementById('card-book-body'); if (!host) return;
    // 分頁列
    let tabHost = document.getElementById('card-book-tabs');
    if (tabHost) {
        tabHost.innerHTML = CARD_REGIONS.map(reg => {
            let t = cardRegionTier(reg.key);
            let active = (reg.key === _cardBookRegion);
            let badge = t > 0 ? `<span class="${CARD_TIERS[t - 1].col}"> ●</span>` : '';
            return `<button onclick="cardBookTab('${reg.key}')" class="btn px-3 py-1.5 text-sm font-bold whitespace-nowrap ${active ? 'bg-amber-800 border-amber-500 text-amber-100' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}">${reg.name}${badge}</button>`;
        }).join('');
    }
    // 內文
    let reg = CARD_REGIONS.find(r => r.key === _cardBookRegion) || CARD_REGIONS[0];
    let names = CARD_REGION_MOBS[reg.key] || [];
    let total = names.length;
    let cP = names.filter(n => cardDexTier(n) >= 1).length;
    let cS = names.filter(n => cardDexTier(n) >= 2).length;
    let cG = names.filter(n => cardDexTier(n) >= 3).length;
    let rt = cardRegionTier(reg.key);
    let lab = CARD_STAT_LABEL[reg.stat] || reg.stat;
    let bonusLine = [1, 2, 3].map(tt => {
        let on = rt >= tt;
        return `<span class="${on ? CARD_TIERS[tt - 1].col + ' font-bold' : 'text-slate-500'}">全${CARD_TIERS[tt - 1].sfx} ${lab}+${reg.vals[tt - 1]}${on ? ' ✓' : ''}</span>`;
    }).join('<span class="text-slate-600 mx-1">/</span>');

    let head = `<div class="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div class="text-xl font-bold text-amber-200">${reg.name}<span class="text-sm text-slate-400 font-normal ml-2">收集 普${cP} / 銀${cS} / 金${cG}　共 ${total} 種</span></div>
        <div class="text-sm">完成加成（取最高）：${bonusLine}</div>
    </div>`;

    let cards = names.map(nm => {
        let info = CARD_MOB_INFO[nm]; let mob = info.mob;
        let tier = cardDexTier(nm);
        let imgUrl = _cardMobImg(mob, nm);
        let silh = tier <= 0 ? ' card-silhouette' : '';
        let nameHtml = tier >= 1
            ? `<div class="text-sm font-bold text-white truncate" title="${nm}">${nm}</div><div class="text-[11px] text-slate-500">Lv ${mob.lv || '?'}</div>`
            : `<div class="text-sm font-bold text-slate-500">？？？</div>`;
        let info2 = '';
        if (tier >= 2) {
            let ele = _CARD_ELE[mob.e] || mob.e || '無';
            info2 += `<div class="text-[11px] text-slate-300">HP ${mob.hp != null ? mob.hp : '?'}・屬性 ${ele}</div>`;
        }
        if (tier >= 3) {
            info2 += `<div class="text-[11px] text-slate-300">AC ${mob.ac != null ? mob.ac : '?'}・MR ${mob.mr != null ? mob.mr : '?'}</div>`;
            let maps = (CARD_MOB_MAPS[nm] || []).map(_cardMapName);
            let seen = {}; maps = maps.filter(x => (seen[x] ? false : (seen[x] = true)));
            let shown = maps.slice(0, 5).join('、') + (maps.length > 5 ? ' …' : '');
            info2 += `<div class="text-[11px] text-slate-400 leading-tight mt-0.5">出沒：${shown || '—'}</div>`;
        }
        let tierBadge = tier > 0 ? `<span class="absolute top-1 right-1 text-[10px] px-1 rounded ${CARD_TIERS[tier - 1].col} bg-black/50 font-bold">${CARD_TIERS[tier - 1].sfx}</span>` : '';
        return `<div class="relative bg-slate-800/70 border ${tier > 0 ? 'border-slate-600' : 'border-slate-700/60'} rounded-lg p-2 flex flex-col items-center gap-1 w-[136px]">
            ${tierBadge}
            <img src="${imgUrl}" alt="${nm}" class="w-16 h-16 object-contain${silh}" onerror="this.onerror=null;this.src='https://placehold.co/64x64/1e293b/334155?text=%3F';">
            <div class="text-center w-full">${nameHtml}${info2}</div>
        </div>`;
    }).join('');

    host.innerHTML = head + `<div class="flex flex-wrap gap-2 justify-center">${cards || '<div class="text-slate-500 p-8">此地區暫無可收集的怪物。</div>'}</div>`;
}
