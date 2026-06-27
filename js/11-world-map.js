// ===== 地圖分類選單（村莊／野外／地監／特殊） =====
const MAP_CATEGORIES = {
    village: [
        {v:'town_silver_knight',t:'銀騎士村'}, {v:'town_elf',t:'妖精森林'}, {v:'town_talking',t:'說話之島'},
        {v:'town_gludio',t:'燃柳村'}, {v:'town_giran',t:'奇岩'}, {v:'town_heine',t:'海音'},
        {v:'town_oren',t:'歐瑞村莊'}, {v:'town_aden',t:'亞丁',c:'#facc15'}, {v:'town_ivory_tower',t:'象牙塔'}, {v:'town_witon',t:'威頓村'},
        {v:'town_sherine',t:'席琳神殿',c:'#4ade80',classicHide:true}, {v:'town_silent',t:'沉默洞穴',c:'#a78bfa'}, {v:'town_hyperia',t:'希培利亞村莊',c:'#c084fc'}, {v:'town_behemoth',t:'貝希摩斯',c:'#f59e0b'}, {v:'town_flame_audience',t:'炎魔謁見所',c:'#ff6b35',questReq:'demonTemple',affinityReq:1000}
    ],
    wild: [
        {v:'silver_knight',t:'銀騎士地區'}, {v:'talking_island',t:'說話之島周邊'}, {v:'zone_01',t:'妖精森林周邊'},
        {v:'talking_island_port',t:'說話之島港口'}, {v:'elf_forest',t:'妖魔森林'}, {v:'gludio',t:'古魯丁'},
        {v:'windwood',t:'風木'}, {v:'desert',t:'沙漠'}, {v:'kent',t:'肯特'}, {v:'dragon_valley',t:'龍之谷'},
        {v:'fire_dragon',t:'火龍窟'}, {v:'giran',t:'奇岩'}, {v:'heine',t:'海音'}, {v:'twilight_mt',t:'黃昏山脈'}, {v:'mirror_forest',t:'鏡子森林'},
        {v:'zone_02',t:'歐瑞'}, {v:'zone_03',t:'歐瑞雪原'}, {v:'zone_04',t:'艾爾摩激戰地'}, {v:'zone_05',t:'國境要塞'},
        {v:'silent_outer',t:'沉默洞穴周邊',c:'#a78bfa'},
        {v:'elf_grave',t:'精靈墓穴',c:'#67e8f9'}, {v:'hidden_cave',t:'大洞穴隱遁者村莊地區',c:'#a78bfa'}, {v:'giant_tomb',t:'古代巨人之墓',c:'#d6d3d1'}
    ],
    dungeon: [
        {v:'zone_06',t:'古魯丁地監1樓'},{v:'zone_07',t:'古魯丁地監2樓'},{v:'zone_08',t:'古魯丁地監3樓'},{v:'zone_09',t:'古魯丁地監4樓'},{v:'zone_10',t:'古魯丁地監5樓'},{v:'zone_11',t:'古魯丁地監6樓'},{v:'zone_12',t:'古魯丁地監7樓'},
        {v:'zone_13',t:'說話之島地監1樓'},{v:'zone_14',t:'說話之島地監2樓'},
        {v:'zone_15',t:'眠龍洞穴1樓'},{v:'zone_16',t:'眠龍洞穴2樓'},{v:'zone_17',t:'眠龍洞穴3樓'},
        {v:'crystal_cave1',t:'水晶洞穴1樓'},{v:'crystal_cave2',t:'水晶洞穴2樓'},{v:'crystal_cave3',t:'水晶洞穴3樓'},
        {v:'zone_18',t:'奇岩地監1樓'},{v:'zone_19',t:'奇岩地監2樓'},{v:'zone_20',t:'奇岩地監3樓'},{v:'zone_21',t:'奇岩地監4樓'},
        {v:'zone_22',t:'沙漠地監1樓'},{v:'zone_23',t:'沙漠地監2樓'},{v:'zone_24',t:'沙漠地監3樓'},{v:'zone_25',t:'沙漠地監4樓'},
        {v:'zone_26',t:'龍之谷地監1樓'},{v:'zone_27',t:'龍之谷地監2樓'},{v:'zone_28',t:'龍之谷地監3樓'},{v:'zone_29',t:'龍之谷地監4樓'},{v:'zone_30',t:'龍之谷地監5樓'},{v:'zone_31',t:'龍之谷地監6樓'},
        {v:'zone_32',t:'螞蟻洞窟1樓'},{v:'zone_33',t:'螞蟻洞窟2樓'},
        {v:'zone_34',t:'地下通道1樓'},{v:'zone_35',t:'地下通道2樓'},{v:'zone_36',t:'地下通道3樓'},
        {v:'eva_kingdom',t:'伊娃王國'},
        {v:'zone_37',t:'象牙塔4樓'},{v:'zone_38',t:'象牙塔5樓'},{v:'zone_39',t:'象牙塔6樓'},{v:'zone_40',t:'象牙塔7樓'},{v:'zone_41',t:'象牙塔8樓'},
        {v:'rastabad_cave1',t:'拉斯塔巴德地下洞穴1樓'},{v:'rastabad_cave2',t:'拉斯塔巴德地下洞穴2樓'},{v:'rastabad_cave3',t:'拉斯塔巴德地下洞穴3樓'},
        {v:'rastabad_gate',t:'拉斯塔巴德正門'},
        {v:'rastabad_beast',t:'魔獸訓練場'},
        {v:'dark_magic_lab',t:'黑魔法研究室'},
        {v:'necro_training',t:'冥法軍訓練場'},
        {v:'elder_room',t:'格蘭肯神殿．長老之室'},
        {v:'demon_temple',t:'魔族神殿',c:'#9b2c2c',questReq:'demonTemple'},
        {v:'shadow_temple',t:'暗影神殿',c:'#7c3aed',keyHoldReq:'item_shadow_temple_key',affinityReq:1000}
    ],
    special: [
        {v:'training',t:'新兵修練場'}, {v:'dream_island',t:'夢幻之島'},
        {v:'king_baranka_room',t:'魔獸軍王之室',c:'#f87171',needKey:'item_king_key'},
        {v:'law_king_room',t:'法令軍王之室',c:'#f87171',needKey:'item_king_key'},
        {v:'necro_king_room',t:'冥法軍王之室',c:'#f87171',needKey:'item_king_key'},
        {v:'assassin_king_room',t:'暗殺軍王之室',c:'#f87171',needKey:'item_king_key'},
        {v:'antaras_lair',t:'安塔瑞斯棲息地',c:'#fb923c'}, {v:'fafurion_lair',t:'法利昂洞穴',c:'#60a5fa'}, {v:'valakas_lair',t:'巴拉卡斯巢穴',c:'#f87171'}
    ],
    // 🗼 傲慢之塔：1樓為入口安全區；其餘一開始皆灰色，2~10樓需擊敗潔尼斯、11樓以上需持有對應傳送符/支配符/移動卷軸
    tower: [
        {v:'town_pride', t:'傲慢之塔1樓', c:'#facc15'},
        {v:'pride_2_10',   t:'傲慢之塔2~10樓',   c:'#fca5a5', prideReq:'jenis'},
        {v:'pride_11_20',  t:'傲慢之塔11~20樓',  c:'#fca5a5', prideReq:11},
        {v:'pride_21_30',  t:'傲慢之塔21~30樓',  c:'#fca5a5', prideReq:21},
        {v:'pride_31_40',  t:'傲慢之塔31~40樓',  c:'#fca5a5', prideReq:31},
        {v:'pride_41_50',  t:'傲慢之塔41~50樓',  c:'#fca5a5', prideReq:41},
        {v:'pride_51_60',  t:'傲慢之塔51~60樓',  c:'#fca5a5', prideReq:51},
        {v:'pride_61_70',  t:'傲慢之塔61~70樓',  c:'#fca5a5', prideReq:61},
        {v:'pride_71_80',  t:'傲慢之塔71~80樓',  c:'#fca5a5', prideReq:71},
        {v:'pride_81_90',  t:'傲慢之塔81~90樓',  c:'#fca5a5', prideReq:81},
        {v:'pride_91_100', t:'傲慢之塔91~100樓', c:'#fca5a5', prideReq:91}
    ],
    // 🌀 時空裂痕：入口安全區（進入/領獎兩按鈕＋時間排名；戰場 rift_battle 不在清單、由 mapCategoryOf 特判）
    rift: [
        {v:'town_rift', t:'時空裂痕入口', c:'#a78bfa'},
        {v:'thebes_desert', t:'底比斯 沙漠', c:'#fcd34d'},
        {v:'thebes_pyramid', t:'底比斯 金字塔內部', c:'#fcd34d'},
        {v:'thebes_temple', t:'底比斯 歐西里斯祭壇', c:'#f87171', needKey:'item_thebes_altar_key'}
    ],
    // 🏴‍☠️ 海賊島：村莊（安全區）＋ 野外（背景＝古魯丁）＋ 地監（背景＝說話之島地監1樓）
    pirate_island: [
        {v:'town_pirate_village', t:'海賊島村莊', c:'#38bdf8'},
        {v:'pirate_wild', t:'海賊島', c:'#38bdf8'},
        {v:'pirate_dungeon', t:'海賊島地監', c:'#38bdf8'}
    ]
};
// ===== 🗺️ 地圖「地區」分類（依 map_categories.md：城堡/銀騎士村/.../席琳神殿）=====
//  下拉選單改以「地區」分組顯示；MAP_CATEGORIES（村莊/野外/地監…）維持原樣，仍是掉落(js/05)/魔物追蹤(obelMapList)/背景(applyAreaBackground)等遊戲邏輯依據。
//  每筆只記 {v, t}：t＝下拉顯示名（可較 MAP_CATEGORIES 原名精確，如「奇岩城鎮/奇岩周邊」）；顏色 c 與進入條件(needKey/questReq/prideReq…)一律由 MAP_CATEGORIES 對應項解析，免重複維護。
//  攻城獲勝城堡：不再獨立成「城堡」分類，改依位置注入所屬地區(肯特/風木/海音·castleCity+castleAt)；風木地監隨風木城一起進風木地區。攻城進行中(動態 getSiegeAreas) 仍由 rebuildMapCategoryOptions 視狀態插「攻城」。
//  ⚠️新增地圖時：除了加進 MAP_CATEGORIES，也要在此對應地區補一筆，否則該圖不會出現在下拉。
const MAP_REGIONS = [
    { key: 'silverknight', label: '銀騎士村', maps: [
        {v:'town_silver_knight', t:'銀騎士村莊'}, {v:'silver_knight', t:'銀騎士村周邊'}, {v:'training', t:'新兵修練場'}
    ]},
    { key: 'fairyforest', label: '妖精森林', maps: [
        {v:'town_elf', t:'妖精森林村莊'}, {v:'zone_01', t:'妖精森林周邊'},
        {v:'zone_15', t:'眠龍洞穴1樓'}, {v:'zone_16', t:'眠龍洞穴2樓'}, {v:'zone_17', t:'眠龍洞穴3樓'}
    ]},
    { key: 'talkingisland', label: '說話之島', maps: [
        {v:'town_talking', t:'說話之島村莊'}, {v:'talking_island_port', t:'說話之島港口'}, {v:'talking_island', t:'說話之島周邊'},
        {v:'zone_13', t:'說話之島地監1樓'}, {v:'zone_14', t:'說話之島地監2樓'}
    ]},
    { key: 'burningwillow', label: '燃柳村', maps: [
        {v:'town_gludio', t:'燃柳村莊'}, {v:'elf_forest', t:'妖魔森林'},
        {v:'town_pirate_village', t:'海賊島村莊'}, {v:'pirate_wild', t:'海賊島周邊'}, {v:'pirate_dungeon', t:'海賊島地監'},
        {v:'elf_grave', t:'精靈墓穴'}, {v:'hidden_cave', t:'大洞穴隱遁者村莊地區'}
    ]},
    { key: 'gludin', label: '古魯丁', maps: [
        {v:'gludio', t:'古魯丁周邊'},
        {v:'zone_06', t:'古魯丁地監1樓'}, {v:'zone_07', t:'古魯丁地監2樓'}, {v:'zone_08', t:'古魯丁地監3樓'}, {v:'zone_09', t:'古魯丁地監4樓'}, {v:'zone_10', t:'古魯丁地監5樓'}, {v:'zone_11', t:'古魯丁地監6樓'}, {v:'zone_12', t:'古魯丁地監7樓'}
    ]},
    { key: 'kent', label: '肯特', castleCity: 'kent', castleAt: 0, maps: [
        {v:'kent', t:'肯特周邊'}
    ]},
    { key: 'windwood', label: '風木', castleCity: 'windwood', castleAt: 0, maps: [
        {v:'windwood', t:'風木周邊'}, {v:'desert', t:'沙漠'},
        {v:'zone_22', t:'沙漠地監1樓'}, {v:'zone_23', t:'沙漠地監2樓'}, {v:'zone_24', t:'沙漠地監3樓'}, {v:'zone_25', t:'沙漠地監4樓'},
        {v:'zone_32', t:'螞蟻洞窟1樓'}, {v:'zone_33', t:'螞蟻洞窟2樓'}
    ]},
    { key: 'heine', label: '海音', castleCity: 'heine', castleAt: 1, maps: [
        {v:'town_heine', t:'海音城鎮'}, {v:'heine', t:'海音周邊'}, {v:'mirror_forest', t:'鏡子森林'},
        {v:'zone_34', t:'地下通道1樓'}, {v:'zone_35', t:'地下通道2樓'}, {v:'zone_36', t:'地下通道3樓'},
        {v:'eva_kingdom', t:'伊娃王國'}, {v:'fafurion_lair', t:'法利昂洞穴'}
    ]},
    { key: 'giran', label: '奇岩', maps: [
        {v:'town_giran', t:'奇岩城鎮'}, {v:'giran', t:'奇岩周邊'},
        {v:'zone_18', t:'奇岩地監1樓'}, {v:'zone_19', t:'奇岩地監2樓'}, {v:'zone_20', t:'奇岩地監3樓'}, {v:'zone_21', t:'奇岩地監4樓'}
    ]},
    { key: 'dragonvalley', label: '龍之谷', maps: [
        {v:'dragon_valley', t:'龍之谷'},
        {v:'zone_26', t:'龍之谷地監1樓'}, {v:'zone_27', t:'龍之谷地監2樓'}, {v:'zone_28', t:'龍之谷地監3樓'}, {v:'zone_29', t:'龍之谷地監4樓'}, {v:'zone_30', t:'龍之谷地監5樓'}, {v:'zone_31', t:'龍之谷地監6樓'},
        {v:'antaras_lair', t:'安塔瑞斯棲息地'}, {v:'town_silent', t:'沉默洞穴'}, {v:'silent_outer', t:'沉默洞穴周邊'}
    ]},
    { key: 'witon', label: '威頓', maps: [
        {v:'town_witon', t:'威頓村莊'}, {v:'fire_dragon', t:'火龍窟'}, {v:'valakas_lair', t:'巴拉卡斯巢穴'}, {v:'town_behemoth', t:'貝希摩斯'}
    ]},
    { key: 'oren', label: '歐瑞', maps: [
        {v:'town_oren', t:'歐瑞村莊'}, {v:'zone_02', t:'歐瑞周邊'}, {v:'zone_03', t:'歐瑞雪原'}, {v:'zone_04', t:'艾爾摩激戰地'}, {v:'zone_05', t:'國境要塞'},
        {v:'town_ivory_tower', t:'象牙塔（1~3樓）'}, {v:'zone_37', t:'象牙塔4樓'}, {v:'zone_38', t:'象牙塔5樓'}, {v:'zone_39', t:'象牙塔6樓'}, {v:'zone_40', t:'象牙塔7樓'}, {v:'zone_41', t:'象牙塔8樓'},
        {v:'crystal_cave1', t:'水晶洞穴1樓'}, {v:'crystal_cave2', t:'水晶洞穴2樓'}, {v:'crystal_cave3', t:'水晶洞穴3樓'},
        {v:'shadow_temple', t:'暗影神殿'}, {v:'town_hyperia', t:'希培利亞'}
    ]},
    { key: 'aden', label: '亞丁', maps: [
        {v:'town_aden', t:'亞丁城鎮'}, {v:'twilight_mt', t:'黃昏山脈'}, {v:'dream_island', t:'夢幻之島'}
    ]},
    { key: 'tower', label: '傲慢之塔', maps: [
        {v:'town_pride', t:'傲慢之塔1樓'}, {v:'pride_2_10', t:'傲慢之塔2~10樓'}, {v:'pride_11_20', t:'傲慢之塔11~20樓'}, {v:'pride_21_30', t:'傲慢之塔21~30樓'}, {v:'pride_31_40', t:'傲慢之塔31~40樓'}, {v:'pride_41_50', t:'傲慢之塔41~50樓'}, {v:'pride_51_60', t:'傲慢之塔51~60樓'}, {v:'pride_61_70', t:'傲慢之塔61~70樓'}, {v:'pride_71_80', t:'傲慢之塔71~80樓'}, {v:'pride_81_90', t:'傲慢之塔81~90樓'}, {v:'pride_91_100', t:'傲慢之塔91~100樓'}
    ]},
    { key: 'rastabad', label: '拉斯塔巴德', maps: [
        {v:'rastabad_cave1', t:'拉斯塔巴德地下洞穴1樓'}, {v:'rastabad_cave2', t:'拉斯塔巴德地下洞穴2樓'}, {v:'rastabad_cave3', t:'拉斯塔巴德地下洞穴3樓'},
        {v:'rastabad_gate', t:'拉斯塔巴德正門'}, {v:'giant_tomb', t:'古代巨人之墓'},
        {v:'demon_temple', t:'魔族神殿'}, {v:'town_flame_audience', t:'炎魔謁見所'},
        {v:'rastabad_beast', t:'魔獸訓練場'}, {v:'dark_magic_lab', t:'黑魔法研究室'}, {v:'necro_training', t:'冥法軍訓練場'}, {v:'elder_room', t:'格蘭肯神殿．長老之室'},
        {v:'king_baranka_room', t:'魔獸君王之室'}, {v:'law_king_room', t:'法令君王之室'}, {v:'necro_king_room', t:'冥法君王之室'}, {v:'assassin_king_room', t:'暗殺君王之室'}
    ]},
    { key: 'rift', label: '時空裂痕', maps: [
        {v:'town_rift', t:'時空裂痕入口'}, {v:'thebes_desert', t:'底比斯 沙漠'}, {v:'thebes_pyramid', t:'底比斯 金字塔內部'}, {v:'thebes_temple', t:'底比斯 歐西里斯祭壇'}
    ]},
    { key: 'sherine', label: '席琳神殿', maps: [
        {v:'town_sherine', t:'席琳神殿'}
    ]}
];
// 由地圖 v 找回 MAP_CATEGORIES 的原始定義（顏色/進入條件/原名）
function mapEntryOf(v) { for (let c in MAP_CATEGORIES) { let e = MAP_CATEGORIES[c].find(x => x.v === v); if (e) return e; } return null; }
// 地圖 v 屬於哪個「地區」下拉分類（特例：攻城動態、攻城獲勝城堡歸所屬地區、傲慢之塔攀登樓層、時空裂痕戰場）
function mapRegionOf(v) {
    if (SIEGE_OUTER_INNER.includes(v)) return 'siege';
    if (CASTLE_EXTRA.includes(v)) return 'windwood';   // 🏰 風木地監→風木地區（攻城獲勝後開放）
    for (let _ck in SIEGE_CITY) { if (SIEGE_CITY[_ck].castle === v) return _ck; }   // 🏰 攻城獲勝城堡→所屬地區(地區 key 與 SIEGE_CITY key 同名：kent/windwood/heine)
    if (typeof v === 'string' && (v.startsWith('pride_f') || v === 'pride_climb')) return 'tower';   // 🗼 攀登中的樓層歸入傲慢之塔
    if (v === 'rift_battle') return 'rift';   // 🌀 時空裂痕戰場歸入時空裂痕
    for (let r of MAP_REGIONS) { if (r.maps.some(m => m.v === v)) return r.key; }
    return null;
}
// 某地區下拉應顯示的地圖清單（攻城動態另接；其餘由 MAP_REGIONS 取 v、自 MAP_CATEGORIES 解析顏色/條件、以地區自訂名覆寫顯示）
function regionMapList(rk) {
    if (rk === 'siege') return getSiegeAreas();
    let reg = MAP_REGIONS.find(r => r.key === rk); if (!reg) return [];
    let out = reg.maps.map(m => { let ce = mapEntryOf(m.v) || {}; return Object.assign({}, ce, { v: m.v, t: m.t || ce.t || m.v }); });
    // 🏰 攻城獲勝城堡：依位置注入所屬地區（取代舊「城堡」分類）。getCastleAreas 自帶 siegeVictoryActive 時效守衛、只回傳當前獲勝城池(風木另含風木地監)
    if (reg.castleCity && siegeVictoryActive() && victoryCityCfg().key === reg.castleCity) {
        let _at = reg.castleAt || 0;
        out = out.slice(0, _at).concat(getCastleAreas(), out.slice(_at));
    }
    return out;
}
// 地區在目前模式下是否有可見地圖（經典模式隱藏整個只剩席琳神殿的地區，避免空分類）
function regionHasVisible(rk) { return regionMapList(rk).some(m => !(m.classicHide && player.classicMode)); }
// ===== 🔧 攻城城池設定（肯特城／風木城；機制相同，僅城門/守護塔/地圖/城堡不同）=====
const SIEGE_CITY = {
    kent:     { key:'kent',     name:'肯特城', outer:'kent_outer', outerName:'肯特外門區', inner:'kent_inner', innerName:'肯特內城', castle:'town_kent_castle',     castleName:'肯特城', gate:'肯特城門', tower:'肯特守護塔' },
    windwood: { key:'windwood', name:'風木城', outer:'ww_outer',   outerName:'風木外門區', inner:'ww_inner',   innerName:'風木內城', castle:'town_windwood_castle', castleName:'風木城', gate:'風木城門', tower:'風木守護塔' },
    heine:    { key:'heine',    name:'海音城', outer:'heine_outer', outerName:'海音外門區', inner:'heine_inner', innerName:'海音內城', castle:'town_heine_castle', castleName:'海音城', gate:'海音城門', tower:'海音守護塔' }
};
function siegeCityCfg() { return SIEGE_CITY[(player.siege && player.siege.city) || 'kent']; }   // 進行中攻城的城池
function victoryCityCfg() { return SIEGE_CITY[(player.siege && player.siege.victoryCity) || 'kent']; }   // 攻城獲勝（8折/城堡）對應城池
const SIEGE_OUTER_INNER = ['kent_outer', 'kent_inner', 'ww_outer', 'ww_inner', 'heine_outer', 'heine_inner'];
const SIEGE_CASTLES = ['town_kent_castle', 'town_windwood_castle', 'town_heine_castle'];

