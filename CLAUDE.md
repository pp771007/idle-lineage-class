# 放置天堂 — 專案規則

## 專案性質

- 本體是單一檔案的網頁放置遊戲 `index.html`(約 774KB,**由原作者持續更新**)+ `assets/`。
- 我們**不擁有也不修改** `index.html` 的原始遊戲程式碼。所有自訂功能一律以「**外掛 JS**」方式實作。
- 原作者(巴哈姆特 秋玥)的官方版本網址:**https://shines871.github.io/idle-lineage-class/**(原版遊戲就掛在這,index.html 的最新原始碼以此為準)。

## 「合併原版」= 從原作者站台抓最新 `index.html` 更新本專案

當我(使用者)說「**合併原版**」「**同步原版**」「**更新原版**」之類的指令時,流程如下。
原則:原版整份覆蓋 `index.html` + 補回外掛 + 補新圖,我們從不改動原作者的遊戲碼。

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
diff <(grep -v -a "afk-offline.js\|afk-mobile.js\|afk-savedata.js\|可獨立維護" current_index.html) orig_index.html
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
**用 python 處理(中文 UTF-8 最穩),不要用 shell 字串拼**。讀原版內容 → 在 `</body>` 前插入三支外掛 script(**記得帶 `?v=` 版本號**,見「每次 push 前的檢查清單」) → 整份寫出。動手前 `assert` 原版只有一個 `</body>`、且尚未含外掛,避免插錯。

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
- console 三支外掛都 `[AFK*] hooks OK` → 代表原作者沒改壞掛點(改了 id / DOM 順序才會失效,失效就回報哪個外掛哪個掛點要調)。
- 縮到手機尺寸確認手機版面沒爆。

### 7. commit + push + 清暫存
`git add -A` → commit(描述原作者這次更新了什麼)→ push → 刪掉 `_scratch/scripts/` 這次產生的中繼檔。

## ⭐ 核心原則:所有功能都用「外掛 JS」處理

- 任何新功能(離線掛機、手機版面、存檔匯入匯出…)**一律寫成獨立的 `*.js` 檔**,放在專案根目錄,用 **monkey-patch / 從外面包住全域函式 / 注入 DOM·CSS** 的方式掛上去。
- **嚴禁直接改 `index.html` 裡原作者的程式碼。** 對 `index.html` 唯一允許的改動,是在 `</body>` 前加上引用外掛的 `<script>` 標籤。
- 外掛要能「優雅降級」:自我檢查需要的全域函式/元素是否存在,缺了就 `console.warn` 後安靜停用,**不可把遊戲弄壞**。
- 這樣設計的目的:原作者更新版本(換掉整個 `index.html`)時,只要把那幾行 `<script>` 重新貼回去就能接上,外掛本身幾乎不用動。

## 目前的外掛

| 檔案 | 功能 |
|---|---|
| `afk-offline.js` | 離線掛機(關瀏覽器也結算收益;24h 上限、撞死即停、per-slot 多分頁安全) |
| `afk-mobile.js` | 手機版面(底部導覽列、一行式狀態列、浮動日誌面板、修正彈窗溢出) |
| `afk-savedata.js` | 存檔匯入/匯出(整包 localStorage,格式對齊 savedata-manager 的 tool-lite) |

> 三者互相低耦合;手機版的離線摘要會自動打開日誌,存檔匯入後離線外掛會自然結算。

## 🚨 每次 push 前的檢查清單

1. **確認所有外掛 JS 都已在 `index.html` 補上 `<script>` 引用**(在 `</body>` 前)。目前應有:
   ```html
   <script src="afk-offline.js?v=YYYYMMDDx"></script>
   <script src="afk-mobile.js?v=YYYYMMDDx"></script>
   <script src="afk-savedata.js?v=YYYYMMDDx"></script>
   ```
   - 新增外掛時,**務必同時**加上對應的 `<script>` 行,否則功能不會生效。
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

## Git / GitHub

- commit / push 時**不要**帶上 Claude 作者資訊或 `Co-Authored-By` 標記(沿用全域規則)。
