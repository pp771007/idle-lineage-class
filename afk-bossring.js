/**
 * afk-bossring.js — 傳送控制戒指「自動找 BOSS」
 *
 * 上游原生已有：傳送控制戒指(acc_116) + hasTeleportRing() + 手動施放傳送術/用瞬移卷軸「必定遭遇 BOSS」。
 *   缺的是我方原本在核心加的「自動」——場上沒 BOSS 時自動用瞬移卷軸召來、清掉後再瞬移。這支把它做成外掛。
 *
 * 行為（比照我方 main 設計）：
 *   - 遊戲內有一個勾選框「傳送控制戒指自動找BOSS」(比照舊 main 的 #set-teleport-boss)，勾了才自動。
 *     插在設定面板「藥水不足自動買」(#set-auto-buy-pot) 下方；狀態存 localStorage afk_bossring_on(預設開)。
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

    var LS = 'afk_bossring_on';
    function isOn() { try { var v = localStorage.getItem(LS); return v === null ? true : v === '1'; } catch (e) { return true; } }   // 預設開(保留原本一律自動的行為)
    function setOn(v) { try { localStorage.setItem(LS, v ? '1' : '0'); } catch (e) {} }

    // 遊戲內勾選框：插在設定面板「藥水不足自動買」(#set-auto-buy-pot) 那格下方。idempotent、定期確保還在。
    function injectCheckbox() {
        if (document.getElementById('set-teleport-boss')) return;
        var anchor = document.getElementById('set-auto-buy-pot');
        if (!anchor) return;
        var host = anchor.closest('label') || anchor.parentElement;
        if (!host || !host.parentElement) return;
        var lbl = document.createElement('label');
        lbl.className = 'cursor-pointer flex items-center gap-2 mt-1 border-t border-slate-700 pt-2';
        lbl.innerHTML = '<input type="checkbox" id="set-teleport-boss" class="w-4 h-4"><span class="text-sm text-rose-300">傳送控制戒指自動找BOSS</span><span class="text-xs text-slate-500">需帶戒指·離線不套用</span>';
        host.parentElement.insertBefore(lbl, host.nextSibling);
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
            if (state && (state.oblivion || state.prideClimb || state.prideRanked)) return true; // 遺忘之島 / 攀登
            if (typeof prideTeleportBlocked === 'function' && prideTeleportBlocked()) return true;
            // 安全區/村莊不狩獵→不找王
            if (/^town_/.test(c)) return true;
            return false;
        } catch (e) { return true; }
    }

    function tick() {
        try {
            if (!isOn()) return;                         // 勾選框沒勾 → 不自動
            if (typeof state === 'undefined' || !state || !state.running || state.ff) return;   // 只線上前景
            if (typeof mapState === 'undefined' || !mapState || !mapState.mobs) return;
            if (typeof player === 'undefined' || !player || !player.inv) return;
            if (!hasTeleportRing()) return;              // 沒戒指
            if (mapState.forceBoss) return;              // 已排定必出 BOSS → 等它生出來
            if (anyBoss()) return;                       // 場上有王 → 打它，不瞬移（與自動逃離互斥）
            if (excludedMap()) return;                   // 排除地圖
            if (state._manualTpUntil && (state.ticks || 0) < state._manualTpUntil) return;   // 手動瞬移後抑制期
            var sc = player.inv.find(function (i) { return i && i.id === 'scroll_teleport' && (i.cnt || 1) >= 1; });
            if (!sc) return;                             // 沒瞬移卷軸就不動
            useItem(sc.uid, false);                      // 非 silent → hasTeleportRing() → forceBoss
        } catch (e) {}
    }
    setInterval(tick, 1000);

    try { console.log('[AFK-bossring] hooks OK — 傳送控制戒指自動找 BOSS 已啟用。'); } catch (e) {}
})();
