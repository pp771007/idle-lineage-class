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

    // ⚠ 保留 #load-page-tabs「原本的絕對定位」(手機 top:524px 在卡片下方·桌機 top:56.9%)——只加寬容納 N 顆、
    //   把按鈕改 relative 讓 flex 橫排、抑制原本 ::after 數字改用 textContent(page3+ 沒 ::after)。
    //   之前誤把整個容器改 position:static → 它跑到流式頂端被絕對定位的卡片蓋住(分頁鈕看似不見·已修)。
    // 單列不換行:width:auto 在絕對定位下 shrink-to-fit,寬一被擠 wrap 就折兩列(手機 4 顆鈕踩過)→ max-content+nowrap 鎖一列。
    // 🚨 桌機/手機橫向的分頁鈕原本是「透明熱區」——數字 1 2 是**畫在背景圖上的美術**(css 把按鈕的
    //    color/background/border 全設透明)。背景圖只畫得出兩個圈,我們擴到 4 頁時第 3、4 顆就成了看不見
    //    的按鈕、位置也跟畫上的圈對不起來(玩家回報「切換按鈕跑掉了」)。只有手機直式因為另一條 media query
    //    會把文字塗成金色才看得見 → 一轉橫向就露餡。
    //    故這裡自己給可見樣式(不吃背景圖的圈),四頁以上才對得起來;.active 的光暈仍由核心規則負責(特異度較高)。
    var css = '#load-page-tabs{width:max-content !important;min-width:0 !important;height:auto !important;gap:8px !important;justify-content:center !important;padding:0 6px !important;flex-wrap:nowrap !important;}'
        + '#load-page-tabs button{position:relative !important;left:auto !important;right:auto !important;top:auto !important;bottom:auto !important;transform:none !important;min-width:34px;'
        + 'color:#e6d4a4;background:rgba(12,10,8,.82);border:1px solid rgba(180,139,65,.62);border-radius:50%;font-weight:700;font-family:Georgia,serif;text-shadow:0 1px 2px #000;}'
        // ⚠ 刻意不設 font-size:手機直式本來就正常(核心那條 media query 給 18px),我們這條排在後面,
        //   一寫死字級就會把「原本沒壞的手機」一起改小。只補「原本缺的可見性」,不動已經對的東西。
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

    // 遊戲中的「回選角」把頁碼算成 currentSlot > 4 ? 1 : 0（核心只有 2 頁）→ 第 9 格以後回來會停在第 2 頁。
    if (typeof window.returnToCharacterSelect === 'function') {
        var _ret = window.returnToCharacterSelect;
        window.returnToCharacterSelect = function () {
            var r = _ret.apply(this, arguments);
            try {
                var panel = document.getElementById('load-select-panel');
                if (panel && !panel.classList.contains('hidden')) {
                    _loadPage = Math.max(0, Math.min(maxPage - 1, Math.floor((currentSlot - 1) / 4)));
                    _loadSelectedSlot = currentSlot;
                    renderLoadSelect();
                }
            } catch (e) {}
            return r;
        };
    }

    try { console.log('[AFK-loadslots] hooks OK — 卡片選角分頁擴充到 ' + SAVE_SLOT_MAX + ' 格（' + maxPage + ' 頁）。'); } catch (e) {}
})();
