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

let _clanLastSettleByRole = Object.create(null);

function _clanDefaultState() {
    return { v:1, xp:0, modes:{ normal:null, classic:null }, members:{}, updatedAt:Date.now() };
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
        st.v = 1;
        st.updatedAt = Date.now();
        let raw = JSON.stringify(_clanNormalizeState(st));
        if (typeof _saveWrap === 'function') raw = _saveWrap(raw);
        if (typeof _lzSet === 'function') return !!_lzSet(CLAN_STATE_KEY, raw);
        localStorage.setItem(CLAN_STATE_KEY, raw);
        return true;
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

setInterval(_clanBuffTimerTick, 60000);

if (typeof window !== 'undefined') {
    window.clanExportSharedState = clanExportSharedState;
    window.clanRestoreSharedState = clanRestoreSharedState;
}