// ===== 🏰 城堡護衛：肯特/風木城雇用；同時只能雇一名，承擔 10% 對應類型傷害（肯特=一般攻擊、風木=魔法攻擊） =====
const CASTLE_GUARD_OPTS = {
    kent:     { mode: 'absorb', type: 'phys',  label: '一般攻擊', list: [
        { id: 'kent_g1', name: '肯特警衛', maxHp: 300,  regen: 15, cost: 0 },
        { id: 'kent_g2', name: '肯特守衛', maxHp: 1000, regen: 50, cost: 1000000 },
        { id: 'kent_g3', name: '肯特鐵衛', maxHp: 1500, regen: 75, cost: 5000000 } ] },
    windwood: { mode: 'absorb', type: 'magic', label: '魔法攻擊', list: [
        { id: 'ww_g1', name: '風木警衛', maxHp: 300,  regen: 15, cost: 0 },
        { id: 'ww_g2', name: '風木守衛', maxHp: 1000, regen: 50, cost: 1000000 },
        { id: 'ww_g3', name: '風木鐵衛', maxHp: 1500, regen: 75, cost: 5000000 } ] },
    heine:    { mode: 'heal', label: '治療', list: [
        { id: 'heine_g1', name: '海音僧侶', maxMp: 40,  regen: 2,  cost: 0,       heal: 'sk_heal1',    healName: '初級治癒術' },
        { id: 'heine_g2', name: '海音神官', maxMp: 110, regen: 5,  cost: 1000000, heal: 'sk_heal_mid', healName: '中級治癒術' },
        { id: 'heine_g3', name: '海音巫女', maxMp: 200, regen: 10, cost: 5000000, heal: 'sk_heal2',    healName: '高級治癒術' } ] }
};
function renderCastleGuard(div, city) {
    _activePanel = null;
    let cfg = CASTLE_GUARD_OPTS[city]; if (!cfg) return;
    let heal = cfg.mode === 'heal';
    let g = player.castleGuard;
    let cur = '';
    if (g) {
        let _cur = heal ? Math.floor(g.mp) : Math.floor(g.hp), _max = heal ? g.maxMp : g.maxHp;
        cur = `<div class="bg-slate-800/70 border border-amber-600 rounded p-3 text-sm mb-1">
            <div class="font-bold text-amber-300 mb-1">目前雇用：${g.name}（${heal ? 'HP 低於門檻時每 5 秒治療' : '承擔 10% '+(g.absorbType==='magic'?'魔法':'一般')+'攻擊'}）</div>
            <div class="text-slate-200">${heal?'MP':'HP'} ${_cur}/${_max}　門檻：HP ≤ ${g.threshold}%　${g.disabled?'<span class="text-red-400">'+(heal?'魔力耗盡':'力竭')+'（恢復至50%再起）</span>':'<span class="text-emerald-300">'+(heal?'待命治療':'護衛中')+'</span>'}</div>
            <button onclick="cancelCastleGuard()" class="btn mt-2 px-3 py-1 text-sm bg-red-900 hover:bg-red-800 border-red-600 text-red-200 font-bold">取消雇用</button>
        </div>`;
    }
    let rows = cfg.list.map((o, i) => {
        let costTxt = o.cost === 0 ? '免費' : (o.cost / 10000) + ' 萬金幣';
        let dis = !!g;
        let stat = heal ? `MP ${o.maxMp}、每16秒恢復 ${o.regen} MP、施放 ${o.healName}` : `HP ${o.maxHp}、每16秒恢復 ${o.regen} HP`;
        return `<div class="bg-slate-800/60 border border-slate-700 rounded p-3 text-sm flex flex-col gap-2">
            <div><span class="font-bold text-white">${o.name}</span> <span class="text-slate-400">${stat}</span></div>
            <div class="text-slate-400">費用：<span class="${o.cost===0?'text-emerald-300':'text-yellow-400'} font-bold">${costTxt}</span>（持續到城堡擁有時間結束）</div>
            <div class="flex items-center gap-2 flex-wrap">
                <button ${dis?'disabled':''} onclick="hireCastleGuard('${city}', ${i})" class="btn px-3 py-1 text-sm font-bold ${dis?'bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed':'bg-emerald-800 hover:bg-emerald-700 border-emerald-600 text-emerald-100'}">雇用</button>
                <span class="text-slate-300 text-xs">HP ≤ <input id="cg-thr-${i}" type="number" value="50" min="1" max="100" class="w-14 bg-slate-900 border border-slate-600 text-center text-white rounded"> % 以下${heal?'發動治療':'發動護衛'}</span>
            </div>
        </div>`;
    }).join('');
    let intro = heal
        ? `雇用一名神官：<b class="text-green-300">當你的 HP 低於設定門檻時，每 5 秒為你施放一次治癒術</b>（只計基礎值、不受魔法傷害加成）。同時只能雇一名，更換前需先取消。神官不會攻擊；魔力耗盡會停止治療，待自動恢復至 50% MP 或回城補滿後再次生效。`
        : `雇用一名護衛替你承擔 <b class="text-amber-300">10% 的${cfg.label}傷害</b>（僅當你的 HP 低於設定門檻時發動）。同時只能雇一名，更換前需先取消。護衛不會攻擊；血量降到 1 會停止護衛，待自動恢復至 50% 或回城補滿後再次生效。`;
    div.innerHTML = `<div class="flex flex-col gap-2 p-1"><div class="text-slate-300 text-sm leading-relaxed">${intro}</div>${cur}${rows}</div>`;
}
function hireCastleGuard(city, idx) {
    if (!siegeVictoryActive()) { logSys('<span class="text-red-400">攻城獲勝（擁有城堡）期間才能雇用城堡護衛。</span>'); return; }
    if (player.castleGuard) { logSys('<span class="text-red-400">已雇用護衛，請先取消現有雇用再更換。</span>'); return; }
    let cfg = CASTLE_GUARD_OPTS[city]; if (!cfg) return;
    let o = cfg.list[idx]; if (!o) return;
    if ((player.gold || 0) < o.cost) { logSys(`<span class="text-red-400">金幣不足，雇用 ${o.name} 需要 ${o.cost.toLocaleString()} 金幣。</span>`); return; }
    let thrEl = document.getElementById('cg-thr-' + idx);
    let thr = Math.max(1, Math.min(100, parseInt(thrEl && thrEl.value) || 50));
    player.gold -= o.cost;
    if (cfg.mode === 'heal') {
        player.castleGuard = { id: o.id, name: o.name, mode: 'heal', maxMp: o.maxMp, mp: o.maxMp, regen: o.regen, threshold: thr, healSkill: o.heal, city: city, disabled: false, _regenAcc: 0, _healAcc: 0 };
        logSys(`<span class="text-emerald-300 font-bold">雇用了 ${o.name}（HP ≤ ${thr}% 時每 5 秒施放 ${o.healName}）。</span>`);
    } else {
        player.castleGuard = { id: o.id, name: o.name, mode: 'absorb', maxHp: o.maxHp, hp: o.maxHp, regen: o.regen, threshold: thr, absorbType: cfg.type, city: city, disabled: false, _regenAcc: 0 };
        logSys(`<span class="text-emerald-300 font-bold">雇用了 ${o.name}（HP ≤ ${thr}% 時承擔 10% ${cfg.label}傷害）。</span>`);
    }
    saveGame(); updateUI();
    let el = document.getElementById('interaction-content'); if (el) renderCastleGuard(el, city);
}
function cancelCastleGuard() {
    if (!player.castleGuard) return;
    let _c = player.castleGuard.city;
    logSys(`<span class="text-slate-300">已取消雇用 ${player.castleGuard.name}。</span>`);
    player.castleGuard = null;
    saveGame(); updateUI();
    let el = document.getElementById('interaction-content'); if (el) renderCastleGuard(el, _c);
}
// 受到對應類型傷害時，城堡護衛承擔 10%（玩家 HP 低於門檻、護衛未力竭時）；回傳玩家實際承受的傷害
function castleGuardAbsorb(dmg, type) {
    let g = player.castleGuard;
    if (!g || g.absorbType !== type || !siegeVictoryActive()) return dmg;
    if (g.disabled || g.hp <= 1) return dmg;
    if (player.hp > player.mhp * (g.threshold / 100)) return dmg;   // 未低於門檻 → 不護衛
    let share = Math.floor(dmg * 0.10);
    if (share <= 0) return dmg;
    g.hp -= share;
    if (g.hp <= 1) { g.hp = 1; g.disabled = true; logCombat(`<span class="text-amber-300 font-bold">【${g.name}】</span>力竭倒下，暫停護衛（恢復至 50% 後再起）。`, 'enemy'); }
    else logCombat(`<span class="text-amber-300">【${g.name}】</span>替你承擔了 ${share} 點傷害。`, 'magic');
    return dmg - share;
}
// 每 tick：城堡擁有結束/換城 → 解散；每16秒回血；回血達 50% 解除力竭
function castleGuardTick() {
    let g = player.castleGuard; if (!g) return;
    if (!siegeVictoryActive() || (typeof victoryCityCfg === 'function' && victoryCityCfg().key !== g.city)) { player.castleGuard = null; return; }
    if (g.mode === 'heal') {
        g._regenAcc = (g._regenAcc || 0) + 1;
        if (g._regenAcc >= 160) { g._regenAcc = 0; if (g.mp < g.maxMp) g.mp = Math.min(g.maxMp, g.mp + g.regen); }
        if (g.disabled && g.mp >= g.maxMp * 0.5) g.disabled = false;
        g._healAcc = (g._healAcc || 0) + 1;
        if (g._healAcc >= 50) {   // 每 5 秒嘗試治療
            g._healAcc = 0;
            let mhp = player.mhp;
            if (!g.disabled && !player.dead && player.hp < mhp && player.hp <= mhp * (g.threshold / 100)) {
                let sk = DB.skills[g.healSkill];
                let cost = sk ? (sk.mp || 0) : 0;
                if (g.mp >= cost) {
                    g.mp -= cost;
                    let amt = rollDice(sk.healDice[0], sk.healDice[1]) + (sk.healBase || 0);
                    player.hp = Math.min(mhp, player.hp + amt);
                    logSys(`<span class="text-green-300">${g.name} 施放 ${sk.n||'治癒術'}，恢復 ${amt} HP。</span>`);
                } else {
                    g.disabled = true;
                    logSys(`<span class="text-red-400">${g.name} 魔力不足，暫停治療（恢復至 50% MP 後再起）。</span>`);
                }
            }
        }
        return;
    }
    g._regenAcc = (g._regenAcc || 0) + 1;
    if (g._regenAcc >= 160) { g._regenAcc = 0; if (g.hp < g.maxHp) g.hp = Math.min(g.maxHp, g.hp + g.regen); }
    if (g.disabled && g.hp >= g.maxHp * 0.5) g.disabled = false;
}
const CASTLE_EXTRA = ['windwood_dungeon'];   // 🔧 風木地監歸入「城堡」分類（隨風木城一起，攻城獲勝後開放）
// 🔧 城堡分類清單：依獲勝城池組成。肯特城＝僅肯特城；風木城＝風木城（安全）＋風木地監（狩獵）
function getCastleAreas() {
    if (!siegeVictoryActive()) return [];   // 🔧 攻城獲勝 24h 結束後：城堡狩獵區（風木地監）不再開放（與「城堡」分頁同步消失，堵住出發/選單殘留路徑；victoryCity 不會被清空，故須在此以時效把關）
    let c = victoryCityCfg();
    if (c.key === 'windwood') return [{v:'town_windwood_castle', t:'風木城'}, {v:'windwood_dungeon', t:'風木地監', c:'#34d399'}];
    return [{v:c.castle, t:c.castleName}];
}
function mapCategoryOf(v) {
    if (SIEGE_OUTER_INNER.includes(v)) return 'siege';
    if (SIEGE_CASTLES.includes(v) || CASTLE_EXTRA.includes(v)) return 'castle';
    if (typeof v === 'string' && (v.startsWith('pride_f') || v === 'pride_climb')) return 'tower';   // 🗼 攀登中的樓層歸入傲慢之塔分類
    if (v === 'rift_battle') return 'rift';   // 🌀 時空裂痕戰場歸入時空裂痕分類
    for (let cat in MAP_CATEGORIES) { if (MAP_CATEGORIES[cat].some(m => m.v === v)) return cat; }
    return 'wild';
}
function isSiegeArea(v) { return SIEGE_OUTER_INNER.includes(v); }
function getSiegeAreas() {
    let s = player.siege || {};
    let c = siegeCityCfg();
    if (s.gateKilled) return [{v:c.inner, t:c.innerName}];   // 攻破城門後：外門區隱藏，只剩內城
    return [{v:c.outer, t:c.outerName}, {v:c.inner, t:c.innerName + '（需先攻破城門）', disabled:true, c:'#64748b'}];
}
function rebuildMapCategoryOptions() {
    let catSel = document.getElementById('map-category'); if (!catSel) return;
    let opts = [];
    if (player.siege && player.siege.active) opts.push(['siege','攻城']);   // ⚔️ 攻城進行中（攻城獲勝城堡不再獨立成「城堡」分類，已注入肯特/風木/海音地區）
    MAP_REGIONS.forEach(r => { if (regionHasVisible(r.key)) opts.push([r.key, r.label]); });   // 🗺️ 17 地區（依 map_categories.md 順序；經典模式空地區自動隱藏）
    catSel.innerHTML = opts.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('');
}
// 🗼 是否持有指定樓層區間(N)的 傳送符 / 支配符 / 移動卷軸（任一即可進入；支配符可在塔內手動傳送）
//    封印傳送符(prideKind:'sealed')不算數——必須先使用解封成傳送符才生效
function prideHasTalisman(tier, kinds) {
    let allow = kinds || ['pass', 'dom', 'scroll'];
    return player.inv.some(i => { let d = DB.items[i.id]; return d && d.prideTier === tier && d.prideKind && allow.includes(d.prideKind) && (i.cnt || 1) >= 1; });
}
function mapOptDisabled(m) {
    if (m.disabled) return true;
    if (m.classicHide && player.classicMode) return true;   // 🔥 經典模式：席琳神殿不可進入（縱深防護，配合 populateMapSelect 隱藏選項）
    if (m.needKey && !player.inv.some(i => i.id === m.needKey && (i.cnt || 1) >= 1)) return true;   // 🔑 需鑰匙地圖：背包無鑰匙 → 灰色不可選
    // 🗼 傲慢之塔樓層門檻：2~10樓需曾擊敗潔尼斯女王；11樓以上需持有對應傳送符/支配符/移動卷軸
    if (m.questReq === 'demonTemple' && !player.demonTempleOpen) return true;   // 🔥 魔族神殿：須完成該角色 50 級試煉指定階段才開放（逐角色）
    if (m.keyHoldReq && !player.inv.some(i => i.id === m.keyHoldReq && (i.cnt || 1) >= 1)) return true;   // 🌑 暗影神殿：需「持有」指定鑰匙才可進入（不消耗，與 needKey 不同）
    if (m.affinityReq && (player.flameAffinity || 0) < m.affinityReq) return true;   // 🔥 炎魔謁見所：除完成試煉外，還需炎魔友好度（隱藏值，於魔族神殿擊殺累積）達標
    if (m.prideReq === 'jenis' && !player.prideBeatJenis) return true;
    if (typeof m.prideReq === 'number' && !prideHasTalisman(m.prideReq)) return true;
    return false;
}
function populateMapSelect(cat) {
    let sel = document.getElementById('map-select'); if (!sel) return;
    sel.innerHTML = '';
    let list = regionMapList(cat);
    list.forEach(m => {
        if (m.classicHide && player.classicMode) return;   // 🔥 經典模式：隱藏席琳神殿（連選項都不顯示）
        let o = document.createElement('option');
        o.value = m.v; o.textContent = m.t;
        if (mapOptDisabled(m)) { o.disabled = true; o.style.color = '#64748b'; }
        else if (m.c) o.style.color = m.c;
        sel.appendChild(o);
    });
}
function onMapCategoryChange() {
    // 切換分類時，重建右側清單並讓人物一併移動到該分類的第一個可選地圖
    let cat = document.getElementById('map-category').value;
    populateMapSelect(cat);
    let list = regionMapList(cat);
    let firstOk = list.find(m => !mapOptDisabled(m));
    // 優先回到該分類「上次到過」的地圖；無紀錄或已失效（如攻城結束／缺鑰匙）則用第一個可選地圖
    let remembered = player.lastMapByCat && player.lastMapByCat[cat];
    let target = (remembered && list.some(m => m.v === remembered && !mapOptDisabled(m))) ? remembered : (firstOk ? firstOk.v : null);
    if (target) {
        document.getElementById('map-select').value = target;
        changeMap();   // 實際移動（受控狀態時 changeMap 會擋下並還原兩個選單）
    }
}
function setMapSelectors(mapKey) {
    // 將「分類選單 + 地圖選單」同步到指定地圖
    rebuildMapCategoryOptions();
    let cat = mapRegionOf(mapKey);   // 🗺️ 下拉改用「地區」分類（mapCategoryOf 仍為型別分類，供掉落/追蹤/背景等邏輯）
    let catSel = document.getElementById('map-category'); if (catSel) catSel.value = cat;
    populateMapSelect(cat);
    let sel = document.getElementById('map-select'); if (sel) sel.value = mapKey;
    updatePrideFloorIndicator();
}
function syncMapSelectors() { setMapSelectors(mapState.current); }
// 🗼 攀登/排名模式：右上角原本空白的地圖選單改顯示「傲慢之塔 X 樓」（與系統日誌的樓層資訊同色 text-rose-200）
function updatePrideFloorIndicator() {
    let ind = document.getElementById('pride-floor-indicator');
    let sel = document.getElementById('map-select');
    let cat = document.getElementById('map-category');
    if (!ind) return;
    let cur = mapState.current;
    if (state.prideClimb && typeof cur === 'string' && cur.indexOf('pride_f') === 0) {
        let n = state.prideFloor || parseInt((cur.match(/pride_f(\d+)/) || [])[1]) || 2;
        ind.textContent = '傲慢之塔 ' + n + ' 樓';
        ind.classList.remove('hidden');
        if (sel) sel.classList.add('hidden');
        if (cat) cat.classList.remove('hidden');   // 傲慢之塔維持原行為：左側分類選單仍顯示
    } else if (state.oblivion && (cur === 'oblivion_travel' || cur === 'oblivion_island')) {
        ind.textContent = (cur === 'oblivion_island') ? '遺忘之島' : '遺忘之島途中';
        ind.classList.remove('hidden');
        if (sel) sel.classList.add('hidden');
        if (cat) cat.classList.add('hidden');   // 🏝️ 遺忘之島：左側分類選單一併隱藏，防止切換左選單離開旅程（只保留回村按鈕）
    } else if (state.riftRun && cur === 'rift_battle') {
        let _se = Math.floor((Date.now() - (state.riftStartMs || Date.now())) / 1000);
        ind.textContent = '🌀 時空裂痕 ' + fmtPrideTime(_se * 1000);
        ind.classList.remove('hidden');
        if (sel) sel.classList.add('hidden');
        if (cat) cat.classList.add('hidden');   // 🌀 裂痕內鎖定左右選單，只能用「回村」離開
    } else if (isHiddenArea(cur)) {
        ind.textContent = '🏛️ ' + HIDDEN_AREA_NAMES[cur];   // 🏛️ 隱藏狩獵區域：右地圖選單消失、改顯示對應名稱（只能用「回村」離開、或在區內傳送重置怪物）
        ind.classList.remove('hidden');
        if (sel) sel.classList.add('hidden');
        if (cat) cat.classList.add('hidden');
    } else {
        ind.classList.add('hidden');
        if (sel) sel.classList.remove('hidden');
        if (cat) cat.classList.remove('hidden');   // 還原左側分類選單
    }
}
function getHomeTown() {
    // 血盟優先回到盟主所在村莊；否則回該職業創角起始村莊
    if (player.cls === 'royal') return 'town_talking';   // 👑 王族：恆回說話之島（雖天生入盟，出生地仍為說話之島）
    if (player.bloodPledge === 'esti') return 'town_heine';
    if (player.bloodPledge === 'tros') return 'town_oren';
    if (player.cls === 'dark') return 'town_silent';   // 🔧 黑暗妖精：未加入血盟時回沉默洞穴（已加入則上面已回盟主村莊）
    if (player.cls === 'illusion') return 'town_hyperia';   // 🔧 幻術士：回希培利亞村莊
    if (player.cls === 'dragon') return 'town_behemoth';   // 🐉 龍騎士：回貝希摩斯
    if (player.cls === 'warrior') return 'town_heine';   // ⚔️ 戰士：回海音
    if (player.cls === 'mage') return 'town_talking';
    if (player.cls === 'elf') return 'town_elf';
    return 'town_silver_knight';
}
function returnToTown() {
    if (state.riftRun && mapState.current === 'rift_battle') { logSys('<span class="text-violet-300">扭曲的時空緊緊纏繞著你，無法回村——唯有戰死方能離開時空裂痕。</span>'); return; }   // 🌀 裂痕內不可回村
    // 與切換地圖相同的受控限制（石化／麻痺／冰凍／暈眩時無法回村）
    if (player.statuses && (player.statuses.stone > 0 || player.statuses.paralyze > 0 || player.statuses.freeze > 0 || player.statuses.stun > 0 || player.statuses.sleep > 0)) {
        logSys('你目前無法行動（石化／麻痺／冰凍／暈眩），無法回村。');
        return;
    }
    let _wasKingRoom = !!KING_ROOMS[mapState.current];   // 🔧 記住離開前是否在軍王之室
    if (state.oblivion) { state.oblivion = null; state._oblivionAdvance = false; }   // 🏝️ 回村即結束遺忘之島旅程
    setMapSelectors(siegeVictoryActive() ? victoryCityCfg().castle : getHomeTown());   // 攻城獲勝 24h：回城＝獲勝城池
    changeMap();   // 走既有切換流程（進入村莊：補滿 HP/MP、清狀態、渲染 NPC）
    // 🔧 自軍王之室手動回城／回村：同樣將「特殊」記憶位置改為新兵修練場（避免下次自動回到需鑰匙的軍王之室）
    if (_wasKingRoom) { if (!player.lastMapByCat) player.lastMapByCat = {}; player.lastMapByCat.special = 'training'; saveGame(); }
}
// 🔧 村莊「出發」按鈕：一鍵回到上一張戰鬥地圖。軍王之室需鑰匙，無鑰匙顯示鑰匙不足。
function departToLastBattle() {
    if (player.statuses && (player.statuses.stone > 0 || player.statuses.paralyze > 0 || player.statuses.freeze > 0 || player.statuses.stun > 0 || player.statuses.sleep > 0)) {
        logSys('你目前無法行動（石化／麻痺／冰凍／暈眩），無法出發。');
        return;
    }
    if (isHiddenArea(player.lastBattleMap)) { enterHiddenArea(player.lastBattleMap); return; }   // 🏛️ 上一張為隱藏狩獵區域→直接 force 重進（繞過選單可選性檢查）
    let tgt = player.lastBattleMap;
    if (tgt === 'rift_battle') { logSys('<span class="text-violet-300">扭曲的時空已經崩塌消失，沒有可以出發的地圖。</span>'); return; }   // 🌀 裂痕已崩塌：不可用「出發」重進，須在入口以龜裂之核重新進入
    // 🔧 攻城結束後，上一張戰鬥地圖若為攻城區（外門/內城）：強制改往新手修練場，避免重新進入已結束的攻城區
    if (tgt && SIEGE_OUTER_INNER.includes(tgt) && !(player.siege && player.siege.active)) {
        tgt = 'training';
        player.lastBattleMap = 'training';
    }
    // 🔧 攻城獲勝 24h 結束後，上一張戰鬥地圖若為城堡狩獵區（風木地監）：強制改往新兵修練場，避免「回城→出發」重新進入已失效的城堡狩獵區
    if (tgt && CASTLE_EXTRA.includes(tgt) && !siegeVictoryActive()) {
        tgt = 'training';
        player.lastBattleMap = 'training';
    }
    // 🗼 傲慢之塔：上一個戰鬥地點若在塔內 → 預設導回 傲慢之塔1樓（入口），不直接重進樓層（避免重複消耗移動卷軸）。
    //    唯一例外：上一處是「樓層區間(pride_X_Y)」且仍持有該層的「傳送符或支配符」(持有即可進入、不消耗) → 直接回到原本樓層；
    //    排名攀登層(pride_fN)、2~10樓(無傳送符機制)、或未持符者一律回 1樓。
    if (tgt && typeof tgt === 'string' && tgt.startsWith('pride_')) {
        let _mt = tgt.match(/^pride_(\d+)_\d+$/);
        let _tier = _mt ? parseInt(_mt[1]) : null;
        if (_tier && _tier >= 11 && DB.maps[tgt] && prideHasTalisman(_tier, ['pass', 'dom'])) {
            setMapSelectors(tgt); changeMap(); return;   // 持傳送符/支配符 → 回到原本樓層
        }
        setMapSelectors('town_pride');
        changeMap();
        return;
    }
    // 🏝️ 遺忘之島：上一處在「途中／本島」→ 無法以「出發」直接前往（須回海音找依斯巴搭船、重付費用）
    if (tgt === 'oblivion_travel' || tgt === 'oblivion_island') {
        logSys('<span class="text-slate-400">沒有可出發地圖，請至海音找依斯巴搭船前往遺忘之島。</span>');
        return;
    }
    if (!tgt || (!DB.maps[tgt] && !KING_ROOMS[tgt])) { logSys('<span class="text-slate-400">尚無上一張戰鬥地圖，請從地圖選單選擇前往。</span>'); return; }
    if (KING_ROOMS[tgt]) {   // 🔧 鑰匙閘改用「該房自己的鑰匙」(_kr.key)——底比斯歐西里斯祭壇需 item_thebes_altar_key，不再誤用 item_king_key（修：持軍王鑰匙竟能直接「出發」回祭壇）
        let _kk = KING_ROOMS[tgt].key || 'item_king_key';
        if (!player.inv.some(i => i.id === _kk && (i.cnt || 1) >= 1)) {
            logSys(`<span class="text-red-400">鑰匙不足，無法進入${KING_ROOMS[tgt].name || '軍王之室'}。</span>`);
            return;
        }
    }
    setMapSelectors(tgt);
    if (document.getElementById('map-select').value !== tgt) {   // 目標目前不可前往（如攻城已結束、地圖未開放）
        syncMapSelectors();
        logSys('<span class="text-slate-400">上一張戰鬥地圖目前無法前往。</span>');
        return;
    }
    changeMap();   // 走既有切換流程（軍王之室在此消耗 1 把鑰匙）
}

