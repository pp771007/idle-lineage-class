# 放置天堂 — 專案規則

## 專案性質

- 本體是單一檔案的網頁放置遊戲 `index.html`(約 774KB,**由原作者持續更新**)+ `assets/`。
- 我們**不擁有也不修改** `index.html` 的原始遊戲程式碼。所有自訂功能一律以「**外掛 JS**」方式實作。
- 原作者(巴哈姆特 秋玥)的官方版本網址:**https://shines871.github.io/idle-lineage-class/**(原版遊戲就掛在這,index.html 的最新原始碼以此為準)。

## 「合併原版」= 從原作者站台抓最新 `index.html` 更新本專案

> **已自動化**:`.github/workflows/sync-upstream.yml`(每小時 + 可手動)自動跑這套流程
> ——腳本 `scripts/sync-upstream.mjs` 抓原版、補回外掛 `<script>`(保留各自 `?v=`)、補新圖、**重抓被作者換掉內容的既有圖**(比對 git blob SHA),
> 再用 `scripts/smoke-hooks.mjs`(Playwright)驗五支外掛 `hooks OK`,**通過才自動 commit/push**;
> 推送成功後再**打 tag(台灣時間 `v YYYYMMDD-HHMM`)+ 開 GitHub Release**(Release 自動附原始碼 zip/tar.gz 供下載)。
> 掛點被原作者改壞時不會推壞版本,改開一個 issue 通知人工處理。

### 使用者說「合併原版 / 同步原版 / 更新原版」時 → 先用 GitHub Action,不要急著手動

**第一步永遠是直接觸發那支 workflow**,因為它做的就是完整合併流程、且在 Linux 上更穩(中文檔名直接用 URL,不必走 blob SHA):
```bash
gh workflow run sync-upstream.yml --ref main
# 等幾秒拿到 run id,再盯著跑完
gh run list --workflow=sync-upstream.yml --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch <run_id>   # 或輪詢 gh run view <run_id> --json status,conclusion
```
跑完後看結果回報使用者:
- **changed=false**:原作者沒更新,什麼都不用做。
- **跑成功且有推 commit**:同步完成,GitHub Pages 會自動重建;`git pull --ff-only` 把本機同步回來。
- **開了 issue(外掛掛點失效)**:原作者改了 DOM 害外掛掛不上 → 這時**才**走下面的手動流程,重點是去修「失效的外掛掛點」(改 id / DOM 選擇器),不只是重貼。

> 同步成功後順手檢查一項:`afk-fixes.js` 的「renderTabs select-guard」是補原作者「戰鬥中重刷分頁 DOM 害強化下拉被關」的坑。
> 若原作者已改成 diff 更新(不整塊重建分頁、不刪 `<select>`),這段就成多餘,可整段刪掉(留著無害,只是死碼)。

> 只有在 workflow 不能用(沒有 `gh` 權限、Actions 被停、或要 debug 合併本身)時,才整套手動跑。手動流程如下,
> 原則:原版整份覆蓋 `index.html` + 補回外掛 + 補新圖,我們從不改動原作者的遊戲碼。

### 1. 抓原版 `index.html`(放暫存區,別直接覆蓋)
```bash
curl -s --ssl-no-revoke -o D:/ppRepos/_scratch/scripts/orig_index.html \
  https://shines871.github.io/idle-lineage-class/index.html
```
- `--ssl-no-revoke`:git-bash 的 curl 走 Schannel,對某些站憑證撤銷查不到會硬失敗(exit 35),加這個只跳過撤銷檢查。

### 2. 確認原版乾淨 + 比對差異
- `grep -c -a "afk-" orig_index.html` 應為 **0**(原版不該有我們的外掛);`tail` 看結尾是正常 `</body></html>`、只有一個 `</body>`。
- 跟「目前版本」做 diff,看原作者改了什麼(寫進 commit message 給使用者看):
```bash
git show HEAD:index.html > D:/ppRepos/_scratch/scripts/current_index.html
# diff 時把我們加的外掛 script 行濾掉,避免被當成差異
diff <(grep -v -a "afk-offline.js\|afk-mobile.js\|afk-dex.js\|afk-fixes.js\|可獨立維護" current_index.html) orig_index.html
```

### 3. 算出原版新增、本地缺少的圖檔
用 GitHub API 抓原作者 repo 完整檔案樹,逐筆比對 `assets/`:
```bash
gh api repos/shines871/idle-lineage-class/git/trees/main?recursive=1 \
  --jq '.tree[] | select(.type=="blob") | .path'
```
- 列出「原版有、本地 `idle-lineage-class/` 沒有」的 `assets/*`。
- `desktop.ini` 這種 Windows 垃圾檔**不要**收。

### 4. 用原版覆蓋 + 把外掛 `<script>` 補回 `</body>` 前
**用 python 處理(中文 UTF-8 最穩),不要用 shell 字串拼**。讀原版內容 → 在 `</body>` 前插入五支外掛 script(**記得帶 `?v=` 版本號**,見「每次 push 前的檢查清單」) → 整份寫出。動手前 `assert` 原版只有一個 `</body>`、且尚未含外掛,避免插錯。

### 5. 抓缺的圖 —— 走 blob SHA,別用中文檔名當參數
中文檔名直接丟給 curl / 原生 exe,git-bash(MSYS)會重編碼把檔名弄壞。改走 **blob SHA(純 ASCII)**:
```bash
# 先拿到 path → sha 對照(含中文 path 沒關係,jq 輸出是資料不是 exe 參數)
gh api repos/shines871/idle-lineage-class/git/trees/main?recursive=1 \
  --jq '.tree[] | select(.type=="blob") | [.path, .sha] | @tsv'
```
再對每個缺檔 `gh api repos/shines871/idle-lineage-class/git/blobs/<sha>` 拿 base64 → decode 寫檔;**寫檔路徑用 python 的 unicode 字串**,檔名才正確(終端顯示亂碼是 console 編碼問題,實際檔名是對的,用 `git -c core.quotepath=false status` 驗)。

### 6. 自己驗證(不要丟給使用者測)
本機開 http server + Playwright 無頭載入 `index.html`:
- console 五支外掛都 `[AFK*] hooks OK` → 代表原作者沒改壞掛點(改了 id / DOM 順序才會失效,失效就回報哪個外掛哪個掛點要調)。
- 縮到手機尺寸確認手機版面沒爆。

