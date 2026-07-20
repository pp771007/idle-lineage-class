/**
 * afk-warehouse.js — 倉庫擴充(純外掛,自 main 的核心版移植):
 *   ① 金幣「全部存入/全部取出」鈕(填滿數量欄後走核心 whGold,交易快照/防複製全重用)。
 *   ② 主分類補「遺物」(橫跨武器/防具/飾品;原本分類下仍查得到,不動 whCategory)。
 *   ③ 主分類補「席琳遺骸」,子分類=套裝名(詞綴在實例 seteff 上,核心 whMatchFilter 只吃 id
 *      → 套裝子分類改在 render 後依清單列的 data-tip-uid 反查實例後過濾,不動核心簽名)。
 *   ④ 觸控裝置長按倉庫/背包清單物品 → 顯示物品資料(核心只有 hover tooltip,手機看不到)。
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

    // ── 觸控長按看物品資料 ─────────────────────────────────────
    // 核心把格子的 click 寫死成 whDeposit/whWithdraw、資訊只掛在桌機 mousemove tooltip 上,
    // 手機因此完全看不到物品資料;這裡在兩個清單容器上做事件委派補上長按檢視。
    var LP_MS = 450;          // 長按判定時間
    var LP_MOVE_TOL = 10;     // 位移超過此值視為捲動,取消長按
    var LP_CLICK_GUARD_MS = 900;   // 長按觸發後在此時間內攔掉一次 click(否則放開手指東西就被存/取走)
    var LP_Z = 9700;          // 與 afk-mobile 浮動選單同層,壓得過倉庫浮動視窗(72)

    var _isTouch = (function () {
        try {
            return ('ontouchstart' in window)
                || (window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
        } catch (e) { return false; }
    })();

    var _lpTimer = null, _lpX = 0, _lpY = 0, _lpGuardUntil = 0, _lpTip = null;

    function _lpGetTip() {
        if (_lpTip && _lpTip.parentNode) return _lpTip;
        // 自建一顆,不重用核心 .game-tooltip:那顆有 _id 快取且 document mousedown 會 hideTip,兩邊會互踩
        var el = document.createElement('div');
        el.id = 'afk-wh-tip';
        el.setAttribute('style', 'position:fixed;left:0;top:0;display:none;z-index:' + LP_Z + ';'
            + 'max-width:min(84vw,340px);max-height:60vh;overflow-y:auto;'
            + 'background:rgba(15,23,42,0.98);border:1px solid #475569;border-radius:6px;'
            + 'padding:8px 10px;box-shadow:0 6px 24px rgba(0,0,0,0.6);'
            + 'pointer-events:none;-webkit-user-select:none;user-select:none;');
        document.body.appendChild(el);
        _lpTip = el;
        return el;
    }
    function _lpHide() { try { if (_lpTip) _lpTip.style.display = 'none'; } catch (e) {} }

    // iOS Safari 長按可點元素會跳原生「拷貝/查詢」callout 蓋住自製資料框,關掉它與文字選取
    function _lpInjectCSS() {
        if (!_isTouch || document.getElementById('afk-wh-lp-style')) return;
        var s = document.createElement('style'); s.id = 'afk-wh-lp-style';
        s.textContent = '#wh-inv-list [data-tip-uid],#wh-store-list [data-tip-uid]{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;}';
        (document.head || document.documentElement).appendChild(s);
    }

    // 依格子的 data-tip-uid/data-tip-src 反查實例(與遺骸子分類過濾同一套反查邏輯)
    function _lpFindItem(src, uidv) {
        try {
            if (src === 'wh') {
                var w = loadWarehouse();
                return ((w && w.items) || []).find(function (x) { return x && String(x.uid) === String(uidv); }) || null;
            }
            return ((player && player.inv) || []).find(function (x) { return x && String(x.uid) === String(uidv); }) || null;
        } catch (e) { return null; }
    }

    function _lpShow(host, x, y) {
        if (typeof getItemFullName !== 'function' || typeof buildItemDescHTML !== 'function') return;
        var it = _lpFindItem(host.getAttribute('data-tip-src') || 'inv', host.getAttribute('data-tip-uid'));
        if (!it) return;
        var el = _lpGetTip();
        var color = typeof getItemColor === 'function' ? getItemColor(it) : 'text-white';
        el.innerHTML = '<div class="font-bold text-base ' + color + '" style="margin-bottom:4px;">' + getItemFullName(it) + '</div>'
            + '<div class="text-slate-300" style="font-size:12px;line-height:1.5;">' + buildItemDescHTML(it) + '</div>';
        el.style.display = 'block';
        // 先顯示才量得到尺寸,再夾在視窗內(手指附近但不出畫面)
        var pad = 14, w = el.offsetWidth, h = el.offsetHeight;
        var left = x + pad, top = y - h - pad;
        if (left + w > window.innerWidth - 6) left = x - pad - w;
        if (top < 6) top = y + pad;
        if (top + h > window.innerHeight - 6) top = window.innerHeight - 6 - h;
        el.style.left = Math.max(4, left) + 'px';
        el.style.top = Math.max(4, top) + 'px';
        _lpGuardUntil = Date.now() + LP_CLICK_GUARD_MS;
    }

    function _lpClear() { if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; } }

    function bindLongPress(host) {
        if (!_isTouch || !host || host.dataset.afkLp) return;
        _lpInjectCSS();
        host.dataset.afkLp = '1';   // 容器由核心重繪時整顆換掉,旗標跟著消失 → 不會重複綁

        host.addEventListener('touchstart', function (e) {
            _lpClear(); _lpHide();
            var t = e.touches && e.touches[0]; if (!t) return;
            var cell = e.target && e.target.closest ? e.target.closest('[data-tip-uid]') : null;
            if (!cell) return;
            _lpX = t.clientX; _lpY = t.clientY;
            _lpTimer = setTimeout(function () {
                _lpTimer = null;
                try { _lpShow(cell, _lpX, _lpY); } catch (err) {}
            }, LP_MS);
        }, { passive: true });

        // 不 preventDefault:清單要能垂直捲動,只用位移取消長按
        host.addEventListener('touchmove', function (e) {
            if (!_lpTimer) return;
            var t = e.touches && e.touches[0]; if (!t) return;
            if (Math.abs(t.clientX - _lpX) > LP_MOVE_TOL || Math.abs(t.clientY - _lpY) > LP_MOVE_TOL) _lpClear();
        }, { passive: true });

        host.addEventListener('touchend', _lpClear, { passive: true });
        host.addEventListener('touchcancel', function () { _lpClear(); }, { passive: true });
        host.addEventListener('scroll', function () { _lpClear(); _lpHide(); }, { passive: true });

        // 🚨 長按已顯示資料 → 攔掉隨後那次 click,否則看資料的同時東西就被存入/取出了。
        // capture 階段才擋得住格子上 inline 的 onclick;逾時自動失效,不影響一般短點擊。
        host.addEventListener('click', function (e) {
            if (!_lpGuardUntil || Date.now() > _lpGuardUntil) { _lpGuardUntil = 0; return; }
            _lpGuardUntil = 0;
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        }, true);
    }

    if (_isTouch) {
        // 點畫面任一處 / 捲動任何祖先容器都收起
        document.addEventListener('touchstart', function (e) {
            if (!_lpTip || _lpTip.style.display === 'none') return;
            var inList = e.target && e.target.closest ? e.target.closest('#wh-inv-list,#wh-store-list') : null;
            if (!inList) _lpHide();
        }, true);
        document.addEventListener('scroll', function () { _lpHide(); }, true);
    }

    // ── render 後處理:注入鈕/選項 + 遺骸套裝子分類過濾 ─────────────
    function afterRender() {
        try {
            bindLongPress(document.getElementById('wh-inv-list'));
            bindLongPress(document.getElementById('wh-store-list'));
        } catch (e) {}
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
