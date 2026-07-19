---
name: update-wiki
description: 放置天堂小百科/掉落查詢的更新 SOP — diff 驅動、逐檔逐頁機械式對照「上游遊戲資料的變動」(錨點=wiki-checkpoint 的 reconciledUpstreamCommit,diff 在上游 clone 做,上限=已同步到的 syncedUpstreamCommit),補進 afk-wiki.js / afk-dex.js / afk-extradata.js,測過再更新 checkpoint。當使用者說「更新小百科」「同步小百科」「補小百科內容」或 /update-wiki 時使用。
disable-model-invocation: true
---

# /update-wiki — 小百科更新 SOP(純上游鏡像架構版)

對應 CLAUDE.md「📚 小百科/掉落查詢維護」。**這是 diff 驅動、機械式逐項對照的流程,絕不可憑印象判斷「前面做過了」就跳步**(踩過漏整個模式)。

架構=純上游鏡像+外掛(2026-07-19 起):遊戲資料的變動來源**只有上游同步**,所以 diff 一律在**上游 clone**(`D:/otherPersonRepos/idle-lineage-class`)做,錨點記「上游 commit」:
- **BASE**:`wiki-checkpoint.json` 的 `reconciledUpstreamCommit`(小百科已反映到哪個上游 commit)。
- **TARGET**:`upstream-checkpoint.json` 的 `syncedUpstreamCommit`(遊戲現在鏡像到哪)。**只能對齊到這裡**——上游更新但還沒 sync 的部分,遊戲裡沒有,不要提前寫進小百科(先跑 /sync-upstream)。

## 鐵則(動手前先記住)

- 🔴 **先 `git fetch origin && git pull --rebase origin main`**(本 repo,別的 session/裝置可能推過),並 `git -C <clone> fetch` 確認 clone 不是舊的。
- 🔴 **diff 要整段逐項勾過**,即使覺得做過了也要看完。
- 🔴 **diff 不只看「新增的資料定義」,更要看「既有公式/機制被改」**——機制改動不會以新 `sk_`/`item` 出現,純掃新增一定漏。重點讀 `js/02-stats`、`js/04-combat`、`js/01-drops`、`js/05-kill` 裡**被修改的成對 `-`/`+` 行**。
- 🔴 **同一主題的 wiki 內容可能同時存在兩處:「資料陣列」(如 `COMBAT_SECTIONS`)和「自寫 render 函式」(如 `renderMode` 自己 inline 建表)。改了 grep 命中的那處 ≠ 改完。** 判準:改完**一定要 render 實測那一頁**(步驟 5),不能只靠 Edit 成功就當完成(踩過)。
- 🔴 上游 commit message 全是「1」,一律讀 diff 本身。

## ⚠️ 轉換期一次性任務(做完把 checkpoint note 裡的旗標拿掉)

2026-07-19 改鏡像架構時,遊戲一口氣進了**所有**上游功能——包含舊「選擇性移植」時代各輪**未移植/略過**的項目(它們從沒進過小百科)。首次跑本 skill 時,除了 BASE..TARGET diff,還要:
1. 翻 `upstream-reviews/*.md` 四份報告的「移植進度總表/移植狀態欄」,列出所有 **未移植/使用者略過** 的項目——這些現在都在遊戲裡了,逐項確認小百科/掉落查詢有沒有反映,沒有就照本 SOP 補。
2. 完成後在 `wiki-checkpoint.json` 的 note 註明「舊報告未移植項已全數掃過」,之後的輪次就不用再翻舊報告。

## 步驟

1. **同步 + 取錨點**
   - `git fetch origin && git pull --rebase origin main`;`git -C <clone> fetch origin --quiet`。
   - BASE=`wiki-checkpoint.json` 的 `reconciledUpstreamCommit`;TARGET=`upstream-checkpoint.json` 的 `syncedUpstreamCommit`(別用 git log 猜)。BASE==TARGET 且無轉換期任務 → 回報「無需更新」結束。

2. **列出所有變動的檔(不挑)**
   - `git -C <clone> diff BASE..TARGET --stat -- js/ css/`
   - 清單上每個有變的檔都要讀,不可只挑「看起來有新東西」的。

