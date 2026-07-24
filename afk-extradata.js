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
        if (id === 'arena_pvp') return '決鬥競技場';   // ⚔️ 上游 v3.7.4 存檔 PvP 用圖(不在 MAP_CATEGORIES,查不到中文名)
        if (typeof SANCTUARY_MAP_NAMES !== 'undefined' && SANCTUARY_MAP_NAMES[id]) return SANCTUARY_MAP_NAMES[id];   // 🌑 黑暗妖精聖地 3 隱藏圖（js/11 定義）
        if (typeof HIDDEN_AREA_NAMES !== 'undefined' && HIDDEN_AREA_NAMES[id]) return HIDDEN_AREA_NAMES[id];   // 🏛️ 隱藏狩獵區域
        if (typeof ANTHARAS_AREA_NAMES !== 'undefined' && ANTHARAS_AREA_NAMES[id]) return ANTHARAS_AREA_NAMES[id];   // 🐉 侵蝕的安塔瑞斯巢穴 4 區（js/05 定義，不在 MAP_CATEGORIES）
        if (typeof SiegeV2 !== 'undefined' && SiegeV2.stages) {   // 🏰 攻城戰 v2 各階段戰場（js/30 定義，不在 MAP_CATEGORIES / SIEGE_CITY）
          for (var si = 0; si < SiegeV2.stages.length; si++) if (SiegeV2.stages[si].map === id) return SiegeV2.stages[si].mapName;   // 讀上游自己的 stage 表→作者補其他城的階段時自動跟上
        }
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
        short: '持有「死亡騎士之印記」時，在拉斯塔巴德區域擊敗任何怪 0.1% 掉落；印記由拉斯塔巴德地監「長老．X」怪掉（各約 3%）。',
      },
      wpn_baphomet_wand: {
        short: '用「靈魂之球」喚回「失去魔力的巴風特魔杖」（繼承其席琳套裝效果）',
        chain: '帶著「失去魔力的巴風特魔杖」對「靈魂之球」使用即可喚回（會繼承原杖的席琳套裝效果）。<br>・失去魔力的巴風特魔杖：打「巴風特」約 0.1%、「炎魔的巴風特」約 0.0001%。<br>・靈魂之球：打「鬼魂／紅鬼魂」各約 0.01%。',
      },
      wpn_baless: {
        short: '用「靈魂之球」喚回「失去魔力的巴列斯魔杖」（繼承其席琳套裝效果）',
        chain: '帶著「失去魔力的巴列斯魔杖」對「靈魂之球」使用即可喚回（會繼承原杖的席琳套裝效果）。<br>・失去魔力的巴列斯魔杖：打「巴列斯」約 1%、「炎魔的巴列斯」約 0.0001%。<br>・靈魂之球：打「鬼魂／紅鬼魂」各約 0.01%。',
      },
      // 🏝️ 沙哈之箭:裝備「沙哈之弓」時自動帶有的無限專用箭(不可存倉/販售/複製),非獨立取得
      wpn_shaha_arrow: { short: '裝備「沙哈之弓」時自動附帶的無限專用箭，不需另外取得（無法存倉、販售、複製）。' },
      // 🎓 試煉成品(15/30/45 級 TRIAL_Q 與 50 級 TRIAL_50_CFG 的獎勵)不在此手動維護:
      //    dex 的 trialSourceOf 直接讀遊戲 config 自動產生來源說明(上游改規則自動跟上)。
      //    舊的手動條目(v3.0.78 接取制前「硬寫 render 函式」時代補的)已整批移除——
      //    內容停在舊制(1% 機率/二選一),與現行「接取後必掉、一次領全部」全部矛盾。
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