### 7. commit + push + 清暫存
`git add -A` → commit(描述原作者這次更新了什麼)→ push → 刪掉 `_scratch/scripts/` 這次產生的中繼檔。

## ⭐ 核心原則:所有功能都用「外掛 JS」處理

- 任何新功能(離線掛機、手機版面、存檔匯入匯出…)**一律寫成獨立的 `*.js` 檔**,放在專案根目錄,用 **monkey-patch / 從外面包住全域函式 / 注入 DOM·CSS** 的方式掛上去。
- **嚴禁直接改 `index.html` 裡原作者的程式碼。** 對 `index.html` 唯一允許的改動,是在 `</body>` 前加上引用外掛的 `<script>` 標籤。
- 外掛要能「優雅降級」:自我檢查需要的全域函式/元素是否存在,缺了就 `console.warn` 後安靜停用,**不可把遊戲弄壞**。
- 這樣設計的目的:原作者更新版本(換掉整個 `index.html`)時,只要把那幾行 `<script>` 重新貼回去就能接上,外掛本身幾乎不用動。
- **「補原作者坑」的程式碼要標移除條件——但只標「過時後還會主動執行的」**:判準是『原作者修好後,這段會自己安靜退場,還是仍在跑?』。仍在跑的(執行期包住核心函式、長駐監聽/interval,如 `afk-fixes.js` 的 renderTabs select-guard)→ 放 `afk-fixes.js`(通用補坑檔)、並在該段檔頭寫清楚「原作者怎麼改就能整段刪」。會自動失效的(scope 在特定選擇器的 CSS 覆寫、單純去重/防禦)→ 不必標,選擇器不命中就回原樣、留著無害,留在原檔即可。我們自己的功能(離線掛機、手機版面…)不算「補坑」,不需要這種備忘。

### 🚨 外掛絕不可盲呼叫「會寫入/覆蓋玩家存檔」的原作者函式(踩過、害玩家存檔變 Lv.1 null)

> **血淚教訓(存檔轉移外掛)**:匯出功能為了「存最新進度」呼叫了原作者的 `saveGame()`。但匯出鈕在**主選單**上,主選單是「**還沒載入角色**」的狀態——此時全域 `player` 是 `index.html` 的空白預設值(`name:null, lv:1`),而 `saveGame()` **沒有防呆**,直接把 `player` 寫進 `lineage_idle_save_<currentSlot>`,於是**把玩家第 1 格的真實存檔覆蓋成 Lv.1 null,且無備份可救**。

- **外掛要拿存檔資料 → 直接讀 `localStorage`**(`lineage_idle_save_<n>`),**不要為了「拿最新」去呼叫 `saveGame()` 之類會寫檔的函式**。
- **真的非呼叫寫檔函式不可時,務必先確認「真的有載入角色」再呼叫**:`if (player && player.cls) { ... }`(空白 `player` 的 `cls` 是 `null`)。`saveGame()` 寫的是「目前所在存檔位 `currentSlot`」,在選單/未載入狀態呼叫 = 拿空白角色蓋掉那一格。
- 推論:**任何「會改動玩家 localStorage」的外掛操作,都要假設自己可能在「未載入角色 / currentSlot 不是使用者以為的那格」的狀態被觸發**,先驗狀態再動手;能唯讀就唯讀。
- 原作者的存檔系統**只在「匯入」時才留 `*_bak` 備份**,`saveGame()`/一般存檔**不留備份**——所以一旦被外掛誤覆蓋就是永久損失,務必從源頭防止。

## 目前的外掛

