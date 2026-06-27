    const MOB_DROPS = {
        // ===== 🏴‍☠️ 海賊島 =====
        '狂野之毒': [['arm_bluepirate_boots',0.5],['acc_curse_green',0.1],['new_item_157',1],['new_item_179',100]],
        '狂暴蜥蜴人': [['wpn_pirate_shortblade',1],['arm_bluepirate_cloak',0.8],['acc_curse_red',0.1],['new_item_154',1],['bk_dragon_awaken_falion',0.3],['acc_curse_diamond_ring',0.1],['acc_curse_emerald_ring',0.1]],
        '狂野毒牙': [['arm_bluepirate_boots',0.5],['acc_curse_green',0.1],['new_item_154',1],['new_item_179',100]],
        '狂野之魔': [['arm_bluepirate_boots',0.5],['acc_curse_green',0.1],['new_item_151',1],['new_item_179',100]],
        '高等蜥蜴人': [['arm_bluepirate_cloak',0.8],['acc_curse_red',0.1],['new_item_160',1],['bk_elf_mirror',0.1],['item_son_remains',3],['acc_curse_diamond_ring',0.1],['acc_curse_sapphire_ring',0.1]],
        '藍尾蜥蜴': [['arm_bluepirate_gloves',0.5],['acc_curse_green',0.1],['new_item_160',1],['item_son_letter',3]],
        '奇異鸚鵡': [['arm_bluepirate_gloves',0.5],['acc_curse_green',0.1],['new_item_154',1]],
        '藏寶箱': [['arm_bluepirate_armor',1]],
        '海賊骷髏': [['wpn_pirate_cutlass',1],['arm_46',0.01],['acc_curse_red',0.1],['acc_curse_blue',0.1],['new_item_154',1],['new_item_155',0.2],['acc_curse_diamond_ring',0.1],['acc_curse_emerald_ring',0.1]],
        '重裝蜥蜴人': [['wpn_pirate_shortblade',1],['arm_bluepirate_cloak',0.8],['acc_curse_red',0.1],['new_item_151',1],['acc_curse_diamond_ring',0.1],['acc_curse_ruby_ring',0.1],['acc_curse_sapphire_ring',0.1]],
        '海賊骷髏士兵': [['wpn_pirate_cutlass',1],['acc_curse_blue',0.1],['new_item_160',1],['new_item_161',0.1],['acc_curse_diamond_ring',0.1],['acc_curse_emerald_ring',0.1]],
        '海賊骷髏刀手': [['wpn_pirate_dagger',1],['acc_curse_blue',0.1],['scroll_weapon',0.25]],
        '海賊骷髏首領': [['wpn_pirate_cutlass',1],['acc_curse_blue',0.1],['new_item_151',1],['new_item_152',0.1],['acc_curse_diamond_ring',0.1],['acc_curse_ruby_ring',0.1],['item_son_portrait',2]],
        '德雷克': [['wpn_glory_sword',0.1],['wpn_pirate_shortblade',5],['wpn_pirate_cutlass',3],['wpn_abyss_dualblade',0.05],['wpn_dark_crystalball',0.05],['wpn_silent_crossbow',0.1],['arm_faith_shield',0.1],['new_item_151',5],['new_item_157',5],['new_item_154',5],['new_item_160',5],['new_item_152',1],['new_item_158',2],['new_item_161',1],['new_item_155',1],['new_item_153',1],['new_item_159',2],['new_item_162',1],['new_item_156',1],['bk_magic_shield',1],['bk_holy_barrier',0.1],['bk_soul_up',1],['bk_elf_attrfire',1],['bk_dragon_reaper',1],['acc_curse_diamond_ring',1],['acc_curse_ruby_ring',0.1],['acc_curse_sapphire_ring',1],['acc_curse_emerald_ring',1]],
        // ===== 🏛️ 底比斯 =====
        '底比斯 曼陀羅草(白)': [['mat_osiris_basic_up',5],['mat_rift_shard',10],['bk_dragon_awaken_falion',0.5]],
        '底比斯 曼陀羅草': [['mat_osiris_basic_down',5],['mat_rift_shard',10],['bk_dragon_awaken_falion',0.5]],
        '底比斯 聖甲蟲': [['mat_osiris_basic_up',5],['mat_rift_shard',10]],
        '底比斯 聖甲蟲(藍)': [['mat_osiris_basic_down',5],['mat_rift_shard',10]],
        '底比斯 凱比斯(黑)': [['mat_osiris_basic_up',5],['mat_rift_shard',10],['bk_dragon_awaken_antares',0.5]],
        '底比斯 凱比斯(紅)': [['mat_osiris_basic_down',5],['mat_rift_shard',10],['bk_dragon_awaken_antares',0.5]],
        '底比斯 尖碑石奴': [['mat_osiris_basic_up',5],['mat_rift_shard',10],['mem_cube_quake',0.5]],
        '底比斯 尖碑石奴(黑)': [['mat_osiris_basic_down',5],['mat_rift_shard',10],['mem_cube_quake',0.5]],
        '底比斯 斯芬克斯': [['mat_osiris_basic_up',5],['mat_rift_shard',10],['bk_dragon_lavabolt',0.05]],
        '底比斯 斯芬克斯(黑)': [['mat_osiris_basic_down',5],['mat_rift_shard',10],['bk_dragon_lavabolt',0.05]],
        '底比斯 尼荷斯': [['mat_osiris_high_up',5],['mat_rift_shard',10],['item_thebes_altar_key',2]],
        '底比斯 尼荷斯(藍)': [['mat_osiris_high_down',5],['mat_rift_shard',10],['item_thebes_altar_key',2]],
        '底比斯 阿努斯': [['mat_osiris_high_up',5],['mat_rift_shard',10],['item_thebes_altar_key',2]],
        '底比斯 阿努斯(黑)': [['mat_osiris_high_down',5],['mat_rift_shard',10],['item_thebes_altar_key',2]],
        '底比斯 巴斯': [['mat_osiris_high_up',5],['mat_rift_shard',10],['item_thebes_altar_key',2],['bk_dragon_deathlightning',0.3]],
        '底比斯 巴斯(紅)': [['mat_osiris_high_down',5],['mat_rift_shard',10],['item_thebes_altar_key',2],['bk_dragon_deathlightning',0.3]],
        '底比斯 阿努比斯': [['amu_cha',0.5],['acc_120',0.5],['amu_str',0.5],['amu_int',0.5],['acc_122',0.5],['acc_121',0.75],['acc_117',1.5],['acc_summon_ctrl',1.5],['acc_116',1.5],['acc_thebes_anubis',0.1],['blt_thebes_osiris',0.1],['scroll_armor',100],['scroll_weapon',100],['mat_crack_core',100],['item_osiris_box_high',100],['mem_mindbreak',0.5]],
        '底比斯 賀洛斯': [['amu_cha',0.5],['acc_120',0.5],['amu_str',0.5],['amu_int',0.5],['acc_122',0.5],['acc_121',0.75],['acc_117',1.5],['acc_summon_ctrl',1.5],['acc_116',1.5],['acc_thebes_horus',0.1],['blt_thebes_osiris',0.1],['scroll_armor',100],['scroll_weapon',100],['mat_crack_core',100],['item_osiris_box_high',100],['mem_mindbreak',0.5]],
        '林德拜爾': [['arm_83',1],['acc_117',3],['acc_116',3],['new_item_160',50],['new_item_161',50],['new_item_162',50],['bk_break',30],['bk_slow',30],['bk_charm',30],['bk_str_up',30],['bk_earthquake',30],['bk_regen',30],['bk_summon',10],['bk_holy_dash',10],['bk_tornado',10],['bk_blizzard',10],['bk_invisible',3],['bk_resurrection',30],['bk_holy_barrier',10],['bk_elf_windshot',10],['bk_elf_winddash',10],['bk_elf_stormeye',10],['bk_elf_stormshot',10],['bk_dark_crit',10],['new_item_193',100],['bk_dark_armorbreak',1],['scroll_acc',100],['wpn_katana',30],['wpn_siruge',30],['wpn_dual_silver',3],['wpn_dual_abyss',30],['wpn_crimson_spear',3],['wpn_claw_silver',3],['wpn_claw_abyss',3],['wpn_32',3],['wpn_xbow_abyss',10],['clk_pride_wind',10],['arm_88',3],['arm_59',30],['amr_plate',30],['glv_glove',30],['acc_122',10],['acc_121',10],['rng_wind',10],['acc_127',10],['acc_129',10],['acc_128',10],['acc_131',10],['acc_130',10]],
        '冰魔': [['wpn_33',5], ['wpn_crystal_dagger',0.5], ['wpn_vengeance',0.05], ['wpn_katana',1], ['wpn_2hsword',1], ['wpn_demon_scythe',0.05], ['wpn_hate_claw',0.05], ['hlm_demon',0.1], ['amr_demon',0.1], ['arm_59',1], ['amr_plate',1], ['glv_water_spirit',1], ['bot_demon',0.1], ['new_item_152',30], ['new_item_159',30], ['bk_shock_stun',5], ['bk_thunder_storm',5], ['bk_fire_storm',2], ['bk_meteor',0.2]],
        '巨人': [['wpn_alien',2.5], ['wpn_10',2.5], ['wpn_battleaxe',2], ['wpn_berserker',0.5], ['arm_110',0.01], ['acc_127',0.1], ['acc_129',0.1], ['acc_128',0.1], ['blt_body',0.01], ['acc_131',0.01], ['acc_130',0.01], ['blt_titan',0.001], ['bk_elf_physboost',0.2]],
        '巨人戰士': [['wpn_alien',2.5], ['wpn_10',2.5], ['wpn_battleaxe',2], ['wpn_berserker',0.5], ['arm_110',0.01], ['acc_127',0.1], ['acc_129',0.1], ['acc_128',0.1], ['blt_body',0.01], ['acc_131',0.01], ['acc_130',0.01], ['blt_titan',0.001], ['bk_elf_physboost',0.2]],
        '巨人長老': [['wpn_alien',2.5], ['wpn_10',2.5], ['wpn_battleaxe',3], ['wpn_berserker',0.5], ['arm_110',0.03], ['acc_127',0.1], ['acc_129',0.1], ['acc_128',0.1], ['blt_body',0.01], ['acc_131',0.01], ['acc_130',0.01], ['blt_titan',0.001], ['bk_elf_physboost',0.2]],
        '古代巨人': [['wpn_katana',30], ['wpn_greatsword',10], ['mat_unknown_axe',0.03], ['amr_plate',30], ['glv_glove',30], ['acc_122',1], ['acc_129',1], ['blt_giant_ring',1], ['acc_131',1], ['blt_titan',0.1], ['new_item_151',30], ['new_item_152',30], ['new_item_153',1], ['scroll_weapon',10], ['scroll_armor',100], ['bk_reduction_armor',0.5], ['bk_spike_armor',1], ['bk_magic_shield',5], ['bk_meditation',5], ['bk_mana_drain',5], ['bk_greater_haste',5], ['bk_seal',0.5], ['bk_elf_earthguard',5], ['bk_elf_groundtrap',1], ['bk_elf_earthbless',5], ['bk_elf_steelguard',0.5], ['bk_elf_attrfire',0.1]],
        // ===== 🔥 50級試煉擴充：精靈墓穴 =====
        '地之牙': [['wpn_mithril_dagger',0.1],['wpn_ori_dagger',0.05],['glv_earth_spirit',0.01],['new_item_151',1],['new_item_157',1],['new_item_160',1],['new_item_154',1],['new_item_152',0.3],['new_item_158',0.5],['new_item_161',0.1],['new_item_155',0.5],['bk_elf_earthshield',0.1],['bk_elf_physboost',0.2]],
        '風之牙': [['wpn_mithril_dagger',0.1],['wpn_ori_dagger',0.05],['glv_wind_spirit',0.01],['new_item_151',1],['new_item_157',1],['new_item_160',1],['new_item_154',1],['new_item_152',0.3],['new_item_158',0.5],['new_item_161',0.1],['new_item_155',0.5],['bk_elf_triple',0.05]],
        '水之牙': [['wpn_mithril_dagger',0.1],['wpn_ori_dagger',0.05],['glv_water_spirit',0.01],['new_item_151',1],['new_item_157',1],['new_item_160',1],['new_item_154',1],['new_item_152',0.3],['new_item_158',0.5],['new_item_161',0.1],['new_item_155',0.5],['bk_sleep_mist',0.2],['bk_elf_mirror',0.1],['bk_elf_watervital',0.1]],
        '火之牙': [['wpn_mithril_dagger',0.1],['wpn_ori_dagger',0.05],['glv_fire_spirit',0.005],['new_item_151',1],['new_item_157',1],['new_item_160',1],['new_item_154',1],['new_item_152',0.3],['new_item_158',0.5],['new_item_161',0.1],['new_item_155',0.5],['bk_fire_storm',0.1],['bk_elf_triple',0.05],['bk_elf_attrfire',0.01]],
        '水靈之主': [['scroll_acc',0.001],['wpn_mithril_dagger',0.5],['wpn_ori_dagger',0.1],['glv_water_spirit',0.05],['new_item_152',0.5],['new_item_158',0.8],['new_item_161',0.5],['new_item_155',0.8],['bk_sleep_mist',0.2],['bk_elf_watervital',0.1]],
        '深淵食屍鬼': [['wpn_crimson_spear',0.01],['wpn_demon_axe',0.1],['acc_abyss_ring',0.1],['scroll_armor',3],['bk_sleep_mist',0.2]],
        '深淵弓箭手': [['acc_abyss_ring',0.1],['bk_sleep_mist',0.2],['bk_elf_triple',0.05]],
        '地靈之主': [['wpn_mithril_dagger',0.5],['wpn_ori_dagger',0.1],['glv_earth_spirit',0.03],['new_item_152',0.5],['new_item_158',0.8],['new_item_161',0.5],['new_item_155',0.8],['bk_elf_earthshield',0.1],['bk_elf_physboost',0.5]],
        '風靈之主': [['wpn_mithril_dagger',0.5],['wpn_ori_dagger',0.1],['glv_wind_spirit',0.02],['new_item_152',0.5],['new_item_158',0.8],['new_item_161',0.5],['new_item_155',0.8]],
        '火靈之主': [['wpn_mithril_dagger',0.5],['wpn_ori_dagger',0.1],['glv_fire_spirit',0.01],['new_item_152',0.5],['new_item_158',0.8],['new_item_161',0.5],['new_item_155',0.8],['bk_fire_storm',0.1],['bk_elf_attrfire',0.02]],
        '西斯': [['scroll_acc',0.001],['acc_abyss_ring',0.1],['bk_sleep_mist',0.2],['bk_elf_magicerase',0.01], ['mat_black_blood', 1]],
        '深淵水靈': [['wpn_mithril_dagger',1],['wpn_ori_dagger',0.2],['wpn_crimson_spear',0.01],['wpn_demon_axe',0.1],['glv_water_spirit',0.08],['new_item_152',1],['new_item_158',1],['new_item_161',1],['new_item_155',1],['bk_elf_mirror',0.2],['bk_elf_watervital',0.25]],
        '深淵地靈': [['wpn_mithril_dagger',1],['wpn_ori_dagger',0.2],['wpn_crimson_spear',0.01],['wpn_demon_axe',0.1],['glv_earth_spirit',0.05],['new_item_152',1],['new_item_158',1],['new_item_161',1],['new_item_155',1],['bk_elf_mirror',0.2],['bk_elf_physboost',1]],
        '深淵風靈': [['wpn_mithril_dagger',1],['wpn_ori_dagger',0.2],['wpn_crimson_spear',0.01],['wpn_demon_axe',0.1],['glv_wind_spirit',0.05],['new_item_152',1],['new_item_158',1],['new_item_161',1],['new_item_155',1],['bk_elf_mirror',0.2]],
        '深淵火靈': [['scroll_acc',0.001],['wpn_mithril_dagger',1],['wpn_ori_dagger',0.2],['wpn_crimson_spear',0.01],['wpn_demon_axe',0.1],['glv_fire_spirit',0.02],['new_item_152',1],['new_item_158',1],['new_item_161',1],['new_item_155',1],['bk_elf_mirror',0.2],['bk_elf_attrfire',0.03]],
        '曼波兔': [['wpn_mithril_dagger',3],['wpn_ori_dagger',1],['hlm_mambo',0.1],['amr_mambo',0.1],['glv_water_spirit',0.1],['glv_earth_spirit',0.1],['glv_fire_spirit',0.1],['glv_wind_spirit',0.1],['new_item_152',10],['new_item_158',10],['new_item_161',3],['new_item_155',10],['new_item_153',1],['new_item_159',1],['new_item_162',1],['new_item_156',1],['bk_holy_dash',0.3],['bk_soul_up',0.1],['bk_elf_triple',0.1],['bk_elf_magicerase',0.02],['bk_elf_mirror',0.3],['bk_elf_physboost',0.2],['bk_elf_watervital',0.1],['bk_elf_attrfire',0.05],['acc_purify_earring',0.1]],
        '深淵之主': [['acc_124',1],['scroll_acc',0.1],['wpn_crimson_spear',0.3],['wpn_demon_axe',3],['acc_abyss_ring',2],['new_item_152',30],['new_item_158',30],['new_item_161',30],['new_item_155',30],['new_item_153',1],['new_item_159',5],['new_item_162',5],['new_item_156',3],['bk_shock_stun',0.05],['bk_seal',1],['bk_meteor',0.05], ['mat_black_blood', 15]],
        // ===== 🔥 50級試煉擴充：大洞穴隱遁者村莊地區 =====
        '魔蝙蝠': [['bk_tornado',0.01]],
        '黑暗妖精盜賊': [['scroll_acc',0.0001],['wpn_small_katana',2],['wpn_dual_rasta',1],['wpn_xbow_rasta',3],['arm_rasta_leather',0.5],['bot_rasta',1],['shd_rasta',5],['scroll_weapon',0.5],['scroll_armor',0.5],['bk_holy_dash',0.05],['bk_dark_poison',1],['bk_dark_str',1],['bk_dark_burn',1],['bk_dark_crit',0.5]],
        '闇之精靈': [['scroll_weapon',0.5],['scroll_armor',0.5],['bk_holy_barrier',0.003],['bk_abs_barrier',0.001],['bk_dark_stealth',1],['bk_dark_poison',1],['bk_dark_mrup',1],['bk_dark_burn',1],['bk_dark_poisonres',1],['bk_dark_double',0.1],['bk_dark_fang',0.1],['bk_dark_crit',0.5],['mat_rough_stone',5]],
        '犰狳': [['scroll_armor',0.5]],
        '魔熊': [['acc_bear_ring',0.001],['scroll_weapon',0.5],['scroll_armor',0.5],['bk_bless_wpn',0.1],['bk_slow',0.5]],
        '歐姆民兵': [['scroll_weapon',0.5],['bk_bless_wpn',0.1],['bk_slow',0.5]],
        '闇精靈王': [['scroll_weapon',0.5],['scroll_armor',0.5],['bk_bless_wpn',0.1],['bk_berserk',0.1],['bk_soul_up',0.001],['bk_abs_barrier',0.001],['bk_elf_blazewpn',0.05],['bk_dark_stealth',1],['bk_dark_poison',1],['bk_dark_mrup',1],['bk_dark_burn',1],['bk_dark_double',0.1],['bk_dark_fang',0.1],['bk_dark_crit',0.5],['mat_rough_stone',5],['wpn_qigu_resonance',0.001]],
        '金屬蜈蚣': [['amr_centipede',0.5], ['mat_black_blood', 2]],
        '馴獸師': [['clk_wolf',0.5],['scroll_weapon',0.5],['scroll_armor',0.3],['bk_dark_poison',1],['bk_dark_mrup',1],['bk_dark_burn',1],['bk_dark_poisonres',1],['bk_dark_dex',1],['bk_dark_double',0.1]],
        // ===== 🔥 50級試煉擴充：古代巨人之墓 =====
        '墳墓守護者': [['scroll_acc',0.001],['new_item_151',5],['new_item_160',5],['new_item_154',10],['new_item_152',1],['new_item_161',1],['new_item_155',2],['new_item_153',0.5],['new_item_162',1],['new_item_156',1],['mat_demon_anklet_white',0.02]],
        '墳墓守護者法師': [['new_item_151',5],['new_item_160',5],['new_item_154',10],['new_item_152',1],['new_item_161',1],['new_item_155',2],['new_item_153',0.5],['mat_demon_anklet_blue',0.05]],
        '墳墓守護者騎士': [['new_item_151',5],['new_item_160',5],['new_item_154',10],['new_item_152',2],['new_item_161',2],['new_item_155',2],['new_item_153',0.5],['mat_demon_anklet_red',0.05]],
        '巨大墳墓守護者': [['scroll_acc',0.001],['new_item_151',5],['new_item_160',5],['new_item_154',5],['new_item_152',5],['new_item_161',1],['new_item_155',3],['new_item_153',0.5],['new_item_162',1],['new_item_156',1],['mat_demon_anklet_black',0.05]],
        // ===== 🔥 50級試煉擴充：魔族神殿 =====
        '炎魔的分身': [['new_item_157',10],['new_item_160',10],['new_item_154',10],['new_item_158',2],['new_item_161',2],['new_item_155',1],['new_item_159',5],['new_item_162',1],['new_item_156',1],['mat_black_mithril',0.5]],
        '黑暗棲林者': [['amr_darkdweller',0.8],['bot_darkdweller',0.8],['scroll_armor',0.5],['scroll_weapon',0.3],['quest_ring_darkdweller',0.05]],
        '炎魔的思克巴': [['mat_black_mithril',0.5]],
        '炎魔的思克巴女皇': [['acc_117',0.001],['acc_116',0.001],['mat_black_mithril',0.5], ['mat_black_blood', 1]],
        '炎魔的小惡魔': [['mat_black_mithril',0.5], ['mat_black_blood', 1]],
        '炎魔的巴風特': [['scroll_acc',0.001],['wpn_powerless_baphomet',0.0001],['amr_baphomet',0.001],['new_item_151',5],['new_item_154',5],['new_item_152',1],['new_item_161',1],['new_item_153',0.5],['mat_black_mithril',0.5], ['mat_black_blood', 1]],
        '墮落的司祭(一階)': [['mat_black_mithril',0.5],['mat_fallen_fang',0.01],['item_fallen_key',0.5],['mat_soulstone_shard',1],['new_item_234',1], ['mat_black_blood', 1.5]],   // ⚔️ 戰士試煉：神秘慎重藥水 1%
        '墮落的司祭(二階)': [['mat_black_mithril',0.5],['item_fallen_key',0.5],['mat_soulstone_shard',1],['new_item_234',1], ['mat_black_blood', 1.5]],   // ⚔️ 戰士試煉：神秘慎重藥水 1%
        '墮落的司祭(三階)': [['mat_black_mithril',0.5],['mat_fallen_hand',0.01],['item_fallen_key',0.5],['mat_soulstone_shard',1],['new_item_234',1], ['mat_black_blood', 1.5]],   // ⚔️ 戰士試煉：神秘慎重藥水 1%
        '炎魔的巴列斯': [['scroll_acc',0.001],['wpn_powerless_baless',0.0001],['bot_baless',0.001],['new_item_151',5],['new_item_154',5],['new_item_152',1],['new_item_161',1],['new_item_153',0.5],['mat_black_mithril',0.5], ['mat_black_blood', 1]],
        '墮落的司祭(四階)': [['mat_black_mithril',0.5],['mat_fallen_poison',0.01],['item_fallen_key',0.5],['mat_soulstone_shard',1], ['mat_black_blood', 1.5]],
        '墮落的司祭(五階)': [['mat_black_mithril',0.5],['mat_fallen_tongue',0.01],['item_fallen_key',0.5],['mat_soulstone_shard',1], ['mat_black_blood', 1.5]],
        '炎魔的惡魔': [['mat_flame_eye',3],['wpn_vengeance',0.01],['wpn_demon_scythe',0.0001],['wpn_hate_claw',0.001],['new_item_153',1],['mat_black_mithril',0.5],['mat_flame_sword',3],['mat_flame_claw',3],['mat_flame_heart',3]],
        '墮落': [['blt_mr',1],['scroll_acc',0.001],['clk_fallen',0.01],['amr_fallen',0.01],['glv_fallen',0.01],['bot_fallen',0.01],['mat_black_mithril',10],['mat_fallen_scythe',0.1],['mat_fallen_head',0.1],['mat_soulstone_shard',5], ['mat_black_blood', 5]],
        // 🌑 暗影神殿 掉落
        '死亡的司祭(思克巴)': [['mat_black_mithril',1],['mat_soulstone_shard',5]],
        '死亡的司祭(巴風特)': [['mat_black_mithril',1],['mat_soulstone_shard',5]],
        '混沌的司祭(飛翼)': [['mat_black_mithril',1],['mat_soulstone_shard',5]],
        '混沌的司祭(野獸)': [['scroll_acc',0.001],['mat_black_mithril',1],['mat_soulstone_shard',5]],
        '火焰之影親衛隊(巴風特)': [['scroll_acc',0.001],['mat_black_mithril',1],['mat_soulstone_shard',5]],
        '混沌': [['scroll_acc',0.1],['wpn_chaos_thorn',0.1],['hlm_chaos',2],['clk_chaos',0.1],['amr_chaos',2],['glv_chaos',0.5],['mat_chaos_head',20],['mat_black_mithril',30],['mat_soulstone_shard',100], ['mat_black_blood', 50]],
        '死亡': [['clk_death',0.1],['amr_death',0.1],['glv_death',0.1],['shd_death',0.1],['mat_death_head',10],['mat_black_mithril',30],['mat_soulstone_shard',100], ['mat_black_blood', 50]],
        // ===== 拉斯塔巴德地下洞穴 =====
        '歐姆': [['scroll_revive', 1]],
        '狂暴的歐姆': [['scroll_revive', 1]],
        '歐姆裝甲兵': [['scroll_acc',0.0001],['wpn_xbow_rasta', 0.2]],
        '狂暴的歐姆裝甲兵': [['wpn_xbow_rasta', 0.2], ['scroll_weapon', 0.5], ['scroll_armor', 1]],
        '黑暗妖精殘兵(弓)': [['wpn_small_katana', 0.1], ['wpn_bow_rasta', 0.5], ['arm_rasta_leather', 2], ['bot_rasta', 1], ['quest_ring_darkdweller', 0.1]],
        '黑暗妖精殘兵(劍)': [['wpn_sword_rasta', 0.5], ['clk_dark', 0.1], ['arm_rasta_leather', 3], ['bot_rasta', 2], ['scroll_weapon', 0.5], ['scroll_armor', 1], ['bk_berserk', 0.1], ['bk_dark_str', 1], ['bk_dark_burn', 0.5], ['bk_dark_erup', 0.1]],
        '黑暗妖精殘兵(十字弓)': [['wpn_dagger_rasta', 0.5], ['wpn_xbow_rasta', 1], ['scroll_weapon', 0.5], ['scroll_armor', 1], ['bk_holy_dash', 0.1], ['bk_dark_stealth', 1], ['bk_dark_poison', 1], ['bk_dark_str', 1], ['bk_dark_crit', 0.1], ['bk_dark_erup', 0.1], ['quest_ring_darkdweller', 0.1]],
        '黑暗妖精殘兵(法師)': [['wpn_wand_rasta', 0.5], ['amr_rasta_robe', 0.1], ['bk_dark_dex', 1]],
        '黑暗妖精殘兵(雙手劍)': [['wpn_dual_rasta', 0.5]],
        '黑暗精靈使': [['scroll_acc',0.001],['scroll_weapon', 0.5], ['scroll_armor', 1], ['bk_holy_barrier', 0.005], ['bk_dark_stealth', 1], ['bk_dark_poison', 1], ['bk_dark_mrup', 1], ['bk_dark_burn', 1], ['bk_dark_poisonres', 0.5], ['bk_dark_double', 0.05], ['bk_dark_fang', 0.1], ['bk_dark_crit', 0.5], ['quest_ring_elfcaller', 0.001], ['bk_abs_barrier', 0.01]],
        // ===== 拉斯塔巴德正門：黑暗妖精守軍 =====
        '黑暗妖精警衛(十字弓)': [['wpn_xbow_heavy_rasta', 0.5], ['scroll_armor', 0.5], ['scroll_weapon', 0.5], ['bk_holy_dash', 0.05], ['bk_dark_poison', 1], ['bk_dark_burn', 1], ['bk_dark_poisonres', 1]],
        '黑暗妖精魔法學徒': [['wpn_wand_rasta', 1], ['amr_rasta_robe', 0.1], ['bk_dark_dex', 1], ['mat_black_blood', 1]],
        '黑暗妖精警衛(矛)': [['wpn_spear_rasta', 0.5], ['arm_rasta_leather', 0.5], ['shd_rasta', 1], ['scroll_armor', 0.5], ['scroll_weapon', 0.5], ['bk_dark_mrup', 1], ['bk_dark_burn', 1], ['bk_dark_fang', 0.1]],
        '黑暗妖精巡守': [['wpn_small_katana', 1], ['wpn_bow_rasta', 2], ['arm_rasta_leather', 0.5], ['bot_rasta', 1]],
        '黑暗妖精士兵': [['wpn_sword_rasta', 1], ['arm_rasta_leather', 0.5], ['bot_rasta', 1], ['scroll_armor', 0.5], ['scroll_weapon', 0.5], ['bk_dark_poison', 1], ['bk_dark_burn', 1], ['bk_dark_str', 1]],
        '黑暗妖精將軍': [['scroll_acc',0.001],['scroll_armor', 0.5], ['scroll_weapon', 0.5], ['bk_reduction_armor', 0.05], ['bk_meteor', 0.001], ['bk_dark_poison', 1], ['bk_dark_burn', 1], ['bk_dark_poisonres', 1], ['bk_dark_dex', 0.6], ['bk_dark_double', 0.1], ['bk_dark_fang', 0.5], ['mat_black_blood', 1]],
        // ===== 魔獸訓練場 =====
        '拉斯塔巴德守門人': [['item_king_key', 1]],
        '黑虎': [['quest_ring_beasttamer', 0.05], ['mat_legion_beast', 0.05], ['clk_blacktiger', 0.5]],
        '拉斯塔巴德馴獸師': [['wpn_official_2h', 0.01], ['glv_official', 0.05], ['bot_official', 0.05], ['quest_ring_beasttamer', 0.05], ['mat_legion_beast', 0.05]],
        '受詛咒的馴獸師': [['wpn_official_2h', 0.01], ['glv_official', 0.05], ['bot_official', 0.05], ['quest_ring_beasttamer', 0.05], ['mat_legion_beast', 0.05]],
        '地獄束縛犬': [['quest_ring_beasttamer', 0.05], ['mat_legion_beast', 0.05]],
        '魂騎士': [['scroll_acc',0.001],['wpn_official_2h', 0.01], ['glv_official', 0.05], ['bot_official', 0.05], ['blt_dark', 0.05], ['quest_ring_beasttamer', 0.05], ['mat_legion_beast', 0.05]],
        '地獄奴隸': [['scroll_acc',0.0001],['mat_legion_beast', 0.05]],
        '喚獸師': [['amr_summoner_robe', 0.01], ['acc_summoner_amulet', 0.001], ['quest_ring_summoner', 0.01]],
        // ===== 魔獸軍王之室 BOSS =====
        '魔獸軍王巴蘭卡': [['scroll_acc',0.1],['wpn_baranka_claw', 1], ['wpn_baranka_steelclaw', 0.1], ['hlm_official', 2], ['hlm_baranka', 0.1], ['amr_official', 2], ['amr_baranka', 0.1], ['glv_official', 3], ['glv_baranka', 1], ['bot_kingbeast', 0.1], ['bot_official', 3], ['bot_baranka', 0.1], ['blt_dark', 5], ['mat_legion_beast', 100], ['mat_crest_beast', 10]],
        '法令軍王蕾雅': [['scroll_acc',0.1],['wpn_laia_wand', 0.03], ['wpn_priest_wand', 3], ['hlm_priest', 3], ['amr_laia_robe', 0.1], ['amr_kinglaw', 0.1], ['amr_priest', 3], ['glv_priest', 3], ['bot_priest', 3], ['acc_laia_amulet', 0.1], ['acc_law_king_chain', 0.1], ['acc_laia_ring', 0.05], ['blt_dark', 1], ['mat_legion_law', 100], ['mat_crest_law', 10]],
        '冥法軍王海露拜': [['scroll_acc',0.1],['wpn_priest_wand', 3], ['hlm_priest', 3], ['clk_kingnecro', 0.05], ['shd_priest_book', 3], ['acc_necro_king_ring', 0.1], ['mat_legion_necro', 100], ['mat_crest_necro', 10], ['bk_elf_flamesoul', 0.02]],
        '暗殺軍王史雷佛': [['scroll_acc',0.1],['wpn_assassin_mark', 0.1], ['hlm_official', 3], ['glv_official', 3], ['glv_kingassassin', 0.1], ['bot_official', 3], ['blt_dark', 10], ['mat_legion_assassin', 100], ['mat_crest_assassin', 10]],
        // ===== 黑魔法研究室 =====
        '地元素守護者': [['mat_legion_law', 0.05], ['mat_earth_breath', 0.1]],
        '水元素守護者': [['mat_legion_law', 0.05], ['mat_water_breath', 0.1]],
        '風元素守護者': [['mat_legion_law', 0.05], ['mat_wind_breath', 0.1]],
        '火元素守護者': [['mat_legion_law', 0.05], ['mat_fire_breath', 0.1]],
        '黑暗妖精法師': [['mat_legion_law', 0.05], ['wpn_wand_rasta', 1], ['amr_rasta_robe', 0.1], ['bk_dark_dex', 1], ['bk_tornado', 0.05], ['bk_ice_spike', 1], ['bk_soul_up', 0.01]],
        '黑法師': [['scroll_acc',0.0001],['wpn_darkmage_wand', 0.01], ['amr_darkmage_robe', 0.05], ['acc_darkmage_amulet', 0.001], ['quest_ring_darkmage', 0.01]],
        // ===== 冥法軍訓練場 =====
        '黑暗復仇者': [['wpn_dark_sword', 0.01], ['amr_official', 0.05], ['mat_legion_necro', 0.1], ['arm_59', 0.1]],
        // ===== 🏛️ 格蘭肯神殿．長老之室 掉落（3 一般怪 + 8 長老 BOSS） =====
        '拉斯塔巴德近衛隊': [['wpn_spear_rasta', 0.1]],
        '拉斯塔巴德近衛隊隊長': [['wpn_dual_spike', 0.5]],
        '長老隨從': [['clk_priest', 0.5], ['shd_priest_book', 0.1]],
        '長老．琪娜': [['bk_zombie', 3], ['mat_black_powder', 3], ['mat_history_1', 3], ['item_dk_insignia', 3]],
        '長老．安迪斯': [['wpn_official_blade', 0.5], ['wpn_dark_sword', 0.5], ['wpn_xbow_dark', 0.5], ['hlm_dark', 0.5], ['glv_official', 0.5], ['bk_shock_stun', 1], ['bk_blizzard', 1], ['bk_holy_barrier', 0.1], ['bk_soul_up', 0.8], ['bk_dark_fang', 1], ['mat_black_powder', 3], ['mat_history_4', 3], ['item_dk_insignia', 3], ['bk_elf_energyboost', 1]],
        '長老．巴塔斯': [['wpn_dual_spike', 0.5], ['wpn_dual_dark', 0.5], ['wpn_dual_rasta', 0.5], ['bot_official', 0.5], ['bk_seal', 1], ['bk_elf_soul', 0.5], ['mat_black_powder', 3], ['mat_history_2', 3], ['item_dk_insignia', 3]],
        '長老．巴洛斯': [['wpn_red_crystalwand', 0.1], ['hlm_priest', 0.5], ['clk_priest', 0.5], ['bk_mummy_curse', 1], ['bk_cancel', 1], ['bk_slow', 1], ['bk_elf_earthshield', 1], ['bk_elf_watervital', 1], ['bk_elf_energyboost', 1], ['mat_black_powder', 3], ['mat_history_3', 3], ['item_dk_insignia', 3]],
        '長老．巴陸德': [['wpn_crystal_dagger', 0.5], ['wpn_red_crystalwand', 0.1], ['wpn_priest_wand', 0.5], ['amr_dark_cape', 0.5], ['bk_spike_armor', 0.5], ['bk_thunder_storm', 0.5], ['bk_meteor', 0.5], ['bk_abs_barrier', 0.1], ['bk_elf_winddash', 1], ['bk_elf_flamesoul', 1], ['bk_elf_energyboost', 1], ['bk_dragon_awaken_baraka', 0.5], ['mat_black_powder', 3], ['mat_history_8', 3], ['item_dk_insignia', 3]],
        '長老．拉曼斯': [['wpn_dark_sword', 0.5], ['wpn_official_2h', 0.5], ['wpn_claw_dark', 0.5], ['hlm_official', 0.5], ['arm_official_cloak', 0.5], ['bot_dark', 0.5], ['bk_invisible', 0.2], ['bk_elf_groundtrap', 1], ['bk_dark_str', 1], ['bk_elf_energyboost', 1], ['mat_black_powder', 3], ['mat_history_7', 3], ['item_dk_insignia', 3]],
        '長老．泰瑪斯': [['wpn_blood_2hsword', 1], ['clk_dark', 0.5], ['glv_official', 0.5], ['bk_holy_dash', 0.5], ['bk_elf_mirror', 1], ['bk_dark_dex', 1], ['bk_elf_energyboost', 1], ['mat_black_powder', 3], ['mat_history_6', 3], ['item_dk_insignia', 3]],
        '長老．艾迪爾': [['glv_dark', 1], ['bot_priest', 0.5], ['bk_dark_shadow', 0.5], ['bk_sleep_mist', 0.5], ['bk_elf_lifebless', 0.5], ['bk_dragon_awaken_antares', 1], ['mat_black_powder', 3], ['mat_history_5', 3], ['item_dk_insignia', 3]],
        '炎魔之影': [['mat_black_blood', 1]],
        '血色術士': [['wpn_red_crystalwand', 0.1], ['hlm_priest', 0.05], ['amr_priest', 0.05], ['amr_dark_cape', 1], ['bot_priest', 0.05], ['mat_legion_necro', 0.1]],
        '歐姆戰士': [['hlm_priest', 0.05], ['clk_priest', 0.02], ['bot_priest', 0.05], ['glv_priest', 0.05], ['blt_dark', 0.05], ['mat_legion_assassin', 0.1], ['mat_legion_necro', 0.1]],
        '闇黑君王': [['wpn_red_crystalwand', 0.1], ['hlm_priest', 0.02], ['bot_priest', 0.02], ['mat_legion_necro', 0.1]],
        '血騎士': [['wpn_blood_2hsword', 0.1], ['hlm_priest', 0.05], ['mat_legion_necro', 0.1]],
        '重裝歐姆戰士': [['hlm_priest', 0.05], ['clk_priest', 0.02], ['bot_priest', 0.05], ['blt_dark', 0.05], ['mat_legion_assassin', 0.1]],
        '冰之女王侍女': [['bk_thunder_storm', 0.05], ['bk_cancel', 0.1]],
        '冰之女王': [['mat_icequeen_heart',1],['wpn_crystal_dagger', 0.5], ['arm_88', 0.1], ['arm_63', 10], ['glv_crystal', 5], ['acc_116', 0.1], ['amu_int', 1], ['acc_122', 1], ['acc_128', 0.5], ['acc_129', 0.5], ['acc_130', 0.1], ['acc_131', 0.1], ['scroll_weapon', 10], ['scroll_armor', 20], ['scroll_revive', 1], ['new_item_150', 1], ['new_item_151', 50], ['new_item_152', 5], ['bk_summon', 0.5], ['bk_invisible', 0.05], ['bk_fire_storm', 0.5], ['new_item_195', 1], ['bk_elf_winddash', 1], ['bk_elf_lifespring', 3], ['bk_elf_lifebless', 1], ['bk_elf_steelguard', 1], ['bk_magic_shield', 2], ['bk_dark_shadow', 1], ['bk_seal', 1], ['wpn_icequeen_wand', 0.1], ['bk_blizzard_storm', 1], ['bk_elf_watervital', 10], ['hlm_icequeen_charm', 0.3], ['amr_icequeen_charm', 0.3], ['bot_icequeen_charm', 0.3], ['mat_ice_crystal', 1], ['acc_icequeen_ear_0', 1]],
        '夢幻之島蘑菇': [['scroll_weapon',1], ['scroll_armor',2]],
        '夢幻之島鬼火': [['scroll_weapon',1], ['scroll_armor',2], ['scroll_poly',1]],
        '夢幻之島火蜥蜴': [['wpn_2hsword',1], ['wpn_giantaxe',1], ['scroll_weapon',1], ['scroll_armor',2], ['bk_fire_storm',0.01]],
        '夢幻之島冰人': [['scroll_weapon',1], ['scroll_armor',2]],
        '夢幻之島殺人蜂': [['scroll_weapon',1], ['scroll_armor',2]],
        '夢幻之島暴走兔': [['scroll_weapon',1], ['scroll_armor',2]],
        '夢幻之島火炎蛋': [['scroll_weapon',1], ['scroll_armor',2], ['bk_holy_light',0.5], ['scroll_poly',1]],
        '夢幻之島冰石高崙': [['wpn_silveraxe',1], ['scroll_weapon',1], ['scroll_armor',2], ['scroll_revive',1], ['bk_elf_soul',0.1]],
        '夢幻之島大鬼火': [['scroll_weapon',1], ['scroll_armor',2]],
        '夢魘': [['wpn_2hsword',3], ['scroll_weapon',5], ['scroll_armor',10], ['panacea_wis',1], ['bk_elf_triple',0.1]],
        '冰人': [['wpn_battleaxe',1], ['new_item_150',1], ['new_item_195',1], ['bk_elf_watervital',0.1]],
        '不死鳥': [['arm_69', 10], ['wpn_katana',5], ['wpn_siruge',1], ['amr_plate',5], ['arm_88',0.1], ['arm_63',10], ['acc_117',0.01], ['amu_str',0.1], ['acc_120',0.1], ['acc_128',1], ['acc_129',1], ['acc_130',0.5], ['acc_131',0.5], ['scroll_weapon',10], ['scroll_armor',20], ['scroll_acc',1], ['new_item_159',0.1], ['bk_sleep_mist',1], ['bk_holy_barrier',0.1], ['bk_meteor',0.05], ['bk_fire_storm',0.5], ['bk_elf_dancefire',1], ['bk_blaze',1], ['bk_elf_flamesoul',0.1], ['bk_fire_prison',1], ['bk_elf_attrfire',1]],
        '亞力安': [['scroll_weapon',1], ['scroll_armor',2], ['scroll_acc',0.01], ['bk_slow',0.5], ['bk_mummy_curse',0.5], ['bk_heal2',0.1], ['bk_holy_light',0.1], ['bk_haste_spell',0.5], ['bk_earthquake',0.1], ['bk_rock_prison',0.5], ['bk_greater_haste',0.1], ['bk_quake',0.005], ['bk_elf_groundtrap',0.1], ['acc_demonbane',0.01]],
        '人形殭屍': [['bk_vampire',0.1], ['bk_dark_shadow',0.1]],
        '人魚': [['scroll_acc',0.01], ['new_item_mermaid_scale', 1], ['bk_blizzard_storm', 0.001]],
        '伊弗利特': [['arm_69', 10], ['wpn_katana',2], ['amr_plate',5], ['arm_63',10], ['scroll_weapon',10], ['scroll_armor',20], ['scroll_acc',1], ['new_item_152',0.5], ['new_item_153',0.1], ['new_item_155',0.5], ['new_item_156',0.1], ['new_item_158',0.5], ['new_item_159',0.1], ['new_item_161',0.5], ['new_item_162',0.1], ['bk_fireball',3], ['bk_dex_up',1], ['bk_str_up',1], ['bk_cancel',1], ['bk_fire_storm',0.2], ['bk_elf_magicerase',1], ['bk_elf_triple',1], ['bk_blaze',1], ['bk_elf_attrfire',1]],
        '伊萊克頓': [['acc_127',0.001], ['scroll_armor',1], ['new_item_151',5], ['new_item_152',0.5], ['new_item_153',0.1], ['bk_thunder',0.05], ['bk_summon',0.002], ['bk_thunder_storm',0.001], ['bk_ice_spike',0.5], ['bk_elf_lifespring',0.05], ['bk_blizzard_storm',0.002]],
        '侏儒': [['wpn_26',1], ['hlm_gnome',2], ['arm_86',5], ['shd_gnome',3], ['new_item_169',1], ['scroll_poly',1], ['new_item_180',100]],
        '侏儒戰士': [['wpn_23',0.5], ['wpn_26',2], ['hlm_gnome',3], ['arm_86',5], ['shd_gnome',3], ['new_item_180',100]],
        '克特': [['acc_118',1],['wpn_12', 1], ['wpn_katana',1], ['wpn_longsword',10], ['wpn_2hsword',3], ['arm_60',5], ['tsh_tshirt',3], ['arm_87',10], ['arm_105',10], ['arm_106',0.5], ['arm_90',10], ['glv_glove',5], ['arm_110',1], ['arm_101',1], ['amr_kurt',1], ['arm_97',1], ['hlm_kurt',1], ['wpn_kurt_sword',0.1], ['scroll_weapon',10], ['scroll_armor',20], ['scroll_acc',1], ['bk_berserk',1], ['bk_shock_stun',1], ['bk_reduction_armor',0.5], ['bk_spike_armor',0.5], ['bk_solid_shield',0.5]],
        '冰原狼人': [['new_item_150',1], ['new_item_151',1], ['new_item_154',5], ['new_item_157',5], ['new_item_160',5]],
        '冰原老虎': [['scroll_acc',0.01], ['new_item_150',1], ['new_item_195',1]],
        '冰石高崙': [['wpn_2',3], ['glv_crystal',0.01], ['bk_ice_lance',0.001], ['bk_ice_spike',0.5], ['bk_elf_lifespring',0.05]],
        '卡司特': [['wpn_battleaxe',3], ['wpn_giantaxe',0.5], ['new_item_154',5], ['new_item_155',0.5], ['bk_summon',0.01]],
        '卡司特王': [['wpn_battleaxe',2], ['wpn_giantaxe',0.5], ['wpn_berserker',0.01], ['arm_45',0.1], ['scroll_weapon',1], ['scroll_armor',2], ['new_item_155',0.5], ['new_item_156',0.05], ['bk_disease',0.1]],
        '卡士柏': [['item_olin_diary',1],['arm_87',5], ['arm_90',10], ['arm_55',1], ['acc_117',0.01], ['amu_str',0.1], ['scroll_weapon',10], ['scroll_armor',20], ['scroll_acc',1], ['new_item_150',1], ['new_item_157',5], ['new_item_158',0.5], ['new_item_159',0.1], ['bk_fireball',5], ['bk_elf_dancefire',1], ['bk_elf_earthshield',1], ['bk_blaze',1], ['acc_119',0.1], ['acc_125',0.1]],
        '史巴托': [['hlm_mr', 0.5], ['wpn_scimitar',1], ['arm_42',3], ['arm_60',1], ['scroll_acc',0.001], ['arm_105',1], ['new_item_150',1]],
        '哈柏哥布林': [['hlm_mr', 0.5], ['wpn_9',3], ['arm_42',3], ['new_item_180',100]],
        '哈維': [['rng_harpy',0.01], ['arm_62',0.5], ['new_item_150',1], ['bk_haste_spell',0.5], ['bk_holy_dash',0.05], ['bk_greater_haste',0.01], ['new_item_195',1], ['bk_elf_stormeye',0.001]],
        '哥布林': [['hlm_mr', 0.05], ['wpn_9',1], ['wpn_10',1], ['arm_42',5], ['bot_short',3]],
        '地獄犬': [['wpn_strwand',0.1], ['wpn_witchwand',0.5], ['scroll_acc',0.01], ['new_item_150',1], ['new_item_157',5], ['new_item_158',0.5], ['new_item_159',0.1], ['bk_fireball',0.5], ['bk_break',0.5], ['bk_holy_barrier',0.001], ['new_item_195',1], ['mat_black_blood', 2]],
        '夢幻之島地精靈王': [['arm_69', 1], ['arm_63',5], ['scroll_weapon',5], ['scroll_armor',10], ['scroll_revive',1], ['panacea_con',1], ['mat_earth_breath',1]],
        '地靈': [['wpn_10',3], ['bot_short',1], ['new_item_179',50]],
        '夏洛伯': [['bk_slow',0.1], ['bk_earthquake',0.01], ['scroll_acc',0.001], ['new_item_144',1]],
        '多眼怪': [['scroll_weapon',1], ['new_item_160',5], ['new_item_161',0.5], ['new_item_162',0.1], ['bk_mummy_curse',0.5], ['bk_cancel',0.05], ['bk_elf_release',0.1], ['bk_weaken',0.1], ['bk_disease',0.1], ['bk_elf_triple',0.01]],
        '多羅': [['wpn_battleaxe',3], ['wpn_giantaxe',0.8], ['wpn_berserker',0.01], ['arm_61',0.5], ['arm_45',0.05], ['acc_132',0.01], ['bk_heal2',0.5], ['bk_regen',0.01], ['acc_doro',0.1]],
        '奎斯坦修': [['acc_128',0.01], ['scroll_weapon',0.5], ['scroll_armor',1], ['scroll_acc',0.01], ['new_item_151',5], ['new_item_152',0.5], ['new_item_153',0.1], ['bk_weaken',1]],
        '妖魔': [['wpn_dagger1',1], ['wpn_25',1], ['wpn_27',5], ['hlm_oasis',1], ['amr_oasis',5], ['new_item_179',50]],
        '妖魔巡守': [['scroll_acc',0.001]],
        '妖魔弓箭手': [['wpn_8',1], ['hlm_oasis',2], ['arm_64',1], ['amr_oasis',5], ['clk_oasis',3], ['new_item_179',50]],
        '妖魔殭屍': [['wpn_33',0.1], ['hlm_oasis',2], ['arm_64',3], ['amr_oasis',5], ['arm_104',1]],
        '妖魔法師': [['wpn_oakwand',1], ['wpn_38',0.1], ['wpn_strwand',0.01], ['new_item_150',1], ['bk_heal2',0.01], ['bk_blaze',0.001], ['item_orc_elder_head',1], ['bk_soul_up',0.001]],
        '妖魔鬥士': [['arm_69', 0.1], ['hlm_oasis',2], ['arm_64',2], ['amr_oasis',3], ['clk_oasis',1], ['arm_104',1], ['arm_63',1]],
        '安塔瑞斯': [['wpn_katana',10], ['wpn_siruge',5], ['amr_plate',10], ['arm_88',1], ['glv_glove',20], ['arm_81',0.1], ['acc_116',0.1], ['acc_117',0.1], ['acc_121',1], ['acc_122',1], ['acc_127',5], ['acc_128',5], ['acc_129',5], ['blt_body',1], ['acc_130',1], ['acc_131',1], ['scroll_weapon',100], ['scroll_armor',100], ['scroll_acc',50], ['new_item_150',1], ['new_item_151',50], ['new_item_152',5], ['new_item_153',1], ['new_item_154',50], ['new_item_155',5], ['new_item_156',1], ['bk_break',10], ['bk_slow',10], ['bk_charm',10], ['bk_str_up',5], ['bk_earthquake',5], ['bk_regen',5], ['bk_summon',2], ['bk_resurrection',1], ['new_item_191',100], ['bk_counter_barrier',1], ['bk_elf_earthbless',30]],
        '安普長老': [['new_item_150',1], ['new_item_154',5], ['new_item_179',50], ['new_item_182',1], ['bk_rock_prison',0.1]],
        '密密': [['wpn_greatsword',1], ['hlm_mr', 1], ['arm_42',1], ['arm_59',0.1], ['bot_demon',0.05], ['glv_demon',0.05], ['bk_abs_barrier',0.01], ['bk_soul_up',0.01]],
        '巨大兵蟻': [['new_item_211',1],['arm_60',0.3], ['arm_47',0.01], ['new_item_154',5], ['new_item_155',0.5], ['new_item_156',0.1], ['new_item_157',5], ['new_item_158',0.5], ['new_item_159',0.1]],
        '巨大鱷魚': [['scroll_armor',10], ['scroll_acc',1], ['new_item_154',1], ['bk_thunder',1], ['bk_elf_watervital',0.1]],
        '巨蟻': [['arm_45',0.01], ['new_item_154',5]],
        '巨蟻女皇': [['acc_126',1],['arm_69', 10], ['wpn_katana',3], ['amr_plate',5], ['arm_63',5], ['arm_47',1], ['acc_121',0.1], ['acc_127',1], ['blt_body',0.5], ['scroll_weapon',10], ['scroll_armor',20], ['scroll_acc',1], ['new_item_150',1], ['new_item_154',5], ['new_item_155',0.5], ['new_item_156',0.1], ['new_item_157',5], ['new_item_158',0.5], ['new_item_159',0.1], ['bk_heal2',1], ['bk_charm',1], ['bk_earthquake',1], ['bk_regen',0.5], ['bk_rock_prison',5], ['bk_greater_haste',1], ['new_item_195',1], ['bk_elf_magicerase',1], ['bk_dark_shadow',1], ['clk_antqueen_gold',0.1], ['clk_antqueen_silver',0.1], ['wpn_claw_abyss',0.05], ['bk_elf_physboost',5], ['bk_elf_earthbless',5], ['wpn_ancient_darkelf_sword',0.1], ['wpn_ancient_elf_xbow',0.1]],
        '巫師': [['item_olin_diary',0.01],['arm_87',0.5], ['arm_90',1], ['amu_str',0.001], ['scroll_weapon',1], ['scroll_armor',2], ['scroll_acc',0.01], ['new_item_151',5], ['new_item_152',0.5], ['new_item_153',0.1], ['bk_dex_up',0.1], ['bk_haste_spell',0.1], ['bk_greater_haste',0.05], ['bk_elf_stormeye',0.05], ['bk_weaken',0.1], ['item_crystal_ball',0.01], ['acc_119',0.01], ['acc_125',0.01]],
        '巴土瑟': [['item_olin_diary',1],['arm_87',5], ['arm_90',10], ['arm_54',1], ['acc_117',0.01], ['amu_int',0.1], ['scroll_weapon',10], ['scroll_armor',20], ['scroll_acc',1], ['new_item_150',1], ['new_item_154',5], ['new_item_155',0.5], ['new_item_156',0.1], ['bk_cancel',0.1], ['bk_quake',0.1], ['bk_elf_groundtrap',5], ['bk_elf_earthbless',1], ['acc_119',0.1], ['acc_125',0.1]],
        '巴拉卡斯': [['wpn_katana',10], ['wpn_siruge',5], ['amr_plate',10], ['arm_88',1], ['glv_glove',10], ['arm_82',0.1], ['acc_116',0.2], ['acc_117',0.2], ['amu_str',0.2], ['amu_int',0.2], ['acc_127',6], ['acc_128',6], ['acc_129',6], ['blt_body',1], ['acc_130',1], ['acc_131',1], ['scroll_weapon',100], ['scroll_armor',100], ['scroll_acc',50], ['new_item_150',1], ['new_item_151',100], ['new_item_152',10], ['new_item_153',2], ['new_item_157',100], ['new_item_158',10], ['new_item_159',2], ['bk_fireball',20], ['bk_slow',15], ['bk_charm',15], ['bk_str_up',10], ['bk_haste_spell',10], ['bk_summon',3], ['bk_invisible',1], ['bk_resurrection',1], ['new_item_192',100]],
        '巴風特': [['wpn_katana',2], ['wpn_2hsword',5], ['amr_plate',5], ['arm_88',0.1], ['glv_glove',10], ['acc_116',0.01], ['acc_127',0.5], ['acc_129',0.5], ['blt_body',0.1], ['acc_131',0.1], ['scroll_weapon',10], ['scroll_armor',20], ['scroll_acc',1], ['new_item_150',1], ['new_item_151',5], ['new_item_152',0.5], ['new_item_153',0.1], ['new_item_154',5], ['new_item_155',0.5], ['new_item_156',0.1], ['new_item_161',0.5], ['new_item_162',0.1], ['bk_charm',1], ['bk_earthquake',2], ['bk_summon',0.2], ['bk_rock_prison',5], ['bk_quake',1], ['new_item_195',1], ['bk_elf_dancefire',1], ['bk_magic_shield',1], ['bk_weaken',1], ['bk_bless_wpn',0.1], ['amu_cha',1], ['bk_elf_stormshot',1], ['bk_elf_mirror',1], ['bk_elf_flamesoul',0.01], ['bk_fire_prison',0.5], ['wpn_powerless_baphomet',0.1], ['amr_baphomet',1]],
        '希爾黛斯': [['new_item_160',0.5], ['new_item_161',0.5], ['new_item_162',0.1], ['bk_slow',0.5], ['bk_ice_lance',0.001], ['bk_ice_spike',0.5], ['bk_elf_lifespring',0.1], ['bk_elf_lifebless',0.01],['new_item_213',1], ['bk_elf_watervital',0.1]],
        '強盜': [['wpn_20', 0.5], ['arm_69', 0.5], ['hlm_mr', 0.5], ['wpn_shortbow',1], ['wpn_32',0.01], ['arm_42',2], ['arm_66',3], ['arm_98',0.1], ['arm_49',1], ['item_death_oath',1], ['new_item_226',1]],   // ⚔️ 戰士試煉：被偷的戒指 1%（warrior 限定）
        '強盜頭目': [['hlm_mr', 5], ['wpn_katana',1], ['wpn_silversword',3], ['arm_62',5], ['arm_87',5], ['scroll_acc',0.1], ['arm_42',10], ['new_item_152',0.5], ['new_item_153',0.1], ['new_item_155',0.5], ['new_item_156',0.1], ['new_item_158',0.5], ['new_item_159',0.1], ['new_item_161',0.5], ['new_item_162',0.1], ['item_nightvision',10], ['new_item_225',10]],   // ⚔️ 戰士試煉：被偷的項鍊 10%
        '影魔': [['acc_129',0.005], ['acc_131',0.001], ['bk_ice_spike',0.5], ['bk_magic_shield',0.01], ['bk_dark_shadow',0.1]],
        '思克巴': [['acc_117',0.001], ['bk_ice_lance',0.01], ['bk_summon',0.02], ['bk_blizzard',0.005], ['bk_ice_spike',0.5], ['bk_elf_release',0.1], ['bk_elf_lifespring',0.1], ['bk_elf_triple',0.05], ['bot_dark',0.3], ['acc_summon_ctrl',0.001], ['bk_dark_double',0.1], ['bk_dark_fang',0.1], ['new_item_219',1]],   // ⚔️ 戰士試煉：神秘魔杖 1%
        '思克巴女皇': [['acc_116',0.001], ['scroll_acc',0.01], ['bk_ice_lance',0.01], ['bk_summon',0.003], ['bk_ice_spike',0.5], ['bk_elf_lifespring',0.1], ['bk_mana_drain',0.1], ['bk_blizzard_storm',0.01], ['new_item_219',1]],   // ⚔️ 戰士試煉：神秘魔杖 1%
        '怪手': [['glv_glove',0.1], ['arm_99',0.001], ['new_item_150',1]],
        '惡魔': [['arm_69', 10], ['wpn_katana',5], ['wpn_2hsword',10], ['wpn_siruge',1], ['wpn_33',1], ['wpn_flaming_angel',0.5], ['amr_plate',5], ['arm_88',0.1], ['arm_63',10], ['arm_99',1], ['acc_117',0.01], ['amu_str',0.1], ['amu_int',0.15], ['acc_128',1], ['acc_129',1], ['acc_130',0.5], ['acc_131',0.5], ['scroll_weapon',10], ['scroll_armor',20], ['scroll_acc',1], ['new_item_152',0.5], ['new_item_153',0.1], ['new_item_159',0.1], ['bk_holy_barrier',0.5], ['bk_fire_storm',0.1], ['bk_elf_blazewpn',0.5], ['wpn_demon_scythe',0.1], ['arm_59',10], ['hlm_demon',1], ['amr_demon',1], ['glv_demon',1], ['bot_demon',1], ['wpn_dual_abyss',0.1], ['bk_elf_flamesoul',0.1], ['wpn_vengeance',0.1], ['wpn_hate_claw',0.01]],
        '杜賓狗': [['new_item_143',10], ['new_item_179',100]],
        '格利芬': [['arm_62',0.5], ['new_item_150',1], ['new_item_152',0.5], ['new_item_155',0.5], ['new_item_158',0.5], ['new_item_161',0.5], ['bk_tornado',0.001], ['bk_elf_release',0.1], ['bk_elf_winddash',0.05], ['bk_elf_stormeye',0.001], ['bk_magic_shield',0.01], ['mat_griffon_feather',1], ['acc_demonbane',0.01]],
        '楊果里恩': [['scroll_weapon',0.1], ['scroll_armor',0.3], ['scroll_acc',0.01], ['bk_slow',0.1], ['bk_charm',0.05], ['bk_rock_prison',0.5]],
        '歐吉': [['wpn_battleaxe',5], ['wpn_giantaxe',1], ['wpn_berserker',0.01], ['arm_61',0.5], ['arm_47',0.03], ['acc_133',0.001], ['scroll_weapon',0.3], ['scroll_armor',1], ['new_item_167',0.01]],
        '歐熊': [['new_item_182',3], ['scroll_acc',0.001]],
		'熊': [['new_item_179',0.001], ['acc_bear_ring',0.001]],
        '死亡騎士': [['acc_118',1],['wpn_katana',5], ['wpn_2hsword',10], ['wpn_33',1], ['amr_plate',5], ['arm_88',0.1], ['glv_glove',10], ['glv_dk',1], ['amr_dk',1], ['bot_dk',1], ['hlm_dk',1], ['acc_117',1], ['amu_str',0.1], ['acc_128',0.5], ['acc_129',0.5], ['acc_130',0.1], ['acc_131',0.1], ['scroll_weapon',10], ['scroll_armor',20], ['scroll_acc',1], ['new_item_150',1], ['new_item_151',5], ['new_item_152',0.5], ['new_item_153',0.1], ['bk_zombie',3], ['bk_tornado',0.5], ['bk_resurrection',0.1], ['bk_disease',3], ['bk_solid_shield',1], ['bk_blaze',1], ['wpn_dk_flameblade',0.1], ['bk_counter_barrier',0.1], ['bk_elf_mirror',1]],
        '死神': [['item_olin_diary',0.01],['wpn_16',1], ['wpn_giantaxe',0.1], ['wpn_flaming_angel',0.001], ['arm_61',0.5], ['scroll_weapon',1], ['scroll_armor',2], ['scroll_acc',0.01], ['bk_elf_stormshot',0.01], ['bk_disease',0.1], ['glv_reaper',0.01], ['mat_moonlight_breath', 0.01]],
        '毒蠍': [['arm_46',0.01], ['bk_thunder',0.01], ['bk_cancel',0.01], ['bk_rock_prison',0.5], ['bk_quake',0.001]],
        '夢幻之島水精靈王': [['arm_69', 1], ['arm_63',5], ['scroll_weapon',5], ['scroll_armor',10], ['scroll_revive',1], ['panacea_int',1], ['mat_water_breath',1]],
        '污染的潘': [['new_item_163',100]],
		'污染的安特': [['new_item_141',1], ['new_item_237',100], ['item_ant_fruit',1], ['item_ant_branch',1], ['item_ant_bark',1]],
        '法利昂': [['wpn_katana',10], ['wpn_siruge',5], ['amr_plate',10], ['arm_88',1], ['glv_glove',20], ['arm_80',0.1], ['acc_116',0.1], ['acc_117',0.1], ['acc_120',1], ['acc_127',5], ['acc_128',5], ['acc_129',5], ['blt_body',1], ['acc_130',1], ['acc_131',1], ['scroll_weapon',100], ['scroll_armor',100], ['scroll_acc',50], ['new_item_150',1], ['new_item_151',50], ['new_item_152',5], ['new_item_153',1], ['new_item_160',50], ['new_item_161',5], ['new_item_162',1], ['bk_slow',10], ['bk_holy_light',10], ['bk_regen',5], ['bk_summon',2], ['bk_blizzard',1], ['bk_resurrection',1], ['new_item_190',100], ['bk_elf_eleres',1], ['bk_counter_barrier',1]],
        '活鎧甲': [['item_olin_diary',0.01],['wpn_battleaxe',1], ['arm_60',1], ['arm_62',1], ['bk_holy_barrier',0.003], ['bk_weaken',0.1], ['mat_black_blood', 1], ['mat_moonlight_breath', 0.01]],
        '海星': [['bk_ice_spike',0.1], ['scroll_acc',0.01]],
        '漂浮之眼': [['new_item_143',20], ['new_item_150',1]],
        '火炎蛋': [['scroll_weapon',1], ['scroll_armor',2], ['bk_fireball',0.1], ['bk_holy_light',0.1], ['scroll_poly',1], ['new_item_192',0.01], ['bk_fire_prison',0.01], ['bk_elf_attrfire',0.01]],
        '火焰弓箭手': [['hlm_mr', 1], ['wpn_32',0.1], ['arm_42',2], ['arm_67',4], ['arm_90',1], ['bk_dex_up',0.05], ['bk_slow',0.1], ['new_item_192',0.01]],
        '火焰戰士': [['hlm_mr', 1], ['wpn_longsword',1], ['arm_42',2], ['arm_62',1], ['arm_105',3], ['new_item_192',0.01]],
        '夢幻之島火精靈王': [['arm_69', 1], ['arm_63',5], ['scroll_weapon',5], ['scroll_armor',10], ['scroll_revive',1], ['panacea_str',1], ['mat_fire_breath',1]],
        '火蜥蜴': [['new_item_155',0.5], ['new_item_158',0.5], ['new_item_192',0.01], ['bk_fire_storm',0.001], ['bk_elf_magicerase',0.01], ['bk_elf_stormeye',0.01], ['bk_shock_stun',0.01], ['bk_elf_attrfire',0.01]],
        '烈炎獸': [['scroll_weapon',1], ['scroll_armor',2], ['bk_holy_barrier',0.002], ['scroll_acc',0.01], ['new_item_192',0.01], ['bk_elf_magicerase',0.1], ['bk_shock_stun',0.05], ['bk_elf_attrfire',0.05]],
        '熔岩高崙': [['wpn_2hsword',0.5], ['wpn_18',1], ['wpn_giantaxe',0.5], ['bk_slow',0.5], ['bk_str_up',0.05], ['scroll_acc',0.01], ['new_item_192',0.01], ['bk_elf_triple',0.01], ['item_time_orb',1]],
        '爆彈花': [['bk_sleep_mist',0.01], ['scroll_acc',0.01]],
        '牧羊犬': [['new_item_143',10], ['new_item_179',100]],
		'哈士奇': [['new_item_143',10], ['new_item_179',100]],
        '狼': [['wpn_5',1], ['new_item_195',1], ['new_item_179',100]],
        '狼人': [['arm_69', 0.1], ['wpn_longsword',0.1], ['wpn_2',1], ['wpn_10',3], ['wpn_13',2], ['arm_66',0.5], ['arm_103',1], ['bot_short',0.5], ['bk_dex_up',0.01], ['bk_vampire',0.05]],
        '獨眼巨人': [['arm_62',1], ['arm_47',0.01], ['scroll_weapon',1], ['scroll_armor',2], ['scroll_acc',0.01], ['bk_str_up',0.05], ['bk_summon',0.002], ['bk_rock_prison',0.5], ['bk_quake',0.003], ['bk_elf_groundtrap',0.1], ['bk_elf_earthbless',0.01], ['bk_weaken',0.1], ['bk_seal',0.05], ['acc_demonbane',0.01], ['item_cyclops_blood',1]],   // ⚔️ 戰士試煉：獨眼巨人的血 1%
        '獨角獸': [['wpn_18',3], ['scroll_weapon',5], ['scroll_armor',10], ['scroll_poly',1], ['panacea_cha',1], ['mat_unicorn_horn',0.1]],
        '甘地妖魔': [['new_item_148',1], ['new_item_150',1], ['new_item_201',1], ['item_orc_amulet',0.01]],
        '卡瑞': [['wpn_dragonslayer',100]],
        '巴列斯': [['wpn_katana',2], ['wpn_2hsword',5], ['wpn_powerless_baless',1], ['amr_plate',10], ['glv_glove',10], ['bot_baless',1], ['acc_122',1], ['acc_116',0.1], ['rng_mr',1], ['acc_127',0.5], ['acc_128',0.5], ['acc_129',0.5], ['blt_body',0.1], ['acc_130',0.1], ['acc_131',0.1], ['new_item_151',50], ['new_item_157',50], ['new_item_152',5], ['new_item_158',5], ['new_item_153',1], ['new_item_159',1], ['scroll_weapon',10], ['scroll_armor',20], ['bk_magic_shield',3], ['bk_heal2',3], ['bk_zombie',2], ['bk_blaze',1], ['bk_disease',1], ['bk_full_heal',1], ['bk_fire_storm',0.5], ['bk_elf_winddash',3], ['bk_elf_stormeye',2], ['bk_elf_stormshot',1]],
        '石頭高崙': [['wpn_alien',3], ['wpn_1',5], ['wpn_10',5], ['wpn_13',1], ['new_item_150',1], ['new_item_159',0.05], ['new_item_164',1], ['bk_rock_prison',0.5], ['acc_demonbane',0.0001], ['new_item_207',1]],   // ⚔️ 戰士試煉：生命的卷軸 1%（warrior 限定·非戰士不掉）
        '穴居人': [['wpn_battleaxe',1], ['wpn_giantaxe',0.1], ['arm_61',0.5], ['scroll_acc',0.001], ['bk_blizzard_storm',0.001]],
        '紅鬼魂': [['item_lost_soul',1],['amr_robe',3], ['glv_crystal',0.01], ['bk_elf_seal',0.05], ['bk_dark_shadow',0.1], ['item_soul_orb',0.01], ['mat_moonlight_breath', 0.01]],
        '紙人': [['item_olin_diary',0.01],['scroll_poly',1], ['scroll_acc',0.01]],
        '羅孚妖魔': [['arm_69', 0.2], ['arm_63',3], ['new_item_149',1], ['new_item_157',5], ['item_orc_amulet',0.01]],
        '艾爾摩士兵': [['wpn_4',1], ['wpn_halberd',0.5], ['wpn_14',1], ['arm_66',3], ['arm_68',2], ['bot_short',2], ['glv_glove',0.5], ['scroll_armor',2], ['scroll_acc',0.01]],
        '艾爾摩將軍': [['wpn_greatsword',0.1], ['wpn_2hsword',0.5], ['arm_60',1], ['arm_65',1], ['arm_90',1], ['glv_glove',0.5], ['scroll_weapon',1], ['scroll_armor',2], ['scroll_acc',0.01], ['bk_shock_stun',0.05], ['bk_reduction_armor',0.01], ['bk_spike_armor',0.001], ['item_elmore_heart',1]],
        '艾爾摩法師': [['wpn_witchwand',1], ['scroll_weapon',1], ['bk_full_heal',0.01], ['bk_ice_spike',0.5], ['bk_bless_wpn',0.005], ['wpn_qigu_meditate',0.0001]],
        '莫妮亞': [['arm_87',1], ['scroll_weapon',1], ['scroll_armor',1.5], ['bk_slow',0.5], ['bk_heal2',0.5], ['bk_holy_light',0.1], ['scroll_poly',1]],
        '萊肯': [['wpn_battleaxe',3], ['wpn_halberd',0.5], ['arm_65',1], ['arm_66',1], ['arm_105',2], ['arm_90',1], ['new_item_151',5], ['bk_dex_up',0.05], ['bk_vampire',0.1], ['bk_slow',0.1], ['new_item_195',1]],
        '蘑菇': [['new_item_166',100]],
        '蛇女': [['scroll_weapon',0.2], ['scroll_acc',0.01], ['bk_break',0.5], ['new_item_221',1], ['new_item_208',1], ['bk_elf_watervital',0.05]],
        '蜥蜴人': [['hlm_mr', 0.5], ['wpn_37',0.5], ['arm_105',1], ['arm_42',3], ['new_item_160',5], ['scroll_acc',0.001]],
        '蟑螂人': [['hlm_mr', 0.3], ['arm_42',3], ['new_item_158',0.1]],
        '蟹人': [['scroll_armor',0.3], ['bk_break',0.1], ['bk_str_up',0.01]],
        '西瑪': [['item_olin_diary',1],['arm_87',5], ['arm_90',10], ['arm_57',1], ['amu_str',0.1], ['scroll_weapon',10], ['scroll_armor',20], ['scroll_acc',1], ['new_item_150',1], ['new_item_151',5], ['new_item_152',0.5], ['new_item_153',0.1], ['bk_dex_up',2], ['bk_haste_spell',1], ['bk_greater_haste',1], ['bk_elf_stormeye',1], ['bk_weaken',1], ['acc_119',0.1], ['acc_125',0.1], ['acc_orin_amulet',0.1], ['acc_sima_ring',0.1]],
        '變形怪': [['scroll_poly',1], ['scroll_acc',0.01], ['new_item_240',1], ['acc_demonbane',0.01]],
        '變形怪首領': [['wpn_greatsword',1], ['wpn_2hsword',5], ['wpn_38',10], ['wpn_strwand',1], ['arm_60',10], ['clk_mr',10], ['scroll_weapon',10], ['scroll_armor',20], ['scroll_acc',1], ['bk_fireball',3], ['bk_str_up',1], ['bk_haste_spell',1], ['bk_summon',0.5], ['scroll_poly',1], ['bk_elf_magicerase',1], ['bk_shock_stun',1], ['bk_reduction_armor',0.5], ['bk_spike_armor',0.5], ['bk_solid_shield',0.5], ['new_item_240',10], ['bk_elf_stormshot',0.5], ['bk_elf_physboost',1.5]],
        '那魯加妖魔': [['wpn_2hsword',0.1], ['wpn_invader',0.5], ['wpn_damascus',0.2], ['arm_64',5], ['arm_104',3], ['acc_123',0.01], ['new_item_146',1], ['new_item_157',5], ['new_item_200',1], ['item_orc_amulet',0.01]],
        '邪惡蜥蜴': [['scroll_weapon',1], ['scroll_armor',2], ['scroll_acc',0.01], ['new_item_151',5], ['new_item_152',0.5], ['new_item_153',0.1], ['bk_slow',0.5], ['bk_heal2',0.2], ['bk_holy_light',0.1], ['bk_cancel',0.02], ['bk_earthquake',0.02], ['bk_rock_prison',0.5], ['bk_quake',0.005], ['bk_elf_release',0.05], ['new_item_232',0.01], ['item_lizard_horn',0.01], ['glv_demon',0.01], ['acc_demonbane',0.01], ['bk_elf_watervital',0.1]],
        '都達瑪拉妖魔': [['hlm_mr', 0.5], ['arm_104',3], ['arm_42',5], ['acc_123',0.01], ['new_item_147',1], ['new_item_150',1], ['new_item_158',0.5], ['new_item_199',1], ['scroll_acc',0.001], ['item_orc_amulet',0.01]],
        '鋼鐵高崙': [['mat_golem_heart',0.1],['scroll_weapon',1], ['scroll_armor',2], ['bk_str_up',0.05], ['new_item_164',1], ['new_item_180',100], ['bk_elf_soul',0.001], ['bk_elf_steelguard',0.001], ['bk_weaken',0.1], ['item_ancientkey',1]],
        '夢幻之島鎧甲守衛': [['arm_60',1], ['scroll_weapon',1], ['scroll_armor',2], ['bk_spike_armor',0.05]],
        '長老': [['item_olin_diary',0.001],['arm_87',0.5], ['new_item_150',1], ['bk_thunder',0.1], ['bk_heal2',0.5], ['scroll_acc',0.01], ['acc_119',0.001], ['acc_125',0.001]],
        '夢幻之島閃電球': [['arm_45',0.1], ['scroll_weapon',1], ['scroll_armor',2], ['bk_thunder_storm',0.05]],
        '阿吐巴妖魔': [['hlm_mr', 0.5], ['wpn_damascus',0.1], ['arm_60',0.5], ['arm_64',3], ['arm_104',3], ['arm_42',5], ['acc_123',0.01], ['new_item_145',1], ['new_item_157',5], ['new_item_202',1], ['item_orc_amulet',0.01]],
        '阿西塔基奧': [['scroll_weapon',1], ['scroll_armor',2], ['scroll_acc',0.01], ['bk_fireball',0.5], ['bk_dex_up',0.1], ['bk_str_up',0.05], ['bk_haste_spell',0.1], ['bk_earthquake',0.1], ['new_item_192',0.01], ['new_item_194',1], ['bk_elf_attrfire',0.05]],
        '阿魯巴': [['wpn_18',2], ['bk_str_up',0.05], ['bk_haste_spell',0.5], ['bk_earthquake',0.1], ['bk_rock_prison',0.5], ['bk_greater_haste',0.1], ['bk_quake',0.005], ['acc_demonbane',0.01]],
        '雪人': [['bk_elf_release',0.1], ['scroll_acc',0.01]],
        '雪怪': [['wpn_18',1], ['scroll_acc',0.01], ['new_item_195',1], ['item_yeti_head',1], ['bk_elf_watervital',0.1]],
        '夢幻之島風精靈王': [['arm_69', 1], ['arm_63',5], ['scroll_weapon',5], ['scroll_armor',10], ['scroll_revive',1], ['panacea_dex',1], ['mat_wind_breath',1]],
        '飛龍': [['mat_dragon_heart',1],['item_dragon_claw',1], ['scroll_weapon',10], ['scroll_armor',20], ['scroll_acc',1], ['new_item_150',1], ['new_item_151',5], ['new_item_152',0.5], ['new_item_153',0.1], ['new_item_154',5],['new_item_155',0.5], ['new_item_156',0.1], ['new_item_157',5], ['new_item_158',0.5], ['new_item_159',0.1], ['new_item_160',5], ['new_item_161',0.5], ['new_item_162',0.1], ['bk_holy_dash',1], ['bk_quake',1], ['bk_elf_magicerase',1], ['bk_elf_stormeye',1], ['bk_elf_triple',1], ['glv_demon',0.1], ['acc_demonbane',0.2], ['wpn_ori_dagger',1], ['bk_elf_preciseshot',0.3]],
        '食人妖精': [['wpn_battleaxe',3], ['wpn_giantaxe',1], ['arm_61',0.6], ['scroll_weapon',0.2], ['scroll_armor',0.5], ['bk_fireball',0.1], ['bk_break',0.5], ['bk_elf_release',0.05], ['bk_blaze',0.01], ['acc_demonbane',0.001]],
        '食人妖精王': [['wpn_battleaxe',3], ['wpn_10',2], ['wpn_giantaxe',0.5], ['wpn_berserker',0.02], ['arm_61',0.5], ['arm_47',0.05], ['scroll_weapon',1], ['scroll_armor',1.5], ['new_item_158',0.5], ['bk_fireball',0.5], ['bk_break',0.5], ['bk_holy_light',0.1], ['bk_disease',0.1], ['bk_shock_stun',0.01]],
        '食屍鬼': [['scroll_weapon',0.1], ['bk_berserk',0.01], ['new_item_204',1], ['new_item_205',1]],
        '馬庫爾': [['item_olin_diary',1],['arm_87',5], ['arm_90',10], ['arm_56',1], ['acc_116',0.01], ['amu_str',0.1], ['scroll_weapon',10], ['scroll_armor',20], ['scroll_acc',1], ['new_item_150',1], ['new_item_160',5], ['new_item_161',0.5], ['new_item_162',0.1], ['bk_elf_soul',1], ['bk_elf_lifespring',1], ['acc_119',0.1], ['acc_125',0.1]],
        '骷髏': [['hlm_mr', 0.1], ['wpn_scimitar',1], ['arm_42',5], ['clk_mr',0.1], ['arm_105',0.5], ['new_item_150',1], ['bk_dex_up',0.01], ['new_item_183',50], ['new_item_203',1], ['new_item_214',1]],
        '骷髏弓箭手': [['hlm_mr', 0.1], ['wpn_3',1], ['arm_42',3], ['clk_mr',0.1], ['new_item_150',1], ['bk_dex_up',0.01], ['new_item_183',50]],
        '骷髏斧手': [['hlm_mr', 0.1], ['wpn_1',5], ['arm_42',3], ['clk_mr',0.3], ['new_item_150',1], ['new_item_183',50]],
        '骷髏槍兵': [['hlm_mr', 0.1], ['wpn_4',3], ['arm_42',3], ['clk_mr',0.3], ['new_item_150',1], ['bk_dex_up',0.01], ['new_item_183',50]],
        '骷髏神射手': [['wpn_3',3], ['arm_42',3], ['clk_mr',1], ['arm_105',2], ['acc_120',0.001], ['new_item_150',1], ['bk_dex_up',0.05], ['bk_charm',0.1], ['new_item_212',1]],
        '骷髏警衛': [['wpn_14',2], ['arm_42',3], ['clk_mr',1], ['arm_105',2], ['new_item_150',1], ['bk_dex_up',0.05], ['bk_charm',0.1], ['new_item_212',0.1]],
        '骷髏鬥士': [['wpn_battleaxe',3], ['arm_42',3], ['clk_mr',1], ['arm_105',2], ['new_item_150',1], ['bk_dex_up',0.05], ['bk_haste_spell',0.1], ['bk_solid_shield',0.01]],
        '鬼魂': [['item_lost_soul',1],['amr_robe',5], ['glv_crystal',0.01], ['bk_elf_seal',0.01], ['bk_magic_shield',0.01], ['bk_weaken',0.5], ['item_soul_orb',0.01], ['mat_moonlight_breath', 0.01]],
        '鯊魚': [['acc_129',0.01], ['new_item_160',5], ['new_item_161',0.1], ['new_item_162',0.1]],
        '鱷魚': [['arm_45',0.01], ['new_item_154',5], ['bk_thunder',0.005]],
        '黑暗精靈': [['item_wind_tear',1], ['amr_darkelf',0.1], ['bot_darkelf',0.1], ['wpn_elfbow',0.5], ['clk_elf',0.5], ['arm_71',0.3], ['bk_tornado',0.001], ['bk_invisible',0.001], ['new_item_195',1], ['bk_elf_release',0.1], ['bk_meditation',0.1], ['item_blueflute',1], ['mat_black_blood', 1]],
        '黑長者': [['item_olin_diary',1],['acc_126',1],['clk_mr',10], ['glv_glove',5], ['arm_84',1], ['arm_96',1], ['acc_130',0.1], ['scroll_weapon',10], ['scroll_armor',20], ['scroll_acc',1], ['new_item_150',1], ['bk_thunder',3], ['bk_charm',1], ['bk_str_up',1], ['bk_ice_spike',5], ['new_item_195',1], ['bk_elf_soul',1], ['bk_elf_lifespring',1], ['acc_119',1], ['acc_125',1], ['bk_elf_watervital',3]],
        '黑騎士': [['hlm_mr', 0.5], ['wpn_2hsword',0.1], ['wpn_16',1], ['wpn_17',1], ['wpn_21',2], ['wpn_28',3], ['arm_42',5], ['arm_60',1], ['tsh_tshirt',0.1], ['arm_87',1], ['bot_short',2], ['arm_90',1], ['new_item_151',5], ['new_item_154',5], ['new_item_157',5], ['new_item_160',5], ['new_item_196',1], ['new_item_198',1], ['acc_doro',0.01]],
        '黑騎士搜索隊': [['hlm_mr', 0.5], ['wpn_2hsword',0.1], ['wpn_16',1], ['wpn_17',1], ['wpn_21',2], ['wpn_28',3], ['arm_42',5], ['arm_60',1], ['tsh_tshirt',0.1], ['arm_87',1], ['bot_short',2], ['arm_90',1], ['new_item_151',5], ['new_item_154',5], ['new_item_157',5], ['new_item_160',5], ['acc_doro',0.01]],
        '鼠人': [['arm_61',0.5], ['bk_dex_up',0.05], ['bk_haste_spell',0.1]],
        '龍蠅': [['scroll_weapon',1], ['scroll_armor',2], ['bk_vampire',0.5], ['new_item_192',0.01]],
        '龍龜': [['bk_cancel',0.01], ['scroll_acc',0.01], ['bk_ice_spike',0.5], ['new_item_206',1], ['bk_elf_watervital',0.1]],
        // ===== 🗼 傲慢之塔 =====
        '變種蛇女': [['scroll_acc',0.0001],['scroll_weapon',1], ['item_pride_scroll_11',2]],
        '變種楊果里恩': [['scroll_weapon',0.5], ['scroll_armor',1], ['item_pride_scroll_11',2]],
        '梅杜莎': [['arm_61',3], ['arm_pride_medusa_shield',0.5], ['arm_106',0.1], ['amu_cha',0.01], ['scroll_weapon',0.5], ['scroll_armor',1], ['item_pride_scroll_11',2], ['bk_cancel',0.3], ['bk_weaken',0.3], ['bk_holy_barrier',0.05], ['bk_resurrection',0.1], ['bk_dark_double',0.1], ['new_item_190',0.001]],
        '奇美拉': [['mat_chimera_snake',10], ['mat_chimera_dragon',10], ['mat_chimera_goat',10], ['mat_chimera_lion',10], ['item_pride_scroll_11',2], ['new_item_191',0.001]],
        '扭曲的潔尼斯女王': [['acc_138',1],['wpn_crystal_dagger',0.5], ['wpn_katana',30], ['wpn_2hsword',30], ['wpn_siruge',1], ['arm_88',0.1], ['arm_69',30], ['arm_59',3], ['amr_plate',30], ['arm_99',0.1], ['acc_jenis_ring',0.01], ['acc_128',5], ['acc_130',1], ['scroll_weapon',30], ['scroll_armor',30], ['bk_dark_shadow',5], ['bk_weaken',5], ['bk_slow',5], ['bk_dark_fang',5], ['item_pride_scroll_11',30], ['item_pride_sealed_11',1]],
        // ===== 🗼 傲慢之塔 11~20 樓 =====
        '魔狼': [['item_pride_scroll_21',2], ['new_item_192',0.001]],
        '邪惡密密': [['hlm_mr',0.3], ['scroll_armor',1], ['item_pride_scroll_21',2], ['bk_dex_up',0.5], ['bk_str_up',0.2], ['bk_dark_fang',0.1], ['new_item_190',0.001]],
        '邪惡多眼怪': [['scroll_acc',0.0001],['hlm_dark',0.3], ['scroll_weapon',0.5], ['item_pride_scroll_21',2], ['bk_mummy_curse',0.8], ['bk_cancel',0.3], ['bk_weaken',0.3], ['bk_disease',0.05], ['bk_dark_fang',0.1], ['bk_dark_erup',1], ['new_item_193',0.001]],
        '死亡之劍': [['wpn_scimitar',5], ['arm_67',1], ['scroll_weapon',0.5], ['item_pride_scroll_21',2], ['bk_elf_windshot',0.5], ['bk_elf_stormeye',0.5], ['bk_dark_double',0.1]],
        '不幸的幻象眼魔': [['wpn_crystal_dagger',0.5], ['wpn_katana',30], ['wpn_2hsword',30], ['wpn_siruge',1], ['arm_88',0.1], ['arm_69',30], ['arm_59',3], ['amr_plate',30], ['arm_99',0.1], ['amu_int',0.1], ['acc_128',5], ['acc_130',1], ['shd_phantom_eye',0.01], ['scroll_weapon',30], ['scroll_armor',30], ['bk_vampire',5], ['bk_mana_drain',5], ['bk_dark_shadow',5], ['bk_weaken',5], ['bk_disease',5], ['bk_dark_crit',5], ['item_pride_scroll_21',30], ['item_pride_sealed_21',1]],
        // ===== 🗼 傲慢之塔 21~30 樓 =====
        '恐怖的火炎蛋': [['item_pride_scroll_31',2], ['bk_haste_spell',0.2], ['bk_blaze',0.3], ['scroll_weapon',0.3], ['scroll_armor',0.6], ['bk_fire_prison',0.02]],
        '恐怖夢魘': [['clk_dark',0.5], ['item_pride_scroll_31',2], ['bk_vampire',0.3], ['bk_dark_shadow',0.3], ['bk_weaken',0.3], ['bk_disease',0.3], ['bk_elf_triple',0.05], ['new_item_193',0.001]],
        '恐怖的地獄犬': [['wpn_witchwand',3], ['new_item_158',0.5], ['item_pride_scroll_31',2], ['bk_holy_barrier',0.1], ['bk_dark_crit',0.5], ['new_item_192',0.001], ['bk_fire_prison',0.02], ['bk_elf_energyboost',0.5]],
        '小惡魔': [['scroll_acc',0.001],['amr_demon',0.01], ['amu_str',0.01], ['amu_int',0.01], ['rng_fire',0.01], ['scroll_armor',2], ['scroll_weapon',0.5], ['item_pride_scroll_31',2], ['bk_elf_magicerase',0.01], ['bk_dark_crit',0.5], ['new_item_192',0.001], ['bk_fire_prison',0.01], ['mat_black_blood', 1]],
        '恐怖的伊弗利特': [['item_pride_scroll_31',2], ['bk_fireball',1], ['bk_dex_up',1], ['bk_str_up',1], ['bk_cancel',1], ['bk_blaze',1], ['bk_fire_storm',0.05], ['bk_elf_seal',0.05], ['bk_elf_firewpn',1], ['bk_elf_dancefire',1], ['bk_elf_blazewpn',0.2], ['bk_dark_double',0.1]],
        '恐怖的吸血鬼': [['wpn_crystal_dagger',0.5], ['wpn_katana',30], ['wpn_siruge',1], ['wpn_strwand',2], ['arm_87',30], ['clk_silver_light',1], ['arm_88',0.1], ['arm_69',30], ['arm_59',3], ['amu_int',0.3], ['acc_117',0.1], ['acc_summon_ctrl',0.1], ['rng_water',0.1], ['rng_earth',0.5], ['rng_wind',0.1], ['rng_fire',0.1], ['acc_128',5], ['acc_130',1], ['clk_marcus',0.01], ['new_item_151',30], ['new_item_160',30], ['new_item_152',30], ['new_item_161',30], ['new_item_153',1], ['new_item_162',10], ['scroll_weapon',30], ['scroll_armor',30], ['bk_vampire',5], ['bk_magic_shield',5], ['bk_mana_drain',5], ['bk_dark_shadow',5], ['bk_zombie',5], ['bk_weaken',5], ['bk_summon',1], ['bk_disease',5], ['bk_resurrection',5], ['bk_dark_crit',5], ['item_pride_scroll_31',30], ['item_pride_sealed_31',1]],
        // ===== 🗼 傲慢之塔 31~40 樓 =====
        '殘暴的骷髏斧兵': [['wpn_berserker',1], ['scroll_weapon',1], ['scroll_armor',2], ['item_pride_scroll_41',2], ['bk_str_up',0.3]],
        '殘暴的食屍鬼': [['scroll_armor',2], ['item_pride_scroll_41',2], ['bk_berserk',0.3], ['bk_dark_fang',0.1], ['new_item_191',0.001]],
        '殘暴的骷髏槍兵': [['scroll_armor',2], ['item_pride_scroll_41',2], ['bk_dex_up',0.5], ['bk_blaze',0.5], ['new_item_193',0.001]],
        '殘暴的史巴托': [['scroll_acc',0.001],['hlm_mr',0.3], ['scroll_armor',3], ['item_pride_scroll_41',2], ['bk_dark_erup',1]],
        '殘暴的骷髏神射手': [['scroll_weapon',2], ['item_pride_scroll_41',2], ['bk_dex_up',1], ['bk_charm',0.8], ['bk_blaze',0.5], ['bk_elf_windshot',1], ['bk_dark_fang',0.1]],
        '死亡的殭屍王': [['blt_mr',1],['wpn_2hsword',30], ['wpn_siruge',5], ['wpn_dual_abyss',0.05], ['arm_69',30], ['arm_59',3], ['amr_plate',30], ['acc_summon_ctrl',0.1], ['rng_water',0.2], ['rng_earth',0.5], ['rng_wind',0.2], ['rng_fire',0.1], ['acc_128',1], ['acc_130',1], ['scroll_weapon',30], ['scroll_armor',30], ['bk_dark_shadow',5], ['bk_zombie',5], ['bk_weaken',5], ['bk_disease',5], ['bk_resurrection',5], ['bk_seal',5], ['bk_dark_fang',5], ['item_pride_scroll_41',30], ['item_pride_sealed_41',1]],
        '殘暴的骷髏鬥士': [['amr_bone',2], ['scroll_weapon',2], ['item_pride_scroll_41',2], ['bk_dex_up',1], ['bk_haste_spell',0.5], ['bk_dark_double',0.1], ['bk_dark_erup',1]],
        // ===== 🗼 傲慢之塔 41~50 樓 =====
        '幼龍': [['new_item_151',5], ['new_item_157',5], ['new_item_160',5], ['new_item_154',5], ['new_item_152',0.5], ['new_item_158',0.5], ['new_item_161',0.3], ['new_item_155',0.5], ['new_item_153',0.3], ['new_item_159',0.5], ['new_item_162',0.5], ['new_item_156',0.5], ['scroll_armor',1], ['item_pride_scroll_51',2.5], ['bk_fire_prison',0.05], ['wpn_qigu_resonance',0.01]],
        '火焰之靈魂(紅)': [['scroll_armor',0.5], ['item_pride_scroll_51',2]],
        '火焰之靈魂(藍)': [['item_pride_scroll_51',2]],
        '恐怖的鋼鐵高崙': [['mat_golem_heart',1],['scroll_acc',0.001],['arm_99',0.005], ['rng_earth',0.01], ['item_pride_scroll_51',2], ['bk_dark_fang',0.1], ['new_item_180',100], ['new_item_164',20], ['bk_elf_physboost',0.5]],
        '火焰之魔法師': [['amu_str',0.01], ['acc_119',0.01], ['acc_125',0.01], ['acc_117',0.01], ['acc_summon_ctrl',0.01], ['scroll_weapon',0.4], ['scroll_armor',1], ['item_pride_scroll_51',2], ['bk_dark_crit',0.5]],
        '骨龍': [['scroll_acc',0.001],['acc_summon_ctrl',0.01], ['new_item_151',5], ['new_item_157',5], ['new_item_160',5], ['new_item_154',5], ['new_item_152',0.8], ['new_item_158',1], ['new_item_161',0.5], ['new_item_155',0.5], ['new_item_153',0.5], ['new_item_159',0.6], ['new_item_162',0.8], ['new_item_156',0.8], ['item_pride_scroll_51',2.5], ['bk_resurrection',0.25], ['bk_dark_crit',0.5], ['scroll_weapon',0.5], ['scroll_armor',1]],
        '地獄的黑豹': [['acc_124',1],['wpn_claw_abyss',0.05], ['amu_str',3], ['acc_128',5], ['blt_body',1], ['scroll_weapon',30], ['scroll_armor',30], ['item_pride_scroll_51',30], ['item_pride_sealed_51',1], ['wpn_dual_destroy',0.5], ['wpn_claw_destroy',0.5]],
        // ===== 🗼 傲慢之塔 51~60 樓 =====
        '受詛咒的妖魔殭屍': [['bk_berserk',0.2], ['item_pride_scroll_61',2]],
        '受詛咒的艾爾摩士兵': [['acc_demonbane',0.03], ['bk_berserk',0.3], ['item_pride_scroll_61',2]],
        '受詛咒的艾爾摩法師': [['scroll_acc',0.001],['acc_demonbane',0.03], ['item_pride_scroll_61',2], ['wpn_qigu_meditate',0.01]],
        '受詛咒的艾爾摩將軍': [['acc_demonbane',0.03], ['bk_shock_stun',0.02], ['bk_reduction_armor',0.1], ['bk_spike_armor',0.01], ['item_pride_scroll_61',2]],
        '不死的木乃伊王': [['hlm_mummy_crown',0.1], ['rng_water',0.2], ['rng_earth',1], ['rng_wind',0.3], ['rng_fire',0.1], ['scroll_weapon',30], ['scroll_armor',30], ['bk_sleep_mist',0.2], ['bk_elf_groundtrap',5], ['bk_elf_earthshield',3], ['bk_elf_steelguard',1], ['item_pride_scroll_61',30], ['item_pride_sealed_61',1]],
        // ===== 🗼 傲慢之塔 61~70 樓 =====
        '暗黑萊肯': [['new_item_159',0.5], ['item_pride_scroll_71',2]],
        '冷酷冰原老虎': [['scroll_acc',0.001],['scroll_weapon',1], ['scroll_armor',1], ['item_pride_scroll_71',2]],
        '火焰烈炎獸': [['amr_plate',1], ['scroll_weapon',1], ['scroll_armor',1], ['bk_blaze',0.5], ['bk_dark_crit',0.5], ['item_pride_scroll_71',2], ['new_item_192',0.001]],
        '火焰阿西塔基奧': [['wpn_2hsword',1], ['amu_cha',0.05], ['scroll_weapon',1], ['scroll_armor',1], ['bk_earthquake',0.5], ['bk_summon',0.1], ['bk_quake',1], ['item_pride_scroll_71',2], ['new_item_192',0.001]],
        '冷酷的艾莉絲': [['arm_99',1], ['amu_iris',0.1], ['amu_str',3], ['acc_128',5], ['acc_130',1], ['new_item_157',30], ['new_item_158',30], ['new_item_159',10], ['scroll_weapon',30], ['scroll_armor',30], ['bk_full_heal',5], ['bk_thunder_storm',1], ['bk_blizzard',1], ['item_pride_scroll_71',30], ['item_pride_sealed_71',1], ['bk_blizzard_storm',1]],
        // ===== 🗼 傲慢之塔 71~80 樓 =====
        '暗黑黑騎士': [['acc_doro',0.1], ['item_pride_scroll_81',2], ['bk_reduction_armor',0.1], ['bk_spike_armor',0.01]],
        '暗黑火焰戰士': [['new_item_139',1], ['scroll_armor',1], ['item_pride_scroll_81',1], ['bk_reduction_armor',0.1], ['bk_spike_armor',0.01]],
        '暗黑火焰弓箭手': [['new_item_139',1], ['scroll_armor',1], ['item_pride_scroll_81',1], ['bk_reduction_armor',0.1], ['bk_elf_triple',0.05]],
        '暗黑思克巴女皇': [['scroll_acc',0.001],['acc_summon_ctrl',0.01], ['acc_127',0.5], ['acc_129',1], ['blt_body',0.05], ['acc_131',0.05], ['new_item_158',1], ['item_pride_scroll_81',1], ['bk_elf_winddash',5], ['bk_elf_stormeye',1], ['bk_elf_stormshot',0.1], ['bk_elf_physboost',0.5]],
        '闇黑的騎士范德': [['acc_138',1],['wpn_siruge',5], ['wpn_vander_sword',0.1], ['arm_99',1.5], ['acc_summon_ctrl',0.1], ['scroll_weapon',30], ['scroll_armor',30], ['bk_shock_stun',1], ['bk_reduction_armor',5], ['bk_holy_barrier',3], ['bk_counter_barrier',0.1], ['item_pride_scroll_81',30], ['item_pride_sealed_81',1]],
        // ===== 🗼 傲慢之塔 81~90 樓 =====
        '傲慢的潔尼斯女王': [['acc_jenis_ring',0.001], ['item_pride_scroll_91',0.5], ['scroll_weapon',1], ['scroll_armor',2]],
        '小幻象眼魔': [['scroll_acc',0.001],['item_pride_scroll_91',0.5], ['bk_abs_barrier',0.01], ['scroll_weapon',1], ['scroll_armor',3]],
        '馬昆斯吸血鬼': [['item_pride_scroll_91',0.5], ['bk_vampire',5], ['bk_soul_up',0.02], ['scroll_weapon',1], ['scroll_armor',2]],
        '恐怖的殭屍王': [['arm_99',0.01], ['item_pride_scroll_91',0.5], ['bk_zombie',1], ['scroll_armor',2]],
        '不滅的巫妖': [['wpn_katana',30], ['wpn_2hsword',30], ['wpn_siruge',5], ['wpn_strwand',5], ['clk_silver_light',1], ['arm_88',0.2], ['clk_lich',0.1], ['arm_69',30], ['arm_59',3], ['arm_60',30], ['amr_plate',30], ['arm_99',1], ['amu_int',1], ['acc_117',0.5], ['acc_summon_ctrl',0.3], ['rng_water',1], ['rng_earth',1], ['rng_wind',1], ['rng_fire',1], ['acc_128',10], ['acc_130',2], ['scroll_weapon',30], ['scroll_armor',30], ['bk_dark_shadow',10], ['bk_weaken',5], ['bk_disease',5], ['bk_resurrection',5], ['bk_seal',5], ['bk_elf_mirror',1], ['item_pride_scroll_91',30], ['item_pride_sealed_91',1]],
        // ===== 🗼 傲慢之塔 91~100 樓 =====
        '土精靈王': [['rng_earth',0.05], ['acc_130',0.5], ['scroll_weapon',1]],
        '水精靈王': [['arm_69',5], ['rng_water',0.01], ['acc_130',0.5], ['scroll_armor',1]],
        '風精靈王': [['arm_69',5], ['rng_wind',0.05], ['acc_130',0.5], ['scroll_armor',1]],
        '火精靈王': [['rng_fire',0.01], ['acc_130',0.5], ['scroll_weapon',1], ['scroll_armor',1]],
        '艾莉絲': [['scroll_acc',0.001],['arm_99',0.01], ['amu_str',0.1], ['scroll_weapon',1]],
        '木乃伊王': [['rng_water',0.1], ['rng_earth',0.5], ['rng_wind',0.3], ['rng_fire',0.05], ['bk_sleep_mist',0.2], ['bk_elf_mirror',1], ['scroll_weapon',1], ['scroll_armor',1]],
        '騎士范德': [['wpn_siruge',0.1], ['arm_99',0.01], ['acc_summon_ctrl',0.01], ['bk_shock_stun',0.1], ['bk_resurrection',1]],
        '邪惡的鐮刀死神': [['scroll_acc',0.1],['wpn_katana',30], ['wpn_siruge',10], ['wpn_dual_abyss',0.1], ['wpn_claw_abyss',0.1], ['wpn_xbow_abyss',0.05], ['clk_silver_light',2], ['arm_88',0.5], ['arm_59',3], ['arm_99',3], ['acc_117',1], ['acc_summon_ctrl',0.5], ['rng_water',5], ['rng_earth',5], ['rng_wind',5], ['rng_fire',5], ['acc_128',10], ['acc_130',2], ['glv_reaper',10], ['scroll_weapon',100], ['scroll_armor',100], ['bk_summon',5], ['bk_resurrection',5], ['bk_disintegrate',1], ['item_pride_sealed_11',1], ['item_pride_sealed_21',1], ['item_pride_sealed_31',1], ['item_pride_sealed_41',1], ['item_pride_sealed_51',1], ['item_pride_sealed_61',1], ['item_pride_sealed_71',1], ['item_pride_sealed_81',1], ['item_pride_sealed_91',1]],
        // ===== 🏝️ 遺忘之島：怪物掉落 =====
        '遺忘之島鱷魚': [['arm_95',0.1]],
        '遺忘之島狼人': [['item_forgotten_scale',1]],
        '遺忘之島夏洛伯': [['item_forgotten_scale',1], ['bk_sleep_mist',0.2]],
        '遺忘之島亞力安': [['item_forgotten_sword',0.1], ['item_forgotten_plate',1], ['glv_dk',0.1], ['acc_demonbane',0.1], ['item_ancient_scroll',0.01]],
        '遺忘之島黑暗精靈': [['hlm_wind',0.1], ['item_forgotten_leather',1], ['rng_mr',0.3], ['hlm_darkelf',0.1], ['mat_black_mithril',0.1]],
        '遺忘之島歐熊': [['item_forgotten_leather',1]],
        '遺忘之島蜥蜴人': [['item_forgotten_robe',1]],
        '遺忘之島卡司特': [['item_forgotten_leather',1], ['new_item_191',0.001]],
        '遺忘之島蛇女': [['item_forgotten_robe',1], ['item_forgotten_scale',1], ['arm_95',0.1], ['new_item_221',3]],
        '遺忘之島萊肯': [['hlm_wind',0.1], ['item_forgotten_leather',1], ['rng_mr',0.3]],
        '遺忘之島巨斧牛人': [['item_forgotten_scale',1], ['rng_mr',0.3], ['item_ancient_scroll',0.005], ['new_item_191',0.001]],
        '遺忘之島食人妖精': [['item_forgotten_robe',1], ['acc_demonbane',0.1]],
        '遺忘之島楊果里恩': [['item_forgotten_leather',1], ['rng_mr',0.3]],
        '遺忘之島格利芬': [['item_forgotten_xbow',0.1], ['hlm_wind',0.1], ['item_forgotten_robe',1], ['acc_demonbane',0.1], ['new_item_193',0.002], ['mat_griffon_feather',2]],
        '遺忘之島鏈鎚牛人': [['item_forgotten_plate',1], ['rng_mr',0.3], ['item_ancient_scroll',0.005], ['new_item_191',0.001]],
        '遺忘之島哈維': [['arm_95',0.1], ['rng_harpy',0.02]],
        '遺忘之島變形怪': [['acc_demonbane',0.1], ['item_ancient_scroll',0.005]],
        '遺忘之島巨大鱷魚': [['item_forgotten_plate',1], ['arm_95',0.1], ['rng_mr',0.3]],
        '遺忘之島卡司特王': [['item_forgotten_leather',1], ['rng_mr',0.3]],
        '遺忘之島多羅': [['item_forgotten_scale',1], ['acc_132',0.3]],
        '遺忘之島阿魯巴': [['item_forgotten_greatsword',0.1], ['item_forgotten_scale',1], ['acc_demonbane',0.1]],
        '遺忘之島食人妖精王': [['item_forgotten_plate',1], ['rng_mr',0.3], ['new_item_192',0.001]],
        '遺忘之島邪惡蜥蜴': [['item_forgotten_sword',0.1], ['item_forgotten_robe',1], ['glv_demon',0.1], ['acc_demonbane',0.1], ['item_ancient_scroll',0.01]],
        '遺忘之島獨眼巨人': [['item_forgotten_greatsword',0.1], ['item_forgotten_plate',1], ['acc_demonbane',0.1]],
        '遺忘之島飛龍': [['item_forgotten_xbow',0.1], ['hlm_wind',0.5], ['item_forgotten_leather',1], ['glv_demon',0.1], ['glv_dk',0.3], ['acc_demonbane',0.2], ['rng_mr',1], ['new_item_192',0.001], ['item_ancient_scroll',0.02], ['item_wyvern_blood',5]],
        '遺忘之島巨大牛人': [['wpn_katana',30], ['wpn_greatsword',1], ['item_unknown_spear',0.1], ['wpn_taurus_axe',0.5], ['amr_plate',30], ['glv_glove',30], ['amu_str',2], ['acc_127',5], ['blt_body',1], ['new_item_157',30], ['new_item_158',30], ['new_item_159',10], ['scroll_weapon',30], ['scroll_armor',30], ['item_ancient_scroll',0.5], ['bk_bless_wpn',5], ['bk_berserk',5], ['bk_full_heal',5], ['bk_elf_blazewpn',5], ['bk_elf_stormshot',1]],
        // ===== 🏛️ 隱藏狩獵區域（象牙塔系列）怪物掉落 =====
        '象牙塔石頭高崙': [['mat_golem_heart',0.1],['wpn_berserker',0.5],['new_item_151',1],['mem_golem',0.2]],
        '象牙塔鋼鐵高崙': [['new_item_191',0.001],['new_item_180',100],['new_item_151',1],['mem_golem',0.2]],
        '象牙塔活鎧甲': [['new_item_154',1],['bk_holy_barrier',0.03],['new_item_193',0.001], ['mat_moonlight_breath', 0.05]],
        '象牙塔密密': [['wpn_33',1],['wpn_katana',0.3],['wpn_2hsword',1],['wpn_demon_sword',0.001],['wpn_greatsword',1],['wpn_demon_dual',0.01],['wpn_demon_claw',0.01],['wpn_demon_xbow',0.01],['arm_62',1],['arm_69',0.3],['arm_61',5],['arm_59',0.1],['amr_plate',2],['glv_demon',0.1],['bot_demon',0.1],['scroll_weapon',2],['scroll_armor',2],['bk_mummy_curse',3],['bk_holy_dash',1],['bk_invisible',0.1],['bk_meteor',0.01],['bk_abs_barrier',0.1],['bk_soul_up',0.1],['bk_elf_soul',1],['bk_elf_preciseshot',0.01]],
        '象牙塔長者': [['wpn_38',3],['acc_117',0.005],['acc_125',0.01],['acc_119',0.01]],
        '象牙塔黑長者': [['wpn_witchwand',10],['acc_117',0.005],['acc_125',0.01],['acc_119',0.01],['arm_84',0.001],['arm_96',0.001]],
        '象牙塔奇美拉': [['bk_dark_poison',2],['mat_chimera_dragon',10],['mat_chimera_goat',10],['mat_chimera_lion',10],['mat_chimera_snake',10]],
        '象牙塔蛇女': [['acc_131',0.1],['scroll_weapon',0.5],['bk_weaken',0.5],['new_item_221',3]],
        '象牙塔黑魔法師': [['acc_demonbane',0.05],['scroll_weapon',0.5]],
        '象牙塔死神': [['glv_reaper',0.01],['scroll_armor',0.5],['scroll_weapon',0.5],['new_item_193',0.0001], ['mat_moonlight_breath', 0.05]],
        '象牙塔影魔': [['bk_dark_shadow',0.5]],
        '象牙塔巴列斯之影': [['mat_black_mithril',1],['wpn_powerless_baless',0.0001],['bot_baless',0.0001]],
        '卡魯塔': [['acc_129',1],['acc_131',1],['new_item_151',10],['new_item_157',10],['new_item_160',10],['new_item_154',10],['new_item_152',5],['new_item_158',5],['new_item_161',5],['new_item_155',5],['new_item_153',0.5],['new_item_159',1],['new_item_162',1],['new_item_156',1],['scroll_armor',10],['scroll_weapon',10],['bk_thunder',5],['bk_tornado',1],['bk_greater_haste',2],['bk_blizzard',1],['bk_elf_windshot',10]],
        '哈汀之影': [['wpn_33',1],['wpn_katana',0.3],['new_item_151',10],['wpn_2hsword',0.5],['wpn_siruge',0.1],['wpn_demon_sword',0.02],['wpn_greatsword',1],['wpn_demon_dual',0.01],['wpn_demon_claw',0.01],['wpn_demon_xbow',0.01],['arm_62',0.3],['arm_69',1],['arm_61',1],['arm_59',0.3],['amr_plate',1],['item_hatin_diary',1],['scroll_armor',3],['scroll_weapon',3]],
        '象牙塔炎魔的奴隸': [['mat_black_mithril',1]],
        '象牙塔小惡魔': [['wpn_demon_axe',0.01],['mat_black_mithril',1]],
        '象牙塔巴風特之影': [['mat_black_mithril',1],['wpn_powerless_baphomet',0.0001],['amr_baphomet',0.0001]],
        '象牙塔翼魔': [['mat_black_mithril',1]],
        '象牙塔炎魔之影': [['mat_black_mithril',1]],
        '象牙塔惡魔之影': [['mat_black_mithril',1],['wpn_demon_axe',0.1],['wpn_demon_scythe',0.0001],['wpn_demon_dual',0.01],['wpn_demon_claw',0.01],['wpn_demon_xbow',0.01]],
        // ===== 🐜 螞蟻洞窟 新增怪物掉落 + 巨蟻女皇（古代妖精裝備） =====
        '白螞蟻群': [['wpn_giantaxe',0.1],['arm_46',0.03],['arm_108',0.3],['new_item_154',5],['bk_elf_groundtrap',0.2],['bk_elf_earthbless',0.1]],
        '巨大白螞蟻': [['wpn_giantaxe',0.1],['arm_61',0.1],['arm_108',0.5],['new_item_158',0.2],['bk_elf_groundtrap',0.2]],
        '強化巨蟻': [['arm_47',0.03],['arm_60',0.1],['new_item_154',5],['new_item_158',0.2]],
        '強化白螞蟻群': [['arm_46',0.03],['arm_60',0.2],['arm_108',0.5],['new_item_155',0.3],['bk_elf_groundtrap',0.2],['bk_elf_steelguard',0.05]],
        '巨大突擊螞蟻': [['wpn_greatsword',0.1],['arm_46',0.03],['arm_61',0.5],['new_item_155',0.6],['bk_elf_earthbless',0.2],['bk_elf_steelguard',0.1]],
        '巨大強化白螞蟻': [['wpn_2hsword',0.05],['wpn_greatsword',0.1],['arm_46',0.05],['arm_61',0.5],['arm_60',0.3],['arm_108',0.6],['new_item_158',0.3],['new_item_155',0.6],['bk_elf_earthbless',0.2],['bk_elf_groundtrap',0.2]],
        '巨大守護螞蟻': [['wpn_ancient_darkelf_sword',0.001],['wpn_ancient_elf_xbow',0.001],['arm_108',0.6],['bk_elf_groundtrap',0.3]],
    };

    // 區域額外掉落（眠龍洞穴1~3樓=zone_15/16/17、妖精森林周邊=zone_01 所有怪物）
    // 粗糙的米索莉塊 / 精靈玉 / 元素石，各 20%；學會「世界樹的呼喚」則各 30%
    const AREA_BONUS_MAPS = ['zone_15', 'zone_16', 'zone_17', 'zone_01'];
    const AREA_BONUS_ITEMS = ['new_item_164', 'new_item_195', 'new_item_165'];

