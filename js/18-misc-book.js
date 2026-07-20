// ========== 🧰 道具收集冊（概念同裝備收集冊：獲得即登錄、依物品類型分類、只列「有獲得管道」的道具）==========
//   ・由「收藏」面板（道具欄右上角按鈕）→「道具」開啟；資料存 player.miscDex（itemId->true·永久只增不減·共用桶 MISCDEX_KEY）。
//   ・登錄點：gainItem → registerMiscObtained（js/08）。分類：藥水/卷軸/技能書/材料/其他（miscCatKey）。
//   ・排除：裝備(wpn/arm/acc·歸裝備冊)、怪物卡片(card_*/eff:card·歸怪物冊)；以及「無任何獲得管道」的道具(OBTAINABLE_MISC 過濾)。
//   ・🗑️ v3.5.87 起「收集冊本體」不再需要任何排除機制：item_card_book / item_equip_book 的 DB.items 定義已刪除，
//     不存在於 DB 即自然不進分母（原本那行冗餘排除已一併移除）。
//     ⚠️ 日後若把 item_card_book 重新加回 DB 定義（例如做成活動道具），它會跑進道具收集冊分母，需自行補排除
//     （加進 MISC_BOOK_EXCLUDED 或在 miscCatKey 回 null）。

// ---- 分類（顯示順序）----
const MISC_CATEGORIES = [
    { key: 'pot',     name: '藥水' },
    { key: 'scroll',  name: '卷軸' },
    { key: 'skillbk', name: '技能書' },
    { key: 'mat',     name: '材料' },
    { key: 'special', name: '其他' }
];

// 已停用且無獲取管道的舊道具：保留物品定義供舊存檔辨識，但永不列入收集冊、完成數或全收集加成。
const MISC_BOOK_EXCLUDED = {
    new_item_bless_wpn: true,
    new_item_bless_arm: true,
    new_item_bless_acc: true
};

// ---- 將一個道具分到類別 key（回傳 null＝不收錄：MISC_BOOK_EXCLUDED 名單／裝備／怪物卡片）----
//   ⚠️ v3.5.87 起本函式已無「收集冊本體」的排除分支：item_card_book / item_equip_book 的 DB.items 定義已刪除，
//      呼叫端遍歷 DB.items 時根本不會走到它們。日後若把 item_card_book 重新加回 DB 定義（例如做成活動道具），
//      它會跑進道具收集冊分母，需自行補排除（加進上方 MISC_BOOK_EXCLUDED 最省事）。
function miscCatKey(id, d) {
    if (!d) return null;
    if (MISC_BOOK_EXCLUDED[id]) return null;
    var t = d.type;
    if (t === 'wpn' || t === 'arm' || t === 'acc') return null;          // 裝備 → 裝備收集冊
    if (d.eff === 'card' || id.indexOf('card_') === 0) return null;       // 怪物卡片 → 怪物收集冊
    if (t === 'pot' || id.indexOf('potion_') === 0) return 'pot';
    if (t === 'scroll' || id.indexOf('scroll_') === 0 || (d.n && d.n.indexOf('卷軸') >= 0)) return 'scroll';   // 卷軸（含 賦予祝福/解除詛咒 等 type:misc/new_item_ 命名為「卷軸」者）
    if (t === 'skillbk' || id.indexOf('bk_') === 0 || id.indexOf('mem_') === 0) return 'skillbk';
    if (t === 'etc' || id.indexOf('mat_') === 0 || id.indexOf('new_item_') === 0) return 'mat';
    return 'special';                                                     // 蠟燭/萬能藥/靈魂之球/娃娃袋/任務道具…
}

