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

// ---- 圖鑑狀態助手（player.cardDex：怪名 -> 隱藏積分 0~100；使用普卡+1/銀卡+10/金卡+100分）----
//  顯示階由積分推導：≥1→普卡資訊、≥10→銀卡、≥100→金卡（單獨使用效果同舊制；亦可靠累積低階卡開通高階）。此為內部判斷，不對玩家說明。
const CARD_POINTS = [1, 10, 100];   // 🎴 普/銀/金 使用所得積分
function cardDexScore(name) { return (player.cardDex && player.cardDex[name]) || 0; }
function cardDexTier(name) { let s = cardDexScore(name); return s >= 100 ? 3 : (s >= 10 ? 2 : (s >= 1 ? 1 : 0)); }
function cardTierToScore(v) { v = v || 0; return v >= 3 ? 100 : (v === 2 ? 10 : (v >= 1 ? 1 : 0)); }   // 🎴 舊存檔遷移：階級(1/2/3)→積分(1/10/100)（僅 loadSharedCollections 遷移時呼叫）
function cardAddScore(name, points) { if (!player.cardDex) player.cardDex = {}; let cur = player.cardDex[name] || 0; let nv = Math.min(100, cur + points); if (nv !== cur) { player.cardDex[name] = nv; if (typeof saveCardDex === 'function') saveCardDex(); } return nv; }   // 🎴 加分（上限100），登錄即回寫共用桶
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
    gainItem(cardId(name, tier), 1);   // 🎴 一律進背包：圖鑑已開通(score>=100)也不再自動賣出，保留供合成/自行販售/廢品處理
}