// ===== 🔧 計時慣例（單一事實來源，新增任何計時效果前先讀這裡）=====
// • player.statuses（異常狀態）：以 tick(0.1秒) 計，於 tick() 開頭的通用迴圈「統一」遞減，勿在他處再扣
// • player.buffs（增益）：以「秒」計，於 tick() 的每秒區塊（state.ticks % 10）「統一」遞減，勿在他處再扣
// • player.cds.atkSk / healSk / purifySk：以 tick 計（施法節奏需受攻速細緻影響）
// • player.cds.pot / reviveScrollCd / magicShieldCd：以秒計（tick() 的每秒區塊遞減）
// • player.blessings / player.siege（盟主祝福、攻城勝利8折、宣戰冷卻）：牆鐘 Date.now()，刻意設計為關閉遊戲仍流逝
// • 召喚物 / 迷魅 endTick：絕對 tick，已隨存檔保存（saveGame 的 ticks 欄位），重載後仍有效
const BUFF_NAMES = {   // buff 鍵 → 顯示名稱（DB.skills 查不到時使用）
    haste: "加速", brave: "勇敢藥水", blue: "藍色藥水", cautious: "慎重藥水",
    elfcookie: "精靈餅乾", poly: "變身", shield: "保護罩", taming: "誘捕"
};
// ===== 🔧 架構#3：物品「同一性簽章」單一事實來源 =====
// 判斷兩件物品是否「完全相同（可堆疊/可合併/可比對）」一律使用 itemSig / sameItemSig，
// 涵蓋：id、強化值 en（undefined 正規化為 0）、祝福 true→'B' / 詛咒 'cursed'→'C'、
// 遠古變體 true→'A'（其餘 'eternal'/'immortal'/'primordial' 原值）、屬性詞綴 attr。
// 使用處：gainItem 堆疊、卸裝/換裝退回背包合併、倉庫一鍵存入(whSig)/堆疊(_whStackFind)、
// 載入合併(consolidateInventory)、分頁重繪記憶簽章(renderTabs)。勿再各自手寫比對條件。
function itemSig(it) { return it.id + '|' + (it.en || 0) + '|' + (it.bless === true ? 'B' : (it.bless ? 'C' : 0)) + '|' + (it.anc === true ? 'A' : (it.anc || 0)) + '|' + (it.attr || '') + '|' + (it.seteff || ''); }   // 🔮 含席琳套裝效果：帶效果的裝備不可與普通品合併
function sameItemSig(a, b) { return itemSig(a) === itemSig(b); }