// ---- 「有獲得管道」集合（建一次）：潘朵拉(gachaWeight>0)∪掉落表∪商店∪製作成品/材料∪地區加成；另由 registerMiscObtained 動態補登「曾獲得但靜態未列」者 ----
const OBTAINABLE_MISC = (function buildObtainableMisc() {
    var S = {};
    function add(id) { if (id && id !== 'gold' && DB.items[id]) S[id] = true; }
    // (a) 潘朵拉抽獎池
    for (var id in DB.items) { var d = DB.items[id]; if (d && (d.gachaWeight || 0) > 0) S[id] = true; }
    // (b) 怪物掉落表（含黑暗/龍/戰士/記憶等附加表·typeof 守衛跳過不存在者）
    function addTable(tbl) {
        if (!tbl || typeof tbl !== 'object') return;
        for (var mob in tbl) { var arr = tbl[mob]; if (!Array.isArray(arr)) continue; arr.forEach(function (e) { add(Array.isArray(e) ? e[0] : e); }); }
    }
    if (typeof MOB_DROPS !== 'undefined') addTable(MOB_DROPS);
    if (typeof DARK_WEAPON_DROPS !== 'undefined') addTable(DARK_WEAPON_DROPS);
    if (typeof DARK_CRYSTAL_DROPS !== 'undefined') addTable(DARK_CRYSTAL_DROPS);
    if (typeof DRAGON_DROPS !== 'undefined') addTable(DRAGON_DROPS);
    if (typeof WARRIOR_DROPS !== 'undefined') addTable(WARRIOR_DROPS);
    if (typeof MEM_DROPS !== 'undefined') addTable(MEM_DROPS);
    // (c) 商店清單
    try { if (typeof SHOP_LISTS === 'object' && SHOP_LISTS) for (var npc in SHOP_LISTS) { var lst = SHOP_LISTS[npc]; if (Array.isArray(lst)) lst.forEach(add); } } catch (e) {}
    // (d) 製作：成品＋所有材料（材料消耗即代表玩家曾持有→可收集；中間物也算·與遞迴製作一致）
    try {
        if (typeof CRAFT_RECIPES === 'object' && CRAFT_RECIPES) for (var cn in CRAFT_RECIPES) {
            var recs = CRAFT_RECIPES[cn]; if (!Array.isArray(recs)) continue;
            recs.forEach(function (r) { if (!r) return; add(r.result); if (Array.isArray(r.req)) r.req.forEach(function (m) { if (m) add(m.id); }); });
        }
    } catch (e) {}
    // (e) 地區獵殺加成道具（const 在 js/01 為閉包內·此處內聯）
    ['new_item_164', 'new_item_195', 'new_item_165'].forEach(add);
    // (f) 兌換/特殊取得的卷軸（gachaWeight0·掃描器漏掉·顯式補）：祝福的卷軸(伊賽馬利)、解除詛咒卷軸
    ['scroll_weapon_b', 'scroll_armor_b', 'new_item_uncurse'].forEach(add);
    // (g) v3.5.87 兌換限定道具無掉落表來源→顯式補登：魔法娃娃的袋子/高級盒子（銀卡/金卡兌換·gachaWeight0）
    //     否則只靠 registerMiscObtained 動態補登（僅在記憶體）→重載後不在靜態索引，收集冊計數靜默退回
    ['doll_bag', 'doll_box_high'].forEach(add);
    return S;
})();
function miscObtainable(id) { return !!OBTAINABLE_MISC[id]; }

// ---- 建立索引：類別 → [itemId,...]（依價格排序）、itemId → 類別。僅收「可分類 ∧ 有獲得管道」者 ----
const MISC_CAT_ITEMS = {};   // catKey -> [itemId,...]
const MISC_ITEM_CAT = {};    // itemId -> catKey
(function buildMiscIndex() {
    MISC_CATEGORIES.forEach(function (c) { MISC_CAT_ITEMS[c.key] = []; });
    for (var id in DB.items) {
        var d = DB.items[id]; if (!d) continue;
        var ck = miscCatKey(id, d); if (!ck || !MISC_CAT_ITEMS[ck]) continue;
        if (!miscObtainable(id)) continue;                               // 🚫 無獲得管道→不列
        MISC_CAT_ITEMS[ck].push(id); MISC_ITEM_CAT[id] = ck;
    }
    for (var k in MISC_CAT_ITEMS) {
        MISC_CAT_ITEMS[k].sort(function (a, b) { return ((DB.items[a].p || 0) - (DB.items[b].p || 0)) || ((DB.items[a].n || '') < (DB.items[b].n || '') ? -1 : 1); });
    }
})();

