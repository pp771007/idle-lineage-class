# 放置天堂（加掛版）— 專案規則

## 專案性質與架構（2026-07-19 起・純上游鏡像＋外掛層）

- 網頁放置遊戲。遊戲本體由原作者(巴哈姆特 秋玥)製作,原版:**https://shines871.github.io/idle-lineage-class/**;本站(加掛版):https://pp771007.github.io/idle-lineage-class/。
- **架構=「上游原版鏡像＋外掛層」**:核心(`js/NN-*.js`、`css/*`、`index.html`、`assets/`、`public/`)永遠是上游原文/原檔的位元組級鏡像;我們的所有功能都在**外掛層**——根目錄 `afk-*.js`(41 支)＋`sw.js`(PWA,上游沒有)＋極少量**錨點式核心補丁**(`scripts/apply-core-patches.mjs`)。
- 歷史一句話:2026-07-06 曾與上游分家獨立維護(直接改核心);2026-07-19 起改回本架構(`rearch-plugins`),核心修改全數退回外掛/補丁,以便隨時整包跟進上游。舊的 3-way 逐功能移植 SOP 已作廢。
- 上游本機 clone:`D:/otherPersonRepos/idle-lineage-class`。**引用上游做任何判斷前先 `git -C <clone> fetch`**——舊 clone 會讓「上游也是這樣」的結論整個相反(踩過)。
- 同步狀態記在 `upstream-checkpoint.json`(`syncedUpstreamCommit`=目前鏡像的上游 commit)。

## ⭐ 修改原則(鐵則)

**🚨 絕不直接手改核心檔(`js/NN-*.js`/`css/*`/`index.html`)——下次同步上游會整包覆蓋,改了就丟。** 要動遊戲行為,依序考慮:

1. **外掛 monkey-patch(首選)**:核心函式都是全域,外掛包裝(`var _orig = fn; fn = function(){...}`)能解決絕大多數需求。afk-offline 連整套離線結算都是這樣掛的。
2. **錨點式核心補丁(最後手段)**:只有「外掛包不住」的才用——要抽函式、改函式簽名、改寫死的字面值。加進 `scripts/apply-core-patches.mjs`:靠「上游原文特徵字串」定位、冪等、**錨點找不到就 exit 1 大聲失敗**(不會默默壞)。補丁越少越好,現有 7 個:
   | # | 檔 | 內容 |
   |---|---|---|
   | 1 | js/03 | `maybeSpawnMobs` 抽出(tick 出怪塊→具名函式,離線快速結算共用同一份排程) |
   | 2 | js/08 | `gainItem` 自帶強化值鉤子 `__afkTradRollEn`(afk-traditional 偽傳統) |
   | 3 | js/13+js/06+js/25+js/28 | 存檔位 8→16(`SAVE_SLOT_MAX`;匯入重複掃描/傭兵招募/血盟成員掃描/PVP 對手清單) |
   | 4 | js/22 | 寵/召 sprite ticker 改間接呼叫(讓 afk-powersave 包得住) |
   | 5 | js/07 | 迴避頭目 × 自動找BOSS 互斥(`AFK_BOSSRING.huntActive`) |
   | 6 | js/08 | `useItem` 加 `keepModal` 參數(自動瞬移不關玩家視窗) |
   | 7 | js/10 | 「立即賣出」總開關關閉時不強制套規則(免誤賣沒標記的裝備) |
3. **index.html 不手改**:它=上游 index＋`scripts/afk-plugin-block.html` 注入到 `</body>` 前(sync 時自動重組)。**新增外掛 → 改 `afk-plugin-block.html`**(載入順序也在那裡管:afk-toggles 最先、afk-skin 最後),再把它的 `<script>` 行同步補進現行 index.html(或重跑 sync),有 DOM 掛點的加進 `scripts/smoke-hooks.mjs` 的 `need`。
4. **CSS 覆寫**寫在外掛注入的 `<style>` 裡(如 afk-mobile),不改 `css/*.css`。