// ===== 🔧 架構#6：存檔版本與集中式預設值 =====
// 存檔寫入 v 欄位（SAVE_VERSION）；loadGame 在跑完「轉換型」舊檔遷移後呼叫 applySaveDefaults()
// 統一補齊缺漏欄位（含巢狀物件的個別 key），不覆蓋既有值。
// 【日後新增 player 欄位時：只需在 SAVE_DEFAULTS 加一行；除非涉及格式轉換，不必再到 loadGame 寫 if(undefined)。】
const SAVE_VERSION = 2;   // v1 = 未標版本的舊存檔
const SAVE_DEFAULTS = {
    name: null, bonus: 0, panaceaUsed: 0, bloodPledge: null,
    magicShieldCd: 0, reviveScrollCd: 0, lastMapByCat: {}, lastBattleMap: null, tracking: null, ismaelAccUsed: false, sherineWorld: false, classicMode: false, traditionalMode: false,
    masteryQuest: null, mastery: null, masteryChangeCnt: 0,
    prideBeatJenis: false, demonTempleOpen: false, flameAffinity: 0, trialStage: 0, prideRank: { best: null, last: null, isNew: false }, prideRankSherine: { best: null, last: null, isNew: false },
    riftRank: { best: null, last: null, isNew: false }, riftRankSherine: { best: null, last: null, isNew: false }, riftRewardMs: null,
    elfEle: null, poly: null, summon: null, charmed: null, hot: null,
    manualCd: {}, blessings: {}, cardDex: {},
    alloc:   { str:0, dex:0, con:0, int:0, wis:0, cha:0 },
    panacea: { str:0, dex:0, con:0, int:0, wis:0, cha:0 },
    cds:     { pot:0, atkSk:0, healSk:0, purifySk:0 },
    buffs:   { haste:0, brave:0, blue:0, cautious:0, elfcookie:0, poly:0, shield:0, sk_magic_shield:0 },
    statuses:{ stun:0, freeze:0, stone:0, poison:0, poisonDmg:0, poisonTick:0, burn:0, burnDmg:0, burnTick:0,
               scald:0, scaldDmg:0, scaldTick:0, bleed:0, bleedDmg:0, bleedTick:0, sleep:0, silence:0, paralyze:0, magicseal:0, armorBreak:0, slowAtk:0, cleave:0 },
    siege:   { active:false, city:'kent', victoryCity:null, gateKilled:false, towerKilled:false, endTime:0, kills:0, result:null,
               cooldownUntil:0, rewardPending:false, victoryUntil:0, accCdUntil:0 }
};
function applySaveDefaults(p) {
    for (let k in SAVE_DEFAULTS) {
        let dv = SAVE_DEFAULTS[k];
        if (dv !== null && typeof dv === 'object' && !Array.isArray(dv)) {
            if (!p[k] || typeof p[k] !== 'object') p[k] = {};
            for (let kk in dv) if (p[k][kk] === undefined) p[k][kk] = dv[kk];
        } else if (p[k] === undefined) {
            p[k] = dv;
        }
    }
}

