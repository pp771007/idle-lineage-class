# 放置天堂（加掛版）— 專案規則

## 📇 細節在哪(需要時再讀,別憑印象動手)

| 要做的事 | 先讀 |
|---|---|
| 查「有哪些外掛 / 哪些核心補丁」 | `docs/plugins.md` |
| 改離線掛機(afk-offline) | `docs/offline.md` ＋ afk-offline.js 檔頭註解 |
| 玩家回報「離線結算跑很久」 | 跑 `node scripts/profile-offline.mjs --file <.testdata 檔> --slot N [--hot]`(拿真實存檔實測,別用新角色猜) |
| 想加速離線結算 | `docs/offline-batch-settle.md`(**草稿·尚未實作**;開頭補註說明為什麼優先順序被降低) |
| 查「手機耗電/發熱」熱點、做省電優化 | `docs/perf-battery.md`(熱點清單＋方案排序;第一批與「關閉光暈與濾鏡」已實作,其餘待議) |
| 做「存檔搬家 / 跨裝置轉移」 | `docs/save-transfer.md`(**評估·尚未實作**;整包 localStorage 的打包/還原做法、五種方案的優缺點) |
| 改 sw.js / 快取 / PWA | `docs/sw-pwa.md` |
| 改手機或平板版面、覆寫上游手機樣式 | `docs/mobile.md` |
| ~~同步上游~~ | **2026-10-11 起已停止同步**(見下方「專案性質」);`/sync-upstream` 與 CI 不要再用 |
| 準備 push | 跑 `/prepush`;發版跑 `/release` |

## 專案性質與架構（2026-10-11 起・自有分支，不再同步原作者）

- 網頁放置遊戲。遊戲本體由原作者(巴哈姆特 秋玥)製作,原版:**https://shines871.github.io/idle-lineage-class/**;本站(加掛版):https://pp771007.github.io/idle-lineage-class/。
- **2026-10-11 起不再同步原作者**:最後一次同步的上游 commit 記在 `upstream-checkpoint.json`(`syncedUpstreamCommit`,原版 v3.8.34)。之後原作者的更新**不會自動進來**,要的話只能人工挑著移植。
  - 已停用:`.github/workflows/sync-upstream.yml`(job 設 `if: false`)、`core-file-guard` hook、prepush 的「核心補丁就位」檢查。**不要再跑 `/sync-upstream` 或 `scripts/sync-upstream.mjs`**——它會用原作者的檔案整包蓋掉直接改過的核心檔。
- **架構**:核心(`js/NN-*.js`、`css/*`、`index.html`、`assets/`、`public/`)＋外掛層(根目錄 `afk-*.js`、`sw.js`)。核心**可以直接改**;既有外掛照舊運作。
- `scripts/apply-core-patches.mjs` 的 13 組錨點補丁已經套在核心裡,之後不必再跑(直接改核心即可,不用再寫新補丁)。

## ⭐ 修改原則

**改遊戲行為,選最直接、最好維護的寫法:**

1. **直接改核心檔**(`js/NN-*.js`、`css/*`、`index.html`)是正常做法——改寫死的數值、改函式本體、改版面,都直接動原檔。
2. **外掛仍然適合「可開關」的功能**:要讓玩家能在外掛面板關掉的(例如 afk-lmui 天堂M介面、隱藏職業/遺物/黑市),維持寫成 `afk-*.js`。
3. **index.html**:可以直接改。新增外掛的 `<script>` 行加進 index.html,`scripts/afk-plugin-block.html` 也同步補一行(載入順序以那份為準:afk-toggles 最先、afk-skin 最後)。
4. **改到外掛已經包住的核心函式時**:先 grep 有哪些 `afk-*.js` 包了它(`window.<函式名> = function`),確認外掛的假設還成立。
5. `assets/`、`public/` 現在可以放我們自己的檔案(已經沒有 `rsync --delete` 同步會刪它)。