| 檔案 | 功能 |
|---|---|
| `afk-offline.js` | 離線掛機(關瀏覽器也結算收益;24h 上限、撞死即停、存活回原狩獵圖續掛) |
| `afk-mobile.js` | 手機版面(底部導覽列、一行式狀態列、浮動日誌面板、修正彈窗溢出) |
| `afk-extradata.js` | **掉落查詢+小百科共用的手動補充資料**(純資料、無 DOM、在 dex/wiki 之前載入,定義全域 `AFK_EXTRA`):`itemAcquire`(物品取得方式,`short` 給 dex 物品卡＋小百科裝備頁;`chain` 是舊傳說頁專用、現未使用)、`skillNote`(法術白話,原 wiki 的 EFFECT_OVERRIDE)、`weaponTraitEff`/`weaponTagTrait`(武器特性白話對照,dex 物品卡共用)。**只放「不能從遊戲 DB 動態算」的手動補充**;補一件裝備取得/一個法術只改這支、dex+wiki 同時生效。dex/wiki 都 call 時即時讀、沒載到優雅降級 |
| `afk-dex.js` | 怪物/掉落查詢(首頁入口;搜尋怪名/地圖/掉落物;讀 DB.mobs/maps/items + **五張掉落表 MOB_DROPS／DARK_WEAPON_DROPS／DARK_CRYSTAL_DROPS／DRAGON_DROPS／WARRIOR_DROPS**(與原作 _auditMobDrops 同一組;漏讀哪張就查不到);龍騎士表的職業限定任務道具標「🐉僅X」(讀 `TRIAL_ITEM_CLASS`);**純兌換/無怪掉的成品**(龍騎士書板·鎖鏈劍·臂甲…)補 `AFK_EXTRA.itemAcquire[id].short`「取得方式」、且這類非裝備非商店物品要靠有 itemAcquire 才會收進搜尋索引;桌機手機共用;**支援獨立頁 `?view=dex`**,見下「獨立頁」;頂部「掉落率模式」下拉=一般/席琳×3/經典×1/10 重算怪卡掉落率) |
| `afk-wiki.js` | 小百科(首頁入口;**多分頁 + 關鍵字搜尋**:職業專精/武器特性/戰鬥機制/地圖/能力值/職業魔法/帶寵物/傭兵/任務/套裝/裝備/強化/製作/負重/席琳/血盟/傲慢之塔/遺忘之島/軍王之室;部分讀遊戲資料、部分本檔手動維護;桌機手機共用;**支援獨立頁 `?view=wiki`**;**改前先讀下方「小百科維護準則」**)。**「地圖」分頁**讀 `MAP_CATEGORIES`+`DB.maps/DB.mobs` 動態列出(每張標 📍進入路徑=在哪個分類、等級範圍、進入條件,自動同步;遊戲移動方式=地圖選單選分類再選圖直接傳送,故路徑即分類)。**「裝備」分頁**(`renderEquip`,取代舊「傳說裝備」頁)讀 `DB.items` 依部位分組列出全部裝備+職業篩選(用遊戲 `equipOk` 真實規則);**詳情數值直接呼叫遊戲全域 `buildItemDescHTML({id,en:0,…})`**(永遠與遊戲一致、作者新增裝備/特效自動跟上、零手動維護),取得方式呼叫 `afk-dex.js` 暴露的 `window.AFK_DEX_API.acquireHTML(id)`(製作/商店/怪物掉落/`itemAcquire`)。每件詳情常駐 DOM(`display:none`)→ 完整數值與特效都進統一搜尋;詳情與整頁 HTML 都 memoize(`_equipDetail`/`_equipHtml`)→ 441 件搜尋重渲染不卡。**改裝備顯示時不要自己刻數值格式(會與遊戲分歧、得手動補),一律重用 `buildItemDescHTML`** |
| `afk-fixes.js` | 通用修正(補原作者上游坑、桌機/手機通用、與裝置判定無關;目前:renderTabs select-guard——戰鬥中操作強化下拉不被重繪關掉) |
| `afk-sw.js` | 背景大圖快取 Service Worker 註冊(配 `sw.js`;只在 isSecureContext 註冊、file:// 自動略過;不掛 DOM) |
| `afk-toast.js` | 手機 toast 提示(只手機;包 `logSys`,把「點擊事件同步窗內」呼叫的訊息浮現成 toast;戰鬥/掛機 tick 的訊息不在點擊窗內故不洗頻;無必須 DOM 掛點) |
| `afk-syncinfo.js` | 首頁顯示「原作者:秋玥 · 原版最後同步時間」(顯示在 `#main-menu` 最下方;作者為固定文字、時間讀根目錄 `last-sync.json` 換算台灣時間;時間讀不到只藏時間段、作者照顯示) |
| `afk-pwa.js` | PWA「安裝成免網路遊玩」+ 自動/手動更新 + 背景預抓離線資源(首頁 `#main-menu`:未安裝顯示文字連結「安裝成免網路遊玩」、iOS 點了跳文字引導;**已安裝(standalone)** 顯示 checkbox「自動更新至最新版本」**預設打勾**,沒勾且有新版才顯示「更新至最新版」連結+確認視窗;安裝後背景把 `assets/` 全抓進圖桶顯示進度。`<head>` 的 manifest/圖示/theme-color 用 JS 注入(同步會洗掉寫死的)。SW 註冊沿用 afk-sw.js,本檔只管觀察更新/UI/預抓) |
| `afk-analytics.js` | 注入 Cloudflare Web Analytics beacon 統計人數/開啟次數(評估 GitHub Pages 流量會否撞 100GB/月 軟上限;免費、不用 cookie、無自訂事件,只看 pageview/訪客/來源/路徑)。**只在正式站台注入**——非 https、localhost/127.0.0.1/`*.local` 一律略過,免本機測試污染統計;token 未填(`__` 開頭)時自動略過。不掛 DOM、不列入 smoke) |

> **小百科 / 掉落查詢的「獨立頁」(`?view=`)**:`index.html?view=wiki`、`index.html?view=dex` 會讓對應外掛把面板鋪滿整頁(藏掉創角/遊戲畫面、改 `document.title`、隱藏關閉鈕、背景點擊不關),並在最上方加一條**頁首導覽**(`#m-standalone-nav`:🏠首頁 / 📚小百科 / 📖掉落查詢,active 標亮)可互切與回首頁。看起來像獨立網頁。首頁兩顆入口旁各有一顆 `↗` 小鈕用 `window.open` 開新分頁到這網址;原本點主鈕開 modal 的行為保留。(頁首 `buildStandaloneNav` 在兩支外掛各有一份相同實作,只有 active 那支會跑、用 id 去重。)**資料仍來自 index.html 的 `DB`/`MOB_DROPS`/… 全域**(無法真的抽成獨立檔——那些 const 夾在原作者主程式裡、且每小時自動同步會整支覆蓋),所以獨立頁就是「重用 index.html 當資料源、只顯示該面板」。全寫在外掛內、不動原作者碼,自動同步不會洗掉。

> 前五支互相低耦合;手機版的離線摘要會自動打開日誌。afk-dex 純讀資料、桌機手機都掛。
> `afk-sw.js` 註冊 `sw.js`;`sw.js` 自 PWA 改版後是**雙桶分離快取**(cache-first):
> - **程式桶 `CODE_CACHE`**(版本 `CODE_VERSION`):index.html + 全部外掛 js + manifest + PWA 圖示 + 外部 CDN(Tailwind/placehold,離線也要能用)。
>   `CODE_VERSION` 由 `scripts/stamp-sw-version.mjs` 依「index.html＋全部外掛 js 內容 hash」自動覆寫 → **程式一改 hash 就變 → 瀏覽器偵測到新 sw.js → 觸發 PWA 更新流程**。
>   **改任何外掛 / index.html 後,push 前要跑 `node scripts/stamp-sw-version.mjs` 重算**(自動同步流程已自動跑;手動改外掛時別忘)。
> - **圖桶 `IMG_VERSION`**(`img-v3`,**固定桶名、不再 bump、不整桶倒掉**):`assets/` 全部圖,on-demand 快取 + 可由 afk-pwa 背景全預抓。
>   失效改走**逐張對帳**:`assets-manifest.json` 每張圖帶一個 git blob sha,SW(`reconcileImages`)記下自己快取的是哪個 sha;afk-pwa 每次載入(線上逛/已安裝都跑)把最新 manifest 送進 SW:① **reconcile**——只清掉 sha 對不上的舊圖(作者換一張只重抓一張,不重載整包 30MB);② **新增圖的處理**——reconcile 只清不抓,所以「程式更新帶新圖」靠 afk-pwa 比對 **manifest 簽章**(`afk_pwa_manifest_sig`):簽章變了(新增/換圖)→ 已安裝(standalone)就**重跑預抓**把新圖抓進圖桶(SW 預抓會跳過已快取同 sha 的、只抓新/變動的)。**沒這個的話新圖離線會 404(踩過:程式更新但圖沒跟著進離線快取)**。沒記過 sha 的舊快取(本機制上線前的)→ SW 用實際 bytes 算 sha 補對帳,相符補記、不符才清。**所以 sync-upstream 不再動 sw.js 的 IMG_VERSION,只負責產出帶 sha 的 manifest。**
> - 更新接管由頁面(afk-pwa)決定:install 不自動 skipWaiting,首次安裝自動啟用、之後更新停 waiting,等頁面送 `skip-waiting` 訊息(自動更新偏好開→自動送;關→使用者按更新鈕才送)。
> - 背景預抓清單 `assets-manifest.json`(自動同步重產,格式 `[[path, git-blob-sha], ...]`,**workflow 的 `git add` 要含它**);afk-pwa 安裝後才抓那 30MB,純線上逛的人不抓。
> - afk-sw 無 DOM 掛點不列入 smoke;**afk-pwa 有 UI 掛點,已列入 smoke 的 `[AFK-pwa]` 檢查**。
> `afk-fixes.js` 收「不綁手機/離線/查詢」的通用補坑碼:會主動執行(包核心函式/長駐監聽)的補坑放這,
> 不是放手機/離線檔裡(放錯檔名實不符);純 CSS 覆寫那種「過時自動失效」的不歸這、留在 `afk-mobile.js`。
> (存檔匯入/匯出原本有 `afk-savedata.js`,原作者已內建匯出入功能後移除。)