**外掛開關(afk-toggles.js,載入順序第一)**:每支外掛可被玩家單獨關掉——某支壞掉時玩家關掉它就能用原版繼續玩(逃生門)。契約:
- 純新增型外掛檔頭 `if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('<id>')) return;`;包核心函式型在 wrapper 內每次先問 `enabled()`,關掉就透明放行原函式。
- 載入時 `AFK_TOGGLES.register({id,name,desc,group,def})` 進開關面板。讀不到 AFK_TOGGLES 一律當開啟。afk-toggles 自己不可被關、不依賴任何外掛。

**🚨 不可停用的基礎設施,不能依賴「可被關掉的外掛」提供的東西**:afk-toggles 是逃生門(設計上不可停用),但它的左上角按鈕位置讀 `--orig-bar-h`,而那變數**全專案只有 afk-mobile 在設**;afk-skin 判斷手機也只看 afk-mobile 掛的 `body.m-mobile`。玩家一關「手機版面」→ 逃生門縮到橫幅底下點不到(遊戲橫幅 z-index 是 int 上限 2147483647,壓得過任何外掛)、入口全被收進手機上失準的 fixed Modal ——**壞掉後連「把外掛開回來」的入口都沒了,是死結**(2026-07-20 玩家回報)。判準:**寫 `var(--某變數)` 或讀 `body.某class` 前,先問「這誰設的?那支能不能被關?」** 能被關就要自己有保底(自己量一次/用同一組規則自己判)。⚠️ 這類「A 外掛量測、B 外掛使用」的跨外掛耦合在全開狀態下永遠測得過 → smoke 已加**第三輪**(手機+關掉 afk-mobile)驗逃生門可點與入口可見,新增這類耦合時順手擴充該輪。

**新增「釘在畫面上」(fixed/sticky)的手機元素 → 自己量橫幅,並用「帶文字」的假橫幅驗遮蔽**:橫幅 z-index 是 int 上限、壓得過任何外掛,而各外掛認橫幅是**比對文字**(`/shines871|官方|非官方|轉載/`,見 findBanner)——**沒文字的假橫幅在偵測邏輯眼中不存在**,只測得到「z-index 硬蓋」,驗不到「量測→讓位」那條路徑(smoke 第三輪的假橫幅原本就漏了文字,已補)。判準:元素釘死在頂端 → ①自己量橫幅算讓位(別讀 `--orig-bar-h`,那是可停用的 afk-mobile 設的)②測試裡的假橫幅要有文字。

**外掛通用守則**(沿用、仍然有效):
- 優雅降級:需要的全域函式/元素不存在就 `console.warn` 後安靜停用,不可弄壞遊戲。
- **🚨 絕不可盲呼叫「會寫入玩家存檔」的原作函式**(踩過:主選單狀態呼叫 `saveGame()` 把玩家第 1 格蓋成 Lv.1 null、無備份可救)。要存檔資料**直接讀 `localStorage`**(`lineage_idle_save_<n>`);非寫不可時先驗 `player && player.cls`。任何會動玩家 localStorage 的操作,都要假設可能在「未載入角色/currentSlot 不是預期那格」被觸發。
- 外掛插 DOM 錨「穩定容器 id」,不要錨父子關係——錨不到只會安靜消失,smoke 驗不到,改過首頁版面要人工掃。
- 覆寫「會被 `.hidden` 切換」的容器 display 時一律加 `:not(.hidden)`,否則畫面關不掉(踩過)。
- 外掛自建遊戲物件(如木人場 spawn 怪)欄位要對齊核心 `spawnMob`,缺欄位(如 `_born`)會整個系統安靜失效。
- 上游改版後外掛的「字串/DOM 結構假設」可能失效——同步後 smoke＋人工掃一輪首頁/手機版面。

