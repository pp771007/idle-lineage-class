// ===== 真正離線收益（獨立於戰鬥 tick，不補幀、不模擬戰鬥）=====
// 公式：同地圖最近實戰每分鐘產出 × 可結算分鐘 × 70%。
// 最短離線 1 分鐘、最多結算 12 小時；依實戰怪物組成抽取一般掉落、卡片與已證明可擊敗的隨機頭目。
// PVP、任務專用品與活動事件不做離線抽取，避免事件重複觸發。
// 混合制：「真正關閉網頁後重開」走 70% 離線收益；切分頁、縮小與 bfcache 還原由 gameLoop 逐 tick 真實補跑。
// 若玩家在背景中直接關頁，關頁前的背景時間另存並於下次載入批次結算，離線收益只從真正關頁時刻開始。
(function () {
    'use strict';

    const OFFLINE_VERSION = 6;
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
    // 🐉 v3.7.90 四大龍：擊敗各有 10% 掉「頑皮／淘氣幼龍蛋」（線上 js/05:435-443·新增龍要同步這裡）
    const OFFLINE_DRAGON_EGG_MOBS = ['安塔瑞斯', '法利昂', '巴拉卡斯', '林德拜爾'];
    // 🧪 v3.7.90 自動買藥的金幣保留比例：離線一次結算沒有中途煞車，最多只動用 (1-此值) 的金幣，
    //   避免掛機 12 小時回來金幣被買藥花光（線上是逐次觸發·玩家看得到隨時能停）。
    const OFFLINE_GOLD_RESERVE_PCT = 0.20;
    // 💀 v3.7.90 潛在暴斃率：deathRatePerHour 只從「實際死過」累積，沒死過的角色離線幾乎不會死
    //   （平均 HP 壓力為負時＝永不死），與線上仍有小機率翻車不符。改用實測 minHpPct 當風險代理：
    //   線上最低血量沒掉破 OFFLINE_LATENT_DEATH_HP_PCT 就維持 0（行為完全不變）；越接近 0 風險越高。
    //   ⚠️ 僅在「毫無實際死亡紀錄」時作為地板值套用——只要死過一次，實測值一律優先。
    //   ⚠️ minHpPct 是「取最小值」的棘輪、不會回升，故上限刻意壓低；要調手感改這兩個常數即可。
    //   實測校準（12 小時掛機存活率）：最低血 30%→98.8%／20%→89.6%／10%→74%／5%→64%。
    //   ⚠️ 0.5 曾試過＝10% 血時 12 小時只剩 4.7% 存活＝棘輪下的終身死刑，過兇，勿調回。
    const OFFLINE_LATENT_DEATH_HP_PCT = 0.35;
    const OFFLINE_LATENT_DEATH_MAX_PER_HOUR = 0.05;

    let _offlineRuntime = null;
    let _offlineLoading = false;
    let _offlineSettling = false;
    let _offlineInternalSave = false;
    let _offlineRestoredCatchupKey = '';
    let _offlineLastBatchSavedOk = false;
    let _offlineRoleDetached = false;
    let _offlineSurvivalRuntime = null;
    let _offlineSurvivalTickCtx = null;
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
            // 🩹 v3.7.90 頭目旗標：離線掉落要能分辨頭目（萬能藥 1% vs 0.01%、席琳結晶 0.0001 vs 0.00001）。
            //   ⚠️ 預設 true 而非 false——bosses 陣列裡的每一筆按定義都是頭目，舊存檔沒有這個欄位時
            //   若預設 false，玩家得重新打一次該頭目才會套到修正。
            boss: raw.boss !== false,
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

    function _offlineSurvivalProfile(raw) {
        if (!raw || typeof raw !== 'object' || !(Number(raw.sampleMs) > 0)) return null;
        return {
            sampleMs: Math.max(0, Math.floor(_offlineFinite(raw.sampleMs, 0))),
            damagePerMin: _offlineClamp(raw.damagePerMin, 0, OFFLINE_MAX_EXP_PER_MIN),
            healingPerMin: _offlineClamp(raw.healingPerMin, 0, OFFLINE_MAX_EXP_PER_MIN),
            potionHealPerMin: _offlineClamp(raw.potionHealPerMin, 0, OFFLINE_MAX_EXP_PER_MIN),
            potionPerMin: _offlineClamp(raw.potionPerMin, 0, OFFLINE_MAX_KILLS_PER_MIN),
            potionId: raw.potionId ? String(raw.potionId) : '',
            deathRatePerHour: _offlineClamp(raw.deathRatePerHour, 0, 60),
            deaths: Math.max(0, Math.floor(_offlineFinite(raw.deaths, 0))),
            // 🩹 v3.7.90 缺欄必須預設 1（＝毫無危險證據）。_offlineClamp 的 fallback 是下界 0，
            //   舊存檔沒有這個欄位會被讀成「曾掉到 0% 血」→ 接上潛在暴斃率後全部既有存檔立刻吃滿風險。
            minHpPct: _offlineClamp(raw.minHpPct == null ? 1 : raw.minHpPct, 0, 1),
            updatedAt: Math.max(0, Math.floor(_offlineFinite(raw.updatedAt, 0)))
        };
    }

    // 💀 v3.7.90 由實測最低血量推導潛在暴斃率（次/小時）。回傳 0＝沿用原行為（不會死）。
    function _offlineLatentDeathRate(minHpPct) {
        let p = _offlineClamp(minHpPct == null ? 1 : minHpPct, 0, 1);
        if (p >= OFFLINE_LATENT_DEATH_HP_PCT) return 0;
        let risk = (OFFLINE_LATENT_DEATH_HP_PCT - p) / OFFLINE_LATENT_DEATH_HP_PCT;   // 0~1
        return risk * risk * OFFLINE_LATENT_DEATH_MAX_PER_HOUR;                        // 平方＝越接近全滅才明顯上升
    }

    function _offlineProfile(raw) {
        if (!raw || typeof raw !== 'object' || !raw.map) return null;
        return {
            map: String(raw.map),
            mapName: String(raw.mapName || _offlineMapName(raw.map)),
            bossRoom: raw.bossRoom === true,
            bossCycleMs: Math.max(0, Math.floor(_offlineFinite(raw.bossCycleMs, 0))),
            survival: _offlineSurvivalProfile(raw.survival),
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
            bossUnlocked: raw.bossUnlocked !== false,
            bossUnlockedAt: Math.max(0, Math.floor(_offlineFinite(raw.bossUnlockedAt, 0))),
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
        _offlineResetSurvivalRuntime(map);
    }

    function _offlineResetSurvivalRuntime(map) {
        let hp = typeof player !== 'undefined' && player ? Math.max(0, Number(player.hp) || 0) : 0;
        let mhp = typeof player !== 'undefined' && player ? Math.max(1, Number(player.mhp) || 1) : 1;
        _offlineSurvivalRuntime = {
            map: String(map || ''), activeMs: 0, damage: 0, healing: 0,
            potionHealing: 0, potionUses: 0, potionCounts: Object.create(null), potionHeals: Object.create(null),
            deaths: 0, minHpPct: _offlineClamp(hp / mhp, 0, 1),
            lastHp: hp, lastTick: -1, deathTick: -1,
            baseSurvival: null, baseSet: false
        };
        _offlineSurvivalTickCtx = null;
    }

    function _offlineValidHuntMap(map) {
        if (!map || String(map).indexOf('town_') === 0) return false;
        if (/^antharas_(?:nest_[123]|lair)$/.test(String(map))) return false;   // 🐉 v3.7.61 安塔瑞斯副本禁止離線掛機
        // 🏰 v3.7.91 城戰 V2 戰場禁止離線掛機（用戶指示：攻城區一律不可離線）。
        //   ⚠️ 這兩行不是多餘的：`siege_v2_*` 目前沒註冊進 DB.maps，先前是「靠下面那道 DB.maps 檢查
        //   間接擋住」——哪天有人把戰場登記進 DB.maps（例如補出怪池），這道閘就會無聲打開。
        //   以 SiegeV2.stages 為單一真相，再加前綴保險（js/30 尚未載入時 typeof 守衛會跳過第一條）。
        if (typeof SiegeV2 !== 'undefined' && SiegeV2 && Array.isArray(SiegeV2.stages) &&
            SiegeV2.stages.some(s => s && s.map === map)) return false;
        if (String(map).indexOf('siege_v2_') === 0) return false;
        if (typeof DB === 'undefined' || !DB.maps || !Array.isArray(DB.maps[map])) return false;
        if (typeof isSiegeArea === 'function' && isSiegeArea(map)) return false;   // 🏰 舊制攻城外門/內城（六張·在 DB.maps 內）
        if (/^pride_f\d+$/.test(map) || map === 'rift_battle') return false;
        return true;
    }

    function _offlineBossRoomMap(map) {
        return typeof PURE_BOSS_MAPS !== 'undefined' && Array.isArray(PURE_BOSS_MAPS) && PURE_BOSS_MAPS.includes(map);
    }

    function _offlineCanSnapshot(now, profile) {
        if (typeof state === 'undefined' || !state || !state.running) return false;
        if (typeof player === 'undefined' || !player || !player.cls || player.dead) return false;
        if (typeof currentRoleIsMercenary === 'function' && currentRoleIsMercenary()) return false;
        if (!player.offlineHunt) return false;
        if (typeof mapState === 'undefined' || !mapState || !_offlineValidHuntMap(mapState.current)) return false;
        // 死亡後只鎖離線頭目戰；普通狩獵區復活後仍可重新建立掛機快照。
        if (player.offlineHunt.bossUnlocked === false && _offlineBossRoomMap(mapState.current)) return false;
        if (player.siege && player.siege.active) return false;
        if (state.prideClimb || state.riftRun) return false;
        if (!profile || profile.map !== String(mapState.current) || profile.killsPerMin <= 0) return false;
        if (_offlineRuntime && _offlineRuntime.map === String(mapState.current) && _offlineRuntime.lastKillAt > 0 &&
            now - _offlineRuntime.lastKillAt > OFFLINE_RECENT_KILL_MS) return false;
        return true;
    }

    function _offlineValidMob(mob, map) {
        if (!mob || mob._dead || !_offlineValidHuntMap(map)) return false;
        if (_offlineBossRoomMap(map)) return false;
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

    function _offlineSurvivalTrackable() {
        return typeof state !== 'undefined' && state && state.running && !state.ff &&
            typeof player !== 'undefined' && player && player.cls && !player.dead &&
            typeof mapState !== 'undefined' && mapState && _offlineValidHuntMap(mapState.current) &&
            !(player.siege && player.siege.active) && !state.prideClimb && !state.riftRun;
    }

    function _offlineSurvivalSnapshot(map, previous, now, force) {
        let rt = _offlineSurvivalRuntime;
        previous = _offlineSurvivalProfile(previous);
        if (!rt || rt.map !== String(map || '')) return previous;
        if (!rt.baseSet) {
            rt.baseSurvival = previous;
            rt.baseSet = true;
        }
        if (!force && rt.activeMs < OFFLINE_SAMPLE_MIN_MS) return previous;
        let base = _offlineSurvivalProfile(rt.baseSurvival);
        let baseMs = base ? Math.min(base.sampleMs, 30 * 60 * 1000) : 0;
        let sampleMs = Math.max(1, baseMs + rt.activeMs);
        let total = (rate, ms) => Math.max(0, Number(rate) || 0) * ms / 60000;
        let damage = total(base && base.damagePerMin, baseMs) + rt.damage;
        let healing = total(base && base.healingPerMin, baseMs) + rt.healing;
        let potionId = base && base.potionId ? base.potionId : '';
        let dominantPotionUses = base && base.potionId ? total(base.potionPerMin, baseMs) : 0;
        Object.keys(rt.potionCounts).forEach(id => {
            let count = Math.max(0, Number(rt.potionCounts[id]) || 0);
            let candidate = count + (base && base.potionId === id ? total(base.potionPerMin, baseMs) : 0);
            if (candidate > dominantPotionUses) { dominantPotionUses = candidate; potionId = id; }
        });
        let basePotionUses = base ? total(base.potionPerMin, baseMs) : 0;
        let basePotionHeal = base ? total(base.potionHealPerMin, baseMs) : 0;
        let deathEvents = (base ? base.deathRatePerHour * baseMs / 3600000 : 0) + rt.deaths;
        return _offlineSurvivalProfile({
            sampleMs: sampleMs,
            damagePerMin: damage * 60000 / sampleMs,
            healingPerMin: healing * 60000 / sampleMs,
            potionHealPerMin: (basePotionHeal + rt.potionHealing) * 60000 / sampleMs,
            potionPerMin: (basePotionUses + rt.potionUses) * 60000 / sampleMs,
            potionId: potionId,
            deathRatePerHour: deathEvents * 3600000 / sampleMs,
            deaths: Math.round(deathEvents),
            minHpPct: Math.min(base ? base.minHpPct : 1, rt.minHpPct),
            updatedAt: now
        });
    }

    function _offlineAttachSurvival(profile, map, now, force) {
        profile = _offlineProfile(profile);
        if (!profile) return null;
        let survival = _offlineSurvivalSnapshot(map, profile.survival, now, force);
        return _offlineProfile(Object.assign({}, profile, { survival: survival }));
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
        let ally = Math.floor(base * (1 + bonus / 100));
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
        let wasLocked = st.bossUnlocked === false;
        let previous = _offlineProfileForMap(st, map) || {
            map: String(map), mapName: _offlineMapName(map), expPerMin: 0, goldPerMin: 0,
            killsPerMin: 0, petExpPerMin: 0, allyExpPerMin: 0, sampleMs: 0,
            mobs: [], bosses: [], sampleKills: 0, updatedAt: 0
        };
        previous = _offlineAttachSurvival(previous, map, now, false) || previous;
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
            boss: true,   // 🩹 v3.7.90 本路徑僅由 validBoss 進入＝必為頭目
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
        let remembered = _offlineRememberProfile(st, Object.assign({}, previous, {
            bosses: bosses.slice(0, OFFLINE_MAX_BOSS_PROFILES),
            updatedAt: now
        }));
        if (_offlineBossRoomMap(map)) remembered = _offlineRememberProfile(st, _offlineBuildBossRoomProfile(remembered, map, now));
        st.bossUnlocked = true;
        st.bossUnlockedAt = now;
        st.profile = remembered;
        _offlinePrepareSnapshot(now);
        _offlineInternalSave = true;
        try { if (typeof _offlineOriginalSaveGame === 'function') _offlineOriginalSaveGame(); } catch (e) {}
        finally { _offlineInternalSave = false; }
        if (wasLocked && typeof logSys === 'function') {
            logSys('<span class="text-emerald-300 font-bold">已擊敗頭目，離線頭目戰資格重新解鎖。</span>');
        }
    }

    function _offlineCommitProfile(now, st) {
        st = st || _offlineEnsureState();
        if (!st) return null;
        let currentMap = String(mapState && mapState.current || '');
        let previous = _offlineProfileForMap(st, currentMap);
        if (previous) {
            previous = _offlineAttachSurvival(previous, currentMap, now, false) || previous;
            previous = _offlineRememberProfile(st, Object.assign({}, previous, { updatedAt: now }));
        }
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
            survival: _offlineSurvivalSnapshot(rt.map, previous && previous.survival, now, false),
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
        // 🔄 v3.7.31 背景增量補跑架構修正：隱藏期間 gameLoop 仍被節流喚醒逐 tick 處理（且 5 分鐘自動存檔可能已落地），
        //    舊公式 hiddenMs＝closedAt−_offlineHiddenAt（整段隱藏時間）會把「已處理＋已存檔」的部分在重開時重複結算（雙重入帳）。
        //    未處理殘額＝runtime 債務（catchupPendingMs）＋「最後一次 gameLoop 之後」的尾段（同 js/01 差額錨點口徑）；
        //    _loopLast 從未跑過（隱藏中載入等）才退回整段隱藏時間。⚠️_loopLast/_perfNow＝performance.now 時域，勿與 closedAt(Date.now) 相減。
        let hiddenMs;
        if (typeof _loopLast !== 'undefined' && Number.isFinite(_loopLast) && _loopLast > 0 && typeof _perfNow === 'function') {
            hiddenMs = Math.max(0, _perfNow() - _loopLast);
        } else {
            hiddenMs = _offlineHiddenAt > 0 ? Math.max(0, closedAt - _offlineHiddenAt) : 0;
        }
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

    function _offlineBuildBossRoomProfile(profile, map, now) {
        profile = _offlineProfile(profile);
        if (!profile) return null;
        let pool = _offlineBossPool(map);
        let proofs = _offlineBossProfiles(profile.bosses).filter(row => pool.includes(row.n));
        if (!pool.length || pool.some(name => !proofs.some(row => row.n === name))) return profile;
        let cycleMs = 5000 + Math.max.apply(null, proofs.map(row => row.avgKillMs));
        cycleMs = _offlineClamp(cycleMs, TICK_MS, OFFLINE_MAX_MS);
        let perMin = 60000 / cycleMs;
        let sumField = field => proofs.reduce((sum, row) => sum + Math.max(0, Number(row[field]) || 0), 0);
        return _offlineProfile(Object.assign({}, profile, {
            map: String(map),
            mapName: _offlineMapName(map),
            bossRoom: true,
            bossCycleMs: cycleMs,
            killsPerMin: proofs.length * perMin,
            expPerMin: sumField('expPerKill') * perMin,
            goldPerMin: sumField('goldPerKill') * perMin,
            petExpPerMin: sumField('petExpPerKill') * perMin,
            allyExpPerMin: sumField('allyExpPerKill') * perMin,
            sampleMs: cycleMs,
            sampleKills: proofs.reduce((sum, row) => sum + row.wins, 0),
            mobs: proofs.map(row => _offlineMobProfile(Object.assign({ count: 1 }, row))).filter(Boolean),
            bosses: proofs,
            updatedAt: now
        }));
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

    function _offlineInventoryCount(id) {
        if (!id || !player || !Array.isArray(player.inv)) return 0;
        return player.inv.reduce((sum, item) => sum + (item && item.id === id ? Math.max(1, Number(item.cnt) || 1) : 0), 0);
    }

    function _offlineConsumeInventory(id, count) {
        count = Math.max(0, Math.floor(_offlineFinite(count, 0)));
        if (!id || !count || !player || !Array.isArray(player.inv)) return 0;
        let used = 0;
        for (let i = player.inv.length - 1; i >= 0 && used < count; i--) {
            let item = player.inv[i];
            if (!item || item.id !== id) continue;
            let have = Math.max(1, Math.floor(Number(item.cnt) || 1));
            let take = Math.min(have, count - used);
            if (take >= have) player.inv.splice(i, 1);
            else item.cnt = have - take;
            used += take;
        }
        return used;
    }

    // 🧪 v3.7.72「藥水不足自動買至100」納入離線續戰力（用戶指示）：離線前只算背包存量 → 有開自動購買的玩家
    //    藥水一「用完」就被判進高扣血段而提早死亡，與線上（缺貨即補到 100 瓶）嚴重不符。
    //    採用戶拍板的最保守算法：**只用離線開始時的金幣**，可買量 = floor(金幣 ÷ 單價)，不把離線期間賺的金幣算進來
    //    （`_offlineSurvivalPlan` 在 `_offlineGrantBatch` 開頭就跑，此時 player.gold 尚未加上離線收益＝天然就是「離線開始時」）。
    //    ⚠️ 只有「設定要喝的那瓶」才會被自動購買（js/07 autoActions 買的是 set-pot）；採樣到的主力藥水若不是它 → 不給補貨額度。
    function _offlineAutoBuyPotionPlan(potionId) {
        let plan = { unitPrice: 0, canBuy: 0 };
        if (!potionId || typeof player === 'undefined' || !player) return plan;
        let cfg = player.config || {};
        let enabled = cfg.setAutoBuyPot;
        if (enabled === undefined && typeof document !== 'undefined') {   // 舊存檔無此欄 → 退回讀 DOM 勾選
            let el = document.getElementById('set-auto-buy-pot');
            enabled = !!(el && el.checked);
        }
        if (!enabled) return plan;
        let want = cfg.setPot;
        if (want === undefined && typeof document !== 'undefined') {
            let sel = document.getElementById('set-pot');
            want = sel ? sel.value : '';
        }
        if (want && String(want) !== String(potionId)) return plan;   // 自動購買只補設定的那一瓶
        let d = typeof DB !== 'undefined' && DB.items ? DB.items[potionId] : null;
        if (!d) return plan;
        let unit = typeof shopPrice === 'function' ? shopPrice(d.p) : Number(d.p) || 0;   // 攻城獲勝 8 折同樣適用
        unit = Math.max(1, Math.floor(Number(unit) || 0));
        let gold = Math.max(0, Math.floor(Number(player.gold) || 0));
        // 🧪 v3.7.90 保留一部分金幣不投入自動買藥：離線是「一次結算完才知道」，沒有線上那種中途煞車。
        let spendable = Math.floor(gold * (1 - OFFLINE_GOLD_RESERVE_PCT));
        plan.unitPrice = unit;
        plan.canBuy = Math.floor(spendable / unit);
        return plan;
    }

    function _offlineSurvivalPlan(profile, elapsedMs, efficiency, consumePotions) {
        let result = {
            elapsedMs: Math.max(0, Math.floor(_offlineFinite(elapsedMs, 0))),
            combatMs: 0, died: false, deathAtMs: 0,
            potionId: '', potionUsed: 0, potionBought: 0, potionCost: 0
        };
        let survival = _offlineSurvivalProfile(profile && profile.survival);
        let eff = _offlineClamp(efficiency, 0, 1);
        if (!survival || !eff || !(survival.sampleMs > 0)) return result;
        let combatMs = result.elapsedMs * eff;
        let hp = Math.max(1, Number(player && player.hp) || 1);
        let mhp = Math.max(hp, Number(player && player.mhp) || hp);
        let damage = Math.max(0, survival.damagePerMin);
        let healing = Math.max(0, survival.healingPerMin);
        let potionHealing = Math.min(healing, Math.max(0, survival.potionHealPerMin));
        let nonPotionHealing = Math.max(0, healing - potionHealing);
        let potionRate = Math.max(0, survival.potionPerMin);
        let potionId = survival.potionId;
        let potionStock = potionId ? _offlineInventoryCount(potionId) : 0;
        // 🧪 v3.7.72 自動購買納入續戰力：有效庫存＝背包存量＋（離線開始時金幣 ÷ 單價）
        let autoBuy = _offlineAutoBuyPotionPlan(potionId);
        let effStock = potionStock + autoBuy.canBuy;
        // 實際扣庫存/扣金幣的單一真相：先用背包、不足的部分才算「自動購買」→ 回傳含 bought/cost 供結算顯示
        let settlePotions = (used) => {
            used = Math.max(0, Math.min(effStock, Math.floor(used) || 0));
            if (!consumePotions || used <= 0) return { used: used, bought: 0, cost: 0 };
            let fromInv = Math.min(potionStock, used);
            let bought = used - fromInv;
            let taken = fromInv > 0 ? _offlineConsumeInventory(potionId, fromInv) : 0;
            let cost = 0;
            if (bought > 0 && autoBuy.unitPrice > 0) {
                cost = Math.min(Math.max(0, Math.floor(Number(player.gold) || 0)), bought * autoBuy.unitPrice);
                bought = Math.floor(cost / autoBuy.unitPrice);   // 金幣不足以買滿時只買得起這麼多（正常不會發生·canBuy 已由金幣推導）
                cost = bought * autoBuy.unitPrice;
                player.gold = Math.max(0, (Number(player.gold) || 0) - cost);
            } else bought = 0;
            return { used: taken + bought, bought: bought, cost: cost };
        };
        let stockedMs = potionRate > 0 ? effStock / potionRate * 60000 : combatMs;
        // 💀 v3.7.90 實測死亡率一律優先；只有「從沒死過(=0)」才退到 minHpPct 推導的潛在暴斃率。
        let deathPerHour = Math.max(0, survival.deathRatePerHour) || _offlineLatentDeathRate(survival.minHpPct);
        let deathRoll = deathPerHour > 0 ? Math.max(1e-9, 1 - Math.random()) : 1;
        let nativePlanner = typeof window !== 'undefined' ? window.idleLineageNativeOffline : null;
        if (nativePlanner && typeof nativePlanner.planSurvival === 'function') {
            let nativePlan = nativePlanner.planSurvival({
                elapsedMs: result.elapsedMs,
                efficiency: eff,
                sampleMs: survival.sampleMs,
                currentHp: hp,
                maximumHp: mhp,
                damagePerMin: damage,
                healingPerMin: healing,
                potionHealPerMin: potionHealing,
                potionPerMin: potionRate,
                potionId: potionId,
                potionStock: effStock,   // 🧪 v3.7.72 原生規劃器同樣吃「含自動購買」的有效庫存
                deathRatePerHour: deathPerHour,   // 🩹 v3.7.90 原生規劃器吃同一個推導後的值，避免兩條路徑不一致
                deathRoll: deathRoll
            });
            if (nativePlan && Number.isFinite(nativePlan.elapsedMs) && nativePlan.elapsedMs >= 0 &&
                nativePlan.elapsedMs <= result.elapsedMs && Number.isFinite(nativePlan.combatMs) && nativePlan.combatMs >= 0 &&
                nativePlan.combatMs <= combatMs && Number.isFinite(nativePlan.deathAtMs) && nativePlan.deathAtMs >= 0 &&
                Number.isFinite(nativePlan.potionUsed) && nativePlan.potionUsed >= 0 && nativePlan.potionUsed <= effStock &&
                typeof nativePlan.died === 'boolean') {
                nativePlan.elapsedMs = Math.floor(nativePlan.elapsedMs);
                nativePlan.combatMs = Math.floor(nativePlan.combatMs);
                nativePlan.deathAtMs = Math.floor(nativePlan.deathAtMs);
                nativePlan.potionId = potionId;
                let nSettle = settlePotions(nativePlan.potionUsed);
                nativePlan.potionUsed = nSettle.used;
                nativePlan.potionBought = nSettle.bought;
                nativePlan.potionCost = nSettle.cost;
                return nativePlan;
            }
        }
        let deathCombatMs = Infinity;
        let elapsedCombat = 0;
        let runPressure = (duration, netPerMin) => {
            duration = Math.max(0, duration);
            if (!duration || deathCombatMs !== Infinity) return;
            if (netPerMin > 0) {
                let untilDeath = hp * 60000 / netPerMin;
                if (untilDeath <= duration) {
                    deathCombatMs = elapsedCombat + untilDeath;
                    return;
                }
            }
            hp = _offlineClamp(hp - netPerMin * duration / 60000, 1, mhp);
            elapsedCombat += duration;
        };
        let stockedDuration = Math.min(combatMs, stockedMs);
        runPressure(stockedDuration, damage - healing);
        if (deathCombatMs === Infinity && stockedDuration < combatMs) {
            runPressure(combatMs - stockedDuration, damage - nonPotionHealing);
        }
        if (deathPerHour > 0) {
            let empiricalDeathMs = -Math.log(deathRoll) * 3600000 / deathPerHour;
            deathCombatMs = Math.min(deathCombatMs, empiricalDeathMs);
        }
        let died = deathCombatMs <= combatMs;
        let survivedCombatMs = died ? Math.max(0, deathCombatMs) : combatMs;
        let survivedElapsedMs = died ? Math.max(0, Math.floor(survivedCombatMs / eff)) : result.elapsedMs;
        let potionWant = potionId && potionRate > 0 ?
            Math.max(0, Math.floor(potionRate * survivedCombatMs / 60000 + 1e-7)) : 0;
        let settled = settlePotions(potionWant);
        result.elapsedMs = survivedElapsedMs;
        result.combatMs = Math.floor(survivedCombatMs);
        result.died = died;
        result.deathAtMs = died ? survivedElapsedMs : 0;
        result.potionId = potionId;
        result.potionUsed = settled.used;
        result.potionBought = settled.bought;   // 🧪 v3.7.72 其中自動購買的瓶數
        result.potionCost = settled.cost;       // 🧪 v3.7.72 自動購買花掉的金幣（已即時從 player.gold 扣除）
        return result;
    }

    function _offlineBossRoomCostId(map) {
        if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS && KING_ROOMS[map]) {
            return KING_ROOMS[map].key || 'item_king_key';
        }
        if (typeof SANCT_RESPAWN_COST !== 'undefined' && SANCT_RESPAWN_COST && SANCT_RESPAWN_COST[map]) {
            return SANCT_RESPAWN_COST[map];
        }
        return '';
    }

    function _offlineBossRoomPlan(profile, elapsedMs, efficiency, consumeCost) {
        let result = { rows: [], kills: 0, cycles: 0, timeMs: 0, exp: 0, gold: 0, petExp: 0, allyExp: 0, costId: '', costUsed: 0 };
        if (!profile || profile.bossRoom !== true) return result;
        let pool = _offlineBossPool(profile.map);
        let proofs = _offlineBossProfiles(profile.bosses).filter(row => pool.includes(row.n));
        if (!pool.length || pool.some(name => !proofs.some(row => row.n === name))) return result;
        let cycleMs = _offlineClamp(profile.bossCycleMs || (5000 + Math.max.apply(null, proofs.map(row => row.avgKillMs))), TICK_MS, OFFLINE_MAX_MS);
        let costId = _offlineBossRoomCostId(profile.map);
        let availableEntries = costId ? _offlineInventoryCount(costId) : -1;
        let nativePlanner = typeof window !== 'undefined' ? window.idleLineageNativeOffline : null;
        let nativeCycles = nativePlanner && typeof nativePlanner.bossRoomCycles === 'function' ?
            nativePlanner.bossRoomCycles(elapsedMs, efficiency, cycleMs, availableEntries) : null;
        let cycles = Number.isFinite(nativeCycles) ? Math.max(0, Math.floor(nativeCycles)) :
            Math.floor(Math.max(0, _offlineFinite(elapsedMs, 0)) * _offlineClamp(efficiency, 0, 1) / cycleMs);
        if (costId) cycles = Math.min(cycles, _offlineInventoryCount(costId));
        if (!cycles) return result;
        if (costId && consumeCost) {
            let used = _offlineConsumeInventory(costId, cycles);
            cycles = Math.min(cycles, used);
            result.costUsed = used;
        }
        if (!cycles) return result;
        result.costId = costId;
        result.cycles = cycles;
        result.timeMs = Math.floor(cycleMs * cycles);
        proofs.forEach(proof => {
            result.rows.push({ mob: proof, kills: cycles });
            result.kills += cycles;
            result.exp += Math.floor(proof.expPerKill * cycles);
            result.gold += Math.floor(proof.goldPerKill * cycles);
            result.petExp += Math.floor(proof.petExpPerKill * cycles);
            result.allyExp += Math.floor(proof.allyExpPerKill * cycles);
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

    function _offlineRollCards(mob, kills, loot, party) {
        if (mob.race === '血盟' || mob.race === '建築' || mob.transformTo ||
            typeof CARD_MOB_INFO === 'undefined' || !CARD_MOB_INFO[mob.n]) return;
        let names = (typeof CARD_CHAIN_BY_FINAL !== 'undefined' && CARD_CHAIN_BY_FINAL[mob.n]) || [mob.n];
        [[3, 0.00001], [2, 0.0001], [1, 0.001]].forEach(row => {
            let count = _offlineBinomial(kills, Math.min(1, row[1] * party));
            let split = _offlineSplitUniform(names, count);
            Object.keys(split).forEach(name => _offlineGrantCard(name, row[0], split[name], loot));
        });
    }

    function _offlineRollMobLoot(mob, kills, map, loot) {
        let dropBase = mob.grace ? 10 : (mob.sherine ? (mob.sherineMad ? 5 : 3) : 1);
        let classic = typeof classicDropMult === 'function' ? classicDropMult() : 1;
        let party = typeof partyRewardMult === 'function' ? Math.max(1, Number(partyRewardMult()) || 1) : 1;
        let dropMult = dropBase * classic * party;
        let oldSherine = _sherineLootCtx;
        let oldForceBless = _forceBless;
        try {
            _sherineLootCtx = mob.sherine ? { mad: !!mob.sherineMad } : null;
            if (typeof MOB_DROPS !== 'undefined') _offlineRollTable(mob, kills, MOB_DROPS, dropBase * party, loot, true);
            // 🩹 v3.7.90 對照線上 js/05:463-465：閘門＝!siegeV2 && lv>=40 && race!=='血盟'；
            //   機率＝頭目 1%（夢幻之島頭目 0）／一般 0.01%。原本一律用 0.0001 且無 race 閘
            //   → 頭目短缺 100 倍、血盟怪反而多掉（線上根本不掉）。
            if (mob.lv >= 40 && mob.race !== '血盟' && !mob.siegeV2) {
                let panRate = mob.boss ? (map === 'dream_island' ? 0 : 0.01) : 0.0001;
                if (panRate > 0) {
                    let panacea = _offlineBinomial(kills, Math.min(1, panRate * classic * party));
                    let split = _offlineSplitUniform(['panacea_str','panacea_dex','panacea_con','panacea_int','panacea_wis','panacea_cha'], panacea);
                    Object.keys(split).forEach(id => _offlineGainItem(id, split[id], mob, loot));
                }
            }
            let refine = Array.isArray(player.skills) && player.skills.includes('sk_dark_refine');
            if (map === 'silent_outer') {
                _offlineGainItem('mat_blackstone2', _offlineBinomial(kills, Math.min(1, (refine ? 0.30 : 0.20) * classic * party)), mob, loot);
                _offlineGainItem('mat_blackstone3', _offlineBinomial(kills, Math.min(1, (refine ? 0.15 : 0.10) * classic * party)), mob, loot);
            } else if (refine && typeof mapCategoryOf === 'function' && ['wild','dungeon'].includes(mapCategoryOf(map))) {
                _offlineGainItem('mat_blackstone2', _offlineBinomial(kills, Math.min(1, 0.01 * classic * party)), mob, loot);
                _offlineGainItem('mat_blackstone3', _offlineBinomial(kills, Math.min(1, 0.005 * classic * party)), mob, loot);
                _offlineGainItem('mat_blackstone4', _offlineBinomial(kills, Math.min(1, 0.001 * classic * party)), mob, loot);
            }
            let oreRates = { '石頭高崙':1, '鋼鐵高崙':1, '侏儒':0.5, '侏儒戰士':0.5, '黑騎士':0.5, '哈柏哥布林':0.5, '蜥蜴人':0.5 };
            if (oreRates[mob.n]) _offlineGainItem('mat_silverore', _offlineBinomial(kills, Math.min(1, oreRates[mob.n] * classic * party)), mob, loot);
            if (player.inv.some(i => i.id === 'item_dk_insignia') && typeof mapRegionOf === 'function' && mapRegionOf(map) === 'rastabad') {
                _offlineGainItem('mat_holy_relic', _offlineBinomial(kills, Math.min(1, 0.001 * classic * party)), mob, loot);
            }
            if (typeof DARK_WEAPON_DROPS !== 'undefined') _offlineRollTable(mob, kills, DARK_WEAPON_DROPS, dropMult, loot, false);
            if (typeof DARK_CRYSTAL_DROPS !== 'undefined') _offlineRollTable(mob, kills, DARK_CRYSTAL_DROPS, dropMult, loot, false);
            if (typeof DRAGON_DROPS !== 'undefined') _offlineRollTable(mob, kills, DRAGON_DROPS, dropBase * party, loot, false);
            if (typeof WARRIOR_DROPS !== 'undefined') _offlineRollTable(mob, kills, WARRIOR_DROPS, dropMult, loot, false);
            if (typeof MEM_DROPS !== 'undefined') _offlineRollTable(mob, kills, MEM_DROPS, dropMult, loot, false);
            _offlineRollCards(mob, kills, loot, party);
            if (typeof AREA_BONUS_MAPS !== 'undefined' && AREA_BONUS_MAPS.includes(map) &&
                typeof AREA_BONUS_ITEMS !== 'undefined') {
                let worldTree = Array.isArray(player.skills) && player.skills.includes('sk_elf_worldtree');
                AREA_BONUS_ITEMS.forEach(id => {
                    let baseRate = id === 'new_item_195' ? (worldTree ? 0.30 : 0.20) : (worldTree ? 0.03 : 0.02);
                    _offlineGainItem(id, _offlineBinomial(kills, Math.min(1, baseRate * dropMult)), mob, loot);
                });
            }
            if (mob.sherine) {
                // 🩹 v3.7.90 補頭目倍率（線上 js/05:534 是 mob.boss ? 0.0001 : 0.00001）——原本一律 0.00001＝頭目短缺 10 倍。
                let rate = (mob.boss ? 0.0001 : 0.00001) * mob.lv * (mob.sherineMad ? 3 : 1) * classic * party;
                _offlineGainItem('sherine_crystal', _offlineBinomial(kills, Math.min(1, rate)), mob, loot);
            }
            // 🐉 v3.7.90 補四大龍幼龍蛋（線上 js/05:435-443）：兩顆各獨立 10%、不吃經典掉率、吃隊伍倍率。原本離線完全不掉。
            if (OFFLINE_DRAGON_EGG_MOBS.indexOf(mob.n) !== -1) {
                _offlineGainItem('item_dragon_egg', _offlineBinomial(kills, Math.min(1, 0.10 * party)), mob, loot);
                _offlineGainItem('item_dragon_egg2', _offlineBinomial(kills, Math.min(1, 0.10 * party)), mob, loot);
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
        let potionName = result.potionId && DB.items[result.potionId] ? DB.items[result.potionId].n : result.potionId;
        let overlay = document.createElement('div');
        overlay.id = 'offline-reward-modal';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10080;background:rgba(2,6,23,.78);display:flex;align-items:center;justify-content:center;padding:16px;';
        overlay.innerHTML =
            '<div style="width:min(460px,100%);max-height:90vh;overflow:auto;border:1px solid #a16207;border-radius:8px;background:#171923;color:#e5e7eb;box-shadow:0 18px 60px #000c;padding:20px;">' +
                '<div style="font-size:22px;font-weight:700;color:#fde68a;border-bottom:1px solid #4b5563;padding-bottom:10px;margin-bottom:14px;">離線收益</div>' +
                '<div style="color:#cbd5e1;line-height:1.7;margin-bottom:12px;">' +
                    '<div>狩獵區：<span style="color:#93c5fd;">' + _offlineEsc(result.mapName) + '</span></div>' +
                    '<div>離線時間：' + _offlineFormatDuration(result.requestedElapsedMs || result.elapsedMs) + (result.capped ? '（已達 12 小時上限）' : '') + '</div>' +
                    (result.died ? '<div style="color:#fca5a5;font-weight:700;">戰鬥 ' + _offlineFormatDuration(result.elapsedMs) + ' 後死亡，後續收益停止。</div>' : '') +
                '</div>' +
                '<div style="display:grid;grid-template-columns:1fr auto;gap:8px 14px;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:12px;">' +
                    (result.died ? '<span>離線結果</span><b style="color:#f87171;">戰鬥中死亡</b>' : '') +
                    '<span>獲得經驗</span><b style="color:#86efac;">' + result.exp.toLocaleString() + '</b>' +
                    '<span>獲得金幣</span><b style="color:#fde047;">' + result.gold.toLocaleString() + '</b>' +
                    '<span>擊殺怪物</span><b style="color:#c4b5fd;">' + result.kills.toLocaleString() + '</b>' +
                    (result.bossKills > 0 ? '<span>擊殺頭目</span><b style="color:#fca5a5;">' + result.bossKills.toLocaleString() + '</b>' : '') +
                    '<span>掉落物品</span><b style="color:#fef08a;">' + result.itemCount.toLocaleString() + '</b>' +
                    '<span>怪物卡片</span><b style="color:#93c5fd;">' + result.cardCount.toLocaleString() + '</b>' +
                    (result.potionUsed > 0 ? '<span>消耗藥水</span><b style="color:#fda4af;">' + _offlineEsc(potionName) + ' × ' + result.potionUsed.toLocaleString() + '</b>' : '') +
                    (result.potionBought > 0 ? '<span>自動購買藥水</span><b style="color:#fdba74;">' + result.potionBought.toLocaleString() + ' 瓶（-' + result.potionCost.toLocaleString() + ' 金幣）</b>' : '') +   // 🧪 v3.7.72
                '</div>' +
                '<div style="margin-top:12px;padding:12px;border:1px solid #334155;border-radius:6px;background:#111827;line-height:1.65;font-size:14px;">' +
                    '<div style="font-weight:700;color:#fcd34d;margin-bottom:6px;">離線戰利品</div>' + _offlineLootHtml(result) + '</div>' +
                '<button type="button" onclick="document.getElementById(\'offline-reward-modal\').remove()" style="width:100%;height:42px;margin-top:16px;border:1px solid #d97706;border-radius:6px;background:#78350f;color:#fef3c7;font-weight:700;cursor:pointer;">確認</button>' +
            '</div>';
        document.body.appendChild(overlay);
    }

    function _offlineRewardAmount(ratePerMin, elapsedMs, efficiency) {
        let nativePlanner = typeof window !== 'undefined' ? window.idleLineageNativeOffline : null;
        if (nativePlanner && typeof nativePlanner.rewardAmount === 'function') {
            let nativeValue = nativePlanner.rewardAmount(ratePerMin, elapsedMs, efficiency);
            if (Number.isFinite(nativeValue) && nativeValue >= 0) return Math.floor(nativeValue);
        }
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

    function _offlineApplySettledDeath() {
        if (!player) return;
        player.hp = 0;
        player.dead = true;
        player.summon = null;
        player.charmed = null;
        if (Array.isArray(player.summonsV2)) player.summonsV2 = [];
        if (player.buffs) player.buffs.sk_charm = 0;
        try {
            let revive = document.getElementById('btn-revive');
            if (revive) revive.classList.remove('hidden');
            if (typeof updateReviveInPlaceBtn === 'function') updateReviveInPlaceBtn();
            if (typeof renderSummonPanel === 'function') renderSummonPanel(true);
            if (typeof updateUI === 'function') updateUI();
        } catch (e) {}
    }

    function _offlineGrantBatch(source, profile, elapsed, rawElapsed, efficiency, options) {
        options = options || {};
        let now = options.now || _offlineNow();
        let requestedElapsed = elapsed;
        let survivalPlan = _offlineSurvivalPlan(profile, elapsed, efficiency, true);
        elapsed = survivalPlan.elapsedMs;
        let bossRoom = profile.bossRoom === true;
        let previewKills = bossRoom ? 0 : _offlineRewardAmount(profile.killsPerMin, elapsed, efficiency);
        let bossPlan = bossRoom ? _offlineBossRoomPlan(profile, elapsed, efficiency, true) :
            (options.allowBosses ? _offlineBossPlan(profile, previewKills, elapsed) :
                { rows: [], kills: 0, timeMs: 0, exp: 0, gold: 0, petExp: 0, allyExp: 0 });
        let nativePlanner = typeof window !== 'undefined' ? window.idleLineageNativeOffline : null;
        let nativeTotals = nativePlanner && typeof nativePlanner.planBatchTotals === 'function' ?
            nativePlanner.planBatchTotals({
                bossRoom: bossRoom,
                elapsedMs: elapsed,
                efficiency: efficiency,
                killsPerMin: profile.killsPerMin,
                expPerMin: profile.expPerMin,
                goldPerMin: profile.goldPerMin,
                petExpPerMin: profile.petExpPerMin,
                allyExpPerMin: profile.allyExpPerMin,
                bossTimeMs: bossPlan.timeMs,
                bossKills: bossPlan.kills,
                bossExp: bossPlan.exp,
                bossGold: bossPlan.gold,
                bossPetExp: bossPlan.petExp,
                bossAllyExp: bossPlan.allyExp
            }) : null;
        let totalKeys = ['huntElapsedMs','normalKills','exp','gold','kills','petExp','allyExp'];
        let nativeTotalsValid = nativeTotals && totalKeys.every(key =>
            Number.isFinite(nativeTotals[key]) && nativeTotals[key] >= 0 && nativeTotals[key] <= Number.MAX_SAFE_INTEGER) &&
            nativeTotals.huntElapsedMs <= elapsed;
        let huntElapsed, normalKills, exp, gold, kills, petExp, allyExp;
        if (nativeTotalsValid) {
            huntElapsed = nativeTotals.huntElapsedMs;
            normalKills = nativeTotals.normalKills;
            exp = nativeTotals.exp;
            gold = nativeTotals.gold;
            kills = nativeTotals.kills;
            petExp = nativeTotals.petExp;
            allyExp = nativeTotals.allyExp;
        } else {
            huntElapsed = bossRoom ? 0 : Math.max(0, elapsed - bossPlan.timeMs);
            normalKills = bossRoom ? 0 : _offlineRewardAmount(profile.killsPerMin, huntElapsed, efficiency);
            exp = Math.min(Number.MAX_SAFE_INTEGER, bossRoom ? bossPlan.exp :
                _offlineRewardAmount(profile.expPerMin, huntElapsed, efficiency) + bossPlan.exp);
            gold = Math.min(Number.MAX_SAFE_INTEGER, bossRoom ? bossPlan.gold :
                _offlineRewardAmount(profile.goldPerMin, huntElapsed, efficiency) + bossPlan.gold);
            kills = Math.min(Number.MAX_SAFE_INTEGER, normalKills + bossPlan.kills);
            petExp = Math.min(Number.MAX_SAFE_INTEGER, bossRoom ? bossPlan.petExp :
                _offlineRewardAmount(profile.petExpPerMin, huntElapsed, efficiency) + bossPlan.petExp);
            allyExp = Math.min(Number.MAX_SAFE_INTEGER, bossRoom ? bossPlan.allyExp :
                _offlineRewardAmount(profile.allyExpPerMin, huntElapsed, efficiency) + bossPlan.allyExp);
        }
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
        if (survivalPlan.died) _offlineLockAfterDeath();

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
            requestedElapsedMs: requestedElapsed,
            died: survivalPlan.died,
            deathAtMs: survivalPlan.deathAtMs,
            potionId: survivalPlan.potionId,
            potionUsed: survivalPlan.potionUsed,
            potionBought: survivalPlan.potionBought || 0,   // 🧪 v3.7.72 自動購買補的瓶數／花費
            potionCost: survivalPlan.potionCost || 0,
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
            logSys('<span class="' + (survivalPlan.died ? 'text-red-400' : 'text-cyan-300') + ' font-bold">⏩ 掛機補跑完成：</span>已補上 ' +
                _offlineFormatCatchupDuration(elapsed) + ' 的進度' + (gold > 0 ? ('，金幣 +' + gold.toLocaleString()) : '') +
                (survivalPlan.died ? '，角色在戰鬥中死亡，後續時間不再計算收益。' : '。'));
            let gains = _offlineCatchupGainRows(loot);
            if (gains.length) logSys('<span class="sys-item-gain">掛機期間獲得：' + gains.join('、') + '</span>');
        } else if (typeof logSys === 'function') {
            logSys('<span class="text-amber-300 font-bold">' + label + '：</span>經驗 ' + exp.toLocaleString() +
                '、金幣 ' + gold.toLocaleString() + '、擊殺怪物 ' + kills.toLocaleString() +
                (bossPlan.kills > 0 ? ('（含頭目 ' + bossPlan.kills.toLocaleString() + '）') : '') +
                '、掉落物 ' + loot.itemCount.toLocaleString() + '、卡片 ' + loot.cardCount.toLocaleString() + '。');
            if (survivalPlan.died) {
                logSys('<span class="text-red-400 font-bold">角色在離線戰鬥 ' + _offlineFormatDuration(elapsed) +
                    ' 後死亡，後續收益已停止；離線頭目戰需再次擊敗頭目才能解鎖，普通狩獵復活後仍可掛機。</span>');
            }
        }
        if (survivalPlan.died) _offlineApplySettledDeath();
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
            let mercBlocked = typeof currentRoleIsMercenary === 'function' && currentRoleIsMercenary();
            _offlineHiddenAt = 0;
            // 沒有合格實戰樣本時仍消耗背景時間與狀態，不退回逐 tick 補跑。
            if (mercBlocked || !saved || !saved.eligible || saved.map !== map || !profile || profile.killsPerMin <= 0) {
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
                if (Object.prototype.hasOwnProperty.call(cpSnapshot, 'bossUnlocked')) {
                    saved.bossUnlocked = cpSnapshot.bossUnlocked !== false;
                    saved.bossUnlockedAt = Math.max(0, Math.floor(_offlineFinite(cpSnapshot.bossUnlockedAt, 0)));
                }
                let cpProfile = _offlineProfile(cpSnapshot.profile);
                if (cpProfile) {
                    saved.profiles = _offlineSavedProfiles(cpSnapshot.profiles, cpProfile);
                    saved.profile = saved.profiles.find(row => row.map === cpProfile.map) || cpProfile;
                }
                source = {
                    eligible: cpSnapshot.eligible === true,
                    bossUnlocked: cpSnapshot.bossUnlocked !== false,
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
            let mercBlocked = typeof currentRoleIsMercenary === 'function' && currentRoleIsMercenary();

            let bossLocked = source.bossUnlocked === false && profile && profile.bossRoom === true;
            if (mercBlocked || !source.eligible || bossLocked || !profile || profile.map !== source.map || elapsed < OFFLINE_MIN_MS || profile.killsPerMin <= 0) {
                _offlineResetRuntime(typeof mapState !== 'undefined' && mapState ? mapState.current : '');
                _offlinePrepareSnapshot(now);
                return false;
            }
            // 先占用時間區間，避免同角色多分頁或重新匯入同一快照重複領取。
            if (!_offlineWriteClaimAt(now)) return false;
            return _offlineGrantBatch(source, profile, elapsed, rawElapsed, OFFLINE_EFFICIENCY, {
                now: now,
                label: '離線收益',
                allowBosses: source.bossUnlocked !== false,
                advanceCombatTime: false,
                showModal: true
            });
        } finally {
            _offlineSettling = false;
            try { _offlineRestorePendingCatchup(); } catch (e) {}
        }
    }

    function _offlineHealingPotionId(id) {
        id = String(id || '');
        return id === 'potion_heal' || id === 'potion_strong' || id === 'potion_ult' || id === 'new_item_141';
    }

    function _offlineEnsureSurvivalRuntime(map) {
        map = String(map || '');
        if (!_offlineSurvivalRuntime || _offlineSurvivalRuntime.map !== map) _offlineResetSurvivalRuntime(map);
        return _offlineSurvivalRuntime;
    }

    function _offlineRecordPotionUse(id, count, healed) {
        if (!_offlineSurvivalTrackable() || !_offlineHealingPotionId(id)) return;
        let rt = _offlineEnsureSurvivalRuntime(mapState.current);
        count = Math.max(0, Math.floor(_offlineFinite(count, 0)));
        healed = Math.max(0, _offlineFinite(healed, 0));
        if (!count) return;
        rt.potionUses += count;
        rt.potionCounts[id] = (rt.potionCounts[id] || 0) + count;
        rt.potionHealing += healed;
        rt.potionHeals[id] = (rt.potionHeals[id] || 0) + healed;
        rt.healing += healed;
        if (_offlineSurvivalTickCtx && _offlineSurvivalTickCtx.rt === rt) {
            _offlineSurvivalTickCtx.directHealing += healed;
        }
    }

    const _offlineOriginalUseItem = window.useItem;
    if (typeof _offlineOriginalUseItem === 'function') {
        window.useItem = function (uid) {
            let item = player && Array.isArray(player.inv) ? player.inv.find(row => row && row.uid === uid) : null;
            let id = item && item.id;
            let track = _offlineSurvivalTrackable() && _offlineHealingPotionId(id);
            let beforeCount = track ? _offlineInventoryCount(id) : 0;
            let beforeHp = track ? Math.max(0, Number(player.hp) || 0) : 0;
            let result = _offlineOriginalUseItem.apply(this, arguments);
            if (track) {
                let used = Math.max(0, beforeCount - _offlineInventoryCount(id));
                let healed = Math.max(0, (Number(player.hp) || 0) - beforeHp);
                _offlineRecordPotionUse(id, used, healed);
            }
            return result;
        };
    }

    const _offlineOriginalTick = window.tick;
    if (typeof _offlineOriginalTick === 'function') {
        window.tick = function () {
            let track = _offlineSurvivalTrackable();
            let rt = track ? _offlineEnsureSurvivalRuntime(mapState.current) : null;
            let ctx = track ? { rt: rt, beforeHp: Math.max(0, Number(player.hp) || 0), directHealing: 0 } : null;
            _offlineSurvivalTickCtx = ctx;
            let result;
            try { result = _offlineOriginalTick.apply(this, arguments); }
            finally {
                _offlineSurvivalTickCtx = null;
                if (ctx && rt === _offlineSurvivalRuntime) {
                    let afterHp = Math.max(0, Number(player.hp) || 0);
                    if (rt.deathTick !== (state && state.ticks)) {
                        let residual = afterHp - ctx.beforeHp - ctx.directHealing;
                        if (residual < 0) rt.damage += -residual;
                        else if (residual > 0) rt.healing += residual;
                        rt.activeMs += TICK_MS;
                        rt.lastTick = state && state.ticks;
                    }
                    rt.lastHp = afterHp;
                    let mhp = Math.max(1, Number(player.mhp) || 1);
                    rt.minHpPct = Math.min(rt.minHpPct, _offlineClamp(afterHp / mhp, 0, 1));
                }
            }
            return result;
        };
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

    function _offlineRecordSurvivalDeath(now) {
        if (!_offlineSurvivalTrackable()) return;
        let map = String(mapState.current || '');
        let rt = _offlineEnsureSurvivalRuntime(map);
        let tickNo = Number(state && state.ticks) || 0;
        if (rt.deathTick === tickNo) return;
        let hp = Math.max(0, Number(player.hp) || 0);
        if (rt.lastTick !== tickNo) {
            let directHealing = _offlineSurvivalTickCtx && _offlineSurvivalTickCtx.rt === rt ? _offlineSurvivalTickCtx.directHealing : 0;
            rt.damage += Math.max(0, rt.lastHp + directHealing - hp);
            rt.activeMs += TICK_MS;
            rt.lastTick = tickNo;
        }
        rt.lastHp = hp;
        rt.minHpPct = 0;
        rt.deaths++;
        rt.deathTick = tickNo;
        let st = _offlineEnsureState();
        if (!st) return;
        let previous = _offlineProfileForMap(st, map) || {
            map: map, mapName: _offlineMapName(map), expPerMin: 0, goldPerMin: 0,
            killsPerMin: 0, petExpPerMin: 0, allyExpPerMin: 0, sampleMs: 0,
            mobs: [], bosses: [], sampleKills: 0, updatedAt: 0
        };
        let survival = _offlineSurvivalSnapshot(map, previous.survival, now, true);
        _offlineRememberProfile(st, Object.assign({}, previous, { survival: survival, updatedAt: now }));
    }

    function _offlineLockAfterDeath() {
        let st = _offlineEnsureState();
        if (!st) return false;
        let changed = st.bossUnlocked !== false;
        let now = _offlineNow();
        st.bossUnlocked = false;
        st.bossUnlockedAt = 0;
        st.eligible = false;
        st.awaySince = now;
        st.map = '';
        st.mapName = '';
        _offlineWriteJson(_offlineStoreKey('checkpoint'), {
            v: OFFLINE_VERSION,
            lastActive: now,
            snapshot: JSON.parse(JSON.stringify(st))
        });
        return changed;
    }

    const _offlineOriginalKillPlayer = window.killPlayer;
    if (typeof _offlineOriginalKillPlayer === 'function') {
        window.killPlayer = function () {
            _offlineRecordSurvivalDeath(_offlineNow());
            let changed = _offlineLockAfterDeath();
            let result = _offlineOriginalKillPlayer.apply(this, arguments);
            if (changed && typeof logSys === 'function') {
                logSys('<span class="text-amber-300 font-bold">死亡使離線頭目戰資格失效；普通狩獵復活後仍可掛機，再次擊敗任一頭目可重新解鎖離線頭目戰。</span>');
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
            _offlineRoleDetached = false;
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

    const _offlineOriginalStartGame = window.startGame;
    if (typeof _offlineOriginalStartGame === 'function') {
        window.startGame = function () {
            _offlineRoleDetached = false;
            return _offlineOriginalStartGame.apply(this, arguments);
        };
    }

    window.offlinePrepareCharacterSelect = function () {
        if (typeof player === 'undefined' || !player || !player.cls || _offlineLoading || _offlineSettling) return false;
        let now = _offlineNow();
        _offlineRememberPendingCatchup(now);
        let snapshot = _offlinePrepareSnapshot(now, true);
        _offlineInternalSave = true;
        window.__fb5CloseFlush = true;
        try { _offlineOriginalSaveGame(); } catch (e) {}
        finally {
            _offlineInternalSave = false;
            window.__fb5CloseFlush = false;
            _offlineRoleDetached = true;
        }
        return !!(snapshot && snapshot.eligible === true);
    };

    function _offlinePauseAndSave() {
        if (_offlineRoleDetached || typeof player === 'undefined' || !player || !player.cls || _offlineLoading || _offlineSettling) return;
        _offlinePrepareSnapshot(_offlineNow());
        _offlineInternalSave = true;
        try { _offlineOriginalSaveGame(); } catch (e) {}
        finally { _offlineInternalSave = false; }
    }

    function _offlineCloseAndSave() {
        if (_offlineRoleDetached || typeof player === 'undefined' || !player || !player.cls || _offlineLoading || _offlineSettling) return;
        let now = _offlineNow();
        _offlineRememberPendingCatchup(now);
        _offlinePrepareSnapshot(now, true);
        _offlineInternalSave = true;
        window.__fb5CloseFlush = true;   // 🔚 v3.7.31 關頁最終存檔＝final flush：繞過 js/13 的補跑存檔延後閘（背景節流喚醒間 _tickDebt 常 ≥100ms，不繞過＝最終進度不落地）
        try { _offlineOriginalSaveGame(); } catch (e) {}
        finally { _offlineInternalSave = false; window.__fb5CloseFlush = false; }
    }

    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', function () {
            if (_offlineRoleDetached) return;
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
            if (_offlineRoleDetached) return;
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
