// ========== 製作系統核心邏輯 ==========

// 1. 定義製作配方
const CRAFT_RECIPES = {
    // 💍 賽巴斯（奇岩 寶石加工坊）：4 屬性戒指（神聖獨角獸之角×5＋月光之氣息×1＋粗糙的米索莉塊×50＋魔法寶石×30＋四種高品質寶石各×5＋金幣200萬）＋4 精靈皮帶（皮帶×1＋對應龍鱗×3＋元素石×5）
    npc_sebas: [
        { result: 'acc_ring_magic', req: [{ id: 'mat_unicorn_horn', cnt: 5 }, { id: 'mat_moonlight_breath', cnt: 1 }, { id: 'new_item_164', cnt: 50 }, { id: 'new_item_150', cnt: 30 }, { id: 'new_item_159', cnt: 5 }, { id: 'new_item_156', cnt: 5 }, { id: 'new_item_162', cnt: 5 }, { id: 'new_item_153', cnt: 5 }, { id: 'gold', cnt: 2000000 }] },
        { result: 'acc_ring_str',   req: [{ id: 'mat_unicorn_horn', cnt: 5 }, { id: 'mat_moonlight_breath', cnt: 1 }, { id: 'new_item_164', cnt: 50 }, { id: 'new_item_150', cnt: 30 }, { id: 'new_item_159', cnt: 5 }, { id: 'new_item_156', cnt: 5 }, { id: 'new_item_162', cnt: 5 }, { id: 'new_item_153', cnt: 5 }, { id: 'gold', cnt: 2000000 }] },
        { result: 'acc_ring_dex',   req: [{ id: 'mat_unicorn_horn', cnt: 5 }, { id: 'mat_moonlight_breath', cnt: 1 }, { id: 'new_item_164', cnt: 50 }, { id: 'new_item_150', cnt: 30 }, { id: 'new_item_159', cnt: 5 }, { id: 'new_item_156', cnt: 5 }, { id: 'new_item_162', cnt: 5 }, { id: 'new_item_153', cnt: 5 }, { id: 'gold', cnt: 2000000 }] },
        { result: 'acc_ring_int',   req: [{ id: 'mat_unicorn_horn', cnt: 5 }, { id: 'mat_moonlight_breath', cnt: 1 }, { id: 'new_item_164', cnt: 50 }, { id: 'new_item_150', cnt: 30 }, { id: 'new_item_159', cnt: 5 }, { id: 'new_item_156', cnt: 5 }, { id: 'new_item_162', cnt: 5 }, { id: 'new_item_153', cnt: 5 }, { id: 'gold', cnt: 2000000 }] },
        { result: 'acc_belt_fire',  req: [{ id: 'new_item_181', cnt: 1 }, { id: 'new_item_192', cnt: 3 }, { id: 'new_item_165', cnt: 5 }] },
        { result: 'acc_belt_water', req: [{ id: 'new_item_181', cnt: 1 }, { id: 'new_item_190', cnt: 3 }, { id: 'new_item_165', cnt: 5 }] },
        { result: 'acc_belt_earth', req: [{ id: 'new_item_181', cnt: 1 }, { id: 'new_item_191', cnt: 3 }, { id: 'new_item_165', cnt: 5 }] },
        { result: 'acc_belt_wind',  req: [{ id: 'new_item_181', cnt: 1 }, { id: 'new_item_193', cnt: 3 }, { id: 'new_item_165', cnt: 5 }] }
    ],
    // 🏛️ 可羅蘭斯（沉默洞穴）：封印的歷史書八頁→製作武器秘笈；秘笈＋對應素材武器＋素材 → 5 件傳說武器（doCraft 會自動遞迴合成缺少的秘笈）
    npc_kororanz: [
        { result: 'mat_rasta_codex', req: [{ id: 'mat_history_1', cnt: 1 }, { id: 'mat_history_2', cnt: 1 }, { id: 'mat_history_3', cnt: 1 }, { id: 'mat_history_4', cnt: 1 }, { id: 'mat_history_5', cnt: 1 }, { id: 'mat_history_6', cnt: 1 }, { id: 'mat_history_7', cnt: 1 }, { id: 'mat_history_8', cnt: 1 }] },
        { result: 'wpn_emperor_blade', req: [{ id: 'mat_rasta_codex', cnt: 1 }, { id: 'wpn_official_2h', cnt: 1 }, { id: 'mat_blackmithril_plate', cnt: 10 }, { id: 'mat_black_powder', cnt: 50 }, { id: 'mat_holy_relic', cnt: 100 }, { id: 'mat_black_blood', cnt: 50 }] },
        { result: 'wpn_windblade_dagger', req: [{ id: 'mat_rasta_codex', cnt: 1 }, { id: 'wpn_official_blade', cnt: 1 }, { id: 'mat_blackmithril_plate', cnt: 10 }, { id: 'mat_black_powder', cnt: 50 }, { id: 'mat_holy_relic', cnt: 100 }, { id: 'mat_black_blood', cnt: 50 }] },
        { result: 'wpn_redshadow_dual', req: [{ id: 'mat_rasta_codex', cnt: 1 }, { id: 'wpn_assassin_mark', cnt: 1 }, { id: 'mat_blackmithril_plate', cnt: 10 }, { id: 'mat_black_powder', cnt: 50 }, { id: 'mat_holy_relic', cnt: 100 }, { id: 'mat_black_blood', cnt: 50 }] },
        { result: 'wpn_beastking_claw', req: [{ id: 'mat_rasta_codex', cnt: 1 }, { id: 'wpn_baranka_claw', cnt: 1 }, { id: 'mat_blackmithril_plate', cnt: 10 }, { id: 'mat_black_powder', cnt: 50 }, { id: 'mat_holy_relic', cnt: 100 }, { id: 'mat_black_blood', cnt: 50 }] },
        { result: 'wpn_holycrystal_wand', req: [{ id: 'mat_rasta_codex', cnt: 1 }, { id: 'wpn_priest_wand', cnt: 1 }, { id: 'mat_blackmithril_plate', cnt: 10 }, { id: 'mat_black_powder', cnt: 50 }, { id: 'mat_holy_relic', cnt: 100 }, { id: 'mat_black_blood', cnt: 50 }] }
    ],
    // 🏴‍☠️❄️ 大衛（歐瑞村 寶石加工）：冰之女王的耳環逐級精煉，每級＝前一級 + 冰之結晶×1；Lv8 六屬性擇一
    npc_david: [
        { result: 'acc_icequeen_ear_1', req: [{ id: 'acc_icequeen_ear_0', cnt: 1 }, { id: 'mat_ice_crystal', cnt: 1 }] },
        { result: 'acc_icequeen_ear_2', req: [{ id: 'acc_icequeen_ear_1', cnt: 1 }, { id: 'mat_ice_crystal', cnt: 1 }] },
        { result: 'acc_icequeen_ear_3', req: [{ id: 'acc_icequeen_ear_2', cnt: 1 }, { id: 'mat_ice_crystal', cnt: 1 }] },
        { result: 'acc_icequeen_ear_4', req: [{ id: 'acc_icequeen_ear_3', cnt: 1 }, { id: 'mat_ice_crystal', cnt: 1 }] },
        { result: 'acc_icequeen_ear_5', req: [{ id: 'acc_icequeen_ear_4', cnt: 1 }, { id: 'mat_ice_crystal', cnt: 1 }] },
        { result: 'acc_icequeen_ear_6', req: [{ id: 'acc_icequeen_ear_5', cnt: 1 }, { id: 'mat_ice_crystal', cnt: 1 }] },
        { result: 'acc_icequeen_ear_7', req: [{ id: 'acc_icequeen_ear_6', cnt: 1 }, { id: 'mat_ice_crystal', cnt: 1 }] },
        { result: 'acc_icequeen_ear_8_str', req: [{ id: 'acc_icequeen_ear_7', cnt: 1 }, { id: 'mat_ice_crystal', cnt: 1 }] },
        { result: 'acc_icequeen_ear_8_dex', req: [{ id: 'acc_icequeen_ear_7', cnt: 1 }, { id: 'mat_ice_crystal', cnt: 1 }] },
        { result: 'acc_icequeen_ear_8_int', req: [{ id: 'acc_icequeen_ear_7', cnt: 1 }, { id: 'mat_ice_crystal', cnt: 1 }] },
        { result: 'acc_icequeen_ear_8_con', req: [{ id: 'acc_icequeen_ear_7', cnt: 1 }, { id: 'mat_ice_crystal', cnt: 1 }] },
        { result: 'acc_icequeen_ear_8_wis', req: [{ id: 'acc_icequeen_ear_7', cnt: 1 }, { id: 'mat_ice_crystal', cnt: 1 }] },
        { result: 'acc_icequeen_ear_8_cha', req: [{ id: 'acc_icequeen_ear_7', cnt: 1 }, { id: 'mat_ice_crystal', cnt: 1 }] },
        // 💎 藍系（MP）：智慧→真實→支配
        { result: 'acc_ear_wisdom',   req: [{ id: 'new_item_160', cnt: 50 }, { id: 'new_item_161', cnt: 30 }, { id: 'new_item_162', cnt: 5 }, { id: 'new_item_151', cnt: 50 }] },
        { result: 'acc_ear_truth',    req: [{ id: 'acc_ear_wisdom', cnt: 1 }, { id: 'new_item_162', cnt: 10 }, { id: 'new_item_152', cnt: 30 }] },
        { result: 'acc_ear_dominate', req: [{ id: 'acc_ear_truth', cnt: 1 }, { id: 'new_item_162', cnt: 20 }, { id: 'new_item_153', cnt: 10 }] },
        // 💚 綠系（HP/MP）：憤怒→勇猛→不死
        { result: 'acc_ear_rage',     req: [{ id: 'new_item_154', cnt: 50 }, { id: 'new_item_155', cnt: 30 }, { id: 'new_item_156', cnt: 5 }, { id: 'new_item_151', cnt: 50 }] },
        { result: 'acc_ear_brave',    req: [{ id: 'acc_ear_rage', cnt: 1 }, { id: 'new_item_156', cnt: 10 }, { id: 'new_item_152', cnt: 30 }] },
        { result: 'acc_ear_undead',   req: [{ id: 'acc_ear_brave', cnt: 1 }, { id: 'new_item_156', cnt: 20 }, { id: 'new_item_153', cnt: 10 }] },
        // ❤️ 紅系（HP）：熱情→名譽→寬容
        { result: 'acc_ear_passion',  req: [{ id: 'new_item_157', cnt: 50 }, { id: 'new_item_158', cnt: 30 }, { id: 'new_item_159', cnt: 5 }, { id: 'new_item_151', cnt: 50 }] },
        { result: 'acc_ear_honor',    req: [{ id: 'acc_ear_passion', cnt: 1 }, { id: 'new_item_159', cnt: 10 }, { id: 'new_item_152', cnt: 30 }] },
        { result: 'acc_ear_tolerance',req: [{ id: 'acc_ear_honor', cnt: 1 }, { id: 'new_item_159', cnt: 20 }, { id: 'new_item_153', cnt: 10 }] }
    ],
    // 🔥 炎魔的輔佐官（炎魔謁見所·耳環製作）：靈魂石碎片逐階精煉；前7階無法強化、奴隸耳環可強化
    npc_flame_aide: [
        { result: 'acc_ear_dance',    req: [{ id: 'mat_soulstone_shard', cnt: 10 }] },
        { result: 'acc_ear_twin',     req: [{ id: 'acc_ear_dance', cnt: 1 }, { id: 'mat_soulstone_shard', cnt: 20 }] },
        { result: 'acc_ear_festival', req: [{ id: 'acc_ear_twin', cnt: 1 }, { id: 'mat_soulstone_shard', cnt: 40 }] },
        { result: 'acc_ear_peak',     req: [{ id: 'acc_ear_festival', cnt: 1 }, { id: 'mat_soulstone_shard', cnt: 200 }] },
        { result: 'acc_ear_rampage',  req: [{ id: 'acc_ear_peak', cnt: 1 }, { id: 'mat_soulstone_shard', cnt: 500 }] },
        { result: 'acc_ear_phantom',  req: [{ id: 'acc_ear_rampage', cnt: 1 }, { id: 'mat_soulstone_shard', cnt: 750 }] },
        { result: 'acc_ear_clan',     req: [{ id: 'acc_ear_phantom', cnt: 1 }, { id: 'mat_soulstone_shard', cnt: 1000 }] },
        { result: 'acc_ear_slave',    req: [{ id: 'acc_ear_clan', cnt: 1 }, { id: 'mat_soulstone_shard', cnt: 2500 }] }
    ],
    // 🔮 巴特爾（希培利亞村莊）：龜裂之核＝時空裂痕碎片×100；黑曜石奇古獸＝四種高品質寶石×10＋龜裂之核×2＋原石碎片×30＋精靈粉末×30＋金幣 100 萬
    npc_bartel: [
        { result: 'mat_crack_core', req: [{ id: 'mat_rift_shard', cnt: 100 }] },
        { result: 'mat_gasha_soul', req: [{ id: 'mat_youkai_soul', cnt: 100 }] },   // 🌅 日出之國：巨大骷髏的妖魂（使用+100萬經驗·可批量）

        { result: 'item_osiris_box_basic', req: [{ id: 'mat_osiris_basic_up', cnt: 1 }, { id: 'mat_osiris_basic_down', cnt: 1 }] },
        { result: 'item_osiris_box_high', req: [{ id: 'mat_osiris_high_up', cnt: 1 }, { id: 'mat_osiris_high_down', cnt: 1 }] },
        { result: 'item_kukulkan_box_basic', req: [{ id: 'mat_kukulkan_basic_up', cnt: 1 }, { id: 'mat_kukulkan_basic_down', cnt: 1 }] },   // 🐍 提卡爾 初級寶箱
        { result: 'item_kukulkan_box_high', req: [{ id: 'mat_kukulkan_high_up', cnt: 1 }, { id: 'mat_kukulkan_high_down', cnt: 1 }] },   // 🐍 提卡爾 高級寶箱
        { result: 'wpn_qigu_obsidian', req: [
            { id: 'new_item_153', cnt: 10 }, { id: 'new_item_159', cnt: 10 }, { id: 'new_item_162', cnt: 10 }, { id: 'new_item_156', cnt: 10 },
            { id: 'mat_crack_core', cnt: 2 }, { id: 'mat_rough_stone', cnt: 30 }, { id: 'new_item_170', cnt: 30 }, { id: 'gold', cnt: 1000000 }
        ] }
    ],
    // 🗼 烏普尼（亞丁）：支配符 = 傳送符×1 + 移動卷軸×100（11F~91F 共 9 組）
    npc_upni: [11, 21, 31, 41, 51, 61, 71, 81, 91].map(N => ({
        result: 'item_pride_dom_' + N,
        req: [{ id: 'item_pride_pass_' + N, cnt: 1 }, { id: 'item_pride_scroll_' + N, cnt: 100 }]
    })),
    // 🦴 諾斯（亞丁）：寵物裝備『之牙』鍛造＋🐾 v3.2.17 寵物進化材料（進化果實/勝利果實）
    npc_norse: [
        { result: 'pet_fang_hound',   req: [{ id: 'new_item_180', cnt: 50 },  { id: 'new_item_152', cnt: 3 },  { id: 'gold', cnt: 100000 }] },
        { result: 'pet_fang_steel',   req: [{ id: 'new_item_180', cnt: 100 }, { id: 'new_item_161', cnt: 1 },  { id: 'gold', cnt: 100000 }] },
        { result: 'pet_fang_ruin',    req: [{ id: 'pet_fang_hound', cnt: 1 }, { id: 'mat_black_mithril', cnt: 10 }, { id: 'new_phoenix_heart', cnt: 1 }, { id: 'gold', cnt: 1000000 }] },
        { result: 'pet_fang_victory', req: [{ id: 'pet_fang_steel', cnt: 1 }, { id: 'new_item_180', cnt: 50 }, { id: 'new_item_161', cnt: 2 }, { id: 'new_item_162', cnt: 1 }, { id: 'gold', cnt: 1000000 }] },
        { result: 'item_evo_fruit',     req: [{ id: 'new_item_221', cnt: 100 }, { id: 'new_item_154', cnt: 20 }, { id: 'gold', cnt: 20000 }] },   // 進化果實＝光明的鱗片×100＋綠寶石×20＋金幣20000
        { result: 'item_victory_fruit', req: [{ id: 'item_dragon_heart', cnt: 1 }, { id: 'new_item_159', cnt: 5 }] },                               // 勝利果實＝龍之心×1＋高品質紅寶石×5
        // 🛡️ v3.2.37 寵物防具鍛造（皮→骷髏；鋼鐵→十字/鏈→米索莉·成品可作上位材料·doCraft 自動遞迴補製中間物）
        { result: 'pet_arm_leather', req: [{ id: 'new_item_182', cnt: 20 }, { id: 'gold', cnt: 10000 }] },                                                                                             // 寵物皮盔甲＝高級皮革×20＋金幣10000
        { result: 'pet_arm_bone',    req: [{ id: 'pet_arm_leather', cnt: 1 }, { id: 'new_item_182', cnt: 10 }, { id: 'new_item_183', cnt: 20 }, { id: 'gold', cnt: 50000 }] },                        // 寵物骷髏盔甲＝寵物皮盔甲×1＋高級皮革×10＋骨頭碎片×20＋金幣50000
        { result: 'pet_arm_steel',   req: [{ id: 'mat_steel_chunk', cnt: 20 }, { id: 'new_item_180', cnt: 20 }, { id: 'gold', cnt: 100000 }] },                                                       // 寵物鋼鐵盔甲＝鋼鐵塊×20＋金屬塊×20＋金幣100000
        { result: 'pet_arm_cross',   req: [{ id: 'pet_arm_steel', cnt: 1 }, { id: 'new_item_182', cnt: 50 }, { id: 'mat_steel_chunk', cnt: 20 }, { id: 'gold', cnt: 200000 }] },                      // 寵物十字盔甲＝寵物鋼鐵盔甲×1＋高級皮革×50＋鋼鐵塊×20＋金幣200000
        { result: 'pet_arm_chain',   req: [{ id: 'pet_arm_steel', cnt: 1 }, { id: 'new_item_182', cnt: 50 }, { id: 'mat_steel_chunk', cnt: 100 }, { id: 'gold', cnt: 200000 }] },                     // 寵物鏈甲＝寵物鋼鐵盔甲×1＋高級皮革×50＋鋼鐵塊×100＋金幣200000
        { result: 'pet_arm_mithril', req: [{ id: 'pet_arm_cross', cnt: 1 }, { id: 'new_item_182', cnt: 50 }, { id: 'new_item_153', cnt: 2 }, { id: 'new_item_177', cnt: 10 }, { id: 'mat_dragon_heart', cnt: 1 }, { id: 'gold', cnt: 300000 }] }   // 寵物米索莉盔甲＝寵物十字盔甲×1＋高級皮革×50＋高品質鑽石×2＋米索莉金屬板×10＋飛龍之心×1＋金幣300000
    ],
    // 🔥 炎魔之影（炎魔謁見所）：墮落鐮刀 + 墮落首級 → 炎魔的血光斗篷
    npc_flame_shadow: [
        { result: 'clk_flame_blood', req: [{ id: 'mat_fallen_scythe', cnt: 1 }, { id: 'mat_fallen_head', cnt: 1 }] }
    ],
    // 🔥 小惡魔（炎魔謁見所）：惡魔腳鐐 + 墮落素材 → 惡魔系列武器
    npc_imp: [
        { result: 'wpn_demon_sword', req: [{ id: 'mat_fallen_poison', cnt: 1 }, { id: 'mat_demon_anklet_black', cnt: 5 }, { id: 'mat_demon_anklet_red', cnt: 10 }, { id: 'mat_demon_anklet_blue', cnt: 5 }, { id: 'mat_demon_anklet_white', cnt: 5 }] },
        { result: 'wpn_demon_claw',  req: [{ id: 'mat_fallen_hand', cnt: 1 }, { id: 'mat_demon_anklet_black', cnt: 5 }, { id: 'mat_demon_anklet_red', cnt: 5 }, { id: 'mat_demon_anklet_blue', cnt: 5 }, { id: 'mat_demon_anklet_white', cnt: 10 }] },
        { result: 'wpn_demon_dual',  req: [{ id: 'mat_fallen_fang', cnt: 1 }, { id: 'mat_demon_anklet_black', cnt: 5 }, { id: 'mat_demon_anklet_red', cnt: 5 }, { id: 'mat_demon_anklet_blue', cnt: 10 }, { id: 'mat_demon_anklet_white', cnt: 5 }] },
        { result: 'wpn_demon_xbow',  req: [{ id: 'mat_fallen_tongue', cnt: 1 }, { id: 'mat_demon_anklet_black', cnt: 10 }, { id: 'mat_demon_anklet_red', cnt: 5 }, { id: 'mat_demon_anklet_blue', cnt: 5 }, { id: 'mat_demon_anklet_white', cnt: 5 }] }
    ],
    // 🔥 炎魔鐵匠（炎魔謁見所）：金屬板鍛造
    npc_flame_smith: [
        { result: 'mat_silver_plate', req: [{ id: 'mat_silver', cnt: 5 }, { id: 'new_item_180', cnt: 5 }, { id: 'gold', cnt: 1000 }] },
        { result: 'mat_blackmithril_plate', req: [{ id: 'mat_black_mithril', cnt: 10 }, { id: 'mat_silver_plate', cnt: 1 }, { id: 'new_item_177', cnt: 1 }, { id: 'new_item_178', cnt: 1 }, { id: 'gold', cnt: 10000 }] },
        { result: 'item_shadow_temple_key', req: [{ id: 'mat_soulstone_shard', cnt: 10 }, { id: 'gold', cnt: 1000000 }] }
    ],
    // 🗼 巴姆特（傲慢之塔入口）：詛咒的皮革 與 屬性斗篷
    npc_bamut: [
        { result: 'mat_cursed_leather_earth', req: [{ id: 'mat_chimera_snake', cnt: 5 }, { id: 'gold', cnt: 500 }] },
        { result: 'mat_cursed_leather_water', req: [{ id: 'mat_chimera_dragon', cnt: 5 }, { id: 'gold', cnt: 500 }] },
        { result: 'mat_cursed_leather_wind',  req: [{ id: 'mat_chimera_goat', cnt: 5 }, { id: 'gold', cnt: 500 }] },
        { result: 'mat_cursed_leather_fire',  req: [{ id: 'mat_chimera_lion', cnt: 5 }, { id: 'gold', cnt: 500 }] },
        { result: 'clk_pride_earth', req: [{ id: 'mat_cursed_leather_earth', cnt: 100 }, { id: 'new_item_191', cnt: 3 }, { id: 'new_item_151', cnt: 30 }, { id: 'new_item_174', cnt: 50 }, { id: 'gold', cnt: 100000 }] },
        { result: 'clk_pride_water', req: [{ id: 'mat_cursed_leather_water', cnt: 100 }, { id: 'new_item_190', cnt: 3 }, { id: 'new_item_154', cnt: 30 }, { id: 'new_item_174', cnt: 50 }, { id: 'gold', cnt: 100000 }] },
        { result: 'clk_pride_wind',  req: [{ id: 'mat_cursed_leather_wind', cnt: 100 }, { id: 'new_item_193', cnt: 3 }, { id: 'new_item_160', cnt: 30 }, { id: 'new_item_174', cnt: 50 }, { id: 'gold', cnt: 100000 }] },
        { result: 'clk_pride_fire',  req: [{ id: 'mat_cursed_leather_fire', cnt: 100 }, { id: 'new_item_192', cnt: 3 }, { id: 'new_item_157', cnt: 30 }, { id: 'new_item_174', cnt: 50 }, { id: 'gold', cnt: 100000 }] }
    ],
    npc_tas: [
        { result: 'panacea_str', req: [{ id: 'panacea_white', cnt: 3 }] },
        { result: 'panacea_dex', req: [{ id: 'panacea_white', cnt: 3 }] },
        { result: 'panacea_int', req: [{ id: 'panacea_white', cnt: 3 }] },
        { result: 'panacea_con', req: [{ id: 'panacea_white', cnt: 3 }] },
        { result: 'panacea_wis', req: [{ id: 'panacea_white', cnt: 3 }] },
        { result: 'panacea_cha', req: [{ id: 'panacea_white', cnt: 3 }] }
    ],
    'npc_moli': [
        {
            result: 'arm_48', // 皮帽子
            req: [{ id: 'new_item_180', cnt: 1 }, { id: 'new_item_179', cnt: 5 }]
        },
        {
            result: 'arm_111', // 皮盾牌
            req: [{ id: 'new_item_179', cnt: 7 }]
        },
        {
            result: 'arm_91', // 皮涼鞋
            req: [{ id: 'new_item_180', cnt: 2 }, { id: 'new_item_179', cnt: 6 }]
        },
        {
            result: 'arm_75', // 皮背心
            req: [{ id: 'new_item_179', cnt: 10 }]
        },
        {
            result: 'arm_49', // 皮頭盔
            req: [
                { id: 'arm_48', cnt: 1 }, { id: 'arm_42', cnt: 1 }, 
                { id: 'new_item_182', cnt: 5 }, { id: 'new_item_180', cnt: 5 }
            ]
        },
        {
            result: 'arm_78', // 硬皮背心
            req: [
                { id: 'arm_77', cnt: 1 }, { id: 'new_item_182', cnt: 15 }, 
                { id: 'new_item_180', cnt: 15 }
            ]
        },
        {
            result: 'new_item_181', // 皮帶
            req: [{ id: 'new_item_182', cnt: 5 }, { id: 'new_item_180', cnt: 2 }]
        },
        {
            result: 'arm_76', // 皮盔甲
            req: [{ id: 'arm_75', cnt: 1 }, { id: 'new_item_181', cnt: 1 }]
        },
        {
            result: 'arm_93', // 皮長靴
            req: [
                { id: 'arm_92', cnt: 1 }, { id: 'new_item_182', cnt: 10 }, 
                { id: 'new_item_180', cnt: 10 }, { id: 'gold', cnt: 300 } // 👈 支援金幣需求
            ]
        },
        {
            result: 'new_item_182', // 高級皮革
            req: [{ id: 'new_item_179', cnt: 20 }]
        }
    ],
// 👇 新增布拉伯的配方區塊
    'npc_brabo': [
        {
            result: 'wpn_40', // 覆上米索莉的角
            req: [{ id: 'wpn_39', cnt: 2 }, { id: 'new_item_169', cnt: 80 }]
        },
        {
            result: 'wpn_41', // 覆上奧里哈魯根的角
            req: [{ id: 'wpn_39', cnt: 4 }, { id: 'new_item_173', cnt: 80 }, { id: 'new_item_157', cnt: 3 }]
        },
        {
            result: 'wpn_34', // 短劍的劍身
            req: [{ id: 'new_item_elfwing', cnt: 1 }, { id: 'new_item_169', cnt: 50 }]
        },
        {
            result: 'wpn_35', // 長劍的劍身
            req: [{ id: 'new_item_elfwing', cnt: 3 }, { id: 'new_item_169', cnt: 150 }]
        },
        {
            result: 'wpn_36', // 奧里哈魯根的劍身
            req: [{ id: 'new_item_elfwing', cnt: 3 }, { id: 'new_item_157', cnt: 3 }, { id: 'new_item_173', cnt: 150 }]
        }
    ],
// 👇 新增芬與法林的配方區塊
    'npc_finn': [
        { result: 'hlm_silver', req: [{ id: 'arm_48', cnt: 1 }, { id: 'new_item_182', cnt: 2 }, { id: 'new_item_180', cnt: 10 }] },
        { result: 'arm_112', req: [{ id: 'arm_111', cnt: 1 }, { id: 'new_item_182', cnt: 5 }, { id: 'new_item_180', cnt: 20 }] },
        { result: 'arm_92', req: [{ id: 'arm_91', cnt: 1 }, { id: 'new_item_182', cnt: 3 }, { id: 'new_item_180', cnt: 12 }] },
        { result: 'arm_77', req: [{ id: 'arm_75', cnt: 1 }, { id: 'new_item_182', cnt: 2 }, { id: 'new_item_180', cnt: 10 }] }
    ],
    'npc_falin': [
        { result: 'hlm_silver', req: [{ id: 'arm_48', cnt: 1 }, { id: 'new_item_182', cnt: 2 }, { id: 'new_item_180', cnt: 10 }] },
        { result: 'arm_112', req: [{ id: 'arm_111', cnt: 1 }, { id: 'new_item_182', cnt: 5 }, { id: 'new_item_180', cnt: 20 }] },
        { result: 'arm_92', req: [{ id: 'arm_91', cnt: 1 }, { id: 'new_item_182', cnt: 3 }, { id: 'new_item_180', cnt: 12 }] },
        { result: 'arm_77', req: [{ id: 'arm_75', cnt: 1 }, { id: 'new_item_182', cnt: 2 }, { id: 'new_item_180', cnt: 10 }] }
    ],
// (接在 npc_falin 區塊的下方)
    // 👇 新增喬爾與萊恩的配方區塊
    'npc_joel': [
        { result: 'shd_bone', req: [{ id: 'arm_112', cnt: 1 }, { id: 'new_item_183', cnt: 15 }, { id: 'gold', cnt: 800 }] },
        { result: 'amr_bone', req: [{ id: 'arm_78', cnt: 1 }, { id: 'new_item_183', cnt: 20 }, { id: 'gold', cnt: 500 }] },
        { result: 'hlm_bone', req: [{ id: 'arm_49', cnt: 1 }, { id: 'new_item_183', cnt: 10 }, { id: 'gold', cnt: 800 }] }
    ],
    'npc_ryan': [
        { result: 'shd_bone', req: [{ id: 'arm_112', cnt: 1 }, { id: 'new_item_183', cnt: 15 }, { id: 'gold', cnt: 800 }] },
        { result: 'amr_bone', req: [{ id: 'arm_78', cnt: 1 }, { id: 'new_item_183', cnt: 20 }, { id: 'gold', cnt: 500 }] },
        { result: 'hlm_bone', req: [{ id: 'arm_49', cnt: 1 }, { id: 'new_item_183', cnt: 10 }, { id: 'gold', cnt: 800 }] }
    ],
// 👇 新增妖精森林全系列配方
    'npc_nalien': [
        { result: 'new_item_176', req: [{ id: 'new_item_172', cnt: 1 }, { id: 'new_item_173', cnt: 10 }] }
    ],
    'npc_rekne': [
        { result: 'new_item_168', req: [{ id: 'new_item_163', cnt: 1 }] },
        { result: 'new_item_174', req: [{ id: 'new_item_168', cnt: 1 }, { id: 'new_item_169', cnt: 5 }] },
        { result: 'new_item_171', req: [{ id: 'new_item_237', cnt: 2 }] },
        { result: 'new_item_175', req: [{ id: 'new_item_172', cnt: 3 }] }
    ],
    'npc_narupa': [
        { result: 'wpn_15', req: [{ id: 'wpn_34', cnt: 1 }, { id: 'new_item_237', cnt: 10 }, { id: 'new_item_169', cnt: 90 }, { id: 'new_item_171', cnt: 10 }] },
        { result: 'arm_70', req: [{ id: 'new_item_172', cnt: 2 }, { id: 'new_item_163', cnt: 5 }] },
        { result: 'arm_74', req: [{ id: 'new_item_237', cnt: 10 }, { id: 'new_item_168', cnt: 6 }] },
        { result: 'arm_109', req: [{ id: 'new_item_172', cnt: 1 }, { id: 'new_item_237', cnt: 5 }, { id: 'new_item_171', cnt: 5 }] },
        { result: 'wpn_rapier', req: [{ id: 'wpn_36', cnt: 1 }, { id: 'new_item_elfwing', cnt: 2 }, { id: 'new_item_171', cnt: 25 }, { id: 'new_item_173', cnt: 50 }, { id: 'new_item_158', cnt: 1 }] },
        { result: 'wpn_mailbreaker', req: [{ id: 'wpn_34', cnt: 1 }, { id: 'wpn_40', cnt: 1 }, { id: 'new_item_237', cnt: 10 }, { id: 'new_item_171', cnt: 50 }, { id: 'new_item_151', cnt: 1 }] },
        { result: 'wpn_10', req: [{ id: 'new_item_237', cnt: 10 }, { id: 'new_item_171', cnt: 5 }] },
        { result: 'wpn_30', yield: 10, req: [{ id: 'new_item_237', cnt: 1 }, { id: 'new_item_169', cnt: 1 }] }, // 產出 10
        { result: 'arm_90', req: [{ id: 'new_item_175', cnt: 2 }, { id: 'new_item_168', cnt: 10 }] },
        { result: 'arm_44', req: [{ id: 'hlm_elf', cnt: 1 }, { id: 'new_item_178', cnt: 3 }, { id: 'new_item_174', cnt: 150 }, { id: 'new_item_150', cnt: 5 }, { id: 'new_item_161', cnt: 1 }, { id: 'new_item_155', cnt: 1 }, { id: 'new_item_152', cnt: 1 }] },
        { result: 'hlm_elf', req: [{ id: 'new_item_172', cnt: 2 }, { id: 'new_item_elfwing', cnt: 1 }, { id: 'new_item_163', cnt: 10 }, { id: 'new_item_171', cnt: 20 }] },
        { result: 'wpn_elfsword', req: [{ id: 'wpn_35', cnt: 1 }, { id: 'new_item_237', cnt: 5 }, { id: 'new_item_169', cnt: 150 }, { id: 'new_item_171', cnt: 50 }] },
        { result: 'wpn_dagger2', req: [{ id: 'new_item_237', cnt: 1 }, { id: 'new_item_164', cnt: 1 }] },
        { result: 'clk_elf', req: [{ id: 'new_item_174', cnt: 10 }, { id: 'new_item_150', cnt: 2 }, { id: 'new_item_165', cnt: 6 }] },
        { result: 'shd_elf', req: [{ id: 'arm_109', cnt: 1 }, { id: 'new_item_177', cnt: 2 }, { id: 'new_item_171', cnt: 5 }] },
        { result: 'arm_73', req: [{ id: 'new_item_177', cnt: 4 }, { id: 'new_item_174', cnt: 10 }] },
        { result: 'wpn_24', req: [{ id: 'wpn_40', cnt: 1 }, { id: 'new_item_237', cnt: 10 }, { id: 'new_item_171', cnt: 30 }] },
        { result: 'arm_72', req: [{ id: 'new_item_178', cnt: 8 }, { id: 'new_item_174', cnt: 20 }, { id: 'new_item_153', cnt: 1 }] },
        { result: 'wpn_elfbow', req: [{ id: 'new_item_237', cnt: 10 }, { id: 'new_item_164', cnt: 1 }, { id: 'new_item_175', cnt: 2 }, { id: 'new_item_168', cnt: 2 }] },
        { result: 'arm_71', req: [{ id: 'new_item_175', cnt: 2 }, { id: 'new_item_168', cnt: 10 }] },
        { result: 'wpn_29', req: [{ id: 'new_item_178', cnt: 6 }, { id: 'wpn_41', cnt: 1 }, { id: 'new_item_174', cnt: 40 }, { id: 'new_item_175', cnt: 5 }, { id: 'new_item_155', cnt: 2 }, { id: 'new_item_152', cnt: 1 }] },
        { result: 'wpn_battleaxe', req: [{ id: 'wpn_34', cnt: 1 }, { id: 'new_item_237', cnt: 10 }, { id: 'new_item_164', cnt: 3 }, { id: 'new_item_171', cnt: 5 }] },
        { result: 'bot_short', req: [{ id: 'new_item_172', cnt: 2 }, { id: 'new_item_168', cnt: 4 }] },
        { result: 'wpn_31', req: [{ id: 'new_item_178', cnt: 3 }, { id: 'new_item_elfwing', cnt: 8 }, { id: 'new_item_174', cnt: 20 }, { id: 'new_item_171', cnt: 30 }] },
        { result: 'arm_99', req: [{ id: 'new_item_174', cnt: 20 }, { id: 'new_item_175', cnt: 5 }, { id: 'new_item_152', cnt: 1 }, { id: 'new_item_167', cnt: 1 }] },
        { result: 'wpn_halberd', req: [{ id: 'wpn_24', cnt: 1 }, { id: 'wpn_41', cnt: 1 }, { id: 'new_item_173', cnt: 60 }, { id: 'new_item_171', cnt: 50 }, { id: 'new_item_158', cnt: 1 }] },
        { result: 'wpn_5', yield: 100, req: [{ id: 'new_item_237', cnt: 10 }] }, // 產出 100
        { result: 'wpn_3', req: [{ id: 'new_item_237', cnt: 1 }, { id: 'new_item_168', cnt: 5 }] },
        { result: 'arm_98', req: [{ id: 'new_item_172', cnt: 3 }, { id: 'new_item_174', cnt: 20 }] }
    ],
    'npc_elfqueen': [
        { result: 'new_item_173', req: [{ id: 'new_item_169', cnt: 10 }] },
        { result: 'wpn_shaha_bow', req: [{ id: 'wpn_29', cnt: 1 }, { id: 'mat_griffon_feather', cnt: 30 }, { id: 'item_wind_tear', cnt: 50 }, { id: 'new_item_193', cnt: 15 }] }
    ],
    'npc_elf': [
        { result: 'new_item_169', yield: 20, req: [{ id: 'new_item_164', cnt: 1 }] }, // 產出 20
        { result: 'new_item_170', yield: 20, req: [{ id: 'new_item_165', cnt: 1 }] }, // 產出 20
        { result: 'new_item_elfwing', req: [{ id: 'new_item_174', cnt: 5 }, { id: 'new_item_165', cnt: 2 }] }
    ],
    'npc_ent': [
        { result: 'new_item_172', req: [{ id: 'new_item_166', cnt: 1 }] }
    ],
    'npc_pan': [
        { result: 'new_item_177', req: [{ id: 'new_item_169', cnt: 50 }, { id: 'new_item_175', cnt: 1 }] },
        { result: 'new_item_178', req: [{ id: 'new_item_173', cnt: 30 }, { id: 'new_item_175', cnt: 1 }] },
        { result: 'wpn_39', req: [{ id: 'new_item_176', cnt: 1 }] }
    ],
// 👇 新增羅賓孫的配方（妖精森林：熾炎天使弓）
    'npc_robinson': [
        { result: 'wpn_flaming_angel', req: [
            { id: 'mat_unicorn_horn', cnt: 4 },
            { id: 'mat_wind_breath', cnt: 30 },
            { id: 'mat_water_breath', cnt: 30 },
            { id: 'mat_fire_breath', cnt: 30 },
            { id: 'mat_earth_breath', cnt: 30 },
            { id: 'mat_griffon_feather', cnt: 30 },
            { id: 'new_item_152', cnt: 10 },   // 品質鑽石
            { id: 'new_item_158', cnt: 10 },   // 品質紅寶石
            { id: 'new_item_161', cnt: 10 },   // 品質藍寶石
            { id: 'new_item_155', cnt: 10 },   // 品質綠寶石
            { id: 'new_item_153', cnt: 1 },    // 高品質鑽石
            { id: 'new_item_159', cnt: 1 },    // 高品質紅寶石
            { id: 'new_item_162', cnt: 1 },    // 高品質藍寶石
            { id: 'new_item_156', cnt: 1 },    // 高品質綠寶石
            { id: 'new_item_195', cnt: 1000 }  // 精靈玉
        ] }
    ],
// 👇 新增庫普的配方（沉默洞穴：銀與黑暗妖精鋼爪/雙刀/十字弓；武器皆支援席琳製作）
    'npc_kupu': [
        { result: 'mat_silver',      req: [{ id: 'mat_silverore', cnt: 10 }, { id: 'gold', cnt: 500 }] },
        { result: 'wpn_claw_dark',   req: [{ id: 'new_item_182', cnt: 10 }, { id: 'new_item_180', cnt: 10 }, { id: 'mat_blackstone3', cnt: 5 }, { id: 'mat_blackstone2', cnt: 100 }] },
        { result: 'wpn_claw_silver', req: [{ id: 'wpn_claw_dark', cnt: 1 }, { id: 'new_item_182', cnt: 10 }, { id: 'mat_silver', cnt: 30 }, { id: 'new_item_180', cnt: 10 }, { id: 'mat_blackstone4', cnt: 1 }, { id: 'mat_blackstone2', cnt: 40 }, { id: 'new_item_151', cnt: 1 }] },
        { result: 'wpn_claw_gloom',  req: [{ id: 'wpn_claw_dark', cnt: 1 }, { id: 'new_item_182', cnt: 10 }, { id: 'new_item_180', cnt: 10 }, { id: 'mat_blackstone4', cnt: 10 }, { id: 'mat_blackstone3', cnt: 100 }] },
        { result: 'wpn_dual_dark',   req: [{ id: 'new_item_182', cnt: 20 }, { id: 'new_item_180', cnt: 10 }, { id: 'mat_blackstone2', cnt: 100 }] },
        { result: 'wpn_dual_silver', req: [{ id: 'wpn_dual_dark', cnt: 1 }, { id: 'new_item_182', cnt: 20 }, { id: 'mat_silver', cnt: 20 }, { id: 'new_item_180', cnt: 10 }, { id: 'mat_blackstone4', cnt: 1 }, { id: 'mat_blackstone2', cnt: 50 }, { id: 'new_item_151', cnt: 1 }] },
        { result: 'wpn_dual_gloom',  req: [{ id: 'wpn_dual_dark', cnt: 1 }, { id: 'new_item_182', cnt: 20 }, { id: 'new_item_180', cnt: 10 }, { id: 'mat_blackstone4', cnt: 5 }, { id: 'mat_blackstone3', cnt: 100 }] },
        { result: 'wpn_xbow_dark',   req: [{ id: 'new_item_182', cnt: 30 }, { id: 'new_item_180', cnt: 10 }, { id: 'mat_blackstone3', cnt: 10 }, { id: 'mat_blackstone2', cnt: 100 }] },
        { result: 'wpn_xbow_gloom',  req: [{ id: 'wpn_xbow_dark', cnt: 1 }, { id: 'new_item_182', cnt: 30 }, { id: 'new_item_180', cnt: 10 }, { id: 'mat_blackstone4', cnt: 20 }, { id: 'mat_blackstone3', cnt: 100 }] }
    ],
// 👇 新增奇岩製作 NPC 的配方
    'npc_moliya': [
        { result: 'hlm_mage', req: [{ id: 'new_item_189', cnt: 1 }, { id: 'new_item_188', cnt: 1 }, { id: 'new_item_187', cnt: 1 }, { id: 'new_item_150', cnt: 20 }, { id: 'new_item_155', cnt: 2 }] },
        { result: 'amr_magerobe', req: [{ id: 'new_item_189', cnt: 2 }, { id: 'new_item_162', cnt: 1 }, { id: 'new_item_187', cnt: 4 }, { id: 'new_item_150', cnt: 25 }] }
    ],
    'npc_hector': [
        { result: 'hlm_steel', req: [{ id: 'arm_43', cnt: 1 }, { id: 'new_item_180', cnt: 120 }, { id: 'gold', cnt: 16500 }] },
        { result: 'arm_113', req: [{ id: 'arm_108', cnt: 1 }, { id: 'new_item_180', cnt: 200 }, { id: 'gold', cnt: 16000 }] },
        { result: 'arm_94', req: [{ id: 'arm_90', cnt: 1 }, { id: 'new_item_180', cnt: 160 }, { id: 'gold', cnt: 8000 }] },
        { result: 'arm_100', req: [{ id: 'glv_glove', cnt: 1 }, { id: 'new_item_180', cnt: 150 }, { id: 'gold', cnt: 25000 }] },
        { result: 'arm_79', req: [{ id: 'amr_plate', cnt: 1 }, { id: 'new_item_180', cnt: 450 }, { id: 'gold', cnt: 30000 }] },
        { result: 'hlm_frost', req: [{ id: 'hlm_icequeen_charm', cnt: 1 }, { id: 'arm_43', cnt: 1 }, { id: 'gold', cnt: 50000 }] },
        { result: 'amr_frost', req: [{ id: 'amr_icequeen_charm', cnt: 1 }, { id: 'amr_plate', cnt: 1 }, { id: 'gold', cnt: 50000 }] },
        { result: 'bot_frost', req: [{ id: 'bot_icequeen_charm', cnt: 1 }, { id: 'arm_90', cnt: 1 }, { id: 'gold', cnt: 50000 }] }
    ],
    'npc_herbert': [
        { result: 'clk_mr', req: [{ id: 'new_item_189', cnt: 1 }, { id: 'new_item_188', cnt: 10 }, { id: 'new_item_187', cnt: 2 }, { id: 'gold', cnt: 1000 }] },
        { result: 'arm_87', req: [{ id: 'new_item_189', cnt: 10 }, { id: 'new_item_188', cnt: 5 }, { id: 'new_item_187', cnt: 5 }, { id: 'gold', cnt: 20000 }] },
        { result: 'tsh_tshirt', req: [{ id: 'new_item_189', cnt: 10 }, { id: 'new_item_188', cnt: 3 }, { id: 'new_item_187', cnt: 2 }, { id: 'gold', cnt: 30000 }] }
    ],
// 👇 新增海音與歐瑞製作 NPC 的配方
    'npc_lumiel': [
        { result: 'acc_135', req: [{ id: 'blt_body', cnt: 1 }, { id: 'new_item_221', cnt: 50 }, { id: 'new_item_158', cnt: 20 }, { id: 'new_item_161', cnt: 20 }, { id: 'new_item_155', cnt: 20 }, { id: 'new_item_152', cnt: 20 }, { id: 'gold', cnt: 100000 }] },
        { result: 'acc_137', req: [{ id: 'acc_131', cnt: 1 }, { id: 'new_item_221', cnt: 50 }, { id: 'new_item_158', cnt: 20 }, { id: 'new_item_161', cnt: 20 }, { id: 'new_item_155', cnt: 20 }, { id: 'new_item_152', cnt: 20 }, { id: 'gold', cnt: 100000 }] },
        { result: 'acc_136', req: [{ id: 'acc_130', cnt: 1 }, { id: 'new_item_221', cnt: 50 }, { id: 'new_item_158', cnt: 20 }, { id: 'new_item_161', cnt: 20 }, { id: 'new_item_155', cnt: 20 }, { id: 'new_item_152', cnt: 20 }, { id: 'gold', cnt: 100000 }] },
        { result: 'arm_95', req: [{ id: 'arm_90', cnt: 1 }, { id: 'new_item_221', cnt: 30 }, { id: 'new_item_mermaid_scale', cnt: 30 }] },
        { result: 'blt_body', req: [{ id: 'acc_127', cnt: 1 }, { id: 'new_item_221', cnt: 20 }, { id: 'new_item_157', cnt: 30 }, { id: 'new_item_160', cnt: 30 }, { id: 'new_item_154', cnt: 30 }, { id: 'new_item_151', cnt: 30 }, { id: 'gold', cnt: 50000 }] },
        { result: 'acc_131', req: [{ id: 'acc_129', cnt: 1 }, { id: 'new_item_221', cnt: 20 }, { id: 'new_item_157', cnt: 30 }, { id: 'new_item_160', cnt: 30 }, { id: 'new_item_154', cnt: 30 }, { id: 'new_item_151', cnt: 30 }, { id: 'gold', cnt: 50000 }] },
        { result: 'acc_130', req: [{ id: 'acc_128', cnt: 1 }, { id: 'new_item_221', cnt: 20 }, { id: 'new_item_157', cnt: 30 }, { id: 'new_item_160', cnt: 30 }, { id: 'new_item_154', cnt: 30 }, { id: 'new_item_151', cnt: 30 }, { id: 'gold', cnt: 50000 }] },
        { result: 'arm_107', req: [{ id: 'arm_108', cnt: 1 }, { id: 'new_item_mermaid_scale', cnt: 100 }, { id: 'new_item_190', cnt: 10 }] }
    ],
    'npc_ibelbin': [
        { result: 'wpn_siruge', req: [{ id: 'new_item_194', cnt: 300 }, { id: 'new_item_173', cnt: 500 }, { id: 'new_item_159', cnt: 5 }, { id: 'new_item_162', cnt: 5 }, { id: 'new_item_156', cnt: 5 }, { id: 'new_item_153', cnt: 5 }, { id: 'new_item_192', cnt: 3 }] },
        { result: 'arm_80', req: [{ id: 'new_item_194', cnt: 150 }, { id: 'new_item_173', cnt: 1000 }, { id: 'new_item_159', cnt: 3 }, { id: 'new_item_162', cnt: 3 }, { id: 'new_item_156', cnt: 3 }, { id: 'new_item_153', cnt: 3 }, { id: 'new_item_174', cnt: 500 }, { id: 'new_item_190', cnt: 15 }] },
        { result: 'arm_82', req: [{ id: 'new_item_194', cnt: 150 }, { id: 'new_item_173', cnt: 1000 }, { id: 'new_item_159', cnt: 3 }, { id: 'new_item_162', cnt: 3 }, { id: 'new_item_156', cnt: 3 }, { id: 'new_item_153', cnt: 3 }, { id: 'new_item_174', cnt: 500 }, { id: 'new_item_192', cnt: 15 }] },
        { result: 'arm_81', req: [{ id: 'new_item_194', cnt: 150 }, { id: 'new_item_173', cnt: 1000 }, { id: 'new_item_159', cnt: 3 }, { id: 'new_item_162', cnt: 3 }, { id: 'new_item_156', cnt: 3 }, { id: 'new_item_153', cnt: 3 }, { id: 'new_item_174', cnt: 500 }, { id: 'new_item_191', cnt: 15 }] },
        { result: 'arm_83', req: [{ id: 'new_item_194', cnt: 150 }, { id: 'new_item_173', cnt: 1000 }, { id: 'new_item_159', cnt: 3 }, { id: 'new_item_162', cnt: 3 }, { id: 'new_item_156', cnt: 3 }, { id: 'new_item_153', cnt: 3 }, { id: 'new_item_174', cnt: 500 }, { id: 'new_item_193', cnt: 15 }] }
    ],
    // 👇 奇岩・倫提斯：四屬性精靈戒指（四軍團印記各×10 ＋ 對應軍王徽印×1）
    'npc_lentis': [
        { result: 'rng_earth', req: [{ id: 'mat_legion_necro', cnt: 10 }, { id: 'mat_legion_law', cnt: 10 }, { id: 'mat_legion_beast', cnt: 10 }, { id: 'mat_legion_assassin', cnt: 10 }, { id: 'mat_crest_beast', cnt: 1 }] },
        { result: 'rng_water', req: [{ id: 'mat_legion_necro', cnt: 10 }, { id: 'mat_legion_law', cnt: 10 }, { id: 'mat_legion_beast', cnt: 10 }, { id: 'mat_legion_assassin', cnt: 10 }, { id: 'mat_crest_law', cnt: 1 }] },
        { result: 'rng_wind', req: [{ id: 'mat_legion_necro', cnt: 10 }, { id: 'mat_legion_law', cnt: 10 }, { id: 'mat_legion_beast', cnt: 10 }, { id: 'mat_legion_assassin', cnt: 10 }, { id: 'mat_crest_assassin', cnt: 1 }] },
        { result: 'rng_fire', req: [{ id: 'mat_legion_necro', cnt: 10 }, { id: 'mat_legion_law', cnt: 10 }, { id: 'mat_legion_beast', cnt: 10 }, { id: 'mat_legion_assassin', cnt: 10 }, { id: 'mat_crest_necro', cnt: 1 }] }
    ],
    // 🏛️ 威頓村・客盧亞：古代神之槍／斧（古代臂甲×2 已改由貝希摩斯・皮爾製作）
    'npc_zeus_golem': [
        { result: 'wpn_demon_axehead', req: [{ id: 'wpn_demon_axe', cnt: 1 }, { id: 'mat_blackmithril_plate', cnt: 5 }] }
    ],
    // 👑 拉比安尼（說話之島）：王族特殊級魔法書＝飛龍之心＋高崙之心＋冰之女王之心＋不死鳥之心 各1
    'npc_rabiani': [
        { result: 'bk_royal_burnweapon', req: [{ id: 'mat_dragon_heart', cnt: 1 }, { id: 'mat_golem_heart', cnt: 1 }, { id: 'mat_icequeen_heart', cnt: 1 }, { id: 'new_phoenix_heart', cnt: 1 }] },
        { result: 'bk_royal_bravewill',  req: [{ id: 'mat_dragon_heart', cnt: 1 }, { id: 'mat_golem_heart', cnt: 1 }, { id: 'mat_icequeen_heart', cnt: 1 }, { id: 'new_phoenix_heart', cnt: 1 }] },
        { result: 'bk_royal_shield',     req: [{ id: 'mat_dragon_heart', cnt: 1 }, { id: 'mat_golem_heart', cnt: 1 }, { id: 'mat_icequeen_heart', cnt: 1 }, { id: 'new_phoenix_heart', cnt: 1 }] },
        { result: 'bk_royal_kingguard',  req: [{ id: 'mat_dragon_heart', cnt: 1 }, { id: 'mat_golem_heart', cnt: 1 }, { id: 'mat_icequeen_heart', cnt: 1 }, { id: 'new_phoenix_heart', cnt: 1 }] }
    ],
    'npc_keluya': [
        { result: 'wpn_ancient_spear', req: [{ id: 'item_unknown_spear', cnt: 1 }, { id: 'item_ancient_scroll', cnt: 10 }, { id: 'new_item_153', cnt: 10 }, { id: 'new_phoenix_heart', cnt: 1 }, { id: 'new_item_178', cnt: 50 }, { id: 'mat_soulstone_shard', cnt: 500 }] },
        { result: 'wpn_ancient_axe', req: [{ id: 'mat_unknown_axe', cnt: 1 }, { id: 'item_ancient_scroll', cnt: 10 }, { id: 'new_item_159', cnt: 10 }, { id: 'new_phoenix_heart', cnt: 1 }, { id: 'new_item_177', cnt: 50 }, { id: 'mat_soulstone_shard', cnt: 500 }] }
    ],
    // 🐉 v3.7.57 威頓村・米米：地龍之魔眼解封＋4 古代龍鱗盔甲＋4 安塔瑞斯系列盔甲（規格書配方）
    'npc_mimi': [
        { result: 'acc_earth_dragon_eye', req: [{ id: 'item_sealed_earth_eye', cnt: 1 }, { id: 'gold', cnt: 1000000 }] },
        { result: 'arm_ancient_dragonscale_earth', req: [{ id: 'arm_81', cnt: 1 }, { id: 'mat_blackmithril_plate', cnt: 3 }, { id: 'new_item_152', cnt: 30 }, { id: 'mat_golem_heart', cnt: 5 }, { id: 'gold', cnt: 500000 }] },
        { result: 'arm_ancient_dragonscale_water', req: [{ id: 'arm_80', cnt: 1 }, { id: 'mat_blackmithril_plate', cnt: 3 }, { id: 'new_item_155', cnt: 30 }, { id: 'mat_icequeen_heart', cnt: 5 }, { id: 'gold', cnt: 500000 }] },
        { result: 'arm_ancient_dragonscale_fire', req: [{ id: 'arm_82', cnt: 1 }, { id: 'mat_blackmithril_plate', cnt: 3 }, { id: 'new_item_158', cnt: 30 }, { id: 'new_phoenix_heart', cnt: 5 }, { id: 'gold', cnt: 500000 }] },
        { result: 'arm_ancient_dragonscale_wind', req: [{ id: 'arm_83', cnt: 1 }, { id: 'mat_blackmithril_plate', cnt: 3 }, { id: 'new_item_161', cnt: 30 }, { id: 'mat_dragon_heart', cnt: 5 }, { id: 'gold', cnt: 500000 }] },
        { result: 'arm_antharas_power',   req: [{ id: 'arm_ancient_dragonscale_earth', cnt: 1 }, { id: 'mat_antharas_heart', cnt: 2 }, { id: 'new_item_153', cnt: 3 }, { id: 'new_item_150', cnt: 500 }, { id: 'new_item_195', cnt: 500 }] },
        { result: 'arm_antharas_charm',   req: [{ id: 'arm_ancient_dragonscale_earth', cnt: 1 }, { id: 'mat_antharas_heart', cnt: 2 }, { id: 'new_item_153', cnt: 3 }, { id: 'new_item_150', cnt: 500 }, { id: 'new_item_195', cnt: 500 }] },
        { result: 'arm_antharas_spring',  req: [{ id: 'arm_ancient_dragonscale_earth', cnt: 1 }, { id: 'mat_antharas_heart', cnt: 2 }, { id: 'new_item_153', cnt: 3 }, { id: 'new_item_150', cnt: 500 }, { id: 'new_item_195', cnt: 500 }] },
        { result: 'arm_antharas_majesty', req: [{ id: 'arm_ancient_dragonscale_earth', cnt: 1 }, { id: 'mat_antharas_heart', cnt: 2 }, { id: 'new_item_153', cnt: 3 }, { id: 'new_item_150', cnt: 500 }, { id: 'new_item_195', cnt: 500 }] }
    ],
    // 🐉 貝希摩斯・皮爾：破滅者鎖鏈劍 ＋ 古代臂甲（×2，自客盧亞移交）
    'npc_pir': [
        { result: 'wpn_chain_destroyer', req: [{ id: 'item_forgotten_greatsword', cnt: 1 }, { id: 'new_item_171', cnt: 20 }, { id: 'new_item_182', cnt: 20 }, { id: 'new_item_192', cnt: 1 }, { id: 'gold', cnt: 1000000 }] },
        { result: 'armguard_archer', req: [{ id: 'item_forgotten_leather', cnt: 1 }, { id: 'new_item_175', cnt: 20 }, { id: 'new_item_172', cnt: 50 }, { id: 'mat_blackmithril_plate', cnt: 3 }, { id: 'new_item_174', cnt: 50 }, { id: 'new_item_elfwing', cnt: 20 }] },
        { result: 'armguard_fighter', req: [{ id: 'item_forgotten_plate', cnt: 1 }, { id: 'mat_blackmithril_plate', cnt: 5 }, { id: 'new_item_174', cnt: 50 }, { id: 'gold', cnt: 1000000 }] }
    ],
    // 🏛️ 象牙塔・迪泰特（解除封印）：受封印 被遺忘的裝備 ＋ 古代的卷軸 → 古老系列（成品為武器/盔甲，自動提供「席琳製作」）
    'npc_dytite': [
        { result: 'wpn_old_sword', req: [{ id: 'item_forgotten_sword', cnt: 1 }, { id: 'item_ancient_scroll', cnt: 1 }] },
        { result: 'wpn_old_greatsword', req: [{ id: 'item_forgotten_greatsword', cnt: 1 }, { id: 'item_ancient_scroll', cnt: 1 }] },
        { result: 'wpn_old_xbow', req: [{ id: 'item_forgotten_xbow', cnt: 1 }, { id: 'item_ancient_scroll', cnt: 1 }] },
        { result: 'amr_old_scale', req: [{ id: 'item_forgotten_scale', cnt: 1 }, { id: 'item_ancient_scroll', cnt: 1 }] },
        { result: 'amr_old_leather', req: [{ id: 'item_forgotten_leather', cnt: 1 }, { id: 'item_ancient_scroll', cnt: 1 }] },
        { result: 'amr_old_robe', req: [{ id: 'item_forgotten_robe', cnt: 1 }, { id: 'item_ancient_scroll', cnt: 1 }] },
        { result: 'amr_old_plate', req: [{ id: 'item_forgotten_plate', cnt: 1 }, { id: 'item_ancient_scroll', cnt: 1 }] }
    ],
    // 🔷🔶 象牙塔・神秘的魔法師（魔杖改造）：僅有客製配方（見 MYSTICWAND_RECIPES），空陣列讓 renderUniversalCraft 通過並附加客製區塊
    'npc_mystic_mage': [],
    // 🌑 v3.3.33 長老會議廳・亞提利歐（黑暗妖精聖地.md）：召喚球合成＋真．冥皇系列防具鍛造
    npc_atelier: [
        { result: 'item_summonorb_full', req: [{ id: 'mat_summonorb_core', cnt: 1 }, { id: 'mat_summonorb_shard', cnt: 4 }] },
        { result: 'mat_emperor_manual',  req: [{ id: 'mat_summonorb_core', cnt: 1 }, { id: 'mat_summonorb_shard', cnt: 4 }] },
        { result: 'clk_emperor', req: [{ id: 'mat_emperor_manual', cnt: 1 }, { id: 'mat_ascetic_classic', cnt: 5 },  { id: 'mat_de_soul_crystal', cnt: 50 },  { id: 'mat_black_powder', cnt: 15 }, { id: 'arm_official_cloak', cnt: 1 }, { id: 'mat_blackmithril_plate', cnt: 5 },  { id: 'new_item_159', cnt: 10 }] },
        { result: 'amr_emperor', req: [{ id: 'mat_emperor_manual', cnt: 1 }, { id: 'mat_ascetic_classic', cnt: 10 }, { id: 'mat_de_soul_crystal', cnt: 100 }, { id: 'mat_black_powder', cnt: 30 }, { id: 'amr_official', cnt: 1 },        { id: 'mat_blackmithril_plate', cnt: 10 }, { id: 'new_item_153', cnt: 20 }] },
        { result: 'hlm_emperor', req: [{ id: 'mat_emperor_manual', cnt: 1 }, { id: 'mat_ascetic_classic', cnt: 5 },  { id: 'mat_de_soul_crystal', cnt: 50 },  { id: 'mat_black_powder', cnt: 15 }, { id: 'hlm_official', cnt: 1 },        { id: 'mat_blackmithril_plate', cnt: 5 },  { id: 'new_item_162', cnt: 10 }] },
        { result: 'glv_emperor', req: [{ id: 'mat_emperor_manual', cnt: 1 }, { id: 'mat_ascetic_classic', cnt: 5 },  { id: 'mat_de_soul_crystal', cnt: 50 },  { id: 'mat_black_powder', cnt: 15 }, { id: 'glv_official', cnt: 1 },        { id: 'mat_blackmithril_plate', cnt: 5 },  { id: 'new_item_156', cnt: 10 }] },
        { result: 'bot_emperor', req: [{ id: 'mat_emperor_manual', cnt: 1 }, { id: 'mat_ascetic_classic', cnt: 5 },  { id: 'mat_de_soul_crystal', cnt: 50 },  { id: 'mat_black_powder', cnt: 15 }, { id: 'bot_official', cnt: 1 },        { id: 'mat_blackmithril_plate', cnt: 5 },  { id: 'new_item_153', cnt: 10 }] },
        // 🌑 靈魂耳環系列（淨化藥水＝四大氣息×10＋品質綠寶石；受詛咒黑色耳環＋淨化藥水→對應職業靈魂耳環）
        { result: 'mat_purify_potion', req: [{ id: 'mat_earth_breath', cnt: 10 }, { id: 'mat_wind_breath', cnt: 10 }, { id: 'mat_water_breath', cnt: 10 }, { id: 'mat_fire_breath', cnt: 10 }, { id: 'new_item_155', cnt: 1 }] },
        { result: 'ear_soul_mage',    req: [{ id: 'ear_cursed_black', cnt: 1 }, { id: 'mat_purify_potion', cnt: 1 }] },
        { result: 'ear_soul_fighter', req: [{ id: 'ear_cursed_black', cnt: 1 }, { id: 'mat_purify_potion', cnt: 1 }] },
        { result: 'ear_soul_knight',  req: [{ id: 'ear_cursed_black', cnt: 1 }, { id: 'mat_purify_potion', cnt: 1 }] }
    ]
};