## 🔄 同步上游 SOP → 跑 `/sync-upstream` skill

使用者說「同步原版/更新上游」就跑 `.claude/skills/sync-upstream/`。摘要:
1. `git -C <clone> fetch` + checkout 目標 commit(通常 origin/main)。
2. **assets 鏡像**:比對要用 **blob sha**(`git ls-files -s`),不能只比檔名——「兩邊都有但內容不同」佔過大宗(踩過:一次 10,149 檔)。補檔用 tar 走檔案清單(中文檔名不經 exe 參數);**上游沒有的檔要刪**(assets 已於 2026-07-19 達成純鏡像,刪前仍 grep `afk-*.js`+`scripts/` 確認外掛層沒引用)。
3. `node scripts/sync-upstream.mjs <clone>`:覆蓋核心 js/css → 重組 index.html(上游+外掛區塊) → apply-core-patches → 重產 manifest → stamp 版本 → smoke。**錨點失效會 exit 1**→讀上游該處 diff、更新補丁錨點再跑。
4. 更新 `upstream-checkpoint.json` → commit(不主動 push)。
5. 後續提醒:小百科/掉落查詢內容要另跑 `/update-wiki` 對齊(看上游 BASE..TARGET 的遊戲資料 diff);上游 commit message 全是「1」不可依賴,一律讀 diff。

CI 版:GitHub Actions `sync-upstream.yml`(**只有 `workflow_dispatch`,無 GitHub schedule**;**目前完全沒有定時觸發,同步時機由人決定**——`cf-sync-trigger/` 的 Cloudflare Worker 還在,但 cron 已於 2026-07-21 清空(`crons = []`,API 查 schedules 為空)。要恢復每天自動:把 `wrangler.toml` 的 `crons` 填回 `["20 10 * * *"]`(=台灣 18:20)再 `npx wrangler triggers deploy`;不用 GitHub 自家 schedule 是因為它常延遲 1~2 小時)做同一件事:ls-remote 比 checkpoint 早退 → 鏡像資產(`rsync --delete`)→ sync 腳本(AFK_SKIP_SMOKE=1)→ smoke → **全綠直推 main(Pages 自動部署)+ 發 Release(tag `vYYYYMMDD-HHMM`,標題帶原作者版本號)**;錨點失效/smoke 紅 → 各開 issue、不推壞版。commit 用路徑白名單 add(CI 臨時裝的 playwright/package.json 不進版控)。**因此 `assets/`、`public/` 下不可放我方獨有檔案**(會被 `--delete` 刪)——外掛需要圖優先引用上游既有檔(例:afk-training 背景用 `assets/area/1920x1080/新兵修練場.jpg`);真的要自有素材就放 assets 之外,或改 workflow 加 exclude。

## 目前的外掛(41 支;載入順序見 `scripts/afk-plugin-block.html`)

