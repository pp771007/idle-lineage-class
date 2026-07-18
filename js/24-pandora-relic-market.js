// 潘朵拉遺物布告欄＋安全區玩家收購系統
// 共用資料獨立於角色存檔：同一套遊戲的所有角色共用龍之鑽石、玩家 NPC 與三個遺物欄位。
(function () {
    'use strict';

    const TEST_BUILD = !!(typeof window !== 'undefined' && window.__FB5_TEST_BUILD);
    const STORE_KEY = 'fb5_pandora_relic_market_v1';
    const LOCK_KEY = STORE_KEY + '_lock';
    const STORE_VERSION = 2;
    const CHECK_MS = (TEST_BUILD ? 3 : 10) * 60 * 1000;
    const WANDERER_LIFE_MS = 2 * 60 * 60 * 1000;
    const BROADCAST_MS = 3 * 60 * 1000;
    const BOARD_COOLDOWN_MS = 24 * 60 * 60 * 1000;
    const RELIC_SEARCH_COST = 100;
    const WANDERER_CHANCE = TEST_BUILD ? 1 : 0.05;

    const EXCLUDED_TOWNS = new Set([
        'town_silent',          // 拉斯塔巴德／沉默洞穴系安全區
        'town_elder_council',   // 拉斯塔巴德長老會議廳
        'town_pride',           // 傲慢之塔
        'town_rift',            // 時空裂痕
        'town_sherine'          // 席琳神殿
    ]);
    const EXCLUDED_TOWN_NAMES = ['拉斯塔巴德', '傲慢之塔', '時空裂痕', '席琳神殿'];

    const PLAYER_AVATARS = [
        '王子', '公主', '男騎士', '女騎士', '男法師', '女法師', '男妖精', '女妖精',
        '男黑暗妖精', '女黑暗妖精', '男幻術士', '女幻術士', '男龍騎士', '女龍騎士', '男戰士', '女戰士'
    ];
    const NAME_PREFIX = ['蒼', '緋', '玄', '墨', '銀', '白', '青', '赤', '紫', '碧', '幽', '夜', '月', '星', '霜', '雪', '風', '雲', '雷', '炎', '燼', '影', '夢', '幻', '孤', '醉', '逆', '零'];
    const NAME_IMAGE = ['狼', '狐', '龍', '羽', '刃', '劍', '弦', '花', '葉', '海', '川', '山', '嵐', '歌', '月', '星', '塵', '魂', '心', '影', '光', '痕'];
    const NAME_TITLE = ['行者', '旅人', '浪客', '劍士', '術士', '獵人', '守望者', '歸人', '逐風者', '追月者', '無眠', '未央', '長歌', '無雙'];
    const NAME_SURNAME = ['南宮', '上官', '司徒', '慕容', '東方', '北辰', '長孫', '令狐', '歐陽', '夏侯'];
    const NAME_GIVEN = ['無月', '長歌', '聽雪', '清風', '流雲', '暮雨', '星河', '青鋒', '白夜', '未央', '若水', '凌霜'];
    const NAME_CASUAL = ['小隊長', '老玩家', '別打我', '路過', '掛機中', '求組隊', '練功中', '只收不賣', '佛系玩家'];
    const SILENCE_COMPLAINTS = [
        '吵死了', '安靜一點', '別再喊了', '不要一直廣播', '別洗了', '可以停一下嗎', '別再洗頻了', '安靜啦',
        '不要重複喊', '我已經看到了', '別一直刷訊息', '可以閉嘴了', '讓日誌安靜一下', '不要再洗版', '停一下好嗎', '夠了喔',
        '別喊個不停', '大家都看見了', '不要一直刷存在感', '休息一下吧', '請停止廣播', '耳朵都要聾了', '真的很吵', '不要再重複了',
        '訊息看到了別再喊', '安靜三分鐘好嗎', '別一直佔日誌', '讓別人說話啦', '不要再刷頻', '已經知道你要收了', '先停一下', '別吵了',
        '能不能小聲一點', '請你安靜', '廣播到此為止', '不用再提醒了', '別再大聲宣傳', '日誌都被你洗掉了', '不要每次都喊', '收購訊息看到了',
        '可以不要洗畫面嗎', '安靜做生意吧', '別再吵大家', '讓頻道休息一下', '不用一直宣傳', '停手吧廣播王', '別把日誌當你家', '少喊兩句',
        '這裡不是廣播台', '請停止洗頻行為', '別再連續宣傳', '你的收購大家知道了', '先安靜做生意', '不要再佔版面', '可以收聲了', '別一直洗同一句',
        '拜託安靜一下', '不要再廣播收購了', '讓我看其他訊息', '你的廣播太密集了', '別再吵人了', '到此為止吧', '停止重播', '請把廣播關掉'
    ];
    const SILENCE_APOLOGIES = [
        '對不起', '抱歉', '打擾了', '不好意思', '真的很抱歉', '我會安靜的', '對不起我不喊了', '抱歉打擾大家',
        '知道了，我會停下來', '不好意思，我收聲', '抱歉，我沒注意到', '對不起，造成困擾了', '我這就停止廣播', '抱歉讓你覺得吵', '不好意思，打擾你了', '收到，我不再喊了',
        '對不起，我安靜做生意', '抱歉，是我喊太多次了', '我明白了，對不起', '不好意思，我會克制', '抱歉佔用日誌了', '對不起，已經關掉廣播', '我不再重複了，抱歉', '抱歉影響你看訊息',
        '不好意思，馬上停止', '對不起，讓大家困擾了', '抱歉，我會保持安靜', '了解，我不廣播了', '是我太吵了，對不起', '抱歉，我只是急著收東西', '不好意思，我會小聲點', '收到，我停止宣傳',
        '對不起，不會再洗頻了', '抱歉，我這就閉麥', '不好意思，造成打擾', '了解，接下來我會安靜', '對不起，我不再刷訊息', '抱歉，讓你的日誌被洗掉了', '我會停手，真的抱歉', '不好意思，是我太心急',
        '對不起，我沒有惡意', '抱歉，我馬上關掉廣播', '收到，之後不再打擾', '不好意思，我安靜等人來', '抱歉，我會耐心一點', '對不起，辛苦你提醒了', '好，我不喊了，抱歉', '不好意思，廣播已停止',
        '抱歉，我會注意頻率', '對不起，讓你不舒服了', '了解，謝謝提醒', '不好意思，我不再佔版面', '抱歉，接下來保持安靜', '收到，我會乖乖等', '對不起，我已經停止重播', '抱歉，是我宣傳過頭了',
        '不好意思，我不再吵大家', '了解，廣播到此為止', '對不起，我會改進', '抱歉，給你添麻煩了', '不好意思，我這就停', '收到，請別生氣', '對不起，打擾到你了', '抱歉，我會安靜等候'
    ];

    const RELIC_CATEGORIES = {
        weapon: { label: '武器遺物', short: '武器' },
        armor: { label: '防具遺物', short: '防具' },
        accessory: { label: '飾品遺物', short: '飾品' }
    };

    let _lastBroadcastCycles = Object.create(null);
    let _lastMapSignature = '';
    let _classFrameCache = Object.create(null);
    let _wanderingShoutMenu = null;

    function _esc(s) {
        if (typeof _pandoraEsc === 'function') return _pandoraEsc(s);
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[c]);
    }

    function _defaultState() {
        return {
            v: STORE_VERSION,
            seed: 'pb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
            seq: 0,
            lastCheckBucket: -1,
            diamonds: 0,
            wanderers: [],
            boards: [
                { contract: null, cooldownUntil: 0 },
                { contract: null, cooldownUntil: 0 },
                { contract: null, cooldownUntil: 0 }
            ],
            nameHistory: [],
            updatedAt: Date.now()
        };
    }

    function _normalizeState(value) {
        let st = value && typeof value === 'object' ? value : _defaultState();
        st.v = STORE_VERSION;
        if (!st.seed) st.seed = _defaultState().seed;
        st.seq = Math.max(0, Math.floor(Number(st.seq) || 0));
        st.lastCheckBucket = Number.isFinite(Number(st.lastCheckBucket)) ? Math.floor(Number(st.lastCheckBucket)) : -1;
        st.diamonds = Math.max(0, Math.floor(Number(st.diamonds) || 0));
        // v1 僅能保存全遊戲一名玩家 NPC；v2 改為每個符合條件的安全區各自最多一名。
        let oldWanderer = st.wanderer && typeof st.wanderer === 'object' ? st.wanderer : null;
        let wanderers = Array.isArray(st.wanderers) ? st.wanderers.slice() : [];
        if (oldWanderer) wanderers.push(oldWanderer);
        let seenTown = new Set();
        let seenId = new Set();
        st.wanderers = wanderers.filter(w => {
            if (!w || typeof w !== 'object' || !w.id || !w.townId) return false;
            if (seenTown.has(w.townId) || seenId.has(w.id)) return false;
            seenTown.add(w.townId);
            seenId.add(w.id);
            w.broadcastStopped = !!w.broadcastStopped;
            w.quietAt = Math.max(0, Math.floor(Number(w.quietAt) || 0));
            return true;
        });
        delete st.wanderer;
        if (!Array.isArray(st.boards)) st.boards = [];
        st.boards = [0, 1, 2].map(i => {
            let b = st.boards[i] && typeof st.boards[i] === 'object' ? st.boards[i] : {};
            return {
                contract: b.contract && typeof b.contract === 'object' ? b.contract : null,
                cooldownUntil: Math.max(0, Math.floor(Number(b.cooldownUntil) || 0))
            };
        });
        delete st.equipmentProofUntil;   // 舊版「裝備僅查驗」資料不再使用；現在交易會直接消耗裝備。
        st.nameHistory = Array.isArray(st.nameHistory) ? st.nameHistory.filter(x => typeof x === 'string').slice(-20) : [];
        st.updatedAt = Math.max(0, Math.floor(Number(st.updatedAt) || 0));
        return st;
    }

    function _readState() {
        try {
            let raw = _lzGet(STORE_KEY);
            if (!raw) return _defaultState();
            let unwrapped = _saveUnwrap(raw);
            if (!unwrapped.ok) return _defaultState();
            return _normalizeState(JSON.parse(unwrapped.payload));
        } catch (e) {
            return _defaultState();
        }
    }

    function _writeState(st) {
        try {
            st.updatedAt = Date.now();
            return _lzSet(STORE_KEY, _saveWrap(JSON.stringify(_normalizeState(st)))) !== false;
        } catch (e) {
            return false;
        }
    }

    function _withStateLock(mutator) {
        let now = Date.now();
        let token = Math.random().toString(36).slice(2) + now.toString(36);
        let stamp = token + '|' + now;
        try {
            let old = _lsGet(LOCK_KEY);
            if (old) {
                let p = old.lastIndexOf('|');
                let oldAt = p >= 0 ? Number(old.slice(p + 1)) : 0;
                if (oldAt && now - oldAt < 5000) return { ok: false, busy: true };
            }
            _lsSet(LOCK_KEY, stamp);
            if (_lsGet(LOCK_KEY) !== stamp) return { ok: false, busy: true };
            let st = _readState();
            let result = mutator(st) || {};
            if (result.commit === false) return Object.assign({ ok: false, state: st }, result);
            if (!_writeState(st)) return { ok: false, error: '共用資料儲存失敗，請稍後重試。', state: st };
            return Object.assign({ ok: true, state: st }, result);
        } catch (e) {
            return { ok: false, error: '共用資料暫時忙碌，請稍後重試。' };
        } finally {
            try { if (_lsGet(LOCK_KEY) === stamp) _lsRemove(LOCK_KEY); } catch (e) {}
        }
    }

    function _rand(st, tag) {
        let n = st.seq++;
        return _seededFloat(st.seed + '|' + n + '|' + String(tag || ''));
    }

    function _pick(st, list, tag) {
        if (!list || !list.length) return null;
        return list[Math.floor(_rand(st, tag) * list.length) % list.length];
    }

    function _isEquipmentDef(d) {
        if (!d) return false;
        return d.type === 'wpn' || d.type === 'arm' || d.type === 'acc' || d.slot === 'petwpn' || d.slot === 'petarm';
    }

    function _isEnhanceableDef(d) {
        return _isEquipmentDef(d) && !d.noEnhance && !d.isArrow && Number.isFinite(Number(d.safe));
    }

    function _safeValue(d) {
        return Math.max(0, Math.min(20, Math.floor(Number(d && d.safe) || 0)));
    }

    function _requirementText(id, en) {
        let d = DB.items[id];
        if (!d) return id;
        return (en == null ? '' : ('+' + en + ' ')) + d.n;
    }

    function _townName(id) {
        return DB.towns && DB.towns[id] ? DB.towns[id].n : id;
    }

    function _eligibleTowns() {
        if (typeof DB === 'undefined' || !DB.towns) return [];
        return Object.keys(DB.towns).filter(id => {
            let t = DB.towns[id];
            if (!t || EXCLUDED_TOWNS.has(id)) return false;
            let name = String(t.n || '');
            return !EXCLUDED_TOWN_NAMES.some(x => name.includes(x));
        });
    }

    function _wandererItemPool() {
        if (typeof DB === 'undefined' || !DB.items) return [];
        return Object.keys(DB.items).filter(id => {
            let d = DB.items[id];
            let w = Math.floor(Number(d && d.gachaWeight) || 0);
            return !!(d && d.n && !d.relic && w >= 1 && w <= 10);
        });
    }

    function _makeName(st) {
        let history = new Set(st.nameHistory || []);
        let made = '';
        for (let tries = 0; tries < 12; tries++) {
            let mode = _rand(st, 'name-mode');
            if (mode < 0.40) {
                made = _pick(st, NAME_PREFIX, 'name-prefix') + _pick(st, NAME_IMAGE, 'name-image') + _pick(st, NAME_TITLE, 'name-title');
            } else if (mode < 0.65) {
                made = _pick(st, NAME_SURNAME, 'name-surname') + _pick(st, NAME_GIVEN, 'name-given');
            } else if (mode < 0.85) {
                made = _pick(st, NAME_PREFIX, 'name-prefix2') + _pick(st, NAME_GIVEN, 'name-given2');
            } else {
                made = _pick(st, NAME_CASUAL, 'name-casual');
            }
            if (!history.has(made)) break;
        }
        st.nameHistory.push(made);
        st.nameHistory = st.nameHistory.slice(-20);
        return made;
    }

    function _makeWanderer(st, now, townId) {
        let towns = _eligibleTowns();
        let items = _wandererItemPool();
        if (!towns.length || !items.length) return null;
        if (!townId || !towns.includes(townId)) townId = _pick(st, towns, 'wander-town');
        let itemId = _pick(st, items, 'wander-item');
        let d = DB.items[itemId];
        let en = null;
        if (_isEnhanceableDef(d)) {
            let max = _safeValue(d) + 3;
            en = Math.floor(_rand(st, 'wander-enhance') * (max + 1));
        }
        let weight = Math.max(1, Math.min(10, Math.floor(Number(d.gachaWeight) || 10)));
        let over = en == null ? 0 : Math.max(0, en - _safeValue(d));
        let mult = over === 1 ? 1.2 : over === 2 ? 1.5 : over >= 3 ? 2 : 1;
        let reward = Math.max(1, Math.ceil((11 - weight) * mult));
        return {
            id: 'wander-' + now.toString(36) + '-' + Math.floor(_rand(st, 'wander-id') * 0xffffff).toString(36),
            townId: townId,
            name: _makeName(st),
            avatar: _pick(st, PLAYER_AVATARS, 'wander-avatar'),
            itemId: itemId,
            en: en,
            weight: weight,
            reward: reward,
            spawnedAt: now,
            expiresAt: now + WANDERER_LIFE_MS,
            broadcastStopped: false,
            quietAt: 0
        };
    }

    function _activeSignature(wanderers) {
        if (!Array.isArray(wanderers)) return '';
        return wanderers
            .filter(w => w && w.id && w.townId)
            .map(w => [w.id, w.townId, w.expiresAt].join('|'))
            .sort()
            .join('||');
    }

    function _findWanderer(st, wandererId) {
        if (!st || !Array.isArray(st.wanderers)) return null;
        return st.wanderers.find(w => w && w.id === wandererId) || null;
    }

    function _findWandererForTown(st, townId) {
        if (!st || !Array.isArray(st.wanderers)) return null;
        return st.wanderers.find(w => w && w.townId === townId && Number(w.expiresAt) > Date.now()) || null;
    }

    function _currentTownWanderer(st) {
        let townId = typeof mapState !== 'undefined' && mapState ? mapState.current : '';
        return _findWandererForTown(st, townId);
    }

    function _announceWanderer(w) {
        if (!w || w.broadcastStopped) return;
        if (typeof player === 'undefined' || !player || typeof logSys !== 'function') return;
        if (typeof state !== 'undefined' && state && state.ff) return;
        let spawnedAt = Math.max(0, Number(w.spawnedAt) || Date.now());
        let cycle = Math.max(0, Math.floor((Date.now() - spawnedAt) / BROADCAST_MS));
        if (_lastBroadcastCycles[w.id] === cycle) return;
        _lastBroadcastCycles[w.id] = cycle;
        // 名稱可點擊；選擇「吵死了」後只會停止這名玩家後續的廣播。
        logSys(
            `<button type="button" class="wander-broadcast-name" ` +
            `onclick="openWanderingShoutMenu('${_esc(w.id)}',event)">${_esc(w.name)}</button>` +
            `<span class="wander-broadcast-text">：收 ${_esc(_requirementText(w.itemId, w.en))}，人在 ` +
            `<span class="text-amber-200">${_esc(_townName(w.townId))}</span>，意者密</span>`
        );
    }

    function _refreshTownMapIfNeeded(signature) {
        if (signature === _lastMapSignature) return;
        _lastMapSignature = signature;
        try {
            if (typeof mapState !== 'undefined' && mapState && String(mapState.current || '').startsWith('town_') &&
                typeof renderTownNPCMap === 'function') {
                renderTownNPCMap(mapState.current);
            }
        } catch (e) {}
    }

    function wanderingBuyerSystemTick() {
        if (typeof DB === 'undefined' || !DB.items || !DB.towns) return;
        let now = Date.now();
        let bucket = Math.floor(now / CHECK_MS);
        let before = _readState();
        let beforeSig = _activeSignature(before.wanderers);
        let result = _withStateLock(st => {
            let changed = false;
            let active = st.wanderers.filter(w => w && Number(w.expiresAt) > now);
            if (active.length !== st.wanderers.length) {
                st.wanderers = active;
                changed = true;
            }
            if (st.lastCheckBucket !== bucket) {
                st.lastCheckBucket = bucket;
                changed = true;
                let occupiedTowns = new Set(st.wanderers.map(w => w.townId));
                let availableTowns = _eligibleTowns().filter(id => !occupiedTowns.has(id));
                if (availableTowns.length && _rand(st, 'wander-roll|' + bucket) < WANDERER_CHANCE) {
                    let townId = _pick(st, availableTowns, 'wander-town|' + bucket);
                    let made = _makeWanderer(st, now, townId);
                    if (made) st.wanderers.push(made);
                }
            }
            return changed ? {} : { commit: false, unchanged: true };
        });
        let latest = result.state || _readState();
        let sig = _activeSignature(latest.wanderers);
        if (sig !== beforeSig || sig !== _lastMapSignature) _refreshTownMapIfNeeded(sig);
        latest.wanderers
            .filter(w => w && Number(w.expiresAt) > now)
            .forEach(_announceWanderer);
    }

    function getWanderingBuyerForTown(townId) {
        let st = _readState();
        let w = _findWandererForTown(st, townId);
        if (!w) return null;
        return Object.assign({ _wanderer: true, n: w.name, title: '玩家收購' }, w);
    }

    function wanderingBuyerSpriteData(w) {
        let folder = String((w && w.avatar) || '男騎士') + 'F';
        let key = folder + '|idle';
        if (!_classFrameCache[key]) {
            let base = 'assets/classanim/' + folder;
            let manifest = (typeof ANIM_MANIFEST !== 'undefined' && ANIM_MANIFEST) ? ANIM_MANIFEST[base] : null;
            let count = Math.max(1, Math.floor(Number(manifest && manifest.unarmed_idle_) || 8));
            let frames = [], shadows = [];
            for (let i = 0; i < count; i++) {
                let body = new Image();
                body.src = base + '/unarmed_idle_' + i + '.png';
                frames.push(body);
                let shadow = new Image();
                shadow.src = base + '/unarmed_idle_s_' + i + '.png';
                shadows.push(shadow);
            }
            _classFrameCache[key] = { folder: folder, frames: frames, shadows: shadows };
        }
        return _classFrameCache[key];
    }

    function _findMatches(requirements, st) {
        let inv = (typeof player !== 'undefined' && player && Array.isArray(player.inv)) ? player.inv : [];
        let warehouse = [];
        try {
            if (typeof loadWarehouse === 'function') {
                let w = loadWarehouse();
                warehouse = w && Array.isArray(w.items) ? w.items : [];
            }
        } catch (e) {}
        let sources = [
            { name: 'inventory', items: inv },
            { name: 'warehouse', items: warehouse }
        ];
        let used = new Set();
        let matches = [];
        for (let req of requirements) {
            let found = null;
            for (let source of sources) {
                for (let i = 0; i < source.items.length; i++) {
                    let usedKey = source.name + ':' + i;
                    if (used.has(usedKey)) continue;
                    let it = source.items[i];
                    let count = Math.floor(Number(it && it.cnt));
                    if (!Number.isFinite(count) || count < 1) count = it ? 1 : 0;
                    if (!it || it.id !== req.id || count < 1) continue;
                    if (req.en != null && Math.floor(Number(it.en) || 0) !== Math.floor(Number(req.en) || 0)) continue;
                    found = { source: source.name, index: i, item: it, usedKey: usedKey };
                    break;
                }
                if (found) break;
            }
            if (!found) return { ok: false, matches: matches, missing: req };
            used.add(found.usedKey);
            matches.push({ source: found.source, index: found.index, item: found.item, req: req });
        }
        return { ok: true, matches: matches };
    }

    function _consumeMatchedItems(matches) {
        let warehouseMatches = matches.filter(m => m.source === 'warehouse');
        if (warehouseMatches.length) {
            if (typeof loadWarehouse !== 'function' || typeof saveWarehouse !== 'function') return false;
            let w;
            try { w = loadWarehouse(); } catch (e) { return false; }
            if (!w || !Array.isArray(w.items)) return false;
            for (let m of warehouseMatches) {
                let idx = m.item && m.item.uid != null
                    ? w.items.findIndex(it => it && it.uid === m.item.uid)
                    : w.items.findIndex(it => it && it.id === m.item.id &&
                        Math.floor(Number(it.en) || 0) === Math.floor(Number(m.item.en) || 0) &&
                        !!it.bless === !!m.item.bless && !!it.anc === !!m.item.anc &&
                        String(it.attr || '') === String(m.item.attr || '') &&
                        String(it.seteff || '') === String(m.item.seteff || ''));
                if (idx < 0) return false;
                let count = Math.floor(Number(w.items[idx].cnt));
                if (!Number.isFinite(count) || count < 1) count = 1;
                count -= 1;
                if (count <= 0) w.items.splice(idx, 1);
                else w.items[idx].cnt = count;
            }
            try { if (!saveWarehouse(w)) return false; } catch (e) { return false; }
        }

        let remove = [];
        for (let m of matches.filter(x => x.source !== 'warehouse')) {
            let live = m.item && m.item.uid != null
                ? player.inv.find(it => it && it.uid === m.item.uid)
                : player.inv.find(it => it === m.item);
            if (!live) return false;
            let count = Math.floor(Number(live.cnt));
            if (!Number.isFinite(count) || count < 1) count = 1;
            count -= 1;
            if (count <= 0) remove.push(live);
            else live.cnt = count;
        }
        if (remove.length) player.inv = player.inv.filter(it => !remove.includes(it));
        return true;
    }

    function _remainingText(ms) {
        ms = Math.max(0, Number(ms) || 0);
        let totalMin = Math.ceil(ms / 60000);
        let d = Math.floor(totalMin / 1440);
        let h = Math.floor((totalMin % 1440) / 60);
        let m = totalMin % 60;
        if (d) return `${d}天 ${h}小時`;
        if (h) return `${h}小時 ${m}分`;
        return `${Math.max(1, m)}分`;
    }

    function _closeWanderingShoutMenu() {
        if (_wanderingShoutMenu && _wanderingShoutMenu.parentNode) {
            _wanderingShoutMenu.parentNode.removeChild(_wanderingShoutMenu);
        }
        _wanderingShoutMenu = null;
    }

    function openWanderingShoutMenu(wandererId, ev) {
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
        _closeWanderingShoutMenu();
        let st = _readState();
        let w = _findWanderer(st, wandererId);
        if (!w || w.broadcastStopped || Number(w.expiresAt) <= Date.now()) return;

        let menu = document.createElement('div');
        menu.id = 'wandering-shout-menu';
        menu.className = 'wandering-shout-menu';
        menu.innerHTML =
            `<button type="button" onclick="silenceWanderingBuyer('${_esc(w.id)}')">吵死了</button>` +
            `<button type="button" onclick="hurryToWanderingBuyer('${_esc(w.id)}')">馬上到</button>`;
        document.body.appendChild(menu);

        let x = ev && Number.isFinite(ev.clientX) ? ev.clientX : Math.round(window.innerWidth / 2);
        let y = ev && Number.isFinite(ev.clientY) ? ev.clientY : Math.round(window.innerHeight / 2);
        let rect = menu.getBoundingClientRect();
        menu.style.left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)) + 'px';
        menu.style.top = Math.max(8, Math.min(y + 8, window.innerHeight - rect.height - 8)) + 'px';
        _wanderingShoutMenu = menu;

        setTimeout(() => {
            document.addEventListener('click', function closeShoutMenu(e) {
                if (!_wanderingShoutMenu || !_wanderingShoutMenu.contains(e.target)) _closeWanderingShoutMenu();
            }, { once: true });
        }, 0);
    }

    function _stopWanderingBroadcast(wandererId) {
        return _withStateLock(st => {
            let w = _findWanderer(st, wandererId);
            if (!w || Number(w.expiresAt) <= Date.now()) {
                return { commit: false, error: '這名玩家已經離開。' };
            }
            if (w.broadcastStopped) return { commit: false, already: true, name: w.name };
            w.broadcastStopped = true;
            w.quietAt = Date.now();
            return { name: w.name };
        });
    }

    function silenceWanderingBuyer(wandererId) {
        let st = _readState();
        let w = _findWanderer(st, wandererId);
        if (!w || Number(w.expiresAt) <= Date.now()) {
            _closeWanderingShoutMenu();
            return;
        }
        let complaint = SILENCE_COMPLAINTS[Math.floor(Math.random() * SILENCE_COMPLAINTS.length)];
        let apology = SILENCE_APOLOGIES[Math.floor(Math.random() * SILENCE_APOLOGIES.length)];
        let result = _stopWanderingBroadcast(w.id);
        _closeWanderingShoutMenu();
        if (!result.ok) return;

        _lastBroadcastCycles[w.id] = 'quiet';
        if (typeof logSys === 'function') {
            logSys(
                `<span class="wander-chat-out"><span class="wander-chat-arrow">-&gt;</span> ` +
                `<span class="wander-chat-target">[${_esc(w.name)}]</span> ${_esc(complaint)}</span>`
            );
            logSys(
                `<span class="wander-chat-in"><span class="wander-chat-speaker">[${_esc(w.name)}]</span> ` +
                `${_esc(apology)}</span>`
            );
        }
    }

    function hurryToWanderingBuyer(wandererId) {
        let st = _readState();
        let w = _findWanderer(st, wandererId);
        if (!w || Number(w.expiresAt) <= Date.now()) {
            _closeWanderingShoutMenu();
            return;
        }
        if (!DB.towns || !DB.towns[w.townId] ||
            typeof setMapSelectors !== 'function' || typeof changeMap !== 'function') {
            _closeWanderingShoutMenu();
            if (typeof logSys === 'function') {
                logSys('<span class="text-red-400">目前無法前往該玩家所在的安全區。</span>');
            }
            return;
        }

        let result = _stopWanderingBroadcast(w.id);
        _closeWanderingShoutMenu();
        if (!result.ok) return;
        _lastBroadcastCycles[w.id] = 'quiet';

        if (typeof logSys === 'function') {
            logSys(
                `<span class="wander-chat-out"><span class="wander-chat-arrow">-&gt;</span> ` +
                `<span class="wander-chat-target">[${_esc(w.name)}]</span> 馬上到</span>`
            );
        }

        // 直接前往玩家所在的安全區；同步清理各種旅程狀態，避免強制轉場後殘留。
        if (typeof state !== 'undefined' && state) {
            if (state.prideClimb) {
                if (state.prideRanked && typeof prideRecord === 'function') prideRecord(state.prideFloor || 2);
                state.prideClimb = false;
                state.prideRanked = false;
                state.prideFloor = 0;
            }
            if (state.riftRun && typeof riftEndRun === 'function') riftEndRun();
            if (state.oblivion) {
                state.oblivion = null;
                state._oblivionAdvance = false;
            }
        }

        setMapSelectors(w.townId);
        changeMap(true);
        if (typeof logSys === 'function') {
            logSys(`<span class="text-emerald-300">你傳送到了 ${_esc(_townName(w.townId))}。</span>`);
        }
        try { saveGame(); } catch (e) {}
    }

    function openWanderingBuyerDialog(wandererId) {
        let st = _readState();
        let w = wandererId ? _findWanderer(st, wandererId) : _currentTownWanderer(st);
        if (!w || Number(w.expiresAt) <= Date.now()) {
            if (typeof logSys === 'function') logSys('<span class="text-slate-400">這名玩家已經離開。</span>');
            _refreshTownMapIfNeeded(_activeSignature(st.wanderers));
            return;
        }
        if (typeof mapState !== 'undefined' && mapState && mapState.current !== w.townId) return;
        if (!w.broadcastStopped) {
            _stopWanderingBroadcast(w.id);
            _lastBroadcastCycles[w.id] = 'quiet';
        }
        if (typeof openTownFloatWindow === 'function') {
            openTownFloatWindow(w.name, '玩家收購', div => renderWanderingBuyerDialog(div, w.id));
        }
    }

    function renderWanderingBuyerDialog(div, wandererId) {
        if (!div) return;
        let st = _readState();
        let w = wandererId ? _findWanderer(st, wandererId) : _currentTownWanderer(st);
        if (!w || Number(w.expiresAt) <= Date.now()) {
            div.innerHTML = '<div class="p-8 text-center text-slate-400">這名玩家已經離開。</div>';
            return;
        }
        let d = DB.items[w.itemId];
        let req = { id: w.itemId, en: w.en };
        let match = _findMatches([req], st);
        let icon = d ? getIconUrl(d) : '';
        let proofText = d && _isEquipmentDef(d)
            ? '成交後會消耗道具欄或倉庫內這件指定裝備；已穿戴的裝備不會被消耗。'
            : '成交後會消耗道具欄或倉庫內 1 個指定物品。';
        div.innerHTML = `
            <div class="wandering-buyer-dialog">
                <div class="wandering-buyer-head">
                    <div class="wandering-buyer-avatar">${_esc(w.avatar || '')}</div>
                    <div>
                        <div class="wandering-buyer-line">${_esc(w.name)}：收 <b>${_esc(_requirementText(w.itemId, w.en))}</b></div>
                        <div class="wandering-buyer-meta">位於 ${_esc(_townName(w.townId))}・剩餘 ${_remainingText(w.expiresAt - Date.now())}</div>
                    </div>
                </div>
                <div class="wandering-buyer-offer">
                    <img src="${_esc(icon)}" alt="" onmouseenter="pandoraRelicTipShow(event,'${_esc(w.itemId)}')" onmousemove="pandoraTipMove(event)" onmouseleave="pandoraTipHide()">
                    <div class="wandering-buyer-offer-main">
                        <div class="${d ? getItemColor({ id: w.itemId }) : ''}">${_esc(_requirementText(w.itemId, w.en))}</div>
                        <div class="wandering-buyer-reward">報酬：龍之鑽石 × ${w.reward}</div>
                        <div class="wandering-buyer-note">${_esc(proofText)}</div>
                    </div>
                    <div class="${match.ok ? 'text-green-400' : 'text-red-400'} wandering-buyer-state">${match.ok ? '可交付' : '道具欄／倉庫缺少'}</div>
                </div>
                <button class="btn wandering-buyer-submit ${match.ok ? '' : 'opacity-60'}" onclick="performWanderingBuyerTrade('${_esc(w.id)}')">交付物品</button>
                <div id="wandering-buyer-msg"></div>
            </div>`;
    }

    function _wanderingMessage(text, error) {
        let el = document.getElementById('wandering-buyer-msg');
        if (el) el.innerHTML = `<span class="${error ? 'text-red-400' : 'text-green-400'}">${_esc(text)}</span>`;
    }

    function performWanderingBuyerTrade(wandererId) {
        let before = _readState();
        let w = wandererId ? _findWanderer(before, wandererId) : _currentTownWanderer(before);
        if (!w || Number(w.expiresAt) <= Date.now()) {
            _wanderingMessage('這名玩家已經離開。', true);
            return;
        }
        let match = _findMatches([{ id: w.itemId, en: w.en }], before);
        if (!match.ok) {
            _wanderingMessage('道具欄與倉庫內都沒有符合強化值的指定物品。', true);
            return;
        }
        let result = _withStateLock(st => {
            let liveWanderer = _findWanderer(st, w.id);
            if (!liveWanderer || Number(liveWanderer.expiresAt) <= Date.now()) {
                return { commit: false, error: '這筆收購已經結束。' };
            }
            let liveMatch = _findMatches([{ id: liveWanderer.itemId, en: liveWanderer.en }], st);
            if (!liveMatch.ok) {
                return { commit: false, error: '道具欄與倉庫內都沒有符合強化值的指定物品。' };
            }
            if (!_consumeMatchedItems(liveMatch.matches)) {
                return { commit: false, error: '交付物品時倉庫資料發生變動，請重新開啟視窗確認。' };
            }
            let reward = Math.max(1, Math.floor(Number(liveWanderer.reward) || 1));
            st.diamonds += reward;
            st.wanderers = st.wanderers.filter(entry => entry && entry.id !== liveWanderer.id);
            return { reward: reward };
        });
        if (!result.ok) {
            _wanderingMessage(result.error || '交易資料正忙碌，請稍後重試。', true);
            return;
        }
        try { saveGame(); } catch (e) {}
        try { updateUI(); renderTabs(); } catch (e) {}
        if (typeof logSys === 'function') {
            logSys(`<span class="text-amber-300">完成 ${_esc(w.name)} 的收購，獲得 <b>龍之鑽石 × ${w.reward}</b>。</span>`);
        }
        _lastMapSignature = '__force__';
        _refreshTownMapIfNeeded(_activeSignature((result.state || _readState()).wanderers));
        try { closeNpcInteraction(); } catch (e) {}
    }

    function _craftableIds() {
        let out = new Set();
        if (typeof CRAFT_RECIPES === 'undefined' || !CRAFT_RECIPES) return out;
        Object.keys(CRAFT_RECIPES).forEach(k => {
            (CRAFT_RECIPES[k] || []).forEach(r => {
                if (r && r.result && DB.items[r.result]) out.add(r.result);
            });
        });
        return out;
    }

    function _relicCategoryOf(d) {
        if (!d || !d.relic) return null;
        if (d.type === 'wpn' || d.slot === 'petwpn') return 'weapon';
        if (d.type === 'arm' || d.slot === 'petarm') return 'armor';
        if (d.type === 'acc') return 'accessory';
        return null;
    }

    function _ownedRelicIds() {
        let ids = new Set();
        if (typeof player === 'undefined' || !player) return ids;
        (player.inv || []).forEach(it => { if (it && DB.items[it.id] && DB.items[it.id].relic) ids.add(it.id); });
        if (player.eq && typeof player.eq === 'object') {
            Object.keys(player.eq).forEach(k => {
                let it = player.eq[k];
                if (it && DB.items[it.id] && DB.items[it.id].relic) ids.add(it.id);
            });
        }
        return ids;
    }

    function _makeRelicContract(st, category) {
        let active = new Set();
        st.boards.forEach(b => { if (b.contract && b.contract.relicId) active.add(b.contract.relicId); });
        let owned = _ownedRelicIds();
        let relicPool = Object.keys(DB.items).filter(id => {
            let d = DB.items[id];
            return _relicCategoryOf(d) === category && !active.has(id) && (TEST_BUILD || !owned.has(id));
        });
        if (!relicPool.length) return { error: '此類別目前沒有可搜尋的新遺物。' };
        let relicId = _pick(st, relicPool, 'relic-target|' + category);
        let craftable = _craftableIds();
        let base = Object.keys(DB.items).filter(id => {
            let d = DB.items[id];
            let w = Math.floor(Number(d && d.gachaWeight) || 0);
            return !!(d && d.n && !d.relic && id !== relicId && ((w >= 1 && w <= 50) || craftable.has(id)));
        });
        let p1 = base.filter(id => Math.floor(Number(DB.items[id].gachaWeight) || 0) === 1);
        let p2 = base.filter(id => {
            let w = Math.floor(Number(DB.items[id].gachaWeight) || 0);
            return w >= 1 && w <= 20;
        });
        let p3 = base.filter(id => {
            let w = Math.floor(Number(DB.items[id].gachaWeight) || 0);
            return (w >= 1 && w <= 50) || craftable.has(id);
        });
        if (!p1.length || !p2.length || !p3.length) return { error: '遺物委託材料池不足，請先檢查潘朵拉權重與製作資料。' };
        let chosen = [];
        function choose(pool, tag) {
            let avail = pool.filter(id => !chosen.includes(id));
            let id = _pick(st, avail, tag);
            if (id) chosen.push(id);
            return id;
        }
        let a = choose(p1, 'relic-req-weight1');
        let b = choose(p2, 'relic-req-weight1-20');
        let c = choose(p3, 'relic-req-weight1-50-craft');
        if (!a || !b || !c) return { error: '無法建立三種不重複的委託物品。' };
        return {
            contract: {
                id: 'relic-' + Date.now().toString(36) + '-' + Math.floor(_rand(st, 'relic-contract-id') * 0xffffff).toString(36),
                category: category,
                relicId: relicId,
                requirements: chosen.map(id => ({
                    id: id,
                    en: null,
                    weight: Math.floor(Number(DB.items[id].gachaWeight) || 0),
                    craftable: craftable.has(id)
                })),
                createdAt: Date.now()
            }
        };
    }

    function pandoraRelicSuggestionHTML(query) {
        query = String(query || '').trim();
        if (!query.includes('遺物')) return '';
        return Object.keys(RELIC_CATEGORIES).map(key => {
            let c = RELIC_CATEGORIES[key];
            return `<button type="button" class="pandora-buy-suggestion pandora-relic-suggestion" onclick="pandoraChooseRelicSearch('${key}')">${c.label}<span>消耗 ${RELIC_SEARCH_COST} 龍之鑽石</span></button>`;
        }).join('');
    }

    function pandoraRelicOnSearchInput(value) {
        let nameEl = document.getElementById('pandora-buy-name');
        let priceEl = document.getElementById('pandora-buy-price');
        if (!nameEl || !nameEl.dataset.relicCat) return;
        let cat = nameEl.dataset.relicCat;
        if (!RELIC_CATEGORIES[cat] || String(value || '').trim() !== RELIC_CATEGORIES[cat].label) {
            delete nameEl.dataset.relicCat;
            if (priceEl) {
                priceEl.disabled = false;
                priceEl.value = '';
                priceEl.placeholder = '收購價錢';
            }
        }
    }

    function pandoraClearRelicSearchChoice() {
        let nameEl = document.getElementById('pandora-buy-name');
        let priceEl = document.getElementById('pandora-buy-price');
        if (nameEl) delete nameEl.dataset.relicCat;
        if (priceEl) priceEl.disabled = false;
    }

    function pandoraChooseRelicSearch(category) {
        let cfg = RELIC_CATEGORIES[category];
        if (!cfg) return;
        let nameEl = document.getElementById('pandora-buy-name');
        let priceEl = document.getElementById('pandora-buy-price');
        let box = document.getElementById('pandora-buy-suggestions');
        if (nameEl) {
            nameEl.value = cfg.label;
            nameEl.dataset.relicCat = category;
        }
        if (priceEl) {
            priceEl.value = String(RELIC_SEARCH_COST) + ' 龍之鑽石';
            priceEl.disabled = true;
        }
        if (box) {
            box.innerHTML = '';
            box.classList.add('hidden');
        }
    }

    function _setPandoraNotice(type, text) {
        let m = typeof player !== 'undefined' && player ? player.pandoraMarket2 : null;
        if (typeof _pandoraSetNotice === 'function') _pandoraSetNotice(m, type, text);
    }

    function _rerenderPandora() {
        try {
            if (typeof _pandoraDiv !== 'undefined' && _pandoraDiv && typeof pandoraRenderMarket === 'function') {
                pandoraRenderMarket(_pandoraDiv);
            }
        } catch (e) {}
    }

    function pandoraTryRelicSearchFromInputs() {
        let nameEl = document.getElementById('pandora-buy-name');
        let name = nameEl ? nameEl.value.trim() : '';
        let category = nameEl && nameEl.dataset ? nameEl.dataset.relicCat : '';
        if (!category) {
            Object.keys(RELIC_CATEGORIES).some(k => {
                if (RELIC_CATEGORIES[k].label === name) { category = k; return true; }
                return false;
            });
        }
        if (!category && name === '遺物') {
            _setPandoraNotice('error', '請先從候補選擇武器遺物、防具遺物或飾品遺物。');
            _rerenderPandora();
            return true;
        }
        if (!category) return false;
        pandoraStartRelicSearch(category);
        return true;
    }

    function pandoraStartRelicSearch(category) {
        if (!RELIC_CATEGORIES[category]) return;
        let now = Date.now();
        let result = _withStateLock(st => {
            let slot = st.boards.findIndex(b => !b.contract && Number(b.cooldownUntil || 0) <= now);
            if (slot < 0) return { commit: false, error: '三個遺物欄位都在使用中或冷卻中。' };
            if (st.diamonds < RELIC_SEARCH_COST) return { commit: false, error: `龍之鑽石不足，需要 ${RELIC_SEARCH_COST} 顆。` };
            let made = _makeRelicContract(st, category);
            if (made.error) return { commit: false, error: made.error };
            st.diamonds -= RELIC_SEARCH_COST;
            st.boards[slot].contract = made.contract;
            st.boards[slot].cooldownUntil = 0;
            return { slot: slot, contract: made.contract };
        });
        if (!result.ok) {
            _setPandoraNotice('error', result.error || '遺物搜尋資料正忙碌，請稍後重試。');
        } else {
            let d = DB.items[result.contract.relicId];
            _setPandoraNotice('success', `已在第 ${result.slot + 1} 欄找到${d ? d.n : '遺物'}的布告，消耗 ${RELIC_SEARCH_COST} 顆龍之鑽石。`);
            try { saveGame(); } catch (e) {}
        }
        _rerenderPandora();
    }

    function pandoraRelicBalanceHTML() {
        let st = _readState();
        return `｜龍之鑽石 <span class="pandora-diamond-count">${st.diamonds.toLocaleString()}</span>`;
    }

    function pandoraRelicBoardHTML() {
        let st = _readState();
        let now = Date.now();
        let cards = st.boards.map((b, i) => {
            if (b.contract) {
                let c = b.contract;
                let d = DB.items[c.relicId];
                let match = _findMatches(c.requirements || [], st);
                let reqHtml = (c.requirements || []).map(req => {
                    let one = _findMatches([req], st).ok;
                    let rd = DB.items[req.id];
                    return `<div class="pandora-relic-req ${one ? 'has' : 'missing'}"
                        onmouseenter="pandoraRelicTipShow(event,'${_esc(req.id)}')" onmousemove="pandoraTipMove(event)" onmouseleave="pandoraTipHide()">
                        <img src="${rd ? _esc(getIconUrl(rd)) : ''}" alt="">
                        <span>${_esc(_requirementText(req.id, req.en))}</span>
                    </div>`;
                }).join('');
                let category = RELIC_CATEGORIES[c.category] || { short: '遺物' };
                return `<div class="pandora-relic-slot active">
                    <div class="pandora-relic-slot-no">布告 ${i + 1}・${category.short}</div>
                    <div class="pandora-relic-target" onmouseenter="pandoraRelicTipShow(event,'${_esc(c.relicId)}')" onmousemove="pandoraTipMove(event)" onmouseleave="pandoraTipHide()">
                        <img src="${d ? _esc(getIconUrl(d)) : ''}" alt="">
                        <b class="${d ? getItemColor({ id: c.relicId }) : ''}">${_esc(d ? d.n : c.relicId)}</b>
                    </div>
                    <div class="pandora-relic-reqs">${reqHtml}</div>
                    <div class="pandora-relic-actions">
                        <button class="btn pandora-relic-exchange ${match.ok ? '' : 'opacity-60'}" onclick="pandoraExchangeRelic(${i})">兌換</button>
                        <button class="pandora-relic-cancel" onclick="pandoraCancelRelicBoard(${i})">取消布告</button>
                    </div>
                </div>`;
            }
            if (Number(b.cooldownUntil || 0) > now) {
                return `<div class="pandora-relic-slot cooling">
                    <div class="pandora-relic-slot-no">布告 ${i + 1}</div>
                    <div class="pandora-relic-empty-icon">⌛</div>
                    <div>欄位冷卻中</div>
                    <small class="pandora-relic-cd" data-until="${Math.floor(b.cooldownUntil)}">${_remainingText(b.cooldownUntil - now)}</small>
                </div>`;
            }
            return `<div class="pandora-relic-slot empty">
                <div class="pandora-relic-slot-no">布告 ${i + 1}</div>
                <div class="pandora-relic-empty-icon">◇</div>
                <div>尚未搜尋遺物</div>
                <small>在上方輸入「遺物」選擇類別</small>
            </div>`;
        }).join('');
        return `<section class="pandora-relic-board">
            <div class="pandora-relic-board-head">
                <b>遺物布告欄</b>
                <span>搜尋費用 ${RELIC_SEARCH_COST} 龍之鑽石・完成或取消後，該欄冷卻 24 小時</span>
            </div>
            <div class="pandora-relic-grid">${cards}</div>
        </section>`;
    }

    function pandoraRelicBindBoardCountdowns() {
        document.querySelectorAll('.pandora-relic-cd[data-until]').forEach(el => {
            let until = Number(el.dataset.until) || 0;
            el.textContent = until > Date.now() ? _remainingText(until - Date.now()) : '冷卻完成，重新開啟黑市即可使用';
        });
    }

    function pandoraRelicTipShow(ev, id) {
        let d = DB.items[id];
        if (!d || typeof _pandoraTipEl !== 'function') return;
        let inst = { id: id, en: 0, bless: false, anc: false, attr: false };
        let desc = '';
        try { desc = buildItemDescHTML(inst); } catch (e) {}
        let el = _pandoraTipEl();
        el.innerHTML = `<div class="font-bold ${getItemColor(inst)}">${_esc(d.n || id)}</div><div class="text-slate-300">${desc}</div>`;
        el.style.display = 'block';
        if (typeof pandoraTipMove === 'function') pandoraTipMove(ev);
    }

    function pandoraExchangeRelic(slotIndex) {
        let before = _readState();
        let board = before.boards[slotIndex];
        let contract = board && board.contract;
        if (!contract) {
            _setPandoraNotice('error', '此遺物布告已不存在。');
            _rerenderPandora();
            return;
        }
        let match = _findMatches(contract.requirements || [], before);
        if (!match.ok) {
            let missing = match.missing;
            _setPandoraNotice('error', `道具欄與倉庫缺少：${_requirementText(missing.id, missing.en)}。`);
            _rerenderPandora();
            return;
        }
        let result = _withStateLock(st => {
            let live = st.boards[slotIndex] && st.boards[slotIndex].contract;
            if (!live || live.id !== contract.id) return { commit: false, error: '此遺物布告已被完成或取消。' };
            let liveMatch = _findMatches(live.requirements || [], st);
            if (!liveMatch.ok) {
                return { commit: false, error: `道具欄與倉庫缺少：${_requirementText(liveMatch.missing.id, liveMatch.missing.en)}。` };
            }
            if (!_consumeMatchedItems(liveMatch.matches)) {
                return { commit: false, error: '交付物品時倉庫資料發生變動，請重新開啟黑市確認。' };
            }
            st.boards[slotIndex].contract = null;
            st.boards[slotIndex].cooldownUntil = Date.now() + BOARD_COOLDOWN_MS;
            return { relicId: live.relicId };
        });
        if (!result.ok) {
            _setPandoraNotice('error', result.error || '兌換資料正忙碌，請稍後重試。');
            _rerenderPandora();
            return;
        }
        try {
            let oldTrad = (typeof _tradLootCtx !== 'undefined') ? _tradLootCtx : false;
            if (typeof _tradLootCtx !== 'undefined') _tradLootCtx = true;
            try { gainItem(result.relicId, 1, true, true, false); } finally {
                if (typeof _tradLootCtx !== 'undefined') _tradLootCtx = oldTrad;
            }
        } catch (e) {
            gainItem(result.relicId, 1, true, true, false);
        }
        let d = DB.items[result.relicId];
        _setPandoraNotice('success', `完成遺物布告，獲得${d ? d.n : '遺物'}。第 ${slotIndex + 1} 欄進入 24 小時冷卻。`);
        if (typeof logSys === 'function') logSys(`<span class="text-purple-300 font-bold">完成潘朵拉遺物布告，獲得 ${_esc(d ? d.n : result.relicId)}。</span>`);
        try { updateUI(); renderTabs(); saveGame(); } catch (e) {}
        _rerenderPandora();
    }

    function pandoraCancelRelicBoard(slotIndex) {
        let result = _withStateLock(st => {
            let b = st.boards[slotIndex];
            if (!b || !b.contract) return { commit: false, error: '此欄目前沒有遺物布告。' };
            let relicId = b.contract.relicId;
            b.contract = null;
            b.cooldownUntil = Date.now() + BOARD_COOLDOWN_MS;
            return { relicId: relicId };
        });
        if (!result.ok) _setPandoraNotice('error', result.error || '取消資料正忙碌，請稍後重試。');
        else _setPandoraNotice('info', `已取消第 ${slotIndex + 1} 欄的遺物布告，該欄進入 24 小時冷卻。`);
        _rerenderPandora();
    }

    // test.html 專用：測試版創角時重設帳號共用龍之鑽石；正式版即使誤呼叫也不會生效。
    function pandoraTestSetDiamonds(amount) {
        if (!TEST_BUILD) return false;
        let value = Math.max(0, Math.floor(Number(amount) || 0));
        let result = _withStateLock(st => {
            st.diamonds = value;
            return { diamonds: value };
        });
        if (result.ok) _rerenderPandora();
        return !!result.ok;
    }

    window.wanderingBuyerSystemTick = wanderingBuyerSystemTick;
    window.getWanderingBuyerForTown = getWanderingBuyerForTown;
    window.wanderingBuyerSpriteData = wanderingBuyerSpriteData;
    window.openWanderingBuyerDialog = openWanderingBuyerDialog;
    window.openWanderingShoutMenu = openWanderingShoutMenu;
    window.silenceWanderingBuyer = silenceWanderingBuyer;
    window.hurryToWanderingBuyer = hurryToWanderingBuyer;
    window.renderWanderingBuyerDialog = renderWanderingBuyerDialog;
    window.performWanderingBuyerTrade = performWanderingBuyerTrade;
    window.pandoraRelicSuggestionHTML = pandoraRelicSuggestionHTML;
    window.pandoraRelicOnSearchInput = pandoraRelicOnSearchInput;
    window.pandoraClearRelicSearchChoice = pandoraClearRelicSearchChoice;
    window.pandoraChooseRelicSearch = pandoraChooseRelicSearch;
    window.pandoraTryRelicSearchFromInputs = pandoraTryRelicSearchFromInputs;
    window.pandoraStartRelicSearch = pandoraStartRelicSearch;
    window.pandoraRelicBalanceHTML = pandoraRelicBalanceHTML;
    window.pandoraRelicBoardHTML = pandoraRelicBoardHTML;
    window.pandoraRelicBindBoardCountdowns = pandoraRelicBindBoardCountdowns;
    window.pandoraRelicTipShow = pandoraRelicTipShow;
    window.pandoraExchangeRelic = pandoraExchangeRelic;
    window.pandoraCancelRelicBoard = pandoraCancelRelicBoard;
    window.pandoraTestSetDiamonds = pandoraTestSetDiamonds;

    setTimeout(wanderingBuyerSystemTick, 1500);
    setInterval(wanderingBuyerSystemTick, 30000);
    setInterval(pandoraRelicBindBoardCountdowns, 1000);
    try {
        window.addEventListener('storage', e => {
            if (e && e.key === STORE_KEY) {
                let st = _readState();
                _refreshTownMapIfNeeded(_activeSignature(st.wanderers));
                st.wanderers.forEach(_announceWanderer);
            }
        });
    } catch (e) {}
})();