// 製作數量選擇器 + 製作按鈕（預設數量 1）
function craftActionHtml(npcId, idx) {
    // 🔮 席琳製作：成品為 武器/頭盔/盔甲/手套/長靴/斗篷/腰帶 時，於「製作」旁多一顆按鈕
    //（消耗相同材料＋每件 1 個席琳結晶，成品必定附帶隨機席琳套裝效果；其餘詞綴機率照舊）
    let _r = CRAFT_RECIPES[npcId] && CRAFT_RECIPES[npcId][idx];
    let _rd = _r && DB.items[_r.result];
    let _shOk = false;   // 🦴 v3.1.68 席琳製作綠鈕全面移除：套裝詞綴不再出現於裝備上（改由席琳遺骸承載·NPC 伊奧兌換）；原判定＝_rd && !player.classicMode && sherineSetEligible(_rd)
    let _shBtn = _shOk ? `<button class="btn bg-green-900 hover:bg-green-800 border-green-600 py-2 px-3 font-bold shadow" onclick="doCraft('${npcId}', ${idx}, true)" title="消耗相同材料＋每件 1 個席琳結晶：成品必定附帶一種席琳套裝效果"><span class="c-sherine">席琳製作</span></button>` : '';
    return `<div class="flex items-center gap-2 shrink-0">
        <input type="number" min="1" value="1" id="craft-qty-${npcId}-${idx}" onclick="event.stopPropagation()" class="w-14 px-1 py-2 bg-slate-900 border border-slate-600 rounded text-center text-white font-bold">
        <button class="btn bg-blue-700 hover:bg-blue-600 border-blue-500 py-2 px-6 font-bold shadow" onclick="doCraft('${npcId}', ${idx})">製作</button>
        ${_shBtn}
    </div>`;
}