// ============================================================================
// 🔮 席琳的世界（席琳神殿「祈禱」開關，Lv40+；存於 player.sherineWorld）
//  - 視覺：body 加 sherine-world class（暗紅底色、黑紅怪物框）
//  - 怪物（攻城區與血盟敵人除外）：HP×2、AC×1.5、MR×1.5、經驗×2、金錢×2、
//    一般攻擊傷害×1.5、額外命中×1.5、技能最終傷害×2（含持續傷害）；生怪等待 −1 秒（可與日光術疊加）
//  - 掉落：物品掉落機率×3、單/雙/三詞綴機率×3；指定部位裝備可附「席琳套裝效果」
// ============================================================================
function sherineWorldActive() { return !!(player && player.sherineWorld); }
function applySherineTheme() { document.body.classList.toggle('sherine-world', sherineWorldActive()); }
let _sherineLootCtx = null;   // 擊殺掉落上下文：killMob 期間設定（{boss,grace}），供 gainItem 判定詞綴×3 與套裝效果
let _forceSherineSet = false;   // 🔮 席琳製作：成品必定附帶隨機套裝效果（doCraft 產出期間設定）
let _tradLootCtx = false;   // 🏛️ 傳統模式「掠奪上下文」：在怪物掉落／潘朵拉黑市／製作期間設 true，供 gainItem 為裝備隨機自帶強化值＋抑制施法卷軸（商店購買不設→恆 +0）
let _vfxLootCtx = false;   // ✨ VFX：擊殺掉落期間設 true，供 gainItem 判定稀有(潘朵拉權重=1)掉落閃光

