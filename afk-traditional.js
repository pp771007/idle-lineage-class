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

    // ── UI：選角卡片右上角「傳統」checkbox ──────────────────────
    //   卡片每次 renderLoadSelect 都 innerHTML 重建 → wrap 後每次重繪重注入（同 afk-slotinfo 手法）。
    //   只掛「有角色」的卡；點擊 stopPropagation，免得觸發選卡/雙擊進入。
    function decorateCards() {
        var grid = document.getElementById('load-slot-grid');
        if (!grid) return;
        var cards = grid.querySelectorAll('.load-slot-card.filled');
        for (var i = 0; i < cards.length; i++) {
            (function (card) {
                var old = card.querySelector('.afk-trad-cb'); if (old) old.remove();
                var slot = parseInt(card.getAttribute('data-slot'), 10);
                if (!slot) return;
                try { if (getComputedStyle(card).position === 'static') card.style.position = 'relative'; } catch (e) {}
                var lab = document.createElement('span');
                lab.className = 'afk-trad-cb';
                lab.title = '傳統模式(偽)：開啟的角色，打到／製作／潘朵拉來的裝備自帶隨機強化值（商店買的維持 +0）。隨時可改，只影響之後拿到的裝備。';
                // 位置用百分比:神龕邊框圖(#load-select-overlay,z-index 同層但 DOM 較後)會蓋住卡片外緣,要落在拱門開口內
                lab.style.cssText = 'position:absolute;top:9%;right:10%;z-index:4;display:flex;align-items:center;gap:3px;padding:2px 5px;border-radius:7px;background:rgba(2,6,23,.78);font-size:.62rem;font-weight:700;color:#e2e8f0;cursor:pointer;text-shadow:0 1px 2px #000;';
                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = isOn(slot);
                cb.style.cssText = 'width:13px;height:13px;flex:none;accent-color:#a78bfa;cursor:pointer;margin:0;';
                var txt = document.createElement('span');
                txt.textContent = '傳統';
                lab.appendChild(cb); lab.appendChild(txt);
                // 阻斷冒泡：不讓點擊變成「選卡/雙擊進入」；點文字也切換
                lab.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (e.target !== cb) { cb.checked = !cb.checked; }
                    setOn(slot, cb.checked);
                });
                lab.addEventListener('dblclick', function (e) { e.stopPropagation(); });
                card.appendChild(lab);
            })(cards[i]);
        }
    }
    function wrapRenderLoad() {
        if (typeof window.renderLoadSelect !== 'function' || window.renderLoadSelect.__afkTrad) return false;
        var orig = window.renderLoadSelect;
        var wrapped = function () { orig.apply(this, arguments); try { decorateCards(); } catch (e) {} };
        wrapped.__afkTrad = true;
        window.renderLoadSelect = wrapped;
        return true;
    }
    var okUi = wrapRenderLoad();

    try { console.log('[AFK-traditional] hooks OK — 傳統模式(偽)/自動衝裝已就緒（核心鉤子 __afkTradRollEn；選角卡 checkbox ' + (okUi ? '✓' : '✗') + '）。'); } catch (e) {}
})();
