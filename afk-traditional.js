/**
 * afk-traditional.js — 傳統模式(偽)／自動衝裝
 *
 * 玩家視角：某個角色開了這功能後，「打到的 / 製作的 / 潘朵拉來的」裝備會自帶隨機強化值
 *   （商店買的維持 +0）。手動強化照常可用（可以繼續衝）。每個角色各自開關、隨時可改、只影響之後拿到的。
 *
 * 實作：
 *   - 核心只被 apply-core-patches.mjs 改一行（gainItem 的 `let _tEn = 0` → 呼叫 window.__afkTradRollEn）。
 *     強化值在 gainItem「簽章疊加之前」就定好，堆疊/詞綴全走上游原路，正確不出錯。
 *   - 本外掛提供 __afkTradRollEn：對「該角色有開 + 非商店(forceNormal 假) + 裝備(武/防/飾·非箭矢·可強化·非遺物)」
 *     回傳隨機強化值（權重表 1:1 沿用舊傳統模式，夾到該裝備強化上限 capEn），其餘一律 0。
 *   - 每角色開關存 localStorage afk_trad_<slot>；未開/未載/關掉本外掛 → 恆 0，與原版完全一致。
 *
 * 開關：afk-toggles 的 'traditional'（整個功能總開關）＋ 每存檔位各自的開關（本檔）。
 */
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('traditional')) return;   // 🎚️ 總開關關掉→不提供鉤子，gainItem 回原版恆 +0

    // ── 隨機強化值權重表（1:1 沿用舊傳統模式；[強化值, 權重]）──────────
    var TRAD_EN_TABLES = {
        wpn6: [[20,1],[19,3],[18,5],[17,7],[16,8],[15,10],[14,12],[13,13],[12,15],[11,17],[10,18],[9,20],[8,22],[7,23],[6,25],[5,27],[4,28],[3,30],[2,32],[1,33],[0,151]],
        wpn0: [[20,1],[19,3],[18,5],[17,7],[16,8],[15,10],[14,12],[13,13],[12,15],[11,17],[10,18],[9,20],[8,22],[7,23],[6,25],[5,27],[4,28],[3,30],[2,32],[1,33],[0,151]],
        arm6: [[15,1],[14,3],[13,5],[12,7],[11,8],[10,10],[9,12],[8,13],[7,15],[6,30],[5,30],[4,30],[3,30],[2,30],[1,30],[0,246]],
        arm4: [[15,1],[14,3],[13,5],[12,7],[11,8],[10,10],[9,12],[8,13],[7,15],[6,17],[5,18],[4,37],[3,37],[2,37],[1,37],[0,243]],
        arm0: [[15,1],[14,3],[13,5],[12,7],[11,8],[10,10],[9,12],[8,13],[7,15],[6,17],[5,18],[4,20],[3,22],[2,23],[1,25],[0,301]],
        acc0: [[5,1],[4,3],[3,5],[2,7],[1,8],[0,476]]
    };
    function tableFor(d) {
        if (!d) return null;
        var safe = d.safe || 0;
        if (d.type === 'wpn') return safe >= 6 ? TRAD_EN_TABLES.wpn6 : TRAD_EN_TABLES.wpn0;
        if (d.type === 'arm') return safe >= 6 ? TRAD_EN_TABLES.arm6 : (safe >= 4 ? TRAD_EN_TABLES.arm4 : TRAD_EN_TABLES.arm0);
        if (d.type === 'acc') return TRAD_EN_TABLES.acc0;
        return null;
    }
    function rnd() { return (typeof lootRng === 'function') ? lootRng('afktraden') : Math.random(); }   // 有 committed RNG 就用（防 SL 重抽）
    function rollEnhance(d) {
        var tbl = tableFor(d);
        if (!tbl) return 0;
        var total = 0, i;
        for (i = 0; i < tbl.length; i++) total += tbl[i][1];
        var r = rnd() * total, acc = 0, lvl = 0;
        for (i = 0; i < tbl.length; i++) { acc += tbl[i][1]; if (r < acc) { lvl = tbl[i][0]; break; } }
        // 🔒 夾到該裝備的實際強化上限（使用者要求「不超過上限」）；capEn 是核心函式
        return (typeof capEn === 'function') ? capEn(lvl, d) : Math.min(lvl, 15);
    }

    // ── 每存檔位開關 ──────────────────────────────────────────
    function slotOf() { return (typeof currentSlot !== 'undefined' && currentSlot != null) ? currentSlot : null; }
    function key(slot) { return 'afk_trad_' + slot; }
    function isOn(slot) {
        if (slot == null) slot = slotOf();
        if (slot == null) return false;
        try { return localStorage.getItem(key(slot)) === '1'; } catch (e) { return false; }
    }
    function setOn(slot, on) { try { localStorage.setItem(key(slot), on ? '1' : '0'); } catch (e) {} }

    // ── 核心鉤子：gainItem 的 _tEn 由這裡決定 ────────────────────
    //   d=物品定義, forceNormal=商店等「不給強化」旗標, noAffix=寵物白板(仍給強化)
    window.__afkTradRollEn = function (d, forceNormal, noAffix) {
        if (forceNormal) return 0;                                  // 🛒 商店/起始裝：不給
        if (!isOn()) return 0;                                      // 該角色沒開
        if (!d) return 0;
        var isEquip = (d.type === 'wpn' && !d.isArrow) || d.type === 'arm' || d.type === 'acc';
        if (!isEquip) return 0;                                     // 只給裝備（武/防/飾），箭矢/材料/消耗品不給
        if (d.noEnhance) return 0;                                  // 無法強化的裝備（古老系列）恆 +0
        if (typeof isRelic === 'function' && isRelic(d)) return 0;  // 遺物不給
        return rollEnhance(d);
    };

    // ── 對外 API ──────────────────────────────────────────────
    window.AFK_TRAD = { isOn: isOn, setOn: setOn, roll: rollEnhance };

    // ── UI：遊戲內小開關（只在載入角色後顯示，切換「目前這個角色」）──────
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function syncBtn(btn) {
        var slot = slotOf(), on = isOn(slot);
        btn.textContent = '🏛️ 傳統模式(偽)：' + (on ? '開' : '關');
        btn.style.borderColor = on ? '#a78bfa' : '#334155';
        btn.style.color = on ? '#c4b5fd' : '#94a3b8';
    }
    function injectInGameToggle() {
        // 只在「已載入角色」時掛（有 currentSlot 且遊戲畫面在）；主選單不掛
        var slot = slotOf();
        var gameScreen = document.getElementById('game-screen');
        var visible = gameScreen && !gameScreen.classList.contains('hidden');
        var existing = document.getElementById('afk-trad-toggle');
        if (slot == null || !visible) { if (existing) existing.remove(); return; }
        if (existing) { syncBtn(existing); return; }
        var btn = document.createElement('button');
        btn.id = 'afk-trad-toggle';
        btn.type = 'button';
        btn.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9000;background:rgba(15,23,42,.85);border:1px solid #334155;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;';
        btn.addEventListener('click', function () {
            var s = slotOf(); if (s == null) return;
            var next = !isOn(s); setOn(s, next); syncBtn(btn);
            try {
                if (typeof logSys === 'function') logSys('<span style="color:#c4b5fd;font-weight:bold;">🏛️ 傳統模式(偽) 已' + (next ? '開啟' : '關閉') + '</span>：' + (next ? '之後打到/製作/潘朵拉的裝備會自帶隨機強化值（商店除外）。' : '之後拿到的裝備恢復 +0。') + '已有裝備不受影響。');
            } catch (e) {}
        });
        syncBtn(btn);
        document.body.appendChild(btn);
    }

    // 首頁「⚙ 其他功能」設定選單註冊一個「各角色設定」面板（可在未載入時逐存檔位設定）
    window.AFK_SETTINGS = window.AFK_SETTINGS || { _items: [], add: function (it) { this._items.push(it); } };
    AFK_SETTINGS.add({ label: '🏛️ 傳統模式(偽) 設定', onClick: openSlotPanel });
    function openSlotPanel() {
        if (document.getElementById('afk-trad-overlay')) return;
        var ov = document.createElement('div');
        ov.id = 'afk-trad-overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.66);display:flex;align-items:center;justify-content:center;padding:16px;';
        var card = document.createElement('div');
        card.style.cssText = 'background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:14px;max-width:480px;width:100%;max-height:86vh;overflow:auto;';
        var max = (typeof SAVE_SLOT_MAX !== 'undefined') ? SAVE_SLOT_MAX : 8;
        var rows = '';
        for (var s = 1; s <= max; s++) {
            var nm = slotName(s);
            var on = isOn(s);
            rows += '<label style="display:flex;align-items:center;gap:12px;padding:9px 10px;border:1px solid #1e293b;border-radius:10px;margin-bottom:6px;cursor:pointer;background:#0b1222;">'
                + '<input type="checkbox" data-slot="' + s + '" ' + (on ? 'checked' : '') + ' style="width:18px;height:18px;flex:none;accent-color:#a78bfa;">'
                + '<span style="flex:1;">存檔 ' + s + (nm ? '　<span style="color:#94a3b8;">' + esc(nm) + '</span>' : '<span style="color:#475569;">（空）</span>') + '</span></label>';
        }
        card.innerHTML = '<div style="padding:16px 18px;border-bottom:1px solid #1e293b;">'
            + '<div style="font-size:17px;font-weight:700;">🏛️ 傳統模式(偽)</div>'
            + '<div style="font-size:12px;color:#94a3b8;margin-top:3px;line-height:1.5;">開啟的角色，打到／製作／潘朵拉來的裝備會自帶隨機強化值（商店買的維持 +0），手動強化照常可用。隨時可改，只影響之後拿到的裝備。</div></div>'
            + '<div style="padding:10px 14px;">' + rows + '</div>'
            + '<div style="padding:12px 16px;border-top:1px solid #1e293b;text-align:right;"><button id="afk-trad-close" style="background:#0ea5e9;border:none;color:#04263a;font-weight:700;border-radius:8px;padding:8px 16px;cursor:pointer;">完成</button></div>';
        ov.appendChild(card);
        document.body.appendChild(ov);
        function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
        ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
        card.querySelector('#afk-trad-close').addEventListener('click', close);
        card.querySelectorAll('input[data-slot]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                setOn(parseInt(cb.getAttribute('data-slot'), 10), cb.checked);
                var t = document.getElementById('afk-trad-toggle'); if (t) syncBtn(t);
            });
        });
    }
    // 讀某存檔位角色名（唯讀，不動存檔）；沿用核心 slotSummary 若有，否則留空
    function slotName(s) {
        try {
            if (typeof slotSummary === 'function') { var sm = slotSummary(s); return sm && sm.name ? sm.name : (sm && sm.cls ? sm.cls : ''); }
        } catch (e) {}
        return '';
    }

    // 進出遊戲時更新遊戲內小開關
    try {
        var mo = new MutationObserver(function () { injectInGameToggle(); });
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true });
    } catch (e) {}
    injectInGameToggle();
    setInterval(injectInGameToggle, 3000);   // 兜底：class 變動 observer 漏接時仍會更新

    try { console.log('[AFK-traditional] hooks OK — 傳統模式(偽)/自動衝裝已就緒（核心鉤子 __afkTradRollEn）。'); } catch (e) {}
})();
