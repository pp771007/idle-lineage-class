# 放置天堂 — 專案規則

## 專案性質

- 本體是單一檔案的網頁放置遊戲 `index.html`(約 774KB,**由原作者持續更新**)+ `assets/`。
- 我們**不擁有也不修改** `index.html` 的原始遊戲程式碼。所有自訂功能一律以「**外掛 JS**」方式實作。

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
   <script src="afk-offline.js"></script>
   <script src="afk-mobile.js"></script>
   <script src="afk-savedata.js"></script>
   ```
   - 新增外掛時,**務必同時**加上對應的 `<script>` 行,否則功能不會生效。
   - 原作者更新覆蓋 `index.html` 後,**第一件事就是把上面這幾行補回去**。
2. 確認沒有把 `.scratch/`、`node_modules/` 等暫存物混進 commit(見下)。
3. 載入遊戲後開 console,確認看到各外掛的 `[AFK*] hooks OK`,沒有缺掛點的警告。

## 暫存檔 / 測試

- 一次性測試腳本、Playwright、截圖等一律放 `.scratch/`,且已被 `.gitignore` 擋掉,不進 git。
- 驗證手段:用 Playwright(`playwright-core` 指向本機快取 Chromium)無頭跑 `index.html`,截圖或讀 DOM 驗證。

## Git / GitHub

- commit / push 時**不要**帶上 Claude 作者資訊或 `Co-Authored-By` 標記(沿用全域規則)。