// ---- dex 助手（player.miscDex: itemId -> true）----
function miscDexHas(id) { return !!(player && player.miscDex && player.miscDex[id]); }
function miscCatCount(ck) { var arr = MISC_CAT_ITEMS[ck] || []; return { got: arr.filter(miscDexHas).length, total: arr.length }; }
function miscCatComplete(ck) { var cc = miscCatCount(ck); return cc.total > 0 && cc.got >= cc.total; }

// ---- 全收集加成（道具收藏完成能力）：藥水/卷軸→負重+10·技能書→MP自然恢復+3·材料→藥水恢復+3%·其他→藥水恢復+2% ----
const MISC_CAT_BONUS = {
    pot:     { stat: 'weight', val: 10, label: '負重 +10' },
    scroll:  { stat: 'weight', val: 10, label: '負重 +10' },
    skillbk: { stat: 'mpR',    val: 3,  label: 'MP自然恢復量 +3' },
    mat:     { stat: 'potion', val: 3,  label: '藥水恢復量 +3%' },
    special: { stat: 'potion', val: 2,  label: '藥水恢復量 +2%' }
};
// recomputeStats 鉤子（js/02 呼叫·仿 equipCollectionBonus）：weight→d._miscWeightBonus(負重段)、mpR→d.mpR、potion→p._miscPotionBonus(js/08 藥水恢復%)。傭兵換身重算時借隊長 miscDex 亦生效。
function miscCollectionBonus(p, d) {
    if (d) d._miscWeightBonus = 0;
    if (p) p._miscPotionBonus = 0;
    if (!p || !p.miscDex) return;
    for (var k in MISC_CAT_BONUS) {
        if (!miscCatComplete(k)) continue;
        var b = MISC_CAT_BONUS[k];
        if (b.stat === 'weight') d._miscWeightBonus += b.val;
        else if (b.stat === 'mpR') d.mpR += b.val;
        else if (b.stat === 'potion') p._miscPotionBonus += b.val;
    }
}

// ---- 無法獲得但仍有用途的卷軸 → 預設「圖鑑已開通」(計入收集·讓卷軸類仍可完成) ----
//   new_item_uncurse 既有持有者仍可用、無新來源所以全模式開通；祝福的施法卷軸 scroll_*_b 仍可由伊賽馬利兌換→只在經典開通。
//   已停用的三種賦予祝福卷軸由 MISC_BOOK_EXCLUDED 完全排除，不再用自動開通方式佔據收集冊格位。
//   🏛️v3.0.83 傳統模式已取消：經典+傳統的強化卷軸自動開通分支移除（施法卷軸已恢復全模式可取得）。
const MISC_SCROLL_UNCURSE = ['new_item_uncurse'];
const MISC_SCROLL_BLESSED = ['scroll_weapon_b', 'scroll_armor_b'];
function _miscModeAutoComplete() {
    if (!player) return;
    if (!player.miscDex) player.miscDex = {};
    var marks = [].concat(MISC_SCROLL_UNCURSE);                                                    // 全模式：解除詛咒卷軸（來源已移除但仍有用途）
    if (player.classicMode) marks = marks.concat(MISC_SCROLL_BLESSED);                             // 經典：祝福的施法卷軸（經典不掉施法卷軸→無從兌換）
    var changed = false;
    marks.forEach(function (id) { if (DB.items[id] && MISC_ITEM_CAT[id] && !player.miscDex[id]) { player.miscDex[id] = true; changed = true; } });
    if (changed && typeof saveMiscDex === 'function') saveMiscDex();
}

