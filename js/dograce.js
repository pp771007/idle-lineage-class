// ===== 奇岩賽狗場（賭狗）核心 =====
// 核心哲學：整場賽事用 Date.now()（UTC epoch）固化 — raceId = floor(now/CYCLE_MS)，
// 用 raceId 當種子的 PRNG 產生「這場的狗群狀態、賠率、逐格位置、名次、贏家」。
// 所有人同一真實時間看到同一場、同樣結果；中途進場也用同一組純函式算到「現在該在的位置」。
// 下注買票（票存 player.raceTickets、與金幣原子扣款）；開獎不自動領，玩家自己按領獎、票留著可炫耀。
// 檔名刻意不用數字開頭（比照 js/offline.js），避免日後手動合併原版新增 js/2x-*.js 撞名。
(function () {
    'use strict';

    // ---- 時間常數（一場 3 分鐘；全部具名，方便調節奏） ----
    var CYCLE_MS = 180000;      // 一場總長
    var BET_MS = 120000;        // 下注 [0,120s)
    var PARADE_MS = 130000;     // 封盤入閘 [120s,130s)
    var RACE_MS = 160000;       // 比賽 [130s,160s) → 30 秒
    // RESULT [160s,180s) → 結算+等待下一場
    var RACE_DUR = RACE_MS - PARADE_MS;   // 比賽動畫時長 30000ms

    // ---- 經濟常數 ----
    var TICKET_PRICE = 10000;         // 一張票 1 萬金幣
    var MAX_TICKETS_PER_RACE = 999;   // 單場買票張數上限（純防手滑）
    var HOUSE_EDGE = 0.2;             // 莊家抽成（還原原版 ~20% 稅）
    var TICKET_KEEP = 40;             // 「已領/未中」票根軟上限（未領中獎票不受限、永不自動清）

    // ---- 固定狗群（跨場固定身分；由強到弱＝賽道 1~8 號） ----
    // baseRating 先天強弱、variance 穩定/爆冷程度（高＝狀態擺盪大、易爆冷）
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
    // 可見狀態 5 級（極佳→低迷）：顯示標籤 + 對實力的加成基準
    var STATES = [
        { label: '極佳', emoji: '🔥', mod: 2.4 },
        { label: '良好', emoji: '😊', mod: 1.1 },
        { label: '普通', emoji: '😐', mod: 0.0 },
        { label: '欠佳', emoji: '😰', mod: -1.2 },
        { label: '低迷', emoji: '🥶', mod: -2.6 }
    ];
    var STATE_PICK_W = [1, 2, 3, 2, 1];   // 狀態抽取權重（鐘形，普通最常見）

    // ---- 時鐘（可被 debug 覆寫，供測試強制階段） ----
    var _nowOverride = null;
    function nowMs() { return (_nowOverride != null) ? _nowOverride : Date.now(); }

    // ---- 種子 PRNG（純函式、不用 Math.random） ----
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

    // ---- 階段判定 ----
    function phaseOf(now) {
        var raceId = Math.floor(now / CYCLE_MS);
        var e = now - raceId * CYCLE_MS;   // 本場已過毫秒
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
        var i;
        var dogs = [];
        // 1) 每場可見狀態 + 本場實力
        for (i = 0; i < N_DOGS; i++) {
            var base = DOGS[i];
            var st = pickWeighted(rng, STATE_PICK_W);
            var stateMod = STATES[st].mod * (0.6 + base.variance);   // 高變異狗狀態擺盪更大
            var power = base.baseRating + stateMod;
            dogs.push({
                idx: i, name: base.name, form: base.form, color: base.color,
                variance: base.variance,
                stateIdx: st, state: STATES[st].label, stateEmoji: STATES[st].emoji,
                power: power
            });
        }
        // 2) 賠率（由實力估勝率；莊家抽成後顯示）
        var TEMP = 3.0, sumW = 0;
        for (i = 0; i < N_DOGS; i++) { dogs[i]._w = Math.exp(dogs[i].power / TEMP); sumW += dogs[i]._w; }
        for (i = 0; i < N_DOGS; i++) {
            dogs[i].prob = dogs[i]._w / sumW;
            dogs[i].odds = Math.max(1.2, Math.round((1 / dogs[i].prob) * (1 - HOUSE_EDGE) * 10) / 10);
        }
        // 3) 贏家：依實力權重抽（熱門常勝、偶爆冷；實際勝率＝prob，與賠率一致）
        var winner = pickWeighted(rng, dogs.map(function (d) { return d._w; }));
        // 4) 名次：贏家第一，其餘依 實力+微擾 排序
        var rest = [];
        for (i = 0; i < N_DOGS; i++) if (i !== winner) rest.push({ idx: i, s: dogs[i].power + (rng() - 0.5) * 3 });
        rest.sort(function (a, b) { return b.s - a.s; });
        var order = [winner].concat(rest.map(function (o) { return o.idx; }));
        var rankOf = {}; for (i = 0; i < order.length; i++) rankOf[order[i]] = i;

        // 5) 動畫參數（戲劇性引擎）：每隻一組 pace/wobble；由種子固化
        //    winner 後段爆發（back-loaded）、指定一隻領跑者前段衝（front-loaded）→ 最後直道逆轉
        var photo = rng() < 0.28;   // 這場是否貼身封線
        var pacer = order[1 + Math.floor(rng() * Math.max(1, N_DOGS - 1))];   // 領跑者（非贏家）
        var anim = [];
        for (i = 0; i < N_DOGS; i++) {
            var rank = rankOf[i];
            // 終點目標進度：第1名=1.0，其後遞減；photo finish 時第2名貼近
            var finish = 1.0 - rank * 0.028;
            if (rank === 1 && photo) finish = 0.994;
            var paceBias;
            if (i === winner) paceBias = 0.55;            // 後段爆發
            else if (i === pacer) paceBias = -0.5;        // 前段衝
            else paceBias = (rng() - 0.5) * 0.5;
            anim.push({
                finish: finish,
                exp: Math.max(0.55, Math.min(1.9, 1 + paceBias)),   // shape 指數
                wAmp: 0.045 + dogs[i].variance * 0.075,             // 中段擺盪幅度
                wFreq: 1.4 + rng() * 2.4,
                wPhase: rng() * Math.PI * 2
            });
        }

        var race = {
            raceId: raceId, startMs: raceId * CYCLE_MS,
            dogs: dogs, order: order, rankOf: rankOf, winner: winner, photo: photo, anim: anim
        };
        _raceCache[raceId] = race;
        return race;
    }

    // 逐格位置：u = 比賽進度 0..1 → 該狗 progress 0..1（純函式，中途進場一致）
    function progressAt(race, dogIdx, u) {
        u = Math.max(0, Math.min(1, u));
        var a = race.anim[dogIdx];
        var shape = Math.pow(u, a.exp) * a.finish;
        var wob = a.wAmp * Math.sin(Math.PI * 2 * (a.wFreq * u + a.wPhase)) * u * (1 - u);   // 兩端為 0→不動名次
        var p = shape + wob;
        if (p < 0) p = 0;
        var cap = (dogIdx === race.winner) ? 1.0 : 0.985;   // 只有贏家能到終點
        if (p > cap) p = cap;
        return p;
    }
    function winnerOf(raceId) { return seededRace(raceId).winner; }

    // 近況：重算過去 K 場名次，回 {w, l}
    function recentForm(dogIdx, curRaceId, K) {
        var w = 0, total = 0;
        for (var r = curRaceId - K; r < curRaceId; r++) {
            if (r < 0) continue;
            total++;
            if (seededRace(r).winner === dogIdx) w++;
        }
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
        var race = seededRace(ph.raceId);
        var dog = race.dogs[dogIdx];
        player.gold -= cost;
        t.push({ raceId: ph.raceId, dogIdx: dogIdx, dogName: dog.name, count: count, odds: dog.odds, claimed: false });
        afterGoldChange();
        logMsg('下注 ' + dog.name + ' × ' + count + ' 張（' + cost.toLocaleString() + ' 金幣）');
        return true;
    }
    // 票的開獎結果（純算，不寫檔）：'pending' | 'win' | 'lose'
    function ticketResult(ticket, curRaceId) {
        if (ticket.raceId >= curRaceId) return 'pending';
        return (winnerOf(ticket.raceId) === ticket.dogIdx) ? 'win' : 'lose';
    }
    function ticketPayout(ticket) { return Math.round(ticket.count * ticket.odds * TICKET_PRICE); }
    function claimTicket(id) {
        var t = ensureTickets(); if (!t) return false;
        var tk = t[id]; if (!tk || tk.claimed) return false;
        var cur = phaseOf(nowMs()).raceId;
        if (ticketResult(tk, cur) !== 'win') return false;
        if (!player.cls) { logMsg('尚未載入角色，無法領獎。', true); return false; }
        var pay = ticketPayout(tk);
        player.gold = (player.gold || 0) + pay;
        tk.claimed = true;
        afterGoldChange();
        logMsg('🎉 ' + tk.dogName + ' 中獎！領取 ' + pay.toLocaleString() + ' 金幣');
        return true;
    }
    // 清理「已領/未中」票根軟上限；未領中獎票永不動
    function pruneTickets() {
        var t = ensureTickets(); if (!t) return;
        var cur = phaseOf(nowMs()).raceId;
        var removable = [];
        for (var i = 0; i < t.length; i++) {
            var res = ticketResult(t[i], cur);
            if (t[i].claimed || res === 'lose') removable.push(i);
        }
        var over = removable.length - TICKET_KEEP;
        if (over > 0) {
            var kill = {};
            for (var k = 0; k < over; k++) kill[removable[k]] = true;   // 移除最舊的
            player.raceTickets = t.filter(function (_, idx) { return !kill[idx]; });
        }
    }
    function clearFinishedTickets() {
        var t = ensureTickets(); if (!t) return;
        var cur = phaseOf(nowMs()).raceId;
        player.raceTickets = t.filter(function (tk) {
            var res = ticketResult(tk, cur);
            return !(tk.claimed || res === 'lose');   // 留下：待開獎、未領中獎
        });
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

    // ================= UI：浮動視窗 / 縮球 / U 型賽道 =================
    var WIN_POS = 'dograce_winpos', BALL_POS = 'dograce_ballpos';
    var _raf = null, _lastSec = -1, _lastPhaseKey = '', _tab = 'race', _betCount = 1;
    var _seenResult = {};   // raceId → 已提示過中獎

    function el(id) { return document.getElementById(id); }
    function fmtCountdown(ms) {
        var s = Math.max(0, Math.ceil(ms / 1000));
        var m = Math.floor(s / 60); s = s % 60;
        return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }
    function fmtRaceLabel(raceId) {
        var d = new Date(raceId * CYCLE_MS);
        var p = function (n) { return (n < 10 ? '0' : '') + n; };
        return p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) +
            ' 場 #' + (((raceId % 10000) + 10000) % 10000);
    }

    window.openRaceWindow = function () {
        var win = el('dograce-win');
        if (!win) {
            win = document.createElement('div');
            win.id = 'dograce-win';
            win.className = 'dograce-win';
            win.innerHTML =
                '<div class="dograce-head" id="dograce-head">' +
                '<div class="dograce-title">🐕 奇岩賽狗場<span id="dograce-phase" class="dograce-phase"></span></div>' +
                '<div class="dograce-headbtns">' +
                '<button type="button" class="dograce-hb" data-act="ball" title="縮成小球">●</button>' +
                '<button type="button" class="dograce-hb" data-act="min" title="收合/展開">－</button>' +
                '<button type="button" class="dograce-hb" data-act="close" title="關閉">✖</button>' +
                '</div></div>' +
                '<div class="dograce-body" id="dograce-body">' +
                '<div class="dograce-trackwrap" id="dograce-trackwrap"></div>' +
                '<div class="dograce-tabs">' +
                '<button type="button" class="dograce-tab" data-tab="race">🏁 賽道／下注</button>' +
                '<button type="button" class="dograce-tab" data-tab="tickets">🎫 我的票根</button>' +
                '</div>' +
                '<div class="dograce-panel" id="dograce-panel"></div>' +
                '</div>';
            document.body.appendChild(win);
            buildTrack();
            makeDraggable(win, el('dograce-head'));
            restorePos(win, WIN_POS, { right: 12, top: 70 });
            win.addEventListener('click', onWinClick);
            // 手機非戰鬥視圖自動隱藏（不擋換裝）
            if (typeof MutationObserver === 'function') {
                var obs = new MutationObserver(updateVisibility);
                obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
            }
        }
        win.style.display = '';
        var ball = el('dograce-ball'); if (ball) ball.style.display = 'none';
        _tab = 'race';
        pruneTickets();
        renderAll();
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
        if (tab) { _tab = tab.getAttribute('data-tab'); renderPanel(); syncTabs(); return; }
        var dogBet = e.target.closest('[data-bet]');
        if (dogBet) { if (placeBet(parseInt(dogBet.getAttribute('data-bet'), 10), _betCount)) { renderPanel(); }; return; }
        var chip = e.target.closest('[data-chip]');
        if (chip) { _betCount = parseInt(chip.getAttribute('data-chip'), 10); renderPanel(); return; }
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
            ball.innerHTML = '<div class="dograce-ball-ico">🐕</div><div class="dograce-ball-cd" id="dograce-ball-cd">--:--</div>';
            document.body.appendChild(ball);
            makeDraggable(ball, ball, true);
            restorePos(ball, BALL_POS, { right: 14, bottom: 90 });
            ball.addEventListener('click', function (ev) {
                if (ball._dragged) { ball._dragged = false; return; }
                window.openRaceWindow();
            });
        }
        ball.style.display = '';
        startLoop();
        updateVisibility();
    }

    // 手機（afk-mobile）非戰鬥視圖時隱藏視窗/球，避免擋換裝；桌機不隱藏
    function isMobileNonBattle() {
        var b = document.body;
        return b.classList.contains('m-mobile') && !b.classList.contains('mview-battle');
    }
    function updateVisibility() {
        var hide = isMobileNonBattle();
        var win = el('dograce-win'), ball = el('dograce-ball');
        if (win && win.style.display !== 'none' && !win._userHidden) win.style.visibility = hide ? 'hidden' : '';
        if (ball && ball.style.display !== 'none') ball.style.visibility = hide ? 'hidden' : '';
    }

    // ---- 拖曳（抓 handle；按鈕不觸發）＋位置記憶 ----
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
            var maxX = Math.max(0, innerWidth - node.offsetWidth);
            var maxY = Math.max(0, innerHeight - node.offsetHeight);
            var nx = Math.max(0, Math.min(maxX, e.clientX - drag.dx));
            var ny = Math.max(0, Math.min(maxY, e.clientY - drag.dy));
            node.style.left = nx + 'px'; node.style.top = ny + 'px';
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
        if (p && typeof p.left === 'number') {
            node.style.left = Math.max(0, Math.min(innerWidth - 60, p.left)) + 'px';
            node.style.top = Math.max(0, Math.min(innerHeight - 40, p.top)) + 'px';
            node.style.right = 'auto'; node.style.bottom = 'auto';
        } else {
            if (def.right != null) node.style.right = def.right + 'px';
            if (def.left != null) node.style.left = def.left + 'px';
            if (def.top != null) node.style.top = def.top + 'px';
            if (def.bottom != null) node.style.bottom = def.bottom + 'px';
        }
    }

    // ---- U 型賽道（SVG） ----
    var TRACK_W = 320, TRACK_H = 210;   // viewBox
    var _lanePaths = [], _laneLens = [];
    function buildTrack() {
        var wrap = el('dograce-trackwrap');
        var svg = '<svg id="dograce-svg" viewBox="0 0 ' + TRACK_W + ' ' + TRACK_H + '" preserveAspectRatio="xMidYMid meet">';
        // 8 條同心 ∪ 車道：由外(上)到內。每條 = 左直下→底彎→右直上
        var top = 24, bot = TRACK_H - 20, laneGap = 15, xL = 40, xR = TRACK_W - 40;
        _lanePaths = []; _laneLens = [];
        var i;
        for (i = 0; i < N_DOGS; i++) {
            var off = i * laneGap;
            var lx = xL + off, rx = xR - off, by = bot - off, ty = top;
            var rad = Math.max(6, (rx - lx) / 2);
            var cx = (lx + rx) / 2;
            // path: 從左上往下、底部半圓、右邊往上
            var d = 'M ' + lx + ' ' + ty + ' L ' + lx + ' ' + (by - rad) +
                ' A ' + rad + ' ' + rad + ' 0 0 0 ' + rx + ' ' + (by - rad) +
                ' L ' + rx + ' ' + ty;
            svg += '<path class="dograce-lane" d="' + d + '" stroke="' + DOGS[i].color + '"/>';
        }
        // 起跑/終點線
        svg += '<line class="dograce-line" x1="' + (xL - 8) + '" y1="' + top + '" x2="' + (xL + N_DOGS * laneGap) + '" y2="' + top + '"/>';
        svg += '<line class="dograce-line dograce-finish" x1="' + (xR - N_DOGS * laneGap) + '" y1="' + top + '" x2="' + (xR + 8) + '" y2="' + top + '"/>';
        svg += '</svg>';
        // 狗 sprite 層（絕對定位、以 % 疊在 svg 上）
        svg += '<div class="dograce-dogs" id="dograce-dogs"></div>';
        svg += '<div class="dograce-banner" id="dograce-banner"></div>';
        wrap.innerHTML = svg;
        // 量測每條 lane path 幾何（用隱藏的同 viewBox 計算 getPointAtLength）
        var svgEl = el('dograce-svg');
        var paths = svgEl.querySelectorAll('path.dograce-lane');
        for (i = 0; i < paths.length; i++) { _lanePaths.push(paths[i]); _laneLens.push(paths[i].getTotalLength()); }
        // 建立每隻狗的 sprite 元素
        var dogsLayer = el('dograce-dogs'), html = '';
        for (i = 0; i < N_DOGS; i++) {
            html += '<div class="dograce-dog" id="dgd-' + i + '">' +
                '<div class="dograce-plate" style="border-color:' + DOGS[i].color + '"><b style="background:' + DOGS[i].color + '">' + (i + 1) + '</b>' + DOGS[i].name + '</div>' +
                '<img alt="' + DOGS[i].name + '" src="assets/anim/' + encodeURIComponent(DOGS[i].form) + '/d6/idle_0.png" ' +
                'onerror="this.style.opacity=.4">' +
                '</div>';
        }
        dogsLayer.innerHTML = html;
    }

    function _vecDir(dx, dy) {
        if (typeof _vec2dir === 'function') return _vec2dir(dx, dy);
        var oct = Math.round(Math.atan2(dy, dx) * 4 / Math.PI);
        var map = { '0': 3, '1': 4, '2': 5, '3': 6, '4': 7, '-4': 7, '-3': 0, '-2': 1, '-1': 2 };
        var r = map[String(oct)]; return (r == null) ? 6 : r;
    }
    // 依 progress 放置每隻狗，並用切線方向挑 8 方向 walk 幀
    function placeDogs(race, u, animate) {
        var wrap = el('dograce-trackwrap'); if (!wrap) return;
        var svgEl = el('dograce-svg'); if (!svgEl) return;
        var box = svgEl.getBoundingClientRect();
        var sx = box.width / TRACK_W, sy = box.height / TRACK_H;
        var frame = animate ? (Math.floor(performance.now() / 120) % 4) : 0;
        for (var i = 0; i < N_DOGS; i++) {
            var path = _lanePaths[i], len = _laneLens[i]; if (!path) continue;
            var p = race ? progressAt(race, i, u) : 0;
            var pt = path.getPointAtLength(len * p);
            var pt2 = path.getPointAtLength(Math.min(len, len * p + 1.5));
            var dir = _vecDir(pt2.x - pt.x, pt2.y - pt.y);
            var dog = el('dgd-' + i); if (!dog) continue;
            dog.style.left = (pt.x * sx) + 'px';
            dog.style.top = (pt.y * sy) + 'px';
            var img = dog.firstElementChild.nextElementSibling;
            var act = animate ? 'walk' : 'idle';
            var fn = animate ? frame : 0;
            var src = 'assets/anim/' + encodeURIComponent(DOGS[i].form) + '/d' + dir + '/' + act + '_' + fn + '.png';
            if (img._src !== src) { img._src = src; img.src = src; }
            dog.style.zIndex = String(10 + Math.round(p * 50));
        }
    }

    // ---- 迴圈 ----
    function startLoop() { if (_raf == null) _raf = requestAnimationFrame(loop); }
    function stopLoop() { if (_raf != null) { cancelAnimationFrame(_raf); _raf = null; } }
    function loop() {
        _raf = requestAnimationFrame(loop);
        var win = el('dograce-win'), ball = el('dograce-ball');
        var winOpen = win && win.style.display !== 'none';
        var ballOpen = ball && ball.style.display !== 'none';
        if (!winOpen && !ballOpen) { stopLoop(); return; }
        var now = nowMs();
        var ph = phaseOf(now);
        var race = seededRace(ph.raceId);
        // 縮球：只更新倒數
        if (ballOpen) {
            var cd = el('dograce-ball-cd');
            if (cd) cd.textContent = ballText(ph);
        }
        if (winOpen && !win.classList.contains('is-min')) {
            var phaseKey = ph.phase + ':' + ph.raceId;
            // 秒級：更新倒數/banner 文字
            var sec = Math.floor(now / 1000);
            if (sec !== _lastSec) {
                _lastSec = sec;
                updatePhaseText(ph, race);
            }
            // 階段切換：重繪面板 + 賽道狀態
            if (phaseKey !== _lastPhaseKey) {
                _lastPhaseKey = phaseKey;
                onPhaseChange(ph, race);
            }
            // 比賽中逐幀跑；其餘靜態
            if (ph.phase === 'race') {
                var u = (ph.e - PARADE_MS) / RACE_DUR;
                placeDogs(race, u, true);
                updateBanner(race, u);
            } else if (ph.phase === 'result') {
                placeDogs(race, 1, false);
            } else if (ph.phase === 'parade') {
                placeDogs(race, 0, true);
            } else {
                placeDogs(race, 0, false);
            }
        }
        // 開獎提示（不自動入帳）
        maybeAnnounceResult(ph);
    }
    function ballText(ph) {
        if (ph.phase === 'bet') return fmtCountdown(BET_MS - ph.e);
        if (ph.phase === 'parade') return '入閘';
        if (ph.phase === 'race') return '開跑';
        return '結算';
    }
    function updatePhaseText(ph, race) {
        var pe = el('dograce-phase'); if (!pe) return;
        if (ph.phase === 'bet') pe.textContent = '　下注中 ' + fmtCountdown(BET_MS - ph.e);
        else if (ph.phase === 'parade') pe.textContent = '　入閘… ' + fmtCountdown(PARADE_MS - ph.e);
        else if (ph.phase === 'race') pe.textContent = '　比賽中';
        else pe.textContent = '　下一場 ' + fmtCountdown(CYCLE_MS - ph.e);
    }
    function onPhaseChange(ph, race) {
        if (_tab === 'race') renderPanel();
        else renderTicketPanel();
        var banner = el('dograce-banner');
        if (banner) {
            if (ph.phase === 'bet') banner.textContent = '';
            else if (ph.phase === 'parade') banner.textContent = '入閘中…';
            else if (ph.phase === 'race') banner.textContent = '開跑！';
            else banner.textContent = '';
        }
    }
    function updateBanner(race, u) {
        var banner = el('dograce-banner'); if (!banner) return;
        // 找目前領先
        var lead = -1, lp = -1;
        for (var i = 0; i < N_DOGS; i++) { var p = progressAt(race, i, u); if (p > lp) { lp = p; lead = i; } }
        banner.textContent = '🏃 領先：' + DOGS[lead].name + (u > 0.85 ? '　最後直道！' : '');
    }
    function maybeAnnounceResult(ph) {
        if (ph.phase !== 'result') return;
        if (_seenResult[ph.raceId]) return;
        _seenResult[ph.raceId] = true;
        var race = seededRace(ph.raceId);
        var bets = betsThisRace(ph.raceId);
        // 更新票根徽章
        renderTicketPanel();
        if (bets.byDog[race.winner]) {
            logMsg('🎉 ' + DOGS[race.winner].name + ' 第一！你押中了，快到「我的票根」領獎');
        }
        // 結果 banner（在 race 分頁時顯示名次）
        if (_tab === 'race') renderPanel();
    }

    // ---- 面板渲染 ----
    function renderAll() { syncTabs(); renderPanel(); var now = nowMs(); updatePhaseText(phaseOf(now), seededRace(phaseOf(now).raceId)); placeDogs(seededRace(phaseOf(now).raceId), phaseOf(now).phase === 'result' ? 1 : 0, false); }
    function syncTabs() {
        var tabs = document.querySelectorAll('#dograce-win .dograce-tab');
        for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('is-active', tabs[i].getAttribute('data-tab') === _tab);
    }
    function renderPanel() { if (_tab === 'tickets') return renderTicketPanel(); renderBetPanel(); }

    function renderBetPanel() {
        var panel = el('dograce-panel'); if (!panel) return;
        var now = nowMs(), ph = phaseOf(now), race = seededRace(ph.raceId);
        var bets = betsThisRace(ph.raceId);
        var gold = (typeof player !== 'undefined' && player && player.gold) || 0;
        var html = '';
        // 頂部：金幣 + 每次張數籌碼 + 本場已下注
        html += '<div class="dograce-betbar">';
        html += '<span>💰 ' + gold.toLocaleString() + '</span>';
        html += '<span class="dograce-chips">每次';
        [1, 5, 10, 50].forEach(function (c) {
            html += '<button type="button" class="dograce-chip' + (_betCount === c ? ' is-on' : '') + '" data-chip="' + c + '">' + c + '</button>';
        });
        html += '張</span>';
        html += '</div>';
        if (ph.phase === 'result') {
            html += '<div class="dograce-resultbar">🏁 本場名次：' +
                race.order.slice(0, 3).map(function (idx, r) { return '<b style="color:' + DOGS[idx].color + '">' + (r + 1) + '. ' + DOGS[idx].name + '</b>'; }).join('　') +
                (race.photo ? '　<span class="dograce-photo">📸 一個鼻尖之差！</span>' : '') + '</div>';
        } else if (ph.phase !== 'bet') {
            html += '<div class="dograce-resultbar">🔒 已封盤，比賽進行中…</div>';
        }
        html += '<div class="dograce-doglist">';
        for (var i = 0; i < N_DOGS; i++) {
            var d = race.dogs[i];
            var rf = recentForm(i, ph.raceId, 8);
            var mine = bets.byDog[i] || 0;
            var canBet = (ph.phase === 'bet');
            html += '<div class="dograce-dogcard">' +
                '<span class="dograce-num" style="background:' + d.color + '">' + (i + 1) + '</span>' +
                '<span class="dograce-name">' + d.name + '<small>' + d.stateEmoji + d.state + '　近' + rf.total + '場' + rf.w + '勝</small></span>' +
                '<span class="dograce-odds">×' + d.odds.toFixed(1) + '</span>' +
                (mine ? '<span class="dograce-mine">持' + mine + '</span>' : '') +
                (canBet ? '<button type="button" class="dograce-betbtn" data-bet="' + i + '">下注</button>' : '<span class="dograce-lock">—</span>') +
                '</div>';
        }
        html += '</div>';
        html += '<div class="dograce-foot">一張 ' + TICKET_PRICE.toLocaleString() + ' 金幣・莊家抽成 ' + (HOUSE_EDGE * 100) + '%・本場已押 ' + bets.count + ' 張</div>';
        panel.innerHTML = html;
    }

    function renderTicketPanel() {
        if (_tab !== 'tickets') return;
        var panel = el('dograce-panel'); if (!panel) return;
        var t = ensureTickets() || [];
        var cur = phaseOf(nowMs()).raceId;
        var html = '<div class="dograce-tkhead"><span>🎫 我的票根（' + t.length + '）</span><button type="button" class="dograce-clear" data-clearticket="1">🗑 清除未中/已領</button></div>';
        if (!t.length) { html += '<div class="dograce-empty">還沒有票根。到「賽道／下注」買張票吧！</div>'; panel.innerHTML = html; return; }
        html += '<div class="dograce-tklist">';
        for (var i = t.length - 1; i >= 0; i--) {
            var tk = t[i], res = ticketResult(tk, cur);
            var badge, cls;
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
        html += '</div>';
        panel.innerHTML = html;
    }

    // ================= debug 入口 =================
    window.__race = {
        CYCLE_MS: CYCLE_MS,
        setNow: function (ms) { _nowOverride = ms; },        // 絕對時間覆寫
        offset: function (ms) { _nowOverride = Date.now() + ms; },
        clearNow: function () { _nowOverride = null; },
        phase: function () { return phaseOf(nowMs()); },
        race: function (id) { return seededRace(id == null ? phaseOf(nowMs()).raceId : id); },
        winner: winnerOf,
        placeBet: placeBet, claim: claimTicket,
        DOGS: DOGS
    };

    // 開機
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { console.log('[dograce] ready'); });
    else console.log('[dograce] ready');
})();