// ===== 攻城戰（第一階段：核心循環）=====
function siegeWarrants() { return pledgeCountItem('new_item_241'); }   // 王族搜索狀數量
// 🔧 點「攻城戰」先開「選擇城池」介面（肯特城／風木城）；含開戰條件提示
function openSiegeSelect(faction) {
    let s = player.siege || {};
    if (!player.bloodPledge) { alert('你尚未加入任何血盟，無法宣布攻城戰。'); return; }
    if (s.active) { alert('攻城戰正在進行中！'); return; }
    if (s.rewardPending) { alert('你還有尚未領取的攻城戰獎勵，請先點「領賞」。'); return; }
    let cd = (s.cooldownUntil || 0) - Date.now();
    if (cd > 0) { let h = Math.floor(cd/3600000), m = Math.floor((cd%3600000)/60000); alert(`攻城戰冷卻中，尚需 ${h} 小時 ${m} 分才能再次宣布。`); return; }
    if (player.lv < 40) { alert('需要等級 40 以上才能宣布攻城戰。'); return; }
    let el = document.getElementById('interaction-content'); if (!el) return;
    el.innerHTML = `
        <div class="flex flex-col gap-4 p-2 items-center text-center">
            <div class="text-amber-200 font-bold text-lg">⚔ 宣布攻城戰</div>
            <div class="bg-slate-800/70 border border-red-700/60 rounded p-3 text-sm text-slate-300 leading-relaxed">
                消耗 <span class="text-amber-300 font-bold">10 張王族搜索狀</span>（目前持有 ${siegeWarrants()} 張），限時 30 分鐘。<br>
                不論攻打哪座城，結束後皆觸發 <span class="text-red-300 font-bold">24 小時冷卻</span>。
            </div>
            <div class="text-slate-300 text-sm">選擇要攻打的城池：</div>
            <div class="flex gap-3 w-full">
                <button class="btn flex-1 py-4 text-lg font-bold bg-red-900 hover:bg-red-800 border-red-500" onclick="startSiege('${faction}','kent')">🏰 肯特城</button>
                <button class="btn flex-1 py-4 text-lg font-bold bg-emerald-900 hover:bg-emerald-800 border-emerald-500" onclick="startSiege('${faction}','windwood')">🌲 風木城</button>
            </div>
            <button class="btn w-1/2 py-4 text-lg font-bold bg-sky-900 hover:bg-sky-800 border-sky-400 text-sky-100" onclick="startSiege('${faction}','heine')">🌊 海音城</button>
        </div>`;
}
function startSiege(faction, city) {
    city = SIEGE_CITY[city] ? city : 'kent';
    let cfg = SIEGE_CITY[city];
    let s = player.siege || (player.siege = { active:false, gateKilled:false, towerKilled:false, endTime:0, kills:0, result:null, cooldownUntil:0, rewardPending:false });
    if (!player.bloodPledge) { alert('你尚未加入任何血盟，無法宣布攻城戰。'); return; }
    if (s.active) { alert('攻城戰正在進行中！'); return; }
    if (s.rewardPending) { alert('你還有尚未領取的攻城戰獎勵，請先點「領賞」。'); return; }
    let cd = (s.cooldownUntil || 0) - Date.now();
    if (cd > 0) { let h = Math.floor(cd/3600000), m = Math.floor((cd%3600000)/60000); alert(`攻城戰冷卻中，尚需 ${h} 小時 ${m} 分才能再次宣布。`); return; }
    if (player.lv < 40) { alert('需要等級 40 以上才能宣布攻城戰。'); return; }
    if (siegeWarrants() < 10) { alert(`需持有 10 張以上王族搜索狀才能宣布攻城戰（目前 ${siegeWarrants()} 張）。`); return; }
    if (!confirm(`宣布對【${cfg.name}】的攻城戰將消耗 10 張王族搜索狀（目前持有 ${siegeWarrants()} 張），限時 30 分鐘。確定要開戰嗎？`)) return;
    // 消耗 10 張王族搜索狀
    let _need = 10;
    for (let it of player.inv) { if (it.id === 'new_item_241' && _need > 0) { let take = Math.min(it.cnt, _need); it.cnt -= take; _need -= take; } }
    player.inv = player.inv.filter(it => it.cnt > 0);
    renderTabs();
    player.siege = { active:true, city:city, gateKilled:false, towerKilled:false, endTime: Date.now() + 30*60*1000, kills:0, result:null, cooldownUntil:0, rewardPending:false, victoryUntil:0, victoryCity:(player.siege&&player.siege.victoryCity)||null, accCdUntil:0 };
    logSys(`⚔ <span class="text-red-300 font-bold">攻城戰開始！</span>消耗了 10 張王族搜索狀，限時 30 分鐘。攻破【${cfg.gate}】後進攻【${cfg.innerName}】，於時限內擊殺【${cfg.tower}】即可獲勝！`);
    setMapSelectors(cfg.outer);
    changeMap(true);
    updateUI();
}
function endSiege(result) {
    let s = player.siege; if (!s || !s.active) return;
    s.active = false; s.result = result; s.rewardPending = true;
    s.endTime = Date.now();   // 擊敗守護塔（獲勝）或時間到：攻城時間立即結束
    s.cooldownUntil = Date.now() + 24*3600*1000;   // 不論勝負，24 小時後才能再次宣布
    let _cfg = siegeCityCfg();
    if (result === 'win') { s.victoryUntil = Date.now() + 24*3600*1000; s.victoryCity = _cfg.key; player.ismaelAccUsed = false; logSys(`🏆🏰 <span class="text-yellow-300 font-bold">攻城獲勝！</span>擊破了${_cfg.tower}！24 小時內全商店 8 折、開放「城堡」前往${_cfg.castleName}，回村按鈕變為回城。前往盟主處點「領賞」領取金幣獎勵。`); }
    else logSys(`🏰 <span class="text-slate-300 font-bold">攻城失敗…</span>時間到，未能攻下${_cfg.tower}。仍可前往盟主處點「領賞」領取獎勵。`);
    { let timer = document.getElementById('siege-timer'); if (timer) timer.classList.add('hidden'); }   // 結束隱藏倒數
    setMapSelectors(getHomeTown());
    changeMap(true);
    updateUI();
    saveGame();   // 攻城戰結束時自動存檔
}
function siegeTick() {
    let s = player.siege;
    // 🔧 攻城獲勝 24h 一到：仍滯留在城堡狩獵區（風木地監）掛機的玩家，強制請離回村（堵住效期外續刷）。
    //    每秒檢查；踢出後 mapState.current 變村莊→條件轉 false 不重複觸發。只踢狩獵區、不踢城堡安全區（避免打斷領賞等互動）。
    if (mapState.current && CASTLE_EXTRA.includes(mapState.current) && !(s && s.active) && !siegeVictoryActive()) {
        logSys('<span class="text-amber-300 font-bold">⏳ 攻城獲勝效期已過，城堡狩獵區不再為你開放，你被請離回村了。</span>');
        setMapSelectors(getHomeTown());
        changeMap(true);
        updateUI();
        saveGame();
        return;
    }
    let timer = document.getElementById('siege-timer');
    if (!s || !s.active) { if (timer) timer.classList.add('hidden'); return; }
    if (timer) {
        let rem = Math.max(0, (s.endTime || 0) - Date.now());
        let mm = Math.floor(rem / 60000), ss = Math.floor((rem % 60000) / 1000);
        timer.textContent = `⚔ 攻城剩餘 ${mm}:${String(ss).padStart(2, '0')}`;
        timer.classList.remove('hidden');
    }
    if (!s.towerKilled && Date.now() >= (s.endTime || 0)) endSiege('lose');
}
function saveSiegeBossHp() {
    if (!player.siege) return;
    let c = siegeCityCfg();
    (mapState.mobs || []).forEach(m => {
        if (!m) return;
        if (m.n === c.gate) player.siege.gateHp = m.curHp;
        if (m.n === c.tower) player.siege.towerHp = m.curHp;
    });
}
function handleSiegeKill(mob) {
    let s = player.siege;
    if (!s || !s.active || !mob || !mob.siegeEnemy) return;
    let c = siegeCityCfg();
    s.kills = (s.kills || 0) + 1;
    if (mob.n === c.gate && !s.gateKilled) {
        s.gateKilled = true;
        logSys(`🏰 <span class="text-yellow-300 font-bold">${c.gate}已被攻破！</span>${c.innerName}已開啟，${c.outerName}關閉。`);
        setMapSelectors(c.inner);
        changeMap(true);
    } else if (mob.n === c.tower && !s.towerKilled) {
        s.towerKilled = true;
        endSiege('win');
    }
}
function siegeVictoryActive() { return !!(player.siege && Date.now() < (player.siege.victoryUntil || 0)); }
function shopPrice(base) { return siegeVictoryActive() ? Math.floor((base || 0) * 0.8) : (base || 0); }   // 攻城獲勝 24h：商店 8 折
// 🔧 對飾品施法的卷軸改為「次數制」：每次攻城獲勝重置 1 張購買額度
//（原 24 小時計時存於 player.siege.accCdUntil，會被 startSiege 整包重建而歸零，可用搜索狀重置冷卻刷買）
function ismaelAccAvailable() { return !player.ismaelAccUsed; }
let _obelSel = { map: '', mob: '' };
let _activePanel = null;   // 'obel' | 'pledge:esti' | 'pledge:tros' | null：目前開啟、需每分鐘刷新剩餘時間的面板
function startPanelRefresh() {
    if(window._panelRefreshTimer) return;
    window._panelRefreshTimer = setInterval(() => {
        let cont = document.getElementById('town-interaction-container');
        let el = document.getElementById('interaction-content');
        if(!cont || cont.classList.contains('hidden') || !el || !_activePanel) return;
        if(_activePanel === 'obel') {
            if(player.tracking && player.tracking.until > Date.now()) renderObelNPC(el);   // 追蹤中(有倒數)才刷新，避免打斷選取
        } else if(_activePanel.indexOf('pledge:') === 0) {
            renderPledgeNPC(el, _activePanel.split(':')[1]);
        }
    }, 60000);
}
function obelMapList() {
    let out = [];
    ['wild', 'dungeon', 'special'].forEach(cat => {
        (MAP_CATEGORIES[cat] || []).forEach(e => {
            if(DB.maps[e.v] && !PURE_BOSS_MAPS.includes(e.v)) out.push({ v: e.v, t: e.t });
        });
    });
    return out;
}
function renderObelNPC(div) {
    _activePanel = 'obel'; startPanelRefresh();
    let warrants = pledgeCountItem('new_item_241');
    let tr = player.tracking;
    if(tr && tr.until > Date.now()) {
        let leftMs = tr.until - Date.now();
        let h = Math.floor(leftMs / 3600000), m = Math.floor((leftMs % 3600000) / 60000);
        let mapName = (obelMapList().find(x => x.v === tr.map) || {}).t || tr.map;
        let mobName = (DB.mobs[tr.mob] || {}).n || tr.mob;
        div.innerHTML = `
        <div class="flex flex-col gap-3 p-1">
            <div class="text-slate-300 text-sm leading-relaxed">奧貝勒：我正在為你追蹤獵物。</div>
            <div class="bg-slate-800/60 border border-slate-600 rounded p-3 text-sm text-slate-200 leading-relaxed">
                追蹤目標：<span class="text-amber-300 font-bold">${mobName}</span><br>
                追蹤地區：<span class="text-sky-300">${mapName}</span><br>
                剩餘時間：<span class="text-green-400 font-bold">${h} 時 ${m} 分</span><br>
                <span class="text-xs text-slate-400">前往該地區時，每次出怪有 50% 機率為追蹤目標。</span>
            </div>
            <button class="btn bg-blue-700 hover:bg-blue-600 border-blue-500 py-2 px-4 font-bold" onclick="obelCancelTracking()">取消追蹤（剩 ${h} 時 ${m} 分）</button>
        </div>`;
        return;
    }
    let maps = obelMapList();
    let mapOpts = '<option value="">— 選擇地區 —</option>' + maps.map(x => `<option value="${x.v}" ${_obelSel.map === x.v ? 'selected' : ''}>${x.t}</option>`).join('');
    let mobHtml = '';
    if(_obelSel.map && DB.maps[_obelSel.map]) {
        mobHtml = DB.maps[_obelSel.map].map(id => {
            let mb = DB.mobs[id]; if(!mb) return '';
            if(mb.boss) {
                return `<label class="flex items-center gap-2 py-1 px-2 rounded opacity-50 cursor-not-allowed"><input type="checkbox" disabled> <span class="${getMobColor(mb.lv)}">${mb.n}</span> <span class="text-xs text-slate-500">Lv${mb.lv}</span> <span class="text-xs text-red-400">（頭目無法追蹤）</span></label>`;
            }
            let checked = _obelSel.mob === id;
            return `<label class="flex items-center gap-2 cursor-pointer py-1 px-2 rounded ${checked ? 'bg-sky-900/50' : ''}"><input type="checkbox" ${checked ? 'checked' : ''} onclick="onObelMobToggle('${id}')"> <span class="${getMobColor(mb.lv)}">${mb.n}</span> <span class="text-xs text-slate-500">Lv${mb.lv}</span></label>`;
        }).join('');
    }
    let canStart = _obelSel.mob && warrants >= 50;
    div.innerHTML = `
        <div class="flex flex-col gap-3 p-1">
            <div class="text-slate-300 text-sm leading-relaxed">奧貝勒：你想搜索哪一頭魔物？給我 50 張王族搜索狀就能幫你追蹤。<br><span class="text-xs text-slate-400">持有王族搜索狀：<span class="text-green-400 font-bold">${warrants}</span> 張</span></div>
            <select class="w-full bg-slate-900 border border-slate-600 text-white px-2 py-2 rounded text-sm" onchange="onObelMapChange(this.value)">${mapOpts}</select>
            ${_obelSel.map ? `<div class="bg-slate-800/40 border border-slate-700 rounded p-2 max-h-60 overflow-y-auto flex flex-col gap-0.5">${mobHtml || '<span class="text-slate-500 text-sm">此地區無可追蹤的怪物</span>'}</div>` : ''}
            <button class="btn ${canStart ? 'bg-red-700 hover:bg-red-600 border-red-500' : 'bg-slate-600 border-slate-500 opacity-60 cursor-not-allowed'} py-2 px-4 font-bold" ${canStart ? '' : 'disabled'} onclick="obelStartTracking()">開始追蹤（消耗 50 張王族搜索狀）</button>
        </div>`;
}
function onObelMapChange(v) { _obelSel.map = v; _obelSel.mob = ''; let el = document.getElementById('interaction-content'); if(el) renderObelNPC(el); }
function onObelMobToggle(id) { if(DB.mobs[id] && DB.mobs[id].boss) return; _obelSel.mob = (_obelSel.mob === id) ? '' : id; let el = document.getElementById('interaction-content'); if(el) renderObelNPC(el); }
function obelStartTracking() {
    if(!_obelSel.mob || !_obelSel.map) return;
    if(pledgeCountItem('new_item_241') < 50) { alert('王族搜索狀不足 50 張。'); return; }
    let left = 50;
    for(let it of player.inv) { if(it.id === 'new_item_241' && left > 0) { let take = Math.min(it.cnt, left); it.cnt -= take; left -= take; } }
    player.inv = player.inv.filter(it => it.cnt > 0);
    player.tracking = { map: _obelSel.map, mob: _obelSel.mob, until: Date.now() + 8 * 3600 * 1000 };
    _obelSel = { map: '', mob: '' };
    renderTabs(); saveGame();
    logSys(`奧貝勒開始追蹤 <span class="text-amber-300 font-bold">${(DB.mobs[player.tracking.mob] || {}).n}</span>，持續 8 小時。`);
    let el = document.getElementById('interaction-content'); if(el) renderObelNPC(el);
    updateUI();
}
function obelCancelTracking() {
    if(!confirm('確定要取消追蹤嗎？（已消耗的王族搜索狀不會退還）')) return;
    player.tracking = null;
    saveGame();
    logSys('已取消追蹤。');
    let el = document.getElementById('interaction-content'); if(el) renderObelNPC(el);
}
function renderIsmaelExchange(el) {
    let sw = invCountId('scroll_weapon'), sa = invCountId('scroll_armor');   // 🔧 含倉庫存量
    let swc = invCountId('scroll_weapon_c'), sac = invCountId('scroll_armor_c');
    let accOk = ismaelAccAvailable();
    let accTxt = accOk ? '' : '（本次額度已用完，攻城獲勝後重置）';
    el.innerHTML = `
        <div class="flex flex-col gap-3 p-1">
            <div class="text-slate-300 text-sm leading-relaxed">伊賽馬利：需要稀有的卷軸嗎？我這裡能交換（背包與倉庫的卷軸皆可使用）。</div>
            <div class="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-600 rounded p-3">
                <div class="text-sm text-slate-200 leading-relaxed">100 張 <span class="text-sky-300">對武器施法的卷軸</span> → 1 張 <span class="text-amber-300 font-bold">祝福的 對武器施法的卷軸</span><br><span class="text-xs text-slate-400">持有：${sw} 張（無次數限制）</span></div>
                <button class="btn bg-blue-700 hover:bg-blue-600 border-blue-500 py-2 px-4 font-bold shrink-0" onclick="ismaelExchange('weapon')">兌換</button>
            </div>
            <div class="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-600 rounded p-3">
                <div class="text-sm text-slate-200 leading-relaxed">100 張 <span class="text-sky-300">對盔甲施法的卷軸</span> → 1 張 <span class="text-amber-300 font-bold">祝福的 對盔甲施法的卷軸</span><br><span class="text-xs text-slate-400">持有：${sa} 張（無次數限制）</span></div>
                <button class="btn bg-blue-700 hover:bg-blue-600 border-blue-500 py-2 px-4 font-bold shrink-0" onclick="ismaelExchange('armor')">兌換</button>
            </div>
            <div class="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-600 rounded p-3">
                <div class="text-sm text-slate-200 leading-relaxed">100 張 <span class="text-sky-300">對武器施法的卷軸</span> → 1 張 <span class="c-cursed">詛咒的 對武器施法的卷軸</span><br><span class="text-xs text-slate-400">持有：${sw} 張（無次數限制）</span></div>
                <button class="btn bg-purple-800 hover:bg-purple-700 border-purple-500 py-2 px-4 font-bold shrink-0" onclick="ismaelMakeCursed('weapon')">兌換</button>
            </div>
            <div class="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-600 rounded p-3">
                <div class="text-sm text-slate-200 leading-relaxed">100 張 <span class="text-sky-300">對盔甲施法的卷軸</span> → 1 張 <span class="c-cursed">詛咒的 對盔甲施法的卷軸</span><br><span class="text-xs text-slate-400">持有：${sa} 張（無次數限制）</span></div>
                <button class="btn bg-purple-800 hover:bg-purple-700 border-purple-500 py-2 px-4 font-bold shrink-0" onclick="ismaelMakeCursed('armor')">兌換</button>
            </div>
            <div class="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-600 rounded p-3">
                <div class="text-sm text-slate-200 leading-relaxed">3 張 <span class="c-cursed">詛咒的 對武器施法的卷軸</span> → 1 張 <span class="text-amber-300 font-bold">祝福的 對武器施法的卷軸</span><br><span class="text-xs text-slate-400">持有：${swc} 張（無次數限制）</span></div>
                <button class="btn bg-blue-700 hover:bg-blue-600 border-blue-500 py-2 px-4 font-bold shrink-0" onclick="ismaelCursedExchange('weapon')">兌換</button>
            </div>
            <div class="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-600 rounded p-3">
                <div class="text-sm text-slate-200 leading-relaxed">3 張 <span class="c-cursed">詛咒的 對盔甲施法的卷軸</span> → 1 張 <span class="text-amber-300 font-bold">祝福的 對盔甲施法的卷軸</span><br><span class="text-xs text-slate-400">持有：${sac} 張（無次數限制）</span></div>
                <button class="btn bg-blue-700 hover:bg-blue-600 border-blue-500 py-2 px-4 font-bold shrink-0" onclick="ismaelCursedExchange('armor')">兌換</button>
            </div>
            <div class="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-600 rounded p-3">
                <div class="text-sm text-slate-200 leading-relaxed">1,000,000 金幣 → 1 張 <span class="text-sky-300 font-bold">對飾品施法的卷軸</span><br><span class="text-xs text-slate-400">每次攻城獲勝可購買 1 張 ${accTxt}</span></div>
                <button class="btn ${!accOk ? 'bg-slate-600 border-slate-500 opacity-60 cursor-not-allowed' : 'bg-yellow-700 hover:bg-yellow-600 border-yellow-500'} py-2 px-4 font-bold shrink-0" ${!accOk ? 'disabled' : ''} onclick="ismaelBuyAcc()">購買</button>
            </div>
        </div>`;
}
function ismaelExchange(kind) {
    let id = kind === 'weapon' ? 'scroll_weapon' : 'scroll_armor';
    let outId = kind === 'weapon' ? 'scroll_weapon_b' : 'scroll_armor_b';
    let nm = kind === 'weapon' ? '對武器施法的卷軸' : '對盔甲施法的卷軸';
    if (invCountId(id) < 100) { alert(`${nm} 不足 100 張（背包＋倉庫共 ${invCountId(id)} 張）。`); return; }
    consumeMaterialById(id, 100);   // 🔧 背包優先、不足自動扣倉庫
    gainItem(outId, 1, true, true);
    renderTabs();
    logSys(`以 100 張 ${nm} 兌換了 1 張 <span class="text-amber-300 font-bold">祝福的 ${nm}</span>。`);
    updateUI();
    let el = document.getElementById('interaction-content'); if (el) renderIsmaelExchange(el);
}
// 🏝️ 伊賽馬利：100 張 一般施法卷軸 → 1 張 詛咒的 施法卷軸（無次數限制）
function ismaelMakeCursed(kind) {
    let id = kind === 'weapon' ? 'scroll_weapon' : 'scroll_armor';
    let outId = kind === 'weapon' ? 'scroll_weapon_c' : 'scroll_armor_c';
    let nm = kind === 'weapon' ? '對武器施法的卷軸' : '對盔甲施法的卷軸';
    if (invCountId(id) < 100) { alert(`${nm} 不足 100 張（背包＋倉庫共 ${invCountId(id)} 張）。`); return; }
    consumeMaterialById(id, 100);   // 🔧 背包優先、不足自動扣倉庫
    gainItem(outId, 1, true, true);
    renderTabs();
    logSys(`以 100 張 ${nm} 兌換了 1 張 <span class="c-cursed">詛咒的 ${nm}</span>。`);
    updateUI();
    let el = document.getElementById('interaction-content'); if (el) renderIsmaelExchange(el);
}
// 伊賽馬利：3 張 詛咒的 施法卷軸 → 1 張 祝福的 施法卷軸（無次數限制）
function ismaelCursedExchange(kind) {
    let id = kind === 'weapon' ? 'scroll_weapon_c' : 'scroll_armor_c';
    let outId = kind === 'weapon' ? 'scroll_weapon_b' : 'scroll_armor_b';
    let nm = kind === 'weapon' ? '對武器施法的卷軸' : '對盔甲施法的卷軸';
    if (invCountId(id) < 3) { alert(`詛咒的 ${nm} 不足 3 張（背包＋倉庫共 ${invCountId(id)} 張）。`); return; }
    consumeMaterialById(id, 3);   // 🔧 背包優先、不足自動扣倉庫
    gainItem(outId, 1, true, true);
    renderTabs();
    logSys(`以 3 張 <span class="c-cursed">詛咒的 ${nm}</span> 兌換了 1 張 <span class="text-amber-300 font-bold">祝福的 ${nm}</span>。`);
    updateUI();
    let el = document.getElementById('interaction-content'); if (el) renderIsmaelExchange(el);
}
// ===== 克里斯特：施法卷軸 + 金幣 → 賦予祝福卷軸 =====
function kristaExchange(kind) {
    if (kind === 'uncurse') {
        let UNCURSE_GOLD = 1000000;   // 🔧 兌換條件新增 100 萬金幣
        if ((player.gold || 0) < UNCURSE_GOLD) { logSys(`<span class="text-red-400">金幣不足（需 ${UNCURSE_GOLD.toLocaleString()}）。</span>`); return; }
        if (pledgeCountItem('scroll_weapon_b') < 1 || pledgeCountItem('scroll_armor_b') < 1) {
            logSys(`<span class="text-red-400">需要 1 張 祝福的 對武器施法的卷軸 與 1 張 祝福的 對盔甲施法的卷軸。</span>`); return;
        }
        player.gold -= UNCURSE_GOLD;
        let leftW = 1, leftA = 1;
        for (let it of player.inv) {
            if (it.id === 'scroll_weapon_b' && leftW > 0) { let t = Math.min(it.cnt, leftW); it.cnt -= t; leftW -= t; }
            if (it.id === 'scroll_armor_b'  && leftA > 0) { let t = Math.min(it.cnt, leftA); it.cnt -= t; leftA -= t; }
        }
        player.inv = player.inv.filter(it => it.cnt > 0);
        gainItem('new_item_uncurse', 1, true, true);
        renderTabs(); updateUI(); saveGame();
        logSys(`花費 ${UNCURSE_GOLD.toLocaleString()} 金幣 ＋ 1 張 祝福的 對武器施法的卷軸 ＋ 1 張 祝福的 對盔甲施法的卷軸，換得 1 張 <span class="text-cyan-200 font-bold">解除詛咒的卷軸</span>。`);
        let _eu = document.getElementById('interaction-content'); if (_eu) renderKristaExchange(_eu);
        return;
    }
    let cfg = {
        wpn: { scroll: 'scroll_weapon', need: 100, out: 'new_item_bless_wpn', nm: '對武器施法的卷軸', outNm: '賦予武器祝福卷軸' },
        arm: { scroll: 'scroll_armor',  need: 100, out: 'new_item_bless_arm', nm: '對盔甲施法的卷軸', outNm: '賦予盔甲祝福卷軸' },
        acc: { scroll: 'scroll_acc',    need: 5,   out: 'new_item_bless_acc', nm: '對飾品施法的卷軸', outNm: '賦予飾品祝福卷軸' },
    }[kind];
    if (!cfg) return;
    let GOLD = 1000000;
    if ((player.gold || 0) < GOLD) { logSys(`<span class="text-red-400">金幣不足（需 ${GOLD.toLocaleString()}）。</span>`); return; }
    if (pledgeCountItem(cfg.scroll) < cfg.need) { logSys(`<span class="text-red-400">${cfg.nm} 不足 ${cfg.need} 張（目前 ${pledgeCountItem(cfg.scroll)} 張）。</span>`); return; }
    player.gold -= GOLD;
    let left = cfg.need;
    for (let it of player.inv) { if (it.id === cfg.scroll && left > 0) { let take = Math.min(it.cnt, left); it.cnt -= take; left -= take; } }
    player.inv = player.inv.filter(it => it.cnt > 0);
    gainItem(cfg.out, 1, true, true);
    renderTabs(); updateUI(); saveGame();
    logSys(`花費 ${GOLD.toLocaleString()} 金幣與 ${cfg.need} 張 ${cfg.nm}，換得 1 張 <span class="text-purple-300 font-bold">${cfg.outNm}</span>。`);
    let _e = document.getElementById('interaction-content'); if (_e) renderKristaExchange(_e);
}
function renderKristaExchange(el) {
    let row = (kind, scroll, need, nm, outNm) => `
        <div class="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-600 rounded p-3">
            <div class="text-sm text-slate-200 leading-relaxed">100 萬金幣 ＋ ${need} 張 <span class="text-sky-300">${nm}</span> → 1 張 <span class="text-purple-300 font-bold">${outNm}</span><br><span class="text-xs text-slate-400">持有：${pledgeCountItem(scroll)} 張</span></div>
            <button class="btn bg-purple-800 hover:bg-purple-700 border-purple-500 py-2 px-4 font-bold shrink-0" onclick="kristaExchange('${kind}')">兌換</button>
        </div>`;
    el.innerHTML = `
        <div class="flex flex-col gap-3 p-1">
            <div class="text-slate-300 text-sm leading-relaxed">克里斯特：把施法卷軸與金幣交給我，我能煉成『賦予祝福卷軸』。</div>
            <div class="text-sm">你的金幣：<span class="text-yellow-400 font-bold">${(player.gold||0).toLocaleString()}</span></div>
            ${row('wpn','scroll_weapon',100,'對武器施法的卷軸','賦予武器祝福卷軸')}
            ${row('arm','scroll_armor',100,'對盔甲施法的卷軸','賦予盔甲祝福卷軸')}
            ${row('acc','scroll_acc',5,'對飾品施法的卷軸','賦予飾品祝福卷軸')}
            <div class="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-600 rounded p-3">
                <div class="text-sm text-slate-200 leading-relaxed">100 萬金幣 ＋ 1 張 <span class="text-yellow-300">祝福的 對武器施法的卷軸</span> ＋ 1 張 <span class="text-yellow-300">祝福的 對盔甲施法的卷軸</span> → 1 張 <span class="text-cyan-200 font-bold">解除詛咒的卷軸</span><br><span class="text-xs text-slate-400">持有：${pledgeCountItem('scroll_weapon_b')} / ${pledgeCountItem('scroll_armor_b')} 張</span></div>
                <button class="btn bg-purple-800 hover:bg-purple-700 border-purple-500 py-2 px-4 font-bold shrink-0" onclick="kristaExchange('uncurse')">兌換</button>
            </div>
        </div>`;
}
// ===== 碧恩：用賦予祝福卷軸為裝備隨機改變一個詞綴（屬性/遠古系/祝福，平均抽一） =====
function doBianBless(slotKey) {
    let item = player.eq[slotKey];
    if (!item) { logSys('該欄位沒有裝備。'); return; }
    if (item.bless === 'cursed') { logSys('<span class="text-red-400 font-bold">被詛咒的裝備無法施加祝福，請先解除詛咒。</span>'); return; }   // 🔧 詛咒裝備不可祝福
    let isAcc = (slotKey === 'ring1' || slotKey === 'ring2' || slotKey === 'ring3' || slotKey === 'ring4' || slotKey === 'amulet' || slotKey === 'belt');
    let scrollId = (slotKey === 'wpn' || slotKey === 'offwpn') ? 'new_item_bless_wpn' : (isAcc ? 'new_item_bless_acc' : 'new_item_bless_arm');   // ⚔️ 副手武器(offwpn)同主武器，使用「賦予武器祝福卷軸」
    let scrollNm = { 'new_item_bless_wpn':'賦予武器祝福卷軸', 'new_item_bless_arm':'賦予盔甲祝福卷軸', 'new_item_bless_acc':'賦予飾品祝福卷軸' }[scrollId];
    let sc = player.inv.find(i => i.id === scrollId);
    if (!sc || sc.cnt < 1) { logSys(`<span class="text-red-400">缺少 ${scrollNm}。</span>`); return; }
    sc.cnt--; if (sc.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== sc.uid);
    let pick = Math.floor(Math.random() * 3);
    let msg = '';
    if (pick === 2) {
        let rolled = (Math.random() < 0.5) ? true : 'cursed';   // 祝福的 / 詛咒的 各半
        let curB = item.bless || false;
        let curN = (curB === true) ? 'blessed' : (curB || false);
        let rolN = (rolled === true) ? 'blessed' : rolled;
        if (!curB) { item.bless = rolled; msg = `附加了 <span class="${blessColorClass(rolled)}">${blessName(rolled)}</span>`; }
        else if (curN === rolN) { let oc = blessColorClass(curB), on = blessName(curB); item.bless = false; msg = `<span class="${oc}">${on}</span> 消失了`; }
        else { let oc = blessColorClass(curB), on = blessName(curB); item.bless = rolled; msg = `<span class="${oc}">${on}</span> 被 <span class="${blessColorClass(rolled)}">${blessName(rolled)}</span> 取代`; }
    } else if (pick === 1) {
        let variants = [true, 'eternal', 'immortal', 'primordial'];
        let rolled = variants[Math.floor(Math.random() * 4)];
        let curN = (item.anc === true) ? 'ancient' : (item.anc || false);
        let rolN = (rolled === true) ? 'ancient' : rolled;
        if (!item.anc) { item.anc = rolled; msg = `附加了 <span class="${ancColorClass(rolled)}">${ancName(rolled)}</span>`; }
        else if (curN === rolN) { let old = ancName(item.anc), oc = ancColorClass(item.anc); item.anc = false; msg = `<span class="${oc}">${old}</span> 消失了`; }
        else { let old = ancName(item.anc), oc = ancColorClass(item.anc); item.anc = rolled; msg = `<span class="${oc}">${old}</span> 被 <span class="${ancColorClass(rolled)}">${ancName(rolled)}</span> 取代`; }
    } else {
        let rolled = rollAttrAffix();
        if (!getAttrAffix(item.attr)) { item.attr = rolled; msg = `附加了屬性詞綴`; }
        else if (item.attr === rolled) { item.attr = false; msg = `屬性詞綴 消失了`; }
        else { item.attr = rolled; msg = `屬性詞綴被取代`; }
    }
    if (DB.items[item.id] && DB.items[item.id].grantSkills) renderSkillSelects();
    calcStats(); updateUI(); renderTabs(true); saveGame();
    logSys(`碧恩為你的裝備施加祝福 → ${getItemFullName(item)}（${msg}）。`);
    let _e = document.getElementById('interaction-content'); if (_e) renderBianBless(_e);
}
function doBianUncurse(slotKey) {
    let item = player.eq[slotKey];
    if (!item) { logSys('該欄位沒有裝備。'); return; }
    if (item.bless !== 'cursed') { logSys('該裝備沒有詛咒。'); return; }
    let sc = player.inv.find(i => i.id === 'new_item_uncurse');
    if (!sc || sc.cnt < 1) { logSys(`<span class="text-red-400">缺少 解除詛咒的卷軸。</span>`); return; }
    sc.cnt--; if (sc.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== sc.uid);
    item.bless = false;   // 移除詛咒：變成沒有祝福也沒有詛咒（不影響屬性 / 遠古系）
    calcStats(); updateUI(); renderTabs(true); saveGame();
    logSys(`碧恩為你的裝備解除了詛咒 → ${getItemFullName(item)}。`);
    let _e = document.getElementById('interaction-content'); if (_e) renderBianBless(_e);
}
function renderBianBless(el) {
    let slots = [{k:'wpn',n:'武器'},{k:'shield',n:'副手'},{k:'helm',n:'頭盔'},{k:'armor',n:'盔甲'},{k:'tshirt',n:'T恤'},{k:'cloak',n:'斗篷'},{k:'gloves',n:'手套'},{k:'boots',n:'長靴'},{k:'amulet',n:'項鍊'},{k:'ring1',n:'戒指'},{k:'ring2',n:'戒指'},{k:'ring3',n:'戒指'},{k:'ring4',n:'戒指'},{k:'belt',n:'腰帶'}];   // 🦴 寵物裝備不支援祝福，故不列入
    if (player.eq && player.eq.offwpn) slots.splice(1, 0, {k:'offwpn',n:'副手武器'});   // ⚔️ 迅猛雙斧副手武器：裝備時才顯示，插在主武器後（用「賦予武器祝福卷軸」祝福）
    let cnt = id => pledgeCountItem(id);
    let rows = slots.map(sl => {
        let it = player.eq[sl.k];
        let name = it ? getItemFullName(it) : '<span class="text-slate-500">（未裝備）</span>';
        let _cursed = !!(it && it.bless === 'cursed');
        let _uncurse = _cursed ? `<button class="btn py-1 px-2 text-sm font-bold shrink-0 bg-cyan-800 border-cyan-500 text-cyan-100" onclick="doBianUncurse('${sl.k}')">解除詛咒</button>` : '';
        // 🔧 詛咒裝備：祝福按鈕變灰禁用
        let _blessBtn = (it && !_cursed)
            ? `<button class="btn py-1 px-2 text-sm font-bold w-24 text-center bg-purple-800 border-purple-500 text-purple-100" onclick="doBianBless('${sl.k}')">祝福${sl.n}</button>`
            : `<button class="btn py-1 px-2 text-sm font-bold w-24 text-center bg-slate-700 border-slate-600 text-slate-400 cursor-not-allowed" disabled title="${_cursed ? '被詛咒的裝備需先解除詛咒' : ''}">${_cursed ? '🔒 詛咒中' : '祝福'+sl.n}</button>`;
        return `<div class="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-600 rounded p-2 text-sm">
            <span class="truncate"><b class="text-amber-300">${sl.n}</b>：${name}</span>
            <div class="flex items-center gap-1 shrink-0">${_uncurse}${_blessBtn}</div>
        </div>`;
    }).join('');
    el.innerHTML = `
        <div class="flex flex-col gap-2 p-1">
            <div class="text-slate-300 text-sm leading-relaxed">碧恩：我能為你的裝備灌注力量。每次祝福會在「屬性 / 遠古系 / 祝福」三者中平均抽一個詞綴，隨機<b>附加、取代或消除</b>（只影響該詞綴）。</div>
            <div class="text-xs text-slate-400">武器用 賦予武器祝福卷軸(持有 ${cnt('new_item_bless_wpn')})；防具用 賦予盔甲祝福卷軸(持有 ${cnt('new_item_bless_arm')})；飾品用 賦予飾品祝福卷軸(持有 ${cnt('new_item_bless_acc')})。含詛咒的裝備可用 解除詛咒的卷軸(持有 ${cnt('new_item_uncurse')}) 移除詛咒。</div>
            ${rows}
        </div>`;
}
function ismaelBuyAcc() {
    if (traditionalActive()) { alert('🏛️ 傳統模式無法購買施法卷軸。'); return; }   // 🏛️ 縱深防護（伊賽馬利在傳統模式已隱藏，正常情況不可達）
    if (!ismaelAccAvailable()) { alert('本次購買額度已用完，攻城獲勝後可再購買 1 張。'); return; }
    if (player.gold < 1000000) { alert(`金幣不足（需 1,000,000，目前 ${player.gold.toLocaleString()}）。`); return; }
    player.gold -= 1000000;
    gainItem('scroll_acc', 1, true, true);
    player.ismaelAccUsed = true;   // 🔧 次數制：本額度用畢，攻城獲勝時重置
    saveGame();   // 高價購買立即存檔
    logSys('花費 1,000,000 金幣購買了 1 張 <span class="text-sky-300 font-bold">對飾品施法的卷軸</span>。（攻城獲勝後可再次購買）');
    updateUI();
    let el = document.getElementById('interaction-content'); if (el) renderIsmaelExchange(el);
}
function claimSiegeReward(faction) {
    let s = player.siege;
    if (!s || !s.rewardPending) { alert('目前沒有可領取的攻城戰獎勵。'); return; }
    let per = (s.result === 'win') ? 5000 : 2000;
    let gold = per * (s.kills || 0);
    player.gold += gold;
    s.rewardPending = false;
    logSys(`🏆 攻城${s.result === 'win' ? '獲勝' : '失敗'}領賞：本次擊殺血盟／攻城敵人 ${s.kills || 0} 名，獲得 <span class="text-yellow-400 font-bold">${gold}</span> 金幣！`);
    updateUI();
}

