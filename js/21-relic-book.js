// ========== 🏺 遺物收集冊（獨立圖鑑·分類沿用裝備收集冊 equipCatKey/EQUIP_CATEGORIES·只列遺物·無全收集加成）==========
//   資料：player.relicDex = { itemId: true }（永久·只增不減）；共用桶 RELICDEX_KEY（per game-mode·多開 boolean-union·見 js/12）。
//   由「收藏」面板開啟（collectionOpenRelic → openRelicBook），與裝備/道具/怪物圖鑑並列。

// ---- 索引：沿用 EQUIP_CATEGORIES 27 分類（+內衣）與 equipCatKey，但只納入 isRelic 物品 ----
const RELIC_CAT_ITEMS = {};   // catKey -> [itemId,...]
const RELIC_ITEM_CAT = {};    // itemId -> catKey
(function buildRelicIndex() {
    if (typeof EQUIP_CATEGORIES === 'undefined') return;
    EQUIP_CATEGORIES.forEach(c => { RELIC_CAT_ITEMS[c.key] = []; });
    for (let id in DB.items) {
        let d = DB.items[id];
        if (!d || !(typeof isRelic === 'function' && isRelic(d))) continue;   // 🏺 只收遺物
        if (d.type !== 'wpn' && d.type !== 'arm' && d.type !== 'acc') continue;
        let ck = (typeof equipCatKey === 'function') ? equipCatKey(id, d) : null;
        if (!ck || !RELIC_CAT_ITEMS[ck]) continue;
        RELIC_CAT_ITEMS[ck].push(id);
        RELIC_ITEM_CAT[id] = ck;
    }
    for (let k in RELIC_CAT_ITEMS) {
        RELIC_CAT_ITEMS[k].sort((a, b) => ((DB.items[a].p || 0) - (DB.items[b].p || 0)) || ((DB.items[a].n || '') < (DB.items[b].n || '') ? -1 : 1));
    }
})();

// ---- dex 助手 ----
function relicDexHas(id) { return !!(player.relicDex && player.relicDex[id]); }
function relicCatCount(ck) { let arr = RELIC_CAT_ITEMS[ck] || []; return { got: arr.filter(relicDexHas).length, total: arr.length }; }
function registerRelicObtained(id) {   // gainItem 呼叫：獲得任何遺物即登錄
    if (!player) return;
    if (!player.relicDex) player.relicDex = {};
    if (RELIC_ITEM_CAT[id] && !player.relicDex[id]) { player.relicDex[id] = true; if (typeof saveRelicDex === 'function') saveRelicDex(); }
}
// ---- 創角/讀檔保底：把現有(背包+已裝備+倉庫)遺物補登錄 ----
function ensureRelicDex() {
    if (!player || !Array.isArray(player.inv)) return;
    if (!player.relicDex) player.relicDex = {};
    player.inv.forEach(i => { if (RELIC_ITEM_CAT[i.id]) player.relicDex[i.id] = true; });
    if (player.eq) for (let s in player.eq) { let e = player.eq[s]; if (e && e.id && RELIC_ITEM_CAT[e.id]) player.relicDex[e.id] = true; }
    try { if (typeof loadWarehouse === 'function') { let _w = loadWarehouse(); if (_w && Array.isArray(_w.items)) _w.items.forEach(i => { if (i && i.id && RELIC_ITEM_CAT[i.id]) player.relicDex[i.id] = true; }); } } catch (e) {}
    if (typeof saveRelicDex === 'function') saveRelicDex();
}

// ===== 全螢幕書頁 UI =====
let _relicBookOpen = false;
let _relicBookCat = (typeof EQUIP_CATEGORIES !== 'undefined' && EQUIP_CATEGORIES[0]) ? EQUIP_CATEGORIES[0].key : 'dagger';
function collectionOpenRelic() { if (typeof closeCollectionPanel === 'function') closeCollectionPanel(); openRelicBook(); }
function openRelicBook() {
    if (!player.relicDex) player.relicDex = {};
    if (typeof mergeSharedIntoPlayer === 'function') mergeSharedIntoPlayer('relic');   // 🔄 多開兜底：開書前先併入其他分頁的遺物進度
    if (typeof closeModal === 'function') closeModal();
    _relicBookOpen = true;
    // 首個「有遺物」的分頁為預設，避免開在空分頁
    let firstCat = EQUIP_CATEGORIES.find(c => (RELIC_CAT_ITEMS[c.key] || []).length > 0);
    if (firstCat && !((RELIC_CAT_ITEMS[_relicBookCat] || []).length > 0)) _relicBookCat = firstCat.key;
    let el = document.getElementById('relic-book'); if (!el) return;
    el.classList.remove('hidden');
    renderRelicBook();
}
function closeRelicBook() { _relicBookOpen = false; let el = document.getElementById('relic-book'); if (el) el.classList.add('hidden'); }
function relicBookTab(key) { _relicBookCat = key; renderRelicBook(); }
function relicBookBackdrop(ev) { if (ev && ev.target && ev.target.id === 'relic-book') closeRelicBook(); }