## 📚 小百科(afk-wiki.js)維護準則

> **🔴 鐵則:更新小百科資料前,第一件事一定要先 `git pull`(`git fetch origin && git pull --rebase origin main`)。**
> 每小時自動同步會在背景把作者新版推上來,本機落後就會拿舊的去比、漏掉剛進來的改版(席琳套裝改版踩過)。沒 pull 不准動手。

小百科已長成「**11 分頁 + 關鍵字搜尋**」:職業專精 / 武器特性 / 職業魔法 / 任務 / 套裝 / 強化 / 負重 / 席琳 / 血盟 / 傲慢之塔 / 遺忘之島。**改它前先讀這節**——以下都是使用者反覆要求過的點,別再犯。

### 「更新小百科內容」SOP(使用者說「更新小百科」就照這跑)

1. **先同步遠端,再用 `wiki-checkpoint.json` 的錨點抓 diff(不要用 git log 猜起點——踩過,會漏改版)**:
   - **務必先 `git fetch origin && git pull --rebase origin main`**:自動同步會在背景把作者新版推上來,本機落後就會拿舊的去比、漏掉剛進來的改版(2026-06-21 席琳套裝改版就是這樣差點漏掉)。
   - 讀 `wiki-checkpoint.json` 的 `reconciledIndexCommit`,那是「小百科上次對齊到的 index.html 版本」,即本次 diff 的起點。
2. **diff 出作者自上次對齊後改了什麼**:
   `git diff <reconciledIndexCommit> HEAD -- index.html`——**整段都看過,別只靠 grep**(這次的計件規則改在註解+邏輯裡,純 grep 資料 pattern 會漏);要快速定位可再 `| grep -E '"sk_|set_|DB\.sets|SHERINE_|MASTERY|type: "(quest|mastery)"|eff: "|_RECIPES'`。
   重點抓:新技能(`sk_`)、新套裝(`set_`/`DB.sets`)、新試煉/精通 NPC、新武器特性 `eff`、席琳套裝(`SHERINE_SET_TEXT`/`SHERINE_EFFECTS` 結構與計件規則)、`MASTERY_DATA`、客製製作(`_RECIPES`)變動。