function renderUniversalCraft(div, npcId) {
    let recipes = CRAFT_RECIPES[npcId];
    if (!recipes) return;
    if (!RECIPE_BY_RESULT) buildRecipeIndex();
    let html = '';
    
    recipes.forEach((r, idx) => {
        let resItem = DB.items[r.result];
        let outCnt = r.yield || 1;
        // 如果產出大於 1，就在名稱後面標示數量 (例如: 箭 (x100))
        let resName = resItem.n + (outCnt > 1 ? ` <span class="text-yellow-400 text-sm">(x${outCnt})</span>` : '');
        
        let reqHtml = craftReqHtml(r.req);

        let imgUrl = getIconUrl(resItem);
        
        html += `
        <div class="list-item bg-slate-800 rounded mb-2 border border-slate-700 p-3 hover:bg-slate-700 transition-colors" style="display:flex !important; justify-content:space-between !important; align-items:center !important; width:100% !important; box-sizing:border-box !important;">
            <div class="flex items-center gap-4 min-w-0 flex-1">
                <div class="w-12 h-12 bg-slate-900 rounded border border-slate-600 flex items-center justify-center shrink-0 tip-host" data-tip-id="${r.result}" data-tip-craft="1">
                    <img src="${imgUrl}" onerror="this.style.display='none';" class="w-10 h-10 object-contain pointer-events-none">
                </div>
                <div class="flex flex-col items-start gap-1.5">
                    <span class="${getItemColor({ id: r.result })} font-bold text-lg leading-none truncate">${resName}</span>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-slate-400 text-sm">需求：</span>${reqHtml}
                    </div>
                </div>
            </div>
            ${craftActionHtml(npcId, idx)}
        </div>
        `;
    });
    div.innerHTML = html;
    if (npcId === 'npc_flame_shadow') div.innerHTML += buildDemonKingCraftHTML();   // 👑 炎魔之影：在通用配方下方附加惡魔王武器客製製作區
    if (npcId === 'npc_lumiel') div.innerHTML += buildLumielCraftHTML();   // ⚔️ 琉米埃爾：在通用配方下方附加神聖執行團裝備客製製作區
    if (npcId === 'npc_mystic_mage') div.innerHTML += buildMysticWandCraftHTML();   // 🔷🔶 神秘的魔法師：鋼鐵瑪那魔杖客製製作區（該 NPC 無通用配方）
    if (npcId === 'npc_zeus_golem') div.innerHTML += buildSlayerCraftHTML();   // 🔥 宙斯之熔岩高崙：在通用配方下方附加滅魔裝備客製製作區
}