**外掛開關(afk-toggles.js,載入順序第一)**:每支外掛可被單獨關掉——某支壞掉時關掉它就能用原版繼續玩(逃生門)。
⚠️ 2026-10-15 起**玩家沒有任何入口打開開關面板**(按鈕與 `?plugins`/`#plugins` 網址都拿掉,站長要求不要有任何連結能打開;只剩站長主控台 `AFK_TOGGLES.openPanel()`)→ 不要叫玩家去外掛面板關東西;新外掛壞了只能改程式碼修,上線前要測夠。契約:
- 純新增型外掛檔頭 `if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('<id>')) return;`;包核心函式型在 wrapper 內每次先問 `enabled()`,關掉就透明放行原函式。
- 載入時 `AFK_TOGGLES.register({id,name,desc,group,def})` 進開關面板。讀不到 AFK_TOGGLES 一律當開啟。afk-toggles 自己不可被關、不依賴任何外掛。
- **子選項**:`register({..., parent:'<父外掛id>'})` → 面板上縮排排在父項底下,且**父項關掉時 `enabled(子)` 一律回 false**(子項自己不必再問父項)。
  判準:**只有「父關掉＝子真的失效」才做父子**(資料源或入口依賴,如 offline→離線紀錄/選角掛機資訊、storage→設定選單裡的工具);
  「看起來相關」不算——手機那批(battlehud/mapbar/nozoom…)刻意各自判手機、不讀 `body.m-mobile`,掛成 mobile 的子項等於把下面那條死結耦合綁回去。

**🚨 不可停用的基礎設施,不能依賴「可被關掉的外掛」提供的東西**:逃生門(afk-toggles)、「讓開橫幅」這種所有裝置/所有外掛狀態都成立的需求,一旦去讀某支可關外掛設的變數或 class(`--orig-bar-h`、`body.m-mobile`),玩家把那支關掉就壞——最慘是連「把外掛開回來」的入口都被橫幅蓋住(橫幅 z-index 是 int 上限,壓得過任何外掛),形成無解死結。故橫幅讓位整組已抽成 `afk-banner.js`(無開關、載入序僅次 afk-toggles),afk-mobile 只留手機幾何專屬規則。兩條判準:
- **寫 `var(--某變數)` 或讀 `body.某class` 前先問「這誰設的?那支能不能被關?」** 能被關就要自己有保底(自己量一次/用同一組規則自己判)。
- **要寫進 afk-mobile 的規則,先問「桌機/平板關掉手機版面時還需不需要它?」** 需要就不屬於那支。

⚠️ 這類「A 外掛量測、B 外掛使用」的耦合在全開狀態永遠測得過 → smoke **第三輪**(手機+關掉 afk-mobile)驗逃生門可點、入口可見、`--orig-bar-h` 與 `#app-stage`/`#creation-screen` 仍讓開假橫幅;新增這類耦合時順手擴充該輪。

**外掛通用守則**:
- 優雅降級:需要的全域函式/元素不存在就 `console.warn` 後安靜停用,不可弄壞遊戲。
- **🚨 絕不可盲呼叫「會寫入玩家存檔」的原作函式**(踩過:主選單狀態呼叫 `saveGame()` 把玩家第 1 格蓋成 Lv.1 null、無備份可救)。要存檔資料**直接讀 `localStorage`**(`lineage_idle_save_<n>`);非寫不可時先驗 `player && player.cls`。任何會動玩家 localStorage 的操作,都要假設可能在「未載入角色/currentSlot 不是預期那格」被觸發。
- **🚨 外掛要存資料時,先問「這東西壞掉會不會影響遊戲」——答案決定能用哪個儲存**:
  - **會影響遊戲的(存檔、設定、任何遊戲行為讀得到的)→ 只能 `localStorage`**。**不少玩家是把 repo 下載下來直接開 `index.html` 玩(`file://`)**,而 `file://` 是 opaque origin、儲存政策各瀏覽器與版本都不同(本機 Chromium 實測 `file://` 下 IndexedDB 讀寫得了,**但這正是不能拿來賭的理由——一台可用不代表玩家那台可用**)。
  - **純診斷/取證、壞掉也不影響遊戲的 → 才可以放 IndexedDB**,而且**必須能在完全不可用時安靜停用**(open 包 try/catch＋`onerror` 一律轉成「這功能關掉」,絕不往上拋)。⚠️ 在效能敏感的裝置(iOS)上,**為了查問題而常駐的背景寫入本身就是新變因**(afk-blackbox 踩過,已整支移除)——量測工具要能一鍵拿掉,最好只在玩家主動開診斷時才跑。
  - 反過來也成立:**這類附屬資料不可以去佔 `localStorage`**——那 5MB 是存檔的地盤、本來就吃緊(`afk-quotawarn` 在盯 80% 門檻),多佔一點就可能害玩家存檔寫不進去。
  - 判準:**「file:// 打得開嗎」和「佔不佔存檔空間」兩條要一起過**;過不了就別存,改成算出來即用。