3. **逐檔讀完整 diff,照「檔 → 負責頁」對照表歸位**(`git -C <clone> diff BASE..TARGET -- js/<檔>`,新增的 `+` 與修改的 `-`/`+` 成對都讀):

   | 改到的檔 | 看什麼 | 對應頁 / dex |
   |---|---|---|
   | `00-data` | 新 技能/物品/套裝/武器/地圖/怪 | 職業魔法·裝備(自動) / 套裝 SETS(手動) / 掉落查詢 |
   | `01-drops` | 掉率、世界模式(席琳一般/瘋狂)、恩賜 | 席琳 / 掉落查詢 / 戰鬥機制 |
   | `02-stats` | 屬性/衍生值公式、buff、封頂 | 能力值 / 技能效果 |
   | `03`-`04` combat | 傷害公式、命中、武器特效 proc、強化倍率、異常狀態 | 戰鬥機制 / 武器特性 / 強化 |
   | `05`-kill | 條件式掉落(`if … gainItem`)、經驗/升級 | 掉落查詢 SPECIAL_BLOCKS |
   | `06`-status-allies | 新異常狀態 kind、傭兵、召喚 | 戰鬥機制 / 傭兵 / 帶寵物 |
   | `07`-`08` | 施法、裝備規則 | 職業魔法 / 裝備 |
   | `10`-ui-tabs | 物品說明產生器(buildItemDescHTML)、遺物說明 | 裝備(自動) / 遺物顯示 |
   | `11`-world-map | 地圖/領域 | 地圖 |
   | `12`-npc-quests | 任務/試煉/兌換、倉庫、收集冊 | 任務 / 掉落來源 / 卡片·裝備圖鑑 |
   | `13`-shop-save | 商店、存檔、遊戲模式(一般/經典/傳統) | 戰鬥機制(模式) / 卡片·裝備圖鑑(共用桶) |
   | `14`-craft-pandora | 製作配方、潘朵拉 | 製作 |
   | `15`-`16`、`18` | 卡片/裝備/道具收集(掉落、積分、共用、加成) | 卡片 / 裝備·道具圖鑑 |
   | `21`-relic-book | 遺物圖鑑 | 遺物相關頁 |
   | `22`-pets、`23`-summons | 寵物/召喚 | 帶寵物 |
   | `24`-pandora-relic-market | 遺物市場/流浪玩家收購 | 相關頁(必要時新開) |

4. **補內容(分自動 / 手動)**
   - **自動同步的**(`MASTERY_DATA`、`DB.skills`、`DB.items`、掉落表、`buildItemDescHTML`)通常不用改。
   - **手動維護的**才要補:`WEAPON_TRAITS`/`SETS`/`ENHANCE_SECTIONS`/`LOAD_SECTIONS`/`SHERINE_SECTIONS`/`PLEDGE_SECTIONS`/`TOWER_SECTIONS`/`QUEST_BY_CLASS`/`QUEST_COMMON`/`MAGIC_FACT`(職業魔法「實際數據」金框,在 `afk-wiki.js`)。
   - **⭐ 全域條件式掉落**(`if(條件) gainItem`,不在任一怪 MOB_DROPS)→ 補進 `afk-dex.js` 的 `SPECIAL_BLOCKS`(否則掉落查詢搜不到,聖地遺物踩過)。
   - **⭐ 新掉落表 / 客製製作 / 純兌換成品** → 比對原作 `_auditMobDrops` 讀哪些表照抄進 `buildIndexes`(表數以它為權威,別信文件裡的張數);客製製作(如 `DEMONKING_RECIPES`/`LUMIEL_RECIPES`)補進 `buildCraftIndex`+`renderCraft`;純兌換補 `afk-extradata.js` 的 `AFK_EXTRA.itemAcquire[id].short`。
   - **⭐ 翻譯**:渲染結果出現連續英文(HP/MP/BOSS/Lv 除外)就是漏翻 → 補對應表(`STATUS_LABEL`/`STAT_LABEL`/`AFK_EXTRA.mapName`;地圖漏翻 smoke 會擋)。
   - 內容鐵則:表格優先、用程式實際數據/公式(別抄遊戲說明文字)、白話零術語、AC 用負值、不要 changelog 語氣、不要表格下方散文重述、掉率把四個倍率一次講完。

5. **每動一頁就 Playwright 無頭實測該頁**:數據對、無漏翻英文、無 raw key(`sk_`/地圖 id)、無 JS error;關鍵數字用 `page.evaluate` 直接呼叫遊戲函式對。

6. **收尾**
   - `node scripts/stamp-code-versions.mjs`(`?v=` 自動對齊,含 afk-*.js)+ `node scripts/stamp-sw-version.mjs`(或直接跑 `/prepush`)。
   - 更新 `wiki-checkpoint.json`:`reconciledUpstreamCommit`=TARGET 完整 sha、`reconciledAt`=台灣時間(git-bash 用 `date -u -d '+8 hours'`),note 寫「逐檔對過、動了哪些頁」,跟改動一起 commit。