// ===== 👑 惡魔王武器客製製作（炎魔之影）：消耗 +11 以上「指定」惡魔武器，繼承其強化值／詞綴／席琳套裝效果；不支援席琳製作 =====
const DEMONKING_MATS = [{ id: 'mat_soulstone_shard', cnt: 300 }, { id: 'mat_blackmithril_plate', cnt: 5 }, { id: 'mat_death_head', cnt: 1 }, { id: 'mat_chaos_head', cnt: 1 }];
const DEMONKING_RECIPES = [
    { result: 'wpn_demonking_spear',   src: 'wpn_demon_xbow',  srcName: '惡魔十字弓' },
    { result: 'wpn_demonking_dual',    src: 'wpn_demon_dual',  srcName: '惡魔雙刀' },
    { result: 'wpn_demonking_2hsword', src: 'wpn_demon_sword', srcName: '惡魔之劍' },
    { result: 'wpn_demonking_wand',    src: 'wpn_demon_sword', srcName: '惡魔之劍' },
    { result: 'wpn_demonking_bow',     src: 'wpn_demon_xbow',  srcName: '惡魔十字弓' },
];
// 背包＋倉庫中可作素材的 +11 以上指定惡魔武器：優先「有席琳套裝」者，其次「強化值最高」者；未鎖定
function findDemonKingSource(srcId) {
    let cands = player.inv.filter(i => i.id === srcId && (i.en || 0) >= 11 && !i.lock);
    try { loadWarehouse().items.filter(i => i.id === srcId && (i.en || 0) >= 11 && !i.lock).forEach(i => cands.push(Object.assign({}, i, { _whSource: true }))); } catch (e) {}   // 🔧 倉庫中的 +11 惡魔武器亦可作素材（_whSource 標記：消耗時自倉庫精準扣除）
    if (!cands.length) return null;
    let withSet = cands.filter(i => i.seteff);
    let pool = (withSet.length ? withSet : cands).slice().sort((a, b) => (b.en || 0) - (a.en || 0));
    return pool[0];
}
function buildDemonKingCraftHTML() {
    let html = `<div class="text-amber-300 font-bold text-sm mt-4 mb-2 px-1 border-t border-slate-700 pt-3">👑 惡魔王武器（消耗 +11 以上指定惡魔武器，繼承其強化值／詞綴／席琳套裝效果；不支援席琳製作）</div>`;
    DEMONKING_RECIPES.forEach((r, idx) => {
        let resItem = DB.items[r.result];
        let imgUrl = getIconUrl(resItem);
        let matsOk = DEMONKING_MATS.every(m => materialObtainable(m.id, m.cnt));   // 🔧 含「可遞迴合成」：黑色米索莉金屬板等中間物可自底層材料自動補製，不必先手動製作（與通用製作 doCraft 一致）
        let src = findDemonKingSource(r.src);
        let canMake = matsOk && !!src;
        let srcColor = src ? 'text-green-400' : 'text-red-400';
        let srcExtra = src ? `（將消耗 +${src.en || 0}${src.seteff ? '・席琳套裝' : ''}）` : '';
        let reqHtml = craftReqHtml(DEMONKING_MATS)
            + `<span class="text-slate-500 mx-2 leading-none">+</span><span class="text-sm font-bold leading-none ${srcColor}">+11以上 ${r.srcName} ×1</span><span class="text-amber-300 text-xs ml-0.5">${srcExtra}</span>`;
        html += `
        <div class="list-item bg-slate-800 rounded mb-2 border border-slate-700 p-3" style="display:flex !important; justify-content:space-between !important; align-items:center !important; width:100% !important; box-sizing:border-box !important;">
            <div class="flex items-center gap-4 min-w-0 flex-1">
                <div class="w-12 h-12 bg-slate-900 rounded border border-slate-600 flex items-center justify-center shrink-0 tip-host" data-tip-id="${r.result}" data-tip-craft="1">
                    <img src="${imgUrl}" onerror="this.style.display='none';" class="w-10 h-10 object-contain pointer-events-none">
                </div>
                <div class="flex flex-col items-start gap-1.5">
                    <span class="${getItemColor({ id: r.result })} font-bold text-lg leading-none truncate">${resItem.n}</span>
                    <div class="flex items-center gap-2 flex-wrap"><span class="text-slate-400 text-sm">需求：</span>${reqHtml}</div>
                </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <button class="btn ${canMake ? 'bg-blue-700 hover:bg-blue-600 border-blue-500' : 'bg-slate-700 border-slate-600 opacity-60'} py-2 px-6 font-bold shadow" ${canMake ? '' : 'disabled'} onclick="doDemonKingCraft(${idx})">製作</button>
            </div>
        </div>`;
    });
    return html;
}
function doDemonKingCraft(idx) {
    let r = DEMONKING_RECIPES[idx];
    if (!r) return;
    if (!RECIPE_BY_RESULT) buildRecipeIndex();
    let lack = DEMONKING_MATS.filter(m => !materialObtainable(m.id, m.cnt)).map(m => `${DB.items[m.id].n} ${Math.max(0, m.cnt - invCountId(m.id))}`);   // 🔧 可遞迴合成者不算缺
    let src = findDemonKingSource(r.src);
    if (!src) lack.push(`+11以上 ${r.srcName} ×1`);
    if (lack.length) { logSys(`<span class="text-red-400 font-bold">材料不足，無法製作。</span><span class="text-red-300">（尚缺：${lack.join('、')}）</span>`); return; }
    DEMONKING_MATS.forEach(m => ensureMaterial(m.id, m.cnt, 0));   // 🔧 先自動補製可合成的中間物（黑色米索莉金屬板等），玩家不需先手動製作金屬板
    DEMONKING_MATS.forEach(m => consumeMaterialById(m.id, m.cnt));
    let inherit = { en: src.en || 0, attr: src.attr || false, bless: src.bless ? src.bless : rollAffixesNew(0.10).bless, anc: src.anc || false, seteff: src.seteff || false };   // 🔧 祝福傳承：來源祝福/詛咒→沿用；來源無詞綴→製作 10% 重骰祝福
    if (src._whSource) { whRemoveStackByUid(src.uid, 1); }   // 🔧 來源武器在倉庫：自倉庫精準消耗該實例
    else if ((src.cnt || 1) > 1) src.cnt -= 1; else player.inv = player.inv.filter(i => i.uid !== src.uid);   // 消耗 1 把來源惡魔武器（背包）
    let inst = { id: r.result, uid: uid(), cnt: 1, en: inherit.en, attr: inherit.attr, bless: inherit.bless, anc: inherit.anc, seteff: inherit.seteff, lock: false };
    player.inv.push(inst);
    if (typeof registerEquipObtained === 'function') registerEquipObtained(inst.id);   // 🗡️ 客製製作直推 inv（未經 gainItem）→ 需手動登錄裝備收集冊，否則圖鑑保持暗直到重登(ensureEquipBook 補登)
    logSys(`<span class="text-amber-200 font-bold">炎魔之影</span> 製作完成：<span class="${getItemColor(inst)} font-bold">${getItemFullName(inst)}</span>${inherit.seteff ? '（繼承席琳套裝效果）' : ''}`);
    updateUI(); renderTabs(true); saveGame();
    renderUniversalCraft(document.getElementById('interaction-content'), 'npc_flame_shadow');
}
// ===== ⚔️ 琉米埃爾（海音）神聖執行團裝備客製製作：消耗 +7 以上「戰士團」頭盔／斗篷，繼承其強化值／詞綴 =====
const LUMIEL_RECIPES = [
    { result: 'hlm_holy_corps', src: 'hlm_warrior_corps', srcName: '戰士團頭盔', mats: [{ id: 'new_item_153', cnt: 1 }, { id: 'new_item_158', cnt: 5 }, { id: 'new_item_160', cnt: 30 }, { id: 'new_item_154', cnt: 30 }] },
    { result: 'clk_holy_corps', src: 'clk_warrior_corps', srcName: '戰士團斗篷', mats: [{ id: 'new_item_156', cnt: 1 }, { id: 'new_item_161', cnt: 5 }, { id: 'new_item_157', cnt: 30 }, { id: 'new_item_151', cnt: 30 }] },
];
function findLumielSource(srcId) {
    let cands = player.inv.filter(i => i.id === srcId && (i.en || 0) >= 7 && !i.lock);
    try { loadWarehouse().items.filter(i => i.id === srcId && (i.en || 0) >= 7 && !i.lock).forEach(i => cands.push(Object.assign({}, i, { _whSource: true }))); } catch (e) {}   // 🔧 倉庫中的 +7 戰士團裝備亦可作素材
    if (!cands.length) return null;
    let withSet = cands.filter(i => i.seteff);
    let pool = (withSet.length ? withSet : cands).slice().sort((a, b) => (b.en || 0) - (a.en || 0));
    return pool[0];
}
function buildLumielCraftHTML() {
    let html = `<div class="text-amber-300 font-bold text-sm mt-4 mb-2 px-1 border-t border-slate-700 pt-3">⚔️ 神聖執行團裝備（消耗 +7 以上戰士團裝備，繼承其強化值／詞綴）</div>`;
    LUMIEL_RECIPES.forEach((r, idx) => {
        let resItem = DB.items[r.result];
        let imgUrl = getIconUrl(resItem);
        let matsOk = r.mats.every(m => materialObtainable(m.id, m.cnt));   // 🔧 含可遞迴合成（與惡魔王武器/通用製作 doCraft 一致）
        let src = findLumielSource(r.src);
        let canMake = matsOk && !!src;
        let srcColor = src ? 'text-green-400' : 'text-red-400';
        let srcExtra = src ? `（將消耗 +${src.en || 0}${src.seteff ? '・席琳套裝' : ''}）` : '';
        let reqHtml = craftReqHtml(r.mats)
            + `<span class="text-slate-500 mx-2 leading-none">+</span><span class="text-sm font-bold leading-none ${srcColor}">+7以上 ${r.srcName} ×1</span><span class="text-amber-300 text-xs ml-0.5">${srcExtra}</span>`;
        html += `
        <div class="list-item bg-slate-800 rounded mb-2 border border-slate-700 p-3" style="display:flex !important; justify-content:space-between !important; align-items:center !important; width:100% !important; box-sizing:border-box !important;">
            <div class="flex items-center gap-4 min-w-0 flex-1">
                <div class="w-12 h-12 bg-slate-900 rounded border border-slate-600 flex items-center justify-center shrink-0 tip-host" data-tip-id="${r.result}" data-tip-craft="1">
                    <img src="${imgUrl}" onerror="this.style.display='none';" class="w-10 h-10 object-contain pointer-events-none">
                </div>
                <div class="flex flex-col items-start gap-1.5">
                    <span class="${getItemColor({ id: r.result })} font-bold text-lg leading-none truncate">${resItem.n}</span>
                    <div class="flex items-center gap-2 flex-wrap"><span class="text-slate-400 text-sm">需求：</span>${reqHtml}</div>
                </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <button class="btn ${canMake ? 'bg-blue-700 hover:bg-blue-600 border-blue-500' : 'bg-slate-700 border-slate-600 opacity-60'} py-2 px-6 font-bold shadow" ${canMake ? '' : 'disabled'} onclick="doLumielCraft(${idx})">製作</button>
            </div>
        </div>`;
    });
    return html;
}
function doLumielCraft(idx) {
    let r = LUMIEL_RECIPES[idx];
    if (!r) return;
    if (!RECIPE_BY_RESULT) buildRecipeIndex();
    let lack = r.mats.filter(m => !materialObtainable(m.id, m.cnt)).map(m => `${DB.items[m.id].n} ${Math.max(0, m.cnt - invCountId(m.id))}`);   // 🔧 可遞迴合成者不算缺
    let src = findLumielSource(r.src);
    if (!src) lack.push(`+7以上 ${r.srcName} ×1`);
    if (lack.length) { logSys(`<span class="text-red-400 font-bold">材料不足，無法製作。</span><span class="text-red-300">（尚缺：${lack.join('、')}）</span>`); return; }
    r.mats.forEach(m => ensureMaterial(m.id, m.cnt, 0));   // 🔧 先自動補製可合成的中間物，玩家不需先手動製作
    r.mats.forEach(m => consumeMaterialById(m.id, m.cnt));
    let inherit = { en: src.en || 0, attr: src.attr || false, bless: src.bless ? src.bless : rollAffixesNew(0.10).bless, anc: src.anc || false, seteff: src.seteff || false };   // 🔧 祝福傳承：來源祝福/詛咒→沿用；來源無詞綴→製作 10% 重骰祝福
    if (src._whSource) { whRemoveStackByUid(src.uid, 1); }   // 來源裝備在倉庫：自倉庫精準消耗
    else if ((src.cnt || 1) > 1) src.cnt -= 1; else player.inv = player.inv.filter(i => i.uid !== src.uid);   // 消耗 1 件來源戰士團裝備（背包）
    let inst = { id: r.result, uid: uid(), cnt: 1, en: inherit.en, attr: inherit.attr, bless: inherit.bless, anc: inherit.anc, seteff: inherit.seteff, lock: false };
    player.inv.push(inst);
    if (typeof registerEquipObtained === 'function') registerEquipObtained(inst.id);   // 🗡️ 客製製作直推 inv（未經 gainItem）→ 需手動登錄裝備收集冊，否則圖鑑保持暗直到重登(ensureEquipBook 補登)
    logSys(`<span class="text-amber-200 font-bold">琉米埃爾</span> 製作完成：<span class="${getItemColor(inst)} font-bold">${getItemFullName(inst)}</span>`);
    updateUI(); renderTabs(true); saveGame();
    renderUniversalCraft(document.getElementById('interaction-content'), 'npc_lumiel');
}

// ===== 🔷🔶 鋼鐵瑪那魔杖客製製作（象牙塔・神秘的魔法師）：消耗 +7 以上的來源魔杖，成品恆為 +0 白板（不繼承強化值／屬性／詞綴） =====
const MYSTICWAND_MATS = [{ id: 'new_item_150', cnt: 50 }, { id: 'new_item_180', cnt: 100 }];   // 魔法寶石 ×50 ＋ 金屬塊 ×100
const MYSTICWAND_RECIPES = [
    { result: 'wpn_steel_manawand_blue', src: 'wpn_manawand', srcName: '瑪那魔杖' },
    { result: 'wpn_steel_manawand_red',  src: 'wpn_strwand',  srcName: '力量魔法杖' },
];
// 背包＋倉庫中可作素材的 +7 以上來源魔杖；未鎖定。成品為 +0 白板 → 挑「最不值錢」的那把：強化值最低者優先，同強化值再避開有詞綴／屬性／席琳套裝者。
function findMysticWandSource(srcId) {
    let cands = player.inv.filter(i => i.id === srcId && (i.en || 0) >= 7 && !i.lock);
    try { loadWarehouse().items.filter(i => i.id === srcId && (i.en || 0) >= 7 && !i.lock).forEach(i => cands.push(Object.assign({}, i, { _whSource: true }))); } catch (e) {}   // 🔧 倉庫中的 +7 魔杖亦可作素材（_whSource 標記：消耗時自倉庫精準扣除）
    if (!cands.length) return null;
    let _extra = i => (i.seteff ? 4 : 0) + (i.bless ? 2 : 0) + (i.attr ? 1 : 0);   // 附加價值愈高愈晚被消耗
    return cands.slice().sort((a, b) => ((a.en || 0) - (b.en || 0)) || (_extra(a) - _extra(b)))[0];
}
function buildMysticWandCraftHTML() {
    let html = `<div class="text-amber-300 font-bold text-sm mt-4 mb-2 px-1 border-t border-slate-700 pt-3">🔮 鋼鐵瑪那魔杖（消耗 +7 以上的來源魔杖；成品為 +0）</div>`;
    MYSTICWAND_RECIPES.forEach((r, idx) => {
        let resItem = DB.items[r.result];
        let imgUrl = getIconUrl(resItem);
        let matsOk = MYSTICWAND_MATS.every(m => materialObtainable(m.id, m.cnt));   // 🔧 含可遞迴合成（與惡魔王武器／琉米埃爾一致）
        let src = findMysticWandSource(r.src);
        let canMake = matsOk && !!src;
        let srcColor = src ? 'text-green-400' : 'text-red-400';
        let srcExtra = src ? `（將消耗 +${src.en || 0}）` : '';
        let reqHtml = craftReqHtml(MYSTICWAND_MATS)
            + `<span class="text-slate-500 mx-2 leading-none">+</span><span class="text-sm font-bold leading-none ${srcColor}">+7以上 ${r.srcName} ×1</span><span class="text-amber-300 text-xs ml-0.5">${srcExtra}</span>`;
        html += `
        <div class="list-item bg-slate-800 rounded mb-2 border border-slate-700 p-3" style="display:flex !important; justify-content:space-between !important; align-items:center !important; width:100% !important; box-sizing:border-box !important;">
            <div class="flex items-center gap-4 min-w-0 flex-1">
                <div class="w-12 h-12 bg-slate-900 rounded border border-slate-600 flex items-center justify-center shrink-0 tip-host" data-tip-id="${r.result}" data-tip-craft="1">
                    <img src="${imgUrl}" onerror="this.style.display='none';" class="w-10 h-10 object-contain pointer-events-none">
                </div>
                <div class="flex flex-col items-start gap-1.5">
                    <span class="${getItemColor({ id: r.result })} font-bold text-lg leading-none truncate">${resItem.n}</span>
                    <div class="flex items-center gap-2 flex-wrap"><span class="text-slate-400 text-sm">需求：</span>${reqHtml}</div>
                </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <button class="btn ${canMake ? 'bg-blue-700 hover:bg-blue-600 border-blue-500' : 'bg-slate-700 border-slate-600 opacity-60'} py-2 px-6 font-bold shadow" ${canMake ? '' : 'disabled'} onclick="doMysticWandCraft(${idx})">製作</button>
            </div>
        </div>`;
    });
    return html;
}
function doMysticWandCraft(idx) {
    let r = MYSTICWAND_RECIPES[idx];
    if (!r) return;
    if (!RECIPE_BY_RESULT) buildRecipeIndex();
    let lack = MYSTICWAND_MATS.filter(m => !materialObtainable(m.id, m.cnt)).map(m => `${DB.items[m.id].n} ${Math.max(0, m.cnt - invCountId(m.id))}`);   // 🔧 可遞迴合成者不算缺
    let src = findMysticWandSource(r.src);
    if (!src) lack.push(`+7以上 ${r.srcName} ×1`);
    if (lack.length) { logSys(`<span class="text-red-400 font-bold">材料不足，無法製作。</span><span class="text-red-300">（尚缺：${lack.join('、')}）</span>`); return; }
    MYSTICWAND_MATS.forEach(m => ensureMaterial(m.id, m.cnt, 0));   // 🔧 先自動補製可合成的中間物
    MYSTICWAND_MATS.forEach(m => consumeMaterialById(m.id, m.cnt));
    if (src._whSource) { whRemoveStackByUid(src.uid, 1); }   // 來源魔杖在倉庫：自倉庫精準消耗該實例
    else if ((src.cnt || 1) > 1) src.cnt -= 1; else player.inv = player.inv.filter(i => i.uid !== src.uid);   // 消耗 1 把來源魔杖（背包）
    gainItem(r.result, 1, true, false, false, false, null, 0.10);   // 成品恆 +0（不繼承來源強化值／屬性／詞綴）；製作 10% 祝福
    logSys(`<span class="text-amber-200 font-bold">神秘的魔法師</span> 製作完成：<span class="${getItemColor({ id: r.result })} font-bold">${DB.items[r.result].n}</span>`);
    updateUI(); renderTabs(true); saveGame();
    renderUniversalCraft(document.getElementById('interaction-content'), 'npc_mystic_mage');
}

// ===== 🔥 滅魔裝備客製製作（威頓村・宙斯之熔岩高崙·依《滅魔裝備.md》）：消耗 +7 以上抗魔法鏈甲，成品恆為 +0（不繼承強化值／詞綴）=====
//   來源鏈甲的挑選重用 findMysticWandSource（背包＋倉庫·+7 以上·未鎖定·挑最不值錢那件）。
const SLAYER_SRC_ID = 'arm_69', SLAYER_SRC_NAME = '抗魔法鏈甲';
const SLAYER_RECIPES = [
    { result: 'amr_slayer_plate', mats: [{ id: 'amr_old_plate',   cnt: 1 }, { id: 'gold', cnt: 10000000 }] },
    { result: 'amr_slayer_scale', mats: [{ id: 'amr_old_scale',   cnt: 1 }, { id: 'gold', cnt: 10000000 }] },
    { result: 'amr_slayer_vine',  mats: [{ id: 'amr_old_leather', cnt: 1 }, { id: 'gold', cnt: 10000000 }] },
    { result: 'amr_slayer_shawl', mats: [{ id: 'amr_old_robe',    cnt: 1 }, { id: 'gold', cnt: 10000000 }] },
];
function buildSlayerCraftHTML() {
    let html = `<div class="text-amber-300 font-bold text-sm mt-4 mb-2 px-1 border-t border-slate-700 pt-3">🔥 滅魔裝備（消耗 +7 以上的抗魔法鏈甲；成品為 +0）</div>`;
    SLAYER_RECIPES.forEach((r, idx) => {
        let resItem = DB.items[r.result];
        let imgUrl = getIconUrl(resItem);
        let matsOk = r.mats.every(m => materialObtainable(m.id, m.cnt));
        let src = findMysticWandSource(SLAYER_SRC_ID);
        let canMake = matsOk && !!src;
        let srcColor = src ? 'text-green-400' : 'text-red-400';
        let srcExtra = src ? `（將消耗 +${src.en || 0}）` : '';
        let reqHtml = craftReqHtml(r.mats)
            + `<span class="text-slate-500 mx-2 leading-none">+</span><span class="text-sm font-bold leading-none ${srcColor}">+7以上 ${SLAYER_SRC_NAME} ×1</span><span class="text-amber-300 text-xs ml-0.5">${srcExtra}</span>`;
        html += `
        <div class="list-item bg-slate-800 rounded mb-2 border border-slate-700 p-3" style="display:flex !important; justify-content:space-between !important; align-items:center !important; width:100% !important; box-sizing:border-box !important;">
            <div class="flex items-center gap-4 min-w-0 flex-1">
                <div class="w-12 h-12 bg-slate-900 rounded border border-slate-600 flex items-center justify-center shrink-0 tip-host" data-tip-id="${r.result}" data-tip-craft="1">
                    <img src="${imgUrl}" onerror="this.style.display='none';" class="w-10 h-10 object-contain pointer-events-none">
                </div>
                <div class="flex flex-col items-start gap-1.5">
                    <span class="${getItemColor({ id: r.result })} font-bold text-lg leading-none truncate">${resItem.n}</span>
                    <div class="flex items-center gap-2 flex-wrap"><span class="text-slate-400 text-sm">需求：</span>${reqHtml}</div>
                </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <button class="btn ${canMake ? 'bg-blue-700 hover:bg-blue-600 border-blue-500' : 'bg-slate-700 border-slate-600 opacity-60'} py-2 px-6 font-bold shadow" ${canMake ? '' : 'disabled'} onclick="doSlayerCraft(${idx})">製作</button>
            </div>
        </div>`;
    });
    return html;
}
function doSlayerCraft(idx) {
    let r = SLAYER_RECIPES[idx];
    if (!r) return;
    if (!RECIPE_BY_RESULT) buildRecipeIndex();
    let lack = r.mats.filter(m => !materialObtainable(m.id, m.cnt)).map(m => m.id === 'gold' ? `金幣 ${Math.max(0, m.cnt - player.gold).toLocaleString()}` : `${DB.items[m.id].n} ${Math.max(0, m.cnt - invCountId(m.id))}`);
    let src = findMysticWandSource(SLAYER_SRC_ID);
    if (!src) lack.push(`+7以上 ${SLAYER_SRC_NAME} ×1`);
    if (lack.length) { logSys(`<span class="text-red-400 font-bold">材料不足，無法製作。</span><span class="text-red-300">（尚缺：${lack.join('、')}）</span>`); return; }
    r.mats.forEach(m => ensureMaterial(m.id, m.cnt, 0));   // 🔧 先自動補製可合成的中間物（古老的盔甲可由迪泰特配方遞迴合成）
    r.mats.forEach(m => consumeMaterialById(m.id, m.cnt));
    if (src._whSource) { whRemoveStackByUid(src.uid, 1); }   // 來源鏈甲在倉庫：自倉庫精準消耗該實例
    else if ((src.cnt || 1) > 1) src.cnt -= 1; else player.inv = player.inv.filter(i => i.uid !== src.uid);   // 消耗 1 件來源鏈甲（背包）
    gainItem(r.result, 1, true, false, false, false, null, 0.10);   // 成品恆 +0（不繼承來源強化值／詞綴）；製作 10% 祝福
    logSys(`<span class="text-amber-200 font-bold">宙斯之熔岩高崙</span> 製作完成：<span class="${getItemColor({ id: r.result })} font-bold">${DB.items[r.result].n}</span>`);
    updateUI(); renderTabs(true); saveGame();
    renderUniversalCraft(document.getElementById('interaction-content'), 'npc_zeus_golem');
}

