// ============================================================================
// ⚒️ 裝備強化視窗（站長 2026-10-15：照範本圖改版）
//   上：卷軸格 ＋ 要強化的裝備（站長：裝備放右邊；點卷軸格切換 一般／祝福／詛咒）
//   中：成功機率｜強化等級 +N → +N+1｜消失機率，下面列強化前後的能力變化；開始強化鈕（與「連續強化到 +X」）
//   下：分頁（武器／防具／飾品）＋道具格，圖示下方顯示名稱，點一下換成要強化的裝備
//   不顯示金幣（強化本來就不花錢）。
//   規則一律走原本那套：單次＝doEnhance（js/08）、連續＝executeAutoSafeEnhance、詛咒卷軸＝executeCurseDeEnhance（js/10）；
//   機率由 enhanceOutcomeFromRoll（js/01，機率單一真相）均勻取樣算出，不另外抄一份公式。
//   入口：物品視窗的「強化」鈕（js/10 showEnhanceOptions 轉進來）。
// ============================================================================
(function () {
    'use strict';
    const TABS = [['wpn', '武器'], ['arm', '防具'], ['acc', '飾品']];
    // 道具欄雙擊強化卷軸 → 開視窗：分頁跟著卷軸種類、選好那一種卷軸（js/10 renderInv 的 ondblclick 用）
    const SCROLL_TAB = { scroll_weapon: 'wpn', scroll_weapon_b: 'wpn', scroll_weapon_c: 'wpn', scroll_armor: 'arm', scroll_armor_b: 'arm', scroll_armor_c: 'arm', scroll_acc: 'acc' };
    window.enhScrollTab = id => SCROLL_TAB[id] || null;
    let st = { uid: null, isEq: false, tab: 'wpn', scrollPick: 0, result: null };

    const $ = id => document.getElementById(id);
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const pct = x => { let v = Math.round(x * 1000) / 10; return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + '%'; };

    const etype = d => (d && d.slot === 'petwpn') ? 'wpn' : (d && d.type);   // 🐾 寵物武器（之牙）歸在武器、用武器卷軸（成功率照原本飾品的規則）
    function enhanceable(d) { return !!d && ((d.type === 'wpn' && !d.isArrow) || d.type === 'arm' || d.type === 'acc') && !isRelic(d) && !d.noEnhance; }
    function findItem(uid, isEq) {
        if (isEq) { for (let k in player.eq) { let e = player.eq[k]; if (e && e.uid === uid) return e; } return null; }
        return player.inv.find(i => i && i.uid === uid) || null;
    }
    // 道具格清單：身上的在前、背包的在後（同一疊只列一格）
    function listItems(type) {
        let out = [];
        for (let k in player.eq) {
            let e = player.eq[k]; if (!e || k === 'arrow') continue;
            let d = DB.items[e.id]; if (enhanceable(d) && etype(d) === type) out.push({ it: e, isEq: true });
        }
        player.inv.forEach(i => { let d = i && DB.items[i.id]; if (enhanceable(d) && etype(d) === type) out.push({ it: i, isEq: false }); });
        return out;
    }
    // 這件裝備能用的卷軸（依序：一般、祝福、詛咒；沒有的不列）
    function scrollsFor(d) {
        let ids = etype(d) === 'wpn' ? ['scroll_weapon', 'scroll_weapon_b', 'scroll_weapon_c']
                : etype(d) === 'arm' ? ['scroll_armor', 'scroll_armor_b', 'scroll_armor_c']
                : ['scroll_acc'];
        return ids.map(id => player.inv.find(i => i && i.id === id && (i.cnt || 0) > 0)).filter(Boolean);
    }
    // 機率：對 enhanceOutcomeFromRoll 均勻取樣（安定值內不擲骰＝必成）
    function chances(d, en) {
        let safe = d.safe || 0, N = 6000, c = { ok: 0, break: 0, none: 0 };
        if (en < safe) return { ok: 1, break: 0, none: 0 };
        for (let i = 0; i < N; i++) c[enhanceOutcomeFromRoll(d.type, safe, en, (i + 0.5) / N)]++;
        return { ok: c.ok / N, break: c.break / N, none: c.none / N };
    }
    // 強化值 en 時，這件裝備「隨強化變動」的能力（只列會變的）
    function statRows(d, en) {
        let rows = [], ce = capEn(en, d);
        let sign = v => (v > 0 ? '+' : '') + v;
        if (d.type === 'wpn') {
            let b = enhanceWpnBonus(capWpnEn(en));
            rows.push(['額外傷害', sign(b.dmg)], ['額外命中', sign(b.hit)]);
            if (d.mdmgEnFrom7Max3) rows.push(['魔法傷害', sign(Math.min(3, Math.max(0, ce - 6)))]);
        } else if (d.type === 'arm') {
            if (d.armguard) rows.push(['HP', sign(ce * 10)]);
            else rows.push(['防禦', String(-((d.ac || 0) + enhanceArmAc(en)))]);
            if (d.mdmgEnFrom4) rows.push(['魔法傷害', sign(Math.min(6, Math.max(0, ce - 3)))]);
            if (d.drEnFrom7Max3) rows.push(['傷害減免', sign((d.dr || 0) + Math.min(3, Math.max(0, ce - 6)))]);
        } else if (d.type === 'acc') {
            let ae = Math.min(Math.max(Number(en) || 0, 0), 5);
            if (d.slot === 'ring') rows.push(['防禦', String(-((d.ac || 0) + ae))]);
            else if (d.slot === 'amulet') rows.push(['魔防', sign((d.mr || 0) + ae * 3)]);
            else if (d.slot === 'ear') rows.push(['魔防', sign((d.mr || 0) + ae * 2)]);
            else if (d.slot === 'belt') rows.push(['負重上限', sign(ae * 20)]);
        }
        if (d.mrPerEn) rows.push(['魔防', sign((d.mr || 0) + d.mrPerEn * ce)]);
        return rows;
    }
    function iconHTML(it, d, cls) {
        let src = ''; try { src = getIconUrl(d); } catch (e) {}
        let glow = ''; try { glow = getGlowClass(it, d) || ''; } catch (e) {}
        return `<img class="${cls} ${glow}" src="${esc(src)}" alt="" draggable="false" onerror="this.style.visibility='hidden'">`;
    }
    function enTag(en, d) { en = Number(en) || 0; return en ? `<span class="enh-en${d && en > (d.safe || 0) ? ' en-over' : ''}"><b>${en > 0 ? '+' : ''}${en}</b></span>` : ''; }

    function render() {
        let win = $('enh-window'); if (!win) return;
        let it = st.uid ? findItem(st.uid, st.isEq) : null;
        let d = it ? DB.items[it.id] : null;
        if (it && !enhanceable(d)) { it = null; d = null; }
        let en = it ? (Number(it.en) || 0) : 0;
        let cap = d ? enhanceCap(d) : 0;
        let scrolls = d ? scrollsFor(d) : [];
        if (st.scrollId) { let k = scrolls.findIndex(s => s.id === st.scrollId); if (k >= 0) st.scrollPick = k; }   // 從卷軸雙擊進來：選裝備後仍用那一種卷軸
        if (st.scrollPick >= scrolls.length) st.scrollPick = 0;
        let sc = scrolls[st.scrollPick] || (!it && st.scrollId ? player.inv.find(i => i && i.id === st.scrollId && (i.cnt || 0) > 0) : null) || null, sd = sc ? DB.items[sc.id] : null;
        let isCurse = !!(sd && sd.isC), isBless = !!(sd && sd.isB);

        // 上：兩格
        let mainSlot = it
            ? `<div class="enh-slot-box">${iconHTML(it, d, 'enh-slot-img')}${enTag(en, d)}</div><div class="enh-slot-name ${getItemColor(it)}">${esc(d.n)}</div>`
            : `<div class="enh-slot-box empty"></div><div class="enh-slot-name dim">選擇裝備</div>`;
        let scrollSlot = sc
            ? `<div class="enh-slot-box">${iconHTML(sc, sd, 'enh-slot-img')}<span class="enh-cnt">${(sc.cnt || 1).toLocaleString()}</span></div><div class="enh-slot-name ${isBless ? 'text-yellow-300' : isCurse ? 'c-cursed' : ''}">${esc(sd.n)}</div>`
            : `<div class="enh-slot-box empty"></div><div class="enh-slot-name dim">${it ? '沒有卷軸' : '卷軸'}</div>`;
        let canCycle = scrolls.length > 1;

        // 中：機率＋等級＋能力
        let info = '', stats = '', canGo = false, note = '';
        if (it) {
            if (isCurse) {
                info = cell('成功機率', '100%') + cell('強化等級', `+${en} → ${en - 1 >= 0 ? '+' : ''}${en - 1}`);
                stats = statTable(d, en, en - 1);
                canGo = en > -1;
                if (!canGo) note = '已經降到最低';
            } else if (en >= cap) {
                info = cell('成功機率', '—') + cell('強化等級', `+${en}`);
                note = `已達強化上限 +${cap}`;
            } else {
                let c = chances(d, en);
                let to = en + 1, toTxt = '+' + to;
                if (isBless && c.ok > 0) { let mx = Math.min(cap, en + (en <= 2 ? 3 : en <= 5 ? 2 : 1)); if (mx > to) toTxt = `+${to}～+${mx}`; }
                info = cell('成功機率', pct(c.ok)) + cell('強化等級', `+${en} → ${toTxt}`);
                if (c.none > 0) note = `無變化 ${pct(c.none)}`;
                stats = statTable(d, en, to);
                canGo = !!sc;
            }
            if (!sc) canGo = false;
        } else {
            info = cell('成功機率', '—') + cell('強化等級', '—');
        }

        // 連續強化（一般卷軸＋武器／防具，沿用原本的「一鍵強化到指定值」）
        let auto = '';
        if (it && sc && !isBless && !isCurse && (d.type === 'wpn' || d.type === 'arm') && en < cap) {
            let safe = d.safe || 0, max = Math.min(cap, Math.max(safe, en) + 6), def = Math.min(max, Math.max(safe, en + 1)), opts = '';
            for (let t = en + 1; t <= max; t++) opts += `<option value="${t}" ${t === def ? 'selected' : ''}>+${t}${t <= safe ? '（安定）' : ''}</option>`;
            auto = `<div class="enh-auto"><button type="button" class="enh-auto-btn" ${st.busy ? 'disabled' : ''} onclick="enhWinAuto()">連續強化到</button><select id="enh-auto-target" class="enh-auto-sel">${opts}</select></div>`;
        }

        let res = st.result ? `<div class="enh-result ${st.result.cls}">${st.result.html}</div>` : '';

        // 下：分頁＋格子
        let tabs = TABS.map(([k, n]) => `<button type="button" class="enh-tab ${st.tab === k ? 'on' : ''}" onclick="enhWinTab('${k}')">${n}</button>`).join('');
        let list = listItems(st.tab);
        let grid = list.length ? list.map(x => {
            let dd = DB.items[x.it.id], sel = it && x.it.uid === it.uid;
            return `<button type="button" class="enh-cell ${sel ? 'sel' : ''}" onclick="enhWinPick('${x.it.uid}', ${x.isEq})">`
                + `<span class="enh-cell-box">${iconHTML(x.it, dd, 'enh-cell-img')}${enTag(x.it.en, dd)}${x.isEq ? '<span class="enh-eq">E</span>' : ''}${(x.it.cnt || 1) > 1 ? `<span class="enh-cnt">${x.it.cnt}</span>` : ''}</span>`
                + `<span class="enh-cell-name ${getItemColor(x.it)}">${esc(dd.n)}</span></button>`;
        }).join('') : `<div class="enh-empty">沒有可以強化的${TABS.find(t => t[0] === st.tab)[1]}</div>`;

        let body = win.querySelector('.enh-body'), og = body.querySelector('.enh-grid'), gTop = og ? og.scrollTop : 0;   // 清單自己捲動：重畫後捲回原位（點下面的道具不會跳回頂端）
        body.innerHTML =
            `<div class="enh-slots">
                <div class="enh-slot sc ${canCycle ? 'cycle' : ''}" ${canCycle && !st.busy ? 'onclick="enhWinCycle()"' : ''}>${scrollSlot}${canCycle ? '<span class="enh-cycle-tip">點擊換卷軸</span>' : ''}</div>
                <div class="enh-plus">＋</div>
                <div class="enh-slot eq">${mainSlot}</div>
            </div>
            <div class="enh-info">${info}</div>
            ${note ? `<div class="enh-note">${note}</div>` : ''}
            ${stats}
            ${res}
            <button type="button" class="enh-go" ${canGo && !st.busy ? '' : 'disabled'} onclick="enhWinGo()">${isCurse ? '降低強化' : '開始強化'}</button>
            ${auto}
            <div class="enh-tabs">${tabs}</div>
            <div class="enh-grid">${grid}</div>`;
        let ng = body.querySelector('.enh-grid'); if (ng && gTop) ng.scrollTop = gTop;
    }
    function cell(label, val, cls) { return `<div class="enh-info-cell"><div class="enh-info-label">${label}</div><div class="enh-info-val ${cls || ''}">${val}</div></div>`; }
    function statTable(d, en0, en1) {
        let a = statRows(d, en0), b = statRows(d, en1);
        if (!a.length) return '';
        let rows = a.map((r, i) => {
            let nv = b[i] ? b[i][1] : r[1], changed = nv !== r[1];
            return `<div class="enh-stat-row"><span class="enh-stat-label">${r[0]}</span><span class="enh-stat-old">${r[1]}</span><span class="enh-stat-arrow">→</span><span class="enh-stat-new ${changed ? 'up' : ''}">${nv}</span></div>`;
        }).join('');
        return `<div class="enh-stats">${rows}</div>`;
    }

    // 執行後找回「被強化的那一件」並寫結果：
    //   身上的／背包單件 → 同一個 uid；背包整疊（>1）→ 原規則會拆一件新的去衝，用前後 uid 差找那件（原本那疊數量 -1 還在）
    function afterAction(before, d0, en0, fn) {
        let wasEq = st.isEq, uid0 = st.uid, splitting = !wasEq && before.cnt > 1;
        let beforeUids = new Set(player.inv.map(i => i && i.uid));
        fn();
        let target = splitting ? player.inv.find(i => i && !beforeUids.has(i.uid) && i.id === before.id) : findItem(uid0, wasEq);
        let name = esc(d0.n);
        if (!target) {
            st.result = { cls: 'bad', html: `${en0 ? (en0 > 0 ? '+' : '') + en0 + ' ' : ''}${name} 消失了` };
            st.uid = splitting ? uid0 : null; st.isEq = false;
        } else {
            let en1 = Number(target.en) || 0;
            st.uid = target.uid; st.isEq = splitting ? false : wasEq;
            if (en1 > en0) st.result = { cls: 'good', html: `強化成功！${name} ${en0 >= 0 ? '+' : ''}${en0} → +${en1}` };
            else if (en1 < en0) st.result = { cls: 'mid', html: `${name} 強化值降為 ${en1 >= 0 ? '+' : ''}${en1}` };
            else st.result = { cls: 'mid', html: `${name} 沒有變化` };
        }
        render();
    }

    window.openEnhanceWindow = function (uid, isEq, opt) {
        let it = uid ? findItem(uid, isEq) : null, d = it && DB.items[it.id];
        let scrollId = opt && SCROLL_TAB[opt.scrollId] ? opt.scrollId : null;
        st = { uid: it ? uid : null, isEq: !!isEq, tab: (d && enhanceable(d)) ? etype(d) : (scrollId ? SCROLL_TAB[scrollId] : 'wpn'), scrollPick: 0, scrollId: scrollId, result: null };
        try { if (typeof enhSfxPreload === 'function') enhSfxPreload(); } catch (e) {}
        let win = $('enh-window');
        if (!win) {
            win = document.createElement('div');
            win.id = 'enh-window';
            win.innerHTML = `<div class="enh-panel" role="dialog" aria-label="裝備強化"><div class="enh-head"><span class="enh-title">裝備強化</span><button type="button" class="enh-x" aria-label="關閉" onclick="closeEnhanceWindow()">✕</button></div><div class="enh-body"></div></div>`;
            win.addEventListener('click', e => { if (e.target === win) closeEnhanceWindow(); });
            document.body.appendChild(win);
        }
        win.classList.remove('hidden');
        document.body.classList.add('enh-open');   // 浮動訊息（afk-toast，z-index 最上層）會蓋住視窗上半 → 開著時先藏；結果直接寫在視窗裡
        render();
        try { if (window.AFK_UI && AFK_UI.openLayer) st.layer = AFK_UI.openLayer(hideWin); } catch (e) {}
    };
    function hideWin() { let w = $('enh-window'); if (w) w.classList.add('hidden'); document.body.classList.remove('enh-open'); st.layer = null; }
    window.closeEnhanceWindow = function () { if (st.layer && window.AFK_UI && AFK_UI.closeLayer) AFK_UI.closeLayer(st.layer); else hideWin(); };
    window.enhWinTab = function (k) { if (st.busy) return; st.tab = k; render(); };
    window.enhWinPick = function (uid, isEq) { if (st.busy) return; st.uid = uid; st.isEq = !!isEq; st.scrollPick = 0; st.result = null; render(); };
    window.enhWinCycle = function () { if (st.busy) return; st.scrollPick++; st.scrollId = null; st.result = null; render(); };
    window.enhWinGo = function () {
        if (st.busy) return;
        let it = findItem(st.uid, st.isEq); if (!it) return;
        let d = DB.items[it.id], sc = scrollsFor(d)[st.scrollPick]; if (!sc) return;
        let before = { id: it.id, cnt: it.cnt || 1 }, en0 = Number(it.en) || 0, isC = !!DB.items[sc.id].isC, uid0 = it.uid, eq0 = st.isEq;
        playEnhance(it, d, () => {
            if (isC) afterAction(before, d, en0, () => executeCurseDeEnhance(uid0, eq0, sc.id));
            else afterAction(before, d, en0, () => { activeScroll = sc; doEnhance(uid0, eq0); });
        });
    };
    window.enhWinAuto = function () {
        if (st.busy) return;
        let it = findItem(st.uid, st.isEq); if (!it) return;
        let d = DB.items[it.id], sel = $('enh-auto-target'), sc = scrollsFor(d)[st.scrollPick]; if (!sel || !sc) return;
        let before = { id: it.id, cnt: it.cnt || 1 }, en0 = Number(it.en) || 0, goal = Number(sel.value), uid0 = it.uid, eq0 = st.isEq;
        playEnhance(it, d, () => afterAction(before, d, en0, () => executeAutoSafeEnhance(uid0, eq0, sc.id, goal)));
    };

    // ===== 強化動畫：蓄力（兩格發光、＋旋轉）→ 執行 → 依結果播 成功（金光爆發）／失敗（銀光後碎裂）／無變化（晃一下冒煙）=====
    //   動畫層 .enh-fx 掛在 .enh-panel（不在 render 重畫的 .enh-body 裡），位置對準裝備格；失敗時裝備已不在，用事先抓的圖示做碎片。
    //   系統開「減少動態效果」→ 不播，直接出結果。
    const CHARGE_MS = 650, OUT_MS = 1250;
    function reduceMotion() { try { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
    function eqBox() { let w = $('enh-window'); return w && w.querySelector('.enh-slot.eq .enh-slot-box'); }
    function fxLayer() {
        let panel = $('enh-window') && $('enh-window').querySelector('.enh-panel'); if (!panel) return null;
        let fx = panel.querySelector('.enh-fx');
        if (!fx) { fx = document.createElement('div'); fx.className = 'enh-fx'; panel.appendChild(fx); }
        return fx;
    }
    function sfx(kind) { try { if (typeof playEnhSfx === 'function') playEnhSfx(kind); } catch (e) {} }
    function resultSfx(d) {
        let r = st.result; if (!r) return;
        sfx(r.cls === 'good' ? (d.type === 'wpn' ? 'ok_wpn' : 'ok_arm') : r.cls === 'bad' ? 'boom' : /降為/.test(r.html) ? 'down' : 'none');
    }
    function playEnhance(it, d, run) {
        if (reduceMotion()) { run(); resultSfx(d); return; }
        let src = ''; try { src = getIconUrl(d); } catch (e) {}
        st.busy = true; render();
        let w = $('enh-window'); w.classList.add('enh-charging');
        sfx('charge');
        setTimeout(() => {
            w.classList.remove('enh-charging');
            run();                            // afterAction → render（busy 仍為 true，按鈕維持停用）
            resultSfx(d);
            let r0 = rectInPanel(eqBox());   // 執行「後」才量：裝備消失時版面會變矮、視窗重新置中，事前量的位置會對不上（裝備格本身還在，只是變空）
            let kind = st.result ? st.result.cls : 'mid';
            let en1 = 0; let cur = st.uid ? findItem(st.uid, st.isEq) : null; if (cur) en1 = Number(cur.en) || 0;
            outcomeFx(kind, r0, src, en1, st.result && /降為/.test(st.result.html));
            setTimeout(() => { st.busy = false; render(); }, OUT_MS);
        }, CHARGE_MS);
    }
    function rectInPanel(el) {
        let panel = $('enh-window').querySelector('.enh-panel');
        if (!el || !panel) return null;
        let a = el.getBoundingClientRect(), b = panel.getBoundingClientRect();
        return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2, s: a.width, cx: b.width / 2 };
    }
    function outcomeFx(kind, r, src, en1, down) {
        let fx = fxLayer(); if (!fx || !r) return;
        fx.innerHTML = '';
        let host = document.createElement('div');
        host.className = 'enh-fx-at ' + (kind === 'good' ? 'ok' : kind === 'bad' ? 'boom' : down ? 'down' : 'none');
        host.style.left = r.x + 'px'; host.style.top = r.y + 'px'; host.style.setProperty('--s', r.s + 'px');
        let html = '<i class="enh-fx-flash"></i>';
        if (kind === 'good') {
            html += '<i class="enh-fx-rays"></i>';
            for (let k = 0; k < 12; k++) { let a = k * 30 + Math.random() * 18, dist = 0.9 + Math.random() * 0.8; html += `<i class="enh-fx-spark" style="--a:${a}deg;--d:${dist};--t:${(Math.random() * 0.15).toFixed(2)}s"></i>`; }
            html += `<img class="enh-fx-icon" src="${esc(src)}" alt="">`;

        } else if (kind === 'bad') {
            // 銀光 → 碎成 8 片往外飛（每片＝同一張圖用 clip-path 裁一塊）
            const P = ['0 0,50% 0,50% 50%', '50% 0,100% 0,50% 50%', '100% 0,100% 50%,50% 50%', '100% 50%,100% 100%,50% 50%', '100% 100%,50% 100%,50% 50%', '50% 100%,0 100%,50% 50%', '0 100%,0 50%,50% 50%', '0 50%,0 0,50% 50%'];
            P.forEach((poly, k) => { let a = k * 45 + 22 + (Math.random() * 20 - 10); html += `<img class="enh-fx-shard" src="${esc(src)}" alt="" style="clip-path:polygon(${poly});--a:${a}deg;--r:${Math.round(Math.random() * 300 - 150)}deg">`; });

        } else {
            html += `<img class="enh-fx-icon" src="${esc(src)}" alt=""><i class="enh-fx-smoke"></i>`;

        }
        host.innerHTML = html;
        fx.appendChild(host);
        // 結果大字：視窗水平置中、壓在兩格那一列（放在裝備格上會超出右邊界、往上飄會蓋到標題）
        let txt = document.createElement('b');
        txt.className = 'enh-fx-text ' + (kind === 'good' ? 'ok' : kind === 'bad' ? 'boom' : down ? 'down' : 'none');
        txt.innerHTML = kind === 'good' ? `強化成功<span>+${en1}</span>` : kind === 'bad' ? '強化失敗' : (down ? '強化值降低' : '沒有變化');
        txt.style.left = r.cx + 'px'; txt.style.top = r.y + 'px';
        fx.appendChild(txt);
        setTimeout(() => { if (txt.parentNode) txt.parentNode.removeChild(txt); }, OUT_MS + 300);
        if (kind === 'bad') { let pn = fx.parentElement; pn.classList.remove('enh-shake'); void pn.offsetWidth; pn.classList.add('enh-shake'); }
        setTimeout(() => { if (host.parentNode) host.parentNode.removeChild(host); }, OUT_MS + 300);
    }
})();
