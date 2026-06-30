// 🔊 戰鬥音效引擎（取樣音檔 · HTMLAudioElement 池）
//   音檔放 assets/sfx/<file>.<mp3|ogg|wav>；缺檔→該事件靜音（優雅降級、無錯誤）。
//   ⚠️用 <audio> 元素載入而非 fetch：Chromium 會擋下對 file:// 本機檔案的 fetch()，
//     打包版(Electron·loadFile→file://) 與「直接雙擊網頁(file://)」都會因此無聲；
//     <audio>（媒體元素）與 <img> 一樣可讀 file://／asar，故網頁版(http/file://)與打包版「行為完全一致」。
//   每音效預載 N 個元素做 round-robin → 可重疊播放、零重載延遲。HTMLAudio.play() 於首次使用者互動後即可播（遊戲本就需點擊進入）。
//   音效偏好為「裝置全域設定」（非每存檔），存於 _lsSet('fb5_sfx')。對外：playSfx('attack'|'crit'|'kill'|'magic'|'hurt'|'levelup')。
const SFX_DEFS = {
    attack:  { file: 'attack',  vol: 0.45, throttle: 70 },   // 玩家普攻命中（連打節流，不洗版）
    crit:    { file: 'crit',    vol: 0.70, throttle: 40 },   // 爆擊／會心一擊
    kill:    { file: 'kill',    vol: 0.60, throttle: 50 },   // 擊殺怪物
    magic:   { file: 'magic',   vol: 0.55, throttle: 90 },   // 玩家施放魔法
    hurt:    { file: 'hurt',    vol: 0.50, throttle: 120 },  // 玩家受到傷害
    levelup: { file: 'levelup', vol: 0.85, throttle: 0 },    // 升級
};
var _sfxCfg = { on: true, vol: 50 };          // 預設開啟、音量 50%
var _sfxPool = {}, _sfxIdx = {}, _sfxLast = {}, _sfxInited = false;
var SFX_POOL_N = 4;

function _sfxLoadCfg() {
    try {
        var s = (typeof _lsGet === 'function') ? _lsGet('fb5_sfx') : null;
        if (s) { var o = JSON.parse(s); if (o && typeof o === 'object') { _sfxCfg.on = (o.on !== false); _sfxCfg.vol = (typeof o.vol === 'number') ? o.vol : 50; } }
    } catch (e) {}
}
function _sfxSaveCfg() { try { if (typeof _lsSet === 'function') _lsSet('fb5_sfx', JSON.stringify(_sfxCfg)); } catch (e) {} }

// 載入單一音效：依序試 mp3→ogg→wav；第一個能播者→建立 N 個元素的播放池；全部失敗→該事件保持靜音
function _sfxTryLoad(key, def) {
    var exts = ['mp3', 'ogg', 'wav'], i = 0;
    function tryNext() {
        if (i >= exts.length) { _sfxPool[key] = null; return; }
        var url = 'assets/sfx/' + def.file + '.' + exts[i++];
        var probe = new Audio();
        probe.preload = 'auto';
        probe.addEventListener('canplaythrough', function () {
            if (_sfxPool[key]) return;
            var arr = [probe];
            for (var j = 1; j < SFX_POOL_N; j++) { var a = new Audio(url); a.preload = 'auto'; arr.push(a); }
            _sfxPool[key] = arr; _sfxIdx[key] = 0;
        }, { once: true });
        probe.addEventListener('error', function () { tryNext(); }, { once: true });   // 缺檔／格式不支援 → 換下一個副檔名
        probe.src = url;
        try { probe.load(); } catch (e) {}
    }
    tryNext();
}

function _sfxInit() {
    if (_sfxInited) return; _sfxInited = true;
    _sfxLoadCfg();
    Object.keys(SFX_DEFS).forEach(function (k) { _sfxTryLoad(k, SFX_DEFS[k]); });
    _sfxSyncUI();
}
// 將 UI 控制項（設定面板的開關 + 音量滑桿）初值同步為目前偏好
function _sfxSyncUI() {
    var c = document.getElementById('set-sfx-on'); if (c) c.checked = !!_sfxCfg.on;
    var v = document.getElementById('set-sfx-vol'); if (v) v.value = _sfxCfg.vol;
}

function setSfxOn(on) { _sfxCfg.on = !!on; _sfxSaveCfg(); if (on) playSfx('attack'); }   // 開啟時試播回饋（toggle 點擊即 user gesture，解鎖播放）
function setSfxVol(v) { _sfxCfg.vol = Math.max(0, Math.min(100, parseInt(v, 10) || 0)); _sfxSaveCfg(); }

// 🔊 攻擊音效依「武器類型」分檔(attack_<weaponcat>·用 equipCatKey)；受傷依「職業群組+性別」分檔(hurt_<group>_<m|f>)；其餘事件共用單檔。缺對應變體檔→自動退回通用 key(attack/hurt)。
//   受傷群組(4組)：knight=騎士/戰士/龍騎士、mage=法師/幻術士、elf=妖精/黑暗妖精、royal=王族；性別由 player.avatar(/女|公主/→f否則m) 判定。
//   武器類型(equipCatKey·js/16)：dagger/sword1/sword2/katana/blunt1/blunt2/spear/claw/dual/chainsword/bow/xbow/wand/qigu/wpn_other；徒手→unarmed。
var _SFX_GROUP = { knight: 'knight', warrior: 'knight', dragon: 'knight', mage: 'mage', illusion: 'mage', elf: 'elf', dark: 'elf', royal: 'royal' };
var _sfxVariantTried = {};
function _sfxClassGroup() { return (typeof player !== 'undefined' && player && player.cls) ? (_SFX_GROUP[player.cls] || null) : null; }
function _sfxGender() { var a = (typeof player !== 'undefined' && player && player.avatar) ? player.avatar : ''; return /女|公主/.test(a) ? 'f' : 'm'; }
function _sfxWeaponCat() {
    if (typeof player === 'undefined' || !player || !player.eq || !player.eq.wpn) return 'unarmed';   // 徒手（未持武器）
    var id = player.eq.wpn.id, d = (typeof DB !== 'undefined' && DB.items) ? DB.items[id] : null;
    if (!d) return 'unarmed';
    var ck = (typeof equipCatKey === 'function') ? equipCatKey(id, d) : null;
    return ck || 'wpn_other';
}
function _sfxVariantKey(base) {
    var key;
    if (base === 'attack') { var wc = _sfxWeaponCat(); if (!wc) return null; key = 'attack_' + wc; }    // 攻擊：依「武器類型」
    else { var g = _sfxClassGroup(); if (!g) return null; key = base + '_' + g + '_' + _sfxGender(); }   // 受傷：依「職業群組+性別」
    if (!_sfxVariantTried[key]) { _sfxVariantTried[key] = true; _sfxTryLoad(key, { file: key }); }       // 首次需要該變體才載入
    return key;
}

