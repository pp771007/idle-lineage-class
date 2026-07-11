# 放置天堂 — 專案規則

## 專案性質

- 網頁放置遊戲。遊戲本體由原作者(巴哈姆特 秋玥)製作,原版網址:**https://shines871.github.io/idle-lineage-class/**;本專案原是「原版 + 加掛外掛」的鏡像站。
- **🛑 2026-07-06 起本專案獨立維護,不再跟進原作者版本(使用者決定)**:原本「每小時自動同步原版」的整組機制——GitHub workflow `sync-upstream.yml`、Cloudflare Worker `cf-sync-trigger/`(已 `wrangler delete`)、腳本 `scripts/sync-upstream.mjs`、首頁同步時間 `last-sync.json`——已全部從 repo 移除,只留 git 歷史。**背景沒有任何自動同步在跑**;首頁跑馬燈已公告「伺服器永久開放,但不再跟進原作者版本」。
- 結構:`index.html`(殼)＋`js/*.js`(遊戲邏輯,00-data…等多檔)＋`css/`(樣式)＋`assets/`(圖,含 `anim/` 動畫幀)＋`public/assets/`(登入圖)＋根目錄 `afk-*.js`(外掛)。遊戲全域(`DB`/`tick`/`saveGame`/`MAP_CATEGORIES`…)定義在 `js/*.js`(一般 script,全域共用),外掛 `<script>` 排在 `</body>` 前、作者 js 之後,載入時全域已就緒。
- **要看原版更新了什麼 / 選擇性移植原版功能 → 跑 `/upstream-diff` skill**(`.claude/skills/upstream-diff/`,2026-07-10 建):以 `upstream-checkpoint.json` 的 `reviewedUpstreamCommit` 為錨點,對上游本機 clone(`D:/otherPersonRepos/idle-lineage-class`)diff 分析 → 產出功能菜單報告(`upstream-reviews/`)給使用者挑 → 逐功能 3-way 移植(分家點兩邊 blob 等價,`git apply -3` 可用;assets 用 `git archive | tar -x` 搬,中文檔名安全)。**🚨 分家後兩邊每支核心 js 都各自改過,絕不可整檔覆蓋**;舊的「整檔覆蓋式自動同步」永久作廢(腳本留在 git 歷史,勿撈回來用)。

## 🔁 漏東西 / 犯會重演的錯 → 當下就把教訓寫回這份 CLAUDE.md(鐵則,使用者明訂・2026-06-27)

> 只要發現「漏掉了什麼」或「犯了會再犯的錯」(例:新掉落沒進掉落查詢、某英文沒翻成中文、某數值算錯…),**修完當下就把『根因＋怎麼偵測/避免＋判準』總結成一條,寫進這份 CLAUDE.md 最貼近的章節**,讓下次同類問題靠這份文件就能擋下來。
>
> - **不要只默默修好**——沒寫進來,下次換個東西又會踩同一類雷(聖地遺物漏進掉落查詢就是這樣被使用者抓到的)。
> - 寫法跟著現有條目:標題一句話講結論、內文寫「為什麼會漏/錯 + 怎麼偵測或避免 + 自我檢查判準」、附日期與踩過的案例。
> - 寫完在回覆裡一句話告知補了哪條、補在哪,讓使用者能否決。

## 🏷️ 版本號與發版(/release)

- **加掛版有自己的版本號(semver,`v1.0.0` 起跳)**,與原作者的版本(v3.0.x)脫鉤:存在 `version.json` 的 `app` 欄位,首頁由 `afk-syncinfo.js` 讀取顯示「加掛版 vX.Y.Z」。`stamp-sw-version.mjs` 重寫 version.json 時會**保留 `app` 欄位**,只有發版時才 bump(大改版→major、新功能→minor、純修正→patch)。
- **發版流程已包成 `/release` skill**(`.claude/skills/release/`):使用者說「發版」就跑它——整理上次 tag 之後的 commits → 草擬玩家視角更新說明 → 與使用者確認版本號 → bump `version.json` 的 `app`+stamp+commit+push → 等 Pages 上線 → `git tag vX.Y.Z` + `gh release create`(標題 `《放置天堂 - 以血為盟》加掛版 vX.Y.Z`)。
- **更新說明鐵則(使用者明訂・2026-07-07)**:只寫玩家需要知道的——功能更新、問題修正、玩起來有感的調整;**白話、不要術語**(寫「離線結算大幅加快,掛一整天回來幾秒算完」,不要寫「混合快速結算管線」);內部重構/文件/CI/腳本改動一律不寫。
- 舊 tag 格式 `vYYYYMMDD-HHMM` 是自動同步時代的產物,**不再使用**;歷史 Release 保留不動。
- 需要台灣時間戳時注意:**Windows git-bash 的 `TZ='Asia/Taipei' date` 不生效**(沒 tzdata,默默給 UTC;踩過 2026-07-06 tag 時間差 8 小時)→ 用 `date -u -d '+8 hours' +%Y%m%d-%H%M` 換算。

## ⭐ 程式碼修改原則:依「功能性質」決定寫哪裡,不再一律偏好外掛

> **🔓 2026-07-06 起可直接修改原作者程式碼(`js/*.js`/`css/*.css`/`index.html`)——已停止與原版同步,不再有「被覆蓋」問題。**
> **🔓 2026-07-09 起「新功能一律寫外掛」的規則作廢(使用者明訂)**:既然核心碼可以改,就沒道理為了遷就外掛而多寫一層 monkey-patch。**照功能性質判斷該寫哪裡**。

**判準——寫進核心碼(`js/*.js`)**,當這個功能是:
- **既有遊戲機制的一部分**:改道具使用流程、戰鬥公式、UI 面板行為(例:萬能藥批量服用寫在 `js/02` 的 `openPanaceaModal`,就緊鄰同性質的歐西里斯寶箱 `openOsirisBox`)。
- **需要 monkey-patch 核心函式才能達成**:要包 `useItem`/`renderTabs`/`saveGame` 才做得到 → 那就直接改那個函式,少一層 wrapper、少一份「跟上核心規則」的維護負擔。
- **會用到核心的常數/規則**:外掛複製一份上限值/判斷式 = 上游一改就分歧(踩過:外掛自建怪物缺 `_born` 欄位整個系統安靜失效)。

**判準——寫成外掛(`afk-*.js`)**,當這個功能是:
- **遊戲之外的東西**:PWA、離線掛機結算、Service Worker、統計 beacon、首頁品牌/公告。
- **獨立子系統、與核心低耦合**:小百科、掉落查詢、木人場、離線紀錄——自成一頁/一個面板,只讀核心資料。
- **平台/裝置專屬的覆寫**:手機版面(`afk-mobile`)、返回鍵處理。

猶豫時問:「**這段 code 需要知道核心的內部規則嗎?**」需要 → 寫核心。只讀資料、或整塊可插拔 → 外掛。

- 外掛要能「優雅降級」:自我檢查需要的全域函式/元素是否存在,缺了就 `console.warn` 後安靜停用,**不可把遊戲弄壞**。
- **「補原作者坑」的補丁一律直接改核心根治**(2026-07-09 `afk-fixes.js` 已全數搬回核心並刪檔)。不要再為了「不動原作者碼」去包一層 wrapper。
- 改核心前先 grep 外掛有沒有包住同一個函式(如 `afk-mobile` 包過 renderTabs),避免兩層邏輯打架。(離線掛機已於 2026-07-10 移入核心 `js/offline.js`,不再包 saveGame/loadGame/changeMap——這幾支的離線掛點改為函式尾端直呼 `offlineStamp`/`offlinePreLoad`/`offlineAfterLoad`。)
- 改了 `js/*.js` 要同步更新 index.html 該檔的 `?v=`(慣例=內容 sha1 前 10 碼,`sha1sum js/<檔> | cut -c1-10`)並跑 `node scripts/stamp-sw-version.mjs`(`/prepush` 內含)。

### 🚨 外掛絕不可盲呼叫「會寫入/覆蓋玩家存檔」的原作者函式(踩過、害玩家存檔變 Lv.1 null)

> **血淚教訓(存檔轉移外掛)**:匯出功能為了「存最新進度」呼叫了原作者的 `saveGame()`。但匯出鈕在**主選單**上,主選單是「**還沒載入角色**」的狀態——此時全域 `player` 是空白預設值(`name:null, lv:1`),而 `saveGame()` **沒有防呆**,直接把 `player` 寫進 `lineage_idle_save_<currentSlot>`,於是**把玩家第 1 格的真實存檔覆蓋成 Lv.1 null,且無備份可救**。

- **外掛要拿存檔資料 → 直接讀 `localStorage`**(`lineage_idle_save_<n>`),**不要為了「拿最新」去呼叫 `saveGame()` 之類會寫檔的函式**。
- **真的非呼叫寫檔函式不可時,務必先確認「真的有載入角色」再呼叫**:`if (player && player.cls) { ... }`(空白 `player` 的 `cls` 是 `null`)。`saveGame()` 寫的是「目前所在存檔位 `currentSlot`」,在選單/未載入狀態呼叫 = 拿空白角色蓋掉那一格。
- 推論:**任何「會改動玩家 localStorage」的外掛操作,都要假設自己可能在「未載入角色 / currentSlot 不是使用者以為的那格」的狀態被觸發**,先驗狀態再動手;能唯讀就唯讀。
- 原作者的存檔系統**只在「匯入」時才留 `*_bak` 備份**,`saveGame()`/一般存檔**不留備份**——所以一旦被外掛誤覆蓋就是永久損失,務必從源頭防止。

## 目前的外掛(載入順序照 index.html;afk-skin 固定排最後。⚠ 離線掛機不在此表——2026-07-10 已移入核心 `js/offline.js`,見下方離線掛機章節)

