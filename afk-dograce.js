// ===== 奇岩賽狗場（賭狗）核心 =====
// 核心哲學：整場賽事用 Date.now()（UTC epoch）固化 — raceId = floor(now/CYCLE_MS)，
// 用 raceId 當種子的 PRNG 產生「這場的狗群狀態、賠率、逐格位置、名次、贏家」。
// 所有人同一真實時間看到同一場、同樣結果；中途進場也用同一組純函式算到「現在該在的位置」。
// 下注＝押一筆金額（金幣或龍之鑽石，共用同一組賠率）；開獎即自動入袋，紀錄只留「押多少·賠率·贏多少」。
// 紀錄存 player.raceTickets。舊存檔的票以「張」記（count），沒有 cur/stake 欄位 → 一律當金幣、
//   每張 LEGACY_TICKET_PRICE 換算，之前沒領的中獎票會在下次結算時自動補入袋。
// ⚠ 龍鑽存在潘朵拉那份共用資料（跨角色、與角色存檔不同份）→ 入袋後若存檔沒成功必須把鑽石退回去，
//   否則紀錄沒被標記卻已經入袋，下次結算又入袋一次＝無限刷鑽。金幣與紀錄同一份存檔、同進同退，不必退款。
// 檔名刻意不用數字開頭（比照 js/offline.js），避免日後手動合併原版新增 js/2x-*.js 撞名。
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('dograce')) return;   // 🎚️ 外掛開關

    // ---- 樣式(自 main 的 css/floating-ui.css 抽出、外掛自帶注入:此分支 css/ 還原上游後賽狗場樣式遺失,
    //      球變成無定位的裸元素貼在左上角被橫幅蓋住=玩家「看不到入口」。自帶樣式,同步上游 css 也不會再丟) ----
    (function () { if (document.getElementById('afk-dograce-css')) return; var st = document.createElement('style'); st.id = 'afk-dograce-css'; st.textContent = "\n/* ===== 🐕 奇岩賽狗場浮動視窗 / 縮球 / U 型賽道 ===== */\n/* 可用高度＝畫面 - 頂端橫幅 - 底部導覽,公式與 afk-mobile 一致。\n   ⚠ 一定要 dvh:手機瀏覽器的 100vh 是「工具列收起時」的高度,比實際看得到的還大 → 底部會被導覽吃掉,\n     而且只在真機上才看得出來(桌機/模擬器的視窗高度固定,vh 跟 dvh 一樣大,測不出來)。\n   前一行 vh 版是給不認得 dvh 的舊瀏覽器墊底(不留的話整條 height 會失效、視窗塌成一條)。\n   --m-nav-h 沒人設時 fallback 0 剛好正確:那代表 afk-mobile 關著、根本沒有底部導覽。 */\n.dograce-win{position:fixed;z-index:74;width:min(94vw,430px);display:flex;flex-direction:column;\n  height:min(calc((100vh - var(--orig-bar-h,0px) - var(--m-nav-h,0px)) * .92),760px);\n  height:min(calc((100dvh - var(--orig-bar-h,0px) - var(--m-nav-h,0px)) * .92),760px);\n  border:2px solid #8b6a2f;border-radius:12px;background:#0f1621f5;box-shadow:0 18px 40px #000c;color:#e2e8f0;\n  user-select:none;touch-action:none;font-family:Arial,\"Microsoft JhengHei\",sans-serif}\n.dograce-win.is-min{height:auto}\n.dograce-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:6px;padding:8px 10px;cursor:grab;\n  color:#fff3c4;border-bottom:1px solid #8b6a2f;border-radius:10px 10px 0 0;\n  background:linear-gradient(135deg,#3d2b0e,#9b7629,#5f4517,#b28c38,#34240d)}\n.dograce-title{font-weight:900;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.dograce-phase{font-weight:600;font-size:12px;color:#fde68a}\n.dograce-headbtns{display:flex;gap:4px;flex:0 0 auto}\n.dograce-hb{width:26px;height:26px;border:1px solid #d9bd70;border-radius:6px;background:#151b25;color:#fff3cf;font-size:13px;line-height:1;cursor:pointer;padding:0}\n.dograce-hb:hover{background:#243040}\n.dograce-body{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}\n/* 分頁 */\n.dograce-tabs{flex:0 0 auto;display:flex;border-bottom:1px solid #33414d}\n.dograce-tab{flex:1;padding:8px 4px;background:#141c28;color:#94a3b8;border:0;border-right:1px solid #33414d;font-size:13px;font-weight:700;cursor:pointer}\n.dograce-tab:last-child{border-right:0}\n.dograce-tab.is-active{background:#1e2b3d;color:#fde68a;box-shadow:inset 0 -2px 0 #b28c38}\n.dograce-panel{flex:1;min-height:0;position:relative;overflow:hidden}\n/* 大 U 型賽道 */\n.dograce-trackview{position:relative;width:100%;height:100%;background:radial-gradient(ellipse at 50% 12%,#14241a,#0a1109);overflow:hidden}\n#dograce-svg{width:100%;height:100%;display:block}\n.dograce-band{fill:#1f3324;stroke:#3c5a3f;stroke-width:1.5;opacity:.95}\n.dograce-laneline{fill:none;stroke:#ffffff26;stroke-width:.8;stroke-dasharray:3 3}\n.dograce-line{stroke:#e2e8f0;stroke-width:3;stroke-dasharray:3 2;opacity:.85}\n.dograce-finish{stroke:#fbbf24;opacity:1;stroke-dasharray:none;stroke-width:4}\n.dograce-dogs{position:absolute;inset:0;pointer-events:none}\n.dograce-dog{position:absolute;transform:translate(-50%,-66%);display:flex;flex-direction:column;align-items:center;transition:left .08s linear,top .08s linear}\n.dograce-dog img{width:44px;height:44px;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 3px 3px #000b)}\n.dograce-plate{font-size:10px;font-weight:700;line-height:1;color:#f8fafc;background:#0b1220dd;border:1px solid;border-radius:4px;padding:1px 4px;margin-bottom:2px;white-space:nowrap;text-shadow:0 1px 2px #000}\n.dograce-plate b{display:inline-block;color:#0b1220;border-radius:3px;padding:0 3px;margin-right:2px;font-weight:900}\n.dograce-overlay{position:absolute;left:0;right:0;top:0;z-index:5;text-align:center;pointer-events:none;padding:6px 8px}\n/* 終點在賽道上方,所以獲勝框改貼下緣(U 型彎道以下本來就是空的),不擋衝線畫面 */\n.dograce-overlay.is-result{top:auto;bottom:10px;z-index:500}\n.dograce-ov-top{display:inline-block;font-size:14px;font-weight:800;color:#fde68a;text-shadow:0 1px 3px #000,0 0 6px #000;background:#0b1220d9;border-radius:7px;padding:3px 9px}\n.dograce-ov-panel{display:inline-block;background:#0b1220e6;border:1px solid #8b6a2f;border-radius:9px;padding:5px 11px}\n.dograce-ov-mid{margin-top:38%;font-size:22px;font-weight:900;color:#fbbf24;text-shadow:0 2px 6px #000}\n.dograce-ov-win{font-size:20px;font-weight:900;color:#fff;text-shadow:0 2px 6px #000,0 0 10px #000}\n.dograce-ov-rank{margin-top:3px;font-size:13px;font-weight:700;color:#e2e8f0;text-shadow:0 1px 3px #000}\n.dograce-ov-rank span{margin:0 5px}\n/* 下注 / 紀錄 內容區可捲動 */\n.dograce-betwrap,.dograce-tkwrap{position:absolute;inset:0;overflow-y:auto;padding:9px;touch-action:manipulation;background:#0f1621}\n.dograce-prev{margin:2px 0 8px;padding:5px 8px;border:1px solid #33414d;border-radius:6px;background:#141c28;font-size:12px;color:#cbd5e1}\n.dograce-betbar{display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:13px;font-weight:800;color:#fde68a}\n.dograce-cur{flex:1;min-width:0;padding:5px 6px;border:1px solid #475569;border-radius:6px;background:#141c28;color:#cbd5e1;font-size:12.5px;font-weight:800;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.dograce-cur.is-on{border-color:#d9bd70;background:#2a2410;color:#fde68a}\n.dograce-chips{display:flex;align-items:center;gap:3px;margin-bottom:7px;font-size:11px;color:#94a3b8;font-weight:600}\n.dograce-chip{min-width:24px;height:22px;border:1px solid #475569;border-radius:5px;background:#1e293b;color:#e2e8f0;font-size:11px;cursor:pointer;padding:0 4px}\n.dograce-chip.is-on{background:#b28c38;color:#0b1220;border-color:#d9bd70;font-weight:800}\n.dograce-resultbar{margin-bottom:6px;padding:5px 7px;border:1px solid #475569;border-radius:6px;background:#141c28;font-size:12px;line-height:1.5}\n.dograce-resultbar b{margin-right:4px}\n.dograce-photo{color:#fca5a5;font-weight:800}\n.dograce-doglist{display:flex;flex-direction:column;gap:4px}\n.dograce-dogcard{display:flex;align-items:center;gap:6px;padding:5px 6px;border:1px solid #33414d;border-radius:7px;background:#161f2c}\n.dograce-num{flex:0 0 auto;width:20px;height:20px;border-radius:5px;color:#0b1220;font-weight:900;font-size:12px;display:flex;align-items:center;justify-content:center}\n.dograce-name{flex:1;min-width:0;font-size:13px;font-weight:700;line-height:1.15;display:flex;flex-direction:column}\n.dograce-name small{font-size:10px;font-weight:400;color:#94a3b8}\n.dograce-odds{flex:0 0 auto;font-size:13px;font-weight:800;color:#fbbf24;text-align:right}\n.dograce-odds small{display:block;font-size:9.5px;font-weight:600;color:#94a3b8}\n.dograce-mine{display:inline-block;font-size:10px;color:#6ee7b7;border:1px solid #10b981;border-radius:4px;padding:0 4px}\n.dograce-dry{display:inline-block;font-size:10px;color:#fcd34d;border:1px solid #b45309;border-radius:4px;padding:0 4px}\n.dograce-betbtn{flex:0 0 auto;padding:4px 9px;border:1px solid #16a34a;border-radius:6px;background:linear-gradient(135deg,#166534,#22c55e);color:#eafff1;font-weight:800;font-size:12px;cursor:pointer}\n.dograce-betbtn:hover{filter:brightness(1.12)}\n.dograce-lock{flex:0 0 auto;color:#64748b;width:44px;text-align:center}\n.dograce-foot{margin-top:7px;font-size:10px;color:#64748b;text-align:center}\n/* 紀錄面板 */\n.dograce-tkhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-size:13px;font-weight:800;color:#fde68a}\n.dograce-clear{border:1px solid #475569;border-radius:5px;background:#1e293b;color:#cbd5e1;font-size:10px;padding:3px 6px;cursor:pointer}\n.dograce-empty{padding:22px 8px;text-align:center;color:#64748b;font-size:12px}\n.dograce-tklist{display:flex;flex-direction:column;gap:5px}\n.dograce-tk{display:grid;grid-template-columns:1fr auto;grid-template-areas:\"main right\" \"sub right\";gap:1px 8px;padding:6px 8px;border:1px solid #33414d;border-left-width:4px;border-radius:6px;background:#161f2c}\n.dograce-tk.pend{border-left-color:#64748b}\n.dograce-tk.win{border-left-color:#fbbf24;background:#2a2410}\n.dograce-tk.lose{border-left-color:#7f1d1d;opacity:.75}\n.dograce-tk-main{grid-area:main;font-size:13px}\n.dograce-tk-odds{font-size:11px;color:#94a3b8}\n.dograce-tk-sub{grid-area:sub;font-size:10px;color:#64748b}\n.dograce-tk-right{grid-area:right;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:3px}\n.dograce-tk-badge{font-size:11px;font-weight:700}\n.dograce-tk-pay{font-size:11px;color:#6ee7b7;font-weight:700}\n/* 縮球 */\n.dograce-ball{position:fixed;z-index:74;width:56px;height:56px;border-radius:50%;border:2px solid #d9bd70;\n  background:radial-gradient(circle at 40% 35%,#3d2b0e,#0f1621);box-shadow:0 6px 16px #000b;color:#fde68a;\n  display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;touch-action:none;user-select:none}\n.dograce-ball-ico{font-size:20px;line-height:1}\n.dograce-ball-cd{font-size:10px;font-weight:800;line-height:1;margin-top:1px}\n/* 縮球階段色：一眼看出能不能押注 / 開賽倒數 */\n.dograce-ball.db-bet{border-color:#22c55e;box-shadow:0 6px 16px #000b,0 0 10px #22c55e88;color:#bbf7d0}\n.dograce-ball.db-parade{border-color:#f59e0b;box-shadow:0 6px 16px #000b,0 0 12px #f59e0bcc;color:#fde68a;animation:dograce-pulse 1s ease-in-out infinite}\n.dograce-ball.db-race{border-color:#ef4444;box-shadow:0 6px 16px #000b,0 0 14px #ef4444cc;color:#fecaca;animation:dograce-pulse .7s ease-in-out infinite}\n.dograce-ball.db-result{border-color:#d9bd70;box-shadow:0 6px 16px #000b,0 0 10px #d9bd7099;color:#fde68a}\n@keyframes dograce-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}\n@media(max-width:760px){\n  .dograce-win{width:96vw;\n    height:calc((100vh - var(--orig-bar-h,0px) - var(--m-nav-h,0px)) * .96);\n    height:calc((100dvh - var(--orig-bar-h,0px) - var(--m-nav-h,0px)) * .96)}\n  .dograce-dog img{width:50px;height:50px}\n  .dograce-plate{font-size:11px}\n}\n"; (document.head || document.documentElement).appendChild(st); })();

    // ---- 時間常數（一場 5 分鐘；全部具名，方便調節奏） ----
    var CYCLE_MS = 300000;      // 一場總長（5 分鐘）
    var BET_MS = 240000;        // 下注/看狀態 [0,4分)
    var PARADE_MS = 250000;     // 封盤入閘 [4分,4分10秒) → 10 秒
    var RACE_MS = 270000;       // 比賽 [4分10秒,4分30秒) → 20 秒
    // RESULT [4分30秒,5分) → 結算+等待下一場 30 秒
    var RACE_DUR = RACE_MS - PARADE_MS;   // 比賽動畫時長

    // ---- 經濟常數 ----
    var HOUSE_EDGE = 0.1;               // 莊家抽成（金幣、龍鑽共用同一組賠率）
    var LEGACY_TICKET_PRICE = 10000;    // 舊存檔「一張票」的面額，只用來換算舊紀錄
    var TICKET_KEEP = 40;               // 已結算紀錄的保留上限（未結算的不受限、永不自動清）
    var CUR_GOLD = 'gold', CUR_DIA = 'dia';
    var GOLD_CHIPS = [                  // 金幣籌碼（押注額）
        { v: 10000, label: '1萬' }, { v: 100000, label: '10萬' },
        { v: 1000000, label: '100萬' }, { v: 10000000, label: '1000萬' }
    ];
    var DIA_CHIPS = [                   // 龍鑽籌碼（顆）
        { v: 1, label: '1' }, { v: 5, label: '5' }, { v: 10, label: '10' }, { v: 50, label: '50' }
    ];

    // ---- 固定狗群（跨場固定身分；由強到弱＝賽道 1~8 號） ----
    var DOGS = [
        { name: '詹丕', form: '杜賓狗', color: '#ef4444', baseRating: 10.0, variance: 0.15 },
        { name: '杰侖', form: '狼', color: '#3b82f6', baseRating: 8.6, variance: 0.22 },
        { name: '卡丕尼', form: '柯利', color: '#22c55e', baseRating: 7.2, variance: 0.34 },
        { name: '強森', form: '牧羊犬', color: '#eab308', baseRating: 6.1, variance: 0.42 },
        { name: '摸索', form: '哈士奇', color: '#a855f7', baseRating: 5.2, variance: 0.52 },
        { name: '莫卡妮', form: '小獵犬', color: '#ec4899', baseRating: 4.1, variance: 0.70 },
        { name: '子彈', form: '狐狸', color: '#f97316', baseRating: 3.1, variance: 0.85 },
        { name: '快樂', form: '聖伯納犬', color: '#14b8a6', baseRating: 2.2, variance: 0.78 }
    ];
    var N_DOGS = DOGS.length;
    var STATES = [
        { label: '極佳', emoji: '🔥', mod: 2.4 },
        { label: '良好', emoji: '😊', mod: 1.1 },
        { label: '普通', emoji: '😐', mod: 0.0 },
        { label: '欠佳', emoji: '😰', mod: -1.2 },
        { label: '低迷', emoji: '🥶', mod: -2.6 }
    ];
    var STATE_PICK_W = [1, 2, 3, 2, 1];
    var TEMP = 3.0;   // 由「戰力」換算勝率的溫度：越大越接近均勢、冷門越容易出

    // 各狗的長期勝率（只看基礎實力、不含當日狀態）。用來把「連幾場沒贏才算異常」
    // 換算成每隻狗自己的標準——最弱的狗平均 38 場才贏一次，跟最強的用同一個場數門檻，
    // 它會永遠掛著「很久沒贏」的標記，那個提示就變成壁紙、沒有訊息量。
    var BASE_PROB = (function () {
        var w = [], s = 0, i;
        for (i = 0; i < DOGS.length; i++) { w.push(Math.exp(DOGS[i].baseRating / TEMP)); s += w[i]; }
        for (i = 0; i < w.length; i++) w[i] /= s;
        return w;
    })();

    // ---- 跑法劇本（每場抽一種；決定冠軍的加速曲線、二名怎麼追、冠亞終點差多少） ----
    //  wexp/sexp = 冠軍／二名的加速曲線：<1 前段就衝、>1 後段才爆。gap = 冠亞終點差距。
    var SCRIPTS = [
        { key: 'comeback', w: 32, wexp: [1.45, 1.75], sexp: [0.60, 0.80], gap: [0.010, 0.030] },   // 最後直道逆轉
        { key: 'nearmiss', w: 28, wexp: [0.95, 1.15], sexp: [1.50, 1.80], gap: [0.002, 0.008] },   // 追到剩一個鼻尖，惜敗
        { key: 'wire', w: 22, wexp: [0.60, 0.80], sexp: [1.35, 1.65], gap: [0.012, 0.038] },       // 冠軍一路領先、後面苦追
        { key: 'duel', w: 18, wexp: [0.95, 1.10], sexp: null, gap: [0.002, 0.006] }                // 兩隻全程咬住（二名曲線比照冠軍，不用 sexp）
    ];
    var MID_WOBBLE = 2.5;   // 三名以後的擺盪倍率（太大會變瞬移、太小就變成排隊跑完）
    var WOB_SKEW = 0.7;     // 擺盪包絡線的偏斜：<1 讓擺盪提早發生（開賽沒多久就在你追我趕，不是跑到中段才動）
    // 加速曲線混進一份等速成分。純 u^exp 在 exp<1 時是一路減速,終點前會慢到剩四成速度＝
    // 畫面上像停下來等後面追上(很怪)。混了等速之後速度只在 0.8~1.4 倍之間變化,
    // 「前段衝／後段爆」的相對關係還在,但不會有狗在原地空轉。
    var LINEAR_MIX = 0.45;
    var DROUGHT_FACTOR = 2.5;             // 連敗到「自己平均等待場數」的幾倍才算異常（各狗門檻不同）
    var DROUGHT_MIN_SHOW = 6;             // 再強的狗也要連敗到這個數才值得標
    var DROUGHT_MAX = 200;                // 回看上限（防呆，不會無止境往回算）
    var UPSET_ODDS = 15;                  // 冠軍賠率高過這個就算大爆冷

    // ---- 時鐘（可被 debug 覆寫，供測試強制階段） ----
    var _nowOverride = null;
    function nowMs() {
        if (_nowOverride != null) return _nowOverride;
        var t = Date.now();
        markSeen(Math.floor(t / CYCLE_MS));
        return t;
    }
    // 記住「看過的最新場次」(全角色共用，因為龍鑽也是共用的)：之後把電腦時間調回去，就押不了已經開獎的場次
    var _seenCache = null;
    function seenRace() {
        if (_seenCache == null) { _seenCache = 0; try { _seenCache = +localStorage.getItem('afk_race_seen') || 0; } catch (e) {} }
        return _seenCache;
    }
    function markSeen(raceId) {
        if (raceId > seenRace()) { _seenCache = raceId; try { localStorage.setItem('afk_race_seen', String(raceId)); } catch (e) {} }
    }

    // ---- 種子 PRNG ----
    function hash32(n) {
        n = n >>> 0;
        n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
        n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16;
        return n >>> 0;
    }
    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function pickWeighted(rng, weights) {
        var s = 0, i; for (i = 0; i < weights.length; i++) s += weights[i];
        var r = rng() * s;
        for (i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
        return weights.length - 1;
    }
    function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
    function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }

    // ---- 階段判定 ----
    function phaseOf(now) {
        var raceId = Math.floor(now / CYCLE_MS);
        var e = now - raceId * CYCLE_MS;
        var phase;
        if (e < BET_MS) phase = 'bet';
        else if (e < PARADE_MS) phase = 'parade';
        else if (e < RACE_MS) phase = 'race';
        else phase = 'result';
        return { raceId: raceId, e: e, phase: phase };
    }

    // ---- 一場的資料 ----
    // 拆成兩段:raceHead 只算到「誰贏」(狀態、賠率、冠軍),動畫參數留給 seededRace。
    // 查歷史冠軍(近況、連敗場數、票根結算)一次要翻幾十上百場,只需要冠軍是誰——
    // 走 head 就不必替每一場產生完整的動畫資料,快取也只留一個整數。
    var _raceCache = {}, _winnerCache = {};
    function raceHead(raceId) {
        var rng = mulberry32(hash32(raceId));
        var i, dogs = [];
        for (i = 0; i < N_DOGS; i++) {
            var base = DOGS[i];
            var st = pickWeighted(rng, STATE_PICK_W);
            var stateMod = STATES[st].mod * (0.6 + base.variance);
            var power = base.baseRating + stateMod;
            dogs.push({
                idx: i, name: base.name, form: base.form, color: base.color, variance: base.variance,
                stateIdx: st, state: STATES[st].label, stateEmoji: STATES[st].emoji, power: power
            });
        }
        var sumW = 0;
        for (i = 0; i < N_DOGS; i++) { dogs[i]._w = Math.exp(dogs[i].power / TEMP); sumW += dogs[i]._w; }
        for (i = 0; i < N_DOGS; i++) {
            dogs[i].prob = dogs[i]._w / sumW;
            dogs[i].odds = Math.max(1.2, Math.round((1 / dogs[i].prob) * (1 - HOUSE_EDGE) * 10) / 10);
        }
        var winner = pickWeighted(rng, dogs.map(function (d) { return d._w; }));
        _winnerCache[raceId] = winner;
        return { rng: rng, dogs: dogs, winner: winner };
    }
    function seededRace(raceId) {
        if (_raceCache[raceId]) return _raceCache[raceId];
        var head = raceHead(raceId), rng = head.rng, dogs = head.dogs, winner = head.winner;
        var i, rest = [];
        for (i = 0; i < N_DOGS; i++) if (i !== winner) rest.push({ idx: i, s: dogs[i].power + (rng() - 0.5) * 3 });
        rest.sort(function (a, b) { return b.s - a.s; });
        var order = [winner].concat(rest.map(function (o) { return o.idx; }));
        var rankOf = {}; for (i = 0; i < order.length; i++) rankOf[order[i]] = i;

        // 每場抽一種跑法劇本。關鍵是「後段猛追的那隻(charger)」跟冠軍是分開的——
        // 追得過＝逆轉、追不過＝惜敗,所以每場都有人殺上來,但不是每場都追得過。
        var sc = SCRIPTS[pickWeighted(rng, SCRIPTS.map(function (s) { return s.w; }))];
        var second = order[1];
        var charger = (sc.key === 'comeback') ? winner : second;
        var gap = sc.gap[0] + rng() * (sc.gap[1] - sc.gap[0]);       // 冠亞終點差距
        var spread = 0.012 + rng() * 0.033;                          // 三名以後散開程度,每場不同
        var winnerExp = sc.wexp[0] + rng() * (sc.wexp[1] - sc.wexp[0]);
        var anim = [];
        for (i = 0; i < N_DOGS; i++) {
            var rank = rankOf[i];
            var finish = rank === 0 ? 1.0 : (1.0 - gap - (rank - 1) * spread);
            var exp;
            if (i === winner) exp = winnerExp;
            else if (i === second) exp = (sc.key === 'duel') ? winnerExp + (rng() - 0.5) * 0.1 : sc.sexp[0] + rng() * (sc.sexp[1] - sc.sexp[0]);
            else exp = 0.9 + rng() * 0.25;   // 中段這群的曲線要接近,才會一路擠在一起換位(差太多就各跑各的)
            // 前二名的曲線要乾淨(劇本才看得出來);其餘放大擺盪,讓中段真的互相超車。
            // ⚠ 放大振幅一定要同時壓低頻率:擺盪的變化率會蓋過前進速度,狗就會在畫面上往後滑(實測過)。
            var boosted = (i !== winner && i !== charger);
            anim.push({
                finish: Math.max(0.05, finish),
                exp: Math.max(0.5, Math.min(1.9, exp)),
                wAmp: (0.045 + dogs[i].variance * 0.075) * (boosted ? MID_WOBBLE : 1),
                wFreq: boosted ? (0.6 + rng() * 0.7) : (1.2 + rng() * 1.2),
                wPhase: rng() * Math.PI * 2
            });
        }
        var race = {
            raceId: raceId, startMs: raceId * CYCLE_MS, dogs: dogs, order: order, rankOf: rankOf,
            winner: winner, script: sc.key, charger: charger, gap: gap, anim: anim
        };
        // 播報「殺上來了」要知道它中段落在哪 → 先算好,免得每幀重算
        race.chargerMidRank = rankAt(race, charger, 0.5);
        _raceCache[raceId] = race;
        return race;
    }

    // 沿賽道進度：u = 比賽進度 0..1 → 該狗 progress 0..1（純函式，中途進場一致）
    function progressAt(race, dogIdx, u) {
        u = clamp01(u);
        var a = race.anim[dogIdx];
        var shape = (LINEAR_MIX * u + (1 - LINEAR_MIX) * Math.pow(u, a.exp)) * a.finish;
        var wob = a.wAmp * Math.sin(Math.PI * 2 * (a.wFreq * u + a.wPhase)) * Math.pow(u, WOB_SKEW) * (1 - u);
        var p = shape + wob;
        if (p < 0) p = 0;
        var cap = (dogIdx === race.winner) ? 1.0 : a.finish;   // 各自封在自己的終點值,鼻尖差距才做得出來
        if (p > cap) p = cap;
        return p;
    }
    function rankAt(race, dogIdx, u) {
        var p = progressAt(race, dogIdx, u), r = 0;
        for (var i = 0; i < N_DOGS; i++) if (i !== dogIdx && progressAt(race, i, u) > p) r++;
        return r;
    }
    function orderAt(race, u) {
        var arr = [];
        for (var i = 0; i < N_DOGS; i++) arr.push({ i: i, p: progressAt(race, i, u) });
        arr.sort(function (a, b) { return b.p - a.p; });
        return arr;
    }
    function gapWord(g) {
        if (g < 0.005) return '一個鼻尖';
        if (g < 0.014) return '半個身位';
        if (g < 0.032) return '一個身位';
        return '好幾個身位';
    }
    function winnerOf(raceId) {
        var w = _winnerCache[raceId];
        return (w === undefined) ? raceHead(raceId).winner : w;
    }
    function recentForm(dogIdx, curRaceId, K) {
        var w = 0, total = 0;
        for (var r = curRaceId - K; r < curRaceId; r++) { if (r < 0) continue; total++; if (winnerOf(r) === dogIdx) w++; }
        return { w: w, total: total };
    }
    // 連續幾場沒贏（下注頁的「該它了」提示；只回看有限場數，不去翻整個歷史）
    function droughtOf(dogIdx, curRaceId) {
        var n = 0;
        for (var r = curRaceId - 1; r >= 0 && n < DROUGHT_MAX; r--) {
            if (winnerOf(r) === dogIdx) break;
            n++;
        }
        return n;
    }
    // 這隻狗要連敗幾場才算「異常」：以自己的平均等待場數（1/勝率）為基準
    function droughtThreshold(dogIdx) {
        return Math.max(DROUGHT_MIN_SHOW, Math.round(DROUGHT_FACTOR / BASE_PROB[dogIdx]));
    }

    // ================= 下注 / 紀錄 =================
    // 龍鑽由潘朵拉黑市(js/24)那份跨角色共用資料保管;API 不在就安靜停用龍鑽玩法,金幣照常
    function diaReady() {
        return typeof window.pandoraGetSharedDiamonds === 'function' && typeof window.pandoraAdjustSharedDiamonds === 'function';
    }
    function diaBalance() {
        if (!diaReady()) return 0;
        var n = Number(window.pandoraGetSharedDiamonds());
        return isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    }
    function diaAdjust(delta) {
        if (!diaReady()) return { ok: false, error: '龍之鑽石系統未就緒。' };
        var r = window.pandoraAdjustSharedDiamonds(delta) || {};
        if (r.ok) return { ok: true };
        return { ok: false, error: r.error || (r.busy ? '共用資料忙碌中，請稍後再試。' : '龍之鑽石異動失敗。') };
    }
    // 龍鑽動了就得確認紀錄真的落盤(兩份資料不同步＝重複入袋)。補跑中 saveGame 也回 false → 一律當沒成功、退回去。
    function persistOk() {
        try { return typeof saveGame === 'function' && saveGame() === true; }
        catch (e) { console.warn('[dograce] saveGame failed', e); return false; }
    }

    function ensureTickets() {
        if (typeof player === 'undefined' || !player) return null;
        if (!Array.isArray(player.raceTickets)) player.raceTickets = [];
        return player.raceTickets;
    }
    function ticketCur(tk) { return tk.cur === CUR_DIA ? CUR_DIA : CUR_GOLD; }   // 沒有 cur 欄位的舊紀錄＝金幣
    function ticketStake(tk) {
        if (tk.stake > 0) return Math.floor(tk.stake);
        return Math.floor((tk.count || 0) * LEGACY_TICKET_PRICE);   // 舊紀錄以「張」記
    }
    function payoutOf(cur, stake, odds) {
        var raw = stake * odds;
        return cur === CUR_DIA ? Math.floor(raw) : Math.round(raw);   // 龍鑽捨去,不讓取整倒送
    }
    function ticketPayout(tk) { return payoutOf(ticketCur(tk), ticketStake(tk), tk.odds || 0); }
    function betsThisRace(raceId) {
        var out = {};
        out[CUR_GOLD] = { total: 0, byDog: {} };
        out[CUR_DIA] = { total: 0, byDog: {} };
        var t = ensureTickets(); if (!t) return out;
        for (var i = 0; i < t.length; i++) {
            var tk = t[i]; if (tk.raceId !== raceId) continue;
            var side = out[ticketCur(tk)], s = ticketStake(tk);
            side.total += s;
            side.byDog[tk.dogIdx] = (side.byDog[tk.dogIdx] || 0) + s;
        }
        return out;
    }
    function goldBalance() { return (typeof player !== 'undefined' && player && player.gold) || 0; }
    function balanceOf(cur) { return cur === CUR_DIA ? diaBalance() : goldBalance(); }

    function placeBet(dogIdx, amount, cur) {
        cur = (cur === CUR_DIA) ? CUR_DIA : CUR_GOLD;
        amount = Math.floor(amount);
        if (typeof player === 'undefined' || !player || !player.cls) { logMsg('尚未載入角色，無法下注。', true); return false; }
        var ph = phaseOf(nowMs());
        if (ph.phase !== 'bet') { logMsg('已封盤，等下一場再下注。', true); return false; }
        // 防「把電腦時間調回去押已經開獎的場次」(nowMs 會記住看過的最新場次)
        if (ph.raceId < seenRace()) { logMsg('電腦時間不對，請校正時間後再下注。', true); return false; }
        if (!(amount > 0)) return false;
        if (cur === CUR_DIA && !diaReady()) { logMsg('龍之鑽石系統未就緒。', true); return false; }
        if (balanceOf(cur) < amount) { logMsg(cur === CUR_DIA ? '龍之鑽石不足。' : '金幣不足。', true); return false; }
        var dog = seededRace(ph.raceId).dogs[dogIdx];
        var t = ensureTickets();
        var tk = { raceId: ph.raceId, dogIdx: dogIdx, dogName: dog.name, cur: cur, stake: amount, odds: dog.odds, claimed: false };
        if (cur === CUR_DIA) {
            var paid = diaAdjust(-amount);
            if (!paid.ok) { logMsg(paid.error, true); return false; }
            t.push(tk);
            if (!persistOk()) {
                t.pop(); diaAdjust(amount);
                logMsg('存檔沒成功，已退回 ' + fmtAmt(cur, amount) + '。', true);
                return false;
            }
            refreshUI();
        } else {
            player.gold -= amount;
            t.push(tk);
            afterGoldChange();
        }
        logMsg('下注 ' + dog.name + '　' + fmtAmt(cur, amount));
        return true;
    }
    // 開獎＝那場已經跑完:同一場要等 result 階段才算數(race 階段冠軍雖已固定,提早結算等於劇透)
    function ticketResult(tk, ph) {
        if (tk.raceId > ph.raceId || (tk.raceId === ph.raceId && ph.phase !== 'result')) return 'pending';
        return (winnerOf(tk.raceId) === tk.dogIdx) ? 'win' : 'lose';
    }
    // 開獎即自動入袋(紀錄只留結果)。金幣與紀錄同一份存檔、直接加即可;龍鑽在另一份共用資料,
    // 先入袋成功才標記,存檔沒成功就把龍鑽整批退回——不留「入袋了卻沒標記」的半結算狀態。
    function settleWins() {
        if (typeof player === 'undefined' || !player || !player.cls) return null;
        var t = ensureTickets(); if (!t || !t.length) return null;
        var ph = phaseOf(nowMs()), i, c;
        var hits = {}, sum = {}, paid = {};
        hits[CUR_GOLD] = []; hits[CUR_DIA] = [];
        sum[CUR_GOLD] = 0; sum[CUR_DIA] = 0;
        paid[CUR_GOLD] = 0; paid[CUR_DIA] = 0;
        for (i = 0; i < t.length; i++) {
            if (t[i].claimed || ticketResult(t[i], ph) !== 'win') continue;
            c = ticketCur(t[i]);
            hits[c].push(t[i]); sum[c] += ticketPayout(t[i]);
        }
        if (hits[CUR_DIA].length) {
            var got = diaAdjust(sum[CUR_DIA]);
            if (got.ok) {
                for (i = 0; i < hits[CUR_DIA].length; i++) hits[CUR_DIA][i].claimed = true;
                paid[CUR_DIA] = sum[CUR_DIA];
            } else logMsg(got.error + '　中獎的龍之鑽石稍後會自動補入。', true);
        }
        if (hits[CUR_GOLD].length) {
            player.gold = goldBalance() + sum[CUR_GOLD];
            for (i = 0; i < hits[CUR_GOLD].length; i++) hits[CUR_GOLD][i].claimed = true;
            paid[CUR_GOLD] = sum[CUR_GOLD];
        }
        if (!paid[CUR_GOLD] && !paid[CUR_DIA]) return null;
        if (!persistOk() && paid[CUR_DIA]) {
            // 龍鑽在另一份資料,沒落盤就得退回;金幣沒落盤＝下次載入時金幣與紀錄一起回到結算前,本來就一致
            for (i = 0; i < hits[CUR_DIA].length; i++) hits[CUR_DIA][i].claimed = false;
            diaAdjust(-paid[CUR_DIA]);
            paid[CUR_DIA] = 0;
            logMsg('存檔沒成功，中獎的龍之鑽石稍後會自動補入。', true);
        }
        [CUR_GOLD, CUR_DIA].forEach(function (k) {
            if (!paid[k]) return;
            var list = hits[k];
            logMsg('🎉 ' + (list.length === 1 ? list[0].dogName + ' 中獎！' : '賽狗中獎 ' + list.length + ' 筆！') +
                '自動入袋 ' + fmtAmt(k, paid[k]));
        });
        refreshUI();
        return paid;
    }
    function pruneTickets() {
        var t = ensureTickets(); if (!t) return;
        var ph = phaseOf(nowMs()), removable = [];
        for (var i = 0; i < t.length; i++) { var res = ticketResult(t[i], ph); if (t[i].claimed || res === 'lose') removable.push(i); }
        var over = removable.length - TICKET_KEEP;
        if (over > 0) {
            var kill = {};
            for (var k = 0; k < over; k++) kill[removable[k]] = true;
            player.raceTickets = t.filter(function (_, idx) { return !kill[idx]; });
        }
    }
    function clearFinishedTickets() {
        var t = ensureTickets(); if (!t) return;
        var ph = phaseOf(nowMs());
        player.raceTickets = t.filter(function (tk) { var res = ticketResult(tk, ph); return !(tk.claimed || res === 'lose'); });
        if (typeof saveGame === 'function') saveGame();
        renderTicketPanel();
    }
    function refreshUI() { if (typeof updateUI === 'function') { try { updateUI(); } catch (e) { } } }
    function afterGoldChange() {
        if (typeof saveGame === 'function') saveGame();
        refreshUI();
    }
    function logMsg(msg, warn) {
        if (typeof logSys === 'function') logSys(warn ? '<span class="text-amber-300">🐕 ' + msg + '</span>' : '🐕 ' + msg);
    }
    function fmtAmt(cur, n) {   // 精確：日誌、餘額
        return cur === CUR_DIA ? '💎 ' + n.toLocaleString() + ' 顆' : '💰 ' + n.toLocaleString();
    }
    function dogTag(i) { return '<b style="color:' + DOGS[i].color + '">' + DOGS[i].name + '</b>'; }
    function fmtShort(cur, n) {   // 縮寫：狗卡上「已押 / 贏多少」這種塞不下全長數字的地方
        if (cur === CUR_DIA) return String(n);
        if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '億';
        if (n >= 1e6) return Math.round(n / 1e4).toLocaleString() + '萬';
        if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + '萬';
        return String(n);
    }

    // ================= UI：浮動視窗 / 縮球 / 大 U 型賽道 =================
    var WIN_POS = 'dograce_winpos', BALL_POS = 'dograce_ballpos';
    var _raf = null, _lastSec = -1, _tab = 'race';
    var _betCur = CUR_GOLD, _chipIdx = 0;   // 籌碼記「第幾顆」,切幣別時位置不變
    var _subview = '', _subviewRaceId = -1, _seenResult = {};

    function chipsOf(cur) { return cur === CUR_DIA ? DIA_CHIPS : GOLD_CHIPS; }
    function curChip() {
        var list = chipsOf(_betCur);
        return list[Math.max(0, Math.min(list.length - 1, _chipIdx))].v;
    }

    function el(id) { return document.getElementById(id); }
    function fmtCountdown(ms) {
        var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); s = s % 60;
        return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }
    function fmtRaceLabel(raceId) {
        var d = new Date(raceId * CYCLE_MS), p = function (n) { return (n < 10 ? '0' : '') + n; };
        return p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ' 場 #' + (((raceId % 10000) + 10000) % 10000);
    }

    window.openRaceWindow = function () {
        var win = el('dograce-win');
        if (!win) {
            win = document.createElement('div');
            win.id = 'dograce-win';
            win.className = 'dograce-win';
            win.innerHTML =
                '<div class="dograce-head" id="dograce-head">' +
                '<div class="dograce-title">🐕 賽狗場<span id="dograce-phase" class="dograce-phase"></span></div>' +
                '<div class="dograce-headbtns">' +
                '<button type="button" class="dograce-hb" data-act="ball" title="縮成小球">●</button>' +
                '<button type="button" class="dograce-hb" data-act="min" title="收合/展開">－</button>' +
                '<button type="button" class="dograce-hb" data-act="close" title="關閉">✖</button>' +
                '</div></div>' +
                '<div class="dograce-body" id="dograce-body">' +
                '<div class="dograce-tabs">' +
                '<button type="button" class="dograce-tab" data-tab="race">🏁 賽事</button>' +
                '<button type="button" class="dograce-tab" data-tab="tickets">📜 紀錄</button>' +
                '</div>' +
                '<div class="dograce-panel" id="dograce-panel"></div>' +
                '</div>';
            document.body.appendChild(win);
            makeDraggable(win, el('dograce-head'));
            restorePos(win, WIN_POS, { right: 12, top: 64 });
            win.addEventListener('click', onWinClick);
            ensureVisObserver();
        }
        win.style.display = '';
        var ball = el('dograce-ball'); if (ball) ball.style.display = 'none';
        _tab = 'race'; _subview = '';
        settleWins();   // 關掉遊戲期間開的獎沒人結算,開視窗先補完
        pruneTickets();
        syncTabs();
        applyView(nowMs());
        startLoop();
        updateVisibility();
    };

    function onWinClick(e) {
        var b = e.target.closest('[data-act]');
        if (b) {
            var act = b.getAttribute('data-act');
            if (act === 'close') return closeRace();
            if (act === 'min') {
                var body = el('dograce-body'), win = el('dograce-win');
                var hid = win.classList.toggle('is-min');
                body.style.display = hid ? 'none' : '';
                b.textContent = hid ? '＋' : '－';
                return;
            }
            if (act === 'ball') return toBall();
            return;
        }
        var tab = e.target.closest('[data-tab]');
        if (tab) { _tab = tab.getAttribute('data-tab'); _subview = ''; syncTabs(); applyView(nowMs()); return; }
        var cur = e.target.closest('[data-cur]');
        if (cur) { _betCur = cur.getAttribute('data-cur') === CUR_DIA ? CUR_DIA : CUR_GOLD; renderBetPanel(); return; }
        var chip = e.target.closest('[data-chip]');
        if (chip) { _chipIdx = parseInt(chip.getAttribute('data-chip'), 10); renderBetPanel(); return; }
        var dogBet = e.target.closest('[data-bet]');
        if (dogBet) {
            placeBet(parseInt(dogBet.getAttribute('data-bet'), 10), curChip(), _betCur);
            renderBetPanel();
            return;
        }
        if (e.target.closest('[data-clearticket]')) { clearFinishedTickets(); return; }
    }

    function closeRace() {
        var win = el('dograce-win'); if (win) win.style.display = 'none';
        var ball = el('dograce-ball'); if (ball) ball.style.display = 'none';
        stopLoop();
    }
    function toBall() {
        var win = el('dograce-win'); if (win) win.style.display = 'none';
        var ball = el('dograce-ball');
        if (!ball) {
            ball = document.createElement('div');
            ball.id = 'dograce-ball';
            ball.className = 'dograce-ball';
            ball.innerHTML = '<div class="dograce-ball-ico" id="dograce-ball-ico">🐕</div><div class="dograce-ball-cd" id="dograce-ball-cd">--:--</div>';
            document.body.appendChild(ball);
            makeDraggable(ball, ball, true);
            restorePos(ball, BALL_POS, { right: 14, bottom: 90 });
            ball.addEventListener('click', function () { if (ball._dragged) { ball._dragged = false; return; } window.openRaceWindow(); });
        }
        ball.style.display = '';
        ensureVisObserver();
        startLoop();
        updateVisibility();
    }

    function isMobileHidden() {
        // ⚠ afk-mobile 的檢視 class 是 mview-left/center/right,「戰鬥」=mview-center(沒有 mview-battle 這個名字——
        //   之前寫錯害手機上圓球永遠被藏,玩家在奇岩看不到入口)。
        // 浮動日誌開著時也要藏:日誌面板 z-index 9500 遠高於本視窗/圓球(74),留著只是埋在底下的一塊,
        //   矮螢幕上實測下注鈕直接點不到(elementFromPoint 打到日誌的關閉鈕)。拉高 z-index 不對——
        //   日誌是玩家自己叫出來的覆蓋層,不該被賽狗視窗壓過去。
        var b = document.body;
        if (!b.classList.contains('m-mobile')) return false;
        return !b.classList.contains('mview-center') || b.classList.contains('mlog-open');
    }
    // 手機切檢視(body class 變動)→重算顯示;球與視窗共用。⚠ 要在「純圓球」路徑也註冊(原本只在開過視窗才註冊,
    // 玩家只出圓球沒開視窗的話,切到戰鬥檢視也不會重新顯示/切走也不會藏)。
    var _visObs = null;
    function ensureVisObserver() {
        if (_visObs || typeof MutationObserver !== 'function' || !document.body) return;
        _visObs = new MutationObserver(updateVisibility);
        _visObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    function updateVisibility() {
        var hide = isMobileHidden();
        var win = el('dograce-win'), ball = el('dograce-ball');
        if (win && win.style.display !== 'none') win.style.visibility = hide ? 'hidden' : '';
        if (ball && ball.style.display !== 'none') ball.style.visibility = hide ? 'hidden' : '';
    }

    // ---- 拖曳 + 位置記憶 ----
    // 可用區域上緣：官方版指引橫幅是 fixed 貼在視窗頂端，賽狗視窗/小圈圈都是 fixed 定位，
    // 不夾住上緣就會被壓在橫幅底下。官方網域沒有橫幅 → 0 → 行為與原本完全一樣。
    // ⚠ 直接量 #_orig_pbar 元素（+6 安全邊距，與 afk-mobile 同準）——不可依賴外部函式/CSS 變數（afk-mobile 可能被關）。
    function barTop() {
        try { var b = document.getElementById('_orig_pbar'); if (b) { var h = b.getBoundingClientRect().height; if (h > 0) return Math.ceil(h) + 6; } } catch (_) { }
        return 0;
    }
    // 可用區域下緣:手機底部有導覽列,視窗不可壓到它底下(桌機沒導覽列 → 回視窗底,行為不變)
    function usableBottom() {
        try { var n = document.getElementById('m-nav');
              if (n && getComputedStyle(n).display !== 'none') return n.getBoundingClientRect().top; } catch (_) {}
        return innerHeight;
    }

    function makeDraggable(node, handle, isBall) {
        var drag = null;
        handle.addEventListener('pointerdown', function (e) {
            if (e.target.closest('button')) return;
            var r = node.getBoundingClientRect();
            drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
            node.style.left = r.left + 'px'; node.style.top = r.top + 'px';
            node.style.right = 'auto'; node.style.bottom = 'auto';
            try { handle.setPointerCapture(e.pointerId); } catch (_) { }
            e.preventDefault();
        });
        handle.addEventListener('pointermove', function (e) {
            if (!drag || drag.id !== e.pointerId) return;
            var bt = barTop();
            var maxX = Math.max(0, innerWidth - node.offsetWidth), maxY = Math.max(bt, usableBottom() - node.offsetHeight);
            node.style.left = Math.max(0, Math.min(maxX, e.clientX - drag.dx)) + 'px';
            node.style.top = Math.max(bt, Math.min(maxY, e.clientY - drag.dy)) + 'px';
            drag.moved = true; if (isBall) node._dragged = true;
        });
        function end(e) {
            if (!drag || drag.id !== e.pointerId) return;
            try { handle.releasePointerCapture(e.pointerId); } catch (_) { }
            if (drag.moved) savePos(node, isBall ? BALL_POS : WIN_POS);
            drag = null;
        }
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
    }
    function savePos(node, key) {
        try { localStorage.setItem(key, JSON.stringify({ left: parseInt(node.style.left, 10), top: parseInt(node.style.top, 10) })); } catch (e) { }
    }
    function restorePos(node, key, def) {
        var p = null;
        try { p = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { }
        var bt = barTop();
        if (p && typeof p.left === 'number') {
            node.style.left = Math.max(0, Math.min(innerWidth - 60, p.left)) + 'px';
            // 夾回可用範圍:上緣讓開橫幅、下緣讓開底部導覽。要用「這個節點實際的高度」——
            // 寫死 40 的話,視窗(數百 px)只保證露出 40px,存過的舊位置會讓整個下半截掉到導覽底下。
            node.style.top = Math.max(bt, Math.min(usableBottom() - (node.offsetHeight || 40), p.top)) + 'px';
            node.style.right = 'auto'; node.style.bottom = 'auto';
        } else {
            if (def.right != null) node.style.right = def.right + 'px';
            if (def.left != null) node.style.left = def.left + 'px';
            // 預設位置以「可用區域上緣」起算(不是視窗頂端)；再夾住下緣，免得讓開橫幅後反而掉出畫面底部
            if (def.top != null) {
                var t = def.top + bt;
                var h = node.offsetHeight;
                if (h) t = Math.max(bt, Math.min(t, usableBottom() - h));
                node.style.top = t + 'px';
            }
            if (def.bottom != null) node.style.bottom = def.bottom + 'px';
        }
    }

    // ---- 大 U 型賽道幾何（tall viewBox；狗填滿手機） ----
    var TW = 200, TH = 300, CX = 100, TOP = 20, CURVE_Y = 196, R0 = 24, LANE_W = 9;
    var _lanePaths = [], _laneLens = [];
    var STAGGER = 0.02;   // 外圈起點較前（於起跑時，隨比賽淡出）
    function laneRadius(j) { return R0 + j * LANE_W; }   // j=0 內圈(短)、7 外圈(長)
    function laneD(j) {
        var R = laneRadius(j), xl = CX - R, xr = CX + R;
        return 'M ' + xl + ' ' + TOP + ' L ' + xl + ' ' + CURVE_Y + ' A ' + R + ' ' + R + ' 0 0 0 ' + xr + ' ' + CURVE_Y + ' L ' + xr + ' ' + TOP;
    }
    function bandD() {
        var Ro = laneRadius(N_DOGS - 1) + LANE_W * 0.6, Ri = R0 - LANE_W * 0.6;
        var oL = CX - Ro, oR = CX + Ro, iL = CX - Ri, iR = CX + Ri;
        return 'M ' + oL + ' ' + TOP + ' L ' + oL + ' ' + CURVE_Y + ' A ' + Ro + ' ' + Ro + ' 0 0 0 ' + oR + ' ' + CURVE_Y + ' L ' + oR + ' ' + TOP +
            ' L ' + iR + ' ' + TOP + ' L ' + iR + ' ' + CURVE_Y + ' A ' + Ri + ' ' + Ri + ' 0 0 1 ' + iL + ' ' + CURVE_Y + ' L ' + iL + ' ' + TOP + ' Z';
    }
    function renderTrackView(ph) {
        var panel = el('dograce-panel'); if (!panel) return;
        var svg = '<svg id="dograce-svg" viewBox="0 0 ' + TW + ' ' + TH + '" preserveAspectRatio="xMidYMid meet">';
        svg += '<path class="dograce-band" d="' + bandD() + '"/>';
        for (var j = 0; j < N_DOGS; j++) svg += '<path class="dograce-laneline" id="dgl-' + j + '" d="' + laneD(j) + '"/>';
        var Ro = laneRadius(N_DOGS - 1), Ri = R0;
        svg += '<line class="dograce-line" x1="' + (CX - Ro - 5) + '" y1="' + TOP + '" x2="' + (CX - Ri + 5) + '" y2="' + TOP + '"/>';
        svg += '<line class="dograce-line dograce-finish" x1="' + (CX + Ri - 5) + '" y1="' + TOP + '" x2="' + (CX + Ro + 5) + '" y2="' + TOP + '"/>';
        svg += '</svg>';
        panel.innerHTML =
            '<div class="dograce-trackview">' +
            '<div class="dograce-overlay" id="dograce-overlay"></div>' + svg +
            '<div class="dograce-dogs" id="dograce-dogs"></div>' +
            '</div>';
        _lanePaths = []; _laneLens = [];
        for (var k = 0; k < N_DOGS; k++) { var pth = el('dgl-' + k); _lanePaths.push(pth); _laneLens.push(pth.getTotalLength()); }
        var html = '';
        for (var i = 0; i < N_DOGS; i++) {
            html += '<div class="dograce-dog" id="dgd-' + i + '">' +
                '<div class="dograce-plate" style="border-color:' + DOGS[i].color + '"><b style="background:' + DOGS[i].color + '">' + (i + 1) + '</b>' + DOGS[i].name + '</div>' +
                '<img alt="' + DOGS[i].name + '" src="assets/anim/' + encodeURIComponent(DOGS[i].form) + '/d6/idle_0.png" onerror="this.style.opacity=.4">' +
                '</div>';
        }
        el('dograce-dogs').innerHTML = html;
    }

    function _vecDir(dx, dy) {
        if (typeof _vec2dir === 'function') return _vec2dir(dx, dy);
        var oct = Math.round(Math.atan2(dy, dx) * 4 / Math.PI);
        var map = { '0': 3, '1': 4, '2': 5, '3': 6, '4': 7, '-4': 7, '-3': 0, '-2': 1, '-1': 2 };
        var r = map[String(oct)]; return (r == null) ? 6 : r;
    }
    // 分數車道上取點（在相鄰兩條 lane 間內插 → 換道/切內線平滑）
    function posOnLane(frac, along) {
        var a = Math.max(0, Math.min(N_DOGS - 1, Math.floor(frac)));
        var b = Math.max(0, Math.min(N_DOGS - 1, Math.ceil(frac)));
        var t = frac - a;
        var pa = _lanePaths[a].getPointAtLength(_laneLens[a] * along);
        var pb = _lanePaths[b].getPointAtLength(_laneLens[b] * along);
        return { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t };
    }
    // 放置每隻狗：外圈起點較前(stagger)、開跑後往內線切(cut-in)
    function placeDogs(race, u, animate) {
        var svgEl = el('dograce-svg'); if (!svgEl || !_lanePaths.length) return;
        var box = svgEl.getBoundingClientRect();
        var scale = Math.min(box.width / TW, box.height / TH);
        var offX = (box.width - TW * scale) / 2, offY = (box.height - TH * scale) / 2;
        var frame = animate ? (Math.floor(performance.now() / 120) % 4) : 0;
        var cut = smooth(u / 0.5);   // 前半段切入內線
        for (var i = 0; i < N_DOGS; i++) {
            var startLane = i, targetLane = i * 0.45;
            var frac = startLane + (targetLane - startLane) * cut;
            var along = clamp01(progressAt(race, i, u) + STAGGER * startLane * (1 - u));
            var pt = posOnLane(frac, along);
            var pt2 = posOnLane(frac, Math.min(1, along + 0.012));
            var dir = _vecDir(pt2.x - pt.x, pt2.y - pt.y);
            var dog = el('dgd-' + i); if (!dog) continue;
            dog.style.left = (offX + pt.x * scale) + 'px';
            dog.style.top = (offY + pt.y * scale) + 'px';
            var img = dog.firstElementChild.nextElementSibling;
            var src = 'assets/anim/' + encodeURIComponent(DOGS[i].form) + '/d' + dir + '/' + (animate ? 'walk' : 'idle') + '_' + frame + '.png';
            if (img._src !== src) { img._src = src; img.src = src; }
            // 解析度要夠細:近距離勝負時冠亞只差千分之幾,粗略取整會讓兩隻 z-index 打平,
            // 平手就由 DOM 順序決定 → 亞軍的名牌壓住冠軍,衝線那一刻反而看不到贏家。
            dog.style.zIndex = String(10 + Math.round(along * 400));
        }
    }
    function updateOverlay(ph, race, u) {
        var ov = el('dograce-overlay'); if (!ov) return;
        ov.className = 'dograce-overlay' + (ph.phase === 'result' ? ' is-result' : '');
        if (ph.phase === 'parade') { ov.innerHTML = '<div class="dograce-ov-mid">🚦 入閘中…</div>'; return; }
        if (ph.phase === 'race') {
            var ord = orderAt(race, u), lead = ord[0].i, close = ord[0].p - ord[1].p;
            // 貼這麼近的時候「誰領先」意義不大,改成直接講是哪兩隻在咬
            if (u > 0.85 && close < 0.03) {
                ov.innerHTML = '<div class="dograce-ov-top">👀 ' + dogTag(ord[0].i) + '、' + dogTag(ord[1].i) + ' 幾乎並駕齊驅！</div>';
                return;
            }
            // 「殺上來了」看的是「有沒有在往前爬」,不是「已經追到第二名」——後者只在最後一兩秒成立,報了等於沒報
            var cRank = (u > 0.5 && race.chargerMidRank >= 2) ? rankAt(race, race.charger, u) : 99;
            var call = '';
            if (u < 0.07) call = '🚀 出閘！';
            else if (cRank <= 2 && race.chargerMidRank - cRank >= 2) call = '🔥 ' + DOGS[race.charger].name + ' 殺上來了！';
            else if (u > 0.82) call = '最後直道！';
            ov.innerHTML = '<div class="dograce-ov-top">🏃 領先：' + dogTag(lead) + (call ? '　' + call : '') + '</div>';
            return;
        }
        if (ph.phase === 'result') {
            var champOdds = race.dogs[race.winner].odds;
            ov.innerHTML = '<div class="dograce-ov-panel">' +
                '<div class="dograce-ov-win">🏆 <b style="color:' + DOGS[race.winner].color + '">' + DOGS[race.winner].name + '</b> 獲勝</div>' +
                '<div class="dograce-ov-rank">' + race.order.slice(0, 3).map(function (idx, r) { return '<span>' + (r + 1) + '. <b style="color:' + DOGS[idx].color + '">' + DOGS[idx].name + '</b></span>'; }).join('') + '</div>' +
                '<div class="dograce-ov-rank">領先 ' + DOGS[race.order[1]].name + ' ' + gapWord(race.gap) +
                (champOdds >= UPSET_ODDS ? '　<b style="color:#fca5a5">💥 大爆冷 ×' + champOdds.toFixed(1) + '</b>' : '') + '</div>' +
                '</div>';
            return;
        }
        ov.innerHTML = '';
    }

    // ---- 迴圈 / 視圖切換 ----
    function desiredSubview(ph) {
        if (_tab === 'tickets') return 'tickets';
        return ph.phase === 'bet' ? 'bet' : 'track';
    }
    function applyView(now) {
        var ph = phaseOf(now);
        var want = desiredSubview(ph);
        if (want !== _subview) {
            _subview = want; _subviewRaceId = ph.raceId;
            if (want === 'tickets') renderTicketPanel();
            else if (want === 'bet') renderBetPanel(ph);
            else renderTrackView(ph);
        } else if (want === 'bet' && ph.raceId !== _subviewRaceId) {
            _subviewRaceId = ph.raceId; renderBetPanel(ph);   // 新一場：刷新賠率/狀態
        }
    }
    // 只剩小圓球時畫面每秒才變一次(倒數字),60fps 的 rAF 純浪費 → 降成 0.5 秒 setTimeout;
    // 賽道視圖開著才需要逐幀(狗在跑)。兩種排程共用 loop,誰在跑由 _raf/_slow 各記各的。
    var _slow = null;
    function startLoop() { if (_raf == null && _slow == null) _raf = requestAnimationFrame(loop); }
    function stopLoop() {
        if (_raf != null) { cancelAnimationFrame(_raf); _raf = null; }
        if (_slow != null) { clearTimeout(_slow); _slow = null; }
    }
    function loop() {
        _raf = null;
        if (_slow != null) { clearTimeout(_slow); _slow = null; }
        var win = el('dograce-win'), ball = el('dograce-ball');
        var winOpen = win && win.style.display !== 'none';
        var ballOpen = ball && ball.style.display !== 'none';
        if (!winOpen && !ballOpen) { stopLoop(); return; }
        if (winOpen) _raf = requestAnimationFrame(loop);
        else _slow = setTimeout(loop, 500);
        var now = nowMs(), ph = phaseOf(now), race = seededRace(ph.raceId);
        if (ballOpen) {
            var bi = ballInfo(ph), cd = el('dograce-ball-cd'), ico = el('dograce-ball-ico');
            if (cd) cd.textContent = bi.cd;
            if (ico) ico.textContent = bi.ico;
            if (ball.className.indexOf(bi.cls) < 0) ball.className = 'dograce-ball ' + bi.cls;
        }
        if (winOpen && !win.classList.contains('is-min')) {
            var sec = Math.floor(now / 1000);
            if (sec !== _lastSec) { _lastSec = sec; updatePhaseText(ph); }
            applyView(now);
            if (_subview === 'track') {
                var u = (ph.phase === 'race') ? (ph.e - PARADE_MS) / RACE_DUR : (ph.phase === 'result' ? 1 : 0);
                placeDogs(race, u, ph.phase === 'race' || ph.phase === 'parade');
                updateOverlay(ph, race, u);
            }
        }
        maybeAnnounceResult(ph);
    }
    function ballInfo(ph) {
        if (ph.phase === 'bet') return { ico: '🎫', cd: fmtCountdown(BET_MS - ph.e), cls: 'db-bet' };
        if (ph.phase === 'parade') return { ico: '🚦', cd: Math.ceil((PARADE_MS - ph.e) / 1000) + 's', cls: 'db-parade' };
        if (ph.phase === 'race') return { ico: '🏁', cd: '開跑', cls: 'db-race' };
        return { ico: '🏆', cd: fmtCountdown(CYCLE_MS - ph.e), cls: 'db-result' };
    }
    function updatePhaseText(ph) {
        var pe = el('dograce-phase'); if (!pe) return;
        if (ph.phase === 'bet') pe.textContent = '　下注中 ' + fmtCountdown(BET_MS - ph.e);
        else if (ph.phase === 'parade') pe.textContent = '　入閘… ' + fmtCountdown(PARADE_MS - ph.e);
        else if (ph.phase === 'race') pe.textContent = '　比賽中';
        else pe.textContent = '　下一場 ' + fmtCountdown(CYCLE_MS - ph.e);
    }
    function maybeAnnounceResult(ph) {
        if (ph.phase !== 'result' || _seenResult[ph.raceId]) return;
        _seenResult[ph.raceId] = true;
        settleWins();   // 中獎自動入袋(settleWins 自己會挑出「已跑完且沒結算過」的)
        if (_tab === 'tickets') renderTicketPanel();
    }

    // ---- 面板 ----
    function syncTabs() {
        var tabs = document.querySelectorAll('#dograce-win .dograce-tab');
        for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('is-active', tabs[i].getAttribute('data-tab') === _tab);
    }
    function renderBetPanel(ph) {
        var panel = el('dograce-panel'); if (!panel) return;
        ph = ph || phaseOf(nowMs());
        var race = seededRace(ph.raceId), prev = seededRace(ph.raceId - 1);
        var cur = _betCur, chip = curChip(), side = betsThisRace(ph.raceId)[cur];
        var html = '<div class="dograce-betwrap">';
        html += '<div class="dograce-betbar">' +
            '<button type="button" class="dograce-cur' + (cur === CUR_GOLD ? ' is-on' : '') + '" data-cur="' + CUR_GOLD + '">' + fmtAmt(CUR_GOLD, goldBalance()) + '</button>' +
            (diaReady() ? '<button type="button" class="dograce-cur' + (cur === CUR_DIA ? ' is-on' : '') + '" data-cur="' + CUR_DIA + '">' + fmtAmt(CUR_DIA, diaBalance()) + '</button>' : '') +
            '</div>';
        html += '<div class="dograce-chips">每次';
        chipsOf(cur).forEach(function (c, k) {
            html += '<button type="button" class="dograce-chip' + (_chipIdx === k ? ' is-on' : '') + '" data-chip="' + k + '">' + c.label + '</button>';
        });
        html += (cur === CUR_DIA ? '顆' : '') + '</div>';
        html += '<div class="dograce-prev">上一場冠軍：' + dogTag(prev.winner) + '</div>';
        html += '<div class="dograce-doglist">';
        for (var i = 0; i < N_DOGS; i++) {
            var d = race.dogs[i], rf = recentForm(i, ph.raceId, 8), mine = side.byDog[i] || 0;
            var dry = droughtOf(i, ph.raceId);
            html += '<div class="dograce-dogcard">' +
                '<span class="dograce-num" style="background:' + d.color + '">' + (i + 1) + '</span>' +
                '<span class="dograce-name">' + d.name + '<small>' + d.stateEmoji + d.state + '　近' + rf.total + '場' + rf.w + '勝' +
                (dry >= droughtThreshold(i) ? '　<span class="dograce-dry">⚡ 連' + dry + (dry >= DROUGHT_MAX ? '場以上' : '場') + '沒贏</span>' : '') +
                (mine ? '　<span class="dograce-mine">已押 ' + fmtShort(cur, mine) + '</span>' : '') + '</small></span>' +
                '<span class="dograce-odds">×' + d.odds.toFixed(1) + '<small>贏 ' + fmtShort(cur, payoutOf(cur, chip, d.odds)) + '</small></span>' +
                '<button type="button" class="dograce-betbtn" data-bet="' + i + '">押 ' + fmtShort(cur, chip) + '</button>' +
                '</div>';
        }
        html += '</div>';
        html += '<div class="dograce-foot">本場已押 ' + fmtAmt(cur, side.total) + '　·　開獎後中獎自動入袋</div>';
        html += '</div>';
        panel.innerHTML = html;
    }
    function renderTicketPanel() {
        if (_tab !== 'tickets') return;
        var panel = el('dograce-panel'); if (!panel) return;
        var t = ensureTickets() || [], ph = phaseOf(nowMs());
        var html = '<div class="dograce-tkwrap"><div class="dograce-tkhead"><span>📜 下注紀錄（' + t.length + '）</span><button type="button" class="dograce-clear" data-clearticket="1">🗑 清除已結算</button></div>';
        if (!t.length) { html += '<div class="dograce-empty">還沒有紀錄。到「賽事」押一注吧！</div></div>'; panel.innerHTML = html; return; }
        html += '<div class="dograce-tklist">';
        for (var i = t.length - 1; i >= 0; i--) {
            var tk = t[i], c = ticketCur(tk), res = ticketResult(tk, ph), badge, cls;
            if (res === 'pending') { badge = '🕓 待開獎'; cls = 'pend'; }
            else if (res === 'win') { badge = tk.claimed ? '🎉 中獎' : '🕓 結算中'; cls = tk.claimed ? 'win' : 'pend'; }
            else { badge = '❌ 未中'; cls = 'lose'; }
            html += '<div class="dograce-tk ' + cls + '">' +
                '<div class="dograce-tk-main"><b>' + tk.dogName + '</b> ' + fmtAmt(c, ticketStake(tk)) + '　<span class="dograce-tk-odds">賠 ×' + tk.odds.toFixed(1) + '</span></div>' +
                '<div class="dograce-tk-sub">' + fmtRaceLabel(tk.raceId) + '</div>' +
                '<div class="dograce-tk-right"><span class="dograce-tk-badge">' + badge + '</span>' +
                (res === 'win' && tk.claimed ? '<span class="dograce-tk-pay">+' + fmtAmt(c, ticketPayout(tk)) + '</span>' : '') +
                '</div></div>';
        }
        html += '</div></div>';
        panel.innerHTML = html;
    }

    // ================= debug =================
    // 除錯介面(可改時間、直接下注/開獎)：只在 localStorage afk_race_debug=1 時才掛上，玩家主控台叫不到
    var _raceDebug = false; try { _raceDebug = localStorage.getItem('afk_race_debug') === '1'; } catch (e) {}
    if (_raceDebug) window.__race = {
        CYCLE_MS: CYCLE_MS,
        phases: { CYCLE: CYCLE_MS, BET: BET_MS, PARADE: PARADE_MS, RACE: RACE_MS },
        setNow: function (ms) { _nowOverride = ms; },
        offset: function (ms) { _nowOverride = Date.now() + ms; },
        clearNow: function () { _nowOverride = null; },
        phase: function () { return phaseOf(nowMs()); },
        race: function (id) { return seededRace(id == null ? phaseOf(nowMs()).raceId : id); },
        winner: winnerOf, placeBet: placeBet, settle: settleWins, tickets: ensureTickets,
        dia: diaBalance, DOGS: DOGS, CUR: { gold: CUR_GOLD, dia: CUR_DIA },
        progressAt: progressAt, orderAt: orderAt, rankAt: rankAt, SCRIPTS: SCRIPTS,
        drought: droughtOf, droughtThreshold: droughtThreshold, baseProb: BASE_PROB
    };

    // 入口鈕在自動化分頁,但手機上視窗/縮球只在戰鬥檢視露出(isMobileHidden)——不先切回去,
    // 按下等於什麼都沒發生(視窗其實開了,只是 visibility:hidden)。
    // afk-mobile 被關掉時沒有檢視可切,也不需要切(那時 isMobileHidden 一律回 false),所以讀不到就跳過。
    function openRaceFromMenu() {
        try {
            if (document.body.classList.contains('m-mobile') && window.__afkm && typeof __afkm.setView === 'function') __afkm.setView('center');
        } catch (e) { }
        window.openRaceWindow();
    }

    // 🎯 入口：自動化分頁「🔌 外掛」列（木人場旁）加「🐕 賽狗場」鈕；視窗/縮球一旦開啟即跨畫面常駐（可拖曳/縮球）。
    function injectAutoNav() {
        var panel = document.getElementById('tab-automation');
        if (!panel) return false;
        if (document.getElementById('m-afk-nav-dograce')) return true;
        var row = document.getElementById('m-afk-navrow');
        if (!row) {
            row = document.createElement('div');
            row.id = 'm-afk-navrow';
            row.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700';
            row.innerHTML = '<div class="text-sm text-amber-400 mb-2 border-b border-slate-700 pb-1 font-bold">🔌 外掛</div>' +
                '<div id="m-afk-navrow-btns" style="display:flex;gap:8px;flex-wrap:wrap;"></div>';
            panel.appendChild(row);
        }
        var b = document.createElement('button');
        b.id = 'm-afk-nav-dograce'; b.type = 'button';
        b.className = 'btn py-2 text-sm bg-slate-700 hover:bg-slate-600 border-slate-500';
        b.style.width = '100%';
        b.style.marginTop = '8px';
        b.textContent = '🐕 賽狗場';
        b.addEventListener('click', function () { openRaceFromMenu(); });
        row.appendChild(b);
        return true;
    }
    var _navTries = 0;
    (function tryInject() {
        if (injectAutoNav()) return;
        if (++_navTries < 40) setTimeout(tryInject, 500);
        else console.warn('[dograce] 找不到 automation 面板，入口未注入（開過的視窗/縮球仍可用）');
    })();

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { console.log('[dograce] ready — 賽狗場入口(自動化分頁)已就緒'); });
    else console.log('[dograce] ready — 賽狗場入口(自動化分頁)已就緒');
})();