function renderRelicBook() {
    let host = document.getElementById('relic-book-body'); if (!host) return;
    let tabHost = document.getElementById('relic-book-tabs');
    if (tabHost) {
        let lastGroup = '';
        tabHost.innerHTML = EQUIP_CATEGORIES.filter(c => (RELIC_CAT_ITEMS[c.key] || []).length > 0).map(c => {
            let cc = relicCatCount(c.key);
            let active = (c.key === _relicBookCat);
            let done = cc.total > 0 && cc.got >= cc.total;
            let sep = (c.group !== lastGroup) ? `<span class="text-slate-500 text-[11px] font-bold px-1 self-center">${c.group}</span>` : '';
            lastGroup = c.group;
            return sep + `<button onclick="relicBookTab('${c.key}')" class="btn px-2.5 py-1 text-xs font-bold whitespace-nowrap ${active ? 'bg-sky-800 border-sky-500 text-sky-100' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}">${c.name}<span class="ml-1 text-[10px] ${done ? 'text-emerald-400' : 'text-slate-400'}">${cc.got}/${cc.total}</span></button>`;
        }).join('');
    }
    let cat = EQUIP_CATEGORIES.find(c => c.key === _relicBookCat) || EQUIP_CATEGORIES[0];
    let ids = RELIC_CAT_ITEMS[cat.key] || [];
    let cc = relicCatCount(cat.key);
    // 全部遺物進度（總覽）
    let totGot = 0, totAll = 0;
    for (let k in RELIC_CAT_ITEMS) { totGot += RELIC_CAT_ITEMS[k].filter(relicDexHas).length; totAll += RELIC_CAT_ITEMS[k].length; }
    let head = `<div class="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div class="text-xl font-bold c-relic">${cat.group}・${cat.name}<span class="text-sm text-slate-400 font-normal ml-2">已收集 ${cc.got} / ${cc.total}</span></div>
        <div class="text-sm text-slate-400">🏺 遺物總收集 <span class="c-relic font-bold">${totGot} / ${totAll}</span></div>
    </div>`;
    let cells = ids.map(id => {
        let d = DB.items[id]; let got = relicDexHas(id);
        let imgUrl = (typeof getIconUrl === 'function') ? getIconUrl(d) : (d.img || '');
        let silh = got ? '' : ' card-silhouette';
        let nameHtml = got
            ? `<div class="text-xs font-bold c-relic truncate" title="${d.n}">${d.n}</div>`
            : `<div class="text-xs font-bold text-slate-500">？？？</div>`;
        return `<div class="relative bg-slate-800/70 border ${got ? 'border-sky-700/70' : 'border-slate-700/60'} rounded-lg p-2 flex flex-col items-center gap-1 w-[112px]${got ? ' tip-host cursor-help' : ''}"${got ? ` data-tip-id="${id}"` : ''}>
            ${got ? '<span class="absolute top-1 right-1 text-[9px] px-1 rounded c-relic bg-black/50 font-bold">遺物</span>' : ''}
            ${got ? '<span class="relic-glow-wrap">' : ''}<img src="${imgUrl}" alt="${d.n}" class="w-14 h-14 object-contain${got ? ' relic-glow' : ''}${silh}" onerror="this.onerror=null;this.src='https://placehold.co/56x56/1e293b/334155?text=%3F';">${got ? '</span>' : ''}
            <div class="text-center w-full">${nameHtml}</div>
        </div>`;
    }).join('');
    host.innerHTML = head + `<div class="flex flex-wrap gap-2 justify-center">${cells || '<div class="text-slate-500 p-8">此部位暫無可收集的遺物。</div>'}</div>`;
}