function changeMap(force) {
    // 行動限制狀態（石化／麻痺／冰凍／暈眩）時無法主動切換地圖；force=true 供復活、載入等內部流程略過
    if (!force && player.statuses &&
        (player.statuses.stone > 0 || player.statuses.paralyze > 0 || player.statuses.freeze > 0 || player.statuses.stun > 0 || player.statuses.sleep > 0)) {
        syncMapSelectors();   // 還原「分類選單 + 地圖選單」為目前所在地圖
        logSys('你目前無法行動（石化／麻痺／冰凍／暈眩），無法切換地圖。');
        return;
    }
    saveSiegeBossHp();   // 切換地圖前，保存攻城塔/門的剩餘血量
    // 🔥 進入閘門前的權限總驗證（業務邏輯層，非僅 UI 下拉禁用）：任何被 mapOptDisabled 擋下的地圖（如未完成試煉的魔族神殿、炎魔友好度不足的炎魔謁見所、潔尼斯門檻、傳送符不足的傲慢之塔）一律不可進入。
    //    僅在「主動切換到不同地圖」時檢查（force 內部流程／原地不動除外）；以「尚未消耗鑰匙/傳送符」的原始狀態判定，故下方各自的鑰匙/卷軸消耗不受影響（持有者此處 mapOptDisabled=false 會放行）。siege/castle 動態地圖不在 MAP_CATEGORIES，_def 為 null 自動略過。
    {
        let _tgt = document.getElementById('map-select').value;
        if (!force && _tgt && _tgt !== mapState.current) {
            let _def = null;
            for (let _cat in MAP_CATEGORIES) { let _e = (MAP_CATEGORIES[_cat] || []).find(m => m.v === _tgt); if (_e) { _def = _e; break; } }
            if (_def && mapOptDisabled(_def)) { syncMapSelectors(); logSys('<span class="text-red-400">尚未滿足進入條件，無法前往該地點。</span>'); return; }
        }
    }
    // 🔑 需鑰匙地圖（如魔獸軍王之室）：實際進入時消耗 1 把鑰匙；缺鑰匙則擋下並還原選單
    {
        let _prev = mapState.current, _tgt = document.getElementById('map-select').value;
        let _need = null;
        for (let _cat in MAP_CATEGORIES) { let _e = (MAP_CATEGORIES[_cat] || []).find(m => m.v === _tgt); if (_e) { _need = _e.needKey; break; } }
        if (!force && _need && _tgt !== _prev) {
            let _ki = player.inv.findIndex(i => i.id === _need && (i.cnt || 1) >= 1);
            if (_ki < 0) { syncMapSelectors(); logSys('<span class="text-red-400">沒有 軍王的鑰匙，無法進入。</span>'); return; }
            let _kit = player.inv[_ki];
            if ((_kit.cnt || 1) > 1) _kit.cnt -= 1; else player.inv.splice(_ki, 1);
            logSys(`<span class="text-amber-300">你消耗了 1 把 ${DB.items[_need] ? DB.items[_need].n : '鑰匙'}，開啟了大門。</span>`);
            renderTabs(true); saveGame();
        }
    }
    // 🗼 傲慢之塔：攀登/排名中主動切換地圖（含回村）→ 結束攀登（排名先依目前樓層結算）；樓層區間進入閘門
    {
        let _tgt = document.getElementById('map-select').value;
        if (!force && state.prideClimb && _tgt !== mapState.current) {
            if (state.prideRanked) prideRecord(state.prideFloor || 2);
            state.prideClimb = false; state.prideRanked = false; state.prideFloor = 0;
        }
        if (!force && state.riftRun && _tgt !== mapState.current) riftEndRun();   // 🌀 主動切換地圖離開裂痕：結算停留時間＋產生待領獎勵
        if (!force && state.oblivion && _tgt !== mapState.current) { state.oblivion = null; state._oblivionAdvance = false; }   // 🏝️ 主動切換地圖即結束遺忘之島旅程
        if (!force && /^pride_\d+_\d+$/.test(_tgt) && _tgt !== mapState.current) {
            let _tier = parseInt(_tgt.match(/^pride_(\d+)_/)[1]);
            if (_tier >= 11) {
                if (!DB.maps[_tgt]) { syncMapSelectors(); logSys('<span class="text-amber-300">傲慢之塔 ' + _tier + '~' + (_tier + 9) + ' 樓尚未開放，敬請期待後續更新。</span>'); return; }
                if (!prideHasTalisman(_tier, ['pass', 'dom'])) {   // 無傳送符/支配符、僅有移動卷軸 → 消耗一張
                    let _si = player.inv.findIndex(i => { let d = DB.items[i.id]; return d && d.prideKind === 'scroll' && d.prideTier === _tier && (i.cnt || 1) >= 1; });
                    if (_si < 0) { syncMapSelectors(); logSys('<span class="text-red-400">沒有對應的傲慢之塔傳送符／支配符／移動卷軸，無法進入。</span>'); return; }
                    let _sit = player.inv[_si];
                    if ((_sit.cnt || 1) > 1) _sit.cnt -= 1; else player.inv.splice(_si, 1);
                    logSys('<span class="text-sky-300">你消耗了 1 張 傲慢之塔移動卷軸(' + _tier + 'F)，進入了樓層。</span>');
                    renderTabs(true); saveGame();
                }
            }
        }
    }
    mapState.current = document.getElementById('map-select').value;
    if (!mapState.current.startsWith('town_')) player.lastBattleMap = mapState.current;   // 🔧 記住最後所在的戰鬥地圖，供村莊「出發」按鈕一鍵返回
    { let _c = mapRegionOf(mapState.current); if(_c) { if(!player.lastMapByCat) player.lastMapByCat = {}; player.lastMapByCat[_c] = mapState.current; } }   // 記住各「地區」分類最後到過的地圖（與下拉同鍵）
    mapState.mobs = [null, null, null, null, null];
    state._kbRespawnAt = null;    // 🔧 離開/進入任何地圖即取消軍王之室未完成的復活倒數（避免殘留狀態）
    state._kbVictory = false;     // 🏛️ 進入新地圖一併清除未結算的全滅旗標（避免雙BOSS祭壇殘留誤觸發）
    mapState.forceBoss = false;   // 🔧 傳送戒指的必出BOSS僅在施放傳送的當下有效：換地圖即失效，需再次手動施放傳送術
    if(typeof auditReset === 'function') auditReset();   // 換地圖：效率統計重置
    
    // 👇 取得包覆地圖與村莊的父層 Panel
    let mapPanel = document.getElementById('town-view').parentElement;
    
    if (mapState.current.startsWith('town_')) {
        document.getElementById('battle-view').classList.add('hidden');
        document.getElementById('combat-log-panel').classList.add('hidden');
        document.getElementById('town-view').classList.remove('hidden');
        document.getElementById('town-view').classList.add('flex');
        
        // 🎯 核心修復：進入村莊時，讓面板自動填滿剩下的空間，並限制高度讓內部產生捲軸
        mapPanel.classList.add('flex-1', 'overflow-hidden');
        
        // 設定村莊名稱
        let tData = DB.towns[mapState.current];
        let tName = tData ? tData.n : document.getElementById('map-select').options[document.getElementById('map-select').selectedIndex].text;
        document.getElementById('town-name').innerText = tName;
        
        // 瞬間恢復所有 HP 與 MP
        player.hp = player.mhp;
        player.mp = player.mmp;
        // 🏰 城堡護衛：回城/回村補滿血並解除力竭
        if (player.castleGuard) { let _cg = player.castleGuard; if (_cg.mode === 'heal') { _cg.mp = _cg.maxMp; _cg._healAcc = 0; } else { _cg.hp = _cg.maxHp; } _cg.disabled = false; _cg._regenAcc = 0; }
        // 協力角色：進村莊一併回滿 MP（與玩家一致）
        if (player.allies) player.allies.forEach(a => { if (a) a.mp = a.mmp; });
        // 進入村莊解除所有異常狀態（中毒/灼燒/燙傷/石化/麻痺/冰凍/暈眩/沉默/封印）
        player.statuses = { stun: 0, freeze: 0, stone: 0, poison: 0, poisonDmg: 0, poisonTick: 0, burn: 0, burnDmg: 0, burnTick: 0, scald: 0, scaldDmg: 0, scaldTick: 0, bleed: 0, bleedDmg: 0, bleedTick: 0, sleep: 0, silence: 0, paralyze: 0, magicseal: 0, armorBreak: 0, slowAtk: 0, cleave: 0 };   // 🔧 補齊 armorBreak/slowAtk/cleave，與初始定義一致
        updateUI();
        
        logSys(`--- 你來到了安全的 ${tName} ---`);
        
        // 關閉可能開啟著的互動面板，渲染 NPC 列表
        closeNpcInteraction();
        renderTownNPCs(mapState.current);
    } else {
        document.getElementById('battle-view').classList.remove('hidden');
        document.getElementById('combat-log-panel').classList.remove('hidden');
        document.getElementById('town-view').classList.add('hidden');
        document.getElementById('town-view').classList.remove('flex');
        
        // 🎯 核心修復：離開村莊回到戰鬥時，恢復原本的面板設定
        mapPanel.classList.remove('flex-1', 'overflow-hidden');
        
        // 進入新區域：依邏輯 tick 排程出怪（中央 50t=5秒、左側 70t=7秒、右側 90t=9秒）
        let t0 = state.ticks;
        mapState.spawnAt = [t0 + 70, t0 + 50, t0 + 90]; // [左0, 中1, 右2]
        mapState.suppressSiegeBoss = true;   // 初次進場：必定不出現肯特城門/守護塔
        // 🏛️ 雙BOSS祭壇：進場立即生成兩隻BOSS（之後不逐格補怪，兩隻皆亡才會在 15 秒後同時復活）
        if (KING_ROOMS[mapState.current] && KING_ROOMS[mapState.current].dual) {
            KING_ROOMS[mapState.current].bosses.forEach((bid, k) => spawnMob(k));
            mapState.spawnAt = [null, null, null, null, null];
        }
        logSys(`--- 你走向了新的區域 ---`);
        renderMobs();
    }
    syncMapSelectors();   // 切換完成後，同步分類選單與地圖選單為目前所在地圖
}

