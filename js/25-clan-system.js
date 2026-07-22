// ===== Account clan system =====
// Clan level is shared by all modes. Clan membership, leader and castle are
// separated between normal/classic mode, while contribution belongs to a role.
const CLAN_STATE_KEY = 'fb5_clan_state_v1';
const CLAN_LOCK_KEY = 'fb5_clan_state_v1_lock';
const CLAN_CREATE_COST = 30000;
const CLAN_BUFF_HOUR_MS = 60 * 60 * 1000;
const CLAN_BUFF_HOUR_COST = 5;
const CLAN_LEVEL_COSTS = [1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 250000];
const CLAN_BUFF_BY_LEVEL = [
    null,
    { hp:20,  mp:5,  extraDmg:1, extraHit:1, mr:1,  magicDmg:1, hpR:1,  mpR:1,  ac:-1 },
    { hp:30,  mp:5,  extraDmg:1, extraHit:1, mr:2,  magicDmg:1, hpR:2,  mpR:2,  ac:-1 },
    { hp:40,  mp:10, extraDmg:2, extraHit:2, mr:3,  magicDmg:2, hpR:3,  mpR:3,  ac:-2 },
    { hp:50,  mp:15, extraDmg:2, extraHit:2, mr:4,  magicDmg:2, hpR:4,  mpR:4,  ac:-2 },
    { hp:60,  mp:20, extraDmg:3, extraHit:3, mr:5,  magicDmg:3, hpR:5,  mpR:5,  ac:-3 },
    { hp:70,  mp:25, extraDmg:3, extraHit:3, mr:6,  magicDmg:3, hpR:6,  mpR:6,  ac:-3 },
    { hp:80,  mp:30, extraDmg:4, extraHit:4, mr:7,  magicDmg:4, hpR:7,  mpR:7,  ac:-4 },
    { hp:100, mp:35, extraDmg:4, extraHit:4, mr:8,  magicDmg:4, hpR:8,  mpR:8,  ac:-4 },
    { hp:120, mp:40, extraDmg:5, extraHit:5, mr:9,  magicDmg:5, hpR:9,  mpR:9,  ac:-5 },
    { hp:150, mp:50, extraDmg:5, extraHit:5, mr:10, magicDmg:5, hpR:10, mpR:10, ac:-5 }
];
const CLAN_CLASS_NAMES = {
    royal:'王族', knight:'騎士', elf:'妖精', mage:'法師', dark:'黑暗妖精',
    dragon:'龍騎士', warrior:'戰士', illusion:'幻術士'
};
const CLAN_CASTLE_NAMES = { kent:'肯特城', windwood:'風木城', heine:'海音城' };
const NPC_CLAN_WORLD_COUNT = 20;
const NPC_CLAN_MORALE_MAX = 1000;
const NPC_CLAN_HATRED_MAX = 100;
const NPC_CLAN_HATRED_DECAY_MS = 60 * 60 * 1000;
const NPC_CLAN_WAR_MIN_MS = 24 * 60 * 60 * 1000;
const NPC_CLAN_COUNTER_WAR_STEP = 0.05;
const NPC_CLAN_GROUP_CHANCE = 0.01;
const NPC_CLAN_WAR_ENCOUNTER_CHANCE = 0.80;
const NPC_CLAN_PLAYER_WAR_ENCOUNTER_CHANCE = 0.50;
const NPC_CLAN_MUTUAL_WILD_CHANCE = 0.03;
const NPC_CLAN_DEFAULT_MEMBER_CHANCE = 0.50;
const NPC_CLAN_MERCY_MIN_MS = 10 * 60 * 1000;
const NPC_CLAN_MERCY_MAX_MS = 30 * 60 * 1000;
const NPC_CLAN_NAME_STEMS = [
    '亞丁','奇岩','海音','風木','肯特','銀騎士','古魯丁','傲塔','龍谷','火龍窟',
    '月光','星塵','蒼炎','緋月','極夜','黎明','黃昏','神域','王者','戰神',
    '風暴','幻影','永恆','無名','赤月','黑曜','天羽','雷霆','聖光','冥界',
    '說島','歐瑞','威頓','亞丁城','日出','遺忘島','夢幻島','象牙塔','拉斯塔巴德','時空裂痕',
    '晨曦','暮色','流星','銀河','天穹','碧海','白銀','赤焰','霜雪','疾風',
    '大地','烈陽','幽影','紫電','青嵐','玄武','朱雀','白虎','青龍','鳳凰',
    '修羅','羅剎','天命','宿命','榮耀','自由','誓約','羈絆','信念','勇者',
    '不朽','不敗','逆風','追夢','放置','回憶','初心','狂想','樂園','桃源'
];
const NPC_CLAN_NAME_FORMS = [
    '近衛軍','遠征隊','騎士團','旅團','十字軍','同盟','皇朝','聖殿','神話','傳說',
    '禁衛隊','守望者','冒險團','兄弟會','茶會','俱樂部','聯合軍','傭兵團','公會','王國',
    '親衛隊','討伐隊','探索隊','突擊隊','先鋒隊','護衛隊','守備隊','遊擊隊','特攻隊','救援隊',
    '獵團','戰隊','軍團','兵團','義勇軍','護國軍','聯盟','聯邦','議會','評議會',
    '元老院','學院','學社','研究社','事務所','商會','協會','會館','本部','總部',
    '殿堂','聖堂','王庭','帝國','領地','領域','國度','樂園','家族','世家',
    '一族','門派','山莊','山寨','酒館','旅店','食堂','廣場','聊天室','同好會'
];
const NPC_CLAN_NAME_CURATED = [
    '血色黎明','月下神殿','黑夜十字軍','蒼穹之翼','末日審判','永恆國度','神話再臨','王者天下',
    '亂世梟雄','群英會','雨夜星辰','緋色幻想','蔚藍天空','銀月旅團','暗夜玫瑰','極惡世代',
    '無限輪迴','龍魂殿','星夜誓約','風之羈絆','諸神黃昏','聖域之門','夢境彼端','天命之翼',
    '鐵血丹心','榮耀殿堂','自由之丘','不滅戰魂','逆天而行','眾神領域','一騎當千','天下無雙',
    '亞丁夜未眠','奇岩不打烊','海音觀光團','風木流浪漢','肯特守門員','說島同學會','傲塔房客',
    '龍谷巡田隊','紅水喝到飽','回卷隨身帶','掛網也要贏','今晚不下線','打寶靠信仰','安定值歸零',
    '盟倉保全隊','祝武研究社','藍布追夢人','包場先講理','補機俱樂部','老司機聯盟','只收自己人',
    'NoMercy','OnlyOne','JustPlay','Lineage魂','NeverDie','LastOrder','OneShot','RoyalGuard',
    '夜貓俱樂部','夏夜微光','午後紅茶會','星空下集合','記得帶回卷','今天有出寶','明天再攻城',
    '別問掉寶率','全村的希望','盟主又迷路','補師先別睡','騎士向前衝','妖精站後排','法師沒魔了',
    '黑妖不隱身','王族在開會','龍騎很忙','戰士喝紅水','幻術都是夢'
];
const NPC_CLAN_DISSOLVE_REASONS = [
    '內部為了盟倉分配吵到翻桌，成員一夜散光。',
    '攻城指揮連續下錯命令，幹部集體退盟。',
    '盟主突然宣布隱居，沒有人願意接下爛攤子。',
    '成員對練功區分配意見不合，最後各走各的。',
    '血盟會議從晚上吵到天亮，談完只剩盟主在線。',
    '盟倉帳目對不上，猜疑讓整個血盟分崩離析。',
    '主力成員轉戰別服，留下的人決定解散。',
    '攻城失利後互相甩鍋，血盟當場拆夥。',
    '長期士氣低迷，成員陸續摘下盟徽。',
    '盟主說只是暫離一下，結果再也沒有上線。',
    '分裝規則改了又改，最後沒有人願意留下。',
    '語音頻道天天吵架，幹部決定關盟收場。',
    '主戰派與和平派徹底決裂，血盟正式瓦解。',
    '成員嫌盟主只會喊集合，乾脆集體退盟。',
    '連續幾場團戰慘敗，最後一點向心力也耗盡。',
    '血盟名稱被笑太久，大家決定各自重新開始。',
    '補師與前排互相封鎖，團隊再也組不起來。',
    '盟內選舉談不攏，兩派人馬各自另立門戶。',
    '城堡夢碎之後，成員決定把盟徽留在倉庫。',
    '盟主把集合時間記錯三次，血盟就此成為歷史。'
];
const NPC_CLAN_MERCY_LINES = [
    '我們已經不想再打了，這場恩怨到此為止吧。',
    '盟裡的人快散光了，能不能停戰？',
    '你贏了，我們願意解除敵對，別再追了。',
    '再打下去大家都不用練功，談個停戰吧。',
    '之前是我們太衝，現在只想把盟帶回正軌。',
    '盟主親自來談，這次真的想停戰。',
    '我們會撤掉追殺，這筆帳就算了好嗎？',
    '城也丟了、人也散了，給彼此一條路吧。',
    '你們的實力我們認了，解除敵對吧。',
    '再這樣下去血盟要解散了，停手吧。'
];
const NPC_CLAN_TAUNT_LINES = [
    '現在才知道怕？把人叫齊再來談。',
    '求饒太小聲了，頻道上的人聽不到。',
    '不是很會包場？怎麼開始談和平了。',
    '盟徽先別摘，我還沒打夠。',
    '剛剛的氣勢去哪了？再組一團來。',
    '想停戰可以，先證明你們不是只會躺。',
    '你們不是說見一次殺一次？繼續啊。',
    '回去補滿紅水，我等你們再來一次。',
    '求饒不算輸，解散才算。',
    '盟主都開口了，那我只好打得更認真。'
];

let _clanLastSettleByRole = Object.create(null);
let _npcClanNamePoolCache = null;
let _npcClanNamePartsCache = Object.create(null);
const NPC_CLAN_NAME_STEMS_LONGEST = NPC_CLAN_NAME_STEMS.slice().sort((a, b) => b.length - a.length);
const NPC_CLAN_NAME_FORMS_LONGEST = NPC_CLAN_NAME_FORMS.slice().sort((a, b) => b.length - a.length);
let _npcClanWarCache = {
    normal:{ at:0, ids:[], playerIds:[], npcIds:[], mutualIds:[] },
    classic:{ at:0, ids:[], playerIds:[], npcIds:[], mutualIds:[] }
};
let _clanPanelView = 'home';

function _clanDefaultState() {
    return {
        v:2,
        xp:0,
        modes:{ normal:null, classic:null },
        members:{},
        npcWorlds:{ normal:null, classic:null },
        updatedAt:Date.now()
    };
}

function clanModeKey(p) {
    return p && p.classicMode ? 'classic' : 'normal';
}

