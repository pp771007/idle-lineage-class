// 城戰選單保留七城；肯特、風木、海音沿用既有兩階段攻城流程。
// 其餘四城在 V2 階段與數值資料補齊前保持鎖定，避免未完成內容進入正式存檔。
(function (global) {
    'use strict';

    const DATA = global.SIEGE_GUARD_DATA || { units:{}, skills:{}, stages:{}, pools:{} };
    const VERSION = 2;
    const ENTRY_GOLD = 1000000;
    const MIN_LEVEL = 40;
    const MIN_MERCS = 3;
    const COOLDOWN_MS = 72 * 60 * 60 * 1000;
    const DURATION_MS = 30 * 60 * 1000;

    // 🏰 v3.7.89 六角環繞版面：格線改 6 欄、每顆城堡跨 2 欄 → 上下排各偏移半格，嵌進中間排的縫隙，
    //   六城環繞中央的亞丁城成一個圓：  上排 [肯特][風木] ／ 中排 [海音][亞丁][奇岩] ／ 下排 [妖魔堡][侏儒城]
    //   ⚠️ col 是「6 欄格線的起始欄」(1/2/3/4/5)，非舊制的 1~3 欄號；改動請同步 castleChoiceStyle 的 span 2。
    const CASTLES = [
        { id:'kent', name:'肯特城', icon:'🏰', enabled:true, legacy:true, row:1, col:2, palette:['#4a1519','#1f0b0d','#c15b5f','#fde7a3','#ef5b61','rgba(239,91,97,.24)'] },
        { id:'windwood', name:'風木城', icon:'🌲', enabled:true, legacy:true, row:1, col:4, palette:['#143b2d','#091d16','#4f9b76','#c7f9d8','#42d392','rgba(66,211,146,.22)'] },
        { id:'heine', name:'海音城', icon:'🌊', enabled:true, legacy:true, row:2, col:1, palette:['#123851','#091c29','#4d9ac2','#c9efff','#45bfe8','rgba(69,191,232,.22)'] },
        { id:'orc_fortress', name:'妖魔堡', icon:'🪓', enabled:false, row:3, col:2, palette:['#3b3215','#1d180a','#8f7e35','#f2e7a5','#a6c957','rgba(166,201,87,.18)'] },
        { id:'giran', name:'奇岩城', icon:'💰', enabled:false, row:2, col:5, palette:['#4b300d','#241704','#bd8330','#ffefad','#efa83b','rgba(239,168,59,.22)'] },
        { id:'dwarf_castle', name:'侏儒城', icon:'⚒', enabled:false, row:3, col:4, palette:['#303941','#151a1f','#82909b','#e4edf2','#c98a5d','rgba(201,138,93,.18)'] },
        { id:'aden', name:'亞丁城', icon:'👑', enabled:false, row:2, col:3, palette:['#3a2457','#190e2a','#c5a64f','#fff0a8','#ad8df2','rgba(197,166,79,.28)'] }
    ];
    const LEGACY_CASTLES = new Set(CASTLES.filter(c => c.legacy).map(c => c.id));

    const STAGES = [
        { id:'kent_outer_line', name:'城外戰線', map:'siege_v2_kent_outer', mapName:'肯特城外戰線', type:'kill', target:50, poolId:'kent_standard_guards', slots:5, bg:'assets/area/siege-v2/肯特村.png' },
        { id:'kent_gate_battle', name:'正門攻堅', map:'siege_v2_kent_gate', mapName:'肯特城正門', type:'target', target:1, unitId:'kent_gate_v2', slots:1, bg:'assets/area/siege-v2/肯特城門HD.png' },
        { id:'kent_tower_guard', name:'守護塔防衛線', map:'siege_v2_kent_tower_guard', mapName:'肯特守護塔防衛線', type:'kill', target:50, poolId:'kent_standard_guards', slots:5, bg:'assets/area/siege-v2/肯特外城.png' },
        { id:'kent_tower_battle', name:'守護塔決戰', map:'siege_v2_kent_tower', mapName:'肯特守護塔', type:'target', target:1, unitId:'kent_tower_v2', slots:1, bg:'assets/area/siege-v2/肯特城內HD.png' },
        { id:'kent_lord_battle', name:'城主決戰', map:'siege_v2_kent_lord', mapName:'肯特內城', type:'target', target:1, unitId:'castle_lord_kent', slots:1, bg:'assets/area/siege-v2/肯特城內HD1.png' }
    ];
    const STAGE_BY_ID = Object.fromEntries(STAGES.map((s, i) => [s.id, Object.assign({ index:i }, s)]));
    const STAGE_BY_MAP = Object.fromEntries(STAGES.map(s => [s.map, s]));

    const UNIT_ASSET = {
        kent_blue_shark_patrol: 'assets/castle/肯特城/肯特專屬守軍/藍色鯊魚巡守',
        kent_blue_shark_warrior: 'assets/castle/肯特城/肯特專屬守軍/藍色鯊魚戰士',
        kent_blue_shark_spearman: 'assets/castle/肯特城/肯特專屬守軍/藍色鯊魚槍兵',
        kent_blue_shark_mage: 'assets/castle/肯特城/肯特專屬守軍/藍色鯊魚法師',
        castle_lord_kent: 'assets/castle/城主/肯特城主'
    };

    const ANIM = {
        kent_blue_shark_patrol: profile(UNIT_ASSET.kent_blue_shark_patrol, { idle:10, attack:8, hurt:2, death:13 }, true),
        kent_blue_shark_warrior: profile(UNIT_ASSET.kent_blue_shark_warrior, { idle:12, attack:4, hurt:2, death:12 }, true),
        kent_blue_shark_spearman: profile(UNIT_ASSET.kent_blue_shark_spearman, { idle:12, attack:6, hurt:2, death:12 }, true),
        kent_blue_shark_mage: profile(UNIT_ASSET.kent_blue_shark_mage, { idle:7, attack:8, skill:9, hurt:2, death:13 }, true),
        castle_lord_kent: profile(UNIT_ASSET.castle_lord_kent, { idle:12, attack1:5, attack2:5, skill1:7, hurt:2, death:23 }, true),
        kent_gate_v2: profile('assets/castle/城門/城門左', { idle:{ count:1, file:'death' }, death:5 }, false, 'assets/castle/城門/城門右'),
        kent_tower_v2: profile('assets/castle/守護塔/守護塔', { idle:{ count:1, file:'death' }, death:20 }, false)
    };

    function profile(base, actions, shadow, rightBase) {
        let out = { base, shadow:!!shadow, rightBase:rightBase || '', fps:8, actions:{} };
        Object.keys(actions).forEach(k => {
            let v = actions[k];
            out.actions[k] = typeof v === 'number'
                ? { count:v, file:k, start:1, loop:k === 'idle' }
                : Object.assign({ start:1, loop:k === 'idle' }, v);
        });
        return out;
    }

    function num(v, fallback) {
        let n = Number(v);
        return Number.isFinite(n) ? n : (fallback || 0);
    }
    function optionalNum(v, fallback) {
        return v == null || v === '' ? fallback : num(v, fallback);
    }
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function esc(v) {
        if (typeof clanEsc === 'function') return clanEsc(String(v == null ? '' : v));
        return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    function activeMercs() {
        return (player.allies || []).filter(a => a && !a._downed && num(a.curHp, 0) > 0);
    }
    function stageOf(s) { return STAGE_BY_ID[s && s.stageId] || STAGES[0]; }
    function isV2(s) { return !!(s && s.active && s.version === VERSION); }
    function log(msg) { try { logSys(msg); } catch (e) {} }
    function nextUid() { try { return uid(); } catch (e) { return 'siege-v2-' + Date.now() + '-' + Math.random().toString(36).slice(2); } }
    function nextBorn() { try { return ++_mobBornSeq; } catch (e) { return Date.now() + Math.random(); } }
    function statusBag() { try { return newMobStatus(); } catch (e) { return {}; } }

    function cooldownText(ms) {
        if (ms <= 0) return '可宣戰';
        let h = Math.floor(ms / 3600000), m = Math.ceil((ms % 3600000) / 60000);
        return `${h} 小時 ${m} 分鐘`;
    }
    function eligibility(city) {
        let clan = typeof clanGetModeInfo === 'function' ? clanGetModeInfo(player) : null;
        let held = clan ? clan.castle : null;
        let s = player.siege || {};
        let remain = Math.max(0, num(s.cooldownUntil, 0) - Date.now());
        if (!clan) return { ok:false, reason:'尚未加入血盟' };
        if (typeof clanCanSiege === 'function' && !clanCanSiege(player)) return { ok:false, reason:'此模式沒有可宣戰的王族盟主' };
        if (s.active) return { ok:false, reason:'攻城戰進行中' };
        if ((player.lv || 1) < MIN_LEVEL) return { ok:false, reason:`需要 Lv.${MIN_LEVEL}` };
        if ((player.gold || 0) < ENTRY_GOLD) return { ok:false, reason:'需要 1,000,000 金幣' };
        if (activeMercs().length < MIN_MERCS) return { ok:false, reason:`至少需要 ${MIN_MERCS} 名可戰鬥傭兵` };
        if (held === city) return { ok:false, reason:'目前持有' };
        if (remain > 0) return { ok:false, reason:'冷卻 ' + cooldownText(remain) };
        return { ok:true, reason:'可宣戰' };
    }

    function legacyEligibility(city, held) {
        let clan = typeof clanGetModeInfo === 'function' ? clanGetModeInfo(player) : null;
        let s = player.siege || {};
        if (!clan) return { ok:false, reason:'尚未加入血盟' };
        if (typeof clanCanSiege === 'function' && !clanCanSiege(player)) return { ok:false, reason:'此模式沒有可宣戰的王族盟主' };
        if (s.active) return { ok:false, reason:'攻城戰進行中' };
        if ((held || clan.castle) === city) return { ok:false, reason:'目前持有' };
        return { ok:true, reason:'舊制攻城・無等級、費用與冷卻限制' };
    }

    function castleChoiceStyle(c) {
        let p = c.palette;
        return [
            `grid-column:${c.col} / span 2`,   // 🏰 v3.7.89 六角環繞：6 欄格線·每顆跨 2 欄（上下排起始欄為偶數→自然偏移半格）
            `grid-row:${c.row}`,
            `--siege-bg-a:${p[0]}`,
            `--siege-bg-b:${p[1]}`,
            `--siege-border:${p[2]}`,
            `--siege-text:${p[3]}`,
            `--siege-accent:${p[4]}`,
            `--siege-glow:${p[5]}`
        ].join(';');
    }

    function renderCastleChoice(c, held) {
        let rule = c.legacy
            ? legacyEligibility(c.id, held)
            : (c.enabled ? eligibility(c.id) : { ok:false, reason:'階段與數值資料未完成' });
        let defender = c.enabled && typeof npcClanCastleDefender === 'function' ? npcClanCastleDefender(c.id, player) : null;
        let defenderText = defender ? `<span class="siege-castle-defender">守城血盟：${esc(defender.name)}</span>` : '';
        let stateClass = rule.ok ? 'is-open' : 'is-locked';
        let capitalClass = c.id === 'aden' ? ' siege-castle-capital' : '';
        return `<button type="button" data-castle="${c.id}" class="btn siege-castle-choice ${stateClass}${capitalClass}" style="${castleChoiceStyle(c)}" ${rule.ok ? `onclick="startSiege('', '${c.id}')"` : 'disabled'}>
            <span class="siege-castle-title"><span class="siege-castle-icon" aria-hidden="true">${c.icon}</span>${esc(c.name)}</span>
            <span class="siege-castle-status">${held === c.id ? '目前持有' : esc(rule.reason)}</span>${defenderText}
        </button>`;
    }

    function openV2SiegeSelect(faction, targetEl) {
        let clan = typeof clanGetModeInfo === 'function' ? clanGetModeInfo(player) : null;
        if (!clan) { alert('你尚未加入血盟，無法宣布攻城戰。'); return; }
        if (typeof clanCanSiege === 'function' && !clanCanSiege(player)) { alert('此模式沒有創立血盟的王族，無法攻城。'); return; }
        let held = typeof rememberCastleOwnerCity === 'function' ? rememberCastleOwnerCity(clan.castle) : clan.castle;
        let el = targetEl || document.getElementById('interaction-content'); if (!el) return;
        el.innerHTML = `<div class="flex flex-col gap-4 p-2">
            <div class="text-center text-amber-200 font-bold text-lg">宣布城戰</div>
            <div class="siege-castle-grid">${CASTLES.map(c => renderCastleChoice(c, held)).join('')}</div>
            <div class="text-xs leading-relaxed text-slate-400 border-t border-slate-700 pt-3">肯特、風木、海音使用原有攻城流程；其餘城池會在階段、城主能力與地圖資料補齊後開放。</div>
        </div>`;
    }

    function openPreparation(city) {
        city = city || 'kent';
        let c = CASTLES.find(x => x.id === city);
        if (!c || !c.enabled) { alert('此城池的城戰資料尚未完成。'); return; }
        let rule = eligibility(city);
        if (!rule.ok) { alert(rule.reason); return; }
        if (typeof mercenaryRoleBattleBlocked === 'function' && mercenaryRoleBattleBlocked(STAGES[0].map)) return;
        let el = document.getElementById('interaction-content'); if (!el) return;
        let mercs = activeMercs();
        el.innerHTML = `<div class="flex flex-col gap-4 p-2">
            <div class="text-center text-amber-200 font-bold text-lg">肯特城戰前集結</div>
            <div class="grid grid-cols-3 gap-2 text-center text-sm">
                <div class="bg-slate-800/70 border border-slate-600 rounded p-2"><div class="text-slate-400 text-xs">等級</div><div class="text-sky-200 font-bold">Lv.${player.lv || 1}</div></div>
                <div class="bg-slate-800/70 border border-slate-600 rounded p-2"><div class="text-slate-400 text-xs">進場費</div><div class="text-yellow-300 font-bold">1,000,000</div></div>
                <div class="bg-slate-800/70 border border-slate-600 rounded p-2"><div class="text-slate-400 text-xs">傭兵</div><div class="text-emerald-300 font-bold">${mercs.length} 名</div></div>
            </div>
            <div class="bg-slate-900/70 border border-amber-700/60 rounded p-3 text-sm text-slate-300 leading-relaxed">限時 30 分鐘，依序突破城外戰線、正門、守護塔防衛線、守護塔與肯特城主。完成或失敗後進入 72 小時冷卻。</div>
            <div class="grid grid-cols-2 gap-2">
                <button class="btn py-3 bg-slate-700 hover:bg-slate-600 border-slate-500" onclick="openSiegeSelect()">返回</button>
                <button class="btn py-3 bg-red-950 hover:bg-red-900 border-red-600 text-red-100 font-bold" onclick="siegeV2BeginKent()">開始攻城</button>
            </div>
        </div>`;
    }

    function buildQueue(poolId, count) {
        let rows = (DATA.pools && DATA.pools[poolId] || []).filter(r => r && r.enabled !== false && DATA.units[r.unitId] && DATA.units[r.unitId].enabled !== false);
        let out = [];
        for (let i = 0; i < count && rows.length; i++) {
            let total = rows.reduce((sum, r) => sum + Math.max(1, num(r.weight, 1)), 0);
            let roll = Math.random() * total, pick = rows[rows.length - 1];
            for (let r of rows) { roll -= Math.max(1, num(r.weight, 1)); if (roll <= 0) { pick = r; break; } }
            out.push(pick.unitId);
        }
        return out;
    }

    function resolveLevel(u) {
        if (u.levelMode === 'fixed') return Math.max(1, num(u.fixedLevel, player.lv || 1));
        return clamp((player.lv || 1) + num(u.levelOffset, 0), num(u.minLevel, 1), num(u.maxLevel, 999));
    }
    function calcDr(u, lv) {
        if (u.fixedDrFormula === 'min_cap_floor_level') return Math.min(num(u.drCap, 0), num(u.drBase, 0) + Math.floor(lv / Math.max(1, num(u.drDiv, 9999)))) + num(u.extraDr, 0);
        return num(u.dr, num(u.extraDr, 0));
    }

    function damageMultiplier(mob) {
        let mult = 1;
        if (mob._siegeLineReduction) {
            let others = (mapState.mobs || []).filter(m => m && m !== mob && !m._dead && m.curHp > 0 && m._siegeKentGuard).length;
            mult *= 1 - Math.min(mob._siegeLineCap || 0, others * mob._siegeLineReduction);
        }
        if (mob._siegeLowHpReduction && mob.curHp < mob.hp * mob._siegeLowHpThreshold) mult *= 1 - mob._siegeLowHpReduction;
        if ((mob._siegeHolyUntil || 0) > Date.now()) mult *= 0.70;
        if (mob._siegeLastDefenseActive) mult *= 0.70;
        if ((mob._siegeFatigueUntil || 0) > Date.now()) mult *= 1.15;
        return Math.max(0.05, mult);
    }

    function installDamageGate(mob) {
        let hpValue = num(mob.curHp, mob.hp);
        Object.defineProperty(mob, 'curHp', {
            enumerable:true,
            configurable:true,
            get() { return hpValue; },
            set(v) {
                let next = Number(v);
                if (!Number.isFinite(next)) return;
                if (next < hpValue && !mob._siegeRawHpWrite) {
                    let incoming = hpValue - next;
                    next = hpValue - Math.max(1, Math.floor(incoming * damageMultiplier(mob)));
                    triggerAnim(mob, 'hurt');
                }
                hpValue = Math.max(0, Math.min(num(mob.hp, hpValue), next));
            }
        });
        mob._siegeSetHpRaw = function (v) {
            mob._siegeRawHpWrite = true;
            mob.curHp = v;
            mob._siegeRawHpWrite = false;
        };
    }

    function buildUnit(unitId) {
        let u = DATA.units && DATA.units[unitId]; if (!u) return null;
        let lv = resolveLevel(u);
        let hp = Math.max(1, Math.round(lv * num(u.hpCoef, 10) + num(u.hpFixed, 0)));
        let mp = u.mp != null ? Math.max(0, Math.round(num(u.mp, 0))) : Math.max(0, Math.round(lv * num(u.mpCoef, 0) + num(u.mpFixed, 0)));
        let asset = UNIT_ASSET[unitId] || '';
        let mob = {
            id:'siege_v2_' + unitId,
            n:u.name || unitId,
            lv,
            s:u.role === 'commander' ? 'L' : 'S',
            beh:'主動',
            race:u.role === 'commander' ? '城主' : '攻城守軍',
            siegeEnemy:true,
            siegeV2:true,
            siegeGenerated:true,
            siegeUnitId:unitId,
            _siegeKentGuard:unitId.indexOf('kent_blue_shark_') === 0,
            e:u.element || 'none',
            hp,
            curHp:hp,
            mp,
            mmp:mp,
            ac:-Math.abs(num(u.acBase, 0)) - Math.floor(lv / Math.max(1, num(u.acDiv, 9999))),
            mr:Math.round(num(u.mrBase, 0) + Math.floor(lv / Math.max(1, num(u.mrDiv, 9999)))),
            hit:num(u.hit, 0),
            dr:calcDr(u, lv),
            atkSpd:optionalNum(u.finalAtkSpd, num(u.atkSpd, 2)),
            dmg:[Math.max(1, num(u.diceCount, 1)), Math.max(1, num(u.diceSides, 1))],
            db:Math.round(num(u.dmgFixed, 0) + lv * num(u.dmgLevelMult, 0)),
            matk:num(u.matk, 0),
            exp:0,
            goldMin:0,
            goldMax:0,
            noGold:true,
            boss:u.role === 'commander',
            img:asset ? asset + '/idle_01.png' : 'assets/icons/monsters/default.png',
            siegeAnimId:unitId,
            uid:nextUid(),
            _born:nextBorn(),
            _bornMs:Date.now(),
            _magCd:{},
            justHit:false,
            st:statusBag(),
            _siegeLowHpThreshold:num(u.lowHpThreshold, 0.35),
            _siegeLowHpReduction:num(u.lowHpFinalReduction, 0),
            _siegeLineReduction:num(u.lineDrPerUnit, 0),
            _siegeLineCap:num(u.lineDrCap, 0)
        };
        if (unitId === 'castle_lord_kent') {
            mob.mag = {
                skn:'破陣突刺', type:'extra_attack', cd:100, chance:1,
                atkDmg:[u.diceCount || 3, Math.max(1, Math.round((u.diceSides || 8) * 1.5))],
                atkDb:Math.round(mob.db * 1.5), _siegeHeavy:true
            };
        }
        installDamageGate(mob);
        return mob;
    }

    function buildBuilding(unitId) {
        let lv = clamp((player.lv || 1) + 5, 45, 105);
        let isGate = unitId === 'kent_gate_v2';
        let hp = isGate ? 60000 : Math.max(1, 500 * (player.lv || 1));
        let mob = {
            id:'siege_v2_' + unitId,
            n:isGate ? '肯特城門' : '肯特守護塔',
            lv,
            s:'L',
            beh:'被動',
            race:'建築',
            siegeEnemy:true,
            siegeV2:true,
            siegeGenerated:true,
            siegeUnitId:unitId,
            e:'none',
            hp,
            curHp:hp,
            ac:10,
            mr:0,
            // V2 文件沒有守護塔耐久／減傷，暫時沿用 V1 的 500×等級與 DR 10。
            dr:isGate ? 6 : 10,
            atkSpd:2,
            dmg:[0, 0],
            db:0,
            hit:0,
            exp:0,
            goldMin:0,
            goldMax:0,
            noGold:true,
            noAttack:true,
            boss:true,
            hard:false,
            img:(isGate ? 'assets/castle/城門/城門左' : 'assets/castle/守護塔/守護塔') + '/death_01.png',
            siegeAnimId:unitId,
            uid:nextUid(),
            _born:nextBorn(),
            _bornMs:Date.now(),
            _magCd:{},
            justHit:false,
            st:statusBag()
        };
        installDamageGate(mob);
        return mob;
    }

    function prepareStage(stageId, reset) {
        let s = player.siege, stage = STAGE_BY_ID[stageId]; if (!s || !stage) return false;
        s.stageId = stage.id;
        s.stageIndex = stage.index;
        if (reset || !Array.isArray(s.stageQueue)) s.stageQueue = stage.type === 'kill' ? buildQueue(stage.poolId, stage.target) : [stage.unitId];
        if (reset) {
            s.stageProgress = 0;
            s.stageSpawned = 0;
            s.stageMobHp = null;
        }
        return true;
    }

    function spawnForStage(idx) {
        let s = player.siege, stage = stageOf(s);
        if (!isV2(s) || mapState.current !== stage.map) return false;
        if (stage.type === 'target') {
            if (idx !== 1 || (mapState.mobs || []).some(m => m && !m._dead && m.siegeV2)) { mapState.mobs[idx] = null; return true; }
            let mob = stage.unitId === 'castle_lord_kent' ? buildUnit(stage.unitId) : buildBuilding(stage.unitId);
            if (!mob) { mapState.mobs[idx] = null; return true; }
            if (num(s.stageMobHp, 0) > 0 && num(s.stageMobHp, 0) < mob.hp) mob._siegeSetHpRaw(s.stageMobHp);
            mapState.mobs[idx] = mob;
            return true;
        }
        if (!Array.isArray(s.stageQueue)) prepareStage(stage.id, true);
        if (num(s.stageProgress, 0) >= stage.target || num(s.stageSpawned, 0) >= s.stageQueue.length) { mapState.mobs[idx] = null; return true; }
        let mob = buildUnit(s.stageQueue[s.stageSpawned++]);
        mapState.mobs[idx] = mob;
        return true;
    }

    function fillStage() {
        let s = player.siege, stage = stageOf(s);
        if (!isV2(s) || mapState.current !== stage.map) return;
        if (!Array.isArray(mapState.mobs)) mapState.mobs = [null, null, null, null, null];
        if (!Array.isArray(mapState.spawnAt)) mapState.spawnAt = [null, null, null, null, null];
        while (mapState.mobs.length < 5) mapState.mobs.push(null);
        while (mapState.spawnAt.length < 5) mapState.spawnAt.push(null);
        for (let i = 0; i < 5; i++) {
            mapState.spawnAt[i] = null;
            if (!mapState.mobs[i]) spawnForStage(i);
        }
        mapState.targetIdx = -1;
        renderMobs();
        updateUI();
    }

    function enterStage(stageId, reset) {
        let stage = STAGE_BY_ID[stageId]; if (!stage || !player.siege) return;
        prepareStage(stageId, reset !== false);
        log(`<span class="text-amber-200 font-bold">肯特城戰：${stage.name}</span>${stage.type === 'kill' ? `，擊破守軍 ${stage.target} 名。` : `，摧毀【${stage.unitId === 'kent_gate_v2' ? '肯特城門' : stage.unitId === 'kent_tower_v2' ? '肯特守護塔' : '肯特城主'}】。`}`);
        setMapSelectors(stage.map);
        changeMap(true);
        fillStage();
        saveGame();
    }

    function beginKent() {
        let rule = eligibility('kent');
        if (!rule.ok) { alert(rule.reason); return; }
        if (!confirm('確定提交 1,000,000 金幣並開始肯特城戰嗎？')) return;
        player.gold -= ENTRY_GOLD;
        let old = player.siege || {};
        let defender = typeof npcClanCastleDefender === 'function' ? npcClanCastleDefender('kent', player) : null;
        player.siege = {
            version:VERSION,
            active:true,
            city:'kent',
            stageId:STAGES[0].id,
            stageIndex:0,
            stageProgress:0,
            stageSpawned:0,
            stageQueue:[],
            stageMobHp:null,
            startedAt:Date.now(),
            endTime:Date.now() + DURATION_MS,
            kills:0,
            deaths:0,
            result:null,
            cooldownUntil:0,
            accCdUntil:num(old.accCdUntil, 0),
            npcDefenderClanId:defender ? defender.id : null,
            entryGold:ENTRY_GOLD
        };
        log('<span class="text-red-300 font-bold">肯特城戰開始。</span>五道防線已展開，於 30 分鐘內擊敗肯特城主即可佔領城池。');
        enterStage(STAGES[0].id, true);
    }

    function finish(result, reason) {
        let s = player.siege; if (!isV2(s)) return;
        let defenderId = s.npcDefenderClanId || null;
        s.active = false;
        s.result = result;
        s.endTime = Date.now();
        s.cooldownUntil = Date.now() + COOLDOWN_MS;
        s.stageMobHp = null;
        if ((player._siegeKentDefDownUntil || 0) > 0) {
            player._siegeKentDefDownUntil = 0;
            calcStats();
        }
        let won = result === 'win';
        if (won) {
            let setResult = typeof clanSetCastle === 'function' ? clanSetCastle('kent') : { ok:false };
            if (setResult && setResult.ok) {
                if (typeof rememberCastleOwnerCity === 'function') rememberCastleOwnerCity('kent');
                if (typeof npcClanOnSiegeResult === 'function') npcClanOnSiegeResult('kent', 'win', defenderId);
                log('<span class="text-yellow-300 font-bold">肯特城戰獲勝。</span>血盟已佔領肯特城。');
            } else {
                won = false;
                s.result = 'claim_failed';
                if (typeof rememberCastleOwnerCity === 'function') rememberCastleOwnerCity(typeof clanGetCastleCity === 'function' ? clanGetCastleCity(player) : null);
                log('<span class="text-red-400 font-bold">城戰獲勝，但血盟城堡資料寫入失敗。</span>');
            }
        } else {
            if (typeof rememberCastleOwnerCity === 'function') rememberCastleOwnerCity(typeof clanGetCastleCity === 'function' ? clanGetCastleCity(player) : null);
            if (typeof npcClanOnSiegeResult === 'function') npcClanOnSiegeResult('kent', 'lose', defenderId);
            log(`<span class="text-slate-300 font-bold">肯特城戰失敗。</span>${esc(reason || '未能在時限內完成攻城。')}`);
        }
        let timer = document.getElementById('siege-timer'); if (timer) timer.classList.add('hidden');
        let dest = won && typeof siegeVictoryActive === 'function' && siegeVictoryActive() ? 'town_kent_castle' : getHomeTown();
        setMapSelectors(dest);
        changeMap(true);
        updateUI();
        saveGame();
    }

    function handleV2Kill(mob) {
        let s = player.siege; if (!isV2(s) || !mob || !mob.siegeV2) return false;
        let stage = stageOf(s);
        s.kills = num(s.kills, 0) + 1;
        s.stageProgress = Math.min(stage.target, num(s.stageProgress, 0) + 1);
        s.stageMobHp = null;
        if (s.stageProgress < stage.target) {
            if (stage.type === 'kill' && (s.stageProgress % 5 === 0 || s.stageProgress === 1)) log(`<span class="text-amber-200">${stage.name}：${s.stageProgress}/${stage.target}</span>`);
            if (s.stageProgress % 5 === 0) saveGame();
            return true;
        }
        let next = STAGES[stage.index + 1];
        if (next) enterStage(next.id, true);
        else finish('win');
        return true;
    }

    function saveTargetHp() {
        let s = player.siege; if (!isV2(s)) return false;
        let stage = stageOf(s); if (stage.type !== 'target') return true;
        let mob = (mapState.mobs || []).find(m => m && m.siegeV2 && m.siegeUnitId === stage.unitId && !m._dead);
        if (mob) s.stageMobHp = mob.curHp;
        return true;
    }

    function mageSupportTick(now) {
        let live = (mapState.mobs || []).filter(m => m && m.siegeV2 && !m._dead && m.curHp > 0);
        let mages = live.filter(m => m.siegeUnitId === 'kent_blue_shark_mage');
        for (let mage of mages) {
            if ((mage._siegeSoulCd || 0) <= now && mage.mp >= 20) {
                let t = live.find(m => (m._siegeSoulUntil || 0) <= now);
                if (t) {
                    mage.mp -= 20; mage._siegeSoulCd = now + 2000;
                    t._siegeSoulUntil = now + 1200000;
                    t._siegeSoulBonusHp = Math.floor(t.hp * 0.20);
                    t._siegeSoulBonusMp = Math.floor((t.mmp || 0) * 0.20);
                    t.hp += t._siegeSoulBonusHp; t._siegeSetHpRaw(t.curHp + t._siegeSoulBonusHp);
                    t.mmp = (t.mmp || 0) + t._siegeSoulBonusMp; t.mp = Math.min(t.mmp, (t.mp || 0) + t._siegeSoulBonusMp);
                    triggerAnim(mage, 'skill');
                }
            }
            if ((mage._siegeHolyCd || 0) <= now && mage.mp >= 30) {
                let targets = live.filter(m => (m._siegeHolyUntil || 0) <= now).sort((a, b) => (a.curHp / a.hp) - (b.curHp / b.hp));
                if (targets.length) {
                    mage.mp -= 30; mage._siegeHolyCd = now + 8000; targets[0]._siegeHolyUntil = now + 32000;
                    triggerAnim(mage, 'skill');
                }
            }
            if ((mage._siegeFireCd || 0) <= now && mage.mp >= 16 && !player.dead) {
                mage.mp -= 16; mage._siegeFireCd = now + 5000;
                castMobMagic(mage, { skn:'燃燒的火球', dmg:[5,9], db:num(mage.matk, 0), ele:'fire', alwaysHit:true });
            }
        }
        for (let m of live) {
            if (m._siegeSoulBonusHp && (m._siegeSoulUntil || 0) <= now) {
                let hpBonus = m._siegeSoulBonusHp, mpBonus = m._siegeSoulBonusMp || 0;
                m.hp = Math.max(1, m.hp - hpBonus); m._siegeSetHpRaw(Math.min(m.curHp, m.hp));
                m.mmp = Math.max(0, (m.mmp || 0) - mpBonus); m.mp = Math.min(m.mp || 0, m.mmp);
                m._siegeSoulBonusHp = 0; m._siegeSoulBonusMp = 0;
            }
        }
    }

    function lordTick(now) {
        let lord = (mapState.mobs || []).find(m => m && m.siegeUnitId === 'castle_lord_kent' && !m._dead && m.curHp > 0);
        if (!lord) return;
        if (!lord._siegeLastDefenseUsed && lord.curHp < lord.hp * 0.35) {
            lord._siegeLastDefenseUsed = true;
            lord._siegeLastDefenseActive = true;
            lord._siegeLastDefenseUntil = now + 8000;
            lord.ac -= 5; lord.mr += 30;
            triggerAnim(lord, 'skill1');
            log('<span class="text-red-300 font-bold">肯特城主施展「肯特最後防線」！</span>');
        }
        if (lord._siegeLastDefenseActive && now >= lord._siegeLastDefenseUntil) {
            lord._siegeLastDefenseActive = false;
            lord.ac += 5; lord.mr -= 30;
            lord._siegeFatigueUntil = now + 4000;
            lord.atkSpd *= 1.25;
            log('<span class="text-emerald-300">肯特城主進入守備疲勞。</span>');
        }
        if (lord._siegeFatigueUntil && now >= lord._siegeFatigueUntil && !lord._siegeFatigueRestored) {
            lord._siegeFatigueRestored = true;
            lord.atkSpd /= 1.25;
        }
    }

    function tickV2() {
        let s = player.siege, timer = document.getElementById('siege-timer');
        if (!isV2(s)) return false;
        let stage = stageOf(s), rem = Math.max(0, num(s.endTime, 0) - Date.now());
        if (timer) {
            let mm = Math.floor(rem / 60000), ss = Math.floor((rem % 60000) / 1000);
            let progress = stage.type === 'kill' ? `${s.stageProgress || 0}/${stage.target}` : (() => {
                let m = (mapState.mobs || []).find(x => x && x.siegeV2 && !x._dead);
                return m ? `${Math.max(0, Math.ceil(m.curHp / m.hp * 100))}%` : '準備中';
            })();
            timer.textContent = `肯特城戰｜${stage.name} ${progress}｜${mm}:${String(ss).padStart(2, '0')}`;
            timer.classList.remove('hidden');
        }
        if (rem <= 0) { finish('lose', '攻城時間已結束。'); return true; }
        if ((player._siegeKentDefDownUntil || 0) > 0 && state.ticks >= player._siegeKentDefDownUntil) {
            player._siegeKentDefDownUntil = 0;
            calcStats();
        }
        if (mapState.current === stage.map) {
            mageSupportTick(Date.now());
            if (stage.id === 'kent_lord_battle') lordTick(Date.now());
        }
        return true;
    }

    function getV2Areas() {
        let s = player.siege;
        if (!isV2(s)) return null;
        let stage = stageOf(s);
        return [{ v:stage.map, t:`${stage.mapName}（${stage.index + 1}/5）` }];
    }

    function frameName(cfg, layer, frame) {
        let suffix = layer === 'shadow' ? '_s' : '';
        return `${cfg.file || 'idle'}${suffix}_${String(frame).padStart(2, '0')}.png`;
    }
    function actionFor(mob, requested) {
        let p = ANIM[mob.siegeAnimId]; if (!p) return 'idle';
        if (requested === 'attack') return p.actions.attack ? 'attack' : (p.actions.attack1 ? 'attack1' : 'idle');
        if (requested === 'skill') return p.actions.skill ? 'skill' : (p.actions.skill1 ? 'skill1' : actionFor(mob, 'attack'));
        return p.actions[requested] ? requested : 'idle';
    }
    function triggerAnim(mob, requested) {
        if (!mob || !mob.siegeV2 || typeof state !== 'undefined' && state.ff) return;
        let key = actionFor(mob, requested), p = ANIM[mob.siegeAnimId], cfg = p && p.actions[key]; if (!cfg) return;
        let now = Date.now(), cur = mob._siegeV2Anim;
        if (cur && cur.key === key && now - cur.at < 80) return;
        if (cur && cur.key !== 'idle') {
            let oldCfg = p.actions[cur.key];
            if (oldCfg && now - cur.at < oldCfg.count * (1000 / p.fps) && requested !== 'death' && requested !== 'hurt') return;
        }
        mob._siegeV2Anim = { key, at:now };
    }

    function ensureLayer(inner, cls, before) {
        let el = inner.querySelector('.' + cls);
        if (!el) {
            el = document.createElement('img'); el.className = cls; el.alt = ''; el.draggable = false;
            if (before) inner.insertBefore(el, before); else inner.appendChild(el);
        }
        return el;
    }
    function applyAnimations() {
        if (document.hidden || typeof state !== 'undefined' && state.ff || !mapState || !mapState.mobs) return;
        let ml = document.getElementById('mob-list'); if (!ml) return;
        let byUid = new Map(mapState.mobs.filter(Boolean).map(m => [String(m.uid), m]));
        let now = Date.now();
        ml.querySelectorAll('.mob-target[data-uid]').forEach(card => {
            let mob = byUid.get(String(card.getAttribute('data-uid'))); if (!mob || !mob.siegeV2) return;
            let p = ANIM[mob.siegeAnimId]; if (!p) return;
            let inner = card.querySelector('.mob-img-inner'), body = inner && inner.querySelector('img:not(.mob-anim-shadow):not(.mob-anim-weapon):not(.mob-anim-weapon2):not(.siege-v2-shadow):not(.siege-v2-right)');
            if (!inner || !body) return;
            inner.classList.add('siege-v2-anim');
            if (p.rightBase) inner.classList.add('siege-v2-gate');
            let act = mob._siegeV2Anim || { key:'idle', at:now };
            let cfg = p.actions[act.key] || p.actions.idle;
            let elapsed = Math.floor((now - act.at) / (1000 / p.fps));
            if (!cfg.loop && elapsed >= cfg.count) {
                act = mob._siegeV2Anim = { key:'idle', at:now };
                cfg = p.actions.idle; elapsed = 0;
            }
            let frame = cfg.start + (cfg.loop ? elapsed % cfg.count : Math.min(cfg.count - 1, elapsed));
            body.src = `${p.base}/${frameName(cfg, 'body', frame)}`;
            if (p.shadow) {
                let shadow = ensureLayer(inner, 'siege-v2-shadow', body);
                shadow.src = `${p.base}/${frameName(cfg, 'shadow', frame)}`;
            }
            if (p.rightBase) {
                let right = ensureLayer(inner, 'siege-v2-right');
                right.src = `${p.rightBase}/${frameName(cfg, 'body', frame)}`;
            }
        });
    }

    function playDeath(mob) {
        if (!mob || !mob.siegeV2 || document.hidden || typeof state !== 'undefined' && state.ff) return;
        let p = ANIM[mob.siegeAnimId], cfg = p && p.actions.death; if (!cfg) return;
        let ml = document.getElementById('mob-list'), card = ml && ml.querySelector(`.mob-target[data-uid="${mob.uid}"]`);
        let body = card && card.querySelector('.mob-img-inner img:not(.siege-v2-shadow):not(.siege-v2-right)');
        let layer = typeof _vfxLayer === 'function' ? _vfxLayer() : null; if (!body || !layer) return;
        let r = body.getBoundingClientRect(), ghost = document.createElement('img');
        ghost.className = 'vfx-ghost siege-v2-death'; ghost.style.left = (r.left + r.width / 2) + 'px'; ghost.style.top = (r.top + r.height / 2) + 'px'; ghost.style.width = r.width + 'px'; ghost.style.height = r.height + 'px';
        layer.appendChild(ghost);
        let i = 0, draw = () => { ghost.src = `${p.base}/${frameName(cfg, 'body', cfg.start + i)}`; };
        draw();
        let iv = setInterval(() => { i++; if (i >= cfg.count || !ghost.isConnected) { clearInterval(iv); ghost.remove(); return; } draw(); }, 1000 / p.fps);
        setTimeout(() => { clearInterval(iv); if (ghost.isConnected) ghost.remove(); }, cfg.count * (1000 / p.fps) + 1500);
    }

    function installCss() {
        if (document.getElementById('siege-v2-style')) return;
        let style = document.createElement('style'); style.id = 'siege-v2-style';
        style.textContent = `
            .siege-castle-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));grid-auto-rows:1fr;gap:.95rem .8rem;width:100%;align-items:stretch}
            .siege-castle-choice{position:relative;display:flex;width:100%;height:100%;min-width:0;min-height:92px;padding:.65rem .5rem;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;text-align:center;background:linear-gradient(145deg,var(--siege-bg-a),var(--siege-bg-b));border:1px solid var(--siege-border);color:var(--siege-text);box-shadow:inset 0 1px 0 rgba(255,255,255,.11),0 3px 10px var(--siege-glow);transition:filter .16s ease,transform .16s ease,box-shadow .16s ease}
            .siege-castle-choice::after{content:"";position:absolute;right:12%;bottom:0;left:12%;height:3px;background:var(--siege-accent);box-shadow:0 0 8px var(--siege-glow);opacity:.9}
            .siege-castle-choice.is-open:hover{filter:brightness(1.13);transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 5px 14px var(--siege-glow)}
            .siege-castle-choice.is-locked{cursor:not-allowed;filter:saturate(.7) brightness(.74);opacity:.84}
            .siege-castle-choice.siege-castle-capital{box-shadow:inset 0 0 0 1px rgba(255,240,168,.14),inset 0 1px 0 rgba(255,255,255,.12),0 3px 12px var(--siege-glow)}
            .siege-castle-title{display:flex;min-width:0;align-items:center;justify-content:center;gap:.32rem;font-size:1rem;font-weight:800;line-height:1.2;color:var(--siege-text)}
            .siege-castle-icon{font-size:1.08rem;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.72))}
            .siege-castle-status,.siege-castle-defender{display:block;max-width:100%;margin-top:.35rem;font-size:.7rem;line-height:1.25;color:rgba(226,232,240,.88);overflow-wrap:anywhere}
            .siege-castle-defender{margin-top:.2rem;color:rgba(203,213,225,.82)}
            @media(max-width:480px){.siege-castle-grid{gap:.4rem}.siege-castle-choice{min-height:104px;padding:.55rem .3rem}.siege-castle-title{gap:.2rem;font-size:.86rem}.siege-castle-icon{font-size:.95rem}.siege-castle-status,.siege-castle-defender{font-size:.63rem}}
            .siege-v2-anim{position:relative;display:inline-block}.siege-v2-shadow,.siege-v2-right{position:absolute;inset:0;width:100%;height:100%;padding:.25rem;object-fit:contain;pointer-events:none}.siege-v2-shadow{z-index:0;mix-blend-mode:multiply}.siege-v2-anim>img:not(.siege-v2-shadow):not(.siege-v2-right){position:relative;z-index:1}.siege-v2-right{z-index:2;transform:translateX(34%)}.siege-v2-gate>img:not(.siege-v2-shadow):not(.siege-v2-right){transform:translateX(-34%)}`;
        document.head.appendChild(style);
    }

    const old = {
        openSiegeSelect:global.openSiegeSelect,
        startSiege:global.startSiege,
        endSiege:global.endSiege,
        siegeTick:global.siegeTick,
        saveSiegeBossHp:global.saveSiegeBossHp,
        handleSiegeKill:global.handleSiegeKill,
        getSiegeAreas:global.getSiegeAreas,
        spawnMob:global.spawnMob,
        changeMap:global.changeMap,
        mobAnimTrigger:global._mobAnimTrigger,
        mobAnimApply:global._mobAnimApply,
        castMobMagic:global.castMobMagic,
        vfxKill:global.vfxKill,
        calcStats:global.calcStats
    };

    global.openSiegeSelect = openV2SiegeSelect;
    global.startSiege = function (faction, city) {
        city = city || 'kent';
        if (LEGACY_CASTLES.has(city)) return old.startSiege ? old.startSiege(faction, city) : undefined;
        return openPreparation(city);
    };
    global.endSiege = function (result) { if (isV2(player.siege)) finish(result === 'win' ? 'win' : 'lose'); else if (old.endSiege) old.endSiege(result); };
    global.siegeTick = function () { if (!tickV2() && old.siegeTick) old.siegeTick(); };
    global.saveSiegeBossHp = function () { if (!saveTargetHp() && old.saveSiegeBossHp) old.saveSiegeBossHp(); };
    global.handleSiegeKill = function (mob) { if (!handleV2Kill(mob) && old.handleSiegeKill) old.handleSiegeKill(mob); };
    global.getSiegeAreas = function () { return getV2Areas() || (old.getSiegeAreas ? old.getSiegeAreas() : []); };
    global.spawnMob = function (idx) { if (spawnForStage(idx)) return; return old.spawnMob ? old.spawnMob(idx) : undefined; };
    global.changeMap = function (force) {
        let before = mapState.current, r = old.changeMap ? old.changeMap(force) : undefined;
        let s = player.siege, stage = stageOf(s);
        if (isV2(s) && mapState.current === stage.map && before !== mapState.current) {
            s.stageSpawned = stage.type === 'kill' ? num(s.stageProgress, 0) : 0;
            fillStage();
        }
        return r;
    };
    global._mobAnimTrigger = function (mob, action) {
        if (mob && mob.siegeV2) triggerAnim(mob, action);
        if (old.mobAnimTrigger) return old.mobAnimTrigger(mob, action);
    };
    global._mobAnimApply = function () {
        if (old.mobAnimApply) old.mobAnimApply();
        applyAnimations();
    };
    global.castMobMagic = function (mob, sk) {
        if (mob && mob.siegeV2 && sk && sk._siegeHeavy) {
            mob._siegeV2Anim = { key:'attack2', at:Date.now() };
            let hpBefore = player.hp, hitBefore = mob.hit;
            mob.hit = num(mob.hit, 0) + 1;
            let result = old.castMobMagic ? old.castMobMagic(mob, sk) : undefined;
            mob.hit = hitBefore;
            if (!player.dead && player.hp < hpBefore) {
                player.statuses.stun = Math.max(num(player.statuses.stun, 0), 5);
                player._siegeKentDefDownUntil = state.ticks + 40;
                calcStats();
                logCombat('<span class="text-red-300">破陣突刺使你硬直 0.5 秒，防禦降低 3（4 秒）。</span>', 'enemy');
            }
            return result;
        }
        return old.castMobMagic ? old.castMobMagic(mob, sk) : undefined;
    };
    global.vfxKill = function (mob) {
        if (mob && mob.siegeV2) playDeath(mob);
        return old.vfxKill ? old.vfxKill(mob) : undefined;
    };
    global.calcStats = function () {
        let result = old.calcStats ? old.calcStats.apply(this, arguments) : undefined;
        if (player && player.d && typeof state !== 'undefined' && (player._siegeKentDefDownUntil || 0) > state.ticks) player.d.ac += 3;
        return result;
    };

    global.siegeV2BeginKent = beginKent;
    global.siegeV2Forfeit = function () { if (isV2(player.siege) && confirm('確定放棄本次肯特城戰嗎？')) finish('lose', '你已放棄本次攻城。'); };
    global.SiegeV2 = Object.freeze({ version:VERSION, castles:CASTLES, stages:STAGES, eligibility, buildUnit, buildBuilding, beginKent, finish });

    try {
        STAGES.forEach(stage => {
            if (!SIEGE_OUTER_INNER.includes(stage.map)) SIEGE_OUTER_INNER.push(stage.map);
            DB.maps[stage.map] = DB.maps[stage.map] || [];
            SPECIAL_AREA_BG[stage.map] = stage.bg;
        });
    } catch (e) { console.error('Siege V2 map registration failed', e); }
    installCss();
})(window);