// 2. 渲染茉莉的製作介面
function renderMoliCraft(div) {
    let recipes = CRAFT_RECIPES['npc_moli'];
    let html = '';
    
    recipes.forEach((r, idx) => {
        let resItem = DB.items[r.result];
        
        // 組合材料需求字串
        let reqHtml = craftReqHtml(r.req);

        let imgUrl = getIconUrl(resItem);
        
        html += `
        <div class="list-item bg-slate-800 rounded mb-2 border border-slate-700 p-3 hover:bg-slate-700 transition-colors" style="display:flex !important; justify-content:space-between !important; align-items:center !important; width:100% !important; box-sizing:border-box !important;">
            <div class="flex items-center gap-4 min-w-0 flex-1">
                <div class="w-12 h-12 bg-slate-900 rounded border border-slate-600 flex items-center justify-center shrink-0 tip-host" data-tip-id="${r.result}" data-tip-craft="1">
                    <img src="${imgUrl}" onerror="this.style.display='none';" class="w-10 h-10 object-contain pointer-events-none">
                </div>
                <div class="flex flex-col items-start gap-1.5">
                    <span class="${getItemColor({ id: r.result })} font-bold text-lg leading-none truncate">${resItem.n}</span>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-slate-400 text-sm">需求：</span>${reqHtml}
                    </div>
                </div>
            </div>
            ${craftActionHtml('npc_moli', idx)}
        </div>
        `;
    });
    div.innerHTML = html;
}
// 渲染布拉伯的製作介面
function renderBraboCraft(div) {
    let recipes = CRAFT_RECIPES['npc_brabo'];
    let html = '';
    
    recipes.forEach((r, idx) => {
        let resItem = DB.items[r.result];
        
        let reqHtml = craftReqHtml(r.req);

        let imgUrl = getIconUrl(resItem);
        
        html += `
        <div class="list-item bg-slate-800 rounded mb-2 border border-slate-700 p-3 hover:bg-slate-700 transition-colors" style="display:flex !important; justify-content:space-between !important; align-items:center !important; width:100% !important; box-sizing:border-box !important;">
            <div class="flex items-center gap-4 min-w-0 flex-1">
                <div class="w-12 h-12 bg-slate-900 rounded border border-slate-600 flex items-center justify-center shrink-0 tip-host" data-tip-id="${r.result}" data-tip-craft="1">
                    <img src="${imgUrl}" onerror="this.style.display='none';" class="w-10 h-10 object-contain pointer-events-none">
                </div>
                <div class="flex flex-col items-start gap-1.5">
                    <span class="${getItemColor({ id: r.result })} font-bold text-lg leading-none truncate">${resItem.n}</span>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-slate-400 text-sm">需求：</span>${reqHtml}
                    </div>
                </div>
            </div>
            ${craftActionHtml('npc_brabo', idx)}
        </div>
        `;
    });
    div.innerHTML = html;
}
function renderFinnCraft(div, npcId) {
    let recipes = CRAFT_RECIPES[npcId];
    let html = '';
    
    recipes.forEach((r, idx) => {
        let resItem = DB.items[r.result];
        
        let reqHtml = craftReqHtml(r.req);

        let imgUrl = getIconUrl(resItem);
        
        html += `
        <div class="list-item bg-slate-800 rounded mb-2 border border-slate-700 p-3 hover:bg-slate-700 transition-colors" style="display:flex !important; justify-content:space-between !important; align-items:center !important; width:100% !important; box-sizing:border-box !important;">
            <div class="flex items-center gap-4 min-w-0 flex-1">
                <div class="w-12 h-12 bg-slate-900 rounded border border-slate-600 flex items-center justify-center shrink-0 tip-host" data-tip-id="${r.result}" data-tip-craft="1">
                    <img src="${imgUrl}" onerror="this.style.display='none';" class="w-10 h-10 object-contain pointer-events-none">
                </div>
                <div class="flex flex-col items-start gap-1.5">
                    <span class="${getItemColor({ id: r.result })} font-bold text-lg leading-none truncate">${resItem.n}</span>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-slate-400 text-sm">需求：</span>${reqHtml}
                    </div>
                </div>
            </div>
            ${craftActionHtml(npcId, idx)}
        </div>
        `;
    });
    div.innerHTML = html;
}
function renderJoelCraft(div, npcId) {
    let recipes = CRAFT_RECIPES[npcId];
    let html = '';
    
    recipes.forEach((r, idx) => {
        let resItem = DB.items[r.result];
        
        let reqHtml = craftReqHtml(r.req);

        let imgUrl = getIconUrl(resItem);
        
        html += `
        <div class="list-item bg-slate-800 rounded mb-2 border border-slate-700 p-3 hover:bg-slate-700 transition-colors" style="display:flex !important; justify-content:space-between !important; align-items:center !important; width:100% !important; box-sizing:border-box !important;">
            <div class="flex items-center gap-4 min-w-0 flex-1">
                <div class="w-12 h-12 bg-slate-900 rounded border border-slate-600 flex items-center justify-center shrink-0 tip-host" data-tip-id="${r.result}" data-tip-craft="1">
                    <img src="${imgUrl}" onerror="this.style.display='none';" class="w-10 h-10 object-contain pointer-events-none">
                </div>
                <div class="flex flex-col items-start gap-1.5">
                    <span class="${getItemColor({ id: r.result })} font-bold text-lg leading-none truncate">${resItem.n}</span>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-slate-400 text-sm">需求：</span>${reqHtml}
                    </div>
                </div>
            </div>
            ${craftActionHtml(npcId, idx)}
        </div>
        `;
    });
    div.innerHTML = html;
}
// 3. 執行製作扣除材料與發放物品
// ===== 🔧 製作材料配色：所有「非裝備」的製作需求材料，名字統一丁香紫 =====
// 掃描全部配方的需求清單，物品類型不是 武器/防具/飾品 者套用 text-purple-300。
// 排除：金幣、席琳結晶（保留呼吸綠光 c-sherine）、試煉材料（同為合成材料時以試煉藍色優先）。
const QUEST_MATERIAL_IDS = [   // 試煉兌換材料＋卡瑞觸發道具（名字固定藍色，不被製作配色覆蓋）
    'new_item_196', 'new_item_198', 'new_item_199', 'new_item_200', 'new_item_201', 'new_item_202',
    'new_item_203', 'new_item_204', 'new_item_205', 'new_item_206', 'new_item_208',
    'new_item_212', 'new_item_213', 'new_item_214', 'new_item_240', 'new_item_144',
    'item_blueflute', 'item_ancientkey', 'item_nightvision',
    'item_dragon_claw', 'item_lizard_horn', 'item_crystal_ball', 'item_orc_amulet'
];
(function initCraftMaterialColors() {
    let seen = new Set();
    for (let npc in CRAFT_RECIPES) {
        (CRAFT_RECIPES[npc] || []).forEach(r => (r.req || []).forEach(q => {
            if (q.id === 'gold' || q.id === 'sherine_crystal' || QUEST_MATERIAL_IDS.includes(q.id) || seen.has(q.id)) return;
            seen.add(q.id);
            let d = DB.items[q.id];
            if (d && d.type !== 'wpn' && d.type !== 'arm' && d.type !== 'acc') d.c = 'text-purple-300';
        }));
    }
})();

// ===== 遞迴製作：前置材料足夠即可直接製作（自動補製中間物品，消耗最底層材料）=====
let RECIPE_BY_RESULT = null;
function buildRecipeIndex() {
    RECIPE_BY_RESULT = {};
    for (let npc in CRAFT_RECIPES) for (let r of CRAFT_RECIPES[npc]) {
        if (!RECIPE_BY_RESULT[r.result]) RECIPE_BY_RESULT[r.result] = r;
    }
}
// ===== 🔧 倉庫材料支援：製作與試煉兌換可動用共用倉庫的材料（背包優先、不足再扣倉庫；金幣僅算身上）=====
// ⚡ v3.5.93 同步任務內倉庫快照：loadWarehouse() 單次 1.18ms（localStorage 讀 ×2＋LZ 解壓 ×2＋JSON.parse 最多 5000 筆），
//    而製作面板一次渲染會呼叫 141 次（逐材料列的 invCountId/materialObtainable，加上 maxMakeRecipe 二分搜尋每步 buildPool）
//    → 娜路帕（29 配方／94 材料列）實測 329ms 主執行緒阻塞。
//    這裡不是 TTL 快取：queueMicrotask 會在「當前這個同步任務結束時」立刻清掉，
//    所以快取存活範圍 ＝ 恰好一次渲染／一次事件處理，跨使用者操作絕不可能拿到舊資料。
//    另由 js/12 saveWarehouse → _lkInvalidateWhCache() 一併清除，涵蓋「同一個同步區塊內先扣倉庫再重算」
//    的情形（doCraft → ensureMaterial → consumeMaterialById → whConsumeId 存檔後，下一次 invCountId 必須讀到新值）。
// ⚠️ 只給「唯讀」用途。任何會 mutate 倉庫物件再 saveWarehouse 的路徑（whConsumeId／whRemoveStackByUid）
//    一律直接呼叫 loadWarehouse()，不得走這裡，否則會改到共用實例。
let _whSyncCache = null;
function _whReadCached() {
    if (_whSyncCache) return _whSyncCache;
    let w = loadWarehouse();
    _whSyncCache = w;
    let clear = () => { _whSyncCache = null; };
    if (typeof queueMicrotask === 'function') queueMicrotask(clear); else Promise.resolve().then(clear);
    return w;
}
function whCountId(id) {
    if (id === 'gold') return 0;   // 倉庫金幣不列入材料計算
    try { let w = _whReadCached(); return w.items.filter(i => i.id === id && !i.lock).reduce((s, i) => s + i.cnt, 0); } catch (e) { return 0; }   // 🔒 鎖定件不算可用材料（與 whConsumeId 同口徑，否則會「顯示可做卻材料不足」）
}
function whConsumeId(id, n) {   // 自倉庫扣除最多 n 個（白板/低強化優先），回傳實際扣除數
    if (n <= 0) return 0;
    try {
        let w = loadWarehouse();
        let need = n, stacks = w.items.filter(i => i.id === id && !i.lock);   // 🔒 鎖定件不得當材料銷毀（與三個客製製作 findXxxSource 一致）
        stacks.sort((a, b) => (((a.en||0)*100)+(a.anc?10:0)+(a.bless?10:0)+(a.attr?10:0)+(a.seteff?50:0)) - (((b.en||0)*100)+(b.anc?10:0)+(b.bless?10:0)+(b.attr?10:0)+(b.seteff?50:0)));
        for (let st of stacks) { if (need <= 0) break; let d = Math.min(st.cnt, need); if (d > 0 && st.bless === true) _craftBlessCount += d; st.cnt -= d; need -= d; }   // 🔧 v3.1.27 倉庫祝福裝備材料件數累加
        w.items = w.items.filter(i => i.cnt == null || i.cnt > 0);   // ⚠️ null-safe：cnt 未定義的舊存檔物品不得被當成 0 而靜默刪除
        saveWarehouse(w);
        return n - need;
    } catch (e) { return 0; }
}
// 🔧 自倉庫精準移除指定 uid 的堆疊（n 預設 1）：強化/詞綴/席琳套裝武器作素材時，消耗該唯一實例
function whRemoveStackByUid(uid, n) {
    n = n || 1;
    try {
        let w = loadWarehouse();
        let idx = w.items.findIndex(i => i.uid === uid);
        if (idx < 0) return false;
        let st = w.items[idx];
        if ((st.cnt || 1) > n) st.cnt -= n; else w.items.splice(idx, 1);
        saveWarehouse(w);
        return true;
    } catch (e) { return false; }
}
// 試煉兌換用：背包＋倉庫合併計數 / 扣除
function questCountId(id) { return player.inv.filter(i => i.id === id && !i.lock).reduce((s, i) => s + i.cnt, 0) + whCountId(id); }   // 🔒 鎖定件不列入
// 🔒 v3.5.87 鎖定件另計（背包＋倉庫）：材料/任務道具「不足」時用來判斷是否因上鎖造成，
//    讓玩家知道「明明背包看得到卻說不足」的原因，而不是靜默卡死（製作/試煉交付共用）。
// ⚡ v3.5.89 倉庫端改「鎖定件索引＋500ms TTL 快取」：原本每次呼叫都整份 loadWarehouse()
//    （localStorage 讀 ×2＋LZ 解壓 ×2＋JSON.parse 最多 5000 筆），而 craftReqHtml 是逐材料列呼叫的熱路徑
//    → 倉庫接近滿時開啟配方最多的製作 NPC（娜路帕 29 配方／94 材料列）可多出數百 ms 主執行緒阻塞。
//    TTL 只影響「提示數字」的新鮮度（最壞慢 0.5 秒），完全不參與任何扣除/閘門判定，故安全。
let _lkWhIdx = null, _lkWhIdxAt = -99999, _lkWhIdxKey = '';
function _lkWhLockedIdx() {
    let k = '';
    try { k = whKey(); } catch (e) { k = ''; }
    let now = Date.now();
    if (_lkWhIdx && _lkWhIdxKey === k && (now - _lkWhIdxAt) < 500) return _lkWhIdx;
    let idx = {};
    try { for (let it of _whReadCached().items) if (it && it.lock) idx[it.id] = (idx[it.id] || 0) + (it.cnt || 1); } catch (e) {}
    _lkWhIdx = idx; _lkWhIdxAt = now; _lkWhIdxKey = k;
    return idx;
}
function _lkInvalidateWhCache() { _lkWhIdx = null; _whSyncCache = null; }   // 倉庫寫入後由 js/12 saveWarehouse 呼叫，避免存/取後提示數字還是舊的（⚡ v3.5.93 同步快照一併清，否則同一區塊內先扣倉庫再重算會讀到扣除前的量）
function lockedCountId(id) {
    let n = player.inv.filter(i => i.id === id && i.lock).reduce((s, i) => s + (i.cnt || 1), 0);
    return n + (_lkWhLockedIdx()[id] || 0);
}
// 🔒 產生「已上鎖不計」提示 HTML（無鎖定件回空字串）；ids 可傳單一 id 或陣列
function lockHintHtml(ids) {
    let arr = Array.isArray(ids) ? ids : [ids];
    let hit = [];
    for (let id of arr) { if (id === 'gold') continue; let n = lockedCountId(id); if (n > 0) hit.push({ id: id, n: n }); }   // ⚡ 每個 id 只算一次（原本 filter 一次、map 又一次）
    if (!hit.length) return '';
    return `<span class="text-slate-400">（提示：${hit.map(h => `${(DB.items[h.id] || {}).n || h.id} 有 ${h.n} 個已上鎖`).join('、')}·上鎖物品不會被使用，可解鎖後再試）</span>`;
}
function questConsumeId(id, n) {
    let need = n, _gone = new Set();
    for (let it of player.inv.filter(i => i.id === id && !i.lock)) { if (need <= 0) break; let d = Math.min(it.cnt, need); it.cnt -= d; need -= d; if (it.cnt <= 0) _gone.add(it.uid); }   // 🔒 鎖定件不得被任務兌換吃掉
    if (_gone.size) player.inv = player.inv.filter(i => !_gone.has(i.uid));   // ⚠️ uid 精準移除：舊寫法 filter(i=>i.cnt>0) 會把 cnt 未定義的舊存檔物品連同鎖定件一併靜默刪除
    if (need > 0) whConsumeId(id, need);
}

function invCountId(id) {
    if (id === 'gold') return player.gold;
    return player.inv.filter(i => i.id === id && !i.lock).reduce((s, i) => s + i.cnt, 0) + whCountId(id);   // 🔧 含倉庫存量　🔒 鎖定件不列入
}
function buildPool() {
    let pool = { gold: player.gold };
    for (let it of player.inv) if (!it.lock) pool[it.id] = (pool[it.id] || 0) + it.cnt;   // 🔒 與實際扣除口徑一致
    try { for (let it of _whReadCached().items) if (!it.lock) pool[it.id] = (pool[it.id] || 0) + it.cnt; } catch (e) {}   // 🔧 倉庫材料一併列入模擬池（⚡ 唯讀·pool 是每次新建的複本，不會動到快照）
    return pool;
}
function simulateMake(id, count, pool, depth) {
    if (count <= 0) return true;
    if (depth > 24) return false;
    let stock = pool[id] || 0, use = Math.min(stock, count);
    pool[id] = stock - use;
    let remain = count - use;
    if (remain <= 0) return true;
    if (id === 'gold') return false;
    let rec = RECIPE_BY_RESULT[id];
    if (!rec) return false;
    let y = rec.yield || 1, batches = Math.ceil(remain / y);
    for (let req of rec.req) if (!simulateMake(req.id, req.cnt * batches, pool, depth + 1)) return false;
    pool[id] = (pool[id] || 0) + (batches * y - remain);
    return true;
}
function simRecipe(recipe, count) {
    let pool = buildPool();
    for (let req of recipe.req) if (!simulateMake(req.id, req.cnt * count, pool, 0)) return false;
    return true;
}
function maxMakeRecipe(recipe) {
    if (!simRecipe(recipe, 1)) return 0;
    let lo = 1, hi = 2;
    while (simRecipe(recipe, hi)) { lo = hi; hi *= 2; if (hi > 1e6) return lo; }
    while (lo < hi) { let mid = Math.ceil((lo + hi) / 2); if (simRecipe(recipe, mid)) lo = mid; else hi = mid - 1; }
    return lo;
}
function materialObtainable(id, cnt) {
    if (invCountId(id) >= cnt) return true;
    if (!RECIPE_BY_RESULT) buildRecipeIndex();
    return simulateMake(id, cnt, buildPool(), 0);
}
function consumeMaterialById(id, n) {
    if (id === 'gold') { player.gold -= n; return; }
    let need = n, stacks = player.inv.filter(i => i.id === id && !i.lock), _gone = new Set();   // 🔒 鎖定件不得當材料銷毀
    // ⚠️ 排序鍵須與 whConsumeId(倉庫) 完全一致，含 seteff（席琳套裝詞綴）權重 50，否則同一件裝備
    //    放背包會被和白板同權重誤吃、放倉庫卻被正確排到最後。
    stacks.sort((a, b) => (((a.en||0)*100)+(a.anc?10:0)+(a.bless?10:0)+(a.attr?10:0)+(a.seteff?50:0)) - (((b.en||0)*100)+(b.anc?10:0)+(b.bless?10:0)+(b.attr?10:0)+(b.seteff?50:0)));
    for (let st of stacks) { if (need <= 0) break; let d = Math.min(st.cnt, need); if (d > 0 && st.bless === true) _craftBlessCount += d; st.cnt -= d; need -= d; if (st.cnt <= 0) _gone.add(st.uid); }   // 🔧 v3.1.27 祝福裝備材料件數累加（供 doCraft 逐件強制祝福）
    if (_gone.size) player.inv = player.inv.filter(i => !_gone.has(i.uid));   // ⚠️ uid 精準移除（舊寫法 i.cnt>0 會誤刪 cnt 未定義的舊物品）
    if (need > 0) whConsumeId(id, need);   // 🔧 背包不足：自倉庫扣除
}
function ensureMaterial(id, count, depth) {
    if (id === 'gold' || depth > 24) return;
    let have = invCountId(id);
    if (have >= count) return;
    let rec = RECIPE_BY_RESULT[id];
    if (!rec) return;
    let need = count - have, y = rec.yield || 1, batches = Math.ceil(need / y);
    for (let req of rec.req) ensureMaterial(req.id, req.cnt * batches, depth + 1);
    for (let req of rec.req) consumeMaterialById(req.id, req.cnt * batches);
    // 🔒 v3.6.92 中間物一律落在「未鎖定疊」：gainItem 通則是併入鎖定疊（同簽章只有一格），但這裡產出後
    //    立刻要被父層 consumeMaterialById 扣掉，而扣料/計數口徑（invCountId·buildPool）都排除鎖定件——
    //    若併進鎖定疊就會「底層材料被吃掉、中間物卻沒扣」（v3.5.85 修過的帳目錯亂）。殘量待下次載入合併回去。
    _lockMergeOff = true;
    try { gainItem(id, batches * y, true, true); } finally { _lockMergeOff = false; }
}
// 計算製作 count 個某配方時，缺少的「最底層材料 / 金幣」與數量（遞迴展開中間物）
function craftReqHtml(reqArr) {
    if (!RECIPE_BY_RESULT) buildRecipeIndex();
    return reqArr.map(req => {
        if (req.id === 'gold') {
            let hasCnt = player.gold;
            let color = hasCnt >= req.cnt ? 'text-green-400' : 'text-red-400';   // 金幣無法合成
            return `<span class="text-sm font-bold leading-none"><span class="${color}">${hasCnt}</span>/${req.cnt} 金幣</span>`;
        }
        let reqItem = DB.items[req.id];
        let hasCnt = invCountId(req.id);   // 🔧 含倉庫存量
        let color, extra = '';
        if (hasCnt >= req.cnt) color = 'text-green-400';
        else if (materialObtainable(req.id, req.cnt)) { color = 'text-amber-400'; extra = '<span class="text-amber-400 text-xs ml-0.5">(可合成)</span>'; }
        else color = 'text-red-400';
        let _lk = (hasCnt < req.cnt) ? lockedCountId(req.id) : 0;   // ⚡ v3.5.89 收成區域變數：原本同一行對同一 id 呼叫兩次（各自跑一趟倉庫）
        if (_lk > 0) extra += `<span class="text-slate-400 text-xs ml-0.5">(另有 ${_lk} 個已上鎖不計)</span>`;   // 🔒 v3.5.87 顯示口徑＝扣除口徑·但要讓玩家知道差額在鎖定件
        return `<span class="text-sm font-bold leading-none"><span class="${color}">${hasCnt}</span>/${req.cnt} ${reqItem.n}${extra}</span>`;
    }).join('<span class="text-slate-500 mx-2 leading-none">+</span>');
}
function craftShortfall(recipe, count) {
    if (!RECIPE_BY_RESULT) buildRecipeIndex();
    let pool = buildPool(), lack = {};
    function take(id, n) {
        if (n <= 0) return;
        let avail = pool[id] || 0, use = Math.min(avail, n);
        pool[id] = avail - use;
        let rem = n - use;
        if (rem <= 0) return;
        let rec = RECIPE_BY_RESULT[id];
        if (id === 'gold' || !rec) { lack[id] = (lack[id] || 0) + rem; return; }   // 葉子/金幣不足 → 記錄缺口
        let y = rec.yield || 1, b = Math.ceil(rem / y);
        for (let q of rec.req) take(q.id, q.cnt * b);
        pool[id] = (pool[id] || 0) + (b * y - rem);
    }
    for (let q of recipe.req) take(q.id, q.cnt * count);
    return lack;
}
function doCraft(npcId, recipeIdx, sherine) {   // 🔮 sherine 參數保留簽章相容；⚠️v3.1.68 席琳製作已移除（詞綴不再附於裝備·改由遺骸承載）
    sherine = false;   // 🦴 v3.1.68 縱深防護：任何殘留呼叫都不再扣結晶/附詞綴（綠鈕已由 craftActionHtml _shOk=false 隱藏）
    let recipe = CRAFT_RECIPES[npcId][recipeIdx];
    if (!recipe) return;

    // 讀取選擇的製作數量（預設 1）
    let qtyInput = document.getElementById(`craft-qty-${npcId}-${recipeIdx}`);
    let qty = Math.max(1, parseInt(qtyInput && qtyInput.value) || 1);

    // 計算最多可製作幾個（遞迴：前置材料足夠即可，會自動補製中間物品）
    if (!RECIPE_BY_RESULT) buildRecipeIndex();
    let maxCraftable = maxMakeRecipe(recipe);

    if (maxCraftable < 1) {
        // 材料不足以製作 1 個：列出實際缺少的最底層材料/金幣，方便判斷
        let lack = craftShortfall(recipe, 1);
        let parts = Object.keys(lack).map(id => id === 'gold'
            ? `金幣 ${lack[id]}` : `${(DB.items[id] && DB.items[id].n) || id} ${lack[id]}`);
        // 🔮 席琳製作：身上與倉庫都沒有席琳結晶時，一併列入缺少清單
        if (sherine && invCountId('sherine_crystal') < 1) {
            parts.push('席琳結晶 1');
        }
        let detail = parts.length ? `（尚缺：${parts.join('、')}）` : '';
        logSys(`<span class="text-red-400 font-bold">材料不足，無法製作。</span><span class="text-red-300">${detail}</span>${lockHintHtml(Object.keys(lack))}`);   // 🔒 v3.5.87 缺料若因上鎖·明講
        return;
    }

    // 選擇數量超過可製作數時，自動做出可製作的最大量
    let makeCount = Math.min(qty, maxCraftable);

    // 🔮 席琳製作：每件成品消耗 1 個席琳結晶；結晶不足時以結晶數為上限（🔧 含倉庫存量）
    if (sherine) {
        let _cc = invCountId('sherine_crystal');
        if (_cc < 1) { logSys('<span class="text-red-400 font-bold">材料不足，無法製作。</span><span class="text-red-300">（尚缺：席琳結晶 1）</span>'); return; }
        if (makeCount > _cc) makeCount = _cc;
    }

    // 前置：自動補製不足的中間物品（maxMakeRecipe 已確認整體可行）
    _craftBlessCount = 0;   // 🔧 v3.1.27 歸零：本次製作消耗到的「祝福裝備」材料件數（ensureMaterial 中間物消耗＋下方直接消耗都會累加·含倉庫）
    for (let r of recipe.req) ensureMaterial(r.id, r.cnt * makeCount, 0);

    // 扣除材料 × makeCount（跨堆疊、白板/低強化優先；🔧 背包不足時自動扣共用倉庫，統一走 consumeMaterialById）
    for (let r of recipe.req) consumeMaterialById(r.id, r.cnt * makeCount);

    // 🔮 席琳製作：扣除結晶（每件 1 個；🔧 背包優先、不足扣倉庫）
    if (sherine) consumeMaterialById('sherine_crystal', makeCount);

    // 產出（逐個產生，使每件各自有 10% 機率取得祝福；靜音後統一記錄一次）
    _tradLootCtx = true;   // 🏛️ 傳統模式：製作的武器/防具/飾品/寵物裝備隨機自帶強化值（材料非裝備→不受影響、恆 +0）
    let _isPetGear = !!(DB.items[recipe.result] && ['petwpn', 'petarm'].includes(DB.items[recipe.result].slot));   // 🦴 寵物裝備（之牙 petwpn／防具 petarm）＝白板
    _noAffixCtx = _isPetGear;   // 🦴 寵物裝備＝白板：擋詞綴/套裝效果
    try {
        for (let k = 0; k < makeCount; k++) {
            _forceSherineSet = !!sherine;   // 🔮 席琳製作：每件成品必定附帶隨機一種席琳套裝效果（寵物裝備 slot 非席琳適用部位，gainItem 自然不附）
            _forceBless = (k < _craftBlessCount);   // 🔧 消耗幾件祝福裝備材料→前幾件成品必定祝福（其餘照製作 10% 擲）
            gainItem(recipe.result, recipe.yield || 1, true, false, false, false, null, 0.10);   // 🦴 寵物裝備仍由 _noAffixCtx 維持白板
            _forceSherineSet = false; _forceBless = false;
        }
    } finally { _tradLootCtx = false; _forceSherineSet = false; _noAffixCtx = false; _forceBless = false; }   // try/finally：例外也必清旗標，杜絕殘留洩漏
    let totalOut = (recipe.yield || 1) * makeCount;
    if (_craftBlessCount > 0 && !_isPetGear) logSys(`<span class="c-blessed font-bold">✦ 使用了祝福的裝備作為材料，${Math.min(_craftBlessCount, makeCount)} 件成品獲得了祝福！</span>`);   // 🔧 v3.1.27 祝福材料傳承提示（寵物白板不祝福→不提示）
    logSys(`${sherine ? '<span class="c-sherine font-bold">席琳製作</span>' : '製作'}完成：<span class="${getItemColor({ id: recipe.result })} font-bold">${DB.items[recipe.result].n}</span> ×${totalOut}${sherine ? `（消耗 席琳結晶 ×${makeCount}）` : ''}`);

    // 重新渲染介面與左側狀態列
    updateUI();
    renderTabs();

    if (npcId === 'npc_moli' || npcId === 'npc_ladal') {
        renderMoliCraft(document.getElementById('interaction-content'));
    } else if (npcId === 'npc_brabo') {
        renderBraboCraft(document.getElementById('interaction-content'));
    } else if (npcId === 'npc_finn' || npcId === 'npc_falin') {
        renderFinnCraft(document.getElementById('interaction-content'), npcId);
    } else if (npcId === 'npc_joel' || npcId === 'npc_ryan') {
        renderJoelCraft(document.getElementById('interaction-content'), npcId);
    } else if (CRAFT_RECIPES[npcId]) {
        // 🔧 v3.5.87 重繪分派改看資料（CRAFT_RECIPES 有配方＝通用製作 NPC）：原手抄白名單漏了 npc_atelier（亞提利歐），
        //    製作後 #interaction-content 不重繪、需求數字停留舊值——根除與 js/11 分派清單的平行兩份維護。
        renderUniversalCraft(document.getElementById('interaction-content'), npcId);
    }

    // 數量設定：選擇數量超過可製作數 → 回到 1；否則保留所選數量
    let qtyInput2 = document.getElementById(`craft-qty-${npcId}-${recipeIdx}`);
    if (qtyInput2) qtyInput2.value = (qty > maxCraftable) ? 1 : qty;

    saveGame();
}
function renderPandoraGacha(div) {
    // 🔧 潘朵拉黑市（取代舊抽獎機）：每 10 分鐘上架一件商品，可直接購買
    _pandoraDiv = div;
    refreshPandoraMarket(false);
    player.pandoraAnnounce = null;            // 玩家點開潘朵拉 → 清除稀有公告橫幅
    player.pandoraAnnounceBless = false;
    try { renderPandoraBanner(); } catch (e) {}
    try { saveGame(); } catch (e) {}          // 🔧 點擊潘朵拉即自動存檔，鎖定當下商品與剩餘時間
    pandoraRenderMarket(div);
}