function clanRoleId(p) {
    if (!p || !p.cls) return '';
    if (p.enSeed) return String(p.enSeed).slice(0, 96);
    let src = [p.name || '', p.cls || '', p.avatar || '', p.classicMode ? 'classic' : 'normal'].join('|');
    if (typeof _seedHash === 'function') return 'legacy_' + _seedHash(src).toString(36);
    let h = 2166136261;
    for (let i = 0; i < src.length; i++) { h ^= src.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'legacy_' + (h >>> 0).toString(36);
}

function _clanNormalizeMode(raw) {
    if (!raw || typeof raw !== 'object') return null;
    let name = String(raw.name || '').trim().slice(0, 20);
    let leaderId = String(raw.leaderId || '').slice(0, 96);
    if (!name || !leaderId) return null;
    let faction = raw.faction === 'esti' ? 'esti' : 'tros';
    let castle = Object.prototype.hasOwnProperty.call(CLAN_CASTLE_NAMES, raw.castle) ? raw.castle : null;
    return {
        name:name,
        leaderId:leaderId,
        faction:faction,
        createdAt:Math.max(0, Math.floor(Number(raw.createdAt) || 0)),
        castle:castle
    };
}

function _npcClanNamePool() {
    if (_npcClanNamePoolCache) return _npcClanNamePoolCache.slice();
    let names = NPC_CLAN_NAME_CURATED.slice();
    NPC_CLAN_NAME_STEMS.forEach(stem => {
        NPC_CLAN_NAME_FORMS.forEach(form => names.push(stem + form));
    });
    _npcClanNamePoolCache = Array.from(new Set(names.map(n => String(n || '').trim()).filter(n => n && n.length <= 20)));
    return _npcClanNamePoolCache.slice();
}

function _npcClanNameParts(name) {
    name = String(name || '');
    if (_npcClanNamePartsCache[name]) return _npcClanNamePartsCache[name];
    let parts = {
        stem:NPC_CLAN_NAME_STEMS_LONGEST.find(part => name.indexOf(part) === 0) || '',
        form:NPC_CLAN_NAME_FORMS_LONGEST.find(part => name.endsWith(part)) || ''
    };
    _npcClanNamePartsCache[name] = parts;
    return parts;
}

function _npcClanNameUsage(world, ignoreClanId) {
    let stems = Object.create(null), forms = Object.create(null);
    (world && Array.isArray(world.clans) ? world.clans : []).forEach(clan => {
        if (!clan || clan.id === ignoreClanId) return;
        let parts = _npcClanNameParts(clan.name);
        if (parts.stem) stems[parts.stem] = (stems[parts.stem] || 0) + 1;
        if (parts.form) forms[parts.form] = (forms[parts.form] || 0) + 1;
    });
    return { stems:stems, forms:forms };
}

function _npcClanPickDiverseName(world, ignoreClanId, avoidName) {
    let used = new Set((world && Array.isArray(world.clans) ? world.clans : [])
        .filter(clan => clan && clan.id !== ignoreClanId)
        .map(clan => clan.name));
    let retired = new Set((world && Array.isArray(world.retiredNames) ? world.retiredNames : []));
    let available = _npcClanNamePool().filter(name => name !== avoidName && !used.has(name) && !retired.has(name));
    if (!available.length) return null;

    let usage = _npcClanNameUsage(world, ignoreClanId);
    let best = [], bestScore = Infinity;
    available.forEach(name => {
        let parts = _npcClanNameParts(name);
        let score = (parts.stem ? (usage.stems[parts.stem] || 0) : 0) +
            (parts.form ? (usage.forms[parts.form] || 0) : 0);
        if (score < bestScore) {
            bestScore = score;
            best = [name];
        } else if (score === bestScore) {
            best.push(name);
        }
    });
    return _npcClanPick(best);
}

function _npcClanDefaultWorld() {
    let now = Date.now();
    return {
        v:2,
        clans:[],
        memberships:{},
        castleOwners:{ kent:null, windwood:null, heine:null },
        retiredNames:[],
        lastHateDecayAt:now,
        createdAt:now
    };
}

function _npcClanNormalizeLeader(raw) {
    if (!raw || typeof raw !== 'object') return null;
    let name = String(raw.n || '').trim().slice(0, 24);
    if (!name) return null;
    let avatar = raw.avatar === '公主' ? '公主' : '王子';
    return {
        n:name,
        avatar:avatar,
        alignmentValue:typeof pvpClampAlignment === 'function' ? pvpClampAlignment(raw.alignmentValue) : Math.max(-32767, Math.min(32767, Math.round(Number(raw.alignmentValue) || 0))),
        levelOffset:Math.max(-10, Math.min(10, Math.round(Number(raw.levelOffset) || 0)))
    };
}

function _npcClanNormalizeEntry(raw, legacyCombinedWar) {
    if (!raw || typeof raw !== 'object') return null;
    let id = String(raw.id || '').slice(0, 64);
    let name = String(raw.name || '').trim().slice(0, 20);
    if (!id || !name) return null;
    let morale = Math.max(0, Math.min(NPC_CLAN_MORALE_MAX, Math.round(Number(raw.morale) || 0)));
    let hatred = Math.max(0, Math.min(NPC_CLAN_HATRED_MAX, Math.round(Number(raw.hatred) || 0)));
    let mercy = null;
    if (raw.mercy && typeof raw.mercy === 'object' && raw.mercy.pending) {
        mercy = {
            pending:true,
            nextAt:Math.max(0, Math.floor(Number(raw.mercy.nextAt) || 0))
        };
    }
    let playerWar = !!raw.war;
    let npcHostile = !!raw.hostile || (!!legacyCombinedWar && playerWar);
    let warStartedAt = playerWar
        ? Math.max(0, Math.floor(Number(raw.warStartedAt) || Number(raw.createdAt) || 0))
        : 0;
    let counterWarChance = playerWar && !npcHostile ? Math.max(0, Math.min(1, Number(raw.counterWarChance) || 0)) : 0;
    return {
        id:id,
        name:name,
        morale:morale,
        hatred:hatred,
        known:!!raw.known || npcHostile || playerWar,
        hostile:npcHostile,
        war:playerWar,
        warStartedAt:warStartedAt,
        counterWarChance:counterWarChance,
        mercyUsed:!!raw.mercyUsed,
        mercy:mercy,
        leader:_npcClanNormalizeLeader(raw.leader),
        createdAt:Math.max(0, Math.floor(Number(raw.createdAt) || 0))
    };
}

function _npcClanNormalizeMembership(raw) {
    if (!raw || typeof raw !== 'object') return null;
    let clanId = raw.clanId == null ? null : String(raw.clanId).slice(0, 64);
    let avatar = (typeof TROLL_CLASS_BY_AVATAR !== 'undefined' && TROLL_CLASS_BY_AVATAR[raw.avatar]) ? raw.avatar : '男戰士';
    return {
        clanId:clanId,
        leader:!!raw.leader,
        avatar:avatar,
        alignmentValue:typeof pvpClampAlignment === 'function' ? pvpClampAlignment(raw.alignmentValue) : Math.max(-32767, Math.min(32767, Math.round(Number(raw.alignmentValue) || 0))),
        levelOffset:Math.max(-10, Math.min(10, Math.round(Number(raw.levelOffset) || 0))),
        assignedAt:Math.max(0, Math.floor(Number(raw.assignedAt) || 0))
    };
}

function _npcClanNormalizeWorld(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    let out = _npcClanDefaultWorld();
    let legacyCombinedWar = Math.max(1, Math.floor(Number(raw.v) || 1)) < 2;
    out.clans = (Array.isArray(raw.clans) ? raw.clans : []).map(clan => _npcClanNormalizeEntry(clan, legacyCombinedWar)).filter(Boolean).slice(0, NPC_CLAN_WORLD_COUNT);
    let validIds = new Set(out.clans.map(c => c.id));
    if (raw.memberships && typeof raw.memberships === 'object' && !Array.isArray(raw.memberships)) {
        Object.keys(raw.memberships).slice(0, 10000).forEach(name => {
            let rec = _npcClanNormalizeMembership(raw.memberships[name]);
            if (!rec || (rec.clanId && !validIds.has(rec.clanId))) return;
            out.memberships[String(name).slice(0, 24)] = rec;
        });
    }
    out.castleOwners = { kent:null, windwood:null, heine:null };
    Object.keys(out.castleOwners).forEach(city => {
        let id = raw.castleOwners && raw.castleOwners[city] != null ? String(raw.castleOwners[city]).slice(0, 64) : null;
        out.castleOwners[city] = id && validIds.has(id) ? id : null;
    });
    out.retiredNames = Array.from(new Set((Array.isArray(raw.retiredNames) ? raw.retiredNames : [])
        .map(n => String(n || '').trim().slice(0, 20)).filter(Boolean))).slice(-500);
    out.lastHateDecayAt = Math.max(0, Math.floor(Number(raw.lastHateDecayAt) || Date.now()));
    out.createdAt = Math.max(0, Math.floor(Number(raw.createdAt) || Date.now()));
    return out;
}

function _clanNormalizeState(raw) {
    let out = _clanDefaultState();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    out.xp = Math.max(0, Math.min(1000000000000, Math.floor(Number(raw.xp) || 0)));
    out.modes.normal = _clanNormalizeMode(raw.modes && raw.modes.normal);
    out.modes.classic = _clanNormalizeMode(raw.modes && raw.modes.classic);
    if (raw.members && typeof raw.members === 'object' && !Array.isArray(raw.members)) {
        Object.keys(raw.members).slice(0, 128).forEach(id => {
            let m = raw.members[id];
            if (!m || typeof m !== 'object') return;
            let buffAt = Math.max(0, Math.floor(Number(m.buffAt) || 0));
            out.members[String(id).slice(0, 96)] = {
                mode:m.mode === 'classic' ? 'classic' : 'normal',
                contribution:Math.max(0, Math.min(1000000000000, Math.floor(Number(m.contribution) || 0))),
                buffOn:!!m.buffOn && buffAt > 0,
                buffAt:buffAt
            };
        });
    }
    out.npcWorlds.normal = _npcClanNormalizeWorld(raw.npcWorlds && raw.npcWorlds.normal);
    out.npcWorlds.classic = _npcClanNormalizeWorld(raw.npcWorlds && raw.npcWorlds.classic);
    out.updatedAt = Math.max(0, Math.floor(Number(raw.updatedAt) || Date.now()));
    return out;
}

function _clanReadStateResult() {
    try {
        let raw = (typeof _lzGet === 'function') ? _lzGet(CLAN_STATE_KEY) : localStorage.getItem(CLAN_STATE_KEY);
        if (raw == null || raw === '') return { ok:true, state:_clanDefaultState() };
        let text = raw;
        if (typeof _saveUnwrap === 'function') {
            let u = _saveUnwrap(raw);
            if (u && u.signed && !u.ok) return { ok:false, error:'血盟資料完整性校驗失敗。' };
            if (u && u.payload != null) text = u.payload;
        }
        return { ok:true, state:_clanNormalizeState(JSON.parse(text)) };
    } catch (e) {
        return { ok:false, error:'血盟資料無法讀取。' };
    }
}

function _clanReadState() {
    let result = _clanReadStateResult();
    return result.ok ? result.state : null;
}

function _clanWriteState(st) {
    try {
        st.v = 2;
        st.updatedAt = Date.now();
        let clean = _clanNormalizeState(st);
        let raw = JSON.stringify(clean);
        if (typeof _saveWrap === 'function') raw = _saveWrap(raw);
        let ok;
        if (typeof _lzSet === 'function') ok = !!_lzSet(CLAN_STATE_KEY, raw);
        else {
            localStorage.setItem(CLAN_STATE_KEY, raw);
            ok = true;
        }
        if (ok) {
            let now = Date.now();
            ['normal', 'classic'].forEach(mode => {
                let world = clean.npcWorlds[mode];
                _npcClanWarCache[mode] = _npcClanConflictSnapshot(world, now);
            });
        }
        return ok;
    } catch (e) {
        return false;
    }
}

function _clanStorageGet(key) {
    if (typeof _lsGet === 'function') return _lsGet(key);
    return localStorage.getItem(key);
}

function _clanStorageSet(key, value) {
    if (typeof _lsSet === 'function') return !!_lsSet(key, value);
    localStorage.setItem(key, value);
    return true;
}

function _clanStorageRemove(key) {
    if (typeof _lsRemove === 'function') _lsRemove(key);
    else localStorage.removeItem(key);
}

function _clanWithLock(mutator) {
    let now = Date.now();
    let token = Math.random().toString(36).slice(2) + now.toString(36);
    let stamp = token + '|' + now;
    try {
        let old = _clanStorageGet(CLAN_LOCK_KEY);
        if (old) {
            let pos = old.lastIndexOf('|');
            let oldAt = pos >= 0 ? Number(old.slice(pos + 1)) : 0;
            if (oldAt && now - oldAt < 5000) return { ok:false, busy:true, error:'血盟資料正在由其他分頁更新，請稍後重試。' };
        }
        if (!_clanStorageSet(CLAN_LOCK_KEY, stamp) || _clanStorageGet(CLAN_LOCK_KEY) !== stamp) {
            return { ok:false, busy:true, error:'血盟資料正在由其他分頁更新，請稍後重試。' };
        }
        let read = _clanReadStateResult();
        if (!read.ok) return { ok:false, error:read.error };
        let st = read.state;
        let result = mutator(st) || {};
        if (result.commit === false) return Object.assign({ ok:false, state:st }, result);
        if (!_clanWriteState(st)) return { ok:false, state:st, error:'血盟資料儲存失敗，請稍後重試。' };
        return Object.assign({ ok:true, state:st }, result);
    } catch (e) {
        return { ok:false, error:'血盟資料暫時忙碌，請稍後重試。' };
    } finally {
        try { if (_clanStorageGet(CLAN_LOCK_KEY) === stamp) _clanStorageRemove(CLAN_LOCK_KEY); } catch (e) {}
    }
}

function _npcClanPick(list) {
    return list && list.length ? list[Math.floor(Math.random() * list.length)] : null;
}

function _npcClanShuffle(list) {
    list = (list || []).slice();
    for (let i = list.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        let tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    }
    return list;
}

function _npcClanNewId(mode) {
    return 'npc_' + mode + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

function _npcClanNewLeader(world) {
    let used = new Set(Object.keys(world.memberships || {}));
    let name = '';
    for (let tries = 0; tries < 100; tries++) {
        name = typeof pvpRandomName === 'function' ? pvpRandomName() : ('盟主' + Math.floor(Math.random() * 99999));
        if (!used.has(name)) break;
    }
    if (!name || used.has(name)) name = '盟主' + Date.now().toString(36).slice(-6);
    return {
        n:String(name).slice(0, 24),
        avatar:Math.random() < 0.5 ? '王子' : '公主',
        alignmentValue:typeof pvpRandomAlignment === 'function' ? pvpRandomAlignment() : Math.floor(Math.random() * 65535) - 32767,
        levelOffset:typeof pvpRandomLevelOffset === 'function' ? pvpRandomLevelOffset() : Math.floor(Math.random() * 21) - 10
    };
}

function _npcClanCreateOne(world, mode) {
    let name = _npcClanPickDiverseName(world, null, '');
    if (!name) {
        world.retiredNames = [];
        name = _npcClanPickDiverseName(world, null, '');
    }
    let leader = _npcClanNewLeader(world);
    let clan = {
        id:_npcClanNewId(mode),
        name:name || ('亞丁血盟' + Math.floor(Math.random() * 9999)),
        morale:500,
        hatred:0,
        known:false,
        hostile:false,
        war:false,
        warStartedAt:0,
        counterWarChance:0,
        mercyUsed:false,
        mercy:null,
        leader:leader,
        createdAt:Date.now()
    };
    world.clans.push(clan);
    world.memberships[leader.n] = {
        clanId:clan.id,
        leader:true,
        avatar:leader.avatar,
        alignmentValue:leader.alignmentValue,
        levelOffset:leader.levelOffset,
        assignedAt:Date.now()
    };
    return clan;
}

function _npcClanDiversifyNames(world) {
    if (!world || !Array.isArray(world.clans)) return false;
    let changed = false;
    let prior = { clans:[] };
    world.clans.forEach(clan => {
        if (!clan || !clan.name) return;
        let parts = _npcClanNameParts(clan.name);
        let usage = _npcClanNameUsage(prior, null);
        let tooMany = (parts.stem && (usage.stems[parts.stem] || 0) >= 2) ||
            (parts.form && (usage.forms[parts.form] || 0) >= 2);
        if (tooMany) {
            let oldName = clan.name;
            let replacement = _npcClanPickDiverseName(world, clan.id, oldName);
            if (replacement) {
                clan.name = replacement;
                world.retiredNames = Array.from(new Set((world.retiredNames || []).concat(oldName))).slice(-500);
                changed = true;
            }
        }
        prior.clans.push(clan);
    });
    return changed;
}

function _npcClanNamesNeedDiversify(world) {
    if (!world || !Array.isArray(world.clans)) return false;
    let prior = { clans:[] };
    for (let clan of world.clans) {
        if (!clan || !clan.name) continue;
        let parts = _npcClanNameParts(clan.name);
        let usage = _npcClanNameUsage(prior, null);
        if ((parts.stem && (usage.stems[parts.stem] || 0) >= 2) ||
            (parts.form && (usage.forms[parts.form] || 0) >= 2)) return true;
        prior.clans.push(clan);
    }
    return false;
}

function _npcClanEnsureWorldData(world, mode) {
    let changed = false;
    if (!world || typeof world !== 'object') return changed;
    if (!Array.isArray(world.clans)) { world.clans = []; changed = true; }
    if (!world.memberships || typeof world.memberships !== 'object' || Array.isArray(world.memberships)) { world.memberships = {}; changed = true; }
    if (!world.castleOwners || typeof world.castleOwners !== 'object') {
        world.castleOwners = { kent:null, windwood:null, heine:null };
        changed = true;
    }
    if (!Array.isArray(world.retiredNames)) { world.retiredNames = []; changed = true; }
    let clanIds = new Set();
    world.clans = world.clans.filter(c => {
        if (!c || !c.id || !c.name || clanIds.has(c.id)) { changed = true; return false; }
        clanIds.add(c.id);
        if (!c.leader || !c.leader.n) {
            c.leader = _npcClanNewLeader(world);
            changed = true;
        }
        let rec = world.memberships[c.leader.n];
        if (!rec || rec.clanId !== c.id || !rec.leader) {
            world.memberships[c.leader.n] = {
                clanId:c.id,
                leader:true,
                avatar:c.leader.avatar,
                alignmentValue:c.leader.alignmentValue,
                levelOffset:c.leader.levelOffset,
                assignedAt:Date.now()
            };
            changed = true;
        }
        return true;
    }).slice(0, NPC_CLAN_WORLD_COUNT);
    while (world.clans.length < NPC_CLAN_WORLD_COUNT) {
        _npcClanCreateOne(world, mode);
        changed = true;
    }
    if (_npcClanDiversifyNames(world)) changed = true;
    clanIds = new Set(world.clans.map(c => c.id));
    Object.keys(world.memberships).forEach(name => {
        let rec = world.memberships[name];
        if (rec && rec.clanId && !clanIds.has(rec.clanId)) { delete world.memberships[name]; changed = true; }
    });
    Object.keys(CLAN_CASTLE_NAMES).forEach(city => {
        let id = world.castleOwners[city];
        if (id && !clanIds.has(id)) { world.castleOwners[city] = null; changed = true; }
        else if (!Object.prototype.hasOwnProperty.call(world.castleOwners, city)) { world.castleOwners[city] = null; changed = true; }
    });
    if (!world.lastHateDecayAt) { world.lastHateDecayAt = Date.now(); changed = true; }
    return changed;
}

function npcClanEnsureWorld(p) {
    let mode = clanModeKey(p || player);
    let preview = _clanReadState();
    let world = preview && preview.npcWorlds && preview.npcWorlds[mode];
    if (world && world.clans && world.clans.length === NPC_CLAN_WORLD_COUNT &&
        world.clans.every(c => c && c.leader && c.leader.n) &&
        !_npcClanNamesNeedDiversify(world)) return world;
    let result = _clanWithLock(st => {
        let live = st.npcWorlds[mode];
        if (!live) {
            live = st.npcWorlds[mode] = _npcClanDefaultWorld();
        }
        _npcClanEnsureWorldData(live, mode);
        return { world:live };
    });
    return result && result.ok ? result.world : world;
}

function npcClanGetWorld(p) {
    npcClanEnsureWorld(p || player);
    let st = _clanReadState();
    return st && st.npcWorlds ? st.npcWorlds[clanModeKey(p || player)] : null;
}

function _npcClanById(world, clanId) {
    return world && Array.isArray(world.clans) ? world.clans.find(c => c && c.id === clanId) || null : null;
}

function npcClanGetById(clanId, p) {
    return _npcClanById(npcClanGetWorld(p || player), clanId);
}

function _npcClanWarRemainingMs(clan, now) {
    if (!clan || !clan.war) return 0;
    let startedAt = Math.max(0, Math.floor(Number(clan.warStartedAt) || 0));
    if (!startedAt) return 0;
    return Math.max(0, startedAt + NPC_CLAN_WAR_MIN_MS - (Number(now) || Date.now()));
}

function npcClanHostileList(p) {
    let world = npcClanGetWorld(p || player);
    return world ? world.clans.filter(c => c && (c.hostile || c.war || (c.mercy && c.mercy.pending))) : [];
}

function _npcClanConflictSnapshot(world, at) {
    let playerIds = [];
    let npcIds = [];
    let mutualIds = [];
    (world && Array.isArray(world.clans) ? world.clans : []).forEach(clan => {
        if (!clan) return;
        if (clan.war) playerIds.push(clan.id);
        if (clan.hostile) npcIds.push(clan.id);
        if (clan.war && clan.hostile) mutualIds.push(clan.id);
    });
    return {
        at:Number(at) || Date.now(),
        ids:playerIds.slice(),
        playerIds:playerIds,
        npcIds:npcIds,
        mutualIds:mutualIds
    };
}

function npcClanWarIds(p) {
    let mode = clanModeKey(p || player);
    let cached = _npcClanWarCache[mode];
    let now = Date.now();
    if (cached && now - cached.at < 2000) return (cached.playerIds || cached.ids || []).slice();
    let world = npcClanGetWorld(p || player);
    cached = _npcClanWarCache[mode] = _npcClanConflictSnapshot(world, now);
    return cached.playerIds.slice();
}

function npcClanWarActive(p) {
    return npcClanWarIds(p || player).length > 0;
}

function npcClanEncounterProfile(p) {
    let mode = clanModeKey(p || player);
    let cached = _npcClanWarCache[mode];
    let now = Date.now();
    if (!cached || now - cached.at >= 2000 || !Array.isArray(cached.playerIds) ||
        !Array.isArray(cached.npcIds) || !Array.isArray(cached.mutualIds)) {
        cached = _npcClanWarCache[mode] = _npcClanConflictSnapshot(npcClanGetWorld(p || player), now);
    }
    let playerIds = cached.playerIds.slice();
    let npcIds = cached.npcIds.slice();
    let mutualIds = cached.mutualIds.slice();
    let mutualSet = new Set(mutualIds);
    let playerOnlyIds = playerIds.filter(id => !mutualSet.has(id));
    let npcOnlyIds = npcIds.filter(id => !mutualSet.has(id));
    let state = 'none';
    let clanIds = [];
    let chance = 0.01;
    let enemyClanChance = 0;
    if (mutualIds.length) {
        state = 'mutual';
        clanIds = mutualIds;
        chance = NPC_CLAN_MUTUAL_WILD_CHANCE;
        enemyClanChance = NPC_CLAN_WAR_ENCOUNTER_CHANCE;
    } else if (npcOnlyIds.length) {
        state = 'npc';
        clanIds = npcOnlyIds;
        enemyClanChance = 1;
    } else if (playerOnlyIds.length) {
        state = 'player';
        clanIds = playerOnlyIds;
        enemyClanChance = NPC_CLAN_PLAYER_WAR_ENCOUNTER_CHANCE;
    }
    return {
        active:state !== 'none',
        state:state,
        chance:chance,
        enemyClanChance:enemyClanChance,
        clanIds:clanIds,
        forcePvp:playerIds.length > 0,
        npcInitiated:npcIds.length > 0,
        hasMutual:mutualIds.length > 0,
        hasPlayerOnly:playerOnlyIds.length > 0,
        hasNpcOnly:npcOnlyIds.length > 0
    };
}

function _npcClanRandomDelay(min, max) {
    min = Math.max(0, Number(min) || 0);
    max = Math.max(min, Number(max) || min);
    return Math.floor(min + Math.random() * (max - min + 1));
}

function _npcClanDissolveLocked(world, clan, events, mode) {
    if (!world || !clan) return;
    let reason = _npcClanPick(NPC_CLAN_DISSOLVE_REASONS) || '成員各奔東西，血盟正式解散。';
    if (events) events.push({ type:'dissolve', name:clan.name, reason:reason });
    world.retiredNames = (world.retiredNames || []).filter(n => n !== clan.name).concat(clan.name).slice(-500);
    world.clans = world.clans.filter(c => c && c.id !== clan.id);
    Object.keys(world.memberships || {}).forEach(name => {
        if (world.memberships[name] && world.memberships[name].clanId === clan.id) delete world.memberships[name];
    });
    Object.keys(CLAN_CASTLE_NAMES).forEach(city => {
        if (world.castleOwners[city] === clan.id) world.castleOwners[city] = null;
    });
    _npcClanCreateOne(world, mode);
}

function _npcClanApplyMoraleLocked(world, clan, delta, events, mode) {
    if (!clan || !delta) return clan;
    let before = clan.morale;
    clan.morale = Math.max(0, Math.min(NPC_CLAN_MORALE_MAX, clan.morale + Math.trunc(delta)));
    if (clan.morale <= 0) {
        _npcClanDissolveLocked(world, clan, events, mode);
        return null;
    }
    if (before >= 100 && clan.morale < 100 && !clan.mercyUsed) {
        clan.mercyUsed = true;
        clan.hatred = 0;
        clan.hostile = false;
        clan.counterWarChance = 0;
        clan.mercy = {
            pending:true,
            nextAt:Date.now() + _npcClanRandomDelay(60 * 1000, 5 * 60 * 1000)
        };
        if (events) events.push({ type:'mercy', id:clan.id, name:clan.name });
    }
    return clan;
}

function _npcClanApplyHatredLocked(clan, delta) {
    if (!clan || !delta) return;
    clan.hatred = Math.max(0, Math.min(NPC_CLAN_HATRED_MAX, clan.hatred + Math.trunc(delta)));
    if (clan.hatred >= 50) {
        clan.known = true;
        clan.hostile = true;
        clan.counterWarChance = 0;
    }
}

// 世界頻道等非戰鬥事件共用的 NPC 血盟仇恨入口；只改隱藏仇恨，不套用擊殺士氣或掉落結算。
function npcClanAdjustHatred(clanId, delta, p) {
    let role = p || (typeof player !== 'undefined' ? player : null);
    let amount = Math.trunc(Number(delta) || 0);
    if (!clanId || !amount || !role || !role.cls) return { ok:false, missing:true };
    let mode = clanModeKey(role);
    npcClanEnsureWorld(role);
    let result = _clanWithLock(st => {
        let world = st.npcWorlds[mode];
        let clan = world && _npcClanById(world, String(clanId));
        if (!clan) return { commit:false, missing:true };
        let before = clan.hatred;
        _npcClanApplyHatredLocked(clan, amount);
        return { hatred:clan.hatred, changed:clan.hatred !== before };
    });
    if (result && result.ok) delete _npcClanWarCache[mode];
    return result;
}

function _npcClanEventLog(events) {
    (events || []).forEach(event => {
        if (!event) return;
        if (event.type === 'dissolve' && typeof logSys === 'function') {
            logSys(`<span class="text-cyan-300 font-bold">【世界頻道】</span><span class="text-slate-200">血盟「${clanEsc(event.name)}」宣布解散：${clanEsc(event.reason)}</span>`);
        } else if (event.type === 'mercy' && typeof logSys === 'function') {
            logSys(`<span class="text-amber-300">NPC 血盟「${clanEsc(event.name)}」已失去戰意，主動解除敵對。</span>`);
        }
    });
}

function _npcClanApplyAssignment(entry, assignment) {
    if (!entry || !assignment) return entry;
    entry.n = assignment.n;
    entry.avatar = assignment.avatar;
    entry.alignmentValue = assignment.alignmentValue;
    entry.levelOffset = assignment.levelOffset;
    entry.clanId = assignment.clanId || null;
    entry.clanName = assignment.clanName || '';
    entry.clanLeader = !!assignment.clanLeader;
    entry.clanAtWar = !!assignment.clanAtWar;
    entry.clanConflict = !!assignment.clanConflict;
    entry.clanHasCastle = !!assignment.clanHasCastle;
    entry._npcClanAssigned = true;
    return entry;
}

function npcClanAssignOpponent(entry, opts) {
    if (!entry || !entry.n || typeof player === 'undefined' || !player || !player.cls) return entry;
    opts = opts || {};
    let mode = clanModeKey(player);
    npcClanEnsureWorld(player);
    let result = _clanWithLock(st => {
        let world = st.npcWorlds[mode] || (st.npcWorlds[mode] = _npcClanDefaultWorld());
        _npcClanEnsureWorldData(world, mode);
        let name = String(entry.n).slice(0, 24);
        let rec = world.memberships[name] || null;
        let forceClanId = opts.forceClanId && _npcClanById(world, opts.forceClanId) ? opts.forceClanId : null;
        let desiredClan = null;
        let contextualPick = false;
        if (forceClanId) {
            desiredClan = _npcClanById(world, forceClanId);
            contextualPick = true;
        } else if (opts.defenderClanId && _npcClanById(world, opts.defenderClanId)) {
            let defenderChance = Number.isFinite(Number(opts.defenderChance)) ? Number(opts.defenderChance) : 0.5;
            if (Math.random() < defenderChance) desiredClan = _npcClanById(world, opts.defenderClanId);
            contextualPick = true;
        } else if (opts.warEncounter) {
            let requestedIds = Array.isArray(opts.encounterClanIds)
                ? new Set(opts.encounterClanIds.map(String))
                : null;
            let wars = world.clans.filter(c => c && (requestedIds ? requestedIds.has(c.id) : c.war));
            let encounterChance = Number(opts.enemyClanChance);
            if (!Number.isFinite(encounterChance)) encounterChance = NPC_CLAN_WAR_ENCOUNTER_CHANCE;
            encounterChance = Math.max(0, Math.min(1, encounterChance));
            if (wars.length && Math.random() < encounterChance) desiredClan = _npcClanPick(wars);
            contextualPick = wars.length > 0;
        }
        if (!contextualPick && rec) {
            let clan = rec.clanId ? _npcClanById(world, rec.clanId) : null;
            return {
                assignment:{
                    n:name,
                    avatar:rec.avatar,
                    alignmentValue:rec.alignmentValue,
                    levelOffset:rec.levelOffset,
                    clanId:clan ? clan.id : null,
                    clanName:clan ? clan.name : '',
                    clanLeader:!!rec.leader && !!clan,
                    clanAtWar:!!(clan && clan.war),
                    clanConflict:!!(clan && (clan.hostile || clan.war)),
                    clanHasCastle:!!(clan && Object.values(world.castleOwners || {}).includes(clan.id))
                }
            };
        }
        let chosen = desiredClan;
        if (!contextualPick && Math.random() < NPC_CLAN_DEFAULT_MEMBER_CHANCE) chosen = _npcClanPick(world.clans);
        let desiredClanId = chosen ? chosen.id : null;
        if (contextualPick && (!rec || (rec.clanId || null) !== desiredClanId)) {
            rec = null;
            if (chosen && !opts.noLeader && Math.random() < 0.08 &&
                chosen.leader && !(opts.onFieldNames || []).includes(chosen.leader.n)) {
                name = chosen.leader.n;
                rec = world.memberships[name] || null;
            }
            if (!rec) {
                let knownNames = Object.keys(world.memberships).filter(candidate => {
                    let known = world.memberships[candidate];
                    return known && (known.clanId || null) === desiredClanId && !known.leader &&
                        !(opts.onFieldNames || []).includes(candidate);
                });
                if (knownNames.length) {
                    name = _npcClanPick(knownNames);
                    rec = world.memberships[name];
                }
            }
            if (!rec) {
                for (let tries = 0; tries < 100; tries++) {
                    let candidate = typeof pvpRandomName === 'function' ? pvpRandomName() : ('玩家' + Math.floor(Math.random() * 99999));
                    if (!world.memberships[candidate] && !(opts.onFieldNames || []).includes(candidate)) {
                        name = candidate;
                        break;
                    }
                }
            }
        }
        if (!contextualPick && chosen && !opts.noLeader && Math.random() < 0.08 &&
            chosen.leader && !(opts.onFieldNames || []).includes(chosen.leader.n)) {
            name = chosen.leader.n;
            rec = world.memberships[name];
        }
        if (!rec) {
            rec = {
                clanId:chosen ? chosen.id : null,
                leader:false,
                avatar:(typeof TROLL_CLASS_BY_AVATAR !== 'undefined' && TROLL_CLASS_BY_AVATAR[entry.avatar]) ? entry.avatar : '男戰士',
                alignmentValue:typeof pvpClampAlignment === 'function' ? pvpClampAlignment(entry.alignmentValue) : Math.max(-32767, Math.min(32767, Math.round(Number(entry.alignmentValue) || 0))),
                levelOffset:Math.max(-10, Math.min(10, Math.round(Number(entry.levelOffset) || 0))),
                assignedAt:Date.now()
            };
            world.memberships[name] = rec;
        }
        let clan = rec.clanId ? _npcClanById(world, rec.clanId) : null;
        return {
            assignment:{
                n:name,
                avatar:rec.avatar,
                alignmentValue:rec.alignmentValue,
                levelOffset:rec.levelOffset,
                clanId:clan ? clan.id : null,
                clanName:clan ? clan.name : '',
                clanLeader:!!rec.leader && !!clan,
                clanAtWar:!!(clan && clan.war),
                clanConflict:!!(clan && (clan.hostile || clan.war)),
                clanHasCastle:!!(clan && Object.values(world.castleOwners || {}).includes(clan.id))
            }
        };
    });
    if (result && result.ok && result.assignment) return _npcClanApplyAssignment(entry, result.assignment);
    if (opts.forceClanId) {
        let clan = npcClanGetById(opts.forceClanId, player);
        if (clan) {
            entry.clanId = clan.id;
            entry.clanName = clan.name;
            entry.clanLeader = false;
            entry.clanAtWar = !!clan.war;
            entry.clanConflict = !!(clan.hostile || clan.war);
            let world = npcClanGetWorld(player);
            entry.clanHasCastle = !!(world && Object.values(world.castleOwners || {}).includes(clan.id));
            entry._npcClanAssigned = true;
        }
    }
    return entry;
}

function npcClanUpdateMemberAlignment(name, alignmentValue, p) {
    if (!name || !p || !p.cls) return false;
    let key = String(name).slice(0, 24);
    let value = typeof pvpClampAlignment === 'function'
        ? pvpClampAlignment(alignmentValue)
        : Math.max(-32767, Math.min(32767, Math.round(Number(alignmentValue) || 0)));
    let mode = clanModeKey(p);
    let result = _clanWithLock(st => {
        let world = st.npcWorlds[mode] || (st.npcWorlds[mode] = _npcClanDefaultWorld());
        _npcClanEnsureWorldData(world, mode);
        let rec = world.memberships[key];
        if (!rec) return { commit:false, missing:true };
        rec.alignmentValue = value;
        if (rec.leader && rec.clanId) {
            let clan = _npcClanById(world, rec.clanId);
            if (clan && clan.leader && clan.leader.n === key) clan.leader.alignmentValue = value;
        }
        return { alignmentValue:value };
    });
    return !!(result && result.ok);
}

function npcClanCreateGroupBattleOpponent(clanId) {
    let entry = typeof pvpCreateRandomOpponent === 'function'
        ? pvpCreateRandomOpponent(null, { skipClanAssign:true })
        : { n:'敵盟玩家', avatar:'男戰士', alignmentValue:0, levelOffset:0, pvpRandom:true };
    entry._npcClanBattle = true;
    return npcClanAssignOpponent(entry, { forceClanId:clanId, noLeader:false });
}

function npcClanCastleDefender(city, p) {
    let world = npcClanGetWorld(p || player);
    let id = world && world.castleOwners ? world.castleOwners[city] : null;
    return id ? _npcClanById(world, id) : null;
}

function npcClanSiegeDefenderId() {
    if (!player || !player.siege || !player.siege.active) return null;
    let id = player.siege.npcDefenderClanId;
    return id && npcClanGetById(id, player) ? id : null;
}

function npcClanSiegeRespawnMultiplier() {
    return npcClanSiegeDefenderId() ? 0.5 : 1;
}

function npcClanOnSiegeResult(city, result, defenderClanId) {
    if (!player || !player.cls) return { ok:false };
    let mode = clanModeKey(player);
    let events = [];
    let outcome = _clanWithLock(st => {
        let world = st.npcWorlds[mode] || (st.npcWorlds[mode] = _npcClanDefaultWorld());
        _npcClanEnsureWorldData(world, mode);
        let defender = _npcClanById(world, defenderClanId);
        if (result === 'lose') {
            if (defender) _npcClanApplyMoraleLocked(world, defender, 100, events, mode);
            return {};
        }
        if (result !== 'win') return {};
        if (defender) _npcClanApplyMoraleLocked(world, defender, -300, events, mode);
        world.castleOwners[city] = null;
        let otherCities = Object.keys(CLAN_CASTLE_NAMES).filter(key => key !== city);
        let picks = _npcClanShuffle(world.clans.filter(clan => clan && (!defender || clan.id !== defender.id))).slice(0, otherCities.length);
        otherCities.forEach((otherCity, index) => {
            let clan = picks[index];
            world.castleOwners[otherCity] = clan ? clan.id : null;
            if (clan) _npcClanApplyMoraleLocked(world, clan, 200, events, mode);
        });
        return {};
    });
    if (outcome && outcome.ok) _npcClanEventLog(events);
    return outcome;
}

function npcClanOnNpcKilled(mob) {
    if (!mob || !mob._npcClanId || !player || !player.cls) return;
    let mode = clanModeKey(player);
    let events = [];
    let result = _clanWithLock(st => {
        let world = st.npcWorlds[mode];
        let clan = world && _npcClanById(world, mob._npcClanId);
        if (!clan) return { commit:false, missing:true };
        let clanName = clan.name;
        let atWar = !!clan.war;
        let counterDeclared = false;
        let leaderKill = atWar && !!mob._npcClanLeader;
        let impact = leaderKill ? 10 : 1;
        _npcClanApplyHatredLocked(clan, impact);
        if (atWar && !clan.hostile) {
            clan.counterWarChance = Math.min(1, Math.max(0, Number(clan.counterWarChance) || 0) + NPC_CLAN_COUNTER_WAR_STEP);
            if (Math.random() < clan.counterWarChance) {
                clan.known = true;
                clan.hostile = true;
                clan.counterWarChance = 0;
                counterDeclared = true;
            }
        }
        if (atWar) clan = _npcClanApplyMoraleLocked(world, clan, -impact, events, mode);
        return { clanAlive:!!clan, clanWar:!!(clan && clan.war), wasWar:atWar, counterDeclared:!!clan && counterDeclared, clanName:clanName };
    });
    if (result && result.ok) {
        mob._npcClanWarKill = !!result.wasWar;
        _npcClanEventLog(events);
        if (result.counterDeclared && typeof logSys === 'function') {
            logSys(`<span class="text-red-400 font-bold">NPC 血盟「${clanEsc(result.clanName)}」對你的血盟宣戰，雙方進入互宣狀態！</span>`);
        }
    }
    let battle = mapState && mapState.npcClanBattle;
    if (battle && battle.clanId === mob._npcClanId) {
        battle.kills = Math.max(0, Number(battle.kills) || 0) + 1;
        if (battle.kills >= battle.target) npcClanGroupBattleEnd('victory');
        else if (!result || !result.ok || !result.clanAlive || !result.clanWar) npcClanGroupBattleEnd('retreat');
    }
}

function npcClanOnPlayerKilledBy(killers) {
    if (!Array.isArray(killers) || !killers.length || !player || !player.cls) return;
    let ids = Array.from(new Set(killers.map(m => m && m._npcClanId).filter(Boolean)));
    if (!ids.length) return;
    let mode = clanModeKey(player);
    let hasPlayerClan = !!clanGetModeInfo(player);
    _clanWithLock(st => {
        let world = st.npcWorlds[mode];
        if (!world) return { commit:false };
        ids.forEach(id => {
            let clan = _npcClanById(world, id);
            if (clan) {
                if (hasPlayerClan) clan.known = true;
                _npcClanApplyHatredLocked(clan, -1);
            }
        });
        return {};
    });
}

function npcClanKillIgnoresAlignment(mob) {
    if (!mob || !mob._npcClanId) return false;
    let clan = npcClanGetById(mob._npcClanId, player);
    return !!(mob._npcClanBattle || mob._npcClanWarKill || (clan && clan.war));
}

function npcClanGroupBattleActive() {
    let battle = mapState && mapState.npcClanBattle;
    return !!(battle && battle.map === mapState.current && npcClanGetById(battle.clanId, player));
}

function npcClanGroupBattleFill() {
    if (!npcClanGroupBattleActive() || mapState._npcClanBattleFilling) return;
    mapState._npcClanBattleFilling = true;
    try {
        let slots = typeof backSlotsActive === 'function' && backSlotsActive() ? 5 : 3;
        for (let i = 0; i < slots; i++) {
            if (!mapState.mobs[i]) spawnMob(i);
        }
    } finally {
        mapState._npcClanBattleFilling = false;
    }
}

function npcClanGroupBattleEnd(reason) {
    let battle = mapState && mapState.npcClanBattle;
    if (!battle) return;
    let name = battle.clanName || '';
    mapState.npcClanBattle = null;
    for (let i = 0; i < mapState.mobs.length; i++) {
        let mob = mapState.mobs[i];
        if (mob && mob._npcClanBattle) mapState.mobs[i] = null;
    }
    let nowT = typeof state !== 'undefined' ? state.ticks : 0;
    mapState.spawnAt = mapState.mobs.map(m => m ? null : nowT + 50);
    mapState.targetIdx = -1;
    if (reason === 'victory' && typeof logSys === 'function') {
        logSys(`<span class="text-emerald-300 font-bold">你擊退了「${clanEsc(name)}」的團戰部隊，狩獵區恢復平靜。</span>`);
    } else if (reason === 'retreat' && typeof logSys === 'function') {
        logSys(`<span class="text-amber-300">「${clanEsc(name)}」失去戰意，團戰部隊撤離了。</span>`);
    }
    if (typeof renderMobs === 'function') renderMobs();
}

function npcClanOnLeaveBattleArea() {
    if (mapState && mapState.npcClanBattle) npcClanGroupBattleEnd('leave');
    if (typeof wcMassTauntOnLeaveBattleArea === 'function') wcMassTauntOnLeaveBattleArea();
}

function npcClanMaybeStartGroupBattle(mob) {
    if (!mob || mob.boss || mob.trollPlayer || mob.race === '建築' || mob.race === '血盟' ||
        !mapState || !mapState.current || mapState.current.startsWith('town_') ||
        (typeof isSiegeArea === 'function' && isSiegeArea(mapState.current)) ||
        (typeof KING_ROOMS !== 'undefined' && KING_ROOMS[mapState.current]) ||
        (typeof PURE_BOSS_MAPS !== 'undefined' && PURE_BOSS_MAPS.includes(mapState.current)) ||
        npcClanGroupBattleActive()) return false;
    // ⚡ v3.7.30 先骰再讀（補跑效能修）：npcClanGetWorld 每呼叫都重讀＋解析血盟帳號桶（~2.5ms），v3.7.27 起掛在每次擊殺
    //    → 補跑 per-tick 慢 2.6 倍（killMob 佔 93%·其中 95% 是本函式）。把 1% 機率骰移到最前＝99% 擊殺零成本；兩事件獨立，觸發機率不變。
    if (Math.random() >= NPC_CLAN_GROUP_CHANCE) return false;
    let world = npcClanGetWorld(player);
    let candidates = world ? world.clans.filter(c => c && c.war && c.hatred > 80) : [];
    if (!candidates.length) return false;
    let clan = _npcClanPick(candidates);
    mapState.npcClanBattle = {
        clanId:clan.id,
        clanName:clan.name,
        map:mapState.current,
        kills:0,
        target:20 + Math.floor(Math.random() * 31),
        startedAt:Date.now()
    };
    for (let i = 0; i < mapState.mobs.length; i++) {
        let live = mapState.mobs[i];
        if (live && !live.boss) mapState.mobs[i] = null;
    }
    mapState.spawnAt = [null, null, null, null, null];
    mapState.targetIdx = -1;
    if (typeof logSys === 'function') {
        logSys(`<span class="text-red-400 font-bold">「${clanEsc(clan.name)}」發動團戰！</span>擊退 ${mapState.npcClanBattle.target} 名敵盟玩家，或離開此區域即可結束。`);
    }
    npcClanGroupBattleFill();
    return true;
}

function npcClanSetWar(clanId, on) {
    if (!player || player.cls !== 'royal') { alert('只有王族可以對 NPC 血盟宣戰或停止宣戰。'); return; }
    if (!clanGetModeInfo(player)) { alert('你尚未加入血盟。'); return; }
    let mode = clanModeKey(player);
    let now = Date.now();
    let result = _clanWithLock(st => {
        let world = st.npcWorlds[mode];
        let clan = world && _npcClanById(world, clanId);
        if (!clan) return { commit:false, error:'該 NPC 血盟已不存在。' };
        if (on) {
            clan.known = true;   // 🏴 v3.6.52 宣戰列表改列全部 NPC 血盟→取消「未識別不可宣戰」的閘（宣戰本身即代表已知曉對方）
            if (!clan.war) {
                clan.war = true;
                clan.warStartedAt = now;
                clan.counterWarChance = 0;
            }
            clan.mercy = null;
        } else {
            let remaining = _npcClanWarRemainingMs(clan, now);
            if (remaining > 0) {
                return { commit:false, error:`宣戰後必須維持 24 小時，尚需 ${_npcClanWarRemainingText(remaining)}才能停止宣戰。` };
            }
            clan.war = false;
            clan.warStartedAt = 0;
            clan.counterWarChance = 0;
            clan.mercy = null;
        }
        return { name:clan.name, npcHostile:!!clan.hostile };
    });
    if (!result.ok) { alert(result.error || '宣戰狀態更新失敗。'); return; }
    if (on) {
        player.pvpOn = true;
        if (typeof logSys === 'function') logSys(`<span class="text-red-400 font-bold">你對 NPC 血盟「${clanEsc(result.name)}」宣戰！${result.npcHostile ? '雙方進入互宣狀態，' : ''}同模式角色強制進入 PVP。</span>`);
    } else {
        if (mapState && mapState.npcClanBattle && mapState.npcClanBattle.clanId === clanId) npcClanGroupBattleEnd('retreat');
        if (typeof logSys === 'function') logSys(`<span class="text-emerald-300">你已停止對 NPC 血盟「${clanEsc(result.name)}」宣戰。${result.npcHostile ? '對方仍維持單方面宣戰。' : ''}</span>`);
    }
    if (typeof saveGame === 'function') saveGame();
    if (typeof renderPvpTab === 'function') renderPvpTab();
    renderClanTab();
}

function npcClanMercyAction(clanId, action) {
    if (!player || player.cls !== 'royal') { alert('只有王族可以回應 NPC 血盟盟主。'); return; }
    let mode = clanModeKey(player);
    let result = _clanWithLock(st => {
        let world = st.npcWorlds[mode];
        let clan = world && _npcClanById(world, clanId);
        if (!clan) return { commit:false, error:'該 NPC 血盟已不存在。' };
        if (!clan.mercy || !clan.mercy.pending) return { commit:false, error:'這次求饒已經失效。' };
        if (action !== 'taunt') {
            let remaining = _npcClanWarRemainingMs(clan, Date.now());
            if (remaining > 0) return { commit:false, error:`宣戰未滿 24 小時，尚需 ${_npcClanWarRemainingText(remaining)}才能接受停戰。` };
        }
        clan.mercy = null;
        if (action === 'taunt') {
            clan.morale = Math.min(NPC_CLAN_MORALE_MAX, clan.morale + 200);
            clan.hatred = NPC_CLAN_HATRED_MAX;
            clan.known = true;
            clan.hostile = true;
            if (!clan.war) {
                clan.war = true;
                clan.warStartedAt = Date.now();
            }
            clan.counterWarChance = 0;
        } else {
            clan.hatred = 0;
            clan.hostile = false;
            clan.war = false;
            clan.warStartedAt = 0;
            clan.counterWarChance = 0;
        }
        return { name:clan.name, taunted:action === 'taunt' };
    });
    if (!result.ok) { alert(result.error || '回應失敗。'); return; }
    if (result.taunted) {
        player.pvpOn = true;
        if (typeof logSys === 'function') logSys(`<span class="wander-chat-out">-&gt; [${clanEsc(result.name)}盟主] ${clanEsc(_npcClanPick(NPC_CLAN_TAUNT_LINES))}</span>`);
        if (typeof logSys === 'function') logSys(`<span class="text-red-400 font-bold">對方惱羞成怒，重新集結並恢復敵對。</span>`);
    } else if (typeof logSys === 'function') {
        logSys(`<span class="text-emerald-300">你接受「${clanEsc(result.name)}」的求和，雙方解除敵對。</span>`);
    }
    if (typeof saveGame === 'function') saveGame();
    if (typeof renderPvpTab === 'function') renderPvpTab();
    renderClanTab();
}

function openNpcClanMercyMenu(clanId, ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    let clan = npcClanGetById(clanId, player);
    if (!clan || !clan.mercy || !clan.mercy.pending) {
        if (typeof logSys === 'function') logSys('<span class="text-slate-400">這則求饒私訊已經失效。</span>');
        return;
    }
    if (player.cls !== 'royal') {
        if (typeof logSys === 'function') logSys('<span class="text-slate-400">只有王族角色可以代表血盟回應。</span>');
        return;
    }
    let old = document.getElementById('npc-clan-mercy-menu');
    if (old) old.remove();
    let menu = document.createElement('div');
    menu.id = 'npc-clan-mercy-menu';
    menu.className = 'pvp-kill-whisper-menu';
    menu.innerHTML =
        `<div class="pvp-kill-whisper-heading">${clanEsc(clan.name)}盟主正在求和</div>` +
        `<button type="button" onclick="npcClanMercyAction('${clanEsc(clan.id)}','taunt');this.parentElement.remove()">嘲諷對方</button>` +
        `<button type="button" onclick="npcClanMercyAction('${clanEsc(clan.id)}','release');this.parentElement.remove()">解除敵對</button>`;
    document.body.appendChild(menu);
    let x = ev && Number.isFinite(ev.clientX) ? ev.clientX : window.innerWidth / 2;
    let y = ev && Number.isFinite(ev.clientY) ? ev.clientY : window.innerHeight / 2;
    let rect = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y + 8, window.innerHeight - rect.height - 8)) + 'px';
}