3. **把新內容補進對應分頁**——分兩種:
   - **讀遊戲資料、自動同步的**(通常不用改):職業專精讀 `MASTERY_DATA`、職業魔法讀 `DB.skills`、席琳套裝讀 `SHERINE_SET_TEXT`、掉落查詢讀 `DB` 與五張掉落表(見下方 ⭐)。
   - **本檔手動維護的清單(這些才要手動補)**:武器特性 `WEAPON_TRAITS`、套裝 `SETS`、強化機制 `ENHANCE_SECTIONS`、負重 `LOAD_SECTIONS`、席琳各區 `SHERINE_SECTIONS`、血盟 `PLEDGE_SECTIONS`、傲慢之塔 `TOWER_SECTIONS`、任務 `QUEST_BY_CLASS`/`QUEST_COMMON`、技能白話補充 `EFFECT_OVERRIDE`。例:作者新增「惡魔套裝(set_12)」→ 手動加進 `SETS`。
   - **⭐ 全域掉落規則 → 補進掉落查詢的「全域特殊掉落規則」面板(`afk-dex.js` 的 `specialPanelHTML`)**:凡是「不綁特定怪、依條件觸發」的掉落(席琳結晶、施法卷軸變祝福/詛咒、賦予祝福卷軸、區域額外掉落、進化果實…這類掃描怪屬性/區域/全域機率的掉落),因為不在任一怪的 `MOB_DROPS` 裡、掉落查詢搜不到,**一律手動加一格 `spBlock` 到那個面板**(並把關鍵字加進 `SPECIAL_KEYS` 讓搜尋自動展開)。原版每次改動全域掉落都要同步補這裡,不要只更新小百科。
   - **⭐ 製作不一定都在 `CRAFT_RECIPES`,有「客製製作」另開資料結構,掉落查詢/製作頁要另外補讀**:掉落查詢物品卡與小百科製作頁的製作資訊只讀 `CRAFT_RECIPES`,但**有些裝備走獨立的客製製作系統、不在 `CRAFT_RECIPES`**,例:惡魔王武器走 `DEMONKING_RECIPES`+`DEMONKING_MATS`(炎魔之影:消耗 +11 以上指定惡魔武器、繼承其強化/詞綴/席琳套裝)。症狀=「某件裝備查不到在哪製作、且常常一整批」。**遇到「明明可做卻查不到製作」→ 去 `index.html` grep `_RECIPES`/`buildXXXCraftHTML`/該裝備 id**,找到那組客製配方後,**同時補進** `afk-dex.js` 的 `buildCraftIndex`(物品卡)**和** `afk-wiki.js` 的 `renderCraft`(製作頁),兩邊都要。
   - **⭐ 新掉落物可能不在 `MOB_DROPS`、而在「獨立掉落表」或「純兌換」→ 掉落查詢會查不到,更新小百科時務必一起檢查補上**(龍騎士血之渴望那串踩過):掉落查詢(`afk-dex.js` `buildIndexes`)要與**原作 `_auditMobDrops`(遊戲內「統計→掉落物」用的)讀同一組掉落表**,否則他統計查得到、我們查不到(戰士印記 `WARRIOR_DROPS` 漏讀踩過)。**判斷哪幾張的權威來源就是 grep `_auditMobDrops` 看他 push 哪些表**,照抄。目前 5 張:**`MOB_DROPS`／`DARK_WEAPON_DROPS`／`DARK_CRYSTAL_DROPS`／`DRAGON_DROPS`／`WARRIOR_DROPS`**。作者再開**新表**(他會加進 `_auditMobDrops`),就把它也加進 `buildIndexes` 的 `raw` 串接(職業限定的任務道具用 `dragonDropNote`/`TRIAL_ITEM_CLASS` 標「🐉僅X」、全職可掉的不附註)。**純兌換/無怪掉的成品**(龍騎士書板·鎖鏈劍·臂甲走「普洛凱爾」兌換、50級試煉獎勵…)沒有任何怪會掉,要在 `afk-extradata.js` 的 `AFK_EXTRA.itemAcquire[id].short` 補「取得方式」;且這類「**非裝備、非商店**」物品(如 `skillbk` 書板)要被收進物品搜尋索引才搜得到名字。**收錄條件(`buildItemIndex`):裝備／在商店(`SHOP_LISTS`)／有 `itemAcquire`／或 `gachaWeight>0`(在潘朵拉抽獎池)** 任一即收。**症狀=玩家在掉落查詢搜某新物品/材料卻查不到**。判準:作者新增的東西「在 `MOB_DROPS` 裡嗎?」不在 → 去找它在哪張掉落表/哪種兌換,補進掉落查詢,別只更新小百科。
   - **⭐ 「沒有固定來源」已自動偵測(含寶箱與各種試煉/兌換結構)**:掉落查詢 `hasFixedSource(id)` 統一判斷來源,讀:`DROPPED_SET`(怪掉)＋`_craftIndex`(製作,含 `CRAFT_RECIPES`/`DEMONKING_RECIPES`/`LUMIEL_RECIPES`)＋`_shopIndex`(商店)＋`itemAcquire`(手動)＋`boxTiersOf`(歐西里斯寶箱 `OSIRIS_BOX_*`)＋**`trialSourceOf`(各職業試煉/兌換設定結構:`TRIAL_50_CFG`/`DARK_TRIAL_CFG`/`SHENIEN_EX`/`WARRIOR_EX`/`PROCEL_EX`/`YURIA_REWARDS`)**。這些都**讀遊戲全域、作者改設定自動跟上,不必逐物品手動補**(瑪那水晶球等 50 級試煉成品、影子裝、幻術士裝、戰士團裝、臂甲都靠 `trialSourceOf` 現身)。**潘朵拉限定物(`gachaWeight>0` 且查無固定來源)→ 自動收進搜尋 + 詳情卡標中性句「目前沒有固定取得途徑」**(依規則不提潘朵拉)。**作者新增「會發裝備的新結構」時**(grep `rewards:`/`reward:`/`_EX`/`_CFG`),把它加進 `buildTrialBy()` 即可一次涵蓋整批。真正剩的死角只有「`gachaWeight=0`、不在任何結構、又沒怪掉」的廢棄/起始裝(留空合理)。
   - **⭐ 取得方式只標「可控」的,潘朵拉黑市(轉蛋)是隨機池、不列(使用者決定)**:掉落查詢物品卡的「取得方式」列(`itemDetailHTML`)**只顯示可控取得**——靈魂之球喚回(巴列斯/巴風特魔杖,走 `SOULORB_RESTORE`)、龍騎士普洛凱爾兌換成品(走 `itemAcquire`)等;**潘朵拉的黑市抽獎雖然幾乎什麼都抽得到,但太不可控、列了是雜訊,刻意不顯示**(別把『潘朵拉抽獎』當來源文字寫出來;但用 `gachaWeight>0` 判斷「在抽獎池→可搜尋＋詳情卡標中性句『目前沒有固定取得途徑』」是另一回事、是 OK 的,見上節 `hasFixedSource`)。**即使潘朵拉是某物的「唯一」來源也一樣不列**——改寫「目前沒有固定取得途徑」這類中性句,不要寫「只能潘朵拉抽」(使用者明確要求:潘朵拉太難取得、不算取得方式)。小百科「技能書怎麼拿」之類的說明同此原則:只寫試煉/製作/商店/掉落等可控來源,潘朵拉一律不提。製作/掉落另由 `craftInfoHTML` 與搜尋鈕呈現。**(舊「傳說裝備」頁 `renderLegend`/`legendAcquire`/`LEGEND_SOULORB` 已隨「裝備」分頁上線移除;裝備頁的取得方式統一走 `AFK_DEX_API.acquireHTML`,喚回類成品靠 `itemAcquire[id].short` 呈現。`itemAcquire` 的 `chain` 欄是舊傳說頁專用、目前無人讀,新增資料只需填 `short`。)** **遇到新的喚回/兌換機制**(grep `soulorb`/`_restore`/`eff:`)→ 結果裝備補進 `SOULORB_RESTORE`(dex 物品卡)與 `itemAcquire[id].short`(裝備頁/掉落查詢共用)。
4. 補完照「每次 push 前檢查清單」bump 對應外掛 `?v=`(動到 `afk-dex.js` 也要 bump 它)、無頭瀏覽器測過再推。**並把 `wiki-checkpoint.json` 更新成現在的 HEAD**:`reconciledIndexCommit`＝`git rev-parse HEAD`、`reconciledIndexBlob`＝`git rev-parse HEAD:index.html`、`reconciledAt`＝台灣時間(UTC+8),跟這次小百科改動一起 commit——錨點前進了,下次才不會重複比同一段。

### 內容鐵則(踩過、別再犯)

