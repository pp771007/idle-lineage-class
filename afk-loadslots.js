/**
 * afk-loadslots.js — 卡片式選角分頁擴充到 16 格
 *
 * 上游新版「卡片式」選角(openLoadSelect/renderLoadSelect)寫死 2 頁×4=8 格(#load-page-1/2)。
 *   我方存檔位是 16 格(SAVE_SLOT_MAX，由 apply-core-patches 補進核心)，第 9~16 格用這畫面選不到。
 * 這支把分頁擴充到 ceil(SAVE_SLOT_MAX/4) 頁：
 *   - CSS 把 #load-page-tabs 從「2 顆絕對定位鈕」改成「flex 橫排 N 顆數字鈕」(取消原本 ::after 數字)。
 *   - wrap renderLoadSelect：每次重繪後確保 N 顆分頁鈕都在、標好數字與 active。
 *   - override loadSetPage：支援 1~N 頁(原本只認 page===2)；換頁時挑該頁第一個有角色的槽為選中。
 * 核心的 _loadPage / _loadSelectedSlot 是 js/13 頂層 let(非 module 腳本＝全域詞法綁定，外掛可 bareword 讀寫)。
 * 8 格以內(未套 16 格補丁)自動不啟用＝完全回上游原生。
 */
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('loadslots')) return;   // 🎚️ 外掛開關
    if (typeof renderLoadSelect !== 'function' || typeof loadSetPage !== 'function' || typeof SAVE_SLOT_MAX === 'undefined') {
        try { console.warn('[AFK-loadslots] 缺 renderLoadSelect/loadSetPage/SAVE_SLOT_MAX，分頁擴充停用。'); } catch (e) {}
        return;
    }
    if (SAVE_SLOT_MAX <= 8) return;   // 上游原生 2 頁就夠，不動

    var maxPage = Math.ceil(SAVE_SLOT_MAX / 4);

    // 分頁列改 flex 橫排、取消原本 2-tab 絕對定位與 ::after 數字
    var css = '#load-page-tabs{display:flex !important;gap:10px !important;justify-content:center !important;position:static !important;width:auto !important;flex-wrap:wrap !important;height:auto !important;margin:6px auto !important;}'
        + '#load-page-tabs button{position:static !important;left:auto !important;right:auto !important;top:auto !important;bottom:auto !important;min-width:34px;transform:none !important;}'
        + '#load-page-tabs button::after{content:none !important;}';
    var st = document.createElement('style'); st.id = 'afk-loadslots-css'; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);

    // 每次重繪後確保 N 顆分頁鈕都在（數字、onclick、active）
    function ensureTabs() {
        var tabs = document.getElementById('load-page-tabs'); if (!tabs) return;
        var cur = (typeof _loadPage !== 'undefined') ? _loadPage : 0;
        for (var pg = 1; pg <= maxPage; pg++) {
            var t = document.getElementById('load-page-' + pg);
            if (!t) {
                t = document.createElement('button');
                t.type = 'button'; t.id = 'load-page-' + pg;
                t.setAttribute('onclick', 'loadSetPage(' + pg + ')');
                t.setAttribute('aria-label', '存檔 ' + ((pg - 1) * 4 + 1) + ' 到 ' + (pg * 4));
                tabs.appendChild(t);
            }
            t.textContent = String(pg);
            t.classList.toggle('active', cur === (pg - 1));
        }
    }

    var _render = window.renderLoadSelect;
    window.renderLoadSelect = function () { _render.apply(this, arguments); try { ensureTabs(); } catch (e) {} };

    // 支援 1~N 頁（原本 _loadPage = page===2 ? 1 : 0 只認 2 頁）
    window.loadSetPage = function (page) {
        try {
            _loadPage = Math.max(0, Math.min(maxPage - 1, (page || 1) - 1));
            var start = _loadPage * 4 + 1, sel = null;
            for (var n = start; n <= start + 3; n++) { if (typeof slotSummary === 'function' && slotSummary(n)) { sel = n; break; } }
            _loadSelectedSlot = sel || start;
        } catch (e) {}
        renderLoadSelect();
    };

    try { console.log('[AFK-loadslots] hooks OK — 卡片選角分頁擴充到 ' + SAVE_SLOT_MAX + ' 格（' + maxPage + ' 頁）。'); } catch (e) {}
})();
