// ===================== 妖精屬性系統 (NPC 艾利溫) =====================
const ELF_ELE = {
    fire:  { name:'火', color:'#ef4444', cls:'text-red-400',     border:'#ef4444' },
    water: { name:'水', color:'#3b82f6', cls:'text-blue-400',    border:'#3b82f6' },
    wind:  { name:'風', color:'#10b981', cls:'text-emerald-400', border:'#10b981' },
    earth: { name:'地', color:'#facc15', cls:'text-yellow-400',  border:'#facc15' }
};
const ELF_SWITCH_COST = 500000;

const SPECIAL_AREA_BG = {   // 特殊地圖：逐張對應背景
    desert: 'assets/area/沙漠.jpg',   // 🏜️ 沙漠（野外·專屬背景·完整路徑直接用）
    // 🆕 新狩獵區背景（皆 area-fit 沙漠格式·需 1920×580 條狀圖·放 assets/area/）：
    crystal_cave1: 'assets/area/水晶洞穴.jpg', crystal_cave2: 'assets/area/水晶洞穴.jpg', crystal_cave3: 'assets/area/水晶洞穴.jpg',   // 💎 水晶洞穴（地監·3樓共用）
    fire_dragon: 'assets/area/火龍窟.jpg',   // 🔥 火龍窟（野外）
    elf_forest: 'assets/area/森林.jpg', zone_01: 'assets/area/森林.jpg', mirror_forest: 'assets/area/森林.jpg',   // 🌲 妖魔森林/妖精森林周邊/鏡子森林（野外·共用森林背景）
    zone_15: 'assets/area/洞窟.jpg', zone_16: 'assets/area/洞窟.jpg',   // 🕳️ 眠龍洞穴1~2樓
    zone_17: 'assets/area/龍之谷地監深層.jpg',   // 🐉 眠龍洞穴3樓（改龍之谷地監深層·area-fit）
    zone_22: 'assets/area/洞窟.jpg', zone_23: 'assets/area/洞窟.jpg', zone_24: 'assets/area/洞窟.jpg', zone_25: 'assets/area/洞窟.jpg',   // 🕳️ 沙漠地監1~4樓
    zone_26: 'assets/area/洞窟.jpg', zone_27: 'assets/area/洞窟.jpg', zone_28: 'assets/area/洞窟.jpg',   // 🕳️ 龍之谷地監1~3樓
    zone_29: 'assets/area/龍之谷地監深層.jpg', zone_30: 'assets/area/龍之谷地監深層.jpg', zone_31: 'assets/area/龍之谷地監深層.jpg',   // 🐉 龍之谷地監4~6樓（改深層·area-fit）
    zone_32: 'assets/area/洞窟.jpg',   // 🐜 螞蟻洞窟1樓（共用洞窟背景）
    zone_33: 'assets/area/龍之谷地監深層.jpg',   // 🐜 螞蟻洞窟2樓（改龍之谷地監深層·area-fit）
    zone_37: 'assets/area/象牙塔.jpg', zone_38: 'assets/area/象牙塔.jpg',   // 🏛️ 象牙塔4~5樓
    zone_39: 'assets/area/象牙塔深層.jpg', zone_40: 'assets/area/象牙塔深層.jpg', zone_41: 'assets/area/象牙塔深層.jpg',   // 🏛️ 象牙塔6~8樓（改深層背景·area-fit）
    hidden_lab_nolife: 'assets/area/象牙塔.jpg', hidden_lab_darkmagic: 'assets/area/象牙塔.jpg',   // 🏛️ 隱藏區域 fallback＝轉換前地圖背景（象牙塔4/5樓）；有同名 <區域名>.jpg 則優先
    hidden_seal_spirit: 'assets/area/象牙塔深層.jpg', hidden_seal_monster: 'assets/area/象牙塔深層.jpg', hidden_seal_demon: 'assets/area/象牙塔深層.jpg',   // 🏛️ 隱藏區域 fallback＝象牙塔6~8樓深層背景
    hidden_antqueen: 'assets/area/龍之谷地監深層.jpg',   // 🐜 巨蟻女皇棲息地 fallback＝螞蟻洞窟2樓背景
    heine: 'assets/area/森林.jpg',   // 🌲 海音（野外狩獵·共用森林背景·安全區 town_heine 不變）
    eva_kingdom: 'assets/area/伊娃王國.jpg',   // 🏰 伊娃王國（地監·專屬背景·area-fit）
    windwood: 'assets/area/沙漠.jpg',   // 🏜️ 風木（野外·共用沙漠背景）
    windwood_dungeon: 'assets/area/地監.jpg',   // 🏰 風木地監（攻城獲勝後開放的城堡狩獵區）：fallback＝地監.jpg；優先用同名 風木地監.jpg（下方 applyAreaBackground 對 windwood_dungeon 特例啟用同名探測：存在才切換、不存在維持地監.jpg）
    gludio: 'assets/area/城鎮周邊.jpg', kent: 'assets/area/城鎮周邊.jpg', giran: 'assets/area/城鎮周邊.jpg',   // 🏙️ 古魯丁/肯特/奇岩（野外·城鎮周邊·≠村莊周邊）
    training: 'assets/area/村莊周邊.jpg',   // 🆕 新兵修鍊場（套 area-fit·與其餘野外共用村莊周邊背景）
    dream_island: 'assets/area/夢幻之島.jpg',   // 🆕 夢幻之島（套 area-fit·專屬背景）
    zone_02: 'assets/area/歐瑞.jpg', zone_03: 'assets/area/歐瑞.jpg', zone_05: 'assets/area/歐瑞.jpg',   // 🗺️ 歐瑞/歐瑞雪原/國境要塞（野外·共用歐瑞背景）
    zone_04: 'assets/area/艾爾摩.jpg',   // ⚔️ 艾爾摩激戰地（野外·專屬背景）
    zone_09: 'assets/area/地監深層.jpg', zone_10: 'assets/area/地監深層.jpg', zone_11: 'assets/area/地監深層.jpg', zone_12: 'assets/area/地監深層.jpg', zone_14: 'assets/area/地監深層.jpg',   // 🕳️ 古魯丁地監4~7樓＋說話之島地監2樓（改深層背景·area-fit）
    dragon_valley: 'assets/area/龍之谷.jpg', twilight_mt: 'assets/area/龍之谷.jpg',   // 🐉 龍之谷/黃昏山脈（野外·共用龍之谷背景；地監龍之谷 zone_26~31 仍為洞窟.jpg）
    elf_grave: 'assets/area/拉斯塔巴德.jpg', hidden_cave: 'assets/area/拉斯塔巴德.jpg', giant_tomb: 'assets/area/拉斯塔巴德.jpg',   // 🏚️ 精靈墓穴/大洞穴隱遁者村莊地區/古代巨人之墓（野外·拉斯塔巴德背景）
    rastabad_cave1: 'assets/area/拉斯塔巴德.jpg', rastabad_cave2: 'assets/area/拉斯塔巴德.jpg', rastabad_cave3: 'assets/area/拉斯塔巴德.jpg', rastabad_gate: 'assets/area/拉斯塔巴德.jpg', rastabad_beast: 'assets/area/拉斯塔巴德.jpg', dark_magic_lab: 'assets/area/拉斯塔巴德.jpg', necro_training: 'assets/area/拉斯塔巴德.jpg',   // 🏚️ 拉斯塔巴德地下洞穴1~3樓/正門/魔獸訓練場/黑魔法研究室/冥法軍訓練場（地監·拉斯塔巴德背景）
    talking_island_port: 'assets/area/說話之島港口.jpg', oblivion_travel: 'assets/area/說話之島港口.jpg',   // 🏝️ 說話之島港口/遺忘之島途中（共用說話之島港口背景·area-fit）
    oblivion_island: 'assets/area/遺忘之島.jpg',   // 🏝️ 遺忘之島（專屬背景·area-fit）
    antaras_lair: 'assets/area/安塔瑞斯.jpg',   // 🐉 安塔瑞斯棲息地
    fafurion_lair: 'assets/area/法利昂.jpg',   // 🐉 法利昂洞穴
    valakas_lair: 'assets/area/巴拉卡斯.jpg',   // 🐉 巴拉卡斯巢穴（專屬背景）
    silent_outer: 'assets/area/拉斯塔巴德.jpg',   // 🏚️ 沉默洞穴周邊（狩獵·改拉斯塔巴德·area-fit）；安全區 town_silent 仍 silentcave.png 不變
    king_baranka_room: 'assets/area/軍王之室.jpg',  // 👑 魔獸軍王之室（純BOSS房·4室共用軍王之室背景）
    law_king_room: 'assets/area/軍王之室.jpg',      // 👑 法令軍王之室
    necro_king_room: 'assets/area/軍王之室.jpg',    // 👑 冥法軍王之室
    assassin_king_room: 'assets/area/軍王之室.jpg', // 👑 暗殺軍王之室
    elder_room: 'assets/area/軍王之室.jpg',         // 🏛️ 格蘭肯神殿．長老之室（拉斯塔巴德新狩獵地圖·借用軍王之室背景）
    thebes_desert: 'assets/area/底比斯沙漠.jpg',   // 🏛️ 底比斯 沙漠（專屬背景）
    thebes_pyramid: 'assets/area/底比斯.jpg',      // 🏛️ 底比斯 金字塔內部（與祭壇共用底比斯背景）
    thebes_temple: 'assets/area/底比斯.jpg',        // 🏛️ 底比斯 歐西里斯祭壇（純BOSS房）
    pirate_wild: 'assets/area/古魯丁.jpg',          // 🏴‍☠️ 海賊島（野外·借用古魯丁背景）
    pirate_dungeon: 'assets/area/說話之島地監1樓.jpg' // 🏴‍☠️ 海賊島地監（借用說話之島地監1樓背景）
};
const CATEGORY_AREA_BG = { wild: 'assets/area/村莊周邊.jpg', dungeon: 'assets/area/地監.jpg', siege: 'castle.png', tower: 'assets/area/傲慢之塔.jpg', rift: 'Rift.png' };   // 🆕 野外/地監/傲慢之塔狩獵改 area-fit 沙漠格式新背景；siege/rift 暫維持 16:9 cover。🗼 塔狩獵=傲慢之塔.jpg，入口安全區另由 TOWN_AREA_BG.tower 保留 TowerofInsolence.png 不變；🏛️ 底比斯3圖另由 SPECIAL_AREA_BG 覆寫（底比斯沙漠.jpg／底比斯.jpg）
const AREA_BG_FIT = new Set(['assets/area/沙漠.jpg', 'assets/area/水晶洞穴.jpg', 'assets/area/地監.jpg', 'assets/area/火龍窟.jpg', 'assets/area/森林.jpg', 'assets/area/村莊周邊.jpg', 'assets/area/傲慢之塔.jpg', 'assets/area/洞窟.jpg', 'assets/area/象牙塔.jpg', 'assets/area/伊娃王國.jpg', 'assets/area/城鎮周邊.jpg', 'assets/area/歐瑞.jpg', 'assets/area/拉斯塔巴德.jpg', 'assets/area/軍王之室.jpg', 'assets/area/安塔瑞斯.jpg', 'assets/area/法利昂.jpg', 'assets/area/巴拉卡斯.jpg', 'assets/area/底比斯沙漠.jpg', 'assets/area/底比斯.jpg', 'assets/area/龍之谷.jpg', 'assets/area/說話之島港口.jpg', 'assets/area/遺忘之島.jpg', 'assets/area/夢幻之島.jpg', 'assets/area/艾爾摩.jpg', 'assets/area/地監深層.jpg', 'assets/area/象牙塔深層.jpg', 'assets/area/龍之谷地監深層.jpg', 'assets/area/古魯丁.jpg', 'assets/area/說話之島地監1樓.jpg']);   // 🏜️ 條狀比例(非16:9·1920×580)背景：用 contain+area-fit(框高鎖圖比例·無上下黑邊·省空間給戰鬥日誌)。所有新狩獵區背景都列於此→自動套沙漠格式。⚠️這些 jpg 需放 assets/area/（同沙漠.jpg）；未放檔時背景空白但版面/格式仍正確。日後新增條狀背景就把路徑加進來
const SPECIAL_TOWN_BG = { town_silent: 'silentcave.png' };                                        // 🔧 安全區逐張對應背景（沉默洞穴）
const TOWN_AREA_BG = { village: 'village.png', castle: 'castle.png', tower: 'TowerofInsolence.png', rift: 'Rift.png' };   // 村莊畫面依分類（🗼 傲慢之塔入口；🌀 時空裂痕入口 Rift.png）
// 🆕 同名背景圖：地圖顯示名稱(MAP_CATEGORIES 的 t) → 嘗試 assets/area/[名稱].jpg；探測結果快取(undefined=未探測、null=探測中、{found,fit}=結果)
let _areaNameBgCache = {};
function mapDisplayName(v) { for (let _c in MAP_CATEGORIES) { let _e = MAP_CATEGORIES[_c].find(x => x.v === v); if (_e) return _e.t; } return null; }
function applyAreaBackground() {
    let cur = mapState.current, cat = mapCategoryOf(cur);
    let ov = a => `linear-gradient(rgba(15,23,42,${a}), rgba(15,23,42,${a}))`;
    let bv = document.getElementById('battle-view');
    if (bv) {
        let fbImg = SPECIAL_AREA_BG[cur] || CATEGORY_AREA_BG[cat] || null;   // 既有設定圖(fallback)：特殊地圖逐張優先，否則依分類(野外/地監/攻城)
        let useSrc = null, useFit = false;
        // 🆕 優先尋找「同名地圖圖檔」assets/area/[地圖名稱].jpg：存在才用、找不到才退回 fallback。瀏覽器無法同步判斷檔案是否存在→非同步探測＋快取(首訪先顯示 fallback、載入成功後切換)
        let _nm = mapDisplayName(cur);
        if (!_nm && cur === 'windwood_dungeon') _nm = '風木地監';   // 🏰 風木地監＝動態城堡區(不在 MAP_CATEGORIES)：手動指定同名圖名→優先探測 assets/area/風木地監.jpg、不存在則退回 fbImg(地監.jpg)
        if (!_nm && HIDDEN_AREA_BG[cur]) _nm = HIDDEN_AREA_BG[cur];   // 🏛️ 隱藏狩獵區域(不在 MAP_CATEGORIES)：背景＝對應母地圖樓層圖（無生物研究室→象牙塔4樓…惡魔封印室→象牙塔8樓、巨蟻女皇棲息地→螞蟻洞穴2樓）；探測 assets/area/<樓層>.jpg，不存在退回 SPECIAL_AREA_BG（母圖通用背景）
        let _c = _nm ? _areaNameBgCache[cur] : null;
        if (_c && _c.found) { useSrc = `assets/area/${_nm}.jpg`; useFit = _c.fit; }   // 已知存在→直接用(條狀比例 1920/580→area-fit)
        else {
            if (_nm && _areaNameBgCache[cur] === undefined) {   // 首次探測：背景先走 fallback，同名圖若載入成功則切換並快取
                _areaNameBgCache[cur] = null;   // pending
                let _probe = new Image(), _id = cur;
                _probe.onload = function(){ let _r = _probe.naturalHeight ? (_probe.naturalWidth / _probe.naturalHeight) : 0; _areaNameBgCache[_id] = { found: true, fit: Math.abs(_r - 1920 / 580) < 0.4 }; if (mapState.current === _id) applyAreaBackground(); };
                _probe.onerror = function(){ _areaNameBgCache[_id] = { found: false }; };
                _probe.src = `assets/area/${_nm}.jpg`;
            }
            if (fbImg) { useSrc = fbImg.indexOf('/') >= 0 ? fbImg : `assets/background/${fbImg}`; useFit = AREA_BG_FIT.has(fbImg); }
        }
        if (useSrc) { bv.style.backgroundImage = `url("${useSrc}")`; bv.style.backgroundSize = useFit ? 'contain' : ''; bv.classList.toggle('area-fit', useFit); bv.classList.add('has-bg'); }   // 🔧 條狀比例背景用 contain＋area-fit(框高鎖圖比例)、其餘清空 inline 回退 CSS 的 cover
        else { bv.style.backgroundImage = ''; bv.style.backgroundSize = ''; bv.classList.remove('area-fit'); bv.classList.remove('has-bg'); }
    }
    let tv = document.getElementById('town-view');
    if (tv) {
        let timg = SPECIAL_TOWN_BG[cur] || TOWN_AREA_BG[cat] || null;   // 安全區逐張優先，否則依分類(村莊/城堡)
        if (timg) { tv.style.backgroundImage = `${ov(0.7)}, url("assets/background/${timg}")`; tv.classList.add('has-bg'); }
        else { tv.style.backgroundImage = ''; tv.classList.remove('has-bg'); }
    }
}
function applyElfBorder() {
    if(!document.body) return;
    let e = (player.cls === 'elf' && player.elfEle) ? ELF_ELE[player.elfEle] : null;
    document.body.style.boxShadow = e ? `inset 0 0 0 6px ${e.border}` : 'none';   // 攻城獲勝標記改用頭像旁徽章顯示，避免與妖精地屬性黃色邊框衝突
}

