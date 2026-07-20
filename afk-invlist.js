/**
 * afk-invlist.js — 背包「條列式」顯示（像我方舊 main：一行一物品，取代上游 1.8 皮膚格狀）
 *
 * 上游 v3.0.40 起背包改成「1.8 皮膚」：.classic-inventory-shell(背景藝術圖·固定比例) 內
 *   .classic-inventory-viewport(4 欄 grid) 排 .list-item(格狀·以圖示為主)。我方舊 main 是條列式
 *   (一行一物品：小圖示 + 全名 + 詞綴/強化/廢品標籤)。
 *
 * 這支「純 CSS 覆寫」把外殼藝術拆掉、grid 改成單欄列表、每格改成整寬一行。桌機/手機通用、可開關
 *   (關掉 → body 不帶 .afk-invlist → 完全回上游格狀皮膚)。item 內容本來就含圖示+全名，改排版即成條列。
 */
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('invlist')) return;   // 🎚️ 外掛開關

    var CSS = [
        // 外殼：拆掉藝術背景圖與固定比例，改成「吃掉分頁剩餘高度」的彈性容器。
        //   ⚠ 不可用 height:100%：分頁是直向 flex，外殼上面還有「快速操作」工具列(約 55px)，
        //     100% 是對「分頁全高」算的 → 外殼比剩餘空間高一截、底部被 overflow:hidden 裁掉又捲不到
        //     (桌機看不到背包最後幾列、也找不到地方拉·玩家回報)。flex:1+min-height:0 才是扣掉工具列後的剩餘高。
        'body.afk-invlist .classic-inventory-shell{aspect-ratio:auto !important;background:none !important;flex:1 1 auto !important;height:auto !important;min-height:0 !important;max-width:100% !important;}',
        // 視窗：絕對定位的 4 欄 grid → 靜態單欄直向清單，正常捲動
        //   ⚠ iOS 觸控捲動：溢出量小時（如武器只多幾件）沒有 -webkit-overflow-scrolling:touch 會滑不動、
        //     觸控被外層 #game-screen 吃掉（防具/道具溢出大反而滑得動）。補齊 iOS 觸控三件套。
        'body.afk-invlist .classic-inventory-viewport{position:static !important;inset:auto !important;left:auto !important;top:auto !important;width:100% !important;height:100% !important;display:flex !important;flex-direction:column !important;gap:3px !important;padding:4px !important;grid-template-columns:none !important;grid-auto-rows:auto !important;background:transparent !important;overflow-y:auto !important;-webkit-overflow-scrolling:touch !important;touch-action:pan-y !important;overscroll-behavior:contain !important;}',
        // 每格：滿寬一行(圖示 + 名稱靠左、勾選/標籤靠右)
        //   ⚠ flex:0 0 auto 不可省：viewport 是固定高的直向 flex，子項預設會被壓縮 →
        //     物品一多列高被壓到 min-height 以下，而本檔又把 overflow 改成 visible(格狀皮膚原本靠 hidden 裁掉)
        //     → 名稱直接溢出疊到下一列上(玩家回報「背包名稱疊在一起」)。列各自撐開、整份交給捲軸。
        'body.afk-invlist .classic-inventory-viewport > .list-item{flex:0 0 auto !important;width:100% !important;height:auto !important;min-height:34px;aspect-ratio:auto !important;display:flex !important;align-items:center !important;justify-content:space-between !important;padding:5px 9px !important;border:1px solid #334155 !important;border-radius:6px !important;background:rgba(15,23,42,.55) !important;box-shadow:none !important;overflow:visible !important;}',
        'body.afk-invlist .classic-inventory-viewport > .list-item:hover{border-color:#7dd3fc !important;filter:none;background:rgba(30,41,59,.75) !important;}',
        'body.afk-invlist .classic-item-main{justify-content:flex-start !important;gap:8px !important;width:auto !important;height:auto !important;flex:1 1 auto;min-width:0;}',
        'body.afk-invlist .classic-icon-box{width:26px !important;height:26px !important;flex:0 0 26px !important;}',
        'body.afk-invlist .classic-icon-box img,body.afk-invlist .classic-item-main .classic-icon-box img{width:100% !important;height:100% !important;}',
        'body.afk-invlist .classic-name-box{display:flex !important;flex-flow:row wrap !important;align-items:baseline !important;gap:0 8px !important;justify-content:flex-start !important;text-align:left !important;min-width:0;width:auto !important;height:auto !important;}',
        'body.afk-invlist .classic-item-flags{white-space:normal !important;}',
        // 格狀皮膚把強化值/數量、🔒、廢品標籤都絕對定位在「圖示格」四角，但條列模式下它們的定位錨
        //   .classic-item-main 是整條列 → 會壓在名稱上。強化值/數量 getItemFullName 已含(+9、(3))→ 直接收掉；
        //   🔒 與 廢品 改回文流排在名稱後面。
        'body.afk-invlist .classic-inventory-viewport > .list-item .classic-icon-corner-value{display:none !important;}',
        'body.afk-invlist .classic-inventory-viewport > .list-item .classic-item-lock-badge,body.afk-invlist .classic-inventory-viewport > .list-item .classic-item-junk-label{position:static !important;left:auto !important;right:auto !important;top:auto !important;bottom:auto !important;flex:0 0 auto !important;width:auto !important;height:auto !important;max-width:none !important;max-height:none !important;margin-left:6px !important;background:transparent !important;}',
        // 條列不需要「空格填充」與皮膚捲動箭頭
        'body.afk-invlist .classic-inventory-scroll{display:none !important;}',
        'body.afk-invlist .classic-grid-empty{display:none !important;}',
        // 上游把這個捲動區的捲軸關掉(scrollbar-width:none)，因為皮膚背景圖畫了假的上下箭頭鈕；
        //   但條列模式把那兩顆假箭頭藏了 → 桌機變成兩邊都沒有、只剩滾輪(玩家回報「只有能力那格有拉條」)。
        //   只給有精準指標的桌機開回真捲軸(手機用手指捲、不必佔 8px 寬)。
        '@media (hover:hover) and (pointer:fine){',
        'body.afk-invlist .classic-inventory-viewport{scrollbar-width:thin !important;scrollbar-color:#8a6547 #17161b !important;}',
        'body.afk-invlist .classic-inventory-viewport::-webkit-scrollbar{width:8px !important;height:8px !important;}',
        'body.afk-invlist .classic-inventory-viewport::-webkit-scrollbar-track{background:#17161b;border-radius:2px;}',
        'body.afk-invlist .classic-inventory-viewport::-webkit-scrollbar-thumb{background:#5c4739;border:1px solid #8a6547;border-radius:2px;}',
        '}'
    ].join('\n');

    var st = document.createElement('style'); st.id = 'afk-invlist-style'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);

    function on() { if (document.body) document.body.classList.add('afk-invlist'); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', on);
    else on();
    // 保險：有些流程可能重設 body class → 定期確保還在
    setInterval(on, 3000);

    try { console.log('[AFK-invlist] hooks OK — 背包條列式已套用（可於外掛開關關閉回原版格狀）。'); } catch (e) {}
})();