function playSfx(key) {
    if (!_sfxCfg.on) return;
    var def = SFX_DEFS[key]; if (!def) return;
    var poolKey = key;
    if (key === 'attack' || key === 'hurt') {   // 依職業群組+性別挑變體；變體未備／未載完 → 退回通用 key
        var vk = _sfxVariantKey(key);
        if (vk && _sfxPool[vk] && _sfxPool[vk].length) poolKey = vk;
    }
    var arr = _sfxPool[poolKey]; if (!arr || !arr.length) return;   // 變體與通用皆無 → 靜音
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (def.throttle && _sfxLast[key] && (now - _sfxLast[key]) < def.throttle) return;   // 節流用 base key（同角色一次只一種變體）
    _sfxLast[key] = now;
    try {
        var idx = _sfxIdx[poolKey] || 0;
        var a = arr[idx % arr.length]; _sfxIdx[poolKey] = idx + 1;   // round-robin → 可重疊播放
        a.volume = Math.max(0, Math.min(1, (def.vol || 0.5) * (_sfxCfg.vol / 100)));   // 每音效基準 × 全域音量
        try { a.currentTime = 0; } catch (e) {}
        var p = a.play();
        if (p && p.catch) p.catch(function () {});   // autoplay 尚未解鎖（無互動）→忽略；首次互動後即正常
    } catch (e) {}
}

