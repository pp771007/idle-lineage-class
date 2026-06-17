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

## 目前的外掛

| 檔案 | 功能 |
|---|---|
| `afk-offline.js` | 離線掛機(關瀏覽器也結算收益;24h 上限、撞死即停、存活回原狩獵圖續掛) |
| `afk-mobile.js` | 手機版面(底部導覽列、一行式狀態列、浮動日誌面板、修正彈窗溢出) |
| `afk-dex.js` | 怪物/掉落查詢(首頁入口;搜尋怪名/地圖/掉落物;純讀 DB.mobs/maps/MOB_DROPS/items;桌機手機共用) |
| `afk-wiki.js` | 小百科(首頁入口;**10 分頁 + 關鍵字搜尋**:職業專精/武器特性/職業魔法/任務/套裝/強化/負重/席琳/血盟/傲慢之塔;部分讀遊戲資料、部分本檔手動維護;桌機手機共用;**改前先讀下方「小百科維護準則」**) |
| `afk-fixes.js` | 通用修正(補原作者上游坑、桌機/手機通用、與裝置判定無關;目前:renderTabs select-guard——戰鬥中操作強化下拉不被重繪關掉) |
| `afk-sw.js` | 背景大圖快取 Service Worker 註冊(配 `sw.js`;只在 isSecureContext 註冊、file:// 自動略過;不掛 DOM) |
| `afk-toast.js` | 手機 toast 提示(只手機;包 `logSys`,把「點擊事件同步窗內」呼叫的訊息浮現成 toast;戰鬥/掛機 tick 的訊息不在點擊窗內故不洗頻;無必須 DOM 掛點) |

> 前五支互相低耦合;手機版的離線摘要會自動打開日誌。afk-dex 純讀資料、桌機手機都掛。
> `afk-sw.js` + 根目錄 `sw.js`:只對 `/assets/background/` 的場景大圖做 cache-first(回訪/重整/改版都秒出、
> 不受 GitHub Pages 10 分鐘快取與每次部署換 ETag 影響);**絕不快取 index.html / 任何 *.js**,所以遊戲碼與外掛永遠拿最新。
> 原作者換掉「既有同名」背景圖時,**自動同步會偵測(比對 blob SHA)、重抓並自動 bump `sw.js` 的 `CACHE_VERSION`**,且在該次 commit message／Release 說明註明,不必手動處理(新檔名的新圖不需 bump)。afk-sw 無 DOM 掛點,故不列入 smoke 冒煙檢查。
> `afk-fixes.js` 收「不綁手機/離線/查詢」的通用補坑碼:會主動執行(包核心函式/長駐監聽)的補坑放這,
> 不是放手機/離線檔裡(放錯檔名實不符);純 CSS 覆寫那種「過時自動失效」的不歸這、留在 `afk-mobile.js`。
> (存檔匯入/匯出原本有 `afk-savedata.js`,原作者已內建匯出入功能後移除。)

## 📚 小百科(afk-wiki.js)維護準則

小百科已長成「**10 分頁 + 關鍵字搜尋**」:職業專精 / 武器特性 / 職業魔法 / 任務 / 套裝 / 強化 / 負重 / 席琳 / 血盟 / 傲慢之塔。**改它前先讀這節**——以下都是使用者反覆要求過的點,別再犯。

### 「更新小百科內容」SOP(使用者說「更新小百科」就照這跑)

1. **查上次更新小百科內容的時間**:`git log --format='%ad %h %s' --date=short -- afk-wiki.js`,取最近一筆「內容性」commit(跳過只 bump 版本號那種)的日期/hash。
2. **diff 這段期間原作者(index.html 遊戲資料)的變更**:
   `git log --oneline --since=<上次日期> -- index.html`、
   `git diff <上次hash> HEAD -- index.html | grep '^+' | grep -E '"sk_|set_|DB\.sets|type: "(quest|mastery)"|SHERINE_SET_TEXT|eff: "'`
   重點抓:新技能(`sk_`)、新套裝(`set_`/`DB.sets`)、新試煉/精通 NPC、新武器特性 `eff`、席琳套裝(`SHERINE_SET_TEXT`)、`MASTERY_DATA` 變動。
3. **把新內容補進對應分頁**——分兩種:
   - **讀遊戲資料、自動同步的**(通常不用改):職業專精讀 `MASTERY_DATA`、職業魔法讀 `DB.skills`、席琳套裝讀 `SHERINE_SET_TEXT`、掉落查詢純讀 `DB`。
   - **本檔手動維護的清單(這些才要手動補)**:武器特性 `WEAPON_TRAITS`、套裝 `SETS`、強化機制 `ENHANCE_SECTIONS`、負重 `LOAD_SECTIONS`、席琳各區 `SHERINE_SECTIONS`、血盟 `PLEDGE_SECTIONS`、傲慢之塔 `TOWER_SECTIONS`、任務 `QUEST_BY_CLASS`/`QUEST_COMMON`、技能白話補充 `EFFECT_OVERRIDE`。例:作者新增「惡魔套裝(set_12)」→ 手動加進 `SETS`。
4. 補完照「每次 push 前檢查清單」bump `afk-wiki.js?v=`、無頭瀏覽器測過再推。

### 內容鐵則(踩過、別再犯)

- **白話、零術語**:不要骰子寫法(`1D4`→「1~4」)、不要「骰19/20」(→寫機率「約 5%/10%」);AC/ER/MR 一律白話「防禦/迴避/魔防」,**AC 越低越強→寫成「防禦 +n」**(`AC-3`→「防禦+3」,用 `friendly()`)。
- **不要改版說明的語氣**:小百科是寫「現況」給玩家看,不是 changelog。別用「現在/原本是/已改成/不再/不會再…了」這種帶時間感、像更新公告的句子——直接陳述現在的事實(例:寫「屬性/遠古無法靠打怪取得,只能用碧恩的卷軸」,**不要**寫「屬性/遠古『現在』不會隨機掉了」)。
- **要精確數據、不要模糊**:不准「短時間/有機率/提升/依等級」這種沒數字的;去 code 查實際數值/公式補。真的是看等級差/隨智力浮動沒固定值的,**照公式寫**、別硬編一個百分比。
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
   <script src="afk-dex.js?v=YYYYMMDDx"></script>
   <script src="afk-wiki.js?v=YYYYMMDDx"></script>
   <script src="afk-fixes.js?v=YYYYMMDDx"></script>
   <script src="afk-sw.js?v=YYYYMMDDx"></script>
   <script src="afk-toast.js?v=YYYYMMDDx"></script>
   ```
   - 新增外掛時,**務必同時**加上對應的 `<script>` 行(並同步加進 `scripts/sync-upstream.mjs` 的 `PLUGINS`;**有 DOM 掛點的**再加進 `scripts/smoke-hooks.mjs` 的 `need`——像 `afk-sw.js` 這種純註冊、無 DOM 掛點的就不必),否則功能不會生效、或下次自動同步會被原版覆蓋掉。
   - 原作者更新覆蓋 `index.html` 後,**第一件事就是把上面這幾行補回去**。
2. **改了任何外掛 JS → 一定要 bump `?v=` 版本號**(GitHub Pages / 瀏覽器會死命快取 JS;
   只改 `index.html?v=` 沒用,因為 script src 的檔名沒變、瀏覽器照樣給舊的快取 JS。
   Brave 尤其黏)。版本號規則:日期 + 當天流水字母(如 `20260613a` → `20260613b`)。
   **沒 bump 的話使用者載到的還是舊外掛,debug 會鬼打牆**(踩過一整輪才發現)。
3. 確認沒有把 `.scratch/`、`node_modules/` 等暫存物混進 commit(見下)。
4. 載入遊戲後開 console,確認看到各外掛的 `[AFK*] hooks OK`,沒有缺掛點的警告。

## 暫存檔 / 測試

- 一次性測試腳本、Playwright、截圖等一律放 `.scratch/`,且已被 `.gitignore` 擋掉,不進 git。
- 驗證手段:用 Playwright(`playwright-core` 指向本機快取 Chromium)無頭跑 `index.html`,截圖或讀 DOM 驗證。
- **Playwright 一律 headless(無頭),不可彈出可見瀏覽器視窗干擾使用者螢幕。** 不管用 `playwright-core` 腳本還是 MCP 瀏覽器工具都一樣:腳本用 `chromium.launch({ headless: true })`;MCP 瀏覽器若預設會開可見視窗,就改回腳本式無頭驗證,不要在使用者畫面上彈窗。截圖一律走無頭截圖。

## Git / GitHub

- commit / push 時**不要**帶上 Claude 作者資訊或 `Co-Authored-By` 標記(沿用全域規則)。
