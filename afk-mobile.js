/**
 * afk-mobile.js — 手機薄殼（2026-07 重寫）
 *
 * 背景：上游 v3.5 手機版面已改成「流動式」——#app-stage 由 CSS position:fixed;inset:0 填滿視窗、
 *   內層三欄 flex 隨視窗自然縮成單欄。手機版面「內部」直接用上游原版，不再覆寫（舊版整包覆寫會與
 *   上游新 app-stage 打架、把版面弄爛）。
 *
 * 這支只做兩件「外殼」層的事，不動版面結構：
 *   1. 手機幾何下的彈窗/浮動窗讓位（頂端讓開橫幅、底部讓開自製導覽列）。
 *      🚨 橫幅量測與「主畫面讓位」已搬去 afk-banner.js（基礎設施、不可被關）——本支是可被玩家關掉的
 *      外掛，讓位跟著它一起消失會讓平板玩家(關掉手機版面換三欄)整個頂端被橫幅蓋住（2026-07-23 回報）。
 *      本支只讀 --orig-bar-h / AFK_BANNER，不再自己量。
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

    // 上游全螢幕彈窗/浮動窗的「安全區」讓位：頂端讓開橫幅(--orig-bar-h)、底部讓開底部導覽(--m-nav-h)。
    //   --orig-bar-h 由 afk-banner 量測寫入、--m-nav-h 由本外掛量測寫入(無橫幅/無導覽時為 0px → 規則等同不動)，公式一律：
    //   可用高度 = 100dvh - var(--orig-bar-h) - var(--m-nav-h)。新的被蓋案例優先併進下面 ①~④ 的清單，別另立公式。
    // 上游手機版把彈窗分兩型(css/style.css 手機 media query)：
    //   A. 頂端錨定 top:8px + height:calc(100dvh-16px) 的浮動窗(倉庫/道具詳情/城鎮互動)
    //   B. flex 置中容器 + 內卡 max-height:calc(100dvh-16px)(自動賣出/各圖鑑/收藏/潘朵拉寶箱…)
    //   兩型的 100dvh 都不知道橫幅與導覽 → A 型改 top/height，B 型改容器 padding + 內卡 max-height。
    //   ⚠ B 型光改容器 padding 不夠：內卡比 padding 後的剩餘空間高時，flex 置中會「上下均分溢出」，
    //     頂端照樣鑽進橫幅底下(自動賣出規則的標題/Close 被蓋就是這樣來的)——必須同時壓內卡 max-height。
    // 彈窗清單由 afk-banner 單一維護(桌機幾何那組規則也吃同一份)；本支只在手機幾何下重用。
    //   (afk-banner 不可被停用，正常一定拿得到；取不到時退成不匹配任何元素的選擇器，避免產出無效 CSS)
    var MODAL_HOSTS = (window.AFK_BANNER && AFK_BANNER.MODAL_HOSTS) || '#afk-no-such-element';
    var MODAL_BOXES = (window.AFK_BANNER && AFK_BANNER.MODAL_BOXES) || '#afk-no-such-element';
    // 上游 css/style.css「手機版面」那條 media query 的原文條件。凡是要覆寫上游手機規則的，都必須包進同一條——
    //   本檔 detectMobile() 只要 pointer:coarse 就算手機，範圍比它大(觸控平板在我們眼中是手機、在上游眼中是桌機)，
    //   裸寫 body.m-mobile 會讓平板拿到「我們的手機規則 + 上游的桌機幾何」的混搭版。
    var MOBILE_GEOM_MQ = '(max-width: 768px), (max-height: 520px) and (pointer: coarse)';
    var _styleInjected = false;
    function ensureOffsetStyle() {
        if (_styleInjected) return; _styleInjected = true;
        var st = document.createElement('style');
        st.id = 'afk-mobile-bar-offset';
        // 主畫面(#app-stage/#creation-screen/#game-screen)的橫幅讓位在 afk-banner，這裡只補手機幾何專屬的部分。
        st.textContent =
            // 🆕 卡片式選角面板 #load-select-panel(手機)本身 position:absolute;inset:0;overflow:auto;min-height:100dvh，
            //   但它在被橫幅讓位縮短的 #creation-screen 內 → min-height:100dvh 比容器高 → creation-screen 也被迫捲，
            //   兩層巢狀捲動打架＝滾一下就卡住(使用者回報)。把它的 min-height 改成剛好=讓位後可視高度 → 只剩它單層捲。
            'body.m-mobile #load-select-panel:not(.hidden){ min-height: calc(100dvh - var(--orig-bar-h, 0px)) !important; overscroll-behavior: contain !important; }\n'
            // 選角面板顯示時，讓外層 #creation-screen 完全不捲(它自己會捲)→ 只剩 panel 單層捲，不再兩層打架卡住。
            + 'body.m-mobile.load-select-open #creation-screen{ overflow: hidden !important; }\n'   // load-select-open 由核心 js/10 同步(不用 :has，會讓整頁樣式一直重算)
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
            + '@media ' + MOBILE_GEOM_MQ + '{\n'
            + '  body.m-mobile #warehouse-window-frame, body.m-mobile #item-modal:not(.hidden), body.m-mobile #town-interaction-container:not(.hidden){ top: calc(8px + var(--orig-bar-h, 0px)) !important; height: calc(100dvh - 16px - var(--orig-bar-h, 0px) - var(--m-nav-h, 0px)) !important; }\n'
            + '}\n'
            //   ③ B 型·置中彈窗容器(含內聯 position:fixed 與 .fixed.inset-0 兩種都有的)：padding 夾安全區 + 內卡壓 max-height。
            + 'body.m-mobile :is(' + MODAL_HOSTS + '){ padding-top: calc(var(--orig-bar-h, 0px) + 8px) !important; padding-bottom: calc(var(--m-nav-h, 0px) + 8px) !important; }\n'
            + 'body.m-mobile :is(' + MODAL_BOXES + '){ max-height: calc(100dvh - var(--orig-bar-h, 0px) - var(--m-nav-h, 0px) - 16px) !important; }\n'
            //   ④ transform 置中的裝備視窗「獨立模式」：中心對齊安全區中線、封頂高度。
            //      ⚠ 必須排除嵌入模式(.equipment-window-embedded·js/19 init 就掛上、現行永遠嵌入)：嵌入時 frame 由 JS 內聯
            //        top:0 對齊 host，這裡的 top !important 會壓過內聯值把 12 格整個往下推出安全區(踩過)。
            + 'body.m-mobile #equipment-window:not(.equipment-window-embedded) .equipment-window-frame{ top: calc(50% + var(--orig-bar-h, 0px) / 2 - var(--m-nav-h, 0px) / 2) !important; max-height: calc(100dvh - 16px - var(--orig-bar-h, 0px) - var(--m-nav-h, 0px)) !important; }\n'
            //   ④' 桌機/平板幾何(寬 ≥769 且高 ≥521)的彈窗讓位在 afk-banner.js——那組不可隨本外掛被關掉。
            //      ③④ 只掛 body.m-mobile，是手機幾何專屬。
            //   ⑤ 右欄分頁(統計/道具/收藏…)：核心手機把 #tab-content-panel 設固定高+內層 overflow-auto，與外層 #game-screen 捲動疊成「雙捲軸」。
            //      讓分頁內容順流展開→只由 #game-screen 單層捲動(與 左/中 欄一致)；黏頂的 #mobile-vitals/分頁列照舊固定。
            //      ⚠ 必須排除 .equipment-panel-host：「裝備」分頁是核心的「嵌入式裝備視窗」(js/19)——#equipment-window 以
            //        position:fixed 蓋在 #tab-content-panel 的視窗座標上，依賴 host 有明確高度(--equipment-panel-height)。
            //        這條 auto 高度與那條同特異度、本檔較晚載入會蓋掉它 → host 塌掉、12 格裝備框整個錯位(踩過)。
            //      🚨 整組必須跟上游「手機幾何」同一條 media query：這裡把分頁攤平、交給 #game-screen 單層捲，
            //        而 #game-screen 的 overflow-y:auto 是上游寫在該 media query 裡的。平板(觸控·寬>768)在
            //        detectMobile() 眼中是手機、在上游眼中是桌機 → 內層被這裡關掉捲動、外層又還是不捲的桌機三欄，
            //        兩層都不捲＝道具/防具/設定分頁超出的部分永遠看不到也滑不到(2026-07-25 平板玩家回報)。
            + '@media ' + MOBILE_GEOM_MQ + '{\n'
            + '  body.m-mobile #tab-content-panel:not(.equipment-panel-host){ height: auto !important; min-height: 0 !important; overflow: visible !important; }\n'
            + '  body.m-mobile #tab-content-panel:not(.equipment-panel-host) > .ability-window-tab, body.m-mobile #tab-content-panel:not(.equipment-panel-host) > [id^="tab-"]{ height: auto !important; overflow: visible !important; }\n'
            //      ⚠ 背包條列式(afk-invlist)把 .classic-inventory-viewport 設成自己的捲動容器(overflow:auto+overscroll contain),
            //        分頁流式化後它 height 撐開、沒東西可捲 → 手勢在它身上被 contain 擋死、不鏈給 #game-screen=整頁滑不動。
            //        手機流式下退回普通元素,由 #game-screen 單層捲動(桌機/平板不受影響,invlist 原規則照舊)。
            //        touch-action 用 manipulation 不用 auto:捲動權限跟 auto 一樣,但這裡帶 !important,寫 auto 會把
            //        afk-nozoom 的「不雙擊放大」在背包整片打回來(玩家連點道具時整頁被放大)。
            + '  body.m-mobile #tab-content-panel:not(.equipment-panel-host) .classic-inventory-shell{ height: auto !important; }\n'
            + '  body.m-mobile #tab-content-panel:not(.equipment-panel-host) .classic-inventory-viewport{ height: auto !important; overflow: visible !important; overscroll-behavior: auto !important; touch-action: manipulation !important; }\n'
            + '}\n'
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
            + 'body.m-mobile :is(.equipment-window-frame, .warehouse-window-frame){ touch-action: pinch-zoom !important; }';
            // (登入頁不再需要手機專屬規則:首頁改成直式底圖+單一按鈕,桌機手機同一套,見 css/style.css)
        (document.head || document.documentElement).appendChild(st);
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
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
    window.addEventListener('resize', function () { syncMobileClass(); });

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
            // 戰鬥特效圖層(#vfx-layer:傷害數字、命中/死亡特效)是 position:fixed 掛在 #app-stage,不跟著 #col-center 藏
            //   → 打怪時切到背包/能力等畫面,特效會浮在那些畫面上。不在戰鬥那一欄就藏起來;用 visibility 不用 display,
            //   特效動畫照跑、animationend 照觸發,元素照常自己清掉,切回戰鬥不會一次冒出一堆舊特效。
            'body.m-mobile:not(.mview-center) #vfx-layer{visibility:hidden !important;}',
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
            // 容器頂端讓開橫幅、底部讓開自製導覽列(公式同本檔其他彈窗)；內卡再壓 max-height:100%——
            //   只改容器 padding 不夠：內卡比剩餘空間高時 flex 置中會「上下均分溢出」，頂端照樣鑽進橫幅底下。
            //   內卡的 100% 是相對容器「內容框」(已扣掉上面兩者)，不必重寫一次 100dvh 的算式，橫幅高度變了也自動跟上。
            '#m-logout-modal{display:none;position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:99998;background:rgba(2,6,23,0.7);align-items:center;justify-content:center;padding:24px 24px calc(24px + var(--m-nav-h,0px));}',
            '#m-logout-modal.open{display:flex;}',
            '#m-logout-card{display:flex;flex-direction:column;max-height:100%;width:min(520px,94vw);background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.6);}',
            '#m-logout-card>*{flex:none;}',   // 卡片一縮，只准角色清單縮（下面那條 flex:0 1 auto），訊息與按鈕維持原樣
            '#m-logout-msg{color:#e2e8f0;font-size:15px;line-height:1.7;text-align:center;margin-bottom:18px;}',
            // 切換角色清單：兩欄，格數多(16 格)時自己捲，不要把整張卡片撐爆
            '#m-logout-roster-t{color:#94a3b8;font-size:12px;margin-bottom:6px;}',
            '#m-logout-card #m-logout-slots{flex:0 1 auto;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:6px;align-content:start;overflow-y:auto;margin-bottom:16px;padding-bottom:2px;}',
            '#m-logout-hr{border:none;border-top:1px solid #334155;margin:0 0 16px;}',
            '.m-logout-slot{display:flex;align-items:center;gap:6px;min-width:0;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:6px 8px;}',
            '.m-logout-slot-n{flex:1;min-width:0;color:#e2e8f0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
            '.m-logout-slot-go{flex:none;background:#334155;border:1px solid #475569;color:#cbd5e1;border-radius:6px;padding:3px 9px;font-size:12px;font-family:inherit;cursor:pointer;touch-action:manipulation;}',
            '.m-logout-slot-go:active{background:#475569;}',
            '.m-logout-slot-cur{flex:none;color:#38bdf8;font-size:12px;font-weight:bold;}',
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
            sheet.innerHTML = '<div id="m-log-hd"><span id="m-log-title">📜 戰鬥／系統日誌</span><span style="display:flex;align-items:center;"><button type="button" class="m-log-sw">⇆ 切換</button><button type="button" id="m-log-close">✕ 關閉</button></span></div><div id="m-log-body"></div>';
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
    // ⚠ #syslog-panel 的 id 是歷史遺留名，實際內容是「世界頻道」(上游 v3.6.50 起)；
    //   真正的系統日誌 #sys-log 在 #combat-log-panel 內、由核心 switchLogTab('sys') 切換。
    //   故手機 ⇆ 切換＝在「戰鬥/系統日誌面板」與「世界頻道」之間切，標題要照這個對應。
    function setLogTitle() {
        var t = document.getElementById('m-log-title'); if (!t) return;
        t.textContent = document.body.classList.contains('mlog-sys') ? '🌐 世界頻道' : '📜 戰鬥／系統日誌';
    }
    function switchLog() {
        document.body.classList.toggle('mlog-sys');
        setLogTitle();
    }
    function openLog() { moveLogToSheet(); document.body.classList.add('mlog-open'); updateNavActive(); }
    function closeLog() { document.body.classList.remove('mlog-open'); updateNavActive(); }
    function toggleLog() { if (document.body.classList.contains('mlog-open')) closeLog(); else openLog(); }

    // --- 登出回首頁：自製確認窗（不用原生 confirm，iOS Safari 會抑制）→ 存檔 → 記離線錨點 → reload ---
    function doLogout() {
        var m = document.getElementById('m-logout-modal') || buildLogoutModal();
        renderLogoutRoster();   // 每次打開都重讀：別的分頁改過名字/刪過角色時不要顯示舊的
        m.classList.add('open');
    }
    function buildLogoutModal() {
        var m = document.createElement('div');
        m.id = 'm-logout-modal';
        m.innerHTML =
            '<div id="m-logout-card">' +
            '<div id="m-logout-roster-t">切換角色</div>' +
            '<div id="m-logout-slots"></div>' +
            '<hr id="m-logout-hr">' +
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
    function showLogoutOverlay(msg) {
        if (document.getElementById('m-logout-overlay')) return;
        var o = document.createElement('div');
        o.id = 'm-logout-overlay';
        o.innerHTML = '<div id="m-logout-overlay-spin"></div><div id="m-logout-overlay-txt"></div>';
        o.querySelector('#m-logout-overlay-txt').textContent = msg || '已自動存檔，正在回首頁…';
        document.body.appendChild(o);
    }
    // 回首頁那條走 reload、遮罩隨頁面一起消失；換角沒有重整，做完要自己收掉。
    function hideLogoutOverlay() {
        var o = document.getElementById('m-logout-overlay'); if (o) o.remove();
    }

    // --- 登出窗裡的「切換角色」清單 ---------------------------------------
    //   只列「有角色」的存檔位：這個窗唯一能做的事是跳到別隻，空格子在這裡不能創角也不能匯入＝純佔位，
    //   手機上還會把下面的確認鈕擠下去。掃描範圍一律走 SAVE_SLOT_MAX（跟「選角 16 格分頁」那支開關無關——
    //   有角色就列得出來，才不會有「某隻角色哪裡都進不去」的狀況）。
    //   名稱（未命名顯示職業）＋切換鈕；目前這隻標「目前」；名稱過長由 CSS 省略號處理。
    //   除了自己以外沒有別隻時，整段（標題／清單／分隔線）都不顯示，登出窗回到單純的確認窗。
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    // 離線結算/補跑進行中＝不可換角：那兩支迴圈都是非同步的（做一段就讓出主執行緒），中途把 currentSlot／
    //   player 換掉，剩下的 tick 與錨點推進就會算到新角色頭上（實測會把上一隻的結算進度寫進新角色的
    //   afk_ts_<slot>）。結算幾秒就結束，等它跑完再換即可；玩家也可用結算畫面的「長按放棄」提早結束。
    function settling() {
        try { if (window.__afk && typeof __afk.busy === 'function' && __afk.busy()) return true; } catch (e) {}
        try { if (typeof catchupActive === 'function' && catchupActive()) return true; } catch (e) {}
        return false;
    }
    // 上游沒有「存檔位數量」這種常數（選角畫面把 2 頁 × 每頁 4 格寫死在 js/13），
    //   SAVE_SLOT_MAX=16 是我方核心補丁加的；讀不到就退回上游的 8。
    var UPSTREAM_SLOT_MAX = 8;
    function slotMax() { return (typeof SAVE_SLOT_MAX !== 'undefined') ? SAVE_SLOT_MAX : UPSTREAM_SLOT_MAX; }
    function showRoster(show, box, t, hr) {
        box.style.display = show ? '' : 'none';
        if (t) t.style.display = show ? '' : 'none';
        if (hr) hr.style.display = show ? '' : 'none';
    }
    function renderLogoutRoster() {
        var box = document.getElementById('m-logout-slots'), t = document.getElementById('m-logout-roster-t'), hr = document.getElementById('m-logout-hr');
        if (!box) return;
        if (typeof slotSummary !== 'function') {   // 核心沒這支就整段不顯示（優雅降級，登出本身照常）
            showRoster(false, box, t, hr);
            return;
        }
        var cur = (typeof currentSlot !== 'undefined') ? String(currentSlot) : '', html = '', n, sum, nm, others = 0;
        var busy = settling();   // 結算中：不給切換鈕（按了也不會動＝當作壞掉），改在標題講原因
        for (n = 1; n <= slotMax(); n++) {
            sum = null;
            try { sum = slotSummary(n); } catch (e) { sum = null; }
            if (!sum) continue;   // 空格子不列
            nm = esc(sum.name || sum.cls || ('存檔 ' + n));
            if (String(n) !== cur) others++;
            html += '<div class="m-logout-slot"><span class="m-logout-slot-n" title="' + nm + '">' + nm + '</span>' +
                (String(n) === cur ? '<span class="m-logout-slot-cur">目前</span>'
                    : (busy ? '' : '<button type="button" class="m-logout-slot-go" data-slot="' + n + '">切換</button>')) + '</div>';
        }
        showRoster(others > 0, box, t, hr);   // 只有自己一隻＝沒得切，整段收掉
        if (!others) { box.innerHTML = ''; return; }
        if (t) t.textContent = busy ? '切換角色（離線結算中，結束後才能切換）' : '切換角色';
        box.innerHTML = html;
        box.querySelectorAll('.m-logout-slot-go').forEach(function (b) {
            b.addEventListener('click', function () { switchToSlot(parseInt(b.getAttribute('data-slot'), 10)); });
        });
    }

    // 換角＝就地「存檔→蓋離線錨點→換 currentSlot→loadGame()」，跟首頁選角按「進入遊戲」
    // （核心 loadEnterSelected）走的是同一條路，中間不重整。
    //   核心對重入是安全的：startGameTimers() 先清掉舊計時器再註冊、loadGame 開頭會把上一角色的寵物進度
    //   flush 進共用桶。實測連換 24 次（每次都跑一輪離線結算）：JS heap 從 10MB 爬到約 21.5MB 後打平、
    //   不再成長，活著的 interval 恆為 27，tick 速率全程 29~31/3s（＝不是漏，是兩隻角色與各種快取的穩態）。
    //   ⚠ 舊版走「sessionStorage 記一格 → location.reload → 重整後計時器接手載入」，重整途中任何一環
    //   （鍵被別人消掉、那格當下讀不到摘要）都只會安靜地停在首頁，玩家看到的就是「按了只是回首頁」。
    function switchToSlot(n) {
        if (!(n > 0) || typeof window.loadGame !== 'function') return;
        var ok = false;
        try { ok = (typeof slotSummary === 'function') && !!slotSummary(n); } catch (e) { ok = false; }
        if (!ok) { renderLogoutRoster(); return; }   // 那格已沒角色（別的分頁刪掉了）→ 重畫清單，不硬闖
        // 🚨 沒載入角色時絕不往下走：下面每一步都會寫存檔，在「未載入/currentSlot 不是預期那格」跑等於蓋掉別人的檔
        if (typeof player === 'undefined' || !player || !player.cls) return;
        if (settling()) { renderLogoutRoster(); return; }   // 離線結算中不給換（原因見 settling()）
        var m = document.getElementById('m-logout-modal'); if (m) m.classList.remove('open');
        showLogoutOverlay('已自動存檔，正在切換角色…');   // 下面是同步的、會卡住一下 → 先讓遮罩畫出來
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                // ⚠ 蓋離線錨點必須排在最前面：stamp 看到 game-screen 被藏起來就會放棄（returnToCharacterSelect 會藏），
                //   而 currentSlot 此時還是舊的＝錨點正好記在「要離開的這隻」身上。
                try { if (window.__afk && window.__afk.stamp) window.__afk.stamp(); } catch (e) {}
                // 走核心自己的「離開角色」流程：最終存檔（帶 player.cls 守衛）＋停計時器＋取消進行中的離線補跑
                //   ＋清 VFX ＋釋放多分頁角色佔用。自己土法只呼叫 saveGame 的話，上面這些殘留會跟著帶進下一隻。
                var left = false;
                try { left = (typeof returnToCharacterSelect === 'function') && returnToCharacterSelect(); } catch (e) {}
                if (!left) { try { if (typeof window.saveGame === 'function') window.saveGame(); } catch (e) {} }   // 後備：上游拿掉那支時至少要存到檔
                try { currentSlot = n; window.loadGame(); } catch (e) { try { console.warn('[AFK-mobile] 換角載入失敗', e); } catch (e2) {} }
                hideLogoutOverlay();
            });
        });
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
    // 登入即開日誌並切到「系統日誌」分頁:離線掛機結算摘要印在系統日誌,一進遊戲就看得到(使用者要求)。
    // ⚠ 系統日誌在 #combat-log-panel 內、由核心 switchLogTab('sys') 切;不是 #syslog-panel(那是世界頻道)。
    //   舊寫法 switchLog() 會把 mlog-sys 打開→顯示世界頻道、把離線摘要藏起來(標題也錯標成系統日誌)。
    // 只在「這次進入遊戲」做一次(nav 重建=重新登入才再做),之後玩家自己開關/切頁不受干擾。
    function autoOpenSysLog() {
        openLog();
        if (document.body.classList.contains('mlog-sys')) switchLog();   // 確保顯示戰鬥/系統面板,不是世界頻道
        try { if (typeof switchLogTab === 'function') switchLogTab('sys'); } catch (e) {}   // 面板內分頁切到系統日誌(離線摘要在此)
        setLogTitle();
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

    setInterval(function () { if (!document.hidden) navTick(); }, 1500);   // 背景分頁不必維護版面;回前景由下一輪或下方 MutationObserver 補上
    navTick();
    // 🚀 遊戲畫面一顯示(#game-screen 移除 .hidden)就「立刻」重建手機殼,不等下一次 1.5s 輪詢。
    //    否則登入後會先看到上游桌機堆疊版面、隔最多 1.5 秒才 reshape 成手機殼(底部導覽/單欄)→ 明顯閃一下。
    //    MutationObserver 回呼在 class 變更後、下次繪製前以 microtask 觸發,手機殼多半趕在畫面繪出前套上。
    (function () {
        var gs = document.getElementById('game-screen');
        if (!gs || typeof MutationObserver === 'undefined') return;
        try { new MutationObserver(function () { navTick(); }).observe(gs, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
    })();

    // ── 對外介面（afk-offline 沿用 isMobile；setView/openLog 供離線結算後開日誌）──
    //   setLog('sys')＝離線結算後把日誌切到「系統日誌」分頁（摘要印在那）；其餘只開日誌。
    window.__afkm = { version: '2.0.0', isMobile: detectMobile, setView: setView, openLog: openLog, setLog: function (which) { if (which === 'sys') autoOpenSysLog(); else openLog(); } };

    try { console.log('[AFK-mobile] hooks OK — 手機薄殼（橫幅讓位·版面用上游原版）。'); } catch (e) {}
})();