// ===== 🔊 怪物受傷 / 法術施展（依「名稱」對應使用者音效庫編號 · 2026-06-30）=====
//   音檔放 assets/sfx/，檔名＝音效庫編號：怪物受傷 <編號>.<mp3|ogg|wav>、法術施展 <編號>.<…>（怪物與法術編號不重疊故同名規則安全）。一個編號被多隻怪／多技能共用→只需放一個檔。
//   playMobHurt(mob)：查 MOB_HURT_SFX[mob.n]→播 <n>（全域節流，避免多目標／連擊洗版）；缺檔靜音。
//   playSpellCast(skn)：查 SPELL_SFX[skn]→播 <n>；查無對應或缺檔→退回通用 'magic'。檔名懶載（首次需要才嘗試）。
//   playMobKill(mob)：查 MOB_KILL_SFX[mob.n]→播 <n>（怪物死亡音·全域節流）；查無對應或缺檔→退回通用 'kill'。怪物受傷/死亡/法術三組編號互不重疊。
const MOB_HURT_SFX = {
  "妖魔": 49, "哥布林": 214, "依詩蒂": 24, "阿頓": 23, "朱利安": 704, "歐薇": 25, "喬": 144, "賽尼斯": 405, "肯特守護塔": 63, "肯特城門": 63,
  "海音守護塔": 63, "海音城門": 63, "風木守護塔": 63, "風木城門": 63, "巴列斯": 427, "特羅斯王子": 22, "依詩蒂公主": 21, "鋼鐵阿頓": 23, "月光朱利安": 704,
  "月之精靈歐薇": 25, "魔法師喬": 144, "魔女賽尼斯": 405, "闇影格立特": 23, "妖魔弓箭手": 47, "地靈": 226, "污染的地精靈": 156, "蘑菇": 162, "狼": 83,
  "哈士奇": 775, "侏儒": 441, "熊": 291, "人形殭屍": 72, "杜賓狗": 168, "安普長老": 298, "污染的安特": 149, "漂浮之眼": 39, "妖魔鬥士": 51,
  "冰原狼人": 513, "怪手": 93, "狼人": 70, "侏儒戰士": 441, "骷髏": 57, "妖魔殭屍": 57, "甘地妖魔": 49, "污染的潘": 159, "鱷魚": 629, "巨蟻": 213,
  "妖魔法師": 505, "骷髏弓箭手": 57, "蟑螂人": 610, "石頭高崙": 770, "羅孚妖魔": 49, "骷髏斧手": 57, "骷髏槍兵": 57, "夏洛伯": 55, "妖魔巡守": 49,
  "哈柏哥布林": 432, "阿吐巴妖魔": 49, "都達瑪拉妖魔": 49, "歐熊": 291, "蜥蜴人": 494, "穴居人": 547, "史巴托": 57, "食屍鬼": 72, "鯊魚": 623, "黑騎士": 26,
  "黑騎士搜索隊": 26, "人魚": 616, "那魯加妖魔": 49, "萊肯": 70, "楊果里恩": 55, "蟹人": 625, "巨人": 518, "巨人戰士": 518, "巨人長老": 518,
  "古代巨人": 518, "巨大兵蟻": 212, "鼠人": 614, "海星": 623, "長老": 35, "卡司特": 106, "食人妖精": 75, "蛇女": 615, "地獄犬": 427, "希爾黛斯": 727,
  "龍龜": 611, "毒蠍": 216, "哈維": 244, "骷髏神射手": 57, "骷髏警衛": 44, "黑暗精靈": 156, "歐吉": 195, "多羅": 254, "伊萊克頓": 617, "強盜": 26,
  "雪人": 750, "紙人": 732, "骷髏鬥士": 57, "奎斯坦修": 618, "爆彈花": 653, "食人妖精王": 75, "莫妮亞": 55, "艾爾摩士兵": 700, "格利芬": 278,
  "艾爾摩法師": 697, "密密": 735, "巨大鱷魚": 629, "冰石高崙": 723, "卡司特王": 106, "活鎧甲": 732, "多眼怪": 295, "龍蠅": 213, "冰原老虎": 746,
  "雪怪": 754, "變形怪": 60, "亞力安": 261, "阿魯巴": 281, "火焰戰士": 676, "艾爾摩將軍": 692, "鋼鐵高崙": 770, "強盜頭目": 26, "邪惡蜥蜴": 223,
  "卡瑞": 57, "火焰弓箭手": 676, "思克巴": 282, "火蜥蜴": 635, "火炎蛋": 682, "夢幻之島閃電球": 156, "夢幻之島鎧甲守衛": 156, "獨眼巨人": 438, "思克巴女皇": 282,
  "影魔": 57, "鬼魂": 499, "巫師": 35, "熔岩高崙": 642, "紅鬼魂": 499, "夢幻之島火精靈王": 156, "夢幻之島水精靈王": 156, "夢幻之島風精靈王": 156,
  "夢幻之島地精靈王": 156, "獨角獸": 291, "夢魘": 427, "夢幻之島蘑菇": 162, "夢幻之島鬼火": 499, "夢幻之島火蜥蜴": 635, "夢幻之島殺人蜂": 213, "夢幻之島暴走兔": 83,
  "夢幻之島火炎蛋": 682, "夢幻之島冰石高崙": 723, "夢幻之島大鬼火": 499, "冰人": 727, "冰之女王侍女": 727, "冰之女王": 727, "冰魔": 750, "巴土瑟": 727,
  "卡士柏": 727, "馬庫爾": 727, "阿西塔基奧": 650, "死神": 765, "伊弗利特": 638, "烈炎獸": 646, "飛龍": 278, "黑長者": 35, "變形怪首領": 60, "巴風特": 67,
  "克特": 29, "死亡騎士": 88, "巨蟻女皇": 509, "不死鳥": 678, "惡魔": 427, "安塔瑞斯": 226, "法利昂": 611, "巴拉卡斯": 635, "林德拜爾": 278,
  "牧羊犬": 175, "夢幻之島冰人": 727, "西瑪": 727, "底比斯 曼陀羅草(白)": 162, "底比斯 曼陀羅草": 653, "底比斯 聖甲蟲": 213, "底比斯 聖甲蟲(藍)": 213,
  "底比斯 凱比斯(黑)": 213, "底比斯 凱比斯(紅)": 213, "底比斯 尖碑石奴": 723, "底比斯 尖碑石奴(黑)": 642, "底比斯 斯芬克斯": 291, "底比斯 斯芬克斯(黑)": 291,
  "底比斯 尼荷斯": 49, "底比斯 尼荷斯(藍)": 49, "底比斯 阿努斯": 49, "底比斯 阿努斯(黑)": 49, "底比斯 巴斯": 49, "底比斯 巴斯(紅)": 49, "底比斯 阿努比斯": 49,
  "底比斯 賀洛斯": 49, "歐姆": 770, "狂暴的歐姆": 770, "歐姆裝甲兵": 723, "狂暴的歐姆裝甲兵": 723, "黑暗妖精殘兵(弓)": 458, "黑暗妖精殘兵(劍)": 458,
  "黑暗妖精殘兵(十字弓)": 458, "黑暗妖精殘兵(法師)": 458, "黑暗妖精殘兵(雙手劍)": 458, "黑暗精靈使": 458, "黑暗妖精警衛(十字弓)": 458, "黑暗妖精魔法學徒": 458,
  "黑暗妖精警衛(矛)": 458, "黑暗妖精巡守": 458, "黑暗妖精士兵": 458, "黑暗妖精將軍": 458, "黑虎": 168, "拉斯塔巴德馴獸師": 79, "受詛咒的馴獸師": 79, "地獄束縛犬": 427,
  "魂騎士": 79, "地獄奴隸": 79, "喚獸師": 79, "拉斯塔巴德守門人": 458, "魔獸軍王巴蘭卡": 79, "地元素守護者": 770, "水元素守護者": 770, "風元素守護者": 770,
  "火元素守護者": 770, "黑暗妖精法師": 458, "黑法師": 458, "黑暗復仇者": 79, "血色術士": 79, "歐姆戰士": 106, "闇黑君王": 79, "血騎士": 79, "重裝歐姆戰士": 106,
  "拉斯塔巴德近衛隊": 79, "拉斯塔巴德近衛隊隊長": 79, "長老隨從": 79, "長老．琪娜": 79, "長老．安迪斯": 79, "長老．巴塔斯": 79, "長老．巴洛斯": 79, "長老．巴陸德": 79,
  "長老．拉曼斯": 79, "長老．泰瑪斯": 79, "長老．艾迪爾": 79, "法令軍王蕾雅": 79, "冥法軍王海露拜": 79, "暗殺軍王史雷佛": 79, "往上層的樓梯": 63, "變種蛇女": 615,
  "變種楊果里恩": 55, "梅杜莎": 615, "奇美拉": 278, "扭曲的潔尼斯女王": 427, "魔狼": 513, "邪惡密密": 735, "邪惡多眼怪": 295, "死亡之劍": 732,
  "不幸的幻象眼魔": 39, "恐怖的火炎蛋": 682, "恐怖夢魘": 427, "恐怖的地獄犬": 427, "小惡魔": 427, "恐怖的伊弗利特": 638, "恐怖的吸血鬼": 427, "殘暴的骷髏斧兵": 57,
  "殘暴的食屍鬼": 72, "殘暴的骷髏槍兵": 57, "殘暴的史巴托": 57, "殘暴的骷髏神射手": 57, "殘暴的骷髏鬥士": 57, "死亡的殭屍王": 72, "幼龍": 611, "火焰之靈魂(紅)": 57,
  "火焰之靈魂(藍)": 57, "恐怖的鋼鐵高崙": 770, "火焰之魔法師": 35, "骨龍": 611, "地獄的黑豹": 291, "受詛咒的妖魔殭屍": 57, "受詛咒的艾爾摩士兵": 700,
  "受詛咒的艾爾摩法師": 697, "受詛咒的艾爾摩將軍": 692, "不死的木乃伊王": 72, "暗黑萊肯": 70, "冷酷冰原老虎": 746, "火焰烈炎獸": 638, "火焰阿西塔基奧": 650,
  "冷酷的艾莉絲": 427, "暗黑黑騎士": 26, "暗黑火焰戰士": 676, "暗黑火焰弓箭手": 676, "暗黑思克巴女皇": 282, "闇黑的騎士范德": 547, "傲慢的潔尼斯女王": 427,
  "小幻象眼魔": 39, "馬昆斯吸血鬼": 427, "恐怖的殭屍王": 72, "不滅的巫妖": 765, "土精靈王": 156, "水精靈王": 156, "風精靈王": 156, "火精靈王": 156, "艾莉絲": 427,
  "木乃伊王": 72, "騎士范德": 547, "邪惡的鐮刀死神": 765, "地之牙": 156, "風之牙": 156, "水之牙": 727, "火之牙": 635, "水靈之主": 727, "遺忘之島": 63,
  "遺忘之島鱷魚": 629, "遺忘之島狼人": 70, "遺忘之島夏洛伯": 55, "遺忘之島亞力安": 261, "遺忘之島黑暗精靈": 458, "遺忘之島歐熊": 291, "遺忘之島蜥蜴人": 494,
  "遺忘之島卡司特": 106, "遺忘之島蛇女": 615, "遺忘之島萊肯": 70, "遺忘之島巨斧牛人": 519, "遺忘之島食人妖精": 75, "遺忘之島楊果里恩": 55, "遺忘之島格利芬": 278,
  "遺忘之島鏈鎚牛人": 519, "遺忘之島哈維": 244, "遺忘之島變形怪": 60, "遺忘之島巨大鱷魚": 629, "遺忘之島卡司特王": 106, "遺忘之島多羅": 254, "遺忘之島阿魯巴": 281,
  "遺忘之島食人妖精王": 75, "遺忘之島邪惡蜥蜴": 223, "遺忘之島獨眼巨人": 438, "遺忘之島飛龍": 278, "遺忘之島巨大牛人": 519, "深淵食屍鬼": 72, "深淵弓箭手": 57,
  "地靈之主": 156, "風靈之主": 156, "火靈之主": 635, "西斯": 57, "深淵水靈": 727, "深淵地靈": 156, "深淵風靈": 156, "深淵火靈": 635, "曼波兔": 49,
  "深淵之主": 427, "魔蝙蝠": 83, "黑暗妖精盜賊": 458, "闇之精靈": 156, "犰狳": 291, "魔熊": 291, "歐姆民兵": 26, "闇精靈王": 156, "金屬蜈蚣": 213,
  "馴獸師": 458, "墳墓守護者": 770, "墳墓守護者法師": 770, "墳墓守護者騎士": 770, "巨大墳墓守護者": 770, "魔族暗殺團": 57, "炎魔的分身": 427, "黑暗棲林者": 49,
  "炎魔的思克巴": 282, "炎魔的思克巴女皇": 282, "炎魔的小惡魔": 427, "炎魔的巴風特": 67, "墮落的司祭(一階)": 57, "墮落的司祭(二階)": 57, "墮落的司祭(三階)": 57,
  "炎魔的巴列斯": 427, "墮落的司祭(四階)": 57, "墮落的司祭(五階)": 57, "炎魔的惡魔": 427, "墮落": 57, "死亡的司祭(思克巴)": 697, "死亡的司祭(巴風特)": 697,
  "混沌的司祭(飛翼)": 57, "混沌的司祭(野獸)": 57, "火焰之影親衛隊(巴風特)": 700, "混沌": 57, "死亡": 88, "象牙塔紙人": 732, "象牙塔石頭高崙": 770,
  "象牙塔鋼鐵高崙": 770, "象牙塔果凍怪": 60, "象牙塔活鎧甲": 732, "象牙塔死亡之劍": 732, "象牙塔閃電球": 727, "象牙塔密密": 735, "象牙塔長者": 35, "象牙塔黑長者": 35,
  "象牙塔奇美拉": 278, "象牙塔蛇女": 615, "象牙塔黑魔法師": 35, "象牙塔死神": 765, "象牙塔影魔": 57, "象牙塔惡靈": 57, "象牙塔巴列斯之影": 427, "卡魯塔": 499,
  "哈汀之影": 35, "象牙塔炎魔的奴隸": 427, "象牙塔小惡魔": 427, "象牙塔巴風特之影": 67, "象牙塔翼魔": 427, "象牙塔炎魔之影": 427, "象牙塔惡魔之影": 427, "白螞蟻群": 213,
  "巨大白螞蟻": 213, "強化巨蟻": 213, "強化白螞蟻群": 213, "巨大突擊螞蟻": 213, "巨大強化白螞蟻": 213, "巨大守護螞蟻": 213, "狂野之毒": 83, "狂暴蜥蜴人": 494,
  "狂野毒牙": 83, "狂野之魔": 83, "高等蜥蜴人": 494, "藍尾蜥蜴": 83, "奇異鸚鵡": 83, "藏寶箱": 93, "海賊骷髏": 57, "重裝蜥蜴人": 494, "海賊骷髏士兵": 57,
  "海賊骷髏刀手": 57, "海賊骷髏首領": 57, "德雷克": 57,
};
const SPELL_SFX = {
  "致命落雷": 34, "極道落雷": 34, "奪命之雷": 34, "光箭": 97, "火箭": 99, "燃燒的火球": 99, "岩漿之箭": 99, "壞物術": 100, "極光雷電": 101, "雷霆風暴": 101,
  "起死回生術": 102, "返生術": 102, "吸血鬼之吻": 103, "惡魔之吻": 103, "無所遁形術": 108, "力盔：無所遁形術": 108, "初級治癒術": 109, "治盔：初級治癒術": 109,
  "寒冷戰慄": 110, "火牢": 111, "立方：燃燒": 111, "擬似魔法武器": 113, "力盔：擬似魔法武器": 113, "中級治癒術": 114, "治盔：中級治癒術": 114, "高級治癒術": 115,
  "闇盲咒術": 116, "木乃伊的詛咒": 116, "毒咒": 117, "傳送術": 119, "通暢氣脈術": 121, "加速術": 121, "敏盔：通暢氣脈術": 121, "敏盔：加速術": 121,
  "聖潔之光": 122, "冰雪暴": 123, "冰雪颶風": 123, "龍捲風": 125, "全部治癒術": 126, "保護罩": 127, "地裂術": 128, "立方：地裂": 128, "流星雨": 130,
  "聖結界": 131, "迷魅術": 132, "體力回復術": 133, "沉睡之霧": 136, "鎧甲護持": 137, "尖刺盔甲": 137, "反擊屏障": 137, "造屍術": 139, "隨從：人形殭屍": 139,
  "召喚術": 139, "魔法相消術": 140, "解毒術": 141, "體魄強健術": 142, "力盔：體魄強健術": 142, "日光術": 145, "隱身術": 147, "烈炎術": 709, "火風暴": 710,
  "地獄之牙": 712, "寒冰氣息": 714, "冰錐": 715, "冰矛圍籬": 715, "震裂術": 716, "究極光裂術": 717, "岩牢": 718, "冰箭": 719, "風刃": 719,
  "祝福魔法武器": 800, "魔法屏障": 801, "黑闇之影": 802, "負重強化": 803, "神聖武器": 804, "魔力奪取": 805, "冥想術": 807, "魔法封印": 808, "能量感測": 809,
  "心靈轉換": 813, "魂體轉換": 813, "淨化精神": 814, "魔法消除": 815, "火焰武器": 816, "舞躍之火": 816, "屬性之火": 816, "灼熱武器": 816, "烈炎武器": 819,
  "烈焰之魂": 819, "大地防護": 822, "大地屏障": 822, "大地的祝福": 822, "地面障礙": 823, "堅固防護": 824, "增幅防禦": 824, "鋼鐵防護": 824, "生命的祝福": 825,
  "世界樹的呼喚": 826, "水之元氣": 826, "生命之泉": 826, "屬性防禦": 828, "單屬性防禦": 828, "魔法防禦": 829, "三重矢": 832, "暴風神射": 832, "精準射擊": 832,
  "精準目標": 832, "風之神射": 833, "暴風之眼": 833, "強力加速術": 834, "神聖疾走": 834, "風之疾走": 834, "絕對屏障": 835, "疾病術": 839, "緩速術": 843,
  "弱化術": 843, "狂暴術": 843, "封印禁地": 845, "靈魂昇華": 807, "衝擊之暈": 110, "釋放元素": 717, "召喚屬性精靈": 139, "召喚強力屬性精靈": 139,
  "體能激發": 142, "能量激發": 807, "鏡反射": 801, "力量提升": 142, "影之防護": 828, "暗隱術": 147, "附加劇毒": 117, "敏捷提升": 121, "毒性抵抗": 141,
  "燃燒鬥志": 142, "行走加速": 834, "暗影之牙": 816, "暗影閃避": 833, "會心一擊": 832, "迴避提升": 833, "雙重破壞": 137, "破壞盔甲": 843, "幻覺：歐吉": 139,
  "混亂": 136, "粉碎能量": 815, "鏡像": 139, "專注": 807, "幻覺：巫妖": 139, "心靈破壞": 813, "骷髏毀壞": 100, "幻想": 717, "幻覺：鑽石高崙": 139,
  "立方：衝擊": 111, "耐力": 142, "幻覺：化身": 139, "恐慌": 843, "洞察": 108, "立方：和諧": 111, "疼痛的歡愉": 137, "龍之護鎧": 824, "燃燒擊砍": 816,
  "護衛毀滅": 815, "岩漿噴吐": 99, "覺醒：安塔瑞斯": 819, "血之渴望": 103, "屠宰者": 100, "恐懼無助": 843, "覺醒：法利昂": 819, "致命身軀": 137, "驚悚死神": 116,
  "覺醒：巴拉卡斯": 819, "戰斧投擲": 832, "咆哮": 843, "體能強化": 142, "亡命之徒": 832, "呼喚盟友": 139, "勇猛意志": 142, "閃亮之盾": 127,
};
// === 怪物死亡(擊殺)音效對應（name -> 音效編號·檔名＝<n>·查無/缺檔→通用 kill）===
const MOB_KILL_SFX = {
  "妖魔": 50, "哥布林": 215, "依詩蒂": 301, "阿頓": 302, "朱利安": 302, "歐薇": 301, "喬": 302, "賽尼斯": 407, "肯特守護塔": 64, "肯特城門": 64,
  "海音守護塔": 64, "海音城門": 64, "風木守護塔": 64, "風木城門": 64, "巴列斯": 424, "特羅斯王子": 302, "依詩蒂公主": 301, "鋼鐵阿頓": 302, "月光朱利安": 302,
  "月之精靈歐薇": 301, "魔法師喬": 302, "魔女賽尼斯": 407, "闇影格立特": 302, "妖魔弓箭手": 48, "地靈": 258, "污染的地精靈": 157, "蘑菇": 163, "狼": 84,
  "哈士奇": 777, "侏儒": 442, "熊": 293, "人形殭屍": 73, "杜賓狗": 173, "安普長老": 299, "污染的安特": 150, "漂浮之眼": 40, "妖魔鬥士": 52,
  "冰原狼人": 757, "怪手": 94, "狼人": 71, "侏儒戰士": 442, "骷髏": 58, "妖魔殭屍": 58, "甘地妖魔": 50, "污染的潘": 160, "鱷魚": 554, "巨蟻": 196,
  "妖魔法師": 506, "骷髏弓箭手": 58, "蟑螂人": 571, "石頭高崙": 772, "羅孚妖魔": 50, "骷髏斧手": 58, "骷髏槍兵": 58, "夏洛伯": 56, "妖魔巡守": 50,
  "哈柏哥布林": 433, "阿吐巴妖魔": 50, "都達瑪拉妖魔": 50, "歐熊": 293, "蜥蜴人": 496, "穴居人": 548, "史巴托": 58, "食屍鬼": 73, "鯊魚": 575, "黑騎士": 27,
  "黑騎士搜索隊": 27, "人魚": 583, "那魯加妖魔": 50, "萊肯": 71, "楊果里恩": 56, "蟹人": 661, "巨人": 277, "巨人戰士": 277, "巨人長老": 277,
  "古代巨人": 277, "巨大兵蟻": 197, "鼠人": 560, "海星": 575, "長老": 36, "卡司特": 105, "食人妖精": 76, "蛇女": 586, "地獄犬": 424, "希爾黛斯": 730,
  "龍龜": 600, "毒蠍": 217, "哈維": 245, "骷髏神射手": 58, "骷髏警衛": 45, "黑暗精靈": 157, "歐吉": 191, "多羅": 256, "伊萊克頓": 551, "強盜": 27,
  "雪人": 751, "紙人": 733, "骷髏鬥士": 58, "奎斯坦修": 557, "爆彈花": 654, "食人妖精王": 76, "莫妮亞": 56, "艾爾摩士兵": 720, "格利芬": 274,
  "艾爾摩法師": 696, "密密": 737, "巨大鱷魚": 554, "冰石高崙": 724, "卡司特王": 105, "活鎧甲": 733, "多眼怪": 287, "龍蠅": 196, "冰原老虎": 747,
  "雪怪": 755, "變形怪": 61, "亞力安": 262, "阿魯巴": 277, "火焰戰士": 667, "艾爾摩將軍": 693, "鋼鐵高崙": 772, "強盜頭目": 27, "邪惡蜥蜴": 219,
  "卡瑞": 58, "火焰弓箭手": 667, "思克巴": 283, "火蜥蜴": 634, "火炎蛋": 663, "夢幻之島閃電球": 157, "夢幻之島鎧甲守衛": 157, "獨眼巨人": 436, "思克巴女皇": 283,
  "影魔": 58, "鬼魂": 507, "巫師": 36, "熔岩高崙": 643, "紅鬼魂": 507, "夢幻之島火精靈王": 157, "夢幻之島水精靈王": 157, "夢幻之島風精靈王": 157,
  "夢幻之島地精靈王": 157, "獨角獸": 293, "夢魘": 424, "夢幻之島蘑菇": 163, "夢幻之島鬼火": 507, "夢幻之島火蜥蜴": 634, "夢幻之島殺人蜂": 196, "夢幻之島暴走兔": 84,
  "夢幻之島火炎蛋": 663, "夢幻之島冰石高崙": 724, "夢幻之島大鬼火": 507, "冰人": 730, "冰之女王侍女": 730, "冰之女王": 730, "冰魔": 751, "巴土瑟": 730,
  "卡士柏": 730, "馬庫爾": 730, "阿西塔基奧": 651, "死神": 767, "伊弗利特": 639, "烈炎獸": 647, "飛龍": 274, "黑長者": 36, "變形怪首領": 61, "巴風特": 68,
  "克特": 30, "死亡騎士": 89, "巨蟻女皇": 501, "不死鳥": 658, "惡魔": 424, "安塔瑞斯": 258, "法利昂": 600, "巴拉卡斯": 634, "林德拜爾": 274,
  "牧羊犬": 176, "夢幻之島冰人": 730, "西瑪": 730, "底比斯 曼陀羅草(白)": 163, "底比斯 曼陀羅草": 654, "底比斯 聖甲蟲": 196, "底比斯 聖甲蟲(藍)": 196,
  "底比斯 凱比斯(黑)": 196, "底比斯 凱比斯(紅)": 196, "底比斯 尖碑石奴": 724, "底比斯 尖碑石奴(黑)": 643, "底比斯 斯芬克斯": 293, "底比斯 斯芬克斯(黑)": 293,
  "底比斯 尼荷斯": 50, "底比斯 尼荷斯(藍)": 50, "底比斯 阿努斯": 50, "底比斯 阿努斯(黑)": 50, "底比斯 巴斯": 50, "底比斯 巴斯(紅)": 50, "底比斯 阿努比斯": 50,
  "底比斯 賀洛斯": 50, "歐姆": 772, "狂暴的歐姆": 772, "歐姆裝甲兵": 724, "狂暴的歐姆裝甲兵": 724, "黑暗妖精殘兵(弓)": 460, "黑暗妖精殘兵(劍)": 460,
  "黑暗妖精殘兵(十字弓)": 460, "黑暗妖精殘兵(法師)": 460, "黑暗妖精殘兵(雙手劍)": 460, "黑暗精靈使": 460, "黑暗妖精警衛(十字弓)": 460, "黑暗妖精魔法學徒": 460,
  "黑暗妖精警衛(矛)": 460, "黑暗妖精巡守": 460, "黑暗妖精士兵": 460, "黑暗妖精將軍": 460, "黑虎": 173, "拉斯塔巴德馴獸師": 80, "受詛咒的馴獸師": 80, "地獄束縛犬": 424,
  "魂騎士": 80, "地獄奴隸": 80, "喚獸師": 80, "拉斯塔巴德守門人": 460, "魔獸軍王巴蘭卡": 80, "地元素守護者": 772, "水元素守護者": 772, "風元素守護者": 772,
  "火元素守護者": 772, "黑暗妖精法師": 460, "黑法師": 460, "黑暗復仇者": 80, "血色術士": 80, "歐姆戰士": 105, "闇黑君王": 80, "血騎士": 80, "重裝歐姆戰士": 105,
  "拉斯塔巴德近衛隊": 80, "拉斯塔巴德近衛隊隊長": 80, "長老隨從": 80, "長老．琪娜": 80, "長老．安迪斯": 80, "長老．巴塔斯": 80, "長老．巴洛斯": 80, "長老．巴陸德": 80,
  "長老．拉曼斯": 80, "長老．泰瑪斯": 80, "長老．艾迪爾": 80, "法令軍王蕾雅": 80, "冥法軍王海露拜": 80, "暗殺軍王史雷佛": 80, "往上層的樓梯": 64, "變種蛇女": 586,
  "變種楊果里恩": 56, "梅杜莎": 586, "奇美拉": 274, "扭曲的潔尼斯女王": 424, "魔狼": 757, "邪惡密密": 737, "邪惡多眼怪": 287, "死亡之劍": 733,
  "不幸的幻象眼魔": 40, "恐怖的火炎蛋": 663, "恐怖夢魘": 424, "恐怖的地獄犬": 424, "小惡魔": 424, "恐怖的伊弗利特": 639, "恐怖的吸血鬼": 424, "殘暴的骷髏斧兵": 58,
  "殘暴的食屍鬼": 73, "殘暴的骷髏槍兵": 58, "殘暴的史巴托": 58, "殘暴的骷髏神射手": 58, "殘暴的骷髏鬥士": 58, "死亡的殭屍王": 73, "幼龍": 600, "火焰之靈魂(紅)": 58,
  "火焰之靈魂(藍)": 58, "恐怖的鋼鐵高崙": 772, "火焰之魔法師": 36, "骨龍": 600, "地獄的黑豹": 293, "受詛咒的妖魔殭屍": 58, "受詛咒的艾爾摩士兵": 720,
  "受詛咒的艾爾摩法師": 696, "受詛咒的艾爾摩將軍": 693, "不死的木乃伊王": 73, "暗黑萊肯": 71, "冷酷冰原老虎": 747, "火焰烈炎獸": 639, "火焰阿西塔基奧": 651,
  "冷酷的艾莉絲": 424, "暗黑黑騎士": 27, "暗黑火焰戰士": 667, "暗黑火焰弓箭手": 667, "暗黑思克巴女皇": 283, "闇黑的騎士范德": 548, "傲慢的潔尼斯女王": 424,
  "小幻象眼魔": 40, "馬昆斯吸血鬼": 424, "恐怖的殭屍王": 73, "不滅的巫妖": 767, "土精靈王": 157, "水精靈王": 157, "風精靈王": 157, "火精靈王": 157, "艾莉絲": 424,
  "木乃伊王": 73, "騎士范德": 548, "邪惡的鐮刀死神": 767, "地之牙": 157, "風之牙": 157, "水之牙": 730, "火之牙": 634, "水靈之主": 730, "遺忘之島": 64,
  "遺忘之島鱷魚": 554, "遺忘之島狼人": 71, "遺忘之島夏洛伯": 56, "遺忘之島亞力安": 262, "遺忘之島黑暗精靈": 460, "遺忘之島歐熊": 293, "遺忘之島蜥蜴人": 496,
  "遺忘之島卡司特": 105, "遺忘之島蛇女": 586, "遺忘之島萊肯": 71, "遺忘之島巨斧牛人": 530, "遺忘之島食人妖精": 76, "遺忘之島楊果里恩": 56, "遺忘之島格利芬": 274,
  "遺忘之島鏈鎚牛人": 530, "遺忘之島哈維": 245, "遺忘之島變形怪": 61, "遺忘之島巨大鱷魚": 554, "遺忘之島卡司特王": 105, "遺忘之島多羅": 256, "遺忘之島阿魯巴": 277,
  "遺忘之島食人妖精王": 76, "遺忘之島邪惡蜥蜴": 219, "遺忘之島獨眼巨人": 436, "遺忘之島飛龍": 274, "遺忘之島巨大牛人": 530, "深淵食屍鬼": 73, "深淵弓箭手": 58,
  "地靈之主": 157, "風靈之主": 157, "火靈之主": 634, "西斯": 58, "深淵水靈": 730, "深淵地靈": 157, "深淵風靈": 157, "深淵火靈": 634, "曼波兔": 50,
  "深淵之主": 424, "魔蝙蝠": 84, "黑暗妖精盜賊": 460, "闇之精靈": 157, "犰狳": 293, "魔熊": 293, "歐姆民兵": 27, "闇精靈王": 157, "金屬蜈蚣": 196,
  "馴獸師": 460, "墳墓守護者": 772, "墳墓守護者法師": 772, "墳墓守護者騎士": 772, "巨大墳墓守護者": 772, "魔族暗殺團": 58, "炎魔的分身": 424, "黑暗棲林者": 50,
  "炎魔的思克巴": 283, "炎魔的思克巴女皇": 283, "炎魔的小惡魔": 424, "炎魔的巴風特": 68, "墮落的司祭(一階)": 58, "墮落的司祭(二階)": 58, "墮落的司祭(三階)": 58,
  "炎魔的巴列斯": 424, "墮落的司祭(四階)": 58, "墮落的司祭(五階)": 58, "炎魔的惡魔": 424, "墮落": 58, "死亡的司祭(思克巴)": 696, "死亡的司祭(巴風特)": 696,
  "混沌的司祭(飛翼)": 58, "混沌的司祭(野獸)": 58, "火焰之影親衛隊(巴風特)": 720, "混沌": 58, "死亡": 89, "象牙塔紙人": 733, "象牙塔石頭高崙": 772,
  "象牙塔鋼鐵高崙": 772, "象牙塔果凍怪": 61, "象牙塔活鎧甲": 733, "象牙塔死亡之劍": 733, "象牙塔閃電球": 730, "象牙塔密密": 737, "象牙塔長者": 36, "象牙塔黑長者": 36,
  "象牙塔奇美拉": 274, "象牙塔蛇女": 586, "象牙塔黑魔法師": 36, "象牙塔死神": 767, "象牙塔影魔": 58, "象牙塔惡靈": 58, "象牙塔巴列斯之影": 424, "卡魯塔": 507,
  "哈汀之影": 36, "象牙塔炎魔的奴隸": 424, "象牙塔小惡魔": 424, "象牙塔巴風特之影": 68, "象牙塔翼魔": 424, "象牙塔炎魔之影": 424, "象牙塔惡魔之影": 424, "白螞蟻群": 196,
  "巨大白螞蟻": 196, "強化巨蟻": 196, "強化白螞蟻群": 196, "巨大突擊螞蟻": 196, "巨大強化白螞蟻": 196, "巨大守護螞蟻": 196, "狂野之毒": 84, "狂暴蜥蜴人": 496,
  "狂野毒牙": 84, "狂野之魔": 84, "高等蜥蜴人": 496, "藍尾蜥蜴": 84, "奇異鸚鵡": 84, "藏寶箱": 94, "海賊骷髏": 58, "重裝蜥蜴人": 496, "海賊骷髏士兵": 58,
  "海賊骷髏刀手": 58, "海賊骷髏首領": 58, "德雷克": 58,
};