function _npcClanMercyWhisper(clan) {
    if (!clan || typeof logSys !== 'function') return;
    let name = clanEsc(clan.leader && clan.leader.n ? clan.leader.n : (clan.name + '盟主'));
    let line = clanEsc(_npcClanPick(NPC_CLAN_MERCY_LINES));
    if (player && player.cls === 'royal') {
        logSys(`<span class="wander-chat-in"><button type="button" class="pvp-kill-whisper-name" onclick="openNpcClanMercyMenu('${clanEsc(clan.id)}',event)">[${name}]</button> ${line}</span>`);
    } else {
        logSys(`<span class="wander-chat-in"><span class="wander-chat-speaker">[${name}]</span> ${line}</span>`);
    }
}

function npcClanWorldTick() {
    if (!player || !player.cls) return;
    let mode = clanModeKey(player);
    npcClanEnsureWorld(player);
    let whispers = [];
    let now = Date.now();
    let result = _clanWithLock(st => {
        let world = st.npcWorlds[mode];
        if (!world) return { commit:false };
        let hours = Math.max(0, Math.floor((now - (world.lastHateDecayAt || now)) / NPC_CLAN_HATRED_DECAY_MS));
        let changed = false;
        if (hours > 0) {
            world.clans.forEach(clan => { clan.hatred = Math.max(0, clan.hatred - hours); });
            world.lastHateDecayAt += hours * NPC_CLAN_HATRED_DECAY_MS;
            changed = true;
        }
        world.clans.forEach(clan => {
            if (!clan.mercy || !clan.mercy.pending || now < clan.mercy.nextAt) return;
            whispers.push({ id:clan.id });
            clan.mercy.nextAt = now + _npcClanRandomDelay(NPC_CLAN_MERCY_MIN_MS, NPC_CLAN_MERCY_MAX_MS);
            changed = true;
        });
        if (!changed) return { commit:false, unchanged:true };
        return {};
    });
    if (npcClanWarActive(player)) player.pvpOn = true;
    whispers.forEach(item => {
        let clan = npcClanGetById(item.id, player);
        if (clan && clan.mercy && clan.mercy.pending) _npcClanMercyWhisper(clan);
    });
    if (result && result.ok && whispers.length && typeof saveGame === 'function') saveGame();
    let tab = document.getElementById('tab-clan');
    if (tab && !tab.classList.contains('hidden')) renderClanTab();
}