// ===== 🔮 席琳神殿：祈禱（席琳的世界 開關介面）=====
function toggleSherineWorld() {
    if ((player.lv || 1) < 40) { logSys('<span class="text-red-400">等級未達 40，席琳對你的祈禱沒有回應。</span>'); return; }
    player.sherineWorld = !player.sherineWorld;
    applySherineTheme();
    logSys(player.sherineWorld
        ? '<span class="c-sherine font-bold">【席琳的世界】已開啟。</span><span class="text-slate-400">漆黑的濃霧滲入大地……怪物變得更加兇猛，但報酬也更加豐厚。</span>'
        : '<span class="text-slate-300">【席琳的世界】已關閉，世界恢復了平靜。</span>');
    saveGame();
    renderMobs();
    let el = document.getElementById('interaction-content'); if (el) renderSherinePray(el);
}
function renderSherinePray(div) {
    let on = sherineWorldActive();
    let lvOk = (player.lv || 1) >= 40;
    div.innerHTML = `
        <div class="flex flex-col gap-3 p-1">
            <div class="text-slate-300 text-sm leading-relaxed">席琳：旅人啊……是否願意凝視這個世界的另一面？（需等級 40 以上，可自由開啟/關閉）</div>
            <div class="bg-slate-800/60 border ${on ? 'border-red-700' : 'border-slate-600'} rounded p-3 text-sm leading-relaxed">
                <div class="font-bold mb-1 ${on ? 'c-sherine' : 'text-slate-200'}">席琳的世界：目前 ${on ? '<span class="text-red-300">開啟</span>' : '<span class="text-slate-400">關閉</span>'}</div>
                <div class="text-slate-200">怪物獲得大幅的強化，戰鬥將更為艱難，但也能獲得更多報酬，還可能出現<span class="c-sherine font-bold">珍稀的套裝裝備</span>。</div>
            </div>
            <button class="btn py-3 text-lg font-bold ${!lvOk ? 'bg-slate-600 border-slate-500 opacity-60 cursor-not-allowed' : (on ? 'bg-slate-700 hover:bg-slate-600 border-slate-500' : 'bg-red-800 hover:bg-red-700 border-red-600')}"
                ${!lvOk ? 'disabled' : ''} onclick="toggleSherineWorld()">${!lvOk ? '等級不足（需 Lv40）' : (on ? '🙏 祈禱：關閉席琳的世界' : '🙏 祈禱：開啟席琳的世界')}</button>
        </div>`;
}

