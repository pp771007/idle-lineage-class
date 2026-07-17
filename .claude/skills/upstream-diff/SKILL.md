---
name: upstream-diff
description: 檢視原作者(shines871)repo 自上次分析後更新了什麼、產出功能清單報告、並把使用者挑選的功能逐一 3-way 移植進本 repo。當使用者說「看原版更新了什麼」「合併原版」「跟進原作者」「移植原版功能」或 /upstream-diff 時使用。
disable-model-invocation: true
---

# /upstream-diff — 原版差異分析與選擇性移植 SOP

本 repo 2026-07-06 起與原版分家、雙方各自演進。**兩邊幾乎每支核心 js 都有各自改動,整檔覆蓋=毀掉我們的修改,一律逐功能移植。**
好消息:分家點兩邊內容等價(`upstream-checkpoint.json` 的 `divergedAtUpstream`/`divergedAtOurs`,js/ 全檔 blob 相同),且分家點 blob 存在於我們 repo → **`git apply -3` 的 3-way merge 永遠可用**。

## 名詞

- **上游 clone**:`D:/otherPersonRepos/idle-lineage-class`(原作者 repo 的本機 clone;checkpoint `localClone` 欄)。以下 `git -C <clone>` 都指它。
- **BASE**:`upstream-checkpoint.json` 的 `reviewedUpstreamCommit`(上次分析到哪)。
- **TARGET**:上游 `origin/main` 最新 commit。

## A 階段:差異分析(每次都做)

1. **更新上游**:`git -C <clone> fetch origin --quiet`,`TARGET=$(git -C <clone> rev-parse origin/main)`。BASE==TARGET → 回報「原版無更新」,結束。
2. **總覽**:
   - 版本跳幅:`git -C <clone> show BASE:js/00-data.js | grep -m1 GAME_VERSION` vs `TARGET`。
   - `git -C <clone> diff BASE..$TARGET --stat -- js/ css/ index.html`
   - assets 分佈:`git -C <clone> diff BASE..$TARGET --numstat -- assets/ public/ | awk -F/ '{print $1"/"$2}' | sort | uniq -c | sort -rn`
   - 🚨 **上游 commit message 全是「1」,完全不可依賴,一律讀 diff 本身**;也沒有結構化 changelog(js/00 開頭的 `GAME_VERSION` 與零散版本註解僅供參考)。
3. **逐檔讀完整 diff**(量大 → 開 subagent 平行,依 /update-wiki 的檔案分群:00-data / 01+05 掉落 / 02~04+06+07 戰鬥 / 08+10+13+19+20+index+css 物品UI存檔 / 11+12+14 地圖任務製作 / 09+15~18+21 視覺音效圖鑑)。修改既有行的 `-`/`+` 成對也要讀,不能只掃新增。
4. **產出報告** `upstream-reviews/<YYYY-MM-DD>-<版本範圍>.md` 並 commit——這是給使用者挑功能的菜單。每個功能一節,標註:
   - 玩家視角的功能說明
   - 涉及檔案/函式/結構名(方便之後裁 patch)
   - 是否含 assets(圖/音效,約幾檔)
   - **衝突風險**:該檔該區域我們自己有沒有改過(`git diff <divergedAtOurs>..HEAD -- <檔>` 對照);特別標記碰到「我們刻意偏離」的(見下方清單)
   - 移植狀態欄(未移植/已移植@commit/使用者略過)——之後想補加翻這份報告即可,不用重 diff
5. **更新 checkpoint**:`reviewedUpstreamCommit`=TARGET 完整 sha、`reviewedAt`=台灣時間(git-bash 用 `date -u -d '+8 hours'`,`TZ=` 不生效)、`reports` append 報告路徑、note 一句話。與報告同 commit。

## B 階段:移植(使用者挑了才做;每個功能獨立 commit)

