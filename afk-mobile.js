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

    // 上游全螢幕彈窗/浮動窗的「安全區」讓位：頂端讓開橫幅(--orig-bar-h)、底部讓開底部導覽(--m-nav-h)。
    //   兩個變數都由本外掛量測寫入(無橫幅/無導覽時為 0px → 規則等同不動)，公式一律：
    //   可用高度 = 100dvh - var(--orig-bar-h) - var(--m-nav-h)。新的被蓋案例優先併進下面 ①~④ 的清單，別另立公式。
    // 上游手機版把彈窗分兩型(css/style.css 手機 media query)：
    //   A. 頂端錨定 top:8px + height:calc(100dvh-16px) 的浮動窗(倉庫/道具詳情/城鎮互動)
    //   B. flex 置中容器 + 內卡 max-height:calc(100dvh-16px)(自動賣出/各圖鑑/收藏/潘朵拉寶箱…)
    //   兩型的 100dvh 都不知道橫幅與導覽 → A 型改 top/height，B 型改容器 padding + 內卡 max-height。
    //   ⚠ B 型光改容器 padding 不夠：內卡比 padding 後的剩餘空間高時，flex 置中會「上下均分溢出」，
    //     頂端照樣鑽進橫幅底下(自動賣出規則的標題/Close 被蓋就是這樣來的)——必須同時壓內卡 max-height。
    var MODAL_HOSTS = '#autosell-rule-modal, #autosell-preview-modal, #poly-modal, #osiris-box-modal, #summon-select-overlay, #pet-evo-overlay, #pet-gear-overlay, #card-book, #equip-book, #misc-book, #relic-book, #collection-panel, #offline-reward-modal';
    var MODAL_BOXES = '#autosell-rule-modal .as-box, #autosell-preview-modal > div, #poly-modal > div, #osiris-box-modal > div, #summon-select-overlay > div, #pet-evo-overlay > div, #pet-gear-overlay > div, #card-book > div, #equip-book > div, #misc-book > div, #relic-book > div, #collection-panel > div, #offline-reward-modal > div';
    var _styleInjected = false;
    function ensureOffsetStyle() {
        if (_styleInjected) return; _styleInjected = true;
        var st = document.createElement('style');
        st.id = 'afk-mobile-bar-offset';
        // 只位移舞台頂部、縮短其高度讓開橫幅；--orig-bar-h 為 0（官方網域/無橫幅）時等同不動。
        st.textContent =
            // 讓開橫幅：#creation-screen(登入/創角/選角)與 #game-screen 本身就是 position:fixed;top:0(相對視窗定位)，
            //   所以位移父層 #app-stage 對它們無效——必須直接位移這兩個全螢幕容器。頂部下移橫幅高度、縮短高度。
            //   只動 top/height、不碰 display → 不影響 .hidden 隱藏。
            '#app-stage, #creation-screen, #game-screen{ top: var(--orig-bar-h, 0px) !important; height: calc(100% - var(--orig-bar-h, 0px)) !important; }\n'
            // 只有首頁(#main-menu 在 #creation-screen 內)需要整頁縱向捲動(內容比縮短後的高度高)；
            //   #game-screen 不加 overflow → 避免它與背包內層 viewport 形成巢狀捲動，害武器等小溢出分頁的觸控被外層吃掉。
            + '#creation-screen{ overflow-y: auto !important; }\n'
            // 🆕 卡片式選角面板 #load-select-panel(手機)本身 position:absolute;inset:0;overflow:auto;min-height:100dvh，
            //   但它在被橫幅讓位縮短的 #creation-screen 內 → min-height:100dvh 比容器高 → creation-screen 也被迫捲，
            //   兩層巢狀捲動打架＝滾一下就卡住(使用者回報)。把它的 min-height 改成剛好=讓位後可視高度 → 只剩它單層捲。
            + 'body.m-mobile #load-select-panel:not(.hidden){ min-height: calc(100dvh - var(--orig-bar-h, 0px)) !important; overscroll-behavior: contain !important; }\n'
            // 選角面板顯示時，讓外層 #creation-screen 完全不捲(它自己會捲)→ 只剩 panel 單層捲，不再兩層打架卡住。
            + 'body.m-mobile #creation-screen:has(#load-select-panel:not(.hidden)){ overflow: hidden !important; }\n'
            //   ① 置中類 Tailwind modal(.fixed.inset-0·flex 置中)：padding 把置中內容夾進安全區(遊戲畫面容器用 id 非這組 class，不受影響)。
            + 'body.m-mobile .fixed.inset-0{ padding-top: var(--orig-bar-h, 0px); padding-bottom: var(--m-nav-h, 0px); }\n'
            //   ② A 型·頂端錨定的浮動窗(倉庫/道具詳情/黑市·NPC)：核心手機把它們釘 top:8px + 100dvh 高、無視橫幅與導覽
            //      (這幾個 z-index 都低於 #m-nav → 底段整條被導覽蓋住、內層捲到底也看不到)。
            //      ⚠ 核心是 #id !important 規則，:is(.class) 特異度壓不過(倉庫踩過)，必須用「實際 id」選擇器才蓋得掉。
            //      🚨 必須跟上游「手機幾何」同一條 media query：這三個窗的 top:8px/transform:none 是上游寫在
            //      (max-width:768px),(max-height:520px) and (pointer:coarse) 裡的。而本檔的 detectMobile() 只要
            //      pointer:coarse 就算手機 → 平板(寬 > 768 的觸控裝置)會拿到「我們的 top:8px」卻沒有上游的
            //      transform:none，殘留的 translate(-50%,-50%) 把整個視窗往上推半個身高(實測 top 到 -211~-489，
            //      上半截整個跑出畫面)。加上這層 media query，寬螢幕就乖乖走下面的桌機幾何。
            + '@media (max-width: 768px), (max-height: 520px) and (pointer: coarse){\n'
            + '  body.m-mobile #warehouse-window-frame, body.m-mobile #item-modal:not(.hidden), body.m-mobile #town-interaction-container:not(.hidden){ top: calc(8px + var(--orig-bar-h, 0px)) !important; height: calc(100dvh - 16px - var(--orig-bar-h, 0px) - var(--m-nav-h, 0px)) !important; }\n'
            + '}\n'
            //   ③ B 型·置中彈窗容器(含內聯 position:fixed 與 .fixed.inset-0 兩種都有的)：padding 夾安全區 + 內卡壓 max-height。
            + 'body.m-mobile :is(' + MODAL_HOSTS + '){ padding-top: calc(var(--orig-bar-h, 0px) + 8px) !important; padding-bottom: calc(var(--m-nav-h, 0px) + 8px) !important; }\n'
            + 'body.m-mobile :is(' + MODAL_BOXES + '){ max-height: calc(100dvh - var(--orig-bar-h, 0px) - var(--m-nav-h, 0px) - 16px) !important; }\n'
            //   ④ transform 置中的裝備視窗「獨立模式」：中心對齊安全區中線、封頂高度。
            //      ⚠ 必須排除嵌入模式(.equipment-window-embedded·js/19 init 就掛上、現行永遠嵌入)：嵌入時 frame 由 JS 內聯
            //        top:0 對齊 host，這裡的 top !important 會壓過內聯值把 12 格整個往下推出安全區(踩過)。
            + 'body.m-mobile #equipment-window:not(.equipment-window-embedded) .equipment-window-frame{ top: calc(50% + var(--orig-bar-h, 0px) / 2 - var(--m-nav-h, 0px) / 2) !important; max-height: calc(100dvh - 16px - var(--orig-bar-h, 0px) - var(--m-nav-h, 0px)) !important; }\n'
            //   ④' 桌機幾何下的彈窗讓位：③④ 只掛 body.m-mobile，桌機/平板只有主舞台讓開 → 置中的彈窗在
            //      「視窗矮、彈窗高」時上緣會鑽進橫幅底下(實測 1024x768 的怪物圖鑑、1024x700 的自動賣出規則)。
            //      整段包在「上游手機幾何以外」的尺寸(寬 ≥769 且高 ≥521)，避免與 ② 的手機幾何互相打架。
            //      body.afk-bar＝量到橫幅才掛(見 applyBarH)：官方站無橫幅時這組規則整個不存在，不動任何既有版面。
            + '@media (min-width: 769px) and (min-height: 521px){\n'
            + '  body.afk-bar:not(.m-mobile) :is(' + MODAL_HOSTS + '){ padding-top: var(--orig-bar-h, 0px) !important; }\n'
            + '  body.afk-bar:not(.m-mobile) :is(' + MODAL_BOXES + '){ max-height: calc(100dvh - var(--orig-bar-h, 0px) - 16px) !important; }\n'
            //      transform 置中的城鎮 NPC 窗吃不到 padding → 改推中心點並封頂高度。這條連「被判成手機的平板」
            //      也要套(它在這個尺寸帶走的就是桌機幾何)，故不加 :not(.m-mobile)。
            + '  body.afk-bar #town-interaction-container:not(.hidden){ top: calc(50% + var(--orig-bar-h, 0px) / 2) !important; max-height: calc(92vh - var(--orig-bar-h, 0px)) !important; }\n'
            + '  body.afk-bar:not(.m-mobile) #equipment-window:not(.equipment-window-embedded) .equipment-window-frame{ top: calc(50% + var(--orig-bar-h, 0px) / 2) !important; max-height: calc(100dvh - 16px - var(--orig-bar-h, 0px)) !important; }\n'
            + '}\n'
            //   ⑤ 右欄分頁(統計/道具/收藏…)：核心手機把 #tab-content-panel 設固定高+內層 overflow-auto，與外層 #game-screen 捲動疊成「雙捲軸」。
            //      讓分頁內容順流展開→只由 #game-screen 單層捲動(與 左/中 欄一致)；黏頂的 #mobile-vitals/分頁列照舊固定。
            //      ⚠ 必須排除 .equipment-panel-host：「裝備」分頁是核心的「嵌入式裝備視窗」(js/19)——#equipment-window 以
            //        position:fixed 蓋在 #tab-content-panel 的視窗座標上，依賴 host 有明確高度(--equipment-panel-height)。
            //        這條 auto 高度與那條同特異度、本檔較晚載入會蓋掉它 → host 塌掉、12 格裝備框整個錯位(踩過)。
            + 'body.m-mobile #tab-content-panel:not(.equipment-panel-host){ height: auto !important; min-height: 0 !important; overflow: visible !important; }\n'
            + 'body.m-mobile #tab-content-panel:not(.equipment-panel-host) > .ability-window-tab, body.m-mobile #tab-content-panel:not(.equipment-panel-host) > [id^="tab-"]{ height: auto !important; overflow: visible !important; }\n'
            //      ⚠ 背包條列式(afk-invlist)把 .classic-inventory-viewport 設成自己的捲動容器(overflow:auto+overscroll contain),
            //        分頁流式化後它 height 撐開、沒東西可捲 → 手勢在它身上被 contain 擋死、不鏈給 #game-screen=整頁滑不動。
            //        手機流式下退回普通元素,由 #game-screen 單層捲動(桌機不受影響,invlist 原規則照舊)。
            + 'body.m-mobile #tab-content-panel:not(.equipment-panel-host) .classic-inventory-shell{ height: auto !important; }\n'
            + 'body.m-mobile #tab-content-panel:not(.equipment-panel-host) .classic-inventory-viewport{ height: auto !important; overflow: visible !important; overscroll-behavior: auto !important; touch-action: auto !important; }\n'
            //   ⑥ 內層捲動區的 iOS 觸控三件套：溢出量小時沒有這組會「滑不動」(觸控被外層吃掉·afk-invlist 踩過同一雷)；
            //      overscroll-behavior:contain 同時擋「捲到底把後面的遊戲畫面一起帶著捲」的連鎖(雙層捲軸打架)。
            + 'body.m-mobile :is(.classic-skill-grid-scroll, #warehouse-window-content, #interaction-content, .as-box, #combat-log, #sys-log, #card-book-body, #equip-book-body, #misc-book-body, #relic-book-body, #modal-compare, #item-modal > div:not(#modal-compare)){ -webkit-overflow-scrolling: touch; touch-action: pan-y pinch-zoom; overscroll-behavior: contain; }\n'
            //      ⚠ 一定要帶 pinch-zoom:只寫 pan-y 會連「兩指捏合縮放」一起關掉(捏合被算在 touch-action 的許可清單裡),
            //        玩家在倉庫/裝備比對裡放大不了(回報過)。要擋的只是單指原生捲動打架,不是縮放。
            //   ⑥b 道具視窗說明文字:卡片是 .panel(flex 直欄),上游手機 CSS 給 #modal-item-desc 設 min-height:0
            //      = 允許縮到比內容矮 → 文字被壓扁溢出畫在按鈕底下(裝備比對開啟時最明顯)。鎖 flex-shrink,
            //      內容撐開改由外層卡片(上游 overflow-y:auto)捲動。寫這裡不動上游 css,同步原版也不會丟。
            + 'body.m-mobile #modal-item-desc{ flex: 0 0 auto !important; }\n'
            //   ⑦ 嵌入式裝備視窗:body 層級 fixed 圖層,原生捲動鏈走 DOM 祖先碰不到 #game-screen(手指拖 12 格區=划不動)。
            //      touch-action:none 關掉原生捲動(免 iOS 對 body 橡皮筋),垂直拖曳由 bindEquipTouchScroll 轉發給 #game-screen。
            + 'body.m-mobile #equipment-window.equipment-window-embedded:not(.hidden){ touch-action: pinch-zoom; }\n'
            //   ⑦b 上游 floating-ui.css 給裝備框/倉庫框寫死 touch-action:none(桌機用來讓滑鼠拖曳視窗不被瀏覽器搶手勢)。
            //      祖先只要有一層不允許捏合,整個子樹就縮放不了 → 手機在倉庫裡怎麼捏都沒反應。改成 pinch-zoom:
            //      單指原生捲動照舊關著(拖曳視窗邏輯不受影響),只把兩指縮放放行。
            + 'body.m-mobile :is(.equipment-window-frame, .warehouse-window-frame){ touch-action: pinch-zoom !important; }\n'
            // 登入頁：上游用「絕對定位藝術舞台」——#main-menu(top:31%) 與 #login-meta-layer(版權·pin bottom:4%) 各自絕對定位。
            //   我方往 #main-menu 注入了掉落查詢/小百科/外掛框後它變很高 → 蓋到底部版權層(文字重疊·使用者回報)。
            //   手機改成「流式堆疊」(DOM 序 title→menu→meta 自然由上而下排)，不再重疊；藝術背景圖 absolute inset:0 照樣鋪滿。
            + 'body.m-mobile #login-art-stage{ height:auto !important; min-height:100dvh; aspect-ratio:auto !important; display:flex !important; flex-direction:column !important; justify-content:flex-start !important; }\n'
            + 'body.m-mobile #login-title-layer, body.m-mobile #main-menu, body.m-mobile #login-meta-layer{ position:static !important; left:auto !important; right:auto !important; top:auto !important; bottom:auto !important; width:auto !important; transform:none !important; }\n'
            + 'body.m-mobile #login-title-layer{ margin-top:14px; }\n'
            + 'body.m-mobile #login-meta-layer{ margin:10px auto 18px !important; text-align:center; }\n'
            // 選角畫面（上游新版）：每列＝存檔鈕 + 固定寬匯入區，手機會把鈕擠成「存...」。改成直向堆疊：鈕全寬、匯入區在下。
            + 'body.m-mobile #slot-list > div{ flex-wrap:wrap !important; }\n'
            + 'body.m-mobile #slot-list > div > button:first-child{ flex:1 1 100% !important; }\n'
            + 'body.m-mobile #slot-list > div > .w-56{ width:100% !important; }';
        (document.head || document.documentElement).appendChild(st);
    }

    var _barRO = null, _barEl = null;
    function applyBarH() {
        var h = _barEl ? Math.ceil(_barEl.getBoundingClientRect().height) : 0;
        if (h > 0) h += 6;   // 安全邊距：橫幅換行/字重/邊距量測誤差，多讓一點確保完全不被蓋
        document.documentElement.style.setProperty('--orig-bar-h', h + 'px');
        // 有橫幅才掛：非手機的彈窗讓位規則全掛在 body.afk-bar 之下，官方站(無橫幅)整組不生效。
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

    // 選角畫面（手機直式）：#load-art-stage 是 overflow:hidden 的固定高（1040px）舞台，動作鈕區
    //   #load-action-panel 絕對定位在 top:854px；選到「有角色」的槽時鈕會變成 4 顆全寬（進入/匯出/刪除/返回）
    //   ＝222px 高 → 底端 1076px 超出舞台，最後一顆「返回」被裁掉一截。鈕數隨選中槽狀態變動，
    //   所以用量測撐高（min-height 壓得過 CSS 的 height）而不是寫死一個新高度，上游日後增減鈕也不會再壞。
    var LOAD_STAGE_PAD = 16;                                        // 撐高後留給底部的呼吸空間
    var LOAD_MOBILE_MQ = '(max-width: 600px) and (orientation: portrait)';   // 與 css/style.css 那條手機選角規則同條件
    var _loadMQ = null, _loadRO = null;
    function fitLoadStage() {
        var stage = document.getElementById('load-art-stage');
        var panel = document.getElementById('load-action-panel');
        if (!stage || !panel) return;
        if (!_loadMQ) { try { _loadMQ = matchMedia(LOAD_MOBILE_MQ); } catch (e) { return; } }
        if (!_loadMQ.matches) { stage.style.minHeight = ''; return; }   // 桌機是 aspect-ratio 版面，不可干預
        stage.style.minHeight = (panel.offsetTop + panel.offsetHeight + LOAD_STAGE_PAD) + 'px';
    }
    function watchLoadStage() {
        var panel = document.getElementById('load-action-panel');
        if (!panel) return;
        fitLoadStage();
        if (_loadRO || typeof ResizeObserver !== 'function') return;
        try { _loadRO = new ResizeObserver(fitLoadStage); _loadRO.observe(panel); } catch (e) {}
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
        watchLoadStage();
    }

    // 橫幅可能晚出現（gameLoop 會重掛）、換行高度隨寬度變 → 量測數次 + resize 時重量。
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
    window.addEventListener('resize', function () { syncMobileClass(); measureBar(); fitLoadStage(); });
    var _n = 0, _iv = setInterval(function () { measureBar(); if (++_n >= 12) clearInterval(_iv); }, 1000);

    // ── 底部導覽列 + 浮動日誌（手機外殼）─────────────────────────
    // 上游手機把三欄（#col-left 狀態/隊伍/技能、#col-center 戰鬥/地圖/日誌、#col-right 背包分頁）直向堆疊。
    //   底部導覽一次只顯示一欄；日誌（#log-row 含戰鬥/系統）拆進浮動面板、由「📜 日誌」開關（不佔戰鬥視圖）。
    //   純「顯示/隱藏整欄 + 補滿寬 + 搬日誌」，不動欄「內部」排版 → 與上游版面相容；離開遊戲/桌機一律還原。
    var VIEWS = [
        { id: 'center', label: '⚔️ 戰鬥' },
        { id: 'left', label: '👥 隊伍' },
        { id: 'right', label: '🎒 背包' },
        { id: 'log', label: '📜 日誌' },
        { id: 'logout', label: '🚪 登出' }   // 特判：不是切欄，而是跳確認窗→存檔→回首頁
    ];
    var _navStyled = false;
    function ensureNavStyle() {
        if (_navStyled) return; _navStyled = true;
        var css = [
            'body:not(.m-mobile) #m-nav,body:not(.m-mobile) #m-log-sheet{display:none !important;}',
            'body.m-mobile #m-nav{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:9600;background:#0f172a;border-top:1px solid #334155;padding-bottom:env(safe-area-inset-bottom,0px);}',
            'body.m-mobile #m-nav .m-nav-btn{flex:1;background:transparent;border:none;color:#94a3b8;font-size:12px;font-weight:600;padding:10px 2px;cursor:pointer;}',
            'body.m-mobile #m-nav .m-nav-btn.on{color:#38bdf8;background:rgba(56,189,248,.08);}',
            // 一次只顯示一欄，補滿寬（覆寫上游 col 固定寬）
            'body.m-mobile #col-left,body.m-mobile #col-center,body.m-mobile #col-right{display:none !important;width:100% !important;max-width:none !important;}',
            'body.m-mobile.mview-left #col-left{display:flex !important;}',
            'body.m-mobile.mview-center #col-center{display:flex !important;}',
            'body.m-mobile.mview-right #col-right{display:flex !important;}',
            // 底部讓位：--m-nav-h=導覽實測高度(含 iPhone safe-area 的 env padding；量測見 applyNavH)。
            //   寫死 60px 在實機 iPhone 會不夠(導覽 ~59px + home 條 safe-area ~34px)→ 清單最後一兩列被蓋。
            'body.m-mobile #game-screen{padding-bottom:calc(8px + var(--m-nav-h,0px)) !important;}',
            // 核心補跑進度條釘在畫面底部 18px、z-index 只有 90 → 手機會整條躲在導覽列(9600)底下看不到。
            'body.m-mobile #ff-progress-indicator{bottom:calc(10px + var(--m-nav-h,0px)) !important;}',
            // 浮動日誌面板
            'body.m-mobile #m-log-sheet{display:none;position:fixed;left:0;right:0;bottom:var(--m-nav-h,0px);height:46vh;z-index:9500;background:#0b1222;border-top:2px solid #475569;box-shadow:0 -10px 30px rgba(0,0,0,.6);flex-direction:column;}',
            'body.m-mobile.mlog-open #m-log-sheet{display:flex;}',
            'body.m-mobile #m-log-hd{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #334155;color:#cbd5e1;font-weight:700;flex:0 0 auto;}',
            'body.m-mobile #m-log-hd button{background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:6px;padding:2px 12px;cursor:pointer;}',
            'body.m-mobile #m-log-body{flex:1;overflow:auto;padding:6px;min-height:0;}',
            'body.m-mobile #m-log-body #log-row{flex-direction:column !important;height:100%;gap:0;}',
            // 像 main：一次只顯示一個日誌（戰鬥/系統），由標題列 ⇆ 切換
            'body.m-mobile #m-log-body #combat-log-panel,body.m-mobile #m-log-body #syslog-panel{height:100% !important;flex:1 1 100% !important;min-height:0;}',
            'body.m-mobile.mlog-sys #m-log-body #combat-log-panel{display:none !important;}',
            'body.m-mobile:not(.mlog-sys) #m-log-body #syslog-panel{display:none !important;}',
            'body.m-mobile #m-log-hd .m-log-sw{background:#1e293b;border:1px solid #334155;color:#7dd3fc;border-radius:6px;padding:2px 10px;margin-right:6px;cursor:pointer;}',
            // 從系統日誌點 NPC 名字彈出的選單（叫賣/嘲諷、擊殺密語）：核心給的 z-index 只有 260/261，
            //   而日誌在手機被搬進 fixed 的 #m-log-sheet(9500) → 選單掛在 body 上、開了卻整個被面板蓋住，
            //   玩家看到「點名字沒反應」；再點一下想試試看，那一下反而觸發核心的 document 關閉器把它關掉。
            //   拉到面板與導覽列之上（仍低於登出遮罩，不會壓到逃生門）。
            'body.m-mobile .wandering-shout-menu,body.m-mobile .wandering-taunt-menu,body.m-mobile .pvp-kill-whisper-menu{z-index:9700 !important;max-height:60vh;overflow-y:auto;}',
            // 登出確認視窗（自製，取代原生 confirm）
            '#m-logout-modal{display:none;position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:99998;background:rgba(2,6,23,0.7);align-items:center;justify-content:center;padding:24px;}',
            '#m-logout-modal.open{display:flex;}',
            '#m-logout-card{width:min(360px,92vw);background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.6);}',
            '#m-logout-msg{color:#e2e8f0;font-size:15px;line-height:1.7;text-align:center;margin-bottom:18px;}',
            '#m-logout-btns{display:flex;gap:10px;}',
            '#m-logout-btns button{flex:1;padding:11px;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer;font-family:inherit;border:1px solid #334155;touch-action:manipulation;}',
            '#m-logout-cancel{background:#1e293b;color:#cbd5e1;}',
            '#m-logout-cancel:active{background:#334155;}',
            '#m-logout-ok{background:#b45309;color:#fff;border-color:#d97706;}',
            '#m-logout-ok:active{background:#92400e;}',
            // 登出遮罩：按確定後立刻蓋住，撐過 reload 重開機那幾秒
            '#m-logout-overlay{position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:100000;background:#020617;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;}',
            '#m-logout-overlay-spin{width:38px;height:38px;border:3px solid #334155;border-top-color:#f59e0b;border-radius:50%;animation:m-logout-spin 0.8s linear infinite;}',
            '#m-logout-overlay-txt{color:#e2e8f0;font-size:15px;letter-spacing:0.5px;}',
            '@keyframes m-logout-spin{to{transform:rotate(360deg);}}'
        ].join('\n');
        var st = document.createElement('style'); st.id = 'afk-mobile-nav-style'; st.textContent = css;
        (document.head || document.documentElement).appendChild(st);
    }

    // 浮動日誌：把 #log-row 搬進面板（記原始父層供還原）
    var _logHome = null;
    function ensureLogSheet() {
        var sheet = document.getElementById('m-log-sheet');
        if (!sheet) {
            sheet = document.createElement('div'); sheet.id = 'm-log-sheet';
            sheet.innerHTML = '<div id="m-log-hd"><span id="m-log-title">📜 戰鬥日誌</span><span style="display:flex;align-items:center;"><button type="button" class="m-log-sw">⇆ 切換</button><button type="button" id="m-log-close">✕ 關閉</button></span></div><div id="m-log-body"></div>';
            document.body.appendChild(sheet);
            sheet.querySelector('#m-log-close').addEventListener('click', closeLog);
            sheet.querySelector('.m-log-sw').addEventListener('click', switchLog);
        }
        return sheet;
    }
    function moveLogToSheet() {
        var row = document.getElementById('log-row'); if (!row) return;
        var body = ensureLogSheet().querySelector('#m-log-body');
        if (row.parentNode !== body) { if (!_logHome) _logHome = row.parentNode; body.appendChild(row); }
    }
    function restoreLog() {
        var row = document.getElementById('log-row');
        if (row && _logHome && row.parentNode !== _logHome) _logHome.appendChild(row);
        var sheet = document.getElementById('m-log-sheet'); if (sheet) sheet.remove();
        document.body.classList.remove('mlog-open');
    }
    function switchLog() {
        document.body.classList.toggle('mlog-sys');
        var t = document.getElementById('m-log-title');
        if (t) t.textContent = document.body.classList.contains('mlog-sys') ? '📜 系統與物品日誌' : '📜 戰鬥日誌';
    }
    function openLog() { moveLogToSheet(); document.body.classList.add('mlog-open'); updateNavActive(); }
    function closeLog() { document.body.classList.remove('mlog-open'); updateNavActive(); }
    function toggleLog() { if (document.body.classList.contains('mlog-open')) closeLog(); else openLog(); }

    // --- 登出回首頁：自製確認窗（不用原生 confirm，iOS Safari 會抑制）→ 存檔 → 記離線錨點 → reload ---
    function doLogout() {
        var m = document.getElementById('m-logout-modal') || buildLogoutModal();
        m.classList.add('open');
    }
    function buildLogoutModal() {
        var m = document.createElement('div');
        m.id = 'm-logout-modal';
        m.innerHTML =
            '<div id="m-logout-card">' +
            '<div id="m-logout-msg">回首頁前會<b>自動幫你存檔</b>，進度不會遺失。<br>登出後會開始離線掛機（上限 24 小時）。<br>確定回首頁？</div>' +
            '<div id="m-logout-btns"><button id="m-logout-cancel" type="button">取消</button><button id="m-logout-ok" type="button">確定回首頁</button></div>' +
            '</div>';
        document.body.appendChild(m);
        function close() { m.classList.remove('open'); }
        m.addEventListener('click', function (e) { if (e.target === m) close(); });
        m.querySelector('#m-logout-cancel').addEventListener('click', close);
        m.querySelector('#m-logout-ok').addEventListener('click', function () {
            try { if (typeof window.saveGame === 'function') window.saveGame(); } catch (e) {}   // 先存當前進度（漏掉上次自動存檔後的收益）
            try { if (window.__afk && window.__afk.stamp) window.__afk.stamp(); } catch (e) {}   // 存完蓋錨點：存檔時間=離線起算時間
            showLogoutOverlay();   // 立刻蓋遮罩：reload 重開機那幾秒別看到殘留戰鬥畫面
            requestAnimationFrame(function () { requestAnimationFrame(function () { try { location.reload(); } catch (e) {} }); });
        });
        return m;
    }
    function showLogoutOverlay() {
        if (document.getElementById('m-logout-overlay')) return;
        var o = document.createElement('div');
        o.id = 'm-logout-overlay';
        o.innerHTML = '<div id="m-logout-overlay-spin"></div><div id="m-logout-overlay-txt">已自動存檔，正在回首頁…</div>';
        document.body.appendChild(o);
    }

    function setView(id) {
        if (document.body.classList.contains('mlog-open')) closeLog();   // 切欄一併收日誌
        document.body.classList.remove('mview-left', 'mview-center', 'mview-right');
        document.body.classList.add('mview-' + id);
        updateNavActive();
    }
    function currentView() { var m = document.body.className.match(/mview-(left|center|right)/); return m ? m[1] : null; }
    function updateNavActive() {
        var nav = document.getElementById('m-nav'); if (!nav) return;
        var view = currentView(), logOpen = document.body.classList.contains('mlog-open');
        var btns = nav.querySelectorAll('.m-nav-btn');
        for (var i = 0; i < btns.length; i++) {
            var id = btns[i].getAttribute('data-view');
            btns[i].classList.toggle('on', id === 'log' ? logOpen : (!logOpen && id === view));
        }
    }
    // --m-nav-h：底部導覽實際佔高(含 safe-area padding)。無導覽(桌機/首頁)時 0 → 讓位規則自動失效。
    function applyNavH() {
        var nav = document.getElementById('m-nav');
        var h = 0;
        if (nav && document.body.classList.contains('m-mobile')) {
            try { h = Math.ceil(nav.getBoundingClientRect().height); } catch (e) {}
        }
        document.documentElement.style.setProperty('--m-nav-h', h + 'px');
    }

    function buildNav() {
        if (!detectMobile()) return;
        var gs = document.getElementById('game-screen');
        if (!gs || gs.classList.contains('hidden')) return;   // 只在遊戲畫面建
        ensureNavStyle();
        moveLogToSheet();   // 手機一律把日誌搬出戰鬥欄（放進面板，預設收合）
        if (!document.getElementById('m-nav')) {
            var nav = document.createElement('div'); nav.id = 'm-nav';
            VIEWS.forEach(function (v) {
                var btn = document.createElement('button');
                btn.className = 'm-nav-btn'; btn.type = 'button';
                btn.setAttribute('data-view', v.id); btn.textContent = v.label;
                btn.addEventListener('click', v.id === 'log' ? toggleLog : (v.id === 'logout' ? doLogout : function (id) { return function () { setView(id); }; }(v.id)));
                nav.appendChild(btn);
            });
            document.body.appendChild(nav);
            var justEntered = true;   // nav 剛建立=剛進遊戲(navTick 每 1.5 秒重呼叫 buildNav,只有這輪為真)
        }
        if (!currentView()) setView('center');   // 預設戰鬥
        else updateNavActive();
        if (justEntered) autoOpenSysLog();   // 必須在 setView 之後:setView 會 closeLog,先開會被關掉
    }
    // 登入即開日誌並停在「系統與物品」頁:離線掛機結算摘要印在系統日誌,一進遊戲就看得到(使用者要求)。
    // 只在「這次進入遊戲」做一次(nav 重建=重新登入才再做),之後玩家自己開關/切頁不受干擾。
    function autoOpenSysLog() {
        openLog();
        if (!document.body.classList.contains('mlog-sys')) switchLog();
    }
    function navTick() {
        var gs = document.getElementById('game-screen');
        var inGame = detectMobile() && gs && !gs.classList.contains('hidden');
        if (inGame) buildNav();
        else {
            var nav = document.getElementById('m-nav'); if (nav) nav.remove();
            restoreLog();   // 離開遊戲：日誌搬回原位、收面板
            document.body.classList.remove('mview-left', 'mview-center', 'mview-right');
        }
        applyNavH();
    }
    // 嵌入式裝備視窗(js/19)的觸控捲動轉發:視窗是 body 層級 fixed、蓋滿分頁區,原生觸控捲不到 #game-screen。
    // 垂直拖曳改手動推 #game-screen.scrollTop(js/19 有掛 scroll→fitEquipmentWindowToViewport,視窗會跟著對齊);
    // 拖出位移就吞掉後續 click(capture),免得滑完誤點裝備格。
    function bindEquipTouchScroll() {
        var win = document.getElementById('equipment-window');
        if (!win || win.__afkTouchScroll) return; win.__afkTouchScroll = true;
        var y0 = 0, st0 = 0, moved = false;
        win.addEventListener('touchstart', function (e) {
            if (!document.body.classList.contains('m-mobile')) return;
            var gs = document.getElementById('game-screen'); if (!gs) return;
            y0 = e.touches[0].clientY; st0 = gs.scrollTop; moved = false;
        }, { passive: true });
        win.addEventListener('touchmove', function (e) {
            if (!document.body.classList.contains('m-mobile')) return;
            var gs = document.getElementById('game-screen'); if (!gs) return;
            var dy = e.touches[0].clientY - y0;
            if (Math.abs(dy) > 8) moved = true;
            gs.scrollTop = st0 - dy;
        }, { passive: true });
        win.addEventListener('click', function (e) {
            if (moved) { moved = false; e.stopPropagation(); e.preventDefault(); }
        }, true);
    }
    bindEquipTouchScroll();

    setInterval(navTick, 1500);
    navTick();

    // ── 對外介面（afk-offline 沿用 isMobile；setView/openLog 供離線結算後開日誌）──
    window.__afkm = { version: '2.0.0', isMobile: detectMobile, setView: setView, openLog: openLog, setLog: function () { openLog(); } };

    try { console.log('[AFK-mobile] hooks OK — 手機薄殼（橫幅讓位·版面用上游原版）。'); } catch (e) {}
})();