// ===== 🏅 威頓村 漢：職業精通任務 =====
function hanAcceptQuest() {
    if ((player.lv || 1) < 50) return;
    player.masteryQuest = 'active';
    let boss = MASTERY_DATA[player.cls].boss;
    logSys(`<span class="text-amber-300 font-bold">【精通任務】</span>漢：去吧，擊敗 <span class="text-red-300 font-bold">${boss}</span>，把「精通之證」帶回來給我。`);
    saveGame();
    let el = document.getElementById('interaction-content'); if (el) renderHanNPC(el);
}
function hanSubmitProof() {
    if (player.masteryQuest !== 'active') return;
    if (!player.inv.some(i => i.id === 'item_mastery_proof')) return;
    questConsumeId('item_mastery_proof', 1);
    player.masteryQuest = 'done';
    logSys('<span class="text-amber-300 font-bold">【精通任務】</span>漢：很好……你已證明了自己。現在，選擇你的「道」吧。');
    saveGame();
    updateUI();   // 職業名旁顯示精通標誌
    let el = document.getElementById('interaction-content'); if (el) renderHanNPC(el);
}
function chooseMastery(id) {
    if (player.masteryQuest !== 'done') return;
    let md = MASTERY_DATA[player.cls];
    if (!md || !md.list[id] || player.mastery === id) return;
    // 🔧 詛咒鎖定優先於精通切換：若離開劍術精通會使「被詛咒的騎士武器」失去裝備資格，
    //    但詛咒裝備無法卸下，故直接擋下切換（避免繞過詛咒鎖定強制卸裝）。
    if (player.mastery === 'e_sword' && id !== 'e_sword' && player.eq.wpn && isEquipCursed('wpn')) {
        let wd = DB.items[player.eq.wpn.id];
        let stillOk = reqAllowsClass(wd, player.cls) || loadUpAllows(player.eq.wpn.id);
        if (!stillOk) { logSys('<span class="text-red-400 font-bold">手中被詛咒的騎士武器無法卸下，無法切換精通！</span><span class="text-red-300">請先至象牙塔『碧恩』處解除詛咒。</span>'); return; }
    }
    // 初次選擇免費；之後每次更換固定 300 萬金幣＋10 張王族搜索狀（不隨次數遞增）
    if (player.mastery !== null) {
        let cost = masteryChangeCost();
        let w = pledgeCountItem('new_item_241');
        if (player.gold < cost.gold || w < cost.warrants) {
            logSys(`<span class="text-red-400 font-bold">更換精通需要 ${cost.gold.toLocaleString()} 金幣與 王族搜索狀 ×${cost.warrants}。</span>`);
            return;
        }
        // 更換前確認
        if (!confirm(`確定要將精通由「${md.list[player.mastery].n}」更換為「${md.list[id].n}」嗎？\n將消耗 ${cost.gold.toLocaleString()} 金幣與 王族搜索狀 ×${cost.warrants}。`)) return;
        player.gold -= cost.gold;
        let _need = cost.warrants;
        for (let it of player.inv.filter(i => i.id === 'new_item_241')) { if (_need <= 0) break; let dd = Math.min(it.cnt, _need); it.cnt -= dd; _need -= dd; }
        player.inv = player.inv.filter(i => i.cnt > 0);
        player.masteryChangeCnt = (player.masteryChangeCnt || 0) + 1;
    }
    let prev = player.mastery;
    player.mastery = id;
    // 🏅 切換副作用
    if (prev === 'e_spirit' && player.summon && (player.summon.skId === 'sk_elf_summon' || player.summon.skId === 'sk_elf_summon2')) {
        player.buffs[player.summon.skId] = 0; player.summon = null;   // 精靈精通解除：收回已召喚屬性精靈
        logSys('屬性精靈隨著精通的轉移而消散了。');
    }
    // 🐉 覺醒精通解除：離開覺醒精通後同時只能維持一種覺醒——清除多餘的覺醒增益（保留第一個生效者），
    //    否則先前同時開啟的三種覺醒會殘留到自然倒數結束（自動施放互斥只擋新施放、不會收回既有的）。
    if (id !== 'k_awaken' && player.buffs) {
        let _kept = false;
        ['sk_dragon_awaken_antares', 'sk_dragon_awaken_falion', 'sk_dragon_awaken_baraka'].forEach(_ak => {
            if ((player.buffs[_ak] || 0) > 0) { if (_kept) player.buffs[_ak] = 0; else _kept = true; }
        });
    }
    if (prev === 'e_sword' && player.eq.wpn) {
        let wd = DB.items[player.eq.wpn.id];
        let ok = reqAllowsClass(wd, player.cls) || loadUpAllows(player.eq.wpn.id);
        if (!ok) { returnEquipToInv('wpn'); logSys('失去劍術精通，無法再駕馭手中的騎士武器，已自動卸下。'); }
    }
    logSys(`<span class="text-amber-300 font-bold">【精通】</span>你領悟了 <span class="text-yellow-300 font-bold">${md.list[id].n}</span>——${md.list[id].msg}！`);
    calcStats();
    renderSkillSelects();   // 魔導精通：四項法術的可用性即時更新
    renderTabs(true);
    saveGame();
    let el = document.getElementById('interaction-content'); if (el) renderHanNPC(el);
}
function renderHanNPC(div) {
    let md = MASTERY_DATA[player.cls];
    if ((player.lv || 1) < 50) {
        div.innerHTML = `<div class="p-6 text-slate-400">漢瞇起眼打量著你……<br><span class="text-red-400">「還不夠。等你站上 50 級的高度，再來與我談『精通』二字。」</span></div>`;
        return;
    }
    let q = player.masteryQuest;
    if (!q) {   // 未接取
        div.innerHTML = `
        <div class="flex flex-col gap-4 p-2 items-center text-center">
            <div class="text-slate-300 leading-relaxed">${player.cls === 'dark' ? '漢：每個走到極致的黑暗妖精，都要回答同一個問題——<br><span class="text-amber-200 font-bold">你的「信念」是什麼</span>' : `漢：每個走到極限的${({knight:'騎士',mage:'法師',elf:'妖精',illusion:'幻術士',dragon:'龍騎士',warrior:'戰士',royal:'王族'})[player.cls]}，都要回答同一個問題——<br><span class="text-amber-200 font-bold">你的「道」是什麼？</span>`}</div>
            <div class="bg-slate-800/70 border border-amber-700/60 rounded p-3 text-sm text-slate-300">擊敗 <span class="text-red-300 font-bold">${md.boss}</span>，取回 <span class="text-blue-300 font-bold">精通之證</span>，我便為你開啟精通之路。</div>
            <button class="btn px-10 py-3 text-lg font-bold bg-amber-800 hover:bg-amber-700 border-amber-500" onclick="hanAcceptQuest()">🏅 接取精通任務</button>
        </div>`;
        return;
    }
    if (q === 'active') {
        let hasProof = player.inv.some(i => i.id === 'item_mastery_proof');
        div.innerHTML = `
        <div class="flex flex-col gap-4 p-2 items-center text-center">
            <div class="text-slate-300 leading-relaxed">漢：${hasProof ? '哦……你手中的氣息，是貨真價實的證明。' : `<span class="text-red-300 font-bold">${md.boss}</span> 還在等著你。把「精通之證」帶回來。`}</div>
            ${hasProof
                ? `<button class="btn px-10 py-3 text-lg font-bold bg-amber-800 hover:bg-amber-700 border-amber-500" onclick="hanSubmitProof()">🏅 交付 精通之證</button>`
                : `<div class="text-slate-500 text-sm">（接取任務後擊敗指定頭目必定獲得；身上已有一枚時不會重複掉落）</div>`}
        </div>`;
        return;
    }
    // q === 'done'：精通選擇（中央職業徽記 + 上下左右四色按鈕）
    let cur = player.mastery;
    let cost = masteryChangeCost();
    let costTxt = (cur === null)
        ? '<span class="text-emerald-300 font-bold">初次選擇免費</span>'
        : `更換費用：<span class="text-yellow-300 font-bold">${cost.gold.toLocaleString()} 金幣</span>＋<span class="text-amber-300 font-bold">王族搜索狀 ×${cost.warrants}</span>（固定費用）`;
    let btn = (id) => {
        let m = md.list[id];
        let active = cur === id;
        return `<button class="btn w-full h-full py-3 px-2 border-2 ${MASTERY_POS_STYLE[m.pos]} ${active ? 'ring-2 ring-yellow-300 shadow-[0_0_14px_rgba(253,224,71,0.6)]' : ''}" onclick="chooseMastery('${id}')" title="${m.d}">
            <div class="font-bold text-base ${active ? 'text-yellow-300' : 'text-white'}">${active ? '★ ' : ''}${m.n}</div>
            <div class="text-[11px] text-slate-300 leading-tight mt-1">${m.msg}</div>
        </button>`;
    };
    let ids = Object.keys(md.list);
    let byPos = {}; ids.forEach(k => byPos[md.list[k].pos] = k);
    div.innerHTML = `
    <div class="flex flex-col gap-3 p-2 items-center">
        <div class="text-amber-200 font-bold text-lg tracking-widest">—— 精 通 之 道 ——</div>
        <div class="text-slate-400 text-xs">${costTxt}</div>
        <div class="grid gap-2 w-full max-w-[560px]" style="grid-template-columns: 1fr 1fr 1fr; grid-template-rows: repeat(3, 96px);">
            <div></div><div class="h-full">${btn(byPos.top)}</div><div></div>
            <div class="h-full">${btn(byPos.left)}</div>
            <div class="flex items-center justify-center bg-slate-900/80 border-2 border-amber-600/70 rounded shadow-[0_0_18px_rgba(245,158,11,0.35)] h-full">
                <img src="${md.logo}" class="w-3/5 h-3/5 object-contain" onerror="this.outerHTML='<span class=\\'text-4xl\\'>🏅</span>'">
            </div>
            <div class="h-full">${btn(byPos.right)}</div>
            <div></div><div class="h-full">${btn(byPos.bottom)}</div><div></div>
        </div>
        ${cur ? `<div class="text-sm text-slate-300">目前精通：<span class="text-yellow-300 font-bold">${md.list[cur].n}</span></div>` : ''}
        <div class="text-slate-500 text-xs">將滑鼠移至按鈕可查看完整效果說明。</div>
    </div>`;
}