// ===== 🔮 席琳套裝效果（9 組；不再分五種詞綴，seteff 直接存「套裝名」＝組名）=====
// 掉落判定：席琳的世界中，武器/頭盔/盔甲/手套/長靴/斗篷/腰帶 掉落時，
// 一般怪 0.1%、頭目 5% 獨立機率獲得一個套裝效果（再從 9 組均勻抽一）。
// 觸發＝「相同套裝名、不同部位」的件數（同名不同部位即累計，5 個不同部位＝5 件效果）。
// 套裝名冠在裝備名稱前（如「紅獅環甲」），資訊欄列出 2/3/5 件加成；名稱顏色規則同前（c-sherine 鮮綠＋光暈）。
// ⚠️ 舊存檔的具名 seteff（如「紅獅的復仇」）仍相容：各處一律以 seteff.slice(0,2) 取組名。
const SHERINE_EFFECTS = ['紅獅','白鳥','鐵衛','麗人','疾風','月光','學徒','魔女','暗影'];
// 套裝加成說明（資訊欄顯示用；計數=身上「不重複效果」數，同效果兩件只算 1）
const SHERINE_SET_TEXT = {
    '紅獅': ['2件：額外傷害+5、額外魔法點數+3', '3件：傷害減免+10', '5件：最終傷害+20%（普攻與技能皆適用）'],
    '白鳥': ['2件：額外命中+5', '3件：魅力+10', '5件：一般攻擊命中時使目標「脆弱」3秒（受所有傷害+20%，重複觸發刷新）'],
    '鐵衛': ['2件：AC-3、傷害減免+5', '3件：受到傷害減少20%', '5件：觸發反擊或居合時，額外對全體敵人橫掃一次一般攻擊'],
    '麗人': ['2件：近距離傷害+3、近距離命中+3', '3件：近距離爆擊率+2%', '5件：觸發重擊後，下一次一般攻擊100%命中'],
    '疾風': ['2件：遠距離傷害+3、遠距離命中+3', '3件：遠距離爆擊率+2%', '5件：連射傷害由30%提升為80%'],
    '月光': ['2件：額外傷害+2、額外命中+2', '3件：ER+5、MR+10', '5件：ER 也能迴避魔法攻擊（必中技能改為先判定 ER）'],
    '學徒': ['2件：MP自然恢復+5、額外魔法點數+6', '3件：魔法爆擊率+2%', '5件：MP 低於最大值30%時，所有技能 MP 消耗減半'],
    '魔女': ['2件：魔法傷害+2', '3件：水屬性抗性+10、額外魔法點數+5', '5件：每觸發 5 次共鳴，免費施放一次冰矛圍籬（無需學會）'],
    '暗影': ['2件：額外傷害+7', '3件：觸發迴避時恢復 20 HP', '5件：雙擊觸發的額外攻擊傷害提升 50%']
};
// 🔮 席琳套裝效果「可附加部位」判定（唯一真相；gainItem 掉落/製作 與 試煉席琳兌換 共用）
//   合法部位：武器（非箭矢）/頭盔/盔甲/手套/長靴/斗篷/腰帶；盾牌(slot:shield)等不符 → 不可附帶套裝效果。
function sherineSetEligible(d) {
    return !!(d && (
        (d.type === 'wpn' && !d.isArrow)
        || (d.type === 'arm' && ['helm','armor','gloves','boots','cloak'].includes(d.slot))
        || ((d.type === 'acc' || d.type === 'arm') && d.slot === 'belt')
    ));
}
// 🔧 黑暗妖精武器掉落表（怪物名稱 → [[武器ID, 機率%], ...]；於擊殺結算套用，受席琳世界 _dropMult 影響）
const DARK_WEAPON_DROPS = {
    '妖魔殭屍': [['wpn_claw_bronze',0.1],['wpn_claw_steel',0.1]],
    '骷髏': [['wpn_claw_bronze',0.1],['wpn_claw_steel',0.1]],
    '骷髏弓箭手': [['wpn_claw_bronze',0.1],['wpn_claw_steel',0.1],['wpn_xbow_dark',0.01]],
    '史巴托': [['wpn_claw_bronze',0.1],['wpn_claw_steel',0.1],['wpn_dual_bronze',0.1],['wpn_dual_steel',0.1]],
    '石頭高崙': [['wpn_claw_bronze',0.1],['wpn_claw_steel',0.1],['wpn_dual_bronze',0.1],['wpn_dual_steel',0.1]],
    '蜥蜴人': [['wpn_claw_steel',0.1],['wpn_dual_bronze',0.1],['wpn_dual_steel',0.1]],
    '歐熊': [['wpn_claw_steel',0.1]],
    '影魔': [['wpn_claw_shadow',0.5]],
    '毒蠍': [['wpn_claw_dark',0.1],['wpn_dual_dark',0.1]],
    '冰之女王': [['wpn_claw_gloom',1],['wpn_dual_gloom',1],['wpn_xbow_gloom',1],['wpn_qigu_frost',0.1]],
    '妖魔鬥士': [['wpn_dual_bronze',0.1]],
    '狼人': [['wpn_dual_steel',0.1]],
    '萊肯': [['wpn_dual_steel',0.5]],
    '死神': [['wpn_dual_dark',0.5]],
    '變形怪': [['wpn_dual_shadow',0.5]],
    '黑騎士': [['wpn_dual_shadow',0.1]],
    '妖魔弓箭手': [['wpn_xbow_dark',0.01]],
    '不死鳥': [['wpn_manadagger',0.1],['new_phoenix_heart',1]],
    '伊弗利特': [['wpn_manadagger',0.1],['wpn_qigu_resonance',0.1]],
    '巴拉卡斯': [['wpn_manadagger',1],['wpn_qigu_resonance',1]]
};
// 🐉 龍騎士掉落表（怪物名稱 → [[物品ID, 機率%], ...]；僅龍騎士主玩家擊殺時判定，受 _dropMult／經典模式影響）。含任務道具、龍騎士書板、鎖鏈劍
const DRAGON_DROPS = {
    // 任務道具
    '甘地妖魔': [['item_demon_search',1]], '都達瑪拉妖魔': [['item_demon_search',1]], '羅孚妖魔': [['item_demon_search',1]], '阿吐巴妖魔': [['item_demon_search',1]],
    '蛇女': [['item_demon_spy',1]],
    '雪怪': [['item_yeti_heart',10],['wpn_chain_resonance',0.01]],
    '火焰之靈魂(紅)': [['item_soulfire_ash',1]], '火焰之靈魂(藍)': [['item_soulfire_ash',1]],
    // 書板：岩漿噴吐
    '妖魔法師': [['bk_dragon_lavaspit',0.1]], '火之牙': [['bk_dragon_lavaspit',0.1]], '地獄犬': [['bk_dragon_lavaspit',0.1]],
    '地獄束縛犬': [['bk_dragon_lavaspit',0.1],['bk_dragon_reaper',0.05]],
    '伊弗利特': [['bk_dragon_lavaspit',1]],
    '幼龍': [['bk_dragon_lavaspit',0.75],['bk_dragon_awaken_antares',0.5]],
    // 書板：覺醒安塔瑞斯
    '巨蟻': [['bk_dragon_awaken_antares',0.01]], '阿魯巴': [['bk_dragon_awaken_antares',0.3]], '歐熊': [['bk_dragon_awaken_antares',0.1]],
    '巨大兵蟻': [['bk_dragon_awaken_antares',0.01]], '楊果里恩': [['bk_dragon_awaken_antares',0.04]],
    // 書板：岩漿之箭
    '克特': [['bk_dragon_lavabolt',0.1]], '闇黑的騎士范德': [['bk_dragon_lavabolt',0.1]], '墮落': [['bk_dragon_lavabolt',0.1]],
    // 書板：覺醒法利昂
    '活鎧甲': [['bk_dragon_awaken_falion',0.1]], '希爾黛斯': [['bk_dragon_awaken_falion',0.1]],
    // 書板：致命身軀
    '魔獸軍王巴蘭卡': [['bk_dragon_deadlybody',1]], '巨大墳墓守護者': [['bk_dragon_deadlybody',0.5]], '黑暗妖精殘兵(劍)': [['bk_dragon_deadlybody',0.3]], '奇美拉': [['bk_dragon_deadlybody',0.3]],
    '食人妖精王': [['bk_dragon_deadlybody',0.1],['wpn_chain_resonance',0.001]],
    // 書板：奪命之雷
    '深淵風靈': [['bk_dragon_deathlightning',0.5]], '風靈之主': [['bk_dragon_deathlightning',0.5]],
    // 書板：驚悚死神
    '巴風特': [['bk_dragon_reaper',0.1]], '巴列斯': [['bk_dragon_reaper',0.1]], '恐怖的殭屍王': [['bk_dragon_reaper',0.1]], '不滅的巫妖': [['bk_dragon_reaper',0.1]], '烈炎獸': [['bk_dragon_reaper',0.05]],
    // 書板：覺醒巴拉卡斯（惡魔同時掉驚悚死神0.1 + 巴拉卡斯1）
    '惡魔': [['bk_dragon_reaper',0.1],['bk_dragon_awaken_baraka',1]],
    '艾莉絲': [['bk_dragon_awaken_baraka',0.1]], '熔岩高崙': [['bk_dragon_awaken_baraka',0.01]], '冷酷的艾莉絲': [['bk_dragon_awaken_baraka',1]], '骨龍': [['bk_dragon_awaken_baraka',0.1]], '墳墓守護者騎士': [['bk_dragon_awaken_baraka',0.1]],
    // 鎖鏈劍
    '受詛咒的艾爾摩士兵': [['wpn_chain_bloodthirst',0.01]], '恐怖的吸血鬼': [['wpn_chain_bloodthirst',0.1]], '馬昆斯吸血鬼': [['wpn_chain_bloodthirst',0.01]],
    '巨大鱷魚': [['wpn_chain_resonance',0.03]],
    '冰魔': [['wpn_chain_frost',0.1]]
};
// ⚔️ 戰士技能印記掉落表（怪物名稱 → [[印記ID, 機率%], ...]）：全職可掉（印記為技能書，僅戰士可學）。受 _dropMult／經典模式影響。
const WARRIOR_DROPS = {
    // 粉碎
    '毒蠍': [['bk_warrior_crush',0.01]], '阿魯巴': [['bk_warrior_crush',0.05]], '歐姆': [['bk_warrior_crush',0.01]], '歐姆裝甲兵': [['bk_warrior_crush',0.05]], '墳墓守護者': [['bk_warrior_crush',0.1]], '墳墓守護者騎士': [['bk_warrior_crush',0.3]], '墮落': [['bk_warrior_crush',0.5]],
    // 護甲身軀
    '冰石高崙': [['bk_warrior_armorbody',0.001]], '鋼鐵高崙': [['bk_warrior_armorbody',0.01]], '恐怖的鋼鐵高崙': [['bk_warrior_armorbody',0.05]],
    // 護甲身軀（與既有戰士試煉掉落同怪：石頭高崙=護甲身軀0.0001＋生命卷軸；熔岩高崙=護甲身軀0.01）
    '石頭高崙': [['bk_warrior_armorbody',0.0001]], '熔岩高崙': [['bk_warrior_armorbody',0.01]],
    // 狂暴
    '小惡魔': [['bk_warrior_berserk',0.001]], '殘暴的骷髏斧兵': [['bk_warrior_berserk',0.01],['wpn_iron_axehead',0.005]], '殘暴的史巴托': [['bk_warrior_berserk',0.01]], '地獄的黑豹': [['bk_warrior_berserk',0.5]],
    // 泰坦：岩石
    '魔獸軍王巴蘭卡': [['bk_warrior_titan_rock',0.5]], '巨人戰士': [['bk_warrior_titan_rock',0.001]],
    // 泰坦：魔法
    '黑暗妖精殘兵(法師)': [['bk_warrior_titan_magic',0.001]], '法令軍王蕾雅': [['bk_warrior_titan_magic',0.5]],
    // 泰坦：子彈
    '暗殺軍王史雷佛': [['bk_warrior_titan_bullet',0.5]], '黑暗妖精殘兵(十字弓)': [['bk_warrior_titan_bullet',0.001]],
    // 戰斧投擲
    '骷髏弓箭手': [['bk_warrior_throwaxe',0.001]], '巨大兵蟻': [['bk_warrior_throwaxe',0.01]], '黑騎士': [['bk_warrior_throwaxe',0.01]], '骷髏鬥士': [['bk_warrior_throwaxe',0.1]], '阿西塔基奧': [['bk_warrior_throwaxe',0.3]],
    // 體能強化
    '獨眼巨人': [['bk_warrior_endurance',0.01]], '巨人': [['bk_warrior_endurance',0.01]], '巨人長老': [['bk_warrior_endurance',0.05]],
    // 古代巨人：泰坦：岩石 0.5 + 體能強化 0.5
    '古代巨人': [['bk_warrior_titan_rock',0.5], ['bk_warrior_endurance',0.5], ['wpn_giant_axehead',0.1]],
    // ⚔️ 戰士武器掉落（鐵斧頭）
    '暗黑萊肯': [['wpn_iron_axehead',0.01]], '多羅': [['wpn_iron_axehead',0.001]], '死亡': [['wpn_iron_axehead',0.1]],
    // 亡命之徒（墮落的鐮刀死神→實際怪名「邪惡的鐮刀死神」）
    '邪惡的鐮刀死神': [['bk_warrior_outlaw',1]], '死亡之劍': [['bk_warrior_outlaw',0.01]]
};
// 🔮 記憶水晶掉落表（幻術士法術書·全職可掉，怪物名稱 → [[mem_ID, 機率%], ...]）：killMob 獨立 roll、受 _dropMult／經典模式影響；與 MOB_DROPS 既有的底比斯心靈破壞/立方地裂掉落並存疊加。多水晶怪（哈維/遺忘之島巨大牛人/思克巴）合併於單一鍵避免重複鍵覆蓋。
const MEM_DROPS = {
    // 心靈破壞 mem_mindbreak
    '混沌': [['mem_mindbreak',2.5]], '死亡': [['mem_mindbreak',2.5]], '多眼怪': [['mem_mindbreak',0.5]], '梅杜莎': [['mem_mindbreak',0.5]],
    // 立方：地裂 mem_cube_quake
    '遺忘之島巨斧牛人': [['mem_cube_quake',0.5]], '莫妮亞': [['mem_cube_quake',0.4]], '犰狳': [['mem_cube_quake',0.1]],
    '哈維': [['mem_mindbreak',0.1],['mem_cube_quake',0.1]],            // 心靈破壞 + 立方地裂
    '遺忘之島巨大牛人': [['mem_cube_quake',0.8],['mem_pain',0.8]],     // 立方地裂 + 疼痛
    // 幻想 mem_fantasy
    '不幸的幻象眼魔': [['mem_fantasy',2]], '小幻象眼魔': [['mem_fantasy',1]], '卡司特王': [['mem_fantasy',0.1]], '奇美拉': [['mem_fantasy',0.1]], '毒蠍': [['mem_fantasy',0.1]], '卡司特': [['mem_fantasy',0.05]],
    // 幻覺：鑽石高崙 mem_golem
    '鋼鐵高崙': [['mem_golem',0.5]], '熔岩高崙': [['mem_golem',0.5]], '冰石高崙': [['mem_golem',0.05]],
    // 洞察 mem_insight
    '墳墓守護者法師': [['mem_insight',1]], '受詛咒的艾爾摩法師': [['mem_insight',0.5]], '黑暗妖精法師': [['mem_insight',0.1]], '艾爾摩法師': [['mem_insight',0.05]], '黑暗妖精殘兵(法師)': [['mem_insight',0.1]],
    // 恐慌 mem_panic
    '巴風特': [['mem_panic',1.5]], '變形怪首領': [['mem_panic',1]], '黑法師': [['mem_panic',0.1]],
    // 疼痛的歡愉 mem_pain
    '邪惡的鐮刀死神': [['mem_pain',2.5]], '傲慢的潔尼斯女王': [['mem_pain',2]], '扭曲的潔尼斯女王': [['mem_pain',2]], '不死鳥': [['mem_pain',1]], '遺忘之島飛龍': [['mem_pain',0.5]], '魔狼': [['mem_pain',0.1]], '獨眼巨人': [['mem_pain',0.1]], '殘暴的史巴托': [['mem_pain',0.1]], '恐怖的地獄犬': [['mem_pain',0.1]],
    '思克巴': [['mem_pain',0.1],['mem_cube_harmony',0.25]],            // 疼痛 + 立方和諧
    // 幻覺：化身 mem_avatar
    '不死的木乃伊王': [['mem_avatar',2]], '古代巨人': [['mem_avatar',1]], '巨人': [['mem_avatar',0.3]], '巨人戰士': [['mem_avatar',0.3]], '巨人長老': [['mem_avatar',0.3]], '地獄奴隸': [['mem_avatar',0.25]],
    // 立方：和諧 mem_cube_harmony
    '暗黑思克巴女皇': [['mem_cube_harmony',1.5]], '深淵水靈': [['mem_cube_harmony',1.5]], '深淵火靈': [['mem_cube_harmony',1.5]], '水靈之主': [['mem_cube_harmony',0.8]], '火靈之主': [['mem_cube_harmony',0.8]], '思克巴女皇': [['mem_cube_harmony',0.25]]
};
// 🔒 試煉兌換道具 → 限定職業：列在 MOB_DROPS 內的「各職業試煉交付/兌換道具」僅該職業擊殺才會掉（非本職直接跳過、也不顯示於掉落表）。
//    龍騎士的試煉道具走 DRAGON_DROPS 表本身已限定 dragon，故不列於此。掛點：killMob 的 MOB_DROPS 迴圈 + _auditMobDrops 顯示，皆呼叫 trialDropBlocked()。
const TRIAL_ITEM_CLASS = {
    // === 🛡️ 騎士試煉 ===
    'new_item_198': 'knight', 'new_item_196': 'knight', 'new_item_206': 'knight',   // 瑞奇：黑騎士的誓約／古老的交易文件／龍龜甲 → 紅騎士頭巾
    'new_item_144': 'knight',                                                        // 甘特：夏洛伯之爪 → 紅騎士之劍
    'new_item_208': 'knight',                                                        // 甘特：蛇女之鱗 → 紅騎士盾牌
    'item_nightvision': 'knight',                                                    // 馬沙(騎士)：夜之視野（+古代鑰匙）→ 勇敢皮帶
    'mat_flame_sword': 'knight',                                                     // 50 級試煉：炎魔之劍
    // === 🔮 法師試煉 ===
    'new_item_204': 'mage', 'new_item_205': 'mage', 'new_item_203': 'mage',          // 詹姆：食屍鬼的指甲／牙齒／骷髏頭 → 魔法能量之書
    'new_item_214': 'mage', 'new_item_212': 'mage',                                  // 水晶試煉：不死族的鑰匙／不死族的骨頭 → 水晶魔杖
    'new_item_240': 'mage',                                                          // 瑪那試煉：變形怪的血 → 瑪那魔杖／斗篷
    'mat_flame_eye': 'mage',                                                         // 50 級試煉：炎魔之眼（法師·原炎魔之心已改為此；炎魔之心改列王族）
    // === 🏹 妖精試煉 ===
    'new_item_199': 'elf', 'new_item_200': 'elf', 'new_item_201': 'elf', 'new_item_202': 'elf',   // 歐斯：四大妖魔魔法書（都達瑪拉/那魯加/甘地/阿吐巴）→ 精靈頭盔
    'new_item_213': 'elf',                                                           // 迷幻森林之母：受詛咒的精靈書
    'item_blueflute': 'elf',                                                         // 馬沙(妖精)：藍色長笛（+古代鑰匙）→ 保護者手套／精靈水晶
    'mat_flame_claw': 'elf',                                                         // 50 級試煉：炎魔之爪
    // === 🛡️🏹 騎士＋妖精 共用（馬沙：兩職皆需古代鑰匙）===
    'item_ancientkey': ['knight', 'elf'],
    // === 🗡️ 黑暗妖精試煉（倫得/康/布魯迪卡 影子裝備 + 50 級試煉墮落鑰匙）===
    'item_fallen_key': 'dark', 'item_death_oath': 'dark', 'item_orc_elder_head': 'dark', 'item_yeti_head': 'dark',
    // === 🎭 幻術士試煉（希蓮恩 + 50 級試煉翼龍之血）===
    'item_ant_fruit': 'illusion', 'item_ant_branch': 'illusion', 'item_ant_bark': 'illusion',
    'item_elmore_heart': 'illusion', 'item_time_orb': 'illusion', 'item_wyvern_blood': 'illusion',
    // === 🐉 龍騎士試煉道具（普洛凱爾兌換）===　DRAGON_DROPS 表 2026-06 改為「全職可掉」(書板/鎖鏈劍·就算不能裝備也掉)，故這 4 個試煉道具改列此表、靠 trialDropBlocked 維持「僅 dragon 才掉/看到」
    'item_demon_search': 'dragon', 'item_demon_spy': 'dragon', 'item_yeti_heart': 'dragon', 'item_soulfire_ash': 'dragon',
    // === ⚔️ 戰士試煉（多文兌換道具：僅戰士擊殺才掉、才顯示於掉落表）===
    'new_item_207': 'warrior', 'new_item_226': 'warrior', 'new_item_225': 'warrior', 'new_item_219': 'warrior', 'item_cyclops_blood': 'warrior', 'new_item_234': 'warrior',
    // === 👑 王族試煉（甘特：村民的遺物／馬沙：失去光明的靈魂／迪嘉勒廷 50 試煉：炎魔之心 → 黃金權杖）===
    'new_item_211': 'royal', 'item_lost_soul': 'royal', 'mat_flame_heart': 'royal'
};
// 值可為「單一職業字串」或「職業陣列」（古代鑰匙＝騎士+妖精共用）。非允許職業擊殺則略過掉落、也不顯示於掉落表。
function trialDropBlocked(id) {
    if (typeof TRIAL_ITEM_CLASS === 'undefined') return false;
    let owner = TRIAL_ITEM_CLASS[id]; if (!owner) return false;
    if (typeof player === 'undefined') return false;
    return Array.isArray(owner) ? (owner.indexOf(player.cls) === -1) : (player.cls !== owner);
}
// 🔧 三階黑暗精靈水晶掉落表（怪物名稱 → [[水晶ID, 機率%], ...]；於擊殺結算套用，受席琳世界 _dropMult 影響）
// bk_dark_fang=暗影之牙 / bk_dark_dodge=暗影閃避 / bk_dark_crit=會心一擊 / bk_dark_erup=迴避提升 / bk_dark_double=雙重破壞 / bk_dark_armorbreak=破壞盔甲
const DARK_CRYSTAL_DROPS = {
    // 暗影之牙
    '亞力安':     [['bk_dark_fang',0.1]],
    '地獄犬':     [['bk_dark_fang',0.01]],
    '蟑螂人':     [['bk_dark_fang',0.01]],
    '變形怪首領': [['bk_dark_fang',1]],
    '死亡騎士':   [['bk_dark_fang',2],['bk_dark_armorbreak',1]],   // 暗影之牙 + 破壞盔甲
    // 暗影閃避
    '冰人':       [['bk_dark_dodge',0.1]],
    '人魚':       [['bk_dark_dodge',0.01]],
    '鼠人':       [['bk_dark_dodge',0.1]],
    '阿魯巴':     [['bk_dark_dodge',0.5]],
    // 會心一擊
    '獨眼巨人':   [['bk_dark_crit',0.5]],
    '密密':       [['bk_dark_crit',0.3]],
    '冰原老虎':   [['bk_dark_crit',0.2]],
    '冰之女王':   [['bk_dark_crit',2]],
    // 迴避提升
    '蛇女':       [['bk_dark_erup',0.03]],
    '多眼怪':     [['bk_dark_erup',0.1]],
    '夢幻之島閃電球': [['bk_dark_erup',0.3]],   // 對應玩家所指「閃電球」
    '夢幻之島風精靈王':   [['bk_dark_erup',1]],
    '巨蟻女皇':   [['bk_dark_erup',3]],
    // 雙重破壞
    '火蜥蜴':     [['bk_dark_double',0.01]],
    '阿西塔基奧': [['bk_dark_double',0.05]],
    '死神':       [['bk_dark_double',0.1]],
    '邪惡蜥蜴':   [['bk_dark_double',0.2]],
    '巴列斯':     [['bk_dark_double',3]],
    '飛龍':       [['bk_dark_double',1]],
    // 破壞盔甲（死亡騎士見上方）
    '巴風特':     [['bk_dark_armorbreak',1]],
    '安塔瑞斯':   [['bk_dark_armorbreak',5]]
};
// 脆弱（白鳥5）：受所有主要傷害來源 +20%
function fragileMult(t) { let m = 1; if (t && t.st) { if (t.st.fragile > 0) m *= 1.2; if (t.st.armorbreak > 0) m *= 1.58; } if (typeof player !== 'undefined' && player && player.buffs && player.buffs.sk_royal_precise > 0) { let _div = (player.mastery === 'k_royal_pledge') ? 10 : 15; m *= (1 + (1 + (player.lv || 1) / _div) / 100); } return m; }   // 🔮 脆弱(白鳥5)+20%、🔧 破壞盔甲+58%；👑 精準目標：場上所有敵人受傷 +[1+(等級/15)]%（🏅 血盟精通→/10）

