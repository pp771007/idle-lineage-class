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

    // ── 對外介面（afk-offline 沿用 isMobile）──
    window.__afkm = { version: '2.0.0', isMobile: detectMobile };

    try { console.log('[AFK-mobile] hooks OK — 手機薄殼（橫幅讓位·版面用上游原版）。'); } catch (e) {}
})();