// 🔧 已刪除重複定義的 getWeightedGachaResult（死碼）：與下方版本逐行等價，僅後者生效。

// ==========================================
// 👇 權重初始化（遊戲載入時執行一次）：🎯 v3.4.2 用戶拍板「物品權重完全看標示」＋ v3.4.3 兩項補充——
//    ① 有標示 gachaWeight → 一律照標示（唯一真相·不再有 商店/製作→0、僅BOSS掉落→1、逐件強制 等覆寫層）。
//    ② 未標示＋是「商店販賣物」（SHOP_LISTS 聯集）→ 依價格自動分配（1/10/20/50/100 五階·無價/鑰匙/地圖→0）。
//    ③ 未標示＋非商店販賣物 → 0（要進抽獎池必須顯式標 >0）。
//    ④ 遺物（relic:true）→ 一律 0（最後執行·蓋過標示·永不進黑市/抽獎/10連抽/血盟野外/裂痕池）。
// ==========================================
(function initGachaWeights() {
    let SHOP_SOLD = new Set();
    if (typeof SHOP_LISTS !== 'undefined') for (let _k in SHOP_LISTS) (SHOP_LISTS[_k] || []).forEach(_id => SHOP_SOLD.add(_id));
    for (let id in DB.items) {
        let item = DB.items[id];
        if (!item) continue;
        if (item.gachaWeight === undefined) {
            if (SHOP_SOLD.has(id)) {   // 未標示的商店販賣物 → 依價格自動分配
                if (!item.p || item.p <= 1 || (item.n && (item.n.includes("鑰匙") || item.n.includes("地圖")))) item.gachaWeight = 0;
                else if (item.p > 100000) item.gachaWeight = 1;     // 十萬以上極度稀有
                else if (item.p > 30000) item.gachaWeight = 10;     // 三萬以上稀有
                else if (item.p > 10000) item.gachaWeight = 20;     // 一萬以上罕見
                else if (item.p > 1000) item.gachaWeight = 50;      // 一千以上一般
                else item.gachaWeight = 100;                        // 便宜貨超容易抽到
            } else item.gachaWeight = 0;   // 其他未標示 → 0
        }
        if (item.relic) item.gachaWeight = 0;   // 🏺 遺物一律 0（蓋過標示）
    }
})();

// ==========================================
// 👇 新增：2. 根據權重抽獎的函數
// ==========================================
function getWeightedGachaResult(doubleNonRare, excludeCards) {
    let totalWeight = 0;
    let pool = [];

    // 建立抽獎池並計算總權重
    for (let id in DB.items) {
        let item = DB.items[id];
        if ((doubleNonRare || excludeCards) && item.eff === 'card') continue;   // 怪物卡僅加入黑市與收購 NPC；黑市達卡片上限時亦暫時排除
        let weight = item.gachaWeight !== undefined ? item.gachaWeight : 0;   // 🎯 v3.4.2 沒有標示視同 0（initGachaWeights 已正規化·此為雙保險）
        if (weight > 0) {
            if (doubleNonRare && weight !== 1) weight *= 2;   // 🔧 血盟野外特殊掉落：潘朵拉權重 1 以外的物品以 2 倍權重計算（權重100→200）
            totalWeight += weight;
            pool.push({ id: id, weight: weight });
        }
    }

    // 抽出隨機數（🎲 committed RNG：防 SL 重抽潘朵拉抽到哪一件）
    let rand = lootRng('gacha') * totalWeight;
    let currentWeight = 0;

    // 找出對應的物品
    for (let item of pool) {
        currentWeight += item.weight;
        if (rand <= currentWeight) {
            return item.id;
        }
    }
    return pool[pool.length - 1].id;
}

// ==========================================
// 🔧 潘朵拉黑市：一次陳列 24 件商品（桌面 3 欄 × 8 列；icon/名稱/價格/購買·能力走 tooltip）。
//    每 10 分鐘輪換 1 格（round-robin），每件商品自上架起持續 240 分鐘（24 格 × 10 分鐘一圈）才再刷新。
//    以遊戲 tick 計時（存讀檔保留·離線經補跑自然推進）；離線超過一圈(240分鐘)直接全面換貨。
//    出現機率＝原始 gachaWeight（v3.0.81 起 initGachaWeights 的 ≥50 ×2 加倍已移除）。
// ==========================================
const PANDORA_SLOT_COUNT = 24;
const PANDORA_SLOT_TICKS = 6000;   // 10 分鐘 = 600 秒 × 10 tick/秒
const PANDORA_LIFETIME_TICKS = PANDORA_SLOT_TICKS * PANDORA_SLOT_COUNT;   // 240 分鐘
const PANDORA_CARD_LIMIT = 5;       // 普卡／銀卡／金卡合計最多同時佔用 5 個黑市商品格（僅限制隨機輪換；玩家收購單上架的卡片不計入也不受限）
let _pandoraDiv = null;            // 目前黑市面板容器（購買/輪換後重繪用）

function pandoraMarketCardCount(market, replacingIndex) {
    if (!market || !Array.isArray(market.slots)) return 0;
    return market.slots.reduce((count, slot, index) => {
        if (index === replacingIndex || !slot || slot.buyOrder) return count;   // 收購單上架的卡片不計入上限（也讓健檢容許第 6 張收購卡）
        let d = DB.items[slot.id];
        return count + (d && d.eff === 'card' ? 1 : 0);
    }, 0);
}

function pandoraCardPriceRange(d) {
    if (!d || d.eff !== 'card') return null;
    if (d.cardTier === 1) return { min: 100000, max: 10000000 };
    if (d.cardTier === 2) return { min: 1000000, max: 100000000 };
    if (d.cardTier === 3) return { min: 10000000, max: 10000000000 };
    return null;
}

function pandoraRollPriceRange(range, rngTag) {
    return range.min + Math.floor(lootRng(rngTag) * (range.max - range.min + 1));
}

// 🔧 v3.0.81 售價公式（使用者規格）：權重 w 夾 [1,100]
//   權重1：基準價＝max(原價,100000)，倍率 11~1000
//   其他權重：基準價＝原價，倍率下限＝11−0.1×w（權重5→10.5、權重100→1）、上限＝下限×100（權重5→1050、權重100→100）
function pandoraPrice(id) {
    let d = DB.items[id]; if (!d) return 1;
    let cardRange = pandoraCardPriceRange(d);
    if (cardRange) return pandoraRollPriceRange(cardRange, 'pandoraPrice');
    let w = Math.max(1, Math.min(100, d.gachaWeight || 100));
    let base = Math.max(1, d.p || 1);
    let lo, hi;
    if (w === 1) { base = Math.max(base, 100000); lo = 11; hi = 1000; }
    else { lo = Math.max(1, 11 - 0.1 * w); hi = lo * 100; }
    let mult = lo + lootRng('pandoraPrice') * (hi - lo);   // 🎲 committed RNG：同一次上架的商品抽選已走 lootRng，價格若用 Math.random 就能靠 SL 重讀洗出低價
    return Math.max(1, Math.round(base * mult));
}

const PANDORA_BUY_EQUIP_SLOTS = new Set(['helm', 'armor', 'cloak', 'gloves', 'boots', 'tshirt', 'shield', 'ring', 'amulet', 'belt']);

function pandoraIsEarring(id, d) {
    let n = String((d && d.n) || '');
    let slot = String((d && d.slot) || '');
    return slot === 'ear' || slot === 'ear1' || slot === 'ear2' || /^acc_.*ear/.test(String(id || '')) || n.includes('耳環');
}

function pandoraIsPlayerWearableEquip(id, d) {
    if (!d || d.relic || d.remains || d.doll || d.isArrow) return false;
    if (d.slot === 'petwpn' || d.slot === 'petarm') return false;
    if (d.type === 'wpn') return true;
    if (d.type === 'arm') return PANDORA_BUY_EQUIP_SLOTS.has(String(d.slot || ''));
    if (d.type === 'acc') return PANDORA_BUY_EQUIP_SLOTS.has(String(d.slot || '')) && !pandoraIsEarring(id, d);
    return false;
}

function pandoraBuyOrderAllowed(id) {
    let d = DB.items[id];
    if (!d || !d.n || d.relic || d.remains || d.doll) return false;
    if (pandoraIsEarring(id, d)) return false;
    if (/^item_pride_dom_/.test(String(id || '')) || String(d.n || '').includes('支配符')) return false;
    if (d.eff === 'card' && d.cardMob && d.cardTier >= 1 && d.cardTier <= 3) return true;
    if (d.type === 'skillbk') return true;
    if (d.eff === 'panacea') return true;   // 💊 v3.5.67 萬能藥（六屬性）開放喊價收購：唯一獲准的消耗品例外
    return pandoraIsPlayerWearableEquip(id, d);
}

function pandoraBuyOrderPriceProfile(id) {
    let d = DB.items[id] || {};
    let premium = d.type === 'skillbk' || (d.legend && pandoraIsPlayerWearableEquip(id, d));
    let minMult = premium ? 100 : 10;
    let maxMult = premium ? 2000 : 1000;
    let base = Math.max(0, Number(d.p) || 0);
    if (base <= 0 && pandoraIsPlayerWearableEquip(id, d)) base = 100000;
    if (base <= 0) base = 1000;
    return {
        base: base,
        minMult: minMult,
        maxMult: maxMult
    };
}

function pandoraBuyOrderPrice(id) {
    let cardRange = pandoraCardPriceRange(DB.items[id]);
    if (cardRange) return pandoraRollPriceRange(cardRange, 'pandoraBuyOrder');
    let r = pandoraBuyOrderPriceProfile(id);
    let mult = r.minMult + Math.floor(lootRng('pandoraBuyOrder') * (r.maxMult - r.minMult + 1));   // 🎲 committed RNG：否則可 SL 重讀洗收購單命中
    return Math.max(1, Math.round(r.base * mult));
}

// 黑市裝備在上架當下決定是否祝福，並將結果存入商品格。
// 購買時只交付這個既定結果，不允許重新讀檔或在付款瞬間重抽。
function pandoraStockBless(id) {
    let d = DB.items[id];
    if (!d || (typeof isRelic === 'function' ? isRelic(d) : d.relic)) return false;
    if (!((d.type === 'wpn' && !d.isArrow) || d.type === 'arm' || d.type === 'acc')) return false;
    let affix = (typeof rollAffixesNew === 'function') ? rollAffixesNew() : { bless: lootRng('affixb') < 0.01 };
    return affix.bless === true;
}

// 上架一件新商品：若有收購單，先替指定物品擲一次市場價；市場價不高於喊價才命中，
// 並以玩家喊價上架。失敗時不影響收購單，改走正常權重抽選。
// 卡片上限只約束隨機輪換抽貨；收購單（含卡片）一律不受 PANDORA_CARD_LIMIT 影響。
function _pandoraStock(nowT, market, replacingIndex) {
    let cardLimitReached = pandoraMarketCardCount(market, replacingIndex) >= PANDORA_CARD_LIMIT;
    let order = market && market.buyOrder;
    if (order && pandoraBuyOrderAllowed(order.id) && Number.isSafeInteger(order.price) && order.price > 0) {
        let rolledPrice = pandoraBuyOrderPrice(order.id);
        if (rolledPrice <= order.price) {
            let od = DB.items[order.id];
            let hit = { id: order.id, price: order.price, weight: od.gachaWeight || (od.legend ? 1 : 100), setTick: nowT, sold: false, buyOrder: true, bless: pandoraStockBless(order.id) };
            market.buyOrder = null;   // 單一收購單命中即完成，不再重複上架
            market.notice = { type: 'success', text: `玩家收購物品上架了：${od.n}（${order.price.toLocaleString()} 金幣）` };
            return hit;
        }
    }
    let id = getWeightedGachaResult(false, cardLimitReached);
    let d = DB.items[id] || {};
    return { id: id, price: pandoraPrice(id), weight: d.gachaWeight || 100, setTick: nowT, sold: false, bless: pandoraStockBless(id) };
}

function _pandoraEsc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// 黑市共用收藏判定：只標示實際列在裝備、道具、遺物或怪物卡片圖鑑中的項目。
function pandoraItemUncollected(id) {
    let d = DB.items[id];
    if (!d || typeof player === 'undefined' || !player) return false;
    if (typeof RELIC_ITEM_CAT !== 'undefined' && RELIC_ITEM_CAT[id]) return !(player.relicDex && player.relicDex[id]);
    if (typeof EQUIP_ITEM_CAT !== 'undefined' && EQUIP_ITEM_CAT[id]) return !(player.equipDex && player.equipDex[id]);
    if (typeof MISC_ITEM_CAT !== 'undefined' && MISC_ITEM_CAT[id]) return !(player.miscDex && player.miscDex[id]);
    if (d.eff === 'card' && d.cardMob) {
        let needTier = Math.max(1, Math.min(3, Math.floor(Number(d.cardTier) || 1)));
        return typeof cardDexTier === 'function' ? cardDexTier(d.cardMob) < needTier : !(player.cardDex && player.cardDex[d.cardMob]);
    }
    return false;
}
function pandoraUncollectedBadgeHTML(id) {
    return pandoraItemUncollected(id) ? '<span class="pandora-collection-badge">未收藏</span>' : '';
}

function _pandoraSetNotice(m, type, text) {
    if (m) m.notice = { type: type || 'info', text: String(text || '') };
}

function _pandoraNoticeHTML(m) {
    let n = m && m.notice;
    if (!n || !n.text) return '';
    let c = n.type === 'success' ? 'text-green-400' : n.type === 'error' ? 'text-red-400' : 'text-amber-300';
    return `<span class="${c}">${_pandoraEsc(n.text)}</span>`;
}

// 收購名稱自動提示：輸入至少 2 個連續字元後，搜尋可指定收購的魔法書、一般穿著裝備、萬能藥與怪物卡片。
function pandoraSuggestBuyItems(value) {
    let box = document.getElementById('pandora-buy-suggestions');
    if (!box) return;
    let q = String(value || '').trim();
    try { if (typeof pandoraRelicOnSearchInput === 'function') pandoraRelicOnSearchInput(q); } catch (e) {}
    if (q.length < 2) { box.innerHTML = ''; box.classList.add('hidden'); return; }
    // 輸入「遺物」時改列三種遺物搜尋，不與一般金幣收購混用。
    try {
        if (typeof pandoraRelicSuggestionHTML === 'function') {
            let relicSuggestions = pandoraRelicSuggestionHTML(q);
            if (relicSuggestions) {
                box.innerHTML = relicSuggestions;
                box.classList.remove('hidden');
                return;
            }
        }
    } catch (e) {}
    let seen = new Set();
    let suggestions = Object.keys(DB.items).reduce((arr, id) => {
        let d = DB.items[id];
        if (!d || !d.n || !pandoraBuyOrderAllowed(id) || !d.n.includes(q) || seen.has(d.n)) return arr;
        seen.add(d.n); arr.push({ id: id, n: d.n }); return arr;
    }, []).sort((a, b) => {
        let ap = a.n.startsWith(q) ? 0 : 1, bp = b.n.startsWith(q) ? 0 : 1;
        return ap - bp || a.n.length - b.n.length || a.n.localeCompare(b.n, 'zh-Hant');
    }).slice(0, 8);
    if (!suggestions.length) {
        box.innerHTML = '<div class="pandora-buy-suggestion-empty">沒有可指定收購的相符物品</div>';
    } else {
        box.innerHTML = suggestions.map(it =>
            `<button type="button" class="pandora-buy-suggestion" data-name="${encodeURIComponent(it.n)}"
                onclick="pandoraChooseBuyItem(decodeURIComponent(this.dataset.name))"><span class="${getItemColor({ id: it.id })}">${_pandoraEsc(it.n)}</span></button>`
        ).join('');
    }
    box.classList.remove('hidden');
}

function pandoraChooseBuyItem(name) {
    let el = document.getElementById('pandora-buy-name');
    let box = document.getElementById('pandora-buy-suggestions');
    try { if (typeof pandoraClearRelicSearchChoice === 'function') pandoraClearRelicSearchChoice(); } catch (e) {}
    if (el) { el.value = String(name || ''); el.focus(); }
    if (box) { box.innerHTML = ''; box.classList.add('hidden'); }
}

// 設定單一收購單：物品名稱必須完全吻合，且僅限魔法書、耳環以外的一般穿著裝備、萬能藥與怪物卡片。
function pandoraSetBuyOrder() {
    let m = player && player.pandoraMarket2;
    if (!m) return;
    try {
        if (typeof pandoraTryRelicSearchFromInputs === 'function' && pandoraTryRelicSearchFromInputs()) return;
    } catch (e) {}
    let nameEl = document.getElementById('pandora-buy-name');
    let priceEl = document.getElementById('pandora-buy-price');
    let name = nameEl ? nameEl.value.trim() : '';
    let rawPrice = priceEl ? priceEl.value.replace(/[,\s，]/g, '') : '';
    let price = Number(rawPrice);
    let matches = Object.keys(DB.items).filter(id => DB.items[id] && DB.items[id].n === name);
    if (!name || !matches.length) {
        _pandoraSetNotice(m, 'error', '無此物品，請輸入完整且正確的物品名稱。');
    } else {
        let orderable = matches.filter(id => pandoraBuyOrderAllowed(id));
        if (!orderable.length) {
            _pandoraSetNotice(m, 'error', '此物品不可指定收購；僅開放魔法書、怪物卡片、萬能藥與耳環以外的穿著裝備。');
        } else if (!Number.isSafeInteger(price) || price <= 0) {
            _pandoraSetNotice(m, 'error', '請輸入正確的正整數收購價格。');
        } else {
            let id = orderable[0];
            m.buyOrder = { id: id, price: price, setTick: (typeof state !== 'undefined' && state) ? (state.ticks || 0) : 0 };
            _pandoraSetNotice(m, 'info', `已登記收購：${DB.items[id].n}，最高 ${price.toLocaleString()} 金幣。`);
            try { saveGame(); } catch (e) {}
        }
    }
    if (_pandoraDiv) pandoraRenderMarket(_pandoraDiv);
}

function pandoraCancelBuyOrder() {
    let m = player && player.pandoraMarket2;
    if (!m) return;
    if (m.buyOrder) {
        let d = DB.items[m.buyOrder.id];
        m.buyOrder = null;
        _pandoraSetNotice(m, 'info', `已取消收購${d ? '：' + d.n : '單'}。`);
        try { saveGame(); } catch (e) {}
    }
    if (_pandoraDiv) pandoraRenderMarket(_pandoraDiv);
}

// 物品系統日誌只保留「最新刷新」的上架訊息：先移除舊的上架列，再記一筆（補跑期間 logSys 自靜音）
function _pandoraLogLatest(slot) {
    let d = DB.items[slot.id]; if (!d) return;
    let inst = { id: slot.id, bless: slot.bless === true };
    try { document.querySelectorAll('#sys-log .pandora-stock-log').forEach(sp => { let le = sp.closest('.log-entry'); if (le) le.remove(); }); } catch (e) {}
    let rare = slot.weight === 1;
    let lead = slot.buyOrder ? '玩家收購物品上架了：' : (rare ? '珍稀商品 ' : '新上架 ');
    logSys(`<span class="pandora-stock-log"><span class="text-purple-300 font-bold">📢【潘朵拉黑市】</span>${lead}<span class="${getItemColor(inst)}">${getItemFullName(inst)}</span>（${slot.price.toLocaleString()} 金幣）${rare ? '！' : '。'}</span>`);
}
function _pandoraLogBuyOrder(slot) {
    let d = slot && DB.items[slot.id]; if (!d) return;
    let inst = { id: slot.id, bless: slot.bless === true };
    logSys(`<span class="pandora-buyorder-log"><span class="text-amber-300 font-bold">📢【潘朵拉收購】</span>玩家收購物品上架了：<span class="${getItemColor(inst)}">${getItemFullName(inst)}</span>（${slot.price.toLocaleString()} 金幣）。</span>`);
}

