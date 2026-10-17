/* ============================================================================
 * afk-lmui.js — 天堂M風格介面（手機）
 *
 * 第一階段：戰鬥畫面改成天堂M的樣子 ——
 *   ・戰鬥框滿版、場景壓暗＋四周暗角（怪物站在下方 HUD 之上）
 *   ・左上：角色頭像（職業徽章；點頭像開裝備欄）、名字＋等級、AC / MR / 正邪值、金幣；≫ 收合狀態圖示
 *   ・右上：地圖名稱框＋半透明圓形小地圖（中心是自己、紅點是場上的怪；點了開「地圖」面板
 *     ＝上游原本的回村/瞬移/黑市/地圖選單）
 *   ・下方：HP/MP 長條、F1~F6 快捷列（先放已學會的手動技能，剩下的格子放身上的藥水/瞬移卷軸，
 *     顯示數量）、聊天框（一般/世界/戰鬥/掉落 分頁，點了開完整日誌）、最底下經驗 %
 *   ・按鈕：AUTO＝暫停／繼續（灰＝暫停中）、回村鈕＝回村（搖桿/攻擊/鎖定/PVP 玩家要求拿掉）
 *   ・底部導覽列換成只有圖示的樣式
 *
 * 資料來源一律讀核心 DOM / 全域（st-lv / st-ac / txt-hp / bar-hp… / player / mapState），
 *   不讀 afk-battlehud / afk-skillbar 的元素（那些可以被玩家單獨關掉）。
 *   這支是 afk-mobile 的子選項（parent:'mobile'）：底部導覽、日誌面板、mview-* 都是那支建的，
 *   那支關掉＝這支沒有掛點，所以讀 body.m-mobile / mview-center / #m-nav 是對的。
 *
 * 只在「上游手機 media query 成立 + 遊戲畫面 + 戰鬥分頁 + 在狩獵地圖」時套用；
 *   其他時候（村莊、背包分頁、桌機）body 上沒有 lmui-battle，畫面完全是原本的樣子。
 *
 * 掛接：在 index.html 的 </body> 前 <script src="afk-lmui.js">（排在 afk-mobile / afk-skillbar 之後）。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'lmui', name: '天堂M風格介面', group: '遊戲介面', def: true, parent: 'mobile',
      desc: '手機戰鬥畫面滿版，狀態、快捷列、聊天框浮在畫面上'
    });
  }
  function on() { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('lmui'); }
  if (!on()) return;

  // 與 css/style.css 手機版面那條一字不差（afk-mobile 的 MOBILE_GEOM_MQ 同一條）
  var MOBILE_MQ = '(max-width: 768px), (max-height: 520px) and (pointer: coarse)';
  var TICK_MS = 300;
  var TICKS_PER_SEC = 10;   // 核心 TICK_MS=100 → manualCd 是 tick 數
  var HOT_SLOTS = 12;   // F1~F12；一排 6 格，右邊的切換鈕循環「F1~F6 → F7~F12 → 兩排 → F1~F6」
  var HOT_ROW = 6;
  var SK_COLS = 5;   // 魔法書一排幾格
  var HOT_MODE_KEY = 'lmui_hot_mode';   // 這台裝置的顯示方式（只是畫面偏好，不進存檔）
  var CHAT_LINES = 60;   // 聊天框可往上捲，保留最近幾行（取代 afk-mobile 的完整日誌面板）
  var CLASS_LOGO = { royal: '王族', knight: '騎士', mage: '法師', elf: '妖精', dark: '黑暗妖精' };
  // 快捷列的道具順序：治癒藥水由強到弱 → 藍水 → 加速/勇敢 → 瞬移卷軸；其餘 type:'pot' 排最後
  var HOT_ITEM_ORDER = ['potion_ult', 'potion_strong', 'potion_heal', 'potion_blue', 'potion_haste', 'potion_brave', 'scroll_teleport'];

  // 彈窗清單由 afk-banner 單一維護（不可停用的基礎設施）；取不到時退成不匹配任何元素的選擇器
  var MODAL_HOSTS = (window.AFK_BANNER && AFK_BANNER.MODAL_HOSTS) || '#afk-no-such-element';
  var LOG_AUTOCLOSE_MS = 5000;   // 進遊戲後這段時間內，afk-mobile 自動打開的日誌一律收起（聊天框已顯示同樣的內容）

  var mq = null;
  try { mq = matchMedia(MOBILE_MQ); } catch (e) {}

  function $(id) { return document.getElementById(id); }
  function txt(id) { var e = $(id); return e ? (e.textContent || '').trim() : ''; }
  function setTxt(el, v) { if (el && el.textContent !== v) el.textContent = v; }
  function setStyle(el, k, v) { if (el && el.style[k] !== v) el.style[k] = v; }
  function hasP() { return typeof player !== 'undefined' && player && player.cls; }

  // ── 樣式 ────────────────────────────────────────────────
  function injectCSS() {
    if ($('afk-lmui-style')) return;
    var B = 'body.lmui-battle ';
    var STAND = 'var(--lmui-stand)';   // 場景往下鋪到血條（精簡版面再加聊天輸入列）後面（去背，站長），怪物/角色站在血條上緣
    var css = [
      /* 戰鬥場景只佔上半（玩家要求「縮到一半、下方留空間」）：下方 HUD 面板＝可用高度的一半扣掉 AUTO 那條 */
      ':root{--lmui-btns:0px;--lmui-vit:50px;--lmui-stack:calc((100dvh - var(--orig-bar-h,0px) - var(--m-nav-h,0px)) / 2 - var(--lmui-vit));--lmui-gold:#d9bf86;--lmui-line:rgba(214,190,140,.45);--lmui-glass:rgba(8,8,10,.42);}',

      /* ── 上下兩塊：上半永遠是戰鬥（不管切到哪個分頁），下半放 HUD 或分頁內容 ──
         #col-center 釘在上半（fixed，不受 afk-mobile「一次只顯示一欄」影響）；#game-screen 本身縮到下半當捲動區——
         分頁內容、嵌入式裝備視窗（js/19 跟著 #game-screen 捲動對位）、afk-mobile 的觸控捲動轉發都還是同一個捲動容器。
         html 前綴＝壓過 afk-mobile 的 body.m-mobile #game-screen{padding-bottom:…!important}、#col-center{display:none!important}。 */
      'html ' + B + '#game-screen{top:var(--lmui-mtop) !important;height:auto !important;bottom:0 !important;padding:8px 8px calc(var(--m-nav-h,0px) + 8px) !important;overflow-y:auto !important;}',
      'html ' + B + '#col-center{display:flex !important;position:fixed !important;top:var(--orig-bar-h,0px) !important;left:0 !important;right:0 !important;width:auto !important;height:calc(var(--lmui-mtop) - var(--orig-bar-h,0px)) !important;gap:0 !important;margin:0 !important;z-index:1;}',   /* 含血條那一列：血條去背，後面是場景 */
      B + '#map-view-panel{flex:1 1 auto !important;height:100% !important;min-height:0 !important;display:flex !important;flex-direction:column !important;background:none !important;border:0 !important;border-radius:0 !important;box-shadow:none !important;padding:0 !important;margin:0 !important;position:relative !important;}',
      B + '#map-view-panel::before,' + B + '#map-view-panel::after{display:none !important;}',
      B + '#map-view-panel>.panel-header{display:none !important;}',
      /* 場景壓暗：底色 #555 × multiply ≈ 原圖亮度 1/3；inset 陰影做四周暗角（畫在背景之上、怪物之下） */
      B + '#battle-view{flex:1 1 auto !important;width:100% !important;max-width:none !important;height:auto !important;min-height:0 !important;aspect-ratio:auto !important;margin:0 !important;border:0 !important;border-radius:0 !important;background-size:cover !important;background-position:center !important;background-color:#5a5550 !important;background-blend-mode:multiply !important;box-shadow:inset 0 0 140px 50px rgba(0,0,0,.9) !important;padding:0 0 ' + STAND + ' !important;align-self:stretch !important;}',
      /* 角色/夥伴是 absolute 貼戰鬥框底（核心 inline bottom:2px），padding 對它們無效 → 底線跟著抬 */
      B + '#player-morph-sprite{bottom:calc(' + STAND + ' + 2px) !important;}',
      B + '#pet-layer{top:0 !important;height:auto !important;bottom:' + STAND + ' !important;}',
      B + '#status-icon-bar{position:absolute !important;top:8px !important;right:6px !important;left:auto !important;max-width:62% !important;z-index:5;display:flex !important;flex-flow:row-reverse wrap !important;justify-content:flex-start !important;gap:3px;}',   // 右上角、地圖鈕下方，從右往左排
      /* 狀態（魔法）圖示放大：上游手機只有 ~12px，看不出是哪個魔法 */
      B + '#status-icon-bar .status-icon{width:28px !important;height:28px !important;min-width:28px;border:0 !important;box-shadow:none !important;background:none !important;}',
      B + '#status-icon-bar .status-icon img{width:100% !important;height:100% !important;object-fit:cover;}',
      /* 去背（站長）：圖檔本身是黑底，整排用 screen 疊在場景上＝黑色變透明、只留發亮的圖案。
         ⚠ 要掛在 #status-icon-bar 本身：它有 z-index 自成一層，掛在裡面的圖示上只會跟透明的自己混，黑底照樣在 */
      B + '#status-icon-bar{mix-blend-mode:screen;}',
      /* 點狀態圖示看名稱與剩餘時間（內容取自核心寫在圖示上的 title，每秒更新） */
      '#lmui-stip{position:fixed;z-index:2147483000;display:none;max-width:70vw;padding:6px 10px;border:1px solid #6b5636;border-radius:6px;background:rgba(20,16,12,.96);color:#f1e6cf;font-size:15px;line-height:1.4;box-shadow:0 4px 12px rgba(0,0,0,.6);pointer-events:none;white-space:nowrap;}',
      /* 戰鬥畫面不被視窗遮住：彈窗一律改放在「場景下緣以下」（蓋住按鈕/快捷列/聊天框，不蓋場景）。
         afk-mobile / afk-banner 的彈窗讓位規則全是 top＝var(--orig-bar-h)、高＝100dvh−bar−nav，
         所以只要在「彈窗元素自己身上」把 --orig-bar-h 換成場景下緣，那整套規則（A 型/B 型/內卡封頂）就自動跟著改。
         --lmui-mtop 定義在 :root、繼承下來時已算好值，不會跟 --orig-bar-h 形成循環；#app-stage 等主畫面不受影響。 */
      ':root{--lmui-mtop:calc(100dvh - var(--m-nav-h,0px) - var(--lmui-stack) - var(--lmui-btns));--lmui-bar:var(--orig-bar-h,0px);--lmui-pop-top:calc(var(--lmui-bar) + 92px);--lmui-pop-bot:calc(var(--m-nav-h,0px) + 4px);--lmui-pop-side:max(4px,calc((100vw - max(330px,80vw)) / 2));}',
      /* 所有彈窗＝浮動視窗：寬約畫面 8 成置中（至少 330px）、上緣在頭像列下方、下緣到工具列上方、圓角金框、外圍壓暗（玩家要求「滿版、四周留點間隙」） */
      B + ':is(#item-modal,#warehouse-window-frame,.fixed.inset-0,' + MODAL_HOSTS + '){--orig-bar-h:calc(var(--lmui-bar) + 4px) !important;}',
      /* 遮罩型（滿版半透明底＋內卡置中）只靠 padding 把內卡推下去，那片暗底還是從頂端蓋住戰鬥 → 遮罩本身也從場景下緣開始 */
      'html ' + B + ':is(.fixed.inset-0,' + MODAL_HOSTS + '){top:var(--lmui-bar) !important;padding:calc(var(--lmui-pop-top) - var(--lmui-bar)) var(--lmui-pop-side) var(--lmui-pop-bot) !important;}',
      'html ' + B + '#warehouse-window-frame{top:var(--lmui-pop-top) !important;bottom:var(--lmui-pop-bot) !important;left:var(--lmui-pop-side) !important;right:var(--lmui-pop-side) !important;width:auto !important;height:auto !important;max-height:none !important;transform:none !important;border-radius:10px !important;box-shadow:0 0 0 100vmax rgba(0,0,0,.55),0 10px 40px rgba(0,0,0,.9) !important;}',
      /* 遮罩型的內卡撐滿遮罩（扣掉上面那圈 padding） */
      'html ' + B + ':is(' + (window.AFK_BANNER && AFK_BANNER.MODAL_BOXES || '#afk-no-such-element') + '){width:100% !important;max-width:none !important;height:auto !important;max-height:100% !important;border-radius:10px !important;overflow:auto !important;}',
      /* 內容少的視窗不撐滿：遮罩型的內卡改成靠上、高度跟內容走（最多到工具列上方） */
      'html ' + B + ':is(.fixed.inset-0,' + MODAL_HOSTS + '){align-items:flex-start !important;}',
      B + '#m-log-sheet{height:calc(var(--lmui-stack) + var(--lmui-btns)) !important;}',
      /* 不在上面清單裡、直接掛在 body 下的全螢幕彈窗（決鬥競技場、小百科、掉落查詢…）：tick 偵測到蓋住戰鬥就掛 .lmui-below。
         遮罩型（inset:0＋置中）→ 上緣壓到場景下緣、內卡封頂可捲；transform 置中型 → 改貼場景下緣、只留水平置中。 */
      B + '.lmui-below{top:var(--lmui-pop-top) !important;bottom:auto !important;left:var(--lmui-pop-side) !important;right:var(--lmui-pop-side) !important;width:auto !important;height:auto !important;max-height:calc(100dvh - var(--lmui-pop-top) - var(--lmui-pop-bot)) !important;border-radius:10px !important;}',
      B + '.lmui-below>*{max-height:100% !important;overflow:auto !important;}',
      B + '.lmui-below-c{top:var(--lmui-pop-top) !important;bottom:auto !important;left:var(--lmui-pop-side) !important;right:var(--lmui-pop-side) !important;width:auto !important;height:auto !important;max-height:calc(100dvh - var(--lmui-pop-top) - var(--lmui-pop-bot)) !important;transform:none !important;overflow:auto !important;border-radius:10px !important;box-shadow:0 0 0 100vmax rgba(0,0,0,.55),0 10px 40px rgba(0,0,0,.9) !important;}',
      /* 彈窗開著時收起下方 HUD：#app-stage 是 fixed＝自成疊層，裡面的彈窗 z-index 再高也蓋不過 body 層的 HUD。
         核心 js/10 同步到 body 的 item-modal-open / town-int-open 讓常見的兩種當下就收（不等 tick；不用 :has()，那會讓整頁樣式一直重算）；其餘彈窗由 tick 掛 .lmui-win。 */
      'body.lmui-battle.lmui-win #lmui-hud>:not(#lmui-mobinfo):not(#lmui-tl):not(#lmui-tr):not(#lmui-vit),' +
      'body.lmui-battle.mlog-open #lmui-bottom,' +
      'body.lmui-battle.lmui-map #lmui-bottom,body.lmui-battle.lmui-dead #lmui-bottom,' +
      /* 下方 HUD 只屬於「戰鬥」分頁；切到背包/素質/隊伍時下半給分頁內容 */
      'body.lmui-battle:not(.mview-center) #lmui-bottom{display:none !important;}',
      'body.lmui-battle.item-modal-open #lmui-hud>:not(#lmui-mobinfo):not(#lmui-tl):not(#lmui-tr):not(#lmui-vit){display:none !important;}',
      'body.lmui-battle.lmui-mobinfo #lmui-hud>:not(#lmui-mobinfo):not(#lmui-tl):not(#lmui-tr):not(#lmui-vit){visibility:hidden !important;}',
      /* 子分頁列（工具列正上方那排）也是 fixed、層級很高，彈窗開著時會蓋住視窗底部 → 一起收起 */
      'body.lmui-win #lmui-bagtabs,body.lmui-mobinfo #lmui-bagtabs,body.lmui-npcwin #lmui-bagtabs{display:none !important;}',
      'body.lmui.item-modal-open #lmui-bagtabs{display:none !important;}',
      /* 怪物血條移到頭上（名字下方）：怪物卡是直向 flex（名字/徽章/圖/狀態/血條），只改 order 不動結構 */
      B + '#mob-list .mob-target>.mob-name{order:-2;}',
      B + '#mob-list .mob-target>.mob-hp-bar{order:-1;margin:1px 0 2px !important;}',
      /* 被 HUD 取代的元件 */
      B + '#m-status,' + B + '#mobile-vitals,' + B + '#m-skillbar,' + B + '#m-battle-buffs{display:none !important;}',
      /* 死亡視窗（天堂M）：重新開始／離開／取消＋狩獵紀錄，蓋在戰鬥畫面中央；按「取消」收起後只留頭頂那顆「重新開始」 */
      'body.lmui-popover #lmui-vit{visibility:hidden !important;}',
      '#lmui-death{display:none;position:fixed;left:50%;top:calc(var(--orig-bar-h,0px) + 48px);max-height:calc(100dvh - var(--orig-bar-h,0px) - 48px - var(--m-nav-h,0px) - 4px);overflow:auto;transform:translateX(-50%);z-index:60;width:min(250px,78vw);padding:8px;background:linear-gradient(#24211d,#121110);border:1px solid #57514a;border-radius:3px;box-shadow:0 0 0 1px #000,0 10px 30px rgba(0,0,0,.85);color:#e9e2d4;font-size:15px;text-shadow:0 1px 1px #000;}',
      'body.lmui-battle.lmui-dead:not(.lmui-deathx) #lmui-death,body.lmui-exitwin #lmui-death{display:block;}',
      'html body.lmui-battle.lmui-dead:not(.lmui-deathx) #map-view-panel>.panel-header{display:none !important;}',
      '#lmui-death button{font-family:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;}',
      '.ld-btns{display:flex;flex-direction:column;gap:5px;}',
      '.ld-btns button{height:32px;font-size:16px;font-weight:700;letter-spacing:2px;color:#f1ead9;background:linear-gradient(#4a4741,#2b2925 55%,#22201d);border:1px solid #6b665d;border-radius:2px;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 1px 2px #000;}',
      '.ld-btns button:active{filter:brightness(1.3);}',
      '.ld-stats{margin-top:8px;padding:7px 8px 6px;background:rgba(0,0,0,.35);border:1px solid #3d3933;border-radius:2px;}',
      '.ld-row{display:flex;align-items:center;gap:6px;height:21px;}',
      '.ld-row span{flex:1;color:#cfc6b4;}',
      '.ld-row span::before{content:"◆";margin-right:4px;font-size:12px;color:#6fa8dc;vertical-align:1px;}',
      '.ld-row b{font-weight:600;color:#fff;font-variant-numeric:tabular-nums;}',
      '.ld-look{width:20px;height:18px;padding:0;font-size:13px;line-height:16px;background:#2e2b27;border:1px solid #5a554c;border-radius:2px;}',
      '.ld-items{max-height:90px;overflow:auto;margin:3px 0 2px;padding:3px 6px;background:rgba(0,0,0,.4);border:1px solid #33302b;font-size:14px;}',
      '.ld-items div{display:flex;justify-content:space-between;gap:8px;line-height:18px;}',
      '.ld-items b{font-weight:600;}',
      '.ld-items .ld-none{color:#8d8577;justify-content:center;}',
      '.ld-reset{display:block;margin:6px 0 0;width:64px;height:24px;font-size:14px;font-weight:700;color:#e9e2d4;background:linear-gradient(#45423c,#26241f);border:1px solid #6b665d;border-radius:2px;}',
      /* 取消後：標題列只留「祈求復活」一顆，改名「重新開始」，浮在角色身上（位置由 placeDeadBtn 量） */
      'html body.lmui-battle.lmui-dead.lmui-deathx #map-view-panel>.panel-header{display:block !important;position:fixed !important;left:var(--lmui-dead-x,50%) !important;top:var(--lmui-dead-y,30%) !important;right:auto !important;bottom:auto !important;width:auto !important;height:auto !important;min-height:0 !important;transform:translate(-50%,-100%) !important;z-index:60 !important;padding:0 !important;margin:0 !important;background:none !important;border:0 !important;box-shadow:none !important;}',
      'html body.lmui-battle.lmui-dead.lmui-deathx #map-view-panel>.panel-header>:not(:has(#btn-revive)),html body.lmui-battle.lmui-dead.lmui-deathx #map-view-panel>.panel-header>div>:not(#btn-revive){display:none !important;}',
      'html body.lmui-battle.lmui-dead.lmui-deathx #map-view-panel>.panel-header>div{display:block !important;width:auto !important;}',
      'html body.lmui-battle.lmui-dead.lmui-deathx #btn-revive{display:block !important;flex:none !important;width:auto !important;margin:0 !important;padding:10px 28px !important;font-size:0 !important;line-height:0 !important;white-space:nowrap !important;background:linear-gradient(#e7c56f,#a8822f) !important;border:1px solid #f0d58c !important;border-radius:6px !important;box-shadow:0 0 14px rgba(240,213,140,.55),0 3px 10px rgba(0,0,0,.8) !important;}',
      'html body.lmui-battle.lmui-dead.lmui-deathx #btn-revive::after{content:"重新開始";font-size:17px;line-height:20px;font-weight:700;color:#1d1407;letter-spacing:1px;}',
      /* 地圖面板（上游標題列：回村/瞬移/黑市/地圖選單/復活鈕），點地圖名稱才出現 */
      'body.lmui-battle.lmui-map:not(.lmui-dead) #map-view-panel>.panel-header{display:flex !important;position:fixed !important;top:calc(var(--lmui-mtop) + 8px) !important;left:10px !important;right:10px !important;z-index:60 !important;flex-wrap:wrap !important;gap:8px !important;padding:10px !important;background:rgba(14,12,10,.92) !important;border:1px solid var(--lmui-line) !important;border-radius:6px !important;box-shadow:0 8px 30px rgba(0,0,0,.7) !important;height:auto !important;}',

      /* ── HUD 外框：釘在視窗上（讓開橫幅與底部導覽），本身不吃點擊 ── */
      '#lmui-hud{display:none;position:fixed;left:0;right:0;top:var(--orig-bar-h,0px);bottom:var(--m-nav-h,0px);z-index:50;pointer-events:none;font-family:inherit;color:#eee;text-shadow:0 1px 2px #000,0 0 2px #000;}',
      'body.lmui-battle #lmui-hud{display:block;}',
      '#lmui-hud button{font-family:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;}',
      '#lmui-hud .lmui-hit{pointer-events:auto;}',

      /* 左上：頭像＋數值 */
      '#lmui-tl{position:absolute;top:4px;left:5px;display:flex;gap:5px;align-items:flex-start;}',
      '#lmui-face{width:44px;flex:none;display:flex;flex-direction:column;align-items:center;}',
      /* 第三批（範例圖）：頭像金色雙框 */
      '#lmui-face .pic{width:42px;height:42px;border:2px solid #d8b062;border-radius:3px;background:radial-gradient(circle at 50% 35%,#2a2218,#0a0806);overflow:hidden;box-shadow:inset 0 0 0 1px #2a1c08,inset 0 0 8px rgba(0,0,0,.8),0 0 0 1px #3a280c,0 0 0 2px #9c7535,0 2px 6px #000;}',
      '#lmui-face img{width:100%;height:100%;object-fit:cover;object-position:50% 40%;transform:scale(3.2);transform-origin:50% 36%;}',
      '#lmui-face img.logo{object-fit:contain;object-position:center;transform:none;padding:4px;}',
      '#lmui-face{position:relative;}',
      '#lmui-face .pic{cursor:pointer;}',
      /* 頭像下方：性向（正義／中立／邪惡）兩行——頭像只有 44px 寬，「正義 +32767」一行放不下 */
      '#lmui-face #lmui-align{margin-top:4px;width:48px;padding:0 0 1px;display:flex;flex-direction:column;align-items:center;font-size:11px;line-height:1.2;white-space:nowrap;border:1px solid #9c7535;border-radius:3px;background:linear-gradient(rgba(28,22,14,.92),rgba(10,8,5,.92));box-shadow:inset 0 1px 0 rgba(255,220,150,.15),0 1px 3px #000;}',
      '#lmui-stats{display:flex;flex-direction:column;gap:0;line-height:1.3;padding:1px 22px 2px 9px;margin-left:2px;font-size:13px;position:relative;background:linear-gradient(90deg,rgba(12,9,6,.82),rgba(12,9,6,.6) 70%,rgba(12,9,6,0));}',
      '#lmui-stats::before,#lmui-stats::after{content:"";position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,#c9a050,rgba(201,160,80,.5) 70%,rgba(201,160,80,0));}',
      '#lmui-stats::before{top:0;}#lmui-stats::after{bottom:0;}',
      '#lmui-stats .row{display:flex;gap:9px;align-items:baseline;white-space:nowrap;}',
      '#lmui-stats .k{color:#bdbdbd;margin-right:3px;}',
      '#lmui-stats b{color:#fff;font-weight:600;}',
      '#lmui-align .k{display:none;}#lmui-align b{color:#fff;font-weight:700;}',
      '#lmui-gold b{color:#f5d77b;}',
      /* 角色名字(取了就不能改；沒名字的舊角色顯示灰色「（點此取名）」，點一下取名) */
      '#lmui-name{all:unset;cursor:default;min-width:0;flex-shrink:1;white-space:nowrap;font-size:15px;font-weight:700;color:#fff;text-shadow:0 1px 2px #000;max-width:150px;overflow:hidden;text-overflow:ellipsis;}',
      '#lmui-name.empty{color:#94a3b8;font-weight:400;cursor:pointer;}',
      '#lmui-name-input{width:96px;font-size:15px;padding:1px 4px;border-radius:3px;border:1px solid #d9bf86;background:#020617;color:#fff;}',
      '#lmui-name-ok{margin-left:4px;padding:0 6px;font-weight:700;color:#4ade80;background:rgba(0,0,0,.6);border:1px solid #4ade80;border-radius:3px;}',

      /* 右上：地圖名稱框＋小地圖 */
      '#lmui-tr{position:absolute;top:6px;right:6px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;}',
      /* 地區名（站長：右上角的框拿掉，改成純文字放在等級條上方靠左；點了一樣打開地圖清單） */
      '#lmui-mapname{position:absolute;left:8px;bottom:100%;margin-bottom:5px;z-index:5;display:flex;align-items:baseline;gap:6px;max-width:60%;padding:0;border:0;background:none;color:#f0e2bf;text-shadow:0 1px 2px #000,0 0 3px #000,1px 0 0 #000,-1px 0 0 #000;cursor:pointer;}',
      '#lmui-mapname b{font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#lmui-mapname small{display:none;}',   /* 站長：只放地圖名，不放所屬地區 */
      '#lmui-mini{display:none !important;position:relative;width:92px;height:92px;border-radius:50%;padding:0;border:1px solid rgba(255,255,255,.22);background:radial-gradient(circle,rgba(30,30,30,.35),rgba(0,0,0,.6));box-shadow:0 0 0 1px rgba(0,0,0,.6),inset 0 0 14px rgba(0,0,0,.7);overflow:hidden;}',
      '#lmui-mini i{position:absolute;width:5px;height:5px;margin:-2.5px 0 0 -2.5px;border-radius:50%;background:#ef4444;box-shadow:0 0 4px #ef4444;}',
      '#lmui-mini i.me{width:7px;height:7px;margin:-3.5px 0 0 -3.5px;background:#fef3c7;box-shadow:0 0 5px #fde68a;}',
      '#lmui-mini i.boss{width:8px;height:8px;margin:-4px 0 0 -4px;background:#f97316;box-shadow:0 0 6px #f97316;}',
      '#lmui-mini .moon{position:absolute;right:10px;top:6px;font-size:12px;opacity:.8;}',

      /* 半透明圓鈕（天堂M那種玻璃感） */
      '.lmui-round{position:absolute;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:radial-gradient(circle at 50% 40%,rgba(60,60,60,.35),rgba(0,0,0,.45) 75%);color:rgba(255,255,255,.85);box-shadow:inset 0 0 14px rgba(0,0,0,.55),0 1px 3px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:0;font-weight:600;}',
      '.lmui-round:active{background:radial-gradient(circle at 50% 40%,rgba(120,110,90,.45),rgba(0,0,0,.45) 75%);}',
      /* AUTO：圓鈕壓在血條正中；開著＝紅球＋外圈光環，關著＝暗灰鈕 */
      '#lmui-auto{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:4;width:44px;height:44px;padding:0;border-radius:50%;border:2px solid #f0cd7a;background:radial-gradient(circle at 45% 35%,#ff6b5b,#c81e1e 50%,#5a0606 85%);color:#fff3d6;box-shadow:inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -4px 8px rgba(0,0,0,.45),0 0 0 2px #4a3110,0 0 0 3px #b8893a,0 1px 5px #000;cursor:pointer;display:flex;align-items:center;justify-content:center;}',
      '#lmui-auto svg{width:100%;height:100%;display:block;filter:drop-shadow(0 1px 1px rgba(0,0,0,.8));pointer-events:none;}',
      /* 光環只動 opacity（合成層就能做，不重算版面）；省電「關動畫」時停在全亮 */
      '#lmui-auto::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid rgba(255,190,120,.95);box-shadow:0 0 8px 3px rgba(255,70,40,.85),inset 0 0 6px rgba(255,90,50,.7);pointer-events:none;animation:lmuiAutoGlow 1.4s ease-in-out infinite alternate;}',
      '@keyframes lmuiAutoGlow{from{opacity:1;}to{opacity:.45;}}',
      '#lmui-auto:active{filter:brightness(1.25);}',
      '#lmui-auto.off{border-color:#9a9184;background:radial-gradient(circle at 45% 35%,#4b4b4b,#262626 55%,#0d0d0d 90%);color:#e5e5e5;}',
      '#lmui-auto.off::after{content:none;}',
      /* AUTO 開著時從 AUTO 圓章往左上、右上彈出「掛機紀錄」「掛機設定」（站長）；暫停收回。放在地圖名那排上面，不壓到地圖名 */
      '#lmui-autopop{position:absolute;left:50%;bottom:calc(100% + 30px);width:0;height:0;z-index:5;}',
      '#lmui-autopop button{position:absolute;bottom:0;left:-34px;width:68px;height:28px;padding:0;border-radius:14px;border:1px solid #c9a55a;background:linear-gradient(#4a3418,#1c1309);color:#f6e7bf;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,230,170,.25);text-shadow:0 1px 1px #000;cursor:pointer;opacity:0;pointer-events:none;transform:translate(0,40px) scale(.2);transition:transform .25s ease-out,opacity .18s;}',
      '#lmui-autopop.on button{opacity:1;pointer-events:auto;}',
      '#lmui-autopop.on button.l{transform:translate(0,0) scale(1);}',
      '#lmui-autopop button:active{filter:brightness(1.3);}',

      /* 提示訊息（afk-toast）：放在戰鬥畫面正中間，不壓到血條／聊天框 */
      'html body.lmui-battle #m-toast-wrap{top:calc((var(--lmui-bar) + var(--lmui-mtop) - var(--lmui-vit)) / 2);}',

      /* ── 下方堆疊：血條 → 快捷列 → 聊天框 ── */
      '#lmui-vit{position:absolute;left:0;right:0;top:calc(var(--lmui-mtop) - var(--lmui-vit) - var(--orig-bar-h,0px));height:var(--lmui-vit);padding:3px 4px 0;display:flex;flex-direction:column;justify-content:center;gap:2px;background:none;pointer-events:auto;z-index:3;}',   /* 去背（站長）：後面就是場景 */
      /* 精簡版面留一排快捷列在聊天輸入列上面（2026-10-16 站長：原本整排收掉＝打怪時快捷鍵不能用）；切成兩排時再高一排 */
      'body.lmui-compact{--lmui-stack:94px;--lmui-mtop:calc(100dvh - var(--m-nav-h,0px) - 94px - var(--lmui-btns));}',
      'body.lmui-compact.lmui-hot2{--lmui-stack:134px;--lmui-mtop:calc(100dvh - var(--m-nav-h,0px) - 134px - var(--lmui-btns));}',
      'body.lmui-compact .lmui-slot{max-height:44px;}',
      /* 精簡版面：聊天輸入列也去背（站長），場景一路鋪到工具列上緣；怪物／角色站在血條上緣（--lmui-stand＝場景底下被 HUD 蓋住的高度） */
      'body{--lmui-stand:var(--lmui-vit);}',
      'body.lmui-compact{--lmui-stand:calc(var(--lmui-vit) + var(--lmui-stack));}',
      'html body.lmui-compact.lmui-battle #col-center{height:calc(100dvh - var(--orig-bar-h,0px) - var(--m-nav-h,0px)) !important;}',
      'body.lmui-compact #lmui-bottom{background:none !important;border-top:0 !important;box-shadow:none !important;}',
      'body.lmui-compact #lmui-tabs,body.lmui-compact #lmui-lines{display:none !important;}',
      'html body.lmui-compact.lmui-battle #lmui-bottom{display:flex !important;}',   /* 村莊預設會藏下方聊天框（給 NPC 卡片），精簡時只留輸入列 */
      'html body.lmui-compact.lmui-town #afk-npclist{display:none !important;}',
      '#lmui-bottom{position:absolute;left:0;right:0;bottom:0;height:var(--lmui-stack);display:flex;flex-direction:column;gap:4px;padding:6px 4px 4px;background:linear-gradient(#1a1612,#0b0907);border-top:1px solid #4a3f30;box-shadow:0 -6px 14px rgba(0,0,0,.65);}',
      /* HP/MP：經典天堂那種「左右兩條＋中間圓章」的框。框借上游的 assets/character/血條底圖.png（334×34，桌機狀態面板同一張），
         調成銅色（只濾 ::before 那層，血條本身不受影響）；血條位置照上游 .status-vitals-row 的比例（左 3.3%／右 55.5%、寬 41.2%）。 */
      '#lmui-bars{position:relative;flex:none;width:100%;aspect-ratio:334/34;max-height:40px;}',
      /* 夥伴列：寵物(項圈圖)／召喚(召喚術圖)／迷魅(迷魅術圖)，一隻一格，壓在血條上緣；點一下看狀態 */
      '#lmui-comp{position:absolute;left:4px;bottom:100%;margin-bottom:28px;display:flex;gap:4px;z-index:5;}',
      '.lmui-cp{position:relative;width:28px;height:28px;padding:0;border:1px solid var(--lmui-line);border-radius:4px;background:rgba(0,0,0,.6);box-shadow:0 1px 3px #000;cursor:pointer;}',
      '.lmui-cp img{width:100%;height:100%;object-fit:contain;display:block;}',
      '.lmui-cp i{position:absolute;left:1px;right:1px;bottom:1px;height:3px;background:#3b0a0a;}',
      '.lmui-cp i b{display:block;height:100%;background:#ef4444;}',
      '.lmui-cp.down{filter:grayscale(1);opacity:.55;}',
      '.lmui-cp.on{border-color:#fde68a;box-shadow:0 0 6px #fde68a;}',
      '#lmui-comp-pop{position:absolute;left:4px;bottom:calc(100% + 61px);min-width:150px;padding:6px 9px;background:rgba(12,9,6,.94);border:1px solid var(--lmui-line);border-radius:6px;font-size:14px;line-height:1.6;color:#eee;z-index:6;white-space:nowrap;}',
      '#lmui-comp-pop.hidden{display:none;}',
      '#lmui-comp-pop .t{color:#fde68a;font-weight:700;}',
      '#lmui-bars::before{content:"";position:absolute;inset:0;background:url("assets/character/血條底圖.png") center/100% 100% no-repeat;filter:sepia(1) saturate(1.6) hue-rotate(-12deg) brightness(.72) contrast(1.15);z-index:0;pointer-events:none;}',
      '.lmui-bar{position:absolute;top:50%;width:41.2%;height:46%;transform:translateY(-50%);background:#100606;border-radius:2px;overflow:hidden;box-shadow:inset 0 1px 3px #000;z-index:1;}',
      '#lmui-hp{left:3.3%;}#lmui-mp{left:55.5%;}',
      '.lmui-bar i{position:absolute;left:0;top:0;bottom:0;width:0;transition:width .25s;}',
      '#lmui-hp i{background:linear-gradient(#ff7a6a,#c81e1e 35%,#7a0b0b 75%,#4a0505);}',
      '#lmui-mp i{background:linear-gradient(#7aa8ff,#2453c8 35%,#10307a 75%,#081a4a);}',
      '.lmui-bar span{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;font:700 12px/1 Consolas,"Courier New",monospace;letter-spacing:.5px;color:#fff;text-shadow:1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;}',
      '#lmui-hot{display:grid;grid-template-columns:repeat(' + HOT_ROW + ',1fr) 24px;gap:3px;flex:none;}',
      '#lmui-hot[data-mode="0"] .lmui-slot.r2,#lmui-hot[data-mode="1"] .lmui-slot.r1{display:none;}',
      '#lmui-hot[data-mode="2"] .lmui-slot{max-height:40px;}',   /* 兩排時矮一點，聊天框才不會被擠光 */
      '#lmui-hot[data-mode="2"] #lmui-hotmode{grid-row:1 / span 2;max-height:none;}',
      '#lmui-hotmode{grid-column:' + (HOT_ROW + 1) + ';grid-row:1;padding:0;border:1px solid #5d4c33;border-radius:4px;background:linear-gradient(#2a2119,#0f0c09);color:#f0e2bf;font-size:13px;line-height:1.1;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;max-height:54px;}',
      '#lmui-hotmode b{font-size:15px;}',
      '#lmui-hotpick{position:fixed;inset:0;z-index:120;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:12px;}',
      '#lmui-hotpick .box{width:100%;max-width:380px;max-height:80vh;display:flex;flex-direction:column;background:#0f0c09;border:1px solid #b7791f;border-radius:10px;overflow:hidden;color:#eee;}',
      '#lmui-hotpick .hd{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #4a3f30;color:#fbbf24;font-weight:700;font-size:17px;}',
      '#lmui-hotpick .hd button{background:none;border:0;color:#aaa;font-size:19px;cursor:pointer;}',
      '#lmui-hotpick .bd,#lmui-mapdrops .bd,#lmui-huntlog .bd{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:8px;display:flex;flex-direction:column;gap:6px;}',
      '#lmui-hotpick .tabs{display:flex;gap:4px;padding:6px 8px 0;}',
      '#lmui-hotpick .tabs button{flex:1;padding:7px;border:1px solid #5a4630;border-radius:6px 6px 0 0;background:#17120c;color:#b9ad98;font-weight:700;font-size:14px;cursor:pointer;}',
      '#lmui-hotpick .tabs button.on{background:#3a2c1a;color:#fde68a;border-color:#b7791f;}',
      '#lmui-mapdrops,#lmui-huntlog{position:fixed;inset:0;z-index:120;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:12px;}',
      '#lmui-mapdrops .box,#lmui-huntlog .box{width:100%;max-width:420px;max-height:84vh;display:flex;flex-direction:column;background:#0f0c09;border:1px solid #b7791f;border-radius:10px;overflow:hidden;color:#eee;}',
      '#lmui-mapdrops .hd,#lmui-huntlog .hd{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #4a3f30;color:#fbbf24;font-weight:700;font-size:16px;}',
      '#lmui-mapdrops .hd button,#lmui-huntlog .hd button{background:none;border:0;color:#aaa;font-size:18px;cursor:pointer;}',
      '#lmui-huntlog .mi-stats{grid-template-columns:repeat(2,1fr);gap:6px 16px;font-size:15px;padding:4px 2px 8px;margin:0;}',
      '#lmui-mapdrops .md-mob{border:1px solid #4a3f30;border-radius:8px;background:#17120c;padding:8px;}',
      '#lmui-mapdrops .md-mob .mi-stats{margin:4px 0;}',
      '#lmui-hotpick .sec{color:#d9bf86;font-size:14px;margin-top:4px;}',
      '#lmui-hotpick .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px;}',
      '#lmui-hotpick .opt{display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid #4a3f30;border-radius:6px;background:#1a1612;color:#eee;font-size:15px;text-align:left;cursor:pointer;min-width:0;}',
      '#lmui-hotpick .opt.on{border-color:#fde68a;box-shadow:0 0 6px rgba(253,230,138,.6);}',
      '#lmui-hotpick .opt img{width:26px;height:26px;object-fit:contain;flex:none;}',
      '#lmui-hotpick .opt span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#lmui-hotpick .ft{display:flex;gap:6px;padding:8px;border-top:1px solid #4a3f30;}',
      '#lmui-hotpick .ft button{flex:1;padding:8px;border:1px solid #6b5636;border-radius:6px;background:#1a1612;color:#f0e2bf;font-weight:700;cursor:pointer;}',
      '.lmui-slot{position:relative;aspect-ratio:1;max-height:54px;border:1px solid #5d4c33;background:linear-gradient(#1d1813,#0a0806);box-shadow:inset 0 0 6px #000;padding:0;display:flex;align-items:center;justify-content:center;}',
      '.lmui-slot .fk{position:absolute;left:1px;top:1px;padding:0 3px;font-size:11px;line-height:11px;color:#f0e2bf;background:rgba(0,0,0,.7);border:1px solid #6b5636;border-radius:6px;z-index:2;}',
      '.lmui-slot img{width:86%;height:86%;object-fit:contain;}',
      '.lmui-slot .n{position:absolute;right:2px;bottom:0;font-size:12px;font-weight:700;color:#fff;z-index:2;}',
      '.lmui-slot.is-off img{opacity:.4;}',
      '.lmui-slot .cd{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.65);color:#fca5a5;font-size:15px;font-weight:700;}',
      '.lmui-slot.is-cd .cd{display:flex;}',
      '#lmui-chat{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;background:rgba(0,0,0,.5);overflow:hidden;}',
      /* 分頁兩排：上排＝系統／戰鬥／掉落（遊戲訊息），下排＝一般／世界／隊伍／血盟（聊天頻道，之後接線上版） */
      '#lmui-tabs{display:flex;flex-direction:column;gap:2px;padding:2px 2px 0;flex:none;}',
      '#lmui-tabs .row{display:flex;gap:2px;align-items:stretch;}',
      '#lmui-tabs button{flex:1;padding:3px 0;font-size:15px;color:#c9b88f;background:linear-gradient(#3b3022,#1c160e);border:1px solid #4d3e29;border-radius:2px;}',
      '#lmui-tabs button.on{color:#fff6dc;background:linear-gradient(#7a5f35,#3f2f18);border-color:#b8955a;}',
      '#lmui-tabs .more{flex:0 0 22px;}',
      '#lmui-tabs .petflt{display:none;flex:0 0 44px;font-size:13px;color:#8d7c5c;}',
      'body.lmui-chat-combat #lmui-tabs .petflt{display:block;}',
      '#lmui-tabs .petflt.on{color:#fff6dc;border-color:#b8955a;background:linear-gradient(#5a4428,#2c2214);}',
      /* ▲ 放大：聊天框吃掉整個下方面板（血條/快捷列先收起） */
      'body.lmui-chatbig #lmui-hot{display:none !important;}',   /* 血條在固定狀態列裡，放大聊天框時不收 */
      'body.lmui-chatbig #lmui-tabs .more{color:#fff6dc;border-color:#b8955a;}',
      '#lmui-lines{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:2px 5px;}',
      '#lmui-lines>*{margin:0 !important;padding:0 !important;font-size:13px !important;line-height:1.4 !important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:none !important;border:0 !important;}',
      '#lmui-input{display:flex;gap:4px;align-items:center;padding:2px 3px 3px;flex:none;}',
      '#lmui-ch{flex:none;padding:3px 2px;border:1px solid #4d3e29;background:#1c160e;color:#e8d7b0;font-size:16px;font-family:inherit;border-radius:2px;outline:none;}',   /* 16px：iOS 小於 16px 一點就整頁放大 */
      '#lmui-lines .lmui-ch-line{white-space:normal !important;}',
      '.lmui-ch-say .lmui-ch-msg{color:#f1f1f1;}.lmui-ch-party .lmui-ch-msg{color:#86efac;}.lmui-ch-clan .lmui-ch-msg{color:#93c5fd;}',
      '#lmui-say{flex:1;min-width:0;padding:4px 8px;border:1px solid #3d3326;background:rgba(0,0,0,.6);color:#eee;font-size:17px;line-height:1.1;font-family:inherit;outline:none;}',   /* 16px：iOS 小於 16px 的輸入框一聚焦就整頁放大 */
      '#lmui-say::placeholder{color:#7d7058;font-size:14px;}',
      '#lmui-send{flex:none;padding:3px 10px;border:1px solid #2563eb;background:linear-gradient(#1e3a8a,#172554);color:#dbeafe;font-size:13px;}',
      /* 戰鬥地圖裡不用 afk-mobile 的完整日誌面板（聊天框已取代）；村莊沒有聊天框，照舊用面板 */
      'body.lmui-battle #m-log-sheet{display:none !important;}',
      /* 經驗：導覽列正上方一條細線＋百分比 */
      /* 經驗條：天堂M樣式——深色膠囊＋銀色外框，左半「等級 N」、右半百分比 */
      /* 經驗條（範例圖）：金框、兩端箭頭；底下金色進度 */
      '#lmui-exp{position:relative;flex:none;height:17px;margin:0 2px;display:grid;grid-template-columns:1fr 1fr;align-items:center;}',   /* ⚠️ 不能加 filter：iPhone 會把整條（含文字）先畫成點陣圖再套濾鏡，字就糊了 */
      '#lmui-exp::before{content:"";position:absolute;inset:0;background:linear-gradient(#f3d58a,#a77a2c 45%,#6b4a17 55%,#d6ac57);clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 50%,calc(100% - 10px) 100%,10px 100%,0 50%);}',
      '#lmui-exp::after{content:"";position:absolute;inset:2px 3px;background:linear-gradient(#120d07,#24190d);clip-path:polygon(8px 0,calc(100% - 8px) 0,100% 50%,calc(100% - 8px) 100%,8px 100%,0 50%);}',
      '#lmui-exp i{position:absolute;left:11px;top:3px;bottom:3px;width:0;max-width:calc(100% - 22px);z-index:1;background:linear-gradient(#d9b45a,#a37624 50%,#6e4a12);}',   /* 進度色壓暗一點，白字才看得清楚 */
      '#lmui-exp span{position:relative;z-index:2;display:flex;align-items:baseline;justify-content:center;gap:8px;font-weight:700;font-size:12px;line-height:1;color:#fff;text-shadow:1px 0 0 #000,-1px 0 0 #000,0 1px 0 #000,0 -1px 0 #000,1px 1px 0 #000,-1px -1px 0 #000;letter-spacing:.5px;}',
      '#lmui-exp em{font-style:normal;font-weight:inherit;color:inherit;text-shadow:inherit;letter-spacing:inherit;}',   /* 「等級」字與數字同色同樣式 */

      /* ── 右欄面板（能力/魔法/背包/設定）拉高：從頭像列下方一路到工具列，蓋住戰鬥畫面下半與血條 ──
         #game-screen（捲動區）上緣改到頭像列下方；#col-center（戰鬥）照跑，只用 clip-path 裁成頭像列那一條當底圖（不動版面，切回狩獵場不會重排）。
         #col-right 抬到 #col-center（z:1）之上；血條（#lmui-hud 裡、z 比整個 #game-screen 高）直接收起。 */
      ':root{--lmui-ptop:calc(var(--orig-bar-h,0px) + 90px);--lmui-ptabs-h:40px;--lmui-whead-h:36px;}',
      /* 魔法／背包做成視窗（站長）：面板最上面一條標題列＋右上角關閉鈕，內容（分頁列、魔法書、背包格）整片往下讓 */
      '#lmui-whead{display:none;position:fixed;left:6px;right:6px;top:var(--lmui-ptop);height:var(--lmui-whead-h);box-sizing:border-box;z-index:9551;align-items:center;justify-content:center;background:linear-gradient(#4a4038,#221d19);border:1px solid #6b5a48;border-bottom-color:#2a241e;border-radius:6px 6px 0 0;box-shadow:0 -2px 6px rgba(0,0,0,.6);}',
      '#lmui-whead b{font-size:17px;font-weight:700;letter-spacing:.3em;color:#f1e3c4;text-shadow:0 1px 2px #000;}',
      '#lmui-whead button{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:32px;height:28px;padding:0;border:1px solid #8a6f52;border-radius:4px;background:linear-gradient(#6a3026,#2e140f);color:#fbe3d2;font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation;}',
      '#lmui-whead button:active{background:linear-gradient(#8a3e30,#46201a);}',
      'html body.lmui-battle.lmui-tall.lmui-whead #lmui-whead{display:flex;}',
      /* 視窗＝浮在戰鬥畫面上（站長：開視窗戰鬥畫面不要跳、背景不要變暗、左右不要漏底色）：
         戰鬥畫面大小一律不動（tick 開視窗時照樣維持精簡版面），整片留在下層、不裁切；視窗從頭像列下方到聊天輸入列上方。
         視窗內容（#col-right）自己變成固定位置的捲動框：捲動只在視窗裡，不會捲到場景上，外層 #game-screen 不捲。
         ⚠️ 不可以改用「場景蓋在上面、clip-path 多邊形挖洞露出視窗」：手機判斷手指在滑哪一塊時不看非長方形的裁切，
            整片都當成場景 → 視窗完全滑不動（踩過）。
         外框＝#lmui-wborder（蓋在內容上面，內容再長下緣的框也看得到）；#lmui-wframe 不畫東西，只給魔法書量視窗下緣 */
      /* 視窗下緣＝精簡版面「快捷列＋聊天輸入列」上方 6px（94px＝body.lmui-compact 的 --lmui-stack；兩排快捷列 134px）。
         原本只扣聊天輸入列 46px，精簡版面加了快捷列後背包最後一排被快捷列蓋住（站長 2026-10-16） */
      ':root{--lmui-wbot:calc(100dvh - var(--m-nav-h,0px) - 94px - var(--lmui-btns) - 6px);}',
      'body.lmui-hot2{--lmui-wbot:calc(100dvh - var(--m-nav-h,0px) - 134px - var(--lmui-btns) - 6px);}',
      'body.lmui-town{--lmui-wbot:calc(100dvh - var(--m-nav-h,0px) - var(--lmui-btns) - 6px);}',   /* 村莊下方沒有聊天輸入列：視窗拉到工具列上方 */   /* 視窗下緣＝精簡版面聊天輸入列上方 6px；寫死不跟 --lmui-mtop：角色死亡會切掉精簡版面，視窗不可以跟著縮 */
      'html body.lmui-battle.lmui-tall.lmui-whead #col-center{clip-path:none;z-index:1;}',
      'html body.lmui-battle.lmui-tall.lmui-whead #game-screen{overflow:hidden !important;}',
      'html body.lmui-battle.lmui-tall.lmui-whead #col-right{position:fixed !important;left:6px !important;right:6px !important;top:calc(var(--lmui-ptop) + var(--lmui-whead-h)) !important;bottom:auto !important;height:calc(var(--lmui-wbot) - var(--lmui-ptop) - var(--lmui-whead-h)) !important;min-height:0 !important;max-height:none !important;width:auto !important;max-width:none !important;margin:0 !important;padding:6px 6px 8px !important;box-sizing:border-box !important;overflow-x:hidden !important;overflow-y:auto !important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;background:linear-gradient(#1f1813,#120d09);border-radius:0 0 6px 6px;z-index:2;}',
      'html body.lmui-battle.lmui-tall.lmui-whead.lmui-ptabs #col-right{top:calc(var(--lmui-ptop) + var(--lmui-whead-h) + var(--lmui-ptabs-h)) !important;height:calc(var(--lmui-wbot) - var(--lmui-ptop) - var(--lmui-whead-h) - var(--lmui-ptabs-h)) !important;}',
      '#lmui-wframe,#lmui-wborder{display:none;position:fixed;left:6px;right:6px;top:var(--lmui-ptop);height:calc(var(--lmui-wbot) - var(--lmui-ptop));box-sizing:border-box;border-radius:6px;pointer-events:none;}',
      '#lmui-wframe{z-index:-1;}',
      '#lmui-wborder{z-index:9549;border:1px solid #6b5a48;box-shadow:0 2px 8px rgba(0,0,0,.7);}',
      'html body.lmui-battle.lmui-tall.lmui-whead :is(#lmui-wframe,#lmui-wborder){display:block;}',
      'html body.lmui-battle.lmui-whead #lmui-bagtabs{top:calc(var(--lmui-ptop) + var(--lmui-whead-h));border-radius:0;border-top:0;}',
      /* 設定頁會捲：往上捲時補的固定上框（#lmui-pcap）改接在標題列下面；彈窗讓位也量它，一起讓開標題列 */
      'html body.lmui-battle.lmui-whead #lmui-pcap{top:calc(var(--lmui-ptop) + var(--lmui-whead-h));}',
      /* ⚠️ #game-screen 本身要從畫面頂端開始、用 padding 把內容推到頭像列下方，不能直接把 top 拉低：
         iPhone 會把「可捲動容器」裡的 fixed 子元素裁在容器範圍內 → 內容一長到要捲（設定/背包/能力），#col-center 那條場景整個被裁掉、只剩底色
         （魔法頁不用捲所以沒事）。內容往上捲時改由 #col-center（z:3，已裁成頭像列那一條）蓋住，不會捲進場景區。 */
      'html body.lmui-battle.lmui-tall #game-screen{top:0 !important;padding:calc(var(--lmui-ptop) + 6px) 6px calc(var(--m-nav-h,0px) + 6px) !important;}',
      'html body.lmui-battle.lmui-tall.lmui-ptabs #game-screen{padding-top:calc(var(--lmui-ptop) + var(--lmui-ptabs-h) + 6px) !important;}',
      'html body.lmui-battle.lmui-tall #col-center{clip-path:inset(0 0 calc(100% - var(--lmui-ptop) + var(--orig-bar-h,0px)) 0);z-index:3;}',
      'html body.lmui-battle.lmui-tall #col-right{position:relative;z-index:2;}',
      /* 魔法頁：魔法書自己會捲、高度量到剛好貼底部選單 → 外層不捲（不然 iPhone 回彈時被拉動，整本書跟著往上跑、上框不見） */
      'html body.lmui-battle.lmui-tall.lmui-sktab #game-screen{overflow-y:hidden !important;}',
      /* 往上捲時頂端那條固定上框（樣式同 #tab-content-panel 的框）；上面 6px 用底色蓋住捲上來的內容 */
      '#lmui-pcap{visibility:hidden;position:fixed;left:6px;right:6px;top:var(--lmui-ptop);height:14px;z-index:9550;pointer-events:none;}',
      '#lmui-pcap::after{content:"";position:absolute;left:0;right:0;top:6px;bottom:0;box-sizing:border-box;border:2px solid #4a3c29;border-bottom:0;border-radius:6px 6px 0 0;background:#18120d;box-shadow:inset 0 1px 0 rgba(255,220,150,.06);}',
      'body.lmui-battle.lmui-tall.lmui-pscroll:not(.lmui-ptabs):not(.lmui-sktab) #lmui-pcap{visibility:visible;}',
      'body.lmui-battle.lmui-tall #lmui-vit{display:none !important;}',
      /* 開著功能頁（上方只露出一條場景）時，iPhone 不會畫「被裁切的 fixed 容器裡、用 multiply 混色的背景圖」→ 狩獵場上方變成一片黑
         （村莊用的 town-view 沒有混色所以正常）。這時改成不混色、另蓋一層半透明黑來壓暗，看起來跟混色差不多。 */
      /*   視窗模式（lmui-whead）場景沒被裁切，照原本的混色就好，不套這兩條 */
      'html body.lmui-battle.lmui-tall:not(.lmui-whead) #battle-view{background-blend-mode:normal !important;background-color:transparent !important;position:relative;}',
      /* 只蓋在靜態背景上（模擬原本的混色亮度）；狩獵區動態地圖本來就沒混色，蓋了反而整片變暗（站長回報視窗背景變暗） */
      'html body.lmui-battle.lmui-tall:not(.lmui-whead) #battle-view:not(.afk-hm)::after{content:"";position:absolute;inset:0;background:rgba(0,0,0,.62);pointer-events:none;z-index:0;}',
      /* 面板上方的分頁列（背包：全部/裝備/道具/自動賣出；能力：能力/裝備/…）：樣式＝狩獵場的分頁（.lm-tabs），釘在頭像列正下方 */
      '#lmui-bagtabs{display:none;position:fixed;left:6px;right:6px;top:var(--lmui-ptop);height:var(--lmui-ptabs-h);box-sizing:border-box;z-index:9550;padding:3px 2px;background:linear-gradient(#1a1612,#0b0907);border:1px solid #4a3f30;border-radius:3px 3px 0 0;}',
      'body.lmui-ptabs #lmui-bagtabs{display:flex;}',
      'body.lmui-ptabs:not(.lmui-battle) #lmui-bagtabs{top:var(--orig-bar-h,0px);}',
      'html body.lmui.lmui-ptabs:not(.lmui-battle) #col-right{padding-top:var(--lmui-ptabs-h);}',
      /* ── 背包：武器/防具/道具三個核心分頁攤平成同一片方格（分類由上方分頁列決定），每格是獨立的框（同魔法分頁的技能格） ──
         作法：#tab-content-panel 當 grid，三個分頁與其中的 shell/viewport 都 display:contents，物品格直接成為 grid 的格子；
         核心每次重繪只換掉分頁裡面的東西，這層攤平不受影響。補空格放自己的 #lmui-bagfill（排在最後）。
         壓過 afk-invlist 的條列式（body.afk-invlist … !important）→ 選擇器前面多掛 html + #tab-content-panel 拉高特異度。 */
      'body.lmui #col-right .tab-bar{display:none !important;}',
      /* 背包上方的搜尋列（afk-itemsearch）與快速廢品/快速強化工具列、整理鈕、上下捲動鈕：玩家要求拿掉（整理＝再點一次「全部」） */
      'html body.lmui-bag #afk-isearch{display:none !important;}',
      'html body.lmui-bag-grid #tab-content-panel{display:grid !important;grid-template-columns:repeat(5,minmax(0,1fr)) !important;grid-auto-rows:auto !important;gap:6px !important;align-content:start !important;padding:6px !important;height:auto !important;overflow:visible !important;}',
      'html body.lmui-bag-grid #tab-content-panel>:not(#tab-items):not(#tab-weapons):not(#tab-armors):not(#lmui-bagfill){display:none !important;}',
      'html body.lmui-bag-grid #tab-content-panel :is(#tab-items,#tab-weapons,#tab-armors,#lmui-bagfill),html body.lmui-bag-grid #tab-content-panel .classic-inventory-shell,html body.lmui-bag-grid #tab-content-panel .classic-inventory-viewport{display:contents !important;}',
      'html body.lmui-cat-weapon #tab-content-panel #tab-items,html body.lmui-cat-weapon #tab-content-panel #tab-armors,html body.lmui-cat-armor #tab-content-panel #tab-items,html body.lmui-cat-armor #tab-content-panel #tab-weapons,html body.lmui-cat-item #tab-content-panel #tab-weapons,html body.lmui-cat-item #tab-content-panel #tab-armors{display:none !important;}',
      'html body.lmui-bag-grid #tab-content-panel :is(.classic-list-toolbar,.classic-inventory-scroll,.classic-sort-wrap,.classic-grid-empty){display:none !important;}',
      '#lmui-bagfill{display:none;}',
      'html body.lmui-bag #tab-weapons .list-item{order:1;}html body.lmui-bag #tab-armors .list-item{order:2;}html body.lmui-bag #tab-items .list-item{order:3;}html body.lmui-bag #lmui-bagfill>.lmui-empty{order:4;}',
      'html body.lmui-bag #tab-content-panel .classic-inventory-viewport>.list-item,html body.lmui-bag #tab-content-panel #lmui-bagfill>.lmui-empty{position:relative;aspect-ratio:1 !important;width:auto !important;height:auto !important;min-height:0 !important;margin:0 !important;padding:0 !important;border:1px solid #6b5636 !important;border-radius:4px !important;background:linear-gradient(#2a241c,#14110d) !important;box-shadow:inset 0 0 0 1px rgba(0,0,0,.8),0 1px 2px #000 !important;display:flex !important;align-items:center !important;justify-content:center !important;overflow:hidden !important;contain-intrinsic-size:auto 70px;}',
      'html body.lmui-bag #tab-content-panel #lmui-bagfill>.lmui-empty{border-color:#2e271e !important;background:#0d0b09 !important;box-shadow:inset 0 0 6px #000 !important;}',
      'html body.lmui-bag #tab-content-panel .classic-inventory-viewport>.list-item:hover{background:linear-gradient(#3a3226,#1c1712) !important;}',
      'html body.lmui-bag #tab-content-panel .classic-inventory-viewport>.list-item.bg-red-950\\/40{background:linear-gradient(#3a1016,#1c070a) !important;border-color:#6b2a2a !important;}',
      'html body.lmui-bag #tab-content-panel .classic-inventory-viewport>.list-item:has(.classic-item-flags .text-red-500){background:linear-gradient(#3a1016,#1c070a) !important;border-color:#6b2a2a !important;}',
      'html body.lmui-bag #tab-content-panel .classic-item-main{width:100% !important;height:100% !important;display:flex !important;align-items:center !important;justify-content:center !important;gap:0 !important;flex:1 1 auto;}',
      'html body.lmui-bag #tab-content-panel .classic-name-box{display:none !important;}',
      'html body.lmui-bag #tab-content-panel .classic-icon-box{position:static !important;width:66% !important;height:66% !important;flex:0 0 auto !important;}',
      'html body.lmui-bag #tab-content-panel .classic-icon-box img{width:100% !important;height:100% !important;object-fit:contain;filter:drop-shadow(0 1px 1px #000);}',
      /* 角落數字（數量金色/強化藍色，上游配色）：afk-invlist 條列式把它藏了（數量寫在名稱裡），方格只剩圖示，要叫回來 */
      'html body.lmui-bag #tab-content-panel .classic-inventory-viewport>.list-item .classic-icon-corner-value{display:block !important;position:absolute !important;right:3px !important;bottom:2px !important;left:auto !important;top:auto !important;font-size:14px !important;background:none !important;}',
      /* 強化值改放左上角、字放大（站長 2026-10-15）；數量仍在右下 */
      'html body.lmui-bag #tab-content-panel .classic-inventory-viewport>.list-item .classic-icon-corner-value.is-enhance{left:3px !important;top:2px !important;right:auto !important;bottom:auto !important;font-size:17px !important;}',
      'html body.lmui-bag #tab-content-panel .classic-inventory-viewport>.list-item .classic-icon-corner-value.is-enhance.with-eq{left:22px !important;}',
      /* 勾選框等其他子元素（快速強化/廢品模式）縮到右上角 */
      'html body.lmui-bag #tab-content-panel .classic-inventory-viewport>.list-item>:not(.classic-item-main){position:absolute !important;top:2px;right:2px;transform:scale(.85);transform-origin:top right;}',
      /* ── 背包「自動賣出」分類：自動賣出清單（下拉選背包裡的道具＋新增；每列 圖示／名稱／點此移除） ── */
      '#lmui-ashost{display:none;}',
      'html body.lmui-cat-as #tab-content-panel>:not(#lmui-ashost){display:none !important;}',
      '#lmui-bagtabs .lmui-tabicon{margin-left:4px;font-size:.9em;opacity:.8;}',
      'html body.lmui-cat-as #tab-content-panel #lmui-ashost{display:block;}',
      '.lmas{display:flex;flex-direction:column;gap:8px;padding:8px 6px;}',
      '.lmas-add{display:flex;gap:8px;align-items:center;}',
      '.lmas-add select{flex:1 1 auto;min-width:0;height:44px;padding:0 10px;border:1px solid #5a4630;border-radius:6px;background:#0e0b09;color:#f1e6cf;font-size:17px;font-family:inherit;}',
      '.lmas-add button{flex:none;height:44px;padding:0 18px;border:1px solid #d9b25c;border-radius:8px;background:linear-gradient(#c49a46,#8a6424);color:#fff4d6;font-size:17px;font-weight:700;}',
      '.lmas-add button:disabled{opacity:.45;}',
      '.lmas-row{display:flex;align-items:center;gap:12px;padding:8px 12px;border:1px solid #4a3f30;border-radius:8px;background:#1a1612;}',
      '.lmas-ico{flex:none;width:44px;height:44px;display:flex;align-items:center;justify-content:center;}',
      '.lmas-ico img{max-width:44px;max-height:44px;object-fit:contain;}',
      '.lmas-name{flex:1 1 auto;min-width:0;font-size:20px;color:#f1e6cf;overflow-wrap:anywhere;}',
      '.lmas-del{flex:none;padding:6px 2px;border:0;background:none;color:#b9ad98;font-size:16px;}',
      '.lmas-empty{padding:24px 8px;text-align:center;color:#8a8070;font-size:15px;}',

      /* ── 怪物資訊小視窗：戰鬥畫面下緣、置中小卡片（同道具卡片的寬度/配色） ── */
      '#lmui-mobinfo{display:none;position:absolute;left:var(--lmui-pop-side);right:var(--lmui-pop-side);top:calc(var(--lmui-pop-top) - var(--lmui-bar));bottom:auto;max-height:calc(100dvh - var(--lmui-pop-top) - var(--lmui-pop-bot));z-index:8;flex-direction:column;padding:12px 12px 8px;background:linear-gradient(#211a12,#0f0b08);border:1px solid #8a6a3a;border-radius:10px;box-shadow:0 0 0 100vmax rgba(0,0,0,.55),0 10px 40px rgba(0,0,0,.9);color:#eee;text-shadow:none;}',
      'body.lmui-battle.lmui-mobinfo #lmui-mobinfo{display:flex;}',
      '.mi-hd{display:flex;align-items:baseline;gap:8px;padding-bottom:6px;border-bottom:1px solid #3d3121;}',
      '.mi-name{font-size:17px;font-weight:700;color:#fff;}',
      '.mi-name.boss{color:#f87171;}',
      '.mi-lv{font-size:14px;color:#e8b04a;}',
      '.mi-x{margin-left:auto;width:26px;height:26px;border:1px solid #5a4630;border-radius:4px;background:#1c150e;color:#d6c7a5;font-size:15px;line-height:1;cursor:pointer;}',
      '.mi-tags{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 4px;}',
      '.mi-tag{padding:1px 6px;font-size:12px;border:1px solid #4d3f2b;border-radius:3px;color:#c9b88f;background:#17120c;}',
      '.mi-tag.mi-evil{color:#fca5a5;border-color:#7f1d1d;background:#2a0d0d;font-weight:700;}',
      '.mi-tag.ele-fire{color:#fca5a5;border-color:#7f1d1d;}.mi-tag.ele-water{color:#93c5fd;border-color:#1e3a8a;}.mi-tag.ele-earth{color:#d6b98a;border-color:#5a4630;}.mi-tag.ele-wind{color:#86efac;border-color:#14532d;}',
      '.mi-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:3px 8px;font-size:13px;margin-bottom:6px;}',
      '.mi-stats span{display:flex;justify-content:space-between;gap:4px;white-space:nowrap;}',
      '.mi-stats i{font-style:normal;color:#9c8f78;}',
      '.mi-stats b{color:#fff;font-weight:600;}',
      '.mi-sub{font-size:14px;font-weight:700;color:#f0c35a;padding:4px 0;border-top:1px solid #3d3121;}',
      '.mi-sub em{font-style:normal;font-weight:400;color:#a78bfa;margin-left:4px;font-size:13px;}',
      '.mi-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;}',
      '.mi-drop{display:flex;align-items:center;gap:6px;padding:4px 2px;border-bottom:1px solid rgba(90,70,48,.35);font-size:14px;}',
      '.mi-drop img{width:24px;height:24px;object-fit:contain;flex:none;}',
      '.mi-drop .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.mi-drop .rt{flex:none;color:#d6c7a5;font-family:Consolas,monospace;font-size:13px;}',
      '.mi-none{font-size:14px;color:#8d7c5c;padding:6px 0;}',

      /* ── 狩獵場（選地圖）：下半部、分頁＋清單；外觀跟戰鬥畫面的聊天框同一套（小分頁、半透明黑底、細分隔線） ── */
      '#lmui-maps{display:none;position:absolute;left:0;right:0;top:calc(var(--lmui-mtop) - var(--orig-bar-h,0px));bottom:0;z-index:6;flex-direction:column;padding:4px 4px 2px;background:linear-gradient(#1a1612,#0b0907);border-top:1px solid #4a3f30;}',
      'body.lmui-battle.lmui-maps #lmui-maps{display:flex;}',
      'body.lmui-battle.lmui-maps #lmui-bottom{display:none !important;}',
      '.lm-tabs{display:flex;gap:2px;padding:2px 2px 0;flex:none;}',
      '.lm-tabs button{flex:1 1 auto;min-width:0;padding:3px 4px;font-size:16px;white-space:nowrap;font-family:inherit;color:#c9b88f;background:linear-gradient(#3b3022,#1c160e);border:1px solid #4d3e29;border-radius:2px;}',
      '.lm-tabs button.on{color:#fff6dc;background:linear-gradient(#7a5f35,#3f2f18);border-color:#b8955a;}',
      '.lm-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;margin-top:3px;padding:0 4px;background:rgba(0,0,0,.5);}',
      '.lm-row{display:flex;align-items:center;justify-content:space-between;width:100%;padding:8px 6px;text-align:left;font-family:inherit;background:transparent;border:0;border-bottom:1px solid rgba(90,70,48,.45);color:#eee;cursor:pointer;text-shadow:0 1px 1px #000;}',
      '.lm-row .nm{font-size:15px;}',
      '.lm-row .rt{font-size:13px;color:#9c8f78;}',
      '.lm-row.cur{background:linear-gradient(90deg,rgba(122,95,53,.55),rgba(63,47,24,.15));}',
      '.lm-row.cur .nm{color:#fff6dc;font-weight:700;}',
      '.lm-row.off{opacity:.4;cursor:not-allowed;}',
      '.lm-row:not(.off):active{background:rgba(122,95,53,.35);}',

      /* ── 村莊：跟戰鬥一樣上下兩塊。上半＝上游村莊地圖（NPC 站位是百分比，放大鋪滿也對得上），下半＝NPC 卡片兩欄 ──
         村莊時 body 同時帶 lmui-battle（共用上下分割、HUD、狀態列、彈窗下移）＋ lmui-town（村莊專屬）。
         NPC 清單是 afk-npclist 的 #afk-npclist，整塊 fixed 到下半部（它在 #col-center 裡，fixed 不受外層裁切）。 */
      /* :not(.hidden) 要帶上：afk-npclist 的 body.afk-npclist #town-view:not(.hidden){height:auto;min-height:200px} 特異度比較高 */
      'html body.lmui-town #town-view:not(.hidden){display:block !important;position:absolute !important;top:0 !important;left:0 !important;right:0 !important;bottom:0 !important;width:100% !important;height:100% !important;min-height:0 !important;padding:0 !important;margin:0 !important;gap:0 !important;flex:none !important;align-self:stretch !important;}',
      'html body.lmui-town #town-name,html body.lmui-town #town-view>p{display:none !important;}',
      'html body.lmui-town #town-npc-map{display:block !important;position:absolute !important;inset:0 !important;width:100% !important;height:100% !important;max-width:none !important;aspect-ratio:auto !important;margin:0 !important;border:0 !important;border-radius:0 !important;background-size:cover !important;background-position:center !important;box-shadow:inset 0 0 120px 40px rgba(0,0,0,.75) !important;}',
      'html body.lmui-town #afk-npclist{display:grid !important;position:fixed !important;top:var(--lmui-mtop) !important;bottom:var(--m-nav-h,0px) !important;left:0 !important;right:0 !important;width:auto !important;height:auto !important;max-height:none !important;margin:0 !important;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:max-content !important;gap:6px;align-content:start;padding:8px;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:linear-gradient(rgba(23,18,13,.97),rgba(11,9,7,.98));z-index:5;}',
      /* NPC 卡片只屬於「狩獵場（戰鬥）」那一頁：切到背包/素質/設定時收起，不然會蓋在那些頁面上 */
      'html body.lmui-town:not(.mview-center) #afk-npclist,html body.lmui-town.lmui-townchat #afk-npclist{display:none !important;}',
      'html body.lmui-town #afk-npclist .afk-npcl-row{display:block !important;min-width:0 !important;overflow:visible !important;width:auto !important;height:auto !important;max-height:none !important;line-height:1.35 !important;min-height:0 !important;margin:0 !important;padding:7px 9px !important;text-align:left !important;background:rgba(30,22,14,.85) !important;border:1px solid #5a4630 !important;border-radius:6px !important;box-shadow:inset 0 1px 0 rgba(255,220,150,.06),0 1px 3px rgba(0,0,0,.6) !important;}',
      'html body.lmui-town #afk-npclist .afk-npcl-row:active{background:rgba(60,44,26,.9) !important;}',
      'html body.lmui-town #afk-npclist .afk-npcl-ico{display:none !important;}',
      'html body.lmui-town #afk-npclist .afk-npcl-main{display:block !important;min-width:0;}',
      'html body.lmui-town #afk-npclist .afk-npcl-main>span:first-child{display:block;}',
      'html body.lmui-town #afk-npclist .afk-npcl-name{display:inline !important;font-size:16px !important;font-weight:700 !important;color:#fff !important;}',
      'html body.lmui-town #afk-npclist .lmui-npc-emo{margin-right:4px;font-size:15px;}',
      'html body.lmui-town #afk-npclist .afk-npcl-title{display:block !important;margin:1px 0 0 !important;font-size:13px !important;color:#e8b04a !important;}',
      'html body.lmui-town #afk-npclist .afk-npcl-title[data-lmui-br]::before{content:"[";}',
      'html body.lmui-town #afk-npclist .afk-npcl-title[data-lmui-br]::after{content:"]";}',
      'html body.lmui-town #afk-npclist .afk-npcl-desc{display:none !important;}',   /* 站長：卡片只留名字＋職稱，不顯示說明 */
      /* NPC 對話/商店：蓋在 NPC 卡片上、同一塊下半部 */
      /* 浮動大視窗：頭像列下方到工具列上方、左右留邊、圓角金框；外圍用超大陰影把其他畫面壓暗。
         村莊沒有戰鬥畫面要避開，可以蓋過上半部的村莊地圖。開著時 HUD（頭像列/狀態列）先收起來（它在 body 層會疊到視窗上）。 */
      'html body.lmui-town #town-interaction-container:not(.hidden){position:fixed !important;top:var(--lmui-pop-top) !important;bottom:auto !important;left:var(--lmui-pop-side) !important;right:var(--lmui-pop-side) !important;width:auto !important;height:auto !important;max-height:calc(100dvh - var(--lmui-pop-top) - var(--lmui-pop-bot)) !important;margin:0 !important;transform:none !important;border-radius:10px !important;border:1px solid #8a6a3a !important;background:linear-gradient(#1f1912,#0e0b08) !important;box-shadow:0 0 0 100vmax rgba(0,0,0,.55),0 10px 40px rgba(0,0,0,.9) !important;z-index:20 !important;}',
      'body.lmui-npcwin #lmui-hud>:not(#lmui-tl):not(#lmui-tr):not(#lmui-vit){display:none !important;}',
      'body.lmui-town.town-int-open #lmui-hud>:not(#lmui-tl):not(#lmui-tr):not(#lmui-vit){display:none !important;}',   // 同上，開的當下就收（不等 tick）
      /* 不顯示的 NPC（龍鑽收購、傭兵公會）：卡片與地圖都藏 */
      'html body.lmui-town .lmui-npc-off,html body.lmui-town #afk-npclist .afk-npcl-row.lmui-npc-off{display:none !important;}',
      /* NPC 對話標題：金色「名字（職稱）」＋右邊金幣 */
      'html body.lmui-town #interaction-npc-name{color:#e8b04a !important;font-size:19px !important;}',
      'html body.lmui-town #interaction-npc-title{color:#e8b04a !important;font-size:17px !important;font-weight:700;margin-left:2px;}',
      '#lmui-ihead-gold{margin-left:auto;margin-right:10px;color:#f5d77b;font-weight:700;font-size:17px;white-space:nowrap;}',
      /* 製作清單（一列＝圖示＋名稱＋材料接成一行＋數量＋按鈕） */
      /* 一列拆兩行：上＝圖示/名稱/材料，下＝數量＋按鈕靠右（視窗窄時材料字才不會被按鈕蓋住） */
      'html body.lmui-town #interaction-content .list-item{flex-wrap:wrap !important;row-gap:6px !important;padding:8px !important;margin-bottom:6px !important;gap:8px;background:rgba(26,20,14,.92) !important;border:1px solid #4a3c29 !important;border-radius:6px !important;}',
      'html body.lmui-town #interaction-content .list-item>div:first-child{gap:10px !important;}',
      'html body.lmui-town #interaction-content .list-item .w-12.h-12{width:44px !important;height:44px !important;background:#0f0b08 !important;border-color:#4a3c29 !important;}',
      'html body.lmui-town #interaction-content .list-item .w-12.h-12 img{width:38px !important;height:38px !important;}',
      'html body.lmui-town #interaction-content .list-item .text-lg{font-size:17px !important;}',
      'html body.lmui-town #interaction-content .list-item .flex-wrap{display:block !important;font-size:14px !important;line-height:1.5 !important;color:#c9bfae;}',
      'html body.lmui-town #interaction-content .list-item .flex-wrap>span{display:inline !important;font-size:14px !important;font-weight:400 !important;margin:0 !important;line-height:1.5 !important;}',
      'html body.lmui-town #interaction-content .list-item .flex-wrap>span.text-slate-400:first-child{display:none !important;}',
      'html body.lmui-town #interaction-content .list-item .flex-wrap>span.text-slate-500{margin:0 4px !important;color:#7d8f5a !important;}',
      'html body.lmui-town #interaction-content .list-item .flex-wrap .text-red-400{color:#f87171 !important;font-weight:700;}',
      'html body.lmui-town #interaction-content .list-item .flex-wrap .text-green-400{color:#4ade80 !important;font-weight:700;}',
      'html body.lmui-town #interaction-content .list-item>div:first-child{flex:1 1 100% !important;min-width:0 !important;}',
      'html body.lmui-town #interaction-content .list-item>div:last-child{flex:1 1 100% !important;justify-content:flex-end !important;}',
      'html body.lmui-town #interaction-content .list-item input[type="number"]{width:52px !important;padding:5px 2px !important;}',
      /* 標題列不換行：名字（職稱）｜金幣｜關閉 */
      'html body.lmui-town #town-interaction-header{flex-wrap:nowrap !important;gap:6px;}',
      'html body.lmui-town #town-interaction-heading{min-width:0;overflow:hidden;white-space:nowrap;}',
      'html body.lmui-town #town-interaction-close{flex:none;padding:4px 10px !important;}',
      'html body.lmui-town #interaction-content .list-item .btn{padding:8px 10px !important;font-size:15px !important;white-space:nowrap;}',
      'html body.lmui-town #interaction-content .list-item .btn.lmui-nomat{background:#2b2b31 !important;border-color:#45454d !important;color:#8b8b94 !important;cursor:not-allowed;box-shadow:none !important;}',
      /* 村莊的下半部給 NPC 卡片；按「聊天」才把聊天框叫出來（lmui-townchat） */
      'body.lmui-town:not(.lmui-townchat) #lmui-bottom{display:none !important;}',
      'body.lmui-town.lmui-townchat #lmui-bottom{display:flex !important;}',

      /* ── 裝備分頁（紙娃娃）：上游嵌入式裝備視窗與 afk-eqlist 的清單都先藏起來，改顯示 #lmui-doll ── */
      '#lmui-doll{display:none;}',
      'html body.lmui-equip #lmui-doll{display:flex;flex-direction:column;gap:6px;padding:8px;background:radial-gradient(ellipse at 50% 35%,#2a2520,#0f0c09 75%);border:1px solid #6b5636;border-radius:6px;box-shadow:inset 0 0 18px #000;color:#e9dcc0;}',
      'html body.lmui-equip #tab-equip,html body.lmui-equip #equipment-window{display:none !important;}',
      /* 格子邊長（全部同樣大）：高度＝5 排＋間距，扣掉名字／經驗／能力值表／內距約 220px；寬度＝左右共 4 欄，中間角色至少留約 140px。兩者取小，上限 58px */
      '#lmui-doll{--ld-c:clamp(36px,min(calc((var(--lmui-wbot) - var(--lmui-ptop) - var(--lmui-whead-h) - var(--lmui-ptabs-h) - 240px) / 5.4),calc((100vw - 180px) / 4)),58px);}',
      '.ld2-title{display:flex;align-items:baseline;justify-content:center;gap:10px;font-size:20px;font-weight:700;color:#f1e3c4;text-shadow:0 1px 2px #000;letter-spacing:1px;}',
      '.ld2-title .lv,.ld2-title .cl{font-size:17px;color:#e8cf8f;}',
      '.ld2-xp{margin-top:-4px;text-align:center;font-size:13px;color:#c9b88f;}',
      /* 角色畫布鋪滿整個中段、墊在格子後面：身體在正中間，長武器可以伸到兩邊格子後面，人才放得大 */
      /* 裝備欄長滿視窗：中段吃掉剩下的高度、兩邊格子上下撐開，角色有空間放大 */
      'html body.lmui-equip #lmui-doll{box-sizing:border-box;min-height:calc(var(--lmui-wbot) - var(--lmui-ptop) - var(--lmui-whead-h) - var(--lmui-ptabs-h) - 28px);}',
      '.ld2-body{position:relative;flex:1 1 auto;display:flex;gap:6px;align-items:stretch;}',
      '.ld2-fig{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:0;}',
      '.ld2-col{position:relative;z-index:1;flex:0 0 auto;display:grid;grid-template-columns:repeat(2,var(--ld-c));grid-template-rows:repeat(5,var(--ld-c));gap:6px;align-content:center;}',   /* 格子緊靠（站長：縫隙太大），多出來的高度留在上下 */
      '.ld2-mid{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;gap:4px;}',
      '.ld2-bar{position:relative;height:18px;border:1px solid #6b5636;border-radius:3px;background:#120a08;overflow:hidden;}',
      '.ld2-bar i{position:absolute;left:0;top:0;bottom:0;width:0;transition:width .25s;}',
      '.ld2-bar.hp i{background:linear-gradient(#ff7a6a,#c81e1e 40%,#6a0b0b);}',
      '.ld2-bar.mp i{background:linear-gradient(#7aa8ff,#2453c8 40%,#0c2468);}',
      '.ld2-bar span{position:relative;z-index:1;display:block;text-align:center;font:700 13px/18px Consolas,"Courier New",monospace;color:#fff;text-shadow:1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;}',
      '.ld2-stats{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #4a3c29;border-radius:4px;background:rgba(0,0,0,.35);}',
      '.ld2-stats>div{display:flex;align-items:center;justify-content:space-between;padding:5px 9px;border-bottom:1px solid rgba(110,90,60,.3);}',
      '.ld2-stats>div:nth-child(3n+2){border-left:1px solid rgba(110,90,60,.3);border-right:1px solid rgba(110,90,60,.3);}',
      '.ld2-stats>div:nth-last-child(-n+3){border-bottom:0;}',
      '.ld2-stats em{font-style:normal;font-size:14px;color:#c9b88f;}',
      '.ld2-stats b{font-size:16px;color:#fff;}',
      '.ld-cell{position:relative;aspect-ratio:1;border:1px solid #4a3c29;border-radius:3px;background:radial-gradient(circle at 50% 40%,#2a241c,#0e0b08 75%);box-shadow:inset 0 0 0 1px #000,inset 0 0 10px rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;cursor:pointer;}',
      '.ld-cell.is-filled{border-color:#c9a463;box-shadow:inset 0 0 0 1px #000,inset 0 0 10px rgba(0,0,0,.8),0 0 6px rgba(230,180,90,.45);}',   /* 有裝東西的格子金框（同參考圖） */
      '.ld-cell img{width:78%;height:78%;object-fit:contain;filter:drop-shadow(0 1px 2px #000);}',
      '.ld-cell.is-empty{cursor:default;}',
      '.ld-cell.is-empty span{font-size:12px;color:rgba(230,210,170,.45);white-space:nowrap;}',
      '.ld-en{position:absolute;left:2px;top:1px;font:800 14px/1 Arial,sans-serif;color:#39a9ff;text-shadow:0 0 3px #0b4f99,1px 1px 1px #000;}',
      '.ld-cnt{position:absolute;right:2px;bottom:1px;font:800 13px/1 Arial,sans-serif;color:#d5a94f;text-shadow:1px 1px 1px #000;}',

      /* ── 技能分頁（魔法書）：上方書籤（全體魔法／職業／裝備）、左側階數鈕、4 欄圖示、底部魔攻／魔法防禦 ── */
      '.lsk2{display:flex;flex-direction:column;gap:6px;padding:6px;background:linear-gradient(#2a2622,#1c1916);border:1px solid #4d443b;border-radius:6px;color:#d8cfc2;box-sizing:border-box;}',
      /* 高度由 fitSkillBook() 量畫面剩下的空間填滿（格子在框裡捲，書籤／階數鈕／底部數值固定看得到）；量不到時的保底 */
      '#tab-skill .lsk2{min-height:320px;}',
      /* 魔法書自己有框 → 開魔法分頁時拿掉外層分頁面板的黑底與框，免得框外又一圈黑邊（lmui-sktab 由 tick 依目前分頁切） */
      'body.lmui-sktab #tab-content-panel{background:none !important;border-color:transparent !important;box-shadow:none !important;}',
      'body.lmui-sktab #tab-skill{background:transparent !important;}',
      /* 書籤＝背包那排分頁的樣式（站長）：整條貼在書的最上緣（抵掉書的內距），按鈕同 .lm-tabs */
      '.lsk2-tabs{display:flex;gap:2px;height:var(--lmui-ptabs-h);box-sizing:border-box;margin:-6px -6px 0;padding:3px 2px;background:linear-gradient(#1a1612,#0b0907);border-bottom:1px solid #4a3f30;border-radius:6px 6px 0 0;}',
      '.lsk2-tabs button{flex:1 1 auto;min-width:0;padding:3px 4px;font-size:16px;white-space:nowrap;font-family:inherit;color:#c9b88f;background:linear-gradient(#3b3022,#1c160e);border:1px solid #4d3e29;border-radius:2px;}',
      '.lsk2-tabs button.on{color:#fff6dc;background:linear-gradient(#7a5f35,#3f2f18);border-color:#b8955a;}',
      '.lsk2-body{flex:1 1 auto;min-height:0;display:flex;gap:6px;}',
      '.lsk2-side{flex:0 0 38px;display:flex;flex-direction:column;gap:4px;overflow-y:auto;}',
      '.lsk2-side .gap{flex:0 0 8px;}',
      '.lsk2-side button{flex:0 0 40px;border:1px solid #4d443b;border-radius:4px;background:linear-gradient(#3d3732,#211e1b);color:#a59a8c;font:700 19px/1 Georgia,serif;text-shadow:0 1px 2px #000;}',
      '.lsk2-side button.on{border-color:#b8955a;color:#fff6dc;background:linear-gradient(#5a5047,#2f2a25);}',
      '.lsk2-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;border:1px solid #3a332d;border-radius:3px;background:#0e0c0a;padding:3px;}',
      '.lsk2-grid{display:grid;grid-template-columns:repeat(' + SK_COLS + ',1fr);gap:6px;}',   /* 站長：圖示小一點、格子之間留空 */
      '.lsk-cell{position:relative;aspect-ratio:1;border:1px solid #3d3630;border-radius:2px;background:#15120f;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer;}',
      '.lsk-cell img{width:100%;height:100%;object-fit:contain;}',
      '.lsk-cell.is-empty{background:#0b0908;cursor:default;}',
      /* 沒學過＝暗色：圖片去色壓暗，再蓋一層黑（別處有通用的 img 濾鏡規則會蓋掉單純的 filter，故帶 #tab-skill + !important） */
      '#tab-skill .lsk-cell.is-unlearned img{filter:grayscale(1) brightness(.35) !important;}',
      '#tab-skill .lsk-cell.is-unlearned::after{content:"";position:absolute;inset:0;background:rgba(0,0,0,.45);pointer-events:none;}',
      '#tab-skill .lsk-cell.is-off img{filter:brightness(.6) !important;}',
      '.lsk2-foot{flex:none;display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:4px 2px 0;font-size:16px;color:#c9bfb0;}',
      '.lsk2-foot b{min-width:52px;padding:2px 6px;border:1px solid #4d443b;background:#0b0908;color:#fff;font-weight:400;text-align:right;}',

      /* ── 道具視窗：小卡片（寬 ~300、高度跟內容、按鈕兩欄），不再整頁蓋住 ──
         上緣沿用 afk-mobile 的 top:calc(8px + var(--orig-bar-h))（戰鬥時 --orig-bar-h 已換成場景下緣）；
         這裡只改寬度/高度/置中與內部密度。#modal-compare（裝備比對）照樣排在卡片上方，一起在卡片裡捲。 */
      'html body.lmui #item-modal:not(.hidden){top:var(--lmui-pop-top) !important;bottom:auto !important;left:var(--lmui-pop-side) !important;right:var(--lmui-pop-side) !important;width:auto !important;transform:none !important;height:auto !important;max-height:calc(100dvh - var(--lmui-pop-top) - var(--lmui-pop-bot)) !important;overflow-y:auto !important;flex-direction:column !important;align-items:stretch !important;gap:6px !important;padding:8px !important;background:linear-gradient(#1f1912,#0e0b08) !important;border:1px solid #8a6a3a !important;border-radius:10px !important;box-shadow:0 0 0 100vmax rgba(0,0,0,.55),0 10px 40px rgba(0,0,0,.9) !important;}',
      /* 背包等視窗開著（標題列 #lmui-whead 在上面）：道具視窗從標題列下緣開始，原本道具名稱被標題列蓋掉一半（站長：道具視窗很亂） */
      'html body.lmui-battle.lmui-tall.lmui-whead #item-modal:not(.hidden){top:calc(var(--lmui-ptop) + var(--lmui-whead-h) + 6px) !important;max-height:calc(100dvh - var(--lmui-ptop) - var(--lmui-whead-h) - 6px - var(--lmui-pop-bot)) !important;}',
      'html body.lmui #item-modal>.panel{min-width:0 !important;max-width:none !important;width:100% !important;max-height:none !important;padding:12px !important;margin:0 !important;box-shadow:none !important;}',
      'html body.lmui #modal-item-name{font-size:18px !important;margin-bottom:8px !important;padding-bottom:8px !important;}',
      'html body.lmui #modal-item-name img{width:28px !important;height:28px !important;}',
      'html body.lmui #modal-item-desc{font-size:15px !important;line-height:1.55 !important;min-height:0 !important;margin-bottom:10px !important;}',
      'html body.lmui #modal-item-desc .class-eq-icon{width:16px !important;height:16px !important;}',
      /* 按鈕兩顆一列、落單的撐滿整列；.act-break（js/10 openModal 插在主要動作和賣出之間）強制換列 */
      'html body.lmui #modal-actions{display:flex !important;flex-wrap:wrap !important;gap:6px !important;}',
      'html body.lmui #modal-actions>*{flex:1 1 40% !important;width:auto !important;min-height:0 !important;margin:0 !important;padding:9px 4px !important;font-size:15px !important;line-height:1.3 !important;}',
      'html body.lmui #modal-actions>.act-break{flex:1 1 100% !important;height:0 !important;padding:0 !important;border:0 !important;}',
      'html body.lmui #item-modal .panel>button.mt-5{margin-top:8px !important;padding:7px !important;font-size:16px !important;}',
      'html body.lmui #item-modal>.panel{overflow:visible !important;height:auto !important;}',   // 整張卡片一起捲，不要卡片裡面各自再一條捲軸
      'html body.lmui #modal-compare{font-size:14px !important;}',
      'html body.lmui #modal-compare>*{font-size:14px !important;}',
      /* 裝備比對預設收起，按「與身上比較」才展開（參考圖的做法；上游手機是一律攤開在卡片上方，佔掉半張） */
      'html body.lmui:not(.lmui-cmp) #modal-compare{display:none !important;}',
      'html body.lmui #lmui-cmp-btn{grid-column:1 / -1 !important;border:1px solid #3b82f6 !important;background:rgba(30,41,59,.85) !important;color:#bfdbfe !important;border-radius:6px;font-weight:700;}',
      'html body.lmui.lmui-cmp #lmui-cmp-btn{background:#1e3a8a !important;color:#fff !important;}',

      /* ── 底部工具列（經典天堂暗色那排：黑底、銀色金屬圖示；手機遊戲畫面一律套） ── */
      'body.lmui #m-nav{background:linear-gradient(#2b2b2b,#141414 45%,#0a0a0a) !important;border-top:1px solid #5a5a5a !important;box-shadow:0 -2px 6px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.08);position:fixed;}',
      'body.lmui #m-nav>.m-nav-btn{display:none !important;}',
      /* 工具列＝純文字按鈕（玩家要求「直接顯示文字」）：選中的那格金底深字，其他淺色字；圖示保留在 DOM 但不顯示 */
      '#lmui-nav{display:flex;flex:1;flex-wrap:wrap;align-items:stretch;gap:2px;padding:2px 2px 6px;}',
      /* 經驗條：工具列按鈕下方（syncToolbar 搬過來），任何分頁都看得到 */
      '#lmui-nav #lmui-exp{flex:0 0 100%;order:9;margin:1px 0 0;}',
      '.lmui-tool{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;padding:4px 0;background:transparent;border:1px solid transparent;border-radius:3px;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;font-family:inherit;}',
      '.lmui-tool svg{display:none;}',
      '.lmui-tool span{font-size:16px;font-weight:600;color:#d8cbb0;white-space:nowrap;letter-spacing:.5px;text-shadow:0 1px 1px #000;}',
      '.lmui-tool:active{background:rgba(255,255,255,.08);}',
      '.lmui-tool.on{background:linear-gradient(#e7c56f,#a8822f);border-color:#f0d58c;box-shadow:inset 0 1px 0 rgba(255,250,220,.5),0 0 6px rgba(231,197,111,.35);}',
      '.lmui-tool.on span{color:#1d1407;font-weight:700;text-shadow:none;}'
    ].join('\n');
    css += '\n' + themeCSS();
    var s = document.createElement('style');
    s.id = 'afk-lmui-style';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  // ── 全介面配色：把上游/各外掛的灰藍（Tailwind slate）換成天堂M的深褐＋銅框 ──
  //   只換「中性底色/邊框」：slate 那組（上游幾乎所有面板、輸入框、預設按鈕都是它）＋幾個外掛自己寫死的灰藍元件。
  //   有自己顏色的按鈕（紅/金/紫…）不動。class 用 [class~="…"] 精確比對整個 token —— 子字串比對會連
  //   「hover:bg-slate-700」一起中，把本來是琥珀色的按鈕永遠刷成褐色。
  function themeCSS() {
    var S = 'html body.lmui ';
    var OP = ['', '/10', '/20', '/30', '/40', '/50', '/60', '/70', '/75', '/80', '/90', '/95'];
    function tok(prefix, shades) {
      var out = [];
      shades.forEach(function (sh) { OP.forEach(function (o) { out.push(S + '[class~="' + prefix + sh + o + '"]'); }); });
      return out.join(',');
    }
    var BG = '#0f0b08', BG1 = '#18120d', BG2 = '#241b13', BG3 = '#31261a', BD = '#4a3c29', BD2 = '#6b5636', TX = '#ecdcb6';
    return [
      tok('bg-slate-', ['950', '900']) + '{background-color:rgba(15,11,8,.94) !important;}',
      tok('bg-slate-', ['800']) + '{background-color:rgba(26,20,14,.95) !important;}',
      tok('bg-slate-', ['700']) + '{background-color:' + BG3 + ' !important;}',
      tok('bg-slate-', ['600']) + '{background-color:#3d3022 !important;}',
      tok('border-slate-', ['500', '600', '700', '800']) + '{border-color:' + BD + ' !important;}',
      /* 面板（上游 .panel 是灰藍漸層）。戰鬥框那塊 #map-view-panel 另有更高優先的「去框」規則，不受影響 */
      S + '.panel{background:linear-gradient(' + BG1 + ',' + BG + ') !important;border-color:' + BD + ' !important;box-shadow:inset 0 1px 0 rgba(255,220,150,.06),0 2px 8px rgba(0,0,0,.6) !important;}',
      S + '.panel-header{border-color:' + BD + ' !important;}',
      S + '.log-bg{background:' + BG + ' !important;}',
      /* 預設按鈕（沒有自己的底色 class、也沒有內聯底色的那種） */
      S + '.btn:not([class*="bg-"]):not([style*="background"]){background:linear-gradient(#4a3a26,#271d12) !important;border-color:#7a6440 !important;color:#f0e2bf !important;}',
      /* 中性灰藍的按鈕（bg-slate-*）：.btn 自帶漸層會蓋過單純的 background-color → 整個 background 換掉 */
      S + '.btn[class~="bg-slate-700"],' + S + '.btn[class~="bg-slate-800"],' + S + '.btn[class~="bg-slate-600"]{background:linear-gradient(#4a3a26,#271d12) !important;border-color:#7a6440 !important;color:#f0e2bf !important;}',
      /* 村莊 NPC 條列（afk-npclist）、世界頻道輸入列（日誌面板裡） */
      S + '.afk-npcl-row{background:linear-gradient(' + BG2 + ',' + BG1 + ') !important;border-color:' + BD + ' !important;}',
      S + '#world-input-row{background:' + BG1 + ' !important;border-color:' + BD + ' !important;}',
      S + '#world-send{background:linear-gradient(#4a3a26,#271d12) !important;border-color:#7a6440 !important;color:#f0e2bf !important;}',
      /* afk-toast 提示、afk-mobile 登出確認窗的遮罩與分隔線 */
      S + '.m-toast{background:rgba(20,15,10,.95) !important;border-color:' + BD2 + ' !important;color:' + TX + ' !important;}',
      S + '#m-logout-modal{background:rgba(8,6,4,.7) !important;}',
      S + '#m-logout-hr{border-top-color:' + BD + ' !important;}',
      /* 輸入框/下拉/勾選/滑桿 */
      S + 'input[type="text"],' + S + 'input[type="number"],' + S + 'input[type="search"],' + S + 'select,' + S + 'textarea{background-color:' + BG + ' !important;border-color:#5a4a33 !important;color:' + TX + ' !important;}',
      S + 'input[type="checkbox"],' + S + 'input[type="radio"],' + S + 'input[type="range"]{accent-color:#c9a25a;}',
      /* 角色素質：六圍方塊、能力值來源（afk-statpts） */
      S + '.ability-primary-control{background:' + BG1 + ' !important;border-color:' + BD + ' !important;}',
      S + '.afk-stpts{background:rgba(15,11,8,.7) !important;border-color:' + BD + ' !important;}',
      S + '.afk-stpts-row{border-color:rgba(74,60,41,.6) !important;}',
      S + '.m-bav-entrybtn{background:' + BG2 + ' !important;border-color:' + BD + ' !important;}',
      S + '.ability-detail-column{background:rgba(15,11,8,.75) !important;border-color:' + BD + ' !important;}',
      S + '#afk-isearch{background:' + BG1 + ' !important;border-color:' + BD + ' !important;}',
      /* 戰鬥畫面裡的小東西：狀態圖示的底、怪物血條的底槽（核心內聯 background:#475569） */
      S + '.status-icon{background-color:#120d09 !important;}',
      S + '.mob-hp-bar>div{background:#1c0b08 !important;box-shadow:0 0 0 1px #000;}',
      /* 左上角「外掛」入口（逃生門，afk-toggles）：只換顏色，位置/大小/可點性完全不動 */
      /* 「外掛」入口按鈕：玩家要求登入畫面與遊戲中都不顯示（不帶 body.lmui 前綴＝登入畫面也藏）。
         ⚠️ 這是外掛開關面板唯一的入口（逃生門）：藏了之後玩家無法自行關掉出問題的外掛。
            要叫出面板：主控台執行 AFK_TOGGLES.openPanel()；或在外掛面板外把本檔關掉後按鈕就回來。 */
      /* afk-mobile / afk-battlehud 的元件（村莊裡還看得到） */
      S + '#m-status{background:linear-gradient(#211a12,#120d09) !important;border-color:' + BD + ' !important;}',
      S + '#m-log-sheet{background:#110d09 !important;border-top-color:' + BD2 + ' !important;}',
      S + '#m-log-hd{border-bottom-color:#3a3024 !important;color:' + TX + ' !important;}',
      S + '#m-log-hd button{background:' + BG2 + ' !important;border-color:#5a4a33 !important;color:' + TX + ' !important;}',
      S + '#m-logout-card{background:#15100b !important;border-color:#5a4a33 !important;}',
      S + '.m-logout-slot{background:' + BG2 + ' !important;border-color:' + BD + ' !important;}',
      S + '.m-logout-slot-go,' + S + '#m-logout-cancel{background:' + BG3 + ' !important;border-color:#5a4a33 !important;color:' + TX + ' !important;}'
    ].join('\n');
  }

  // ── HUD DOM ─────────────────────────────────────────────
  var hud = null, el = {}, slots = [], chatTab = 'sys';
  function build() {
    hud = document.createElement('div');
    hud.id = 'lmui-hud';
    var hot = '';
    for (var i = 0; i < HOT_SLOTS; i++) hot += '<button type="button" class="lmui-slot lmui-hit ' + (i < HOT_ROW ? 'r1' : 'r2') + '" data-i="' + i + '"><span class="fk">F' + (i + 1) + '</span><span class="n"></span><span class="cd"></span></button>';
    hot += '<button type="button" id="lmui-hotmode" class="lmui-hit" aria-label="切換快捷列"></button>';
    hud.innerHTML =
      '<div id="lmui-tl">' +
        '<div id="lmui-face"><div class="pic lmui-hit" role="button" aria-label="裝備欄"><img alt=""></div><span id="lmui-align"><span class="k"></span><b></b></span></div>' +
        '<div id="lmui-stats">' +
          '<div class="row"><button type="button" id="lmui-name" class="lmui-hit"></button></div>' +
          '<div class="row"><span><span class="k">防禦</span><b id="lmui-ac"></b></span><span><span class="k">魔防</span><b id="lmui-mr"></b></span></div>' +
          '<div class="row"><span id="lmui-gold"><span class="k">💰</span><b></b></span></div>' +
        '</div>' +
      '</div>' +
      '<div id="lmui-tr">' +
        '<button type="button" id="lmui-mini" class="lmui-hit" aria-label="地圖"><span class="moon">🌙</span><i class="me" style="left:50%;top:50%"></i></button>' +
      '</div>' +
      /* 狀態列：血條/魔力條（AUTO 壓在中間圓章上），釘在戰鬥畫面下緣；經驗條建在這裡，syncToolbar 再搬到底部工具列按鈕下方 */
      '<div id="lmui-vit">' +
        '<button type="button" id="lmui-mapname" class="lmui-hit"><b></b><small></small></button>' +   // 地區名：純文字，靠左貼在等級條上方
        '<div id="lmui-comp"></div><div id="lmui-comp-pop" class="hidden"></div>' +
        '<div id="lmui-exp"><i></i><span class="lv"><em>等級</em><b></b></span><span class="pc"></span></div>' +
        '<div id="lmui-bars"><div id="lmui-hp" class="lmui-bar"><i></i><span></span></div><div id="lmui-mp" class="lmui-bar"><i></i><span></span></div>' +
          '<button type="button" id="lmui-auto" class="lmui-hit" aria-label="AUTO">' + AUTO_SVG + '</button>' +
          '<div id="lmui-autopop"><button type="button" class="lmui-hit l" data-a="log">掛機紀錄</button></div></div>' +   // 「掛機設定」站長要求拿掉（2026-10-16）
      '</div>' +
      '<div id="lmui-bottom">' +
        '<div id="lmui-hot" data-mode="0">' + hot + '</div>' +
        '<div id="lmui-chat" class="lmui-hit">' +
          '<div id="lmui-tabs">' +
            '<div class="row"><button type="button" class="more" data-t="big" aria-label="放大聊天框">▲</button><button type="button" data-t="sys">系統</button><button type="button" data-t="combat">戰鬥</button><button type="button" data-t="drop">掉落</button><button type="button" class="petflt" data-t="petflt" aria-label="寵物訊息">寵物</button></div>' +
            '<div class="row"><button type="button" data-t="say">一般</button><button type="button" data-t="world">世界</button><button type="button" data-t="party">隊伍</button><button type="button" data-t="clan">血盟</button></div>' +
          '</div>' +
          '<div id="lmui-lines"></div>' +
          '<div id="lmui-input"><select id="lmui-ch" aria-label="頻道"><option value="say">一般</option><option value="world">世界</option><option value="party">隊伍</option><option value="clan">血盟</option></select>' +
            '<input id="lmui-say" type="text" maxlength="60" autocomplete="off" enterkeyhint="send" placeholder="輸入訊息"><button type="button" id="lmui-send">發送</button></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(hud);

    ['ac', 'mr', 'hp', 'mp', 'exp', 'align', 'gold', 'mapname', 'mini', 'lines', 'tabs', 'name'].forEach(function (k) { el[k] = $('lmui-' + k); });
    if (el.name) el.name.addEventListener('click', function (e) { e.stopPropagation(); startLmuiRename(); });
    bindCompanions();
    el.face = hud.querySelector('#lmui-face img');
    hud.querySelector('#lmui-face .pic').addEventListener('click', toggleEquipWin);
    slots = Array.prototype.slice.call(hud.querySelectorAll('.lmui-slot')).map(function (b) {
      return { el: b, key: '', kind: null, id: null, uid: null, img: null, cd: b.querySelector('.cd'), n: b.querySelector('.n') };
    });

    el.mapname.addEventListener('click', function () { closeAllWindows(); toggleMaps(); });
    el.mini.addEventListener('click', toggleMap);
    $('lmui-auto').addEventListener('click', function () {
      var p = !isPaused(); setPaused(p);
      if (!p) sessStart();   // 按 AUTO 開始：掛機紀錄從這一刻重算
      try { logSys(p ? '⏸ 已暫停，再按一次 AUTO 繼續' : '▶ 自動戰鬥繼續'); } catch (e) {}
    });
    var popAt = 0;
    $('lmui-autopop').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-a]'); if (!b) return;
      e.stopPropagation();
      if (Date.now() - popAt < 400) return;   // 手機一次點擊偶爾送兩下：開了又關（站長：點開會彈兩下）
      popAt = Date.now();
      if (b.getAttribute('data-a') === 'log') { var open = $('lmui-huntlog'); if (open) open.remove(); else showHuntLog(); }   // 再點一次＝關閉
    });
    el.tabs.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-t]'); if (!b) return;
      e.stopPropagation();
      var t = b.getAttribute('data-t');
      if (t === 'big') { document.body.classList.toggle('lmui-chatbig'); return; }
      if (t === 'petflt') { try { toggleCompanionFilter(); } catch (err) {} lastChatSig = ''; renderChat(true); return; }   // 戰鬥頁：顯示/隱藏寵物、召喚、迷魅的訊息
      chatTab = t; lastChatSig = ''; renderChat(true);
    });
    $('lmui-send').addEventListener('click', sendChat);
    $('lmui-say').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sendChat(); } });
    // 捲回最底時，把捲上去那段期間累積的新訊息補上
    el.lines.addEventListener('scroll', function () { if (chatDirty && linesAtBottom()) { chatDirty = false; renderChat(); } }, { passive: true });
    bindHot();
  }

  // ── 按鈕動作（全部是遊戲既有功能）──────────────────────
  // ── AUTO＝自動打怪 開／關 ──────────────────────────────
  // 關＝只關「自動打怪」（站長 2026-10-16：關閉只是關閉自動掛機，不要暫停任何東西）：遊戲照常進行——怪物照打、回血、增益倒數、喝水、補增益都照常；
  //   角色不自動普攻、不自動放攻擊魔法、不自動找怪、不自動瞬移逃王，自己點的怪才打（核心 js/03 autoHuntOff／autoHuntHold 讀 window.AFK_AUTO_OFF）。
  //   ⚠ 以前是「核心 tick 整個不跑」：怪物不會攻擊、冷卻不倒數（瞬移卡在冷卻中），站長回報後改掉。
  //   狀態按角色存 localStorage（my_autopause_<slot>）→ 重開遊戲照樣是關的；
  //   afk-offline 讀同一個鍵（且本外掛開著）時不結算離線收益——暫停中關掉瀏覽器不該還在掛機賺。
  //   本外掛被關掉時 wrapper 透明放行，暫停自然失效（按鈕也不在了，不能留一個解不開的暫停）。
  // AUTO 鈕圖示：上下兩道順時針箭頭夾著 AUTO 字（顏色跟 currentColor）
  var AUTO_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
    '<g stroke-width="2.3"><path d="M14 9l14 14M34 9L20 23"/><path d="M11 6.5l3.5 1 .9 3.2M37 6.5l-3.5 1-.9 3.2"/></g>' +   // 交叉雙劍（劍身＋劍尖）
    '<g stroke-width="2.6"><path d="M25 20.5l4.5 4.5M23 20.5L18.5 25"/><path d="M29.5 27l2.5 2.5M18.5 27L16 29.5"/></g>' +   // 護手＋劍柄
    '<text x="24" y="40" text-anchor="middle" fill="currentColor" stroke="none" font-size="10.5" font-weight="800" font-family="Arial,Helvetica,sans-serif" letter-spacing=".3">AUTO</text></svg>';
  function pauseKey() { return 'my_autopause_' + (typeof currentSlot !== 'undefined' ? currentSlot : ''); }
  function isPaused() { try { return localStorage.getItem(pauseKey()) === '1'; } catch (e) { return false; } }
  function setPaused(v) {
    try { if (v) localStorage.setItem(pauseKey(), '1'); else localStorage.removeItem(pauseKey()); } catch (e) {}
    renderAuto();
  }
  function renderAuto() {
    var b = $('lmui-auto'); if (b) b.classList.toggle('off', hasP() && isPaused());
    // AUTO 開著：旁邊彈出「掛機紀錄」「掛機設定」（站長：開始掛機時動畫跳出兩個按鈕）；暫停就收回去
    var run = hasP() && !isPaused(), pop = $('lmui-autopop'); if (pop) pop.classList.toggle('on', run);
    if (run && (!sess || sess.who !== player)) sessStart();   // 讀檔時 AUTO 本來就開著、換了角色
    else if (!run && sess && !sess.end) sess.end = Date.now();
  }

  // ── 掛機紀錄：按 AUTO 開始那一刻起打到的物品、經驗、金幣、擊殺數 ──────────
  //   只在記憶體（關掉遊戲就沒了）；換角色、重新按 AUTO 開始都重算；暫停時時間停住。
  //   「打到的」＝核心 killMob 裡面同步給的（掉寶都在那裡給），商店買的、做的不算；離線結算（state.ff）不算，那是離線紀錄的事
  var sess = null, inKill = 0;
  function sessStart() { sess = { who: player, t0: Date.now(), end: 0, kills: 0, exp: 0, gold: 0, items: {}, order: [] }; }
  function sessLive() { return !!(sess && !sess.end && hasP() && sess.who === player && !(typeof state !== 'undefined' && state && state.ff)); }
  function expGain(l0, e0, l1, e1) {   // 升級時核心扣掉該級需求、經驗歸到新等級：跨級要把中間每級的需求加回來
    if (l1 === l0) return Math.max(0, e1 - e0);
    if (l1 < l0 || typeof getExpReq !== 'function') return 0;
    var s = getExpReq(l0) - e0; for (var l = l0 + 1; l < l1; l++) s += getExpReq(l);
    return Math.max(0, s + e1);
  }
  function hookHuntLog() {
    if (typeof window.killMob === 'function') {
      var _km = window.killMob;
      window.killMob = function (idx) {
        var live = sessLive(), m = live && typeof mapState !== 'undefined' && mapState.mobs ? mapState.mobs[idx] : null, was = !!(m && !m._dead), l0 = live ? player.lv : 0, e0 = live ? player.exp : 0;
        inKill++;
        try { return _km.apply(this, arguments); }
        finally {
          inKill--;
          try { if (live && sessLive()) { if (was && m._dead) sess.kills++; sess.exp += expGain(l0, e0, player.lv, player.exp); } } catch (e) {}
        }
      };
    }
    if (typeof window.gainItem === 'function') {
      var _gi = window.gainItem;
      window.gainItem = function (id, cnt) {
        var r = _gi.apply(this, arguments);
        try {
          if (inKill && r !== false && sessLive() && typeof DB !== 'undefined' && DB.items[id]) {
            if (!sess.items[id]) { sess.items[id] = 0; sess.order.push(id); }
            sess.items[id] += (cnt == null ? 1 : +cnt || 1);
          }
        } catch (e) {}
        return r;
      };
    }
  }
  function showHuntLog() {
    var old = $('lmui-huntlog'); if (old) old.remove();
    var ov = document.createElement('div'); ov.id = 'lmui-huntlog';
    ov.innerHTML = '<div class="box"><div class="hd">掛機紀錄<button type="button" data-x="1" aria-label="關閉">✕</button></div><div class="bd"></div></div>';
    var bd = ov.querySelector('.bd'), timer = 0;
    function close() { clearInterval(timer); ov.remove(); }
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-x]')) close(); });
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var lastSig = '';
    function draw() {
      if (!ov.isConnected) { clearInterval(timer); return; }
      var s = sess && sess.who === player ? sess : null;
      var sec = s ? Math.floor(((s.end || Date.now()) - s.t0) / 1000) : 0, two = function (n) { return (n < 10 ? '0' : '') + n; };
      var stat = function (k, v) { return '<span><i>' + k + '</i><b>' + v + '</b></span>'; };
      var head = '<div class="mi-stats">' + stat('時間', Math.floor(sec / 3600) + ':' + two(Math.floor(sec / 60) % 60) + ':' + two(sec % 60)) + stat('擊殺', s ? s.kills.toLocaleString() : 0) +
        stat('經驗', '+' + (s ? s.exp.toLocaleString() : 0)) + stat('金幣', '+' + (s ? s.gold.toLocaleString() : 0)) + '</div>';
      var sig = s ? s.order.length + ':' + s.order.map(function (id) { return s.items[id]; }).join(',') : '';
      if (sig === lastSig && bd.firstChild) { bd.firstChild.outerHTML = head; return; }   // 物品沒變：只換上面的數字（清單不重畫，捲動位置留著）
      lastSig = sig;
      var rows = s && s.order.length ? s.order.slice().reverse().map(function (id) {
        var it = DB.items[id], cls = typeof getItemColor === 'function' ? getItemColor({ id: id }) : '', icon = typeof getIconUrl === 'function' ? getIconUrl(it) : '';
        return '<div class="mi-drop tip-host" data-tip-id="' + id + '"><img src="' + icon + '" alt="" onerror="this.style.visibility=\'hidden\'"><span class="nm ' + cls + '">' + esc(it.n) + '</span><span class="rt">×' + s.items[id].toLocaleString() + '</span></div>';
      }).join('') : '<div class="mi-none">還沒打到東西。</div>';
      bd.innerHTML = head + '<div class="mi-sub">打到的物品</div>' + rows;
    }
    document.body.appendChild(ov);
    draw(); timer = setInterval(draw, 1000);
  }
  function hookPause() {
    if (typeof window.tick !== 'function') { console.warn('[AFK-lmui] 找不到核心 tick，AUTO 開關停用。'); return; }
    var _origTick = window.tick;
    window.tick = function () {
      window.AFK_AUTO_OFF = !!(on() && hasP() && isPaused());   // 核心照跑，只告訴它「不要自動打怪」（見上方說明）
      return _origTick.apply(this, arguments);
    };
    // 玩家自己換到另一個獵場 → AUTO 先關，到了再按開始；回村、復活、載入（force）不動
    if (typeof window.changeMap === 'function') {
      var _origCM = window.changeMap;
      window.changeMap = function (force) {
        var prev = (typeof mapState !== 'undefined' && mapState) ? mapState.current : null;
        var r = _origCM.apply(this, arguments);
        try {
          // 走傳送點（樓梯、洞口：afk-townmap 換圖時設 AFK_TM_PORTAL_HOP）不算自己換獵場，AUTO 維持原狀
          if (force !== true && !window.AFK_TM_PORTAL_HOP && on() && hasP() && mapState.current && mapState.current !== prev && !inTownView()) setPaused(true);
        } catch (e) {}
        return r;
      };
    }
    setInterval(renderAuto, 500);
  }

  // ── 掉落分頁：打怪掉的東西＋怪物給的金幣 ─────────────────
  //   掉落物：核心 gainItem 寫進系統日誌的「怪名 給你 物品 。」（.sys-item-gain）抄一份到 #lmui-ch-drop；系統分頁不再顯示這些行。
  //   金幣：核心 killMob 加錢後呼叫 window.onMobGoldDrop（核心本來就不逐殺記金幣，怕洗系統日誌）→ 只寫進這裡。
  var DROP_MAX = 100;
  function dropLine(html) {
    var b = chBox('drop');
    b.insertAdjacentHTML('beforeend', '<div class="log-entry text-slate-100">' + html + '</div>');
    while (b.children.length > DROP_MAX) b.removeChild(b.firstChild);
  }
  function hookDrops() {
    if (typeof window.logSys === 'function') {
      var _origLog = window.logSys;
      window.logSys = function (msg) {
        var r = _origLog.apply(this, arguments);
        try { if (on() && !(typeof state !== 'undefined' && state && state.ff) && String(msg).indexOf('sys-item-gain') >= 0) dropLine(msg); } catch (e) {}
        return r;
      };
    }
    window.onMobGoldDrop = function (mob, g) {
      try { if (g > 0 && sessLive()) sess.gold += g; } catch (e) {}   // 掛機紀錄的金幣
      try {
        if (!on() || !mob || !(g > 0) || (typeof state !== 'undefined' && state && state.ff)) return;
        var mc = (typeof getMobColor === 'function') ? getMobColor(mob.lv) : '';
        dropLine('<span class="sys-item-gain"><span class="' + mc + '">' + escTxt(mob.n || '') + '</span> 給你 <span class="text-yellow-300 font-bold">' + Number(g).toLocaleString() + ' 金幣</span> 。</span>');
      } catch (e) {}
    };
  }

  function navBtn(view) { var n = $('m-nav'); return n ? n.querySelector('.m-nav-btn[data-view="' + view + '"]') : null; }
  function openRightTab(btnId) {
    var nb = navBtn('right'); if (nb) nb.click();
    var b = $(btnId); if (b) b.click();
  }
  function toggleMap() { document.body.classList.toggle('lmui-map'); }
  function closeMap() { document.body.classList.remove('lmui-map'); }
  function aliveIdx() {
    var out = [];
    if (typeof mapState === 'undefined' || !mapState || !mapState.mobs) return out;
    for (var i = 0; i < mapState.mobs.length; i++) { var m = mapState.mobs[i]; if (m && !m._dead) out.push(i); }
    return out;
  }
  function useSlot(s) {
    if (!s.kind) { openHotPick(slots.indexOf(s)); return; }   // 空格：直接打開設定
    if (s.kind === 'skill') {
      var sk = DB.skills[s.id];
      try { if (sk && sk.type === 'manual') manualCast(s.id); else if (typeof castSkill === 'function') castSkill(s.id); } catch (e) { console.warn('[AFK-lmui] 施放失敗', e); }
    }
    else if (s.kind === 'item') { var u = s.uid || hotItemUid(s.id); if (u) { try { useItem(u); } catch (e) { console.warn('[AFK-lmui] 使用道具失敗', e); } } }
  }

  // ── 快捷列自訂（F1~F12）──────────────────────────────
  //   player.lmHot＝12 格 [{k:'skill'|'item', id}|null]，跟著角色存檔；沒設過＝照舊自動排（手動技能→藥水/瞬移卷軸，只排前 6 格）。
  //   第一次指定任一格時，把當下自動排好的那 6 格抄進來再改，畫面不會突然跳掉。
  function hotCustom() { return hasP() && Array.isArray(player.lmHot) ? player.lmHot : null; }
  function hotItemUid(id) {
    if (!hasP() || !player.inv) return null;
    var best = null;
    player.inv.forEach(function (it) { if (it && it.id === id && (+it.cnt || 0) > 0 && (!best || (best.lock && !it.lock))) best = it; });
    return best ? best.uid : null;
  }
  function hotItemCount(id) {
    var n = 0;
    if (hasP() && player.inv) player.inv.forEach(function (it) { if (it && it.id === id) n += (+it.cnt || 0); });
    return n;
  }
  function hotSkillOk(id) {
    var sk = DB.skills[id];
    return !!(sk && !sk.procOnly && sk.type !== 'passive' && player.skills && player.skills.indexOf(id) !== -1);
  }
  function hotItemOk(d, id) {
    return !!(d && !d.noUse && id !== 'scroll_revive' && d.type !== 'skillbk' && ['wpn', 'arm', 'acc'].indexOf(d.type) === -1 && (d.type === 'pot' || d.eff));
  }
  function hotSave() { try { if (hasP() && typeof saveGame === 'function') saveGame(); } catch (e) { console.warn('[AFK-lmui] 快捷列存檔失敗', e); } }
  function setHotSlot(i, entry) {
    if (!hasP()) return;
    if (!hotCustom()) {
      var auto = autoHotPlan();
      player.lmHot = [];
      for (var j = 0; j < HOT_SLOTS; j++) player.lmHot.push(auto[j] ? { k: auto[j].kind, id: auto[j].id } : null);
    }
    player.lmHot[i] = entry;
    lastHotKey = ''; updateHot(); hotSave();
  }
  function hotMode() { try { var m = +localStorage.getItem(HOT_MODE_KEY); return m === 1 || m === 2 ? m : 0; } catch (e) { return 0; } }
  function applyHotMode() {
    var box = $('lmui-hot'), btn = $('lmui-hotmode'); if (!box || !btn) return;
    var m = hotMode();
    box.setAttribute('data-mode', String(m));
    document.body.classList.toggle('lmui-hot2', m === 2);   // 精簡版面兩排快捷列要多留一排高度
    btn.innerHTML = '<b>▾</b>' + (m === 0 ? '1~6' : m === 1 ? '7~12' : '全部');
  }
  function bindHot() {
    var pressT = null, longAt = 0;
    slots.forEach(function (s, i) {
      s.el.addEventListener('click', function () { if (Date.now() - longAt < 700) return; useSlot(s); });
      s.el.addEventListener('contextmenu', function (e) { e.preventDefault(); longAt = Date.now(); openHotPick(i); });
      var start = function () { clearTimeout(pressT); pressT = setTimeout(function () { longAt = Date.now(); openHotPick(i); }, 500); };
      var stop = function () { clearTimeout(pressT); };
      s.el.addEventListener('touchstart', start, { passive: true });
      s.el.addEventListener('mousedown', function (e) { if (e.button === 0) start(); });
      ['touchend', 'touchmove', 'touchcancel', 'mouseup', 'mouseleave'].forEach(function (ev) { s.el.addEventListener(ev, stop, { passive: true }); });
    });
    var mb = $('lmui-hotmode');
    if (mb) mb.addEventListener('click', function () {
      try { localStorage.setItem(HOT_MODE_KEY, String((hotMode() + 1) % 3)); } catch (e) {}
      applyHotMode();
    });
    applyHotMode();
  }
  function closeHotPick() { var ov = $('lmui-hotpick'); if (ov) ov.remove(); }
  function openHotPick(i) {
    if (!hasP() || i < 0) return;
    closeHotPick();
    var cur = (hotCustom() || [])[i] || (!hotCustom() && autoHotPlan()[i] ? { k: autoHotPlan()[i].kind, id: autoHotPlan()[i].id } : null);
    var opt = function (k, id, d, extra) {
      var on = cur && cur.k === k && cur.id === id;
      var src = (typeof getIconUrl === 'function') ? getIconUrl(d, k === 'skill') : '';
      return '<button type="button" class="opt' + (on ? ' on' : '') + '" data-k="' + k + '" data-id="' + id + '"><img src="' + src + '" alt="" onerror="this.style.visibility=&quot;hidden&quot;"><span>' + (d.n || id) + (extra || '') + '</span></button>';
    };
    var sk = [];
    for (var id in DB.skills) if (hotSkillOk(id)) sk.push(id);
    sk.sort(function (a, b) { var A = DB.skills[a], B = DB.skills[b]; return (A.type === 'manual' ? 0 : 1) - (B.type === 'manual' ? 0 : 1) || (+A.tier || 0) - (+B.tier || 0); });
    var items = [], seen = {};
    (player.inv || []).forEach(function (it) { var d = it && DB.items[it.id]; if (d && !seen[it.id] && hotItemOk(d, it.id)) { seen[it.id] = 1; items.push(it.id); } });
    items.sort(function (a, b) { var ia = HOT_ITEM_ORDER.indexOf(a), ib = HOT_ITEM_ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    var ov = document.createElement('div');
    ov.id = 'lmui-hotpick';
    ov.innerHTML = '<div class="box"><div class="hd">F' + (i + 1) + ' 要放什麼？<button type="button" data-x="1" aria-label="關閉">✕</button></div><div class="bd">' +
      '<div class="grid" data-pane="sk">' + (sk.map(function (id) { return opt('skill', id, DB.skills[id]); }).join('') || '<span style="color:#94a3b8;font-size:12px;">還沒學會魔法</span>') + '</div>' +
      '<div class="grid" data-pane="it" style="display:none;">' + (items.map(function (id) { return opt('item', id, DB.items[id], ' ×' + hotItemCount(id)); }).join('') || '<span style="color:#94a3b8;font-size:12px;">背包沒有可用的道具</span>') + '</div>' +
      '</div><div class="ft"><button type="button" data-clear="1">清空這格</button><button type="button" data-auto="1">全部改回自動排列</button></div></div>';
    ov.querySelector('.bd').insertAdjacentHTML('beforebegin', '<div class="tabs"><button type="button" data-tab="sk" class="on">魔法</button><button type="button" data-tab="it">道具</button></div>');
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('[data-x]')) { closeHotPick(); return; }
      var tb = e.target.closest('[data-tab]');
      if (tb) {
        var t = tb.getAttribute('data-tab');
        ov.querySelectorAll('[data-tab]').forEach(function (x) { x.classList.toggle('on', x === tb); });
        ov.querySelectorAll('[data-pane]').forEach(function (x) { x.style.display = x.getAttribute('data-pane') === t ? '' : 'none'; });
        return;
      }
      if (e.target.closest('[data-clear]')) { setHotSlot(i, null); closeHotPick(); return; }
      if (e.target.closest('[data-auto]')) { if (hasP()) { delete player.lmHot; lastHotKey = ''; updateHot(); hotSave(); } closeHotPick(); return; }
      var b = e.target.closest('.opt'); if (!b) return;
      setHotSlot(i, { k: b.getAttribute('data-k'), id: b.getAttribute('data-id') });
      closeHotPick();
    });
    if (cur && cur.k === 'item') { var itb = ov.querySelector('[data-tab="it"]'); if (itb) itb.click(); }
    document.body.appendChild(ov);
  }
  // ── 怪物資訊小視窗：點戰鬥畫面上的怪 → 資料＋掉落物與機率（點怪原本的「鎖定目標」照舊） ──
  //   掉落表＝上游 MOB_DROPS 等（[物品id, 機率%]，每樣各自擲一次，見 js/05 killMob）；本職不能拿的試煉道具照上游 trialDropBlocked 不列。
  //   這隻是席琳的世界（×3／瘋狂×5）或恩賜怪（×10）時，機率直接乘上去顯示（同 killMob 的 _dropBase）。
  var ELE_NAME = { fire: '火', water: '水', earth: '地', wind: '風' };
  function dropTables() {   // 上游是頂層 const（不在 window 上，但同一個全域作用域讀得到）；少哪張就跳過
    return [
      typeof MOB_DROPS !== 'undefined' ? MOB_DROPS : null,
      typeof DARK_WEAPON_DROPS !== 'undefined' ? DARK_WEAPON_DROPS : null,
      typeof DARK_CRYSTAL_DROPS !== 'undefined' ? DARK_CRYSTAL_DROPS : null
    ];
  }
  function mobDropList(name) {
    var out = {}, order = [];
    dropTables().forEach(function (tbl) {
      var list = tbl && tbl[name]; if (!list) return;
      list.forEach(function (en) {
        var id = Array.isArray(en) ? en[0] : en, rate = Array.isArray(en) ? +en[1] : NaN;
        if (!id || !DB.items[id]) return;
        try { if (typeof trialDropBlocked === 'function' && trialDropBlocked(id)) return; } catch (e) {}
        if (!(id in out)) { out[id] = rate; order.push(id); }
      });
    });
    return order.map(function (id) { return { id: id, rate: out[id] }; });
  }
  function fmtRate(r) {
    if (!isFinite(r)) return '—';
    if (r >= 100) return '100%';
    if (r >= 1) return (Math.round(r * 10) / 10) + '%';
    return parseFloat(r.toPrecision(2)) + '%';
  }
  function showMobInfo(mob, basic) {
    if (!mob || typeof DB === 'undefined') return;
    var base = DB.mobs && Object.keys(DB.mobs).filter(function (k) { return DB.mobs[k].n === mob.n; })[0];
    var d = (base && DB.mobs[base]) || mob;
    var mult = mob._grace ? 10 : (mob._sherine ? (mob._sherineMad ? 5 : 3) : 1);
    var drops = mobDropList(mob.n);
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var tags = [d.race, d.s === 'L' ? '大型' : (d.s === 'S' ? '小型' : ''), d.beh, d.un ? '不死' : ''].filter(Boolean).map(function (t) { return '<span class="mi-tag">' + esc(t) + '</span>'; }).join('');
    // 不死系／惡魔系另外標出來（夜晚會變強、怕祝福武器）；其他種族不加
    var ek = (typeof evilKind === 'function') ? evilKind(d) : '';
    if (ek) tags += '<span class="mi-tag mi-evil">' + (ek === 'undead' ? '不死系' : '惡魔系') + ((typeof isNightTime === 'function' && isNightTime()) ? '・夜晚強化中' : ((mob.boss || d.boss) ? '・強化中' : '')) + '</span>';
    var stat = function (k, v) { return '<span><i>' + k + '</i><b>' + v + '</b></span>'; };
    var hp = (mob.curHp != null ? Math.max(0, Math.round(mob.curHp)) + ' / ' : '') + (mob.hp || d.hp);
    var rows = drops.length ? drops.map(function (x) {
      var it = DB.items[x.id];
      var cls = typeof getItemColor === 'function' ? getItemColor({ id: x.id }) : '';
      var icon = typeof getIconUrl === 'function' ? getIconUrl(it) : '';
      return '<div class="mi-drop tip-host" data-tip-id="' + x.id + '" data-tip-craft="1"><img src="' + icon + '" alt="" onerror="this.style.visibility=\'hidden\'"><span class="nm ' + cls + '">' + esc(it.n) + '</span><span class="rt">' + fmtRate(x.rate * mult) + '</span></div>';
    }).join('') : '<div class="mi-none">沒有專屬掉落物</div>';
    var box = $('lmui-mobinfo');
    if (!box) {
      box = document.createElement('div'); box.id = 'lmui-mobinfo'; box.className = 'lmui-hit';
      hud.appendChild(box);
      box.addEventListener('click', function (e) { if (e.target.closest('.mi-x')) document.body.classList.remove('lmui-mobinfo'); });
    }
    box.innerHTML = '<div class="mi-hd"><span class="mi-name' + (d.boss ? ' boss' : '') + '">' + (d.boss ? '👑 ' : '') + esc(mob.n) + '</span><span class="mi-lv">Lv.' + (mob.lv || d.lv) + '</span><button type="button" class="mi-x" aria-label="關閉">✕</button></div>' +
      '<div class="mi-tags">' + tags + (d.e && ELE_NAME[d.e] ? '<span class="mi-tag ele-' + d.e + '">' + ELE_NAME[d.e] + '屬性</span>' : '') + '</div>' +
      '<div class="mi-stats">' + stat('HP', hp) + stat('防禦', d.ac) + stat('魔防', d.mr) + stat('經驗', d.exp) + stat('金幣', (d.goldMin || 0) + '~' + (d.goldMax || 0)) + '</div>' +
      (basic ? '' : '<div class="mi-sub">掉落物' + (mult > 1 ? '<em>（已含 ×' + mult + '）</em>' : '') + '</div>' +
      '<div class="mi-list">' + rows + '</div>');
    document.body.classList.add('lmui-mobinfo');
  }
  function showMapDrops() {
    if (typeof DB === 'undefined' || typeof mapState === 'undefined' || !mapState) return;
    var old = $('lmui-mapdrops'); if (old) old.remove();
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var pool = (DB.maps && DB.maps[mapState.current]) || [], seen = {}, ids = [];
    pool.forEach(function (id) { if (DB.mobs[id] && !seen[id]) { seen[id] = 1; ids.push(id); } });
    ids.sort(function (a, b) { var A = DB.mobs[a], B = DB.mobs[b]; return (A.boss ? 1 : 0) - (B.boss ? 1 : 0) || (A.lv || 0) - (B.lv || 0); });
    var sher = (typeof player !== 'undefined' && player && (player.sherineMad ? 5 : (player.sherineWorld ? 3 : 1))) || 1;
    var stat = function (k, v) { return '<span><i>' + k + '</i><b>' + v + '</b></span>'; };
    var html = ids.map(function (id) {
      var d = DB.mobs[id], drops = mobDropList(d.n);
      var rows = drops.length ? drops.map(function (x) {
        var it = DB.items[x.id];
        var cls = typeof getItemColor === 'function' ? getItemColor({ id: x.id }) : '';
        var icon = typeof getIconUrl === 'function' ? getIconUrl(it) : '';
        return '<div class="mi-drop tip-host" data-tip-id="' + x.id + '" data-tip-craft="1"><img src="' + icon + '" alt="" onerror="this.style.visibility=\'hidden\'"><span class="nm ' + cls + '">' + esc(it.n) + '</span><span class="rt">' + fmtRate(x.rate * sher) + '</span></div>';
      }).join('') : '<div class="mi-none">沒有專屬掉落物</div>';
      return '<div class="md-mob"><div class="mi-hd"><span class="mi-name' + (d.boss ? ' boss' : '') + '">' + (d.boss ? '👑 ' : '') + esc(d.n) + '</span><span class="mi-lv">Lv.' + d.lv + '</span></div>' +
        '<div class="mi-stats">' + stat('HP', d.hp) + stat('防禦', d.ac) + stat('魔防', d.mr) + stat('經驗', d.exp) + stat('金幣', (d.goldMin || 0) + '~' + (d.goldMax || 0)) + '</div>' + rows + '</div>';
    }).join('');
    var mapName = (typeof mapDisplayName === 'function' ? mapDisplayName(mapState.current) : '') || (($('lmui-mapname') || {}).textContent || '').trim() || '這張地圖';
    var ov = document.createElement('div');
    ov.id = 'lmui-mapdrops';
    ov.innerHTML = '<div class="box"><div class="hd">' + esc(mapName) + (sher > 1 ? '（掉率已含 ×' + sher + '）' : '') + '<button type="button" data-x="1" aria-label="關閉">✕</button></div>' +
      '<div class="bd">' + (html || '<div class="mi-none" style="text-align:center;padding:24px 0;">這裡沒有怪物。</div>') + '</div></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-x]')) ov.remove(); });
    document.body.appendChild(ov);
  }
  window.lmuiShowMapDrops = showMapDrops;
  function bindMobClick() {
    var list = $('mob-list'); if (!list || list._lmuiMobInfo) return;
    list._lmuiMobInfo = true;
    list.addEventListener('click', function (e) {
      if (!document.body.classList.contains('lmui-battle')) return;
      var card = e.target.closest('.mob-target[data-uid]'); if (!card) return;
      var uid = card.getAttribute('data-uid');
      var mob = (typeof mapState !== 'undefined' && mapState && mapState.mobs || []).filter(function (m) { return m && m.uid === uid; })[0];
      if (mob) { try { showMobInfo(mob, true); } catch (err) { console.warn('[AFK-lmui] 怪物資訊失敗', err); } }
    });
  }

  // ── 狩獵場（選地圖）：依類型分頁（村莊/野外/地監/世界王/時空裂痕），取代上游「地區」下拉 ──
  //   清單＝上游 MAP_CATEGORIES；能不能進＝上游 mapOptDisabled；移動＝上游 setMapSelectors + changeMap（受控狀態由它自己擋）。
  //   右欄：安全區／怪物等級範圍（由該圖出怪池的 DB.mobs.lv 算）／未開放。
  var MAP_TABS = [
    { k: 'town', name: '村莊' }, { k: 'wild', name: '野外' }, { k: 'dungeon', name: '地監' }, { k: 'boss', name: '世界王' }, { k: 'rift', name: '時空裂痕' }
  ];
  var mapTab = 'town', mapLvCache = {};
  function mapTabOf(cat, v) {
    if (/^town_/.test(v)) return 'town';
    if (cat === 'wild' || v === 'pirate_wild') return 'wild';
    if (cat === 'dungeon' || cat === 'tower' || cat === 'pirate_island') return 'dungeon';
    if (cat === 'special') return 'boss';
    if (cat === 'rift') return 'rift';
    return 'wild';
  }
  function mapList(tab) {
    if (typeof MAP_CATEGORIES === 'undefined') return [];
    var out = [], seen = {};
    Object.keys(MAP_CATEGORIES).forEach(function (cat) {
      MAP_CATEGORIES[cat].forEach(function (m) {
        if (!m || !m.v || seen[m.v] || mapTabOf(cat, m.v) !== tab) return;
        if (m.closed || (m.classicHide && player.classicMode)) return;
        seen[m.v] = 1; out.push(m);
      });
    });
    return out;
  }
  function mapLvText(v) {
    if (v in mapLvCache) return mapLvCache[v];
    var pool = (typeof DB !== 'undefined' && DB.maps && DB.maps[v]) || [], lo = Infinity, hi = -Infinity;
    pool.forEach(function (mid) { var mb = DB.mobs && DB.mobs[mid]; var lv = mb && +mb.lv; if (lv) { if (lv < lo) lo = lv; if (lv > hi) hi = lv; } });
    return (mapLvCache[v] = isFinite(lo) ? ('Lv.' + lo + (hi > lo ? '~' + hi : '')) : '');
  }
  function renderMaps() {
    var box = $('lmui-maps'); if (!box || !hasP()) return;
    var cur = ($('map-select') || {}).value || '';
    var tabs = MAP_TABS.map(function (t) { return '<button type="button" data-mt="' + t.k + '" class="' + (t.k === mapTab ? 'on' : '') + '">' + t.name + '</button>'; }).join('');
    var rows = mapList(mapTab).map(function (m) {
      var off = false; try { off = typeof mapOptDisabled === 'function' && mapOptDisabled(m); } catch (e) {}
      var right = off ? '未開放' : (/^town_/.test(m.v) ? '安全區' : mapLvText(m.v));
      return '<button type="button" class="lm-row' + (m.v === cur ? ' cur' : '') + (off ? ' off' : '') + '" data-map="' + m.v + '"' + (off ? ' disabled' : '') + '>' +
        '<span class="nm"' + (m.c && !off ? ' style="color:' + m.c + '"' : '') + '>' + m.t + '</span><span class="rt">' + right + '</span></button>';
    }).join('');
    box.innerHTML = '<div class="lm-tabs">' + tabs + '</div><div class="lm-list">' + rows + '</div>';
  }
  function ensureMaps() {
    var box = $('lmui-maps'); if (box) return box;
    box = document.createElement('div'); box.id = 'lmui-maps'; box.className = 'lmui-hit';
    hud.appendChild(box);
    box.addEventListener('click', function (e) {
      var t = e.target.closest('[data-mt]'); if (t) { mapTab = t.getAttribute('data-mt'); renderMaps(); return; }
      var r = e.target.closest('.lm-row'); if (!r || r.disabled) return;
      var v = r.getAttribute('data-map');
      closeMaps();
      try { if (typeof setMapSelectors === 'function') setMapSelectors(v); var ms = $('map-select'); if (ms) ms.value = v; if (typeof changeMap === 'function') changeMap(); }
      catch (err) { console.warn('[AFK-lmui] 換地圖失敗', err); }
    });
    return box;
  }
  function openMaps() {
    ensureMaps();
    var cur = ($('map-select') || {}).value || '';
    if (typeof MAP_CATEGORIES !== 'undefined' && cur) { try { mapTab = mapTabOf(mapCategoryOf(cur), cur); } catch (e) {} }   // 打開時跳到目前所在那一類
    renderMaps();
    document.body.classList.add('lmui-maps');
    var curRow = document.querySelector('#lmui-maps .lm-row.cur'); if (curRow) try { curRow.scrollIntoView({ block: 'nearest' }); } catch (e) {}
  }
  function closeMaps() { document.body.classList.remove('lmui-maps'); }
  function toggleMaps() { if (document.body.classList.contains('lmui-maps')) closeMaps(); else openMaps(); }

  // 切換功能（工具列/子分頁）前，把目前開著的視窗都關掉，不要疊在新頁面上。
  //   一律走各視窗「自己的」關閉路徑（核心 closeModal、視窗裡的關閉鈕），不直接刪 DOM——
  //   有的視窗關閉時要收尾（存設定、交還返回鍵歷史層），有的是常駐節點只切 class，刪了下次就開不起來。
  var CLOSE_TEXT = /^(✕|×|x|X|關閉|返回|Close)$/;
  function findCloseBtn(root) {
    var cand = root.querySelectorAll('button, [role="button"], .close, [aria-label*="關閉"]');
    for (var i = 0; i < cand.length; i++) {
      var c = cand[i];
      if (!c.getClientRects().length) continue;
      var label = (c.getAttribute('aria-label') || '') + ' ' + (c.className || '');
      if (CLOSE_TEXT.test((c.textContent || '').trim()) || /關閉|close/i.test(label)) return c;
    }
    return null;
  }
  function closeAllWindows() {
    var body = document.body;
    body.classList.remove('lmui-map', 'lmui-cmp', 'lmui-chatbig', 'lmui-townchat', 'lmui-maps', 'lmui-mobinfo', 'lmui-exitwin');
    var tic = $('town-interaction-close');   // 村莊 NPC 對話/商店
    if (tic && tic.getClientRects().length) { try { tic.click(); } catch (e) {} }
    var im = $('item-modal');
    if (im && !im.classList.contains('hidden') && typeof closeModal === 'function') { try { closeModal(); } catch (e) {} }
    if (body.classList.contains('mlog-open')) { var lc = $('m-log-close'); if (lc) lc.click(); else body.classList.remove('mlog-open'); }
    var list = document.querySelectorAll('#warehouse-window-frame,.lmui-below,.lmui-below-c,' + MODAL_HOSTS);
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      if (w.closest('#lmui-ashost')) continue;   // 背包「自動賣出」分類裡就地顯示的規則視窗：不是彈窗，離開分類時由 syncInlineAS 收
      if (!w.getClientRects().length || getComputedStyle(w).display === 'none') continue;
      var x = findCloseBtn(w);
      if (x) { try { x.click(); } catch (e) {} }
    }
  }
  // 聊天框取代完整日誌面板：世界頻道說話、工具列「聊天」（篩選分頁 2026-10-14 站長要求拿掉）
  //   （回村鈕已拿掉；打開聊天不會自動 focus 輸入框＝手機不會跳鍵盤，要打字自己點輸入框）
  // 聊天頻道：世界＝核心世界頻道（#world-log，由 worldChannelAsk 印）；一般／隊伍／血盟目前只在本機顯示自己說的話，
  //   存在三個不顯示的容器裡（只放記憶體、重新整理就清空），之後做線上版再把別人的訊息接進同一個容器。
  var CH_KEEP = 200;
  function chBox(ch) {
    var id = 'lmui-ch-' + ch, b = $(id);
    if (!b) {
      b = document.createElement('div'); b.id = id; b.style.display = 'none';
      document.body.appendChild(b);
      if (chatMo) chatMo.observe(b, { childList: true });
    }
    return b;
  }
  function escTxt(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function sendChat() {
    var say = $('lmui-say'), sel = $('lmui-ch');
    var v = say ? say.value.trim() : '';
    if (!v) return;
    if (typeof myChatCommand === 'function' && myChatCommand(v)) { say.value = ''; return; }   // 「.道具名稱 數量」測試寄信指令（js/00z）
    var ch = (sel && sel.value) || 'say';
    if (ch === 'world') {
      var src = $('world-input');
      if (!src || typeof worldChannelAsk !== 'function') return;
      src.value = v;
      try { worldChannelAsk(); } catch (e) { console.warn('[AFK-lmui] 世界頻道送出失敗', e); return; }
    } else {
      var me = (typeof player !== 'undefined' && player && player.name) ? player.name : '你';
      var nameHtml = (typeof _wcStaticNameHtml === 'function') ? _wcStaticNameHtml(me, player && player.alignmentValue) : escTxt(me);
      var box = chBox(ch), line = document.createElement('div');
      line.className = 'lmui-ch-line lmui-ch-' + ch;
      line.innerHTML = nameHtml + '：<span class="lmui-ch-msg">' + escTxt(v) + '</span>';
      box.appendChild(line);
      while (box.children.length > CH_KEEP) box.removeChild(box.firstChild);
    }
    say.value = '';
    chatTab = ch; lastChatSig = ''; chatDirty = true;
    try { renderChat(true); } catch (e) {}
  }
  function openChat() {
    if (!document.body.classList.contains('lmui-battle')) { chatTab = 'world'; openFullLog(); return; }   // 村莊沒有聊天框 → 照舊開日誌面板
    var b = navBtn('center'); if (b) b.click();
    chatTab = 'say'; lastChatSig = ''; chatDirty = true;
    document.body.classList.add('lmui-chatbig');
    if (document.body.classList.contains('lmui-town')) document.body.classList.add('lmui-townchat');   // 村莊：聊天框蓋在 NPC 卡片上，按其他工具就收回
    try { renderChat(true); } catch (e) {}
  }
  // 完整日誌面板（afk-mobile 的 #m-log-sheet；⇆ 在「戰鬥/系統」與「世界頻道」間切）——只剩村莊用
  function openFullLog() {
    var body = document.body;
    if (!body.classList.contains('mlog-open')) { var nb = navBtn('log'); if (nb) nb.click(); }
    var wantWorld = chatTab === 'world';
    if (body.classList.contains('mlog-sys') !== wantWorld) { var sw = document.querySelector('#m-log-sheet .m-log-sw'); if (sw) sw.click(); }
    if (!wantWorld) { try { switchLogTab(chatTab === 'combat' ? 'combat' : 'sys'); } catch (e) {} }
  }

  // ── 狀態判斷 ────────────────────────────────────────────
  function inGame() { var gs = $('game-screen'); return !!(gs && !gs.classList.contains('hidden')); }
  function isMobileGeom() { return !!(mq && mq.matches) && document.body.classList.contains('m-mobile'); }
  function inBattleMap() { var bv = $('battle-view'); return !!(bv && !bv.classList.contains('hidden')); }
  function inTownView() { var tv = $('town-view'); return !!(tv && !tv.classList.contains('hidden')); }
  // 村莊 NPC 卡片前面的小圖示（依職稱；跟參考圖一樣只是辨識用，不影響點擊）
  var NPC_EMO = [[/雜貨|商人|商店/, '💰'], [/倉庫/, '📦'], [/製作|鍛造|工匠/, '🔨'], [/試煉|任務/, '❗'], [/傭兵|協力/, '⚔️'], [/黑市/, '🎲'], [/魔法|傳授/, '📖'], [/收購|龍鑽/, '💎'], [/血盟/, '🛡️']];
  // 不顯示的 NPC：龍鑽收購（叫賣型）、傭兵公會（隊伍入口已拿掉）
  var NPC_HIDE = /龍鑽收購|傭兵公會|協力/;
  function hideNpcs() {
    var rows = document.querySelectorAll('#afk-npclist .afk-npcl-row');
    for (var i = 0; i < rows.length; i++) if (!rows[i].classList.contains('lmui-npc-off') && NPC_HIDE.test(rows[i].textContent || '')) rows[i].classList.add('lmui-npc-off');
    var npcs = document.querySelectorAll('#town-npc-map .town-npc');
    for (var j = 0; j < npcs.length; j++) {
      var lb = npcs[j].querySelector('.tn-label');
      if (lb && !npcs[j].classList.contains('lmui-npc-off') && NPC_HIDE.test(lb.textContent || '')) npcs[j].classList.add('lmui-npc-off');
    }
  }
  // 村莊地圖 NPC 重新站位：名字不疊、不被頭像/地圖名稱蓋住。
  //   照原本左右順序「像排文字一樣」逐排塞（量實際的名字寬度），一排塞不下就換下一排；
  //   排數多到上下放不下時，整隻 NPC（連名字）等比縮小再排一次。NPC 數量、畫面大小變了才重算。
  //   用 data-lmui-slot ＋ 樣式表 !important 蓋上游的內聯 left/top（上游之後再改內聯也不會抖）。
  //   .town-npc 以腳底為基準點（上游 transform:translate(-50%,-100%)）；縮放的原點也放在腳底，位置才不會跑掉。
  var NPC_TOP_PAD = 84;   // 上緣留給左上頭像/右上地圖名稱
  var npcLayoutSig = '';
  function layoutTownNpcs() {
    var map = $('town-npc-map'); if (!map) return;
    if (map.classList.contains('afk-tm-live')) {   // 動態村莊地圖：NPC 站在地圖上的位置，不重排（重排的 !important 會把他們排成一排）
      var placed = map.querySelectorAll('.town-npc[data-lmui-slot]');
      for (var pi = 0; pi < placed.length; pi++) placed[pi].removeAttribute('data-lmui-slot');
      npcLayoutSig = ''; return;
    }
    var W = map.clientWidth, H = map.clientHeight; if (!W || !H) return;
    // 只排看得到的（被本檔或其他外掛藏起來的 NPC，例如黑市潘朵拉，量不到大小、也不該佔位）
    var all = Array.prototype.slice.call(map.querySelectorAll('.town-npc:not(.lmui-npc-off)')).filter(function (e) { return e.offsetParent !== null; });
    if (!all.length) return;
    all.sort(function (a, b) { return (parseFloat(a.style.left) || 0) - (parseFloat(b.style.left) || 0); });
    var names = all.map(function (e) { var nm = e.querySelector('.tn-name'); return nm ? nm.textContent : ''; }).join(',');
    all.forEach(function (e, i) { if (e.getAttribute('data-lmui-slot') !== String(i)) e.setAttribute('data-lmui-slot', i); });
    // 簽章含每隻的高度：NPC 圖晚載入（尺寸變了）也會重排，不會沿用載入前量到的高度把名字推進上方 HUD
    var sig = names + '|' + W + 'x' + H + '|' + all.map(function (e) { var lb = e.querySelector('.tn-label'); return e.offsetHeight + ':' + (lb ? lb.offsetTop : 0); }).join(',');
    if (sig === npcLayoutSig) return;
    var items = all.map(function (e) {
      var lb = e.querySelector('.tn-label');
      var lw = lb ? lb.offsetWidth : 80;
      // 實際高度＝名字標籤頂端到腳底：上游會把某些 NPC 的名字放得比圖高很多（頭上留一段），只算「圖高＋標籤高」會低估
      var top = lb ? Math.min(0, lb.offsetTop) : -24;
      return { w: Math.max(lw, e.offsetWidth), h: e.offsetHeight - top };
    });
    if (items.some(function (it) { return !it.h; })) return;   // 圖還沒載完量不到高度，下一輪再排
    npcLayoutSig = sig;
    var avail = H - NPC_TOP_PAD - 4, s = 1, rows = null, heights = null;
    [1, 0.9, 0.8, 0.7, 0.6, 0.5].some(function (sc) {
      s = sc; rows = []; var cur = [], curW = 0;
      items.forEach(function (it, i) {
        var w = it.w * sc + 8;
        if (cur.length && curW + w > W - 6) { rows.push(cur); cur = []; curW = 0; }
        cur.push(i); curW += w;
      });
      if (cur.length) rows.push(cur);
      heights = rows.map(function (r) { return Math.max.apply(null, r.map(function (i) { return items[i].h; })) * sc + 6; });
      return heights.reduce(function (a, b) { return a + b; }, 0) <= avail;
    });
    var extra = Math.max(0, (avail - heights.reduce(function (a, b) { return a + b; }, 0)) / rows.length);
    var css = '', y = NPC_TOP_PAD;
    rows.forEach(function (r, ri) {
      y += heights[ri] + extra;
      var foot = y - extra / 2;
      var tw = r.reduce(function (a, i) { return a + items[i].w * s; }, 0);
      var gap = (W - tw) / (r.length + 1), x = gap;
      r.forEach(function (i) {
        var cx = x + items[i].w * s / 2; x += items[i].w * s + gap;
        css += 'html body.lmui-town #town-npc-map .town-npc[data-lmui-slot="' + i + '"]{left:' + (cx / W * 100).toFixed(2) + '% !important;top:' + (foot / H * 100).toFixed(2) + '% !important;' +
          'transform:translate(-50%,-100%) scale(' + s + ') !important;transform-origin:50% 100% !important;z-index:' + (600 + Math.round(foot)) + ' !important;}\n';
      });
    });
    var st = $('lmui-npcpos');
    if (!st) { st = document.createElement('style'); st.id = 'lmui-npcpos'; document.head.appendChild(st); }
    st.textContent = css;
  }
  // NPC 對話標題「名字（職稱）」＋金幣；製作清單材料不足的按鈕改成灰色「材料不足」
  function decorateInteraction() {
    var box = $('town-interaction-container');
    if (!box || box.classList.contains('hidden')) return;
    var t = $('interaction-npc-title');
    if (t) { var m = (t.textContent || '').match(/^\s*[\[［](.+)[\]］]\s*$/); if (m) t.textContent = '（' + m[1] + '）'; }
    var hd = $('town-interaction-header'), close = $('town-interaction-close');
    if (hd && close) {
      var g = $('lmui-ihead-gold');
      if (!g) { g = document.createElement('span'); g.id = 'lmui-ihead-gold'; hd.insertBefore(g, close); }
      setTxt(g, '💰 ' + (txt('st-gold') || '0'));
    }
    var items = document.querySelectorAll('#interaction-content .list-item');
    for (var i = 0; i < items.length; i++) {
      var btn = items[i].querySelector('button.btn[onclick*="doCraft"]'); if (!btn) continue;
      var lack = !!items[i].querySelector('.flex-wrap .text-red-400');
      if (lack !== btn.classList.contains('lmui-nomat')) {
        btn.classList.toggle('lmui-nomat', lack);
        btn.disabled = lack;
        if (lack) { if (!btn.hasAttribute('data-lmui-txt')) btn.setAttribute('data-lmui-txt', btn.textContent); btn.textContent = '材料不足'; }
        else if (btn.hasAttribute('data-lmui-txt')) btn.textContent = btn.getAttribute('data-lmui-txt');
      }
    }
  }
  function decorateNpcCards() {
    var rows = document.querySelectorAll('#afk-npclist .afk-npcl-row');
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]; if (r.querySelector('.lmui-npc-emo')) continue;
      var nm = r.querySelector('.afk-npcl-name'); if (!nm) continue;
      var title = (r.querySelector('.afk-npcl-title') || {}).textContent || '';
      var emo = '📜';
      for (var k = 0; k < NPC_EMO.length; k++) if (NPC_EMO[k][0].test(title)) { emo = NPC_EMO[k][1]; break; }
      var tEl = r.querySelector('.afk-npcl-title');   // 職稱本身沒有括號才補（像「[龍鑽收購]」已經自帶）
      if (tEl && title.trim() && !/^\s*[\[［]/.test(title)) tEl.setAttribute('data-lmui-br', '');
      var s = document.createElement('span'); s.className = 'lmui-npc-emo'; s.textContent = emo;
      nm.parentNode.insertBefore(s, nm);
    }
  }
  // 死亡時「重新開始」浮在角色頭頂：以角色精靈框量位置
  function placeDeadBtn() {
    var pb = document.querySelector('#player-morph-sprite .pm-body'); if (!pb) return;
    var r = pb.getBoundingClientRect(); if (!r.width) return;
    var s = document.documentElement.style;
    s.setProperty('--lmui-dead-x', Math.round(r.left + r.width / 2) + 'px');
    s.setProperty('--lmui-dead-y', Math.round(r.top + r.height / 2 - 28) + 'px');   // 圖框四周留白很多，人物約在框中心偏下 → 按鈕底緣壓在頭頂上
  }
  function isDead() {
    var a = $('btn-revive'), b = $('btn-revive-inplace');
    return !!((a && !a.classList.contains('hidden')) || (b && !b.classList.contains('hidden')));
  }

  // ── 狩獵紀錄（死亡視窗下半那塊）：經驗% / 擊殺數 / 金幣 / 道具，按「重整」歸零 ──
  //   只放記憶體（重新整理頁面就歸零）：純顯示用，不佔存檔的 localStorage。
  //   金幣、道具只算在狩獵地圖上的進出（村莊買賣不算）；經驗含死亡扣的（天堂M 也是這樣顯示負的）。
  var hunt = null;
  function expMetric() {
    if (!hasP()) return 0;
    var req = typeof getExpReq === 'function' ? getExpReq(player.lv) : 0;
    var pct = player.lv >= 100 ? 0 : (req > 0 && isFinite(req) ? (player.exp / req) * 100 : 0);
    return player.lv * 100 + pct;
  }
  function huntReset() {
    hunt = { slot: typeof currentSlot !== 'undefined' ? currentSlot : null, exp0: expMetric(), kills: 0, gold: 0, lastGold: hasP() ? (player.gold || 0) : 0, items: {}, itemCnt: 0 };
    renderDeathStats();
  }
  function huntTick(town) {
    if (!hasP()) return;
    var slot = typeof currentSlot !== 'undefined' ? currentSlot : null;
    if (!hunt || hunt.slot !== slot) huntReset();
    var g = player.gold || 0;
    if (!town) hunt.gold += g - hunt.lastGold;
    hunt.lastGold = g;
  }
  function huntActive() { return hunt && hasP() && !document.body.classList.contains('lmui-town') && !(typeof state !== 'undefined' && state && state.ff); }
  function fmtSigned(n) { return (n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString(); }
  function renderDeathStats() {
    var w = $('lmui-death'); if (!w || !hunt) return;
    setTxt(w.querySelector('[data-k="exp"]'), (expMetric() - hunt.exp0).toFixed(4) + '%');
    setTxt(w.querySelector('[data-k="kills"]'), hunt.kills.toLocaleString());
    setTxt(w.querySelector('[data-k="gold"]'), fmtSigned(hunt.gold));
    setTxt(w.querySelector('[data-k="items"]'), hunt.itemCnt.toLocaleString());
    var list = w.querySelector('.ld-items');
    if (list && list.style.display !== 'none') {
      var keys = Object.keys(hunt.items);
      list.innerHTML = keys.length ? keys.map(function (k) { return '<div><span>' + k + '</span><b>' + hunt.items[k].toLocaleString() + '</b></div>'; }).join('') : '<div class="ld-none">沒有道具</div>';
    }
  }
  function buildDeathWin() {
    if ($('lmui-death')) return;
    var w = document.createElement('div');
    w.id = 'lmui-death';
    w.innerHTML =
      '<div class="ld-btns">' +
        '<button type="button" data-act="revive">重新開始</button>' +
        '<button type="button" data-act="exit">離開</button>' +
        '<button type="button" data-act="cancel">取消</button>' +
      '</div>' +
      '<div class="ld-stats">' +
        '<div class="ld-row"><span>獲得經驗值</span><b data-k="exp">0%</b></div>' +
        '<div class="ld-row"><span>狩獵怪物數</span><b data-k="kills">0</b></div>' +
        '<div class="ld-row"><span>獲得金幣</span><b data-k="gold">0</b></div>' +
        '<div class="ld-row"><span>獲得道具</span><b data-k="items">0</b><button type="button" class="ld-look" data-act="items" aria-label="道具清單">🔍</button></div>' +
        '<div class="ld-items" style="display:none"></div>' +
        '<button type="button" class="ld-reset" data-act="reset">重整</button>' +
      '</div>';
    w.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act');
      var body = document.body;
      // 重新開始：死亡＝回村復活；活著（從工具列「離開」打開）＝回到選角（afk-mobile 的切換角色/回首頁窗）
      if (act === 'revive') {
        body.classList.remove('lmui-exitwin');
        if (isDead()) { if (typeof revive === 'function') revive(); }
        else { var t0 = navBtn('logout'); if (t0) t0.click(); }
      }
      // 離開：直接走 afk-mobile「確定回首頁」（它會先存檔、顯示回首頁遮罩）
      else if (act === 'exit') {
        body.classList.remove('lmui-exitwin');
        var t = navBtn('logout'); if (t) t.click();
        var ok = $('m-logout-ok'); if (ok) ok.click();
      }
      else if (act === 'cancel') { if (body.classList.contains('lmui-exitwin')) body.classList.remove('lmui-exitwin'); else body.classList.add('lmui-deathx'); }
      else if (act === 'items') { var l = w.querySelector('.ld-items'); l.style.display = l.style.display === 'none' ? '' : 'none'; renderDeathStats(); }
      else if (act === 'reset') huntReset();
    });
    document.body.appendChild(w);
  }
  function hookHunt() {
    if (typeof window.killMob === 'function' && !window.killMob.__lmuiHunt) {
      var _km = window.killMob;
      window.killMob = function (idx) {
        var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null, was = m && m._dead;
        var r = _km.apply(this, arguments);
        try { if (m && !was && m._dead && huntActive()) hunt.kills++; } catch (e) {}
        return r;
      };
      window.killMob.__lmuiHunt = true;
    }
    if (typeof window.gainItem === 'function' && !window.gainItem.__lmuiHunt) {
      var _gi = window.gainItem;
      window.gainItem = function (id, cnt) {
        var r = _gi.apply(this, arguments);
        try {
          if (huntActive() && r !== false) {
            var n = Math.max(1, Number(cnt) || 1), it = typeof DB !== 'undefined' && DB.items && DB.items[id], nm = (it && it.n) || id;
            hunt.items[nm] = (hunt.items[nm] || 0) + n; hunt.itemCnt += n;
          }
        } catch (e) {}
        return r;
      };
      window.gainItem.__lmuiHunt = true;
    }
  }
  // 有沒有彈窗開在戰鬥畫面上（道具/倉庫/afk-banner 清單裡的各種窗/Tailwind 的 .fixed.inset-0 遮罩）
  var WIN_SEL = '#item-modal:not(.hidden),#warehouse-window-frame,.fixed.inset-0,.lmui-below,.lmui-below-c,' + MODAL_HOSTS;
  // 掛在 body 下、蓋到戰鬥場景的彈窗 → 推到下半。不碰：主畫面/我們自己的元件/橫幅(z 極大)/不吃點擊的特效層/提示框
  var KEEP_IDS = { 'app-stage': 1, 'creation-screen': 1, 'lmui-hud': 1, 'm-nav': 1, 'lmui-bagtabs': 1, 'lmui-pcap': 1, 'm-log-sheet': 1, 'm-logout-overlay': 1,
    'lmui-hotpick': 1, 'lmui-mapdrops': 1, 'lmui-huntlog': 1, 'companion-overlay': 1, 'pet-revive-overlay': 1, 'my-mailbox': 1, 'my-qty': 1, 'afk-offres': 1, 'enh-window': 1, 'afk-updwin': 1 };   // 自己置中、自己限高的視窗：不要被搬到戰鬥畫面下方（會把標題列擠出畫面）
  // 場景下緣：平常＝#game-screen 頂端；功能頁模式 #game-screen 從畫面頂端開始（見 CSS 註解）→ 改量 #lmui-pcap（固定釘在場景下緣）
  function sceneBottom(gs) {
    var b = document.body.classList, cap = $('lmui-pcap');
    if (b.contains('lmui-battle') && b.contains('lmui-tall') && cap) return cap.getBoundingClientRect().top;
    return gs.getBoundingClientRect().top;
  }
  function pushWindowsBelow() {
    var gs = $('game-screen'); if (!gs) return;
    var limit = sceneBottom(gs);
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      var e = kids[i];
      if (e.id && KEEP_IDS[e.id]) continue;
      if (e.classList.contains('lmui-below') || e.classList.contains('lmui-below-c')) continue;
      if (/tooltip/i.test(e.className || '') || e.tagName === 'SCRIPT' || e.tagName === 'STYLE') continue;
      if (!e.getClientRects().length) continue;
      var cs = getComputedStyle(e);
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;
      if ((parseInt(cs.zIndex, 10) || 0) >= 1000000) continue;   // 非官方橫幅（afk-banner 管）
      var r = e.getBoundingClientRect();
      if (r.height < 120 || r.top >= limit - 4 || r.bottom <= limit) continue;
      e.classList.add(cs.transform && cs.transform !== 'none' && r.height < window.innerHeight * 0.9 ? 'lmui-below-c' : 'lmui-below');
    }
  }
  // 有沒有彈窗「蓋到下方 HUD 那一帶」：只有那種才需要把快捷列／聊天框收起來；
  //   短的小視窗（例如信箱）整個落在場景裡，收掉 HUD 只會留下一片空白（站長回報）→ 不算。
  function anyWindowOpen() {
    var list = document.querySelectorAll(WIN_SEL);
    var gs = $('game-screen'), limit = gs ? sceneBottom(gs) : 0;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.id === 'game-screen' || e.closest('#lmui-hud') || e.closest('#lmui-ashost')) continue;
      if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') continue;
      if (!limit) return true;
      var r = e.getBoundingClientRect(), bot = r.bottom;
      if (r.height > window.innerHeight * 0.85) {   // 遮罩型：看裡面那張卡
        bot = 0;
        for (var c = e.firstElementChild; c; c = c.nextElementSibling) { var cr = c.getBoundingClientRect(); if (cr.height) bot = Math.max(bot, cr.bottom); }
      }
      if (bot > limit + 2) return true;
    }
    return false;
  }
  function toggleCls(c, v) { if (document.body.classList.contains(c) !== v) document.body.classList.toggle(c, v); }
  // 彈窗內容太長時可以一路往下長到工具列上緣；真的長到血條那一帶才把血條收起來（短的視窗血條照常露著、不移動）
  //   遮罩型（整片 inset:0）量裡面那張卡；其餘量自己。
  function updatePopover() {
    var vit = $('lmui-vit'), on = false;
    if (vit && document.body.classList.contains('lmui-battle')) {
      var vt = vit.getBoundingClientRect().top;
      if (!vt) vt = parseFloat(vit.style.top) || 0;
      var list = document.querySelectorAll(WIN_SEL + ',#town-interaction-container:not(.hidden),#lmui-mobinfo,#lmui-death');
      for (var i = 0; i < list.length && !on; i++) {
        var e = list[i];
        if (e.id === 'game-screen' || !e.getClientRects().length || e.closest('#lmui-ashost')) continue;
        var cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        var r = e.getBoundingClientRect(), bot = r.bottom;
        if (r.height > window.innerHeight * 0.85) {   // 遮罩：取子元素
          bot = 0;
          for (var c = e.firstElementChild; c; c = c.nextElementSibling) { var cr = c.getBoundingClientRect(); if (cr.height) bot = Math.max(bot, cr.bottom); }
        }
        if (bot > vt + 2) on = true;
      }
    }
    toggleCls('lmui-popover', on);
  }

  // 底部工具列（經典天堂那排圖示）：自己建一排鈕塞進 afk-mobile 的 #m-nav，原本那幾顆藏起來但留著——
  //   切欄/日誌/登出直接 click 原鈕，afk-mobile 的 setView/登出確認窗/--m-nav-h 量測全部照舊。
  function rightTabBtn(tab) {
    var bar = document.querySelector('#col-right .tab-bar'); if (!bar) return null;
    return bar.querySelector('button[onclick*="switchTab(\'' + tab + '\'"]');
  }
  function openTab(tab) {
    var nb = navBtn('right'); if (nb) nb.click();
    var b = rightTabBtn(tab); if (b) b.click();
  }
  // 順序照玩家給的參考圖：信封(聊天)・人形(素質)・星(魔法)・袋子(背包)・握手(隊伍)・扳手(設定)，最前面加戰鬥。
  //   「離開」拿掉了（站長 2026-10-16：設定視窗最上排就有「回選角」）；死亡視窗照舊
  var TOOLS = [
    { id: 'battle', name: '狩獵場', run: function () { var b = navBtn('center'); if (b) b.click(); openMaps(); }, toggle: true },
    { id: 'chat', name: '聊天', run: openChat },
    { id: 'stats', name: '角色素質', label: '能力', run: function () { openTab('stats'); } },
    { id: 'skill', name: '魔法', run: function () { openTab('skill'); if (typeof refreshClassicSkillBookOnly === 'function') { try { refreshClassicSkillBookOnly(); } catch (e) {} } } },
    { id: 'items', name: '背包', run: function () { bagCat = 'all'; openTab('items'); } },   // 每次打開都從「全部」開始（停在「自動賣出」＝規則視窗開著、背景自動賣出暫停）
    { id: 'automation', name: '設定', run: function () { openTab('automation'); } }
  ];
  // 線條圖示；畫兩次（黑色粗描邊＋銀色漸層細線）做出參考圖那種金屬浮雕感
  var SVG = {
    battle: '<path d="M4 4l11 11M20 4L9 15M4 20l3-3M20 20l-3-3M6 15l3 3M18 15l-3 3"/>',
    chat: '<path d="M3 6h18v12H3z"/><path d="M3 6l9 7 9-7"/>',
    stats: '<circle cx="12" cy="5.5" r="2.8"/><path d="M8 21l1-7-3-1 1.5-4.5h9L18 13l-3 1 1 7"/>',
    skill: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6l1.8 4 4.2.3-3.2 2.7 1 4.1L12 15l-3.8 2.1 1-4.1L6 10.3l4.2-.3z"/>',
    items: '<path d="M9 4.5h6l-1.5 3h-3z"/><path d="M10.5 7.5C6 9 4.5 13 5 16.5 5.5 19.5 8 20.5 12 20.5s6.5-1 7-4c.5-3.5-1-7.5-5.5-9"/>',
    automation: '<path d="M14.5 4.5a4 4 0 0 0-4.9 5.2L4 15.3 6.7 18l5.6-5.6a4 4 0 0 0 5.2-4.9l-2.4 2.4-2.3-.6-.6-2.3z"/>'
  };
  function buildToolbar() {
    var n = $('m-nav'); if (!n || $('lmui-nav')) return;
    var bar = document.createElement('div');
    bar.id = 'lmui-nav';
    // 銀色漸層只定義一次，各圖示用 url(#lmui-silver) 共用
    bar.innerHTML = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="lmui-silver" gradientUnits="userSpaceOnUse" x1="0" y1="3" x2="0" y2="21"><stop offset="0" stop-color="#f4f4f4"/><stop offset=".5" stop-color="#b8b8b8"/><stop offset="1" stop-color="#6e6e6e"/></linearGradient></defs></svg>';
    TOOLS.forEach(function (t) {
      if (t.need && !t.need()) return;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'lmui-tool'; b.setAttribute('data-tool', t.id);
      b.setAttribute('aria-label', t.name); b.title = t.name;
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><g class="o">' + SVG[t.id] + '</g><g class="f">' + SVG[t.id] + '</g></svg><span>' + (t.label || t.name) + '</span>';
      b.addEventListener('click', function () {
        // 可開關的（狩獵場）：已經開著就只收起來
        if (t.toggle && document.body.classList.contains('lmui-maps')) { closeAllWindows(); try { syncToolbar(); } catch (e) {} return; }
        // 再點一次同一顆＝關掉它開的畫面、回到戰鬥畫面（這些頁面本身沒有關閉鈕；狩獵場另有上面那條「開關地圖清單」）
        if (t.id !== 'battle' && currentTool() === t.id) { closeTool(); return; }
        closeAllWindows();
        try { t.run(); } catch (e) { console.warn('[AFK-lmui] 工具列「' + t.name + '」失敗', e); }
        try { syncBag(); syncToolbar(); } catch (e) {}   // 立刻更新子分頁列/亮燈，不等下一個 tick（否則切換後有一瞬間空白）
      });
      bar.appendChild(b);
    });
    n.appendChild(bar);
  }
  // 收起目前開的功能頁、回到戰鬥畫面（工具列再點一次同一顆、視窗右上角 ✕）
  function closeTool() {
    closeAllWindows();
    var cb = navBtn('center'); if (cb) cb.click();
    try { syncBag(); syncToolbar(); } catch (e) {}
  }
  // 目前在哪一格：日誌開著＝聊天；戰鬥/隊伍看 mview-*；右欄看哪個分頁亮著（武器/防具算背包，裝備欄位算能力）
  var RIGHT_TAB_TOOL = { stats: 'stats', audit: 'stats', pvp: 'stats', clan: 'stats', equip: 'items', skill: 'skill', items: 'items', weapons: 'items', armors: 'items', automation: 'automation' };
  function currentTool() {
    var c = document.body.classList;
    if (c.contains('mlog-open')) return 'chat';
    if (c.contains('lmui-battle') && c.contains('mview-center') && c.contains('lmui-chatbig')) return 'chat';
    if (c.contains('mview-center')) return 'battle';
    if (c.contains('mview-right')) {
      for (var k in RIGHT_TAB_TOOL) { var p = $('tab-' + k); if (p && !p.classList.contains('hidden')) return RIGHT_TAB_TOOL[k]; }
    }
    return '';
  }
  function syncToolbar() {
    buildToolbar();
    var bar = $('lmui-nav'); if (!bar) return;
    var cur = currentTool();
    var btns = bar.querySelectorAll('.lmui-tool');
    for (var i = 0; i < btns.length; i++) { var on = btns[i].getAttribute('data-tool') === cur; if (btns[i].classList.contains('on') !== on) btns[i].classList.toggle('on', on); }
    // 經驗條住在工具列裡：離開遊戲時 afk-mobile 會把整條 #m-nav 拆掉，重建後用 el.exp（同一個節點）搬回來
    if (el.exp && el.exp.parentNode !== bar) bar.appendChild(el.exp);
  }

  // ── 右欄面板上方的分頁列（取代上游那排 12 顆分頁鈕）：依目前所在的工具分組，釘在頭像列正下方 ──
  //   t＝核心分頁（點上游原鈕切過去，switchTab 的副作用如「統計/存檔」順便存檔照舊）；btn＝開彈窗的上游原鈕（收藏）
  //   cat＝背包分類（不是核心分頁：核心分頁停在「道具」，三個物品分頁由 CSS 依 lmui-cat-* 攤平/篩選）
  //   魔法、設定沒有分頁列（設定原本的「自動賣出」移到背包的分類）。
  var SUB_GROUPS = {
    items: [{ cat: 'all', name: '全部', icon: '⇅' }, { cat: 'weapon', name: '武器' }, { cat: 'armor', name: '防具' }, { cat: 'item', name: '道具' }, { t: 'equip', name: '裝備欄' }, { cat: 'as', name: '自動賣出' }],
    stats: [
      { t: 'stats', name: '能力' }, { t: 'audit', name: '統計' }].concat((typeof DISABLE_COLLECTION !== 'undefined' && DISABLE_COLLECTION) ? [] : [{ btn: 'btn-collection', name: '收藏' }]).concat([
      { t: 'pvp', name: '社交' }, { t: 'clan', name: '血盟' }
    ])
  };
  var TAB_GROUP = { items: 'items', armors: 'items', weapons: 'items', equip: 'items', stats: 'stats', audit: 'stats', pvp: 'stats', clan: 'stats', automation: 'automation' };
  var BAG_CATS = ['all', 'weapon', 'armor', 'item', 'as'];
  var CAT_TABS = { all: ['tab-weapons', 'tab-armors', 'tab-items'], weapon: ['tab-weapons'], armor: ['tab-armors'], item: ['tab-items'] };
  var BAG_COLS = 5;     // 背包一排幾格（CSS 的 grid-template-columns 同步）
  var EMPTY_MIN = 35;   // 至少畫幾格（不足補空格），像遊戲裡固定格數的背包
  var bagCat = 'all';
  function activeRightTab() {
    for (var k in TAB_GROUP) { var p = $('tab-' + k); if (p && !p.classList.contains('hidden')) return k; }
    var sk = $('tab-skill'); if (sk && !sk.classList.contains('hidden')) return 'skill';
    return '';
  }
  var subGroup = '';
  function buildSubTabs(group) {
    var bar = $('lmui-bagtabs');
    if (!bar) { bar = document.createElement('div'); bar.id = 'lmui-bagtabs'; bar.className = 'lm-tabs'; document.body.appendChild(bar); }
    if (subGroup === group) return;
    subGroup = group;
    bar.innerHTML = '';
    (SUB_GROUPS[group] || []).forEach(function (x) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('data-t', x.cat ? 'cat:' + x.cat : (x.t || x.btn));   // 背包分類「裝備」與核心分頁「裝備欄」都叫 equip → 分類加前綴
      b.textContent = x.name;
      if (x.icon) {   // 「全部」的 ⇅：已經在全部時再點一次＝整理背包(見 pickBagCat)
        var ic = document.createElement('span'); ic.className = 'lmui-tabicon'; ic.setAttribute('aria-hidden', 'true'); ic.textContent = x.icon;
        b.appendChild(ic); b.title = '再點一次整理背包';
      }
      b.addEventListener('click', function () {
        if (x.cat) { pickBagCat(x.cat); return; }
        closeAllWindows();
        var tb = x.t ? rightTabBtn(x.t) : $(x.btn);
        if (tb) tb.click();
        syncBag();
      });
      bar.appendChild(b);
    });
  }
  // 背包分類：點目前這個「全部」＝整理背包（原本 ↕ 整理鈕的功能；照目前的整理方式排一次，不存檔，同核心「立即排列」）
  function pickBagCat(cat) {
    if (activeRightTab() === 'equip') {
      closeAllWindows();
      var tb = rightTabBtn('items'); if (tb) tb.click();
      bagCat = cat;
      syncBag();
      var g0 = $('game-screen'); if (g0) g0.scrollTop = 0;
      return;
    }
    if (cat === bagCat) {
      if (cat === 'all' && typeof sortInventoryNow === 'function') { try { sortInventoryNow(); } catch (e) { console.warn('[AFK-lmui] 整理背包失敗', e); } }
      syncBag();
      return;
    }
    closeAllWindows();
    bagCat = cat;
    syncBag();
    var gs = $('game-screen'); if (gs) gs.scrollTop = 0;
  }
  // 方格不足一整排/最少格數時補空格（放在自己的 #lmui-bagfill，核心重繪分頁不會動到它）
  function fillEmpty() {
    var panel = $('tab-content-panel'); if (!panel) return;
    var box = $('lmui-bagfill');
    if (!box) { box = document.createElement('div'); box.id = 'lmui-bagfill'; box.setAttribute('aria-hidden', 'true'); panel.appendChild(box); }
    var n = 0;
    (CAT_TABS[bagCat] || []).forEach(function (id) { n += document.querySelectorAll('#' + id + ' .classic-inventory-viewport>.list-item').length; });
    var want = Math.max(EMPTY_MIN, Math.ceil(n / BAG_COLS) * BAG_COLS) - n;
    var have = box.children.length;
    for (; have > want; have--) box.lastElementChild.remove();
    for (; have < want; have++) { var e = document.createElement('div'); e.className = 'lmui-empty'; box.appendChild(e); }
  }
  // 「自動賣出」分類＝自動賣出清單：清單就是核心規則裡的「永遠販賣」（autoSellRules.overrides[id]==='sell'），
  //   核心只賣清單裡的道具（js/10 AUTOSELL_LIST_ONLY）。下拉只列背包裡現有、可以賣、還沒在清單裡的道具。
  //   改完立刻 applyAutoSellRules 重新標記（真正賣出照核心的寬限期），8 角色共用設定開著時一併寫回共用設定。
  function ensureASHost() {
    var h = $('lmui-ashost'); if (h) return h;
    var panel = $('tab-content-panel'); if (!panel) return null;
    h = document.createElement('div'); h.id = 'lmui-ashost';
    panel.appendChild(h);
    return h;
  }
  function asRules() { return typeof getAutoSellRules === 'function' ? getAutoSellRules() : null; }
  function asCommit() {
    try { if (player.autoSellGlobal && typeof _saveGlobalAutoSellSettings === 'function') _saveGlobalAutoSellSettings(true); } catch (e) {}
    try { if (typeof applyAutoSellRules === 'function') applyAutoSellRules(); } catch (e) {}
    setTimeout(function () { try { if (typeof saveGame === 'function') saveGame(); } catch (e) {} }, 0);   // 移出點擊當下：不然 afk-toast 會把「遊戲進度已儲存」跳出來
    asSig = ''; syncInlineAS(true);
  }
  window.__lmuiAsAdd = function () {
    var sel = $('lmas-sel'), id = sel && sel.value, r = asRules();
    if (!id || !r || !DB.items[id]) return;
    r.overrides[id] = 'sell';
    player.autoSellOn = true;   // 清單有東西就要真的會賣
    asCommit();
  };
  window.__lmuiAsDel = function (id) {
    var r = asRules(); if (!r) return;
    delete r.overrides[id];
    asCommit();
  };
  var asSig = '';
  function syncInlineAS(want) {
    if (!want) return;
    var host = ensureASHost(), r = asRules(); if (!host || !hasP() || !r) return;
    var sel = $('lmas-sel');
    if (sel && document.activeElement === sel) return;   // 正在選，別把選單重畫掉
    var listed = Object.keys(r.overrides).filter(function (id) { return r.overrides[id] === 'sell' && DB.items[id]; });
    var opts = [], seen = {};
    (player.inv || []).forEach(function (it) {
      var d = it && DB.items[it.id];
      if (!d || seen[it.id] || d.noSell || d.noJunk || r.overrides[it.id] === 'sell') return;
      seen[it.id] = 1; opts.push(it.id);
    });
    var sig = listed.join(',') + '|' + opts.join(',');
    if (sig === asSig && host.firstChild) return;
    asSig = sig;
    var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var html = '<div class="lmas"><div class="lmas-add"><select id="lmas-sel" aria-label="要自動賣出的道具">' +
      (opts.length ? opts.map(function (id) { return '<option value="' + id + '">' + esc(DB.items[id].n || id) + '</option>'; }).join('') : '<option value="">背包裡沒有可以加的道具</option>') +
      '</select><button type="button" onclick="__lmuiAsAdd()"' + (opts.length ? '' : ' disabled') + '>新增</button></div>';
    if (!listed.length) html += '<div class="lmas-empty">選背包裡的道具按「新增」，之後撿到的這種道具都會自動賣掉（祝福、詛咒、強化過、有屬性的不會）。</div>';
    listed.forEach(function (id) {
      var d = DB.items[id], src = typeof getIconUrl === 'function' ? getIconUrl(d) : '';
      html += '<div class="lmas-row"><span class="lmas-ico">' + (src ? '<img src="' + src + '" alt="" onerror="this.style.opacity=0">' : '') + '</span>' +
        '<span class="lmas-name">' + esc(d.n || id) + '</span><button type="button" class="lmas-del" onclick="__lmuiAsDel(\'' + id + '\')">點此移除</button></div>';
    });
    host.innerHTML = html + '</div>';
  }
  // 魔法／背包／裝備：視窗標題列（右上角 ✕＝收回狩獵場，跟再點一次底部同一顆按鈕一樣）
  function syncWinHead(title) {
    var h = $('lmui-whead');
    if (!h && title) {
      h = document.createElement('div'); h.id = 'lmui-whead';
      h.innerHTML = '<b></b><button type="button" aria-label="關閉">✕</button>';
      h.querySelector('button').addEventListener('click', function (e) { e.stopPropagation(); closeTool(); });
      document.body.appendChild(h);
      ['lmui-wframe', 'lmui-wborder'].forEach(function (id) { var f = document.createElement('div'); f.id = id; f.setAttribute('aria-hidden', 'true'); document.body.appendChild(f); });
    }
    toggleCls('lmui-whead', !!title);
    if (h && title) setTxt(h.querySelector('b'), title);
    if (title && title !== winTitle) { var cr = $('col-right'); if (cr) cr.scrollTop = 0; }   // 換視窗從頂端開始（內容捲動框是 #col-right，各視窗共用）
    winTitle = title;
  }
  var winTitle = '';
  function syncBag() {
    var game = document.body.classList.contains('lmui');
    var tab = game && document.body.classList.contains('mview-right') && !document.body.classList.contains('mlog-open') ? activeRightTab() : '';
    var group = TAB_GROUP[tab] || '';
    var bag = group === 'items' && tab !== 'equip';   // 裝備欄掛在背包分頁列，但不是背包格子
    toggleCls('lmui-tall', !!group || tab === 'skill');
    toggleCls('lmui-ptabs', !!SUB_GROUPS[group]);
    syncWinHead(tab === 'skill' ? '魔法' : tab === 'equip' ? '裝備' : group === 'items' ? '背包' : group === 'automation' ? '設定' : group === 'stats' ? '能力' : '');
    toggleCls('lmui-bag', bag);
    toggleCls('lmui-bag-grid', bag && bagCat !== 'as');
    BAG_CATS.forEach(function (c) { toggleCls('lmui-cat-' + c, bag && bagCat === c); });
    toggleCls('lmui-equip', tab === 'equip');
    if (tab === 'equip') { try { renderDoll(); } catch (e) { console.warn('[AFK-lmui] 裝備紙娃娃失敗', e); } }
    syncInlineAS(bag && bagCat === 'as');
    if (!SUB_GROUPS[group]) return;
    buildSubTabs(group);
    var cur = bag ? 'cat:' + bagCat : tab;
    var btns = document.querySelectorAll('#lmui-bagtabs button');
    for (var i = 0; i < btns.length; i++) { var on = btns[i].getAttribute('data-t') === cur; if (btns[i].classList.contains('on') !== on) btns[i].classList.toggle('on', on); }
    if (bag && bagCat !== 'as') fillEmpty();
  }

  // ── HUD 更新 ────────────────────────────────────────────
  function pct(id) { var e = $(id); return e ? (e.style.width || '0%') : '0%'; }
  function pctNum(id) { var v = parseFloat(pct(id)); return isFinite(v) ? Math.round(v) : 0; }
  // 點頭像＝開/關裝備欄(背包分頁列的「裝備欄」同一個畫面)。
  function toggleEquipWin() {
    if (activeRightTab() === 'equip' && document.body.classList.contains('mview-right')) {   // 已開著 → 收回戰鬥畫面
      var c = navBtn('center'); if (c) c.click();
      return;
    }
    closeAllWindows();
    openTab('equip');
  }
  // 頭像固定用職業徽章(以前借戰鬥貼圖當下那一格，攻擊/走路時頭像跟著變)；沒有徽章的職業才退回貼圖。
  function updateFace() {
    if (hasP() && CLASS_LOGO[player.cls]) {
      var logo = 'assets/logo/' + CLASS_LOGO[player.cls] + 'logo.png';
      if (el.face.getAttribute('src') !== logo) el.face.setAttribute('src', logo);
      if (!el.face.classList.contains('logo')) el.face.classList.add('logo');
      return;
    }
    var body = document.querySelector('#player-morph-sprite .pm-body');
    var src = body && body.getAttribute('src');
    if (src) {
      if (el.face.getAttribute('src') !== src) el.face.setAttribute('src', src);
      if (el.face.classList.contains('logo')) el.face.classList.remove('logo');
    }
  }
  var lastMiniSig = '';
  function updateMini() {
    var a = aliveIdx(), sig = a.join(',');
    if (a.length) sig += '|' + a.map(function (i) { return mapState.mobs[i].boss ? 'b' : ''; }).join('');
    if (sig === lastMiniSig) return;
    lastMiniSig = sig;
    var old = el.mini.querySelectorAll('i:not(.me)');
    for (var k = 0; k < old.length; k++) old[k].remove();
    // 怪物依格位排成一圈：位置每格固定（不是真座標，是「場上有幾隻、哪隻是頭目」的示意）
    var n = (mapState && mapState.mobs) ? mapState.mobs.length : 0;
    a.forEach(function (i) {
      var ang = (-150 + (n > 1 ? 120 * i / (n - 1) : 60)) * Math.PI / 180;
      var dot = document.createElement('i');
      if (mapState.mobs[i].boss) dot.className = 'boss';
      dot.style.left = (50 + Math.cos(ang) * 26) + '%';
      dot.style.top = (50 + Math.sin(ang) * 26) + '%';
      el.mini.appendChild(dot);
    });
  }
  // ── 角色名字 / 取名(天堂M介面把原版左欄整個藏起來，原版「點狀態欄名字取名」在這裡點不到 → 自己做一個) ──
  //   名字取了就不能改(同 js/14 startEditName)：只有還沒名字的舊角色能點。
  //   規則與創角同一套(js/13 characterNameProblem·characterNamesInUse)，存檔走原版 saveGame。
  var renaming = false;
  function updateName() {
    if (!el.name || renaming || !hasP()) return;
    var n = player.name || '';
    setTxt(el.name, n || '（點此取名）');
    if (el.name.classList.contains('empty') === !!n) el.name.classList.toggle('empty', !n);
  }
  function startLmuiRename() {
    if (renaming || !hasP() || !el.name || player.name) return;
    renaming = true;
    var cur = String(player.name || '').replace(/"/g, '&quot;');
    el.name.innerHTML = '<input id="lmui-name-input" type="text" maxlength="12" value="' + cur + '" placeholder="2~12 字"><button type="button" id="lmui-name-ok">✓</button>';
    var inp = $('lmui-name-input'), ok = $('lmui-name-ok');
    inp.addEventListener('click', function (e) { e.stopPropagation(); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); finishLmuiRename(); } else if (e.key === 'Escape') { renaming = false; updateName(); } });
    ok.addEventListener('click', function (e) { e.stopPropagation(); finishLmuiRename(); });
    inp.focus(); inp.select();
  }
  function finishLmuiRename() {
    var inp = $('lmui-name-input'); if (!inp) { renaming = false; return; }
    var v = inp.value.trim();
    if (player.name) { renaming = false; updateName(); return; }   // 取名途中別處已經取好了 → 不覆蓋
    if (v) {
      if (typeof characterNameProblem === 'function') {
        var problem = characterNameProblem(v, typeof characterNamesInUse === 'function' ? characterNamesInUse(currentSlot) : null);
        if (problem) { alert(problem); inp.focus(); return; }
      }
      player.name = v;
      try { if (typeof updateUI === 'function') updateUI(); if (typeof saveGame === 'function' && player.cls) saveGame(); } catch (e) { console.warn('[AFK-lmui] 改名存檔失敗', e); }
    }
    renaming = false;
    updateName();
  }
  // ── 夥伴列(寵物／召喚／迷魅)：一隻一格小圖示，點一下顯示狀態 ─────────────
  //   資料全讀核心：寵物 petsOutList()(js/22)、召喚 summonV2List()(js/23)＋舊制 player.summon、迷魅 player.charmed(js/07)。
  //   迷魅的怪在核心是「從場上移除、變成看不見的幫手」，沒有立繪；血量在這一格和隊伍分頁(js/23 renderCharmTeamHTML)。
  var COLLAR_ICON = encodeURI('assets/icons/items/項圈 (牧羊犬).png');   // 站長決定：所有寵物都用牧羊犬項圈
  var SKILL_ICON = function (n) { return encodeURI('assets/icons/skills/' + n + '.png'); };
  function companions() {
    var out = [];
    try { (typeof petsOutList === 'function' ? petsOutList() : []).forEach(function (p) { out.push({ key: 'pet:' + p.uid, kind: '寵物', icon: COLLAR_ICON, name: p.form, lv: p.lv, hp: p.hp, mhp: p.mhp, mp: p.mp, mmp: p.mmp, down: !!p._downed }); }); } catch (e) {}
    try { (typeof summonV2List === 'function' ? summonV2List() : []).forEach(function (s, i) { out.push({ key: 'sum:' + (s.uid || i), kind: '召喚', icon: SKILL_ICON('召喚術'), name: s.form, lv: s.lv, hp: s.hp, mhp: s.mhp, down: !!s._downed }); }); } catch (e) {}
    if (player.summon) out.push({ key: 'sum:old', kind: '召喚', icon: SKILL_ICON('召喚術'), name: String(player.summon.n || '召喚獸'), end: player.summon.endTick, dice: player.summon.dmgDice, itv: player.summon.interval });
    if (player.charmed) { var ch = player.charmed; out.push({ key: 'charm', kind: '迷魅', icon: SKILL_ICON('迷魅術'), name: String(ch.n || '').replace(/^迷魅：/, ''), lv: ch.lv, hp: ch.hp, mhp: ch.mhp, down: !!ch._downed, end: ch.endTick, dice: ch.dmgDice, itv: ch.interval }); }
    return out;
  }
  var compSig = '', compOpen = null, lastLong = 0;
  function compPopHtml(c) {
    var L = ['<div class="t">' + c.kind + '：' + c.name + (c.lv ? '　Lv' + c.lv : '') + '</div>'];
    if (c.mhp) L.push('HP ' + Math.max(0, Math.floor(c.hp || 0)) + ' / ' + Math.floor(c.mhp) + (c.down ? '　<span style="color:#f87171">倒地中</span>' : ''));
    if (c.mmp) L.push('MP ' + Math.max(0, Math.floor(c.mp || 0)) + ' / ' + Math.floor(c.mmp));
    if (c.dice && c.dice.length === 2) L.push('傷害 ' + c.dice[0] + '～' + (c.dice[0] * c.dice[1]) + '，每 ' + ((c.itv || 10) / 10) + ' 秒攻擊一次');
    if (c.end && typeof state !== 'undefined' && state) { var sec = Math.max(0, Math.floor((c.end - state.ticks) / 10)); L.push('剩餘 ' + Math.floor(sec / 60) + ' 分 ' + (sec % 60) + ' 秒'); }
    return L[0] + L.slice(1).join('<br>');   // 標題本身是 div，後面才用 <br> 接(否則標題下多一行空白)
  }
  function updateCompanions() {
    var bar = $('lmui-comp'), pop = $('lmui-comp-pop'); if (!bar || !pop) return;
    var list = hasP() ? companions() : [];
    var sig = list.map(function (c) { return c.key + '|' + (c.mhp ? Math.round(100 * (c.hp || 0) / c.mhp) : '') + '|' + (c.down ? 1 : 0); }).join(',') + '#' + compOpen;
    if (sig !== compSig) {
      compSig = sig;
      bar.innerHTML = list.map(function (c) {
        var pct = c.mhp ? Math.max(0, Math.min(100, Math.round(100 * (c.hp || 0) / c.mhp))) : null;
        return '<button type="button" class="lmui-cp lmui-hit' + (c.down ? ' down' : '') + (compOpen === c.key ? ' on' : '') + '" data-k="' + c.key + '" aria-label="' + c.kind + ' ' + c.name + '">'
          + '<img src="' + c.icon + '" alt="" onerror="this.style.visibility=&quot;hidden&quot;">' + (pct != null ? '<i><b style="width:' + pct + '%"></b></i>' : '') + '</button>';
      }).join('');
    }
    var open = compOpen && list.filter(function (c) { return c.key === compOpen; })[0];
    if (!open) { compOpen = null; pop.classList.add('hidden'); return; }
    var h = compPopHtml(open);
    if (pop.innerHTML !== h) pop.innerHTML = h;
    pop.classList.remove('hidden');
  }
  function bindCompanions() {
    var bar = $('lmui-comp'); if (!bar) return;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('.lmui-cp'); if (!b) return;
      e.stopPropagation();
      if (Date.now() - lastLong < 700) return;   // 長按放開後跟來的那下 click 不要又把它關掉
      // 點一下＝夥伴視窗(換寵物裝備、設定喝水；js/22 openCompanionPanel)；核心沒有這個函式就退回顯示狀態
      if (typeof openCompanionPanel === 'function') { compOpen = null; compSig = ''; updateCompanions(); openCompanionPanel(); return; }
      var k = b.getAttribute('data-k');
      compOpen = (compOpen === k) ? null : k;
      compSig = ''; updateCompanions();
    });
    document.addEventListener('click', function (e) { if (compOpen && !e.target.closest('#lmui-comp,#lmui-comp-pop')) { compOpen = null; compSig = ''; updateCompanions(); } });
    // 長按也要能看(手機長按不一定觸發 click，Android 會改發 contextmenu)：長按＝打開(不切換)，並擋掉系統選單
    var pressT = null;
    var openKey = function (b) { if (!b) return; lastLong = Date.now(); compOpen = b.getAttribute('data-k'); compSig = ''; updateCompanions(); };
    bar.addEventListener('contextmenu', function (e) { var b = e.target.closest('.lmui-cp'); if (!b) return; e.preventDefault(); openKey(b); });
    bar.addEventListener('touchstart', function (e) { var b = e.target.closest('.lmui-cp'); clearTimeout(pressT); if (b) pressT = setTimeout(function () { openKey(b); }, 450); }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) { bar.addEventListener(ev, function () { clearTimeout(pressT); }, { passive: true }); });
    // 滑鼠也能長按(電腦版)
    bar.addEventListener('mousedown', function (e) { var b = e.target.closest('.lmui-cp'); clearTimeout(pressT); if (b && e.button === 0) pressT = setTimeout(function () { openKey(b); }, 450); });
    ['mouseup', 'mouseleave'].forEach(function (ev) { bar.addEventListener(ev, function () { clearTimeout(pressT); }); });
  }

  var lastAlignC = null, lastNameC = null;
  function updateStats() {
    updateName();
    // 名字那一排：右邊不可壓到地圖名框（框寬隨地圖名變）→ 量出可用寬度，名字太長就省略號
    try {
      var row1 = el.name.parentNode, tr = $('lmui-tr');
      if (row1 && tr && tr.offsetWidth) {
        var w = Math.floor(tr.getBoundingClientRect().left - row1.getBoundingClientRect().left - 6) + 'px';
        if (row1.style.maxWidth !== w) row1.style.maxWidth = w;
      }
    } catch (e) {}
    setTxt(el.ac, txt('st-ac') || '--');
    setTxt(el.mr, txt('st-mr') || '--');
    setTxt(el.gold.querySelector('b'), txt('st-gold') || '--');
    setTxt(el.hp.querySelector('span'), '體力 ' + txt('txt-hp'));   // 站長：百分比拿掉，只留數字；HP/MP 改中文
    setTxt(el.mp.querySelector('span'), '魔力 ' + txt('txt-mp'));
    // 經驗條：「等級 N」＋經驗百分比（小數 4 位，同天堂M）；百分比直接用核心同一條公式算（js/08：exp ÷ getExpReq(lv)）
    if (hasP()) {
      var _req = (typeof getExpReq === 'function') ? getExpReq(player.lv) : 0;
      var _pct = player.lv >= 100 ? 100 : (_req > 0 && isFinite(_req) ? (player.exp / _req) * 100 : 0);
      setTxt(el.exp.querySelector('.lv b'), String(player.lv));
      setTxt(el.exp.querySelector('.pc'), Math.min(100, Math.max(0, _pct)).toFixed(4) + '%');
    }
    setStyle(el.hp.querySelector('i'), 'width', pct('bar-hp'));
    setStyle(el.mp.querySelector('i'), 'width', pct('bar-mp'));
    setStyle(el.exp.querySelector('i'), 'width', pct('bar-exp'));
    if (hasP()) {
      var v = (typeof pvpClampAlignment === 'function') ? pvpClampAlignment(player.alignmentValue) : (Math.round(+player.alignmentValue || 0));
      // 頭像下方只顯示性向數字（站長：「正義／邪惡」字拿掉）；數字與角色名字一起照性向變色（同核心狀態欄的 pvpAlignmentColor：正義越高越藍、邪惡越紅、中立白）
      var c = (typeof pvpAlignmentColor === 'function') ? pvpAlignmentColor(v) : '';
      setTxt(el.align.querySelector('b'), (v > 0 ? '+' : '') + v);
      var nc = (player.name && !renaming) ? c : '';
      if (c !== lastAlignC || nc !== lastNameC) {   // 瀏覽器會把顏色正規化成 rgb()，直接比 style 值每次都不同 → 自己記上次的
        lastAlignC = c; lastNameC = nc;
        el.align.querySelector('b').style.color = c;
        if (el.name) el.name.style.color = nc;
      }
    }
    var ms = $('map-select'), mc = $('map-category');
    setTxt(el.mapname.querySelector('b'), ms && ms.selectedOptions[0] ? ms.selectedOptions[0].text : '');
    setTxt(el.mapname.querySelector('small'), mc && mc.selectedOptions[0] ? mc.selectedOptions[0].text : '');  }

  // F1~F6：先放已學會的手動技能（名單規則同 afk-skillbar，但不讀那支的 DOM），剩下的放身上的藥水/瞬移卷軸
  var lastHotKey = '', lastHotSig = '';
  function manualIds() {
    if (typeof DB === 'undefined' || !DB.skills || !hasP() || !player.skills) return [];
    var out = [];
    for (var id in DB.skills) { var sk = DB.skills[id]; if (sk && sk.type === 'manual' && player.skills.indexOf(id) !== -1) out.push(id); }
    out.sort(function (a, b) { return (+DB.skills[a].tier || 0) - (+DB.skills[b].tier || 0); });
    return out;
  }
  function hotItems() {
    if (typeof DB === 'undefined' || !DB.items || !hasP() || !player.inv) return [];
    var byId = {};
    player.inv.forEach(function (it) {
      var d = it && DB.items[it.id]; if (!d) return;
      if (!(d.type === 'pot' || d.eff === 'teleport_scroll') || d.noUse) return;
      var g = byId[it.id] || (byId[it.id] = { id: it.id, uid: it.uid, n: 0 });
      g.n += (+it.cnt || 1);
    });
    var list = Object.keys(byId).map(function (k) { return byId[k]; });
    list.sort(function (a, b) {
      var ia = HOT_ITEM_ORDER.indexOf(a.id), ib = HOT_ITEM_ORDER.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return list;
  }
  function autoHotPlan() {
    var skills = manualIds(), items = hotItems();
    return skills.map(function (id) { return { kind: 'skill', id: id }; })
      .concat(items.map(function (g) { return { kind: 'item', id: g.id, uid: g.uid, n: g.n }; }))
      .slice(0, HOT_ROW);
  }
  function hotPlan() {
    var c = hotCustom(), out = [];
    if (!c) { var a = autoHotPlan(); for (var i = 0; i < HOT_SLOTS; i++) out.push(a[i] || null); return out; }
    for (var j = 0; j < HOT_SLOTS; j++) {
      var e = c[j];
      if (e && e.k === 'skill' && hotSkillOk(e.id)) out.push({ kind: 'skill', id: e.id });
      else if (e && e.k === 'item' && DB.items[e.id]) out.push({ kind: 'item', id: e.id, uid: hotItemUid(e.id), n: hotItemCount(e.id) });
      else out.push(null);
    }
    return out;
  }
  function updateHot() {
    var plan = hotPlan();
    var key = plan.map(function (p) { return p ? p.kind + ':' + p.id : '-'; }).join(',');
    if (key !== lastHotKey) {
      lastHotKey = key; lastHotSig = '';
      slots.forEach(function (s, i) {
        var p = plan[i] || null;
        s.kind = p ? p.kind : null; s.id = p ? p.id : null;
        if (s.img) { s.img.remove(); s.img = null; }
        s.el.classList.remove('tip-host', 'is-cd', 'is-off'); s.el.removeAttribute('data-tip-skill');   // 長按改成「設定這一格」，不再掛 afk-touchtip 的說明
        setTxt(s.n, ''); setTxt(s.cd, '');
        if (!p) { s.el.removeAttribute('aria-label'); return; }
        var d = p.kind === 'skill' ? DB.skills[p.id] : DB.items[p.id];
        s.img = document.createElement('img'); s.img.alt = '';
        s.img.src = (typeof getIconUrl === 'function') ? getIconUrl(d, p.kind === 'skill') : '';
        s.img.onerror = function () { this.style.display = 'none'; };
        s.el.insertBefore(s.img, s.n);
        s.el.setAttribute('aria-label', d.n || p.id);
      });
    }
    // 數量（道具）與冷卻/MP（技能）：簽章沒變就不動 DOM
    var barrier = false;
    try { barrier = typeof inAbsBarrier === 'function' && inAbsBarrier(); } catch (e) {}
    var sig = barrier ? 'B' : '-';
    var st = plan.map(function (p, i) {
      slots[i].uid = p ? (p.uid || null) : null;
      if (!p) { sig += '|-'; return { off: false }; }
      if (p.kind === 'item') { sig += '|' + p.n; return { n: p.n, off: barrier || !(p.n > 0) }; }
      var sk = DB.skills[p.id], cost = sk.mp || 0;
      try { if (player.d && player.d.getMpCost) cost = player.d.getMpCost(sk.mp || 0, sk.tier); } catch (e) {}
      var cd = Math.ceil(Math.max(0, (player.manualCd && player.manualCd[p.id]) || 0) / TICKS_PER_SEC);
      sig += '|' + cd + ':' + (player.mp < cost ? 1 : 0);
      return { cd: cd, off: barrier || cd > 0 || player.mp < cost };
    });
    if (sig === lastHotSig) return;
    lastHotSig = sig;
    st.forEach(function (x, i) {
      var s = slots[i];
      s.el.classList.toggle('is-cd', (x.cd || 0) > 0);
      s.el.classList.toggle('is-off', x.off);
      setTxt(s.cd, x.cd > 0 ? String(x.cd) : '');
      setTxt(s.n, x.n != null ? (x.n > 999 ? '999+' : String(x.n)) : '');
    });
  }

  // 聊天框：鏡射來源日誌的最後幾行（cloneNode，不搬動原本的節點）
  //   系統＝系統日誌（不含打怪掉落）、戰鬥＝戰鬥日誌、掉落＝本外掛的掉落容器（見 hookDrops：擊殺掉落物＋怪物給的金幣）；
  //   一般／隊伍／血盟＝本外掛自己的頻道容器（見 sendChat）、世界＝世界頻道
  var CHAT_SRC = { sys: 'sys-log', combat: 'combat-log', drop: 'lmui-ch-drop', say: 'lmui-ch-say', world: 'world-log', party: 'lmui-ch-party', clan: 'lmui-ch-clan' };
  var lastChatSig = '', chatDirty = true;
  function linesAtBottom() { var l = el.lines; return !l || l.scrollHeight - l.scrollTop - l.clientHeight < 24; }
  function renderChat(force) {
    var tabs = el.tabs.querySelectorAll('button[data-t]');
    var petShown = (typeof companionLogShown !== 'function') || companionLogShown();
    for (var i = 0; i < tabs.length; i++) { var tk = tabs[i].getAttribute('data-t'); tabs[i].classList.toggle('on', tk === 'petflt' ? petShown : tk === chatTab); }
    document.body.classList.toggle('lmui-chat-combat', chatTab === 'combat');
    // 玩家往上捲在看舊訊息 → 先不刷新（同核心日誌的捲動鎖定）；捲回最底時由 scroll 事件補上
    if (!force && !linesAtBottom()) { chatDirty = true; return; }
    var src = $(CHAT_SRC[chatTab]);
    if (!src && /^(say|party|clan|drop)$/.test(chatTab)) src = chBox(chatTab);
    if (!src) { el.lines.innerHTML = ''; return; }
    var kids = src.children, n = kids.length;
    var last = n ? kids[n - 1] : null;
    var sig = chatTab + ':' + (petShown ? 1 : 0) + ':' + n + ':' + (last ? (last.textContent || '').length + (last.textContent || '').slice(-24) : '');
    if (sig === lastChatSig) return;
    lastChatSig = sig;
    var pick = [];
    for (var j = n - 1; j >= 0 && pick.length < CHAT_LINES; j--) {
      if (chatTab === 'sys' && kids[j].querySelector('.sys-item-gain')) continue;   // 掉落改看「掉落」分頁
      if (chatTab === 'combat' && !petShown) { var ds = kids[j].getAttribute('data-src'); if (ds === 'pet' || ds === 'summon') continue; }   // 「寵物」開關關掉：跳過寵物／召喚／迷魅的訊息
      pick.unshift(kids[j]);
    }
    var frag = document.createDocumentFragment();
    pick.forEach(function (node) {
      var c = node.cloneNode(true);
      c.removeAttribute('id');
      var withId = c.querySelectorAll('[id]'); for (var k = 0; k < withId.length; k++) withId[k].removeAttribute('id');
      frag.appendChild(c);
    });
    el.lines.innerHTML = '';
    el.lines.appendChild(frag);
    el.lines.scrollTop = el.lines.scrollHeight;
  }
  var chatMo = null;
  function watchChat() {
    if (typeof MutationObserver !== 'function') return;
    chatMo = new MutationObserver(function () { chatDirty = true; });
    ['sys-log', 'world-log', 'combat-log', 'lmui-ch-say', 'lmui-ch-party', 'lmui-ch-clan'].forEach(function (id) { var s = $(id); if (s) chatMo.observe(s, { childList: true }); });
  }

  // ── 主迴圈 ──────────────────────────────────────────────
  var enteredAt = 0;
  // 狀態圖示列（核心放在 #battle-view 裡）：村莊時 #battle-view 整個藏起來 → 圖示跟著不見。
  // 天堂M 版面下搬到 #map-view-panel（村莊/戰鬥共用的上層），離開天堂M 版面再搬回去；核心一律用 id 找它，搬家不影響更新。
  function syncStatusHost(on) {
    var bar = $('status-icon-bar'), host = on ? $('map-view-panel') : $('battle-view');
    if (bar && host && bar.parentNode !== host) host.insertBefore(bar, host.firstChild);
  }
  // 功能頁（沒有上方分頁列的，如設定）往上捲時，面板的上框會捲進場景底下 → 頂端補一條固定的上框
  var capBound = false;
  function syncPageCap() {
    var gs = $('game-screen'); if (!gs) return;
    var cap = $('lmui-pcap');
    if (!cap) { cap = document.createElement('div'); cap.id = 'lmui-pcap'; cap.setAttribute('aria-hidden', 'true'); document.body.appendChild(cap); }
    if (!capBound) { capBound = true; gs.addEventListener('scroll', syncPageCap, { passive: true }); }
    var on = gs.scrollTop > 6;
    if (on) cap.style.background = getComputedStyle(document.body).backgroundColor;
    toggleCls('lmui-pscroll', on);
  }
  function tick() {
    if (document.hidden) return;
    var game = inGame() && isMobileGeom();
    if (game && !document.body.classList.contains('lmui')) enteredAt = Date.now();
    toggleCls('lmui', game);
    // afk-mobile 一進遊戲就打開日誌（為了讓玩家看到離線結算）——天堂M介面下聊天框「一般」分頁就看得到，收起來別擋戰鬥
    if (game && enteredAt && Date.now() - enteredAt < LOG_AUTOCLOSE_MS && document.body.classList.contains('mlog-open')) {
      var x = $('m-log-close'); if (x) x.click();
      chatTab = 'sys'; lastChatSig = ''; chatDirty = true;
    }
    if (game) { try { syncToolbar(); } catch (e) {} try { fixPageShift(); } catch (e) {} }
    try { syncBag(); } catch (e) {}
    try { fitSkillBook(); } catch (e) {}
    try { toggleCls('lmui-sktab', game && activeRightTab() === 'skill' && document.body.classList.contains('mview-right')); } catch (e) {}
    var town = game && !inBattleMap() && inTownView();
    var battle = game && (inBattleMap() || town);   // 不看 mview-*：戰鬥畫面（村莊時＝村莊地圖）在任何分頁都留在上半
    toggleCls('lmui-town', town);
    var tic = $('town-interaction-container');
    toggleCls('lmui-npcwin', !!(town && tic && !tic.classList.contains('hidden')));
    if (!town) toggleCls('lmui-townchat', false);
    if (town) {
      try { hideNpcs(); } catch (e) {}
      try { decorateNpcCards(); } catch (e) {}
      try { layoutTownNpcs(); } catch (e) {}
      try { decorateInteraction(); } catch (e) {}
    } else npcLayoutSig = '';
    toggleCls('lmui-battle', battle);
    try { syncStatusHost(battle); } catch (e) {}
    try { syncPageCap(); } catch (e) {}
    try { huntTick(town); } catch (e) {}
    if (!battle) { toggleCls('lmui-compact', false); closeMap(); toggleCls('lmui-dead', false); toggleCls('lmui-deathx', false); toggleCls('lmui-win', false); toggleCls('lmui-chatbig', false); return; }
    // 戰鬥地圖裡不用完整日誌面板（被 CSS 藏起來了）；有人打開它（afk-mobile 登入時自動開）就直接收掉，免得 HUD 跟著被收
    if (document.body.classList.contains('mlog-open')) document.body.classList.remove('mlog-open');
    var dead = isDead();
    toggleCls('lmui-dead', dead);
    // 精簡下方（站長要求）：狩獵場主畫面預設只留 地圖資訊／血條／聊天輸入框／分頁按鈕／等級，快捷列、聊天分頁、訊息都收起來、地圖往下長；
    //   按「聊天」才看訊息。村莊：NPC 站在動態地圖上點得到時才收 NPC 卡片（地圖沒載起來時卡片是唯一入口，不收）
    var bc = document.body.classList;
    //   開著魔法／背包／設定視窗也維持精簡（視窗浮在上面；切掉精簡會讓戰鬥畫面縮成一半＝站長說的「戰鬥畫面跳動」）
    //   村莊不精簡（站長 2026-10-16：NPC 先不站在地圖上，回村莊下方要有 NPC 清單；精簡會收掉清單）。
    //   村莊因此一直是「地圖在上半、清單在下半」：開 NPC 對話視窗也不會切版面，畫面不跳。
    //   死亡也維持精簡：原本死亡切回「地圖上半＋下方聊天」，但下方聊天在死亡時是藏起來的 → 下半一大片黑、地圖縮一半（站長 2026-10-16）
    toggleCls('lmui-compact', !town && (bc.contains('mview-center') || bc.contains('lmui-whead')) && !bc.contains('lmui-chatbig') && !bc.contains('lmui-maps') && !bc.contains('lmui-map') &&
      !bc.contains('lmui-townchat'));
    if (dead) { try { placeDeadBtn(); buildDeathWin(); renderDeathStats(); } catch (e) {} }
    else toggleCls('lmui-deathx', false);
    try { pushWindowsBelow(); } catch (e) {}
    try { toggleCls('lmui-win', anyWindowOpen()); } catch (e) {}
    try { updatePopover(); } catch (e) {}
    try { updateCompanions(); } catch (e) {}
    if (typeof state !== 'undefined' && state && state.ff) return;   // 離線補跑期間不動畫面
    try { updateStats(); } catch (e) {}
    try { updateFace(); } catch (e) {}
    try { placeMobBars(); } catch (e) {}
    try { updateHot(); } catch (e) {}
    if (chatDirty && document.body.classList.contains('mview-center')) { chatDirty = false; try { renderChat(); } catch (e) {} }
  }

  // ── 技能分頁（魔法書）：上方書籤（全體魔法／職業／裝備）、左側階數鈕（點了捲到那一階）、4 欄圖示、底部魔攻／魔法防禦 ──
  //   取代上游 1.8 皮膚技能視窗。名單與「學會/可用/點了施放」規則照抄上游
  //   renderClassicSkillBook（js/10），只換版面；用到的判斷全走上游全域（skillReqLv / classicSkillIsClassSkill…）。
  function skillCell(id, granted) {
    var sk = DB.skills[id];
    var learned = (player.skills || []).indexOf(id) !== -1;
    var isGranted = granted.indexOf(id) !== -1;
    var needLv = isGranted ? 0 : (typeof skillReqLv === 'function' ? skillReqLv(sk, id) : undefined);
    var eleOk = !sk.reqEle || player.elfEle === sk.reqEle;
    var eleChosen = !sk.reqEleAny || !!player.elfEle;
    var usable = learned && eleOk && eleChosen && (isGranted || needLv === undefined || player.lv >= needLv);
    var cls = 'lsk-cell tip-host' + (learned ? (usable ? '' : ' is-off') : ' is-unlearned');
    var img = '<img src="' + (typeof getIconUrl === 'function' ? getIconUrl(sk, true) : '') + '" onerror="this.style.display=\'none\'" alt="">';
    var can = (learned && usable && sk.type === 'manual') ? 1 : 0;
    return '<div class="' + cls + '" data-tip-skill="' + id + '" onclick="__lmuiSkTap(this,\'' + id + '\',' + can + ')">' + img + '</div>';
  }
  function byTier(ids) {
    var g = {}, order = [];
    ids.forEach(function (id) { var t = +DB.skills[id].tier || 0; if (!g[t]) { g[t] = []; order.push(t); } g[t].push(id); });
    order.sort(function (a, b) { return a - b; });
    return order.map(function (t) { return { tier: t, ids: g[t] }; });
  }
  // 右上角狀態圖示：點一下就顯示名稱／剩餘秒數（原本只有滑鼠停留的 title，手機要長按才看得到）
  var stipFor = null, stipTimer = null, stipHide = 0;
  function stipBox() {
    var b = $('lmui-stip');
    if (!b) { b = document.createElement('div'); b.id = 'lmui-stip'; document.body.appendChild(b); }
    return b;
  }
  function stipClose() { stipFor = null; if (stipTimer) { clearInterval(stipTimer); stipTimer = null; } var b = $('lmui-stip'); if (b) b.style.display = 'none'; }
  function stipPaint() {
    var bar = $('status-icon-bar'), b = stipBox();
    var icon = bar && stipFor != null ? bar.querySelector('[data-status-index="' + stipFor + '"]') : null;
    if (!icon || !icon.getClientRects().length || Date.now() > stipHide) { stipClose(); return; }
    b.textContent = (icon.getAttribute('title') || '').replace('｜', '　');
    b.style.display = 'block';
    var r = icon.getBoundingClientRect(), w = b.offsetWidth;
    b.style.top = Math.round(r.bottom + 6) + 'px';
    b.style.left = Math.round(Math.max(6, Math.min(window.innerWidth - w - 6, r.right - w))) + 'px';
  }
  document.addEventListener('click', function (e) {
    var icon = e.target && e.target.closest && e.target.closest('#status-icon-bar .status-icon');
    if (!icon) { if (stipFor != null) stipClose(); return; }
    var idx = icon.getAttribute('data-status-index');
    if (stipFor === idx) { stipClose(); return; }   // 再點一次同一個＝收起
    stipFor = idx; stipHide = Date.now() + 5000;
    stipPaint();
    if (!stipTimer) stipTimer = setInterval(stipPaint, 500);
  }, true);

  // 點一下＝看說明（叫出核心的資料框：朝格子派一個 mousemove，內容與定位都交給核心，同 afk-touchtip 長按的做法）；
  //   說明開著時再點同一格＝施放（只限學會、能用的主動魔法）。點到別處就重新算「第一下」。
  var skTipId = null;
  window.__lmuiSkTap = function (el, id, can) {
    if (can && skTipId === id) {
      skTipId = null;
      try { document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 0, clientY: 0 })); } catch (e) {}   // 收掉資料框
      if (typeof manualCast === 'function') manualCast(id);
      return;
    }
    var r = el.getBoundingClientRect();
    try { el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); } catch (e) {}
    skTipId = id;
  };
  document.addEventListener('pointerdown', function (e) {
    if (!skTipId) return;
    var c = e.target && e.target.closest && e.target.closest('.lsk-cell[data-tip-skill]');
    if (!c || c.getAttribute('data-tip-skill') !== skTipId) skTipId = null;
  }, true);
  // 書籤：all＝全體魔法（通用＋職業＋裝備授予）、cls＝職業魔法、eq＝裝備授予；左側數字＝各書的階數，點了捲到那一階
  var skBook = 'all', skScroll = {};
  var CLS_TAB = { elf: '妖精', knight: '騎士', mage: '法師', dark: '黑暗妖精', royal: '王族' };
  window.__lmuiSkBook = function (b) { skBook = b; var d = $('tab-skill'); if (d) renderSkillList(d); };
  window.__lmuiSkJump = function (key) {
    var box = document.querySelector('#tab-skill .lsk2-scroll'), c = box && box.querySelector('.lsk-cell[data-grp="' + key + '"]');
    if (box && c) box.scrollTop = Math.max(0, c.offsetTop - box.firstElementChild.offsetTop);
    skSyncSide(box);
  };
  function skSyncSide(box) {
    if (!box) return;
    var cells = box.querySelectorAll('.lsk-cell[data-grp]'), top = box.scrollTop + 4, cur = null;
    var base = box.firstElementChild ? box.firstElementChild.offsetTop : 0;
    // 捲到底時最後幾階的開頭到不了框頂 → 改看「開頭有出現在框裡」的最後一階（不然點了最後一階卻亮前一階）
    if (box.scrollHeight > box.clientHeight + 2 && box.scrollTop + box.clientHeight >= box.scrollHeight - 2) top = box.scrollTop + box.clientHeight - 8;
    for (var i = 0; i < cells.length; i++) { if (cells[i].offsetTop - base <= top) cur = cells[i].getAttribute('data-grp'); else break; }
    if (!cur && cells.length) cur = cells[0].getAttribute('data-grp');
    var btns = document.querySelectorAll('#tab-skill .lsk2-side button');
    for (var j = 0; j < btns.length; j++) btns[j].classList.toggle('on', btns[j].getAttribute('data-grp') === cur);
  }
  // iPhone：點聊天輸入叫出鍵盤時整頁會被往上推，鍵盤收起後有時停在推上去的位置 → 頭像列躲到狀態列底下、下面空一條（站長 2026-10-16「上方又遮住了」）。
  //   天堂M 版面整頁固定、整頁本來就不該捲：沒在打字時發現整頁有位移就拉回頂端（鍵盤收起時看一次，tick 也順手看）
  function fixPageShift() {
    var ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
    var se = document.scrollingElement || document.documentElement;
    if (window.scrollY || (se && se.scrollTop)) { try { window.scrollTo(0, 0); } catch (e) {} if (se) se.scrollTop = 0; }
  }
  // 魔法書高度＝從自己頂端到底部導覽列上緣（分頁藏著時量不到 → 由 tick 在顯示時補量）
  function fitSkillBook() {
    var root = document.querySelector('#tab-skill .lsk2');
    if (!root || !root.getClientRects().length) return;
    // 魔法頁外層本來不捲（overflow hidden）。被 iPhone 鍵盤／回彈捲過一次就卡在半途：書的上半截躲到頭像列底下，
    //   下面這行量高度又照錯的位置把書撐高 → 一直捲不回來（玩家回報「魔法頂部不見了」）。量之前先拉回頂端。
    var ae = document.activeElement, typing = ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
    if (!typing) {
      var gs = $('game-screen'); if (gs && gs.scrollTop) gs.scrollTop = 0;
      if (window.scrollY) { try { window.scrollTo(0, 0); } catch (e) {} }
    }
    var nav = $('m-nav'), bottom = nav && nav.getClientRects().length ? nav.getBoundingClientRect().top : window.innerHeight;
    var wf = document.body.classList.contains('lmui-whead') && $('lmui-wframe');   // 視窗模式：量到視窗下緣
    if (wf && wf.getClientRects().length) bottom = wf.getBoundingClientRect().bottom;
    var h = Math.floor(bottom - root.getBoundingClientRect().top - 8);
    if (h >= 320 && Math.abs((parseFloat(root.style.height) || 0) - h) > 2) { root.style.height = h + 'px'; skSyncSide(root.querySelector('.lsk2-scroll')); }
  }
  function renderSkillList(div) {
    var all = Object.keys(DB.skills).filter(function (id) { return DB.skills[id] && !DB.skills[id].procOnly && id.indexOf('sk_helm_') !== 0; });
    var general = all.filter(function (id) { var sk = DB.skills[id]; return sk.reqM !== undefined && typeof skillReqLv === 'function' && skillReqLv(sk, id) !== undefined; });
    var cls = typeof classicSkillIsClassSkill === 'function' ? all.filter(function (id) { return classicSkillIsClassSkill(DB.skills[id]); }) : [];
    var granted = (player.grantedSkills || []).filter(function (id) { return DB.skills[id]; });
    var books = [{ k: 'all', n: '全體魔法' }];
    if (cls.length) books.push({ k: 'cls', n: CLS_TAB[player.cls] || '職業' });
    if (granted.length) books.push({ k: 'eq', n: '裝備' });
    if (!books.some(function (b) { return b.k === skBook; })) skBook = 'all';
    // 分組：每組＝左側一顆數字鈕＋格子裡連續的一段
    var groups = [];
    if (skBook === 'all' || skBook === 'gen') byTier(general).forEach(function (g) { groups.push({ key: 'g' + g.tier, label: g.tier, ids: g.ids, set: 'g' }); });
    if (skBook === 'all' || skBook === 'cls') byTier(cls).forEach(function (g, i) { groups.push({ key: 'c' + (g.tier || i), label: g.tier || (i + 1), ids: g.ids, set: 'c' }); });
    if (skBook === 'all' || skBook === 'eq') if (granted.length) groups.push({ key: 'e', label: '裝', ids: granted, set: 'e' });
    var side = '', cells = [], lastSet = null;
    groups.forEach(function (g) {
      if (lastSet && lastSet !== g.set) side += '<span class="gap"></span>';
      lastSet = g.set;
      side += '<button type="button" data-grp="' + g.key + '" onclick="__lmuiSkJump(\'' + g.key + '\')">' + g.label + '</button>';
      g.ids.forEach(function (id, i) { var h = skillCell(id, granted); cells.push(i ? h : h.replace('<div class="', '<div data-grp="' + g.key + '" class="')); });
    });
    while (cells.length % SK_COLS || cells.length < SK_COLS * 6) cells.push('<div class="lsk-cell is-empty"></div>');
    var sp = (player.d && player.d.magicDmg != null) ? Math.round(player.d.magicDmg) : 0;
    var mr = (player.d && player.d.mr != null) ? Math.round(player.d.mr) : 0;
    var old = div.querySelector('.lsk2-scroll');
    if (old) skScroll[old.getAttribute('data-book')] = old.scrollTop;
    div.innerHTML = '<div class="lsk2">' +
      '<div class="lsk2-tabs">' + books.map(function (b) { return '<button type="button" class="' + (b.k === skBook ? 'on' : '') + '" onclick="__lmuiSkBook(\'' + b.k + '\')">' + b.n + '</button>'; }).join('') + '</div>' +
      '<div class="lsk2-body"><div class="lsk2-side">' + side + '</div>' +
      '<div class="lsk2-scroll" data-book="' + skBook + '"><div class="lsk2-grid">' + cells.join('') + '</div></div></div>' +
      '<div class="lsk2-foot">魔攻<b>' + sp + '</b>魔法防禦<b>' + mr + '</b>%</div></div>';
    var box = div.querySelector('.lsk2-scroll');
    fitSkillBook();
    box.scrollTop = skScroll[skBook] || 0;
    box.addEventListener('scroll', function () { skScroll[skBook] = box.scrollTop; skSyncSide(box); }, { passive: true });
    skSyncSide(box);
  }

  // ── 怪物血條貼在頭頂：動畫圖四周有大片透明邊，怪物只畫在圖的下半部 → 單靠排版順序血條會浮在半空 ──
  //   第一次看到某隻怪的圖時掃一次像素，找出最上面有顏色的那一列（＝頭頂佔圖高的比例），依怪物資料夾快取；
  //   之後依圖片實際畫出來的範圍（object-fit:contain、貼底）算出頭頂位置，把名字＋血條平移過去。
  //   掃不到（file:// 下 canvas 被視為跨來源、圖還沒載完）就不動，維持在卡片上方。
  //   動畫是逐格換圖、各動作頭頂高低不同 → 每一格都掃（依檔名快取），同一隻怪取「看過的格裡頭頂最高」那個，血條就不會壓到身上。
  var headCache = {}, headTop = {}, headCanvas = null;
  // 回傳這隻怪（依圖片資料夾）目前量到的 {r:頭頂佔圖高比例, w, h:圖原尺寸}；換格中新圖還沒載完也照用舊值
  function headRatio(img) {
    var src = img.currentSrc || img.src;
    if (!src) return null;
    var key = src.replace(/\/[^\/]*$/, '');
    if (!(src in headCache) && img.complete && img.naturalWidth) {
      // 只採待機/走路格：受擊、技能、死亡格常帶特效（噴血、光圈），頭頂會被量到圖框最上緣 → 血條浮到半空
      var fn = src.replace(/^.*\//, '').replace(/[?#].*$/, '');
      var fr = /^(hurt|skill|attack|atk|die|death|dead|cast)/i.test(fn) ? null : scanHead(img);
      headCache[src] = fr;
      if (fr != null && (!headTop[key] || fr < headTop[key].r)) headTop[key] = { r: fr, w: img.naturalWidth, h: img.naturalHeight };
    }
    return headTop[key] || null;
  }
  function scanHead(img) {
    var ratio = null;
    try {
      var w = img.naturalWidth, h = img.naturalHeight;
      if (!headCanvas) headCanvas = document.createElement('canvas');
      headCanvas.width = w; headCanvas.height = h;
      var ctx = headCanvas.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, w, h); ctx.drawImage(img, 0, 0);
      var data = ctx.getImageData(0, 0, w, h).data;
      outer: for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 60) { ratio = y / h; break outer; }
    } catch (e) { ratio = null; }
    return ratio;
  }
  function placeMobBars() {
    var mobs = document.querySelectorAll('#mob-list .mob-target');
    for (var i = 0; i < mobs.length; i++) {
      var m = mobs[i], img = m.querySelector('.mob-img-wrap img'), bar = m.querySelector(':scope>.mob-hp-bar'), nm = m.querySelector(':scope>.mob-name');
      if (!img || !bar) continue;
      var cur = parseFloat(bar.getAttribute('data-lmui-ty')) || 0, ty = 0;
      var hd = headRatio(img);
      if (!hd && cur) continue;
      if (hd) {
        var ib = img.getBoundingClientRect();
        var sc = Math.min(ib.width / hd.w, ib.height / hd.h);
        var drawnH = hd.h * sc;
        var headY = ib.bottom - drawnH + hd.r * drawnH;
        var natTop = bar.getBoundingClientRect().top - cur;   // 沒平移時血條原本的位置
        ty = Math.max(0, Math.round(headY - 6 - natTop));
      }
      if (Math.abs(ty - cur) < 1) continue;
      var t = ty ? 'translateY(' + ty + 'px)' : '';
      bar.style.transform = t; bar.setAttribute('data-lmui-ty', ty);
      if (nm) nm.style.transform = t;
    }
  }

  // ── 裝備分頁（站長 2026-10-16 參考圖）：上方名字／等級／職業＋經驗，左右兩排裝備格夾著中間的角色（面向玩家的待機動作，變身就畫變身），
  //   角色下方血／魔，最下面能力值。席琳遺骸那頁拿掉（席琳已關閉）；脛甲、魔眼整個部位已刪除（站長 2026-10-16）。
  //   部位與「副手武器佔盾牌格」(offwpn)、點一下開物品視窗、雙擊卸下，都照上游 js/19 的 PAGE_SLOTS / renderSlots。
  //   格子一律同樣大（站長）：左右各 2 欄 × 5 排，由上往下、由左往右排（null＝空位）。
  //   左＝身上穿戴，照頭到腳排（頭盔項鍊→T恤盔甲→斗篷手套→武器盾牌→腰帶長靴）；右＝耳環、戒指，箭跟娃娃一排，最下排空著（站長）
  var DOLL_L = ['helm', 'amulet', 'tshirt', 'armor', 'cloak', 'gloves', 'wpn', 'shield', 'belt', 'boots'];
  var DOLL_R = ['ear1', 'ear2', 'ring1', 'ring2', 'ring3', 'ring4', 'arrow', 'doll'];
  var CLS_NAME = { royal: '王族', knight: '騎士', elf: '妖精', mage: '法師', dark: '黑暗妖精' };
  var SLOT_NAME = { helm: '頭盔', ear1: '耳環', ear2: '耳環', amulet: '項鍊', gloves: '手套', cloak: '斗篷', tshirt: 'T恤', wpn: '武器', shield: '盾牌', armor: '盔甲',
    ring1: '戒指', ring2: '戒指', ring3: '戒指', ring4: '戒指', belt: '腰帶', boots: '長靴', doll: '娃娃', arrow: '箭' };
  var dollSig = '';
  function dollKey(k) { return (k === 'shield' && player.eq.offwpn) ? 'offwpn' : k; }   // 副手武器顯示在盾牌格（同上游 alt）
  function dollCell(k) {
    var key = dollKey(k), item = player.eq[key], data = item && DB.items[item.id];
    if (!item || !data) return '<div class="ld-cell is-empty" title="' + (SLOT_NAME[k] || k) + '"><span>' + (SLOT_NAME[k] || '') + '</span></div>';   // 空格寫部位名（同參考圖）
    var glow = (typeof getGlowClass === 'function') ? (getGlowClass(item, data) || '') : '';
    var en = Number(item.en) || 0, badge = '';
    if (en > 0) badge = '<span class="ld-en' + (en > ((data && data.safe) || 0) ? ' en-over' : '') + '"><b>+' + (typeof capEn === 'function' ? capEn(item.en, data) : en) + '</b></span>';   // 左上角；超過安定值閃（css .en-over）
    else if ((item.cnt || 1) > 1) badge = '<span class="ld-cnt">' + (item.cnt || 1).toLocaleString() + '</span>';
    return '<div class="ld-cell is-filled tip-host" data-k="' + key + '" data-tip-uid="' + item.uid + '" data-tip-src="eq" title="' + (data.n || '') + '">' +
      '<img src="' + getIconUrl(data) + '" alt="" draggable="false" class="' + glow + '" onerror="this.style.display=\'none\'">' + badge + '</div>';
  }
  function dollCol(list) { return list.map(function (k) { return k ? dollCell(k) : '<div></div>'; }).join(''); }
  var DOLL_STATS = [['str', '力量'], ['dex', '敏捷'], ['con', '體質'], ['int', '智力'], ['wis', '精神'], ['cha', '魅力'], ['ac', '防禦'], ['mr', '魔防'], ['al', '']];
  function ensureDoll() {
    var d = $('lmui-doll'); if (d) return d;
    var panel = $('tab-content-panel'); if (!panel) return null;
    d = document.createElement('div'); d.id = 'lmui-doll';
    d.innerHTML = '<div class="ld2-title"><b class="nm"></b><span class="lv"></span><span class="cl"></span></div><div class="ld2-xp"></div>' +
      '<div class="ld2-body"><canvas class="ld2-fig" aria-hidden="true"></canvas><div class="ld2-col ld2-L"></div>' +
        '<div class="ld2-mid"><div class="ld2-bar hp"><i></i><span></span></div><div class="ld2-bar mp"><i></i><span></span></div></div>' +
        '<div class="ld2-col ld2-R"></div></div>' +
      '<div class="ld2-stats">' + DOLL_STATS.map(function (s) { return '<div><em>' + s[1] + '</em><b data-s="' + s[0] + '"></b></div>'; }).join('') + '</div>';
    panel.appendChild(d);
    d.addEventListener('click', function (e) {
      var c = e.target.closest('.ld-cell.is-filled'); if (!c) return;
      var k = c.getAttribute('data-k'), item = player.eq[k];
      if (item && typeof openModal === 'function') openModal(item, true, k);
    });
    d.addEventListener('dblclick', function (e) {
      var c = e.target.closest('.ld-cell.is-filled'); if (!c) return;
      e.preventDefault();
      if (typeof unequipItem === 'function') unequipItem(c.getAttribute('data-k'));
    });
    return d;
  }
  function renderDoll() {
    if (!hasP() || !player.eq || typeof DB === 'undefined') return;
    var d = ensureDoll(); if (!d) return;
    var all = DOLL_L.concat(DOLL_R);
    var sig = all.map(function (k) { var it = player.eq[dollKey(k)]; return it ? it.uid + ':' + (it.en || 0) + ':' + (it.cnt || 1) : '-'; }).join(',');
    if (sig !== dollSig) { dollSig = sig; d.querySelector('.ld2-L').innerHTML = dollCol(DOLL_L); d.querySelector('.ld2-R').innerHTML = dollCol(DOLL_R); }
    // 名字／等級／職業／經驗、血魔、能力值：每次都對一下（setTxt 只在變了才寫）
    var fmt = function (n) { return Math.floor(Number(n) || 0).toLocaleString(); };
    setTxt(d.querySelector('.ld2-title .nm'), player.name || '');
    setTxt(d.querySelector('.ld2-title .lv'), 'Lv.' + player.lv);
    setTxt(d.querySelector('.ld2-title .cl'), CLS_NAME[player.cls] || '');
    var req = (typeof getExpReq === 'function') ? getExpReq(player.lv) : 0;
    var w = Math.max(0, Math.round(Number(player.d && player.d.weightPct) || 0));
    setTxt(d.querySelector('.ld2-xp'), (player.lv >= 100 || !(req > 0) || !isFinite(req) ? 'EXP MAX' : 'EXP ' + fmt(player.exp) + ' / ' + fmt(req)) + '　負重 ' + w + '%');
    setTxt(d.querySelector('.ld2-bar.hp span'), 'HP ' + txt('txt-hp').replace('/', ' / '));
    setTxt(d.querySelector('.ld2-bar.mp span'), 'MP ' + txt('txt-mp').replace('/', ' / '));
    setStyle(d.querySelector('.ld2-bar.hp i'), 'width', pct('bar-hp'));
    setStyle(d.querySelector('.ld2-bar.mp i'), 'width', pct('bar-mp'));
    var pd = player.d || {};
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (s) { setTxt(d.querySelector('.ld2-stats [data-s="' + s + '"]'), String(Math.floor(Number(pd[s]) || 0))); });
    setTxt(d.querySelector('.ld2-stats [data-s="ac"]'), txt('st-ac') || '--');
    setTxt(d.querySelector('.ld2-stats [data-s="mr"]'), txt('st-mr') || '--');
    var al = (typeof pvpClampAlignment === 'function') ? pvpClampAlignment(player.alignmentValue) : Math.round(+player.alignmentValue || 0);
    var alB = d.querySelector('.ld2-stats [data-s="al"]');
    setTxt(alB.previousElementSibling, al > 0 ? '正義' : al < 0 ? '邪惡' : '中立');
    setTxt(alB, String(Math.abs(al)));
    var alC = (typeof pvpAlignmentColor === 'function') ? pvpAlignmentColor(al) : '';
    if (alB.style.color !== alC) alB.style.color = alC;
    figStart();
  }
  // 中間的角色：面向玩家的待機（呼吸）動作，變身就畫變身。外型與幀由 afk-townmap 提供（AFK_TM_HERO_IDLE）；
  //   拿不到（地圖外掛關掉、外型表還沒載）就畫頭像。只在裝備欄看得到時跑，每 80ms 看一次、換幀才重畫（省電）
  //   方向用 5（正南＝正對鏡頭、兩肩對稱；4 是斜側面，站長回報「沒有面對畫面」）。雙手劍那組劍往左伸，看起來像轉身，其實身體是正面
  //   水平置中用「身體實際畫到的像素」的重心（落腳點是斜投影子的中心，人身會偏一邊）；腳的高度照落腳點，站在光圈正中間
  var FIG_DIR = 5;
  var fig = { timer: 0, key: '', frame: -1, imgs: {}, cx: null };
  function figImg(src) { var im = fig.imgs[src]; if (!im) { im = fig.imgs[src] = new Image(); im.src = src; } return im; }
  function figMassX(im) {   // 不透明像素的平均 x（劍細、身體寬，平均會落在身上）＋左右最遠到哪；讀不到像素（file:// 等）回 null
    try {
      var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      var x = c.getContext('2d'); x.drawImage(im, 0, 0);
      var px = x.getImageData(0, 0, c.width, c.height).data, sum = 0, n = 0, lo = c.width, hi = 0;
      for (var i = 3, p = 0; i < px.length; i += 4, p++) if (px[i] > 128) { var cx = p % c.width; sum += cx; n++; if (cx < lo) lo = cx; if (cx > hi) hi = cx; }
      if (!n) return null;
      var m = sum / n;
      return { cx: m, half: Math.max(m - lo, hi - m) };
    } catch (e) { return null; }
  }
  function figStart() { if (!fig.timer) fig.timer = setTimeout(figTick, 0); }
  function figTick() {
    fig.timer = 0;
    var d = $('lmui-doll');
    if (!d || !document.body.classList.contains('lmui-equip') || document.hidden) { fig.frame = -1; return; }   // 看不到就停，下次 renderDoll 再開
    fig.timer = setTimeout(figTick, 80);
    var cv = d.querySelector('.ld2-fig'), W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
    var dpr = Math.max(1, Math.min(3, Math.round(window.devicePixelRatio || 1)));
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; fig.frame = -1; }
    var A = null; try { A = (typeof window.AFK_TM_HERO_IDLE === 'function') ? window.AFK_TM_HERO_IDLE(FIG_DIR) : null; } catch (e) {}
    var key = A ? A.key : 'face', k = A ? Math.floor(Date.now() / 1000 * A.fps) % A.n : 0;
    if (key !== fig.key) { fig.key = key; fig.frame = -1; fig.cx = null; if (A) for (var i = 0; i < A.n; i++) figImg(A.src(i)); }
    if (k === fig.frame) return;
    var body = A ? figImg(A.src(k)) : el.face, an = A ? A.anchor(k) : null;
    if (!body || !body.complete || !body.naturalWidth) return;   // 這幀還沒下載完：下一輪再畫
    // 畫布＝整個中段；腳踩在血條上方、左右正中間；光圈大小跟著中間那欄的寬度
    var mid = d.querySelector('.ld2-mid'), hpBar = d.querySelector('.ld2-bar.hp');
    var mw = mid ? mid.clientWidth : W * 0.4, ctx = cv.getContext('2d'), fx = W / 2, fy = (hpBar ? hpBar.offsetTop : H) - Math.max(14, H * 0.06);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    // 腳下的光圈台座
    ctx.save(); ctx.translate(fx, fy); ctx.scale(1, 0.3);
    var g = ctx.createRadialGradient(0, 0, 4, 0, 0, mw * 0.6); g.addColorStop(0, 'rgba(255,214,140,.32)'); g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, mw * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(214,170,90,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, mw * 0.42, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    if (A && an) {
      ctx.imageSmoothingEnabled = false;   // 點陣圖放大不糊；倍率取 0.5 的倍數，像素才整齊
      if (fig.cx == null) fig.cx = figMassX(body) || false;   // 每個外型量一次（同一套待機幀左右不會差太多，量一次人才不會跟著晃）
      var cx = fig.cx ? fig.cx.cx : an[0];
      // 倍率：高度放得下（腳到頂約 85%）、寬度也放得下（劍最多伸到兩邊格子後面、不出框），取 0.5 的倍數讓像素整齊，1～3 倍
      var sH = fy * 0.85 / Math.max(40, an[1]), sW = fig.cx ? (W / 2 * 0.95) / Math.max(10, fig.cx.half) : sH;
      var s = Math.max(1, Math.min(3, Math.floor(Math.min(sH, sW) * 2) / 2)), ox = fx - cx * s, oy = fy - an[1] * s;
      var sh = figImg(A.shadow(k));
      if (sh.complete && sh.naturalWidth) { ctx.globalAlpha = 0.55; ctx.drawImage(sh, ox, oy, sh.naturalWidth * s, sh.naturalHeight * s); ctx.globalAlpha = 1; }
      ctx.drawImage(body, ox, oy, body.naturalWidth * s, body.naturalHeight * s);
    } else {
      ctx.imageSmoothingEnabled = true;
      var sz = Math.min(W * 0.8, H * 0.7); ctx.drawImage(body, fx - sz / 2, fy - sz, sz, sz);
    }
    fig.frame = k;
  }

  function addCompareBtn() {
    document.body.classList.remove('lmui-cmp');
    // 「標記為廢品」勾選列：玩家要求拿掉（只藏，不動核心的廢品資料）
    var acts0 = $('modal-actions');
    if (acts0) {
      var labels = acts0.querySelectorAll('label');
      for (var i = 0; i < labels.length; i++) if (/標記為廢品/.test(labels[i].textContent || '')) labels[i].style.display = 'none';
    }
    var cmp = $('modal-compare'), acts = $('modal-actions');
    if (!acts || $('lmui-cmp-btn')) return;
    if (!cmp || cmp.classList.contains('hidden') || !(cmp.textContent || '').trim()) return;
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'lmui-cmp-btn'; b.className = 'btn';
    b.textContent = '⚖ 與身上比較';
    b.addEventListener('click', function () { document.body.classList.toggle('lmui-cmp'); });
    acts.insertBefore(b, acts.firstChild);
  }

  function init() {
    if (!$('game-screen') || !$('battle-view') || !$('map-view-panel')) {
      console.warn('[AFK-lmui] 找不到 #game-screen / #battle-view / #map-view-panel（上游可能改了結構），天堂M介面停用。');
      return;
    }
    injectCSS();
    build();
    watchChat();
    // 點怪物不再彈出怪物素質（2026-10-16 站長：點怪就是要打它；地圖模式的點怪由 afk-townmap 走過去打）。showMobInfo 留著給之後要用的入口
    // bindMobClick();
    // 道具卡片：有裝備比對內容時，在按鈕區最上面補一顆「與身上比較」（比對預設收起）。
    //   包核心 openModal：核心每次開啟都重畫 #modal-actions，所以每次都要補；收起狀態也每次重置。
    if (typeof window.openModal === 'function') {
      var _origOpenModal = window.openModal;
      window.openModal = function () {
        var r = _origOpenModal.apply(this, arguments);
        try { addCompareBtn(); } catch (e) {}
        try { updatePopover(); } catch (e) {}
        return r;
      };
    }
    // 怪物重畫（換怪/換目標）後立刻把名字＋血條擺回頭頂，不等下一個 tick（否則會先在卡片頂端閃一下）
    try { hookHunt(); } catch (e) {}
    try { hookPause(); } catch (e) { console.warn('[AFK-lmui] AUTO 暫停掛不上', e); }
    try { hookDrops(); } catch (e) { console.warn('[AFK-lmui] 掉落分頁掛不上', e); }
    try { hookHuntLog(); } catch (e) { console.warn('[AFK-lmui] 掛機紀錄掛不上', e); }
    //   包 _renderMobsImpl（真正寫 DOM 的那支）：戰鬥 tick 中 renderMobs 只標記 dirty，之後由 flushTickRender 直呼 _renderMobsImpl，包外層會漏掉
    var MOB_RENDER = typeof window._renderMobsImpl === 'function' ? '_renderMobsImpl' : 'renderMobs';
    if (typeof window[MOB_RENDER] === 'function') {
      var _origRenderMobs = window[MOB_RENDER];
      window[MOB_RENDER] = function () {
        var r = _origRenderMobs.apply(this, arguments);
        if (document.body.classList.contains('lmui-battle')) { try { placeMobBars(); } catch (e) {} }
        return r;
      };
    }
    // 技能分頁：天堂M介面開著（手機遊戲畫面）時改畫攤開的清單版面，其餘情況交回上游原版
    if (typeof window.renderClassicSkillBook === 'function') {
      var _origSkillBook = window.renderClassicSkillBook;
      window.renderClassicSkillBook = function (div) {
        if (div && typeof player !== 'undefined' && player && document.body.classList.contains('lmui') && typeof DB !== 'undefined') {
          try { renderSkillList(div); return; } catch (e) { console.warn('[AFK-lmui] 技能清單版面失敗，改用原版', e); }
        }
        return _origSkillBook.apply(this, arguments);
      };
    }
    // 地圖面板：換地圖、按了回村/瞬移/黑市就收起
    var ms = $('map-select'); if (ms) ms.addEventListener('change', closeMap);
    var hd = document.querySelector('#map-view-panel>.panel-header');
    if (hd) hd.addEventListener('click', function (e) { if (e.target.closest('button')) setTimeout(closeMap, 0); });
    document.addEventListener('focusout', function () { setTimeout(function () { if (document.body.classList.contains('lmui')) fixPageShift(); }, 300); }, true);   // 鍵盤收起
    setInterval(tick, TICK_MS);
    tick();
    console.log('[AFK-lmui] hooks OK — 天堂M風格介面已啟用。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