// ============================================================================
// 🏅 職業精通系統（威頓村 NPC 漢，Lv50+）
//  流程：接取任務 → 擊敗職業對應頭目必得「精通之證」（身上已有則不再掉）→ 回威頓村交付 →
//        開啟精通選擇。初次選擇免費，之後每次更換固定 300 萬金幣＋10 張王族搜索狀。
//  狀態：player.masteryQuest = null|'active'|'done'；player.mastery = 精通id|null；player.masteryChangeCnt = 已付費更換次數
// ============================================================================
const MASTERY_DATA = {
    knight: { logo: 'assets/logo/騎士logo.png', boss: '飛龍', list: {
        k_counter: { n: '反擊精通', pos: 'top',    msg: '反擊與居合100%發動且必定爆擊、削減硬皮',       d: '使用有反擊與居合武器時，反擊與居合觸發機率變成100%、傷害提升、必定爆擊，且反擊與居合命中時各再削減 1 點硬皮值（與居合重擊的削減疊加）' },
        k_cleave:  { n: '切割精通', pos: 'left',   msg: '持切割武器時切割常駐、攻速大增',           d: '使用有切割的武器時，切割效果常駐，增加攻擊速度變成50%，且觸發重擊時傷害×1.5' },
        k_pierce:  { n: '穿透精通', pos: 'right',  msg: '穿透變全體攻擊、無視硬皮',                     d: '使用有穿透的武器時，穿透效果變成全體攻擊，且穿透傷害無視硬皮減傷' },
        k_survive: { n: '生存精通', pos: 'bottom', msg: '藥水治癒量增加，魔抗增加',             d: '治癒藥水恢復量增加25%，MR+15' }
    } },
    mage: { logo: 'assets/logo/法師logo.png', boss: '黑長者', list: {
        m_resonance: { n: '共鳴精通', pos: 'top',    msg: '共鳴傷害+5且無視魔抗',           d: '共鳴的光箭傷害+5且無視魔抗，恢復MP變更為光箭傷害/5' },
        m_strike:    { n: '魔擊精通', pos: 'left',   msg: '魔擊必定額外觸發全體魔擊',         d: '觸發魔擊時，必定額外觸發擴散魔擊，對所有敵人各自造成等同1次魔擊的傷害' },
        m_echo:      { n: '迴響精通', pos: 'right',  msg: '傷害法術有機率變成連發、單體加倍',             d: '施放傷害攻擊法術時，有機率不消耗MP立刻觸發相同法術；全體傷害魔法沿用原機率，單體傷害魔法觸發機率加倍' },
        m_summon:    { n: '召喚精通', pos: 'bottom', msg: '對比自己低等怪迷魅必定成功，魅力額外增加召喚物傷害與命中', d: '迷魅術對等級比自己低的非BOSS怪物必定成功，造屍術與召喚術的傷害與命中魅力影響提升' }
    } },
    elf: { logo: 'assets/logo/妖精logo.png', boss: '變形怪首領', list: {
        e_rapid:  { n: '連射精通', pos: 'top',    msg: '提升連射傷害與數量',                   d: '連射傷害由30%提升為50%，額外箭數由1~3變成隨機1~5' },
        e_spirit: { n: '精靈精通', pos: 'left',   msg: '可同時召喚多隻屬性精靈',               d: '召喚屬性精靈與召喚強力屬性精靈數量變成1+魅力/10，可同時擁有7隻屬性精靈或強力屬性精靈' },
        e_sword:  { n: '劍術精通', pos: 'right',  msg: '可使用騎士單手武器、攻速+50%、發動看破',         d: '可裝備騎士限定的單手武器；持單手近戰武器時攻擊速度+50%（與加速術/勇敢/精靈餅乾/變身相乘疊加）；近距離攻擊有機率發動看破' },
        e_magic:  { n: '魔導精通', pos: 'bottom', msg: '同屬性傷害魔法增幅、省MP並可學高階法術',     d: '施放與自身同屬性的傷害魔法威力提升、消耗MP減少30%，可學習冰雪暴、龍捲風、震裂術、火風暴' }
    } },
    dark: { logo: 'assets/logo/黑暗妖精logo.png', boss: '巴風特', list: {
        d_poison: { n: '劇毒精通', pos: 'top',    msg: '附加劇毒必定觸發、每秒200%傷害',     d: '附加劇毒觸發機率變成100%，且中毒每秒造成該次攻擊200%傷害（持續5秒、1層）' },
        d_bleed:  { n: '出血精通', pos: 'left',   msg: '雙刀也能出血、10層每層+10%',     d: '使用雙刀比照匕首觸發出血；匕首與雙刀出血皆最多疊10層，每層使每秒出血總傷害+10%（滿10層=+100%）' },
        d_crit:   { n: '爆擊精通', pos: 'right',  msg: '爆擊率提升、爆擊追加攻擊',       d: '近/遠距離爆擊率各+3%；一般攻擊爆擊時額外觸發一次一般攻擊(最多連續2次)' },
        d_evade:  { n: '迴避精通', pos: 'bottom', msg: '受擊累積ER、迴避後必中且爆擊',     d: '每次受到敵人攻擊獲得 ER+1 並持續累積；成功觸發迴避時清空累積值，且下次一般攻擊必定命中並爆擊' }
    } },
    illusion: { logo: 'assets/logo/幻術士logo.png', boss: '伊弗利特', list: {
        i_qigu:       { n: '奇古獸精通', pos: 'top',    msg: '裝備奇古獸時無視魔抗、攻速大增',         d: '裝備奇古獸時，一般攻擊與奇古獸觸發特效無視目標魔抗，攻擊速度+30%' },
        i_magicsword: { n: '魔劍精通',   pos: 'left',   msg: '非奇古獸武器也套用奇古獸傷害、攻速大增', d: '裝備非奇古獸武器時，一般攻擊仍套用奇古獸傷害公式（必中·魔法傷害·受魔抗減免），攻擊速度+30%' },
        i_illusion:   { n: '幻術精通',   pos: 'right',  msg: '幻覺法術召喚幻象並肩作戰',               d: '施放特定幻覺法術（幻覺：歐吉／巫妖／鑽石高崙）時，產生對應的召喚幻象一同戰鬥（需習得對應記憶水晶法術）' },
        i_mana:       { n: '魔力精通',   pos: 'bottom', msg: 'MP上限加倍、消耗MP回饋傭兵',             d: '幻術士MP上限加倍、所有技能MP消耗加倍；消耗MP時，所有有MP的傭兵恢復消耗量10%的MP' }
    } },
    dragon: { logo: 'assets/logo/龍騎士logo.png', boss: '飛龍', list: {
        k_awaken:      { n: '覺醒精通', pos: 'top',    msg: '可同時使用三種覺醒、覺醒攻速提升為50%',           d: '可同時使用三種覺醒技能（攻擊速度不疊加）；覺醒的攻擊速度提升變更為增加 50%' },
        k_chainblade:  { n: '鎖刃精通', pos: 'left',   msg: '弱點曝光必定觸發(上限5層)、屠宰者每層傷害+10%',   d: '弱點曝光觸發機率提升為 100%、上限提升為 5 層；施放屠宰者時，目標每有 1 層弱點曝光，該次傷害 +10%（最高 +50%）；一般攻擊不套用此加成' },
        k_weakness:    { n: '弱點精通', pos: 'right',  msg: '近戰皆附加弱點曝光、每層AC+3、屠宰者不消耗',       d: '使用近距離武器一般攻擊命中都能附加弱點曝光；弱點曝光每層額外使目標 AC+3（更易命中）；屠宰者命中不再消耗弱點曝光' },
        k_dragonblood: { n: '龍血精通', pos: 'bottom', msg: '技能HP消耗減半、治癒藥水恢復+15%',                 d: '所有技能消耗的 HP 減半；治癒藥水恢復量 +15%' }
    } },
    warrior: { logo: 'assets/logo/戰士logo.png', boss: '變形怪首領', list: {
        k_giantaxe: { n: '巨斧精通', pos: 'top',    msg: '可單手使用雙手鈍器、持雙手鈍器攻速+30%',          d: '可單手使用雙手鈍器（可與盾牌／副手並用）；若學會迅猛雙斧則主手與副手皆可裝雙手鈍器；持雙手鈍器時攻擊速度+30%' },
        k_dualaxe:  { n: '雙斧精通', pos: 'left',   msg: '戰斧投擲免MP、出血每層+10%、雙持單手鈍器攻速+30%', d: '戰斧投擲不消耗 MP；出血每層傷害量+10%；主手與副手皆裝單手鈍器時攻擊速度+30%' },
        k_rebound:  { n: '反彈精通', pos: 'right',  msg: '忍耐改HP80%以下觸發、觸發時額外普攻',             d: '【忍耐】系技能觸發條件變更為 HP 80% 以下；觸發忍耐被動時額外對敵人發動一次普通攻擊（副手裝單手鈍器則主副手各一次）' },
        k_tough:    { n: '堅韌精通', pos: 'bottom', msg: 'HP<40%藥水治癒+50%、護甲身軀改/5',               d: 'HP 低於 40% 時，藥水治癒量+50%；護甲身軀的效果變更為 傷害減免+[(10-AC)/5]' }
    } },
    royal: { logo: 'assets/logo/王族logo.png', boss: '巴風特', list: {
        k_royal_pet:    { n: '夥伴精通', pos: 'top',    msg: '項圈夥伴傷害/命中的魅力係數×1.2、觸發魔法+魅力固定傷害', d: '所有項圈夥伴的傷害與命中之魅力判定係數再 ×1.2；項圈夥伴觸發的魔法額外獲得相當於你魅力的固定傷害' },
        k_royal_pledge: { n: '血盟精通', pos: 'left',   msg: '呼喚盟友MP減半、精準目標改 [1+等級/10]%',           d: '呼喚盟友消耗 MP 減半；精準目標效果變更為 場上所有敵人受到傷害增加 [1+(玩家等級/10)]%' },
        k_royal_sword:  { n: '劍術精通', pos: 'right',  msg: '裝單手劍/雙手劍攻速+50%、勇猛意志機率20%',           d: '裝備單手劍或雙手劍時攻擊速度 +50%；勇猛意志的發動機率提升為 20%' },
        k_royal_magic:  { n: '魔法精通', pos: 'bottom', msg: '可學法師3~5階魔法、命中10%免MP額外施放攻擊技',       d: '可學習法師三、四、五階魔法；一般攻擊命中時 10% 機率不消耗 MP 額外施放目前設定的攻擊技能' }
    } }
};
const MASTERY_POS_STYLE = {   // 四向按鈕四色（上紅/左藍/右紫/下綠）
    top:    'bg-red-950/80 border-red-500 hover:bg-red-900',
    left:   'bg-blue-950/80 border-blue-500 hover:bg-blue-900',
    right:  'bg-purple-950/80 border-purple-500 hover:bg-purple-900',
    bottom: 'bg-emerald-950/80 border-emerald-500 hover:bg-emerald-900'
};
const MAGIC_MASTERY_SKILLS = ['sk_blizzard', 'sk_tornado', 'sk_quake', 'sk_fire_storm'];   // 魔導精通可學的法師法術
function hasMastery(id) { return !!(player && player.mastery === id); }
function allyHasMastery(ally, id) { return !!(ally && ally.mastery === id); }   // 🔧 傭兵吃「自身存檔」的精通（不吃主玩家精通）
function masteryChangeCost() { return { gold: 3000000, warrants: 10 }; }   // 🔧 固定費用：每次更換都維持 300 萬金幣＋10 張王族搜索狀，不再隨次數遞增
// 技能職業需求等級（單一事實來源）：🏅 魔導精通的妖精可學四項法師法術（需求等級沿用法師）
function skillReqLv(sk, skId) {
    if (player.cls === 'dark') {
        if (sk.reqD !== undefined) return sk.reqD;                                  // 黑暗妖精專屬魔法
        if (sk.reqM !== undefined && (sk.tier === 1 || sk.tier === 2)) return sk.tier === 1 ? 12 : 24;   // 基礎法師魔法：一階 Lv12 / 二階 Lv24（學不到精靈水晶與高階法師魔法）
        return undefined;
    }
    if (player.cls === 'illusion') return sk.reqI;   // 🔮 幻術士：只學帶 reqI 的法術（記憶水晶＋日光術）；undefined＝不可學（不再誤用 reqE）
    if (player.cls === 'dragon') return sk.reqDk;   // 🐉 龍騎士：只學帶 reqDk 的龍魔法（含日光術）；undefined＝不可學
    if (player.cls === 'warrior') {                  // ⚔️ 戰士：只學帶 reqW 的技能印記；另可在 Lv15 學一階法師魔法
        if (sk.reqW !== undefined) return sk.reqW;
        if (sk.reqM !== undefined && sk.tier === 1) return 15;
        return undefined;
    }
    if (player.cls === 'royal') {                    // 👑 王族：學帶 reqRoy 的王族魔法；另可在 Lv10/Lv20 學一/二階法師魔法（魔法精通可再學三~五階）
        if (sk.reqRoy !== undefined) return sk.reqRoy;
        if (sk.reqM !== undefined && sk.tier === 1) return 10;
        if (sk.reqM !== undefined && sk.tier === 2) return 20;
        if (player.mastery === 'k_royal_magic' && sk.reqM !== undefined && (sk.tier === 3 || sk.tier === 4 || sk.tier === 5)) return sk.reqM;   // 🏅 魔法精通：可學法師三~五階魔法
        return undefined;
    }
    let lv = player.cls === 'mage' ? sk.reqM : (player.cls === 'knight' ? sk.reqK : sk.reqE);
    if (lv === undefined && player.cls === 'elf' && player.mastery === 'e_magic' && skId && MAGIC_MASTERY_SKILLS.includes(skId)) lv = sk.reqM;
    return lv;
}
let _echoFree = false;        // 🏅 迴響精通：免費連發旗標（連發那次不耗MP、不再連鎖）
let _royalFreeCast = false;   // 👑 魔法精通：一般攻擊命中 10% 免MP額外施放選定攻擊技的旗標

let state = { running: false, ticks: 0, pDmgTick: 0, ff: false, inTick: false };
// 主迴圈計時（依真實經過時間補跑 tick）
const TICK_MS = 100;                 // 一個邏輯 tick 代表的真實時間
const MAX_CATCHUP_MS = 5 * 60 * 1000; // 單次最多補算 5 分鐘，避免長時間離開後一次模擬過久
let _loopLast = null;                // 上次主迴圈時間戳 (performance.now)
let _tickDebt = 0;                   // 尚未換算成 tick 的累積時間 (ms)
let _gameLoopId = null;              // 主迴圈 setInterval id（用於避免重複註冊）
let _saveLoopId = null;             // 自動存檔 setInterval id
let currentSlot = 1;                // 目前所在的存檔位（1~4）

// 統一啟動遊戲計時器：先清除既有的，再重新註冊，確保整個工作階段只會有一組計時器
function startGameTimers() {
    if (_gameLoopId !== null) clearInterval(_gameLoopId);
    if (_saveLoopId !== null) clearInterval(_saveLoopId);
    _loopLast = null; _tickDebt = 0;
    _gameLoopId = setInterval(gameLoop, 100);
    _saveLoopId = setInterval(saveGame, 300000); // 每 5 分鐘自動存檔
    if (typeof initCombatLogLock === 'function') initCombatLogLock();   // 🔒 綁定戰鬥日誌捲動鎖定（含去重）
    if (typeof initSysLogLock === 'function') initSysLogLock();         // 🔒 綁定系統與物品日誌捲動鎖定（含去重）
    if (typeof applyCombatFilter === 'function') applyCombatFilter();   // ⚔️ 套用已儲存的戰鬥日誌來源過濾（按鈕點亮/點暗 + 隱藏對應訊息）
    if (typeof _initTabGuard === 'function') _initTabGuard();           // 🚀 綁定分頁面板點擊保護＋重繪節流（避免狩獵時 賣出/強化 按鈕卡頓、點擊失效）
}

// 補跑（掛機/背景）所得累積：補跑期間 logSys 被靜音，先把所得累積起來，
// 等真正回到即時（n===1）且累積時間達門檻時，才統一輸出一次，避免每次小補跑都洗版。
const AWAY_SUMMARY_MIN_MS = 3000;    // 累積補跑時間達 3 秒才輸出「掛機期間獲得」訊息
let _awayAcc = { ticks: 0, gold: 0, items: {} };
function flushAwaySummary() {
    if (_awayAcc.ticks <= 0) return;
    if (_awayAcc.ticks * TICK_MS >= AWAY_SUMMARY_MIN_MS) {
        let gains = [];
        for (let id in _awayAcc.items) {
            if (_awayAcc.items[id] > 0 && DB.items[id]) gains.push({ id, n: _awayAcc.items[id] });
        }
        if (gains.length) {
            logSys(`掛機期間獲得：` + gains
                .map(g => `<span class="${getItemColor({ id: g.id, en: 0 })} font-bold">${DB.items[g.id].n} ×${g.n}</span>`)
                .join('、'));
        }
        if (_awayAcc.gold > 0) {
            /* 🔧 掛機期間獲得的金幣不輸出日誌（已計入 player.gold、即時顯示於左側面板）；賣出/花費/消耗等金幣訊息仍保留 */
        }
    }
    // 無論是否達門檻都清空（未達門檻者視為一般即時遊玩的計時抖動，不輸出）
    _awayAcc = { ticks: 0, gold: 0, items: {} };
}