function clanLevelInfo(xp) {
    xp = Math.max(0, Math.floor(Number(xp) || 0));
    let level = 1, spent = 0;
    for (let i = 0; i < CLAN_LEVEL_COSTS.length; i++) {
        if (xp - spent < CLAN_LEVEL_COSTS[i]) break;
        spent += CLAN_LEVEL_COSTS[i];
        level++;
    }
    let next = level >= 10 ? 0 : CLAN_LEVEL_COSTS[level - 1];
    return { level:level, current:Math.max(0, xp - spent), next:next, total:xp };
}

function clanGetModeInfo(p) {
    let st = _clanReadState();
    if (!st) return null;
    let info = st.modes[clanModeKey(p || player)];
    return info ? Object.assign({}, info) : null;
}

function clanGetCastleCity(p) {
    let info = clanGetModeInfo(p || player);
    return info && info.castle ? info.castle : null;
}

function clanSetCastle(city) {
    if (!Object.prototype.hasOwnProperty.call(CLAN_CASTLE_NAMES, city)) return { ok:false, error:'無效的城堡。' };
    let mode = clanModeKey(player);
    return _clanWithLock(st => {
        let info = st.modes[mode];
        if (!info) return { commit:false, error:'你尚未加入血盟。' };
        let previous = info.castle || null;
        info.castle = city;
        return { previous:previous, castle:city };
    });
}