function renderTownNPCs(townId) {
    let container = document.getElementById('town-npc-container');
    container.innerHTML = '';
    
    let townData = DB.towns[townId];
    if (!townData || !townData.npcs) return;

    townData.npcs.forEach(npc => {
        // 城堡血盟NPC：只顯示玩家所屬陣營（依詩蒂陣營→依詩蒂；特羅斯陣營→特羅斯）
        if (townId === 'town_kent_castle' || townId === 'town_windwood_castle') {
            if (npc.id === 'npc_esti' && player.bloodPledge !== 'esti') return;
            if (npc.id === 'npc_tros' && player.bloodPledge !== 'tros') return;
        }
        if (npc.darkOnly && player.cls !== 'dark') return;   // 🔧 黑暗妖精限定試煉：其他職業看不到
        if (npc.classicHide && player.classicMode) return;   // 🔥 經典模式：隱藏克里斯特/碧恩/漢（無法賦予祝福與精通）
        if (npc.traditionalHide && player.traditionalMode) return;   // 🏛️ 傳統模式：隱藏肯特城兌換 NPC（伊賽馬利）
        let el = document.createElement('div');
        el.className = 'bg-slate-800 border border-slate-600 rounded-lg p-3 hover:bg-slate-700 transition-colors cursor-pointer flex flex-col justify-between';
        
        let typeIcon = "👤";
        if(npc.type === 'shop') typeIcon = "💰";
        else if(npc.type === 'craft') typeIcon = "⚒️";
        else if(npc.type === 'skill') typeIcon = "📖";
        else if(npc.type === 'exchange') typeIcon = "⚖️";
        else if(npc.type === 'quest') typeIcon = "📜";
        else if(npc.type === 'pledge') typeIcon = "⚔️";
        else if(npc.type === 'ally') typeIcon = "🤝";
        else if(npc.type === 'bless') typeIcon = "✨";
        else if(npc.type === 'pray') typeIcon = "🙏";
        else if(npc.type === 'mastery') typeIcon = "🏅";
        else if(npc.type === 'castleguard') typeIcon = "🛡️";
        else if(npc.type === 'petstore') typeIcon = "🐾";
        else if(npc.type === 'travel') typeIcon = "⛵";

        el.innerHTML = `
            <div class="flex items-start justify-between mb-2">
                <div class="flex flex-col">
                    <span class="text-white font-bold text-lg leading-none">${npc.n}</span>
                    <span class="text-yellow-500 text-sm mt-1">[${npc.title}]</span>
                </div>
                <span class="text-2xl">${typeIcon}</span>
            </div>
            <p class="text-slate-400 text-sm mt-auto leading-snug">${npc.d}</p>
        `;
        el.onclick = () => interactNPC(npc.id, townId);
        container.appendChild(el);
    });
    // 🗼 傲慢之塔入口：NPC 之下顯示「進入傲慢之塔 / 挑戰排名模式」較大按鈕與紀錄
    if (townId === 'town_pride') renderPrideEntrance(container);
    if (townId === 'town_rift') renderRiftEntrance(container);   // 🌀 時空裂痕入口：進入/領獎按鈕＋時間排名
}