var _sfxDynTried = {}, _mobHurtLast = 0, _spellCastLast = 0, _killLast = 0;
function _sfxPlayPool(poolKey, vol) {   // 直接播放指定 pool key（不查 SFX_DEFS、不額外節流；節流由呼叫端負責）
    var arr = _sfxPool[poolKey]; if (!arr || !arr.length) return false;
    try {
        var idx = _sfxIdx[poolKey] || 0; var a = arr[idx % arr.length]; _sfxIdx[poolKey] = idx + 1;
        a.volume = Math.max(0, Math.min(1, (vol || 0.5) * (_sfxCfg.vol / 100)));
        try { a.currentTime = 0; } catch (e) {}
        var p = a.play(); if (p && p.catch) p.catch(function () {});
        return true;
    } catch (e) { return false; }
}
function _sfxDynLoad(poolKey, file) { if (_sfxDynTried[poolKey]) return; _sfxDynTried[poolKey] = true; _sfxTryLoad(poolKey, { file: file || poolKey }); }
function playMobHurt(mob) {
    if (!_sfxCfg.on || !mob) return;
    var n = MOB_HURT_SFX[mob.n]; if (n === undefined) return;   // 沒對應→不出聲（不退回通用，避免亂套）
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (now - _mobHurtLast < 90) return;   // 全域節流：多目標／連擊不洗版
    _mobHurtLast = now;
    var key = 'mob_' + n;
    if (_sfxPool[key] === undefined) { _sfxDynLoad(key, '' + n); return; }   // 檔名＝音效庫編號 <n>（首次載入；載好後下次起出聲）
    _sfxPlayPool(key, 0.50);   // 缺檔(null)→_sfxPlayPool 回 false→靜音
}
function playSpellCast(skn) {
    if (!_sfxCfg.on) return;
    var n = (skn != null) ? SPELL_SFX[skn] : undefined;
    if (n === undefined) { playSfx('magic'); return; }   // 無專屬→通用魔法音
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (now - _spellCastLast < 80) return;
    _spellCastLast = now;
    var key = 'spell_' + n;
    if (_sfxPool[key] === undefined) { _sfxDynLoad(key, '' + n); playSfx('magic'); return; }   // 首次載入時先用通用音墊著
    if (!_sfxPlayPool(key, 0.55)) playSfx('magic');   // 缺檔(null)→退回通用魔法音
}

