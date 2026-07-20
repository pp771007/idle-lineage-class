/* ============================================================================
 * afk-touchtip.js — 手機長按看資料(技能/商店/製作/收集冊/背包)
 *
 * 為什麼:核心的資料提示框(.game-tooltip)是純 hover 型——js/14 在 document 上委派
 *   mousemove,靠 e.target.closest('.tip-host') 決定要顯示誰。手機沒有 hover:
 *     - Android Chrome 手指放開後會補送一組假滑鼠事件 → 那框「碰巧」會跳一下;
 *     - iOS Safari 對 <button> 不補這組事件 → 技能格之類根本看不到任何資料。
 *   更糟的是有些格子的 click 是「會產生後果」的(技能格直接 manualCast 把技能放出去、
 *   快速強化/廢品勾選模式下點整列就勾選),玩家想看資料就得先付出代價。
 *
 * 行為:在 document 上做一次長按委派(capture 階段 touchstart),按住 .tip-host 約 400ms 後
 *   **不自建資料框**,而是直接朝該元素派一個合成的 mousemove,讓核心自己算內容、自己定位
 *   .game-tooltip。好處:技能/實例物品/收集冊/製作/商店五種內容格式全部自動吃到(內容產生器
 *   buildSkillTipHTML / buildItemTipHTML 關在 js/14 的 IIFE 裡,外掛本來就拿不到),而且畫面上
 *   永遠只有核心那一顆框,天生不會有雙框(Android 補送的假事件只是再更新同一顆)。
 *   收起=朝 document.body 派一次 mousemove(目標不是 tip-host → 核心自己 hideTip)。
 *
 * 🚨 長按觸發後要攔掉隨後那次 click/mousedown/mouseup:否則長按技能格會把技能放出去、
 *   長按勾選列會誤勾;而核心的 `document mousedown → hideTip` 會在手指放開的瞬間
 *   把剛顯示的框收掉(Android 補送事件順序 mousemove→mousedown→…)。攔截用時戳窗,
 *   逾時自動失效,一般短點擊完全不受影響。
 *
 * 不含倉庫:#wh-inv-list / #wh-store-list 由 afk-warehouse.js 自己那套長按處理(它自建
 *   資料框、有自己的 click guard,已上線驗過)。兩套同時作用在同一格會互踩(它顯示自製框時
 *   會加 body.afk-wh-lp 把核心 .game-tooltip 用 !important 蓋掉),故本檔明確排除那兩個容器。
 *
 * 優雅降級:非觸控裝置直接不啟用;長按後核心沒把框叫出來就什麼都不做(也不攔 click),
 *   任何一步失敗都不影響遊戲原本操作。
 * ========================================================================== */