let _clanScanCache = { mode:null, at:0, roles:null };
function clanScanRoles(mode) {
    mode = mode || clanModeKey(player);
    // ⚡ v3.6.01 3 秒 TTL 快取：每次掃描要解壓＋解析全部 8 個存檔位，而城鎮地圖渲染（含叫賣 NPC 每次進退場
    //    的整張重繪 js/24:471）會經 clanNpcVisible → clanHasFoundingRoyal 與 clanNpcDisplayName 連掃兩輪。
    //    顯示用途容忍 3 秒陳舊（比照 _lkWhLockedIdx 短 TTL 模式）；創盟／刪角會主動清快取。
    let now = Date.now();
    if (_clanScanCache.roles && _clanScanCache.mode === mode && now - _clanScanCache.at < 3000) return _clanScanCache.roles.slice();
    let byId = {};
    if (typeof _roleReadSavePlayer === 'function') {
        for (let slot = 1; slot <= 8; slot++) {
            let p = _roleReadSavePlayer(slot);
            if (!p || !p.cls || clanModeKey(p) !== mode) continue;
            let id = clanRoleId(p);
            if (id) byId[id] = { id:id, slot:slot, player:p };
        }
    }
    if (typeof player !== 'undefined' && player && player.cls && clanModeKey(player) === mode) {
        let id = clanRoleId(player);
        if (id) byId[id] = { id:id, slot:(typeof currentSlot === 'undefined' ? 0 : currentSlot), player:player };
    }
    let roles = Object.keys(byId).map(id => byId[id]).sort((a, b) => (a.slot || 99) - (b.slot || 99));
    _clanScanCache = { mode:mode, at:now, roles:roles };
    return roles.slice();
}