// ---- gainItem 呼叫：獲得任何「可分類道具」即登錄；曾獲得但靜態未列(任務/兌換給予)→動態補進索引，確保收集冊看得到 ----
function registerMiscObtained(id) {
    if (!player) return;
    var d = DB.items[id]; if (!d) return;
    var ck = miscCatKey(id, d); if (!ck) return;
    if (!player.miscDex) player.miscDex = {};
    if (!MISC_ITEM_CAT[id]) { if (!MISC_CAT_ITEMS[ck]) MISC_CAT_ITEMS[ck] = []; MISC_CAT_ITEMS[ck].push(id); MISC_ITEM_CAT[id] = ck; }   // 動態補登
    if (!player.miscDex[id]) { player.miscDex[id] = true; if (typeof saveMiscDex === 'function') saveMiscDex(); }
}

// ---- 創角/讀檔保底：把現有背包道具補登錄（舊存檔遷移）----
function ensureMiscDex() {
    if (!player || !Array.isArray(player.inv)) return;
    if (!player.miscDex) player.miscDex = {};
    var changed = false;
    var reg = function (i) {
        if (!i || !i.id) return;
        var d = DB.items[i.id]; if (!d) return;
        var ck = miscCatKey(i.id, d); if (!ck) return;
        if (!MISC_ITEM_CAT[i.id]) { if (!MISC_CAT_ITEMS[ck]) MISC_CAT_ITEMS[ck] = []; MISC_CAT_ITEMS[ck].push(i.id); MISC_ITEM_CAT[i.id] = ck; }
        if (!player.miscDex[i.id]) { player.miscDex[i.id] = true; changed = true; }
    };
    player.inv.forEach(reg);
    // 🏛️ v3.0.61 倉庫庫存也補登錄（唯讀當前模式倉庫桶·同 ensureEquipBook）：收集冊上線前入倉的道具從未經 gainItem 登錄→讀檔時一併點亮
    try { if (typeof loadWarehouse === 'function') { var _w = loadWarehouse(); if (_w && Array.isArray(_w.items)) _w.items.forEach(reg); } } catch (e) {}
    if (changed && typeof saveMiscDex === 'function') saveMiscDex();
    _miscModeAutoComplete();   // 🔒 經典：無法獲得的卷軸預設已收集
}

// ===== 🧰 道具收集冊 全螢幕書頁 UI =====
let _miscBookOpen = false;
let _miscBookCat = MISC_CATEGORIES[0].key;
function openMiscBook() {
    if (!player) return;
    if (!player.miscDex) player.miscDex = {};
    if (typeof mergeSharedIntoPlayer === 'function' && mergeSharedIntoPlayer('misc') && typeof calcStats === 'function') calcStats();   // 🔄 多開兜底：開書前併入其他分頁的道具進度；⚠️ MISC_CAT_BONUS 有加成（負重+10／MP恢復+3／藥水恢復%），合併後要重算（比照 js/15 openCardBook）
    if (typeof closeModal === 'function') closeModal();
    _miscBookOpen = true;
    var el = document.getElementById('misc-book'); if (!el) return;
    el.classList.remove('hidden');
    renderMiscBook();
}
function closeMiscBook() { _miscBookOpen = false; var el = document.getElementById('misc-book'); if (el) el.classList.add('hidden'); }
function miscBookTab(key) { _miscBookCat = key; renderMiscBook(); }
function miscBookBackdrop(ev) { if (ev && ev.target && ev.target.id === 'misc-book') closeMiscBook(); }

