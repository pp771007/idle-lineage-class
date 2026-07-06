---
name: update-wiki
description: 放置天堂小百科/掉落查詢的更新 SOP — diff 驅動、逐檔逐頁機械式對照原作者改動，補進 afk-wiki.js / afk-dex.js / afk-extradata.js，測過再更新 checkpoint。當使用者說「更新小百科」「同步小百科」「補小百科內容」或 /update-wiki 時使用。
disable-model-invocation: true
---

# /update-wiki — 小百科更新 SOP

對應 CLAUDE.md「📚 小百科維護準則」。**這是 diff 驅動、機械式逐項對照的流程，絕不可憑印象判斷「前面做過了」就跳步**(踩過漏整個模式)。

## 鐵則(動手前先記住)

- 🔴 **先 `git fetch origin && git pull --rebase origin main`** 才動手。每小時自動同步會在背景推作者新版，不 pull 會拿舊的比、漏掉剛進來的改版。
- 🔴 **diff 要整段逐項勾過**，即使覺得做過了也要看完。
- 🔴 **diff 不只看「新增的資料定義」，更要看「既有公式/機制被改」**——機制改動不會以新 `sk_`/`item` 出現，純掃新增一定漏。重點讀 `js/02-stats`、`js/04-combat`、`js/01-drops`、`js/05-kill` 裡**被修改的成對 `-`/`+` 行**。
- 🔴 **同一主題的 wiki 內容可能同時存在兩處：「資料陣列」(如 `COMBAT_SECTIONS`) 和「自寫 render 函式」(如 `renderMode` 自己 inline 建表、有自己的 `note`/表格、不吃任何 sections 陣列)。改了 grep 命中的那處 ≠ 改完。** 判準：改完**一定要 render 實測那一頁**(步驟 5)看畫面實際輸出，不能只靠 Edit 成功就當完成(踩過 2026-06-29:模式四組合只改了 `COMBAT_SECTIONS` 的卡、漏了獨立的 `renderMode` 頁,靠實測才抓到)。

## 步驟

1. **同步 + 取錨點**
   - `git fetch origin && git pull --rebase origin main`
   - 讀 `wiki-checkpoint.json` 的 `reconciledIndexCommit` 當 diff 起點(別用 git log 猜)。

2. **列出所有變動的檔(不挑)**
   - `git diff <reconciledIndexCommit> HEAD --stat -- js/ css/`
   - 清單上每個有變的檔都要讀，不可只挑「看起來有新東西」的。

3. **逐檔讀完整 diff，照「檔 → 負責頁」對照表歸位**(`git diff <commit> HEAD -- js/<檔>`，新增的 `+` 與修改的 `-`/`+` 成對都讀):

   | 改到的檔 | 看什麼 | 對應頁 / dex |
   |---|---|---|
   | `00-data` | 新 技能/物品/套裝/武器/地圖 | 職業魔法·裝備(自動) / 套裝 SETS(手動) / 掉落查詢 |
   | `01-drops` | 掉率、世界模式(席琳一般/瘋狂)、恩賜 | 席琳 / 掉落查詢 / 戰鬥機制 |
   | `02-stats` | 屬性/衍生值公式、buff、封頂 | 能力值 / 技能效果 |
   | `03`-`04` combat | 傷害公式、命中、武器特效 proc、強化倍率、異常狀態 | 戰鬥機制 / 武器特性 / 強化 |
   | `05`-kill | 條件式掉落(`if … gainItem`)、經驗/升級 | 掉落查詢 SPECIAL_BLOCKS |
   | `06`-status-allies | 新異常狀態 kind、傭兵、召喚 | 戰鬥機制 / 傭兵 / 帶寵物 |
   | `07`-`08` | 施法、裝備規則 | 職業魔法 / 裝備 |
   | `11`-world-map | 地圖/領域 | 地圖 |
   | `12`-npc-quests | 任務/試煉/兌換、倉庫、收集冊 | 任務 / 掉落來源 / 卡片·裝備圖鑑 |
   | `13`-shop-save | 商店、存檔、遊戲模式(一般/經典/傳統) | 戰鬥機制(模式) / 卡片·裝備圖鑑(共用桶) |
   | `14`-craft-pandora | 製作配方 | 製作 |
   | `15`-`16` | 卡片/裝備收集(掉落、積分、共用、加成) | 卡片 / 裝備圖鑑 |

4. **補內容(分自動 / 手動)**
   - **自動同步的**(`MASTERY_DATA`、`DB.skills`、`DB.items`、五張掉落表)通常不用改。
   - **手動維護的**才要補：`WEAPON_TRAITS`/`SETS`/`ENHANCE_SECTIONS`/`LOAD_SECTIONS`/`SHERINE_SECTIONS`/`PLEDGE_SECTIONS`/`TOWER_SECTIONS`/`QUEST_BY_CLASS`/`QUEST_COMMON`/`MAGIC_FACT`（職業魔法「實際數據」金框，在 `afk-wiki.js`）。
   - **⭐ 全域條件式掉落**(`if(條件) gainItem`，不在任一怪 MOB_DROPS)→ 補進 `afk-dex.js` 的 `SPECIAL_BLOCKS`(否則掉落查詢搜不到，聖地遺物踩過)。
   - **⭐ 新掉落表 / 客製製作 / 純兌換成品**→ 比對原作 `_auditMobDrops` 讀哪些表照抄進 `buildIndexes`；客製製作(如 `DEMONKING_RECIPES`)補進 `buildCraftIndex`+`renderCraft`；純兌換補 `afk-extradata.js` 的 `AFK_EXTRA.itemAcquire[id].short`。
   - **⭐ 翻譯**：渲染結果出現連續英文(HP/MP/BOSS/Lv 除外)就是漏翻 → 補對應表(`STATUS_LABEL`/`STAT_LABEL`/`AFK_EXTRA.mapName`)。
   - 內容鐵則：表格優先、用程式實際數據/公式(別抄遊戲說明文字)、白話零術語、AC 用負值、不要 changelog 語氣、不要表格下方散文重述。

5. **每動一頁就 Playwright 無頭實測該頁**：數據對、無漏翻英文、無 raw key(`sk_`/地圖 id)、無 JS error。

6. **收尾**
   - bump 動到的外掛 `?v=`(動到 `afk-dex.js` 也要)+ `node scripts/stamp-sw-version.mjs`(或直接跑 `/prepush`)。
   - 更新 `wiki-checkpoint.json`：`reconciledIndexCommit`=`git rev-parse HEAD`、`reconciledIndexBlob`=`git rev-parse HEAD:index.html`、`reconciledAt`=台灣時間，note 寫「逐檔對過、動了哪些頁」，跟改動一起 commit。