// 黑市輪換（js/03 每 10 秒呼叫一次；force＝全面換貨）。回傳本次是否有商品刷新。
function refreshPandoraMarket(force) {
    if (typeof player === 'undefined' || !player) return false;
    let nowT = (typeof state !== 'undefined' && state) ? (state.ticks || 0) : 0;
    let m = player.pandoraMarket2;
    let changed = false, latest = null, orderHit = null;
    let bad = !m || !Array.isArray(m.slots) || m.slots.length !== PANDORA_SLOT_COUNT || m.slots.some(s => !s || !DB.items[s.id]) || pandoraMarketCardCount(m) > PANDORA_CARD_LIMIT;
    if (force || bad || (nowT - (m ? (m.lastTick || 0) : 0)) >= PANDORA_LIFETIME_TICKS) {
        // 初次進場／資料損壞／離線超過一圈：全面換貨（日誌只公告最新一件，不洗版）
        let nextMarket = {
            slots: [], seq: 0, lastTick: nowT, lastIdx: PANDORA_SLOT_COUNT - 1,
            buyOrder: m && m.buyOrder ? m.buyOrder : null,
            notice: m && m.notice ? m.notice : null
        };
        for (let i = 0; i < PANDORA_SLOT_COUNT; i++) {
            let s = _pandoraStock(nowT, nextMarket);
            if (s.buyOrder) orderHit = s;
            nextMarket.slots.push(s);
        }
        let slots = nextMarket.slots;
        m = player.pandoraMarket2 = nextMarket;
        latest = slots[PANDORA_SLOT_COUNT - 1]; changed = true;
    } else {
        let n = 0;
        while ((nowT - m.lastTick) >= PANDORA_SLOT_TICKS && n < PANDORA_SLOT_COUNT) {
            m.lastTick += PANDORA_SLOT_TICKS;
            let i = (m.seq || 0) % PANDORA_SLOT_COUNT;   // round-robin：每格恰好 240 分鐘輪到一次
            m.slots[i] = _pandoraStock(nowT, m, i);
            if (m.slots[i].buyOrder) orderHit = m.slots[i];
            latest = m.slots[i]; m.lastIdx = i;
            m.seq = (m.seq || 0) + 1; n++; changed = true;
        }
    }
    if (!changed) return false;
    if (latest) {
        _pandoraLogLatest(latest);   // 🔧 物品系統日誌只顯示最新刷新的物品
        if (orderHit && orderHit !== latest) _pandoraLogBuyOrder(orderHit);   // 離線補跑／全面換貨中若較早的格命中收購，仍要獨立提示玩家
        // 珍稀(權重1)橫幅：最新上架為珍稀→公告之；否則若原公告品仍在架上未售出則保留、已下架/售出則清除
        let announced = (orderHit && orderHit.weight === 1) ? orderHit : (latest.weight === 1) ? latest : null;
        if (announced) {
            player.pandoraAnnounce = announced.id;
            player.pandoraAnnounceBless = announced.bless === true;
        } else if (!player.pandoraAnnounce || !m.slots.some(s => s && s.id === player.pandoraAnnounce && !s.sold && (s.bless === true) === !!player.pandoraAnnounceBless)) {
            player.pandoraAnnounce = null;
            player.pandoraAnnounceBless = false;
        }
    }
    try { renderPandoraBanner(); } catch (e) {}
    try { renderSyslogPandora(); } catch (e) {}
    // 🐛 修：面板容器 interaction-content 是所有 NPC 共用；只有「仍在顯示黑市」(內含 #pandora-msg 標記)時才即時重繪，避免切到傭兵公會/其他 NPC 後被黑市洗版。切走或關閉→放棄快取。
    if (_pandoraDiv && document.body.contains(_pandoraDiv) && _pandoraDiv.querySelector('#pandora-msg')) { try { pandoraRenderMarket(_pandoraDiv); } catch (e) {} }   // 面板開著且仍是黑市→即時反映輪換
    else { _pandoraDiv = null; }
    return true;
}

// 稀有(權重1)商品上架時的常駐橫幅：持續到商品輪換/售出或玩家點擊潘朵拉
function renderPandoraBanner() {
    let el = document.getElementById('pandora-banner');
    let annId = (typeof player !== 'undefined' && player) ? player.pandoraAnnounce : null;
    let annInst = annId ? { id: annId, bless: !!player.pandoraAnnounceBless } : null;
    if (annId && DB.items[annId]) {
        if (!el) {
            el = document.createElement('div');
            el.id = 'pandora-banner';
            el.className = 'fixed top-1 left-1/2 -translate-x-1/2 z-40 bg-black/85 border border-purple-400 text-purple-200 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold shadow-[0_0_15px_rgba(192,132,252,0.6)] animate-pulse pointer-events-none max-w-[92vw] text-center';
            document.body.appendChild(el);
        }
        el.innerHTML = `🌟 潘朵拉黑市出現珍稀商品：<span class="${getItemColor(annInst)}">${getItemFullName(annInst)}</span>！`;
        el.style.display = '';
    } else if (el) {
        el.style.display = 'none';
    }
}

// 系統與物品日誌標題列右側：顯示黑市「最新上架」的商品（權重1＝亮紫，其餘＝白色）
function renderSyslogPandora() {
    let el = document.getElementById('syslog-pandora');
    if (!el) return;
    let m = (typeof player !== 'undefined' && player) ? player.pandoraMarket2 : null;
    let s = (m && m.slots && m.slots.length) ? m.slots[(m.lastIdx !== undefined) ? m.lastIdx : m.slots.length - 1] : null;
    let d = s ? DB.items[s.id] : null;
    if (!d) { el.innerHTML = ''; return; }
    let inst = { id: s.id, bless: s.bless === true };
    let nameStyle = (s.weight === 1) ? 'color:#c084fc;text-shadow:0 0 4px rgba(192,132,252,.5);' : '';
    let nameClass = getItemColor(inst);
    let soldTxt = s.sold ? '<span class="text-xs ml-1" style="color:#64748b;">（已售出）</span>' : '';
    el.innerHTML = `<span class="text-xs" style="color:#94a3b8;">黑市最新上架：</span><span class="font-bold ${nameClass}" style="${nameStyle}">${getItemFullName(inst)}</span>${soldTxt}`;
}

// ===== 黑市商品 tooltip（能力說明·跟隨滑鼠·掛 body 用視口座標，不受 #app-stage 縮放影響）=====
function _pandoraTipEl() {
    let el = document.getElementById('pandora-tooltip');
    if (!el) {
        el = document.createElement('div');
        el.id = 'pandora-tooltip';
        el.style.cssText = 'position:fixed;z-index:200;max-width:360px;pointer-events:none;display:none;background:rgba(2,6,23,.96);border:1px solid #7c3aed;border-radius:8px;padding:8px 10px;font-size:12px;line-height:1.55;color:#e2e8f0;box-shadow:0 0 18px rgba(124,58,237,.35);';
        document.body.appendChild(el);
    }
    return el;
}
function pandoraTipShow(ev, i) {
    let m = player && player.pandoraMarket2; let s = m && m.slots && m.slots[i]; let d = s && DB.items[s.id]; if (!d) return;
    let inst = { id: s.id, bless: s.bless === true };
    let desc = ''; try { desc = buildItemDescHTML(inst); } catch (e) {}
    let nowT = (typeof state !== 'undefined' && state) ? (state.ticks || 0) : 0;
    let mins = Math.max(1, Math.ceil((PANDORA_LIFETIME_TICKS - (nowT - (s.setTick || 0))) / 600));
    let el = _pandoraTipEl();
    el.innerHTML = `<div class="font-bold ${getItemColor(inst)}">${getItemFullName(inst)}</div>
        <div class="text-yellow-300 font-bold">售價 ${s.price.toLocaleString()} 金幣${s.weight === 1 ? '<span style="color:#c084fc;">（珍稀）</span>' : ''}${s.sold ? '<span style="color:#64748b;">（已售出）</span>' : ''}</div>
        <div class="text-slate-300">${desc}</div>
        <div class="text-slate-500 mt-1" style="font-size:11px;">此格約 ${mins} 分鐘後輪換新商品</div>`;
    el.style.display = 'block';
    pandoraTipMove(ev);
}
function pandoraTipMove(ev) {
    let el = document.getElementById('pandora-tooltip'); if (!el || el.style.display === 'none') return;
    let x = ev.clientX + 14, y = ev.clientY + 12;
    let r = el.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8)  x = Math.max(4, ev.clientX - r.width - 14);
    if (y + r.height > window.innerHeight - 8) y = Math.max(4, ev.clientY - r.height - 12);
    el.style.left = x + 'px'; el.style.top = y + 'px';
}
function pandoraTipHide() { let el = document.getElementById('pandora-tooltip'); if (el) el.style.display = 'none'; }

// 繪製黑市面板：24 件商品（桌面 3×8）·只顯示 icon／名稱／價格／購買·能力用 tooltip
function pandoraRenderMarket(div) {
    if (!div) return;
    _pandoraDiv = div;
    let m = player.pandoraMarket2;
    if (!m || !Array.isArray(m.slots) || !m.slots.length) { refreshPandoraMarket(true); m = player.pandoraMarket2; }
    if (!m) { div.innerHTML = '<div class="p-6 text-center text-slate-300">黑市目前沒有商品，請稍候。</div>'; return; }
    let nowT = (typeof state !== 'undefined' && state) ? (state.ticks || 0) : 0;
    let nextMin = Math.max(1, Math.ceil((PANDORA_SLOT_TICKS - (nowT - (m.lastTick || 0))) / 600));
    let order = m.buyOrder;
    let orderItem = order && DB.items[order.id];
    let buyerName = String(player.name || '').trim() || ({
        royal: '王族', knight: '騎士', mage: '法師', elf: '妖精',
        dark: '黑暗妖精', illusion: '幻術士', dragon: '龍騎士', warrior: '戰士'
    }[player.cls] || '玩家');
    let orderName = orderItem ? orderItem.n : '';
    let orderPrice = order && Number.isSafeInteger(order.price) ? String(order.price) : '';
    let relicBalance = '';
    let relicBoard = '';
    try {
        if (typeof pandoraRelicBalanceHTML === 'function') relicBalance = pandoraRelicBalanceHTML();
        if (typeof pandoraRelicBoardHTML === 'function') relicBoard = pandoraRelicBoardHTML();
    } catch (e) {}
    let cards = m.slots.map((s, i) => {
        let d = s && DB.items[s.id]; if (!d) return '';
        let inst = { id: s.id, bless: s.bless === true };
        let rare = s.weight === 1;
        let afford = (player.gold || 0) >= s.price;
        let border = s.sold ? 'border-slate-700' : rare ? 'border-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.45)]' : 'border-slate-600';
        // 三欄橫條：圖示｜名稱/價格｜購買鈕；卡片加寬後保留完整名稱與清楚點擊區。
        let btn = s.sold
            ? `<button disabled class="btn shrink-0 bg-slate-700 border-slate-600 opacity-60 cursor-not-allowed font-bold rounded pandora-card-buy">售出</button>`
            : `<button onclick="buyPandoraItem(${i})" ${afford ? '' : 'disabled'} class="btn shrink-0 ${afford ? 'bg-purple-700 hover:bg-purple-600 border-purple-500' : 'bg-slate-700 border-slate-600 opacity-60 cursor-not-allowed'} font-bold rounded pandora-card-buy">購買</button>`;
        return `<div class="pandora-market-card rounded-md border ${border} bg-slate-900/80 flex items-center ${s.sold ? 'opacity-70' : ''}"
            onmouseenter="pandoraTipShow(event,${i})" onmousemove="pandoraTipMove(event)" onmouseleave="pandoraTipHide()">
            <div class="pandora-collection-icon pandora-card-icon-wrap">
                <img src="${getIconUrl(d)}" onerror="this.src='https://placehold.co/40x40/1e293b/ffffff?text=?';" class="pandora-card-icon object-contain ${s.sold ? 'grayscale opacity-40' : getGlowClass(inst, d)}">
                ${pandoraUncollectedBadgeHTML(s.id)}
            </div>
            <div class="min-w-0 flex-1">
                <div class="pandora-card-name font-bold leading-none truncate ${getItemColor(inst)}">${getItemFullName(inst)}${s.buyOrder ? '<span class="pandora-order-tag">收購</span>' : ''}</div>
                <div class="pandora-card-price text-yellow-300 font-bold leading-none truncate">${s.price.toLocaleString()}<span class="text-slate-500"> 金</span></div>
            </div>
            ${btn}
        </div>`;
    }).join('');
    div.innerHTML = `
    <div class="pandora-market-panel flex flex-col h-full w-full overflow-y-auto">
        <h3 class="pandora-market-title text-center font-bold text-purple-400 drop-shadow-md leading-none shrink-0">潘朵拉黑市
            <span class="text-slate-400 font-normal">每 10 分鐘輪換 1 件·單件持續 240 分鐘·約 ${nextMin} 分鐘後輪換｜金幣 <span class="text-yellow-300 font-bold">${(player.gold || 0).toLocaleString()}</span>${relicBalance}</span>
        </h3>
        <div class="pandora-buy-box shrink-0">
            <div class="pandora-buybar">
                <span class="pandora-buy-word">收</span>
                <div class="pandora-buy-name-wrap">
                    <input id="pandora-buy-name" type="text" value="${_pandoraEsc(orderName)}" placeholder="完整物品名稱" autocomplete="off"
                        oninput="pandoraSuggestBuyItems(this.value)" onkeydown="if(event.key==='Enter'){pandoraSetBuyOrder()}">
                    <div id="pandora-buy-suggestions" class="pandora-buy-suggestions hidden"></div>
                </div>
                <span class="pandora-buy-comma">，</span>
                <input id="pandora-buy-price" type="text" inputmode="numeric" value="${_pandoraEsc(orderPrice)}" placeholder="收購價錢" autocomplete="off"
                    onkeydown="if(event.key==='Enter'){pandoraSetBuyOrder()}">
                <span class="pandora-buy-word">收</span>
                <button class="btn pandora-buy-submit font-bold" onclick="pandoraSetBuyOrder()">確認收購</button>
            </div>
            <div class="pandora-buy-status">
                <span>${orderItem ? `<b class="text-amber-200">${_pandoraEsc(buyerName)}</b>：<b class="text-yellow-300">${order.price.toLocaleString()}</b> 金幣收 <b class="${getItemColor({ id: order.id })}">${_pandoraEsc(orderItem.n)}</b>，意者自行上架` : '目前沒有收購單；可指定魔法書、怪物卡片與耳環以外的穿著裝備，未指定仍依原黑市池上架。'}</span>
                ${orderItem ? '<button class="pandora-buy-cancel" onclick="pandoraCancelBuyOrder()">取消收購</button>' : ''}
            </div>
        </div>
        <div class="pandora-market-grid">${cards}</div>
        ${relicBoard}
        <p id="pandora-msg" class="font-bold text-center shrink-0 empty:hidden">${_pandoraNoticeHTML(m)}</p>
    </div>`;
    try { if (typeof pandoraRelicBindBoardCountdowns === 'function') pandoraRelicBindBoardCountdowns(); } catch (e) {}
}

// 購買指定格商品（上架時已決定祝福與否；售出格保持「已售出」直到該格輪換）
function buyPandoraItem(i) {
    let m = player.pandoraMarket2;
    let s = m && m.slots && m.slots[i];
    let msgEl = () => document.getElementById('pandora-msg');
    if (!s || !DB.items[s.id]) { let e = msgEl(); if (e) e.innerHTML = '<span class="text-red-400">商品已不存在。</span>'; return; }
    if (s.sold) { let e = msgEl(); if (e) e.innerHTML = '<span class="text-red-400">此商品已售出，請等待該格輪換。</span>'; return; }
    if ((player.gold || 0) < s.price) { let e = msgEl(); if (e) e.innerHTML = `<span class="text-red-400">金幣不足！需 ${s.price.toLocaleString()} 金幣。</span>`; return; }
    player.gold -= s.price;
    _tradLootCtx = true;                              // 🏛️ 傳統模式殘留旗標（v3.0.83 傳統模式已取消·js/01:837 起無消費者）：實際不再賦予隨機強化值，購買恆 +0
    // 怪物卡沿用卡片取得樞紐，未完成圖鑑時直接登錄；裝備則交付上架時保存的固定詞綴。
    let gi;
    try {
        let d = DB.items[s.id];
        if (d.eff === 'card' && d.cardMob && d.cardTier && typeof acquireCard === 'function') {
            acquireCard(d.cardMob, d.cardTier, 1);
            gi = { id: s.id };
        } else {
            gi = gainItem(s.id, 1, true, false, false, false, { bless: s.bless === true });
        }
    } finally { _tradLootCtx = false; }   // try/finally 防旗標殘留洩漏
    let inst = gi || { id: s.id };
    logSys(`在潘朵拉黑市花費 <span class="text-yellow-300">${s.price.toLocaleString()}</span> 金幣購買了 <span class="${getItemColor(inst)} font-bold">${getItemFullName(inst)}</span>。`);
    s.sold = true;
    if (player.pandoraAnnounce === s.id && !!player.pandoraAnnounceBless === (s.bless === true)) { player.pandoraAnnounce = null; player.pandoraAnnounceBless = false; try { renderPandoraBanner(); } catch (e) {} }
    updateUI(); saveGame();
    pandoraTipHide();
    pandoraRenderMarket(_pandoraDiv);
    try { renderSyslogPandora(); } catch (e) {}
    let e2 = msgEl(); if (e2) e2.innerHTML = '<span class="text-green-400">購買成功！</span>';
}