function renderMiscBook() {
    var host = document.getElementById('misc-book-body'); if (!host) return;
    var tabHost = document.getElementById('misc-book-tabs');
    if (tabHost) {
        tabHost.innerHTML = MISC_CATEGORIES.filter(function (c) { return (MISC_CAT_ITEMS[c.key] || []).length > 0; }).map(function (c) {
            var cc = miscCatCount(c.key);
            var active = (c.key === _miscBookCat);
            var done = cc.total > 0 && cc.got >= cc.total;
            return '<button onclick="miscBookTab(\'' + c.key + '\')" class="btn px-2.5 py-1 text-xs font-bold whitespace-nowrap ' + (active ? 'bg-amber-800 border-amber-500 text-amber-100' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700') + '">' + c.name + '<span class="ml-1 text-[10px] ' + (done ? 'text-emerald-400' : 'text-slate-400') + '">' + cc.got + '/' + cc.total + '</span></button>';
        }).join('');
    }
    var cat = MISC_CATEGORIES.find(function (c) { return c.key === _miscBookCat; }) || MISC_CATEGORIES[0];
    var ids = MISC_CAT_ITEMS[cat.key] || [];
    var cc = miscCatCount(cat.key);
    var _b = MISC_CAT_BONUS[cat.key];
    var _done = cc.total > 0 && cc.got >= cc.total;
    var _bonusHtml = _b ? '<div class="text-sm font-bold ' + (_done ? 'text-emerald-300' : 'text-slate-500') + '">🏆 全收集加成：' + _b.label + '<span class="ml-1 text-xs font-normal">' + (_done ? '（已啟用）' : '（未完成）') + '</span></div>' : '';
    var head = '<div class="flex flex-wrap items-baseline justify-between gap-2 mb-3">' +
        '<div class="text-xl font-bold text-amber-200">' + cat.name + '<span class="text-sm text-slate-400 font-normal ml-2">已收集 ' + cc.got + ' / ' + cc.total + '</span></div>' +
        _bonusHtml +
        '</div>';
    var cells = ids.map(function (id) {
        var d = DB.items[id]; var got = miscDexHas(id);
        var imgUrl = (typeof getIconUrl === 'function') ? getIconUrl(d) : (d.img || '');
        var silh = got ? '' : ' card-silhouette';
        var glow = (got && typeof getGlowClass === 'function') ? getGlowClass({ id: id }, d) : '';                 // 🌟 祝福(金)/詛咒(紅)卷軸對應光芒
        var nameCol = (got && typeof getItemColor === 'function') ? getItemColor({ id: id }) : (d.c || 'text-white');   // 祝福的=c-blessed金、詛咒的=c-cursed紅
        var nameHtml = got
            ? '<div class="text-xs font-bold ' + nameCol + ' truncate" title="' + (d.n || '') + '">' + (d.n || '') + '</div>'
            : '<div class="text-xs font-bold text-slate-500">？？？</div>';
        return '<div class="relative bg-slate-800/70 border ' + (got ? 'border-slate-600' : 'border-slate-700/60') + ' rounded-lg p-2 flex flex-col items-center gap-1 w-[112px]' + (got ? ' tip-host cursor-help' : '') + '"' + (got ? ' data-tip-id="' + id + '"' : '') + '>' +
            '<img src="' + imgUrl + '" alt="' + (d.n || '') + '" class="w-14 h-14 object-contain' + silh + (glow ? ' ' + glow : '') + '" onerror="this.onerror=null;this.src=\'https://placehold.co/56x56/1e293b/334155?text=%3F\';">' +
            '<div class="text-center w-full">' + nameHtml + '</div>' +
            '</div>';
    }).join('');
    host.innerHTML = head + '<div class="flex flex-wrap gap-2 justify-center">' + (cells || '<div class="text-slate-500 p-8">此類別暫無可收集的道具。</div>') + '</div>';
}

// ===== 📦 收藏面板（裝備 / 道具 / 怪物 三大入口）=====
function openCollectionPanel() { var el = document.getElementById('collection-panel'); if (el) el.classList.remove('hidden'); }
function closeCollectionPanel() { var el = document.getElementById('collection-panel'); if (el) el.classList.add('hidden'); }
function collectionPanelBackdrop(ev) { if (ev && ev.target && ev.target.id === 'collection-panel') closeCollectionPanel(); }
function collectionOpenEquip() { closeCollectionPanel(); if (typeof openEquipBook === 'function') openEquipBook(); }
function collectionOpenMisc() { closeCollectionPanel(); openMiscBook(); }
function collectionOpenCard() { closeCollectionPanel(); if (typeof openCardBook === 'function') openCardBook(); }