- **⭐ 表格優先 + 有數據就用數據(使用者明訂的鐵則)**:任何分頁,**能用表格呈現就用表格**(門檻/數值/對照/分段),別用散文堆。**程式裡查得到的數字,一律用程式的實際數據/公式講清楚**——優先「動態讀 DB 或呼叫遊戲函式即時產生表格」(像「能力值」頁逐級表、「負重」頁的懲罰階表/上限公式試算表/腰帶 weightCap 直接讀 DB),這樣作者改數值會自動跟上、不用手抄也不會過時。範例:`renderLoad` 把懲罰階、上限公式、額外上限來源全做成表,腰帶款式 `for (id in DB.items) slot==='belt' && weightCap` 動態列。**散文只留「機制怎麼運作、怎麼解」這種表格表達不了的**。
- **⭐ 數據化、簡潔,不要廢話**:小百科是「查數據」的工具,不是讀物。能用表格/數字/公式講清楚的就別寫一大段散文。**接任何功能進小百科前,先去 `index.html` 巡過「真正算它的那段 code」(函式/查表/公式/旗標),用實際邏輯寫**,不要照遊戲說明或註解抄(那些常過時/模糊)。範例風格:能力值分頁的「逐級數值表」「封頂對照表」就是直接呼叫遊戲函式產生數字;說明文字壓到一兩句、把細節交給表格。寫完自我檢查:這段有沒有「換句話再講一次」「跨項比較」「meta 旁白」這種對查資料沒用的贅字?有就刪。
- **白話、零術語**:不要骰子寫法(`1D4`→「1~4」)、不要「骰19/20」(→寫機率「約 5%/10%」);ER/MR 一律白話「迴避/魔防」。**防禦(AC)比照遊戲內裝備欄用「負值」呈現**——本作 AC 越低越強,遊戲 `buildItemDescHTML` 顯示成「防禦(AC): -d.ac」(正常防具是負的),故小百科/掉落查詢一律寫「防禦(AC) -n」(`AC-3`→「防禦(AC) -3」,`friendly()` 只把「AC」標成「防禦(AC)」、保留原本正負號;不要再反相成正值)。負 ac 的下行向裝(如曼波帽子)顯示「+n」即可。
- **不要改版說明的語氣**:小百科是寫「現況」給玩家看,不是 changelog。別用「現在/原本是/已改成/不再/不會再…了」這種帶時間感、像更新公告的句子——直接陳述現在的事實(例:寫「屬性/遠古無法靠打怪取得,只能用碧恩的卷軸」,**不要**寫「屬性/遠古『現在』不會隨機掉了」)。
- **要精確數據、不要模糊**:不准「短時間/有機率/提升/依等級」這種沒數字的;去 code 查實際數值/公式補。真的是看等級差/隨智力浮動沒固定值的,**照公式寫**、別硬編一個百分比。
- **🔑 數據一律以「程式碼的實際邏輯」為準,絕不直接抄遊戲內的說明文字或註解**:遊戲裡的物品/技能說明(`d:`/`item.d`/技能 `msg`)與 code 註解,是寫給玩家看的白話、常常**模糊、過時、或與實際公式不符**(作者改了數值卻沒改說明)。寫小百科數據時**一定要追到真正算它的那段 code**(函式/查表/公式/常數),用那裡的實際值,不要照說明或註解填。例:擊殺回 MP 不是看物品說明,而是去查 `getWisMpOnKill(wis)` 的分段表;掉率去查 `MOB_DROPS`/掉落判定式而非道具描述。**自我檢查:我這個數字是「從負責計算的 code」拿的,還是「從一段給玩家看的文字/註解」抄的?** 後者一律不可信,回去找 code。
- **不要塞沒用的 () 補充**:括號只放「對玩家有用的事實/數據」(等級、機率、需求屬性、地點…)。<b>跨職業比較(「與燃燒鬥志同效」)、meta 註解(「作者新增會自動出現」「刻意設計」)、把詞換句話再講一次 這種旁註一律不要</b>——它們不是玩家要的資訊,只是雜訊。能用一句乾淨的話講完就別硬加括號。
- **掉率/機率:依「怪等/類型」分段的要逐段列、且換算倍率別抄錯(席琳結晶踩過)**:code 裡常是 `if 怪等>=21 ... >=31 ... >=41` 或「BOSS/三大龍/夢幻之島各一個值」這種**分段**機率,小百科要**把每一段都列出來**,不要用「約萬分之一級距」這種一句話帶過(既模糊、又往往錯)。換算成百分比時**小心位數**:code 的小數 ×100 才是 %——`0.00001`=**0.001%**(十萬分之一),不是「萬分之一」;抄錯一位就差 10 倍。寫完自己反算一次:`%數 ÷ 100` 要等於 code 裡那個小數。另注意「不吃掉落倍率」這種旁註(席琳結晶機率固定、不受席琳世界 ×3 影響)也要寫進去。
- **時間單位**:技能 `dur`(buff/狀態)是**秒**;HoT 的 `hot.interval` 是 **tick(÷10 才是秒)**;顯示用「X 分 Y 秒 / X 小時 Y 分」(`fmtDur`),**不要跑出「5.3 分鐘」這種小數**。
- **能讀遊戲資料就讀,少硬寫**:會隨作者改的(套裝效果/技能/掉落/地圖名)優先動態讀 DB/遊戲常數,讀不到才用本檔備援(如 `SHERINE_SET_FALLBACK`)。**很多 `gainItem(...false,false)` 旁的舊註解已過時**——動手前去 code 確認,別照舊註解(例:黑市直接購買「即所見、不附詞綴」**不是詞綴來源**;屬性/遠古現在只能靠碧恩賦予祝福卷軸,不會隨機掉)。
- **分類對齊原版、不要同一個東西每職業重複跳**:法師魔法(1~10 階)是共用本職法術→**只列一次**,標「可學:法師x/妖精y/騎士z/黑暗妖精w」;妖精/黑暗妖精/騎士的專屬魔法分開列。判類:有 `reqM`=法師魔法;否則 `reqE`/`reqD`/`reqK` 歸專屬。黑暗妖精固定可學 1/2 階(Lv12/24)、妖精高階法師魔法標「需魔導精通」。

### 介面/排版鐵則

- **搜尋=「統一結果」**:打字就收起分頁列與職業列,跨「全部分頁+全部職業」一次列出命中區塊、依來源分組、關鍵字黃色高亮;**不要做成「切職業整頁消失」**(踩過)。職業相關分頁(專精/任務)搜尋時逐職業各搜;魔法是分類制故單次搜。
- **分頁列單排可左右捲動**(`flex-nowrap + overflow-x:auto`),不要換行兩排。
- **職業魔法分頁有「職業篩選」**(全部/法師/妖精/騎士/黑暗妖精):「全部」=分類總覽(法師魔法按階+各專屬);選某職業=只看「該職業學得到的魔法」(含可學的法師魔法,標該職業可學等級)。
- **手機**:不要為了標示加會被內容撐高的元素——席琳世界用「狀態列染紅」標示;怪物卡固定高 + 名稱兩行截斷(別隨怪/名稱長短抖動)。

## 🚨 每次 push 前的檢查清單