function renderElionUI(div) {
    if(player.cls !== 'elf') {
        div.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-slate-400 py-12">
            <span class="text-5xl mb-4">🚫</span><span class="text-lg">只有妖精能夠選擇屬性。</span></div>`;
        return;
    }
    if(player.lv < 30) {
        div.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-slate-400 py-12">
            <span class="text-5xl mb-4">🔒</span><span class="text-lg">需要達到 Lv 30 才能選擇屬性。</span>
            <span class="text-sm mt-2 text-slate-500">目前等級 Lv ${player.lv}</span></div>`;
        return;
    }
    let cur = player.elfEle ? ELF_ELE[player.elfEle] : null;
    let header = cur
        ? `<p class="text-slate-300 mb-1">目前屬性：<span class="${cur.cls} font-bold text-lg">${cur.name}屬性</span></p>
           <p class="text-sm text-yellow-400 mb-4">轉換屬性需花費 ${ELF_SWITCH_COST.toLocaleString()} 金幣（目前持有 ${player.gold.toLocaleString()}）</p>`
        : `<p class="text-slate-300 mb-4">選擇一種屬性，首次選擇免費。選擇後將解鎖對應的三、四階精靈魔法。</p>`;
    let btns = Object.keys(ELF_ELE).map(k => {
        let e = ELF_ELE[k];
        let isCur = player.elfEle === k;
        return `<button onclick="chooseElfElement('${k}')" ${isCur?'disabled':''}
            class="flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-transform
            ${isCur ? 'opacity-50 cursor-not-allowed border-slate-600' : 'cursor-pointer hover:scale-105'}"
            style="border-color:${e.border}; background:${e.color}1a;">
            <span class="text-3xl font-bold ${e.cls}">${e.name}</span>
            <span class="text-xs text-slate-400">${isCur?'目前屬性':e.name+'屬性'}</span>
        </button>`;
    }).join('');
    div.innerHTML = `<div class="p-4">${header}<div class="grid grid-cols-2 md:grid-cols-4 gap-3">${btns}</div></div>`;
}

function chooseElfElement(ele) {
    if(player.cls !== 'elf' || player.lv < 30 || !ELF_ELE[ele]) return;
    if(player.elfEle === ele) return;
    if(player.elfEle) {
        if(player.gold < ELF_SWITCH_COST) { logSys('金幣不足，無法轉換屬性。'); return; }
        if(!confirm(`確定花費 ${ELF_SWITCH_COST.toLocaleString()} 金幣將屬性轉換為「${ELF_ELE[ele].name}」？`)) return;
        player.gold -= ELF_SWITCH_COST;
        logSys(`你花費 ${ELF_SWITCH_COST.toLocaleString()} 金幣，屬性轉換為 <span class="${ELF_ELE[ele].cls}">${ELF_ELE[ele].name}屬性</span>。`);
    } else {
        logSys(`你選擇了 <span class="${ELF_ELE[ele].cls}">${ELF_ELE[ele].name}屬性</span>。`);
    }
    player.elfEle = ele;
    applyElfBorder();
    calcStats();
    renderTabs();
    renderSkillSelects();
    let div = document.getElementById('interaction-content');
    if(div) renderElionUI(div);
    updateUI();
}

// ========== 村莊商店 ─ 單頁捲動版 ==========
let _currentShopNpc = ''; // 用來記住目前是哪位商人

