/* ==========================================================================
 * afk-whbatch.js — 倉庫批次存取(勾選 + 全選 + 一次搬完)
 *
 * 解決什麼:
 *   核心每搬「一件」都跑完整一輪 whTxnCommit ＝ saveGame() + saveWarehouse()
 *   (js/12:452/480),再加 renderTabs(true) + 整塊 innerHTML 重繪。倉庫幾千格時
 *   搬一件要等好幾百毫秒,要清空倉庫等於按幾千次、每次都等 → 實務上做不到。
 *
 * 作法(不改核心·全部走核心自己的交易保護):
 *   進「批次模式」後點清單=勾選(不搬移),按執行才一次搬完:
 *     whTxnSnapshot() → 迴圈搬 N 件 → whTxnCommit() 一次 → 重繪一次。
 *   (原本照的是核心 whOneClickDeposit 的模式;那支已隨「一鍵存入」拿掉)
 *   ⚠️ 合併/uid 換發/廢品旗標/收集冊登錄/倉庫上限 全部逐條比照核心 whDeposit/whWithdraw,
 *      不自己另立規則(唯一差別:批次一律「整疊」搬,不看「數量」欄)。
 *
 * 為什麼要自己建 sig/uid 索引:
 *   核心 _whStackFind 是 Array.find(線性),單筆呼叫沒問題;批次 N 筆就是 O(N²) ——
 *   3477 格會做上百萬次 itemSig 字串組裝(實測會卡住幾秒)。這裡改「一次建 Map、邊搬邊更新」,
 *   查找結果與 _whStackFind 完全一致(同 sig 取最先出現的那格·排除 gw)。
 *
 * 🎚️ 預設「關」:它會改掉「點清單」原本的意思(原版點一下就直接搬走),不該在沒人要求時
 *   悄悄變更既有操作手感 → 要用的人自己到「🎚️ 外掛」打開。
 *   ⚠️ 寫法是「包核心函式型」(見 CLAUDE.md 契約):照樣安裝 wrapper、每次重繪才問 enabled(),
 *   關掉時把注入的 UI 收乾淨並透明放行原函式。所以開關即時生效、不必重新整理,
 *   smoke 也照樣看得到 hooks OK。
 *   ⚠️ register 必須排在第一次 enabled() 之前:AFK_TOGGLES.enabled() 找不到登錄項時
 *   預設值一律回 true(afk-toggles.js:39),先問就會把 def:false 問成 true。
 *
 * 優雅降級:缺任何核心倉庫函式就 console.warn 後安靜停用,不影響遊戲。
 * ========================================================================== */
