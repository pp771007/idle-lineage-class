---
name: release
description: 放置天堂加掛版發版 — 整理上次發版後的改動成「玩家看得懂」的更新說明，bump 加掛版版本號(semver)，打 tag + 開 GitHub Release。當使用者說「發版」「發 Release」「出新版」「發佈新版本」或 /release 時使用。
disable-model-invocation: true
---

# /release — 發版 SOP

本專案自 2026-07 起獨立維護（不再跟進原作者版本），發版由這支 skill 手動觸發。
版本號是**我們自己的 semver**（`v1.0.0` 起跳），存在 `version.json` 的 `app` 欄位（首頁由 afk-syncinfo 顯示「加掛版 vX.Y.Z」）。

## 更新說明鐵則（使用者明訂）

- **只寫玩家需要知道的東西**：功能更新、問題修正、玩起來有感的調整。
- **淺顯易懂、不要術語**：寫「離線掛機的結算速度大幅加快，掛一整天回來幾秒就算完」，不要寫「混合快速結算管線／取樣殺速」。
- **不寫**：內部重構、文件、CI/腳本、開發流程改動——玩家看不到的一律略過；某次發版若全是這類改動，跟使用者確認是否真的要發。
- 用分組條列：`✨ 新功能`／`🛠️ 問題修正`／`⚙️ 調整`（沒有的組別省略），每條一句白話。
- 結尾固定附：線上遊玩網址 `https://pp771007.github.io/idle-lineage-class/`、「原始碼可由下方 Source code 下載」。

## 步驟

1. **確認狀態乾淨且已上線**
   - `git fetch origin && git status`：工作區要乾淨、本地不落後 origin/main。
   - 有未 push 的改動 → 先走 `/prepush` + push、等 GitHub Pages 上線，再回來發版（發版對象必須是線上已生效的內容）。

2. **收集這次要發什麼**
   - 上一版 tag：`git tag --sort=-creatordate | head -5` 取最新的 `vX.Y.Z`（首次發版時上一版是舊日期式 tag `vYYYYMMDD-HHMM`）。
   - `git log <上一版tag>..HEAD --oneline` 逐條看，翻成玩家視角的白話條目（照上面的鐵則取捨）。

3. **決定版本號並讓使用者確認**
   - 讀 `version.json` 的 `app` 當現行版本。
   - 依改動建議 bump：大改版/不相容變動 → major；新功能 → minor；純修正/微調 → patch。
   - 用 AskUserQuestion 讓使用者確認「版本號 + 更新說明草稿」再往下。

4. **bump 版本 + commit + push**
   - 改 `version.json` 的 `app` 為新版本（`stamp-sw-version.mjs` 會保留此欄位，之後照跑不會弄丟）。
   - `node scripts/stamp-sw-version.mjs`（version.json 變了，CODE_VERSION 要跟著重算，PWA 才偵測得到）。
   - commit（`chore(release): vX.Y.Z`）→ push。
   - 照 CLAUDE.md「push 後等 GitHub Pages」規矩：背景輪詢線上 `version.json` 的 `app` 變成新版本才算上線。

5. **打 tag + 開 Release**
   - `git tag vX.Y.Z && git push origin vX.Y.Z`
   - 更新說明先用 Write 工具寫到 `.scratch/relnotes.md`（中文走檔案、不走命令列參數，避免 git-bash 重編碼），再：
     `gh release create vX.Y.Z --title "《放置天堂 - 以血為盟》加掛版 vX.Y.Z" --notes-file .scratch/relnotes.md`
   - 用完刪掉 `.scratch/relnotes.md`。

6. **回報**
   - 上線 + Release 建好後回報使用者（訊息從 Telegram 來就用 reply），附 Release 連結。