function clanLeaderRole(p) {
    let mode = clanModeKey(p || player);
    let info = clanGetModeInfo(p || player);
    if (!info) return null;
    return clanScanRoles(mode).find(r => r.id === info.leaderId && r.player && r.player.cls === 'royal') || null;
}

function clanHasFoundingRoyal(p) {
    return !!clanLeaderRole(p || player);
}

// 是否為該模式血盟的盟主本人（刪角警告 js/13 與改名權限共用；只比對 leaderId，不要求 royal 職業以免資料異常時漏警告）
function clanIsLeaderRole(p) {
    if (!p || !p.cls) return false;
    let st = _clanReadState();
    let info = st && st.modes[clanModeKey(p)];
    return !!(info && info.leaderId && info.leaderId === clanRoleId(p));
}

function clanCanSiege(p) {
    return !!clanGetModeInfo(p || player) && clanHasFoundingRoyal(p || player);
}

function clanLeaderDisplayName(p) {
    let info = clanGetModeInfo(p || player);
    let role = clanLeaderRole(p || player);
    if (role && role.player && String(role.player.name || '').trim()) return String(role.player.name).trim();
    return info && info.faction === 'esti' ? '公主' : '王子';
}

function clanNameForPlayer(p) {
    let info = p && p.cls ? clanGetModeInfo(p) : null;
    return info ? info.name : '';
}

function clanSyncCurrentPlayer() {
    if (typeof player === 'undefined' || !player || !player.cls) return false;
    let mode = clanModeKey(player);
    let st = _clanReadState();
    let info = st && st.modes[mode];
    if (player.siege) {
        delete player.siege.victoryUntil;
        delete player.siege.victoryCity;
        delete player.siege.rewardPending;
    }
    if (!info) {
        player.bloodPledge = null;
        player.clanName = null;
        return false;
    }
    player.bloodPledge = info.faction;
    player.clanName = info.name;
    let id = clanRoleId(player);
    if (!id || (st.members[id] && st.members[id].mode === mode)) return true;
    _clanWithLock(live => {
        if (!live.modes[mode]) return { commit:false, error:'血盟已不存在。' };
        if (!live.members[id]) live.members[id] = { mode:mode, contribution:0, buffOn:false, buffAt:0 };
        return {};
    });
    return true;
}

function clanOnRoleDeleted(oldPlayer) {
    if (!oldPlayer || !oldPlayer.cls) return { ok:true };
    let mode = clanModeKey(oldPlayer);
    let id = clanRoleId(oldPlayer);
    if (!id) return { ok:true };
    let result = _clanWithLock(st => {
        let info = st.modes[mode];
        if (info && info.leaderId === id) {
            st.modes[mode] = null;
            Object.keys(st.members).forEach(mid => { if (st.members[mid] && st.members[mid].mode === mode) delete st.members[mid]; });
            return { dissolved:true };
        }
        delete st.members[id];
        return {};
    });
    _clanScanCache.at = 0;   // 角色已刪除：清掉存檔位掃描快取，成員清單／盟主判定立即反映
    return result;
}

function clanCreateFromInput() {
    if (!player || player.cls !== 'royal') { alert('只有王族可以創立血盟。'); return; }
    let input = document.getElementById('clan-name-input');
    let name = String(input ? input.value : '').trim();
    if (!name || name.length > 20) { alert('血盟名稱需為 1 至 20 個字。'); return; }
    if ((player.gold || 0) < CLAN_CREATE_COST) { alert('創立血盟需要 30,000 金幣。'); return; }
    let mode = clanModeKey(player);
    let leaderId = clanRoleId(player);
    let faction = player.avatar === '公主' ? 'esti' : 'tros';
    let result = _clanWithLock(st => {
        if (st.modes[mode]) return { commit:false, error:'此模式已經創立血盟。' };
        st.modes[mode] = { name:name, leaderId:leaderId, faction:faction, createdAt:Date.now(), castle:null };
        if (!st.members[leaderId]) st.members[leaderId] = { mode:mode, contribution:0, buffOn:false, buffAt:0 };
        return {};
    });
    if (!result.ok) { alert(result.error || '創立血盟失敗。'); return; }
    let oldGold = player.gold;
    player.gold -= CLAN_CREATE_COST;
    player.bloodPledge = faction;
    player.clanName = name;
    if (typeof saveGame === 'function' && saveGame() !== true) {
        player.gold = oldGold;
        player.bloodPledge = null;
        player.clanName = null;
        let rb = _clanWithLock(st => {
            if (st.modes[mode] && st.modes[mode].leaderId === leaderId) st.modes[mode] = null;
            delete st.members[leaderId];
            return {};
        });
        // ⚠️ v3.6.01 saveGame() 回 false ≠ 沒寫入（js/13 角色檔先 _lzSet 落地→寵物名冊後寫）：
        //    磁碟可能已是「扣了 30,000 金幣」的版本，還原後必須補存一次寫回（比照 js/12 whTxnCommit v3.5.92）。
        let restored = (typeof saveGame === 'function') && saveGame() === true;
        alert('角色存檔失敗，創立血盟已取消'
            + (rb && rb.ok ? '' : '（血盟資料回滾失敗，血盟可能仍存在，請開啟血盟分頁確認）')
            + (restored ? '，金幣未扣除。' : '；金幣已在記憶體中還原但尚未寫入存檔，請勿繼續操作並重新整理頁面。'));
        return;
    }
    _clanScanCache.at = 0;   // 新盟主誕生：清掃描快取讓盟主判定立即生效
    if (typeof logSys === 'function') logSys(`<span class="text-amber-300 font-bold">你創立了血盟「${clanEsc(name)}」。</span>`);
    if (typeof updateUI === 'function') updateUI();
    renderClanTab();
}

function _clanAdjustContribution(points) {
    points = Math.trunc(Number(points) || 0);
    if (!points) return { ok:true };
    let mode = clanModeKey(player);
    let id = clanRoleId(player);
    return _clanWithLock(st => {
        if (!st.modes[mode]) return { commit:false, error:'你尚未加入血盟。' };
        let member = st.members[id] || (st.members[id] = { mode:mode, contribution:0, buffOn:false, buffAt:0 });
        if (member.mode !== mode) member = st.members[id] = { mode:mode, contribution:0, buffOn:false, buffAt:0 };
        if (points < 0 && member.contribution < -points) return { commit:false, error:'貢獻度不足。' };
        member.contribution = Math.max(0, member.contribution + points);
        st.xp = Math.max(0, st.xp + points);
        return { contribution:member.contribution, xp:st.xp };
    });
}