1. **程式檔——兩種做法擇一**:
   - 功能占該檔 diff 大宗 → `git -C <clone> diff BASE..$TARGET -- js/<檔> > .scratch/f.patch`,裁掉不要的 hunk,回我們 repo `git apply -3 .scratch/f.patch`,衝突處手動解。
   - 功能散在幾個小 hunk → 直接讀 diff 手動改(較穩,不怕 hunk 相依)。
2. **🚨 我們「刻意偏離」上游的地方,以我們為準**(上游同區域的改動不要無腦帶入,先問使用者):王族 `royalAllyMult` 停用+傭兵上限 7 加回(js/06)、離線掛機整套(js/offline.js+js/05/08/11/13 的掛點)、`equipItem(item,silent)`/`useItem` keepModal、`_trimLog` 捲動錨定、`saveOnExit` 去重、`_pmAbsorbSelfHpCost`、傭兵自我 buff 修正、`maybeSpawnMobs` 自 tick 抽出(js/03)。完整清單看 CLAUDE.md + `git log --oneline <divergedAtOurs>..HEAD -- js/`。
3. **🔍 比對前先確認「同一件事在兩邊叫什麼、寫在哪」——不要只比同名函式(2026-07-17 踩過)**:
   遺物的效果說明,**我方 `relicEffectLabels`(js/10·單一函式·獨立玫瑰色區塊) ≒ 上游 `relicPurposeLabels` + 一部分 `buildItemDescHTML`**。
   兩邊函式**不同名也不同切法**,直接 grep 同名會找不到、拿單一函式對比會得出「我方少 29 個欄位」這種假結論(實際上多數是上游寫在另一支)。
   **判準:先問「上游把這件事寫在哪幾支?」再比,或直接比「玩家看到的輸出」。**
   ⚠️ 且**這個結構差異要保留、不要對齊**:上游把遺物說明併進 `_eff` 後會過 `filterClassicEffLabels()`,那道過濾是**用開頭字串比對**、黑名單含「重擊」
   → 上游的「重擊防護（受到重擊傷害 -N%）」(妖魔的兜襠布 `crushDr`)在經典模式會被誤濾掉,但 `crushDr` 實際上經典模式**照常生效**(js/04 無 classicMode 判斷)=上游的顯示 bug。
   我方獨立區塊不過那道過濾,反而正確;對齊上游等於把該 bug 搬進來。
4. **assets**:`git -C <clone> archive $TARGET -- assets/<子目錄> | tar -x -C <我們repo根目錄>`(中文檔名不經原生 exe 參數,安全);刪除的照 `git -C <clone> diff --name-status BASE..$TARGET -- assets/ | grep ^D` 清理。完成後 **`node scripts/gen-manifests.mjs`** 重產對帳清單一起 commit(否則 PWA 玩家卡舊圖/離線 404)。
5. **每個功能移植完的收尾檢查**:
   - 遊戲資料/機制變動 → 照 `/update-wiki` 的「檔→頁」對照補小百科/掉落查詢(可先記進報告、批次做)。
   - 動到戰鬥/tick/autoActions/計時 → 過一遍 CLAUDE.md 離線掛機章節的判準(fastAdvance 要不要同步、`Date.now()` vs `state.ticks`、ff 洩漏、外掛自建物件欄位)。
   - 動到 index.html 容器/首頁版面 → 人工掃首頁(跑馬燈/徽章/外掛框,smoke 驗不到)。
   - `node scripts/smoke-hooks.mjs` 綠的才 commit。
   - commit 階段**不** bump `?v=`/stamp(push 時 `/prepush` 統一,照專案規矩)。
6. **更新報告的移植狀態欄**(已移植@commit / 使用者略過),與功能同 commit 或收尾一次補。

## 判準備忘

- 「這次要不要移植」不歸這個 skill 決定——A 階段產完菜單就停,等使用者點菜;使用者只說「看更新了什麼」就只跑 A。
- 上游新機制若與我們的離線快速結算互動(新自動行為進 `autoActions`、新的每 tick 遞減計時器、出怪規則變動),移植時必須同步評估 js/offline.js,別只搬線上邏輯。
