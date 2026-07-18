/**
 * afk-mobile.js — 手機薄殼（2026-07 重寫）
 *
 * 背景：上游 v3.5 手機版面已改成「流動式」——#app-stage 由 CSS position:fixed;inset:0 填滿視窗、
 *   內層三欄 flex 隨視窗自然縮成單欄。手機版面「內部」直接用上游原版，不再覆寫（舊版整包覆寫會與
 *   上游新 app-stage 打架、把版面弄爛）。
 *
 * 這支只做兩件「外殼」層的事，不動版面結構：
 *   1. 讓空間給「非官方轉載橫幅」：上游橫幅是 position:fixed;top:0，但上游本身沒讓開 → 內容被蓋住
 *      （桌機/手機皆是；官方網域無橫幅則不影響）。量測橫幅高度寫進 --orig-bar-h，把 #app-stage 頂部
 *      讓開該高度。純位移、不碰內部排版。
 *   2. 提供 window.__afkm.isMobile（afk-offline 等沿用）。
 */
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('mobile')) return;   // 🎚️ 外掛開關

    function detectMobile() {
        try {
            return (matchMedia && matchMedia('(pointer:coarse)').matches) ||
                /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ||
                (window.innerWidth || 9999) <= 820;
        } catch (e) { return false; }
    }

    // ── 讓空間給橫幅 ──────────────────────────────────────────
    // 橫幅特徵：position:fixed、top:0、z-index 極大、內含官方站字樣。官方網域無此元素→高度 0。
    function findBanner() {
        var els = document.body ? document.body.children : [];
        for (var i = 0; i < els.length; i++) {
            var e = els[i], s;
            if (!e || e.tagName !== 'DIV') continue;
            try { s = getComputedStyle(e); } catch (_) { continue; }
            if (s.position === 'fixed' && s.top === '0px' && parseInt(s.zIndex || '0', 10) > 1000000) {
                if (/shines871|官方|非官方|轉載/.test(e.textContent || '')) return e;
            }
        }
        return null;
    }

    var _styleInjected = false;
    function ensureOffsetStyle() {
        if (_styleInjected) return; _styleInjected = true;
        var st = document.createElement('style');
        st.id = 'afk-mobile-bar-offset';
        // 只位移舞台頂部、縮短其高度讓開橫幅；--orig-bar-h 為 0（官方網域/無橫幅）時等同不動。
        st.textContent =
            '#app-stage{ top: var(--orig-bar-h, 0px) !important; height: calc(100% - var(--orig-bar-h, 0px)) !important; }';
        (document.head || document.documentElement).appendChild(st);
    }

    function measureBar() {
        var bar = findBanner();
        var h = bar ? Math.ceil(bar.getBoundingClientRect().height) : 0;
        document.documentElement.style.setProperty('--orig-bar-h', h + 'px');
    }

    // body.m-mobile：只是「現在是手機」的標記（afk-toast/mobname/diag/skin/training/dograce 靠它做各自的
    //   手機 QoL，如 toast 只手機顯示、怪名換行）。本外掛只設這個 class，不再掛任何版面覆寫 CSS。
    function syncMobileClass() {
        if (!document.body) return;
        document.body.classList.toggle('m-mobile', detectMobile());
    }

    function run() {
        syncMobileClass();
        ensureOffsetStyle();
        measureBar();
    }

    // 橫幅可能晚出現（gameLoop 會重掛）、換行高度隨寬度變 → 量測數次 + resize 時重量。
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
    window.addEventListener('resize', function () { syncMobileClass(); measureBar(); });
    var _n = 0, _iv = setInterval(function () { measureBar(); if (++_n >= 12) clearInterval(_iv); }, 1000);

    // ── 底部導覽列（手機外殼）──────────────────────────────────
    // 上游手機版面把三欄（#col-left 狀態/隊伍/技能、#col-center 戰鬥/地圖/日誌、#col-right 背包分頁）
    //   直向堆疊成長捲軸。這裡加一條底部導覽，一次只顯示一欄（HP/MP 由上游 #mobile-vitals 頂條常駐）。
    //   純「顯示/隱藏整欄 + 該欄補滿寬」，不動欄「內部」排版 → 與上游版面相容。
    var VIEWS = [
        { id: 'center', label: '⚔️ 戰鬥' },
        { id: 'left', label: '👥 隊伍' },
        { id: 'right', label: '🎒 背包' }
    ];
    var _navStyled = false;
    function ensureNavStyle() {
        if (_navStyled) return; _navStyled = true;
        var css = [
            'body:not(.m-mobile) #m-nav{display:none !important;}',
            'body.m-mobile #m-nav{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:9000;background:#0f172a;border-top:1px solid #334155;padding-bottom:env(safe-area-inset-bottom,0px);}',
            'body.m-mobile #m-nav .m-nav-btn{flex:1;background:transparent;border:none;color:#94a3b8;font-size:13px;font-weight:600;padding:10px 4px;cursor:pointer;}',
            'body.m-mobile #m-nav .m-nav-btn.on{color:#38bdf8;background:rgba(56,189,248,.08);}',
            // 一次只顯示一欄，且補滿寬（覆寫上游 col 的固定寬）
            'body.m-mobile #col-left,body.m-mobile #col-center,body.m-mobile #col-right{display:none !important;width:100% !important;max-width:none !important;}',
            'body.m-mobile.mview-left #col-left{display:flex !important;}',
            'body.m-mobile.mview-center #col-center{display:flex !important;}',
            'body.m-mobile.mview-right #col-right{display:flex !important;}',
            // 內容讓開底部導覽列高度
            'body.m-mobile #game-screen{padding-bottom:60px !important;}'
        ].join('\n');
        var st = document.createElement('style'); st.id = 'afk-mobile-nav-style'; st.textContent = css;
        (document.head || document.documentElement).appendChild(st);
    }
    function setView(id) {
        document.body.classList.remove('mview-left', 'mview-center', 'mview-right');
        document.body.classList.add('mview-' + id);
        var nav = document.getElementById('m-nav');
        if (nav) { var btns = nav.querySelectorAll('.m-nav-btn'); for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', btns[i].getAttribute('data-view') === id); }
    }
    function currentView() { var b = document.body.className; var m = b.match(/mview-(left|center|right)/); return m ? m[1] : null; }
    function buildNav() {
        if (!detectMobile()) return;
        var gs = document.getElementById('game-screen');
        if (!gs || gs.classList.contains('hidden')) return;   // 只在遊戲畫面建
        ensureNavStyle();
        if (!document.getElementById('m-nav')) {
            var nav = document.createElement('div'); nav.id = 'm-nav';
            VIEWS.forEach(function (v) {
                var btn = document.createElement('button');
                btn.className = 'm-nav-btn'; btn.type = 'button';
                btn.setAttribute('data-view', v.id); btn.textContent = v.label;
                btn.addEventListener('click', function () { setView(v.id); });
                nav.appendChild(btn);
            });
            document.body.appendChild(nav);
        }
        if (!currentView()) setView('center');   // 預設戰鬥
    }
    // 進遊戲才建/離開遊戲移除；用 class 變動 observer + 兜底輪詢
    function navTick() {
        var gs = document.getElementById('game-screen');
        var inGame = detectMobile() && gs && !gs.classList.contains('hidden');
        if (inGame) buildNav();
        else { var nav = document.getElementById('m-nav'); if (nav) nav.remove(); document.body.classList.remove('mview-left', 'mview-center', 'mview-right'); }
    }
    setInterval(navTick, 1500);
    navTick();

    // ── 對外介面（afk-offline 沿用 isMobile）──
    window.__afkm = { version: '2.0.0', isMobile: detectMobile, setView: setView };

    try { console.log('[AFK-mobile] hooks OK — 手機薄殼（橫幅讓位·版面用上游原版）。'); } catch (e) {}
})();
