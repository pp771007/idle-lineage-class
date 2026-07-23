/**
 * afk-banner.js — 「非官方轉載橫幅」讓位（基礎設施層，無開關、不可被玩家關掉）
 *
 * 上游在非官方網域會蓋一條 position:fixed;top:0 的橫幅（js/00-data.js 的 _origEnforce，
 * z-index 是 int 上限 2147483647），但上游自己沒有讓開它 → 畫面頂端被蓋住。
 * 這支負責唯一一件事：量橫幅高度 → 設 --orig-bar-h / body.afk-bar → 把全螢幕容器往下讓開。
 *
 * 🚨 為什麼獨立成一支、且不掛 AFK_TOGGLES：
 *   讓位規則原本寫在 afk-mobile（手機版面）裡，而那支玩家可以關掉——平板玩家為了換回三欄
 *   版面把它一關，讓位就整組消失，「冒險地圖」標題、黑市/瞬移/出發、右欄分頁全被橫幅蓋住
 *   （2026-07-23 玩家回報）。橫幅是「所有裝置、所有外掛狀態下都存在」的東西，讓位就必須跟它同級。
 *   同理，其他外掛要讓開橫幅時可以放心讀 --orig-bar-h / AFK_BANNER（本支不可停用），
 *   但不可以反過來依賴 afk-mobile 之類可停用的外掛。
 *
 * 只做位移／封頂（top / height / padding / max-height），不碰任何內部排版。
 * 官方網域沒有橫幅 → 量到 0px、不掛 body.afk-bar → 所有規則等同不存在。
 */