function playMobKill(mob) {
    if (!_sfxCfg.on) return;
    var n = (mob && mob.n != null) ? MOB_KILL_SFX[mob.n] : undefined;
    if (n === undefined) { playSfx('kill'); return; }   // 無對應→通用擊殺音
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (now - _killLast < 80) return;
    _killLast = now;
    var key = 'kill_' + n;
    if (_sfxPool[key] === undefined) { _sfxDynLoad(key, '' + n); playSfx('kill'); return; }   // 首次載入時先用通用擊殺音墊著
    if (!_sfxPlayPool(key, 0.60)) playSfx('kill');   // 缺檔(null)→退回通用擊殺音
}

// ===== 🎵 背景音樂（分場景 · HTMLAudio 雙元素交叉淡入淡出 · 自我輪詢偵測場景，無戰鬥碼掛鉤）=====
//   場景 title(登入)/create(創角畫面)/town(共通安全區)/battle(野外戰鬥)/boss(頭目戰)＋13 個專屬 BGM 城鎮(見 TOWN_BGM_LIST·scene=城鎮id)；音檔 assets/bgm/<scene>.<mp3|ogg|wav>。
//   缺某場景音檔（或尚未解析完成）→保持目前曲目、不切換。BGM 音量/開關與音效獨立（存 'fb5_bgm'）。
var _bgmCfg = { on: true, vol: 35 };
// 🎵 場景：title(標題)/create(創角畫面)/town(共通安全區)/battle(野外)/boss(頭目)＋下列「專屬 BGM 城鎮」(scene key = 城鎮地圖 id·檔名同名)；其餘城鎮皆用共通 'town'。
var TOWN_BGM_LIST = [
    'town_silent',        // 沉默洞穴
    'town_ivory_tower',   // 象牙塔
    'town_talking',       // 說話之島
    'town_kent_castle',   // 肯特城（肯特村）
    'town_elf',           // 妖精森林
    'town_giran',         // 奇岩
    'town_heine',         // 海音
    'town_aden',          // 亞丁
    'town_oren',          // 歐瑞村
    'town_gludio',        // 燃柳村
    'town_silver_knight', // 銀騎士村
    'town_witon',         // 威頓村
    'town_pride',         // 傲慢之塔入口
    'town_windwood_castle', // 風木城堡
];
var BGM_TRACKS = { title: 'title', create: 'create', town: 'town', battle: 'battle', boss: 'boss' };
TOWN_BGM_LIST.forEach(function (id) { BGM_TRACKS[id] = id; });   // 各專屬城鎮：scene=id、檔=assets/bgm/<id>.<ext>
var _TOWN_BGM = {}; TOWN_BGM_LIST.forEach(function (id) { _TOWN_BGM[id] = 1; });
var _bgmUrl = {}, _bgmEls = [null, null], _bgmActive = -1, _bgmScene = null, _bgmFadeTimer = null, _bgmInited = false;