| 檔案 | 功能 |
|---|---|
| `afk-mobile.js` | 手機版面(底部導覽列、一行式狀態列、浮動日誌面板、修正彈窗溢出;桌機零接觸,只在手機尺寸/裝置 init) |
| `afk-backnav.js` | 手機「返回鍵/返回手勢」在子畫面(選存檔位/創角)回首頁而不是關掉 PWA(History API 包作者畫面切換函式;只手機;無 DOM 掛點不列 smoke) |
| `afk-slotinfo.js` | 選角/載入畫面的存檔鈕下方附加「📍目前掛哪張圖、⏱已掛多久」(讀核心離線模組寫的 `afk_map_/afk_ts_<slot>`,唯讀;暴露 `window.AFK_SLOTINFO.read(slot)`;桌機手機共用) |
| `afk-extradata.js` | **掉落查詢+小百科共用的手動補充資料**(純資料、無 DOM、在 dex/wiki 之前載入,定義全域 `AFK_EXTRA`):`itemAcquire`(物品取得方式,`short` 給 dex 物品卡＋小百科裝備頁;`chain` 是舊傳說頁專用、現未使用)、`weaponTraitEff`/`weaponTagTrait`(武器特性白話對照,dex 物品卡共用)、`mapName`(地圖 id→中文)。**只放「不能從遊戲 DB 動態算」的手動補充**;補一件裝備取得只改這支、dex+wiki 同時生效。dex/wiki 都 call 時即時讀、沒載到優雅降級 |
| `afk-dex.js` | 怪物/掉落查詢(首頁入口;搜尋怪名/地圖/掉落物;讀 DB.mobs/maps/items + **五張掉落表 MOB_DROPS／DARK_WEAPON_DROPS／DARK_CRYSTAL_DROPS／DRAGON_DROPS／WARRIOR_DROPS**(與原作 _auditMobDrops 同一組;漏讀哪張就查不到);龍騎士表的職業限定任務道具標「🐉僅X」(讀 `TRIAL_ITEM_CLASS`);**純兌換/無怪掉的成品**(龍騎士書板·鎖鏈劍·臂甲…)補 `AFK_EXTRA.itemAcquire[id].short`「取得方式」、且這類非裝備非商店物品要靠有 itemAcquire 才會收進搜尋索引;桌機手機共用;**支援獨立頁 `?view=dex`**,見下「獨立頁」;頂部「掉落率模式」下拉=一般/席琳×3/瘋狂席琳×5/經典×1/10 重算怪卡掉落率) |
| `afk-wiki.js` | 小百科(首頁入口;**多分頁 + 關鍵字搜尋**:職業專精/武器特性/戰鬥機制/地圖/能力值/職業魔法/帶寵物/傭兵/任務/套裝/收藏-裝備/收藏-道具/收藏-怪物/魔法娃娃/裝備/強化/製作/負重/席琳/血盟/傲慢之塔/遺忘之島/軍王之室;部分讀遊戲資料、部分本檔手動維護(收藏-怪物讀 CARD_*、收藏-裝備讀 EQUIP_CATEGORIES/EQUIP_CAT_*、收藏-道具讀 MISC_CATEGORIES/MISC_CAT_*,皆 data-driven 自動跟上。**收藏三分頁**另有模式切換鈕:預設不選(防爆雷),點了才依模式共用桶 `lineage_idle_carddex/equipdex/miscdex+modeSuffix` **唯讀**顯示收集進度與缺項);桌機手機共用;**支援獨立頁 `?view=wiki`**;**改前先讀下方「小百科維護準則」**)。**「地圖」分頁**讀 `MAP_CATEGORIES`+`DB.maps/DB.mobs` 動態列出(每張標 📍進入路徑=在哪個分類、等級範圍、進入條件,自動同步;遊戲移動方式=地圖選單選分類再選圖直接傳送,故路徑即分類)。**「裝備」分頁**(`renderEquip`)讀 `DB.items` 依部位分組列出全部裝備+職業篩選(用遊戲 `equipOk` 真實規則);**詳情數值直接呼叫遊戲全域 `buildItemDescHTML({id,en:0,…})`**(永遠與遊戲一致、新增裝備/特效自動跟上、零手動維護),取得方式呼叫 `afk-dex.js` 暴露的 `window.AFK_DEX_API.acquireHTML(id)`(製作/商店/怪物掉落/`itemAcquire`)。每件詳情常駐 DOM(`display:none`)→ 完整數值與特效都進統一搜尋;詳情與整頁 HTML 都 memoize(`_equipDetail`/`_equipHtml`)→ 441 件搜尋重渲染不卡。**改裝備顯示時不要自己刻數值格式(會與遊戲分歧、得手動補),一律重用 `buildItemDescHTML`**。**「職業魔法」分頁**:每張魔法卡左側加圖示(`assets/icons/skills/<魔法名>.png`,與遊戲同路徑、缺圖 `onerror` 隱藏);選定單一職業時顯示「選擇角色」下拉(`charSelectHTML`,**唯讀**讀 8 格存檔 `_lzGet`/`_saveUnwrap` 取職業/等級/暱稱,預設不選、該職業無角色不顯示),選了角色後依其學過的魔法(`player.skills` 扣掉裝備臨時授予的 `grantedSkills`)把圖示變亮(`.is-learned`)/未學變暗(`.is-unlearned`);**絕不呼叫會寫存檔的原作函式**(見上方存檔鐵則) |
| `afk-sw.js` | Service Worker 註冊(配 `sw.js`;只在 isSecureContext 註冊、file:// 自動略過;不掛 DOM) |
| `afk-toast.js` | 手機 toast 提示(只手機;包 `logSys`,把「點擊事件同步窗內」呼叫的訊息浮現成 toast;戰鬥/掛機 tick 的訊息不在點擊窗內故不洗頻;無必須 DOM 掛點) |
| `afk-statpts.js` | 能力值面板每個屬性下補一行「點數來源分解」(始/升/藥/總,不含裝備;monkey-patch `updateUI` 後插入;讀 `player.base/alloc/panacea`) |
| `afk-syncinfo.js` | 首頁顯示「原作者:秋玥(正版連結)· 加掛版 vX.Y.Z」+ 巴哈討論串/Line 連結(顯示在 `#main-menu`;版本號讀根目錄 `version.json` 的 `app` 欄位,讀不到只藏版本列;檔名是「同步時間」時代的歷史名稱,沿用不改) |
| `afk-ui.js` | 統一自製彈窗:全域接管 `window.alert` 成非阻塞深色卡片(iOS Safari 會抑制連續原生 alert);並提供 `window.AFK_UI.openLayer/closeLayer` 共用「返回鍵/ESC 關最上層 modal」管理器(小百科/掉落查詢有自己一套等效實作,不共用);另提供 **`AFK_UI.confirm({title,message,okText,cancelText,danger,onOk,onCancel})`** 共用確認彈窗(非阻塞、callback 分派;確定→onOk,取消/背景/ESC/返回鍵→onCancel;取代原生 confirm。要做「確認才執行」的功能一律用它) |
| `afk-autobuy.js` | 外掛自動購買(設定面板「自動買銀箭」下方注入:肉耗盡自動買、魔法屏障卷軸自動補貨;包 `tick()` 低於門檻照商店價補;設定依存檔位存 `afk_autobuy_*_<slot>`;離線結算共用同一套 tick 邏輯,並暴露 `window.__afkAutobuyCheck` 供離線快速結算呼叫) |
| `afk-pwa.js` | PWA「安裝成免網路遊玩」+ 自動/手動更新 + 背景預抓離線資源(首頁 `#main-menu`:未安裝顯示文字連結、iOS 跳文字引導;**已安裝(standalone)** 顯示 checkbox「自動更新至最新版本」預設打勾,沒勾且有新版才顯示「更新至最新版」連結+確認視窗;安裝後背景把 `assets/` 全抓進圖桶顯示進度。`<head>` 的 manifest/圖示/theme-color 用 JS 注入。SW 註冊沿用 afk-sw.js,本檔只管觀察更新/UI/預抓) |
| `afk-storage.js` | 首頁「⚙ 設定」鈕 → 展開選單(`MENU_ITEMS` 可擴充,afk-history 也註冊進來)→ 檢查存檔大小(唯讀列出 localStorage 各 key 用量與 ~5MB 上限比例) |
| `afk-history.js` | 首頁設定選單「📜 離線掛機紀錄」:每存檔位最近 5 筆離線結算卡片(時間/地點/經驗金錢/道具/擊殺;可篩選存檔位、多選欄位);讀核心離線模組寫的 `afk_hist_<slot>`,**對玩家存檔唯讀**;顯示偏好存 `afk_hist_prefs` |
| `afk-mobname.js` | 怪物名稱顯示模式三選一(全部常駐/鎖定中常駐/原版 hover 才顯示;純 CSS + body data 屬性驅動,零 per-tick 成本;設定存 `afk_mobname_mode`) |
| `afk-training.js` | 木人場(「⚙️ 自動化」面板入口;選 1~5 隻怪打不死量真實 DPS,HUD 顯示每隻/總 DPS;怪血設天文數字、每 tick 量血量變化=總傷害再補回,涵蓋所有傷害來源;包 `killMob` 攔即死;可套席琳/瘋狂席琳模式,重用原作 `applySherineBuff`) |
| `afk-analytics.js` | 注入 Cloudflare Web Analytics beacon 統計人數/開啟次數(免費、不用 cookie;**只在正式站台注入**——非 https、localhost/127.0.0.1/`*.local` 一律略過,免本機測試污染統計;token 未填(`__` 開頭)時自動略過。不掛 DOM、不列入 smoke) |
| `afk-skin.js` | 首頁「加掛版」品牌標記+公告跑馬燈+外掛入口收納(桌機收成一顆「🔌 外掛工具」鈕開 Modal、手機維持半透明外框;外掛鈕套原版首頁按鈕皮;本檔載入順序排最後,用 MutationObserver 等其他外掛的入口到齊再收納,idempotent) |

> **小百科 / 掉落查詢的「獨立頁」(`?view=`)**:`index.html?view=wiki`、`index.html?view=dex` 會讓對應外掛把面板鋪滿整頁(藏掉創角/遊戲畫面、改 `document.title`、隱藏關閉鈕、背景點擊不關),並在最上方加一條**頁首導覽**(`#m-standalone-nav`:🏠首頁 / 📚小百科 / 📖掉落查詢,active 標亮)可互切與回首頁。看起來像獨立網頁。首頁兩顆入口旁各有一顆 `↗` 小鈕用 `window.open` 開新分頁到這網址;原本點主鈕開 modal 的行為保留。(頁首 `buildStandaloneNav` 在兩支外掛各有一份相同實作,只有 active 那支會跑、用 id 去重。)**資料仍來自 index.html 的 `DB`/`MOB_DROPS`/… 全域**(無法真的抽成獨立檔——那些 const 夾在遊戲主程式裡),所以獨立頁就是「重用 index.html 當資料源、只顯示該面板」。全寫在外掛內、不動遊戲碼。

> **🔗 小百科 ↔ 掉落查詢「跨頁連結」一律走通用 helper(別自己刻 openModal/location.href)**:要打通兩邊、做「點某物 → 跳到對方並定位」的連結時,呼叫對方暴露的 mode-aware `goto`——`AFK_DEX_API.goto({q})`(前往掉落查詢並搜尋)、`AFK_WIKI_API.goto({tab,cls,q})`(前往小百科並切分頁/搜尋)。它會自動判斷:**在任一獨立頁(`?view=`)→ 導去對方 `?view=…&q=/tab=/cls=`(網址連網址,對方初始化 `applyUrlState`/讀 `?q=` 還原);在遊戲內(模態)→ 開對方模態並套用(模態連模態)**。判斷用 `inStandaloneView()`(任一 `?view=` 即獨立頁)。範例:裝備詳情「🔍 查有哪些怪會掉這件」鈕(class `m-dex-pop-search`,全域委派→`gotoDex`)。**新增跨頁連結時:① 重用/擴充對方的 `goto`(需要新參數就加進 `goto` 與對方的 `applyUrlState`/初始化讀取),不要在呼叫端自己判斷模態/網址;② 反向若還沒有對應 `goto` 就比照現有那支鏡像新增。**
> **🔗 「名字 → 跳掉落查詢搜尋」的 inline 連結用 `m-dexlink` + `data-dexq`**:要把某個物品/材料/地圖/怪名做成可點(跳掉落查詢搜尋該名)時,包成 `<span class="m-dexlink" data-dexq="名字">名字</span>` 即可——afk-dex 的全域 click 委派會接 `[data-dexq]` 走 `gotoDex`(模態/網址自動)。小百科側有共用 helper `wDexLink(name)`,dex 側的 `craftInfoHTML` 材料也用這個。**模態切換時兩個面板同 z-index、後載入的(小百科)會蓋住先載入的(掉落查詢)**——所以 `gotoDex`/`gotoWiki` 在開對方前會先呼叫對方 `AFK_*_API.close()` 關掉來源模態(並交出一層歷史、不用 `history.back` 以免誤觸對方 popstate)。**已連結化:製作頁(成品+材料)、地圖頁(地圖名+隱藏區域)、裝備詳情材料(craftInfoHTML)。** 尚未做(可續):套裝件名(縮寫不好精準連)、帶寵物/血盟怪名(在散文裡)、掉落查詢→小百科反向。

### Service Worker / PWA 快取(sw.js 雙桶分離)

> `afk-sw.js` 註冊 `sw.js`;`sw.js` 是**雙桶分離快取**:
> - **程式桶 `CODE_CACHE`**(版本 `CODE_VERSION`):index.html + 全部外掛 js + 遊戲 js/css(含本機 `css/tailwind-built.css`)+ manifest + PWA 圖示 + 外部 CDN(`placehold.co`,怪圖載入失敗的備援圖,離線也要能用)。導覽文件走 network-first,js/css/圖示走 cache-first(帶 `?v=` 換版即換 URL)。
>   `CODE_VERSION` 由 `scripts/stamp-sw-version.mjs` 依「index.html＋manifest＋全部外掛 js＋遊戲 js/css 內容 hash」自動覆寫 → **程式一改 hash 就變 → 瀏覽器偵測到新 sw.js → 觸發 PWA 更新流程**。
>   **改任何程式檔後,push 前要跑 `node scripts/stamp-sw-version.mjs` 重算**(`/prepush` 內含)。漏跑的話「已安裝的 app」不會跳更新。
> - **圖桶 `IMG_VERSION`**(`img-v3`,**固定桶名、不再 bump、不整桶倒掉**):`assets/` 全部圖,on-demand 快取 + 可由 afk-pwa 背景全預抓。
>   失效走**逐張對帳**:`assets-manifest.json` 每張圖帶一個 git blob sha,SW(`reconcileImages`)記下自己快取的是哪個 sha;afk-pwa 每次載入(線上逛/已安裝都跑)把最新 manifest 送進 SW:① **reconcile**——只清掉 sha 對不上的舊圖(換一張只重抓一張,不重載整包 30MB);② **新增圖的處理**——reconcile 只清不抓,所以「程式更新帶新圖」靠 afk-pwa 比對 **manifest 簽章**(`afk_pwa_manifest_sig`):簽章變了 → 已安裝(standalone)就重跑預抓把新圖抓進圖桶。**沒這個的話新圖離線會 404(踩過)**。沒記過 sha 的舊快取 → SW 用實際 bytes 算 sha 補對帳,相符補記、不符才清。
>   怪物動畫幀(`assets/anim/`,~3 萬檔)不進逐張清單,走 `anim-manifest.json`「一怪一雜湊」逐怪對帳(`reconcileAnim`)。
> - **兩份 manifest 由 `scripts/gen-manifests.mjs` 重產**——**新增/更換/刪除任何 `assets/`、`public/assets/` 的圖後,跑一次並連 manifest 一起 commit**,否則玩家端(尤其 PWA 離線)對不到新圖。**判準:凡是「URL 路徑含 `/assets/`、會被 SW 圖桶快取」的圖,都必須在某份對帳清單裡**(assets-manifest 逐張,或 anim-manifest 逐怪),否則就是「快取卻不對帳→換圖卡舊」(踩過 2026-07-06:`public/assets/login/` 登入圖被快取卻不在 manifest)。新圖片資料夾進來時用 `grep -rlE 'src="[^"]*/assets/' index.html js` 對照 manifest 涵蓋範圍檢查。
> - 更新接管由頁面(afk-pwa)決定:首次安裝自動啟用、之後更新停 waiting,等頁面送 `skip-waiting` 訊息(自動更新偏好開→自動送;關→使用者按更新鈕才送)。
> - afk-sw 無 DOM 掛點不列入 smoke;**afk-pwa 有 UI 掛點,已列入 smoke 的 `[AFK-pwa]` 檢查**。
> - **⚠️ SW `cache.put` 絕不能存 206(Range 部分回應)——`res.ok` 對 206 也是 true,會踩雷(踩過 2026-06-30,玩家回報 `sw.js TypeError: Failed to execute 'put'`)**:`<audio>`/`<video>` 串流(`assets/bgm/*`、`assets/sfx/*` 音檔)用 `Range:` 抓 → server 回 **206 Partial Content**,而 `cache.put` 對 206 會 **reject**(`Partial response unsupported`)。**判準/解法:存進 Cache 的條件一律用 `res.status === 200`(不是 `res.ok`,後者含 206/204…),且 `cache.put(...).catch(()=>{})` 永遠掛 catch**(配額滿/race 也不該炸頁面)。新增任何「會被 Range 請求的媒體」或改 SW 快取邏輯時都套這條。

### 🎬 戰鬥 sprite 動作(js/09-vfx-render.js)的坑

- **受擊動作是「HP 掉了就播」(HP-delta 偵測),自傷技能(`hpCost`)的自扣血會被誤判成被打(踩過 2026-07-09:屠宰者全程只播受傷動作)**:`_playerMorphApply` 用 `hp < prevHp` 判受擊,而屠宰者/冥想術/隱身術/魂體轉換這類 `sk.hpCost` 技能施放時自己扣血 → 下一幀被判成受擊;受擊權重(4)又高過施法(3)/攻擊(2),於是把該播的動作整個蓋掉、且因技能連發而卡在受傷姿勢。**解法:施放成功後呼叫 `_pmAbsorbSelfHpCost()` 把這次 HP-delta 吸收掉**(castSkill / manualCast 兩個包裝都要)。原版(`D:\otherPersonRepos\idle-lineage-class`)同樣沒處理,是上游共有的坑。**判準:新增「會自己扣玩家 HP/觸發 HP 變化」的技能或機制 → 想一下 sprite 會不會誤判受擊。**
- **「揮武器/擲武器」型的技能不該播施法動作**:`_PM_ATTACK_SKILLS`(玩家端·技能 id)/`_PM_ATTACK_SKILL_NAMES`(傭兵端·技能名)列出這類技能,改播攻擊動畫;有 `hits` 的(屠宰者/三重矢)連播 hits 次(burst),沒有 `hits` 的(戰斧投擲)播單次、不進 burst(免擋掉緊接著的普攻動畫)。新增同性質技能記得加進去。

### 🪟 戰鬥中自動觸發的流程,不可順手做「玩家層級的 UI 副作用」(關彈窗/切分頁)

- **踩過 2026-07-09(玩家回報:手機打怪時看裝備數值,視窗會自己關掉)**:`equipItem()` 結尾無條件 `closeModal()`(合理——玩家手動按「裝備」後該收起彈窗);但戰鬥的 `consumeArrow()` 在箭矢用完時會**靜默呼叫 `equipItem()` 自動補上下一疊箭**,於是每打完一疊箭就把玩家正開著的物品詳情視窗關掉一次。表現=「隔一段時間視窗自己關」,只有弓系(精靈/裝弓)會中,桌機也有、只是手機把彈窗蓋在戰鬥畫面上才明顯。
- **解法**:`equipItem(item, silent)`,`silent` 時跳過 `closeModal()`;`consumeArrow` 的兩個自動裝備點(背包找到箭、自動買銀箭)都傳 `true`。比照 `useItem(uid, silent)` 既有寫法。
- **同日第二例(同一類、不同函式)**:`autoActions()` 的「自動找 BOSS」(持傳送控制戒指+勾 `set-teleport-boss`)呼叫 `useItem(uid, false)`,**刻意非 silent** 是因為 `useItem` 拿 `silent` 兼職判斷「要不要引動戒指強制遇 BOSS / 進隱藏區域 / 寫日誌」——結果連 `closeModal()` 也一起吃到,每次自動瞬移就關掉玩家開著的物品視窗。**旗標一詞多義就是坑**:加獨立的 `keepModal` 參數把「關視窗」從 `silent` 解耦,別為了關視窗去改 `silent`(會連帶關掉強制遇 BOSS)。
- **判準**:某個函式被「玩家點擊」與「戰鬥/tick/離線補跑」**兩種來源**呼叫時,先問「它有沒有做只有『玩家剛按下按鈕』才該做的事?」——`closeModal`、`switchTab`、捲動、播動畫、跳 toast 都算。有就加旗標,由自動路徑關掉。(同類:`state.ff` 補跑要靜音音效/特效。)
- **找這類 bug 的方法**:別用讀 code 猜。無頭開真實戰鬥,把 `DOMTokenList.prototype.add/toggle`、`className` setter、`removeChild` 全包起來,只要有人對目標元素加 `hidden` 就印呼叫堆疊——一次就指到兇手那行。**注意模擬要涵蓋觸發條件**(第一次沒抓到是因為測試地圖不會出 BOSS、身上也沒戒指)。

### 💾 離開頁面的存檔要去重,不要靠「外掛設旗標告訴核心別存」

- **踩過 2026-07-09**:手機登出流程(afk-mobile)自己先 `saveGame()` 再 `location.reload()`,reload 觸發的 `pagehide` 又存一次 → 手機 toast 跳兩次。當時的解法是外掛設 `window.__afkLoggingOut`、核心讀它跳過——**核心讀外掛的全域變數,而且只擋掉這一個特例**。
- **真正的問題是重複存檔沒防護**:關頁時 `visibilitychange(hidden)` / `pagehide` / `beforeunload` 三個事件會**連續觸發**,`saveOnExit` 就跑三遍(桌機看不出來,手機 toast 才暴露)。
- **解法(js/13)**:`saveGame()` 結尾記 `_lastSaveMs`;`saveOnExit` 判斷 `Date.now() - _lastSaveMs < EXIT_SAVE_DEDUPE_MS(2000)` 就跳過。**去重只作用在離開路徑**,一般 `saveGame` 呼叫端(開寶箱/喝萬能藥/匯入存檔/擊殺頭目)行為完全不變、連呼三次就存三次。`__afkLoggingOut` 已刪除。
- **判準**:發現「A 模組設旗標叫 B 模組別做某事」時,先問「B 是不是根本沒防重複執行?」——修 B 的重複,比讓 B 認識 A 好。

### 📜 日誌裁切要「絕對設定 scrollTop」,不能「相對扣掉被裁高度」(Chrome 會自己補一次)

- **踩過 2026-07-09(把 afk-fixes 的日誌捲動錨定搬回核心時)**:`logCombat`/`logSys` 在鎖定捲動時裁掉頂端舊訊息,若寫成 `el.scrollTop -= 被裁高度`,在 **Chrome 會補兩次**(瀏覽器的 scroll anchoring,`overflow-anchor` 預設 `auto`,removeChild 頂端節點時自動調整 scrollTop)→ 視野往回飄。但 **iOS Safari 不支援 `overflow-anchor`**、完全不補,拿掉補償手機又會飄。
- **解法(核心 `_trimLog`)**:裁切前記下「視窗頂端那則訊息」與它距視窗頂的像素差,裁切後 `el.scrollTop = anchor.offsetTop + delta` **絕對設定**——冪等,不管瀏覽器有沒有自己補都落在同一位置。實測 Chrome 預設與 `overflow-anchor:none`(模擬 Safari)兩種模式下 scrollTop 完全一致。
- **判準**:任何「移除捲動容器頂端節點」的程式碼,想補償位移就用絕對定位,別用相對扣減;而且要在 `overflow-anchor:none` 下也測一次(桌機 Chrome 測不出手機的行為)。

### 🤝 傭兵自我 buff(js/06-status-allies.js `allyMaintainBuffs`)的坑

- **不可用「隊長身上有沒有這個 buff」當傭兵施放與否的判斷(踩過 2026-07-09)**:自我增益寫進 `ally.buffs` 後才會經 `_allyLevelRecompute` 生效在傭兵身上,**隊長的 `player.buffs` 對傭兵零加成**。舊碼(v2.6.50)在施放前檢查 `player.buffs[sid]>0 就 continue`,結果是「隊長開了 buff,傭兵反而永遠裸著」。真正全隊共享的(幻覺光環/大地祝福/鋼鐵防護/水之元氣)本來就在 `_isMercSelfBuff` 排除、各走 aura 路徑,不需要這條。**判準:傭兵的施放條件只能看 `ally` 自己的狀態。**
- **`_isMercSelfBuff` 要排除「純玩家端效果」的 buff,否則傭兵白耗 MP(同日踩到)**:有些 buff 沒有 `d:{}` 衍生值,效果寫死成只讀 `player.buffs`——日光術(出怪間隔 `js/03`)、無所遁形術(史巴托現身 `js/03`)、隱身術(`isPlayerStealth` `js/08`)。傭兵放了不會有任何事發生。**偵測法:新增 buff 時問「這支的效果,傭兵端讀得到嗎?」——① 有 `d:{}`(走 recompute)或 ② 有 `ally.buffs.<id>` 的具名讀取(如 `_allyAtkBuffProcs`/`allyStrikeRoll`),兩者皆無 → 加進 `_isMercSelfBuff` 的排除清單。** 用 `grep -oE 'player\.buffs\.[A-Za-z_0-9]+' js/*.js` 列出所有玩家端具名讀取,再比對 ally 端有沒有對應那支。

### 外掛 DOM / CSS 注入的坑(踩過)

> 通用補坑碼一律寫進核心(`afk-fixes.js` 已於 2026-07-09 整支搬回核心刪除);只有「手機專屬的 CSS/版面覆寫」才留 `afk-mobile.js`。(存檔匯入/匯出原本有 `afk-savedata.js`,遊戲內建匯出入功能後移除。)
> - **⚠️ 手機 CSS 覆寫「版面容器」時,若寫死 `display:… !important`,小心 specificity 蓋過遊戲用來『隱藏』該容器的 `.hidden{display:none!important}` → 畫面關不掉(踩過 2026-07-06)**:遊戲用 `#creation-screen.hidden{display:none!important}`(specificity 1,1,0)隱藏登入/創角畫面;外掛的 `body.m-mobile #creation-screen{display:block!important}` 是 (1,1,1) 更高 → 即使加了 `.hidden` 也被外掛的 `display:block` 壓著不隱藏,載入存檔/建角進遊戲後登入畫面仍蓋在遊戲上,玩家表現=「卡在選角畫面進不去」(且 DOM 上 `.hidden` 有加、`classList.contains('hidden')` 為 true,只有 computed `display` 是 block,極易誤判)。**判準/解法:任何「會被 `.hidden`(或其他隱藏 class)切換顯示」的容器,外掛覆寫它的 `display`/`visibility` 一律加 `:not(.hidden)` 條件**(`body.m-mobile #creation-screen:not(.hidden){…}`)。自我檢查:改到 `#creation-screen`/`#game-screen` 這種「整屏切換」容器的手機 CSS,有沒有無條件 `display:…!important`?有就補 `:not(.hidden)`,並實測「載入存檔→有真的進到遊戲、登入畫面消失」。
> - **⚠️ 外掛「自建遊戲物件」(如木人場自 spawn 怪)要跟上核心欄位演進,缺欄位可能整個系統安靜失效(踩過 2026-07-07)**:v3.0.11 getTarget 改「鎖最早出生(_born)」後,木人場外掛自建怪沒有 _born → 全場鎖不到目標 → 玩家/傭兵全體不攻擊、DPS 恆 0,無錯誤無警告,直到玩家從畫面發現。已修核心(getTarget 補格位序 tiebreak,缺 _born 也能鎖)。**判準:合併/改動核心「怪物生成」欄位(spawnMob 的 {...} 內容)時,grep 外掛有沒有自建同型物件(`mapState.mobs[` in afk-*.js),欄位要對齊或核心要容錯。**
> - **⚠️ 外掛「插 DOM」的錨點別依賴版面的內部結構,錨不到會安靜消失、smoke 也驗不到(踩過 2026-07-06:首頁跑馬燈)**:afk-skin 的公告跑馬燈原本錨定「h1 的父層必須是 `#creation-screen` 直接子層」,遊戲 v3.0.40 把標題包進 `#login-art-stage>#login-title-layer` 後條件不成立 → `ensureMarquee` 安靜 return、跑馬燈消失,**頁面照常、console 無警告、smoke 照過**,直到玩家回報才發現。同場加映:登入頁的按鈕皮 `#main-menu > button` 只吃「直接子層」,外掛按鈕包在 row/外框內吃不到 → 掉回舊配色(已在 afk-skin 抄同組宣告套上,改 css/style.css 該段要跟著換)。**判準/解法:① 外掛插入點優先錨定「穩定的容器 id」(如 `#main-menu`),不要錨「標題/包裝層的父子關係」;② 依賴 DOM 形狀的視覺注入,改過首頁版面後要人工掃一輪首頁(跑馬燈/加掛版徽章/外掛框都在,樣式沒退化)——這些不在 smoke 範圍。**

## 📚 小百科(afk-wiki.js)維護準則

> **🛠️ 此 SOP 已包成 `/update-wiki` skill(`.claude/skills/update-wiki/`)。** 使用者說「更新小百科」時**直接跑 `/update-wiki`**——它把「git pull → 讀 checkpoint → 逐檔 diff → 檔→頁對照 → render 實測 → 更新 checkpoint」整套固化好了。本節是同一套 SOP 的詳述背景;**操作層的鐵則(尤其新踩的雷)優先寫進 skill**,本節保留為原理/細則參考。
>
> 獨立維護後,遊戲資料的變動來源=「我們自己改 `js/*.js`」或「手動合併原版」;改了遊戲資料(掉落/技能/公式/地圖…)就要跑一輪這套 SOP,把小百科/掉落查詢對齊。
>
> **🔴 鐵則:更新小百科資料前,第一件事一定要先 `git pull`(`git fetch origin && git pull --rebase origin main`)。** 別的 session/裝置可能推過 commit,本機落後就會拿舊的去比、漏掉改版(席琳套裝改版踩過)。沒 pull 不准動手。

小百科是「**多分頁 + 關鍵字搜尋**」。**改它前先讀這節**——以下都是使用者反覆要求過的點,別再犯。

### 「更新小百科內容」SOP

> **🔴 鐵則:絕不可假設「前面幾輪做過了」就跳過 diff——每次都要真的跑 `git diff <reconciledIndexCommit> HEAD -- js/` 把整段逐項勾過(踩過 2026-06-28:我只挑了新檔『裝備收集冊』做、其餘假設 V2.32 已覆蓋就跳過,結果漏掉同期的『瘋狂席琳模式』,被使用者抓到)。** 即使 checkpoint 看起來只差一點、即使覺得自己前面做過,也要把 diff 整段看完、每個改動逐一確認小百科有沒有反映,不可憑印象判斷「應該做過了」。做完才把 checkpoint 推進、並在 note 標「此範圍已逐項對過」。
>
> **🔴 鐵則 2:diff 不只看「新增的資料定義」,更要看「既有公式／機制被改」——機制改動不會以新 `sk_`/`item` 出現,純掃新增一定漏。** 重點讀 `js/02-stats-recompute`、`js/04-combat-attack`、`js/01-drops-config`、`js/05-kill-progression` 裡**被修改的行(diff 的 `-`/`+` 成對)**:傷害公式、加成範圍、掉率倍率、模式行為、存檔/共用桶規則。踩過 2026-06-28:第一輪只 grep 新增定義,把「統一觸發型武器特效公式」「武器+11最終傷害倍率改吃到特效/技能」「瘋狂席琳(怪傷×3)」「收集冊依模式共用」全漏了——這些都是改既有邏輯、不是新增。**自我檢查:我有沒有把 js/02、js/04 的 diff 一行行讀過,而不只是 grep 新 `sk_`/`set_`/`item`?**

> 這套 SOP 是 **diff 驅動、逐檔逐頁、機械式對照**——核心是「每個有變的檔都讀完整 diff,照固定『檔→頁』對照表歸位」,不靠印象判斷「應該做過了」。

1. **同步遠端 + 取錨點**:先 `git fetch origin && git pull --rebase origin main`;讀 `wiki-checkpoint.json` 的 `reconciledIndexCommit` 當 diff 起點(別用 git log 猜)。
2. **列出所有變動的檔(不挑)**:`git diff <reconciledIndexCommit> HEAD --stat -- js/ css/`——**清單上每個有變的檔都要讀**,不可只挑「看起來有新東西」的。
3. **逐檔讀完整 diff,照「檔 → 負責頁」對照表把每個 hunk 歸位**:對每個變動檔跑 `git diff <reconciledIndexCommit> HEAD -- js/<檔>`,**新增的 `+` 行和修改的 `-`/`+` 成對都要讀**,逐一確認對應頁有反映、沒有就補:

   | 改到的檔 | 看什麼 | 對應小百科頁 / dex |
   |---|---|---|
   | `00-data` | 新 技能/物品/套裝/武器/地圖 定義 | 職業魔法·裝備(自動) / 套裝 `SETS`(手動) / 掉落查詢 |
   | `01-drops` | 掉率、世界模式(席琳一般/瘋狂)機制、恩賜 | 席琳 / 掉落查詢 / 戰鬥機制 |
   | `02-stats` | 屬性/衍生值公式、buff 套用、封頂 | 能力值 / 技能效果(`statDeltaTxt`) |
   | `03`-`04` combat | 傷害公式、命中、武器特效 proc、強化倍率、異常狀態 | 戰鬥機制 / 武器特性 / 強化 |
   | `05`-kill | 條件式掉落(`if … gainItem`)、經驗/升級 | 掉落查詢 `SPECIAL_BLOCKS` |
   | `06`-status-allies | 新異常狀態 `kind`、傭兵、召喚 | 戰鬥機制(異常狀態) / 傭兵 / 帶寵物 |
   | `07`-`08` | 施法、裝備規則 | 職業魔法 / 裝備 |
   | `11`-world-map | 地圖/領域 | 地圖 |
   | `12`-npc-quests | 任務/試煉/兌換 NPC、倉庫、收集冊 `_dexKey` | 任務 / 掉落查詢來源 / 卡片·裝備圖鑑 |
   | `13`-shop-save | 商店、存檔、**遊戲模式(一般/經典/傳統)行為** | 戰鬥機制(模式對照) / 卡片·裝備圖鑑(共用桶) |
   | `14`-craft-pandora | 製作配方 | 製作 |
   | `15`-`16` | 卡片/裝備收集(掉落、積分、共用、加成) | 卡片 / 裝備圖鑑 |

   補內容分兩類:**讀遊戲資料自動同步的**(職業專精`MASTERY_DATA`、職業魔法`DB.skills`、裝備`DB.items`、掉落查詢`DB`+五張掉落表)通常不用改;**本檔手動維護的**(`WEAPON_TRAITS`/`SETS`/`ENHANCE_SECTIONS`/`LOAD_SECTIONS`/`SHERINE_SECTIONS`/`PLEDGE_SECTIONS`/`TOWER_SECTIONS`/`QUEST_BY_CLASS`/`QUEST_COMMON`/`MAGIC_FACT`)才要手動補(例:新增「惡魔套裝」→ 加進 `SETS`;職業魔法的實際數據金框→ 加進 `afk-wiki.js` 的 `MAGIC_FACT`)。**⚠ 跨系統的玩法要在相關頁互相帶到**——例:遊戲模式(一般/經典/傳統)頁要講「卡片/裝備收集冊依模式各自共用(同倉庫規則)」、席琳一般/瘋狂、傭兵同模式限制等,不要只寫在單一分頁。下面 ⭐ 是補內容時的細則:
   - **⭐ 全域掉落規則 → 補進掉落查詢的「全域特殊掉落規則」面板(`afk-dex.js` 的 `specialPanelHTML`)**:凡是「不綁特定怪、依條件觸發」的掉落(席琳結晶、施法卷軸變祝福/詛咒、賦予祝福卷軸、區域額外掉落、進化果實…這類掃描怪屬性/區域/全域機率的掉落),因為不在任一怪的 `MOB_DROPS` 裡、掉落查詢搜不到,**一律手動加一格到 `SPECIAL_BLOCKS`**(`{id,title,keys,lines}`;關鍵字放 `keys`、搜尋會自動展開)。每次改動全域掉落都要同步補這裡,不要只更新小百科。
     **🔎 偵測法(別再漏)**:遊戲碼有更新時,grep 掉落結算 code(`js/05-kill-progression.js` 的 `killMob`、`js/06` 等)裡**所有「條件式 `gainItem(...)`」**——`if(...) gainItem(...)` 那種、不是從某張 `*_DROPS` 表 `forEach` 出來的,逐一對照 `SPECIAL_BLOCKS` 有沒有涵蓋,漏的補上。**踩過(2026-06-27):聖地遺物**(`mat_holy_relic`,持「死亡騎士之印記」在拉斯塔巴德區域殺任何怪 0.1%)——它不在任何掉落表、patch note 只當材料一筆帶過,沒掃 killMob 的新條件式掉落,於是漏進 `SPECIAL_BLOCKS`,玩家在掉落查詢搜不到才被發現。**判準:任何 `if(條件) gainItem` 的腳本掉落都要在掉落查詢找得到。**
   - **⭐ 製作不一定都在 `CRAFT_RECIPES`,有「客製製作」另開資料結構,掉落查詢/製作頁要另外補讀**:掉落查詢物品卡與小百科製作頁的製作資訊只讀 `CRAFT_RECIPES`,但**有些裝備走獨立的客製製作系統、不在 `CRAFT_RECIPES`**——目前已知兩組:①惡魔王武器走 `DEMONKING_RECIPES`+`DEMONKING_MATS`(炎魔之影:消耗 +11 以上指定惡魔武器、繼承其強化/詞綴/席琳套裝);②神聖執行團裝備走 `LUMIEL_RECIPES`(琉米埃爾/海音:消耗 +7 以上「戰士團」頭盔/斗篷、繼承其強化/詞綴/席琳套裝)。症狀=「某件裝備查不到在哪製作、且常常一整批」。**遇到「明明可做卻查不到製作」→ 去 `js/*.js` grep `_RECIPES`/`buildXXXCraftHTML`/該裝備 id**,找到那組客製配方後,**同時補進** `afk-dex.js` 的 `buildCraftIndex`(物品卡)**和** `afk-wiki.js` 的 `renderCraft`(製作頁),兩邊都要(dex 若有 `+N 以上`門檻要在 `craftInfoHTML` 加對應 `plusN` 分支)。
     - **⚠ 踩過(2026-07-06):`LUMIEL_RECIPES`/神聖執行團裝備 2026-06-23 就進了 repo,但一直沒補進 `buildCraftIndex`/`renderCraft`→神聖執行團頭盔/斗篷在掉落查詢一路顯示「目前沒有固定取得途徑」(其實可製作)。更惡劣的是下一條 ⭐ 的 `hasFixedSource` 說明早在 2026-06-24 就把 `LUMIEL_RECIPES` 寫進「_craftIndex 含…」清單——但 code 從沒讀它,這個「文件宣稱已涵蓋、實際沒接」害後續稽核以為做過就跳過。判準:別把這份 CLAUDE.md 的「含 X 結構」清單當成「已接好」的證明;新客製結構進來時,實測一件走該結構的成品「在掉落查詢/製作頁真的查得到來源」才算數(見 `/update-wiki` step 5 的 render 實測)。**
   - **⭐ 新掉落物可能不在 `MOB_DROPS`、而在「獨立掉落表」或「純兌換」→ 掉落查詢會查不到,更新小百科時務必一起檢查補上**(龍騎士血之渴望那串踩過):掉落查詢(`afk-dex.js` `buildIndexes`)要與**原作 `_auditMobDrops`(遊戲內「統計→掉落物」用的)讀同一組掉落表**,否則遊戲內統計查得到、我們查不到(戰士印記 `WARRIOR_DROPS` 漏讀踩過)。**判斷哪幾張的權威來源就是 grep `_auditMobDrops` 看它 push 哪些表**,照抄。目前 5 張:**`MOB_DROPS`／`DARK_WEAPON_DROPS`／`DARK_CRYSTAL_DROPS`／`DRAGON_DROPS`／`WARRIOR_DROPS`**。再開**新表**(會加進 `_auditMobDrops`),就把它也加進 `buildIndexes` 的 `raw` 串接(職業限定的任務道具用 `dragonDropNote`/`TRIAL_ITEM_CLASS` 標「🐉僅X」、全職可掉的不附註)。**純兌換/無怪掉的成品**(龍騎士書板·鎖鏈劍·臂甲走「普洛凱爾」兌換、50級試煉獎勵…)沒有任何怪會掉,要在 `afk-extradata.js` 的 `AFK_EXTRA.itemAcquire[id].short` 補「取得方式」;且這類「**非裝備、非商店**」物品(如 `skillbk` 書板)要被收進物品搜尋索引才搜得到名字。**收錄條件(`buildItemIndex`):裝備／在商店(`SHOP_LISTS`)／有 `itemAcquire`／或 `gachaWeight>0`(在潘朵拉抽獎池)** 任一即收。**症狀=玩家在掉落查詢搜某新物品/材料卻查不到**。判準:新增的東西「在 `MOB_DROPS` 裡嗎?」不在 → 去找它在哪張掉落表/哪種兌換,補進掉落查詢,別只更新小百科。
   - **⭐ 「沒有固定來源」已自動偵測(含寶箱與各種試煉/兌換結構)**:掉落查詢 `hasFixedSource(id)` 統一判斷來源,讀:`DROPPED_SET`(怪掉)＋`_craftIndex`(製作,含 `CRAFT_RECIPES`/`DEMONKING_RECIPES`/`LUMIEL_RECIPES`)＋`_shopIndex`(商店)＋`itemAcquire`(手動)＋`boxTiersOf`(歐西里斯寶箱 `OSIRIS_BOX_*`)＋**`trialSourceOf`(各職業試煉/兌換設定結構:`TRIAL_50_CFG`/`DARK_TRIAL_CFG`/`SHENIEN_EX`/`WARRIOR_EX`/`PROCEL_EX`/`YURIA_REWARDS`)**。這些都**讀遊戲全域、改設定自動跟上,不必逐物品手動補**(瑪那水晶球等 50 級試煉成品、影子裝、幻術士裝、戰士團裝、臂甲都靠 `trialSourceOf` 現身)。**潘朵拉限定物(`gachaWeight>0` 且查無固定來源)→ 自動收進搜尋 + 詳情卡標中性句「目前沒有固定取得途徑」**(依規則不提潘朵拉)。**新增「會發裝備的新結構」時**(grep `rewards:`/`reward:`/`_EX`/`_CFG`),把它加進 `buildTrialBy()` 即可一次涵蓋整批。真正剩的死角只有「`gachaWeight=0`、不在任何結構、又沒怪掉」的廢棄/起始裝(留空合理)。
   - **⭐ 取得方式只標「可控」的,潘朵拉黑市(轉蛋)是隨機池、不列(使用者決定)**:掉落查詢物品卡的「取得方式」列(`itemDetailHTML`)**只顯示可控取得**——靈魂之球喚回(巴列斯/巴風特魔杖,走 `SOULORB_RESTORE`)、龍騎士普洛凱爾兌換成品(走 `itemAcquire`)等;**潘朵拉的黑市抽獎雖然幾乎什麼都抽得到,但太不可控、列了是雜訊,刻意不顯示**(別把『潘朵拉抽獎』當來源文字寫出來;但用 `gachaWeight>0` 判斷「在抽獎池→可搜尋＋詳情卡標中性句」是另一回事、是 OK 的,見上節 `hasFixedSource`)。**即使潘朵拉是某物的「唯一」來源也一樣不列**——改寫「目前沒有固定取得途徑」這類中性句,不要寫「只能潘朵拉抽」(使用者明確要求:潘朵拉太難取得、不算取得方式)。小百科「技能書怎麼拿」之類的說明同此原則:只寫試煉/製作/商店/掉落等可控來源,潘朵拉一律不提。製作/掉落另由 `craftInfoHTML` 與搜尋鈕呈現。**(舊「傳說裝備」頁 `renderLegend`/`legendAcquire`/`LEGEND_SOULORB` 已隨「裝備」分頁上線移除;裝備頁的取得方式統一走 `AFK_DEX_API.acquireHTML`,喚回類成品靠 `itemAcquire[id].short` 呈現。`itemAcquire` 的 `chain` 欄是舊傳說頁專用、目前無人讀,新增資料只需填 `short`。)** **遇到新的喚回/兌換機制**(grep `soulorb`/`_restore`/`eff:`)→ 結果裝備補進 `SOULORB_RESTORE`(dex 物品卡)與 `itemAcquire[id].short`(裝備頁/掉落查詢共用)。
4. **每動到一頁就 Playwright 無頭 render 該頁實測**:確認顯示正確(數據對)、無漏翻英文、無 raw key(`sk_`/地圖 id 之類)、無 JS error。改了哪頁測哪頁,別只改不驗。
5. 補完照「每次 push 前的檢查清單」bump 對應外掛 `?v=`(動到 `afk-dex.js` 也要 bump 它)、無頭瀏覽器測過再推。**並把 `wiki-checkpoint.json` 更新成現在的 HEAD**:`reconciledIndexCommit`＝`git rev-parse HEAD`、`reconciledIndexBlob`＝`git rev-parse HEAD:index.html`、`reconciledAt`＝台灣時間(UTC+8),note 寫「逐檔對過、動了哪些頁」,跟這次小百科改動一起 commit——錨點前進了,下次才不會重複比同一段。

### 內容鐵則(踩過、別再犯)

- **⭐ 表格優先 + 有數據就用數據(使用者明訂的鐵則)**:任何分頁,**能用表格呈現就用表格**(門檻/數值/對照/分段),別用散文堆。**程式裡查得到的數字,一律用程式的實際數據/公式講清楚**——優先「動態讀 DB 或呼叫遊戲函式即時產生表格」(像「能力值」頁逐級表、「負重」頁的懲罰階表/上限公式試算表/腰帶 weightCap 直接讀 DB),這樣改數值會自動跟上、不用手抄也不會過時。**散文只留「機制怎麼運作、怎麼解」這種表格表達不了的**。
- **⭐ 數據化、簡潔,不要廢話**:小百科是「查數據」的工具,不是讀物。**接任何功能進小百科前,先巡過「真正算它的那段 code」(函式/查表/公式/旗標),用實際邏輯寫**,不要照遊戲說明或註解抄(那些常過時/模糊)。說明文字壓到一兩句、把細節交給表格。寫完自我檢查:這段有沒有「換句話再講一次」「跨項比較」「meta 旁白」這種對查資料沒用的贅字?有就刪。
- **⭐ 表格已表達的,不要在表格下方再用散文重述一次(使用者明訂・2026-06-27)**:做了對照表/數值表後,**表格本身已經講清楚的東西,不准再在下面用 `m-wiki-desc` 散文「總結/換句話講一次/加感想」**。表格下方**只**保留「表格欄位裝不下的真正補充/例外」(例:「掉寶率 ×1/10 不影響職業試煉道具」這種表格沒涵蓋的例外才留)。自我檢查:這行註解講的東西,表格裡是不是已經有了?有 → 刪。
- **白話、零術語**:不要骰子寫法(`1D4`→「1~4」)、不要「骰19/20」(→寫機率「約 5%/10%」);ER/MR 一律白話「迴避/魔防」。**防禦(AC)比照遊戲內裝備欄用「負值」呈現**——本作 AC 越低越強,遊戲 `buildItemDescHTML` 顯示成「防禦(AC): -d.ac」(正常防具是負的),故小百科/掉落查詢一律寫「防禦(AC) -n」(`friendly()` 只把「AC」標成「防禦(AC)」、保留原本正負號;不要再反相成正值)。負 ac 的下行向裝(如曼波帽子)顯示「+n」即可。
- **🔤 渲染給玩家的內容絕不露出英文——一律翻成中文**(2026-06-27 使用者明訂):小百科/掉落查詢畫面只要冒出英文＝漏翻,回去補「對應表」(改對應表→以後同類自動跟上,別逐筆硬寫死)。兩種狀況:
  - **顯示用的英文詞**(狀態名如 `confuse`/`panic`、數值名如 `magicDmg`、縮寫 `AC`/`ER`/`MR`)→ **先找遊戲有沒有現成中文對應表**(如 `js/06-status-allies.js` 的狀態中文表、`ELE` 元素表),有就比照;**沒有就補進外掛自己的對應表**(`afk-wiki.js` 的 `STATUS_LABEL`/`STAT_LABEL`,或 `AFK_EXTRA`)。⚠ AC 正負要分清楚:**裝備/套裝**的 `d.ac` 已是顯示值(負=好)照原號走 `friendly()`;**技能 buff** 的 `d.ac` 是「要降的量、以 `d.ac -= 值` 套用」(正值=降AC=變強),故 `statDeltaTxt` 顯示「實際 AC 變化＝−v」、別照原號(否則鋼鐵防護/狂暴術正負全反,踩過)。
  - **英文 key**(地圖 id 如 `elder_room`、物品/技能 id)→ **去遊戲 code 找它的中文**(新地圖查 `MAP_REGIONS`/`MAP_CATEGORIES` 的 `t`、`DB.towns.n`、`HIDDEN_AREA_NAMES`;一律集中走 `AFK_EXTRA.mapName`,別各自寫)。
  - **判準**:渲染結果出現連續英文字母(HP/MP/BOSS/Lv 這種通用縮寫除外)就是漏翻 → 回去找對應中文、補對應表。
  - **⭐ 地圖名漏翻已有 smoke 自動防護(2026-06-29 加)**:`scripts/smoke-hooks.mjs` 會把 `DB.maps` 全部 key 過一次 `AFK_EXTRA.mapName`,只要有 key 解析後 `name===id`(原樣回傳)或仍含英文字母就 `exit 1`。新增「不在 `MAP_CATEGORIES`/`MAP_REGIONS`/`DB.towns`/`HIDDEN_AREA_NAMES` 的地圖結構」→ push 前的 smoke(`/prepush` 內含)會擋下,**這時去 `afk-extradata.js` 的 `mapName` 補上該 id→中文(優先讀遊戲的表,沒有才硬寫)**。這是「掉落查詢地圖漏英文」的根治法,不必逐次靠人眼抓。
- **不要改版說明的語氣**:小百科是寫「現況」給玩家看,不是 changelog。別用「現在/原本是/已改成/不再/不會再…了」這種帶時間感、像更新公告的句子——直接陳述現在的事實(例:寫「屬性/遠古無法靠打怪取得,只能用碧恩的卷軸」,**不要**寫「屬性/遠古『現在』不會隨機掉了」)。
- **要精確數據、不要模糊**:不准「短時間/有機率/提升/依等級」這種沒數字的;去 code 查實際數值/公式補。真的是看等級差/隨智力浮動沒固定值的,**照公式寫**、別硬編一個百分比。
- **🔑 數據一律以「程式碼的實際邏輯」為準,絕不直接抄遊戲內的說明文字或註解**:遊戲裡的物品/技能說明(`d:`/`item.d`/技能 `msg`)與 code 註解,是寫給玩家看的白話、常常**模糊、過時、或與實際公式不符**。寫小百科數據時**一定要追到真正算它的那段 code**(函式/查表/公式/常數),用那裡的實際值。例:擊殺回 MP 去查 `getWisMpOnKill(wis)` 的分段表;掉率去查 `MOB_DROPS`/掉落判定式而非道具描述。**自我檢查:我這個數字是「從負責計算的 code」拿的,還是「從一段給玩家看的文字/註解」抄的?** 後者一律不可信,回去找 code。
- **不要塞沒用的 () 補充**:括號只放「對玩家有用的事實/數據」(等級、機率、需求屬性、地點…)。<b>跨職業比較(「與燃燒鬥志同效」)、meta 註解(「刻意設計」)、把詞換句話再講一次 這種旁註一律不要</b>——它們不是玩家要的資訊,只是雜訊。能用一句乾淨的話講完就別硬加括號。
- **掉率/機率:依「怪等/類型」分段的要逐段列、且換算倍率別抄錯(席琳結晶踩過)**:code 裡常是 `if 怪等>=21 ... >=31 ... >=41` 或「BOSS/三大龍/夢幻之島各一個值」這種**分段**機率,小百科要**把每一段都列出來**,不要用「約萬分之一級距」這種一句話帶過(既模糊、又往往錯)。換算成百分比時**小心位數**:code 的小數 ×100 才是 %——`0.00001`=**0.001%**(十萬分之一),不是「萬分之一」;抄錯一位就差 10 倍。寫完自己反算一次:`%數 ÷ 100` 要等於 code 裡那個小數。另注意「不吃掉落倍率」這種旁註(席琳結晶機率固定、不受席琳世界 ×3 影響)也要寫進去。
- **⭐ 寫任何一條掉率,一定要把「吃不吃倍率」四個倍率一次講完(席琳×3／瘋狂×5／恩賜怪×10／經典×1/10),不能只提其中一個(踩過 2026-07-09:三階卡片)**:判準去 code 看該次 roll 的機率有沒有乘 `_dropMult`/`_dropBase`/`classicDropMult()`——沒乘就是「固定機率、四個倍率全不吃」,要在小百科明講「不受任何掉落倍率影響」,別只寫「不受經典模式影響」害玩家以為席琳有加成(`rollCardDrops` 的三階卡片正是固定機率,原本小百科只寫了經典那半句)。**且要兩邊同步**:凡是「不吃倍率」的掉落,除了小百科該頁,還要出現在**掉落查詢 `afk-dex.js` `SPECIAL_BLOCKS` 的 `dropmult` 區塊「固定、不受倍率影響的例外」清單**裡(那份清單就是玩家查倍率時看的單一真相);新增這類掉落 → 兩處都補。
- **時間單位**:技能 `dur`(buff/狀態)是**秒**;HoT 的 `hot.interval` 是 **tick(÷10 才是秒)**;顯示用「X 分 Y 秒 / X 小時 Y 分」(`fmtDur`),**不要跑出「5.3 分鐘」這種小數**。
- **能讀遊戲資料就讀,少硬寫**:會變動的(套裝效果/技能/掉落/地圖名)優先動態讀 DB/遊戲常數,讀不到才用本檔備援(如 `SHERINE_SET_FALLBACK`)。**很多 `gainItem(...false,false)` 旁的舊註解已過時**——動手前去 code 確認,別照舊註解(例:黑市直接購買「即所見、不附詞綴」**不是詞綴來源**;屬性/遠古只能靠碧恩賦予祝福卷軸,不會隨機掉)。
- **分類對齊原版、不要同一個東西每職業重複跳**:法師魔法(1~10 階)是共用本職法術→**只列一次**,標「可學:法師x/妖精y/騎士z/黑暗妖精w」;妖精/黑暗妖精/騎士的專屬魔法分開列。判類:有 `reqM`=法師魔法;否則 `reqE`/`reqD`/`reqK` 歸專屬。黑暗妖精固定可學 1/2 階(Lv12/24)、妖精高階法師魔法標「需魔導精通」。

### 介面/排版鐵則

- **搜尋=「統一結果」**:打字就收起分頁列與職業列,跨「全部分頁+全部職業」一次列出命中區塊、依來源分組、關鍵字黃色高亮;**不要做成「切職業整頁消失」**(踩過)。職業相關分頁(專精/任務)搜尋時逐職業各搜;魔法是分類制故單次搜。
- **分頁列單排可左右捲動**(`flex-nowrap + overflow-x:auto`),不要換行兩排。
- **職業魔法分頁有「職業篩選」**(全部/法師/妖精/騎士/黑暗妖精):「全部」=分類總覽(法師魔法按階+各專屬);選某職業=只看「該職業學得到的魔法」(含可學的法師魔法,標該職業可學等級)。
- **手機**:不要為了標示加會被內容撐高的元素——席琳世界用「狀態列染紅」標示;怪物卡固定高 + 名稱兩行截斷(別隨怪/名稱長短抖動)。

## 🚨 每次 push 前的檢查清單

> **🛠️ 這份清單已包成 `/prepush` skill(`.claude/skills/prepush/`):自動偵測改動的外掛→bump `?v=`→`stamp-sw-version`→smoke→掃衝突標記。準備 push 時跑 `/prepush` 即可。另有 `.claude/` 兩個 hook 兜底:`git push` 前自動擋衝突標記/漏引用/sw 版本過時(prepush-guard)、改 `afk-*.js` 後提醒 bump(bump-reminder)。** 下面是清單本體(skill/hook 即據此):

1. **確認所有外掛 JS 都已在 `index.html` 有 `<script>` 引用**(在 `</body>` 前;目前 20 支,清單見上方外掛表,以 index.html 現況為準)。
   - 新增外掛時,**務必同時**加上對應的 `<script>` 行;**有 DOM 掛點的**再加進 `scripts/smoke-hooks.mjs` 的 `need`(像 `afk-sw.js` 這種純註冊、無 DOM 掛點的就不必),否則功能不會生效、或掛點壞了沒人擋。
   - **⚠️ 改「外掛 init 觸發條件」(尤其只在特定裝置/尺寸才執行的)→ 想清楚 smoke 那輪驗不驗得到它。踩過(2026-07-01):`afk-mobile` 改成「桌機零接觸」(只有手機尺寸/裝置才 `init` 並印 `[AFK-mobile] hooks OK`)後,smoke 是用桌機視窗跑的 → afk-mobile 永遠印不出 hooks OK → 假性失效。修法:smoke 對「只在手機才 init 的外掛」用 `devices['iPhone 13']` 開第二輪 context 專驗(`needMobileOnly=['[AFK-mobile]']`),桌機那輪不列入。判準:任何「掛點只在某條件下才建立」的外掛,smoke 必須在該條件下(手機模擬/特定狀態)驗它,否則就是假性失效。**
2. **smoke 沒有任何自動排程在跑(自動同步已停),一律 push 前本機跑**:`node scripts/smoke-hooks.mjs` → exit 0 才推(`/prepush` 內含)。紅了代表某外掛 hook 失效,回報是哪支。
3. **改了任何外掛 JS → 一定要 bump `?v=` 版本號**(GitHub Pages / 瀏覽器會死命快取 JS;只改 `index.html?v=` 沒用,因為 script src 的檔名沒變、瀏覽器照樣給舊的快取 JS)。版本號規則:日期 + 當天流水字母(如 `20260613a` → `20260613b`)。**沒 bump 的話使用者載到的還是舊外掛,debug 會鬼打牆**(踩過一整輪才發現)。

   ### 🚨🚨 `js/*.js` 與 `css/*.css` 的 `?v=` 一律用 `node scripts/stamp-code-versions.mjs` 自動對齊,不要靠手動記得(2026-07-11 踩過,害玩家離線收益歸零)

   **漏 bump 不只是「載到舊檔」,而是「新舊混搭」——後果比想像嚴重、症狀完全不像快取問題。**

   踩過的實例:「移植遺物系統」那個 commit 同時改了 `js/04`(新增 `equipSkillDmgMult()`)與 `js/07`(呼叫它),**兩個 `?v=` 都沒 bump**(當時 04 的 `?v=` 停在 7/05、07 停在 7/09)。URL 沒變 ⇒ 玩家載到哪一版,**全看他哪一天第一次抓到那個檔**:
   - 兩個檔都是舊快取 → 沒事(舊 07 不會呼叫)
   - **`js/07` 是新抓的、`js/04` 早就躺在快取裡 → 新 07 呼叫舊 04 裡還不存在的函式 → `ReferenceError: Can't find variable: equipSkillDmgMult`**

   而這個例外正好炸在離線結算的迴圈裡 → 被 `catch` 吞掉 → 玩家只看到「🌙 離線掛機 0 分鐘（無明顯收益）」,**整晚收益歸零**。因為取決於每個玩家的快取時序,所以**低機率、無法重現、log 什麼都看不到**,查了非常久。

   - **判準:凡動過 `js/*.js` / `css/*.css`,push 前一律跑 `node scripts/stamp-code-versions.mjs`**(自動把 `?v=` 對齊內容 sha1 前 10 碼),再用 `--check` 確認 exit 0。`/prepush` 已內含這兩步。
   - **絕不可只 bump「自己這次有印象改到」的那幾支**——大型移植/合併常一次動十幾個檔,人一定會漏。腳本掃全部,沒有例外。
   - 同理:跨檔案的「新函式 + 新呼叫」拆在不同檔時,兩邊的 `?v=` 必須同時更新,否則就是製造上面那顆地雷。
   - **改完任何程式檔,push 前再跑一次 `node scripts/stamp-sw-version.mjs`**(從 repo 根目錄)——重算 `sw.js` 的 `CODE_VERSION`,PWA 才偵測得到更新。漏跑的話「已安裝的 app」不會跳更新。
   - **新增/更換/刪除 `assets/`、`public/assets/` 的圖 → 跑 `node scripts/gen-manifests.mjs`** 重產對帳清單並一起 commit(否則 PWA 玩家卡舊圖/離線 404)。
4. 確認沒有把 `.scratch/`、`node_modules/` 等暫存物混進 commit(見下)。
5. 載入遊戲後開 console,確認看到各外掛的 `[AFK*] hooks OK`,沒有缺掛點的警告。

## 暫存檔 / 測試

- 一次性測試腳本、Playwright、截圖等一律放 `.scratch/`,且已被 `.gitignore` 擋掉,不進 git。
- 驗證手段:用 Playwright(`playwright-core` 指向本機快取 Chromium)無頭跑 `index.html`,截圖或讀 DOM 驗證。
- **Playwright 一律 headless(無頭),不可彈出可見瀏覽器視窗干擾使用者螢幕。** 不管用 `playwright-core` 腳本還是 MCP 瀏覽器工具都一樣:腳本用 `chromium.launch({ headless: true })`;MCP 瀏覽器若預設會開可見視窗,就改回腳本式無頭驗證,不要在使用者畫面上彈窗。截圖一律走無頭截圖。
- **🚨 會「動到玩家存檔(寫入/覆蓋 localStorage)」的功能,上線前一定要測「真實角色 → 操作 → 確認存檔沒被改壞」這條路,不能只用合成資料測機制。**(踩過:存檔轉移用「塞假存檔到第 2 格、只驗第 2 格還在」測過就上線,結果漏掉「`saveGame()` 蓋掉的是 currentSlot=第 1 格」,把玩家角色弄成 Lv.1 null。)鐵則:
  - **測試要涵蓋真實觸發狀態**——存檔功能多半從**主選單(未載入角色)**觸發,就要在「未載入角色」狀態測,別只在「已載入」狀態測。
  - **斷言要看得到災情**:操作前後**比對「使用者實際會用的那一格 / 全部相關鍵」的內容有沒有被非預期改寫**,而不是只檢查自己有興趣的那格。
  - 動到存檔前,先想清楚「這個操作會不會在某狀態下覆蓋既有存檔、有沒有備份能救」;沒備份的覆蓋風險 = 上線前必須用真角色實測到放心為止。

### 量測效能時:每跑一輪前「重新整理頁面」,不要用 `loadGame()` 在原地重置(會漏記憶體污染數字)

實測過:在「同一個分頁、不重整」的情況下重複呼叫 `loadGame()`(載入存檔)來重置角色,第二次起記憶體會從 ~17MB 暴漲到 ~97MB、每個 tick 從 ~0.1ms 變 ~0.9ms(慢 9 倍)。原因是 `loadGame()` 連帶啟動的計時器/事件監聽/DOM 每次都「再掛一份」、舊的沒拆掉,連續載入就一直疊。**正解:每次量測前重新導航到網址(整個 JS 環境倒掉重來),不要在原地 `loadGame()` 重置**,否則 A/B 比較的後半段數字全被污染。
- 對一般玩家正常不影響(開遊戲只載入一次)。**待查疑點**:遊戲內「不重整就切存檔位/匯入存檔/回主選單再進」若底層直接再 `loadGame()` 而沒先清乾淨,連續切幾次可能變鈍——尚未驗證,先當備忘。

## 🗺️ 離線掛機原則:等同「在線上掛機照跑」+ 非選單地圖(攀登/遺忘之島)的續掛寫法

> **🏠 2026-07-10 起離線掛機是核心模組 `js/offline.js`(外掛 afk-offline.js 以 git mv 移入、已退役)**。要點:
> - **檔名刻意不用數字開頭**(使用者明訂):日後手動合併原版可能新增 js/21-*.js 等編號檔,避免衝突。index.html 的 `<script>` 排在 js/20 之後、所有 afk-*.js 外掛之前。
> - **對外相容不變**:localStorage 鍵(`afk_ts_/afk_map_/afk_pride_/afk_obl_/afk_hist_<slot>`)、`window.__afk` 介面(afk-mobile 用 `stamp`、afk-slotinfo 用 `mapName/capHours`、afk-history 用 `histKey`)、`[AFK] hooks OK` 開機訊息(smoke 認這個)全沿用——玩家更新前累積的離線時間照結算。
> - **掛點=核心直呼,不再 monkey-patch**:js/13 `loadGame` 開頭 `offlinePreLoad()`(必須在回村甦醒覆寫錨點前擷取;**「離線前狀態」一律在這裡讀,連 afk_map 缺值時的「後備讀存檔 blob」也是**——回村甦醒會觸發存檔(`mercBankAlliesAtTown` 傭兵入庫 saveGame)把 blob 所在地圖蓋成村莊,晚讀=誤判在村莊而跳過整段結算,2026-07-10 踩過)→ 成功載入尾端 `offlineAfterLoad(pre)`;js/13 `saveGame`/js/11 `changeMap` 尾端 `offlineStamp()`;js/05 `killMob`/js/08 `gainItem` 經 `window.__afkKillTally/__afkGainTally` 計數(平時 null 零開銷)。
> - **💾 分段檢查點(2026-07-10 修「結算中斷=整晚蒸發」)**:結算每 ~5 秒真實時間 `saveGame`+把錨點推進到「closeTs+已結算拍數」(絕不是「現在」),並 upsert 同 closeTs 的離線紀錄;`stamp()` 在 `catchingUp` 期間一律跳過(心跳/存檔/落點 changeMap 都蓋不了錨點)。中斷後下次載入只補剩餘。**判準:任何新程式碼想在結算期間蓋 afk_ts,都是 bug。**
> - **其餘同日修正**:略過結算(村莊/攻城/排名/裂痕/木人場/非標準圖)會用 `skipNote` 寫一句白話進系統日誌(先前只寫 console,玩家看不到原因);`runCatchup` 全程 try/finally 包死 `catchingUp` 旗標(先前前段丟例外會讓同頁面之後所有角色都靜默不結算);afk_map 缺值的後備讀存檔改走 `_lzGet`+`_saveUnwrap`(存檔已壓縮+簽章,先前直接 JSON.parse 必失敗)。

核心原則:**離線掛機 = 把「在線上會發生的掛機」照跑一遍**,行為盡量與在線一致(同圖續掛、撞死即停結算到死前、存活回原地)。新增/修改離線行為前先對齊這條,不要自己發明特例。

### ⚡ 混合快速結算(2026-07-06 上線;2026-07-10 改「事件驅動」):一般圖長離線不再逐拍模擬

- **流程(2026-07-10 事件驅動版)**:先真模擬取樣 5 分鐘(殺數 <60 自動延長至 15 分鐘)量出「平均每殺的**純戰鬥**拍數 svcPerKill(=取樣『場上有怪』的拍數÷殺數;出怪等待不混進殺速)+消耗品每拍耗率+最低血量」→ 安全(門檻見下)就把剩餘時間改成「事件驅動逐殺」:**出怪走核心 `maybeSpawnMobs()`(js/03,自 tick() 原樣抽出、與線上同一份排程)——出怪延遲/長老之室 BOSS 節流/後排格/席琳與日光加速全照原作,時間直接跳到「下一隻出怪/殺完這隻」的事件點**;殺「全場最早出生」那隻(=原作 getTarget 鎖定序)走 `killMob→settleDeadMobs` 真實獎勵管線,**掉落擲骰/經驗/任務/卡片/收集冊/誘捕/傭兵經驗每殺獨立 RNG、與線上完全一致**。
  - **⏱ 殺完要「立刻」`maybeSpawnMobs()` 再推進時間**:重生計時起點=怪死當下(與線上一致);等下一輪(時間已推進)才排,每殺晚一拍 → 出怪率被系統性壓低(spawn-limited 圖對這個順序很敏感)。
  - **⚡ 批次擊殺(AOE 保真)**:取樣多量「死亡事件數」(同一拍多殺=1 事件)→ `batchPerEvent`=平均每事件同時死幾隻、`svcPerEvent`=每事件純戰鬥拍數;快速段一個事件殺一批、時間按「實際殺數÷batch」比例推進(場上不夠殺滿一批只付對應比例)。**「一次殺一隻」的串行模型會把 AOE 角色清場速度壓低、出怪跟不上 → 高出怪圖(龍之谷/火龍窟)收益 -30~40%(2026-07-10 真實存檔實測踩過)。** 單體角色 batch≈1 行為不變。
  - **🐲 BOSS 秒殺的順序鐵則:「先補小怪 → 推進視窗時間 → 最後才殺 BOSS」——對打視窗期間 BOSS 必須留在場上**:補殺與視窗內的出怪抽選經過核心 spawnMob 的「同名限一隻/`allowMultiBoss`(=backSlotsActive,5格圖可多BOSS共存)/長老節流」時要看得到它。先殺後補的話,單一 BOSS 種的圖(傲慢樓層)會在視窗內又抽出同名 BOSS → BOSS 率超發 +30%(踩過);反之補殺抽到「異名 BOSS」要留在場上待後續事件處理(可共存圖的視窗內本來就會出下一種 BOSS),直接丟棄會把 BOSS 率砍近半(也踩過)。
  - **🐲 BOSS 抽驗+移動平均(`BOSS_REVERIFY_P`=5%)**:每 ~20 隻「已驗證安全」的同名 BOSS 抽 1 隻真打,實測耗時/同場小怪數與舊值各半混合——單一首打樣本變異極大(同 BOSS 兩輪量到 27 vs 316 拍),外推整晚會嚴重失真。
  - **🧪 快速段要維持「線上會自動續」的 buff(`maintainedBuffSet`)**:有勾自動喝/自動施放的 buff,秒數扣到 1 停住不歸零——快速段不跑 autoActions,沒人續的話加速類一掉,出怪延遲從 ~20 拍變 ~33 拍,spawn-limited 圖收益被砍 2~3 成(踩過:龍之谷 -24% 的主因)。藥水消耗量本就由取樣耗率扣帳,不會少扣。**判準:凡「影響出怪延遲/殺速、且線上由 autoActions 週期性維持」的狀態,快速段都要想辦法維持或等效補償。**
  - **🚨 舊引擎(spawnMob(0) 單格連續出怪)的重大 bug,事件驅動的直接動機(2026-07-10 玩家回報+已重現)**:舊快速段只操作 0 號格位,**取樣段結束時殘留在 1~4 號格位的怪永遠不會被殺**;殘留的若是 BOSS → `spawnMob` 的 `bossInBattle` 檢查整晚為 true → **BOSS 再也不出**。玩家案例:三隻同存檔角色掛傲慢 71~80 樓 8 小時,兩隻殺了 ~451 隻闇黑的騎士范德、一隻只有 3 隻(傳送符/金錢差一大截、經驗正常——小怪沒受影響)。用真實存檔對舊引擎重跑 5 輪,1 輪重現(范德 4 隻 vs 其他輪 ~193)。事件驅動殺「最早出生」、任何格位都會被消化,結構上不再可能。**判準:快速結算的任何改動,都不可讓「場上某格位的怪」有機會永遠不被處理。**
  - 實測(玩家真實存檔 Lv96 法師,6h A/B,2026-07-10 最終版):**傲慢71~80(單 BOSS 種):exp -0.2%、gold +0.6%、范德 -0.5%**;火龍窟/龍之谷(多 BOSS 種+AOE+高出怪)exp/gold/BOSS **+10~14%**、長老之室(8 BOSS 種+節流)exp/gold **+12%**(BOSS 隻數 +25%,收益已含)——偏高方向=多給玩家,與舊引擎 elder +13% 同幅度,使用者先前已裁定此方向可接受;一般圖(training)+1~6%。結算速度:真實法師 6h 快速 ~8-25 秒、全模擬 ~13-33 秒(這隻殺量極大屬上限;快取命中再省取樣)。**判準:AOE+spawn-limited 圖快速略偏高屬已知取捨;再調要動視窗端場補償,複雜度高、方向又是給玩家,先不動。**
- **🐲 BOSS 懶驗證(2026-07-06 使用者要求)**:BOSS 不吃小怪均速——每「種」BOSS(按名字)**第一次遇到 → 切回逐拍真模擬打到倒下**(打輸=撞死即停照舊、打不動=照實耗完時間),記錄「實測耗時+對打全程最低血量+對戰期間同場小怪殺數」;之後同名 BOSS:安全的 → 即殺但**時間按該 BOSS 實測耗時推進**,對打時血量掉太深的 → 每次都真打。純 BOSS 圖(龍窟類)因此自然接近全真模擬。實測:24h 強制出 228 隻德雷克,只有第 1 隻真打(1631 拍),其餘按實測耗時快轉。
  - **⚡ BOSS 秒殺要補回「同場小怪」收益(2026-07-08)**:秒殺同名 BOSS 只殺 BOSS 本體、卻推進了「該 BOSS 實測耗時」(可能上千拍),但那段時間內旁邊小怪本會被 AOE/傭兵/寵物清掉——不補的話這批小怪收益整段憑空消失(使用者抓到)。修法:首次真打該 BOSS 時記下「對戰期間同場小怪殺數」(`bossStats[名].minor`=對戰總殺數−BOSS本身1),秒殺時 `fastKillMinors(minor)` 按實測數量補殺小怪(只走 killMob/settleDeadMobs 拿真實掉落經驗,**不重複推進時間、不重複扣消耗品**——時間與消耗已由 `fastAdvance(_bs.ticks)` 一次涵蓋;抽到 BOSS 跳過)。用「該 BOSS 實測小怪數」而非全圖均速→純 BOSS 圖對戰無小怪自動補 0。**判準:任何「秒殺/快轉跳過一段時間」的優化,都要問這段時間內還有什麼收益來源(同場小怪、週期掉落…)被一起跳過了。**
- **一律退回全模擬 / 血量門檻線性歸 0(2026-07-08)**:攀登/遺忘之島「途中」/軍王之室(fastEligible 排除;**遺忘之島「本島」2026-07-10 起納入快速**——本島是無限刷怪圖、無後續推進,「途中」因有傳送門 BOSS 進度門檻且怪組與本島不同維持全模擬)、殺數太少。
  - **⚔ 軍王之室「實測後決定」維持全模擬(2026-07-10,曾做完整實作+A/B 後退回)**:王房內容=BOSS 對打本身,快速模式的首打+5% 抽驗全是真打 → **結算耗時幾乎沒變快**(魔獸軍王 6h:快速 20s vs 全模擬 19s),收益反而失真(魔獸軍王 +23%——抽驗以滿 MP 開打 vs 全模擬持續耗魔穩態;底比斯 -16%)。全模擬跑王房本來就快(24h ≈ 75 秒)。事件迴圈保留 `_kbRespawnAt` 時間軸與 `kingLeftRoom` 偵測,重啟只需拿掉 fastEligible 的 `!isKing`。**判準:「內容=BOSS 真打」的圖,快速模式無利可圖,別硬收。**
  - **🧪 消耗品斷貨(箭/藥/卷軸/肉,白名單制)且自動購買補不上 → 不再永久退出(2026-07-10)**:改「重新取樣+固定 70% 血量門檻」評估沒藥/沒箭的新戰局——撐得穩就回快速,撐不穩維持真模擬(保住撞死即停)。固定門檻的原因:「撐過 20 分鐘=打得過」的信任基礎在戰局質變後不成立,不能再隨時間放寬。**質變後量到的統計不寫入快取**(簽章不含消耗品庫存,隔天補貨後會拿沒藥的殺速亂算)。**升級 → 殺速變了 → 退回真模擬重取樣**(FAST_RESAMPLE_TICKS)。血量門檻**不再是固定 70%,也不是階梯放寬**:改成隨真模擬存活拍數 `done` **線性下降**——`hpFloorNow() = 70% × (1 − done/HP_FLOOR_ZERO_TICKS)`,即時用 `done` 算,取樣與 BOSS safe 共用同一條;**存活滿 20 分鐘(12000 拍)門檻歸 0**、之後一律切快速、BOSS 首遇打得贏就 safe。設計原因(使用者要求・避免整個 24h 被拖慢):真正拖慢的是**密集 BOSS 圖每種 BOSS 每次真打**(龍窟/長老之室),固定門檻下它們血量常掉破線→永遠 unsafe→整晚全逐拍;線性歸 0 讓「撐過前 20 分鐘=打得過」的角色之後全秒殺。代價=撞死即停在 20 分鐘後對快速段失效(掛在打不過的圖也秒殺收滿),但有兩層兜底:①每種 BOSS 首遇仍逐拍真打一次,那次就死照樣撞死即停;②前 20 分鐘門檻漸降、非一開就放行。**判準:改門檻/加保護時,先分清「拖慢主因是取樣門檻(一般小怪)還是 BOSS safe(密集 BOSS 圖)」——後者才是重災區,別誤動前者。** 實測(Lv96 法師):elder_room 8 種長老 BOSS 從「全 unsafe 每次真打」→「全 safe 秒殺+補小怪」,24h 秒級算完、無死亡。
  - **⚖️ 出怪節流保真(歷史:2026-07-08 舊引擎在 elder_room 類節流圖偏高 ~13%,使用者當時接受;2026-07-10 事件驅動已結構性修掉)**:舊引擎 `spawnMob(0)` 連續出怪、不重現「場上最多 2 隻、第 2 隻等 3 分鐘」的節流 → BOSS 出得比真實密。事件驅動版的出怪(含節流判斷)全走核心 `maybeSpawnMobs()`、BOSS 佔場期間 kill+advance 原子化(對應線上 `bossInBattle` 擋新 BOSS),節流自然生效、不再分歧。**判準:快速段永遠不要自己刻出怪規則——出怪一律呼叫 `maybeSpawnMobs()`,節流/機率/格位規則跟核心走。**
- **💾 結算統計快取(2026-07-10)**:量到的統計(svcPerKill/每種 BOSS 實測/消耗率)存進存檔 `player._offStats` 帶簽章(引擎版+地圖+等級+席琳/瘋狂/經典/傳統+全裝備 id+強化),下次**同簽章直接進快速段——跳過 5 分鐘取樣與每種 BOSS 首打**,「進圖就關」的玩家第一天照舊、之後每天秒收(真實存檔驗證:快取命中收益差 0.7%)。失效條件:簽章不符(升級/換裝/換圖/換模式)、超過 72h(防平衡改版後舊統計久留)、**結算中撞死時清除**(那套配置會死,統計不可信)。快取由 evalSample/BOSS 首打倒下時更新(`saveOffStats`),隨檢查點/結算尾 saveGame 固化。sanitizeState 只夾既有欄位,`_offStats` 不受影響。
- **消耗品**:箭走原作 `consumeArrow()`(自動換裝/自動買箭/沙哈不扣,1:1);治癒/增益藥水斷貨照 `autoActions` 的自動購買條件仿買;肉/魔法屏障卷軸呼叫 `window.__afkAutobuyCheck`(afk-autobuy 暴露)。HP/MP 軌跡不模擬——結算存活本就補滿。自動賣廢品照原 `state._junkSellAt` 排程跑(免 24h 掉落塞爆背包)。
- **快速段會推進 `state.ticks`**(每殺 +round(拍/殺)),召喚/buff 的 endTick、賣廢品排程才不會凍結。**⚠ 快速段不跑 `tick()`,凡「靠 tick() 逐拍/每秒遞減」的玩家狀態都會凍結——與「絕對 tick 時間點」的狀態脫鉤就是 bug**(踩過 2026-07-07:`player.buffs` 秒數凍結、召喚物 endTick 照走 → 掛機回來精靈被移除但 buff 仍正,自動施放不重召。已在 `fastAdvance` 同步扣 buff 秒數,歸零後回線上 autoActions 自動重施)。判準:遊戲新增「每 tick 遞減的計時器」且會影響離線行為 → 檢查 fastAdvance 要不要同步推進。`logSys` 在 ff 靜音 → 快速段的買箭/買藥訊息本來就不會出現,**debug 時別誤判成「沒買」**(判準:快速段沒印「退回全模擬」=補貨正常)。
- **⚠ 快速段繞過 `tick()`→也繞過 `autoActions()`,凡「只寫在 autoActions 的自動行為」在快速段都不會自己發生,要在快速段各自補上(踩過 2026-07-08:遇 BOSS 自動瞬移逃離)**:自動瞬移、自動施法、自動購買、自動換裝這類都掛在 `autoActions()`(由 `tick()` 每拍呼叫),而快速段是 `spawnMob→killMob→settleDeadMobs`、不跑 `tick()`,所以這些自動行為在快速段一律不觸發。判準:遊戲在 `autoActions` 加了新的「戰鬥中自動反應」且會影響離線收益 → 檢查 `fastKillOnce`/`fastAdvance` 要不要補。**⭐ 補的時候鐵則:要「模擬某個原作自動行為」時,直接呼叫原作那支函式(如瞬移就 `useItem(scroll.uid, true)`),不要自己刻它的前置守衛/地圖清單**——`useItem` 的 teleport_scroll 分支內部已依序擋掉「行動限制狀態／軍王之室(`KING_ROOMS`)／`prideTeleportBlocked()`(時空裂痕·排名·傲慢之塔11F+無支配符)／遺忘之島(`state.oblivion`)」且被擋下不消耗卷軸;自己在外掛重列一份「哪些地圖能瞬移」必漏(第一版只擋了 siege/純BOSS房,漏了傲慢之塔11F+無符→會白扣卷軸還硬瞬移,使用者抓到)。重用原作函式 = 永遠與原作規則同步、不分歧。
- **⚠ 補跑(ff)期間「戰鬥路徑直接呼叫的渲染函式」會洩漏到畫面+白費效能——render* 要嘛在呼叫點包 `!state.ff`、要嘛函式內自帶 `if(state.ff)return`(踩過 2026-07-08:傭兵倒地動畫)**:離線/背景補跑時 `state.ff=true`,`tick()` 尾端的 `updateUI()`/`renderMobs()` 都包在 `if(!state.ff){…}` 裡不會動畫面;但戰鬥子路徑常「直接」呼叫某個 render(傭兵倒地/復活/升級 → `renderSquadPanel()`;`js/04`/`js/06`/`js/05` 多處),這種**繞過 tick 尾端那層守衛**,補跑時照樣整塊 `innerHTML` 重建 → 畫面閃倒地動畫、還很吃效能。已在 `renderSquadPanel` 開頭加 `if(state.ff)return`(一處擋全部呼叫點,補跑結束後由正常 `updateUI` 再畫一次最終狀態)。判準:任何「戰鬥/傭兵/掉落等 tick 期間會跑到的路徑」若**直接** call `render*`/改 DOM,grep 它有沒有被 `!state.ff` 包住或函式內早退;沒有就是 ff 洩漏(症狀=離線掛機回來看到戰鬥動畫/面板在跳)。`renderMobs` 是逐呼叫點包、`renderSquadPanel`/`_updateUIImpl` 是函式內早退,兩種都行、擇一即可。**同類但更貴:`saveGame()` 這種「重副作用」也算(踩過 2026-07-10:殺王自動存檔 `js/05` 沒擋 ff → 傲慢之塔 6h 離線殺 77 王=77 次序列化+壓縮存檔,佔整個結算耗時 8 成;加 `!state.ff` 後 6h 結算 3.6s→0.6s、24h 2s)**。補跑期間的存檔保護由離線模組「每 5 秒檢查點」統一負責,戰鬥路徑不必也不該逐事件存檔。判準補充:grep 戰鬥路徑的 `saveGame()` 呼叫點,凡「事件驅動、離線一晚會觸發數十次以上」的都要 `!state.ff`(`kbRoomRespawn` 的既有寫法就是範本)。
- **⚠ 「遊戲邏輯的時間判斷」要用遊戲時鐘 `state.ticks`,不要用牆鐘 `Date.now()`——否則離線補跑(壓縮時間)會失真(踩過 2026-07-08:長老之室 BOSS 3 分鐘節流)**:離線補跑把 24h 遊戲時間壓進幾秒跑完,`Date.now()`(真實時間)只走幾秒 → 任何用 `Date.now()` 做「經過多久」判斷的遊戲邏輯,在補跑期間都幾乎凍住。踩過:長老之室「第 1 隻 BOSS 活滿 3 分鐘才出第 2 隻」原本用 `Date.now()-_bornMs>=180000`,離線時 3 分鐘牆鐘湊不到 → 第 2 隻永遠不出 → 離線比線上少一隻 BOSS、危險度失真。已改成 `state.ticks-_bornTick>=1800`(3 分鐘=1800 拍)。遊戲裡絕大多數時間邏輯(出怪排程 `spawnAt`、軍王復活 `_kbRespawnAt`、buff `endTick`)本來就用 `state.ticks`,補跑會正確推進它;偶爾走偏用 `Date.now()` 的才要抓回來。**判準:一個 `Date.now()` 該不該換 `state.ticks`,問「這段時間玩家離線時該不該繼續流逝?」**——① 該繼續流逝(攻城冷卻/盟主祝福這種「關遊戲也要倒數」的,`js/01:443` 有註解;魔物追蹤刻意做成離線全程有效,js/offline.js 另有 `until` 撐長處理)→ **留牆鐘**;② 該跟「玩家在遊戲裡實際經過多久」走(怪存活時間、技能節流)→ **改 `state.ticks`**。新增時間相關機制時照這條選時鐘。
- **debug**:`window.__afk.forceCatchup(分鐘數, noFast)`——第二參數 true 強制全模擬(A/B 比對用);**此入口會帶當前地圖**(2026-07-06 修:原本沒帶 → `gotoMap(undefined)` 空轉零收益,測試時誤判成功能壞掉)。

**特別坑:有些「狩獵地點」不是地圖選單裡的地圖**(攀登 `pride_fN`、遺忘之島 `oblivion_travel`/`oblivion_island`)——它們**不在 `DB.maps`/`MAP_CATEGORIES`**,而且原作**不存檔**這類「旅程/攀登狀態」(`state.prideClimb…`/`state.oblivion`),重載一律回村。對這種地圖做離線續掛,規則:

- **不能用 `gotoMap()`/`changeMap()`(選單路徑)**把人帶回去——選單沒有這個 option,`setMapSelectors`/`sel.value` 設不上 → `mapState.current` 變空字串 → 補跑在空地圖空轉 → **收益歸零**(2026-06-21 遺忘之島就是這樣壞的,修前還會跳「離線掛機 0 分鐘…無收益」的怪訊息)。
- **正解**:外掛**自存一份旅程狀態**(攀登 `afk_pride_<slot>`、遺忘之島 `afk_obl_<slot>`),登入時在「原 loadGame 之前」擷取;補跑時**還原 `state.xxx` 旗標 + 呼叫原作專屬進場函式**(攀登 `enterPrideFloor(n)`、遺忘之島 `enterOblivionMap(mapKey)`)進場,絕不走選單。
- **落點比照在線**:存活→補滿 HP/MP、留在原地續掛(state 旗標維持,saveGame 後由 `stamp()` 續記);撞死→清掉旅程旗標、`gotoMap(homeTown())` 回村(比照原作 `revive()` 的塔中/島中死亡回城)。
- **遺忘之島「本島」走快速結算(2026-07-10)**:進場仍走 `enterOblivionMap`(還原 `state.oblivion`),但 fastEligible 對 `phase==='island'` 放行——本島=無限刷怪圖,與一般圖同等待遇;島上禁傳送等規則因快速段重用原作函式(useItem/maybeSpawnMobs)自動成立。「途中」維持全模擬(傳送門 BOSS 進度門檻、怪組與本島不同)。
- **階段自動推進交給原作**:如遺忘之島「途中擊敗傳送門→進本島」是原作 `settleDeadMobs()` 內 `state._oblivionAdvance` 流程處理的,補跑時照呼叫 `settleDeadMobs()` 即可,不要自己重寫推進邏輯。
- 新增這類地圖時,記得 `mapName()` 也補上它的中文名(這些 id 不在 `MAP_CATEGORIES`,否則摘要會印出原始 id)。

### 例外:「時間排名挑戰」類的特殊 run → 離線一律「不續、不結算」(不是續掛)

非選單地圖不全都要續掛。**排名/計時挑戰**(原作 `state.riftRun` 的「時空裂痕」`rift_battle`、攀登的「排名挑戰」`prideRanked`)的設計是「停留越久排名/獎勵越高、撐到被打死」,**離線自動續＝刷排名/刷獎勵 exploit**;且原作這類 state 不存檔(transient `state` 物件)、重載一律回村(等同「中途離開＝該次作廢」)。所以離線模組對這類**明確早退、完全不模擬**(`js/offline.js` `maybeCatchup` 裡:排名攀登看 `prePride.ranked`、時空裂痕看 `savedMap === 'rift_battle'`)。判準:**這張圖的收益/排名是不是「靠線上停留時間累積」?是 → 離線不能幫他跑**(不然就是掛機刷榜)。一般狩獵圖(含底比斯、魔族/暗影神殿等選單地圖)才照「在線掛機照跑」續結算。

## 🐌 離線結算效能:實測結論(別再往「優化掃描」方向想)

> **⚡ 2026-07-06 起本節的「建議維持現狀」已被推翻**:停止同步原版後已可改原作者碼,離線結算改用「混合快速結算」(見上方「⚡ 混合快速結算」節),24h 從分鐘級降到秒級;另外快轉熱路徑也砍了純浪費(DPS 統計 ff 跳過、收集冊延後寫入、autobuy 降頻)。本節保留當背景:**全模擬路徑(危險/特殊地圖的 fallback)的耗時結構仍如下述**——主成本是逐拍戰鬥模擬本身,別再想從掃描/記憶體省。

有人問過「24h 離線結算很慢、能不能優化」。用真實存檔(Lv63 法師/zone_14)實測過,結論是**沒有可省的掃描**。動手「優化」前先看這節,別重蹈覆轍:

- **不是背包掃描**(本來最直覺的猜測,實測推翻):決定性反事實測試——在跑到很慢時把背包從 258 筆砍到 203 筆,每 tick 耗時幾乎沒變(311→302µs)。背包整段 24h 也只從 184 長到 258 筆(+40%),撐不起好幾倍的速度落差。所以「離線時清廢品來加速」**無效,不要做**。
- **不是記憶體/log 累積**:單場結算過程記憶體穩定在 13~20MB、沒漏;戰鬥日誌在 `state.ff`(快轉)時 `logCombat`/`logSys` 直接 return、不累積。
- **真正成本 = 戰鬥模擬本身,且 RNG 變異極大**:同一隻角色同圖,跑兩次差很多——沒升級那次每 tick ~0.11ms(24h 純運算約 96 秒)、升到 Lv68 打進更硬戰鬥那次飆到 1~2ms(24h 約 471 秒)。慢不是 bug,就是「真的在一場一場模擬戰鬥」,場面越大越吃運算。
- **參考數據**:`TICK_MS=100`,24h = 864,000 個 tick。離線模組 `js/offline.js` 的「ms」是時間切片預算(`SLICE_MIN_MS=28` 短離線、`SLICE_MAX_MS=250` 長離線≥1h),只影響「讓畫面喘」的額外開銷、不影響純運算那條底;250ms 以上邊際效益已很小。
- **2026-07-05 追加驗證(使用者又報慢、懷疑上游更新害的)**:對 v2.7.92–96/v3.0.x 大更新前後做 A/B 基準——本機起兩個 server(HEAD vs 更新前 commit 的 sparse worktree)、Playwright 同一套合成角色(Lv63/zone_14)各跑 3 輪×36k tick、每輪重新載頁,結果每 tick 5–7µs **無差異,上游更新沒有拖慢快轉**(新特效函式全走 `window.__vfxOff` 總開關;`logCombat` 也仍有 `state.ff` 早退)。倒是 CDP profile 抓到**我們外掛在快轉迴圈漏電**:`afk-fixes` 的「日誌捲動錨定」wrapper 在 `state.ff` 時仍對每則 logCombat/logSys 先 `getElementById`+讀 `scrollHeight`(強制排版,約佔合成快轉 10%)——已加 ff 快速通道直呼原函式;**該段已於 2026-07-09 搬回核心 `_trimLog`,wrapper 消失、`state.ff` 早退在 logCombat/logSys 第一行,此漏電結構性不再存在**。**方法備忘:懷疑效能回歸就 A/B+profile,別用猜的**;profile 其餘熱點(autoSellJunk 每 100 拍全背包掃、`_dpsSnap`/`_dpsDealt` DPS 統計每拍快照、afk-autobuy 的 tick wrapper)都是原設計或必要成本,佔比小、別動。
- **2026-07-05 補測「離線強制賣廢品」策略**:合成 2000 格大背包+放大廢品流入,五變體×2輪×36k拍——現行不強制賣 14.2~15.6µs/拍;強制每100拍賣 12.1~12.4(比現行快~15%,因背包變小掃描變便宜);每1000/6000拍賣與每100拍無差;自動賣出整個關 7.2~8.4µs=快近一倍。但這些差距只在「弱角色+肥背包」情境顯著——**真實重戰鬥角色每拍 0.3~2ms,自動賣出相關全部 <1~2%、體感不出來**;當初移除強制賣出屬中性決定,不必加回。真正有感的手段仍是玩家自己清背包/收倉庫。

## Git / GitHub

- commit / push 時**不要**帶上 Claude 作者資訊或 `Co-Authored-By` 標記(沿用全域規則)。
- GitHub Pages 站台:`https://pp771007.github.io/idle-lineage-class/`(本 fork,非原作者 shines871)。
- **🔀 commit / push 節奏(使用者明訂・2026-07-07)**:一個功能做完(含自測)就 commit 一個,**不要主動 push、也不要在 commit 階段 bump `?v=` 或跑 stamp-sw-version**——版本號 bump 與 stamp 屬於「push / 發版」流程,等使用者說要 push 或發版時才跑 `/prepush` 一次處理(那時把這段期間所有改過的檔一次 bump)。「每次 push 前的檢查清單」照舊,只是觸發點是 push、不是 commit。

### 🔴 `git pull --rebase` 出現衝突時:不可盲目 `git add -A && rebase --continue`(會把衝突標記 commit 進去)

自動同步停了之後衝突變少,但多 session/多裝置同時動 repo 仍可能撞。教訓照舊:
- **只有 `sw.js` / `version.json`(產生檔)衝突**:**先手動刪衝突標記留單一版本**,再重跑 `node scripts/stamp-sw-version.mjs` → `git add -A` → `git rebase --continue`。**⚠ stamp 只會 regex 換掉 `CODE_VERSION` 值、不會清 `<<<<<<< / ======= / >>>>>>>` 標記**——標記留在 `sw.js` 裡=語法錯誤 → Service Worker 裝不起來 → **PWA 離線快取整組失效,但頁面照常渲染、smoke 照過、肉眼看不出來**(踩過 2026-07-05:一段衝突標記在 sw.js 裡躺了好幾個 commit 才被抓到)。
- **`index.html` 也衝突**:**stamp 不會碰 index.html**,盲目 `git add -A` 會把標記原封不動 commit 進去 → 推上去**整頁壞掉**(踩過 2026-06-28)。**正解:先 `git diff --name-only --diff-filter=U` 看有哪些衝突檔;index.html 要手動開來解**,再 stamp、`git add -A`、`rebase --continue`。
- **收尾自我檢查(push 前)**:`grep -rnE "^<<<<<<< |^>>>>>>> |^=======$" index.html sw.js afk-*.js` 必須是空的(**sw.js 一定要一起 grep**);`grep -c afk-<某外掛>.js index.html` 每支應為 1(沒有重複 script)。**不能只靠 smoke,一定要 grep 衝突標記**(瀏覽器把標記當文字、script 照載;sw.js 壞了頁面也照跑)。(注意 `=======$` 要錨定行尾,否則會誤中 sw.js 註解裡的 `======` 裝飾線。)

### push 後要等 GitHub Pages 重建完成才算交付,並主動通知使用者

每次 push 到此 repo 後,**不要 push 完就回報「上線了」**——GitHub Pages 要重建(通常 push 後約 40 秒~1 分鐘)才會真的生效。流程:

1. **🚨 輪詢一律丟「背景任務」跑(`run_in_background`),不要在主回合同步 `sleep` 等**——同步等會讓那 1~2 分鐘完全不能回使用者訊息(使用者明確抱怨過)。push 完就把下面這支輪詢丟背景、自己繼續待命/接話,背景跑完會通知,再回報「上線了」。
2. **判準以「curl 抓線上實際版本號」為權威,不要只信 `gh api pages/builds/latest`**——build API 在連續多次 push 時會回報延遲的 commit(踩過:API 還停在前一個 commit,但 curl 線上版本其實已是最新)。背景輪詢直接比對線上外掛 `?v=`(或 `version.json` 的 `build`):
   ```bash
   # 背景輪詢:直到線上 index.html 的外掛版本 = 剛 bump 的版本(或直接 grep 你改的那支)
   for i in $(seq 1 14); do
     v=$(curl -s --ssl-no-revoke "https://pp771007.github.io/idle-lineage-class/index.html?cb=$(date +%s)" | grep -oE 'afk-wiki\.js\?v=[0-9a-z]+')
     echo "[$i] $v"; [ "$v" = "afk-wiki.js?v=<剛 bump 的版本>" ] && { echo BUILT; break; }; sleep 15
   done
   ```
   (`gh api repos/pp771007/idle-lineage-class/pages/builds/latest --jq '{status,commit}'` 可當輔助參考,但不要當唯一判準。)
3. 背景輪詢回報「BUILT」後**才**通知使用者「已上線、可重整看到新版」(訊息從 Telegram 來就用 `reply`)。
