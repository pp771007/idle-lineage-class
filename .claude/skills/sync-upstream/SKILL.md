---
name: sync-upstream
description: 把本 repo 同步到原作者(shines871)最新版——核心整包換上游原文、資產鏡像、套錨點補丁、重產 manifest/版本、smoke。當使用者說「同步原版」「同步上游」「更新上游」「跟進原作者」或 /sync-upstream 時使用。
---

# /sync-upstream — 同步上游原版(純鏡像＋外掛架構)

本 repo 架構=「上游原版鏡像＋外掛層」(見 CLAUDE.md)。同步=**整包蓋上游**,我們的東西(afk-*.js、sw.js、scripts/、補丁)不在覆蓋範圍。舊的 3-way 逐功能移植 SOP 已作廢。

## 名詞

- **上游 clone**:`D:/otherPersonRepos/idle-lineage-class`(`upstream-checkpoint.json` 的 `localClone`)。
- **BASE**:`upstream-checkpoint.json` 的 `syncedUpstreamCommit`(目前鏡像的上游 commit)。
- **TARGET**:上游 `origin/main` 最新(或使用者指定)。

## 流程

1. **更新 clone 並 checkout**:`git -C <clone> fetch origin --quiet`;`TARGET=$(git -C <clone> rev-parse origin/main)`。BASE==TARGET → 回報「原版無更新」結束。否則 `git -C <clone> checkout -q $TARGET`(sync 腳本讀的是 clone 的**工作樹**,必須真的 checkout)。
2. **總覽**(回報給使用者):版本跳幅(`git -C <clone> show BASE:js/00-data.js | grep -m1 GAME_VERSION` vs TARGET)、`diff --stat`、assets 變動量。🚨 上游 commit message 全是「1」,一律讀 diff 本身。
3. **assets/public 鏡像(先於 sync 腳本)**——**比 blob sha,不是比檔名**(「兩邊都有但內容不同」曾一次 10,149 檔):
   ```bash
   git -c core.quotepath=false ls-files -s assets public | sed 's/^[0-9]* \([0-9a-f]*\) [0-9]\t/\1\t/' | awk -F'\t' '{print $2"\t"$1}' | sort > /d/ppRepos/_scratch/ours.txt
   git -C <clone> -c core.quotepath=false ls-files -s assets public | <同上> > /d/ppRepos/_scratch/up.txt
   # 要複製 = 內容不同(join 比 sha) ∪ 上游新增(comm -13);要刪除 = 我方多出(comm -23)
   tar -C <clone> -c -T <清單檔> | tar -x -C <本repo>     # 中文檔名不經 exe 參數,安全
   git rm -q --pathspec-from-file=<刪除清單>
   ```
   - 刪除前 grep `afk-*.js` `scripts/` 確認外掛層沒引用要刪的檔(原則上不該有——assets 必須維持純鏡像,外掛引用上游既有檔)。
   - 抽查幾個複製後的檔 `git hash-object` 對得上上游 sha。
4. **跑同步腳本**:`node scripts/sync-upstream.mjs <clone>`——覆蓋核心 js/css → index.html=上游+`scripts/afk-plugin-block.html` → `apply-core-patches.mjs` → `tools/gen-anim-manifest.js`+`gen-manifests.mjs`+`stamp-code-versions.mjs`+`stamp-sw-version.mjs` → `smoke-hooks.mjs`。
   - **錨點失效會 exit 1**(訊息指出哪個補丁):去讀上游該區域的 BASE..TARGET diff,更新 `apply-core-patches.mjs` 的錨點字串/邏輯,重跑。改完 `--check` 全綠才算。
5. **收尾檢查**:`grep -nE "^<<<<<<< |^>>>>>>> |^=======$" index.html sw.js afk-*.js` 為空;每支外掛 index.html 引用恰一次;`apply-core-patches.mjs --check` exit 0;`stamp-code-versions.mjs --check` exit 0。
6. **更新 `upstream-checkpoint.json`**:`syncedUpstreamCommit`=TARGET 完整 sha、`syncedAt`=台灣時間(git-bash 用 `date -u -d '+8 hours'`,`TZ=` 不生效)、note 一句話(版本跳幅)。
7. **commit**(與同步同 commit 或緊接;訊息如 `chore(sync): 同步上游原版 vX→vY (<sha7>)`)。**不主動 push**(照 CLAUDE.md commit 節奏;push 時走 /prepush)。
8. **回報+後續提醒**:
   - 上游內容變動摘要(新系統/平衡/素材)。
   - 小百科/掉落查詢尚未跟上 → 建議另跑 `/update-wiki`(以 BASE..TARGET 的遊戲資料 diff 為範圍)。
   - 上游若動了 index/首頁/DOM 結構 → 人工掃首頁與手機版面(外掛 DOM 錨點失效只會安靜消失,smoke 驗不到 UI 細節)。
   - 上游若新增「每 tick 遞減計時器/autoActions 自動行為/出怪規則」→ 過一遍 CLAUDE.md 離線掛機判準,評估 afk-offline 要不要跟。

## 判準備忘

- CI 版(`.github/workflows/sync-upstream.yml`,手動觸發開 PR)做同一件事,assets 用 `rsync --delete`——所以 assets/public 絕不可放我方獨有檔。
- 任何「上游也是這樣」的結論,出口前先 fetch clone 並註明比對的 commit。