let player = {
    cls: null, name: null, lv: 1, exp: 0, gold: 1000, hp: 0, mhp: 0, mp: 0, mmp: 0, blessings: {},
    base: { str:0, dex:0, con:0, int:0, wis:0, cha:8 }, bonus: 0, alloc: { str:0, dex:0, con:0, int:0, wis:0, cha:0 }, panacea: { str:0, dex:0, con:0, int:0, wis:0, cha:0 }, panaceaUsed: 0, junkPrefs: {}, bloodPledge: null, magicShieldCd: 0, lastMapByCat: {}, tracking: null, ismaelAccUsed: false, sherineWorld: false, masteryQuest: null, mastery: null, masteryChangeCnt: 0, siege: { active:false, gateKilled:false, towerKilled:false, endTime:0, kills:0, result:null, cooldownUntil:0, rewardPending:false, victoryUntil:0, accCdUntil:0 },
    inv: [], eq: { wpn: null, arrow: null, helm: null, armor: null, shield: null, cloak: null, tshirt: null, gloves: null, boots: null, ring1: null, ring2: null, ring3: null, ring4: null, amulet: null, ear1: null, ear2: null, belt: null, pet: null },
    skills: [], buffs: { haste: 0, brave: 0, blue: 0, cautious: 0, elfcookie: 0, poly: 0, shield: 0, sk_magic_shield: 0 }, poly: null, allies: [],
    summon: null, charmed: null, manualCd: {}, elfEle: null, hot: null,
    cds: { pot: 0, atkSk: 0, healSk: 0, purifySk: 0 }, dead: false, statuses: { stun: 0, freeze: 0, stone: 0, poison: 0, poisonDmg: 0, poisonTick: 0, burn: 0, burnDmg: 0, burnTick: 0, scald: 0, scaldDmg: 0, scaldTick: 0, bleed: 0, bleedDmg: 0, bleedTick: 0, sleep: 0, silence: 0, paralyze: 0, magicseal: 0, armorBreak: 0, slowAtk: 0, cleave: 0 },
    d: { str:0, dex:0, con:0, int:0, wis:0, cha:8,
         meleeDmg: 0, meleeHit: 0, meleeCrit: 0,           // 近距離（力量）
         rangedDmg: 0, rangedHit: 0, rangedCrit: 0,         // 遠距離（敏捷）
         extraDmg: 0, extraHit: 0,                          // 額外傷害 / 額外命中（同時影響遠近）
         magicDmg: 0, magicHit: 0, magicCrit: 0, extraMp: 0, mpReduce: 0, // 魔法（智力）
         meleeCritDmg: 50, rangedCritDmg: 50, magicCritDmg: 50,           // 爆擊傷害%
         ac: 10, mr: 0, er: 0, dr: 0,
         resFire: 0, resWater: 0, resEarth: 0, resWind: 0,  // 屬性抗性%
         hpRegenMax: 0, hpR: 0, mpR: 0, aspd: 1.0 }
};

let mapState = { current: "training", mobs: [null, null, null, null, null], targetIdx: 0 };   // 🆕 5 格（前排 0,1,2＋後排 3,4）
let createBase = { 
    knight: {str:16, dex:12, con:14, int:8, wis:9, cha:8, pts:8}, 
    mage: {str:8, dex:7, con:12, int:12, wis:12, cha:8, pts:16},
    elf: {str:11, dex:12, con:12, int:12, wis:12, cha:8, pts:8}, // 妖精基底（可分配8點
    dark: {str:12, dex:15, con:8, int:10, wis:11, cha:8, pts:11}, // 黑暗妖精基底（可分配11點，以0計）
    illusion: {str:11, dex:10, con:12, int:12, wis:12, cha:8, pts:10}, // 幻術士基底（可分配10點，以0計）
    dragon: {str:13, dex:11, con:14, int:11, wis:12, cha:8, pts:6}, // 龍騎士基底（可分配6點，以0計）
    warrior: {str:16, dex:13, con:16, int:10, wis:7, cha:8, pts:5}, // ⚔️ 戰士基底（可分配5點，以0計）
    royal: {str:13, dex:10, con:10, int:10, wis:11, cha:13, pts:8} // 👑 王族基底（可分配8點，以0計）
};
let curCreate = { rawCls: 'm_royal', cls: 'royal', str:0, dex:0, con:0, int:0, wis:0, cha:0 };

// ===== 犬類夥伴定義：項圈ID / 屬性 / 傷害骰偏移(1D(等級+diceOff)+魅力) / 命中偏移 =====
const PET_DEF = {
    '杜賓狗': { collar:'new_item_184', ele:'fire',  eleName:'火', diceOff:5, hitOff:0 },
    '狼':     { collar:'new_item_185', ele:'wind',  eleName:'風', diceOff:1, hitOff:4 },
    '哈士奇': { collar:'new_item_collar_husky', ele:'water', eleName:'水', diceOff:3, hitOff:2 },
    '牧羊犬': { collar:'new_item_238', ele:'earth', eleName:'地', diceOff:4, hitOff:1 },
    // 🐾 進化夥伴：傷害=1D(等級+diceOff)+魅力×chaMult；命中=等級+魅力×hitChaMult+hitOff−怪等級+怪AC；每擊10%觸發 proc 法術(套用玩家施法數值)
    '暴走兔': { collar:'new_collar_rabbit',    ele:'water', eleName:'水', diceOff:11, hitOff:5, chaMult:1.2, hitChaMult:1.3, proc:'sk_ice_spike' },
    '狐狸':   { collar:'new_collar_fox',       ele:'fire',  eleName:'火', diceOff:18, hitOff:3, chaMult:1.3, hitChaMult:1.2, proc:'sk_fireball' },     // 🔧 火箭→燃燒的火球
    '小獵犬': { collar:'new_collar_beagle',    ele:'earth', eleName:'地', diceOff:15, hitOff:4, chaMult:1.3, hitChaMult:1.2, proc:'sk_rock_prison' },  // 🔧 地獄之牙→岩牢
    '聖伯納': { collar:'new_collar_stbernard', ele:'wind',  eleName:'風', diceOff:10, hitOff:6, chaMult:1.2, hitChaMult:1.3, proc:'sk_thunder' }        // 🔧 風刃→極道落雷
};
// 🦴 寵物裝備加成：裝在 player.eq.pet 的「之牙」→ 夥伴額外傷害/命中（含強化：每+1 各+1，飾品上限+5）
function petGearBonus() {
    let inst = player.eq && player.eq.pet; if(!inst) return { dmg:0, hit:0 };
    let d = DB.items[inst.id]; if(!d) return { dmg:0, hit:0 };
    let en = capEn(inst.en || 0, d);   // 飾品上限 +5
    return { dmg: (d.petDmg || 0) + en, hit: (d.petHit || 0) + en };
}
// 🐾 夥伴觸發法術傷害：比照「玩家自身施放該法術」的數值（沿用攻擊魔法公式 spCoef×mageMult、吃怪物魔抗、不計爆擊/元素固定加成）
function petProcSpellDamage(skId, target) {
    let sk = DB.skills[skId]; if(!sk) return 0;
    let _dice = sk.multiDmg || (sk.dmgDice ? [sk.dmgDice] : null); if(!_dice) return 0;   // 🐾 支援多段魔法(multiDmg，如燃燒的火球)與單段(dmgDice，如岩牢/極道落雷)
    let effMr = (target.st && target.st.mrhalf > 0) ? Math.floor((target.mr || 0) / 2) : (target.mr || 0);
    let tier = sk.tier || 1;
    let spCoef = (1 + 3 * (player.d.magicDmg || 0) / 16) * (1 + tier / 3);
    // 🔧 夥伴/寵物的法術「不」套用法師職業階級加成（原 mageMult＝玩家為法師時 ×(1.5+階級/20)）：夥伴非玩家本人施法，故移除；仍吃玩家魔法傷害/技能階級係數與魔抗
    let core = _dice.reduce((s, dc) => s + roll(dc[0], dc[1]), 0) * spCoef;   // 多段骰子加總
    let dmg = Math.max(1, Math.floor((core + (player.d.extraMp || 0)) * mrMult(effMr)) - (target.dr || 0));
    if (hasMastery('k_royal_pet')) dmg += (player.d.cha || 0);   // 👑 夥伴精通：項圈夥伴觸發魔法額外+魅力固定傷害
    return dmg;
}
function petCollarCount(name) {
    let cid = PET_DEF[name] && PET_DEF[name].collar; if(!cid) return 0;
    return player.inv.filter(i => i.id === cid).reduce((s,i) => s + (i.cnt || 1), 0);
}
function totalCollarCount() {
    return Object.keys(PET_DEF).reduce((s,nm) => s + petCollarCount(nm), 0);
}

function uid() { return Math.random().toString(36).substr(2, 9); }
function roll(n, s) { let res = 0; for(let i=0; i<n; i++) res += Math.floor(Math.random() * s) + 1; return res; }

// 👇 新增這段：自動對照並產生對應素材路徑的函數
function getIconUrl(d, isSkill = false) {
    if (d.img) return d.img; // 如果資料庫有手動寫 img 網址，以它優先
    
    if (isSkill) return `assets/icons/skills/${d.n}.png`;
    
    if (d.type === 'wpn') return `assets/icons/weapons/${d.n}.png`;       // 武器
    if (d.type === 'arm') return `assets/icons/armors/${d.n}.png`;        // 防具
    if (d.type === 'acc') return `assets/icons/accessories/${d.n}.png`;   // 飾品
    
    return `assets/icons/items/${d.n}.png`;                               // 其他消耗品與道具
}

// ===== 能力換算輔助函數（依照「職業與基本設定」完整對照表）=====
// 通用：依「門檻->數值」的階梯表查值（門檻為該級距上限）
function lookupStep(val, table, def) {
    for (let i = 0; i < table.length; i++) {
        if (val <= table[i][0]) return table[i][1];
    }
    return def;
}

// ---------- 力量 STR：近距離傷害 / 近距離命中 / 近距離爆擊率 ----------
function getStrMeleeDmg(str) {
    return lookupStep(str, [
        [7,1],[9,2],[11,3],[13,4],[15,5],[17,6],[19,7],[21,8],[23,9],[24,10],
        [25,11],[27,12],[29,13],[31,14],[33,15],[34,16],[35,17],[37,18],[39,19],
        [41,20],[43,21],[44,22],[45,25],[47,26],[49,27],[51,28],[53,29],[55,30],
        [57,31],[59,32],[60,33],[62,34],[64,35],[65,36],[67,37],[69,38],
        [70,40],[72,41],[74,42],[76,43],[78,44]
    ], 45); // …68~69=+38；70=+40；71~72=+41；73~74=+42；75~76=+43；77~78=+44；79+=+45
}
function getStrMeleeHit(str) {
    return lookupStep(str, [
        [7,4],[8,5],[10,6],[11,7],[13,8],[14,9],[16,10],[17,11],[19,12],[20,13],
        [22,14],[23,15],[24,16],[25,17],[26,18],[28,19],[29,20],[31,21],[32,22],
        [34,23],[35,25],[37,26],[38,27],[40,28],[41,29],[43,30],[44,31],[46,35],
        [47,36],[49,37],[50,38],[52,39],[53,40],[55,41],[56,42],[58,43],[59,44],
        [60,45],[62,46],[64,47],[65,48],[67,49],[69,50],
        [71,51],[72,52],[73,53],[74,54],[75,55],[76,56],[77,57],[78,58],[79,59]
    ], 60); // …68~69=+50；70~71=+51；72=+52…逐項+1…79=+59；80+=+60
}
function getStrMeleeCrit(str) {
    if (str <= 39) return 0;
    if (str <= 44) return 1;
    if (str <= 49) return 2;
    if (str <= 59) return 3;
    if (str <= 64) return 4;   // 60~64 = 4%
    if (str <= 69) return 5;   // 65~69 = 5%
    if (str <= 74) return 7;   // 70~74 = 7%
    if (str <= 79) return 8;   // 75~79 = 8%
    return 9;                  // 80+ = 9%
}

// ---------- 敏捷 DEX：遠距離傷害 / 遠距離命中 / 遠距離爆擊率 / AC / ER ----------
function getDexRangedDmg(dex) {
    return lookupStep(dex, [
        [8,2],[11,3],[14,4],[17,5],[20,6],[23,7],[24,8],[26,9],[29,10],[32,11],
        [34,12],[35,13],[38,14],[41,15],[44,16],[47,20],[50,21],[53,22],[56,23],[59,24],
        [60,25],[62,26],[64,27],[65,28],[67,29],[69,30],
        [71,31],[73,32],[75,33],[77,34],[79,35]
    ], 36); // …68~69=+30；70~71=+31；72~73=+32；74~75=+33；76~77=+34；78~79=+35；80+=+36
}
function getDexRangedHit(dex) {
    // 敏捷7=-3 起，逐項對照
    return lookupStep(dex, [
        [7,-3],[8,-2],[9,-1],[10,0],[11,1],[12,2],[13,3],[14,4],[15,5],[16,6],
        [17,7],[18,8],[19,9],[20,10],[21,11],[22,12],[23,13],[24,14],[25,16],[26,17],
        [27,18],[28,19],[29,20],[30,21],[31,22],[32,23],[33,24],[34,25],[35,27],[36,28],
        [37,29],[38,30],[39,31],[40,32],[41,33],[42,34],[43,35],[44,36],[45,40],[46,41],
        [47,42],[48,43],[49,44],[50,45],[51,46],[52,47],[53,48],[54,49],[55,50],[56,51],
        [57,52],[58,53],[59,54],
        [60,55],[61,56],[62,57],[63,58],[64,59],[65,60],[66,61],[67,62],[68,63],[69,64],
        [71,65],[72,66],[73,67],[74,68],[75,69],[76,70],[77,71],[78,72],[79,73]
    ], 74); // …69=+64；70~71=+65；72=+66…逐項+1…79=+73；80+=+74
}
function getDexRangedCrit(dex) {
    if (dex <= 39) return 0;
    if (dex <= 44) return 1;
    if (dex <= 49) return 2;
    if (dex <= 59) return 3;
    if (dex <= 64) return 4;   // 60~64 = 4%
    if (dex <= 69) return 5;   // 65~69 = 5%
    if (dex <= 74) return 6;   // 70~74 = 6%
    if (dex <= 79) return 7;   // 75~79 = 7%
    return 8;                  // 80+ = 8%
}
function getDexAC(dex) {
    // 回傳 AC 變化量（負值代表防禦提升）
    return lookupStep(dex, [
        [8,-2],[11,-3],[14,-4],[17,-5],[20,-6],[23,-7],[26,-8],[29,-9],[32,-10],[35,-11],
        [38,-12],[41,-13],[44,-14],[47,-15],[50,-16],[53,-17],[56,-18],[59,-19],
        [60,-20],[63,-21],[66,-22],[70,-23],[73,-24],[77,-25]
    ], -26); // 60=-20；61~63=-21；64~66=-22；67~70=-23；71~73=-24；74~77=-25；78+=-26
}
function getDexER(dex) {
    return Math.floor(Math.min(dex, 60) / 2); // ER = floor(敏捷/2)；敏捷超過60以60計，上限+30
}

// ---------- 智力 INT：魔法傷害 / 魔法命中 / 魔法爆擊率 / 額外魔法點數 / MP消耗減少 ----------
function getIntMagicDmg(int) {
    return lookupStep(int, [
        [14,0],[19,1],[24,2],[29,4],[34,5],[39,7],[44,8],[49,12],[54,13],[59,14],
        [60,15],[63,16],[66,17],[69,18],[72,20],[75,21],[77,22],[79,23]
    ], 25); // …67~69=+18；70~72=+20；73~75=+21；76~77=+22；78~79=+23；80+=+25
}
function getIntMagicHit(int) {
    return lookupStep(int, [
        [8,-4],[11,-3],[14,-2],[17,-1],[22,0],[24,1],[25,2],[28,3],[31,4],[34,5],
        [37,7],[40,8],[43,9],[44,10],[46,13],[49,14],[52,15],[55,16],[58,17],
        [60,18],[63,19],[66,20],[69,21],[72,22],[75,23],[79,24]
    ], 25); // …67~69=+21；70~72=+22；73~75=+23；76~79=+24；80+=+25
}
function getIntMagicCrit(int) {
    if (int <= 34) return 0;
    if (int <= 39) return 1;
    if (int <= 44) return 2;
    if (int <= 49) return 4;
    if (int <= 54) return 5;
    if (int <= 59) return 6;
    if (int <= 64) return 7;   // 60~64 = 7%
    if (int <= 69) return 8;   // 65~69 = 8%
    if (int <= 74) return 9;   // 70~74 = 9%
    if (int <= 79) return 10;  // 75~79 = 10%
    return 11;                 // 80+ = 11%
}
function getIntExtraMp(int) {
    return lookupStep(int, [
        [11,2],[15,3],[19,4],[23,5],[27,6],[31,7],[35,8],[39,9],[43,10],[47,11],
        [51,12],[55,13],[59,14],
        [60,15],[63,16],[66,17],[69,18],[72,20],[75,21],[77,23],[79,24]
    ], 25); // …67~69=+18；70~72=+20；73~75=+21；76~77=+23；78~79=+24；80+=+25
}
function getIntMpReduce(int) {
    // MP消耗減少 %
    return lookupStep(int, [
        [8,5],[10,6],[11,7],[13,8],[14,9],[16,10],[17,11],[19,12],[20,13],[22,14],
        [23,15],[25,16],[26,17],[28,18],[29,19],[31,20],[32,21],[34,22],[35,23],[37,24],
        [38,25],[40,26],[41,27],[43,28],[44,29]
    ], 30); // 45~60 = 30%
}

// ---------- 體質 CON：HP成長 / HP自然恢復量上限 / 藥水額外恢復% ----------
function getConGrowth(con, cls) {
    // 體質8 = 0；騎士/龍騎士每+1體質 +1.5；黑暗妖精/幻術士每+1體質 +0.5；法師/妖精每+1體質 +0.8
    let per = (cls === 'knight' || cls === 'dragon' || cls === 'warrior') ? 1.5 : ((cls === 'dark' || cls === 'illusion') ? 0.5 : (cls === 'royal' ? 0.75 : 0.8));
    return Math.max(0, con - 8) * per;
}
function getConHpRegenMax(con) {
    if (con < 11) return 0;
    return lookupStep(con, [
        [11,5],[13,6],[15,7],[17,8],[19,9],[21,10],[23,11],[24,12],[25,13],[27,14],
        [29,15],[31,16],[33,17],[34,18],[35,19],[37,20],[39,21],[41,22],[43,23],[44,24],
        [46,27],[48,28],[50,29],[52,30],[54,31],[55,32],[57,33],[59,34],
        [60,35],[63,36],[66,37],[69,38],[73,40],[76,42],[79,43]
    ], 45); // …67~69=1~38；70~73=1~40；74~76=1~42；77~79=1~43；80+=1~45
}
function getConPotionPct(con) {
    // 藥水額外恢復量 %
    if (con <= 19) return 0;
    if (con <= 24) return 1;
    if (con <= 30) return 2;
    if (con <= 35) return 3;
    if (con <= 40) return 4;
    if (con <= 45) return 5;
    if (con <= 50) return 6;
    if (con <= 55) return 7;   // 51~55 = +7%
    if (con <= 60) return 8;   // 56~60 = +8%
    if (con <= 65) return 9;   // 61~65 = +9%
    if (con <= 70) return 10;  // 66~70 = +10%
    if (con <= 74) return 11;  // 71~74 = +11%
    if (con <= 79) return 12;  // 75~79 = +12%
    return 13;                 // 80+ = +13%
}

// ---------- 精神 WIS：MP成長 / MP自然恢復量 / MR / 藍色藥水加成 ----------
function getWisGrowth(wis) {
    // 精神9 = 0；之後每+1精神 +0.5
    return Math.max(0, wis - 9) * 0.5;
}
function getWisMpRegen(wis) {
    return lookupStep(wis, [
        [9,1],[14,2],[19,3],[24,4],[29,6],[34,7],[39,9],[44,10],[49,14],[54,15],[59,17],
        [64,20],[69,21],[72,23],[75,24],[77,25],[79,26]
    ], 27); // …65~69=21；70~72=+23；73~75=+24；76~77=+25；78~79=+26；80+=+27
}
function getWisMpOnKill(wis) {
    // 精神(WIS)：擊殺敵人時立即額外恢復的 MP 量
    if (wis >= 79) return 16;  // 79+
    if (wis >= 76) return 15;  // 76~78
    if (wis >= 73) return 14;  // 73~75
    if (wis >= 70) return 13;  // 70~72
    if (wis >= 67) return 12;  // 67~69
    if (wis >= 64) return 11;  // 64~66
    if (wis >= 60) return 10;  // 60~63
    if (wis >= 53) return 9;   // 53~59
    if (wis >= 45) return 8;   // 45~52
    if (wis >= 38) return 7;   // 38~44
    if (wis >= 30) return 6;   // 30~37
    if (wis >= 25) return 5;   // 25~29
    if (wis >= 20) return 3;   // 20~24
    if (wis >= 15) return 2;   // 15~19
    if (wis >= 11) return 1;   // 11~14
    return 0;                  // 7~10（含以下）
}
function getWisMR(wis) {
    // 精神7~10 = 0；11 = +4；之後每精神+1 MR+4；精神超過60以60計（上限 +200）
    if (wis <= 10) return 0;
    return (Math.min(wis, 60) - 10) * 4;
}
function getWisBlueBonus(wis) {
    // 藍色藥水：提升MP自然恢復量
    return lookupStep(wis, [
        [11,1],[13,2],[15,3],[17,4],[19,5],[21,6],[23,7],[24,8],[25,9],[27,10],
        [29,11],[31,12],[33,13],[34,14],[35,15],[37,16],[39,17],[41,18],[43,19],[44,20],
        [46,23],[48,24],[50,25],[52,26],[54,27],[55,28],[57,29],[59,30],
        [60,31],[63,32],[66,33],[69,34],[71,35],[74,36],[77,37],[79,38]
    ], 40); // …67~69=+34；70~71=+35；72~74=+36；75~77=+37；78~79=+38；80+=+40
}