| 檔案 | 功能 |
|---|---|
| `afk-toggles.js` | 外掛開關中樞(最先載;逃生門,自己不可關) |
| `afk-lzcache.js` | 存檔解壓快取(同一份壓縮字串只解一次;核心每殺一隻怪都重讀整包血盟狀態,離線結算 4×) |
| `afk-ui.js` | 共用彈窗:接管 alert、`AFK_UI.confirm`、openLayer/closeLayer(返回鍵/ESC 關最上層) |
| `afk-extradata.js` | dex/wiki 共用手動補充資料(`AFK_EXTRA`:itemAcquire/武器特性白話/mapName) |
| `afk-offline.js` | **⏸ 暫停使用中**(2026-07-21;開關被鎖成不可勾)——離線掛機整套,改由上游 js/27 接手,見下方離線章節 |
| `afk-mobile.js` | 手機版面薄殼(底部導覽列切三欄、橫幅讓位、浮動日誌;版面用上游原版) |
| `afk-backnav.js` | 手機返回鍵/手勢在子畫面回上層而不是關 PWA |
| `afk-battlehud.js` | 手機戰鬥狀態列(取代上游只有 HP/MP 的 #mobile-vitals;自己量橫幅) |
| `afk-mapbar.js` | 手機冒險地圖標題列壓成兩排(純 CSS,自己判手機) |
| `afk-nozoom.js` | 手機取消雙擊放大(body touch-action:manipulation;捏合縮放保留) |
| `afk-slotinfo.js` | 選角卡片疊「掛哪張圖/掛多久」(讀 afk-offline 的 afk_map_/afk_ts_,唯讀) |
| `afk-loadslots.js` | 卡片式選角擴到 16 格(搭配補丁3) |
| `afk-dex.js` | 掉落查詢(五張掉落表+特殊掉落 SPECIAL_BLOCKS;`?view=dex` 獨立頁) |
| `afk-wiki.js` | 小百科(多分頁+統一搜尋;`?view=wiki` 獨立頁;改前讀下方維護準則) |
| `afk-storage.js` | 首頁「⚙ 設定」選單(MENU_ITEMS 可擴充)+檢查存檔大小 |
| `afk-history.js` | 離線掛機紀錄卡片(讀 afk_hist_<slot>,唯讀) |
| `afk-diag.js` | 快取診斷(全程唯讀;欄位各自包錯;產物自帶版本號) |
| `afk-reissueid.js` | 換發身分證(角色身分碼重發) |
| `afk-powersave.js` | 省電模式(關戰鬥動畫/降更新頻率;涵蓋寵/召 ticker=補丁4) |
| `afk-statpts.js` | 能力值來源分解(能力圖下方單一區塊) |
| `afk-autobuy.js` | 自動買肉/魔法屏障卷軸補貨(預設開;離線結算共用 `__afkAutobuyCheck`) |
| `afk-training.js` | 木人場(量真實 DPS;獨立 map id `afk_dummy`) |
| `afk-bossring.js` | 傳送控制戒指自動找BOSS(缺卷軸自動購買;與迴避頭目互斥=補丁5) |
| `afk-itemsearch.js` | 背包名稱搜尋(包 renderTabs 重注入;純顯示層過濾) |
| `afk-invlist.js` | 背包條列式(桌機手機通用) |
| `afk-eqlist.js` | 裝備分頁條列式(隱藏 12 格圖形窗,露出原生部位條列) |
| `afk-npclist.js` | 村莊 NPC 條列式(鏡射地圖 NPC 成列表) |
| `afk-mobname.js` | 怪物名稱顯示模式三選一(純 CSS+body data 驅動) |
| `afk-toast.js` | 手機 toast(包 logSys,點擊同步窗內訊息浮現) |
| `afk-touchtip.js` | 手機長按看資料(技能/商店/製作/收集冊/背包) |
| `afk-trackinfo.js` | 狀態欄顯示魔物追蹤剩餘時間(包 renderStatusEffects,補一格) |
| `afk-battlebuffs.js` | 手機戰鬥框下方鏡射整條狀態欄(必須排在 afk-trackinfo 之後才含追蹤格) |
| `afk-relicguard.js` | 快速廢品的「全選」跳過遺物(包 quickJunkSelectAll/buildQuickHeader) |
| `afk-traditional.js` | 傳統模式(偽)/自動衝裝(掉落自帶強化值;靠補丁2 的 `__afkTradRollEn` 鉤子) |
| `afk-warehouse.js` | 倉庫增強(金幣全存/全取、遺物與席琳遺骸分類) |
| `afk-dograce.js` | 賽狗場迷你遊戲(奇岩城鎮限定;自製) |
| `afk-pwa.js` | PWA 安裝 UI+圖桶/程式桶對帳(reconcile 送 SW) |
| `afk-sw.js` | Service Worker 註冊(sw.js 是我方檔,上游無 PWA) |
| `afk-syncinfo.js` | 首頁顯示原作者連結+原版同步時間(讀 version.json 的 buildAt) |
| `afk-analytics.js` | Cloudflare Web Analytics(只在正式站注入) |
| `afk-skin.js` | 首頁外掛入口收納(桌機🔌鈕/手機依原版按鈕樣式;固定最後載,MutationObserver 等入口到齊) |

> **獨立頁與跨頁連結(dex↔wiki)**:`?view=dex`/`?view=wiki` 鋪滿整頁+頁首導覽;跨頁一律走對方暴露的 mode-aware `goto`(`AFK_DEX_API.goto({q})`/`AFK_WIKI_API.goto({tab,cls,q})`,自動判斷模態連模態/網址連網址);「名字→跳掉落查詢」inline 連結用 `<span class="m-dexlink" data-dexq="名字">`(全域委派);開對方前先 `close()` 來源模態。新增跨頁連結要重用/擴充 `goto`,不要在呼叫端自己判斷。

## 🗺️ 離線掛機——⏸ 目前整套停用,走上游 js/27

**2026-07-21 起 afk-offline 暫停使用**:上游從 v3.6.97 開始自帶離線收益、v3.7.17 又把背景分頁也收進同一套,**作者仍在持續改動**,我方跟著包一層的成本與風險都太高(這次同步就踩到「補丁讓位掉取樣鉤子、結算路徑卻沒讓位 → 背景 3 小時收益 0 還把 buff 扣光」)。故整套讓位:

- `afk-toggles` 的 `offline` 項目帶 `locked` 字串 → `enabled('offline')` 一律回 false(**不管玩家 localStorage 存過什麼**),面板上該列 disabled、不可勾、顯示停用原因。老玩家存過 `'1'` 也一樣關閉。
- **補丁 8 已整個移除**,`js/27-offline-rewards.js` 回到純上游鏡像(blob 對得上上游),上游的離線/背景結算全程生效。
- 連帶處理:`afk-slotinfo` 的「📍 掛機地圖」與「⏱ 已掛機多久」都不顯示(資料源 `afk_map_`/`afk_ts_` 沒人蓋,老玩家會凍在最後一次遊玩;地圖中文名還要走已不存在的 `window.__afk.mapName`,會直接露英文 id),只剩席琳世界狀態,開關名稱改為「選角附加資訊」;smoke 的 `need` 拿掉 `[AFK]`。
- `afk-history`(離線掛機紀錄)同樣鎖成不可勾:不會再有新紀錄,留著只會讓玩家以為功能還在(舊的 `afk_hist_<slot>` 沒有刪,恢復後直接看得到)。
- **恢復時要一起還原**:上面每一項 + 把 `locked` 拿掉。afk-offline.js 本體與它包 `settleBackgroundMs` 的邏輯都原封留著,沒有刪。

以下是 afk-offline 的原始設計原則,**恢復啟用前必讀**(檔案還在,邏輯沒動):


核心原則:**離線掛機=把「在線上會發生的掛機」照跑一遍**(同圖續掛、撞死即停結算到死前、存活回原地)。「離線」定義=**關閉遊戲**;分頁切背景不算(遊戲照跑、心跳照蓋錨點,是預期行為,不要「順手修」)。

實作要點(改離線行為前先讀 afk-offline.js 檔頭註解):
- 掛點:外掛自己 monkey-patch `loadGame`(開頭擷取錨點/結尾結算)、`saveGame`/`changeMap`(結尾 stamp)、`killMob`/`gainItem`(結算期間計數);出怪走核心補丁抽出的 `maybeSpawnMobs()`(與線上同一份排程)。
- 💾 分段檢查點:結算每 ~5 秒 saveGame+錨點推進到「已結算時點」;**任何新程式碼想在結算(`catchingUp`)期間蓋 afk_ts 都是 bug**。
- ⚡ 快速結算:取樣→事件驅動逐殺(批次擊殺保 AOE、BOSS 懶驗證+抽驗、維持自動續 buff);危險/特殊圖退回全模擬。**快速段不跑 tick()/autoActions**——「只寫在 autoActions 的自動行為」要各自補,補法=**直接呼叫原作那支函式**(如瞬移 `useItem(uid,true)`),不要自己刻守衛清單(必漏、必分歧)。
- 排名/計時挑戰類(時空裂痕、排名攀登)**離線一律不續、不結算**(續=刷榜 exploit);攀登/遺忘之島這類非選單圖用外掛自存旅程狀態+原作進場函式還原,不可走 gotoMap 選單路徑。
- **判準:遊戲邏輯的時間判斷用 `state.ticks`,不用 `Date.now()`**(補跑壓縮時間,牆鐘幾乎凍結)。例外=「關遊戲也該倒數」的(攻城冷卻)留牆鐘。
- **ff 洩漏判準**:補跑(`state.ff`)期間,戰鬥路徑**直接**呼叫的 `render*`/重副作用(`saveGame`)要被 `!state.ff` 擋住或函式內早退;**自己跑的 timer(setInterval/rAF)也要問「補跑期間它還在跑嗎」**。守衛用 `state.ff && !state.ffSmall`(小補跑要放行)。上游是原文改不得→這類守衛由 afk-offline 以 wrapper 實作(如 sprite ticker、音效靜音)。
- debug:`window.__afk.forceCatchup(分鐘, noFast)`。全模擬慢是戰鬥模擬本身,不是掃描/記憶體,別往那優化。
- **🚨 背景分頁回前景由 afk-offline 包 `settleBackgroundMs` 接管,交回核心 `queueCatchupMs` 逐 tick 補跑**:上游 v3.7.17 把 visibilitychange/bfcache 從 `queueCatchupMs` 改成 `settleBackgroundMs` → `offlineSettleCatchup`(統計一次結算)。那套要靠上游自己的實戰取樣,而取樣鉤子正是補丁 8 讓位掉的 → 我方沒有 profile,它走「沒有合格樣本」分支:只推進 `state.ticks`、扣光 buff/冷卻/藥水時間、清掉 `_tickDebt`,**零收益返回**(實測背景 3 小時=0 金幣,同期核心補跑 2,326 萬)。判準:**上游只要再動 js/01 的 visibilitychange/pageshow 或 js/27 的 catchup 入口,就要重驗這條**——「離線=關遊戲、背景=遊戲照跑補回來」是本外掛的前提,不是可調偏好。核心補跑本來就有時間預算讓步(`FF_BUDGET_MS`)＋抽樣快轉(債>10 分鐘 1 抵 10),不會凍住分頁。
- **上游 v3.6.97 起自帶離線收益(js/27),已由補丁 8 讓位**:它包的是 loadGame/saveGame/killMob/changeMap ——跟 afk-offline 同一批。上游之後若再擴這套,先確認補丁 8 的錨點還在、且沒繞過 guard 另開入口。
- **🚨 測「離線回來」時,時間戳要三處一起回撥**:afk-offline 的 `afk_ts_<slot>`、上游的 `lineage_idle_offline_v1_*`、**以及存檔裡的 `player.offlineHunt.awaySince`**(存檔 payload 是 `{v,p:player,...}`,在 `d.p.offlineHunt`)。漏掉存檔內那份 → 上游一律判定「離線 0 分鐘」不結算,看起來像「兩套和平共存」,**實際上線會雙重發獎**(踩過:據此下過「沒有重複發獎」的錯誤結論)。

## 📦 Service Worker / PWA(sw.js 我方檔)

- **雙桶分離**:程式桶 `code-v1`(固定桶名;js/css/index/manifest/圖示;導覽 network-first、資源 cache-first 帶 `?v=`)+圖桶 `img-v3`(固定桶名;assets 全部,純 on-demand)。失效走**對帳**不整桶倒:程式桶 reconcileCode(DOM 現行引用清單)、圖桶逐張(assets-manifest 的 blob sha)、動畫逐怪(anim-manifest)。
- **🚨 SW 不可對圖桶 `cache.keys()`**——筆數多會拋 `Operation too large` 整支對帳靜默掛掉;列舉不到時什麼都別做;清之前先確認記錄寫得進去。程式桶(數十筆)可以。
- **`cache.put` 條件一律 `res.status === 200`(不是 `res.ok`,206 會 reject)且永遠掛 catch**;音檔(bgm/sfx)fetch 不攔截。
- **install 刻意不 `skipWaiting`**(常駐請求會讓交接死鎖、首頁卡半分鐘);activate 只留 claim。搬家/清理不可寫在 activate。
- **改任何程式檔後 push 前 `node scripts/stamp-sw-version.mjs`**(讓 sw.js 位元組變→PWA 偵測更新;`CODE_VERSION` 只當觸發器不當桶名)。**動 assets 後 `node scripts/gen-manifests.mjs`**(+動畫另有 `node tools/gen-anim-manifest.js`,sync 腳本都會跑)。判準:凡「URL 含 `/assets/`、會被圖桶快取」的圖必須在某份對帳清單裡,否則換圖卡舊。
- afk-diag 取證:欄位各自包錯(一個 API 炸不可帶走整份)、唯讀硬性要求、產物自帶版本號;`CODE_VERSION` 不含 sw.js 自己——改 sw.js 版本號不變,判 SW 新舊靠新欄位/`reg.waiting`。

## 📚 小百科/掉落查詢維護(更新內容跑 `/update-wiki`)

資料變動來源=同步上游。同步後跑 `/update-wiki`:以上游 BASE..TARGET 逐檔 diff、照「檔→頁」對照表歸位、render 實測、推進 `wiki-checkpoint.json`。鐵則(使用者明訂、別再犯):
- **逐檔讀完整 diff,機制改動(`-`/`+` 成對)也要讀**,不可只掃新增定義;不可假設「前面做過了」就跳過。
- **表格優先、有數據用數據**;程式查得到的數字優先「動態讀 DB/呼叫遊戲函式」產表;散文只留機制說明。表格已表達的不要在下面散文重述。
- **數據以「真正算它的那段 code」為準**,絕不抄遊戲說明文字/註解(常過時);白話零術語(不要 1D4/骰 19);AC 照遊戲顯示負值;寫「現況」不寫改版語氣;不要模糊詞(短時間/有機率)。
- **渲染內容絕不露英文**——狀態/數值名補對應表(`STATUS_LABEL`/`STAT_LABEL`/`AFK_EXTRA.mapName`);地圖漏翻有 smoke 自動擋。
- **掉率要把四個倍率一次講完**(席琳×3/瘋狂×5/恩賜×10/經典×1/10;判準=該 roll 有沒有乘 `_dropMult` 系);「不吃倍率」的兩處都補:小百科該頁+dex `SPECIAL_BLOCKS` 的 dropmult 清單。
- **條件式掉落(`if(...) gainItem`)都要在掉落查詢查得到**(掃 js/05/06 補 `SPECIAL_BLOCKS`);掉落表以 `_auditMobDrops` push 的那組為權威;客製製作結構(`DEMONKING_RECIPES`/`LUMIEL_RECIPES`…)dex+wiki 兩邊都補,**實測查得到才算數**;純兌換/無怪掉的補 `AFK_EXTRA.itemAcquire[id].short`;潘朵拉抽獎不列為取得方式(唯一來源也寫「目前沒有固定取得途徑」)。
- 裝備顯示一律重用 `buildItemDescHTML`,不自己刻數值格式。
- 介面:搜尋=統一結果(跨分頁跨職業,黃色高亮);分頁列單排橫捲;手機不加會撐高的標示元素。

## 🚨 push 前檢查清單(→ `/prepush` skill;hook 兜底)

1. `node scripts/stamp-code-versions.mjs`——**js/css/afk-*.js 的 `?v=` 全部自動對齊內容 sha1**,不要手動 bump、不要只 bump「有印象改到」的。漏 bump 的後果是**新舊混搭**(玩家快取時序決定,低機率無法重現,踩過整晚收益歸零)。
2. `node scripts/stamp-sw-version.mjs`(PWA 更新偵測)。動過 assets → `gen-manifests.mjs`。
3. `node scripts/smoke-hooks.mjs` exit 0(外掛掛點;手機限定外掛在第二輪 iPhone context 驗)。
4. `grep -nE "^<<<<<<< |^>>>>>>> |^=======$" index.html sw.js afk-*.js` 必須為空(sw.js 一定要一起 grep——標記躺在裡面頁面照常渲染、smoke 照過);每支外掛在 index.html 只出現一次。
5. `apply-core-patches.mjs --check` exit 0(核心補丁都在)。
6. commit 階段**不** bump/stamp——那是 push/發版流程的事(使用者明訂:功能做完就 commit,等說要 push 才跑 /prepush 一次處理)。

**push 後要等 GitHub Pages 重建**(~40s-1min)才算上線:輪詢丟背景跑(`run_in_background`,不要同步 sleep 佔住回合),判準=curl 線上 `version.json`/`?v=`(不要只信 pages/builds API,連續 push 時它會落後);BUILT 才通知使用者。

## 暫存 / 測試

- **`.testdata/` 有使用者真實存檔(gitignore,不進版控、不要清)**——玩家回報跟「資料量/等級/裝備/倉庫/離線」有關就先用它測,新角色重現不出來會誤判「沒問題」。灌法:`_lzSet('lineage_idle_save_1', ...)` 後 `loadGame()`(倉庫另拆)。
- 一次性腳本/截圖放 `.scratch/`(gitignore)。Playwright 一律 headless。
- **會寫玩家存檔的功能,上線前必測「真實角色→操作→比對相關 key 沒被改壞」**,且要涵蓋真實觸發狀態(如主選單=未載入角色)。
- 量效能每輪**重新導航**,不要原地重複 `loadGame()`(計時器/監聽疊加,記憶體 17→97MB、tick 慢 9 倍,數字全污染)。
- Tailwind 是預建置 css:JS 動態拼「沒出現過的 class」會安靜失效——先 grep `css/tailwind-built.css` 有沒有,沒有就寫自己的具名 class。

## Git / GitHub

- commit 不帶 Claude 署名(全域規則);訊息純變更描述。
- **commit 節奏**:一個功能一個 commit;不主動 push;bump/stamp 留給 push 時的 /prepush。
- `git pull --rebase` 衝突:產生檔(`sw.js`/`version.json`/manifest)衝突→手動刪標記留一版→重跑 stamp 腳本→continue;**stamp 不會清衝突標記也不會碰 index.html**,盲目 `git add -A` 會把標記 commit 進去(踩過兩次,sw.js 壞了肉眼看不出)。收尾一定 grep 衝突標記(見檢查清單 4)。
- 台灣時間戳:git-bash 的 `TZ=` 不生效,用 `date -u -d '+8 hours' +%Y%m%d-%H%M`。
- 版本/發版:`version.json` 的 `app` 是加掛版 semver(發版才 bump;stamp 會保留該欄位);發版跑 `/release` skill,更新說明只寫玩家有感的、白話。

## 🔁 修完 bug 要不要記進本檔:三題都「是」才寫,寫前先給使用者看草稿

1. 還會再發生嗎(成因仍在、可推廣)?2. 自動檢查擋不掉嗎(smoke/hook/stamp 已擋的去補檢查不補文件)?3. 下次真的想不起來嗎?
寫法:標題一句話結論,內文只寫「為什麼會中+判準/怎麼避」,不寫案發經過;能併進現有條目就別開新段。