// 根據 NPC ID 取得該商人販售的所有物品
const SHOP_LISTS = {
    npc_boni: ['potion_heal','potion_strong','potion_ult','potion_blue','potion_haste','scroll_poly','scroll_magicbarrier','scroll_teleport','scroll_revive','wpn_5','wpn_22','new_item_143','candle'],   // 🏴‍☠️ 波尼（海賊島村莊 雜貨商人）
    npc_linda: ['bk_elf_mr','bk_elf_mind','bk_elf_worldtree','bk_elf_purify','bk_elf_firewpn','bk_elf_windshot','bk_elf_earthguard','bk_elf_eleres','bk_elf_singleres'],
    npc_bayes: ['bk_fireball','bk_vampire','bk_rock_prison','bk_thunder','bk_ice_spike','bk_bless_wpn'],
    npc_gilen: ['bk_heal1','bk_sunlight','bk_shield','bk_lightarrow','bk_teleport','bk_icearrow','bk_windblade','bk_holy_wpn','bk_antidote','bk_cold_shiver','bk_poison_curse','bk_ench_wpn','bk_reveal','bk_load_up','bk_firearrow','bk_hell_fang','bk_heal_mid','bk_shield2','bk_energy_sense','bk_chill','bk_aurora','bk_dark_blind','bk_undead_bane'],
    npc_vangil: ['arm_103','arm_105','arm_108','arm_42','arm_43','hlm_mr','arm_68','arm_66','arm_67','amr_robe','arm_65','arm_63','arm_69','arm_60','arm_61','arm_62','amr_plate'],
    npc_evert: ['new_item_189','new_item_188','new_item_187'],
    npc_wino: ['wpn_shortsword','wpn_9','wpn_scimitar','wpn_37','wpn_invader','wpn_longsword','wpn_damascus','wpn_silversword','wpn_2hsword','wpn_katana','wpn_10','wpn_13','wpn_1','wpn_battleaxe','wpn_19','wpn_38','wpn_20','wpn_silveraxe','wpn_witchwand','wpn_18','wpn_giantaxe','wpn_28','wpn_14','wpn_6','wpn_3','wpn_17','wpn_15','wpn_7','wpn_21','wpn_16','wpn_halberd','wpn_12'],
    npc_skvati: ['potion_heal','potion_strong','potion_ult','potion_blue','potion_haste','scroll_poly','scroll_magicbarrier','scroll_teleport','scroll_revive','wpn_5','wpn_22','candle','new_item_143','wpn_claw_bronze','wpn_claw_steel','wpn_claw_shadow','wpn_claw_damascus','wpn_dual_bronze','wpn_dual_steel','wpn_dual_shadow','wpn_dual_damascus'],
    npc_saedia: ['bk_dark_str','bk_dark_mrup','bk_dark_stealth','bk_dark_poison','bk_dark_refine','bk_dark_dex','bk_dark_poisonres','bk_dark_burn','bk_dark_walkhaste'],
    npc_sphere: ['mem_confuse','mem_mirror','mem_crush','mem_ogre','mem_focus','mem_skullbreak','mem_lich','mem_endure'],   // 🔮 史菲爾只販賣這 8 種記憶水晶；其餘水晶改由掉落/製作/兌換取得（日光術改由吉蘭購得）
    npc_sempal: ['bk_dragon_guardbreak','bk_dragon_slaughter','bk_dragon_flameslash','bk_dragon_terror'],   // 🐉 森帕爾：4 種龍騎士書板（消滅者鎖鏈劍改為潘朵拉/普洛凱爾試煉取得）
    default: ['potion_heal','potion_strong','potion_ult','potion_blue','potion_haste','potion_brave','new_item_140','new_item_139','scroll_poly','scroll_magicbarrier','scroll_teleport','scroll_revive','wpn_5','wpn_22','new_item_142','candle','new_item_143']
};
// 🔧 商店販售清單（單一來源）：getShopItemsForNpc 與潘朵拉權重覆寫共用此表
function getShopItemsForNpc(npcId) {
    let list = SHOP_LISTS[npcId] || SHOP_LISTS.default;
    return list.filter(id => {
        let d = DB.items[id];
        if (!d) return false;
        // 🔧 武器/防具：不限職業，全部販售（買得到；能否裝備仍由 equipItem/checkCanEquip 白名單把關）。
        if (d.type === 'wpn' || d.type === 'arm') return true;
        // 飾品（acc）：仍以「實際可裝備」判定（涵蓋各職業白名單）。
        if (d.type === 'acc') return checkCanEquip({ id });
        // 其餘（消耗品/技能書/材料等）：沿用職業白名單
        return reqAllowsClass(d, player.cls) || loadUpAllows(id);
    });
}

function renderTownShop(containerElement, npcId = '') {
    if (npcId) _currentShopNpc = npcId;
    let div = containerElement || document.getElementById('interaction-content');
    div.innerHTML = '';

    // 直接建立商品清單容器，不再建立 select 下拉選單
    let listDiv = document.createElement('div');
    listDiv.id = 'shop-items-list';
    div.appendChild(listDiv);

    renderShopItems();
}

function renderShopItems() {
    let listDiv = document.getElementById('shop-items-list');
    if(!listDiv) return;
    listDiv.innerHTML = '';

    let ids = getShopItemsForNpc(_currentShopNpc);
    if(!ids.length) {
        listDiv.innerHTML = '<div class="text-slate-500 text-sm text-center py-8">此商人目前沒有販售適合你的商品。</div>';
        return;
    }
    
    ids.forEach(id => {
        let d = DB.items[id];
        let el = document.createElement('div');
        el.className = 'list-item bg-slate-800 rounded mb-2 border border-slate-700 p-3 hover:bg-slate-750 transition-colors';
        el.style.cssText = 'display:flex !important; justify-content:space-between !important; align-items:center !important; width:100% !important; box-sizing:border-box !important;';
        let imgUrl = getIconUrl(d);
        let glowClass = getGlowClass(null, d);
        let learned = d.type === 'skillbk' && player.skills.includes(d.sk);
        let cantLearn = d.type === 'skillbk' && !learned && DB.skills[d.sk] && skillReqLv(DB.skills[d.sk], d.sk) === undefined;   // 🔧 該職業無法學習（如黑暗妖精三階以上法師魔法）：以「已習得」相同暗色呈現
        let dim = learned || cantLearn;

        // 箭矢與肉的顯示判斷
        let nameDisp = id === 'wpn_5' ? '箭 (1000根)' : (id === 'wpn_22' ? '銀箭 (1000根)' : (id === 'new_item_143' ? '肉 (1000個)' : d.n));
        let priceDisp = id === 'wpn_5' ? shopPrice(100).toLocaleString() : (id === 'wpn_22' ? shopPrice(200).toLocaleString() : (id === 'new_item_143' ? shopPrice(100).toLocaleString() : shopPrice(d.p || 0).toLocaleString()));

        el.innerHTML = `
            <div class="flex items-center gap-4 min-w-0 flex-1 ${dim ? 'opacity-50' : ''}">
                <div class="w-12 h-12 bg-slate-900 rounded border border-slate-600 flex items-center justify-center shrink-0 tip-host">
                    <img src="${imgUrl}" onerror="this.style.display='none';" class="w-10 h-10 object-contain pointer-events-none ${glowClass}">
                </div>
                <div class="flex flex-col items-start gap-1.5">
                    <span class="${getItemColor({ id })} font-bold text-lg leading-none truncate">
                        ${nameDisp}${learned ? ' <span class="text-slate-500 text-xs font-normal">已習得</span>' : (cantLearn ? ' <span class="text-red-500 text-xs font-normal">無法學習</span>' : '')}
                    </span>
                    <div class="flex items-center gap-2">
                        <span class="text-yellow-400 font-bold text-base leading-none">${priceDisp} 金幣</span>
                        <span class="text-slate-400 text-xs hidden md:block leading-none">${d.d || ''}</span>
                    </div>
                </div>
            </div>
            ${ d.type === 'skillbk'
                ? (cantLearn
                    ? `<button class="btn bg-slate-700 border-slate-600 text-slate-500 py-2 px-6 font-bold shrink-0 cursor-not-allowed opacity-60" disabled>無法學習</button>`
                    : `<button class="btn bg-blue-700 hover:bg-blue-600 border-blue-500 py-2 px-6 font-bold shrink-0 shadow" onclick="buyItem('${id}')">${learned ? '再買' : '購買'}</button>`)
                : `<div class="flex items-center gap-2 shrink-0">
                       <input type="number" id="shop-qty-${id}" value="1" min="1" class="w-16 bg-slate-900 border border-slate-600 text-center text-white rounded py-1 outline-none">
                       <button class="btn bg-blue-700 hover:bg-blue-600 border-blue-500 py-2 px-5 font-bold shadow" onclick="buyItem('${id}', document.getElementById('shop-qty-${id}').value)">購買</button>
                   </div>` }
        `;
        listDiv.appendChild(el);
    });
}

function migrateSaves(){
    // 舊單一存檔 → 第1格（既有玩家預設落在存檔1）
    let oldS = _lsGet('lineage_idle_save');
    if(oldS && !_lsGet('lineage_idle_save_1')) _lsSet('lineage_idle_save_1', oldS);
}
function anySaveExists(){ return ['1','2','3','4','5','6','7','8'].some(n => _lsGet('lineage_idle_save_' + n)); }
function _summaryFromRaw(s){
    if(!s) return null;
    s = _saveUnwrap(s).payload;   // 🛡️ 先解存檔簽章（摘要顯示不驗章、僅取 payload；舊明文檔原樣回傳）
    try { let d = JSON.parse(s); let p = d.p;
        let clsName = { knight:'騎士', mage:'法師', elf:'妖精', dark:'黑暗妖精', illusion:'幻術士', dragon:'龍騎士', warrior:'戰士', royal:'王族' }[p.cls] || p.cls;
        return { name: p.name || '', cls: clsName, lv: p.lv || 1, gold: p.gold || 0, classic: !!p.classicMode, traditional: !!p.traditionalMode, avatar: p.avatar || null };   // 🎮 經典／🏛️ 傳統模式旗標：供存檔位顯示與傭兵同模式招募限制；avatar＝職業性別頭像名（assets/character/<avatar>.png）；name 未命名時留空字串（顯示端自行省略）
    } catch(e){ return null; }
}
function slotSummary(n){ return _summaryFromRaw(_lzGet('lineage_idle_save_' + n)); }
function slotBackupSummary(n){ return _summaryFromRaw(_lzGet('lineage_idle_save_' + n + '_bak')); }   // 匯入前自動備份的摘要
let _slotMode = 'new';
function openSlotSelect(mode){
    _slotMode = mode;
    { let _ct = document.getElementById('create-classic-toggle'); if (_ct && mode === 'new') _ct.checked = false; let _tt = document.getElementById('create-traditional-toggle'); if (_tt && mode === 'new') _tt.checked = false; }   // 🎮🏛️ 創角流程重置經典＋傳統模式開關（預設皆關閉，兩者獨立）
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('creation-panel').classList.add('hidden');
    document.getElementById('slot-select-panel').classList.remove('hidden');
    document.getElementById('slot-select-title').innerText = (mode === 'new') ? '選擇存檔位（創建角色）' : '選擇存檔位（載入進度）';
    let list = document.getElementById('slot-list'); list.innerHTML = '';
    for(let n = 1; n <= 8; n++){
        let sum = slotSummary(n);
        let _classic = !!(sum && sum.classic);   // 🎮 經典模式存檔：以琥珀金顯示
        let _trad = !!(sum && sum.traditional);  // 🏛️ 傳統模式存檔：以淡紫顯示（傳統角色 classic 亦為 true，故先判 traditional）
        let _tag = (_classic && _trad) ? '⚔🏛️ ' : (_trad ? '🏛️ ' : (_classic ? '⚔ ' : ''));
        let _modeName = (_classic && _trad) ? '（經典＋傳統）' : (_trad ? '（傳統）' : (_classic ? '（經典）' : ''));
        let label = sum ? `${_tag}存檔 ${n}　${sum.cls} Lv.${sum.lv}${sum.name ? '　' + sum.name : ''}${_modeName}` : `存檔 ${n}　（空）`;   // 未命名時不顯示名稱（連同前置全形空白一併省略）
        let _classicStyle = (_classic && _trad) ? 'color:#2dd4bf;border-color:#0d9488;' : (_trad ? 'color:#c4b5fd;border-color:#7c3aed;' : (_classic ? 'color:#fbbf24;border-color:#d97706;' : ''));   // 經典＋傳統＝青綠；🏛️ 傳統＝淡紫；🎮 經典＝琥珀金
        let disabled = (mode === 'load' && !sum);
        let bak = (mode === 'load') ? slotBackupSummary(n) : null;
        // 動作區固定寬度：匯入(+復原)鈕各 flex-1。無備份時匯入鈕獨佔整個動作區
        //（寬度＝有備份時 匯入+復原 之和），使左側「載入存檔」鈕寬度恆定。
        let importBtn = `<button onclick="importSave(${n})" class="btn flex-1 min-w-0 py-2 px-2 text-base font-bold bg-indigo-700 hover:bg-indigo-600 border-indigo-500 whitespace-nowrap">匯入進度</button>`;
        let restoreBtn = bak ? `<button onclick="restoreBackup(${n})" title="復原匯入前自動備份的存檔（${bak.cls} Lv.${bak.lv}${bak.name ? '　' + bak.name : ''}）" class="btn flex-1 min-w-0 py-2 px-2 text-sm font-bold bg-amber-700 hover:bg-amber-600 border-amber-500 whitespace-nowrap">↩ 復原備份</button>` : '';
        let actionArea = (mode === 'load') ? `<div class="flex gap-2 shrink-0 w-56">${importBtn}${restoreBtn}</div>` : '';
        let avatarImg = (sum && sum.avatar) ? `<img src="assets/save/${(sum.avatar||'').replace('黑暗妖精','黑妖').replace('幻術士','幻術師')}.jpg" alt="" class="shrink-0 h-8 w-8 rounded object-cover object-top -ml-1" style="border:1px solid rgba(148,163,184,0.55);box-shadow:inset 0 1px 0 rgba(255,255,255,0.18),0 1px 2px rgba(0,0,0,0.5);" onerror="this.style.display='none';">` : '';   // 👤 存檔圖＝assets/save/<性別職業>.jpg（avatar 對應檔名：黑暗妖精→黑妖、幻術士→幻術師）；細邊框＋微立體陰影；缺檔自動隱藏
        list.innerHTML += `<div class="flex gap-2 w-full">`
            + `<button onclick="chooseSlot(${n})" ${disabled ? 'disabled' : ''} style="${_classicStyle}" class="btn flex-1 min-w-0 py-2 text-lg font-bold flex items-center gap-2 ${disabled ? 'opacity-40' : ''}">${avatarImg}<span class="truncate min-w-0">${label}</span></button>`
            + actionArea
            + `</div>`;
    }
}
function chooseSlot(n){
    if(_slotMode === 'load'){ currentSlot = n; loadGame(); return; }
    let sum = slotSummary(n);
    if(sum && !confirm(`存檔 ${n} 已有角色（${sum.cls} Lv.${sum.lv}${sum.name ? ' ' + sum.name : ''}），確定覆蓋並重新創角？`)) return;
    currentSlot = n;
    document.getElementById('slot-select-panel').classList.add('hidden');
    showCreation();
}
function slotBackToMenu(){
    document.getElementById('slot-select-panel').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    if(anySaveExists()) document.getElementById('btn-load').classList.remove('hidden');
}

