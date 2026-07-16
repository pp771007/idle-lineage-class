/*
 * afk-extradata.js — 小百科(afk-wiki) 與 掉落查詢(afk-dex) 共用的「手動補充」資料。
 *
 * 純資料外掛:只定義全域 window.AFK_EXTRA,不掛 DOM、不依賴遊戲函式、最先載入。
 * 讀的人(dex/wiki)都自己判斷存在與否 → 這支沒載到時兩邊照常運作,只是少了手動補充(優雅降級)。
 *
 * 維護原則(重要):
 *   只放「無法從遊戲 DB 動態算」的手動補充。能動態算的別搬進來——
 *   製作配方讀 CRAFT_RECIPES / DEMONKING_RECIPES、掉落讀 MOB_DROPS、數值讀 DB.items、
 *   召喚分級讀 summonTierByLevel…那些維持各自動態讀取,免得這份清單變一堆會過時的死資料。
 *
 * 以後要補一件裝備的取得方式 / 一個法術的白話,改這一支就好,dex 跟 wiki 兩邊同時生效。
 */
(function () {
  window.AFK_EXTRA = {

    // ── 🗺️ 統一地圖名解析（唯一一份；afk-dex / afk-wiki / js/offline.js(核心) / afk-slotinfo 都呼叫這份）──
    //   涵蓋：風木地監、遺忘之島、時空裂痕、隱藏狩獵區域(HIDDEN_AREA_NAMES)、攀登(pride_fN / pride_a_b)、
    //   選單地圖(MAP_CATEGORIES)、攻城(SIEGE_CITY)、村莊(DB.towns)；查不到回 id。
    //   ⭐ 以後作者新增「不在 MAP_CATEGORIES 的地圖類型」只要改這一處，四支外掛同時生效（免再逐份補）。
    //   讀的是遊戲執行期全域，外掛載入順序不影響（呼叫時才求值）。
    mapName: function (id) {
      try {
        if (!id || typeof id !== 'string') return id || '?';
        if (id === 'afk_dummy') return '木人場';   // 🥊 木人場(afk-training 外掛假地圖):選角畫面/離線摘要等顯示中文,不露 afk_dummy
        if (id === 'windwood_dungeon') return '風木地監';
        if (id === 'oblivion_island') return '遺忘之島';
        if (id === 'oblivion_travel') return '遺忘之島途中';
        if (id === 'rift_battle') return '時空裂痕';
        if (typeof SANCTUARY_MAP_NAMES !== 'undefined' && SANCTUARY_MAP_NAMES[id]) return SANCTUARY_MAP_NAMES[id];   // 🌑 黑暗妖精聖地 3 隱藏圖（js/11 定義）
        if (typeof HIDDEN_AREA_NAMES !== 'undefined' && HIDDEN_AREA_NAMES[id]) return HIDDEN_AREA_NAMES[id];   // 🏛️ 隱藏狩獵區域
        var pf = /^pride_f(\d+)$/.exec(id); if (pf) return '傲慢之塔 ' + pf[1] + ' 樓';
        var pr = /^pride_(\d+)_(\d+)$/.exec(id); if (pr) return '傲慢之塔 ' + pr[1] + '~' + pr[2] + ' 樓（直接挑戰）';
        if (typeof MAP_CATEGORIES !== 'undefined') {
          for (var c in MAP_CATEGORIES) { var l = MAP_CATEGORIES[c]; for (var i = 0; i < l.length; i++) if (l[i].v === id) return l[i].t; }
        }
        if (typeof SIEGE_CITY !== 'undefined') {
          for (var k in SIEGE_CITY) { var s = SIEGE_CITY[k]; if (s.outer === id) return s.outerName; if (s.inner === id) return s.innerName; if (s.castle === id) return s.castleName; }
        }
        if (typeof DB !== 'undefined' && DB.towns && DB.towns[id]) return DB.towns[id].n;
      } catch (e) {}
      return id;
    },

    // ── 🗺️ 地圖所屬「領域」(新版地圖選單左側分組;讀 MAP_REGIONS)；查不到(隱藏區/攻城等)回 '' ──
    mapRegion: function (id) {
      try {
        if (id && typeof MAP_REGIONS !== 'undefined') {
          for (var i = 0; i < MAP_REGIONS.length; i++) {
            var r = MAP_REGIONS[i], ms = r.maps || [];
            for (var j = 0; j < ms.length; j++) if (ms[j].v === id) return r.label;
          }
        }
      } catch (e) {}
      return '';
    },
    // ── 地圖名前面帶「領域」(地圖改版後給新人找圖用):「領域·地圖名」；無領域就只回名 ──
    mapNameWithRegion: function (id) {
      var nm = this.mapName(id), reg = this.mapRegion(id);
      return (reg && reg !== nm) ? (reg + '·' + nm) : nm;   // 領域名與地圖名相同(如領域主圖)就不重複疊字
    },

    // ── 物品取得方式(特殊、可控的取得鏈;一般抽獎/掉落不放這,交給掉落查詢動態呈現)──
    //   key   = 物品 id
    //   short = 掉落查詢物品卡用的簡短一行
    //   chain = 小百科傳說裝備頁用的完整鏈(可含 <br>;連前置道具的掉落來源都寫清楚)
    itemAcquire: {
      // 🦴 席琳遺骸 8 部位：怪物不掉、不可製作、商店沒有 → 只能靠這兩條路（同一段文字，逐件掛上）
      rem_claw:  { short: '席琳神殿「伊奧」用席琳結晶 ×1 兌換（詞綴隨機一種）；或「菈克希絲」把身上或背包裡帶舊席琳詞綴的武器拆分而來。' },
      rem_eye:   { short: '席琳神殿「伊奧」用席琳結晶 ×1 兌換（詞綴隨機一種）；或「菈克希絲」把身上或背包裡帶舊席琳詞綴的頭盔拆分而來。' },
      rem_blood: { short: '席琳神殿「伊奧」用席琳結晶 ×1 兌換（詞綴隨機一種）；或「菈克希絲」把身上或背包裡帶舊席琳詞綴的斗篷拆分而來。' },
      rem_flesh: { short: '席琳神殿「伊奧」用席琳結晶 ×1 兌換（詞綴隨機一種）；或「菈克希絲」把身上或背包裡帶舊席琳詞綴的長靴／脛甲拆分而來。' },
      rem_heart: { short: '席琳神殿「伊奧」用席琳結晶 ×1 兌換（詞綴隨機一種）；或「菈克希絲」把身上或背包裡帶舊席琳詞綴的腰帶拆分而來。' },
      rem_bone:  { short: '席琳神殿「伊奧」用席琳結晶 ×1 兌換（詞綴隨機一種）；或「菈克希絲」把身上或背包裡帶舊席琳詞綴的手套拆分而來。' },
      rem_fang:  { short: '席琳神殿「伊奧」用席琳結晶 ×1 兌換（詞綴隨機一種）；或「菈克希絲」把身上或背包裡帶舊席琳詞綴的副手（盾牌／臂甲）拆分而來。' },
      rem_scale: { short: '席琳神殿「伊奧」用席琳結晶 ×1 兌換（詞綴隨機一種）；或「菈克希絲」把身上或背包裡帶舊席琳詞綴的盔甲拆分而來。' },
      doll_bag: {
        short: '向威頓村「魔法娃娃商人」用重複的「銀卡」兌換（1:1，需該怪卡片圖鑑已開到金階）。打開隨機獲得一隻一～二階魔法娃娃。',
      },
      doll_box_high: {
        short: '向威頓村「魔法娃娃商人」用重複的「金卡」兌換（1:1，需該怪卡片圖鑑已開到金階）。打開隨機獲得二～四階魔法娃娃（80% 二階／18% 三階／2% 四階）。',
      },
      mat_holy_relic: {
        short: '持有「死亡騎士之印記」時，在拉斯塔巴德區域擊敗任何怪 0.1% 掉落（經典×1/10）；印記由拉斯塔巴德地監「長老．X」怪掉（各約 3%）。',
      },
      wpn_baphomet_wand: {
        short: '用「靈魂之球」喚回「失去魔力的巴風特魔杖」（繼承其席琳套裝效果）',
        chain: '帶著「失去魔力的巴風特魔杖」對「靈魂之球」使用即可喚回（會繼承原杖的席琳套裝效果）。<br>・失去魔力的巴風特魔杖：打「巴風特」約 0.1%、「炎魔的巴風特」約 0.0001%。<br>・靈魂之球：打「鬼魂／紅鬼魂」各約 0.01%。',
      },
      wpn_baless: {
        short: '用「靈魂之球」喚回「失去魔力的巴列斯魔杖」（繼承其席琳套裝效果）',
        chain: '帶著「失去魔力的巴列斯魔杖」對「靈魂之球」使用即可喚回（會繼承原杖的席琳套裝效果）。<br>・失去魔力的巴列斯魔杖：打「巴列斯」約 1%、「炎魔的巴列斯」約 0.0001%。<br>・靈魂之球：打「鬼魂／紅鬼魂」各約 0.01%。',
      },
      // 🐉 龍騎士「普洛凱爾＠貝希摩斯」兌換成品(無怪掉落,掉落查詢只能靠這條呈現)
      bk_dragon_bloodlust: { short: '貝希摩斯·普洛凱爾：用「妖魔密使首領間諜書」×1 兌換（二選一，另一個是龍鱗臂甲）。間諜書＝龍騎士打「蛇女」1%' },
      armguard_dragonscale: { short: '貝希摩斯·普洛凱爾：用「妖魔密使首領間諜書」×1 兌換（二選一，另一個是血之渴望書板）。間諜書＝龍騎士打「蛇女」1%' },
      wpn_dragon_2h: { short: '貝希摩斯·普洛凱爾：用「妖魔搜索文件」×3 兌換（二選一，另一個是龍之護鎧書板）。文件＝龍騎士打甘地／羅孚／阿吐巴／都達瑪拉妖魔各 1%' },
      bk_dragon_armor: { short: '貝希摩斯·普洛凱爾：用「妖魔搜索文件」×3 兌換（二選一，另一個是龍騎士雙手劍）。文件＝龍騎士打甘地／羅孚／阿吐巴／都達瑪拉妖魔各 1%' },
      clk_dragon: { short: '貝希摩斯·普洛凱爾：用「雪怪之心」×10 兌換。雪怪之心＝龍騎士打「雪怪」10%' },
      wpn_chain_annihilator: { short: '貝希摩斯·普洛凱爾（完成 50 級試煉後）：用「靈魂之火灰燼」×1 兌換，可重複。灰燼＝龍騎士打火焰之靈魂 1%' },
      // 🔮 幻術士記憶水晶·希蓮恩（希培利亞村莊）試煉兌換（無怪掉、無商店，掉落查詢只能靠這條呈現）
      mem_cube_burn: { short: '希蓮恩（希培利亞村莊）試煉兌換：交付 污濁安特的水果／樹枝／樹皮 各 ×1（與幻術士魔杖二選一）' },
      mem_cube_shock: { short: '希蓮恩（希培利亞村莊）試煉兌換：交付 艾爾摩將軍之心 ×1（與幻術士法書二選一）' },
      // 🏝️ 沙哈之箭:裝備「沙哈之弓」時自動帶有的無限專用箭(不可存倉/販售/複製),非獨立取得
      wpn_shaha_arrow: { short: '裝備「沙哈之弓」時自動附帶的無限專用箭，不需另外取得（無法存倉、販售、複製）。' },
      // ⚔️ 硬寫在 render 函式裡的職業兌換 NPC(無 config 結構、trialSourceOf 讀不到,故手動補;材料以 renderXxxQuest 為準)
      arm_53:           { short: '銀騎士村·瑞奇（騎士試煉）兌換：黑騎士的誓約＋古老的交易文件＋龍龜甲 各 ×1' },
      arm_115:          { short: '說話之島·詹姆（法師試煉）兌換：食屍鬼的指甲＋食屍鬼的牙齒＋骷髏頭 各 ×1' },
      arm_50:           { short: '燃柳村·歐斯（妖精試煉）兌換：四大妖魔魔法書（都達瑪拉／那魯加／甘地／阿吐巴）各 ×1（與精靈體質頭盔二選一）' },
      arm_51:           { short: '燃柳村·歐斯（妖精試煉）兌換：四大妖魔魔法書（都達瑪拉／那魯加／甘地／阿吐巴）各 ×1（與精靈敏捷頭盔二選一）' },
      wpn_crystalwand:  { short: '象牙塔·塔拉斯（法師·水晶試煉）兌換：不死族的鑰匙＋不死族的骨頭 各 ×1' },
      wpn_manawand:     { short: '象牙塔·塔拉斯（法師·瑪那試煉）兌換：變形怪的血 ×1（與瑪那斗篷二選一）' },
      arm_89:           { short: '象牙塔·塔拉斯（法師·瑪那試煉）兌換：變形怪的血 ×1（與瑪那魔杖二選一）' },
      acc_royal_guard:  { short: '威頓村·馬沙（王族試煉）兌換：失去光明的靈魂 ×1' },
      acc_134:          { short: '威頓村·馬沙（騎士試煉）兌換：夜之視野＋古代鑰匙 各 ×1' },
      arm_102:          { short: '威頓村·馬沙（妖精試煉）兌換：藍色長笛＋古代鑰匙 各 ×1（與「精靈水晶·召喚強力屬性精靈」二選一）' },
      bk_elf_summon2:   { short: '威頓村·馬沙（妖精試煉）兌換：藍色長笛＋古代鑰匙 各 ×1（與保護者手套二選一）' },
      // ⚔️ 甘特(騎士/王族)、迷幻森林之母(妖精)兌換,與起始裝(同為硬寫、無 config)
      wpn_redknight:    { short: '說話之島·甘特（騎士試煉）兌換：夏洛伯之爪 ×1' },
      shd_redknight:    { short: '說話之島·甘特（騎士試煉）兌換：蛇女之鱗 ×1' },
      clk_royal_red:    { short: '說話之島·甘特（王族試煉）兌換：王族搜索狀 ×1（與「魔法書·精準目標」二選一）' },
      clk_royal_majesty:{ short: '說話之島·甘特（王族試煉）兌換：村民的遺物 ×1（與「魔法書·呼喚盟友」二選一）' },
      bk_royal_precise: { short: '說話之島·甘特（王族試煉）兌換：王族搜索狀 ×1（與紅色斗篷二選一）' },
      bk_royal_callally:{ short: '說話之島·甘特（王族試煉）兌換：村民的遺物 ×1（與君主的威嚴二選一）' },
      arm_85:           { short: '妖精森林·迷幻森林之母（妖精試煉）兌換：受詛咒的精靈書 ×1（與「精靈水晶·召喚屬性精靈」二選一）' },
      bk_elf_summon:    { short: '妖精森林·迷幻森林之母（妖精試煉）兌換：受詛咒的精靈書 ×1（與精靈T恤二選一）' },
      wpn_11:           { short: '角色創建時的起始武器（黑暗妖精／王族），無法另外取得' },
      amr_jacket:       { short: '角色創建時的起始防具，無法另外取得' },
    },

    // ── 武器特性的白話對照(掉落查詢物品卡 + 小百科傳說武器共用)──
    //   weaponTraitEff: 武器 d.eff → 特性白話
    weaponTraitEff: { combo: '連擊', cleave: '切割', pierce: '穿透', crush: '重擊／粉碎', moonburst: '月光爆裂', mp_drain: '命中恢復 MP', dice_death: '即死', magicburst: '魔爆', magicstrike: '魔擊', haste: '自我加速' },
    //   weaponTagTrait: 武器種類(getWeaponTags) → 內建特性(有些特性看種類、不寫在 eff)
    weaponTagTrait: { '單手劍': '反擊', '武士刀': '居合', '匕首': '出血', '矛': '出血', '雙刀': '連擊', '鋼爪': '連擊', '雙手劍': '切割', '雙手鈍器': '重擊／粉碎' },
  };
  console.log('[AFK-extradata] loaded — AFK_EXTRA 共用資料就緒（itemAcquire / weaponTraitEff）。');
})();