// ---- 使用卡片（useItem 分派）：加積分登錄；持有多張同卡 → 自動全部使用至滿100分即止；已開通則無法使用 ----
function useCardItem(item) {
    let d = DB.items[item.id]; if (!d || !d.cardMob) return;
    let nm = d.cardMob, tier = d.cardTier, ct = CARD_TIERS[tier - 1];
    let pts = CARD_POINTS[tier - 1], cur = cardDexScore(nm);
    if (cur >= 100) {   // 🎴 圖鑑已開通(滿100分)：無法使用
        logSys(`<span class="${ct.col} font-bold">「${nm}」</span><span class="text-slate-400"> 的圖鑑已開通，無法使用。</span>`);
        if (typeof closeModal === 'function') closeModal();
        return;
    }
    // 🎴 自動全部使用：用到滿100分即止（多餘留在背包）。單張使用效果同舊制。
    let have = item.cnt || 1;
    let need = Math.ceil((100 - cur) / pts);
    let useN = Math.min(have, need);
    cardAddScore(nm, useN * pts);
    if (have > useN) item.cnt = have - useN; else player.inv = player.inv.filter(i => i.uid !== item.uid);
    logSys(`<span class="${ct.col} font-bold">卡片收集冊登錄了「${nm}」！</span>` + (useN > 1 ? `<span class="text-slate-400">（自動使用 ${useN} 張）</span>` : ''));
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

// ===== 🎴 威頓村 魔法娃娃商人：卡片合成（同名同階滿 10 張 → 1 張高一階；普→銀→金連鎖）=====
//  只看「身上攜帶（背包 player.inv）」的卡片，不含倉庫。合成出的高階卡用 gainItem 發放（不走掉落路徑，不會被「已收錄自動賣」折現）。
function _cardSynthPlan() {   // 純計算預覽（不改狀態）：回 {2:銀卡可合成數, 3:金卡可合成數}（含普→銀後再參與銀→金的連鎖）
    let cnt = { 1: {}, 2: {}, 3: {} };
    player.inv.forEach(it => {
        let d = DB.items[it.id];
        if (d && d.eff === 'card' && d.cardTier) cnt[d.cardTier][d.cardMob] = (cnt[d.cardTier][d.cardMob] || 0) + (it.cnt || 1);
    });
    let made = { 2: 0, 3: 0 };
    [1, 2].forEach(ft => {
        for (let nm in cnt[ft]) {
            let sets = Math.floor(cnt[ft][nm] / 10);
            if (sets <= 0 || !DB.items[cardId(nm, ft + 1)]) continue;
            cnt[ft][nm] -= sets * 10;
            cnt[ft + 1][nm] = (cnt[ft + 1][nm] || 0) + sets;   // 合成出的高階卡併入下一階，續抽金卡
            made[ft + 1] += sets;
        }
    });
    return made;
}
function magicDollSynth() {   // 一鍵合成：先普→銀，再銀→金（普合成出的銀一起參與金卡合成）
    let made = { 2: 0, 3: 0 };
    for (let ft = 1; ft <= 2; ft++) {   // 兩階段各自重掃 inv：銀卡那輪會掃到上一輪剛 gainItem 的銀卡（連鎖）
        let groups = {};   // 怪名 -> [entry,...]（同名同階通常單一 entry，仍以陣列容錯）
        player.inv.forEach(it => {
            let d = DB.items[it.id];
            if (d && d.eff === 'card' && d.cardTier === ft) (groups[d.cardMob] = groups[d.cardMob] || []).push(it);
        });
        for (let nm in groups) {
            let entries = groups[nm];
            let total = entries.reduce((s, it) => s + (it.cnt || 1), 0);
            let sets = Math.floor(total / 10);
            if (sets <= 0 || !DB.items[cardId(nm, ft + 1)]) continue;   // 不足 10 張或目標階不存在（血盟/建築怪無卡）→ 跳過
            let need = sets * 10, rm = [];   // 消耗 sets*10 張（依 cnt 扣，歸 0 的 entry 記 uid 移除）
            for (let it of entries) {
                if (need <= 0) break;
                let c = it.cnt || 1;
                if (c <= need) { need -= c; rm.push(it.uid); } else { it.cnt = c - need; need = 0; }
            }
            if (rm.length) player.inv = player.inv.filter(i => rm.indexOf(i.uid) === -1);
            gainItem(cardId(nm, ft + 1), sets);   // 發 sets 張高一階（堆疊進背包；不觸發掉落自動賣）
            made[ft + 1] += sets;
        }
    }
    let tot = made[2] + made[3];
    if (!tot) {
        logSys('<span class="text-slate-400">魔法娃娃商人：你身上沒有可合成的卡片（需同名同階滿 10 張）。</span>');
    } else {
        let parts = [];
        if (made[2]) parts.push(`<span class="c-card-silver font-bold">銀卡 ×${made[2]}</span>`);
        if (made[3]) parts.push(`<span class="c-card-gold font-bold">金卡 ×${made[3]}</span>`);
        logSys(`<span class="text-amber-200">魔法娃娃商人為你合成了 ${parts.join('、')}！</span>`);
    }
    if (typeof renderTabs === 'function') renderTabs(true);
    if (typeof saveGame === 'function') saveGame();
    let _c = document.getElementById('interaction-content'); if (_c) renderCardSynth(_c);   // 就地重渲染：更新預覽數
}

// ===== 🪆 魔法娃娃：袋子（開袋）/ 金卡兌換 / 合成（皆 committed RNG：player.enSeed + player.dollSeq 決定論，save/load 不變）=====
// 袋子權重池：一階 8 種各 11.75%(權重1175) + 二階 6 種各 1%(權重100) = 總權重 10000
const DOLL_BAG_POOL = [['doll_野狼寶寶',1175],['doll_史巴托',1175],['doll_奎斯坦修',1175],['doll_稻草人',1175],['doll_蛇女',1175],['doll_肥肥',1175],['doll_希爾黛斯',1175],['doll_石頭高崙',1175],['doll_長老',100],['doll_雪怪',100],['doll_亞力安',100],['doll_美人魚',100],['doll_小思克巴',100],['doll_巨人',100]];
// 各階娃娃 id 清單（合成隨機抽下一階用）；於載入時掃 DB.items 一次建立
const DOLL_BY_TIER = { 1:[], 2:[], 3:[], 4:[], 5:[], 6:[] };
(function(){ for (let id in DB.items) { let d = DB.items[id]; if (d && d.doll && d.dollTier && DOLL_BY_TIER[d.dollTier]) DOLL_BY_TIER[d.dollTier].push(id); } })();
// 合成成功率表：DOLL_SYNTH_RATES[來源階][放入數量] = %（1→2,2→3,...,5→6）
const DOLL_SYNTH_RATES = { 1:{2:8,3:23,4:45}, 2:{2:7,3:20,4:40}, 3:{2:4,3:12,4:23}, 4:{2:2,3:6,4:12}, 5:{2:1,3:3,4:6} };
function _dollRng(tag, seq) { return _seededFloat(((player && player.enSeed) || 'x') + '|doll' + tag + '|' + seq); }   // 決定論 [0,1)
function _dollBagOutcome(seq) { let r = _dollRng('bag', seq) * 10000, acc = 0; for (let p of DOLL_BAG_POOL) { acc += p[1]; if (r < acc) return p[0]; } return DOLL_BAG_POOL[0][0]; }

// 開啟魔法娃娃的袋子（all=true 一次開完所有）：每袋消耗 1 個 dollSeq → save/load 後 seq 已存、結果固定不可重抽
function openDollBag(item, all) {
    let bag = player.inv.find(i => i.id === 'doll_bag');
    if (!bag) { logSys('<span class="text-slate-400">沒有魔法娃娃的袋子可開。</span>'); return; }
    bag.cnt = bag.cnt || 1;
    if (bag.cnt <= 0) { logSys('<span class="text-slate-400">沒有魔法娃娃的袋子可開。</span>'); return; }
    if (player.dollSeq == null) player.dollSeq = 0;
    let n = all ? bag.cnt : 1, got = {};
    for (let i = 0; i < n && bag.cnt > 0; i++) {
        let id = _dollBagOutcome(player.dollSeq);
        player.dollSeq++; bag.cnt--;
        gainItem(id, 1, true, true);   // silent + forceNormal（娃娃不附詞綴）
        got[id] = (got[id] || 0) + 1;
    }
    if (bag.cnt <= 0) player.inv = player.inv.filter(i => i.id !== 'doll_bag');
    let parts = Object.keys(got).map(id => `<span class="${DB.items[id].c || 'text-pink-300'} font-bold">${DB.items[id].n}</span> ×${got[id]}`);
    logSys(`🪆 打開魔法娃娃的袋子，獲得：${parts.join('、')}。`);
    if (typeof calcStats === 'function') calcStats();
    if (typeof renderTabs === 'function') renderTabs(true);
    if (typeof updateUI === 'function') updateUI();
    if (typeof saveGame === 'function') saveGame();
    let _c = document.getElementById('interaction-content'); if (_c) renderCardSynth(_c);
}

// 多餘金卡 = 背包內金卡(card_g_*) 且該怪圖鑑已達金階(score>=100)
function dollExcessGoldCards() { return player.inv.filter(it => { let d = DB.items[it.id]; return d && d.eff === 'card' && d.cardTier === 3 && cardDexTier(d.cardMob) >= 3; }); }
function dollExcessGoldCount() { return dollExcessGoldCards().reduce((s, it) => s + (it.cnt || 1), 0); }
// 用多餘金卡兌換娃娃袋子（1 金卡 = 1 袋；all=true 全換）
function exchangeGoldForBags(all) {
    let pool = dollExcessGoldCards();
    let total = pool.reduce((s, it) => s + (it.cnt || 1), 0);
    if (total <= 0) { logSys('<span class="text-slate-400">沒有可兌換的多餘金卡（需「圖鑑已開金階」的重複金卡）。</span>'); return; }
    let n = all ? total : 1, need = n, rm = [];
    for (let it of pool) { if (need <= 0) break; let c = it.cnt || 1; if (c <= need) { need -= c; rm.push(it.uid); } else { it.cnt = c - need; need = 0; } }
    if (rm.length) player.inv = player.inv.filter(i => rm.indexOf(i.uid) === -1);
    gainItem('doll_bag', n, true, true);
    logSys(`🎴 → 🪆 用 <span class="c-card-gold font-bold">${n} 張多餘金卡</span> 兌換了 <span class="text-pink-300 font-bold">${n} 個魔法娃娃的袋子</span>。`);
    if (typeof renderTabs === 'function') renderTabs(true);
    if (typeof updateUI === 'function') updateUI();
    if (typeof saveGame === 'function') saveGame();
    let _c = document.getElementById('interaction-content'); if (_c) renderCardSynth(_c);
}

// 背包內某階娃娃總數
function dollTierCount(t) { return player.inv.filter(it => { let d = DB.items[it.id]; return d && d.doll && d.dollTier === t && !it.lock; }).reduce((s, it) => s + (it.cnt || 1), 0); }   // 🔒 只計「未鎖定」娃娃＝可合成數；鎖定的娃娃受保護、不列入也不會被消耗
// 合成：放入 count（2~4）個 fromTier 娃娃 → 機率得 1 個 fromTier+1；失敗退還 1 個輸入娃娃。
//   只有「放 4 個」失敗才累積 1 點保底（per-tier 分開）；保底達 5 時下次 4 個合成必定成功並清空。committed RNG。
//   ⚠️不變量：合成只讀寫「背包 player.inv」，絕不碰共用倉庫(loadWarehouse w.items)——存進倉庫的娃娃不計入也不會被消耗。dollTierCount 同。新增取料路徑勿改讀倉庫。
function dollSynth(fromTier, count) {
    fromTier = +fromTier; count = +count;
    if (!DOLL_SYNTH_RATES[fromTier] || !DOLL_SYNTH_RATES[fromTier][count]) { logSys('<span class="text-red-400">無效的合成設定。</span>'); return; }
    if (dollTierCount(fromTier) < count) { logSys(`<span class="text-red-400 font-bold">第 ${fromTier} 階魔法娃娃不足 ${count} 個。</span>`); return; }
    // 依背包順序取出 count 個該階娃娃（🔒 跳過鎖定的堆疊＝玩家保護的娃娃不消耗；記錄被消耗的 id 供失敗退還）
    let consumed = [], need = count;
    for (let it of player.inv) {
        if (need <= 0) break;
        let d = DB.items[it.id]; if (!(d && d.doll && d.dollTier === fromTier && !it.lock)) continue;
        let c = it.cnt || 1, take = Math.min(c, need);
        for (let k = 0; k < take; k++) consumed.push(it.id);
        it.cnt = c - take; need -= take;
    }
    player.inv = player.inv.filter(it => it.cnt == null || it.cnt > 0);   // 清掉被扣到 0 的娃娃堆疊（保留 cnt 未定義的一般裝備）
    if (player.dollSeq == null) player.dollSeq = 0;
    if (!player.dollPity) player.dollPity = {};
    let seq = player.dollSeq; player.dollSeq++;
    let rate = DOLL_SYNTH_RATES[fromTier][count];
    let pity = player.dollPity[fromTier] || 0;
    let guaranteed = (count === 4 && pity >= 5);
    let success = guaranteed || (_dollRng('synth', seq) * 100 < rate);
    if (success) {
        if (guaranteed) player.dollPity[fromTier] = 0;   // 保底必成後清空
        let pool = DOLL_BY_TIER[fromTier + 1] || [];
        let pick = pool[Math.floor(_dollRng('synthR', seq) * pool.length)] || pool[0];
        gainItem(pick, 1, true, true);
        logSys(`<span class="text-amber-200 font-bold">🪆 合成成功！</span>獲得 <span class="${DB.items[pick].c || ''} font-bold">${DB.items[pick].n}</span>。` + (guaranteed ? ' <span class="text-amber-300 text-xs">(保底達成)</span>' : ''));
    } else {
        let back = consumed[Math.floor(_dollRng('synthF', seq) * consumed.length)] || consumed[0];
        gainItem(back, 1, true, true);
        if (count === 4) player.dollPity[fromTier] = (player.dollPity[fromTier] || 0) + 1;   // 只有 4 個合成失敗才累積保底
        logSys(`<span class="text-slate-400">🪆 合成失敗…</span>退還 <span class="${DB.items[back].c || ''}">${DB.items[back].n}</span>。` + (count === 4 ? ` <span class="text-amber-300 text-xs">(第${fromTier}階保底 ${player.dollPity[fromTier]}/5)</span>` : ''));
    }
    if (typeof calcStats === 'function') calcStats();
    if (typeof renderTabs === 'function') renderTabs(true);
    if (typeof updateUI === 'function') updateUI();
    if (typeof saveGame === 'function') saveGame();
    let _c = document.getElementById('interaction-content'); if (_c) renderCardSynth(_c);
}
// 合成面板的階級/數量選擇（暫存於模組變數）
let _dollSynthTier = 1, _dollSynthCount = 2;
function setDollSynthTier(t) { _dollSynthTier = +t; let _c = document.getElementById('interaction-content'); if (_c) renderCardSynth(_c); }
function setDollSynthCount(n) { _dollSynthCount = +n; let _c = document.getElementById('interaction-content'); if (_c) renderCardSynth(_c); }

function renderCardSynth(div) {
    let made = _cardSynthPlan();
    let can = (made[2] + made[3]) > 0;
    let h = `<div class="p-4 text-slate-300 leading-relaxed">魔法娃娃商人：把重複的卡片交給我吧。<br>
        <b>同一隻怪的 10 張<span class="c-card-common font-bold">普卡</span></b> → 1 張 <span class="c-card-silver font-bold">銀卡</span>；
        <b>10 張<span class="c-card-silver font-bold">銀卡</span></b> → 1 張 <span class="c-card-gold font-bold">金卡</span>。
        <br><span class="text-slate-400 text-sm">我會自動檢查你<b>身上攜帶</b>的所有卡片並一次合成（普卡合成出的銀卡會一起參與金卡合成；倉庫裡的卡不算）。</span></div>`;
    h += `<div class="px-4 pb-2"><div class="bg-slate-900/60 border border-slate-700 rounded p-3 text-sm space-y-1">
        <div class="flex justify-between"><span>可合成 <span class="c-card-silver font-bold">銀卡</span></span><span class="${made[2] ? 'text-green-400' : 'text-slate-500'} font-bold">${made[2]} 張</span></div>
        <div class="flex justify-between"><span>可合成 <span class="c-card-gold font-bold">金卡</span></span><span class="${made[3] ? 'text-green-400' : 'text-slate-500'} font-bold">${made[3]} 張</span></div>
    </div></div>`;
    h += `<div class="p-4 pt-2"><button class="btn w-full ${can ? 'bg-purple-800 hover:bg-purple-700 border-purple-500' : 'bg-slate-700 border-slate-600 opacity-60 cursor-not-allowed'} py-3 text-lg font-bold" ${can ? '' : 'disabled'} onclick="magicDollSynth()">一鍵合成</button></div>`;
    if (!can) h += `<div class="px-4 pb-2 text-slate-500 text-xs text-center">需要同名同階卡片滿 10 張才能合成。</div>`;
    // 🪆 多餘金卡兌換娃娃袋子（1 金卡 = 1 袋）
    let _gc = dollExcessGoldCount();
    h += `<div class="px-4 pb-2 pt-2 border-t border-slate-700/60">
        <div class="text-sm text-slate-300 mb-1">🎴 <b>多餘金卡兌換娃娃袋子</b> <span class="text-xs text-slate-400">（圖鑑已開金階的重複金卡，1 張＝1 袋）</span></div>
        <div class="flex items-center justify-between bg-slate-900/50 border border-slate-700 rounded px-3 py-2">
            <span class="text-sm">可兌換金卡：<span class="${_gc ? 'c-card-gold' : 'text-slate-500'} font-bold">${_gc} 張</span></span>
            <button class="btn px-3 py-1 text-xs font-bold ${_gc ? 'bg-amber-800 hover:bg-amber-700 border-amber-600' : 'bg-slate-700 border-slate-600 opacity-50 cursor-not-allowed'}" ${_gc ? '' : 'disabled'} onclick="exchangeGoldForBags(true)">全部兌換</button>
        </div></div>`;
    // 🎁 開啟袋子
    let _bag = player.inv.find(i => i.id === 'doll_bag'); let _bagN = _bag ? (_bag.cnt || 1) : 0;
    h += `<div class="px-4 pb-2">
        <div class="flex items-center justify-between bg-slate-900/50 border border-slate-700 rounded px-3 py-2">
            <span class="text-sm">🎁 魔法娃娃的袋子：<span class="${_bagN ? 'text-pink-300' : 'text-slate-500'} font-bold">${_bagN} 個</span></span>
            <div class="flex gap-2">
              <button class="btn px-3 py-1 text-xs font-bold ${_bagN ? 'bg-pink-800 hover:bg-pink-700 border-pink-600' : 'bg-slate-700 border-slate-600 opacity-50 cursor-not-allowed'}" ${_bagN ? '' : 'disabled'} onclick="openDollBag(null,false)">開 1 個</button>
              <button class="btn px-3 py-1 text-xs font-bold ${_bagN ? 'bg-pink-900 hover:bg-pink-800 border-pink-600' : 'bg-slate-700 border-slate-600 opacity-50 cursor-not-allowed'}" ${_bagN ? '' : 'disabled'} onclick="openDollBag(null,true)">全部開啟</button>
            </div>
        </div></div>`;
    // 🪆 魔法娃娃合成（2~4 同階 → 下一階）
    let _ft = _dollSynthTier, _cn = _dollSynthCount;
    let _rate = (DOLL_SYNTH_RATES[_ft] && DOLL_SYNTH_RATES[_ft][_cn]) || 0;
    let _have = dollTierCount(_ft);
    let _pity = (player.dollPity && player.dollPity[_ft]) || 0;
    let _canSyn = _have >= _cn;
    h += `<div class="px-4 pb-3 pt-2 border-t border-slate-700/60">
        <div class="text-sm text-slate-300 mb-2">🪆 <b>魔法娃娃合成</b> <span class="text-xs text-slate-400">（放入 2~4 個相同階級→機率得 1 個高一階；失敗退還 1 個。放 4 個失敗累積保底，滿 5 必成）</span></div>
        <div class="text-xs text-amber-300/90 mb-2">🔒 想保留的娃娃：在背包點該娃娃 →「鎖定」，合成時就<b>不會被消耗</b>；想合成哪些就把其餘鎖定起來即可（同階自動投入未鎖定的）。</div>
        <div class="bg-slate-900/60 border border-slate-700 rounded p-3 text-sm space-y-2">
            <div>來源階級：<span class="inline-flex gap-1 ml-1">${[1,2,3,4,5].map(t => `<button class="btn px-2 py-0.5 text-xs ${_ft === t ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600'}" onclick="setDollSynthTier(${t})">${t}階</button>`).join('')}</span></div>
            <div>放入數量：<span class="inline-flex gap-1 ml-1">${[2,3,4].map(n => `<button class="btn px-2 py-0.5 text-xs ${_cn === n ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600'}" onclick="setDollSynthCount(${n})">${n} 個</button>`).join('')}</span></div>
            <div class="flex justify-between text-xs text-slate-400"><span>第 ${_ft} 階可合成：<span class="${_have >= _cn ? 'text-green-400' : 'text-red-400'} font-bold">${_have}</span> 個<span class="text-slate-500">（未鎖定）</span></span><span>成功率：<span class="text-amber-300 font-bold">${_rate}%</span></span><span>保底：<span class="text-amber-300 font-bold">${_pity}/5</span>${_cn === 4 && _pity >= 5 ? ' <span class="text-green-400 font-bold">必成</span>' : ''}</span></div>
            <button class="btn w-full ${_canSyn ? 'bg-purple-800 hover:bg-purple-700 border-purple-500' : 'bg-slate-700 border-slate-600 opacity-60 cursor-not-allowed'} py-2 font-bold" ${_canSyn ? '' : 'disabled'} onclick="dollSynth(${_ft},${_cn})">合成（消耗 ${_cn} 個第 ${_ft} 階）</button>
        </div></div>`;
    div.innerHTML = h;
}
// 🪆 向魔法娃娃商人購買魔法娃娃（金幣）
function buyDoll(id) {
    let dd = DB.items[id];
    if (!dd || dd.slot !== 'doll') return;   // 只賣魔法娃娃
    if (player.gold < dd.p) { logSys('<span class="text-red-400 font-bold">金幣不足。</span>'); return; }
    player.gold -= dd.p;
    gainItem(id, 1, true, true);   // 🔧 silent + forceNormal：商店購買恆為普通無詞綴（避免買到「詛咒的」娃娃裝上被鎖定）
    logSys(`<span class="text-pink-200">向魔法娃娃商人購買了 <b>${dd.n}</b>。</span>`);
    if (typeof renderTabs === 'function') renderTabs(true);
    if (typeof updateUI === 'function') updateUI();
    if (typeof saveGame === 'function') saveGame();
    let _c = document.getElementById('interaction-content'); if (_c) renderCardSynth(_c);   // 就地重渲染：更新金幣可負擔狀態
}

// ===== 全螢幕書頁 UI =====
const _CARD_ELE = { fire: '火', water: '水', wind: '風', earth: '地', none: '無', holy: '聖', dark: '闇', undead: '不死', light: '光' };
let _cardBookOpen = false;
let _cardBookRegion = CARD_REGIONS[0].key;

function openCardBook() {
    if (!player.cardDex) player.cardDex = {};
    if (typeof mergeSharedIntoPlayer === 'function' && mergeSharedIntoPlayer('card') && typeof calcStats === 'function') calcStats();   // 🔄 多開兜底：開書前先併入其他分頁的卡片進度（file:// storage 事件不保證觸發）
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
