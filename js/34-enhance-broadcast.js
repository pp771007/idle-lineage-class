// ========== 📢 強化跑馬燈 ==========
//   強化成功、而且強化值 ≥ 安定值 + ENH_BC_OVER_SAFE → 畫面上方跑一則「恭喜 XXX 成功將 長劍 強化至 +9」。
//   強化失敗（裝備消失）、而且這一下是要衝到門檻以上（原本 ≥ 安定值 + 門檻 - 1）→ 跑「XXX 的 +8 長劍 強化失敗，消失了」。
//   呼叫點：doEnhance（js/08）、executeAutoSafeEnhance／快速強化（js/10）→ 成功 enhBroadcastCheck(item, en0)、消失 enhBroadcastFail(item)（item.en＝消失前的強化值）。
//   ⚠️ 現在沒有伺服器，只看得到自己的。線上版接上時只要接兩頭，這支不用改：
//     送出：實作 window.enhBroadcastSend(msg)，達標時這裡會呼叫（msg = { name, item, en, color, fail }；fail＝消失，en＝消失前的強化值）。
//     收到別人的：呼叫 enhBroadcastShow(msg) 就會排進跑馬燈。
//   版面：position:fixed、z-index 壓過強化視窗（在強化視窗裡衝裝也看得到）、pointer-events:none 不擋點擊。
const ENH_BC_OVER_SAFE = 3;
const ENH_BC_QUEUE_MAX = 8;   // 快速強化一次可能達標很多件：排隊上限，超過的丟掉（不要洗好幾分鐘）
const ENH_BC_PX_PER_S = 90;   // 捲動速度（字越長跑越久，速度一致）

(function () {
    let queue = [], running = false;

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    function announce(it, d, en, fail) {
        let color = ''; try { color = getItemColor(it) || ''; } catch (e) {}
        let msg = { name: (typeof player !== 'undefined' && player && player.name) || '無名勇者', item: d.n, en: en, color: color, fail: !!fail };
        window.enhBroadcastShow(msg);
        if (typeof window.enhBroadcastSend === 'function') { try { window.enhBroadcastSend(msg); } catch (e) { console.warn('[強化跑馬燈] 送出失敗:', e); } }
    }
    window.enhBroadcastCheck = function (it, en0) {
        try {
            if (!it || typeof DB === 'undefined') return;
            let d = DB.items[it.id]; if (!d) return;
            let en = Number(it.en) || 0;
            if (en <= (Number(en0) || 0) || en < (d.safe || 0) + ENH_BC_OVER_SAFE) return;
            announce(it, d, en, false);
        } catch (e) { console.warn('[強化跑馬燈]', e); }
    };
    window.enhBroadcastFail = function (it) {
        try {
            if (!it || typeof DB === 'undefined') return;
            let d = DB.items[it.id]; if (!d) return;
            let en = Number(it.en) || 0;
            if (en + 1 < (d.safe || 0) + ENH_BC_OVER_SAFE) return;   // 跟成功同一條線：這一下要衝的值到門檻才廣播
            announce(it, d, en, true);
        } catch (e) { console.warn('[強化跑馬燈]', e); }
    };

    window.enhBroadcastShow = function (msg) {
        if (!msg || !msg.item) return;
        if (queue.length >= ENH_BC_QUEUE_MAX) return;
        queue.push(msg);
        if (!running) next();
    };

    function bar() {
        let el = document.getElementById('enh-broadcast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'enh-broadcast';
            el.className = 'hidden';
            el.setAttribute('aria-live', 'polite');
            el.innerHTML = '<div class="enh-bc-track"></div>';
            document.body.appendChild(el);
        }
        return el;
    }

    function next() {
        let msg = queue.shift();
        let el = bar();
        if (!msg) { running = false; el.classList.add('hidden'); return; }
        running = true;
        let track = el.querySelector('.enh-bc-track');
        let cls = /^[\w -]+$/.test(msg.color || '') ? msg.color : '';
        let en = Number(msg.en) || 0, enTxt = (en > 0 ? '+' : '') + en;
        track.innerHTML = msg.fail
            ? `<span class="enh-bc-text">可惜！<b class="enh-bc-name">${esc(msg.name)}</b> 的 <b class="enh-bc-en">${enTxt}</b> <b class="${cls}">${esc(msg.item)}</b> 強化失敗，<b class="enh-bc-boom">消失了</b>…</span>`
            : `<span class="enh-bc-text">恭喜 <b class="enh-bc-name">${esc(msg.name)}</b> 成功將 <b class="${cls}">${esc(msg.item)}</b> 強化至 <b class="enh-bc-en">+${en}</b>！</span>`;
        el.classList.toggle('fail', !!msg.fail);
        el.classList.remove('hidden');
        let w = el.clientWidth, tw = track.scrollWidth;
        let dist = w + tw, ms = Math.max(4000, dist / ENH_BC_PX_PER_S * 1000);
        let done = false, fin = () => { if (done) return; done = true; next(); };
        try {
            let a = track.animate([{ transform: `translateX(${w}px)` }, { transform: `translateX(${-tw}px)` }], { duration: ms, easing: 'linear', fill: 'forwards' });
            a.onfinish = fin;
        } catch (e) { track.style.transform = 'translateX(0)'; }
        setTimeout(fin, ms + 500);   // 保險：分頁在背景、動畫事件沒來也會換下一則
    }
})();