// 🔒 戰鬥日誌捲動鎖定：玩家向上捲動查看舊訊息時，鎖定自動捲到底（避免新訊息把畫面拉走）；
//    捲回接近底部則自動解除。鎖定期間保留量加大（150 行），確保往上看得到更多歷史。
let _combatLogLocked = false;
const COMBAT_LOG_MAX = 50;          // 一般保留行數
const COMBAT_LOG_MAX_LOCKED = 150;  // 鎖定捲動時的加大保留量
function _combatLogIsAtBottom(el) { return (el.scrollHeight - el.scrollTop - el.clientHeight) < 24; }
function combatLogToBottom() {
    let el = document.getElementById('combat-log');
    if (!el) return;
    _combatLogLocked = false;
    el.scrollTop = el.scrollHeight;
    let btn = document.getElementById('combat-log-unlock'); if (btn) btn.classList.add('hidden');
}
function initCombatLogLock() {
    let el = document.getElementById('combat-log');
    if (!el || el._lockInit) return;
    el._lockInit = true;
    let onScroll = () => {
        let btn = document.getElementById('combat-log-unlock');
        if (_combatLogIsAtBottom(el)) {            // 回到底部：自動解除鎖定
            if (_combatLogLocked) { _combatLogLocked = false; if (btn) btn.classList.add('hidden'); }
        } else {                                    // 離開底部（向上看）：鎖定
            if (!_combatLogLocked) { _combatLogLocked = true; if (btn) btn.classList.remove('hidden'); }
        }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('touchmove', onScroll, { passive: true });
}

// ⚡ 快速強化（批次強化）狀態：wpn=武器分頁、arm=防具分頁（含飾品）。sel 為 uid→true 的勾選集合。
let quickEnh = { wpn: { active: false, target: 6, sel: {} }, arm: { active: false, target: 6, sel: {} } };
// 🗑️ 快速廢品（批次標記廢品）狀態：wpn/arm/item 三分頁；啟用時預先勾選「已是廢品」者。sel 為 uid→true。（與快速強化同分頁互斥）
let quickJunk = { wpn: { active: false, sel: {}, known: {} }, arm: { active: false, sel: {}, known: {} }, item: { active: false, sel: {}, known: {} } };   // known＝面板開啟時(及之後同步)已納入的物品 uid，避免「面板開啟後才掉落的廢品」於確認時被誤取消標記

// ===== ⚔️ 戰鬥日誌來源過濾（敵人/玩家/傭兵/召喚/夥伴）=====
// _combatSrc：目前正在記錄的戰鬥訊息來源，由各攻擊派發點設定；為 null 時依顏色 type 推定（'enemy'→敵人，其餘→玩家）。
let _combatSrc = null;
const COMBAT_FILTER_KEY = 'lineage_idle_combat_filter';
let _combatFilter = { enemy: true, player: true, mercenary: true, summon: true, pet: true };
(function(){ try { let s = localStorage.getItem(COMBAT_FILTER_KEY); if (s) { let o = JSON.parse(s); for (let k in _combatFilter) if (typeof o[k] === 'boolean') _combatFilter[k] = o[k]; } } catch(e){} })();
function saveCombatFilter(){ try { localStorage.setItem(COMBAT_FILTER_KEY, JSON.stringify(_combatFilter)); } catch(e){} }
function applyCombatFilter(){
    let el = document.getElementById('combat-log');
    if (el) for (let k in _combatFilter) el.classList.toggle('cf-hide-' + k, !_combatFilter[k]);   // 以 CSS class 隱藏 → 既有與未來訊息一併套用，重新點亮即還原
    for (let k in _combatFilter) { let b = document.getElementById('cf-btn-' + k); if (b) b.classList.toggle('cf-off', !_combatFilter[k]); }   // 按鈕點亮/點暗
    { let sb = document.getElementById('cf-btn-status'); if (sb) sb.classList.toggle('cf-off', !_showMobStatus); }   // 🩹 狀態顯示鈕點亮/點暗（與過濾列同步初始化）
    { let hb = document.getElementById('cf-btn-hp'); if (hb) hb.classList.toggle('cf-off', !_showMobHp); }   // 🩸 血量顯示鈕點亮/點暗
}
function toggleCombatFilter(k){ if (!(k in _combatFilter)) return; _combatFilter[k] = !_combatFilter[k]; saveCombatFilter(); applyCombatFilter(); }
// 🩹 怪物異常狀態/出血鈍擊等標示顯示開關（按鈕在戰鬥日誌過濾列最左·點暗即隱藏怪卡上的狀態徽章與狀態列；頭目/席琳恩賜標籤不受影響）
let _showMobStatus = true;
(function(){ try { let s = localStorage.getItem('lineage_idle_mob_status'); if (s !== null) _showMobStatus = (s === '1'); } catch(e){} })();
function toggleMobStatus(){ _showMobStatus = !_showMobStatus; try { localStorage.setItem('lineage_idle_mob_status', _showMobStatus ? '1' : '0'); } catch(e){} let b = document.getElementById('cf-btn-status'); if (b) b.classList.toggle('cf-off', !_showMobStatus); renderMobs(); }
// 🩸 怪物血量條顯示開關（按鈕在「狀態」左側·點亮才在怪卡顯示短血條；預設關閉＝沿用無血條的乾淨版面）
let _showMobHp = false;
(function(){ try { let s = localStorage.getItem('lineage_idle_mob_hp'); if (s !== null) _showMobHp = (s === '1'); } catch(e){} })();
function toggleMobHp(){ _showMobHp = !_showMobHp; try { localStorage.setItem('lineage_idle_mob_hp', _showMobHp ? '1' : '0'); } catch(e){} let b = document.getElementById('cf-btn-hp'); if (b) b.classList.toggle('cf-off', !_showMobHp); renderMobs(); }

function logCombat(msg, type="player", src=null) {
    if(state.ff) return; // 補跑期間不洗版
    const el = document.getElementById('combat-log');
    let colorClass = "text-white";
    
    // 單純以顏色區分，移除前綴標籤
    let catClass = "";   // 🎯 三大分類左色條：玩家一般攻擊(藍)／玩家技能(紫)／敵人傷害(紅)
    if (type === "player") { colorClass = "text-blue-300"; catClass = "log-cat-attack"; } // 我方普攻 (淺藍)
    else if (type === "player-heavy") { colorClass = "text-yellow-300 font-bold"; catClass = "log-cat-attack"; } // 我方重擊 (黃色粗體)
    else if (type === "player-crit") { colorClass = "crit-hit"; catClass = "log-cat-attack"; } // 我方爆擊 (顯眼鮮紅＋微光：僅保留給爆擊／含爆擊訊息)
    else if (type === "player-special") { colorClass = "text-orange-300"; catClass = "log-cat-attack"; } // 我方特殊效果/寵物等非爆擊傷害 (沉穩橘色，較不搶眼)
    else if (type === "player-graze") { colorClass = "text-blue-200/80"; catClass = "log-cat-attack"; } // 我方擦傷 (較亮的淡藍，灰底上仍清楚)
    else if (type === "skill") { colorClass = "text-purple-300"; catClass = "log-cat-skill"; } // 🟣 我方技能傷害 (紫色＋紫左條)
    else if (type === "enemy") { colorClass = "text-red-400"; catClass = "log-cat-enemy"; } // 敵方攻擊 (紅色＋紅左條)
    else if (type === "dot") { colorClass = "text-green-300"; catClass = "log-cat-dot"; } // 🟢 我方持續傷害/DoT (綠色＋綠左條：火牢/冰雪颶風/立方燃燒/中毒/出血/猛爆劇毒等週期傷害)
    else if (type === "magic") { colorClass = "text-cyan-300"; } // 魔法效果/法系觸發 (青色·非主動施放技能)
    else if (type === "heal") { colorClass = "text-green-300"; } // 恢復效果 (綠色)
    else if (type === "miss" || type === "dodge") { colorClass = "text-slate-200"; } // 未命中/閃避 (淺灰，避免與灰底相近)
    else if (type === "evade") { colorClass = "text-teal-300"; } // ER獨立迴避 (淡青綠色)

    let _src = src || _combatSrc || (type === 'enemy' ? 'enemy' : 'player');   // 來源：明確指定 > 派發點情境(_combatSrc) > 依顏色type推定
    el.insertAdjacentHTML('beforeend', `<div class="log-entry ${colorClass} ${catClass}" data-src="${_src}">${msg}</div>`);   // 🚀 只解析新訊息、不重建整個日誌(原 innerHTML+= 會 O(n) 重建全部子節點，戰鬥洗版時造成卡頓)
    // 🔒 鎖定捲動時保留更多歷史；未鎖定時維持一般上限
    let _max = _combatLogLocked ? COMBAT_LOG_MAX_LOCKED : COMBAT_LOG_MAX;
    while(el.children.length > _max && el.children.length > 1) el.removeChild(el.firstChild);
    if(!_combatLogLocked) el.scrollTop = el.scrollHeight;   // 鎖定時不自動捲到底，保留玩家檢視位置
}

// 🔒 系統與物品日誌捲動鎖定：與戰鬥日誌相同（向上捲動鎖定刷新、保留 150 行、捲回底部自動解除）
let _sysLogLocked = false;
const SYS_LOG_MAX = 50;           // 一般保留行數
const SYS_LOG_MAX_LOCKED = 150;   // 鎖定捲動時的加大保留量
function sysLogToBottom() {
    let el = document.getElementById('sys-log');
    if (!el) return;
    _sysLogLocked = false;
    el.scrollTop = el.scrollHeight;
    let btn = document.getElementById('sys-log-unlock'); if (btn) btn.classList.add('hidden');
}
function initSysLogLock() {
    let el = document.getElementById('sys-log');
    if (!el || el._lockInit) return;
    el._lockInit = true;
    let onScroll = () => {
        let btn = document.getElementById('sys-log-unlock');
        if ((el.scrollHeight - el.scrollTop - el.clientHeight) < 24) {   // 回到底部：自動解除鎖定
            if (_sysLogLocked) { _sysLogLocked = false; if (btn) btn.classList.add('hidden'); }
        } else {                                                          // 離開底部（向上看）：鎖定
            if (!_sysLogLocked) { _sysLogLocked = true; if (btn) btn.classList.remove('hidden'); }
        }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('touchmove', onScroll, { passive: true });
}

function logSys(msg) {
    if(state.ff) return; // 補跑期間不洗版
    const el = document.getElementById('sys-log');
    el.insertAdjacentHTML('beforeend', `<div class="log-entry text-slate-100">${msg}</div>`);   // 🚀 同戰鬥日誌：只解析新訊息，避免 innerHTML+= 重建全部
    // 🔒 鎖定捲動時保留更多歷史（150 行）；未鎖定時維持一般上限（50 行）
    let _max = _sysLogLocked ? SYS_LOG_MAX_LOCKED : SYS_LOG_MAX;
    while(el.children.length > _max && el.children.length > 1) el.removeChild(el.firstChild);
    if(!_sysLogLocked) el.scrollTop = el.scrollHeight;   // 鎖定時不自動捲到底，保留玩家檢視位置
}

// 🔧 架構#4：calcStats 職責拆分 ——
// recomputeStats()：純數值重算（屬性/裝備/套裝/變身/buff → player.d），含「裝備授予技能」同步，無畫面副作用。
// calcStats()：維持原有對外介面 = recomputeStats() + UI 刷新（applyElfBorder/updateUI），既有呼叫點行為不變。
// 不需要刷畫面的場合（如 buildAlly 換身重算）請呼叫 recomputeStats()。
// ===== 🔧 負重系統：計入負重的裝備欄位 + 物品重量表（依名稱）=====
const WEIGHT_COUNT_SLOTS = ['wpn','offwpn','shield','helm','armor','tshirt','cloak','gloves','boots','amulet','ear1','ear2','ring1','ring2','ring3','ring4','belt','pet'];   // ⚔️ offwpn=迅猛雙斧副手武器，計入負重；ear1/ear2=耳環
const ITEM_WEIGHTS = {"混沌之刺":10,"混沌頭盔":5,"混沌斗篷":5,"混沌法袍":15,"混沌手套":5,"死亡斗篷":10,"死亡盔甲":100,"死亡手套":5,"死亡之盾":20,"惡魔王矛":20,"惡魔王雙刀":20,"惡魔王雙手劍":40,"惡魔王魔杖":20,"惡魔王弓":10,"亞連":10,"武士刀":40,"長劍":40,"斧":60,"雙手劍":150,"屠龍劍":180,"騎士范德之劍":100,"釘錘":30,"弓":30,"矛":80,"戰斧":120,"巴迪須":120,"柴刀":120,"精靈弓":30,"歐西斯弓":30,"闊劍":70,"木棒":30,"精靈匕首":10,"歐西斯匕首":10,"匕首":10,"貝卡合金":100,"法丘":60,"弗萊爾":15,"闊矛":75,"吉薩":80,"戟":150,"槍":180,"露西錘":150,"戰錘":50,"流星錘":120,"帕提森":80,"彎刀":40,"侏儒戰斧":280,"精靈之矛":30,"歐西斯之矛":30,"小侏儒短劍":40,"精靈短劍":20,"歐西斯短劍":30,"短劍":30,"三叉戟":25,"瑟魯基之劍":120,"尤米弓":40,"短弓":20,"十字弓":50,"獵人之弓":30,"熾炎天使弓":25,"紅騎士之劍":40,"侵略者之劍":40,"骰子匕首":10,"大馬士革刀":45,"短劍的劍身":20,"長劍的劍身":30,"奧里哈魯根的劍身":35,"細劍":60,"鎖子甲破壞者":40,"銀長劍":50,"銀劍":40,"橡木魔法杖":15,"美基魔法杖":20,"巫術魔法杖":15,"力量魔法杖":15,"瑪那魔杖":15,"水晶魔杖":15,"失去魔力的巴列斯魔杖":15,"巴列斯魔杖":15,"潘的角":9,"覆上米索莉的角":24,"覆上奧里哈魯根的角":55,"巨斧":250,"狂戰士斧":200,"銀斧":270,"青銅鋼爪":20,"鋼鐵鋼爪":30,"暗影鋼爪":30,"銀光鋼爪":20,"黑暗鋼爪":20,"幽暗鋼爪":30,"大馬士革鋼爪":40,"青銅雙刀":20,"鋼鐵雙刀":30,"銀光雙刀":20,"幽暗雙刀":30,"黑暗雙刀":20,"暗影雙刀":30,"大馬士革雙刀":40,"黑暗十字弓":30,"幽暗十字弓":40,"魔力短劍":30,"拉斯塔巴德十字弓":70,"拉斯塔巴德弓":50,"小武士刀":30,"拉斯塔巴德長劍":30,"拉斯塔巴德短劍":20,"拉斯塔巴德魔杖":15,"拉斯塔巴德雙刀":40,"拉斯塔巴德重十字弓":100,"拉斯塔巴德矛":80,"拉斯塔巴德圓盾":50,"武官雙手劍":150,"武官手套":45,"武官長靴":54,"黑暗腰帶":40,"精靈皮盔":3,"歐西斯頭盔":30,"侏儒鐵盔":40,"頭盔":30,"騎士面甲":40,"抗魔法頭盔":35,"艾爾穆的祝福":13,"治癒魔法頭盔":50,"敏捷魔法頭盔":50,"力量魔法頭盔":50,"皮帽子":10,"銀釘皮帽":20,"皮頭盔":30,"骷髏頭盔":30,"鋼鐵頭盔":50,"法師之帽":20,"死亡騎士頭盔":50,"木乃伊王的王冠":20,"精靈敏捷頭盔":13,"精靈體質頭盔":13,"騎士頭巾":0,"紅騎士頭巾":20,"巴土瑟之帽":20,"卡士柏之帽":20,"馬庫爾之帽":20,"西瑪之帽":20,"克特頭盔":50,"淨化頭飾":0,"金屬盔甲":450,"水晶盔甲":350,"青銅盔甲":450,"藤甲":400,"皮甲":350,"鏈甲":300,"歐西斯鏈甲":300,"鱗甲":250,"銀釘皮甲":150,"環甲":250,"歐西斯環甲":250,"小藤甲":70,"皮夾克":30,"抗魔法鏈甲":300,"綿質長袍":10,"木甲":80,"精靈護胸金屬板":100,"精靈金屬盔甲":250,"精靈鏈甲":150,"木製的夾克":40,"皮背心":30,"皮盔甲":50,"銀釘皮背心":130,"硬皮背心":150,"骷髏盔甲":150,"鋼鐵金屬盔甲":470,"法師長袍":60,"水龍鱗盔甲":300,"地龍鱗盔甲":300,"火龍鱗盔甲":300,"風龍鱗盔甲":300,"死亡騎士盔甲":250,"黑長者長袍":30,"克特盔甲":250,"T恤":5,"精靈T恤":5,"精靈斗篷":10,"歐西斯斗篷":10,"侏儒斗篷":10,"保護者斗篷":10,"隱身斗篷":10,"抗魔法斗篷":10,"瑪那斗篷":10,"短統靴":10,"長靴":15,"巴列斯長靴":10,"皮涼鞋":8,"銀釘皮涼鞋":10,"皮長靴":10,"鋼鐵長靴":50,"深水長靴":15,"死亡騎士長靴":15,"黑長者涼鞋":10,"克特長靴":15,"手套":10,"水晶手套":20,"腕甲":10,"力量手套":18,"鋼鐵手套":40,"死亡騎士手套":15,"影子手套":10,"影子面具":10,"影子長靴":10,"拉斯塔巴德皮盔甲":70,"拉斯塔巴德長靴":10,"黑暗斗篷":20,"拉斯塔巴德長袍":30,"克特手套":15,"保護者手套":10,"小盾牌":30,"精靈盾牌":50,"阿克海盾牌":50,"大盾牌":100,"侏儒圓盾":100,"反射之盾":50,"伊娃之盾":50,"塔盾":120,"木盾":25,"銀騎士之盾":100,"皮盾牌":25,"銀釘皮盾":35,"骷髏盾牌":30,"紅騎士盾牌":50,"鋼鐵盾牌":140,"受詛咒的魔法書":0,"魔法能量之書":20,"傳送控制戒指":3,"變形控制戒指":3,"召喚控制戒指":3,"地靈戒指":3,"水靈戒指":3,"風靈戒指":3,"火靈戒指":3,"抗魔戒指":3,"滅魔戒指":3,"多羅戒指":3,"守護戒指":3,"長者戒指":3,"力量項鍊":5,"敏捷項鍊":5,"體質項鍊":5,"智力項鍊":5,"精神項鍊":5,"妖魔戰士項鍊":5,"守護項鍊":3,"長老項鍊":3,"抗魔項鍊":3,"老舊的身體腰帶":50,"老舊的精神腰帶":50,"老舊的靈魂腰帶":50,"身體腰帶":50,"精神腰帶":50,"靈魂腰帶":50,"多羅皮帶":50,"歐吉皮帶":50,"勇敢皮帶":50,"光明身體腰帶":50,"光明精神腰帶":50,"光明靈魂腰帶":50,"守護皮帶":50,"抗魔皮帶":50,"魔獸軍王之爪":100,"巴蘭卡鋼爪":40,"武官頭盔":45,"巴蘭卡頭盔":50,"武官護鎧":180,"巴蘭卡盔甲":450,"巴蘭卡手套":5,"魔獸軍王長靴":30,"巴蘭卡長靴":10,"冥法軍王斗篷":10,"法令軍王長袍":20,"暗殺軍王手套":25,"血色巨劍":160,"黑暗之劍":100,"紅水晶魔杖":60,"神官頭飾":18,"神官法袍":45,"黑暗披肩":20,"神官長靴":18,"神官斗篷":9,"神官手套":18,"死亡騎士的烈炎之劍":40,"克特之劍":40,"巨蟻女皇的金翅膀":1,"巨蟻女皇的銀翅膀":1,"暗殺軍王之痕":20,"神官魔杖":70,"蕾雅魔杖":15,"神官魔法書":27,"冥法軍王之戒":5,"蕾雅長袍":30,"蕾雅項鍊":5,"法令軍王之鍊":5,"蕾雅戒指":1,"冰之女王魔杖":20,"惡魔鐮刀":10,"魅力項鍊":5,"艾莉絲項鍊":5,"梅杜莎盾牌":80,"水晶短劍":45,"潔尼斯戒指":1,"地屬性斗篷":20,"水屬性斗篷":20,"火屬性斗篷":20,"風屬性斗篷":20,"黑暗長靴":15,"黑暗頭飾":5,"幻象眼魔的心眼":50,"馬昆斯斗篷":15,"銀光斗篷":30,"巫妖斗篷":30,"惡魔盔甲":250,"惡魔頭盔":50,"惡魔手套":15,"惡魔長靴":15,"暗黑雙刀":40,"暗黑鋼爪":40,"暗黑十字弓":50,"死神之手":30,"地靈手套":18,"風靈手套":18,"水靈手套":18,"火靈手套":18,"曼波帽子":10,"曼波外套":10,"金屬蜈蚣皮盔甲":250,"黑暗棲林者盔甲":30,"黑暗棲林者長靴":10,"黑虎皮斗篷":5,"狼皮斗篷":5,"熊戒指":3,"深淵戒指":3,"米索莉短劍":50,"奧里哈魯根短劍":50,"深紅長矛":100,"惡魔斧頭":180,"復仇之劍":40,"恨之鋼爪":30,"惡魔之劍":40,"惡魔雙刀":40,"惡魔鋼爪":30,"惡魔十字弓":30,"失去魔力的巴風特魔杖":15,"巴風特魔杖":15,"巴風特盔甲":30,"炎魔的血光斗篷":10,"墮落斗篷":10,"墮落長袍":25,"墮落手套":18,"墮落長靴":10,"黑焰之劍":50,"赤焰之弓":30,"赤焰之劍":40,"瑪那水晶球":50,"死亡之指":20,"獵犬之牙":60,"鋼鐵之牙":50,"破滅之牙":150,"勝利之牙":100,"守護者臂甲":30,"法師臂甲":30,"體力臂甲":30,"巨劍":150,"牛人斧頭":250,"沙哈之弓":30,"風之頭盔":50,"黑暗妖精頭箍":30,"黑暗妖精鱗甲":60,"黑暗妖精涼鞋":30,"哈維戒指":3,"古代神射臂甲":30,"古代鬥士臂甲":30,"古老的劍":30,"古老的巨劍":70,"古老的弩槍":30,"古老的金屬盔甲":280,"古老的鱗甲":200,"古老的皮盔甲":180,"古老的長袍":30,"古代神之槍":40,"古代神之斧":40,"古代黑暗妖精之劍":20,"古代妖精弩槍":30,"隱藏的魔族之劍":35,"隱藏的魔族弓箭":35,"隱藏的魔族魔杖":35,"隱藏的魔族鋼爪":35,"隱藏的魔族鎖鏈劍":35,"隱藏的魔族奇古獸":35,"泰坦皮帶":50,"古代巨人戒指":50,"黑曜石奇古獸":10,"冥想奇古獸":35,"共鳴奇古獸":35,"寒冰奇古獸":35,"藍寶石奇古獸":10,"幻術士魔杖":15,"幻術士法書":30,"幻術士斗篷":10,"龍騎士雙手劍":80,"消滅者鎖鏈劍":50,"破滅者鎖鏈劍":50,"嗜血者鎖鏈劍":50,"共鳴鎖鏈劍":80,"寒冰鎖鏈劍":80,"龍鱗臂甲":30,"龍騎士斗篷":18,"底比斯歐西里斯弓":5,"底比斯歐西里斯雙刀":30,"底比斯歐西里斯雙手劍":100,"底比斯歐西里斯魔杖":100,"底比斯歐西里斯腰帶":50,"底比斯賀洛斯戒指":5,"底比斯阿努比斯戒指":5,"試煉斧頭":100,"大匠的斧頭":50,"戰士團頭盔":30,"戰士團斗篷":15,"神聖執行團的頭盔":30,"神聖執行團的斗篷":15,"魔物的斧頭":100,"鐵斧頭":100,"巨人的斧頭":100,"歐林的項鍊":1,"西瑪戒指":1,"黃金權杖":50,"紅色斗篷":10,"君主的威嚴":10,"守護者的戒指":3,"冰之女王魅力頭飾":10,"冰之女王魅力禮服":30,"冰之女王魅力涼鞋":30,"寒冰頭盔":45,"寒冰盔甲":100,"寒冰長靴":45,"破壞雙刀":40,"破壞鋼爪":35,"血紅慾望短劍":20,"榮耀之劍":50,"短刀":50,"海賊彎刀":60,"深淵雙刀":20,"漆黑水晶球":15,"寂靜十字弓":50,"信念之盾":50,"藍海賊長靴":15,"藍海賊頭巾":15,"藍海賊皮盔甲":150,"藍海賊手套":15,"藍海賊斗篷":10,"詛咒的紅色耳環":1,"詛咒的藍色耳環":1,"詛咒的綠色耳環":1,"淨化之耳環":15,"冰之女王的耳環 Lv0":5,"冰之女王的耳環 Lv1":5,"冰之女王的耳環 Lv2":5,"冰之女王的耳環 Lv3":5,"冰之女王的耳環 Lv4":5,"冰之女王的耳環 Lv5":5,"冰之女王的耳環 Lv6":5,"冰之女王的耳環 Lv7":5,"冰之女王的耳環 Lv8 力量":5,"冰之女王的耳環 Lv8 敏捷":5,"冰之女王的耳環 Lv8 智力":5,"冰之女王的耳環 Lv8 體質":5,"冰之女王的耳環 Lv8 精神":5,"冰之女王的耳環 Lv8 魅力":5,"受詛咒的鑽石戒指":1,"受詛咒的紅寶石戒指":1,"受詛咒的藍寶石戒指":1,"受詛咒的綠寶石戒指":1,"智慧耳環":3,"真實耳環":3,"支配耳環":3,"憤怒耳環":3,"勇猛耳環":3,"不死耳環":3,"熱情耳環":3,"名譽耳環":3,"寬容耳環":3,"舞動耳環":15,"雙子耳環":15,"慶典耳環":15,"絕頂耳環":15,"暴走耳環":15,"幻魔耳環":15,"族群耳環":15,"奴隸耳環":15,"尖刺雙刀":30,"武官之刃":120,"武官斗篷":9,"黑暗手套":10,"真．冥皇執行劍":100,"風刃短劍":60,"紅影雙刀":50,"獸王鋼爪":70,"聖晶魔杖":60,"魔力戒指":3,"力量戒指":3,"敏捷戒指":3,"知識戒指":3,"火精靈的皮帶":50,"水精靈的皮帶":50,"地精靈的皮帶":50,"風精靈的皮帶":50};
function getLoadColor(tier){ return ['text-white','text-yellow-400','text-orange-400','text-red-500'][tier||0]; }

// ===== 🔧 強化系統：上限與分段加成（武器+20 / 防具+15 / 飾品+10）=====
//  +0~+10 維持原本「每階 +1」線性；+11 起在「+10 的量」之上再加下表（表值＝超過 +10 的額外部分）。
//  名稱一律顯示 +N（夾擠至上限：武器+20/防具+15/飾品+5；過往超過上限資料以上限顯示與套用，見 getItemFullName / capEn）。
const ENHANCE_CAP = { wpn: 20, arm: 15, acc: 5 };
function enhanceCap(d) { return (d && ENHANCE_CAP[d.type]) || 10; }                          // 依物品類型取強化上限
function isMaxEnhanced(item) { let d = DB.items[item.id]; return !!d && (Number(item.en) || 0) >= enhanceCap(d); }
// 🔧 強化值上限夾擠：凡「隨強化提升」的基本能力與特效（額外傷害/命中、MP自然恢復、吸取MP、觸發機率、特效傷害…）
//    一律以淬鍊上限計算——武器超過 +20 以 +20 計、防具超過 +15 以 +15 計、飾品超過 +5 以 +5 計。
function capEn(en, d) { return Math.min(Math.max(0, Number(en) || 0), enhanceCap(d)); }
function capWpnEn(en) { return Math.min(Math.max(0, Number(en) || 0), ENHANCE_CAP.wpn); }   // 武器專用（上限 +20）
// 武器強化 → { dmg:額外傷害, hit:額外命中 }
//  +0~+10：每階 額外傷害+1、額外命中+1（線性）。
//  +11~+20：取消額外傷害加成（額外傷害維持在 +10 的量＝10）；額外命中沿用「累積」（在 +10 之上再加下表）；
//           傷害成長改由「最終傷害倍率」提供（enhanceWpnFinalMult，非累加、取該階段數值）。
const WPN_EN_HIT_OVER10 = { 11:1, 12:2, 13:4, 14:6, 15:8, 16:11, 17:14, 18:17, 19:21, 20:25 };   // +11~+20 額外命中（超過 +10 的「累加」量；每階增量 1,1,2,2,2,3,3,3,4,4 逐級累加 → 總命中 +11/+12/+14/+16/+18/+21/+24/+27/+31/+35）
function enhanceWpnBonus(en) {
    en = Math.max(0, Number(en) || 0);
    let base = Math.min(en, 10);                                                            // +10 以內：每階 +1（額外傷害/命中共用）
    let hitOver = (en > 10) ? (WPN_EN_HIT_OVER10[Math.min(en, 20)] || 0) : 0;               // +11~+20：額外命中累積
    return { dmg: base, hit: base + hitOver };                                              // 額外傷害封頂於 10（+11 起不再加）
}
// 武器強化 → 最終傷害倍率（一般物理攻擊）；+11~+20「取該階段數值」（非累加），+10 以內為 1.0
const WPN_EN_FINALMULT = { 11:1.1, 12:1.2, 13:1.3, 14:1.4, 15:1.5, 16:1.6, 17:1.7, 18:1.8, 19:1.9, 20:2.0 };
function enhanceWpnFinalMult(en) {
    en = Math.max(0, Number(en) || 0);
    return (en > 10) ? (WPN_EN_FINALMULT[Math.min(en, 20)] || 1) : 1;
}
function wpnEnFinalMult(wpnInst) { return enhanceWpnFinalMult(wpnInst && wpnInst.en); }      // 由武器實例取倍率（未裝備→1）
// 防具強化 → AC 減免量（值越大防禦越好）；+11~+15 的表值為「超過 +10」的額外量
const ARM_EN_OVER10 = { 11:2, 12:4, 13:6, 14:8, 15:10 };   // 🔧 超過+10的「累計」額外AC；+11~+15 每階增量 +2（合計+10）→ AC 額外 12/14/16/18/20
function enhanceArmAc(en) {
    en = Math.max(0, Number(en) || 0);
    let base = Math.min(en, 10);
    let over = (en > 10) ? (ARM_EN_OVER10[Math.min(en, 15)] || 0) : 0;
    return base + over;
}

// ===== 🏛️ 傳統模式（傳統＝「經典之上」的子模式：創角須先勾經典才能再勾傳統）=====
//  傳統模式：所有裝備無強化選項（隱藏強化／快速強化），怪物不掉落＋黑市不販售施法卷軸；
//  取而代之——怪物掉落／潘朵拉黑市／製作 的武器/防具/飾品會「隨機自帶已強化值」（商店購買恆 +0）。
function traditionalActive(){ return !!(player && player.classicMode && player.traditionalMode); }
// 施法卷軸家族（武器/盔甲/飾品＋祝福_b/詛咒_c 變體）：傳統模式不掉落、黑市不上架
const TRAD_NO_SCROLLS = { scroll_weapon:1, scroll_armor:1, scroll_acc:1, scroll_weapon_b:1, scroll_armor_b:1, scroll_weapon_c:1, scroll_armor_c:1 };
// 掉落自帶強化值權重表：每筆 [強化值, 權重]；依「物品類型＋安定值 safe」選表
//  （實測全部物品 safe 僅出現 wpn{6,0}／arm{6,4,0}／acc{0}，下表完整涵蓋，無遺漏組合）
const TRAD_EN_TABLES = {
    wpn6: [[20,1],[19,3],[18,5],[17,7],[16,8],[15,10],[14,12],[13,13],[12,15],[11,17],[10,18],[9,20],[8,22],[7,23],[6,45],[5,47],[4,47],[3,47],[2,47],[1,47],[0,46]],
    wpn0: [[20,1],[19,3],[18,5],[17,7],[16,8],[15,10],[14,12],[13,13],[12,15],[11,17],[10,18],[9,20],[8,22],[7,23],[6,25],[5,27],[4,28],[3,30],[2,32],[1,33],[0,151]],
    arm6: [[15,1],[14,3],[13,5],[12,7],[11,8],[10,10],[9,12],[8,13],[7,15],[6,30],[5,30],[4,30],[3,30],[2,30],[1,30],[0,246]],
    arm4: [[15,1],[14,3],[13,5],[12,7],[11,8],[10,10],[9,12],[8,13],[7,15],[6,17],[5,18],[4,37],[3,37],[2,37],[1,37],[0,243]],
    arm0: [[15,1],[14,3],[13,5],[12,7],[11,8],[10,10],[9,12],[8,13],[7,15],[6,17],[5,18],[4,20],[3,22],[2,23],[1,25],[0,301]],
    acc0: [[5,1],[4,3],[3,5],[2,7],[1,8],[0,476]]
};
function _tradEnTableFor(d){
    if(!d) return null;
    let safe = d.safe || 0;
    if(d.type === 'wpn') return (safe >= 6) ? TRAD_EN_TABLES.wpn6 : TRAD_EN_TABLES.wpn0;
    if(d.type === 'arm') return (safe >= 6) ? TRAD_EN_TABLES.arm6 : (safe >= 4 ? TRAD_EN_TABLES.arm4 : TRAD_EN_TABLES.arm0);
    if(d.type === 'acc') return TRAD_EN_TABLES.acc0;
    return null;
}
// 傳統模式：依物品(類型,安定值)權重抽一個自帶強化值（夾擠至各類上限 wpn20/arm15/acc5）
function rollTraditionalEnhance(d){
    let tbl = _tradEnTableFor(d);
    if(!tbl) return 0;
    let total = 0; for(let e of tbl) total += e[1];
    let r = Math.random() * total, acc = 0, lvl = 0;
    for(let e of tbl){ acc += e[1]; if(r < acc){ lvl = e[0]; break; } }
    return capEn(lvl, d);
}