// 🗼 傲慢之塔入口：攀登與排名模式的大按鈕＋紀錄面板
function fmtPrideTime(ms) {
    if (!ms && ms !== 0) return '--:--:--';
    let s = Math.floor(ms / 1000);
    let h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    let p = n => (n < 10 ? '0' : '') + n;
    return `${p(h)}:${p(m)}:${p(sec)}`;
}
function renderPrideEntrance(container) {
    // 一般 / 席琳的世界 兩種排名各自獨立顯示；席琳的紀錄以綠色呈現
    let rankBlock = (r, sherine) => {
        r = r || { best: null, last: null, isNew: false };
        let lastTxt = r.last ? `第 ${r.last.floor} 樓，花費時間 ${fmtPrideTime(r.last.ms)}` : '尚無紀錄';
        let bestTxt = r.best ? `第 ${r.best.floor} 樓，花費時間 ${fmtPrideTime(r.best.ms)}` : '尚無紀錄';
        let newBadge = (r.isNew && r.best) ? ' <span class="text-yellow-300 font-bold animate-pulse">new</span>' : '';
        let titleCls = sherine ? 'c-sherine' : 'text-amber-300';
        let bodyCls = sherine ? 'text-green-300' : 'text-slate-200';
        let title = sherine ? '排名紀錄（席琳的世界）' : '排名紀錄（一般）';
        return `<div class="bg-slate-900/70 border ${sherine ? 'border-green-700/60' : 'border-slate-700'} rounded-lg p-3 text-sm leading-relaxed">
            <div class="${titleCls} font-bold mb-1">${title}</div>
            <div class="${bodyCls}">本次紀錄　${lastTxt}</div>
            <div class="${bodyCls}">最高紀錄　${bestTxt}${newBadge}</div>
        </div>`;
    };
    let box = document.createElement('div');
    box.className = 'w-full mt-2 flex flex-col gap-3';
    box.innerHTML = `
        <button onclick="startPrideClimb(false)" class="btn w-full py-4 text-xl font-bold bg-rose-800 hover:bg-rose-700 border border-rose-500 text-white shadow-lg">🗼 進入傲慢之塔</button>
        <button onclick="startPrideClimb(true)" class="btn w-full py-4 text-xl font-bold bg-amber-800 hover:bg-amber-700 border border-amber-500 text-white shadow-lg">🏆 挑戰排名模式</button>
        ${rankBlock(player.prideRank, false)}
        ${player.classicMode ? '' : rankBlock(player.prideRankSherine, true)}
        <div class="text-slate-500 text-xs">排名模式中即使持有支配符也無法使用傳送術與瞬間移動卷軸；回村或擊敗 100 層頭目時結算。${player.classicMode ? '' : '一般與席琳的世界的排名各自獨立計算。'}</div>`;
    container.appendChild(box);
}

function interactNPC(npcId, townId) {
    let npc = DB.towns[townId].npcs.find(n => n.id === npcId);
    if(!npc) return;
    if (npc.classicHide && player.classicMode) return;   // 🔥 經典模式：克里斯特/碧恩/漢 不可互動（縱深防護，正常情況卡片已不渲染）
    if (npc.traditionalHide && player.traditionalMode) return;   // 🏛️ 傳統模式：肯特城兌換 NPC（伊賽馬利）不可互動（縱深防護）
    _activePanel = null;   // 開啟新面板：先清除自動刷新標記，由對應 render 視需要重新設定

    document.getElementById('town-npc-container').classList.add('hidden');
    document.getElementById('town-interaction-container').classList.remove('hidden');
    document.getElementById('town-interaction-container').classList.add('flex');
    
    document.getElementById('interaction-npc-name').innerText = npc.n;
    document.getElementById('interaction-npc-title').innerText = `[${npc.title}]`;
    
    let contentDiv = document.getElementById('interaction-content');
    contentDiv.innerHTML = '';

    // 根據 NPC 的類型，載入不同的 UI
    if (npc.type === 'shop' || npc.id === 'npc_gilen') {
        renderTownShop(contentDiv, npc.id);  
    } else if (npc.id === 'npc_obel' || npc.id === 'npc_hert' || npc.id === 'npc_diren') {   // 🔧 赫特＝風木城、帝倫＝海音城的魔物追蹤（同奧貝勒）
        renderObelNPC(contentDiv);
    } else if (npc.id === 'npc_pandora') { 
        renderPandoraGacha(contentDiv);
    } else if (npc.id === 'npc_elion') {
        renderElionUI(contentDiv);
    } else if (npc.id === 'npc_moli' || npc.id === 'npc_ladal') { 
        renderMoliCraft(contentDiv);
    } else if (npc.id === 'npc_brabo') { 
        renderBraboCraft(contentDiv);
    } else if (npc.id === 'npc_finn' || npc.id === 'npc_falin') { 
        renderFinnCraft(contentDiv, npc.id);
    } else if (npc.id === 'npc_joel' || npc.id === 'npc_ryan') { 
        renderJoelCraft(contentDiv, npc.id);
    } else if (npc.id === 'npc_runde' || npc.id === 'npc_kang' || npc.id === 'npc_brudica') {   // 🔧 黑暗妖精限定試煉（仿瑞奇/甘特，而非製作）
        renderDarkTrial(contentDiv, npc.id);
    } else if (['npc_nalien', 'npc_rekne', 'npc_narupa', 'npc_elfqueen', 'npc_elf', 'npc_ent', 'npc_pan', 'npc_moliya', 'npc_hector', 'npc_herbert', 'npc_lumiel', 'npc_ibelbin', 'npc_tas', 'npc_robinson', 'npc_kupu', 'npc_lentis', 'npc_upni', 'npc_bamut', 'npc_flame_shadow', 'npc_imp', 'npc_flame_smith', 'npc_norse', 'npc_keluya', 'npc_dytite', 'npc_bartel', 'npc_pir', 'npc_zeus_golem', 'npc_rabiani', 'npc_david', 'npc_flame_aide', 'npc_kororanz', 'npc_sebas'].includes(npc.id)) {
        renderUniversalCraft(contentDiv, npc.id);
    } else if (npc.id === 'npc_digallatin') {
        renderDigallatin(contentDiv);
    } else if (npc.id === 'npc_os') {
        renderOsQuest(contentDiv);
    } else if (npc.id === 'npc_taras') { 
        renderTarasQuest(contentDiv);
    } else if (npc.id === 'npc_masha') { 
        renderMashaQuest(contentDiv);
    } else if (npc.id === 'npc_gunter') {
        renderGunterQuest(contentDiv);
    } else if (npc.id === 'npc_yuria') {
        renderYuriaQuest(contentDiv);
    } else if (npc.id === 'npc_shenien') {
        renderShenien(contentDiv);
    } else if (npc.id === 'npc_duwen') {
        renderDuwen(contentDiv);
    } else if (npc.id === 'npc_procel') {
        renderProcel(contentDiv);
    } else if (npc.id === 'npc_mother') {
        renderMotherQuest(contentDiv);
    } else if (npc.id === 'npc_ricky') {
        renderRickyQuest(contentDiv);
    } else if (npc.id === 'npc_red') {
        renderRedQuest(contentDiv);
    } else if (npc.id === 'npc_shimizhe') {
        renderShimizheExchange(contentDiv);
    // 👇 新增這個判斷區塊
    } else if (npc.id === 'npc_james') { 
        renderJamesQuest(contentDiv);
    } else if (npc.id === 'npc_esti') {
        renderPledgeNPC(contentDiv, 'esti');
    } else if (npc.id === 'npc_tros') {
        renderPledgeNPC(contentDiv, 'tros');
    } else if (npc.id === 'npc_krista') {
        renderKristaExchange(contentDiv);
    } else if (npc.id === 'npc_bian') {
        renderBianBless(contentDiv);
    } else if (npc.id === 'npc_ismael') {
        renderIsmaelExchange(contentDiv);
    } else if (npc.id === 'npc_sherine') {
        renderSherinePray(contentDiv);
    } else if (npc.id === 'npc_han') {
        renderHanNPC(contentDiv);
    } else if (npc.id === 'npc_kent_guard') {
        renderCastleGuard(contentDiv, 'kent');
    } else if (npc.id === 'npc_ww_guard') {
        renderCastleGuard(contentDiv, 'windwood');
    } else if (npc.id === 'npc_heine_guard') {
        renderCastleGuard(contentDiv, 'heine');
    } else if (npc.type === 'ally') {
        renderAllyNPC(contentDiv);
    } else if (npc.type === 'warehouse') {
        renderWarehouseNPC(contentDiv);
    } else if (npc.id === 'npc_baowu') {
        renderPetStorageNPC(contentDiv);
    } else if (npc.id === 'npc_isba') {
        renderIsbaTravel(contentDiv);
    } else {
        // 未來要擴充的 製作 / 交換 / 任務 預留版面
        contentDiv.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-slate-500 py-12">
                <span class="text-6xl mb-4">🚧</span>
                <span class="text-xl font-bold text-slate-400">系統建置中</span>
                <span class="text-sm mt-2">此 NPC 的 [${npc.title}] 功能將在後續版本開放。</span>
            </div>
        `;
    }
}

function closeNpcInteraction() {
    document.getElementById('town-interaction-container').classList.add('hidden');
    document.getElementById('town-interaction-container').classList.remove('flex');
    document.getElementById('town-npc-container').classList.remove('hidden');
}