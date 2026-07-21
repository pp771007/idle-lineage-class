// ===== ⚔️ 存檔 PvP：對戰名片交換 ＋ 決鬥競技場（v3.7.4）=====
// 設計（用戶拍板「名片交換對戰」）：
//   1. 「對戰名片」＝把角色的**戰鬥必要欄位**精簡出來（剝除背包／倉庫／收集冊桶／任務／傭兵／離線資料），
//      再 LZ 壓縮＋SIG1 簽章＋Base64 → 一段可貼在聊天室的字串。
//   2. 對手名片可來自「本機其他存檔位」（免交換·比照 buildAlly 讀存檔位）或「貼上的名片字串」。
//   3. 敵方實體＝名片優先使用匯出端已結算的核心戰鬥快照（舊卡才以 recomputeStats 重算），
//      攻擊面沿用已平衡的白目玩家職業曲線（applyTrollScaling）並依名片攻擊力比值微調，
//      避免把玩家傷害公式整條搬到怪物端造成爆表或歸零。渲染直接複用白目玩家的職業動畫管線。
//   4. 勝負只記榮譽戰績（player.pvpArena），**不掉裝、不給經驗金幣**——純前端無伺服器權威，
//      任何獎勵都會變成作弊套利入口（存檔簽章鹽值就在客戶端原始碼裡，見 js/00:216）。
// ⚠️ 本檔全部功能為「加法」：不修改既有戰鬥/存檔邏輯，killMob 以包裝方式掛勾（比照 js/27 離線收益）。
(function () {
    'use strict';

    const PVP_CARD_PREFIX = 'FB5PVP1:';
    const PVP_ARENA_MAP = 'arena_pvp';
    const PVP_HOME_MAP = 'town_gludin';         // 🏘️ 決鬥結束的歸還地＝鬥技場管理者巴魯特所在的村莊
    const PVP_RESULT_DELAY_MS = 900;            // 分出勝負→跳結果視窗的緩衝（看得完倒下動畫與結算訊息）
    const PVP_HISTORY_MAX = 20;
    // 攻擊面倍率夾擠：名片攻擊力／同等級基準 的比值上下限（防極端裝備直接一拳秒殺或完全打不動）
    const PVP_ATK_MULT_MIN = 0.5;
    const PVP_ATK_MULT_MAX = 2.2;

    // 名片欄位白名單：保留重建外觀、裝備與技能模板需要的原始資料；
    // 共用圖鑑、血盟 Buff 等不適合整桶攜帶的加成，改由下方最終能力快照補足。
    const PVP_CARD_FIELDS = [
        'cls', 'avatar', 'name', 'lv', 'base', 'alloc', 'panacea',
        'eq', 'skills', 'mastery', 'poly', 'buffs', 'classicMode', 'alignmentValue', 'enSeed'
    ];
    // 跨電腦無法取得對方的共用圖鑑／血盟狀態，因此 v2 名片另帶「匯出當下已結算」的核心能力。
    // 所有值仍會在接收端夾限；這不是伺服器防偽，只是避免異常卡片製造無限數值。
    const PVP_SNAPSHOT_D_LIMITS = {
        str: [0, 300], dex: [0, 300], con: [0, 300], int: [0, 300], wis: [0, 300], cha: [0, 300],
        ac: [-2000, 500], mr: [0, 5000], er: [0, 5000], dr: [0, 5000],
        meleeDmg: [-1000, 10000], meleeHit: [-1000, 10000], meleeCrit: [0, 1000], meleeCritDmg: [0, 5000],
        rangedDmg: [-1000, 10000], rangedHit: [-1000, 10000], rangedCrit: [0, 1000], rangedCritDmg: [0, 5000],
        magicDmg: [-1000, 10000], magicHit: [-1000, 10000], magicCrit: [0, 1000], magicCritDmg: [0, 5000],
        extraDmg: [-1000, 10000], extraHit: [-1000, 10000],
        aspd: [0.1, 20], aspdOff: [0, 20], castLock: [1, 1000], supportCastLock: [1, 1000],
        resFire: [-1000, 1000], resWater: [-1000, 1000], resEarth: [-1000, 1000], resWind: [-1000, 1000]
    };

    function _pvpClampFinite(v, lo, hi) {
        v = Number(v);
        return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null;
    }
    function _pvpCardSnapshot(src) {
        if (!src || !src.d || typeof src.d !== 'object') return null;
        let mhp = _pvpClampFinite(src.mhp, 1, 1000000);
        let mmp = _pvpClampFinite(src.mmp, 0, 1000000);
        if (mhp == null || mmp == null) return null;
        let d = {};
        Object.keys(PVP_SNAPSHOT_D_LIMITS).forEach(function (k) {
            let lim = PVP_SNAPSHOT_D_LIMITS[k], v = _pvpClampFinite(src.d[k], lim[0], lim[1]);
            if (v != null) d[k] = v;
        });
        return { mhp: mhp, mmp: mmp, d: d };
    }
    function _pvpSanitizeSnapshot(raw) {
        if (!raw || typeof raw !== 'object' || !raw.d || typeof raw.d !== 'object') return null;
        let mhp = _pvpClampFinite(raw.mhp, 1, 1000000);
        let mmp = _pvpClampFinite(raw.mmp, 0, 1000000);
        if (mhp == null || mmp == null) return null;
        let d = {};
        Object.keys(PVP_SNAPSHOT_D_LIMITS).forEach(function (k) {
            let lim = PVP_SNAPSHOT_D_LIMITS[k], v = _pvpClampFinite(raw.d[k], lim[0], lim[1]);
            if (v != null) d[k] = v;
        });
        return { mhp: mhp, mmp: mmp, d: d };
    }

    // ---------- Base64 編碼（LZString 精簡版只暴露 UTF16；此處用同一份 _compress/_decompress 產出可貼上的 Base64）----------
    const _PVP_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    function _pvpCompressB64(s) {
        if (s == null) return '';
        let res = LZString._compress(s, 6, function (a) { return _PVP_B64.charAt(a); });
        switch (res.length % 4) {
            case 0: return res;
            case 1: return res + '===';
            case 2: return res + '==';
            default: return res + '=';
        }
    }
    function _pvpDecompressB64(s) {
        if (s == null || s === '') return null;
        return LZString._decompress(s.length, 32, function (i) { return _PVP_B64.indexOf(s.charAt(i)); });
    }

    // ---------- 名片建構 ----------
    // src 省略＝當前 player；亦可傳入從別的存檔位讀出的 p 物件
    function pvpCardBuild(src) {
        let p = src || (typeof player !== 'undefined' ? player : null);
        if (!p || !p.cls) return null;
        let body = {};
        try {
            PVP_CARD_FIELDS.forEach(function (k) {
                if (p[k] !== undefined) body[k] = JSON.parse(JSON.stringify(p[k]));
            });
        } catch (e) { return null; }
        body.inv = [];            // 重量計算需要此欄位存在（空背包＝無負重懲罰·雙方一致）
        body.allies = [];         // 名片只帶角色本體，不帶傭兵（1v1）
        body.statuses = {};       // 不繼承來源存檔的中毒/冰凍等殘留
        body.d = {};              // ⚠️ recomputeStats 首行就寫 d.str → 此物件必須存在（內容會被完整重算·不必攜帶）
        return {
            v: 2,
            n: String(p.name || '無名'),
            cls: String(p.cls || ''),
            avatar: String(p.avatar || ''),
            lv: Math.max(1, Math.min(100, Math.floor(Number(p.lv) || 1))),
            classic: !!p.classicMode,
            clan: (typeof clanNameForPlayer === 'function' ? (clanNameForPlayer(p) || '') : ''),
            align: (typeof pvpClampAlignment === 'function') ? pvpClampAlignment(p.alignmentValue) : 0,
            stats: _pvpCardSnapshot(p),
            p: body
        };
    }

    // ---------- 防作弊夾擠（名片是別人給的字串·一律不信任）----------
    // ⚠️ 純前端無法做到真正防偽（簽章鹽值內嵌於原始碼）；此處只保證「數值落在遊戲本身可達的範圍內」，
    //    讓改名片的人最多只能造出一個「滿等滿裝」的合法角色，而不是 HP 十億的怪物。
    function pvpCardSanitize(card) {
        if (!card || typeof card !== 'object' || !card.p || typeof card.p !== 'object') return null;
        let p = card.p;
        if (!p.cls || typeof p.cls !== 'string') return null;
        p.lv = Math.max(1, Math.min(100, Math.floor(Number(p.lv) || 1)));
        card.lv = p.lv;
        // 六維：夾在 1~100（遊戲內上限）
        let clampStats = function (o) {
            if (!o || typeof o !== 'object') return;
            ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (k) {
                if (o[k] == null) return;
                let v = Math.floor(Number(o[k]) || 0);
                o[k] = Math.max(0, Math.min(100, v));
            });
        };
        clampStats(p.base); clampStats(p.alloc); clampStats(p.panacea);
        // 裝備：id 必須存在於 DB.items；強化值夾到該類上限（比照 sanitizeState）
        if (p.eq && typeof p.eq === 'object') {
            Object.keys(p.eq).forEach(function (slot) {
                let it = p.eq[slot];
                if (!it || typeof it !== 'object' || !it.id || !DB.items[it.id]) { delete p.eq[slot]; return; }
                let dd = DB.items[it.id];
                if (dd.type === 'wpn' || dd.type === 'arm' || dd.type === 'acc') {
                    let cap = (typeof enhanceCap === 'function') ? enhanceCap(dd) : 15;
                    it.en = Math.max(-1, Math.min(cap, Math.floor(Number(it.en) || 0)));
                } else { it.en = 0; }
                it.cnt = 1;
                delete it.lock; delete it.gw; delete it.junk;
            });
        } else { p.eq = {}; }
        // 技能：必須是 DB 內存在的技能 id
        if (Array.isArray(p.skills) && typeof DB !== 'undefined' && DB.skills) {
            p.skills = p.skills.filter(function (sid) { return typeof sid === 'string' && DB.skills[sid]; });
        } else if (!Array.isArray(p.skills)) { p.skills = []; }
        // 精通：必須是字串（不存在的精通在 recomputeStats 內只會比對不到·無副作用）
        if (typeof p.mastery !== 'string') delete p.mastery;
        p.buffs = (p.buffs && typeof p.buffs === 'object') ? p.buffs : {};
        p.statuses = {};
        p.inv = []; p.allies = []; p.d = {};
        // 白名單外的欄位一律丟棄（防止有人把整份存檔塞進 p 夾帶未預期的旗標）
        Object.keys(p).forEach(function (k) {
            if (PVP_CARD_FIELDS.indexOf(k) < 0 && ['inv', 'allies', 'statuses', 'd'].indexOf(k) < 0) delete p[k];
        });
        p.alignmentValue = (typeof pvpClampAlignment === 'function') ? pvpClampAlignment(p.alignmentValue) : 0;
        card.align = p.alignmentValue;
        card.n = String(card.n || p.name || '無名').slice(0, 24);
        card.avatar = (typeof TROLL_CLASS_BY_AVATAR !== 'undefined' && TROLL_CLASS_BY_AVATAR[card.avatar]) ? card.avatar : _pvpFallbackAvatar(p.cls);
        card.clan = String(card.clan || '').slice(0, 16);
        card.stats = _pvpSanitizeSnapshot(card.stats);
        if (!card.stats) delete card.stats;   // v1 舊名片沒有快照，後續仍走原本重算路徑
        return card;
    }
    function _pvpFallbackAvatar(cls) {
        let m = { royal: '王子', knight: '男騎士', mage: '男法師', elf: '男妖精', dark: '男黑暗妖精', illusion: '男幻術士', dragon: '男龍騎士', warrior: '男戰士' };
        return m[cls] || '男戰士';
    }

    // ---------- 編碼／解碼 ----------
    function pvpCardEncode(card) {
        if (!card) return '';
        let json;
        try { json = JSON.stringify(card); } catch (e) { return ''; }
        return PVP_CARD_PREFIX + _pvpCompressB64(_saveWrap(json));   // 🛡️ 先簽章再壓縮：貼上端可辨識「有無被改過」
    }
    // 回傳 {card, signed, ok}；ok=false＝簽章不符（仍給 card，由呼叫端決定是否警告後照用）
    function pvpCardDecode(str) {
        str = String(str || '').trim();
        if (!str) return null;
        if (str.slice(0, PVP_CARD_PREFIX.length) !== PVP_CARD_PREFIX) return null;
        let packed = str.slice(PVP_CARD_PREFIX.length).replace(/\s+/g, '');
        let raw = null;
        try { raw = _pvpDecompressB64(packed); } catch (e) { return null; }
        if (!raw) return null;
        let u = _saveUnwrap(raw);
        let card = null;
        try { card = JSON.parse(u.payload); } catch (e) { return null; }
        card = pvpCardSanitize(card);
        if (!card) return null;
        return { card: card, signed: !!u.signed, ok: !!u.ok };
    }
    // 從本機存檔位取名片（免交換·比照 buildAlly 讀存檔位）
    function pvpCardFromSlot(slotN) {
        let raw = _saveUnwrap(_lzGet('lineage_idle_save_' + String(slotN))).payload;
        if (!raw) return null;
        let p; try { p = JSON.parse(raw).p; } catch (e) { return null; }
        if (!p || !p.cls) return null;
        return pvpCardSanitize(pvpCardBuild(p));
    }

    // ---------- 名片 → 真實衍生值 ----------
    // 借 buildAlly 的「換身重算」手法：暫時把 player 指向名片角色跑 recomputeStats，取完衍生值再還原。
    function pvpCardDerive(card) {
        if (!card || !card.p) return null;
        let foe;
        try { foe = JSON.parse(JSON.stringify(card.p)); } catch (e) { return null; }
        foe.buffs = foe.buffs || {}; foe.statuses = {}; foe.eq = foe.eq || {}; foe.skills = foe.skills || [];
        foe.alloc = foe.alloc || { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
        foe.panacea = foe.panacea || { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
        foe.inv = []; foe.allies = []; foe.summon = null; foe.charmed = null; foe.partners = [];
        foe.d = {};   // ⚠️ recomputeStats 直接對 d 寫入，物件必須先存在（js/02:13 d.str=…）
        delete foe.blessings; delete foe.summonsV2;
        let _save = player, ok = true;
        let _prevRecomputing = (typeof _recomputingAlly !== 'undefined') ? _recomputingAlly : false;
        player = foe;
        if (typeof _recomputingAlly !== 'undefined') _recomputingAlly = true;   // 🌟 跳過「傭兵化身光環注入玩家」段（同 buildAlly）
        try { recomputeStats(); } catch (e) { ok = false; }
        if (typeof _recomputingAlly !== 'undefined') _recomputingAlly = _prevRecomputing;
        player = _save;
        try { calcStats(); } catch (e) {}   // 還原真實玩家的衍生值（換身重算會覆寫共用暫存）
        // v2 名片以來源端最終值覆蓋重算結果：補回接收端不存在的圖鑑、血盟 Buff 等跨存檔加成。
        let snap = _pvpSanitizeSnapshot(card.stats);
        if (ok && snap) {
            foe.mhp = snap.mhp; foe.mmp = snap.mmp;
            Object.keys(snap.d).forEach(function (k) { foe.d[k] = snap.d[k]; });
        }
        return ok ? foe : null;
    }

    // 攻擊力代理值：取近戰/遠程/魔法三線中最高者（角色實際靠哪條線打就用哪條）＋通用額外傷害/命中。
    // ⚠️ 欄位名為實測確認：player.d 沒有 dmg/hit，只有 meleeDmg/rangedDmg/magicDmg 與 extraDmg/extraHit。
    function _pvpAtkScore(d) {
        d = d || {};
        let dmg = Math.max(Number(d.meleeDmg) || 0, Number(d.rangedDmg) || 0, Number(d.magicDmg) || 0) + (Number(d.extraDmg) || 0);
        let hit = Math.max(Number(d.meleeHit) || 0, Number(d.rangedHit) || 0, Number(d.magicHit) || 0) + (Number(d.extraHit) || 0);
        return { dmg: Math.max(0, dmg), hit: Math.max(0, hit) };
    }
    // 怪物端只有一條普攻計時器；迅猛雙斧用主、副手每秒出手數相加，折算成同等總頻率。
    function _pvpEffectiveAspd(derived) {
        let d = (derived && derived.d) || {};
        let main = Math.max(0.1, Number(d.aspd) || 0.67);
        let hasOffhand = !!(derived && derived.eq && derived.eq.offwpn);
        let off = hasOffhand ? Number(d.aspdOff) : 0;
        if (Number.isFinite(off) && off > 0) return Math.max(0.1, 1 / ((1 / main) + (1 / off)));
        return main;
    }
    // 戰力值（面板顯示用·非戰鬥數值）：HP＋防禦＋攻擊的粗略加權，讓人一眼看出對手強度級距
    function pvpCardPower(derived) {
        if (!derived || !derived.d) return 0;
        let d = derived.d, atk = _pvpAtkScore(d);
        let hp = Math.max(1, Number(derived.mhp) || 1);
        let acPart = Math.max(0, 10 - (Number(d.ac) || 10)) * 40;        // AC 越低越強
        let mrPart = Math.max(0, Number(d.mr) || 0) * 25;
        let speedPart = Math.max(0.25, Math.min(6, 0.67 / _pvpEffectiveAspd(derived)));
        let dmgPart = (atk.dmg + atk.hit * 2) * 60 * speedPart;
        return Math.round(hp + acPart + mrPart + dmgPart);
    }

    // ---------- 名片 → 敵方實體 ----------
    function pvpCardToMob(card) {
        let derived = pvpCardDerive(card);
        if (!derived) return null;
        let d = derived.d || {};
        let mobId = (typeof TROLL_CLASS_BY_AVATAR !== 'undefined' && TROLL_CLASS_BY_AVATAR[card.avatar]) || 'troll_warrior';
        let base = DB.mobs[mobId];
        if (!base) return null;
        let mob = JSON.parse(JSON.stringify(base));
        applyTrollScaling(mob, card.lv);   // 先取同等級的平衡曲線（攻速/普攻骰/常駐額外傷害/回復）
        // 攻擊面：依「名片實際攻擊力 ÷ 同等級基準」微調，讓裝備有感但不失控
        let atk = _pvpAtkScore(d);
        let atkRef = 3 + card.lv * 0.6;
        let atkMult = Math.max(PVP_ATK_MULT_MIN, Math.min(PVP_ATK_MULT_MAX, (atk.dmg + atk.hit * 0.5) / atkRef));
        mob.db = Math.max(0, Math.round((Number(mob.db) || 0) * atkMult));
        if (Array.isArray(mob.dmg)) mob.dmg = [mob.dmg[0], Math.max(mob.dmg[0] + 1, Math.round(mob.dmg[1] * atkMult))];
        mob.hit = Math.round((Number(mob.hit) || 0) + atk.hit * 0.5);
        mob._pvpAtkMult = Math.round(atkMult * 100) / 100;
        // 普攻與施法速度採名片最終值；技能內容仍由 PvP 職業模板決定。
        if (Number.isFinite(Number(d.aspd))) mob.atkSpd = Math.max(0.1, Math.min(20, _pvpEffectiveAspd(derived)));
        if (Number.isFinite(Number(d.castLock)) && typeof castLockTicks === 'function') {
            let baseCast = Math.max(1, Number(castLockTicks({ cls: card.cls, avatar: card.avatar })) || 12);
            let castRatio = Math.max(0.25, Math.min(4, Number(d.castLock) / baseCast));
            ['mag', 'mag2', 'mag3', 'mag4', 'mag5'].forEach(function (k) {
                if (mob[k] && Number.isFinite(Number(mob[k].cd))) mob[k].cd = Math.max(1, Math.round(Number(mob[k].cd) * castRatio));
            });
        }
        // 防禦面：直接用名片真實值（練度有意義·且玩家看得懂）
        mob.hp = Math.max(1, Math.round(Number(derived.mhp) || mob.hp));
        mob.curHp = mob.hp;
        if (Number.isFinite(Number(d.ac))) mob.ac = Math.round(Number(d.ac));
        if (Number.isFinite(Number(d.mr))) mob.mr = Math.max(0, Math.round(Number(d.mr)));
        if (Number.isFinite(Number(d.er))) mob.er = Math.max(0, Math.round(Number(d.er)));
        if (Number.isFinite(Number(d.dr))) {
            // 怪物端沒有玩家的 AC 隨機減免流程，折算其平均值後併入固定減傷。
            let acGap = Math.max(0, 10 - (Number(d.ac) || 10));
            let div = card.cls === 'knight' ? 2 : (['elf', 'dark', 'dragon', 'warrior'].indexOf(card.cls) >= 0 ? 3 : (card.cls === 'illusion' ? 4 : 5));
            let rndMax = Math.floor(acGap / div), rndMin = Math.floor(rndMax / 3);
            mob.dr = Math.max(0, Math.round(Number(d.dr) + (rndMin + rndMax) / 2));
        }
        // 身分／渲染：複用白目玩家的職業動畫管線
        mob.n = card.n;
        mob.race = '玩家';
        mob.exp = 0; mob.goldMin = 0; mob.goldMax = 0;
        mob.trollPlayer = true;
        mob._pvpDuelFoe = true;                       // ⚔️ 決鬥對手標記（killMob 包裝據此判勝）
        mob._pvpCls = String(card.cls || '');         // 🔮 v3.7.15 對手職業（法師 AI 用·見 pvpDuelBestSpellKey）
        mob._pvpAvatar = card.avatar;
        mob._pvpAlignment = Number(card.align) || 0;
        mob._npcClanName = card.clan || '';
        mob.img = 'assets/classanim/' + (card.avatar || '男戰士') + 'F/unarmed_idle_0.png';
        if (typeof MOB_ANIM_NAMES !== 'undefined' && typeof MOB_ANIM_ALIAS !== 'undefined') {
            let _dir = '玩家' + (card.avatar || '男戰士');
            if (MOB_ANIM_ALIAS[card.n] !== _dir) {
                MOB_ANIM_ALIAS[card.n] = _dir;
                if (typeof _mobAnimCache !== 'undefined') delete _mobAnimCache[card.n];
            }
            MOB_ANIM_NAMES.add(card.n);
            if (typeof MOB_ANIM_SPRITE_SHADOW !== 'undefined') MOB_ANIM_SPRITE_SHADOW.add(card.n);
        }
        mob._pvpPower = pvpCardPower(derived);
        return mob;
    }

    // 🚫 v3.7.17 決鬥禁藥（用戶指示「PK 設定雙方都不會使用治癒藥水」）：決鬥進行中且人在競技場 → 治癒藥水一律不生效。
    //   單一真相閘，四個消費點共用：js/07 autoActions（玩家自動喝·連自動補貨一起擋）／js/08 useItem（手動點也擋＝最後防線）／
    //   js/06 allyTryPotion（傭兵）／js/22 petTryPotion（寵物）。
    //   ⚠️ 對手端本來就沒有喝藥水的機制——DB.mobs 全表無任何藥水消費點（怪物只有 regenFix 自然回復與治癒『技能』），
    //      所以「雙方同一規則」實際要擋的是玩家這一側的三條管線；對手的治癒技能屬於技能不在此列。
    function pvpArenaPotionBlocked() {
        return !!(_duel && typeof mapState !== 'undefined' && mapState && mapState.current === PVP_ARENA_MAP);
    }

    // 🔮 v3.7.16 對手法師 AI：優先施放「目前冷卻已就緒、期望傷害最高」的法術（用戶指示）。
    //   回傳那一招的 key，js/03 的施法迴圈拿它做兩件事：①這一發跳過發動機率骰（必放）②排到最前面先打。
    //   ⚠️ 只對「決鬥中的法師對手」生效——野外白目玩家與一般怪一律維持原本的機率制，不動既有平衡。
    //   ⚠️ 只排序帶 dmg 的攻擊型法術；自我 buff／治癒／純狀態技不參與（那些照原本機率走）。
    //   期望值＝骰子平均 dmg[0]×(dmg[1]+1)/2 ＋ db ＋（dbLv ? 等級×dbLvMult : 0），與 js/04 施法傷害同式。
    function pvpDuelBestSpellKey(m) {
        if (!m || !m._pvpDuelFoe || m._pvpCls !== 'mage' || !m._magCd) return null;
        let best = null, bestAvg = -1;
        ['mag', 'mag2', 'mag3', 'mag4', 'mag5'].forEach(function (k) {
            let sk = m[k];
            if (!sk || !Array.isArray(sk.dmg)) return;
            let _al = (typeof pvpClampAlignment === 'function') ? pvpClampAlignment(m._pvpAlignment || 0) : 0;
            if (sk.reqAlign != null && _al < sk.reqAlign) return;   // ⚖️ 性向門檻未達＝視同沒這招（與 js/03 同判定·該招也不進冷卻）
            let cd = m._magCd[k];
            if (cd === undefined || cd - 1 > 0) return;             // 本 tick 遞減後仍 >0＝還在冷卻，不列入候選
            let avg = sk.dmg[0] * (sk.dmg[1] + 1) / 2 + (sk.db || 0) + (sk.dbLv ? (m.lv || 0) * (sk.dbLvMult || 1) : 0);
            if (avg > bestAvg) { bestAvg = avg; best = k; }
        });
        return best;
    }

    // ---------- 決鬥狀態（runtime·不入存檔）----------
    let _duel = null;   // {name, uid, power, startedAt}

    function pvpArenaActive() { return !!_duel; }
    function pvpArenaTravelLocked() {
        return !!(_duel && typeof mapState !== 'undefined' && mapState && mapState.current === PVP_ARENA_MAP);
    }

    // 決鬥中「瞬移」停用；原本的「回村」改為投降。只動按鈕外觀與入口，
    // 技能／卷軸／快捷鍵仍由下方包裝做縱深攔截，避免其他呼叫路徑繞過。
    function _pvpSyncTravelButtons() {
        let locked = pvpArenaTravelLocked();
        let inArena = (typeof mapState !== 'undefined' && mapState && mapState.current === PVP_ARENA_MAP);
        let tp = document.getElementById('btn-teleport');
        if (tp) {
            tp.disabled = locked;
            tp.classList.toggle('opacity-50', locked);
            tp.classList.toggle('cursor-not-allowed', locked);
            tp.title = locked ? '決鬥進行中無法使用瞬間移動' : '傳送術／瞬間移動卷軸（於對應地圖可進入隱藏狩獵區域）';
        }
        let rt = document.getElementById('btn-return-town');
        if (!rt) return;
        if (locked) rt.textContent = '投降';
        else if (inArena) rt.textContent = '回村';
        rt.title = locked ? '投降並記錄本場敗北' : '';
        ['bg-emerald-800', 'hover:bg-emerald-700', 'border-emerald-500'].forEach(function (c) { rt.classList.toggle(c, !locked); });
        ['bg-red-800', 'hover:bg-red-700', 'border-red-500'].forEach(function (c) { rt.classList.toggle(c, locked); });
    }

    // ---------- ⚔️ v3.7.11 決鬥＝純 1v1：傭兵整隊到場邊（用戶指示「實際沒解散傭兵」）----------
    //   做法＝把 `player.allies` 整個搬到 runtime 暫存、決鬥結束原封不動放回去。
    //   ⚠️ 選這個深度是刻意的：allies 一空，戰鬥行動／被選為目標／隊伍面板／戰場 sprite／團隊 buff
    //      全部自然看不到傭兵，不必去十幾個 `!a._downed` 檢查點各加一個新旗標。
    //   ⚠️ 也刻意不用既有的 `_downed`（倒地）：那會讓面板顯示成「傭兵陣亡待復活」，與「沒有解散」的語義不符。
    let _duelBench = null;
    let _duelBenchOwner = '';   // ⚠️ 綁定角色：換角(loadGame)後殘留的暫存絕不能塞給另一個角色

    function _pvpOwnerKey() { return (player && (String(player.name || '') + '|' + String(player.enSeed || ''))) || ''; }

    function _pvpBenchAllies() {
        if (_duelBench) return;
        if (!player || !Array.isArray(player.allies) || !player.allies.filter(Boolean).length) return;
        _duelBenchOwner = _pvpOwnerKey();
        _duelBench = player.allies;
        player.allies = [];
        try { calcStats(); } catch (e) {}
        try { renderTabs(true); } catch (e) {}
        try { updateUI(); } catch (e) {}
        try { logSys('<span class="text-slate-300">⚔️ 決鬥是一對一的較量，你的協力傭兵在場邊等候（不會被解散，結束後自動歸隊）。</span>'); } catch (e) {}
    }

    function _pvpUnbenchAllies() {
        if (!_duelBench) return;
        let benched = _duelBench, owner = _duelBenchOwner;
        _duelBench = null; _duelBenchOwner = '';
        if (owner !== _pvpOwnerKey()) return;   // 已換角 → 整包丟棄（原角色的存檔早由下方守衛保住了完整隊伍）
        // ⚠️ 只有在 allies 確實空著時才放回。若已經有隊伍＝別的路徑（loadGame 從存檔還原）先補上了，
        //    這時再把暫存接回去會變成兩份重複的傭兵（實測 2 人→4 人）——直接丟棄暫存才對。
        if (player) {
            let cur = Array.isArray(player.allies) ? player.allies.filter(Boolean) : [];
            if (!cur.length) player.allies = benched;
        }
        try { calcStats(); } catch (e) {}
        try { renderTabs(true); } catch (e) {}
        try { updateUI(); } catch (e) {}
    }

    // ⚠️ 存檔守衛：傭兵在場邊時 `player.allies` 是空的——這時候存檔會把「沒有傭兵」寫進檔案，
    //    重整後傭兵就真的不見了。包裝 saveGame：寫入前先放回去、寫完再撤下 → 磁碟上永遠是完整隊伍。
    //    （js/28 比 js/13 晚載入，此處 window.saveGame 已定義；手法同下方的 killMob 包裝。）
    const _pvpOrigSaveGame = window.saveGame;
    if (typeof _pvpOrigSaveGame === 'function') {
        window.saveGame = function () {
            if (_duelBench && player && Array.isArray(player.allies) && !player.allies.length) {
                let benched = _duelBench;
                player.allies = benched;
                try { return _pvpOrigSaveGame.apply(this, arguments); }
                finally { if (_duelBench === benched) player.allies = []; }
            }
            return _pvpOrigSaveGame.apply(this, arguments);
        };
    }

    // ⚔️ v3.7.9 決鬥落敗＝完全無損失（用戶拍板）：killPlayer(js/04) 以此閘跳過經驗損失／紅名掉裝／
    //    性向與復仇名單結算（決鬥對手帶 trollPlayer 標記，不擋的話會被算成一次真的 PvP 擊殺）。
    //    ⚠️ 必須「決鬥進行中」＋「人在競技場」同時成立才豁免——只看 _duel 的話，狀態殘留時會誤放野外死亡。
    function pvpArenaDeathExempt() {
        return !!(_duel && typeof mapState !== 'undefined' && mapState && mapState.current === PVP_ARENA_MAP);
    }

    // 🙈 v3.7.13 決鬥進行中不顯示任何決鬥浮動 UI（挑戰面板 modal＋常駐入口鈕＋NPC 視窗）——用戶指示
    //    「戰鬥時不要出現浮動清單，結束才顯示結果就好」。結果視窗(#pvp-result-modal)不在此列，它本來就只在結束後才建立。
    function _pvpHidePanels() {
        let m = document.getElementById('pvp-arena-modal'); if (m) m.remove();
        let b = document.getElementById('pvp-arena-entry'); if (b) b.remove();
        try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {}
    }

    // 🚪 進入競技場：競技場不列於地圖選單（入口＝古魯丁村莊的鬥技場管理者），比照 enterHiddenArea 臨時補 option 再 changeMap(true)
    function pvpArenaEnter() {
        if (typeof mapState === 'undefined' || !mapState) return false;
        if (mapState.current === PVP_ARENA_MAP) return true;
        let sel = document.getElementById('map-select');
        if (sel && !Array.prototype.some.call(sel.options, function (o) { return o.value === PVP_ARENA_MAP; })) {
            let o = document.createElement('option');
            o.value = PVP_ARENA_MAP; o.textContent = '決鬥競技場';
            sel.appendChild(o);
        }
        if (sel) sel.value = PVP_ARENA_MAP;
        try { changeMap(true); } catch (e) { return false; }
        return mapState.current === PVP_ARENA_MAP;
    }

    function pvpArenaStart(card) {
        if (!card) return false;
        if (player.dead) { alert('你已倒下，無法開始決鬥。'); return false; }
        if (_duel) { alert('目前已有一場決鬥進行中。'); return false; }
        if (typeof mapState === 'undefined' || !mapState) return false;
        if (mapState.current !== PVP_ARENA_MAP) {           // 🚪 不在競技場＝由 NPC 直接送進去（免玩家自己找地圖）
            try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {}
            if (!pvpArenaEnter()) { alert('無法進入決鬥競技場。'); return false; }
        }
        let mob = pvpCardToMob(card);
        if (!mob) { alert('無法解析這張名片的角色資料，請確認名片完整。'); return false; }
        mapState.mobs = [null, null, null, null, null];
        mob.uid = (typeof uid === 'function') ? uid() : ('pvp' + Date.now());
        mob._born = (typeof _mobBornSeq !== 'undefined') ? ++_mobBornSeq : 1;
        mob._bornMs = Date.now();
        mob._magCd = {};
        mob.justHit = false;
        mob.st = (typeof newMobStatus === 'function') ? newMobStatus() : {};
        if (mob.hard && typeof initHardSkin === 'function') { try { initHardSkin(mob); } catch (e) {} }
        mapState.mobs[0] = mob;
        _duel = { name: card.n, uid: mob.uid, power: mob._pvpPower || 0, startedAt: Date.now() };
        _pvpSyncTravelButtons();
        _pvpBenchAllies();   // ⚔️ 純 1v1：傭兵到場邊（不解散·決鬥結束自動歸隊）
        _pvpHidePanels();    // 🙈 v3.7.13 開打就收掉所有決鬥浮動視窗（用戶指示：戰鬥中不出現清單，結束才跳結果）
        try { renderMobs(); updateUI(); } catch (e) {}
        _pvpSyncTravelButtons();
        try { logSys('<span class="text-rose-300 font-bold">⚔️ 決鬥開始：</span>對手 <span class="text-amber-300 font-bold">' + _pvpEsc(card.n) + '</span>（Lv.' + card.lv + '・戰力 ' + (mob._pvpPower || 0).toLocaleString() + '）'); } catch (e) {}
        _pvpRenderPanel();
        return true;
    }

    function _pvpRecord(win, foeName) {
        if (!player || !player.cls) return;
        _pvpUnbenchAllies();   // ⚔️ 傭兵先歸隊——⚠️必須早於下方的 saveGame，否則存檔寫入的是空隊伍
        if (!player.pvpArena || typeof player.pvpArena !== 'object') player.pvpArena = { wins: 0, losses: 0, streak: 0, best: 0, history: [] };
        let a = player.pvpArena;
        a.wins = Math.max(0, Number(a.wins) || 0);
        a.losses = Math.max(0, Number(a.losses) || 0);
        a.streak = Number(a.streak) || 0;
        a.best = Math.max(0, Number(a.best) || 0);
        if (!Array.isArray(a.history)) a.history = [];
        if (win) { a.wins++; a.streak = Math.max(0, a.streak) + 1; if (a.streak > a.best) a.best = a.streak; }
        else { a.losses++; a.streak = 0; }
        a.history.unshift({ n: String(foeName || '').slice(0, 24), w: !!win, t: Date.now() });
        if (a.history.length > PVP_HISTORY_MAX) a.history.length = PVP_HISTORY_MAX;
        try {
            logSys(win
                ? '<span class="text-emerald-300 font-bold">🏆 決鬥勝利：</span>擊敗 ' + _pvpEsc(foeName) + '！（' + a.wins + ' 勝 ' + a.losses + ' 敗・連勝 ' + a.streak + '）'
                : '<span class="text-rose-400 font-bold">💀 決鬥落敗：</span>敗給 ' + _pvpEsc(foeName) + '。（' + a.wins + ' 勝 ' + a.losses + ' 敗）');
        } catch (e) {}
        _duel = null;
        _pvpSyncTravelButtons();
        try { saveGame(); } catch (e) {}
        _pvpRenderPanel();
        setTimeout(function () { _pvpShowResult(win, foeName); }, PVP_RESULT_DELAY_MS);   // 🏁 分出勝負 → 跳結果視窗讓玩家選「繼續」或「回村莊」
    }

    // 🏁 v3.7.10 決鬥結果視窗（用戶指示：戰鬥結束先跳訊息，附「繼續／回村莊」二選一）
    //   ⚠️ 不做背景點擊關閉——落敗時玩家是倒下狀態，必須經由這兩顆按鈕之一才會被回血/解除死亡，
    //      隨手關掉會把人卡在競技場裡動彈不得。
    function _pvpShowResult(win, foeName) {
        if (typeof mapState === 'undefined' || !mapState || mapState.current !== PVP_ARENA_MAP) return;   // 已離場（極端情況）→ 不彈
        let old = document.getElementById('pvp-result-modal');
        if (old) old.remove();
        let a = (player && player.pvpArena) || { wins: 0, losses: 0, streak: 0 };
        let title = win ? '玩家獲勝' : '挑戰者獲勝';
        let color = win ? 'text-emerald-300' : 'text-rose-300';
        let icon = win ? '🏆' : '💀';
        let overlay = document.createElement('div');
        overlay.id = 'pvp-result-modal';
        // 🎨 v3.7.12 遮罩／金框／按鈕交給 style.css 的統一浮動視窗皮膚（#pvp-result-modal 已列入）。
        //    ⚠️ 勝負標題刻意不用 <h3>：皮膚會把 h3 一律染成金色，勝綠／敗紅的語意就沒了。
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10095;display:flex;align-items:center;justify-content:center;padding:16px;';
        overlay.innerHTML =
            '<div class="text-center" style="width:min(420px,100%);padding:24px;">' +
                '<div class="mb-2" style="font-size:40px;line-height:1;">' + icon + '</div>' +
                '<div class="text-2xl font-bold mb-2 ' + color + '">' + title + '</div>' +
                '<div class="text-sm text-slate-200">對手：' + _pvpEsc(foeName || '') + '</div>' +
                '<div class="text-xs text-slate-400 mb-4">目前戰績 ' + (a.wins || 0) + ' 勝 ' + (a.losses || 0) + ' 敗・連勝 ' + (a.streak || 0) + '</div>' +
                '<div class="flex gap-3">' +
                    '<button type="button" class="btn flex-1 py-2 font-bold" onclick="pvpResultContinue()">繼續</button>' +
                    '<button type="button" class="btn flex-1 py-2 font-bold" onclick="pvpResultReturn()">回村莊</button>' +
                '</div>' +
                '<div class="text-xs text-slate-400 leading-relaxed mt-3">「繼續」留在競技場並補滿狀態，可直接開下一場；「回村莊」回到古魯丁。</div>' +
            '</div>';
        document.body.appendChild(overlay);
    }

    // 🩹 留在競技場：補滿 HP/MP、清異常、解除死亡、傭兵與寵物一併歸位（決鬥無損失＋下一場才公平）
    //   ⚠️ 順序＝先清狀態再 calcStats 再補血：evilAura/cleave 會烙進 player.d，不重算就補不到正確的 mhp。
    function _pvpRestoreInArena() {
        if (typeof player === 'undefined' || !player || !player.cls) return;
        player.dead = false;
        player.statuses = { stun: 0, freeze: 0, stone: 0, poison: 0, poisonDmg: 0, poisonTick: 0, burn: 0, burnDmg: 0, burnTick: 0, scald: 0, scaldDmg: 0, scaldTick: 0, bleed: 0, bleedDmg: 0, bleedTick: 0, sleep: 0, silence: 0, paralyze: 0, magicseal: 0, armorBreak: 0, slowAtk: 0, cleave: 0, evilAura: 0 };
        let b1 = document.getElementById('btn-revive'); if (b1) b1.classList.add('hidden');
        let b2 = document.getElementById('btn-revive-inplace'); if (b2) b2.classList.add('hidden');
        try { if (typeof calcStats === 'function') calcStats(); } catch (e) {}
        player.hp = player.mhp;
        player.mp = player.mmp;
        try { if (typeof reviveDownedMercsAtTown === 'function') reviveDownedMercsAtTown(); } catch (e) {}
        try { if (typeof petsReviveAtTown === 'function') petsReviveAtTown(); } catch (e) {}
        try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
    }

    function pvpResultContinue() {
        let m = document.getElementById('pvp-result-modal'); if (m) m.remove();
        _pvpRestoreInArena();
        try { logSys('<span class="text-slate-300">⚔️ 你留在競技場整備，準備下一場決鬥。</span>'); } catch (e) {}
        try { saveGame(); } catch (e) {}
        openPvpArena();   // 🙈 v3.7.13 面板在開打時被收掉了 → 「繼續」＝要挑下一個對手，這裡把它重新開起來（單靠 _pvpRenderPanel 會因為沒有掛載點而無聲落空）
        _pvpSyncEntryButton();
    }

    function pvpResultReturn() {
        let m = document.getElementById('pvp-result-modal'); if (m) m.remove();
        _pvpReturnHome();
    }

    // 🏘️ 決鬥結束 → 送回古魯丁村莊。只由結果視窗的「回村莊」按鈕呼叫（pvpResultReturn），
    //    「離開競技場／對手離場」那種中止(pvpArenaAbort)不傳送——玩家本來就已經自己走了。
    //    落敗時就地解除死亡（比照時空裂痕：結束挑戰不必再手動「祈求復活」），
    //    補血／清異常／傭兵與寵物復活全部由 changeMap 的城鎮分支統一處理，這裡不重複做。
    function _pvpReturnHome() {
        try {
            if (typeof player === 'undefined' || !player || !player.cls) return;
            if (_duel) return;                                                        // 已經開始下一場 → 不打斷
            if (typeof mapState === 'undefined' || !mapState) return;
            if (mapState.current !== PVP_ARENA_MAP) return;                           // 玩家已自行離場（手動復活/瞬移）→ 不硬拉
            if (player.dead) {
                player.dead = false;
                let b1 = document.getElementById('btn-revive'); if (b1) b1.classList.add('hidden');
                let b2 = document.getElementById('btn-revive-inplace'); if (b2) b2.classList.add('hidden');
            }
            if (typeof setMapSelectors === 'function') setMapSelectors(PVP_HOME_MAP);
            if (typeof changeMap === 'function') changeMap(true);
            try { logSys('<span class="text-slate-300">⚔️ 決鬥結束，巴魯特把你送回了古魯丁村莊。</span>'); } catch (e) {}
            try { saveGame(); } catch (e) {}
        } catch (e) {}
    }

    // 玩家離開競技場／死亡 → 中止決鬥（不計勝負，除非是被對手打死）
    function pvpArenaAbort(reason) {
        _pvpUnbenchAllies();   // ⚔️ 中止也要讓傭兵歸隊（放在早退之前：_duel 已清空但傭兵還在場邊的殘留情況也要救）
        if (!_duel) return;
        _duel = null;
        _pvpSyncTravelButtons();
        if (reason) { try { logSys('<span class="text-slate-400">⚔️ 決鬥中止：' + _pvpEsc(reason) + '</span>'); } catch (e) {} }
        _pvpRenderPanel();
    }

    function pvpArenaSurrender() {
        if (!pvpArenaTravelLocked()) return false;
        let foeName = _duel.name;
        // 先移除對手，避免投降到結果視窗出現前仍繼續攻擊玩家／寵物／召喚物。
        mapState.mobs = [null, null, null, null, null];
        try { logSys('<span class="text-rose-300 font-bold">⚔️ 你向 ' + _pvpEsc(foeName) + ' 投降了。</span>'); } catch (e) {}
        _pvpRecord(false, foeName);
        try { renderMobs(); updateUI(); } catch (e) {}
        return true;
    }

    // ---------- 掛勾：擊殺對手＝勝（決鬥專用結算，不進 js/05 的一般擊殺獎勵流程）----------
    const _pvpOrigKillMob = window.killMob;
    if (typeof _pvpOrigKillMob === 'function') {
        window.killMob = function (idx) {
            let mob = (typeof mapState !== 'undefined' && mapState && mapState.mobs) ? mapState.mobs[idx] : null;
            let isFoe = !!(mob && mob._pvpDuelFoe && _duel && mob.uid === _duel.uid && !mob._dead);
            if (!isFoe) return _pvpOrigKillMob.apply(this, arguments);

            // 一般 killMob 會處理性向、金幣、掉落、擊殺回魔與裝備擊殺特效；決鬥明確只記勝負，
            // 因此在模組邊界直接完成死亡動畫／清場，再記錄勝利，不呼叫一般擊殺結算。
            let foeName = mob.n || _duel.name;
            mob._dead = true;
            try { vfxKill(mob); } catch (e) {}
            try { playMobKill(mob); } catch (e) {}
            if (mob.curHp > 0) mob.curHp = 0;
            try { logCombat('擊敗了 <span class="' + getMobColor(mob.lv) + '">' + _pvpEsc(foeName) + '</span>！', 'player-heavy'); } catch (e) {}
            try { renderMobs(); updateUI(); } catch (e) {}
            if (typeof state !== 'undefined' && state && !state.inTick && typeof settleDeadMobs === 'function') {
                try { settleDeadMobs(); } catch (e) {}
            }
            _pvpRecord(true, foeName);
        };
    }

    // 決鬥中禁用所有瞬移入口。包裝放在最後載入的 js/28，避免改動通用技能／道具邏輯。
    const _pvpOrigManualCast = window.manualCast;
    if (typeof _pvpOrigManualCast === 'function') {
        window.manualCast = function (skId) {
            let sk = (typeof DB !== 'undefined' && DB.skills) ? DB.skills[skId] : null;
            if (pvpArenaTravelLocked() && sk && sk.mEff === 'teleport') {
                try { logSys('<span class="text-red-400">決鬥進行中無法使用傳送術；可按「投降」結束本場。</span>'); } catch (e) {}
                return false;
            }
            return _pvpOrigManualCast.apply(this, arguments);
        };
    }
    const _pvpOrigUseItem = window.useItem;
    if (typeof _pvpOrigUseItem === 'function') {
        window.useItem = function (itemUid) {
            let it = (typeof player !== 'undefined' && player && Array.isArray(player.inv)) ? player.inv.find(function (x) { return x && x.uid === itemUid; }) : null;
            let dd = it && typeof DB !== 'undefined' && DB.items ? DB.items[it.id] : null;
            if (pvpArenaTravelLocked() && dd && dd.eff === 'teleport_scroll') {
                try { logSys('<span class="text-red-400">決鬥進行中無法使用瞬間移動卷軸；可按「投降」結束本場。</span>'); } catch (e) {}
                return false;
            }
            return _pvpOrigUseItem.apply(this, arguments);
        };
    }
    const _pvpOrigDoTeleport = window.doTeleport;
    if (typeof _pvpOrigDoTeleport === 'function') {
        window.doTeleport = function () {
            if (pvpArenaTravelLocked()) return false;
            return _pvpOrigDoTeleport.apply(this, arguments);
        };
    }
    const _pvpOrigReturnToTown = window.returnToTown;
    if (typeof _pvpOrigReturnToTown === 'function') {
        window.returnToTown = function () {
            if (pvpArenaTravelLocked()) return pvpArenaSurrender();
            return _pvpOrigReturnToTown.apply(this, arguments);
        };
    }
    const _pvpOrigReturnToPledgeBase = window.returnToPledgeBase;
    if (typeof _pvpOrigReturnToPledgeBase === 'function') {
        window.returnToPledgeBase = function () {
            if (pvpArenaTravelLocked()) return pvpArenaSurrender();
            return _pvpOrigReturnToPledgeBase.apply(this, arguments);
        };
    }
    const _pvpOrigUpdateUI = window.updateUI;
    if (typeof _pvpOrigUpdateUI === 'function') {
        window.updateUI = function () {
            let result = _pvpOrigUpdateUI.apply(this, arguments);
            _pvpSyncTravelButtons();
            return result;
        };
    }

    // ---------- 掛勾：玩家死亡＝敗（輪詢·避免侵入 js/04 死亡流程）----------
    setInterval(function () {
        if (!_duel) return;
        if (typeof player === 'undefined' || !player || !player.cls) { _duel = null; return; }
        if (player.dead) { _pvpRecord(false, _duel.name); return; }
        if (typeof mapState !== 'undefined' && mapState && mapState.current !== PVP_ARENA_MAP) { pvpArenaAbort('已離開競技場'); return; }
        // 對手被其他途徑清場（換圖/瞬移）→ 視為中止
        let alive = (mapState.mobs || []).some(function (m) { return m && m.uid === _duel.uid && !m._dead; });
        if (!alive) pvpArenaAbort('對手已離場');
    }, 1000);

    // ---------- 面板 UI（純 JS 生成·不動 HTML）----------
    function _pvpEsc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function openPvpArena() {
        if (typeof player === 'undefined' || !player || !player.cls) return;
        let old = document.getElementById('pvp-arena-modal');
        if (old) old.remove();
        let overlay = document.createElement('div');
        overlay.id = 'pvp-arena-modal';
        // 🎨 v3.7.12 只留版面（定位／尺寸）；遮罩、金框、標題、按鈕全部交給 css/style.css 的
        //    「Unified floating-window palette」——#pvp-arena-modal 已加進那幾組 :is() 選擇器。
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10090;display:flex;align-items:center;justify-content:center;padding:16px;';
        overlay.innerHTML =
            '<div style="width:min(620px,100%);max-height:92vh;overflow:auto;padding:18px;">' +
                '<div class="flex items-center justify-between mb-3" style="border-bottom:1px solid #594638;padding-bottom:10px;">' +
                    '<h3 class="font-bold" style="font-size:20px;">⚔️ 決鬥競技場</h3>' +
                    '<button type="button" class="btn py-1 px-4" onclick="document.getElementById(\'pvp-arena-modal\').remove()">關閉</button>' +
                '</div>' +
                '<div id="pvp-arena-body-modal"></div>' +
            '</div>';
        document.body.appendChild(overlay);
        _pvpRenderPanel();
    }

    // ⚠️ 面板有兩個掛載點：NPC 視窗內的 #pvp-arena-body 與獨立 modal 的 #pvp-arena-body-modal。
    //    兩者曾用同一個 id——closeNpcInteraction 只是隱藏容器、DOM 還在，於是 getElementById 永遠
    //    抓到 NPC 那個，modal 版渲染出來是空的（實測踩到）。改成不同 id ＋ modal 優先（它疊在最上層）。
    function _pvpPanelBody() {
        return document.getElementById('pvp-arena-body-modal') || document.getElementById('pvp-arena-body');
    }
    // ⚠️ 面板內的欄位（名片框／存檔位下拉／貼上框）在兩個掛載點會同 id 並存 → 一律在「目前作用中的
    //    那個 body」裡面找，不要用 document.getElementById（會抓到隱藏的 NPC 版，實測名片框變空白）。
    function _pvpField(id) {
        let b = _pvpPanelBody();
        return b ? b.querySelector('#' + id) : null;
    }

    function _pvpRenderPanel() {
        let body = _pvpPanelBody();
        if (!body) return;
        let a = (player && player.pvpArena) || { wins: 0, losses: 0, streak: 0, best: 0, history: [] };
        let inArena = (typeof mapState !== 'undefined' && mapState && mapState.current === PVP_ARENA_MAP);
        let slots = [];
        for (let n = 1; n <= 8; n++) {
            if (String(n) === String(currentSlot)) continue;
            let sum = (typeof slotSummary === 'function') ? slotSummary(n) : null;
            if (sum) slots.push({ n: n, label: '存檔' + n + '　' + (sum.name || '未命名') + '（' + sum.cls + ' Lv.' + sum.lv + '）' });
        }
        // 🎨 v3.7.12 版面用 inline（grid/尺寸），配色與外框一律走既有 class：
        //    `bg-slate-800/60 border border-slate-600 rounded p-3` 是全遊戲 NPC 面板的統一卡片語彙
        //    （樣板＝js/11 renderIsmaelExchange），按鈕統一 `.btn`，讓 style.css 的皮膚接管。
        //    ⚠️ Tailwind 是預編譯的：grid-cols-4／max-h-40／overflow-auto 沒被編進 tailwind-built.css，
        //       這類版面屬性一律寫 inline style，不要賭 class 存在。
        let CARD = 'bg-slate-800/60 border border-slate-600 rounded p-3 mb-3';
        let HEAD = 'text-amber-300 font-bold mb-2';
        let NOTE = 'text-xs text-slate-400 leading-relaxed';
        let FIELD = 'w-full text-xs';
        let FIELD_S = 'resize:vertical;height:70px;padding:8px;word-break:break-all;border-radius:4px;';
        let html = '';
        // 戰績
        html += '<div class="' + CARD + ' text-center" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">' +
            '<div><div class="text-xs text-slate-400">勝</div><b class="text-emerald-300 text-lg">' + (a.wins || 0) + '</b></div>' +
            '<div><div class="text-xs text-slate-400">敗</div><b class="text-rose-300 text-lg">' + (a.losses || 0) + '</b></div>' +
            '<div><div class="text-xs text-slate-400">連勝</div><b class="text-amber-300 text-lg">' + (a.streak || 0) + '</b></div>' +
            '<div><div class="text-xs text-slate-400">最高連勝</div><b class="text-violet-300 text-lg">' + (a.best || 0) + '</b></div>' +
            '</div>';
        // 進行中
        if (_duel) {
            html += '<div class="' + CARD + '">' +
                '<b class="text-rose-300">決鬥進行中：</b><span class="text-sm text-slate-200">' + _pvpEsc(_duel.name) + '（戰力 ' + (_duel.power || 0).toLocaleString() + '）</span>' +
                '<div class="' + NOTE + ' mt-2">關閉本視窗即可觀戰。擊敗對手＝勝；自己倒下＝敗。</div>' +
                '</div>';
        }
        // 我的名片
        html += '<div class="' + CARD + '">' +
            '<div class="' + HEAD + '">① 我的對戰名片</div>' +
            '<div class="' + NOTE + ' mb-2">把下面這串字給對手，他就能挑戰你。名片只含戰鬥資料（職業／等級／六維／裝備／技能／精通），不含背包、倉庫與金幣。</div>' +
            '<textarea id="pvp-my-card" readonly class="' + FIELD + ' text-sky-300" style="' + FIELD_S + '"></textarea>' +
            '<div class="flex gap-2 mt-2">' +
                '<button type="button" class="btn flex-1 py-2 font-bold" onclick="pvpCopyMyCard()">複製名片</button>' +
                '<button type="button" class="btn flex-1 py-2" onclick="pvpDownloadMyCard()">存成檔案</button>' +
            '</div></div>';
        // 選對手
        html += '<div class="' + CARD + '">' +
            '<div class="' + HEAD + '">② 選擇對手</div>';
        if (slots.length) {
            html += '<div class="' + NOTE + ' mb-2">本機其他存檔位（免交換名片）：</div>' +
                '<div class="flex gap-2 mb-3">' +
                '<select id="pvp-slot-sel" class="flex-1 text-sm" style="padding:6px;border-radius:4px;">' +
                slots.map(function (s) { return '<option value="' + s.n + '">' + _pvpEsc(s.label) + '</option>'; }).join('') +
                '</select>' +
                '<button type="button" class="btn py-2 px-4 font-bold shrink-0" onclick="pvpChallengeSlot()">挑戰</button>' +
                '</div>';
        }
        html += '<div class="' + NOTE + ' mb-2">貼上對手名片：</div>' +
            '<textarea id="pvp-foe-card" placeholder="貼上 FB5PVP1: 開頭的名片字串" class="' + FIELD + ' text-slate-200" style="' + FIELD_S + '"></textarea>' +
            '<button type="button" class="btn w-full py-2 mt-2 font-bold" onclick="pvpChallengePasted()">解析名片並挑戰</button>' +
            '</div>';
        if (!inArena) {
            html += '<div class="' + CARD + ' text-sm text-sky-300">🚪 按下挑戰後，管理者會直接把你送進決鬥競技場。</div>';
        }
        // 戰績歷史
        if (a.history && a.history.length) {
            html += '<div class="' + CARD + '">' +
                '<div class="' + HEAD + '">近期戰績</div>' +
                '<div class="text-sm" style="max-height:150px;overflow:auto;line-height:1.9;">' +
                a.history.map(function (h) {
                    return '<div><span class="' + (h.w ? 'text-emerald-300' : 'text-rose-300') + ' font-bold">' + (h.w ? '勝' : '敗') + '</span>　<span class="text-slate-300">' + _pvpEsc(h.n) + '</span></div>';
                }).join('') + '</div></div>';
        }
        html += '<div class="' + NOTE + ' mt-3">決鬥不給經驗與金幣，只記錄勝負戰績；落敗完全無損失（不扣經驗、不掉裝備、不影響性向值）。任一方倒下即分出勝負，接著可選擇留在競技場再戰或回古魯丁村莊。對手會還原名片匯出時的核心攻防、血量、攻速與施法速度；職業攻擊與技能仍依決鬥曲線平衡。</div>';
        body.innerHTML = html;
        let ta = body.querySelector('#pvp-my-card');   // ⚠️ 在剛渲染的 body 內找，不用 getElementById（見 _pvpField 註解）
        if (ta) ta.value = pvpCardEncode(pvpCardBuild());
    }

    // 🏘️ 古魯丁村莊「鬥技場管理者」NPC 視窗：沿用同一套面板 UI（不另開 modal·由 js/11 interactNPC 分派）
    function renderPvpArenaNPC(contentDiv) {
        if (!contentDiv) return;
        // 🎨 v3.7.12 開場白比照其他 NPC 面板的語彙（樣板＝js/11 renderIsmaelExchange）
        contentDiv.innerHTML =
            '<div class="text-slate-300 text-sm leading-relaxed mb-3">' +
                '巴魯特：想知道自己的本事到哪？把你的<b class="text-amber-300">對戰名片</b>交給對手，或是拿他的名片來——我安排場地，剩下的靠你自己。' +
                '<div class="text-xs text-slate-400 mt-2">決鬥不給經驗與金幣，只留下勝負；落敗完全無損失。</div>' +
            '</div>' +
            '<div id="pvp-arena-body"></div>';
        _pvpRenderPanel();
    }

    // ---------- 對外操作 ----------
    function pvpCopyMyCard() {
        let ta = _pvpField('pvp-my-card');
        if (!ta) return;
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        if (!ok && navigator.clipboard) { try { navigator.clipboard.writeText(ta.value); ok = true; } catch (e) {} }
        alert(ok ? '名片已複製，貼給對手即可。' : '複製失敗，請手動全選複製。');
    }
    function pvpDownloadMyCard() {
        let card = pvpCardBuild();
        if (!card) return;
        let blob = new Blob([pvpCardEncode(card)], { type: 'text/plain' });
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = url; a.download = '對戰名片_' + (card.n || '角色') + '_Lv' + card.lv + '.txt';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
    function pvpChallengeSlot() {
        let sel = _pvpField('pvp-slot-sel');
        if (!sel) return;
        let card = pvpCardFromSlot(sel.value);
        if (!card) { alert('讀取該存檔位失敗。'); return; }
        pvpArenaStart(card);   // 🙈 v3.7.13 面板由 pvpArenaStart 內的 _pvpHidePanels 統一收（原本在這裡各收一次·會漏掉其他呼叫路徑）
    }
    function pvpChallengePasted() {
        let ta = _pvpField('pvp-foe-card');
        if (!ta) return;
        let res = pvpCardDecode(ta.value);
        if (!res) { alert('名片格式無法辨識。請確認完整複製了 FB5PVP1: 開頭的字串。'); return; }
        if (!res.ok && !confirm('這張名片的簽章不符（可能被編輯過）。仍要挑戰嗎？')) return;
        pvpArenaStart(res.card);   // 🙈 v3.7.13 同上：面板收合統一由 pvpArenaStart 負責
    }

    // ---------- 進入競技場自動開面板＋常駐入口按鈕 ----------
    const _pvpOrigChangeMap = window.changeMap;
    if (typeof _pvpOrigChangeMap === 'function') {
        window.changeMap = function () {
            let before = (typeof mapState !== 'undefined' && mapState) ? String(mapState.current || '') : '';
            let result = _pvpOrigChangeMap.apply(this, arguments);
            let after = (typeof mapState !== 'undefined' && mapState) ? String(mapState.current || '') : '';
            if (after !== before) {
                if (before === PVP_ARENA_MAP && _duel) pvpArenaAbort('已離開競技場');
                if (after === PVP_ARENA_MAP && !_duel) { try { openPvpArena(); } catch (e) {} }   // 🙈 v3.7.13 決鬥中進場（挑戰時由 NPC 直接傳送）不自動彈面板
            }
            _pvpSyncEntryButton();
            return result;
        };
    }
    // 在競技場地圖時於畫面右上角掛一顆常駐入口鈕（關掉面板後還能再開）
    function _pvpSyncEntryButton() {
        _pvpSyncTravelButtons();
        let inArena = (typeof mapState !== 'undefined' && mapState && mapState.current === PVP_ARENA_MAP);
        let btn = document.getElementById('pvp-arena-entry');
        if (!inArena || _duel || document.getElementById('pvp-result-modal')) { if (btn) btn.remove(); return; }   // 🙈 v3.7.13 決鬥進行中連入口鈕都收起來（戰鬥畫面淨空）；結果視窗開著時也不掛，讓「勝負＋兩顆按鈕」是畫面上唯一的東西
        if (btn) return;
        btn = document.createElement('button');
        btn.id = 'pvp-arena-entry';
        btn.type = 'button';
        btn.textContent = '⚔️ 決鬥面板';
        btn.style.cssText = 'position:fixed;top:12px;right:12px;z-index:10050;border:1px solid #b91c1c;border-radius:8px;background:#7f1d1d;color:#fee2e2;font-weight:700;padding:8px 14px;cursor:pointer;box-shadow:0 4px 16px #000a;';
        btn.onclick = function () { openPvpArena(); };
        document.body.appendChild(btn);
    }
    setInterval(_pvpSyncEntryButton, 2000);

    // ---------- 匯出到全域 ----------
    window.pvpCardBuild = pvpCardBuild;
    window.pvpCardEncode = pvpCardEncode;
    window.pvpCardDecode = pvpCardDecode;
    window.pvpCardSanitize = pvpCardSanitize;
    window.pvpCardFromSlot = pvpCardFromSlot;
    window.pvpCardDerive = pvpCardDerive;
    window.pvpCardPower = pvpCardPower;
    window.pvpCardToMob = pvpCardToMob;
    window.pvpDuelBestSpellKey = pvpDuelBestSpellKey;   // 🔮 js/03 施法迴圈的「法師對手優先高傷法術」閘
    window.pvpArenaPotionBlocked = pvpArenaPotionBlocked;   // 🚫 決鬥禁治癒藥水（js/07 autoActions・js/08 useItem・js/06 傭兵・js/22 寵物 四處共用）
    window.pvpArenaStart = pvpArenaStart;
    window.pvpArenaEnter = pvpArenaEnter;
    window.renderPvpArenaNPC = renderPvpArenaNPC;
    window.pvpArenaActive = pvpArenaActive;
    window.pvpArenaTravelLocked = pvpArenaTravelLocked;
    window.pvpArenaDeathExempt = pvpArenaDeathExempt;   // ⚔️ js/04 killPlayer 的「決鬥落敗無損失」閘
    window.pvpArenaSurrender = pvpArenaSurrender;
    window.pvpResultContinue = pvpResultContinue;       // 🏁 結果視窗兩顆按鈕（inline onclick）
    window.pvpResultReturn = pvpResultReturn;
    window.pvpArenaAbort = pvpArenaAbort;
    window.openPvpArena = openPvpArena;
    window.pvpCopyMyCard = pvpCopyMyCard;
    window.pvpDownloadMyCard = pvpDownloadMyCard;
    window.pvpChallengeSlot = pvpChallengeSlot;
    window.pvpChallengePasted = pvpChallengePasted;
})();
