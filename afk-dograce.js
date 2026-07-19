// ===== 奇岩賽狗場（賭狗）核心 =====
// 核心哲學：整場賽事用 Date.now()（UTC epoch）固化 — raceId = floor(now/CYCLE_MS)，
// 用 raceId 當種子的 PRNG 產生「這場的狗群狀態、賠率、逐格位置、名次、贏家」。
// 所有人同一真實時間看到同一場、同樣結果；中途進場也用同一組純函式算到「現在該在的位置」。
// 下注買票（票存 player.raceTickets、與金幣原子扣款）；開獎不自動領，玩家自己按領獎、票留著可炫耀。
// 檔名刻意不用數字開頭（比照 js/offline.js），避免日後手動合併原版新增 js/2x-*.js 撞名。
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('dograce')) return;   // 🎚️ 外掛開關

    // ---- 樣式(自 main 的 css/floating-ui.css 抽出、外掛自帶注入:此分支 css/ 還原上游後賽狗場樣式遺失,
    //      球變成無定位的裸元素貼在左上角被橫幅蓋住=玩家「看不到入口」。自帶樣式,同步上游 css 也不會再丟) ----
    (function () { if (document.getElementById('afk-dograce-css')) return; var st = document.createElement('style'); st.id = 'afk-dograce-css'; st.textContent = "\n/* ===== 🐕 奇岩賽狗場浮動視窗 / 縮球 / U 型賽道 ===== */\n.dograce-win{position:fixed;z-index:74;width:min(94vw,430px);height:min(calc(var(--fu-avail-h,calc(100vh - var(--orig-bar-h,0px))) * .88),760px);display:flex;flex-direction:column;\n  border:2px solid #8b6a2f;border-radius:12px;background:#0f1621f5;box-shadow:0 18px 40px #000c;color:#e2e8f0;\n  user-select:none;touch-action:none;font-family:Arial,\"Microsoft JhengHei\",sans-serif}\n.dograce-win.is-min{height:auto}\n.dograce-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:6px;padding:8px 10px;cursor:grab;\n  color:#fff3c4;border-bottom:1px solid #8b6a2f;border-radius:10px 10px 0 0;\n  background:linear-gradient(135deg,#3d2b0e,#9b7629,#5f4517,#b28c38,#34240d)}\n.dograce-title{font-weight:900;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.dograce-phase{font-weight:600;font-size:12px;color:#fde68a}\n.dograce-headbtns{display:flex;gap:4px;flex:0 0 auto}\n.dograce-hb{width:26px;height:26px;border:1px solid #d9bd70;border-radius:6px;background:#151b25;color:#fff3cf;font-size:13px;line-height:1;cursor:pointer;padding:0}\n.dograce-hb:hover{background:#243040}\n.dograce-body{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}\n/* 分頁 */\n.dograce-tabs{flex:0 0 auto;display:flex;border-bottom:1px solid #33414d}\n.dograce-tab{flex:1;padding:8px 4px;background:#141c28;color:#94a3b8;border:0;border-right:1px solid #33414d;font-size:13px;font-weight:700;cursor:pointer}\n.dograce-tab:last-child{border-right:0}\n.dograce-tab.is-active{background:#1e2b3d;color:#fde68a;box-shadow:inset 0 -2px 0 #b28c38}\n.dograce-panel{flex:1;min-height:0;position:relative;overflow:hidden}\n/* 大 U 型賽道 */\n.dograce-trackview{position:relative;width:100%;height:100%;background:radial-gradient(ellipse at 50% 12%,#14241a,#0a1109);overflow:hidden}\n#dograce-svg{width:100%;height:100%;display:block}\n.dograce-band{fill:#1f3324;stroke:#3c5a3f;stroke-width:1.5;opacity:.95}\n.dograce-laneline{fill:none;stroke:#ffffff26;stroke-width:.8;stroke-dasharray:3 3}\n.dograce-line{stroke:#e2e8f0;stroke-width:3;stroke-dasharray:3 2;opacity:.85}\n.dograce-finish{stroke:#fbbf24;opacity:1;stroke-dasharray:none;stroke-width:4}\n.dograce-dogs{position:absolute;inset:0;pointer-events:none}\n.dograce-dog{position:absolute;transform:translate(-50%,-66%);display:flex;flex-direction:column;align-items:center;transition:left .08s linear,top .08s linear}\n.dograce-dog img{width:44px;height:44px;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 3px 3px #000b)}\n.dograce-plate{font-size:10px;font-weight:700;line-height:1;color:#f8fafc;background:#0b1220dd;border:1px solid;border-radius:4px;padding:1px 4px;margin-bottom:2px;white-space:nowrap;text-shadow:0 1px 2px #000}\n.dograce-plate b{display:inline-block;color:#0b1220;border-radius:3px;padding:0 3px;margin-right:2px;font-weight:900}\n.dograce-overlay{position:absolute;left:0;right:0;top:0;z-index:5;text-align:center;pointer-events:none;padding:6px 8px}\n.dograce-ov-top{font-size:14px;font-weight:800;color:#fde68a;text-shadow:0 1px 3px #000,0 0 6px #000}\n.dograce-ov-mid{margin-top:38%;font-size:22px;font-weight:900;color:#fbbf24;text-shadow:0 2px 6px #000}\n.dograce-ov-win{font-size:20px;font-weight:900;color:#fff;text-shadow:0 2px 6px #000,0 0 10px #000}\n.dograce-ov-rank{margin-top:3px;font-size:13px;font-weight:700;color:#e2e8f0;text-shadow:0 1px 3px #000}\n.dograce-ov-rank span{margin:0 5px}\n/* 下注 / 票根 內容區可捲動 */\n.dograce-betwrap,.dograce-tkwrap{position:absolute;inset:0;overflow-y:auto;padding:9px;touch-action:auto;background:#0f1621}\n.dograce-prev{margin:2px 0 8px;padding:5px 8px;border:1px solid #33414d;border-radius:6px;background:#141c28;font-size:12px;color:#cbd5e1}\n.dograce-betbar{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:2px;font-size:13px;font-weight:800;color:#fde68a}\n.dograce-chips{display:flex;align-items:center;gap:3px;font-size:11px;color:#94a3b8;font-weight:600}\n.dograce-chip{min-width:24px;height:22px;border:1px solid #475569;border-radius:5px;background:#1e293b;color:#e2e8f0;font-size:11px;cursor:pointer;padding:0 4px}\n.dograce-chip.is-on{background:#b28c38;color:#0b1220;border-color:#d9bd70;font-weight:800}\n.dograce-resultbar{margin-bottom:6px;padding:5px 7px;border:1px solid #475569;border-radius:6px;background:#141c28;font-size:12px;line-height:1.5}\n.dograce-resultbar b{margin-right:4px}\n.dograce-photo{color:#fca5a5;font-weight:800}\n.dograce-doglist{display:flex;flex-direction:column;gap:4px}\n.dograce-dogcard{display:flex;align-items:center;gap:6px;padding:5px 6px;border:1px solid #33414d;border-radius:7px;background:#161f2c}\n.dograce-num{flex:0 0 auto;width:20px;height:20px;border-radius:5px;color:#0b1220;font-weight:900;font-size:12px;display:flex;align-items:center;justify-content:center}\n.dograce-name{flex:1;min-width:0;font-size:13px;font-weight:700;line-height:1.15;display:flex;flex-direction:column}\n.dograce-name small{font-size:10px;font-weight:400;color:#94a3b8}\n.dograce-odds{flex:0 0 auto;font-size:13px;font-weight:800;color:#fbbf24}\n.dograce-mine{flex:0 0 auto;font-size:10px;color:#6ee7b7;border:1px solid #10b981;border-radius:4px;padding:1px 4px}\n.dograce-betbtn{flex:0 0 auto;padding:4px 9px;border:1px solid #16a34a;border-radius:6px;background:linear-gradient(135deg,#166534,#22c55e);color:#eafff1;font-weight:800;font-size:12px;cursor:pointer}\n.dograce-betbtn:hover{filter:brightness(1.12)}\n.dograce-lock{flex:0 0 auto;color:#64748b;width:44px;text-align:center}\n.dograce-foot{margin-top:7px;font-size:10px;color:#64748b;text-align:center}\n/* 票根面板 */\n.dograce-tkhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-size:13px;font-weight:800;color:#fde68a}\n.dograce-clear{border:1px solid #475569;border-radius:5px;background:#1e293b;color:#cbd5e1;font-size:10px;padding:3px 6px;cursor:pointer}\n.dograce-empty{padding:22px 8px;text-align:center;color:#64748b;font-size:12px}\n.dograce-tklist{display:flex;flex-direction:column;gap:5px}\n.dograce-tk{display:grid;grid-template-columns:1fr auto;grid-template-areas:\"main right\" \"sub right\";gap:1px 8px;padding:6px 8px;border:1px solid #33414d;border-left-width:4px;border-radius:6px;background:#161f2c}\n.dograce-tk.pend{border-left-color:#64748b}\n.dograce-tk.win{border-left-color:#fbbf24;background:#2a2410}\n.dograce-tk.done{border-left-color:#10b981}\n.dograce-tk.lose{border-left-color:#7f1d1d;opacity:.75}\n.dograce-tk-main{grid-area:main;font-size:13px}\n.dograce-tk-odds{font-size:11px;color:#94a3b8}\n.dograce-tk-sub{grid-area:sub;font-size:10px;color:#64748b}\n.dograce-tk-right{grid-area:right;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:3px}\n.dograce-tk-badge{font-size:11px;font-weight:700}\n.dograce-claim{border:1px solid #d9bd70;border-radius:6px;background:linear-gradient(135deg,#a16207,#eab308);color:#1a1200;font-weight:900;font-size:11px;padding:3px 8px;cursor:pointer;white-space:nowrap}\n.dograce-claim:hover{filter:brightness(1.12)}\n.dograce-tk-pay{font-size:11px;color:#6ee7b7;font-weight:700}\n/* 縮球 */\n.dograce-ball{position:fixed;z-index:74;width:56px;height:56px;border-radius:50%;border:2px solid #d9bd70;\n  background:radial-gradient(circle at 40% 35%,#3d2b0e,#0f1621);box-shadow:0 6px 16px #000b;color:#fde68a;\n  display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;touch-action:none;user-select:none}\n.dograce-ball-ico{font-size:20px;line-height:1}\n.dograce-ball-cd{font-size:10px;font-weight:800;line-height:1;margin-top:1px}\n/* 縮球階段色：一眼看出能不能押注 / 開賽倒數 */\n.dograce-ball.db-bet{border-color:#22c55e;box-shadow:0 6px 16px #000b,0 0 10px #22c55e88;color:#bbf7d0}\n.dograce-ball.db-parade{border-color:#f59e0b;box-shadow:0 6px 16px #000b,0 0 12px #f59e0bcc;color:#fde68a;animation:dograce-pulse 1s ease-in-out infinite}\n.dograce-ball.db-race{border-color:#ef4444;box-shadow:0 6px 16px #000b,0 0 14px #ef4444cc;color:#fecaca;animation:dograce-pulse .7s ease-in-out infinite}\n.dograce-ball.db-result{border-color:#d9bd70;box-shadow:0 6px 16px #000b,0 0 10px #d9bd7099;color:#fde68a}\n@keyframes dograce-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}\n@media(max-width:760px){\n  .dograce-win{width:96vw;height:calc(var(--fu-avail-h,calc(100vh - var(--orig-bar-h,0px))) * .9)}\n  .dograce-dog img{width:50px;height:50px}\n  .dograce-plate{font-size:11px}\n}\n"; (document.head || document.documentElement).appendChild(st); })();

    // ---- 時間常數（一場 5 分鐘；全部具名，方便調節奏） ----
    var CYCLE_MS = 300000;      // 一場總長（5 分鐘）
    var BET_MS = 240000;        // 下注/看狀態 [0,4分)
    var PARADE_MS = 250000;     // 封盤入閘 [4分,4分10秒) → 10 秒
    var RACE_MS = 270000;       // 比賽 [4分10秒,4分30秒) → 20 秒
    // RESULT [4分30秒,5分) → 結算+等待下一場 30 秒
    var RACE_DUR = RACE_MS - PARADE_MS;   // 比賽動畫時長

    // ---- 經濟常數 ----
    var TICKET_PRICE = 10000;         // 一張票 1 萬金幣
    var MAX_TICKETS_PER_RACE = 999;   // 單場買票張數上限（純防手滑）
    var HOUSE_EDGE = 0.2;             // 莊家抽成（還原原版 ~20% 稅）
    var TICKET_KEEP = 40;             // 「已領/未中」票根軟上限（未領中獎票不受限、永不自動清）

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

    // ---- 時鐘（可被 debug 覆寫，供測試強制階段） ----
    var _nowOverride = null;
    function nowMs() { return (_nowOverride != null) ? _nowOverride : Date.now(); }

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

    // ---- 一場的完整資料（memoize） ----
    var _raceCache = {};
    function seededRace(raceId) {
        if (_raceCache[raceId]) return _raceCache[raceId];
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
        var TEMP = 3.0, sumW = 0;
        for (i = 0; i < N_DOGS; i++) { dogs[i]._w = Math.exp(dogs[i].power / TEMP); sumW += dogs[i]._w; }
        for (i = 0; i < N_DOGS; i++) {
            dogs[i].prob = dogs[i]._w / sumW;
            dogs[i].odds = Math.max(1.2, Math.round((1 / dogs[i].prob) * (1 - HOUSE_EDGE) * 10) / 10);
        }
        var winner = pickWeighted(rng, dogs.map(function (d) { return d._w; }));
        var rest = [];
        for (i = 0; i < N_DOGS; i++) if (i !== winner) rest.push({ idx: i, s: dogs[i].power + (rng() - 0.5) * 3 });
        rest.sort(function (a, b) { return b.s - a.s; });
        var order = [winner].concat(rest.map(function (o) { return o.idx; }));
        var rankOf = {}; for (i = 0; i < order.length; i++) rankOf[order[i]] = i;

        // 動畫參數（戲劇性引擎）：winner 後段爆發、指定一隻領跑者前段衝 → 最後直道逆轉
        var photo = rng() < 0.28;
        var pacer = order[1 + Math.floor(rng() * Math.max(1, N_DOGS - 1))];
        var anim = [];
        for (i = 0; i < N_DOGS; i++) {
            var rank = rankOf[i];
            var finish = 1.0 - rank * 0.028;
            if (rank === 1 && photo) finish = 0.994;
            var paceBias;
            if (i === winner) paceBias = 0.55;
            else if (i === pacer) paceBias = -0.5;
            else paceBias = (rng() - 0.5) * 0.5;
            anim.push({
                finish: finish,
                exp: Math.max(0.55, Math.min(1.9, 1 + paceBias)),
                wAmp: 0.045 + dogs[i].variance * 0.075,
                wFreq: 1.4 + rng() * 2.4,
                wPhase: rng() * Math.PI * 2
            });
        }
        var race = { raceId: raceId, startMs: raceId * CYCLE_MS, dogs: dogs, order: order, rankOf: rankOf, winner: winner, photo: photo, anim: anim };
        _raceCache[raceId] = race;
        return race;
    }

    // 沿賽道進度：u = 比賽進度 0..1 → 該狗 progress 0..1（純函式，中途進場一致）
    function progressAt(race, dogIdx, u) {
        u = clamp01(u);
        var a = race.anim[dogIdx];
        var shape = Math.pow(u, a.exp) * a.finish;
        var wob = a.wAmp * Math.sin(Math.PI * 2 * (a.wFreq * u + a.wPhase)) * u * (1 - u);
        var p = shape + wob;
        if (p < 0) p = 0;
        var cap = (dogIdx === race.winner) ? 1.0 : 0.985;
        if (p > cap) p = cap;
        return p;
    }
    function winnerOf(raceId) { return seededRace(raceId).winner; }
    function recentForm(dogIdx, curRaceId, K) {
        var w = 0, total = 0;
        for (var r = curRaceId - K; r < curRaceId; r++) { if (r < 0) continue; total++; if (seededRace(r).winner === dogIdx) w++; }
        return { w: w, total: total };
    }

    // ================= 下注 / 票根 =================
    function ensureTickets() {
        if (typeof player === 'undefined' || !player) return null;
        if (!Array.isArray(player.raceTickets)) player.raceTickets = [];
        return player.raceTickets;
    }
    function betsThisRace(raceId) {
        var t = ensureTickets(); if (!t) return { count: 0, gold: 0, byDog: {} };
        var c = 0, g = 0, by = {};
        for (var i = 0; i < t.length; i++) if (t[i].raceId === raceId) {
            c += t[i].count; g += t[i].count * TICKET_PRICE;
            by[t[i].dogIdx] = (by[t[i].dogIdx] || 0) + t[i].count;
        }
        return { count: c, gold: g, byDog: by };
    }
    function placeBet(dogIdx, count) {
        count = Math.floor(count);
        if (typeof player === 'undefined' || !player || !player.cls) { logMsg('尚未載入角色，無法下注。', true); return false; }
        var ph = phaseOf(nowMs());
        if (ph.phase !== 'bet') { logMsg('已封盤，等下一場再下注。', true); return false; }
        if (!(count > 0)) return false;
        var t = ensureTickets();
        var already = betsThisRace(ph.raceId).count;
        if (already + count > MAX_TICKETS_PER_RACE) { logMsg('超過單場買票上限。', true); return false; }
        var cost = count * TICKET_PRICE;
        if ((player.gold || 0) < cost) { logMsg('金幣不足。', true); return false; }
        var dog = seededRace(ph.raceId).dogs[dogIdx];
        player.gold -= cost;
        t.push({ raceId: ph.raceId, dogIdx: dogIdx, dogName: dog.name, count: count, odds: dog.odds, claimed: false });
        afterGoldChange();
        logMsg('下注 ' + dog.name + ' × ' + count + ' 張（' + cost.toLocaleString() + ' 金幣）');
        return true;
    }
    function ticketResult(ticket, curRaceId) {
        if (ticket.raceId >= curRaceId) return 'pending';
        return (winnerOf(ticket.raceId) === ticket.dogIdx) ? 'win' : 'lose';
    }
    function ticketPayout(ticket) { return Math.round(ticket.count * ticket.odds * TICKET_PRICE); }
    function claimTicket(id) {
        var t = ensureTickets(); if (!t) return false;
        var tk = t[id]; if (!tk || tk.claimed) return false;
        if (ticketResult(tk, phaseOf(nowMs()).raceId) !== 'win') return false;
        if (!player.cls) { logMsg('尚未載入角色，無法領獎。', true); return false; }
        var pay = ticketPayout(tk);
        player.gold = (player.gold || 0) + pay;
        tk.claimed = true;
        afterGoldChange();
        logMsg('🎉 ' + tk.dogName + ' 中獎！領取 ' + pay.toLocaleString() + ' 金幣');
        return true;
    }
    function pruneTickets() {
        var t = ensureTickets(); if (!t) return;
        var cur = phaseOf(nowMs()).raceId, removable = [];
        for (var i = 0; i < t.length; i++) { var res = ticketResult(t[i], cur); if (t[i].claimed || res === 'lose') removable.push(i); }
        var over = removable.length - TICKET_KEEP;
        if (over > 0) {
            var kill = {};
            for (var k = 0; k < over; k++) kill[removable[k]] = true;
            player.raceTickets = t.filter(function (_, idx) { return !kill[idx]; });
        }
    }
    function clearFinishedTickets() {
        var t = ensureTickets(); if (!t) return;
        var cur = phaseOf(nowMs()).raceId;
        player.raceTickets = t.filter(function (tk) { var res = ticketResult(tk, cur); return !(tk.claimed || res === 'lose'); });
        if (typeof saveGame === 'function') saveGame();
        renderTicketPanel();
    }
    function afterGoldChange() {
        if (typeof saveGame === 'function') saveGame();
        if (typeof updateUI === 'function') { try { updateUI(); } catch (e) { } }
    }
    function logMsg(msg, warn) {
        if (typeof logSys === 'function') logSys(warn ? '<span class="text-amber-300">🐕 ' + msg + '</span>' : '🐕 ' + msg);
    }

    // ================= UI：浮動視窗 / 縮球 / 大 U 型賽道 =================
    var WIN_POS = 'dograce_winpos', BALL_POS = 'dograce_ballpos';
    var _raf = null, _lastSec = -1, _tab = 'race', _betCount = 1;
    var _subview = '', _subviewRaceId = -1, _seenResult = {};

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
                '<button type="button" class="dograce-tab" data-tab="tickets">🎫 票根</button>' +
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
        var dogBet = e.target.closest('[data-bet]');
        if (dogBet) { if (placeBet(parseInt(dogBet.getAttribute('data-bet'), 10), _betCount)) renderBetPanel(phaseOf(nowMs())); return; }
        var chip = e.target.closest('[data-chip]');
        if (chip) { _betCount = parseInt(chip.getAttribute('data-chip'), 10); renderBetPanel(phaseOf(nowMs())); return; }
        var claim = e.target.closest('[data-claim]');
        if (claim) { if (claimTicket(parseInt(claim.getAttribute('data-claim'), 10))) renderTicketPanel(); return; }
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

    function isMobileNonBattle() {
        // ⚠ afk-mobile 的檢視 class 是 mview-left/center/right,「戰鬥」=mview-center(沒有 mview-battle 這個名字——
        //   之前寫錯害手機上圓球永遠被藏,玩家在奇岩看不到入口)。
        var b = document.body;
        return b.classList.contains('m-mobile') && !b.classList.contains('mview-center');
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
        var hide = isMobileNonBattle();
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
            node.style.top = Math.max(bt, Math.min(usableBottom() - 40, p.top)) + 'px';   // 舊存的位置可能記在橫幅底下 → 一併夾回來
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
            dog.style.zIndex = String(10 + Math.round(along * 60));
        }
    }
    function updateOverlay(ph, race, u) {
        var ov = el('dograce-overlay'); if (!ov) return;
        if (ph.phase === 'parade') { ov.innerHTML = '<div class="dograce-ov-mid">🚦 入閘中…</div>'; return; }
        if (ph.phase === 'race') {
            var lead = 0, lp = -1;
            for (var i = 0; i < N_DOGS; i++) { var p = progressAt(race, i, u); if (p > lp) { lp = p; lead = i; } }
            ov.innerHTML = '<div class="dograce-ov-top">🏃 領先：<b style="color:' + DOGS[lead].color + '">' + DOGS[lead].name + '</b>' + (u > 0.85 ? '　最後直道！' : '') + '</div>';
            return;
        }
        if (ph.phase === 'result') {
            ov.innerHTML = '<div class="dograce-ov-win">🏆 <b style="color:' + DOGS[race.winner].color + '">' + DOGS[race.winner].name + '</b> 獲勝</div>' +
                '<div class="dograce-ov-rank">' + race.order.slice(0, 3).map(function (idx, r) { return '<span>' + (r + 1) + '. <b style="color:' + DOGS[idx].color + '">' + DOGS[idx].name + '</b></span>'; }).join('') + '</div>';
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
    function startLoop() { if (_raf == null) _raf = requestAnimationFrame(loop); }
    function stopLoop() { if (_raf != null) { cancelAnimationFrame(_raf); _raf = null; } }
    function loop() {
        _raf = requestAnimationFrame(loop);
        var win = el('dograce-win'), ball = el('dograce-ball');
        var winOpen = win && win.style.display !== 'none';
        var ballOpen = ball && ball.style.display !== 'none';
        if (!winOpen && !ballOpen) { stopLoop(); return; }
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
        var race = seededRace(ph.raceId);
        if (_tab === 'tickets') renderTicketPanel();
        if (betsThisRace(ph.raceId).byDog[race.winner]) logMsg('🎉 ' + DOGS[race.winner].name + ' 獲勝！你押中了，到「票根」領獎');
    }

    // ---- 面板 ----
    function syncTabs() {
        var tabs = document.querySelectorAll('#dograce-win .dograce-tab');
        for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('is-active', tabs[i].getAttribute('data-tab') === _tab);
    }
    function renderBetPanel(ph) {
        var panel = el('dograce-panel'); if (!panel) return;
        ph = ph || phaseOf(nowMs());
        var race = seededRace(ph.raceId), bets = betsThisRace(ph.raceId);
        var gold = (typeof player !== 'undefined' && player && player.gold) || 0;
        var prev = seededRace(ph.raceId - 1);
        var html = '<div class="dograce-betwrap">';
        html += '<div class="dograce-betbar"><span>💰 ' + gold.toLocaleString() + '</span><span class="dograce-chips">每次';
        [1, 5, 10, 50].forEach(function (c) { html += '<button type="button" class="dograce-chip' + (_betCount === c ? ' is-on' : '') + '" data-chip="' + c + '">' + c + '</button>'; });
        html += '張</span></div>';
        html += '<div class="dograce-prev">上一場冠軍：<b style="color:' + DOGS[prev.winner].color + '">' + DOGS[prev.winner].name + '</b>　·　開始下注，賭誰第一</div>';
        html += '<div class="dograce-doglist">';
        for (var i = 0; i < N_DOGS; i++) {
            var d = race.dogs[i], rf = recentForm(i, ph.raceId, 8), mine = bets.byDog[i] || 0;
            html += '<div class="dograce-dogcard">' +
                '<span class="dograce-num" style="background:' + d.color + '">' + (i + 1) + '</span>' +
                '<span class="dograce-name">' + d.name + '<small>' + d.stateEmoji + d.state + '　近' + rf.total + '場' + rf.w + '勝</small></span>' +
                '<span class="dograce-odds">×' + d.odds.toFixed(1) + '</span>' +
                (mine ? '<span class="dograce-mine">持' + mine + '</span>' : '') +
                '<button type="button" class="dograce-betbtn" data-bet="' + i + '">下注</button>' +
                '</div>';
        }
        html += '</div>';
        html += '<div class="dograce-foot">一張 ' + TICKET_PRICE.toLocaleString() + ' 金幣・莊家抽成 ' + (HOUSE_EDGE * 100) + '%・本場已押 ' + bets.count + ' 張</div>';
        html += '</div>';
        panel.innerHTML = html;
    }
    function renderTicketPanel() {
        if (_tab !== 'tickets') return;
        var panel = el('dograce-panel'); if (!panel) return;
        var t = ensureTickets() || [], cur = phaseOf(nowMs()).raceId;
        var html = '<div class="dograce-tkwrap"><div class="dograce-tkhead"><span>🎫 我的票根（' + t.length + '）</span><button type="button" class="dograce-clear" data-clearticket="1">🗑 清除未中/已領</button></div>';
        if (!t.length) { html += '<div class="dograce-empty">還沒有票根。到「賽事」買張票吧！</div></div>'; panel.innerHTML = html; return; }
        html += '<div class="dograce-tklist">';
        for (var i = t.length - 1; i >= 0; i--) {
            var tk = t[i], res = ticketResult(tk, cur), badge, cls;
            if (res === 'pending') { badge = '🕓 待開獎'; cls = 'pend'; }
            else if (res === 'win') { badge = tk.claimed ? '✅ 已領' : '🎉 中獎'; cls = tk.claimed ? 'done' : 'win'; }
            else { badge = '❌ 未中'; cls = 'lose'; }
            html += '<div class="dograce-tk ' + cls + '">' +
                '<div class="dograce-tk-main"><b>' + tk.dogName + '</b> ×' + tk.count + '　<span class="dograce-tk-odds">賠 ×' + tk.odds.toFixed(1) + '</span></div>' +
                '<div class="dograce-tk-sub">' + fmtRaceLabel(tk.raceId) + '</div>' +
                '<div class="dograce-tk-right"><span class="dograce-tk-badge">' + badge + '</span>' +
                (res === 'win' && !tk.claimed ? '<button type="button" class="dograce-claim" data-claim="' + i + '">領 ' + ticketPayout(tk).toLocaleString() + '</button>' :
                    (res === 'win' ? '<span class="dograce-tk-pay">+' + ticketPayout(tk).toLocaleString() + '</span>' : '')) +
                '</div></div>';
        }
        html += '</div></div>';
        panel.innerHTML = html;
    }

    // ================= debug =================
    window.__race = {
        CYCLE_MS: CYCLE_MS,
        phases: { CYCLE: CYCLE_MS, BET: BET_MS, PARADE: PARADE_MS, RACE: RACE_MS },
        setNow: function (ms) { _nowOverride = ms; },
        offset: function (ms) { _nowOverride = Date.now() + ms; },
        clearNow: function () { _nowOverride = null; },
        phase: function () { return phaseOf(nowMs()); },
        race: function (id) { return seededRace(id == null ? phaseOf(nowMs()).raceId : id); },
        winner: winnerOf, placeBet: placeBet, claim: claimTicket, DOGS: DOGS
    };

    // 🎯 入口：自動化分頁「🔌 外掛」列（木人場旁）加「🐕 賽狗場」鈕；視窗/縮球一旦開啟即跨畫面常駐（可拖曳/縮球）。
    function injectAutoNav() {
        var panel = document.getElementById('tab-automation');
        var scroll = panel;
        if (!panel) { panel = document.getElementById('automation-panel'); scroll = panel && (panel.querySelector('.overflow-y-auto') || panel); }
        if (!panel) return false;
        if (document.getElementById('m-afk-nav-dograce')) return true;
        var row = document.getElementById('m-afk-navrow');
        if (!row) {
            row = document.createElement('div');
            row.id = 'm-afk-navrow';
            row.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700';
            row.innerHTML = '<div class="text-sm text-amber-400 mb-2 border-b border-slate-700 pb-1 font-bold">🔌 外掛</div>' +
                '<div id="m-afk-navrow-btns" style="display:flex;gap:8px;flex-wrap:wrap;"></div>';
            scroll.appendChild(row);
        }
        var b = document.createElement('button');
        b.id = 'm-afk-nav-dograce'; b.type = 'button';
        b.className = 'btn py-2 text-sm bg-slate-700 hover:bg-slate-600 border-slate-500';
        b.style.width = '100%';
        b.style.marginTop = '8px';
        b.textContent = '🐕 賽狗場';
        b.addEventListener('click', function () { window.openRaceWindow(); });
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