function _bgmLoadCfg() {
    try {
        var s = (typeof _lsGet === 'function') ? _lsGet('fb5_bgm') : null;
        if (s) { var o = JSON.parse(s); if (o && typeof o === 'object') { _bgmCfg.on = (o.on !== false); _bgmCfg.vol = (typeof o.vol === 'number') ? o.vol : 35; } }
    } catch (e) {}
}
function _bgmSaveCfg() { try { if (typeof _lsSet === 'function') _lsSet('fb5_bgm', JSON.stringify(_bgmCfg)); } catch (e) {} }
function _bgmTargetVol() { return Math.max(0, Math.min(1, _bgmCfg.vol / 100)); }

// 預解析各場景的實際 URL（依序試 mp3→ogg→wav）；缺檔→_bgmUrl[scene]=null
function _bgmResolve(scene, file) {
    var exts = ['mp3', 'ogg', 'wav'], i = 0;
    (function tryNext() {
        if (i >= exts.length) { _bgmUrl[scene] = null; return; }
        var url = 'assets/bgm/' + file + '.' + exts[i++];
        var probe = new Audio(); probe.preload = 'metadata';
        probe.addEventListener('canplay', function () { _bgmUrl[scene] = url; }, { once: true });
        probe.addEventListener('error', function () { tryNext(); }, { once: true });
        probe.src = url; try { probe.load(); } catch (e) {}
    })();
}