function clanDonateGold() {
    let el = document.getElementById('clan-gold-donate');
    let amount = Math.floor(Number(el && el.value) || 0);
    if (amount < 10000 || amount % 10000 !== 0) { alert('金幣捐獻需為 10,000 的整數倍。'); return; }
    if ((player.gold || 0) < amount) { alert('金幣不足。'); return; }
    let points = amount / 10000;
    player.gold -= amount;
    let result = _clanAdjustContribution(points);
    if (!result.ok) { player.gold += amount; alert(result.error || '捐獻失敗。'); return; }
    if (typeof saveGame === 'function' && saveGame() !== true) {
        let rb = _clanAdjustContribution(-points);   // 可能撞多分頁鎖失敗：如實回報，勿默默當作已回滾
        player.gold += amount;
        // ⚠️ v3.6.01 saveGame() 回 false ≠ 沒寫入（角色檔先落地）：還原金幣後必須補存（比照 whTxnCommit v3.5.92）
        let restored = (typeof saveGame === 'function') && saveGame() === true;
        alert('角色存檔失敗，本次捐獻已取消'
            + (rb && rb.ok ? '' : '（貢獻回滾失敗，本次貢獻與血盟經驗已保留）')
            + (restored ? '，金幣未扣除。' : '；金幣已在記憶體中還原但尚未寫入存檔，請勿繼續操作並重新整理頁面。'));
        return;
    }
    if (typeof logSys === 'function') logSys(`<span class="text-amber-300">捐獻 ${amount.toLocaleString()} 金幣，獲得 ${points.toLocaleString()} 貢獻與血盟經驗。</span>`);
    if (typeof updateUI === 'function') updateUI();
    renderClanTab();
}

function clanDonateDiamonds() {
    let el = document.getElementById('clan-diamond-donate');
    let amount = Math.floor(Number(el && el.value) || 0);
    if (amount < 1) { alert('請輸入要捐獻的龍之鑽石數量。'); return; }
    if (typeof window.pandoraAdjustSharedDiamonds !== 'function') { alert('龍之鑽石資料目前無法使用。'); return; }
    let spend = window.pandoraAdjustSharedDiamonds(-amount);
    if (!spend || !spend.ok) { alert((spend && spend.error) || '龍之鑽石不足。'); return; }
    let points = amount * 100;
    let result = _clanAdjustContribution(points);
    if (!result.ok) {
        let refund = window.pandoraAdjustSharedDiamonds(amount);   // 退鑽也可能失敗（共用桶寫入異常）：如實回報，勿讓鑽石默默蒸發
        alert((result.error || '捐獻失敗。') + ((refund && refund.ok) ? '' : ' 且龍之鑽石退回失敗，請重新整理後於黑市確認鑽石數量。'));
        return;
    }
    if (typeof logSys === 'function') logSys(`<span class="text-cyan-300">捐獻 ${amount.toLocaleString()} 顆龍之鑽石，獲得 ${points.toLocaleString()} 貢獻與血盟經驗。</span>`);
    if (typeof updateUI === 'function') updateUI();
    renderClanTab();
}

function _clanSettleRole(p) {
    if (!p || !p.cls) return { changed:false };
    let mode = clanModeKey(p), id = clanRoleId(p), now = Date.now();
    let preview = _clanReadState();
    let member = preview && preview.members[id];
    if (!preview || !preview.modes[mode] || !member || member.mode !== mode || !member.buffOn) return { changed:false };
    let elapsed = Math.floor((now - (member.buffAt || now)) / CLAN_BUFF_HOUR_MS);
    if (member.contribution >= CLAN_BUFF_HOUR_COST && elapsed < 1) return { changed:false };
    return _clanWithLock(st => {
        let live = st.members[id];
        if (!st.modes[mode] || !live || live.mode !== mode || !live.buffOn) return { commit:false, changed:false };
        let due = Math.max(0, Math.floor((now - (live.buffAt || now)) / CLAN_BUFF_HOUR_MS));
        let affordable = Math.floor(live.contribution / CLAN_BUFF_HOUR_COST);
        let paid = Math.min(due, affordable);
        if (paid > 0) {
            live.contribution -= paid * CLAN_BUFF_HOUR_COST;
            live.buffAt = (live.buffAt || now) + paid * CLAN_BUFF_HOUR_MS;
        }
        let stop = live.contribution < CLAN_BUFF_HOUR_COST || paid < due;
        if (stop) { live.buffOn = false; live.buffAt = 0; }
        if (!paid && !stop) return { commit:false, changed:false };
        return { changed:true, turnedOff:stop, paid:paid, contribution:live.contribution };
    });
}

function getClanBuffStats(p) {
    p = p || player;
    if (!p || !p.cls) return null;
    let id = clanRoleId(p);
    let now = Date.now();
    if (id && now - (Number(_clanLastSettleByRole[id]) || 0) >= 30000) {
        _clanLastSettleByRole[id] = now;
        let settled = _clanSettleRole(p);
        if (settled && settled.ok && settled.turnedOff && typeof logSys === 'function' &&
            !(typeof _recomputingAlly !== 'undefined' && _recomputingAlly)) {
            logSys('<span class="text-amber-300">血盟貢獻不足，血盟 Buff 已自動關閉。</span>');
        }
    }
    let st = _clanReadState();
    let mode = clanModeKey(p);
    let member = st && st.members[id];
    if (!st || !st.modes[mode] || !member || member.mode !== mode || !member.buffOn || member.contribution < CLAN_BUFF_HOUR_COST) return null;
    let level = clanLevelInfo(st.xp).level;
    return Object.assign({}, CLAN_BUFF_BY_LEVEL[level]);
}

function clanToggleBuff(on) {
    let mode = clanModeKey(player), id = clanRoleId(player);
    let result = _clanWithLock(st => {
        if (!st.modes[mode]) return { commit:false, error:'你尚未加入血盟。' };
        let member = st.members[id] || (st.members[id] = { mode:mode, contribution:0, buffOn:false, buffAt:0 });
        if (on && member.contribution < CLAN_BUFF_HOUR_COST) return { commit:false, error:'至少需要 5 點貢獻才能開啟血盟 Buff。' };
        let partialCharged = false;
        if (!on && member.buffOn && member.buffAt > 0) {
            // 💰 v3.6.01 關閉結算（用戶拍板）：先收滿已經過的整點時數，再對「未滿 1 小時」的殘餘照收 5 點。
            //    否則每 59 分鐘關開一次即可永遠躲過整點扣款＝5 點貢獻蹭永久 Buff。
            let now = Date.now();
            let due = Math.max(0, Math.floor((now - member.buffAt) / CLAN_BUFF_HOUR_MS));
            let affordable = Math.floor(member.contribution / CLAN_BUFF_HOUR_COST);
            let paid = Math.min(due, affordable);
            member.contribution -= paid * CLAN_BUFF_HOUR_COST;
            member.buffAt += paid * CLAN_BUFF_HOUR_MS;
            if (paid >= due && now > member.buffAt) {
                member.contribution = Math.max(0, member.contribution - CLAN_BUFF_HOUR_COST);
                partialCharged = true;
            }
        }
        member.buffOn = !!on;
        member.buffAt = on ? Date.now() : 0;
        return { partialCharged:partialCharged, contribution:member.contribution };
    });
    if (!result.ok) { alert(result.error || '血盟 Buff 設定失敗。'); renderClanTab(); return; }
    delete _clanLastSettleByRole[id];
    if (typeof calcStats === 'function') calcStats();
    if (typeof updateUI === 'function') updateUI();
    if (typeof logSys === 'function') logSys(on ? '<span class="text-green-300">血盟 Buff 已開啟，每小時消耗 5 點貢獻（關閉時未滿 1 小時亦計收 5 點）。</span>'
        : `<span class="text-slate-300">血盟 Buff 已關閉。${result.partialCharged ? '未滿 1 小時的使用時間已計收 5 點貢獻。' : ''}</span>`);
    renderClanTab();
}

// 👑 v3.6.01 血盟改名（用戶需求）：僅創立血盟的王族盟主本人可改；只動共用狀態的 name，貢獻/經驗/城堡不變。
function clanRenameFromInput() {
    if (!player || player.cls !== 'royal') { alert('只有王族盟主可以更改血盟名稱。'); return; }
    let input = document.getElementById('clan-rename-input');
    let name = String(input ? input.value : '').trim();
    if (!name || name.length > 20) { alert('血盟名稱需為 1 至 20 個字。'); return; }
    let mode = clanModeKey(player), id = clanRoleId(player);
    let result = _clanWithLock(st => {
        let info = st.modes[mode];
        if (!info) return { commit:false, error:'你尚未加入血盟。' };
        if (info.leaderId !== id) return { commit:false, error:'只有創立血盟的盟主可以改名。' };
        if (info.name === name) return { commit:false, error:'新名稱與目前名稱相同。' };
        let oldName = info.name;
        info.name = name;
        return { oldName:oldName };
    });
    if (!result.ok) { alert(result.error || '血盟改名失敗。'); return; }
    player.clanName = name;   // 同步目前角色顯示；其他角色由 clanSyncCurrentPlayer 於載入/開面板時同步
    if (typeof saveGame === 'function') saveGame();
    if (typeof logSys === 'function') logSys(`<span class="text-amber-300 font-bold">血盟「${clanEsc(result.oldName)}」已更名為「${clanEsc(name)}」。</span>`);
    if (typeof updateUI === 'function') updateUI();
    renderClanTab();
}

function clanNpcVisible(npcId, townId) {
    if (!player || !player.cls || player.cls === 'royal') return false;
    let info = clanGetModeInfo(player);
    if (!info || !clanHasFoundingRoyal(player)) return false;
    if (info.faction === 'esti') return npcId === 'npc_esti' && townId === 'town_heine';
    return npcId === 'npc_tros' && townId === 'town_oren';
}

function clanNpcDisplayName() {
    return clanLeaderDisplayName(player);
}

function clanOpenSiegePanel() {
    let info = clanGetModeInfo(player);
    if (!info) { alert('你尚未加入血盟。'); return; }
    if (!clanCanSiege(player)) { alert('此模式沒有創立血盟的王族，無法攻城。'); return; }
    if (typeof openTownFloatWindow !== 'function' || typeof openSiegeSelect !== 'function') return;
    openTownFloatWindow(clanLeaderDisplayName(player), '血盟', el => openSiegeSelect(info.faction, el));
}

function clanEsc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function _clanRoleDisplayName(p) {
    let name = String(p && p.name || '').trim();
    return name || CLAN_CLASS_NAMES[p && p.cls] || '角色';
}

function _clanBuffText(buff) {
    if (!buff) return '';
    return `HP +${buff.hp}、MP +${buff.mp}、額外傷害 +${buff.extraDmg}、額外命中 +${buff.extraHit}、魔法防禦 +${buff.mr}、魔法傷害 +${buff.magicDmg}、HP/MP 自然恢復 +${buff.hpR}、防禦 ${buff.ac}`;
}

function setClanPanelView(view) {
    _clanPanelView = view === 'hostile' ? 'hostile' : 'home';
    renderClanTab();
}

function _npcClanCastleLabel(world, clanId) {
    if (!world || !world.castleOwners) return '未佔領城堡';
    let cities = Object.keys(CLAN_CASTLE_NAMES).filter(city => world.castleOwners[city] === clanId);
    return cities.length ? cities.map(city => CLAN_CASTLE_NAMES[city]).join('、') : '未佔領城堡';
}

function _npcClanWarRemainingText(ms) {
    let totalMinutes = Math.max(1, Math.ceil((Number(ms) || 0) / 60000));
    let hours = Math.floor(totalMinutes / 60);
    let minutes = totalMinutes % 60;
    if (!hours) return `${minutes} 分鐘`;
    return `${hours} 小時${minutes ? ` ${minutes} 分鐘` : ''}`;
}