1. **確認所有外掛 JS 都已在 `index.html` 補上 `<script>` 引用**(在 `</body>` 前)。目前應有:
   ```html
   <script src="afk-offline.js?v=YYYYMMDDx"></script>
   <script src="afk-mobile.js?v=YYYYMMDDx"></script>
   <script src="afk-extradata.js?v=YYYYMMDDx"></script>
   <script src="afk-dex.js?v=YYYYMMDDx"></script>
   <script src="afk-wiki.js?v=YYYYMMDDx"></script>
   <script src="afk-fixes.js?v=YYYYMMDDx"></script>
   <script src="afk-sw.js?v=YYYYMMDDx"></script>
   <script src="afk-toast.js?v=YYYYMMDDx"></script>
   <script src="afk-syncinfo.js?v=YYYYMMDDx"></script>
   <script src="afk-pwa.js?v=YYYYMMDDx"></script>
   ```
   - 新增外掛時,**務必同時**加上對應的 `<script>` 行(並同步加進 `scripts/sync-upstream.mjs` 的 `PLUGINS`;**有 DOM 掛點的**再加進 `scripts/smoke-hooks.mjs` 的 `need`——像 `afk-sw.js` 這種純註冊、無 DOM 掛點的就不必),否則功能不會生效、或下次自動同步會被原版覆蓋掉。
   - 原作者更新覆蓋 `index.html` 後,**第一件事就是把上面這幾行補回去**。
2. **改了任何外掛 JS → 一定要 bump `?v=` 版本號**(GitHub Pages / 瀏覽器會死命快取 JS;
   只改 `index.html?v=` 沒用,因為 script src 的檔名沒變、瀏覽器照樣給舊的快取 JS。
   Brave 尤其黏)。版本號規則:日期 + 當天流水字母(如 `20260613a` → `20260613b`)。
   **沒 bump 的話使用者載到的還是舊外掛,debug 會鬼打牆**(踩過一整輪才發現)。
   - **改完外掛 / index.html 後,push 前再跑一次 `node scripts/stamp-sw-version.mjs`**(從 repo 根目錄)——重算 `sw.js` 的 `CODE_VERSION`,PWA 才偵測得到更新。漏跑的話「已安裝的 app」不會跳更新。
3. 確認沒有把 `.scratch/`、`node_modules/` 等暫存物混進 commit(見下)。
4. 載入遊戲後開 console,確認看到各外掛的 `[AFK*] hooks OK`,沒有缺掛點的警告。

## 暫存檔 / 測試

- 一次性測試腳本、Playwright、截圖等一律放 `.scratch/`,且已被 `.gitignore` 擋掉,不進 git。
- 驗證手段:用 Playwright(`playwright-core` 指向本機快取 Chromium)無頭跑 `index.html`,截圖或讀 DOM 驗證。
- **Playwright 一律 headless(無頭),不可彈出可見瀏覽器視窗干擾使用者螢幕。** 不管用 `playwright-core` 腳本還是 MCP 瀏覽器工具都一樣:腳本用 `chromium.launch({ headless: true })`;MCP 瀏覽器若預設會開可見視窗,就改回腳本式無頭驗證,不要在使用者畫面上彈窗。截圖一律走無頭截圖。
- **🚨 會「動到玩家存檔(寫入/覆蓋 localStorage)」的功能,上線前一定要測「真實角色 → 操作 → 確認存檔沒被改壞」這條路,不能只用合成資料測機制。**(踩過:存檔轉移用「塞假存檔到第 2 格、只驗第 2 格還在」測過就上線,結果漏掉「`saveGame()` 蓋掉的是 currentSlot=第 1 格」,把玩家角色弄成 Lv.1 null。)鐵則:
  - **測試要涵蓋真實觸發狀態**——存檔功能多半從**主選單(未載入角色)**觸發,就要在「未載入角色」狀態測,別只在「已載入」狀態測。
  - **斷言要看得到災情**:操作前後**比對「使用者實際會用的那一格 / 全部相關鍵」的內容有沒有被非預期改寫**,而不是只檢查自己有興趣的那格。
  - 動到存檔前,先想清楚「這個操作會不會在某狀態下覆蓋既有存檔、有沒有備份能救」;沒備份的覆蓋風險 = 上線前必須用真角色實測到放心為止。

### 量測效能時:每跑一輪前「重新整理頁面」,不要用 `loadGame()` 在原地重置(會漏記憶體污染數字)

實測過:在「同一個分頁、不重整」的情況下重複呼叫 `loadGame()`(載入存檔)來重置角色,第二次起記憶體會從 ~17MB 暴漲到 ~97MB、每個 tick 從 ~0.1ms 變 ~0.9ms(慢 9 倍)。原因是 `loadGame()` 連帶啟動的計時器/事件監聽/DOM 每次都「再掛一份」、舊的沒拆掉,連續載入就一直疊。**正解:每次量測前重新導航到網址(整個 JS 環境倒掉重來),不要在原地 `loadGame()` 重置**,否則 A/B 比較的後半段數字全被污染(我原本「四個切片值連續各跑一次」的做法就是被這個害到、數字不準)。
- 對一般玩家正常不影響(開遊戲只載入一次)。**待查疑點**:遊戲內「不重整就切存檔位/匯入存檔/回主選單再進」若底層直接再 `loadGame()` 而沒先清乾淨,連續切幾次可能變鈍——尚未驗證,先當備忘。

## 🗺️ 離線掛機原則:等同「在線上掛機照跑」+ 非選單地圖(攀登/遺忘之島)的續掛寫法

`afk-offline.js` 的核心原則:**離線掛機 = 把「在線上會發生的掛機」照跑一遍**,行為盡量與在線一致(同圖續掛、撞死即停結算到死前、存活回原地)。新增/修改離線行為前先對齊這條,不要自己發明特例。

**特別坑:有些「狩獵地點」不是地圖選單裡的地圖**(攀登 `pride_fN`、遺忘之島 `oblivion_travel`/`oblivion_island`)——它們**不在 `DB.maps`/`MAP_CATEGORIES`**,而且原作**不存檔**這類「旅程/攀登狀態」(`state.prideClimb…`/`state.oblivion`),重載一律回村。對這種地圖做離線續掛,規則:

- **不能用 `gotoMap()`/`changeMap()`(選單路徑)**把人帶回去——選單沒有這個 option,`setMapSelectors`/`sel.value` 設不上 → `mapState.current` 變空字串 → 補跑在空地圖空轉 → **收益歸零**(2026-06-21 遺忘之島就是這樣壞的,修前還會跳「離線掛機 0 分鐘…無收益」的怪訊息)。
- **正解**:外掛**自存一份旅程狀態**(攀登 `afk_pride_<slot>`、遺忘之島 `afk_obl_<slot>`),登入時在「原 loadGame 之前」擷取;補跑時**還原 `state.xxx` 旗標 + 呼叫原作專屬進場函式**(攀登 `enterPrideFloor(n)`、遺忘之島 `enterOblivionMap(mapKey)`)進場,絕不走選單。
- **落點比照在線**:存活→補滿 HP/MP、留在原地續掛(state 旗標維持,saveGame 後由 `stamp()` 續記);撞死→清掉旅程旗標、`gotoMap(homeTown())` 回村(比照原作 `revive()` 的塔中/島中死亡回城)。
- **階段自動推進交給原作**:如遺忘之島「途中擊敗傳送門→進本島」是原作 `settleDeadMobs()` 內 `state._oblivionAdvance` 流程處理的,補跑時照呼叫 `settleDeadMobs()` 即可,不要自己重寫推進邏輯。
- 新增這類地圖時,記得 `mapName()` 也補上它的中文名(這些 id 不在 `MAP_CATEGORIES`,否則摘要會印出原始 id)。

### 例外:「時間排名挑戰」類的特殊 run → 離線一律「不續、不結算」(不是續掛)

非選單地圖不全都要續掛。**排名/計時挑戰**(原作 `state.riftRun` 的「時空裂痕」`rift_battle`、攀登的「排名挑戰」`prideRanked`)的設計是「停留越久排名/獎勵越高、撐到被打死」,**離線自動續＝刷排名/刷獎勵 exploit**;且原作這類 state 不存檔(transient `state` 物件)、重載一律回村(等同「中途離開＝該次作廢」)。所以離線外掛對這類**明確早退、完全不模擬**(`afk-offline.js` `maybeCatchup` 裡:排名攀登看 `prePride.ranked`、時空裂痕看 `savedMap === 'rift_battle'`)。判準:**這張圖的收益/排名是不是「靠線上停留時間累積」?是 → 離線不能幫他跑**(不然就是掛機刷榜)。一般狩獵圖(含底比斯、魔族/暗影神殿等選單地圖)才照「在線掛機照跑」續結算。

## 🐌 離線結算效能:實測結論(別再往「優化掃描」方向想)

有人問過「24h 離線結算很慢、能不能優化」。用真實存檔(Lv63 法師/zone_14)實測過,結論是**沒有可省的掃描,維持現狀**。動手「優化」前先看這節,別重蹈覆轍:

- **不是背包掃描**(本來最直覺的猜測,實測推翻):決定性反事實測試——在跑到很慢時把背包從 258 筆砍到 203 筆,每 tick 耗時幾乎沒變(311→302µs)。背包整段 24h 也只從 184 長到 258 筆(+40%),撐不起好幾倍的速度落差。所以「離線時清廢品來加速」**無效,不要做**。
- **不是記憶體/log 累積**:單場結算過程記憶體穩定在 13~20MB、沒漏;戰鬥日誌在 `state.ff`(快轉)時 `logCombat`/`logSys` 直接 return、不累積。
- **真正成本 = 戰鬥模擬本身,且 RNG 變異極大**:同一隻角色同圖,跑兩次差很多——沒升級那次每 tick ~0.11ms(24h 純運算約 96 秒)、升到 Lv68 打進更硬戰鬥那次飆到 1~2ms(24h 約 471 秒)。慢不是 bug,就是「真的在一場一場模擬戰鬥」,場面越大越吃運算。
- **參考數據**:`TICK_MS=100`,24h = 864,000 個 tick。離線外掛 `afk-offline.js` 的「ms」是時間切片預算(`SLICE_MIN_MS=28` 短離線、`SLICE_MAX_MS=250` 長離線≥1h),只影響「讓畫面喘」的額外開銷、不影響純運算那條底;250ms 以上邊際效益已很小。
- **要真的加速只剩大改方向**(離線時用簡化戰鬥模型估算收益),會動到平衡、且不能改原作者戰鬥碼,CP 值低 → **建議維持現狀,接受它有時要跑幾分鐘**。

## Git / GitHub

- commit / push 時**不要**帶上 Claude 作者資訊或 `Co-Authored-By` 標記(沿用全域規則)。

### push 後要等 GitHub Pages 重建完成才算交付,並主動通知使用者

每次 push 到此 repo 後,**不要 push 完就回報「上線了」**——GitHub Pages 要重建(通常 push 後約 40 秒~1 分鐘)才會真的生效。流程:

1. **🚨 輪詢一律丟「背景任務」跑(`run_in_background`),不要在主回合同步 `sleep` 等**——同步等會讓那 1~2 分鐘完全不能回使用者訊息(使用者明確抱怨過)。push 完就把下面這支輪詢丟背景、自己繼續待命/接話,背景跑完會通知,再回報「上線了」。
2. **判準以「curl 抓線上實際版本號」為權威,不要只信 `gh api pages/builds/latest`**——build API 在連續多次 push 時會回報延遲的 commit(踩過:API 還停在前一個 commit,但 curl 線上版本其實已是最新)。背景輪詢直接比對線上外掛 `?v=`:
   ```bash
   # 背景輪詢:直到線上 index.html 的外掛版本 = 剛 bump 的版本(或直接 grep 你改的那支)
   for i in $(seq 1 14); do
     v=$(curl -s --ssl-no-revoke "https://pp771007.github.io/idle-lineage-class/index.html?cb=$(date +%s)" | grep -oE 'afk-wiki\.js\?v=[0-9a-z]+')
     echo "[$i] $v"; [ "$v" = "afk-wiki.js?v=<剛 bump 的版本>" ] && { echo BUILT; break; }; sleep 15
   done
   ```
   (`gh api repos/pp771007/idle-lineage-class/pages/builds/latest --jq '{status,commit}'` 可當輔助參考,但不要當唯一判準。)
3. 背景輪詢回報「BUILT」後**才**通知使用者「已上線、可重整看到新版」(訊息從 Telegram 來就用 `reply`)。
- GitHub Pages 站台:`https://pp771007.github.io/idle-lineage-class/`(本 fork,非原作者 shines871)。
