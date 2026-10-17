/* ==========================================================================
 * afk-sellguard.js — 防手滑把裝備賣掉(兩道防線,各自可關)
 *
 * 解決什麼(玩家回報·已重現):手機上「點兩下裝備」東西會憑空消失。
 *   核心 js/10 背包列:點一下 → 230ms 後開物品視窗;點兩下(瀏覽器要判定成 dblclick,
 *   約 300ms 內且手指沒移動)→ 直接裝備。兩下慢一點或手指動一下就不算雙擊 →
 *   第一下先把視窗打開,**第二下落在視窗上**;而視窗裡「裝備」正下方就是
 *   「販賣／全部賣出」,兩顆都沒有二次確認 → 當場賣掉。
 *   實測(Pixel 7 版面·兩下間隔 350ms):背包第 7 列的高度剛好壓在販賣鈕上,
 *   日誌出現「賣出了 1 個 保護者斗篷,獲得 25500 金幣」。
 *   中不中要看那一列剛好落在哪個高度 → 一整套只掉一兩件,看起來像「偶爾會不見」。
 *   ⚠️ 本職不能穿的裝備最危險:雙擊沒有任何反應(視窗裡是灰掉的「無法裝備」),
 *      玩家會再多點幾下 → 撞上的機率最高。
 *
 * 兩道防線(獨立開關,不是父子——關掉任一道,另一道照樣有效):
 *   A. modalguard  物品視窗剛跳出來的 450ms 內,落在視窗內的點擊一律吞掉。
 *      治的是上面那條路:第二下再快也是在視窗開啟之後才到。零文字、零摩擦。
 *   B. sellconfirm 賣掉「留得住的裝備」(有強化值/詞綴/傳說/遺物)前先問一次。
 *      治的是「真的手滑點到販賣」——A 擋不到的那種。
 *
 * 為什麼不改核心:販賣鈕是 js/10 openModal 內的模板字串,一改下次同步就沒了。
 *   這裡只包 window.openModal(記時間戳)與 window.sellItem(問一句),不動核心。
 *
 * 優雅降級:缺 openModal / sellItem 就 console.warn 後安靜停用,不影響遊戲。
 * 掛接:排在 afk-cursebatch 之後(它也包 openModal;我們後包＝在最外層,拿得到最終狀態)。
 * ========================================================================== */
(function () {
    'use strict';

    // register 必須早於第一次 enabled():找不到登錄項時 enabled() 一律回 true(afk-toggles.js)
    if (window.AFK_TOGGLES) {
        AFK_TOGGLES.register({
            id: 'modalguard', name: '物品視窗防誤觸', group: '遊戲介面', def: true,
            desc: '物品視窗剛跳出來的瞬間不吃點擊；雙擊裝備沒被判定成雙擊時，第二下不會打在販賣上'
        });
        AFK_TOGGLES.register({
            id: 'sellconfirm', name: '賣掉好裝備前先問', group: '遊戲介面', def: true,
            desc: '有強化值、詞綴、傳說或遺物的裝備，按販賣會先跳一次確認'
        });
    }
    function on(id) { try { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled(id); } catch (e) { return true; } }

    var NEED = ['openModal', 'sellItem'];
    for (var i = 0; i < NEED.length; i++) {
        if (typeof window[NEED[i]] !== 'function') {
            try { console.warn('[AFK-sellguard] 缺核心函式 ' + NEED[i] + '，防誤觸停用。'); } catch (e) {}
            return;
        }
    }

    // ── A. 物品視窗剛開的瞬間不吃點擊 ──────────────────────────
    // 450ms 的來歷:單擊延遲 230ms(js/10)＋人看到視窗跳出來再按下去至少 300ms。
    //   取 450 才涵蓋得到「兩下間隔 500~700ms」這種最常見的失敗雙擊(第二下落在開窗後 ~270~470ms)。
    var GUARD_MS = 450;
    var _armUntil = 0;

    var _openModal = window.openModal;
    window.openModal = function () {
        var r = _openModal.apply(this, arguments);
        try {
            var m = document.getElementById('item-modal');
            if (m && !m.classList.contains('hidden')) _armUntil = Date.now() + GUARD_MS;
        } catch (e) {}
        return r;
    };

    // capture 階段攔:核心的鈕是 inline onclick(掛在鈕自己身上·bubble 階段),
    //   在 document 的 capture 階段 stopPropagation 就到不了它。
    document.addEventListener('click', function (ev) {
        if (!on('modalguard') || Date.now() >= _armUntil) return;
        var m = document.getElementById('item-modal');
        if (!m || m.classList.contains('hidden')) return;
        if (!ev.target || !m.contains(ev.target)) return;
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }, true);

    // ── B. 賣掉「留得住的裝備」前先問一次 ───────────────────────
    // 判準對齊自動販賣規則的那幾道保護(js/10 _autoSellDecision):祝福/遠古/屬性/套裝/傳說/遺物,
    //   再加上「強化過的」。白板 +0 不問——那才是玩家真的在清背包的東西,每件都問等於天天被煩。
    function worthAsking(it) {
        var d = DB.items[it.id];
        if (!d) return false;
        if (d.legend) return true;
        try { if (typeof isRelic === 'function' && isRelic(d)) return true; } catch (e) {}
        return !!((it.en || 0) > 0 || (it.anc && !(typeof DISABLE_ANC !== 'undefined' && DISABLE_ANC)) || it.bless === true || it.attr || it.seteff);
    }
    // 核心的全名尾巴會帶整疊數量「(2)」,但這裡賣的可能只有 1 個 → 去掉,數量由前面的「N 個」講
    function plainName(it) {
        var n = '';
        try { if (typeof _autoSellPlainItemName === 'function') n = _autoSellPlainItemName(it); } catch (e) {}
        if (!n) { try { n = (DB.items[it.id] && DB.items[it.id].n) || it.id; } catch (e) { n = String(it.id); } }
        return String(n).replace(/\s*\(\d+\)\s*$/, '');
    }

    var _sellItem = window.sellItem;
    window.sellItem = function (uidv, count, unitPrice) {
        if (!on('sellconfirm') || typeof confirm !== 'function') return _sellItem.apply(this, arguments);
        var it = null;
        try { it = (player.inv || []).filter(function (x) { return x && x.uid === uidv; })[0]; } catch (e) {}
        if (!it || !worthAsking(it)) return _sellItem.apply(this, arguments);   // 找不到就放行,由核心自己判(它本來就會 return)
        var n = Math.min(Number(count) || 1, it.cnt || 1);
        var got = n * (Number(unitPrice) || 0);
        var msg = '賣掉' + (n > 1 ? ' ' + n + ' 個' : '') + '「' + plainName(it) + '」換 ' + got.toLocaleString() + ' 金幣？賣掉就拿不回來。';
        var self = this, args = arguments;
        // 用遊戲內的確認框：瀏覽器自己的 confirm 被玩家勾「不要再顯示」後會一律回「取消」→ 好裝備永遠賣不掉
        if (window.AFK_UI && AFK_UI.confirm) { AFK_UI.confirm({ title: '確定賣掉？', message: msg, okText: '賣掉', cancelText: '取消', danger: true, onOk: function () { _sellItem.apply(self, args); } }); return; }
        if (!confirm(msg)) return;
        return _sellItem.apply(this, arguments);
    };

    try { console.log('[AFK-sellguard] hooks OK — 物品視窗防誤觸 + 賣掉好裝備前先問。'); } catch (e) {}
})();
