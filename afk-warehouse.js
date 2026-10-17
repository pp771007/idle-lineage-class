/**
 * afk-warehouse.js — 倉庫擴充(純外掛,自 main 的核心版移植):
 *   ① 觸控裝置長按倉庫/背包清單物品 → 顯示物品資料(核心只有 hover tooltip,手機看不到)。
 *   ② 穿不了的列標紅、魔法書標已學習／無法學習(核心倉庫兩欄只印物品全名,完全看不出本職業能不能穿,
 *      四個角色共用一個倉庫時尤其難挑)。判定一律走核心 checkCanEquip,不自己重寫職業規則。
 *   (2026-10-14 拿掉:遺物／席琳遺骸分類(兩套系統關閉)、「只列可穿」勾選(站長決定))
 *
 * 作法:包 renderWarehouseNPC,重繪後補標記;缺核心函式→console.warn 後停用。
 */
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('warehouse')) return;   // 🎚️ 外掛開關
    if (typeof window.renderWarehouseNPC !== 'function' || typeof window.whGold !== 'function'
        || typeof window.loadWarehouse !== 'function'
        || typeof window.checkCanEquip !== 'function') {
        try { console.warn('[AFK-warehouse] 缺核心倉庫函式,倉庫擴充停用。'); } catch (e) {}
        return;
    }

    // ── 穿不穿得上 ──────────────────────────────────────────────
    // 判定一律呼叫核心 checkCanEquip(職業/性別頭像/負重強化/劍術精通全在裡面),外掛不重寫規則。
    // 它只讀 item.id,故傳 {id:...} 即可。
    // 寵物裝備(petwpn/petarm)是給寵物穿的,拿玩家職業去判會一律變「不可穿」→ 排除(同核心 js/10 比較卡的作法)
    function _isPlayerGear(d) {
        return !!d && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc')
            && d.slot !== 'petwpn' && d.slot !== 'petarm';
    }
    function _cannotWear(id) {
        var d = DB.items[id];
        if (!_isPlayerGear(d)) return false;   // 非玩家裝備(道具/材料/寵物裝)不參與判定
        try { return !checkCanEquip({ id: id }); } catch (e) { return false; }
    }
    // ── 魔法書:已學習／無法學習 ────────────────────────────────
    // 倉庫兩欄只印物品全名,顏色只反映稀有度 → 四個角色共用一個倉庫時,分不出哪本自己學過、
    // 哪本這個職業根本學不了。背包(核心 js/10:285-296)本來就有這兩個標記,這裡把同一件事補到倉庫。
    // 🚨 判定一律用核心自己那兩條,不重寫:已學習＝player.skills 有它;無法學習＝skillReqLv() 回 undefined
    //    (那支已經含魔導精通之類的特例,自己判職業表一定會漏)。
    function _bookState(id) {
        var d = DB.items[id];
        if (!d || d.type !== 'skillbk') return '';
        try {
            if (player && player.skills && player.skills.indexOf(d.sk) >= 0) return 'learned';
            if (typeof skillReqLv === 'function' && skillReqLv(DB.skills[d.sk], d.sk) === undefined) return 'cant';
        } catch (e) {}
        return '';
    }

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
    function _lpHide() {
        try { if (_lpTip) _lpTip.style.display = 'none'; } catch (e) {}
        try { document.body.classList.remove('afk-wh-lp'); } catch (e) {}
    }

    function _lpInjectCSS() {
        if (!_isTouch || document.getElementById('afk-wh-lp-style')) return;
        var s = document.createElement('style'); s.id = 'afk-wh-lp-style';
        s.textContent = [
            // iOS Safari 長按可點元素會跳原生「拷貝/查詢」callout 蓋住自製資料框,關掉它與文字選取
            '#wh-inv-list [data-tip-uid],#wh-store-list [data-tip-uid]{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;}',
            // 本框顯示時蓋掉核心的 hover 提示框:Android Chrome 會在手指放開後補送假滑鼠事件,
            //   核心那顆(只綁 mousemove)照樣跳出來 → 同一件物品出現兩個一模一樣的框(玩家回報)。
            //   iOS 對 <button> 不補這組事件,核心那顆跳不出來,所以自製這顆仍要留著。
            //   ⚠ 必須 !important:核心是用 inline style 開關它,沒有 !important 蓋不過。
            'body.afk-wh-lp .game-tooltip{display:none !important;}'
        ].join('\n');
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
        try { document.body.classList.add('afk-wh-lp'); } catch (e) {}   // 同時蓋掉核心的 hover 提示框(見 _lpInjectCSS)
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
        // 戰鬥日誌自動捲到底也會打進這個 capture handler(每秒數次)→ 資料框沒開就早退,不做無條件 DOM 寫入
        document.addEventListener('scroll', function () {
            if (!_lpTip || _lpTip.style.display === 'none') return;
            _lpHide();
        }, { capture: true, passive: true });
    }

    // ── 「不可穿」列的樣式(核心兩欄只有物品全名,顏色只反映稀有度、跟能不能穿無關) ──
    function _wearCSS() {
        if (document.getElementById('afk-wh-wear-style')) return;
        var s = document.createElement('style'); s.id = 'afk-wh-wear-style';
        s.textContent = [
            // ⚠️ class 名刻意寫兩次(.afk-wh-noeq.afk-wh-noeq)不是筆誤,是拿掉「靠載入順序決勝」這個變數:
            //   1.8 皮膚在 css/style.css 有 `#interaction-content [class*="bg-slate-"]{background-color:#282730 !important}`,
            //   而倉庫每一列都帶 bg-slate-800 → 該選擇器是 1 id + 1 屬性,跟單寫一次 class 的
            //   `#wh-store-list .afk-wh-noeq` 權重完全相同。同權重時由「後載入者」勝,目前本外掛的 <style>
            //   是執行期才 append 到 head 尾端所以贏得了;但那是巧合,皮膚哪天改成執行期注入就會倒過來。
            //   重複 class 把權重墊高一級,先後順序就不影響結果。
            '#wh-inv-list .afk-wh-noeq.afk-wh-noeq,#wh-store-list .afk-wh-noeq.afk-wh-noeq{background:rgba(80,12,22,.55) !important;border-color:#9f1239 !important;border-left-width:4px !important;}',
            '#wh-inv-list .afk-wh-noeq.afk-wh-noeq:hover,#wh-store-list .afk-wh-noeq.afk-wh-noeq:hover{background:rgba(110,18,30,.7) !important;}',
            // 字樣與顏色跟背包那邊對齊(核心 js/10 是 text-red-500 font-bold 的 [無法裝備]);放在名稱底下,不跟取出/存入鈕搶寬度
            '#wh-inv-list .afk-wh-noeq .whx-name::after,#wh-store-list .afk-wh-noeq .whx-name::after{content:"[無法裝備]";display:block;font-size:12px;font-weight:bold;color:#ef4444;}',
            // 魔法書:無法學習＝同一套紅底(跟「無法裝備」是同一類「這隻用不了」,不該長得不一樣);
            //         已學習＝灰底壓暗(核心背包用 bg-slate-900 opacity-70,這裡用等效的底色,不動整列透明度以免圖示也一起糊掉)
            '#wh-inv-list .afk-wh-nolearn.afk-wh-nolearn,#wh-store-list .afk-wh-nolearn.afk-wh-nolearn{background:rgba(80,12,22,.55) !important;border-color:#9f1239 !important;border-left-width:4px !important;}',
            '#wh-inv-list .afk-wh-nolearn.afk-wh-nolearn:hover,#wh-store-list .afk-wh-nolearn.afk-wh-nolearn:hover{background:rgba(110,18,30,.7) !important;}',
            '#wh-inv-list .afk-wh-nolearn .whx-name::after,#wh-store-list .afk-wh-nolearn .whx-name::after{content:"[無法學習]";display:block;font-size:12px;font-weight:bold;color:#ef4444;}',
            '#wh-inv-list .afk-wh-learned.afk-wh-learned,#wh-store-list .afk-wh-learned.afk-wh-learned{background:rgba(15,23,42,.85) !important;border-color:#475569 !important;border-left-width:4px !important;}',
            '#wh-inv-list .afk-wh-learned.afk-wh-learned:hover,#wh-store-list .afk-wh-learned.afk-wh-learned:hover{background:rgba(30,41,59,.9) !important;}',
            '#wh-inv-list .afk-wh-learned .whx-name::after,#wh-store-list .afk-wh-learned .whx-name::after{content:"[已學會]";display:block;font-size:12px;font-weight:bold;color:#94a3b8;}'
        ].join('\n');
        (document.head || document.documentElement).appendChild(s);
    }
    // 逐列反查實例 → 標「本職業穿不了」與魔法書的「已學習／無法學習」
    function _markNoEquip() {
        var w = loadWarehouse();
        [['wh-inv-list', (player && player.inv) || []], ['wh-store-list', (w && w.items) || []]].forEach(function (pair) {
            var host = document.getElementById(pair[0]); if (!host) return;
            host.querySelectorAll('[data-tip-uid]').forEach(function (el) {
                var uidv = el.getAttribute('data-tip-uid');
                var it = pair[1].find(function (i) { return i && String(i.uid) === String(uidv); });
                if (!it) return;
                if (_cannotWear(it.id)) el.classList.add('afk-wh-noeq');
                var st = _bookState(it.id);
                if (st === 'cant') el.classList.add('afk-wh-nolearn');
                else if (st === 'learned') el.classList.add('afk-wh-learned');
            });
        });
    }
    // ── render 後處理:長按、無法裝備標記 ─────────────
    function afterRender() {
        try {
            bindLongPress(document.getElementById('wh-inv-list'));
            bindLongPress(document.getElementById('wh-store-list'));
        } catch (e) {}
        var inp = document.getElementById('wh-gold-amt');
        if (!inp) return;   // 倉庫面板不在畫面上
        try { _wearCSS(); _markNoEquip(); } catch (e) {}
    }
    var _render = window.renderWarehouseNPC;
    window.renderWarehouseNPC = function () {
        // 📌 捲動保底:手機 PWA 上核心的「innerHTML 重繪→立刻恢復 scrollTop」會偏移(iOS 在版面
        //   還沒重算時設 scrollTop 可能被舊高度鉗制/錨定,玩家回報捲下去後每存一次往上跳一格),
        //   且本外掛 afterRender 又在核心恢復之後才補注入金幣鈕。這裡在「重繪+補注入都完成」後
        //   再恢復一次,並用 rAF 於版面計算完成後補一發。
        var c0 = document.getElementById('warehouse-window-content');
        var s0 = c0 ? c0.scrollTop : 0;
        var r = _render.apply(this, arguments);
        try { afterRender(); } catch (e) {}
        try {
            var c1 = document.getElementById('warehouse-window-content');
            if (c1 && s0 > 0) { c1.scrollTop = s0; requestAnimationFrame(function () { c1.scrollTop = s0; }); }
        } catch (e) {}
        return r;
    };

    try { console.log('[AFK-warehouse] hooks OK — 倉庫擴充(長按看資料/無法裝備標記)已啟用。'); } catch (e) {}
})();