(function () {
    'use strict';

    // 上游全螢幕彈窗/浮動窗清單：afk-mobile 的手機規則也吃這兩份（經 AFK_BANNER 取得，單一來源）。
    var MODAL_HOSTS = '#autosell-rule-modal, #autosell-preview-modal, #poly-modal, #osiris-box-modal, #summon-select-overlay, #pet-evo-overlay, #pet-gear-overlay, #card-book, #equip-book, #misc-book, #relic-book, #collection-panel, #offline-reward-modal';
    var MODAL_BOXES = '#autosell-rule-modal .as-box, #autosell-preview-modal > div, #poly-modal > div, #osiris-box-modal > div, #summon-select-overlay > div, #pet-evo-overlay > div, #pet-gear-overlay > div, #card-book > div, #equip-book > div, #misc-book > div, #relic-book > div, #collection-panel > div, #offline-reward-modal > div';

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
    function ensureStyle() {
        if (_styleInjected) return; _styleInjected = true;
        var st = document.createElement('style');
        st.id = 'afk-banner-offset';
        st.textContent =
            // 讓開橫幅：#app-stage 與 #creation-screen(登入/創角/選角)都是 position:fixed;top:0(相對視窗定位)，
            //   各自往下讓開橫幅高度、縮短同樣的高度。只動 top/height、不碰 display → 不影響 .hidden 隱藏。
            '#app-stage, #creation-screen{ top: var(--orig-bar-h, 0px) !important; height: calc(100% - var(--orig-bar-h, 0px)) !important; }\n'
            // #game-screen 只有在上游「手機幾何」裡才是 position:fixed(相對視窗)，需要自己讓位；
            //   桌機/平板幾何它是 position:absolute;inset:0 關在已經讓開的 #app-stage 裡——再讓一次＝頂端白白多空一條
            //   (實測平板 1180x820 多吃 53px,可用高度少兩倍橫幅)。故這條只掛在與上游同一條手機 media query 裡。
            + '@media (max-width: 768px), (max-height: 520px) and (pointer: coarse){\n'
            + '  #game-screen{ top: var(--orig-bar-h, 0px) !important; height: calc(100% - var(--orig-bar-h, 0px)) !important; }\n'
            + '}\n'
            // 只有首頁(#main-menu 在 #creation-screen 內)需要整頁縱向捲動(內容比縮短後的高度高)；
            //   #game-screen 不加 overflow → 避免它與背包內層 viewport 形成巢狀捲動，害武器等小溢出分頁的觸控被外層吃掉。
            + '#creation-screen{ overflow-y: auto !important; }\n'
            // 桌機/平板幾何(寬 ≥769 且高 ≥521)的彈窗讓位：這個尺寸帶的置中彈窗在「視窗矮、彈窗高」時
            //   上緣會鑽進橫幅底下(實測 1024x768 的怪物圖鑑、1024x700 的自動賣出規則)。手機幾何(≤768)由 afk-mobile 負責。
            //   body.afk-bar＝量到橫幅才掛(見 applyBarH)：官方站無橫幅時這組規則整個不存在，不動任何既有版面。
            + '@media (min-width: 769px) and (min-height: 521px){\n'
            + '  body.afk-bar :is(' + MODAL_HOSTS + '){ padding-top: var(--orig-bar-h, 0px) !important; }\n'
            + '  body.afk-bar :is(' + MODAL_BOXES + '){ max-height: calc(100dvh - var(--orig-bar-h, 0px) - 16px) !important; }\n'
            //   transform 置中的城鎮 NPC 窗吃不到 padding → 改推中心點並封頂高度。
            + '  body.afk-bar #town-interaction-container:not(.hidden){ top: calc(50% + var(--orig-bar-h, 0px) / 2) !important; max-height: calc(92vh - var(--orig-bar-h, 0px)) !important; }\n'
            + '  body.afk-bar #equipment-window:not(.equipment-window-embedded) .equipment-window-frame{ top: calc(50% + var(--orig-bar-h, 0px) / 2) !important; max-height: calc(100dvh - 16px - var(--orig-bar-h, 0px)) !important; }\n'
            + '}\n';
        (document.head || document.documentElement).appendChild(st);
    }

    var _barRO = null, _barEl = null;
    function applyBarH() {
        var h = _barEl ? Math.ceil(_barEl.getBoundingClientRect().height) : 0;
        if (h > 0) h += 6;   // 安全邊距：橫幅換行/字重/邊距量測誤差，多讓一點確保完全不被蓋
        document.documentElement.style.setProperty('--orig-bar-h', h + 'px');
        // 有橫幅才掛：讓位規則全掛在 body.afk-bar 之下，官方站(無橫幅)整組不生效。
        if (document.body) document.body.classList.toggle('afk-bar', h > 0);
    }
    function measureBar() {
        var bar = findBanner();
        if (bar !== _barEl) {
            _barEl = bar;
            if (_barRO) { try { _barRO.disconnect(); } catch (e) {} _barRO = null; }
            // 橫幅高度會隨寬度換行變 → 用 ResizeObserver 跟著它變，量測永遠準
            if (bar && typeof ResizeObserver === 'function') {
                try { _barRO = new ResizeObserver(applyBarH); _barRO.observe(bar); } catch (e) {}
            }
        }
        applyBarH();
    }

    window.AFK_BANNER = {
        el: function () { return _barEl; },
        // 橫幅底端 y 座標(含安全邊距)；無橫幅回 0。要「自己算讓位」的外掛用這個，不必各自掃 DOM。
        bottom: function () {
            var h = 0;
            try { h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--orig-bar-h')) || 0; } catch (e) {}
            return h;
        },
        remeasure: measureBar,
        MODAL_HOSTS: MODAL_HOSTS,
        MODAL_BOXES: MODAL_BOXES
    };

    function run() {
        ensureStyle();
        measureBar();
        console.log('[AFK-banner] hooks OK — 橫幅讓位已就緒（' + (_barEl ? '偵測到橫幅' : '無橫幅') + '）。');
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();

    // 橫幅可能晚出現（gameLoop 會重掛）、換行高度隨寬度變 → 量測數次 + resize 時重量。
    window.addEventListener('resize', measureBar);
    var _n = 0, _iv = setInterval(function () { measureBar(); if (++_n >= 12) clearInterval(_iv); }, 1000);
})();