function _bgmIsCreateScreen() {   // 創角面板可見（#creation-panel 未 hidden）＝玩家正在創角
    if (typeof document === 'undefined') return false;
    var p = document.getElementById('creation-panel');
    return !!(p && p.classList && !p.classList.contains('hidden'));
}
function _bgmDetectScene() {
    if (typeof player === 'undefined' || !player || !player.cls) return _bgmIsCreateScreen() ? 'create' : 'title';   // 未建角：創角畫面→create、否則標題
    var cur = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
    if (cur && cur.indexOf('town_') === 0) return _TOWN_BGM[cur] ? cur : 'town';   // 專屬城鎮→自己的曲；其餘安全區→共通 town
    if (typeof mapState !== 'undefined' && mapState && mapState.mobs && mapState.mobs.some(function (m) { return m && m.boss && m.curHp > 0; })) return 'boss';
    return 'battle';
}

function _bgmCrossfade(oldEl, newEl) {
    if (_bgmFadeTimer) clearInterval(_bgmFadeTimer);
    var target = _bgmTargetVol(), steps = 20, n = 0;
    _bgmFadeTimer = setInterval(function () {
        n++; var t = n / steps;
        if (newEl) newEl.volume = Math.max(0, Math.min(1, target * t));
        if (oldEl) oldEl.volume = Math.max(0, Math.min(1, target * (1 - t)));
        if (n >= steps) { clearInterval(_bgmFadeTimer); _bgmFadeTimer = null; if (oldEl) { try { oldEl.pause(); } catch (e) {} } }
    }, 50);   // 20 步 × 50ms = 1 秒交叉淡化
}

