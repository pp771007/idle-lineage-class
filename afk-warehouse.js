/**
 * afk-warehouse.js — 倉庫擴充(純外掛,自 main 的核心版移植):
 *   ① 金幣「全部存入/全部取出」鈕(填滿數量欄後走核心 whGold,交易快照/防複製全重用)。
 *   ② 主分類補「遺物」(橫跨武器/防具/飾品;原本分類下仍查得到,不動 whCategory)。
 *   ③ 主分類補「席琳遺骸」,子分類=套裝名(詞綴在實例 seteff 上,核心 whMatchFilter 只吃 id
 *      → 套裝子分類改在 render 後依清單列的 data-tip-uid 反查實例後過濾,不動核心簽名)。
 *
 * 作法:包 whSubCatOptions/whMatchFilter/renderWarehouseNPC 三支全域;缺任一→console.warn 後停用。
 */
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('warehouse')) return;   // 🎚️ 外掛開關
    if (typeof window.renderWarehouseNPC !== 'function' || typeof window.whGold !== 'function'
        || typeof window.loadWarehouse !== 'function' || typeof window.whSubCatOptions !== 'function'
        || typeof window.whMatchFilter !== 'function') {
        try { console.warn('[AFK-warehouse] 缺核心倉庫函式,倉庫擴充停用。'); } catch (e) {}
        return;
    }

    // ── 主分類擴充:relic / remains ──────────────────────────────
    var _subOpts = window.whSubCatOptions;
    window.whSubCatOptions = function () {
        try {
            if (_whFilter === 'relic') return [{ key: 'wpn', name: '武器' }, { key: 'arm', name: '防具' }, { key: 'acc', name: '飾品' }];
            if (_whFilter === 'remains') return (typeof SHERINE_EFFECTS !== 'undefined' ? SHERINE_EFFECTS : []).map(function (n) { return { key: n, name: n }; });
        } catch (e) {}
        return _subOpts.apply(this, arguments);
    };
    var _match = window.whMatchFilter;
    window.whMatchFilter = function (id) {
        try {
            if (_whFilter === 'relic') {
                var d = DB.items[id];
                if (!d || typeof isRelic !== 'function' || !isRelic(d)) return false;
                return !_whSubFilter || d.type === _whSubFilter;
            }
            if (_whFilter === 'remains') {
                var d2 = DB.items[id];
                return !!(d2 && d2.remains);   // 套裝名子分類看「實例」的 seteff → render 後過濾(见 afterRender)
            }
        } catch (e) {}
        return _match.apply(this, arguments);
    };

    // ── 金幣全部存入/取出:填滿數量欄再走核心 whGold(整套交易保護重用) ──
    window.__afkWhGoldAll = function (dir) {
        try {
            var w = loadWarehouse();
            var amt = dir === 'in' ? (player.gold || 0) : ((w && w.gold) || 0);
            if (amt <= 0) return;
            var inp = document.getElementById('wh-gold-amt');
            if (inp) inp.value = amt;
            whGold(dir);
        } catch (e) {}
    };

    // ── render 後處理:注入鈕/選項 + 遺骸套裝子分類過濾 ─────────────
    function afterRender() {
        var inp = document.getElementById('wh-gold-amt');
        if (!inp) return;   // 倉庫面板不在畫面上
        var goldRow = inp.parentElement;
        if (goldRow && !document.getElementById('afk-wh-allin')) {
            var mk = function (id, txt, tip, dir, style) {
                var b = document.createElement('button');
                b.id = id; b.type = 'button'; b.textContent = txt;
                b.title = tip; b.setAttribute('aria-label', tip);
                b.className = 'btn px-2 text-sm font-bold h-8 inline-flex items-center justify-center';
                b.setAttribute('style', style);
                b.addEventListener('click', function () { window.__afkWhGoldAll(dir); });
                return b;
            };
            // 圖示鈕(文字太佔位);沿用核心存入/取出鈕的配色,一眼看得出同組
            goldRow.appendChild(mk('afk-wh-allin', '📥', '金幣全部存入', 'in', 'background: linear-gradient(135deg, #0c4a5e 0%, #0e7490 28%, #0a3d4d 52%, #11657e 76%, #093440 100%); color: #a5f3fc; border-color: #0891b2;'));
            goldRow.appendChild(mk('afk-wh-allout', '📤', '金幣全部取出', 'out', 'background: linear-gradient(135deg, #6b2a10 0%, #b3490e 28%, #5a230e 52%, #9a3e0c 76%, #4a1d0c 100%); color: #fed7aa; border-color: #c2410c;'));
        }
        // 主分類下拉補 遺物/席琳遺骸(核心每次重繪都重建 select → 每次補)
        var sel = document.querySelector('select[onchange*="whSetFilter"]');
        if (sel && !sel.querySelector('option[value="relic"]')) {
            [['relic', '遺物'], ['remains', '席琳遺骸']].forEach(function (o) {
                var op = document.createElement('option');
                op.value = o[0]; op.textContent = o[1];
                sel.appendChild(op);
            });
        }
        if (sel && (_whFilter === 'relic' || _whFilter === 'remains')) sel.value = _whFilter;
        // 席琳遺骸+選了套裝名:依清單列 uid 反查實例 seteff 過濾(核心 whMatchFilter 只吃 id 看不到詞綴)
        if (_whFilter === 'remains' && _whSubFilter) {
            var w = loadWarehouse();
            var lists = [['wh-inv-list', (player && player.inv) || []], ['wh-store-list', (w && w.items) || []]];
            lists.forEach(function (pair) {
                var host = document.getElementById(pair[0]); if (!host) return;
                host.querySelectorAll('[data-tip-uid]').forEach(function (el) {
                    var uidv = el.getAttribute('data-tip-uid');
                    var it = pair[1].find(function (i) { return i && String(i.uid) === String(uidv); });
                    var g = it && it.seteff ? String(it.seteff).slice(0, 2) : '';
                    if (g !== String(_whSubFilter).slice(0, 2)) el.style.display = 'none';
                });
            });
        }
    }
    var _render = window.renderWarehouseNPC;
    window.renderWarehouseNPC = function () {
        var r = _render.apply(this, arguments);
        try { afterRender(); } catch (e) {}
        return r;
    };

    try { console.log('[AFK-warehouse] hooks OK — 倉庫擴充(金幣全存取/遺物/席琳遺骸分類)已啟用。'); } catch (e) {}
})();