(function () {
    'use strict';

    if (window.AFK_TOGGLES) AFK_TOGGLES.register({
        id: 'whbatch', name: '倉庫批次存取', group: '遊戲介面', def: false,
        desc: '倉庫可勾選、全選、一次搬完；開著的時候點清單是勾選，不會直接搬'
    });
    // 讀不到開關中樞 → 不啟用:預設關的偏好不可在讀不到設定時自作主張開啟(同 afk-notip)
    function on() { try { return !!window.AFK_TOGGLES && AFK_TOGGLES.enabled('whbatch'); } catch (e) { return false; } }

    // const 宣告的核心常數不掛 window(WH_MAX/WH_NO_STORE),只能以裸名取;取不到才用已知值兜底
    function core(name, fallback) { try { return eval(name); } catch (e) { return fallback; } }   // eslint-disable-line no-eval

    var NEED = ['renderWarehouseNPC', 'loadWarehouse', 'whTxnSnapshot', 'whTxnCommit',
        '_whStackAbsorb', '_whClearJunkState', 'itemSig', 'uid', 'renderTabs', 'updateUI'];
    for (var i = 0; i < NEED.length; i++) {
        if (typeof window[NEED[i]] !== 'function') {
            try { console.warn('[AFK-whbatch] 缺核心函式 ' + NEED[i] + ',倉庫批次存取停用。'); } catch (e) {}
            return;
        }
    }

    var _batch = false;           // 批次模式開關
    var selInv = {}, selWh = {};  // 已勾選的 uid(跨重繪保留;執行後清空)

    function n(o) { var c = 0; for (var k in o) if (o[k]) c++; return c; }
    function clear(o) { for (var k in o) delete o[k]; }
    function inTown() {
        try { return !!(typeof mapState !== 'undefined' && mapState.current && String(mapState.current).indexOf('town_') === 0); }
        catch (e) { return false; }
    }
    function noStore(id) { var L = core('WH_NO_STORE', []); return !!(L && L.indexOf && L.indexOf(id) >= 0); }
    function whMax() { var v = core('WH_MAX', 5000); return (typeof v === 'number' && v > 0) ? v : 5000; }
    function say(html) { try { if (typeof logSys === 'function') logSys(html); } catch (e) {} }

    // ── 搬移中的遮罩 ───────────────────────────────────────────────
    // 搬移本身很便宜(索引化的單趟掃描),貴的是**搬完之後把兩份清單整個重畫**——成本看的是
    // 「清單有幾列」而不是「搬了幾件」,所以只搬 10 件進一個 4,500 格的倉庫一樣慢。
    // 實測(真實存檔·背包 2000／倉庫 4500·CPU 4 倍節流≈中階手機)整趟 2.8 秒,其中
    // 重畫倉庫面板 1.22 秒、存檔 0.69 秒、重畫背包分頁 0.19 秒 —— 都是同步的,期間畫面完全不動。
    // 沒有便宜的加速法(要快得重寫核心的清單渲染成虛擬捲動),所以改成「先讓玩家知道在忙」。
    var BUSY_MIN_ROWS = 500;   // 要重畫的總列數;低於此在手機上也 100ms 內做完,跳個遮罩反而是閃一下
    function rowsAbout() {
        try { return ((player && player.inv) || []).length + ((loadWarehouse() || {}).items || []).length; }
        catch (e) { return 0; }
    }
    function busy(work) {
        if (rowsAbout() < BUSY_MIN_ROWS) { work(); return; }
        var el = document.createElement('div');
        el.id = 'afk-whb-busy';
        el.innerHTML = '<div>搬移中，請稍候…</div>';
        document.body.appendChild(el);
        // rAF 之後再 setTimeout(0):只用其中一個,同步的重活會跟這次插入合併進同一幀 → 遮罩根本沒被畫出來。
        requestAnimationFrame(function () {
            setTimeout(function () {
                try { work(); } finally { var e = document.getElementById('afk-whb-busy'); if (e) e.remove(); }
            }, 0);
        });
    }

    // ── sig 索引:等價於核心 _whStackFind(同 sig 取最先出現者·gw 永不合併) ──────
    function buildSigIdx(arr) {
        var m = {};
        for (var i = 0; i < arr.length; i++) {
            var it = arr[i];
            if (!it || it.gw) continue;
            var k = itemSig(it);
            if (!(k in m)) m[k] = it;
        }
        return m;
    }
    function findStack(idx, it) { return (it && !it.gw) ? (idx[itemSig(it)] || null) : null; }
    function addStack(idx, it) { if (it && !it.gw) { var k = itemSig(it); if (!(k in idx)) idx[k] = it; } }
    function uidSet(arr) { var s = {}; for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].uid != null) s[arr[i].uid] = 1; return s; }

    // ── 批次取出:倉庫 → 背包 ─────────────────────────────────────
    // ⚠️ 一律「掃來源陣列、比對勾選集合」,不可用 uid 當索引(uid → 物品):
    //    實測玩家倉庫存在「兩格共用同一個 uid」的既有損壞(4998 格裡 17 組)。uid 索引只留得下最後一格,
    //    另一格會連同數量一起被 filter 掉＝真實遺失(第一版就是這樣少了 35 件)。
    //    畫面上同 uid 的兩列都會一起打勾,語意就是兩格都要搬 → 逐格處理才對得上。
    function runWithdraw(uids) {
        if (!inTown()) { say('<span class="text-red-400">離開安全區後無法使用倉庫。</span>'); return; }
        var w = loadWarehouse();
        var snap = whTxnSnapshot();
        var sel = {};
        for (var s = 0; s < uids.length; s++) sel[uids[s]] = 1;
        var invIdx = buildSigIdx(player.inv || []);
        var invUids = uidSet(player.inv || []);
        var keep = [], moved = 0, ids = {};
        for (var i = 0; i < w.items.length; i++) {
            var it = w.items[i];
            if (!it || it.uid == null || !sel[it.uid]) { keep.push(it); continue; }
            // 比照核心 whWithdraw:uid 與背包撞號才換發;清掉廢品暫態旗標;併入同 sig 堆疊
            if (invUids[it.uid]) it.uid = uid();
            invUids[it.uid] = 1;
            _whClearJunkState(it);
            var stack = findStack(invIdx, it);
            if (stack) _whStackAbsorb(stack, it, (it.cnt || 1));
            else { player.inv.push(it); addStack(invIdx, it); }
            ids[it.id] = 1; moved++;
        }
        if (!moved) { say('<span class="text-slate-400">沒有可取出的物品。</span>'); return; }
        w.items = keep;
        if (!whTxnCommit(w, snap)) { refresh(); return; }
        // 🗡️🧰🏺 收集冊:比照核心,只有角色與倉庫都寫入成功才登錄
        for (var id in ids) {
            try { if (typeof registerEquipObtained === 'function') registerEquipObtained(id); } catch (e) {}
            try { if (typeof registerMiscObtained === 'function') registerMiscObtained(id); } catch (e) {}
            try { if (typeof registerRelicObtained === 'function') registerRelicObtained(id); } catch (e) {}
        }
        clear(selWh);
        refresh();
        say('<span class="text-amber-300 font-bold">批次取出：已取出 ' + moved + ' 格到背包。</span>');
    }

    // ── 批次存入:背包 → 倉庫 ─────────────────────────────────────
    function runDeposit(uids) {
        if (!inTown()) { say('<span class="text-red-400">離開安全區後無法使用倉庫。</span>'); return; }
        var w = loadWarehouse();
        var snap = whTxnSnapshot();
        var MAX = whMax();
        var sel = {};
        for (var s = 0; s < uids.length; s++) sel[uids[s]] = 1;
        var whIdx = buildSigIdx(w.items);
        var keep = [], moved = 0, full = false, skipNoStore = 0, skipLock = 0;
        var inv = player.inv || [];
        for (var j = 0; j < inv.length; j++) {
            var it = inv[j];
            if (!it || it.uid == null || !sel[it.uid] || full) { keep.push(it); continue; }
            if (noStore(it.id)) { skipNoStore++; keep.push(it); continue; }
            if (it.lock) { skipLock++; keep.push(it); continue; }          // 鎖定物品需先解鎖(同核心)
            var stack = findStack(whIdx, it);
            if (!stack && w.items.length >= MAX) { full = true; keep.push(it); continue; }   // 滿了就停,其餘留在背包
            if (stack) _whStackAbsorb(stack, it, (it.cnt || 1));
            else { w.items.push(_whClearJunkState(it)); addStack(whIdx, it); }
            moved++;
        }
        if (!moved) {
            say(full ? '<span class="text-red-400">倉庫已滿（上限 ' + MAX + ' 格）。</span>'
                : '<span class="text-slate-400">沒有可存入的物品' + (skipNoStore ? '（' + skipNoStore + ' 項不可存入）' : '') + '。</span>');
            return;
        }
        player.inv = keep;
        if (!whTxnCommit(w, snap)) { refresh(); return; }
        clear(selInv);
        refresh();
        say('<span class="text-cyan-300 font-bold">批次存入：已存入 ' + moved + ' 格'
            + (full ? '（倉庫已滿，其餘未存入）' : '')
            + (skipNoStore ? '，' + skipNoStore + ' 項不可存入已略過' : '')
            + (skipLock ? '，' + skipLock + ' 項鎖定中已略過' : '') + '。</span>');
    }

    function refresh() {
        try { renderTabs(true); } catch (e) {}
        try { updateUI(); } catch (e) {}
        try { renderWarehouseNPC(document.getElementById('interaction-content')); } catch (e) {}
    }

    // ── UI ────────────────────────────────────────────────────────
    function css() {
        if (document.getElementById('afk-whb-css')) return;
        var s = document.createElement('style'); s.id = 'afk-whb-css';
        s.textContent = [
            '#afk-whb-toggle.on{background:#0e7490 !important;color:#cffafe !important;border-color:#22d3ee !important;}',
            '.afk-whb-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;padding:5px 7px;',
            '  background:#0b1220;border:1px solid #334155;border-radius:7px;font-size:12px;color:#cbd5e1;}',
            '.afk-whb-bar button{background:#1e293b;border:1px solid #475569;color:#e2e8f0;border-radius:6px;',
            '  padding:3px 9px;font-size:12px;font-weight:bold;cursor:pointer;font-family:inherit;line-height:1.5;}',
            '.afk-whb-bar button:hover{background:#273449;}',
            '.afk-whb-bar button:disabled{opacity:.45;cursor:not-allowed;}',
            '.afk-whb-go{background:#0e7490 !important;border-color:#0891b2 !important;color:#cffafe !important;}',
            '.afk-whb-cnt{color:#fcd34d;font-weight:bold;}',
            /* 勾選框用 ::before 畫,不往幾千列插 DOM(重繪成本會直接翻倍) */
            '.afk-whb-mode [data-tip-uid]::before{content:"☐ ";color:#94a3b8;font-weight:bold;}',
            '.afk-whb-mode [data-tip-uid].afk-whb-on::before{content:"☑ ";color:#22d3ee;}',
            '.afk-whb-mode [data-tip-uid].afk-whb-on{background:rgba(14,116,144,.45) !important;border-color:#22d3ee !important;}',
            '.afk-whb-mode [data-tip-uid].afk-whb-no{opacity:.4;}',
            '.afk-whb-mode [data-tip-uid].afk-whb-no::before{content:"— ";}',
            /* 搬移中遮罩:蓋住整個畫面才擋得住「以為沒反應又多點幾下」 */
            '#afk-whb-busy{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;',
            '  background:rgba(2,6,23,.72);}',
            '#afk-whb-busy>div{padding:14px 22px;border-radius:10px;background:#0b1220;border:1px solid #0891b2;',
            '  color:#cffafe;font-size:15px;font-weight:bold;}'
        ].join('');
        (document.head || document.documentElement).appendChild(s);
    }

    // 這一列能不能搬(存入側:不可存倉的排除;取出側全部可搬)
    function rowItem(src, u) {
        try {
            if (src === 'wh') { var w = loadWarehouse(); return (w.items || []).find(function (x) { return x && String(x.uid) === String(u); }) || null; }
            return ((player && player.inv) || []).find(function (x) { return x && String(x.uid) === String(u); }) || null;
        } catch (e) { return null; }
    }

    function eachRow(host, fn) {
        if (!host) return;
        var rows = host.querySelectorAll('[data-tip-uid]');
        for (var i = 0; i < rows.length; i++) fn(rows[i], rows[i].getAttribute('data-tip-uid'));
    }

    function paint() {
        var pairs = [['wh-inv-list', selInv], ['wh-store-list', selWh]];
        for (var p = 0; p < pairs.length; p++) {
            var host = document.getElementById(pairs[p][0]); if (!host) continue;
            host.classList.toggle('afk-whb-mode', _batch);
            var sel = pairs[p][1];
            eachRow(host, function (row, u) { row.classList.toggle('afk-whb-on', !!sel[u]); });
        }
        bars();
    }

    // 存入側:不可存倉的列標成不可選(避免全選勾一堆搬不動的)
    function markNoStore() {
        var host = document.getElementById('wh-inv-list'); if (!host || !_batch) return;
        var inv = (player && player.inv) || [], map = {};
        for (var i = 0; i < inv.length; i++) if (inv[i] && inv[i].uid != null) map[inv[i].uid] = inv[i];
        eachRow(host, function (row, u) { var it = map[u]; if (it && noStore(it.id)) row.classList.add('afk-whb-no'); });
    }

    function selectAll(side) {
        var host = document.getElementById(side === 'wh' ? 'wh-store-list' : 'wh-inv-list');
        var sel = side === 'wh' ? selWh : selInv;
        eachRow(host, function (row, u) { if (!row.classList.contains('afk-whb-no')) sel[u] = 1; });
        paint();
    }

    function bars() {
        var defs = [
            { id: 'wh-inv-list', side: 'inv', sel: selInv, act: '存入', cls: 'afk-whb-go' },
            { id: 'wh-store-list', side: 'wh', sel: selWh, act: '取出', cls: 'afk-whb-go' }
        ];
        for (var i = 0; i < defs.length; i++) {
            var d = defs[i];
            var list = document.getElementById(d.id); if (!list) continue;
            var bar = document.getElementById('afk-whb-bar-' + d.side);
            // 倉庫面板一次只顯示一個分頁(倉庫/背包),另一份清單 display:none → 它的工具列也不放
            if (!_batch || list.style.display === 'none') { if (bar) bar.remove(); continue; }
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'afk-whb-bar-' + d.side;
                bar.className = 'afk-whb-bar';
                list.parentNode.insertBefore(bar, list);
            }
            var listed = 0, selectable = 0;
            eachRow(list, function (row) { listed++; if (!row.classList.contains('afk-whb-no')) selectable++; });
            var cnt = n(d.sel);
            bar.innerHTML = '';
            var mk = function (txt, cls, on, dis) {
                var b = document.createElement('button');
                b.type = 'button'; b.textContent = txt; if (cls) b.className = cls;
                b.disabled = !!dis; b.addEventListener('click', on); bar.appendChild(b); return b;
            };
            mk('全選此清單 (' + selectable + ')', '', (function (side) { return function () { selectAll(side); }; })(d.side), !selectable);
            mk('清除', '', (function (sel) { return function () { clear(sel); paint(); }; })(d.sel), !cnt);
            var lab = document.createElement('span');
            // 面板抬頭寫的是「點倉庫物品＝取出」,批次模式下語意相反 → 沒勾東西時就地講清楚
            lab.innerHTML = cnt ? ('已勾 <span class="afk-whb-cnt">' + cnt + '</span> 格')
                : '<span style="color:#94a3b8;">點清單＝勾選（不會搬走）</span>';
            bar.appendChild(lab);
            mk('批次' + d.act + ' ▶', d.cls, (function (side, sel, act) {
                return function () {
                    var uids = []; for (var k in sel) if (sel[k]) uids.push(k);
                    if (!uids.length) return;
                    busy(function () { (side === 'wh' ? runWithdraw : runDeposit)(uids); });
                };
            })(d.side, d.sel, d.act), !cnt);
        }
    }

    // 批次模式下:點清單=勾選,不觸發核心的 whDeposit/whWithdraw(inline onclick 要用 capture 才擋得住)
    function bindList(host) {
        if (!host || host.dataset.afkWhb) return;
        host.dataset.afkWhb = '1';   // 容器每次重繪都換新的 → 旗標跟著消失,不會重複綁
        host.addEventListener('click', function (e) {
            if (!_batch) return;
            var cell = e.target && e.target.closest ? e.target.closest('[data-tip-uid]') : null;
            if (!cell || !host.contains(cell)) return;
            e.preventDefault(); e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            if (cell.classList.contains('afk-whb-no')) return;   // 不可存倉的列不給勾
            var sel = cell.getAttribute('data-tip-src') === 'wh' ? selWh : selInv;
            var u = cell.getAttribute('data-tip-uid');
            if (sel[u]) delete sel[u]; else sel[u] = 1;
            cell.classList.toggle('afk-whb-on', !!sel[u]);
            bars();
        }, true);
    }

    function injectToggle() {
        // 排在搜尋框後面(倉庫／背包兩個分頁都有)
        var anchor = document.getElementById('wh-search-input');
        if (!anchor || document.getElementById('afk-whb-toggle')) return;
        var b = document.createElement('button');
        b.id = 'afk-whb-toggle';
        b.type = 'button';
        b.textContent = '🗂️ 批次';
        b.className = 'whx-btn';
        b.title = '批次模式：點清單只勾選不搬移，勾完按「批次存入／取出」一次搬完（整疊）。搬幾百格也只存檔一次，比一件一件點快得多。';
        if (_batch) b.classList.add('on');
        b.addEventListener('click', function () {
            _batch = !_batch;
            if (!_batch) { clear(selInv); clear(selWh); }
            b.classList.toggle('on', _batch);
            paint(); markNoStore(); bars();
        });
        anchor.parentNode.insertBefore(b, anchor.nextSibling);
    }

    // 開關關掉(或玩家在面板上關掉)→ 收乾淨注入的 UI,讓倉庫回到原版:點一下就直接搬
    function teardown() {
        _batch = false; clear(selInv); clear(selWh);
        var t = document.getElementById('afk-whb-toggle'); if (t) t.remove();
        ['afk-whb-bar-inv', 'afk-whb-bar-wh'].forEach(function (id) { var b = document.getElementById(id); if (b) b.remove(); });
        ['wh-inv-list', 'wh-store-list'].forEach(function (id) {
            var h = document.getElementById(id); if (!h) return;
            h.classList.remove('afk-whb-mode');
            eachRow(h, function (row) { row.classList.remove('afk-whb-on'); row.classList.remove('afk-whb-no'); });
        });
    }

    function afterRender() {
        if (!document.getElementById('wh-inv-list')) return;   // 倉庫面板不在畫面上
        if (!on()) { teardown(); return; }                     // 🎚️ 關掉＝透明放行原版行為
        css();
        injectToggle();
        bindList(document.getElementById('wh-inv-list'));
        bindList(document.getElementById('wh-store-list'));
        markNoStore();
        paint();
    }

    var _render = window.renderWarehouseNPC;
    window.renderWarehouseNPC = function () {
        var r = _render.apply(this, arguments);
        try { afterRender(); } catch (e) { try { console.warn('[AFK-whbatch] afterRender', e); } catch (e2) {} }
        return r;
    };

    // 已在檔頭 register(必須早於第一次 enabled(),見檔頭說明)
    try { console.log('[AFK-whbatch] hooks OK — 倉庫批次存取已掛上（預設關，於「🎚️ 外掛」開啟）。'); } catch (e) {}
})();
