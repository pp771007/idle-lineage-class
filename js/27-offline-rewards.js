// ===== 真正離線收益（獨立於戰鬥 tick，不補幀、不模擬戰鬥）=====
// 公式：同地圖最近實戰每分鐘產出 × 可結算分鐘 × 70%。
// 最短離線 1 分鐘、最多結算 12 小時；依實戰怪物組成抽取一般掉落、卡片與已證明可擊敗的隨機頭目。
// PVP、任務專用品與活動事件不做離線抽取，避免事件重複觸發。
// 混合制：「真正關閉網頁後重開」走 70% 離線收益；切分頁、縮小與 bfcache 還原由 gameLoop 逐 tick 真實補跑。
// 若玩家在背景中直接關頁，關頁前的背景時間另存並於下次載入批次結算，離線收益只從真正關頁時刻開始。
(function () {
    'use strict';

    const OFFLINE_VERSION = 4;
    const OFFLINE_MIN_MS = 1 * 60 * 1000;
    const OFFLINE_MAX_MS = 12 * 60 * 60 * 1000;
    const OFFLINE_EFFICIENCY = 0.70;
    const OFFLINE_SAMPLE_MIN_MS = 15 * 1000;
    const OFFLINE_SAMPLE_MIN_KILLS = 3;
    const OFFLINE_MAX_SAVED_PROFILES = 5;
    const OFFLINE_RECENT_KILL_MS = 5 * 60 * 1000;
    const OFFLINE_HEARTBEAT_MS = 30 * 1000;
    const OFFLINE_MAX_KILLS_PER_MIN = 3000;
    const OFFLINE_MAX_EXP_PER_MIN = 1e12;
    const OFFLINE_MAX_GOLD_PER_MIN = 1e10;
    const OFFLINE_MAX_MOB_PROFILES = 80;
    const OFFLINE_MAX_BOSS_PROFILES = 40;
    const OFFLINE_STORE_PREFIX = 'lineage_idle_offline_v1_';

    let _offlineRuntime = null;
    let _offlineLoading = false;
    let _offlineSettling = false;
    let _offlineInternalSave = false;
    let _offlineRestoredCatchupKey = '';
    let _offlineLastBatchSavedOk = false;
    // ⚠️ 背景分頁期間任何存檔（js/01 每 5 分鐘自動存檔在背景仍會觸發）都不得把 awaySince／
    //    checkpoint.lastActive 往後推，否則離線時長永遠湊不滿 1 分鐘下限、資格也會因
    //    「最後擊殺超過 5 分鐘」被翻成 false → 回前景永遠結不了帳。
    //    快照時間一律夾回「進入背景那一刻」（visibilitychange 設定／清除）。
    let _offlineHiddenAt = (typeof document !== 'undefined' && document.hidden) ? Date.now() : 0;

    function _offlineNow() {
        return Date.now();
    }

    function _offlineFinite(v, fallback) {
        v = Number(v);
        return Number.isFinite(v) ? v : fallback;
    }

    function _offlineClamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, _offlineFinite(v, lo)));
    }

    function _offlineEsc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[c]);
    }

    function _offlineStorageGet(key) {
        try {
            if (typeof _lsGet === 'function') return _lsGet(key);
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function _offlineStorageSet(key, value) {
        try {
            if (typeof _lsSet === 'function') return _lsSet(key, value) !== false;
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            return false;
        }
    }

    function _offlineStorageRemove(key) {
        try {
            if (typeof _lsRemove === 'function') {
                _lsRemove(key);
                return true;
            }
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            return false;
        }
    }

    function _offlineIdentity() {
        if (typeof player === 'undefined' || !player || !player.cls) return '';
        let raw = player.enSeed || ((typeof currentSlot !== 'undefined' ? currentSlot : 0) + '|' + (player.name || '') + '|' + player.cls);
        return encodeURIComponent(String(raw));
    }

    function _offlineStoreKey(kind) {
        let id = _offlineIdentity();
        return id ? OFFLINE_STORE_PREFIX + kind + '_' + id : '';
    }

    function _offlineReadJson(key) {
        if (!key) return null;
        let raw = _offlineStorageGet(key);
        if (!raw) return null;
        try {
            let obj = JSON.parse(raw);
            return obj && typeof obj === 'object' ? obj : null;
        } catch (e) {
            return null;
        }
    }

    function _offlineWriteJson(key, obj) {
        if (!key) return false;
        try {
            return _offlineStorageSet(key, JSON.stringify(obj));
        } catch (e) {
            return false;
        }
    }

    function _offlineMapName(map) {
        try {
            if (typeof mapEntryOf === 'function') {
                let entry = mapEntryOf(map);
                if (entry && entry.t) return entry.t;
            }
            if (typeof MAP_REGIONS !== 'undefined') {
                for (let r of MAP_REGIONS) {
                    let found = (r.maps || []).find(m => m && m.v === map);
                    if (found) return found.t || map;
                }
            }
        } catch (e) {}
        return map || '狩獵區';
    }

    function _offlineMobProfile(raw) {
        if (!raw || typeof raw !== 'object' || !raw.n) return null;
        let count = Math.max(0, Math.floor(_offlineFinite(raw.count, 0)));
        if (!count) return null;
        return {
            n: String(raw.n).slice(0, 100),
            count: Math.min(1e9, count),
            lv: Math.max(1, Math.floor(_offlineFinite(raw.lv, 1))),
            race: String(raw.race || ''),
            transformTo: raw.transformTo ? String(raw.transformTo) : '',
            sherine: raw.sherine === true,
            sherineMad: raw.sherineMad === true,
            grace: raw.grace === true
        };
    }

    function _offlineMobProfiles(raw) {
        if (!Array.isArray(raw)) return [];
        let result = [];
        for (let i = 0; i < raw.length && result.length < OFFLINE_MAX_MOB_PROFILES; i++) {
            let mob = _offlineMobProfile(raw[i]);
            if (mob) result.push(mob);
        }
        return result;
    }

    function _offlineMobKey(mob) {
        return [mob.n, mob.lv, mob.race, mob.transformTo, mob.sherine ? 1 : 0,
            mob.sherineMad ? 1 : 0, mob.grace ? 1 : 0].join('|');
    }

    function _offlineBossProfile(raw) {
        if (!raw || typeof raw !== 'object' || !raw.n) return null;
        let wins = Math.max(0, Math.floor(_offlineFinite(raw.wins, 0)));
        if (!wins) return null;
        return {
            n: String(raw.n).slice(0, 100),
            wins: Math.min(1e9, wins),
            lv: Math.max(1, Math.floor(_offlineFinite(raw.lv, 1))),
            race: String(raw.race || ''),
            transformTo: raw.transformTo ? String(raw.transformTo) : '',
            sherine: raw.sherine === true,
            sherineMad: raw.sherineMad === true,
            grace: raw.grace === true,
            avgKillMs: _offlineClamp(raw.avgKillMs, TICK_MS, OFFLINE_MAX_MS),
            expPerKill: _offlineClamp(raw.expPerKill, 0, OFFLINE_MAX_EXP_PER_MIN),
            goldPerKill: _offlineClamp(raw.goldPerKill, 0, OFFLINE_MAX_GOLD_PER_MIN),
            petExpPerKill: _offlineClamp(raw.petExpPerKill, 0, OFFLINE_MAX_EXP_PER_MIN),
            allyExpPerKill: _offlineClamp(raw.allyExpPerKill, 0, OFFLINE_MAX_EXP_PER_MIN),
            updatedAt: Math.max(0, Math.floor(_offlineFinite(raw.updatedAt, 0)))
        };
    }

    function _offlineBossProfiles(raw) {
        if (!Array.isArray(raw)) return [];
        let result = [];
        for (let i = 0; i < raw.length && result.length < OFFLINE_MAX_BOSS_PROFILES; i++) {
            let boss = _offlineBossProfile(raw[i]);
            if (boss) result.push(boss);
        }
        return result;
    }

    function _offlineProfile(raw) {
        if (!raw || typeof raw !== 'object' || !raw.map) return null;
        return {
            map: String(raw.map),
            mapName: String(raw.mapName || _offlineMapName(raw.map)),
            expPerMin: _offlineClamp(raw.expPerMin, 0, OFFLINE_MAX_EXP_PER_MIN),
            goldPerMin: _offlineClamp(raw.goldPerMin, 0, OFFLINE_MAX_GOLD_PER_MIN),
            killsPerMin: _offlineClamp(raw.killsPerMin, 0, OFFLINE_MAX_KILLS_PER_MIN),
            petExpPerMin: _offlineClamp(raw.petExpPerMin, 0, OFFLINE_MAX_EXP_PER_MIN),
            allyExpPerMin: _offlineClamp(raw.allyExpPerMin, 0, OFFLINE_MAX_EXP_PER_MIN),
            sampleMs: Math.max(0, Math.floor(_offlineFinite(raw.sampleMs, 0))),
            mobs: _offlineMobProfiles(raw.mobs),
            bosses: _offlineBossProfiles(raw.bosses),
            sampleKills: Math.max(0, Math.floor(_offlineFinite(raw.sampleKills, 0))),
            updatedAt: Math.max(0, Math.floor(_offlineFinite(raw.updatedAt, 0)))
        };
    }

    function _offlineSavedProfiles(raw, legacyProfile) {
        let rows = Array.isArray(raw) ? raw.slice() : [];
        if (legacyProfile) rows.push(legacyProfile);
        let byMap = Object.create(null);
        rows.forEach(row => {
            let profile = _offlineProfile(row);
            if (!profile) return;
            let old = byMap[profile.map];
            if (!old || profile.updatedAt >= old.updatedAt) byMap[profile.map] = profile;
        });
        return Object.keys(byMap)
            .map(map => byMap[map])
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, OFFLINE_MAX_SAVED_PROFILES);
    }

    function _offlineProfileForMap(st, map) {
        map = String(map || '');
        if (!st || !map) return null;
        let current = _offlineProfile(st.profile);
        if (current && current.map === map) return current;
        let profiles = Array.isArray(st.profiles) ? st.profiles : [];
        for (let i = 0; i < profiles.length; i++) {
            let profile = _offlineProfile(profiles[i]);
            if (profile && profile.map === map) return profile;
        }
        return null;
    }

    function _offlineRememberProfile(st, raw) {
        let profile = _offlineProfile(raw);
        if (!st || !profile) return null;
        st.profiles = _offlineSavedProfiles([profile].concat(st.profiles || []), null);
        st.profile = profile;
        return profile;
    }

    function _offlineEnsureState() {
        if (typeof player === 'undefined' || !player || !player.cls) return null;
        let raw = player.offlineHunt;
        if (!raw || typeof raw !== 'object') raw = {};
        let profile = _offlineProfile(raw.profile);
        let profiles = _offlineSavedProfiles(raw.profiles, profile);
        if (profile) profile = profiles.find(row => row.map === profile.map) || profile;
        player.offlineHunt = {
            v: OFFLINE_VERSION,
            eligible: raw.eligible === true,
            awaySince: Math.max(0, Math.floor(_offlineFinite(raw.awaySince, 0))),
            map: raw.map ? String(raw.map) : '',
            mapName: raw.mapName ? String(raw.mapName) : '',
            profile: profile,
            profiles: profiles
        };
        return player.offlineHunt;
    }

    function _offlineResetRuntime(map) {
        _offlineRuntime = {
            map: String(map || ''),
            firstKillAt: 0,
            lastKillAt: 0,
            kills: 0,
            exp: 0,
            gold: 0,
            petExp: 0,
            allyExp: 0,
            mobKills: Object.create(null)
        };
    }

    function _offlineValidHuntMap(map) {
        if (!map || String(map).indexOf('town_') === 0) return false;
        if (typeof DB === 'undefined' || !DB.maps || !Array.isArray(DB.maps[map])) return false;
        if (typeof isSiegeArea === 'function' && isSiegeArea(map)) return false;
        if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS && KING_ROOMS[map]) return false;
        if (typeof PURE_BOSS_MAPS !== 'undefined' && Array.isArray(PURE_BOSS_MAPS) && PURE_BOSS_MAPS.includes(map)) return false;
        if (/^pride_f\d+$/.test(map) || map === 'rift_battle') return false;
        return true;
    }

    function _offlineCanSnapshot(now, profile) {
        if (typeof state === 'undefined' || !state || !state.running) return false;
        if (typeof player === 'undefined' || !player || !player.cls || player.dead) return false;
        if (typeof mapState === 'undefined' || !mapState || !_offlineValidHuntMap(mapState.current)) return false;
        if (player.siege && player.siege.active) return false;
        if (state.prideClimb || state.riftRun) return false;
        if (!profile || profile.map !== String(mapState.current) || profile.killsPerMin <= 0) return false;
        if (_offlineRuntime && _offlineRuntime.map === String(mapState.current) && _offlineRuntime.lastKillAt > 0 &&
            now - _offlineRuntime.lastKillAt > OFFLINE_RECENT_KILL_MS) return false;
        return true;
    }

    function _offlineValidMob(mob, map) {
        if (!mob || mob._dead || !_offlineValidHuntMap(map)) return false;
        if (mob.boss || mob.trollPlayer || mob.siegeEnemy || mob.pledgeEnemy || mob.noAutoTeleport) return false;
        if (mob.race === '血盟' || mob.race === '建築' || !(Number(mob.exp) > 0)) return false;
        return true;
    }

    function _offlineValidBoss(mob, map) {
        if (!mob || mob._dead || !mob.boss || !_offlineValidHuntMap(map)) return false;
        if (mob.trollPlayer || mob.siegeEnemy || mob.pledgeEnemy || mob.noAutoTeleport) return false;
        if (mob.race === '血盟' || mob.race === '建築' || !(Number(mob.exp) > 0)) return false;
        let pool = typeof DB !== 'undefined' && DB.maps && Array.isArray(DB.maps[map]) ? DB.maps[map] : [];
        return pool.some(id => {
            let root = DB.mobs && DB.mobs[id];
            if (!root || !root.boss) return false;
            let finalMob = _offlineFinalMob(root);
            return finalMob && finalMob.n === mob.n;
        });
    }

    function _offlineExpProgress(lv, exp) {
        lv = Math.max(1, Math.min(100, Math.floor(_offlineFinite(lv, 1))));
        let total = Math.max(0, _offlineFinite(exp, 0));
        if (typeof getExpReq !== 'function') return total;
        for (let n = 1; n < lv; n++) {
            let req = Number(getExpReq(n));
            if (Number.isFinite(req) && req > 0) total += req;
        }
        return total;
    }

    function _offlineExpectedPartyExp(mob) {
        let base = Math.max(0, Number(mob && mob.exp) || 0);
        let bonus = typeof partyExpBonusPct === 'function' ? Number(partyExpBonusPct()) || 0 : 0;
        let share = typeof partyExpShareCount === 'function' ? Math.max(1, Number(partyExpShareCount()) || 1) : 1;
        let ally = Math.floor(base * (1 + bonus / 100) / share);
        let doll = typeof dollFieldVal === 'function' ? Number(dollFieldVal('expBonus')) || 0 : 0;
        return {
            pet: Math.max(0, Math.floor(ally * (1 + doll / 100))),
            ally: Math.max(0, ally)
        };
    }

    function _offlineRecordKill(mob, map, expGain, goldGain, petExpGain, allyExpGain, now) {
        if (!_offlineRuntime || _offlineRuntime.map !== String(map)) _offlineResetRuntime(map);
        let rt = _offlineRuntime;
        if (!rt.firstKillAt) rt.firstKillAt = now;
        rt.lastKillAt = now;
        rt.kills++;
        rt.exp += Math.max(0, Math.floor(_offlineFinite(expGain, 0)));
        rt.gold += Math.max(0, Math.floor(_offlineFinite(goldGain, 0)));
        rt.petExp += Math.max(0, Math.floor(_offlineFinite(petExpGain, 0)));
        rt.allyExp += Math.max(0, Math.floor(_offlineFinite(allyExpGain, 0)));
        let snap = _offlineMobProfile({
            n: mob && mob.n,
            count: 1,
            lv: mob && mob.lv,
            race: mob && mob.race,
            transformTo: mob && mob.transformTo,
            sherine: !!(mob && mob._sherine),
            sherineMad: !!(mob && mob._sherineMad),
            grace: !!(mob && mob._grace)
        });
        if (snap) {
            let key = _offlineMobKey(snap);
            if (rt.mobKills[key]) rt.mobKills[key].count++;
            else if (Object.keys(rt.mobKills).length < OFFLINE_MAX_MOB_PROFILES) rt.mobKills[key] = snap;
        }
    }

    function _offlineRecordBossKill(mob, map, expGain, goldGain, petExpGain, allyExpGain, now) {
        let st = _offlineEnsureState();
        if (!st || !mob) return;
        let previous = _offlineProfileForMap(st, map) || {
            map: String(map), mapName: _offlineMapName(map), expPerMin: 0, goldPerMin: 0,
            killsPerMin: 0, petExpPerMin: 0, allyExpPerMin: 0, sampleMs: 0,
            mobs: [], bosses: [], sampleKills: 0, updatedAt: 0
        };
        let bosses = _offlineBossProfiles(previous.bosses);
        let old = bosses.find(row => row.n === mob.n) || null;
        let weight = old ? Math.min(20, old.wins) : 0;
        let avg = (oldValue, sample) => (Math.max(0, _offlineFinite(oldValue, 0)) * weight +
            Math.max(0, _offlineFinite(sample, 0))) / (weight + 1);
        let bornAt = Math.max(0, _offlineFinite(mob._bornMs, 0));
        let killMs = bornAt > 0 ? now - bornAt : 1000;
        killMs = _offlineClamp(killMs, TICK_MS, OFFLINE_MAX_MS);
        let next = _offlineBossProfile({
            n: mob.n,
            wins: (old ? old.wins : 0) + 1,
            lv: mob.lv,
            race: mob.race,
            transformTo: mob.transformTo,
            sherine: !!mob._sherine,
            sherineMad: !!mob._sherineMad,
            grace: !!mob._grace,
            avgKillMs: avg(old && old.avgKillMs, killMs),
            expPerKill: avg(old && old.expPerKill, expGain),
            goldPerKill: avg(old && old.goldPerKill, goldGain),
            petExpPerKill: avg(old && old.petExpPerKill, petExpGain),
            allyExpPerKill: avg(old && old.allyExpPerKill, allyExpGain),
            updatedAt: now
        });
        bosses = bosses.filter(row => row.n !== mob.n);
        if (next) bosses.unshift(next);
        _offlineRememberProfile(st, Object.assign({}, previous, {
            bosses: bosses.slice(0, OFFLINE_MAX_BOSS_PROFILES),
            updatedAt: now
        }));
    }

    function _offlineCommitProfile(now, st) {
        st = st || _offlineEnsureState();
        if (!st) return null;
        let currentMap = String(mapState && mapState.current || '');
        let previous = _offlineProfileForMap(st, currentMap);
        st.profile = previous;
        if (!_offlineRuntime || !_offlineRuntime.firstKillAt) return previous;
        let rt = _offlineRuntime;
        let elapsed = Math.max(0, now - rt.firstKillAt);
        if (rt.map !== currentMap || elapsed < OFFLINE_SAMPLE_MIN_MS || rt.kills < OFFLINE_SAMPLE_MIN_KILLS) {
            return previous;
        }
        let mins = elapsed / 60000;
        return _offlineRememberProfile(st, {
            map: rt.map,
            mapName: _offlineMapName(rt.map),
            expPerMin: rt.exp / mins,
            goldPerMin: rt.gold / mins,
            killsPerMin: rt.kills / mins,
            petExpPerMin: rt.petExp / mins,
            allyExpPerMin: rt.allyExp / mins,
            sampleMs: elapsed,
            mobs: Object.keys(rt.mobKills).map(k => rt.mobKills[k]),
            bosses: previous ? previous.bosses : [],
            sampleKills: rt.kills,
            updatedAt: now
        });
    }

    function _offlinePrepareSnapshot(now, closingPage) {
        now = Math.max(0, Math.floor(_offlineFinite(now, _offlineNow())));
        let activityNow = now;
        if (_offlineHiddenAt > 0 && activityNow > _offlineHiddenAt) activityNow = _offlineHiddenAt;
        let snapshotNow = closingPage === true ? now : activityNow;
        let st = _offlineEnsureState();
        if (!st) return null;
        let profile = _offlineCommitProfile(activityNow, st);
        let eligible = _offlineCanSnapshot(activityNow, profile);
        st.eligible = eligible;
        st.awaySince = snapshotNow;
        st.map = eligible ? String(mapState.current) : '';
        st.mapName = eligible ? _offlineMapName(mapState.current) : '';
        let checkpoint = {
            v: OFFLINE_VERSION,
            lastActive: snapshotNow,
            snapshot: JSON.parse(JSON.stringify(st))
        };
        _offlineWriteJson(_offlineStoreKey('checkpoint'), checkpoint);
        return st;
    }

    function _offlineRememberPendingCatchup(closedAt) {
        let key = _offlineStoreKey('catchup');
        if (!key) return false;
        let runtimeMs = typeof catchupPendingMs === 'function' ? catchupPendingMs() : 0;
        let hiddenMs = _offlineHiddenAt > 0 ? Math.max(0, closedAt - _offlineHiddenAt) : 0;
        let previous = _offlineReadJson(key);
        // 已排入本頁記憶體的舊債不可再取 max，否則中途關頁會把已補過的部分再次帶回。
        let previousMs = _offlineRestoredCatchupKey === key ? 0 :
            (previous ? Math.max(0, Math.floor(_offlineFinite(previous.ms, 0))) : 0);
        let ms = Math.max(previousMs, Math.floor(Math.max(0, runtimeMs) + hiddenMs));
        if (ms < TICK_MS) {
            _offlineStorageRemove(key);
            return false;
        }
        return _offlineWriteJson(key, {
            v: OFFLINE_VERSION,
            ms: ms,
            closedAt: Math.max(0, Math.floor(closedAt))
        });
    }

    function _offlineRestorePendingCatchup() {
        let key = _offlineStoreKey('catchup');
        let pending = _offlineReadJson(key);
        if (!key || !pending) return false;
        if (_offlineRestoredCatchupKey === key) return false;
        let ms = Math.max(0, Math.floor(_offlineFinite(pending.ms, 0)));
        if (ms < TICK_MS) {
            _offlineStorageRemove(key);
            return false;
        }
        _offlineRestoredCatchupKey = key;
        _offlineLastBatchSavedOk = false;
        if (typeof window.offlineSettleCatchup !== 'function' || !window.offlineSettleCatchup(ms, 'restore')) {
            _offlineRestoredCatchupKey = '';
            return false;
        }
        // 先成功儲存角色資料才刪除待結算憑證；失敗時保留到下一次成功存檔再提交。
        return _offlineLastBatchSavedOk ? _offlineCommitRestoredCatchup() : true;
    }

    function _offlineCommitRestoredCatchup() {
        if (!_offlineRestoredCatchupKey) return false;
        let key = _offlineRestoredCatchupKey;
        if (!_offlineStorageRemove(key)) return false;
        _offlineRestoredCatchupKey = '';
        return true;
    }
    window.offlineCatchupSaveCommitted = _offlineCommitRestoredCatchup;

    function _offlineReadClaimAt(now) {
        let obj = _offlineReadJson(_offlineStoreKey('claim'));
        let t = obj ? Math.floor(_offlineFinite(obj.claimedUntil, 0)) : 0;
        return t > now + 5 * 60 * 1000 ? now : Math.max(0, t);
    }

    function _offlineWriteClaimAt(now) {
        return _offlineWriteJson(_offlineStoreKey('claim'), { v: OFFLINE_VERSION, claimedUntil: now });
    }

    function _offlineApplyAllyExp(amount) {
        amount = Math.max(0, Math.floor(_offlineFinite(amount, 0)));
        if (!amount || !Array.isArray(player.allies)) return;
        player.allies.forEach(a => {
            if (!a || a._downed || (a.lv || 1) >= 100) return;
            a.exp = Math.max(0, Number(a.exp) || 0) + amount;
            a._expGained = Math.max(0, Number(a._expGained) || 0) + amount;
            let levels = 0;
            while ((a.lv || 1) < 100 && a.exp >= getExpReq(a.lv)) {
                a.exp -= getExpReq(a.lv);
                a.lv++;
                if (a.lv >= 50) a.bonus = (a.bonus || 0) + 1;
                levels++;
            }
            if ((a.lv || 1) >= 100) a.exp = 0;
            if (levels > 0 && typeof _allyLevelRecompute === 'function') {
                try { _allyLevelRecompute(a); } catch (e) {}
            }
        });
    }

    function _offlineFinalMob(base) {
        let mob = base, seen = Object.create(null), guard = 0;
        while (mob && mob.transformTo && typeof DB !== 'undefined' && DB.mobs &&
            DB.mobs[mob.transformTo] && !seen[mob.transformTo] && guard++ < 10) {
            seen[mob.transformTo] = true;
            mob = DB.mobs[mob.transformTo];
        }
        return mob;
    }

    function _offlineFallbackMobs(map) {
        if (typeof DB === 'undefined' || !DB.maps || !DB.mobs || !Array.isArray(DB.maps[map])) return [];
        let byKey = Object.create(null);
        DB.maps[map].forEach(id => {
            let root = DB.mobs[id];
            if (!root || root.boss || root.trollPlayer || root.siegeEnemy || root.pledgeEnemy ||
                root.noAutoTeleport || root.race === '血盟' || root.race === '建築' || !(Number(root.exp) > 0)) return;
            let mob = _offlineFinalMob(root);
            let snap = _offlineMobProfile({
                n: mob && mob.n,
                count: 1,
                lv: mob && mob.lv,
                race: mob && mob.race,
                transformTo: mob && mob.transformTo,
                sherine: !!(player && player.sherineWorld),
                sherineMad: !!(player && player.sherineWorld && player.sherineMad),
                grace: false
            });
            if (!snap) return;
            let key = _offlineMobKey(snap);
            if (byKey[key]) byKey[key].count++;
            else byKey[key] = snap;
        });
        return Object.keys(byKey).map(k => byKey[k]).slice(0, OFFLINE_MAX_MOB_PROFILES);
    }

    function _offlineBossPool(map) {
        if (typeof DB === 'undefined' || !DB.maps || !DB.mobs || !Array.isArray(DB.maps[map])) return [];
        let byName = Object.create(null);
        DB.maps[map].forEach(id => {
            let root = DB.mobs[id];
            if (!root || !root.boss || root.trollPlayer || root.siegeEnemy || root.pledgeEnemy || root.noAutoTeleport) return;
            let mob = _offlineFinalMob(root);
            if (!mob || mob.race === '血盟' || mob.race === '建築' || !(Number(mob.exp) > 0)) return;
            byName[mob.n] = true;
        });
        return Object.keys(byName);
    }

    function _offlineMobPlan(profile, kills) {
        kills = Math.max(0, Math.floor(_offlineFinite(kills, 0)));
        if (!kills) return [];
        let mobs = _offlineMobProfiles(profile && profile.mobs);
        if (!mobs.length) mobs = _offlineFallbackMobs(profile && profile.map);
        let totalWeight = mobs.reduce((sum, mob) => sum + mob.count, 0);
        if (!totalWeight) return [];
        let plan = mobs.map(mob => {
            let exact = kills * mob.count / totalWeight;
            return { mob: mob, kills: Math.floor(exact), frac: exact - Math.floor(exact) };
        });
        let assigned = plan.reduce((sum, row) => sum + row.kills, 0);
        while (assigned++ < kills) {
            let roll = Math.random() * totalWeight, picked = plan[plan.length - 1];
            for (let row of plan) {
                roll -= row.mob.count;
                if (roll < 0) { picked = row; break; }
            }
            picked.kills++;
        }
        return plan.filter(row => row.kills > 0);
    }

    function _offlinePoisson(lambda) {
        if (!(lambda > 0)) return 0;
        let limit = Math.exp(-lambda), product = 1, count = 0;
        do { count++; product *= Math.random(); } while (product > limit && count < 10000);
        return count - 1;
    }

    function _offlineNormal() {
        let u = 0, v = 0;
        while (!u) u = Math.random();
        while (!v) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    function _offlineBinomial(n, p) {
        n = Math.max(0, Math.floor(_offlineFinite(n, 0)));
        p = _offlineClamp(p, 0, 1);
        if (!n || !p) return 0;
        if (p >= 1) return n;
        let mean = n * p;
        if (mean < 30) return Math.min(n, _offlinePoisson(mean));
        let missMean = n * (1 - p);
        if (missMean < 30) return Math.max(0, n - Math.min(n, _offlinePoisson(missMean)));
        let value = Math.round(mean + Math.sqrt(n * p * (1 - p)) * _offlineNormal());
        return Math.max(0, Math.min(n, value));
    }

    function _offlineSplitUniform(values, count) {
        let result = Object.create(null);
        if (!Array.isArray(values) || !values.length || count <= 0) return result;
        for (let i = 0; i < count; i++) {
            let value = values[Math.floor(Math.random() * values.length)];
            result[value] = (result[value] || 0) + 1;
        }
        return result;
    }

    function _offlineBossPlan(profile, normalKills, elapsedMs) {
        let result = {
            rows: [], kills: 0, timeMs: 0, exp: 0, gold: 0, petExp: 0, allyExp: 0
        };
        let map = profile && profile.map;
        let pool = _offlineBossPool(map);
        let proofs = _offlineBossProfiles(profile && profile.bosses);
        normalKills = Math.max(0, Math.floor(_offlineFinite(normalKills, 0)));
        elapsedMs = Math.max(0, Math.floor(_offlineFinite(elapsedMs, 0)));
        if (!pool.length || !proofs.length || !normalKills || !elapsedMs) return result;

        let chance = map === 'elder_room' ? 0.05 : 0.01;
        let encounters = _offlineBinomial(normalKills, chance);
        if (!encounters) return result;
        let split = _offlineSplitUniform(pool, encounters);
        let remainingMs = elapsedMs;
        pool.forEach(name => {
            let requested = Math.max(0, Math.floor(_offlineFinite(split[name], 0)));
            let proof = proofs.find(row => row.n === name);
            if (!requested || !proof) return;
            let perKillMs = _offlineClamp(proof.avgKillMs, TICK_MS, OFFLINE_MAX_MS);
            let count = Math.min(requested, Math.floor(remainingMs / perKillMs));
            if (!count) return;
            let spent = Math.floor(perKillMs * count);
            remainingMs = Math.max(0, remainingMs - spent);
            result.rows.push({ mob: proof, kills: count });
            result.kills += count;
            result.timeMs += spent;
            result.exp += Math.floor(proof.expPerKill * count);
            result.gold += Math.floor(proof.goldPerKill * count);
            result.petExp += Math.floor(proof.petExpPerKill * count);
            result.allyExp += Math.floor(proof.allyExpPerKill * count);
        });
        return result;
    }

    function _offlineTrackItem(loot, id, count) {
        count = Math.max(0, Math.floor(_offlineFinite(count, 0)));
        if (!count) return;
        loot.items[id] = (loot.items[id] || 0) + count;
        loot.itemCount += count;
    }

    function _offlineTrackCard(loot, name, tier, count) {
        count = Math.max(0, Math.floor(_offlineFinite(count, 0)));
        if (!count) return;
        let key = tier + '|' + name;
        loot.cards[key] = (loot.cards[key] || 0) + count;
        loot.cardCount += count;
    }

    function _offlineGainDirect(id, count, loot) {
        if (!count || typeof gainItem !== 'function') return;
        let info = gainItem(id, count, true, true, false, true);
        if (info) _offlineTrackItem(loot, info.id, info.cnt);
    }

    function _offlineGainItem(id, count, mob, loot) {
        count = Math.max(0, Math.floor(_offlineFinite(count, 0)));
        let d = typeof DB !== 'undefined' && DB.items ? DB.items[id] : null;
        if (!count || !d || typeof gainItem !== 'function') return;
        if (id === 'scroll_weapon' || id === 'scroll_armor') {
            let blessed = _offlineBinomial(count, 0.01);
            let cursed = _offlineBinomial(count - blessed, 0.01 / 0.99);
            _offlineGainDirect(id, count - blessed - cursed, loot);
            _offlineGainDirect(id + '_b', blessed, loot);
            _offlineGainDirect(id + '_c', cursed, loot);
            return;
        }
        if (id === 'relic_genie_wishes') {
            for (let i = 0; i < count; i++) {
                let info = gainItem(id, 1, true, false, false, true);
                if (info) _offlineTrackItem(loot, info.id, info.cnt);
            }
            return;
        }
        let equip = !d.relic && ((d.type === 'wpn' && !d.isArrow) || d.type === 'arm' || d.type === 'acc');
        if (!equip) {
            let info = gainItem(id, count, true, false, false, true);
            if (info) _offlineTrackItem(loot, info.id, info.cnt);
            return;
        }
        let blessRate = 0.01 * (mob.sherine ? (mob.sherineMad ? 5 : 3) : 1);
        let blessed = _offlineBinomial(count, blessRate);
        _offlineGainDirect(id, count - blessed, loot);
        if (blessed > 0) {
            let oldForce = _forceBless;
            try {
                _forceBless = true;
                let info = gainItem(id, blessed, true, false, false, true);
                if (info) _offlineTrackItem(loot, info.id, info.cnt);
            } finally {
                _forceBless = oldForce;
            }
        }
    }

    function _offlineRelicDropMult(itemId) {
        let d = DB.items[itemId];
        if (!d || !d.relic || !player || !player.eq) return 1;
        for (let slot in player.eq) {
            let eq = player.eq[slot], ed = eq && DB.items[eq.id];
            if (ed && ed.relicDropX2) return 2;
        }
        return 1;
    }

    function _offlineTrialItem(itemId) {
        return typeof TRIAL_ITEM_CLASS !== 'undefined' && !!TRIAL_ITEM_CLASS[itemId];
    }

    function _offlineRollTable(mob, kills, table, mult, loot, relicMult) {
        let entries = table && table[mob.n];
        if (!Array.isArray(entries)) return;
        entries.forEach(entry => {
            let id = entry && entry[0], d = id && DB.items[id];
            if (!d || _offlineTrialItem(id)) return;
            let chance = (Number(entry[1]) || 0) * mult / 100;
            if (relicMult) chance *= _offlineRelicDropMult(id);
            let count = _offlineBinomial(kills, Math.min(1, chance));
            if (count) _offlineGainItem(id, count, mob, loot);
        });
    }

    function _offlineGrantCard(name, tier, count, loot) {
        if (!count || typeof cardId !== 'function' || typeof cardDexScore !== 'function' ||
            typeof _cardRegister !== 'function' || !DB.items[cardId(name, tier)]) return;
        if (cardDexScore(name) >= 100) {
            let info = gainItem(cardId(name, tier), count, true, false, false, true);
            if (!info) return;
        } else {
            let registered = _cardRegister(name, tier, count);
            if (count > registered.useN) gainItem(cardId(name, tier), count - registered.useN, true, false, false, true);
        }
        _offlineTrackCard(loot, name, tier, count);
    }

    function _offlineRollCards(mob, kills, loot) {
        if (mob.race === '血盟' || mob.race === '建築' || mob.transformTo ||
            typeof CARD_MOB_INFO === 'undefined' || !CARD_MOB_INFO[mob.n]) return;
        let names = (typeof CARD_CHAIN_BY_FINAL !== 'undefined' && CARD_CHAIN_BY_FINAL[mob.n]) || [mob.n];
        [[3, 0.00001], [2, 0.0001], [1, 0.001]].forEach(row => {
            let count = _offlineBinomial(kills, row[1]);
            let split = _offlineSplitUniform(names, count);
            Object.keys(split).forEach(name => _offlineGrantCard(name, row[0], split[name], loot));
        });
    }

    function _offlineRollMobLoot(mob, kills, map, loot) {
        let dropBase = mob.grace ? 10 : (mob.sherine ? (mob.sherineMad ? 5 : 3) : 1);
        let classic = typeof classicDropMult === 'function' ? classicDropMult() : 1;
        let dropMult = dropBase * classic;
        let oldSherine = _sherineLootCtx;
        let oldForceBless = _forceBless;
        try {
            _sherineLootCtx = mob.sherine ? { mad: !!mob.sherineMad } : null;
            if (typeof MOB_DROPS !== 'undefined') _offlineRollTable(mob, kills, MOB_DROPS, dropBase, loot, true);
            if (mob.lv >= 40) {
                let panacea = _offlineBinomial(kills, 0.0001 * classic);
                let split = _offlineSplitUniform(['panacea_str','panacea_dex','panacea_con','panacea_int','panacea_wis','panacea_cha'], panacea);
                Object.keys(split).forEach(id => _offlineGainItem(id, split[id], mob, loot));
            }
            let refine = Array.isArray(player.skills) && player.skills.includes('sk_dark_refine');
            if (map === 'silent_outer') {
                _offlineGainItem('mat_blackstone2', _offlineBinomial(kills, (refine ? 0.30 : 0.20) * classic), mob, loot);
                _offlineGainItem('mat_blackstone3', _offlineBinomial(kills, (refine ? 0.15 : 0.10) * classic), mob, loot);
            } else if (refine && typeof mapCategoryOf === 'function' && ['wild','dungeon'].includes(mapCategoryOf(map))) {
                _offlineGainItem('mat_blackstone2', _offlineBinomial(kills, 0.01 * classic), mob, loot);
                _offlineGainItem('mat_blackstone3', _offlineBinomial(kills, 0.005 * classic), mob, loot);
                _offlineGainItem('mat_blackstone4', _offlineBinomial(kills, 0.001 * classic), mob, loot);
            }
            let oreRates = { '石頭高崙':1, '鋼鐵高崙':1, '侏儒':0.5, '侏儒戰士':0.5, '黑騎士':0.5, '哈柏哥布林':0.5, '蜥蜴人':0.5 };
            if (oreRates[mob.n]) _offlineGainItem('mat_silverore', _offlineBinomial(kills, Math.min(1, oreRates[mob.n] * classic)), mob, loot);
            if (player.inv.some(i => i.id === 'item_dk_insignia') && typeof mapRegionOf === 'function' && mapRegionOf(map) === 'rastabad') {
                _offlineGainItem('mat_holy_relic', _offlineBinomial(kills, 0.001 * classic), mob, loot);
            }
            if (typeof DARK_WEAPON_DROPS !== 'undefined') _offlineRollTable(mob, kills, DARK_WEAPON_DROPS, dropMult, loot, false);
            if (typeof DARK_CRYSTAL_DROPS !== 'undefined') _offlineRollTable(mob, kills, DARK_CRYSTAL_DROPS, dropMult, loot, false);
            if (typeof DRAGON_DROPS !== 'undefined') _offlineRollTable(mob, kills, DRAGON_DROPS, dropBase, loot, false);
            if (typeof WARRIOR_DROPS !== 'undefined') _offlineRollTable(mob, kills, WARRIOR_DROPS, dropMult, loot, false);
            if (typeof MEM_DROPS !== 'undefined') _offlineRollTable(mob, kills, MEM_DROPS, dropMult, loot, false);
            _offlineRollCards(mob, kills, loot);
            if (typeof AREA_BONUS_MAPS !== 'undefined' && AREA_BONUS_MAPS.includes(map) &&
                typeof AREA_BONUS_ITEMS !== 'undefined') {
                let worldTree = Array.isArray(player.skills) && player.skills.includes('sk_elf_worldtree');
                AREA_BONUS_ITEMS.forEach(id => {
                    let baseRate = id === 'new_item_195' ? (worldTree ? 0.30 : 0.20) : (worldTree ? 0.03 : 0.02);
                    _offlineGainItem(id, _offlineBinomial(kills, Math.min(1, baseRate * dropMult)), mob, loot);
                });
            }
            if (mob.sherine) {
                let rate = 0.00001 * mob.lv * (mob.sherineMad ? 3 : 1) * classic;
                _offlineGainItem('sherine_crystal', _offlineBinomial(kills, Math.min(1, rate)), mob, loot);
            }
        } finally {
            _sherineLootCtx = oldSherine;
            _forceBless = oldForceBless;
        }
    }

    function _offlineRollLoot(profile, kills, bossPlan) {
        let loot = { items: Object.create(null), cards: Object.create(null), itemCount: 0, cardCount: 0 };
        _offlineMobPlan(profile, kills).forEach(row => _offlineRollMobLoot(row.mob, row.kills, profile.map, loot));
        if (bossPlan && Array.isArray(bossPlan.rows)) {
            bossPlan.rows.forEach(row => _offlineRollMobLoot(row.mob, row.kills, profile.map, loot));
        }
        try { if (typeof autoSortInventory === 'function') autoSortInventory(); } catch (e) {}
        return loot;
    }

    function _offlineLootHtml(result) {
        let itemRows = Object.keys(result.items || {}).map(id => ({
            name: (typeof DB !== 'undefined' && DB.items && DB.items[id] && DB.items[id].n) || id,
            count: result.items[id]
        })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
        let tierName = { 1: '普卡', 2: '銀卡', 3: '金卡' };
        let cardRows = Object.keys(result.cards || {}).map(key => {
            let cut = key.indexOf('|'), tier = Number(key.slice(0, cut)), name = key.slice(cut + 1);
            return { name: name + ' ' + (tierName[tier] || '卡片'), count: result.cards[key] };
        }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
        let rows = itemRows.concat(cardRows);
        if (!rows.length) return '<div style="color:#64748b;">本次未取得怪物掉落物。</div>';
        let shown = rows.slice(0, 16).map(row =>
            '<div style="display:flex;justify-content:space-between;gap:12px;"><span>' + _offlineEsc(row.name) +
            '</span><b style="color:#fef08a;">× ' + row.count.toLocaleString() + '</b></div>').join('');
        if (rows.length > 16) shown += '<div style="color:#94a3b8;">其餘 ' + (rows.length - 16) + ' 種已收入背包／圖鑑</div>';
        return shown;
    }

    function _offlineFormatDuration(ms) {
        let totalMin = Math.max(0, Math.floor(ms / 60000));
        let h = Math.floor(totalMin / 60);
        let m = totalMin % 60;
        return (h ? h + ' 小時 ' : '') + m + ' 分鐘';
    }

    function _offlineFormatCatchupDuration(ms) {
        let seconds = Math.max(0, Math.round(_offlineFinite(ms, 0) / 1000));
        return seconds >= 60 ? Math.floor(seconds / 60) + ' 分 ' + (seconds % 60) + ' 秒' : seconds + ' 秒';
    }

    function _offlineCatchupGainRows(loot) {
        let rows = [];
        Object.keys(loot.items || {}).forEach(id => {
            let count = Math.max(0, Math.floor(_offlineFinite(loot.items[id], 0)));
            if (!count) return;
            let def = typeof DB !== 'undefined' && DB.items ? DB.items[id] : null;
            let color = 'text-yellow-200';
            try { if (typeof getItemColor === 'function') color = getItemColor({ id: id, en: 0 }); } catch (e) {}
            rows.push('<span class="' + color + ' font-bold">' + _offlineEsc((def && def.n) || id) + ' ×' + count.toLocaleString() + '</span>');
        });
        let tierName = { 1: '普卡', 2: '銀卡', 3: '金卡' };
        Object.keys(loot.cards || {}).forEach(key => {
            let count = Math.max(0, Math.floor(_offlineFinite(loot.cards[key], 0)));
            if (!count) return;
            let cut = key.indexOf('|'), tier = Number(key.slice(0, cut)), name = key.slice(cut + 1);
            let id = '';
            try { if (typeof cardId === 'function') id = cardId(name, tier); } catch (e) {}
            let def = id && typeof DB !== 'undefined' && DB.items ? DB.items[id] : null;
            let color = 'text-sky-200';
            try { if (id && typeof getItemColor === 'function') color = getItemColor({ id: id, en: 0 }); } catch (e) {}
            rows.push('<span class="' + color + ' font-bold">' + _offlineEsc((def && def.n) || (name + ' ' + (tierName[tier] || '卡片'))) + ' ×' + count.toLocaleString() + '</span>');
        });
        return rows;
    }

    function _offlineShowSummary(result) {
        let old = document.getElementById('offline-reward-modal');
        if (old) old.remove();
        let overlay = document.createElement('div');
        overlay.id = 'offline-reward-modal';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10080;background:rgba(2,6,23,.78);display:flex;align-items:center;justify-content:center;padding:16px;';
        overlay.innerHTML =
            '<div style="width:min(460px,100%);max-height:90vh;overflow:auto;border:1px solid #a16207;border-radius:8px;background:#171923;color:#e5e7eb;box-shadow:0 18px 60px #000c;padding:20px;">' +
                '<div style="font-size:22px;font-weight:700;color:#fde68a;border-bottom:1px solid #4b5563;padding-bottom:10px;margin-bottom:14px;">離線收益</div>' +
                '<div style="color:#cbd5e1;line-height:1.7;margin-bottom:12px;">' +
                    '<div>狩獵區：<span style="color:#93c5fd;">' + _offlineEsc(result.mapName) + '</span></div>' +
                    '<div>離線時間：' + _offlineFormatDuration(result.elapsedMs) + (result.capped ? '（已達 12 小時上限）' : '') + '</div>' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:1fr auto;gap:8px 14px;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:12px;">' +
                    '<span>獲得經驗</span><b style="color:#86efac;">' + result.exp.toLocaleString() + '</b>' +
                    '<span>獲得金幣</span><b style="color:#fde047;">' + result.gold.toLocaleString() + '</b>' +
                    '<span>擊殺怪物</span><b style="color:#c4b5fd;">' + result.kills.toLocaleString() + '</b>' +
                    (result.bossKills > 0 ? '<span>擊殺頭目</span><b style="color:#fca5a5;">' + result.bossKills.toLocaleString() + '</b>' : '') +
                    '<span>掉落物品</span><b style="color:#fef08a;">' + result.itemCount.toLocaleString() + '</b>' +
                    '<span>怪物卡片</span><b style="color:#93c5fd;">' + result.cardCount.toLocaleString() + '</b>' +
                '</div>' +
                '<div style="margin-top:12px;padding:12px;border:1px solid #334155;border-radius:6px;background:#111827;line-height:1.65;font-size:14px;">' +
                    '<div style="font-weight:700;color:#fcd34d;margin-bottom:6px;">離線戰利品</div>' + _offlineLootHtml(result) + '</div>' +
                '<button type="button" onclick="document.getElementById(\'offline-reward-modal\').remove()" style="width:100%;height:42px;margin-top:16px;border:1px solid #d97706;border-radius:6px;background:#78350f;color:#fef3c7;font-weight:700;cursor:pointer;">確認</button>' +
            '</div>';
        document.body.appendChild(overlay);
    }

    function _offlineRewardAmount(ratePerMin, elapsedMs, efficiency) {
        let value = Math.max(0, Number(ratePerMin) || 0) * Math.max(0, Number(elapsedMs) || 0) /
            60000 * _offlineClamp(efficiency, 0, 1);
        // 消除整段比例運算的二進位浮點尾差，不改變一般小數的向下取整規則。
        return Math.max(0, Math.floor(value + 1e-7));
    }

    function _offlineReduce(obj, key, amount) {
        if (!obj || !(Number(obj[key]) > 0)) return false;
        let before = Number(obj[key]);
        obj[key] = Math.max(0, before - amount);
        return before > 0 && obj[key] === 0;
    }

    // 一次結算仍要讓相對時間狀態經過同樣時長，但不執行攻擊、受傷、動畫或事件 tick。
    function _offlineAdvanceCombatTime(elapsedMs) {
        let ticks = Math.max(0, Math.floor(_offlineFinite(elapsedMs, 0) / TICK_MS));
        let seconds = Math.max(0, Math.floor(_offlineFinite(elapsedMs, 0) / 1000));
        if (!ticks || typeof player === 'undefined' || !player) return;
        if (typeof state !== 'undefined' && state) {
            state.ticks = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Number(state.ticks) || 0) + ticks);
            state.pDmgTick = 0;
            state.pOffDmgTick = 0;
            state._pStunCycle = false;
        }
        if (player.manualCd) Object.keys(player.manualCd).forEach(k => _offlineReduce(player.manualCd, k, ticks));
        let statusValues = new Set(['poisonDmg','poisonTick','burnDmg','burnTick','scaldDmg','scaldTick','bleedDmg','bleedTick','armorBreakPct']);
        if (player.statuses) Object.keys(player.statuses).forEach(k => {
            if (!statusValues.has(k)) _offlineReduce(player.statuses, k, ticks);
        });
        if (player.cds) {
            ['atkSk','healSk','purifySk','convertSk','castLock'].forEach(k => _offlineReduce(player.cds, k, ticks));
            if (player.cds.healSkillCds) Object.keys(player.cds.healSkillCds).forEach(k => _offlineReduce(player.cds.healSkillCds, k, ticks));
            _offlineReduce(player.cds, 'pot', seconds);
        }
        _offlineReduce(player, 'reviveScrollCd', seconds);
        _offlineReduce(player, 'magicShieldCd', seconds);
        _offlineReduce(player, '_waterVitalCd', seconds);
        if (player.buffs) Object.keys(player.buffs).forEach(k => _offlineReduce(player.buffs, k, seconds));
        if (player.hots) Object.keys(player.hots).forEach(k => {
            let hot = player.hots[k];
            if (!hot || !(hot.ticksLeft > 0)) { delete player.hots[k]; return; }
            let interval = Math.max(1, Math.floor(_offlineFinite(hot.interval, 1)));
            let first = Math.max(1, Math.floor(_offlineFinite(hot.cd, interval)));
            if (ticks < first) { hot.cd = first - ticks; return; }
            let pulses = 1 + Math.floor((ticks - first) / interval);
            hot.ticksLeft = Math.max(0, hot.ticksLeft - pulses);
            if (!hot.ticksLeft) delete player.hots[k];
            else hot.cd = interval - ((ticks - first) % interval);
        });
        (Array.isArray(player.allies) ? player.allies : []).forEach(ally => {
            if (!ally) return;
            if (ally._downed) { _offlineReduce(ally, '_reviveCd', ticks); return; }
            if (ally.statuses) Object.keys(ally.statuses).forEach(k => {
                if (!statusValues.has(k)) _offlineReduce(ally.statuses, k, ticks);
            });
            ['_potCd','_atkSkillCd','_healCastCd','_convertSkillCd','_purifySkillCd','_atkCd','_offAtkCd','_cleaveTicks','_crushFuryTicks']
                .forEach(k => _offlineReduce(ally, k, ticks));
            if (ally._healSkillCds) Object.keys(ally._healSkillCds).forEach(k => _offlineReduce(ally._healSkillCds, k, ticks));
            _offlineReduce(ally, '_waterVitalCd', seconds);
            if (ally.buffs) Object.keys(ally.buffs).forEach(k => _offlineReduce(ally.buffs, k, seconds));
            try { if (typeof _allyLevelRecompute === 'function') _allyLevelRecompute(ally); } catch (e) {}
        });
    }

    function _offlineGrantBatch(source, profile, elapsed, rawElapsed, efficiency, options) {
        options = options || {};
        let now = options.now || _offlineNow();
        let previewKills = _offlineRewardAmount(profile.killsPerMin, elapsed, efficiency);
        let bossPlan = options.allowBosses ? _offlineBossPlan(profile, previewKills, elapsed) :
            { rows: [], kills: 0, timeMs: 0, exp: 0, gold: 0, petExp: 0, allyExp: 0 };
        let huntElapsed = Math.max(0, elapsed - bossPlan.timeMs);
        let normalKills = _offlineRewardAmount(profile.killsPerMin, huntElapsed, efficiency);
        let exp = Math.min(Number.MAX_SAFE_INTEGER,
            _offlineRewardAmount(profile.expPerMin, huntElapsed, efficiency) + bossPlan.exp);
        let gold = Math.min(Number.MAX_SAFE_INTEGER,
            _offlineRewardAmount(profile.goldPerMin, huntElapsed, efficiency) + bossPlan.gold);
        let kills = Math.min(Number.MAX_SAFE_INTEGER, normalKills + bossPlan.kills);
        let petExp = Math.min(Number.MAX_SAFE_INTEGER,
            _offlineRewardAmount(profile.petExpPerMin, huntElapsed, efficiency) + bossPlan.petExp);
        let allyExp = Math.min(Number.MAX_SAFE_INTEGER,
            _offlineRewardAmount(profile.allyExpPerMin, huntElapsed, efficiency) + bossPlan.allyExp);
        let loot = kills > 0 ? _offlineRollLoot(profile, normalKills, bossPlan) :
            { items: {}, cards: {}, itemCount: 0, cardCount: 0 };
        let safeRoom = Number.MAX_SAFE_INTEGER - Math.max(0, Number(player.gold) || 0);
        gold = Math.min(gold, Math.max(0, safeRoom));
        if ((player.lv || 1) < 100 && exp > 0) {
            player.exp = Math.max(0, Number(player.exp) || 0) + exp;
            if (typeof checkLvUp === 'function') checkLvUp();
        } else {
            exp = 0;
        }
        player.gold = Math.max(0, Number(player.gold) || 0) + gold;
        if (petExp > 0 && typeof petsGainExp === 'function') {
            try { petsGainExp(petExp); } catch (e) {}
        }
        _offlineApplyAllyExp(allyExp);
        if (kills > 0 && typeof pvpChangeAlignment === 'function') pvpChangeAlignment(kills);
        if (options.advanceCombatTime) _offlineAdvanceCombatTime(elapsed);

        _offlineResetRuntime(typeof mapState !== 'undefined' && mapState ? mapState.current : '');
        _offlinePrepareSnapshot(now);
        try { if (typeof calcStats === 'function') calcStats(); } catch (e) {}
        try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
        try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
        let savedOk = false;
        _offlineInternalSave = true;
        try { savedOk = _offlineOriginalSaveGame() === true; } finally { _offlineInternalSave = false; }
        _offlineLastBatchSavedOk = savedOk;
        let label = options.label || '離線收益';
        if (!savedOk && typeof logSys === 'function') {
            logSys('<span class="text-red-400 font-bold">' + label + '已套用至目前畫面，但存檔失敗，請立即再按一次存檔。</span>');
        }
        let result = {
            mapName: source.mapName || profile.mapName || source.map,
            elapsedMs: elapsed,
            capped: options.showModal === true && rawElapsed > OFFLINE_MAX_MS,
            exp: exp,
            gold: gold,
            kills: kills,
            bossKills: bossPlan.kills,
            items: loot.items,
            cards: loot.cards,
            itemCount: loot.itemCount,
            cardCount: loot.cardCount
        };
        if (typeof logSys === 'function' && options.catchupFormat) {
            logSys('<span class="text-cyan-300 font-bold">⏩ 掛機補跑完成：</span>已補上 ' +
                _offlineFormatCatchupDuration(elapsed) + ' 的進度' + (gold > 0 ? ('，金幣 +' + gold.toLocaleString()) : '') + '。');
            let gains = _offlineCatchupGainRows(loot);
            if (gains.length) logSys('<span class="sys-item-gain">掛機期間獲得：' + gains.join('、') + '</span>');
        } else if (typeof logSys === 'function') {
            logSys('<span class="text-amber-300 font-bold">' + label + '：</span>經驗 ' + exp.toLocaleString() +
                '、金幣 ' + gold.toLocaleString() + '、擊殺怪物 ' + kills.toLocaleString() +
                (bossPlan.kills > 0 ? ('（含頭目 ' + bossPlan.kills.toLocaleString() + '）') : '') +
                '、掉落物 ' + loot.itemCount.toLocaleString() + '、卡片 ' + loot.cardCount.toLocaleString() + '。');
        }
        if (options.showModal) _offlineShowSummary(result);
        return true;
    }

    function _offlineSettleCatchup(elapsedMs, reason) {
        if (_offlineSettling || _offlineLoading || typeof document === 'undefined' || document.hidden) return false;
        if (typeof player === 'undefined' || !player || !player.cls || typeof state === 'undefined' || !state.running) return true;
        let rawElapsed = Math.max(0, Math.floor(_offlineFinite(elapsedMs, 0)));
        if (rawElapsed < TICK_MS) return true;
        _offlineLastBatchSavedOk = false;
        _offlineSettling = true;
        try {
            let now = _offlineNow();
            let elapsed = rawElapsed;
            let saved = _offlineEnsureState();
            let map = typeof mapState !== 'undefined' && mapState ? String(mapState.current || '') : '';
            let profile = _offlineProfileForMap(saved, map);
            _offlineHiddenAt = 0;
            // 沒有合格實戰樣本時仍消耗背景時間與狀態，不退回逐 tick 補跑。
            if (!saved || !saved.eligible || saved.map !== map || !profile || profile.killsPerMin <= 0) {
                _offlineAdvanceCombatTime(elapsed);
                _offlineResetRuntime(map);
                _offlinePrepareSnapshot(now);
                try { if (typeof calcStats === 'function') calcStats(); } catch (e) {}
                try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
                try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
                _offlineInternalSave = true;
                try { _offlineLastBatchSavedOk = _offlineOriginalSaveGame() === true; } catch (e) {}
                finally { _offlineInternalSave = false; }
                return true;
            }
            if (!_offlineWriteClaimAt(now)) return false;
            return _offlineGrantBatch(saved, profile, elapsed, rawElapsed, 1, {
                now: now,
                label: '掛機結算',
                advanceCombatTime: true,
                catchupFormat: true,
                showModal: false
            });
        } finally {
            _offlineSettling = false;
        }
    }
    window.offlineSettleCatchup = _offlineSettleCatchup;

    function _offlineSettle(reason) {
        if (_offlineSettling || _offlineLoading || typeof document === 'undefined' || document.hidden) return false;
        if (typeof player === 'undefined' || !player || !player.cls || typeof state === 'undefined' || !state.running) return false;
        _offlineSettling = true;
        try {
            let now = _offlineNow();
            let saved = _offlineEnsureState();
            let checkpoint = _offlineReadJson(_offlineStoreKey('checkpoint'));
            let cpSnapshot = checkpoint && checkpoint.snapshot && typeof checkpoint.snapshot === 'object' ? checkpoint.snapshot : null;
            let cpActive = checkpoint ? Math.max(0, Math.floor(_offlineFinite(checkpoint.lastActive, 0))) : 0;
            if (cpActive > now + 5 * 60 * 1000) cpActive = now;

            let source = saved;
            if (cpSnapshot && cpActive >= (saved.awaySince || 0)) {
                source = {
                    eligible: cpSnapshot.eligible === true,
                    awaySince: Math.max(0, Math.floor(_offlineFinite(cpSnapshot.awaySince, cpActive))),
                    map: cpSnapshot.map ? String(cpSnapshot.map) : '',
                    mapName: cpSnapshot.mapName ? String(cpSnapshot.mapName) : '',
                    profile: _offlineProfile(cpSnapshot.profile)
                };
            }
            let claimAt = _offlineReadClaimAt(now);
            let from = Math.max(0, source.awaySince || 0, cpActive || 0, claimAt || 0);
            if (from > now) from = now;
            let rawElapsed = Math.max(0, now - from);
            let elapsed = Math.min(rawElapsed, OFFLINE_MAX_MS);
            let profile = _offlineProfile(source.profile);

            if (!source.eligible || !profile || profile.map !== source.map || elapsed < OFFLINE_MIN_MS || profile.killsPerMin <= 0) {
                _offlineResetRuntime(typeof mapState !== 'undefined' && mapState ? mapState.current : '');
                _offlinePrepareSnapshot(now);
                return false;
            }
            // 先占用時間區間，避免同角色多分頁或重新匯入同一快照重複領取。
            if (!_offlineWriteClaimAt(now)) return false;
            return _offlineGrantBatch(source, profile, elapsed, rawElapsed, OFFLINE_EFFICIENCY, {
                now: now,
                label: '離線收益',
                allowBosses: true,
                advanceCombatTime: false,
                showModal: true
            });
        } finally {
            _offlineSettling = false;
            try { _offlineRestorePendingCatchup(); } catch (e) {}
        }
    }

    const _offlineOriginalKillMob = window.killMob;
    if (typeof _offlineOriginalKillMob === 'function') {
        window.killMob = function (idx) {
            let map = typeof mapState !== 'undefined' && mapState ? String(mapState.current || '') : '';
            let mob = mapState && mapState.mobs ? mapState.mobs[idx] : null;
            // 真實補跑（state.ff）會逐 tick 正常給獎，但不能拿壓縮執行的牆鐘時間建立離線速率或 BOSS 擊殺時間證明。
            let foreground = !(typeof state !== 'undefined' && state && state.ff);
            let validMob = foreground && _offlineValidMob(mob, map);
            let validBoss = foreground && _offlineValidBoss(mob, map);
            let tracked = validMob || validBoss;
            let beforeGold = tracked ? Math.max(0, Number(player.gold) || 0) : 0;
            let beforeProgress = tracked ? _offlineExpProgress(player.lv, player.exp) : 0;
            let partyExp = tracked ? _offlineExpectedPartyExp(mob) : { pet: 0, ally: 0 };
            let bossPetBefore = null;
            let bossAllyBefore = null;
            if (validBoss) {
                try {
                    if (typeof _ffPetProgressSum === 'function') bossPetBefore = _ffPetProgressSum();
                    if (typeof _ffAllyProgress === 'function' && Array.isArray(player.allies)) {
                        bossAllyBefore = player.allies.reduce((sum, ally) =>
                            sum + (ally ? _ffAllyProgress(ally) : 0), 0);
                    }
                } catch (e) {
                    bossPetBefore = null;
                    bossAllyBefore = null;
                }
            }
            let result = _offlineOriginalKillMob.apply(this, arguments);
            if (tracked && mob && mob._dead) {
                let afterProgress = _offlineExpProgress(player.lv, player.exp);
                let now = _offlineNow();
                let expGain = afterProgress - beforeProgress;
                let goldGain = Math.max(0, (Number(player.gold) || 0) - beforeGold);
                if (validBoss) {
                    let petGain = partyExp.pet;
                    let allyGain = partyExp.ally;
                    try {
                        if (bossPetBefore != null && typeof _ffPetProgressSum === 'function') {
                            petGain = Math.max(0, _ffPetProgressSum() - bossPetBefore);
                        }
                        if (bossAllyBefore != null && typeof _ffAllyProgress === 'function' && Array.isArray(player.allies)) {
                            let allyAfter = player.allies.reduce((sum, ally) =>
                                sum + (ally ? _ffAllyProgress(ally) : 0), 0);
                            allyGain = Math.max(0, allyAfter - bossAllyBefore);
                        }
                    } catch (e) {}
                    try {
                        _offlineRecordBossKill(mob, map, expGain, goldGain, petGain, allyGain, now);
                    } catch (e) {
                        try { console.warn('[offline] boss profile update failed', e); } catch (_) {}
                    }
                } else {
                    _offlineRecordKill(mob, map, expGain, goldGain, partyExp.pet, partyExp.ally, now);
                }
            }
            return result;
        };
    }

    const _offlineOriginalChangeMap = window.changeMap;
    if (typeof _offlineOriginalChangeMap === 'function') {
        window.changeMap = function () {
            let before = typeof mapState !== 'undefined' && mapState ? String(mapState.current || '') : '';
            let result = _offlineOriginalChangeMap.apply(this, arguments);
            let after = typeof mapState !== 'undefined' && mapState ? String(mapState.current || '') : '';
            if (after !== before || !_offlineRuntime) _offlineResetRuntime(after);
            return result;
        };
    }

    const _offlineOriginalSaveGame = window.saveGame;
    if (typeof _offlineOriginalSaveGame === 'function') {
        window.saveGame = function () {
            if (!_offlineInternalSave && typeof catchupActive === 'function' && catchupActive()) {
                if (typeof deferCatchupSave === 'function') return deferCatchupSave();
                return false;
            }
            if (!_offlineInternalSave && !_offlineLoading && typeof player !== 'undefined' && player && player.cls) {
                _offlinePrepareSnapshot(_offlineNow());
            }
            let result = _offlineOriginalSaveGame.apply(this, arguments);
            if (result === true && _offlineRestoredCatchupKey) _offlineCommitRestoredCatchup();
            return result;
        };
    }

    const _offlineOriginalLoadGame = window.loadGame;
    if (typeof _offlineOriginalLoadGame === 'function') {
        window.loadGame = function () {
            _offlineLoading = true;
            let result;
            try {
                result = _offlineOriginalLoadGame.apply(this, arguments);
            } finally {
                _offlineLoading = false;
            }
            _offlineResetRuntime(typeof mapState !== 'undefined' && mapState ? mapState.current : '');
            setTimeout(function () { _offlineSettle('load'); }, 0);
            return result;
        };
    }

    function _offlinePauseAndSave() {
        if (typeof player === 'undefined' || !player || !player.cls || _offlineLoading || _offlineSettling) return;
        _offlinePrepareSnapshot(_offlineNow());
        _offlineInternalSave = true;
        try { _offlineOriginalSaveGame(); } catch (e) {}
        finally { _offlineInternalSave = false; }
    }

    function _offlineCloseAndSave() {
        if (typeof player === 'undefined' || !player || !player.cls || _offlineLoading || _offlineSettling) return;
        let now = _offlineNow();
        _offlineRememberPendingCatchup(now);
        _offlinePrepareSnapshot(now, true);
        _offlineInternalSave = true;
        try { _offlineOriginalSaveGame(); } catch (e) {}
        finally { _offlineInternalSave = false; }
    }

    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                if (!_offlineHiddenAt) _offlineHiddenAt = _offlineNow();
                _offlinePauseAndSave();
            } else {
                // 分頁仍開著時回前景只重置離線快照；實際背景進度交由補跑軌處理。
                //    ⚠️ 重置（awaySince 拉回現在＋清空取樣 runtime）不可省——補幀已 100% 補過的時段若留著舊 awaySince，
                //       之後一關頁就會被離線結算再算一次（重複入帳）；runtime 不清則取樣窗跨過背景空窗、速率被稀釋。
                _offlineHiddenAt = 0;
                _offlineResetRuntime(typeof mapState !== 'undefined' && mapState ? mapState.current : '');
                _offlinePrepareSnapshot(_offlineNow());
            }
        });
    }
    if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('pagehide', function (ev) {
            if (ev && ev.persisted) _offlinePauseAndSave();
            else _offlineCloseAndSave();
        });
        window.addEventListener('beforeunload', _offlineCloseAndSave);
        window.addEventListener('pageshow', function (ev) {
            if (document.hidden) return;
            _offlineHiddenAt = 0;
            if (ev && ev.persisted) {
                _offlineResetRuntime(typeof mapState !== 'undefined' && mapState ? mapState.current : '');
                _offlinePrepareSnapshot(_offlineNow());
                return;
            }
            setTimeout(function () { _offlineSettle('pageshow'); }, 0);
        });
    }

    setInterval(function () {
        if (typeof document === 'undefined' || document.hidden || _offlineLoading || _offlineSettling) return;
        if (typeof state === 'undefined' || !state || !state.running || typeof player === 'undefined' || !player || !player.cls) return;
        _offlinePrepareSnapshot(_offlineNow());
    }, OFFLINE_HEARTBEAT_MS);
})();