(function () {
    'use strict';

    // 先登錄再問開關:關掉時本檔提早 return,但面板仍列得出這一項(玩家才有辦法開回來)
    if (window.AFK_TOGGLES) {
        AFK_TOGGLES.register({
            id: 'touchtip', name: '手機長按看資料', group: '遊戲介面', def: true,
            desc: '手機上長按技能格/商店商品/製作成品/收集冊卡片/背包列,顯示原版的資料提示框(長按不會誤觸該格原本的動作)'
        });
        if (!AFK_TOGGLES.enabled('touchtip')) return;
    }

    var LP_MS = 400;              // 長按判定時間
    var LP_MOVE_TOL = 10;         // 位移超過此值視為捲動,取消長按
    var LP_GUARD_MS = 900;        // 長按觸發後在此時間內攔掉滑鼠事件(擋誤觸 + 擋核心 mousedown 把框收掉)
    var HOST_SEL = '.tip-host';
    var EXCLUDE_SEL = '#wh-inv-list,#wh-store-list';   // 倉庫兩清單由 afk-warehouse.js 自理(見檔頭)
    var TIP_SEL = '.game-tooltip';

    var isTouch = (function () {
        try {
            return ('ontouchstart' in window)
                || (window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
        } catch (e) { return false; }
    })();
    if (!isTouch) return;   // 桌機本來就有 hover,不需要也不該掛

    if (typeof window.MouseEvent !== 'function') {
        console.warn('[AFK-touchtip] 環境不支援合成 MouseEvent,長按看資料已停用。');
        return;
    }

    var timer = null, sx = 0, sy = 0, guardUntil = 0;

    function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }

    function fireMouseMove(target, x, y) {
        try {
            target.dispatchEvent(new MouseEvent('mousemove', {
                bubbles: true, cancelable: true, view: window, clientX: x, clientY: y
            }));
        } catch (e) {}
    }

    function tipVisible() {
        try {
            var el = document.querySelector(TIP_SEL);
            return !!(el && el.style.display !== 'none' && el.offsetWidth > 0);
        } catch (e) { return false; }
    }

    function hideTip() {
        if (!document.body) return;
        fireMouseMove(document.body, 0, 0);   // 目標不是 tip-host → 核心委派自己收框
    }

    function show(host, x, y) {
        timer = null;
        fireMouseMove(host, x, y);
        // 核心沒把框叫出來(資料查不到/條件不符)就當作沒發生:不攔 click,讓該格原本的操作照常
        if (tipVisible()) guardUntil = Date.now() + LP_GUARD_MS;
    }

    function injectCSS() {
        if (document.getElementById('afk-touchtip-style')) return;
        var s = document.createElement('style');
        s.id = 'afk-touchtip-style';
        // iOS Safari 長按會跳原生「拷貝/查詢」callout 蓋住資料框,並把圖示/文字選起來
        s.textContent = HOST_SEL + '{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;}';
        (document.head || document.documentElement).appendChild(s);
    }

    document.addEventListener('touchstart', function (e) {
        clearTimer();
        // 新的一次觸控開始 → 上一次長按的攔截窗結束。要攔的假滑鼠事件是長按放開後「馬上」補送的,
        //   中間不會夾新的 touchstart;不清掉的話長按看完資料後 0.9 秒內想點別的鈕會被整個吃掉。
        guardUntil = 0;
        if (tipVisible()) hideTip();   // 再按一下畫面任一處就收起
        var t = e.touches && e.touches[0];
        if (!t) return;
        var host = e.target && e.target.closest ? e.target.closest(HOST_SEL) : null;
        if (!host || host.closest(EXCLUDE_SEL)) return;
        sx = t.clientX; sy = t.clientY;
        timer = setTimeout(function () { show(host, sx, sy); }, LP_MS);
    }, { passive: true, capture: true });   // 不 preventDefault → 標 passive,不拖累捲動

    document.addEventListener('touchmove', function (e) {
        if (!timer) return;
        var t = e.touches && e.touches[0];
        if (!t) return;
        if (Math.abs(t.clientX - sx) > LP_MOVE_TOL || Math.abs(t.clientY - sy) > LP_MOVE_TOL) clearTimer();
    }, { passive: true, capture: true });

    document.addEventListener('touchend', clearTimer, { passive: true, capture: true });
    document.addEventListener('touchcancel', clearTimer, { passive: true, capture: true });
    // 捲動(清單自己捲、頁面捲)一律放棄長按並收框;scroll 不冒泡,要用 capture 才收得到
    document.addEventListener('scroll', function () { clearTimer(); if (tipVisible()) hideTip(); }, { passive: true, capture: true });

    // 🚨 長按已顯示資料 → 攔掉隨後那組滑鼠事件(見檔頭)。capture 階段掛在 document,
    //    才擋得住格子上 inline 的 onclick(事件根本到不了目標)。
    function guard(e) {
        if (!guardUntil) return;
        if (Date.now() > guardUntil) { guardUntil = 0; return; }
        if (e.type === 'click') guardUntil = 0;   // 一次點擊只擋一次,之後恢復正常
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    document.addEventListener('mousedown', guard, true);
    document.addEventListener('mouseup', guard, true);
    document.addEventListener('click', guard, true);

    injectCSS();
    console.log('[AFK-touchtip] hooks OK — 長按 .tip-host 顯示原版資料框(倉庫清單除外,由 afk-warehouse 自理)。');
})();
