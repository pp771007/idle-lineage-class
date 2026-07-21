// ===== 地圖分類選單（村莊／野外／地監／特殊） =====
const MAP_CATEGORIES = {
    village: [
        {v:'town_silver_knight',t:'銀騎士村'}, {v:'town_elf',t:'妖精森林'}, {v:'town_talking',t:'說話之島'},
        {v:'town_gludio',t:'燃柳村'}, {v:'town_gludin',t:'古魯丁村莊'}, {v:'town_giran',t:'奇岩'}, {v:'town_heine',t:'海音'},
        {v:'town_oren',t:'歐瑞村莊'}, {v:'town_aden',t:'亞丁',c:'#facc15'}, {v:'town_ivory_tower',t:'象牙塔'}, {v:'town_witon',t:'威頓村'},
        {v:'town_sherine',t:'席琳神殿',c:'#4ade80',classicHide:true}, {v:'town_silent',t:'沉默洞穴',c:'#a78bfa'}, {v:'town_hyperia',t:'希培利亞村莊',c:'#c084fc'}, {v:'town_behemoth',t:'貝希摩斯',c:'#f59e0b'}, {v:'town_flame_audience',t:'炎魔謁見所',c:'#ff6b35',questReq:'demonTemple',affinityReq:1000}, {v:'town_elder_council',t:'長老會議廳',c:'#a5b4fc'}
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
        // 🌑 黑暗妖精聖地／受詛咒聖地／崩壞的長老會議廳＝「無法從地圖選單選擇」（MD 設定·只能由 長老會議廳 NPC 真‧冥皇丹特斯 進入）→不列選單；安全區改 town_elder_council(village 群組)
        {v:'demon_temple',t:'魔族神殿',c:'#9b2c2c',questReq:'demonTemple'},
        {v:'shadow_temple',t:'暗影神殿',c:'#7c3aed',keyHoldReq:'item_shadow_temple_key',affinityReq:1000}
    ],
    special: [
        {v:'training',t:'新兵修練場'}, {v:'dream_island',t:'夢幻之島'},   // ⚔️ 決鬥競技場刻意不列選單：入口＝古魯丁村莊「鬥技場管理者 巴魯特」（js/28 pvpArenaEnter 臨時補 option 傳送）
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
        {v:'thebes_temple', t:'底比斯 歐西里斯祭壇', c:'#f87171', needKey:'item_thebes_altar_key'},
        {v:'tikal_area', t:'提卡爾神廟地區', c:'#86efac'},
        {v:'tikal_deep', t:'提卡爾神廟地區深處', c:'#86efac'},
        {v:'tikal_altar', t:'提卡爾 庫庫爾坎祭壇', c:'#f87171', needKey:'item_tikal_altar_key'},
        {v:'sunrise_castle', t:'日出之國城墎', c:'#fbbf24'},
        {v:'sunrise_east', t:'日出之國東之地', c:'#f9a8d4'},
        {v:'sunrise_west', t:'日出之國西之地', c:'#d6d3d1'},
        {v:'sunrise_north', t:'日出之國北之地', c:'#93c5fd'}
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
        {v:'town_gludin', t:'古魯丁村莊'}, {v:'gludio', t:'古魯丁周邊'},
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
        {v:'town_elder_council', t:'長老會議廳'},   // 🌑 三張聖地狩獵/BOSS圖不入選單（NPC 傳送進入）
        {v:'king_baranka_room', t:'魔獸君王之室'}, {v:'law_king_room', t:'法令君王之室'}, {v:'necro_king_room', t:'冥法君王之室'}, {v:'assassin_king_room', t:'暗殺君王之室'}
    ]},
    { key: 'rift', label: '時空裂痕', maps: [
        {v:'town_rift', t:'時空裂痕入口'}, {v:'thebes_desert', t:'底比斯 沙漠'}, {v:'thebes_pyramid', t:'底比斯 金字塔內部'}, {v:'thebes_temple', t:'底比斯 歐西里斯祭壇'},
        {v:'tikal_area', t:'提卡爾神廟地區'}, {v:'tikal_deep', t:'提卡爾神廟地區深處'}, {v:'tikal_altar', t:'提卡爾 庫庫爾坎祭壇'},
        {v:'sunrise_castle', t:'日出之國城墎'}, {v:'sunrise_east', t:'日出之國東之地'}, {v:'sunrise_west', t:'日出之國西之地'}, {v:'sunrise_north', t:'日出之國北之地'}
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
function victoryCityCfg() {
    let city = (typeof clanGetCastleCity === 'function') ? clanGetCastleCity(player) : null;
    return SIEGE_CITY[city] || SIEGE_CITY.kent;
}   // 血盟同模式共用的永久城堡
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
    if (!siegeVictoryActive()) return [];
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
// ===== 🖥️ 打包版自訂下拉選單（僅 pkg-build）=====
//   Electron 原生 <select> 彈出選單間距太擠且 padding/行高不可調。改法：保留原生 <select> 承載 value/狀態/onchange
//   與「關閉時顯示的選中值」(自動同步·零成本)，只攔截 mousedown 阻止原生彈出、改顯示自訂彈出層(.cdd-pop)。
//   作用於打包版「所有」單選 <select>（地圖／藥水／自動技能…全部一致）；網頁版(無 pkg-build)維持原生。
var _cddSel = null;
var _cddOpenTs = 0;
// 🔧 開啟後 300ms 內＝「開啟手勢冷卻窗」：忽略一切自動關閉/誤選來源（blur／resize／捲動出界／外部click／選項click）。
//   打包版 Electron 對原生 <select> 的焦點/blur 殘響，會在「mousedown 開啟」後緊接著噴一個 blur/click 把剛開的彈出層秒關
//   （瀏覽器版用合成事件測不出來，故僅打包版重現）。此窗只擋「剛開那一瞬間」的殘留事件，之後一切行為照常。
//   只有「再次點同一個 select」(mousedown 委派的 toggle·走 openCustomSelectPopup) 例外，仍可在窗內收合。
function _cddFresh() { return (Date.now() - _cddOpenTs) < 300; }
function _cddClose() {
    var p = document.getElementById('cdd-pop'); if (p) p.remove();
    _cddSel = null;
    document.removeEventListener('click', _cddOutside, true);
    document.removeEventListener('keydown', _cddKey, true);
    document.removeEventListener('scroll', _cddScroll, true);
}
function _cddOutside(e) {
    if (_cddFresh()) return;                                                // 🔧 開啟手勢殘留的 click（打包版可能 target 落在 body 而非 select）→ 冷卻窗內一律忽略
    var p = document.getElementById('cdd-pop'); if (!p) return;
    if (p.contains(e.target)) return;                                       // 點在彈出層內 → 由選項自己處理，不關
    if (_cddSel && (e.target === _cddSel || _cddSel.contains(e.target))) return;   // 🔧 點在觸發的 <select> 上 → 忽略（否則「開啟手勢」的 click 會立刻把剛開的選單關掉）；再次開合由 mousedown 委派的 toggle 處理
    _cddClose();
}
function _cddKey(e) { if (e.key === 'Escape') _cddClose(); }
// 🔧 捲動時「不關閉、改跟著觸發 <select> 重新定位」：戰鬥日誌/系統日誌持續自動捲動、
//    或倉庫面板自身(interaction-content=overflow-y-auto·是 select 的祖先)捲動，都不再誤關下拉，
//    彈出層只是黏著 select 移動。只有 select 被移除(面板重繪)或整個捲出畫面時才關閉。
function _cddPositionPop(pop, r) {
    pop.style.left = r.left + 'px'; pop.style.top = (r.bottom + 2) + 'px'; pop.style.minWidth = r.width + 'px';
    var pr = pop.getBoundingClientRect();
    if (pr.bottom > window.innerHeight - 4) pop.style.top = Math.max(4, r.top - pr.height - 2) + 'px';   // 下方不足→往上開
    if (pr.right > window.innerWidth - 4) pop.style.left = Math.max(4, window.innerWidth - pr.width - 4) + 'px';   // 右側超出→靠右
}
function _cddScroll() {
    if (!_cddSel) return;
    var pop = document.getElementById('cdd-pop'); if (!pop) return;
    if (!document.body.contains(_cddSel)) { _cddClose(); return; }   // 觸發的 select 已被移除（面板重繪）→ 關閉
    var r = _cddSel.getBoundingClientRect();
    if (!_cddFresh() && (r.bottom <= 0 || r.top >= window.innerHeight || (r.width === 0 && r.height === 0))) { _cddClose(); return; }   // select 已捲出畫面→關閉（冷卻窗內不關·避免開啟瞬間版面微調誤判）
    _cddPositionPop(pop, r);   // 否則黏著 select 重新定位
}
function openCustomSelectPopup(sel) {
    if (_cddSel === sel) { _cddClose(); return; }   // 再點同一個 → 收合
    _cddClose();
    if (!sel.options || !sel.options.length) return;
    _cddSel = sel;
    _cddOpenTs = Date.now();   // 🔧 啟動開啟手勢冷卻窗
    var r = sel.getBoundingClientRect();
    var pop = document.createElement('div');
    pop.id = 'cdd-pop'; pop.className = 'cdd-pop';
    pop.style.minWidth = r.width + 'px';
    Array.prototype.forEach.call(sel.options, function (o, idx) {
        var row = document.createElement('div');
        row.className = 'cdd-opt' + (o.disabled ? ' cdd-disabled' : '') + (idx === sel.selectedIndex ? ' cdd-sel' : '');
        row.textContent = o.textContent;
        if (o.style && o.style.color) row.style.color = o.style.color;
        if (!o.disabled) row.addEventListener('click', function () {
            if (_cddFresh()) return;   // 🔧 開啟手勢殘留 click 落在彈出層選項上（彈出層蓋住點擊點時）→ 冷卻窗內不誤選
            if (sel.value !== o.value) { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
            _cddClose();
        });
        pop.appendChild(row);
    });
    document.body.appendChild(pop);
    _cddPositionPop(pop, r);   // 定位＋視窗邊界夾擠（下方不足往上開／右側超出靠右）
    setTimeout(function () {
        document.addEventListener('click', _cddOutside, true);
        document.addEventListener('keydown', _cddKey, true);
        document.addEventListener('scroll', _cddScroll, true);
    }, 0);
}
document.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    if (!document.documentElement.classList.contains('pkg-build')) return;   // 僅打包版啟用，網頁版維持原生選單
    var s = e.target;
    if (s && s.tagName === 'SELECT' && !s.multiple && !s.disabled) {   // 🔧 整個打包版所有單選下拉一致（地圖／藥水／自動技能…）
        e.preventDefault();   // 阻止原生彈出選單
        openCustomSelectPopup(s);
    }
}, true);
function _cddWinClose() { if (_cddFresh()) return; _cddClose(); }   // 🔧 blur/resize 在「開啟手勢冷卻窗」內不關（打包版 Electron 原生 select 焦點殘響會在開啟瞬間噴 blur）
window.addEventListener('resize', _cddWinClose);
window.addEventListener('blur', _cddWinClose);
// 🌑 v3.4.7 黑暗妖精聖地 3 隱藏圖（NPC 進入·不在任何下拉）→右上角改顯示地名（比照傲慢之塔/遺忘之島）
const SANCTUARY_MAP_NAMES = { dark_elf_sanctuary: '黑暗妖精聖地', cursed_dark_elf_sanctuary: '受詛咒的黑暗妖精聖地', collapsed_elder_council_hall: '崩壞的長老會議廳' };
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
    } else if (cur === 'arena_pvp') {
        ind.textContent = '⚔️ 決鬥競技場';   // ⚔️ v3.7.13 決鬥競技場（不在 MAP_CATEGORIES·入口＝古魯丁巴魯特）：比照隱藏區域＝左右下拉全隱藏、只顯示地名（離場走「回村」或結果視窗的「回村莊」）
        ind.classList.remove('hidden');
        if (sel) sel.classList.add('hidden');
        if (cat) cat.classList.add('hidden');
    } else if (SANCTUARY_MAP_NAMES[cur]) {
        ind.textContent = SANCTUARY_MAP_NAMES[cur];   // 🌑 v3.4.7 黑暗妖精聖地3隱藏圖：比照傲慢之塔/遺忘之島＝隱藏左右下拉、只顯示地名（只能用「回村」離開）
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
// 🏘️ v3.0.94 回村改「回上一個待過的安全區」：changeMap 進村分支記錄 player.lastTownVisited；無紀錄/地圖無效→回家鄉。
//    城堡安全區只允許目前持有該城堡的血盟返回；未持有時退回家鄉。
function getLastTown() {
    let t = player && player.lastTownVisited;
    if (!t || typeof t !== 'string' || !t.startsWith('town_') || !(DB.towns[t] || DB.maps[t])) return getHomeTown();
    let _isCastle = Object.values(SIEGE_CITY).some(c => c && c.castle === t);
    if (_isCastle && (!siegeVictoryActive() || victoryCityCfg().castle !== t)) return getHomeTown();
    return t;
}
function returnToTown() {
    if (state.riftRun && mapState.current === 'rift_battle') { logSys('<span class="text-violet-300">扭曲的時空緊緊纏繞著你，無法回村——唯有戰死方能離開時空裂痕。</span>'); return; }   // 🌀 裂痕內不可回村
    // 與切換地圖相同的受控限制（石化／麻痺／冰凍／暈眩時無法回村）
    if (player.statuses && (player.statuses.stone > 0 || player.statuses.paralyze > 0 || player.statuses.freeze > 0 || player.statuses.stun > 0 || player.statuses.sleep > 0)) {
        logSys('你目前無法行動（石化／麻痺／冰凍／暈眩），無法回村。');
        return;
    }
    let _wasKingRoom = !!KING_ROOMS[mapState.current];   // 🔧 記住離開前是否在軍王之室
    let _kingRegion = _wasKingRoom && typeof mapRegionOf === 'function' ? mapRegionOf(mapState.current) : null;   // 🗝️ 離場前先取得該軍王之室所屬地區（changeMap 後 mapState.current 已變）
    if (state.oblivion) { state.oblivion = null; state._oblivionAdvance = false; }   // 🏝️ 回村即結束遺忘之島旅程
    setMapSelectors(siegeVictoryActive() ? victoryCityCfg().castle : getLastTown());   // 持有城堡：回城＝血盟城堡；否則回上一個待過的安全區（無紀錄→家鄉）
    changeMap();   // 走既有切換流程（進入村莊：補滿 HP/MP、清狀態、渲染 NPC）
    // 🔧 自軍王之室手動回城／回村：同樣將「特殊」記憶位置改為新兵修練場（避免下次自動回到需鑰匙的軍王之室）
    // 🗝️ 離開軍王之室：清掉該「地區」的最後位置記憶，否則下次在下拉選同一地區會自動再進 BOSS 房、白扣一把軍王的鑰匙。
    //    （舊寫法寫的是 lastMapByCat.special，但分類改用 MAP_REGIONS 後 'special' 不再是任何鍵＝死碼。）
    if (_wasKingRoom) { if (!player.lastMapByCat) player.lastMapByCat = {}; if (_kingRegion) delete player.lastMapByCat[_kingRegion]; saveGame(); }
}

// ===== ⌨️ 鍵盤快捷鍵（v3.1.13）=====
//  Tab       → 背包三分頁輪替：武器 → 防具 → 道具 → 武器…（不在三分頁時→武器）
//  Ctrl+S    → 技能欄　  Ctrl+A → 裝備欄　  Ctrl+B → 圖鑑（收藏）選單
//  Ctrl+C    → 立即返回血盟據點（持有城堡→城堡）；未加入血盟則提示。有選取文字時放行瀏覽器複製。
//  ⚠️ 只在遊戲畫面(game-screen 顯示中·已有職業)且焦點不在輸入框時生效；避免攔截打字/登入頁。
function _hkInGame() {
    let gs = document.getElementById('game-screen');
    return !!(gs && !gs.classList.contains('hidden') && typeof player !== 'undefined' && player && player.cls);
}
function _hkTyping(el) {
    if (!el) return false;
    let tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
// 依分頁名找到對應切換按鈕並呼叫 switchTab（沿用既有 UI 流程·同步 active 樣式）
function _hkSwitchTab(name) {
    let btn = document.querySelector('[onclick*="switchTab(\'' + name + '\'"]');
    if (btn && typeof switchTab === 'function') switchTab(name, btn);
}
// Tab：武器 → 防具 → 道具 → 武器 輪替（找出目前顯示中的三分頁·切下一個；都沒顯示→武器）
function hotkeyCycleInventory() {
    let order = ['weapons', 'armors', 'items'];
    let cur = order.findIndex(id => { let e = document.getElementById('tab-' + id); return e && !e.classList.contains('hidden'); });
    _hkSwitchTab(order[(cur < 0) ? 0 : (cur + 1) % order.length]);
}
// Ctrl+C：返回血盟據點（getHomeTown 已含「血盟優先回盟主村莊」）；持有城堡時回城堡。未入盟→提示。
function returnToPledgeBase() {
    if (!player || !player.bloodPledge) { logSys('<span class="text-amber-300">你尚未加入任何血盟，沒有可返回的據點。</span>'); return; }
    // 受控限制（比照回村）：石化／麻痺／冰凍／暈眩／睡眠時不可傳送
    if (player.statuses && (player.statuses.stone > 0 || player.statuses.paralyze > 0 || player.statuses.freeze > 0 || player.statuses.stun > 0 || player.statuses.sleep > 0)) {
        logSys('你目前無法行動（石化／麻痺／冰凍／暈眩），無法返回據點。');
        return;
    }
    if (state.riftRun && mapState.current === 'rift_battle') { logSys('<span class="text-violet-300">時空裂痕緊緊纏繞著你，唯有戰死方能離開，無法返回據點。</span>'); return; }
    let _wasKingRoom = !!KING_ROOMS[mapState.current];
    let _kingRegion = _wasKingRoom && typeof mapRegionOf === 'function' ? mapRegionOf(mapState.current) : null;   // 🗝️ 同上：離場前記錄地區
    if (state.oblivion) { state.oblivion = null; state._oblivionAdvance = false; }   // 🏝️ 返回即結束遺忘之島旅程
    let _victory = siegeVictoryActive();
    setMapSelectors(_victory ? victoryCityCfg().castle : getHomeTown());
    changeMap();
    // 🗝️ 離開軍王之室：清掉該「地區」的最後位置記憶，否則下次在下拉選同一地區會自動再進 BOSS 房、白扣一把軍王的鑰匙。
    //    （舊寫法寫的是 lastMapByCat.special，但分類改用 MAP_REGIONS 後 'special' 不再是任何鍵＝死碼。）
    if (_wasKingRoom) { if (!player.lastMapByCat) player.lastMapByCat = {}; if (_kingRegion) delete player.lastMapByCat[_kingRegion]; saveGame(); }
    logSys('<span class="text-emerald-300">⌨️ 已返回' + (_victory ? '城堡' : '血盟據點') + '。</span>');
}
if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('keydown', function (e) {
        if (!_hkInGame() || _hkTyping(e.target)) return;
        if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {   // 只吃「純 Ctrl/⌘＋鍵」；放行 Ctrl+Shift+* 瀏覽器快捷（開發者工具／強制重載）
            let k = (e.key || '').toLowerCase();
            if (k === 's') { e.preventDefault(); _hkSwitchTab('skill'); return; }
            if (k === 'a') { e.preventDefault(); _hkSwitchTab('equip'); return; }
            if (k === 'b') { e.preventDefault(); if (typeof openCollectionPanel === 'function') openCollectionPanel(); return; }
            if (k === 'c') {
                let sel = (typeof window.getSelection === 'function') ? String(window.getSelection() || '') : '';
                if (sel) return;   // 有選取文字→放行瀏覽器複製，不攔截
                e.preventDefault(); returnToPledgeBase(); return;
            }
            return;
        }
        if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); hotkeyCycleInventory(); }
    }, false);
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
    // 血盟不再持有風木城時，上一張若為風木地監則改往新兵修練場。
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

