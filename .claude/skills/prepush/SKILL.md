---
name: prepush
description: 放置天堂專案 push 前的完整檢查與準備 — bump 改動外掛的 ?v=、重算 sw.js 版本、跑 Playwright smoke、檢查衝突標記，全綠才建議 push。當使用者說「準備 push」「push 前檢查」「跑 prepush」或 /prepush 時使用。
disable-model-invocation: true
---

# /prepush — push 前一鍵備齊

對應 CLAUDE.md「每次 push 前的檢查清單」。**從 repo 根目錄(`D:\ppRepos\idle-lineage-class`)依序做完，全綠才建議使用者 push。** 任一步紅就停下回報，不要硬推。

## 步驟

1. **看這次要 push 什麼**
   - `git status` + `git log origin/main..HEAD --oneline`(還沒 push 的 commit)
   - `git diff origin/main..HEAD --name-only` 抓出「動到的 `afk-*.js`」清單。

1.5 **先接上主線最新版**(多人一起改時必做;只有自己在改也照做,沒差就是一行指令)
   - `git fetch origin main`,再看 `git merge-base --is-ancestor origin/main HEAD`:
     - exit 0 = 已經接在最新主線上,往下走。
     - exit 1 = 有人(朋友的雲端對話)在你之後合進了主線 → `git rebase origin/main`,把自己的 commit 接到他們後面。
   - 為什麼:不接上就推,PR 合併時會在版本號檔案卡住;更糟的是合得進去但 `?v=`/sw 版本是照「沒有對方改動」算的 → 新舊混搭(見步驟 2 的踩雷)。
   - rebase 衝突怎麼處理:
     - **產生檔**(`sw.js`、`version.json`、`assets-manifest.json`、`anim-manifest.json`,以及 `index.html` 裡只有 `?v=` 那幾行不同)→ 直接取主線那份:`git checkout --ours <檔>`(⚠️ rebase 時 ours＝主線、theirs＝自己正在接上去的 commit,跟 merge 相反)、`git add <檔>`、`git rebase --continue`;版本號等一下的步驟 2、3 會重算,不用手對。
     - **程式碼本身衝突**(兩人改到同一段)→ `git rebase --abort` 停下來,把兩邊各改了什麼講給使用者聽,讓他決定留哪一版;**不要自己猜著合**。
   - 接完後 `grep -rn "^<<<<<<<\|^>>>>>>>" --include=*.js --include=*.html --include=*.css --include=*.json .` 必須為空(stamp 不會清衝突標記)。
   - 接上之後遠端分支的舊 commit 會對不上 → push 一律用 `--force-with-lease=<分支>:<剛 fetch 到的遠端 sha>`(只蓋自己分支上「自己看過的那一版」,別人若也推了同分支會被擋下而不是被蓋掉)。

2. **bump 改動的 `?v=`**
   - **`js/*.js`、`css/*.css`、`afk-*.js` 全部：跑 `node scripts/stamp-code-versions.mjs`**(自動把 `?v=` 對齊「內容 sha1 前 10 碼」，不必手動算、也不會漏；afk-*.js 也在涵蓋範圍，不要手動 bump)。
     🚨 **這步絕不可省**：`?v=` 沒 bump ⇒ URL 沒變 ⇒ 玩家的瀏覽器/SW 繼續用舊快取，而同頁其他有 bump 的檔卻是新的 ⇒ **新舊混搭**。2026-07-11 踩過：遺物移植同時改了 `js/04`(新增 `equipSkillDmgMult`)與 `js/07`(呼叫它)、兩個 `?v=` 都沒 bump → 先快取過舊 `js/04`、之後才抓 `js/07` 的玩家拿到「新 07 + 舊 04」→ 一施放技能就 `Can't find variable: equipSkillDmgMult`，離線結算整段中斷、收益歸零。**看玩家何時快取而定，故低機率、無法重現，極難查**。
   - 改到 `assets/`、`public/assets/` 的圖 → 跑 `node scripts/gen-manifests.mjs` 重產對帳清單一起 commit(動到 `assets/anim/` 另跑 `node tools/gen-anim-manifest.js`)。

3. **重算 sw.js 版本**(PWA 偵測更新靠這個)
   - `node scripts/stamp-sw-version.mjs`

4. **冒煙測試**(確認外掛都掛得上、沒被改壞)
   - `node scripts/smoke-hooks.mjs` → 要看到「冒煙測試通過」、exit 0。
   - 紅了代表某外掛 hook 失效(遊戲碼被改到 / 外掛自己改壞)，回報是哪支。
   - **smoke 沒有任何自動排程在跑，這裡就是 push 前唯一的把關點，不可跳過。**(同步上游走 `/sync-upstream` 時腳本內也會跑一次。)

5. **衝突標記把關**(rebase 沒解乾淨會壞整頁)
   - `grep -nE "^<<<<<<<|^=======|^>>>>>>>" index.html sw.js afk-*.js` 必須為空。
   - 順手確認每支外掛在 index.html 只出現一次 `<script>`(沒有重複)。

6. **核心補丁還在**
   - `node scripts/apply-core-patches.mjs --check` → 必須 exit 0(印「全部 N 個核心補丁均已就位」;N 是錨點處數,不是補丁組數)。

7. **最後把關:`?v=` 全對得上**
   - `node scripts/stamp-code-versions.mjs --check` → 必須 exit 0(「所有 js/css 的 `?v=` 都與內容一致」)。
   - 紅了代表步驟 2 漏跑或有人手改過 → 跑一次不帶 `--check` 的版本修好再 push。

8. **回報結果**
   - 全綠：列出「bump 了哪幾支、sw 版本、smoke 通過」，告訴使用者可以 `git add -A && git commit && git push` 了(或直接幫忙 commit/push)。
   - 有紅：明確指出哪步、要修什麼，停在這裡別 push。

9. **push 後要等 GitHub Pages 重建(~40s-1min)才算上線**
   - 輪詢丟背景跑(`run_in_background`)，不要同步 sleep 佔住回合。
   - 判準=curl 線上 `version.json` / `?v=` 是否已換成新的(**不要只信 pages/builds API**，連續 push 時它會落後)。
   - 看到新版本才通知使用者「已上線」。

> 註：實際 `git push` 時還有 `prepush-guard.mjs` hook 會再擋一次衝突標記/引用/sw 版本，這支 skill 是「主動把全部準備做完」。