- 外掛插 DOM 錨「穩定容器 id」,不要錨父子關係——錨不到只會安靜消失,smoke 驗不到,改過首頁版面要人工掃。
- 覆寫「會被 `.hidden` 切換」的容器 display 時一律加 `:not(.hidden)`,否則畫面關不掉(踩過)。
- 覆寫上游「寫在 media query 裡」的樣式、或做手機/平板專屬元素 → 先讀 `docs/mobile.md`(兩套版面、同一條 MQ、橫幅讓位三條規則,都有 smoke 把關)。
- 外掛自建遊戲物件(如木人場 spawn 怪)欄位要對齊核心 `spawnMob`,缺欄位(如 `_born`)會整個系統安靜失效。
- 上游改版後外掛的「字串/DOM 結構假設」可能失效——同步後 smoke＋人工掃一輪首頁/手機版面。
- **🚨 搬運/備份/轉存類的東西,不可以「認得」被搬的內容**:正確性來自原樣進、原樣出。任何看得懂內容的判斷(key 名格式、欄位長度、「這是不是合法存檔」)都是對上游格式的假設,作者改個名字就把**所有合法檔案擋在門外**,而且是在玩家換裝置時才爆。要驗只能驗**自己寫進檔案的欄位**(format / schema / 項目數),不可以驗遊戲的東西。(afk-fullsave 踩過:`/^lineage_idle_save_\d+$/` 當「至少要有一個角色」的閘門。)

## 🚨 玩家看得到的字:一句都不能是廢話

判準只有一條:**這句話會讓玩家做出不同的動作嗎?** 不會就刪。

- 刪:容量、項目數、key 名、內部機制、設計理由(「刻意不挑是因為…」)——那些是註解該寫的,不是畫面該有的
- 刪:我們其實不知道的事(檔案會存到哪、能用什麼 App 傳)——寫了就是誤導(Android 下載資料夾還有 0 byte 的雷)
- 刪:在按鈕旁邊解釋這顆按鈕在幹嘛(按鈕名稱取好就夠)
- 留:他現在要做什麼決定、按下去會發生什麼、出事了該怎麼辦

版面預算(超過就是寫太多):面板說明 ≤1 句、危險確認 ≤2 句(後果+怎麼避免)、成功/失敗提示 ≤1 句。錯誤訊息只寫「怎麼回事+該怎麼做」,技術細節走 `console.warn`。

**寫的順序:先把按鈕文字定下來,再問「還缺什麼玩家非知道不可」**——反過來先寫說明段落,就會不自覺把設計理由倒進畫面。自我檢查:每一句單獨拿出來問「刪掉會怎樣」,答不出具體後果就刪。

> 同一個精神在別處已經各寫過一次(發版說明「只寫玩家有感的、白話」),但它綁死在發版場合 → 寫外掛 UI 時一條都不適用,才會失守。這節是通則,涵蓋所有玩家看得到的字。

## 🚨 push 前(→ 跑 `/prepush`)

- **本 repo 的 `git push` 一定要使用者親口說了才能做**(全域那條「push 不必再問」在這裡不適用):使用者開口後,在指令尾端加註解 `#user-approved` 才放行,**沒得到同意不可以自己加**。已由 `prepush-guard.mjs` 硬擋(Bash / PowerShell 兩個工具都收,實測過)。「誰決定上線」與「內容夠不夠格上線」是兩層,各擋各的——有你同意但 stamp 沒跑,照樣擋。
- 完整步驟在 skill 裡,這裡只留一條原則:**commit 階段不 bump/stamp**——那是 push/發版流程的事(功能做完就 commit,等說要 push 才跑 /prepush 一次處理)。
- 其餘不必自己記:`?v=` 沒對齊內容、核心補丁掉了、sw.js 的 `CODE_VERSION` 過時、rebase 衝突標記殘留、afk-*.js 沒在 index.html 引用、音檔索引沒重產、**外掛錨到已不存在的 DOM id**(`scripts/check-dom-ids.mjs`;同步上游流程尾端也會跑)、**CSS 用 `:has()` 看 `.hidden`**(`scripts/check-css-has.mjs`;會讓手機戰鬥整頁重算樣式而卡頓) —— `.claude/hooks/prepush-guard.mjs` 會在 `git push` 前 exit 2 硬擋並印出要跑的指令。(`?v=` 漏 bump 的後果是**新舊混搭**:玩家快取時序決定,低機率無法重現,踩過整晚收益歸零——所以才做成硬擋。)