/* ===== 玩家自訂名稱：點擊左上狀態欄名稱 → 輸入框 → 確認 ===== */
function startEditName() {
    if (window._editingName || !player.cls) return;
    window._editingName = true;
    let el = document.getElementById('st-class');
    let cur = (player.name || '').replace(/"/g, '&quot;');
    el.innerHTML = `<input id="name-edit-input" type="text" maxlength="12" value="${cur}" `
        + `onclick="event.stopPropagation()" `
        + `onkeydown="if(event.key==='Enter'){event.preventDefault();confirmEditName();}else if(event.key==='Escape'){cancelEditName();}" `
        + `class="w-24 px-1 py-0.5 text-black text-sm rounded align-middle"> `
        + `<button onclick="event.stopPropagation();confirmEditName()" class="text-green-400 font-bold align-middle">✓</button>`;
    let input = document.getElementById('name-edit-input');
    if (input) { input.focus(); input.select(); }
}
function confirmEditName() {
    let input = document.getElementById('name-edit-input');
    let v = input ? input.value.trim() : '';
    v = v.replace(/[<>&"']/g, '');   // 🔧 過濾 HTML 特殊字元：名稱會以 innerHTML 呈現，避免自我注入標籤
    player.name = v ? v.slice(0, 12) : null;   // 留空則回到未取名狀態（顯示「點擊取名」）
    window._editingName = false;
    updateUI();
    saveGame();
}
function cancelEditName() {
    window._editingName = false;
    updateUI();
}

window.onload = () => {
    migrateSaves();
    try { _applyVfxPref(); } catch (e) {}   // 🎚️ 套用標題畫面的「戰鬥特效開關」偏好（持久化於 localStorage）
    try { let _v = document.getElementById('login-version'); if (_v && typeof GAME_VERSION !== 'undefined') _v.textContent = GAME_VERSION; } catch (e) {}   // 🏷️ 登入頁面版本號：以 GAME_VERSION 為單一真相來源
    try { if (typeof wireBuffEnders === 'function') wireBuffEnders(); } catch (e) {}   // 🔧 藥水/卷軸維持型增益勾選框：取消打勾即立即結束
};

/* ===== 城鎮商店/製作介面：游標移到物品圖片上顯示物品資訊（tooltip） ===== */
(function(){
    let tipEl = null, ICON2ID = null;
    const TYPE_LABEL = { wpn:'武器', arm:'防具', acc:'飾品', scroll:'卷軸', pot:'藥水', skillbk:'魔法書', etc:'道具', material:'素材' };
    const STAT_LABEL = { ac:'AC', mr:'魔防(MR)', dr:'傷害減免', er:'迴避(ER)', str:'力量', dex:'敏捷', con:'體質', int:'智力', wis:'精神', cha:'魅力', mhp:'HP上限', mmp:'MP上限', hpR:'HP恢復', mpR:'MP恢復', resFire:'火屬性抗性', resWater:'水屬性抗性', resEarth:'地屬性抗性', resWind:'風屬性抗性', meleeHit:'近距離命中', rangedHit:'遠距離命中', meleeDmg:'近距離傷害', rangedDmg:'遠距離傷害', mdmg:'魔法傷害', extraHit:'額外命中', extraDmg:'額外傷害' };
    const EFF_LABEL = { moonburst:'月光爆裂', pierce:'穿透', dice_death:'即死', haste:'自我加速', immStone:'免疫石化', mp_drain:'命中恢復MP', crush:'重擊', cleave:'切割' };
    function sgn(v){ return (v>=0?'+':'') + v; }
    // ⚠️ 先定義者勝：多件物品可能共用同一張圖（例：沙哈之箭借用 箭.png），後者若覆蓋 key 會讓前者的 hover tooltip 顯示成後者。
    function buildMap(){ ICON2ID = {}; for(let id in DB.items){ let d = DB.items[id]; if(d){ let k = getIconUrl(d); if(!(k in ICON2ID)) ICON2ID[k] = id; } } }
    function getTip(){ if(!tipEl){ tipEl = document.createElement('div'); tipEl.className = 'game-tooltip'; document.body.appendChild(tipEl); } return tipEl; }
    function hideTip(){ if(tipEl){ tipEl.style.display = 'none'; tipEl._id = null; } }   // ⚠️ 一併清單例快取鍵：鍵只含 uid，物品「原地」變動（強化 +N／碧恩屬性賦予）後 uid 不變 → 不清就會一直顯示改動前的舊內容
    // ===== 技能 tooltip（技能頁：游標移到技能上顯示能力）=====
    const SK_TYPE = { atk:'攻擊', heal:'治癒', buff:'增益', manual:'手動', convert:'轉換', summon:'召喚' };
    const SK_ELE = { fire:'火', water:'水', earth:'地', wind:'風', none:'無' };
    const SK_STAT2 = { ac:'AC', mr:'魔防', dr:'傷害減免', er:'迴避', str:'力量', dex:'敏捷', con:'體質', int:'智力', wis:'精神', cha:'魅力', extraDmg:'額外傷害', extraHit:'額外命中', magicDmg:'魔法傷害', extraMp:'額外MP', mpR:'MP恢復', hpR:'HP恢復', meleeHit:'近距命中', rangedHit:'遠距命中', meleeDmg:'近距傷害', rangedDmg:'遠距傷害', resFire:'火屬性抗性', resWater:'水屬性抗性', resEarth:'地屬性抗性', resWind:'風屬性抗性' };
    const SK_MEFF = { teleport:'瞬間移動', sense:'能量感測', recall:'回村', charm:'迷魅', barrier:'隔絕無敵（無法攻擊/施法/用道具・不受任何傷害・不自然恢復）' };
    function buildSkillTipHTML(sid){
        let sk = DB.skills[sid]; if(!sk) return '';
        let tc = sk.type==='atk'?'text-cyan-300':(sk.type==='heal'?'text-green-300':(sk.type==='manual'?'text-amber-300':'text-purple-300'));
        let parts = [];
        parts.push(`<div class="font-bold text-base ${tc}" style="margin-bottom:2px;">${sk.n}</div>`);
        parts.push(`<div class="text-slate-400" style="font-size:11px;margin-bottom:4px;">${SK_TYPE[sk.type]||'技能'}${sk.tier?(' ・ 第'+sk.tier+'階'):''}</div>`);
        let meta = [];
        let needLv = (typeof skillReqLv==='function') ? skillReqLv(sk, sid) : undefined;
        if(needLv !== undefined) meta.push('需求 Lv.'+needLv);
        { let _costs = []; if(sk.hpCost) _costs.push('HP '+sk.hpCost); if(sk.mp) _costs.push('MP '+sk.mp); if(sk.costItem){ let _ci = DB.items[sk.costItem.id]; _costs.push((_ci ? _ci.n : '材料')+'×'+(sk.costItem.qty||1)); } if(_costs.length) meta.push('消耗 '+_costs.join('、')); }   // 🐉 同時消耗 HP＋MP 的技能(覺醒/冥想/隱身/堅固防護/幻術士混亂等)：兩者並列顯示；🌀 costItem 為可選施法材料
        if(sk.dur) meta.push('持續 '+sk.dur+' 秒');
        if(sk.cd) meta.push('冷卻 '+(sk.cd/10)+' 秒');
        if(meta.length) parts.push(`<div class="text-slate-300">${meta.join(' ・ ')}</div>`);
        let eff = [];
        if(sk.dmgDice) eff.push((sk.target==='all'?'範圍':'')+'傷害 '+sk.dmgDice[0]+'d'+sk.dmgDice[1]+(sk.ele&&sk.ele!=='none'?'（'+SK_ELE[sk.ele]+'屬）':''));
        if(sk.multiDmg) eff.push('多段傷害 '+sk.multiDmg.map(function(x){return x[0]+'d'+x[1];}).join('＋')+(sk.ele&&sk.ele!=='none'?'（'+SK_ELE[sk.ele]+'屬）':''));
        if(sk.fullRestore) eff.push('單體治療：立即恢復全部已損失HP');
        else if(sk.classicHeal) { let ch=sk.classicHeal; eff.push((sk.groupHeal?'全隊':'單體')+'治療 ('+ch.baseDice+'＋INT治癒加成)d'+ch.sides+' ×2'+(ch.mult&&ch.mult!==1?(' ×'+ch.mult):'')); }
        else if(sk.healBase || sk.healDice) eff.push('治療 '+(sk.healBase||0)+(sk.healDice?('＋'+sk.healDice[0]+'d'+sk.healDice[1]):''));
        if(sk.healCooldownTicks) eff.push('冷卻 '+(sk.healCooldownTicks/10)+' 秒');
        if(sk.justiceHeal) eff.push('受施法者性向影響：正義值越高恢復量越高（滿正義 +20%・中立/邪惡無提升）');   // 💙 v3.5.75 正義治癒加成
        if(sk.reqJustice) eff.push('限正義性向施放（性向值 ≥ 1000）');   // 💙 v3.5.75 究極光裂術門檻
        if(sk.lifesteal) eff.push('吸取生命');
        if(sk.instakill) eff.push('即死（不死系）');
        // 🛡️ v2.6.69 審計#15：補渲染 reqWpn/skillAddDmg/stun(Chance)——衝擊之暈等技能的機制原本在唯一說明面完全隱形
        if(sk.reqWpn==='w2h') eff.push('限雙手武器（非弓）');
        else if(sk.reqWpn==='bow') eff.push('限弓');
        if(sk.skillAddDmg) eff.push('一般攻擊傷害＋'+sk.skillAddDmg);
        if(sk.stun) eff.push('命中時'+(sk.stunChance!=null?(Math.round(sk.stunChance*100)+'% 機率'):'')+'暈眩');
        if(sk.status) eff.push('附加：'+(STATUS_NAME[sk.status.kind]||sk.status.kind));
        if(sk.summon) eff.push('召喚協力單位');
        if(sk.mEff) eff.push(SK_MEFF[sk.mEff]||'特殊效果');
        if(sk.darkPoison) eff.push('一般攻擊命中 50% 機率使目標中毒：每秒該次攻擊 60% 傷害、持續 5 秒、最多 1 層（取較高傷害並刷新；劇毒精通→100%、每秒 200%）');
        if(sk.moveSpeedMult){
            let moveSpeedText = '移動速度+'+Math.round((sk.moveSpeedMult - 1) * 100)+'%（速度×'+sk.moveSpeedMult;
            if(sid === 'sk_holy_dash') moveSpeedText += '，與風之疾走互斥';
            else if(sid === 'sk_elf_winddash') moveSpeedText += '，與神聖疾走互斥，取代精靈餅乾移速';
            moveSpeedText += '）';
            eff.push(moveSpeedText);
        } else if(sk.moveSpeedReplacesCookie) eff.push('取代精靈餅乾的移動速度提升');
        if(sk.d && typeof sk.d==='object'){
            let dd = sk.d, s = [], _resK = ['resFire','resWater','resEarth','resWind'];
            if(dd.resFire && dd.resFire===dd.resWater && dd.resFire===dd.resEarth && dd.resFire===dd.resWind){
                s.push('全屬性抗性'+sgn(dd.resFire));   // 🔧 四屬性抗性相同 → 合併為「全屬性抗性」
                for(let k in dd){ if(_resK.indexOf(k)===-1) s.push((SK_STAT2[k]||k)+sgn(dd[k])); }
            } else {
                for(let k in dd){ s.push((SK_STAT2[k]||k)+sgn(dd[k])); }
            }
            if(s.length) eff.push(s.join('、'));
        }
        if(sk.desc) eff.push(sk.desc);   // 📜 v3.1.79 稽核修：被動效果說明（戰士印記/王者加護等寫在 desc·原 tooltip 不讀→玩家 hover 看不到效果）
        if(sk.d && typeof sk.d === 'string') eff.push(sk.d);   // 📜 v3.1.79 稽核修：字串型 d 說明（粉碎能量/心靈破壞·與物件型 d(數值加成) 同名不同型）
        if(eff.length) parts.push(`<div class="text-rose-300" style="font-size:12px;">${eff.join(' ／ ')}</div>`);
        if(sk.msg) parts.push(`<div class="text-slate-400" style="font-size:11px;margin-top:4px;">${sk.msg}</div>`);
        return parts.join('');
    }
    function buildItemTipHTML(id, hidePrice){
        let d = DB.items[id]; if(!d) return '';
        let nameColor = getItemColor({ id });
        let parts = [];
        parts.push(`<div class="font-bold text-base ${nameColor}" style="margin-bottom:2px;">${d.n}</div>`);
        let tl = TYPE_LABEL[d.type] || '道具';
        if(d.type === 'wpn'){ if(d.isBow) tl += '（弓）'; else if(d.w2h) tl += '（雙手）'; }
        parts.push(`<div class="text-slate-400" style="font-size:11px;margin-bottom:4px;">${tl}</div>`);
        if(d.type === 'wpn'){
            let ranged = (d.ranged === true);
            parts.push(`<div class="text-orange-300">小型傷害 ${d.dmgS} / 大型傷害 ${d.dmgL}</div>`);
            let ex = [];
            if(d.hit) ex.push(`${ranged?'遠距':'近距'}命中 ${sgn(d.hit)}`);
            if(d.dmgBonus !== undefined && d.dmgBonus !== 0) ex.push(`${ranged?'遠距':'近距'}傷害 ${sgn(d.dmgBonus)}`);
            if(d.mdmg) ex.push(`魔法傷害 ${sgn(d.mdmg)}`);
            if(ex.length) parts.push(`<div class="text-slate-300">${ex.join(' / ')}</div>`);
        } else if(d.type === 'arm' || d.type === 'acc'){
            let st = [];
            ['ac','mr','dr','er','str','dex','con','int','wis','cha','mhp','mmp','hpR','mpR','resFire','resWater','resEarth','resWind','meleeHit','rangedHit','meleeDmg','rangedDmg','mdmg','extraHit','extraDmg'].forEach(k => {
                if(d[k] !== undefined && d[k] !== 0) st.push(`${STAT_LABEL[k]||k} ${sgn(k === 'ac' ? -d[k] : d[k])}`);   // 🔧 AC 顯示取負（ac:3 ＝ 防禦 AC-3，越低越好），與背包資訊欄一致
            });
            if(st.length) parts.push(`<div class="text-slate-300">${st.join(' / ')}</div>`);
        } else if(d.type === 'skillbk' && d.sk && DB.skills[d.sk]){
            parts.push(`<div class="text-purple-300">習得技能：${DB.skills[d.sk].n}</div>`);
        }
        if(d.type === 'wpn' || d.type === 'arm' || d.type === 'acc'){
            let _eff = [];
            if(d.unBonus) _eff.push('不死／狼人加成（額外造成1D20傷害）');   // 🗑️ v3.5.87 刪恆假死運算元 unDice / sp==='elf'（DB.items 全表零定義·sp 只存在於變身型態物件且為數字）
            if(d.eff === 'pierce')     _eff.push('穿透 ' + (d.pierceChance !== undefined ? d.pierceChance : 100) + '%（命中後追加攻擊另一名敵人）');
            if(d.alsoPierce)           _eff.push('穿透 ' + (d.pierceChance !== undefined ? d.pierceChance : 100) + '%（命中後追加攻擊另一名敵人）');   // 🌑 v3.3.33 附帶穿透
            if(d.eff === 'moonburst')  _eff.push('月光爆裂（命中時8%造成1D30＋強化×2風傷）');
            if(d.eff === 'dice_death') _eff.push('即死（命中時1%使非首領目標死亡）');
            if(d.eff === 'haste')      _eff.push('自我加速（裝備時常駐加速）');
            if(d.eff === 'crush')      _eff.push('重擊（提高重擊機率，重擊取武器最大傷害）');
            if(d.eff === 'cleave')     _eff.push('切割（重擊時攻速+20%，持續2秒）');
            if(d.eff === 'combo')      _eff.push('雙擊 ' + (d.comboRate||0) + '%（追加一次完整一般攻擊）');   // 🔧 鋼爪/雙刀：雙擊特效
            if(d.weakExpose)           _eff.push('弱點曝光（命中12%疊加，供屠宰者增傷）');   // 🐉 鎖鏈劍
            if(d.vampPct)              _eff.push('吸取HP ' + Math.round(d.vampPct * 100) + '%（依本次傷害恢復）');   // 🐉 嗜血者鎖鏈劍
            if(d.ignHardSkin)          _eff.push('貫穿（無視硬皮額外減傷）');   // 🗡️ 暗黑十字弓
            if(d.redSpecter)           _eff.push('紅惡靈逆襲（4%＋每強化1%，造成水魔傷並吸取10%HP）');   // 👹 隱藏的魔族武器
            if(d.blueSpecter)          _eff.push('藍惡靈奪魔（4%＋每強化1%，恢復3D6 MP）');   // 👹 隱藏的魔族武器
            if(d.block)                _eff.push('格檔 ' + d.block + '%（重擊時依此機率減半傷害；一般攻擊為上述機率的30%）');
            if(d.eff === 'magicburst') _eff.push('魔爆（傷害魔法時依智力觸發，追加該次總傷害30%的無屬性傷害）');
            if(d.eff === 'mp_drain' || d.mpOnHit)   _eff.push('命中恢復MP');
            if(d.immStone)             _eff.push('免疫石化');
            if(d.immPoison)            _eff.push('免疫中毒');
            if(d.unique)               _eff.push('唯一（最多裝備1個）');
            // 🏹 與背包資訊欄一致補齊：弓連射 / 魔杖共鳴・魔擊 / 蕾雅冰裂術 / 附魔施放（經典模式由 filterClassicEffLabels 過濾停用者）
            if(d.rapidfire)            _eff.push('連射 ' + d.rapidfire + '%（追加1～3箭，每箭30%傷害）');
            if(d.eff === 'magicstrike') _eff.push('魔擊（攻擊時依力量觸發必中重擊）');
            if(d.meleeHitSpell)        _eff.push('命中施法（攻擊命中時施放' + (d.meleeHitSpell.skn || '附加法術') + '）');
            if(d.spellProc) {
                let _rateText = `${d.procRateBase || 1}%${d.procRatePerEn ? `＋每強化${d.procRatePerEn}%` : ''}`;
                _eff.push(`攻擊施法 ${_rateText}（觸發${d.spellProc.skn || '附加法術'}）`);
            }
            if(d.procSkill) {
                let _procName = (DB.skills[d.procSkill] && DB.skills[d.procSkill].n) || '技能';
                let _rateText = `${d.procRateBase || 1}%${d.procRatePerEn ? `＋每強化${d.procRatePerEn}%` : ''}`;
                _eff.push(`${d.procOnHit ? '命中施法' : '攻擊施法'} ${_rateText}（觸發${_procName}）`);
            }
            if(d.procSkill2 && d.procSkill2.skId) _eff.push(`攻擊施法 ${d.procSkill2.rate || 5}%（觸發${(DB.skills[d.procSkill2.skId] && DB.skills[d.procSkill2.skId].n) || '技能'}）`);   // 🌅 九尾妖狐的怒火：第二觸發槽
            if(d.procPoisonPct) _eff.push(`附毒（命中附加每秒該次傷害${d.procPoisonPct.pct || 50}%的中毒，最多1層，持續${d.procPoisonPct.dur || 6}秒）`);   // 🌅 毒鵺的黑尾
            if(d.iaiCrit) _eff.push('居合必定爆擊');   // 🌅 鐮鼬的尾刃
            if(d.heavyBonusDmg) _eff.push(`重擊時額外傷害+${d.heavyBonusDmg}`);   // 🌅 牛鬼的斷角
            if(d.procStatusSkill) {
                let _statusName = (DB.skills[d.procStatusSkill.skId] && DB.skills[d.procStatusSkill.skId].n) || '異常狀態';
                _eff.push(`異常攻擊 ${d.procStatusSkill.rate || 0}%（命中時造成${_statusName}）`);
            }
            if(d.procStatus && d.procStatus.kind) _eff.push(`異常攻擊 ${d.procStatus.rate || 0}%（攻擊時使目標${(typeof STATUS_NAME !== 'undefined' && STATUS_NAME[d.procStatus.kind]) || '異常狀態'} ${d.procStatus.dur || 6} 秒）`);   // 🕸️ v3.7.75 深紅之弩：束縛
            if(d.procPoison)          _eff.push(`中毒 ${d.procPoison.rate || 0}%（命中時使目標中毒${d.procPoison.dur ? `，持續${d.procPoison.dur}秒` : ''}）`);
            else if(d.procPoisonRate) _eff.push(`中毒 ${d.procPoisonRate}%（命中時使目標中毒）`);
            if(d.procInstakill) {
                let _ik = d.procInstakill, _ikCond = _ik.tag === 'undead' ? '不死系' : (_ik.hpBelow ? `HP低於${Math.round(_ik.hpBelow * 100)}%` : '非首領');
                _eff.push(`即死 ${Math.round((_ik.p || 0) * 100)}%（命中${_ikCond}目標時發動）`);
            }
            if(d.procBonusDmg)  _eff.push(`額外傷害 ${d.procBonusDmg.rate}%（攻擊時追加${d.procBonusDmg.dmg}點傷害）`);
            if(d.procDmgReduce) _eff.push(`傷害減免 ${d.procDmgReduce.rate}%（受傷時減少${d.procDmgReduce.amount}點傷害）`);
            if(d.allLures) _eff.push('誘捕萬用（視為持有全部誘捕狀態）');
            if(d.eleBonusDmg) {
                let _bn = {fire:'火',water:'水',wind:'風',earth:'地'}[d.eleBonusDmg.ele] || '指定';
                _eff.push(`屬性專攻（攻擊${_bn}屬性敵人時額外傷害+${d.eleBonusDmg.dmg || d.eleBonusDmg.add || 0}）`);
            }
            if(d.counterAllEle) _eff.push('萬象剋制（一般攻擊剋制所有屬性敵人）');
            if(d.counterEles) _eff.push(`一般攻擊剋制${d.counterEles.map(e => ({ earth: '地', wind: '風', fire: '火', water: '水' }[e] || e)).join('、')}屬性敵人（×1.4）`);
            if(d.procBurn) _eff.push(`灼燒${d.procBurn.rate ? ` ${d.procBurn.rate}%` : ''}（命中後每秒${d.procBurn.dmg || 10}點火傷，持續${d.procBurn.dur || 6}秒）`);
            if(d.onHitEleDmg) {
                let _en = {fire:'火焰',water:'寒冰',wind:'風雷',earth:'大地',none:'無屬性'}[d.onHitEleDmg.ele] || '屬性';
                _eff.push(`${_en}附傷${d.onHitEleDmg.rate ? ` ${d.onHitEleDmg.rate}%` : ''}（命中時追加${d.onHitEleDmg.dmg}點傷害）`);
            }
            if(d.freeChill) _eff.push('寒冰氣息不消耗魔力');
            if(d.windHelm) _eff.push('施放加速術／強力加速術不消耗魔力（裝備或放在背包皆有效）');   // 🏝️ v3.5.87 風之頭盔：隱藏規格補進說明（旗標原零引用·實作在 js/08 playerHasWindHelm）
            if(d.noConsume && d.isArrow) _eff.push('箭矢不會消耗');
            if(d.oneHand && d.isBow) _eff.push('可單手持握');
            if(d.ele && d.ele !== 'none') _eff.push(`一般攻擊化為${({fire:'火',water:'水',wind:'風',earth:'地'}[d.ele] || d.ele)}屬性`);
            if(d.skillDmgMult) {
                let _skills = Object.keys(d.skillDmgMult).map(skId => `${(DB.skills[skId] && DB.skills[skId].n) || skId}×${d.skillDmgMult[skId]}`);
                if(_skills.length) _eff.push('技能增幅（' + _skills.join('、') + '）');
            }
            if(d.autoCastMpMult && d.autoCastMpMult > 1) _eff.push(`自動施法代價（MP消耗×${d.autoCastMpMult}）`);
            if(d.autoCastDmgMult && d.autoCastDmgMult > 1) _eff.push(`自動施法增幅（傷害×${d.autoCastDmgMult}）`);
            if(d.silencedBonusDmg) _eff.push(`沉默專攻（攻擊沉默目標額外傷害+${d.silencedBonusDmg}）`);
            if(d.poisonedBonusDmg) _eff.push(`中毒專攻（攻擊中毒目標額外傷害+${d.poisonedBonusDmg}）`);
            if(d.slowedBonusDmg) _eff.push(`緩速專攻（攻擊緩速目標額外傷害+${d.slowedBonusDmg}）`);
            if(d.immParalyzeBonusDmg) _eff.push(`強韌專攻（攻擊免疫麻痺目標額外傷害+${d.immParalyzeBonusDmg}）`);
            if(typeof WAND_LIGHTARROW_IDS !== 'undefined' && WAND_LIGHTARROW_IDS.includes(id)) _eff.push('共鳴（攻擊時依智力免費施放光箭）');
            // 🔧 武器標籤特效（反擊/居合/鈍擊/出血）：來自 WEAPON_TAGS（非 eff 欄位），與背包資訊欄一致顯示
            if(d.type === 'wpn' && typeof getWeaponTags === 'function'){
                if(typeof weaponHasBleed === 'function' && weaponHasBleed(id)) _eff.push('出血（命中疊加8秒流血，每秒造成該次傷害20%）');
                let _tg = getWeaponTags(id);
                if(_tg.includes('單手劍'))   _eff.push('反擊（受一般攻擊命中時50%反擊；格檔時必定）');
                if(_tg.includes('武士刀'))   _eff.push('居合（無盾且迴避／敵人未命中時50%反擊）');
                if(_tg.includes('單手鈍器')) _eff.push('鈍擊（命中時延遲目標攻擊1秒）');
                if(_tg.includes('雙刀'))     _eff.push('雙刃 5%（傷害×2）');   // ⚔️ 雙刀內建特性
                if(_tg.includes('鋼爪'))     _eff.push('重擊 +5%（重擊取武器最大傷害）');   // ⚔️ 鋼爪內建特性：一般攻擊額外 5% 重擊
            }
            if(d.type === 'wpn' && typeof weaponPurposeLabels === 'function') _eff.push(...weaponPurposeLabels(d));
            if(d.relic && typeof relicPurposeLabels === 'function') _eff.push(...relicPurposeLabels(d));
            _eff = typeof dedupeGeneratedTooltipEffects === 'function'
                ? dedupeGeneratedTooltipEffects([...new Set(_eff)], d)
                : [...new Set(_eff)];
            _eff = filterClassicEffLabels(_eff, d);   // 🎮 經典模式：移除已停用特效字樣（classicOk 物品不過濾）
            if(_eff.length) parts.push(`<div class="text-rose-300 font-bold" style="font-size:12px;">特效：${_eff.join(' / ')}</div>`);
        }
        if(!hidePrice && typeof d.p === 'number' && d.p > 0) parts.push(`<div class="text-yellow-400" style="font-size:12px;">售價 ${d.p.toLocaleString()} 金幣</div>`);   // 🗡️ 裝備收集冊 hidePrice=true：隱藏售價
        let _rawDesc = typeof tooltipItemDescription === 'function' ? tooltipItemDescription(d, id) : d.d;
        if(_rawDesc) parts.push(`<div class="text-slate-400" style="font-size:11px;margin-top:4px;">${_rawDesc}</div>`);
        return parts.join('');
    }
    // 取出 hover 物品的實例（倉庫或背包），供倉庫等以實例顯示的清單使用
    function findTipItem(src, uidv){
        try {
            if(src === 'wh'){ let w = loadWarehouse(); return ((w && w.items) || []).find(x => x.uid === uidv) || null; }
            if(src === 'eq'){ let e = (typeof player !== 'undefined' && player && player.eq) || {}; for(let k in e){ if(e[k] && e[k].uid === uidv) return e[k]; } return null; }   // 🖱️ 已裝備物品（裝備視窗格）：從 player.eq 找實例
            return (player.inv || []).find(x => x.uid === uidv) || null;
        } catch(e){ return null; }
    }
    document.addEventListener('mousemove', function(e){
        let host = e.target && e.target.closest ? e.target.closest('.tip-host') : null;
        let ic = document.getElementById('interaction-content');
        let eb = document.getElementById('equip-book');
        // 技能頁 host（data-tip-skill）與收集冊 host（data-tip-id）不限於 NPC 互動面板；其餘 host 仍限定於 interaction-content
        let ok = host && ((ic && ic.contains(host)) || (eb && !eb.classList.contains('hidden') && eb.contains(host)) || host.hasAttribute('data-tip-skill') || host.hasAttribute('data-tip-id') || host.hasAttribute('data-tip-uid'));   // 🖱️ data-tip-uid（背包/裝備欄實例物品）不限面板，任何處 hover 即顯示完整資訊 tooltip
        if(!ok){ hideTip(); return; }
        let el = getTip();
        let tSkill = host.getAttribute('data-tip-skill');
        let tUid = host.getAttribute('data-tip-uid');
        let tId = host.getAttribute('data-tip-id');
        let tCraft = host.getAttribute('data-tip-craft');
        if(tSkill){
            // 技能頁：依技能 ID 顯示能力
            if(el._id !== 'SK:'+tSkill){ let h = buildSkillTipHTML(tSkill); if(!h){ hideTip(); return; } el.innerHTML = h; el._id = 'SK:'+tSkill; }
        } else if(tUid){
            // 實例物品（倉庫/背包清單）：顯示完整資訊（含 +N、詞綴、套裝效果）
            let tSrc = host.getAttribute('data-tip-src') || 'inv';
            let key = 'I:' + tSrc + ':' + tUid;
            if(el._id !== key){
                let it = findTipItem(tSrc, tUid);
                if(!it){ hideTip(); return; }
                el.innerHTML = `<div class="font-bold text-base ${getItemColor(it)}" style="margin-bottom:4px;">${getItemFullName(it)}</div>`
                    + `<div class="text-slate-300" style="font-size:12px;line-height:1.5;">${buildItemDescHTML(it)}</div>`;
                el._id = key;
            }
        } else if(tId){
            if(tCraft){
                // ⚒️ 製作成品：直接綁定 result ID，不再以 icon 反查（共用圖片不會抓錯物品）；沿用背包／裝備欄完整 tooltip，含寵物裝備能力。
                let key = 'CRAFT:' + tId;
                if(el._id !== key){
                    let d = DB.items[tId]; if(!d){ hideTip(); return; }
                    let it = { id:tId, uid:'craft-tip', cnt:1, en:0, bless:false, anc:false, attr:false, seteff:false };
                    el.innerHTML = `<div class="font-bold text-base ${getItemColor(it)}" style="margin-bottom:4px;">${getItemFullName(it)}</div>`
                        + `<div class="text-slate-300" style="font-size:12px;line-height:1.5;">${buildItemDescHTML(it)}</div>`;
                    el._id = key;
                }
            } else {
                // 🗡️ 收集冊：依基底物品 ID 顯示資訊（已收集裝備）
                if(el._id !== ('BID:'+tId)){ let h = buildItemTipHTML(tId, true); if(!h){ hideTip(); return; } el.innerHTML = h; el._id = 'BID:'+tId; }   // 🗡️ 收集冊隱藏售價
            }
        } else {
            // 商店/製作圖示：依 icon → 基底物品 ID 顯示
            if(!ICON2ID) buildMap();
            let img = host.querySelector('img');
            let src = img ? img.getAttribute('src') : null;
            let id = src ? ICON2ID[src] : null;
            if(!id){ hideTip(); return; }
            if(el._id !== id){ el.innerHTML = buildItemTipHTML(id); el._id = id; }
        }
        el.style.display = 'block';
        let pad = 16, w = el.offsetWidth, h = el.offsetHeight;
        let x = e.clientX + pad, y = e.clientY + pad;
        if(x + w > window.innerWidth - 6) x = e.clientX - pad - w;
        if(y + h > window.innerHeight - 6) y = e.clientY - pad - h;
        el.style.left = Math.max(4, x) + 'px';
        el.style.top = Math.max(4, y) + 'px';
    });
    document.addEventListener('mousedown', hideTip);
})();
