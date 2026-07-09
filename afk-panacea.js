/* ============================================================================
 * afk-panacea.js — 萬能藥批量使用
 *
 * 手動使用萬能藥時，若「本次可用瓶數 > 1」就先彈出數量視窗（比照歐西里斯寶箱
 * openOsirisBox 的流程），確認後迴圈呼叫原作 useItem(uid, true)。
 * 上限判定（總量 60 瓶、單屬性自然值 60）全部交還原作分支，本檔只算「最多能點幾瓶」
 * 用於預設值與提示文字，不重複實作規則。
 * ========================================================================== */
(function () {
    'use strict';

    const PANACEA_CAP = 60;   // 萬能藥總使用上限（js/08 useItem panacea 分支）
    const STAT_CAP = 60;      // 單一屬性自然值上限（同上）
    const STAT_CN = { str: '力量', dex: '敏捷', con: '體質', int: '智力', wis: '精神', cha: '魅力' };
    const MODAL_ID = 'afk-panacea-modal';

    if (typeof useItem !== 'function' || typeof DB === 'undefined') {
        console.warn('[AFK-panacea] 缺少 useItem / DB，停用');
        return;
    }

    // 本次最多可服用幾瓶：受「背包堆疊數」「總量 60」「該屬性距離上限」三者夾擊
    function maxDoses(item, d) {
        let byStack = item.cnt || 1;
        let byUsed = PANACEA_CAP - (player.panaceaUsed || 0);
        let byStat = (typeof naturalStat === 'function') ? (STAT_CAP - naturalStat(d.pstat)) : byStack;
        return Math.max(0, Math.min(byStack, byUsed, byStat));
    }

    function close() {
        let m = document.getElementById(MODAL_ID);
        if (m) m.remove();
        if (window.AFK_UI && close._layer) { AFK_UI.closeLayer(close._layer); close._layer = null; }
    }

    function open(uid, orig) {
        let item = player.inv.find(i => i.uid === uid);
        if (!item) return;
        let d = DB.items[item.id];
        let maxN = maxDoses(item, d);
        let st = d.pstat;

        close();
        let m = document.createElement('div');
        m.id = MODAL_ID;
        m.className = 'fixed inset-0 z-[60] flex items-center justify-center';
        m.innerHTML =
            '<div class="absolute inset-0 bg-black/60" data-pa-close></div>' +
            '<div class="panel border-pink-400 p-5 relative w-[420px] max-w-[92vw] flex flex-col">' +
              `<div class="panel-header rounded-md mb-3">${d.n} — 選擇使用數量</div>` +
              `<div class="text-sm text-slate-300 mb-3">每服用 1 瓶，${STAT_CN[st]} 永久 +1。<br>` +
              `持有 <span class="text-pink-300">${item.cnt || 1}</span> 瓶、萬能藥已使用 <span class="text-pink-300">${player.panaceaUsed || 0}/${PANACEA_CAP}</span>、` +
              `${STAT_CN[st]}目前 <span class="text-pink-300">${naturalStat(st)}/${STAT_CAP}</span>（不含裝備）。<br>` +
              `本次最多可服用 <span class="text-pink-300">${maxN}</span> 瓶。</div>` +
              `<div class="flex gap-2 mb-3">` +
                `<input id="afk-pa-qty" type="number" min="1" max="${maxN}" value="${maxN}" class="flex-1 px-2 py-1 rounded bg-slate-800 border border-slate-600 text-center text-lg">` +
                `<button class="btn px-3" data-pa-max>最大</button>` +
              `</div>` +
              `<div class="flex gap-2"><button class="btn flex-1 bg-pink-800 hover:bg-pink-700 font-bold" data-pa-ok>服用</button><button class="btn flex-1" data-pa-close>取消</button></div>` +
            '</div>';
        document.body.appendChild(m);
        if (window.AFK_UI) close._layer = AFK_UI.openLayer(close);

        let inp = m.querySelector('#afk-pa-qty');
        m.addEventListener('click', (e) => {
            if (e.target.closest('[data-pa-close]')) { close(); return; }
            if (e.target.closest('[data-pa-max]')) { inp.value = maxN; return; }
            if (e.target.closest('[data-pa-ok]')) {
                let n = Math.min(maxN, Math.max(1, parseInt(inp.value) || 1));
                close();
                drink(uid, n, orig);
            }
        });
        inp.focus(); inp.select();

        let im = document.getElementById('item-modal');
        if (im && !im.classList.contains('hidden') && typeof closeModal === 'function') closeModal();
    }

    // 逐瓶呼叫原作 useItem(silent)：上限/消耗/calcStats 全走原邏輯，任一瓶被擋下就停
    function drink(uid, n, orig) {
        let first = player.inv.find(i => i.uid === uid); if (!first) return;
        let d = DB.items[first.id], st = d.pstat, before = player.panaceaUsed || 0;
        for (let k = 0; k < n; k++) {
            let item = player.inv.find(i => i.uid === uid);
            if (!item || (item.cnt || 0) < 1) break;
            let used = player.panaceaUsed || 0;
            orig(uid, true);
            if ((player.panaceaUsed || 0) === used) break;   // 沒增加＝被上限擋下，別空轉
        }
        let got = (player.panaceaUsed || 0) - before;
        if (got > 0) {
            logSys(`服用了 ${got} 瓶 ${d.n}，${STAT_CN[st]} 永久 +${got}！（萬能藥已使用 ${player.panaceaUsed}/${PANACEA_CAP}）`);
            if (typeof renderTabs === 'function') renderTabs(true);
            if (typeof updateUI === 'function') updateUI();
            if (typeof saveGame === 'function' && player.cls) saveGame();   // 未載入角色時絕不寫檔（空白 player 會蓋掉 currentSlot）
        } else {
            orig(uid, false);   // 一瓶都沒喝成 → 讓原作自己印出被擋下的原因
        }
    }

    let _orig = useItem;
    useItem = function (u, silent = false) {
        if (!silent) {
            let item = player.inv && player.inv.find(i => i.uid === u);
            let d = item && DB.items[item.id];
            if (d && d.eff === 'panacea' && maxDoses(item, d) > 1) { open(u, _orig); return; }
        }
        return _orig.apply(this, arguments);
    };
    window.useItem = useItem;

    console.log('[AFK-panacea] hooks OK');
})();