## 暫存 / 測試

- **`.testdata/` 有使用者真實存檔(gitignore,不進版控、不要清)**——玩家回報跟「資料量/等級/裝備/倉庫/離線」有關就先用它測,新角色重現不出來會誤判「沒問題」。灌法:`_lzSet('lineage_idle_save_1', ...)` 後 `loadGame()`(倉庫另拆)。
- 一次性腳本/截圖放 `.scratch/`(gitignore)。Playwright 一律 headless。
- **會寫玩家存檔的功能,上線前必測「真實角色→操作→比對相關 key 沒被改壞」**,且要涵蓋真實觸發狀態(如主選單=未載入角色)。
- **倉庫裡超過強化上限的裝備不會被夾,一取出到背包就被夾**——核心 `sanitizeState`(js/01)掛在 saveGame 前/loadGame 後,**只掃 `player.inv`/`player.eq`,不掃倉庫**。所以倉庫躺著 +20 武器,取出後變 +15、倉庫剩下的同款還是 +20。**這是上游既有行為,不是搬移功能的 bug**;玩家回報「拿出來就掉強化」照實說明即可。
  ⚠️ 連帶:**驗搬移/轉移類功能不可以直接拿 `itemSig` 當守恆比對的鍵**——sig 含 en,en 一被夾 sig 就變,比對結果是「+20 的不見了、多出 +15 的」＝看起來像搬丟東西的**假紅**(踩過,先去追外掛才發現是核心夾的)。比對前先照 `sanitizeState` 的 clampEn 把 en 夾過再組鍵(只夾 wpn/arm/acc),來源與目的地兩側同樣正規化才對稱。
- 量效能每輪**重新導航**,不要原地重複 `loadGame()`(計時器/監聽疊加,記憶體 17→97MB、tick 慢 9 倍,數字全污染)。
- Tailwind 是預建置 css:JS 動態拼「沒出現過的 class」會安靜失效——先 grep `css/tailwind-built.css` 有沒有,沒有就寫自己的具名 class。

## Git / GitHub

- commit 不帶 Claude 署名(全域規則);訊息純變更描述。
- **commit 節奏**:一個功能一個 commit;不主動 push;bump/stamp 留給 push 時的 /prepush。
- `git pull --rebase` 衝突:產生檔(`sw.js`/`version.json`/manifest)衝突→手動刪標記留一版→重跑 stamp 腳本→continue;**stamp 不會清衝突標記也不會碰 index.html**,盲目 `git add -A` 會把標記 commit 進去(踩過兩次,sw.js 壞了肉眼看不出;現已有 prepush-guard hook 兜底)。
- 台灣時間戳:git-bash 的 `TZ=` 不生效,用 `date -u -d '+8 hours' +%Y%m%d-%H%M`。
- 版本/發版:`version.json` 的 `app` 是加掛版 semver(發版才 bump;stamp 會保留該欄位);發版跑 `/release` skill,更新說明只寫玩家有感的、白話。

## 🔁 修完 bug 要不要寫進文件:三題都「是」才寫,寫前先給使用者看草稿

1. 還會再發生嗎(成因仍在、可推廣)?2. 自動檢查擋不掉嗎(smoke/hook/stamp 已擋的去補檢查不補文件)?3. 下次真的想不起來嗎?

寫法:標題一句話結論,內文只寫「為什麼會中+判準/怎麼避」,不寫案發經過;能併進現有條目就別開新段。**寫進最貼近的那份**(離線→`docs/offline.md`、手機→`docs/mobile.md`…),只有「動任何一行都適用」的鐵則才寫本檔。