// 🏴 v3.6.52 宣戰列表：顯示「遊戲中所有 NPC 血盟」（不再只列已識別/已交戰者），四種外交狀態各自配色。
//   和平＝藍｜宣戰(我方單方)／對方宣戰(NPC 單方)＝淺紅｜互相宣戰＝深紅。求和中維持既有的嘲諷/解除功能，以附註標籤呈現。
function _npcClanHostilePanelHtml() {
    let world = npcClanGetWorld(player);
    let clans = world && Array.isArray(world.clans) ? world.clans.filter(Boolean) : [];
    let royal = player.cls === 'royal';
    let rows = clans.map(clan => {
        let status, statusCls;
        if (clan.war && clan.hostile) { status = '互相宣戰'; statusCls = 'clan-dip-mutual'; }
        else if (clan.war)            { status = '宣戰';     statusCls = 'clan-dip-war'; }
        else if (clan.hostile)        { status = '對方宣戰'; statusCls = 'clan-dip-enemy'; }
        else                          { status = '和平';     statusCls = 'clan-dip-peace'; }
        let warRemaining = _npcClanWarRemainingMs(clan, Date.now());
        let mercyTag = (clan.mercy && clan.mercy.pending) ? '<span class="text-amber-300 font-bold ml-2">（求和中）</span>' : '';
        let warLockTag = warRemaining > 0 ? `<span class="text-amber-300 font-normal ml-2">（${_npcClanWarRemainingText(warRemaining)}後可停止）</span>` : '';
        let leader = clan.leader && clan.leader.n ? clan.leader.n : '未知盟主';
        let actions = '';
        if (royal && clan.mercy && clan.mercy.pending) {
            actions = `<div class="flex gap-2 shrink-0">
                <button class="btn px-3 py-2 text-sm font-bold bg-red-900 border-red-600 text-red-100" onclick="npcClanMercyAction('${clan.id}','taunt')">嘲諷</button>
                ${warRemaining > 0
                    ? '<button class="btn px-3 py-2 text-sm font-bold opacity-60 cursor-not-allowed" disabled>尚不可解除</button>'
                    : `<button class="btn px-3 py-2 text-sm font-bold bg-emerald-900 border-emerald-600 text-emerald-100" onclick="npcClanMercyAction('${clan.id}','release')">解除</button>`}
            </div>`;
        } else if (royal && clan.war) {
            actions = warRemaining > 0
                ? '<button class="btn shrink-0 px-3 py-2 text-sm font-bold opacity-60 cursor-not-allowed" disabled>尚不可解除</button>'
                : `<button class="btn shrink-0 px-3 py-2 text-sm font-bold bg-emerald-900 border-emerald-600 text-emerald-100" onclick="npcClanSetWar('${clan.id}',false)">停止宣戰</button>`;
        } else if (royal) {
            actions = `<button class="btn shrink-0 px-3 py-2 text-sm font-bold bg-red-900 border-red-600 text-red-100" onclick="npcClanSetWar('${clan.id}',true)">宣戰</button>`;
        }
        return `<div class="border border-slate-700 bg-slate-900/80 rounded p-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
                <div class="font-bold text-slate-100 truncate">${clanEsc(clan.name)}</div>
                <div class="text-xs text-slate-400 mt-1">盟主：${clanEsc(leader)}・${clanEsc(_npcClanCastleLabel(world, clan.id))}</div>
                <div class="text-xs font-bold mt-1 ${statusCls}">${status}${mercyTag}${warLockTag}</div>
            </div>
            ${actions}
        </div>`;
    }).join('');
    return `<div class="flex flex-col gap-3">
        ${rows || '<div class="text-slate-500 text-sm bg-slate-900/60 border border-slate-800 rounded p-4 text-center">目前世界上沒有 NPC 血盟。</div>'}
    </div>`;
}

function renderClanTab() {
    let div = document.getElementById('tab-clan');
    if (!div || !player || !player.cls) return;
    clanSyncCurrentPlayer();
    let read = _clanReadStateResult();
    if (!read.ok) {
        div.innerHTML = `<div class="p-3 text-red-300 font-bold">${clanEsc(read.error)}</div>`;
        return;
    }
    let st = read.state, mode = clanModeKey(player), info = st.modes[mode];
    if (!info) {
        div.innerHTML = `
            <div class="flex flex-col gap-4 p-2">
                <div class="border-b border-slate-600 pb-3">
                    <div class="text-amber-200 font-bold text-lg">你尚未加入血盟</div>
                    <div class="text-sm text-slate-400 mt-1">此模式需由王族角色創立血盟。</div>
                </div>
                ${player.cls === 'royal' ? `
                <div class="flex flex-col gap-2">
                    <label class="text-sm text-slate-300" for="clan-name-input">血盟名稱</label>
                    <input id="clan-name-input" maxlength="20" class="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded" placeholder="輸入 1 至 20 個字">
                    <button class="btn py-2 font-bold bg-amber-800 border-amber-500 text-amber-100" onclick="clanCreateFromInput()">創立血盟（30,000 金幣）</button>
                </div>` : ''}
            </div>`;
        return;
    }
    _clanSettleRole(player);
    st = _clanReadState() || st;
    info = st.modes[mode];
    npcClanEnsureWorld(player);
    let hostileCount = npcClanHostileList(player).length;
    let clanNav = `<div class="grid grid-cols-2 gap-2 border-b border-slate-700 pb-3">
        <button class="btn py-2 font-bold ${_clanPanelView === 'home' ? 'bg-amber-800 border-amber-500 text-amber-100' : 'bg-slate-800 border-slate-600 text-slate-300'}" onclick="setClanPanelView('home')">血盟</button>
        <button class="btn py-2 font-bold ${_clanPanelView === 'hostile' ? 'bg-red-900 border-red-600 text-red-100' : 'bg-slate-800 border-slate-600 text-slate-300'}" onclick="setClanPanelView('hostile')">宣戰${hostileCount ? `（${hostileCount}）` : ''}</button>
    </div>`;
    if (_clanPanelView === 'hostile') {
        div.innerHTML = `<div class="flex flex-col gap-4 p-2">${clanNav}${_npcClanHostilePanelHtml()}</div>`;
        return;
    }
    let levelInfo = clanLevelInfo(st.xp);
    let buff = CLAN_BUFF_BY_LEVEL[levelInfo.level];
    let id = clanRoleId(player);
    let current = st.members[id] || { contribution:0, buffOn:false };
    let roles = clanScanRoles(mode);
    roles.sort((a, b) => (a.id === info.leaderId ? -1 : 0) - (b.id === info.leaderId ? -1 : 0) || (a.slot || 99) - (b.slot || 99));
    let memberRows = roles.map(role => {
        let p = role.player, member = st.members[role.id] || { contribution:0 };
        let isLeader = role.id === info.leaderId;
        return `<div class="flex items-center justify-between gap-3 py-2 border-b border-slate-700">
            <div class="min-w-0">
                <span class="text-slate-100 font-bold">${clanEsc(_clanRoleDisplayName(p))}</span>
                <span class="text-xs text-slate-400 ml-2">${clanEsc(CLAN_CLASS_NAMES[p.cls] || p.cls)}</span>
                ${isLeader ? '<span class="text-xs text-amber-300 ml-2">盟主</span>' : ''}
            </div>
            <span class="text-cyan-200 shrink-0">${member.contribution.toLocaleString()} 貢獻</span>
        </div>`;
    }).join('');
    let xpText = levelInfo.level >= 10 ? `${st.xp.toLocaleString()}（最高等級）` : `${levelInfo.current.toLocaleString()} / ${levelInfo.next.toLocaleString()}`;
    let diamonds = typeof window.pandoraGetSharedDiamonds === 'function' ? Number(window.pandoraGetSharedDiamonds()) || 0 : 0;
    let castle = info.castle ? CLAN_CASTLE_NAMES[info.castle] : '尚未佔領';
    div.innerHTML = `
        <div class="flex flex-col gap-4 p-2">
            ${clanNav}
            <div class="flex items-start justify-between gap-3 border-b border-slate-600 pb-3">
                <div>
                    <div class="text-amber-200 font-bold text-xl">${clanEsc(info.name)}</div>
                    <div class="text-sm text-slate-400 mt-1">盟主：${clanEsc(clanLeaderDisplayName(player))}　城堡：${clanEsc(castle)}</div>
                </div>
                <div class="text-right shrink-0">
                    <div class="text-cyan-200 font-bold">血盟 Lv.${levelInfo.level}</div>
                    <div class="text-xs text-slate-400">經驗 ${xpText}</div>
                </div>
            </div>
            <div>
                <div class="flex items-center justify-between gap-3 mb-2">
                    <div>
                        <div class="text-slate-100 font-bold">血盟 Buff</div>
                        <div class="text-xs text-slate-400">每小時消耗 5 貢獻（關閉時未滿 1 小時亦計 5 點），目前 ${current.contribution.toLocaleString()} 貢獻</div>
                    </div>
                    <label class="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                        <input type="checkbox" ${current.buffOn ? 'checked' : ''} onchange="clanToggleBuff(this.checked)">
                        <span>${current.buffOn ? '已開啟' : '已關閉'}</span>
                    </label>
                </div>
                <div class="text-sm text-emerald-200 leading-relaxed border-l-2 border-emerald-700 pl-3">${_clanBuffText(buff)}</div>
            </div>
            <div class="border-t border-slate-700 pt-3">
                <div class="text-slate-100 font-bold mb-2">捐獻</div>
                <div class="flex gap-2 mb-2">
                    <input id="clan-gold-donate" type="number" min="10000" step="10000" value="10000" class="min-w-0 flex-1 bg-slate-900 border border-slate-600 text-white px-2 py-2 rounded">
                    <button class="btn px-3 py-2 font-bold bg-amber-800 border-amber-500 text-amber-100" onclick="clanDonateGold()">捐金幣</button>
                </div>
                <div class="flex gap-2">
                    <input id="clan-diamond-donate" type="number" min="1" step="1" value="1" class="min-w-0 flex-1 bg-slate-900 border border-slate-600 text-white px-2 py-2 rounded">
                    <button class="btn px-3 py-2 font-bold bg-cyan-900 border-cyan-600 text-cyan-100" onclick="clanDonateDiamonds()">捐龍鑽（持有 ${diamonds.toLocaleString()}）</button>
                </div>
                <div class="text-xs text-slate-400 mt-2">10,000 金幣 = 1 貢獻；1 龍之鑽石 = 100 貢獻。貢獻會增加等量的全模式共用血盟經驗。</div>
            </div>
            <div class="border-t border-slate-700 pt-3">
                <div class="text-slate-100 font-bold mb-1">血盟成員</div>
                ${memberRows || '<div class="text-slate-400 py-2">目前沒有可顯示的成員。</div>'}
            </div>
            ${(player.cls === 'royal' && id === info.leaderId) ? `
            <div class="border-t border-slate-700 pt-3">
                <div class="text-slate-100 font-bold mb-2">血盟改名（限盟主）</div>
                <div class="flex gap-2">
                    <input id="clan-rename-input" maxlength="20" value="${clanEsc(info.name)}" class="min-w-0 flex-1 bg-slate-900 border border-slate-600 text-white px-2 py-2 rounded">
                    <button class="btn px-3 py-2 font-bold bg-amber-800 border-amber-500 text-amber-100" onclick="clanRenameFromInput()">改名</button>
                </div>
            </div>` : ''}
            ${player.cls === 'royal' ? '<button class="btn py-3 font-bold bg-red-900 border-red-600 text-red-100" onclick="clanOpenSiegePanel()">攻城</button>' : ''}
        </div>`;
}

function clanExportSharedState() {
    let st = _clanReadState();
    return st ? JSON.parse(JSON.stringify(st)) : null;
}

function clanRestoreSharedState(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return { ok:false, error:'血盟資料格式不正確。' };
    let clean = _clanNormalizeState(snapshot);
    return _clanWithLock(st => {
        st.v = clean.v;
        st.xp = clean.xp;
        st.modes = clean.modes;
        st.members = clean.members;
        st.npcWorlds = clean.npcWorlds;
        return {};
    });
}

function _clanBuffTimerTick() {
    if (!player || !player.cls) return;
    let main = player;
    let roles = [main].concat(Array.isArray(main.allies) ? main.allies.filter(a => a && !a._downed) : []);
    let changedMain = false, changedAllies = [];
    roles.forEach((role, index) => {
        let result = _clanSettleRole(role);
        if (!result || !result.ok || !result.changed) return;
        let id = clanRoleId(role);
        if (id) _clanLastSettleByRole[id] = Date.now();
        if (index === 0) {
            changedMain = true;
            if (result.turnedOff && typeof logSys === 'function') logSys('<span class="text-amber-300">血盟貢獻不足，血盟 Buff 已自動關閉。</span>');
        } else {
            changedAllies.push(role);
        }
    });
    if (!changedMain && !changedAllies.length) return;
    if (changedMain && typeof calcStats === 'function') calcStats();
    changedAllies.forEach(ally => {
        try { if (typeof _allyLevelRecompute === 'function') _allyLevelRecompute(ally); } catch (e) {}
    });
    if (typeof updateUI === 'function') updateUI();
    let tab = document.getElementById('tab-clan');
    if (tab && !tab.classList.contains('hidden')) renderClanTab();
}

setInterval(() => {
    _clanBuffTimerTick();
    npcClanWorldTick();
}, 60000);

if (typeof window !== 'undefined') {
    window.clanExportSharedState = clanExportSharedState;
    window.clanRestoreSharedState = clanRestoreSharedState;
}