// ===== 存檔 匯出 / 匯入 =====
// 匯出：先儲存當前進度，再把該角色存檔寫成 .json 檔。優先用檔案系統 API（可自選資料夾），
//       不支援時退回瀏覽器下載（落在預設下載資料夾）。
async function exportSave(){
    saveGame();   // 先儲存，確保匯出的是最新進度
    let data = _saveUnwrap(_lzGet('lineage_idle_save_' + currentSlot)).payload;   // 💾 解壓並解簽 → 取出明文 JSON payload
    if(!data){ alert('目前沒有可匯出的存檔。'); return; }
    // 🔧 一併收錄共用倉庫（依角色的經典/非經典模式取對應倉庫）；匯入時可選擇是否還原
    try {
        let _obj = JSON.parse(data);
        let _whRaw = _lzGet(whKey());   // 🎮 目前角色（經典/非經典）對應的倉庫（💾 解壓成明文）
        if(_whRaw) _obj.wh = JSON.parse(_whRaw);
        data = JSON.stringify(_obj);
    } catch(e){}
    data = _saveWrap(data);   // 🛡️ 匯出檔加完整性簽章（前綴 'SIG1:'，匯入時驗章；payload 仍為明文 JSON）
    let sum = slotSummary(currentSlot);
    let cname = (sum && sum.name) ? sum.name : ('slot' + currentSlot);   // 未命名 → 用 slotN 當檔名
    let fname = `fable5_save_${currentSlot}_${cname}.json`;
    if(window.showSaveFilePicker){
        try {
            let handle = await window.showSaveFilePicker({
                suggestedName: fname,
                types: [{ description: '放置天堂存檔', accept: { 'application/json': ['.json'] } }]
            });
            let w = await handle.createWritable();
            await w.write(data);
            await w.close();
            logSys(`<span class="text-indigo-300 font-bold">✔ 存檔已匯出：${fname}</span>`);
            return;
        } catch(e){
            if(e && e.name === 'AbortError') return;   // 使用者取消選擇資料夾
            downloadSaveFile(data, fname);             // 其他錯誤 → 退回下載
            return;
        }
    }
    downloadSaveFile(data, fname);
}
function downloadSaveFile(data, fname){
    let blob = new Blob([data], { type: 'application/json' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    logSys(`<span class="text-indigo-300 font-bold">✔ 存檔已匯出至下載資料夾：${fname}</span>`);
}
// 匯入：對指定存檔位 n 開啟選檔視窗，驗證後用匯入的存檔「取代」該位置的存檔，並刷新清單。
function importSave(n){
    let input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = function(){
        let file = input.files && input.files[0];
        if(!file) return;
        let reader = new FileReader();
        reader.onload = function(){
            let _raw = String(reader.result || '');
            let _u = _saveUnwrap(_raw);   // 🛡️ 解存檔簽章（相容舊版無簽章明文匯出檔）
            if(_u.signed && !_u.ok){ alert('匯入失敗：檔案完整性校驗未通過，可能已被竄改。'); return; }   // 🛡️ 簽章不符＝被改過：拒絕匯入
            if(!_u.signed && !confirm('此存檔檔案沒有完整性簽章（可能來自舊版本，或被外部修改/移除簽章）。\n仍要匯入嗎？')) return;   // 🛡️ 未簽章檔（含被剝掉 SIG1 前綴後竄改者）：明示警告＋需確認，避免簽章被「刪前綴」無聲繞過
            let text = _u.payload;
            let d;
            try { d = JSON.parse(text); }
            catch(e){ alert('匯入失敗：檔案不是有效的存檔（JSON 解析錯誤）。'); return; }
            if(!d || typeof d !== 'object' || !d.p || typeof d.p !== 'object' || !d.p.cls){
                alert('匯入失敗：檔案內容不是有效的放置天堂存檔。'); return;
            }
            let existing = slotSummary(n);
            if(existing && !confirm(`存檔 ${n} 已有角色（${existing.cls} Lv.${existing.lv} ${existing.name}）。\n確定要用匯入的存檔「取代」它嗎？\n（原存檔會自動備份，可於載入畫面點「復原備份」還原）`)) return;
            // 🔧 抽出倉庫資料（若匯入檔含 wh）；寫入存檔位時不保留 wh 欄位
            let whData = d.wh;
            let saveText = text;
            if(whData !== undefined){ let _c = {}; for(let k in d){ if(k !== 'wh') _c[k] = d[k]; } saveText = JSON.stringify(_c); }
            let cur = _lsGet('lineage_idle_save_' + n);
            if(cur) _lsSet('lineage_idle_save_' + n + '_bak', cur);   // 匯入前自動備份原存檔
            _lzSet('lineage_idle_save_' + n, _saveWrap(saveText));   // 💾 匯入 → 以本機簽章重新封裝後壓縮存入（之後讀檔即可驗章）
            // 🔧 詢問是否一併還原共用倉庫（會覆蓋現有倉庫，四個存檔位共用）
            let whMsg = '';
            if(whData !== undefined){
                let _cnt = (whData.items && whData.items.length) || 0;
                let _gold = whData.gold || 0;
                if(confirm(`此匯入檔包含倉庫資料（物品 ${_cnt} 項、金幣 ${_gold.toLocaleString()}）。\n是否一併還原倉庫？\n⚠ 會覆蓋該角色所屬模式（${(d.p && d.p.classicMode) ? '經典' : '非經典'}）的共用倉庫。`)){
                    _lzSet(whKey(d.p), JSON.stringify({ items: whData.items || [], gold: whData.gold || 0 }));   // 🎮 依匯入角色的經典/非經典模式寫入對應倉庫（💾 壓縮）
                    whMsg = '\n倉庫已一併還原。';
                } else {
                    whMsg = '\n（倉庫維持原狀，未還原）';
                }
            }
            openSlotSelect(_slotMode);   // 重新整理存檔位清單（更新名稱/等級與可載入狀態）
            let ns = slotSummary(n);
            alert(`已匯入到存檔 ${n}：${ns ? (ns.cls + ' Lv.' + ns.lv + '　' + ns.name) : '完成'}。${cur ? '\n（原存檔已自動備份，可點「復原備份」還原）' : ''}${whMsg}`);
        };
        reader.readAsText(file);
    };
    input.click();
}
// 復原匯入前自動建立的備份：把備份寫回該存檔位（取代目前內容）。
function restoreBackup(n){
    let bak = _lsGet('lineage_idle_save_' + n + '_bak');
    if(!bak){ alert('沒有可復原的備份。'); return; }
    let b = slotBackupSummary(n);
    if(!confirm(`確定要將存檔 ${n} 復原為匯入前的備份${b ? `（${b.cls} Lv.${b.lv}　${b.name}）` : ''}嗎？\n目前存檔 ${n} 的內容將被取代。`)) return;
    _lsSet('lineage_idle_save_' + n, bak);
    openSlotSelect(_slotMode);   // 刷新清單
    alert(`存檔 ${n} 已復原為匯入前的備份。`);
}
function showCreation() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('creation-panel').classList.remove('hidden');
    document.getElementById('btn-load').classList.add('hidden');
    
    // 初始化選單：預設點擊並亮起王子（創角第一位）
    selectClass('m_royal');
}

function backToMenu() {
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('creation-panel').classList.add('hidden');
    if(anySaveExists()) document.getElementById('btn-load').classList.remove('hidden');
}

function selectClass(c) {
    curCreate.rawCls = c; // 記住玩家選的具體選項 (例如 f_knight)
    
    // 1. 更新按鈕外觀 (先移除所有按鈕的 active，再幫目前點擊的加上 active)
    const btnIds = ['m_royal', 'f_royal', 'm_knight', 'f_knight', 'm_mage', 'f_mage', 'm_elf', 'f_elf', 'm_dark', 'f_dark', 'm_illusionist', 'f_illusionist', 'm_Dknight', 'f_Dknight', 'm_warrior', 'f_warrior'];
    btnIds.forEach(id => {
        let btn = document.getElementById('btn-class-' + id);
        if(btn) btn.classList.remove('active');
    });
    if(document.getElementById('btn-class-' + c)) {
        document.getElementById('btn-class-' + c).classList.add('active');
    }

    // 🎯 解除隱形死結：即時切換圖片路徑，並強制指定 display = 'block'
    let previewImg = document.getElementById('class-preview-img');
    if (previewImg) {
        const _previewName = c === 'm_royal' ? 'prince' : (c === 'f_royal' ? 'princess' : c); // 👑 王族美術檔名為 prince/princess（非 m_royal/f_royal）
        previewImg.src = `assets/start/${_previewName}.${c.includes('illusionist') ? 'jpg' : 'png'}`; // 🔮 幻術士起始圖為 jpg，其餘職業為 png
        previewImg.style.display = 'block'; 
    }

    // 2. 判斷底層職業（⚠️ Dknight 含 'knight' 子字串，須先判斷；royal 無子字串衝突）
    if(c.includes('royal')) curCreate.cls = 'royal';   // 👑 王族
    else if(c.includes('Dknight')) curCreate.cls = 'dragon';
    else if(c.includes('illusionist')) curCreate.cls = 'illusion';
    else if(c.includes('dark')) curCreate.cls = 'dark';
    else if(c.includes('knight')) curCreate.cls = 'knight';
    else if(c.includes('mage')) curCreate.cls = 'mage';
    else if(c.includes('elf')) curCreate.cls = 'elf';
    else if(c.includes('warrior')) curCreate.cls = 'warrior';   // ⚔️ 戰士

    // 3. 更新說明文字
    if (curCreate.cls === 'knight') {
        document.getElementById('class-desc').innerText = "騎士：力量最高的戰鬥專精職業，能使用各式武器與防具。";
    } else if (curCreate.cls === 'mage') {
        document.getElementById('class-desc').innerText = "法師：身體較弱但能施展強大魔法的魔法專精職業。";
    } else if (curCreate.cls === 'elf') {
        document.getElementById('class-desc').innerText = "妖精：能力均衡、操控各種武器的多才多藝職業。";
    } else if (curCreate.cls === 'dark') {
        document.getElementById('class-desc').innerText = "黑暗妖精：敏捷最高、體質脆弱，精通匕首/雙刀/鋼爪/十字弓與劇毒，擅長迴避與雙擊的高機動獵手。";
    } else if (curCreate.cls === 'illusion') {
        document.getElementById('class-desc').innerText = "幻術士：魔防較高，以「奇古獸」武器將攻擊化為必中魔法傷害，並施展混亂等幻術。出生於希培利亞。";
    } else if (curCreate.cls === 'dragon') {
        document.getElementById('class-desc').innerText = "龍騎士：體質與力量兼備的近戰戰士，龍魔法多以 HP 為代價，能大幅提升攻速並以鎖鏈劍累積「弱點曝光」。出生於貝希摩斯。";
    } else if (curCreate.cls === 'warrior') {
        document.getElementById('class-desc').innerText = "戰士：力量與體質兼備的純近戰職業，專精斧頭與鈍器、可雙持單手鈍器，魔防偏低。出生於海音。";
    } else if (curCreate.cls === 'royal') {
        document.getElementById('class-desc').innerText = "王族：天生的領袖，傭兵上限隨魅力提升（3＋魅力/15，最多 7 名），習得王族專屬魔法。天生加入血盟、不可退出。出生於說話之島。";
    }
    
    document.getElementById('stat-allocation').style = "";
    curCreate.str = 0; curCreate.dex = 0; curCreate.con = 0; curCreate.int = 0; curCreate.wis = 0; curCreate.cha = 0;
    updateCreateUI();
}

function adjStat(s, v) {
    let b = createBase[curCreate.cls];
    let spent = curCreate.str + curCreate.dex + curCreate.con + curCreate.int + curCreate.wis + curCreate.cha;
    let left = b.pts - spent;
    let capN = 20;   // 創角階段各屬性最高點到 20（含魅力，與其他屬性一致；之後靠升級點數突破至上限 60）
    if (v > 0 && left > 0 && (b[s] + curCreate[s]) < capN) curCreate[s]++;
    else if (v < 0 && curCreate[s] > 0) curCreate[s]--;
    updateCreateUI();
}

function updateCreateUI() {
    let b = createBase[curCreate.cls];
    ['str','dex','con','int','wis','cha'].forEach(s => document.getElementById(`c-${s}`).innerText = b[s] + curCreate[s]);
    let left = b.pts - (curCreate.str + curCreate.dex + curCreate.con + curCreate.int + curCreate.wis + curCreate.cha);
    document.getElementById('creation-pts').innerText = left;
    document.getElementById('btn-start').disabled = left <= 0 ? false : true;
}

function _setTraditionalToggle(enabled){   // 創角流程重置用：取消傳統勾選（傳統已可獨立勾選、不再受經典鎖定）
    let _tt = document.getElementById('create-traditional-toggle');
    if (_tt && !enabled) _tt.checked = false;
}
function onToggleClassic(el) {
    if (!el.checked) return;   // 取消勾選不需確認（經典與傳統已獨立、互不連動）
    let ok = confirm('⚔ 經典模式（硬核挑戰）\n\n開啟後，此角色將「永久」套用下列規則，建立後無法關閉：\n\n‧ 物品掉落機率 → 原本的 1/10\n‧ 經驗值取得 → 減半\n‧ 怪物金幣 → 僅剩一般模式的 1/2\n‧ 死亡 → 損失該等級 10% 最大經驗（不會降等）\n‧ 無法賦予裝備祝福、無法進行職業精通\n‧ 無法進入「席琳的世界」\n\n（可單獨開啟，或與「傳統模式」並用）\n\n確定要以「經典模式」創建此角色嗎？');
    if (!ok) { el.checked = false; return; }
}
function onToggleTraditional(el) {
    if (!el.checked) return;   // 取消勾選不需確認
    let ok = confirm('🏛️ 傳統模式（可單獨開啟，或與「經典模式」並用）\n\n開啟後，此角色將「永久」套用下列規則，建立後無法關閉：\n\n‧ 所有武器/防具/飾品 → 沒有強化選項（隱藏快速強化）\n‧ 怪物不掉落、黑市不販售「對武器/盔甲/飾品施法的卷軸」\n‧ 隱藏肯特城的兌換 NPC（伊賽馬利）\n‧ 取而代之 → 怪物掉落／潘朵拉黑市／製作 的裝備會「隨機自帶已強化值」（商店購買仍為 +0）\n‧ 倉庫與角色 與其他模式組合（一般／經典／經典＋傳統）皆不共通\n\n確定要以「傳統模式」創建此角色嗎？');
    if (!ok) el.checked = false;   // 取消 → 還原為未勾選
}
function startGame() {
    document.getElementById('creation-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.body.classList.add('game-bg-dim');   // 正式遊戲後：背景淡化
    
    const avatarMap = {
        'm_royal': '王子', 'f_royal': '公主',
        'm_knight': '男騎士', 'f_knight': '女騎士',
        'm_mage': '男法師', 'f_mage': '女法師',
        'm_elf': '男妖精', 'f_elf': '女妖精',
        'm_dark': '男黑暗妖精', 'f_dark': '女黑暗妖精',
        'm_illusionist': '男幻術士', 'f_illusionist': '女幻術士',
        'm_Dknight': '男龍騎士', 'f_Dknight': '女龍騎士',
        'm_warrior': '男戰士', 'f_warrior': '女戰士'
    };
    player.avatar = avatarMap[curCreate.rawCls] || '男騎士';
    player.cls = curCreate.cls;
    // 👑 王族：依性別自動入盟、不可選擇／退出（王子→特羅斯 tros、公主→依詩蒂 esti）
    if (player.cls === 'royal') player.bloodPledge = (curCreate.rawCls && curCreate.rawCls.startsWith('f_')) ? 'esti' : 'tros';
    player.classicMode = !!(document.getElementById('create-classic-toggle') && document.getElementById('create-classic-toggle').checked);   // 🎮 經典模式：依創角開關決定（此角色永久生效）
    player.traditionalMode = !!(document.getElementById('create-traditional-toggle') && document.getElementById('create-traditional-toggle').checked);   // 🏛️ 傳統模式：依創角開關決定（與經典獨立·可單開或＋經典·此角色永久生效）
    player.name = null;   // 預設未取名，狀態欄顯示「點擊取名」，玩家可點擊命名
    player.enSeed = 'es' + uid() + uid();   // 🎲 強化決定論種子（創角產生一次、存進存檔永久固定）：讓強化成敗由種子決定、不可用 save/load 刷

    let b = createBase[curCreate.cls];
    player.base = { str: b.str+curCreate.str, dex: b.dex+curCreate.dex, con: b.con+curCreate.con, int: b.int+curCreate.int, wis: b.wis+curCreate.wis, cha: b.cha+curCreate.cha };
    player.lv = 1; player.exp = 0; player.gold = 1000;
    player.inv = []; player.eq = { wpn: null, helm: null, armor: null, shield: null, cloak: null, tshirt: null, gloves: null, boots: null, ring1: null, ring2: null, ring3: null, ring4: null, amulet: null, ear1: null, ear2: null, belt: null }; player.junkPrefs = {};
    player.skills = [];
    player.summon = null; player.charmed = null; player.manualCd = {}; player.hot = null; player.elfEle = null; player.buffs = { haste: 0, brave: 0, blue: 0, cautious: 0, elfcookie: 0, poly: 0, shield: 0 };
    
    ['set-haste', 'set-brave', 'set-blue', 'set-cautious', 'set-poly', 'set-auto-buy-pot', 'set-auto-buy-arrow'].forEach(id => {
        let el = document.getElementById(id);
        if(el) el.checked = false;
    });
    
    // 依據不同職業配發專屬起始道具
    if (player.cls === 'elf') {
        gainItem('wpn_shortbow', 1, true, true);  // 短弓
        gainItem('arm_74', 1, true, true);        // 木製的夾克
        gainItem('wpn_5', 1000, true, true);      // 箭 x 1000
        gainItem('wpn_11', 1, true, true);        // 匕首 (放背包)
        gainItem('potion_heal', 100, true, true); // 紅色藥水 x 100
    } else if (player.cls === 'dark') {
        gainItem('wpn_11', 1, true, true);        // 🔧 匕首（黑暗妖精起始武器，非歐西斯匕首）
        gainItem('amr_jacket', 1, true, true);    // 皮夾克
        gainItem('potion_heal', 100, true, true); // 紅色藥水 x 100
    } else if (player.cls === 'illusion') {
        gainItem('wpn_10', 1, true, true);        // 🔧 木棒（幻術士起始武器）
        gainItem('amr_jacket', 1, true, true);    // 皮夾克
        gainItem('potion_heal', 100, true, true); // 紅色藥水 x 100
    } else if (player.cls === 'dragon') {
        gainItem('wpn_10', 1, true, true);        // 🐉 木棒（龍騎士起始武器）
        gainItem('amr_jacket', 1, true, true);    // 皮夾克
        gainItem('potion_heal', 100, true, true); // 治癒藥水 x 100
    } else if (player.cls === 'warrior') {
        gainItem('wpn_1', 1, true, true);         // ⚔️ 斧（戰士起始武器）
        gainItem('amr_jacket', 1, true, true);    // 皮夾克
        gainItem('potion_heal', 100, true, true); // 治癒藥水 x 100
    } else if (player.cls === 'royal') {
        gainItem('wpn_11', 1, true, true);        // 👑 匕首（王族起始武器）
        gainItem('amr_jacket', 1, true, true);    // 皮夾克
        gainItem('potion_heal', 100, true, true); // 治癒藥水 x 100
    } else {
        gainItem('wpn_dagger1', 1, true, true);   // 歐西斯匕首
        gainItem('amr_jacket', 1, true, true);    // 皮夾克
        gainItem('potion_heal', 100, true, true); // 紅色藥水 x 100
        if(player.cls === 'mage') {
            gainItem('bk_lightarrow', 1, true, true); // 光箭魔法書
        }
    }
    if (typeof loadSharedCollections === 'function') loadSharedCollections();   // 🎴🗡️🧰 創角：載入同模式共用收集圖鑑（新角色即承接同模式既有收集）
    if (typeof ensureCardBook === 'function') ensureCardBook();   // 🎴 怪物收集冊改由「收藏」面板開啟（移除道具欄本體）
    if (typeof ensureEquipBook === 'function') ensureEquipBook();   // 🗡️ 裝備收集冊改由「收藏」面板開啟＋登錄起始裝備
    if (typeof ensureMiscDex === 'function') ensureMiscDex();   // 🧰 道具收集冊：登錄起始道具

    calcStats();
    player.hp = player.mhp; player.mp = player.mmp;
    
    // 依據不同職業自動穿上對應裝備
    if (player.cls === 'elf') {
        equipItem(player.inv.find(i=>i.id==='wpn_shortbow'));
        equipItem(player.inv.find(i=>i.id==='arm_74'));
    } else if (player.cls === 'dark') {
        equipItem(player.inv.find(i=>i.id==='wpn_11'));        // 🔧 匕首
        equipItem(player.inv.find(i=>i.id==='amr_jacket'));
    } else if (player.cls === 'illusion') {
        equipItem(player.inv.find(i=>i.id==='wpn_10'));        // 🔧 木棒
        equipItem(player.inv.find(i=>i.id==='amr_jacket'));
    } else if (player.cls === 'dragon') {
        equipItem(player.inv.find(i=>i.id==='wpn_10'));        // 🐉 木棒
        equipItem(player.inv.find(i=>i.id==='amr_jacket'));
    } else if (player.cls === 'warrior') {
        equipItem(player.inv.find(i=>i.id==='wpn_1'));         // ⚔️ 斧
        equipItem(player.inv.find(i=>i.id==='amr_jacket'));
    } else if (player.cls === 'royal') {
        equipItem(player.inv.find(i=>i.id==='wpn_11'));        // 👑 匕首
        equipItem(player.inv.find(i=>i.id==='amr_jacket'));
    } else {
        equipItem(player.inv.find(i=>i.id==='wpn_dagger1'));
        equipItem(player.inv.find(i=>i.id==='amr_jacket'));
    }
    
    updateClassPotionRows();
    renderSkillSelects();
    
    // 👇 正確的新版起點邏輯
    let startMap = 'town_silver_knight';
    if (player.cls === 'mage') startMap = 'town_talking';
    else if (player.cls === 'elf') startMap = 'town_elf';
    else if (player.cls === 'dark') startMap = 'town_silent';
    else if (player.cls === 'illusion') startMap = 'town_hyperia';
    else if (player.cls === 'dragon') startMap = 'town_behemoth';
    else if (player.cls === 'warrior') startMap = 'town_heine';   // ⚔️ 戰士：海音
    else if (player.cls === 'royal') startMap = 'town_talking';   // 👑 王族：說話之島

    setMapSelectors(startMap);
    changeMap(true);

    state.running = true;
    state.ticks = 0;   // 🔧 新角色從 0 tick 開始（避免承接前一場的計時）
    applySherineTheme();   // 🔮 新角色預設關閉席琳的世界，重置視覺主題
    startGameTimers();
    logSys(`===== 歡迎來到天堂放置冒險 =====`);
    saveGame();   // 🔧 創角完成立即存檔：先前要等 5 分鐘自動存檔，期間關閉頁面角色會直接消失
}

function updateClassPotionRows() {
    // 勇敢藥水：騎士／龍騎士限定；慎重藥水：法師／幻術士限定；精靈餅乾：妖精限定
    let braveRow = document.getElementById('ui-brave-row');
    let cautiousRow = document.getElementById('ui-cautious-row');
    let elfRow = document.getElementById('ui-elfcookie-row');
    if(braveRow) braveRow.classList.toggle('hidden', player.cls !== 'knight' && player.cls !== 'dragon' && player.cls !== 'warrior' && player.cls !== 'royal');
    if(cautiousRow) cautiousRow.classList.toggle('hidden', player.cls !== 'mage' && player.cls !== 'illusion');
    if(elfRow) elfRow.classList.toggle('hidden', player.cls !== 'elf');
}

function saveGame() {
    // 死亡狀態不寫檔：避免把 player.dead=true 存進去，導致下次讀檔卡在死亡狀態而不出怪。
    // 死亡期間沒有可保存的進度，保留上一份「存活」存檔即可。
    if (player && player.dead) return;
    if (typeof sanitizeState === 'function') sanitizeState();   // 🛡️ 寫檔前合理性夾擠：把 runtime(Console)改出的不可能數值夾回合法範圍，連同簽章一起固化、不讓作弊值被存檔/匯出
    // 收集目前的自動化設定 UI 狀態
    player.config = {
        setPot: document.getElementById('set-pot').value,
        setHpPot: document.getElementById('set-hp-pot').value,
        setAutoBuyPot: document.getElementById('set-auto-buy-pot').checked,
        selAtkSkill: document.getElementById('sel-atk-skill').value,
        setMpAtk: document.getElementById('set-mp-atk').value,
        selHealSkill: document.getElementById('sel-heal-skill').value,
        setMpHeal: document.getElementById('set-mp-heal').value,
        selConvertSkill: document.getElementById('sel-convert-skill') ? document.getElementById('sel-convert-skill').value : '',
        setHpConvert: document.getElementById('set-hp-convert') ? document.getElementById('set-hp-convert').value : '',
        setHpSkill: document.getElementById('set-hp-skill') ? document.getElementById('set-hp-skill').value : '',
        setHaste: document.getElementById('set-haste').checked,
        setAutoBuyHaste: document.getElementById('set-auto-buy-haste').checked,
        setBrave: document.getElementById('set-brave').checked,
        setAutoBuyBrave: document.getElementById('set-auto-buy-brave').checked,
        setBlue: document.getElementById('set-blue').checked,
        setAutoBuyBlue: document.getElementById('set-auto-buy-blue').checked,
        setCautious: document.getElementById('set-cautious').checked,
        setAutoBuyCautious: document.getElementById('set-auto-buy-cautious').checked,
        setElfcookie: document.getElementById('set-elfcookie').checked,
        setAutoBuyElfcookie: document.getElementById('set-auto-buy-elfcookie').checked,
        setPoly: document.getElementById('set-poly').checked,
        setAutoBuyPoly: document.getElementById('set-auto-buy-poly').checked,
        setMagicbarrier: document.getElementById('set-magicbarrier').checked,
        setTeleport: document.getElementById('set-teleport').checked,
        setAutoBuyTeleport: document.getElementById('set-auto-buy-teleport').checked,
        setAutoBuyArrow: document.getElementById('set-auto-buy-arrow').checked,
        autoBuffSkills: {} // 用來儲存動態生成的法術 Buff
    };
    
    // 收集所有法術 Buff 勾選框的狀態
    player.skills.forEach(sid => {
        let chk = document.getElementById(`auto-sk-${sid}`);
        if (chk) player.config.autoBuffSkills[sid] = chk.checked;
    });

    _lzSet('lineage_idle_save_' + currentSlot, _saveWrap(JSON.stringify({ v: SAVE_VERSION, p: player, ms: mapState, ticks: state.ticks })));   // 🔧 架構#6：寫入存檔版本（🛡️ 加完整性簽章後 💾 LZString 壓縮）   // 🔧 一併保存 tick 計數：召喚物/迷魅的 endTick 為絕對 tick，不存會在重載後失準（迷魅重新計時 1 小時）
    logSys(`遊戲進度已儲存。`);
}

// 合併同一性物品堆疊（相容舊存檔：修復前被拆分的相同卷軸/物品會重新合併）。
// 僅合併未強化(en===0)的物品；強化品(+N)維持獨立。鎖定不列入同一性比對（與 gainItem 一致），
// 但合併後只要其中任一原堆疊為鎖定，即保留鎖定狀態（保護不被誤賣；鎖定仍可用於強化）。
function consolidateInventory() {
    if (!player.inv) return;
    let seen = {};
    let out = [];
    player.inv.forEach(it => {
        if ((it.en || 0) !== 0) { out.push(it); return; }   // 強化品不合併
        let key = itemSig(it);   // 🔧 架構#3：統一簽章（祝福/詛咒/遠古變體/屬性/en 全部入鍵）
        if (seen[key]) {
            let base = seen[key];
            base.cnt += (it.cnt || 1);
            if (it.lock) base.lock = true;
        } else {
            seen[key] = it;
            out.push(it);
        }
    });
    out.forEach(it => { if (it.lock) it.junk = false; });   // 鎖定的堆疊不視為廢品
    player.inv = out;
}

function loadGame() {
    let _u = _saveUnwrap(_lzGet('lineage_idle_save_' + currentSlot));   // 🛡️ 解存檔簽章（舊明文存檔 signed:false 照常載入）
    if (_u.signed && !_u.ok) { alert('此存檔的完整性校驗未通過，可能已被外部修改，無法載入。\n可在載入畫面點「復原備份」還原，或改用未被修改的存檔。'); return; }   // 🛡️ 簽章不符＝被竄改：拒絕載入
    let s = _u.payload;
    if (s) {
        let d; try { d = JSON.parse(s); } catch(e){ alert('此存檔位的資料已毀損，無法載入。若先前有匯入過，可在載入畫面點「復原備份」還原。'); return; }   // 🛡️ 與其他讀檔點一致：毀損時乾淨報錯而非拋例外卡死
        player = d.p; mapState = d.ms;
        if (!player.enSeed) player.enSeed = 'es' + _seedHash((player.name || '') + '|' + (player.cls || '') + '|lz').toString(36);   // 🎲 舊存檔無強化種子：由角色名+職業決定論衍生（重匯入同一份舊檔也得相同種子→不能靠重匯入重洗強化）
        if (typeof sanitizeState === 'function') sanitizeState();   // 🛡️ 讀檔後合理性夾擠（抓改過/竄改的存檔：等級>100、強化值超上限、負金幣等）
        state.ticks = d.ticks || 0;   // 🔧 還原 tick 計數：讓召喚物/迷魅以絕對 tick 記錄的 endTick 在重載後仍然有效
        // 修復：自動存檔可能在「死亡放置」期間把 player.dead=true 寫入存檔。
        // 讀檔一律以「在村莊甦醒、存活」載入，否則 tick() 會因 player.dead 提早 return，
        // 導致載入後不出怪、且無復活按鈕可按而卡死。後續進村流程會補滿 HP/MP 並清除異常狀態。
        player.dead = false;
        { let b1 = document.getElementById('btn-revive'); if(b1) b1.classList.add('hidden');
          let b2 = document.getElementById('btn-revive-inplace'); if(b2) b2.classList.add('hidden'); }
        document.getElementById('creation-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        document.body.classList.add('game-bg-dim');   // 正式遊戲後：背景淡化
        
        player.inv.forEach(i => { if(i.lock === undefined) i.lock = false; });
        player.inv.forEach(i => { if(i.junk === undefined) i.junk = false; });
        // 修復重複 uid：強化裝備曾因共用 uid 互相覆蓋/消失，載入時確保 inv+eq 所有物品 uid 唯一
        { let _seen = new Set(); let _fix = (it) => { if(!it) return; if(it.uid === undefined || _seen.has(it.uid)) it.uid = uid(); _seen.add(it.uid); }; player.inv.forEach(_fix); if(player.eq) Object.values(player.eq).forEach(_fix); }
        // 廢品記憶（依完整簽章）：舊存檔初始化，並把目前已標記為廢品的物品轉成記憶
        if(!player.junkPrefs) {
            player.junkPrefs = {};
            player.inv.forEach(i => { if(i.junk) player.junkPrefs[itemSig(i)] = true; });
        }
        // 🔧 廢品記憶改以「完整簽章」為鍵（同 id＋完全相同詞綴才自動標記）；舊存檔的純 id 鍵轉為無詞綴簽章
        {
            let _np = {};
            for (let k in player.junkPrefs) { if (player.junkPrefs[k]) _np[k.includes('|') ? k : (k + '|0|0|0||')] = true; }
            player.junkPrefs = _np;
        }
        // 相容舊存檔：新增第六屬性 魅力(cha)，起始 8
        if(player.base && player.base.cha === undefined) player.base.cha = (createBase[player.cls] ? createBase[player.cls].cha : 8);
        if(player.alloc && player.alloc.cha === undefined) player.alloc.cha = 0;
        if(!player.panacea) player.panacea = { str:0, dex:0, con:0, int:0, wis:0, cha:0 };
        if(!player.siege) player.siege = { active:false, gateKilled:false, towerKilled:false, endTime:0, kills:0, result:null, cooldownUntil:0, rewardPending:false, victoryUntil:0, accCdUntil:0 };
        if(player.panaceaUsed === undefined) player.panaceaUsed = 0;
        if(player.ismaelAccUsed === undefined) player.ismaelAccUsed = ((((player.siege || {}).accCdUntil) || 0) > Date.now());   // 🔧 舊檔遷移：飾品卷軸 24h 冷卻 → 次數制（冷卻中視為本額度已用）
        if(player.cds && player.cds.purifySk === undefined) player.cds.purifySk = 0;   // 🔧 舊檔遷移：淨化技獨立冷卻
        if(!player.lastMapByCat) player.lastMapByCat = {};
        if(player.tracking === undefined) player.tracking = null;
        // 相容舊存檔：單一 partner → partners 陣列
        if(player.partners === undefined) player.partners = (player.partner ? [player.partner] : []);
        if(player.allies === undefined || !Array.isArray(player.allies)) player.allies = [];   // 協力角色（其他存檔位）
        if(!Array.isArray(player.petStorage)) player.petStorage = [];   // 🐾 包武寵物保管（項圈，每角色獨立）
        // 相容舊存檔：返生術改為被動技能，清除先前施放殘留的無作用 buff；初始化復活卷軸冷卻
        if(player.buffs) player.buffs.sk_resurrection = 0;
        if(player.buffs && player.buffs.haste >= 999999) player.buffs.haste = 0;   // 修復舊版伊娃之盾殘留的永久加速（改由 _equipHaste 旗標處理）
        if(player.reviveScrollCd === undefined) player.reviveScrollCd = 0;
        if(player.magicShieldCd === undefined) player.magicShieldCd = 0;   // 相容舊存檔：魔法屏障抵擋後冷卻
        // 修復舊版「召喚死亡後 buff 未清除」卡關：載入時若目前沒有召喚物，清除殘留的召喚 buff，
        // 讓自動施放能立即重新召喚（不必等死亡復活或 buff 自然倒數）。
        if(player.charmed === undefined) player.charmed = null;   // 相容舊存檔：迷魅獨立槽位
        if(!player.summon && player.buffs) {
            (player.skills || []).forEach(s => { if(DB.skills[s] && DB.skills[s].summon) player.buffs[s] = 0; });
        }
        if(!player.charmed && player.buffs) player.buffs.sk_charm = 0;
        if(player.bloodPledge === undefined) player.bloodPledge = null;   // 相容舊存檔：血盟陣營（null/esti/tros）
        if(player.name === undefined) player.name = null;   // 相容舊存檔：未取名則狀態欄顯示「點擊取名」
        if(!player.blessings || typeof player.blessings !== 'object') player.blessings = {};   // 相容舊存檔：盟主祝福
        // 相容舊存檔：屬性詞綴舊版僅為 true/false，新版需為 12 種代碼之一；非法值一律清除（視為普通武器）
        let _normAttr = (i) => { if (i && !getAttrAffix(i.attr)) i.attr = false; };
        player.inv.forEach(_normAttr);
        for (let k in player.eq) _normAttr(player.eq[k]);
        // 🔮 席琳套裝效果改置腰帶：一次性清除既有「項鍊」上的套裝效果（背包/裝備/傭兵快照/共用倉庫）
        {
            let _fixSet = (it) => { if (it && it.seteff) { let dd = DB.items[it.id]; if (dd && dd.slot === 'amulet') it.seteff = false; } };
            player.inv.forEach(_fixSet);
            for (let k in player.eq) _fixSet(player.eq[k]);
            (player.allies || []).forEach(a => { if (a && a.eq) { for (let k in a.eq) _fixSet(a.eq[k]); } if (a && a.inv) a.inv.forEach(_fixSet); });
            try { let _w = loadWarehouse(); let _chg = false; _w.items.forEach(it => { if (it && it.seteff) { let dd = DB.items[it.id]; if (dd && dd.slot === 'amulet') { it.seteff = false; _chg = true; } } }); if (_chg) saveWarehouse(_w); } catch (e) {}
        }
        consolidateInventory();   // 相容舊存檔：合併修復前被拆分的相同卷軸/物品堆疊
        purgeCompletedElfWhisper();   // 🔥 載入時：若已交付完成精靈的私語階段，自動清除身上殘留的精靈的私語
        if(!player.statuses) player.statuses = { stun: 0, freeze: 0, stone: 0, poison: 0, poisonDmg: 0, poisonTick: 0, burn: 0, burnDmg: 0, burnTick: 0, scald: 0, scaldDmg: 0, scaldTick: 0, bleed: 0, bleedDmg: 0, bleedTick: 0, sleep: 0, silence: 0, paralyze: 0 };
        if (player.eq.arrow === undefined) player.eq.arrow = null; // 相容舊存檔
        // 相容舊存檔：手套曾被錯存於 eq.glove（單數），搬移到正確的 gloves 欄位
        if (player.eq.glove) { if (!player.eq.gloves) player.eq.gloves = player.eq.glove; delete player.eq.glove; }

        // 🔧 架構#6：集中式預設值合併（放在所有「轉換型」遷移之後，作為缺漏欄位的統一保底）。
        // 日後新增欄位只需登錄於 SAVE_DEFAULTS；上方逐項 if(undefined) 為歷史遷移，不必再增列。
        applySaveDefaults(player);
        if (typeof loadSharedCollections === 'function') loadSharedCollections();   // 🎴🗡️ 讀檔：載入同模式共用收集圖鑑（卡片/裝備·併入該角色既有資料）
        if (typeof ensureCardBook === 'function') ensureCardBook();   // 🎴 舊存檔遷移：移除道具欄的卡片收集冊本體（改由「收藏」面板開啟）
        if (typeof ensureEquipBook === 'function') ensureEquipBook();   // 🗡️ 舊存檔遷移：移除裝備收集冊本體＋登錄現有(背包/已裝備)裝備
        if (typeof ensureMiscDex === 'function') ensureMiscDex();   // 🧰 舊存檔遷移：登錄現有道具到道具收集冊

        // 👇 正確的新版起點邏輯
        // 🔧 讀檔回「家」改走 getHomeTown()：血盟成員回盟主村莊（海音/歐瑞），否則回職業起始村，與回村按鈕邏輯一致
        setMapSelectors(getHomeTown());

        if (player.eq && player.eq.ring3 === undefined) player.eq.ring3 = null;   // 🔧 舊存檔補上第三戒指欄
        if (player.eq && player.eq.ring4 === undefined) player.eq.ring4 = null;   // 🔧 舊存檔補上第四戒指欄
        // 🔧 負重改版遷移：負重強化不再開放重甲，卸下現在無法裝備的裝備到背包
        ['wpn','arrow','helm','armor','shield','cloak','tshirt','gloves','boots','ring1','ring2','ring3','ring4','amulet','belt'].forEach(_sl => {
            let _e = player.eq && player.eq[_sl]; if (!_e) return;
            let _ok = true; try { _ok = checkCanEquip(_e); } catch(err) { _ok = true; }
            if (!_ok) {
                let _ex = player.inv.find(i => sameItemSig(i, _e) && !i.lock && !i.junk);
                if (_ex) _ex.cnt += (_e.cnt || 1); else player.inv.push(_e);
                player.eq[_sl] = null;
                logSys(`<span class="text-amber-300">因負重強化改版，無法再裝備的 ${DB.items[_e.id] ? DB.items[_e.id].n : '裝備'} 已自動卸下至背包。</span>`);
            }
        });
        syncShahaArrow();   // 🏝️ 沙哈之弓：載入時校正無限箭狀態
        calcStats();
        applySherineTheme();   // 🔮 還原席琳的世界視覺主題
        changeMap(true);
        renderTabs();
        renderSkillSelects();
        renderMobs();
        
        // 載入自動化設定 (如果有存過的話)
        if (player.config) {
            let c = player.config;
            
            // 藥水設定與顏色變更
            if (c.setPot) {
                let potSel = document.getElementById('set-pot');
                potSel.value = c.setPot;
                potSel.classList.remove('text-red-300', 'text-orange-300', 'text-white');
                potSel.classList.add(c.setPot === 'potion_heal' ? 'text-red-300' : (c.setPot === 'potion_strong' ? 'text-orange-300' : 'text-white'));
            }
            if (c.setHpPot) document.getElementById('set-hp-pot').value = c.setHpPot;
            if (c.setAutoBuyPot !== undefined) document.getElementById('set-auto-buy-pot').checked = c.setAutoBuyPot;
            
            // 施法設定
            if (c.selAtkSkill) document.getElementById('sel-atk-skill').value = c.selAtkSkill;
            if (c.setMpAtk) document.getElementById('set-mp-atk').value = c.setMpAtk;
            if (c.selHealSkill) document.getElementById('sel-heal-skill').value = c.selHealSkill;
            if (c.setMpHeal) document.getElementById('set-mp-heal').value = c.setMpHeal;
            if (c.selConvertSkill && document.getElementById('sel-convert-skill')) document.getElementById('sel-convert-skill').value = c.selConvertSkill;
            if (c.setHpConvert && document.getElementById('set-hp-convert')) document.getElementById('set-hp-convert').value = c.setHpConvert;
            if (c.setHpSkill != null && c.setHpSkill !== '' && document.getElementById('set-hp-skill')) document.getElementById('set-hp-skill').value = c.setHpSkill;
            
            // 藥水與卷軸開關
            if (c.setHaste !== undefined) document.getElementById('set-haste').checked = c.setHaste;
            if (c.setAutoBuyHaste !== undefined) document.getElementById('set-auto-buy-haste').checked = c.setAutoBuyHaste;
            if (c.setBrave !== undefined) document.getElementById('set-brave').checked = c.setBrave;
            if (c.setAutoBuyBrave !== undefined) document.getElementById('set-auto-buy-brave').checked = c.setAutoBuyBrave;
            if (c.setBlue !== undefined) document.getElementById('set-blue').checked = c.setBlue;
            if (c.setAutoBuyBlue !== undefined) document.getElementById('set-auto-buy-blue').checked = c.setAutoBuyBlue;
            if (c.setCautious !== undefined) document.getElementById('set-cautious').checked = c.setCautious;
            if (c.setAutoBuyCautious !== undefined) document.getElementById('set-auto-buy-cautious').checked = c.setAutoBuyCautious;
            if (c.setElfcookie !== undefined) document.getElementById('set-elfcookie').checked = c.setElfcookie;
            if (c.setAutoBuyElfcookie !== undefined) document.getElementById('set-auto-buy-elfcookie').checked = c.setAutoBuyElfcookie;
            if (c.setPoly !== undefined) document.getElementById('set-poly').checked = c.setPoly;
            if (c.setAutoBuyPoly !== undefined) document.getElementById('set-auto-buy-poly').checked = c.setAutoBuyPoly;
            if (c.setMagicbarrier !== undefined) document.getElementById('set-magicbarrier').checked = c.setMagicbarrier;
            if (c.setTeleport !== undefined) document.getElementById('set-teleport').checked = c.setTeleport;
            if (c.setAutoBuyTeleport !== undefined) document.getElementById('set-auto-buy-teleport').checked = c.setAutoBuyTeleport;
            if (c.setAutoBuyArrow !== undefined) document.getElementById('set-auto-buy-arrow').checked = c.setAutoBuyArrow;
            
            // 動態魔法 Buff 設定還原
            if (c.autoBuffSkills) {
                for (let sid in c.autoBuffSkills) {
                    let chk = document.getElementById(`auto-sk-${sid}`);
                    if (chk) chk.checked = c.autoBuffSkills[sid];
                }
            }
        } else {
            // 舊版存檔相容：如果沒有 config 就預設全關
            ['set-haste', 'set-brave', 'set-blue', 'set-cautious', 'set-poly', 'set-auto-buy-pot', 'set-auto-buy-arrow'].forEach(id => {
                let el = document.getElementById(id);
                if(el) el.checked = false;
            });
        }
        
        updateClassPotionRows();
        
        state.running = true;
        // 自然恢復（每 16 秒）已由主迴圈 tick() 內的 state.ticks % 160 統一驅動，不再額外 setInterval。
        // 計時器統一由 startGameTimers() 註冊（內含去重），含每 5 分鐘自動存檔。
        startGameTimers();
        logSys(`===== 歡迎回來 =====`);
    }
}

// 配點/萬能藥的「自然屬性值」：基礎+配點+萬能藥（不含裝備與 buff）；屬性上限只套用在此值上，裝備/buff 可再往上疊加
function naturalStat(s) { return (player.base[s] || 0) + (player.alloc[s] || 0) + ((player.panacea && player.panacea[s]) || 0); }
function adjBonusStat(s) {
    let capN = 60;   // 屬性配點上限：一律 60，不分等級；上限只看 naturalStat(base+配點+萬能藥)，裝備/buff 一律不計入、可再往上疊加
    if (player.bonus > 0 && naturalStat(s) < capN) {
        player.alloc[s]++; player.bonus--;
        calcStats();
    }
}

// ===== 🕯️ 回憶蠟燭：六大屬性「配點重置」（草稿式：玩家實際數值不變、確認後才一次套用；資訊面板顯示 Lv1+草稿）=====
let _respec = null;   // { draft:{str..cha}, pts:N }；null=非重置中
function _respecSpent() { let d = _respec.draft; return d.str + d.dex + d.con + d.int + d.wis + d.cha; }
function respecPtsLeft() { return _respec ? (_respec.pts - _respecSpent()) : 0; }
function startRespec() {
    if (_respec) return;   // 已在重置中
    let c = player.inv.find(i => i.id === 'candle');
    if (!c) { logSys('你沒有回憶蠟燭。'); return; }
    let b = createBase[player.cls];
    _respec = { draft: { str:0, dex:0, con:0, int:0, wis:0, cha:0 }, pts: b.pts + Math.max(0, (player.lv || 1) - 49) };   // 可重配＝創角點數＋(等級-49)升級點數
    { let _sb = document.querySelector('[onclick*="switchTab(\'stats\'"]'); if (_sb) switchTab('stats', _sb); }   // 切到能力分頁讓玩家配點
    updateUI();
    logSys('🕯️ 回憶蠟燭：六大屬性已暫時回到 Lv1，請以 +／- 重新分配後按「確認」生效（「取消」則不消耗蠟燭）。');
}
// 六大屬性的 +/- 路由：重置中＝改草稿；否則＝花用升級點數（僅 +、不可退）
function adjAlloc(s, dir) {
    let capN = 60;
    if (_respec) {
        let b = createBase[player.cls];
        if (dir > 0) { if (respecPtsLeft() > 0 && (b[s] + _respec.draft[s]) < capN) _respec.draft[s]++; }
        else { if (_respec.draft[s] > 0) _respec.draft[s]--; }
        updateUI();
    } else if (dir > 0 && (player.bonus || 0) > 0) {
        adjBonusStat(s); updateUI();
    }
}
function confirmRespec() {
    if (!_respec) return;
    let c = player.inv.find(i => i.id === 'candle');
    if (!c) { _respec = null; updateUI(); logSys('沒有回憶蠟燭，已取消重置。'); return; }
    let b = createBase[player.cls];
    let left = Math.max(0, respecPtsLeft());
    // 消耗一個蠟燭
    if ((c.cnt || 1) > 1) c.cnt--; else player.inv = player.inv.filter(i => i !== c);
    // 套用：base 還原純職業起始、alloc=草稿、清空萬能藥（退還純白）、賣項圈解夥伴、未配點轉升級點數
    let used = player.panaceaUsed || 0;
    player.base = { str:b.str, dex:b.dex, con:b.con, int:b.int, wis:b.wis, cha:b.cha };
    player.alloc = { str:_respec.draft.str, dex:_respec.draft.dex, con:_respec.draft.con, int:_respec.draft.int, wis:_respec.draft.wis, cha:_respec.draft.cha };
    player.panacea = { str:0, dex:0, con:0, int:0, wis:0, cha:0 }; player.panaceaUsed = 0;
    if (used > 0) { gainItem('panacea_white', used, true, true); logSys(`回收已使用的萬能藥，獲得 <span class="text-slate-100 font-bold">純白的萬能藥</span> ×${used}。`); }
    let collarIds = Object.keys(PET_DEF).map(nm => PET_DEF[nm].collar);
    let collars = player.inv.filter(i => collarIds.includes(i.id));
    if (collars.length > 0) {
        let g = 0, cnt = 0;
        collars.forEach(i => { g += getSellPrice(i) * (i.cnt || 1); cnt += (i.cnt || 1); });
        player.inv = player.inv.filter(i => !collarIds.includes(i.id));
        player.gold += g; player.partners = [];
        logSys(`重置配點：自動賣出所有項圈共 ${cnt} 個，獲得 <span class="text-yellow-400 font-bold">${g}</span> 金幣。`);
    }
    player.bonus = left;
    _respec = null;
    calcStats(); renderTabs(true); updateUI(); saveGame();
    logSys('配點已確認生效。' + (left > 0 ? ` 尚有 <b>${left}</b> 點未分配（已轉為升級點數，可日後再配）。` : ''));
}
function cancelRespec() {
    if (!_respec) return;
    _respec = null;
    updateUI();
    logSys('已取消配點重置，未使用回憶蠟燭。');
}
function useCandle() { startRespec(); }   // 🔧 舊入口（保留相容）：導向新的配點重置流程

function resetStatsCandle() {
    let b = createBase[player.cls];
    // 還原為「創角時的初始狀態」：base = 純職業起始能力（不含創角分配）
    player.base = { str: b.str, dex: b.dex, con: b.con, int: b.int, wis: b.wis, cha: b.cha };
    player.alloc = { str:0, dex:0, con:0, int:0, wis:0, cha:0 };
    let _usedPanacea = player.panaceaUsed || 0;   // 重置前先記錄已使用的萬能藥瓶數
    player.panacea = { str:0, dex:0, con:0, int:0, wis:0, cha:0 }; player.panaceaUsed = 0;   // 回憶蠟燭同時清空萬能藥的加成與使用次數
    if (_usedPanacea > 0) { gainItem('panacea_white', _usedPanacea, true, true); logSys(`回收已使用的萬能藥，獲得 <span class="text-slate-100 font-bold">純白的萬能藥</span> ×${_usedPanacea}。`); }
    // 可重新分配的點數 = 創角可分配點數 + (等級-49) 升級點數
    player.bonus = b.pts + Math.max(0, player.lv - 49);
    // 重置點數時：自動賣出背包內所有項圈，並解除對應夥伴
    let collarIds = Object.keys(PET_DEF).map(nm => PET_DEF[nm].collar);
    let collars = player.inv.filter(i => collarIds.includes(i.id));
    if (collars.length > 0) {
        let g = 0, cnt = 0;
        collars.forEach(i => { g += getSellPrice(i) * (i.cnt || 1); cnt += (i.cnt || 1); });
        player.inv = player.inv.filter(i => !collarIds.includes(i.id));
        player.gold += g;
        player.partners = [];   // 項圈已全數賣出，解除所有夥伴
        logSys(`重置配點：自動賣出所有項圈共 ${cnt} 個，獲得 <span class="text-yellow-400 font-bold">${g}</span> 金幣。`);
    }
    calcStats();
    updateUI();
    logSys(`所有配點已重置，請重新分配。`);
}