// ===== 攻城戰 =====
function openSiegeSelect(faction, targetEl) {
    let s = player.siege || {};
    let clan = (typeof clanGetModeInfo === 'function') ? clanGetModeInfo(player) : null;
    if (!clan) { alert('你尚未加入血盟，無法宣布攻城戰。'); return; }
    if (typeof clanCanSiege === 'function' && !clanCanSiege(player)) { alert('此模式沒有創立血盟的王族，無法攻城。'); return; }
    if (s.active) { alert('攻城戰正在進行中！'); return; }
    faction = clan.faction;
    let held = (typeof clanGetCastleCity === 'function') ? clanGetCastleCity(player) : null;
    let choice = (city, label, style) => {
        let defender = typeof npcClanCastleDefender === 'function' ? npcClanCastleDefender(city, player) : null;
        let defenderText = defender ? `<span class="block text-xs font-normal mt-1">守城血盟：${typeof clanEsc === 'function' ? clanEsc(defender.name) : defender.name}</span>` : '';
        return held === city
            ? `<button class="btn flex-1 py-4 text-lg font-bold bg-slate-700 border-slate-500 text-slate-400 opacity-60 cursor-not-allowed" disabled>${label}<span class="block text-xs font-normal mt-1">目前持有</span></button>`
            : `<button class="btn flex-1 py-4 text-lg font-bold ${style}" onclick="startSiege('${faction}','${city}')">${label}${defenderText}</button>`;
    };
    let el = targetEl || document.getElementById('interaction-content'); if (!el) return;
    el.innerHTML = `
        <div class="flex flex-col gap-4 p-2 items-center text-center">
            <div class="text-amber-200 font-bold text-lg">⚔ 宣布攻城戰</div>
            <div class="bg-slate-800/70 border border-red-700/60 rounded p-3 text-sm text-slate-300 leading-relaxed">
                限時 30 分鐘。<br>
                攻城戰<span class="text-emerald-300 font-bold">不設冷卻</span>，不論勝負皆可隨時再次宣戰。
            </div>
            <div class="text-slate-300 text-sm">選擇要攻打的城池：</div>
            <div class="flex gap-3 w-full">
                ${choice('kent', '🏰 肯特城', 'bg-red-900 hover:bg-red-800 border-red-500')}
                ${choice('windwood', '🌲 風木城', 'bg-emerald-900 hover:bg-emerald-800 border-emerald-500')}
            </div>
            <div class="flex w-full">${choice('heine', '🌊 海音城', 'bg-sky-900 hover:bg-sky-800 border-sky-400 text-sky-100')}</div>
        </div>`;
}
function startSiege(faction, city) {
    city = SIEGE_CITY[city] ? city : 'kent';
    let cfg = SIEGE_CITY[city];
    let s = player.siege || (player.siege = { active:false, city:'kent', gateKilled:false, towerKilled:false, endTime:0, kills:0, result:null, cooldownUntil:0, accCdUntil:0 });
    let clan = (typeof clanGetModeInfo === 'function') ? clanGetModeInfo(player) : null;
    if (!clan) { alert('你尚未加入血盟，無法宣布攻城戰。'); return; }
    if (typeof clanCanSiege === 'function' && !clanCanSiege(player)) { alert('此模式沒有創立血盟的王族，無法攻城。'); return; }
    if (s.active) { alert('攻城戰正在進行中！'); return; }
    // ⚔️ v3.6.05 等級限制取消（用戶拍板·原 Lv40 門檻）：與 v3.6.01 的冷卻取消一致，攻城不再有任何前置條件
    if (typeof clanGetCastleCity === 'function' && clanGetCastleCity(player) === city) { alert(`你的血盟目前已持有${cfg.name}。`); return; }
    if (!confirm(`確定要對【${cfg.name}】宣戰嗎？限時 30 分鐘。`)) return;
    let accCdUntil = Number(s.accCdUntil) || 0;
    let _defender = typeof npcClanCastleDefender === 'function' ? npcClanCastleDefender(city, player) : null;
    player.siege = { active:true, city:city, gateKilled:false, towerKilled:false, endTime: Date.now() + 30*60*1000, kills:0, result:null, cooldownUntil:0, accCdUntil:accCdUntil, npcDefenderClanId:_defender ? _defender.id : null };
    let _defenderMsg = _defender ? `守城方為 NPC 血盟【${typeof clanEsc === 'function' ? clanEsc(_defender.name) : _defender.name}】，敵軍重生速度加倍。` : '';
    logSys(`⚔ <span class="text-red-300 font-bold">攻城戰開始！</span>限時 30 分鐘。${_defenderMsg}攻破【${cfg.gate}】後進攻【${cfg.innerName}】，於時限內擊殺【${cfg.tower}】即可獲勝！`);
    setMapSelectors(cfg.outer);
    changeMap(true);
    updateUI();
}
function endSiege(result) {
    let s = player.siege; if (!s || !s.active) return;
    let _npcDefenderClanId = s.npcDefenderClanId || null;
    s.active = false; s.result = result;
    s.endTime = Date.now();   // 擊敗守護塔（獲勝）或時間到：攻城時間立即結束
    s.cooldownUntil = 0;   // ⚔️ v3.6.01 攻城冷卻取消（用戶拍板）：欄位保留=0 兼容舊存檔殘值
    delete s.rewardPending;
    delete s.victoryUntil;
    delete s.victoryCity;
    let _cfg = siegeCityCfg();
    if (result === 'win') {
        let setResult = (typeof clanSetCastle === 'function') ? clanSetCastle(_cfg.key) : { ok:false };
        if (setResult && setResult.ok) {
            if (typeof npcClanOnSiegeResult === 'function') npcClanOnSiegeResult(_cfg.key, 'win', _npcDefenderClanId);
            let replaced = setResult.previous && setResult.previous !== _cfg.key && SIEGE_CITY[setResult.previous] ? `，原有的${SIEGE_CITY[setResult.previous].castleName}已放棄` : '';
            logSys(`🏆🏰 <span class="text-yellow-300 font-bold">攻城獲勝！</span>血盟已永久佔領${_cfg.castleName}${replaced}。同模式所有角色可使用城堡、全商店 8 折，回村按鈕改為回城。`);
        } else {
            logSys('<span class="text-red-400 font-bold">攻城獲勝，但城堡共用資料寫入失敗。</span>攻城已無冷卻，可立即再次宣戰重試佔領。');
        }
    } else {
        if (typeof npcClanOnSiegeResult === 'function') npcClanOnSiegeResult(_cfg.key, 'lose', _npcDefenderClanId);
        logSys(`🏰 <span class="text-slate-300 font-bold">攻城失敗…</span>時間到，未能攻下${_cfg.tower}。`);
    }
    { let timer = document.getElementById('siege-timer'); if (timer) timer.classList.add('hidden'); }   // 結束隱藏倒數
    // 🏰 v3.6.32 獲勝→直接傳送到「奪下的城堡」（用戶拍板）；敗北或城堡共用資料寫入失敗→照舊回家鄉村莊。
    //    用 siegeVictoryActive/victoryCityCfg 判定（clanSetCastle 剛寫入·寫入失敗時 victory 不成立自動走 fallback）；
    //    changeMap 的城堡把關（持有時效）同一組函式，不會被彈回。
    let _dest = (result === 'win' && siegeVictoryActive() && victoryCityCfg().castle) ? victoryCityCfg().castle : getHomeTown();
    setMapSelectors(_dest);
    changeMap(true);
    updateUI();
    saveGame();   // 攻城戰結束時自動存檔
}
function siegeTick() {
    let s = player.siege;
    if (mapState.current && CASTLE_EXTRA.includes(mapState.current) && !(s && s.active) && (!siegeVictoryActive() || victoryCityCfg().key !== 'windwood')) {
        logSys('<span class="text-amber-300 font-bold">血盟目前未持有風木城，城堡狩獵區不再開放，你被送回村莊。</span>');
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
function siegeVictoryActive() { return !!(typeof clanGetCastleCity === 'function' && clanGetCastleCity(player)); }
function shopPrice(base) { return siegeVictoryActive() ? Math.floor((base || 0) * 0.8) : (base || 0); }
function ismaelAccCooldownMs() { return Math.max(0, Number(player.siege && player.siege.accCdUntil) - Date.now()); }
function ismaelAccAvailable() { return ismaelAccCooldownMs() <= 0; }
function ismaelAccCooldownText() {
    let ms = ismaelAccCooldownMs();
    if (ms <= 0) return '';
    let h = Math.floor(ms / 3600000), m = Math.ceil((ms % 3600000) / 60000);
    return `${h} 小時 ${m} 分`;
}
let _obelSel = { map: '', mob: '' };
let _activePanel = null;   // 'obel' | null：目前開啟、需每分鐘刷新剩餘時間的面板（唯一有倒數的是奧貝勒魔物追蹤）
function startPanelRefresh() {
    if(window._panelRefreshTimer) return;
    window._panelRefreshTimer = setInterval(() => {
        let cont = document.getElementById('town-interaction-container');
        let el = document.getElementById('interaction-content');
        if(!cont || cont.classList.contains('hidden') || !el || !_activePanel) return;
        if(_activePanel === 'obel') {
            if(player.tracking && player.tracking.until > Date.now()) renderObelNPC(el);   // 追蹤中(有倒數)才刷新，避免打斷選取
        }
    }, 60000);
}
// 🔍 魔物追蹤可指定地圖：野外/地監/特殊＋底比斯(rift)＋海賊島(pirate_island) 三類掃 MAP_CATEGORIES（濾掉村莊與純BOSS房），
//    再補上「不在 MAP_CATEGORIES」的遺忘之島(途中/島)＋風木地監。
//    刻意排除：村莊(town_)、純BOSS房(PURE_BOSS_MAPS)、攻城內外城(siege_* 限時活動)、傲慢之塔攀登樓層(pride_f* 攀登模式·非固定地圖)、
//    🚫 隱藏狩獵區域(hidden_*·象牙塔密室/巨蟻女皇·用戶要求不開放追蹤·維持只能由母圖傳送進入)。
//    🗼 v3.6.25 例外（用戶拍板）：背包持有 傲慢之塔支配符(NF)（僅 dom·傳送符/移動卷軸不算）→ 開放該符對應樓層區間
//    (pride_N_(N+9)) 的魔物追蹤；賣掉/存倉即從清單消失（追蹤已生效者不中斷·出怪判定只看 tracking.map）。
const OBEL_EXTRA_MAPS = [
    { v: 'oblivion_travel', t: '遺忘之島途中' }, { v: 'oblivion_island', t: '遺忘之島' },
    { v: 'windwood_dungeon', t: '風木地監' }
];
function obelMapList() {
    let out = [];
    ['wild', 'dungeon', 'special', 'rift', 'pirate_island'].forEach(cat => {
        (MAP_CATEGORIES[cat] || []).forEach(e => {
            if(DB.maps[e.v] && !PURE_BOSS_MAPS.includes(e.v) && e.v.indexOf('town_') !== 0) out.push({ v: e.v, t: e.t });
        });
    });
    OBEL_EXTRA_MAPS.forEach(e => { if(DB.maps[e.v]) out.push({ v: e.v, t: e.t }); });
    [11, 21, 31, 41, 51, 61, 71, 81, 91].forEach(N => {   // 🗼 v3.6.25 支配符樓層
        let _pv = 'pride_' + N + '_' + (N + 9);
        if(DB.maps[_pv] && typeof prideHasTalisman === 'function' && prideHasTalisman(N, ['dom'])) out.push({ v: _pv, t: '傲慢之塔' + N + '~' + (N + 9) + '樓' });
    });
    return out;
}
function renderObelNPC(div) {
    _activePanel = 'obel'; startPanelRefresh();
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
    let canStart = !!_obelSel.mob;
    div.innerHTML = `
        <div class="flex flex-col gap-3 p-1">
            <div class="text-slate-300 text-sm leading-relaxed">奧貝勒：你想搜索哪一頭魔物？花費 100,000 金幣就能幫你追蹤。</div>
            <select class="w-full bg-slate-900 border border-slate-600 text-white px-2 py-2 rounded text-sm" onchange="onObelMapChange(this.value)">${mapOpts}</select>
            ${_obelSel.map ? `<div class="bg-slate-800/40 border border-slate-700 rounded p-2 max-h-60 overflow-y-auto flex flex-col gap-0.5">${mobHtml || '<span class="text-slate-500 text-sm">此地區無可追蹤的怪物</span>'}</div>` : ''}
            <button class="btn ${canStart ? 'bg-red-700 hover:bg-red-600 border-red-500' : 'bg-slate-600 border-slate-500 opacity-60 cursor-not-allowed'} py-2 px-4 font-bold" ${canStart ? '' : 'disabled'} onclick="obelStartTracking()">開始追蹤（消耗 100,000 金幣）</button>
        </div>`;
}
function onObelMapChange(v) { _obelSel.map = v; _obelSel.mob = ''; let el = document.getElementById('interaction-content'); if(el) renderObelNPC(el); }
function onObelMobToggle(id) { if(DB.mobs[id] && DB.mobs[id].boss) return; _obelSel.mob = (_obelSel.mob === id) ? '' : id; let el = document.getElementById('interaction-content'); if(el) renderObelNPC(el); }
function obelStartTracking() {
    if(!_obelSel.mob || !_obelSel.map) return;
    const TRACKING_GOLD_COST = 100000;
    if ((player.gold || 0) < TRACKING_GOLD_COST) { alert(`金幣不足，追蹤需要 ${TRACKING_GOLD_COST.toLocaleString()} 金幣。`); return; }
    player.gold -= TRACKING_GOLD_COST;
    player.tracking = { map: _obelSel.map, mob: _obelSel.mob, until: Date.now() + 8 * 3600 * 1000 };
    _obelSel = { map: '', mob: '' };
    renderTabs(); saveGame();
    logSys(`花費 ${TRACKING_GOLD_COST.toLocaleString()} 金幣，奧貝勒開始追蹤 <span class="text-amber-300 font-bold">${(DB.mobs[player.tracking.mob] || {}).n}</span>，持續 8 小時。`);
    let el = document.getElementById('interaction-content'); if(el) renderObelNPC(el);
    updateUI();
}
function obelCancelTracking() {
    if(!confirm('確定要取消追蹤嗎？（已支付的金幣不會退還）')) return;
    player.tracking = null;
    saveGame();
    logSys('已取消追蹤。');
    let el = document.getElementById('interaction-content'); if(el) renderObelNPC(el);
}
function renderIsmaelExchange(el) {
    let sw = invCountId('scroll_weapon'), sa = invCountId('scroll_armor');   // 🔧 含倉庫存量
    let swc = invCountId('scroll_weapon_c'), sac = invCountId('scroll_armor_c');
    let accOk = ismaelAccAvailable();
    let accTxt = accOk ? '' : `（購買冷卻尚餘 ${ismaelAccCooldownText()}）`;
    el.innerHTML = `
        <div class="flex flex-col gap-3 p-1">
            <div class="text-slate-300 text-sm leading-relaxed">伊賽馬利：需要稀有的卷軸嗎？我這裡能交換（背包與倉庫的卷軸皆可使用）。</div>
            ${(typeof trialQtyBar === 'function') ? trialQtyBar() : ''}
            <div class="text-xs text-slate-400 -mt-2">🆕 兌換數量共用上方數量列，並自動以「可負擔上限」為準（飾品卷軸購買除外）。</div>
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
                <div class="text-sm text-slate-200 leading-relaxed">1,000,000 金幣 → 1 張 <span class="text-sky-300 font-bold">對飾品施法的卷軸</span><br><span class="text-xs text-slate-400">購買後 24 小時可再次購買 ${accTxt}</span></div>
                <button class="btn ${!accOk ? 'bg-slate-600 border-slate-500 opacity-60 cursor-not-allowed' : 'bg-yellow-700 hover:bg-yellow-600 border-yellow-500'} py-2 px-4 font-bold shrink-0" ${!accOk ? 'disabled' : ''} onclick="ismaelBuyAcc()">購買</button>
            </div>
        </div>`;
}
function ismaelExchange(kind) {   // 🆕 v2.6.84 可選兌換數量（共用 trial-qty 數量列·自動以可負擔上限為準）
    let id = kind === 'weapon' ? 'scroll_weapon' : 'scroll_armor';
    let outId = kind === 'weapon' ? 'scroll_weapon_b' : 'scroll_armor_b';
    let nm = kind === 'weapon' ? '對武器施法的卷軸' : '對盔甲施法的卷軸';
    let have = invCountId(id), maxAff = Math.floor(have / 100);
    if (maxAff < 1) { alert(`${nm} 不足 100 張（背包＋倉庫共 ${have} 張）。`); return; }
    let n = Math.min((typeof trialQtyVal === 'function') ? trialQtyVal() : 1, maxAff);
    consumeMaterialById(id, 100 * n);   // 🔧 背包優先、不足自動扣倉庫
    gainItem(outId, n, true, true);
    renderTabs();
    logSys(`以 ${100 * n} 張 ${nm} 兌換了 ${n} 張 <span class="text-amber-300 font-bold">祝福的 ${nm}</span>。`);
    updateUI(); saveGame();
    let el = document.getElementById('interaction-content'); if (el) renderIsmaelExchange(el);
}
// 🏝️ 伊賽馬利：100 張 一般施法卷軸 → 1 張 詛咒的 施法卷軸（無次數限制·🆕 可選數量）
function ismaelMakeCursed(kind) {
    let id = kind === 'weapon' ? 'scroll_weapon' : 'scroll_armor';
    let outId = kind === 'weapon' ? 'scroll_weapon_c' : 'scroll_armor_c';
    let nm = kind === 'weapon' ? '對武器施法的卷軸' : '對盔甲施法的卷軸';
    let have = invCountId(id), maxAff = Math.floor(have / 100);
    if (maxAff < 1) { alert(`${nm} 不足 100 張（背包＋倉庫共 ${have} 張）。`); return; }
    let n = Math.min((typeof trialQtyVal === 'function') ? trialQtyVal() : 1, maxAff);
    consumeMaterialById(id, 100 * n);   // 🔧 背包優先、不足自動扣倉庫
    gainItem(outId, n, true, true);
    renderTabs();
    logSys(`以 ${100 * n} 張 ${nm} 兌換了 ${n} 張 <span class="c-cursed">詛咒的 ${nm}</span>。`);
    updateUI(); saveGame();
    let el = document.getElementById('interaction-content'); if (el) renderIsmaelExchange(el);
}
// 伊賽馬利：3 張 詛咒的 施法卷軸 → 1 張 祝福的 施法卷軸（無次數限制·🆕 可選數量）
function ismaelCursedExchange(kind) {
    let id = kind === 'weapon' ? 'scroll_weapon_c' : 'scroll_armor_c';
    let outId = kind === 'weapon' ? 'scroll_weapon_b' : 'scroll_armor_b';
    let nm = kind === 'weapon' ? '對武器施法的卷軸' : '對盔甲施法的卷軸';
    let have = invCountId(id), maxAff = Math.floor(have / 3);
    if (maxAff < 1) { alert(`詛咒的 ${nm} 不足 3 張（背包＋倉庫共 ${have} 張）。`); return; }
    let n = Math.min((typeof trialQtyVal === 'function') ? trialQtyVal() : 1, maxAff);
    consumeMaterialById(id, 3 * n);   // 🔧 背包優先、不足自動扣倉庫
    gainItem(outId, n, true, true);
    renderTabs();
    logSys(`以 ${3 * n} 張 <span class="c-cursed">詛咒的 ${nm}</span> 兌換了 ${n} 張 <span class="text-amber-300 font-bold">祝福的 ${nm}</span>。`);
    updateUI(); saveGame();
    let el = document.getElementById('interaction-content'); if (el) renderIsmaelExchange(el);
}
// ===== 🔥 碧恩：屬性強化卷軸「賦予屬性」（v3.0.77 屬性強化系統改版·取代舊「祝福裝備」功能；克里斯特已移除） =====
//   規則：只能用在「裝備中武器／副手武器(戰士限定)」；每次使用皆為獨立事件，成功率 7%；
//   無屬性成功→1階、同屬性成功→+1階（最高5階）、不同屬性成功→變成該屬性1階；
//   第5階同屬性卷軸：原生無攻擊觸發技能的非遺物武器可用 1% 機率附加／重抽屬性魔法；同技能升星、不同技能回1星，最高3星；
//   衝第4階需武器+10以上、第5階需+11以上（不符不消耗卷軸）；失敗僅消耗卷軸，武器不會消失。
//   🎲 純機率 Math.random（與武器強化同政策·可 save/load 重抽）。經典/一般/傳統模式皆適用。
const ATTR_SCROLLS = {
    fire:  { id: 'scroll_attr_fire',  n: '火之武器強化卷軸', btn: 'bg-red-900 border-red-500 text-red-200 hover:bg-red-800' },
    water: { id: 'scroll_attr_water', n: '水之武器強化卷軸', btn: 'bg-blue-900 border-blue-500 text-blue-200 hover:bg-blue-800' },
    wind:  { id: 'scroll_attr_wind',  n: '風之武器強化卷軸', btn: 'bg-green-900 border-green-500 text-green-200 hover:bg-green-800' },
    earth: { id: 'scroll_attr_earth', n: '地之武器強化卷軸', btn: 'bg-amber-900 border-amber-600 text-amber-200 hover:bg-amber-800' },
};
function doBianAttr(slotKey, ele) {
    let item = player.eq[slotKey];
    if (!item) { logSys('該欄位沒有裝備武器。'); return; }
    let d = DB.items[item.id];
    if (!d || d.type !== 'wpn') { logSys('只能對武器賦予屬性。'); return; }
    if (isRelic(d)) { logSys('<span class="c-relic">遺物無法賦予屬性。</span>'); return; }   // 🏺 遺物：無法賦予屬性
    let cfg = ATTR_SCROLLS[ele]; if (!cfg) return;
    let sc = player.inv.find(i => i.id === cfg.id);
    if (!sc || sc.cnt < 1) { logSys(`<span class="text-red-400">缺少 ${cfg.n}。</span>`); return; }
    let cur = getAttrAffix(item.attr);
    let same = !!(cur && cur.ele === ele);
    let nextTier = same ? cur.tier + 1 : 1;   // 同屬性→下一階；無屬性/不同屬性→該屬性1階
    if (same && cur.tier >= 5) {
        if (weaponHasBaseTriggeredSkill(d, item.id)) { logSys('<span class="text-amber-300">此武器無法附加魔法。</span>'); return; }   // 原生已有攻擊／命中觸發技能，不消耗
        let pool = ATTR_MAGIC_SKILLS[ele] || [];
        if (!pool.length) return;
        let oldMagic = getAttrMagicProc(item);
        sc.cnt--; if (sc.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== sc.uid);
        if (Math.random() < 0.01) {
            let picked = pool[Math.floor(Math.random() * pool.length)];
            let sameMagic = !!(oldMagic && oldMagic.skId === picked.skId);
            let oldStar = oldMagic ? oldMagic.star : 0;
            let nextStar = sameMagic ? Math.min(3, oldStar + 1) : 1;
            item.attrMagic = picked.skId;
            item.attrMagicStar = nextStar;
            let skName = (DB.skills[picked.skId] && DB.skills[picked.skId].n) || picked.skId;
            let stars = '★'.repeat(nextStar);
            let result = !oldMagic ? `獲得 ${stars} ${skName}` :
                sameMagic ? (nextStar > oldStar ? `${skName} 升為 ${stars}` : `${skName} 維持 ${stars}`) :
                    `改為 ★ ${skName}`;
            logSys(`<span class="text-yellow-300 font-bold">${oldMagic ? '重抽' : '附加'}魔法成功！</span>${getItemFullName(item)} ${result}，「攻擊時 ${picked.rate * nextStar}% 機率觸發」。`);
        } else {
            logSys(`<span class="text-slate-400">碧恩：魔法刻印沒有回應……${oldMagic ? '原有附加魔法保持不變，' : ''}僅消耗 1 張 ${cfg.n}。</span>`);
        }
        calcStats(); updateUI(); renderTabs(true); saveGame();
        let _e5 = document.getElementById('interaction-content'); if (_e5) renderBianAttr(_e5);
        return;
    }
    let en = Number(item.en) || 0;
    if (nextTier === 4 && en < 10) { logSys('<span class="text-amber-300">武器需 +10 以上才能衝屬性第四階。</span>'); return; }   // 不消耗
    if (nextTier === 5 && en < 11) { logSys('<span class="text-amber-300">武器需 +11 以上才能衝屬性第五階。</span>'); return; }   // 不消耗
    sc.cnt--; if (sc.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== sc.uid);
    if (Math.random() < 0.07) {   // 🎲 7% 獨立事件（純機率·可 save/load 重抽·同強化政策）
        let oldMagic = getAttrMagicProc(item);
        item.attr = ATTR_ELE_PREFIX[ele] + nextTier;
        if (!same && (item.attrMagic || item.attrMagicStar)) { delete item.attrMagic; delete item.attrMagicStar; }   // 不同屬性成功→原屬性附加魔法與星級一併消失
        let aff = getAttrAffix(item.attr);
        logSys(`<span class="text-yellow-300 font-bold">賦予屬性成功！</span>碧恩將 <span class="c-attr-${attrCanon(item.attr)}">${aff.n}</span> 之力銘刻於武器 → ${getItemFullName(item)}（屬性第${aff.tier}階：額外傷害+${aff.dmg}、額外魔法點數+${aff.mp}）。${!same && oldMagic ? '<span class="text-slate-400"> 原有附加魔法已隨屬性轉換消失。</span>' : ''}`);
    } else {
        logSys(`<span class="text-slate-400">碧恩：元素之力潰散了……賦予屬性失敗（僅消耗 1 張 ${cfg.n}，武器安然無恙）。</span>`);
    }
    calcStats(); updateUI(); renderTabs(true); saveGame();
    let _e = document.getElementById('interaction-content'); if (_e) renderBianAttr(_e);
}
// 解除詛咒（保留原功能）：優先消耗 解除詛咒的卷軸；沒有卷軸時可付 100 萬金幣（克里斯特已移除→金幣後備，避免詛咒裝備無解）
function doBianUncurse(slotKey) {
    let item = player.eq[slotKey];
    if (!item) { logSys('該欄位沒有裝備。'); return; }
    if (item.bless !== 'cursed') { logSys('該裝備沒有詛咒。'); return; }
    let sc = player.inv.find(i => i.id === 'new_item_uncurse');
    if (sc && sc.cnt >= 1) {
        sc.cnt--; if (sc.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== sc.uid);
    } else if ((player.gold || 0) >= 1000000) {
        player.gold -= 1000000;
        logSys('花費 1,000,000 金幣請碧恩淨化詛咒。');
    } else {
        logSys(`<span class="text-red-400">缺少 解除詛咒的卷軸（或 1,000,000 金幣）。</span>`); return;
    }
    item.bless = false;   // 移除詛咒：變成沒有祝福也沒有詛咒（不影響屬性 / 遠古系）
    calcStats(); updateUI(); renderTabs(true); saveGame();
    logSys(`碧恩為你的裝備解除了詛咒 → ${getItemFullName(item)}。`);
    let _e = document.getElementById('interaction-content'); if (_e) renderBianAttr(_e);
}
function renderBianAttr(el) {
    // 只列出 裝備中武器 與 副手武器（戰士雙持時才有 offwpn）
    let slots = [{ k: 'wpn', n: '武器' }];
    if (player.eq && player.eq.offwpn) slots.push({ k: 'offwpn', n: '副手武器' });
    let cnt = id => { let it = player.inv.find(i => i.id === id); return it ? it.cnt : 0; };
    let rows = slots.map(sl => {
        let it = player.eq[sl.k];
        let name = it ? getItemFullName(it) : '<span class="text-slate-500">（未裝備）</span>';
        let cur = it && getAttrAffix(it.attr);
        let curTxt = cur ? `<span class="c-attr-${attrCanon(it.attr)}">${cur.n}（第${cur.tier}階）</span>` : '<span class="text-slate-500">無屬性</span>';
        let magic = it && getAttrMagicProc(it);
        if (magic) curTxt += `｜<span class="text-yellow-300">${'★'.repeat(magic.star)} ${(DB.skills[magic.skId] && DB.skills[magic.skId].n) || magic.skId} ${magic.rate}%</span>`;
        let btns = it ? Object.keys(ATTR_SCROLLS).map(e2 => {
            let c = ATTR_SCROLLS[e2], have = cnt(c.id);
            return have > 0
                ? `<button class="btn py-1 px-2 text-xs font-bold shrink-0 ${c.btn}" onclick="doBianAttr('${sl.k}','${e2}')">${c.n.slice(0, 2)}強化 (${have})</button>`
                : `<button class="btn py-1 px-2 text-xs font-bold shrink-0 bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed" disabled title="缺少 ${c.n}">${c.n.slice(0, 2)}強化 (0)</button>`;
        }).join('') : '';
        return `<div class="flex flex-col gap-1 bg-slate-800/60 border border-slate-600 rounded p-2 text-sm">
            <span class="truncate"><b class="text-amber-300">${sl.n}</b>：${name}｜${curTxt}</span>
            <div class="flex items-center gap-1 flex-wrap">${btns}</div>
        </div>`;
    }).join('');
    // 🔒 被詛咒的「已裝備」裝備仍可在此解除詛咒（任何部位·詛咒裝備無法卸下的唯一解）
    let cursedRows = Object.keys(player.eq).filter(k => player.eq[k] && player.eq[k].bless === 'cursed').map(k => {
        return `<div class="flex items-center justify-between gap-2 bg-slate-800/60 border border-red-900 rounded p-2 text-sm">
            <span class="truncate">${getItemFullName(player.eq[k])}</span>
            <button class="btn py-1 px-2 text-sm font-bold shrink-0 bg-cyan-800 border-cyan-500 text-cyan-100" onclick="doBianUncurse('${k}')">解除詛咒</button>
        </div>`;
    }).join('');
    el.innerHTML = `
        <div class="flex flex-col gap-2 p-1">
            <div class="text-slate-300 text-sm leading-relaxed">碧恩：我能將四大元素之力銘刻於你手中的武器。屬性提升成功率為 <b>7%</b>；第5階使用同屬性卷軸附加／重抽魔法的成功率為 <b>1%</b>。失敗僅消耗卷軸，武器不會消失。</div>
            <div class="text-xs text-slate-400">無屬性成功→第1階；同屬性成功→提升1階（最高5階）；<b>不同屬性成功→變成該屬性第1階</b>。衝第4階需武器+10以上、第5階需+11以上。第1~5階：額外傷害/額外魔法點數 +1/+3/+5/+7/+9，一般攻擊轉為該屬性。</div>
            <div class="text-xs text-slate-400">只有本身沒有攻擊／命中觸發技能的非遺物武器可附加魔法；成功時從該屬性5種魔法中抽選。同技能升1星並使觸發率乘上星數，最高3星；抽到不同技能則改為新技能1星。</div>
            <div class="text-xs text-slate-400">持有卷軸：<span class="c-attr-fr3">火 ${cnt('scroll_attr_fire')}</span>｜<span class="c-attr-wa3">水 ${cnt('scroll_attr_water')}</span>｜<span class="c-attr-wi3">風 ${cnt('scroll_attr_wind')}</span>｜<span class="c-attr-ea3">地 ${cnt('scroll_attr_earth')}</span></div>
            ${rows}
            ${cursedRows ? `<div class="text-xs text-slate-400 mt-1">被詛咒的裝備（優先消耗 解除詛咒的卷軸，持有 ${cnt('new_item_uncurse')}；無卷軸時花費 100 萬金幣）：</div>${cursedRows}` : ''}
        </div>`;
}
function ismaelBuyAcc() {
    if (!ismaelAccAvailable()) { alert(`購買冷卻中，尚餘 ${ismaelAccCooldownText()}。`); return; }
    if (player.gold < 1000000) { alert(`金幣不足（需 1,000,000，目前 ${player.gold.toLocaleString()}）。`); return; }
    player.gold -= 1000000;
    gainItem('scroll_acc', 1, true, true);
    if (!player.siege || typeof player.siege !== 'object') player.siege = {};
    player.siege.accCdUntil = Date.now() + 24 * 3600 * 1000;
    saveGame();   // 高價購買立即存檔
    logSys('花費 1,000,000 金幣購買了 1 張 <span class="text-sky-300 font-bold">對飾品施法的卷軸</span>。（24 小時後可再次購買）');
    updateUI();
    let el = document.getElementById('interaction-content'); if (el) renderIsmaelExchange(el);
}

function changeMap(force) {
    // 行動限制狀態（石化／麻痺／冰凍／暈眩）時無法主動切換地圖；force=true 供復活、載入等內部流程略過
    if (!force && player.statuses &&
        (player.statuses.stone > 0 || player.statuses.paralyze > 0 || player.statuses.freeze > 0 || player.statuses.stun > 0 || player.statuses.sleep > 0)) {
        syncMapSelectors();   // 還原「分類選單 + 地圖選單」為目前所在地圖
        logSys('你目前無法行動（石化／麻痺／冰凍／暈眩），無法切換地圖。');
        return;
    }
    let _changeTarget = document.getElementById('map-select').value;
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
    if (_changeTarget !== mapState.current && typeof npcClanOnLeaveBattleArea === 'function') npcClanOnLeaveBattleArea();
    if (typeof giltasKeepOnLeave === 'function' && document.getElementById('map-select').value !== mapState.current) giltasKeepOnLeave();   // 🌑 v3.4.16 離開受詛咒聖地（回村/戰敗復活/切圖統一經此·helper 自帶地圖 gate）→ 吉爾塔斯 HP 保留判定＋提示
    mapState.current = document.getElementById('map-select').value;
    if (!mapState.current.startsWith('town_')) player.lastBattleMap = mapState.current;   // 🔧 記住最後所在的戰鬥地圖，供村莊「出發」按鈕一鍵返回
    { let _c = mapRegionOf(mapState.current); if(_c) { if(!player.lastMapByCat) player.lastMapByCat = {}; player.lastMapByCat[_c] = mapState.current; } }   // 記住各「地區」分類最後到過的地圖（與下拉同鍵）
    mapState.mobs = [null, null, null, null, null];
    if (typeof _vfxClearAll === 'function') _vfxClearAll();   // 🎚️ v3.0.73 換地圖/回城：清掉上一張地圖尚在播放的死亡殘影等狩獵特效，避免蓋到村莊/新地圖介面
    state._kbRespawnAt = null;    // 🔧 離開/進入任何地圖即取消軍王之室未完成的復活倒數（避免殘留狀態）
    state._kbVictory = false;     // 🏛️ 進入新地圖一併清除未結算的全滅旗標（避免雙BOSS祭壇殘留誤觸發）
    mapState.forceBoss = false;   // 🔧 傳送戒指的必出BOSS僅在施放傳送的當下有效：換地圖即失效，需再次手動施放傳送術
    if(typeof auditReset === 'function') auditReset();   // 換地圖：效率統計重置
    
    // 👇 取得包覆地圖與村莊的父層 Panel
    let mapPanel = document.getElementById('town-view').parentElement;
    
    if (mapState.current.startsWith('town_')) {
        document.getElementById('battle-view').classList.add('hidden');
        document.getElementById('combat-log-panel').classList.remove('hidden');   // 🏘️ v3.2.86 城鎮版面比照狩獵區：戰鬥/系統日誌一樣顯示於下方，填滿地圖下方空間
        document.getElementById('town-view').classList.remove('hidden');
        document.getElementById('town-view').classList.add('flex');

        // 🏘️ v3.2.86 城鎮框改與狩獵區「完全一致」：地圖面板依內容(800×450)自適高度、不再 flex-1 撐滿→背景不被撐大（與狩獵分支同樣 remove flex-1）
        mapPanel.classList.remove('flex-1', 'overflow-hidden');
        
        // 設定村莊名稱
        let tData = DB.towns[mapState.current];
        let tName = tData ? tData.n : document.getElementById('map-select').options[document.getElementById('map-select').selectedIndex].text;
        document.getElementById('town-name').innerText = tName;
        player.lastTownVisited = mapState.current;   // 🏘️ v3.0.94 記錄最後待過的安全區（「回村」按鈕改回此處·隨存檔持久）
        
        // 瞬間恢復所有 HP 與 MP
        player.hp = player.mhp;
        player.mp = player.mmp;
        try { if (typeof reviveDownedMercsAtTown === 'function') reviveDownedMercsAtTown(); } catch (e) {}   // 🤝 Phase 3：回村/回城免費復活全體倒地傭兵
        try { if (typeof petsReviveAtTown === 'function') petsReviveAtTown(); } catch (e) {}   // 🐾 v3.6.29 回村：出戰寵物倒地復活＋補滿 HP/MP＋清異常（比照傭兵·js/22）
        try { if (typeof mercBankAlliesAtTown === 'function') mercBankAlliesAtTown(); } catch (e) {}   // 🤝 v2.6.68 隊長回村：上場傭兵各記一筆待領經驗（不解散·不改來源存檔）
        try { if (typeof mercExpClaimPending === 'function') mercExpClaimPending(); } catch (e) {}     // 🤝 v2.6.68 本角色回村/載入（loadGame 一律回家鄉村莊）：自動領取自己的待領經驗
        // 🏰 城堡護衛：回城/回村補滿血並解除力竭
        if (player.castleGuard) { let _cg = player.castleGuard; if (_cg.mode === 'heal') { _cg.mp = _cg.maxMp; _cg._healAcc = 0; } else { _cg.hp = _cg.maxHp; } _cg.disabled = false; _cg._regenAcc = 0; }
        // 協力角色：進村莊一併回滿 MP（與玩家一致）
        if (player.allies) player.allies.forEach(a => { if (a) a.mp = a.mmp; });
        // 進入村莊解除所有異常狀態（中毒/灼燒/燙傷/石化/麻痺/冰凍/暈眩/沉默/封印）
        // ⚠️ evilAura 必須列進來：整包覆蓋若少了這個鍵，js/03 的 for...in 到期還原迴圈永遠列舉不到它，
        //    已烙進 player.d 的 AC+10/ER−10 就再也回不去了。cleave 的攻速覆寫同理需要重算。
        player.statuses = { stun: 0, freeze: 0, stone: 0, poison: 0, poisonDmg: 0, poisonTick: 0, burn: 0, burnDmg: 0, burnTick: 0, scald: 0, scaldDmg: 0, scaldTick: 0, bleed: 0, bleedDmg: 0, bleedTick: 0, sleep: 0, silence: 0, paralyze: 0, magicseal: 0, armorBreak: 0, slowAtk: 0, cleave: 0, evilAura: 0 };   // 🔧 補齊 armorBreak/slowAtk/cleave/evilAura，與初始定義一致
        calcStats();   // 清狀態後重算：把 evilAura/cleave 烙進 player.d 的修正還原
        updateUI();
        
        // 關閉可能開啟著的互動面板，渲染 NPC 列表
        closeNpcInteraction();
        renderTownNPCs(mapState.current);
    } else {
        try { closeNpcInteraction(); } catch (e) {}   // 🗼 v3.2.89 離開安全區→關閉可能開著的 NPC 浮動視窗(position:fixed 不會隨 town-view 隱藏·如傲慢之塔入口)
        try { if (typeof closeWarehouseWindow === 'function') closeWarehouseWindow(); } catch (e) {}   // 🏦 浮動倉庫視窗掛 #app-stage、不隨 town-view 隱藏→離開安全區必須一併關閉，否則可帶進狩獵區/頭目戰使用
        document.getElementById('battle-view').classList.remove('hidden');
        document.getElementById('combat-log-panel').classList.remove('hidden');
        document.getElementById('town-view').classList.add('hidden');
        document.getElementById('town-view').classList.remove('flex');

        // 🎯 核心修復：離開村莊回到戰鬥時，恢復原本的面板設定
        mapPanel.classList.remove('flex-1', 'overflow-hidden');
        try { applyAreaBackground(); } catch(e){}   // ⚡ v2.6.49 立即套用狩獵區 area-fit(1920/580 條狀)＋背景，避免等到下一次 updateUI(下一 tick·最多~100ms)才變換→切村↔狩獵時戰鬥區解析度延遲跳動（村莊分支已於下方 updateUI() 即時處理·此分支原本漏呼故有延遲）

        // 進入新區域：依邏輯 tick 排程出怪（中央 50t=5秒、左側 70t=7秒、右側 90t=9秒）
        let t0 = state.ticks;
        mapState.spawnAt = [t0 + 70, t0 + 50, t0 + 90]; // [左0, 中1, 右2]
        mapState.suppressSiegeBoss = true;   // 初次進場：必定不出現肯特城門/守護塔
        // 🏛️ 雙BOSS祭壇：進場立即生成兩隻BOSS（之後不逐格補怪，兩隻皆亡才會在 15 秒後同時復活）
        if (KING_ROOMS[mapState.current] && KING_ROOMS[mapState.current].dual) {
            KING_ROOMS[mapState.current].bosses.forEach((bid, k) => spawnMob(k));
            mapState.spawnAt = [null, null, null, null, null];
        }
        renderMobs();
    }
    syncMapSelectors();   // 切換完成後，同步分類選單與地圖選單為目前所在地圖
}

// ===== 🔮 席琳神殿：祈禱（席琳的世界 開關介面）=====
function toggleSherineWorld() {
    if ((player.lv || 1) < 40) { logSys('<span class="text-red-400">等級未達 40，席琳對你的祈禱沒有回應。</span>'); return; }
    player.sherineWorld = !player.sherineWorld;
    if (player.sherineWorld) player.sherineMad = false;   // 🔮 互斥：開啟一般席琳 → 關閉瘋狂席琳
    applySherineTheme();
    logSys(player.sherineWorld
        ? '<span class="c-sherine font-bold">【席琳的世界】已開啟。</span><span class="text-slate-400">漆黑的濃霧滲入大地……怪物變得更加兇猛，但報酬也更加豐厚。</span>'
        : '<span class="text-slate-300">【席琳的世界】已關閉，世界恢復了平靜。</span>');
    saveGame();
    renderMobs();
    let el = document.getElementById('interaction-content'); if (el) renderSherinePray(el);
}
function toggleSherineMad() {
    if ((player.lv || 1) < 40) { logSys('<span class="text-red-400">等級未達 40，席琳對你的祈禱沒有回應。</span>'); return; }
    player.sherineMad = !player.sherineMad;
    if (player.sherineMad) player.sherineWorld = false;   // 🔮 互斥：開啟瘋狂席琳 → 關閉一般席琳
    applySherineTheme();
    logSys(player.sherineMad
        ? '<span class="c-sherine font-bold">【瘋狂的席琳世界】已開啟。</span><span class="text-red-400">大地染上猩紅的瘋狂……怪物的力量達到極致，報酬亦然。慎之。</span>'
        : '<span class="text-slate-300">【瘋狂的席琳世界】已關閉，世界恢復了平靜。</span>');
    saveGame();
    renderMobs();
    let el = document.getElementById('interaction-content'); if (el) renderSherinePray(el);
}
function renderSherinePray(div) {
    let on = !!(player && player.sherineWorld);
    let mad = !!(player && player.sherineMad);
    let lvOk = (player.lv || 1) >= 40;
    div.innerHTML = `
        <div class="flex flex-col gap-3 p-1">
            <div class="text-slate-300 text-sm leading-relaxed">席琳：旅人啊……是否願意凝視這個世界的另一面？（需等級 40 以上，可自由開啟/關閉；兩種世界互斥）</div>
            <div class="bg-slate-800/60 border ${on ? 'border-red-700' : 'border-slate-600'} rounded p-3 text-sm leading-relaxed">
                <div class="font-bold mb-1 ${on ? 'c-sherine' : 'text-slate-200'}">席琳的世界：目前 ${on ? '<span class="text-red-300">開啟</span>' : '<span class="text-slate-400">關閉</span>'}</div>
                <div class="text-slate-200 text-xs">怪物 HP×3、傷害×2、經驗/金錢×5，掉落×3，可能出現<span class="c-sherine font-bold">珍稀套裝裝備</span>與<span class="c-sherine font-bold">席琳結晶</span>。</div>
            </div>
            <button class="btn py-3 text-base font-bold ${!lvOk ? 'bg-slate-600 border-slate-500 opacity-60 cursor-not-allowed' : (on ? 'bg-slate-700 hover:bg-slate-600 border-slate-500' : 'bg-red-800 hover:bg-red-700 border-red-600')}"
                ${!lvOk ? 'disabled' : ''} onclick="toggleSherineWorld()">${!lvOk ? '等級不足（需 Lv40）' : (on ? '🙏 祈禱：關閉席琳的世界' : '🙏 祈禱：開啟席琳的世界')}</button>
            <div class="bg-slate-900/70 border ${mad ? 'border-rose-600' : 'border-slate-700'} rounded p-3 text-sm leading-relaxed">
                <div class="font-bold mb-1 ${mad ? 'c-sherine' : 'text-rose-300'}">🔥 瘋狂的席琳世界：目前 ${mad ? '<span class="text-rose-300">開啟</span>' : '<span class="text-slate-400">關閉</span>'}</div>
                <div class="text-slate-200 text-xs">極致試煉。怪物 HP×5、AC 降低（一般怪−10、頭目−20）、MR 提高（最多額外＋200）、命中×2、傷害×3、經驗/金錢×10，掉落與詞綴×5；<span class="c-sherine font-bold">套裝效果與席琳結晶掉率為一般席琳的 3 倍</span>。</div>
            </div>
            <button class="btn py-3 text-base font-bold ${!lvOk ? 'bg-slate-600 border-slate-500 opacity-60 cursor-not-allowed' : (mad ? 'bg-slate-700 hover:bg-slate-600 border-slate-500' : 'bg-rose-900 hover:bg-rose-800 border-rose-600')}"
                ${!lvOk ? 'disabled' : ''} onclick="toggleSherineMad()">${!lvOk ? '等級不足（需 Lv40）' : (mad ? '🙏 祈禱：關閉瘋狂的席琳世界' : '🔥 祈禱：開啟瘋狂的席琳世界')}</button>
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
    // 🔒 v3.5.87 閘門口徑＝扣除口徑（questCountId 排除鎖定件）：舊寫法 inv.some 不看 lock，
    //    鎖定的精通之證會「過閘但扣不到」→ 白拿 done 狀態、證還留在背包。
    if (questCountId('item_mastery_proof') < 1) {
        if (player.inv.some(i => i.id === 'item_mastery_proof' && i.lock)) logSys('精通之證已被上鎖，解鎖後才能交付。');
        return;
    }
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
    // 初次選擇免費；之後每次更換固定 300 萬金幣（不隨次數遞增）
    if (player.mastery !== null) {
        let cost = masteryChangeCost();
        if (player.gold < cost.gold) {
            logSys(`<span class="text-red-400 font-bold">更換精通需要 ${cost.gold.toLocaleString()} 金幣。</span>`);
            return;
        }
        // 更換前確認
        if (!confirm(`確定要將精通由「${md.list[player.mastery].n}」更換為「${md.list[id].n}」嗎？\n將消耗 ${cost.gold.toLocaleString()} 金幣。`)) return;
        player.gold -= cost.gold;
        player.masteryChangeCnt = (player.masteryChangeCnt || 0) + 1;
    }
    let prev = player.mastery;
    player.mastery = id;
    // 🏅 切換副作用
    if (prev === 'e_spirit' && player.summon && (player.summon.skId === 'sk_elf_summon' || player.summon.skId === 'sk_elf_summon2')) {
        player.buffs[player.summon.skId] = 0; player.summon = null;   // 精靈精通解除：收回已召喚屬性精靈
        logSys('屬性精靈隨著精通的轉移而消散了。');
    }
    // 🧝 v3.2.21 屬性精靈 v2：精靈精通解除→實體全數收回（自動施放勾選仍在→之後會重新召喚回一般型態）
    if (prev === 'e_spirit' && (player._summonV2Sk === 'sk_elf_summon' || player._summonV2Sk === 'sk_elf_summon2')
        && typeof summonV2List === 'function' && summonV2List().length && typeof summonV2DismissAll === 'function') {
        const _onA = player._summonV2On;
        summonV2DismissAll(true);
        player._summonV2On = _onA;   // 🧝 v3.2.42 稽核修：保留自動重施開關與勾選一致（比照下方切入精通分支·原本旗標被關但勾選仍在→旗標/UI 矛盾）
        logSys('屬性精靈隨著精通的轉移而消散了。');
    }
    // 👑 v3.2.25 切入精靈精通：在場的強力屬性精靈收回→自動重施時昇華為精靈王
    if (id === 'e_spirit' && prev !== 'e_spirit' && player._summonV2Sk === 'sk_elf_summon2'
        && typeof summonV2List === 'function' && summonV2List().length && typeof summonV2DismissAll === 'function') {
        const on = player._summonV2On;
        summonV2DismissAll(true);
        player._summonV2On = on;   // 保留自動重施開關→下個 tick 立即召回精靈王
        logSys('精靈之力開始昇華——強力精靈將以「精靈王」之姿重新現身。');
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
        let hasProof = questCountId('item_mastery_proof') >= 1;   // 🔒 v3.5.87 顯示口徑＝交付口徑（鎖定件不計）
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
        : `更換費用：<span class="text-yellow-300 font-bold">${cost.gold.toLocaleString()} 金幣</span>（固定費用）`;
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
    renderTownNPCMap(townId);   // 🏘️ v3.2.83 城鎮 NPC 改為地圖式動態站位（與狩獵框同尺寸·散佈景深·hover 名字·點擊開功能）
    let container = document.getElementById('town-npc-container');
    container.innerHTML = '';
    // 🗼🌀 v3.2.89 底部入口按鈕全取消：傲慢之塔／時空裂痕的進入選單改成地圖上的「告示 NPC」，點擊才跳浮動視窗（見 renderTownNPCMap）
    container.classList.add('hidden');
    // 🗑️ v3.5.87 移除註解掉的舊 NPC 卡片清單死碼（48 行）：其城堡血盟過濾漏 heine、typeIcon 表漏 warehouse、
    //    無 classicOnly 過濾——三處皆與現行單一真相 renderTownNPCMap 不符，留著只會誤導維護。
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

// ===== 🌑 v3.3.33 真‧冥皇丹特斯（長老會議廳·黑暗妖精聖地.md）：三選項入口 =====
//   進入 黑暗妖精聖地／受詛咒的黑暗妖精聖地＝各消耗 1 本 死亡騎士之書；交出 吉爾塔斯的封印＝消耗 1 個→傳送 崩壞的長老會議廳。
//   三張圖皆不在地圖選單（隱藏圖）→ 直接設定 mapState 進圖（仿 js/05 enterOblivionMap 的直接進圖流程）。
function _sanctItemCount(id) { let c = 0; player.inv.forEach(i => { if (i.id === id) c += (i.cnt || 1); }); return c; }
function _sanctConsume(id) {
    let i = player.inv.findIndex(x => x.id === id && (x.cnt || 1) >= 1);
    if (i < 0) return false;
    let it = player.inv[i];
    if ((it.cnt || 1) > 1) it.cnt -= 1; else player.inv.splice(i, 1);
    return true;
}
function sanctuaryEnter(mapKey, costId) {
    let d0 = DB.items[costId];
    if (!_sanctConsume(costId)) { logSys(`<span class="text-red-400">沒有 ${d0 ? d0.n : costId}，無法進入。</span>`); return; }
    logSys(`<span class="text-amber-300">你交出了 1 個 ${d0 ? d0.n : costId}，${mapKey === 'collapsed_elder_council_hall' ? '被傳送到了 崩壞的長老會議廳' : '踏入了 ' + (mapKey === 'dark_elf_sanctuary' ? '黑暗妖精聖地' : '受詛咒的黑暗妖精聖地')}……</span>`);
    closeNpcInteraction();
    try { if (typeof closeWarehouseWindow === 'function') closeWarehouseWindow(); } catch (e) {}   // 🏦 v3.5.94 本函式複製 changeMap 的戰鬥進場流程但不經過 changeMap；closeNpcInteraction 刻意不負責關倉庫(見其開頭註解)，故此處自行補上，否則浮動倉庫視窗會殘留到聖地並遮住 battle-view
    saveSiegeBossHp();
    mapState.current = mapKey;
    player.lastBattleMap = mapKey;
    mapState.mobs = [null, null, null, null, null];
    mapState.spawnAt = [null, null, null, null, null];
    mapState._sanctBossSpawned = false;   // 🌑 v3.4.18 重置「首次生成免費」旗標：入場費已付→首隻頭目免費，之後每次復活扣 1 入場道具(js/03 sanctBossRespawnCharge)
    mapState.targetIdx = -1;
    mapState.forceBoss = false;
    state._kbRespawnAt = null; state._kbVictory = false;
    if (typeof _vfxClearAll === 'function') _vfxClearAll();
    if (typeof auditReset === 'function') auditReset();
    let mapPanel = document.getElementById('town-view').parentElement;
    document.getElementById('battle-view').classList.remove('hidden');
    document.getElementById('combat-log-panel').classList.remove('hidden');
    document.getElementById('town-view').classList.add('hidden');
    document.getElementById('town-view').classList.remove('flex');
    mapPanel.classList.remove('flex-1', 'overflow-hidden');
    if (typeof applyAreaBackground === 'function') applyAreaBackground();
    renderMobs();
    syncMapSelectors();
    updateUI();
    renderTabs(true); saveGame();
}
function renderDantesGate(div) {
    let books = _sanctItemCount('item_dk_book'), seals = _sanctItemCount('item_giltas_seal'), orbs = _sanctItemCount('item_summonorb_full');
    div.innerHTML = `
        <div class="text-sm text-slate-300 space-y-2">
            <p>「嗚！嗚！嗚！……你也為了嘲笑我的愚蠢而來的嗎？<br><br>快離開吧，已經太遲了。」</p>
            <p class="text-xs text-slate-400">持有：死亡騎士之書 ×${books}．吉爾塔斯的封印 ×${seals}．完整的召喚球 ×${orbs}</p>
            <div class="space-y-2 pt-2">
                <button class="w-full text-left px-3 py-2 rounded bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-500/40 ${books < 1 ? 'opacity-50' : ''}" onclick="sanctuaryEnter('dark_elf_sanctuary','item_dk_book')">⚔️ 進入 黑暗妖精聖地</button>
                <button class="w-full text-left px-3 py-2 rounded bg-rose-900/60 hover:bg-rose-800 border border-rose-500/40 ${books < 1 ? 'opacity-50' : ''}" onclick="sanctuaryEnter('cursed_dark_elf_sanctuary','item_dk_book')">💀 進入 受詛咒的黑暗妖精聖地</button>
                <button class="w-full text-left px-3 py-2 rounded bg-purple-900/60 hover:bg-purple-800 border border-purple-500/40 ${seals < 1 ? 'opacity-50' : ''}" onclick="sanctuaryEnter('collapsed_elder_council_hall','item_giltas_seal')">👑 交出 吉爾塔斯的封印</button>
            </div>
            <p class="text-xs text-slate-500 pt-1">挑戰吉爾塔斯時若身上持有 完整的召喚球：戰敗回村將消耗 1 顆，吉爾塔斯的 HP 會保持不變（暫停回血）直到你再次進入；沒有完整的召喚球則重新進入將是全新的吉爾塔斯。</p>
        </div>`;
}
// 🕊️ v3.4.73 聖使阿卡塔（亞丁·經典限定）：死亡經驗買回。
//   ・killPlayer（js/04）只在「實際損失 > 0」時記 player.deathLog:{lv,loss,t}（上限 10 筆·滿了淘汰最舊·逐角色隨存檔）——當級 0% 死亡不建檔，無法買回沒失去的經驗。
//   ・買回：花費 死亡時等級×等級×1000 金幣 → 取回該筆「實際損失經驗」的 50%（floor），紀錄即銷毀；回灌走 player.exp += n + checkLvUp()（可正常升級）。
function renderArkataBuyback(el) {
    let log = Array.isArray(player.deathLog) ? player.deathLog : [];
    let rows = log.map((r, i) => {
        let cost = (r.lv || 1) * (r.lv || 1) * 1000;
        let back = Math.floor((r.loss || 0) * 0.5);
        let when = r.t ? new Date(r.t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        let ok = (player.gold || 0) >= cost;
        return `
            <div class="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-600 rounded p-3">
                <div class="text-sm text-slate-200 leading-relaxed">Lv <span class="text-amber-300 font-bold">${r.lv}</span> 陣亡${when ? `<span class="text-xs text-slate-500">（${when}）</span>` : ''}　損失 <span class="text-red-300 font-bold">${(r.loss || 0).toLocaleString()}</span> 經驗<br>
                    <span class="text-xs text-slate-400">買回 <span class="text-emerald-300 font-bold">${back.toLocaleString()}</span> 經驗（50%）・費用 <span class="text-yellow-300">${cost.toLocaleString()}</span> 金幣</span></div>
                <button class="btn ${ok ? 'bg-yellow-700 hover:bg-yellow-600 border-yellow-500' : 'bg-slate-600 border-slate-500 opacity-60 cursor-not-allowed'} py-2 px-4 font-bold shrink-0" ${ok ? '' : 'disabled'} onclick="arkataBuyback(${i})">買回</button>
            </div>`;
    }).join('');
    // 🕊️ v3.6.84 裝備贖回（兩模式皆可）：邪惡狀態死亡遺失的裝備（player.pvpLostItems·上限 5 件）花 1000 龍鑽指定贖回一件
    let lost = Array.isArray(player.pvpLostItems) ? player.pvpLostItems : [];
    let dia = (typeof pandoraGetSharedDiamonds === 'function') ? pandoraGetSharedDiamonds() : 0;
    let itemRows = lost.map((r, i) => {
        let d = r && r.item && DB.items[r.item.id];
        if (!d) return '';
        let nm = (typeof getItemFullName === 'function') ? getItemFullName(r.item) : d.n;
        let cl = (typeof getItemColor === 'function') ? getItemColor(r.item) : 'text-white';
        let when = r.t ? new Date(r.t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        let ok = dia >= ARKATA_REDEEM_COST;
        return `
            <div class="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-600 rounded p-3">
                <div class="text-sm leading-relaxed"><span class="${cl} font-bold">${nm}</span>${when ? `<span class="text-xs text-slate-500">（${when} 遺失）</span>` : ''}<br>
                    <span class="text-xs text-slate-400">贖回費用 <span class="text-sky-300 font-bold">${ARKATA_REDEEM_COST.toLocaleString()}</span> 龍之鑽石</span></div>
                <button class="btn ${ok ? 'bg-sky-800 hover:bg-sky-700 border-sky-500' : 'bg-slate-600 border-slate-500 opacity-60 cursor-not-allowed'} py-2 px-4 font-bold shrink-0" ${ok ? '' : 'disabled'} onclick="arkataRedeemItem(${i})">贖回</button>
            </div>`;
    }).join('');
    el.innerHTML = `
        <div class="flex flex-col gap-3 p-1">
            <div class="text-slate-300 text-sm leading-relaxed">聖使阿卡塔：逝者失去的事物不會真正消散——我能以聖光為你凝聚回來。</div>

            <div class="text-sky-300 font-bold text-sm border-b border-sky-900/60 pb-1">裝備贖回</div>
            <div class="text-xs text-slate-400">邪惡狀態下死亡遺失的裝備會被記錄：${lost.length} / 5（滿 5 件後新的遺失會擠掉最舊的一筆）・持有龍之鑽石：<span class="text-sky-300">${dia.toLocaleString()}</span></div>
            ${itemRows || '<div class="text-slate-500 text-sm bg-slate-800/40 border border-slate-700 rounded p-4 text-center">目前沒有遺失的裝備紀錄。</div>'}
            ${player.classicMode ? `
            <div class="text-amber-300 font-bold text-sm border-b border-amber-900/60 pb-1 mt-2">死亡經驗買回</div>
            <div class="text-xs text-slate-400">每筆死亡紀錄可花費「死亡時等級×等級×1000」金幣，取回實際損失經驗的一半。死亡紀錄：${log.length} / 10（滿 10 筆後新的死亡會擠掉最舊的一筆）・持有金幣：<span class="text-yellow-300">${(player.gold || 0).toLocaleString()}</span></div>
            ${rows || '<div class="text-slate-500 text-sm bg-slate-800/40 border border-slate-700 rounded p-4 text-center">目前沒有死亡紀錄。願聖光持續眷顧你。</div>'}` : ''}
        </div>`;
}
const ARKATA_REDEEM_COST = 1000;   // 🕊️ v3.6.84 裝備贖回費用（龍之鑽石）
// 🕊️ v3.6.84 指定贖回一件遺失裝備：扣 1000 龍鑽 → 以**完整快照**還原（強化值/祝福/遠古/屬性全保留），紀錄即銷毀。
//   ⚠️ 先驗物品有效性、再扣款、最後才 splice+回灌——順序顛倒會出現「扣了鑽石卻沒拿到東西」。
function arkataRedeemItem(i) {
    let list = Array.isArray(player.pvpLostItems) ? player.pvpLostItems : [];
    let rec = list[i];
    let host = document.getElementById('interaction-content');
    if (!rec || !rec.item || !DB.items[rec.item.id]) { list.splice(i, 1); if (host) renderArkataBuyback(host); return; }   // 防呆：物品定義已不存在→銷毀無效紀錄
    if (typeof pandoraGetSharedDiamonds !== 'function' || typeof pandoraAdjustSharedDiamonds !== 'function') { logSys('<span class="text-red-400">龍之鑽石系統尚未載入，請重新整理後再試。</span>'); return; }
    if (pandoraGetSharedDiamonds() < ARKATA_REDEEM_COST) { logSys(`<span class="text-red-400">龍之鑽石不足（需要 ${ARKATA_REDEEM_COST.toLocaleString()}）。</span>`); return; }
    let pay = pandoraAdjustSharedDiamonds(-ARKATA_REDEEM_COST);
    if (!pay || !pay.ok) { logSys(`<span class="text-red-400">${(pay && pay.error) || '扣款失敗，請再試一次。'}</span>`); return; }
    let snap = JSON.parse(JSON.stringify(rec.item));
    list.splice(i, 1);   // 先銷毀紀錄再回灌，杜絕重複贖回
    snap.uid = uid(); snap.cnt = 1; snap.lock = false; snap.junk = false;
    player.inv.push(snap);
    if (typeof registerEquipObtained === 'function') registerEquipObtained(snap.id);   // 直推 inv 繞過 gainItem → 手動補收集冊登錄與掉落統計
    if (typeof auditTrackGain === 'function') auditTrackGain({ id: snap.id, cnt: 1 });
    let nm = (typeof getItemFullName === 'function') ? getItemFullName(snap) : (DB.items[snap.id] ? DB.items[snap.id].n : snap.id);
    logSys(`<span class="text-sky-300">聖使阿卡塔以聖光為你尋回了 <span class="font-bold">${nm}</span>（花費 ${ARKATA_REDEEM_COST.toLocaleString()} 龍之鑽石）。</span>`);
    if (typeof renderTabs === 'function') renderTabs();
    updateUI(); saveGame();
    if (host) renderArkataBuyback(host);
}
function arkataBuyback(i) {
    if (!player || !player.classicMode) return;   // 🕊️ 經典限定（縱深防護）
    let log = Array.isArray(player.deathLog) ? player.deathLog : [];
    let r = log[i];
    if (!r) return;
    let cost = (r.lv || 1) * (r.lv || 1) * 1000;
    let back = Math.floor((r.loss || 0) * 0.5);
    if (back <= 0) { log.splice(i, 1); renderArkataBuyback(document.getElementById('interaction-content')); return; }   // 防呆：無效紀錄直接銷毀
    if ((player.gold || 0) < cost) { logSys('金幣不足，無法買回經驗。'); return; }
    player.gold -= cost;
    log.splice(i, 1);   // 先銷毀紀錄再回灌，杜絕重複領取
    player.exp += back;
    checkLvUp();
    logSys(`<span class="text-emerald-300">聖使阿卡塔為你凝聚回 ${back.toLocaleString()} 點經驗（花費 ${cost.toLocaleString()} 金幣）。</span>`);
    if (typeof calcStats === 'function') calcStats();
    updateUI(); saveGame();
    renderArkataBuyback(document.getElementById('interaction-content'));
}

// 🏴 潘朵拉黑市快捷鍵：不切換地圖，直接沿用村莊 NPC 的同一個浮動視窗與市場狀態。
// 浮動視窗原本位於 #town-view；狩獵中父層會隱藏，因此首次使用時移至 body，之後所有 NPC 互動仍共用此視窗。
function openPandoraShortcut() {
    let panel = document.getElementById('town-interaction-container');
    if (!panel) return;
    if (panel.parentElement && panel.parentElement.id === 'town-view') document.body.appendChild(panel);
    interactNPC('npc_pandora', 'town_talking');
}

function interactNPC(npcId, townId) {
    let npc = DB.towns[townId].npcs.find(n => n.id === npcId);
    if(!npc) return;
    if ((npc.id === 'npc_esti' || npc.id === 'npc_tros') && typeof clanNpcVisible === 'function' && !clanNpcVisible(npc.id, townId)) return;
    if (npc.classicHide && player.classicMode) return;   // 🔥 經典模式：漢 不可互動（縱深防護，正常情況卡片已不渲染；v3.0.77 碧恩經典可用）
    if (npc.classicOnly && !player.classicMode) return;   // 🕊️ 經典限定 NPC（聖使阿卡塔）：一般模式不可互動（縱深防護，渲染層已過濾）
    _activePanel = null;   // 開啟新面板：先清除自動刷新標記，由對應 render 視需要重新設定

    // 🔧 v2.6.77 倉庫 NPC：浮動倉庫直接覆蓋在村莊 NPC 清單上，不切入舊式 NPC 互動畫面
    //    → 關閉倉庫後直接回到村莊頁面，不會再露出「返回村莊」的互動頁（參考用戶 2667 修正版）
    if (npc.type === 'warehouse' && typeof openWarehouseWindow === 'function') {
        openWarehouseWindow();
        return;
    }

    // 🏘️ v3.2.88 NPC 功能改浮動視窗(position:fixed·z 高於地圖)：不再隱藏地圖，視窗直接浮在動態 NPC 之上（比照倉庫）
    document.getElementById('town-interaction-container').classList.remove('hidden');
    document.getElementById('town-interaction-container').classList.add('flex');
    
    document.getElementById('interaction-npc-name').innerText = ((npc.id === 'npc_esti' || npc.id === 'npc_tros') && typeof clanNpcDisplayName === 'function') ? clanNpcDisplayName() : npc.n;
    document.getElementById('interaction-npc-title').innerText = `[${npc.title}]`;
    
    let contentDiv = document.getElementById('interaction-content');
    contentDiv.innerHTML = '';

    // 根據 NPC 的類型，載入不同的 UI
    if (npc.type === 'shop' || npc.id === 'npc_gilen') {
        renderTownShop(contentDiv, npc.id);
    } else if (npc.id === 'npc_arena') {   // ⚔️ 鬥技場管理者 巴魯特：存檔 PvP 對戰名片／決鬥競技場（古魯丁村莊·js/28）
        renderPvpArenaNPC(contentDiv);
    } else if (npc.id === 'npc_arkata') {   // 🕊️ 聖使阿卡塔：死亡經驗買回（亞丁·經典限定）
        renderArkataBuyback(contentDiv);
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
    } else if (['npc_nalien', 'npc_rekne', 'npc_narupa', 'npc_elfqueen', 'npc_elf', 'npc_ent', 'npc_pan', 'npc_moliya', 'npc_hector', 'npc_herbert', 'npc_lumiel', 'npc_ibelbin', 'npc_tas', 'npc_robinson', 'npc_kupu', 'npc_lentis', 'npc_upni', 'npc_bamut', 'npc_flame_shadow', 'npc_imp', 'npc_flame_smith', 'npc_norse', 'npc_keluya', 'npc_dytite', 'npc_bartel', 'npc_pir', 'npc_zeus_golem', 'npc_rabiani', 'npc_david', 'npc_flame_aide', 'npc_kororanz', 'npc_sebas', 'npc_mystic_mage', 'npc_atelier'].includes(npc.id)) {
        renderUniversalCraft(contentDiv, npc.id);
    } else if (npc.id === 'npc_dantes_lord') {   // 🌑 真‧冥皇丹特斯：聖地入口三選項
        renderDantesGate(contentDiv);
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
    } else if (npc.id === 'npc_bian') {
        renderBianAttr(contentDiv);   // 🔥 v3.0.77 碧恩改「賦予屬性」（克里斯特已移除）
    } else if (npc.id === 'npc_ismael') {
        renderIsmaelExchange(contentDiv);
    } else if (npc.id === 'npc_sherine') {
        renderSherinePray(contentDiv);
    } else if (npc.id === 'npc_io') {
        renderIoExchange(contentDiv);   // 🦴 v3.1.68 伊奧：席琳結晶兌換遺骸
    } else if (npc.id === 'npc_lachesis') {
        renderLachesisSplit(contentDiv);   // 🦴 v3.1.68 菈克希絲：穿著裝備拆分席琳詞綴→遺骸
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
        renderWarehouseNPC(contentDiv);   // 🔧 v2.6.77 正常情況已在 interactNPC 開頭早退開浮動倉庫；此分支僅剩 openWarehouseWindow 不存在時的舊式後備
    } else if (npc.type === 'petstore') {   // 🐾 v3.7.7 改依 type 分派（包武／奧斯丁共用同一個保管桶）——新增寵物保管 NPC 不必再回來加 id
        try { if (typeof _petRosterResync === 'function') _petRosterResync(); } catch (e) {}   // 🔄 開啟寵物保管前先與共用桶同步（顯示別角色最新裝備/出戰狀態·防過期鏡像）
        renderPetStorageNPC(contentDiv);
    } else if (npc.id === 'npc_isba') {
        renderIsbaTravel(contentDiv);
    } else if (npc.id === 'npc_doll_merchant') {
        renderCardSynth(contentDiv);
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
    // ⚠️ 勿在此關閉浮動倉庫視窗：本函式在城鎮內「切換 NPC 面板」時也會被呼叫，
    //    那樣會變成點任何一個 NPC 都把倉庫關掉。倉庫的關閉點在 changeMap 的「離開安全區」分支。
    document.getElementById('town-interaction-container').classList.add('hidden');
    document.getElementById('town-interaction-container').classList.remove('flex');
    { let _m = document.getElementById('town-npc-map'); if (_m) _m.classList.remove('hidden'); }   // 🏘️ v3.2.83 關閉功能視窗→重新顯示地圖
    // NPC 底列容器：v3.2.89 起恆為空（傲慢之塔/時空裂痕入口改地圖告示 NPC＋浮動視窗），維持收合即可
    { let _c = document.getElementById('town-npc-container'); if (_c) _c.classList.add('hidden'); }   // 🗑️ v3.5.87 原 children.length 判斷恆 0·簡化
}

// ================= 🏘️ v3.2.83 城鎮 NPC 地圖系統 =================
// 依 Downloads/NPC 資料夾轉出的站立序列幀(assets/npc/<gfx>/idle_N.png·單一面向鏡頭方向)，
// 在與狩獵框同尺寸(800×450)的城鎮地圖上，以「散佈景深」動態排列 NPC；hover 顯示名字、點擊沿用 interactNPC 開啟功能。
// 有名字的 NPC → 專屬 sprite；未命名者 → 依功能借用同類 sprite，並保證同城鎮不重複長相。
// 🏘️ v3.2.90 NPC 一律以「原始圖片尺寸」渲染（不設 height·1:1 像素·mul 欄位停用）；天堂原生比例＝人形約 20×55px·巨型NPC(安特/炎魔系/高崙)本來就大隻
// sprite 目錄表：key(通常＝gfx) → { g:資料夾, f:幀數, mul?:高度倍率, tint?:CSS filter }
const NPC_SPR = {
    '1045': { g: '1045', f: 8 }, '51': { g: '51', f: 4 }, '237': { g: '237', f: 6 }, '261': { g: '261', f: 4 },
    '902': { g: '902', f: 6 }, '866': { g: '866', f: 6 }, '847': { g: '847', f: 6, mul: 1.35 }, '1762': { g: '1762', f: 8, mul: 1.1, w: 8 },   // 🔥 w:8＝火焰武器層 idle_w(宙斯之熔岩高崙燃燒特效)
    '1788': { g: '1788', f: 6 }, '2524': { g: '2524', f: 8 }, '118': { g: '118', f: 4 }, '31': { g: '31', f: 4, mul: 0.8 }, '31b': { g: '31b', f: 3, mul: 0.8 },
    '457': { g: '457', f: 6 }, '460': { g: '460', f: 6 }, '875': { g: '875', f: 12 },   // 🏦 v3.4.77 '54'（舊倉庫侏儒外觀）定義移除·assets/npc/54 已刪——外觀正式退役（POOL/FALLBACK 已於 v3.4.75 除役）
    '98': { g: '98', f: 6 }, '949': { g: '949', f: 6 }, '100': { g: '100', f: 6 }, '854': { g: '854', f: 16, mul: 0.72 },
    '854q': { g: '854', f: 16, mul: 0.86, tint: 'sepia(.55) saturate(1.7) hue-rotate(-18deg) brightness(1.12) drop-shadow(0 3px 2px rgba(0,0,0,.55))' },
    '916': { g: '916', f: 6 }, '920': { g: '920', f: 7 }, '918': { g: '918', f: 6 }, '864': { g: '864', f: 6, mul: 1.05 },
    '727': { g: '727', f: 6 }, '914': { g: '914', f: 6 }, '1256': { g: '1256', f: 8 }, '1307': { g: '1307', f: 8 },
    '1049': { g: '1049', f: 6 }, '1305': { g: '1305', f: 8 }, '1314': { g: '1314', f: 6 }, '1768': { g: '1768', f: 8 },
    '1254': { g: '1254', f: 6 }, '1276': { g: '1276', f: 21 }, '1278': { g: '1278', f: 13 }, '1766': { g: '1766', f: 13 },
    '3858': { g: '3858', f: 12 }, '1222': { g: '1222', f: 8 }, '2538': { g: '2538', f: 10, mul: 1.3 }, '2540': { g: '2540', f: 10, mul: 1.3 },
    '1148': { g: '1148', f: 1 }, '1149': { g: '1149', f: 1 },   // 🗼🌀 v3.2.89 傲慢之塔／時空裂痕 入口告示（點擊開浮動視窗）
    '2725': { g: '2725', f: 1 },   // 🌳 v3.2.90 迷幻森林之母＝妖精石像（用戶提供 NPC/迷幻森林之母/2725-0·88×96 單幀）
    '3227': { g: '3227', f: 12 }, '3225': { g: '3225', f: 12 },   // 👑 v3.2.91 依詩蒂＝公主(3227)／特羅斯＝王子(3225)·職業動畫 dir5 站立(12f)
    // 🆕 v3.3.7 指定名稱 NPC 專屬外型（body＋真實影子 sprite）＋女性外型池新增 6804
    '1839': { g: '1839', f: 9 }, '2813': { g: '2813', f: 9 }, '2794': { g: '2794', f: 9 }, '2829': { g: '2829', f: 11 },
    '2801': { g: '2801', f: 8 }, '2820': { g: '2820', f: 15 }, '6899': { g: '6899', f: 12 }, '6757': { g: '6757', f: 12 },
    '6690': { g: '6690', f: 12 }, '6804': { g: '6804', f: 12 },
    '5454': { g: '5454', f: 1 },   // 🌑 v3.3.33 真‧冥皇丹特斯＝骸骨王座坐像（NPC/真‧冥皇丹特斯 5454-0＋影子 5455-0·單幀 138×228）
    '2141': { g: '2141', f: 6 },   // 🕊️ v3.4.73 聖使阿卡塔（body 2141＋影 2142·6幀·29×59）
    '10669': { g: '10669', f: 3 }   // 🏦 v3.4.74 朵琳＝倉庫NPC通用新外型（body 10669＋影 10670·3幀·67×44 帶雙寶箱·取代舊 54）
};
// 有名字的 NPC → 專屬 sprite（＋依功能固定共用者：魔物追蹤/城堡護衛已於下方 role 邏輯處理）
const NPC_SPR_FIXED = {
    npc_isba: '1045', npc_gilen: '237', npc_joel: '261', npc_elpin: '902', npc_narupa: '866', npc_ent: '847',
    npc_zeus_golem: '1762', npc_keluya: '1788', npc_imp: '2524', npc_basin: '118', npc_brabo: '31b', npc_mother: '2725', npc_ladal: '457',
    npc_falin: '460', npc_pan: '875', npc_pandora: '98', npc_linda: '949', npc_gunter: '100', npc_elf: '854',
    npc_elfqueen: '854q', npc_robinson: '916', npc_elion: '920', npc_wh_elf: '918', npc_rekne: '864', npc_ryan: '727',
    npc_nalien: '914', npc_flame_shadow: '2538', npc_flame_aide: '2540', npc_flame_smith: '1768',
    npc_esti: '3227', npc_tros: '3225',   // 👑 v3.2.91 血盟 依詩蒂＝公主動畫(f_royal)／特羅斯＝王子動畫(m_royal)·全城鎮通用
    // 🆕 v3.3.7 指定名稱 NPC 專屬外型（用戶提供 Downloads/NPC/<名>·避免與通用池撞臉）：
    npc_kupu: '1839', npc_rabiani: '1307', npc_runde: '2813', npc_kang: '2794', npc_brudica: '2829',
    npc_skvati: '2801', npc_saedia: '2820', npc_shenien: '6899', npc_bartel: '6757', npc_sphere: '6690',
    npc_dantes_lord: '5454', npc_atelier: '1768',   // 🌑 v3.3.33 長老會議廳：真‧冥皇丹特斯＝骸骨王座／亞提利歐＝矮人鐵匠（用戶指定·同炎魔鐵匠外型 1768）
    npc_arkata: '2141',   // 🕊️ v3.4.73 聖使阿卡塔（亞丁·經典限定·死亡經驗買回）
    npc_arena: '1305',    // ⚔️ v3.7.5 鬥技場管理者 巴魯特（古魯丁村莊·甲冑武人外型·決鬥競技場入口）
    // 魔物追蹤三兄弟共用 cray；港口/寵物保管等亦可指定
    npc_obel: '1049', npc_hert: '1049', npc_diren: '1049'
};
// 依 NPC.type 的通用 sprite 池（未命名者依序取「同城鎮尚未使用」的第一個）
const NPC_SPR_POOL = {
    shop: ['1256', '1307'],
    craft: ['1314', '1768', '1305'],
    quest: ['1254', '1278', '1766', '3858', '1276'],
    exchange: ['1049', '1256'],
    pledge: ['3858', '1766'],
    bless: ['1788'], pray: ['918'], mastery: ['1222'], synth: ['1307'], skill: ['237'], travel: ['1045'], petstore: ['100', '727']   // 🐾 v3.4.75 包武(petstore)原池['54']＝舊倉庫寶箱造型·v3.4.74 倉庫改用10669後54被釋出→包武誤拿寶箱圖；改人類外型(甘特/萊恩)·54 全面除役
};
// 依 type 的單一固定 sprite（每城鎮至多一個→恆不重複）
const NPC_SPR_ROLE = { warehouse: '10669', ally: '51', castleguard: '1222' };   // 🏦 v3.4.74 倉庫通用外型 54→10669（朵琳新造型·妖精森林倉庫=npc_wh_elf 走 FIXED '918' 不受影響）
// 全域後備順序（池與 role 都耗盡時取用；人形/商販在前、怪物型在後，避免奇怪配對）
const NPC_SPR_FALLBACK = ['1256', '1307', '1314', '1768', '1305', '1254', '1278', '1766', '3858', '1276',
    '237', '261', '902', '1045', '457', '460', '727', '914', '916', '918', '920', '949', '100', '118', '1788', '1222', '1049',
    '866', '875', '1762', '864', '2524', '2538', '2540', '31', '847', '854'];   // 🐾 v3.4.75 '54'（舊倉庫寶箱造型）自後備清單除役——任何 NPC 不再分到此外型
// 👩 v3.2.98 依 NPC 名字性別配對外型（用戶指示：女性名套女性外型、男性名套男性外型）
//   NPC_SPR_FEMALE＝「外型明顯女性」的 sprite key（女角優先取、男角一律跳過）；918 端莊袍＝中性不列入。
const NPC_SPR_FEMALE = new Set(['98', '949', '1307', '3858', '854q', '3227', '866', '864', '6804']);
//   女角專屬取用順序（端莊女裝在前）；男角改走原池但跳過上面的女性外型。6804＝v3.3.7 用戶新增女性外型
const NPC_SPR_FEMALE_POOL = ['949', '1307', '3858', '98', '6804'];
//   依名字判定為女性的城鎮 NPC（未列者＝男性/中性·走原邏輯並避開女性外型）。⚠️新增女性名 NPC 補這裡。
const NPC_FEMALE_IDS = new Set([
    'npc_shenien', 'npc_yuria', 'npc_lachesis', 'npc_moliya', 'npc_moli', 'npc_saedia',
    'npc_brudica', 'npc_sherine', 'npc_io', 'npc_masha', 'npc_doll_merchant',
    'npc_lumiel',   // 🚺 v3.3.6 海音 琉米埃爾＝女性外型
    'npc_lucy'      // 🚺 v3.7.7 古魯丁 露西（雜貨商人）＝女性外型
]);

function _npcSpriteKey(npc, usedSet) {
    if (NPC_SPR_FIXED[npc.id]) return NPC_SPR_FIXED[npc.id];
    if (NPC_SPR_ROLE[npc.type]) return NPC_SPR_ROLE[npc.type];   // 倉庫/協力/城堡護衛：每城鎮唯一
    let fem = NPC_FEMALE_IDS.has(npc.id);
    if (fem) {   // 👩 女角優先取女性外型：起點依名字 id 決定論偏移→跨城鎮不會全是同一個女裝、同城鎮仍靠 used 去重
        let off = 0, L = NPC_SPR_FEMALE_POOL.length;
        for (let i = 0; i < npc.id.length; i++) off = (off + npc.id.charCodeAt(i)) % L;
        for (let n = 0; n < L; n++) { let k = NPC_SPR_FEMALE_POOL[(off + n) % L]; if (!usedSet.has(k) && NPC_SPR[k]) return k; }
    }
    let pool = NPC_SPR_POOL[npc.type] || [];
    if (pool.length) {   // 🎲 v3.3.7 依名字決定論偏移起點→同型別 NPC 不再全取 pool[0]（降低單一外型跨城鎮過度重複；用完仍靠 used 去重、跳過女性外型）
        let po = 0, PL = pool.length;
        for (let i = 0; i < npc.id.length; i++) po = (po + npc.id.charCodeAt(i)) % PL;
        for (let n = 0; n < PL; n++) { let k = pool[(po + n) % PL]; if (!usedSet.has(k) && NPC_SPR[k] && (fem || !NPC_SPR_FEMALE.has(k))) return k; }   // 男角跳過女性外型
    }
    for (const k of NPC_SPR_FALLBACK) if (!usedSet.has(k) && NPC_SPR[k] && (fem || !NPC_SPR_FEMALE.has(k))) return k;
    for (const k of NPC_SPR_FALLBACK) if (!usedSet.has(k) && NPC_SPR[k]) return k;   // 真的用光→放寬(含女性外型)避免沒圖
    return '1256';
}

let _npcFrameCache = {};
function _npcFrames(key) {
    if (_npcFrameCache[key]) return _npcFrameCache[key];
    let cat = NPC_SPR[key], arr = [];
    if (cat) for (let i = 0; i < cat.f; i++) { let im = new Image(); im.src = 'assets/npc/' + cat.g + '/idle_' + i + '.png'; arr.push(im); }
    _npcFrameCache[key] = arr;
    return arr;
}
let _npcWeaponFrameCache = {};
function _npcWeaponFrames(key) {   // 🔥 火焰/武器疊層幀(idle_w_N)：僅 NPC_SPR 有 w 的（如宙斯之熔岩高崙）·與本體同幀數同步
    if (_npcWeaponFrameCache[key]) return _npcWeaponFrameCache[key];
    let cat = NPC_SPR[key], arr = [];
    if (cat && cat.w) for (let i = 0; i < cat.w; i++) { let im = new Image(); im.src = 'assets/npc/' + cat.g + '/idle_w_' + i + '.png'; arr.push(im); }
    _npcWeaponFrameCache[key] = arr;
    return arr;
}

// 🏘️ v3.2.90 逐城手工站位表（依 1920×1080 背景圖逐張檢視空地標定·%座標＝腳點·避開建築/牆面/水面/樓梯/柱台）
//   順序＝由中央往外；NPC 數超過表長時回繞並向右下微移。未列城鎮(3攻城城堡=無專屬圖)走 fallback 置中帶。
// 🏘️ v3.3.28 逐城依 1920×1080 背景圖重排（用戶要求「站位分開·不站在正常人不該站的地方·各有生活感」）：
//   每格 index 對應 DB.towns[town].npcs 的順序（vis 過濾後）→ 依 NPC 身分放到地標旁（商人靠攤位/店門、倉庫靠庫房、
//   鐵匠靠鍛造爐、港口靠碼頭、試煉靠大殿階梯…）；全部落在可行走地面（路面/廣場/沙地/甲板），避開水域/屋頂/岩漿/水晶。
const TOWN_NPC_SPOTS = {
    // 銀騎士村莊：格林=左長屋店門前｜高特=右穀倉貨車旁｜茉莉=左下工作棚｜芬=箭靶訓練場｜喬爾=武器架旁｜瑞奇=大宅門前｜雷德=水井邊
    town_silver_knight: [[20, 60], [79, 56], [39, 77], [25, 80], [52, 36], [64, 36], [41, 36]],   // 🎯 v3.4.79 茉莉(製作·第3位)[16,75]→[39,77]：右下移出圍欄工作區到中央廣場（用戶箭頭指示）
    // 說話之島：吉倫=左上大屋門廊｜巴辛=水井邊｜朵琳=左中小屋門前｜潘朵拉=中央大屋遮陽棚攤位｜拉達爾=漁棚前院草地(v3.3.32勿站進棚內)｜法林=曬網架旁｜萊恩=沙灘小船邊｜詹姆/甘特=主路上｜尤麗婭=大屋門前｜拉比安尼=右下茅屋前
    town_talking: [[24, 40], [48, 40], [20, 63], [51, 82], [82, 41], [67, 34], [60, 23], [38, 62], [45, 75], [62, 89], [80, 88]],   // 🏦 v3.4.78 朵琳(倉庫·第3位)[14,57]→[20,63]：右下移出屋前台階到空地（用戶箭頭指示）
    // 妖精森林：埃爾頻=左階梯下空地｜艾爾=主殿門前｜琳達=舞台前｜艾利溫=右側林間石徑｜那翰/娜魯帕=林間空地｜精靈女皇(override)｜精靈=花圃間｜安特(override釘右上)｜潘/芮克妮=空地｜布拉伯=右下屋門廊｜羅賓孫=左下樹屋平台｜迷幻森林之母=右中開闊地(巨石像)
    town_elf: [[30, 48], [42, 33], [57, 30], [72, 34], [22, 60], [69, 49], [48, 62], [44, 74], [84, 43], [55, 70], [30, 72], [84, 74], [15, 88], [63, 63]],   // 🎯 艾利溫右移出安特點擊範圍；羅賓孫(第13位)維持圓形木平台
    // 奇岩城鎮：邁爾/范吉爾/愛弗特=右下市集攤棚各一攤｜溫諾=攤棚上方廣場路面(v3.3.32勿站攤頂)｜莫麗雅/海克特=噴泉兩側｜哈巴特=公會階梯前｜倫提斯=左教堂門廊｜賽巴斯=右上綠籬步道｜蘇瑞耳=圓頂庫房右側街面(v3.3.32勿貼圓頂)
    town_giran: [[69, 81], [81, 56], [88, 79], [57, 88], [38, 66], [54, 66], [66, 42], [19, 39], [58, 33], [24, 84]],   // 🎯 v3.4.79 倫提斯(製作·第8位)[14,36]→[19,39] 移出教堂門廊到路面＋蘇瑞耳(倉庫·第10位)[22,81]→[24,84] 移出圓頂庫房牆邊（用戶箭頭指示）
    // 海音城鎮(運河水都)：比特=左下通往碼頭的街面｜哈金=上排庫房前街面｜傭兵公會=右上建築左側路面｜琉米埃爾=花壇右下路面(勿站上花壇)｜多文=中央廣場｜依詩蒂=橋頭左側廣場(勿站上橋)｜依斯巴=木棧碼頭板上(港口)
    town_heine: [[29, 67], [41, 26], [56, 29], [22, 41], [50, 50], [62, 45], [28, 88]],
    // 亞丁城鎮(白石王都)：拉溫=左宅邸前｜恬金=右上宮殿階梯｜烏普尼=噴泉台階旁｜諾斯=中央羅盤地磚｜包武=右下拱廊前｜聖使阿卡塔=左上迴廊前(經典限定)
    town_aden: [[19, 62], [76, 30], [64, 48], [42, 68], [69, 77], [31, 40]],
    // 歐瑞村莊(雪山村·v3.3.32 依用戶截圖箭頭校正四點全下到路面)：畢伍德=右屋前雪路｜希林=上方倉庫門前地面｜傭兵公會=村中央｜伊貝爾賓=左屋前空地(勿站台階)｜大衛=右屋角前雪路｜特羅斯=左下柴堆路口
    town_oren: [[63, 52], [53, 29], [45, 55], [33, 49], [77, 59], [22, 72]],
    // 燃柳村莊：歐斯=鍛造屋前院(火爐鐵砧旁)
    town_gludio: [[62, 36]],
    // 古魯丁村莊(港口村)：巴魯特=廣場中左空地｜凱倫=左側藍屋大宅前石板路｜露西=左下攤棚前路面｜傭兵公會=廣場中右｜奧斯丁=水井左下石地
    //   ⚠️[50,58] 是叫賣玩家固定點（TOWN_WANDERING_BUYER_SPOTS.town_gludin 同座標），NPC 一律避開。
    town_gludin: [[38, 58], [23, 46], [33, 81], [70, 55], [48, 36]],
    // 威頓村莊(火山村)：馬沙=大宅階梯前｜漢=村中央｜客盧亞=左上屋簷攤棚｜宙斯之熔岩高崙=左下鍛造爐(自家熔爐)｜魔法娃娃商人=右下屋前｜艾斯倫=右側貨箱堆旁
    town_witon: [[70, 37], [48, 52], [27, 40], [13, 72], [66, 79], [77, 48]],
    // 希培利亞(天空神殿)：倉管=左上殿門階梯｜史菲爾=上方大殿門前｜巴特爾=右側步道橋頭｜希蓮恩=中央圓形圖紋
    town_hyperia: [[15, 32], [48, 24], [68, 56], [48, 55]],
    // 象牙塔：帕羅=左階梯平台｜塔拉斯=上廳地磚(v3.3.32勿站上層平台)｜塔斯=星紋左側｜巴耶斯=右書牆前｜碧恩=右上水晶祭壇階下(賦屬)｜迪嘉勒廷=大階梯底｜迪泰特=中央星紋｜神秘的魔法師=閱讀角書桌右側地磚(v3.3.32勿站桌區)
    town_ivory_tower: [[20, 60], [35, 31], [38, 55], [78, 50], [76, 28], [62, 32], [52, 58], [89, 76]],
    // 🌑 長老會議廳(環形議場·v3.3.33)：真‧冥皇丹特斯=上方大門前階台(骸骨王座坐像)｜亞提利歐=中央星紋右側石板
    town_elder_council: [[50, 38], [63, 60]],
    // 席琳神殿(圓形劇場遺跡)：席琳=劇場圓台中央(祈禱)｜伊奧=十字路星紋｜菈克希絲=左上拱門前；避開四處水池
    town_sherine: [[67, 48], [42, 64], [16, 33]],
    // 沉默洞穴(黑妖地城)：史克瓦提=左圓頂殿門廊｜雷亞斯=右上樓閣門前｜賽帝亞=大階梯底｜庫普=廣場左｜可羅蘭斯=左下禮拜堂前｜倫得=中央星紋｜康=右下高台走道｜布魯迪卡=廣場右；避開水晶簇/吊橋
    town_silent: [[19, 44], [72, 37], [36, 35], [40, 58], [35, 80], [52, 50], [78, 68], [63, 60]],
    // 貝希摩斯(熔岩要塞)：倉管=左閘門房｜森帕爾=大階梯底｜皮爾=右走道方尖碑旁｜普洛凱爾=中央紋章
    town_behemoth: [[28, 44], [55, 32], [66, 62], [44, 56]],
    // 炎魔謁見所：炎魔之影=中央紋章｜小惡魔=左下台階｜炎魔鐵匠=左壁爐火(鍛造)｜輔佐官=紅毯王座階下；避開岩漿
    town_flame_audience: [[48, 60], [24, 80], [18, 42], [70, 32]],
    // 海賊島村莊：波尼=沙灘小屋遮陽棚攤位前｜庫得=左高腳倉庫棧橋樓梯下(木桶堆)｜希米哲=右側水井邊
    town_pirate_village: [[50, 28], [28, 40], [73, 36]],
    // 傲慢之塔1樓：雜貨商人=左召喚法陣邊｜巴姆特=右階梯底｜入口告示=中央菱形法陣
    town_pride: [[24, 62], [72, 48], [49, 58]],
    // 時空裂痕入口：入口告示=中央圓形石紋
    town_rift: [[48, 58], [30, 50], [66, 46]],
    // 🏰 v3.3.9 三攻城城堡（用戶新補背景圖·依圖避開牆壁/水池/柱子/王座/側房家具）
    // 🏰 三座城堡：每格對應原始 NPC 索引，最後一格預留叫賣玩家。避免 vis 過濾後或叫賣玩家加入時，_townNpcLayout 回繞到前排造成重疊。
    //   各點均落在大廳的石地或地毯，避開牆面、柱子、欄杆、桌椅與水池；實際同時顯示的 NPC 最短間距約 8% 以上。
    //   肯特：盟主索引 6/7 由下方 override 共用王座前位置；奧貝勒與叫賣玩家另有獨立安全點。
    town_kent_castle: [[42, 37], [65, 36], [43, 52], [66, 54], [48, 67], [61, 61], [50, 35], [50, 35], [54, 47], [72, 64]],
    //   風木：盟主索引 3/4 共用祭壇前位置；其餘人員分站左右石地與下方地毯，避開兩側軍械架和下方會議桌。
    town_windwood_castle: [[37, 43], [61, 43], [40, 57], [48, 35], [48, 35], [60, 59], [48, 72]],
    //   海音（🏰 v3.6.02 依用戶截圖重排：原 5 點擠 x58-70/y42-66 全落在中央斜拱廊牆頂 → 散開到四方開闊地）：
    //   須凡=南側廣場展示桌旁｜哈金=拱廊西南側廣場（[80,56]實測落在拱門洞正中·柱間夾人→移出）｜傭兵公會=東南大廣場｜
    //   海音神官隊長=禮拜堂長椅前（神官↔禮拜堂）｜盟主=王座水池平台右側石地（階梯上方·避池避渠）｜
    //   帝倫=左側迴廊（水渠以西·避開雙立柱）｜末格叫賣=大廣場星紋旁。⚠️中央斜拱廊牆基線≈y=0.7(x−52)+38（x52→72）·牆面再往上約 10%，此帶全禁站。
    town_heine_castle: [[52, 84], [76, 62], [68, 72], [66, 34], [42, 22], [42, 22], [27, 48], [66, 54]]
};
// 🏴 叫賣玩家只會在這些安全區出現。獨立保留站位，避免在原始 NPC 格位用盡後回繞並貼近人物或落到場景物件上。
const TOWN_WANDERING_BUYER_SPOTS = {
    town_silver_knight: [55, 60], town_talking: [53, 60], town_elf: [54, 48], town_gludio: [50, 60], town_gludin: [50, 58],
    town_giran: [48, 48], town_heine: [43, 64], town_oren: [54, 70], town_aden: [60, 62],
    town_elder_council: [38, 60], town_pride: [62, 70], town_rift: [30, 50], town_ivory_tower: [69, 63],
    town_witon: [52, 68], town_silent: [54, 72], town_hyperia: [57, 68], town_behemoth: [52, 72],
    town_pirate_village: [56, 58]
};
// 同城出現兩位收購者時，第二位從已驗證的原收購點周圍挑選空位；實際選點還會避開當前城鎮的所有 NPC。
const TOWN_WANDERING_BUYER_OFFSETS = [[0, 0], [-12, 0], [12, 0], [0, -14], [0, 14], [-12, -10], [12, -10], [-12, 10], [12, 10]];
const TOWN_WANDERING_BUYER_MIN_GAP = 12;   // 以 800×450 地圖換算，至少約 54px 的垂直／96px 的水平腳點距離。
// 🌳 v3.2.92 逐 NPC 站位覆蓋（少數巨型 NPC 佔位過大會遮住鄰居點擊→釘固定角落）：townId → { npcId: [x%, y%(腳點)] }
//   安特(spr 847)＝110×145px 巨樹人·放正中央會蓋住兩側 NPC 的點擊熱區→改釘右上角(y=43 使 145px 身體＋名牌完整落在 450px 地圖內不被裁)
const TOWN_NPC_POS_OVERRIDE = {
    // 安特(847·110×145)釘右上角；精靈女皇(854·11×19極小)原站在迷幻森林之母(2725·88×96 石像)正上方被 100% 蓋住→移到安特讓出的中央空位(可點)
    town_elf: { npc_ent: [84, 43], npc_elfqueen: [48, 62] },
    // 🌲 v3.3.28 移除海音琉米埃爾覆蓋（v3.3.6 針對舊背景中央大樹·新運河圖已改由 TOWN_NPC_SPOTS index 對位＝植樹花壇旁）
    // 🏰 v3.3.10 三城堡盟主(依詩蒂/特羅斯·只顯示其一)釘在王座/祭壇前中央·其餘主要 NPC 由 TOWN_NPC_SPOTS 上移聚集靠近；兩 id 同座標(擇一顯示)
    town_kent_castle: { npc_esti: [50, 35], npc_tros: [50, 35] },      // 肯特城：王座頂端中央(藍地毯上緣)
    town_windwood_castle: { npc_esti: [48, 35], npc_tros: [48, 35] },  // 風木城：祭壇頂端中央(綠十字毯上緣)
    town_heine_castle: { npc_esti: [42, 22], npc_tros: [42, 22] }      // 海音城：王座水池平台右側石地（v3.6.02 隨站位重排上移·舊點[48,35]在階梯下混入人群）
};
function _townNpcLayout(n, townId) {
    if (n <= 0) return [];
    let spots = TOWN_NPC_SPOTS[townId];
    let out = [];
    if (spots && spots.length) {
        for (let i = 0; i < n; i++) {
            let s = spots[i % spots.length], wrap = Math.floor(i / spots.length);
            out.push({ x: Math.min(92, s[0] + wrap * 3), y: Math.min(90, s[1] + wrap * 2) });   // 回繞時往右下微移避免完全重疊
        }
        return out;
    }
    // fallback（無專屬圖的攻城城堡等）：置中格狀
    let cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * 1.7))));
    let rows = Math.ceil(n / cols);
    let per = [], rem = n, left = rows;
    for (let r = 0; r < rows; r++) { let c = Math.ceil(rem / left); per.push(c); rem -= c; left--; }
    let colStep = 15, rowStep = 16, yc = 60, idx = 0;
    for (let r = 0; r < rows; r++) {
        let m = per[r];
        let y0 = yc + (r - (rows - 1) / 2) * rowStep;
        for (let j = 0; j < m; j++, idx++) {
            let x = 50 + (j - (m - 1) / 2) * colStep + ((idx * 37) % 5 - 2) * 0.35;
            let y = y0 + ((idx * 29) % 3 - 1) * 0.3;
            out.push({ x: Math.max(8, Math.min(92, x)), y: Math.max(22, Math.min(90, y)) });
        }
    }
    return out;
}

function _townNpcMapPoint(npc, index, pos, overrides) {
    let ov = overrides[npc.id];
    return ov ? { x: ov[0], y: ov[1] } : (pos[npc._spotIdx != null ? npc._spotIdx : index] || { x: 50, y: 60 });
}

function _townPointDistance(a, b) {
    // 地圖為 16:9，x 軸每 1% 的實際像素約為 y 軸的 1.78 倍。
    return Math.hypot((a.x - b.x) * (16 / 9), a.y - b.y);
}

function _townWanderingBuyerPositions(vis, townId, pos, overrides) {
    let base = TOWN_WANDERING_BUYER_SPOTS[townId];
    if (!base) return {};
    let occupied = vis
        .filter(npc => !npc._wanderer)
        .map((npc, index) => _townNpcMapPoint(npc, index, pos, overrides));
    let buyers = vis
        .filter(npc => npc._wanderer)
        .sort((a, b) => (a.currency === 'gold' ? 1 : 0) - (b.currency === 'gold' ? 1 : 0));
    let out = {};

    buyers.forEach((npc, index) => {
        let candidates = TOWN_WANDERING_BUYER_OFFSETS.map(offset => ({
            x: Math.max(8, Math.min(92, base[0] + offset[0])),
            y: Math.max(22, Math.min(90, base[1] + offset[1]))
        }));
        let gapOf = point => occupied.length
            ? Math.min.apply(null, occupied.map(other => _townPointDistance(point, other)))
            : Infinity;
        let baseGap = gapOf(candidates[0]);
        // 單一 NPC 或第一位仍優先原本手工確認過的安全點；只有已太靠近既有 NPC 時才避讓。
        let best = (index === 0 && baseGap >= TOWN_WANDERING_BUYER_MIN_GAP)
            ? candidates[0]
            : candidates.reduce((picked, point) => gapOf(point) > gapOf(picked) ? point : picked, candidates[0]);
        out[npc.id] = best;
        occupied.push(best);   // 第二位同時避開第一位，避免立繪與名牌互相吃掉點擊。
    });
    return out;
}

// 城鎮地圖背景：沿用 TOWN_BG_1920/SPECIAL_TOWN_BG/TOWN_AREA_BG 解析，但用較淡遮罩(場景清楚)
function _townMapBg(townId) {
    let cat = (typeof mapCategoryOf === 'function') ? mapCategoryOf(townId) : null;
    let ov = 'linear-gradient(rgba(15,23,42,.12), rgba(15,23,42,.30))';
    try {
        if (typeof TOWN_BG_1920 !== 'undefined' && TOWN_BG_1920[townId])
            return ov + ', url("assets/area/1920x1080/' + TOWN_BG_1920[townId] + '.jpg")';
        let timg = ((typeof SPECIAL_TOWN_BG !== 'undefined') && SPECIAL_TOWN_BG[townId])
            || ((typeof TOWN_AREA_BG !== 'undefined') && cat && TOWN_AREA_BG[cat]) || null;
        if (timg) return ov + ', url("assets/background/' + timg + '")';
    } catch (e) {}
    return 'linear-gradient(#334155, #1e293b)';
}

let _townNpcSprites = [];
function _townCastleCrownHtml(npc) {
    if (!npc || typeof siegeVictoryActive !== 'function' || !siegeVictoryActive()) return '';
    let royalNpc = npc.id === 'npc_esti' || npc.id === 'npc_tros';
    let royalPlayer = !!npc._wanderer && (npc.avatar === '王子' || npc.avatar === '公主');
    return (royalNpc || royalPlayer)
        ? '<img class="tn-castle-crown" src="assets/ui/castle-crown.gif?v=v3.6.22" alt="" aria-hidden="true" draggable="false">'
        : '';
}
// 👑 v3.6.76 城鎮 NPC 王冠錨點（tools/crown-anchor-gen.js 離線掃 idle 幀產出·勿手改）。
//    值＝[頭頂質心x, 畫布底至頭頂px+2]，與 js/09 的 PM_CROWN_ANCHOR 同語意。3227＝依詩蒂(公主)／3225＝特羅斯(王子)。
const TN_NPC_CROWN_ANCHOR = { '3227':[19,53], '3225':[18,87] };
// ⚠️ v3.6.76 本函式**不得**再用 canvas getImageData 找頭頂：file:// 下本地圖片污染 canvas → 擲 SecurityError
//    被 catch 吃掉 → 靜默落到 {x:寬/2, bottom:高} 粗略後備 → 王冠飄在頭頂正上方好幾十 px（叫賣王族玩家最明顯：
//    公主畫布 144 高、真實頭頂只有 88 → 高出 56px）。一律查離線錨點表。
function _townCastleCrownBox(img) {
    if (!img || !img.complete || !(img.naturalWidth > 0) || !(img.naturalHeight > 0)) return null;
    let src = img.currentSrc || img.src || '';
    let srcText = '';
    try { srcText = decodeURIComponent(String(src || '')).replace(/\\/g, '/'); } catch (e) { srcText = String(src || '').replace(/\\/g, '/'); }
    // 叫賣王族玩家 NPC：classanim <王子|公主><''|F|2> 的 unarmed_idle_ → 直接沿用 js/09 既有的 PM_CROWN_ANCHOR（同一批 sprite，不另建表）
    let cm = srcText.match(/\/assets\/classanim\/([^/]+)\/unarmed_idle_/);
    if (cm && typeof PM_CROWN_ANCHOR === 'object' && PM_CROWN_ANCHOR[cm[1] + ':unarmed']) {
        let a = PM_CROWN_ANCHOR[cm[1] + ':unarmed'];
        return { x: a[0], bottom: a[1] };
    }
    // 固定 NPC：assets/npc/<gfx>/idle_
    let nm = srcText.match(/\/assets\/npc\/([^/]+)\//);
    if (nm && TN_NPC_CROWN_ANCHOR[nm[1]]) {
        let a = TN_NPC_CROWN_ANCHOR[nm[1]];
        return { x: a[0], bottom: a[1] };
    }
    return { x: Math.round(img.naturalWidth / 2), bottom: img.naturalHeight };   // 表外安全網（正常不會走到：有王冠的 sprite 只有上面兩類）
}
function _townCastleCrownAlign(crown, bodyImg) {
    if (!crown || !bodyImg) return;
    let box = _townCastleCrownBox(bodyImg);
    if (!box) return;
    crown.style.left = box.x + 'px';
    crown.style.bottom = box.bottom + 'px';
}
function renderTownNPCMap(townId) {
    let map = document.getElementById('town-npc-map');
    if (!map) return;
    map.classList.remove('hidden');
    map.innerHTML = '';
    _townNpcSprites = [];
    try { map.style.backgroundImage = _townMapBg(townId); } catch (e) {}
    let td = DB.towns[townId];
    if (!td) return;
    // 與舊卡片清單相同的可見性過濾
    let vis = (td.npcs || []).filter(npc => {
        if (npc.id === 'npc_esti' || npc.id === 'npc_tros') {
            return typeof clanNpcVisible === 'function' && clanNpcVisible(npc.id, townId);
        }
        if (npc.darkOnly && player.cls !== 'dark') return false;
        if (npc.classicHide && player.classicMode) return false;
        if (npc.classicOnly && !player.classicMode) return false;   // 🕊️ 經典限定 NPC（聖使阿卡塔）：一般模式不渲染
        return true;
    }).map(npc => {
        if ((npc.id === 'npc_esti' || npc.id === 'npc_tros') && typeof clanNpcDisplayName === 'function') {
            return Object.assign({}, npc, { n:clanNpcDisplayName(), _sourceSpotIdx:(td.npcs || []).indexOf(npc) });
        }
        return npc;
    });
    // 🗼🌀 v3.2.89 傲慢之塔／時空裂痕：入口告示改成地圖上的可點 NPC（_spr 專屬圖·_float 專屬點擊→浮動視窗）
    if (townId === 'town_pride') vis.push({ id: '_pride_entrance', n: '傲慢之塔', title: '入口', _spr: '1148', _float: 'pride' });
    if (townId === 'town_rift') vis.push({ id: '_rift_entrance', n: '時空裂痕', title: '入口', _spr: '1149', _float: 'rift' });
    // 🏴 潘朵拉玩家 NPC：每個安全區可各有一位龍鑽／金幣收購者，並沿用玩家職業站立動畫。
    try {
        if (typeof getWanderingBuyersForTown === 'function') {
            let wanderers = getWanderingBuyersForTown(townId);
            if (Array.isArray(wanderers)) vis.push.apply(vis, wanderers);
        } else if (typeof getWanderingBuyerForTown === 'function') {
            let wandering = getWanderingBuyerForTown(townId);
            if (wandering) vis.push(wandering);
        }
    } catch (e) {}
    if (!vis.length) return;
    // ⚠️ 站位要以「NPC 在未過濾 td.npcs 中的原始索引」對位，不能用過濾後的順序。
    //    否則像威頓村的 npc_han（classicHide、位於索引 1 非末尾）在經典模式被濾掉時，
    //    其後所有 NPC 的手工站位會整體前移一格、最後一格閒置。虛擬 NPC（塔/裂痕入口、叫賣玩家）續接末尾。
    {
        let _base = (td.npcs || []).length, _extra = 0;
        vis.forEach(npc => {
            let _oi = Number.isInteger(npc._sourceSpotIdx) ? npc._sourceSpotIdx : (td.npcs || []).indexOf(npc);
            npc._spotIdx = (_oi >= 0) ? _oi : (_base + (_extra++));
        });
    }
    let _spotN = vis.reduce((m, npc) => Math.max(m, (npc._spotIdx || 0) + 1), 0);
    let pos = _townNpcLayout(_spotN, townId);
    let ovr = TOWN_NPC_POS_OVERRIDE[townId] || {};
    let buyerPositions = _townWanderingBuyerPositions(vis, townId, pos, ovr);
    let used = new Set();
    // 🔒 v3.2.99 先把所有「專屬/固定/角色」sprite 佔位，避免池分配的 NPC 搶走稍後才出現的固定 NPC 的圖
    //   （例：肯特城堡 奧貝勒固定 1049，若 伊賽馬利 先抽到 1049 就會撞臉；先預留固定圖 → 池分配自動避開）
    vis.forEach(npc => { let fk = npc._spr || NPC_SPR_FIXED[npc.id] || NPC_SPR_ROLE[npc.type]; if (fk) used.add(fk); });
    vis.forEach((npc, i) => {
        let p = (npc._wanderer && buyerPositions[npc.id]) || _townNpcMapPoint(npc, i, pos, ovr);
        // 玩家 NPC 使用 classanim 的無武器 idle（三方向隨機·由 wanderingBuyerSpriteData 依 id 決定），本體與影子各自同步播放。
        if (npc._wanderer && typeof wanderingBuyerSpriteData === 'function') {
            let spr = wanderingBuyerSpriteData(npc);
            let body0 = spr.frames && spr.frames[0] ? spr.frames[0].src : '';
            let shadow0 = spr.shadows && spr.shadows[0] ? spr.shadows[0].src : '';
            let el = document.createElement('div');
            el.className = 'town-npc wandering-player';
            el.style.left = p.x + '%'; el.style.top = p.y + '%'; el.style.zIndex = Math.round(p.y * 10);
            let align = (typeof pvpClampAlignment === 'function') ? pvpClampAlignment(npc.alignmentValue) : Math.max(-32767, Math.min(32767, Math.round(Number(npc.alignmentValue) || 0)));
            let nameHtml = (typeof pvpNameHtml === 'function') ? pvpNameHtml(npc.n, align, 'tn-name') : '<span class="tn-name">' + npc.n + '</span>';
            let crownHtml = _townCastleCrownHtml(npc);
            if (crownHtml) el.classList.add('has-castle-crown');
            el.innerHTML =
                '<div class="tn-label">' + nameHtml + '<span class="tn-title">[' + (npc.title || '玩家收購') + ']</span></div>' +
                crownHtml +
                '<img class="tn-shadow" src="' + shadow0 + '" alt="" onload="this.parentElement.classList.add(\'has-tn-shadow\')" onerror="this.remove()">' +
                '<img class="tn-body" src="' + body0 + '" alt="">';
            el.onclick = () => openWanderingBuyerDialog(npc.id);
            map.appendChild(el);
            let bodyImg = el.querySelector('.tn-body');
            let shadowImg = el.querySelector('.tn-shadow');
            let crownImg = el.querySelector('.tn-castle-crown');
            if (crownImg) bodyImg.addEventListener('load', () => _townCastleCrownAlign(crownImg, bodyImg));
            if (crownImg) setTimeout(() => _townCastleCrownAlign(crownImg, bodyImg), 0);
            bodyImg.addEventListener('load', _scheduleTownLabelResolve, { once: true });
            _townNpcSprites.push({
                img: bodyImg,
                crown: crownImg,
                wimg: shadowImg,
                wframes: spr.shadows || null,
                frames: spr.frames || [],
                phase: (i * 3) % 8,
                last: -1
            });
            return;
        }
        let key = npc._spr || _npcSpriteKey(npc, used); used.add(key);
        let cat = NPC_SPR[key] || NPC_SPR['1256'];
        let el = document.createElement('div');
        el.className = 'town-npc';
        el.style.left = p.x + '%'; el.style.top = p.y + '%'; el.style.zIndex = Math.round(p.y * 10);
        let crownHtml = _townCastleCrownHtml(npc);
        if (crownHtml) el.classList.add('has-castle-crown');
        el.innerHTML =
            '<div class="tn-label"><span class="tn-name">' + npc.n + '</span><span class="tn-title">' + npc.title + '</span></div>' +
            crownHtml +
            '<img class="tn-shadow" src="assets/npc/' + cat.g + '/idle_s_0.png" alt="" onload="this.parentElement.classList.add(\'has-tn-shadow\')" onerror="this.remove()">' +   // 🌑 v3.3.5 真實影子 sprite(body gfx+1·共畫布疊本體對齊)；有影子→onload 標記父層隱藏後備橢圓；無影子(職業動畫/老 gfx/告示)→404 remove→改用 CSS 橢圓後備影子(v3.3.18)
            '<img class="tn-body"' + (cat.tint ? (' style="filter:' + cat.tint + '"') : '') + ' src="assets/npc/' + cat.g + '/idle_0.png" alt="">' +
            (cat.w ? '<img class="tn-weapon" src="assets/npc/' + cat.g + '/idle_w_0.png" alt="" onerror="this.remove()">' : '');   // 🔥 v3.3.18 火焰/武器疊層(screen 混合·宙斯之熔岩高崙的燃燒特效)
        if (npc._float === 'pride') el.onclick = () => openTownFloatWindow('傲慢之塔', '排名挑戰', renderPrideEntrance);
        else if (npc._float === 'rift') el.onclick = () => openTownFloatWindow('時空裂痕', '進入', renderRiftEntrance);
        else el.onclick = () => interactNPC(npc.id, townId);
        map.appendChild(el);
        let bodyImg = el.querySelector('.tn-body');
        let crownImg = el.querySelector('.tn-castle-crown');
        if (crownImg) bodyImg.addEventListener('load', () => _townCastleCrownAlign(crownImg, bodyImg));
        if (crownImg) setTimeout(() => _townCastleCrownAlign(crownImg, bodyImg), 0);
        bodyImg.addEventListener('load', _scheduleTownLabelResolve, { once: true });   // 🏷️ 圖片載入拿到真實高度後再排名牌
        let wImg = cat.w ? el.querySelector('.tn-weapon') : null;   // 🔥 火焰疊層與本體同步推進
        _townNpcSprites.push({ img: bodyImg, crown: crownImg, wimg: wImg, wframes: (cat.w ? _npcWeaponFrames(key) : null), frames: _npcFrames(key), phase: (i * 3) % 8, last: -1 });
    });
    // 🏷️ v3.2.92 名牌常駐開關：跟隨戰鬥日誌「狀態」鈕(_showMobStatus)·開→所有 NPC 名字常駐頭頂；關→僅 hover
    map.classList.toggle('show-labels', (typeof _showMobStatus === 'undefined') ? true : !!_showMobStatus);
    _scheduleTownLabelResolve();
}

// 🗼🌀 v3.2.89 開啟城鎮浮動視窗並注入任意內容（傲慢之塔／時空裂痕入口共用·與 interactNPC 同一個 #town-interaction-container 浮動視窗）
function openTownFloatWindow(name, title, renderFn) {
    if (typeof _activePanel !== 'undefined') _activePanel = null;
    let c = document.getElementById('town-npc-container'); if (c) c.classList.add('hidden');
    let tic = document.getElementById('town-interaction-container');
    if (!tic) return;
    tic.classList.remove('hidden'); tic.classList.add('flex');
    document.getElementById('interaction-npc-name').innerText = name || '';
    document.getElementById('interaction-npc-title').innerText = title ? ('[' + title + ']') : '';
    let content = document.getElementById('interaction-content');
    content.innerHTML = '';
    try { if (typeof renderFn === 'function') renderFn(content); } catch (e) {}
}

// 🏷️ v3.2.92 名牌防重疊：常駐名牌開啟時，逐一把互相重疊的名字往上抬離(仍在頭頂之上·不超出地圖頂端)
//   幾何用 getBoundingClientRect(已含舞台縮放)·抬升量換算回 CSS px(÷scale) 再寫入 margin-bottom
function _resolveTownLabelOverlap() {
    try {
        let map = document.getElementById('town-npc-map');
        if (!map || map.classList.contains('hidden') || !map.classList.contains('show-labels')) return;
        let scale = (map.getBoundingClientRect().width / (map.offsetWidth || 800)) || 1;
        let mapTop = map.getBoundingClientRect().top;
        let labels = [].slice.call(map.querySelectorAll('.town-npc .tn-label'));
        if (!labels.length) return;
        labels.forEach(l => { l.style.marginBottom = ''; });   // 先歸零(回 CSS 預設 5px)再量測
        let entries = labels.map(l => ({
            l,
            r: l.getBoundingClientRect(),
            baseMargin: l.parentElement && l.parentElement.classList.contains('has-castle-crown') ? 17 : 5
        })).filter(e => e.r.width > 0);
        entries.sort((a, b) => a.r.top - b.r.top);   // 由上而下：越高者當錨點，下方者往上讓
        let placed = [];
        for (let e of entries) {
            let r = e.l.getBoundingClientRect();
            let left = r.left, right = r.right, top = r.top, bottom = r.bottom, guard = 0;
            while (guard++ < 30) {
                let hit = placed.find(p => left < p.right - 1 && right > p.left + 1 && top < p.bottom - 1 && bottom > p.top + 1);
                if (!hit) break;
                let lift = (bottom - hit.top) + 4;
                if (top - lift < mapTop + 2) {   // 再抬會超出地圖頂端→抬到極限就停(寧可微疊也不裁掉)
                    let maxLift = top - (mapTop + 2);
                    if (maxLift > 0) { top -= maxLift; bottom -= maxLift; }
                    break;
                }
                top -= lift; bottom -= lift;
            }
            placed.push({ left, right, top, bottom });
            let shift = r.top - top;
            if (shift > 0.5) e.l.style.marginBottom = (e.baseMargin + shift / scale) + 'px';
        }
    } catch (err) {}
}
let _townLabelResolveT = null;
function _scheduleTownLabelResolve() {
    if (_townLabelResolveT) return;
    _townLabelResolveT = setTimeout(() => { _townLabelResolveT = null; _resolveTownLabelOverlap(); }, 70);
}

function _townNpcAnimTick() {
    let tv = document.getElementById('town-view');
    if (!tv || tv.classList.contains('hidden')) return;
    let map = document.getElementById('town-npc-map');
    if (!map || map.classList.contains('hidden')) return;
    if (!_townNpcSprites.length) return;
    let t = Date.now();
    for (const s of _townNpcSprites) {
        if (!s.frames || !s.frames.length) continue;
        let fi = (Math.floor(t / 125) + s.phase) % s.frames.length;
        if (fi !== s.last) {
            s.last = fi;
            let fr = s.frames[fi]; if (fr && fr.src) s.img.src = fr.src;
            if (s.crown) _townCastleCrownAlign(s.crown, s.img);
            if (s.wimg && s.wframes && s.wframes.length) { let wf = s.wframes[fi % s.wframes.length]; if (wf && wf.src) s.wimg.src = wf.src; }   // 🔥 火焰疊層同幀
        }
    }
}
setInterval(_townNpcAnimTick, 125);   // 8fps 站立循環
