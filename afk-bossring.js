/**
 * afk-bossring.js — 傳送控制戒指「自動找 BOSS」
 *
 * 上游原生已有：傳送控制戒指(acc_116) + hasTeleportRing() + 手動施放傳送術/用瞬移卷軸「必定遭遇 BOSS」。
 *   缺的是我方原本在核心加的「自動」——場上沒 BOSS 時自動用瞬移卷軸召來、清掉後再瞬移。這支把它做成外掛。
 *
 * 行為（比照我方 main 設計）：
 *   - 遊戲內有一個勾選框「傳送控制戒指自動找BOSS」(比照舊 main 的 #set-teleport-boss)，勾了才自動。
 *     插在設定面板「藥水不足自動買」(#set-auto-buy-pot) 下方；狀態**依存檔位(角色)分開**存
 *     localStorage afk_bossring_on_<slot>(沒設定過時沿用舊的全域鍵 afk_bossring_on，預設開)。
 *   - 只在「線上前景遊玩」跑（離線快速結算 state.ff 期間不套用；跟遇 BOSS 自動逃離互斥＝有王就不瞬移）。
 *   - 持有傳送控制戒指、場上無 BOSS、非排除地圖（軍王之室/攻城/時空裂痕/排名攀登/遺忘之島）、手動瞬移抑制期外，
 *     且背包有瞬移卷軸 → 自動 useItem(卷軸, 非silent) → 上游的 hasTeleportRing() 讓下一次生怪必定 BOSS。
 *   - mapState.forceBoss 已排定必出 BOSS 時等它生出來，不重複瞬移（不浪費卷軸）。
 *   - 沒瞬移卷軸就不動（可搭配「自動購買」或玩家自備）。
 */
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('bossring')) return;   // 🎚️ 外掛開關
    if (typeof useItem !== 'function' || typeof hasTeleportRing !== 'function') {
        try { console.warn('[AFK-bossring] 缺核心 useItem / hasTeleportRing，自動找 BOSS 停用。'); } catch (e) {}
        return;
    }

    // 設定依存檔位(角色)分開:同一個帳號的不同角色想不想自動找王往往不一樣
    //   (主力帶戒指要自動找,練功號沒戒指或在低階圖不想燒卷軸)。寫法比照 afk-autobuy。
    //   舊的全域鍵 afk_bossring_on 當「還沒各自設定過」時的預設,玩家原本關掉的不會突然變回開。
    var LS_OLD = 'afk_bossring_on';
    function validSlot() { var n = +currentSlot; return Number.isInteger(n) && n >= 1; }
    function prefKey() { return 'afk_bossring_on_' + currentSlot; }
    function legacyOn() { try { var v = localStorage.getItem(LS_OLD); return v === null ? true : v === '1'; } catch (e) { return true; } }   // 預設開(保留原本一律自動的行為)
    // 🚀 tick 每秒查,快取避免同步 IO;本檔是唯一寫入者,鍵含存檔位 → 切角色自然分開
    var _cache = {};
    function isOn() {
        if (!validSlot()) return legacyOn();
        if (currentSlot in _cache) return _cache[currentSlot];
        var v;
        try { var raw = localStorage.getItem(prefKey()); v = (raw === null) ? legacyOn() : (raw === '1'); } catch (e) { v = legacyOn(); }
        _cache[currentSlot] = v;
        return v;
    }
    function setOn(v) {
        if (!validSlot()) return;
        try { localStorage.setItem(prefKey(), v ? '1' : '0'); _cache[currentSlot] = !!v; } catch (e) {}
    }
    // 進到某角色時把勾選框同步成該存檔位的設定(否則會顯示上一個角色的狀態)
    function restoreForSlot() {
        var cb = document.getElementById('set-teleport-boss');
        if (cb) cb.checked = isOn();
    }
    ['loadGame', 'startGame'].forEach(function (fn) {
        var orig = window[fn];
        if (typeof orig !== 'function' || orig.__afkBossring) return;
        var w = function () {
            var r = orig.apply(this, arguments);
            try { restoreForSlot(); } catch (e) {}
            return r;
        };
        w.__afkBossring = true; window[fn] = w;
    });

    // 遊戲內勾選框：併入 afk-autobuy 的「🔌 外掛」框、放在「自動購買魔法卷軸(魔法屏障)」下方(單一外掛區)。
    // autobuy 框不在(被外掛開關關掉/未注入)時退回舊錨點(#set-auto-buy-pot 下方)。idempotent、定期確保還在。
    function injectCheckbox() {
        var existing = document.getElementById('set-teleport-boss');
        if (existing) {
            // 先落在舊錨點、外掛框後來才注入(載入順序不定)→把整列搬進框內魔法屏障下方
            var b0 = document.getElementById('set-auto-buy-magicbarrier');
            var box0 = b0 && b0.closest('#afk-autobuy-box');
            if (box0 && !existing.closest('#afk-autobuy-box')) {
                var row0 = existing.closest('label');
                var abRow0 = b0.closest('label');
                if (row0 && abRow0) {
                    row0.className = 'cursor-pointer flex items-center gap-2';
                    abRow0.parentElement.insertBefore(row0, abRow0.nextSibling);
                }
            }
            return;
        }
        var lbl = document.createElement('label');
        lbl.className = 'cursor-pointer flex items-center gap-2';
        lbl.innerHTML = '<input type="checkbox" id="set-teleport-boss" class="w-4 h-4"><span class="text-rose-300">傳送控制戒指自動找BOSS</span><span class="text-xs text-slate-500">需帶戒指·離線不套用·每角色分開</span>';
        var barrier = document.getElementById('set-auto-buy-magicbarrier');
        var abBox = barrier && barrier.closest('#afk-autobuy-box');
        if (abBox) {
            var row = barrier.closest('label');
            row.parentElement.insertBefore(lbl, row.nextSibling);
        } else {
            var anchor = document.getElementById('set-auto-buy-pot');
            if (!anchor) return;
            var host = anchor.closest('label') || anchor.parentElement;
            if (!host || !host.parentElement) return;
            lbl.className = 'cursor-pointer flex items-center gap-2 mt-1 border-t border-slate-700 pt-2 text-sm';
            host.parentElement.insertBefore(lbl, host.nextSibling);
        }
        var cb = lbl.querySelector('#set-teleport-boss');
        cb.checked = isOn();
        cb.addEventListener('change', function () { setOn(cb.checked); });
    }
    setInterval(injectCheckbox, 1500);
    injectCheckbox();

    function anyBoss() { try { return mapState.mobs.some(function (m) { return m && m.boss && !m._dead; }); } catch (e) { return true; } }
    function excludedMap() {
        try {
            var c = (mapState && mapState.current) || '';
            if (!c) return true;
            if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS[c]) return true;              // 軍王之室
            if (typeof isSiegeArea === 'function' && isSiegeArea(c)) return true;              // 攻城
            if (state && state.riftRun) return true;                                          // 時空裂痕（排名挑戰）
            if (state && (state.oblivion || state.antharas || state.prideClimb || state.prideRanked)) return true; // 遺忘之島 / 🐉 安塔瑞斯巢穴(區內禁傳送) / 攀登
            if (typeof prideTeleportBlocked === 'function' && prideTeleportBlocked()) return true;
            if (typeof PURE_BOSS_MAPS !== 'undefined' && PURE_BOSS_MAPS.includes(c)) return true;   // 純BOSS房:BOSS常駐,瞬移只會清進度
            if (typeof HIDDEN_AREA_PARENT !== 'undefined' && HIDDEN_AREA_PARENT[c]) return true;    // 這些圖手動用卷軸=進隱藏區域,自動不該誤觸
            // 安全區/村莊不狩獵→不找王
            if (/^town_/.test(c)) return true;
            return false;
        } catch (e) { return true; }
    }
    // 這張圖的怪物池有沒有可召的 BOSS:沒有的話 forceBoss 會被一般格白白消耗,外掛看「場上沒王」
    // 又再瞬移 → 無限迴圈狂燒卷軸(踩過)。無 BOSS 池的圖一律不動作。
    function mapHasBossPool() {
        try { return (DB.maps[mapState.current] || []).some(function (id) { return DB.mobs[id] && DB.mobs[id].boss; }); } catch (e) { return false; }
    }
    // 「自動找 BOSS 進行中」:核心「迴避頭目(瞬移卷軸)」以此互斥(找BOSS開著就抑制逃離,
    // 否則剛召來的王立刻被逃離瞬移走;比照 main 版核心的 _huntBoss 旗標)。
    function huntActive() {
        try {
            return isOn() && typeof state !== 'undefined' && state && state.running && !state.ff
                && hasTeleportRing() && !excludedMap() && mapHasBossPool();
        } catch (e) { return false; }
    }
    window.AFK_BOSSRING = { huntActive: huntActive };

    var WAIT_SPAWN_TICKS = 100;      // 瞬移後等 BOSS 生成(10 秒),不連續空瞬移
    var WAIT_BLOCKED_TICKS = 3000;   // 卷軸沒被消耗=這張圖禁傳送 → 退避 5 分鐘再試
    // 卷軸總數:用來判斷 useItem 有沒有真的把卷軸用掉。上游對「禁傳送區域」是印一行紅字後 return
    // (不消耗卷軸),外掛看場上還是沒王 → 10 秒後又試一次 → 紅字洗版。這裡不逐一列舉上游的禁區清單
    // (作者一路在加:遺忘之島→傲慢之塔→安塔瑞斯…),改用「有沒有被消耗」這個共通結果來退避。
    function scrollCount() {
        try { return player.inv.reduce(function (s, i) { return s + ((i && i.id === 'scroll_teleport') ? (i.cnt || 1) : 0); }, 0); } catch (e) { return -1; }
    }

    var _waitUntil = 0;   // 瞬移後「等 BOSS 生成」期限(比照 main 的 _autoBossHuntUntil);逾時容許重試
    function tick() {
        try {
            if (!isOn()) return;                         // 勾選框沒勾 → 不自動
            if (typeof state === 'undefined' || !state || !state.running || state.ff) return;   // 只線上前景
            if (typeof mapState === 'undefined' || !mapState || !mapState.mobs) return;
            if (typeof player === 'undefined' || !player || !player.inv) return;
            if (!hasTeleportRing()) return;              // 沒戒指
            if (anyBoss()) { _waitUntil = 0; return; }   // 場上有王 → 打它，不瞬移（與自動逃離互斥）
            if (mapState.forceBoss) return;              // 已排定必出 BOSS → 等它生出來
            if ((state.ticks || 0) < _waitUntil) return; // 剛瞬移過:BOSS 生成要幾秒,等滿再重試
            if (excludedMap()) return;                   // 排除地圖
            if (!mapHasBossPool()) return;               // 無 BOSS 池的圖不動作(防無限燒卷軸)
            if (state._manualTpUntil && (state.ticks || 0) < state._manualTpUntil) return;   // 手動瞬移後抑制期
            var sc = player.inv.find(function (i) { return i && i.id === 'scroll_teleport' && (i.cnt || 1) >= 1; });
            if (!sc) {
                // 缺瞬移卷軸→比照上游「迴避頭目」自動購買一張(勾了功能=同意買;金幣不夠才作罷)
                try {
                    var cost = shopPrice(DB.items.scroll_teleport.p);
                    if (player.gold >= cost) {
                        player.gold -= cost;
                        gainItem('scroll_teleport', 1, true, true);
                        sc = player.inv.find(function (i) { return i && i.id === 'scroll_teleport' && (i.cnt || 1) >= 1; });
                    }
                } catch (e) {}
            }
            if (!sc) return;                             // 買不起也沒存貨 → 不動
            var before = scrollCount();
            useItem(sc.uid, false, true);                // 非 silent=戒指 forceBoss;keepModal=自動觸發別關玩家開著的視窗
            var blocked = (before >= 0 && scrollCount() === before);
            _waitUntil = (state.ticks || 0) + (blocked ? WAIT_BLOCKED_TICKS : WAIT_SPAWN_TICKS);
        } catch (e) {}
    }
    setInterval(tick, 1000);

    try { console.log('[AFK-bossring] hooks OK — 傳送控制戒指自動找 BOSS 已啟用。'); } catch (e) {}
})();