function _bgmSwitch(scene) {
    if (!_bgmCfg.on) return;
    if (scene === _bgmScene) return;
    var url = _bgmUrl[scene];
    if (!url) return;   // 該場景無音檔（或尚未解析完）→不更新場景、保持目前曲目，下次輪詢再試
    _bgmScene = scene;
    var newIdx = (_bgmActive === 0) ? 1 : 0;
    if (!_bgmEls[newIdx]) { var e0 = new Audio(); e0.loop = true; e0.preload = 'auto'; e0.volume = 0; _bgmEls[newIdx] = e0; }
    var nu = _bgmEls[newIdx], old = (_bgmActive >= 0) ? _bgmEls[_bgmActive] : null;
    try { if (!nu.src || nu.src.indexOf(url) === -1) nu.src = url; nu.currentTime = 0; } catch (e) {}
    nu.volume = 0;
    var p = nu.play(); if (p && p.catch) p.catch(function () {});   // autoplay 未解鎖→忽略，下次輪詢再試
    _bgmCrossfade(old, nu);
    _bgmActive = newIdx;
}
function _bgmStopAll() {
    if (_bgmFadeTimer) { clearInterval(_bgmFadeTimer); _bgmFadeTimer = null; }
    for (var i = 0; i < 2; i++) { if (_bgmEls[i]) { try { _bgmEls[i].pause(); } catch (e) {} _bgmEls[i].volume = 0; } }
    _bgmActive = -1;
}
function _bgmTick() { if (_bgmInited) { try { _bgmSwitch(_bgmDetectScene()); } catch (e) {} } }

function setBgmOn(on) { _bgmCfg.on = !!on; _bgmSaveCfg(); if (!on) { _bgmStopAll(); _bgmScene = null; } else { _bgmScene = null; _bgmTick(); } }
function setBgmVol(v) { _bgmCfg.vol = Math.max(0, Math.min(100, parseInt(v, 10) || 0)); _bgmSaveCfg(); if (!_bgmFadeTimer && _bgmActive >= 0 && _bgmEls[_bgmActive]) _bgmEls[_bgmActive].volume = _bgmTargetVol(); }
function _bgmSyncUI() {
    var c = document.getElementById('set-bgm-on'); if (c) c.checked = !!_bgmCfg.on;
    var v = document.getElementById('set-bgm-vol'); if (v) v.value = _bgmCfg.vol;
}
function _bgmInit() {
    if (_bgmInited) return; _bgmInited = true;
    _bgmLoadCfg();
    Object.keys(BGM_TRACKS).forEach(function (s) { _bgmResolve(s, BGM_TRACKS[s]); });
    _bgmSyncUI();
    setInterval(_bgmTick, 1000);   // 自我輪詢場景（每秒；只在場景改變時切換）
    var kick = function () { _bgmScene = null; _bgmTick(); };   // 首次互動立即啟動（autoplay 解鎖）
    document.addEventListener('pointerdown', kick, { once: true });
    document.addEventListener('keydown', kick, { once: true });
}

if (typeof document !== 'undefined') {
    var _audioInit = function () { _sfxInit(); _bgmInit(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _audioInit);
    else _audioInit();
}
