// ===== 共用倉庫（存檔角色共用，獨立於存檔位的 localStorage 鍵）=====
// 🎮 經典模式與非經典模式角色的倉庫不共通：依 player.classicMode 切換 localStorage 鍵（傭兵走存檔位、與倉庫無關，仍共通）。
const WH_KEY = 'lineage_idle_warehouse';
function whKey(p){ let _p = (p !== undefined) ? p : player; return (_p && _p.traditionalMode) ? (WH_KEY + '_trad') : (_p && _p.classicMode) ? (WH_KEY + '_classic') : WH_KEY; }   // 🏛️ 傳統倉庫獨立桶（須先判 traditional，因傳統角色 classicMode 亦為 true）
const WH_MAX = 500;   // 倉庫格數上限（🔧 100 → 200 → 500）
const WH_NO_STORE = ['item_dk_insignia','new_item_239','new_item_241','new_item_collar_husky','new_item_238','new_item_184','new_item_185','new_collar_rabbit','new_collar_fox','new_collar_beagle','new_collar_stbernard','item_mastery_proof',
    'item_pride_pass_11','item_pride_pass_21','item_pride_pass_31','item_pride_pass_41','item_pride_pass_51','item_pride_pass_61','item_pride_pass_71','item_pride_pass_81','item_pride_pass_91',
    'item_dantes_letter','item_elf_whisper','item_ancient_book','item_sealed_intel','item_spy_report','item_chaos_key','item_royal_order','wpn_shaha_arrow','item_dragon_egg','item_card_book','item_equip_book'];   // 禁止存入倉庫：潘朵拉抽獎卷、王族搜索狀、四種項圈、精通之證、傲慢之塔傳送符(11~91F)、🔥50級試煉任務道具、🎴卡片收集冊
// 倉庫分類過濾（武器 / 防具 / 道具）：存入、取出共用同一個下拉清單
let _whFilter = 'weapon';
let _whQtyInput = '';   // 🔧 倉庫存取「數量」共用輸入（取代 prompt()；空字串或 0 ＝整疊全部）。以模組變數保存→面板每次重繪後數值不流失
function _whQtyVal(){ let v = parseInt(_whQtyInput, 10); return (v > 0) ? v : 0; }   // 0 ＝全部
function whSetQty(v){ _whQtyInput = (v == null) ? '' : String(v); }   // 由輸入框 oninput 呼叫（用具名函式而非 inline 指派 lexical let，與 whSetFilter 同模式·穩定）
function whCategory(id){
    let d = DB.items[id];
    if(!d) return 'item';
    if(d.type === 'wpn') return 'weapon';                       // 武器
    if(d.type === 'arm' || d.type === 'acc') return 'armor';    // 防具（含飾品）
    return 'item';                                              // 其餘皆道具
}
function whSetFilter(v){ _whFilter = v; renderWarehouseNPC(document.getElementById('interaction-content')); }
function loadWarehouse(){
    try { let s = _lzGet(whKey()); if(s){ let w = JSON.parse(s); return { items: w.items || [], gold: w.gold || 0 }; } } catch(e){}
    return { items: [], gold: 0 };
}
function saveWarehouse(w){ _lzSet(whKey(), JSON.stringify({ items: w.items, gold: w.gold })); }
// ===== 🎴🗡️ 共用收集圖鑑（卡片 cardDex／裝備 equipDex）：同模式角色共用，獨立於存檔位的 localStorage 鍵（概念同共用倉庫）=====
const CARDDEX_KEY = 'lineage_idle_carddex';
const EQUIPDEX_KEY = 'lineage_idle_equipdex';
function _dexKey(base, p){ let _p = (p !== undefined) ? p : player; return (_p && _p.traditionalMode) ? (base + '_trad') : (_p && _p.classicMode) ? (base + '_classic') : base; }   // 🏛️ 傳統／🎮 經典 各自獨立桶（同倉庫規則）
function _readDex(base){ try { let s = _lzGet(_dexKey(base)); if (s) { let o = JSON.parse(s); if (o && typeof o === 'object') return o; } } catch(e){} return {}; }
// 🔄 多開同步：回寫前先讀桶現值並合併（卡片取較高分、_v:2＝積分制；裝備布林聯集），避免用本分頁快照覆蓋其他分頁的進度（lost-update）
function saveCardDex(){
    if (!player || !player.cardDex) return;
    try {
        let cur = _readDex(CARDDEX_KEY);
        let _mig = (typeof cardTierToScore === 'function') ? cardTierToScore : function(v){ return v || 0; };
        let _old = (cur && cur._v !== 2);   // 桶為舊階級制→遷移
        let out = { _v: 2 };
        for (let k in cur) { if (k === '_v') continue; out[k] = _old ? _mig(cur[k]) : (cur[k] || 0); }   // 桶現值（其他分頁可能剛寫入）
        for (let k in player.cardDex) { let v = player.cardDex[k] || 0; if (v > (out[k] || 0)) out[k] = v; }   // 取較高分（只增不減）
        _lzSet(_dexKey(CARDDEX_KEY), JSON.stringify(out));
    } catch(e){}
}
function saveEquipDex(){
    if (!player || !player.equipDex) return;
    try {
        let out = Object.assign({}, _readDex(EQUIPDEX_KEY));   // 桶現值（其他分頁可能剛寫入）
        for (let k in player.equipDex) if (player.equipDex[k]) out[k] = true;   // 布林聯集（只增不減）
        _lzSet(_dexKey(EQUIPDEX_KEY), JSON.stringify(out));
    } catch(e){}
}
// 讀檔／創角時呼叫：把共用桶併進 player.cardDex/equipDex（卡片取較高分·裝備取聯集·只增不減），並回寫共用桶（種子化＋遷移舊存檔 per-character 資料·不丟失）
function loadSharedCollections(){
    if (!player) return;
    let shRaw = _readDex(CARDDEX_KEY), shEquip = _readDex(EQUIPDEX_KEY);
    // 🎴 卡片積分制遷移（一次性）：舊階級(1/2/3)→積分(1/10/100)。共用桶以 _v 標記、玩家存檔以 cardDexV 標記。
    let _mig = (typeof cardTierToScore === 'function') ? cardTierToScore : function(v){ return v || 0; };
    let _bucketOld = (shRaw && shRaw._v !== 2);
    let shCard = {};
    for (let k in shRaw) { if (k === '_v') continue; shCard[k] = _bucketOld ? _mig(shRaw[k]) : shRaw[k]; }
    if (player.cardDex && player.cardDexV !== 2) { for (let k in player.cardDex) player.cardDex[k] = _mig(player.cardDex[k]); player.cardDexV = 2; }
    let mC = Object.assign({}, shCard), pc = player.cardDex || {};
    for (let k in pc) if ((pc[k] || 0) > (mC[k] || 0)) mC[k] = pc[k];   // 🎴 卡片：取較高分（只增不減）
    player.cardDex = mC;
    player.equipDex = Object.assign({}, shEquip, player.equipDex || {});   // 🗡️ 裝備：布林聯集
    saveCardDex(); saveEquipDex();
}
// 🔄 多開同步：把「同模式」共用桶併回本分頁 player.cardDex/equipDex（只增不減）；回傳是否有變更。不回寫桶（避免分頁間 ping-pong）。which: 'card'|'equip'|undefined(兩者)
function mergeSharedIntoPlayer(which){
    if (!player) return false;
    let changed = false;
    if (which !== 'equip') {
        if (!player.cardDex) player.cardDex = {};
        let cur = _readDex(CARDDEX_KEY), _old = (cur && cur._v !== 2);
        let _mig = (typeof cardTierToScore === 'function') ? cardTierToScore : function(v){ return v || 0; };
        for (let k in cur) { if (k === '_v') continue; let v = _old ? _mig(cur[k]) : (cur[k] || 0); if (v > (player.cardDex[k] || 0)) { player.cardDex[k] = v; changed = true; } }
    }
    if (which !== 'card') {
        if (!player.equipDex) player.equipDex = {};
        let cur = _readDex(EQUIPDEX_KEY);
        for (let k in cur) if (cur[k] && !player.equipDex[k]) { player.equipDex[k] = true; changed = true; }
    }
    return changed;
}
function _refreshAfterDexSync(){
    if (typeof calcStats === 'function') calcStats();   // 重算地區完成加成並刷新角色面板（calcStats=recompute+updateUI）
    // ⚠️ 不呼叫 renderTabs：dex 不在 renderTabs._sig 簽章內、分頁內容不因 dex 改變；且 renderTabs(true) 會繞過 _tabPointerDown 延後保護→外部 storage 事件若落在玩家按住分頁鈕時會把按鈕重繪掉而吃掉點擊
    if (typeof _cardBookOpen !== 'undefined' && _cardBookOpen && typeof renderCardBook === 'function') renderCardBook();
    if (typeof _equipBookOpen !== 'undefined' && _equipBookOpen && typeof renderEquipBook === 'function') renderEquipBook();
}
// storage 事件：其他分頁更新了「同模式」桶 → 立即併回並刷新（一般/經典_classic/傳統_trad 各自獨立，互不同步）。
//  ⚠️ file:// 跨分頁不保證觸發 storage 事件→另在 openCardBook/openEquipBook 開頭 re-merge 作兜底。
function _syncSharedFromStorage(ev){
    if (!ev || !player || !player.cls) return;   // player 在標題/載入畫面是 cls:null 的 stub（js/01 createBase 前）→尚未開始遊戲，不對空 player 跑 merge/recompute/render
    let ck = _dexKey(CARDDEX_KEY), ek = _dexKey(EQUIPDEX_KEY);
    if (ev.key !== ck && ev.key !== ek) return;
    if (mergeSharedIntoPlayer(ev.key === ck ? 'card' : 'equip')) _refreshAfterDexSync();
}
if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('storage', _syncSharedFromStorage);
function _whStackFind(arr, it){ return ((it.en||0)===0 && !it.lock) ? arr.find(x => !x.lock && (x.en||0)===0 && sameItemSig(x, it)) : null; }   // 🔧 架構#3：統一簽章比對
// 物品完整簽章：名字(id)+強化值(en)+詞綴(祝福/遠古/屬性)；一鍵存入用來比對「完全相同」
function whSig(it){ return itemSig(it); }   // 🔧 架構#3：委派給單一事實來源 itemSig
// 一鍵存入：背包中「與倉庫現有物品 詞綴+名字+強化值 完全相同」者自動存入（鎖定物品保護、不可存物品略過）
function whOneClickDeposit(){
    let w = loadWarehouse();
    let whSigs = new Set(w.items.map(whSig));   // 倉庫現有物品簽章集合
    let deposited = 0, full = false;
    for(let it of player.inv.slice()){          // 用副本走訪，過程會改動 player.inv
        if(WH_NO_STORE.includes(it.id)) continue;   // 不可存入
        if(it.lock) continue;                        // 鎖定物品保護，不自動存入
        if(!whSigs.has(whSig(it))) continue;         // 倉庫沒有完全相同的 → 跳過
        let idx = player.inv.findIndex(i => i.uid === it.uid);
        if(idx < 0) continue;
        let cur = player.inv[idx];
        let stack = _whStackFind(w.items, cur);
        if(!stack && w.items.length >= WH_MAX){ full = true; break; }
        player.inv.splice(idx, 1);
        if(stack){ stack.cnt += cur.cnt; } else { w.items.push(cur); whSigs.add(whSig(cur)); }
        deposited++;
    }
    saveWarehouse(w); saveGame(); renderTabs(true); updateUI();
    renderWarehouseNPC(document.getElementById('interaction-content'));
    if(deposited > 0) logSys(`<span class="text-cyan-300 font-bold">一鍵存入：已存入 ${deposited} 項與倉庫現有物品相同的物品${full ? '（倉庫已滿，部分未存入）' : ''}。</span>`);
    else logSys(full ? `<span class="text-red-400">倉庫已滿，無法存入。</span>` : `背包中沒有與倉庫現有物品完全相同的可存入物品。`);
}
// 🔧 倉庫一鍵排列：規則與背包「一鍵排列」完全相同（共用 invSortCmp）
function sortWarehouse(){
    let w = loadWarehouse();
    if(!w.items.length){ logSys('<span class="text-slate-400">倉庫沒有物品可排列。</span>'); return; }
    w.items.sort(invSortCmp);
    saveWarehouse(w);
    logSys('<span class="text-cyan-300 font-bold">倉庫已重新排列。</span>');
    let el = document.getElementById('interaction-content'); if(el) renderWarehouseNPC(el);
}
function whDeposit(uidv, qty){
    let w = loadWarehouse();
    let idx = player.inv.findIndex(i => i.uid === uidv);
    if(idx < 0) return;
    let it = player.inv[idx];
    if(WH_NO_STORE.includes(it.id)){ logSys(`<span class="text-red-400">此物品無法存入倉庫。</span>`); return; }
    if(it.lock){ logSys(`<span class="text-red-400">鎖定物品需先解鎖才能存入倉庫。</span>`); return; }
    // 🔧 複數物品可選數量：改讀面板「數量」輸入框（取代 prompt）；輸入空或 0 ＝整疊全部
    let total = it.cnt || 1;
    if(qty === undefined){ let _q = _whQtyVal(); qty = (_q > 0) ? _q : total; }
    qty = Math.max(1, Math.min(total, qty || total));
    // 可堆疊(en0未鎖)合併進既有倉庫堆疊不佔新格；否則需有空格
    let stack = _whStackFind(w.items, it);
    if(!stack && w.items.length >= WH_MAX){ logSys(`<span class="text-red-400">倉庫已滿（上限 ${WH_MAX} 格）。</span>`); return; }
    if(qty >= total){          // 全部存入
        player.inv.splice(idx, 1);
        if(stack) stack.cnt += total; else w.items.push(it);
    } else {                   // 部分存入：背包留下剩餘
        it.cnt = total - qty;
        if(stack) stack.cnt += qty; else w.items.push({ ...it, uid: uid(), cnt: qty });
    }
    saveWarehouse(w); saveGame(); renderTabs(true); updateUI();
    renderWarehouseNPC(document.getElementById('interaction-content'));
}
function whWithdraw(uidv, qty){
    let w = loadWarehouse();
    let idx = w.items.findIndex(i => i.uid === uidv);
    if(idx < 0) return;
    let it = w.items[idx];
    // 🔧 複數物品可選數量：改讀面板「數量」輸入框（取代 prompt·避免手機/GitHub Pages/重複操作時跳出框失效→變成只能一個一個領）；輸入空或 0 ＝整疊全部
    let total = it.cnt || 1;
    if(qty === undefined){ let _q = _whQtyVal(); qty = (_q > 0) ? _q : total; }
    qty = Math.max(1, Math.min(total, qty || total));
    if(qty >= total){          // 全部取出
        w.items.splice(idx, 1);
        if(!it.uid || player.inv.some(x => x.uid === it.uid)) it.uid = uid();
        let stack = _whStackFind(player.inv, it);
        if(stack) stack.cnt += total; else player.inv.push(it);
    } else {                   // 部分取出：倉庫留下剩餘
        it.cnt = total - qty;
        let moved = { ...it, uid: uid(), cnt: qty };
        let stack = _whStackFind(player.inv, moved);
        if(stack) stack.cnt += qty; else player.inv.push(moved);
    }
    // 🔧 先存玩家存檔（已收到物品）再存倉庫（已移除物品）：萬一第二次寫入失敗（如 localStorage 容量爆），
    //    結果是「物品重複」而非「庫存消失卻沒領到」，避免領取時遺失物品。
    saveGame(); saveWarehouse(w); renderTabs(true); updateUI();
    renderWarehouseNPC(document.getElementById('interaction-content'));
}
function whGold(dir){
    let amt = parseInt(document.getElementById('wh-gold-amt').value) || 0;
    if(amt <= 0) return;
    let w = loadWarehouse();
    if(dir === 'in'){ amt = Math.min(amt, player.gold); player.gold -= amt; w.gold = (w.gold||0) + amt; }
    else { amt = Math.min(amt, w.gold||0); w.gold -= amt; player.gold += amt; }
    saveWarehouse(w); saveGame(); updateUI();
    renderWarehouseNPC(document.getElementById('interaction-content'));
}
function renderWarehouseNPC(div){
    _activePanel = null;   // 倉庫不需自動刷新
    let w = loadWarehouse();
    let mkBtn = (it, act) => `<button onclick="${act}('${it.uid}')" data-tip-uid="${it.uid}" data-tip-src="${act === 'whWithdraw' ? 'wh' : 'inv'}" class="tip-host btn w-full text-left py-1.5 px-2 text-sm bg-slate-800 hover:bg-slate-700 border-slate-600">${getItemFullName(it)}</button>`;
    let _invItems = player.inv.filter(it => whCategory(it.id) === _whFilter);
    let _whItems  = w.items.filter(it => whCategory(it.id) === _whFilter);
    let invHtml = _invItems.length ? _invItems.map(it => (WH_NO_STORE.includes(it.id) || it.lock)
        ? `<div data-tip-uid="${it.uid}" data-tip-src="inv" class="tip-host w-full text-left py-1.5 px-2 text-sm bg-slate-900/60 border border-slate-700 rounded opacity-50 cursor-not-allowed">${getItemFullName(it)} <span class="text-xs text-red-400">（${(it.lock && !WH_NO_STORE.includes(it.id)) ? '鎖定，需解鎖' : '不可存'}）</span></div>`
        : mkBtn(it, 'whDeposit')).join('') : '<div class="text-slate-500 text-sm text-center py-4">此分類背包沒有物品</div>';
    let whHtml  = _whItems.length ? _whItems.map(it => mkBtn(it, 'whWithdraw')).join('') : '<div class="text-slate-500 text-sm text-center py-4">此分類倉庫是空的</div>';
    let _oi = document.getElementById('wh-inv-list'), _os = document.getElementById('wh-store-list');
    let _whInvScroll = _oi ? _oi.scrollTop : 0, _whStoreScroll = _os ? _os.scrollTop : 0, _divScroll = div.scrollTop;
    div.innerHTML = `
    <div class="flex flex-col gap-3 p-1">
        <div class="text-slate-300 text-sm leading-relaxed">將物品或金幣存入倉庫，<b class="text-amber-300">四個存檔角色共用</b>。點背包物品＝存入；點倉庫物品＝取出（依下方<b class="text-amber-300">數量</b>欄取出／存入；留空＝整疊全部）。已裝備或鎖定中的物品無法存入（需先解鎖）。</div>
        <div class="flex items-center gap-2 bg-slate-800/60 border border-slate-600 rounded p-3 text-sm flex-wrap">
            <span>金幣　背包：<span class="text-yellow-400 font-bold">${player.gold}</span>　倉庫：<span class="text-yellow-400 font-bold">${w.gold||0}</span></span>
            <input id="wh-gold-amt" type="number" min="1" value="1000" class="w-24 bg-slate-900 border border-slate-600 text-center text-white rounded h-8 ms-auto">
            <button onclick="whGold('in')" class="btn px-4 text-sm font-bold h-8 inline-flex items-center justify-center" style="background: linear-gradient(135deg, #0c4a5e 0%, #0e7490 28%, #0a3d4d 52%, #11657e 76%, #093440 100%); color: #a5f3fc; border-color: #0891b2;">存入 ▶</button>
            <button onclick="whGold('out')" class="btn px-4 text-sm font-bold h-8 inline-flex items-center justify-center" style="background: linear-gradient(135deg, #6b2a10 0%, #b3490e 28%, #5a230e 52%, #9a3e0c 76%, #4a1d0c 100%); color: #fed7aa; border-color: #c2410c;">◀ 取出</button>
        </div>
        <div class="flex items-center gap-2 text-sm">
            <span class="text-slate-300 font-bold">物品分類：</span>
            <select onchange="whSetFilter(this.value)" class="bg-slate-900 border border-slate-600 text-white rounded py-1 px-2 text-sm">
                <option value="weapon" ${_whFilter==='weapon'?'selected':''}>武器</option>
                <option value="armor" ${_whFilter==='armor'?'selected':''}>防具</option>
                <option value="item" ${_whFilter==='item'?'selected':''}>道具</option>
            </select>
            <span class="text-slate-500 text-xs">（存入／取出共用此分類）</span>
            <span class="text-slate-300 font-bold ms-2">數量：</span>
            <input id="wh-qty-amt" type="number" min="1" placeholder="全部" value="${_whQtyInput}" oninput="whSetQty(this.value)" title="存入／取出的數量；留空或 0 ＝整疊全部（不再使用跳出式輸入框）" class="w-20 bg-slate-900 border border-slate-600 text-center text-white rounded h-8">
            <button onclick="whOneClickDeposit()" class="btn px-4 text-sm font-bold h-8 inline-flex items-center justify-center ms-auto" style="background: linear-gradient(135deg, #0c4a5e 0%, #0e7490 28%, #0a3d4d 52%, #11657e 76%, #093440 100%); color: #a5f3fc; border-color: #0891b2;" title="把背包中與倉庫現有物品（詞綴+名字+強化值完全相同）的物品自動存入；鎖定物品不動">一鍵存入</button>
            <button onclick="sortWarehouse()" class="btn px-4 text-sm font-bold h-8 inline-flex items-center justify-center" style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 28%, #16294a 52%, #1d4ed8 76%, #101f38 100%); color: #bfdbfe; border-color: #3b82f6;" title="依背包一鍵排列的相同規則整理倉庫物品">一鍵排列</button>
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col min-h-0">
                <div class="font-bold text-cyan-300 mb-1 text-sm">背包（點擊存入 ▶）</div>
                <div class="flex flex-col gap-1 overflow-y-auto pr-1" id="wh-inv-list" style="max-height:340px">${invHtml}</div>
            </div>
            <div class="flex flex-col min-h-0">
                <div class="font-bold text-amber-300 mb-1 text-sm flex justify-between">倉庫（點擊取出 ◀）<span class="text-slate-400 font-normal">${w.items.length}/${WH_MAX}</span></div>
                <div class="flex flex-col gap-1 overflow-y-auto pr-1" id="wh-store-list" style="max-height:340px">${whHtml}</div>
            </div>
        </div>
    </div>`;
    div.scrollTop = _divScroll;
    let _ni = document.getElementById('wh-inv-list'); if(_ni) _ni.scrollTop = _whInvScroll;
    let _ns = document.getElementById('wh-store-list'); if(_ns) _ns.scrollTop = _whStoreScroll;
}
// ===== 🐾 包武：寵物保管（項圈保管，最多 8 個；存於 player.petStorage，與其他存檔角色不共通）=====
//  ・回憶蠟燭(resetStatsCandle)只清背包項圈、不碰 petStorage（兩者天生分離，無需改 useCandle）。
//  ・提領受「魅力攜帶上限 floor(魅力/7)」限制（與誘捕同規則）；保管不受魅力限制。
const PET_STORAGE_MAX = 8;
function petCollarIds() { return Object.keys(PET_DEF).map(nm => PET_DEF[nm].collar); }   // 8 種項圈 id（基礎4＋進化4）
function petStorageList() { if (!Array.isArray(player.petStorage)) player.petStorage = []; return player.petStorage; }
function petStorageCount() { return petStorageList().reduce((s, it) => s + (it.cnt || 0), 0); }
function petStoreDeposit(collarId, locked) {
    if (!petCollarIds().includes(collarId)) return;
    locked = !!locked;   // 🔒 鎖定的項圈也可存入；鎖定/未鎖定的同種項圈各自分開保管
    let store = petStorageList();
    if (petStorageCount() >= PET_STORAGE_MAX) { logSys(`<span class="text-red-400">包武：保管箱已滿（上限 ${PET_STORAGE_MAX} 個項圈）。</span>`); return; }
    let invItem = player.inv.find(i => i.id === collarId && !!i.lock === locked && (i.cnt || 0) > 0);
    if (!invItem) { logSys('<span class="text-red-400">背包沒有這個項圈。</span>'); return; }
    invItem.cnt -= 1;
    if (invItem.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== invItem.uid);
    let st = store.find(s => s.id === collarId && !!s.lock === locked);
    if (st) st.cnt += 1; else store.push({ id: collarId, cnt: 1, lock: locked });
    logSys(`<span class="text-amber-300">已將 <b>${DB.items[collarId].n}</b>${locked ? '（鎖定）' : ''} 交給包武保管。</span>`);
    saveGame(); renderTabs();
    let _d = document.getElementById('interaction-content'); if (_d) renderPetStorageNPC(_d);
}
function petStoreWithdraw(collarId, locked) {
    locked = !!locked;
    let store = petStorageList();
    let st = store.find(s => s.id === collarId && !!s.lock === locked && (s.cnt || 0) > 0);
    if (!st) return;
    let limit = Math.min(8, Math.floor((player.d.cha || 0) / 7));   // 攜帶上限＝min(8, 魅力÷7)：硬上限 8（與誘捕同規則）
    if (totalCollarCount() >= limit) {
        logSys(`<span class="text-red-400">包武：你的魅力不足以攜帶更多項圈（攜帶上限 ${limit}），無法提領。請先提升魅力或放走部分夥伴。</span>`);
        return;
    }
    st.cnt -= 1;
    player.petStorage = store.filter(s => (s.cnt || 0) > 0);
    // 🔒 加回背包並還原鎖定狀態（不可用 gainItem：其堆疊簽章比對忽略 lock，會誤併入未鎖定堆而丟失鎖定）
    let inv = player.inv.find(i => i.id === collarId && !!i.lock === locked);
    if (inv) inv.cnt += 1;
    else player.inv.push({ id: collarId, uid: uid(), cnt: 1, en: 0, bless: false, anc: false, attr: false, seteff: false, lock: locked, junk: false });
    logSys(`<span class="text-amber-300">從包武處取回了 <b>${DB.items[collarId].n}</b>${locked ? '（鎖定）' : ''}。</span>`);
    saveGame(); renderTabs();
    let _d = document.getElementById('interaction-content'); if (_d) renderPetStorageNPC(_d);
}
function renderPetStorageNPC(div) {
    if (!Array.isArray(player.petStorage)) player.petStorage = [];
    let ids = petCollarIds();
    let stored = petStorageCount(), cap = PET_STORAGE_MAX;
    let carryLimit = Math.min(8, Math.floor((player.d.cha || 0) / 7)), carried = totalCollarCount();
    // 🔒 依 (id, 鎖定狀態) 分列：鎖定與未鎖定的同種項圈各自一列、各自存取，提領後維持原鎖定狀態
    let invRows = [], storeRows = [];
    ids.forEach(id => [false, true].forEach(lk => {
        let ic = player.inv.filter(i => i.id === id && !!i.lock === lk).reduce((s, i) => s + (i.cnt || 0), 0);
        if (ic > 0) invRows.push({ id, lock: lk, cnt: ic });
        let sc = player.petStorage.filter(s => s.id === id && !!s.lock === lk).reduce((s2, s) => s2 + (s.cnt || 0), 0);
        if (sc > 0) storeRows.push({ id, lock: lk, cnt: sc });
    }));
    let full = stored >= cap, blocked = carried >= carryLimit;
    let invHtml = invRows.length ? invRows.map(r => { let dd = DB.items[r.id];
        return `<div class="flex items-center justify-between gap-2 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm">
            <span class="${dd.c || 'text-white'}">${r.lock ? '🔒 ' : ''}${dd.n} ×${r.cnt}</span>
            <button onclick="petStoreDeposit('${r.id}',${r.lock})" ${full ? 'disabled' : ''} class="btn px-3 py-1 text-xs font-bold ${full ? 'opacity-40 cursor-not-allowed' : ''}" style="background:linear-gradient(135deg,#0c4a5e,#0e7490);color:#a5f3fc;border-color:#0891b2;">存入 ▶</button>
        </div>`; }).join('') : '<div class="text-slate-500 text-sm text-center py-4">背包沒有項圈</div>';
    let storeHtml = storeRows.length ? storeRows.map(r => { let dd = DB.items[r.id];
        return `<div class="flex items-center justify-between gap-2 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm">
            <span class="${dd.c || 'text-white'}">${r.lock ? '🔒 ' : ''}${dd.n} ×${r.cnt}</span>
            <button onclick="petStoreWithdraw('${r.id}',${r.lock})" ${blocked ? 'disabled' : ''} class="btn px-3 py-1 text-xs font-bold ${blocked ? 'opacity-40 cursor-not-allowed' : ''}" style="background:linear-gradient(135deg,#6b2a10,#b3490e);color:#fed7aa;border-color:#c2410c;">◀ 提領</button>
        </div>`; }).join('') : '<div class="text-slate-500 text-sm text-center py-4">保管箱是空的</div>';
    div.innerHTML = `
    <div class="flex flex-col gap-3 p-1">
        <div class="text-slate-300 text-sm leading-relaxed">包武：我幫你保管項圈。<b class="text-amber-300">最多 ${cap} 個，且與其他存檔角色不共通</b>。使用回憶蠟燭時只會清除背包中攜帶的項圈，<b class="text-amber-300">保管中的不受影響</b>。<b class="text-amber-300">🔒 鎖定的項圈也可保管，提領後仍維持鎖定</b>。提領時若魅力不足以攜帶更多項圈（攜帶上限＝魅力÷7）則無法提領。</div>
        <div class="flex items-center gap-4 bg-slate-800/60 border border-slate-600 rounded p-3 text-sm flex-wrap">
            <span>保管箱：<span class="text-amber-300 font-bold">${stored}/${cap}</span></span>
            <span>攜帶中項圈：<span class="${blocked ? 'text-red-400' : 'text-green-400'} font-bold">${carried}/${carryLimit}</span>（魅力 ${player.d.cha || 0}）</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col min-h-0">
                <div class="font-bold text-cyan-300 mb-1 text-sm">背包項圈（存入 ▶）</div>
                <div class="flex flex-col gap-1 overflow-y-auto pr-1" style="max-height:340px">${invHtml}</div>
            </div>
            <div class="flex flex-col min-h-0">
                <div class="font-bold text-amber-300 mb-1 text-sm">保管中（◀ 提領）</div>
                <div class="flex flex-col gap-1 overflow-y-auto pr-1" style="max-height:340px">${storeHtml}</div>
            </div>
        </div>
    </div>`;
}
// ===== 血盟 NPC：依詩蒂(海音) / 特羅斯(歐瑞) =====
const PLEDGE_CFG = {
    esti: { name: '依詩蒂', img: 'assets/character/依詩蒂.png', honor: '依詩蒂公主', pledgeName: '依詩蒂血盟', enemy: 'tros', enemyName: '特羅斯', seekLine: '我一直在尋覓著，願與我以血盟誓、生死相隨的夥伴呢…你，會是那個人嗎？' },
    tros: { name: '特羅斯', img: 'assets/character/特羅斯.png', honor: '特羅斯王子', pledgeName: '特羅斯血盟', enemy: 'esti', enemyName: '依詩蒂', seekLine: '我要的，是敢以鮮血立誓、與我並肩死戰到底的兄弟！你，夠膽嗎？' }
};
const PLEDGE_GIFT = [ { id: 'scroll_weapon', n: '對武器施法的卷軸', cnt: 5 }, { id: 'scroll_armor', n: '對盔甲施法的卷軸', cnt: 10 } ];
function pledgeCountItem(id) { return player.inv.filter(i => i.id === id).reduce((s, i) => s + i.cnt, 0); }

// 盟主的祝福（8 小時，存檔保留、死亡清空、可刷新）
const BLESSING_DEFS = {
    precise: { n: '精準目標', desc: '額外命中 +3' },
    blaze:   { n: '灼熱靈氣', desc: 'HP自然恢復量 +15、MP自然恢復量 +3' },
    brave:   { n: '勇敢靈氣', desc: '額外傷害 +3、額外魔法點數 +6' },
    support: { n: '援護盟友', desc: '傷害減免 +3' }
};
function blessingRemainText(key) {
    let exp = player.blessings && player.blessings[key];
    if (!exp || exp <= Date.now()) return '未啟用';
    let sec = Math.floor((exp - Date.now()) / 1000);
    let h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return `生效中・剩餘 ${h} 小時 ${m} 分`;
}

function renderPledgeNPC(div, faction) {
    _activePanel = 'pledge:' + faction; startPanelRefresh();
    let cfg = PLEDGE_CFG[faction];

    // 已加入本陣營：盟主祝福介面
    if (player.bloodPledge === faction) {
        let warrant = pledgeCountItem('new_item_241');
        let cards = Object.keys(BLESSING_DEFS).map(key => {
            let def = BLESSING_DEFS[key];
            let active = player.blessings && player.blessings[key] > Date.now();
            return `<button class="btn text-left ${active ? 'bg-amber-700 border-amber-400' : 'bg-amber-900/70 hover:bg-amber-800 border-amber-600'} py-2 px-2.5 flex flex-col gap-0.5 leading-tight" onclick="activateBlessing('${key}')">
                <div class="font-bold text-amber-100 text-sm">${def.n}</div>
                <div class="text-[11px] text-slate-300">${def.desc}</div>
                <div class="text-[10px] ${active ? 'text-green-300' : 'text-slate-500'}">${blessingRemainText(key)}</div>
            </button>`;
        }).join('');
        div.innerHTML = `
        <div class="flex flex-row gap-4 items-start p-3">
            <div class="w-[200px] h-[280px] border-4 border-amber-800 p-2 bg-slate-950/40 rounded-lg shadow-[0_0_30px_rgba(0,0,0,0.9)] outline outline-1 outline-offset-4 outline-amber-700/40 flex items-center justify-center shrink-0 overflow-hidden">
                <img src="${cfg.img}" alt="${cfg.name}" onerror="this.style.display='none';" class="w-full h-full object-cover object-top rounded pointer-events-none drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)]">
            </div>
            <div class="flex-1 min-w-0 flex flex-col gap-2.5">
                <div class="text-slate-200 text-base leading-relaxed">${cfg.name}：讓我們一起為血盟努力，並肩作戰吧！</div>
                <div class="flex gap-2">
                    <button class="btn bg-red-800 hover:bg-red-700 border-red-500 text-red-100 py-3 px-3 font-bold flex-1 leading-tight flex flex-col items-center justify-center gap-0.5" onclick="openSiegeSelect('${faction}')"><span class="text-base">⚔ 攻城戰</span><span class="text-[10px] text-red-300 font-normal">選擇要攻打的城池</span></button>
                    <button class="btn bg-amber-700 hover:bg-amber-600 border-amber-400 text-amber-50 py-3 px-3 font-bold flex-1 leading-tight flex flex-col items-center justify-center gap-0.5" onclick="claimSiegeReward('${faction}')"><span class="text-base">🏆 領賞</span><span class="text-[10px] text-amber-200 font-normal">攻城後領取</span></button>
                </div>
                <div class="text-center text-amber-300 font-bold text-base">交出王族搜索狀，獲取盟主的祝福</div>
                <div class="text-center text-slate-400 text-xs">持有王族搜索狀：<span class="text-green-400 font-bold">${warrant}</span> 張（每項消耗 1 張；已生效可再選以刷新）</div>
                <div class="grid grid-cols-2 gap-2">${cards}</div>
                ${player.cls === 'royal' ? '<div class="text-center text-amber-400/70 text-xs mt-1">👑 王族世代效忠，無法退出血盟。</div>' : `<button class="btn bg-red-950 hover:bg-red-900 border-red-700 text-red-300 py-1.5 px-4 text-sm rounded mt-1 mx-auto" onclick="leavePledge('${faction}')">退出血盟</button>`}
            </div>
        </div>`;
        return;
    }

    // 未加入：招募介面
    let dialogue = '', hint = '', btn = '';
    if (player.bloodPledge === cfg.enemy) {
        dialogue = `<span class="text-red-400 font-bold">${cfg.name}：你已是敵對陣營（${cfg.enemyName}血盟）的人，不想死就快滾！</span>`;
    } else if (player.lv < 20) {
        dialogue = `${cfg.name}：我要找的是更強大的盟友。`;
    } else {
        dialogue = `${cfg.name}：${cfg.seekLine}`;
        hint = `<div class="text-amber-300 text-sm mt-3">你是否效忠${cfg.honor}，加入後將與${cfg.enemyName}陣營為敵。</div>
               <div class="text-red-500 font-bold text-sm mt-2">注意：加入血盟後將遭遇敵對陣營追殺</div>`;
        btn = `<button class="btn w-full bg-blue-800 hover:bg-blue-700 border-blue-500 py-3 text-lg font-bold mt-4" onclick="confirmJoinPledge('${faction}')">加入血盟</button>`;
    }
    div.innerHTML = `
        <div class="flex flex-row gap-5 items-start p-4">
            <div class="w-[200px] h-[280px] border-4 border-amber-800 p-2 bg-slate-950/40 rounded-lg shadow-[0_0_30px_rgba(0,0,0,0.9)] outline outline-1 outline-offset-4 outline-amber-700/40 flex items-center justify-center shrink-0 overflow-hidden">
                <img src="${cfg.img}" alt="${cfg.name}" onerror="this.style.display='none';" class="w-full h-full object-cover object-top rounded pointer-events-none drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)]">
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-slate-200 text-lg leading-relaxed">${dialogue}</div>
                ${hint}
                ${btn}
            </div>
        </div>
    `;
}

// 攻城戰 / 領賞（功能未開放，暫為佔位；未來依攻城戰結果領賞）
function siegeComingSoon(label) {
    alert((label || '此') + '功能尚未開放，敬請期待！');
}

// 交出 1 張王族搜索狀，獲得（或刷新）盟主祝福，持續 24 小時（只受時間影響，不因攻城/死亡消失）
function activateBlessing(key) {
    if (!BLESSING_DEFS[key]) return;
    // 僅在「剩餘時間不到 4 小時」時才能消耗王族搜索狀刷新；剩餘超過 4 小時則不消耗、不刷新
    let remainMs = ((player.blessings && player.blessings[key]) || 0) - Date.now();
    if (remainMs >= 4 * 3600 * 1000) {
        let h = Math.floor(remainMs / 3600000), m = Math.floor((remainMs % 3600000) / 60000);
        alert(`「${BLESSING_DEFS[key].n}」剩餘時間還有 ${h} 小時 ${m} 分（超過 4 小時），尚無法刷新，不會消耗王族搜索狀。\n（剩餘不到 4 小時才能刷新）`);
        return;
    }
    let idx = player.inv.findIndex(i => i.id === 'new_item_241');
    if (idx === -1 || player.inv[idx].cnt <= 0) {
        alert('你沒有王族搜索狀，無法換取盟主的祝福。\n（擊敗血盟敵人可必定取得）');
        return;
    }
    player.inv[idx].cnt -= 1;
    if (player.inv[idx].cnt <= 0) player.inv.splice(idx, 1);
    if (!player.blessings) player.blessings = {};
    player.blessings[key] = Date.now() + 24 * 3600 * 1000;   // 24 小時（已生效則刷新）
    logSys(`你交出 1 張 王族搜索狀，獲得盟主的祝福：<span class="text-amber-300 font-bold">${BLESSING_DEFS[key].n}</span>（持續 24 小時）。`);
    calcStats();
    renderTabs();
    updateUI();
    saveGame();
    renderPledgeNPC(document.getElementById('interaction-content'), player.bloodPledge);
}

function confirmJoinPledge(faction) {
    let cfg = PLEDGE_CFG[faction];
    if (player.bloodPledge || player.lv < 20) return;
    if (confirm(`你確定要加入${cfg.pledgeName}？`)) joinPledge(faction);
}

function joinPledge(faction) {
    let cfg = PLEDGE_CFG[faction];
    if (player.cls === 'royal') return;   // 👑 王族陣營於創角時固定指派，不可由此變更
    if (player.bloodPledge) return;
    player.bloodPledge = faction;   // 設定血盟陣營標籤（供日後戰鬥遭遇特殊敵人觸發）
    if (!traditionalActive()) {   // 🏛️ 傳統模式：不發放入盟禮施法卷軸（傳統無強化），退盟亦不需交還
        PLEDGE_GIFT.forEach(g => gainItem(g.id, g.cnt, true, true));
        logSys(`<span class="text-green-300 font-bold">${cfg.name}：太好了，歡迎加入${cfg.pledgeName}，我的好夥伴！這些見面禮收下吧。</span>`);
        logSys(`你獲得了 對武器施法的卷軸 x5 與 對盔甲施法的卷軸 x10。`);
    } else {
        logSys(`<span class="text-green-300 font-bold">${cfg.name}：歡迎加入${cfg.pledgeName}，我的好夥伴！</span>`);
    }
    saveGame();
    renderTabs();
    updateUI();
    renderPledgeNPC(document.getElementById('interaction-content'), faction);
}

function leavePledge(faction) {
    let cfg = PLEDGE_CFG[faction];
    if (player.cls === 'royal') { logSys('<span class="text-amber-300">👑 王族世代效忠，無法退出血盟。</span>'); return; }   // 👑 王族不可退出
    if (player.bloodPledge !== faction) return;
    if (traditionalActive()) {   // 🏛️ 傳統模式：入盟未發放禮物卷軸，退盟亦不需交還
        if (!confirm(`${cfg.name}：確定要退出${cfg.pledgeName}？`)) return;
    } else {
        if (!confirm(`${cfg.name}：你必須交還贈送的禮物（對武器施法的卷軸 x5、對盔甲施法的卷軸 x10）才能退出血盟。確定交還並退出？`)) return;
        let lack = PLEDGE_GIFT.some(g => player.inv.filter(i => i.id === g.id && !i.lock).reduce((s, i) => s + i.cnt, 0) < g.cnt);   // 🔧 只計入未鎖定的卷軸
        if (lack) {
            logSys(`<span class="text-red-400">${cfg.name}：你的卷軸不足，無法退出血盟（需 對武器施法的卷軸 x5、對盔甲施法的卷軸 x10）。</span>`);
            alert(`禮物不足，無法退出血盟。\n需交還：對武器施法的卷軸 x5、對盔甲施法的卷軸 x10`);
            return;
        }
        // 交還（扣除）禮物
        PLEDGE_GIFT.forEach(g => {
            let remaining = g.cnt;
            player.inv.filter(i => i.id === g.id && !i.lock).forEach(it => {   // 🔧 鎖定的卷軸不被收走（與賣出/倉庫的鎖定保護一致）
                if (remaining <= 0) return;
                let take = Math.min(it.cnt, remaining);
                it.cnt -= take; remaining -= take;
            });
        });
        player.inv = player.inv.filter(i => i.cnt > 0);
    }
    player.bloodPledge = null;
    logSys(`<span class="text-slate-300">${cfg.name}：很遺憾……你交還了禮物，已退出${cfg.pledgeName}。</span>`);
    saveGame();
    renderTabs();
    updateUI();
    renderPledgeNPC(document.getElementById('interaction-content'), faction);
}

// ===== 🔮 試煉「席琳兌換」共用 =====
// 原需求道具外，額外消耗 1 個席琳結晶；兌換出的裝備必定附帶隨機一種席琳套裝效果。
// 按鈕版面：原本的全寬兌換鈕改為左右各半（左＝一般兌換、右＝席琳兌換）。
// 僅提供給「成品部位可附加套裝效果」的兌換（武器/頭盔/盔甲/手套/長靴/斗篷/腰帶）。
function sherineExBtns(label, normalCall, sherineCall) {
    let _shBtn = player.classicMode   // 🎮 經典模式：隱藏席琳兌換選項（一般兌換鈕 flex-1 自動撐滿整列）
        ? ''
        : `<button class="btn flex-1 bg-green-900 hover:bg-green-800 border-green-600 py-3 text-base font-bold" onclick="${sherineCall}" title="額外消耗 1 個席琳結晶：成品必定附帶一種席琳套裝效果"><span class="c-sherine">席琳兌換</span>：${label}</button>`;
    return `<div class="flex gap-2 w-full">
        <button class="btn flex-1 bg-blue-800 py-3 text-base font-bold" onclick="${normalCall}">兌換：${label}</button>
        ${_shBtn}
    </div>`;
}
// 席琳兌換前置檢查（於原材料檢查通過後、扣除材料前呼叫）：沒有結晶 → 提示並中止
function sherineExCheck(sherine) {
    if (!sherine) return true;
    if (questCountId('sherine_crystal') < 1) {   // 🔧 含倉庫
        logSys('<span class="text-red-400 font-bold">材料不足，無法兌換。</span><span class="text-red-300">（尚缺：席琳結晶 1）</span>');
        return false;
    }
    return true;
}
// 席琳兌換發放獎勵：扣 1 個結晶並使成品必定附帶套裝效果（取代各兌換函式中的 gainItem）
function sherineExGain(rewardId, sherine) {
    if (sherine) {
        questConsumeId('sherine_crystal', 1);   // 🔧 背包優先，不足扣倉庫
        _forceSherineSet = true;
    }
    { let _sv = _tradLootCtx; _tradLootCtx = true; try { gainItem(rewardId, 1, false, false); } finally { _tradLootCtx = _sv; } }   // 🏛️ 傳統模式：兌換裝備比照掉落/製作自帶隨機強化值（forceNormal=false：詞綴機率同一般兌換）
    _forceSherineSet = false;
}

// ===== 🔧 試煉兌換數量：可一次兌換多個（共用 UI＋核心）=====
//  trialQtyBar()：數量選擇器（−/＋/全部，id=trial-qty），各試煉的兌換按鈕前放一次。
//  trialRun(reqs, rewardId, sherine)：扣材料×qty、發獎勵×qty；qty 取「輸入值」與「可負擔上限」較小者。回傳實際次數。
function trialQtyBar() {
    return `<div class="flex items-center justify-center gap-2 mb-3">
        <span class="text-slate-400 text-sm">兌換數量</span>
        <button class="btn px-3 py-1 text-base font-bold bg-slate-700 border-slate-500" onclick="trialQtyAdj(-1)">−</button>
        <input id="trial-qty" type="number" min="1" value="1" class="w-16 bg-slate-900 border border-slate-600 text-white text-center rounded py-1" oninput="if((parseInt(this.value)||0)<1)this.value=1">
        <button class="btn px-3 py-1 text-base font-bold bg-slate-700 border-slate-500" onclick="trialQtyAdj(1)">＋</button>
        <button class="btn px-3 py-1 text-sm font-bold bg-amber-800 border-amber-600 text-amber-100" onclick="document.getElementById('trial-qty').value=999" title="設為最大；兌換時自動以可負擔上限為準">全部</button>
    </div>`;
}
function trialQtyAdj(d) { let el = document.getElementById('trial-qty'); if (!el) return; el.value = Math.max(1, (parseInt(el.value) || 1) + d); }
function trialQtyVal() { let el = document.getElementById('trial-qty'); let v = el ? parseInt(el.value) : 1; return (!v || v < 1) ? 1 : v; }
function trialRun(reqs, rewardId, sherine) {
    let norm = reqs.map(r => Array.isArray(r) ? r : [r, 1]);
    let maxN = Math.min.apply(null, norm.map(p => Math.floor(questCountId(p[0]) / (p[1] || 1))));
    if (!isFinite(maxN)) maxN = 0;
    if (sherine) maxN = Math.min(maxN, questCountId('sherine_crystal'));   // 席琳兌換：每個額外耗 1 結晶
    let qty = Math.min(trialQtyVal(), Math.max(0, maxN));
    if (qty < 1) { logSys('<span class="text-red-400 font-bold">材料不足，無法兌換。</span>'); return 0; }
    norm.forEach(p => questConsumeId(p[0], (p[1] || 1) * qty));   // 🔧 背包優先扣除，不足扣共用倉庫
    let _savedTrad = _tradLootCtx; _tradLootCtx = true;   // 🏛️ 傳統模式：試煉／任務「兌換」物品比照製作／掉落，裝備隨機自帶強化值（2026-06 用戶更正：原誤設 +0；非傳統模式由 gainItem 的 traditionalActive() 閘恆 +0）
    try {
        for (let i = 0; i < qty; i++) {
            if (sherine) { questConsumeId('sherine_crystal', 1); _forceSherineSet = true; }
            gainItem(rewardId, 1, false, false);   // forceNormal=false：詞綴機率同一般兌換
            _forceSherineSet = false;
        }
    } finally { _tradLootCtx = _savedTrad; }
    return qty;
}
function trialExName(n, rewardId) { return `${DB.items[rewardId].n}${n > 1 ? ` ×${n}` : ''}`; }

function renderRickyQuest(div) {
    if (player.cls !== 'knight') {
        div.innerHTML = `<div class="p-6 text-red-400">瑞奇：這是專屬於騎士的榮耀試煉，請回吧。</div>`;
        return;
    }

    // 👇 若你的資料庫 ID 不同，請修改這裡的字串
    let reqIds = ['new_item_196', 'new_item_198', 'new_item_206']; 
    let hasAll = reqIds.every(id => questCountId(id) >= 1);

    let html = `<div class="p-4 text-slate-300">
        瑞奇：證明你的騎士精神！帶來<b>黑騎士的誓約</b>、<b>古老的交易文件</b>與<b>龍龜甲</b>各一個，我便將這頂紅騎士頭巾賜予你。<br><br>
        目前收集：${hasAll ? '<span class="text-green-400 font-bold">已收集完成！</span>' : '<span class="text-red-400">材料不足</span>'}
    </div>`;

    if (hasAll) {
        // 👇 這裡的 'arm_redknight_hood' 請改成你資料庫中「紅騎士頭巾」的真實 ID
        html += `<div class="p-4">
            ${trialQtyBar()}
            ${sherineExBtns('紅騎士頭巾', "doRickyExchange('arm_53')", "doRickyExchange('arm_53', true)")}
        </div>`;
    }
    div.innerHTML = html;
}
function renderJamesQuest(div) {
    // 法師限定判斷
    if (player.cls !== 'mage') {
        div.innerHTML = `<div class="p-6 text-red-400">詹姆：這是不死族的黑暗試煉，只有法師能夠參與。</div>`;
        return;
    }

    // 檢查背包是否有這三樣指定道具
    let reqIds = ['new_item_204', 'new_item_205', 'new_item_203']; 
    let hasAll = reqIds.every(id => questCountId(id) >= 1);

    let html = `<div class="p-4 text-slate-300">
        詹姆：年輕的法師啊，若你能帶來<b>食屍鬼的指甲</b>、<b>食屍鬼的牙齒</b>與<b>骷髏頭</b>各一個，我便將這本魔法能量之書交給你。<br><br>
        目前收集：${hasAll ? '<span class="text-green-400 font-bold">已收集完成！</span>' : '<span class="text-red-400">材料不足</span>'}
    </div>`;

    // 如果材料夠，顯示兌換按鈕
    if (hasAll) {
        html += `<div class="p-4">
            ${trialQtyBar()}
            <button class="btn w-full bg-blue-800 py-3 text-lg font-bold" onclick="doJamesExchange('arm_115')">兌換：魔法能量之書</button>
        </div>`;
    }
    div.innerHTML = html;
}

function doJamesExchange(rewardId) {
    let n = trialRun(['new_item_204', 'new_item_205', 'new_item_203'], rewardId, false);
    if (!n) return;
    saveGame();   // 兌換取得物品後立即存檔
    logSys(`詹姆：試煉通過！你獲得了 ${trialExName(n, rewardId)}。`);
    closeNpcInteraction();
    renderTabs();
}

// ===== 🛡️ 尤麗婭（說話之島）：以歐林的日記本兌換臂甲（三選一，每件消耗 1 本）=====
const YURIA_REWARDS = [
    { id: 'armguard_con',      nm: '體力臂甲' },
    { id: 'armguard_guardian', nm: '守護者臂甲' },
    { id: 'armguard_mage',     nm: '法師臂甲' }
];
// 👹 尤麗婭第二兌換：以 黑暗哈汀的日記本 六選一兌換 隱藏的魔族武器（每件消耗 1 本）
const YURIA_HATIN_REWARDS = [
    { id: 'wpn_demon_sword_hidden', nm: '隱藏的魔族之劍' },
    { id: 'wpn_demon_bow_hidden',   nm: '隱藏的魔族弓箭' },
    { id: 'wpn_demon_wand_hidden',  nm: '隱藏的魔族魔杖' },
    { id: 'wpn_demon_claw_hidden',  nm: '隱藏的魔族鋼爪' },
    { id: 'wpn_demon_chain_hidden', nm: '隱藏的魔族鎖鏈劍' },
    { id: 'wpn_demon_qigu_hidden',  nm: '隱藏的魔族奇古獸' }
];
function renderYuriaQuest(div) {
    let have = questCountId('item_olin_diary');
    let html = `<div class="p-4 text-slate-300 leading-relaxed">尤麗婭：帶來<b class="text-amber-300">歐林的日記本</b>，我便為你打造一件臂甲（裝於<b class="text-amber-300">副手</b>，可與雙手武器並用）。<br>持有歐林的日記本：<b class="${have >= 1 ? 'text-green-400' : 'text-red-400'}">${have}</b><br><span class="text-slate-400 text-sm">每件消耗 1 本，三選一。</span></div>`;
    if (have >= 1) {
        html += `<div class="grid grid-cols-1 gap-3 p-4">`;
        YURIA_REWARDS.forEach(r => { html += `<button class="btn bg-indigo-800 hover:bg-indigo-700 border-indigo-500 py-2 px-4 font-bold" onclick="doYuriaExchange('${r.id}')">兌換：${r.nm}（需 歐林的日記本 ×1）</button>`; });
        html += `</div>`;
    } else {
        html += `<div class="px-4 pb-4 text-red-400 text-sm">你沒有歐林的日記本。</div>`;
    }
    // 👹 第二兌換：黑暗哈汀的日記本 → 隱藏的魔族武器（六選一）
    let have2 = questCountId('item_hatin_diary');
    html += `<div class="p-4 pt-2 text-slate-300 leading-relaxed border-t border-slate-700/60">尤麗婭：你身上那本<b class="text-purple-300">黑暗哈汀的日記本</b>……裡頭的禁咒，我能據以打造一件<b class="text-purple-300">隱藏的魔族武器</b>。<br>持有黑暗哈汀的日記本：<b class="${have2 >= 1 ? 'text-green-400' : 'text-red-400'}">${have2}</b><br><span class="text-slate-400 text-sm">每件消耗 1 本，六選一。</span>${!player.classicMode ? `<br><span class="text-xs text-slate-400">🔮 <span class="c-sherine font-bold">席琳兌換</span>：每件額外消耗 1 個 <b class="c-sherine">席琳結晶</b>（持有 ${questCountId('sherine_crystal')}），成品必定附帶一種隨機 <span class="c-sherine">席琳套裝效果</span>。</span>` : ''}</div>`;
    if (have2 >= 1) {
        html += `<div class="grid grid-cols-1 gap-3 p-4 pt-0">`;
        YURIA_HATIN_REWARDS.forEach(r => { html += sherineExBtns(r.nm, `doYuriaHatinExchange('${r.id}',false)`, `doYuriaHatinExchange('${r.id}',true)`); });   // 🔮 一般兌換 + 席琳兌換雙鈕（經典自動隱藏席琳鈕）
        html += `</div>`;
    } else {
        html += `<div class="px-4 pb-4 text-red-400 text-sm">你沒有黑暗哈汀的日記本（可由 惡靈／魔物封印室 的 哈汀之影 取得）。</div>`;
    }
    div.innerHTML = html;
}
function doYuriaExchange(rewardId) {
    if (!YURIA_REWARDS.some(r => r.id === rewardId)) return;
    if (questCountId('item_olin_diary') < 1) { logSys('<span class="text-red-400 font-bold">歐林的日記本不足。</span>'); return; }
    questConsumeId('item_olin_diary', 1);   // 背包優先，不足扣倉庫
    { let _sv = _tradLootCtx; _tradLootCtx = true; try { gainItem(rewardId, 1, false, false); } finally { _tradLootCtx = _sv; } }   // 🏛️ 傳統模式：臂甲兌換自帶隨機強化值（詞綴機率同一般；slot:shield 不會出席琳效果）
    saveGame();
    logSys(`<span class="text-amber-200">尤麗婭：拿去吧，這是你的 <b>${DB.items[rewardId].n}</b>。</span>`);
    closeNpcInteraction();
    renderTabs();
}

// 🏴‍☠️ 希米哲（海賊島村莊）：兒子的信＋兒子的遺骸＋兒子的肖像畫 各 1 → 藍海賊裝備五選一（無兌換次數限制）
//  一般模式支援席琳兌換（額外 1 席琳結晶→必帶套裝效果·sherineExBtns 於經典/傳統自動隱藏）；傳統模式由 sherineExGain 的 _tradLootCtx 自帶隨機強化值
const SHIMIZHE_COST = [['item_son_letter', 1], ['item_son_remains', 1], ['item_son_portrait', 1]];
const SHIMIZHE_REWARDS = ['arm_bluepirate_helm', 'arm_bluepirate_boots', 'arm_bluepirate_gloves', 'arm_bluepirate_armor', 'arm_bluepirate_cloak'];
function _shimizheCostHtml() {
    return SHIMIZHE_COST.map(([id, cnt]) => `${DB.items[id].n}×${cnt}（持有 ${questCountId(id)}）`).join('、');
}
function _shimizheEnough() { return SHIMIZHE_COST.every(([id, cnt]) => questCountId(id) >= cnt); }
function renderShimizheExchange(div) {
    let ok = _shimizheEnough();
    let h = `<div class="p-4 text-slate-300 leading-relaxed">希米哲：若你尋回我兒子的遺物，我便將他生前的藍海賊裝備擇一贈予你，聊表謝意。<br><span class="text-slate-400 text-sm">每次兌換消耗 ${_shimizheCostHtml()}（五選一・無次數限制）</span>`;
    if (!player.classicMode) h += `<br><span class="text-xs text-slate-400">🔮 <span class="c-sherine font-bold">席琳兌換</span>：每件額外消耗 1 個 <b class="c-sherine">席琳結晶</b>（持有 ${questCountId('sherine_crystal')}），成品必定附帶一種隨機 <span class="c-sherine">席琳套裝效果</span>。</span>`;
    h += `</div>`;
    if (ok) {
        h += `<div class="grid grid-cols-1 gap-3 p-4 pt-0">`;
        SHIMIZHE_REWARDS.forEach(id => { h += sherineExBtns(DB.items[id].n, `shimizheEx('${id}',false)`, `shimizheEx('${id}',true)`); });
        h += `</div>`;
    } else {
        h += `<div class="px-4 pb-4 text-red-400 text-sm">尚未備齊三件遺物（兒子的信、兒子的遺骸、兒子的肖像畫）。</div>`;
    }
    div.innerHTML = h;
}
function shimizheEx(rewardId, sherine) {
    if (SHIMIZHE_REWARDS.indexOf(rewardId) === -1) return;
    if (!_shimizheEnough()) { logSys('<span class="text-red-400 font-bold">遺物尚未備齊。</span>'); return; }
    if (!sherineExCheck(sherine)) return;   // 🔮 席琳兌換缺結晶→提示並中止（不扣遺物）
    SHIMIZHE_COST.forEach(([id, cnt]) => questConsumeId(id, cnt));   // 背包優先，不足扣倉庫
    sherineExGain(rewardId, sherine);   // 🔮 扣 1 結晶(若席琳)＋_forceSherineSet；🏛️ _tradLootCtx=true→傳統模式自帶隨機強化值
    logSys(`<span class="text-amber-200">希米哲：謝謝你……這是 <b>${DB.items[rewardId].n}</b>，就交給你了。</span>`);
    saveGame(); renderTabs();
    let _c = document.getElementById('interaction-content'); if (_c) renderShimizheExchange(_c);
}

function doYuriaHatinExchange(rewardId, sherine) {   // 🔮 sherine=true：席琳兌換（額外消耗 1 席琳結晶，成品必帶套裝效果）
    if (!YURIA_HATIN_REWARDS.some(r => r.id === rewardId)) return;
    if (questCountId('item_hatin_diary') < 1) { logSys('<span class="text-red-400 font-bold">黑暗哈汀的日記本不足。</span>'); return; }
    if (!sherineExCheck(sherine)) return;   // 🔮 席琳兌換缺結晶→提示並中止（不扣日記本）
    questConsumeId('item_hatin_diary', 1);   // 背包優先，不足扣倉庫
    sherineExGain(rewardId, sherine);   // 🔮 扣 1 結晶(若席琳)＋_forceSherineSet 必帶套裝效果；🏛️ _tradLootCtx=true→傳統模式自帶隨機強化值
    saveGame();
    logSys(`<span class="text-fuchsia-200">尤麗婭：成了……這是你的 <b>${sherine ? '<span class="c-sherine">席琳·</span>' : ''}${DB.items[rewardId].n}</b>，小心別讓它反噬了你。</span>`);
    renderTabs();
    let _c = document.getElementById('interaction-content'); if (_c) renderYuriaQuest(_c);   // 🔮 就地重渲染（更新日記本/結晶持有數，可連續兌換）
}

// ===== 雷德的復仇（全職業）：集齊魔法寶石×100＋五枚部下證明戒指，兌換召喚控制戒指 =====
const RED_QUEST_REQS = [
    ['new_item_150', 100],
    ['quest_ring_darkdweller', 1],
    ['quest_ring_beasttamer', 1],
    ['quest_ring_elfcaller', 1],
    ['quest_ring_summoner', 1],
    ['quest_ring_darkmage', 1]
];
function renderRedQuest(div) {
    let hasAll = RED_QUEST_REQS.every(([id, n]) => questCountId(id) >= n);
    let listHtml = RED_QUEST_REQS.map(([id, n]) => {
        let have = questCountId(id);
        let ok = have >= n;
        return `<div class="flex justify-between gap-3"><span class="text-slate-300">${DB.items[id].n}</span><span class="${ok ? 'text-green-400' : 'text-red-400'} font-bold">${have}/${n}</span></div>`;
    }).join('');
    let html = `<div class="p-4 text-slate-300 leading-relaxed">
        雷德：為了向<b class="text-red-300">蕾雅</b>復仇，我需要她那些部下的證明物。帶齊下列材料，我便將<b class="text-amber-300">召喚控制戒指</b>交給你。<br><br>
        <div class="bg-slate-900/60 border border-slate-700 rounded p-3 text-sm space-y-1">${listHtml}</div>
    </div>`;
    if (hasAll) {
        html += `<div class="p-4"><button class="btn w-full bg-blue-800 hover:bg-blue-700 border-blue-500 py-3 text-lg font-bold" onclick="doRedExchange()">兌換：召喚控制戒指</button></div>`;
    } else {
        html += `<div class="px-4 pb-4 text-red-400 text-sm">材料不足。</div>`;
    }
    div.innerHTML = html;
}
function doRedExchange() {
    if (!RED_QUEST_REQS.every(([id, n]) => questCountId(id) >= n)) return;   // 二次確認，避免開著視窗丟材料仍可按
    RED_QUEST_REQS.forEach(([id, n]) => questConsumeId(id, n));   // 背包優先扣除，不足自動扣共用倉庫
    { let _sv = _tradLootCtx; _tradLootCtx = true; try { gainItem('acc_summon_ctrl', 1, false, false); } finally { _tradLootCtx = _sv; } }   // 🏛️ 傳統模式：兌換飾品自帶隨機強化值
    saveGame();
    logSys(`雷德：這是你應得的——<span class="text-amber-300 font-bold">召喚控制戒指</span>。願它助你向蕾雅討回公道。`);
    closeNpcInteraction();
    renderTabs();
}

function doRickyExchange(rewardId, sherine) {   // 🔮 sherine=true：席琳兌換（每個額外 1 席琳結晶，必帶套裝效果）
    let n = trialRun(['new_item_196', 'new_item_198', 'new_item_206'], rewardId, sherine);
    if (!n) return;
    saveGame();   // 兌換取得物品後立即存檔
    logSys(`瑞奇：真正的騎士！你獲得了 ${trialExName(n, rewardId)}。`);
    closeNpcInteraction();
    renderTabs();
}
// 🔧 黑暗妖精限定試煉（仿瑞奇/甘特）：以指定首級/誓約交換影子裝備，支援席琳兌換、無次數限制
const DARK_TRIAL_CFG = {
    npc_runde:   { npc: '倫得',     req: 'item_death_oath',     reward: 'arm_shadowglove', reqName: '死亡誓約',     rewardName: '影子手套',
        line: '倫得壓低了嗓音：「<b class="text-amber-300">死亡誓約</b>……那是強盜用性命簽下的契約。把它交給我，這雙浸透暗影的<b class="text-amber-300">影子手套</b>，便為你所用。」',
        done: '倫得：「暗影已認可你。去吧，讓他們連你的出手都看不見。」' },
    npc_kang:    { npc: '康',       req: 'item_orc_elder_head', reward: 'arm_shadowmask',  reqName: '妖魔長老首級', rewardName: '影子面具',
        line: '康咧嘴一笑：「<b class="text-amber-300">妖魔長老的首級</b>？你比我想的更狠。以此為證，戴上這張<b class="text-amber-300">影子面具</b>，敵人連你的臉都將記不得。」',
        done: '康放聲大笑：「哈！這才是黑暗妖精的覺悟。影子面具，歸你了。」' },
    npc_brudica: { npc: '布魯迪卡', req: 'item_yeti_head',      reward: 'arm_shadowboots', reqName: '雪怪首級',     rewardName: '影子長靴',
        line: '布魯迪卡挑了挑眉：「<b class="text-amber-300">雪怪的首級</b>？連冰原的咆哮都擋不住你的腳步。換上這雙<b class="text-amber-300">影子長靴</b>，你將如風暗行、無聲無息。」',
        done: '布魯迪卡：「去吧，讓黑暗成為你腳下的疾風。」' }
};
function renderDarkTrial(div, npcId) {
    let cfg = DARK_TRIAL_CFG[npcId];
    if (!cfg) return;
    if (player.cls !== 'dark') {
        div.innerHTML = `<div class="p-6 text-red-400">${cfg.npc}：這是黑暗妖精的試煉，外人不得參與。</div>`;
        return;
    }
    let has = questCountId(cfg.req) >= 1;   // 🔧 含倉庫
    let html = `<div class="p-4 text-slate-300 leading-relaxed">
        ${cfg.line || (cfg.npc + '：帶來<b>' + cfg.reqName + '</b>，我便將<b>' + cfg.rewardName + '</b>交予你。')}<br><br>
        <span class="text-slate-400">所需：</span><b class="text-amber-300">${cfg.reqName}</b> × 1　${has ? '<span class="text-green-400 font-bold">（已備齊）</span>' : '<span class="text-red-400">（尚缺）</span>'}
    </div>`;
    if (has) {
        html += `<div class="p-4">${trialQtyBar()}${sherineExBtns(cfg.rewardName, `doDarkTrialExchange('${npcId}')`, `doDarkTrialExchange('${npcId}', true)`)}</div>`;
    }
    if (npcId === 'npc_brudica' && (player.lv||1) >= 50) html += `<hr class="border-slate-700 my-3">` + build50TrialHTML('布魯迪卡');   // 🔥 布魯迪卡：追加黑暗妖精 50 級試煉
    div.innerHTML = html;
}
function doDarkTrialExchange(npcId, sherine) {   // 🔮 sherine=true：席琳兌換（每個額外 1 席琳結晶，必帶套裝效果）
    let cfg = DARK_TRIAL_CFG[npcId];
    if (!cfg || player.cls !== 'dark') return;
    let n = trialRun([cfg.req], cfg.reward, sherine);
    if (!n) return;
    saveGame();   // 兌換取得物品後立即存檔
    logSys(`${cfg.done || (cfg.npc + '：試煉通過！')} <span class="text-amber-200">（獲得 ${trialExName(n, cfg.reward)}）</span>`);
    closeNpcInteraction();
    renderTabs();
}
// ===== 🔥 各職業 50 級試煉系統（迪嘉勒廷＝騎士/妖精/法師；布魯迪卡＝黑暗妖精）=====
const TRIAL_50_CFG = {
    knight: { npc: '迪嘉勒廷',
        stages: [ {id:'item_dantes_letter', nm:'丹特斯的召書', cnt:1, hint:'擊殺黑暗妖精將軍'},
                  {id:'item_elf_whisper', nm:'精靈的私語', cnt:10, hint:'擊殺精靈墓穴的怪物'} ],
        exMat:'mat_flame_sword', exMatNm:'炎魔之劍', rewards:[{id:'wpn_blackflame_sword',nm:'黑焰之劍'},{id:'bot_courage',nm:'勇氣長靴'}] },
    elf: { npc: '迪嘉勒廷',
        stages: [ {id:'item_ancient_book', nm:'古代黑妖之秘笈', cnt:1, hint:'擊殺巨大兵蟻'},
                  {id:'item_sealed_intel', nm:'密封的情報書', cnt:1, hint:'於大洞穴隱遁者村莊地區擊殺魔族暗殺團'} ],
        exMat:'mat_flame_claw', exMatNm:'炎魔之爪', rewards:[{id:'wpn_redflame_bow',nm:'赤焰之弓'},{id:'wpn_redflame_sword',nm:'赤焰之劍'},{id:'bot_sephia',nm:'賽菲亞長靴'}] },
    mage: { npc: '迪嘉勒廷',
        stages: [ {id:'item_spy_report', nm:'間諜報告書', cnt:1, hint:'於大洞穴隱遁者村莊地區擊殺魔族暗殺團'} ],
        exMat:'mat_flame_eye', exMatNm:'炎魔之眼', rewards:[{id:'wpn_mana_orb',nm:'瑪那水晶球'},{id:'bot_mana',nm:'瑪那長靴'}] },
    royal: { npc: '迪嘉勒廷',
        stages: [ {id:'item_royal_order', nm:'調職命令書', cnt:1, hint:'擊殺小惡魔'} ],
        exMat:'mat_flame_heart', exMatNm:'炎魔之心', rewards:[{id:'wpn_golden_scepter',nm:'黃金權杖'},{id:'bot_divine_will',nm:'神意長靴'}] },
    dark: { npc: '布魯迪卡',
        stages: [ {id:'item_chaos_key', nm:'混沌鑰匙', cnt:1, hint:'擊殺黑暗棲林者'} ],
        exMat:'item_fallen_key', exMatNm:'墮落鑰匙', rewards:[{id:'wpn_death_finger',nm:'死亡之指'}] }
};
function build50TrialHTML(npcName) {
    let cfg = TRIAL_50_CFG[player.cls];
    if (!cfg || cfg.npc !== npcName) return `<div class="p-4 text-slate-400">${npcName}：這場試煉與你的職業無關。</div>`;
    if ((player.lv||1) < 50) return `<div class="p-4 text-red-400">${npcName}：等級達到 50 才能參加此試煉。</div>`;
    let st = player.trialStage || 0, nStages = cfg.stages.length;
    let h = `<div class="p-4 text-slate-300 leading-relaxed"><div class="text-amber-300 font-bold mb-2">⚔️ ${npcName}的 50 級試煉</div>`;
    if (st === 0) {
        h += `${npcName}：你已是 50 級的強者，願意接受我的試煉嗎？</div><div class="p-4"><button class="btn bg-amber-800 py-2 px-4 font-bold" onclick="trial50Accept()">接取試煉任務</button></div>`;
        return h;
    }
    if (st >= 1 && st <= nStages) {
        let stage = cfg.stages[st-1], have = questCountId(stage.id), enough = have >= stage.cnt;
        h += `目前任務：交付 <b class="text-amber-300">${stage.nm}</b> × ${stage.cnt}（持有 ${have}/${stage.cnt}）<br><span class="text-slate-400 text-sm">取得方式：${stage.hint}</span></div>`;
        h += enough ? `<div class="p-4"><button class="btn bg-emerald-800 py-2 px-4 font-bold" onclick="trial50TurnIn()">交付 ${stage.nm}</button></div>` : `<div class="p-4 text-red-400">尚未備齊。</div>`;
        return h;
    }
    let have = questCountId(cfg.exMat);
    let crystals = questCountId('sherine_crystal');   // 🔮 含倉庫
    let anySherine = !player.classicMode && cfg.rewards.some(r => sherineSetEligible(DB.items[r.id]));   // 🔮 此試煉是否有可席琳兌換的成品（瑪那水晶球等盾類不支援）；🎮 經典模式隱藏席琳說明（兌換鈕已由 sherineExBtns 隱藏）
    h += `試煉已完成，魔族神殿已對你開放。<br>交付 1 個 <b class="text-red-300">${cfg.exMatNm}</b>（持有 ${have}）可重複換取：`;
    h += anySherine ? `<br><span class="text-slate-400 text-sm">🔮 <span class="c-sherine font-bold">席琳兌換</span>：每個額外消耗 1 個<b class="c-sherine">席琳結晶</b>（持有 ${crystals}），成品必定附帶一種隨機<span class="c-sherine">席琳套裝效果</span>。</span>` : ``;
    h += `</div>`;
    if (have < 1) return h + `<div class="px-4 pb-4 text-red-400 text-sm">需要 1 個 ${cfg.exMatNm} 才能兌換。</div>`;
    h += `<div class="p-4">${trialQtyBar()}<div class="grid grid-cols-1 gap-3">`;
    cfg.rewards.forEach(r => {
        // 🔮 僅「可附帶套裝效果」的成品（武器等）提供席琳兌換；瑪那水晶球(盾)等不符 → 只給一般兌換，避免白白消耗結晶
        if (sherineSetEligible(DB.items[r.id])) {
            h += sherineExBtns(r.nm, `trial50Exchange('${r.id}')`, `trial50Exchange('${r.id}', true)`);
        } else {
            h += `<button class="btn w-full bg-blue-800 py-3 text-base font-bold" onclick="trial50Exchange('${r.id}')">兌換：${r.nm}</button>`;
        }
    });
    return h + `</div></div>`;
}
function renderDigallatin(div) {
    let cfg = TRIAL_50_CFG[player.cls];
    if (!cfg || cfg.npc !== '迪嘉勒廷') { div.innerHTML = `<div class="p-6 text-red-400">迪嘉勒廷：這場試煉只屬於騎士、妖精、法師與王族。</div>`; return; }
    div.innerHTML = build50TrialHTML('迪嘉勒廷');
}
function trial50Accept() {
    let cfg = TRIAL_50_CFG[player.cls];
    if (!cfg) return;
    if ((player.lv||1) < 50) { logSys('等級不足 50，無法接取試煉。'); return; }
    if ((player.trialStage||0) !== 0) return;
    player.trialStage = 1; saveGame();
    logSys(`<span class="text-amber-300 font-bold">${cfg.npc}：試煉開始！去取得 ${cfg.stages[0].nm} 吧。</span>`);
    closeNpcInteraction();
}
// 🔥 精靈的私語：騎士「交付精靈的私語」階段完成後（trialStage>2，即已通過第二階段交付）
//   自動清除身上剩餘的精靈的私語（含載入舊存檔的補救、以及曾超收的情況）。回傳清除數量。
function purgeCompletedElfWhisper() {
    if (!player || player.cls !== 'knight' || (player.trialStage || 0) <= 2) return 0;
    let n = (player.inv || []).reduce((s, i) => s + (i.id === 'item_elf_whisper' ? (i.cnt || 0) : 0), 0);
    if (n > 0) player.inv = player.inv.filter(i => i.id !== 'item_elf_whisper');
    return n;
}
function trial50TurnIn() {
    let cfg = TRIAL_50_CFG[player.cls];
    if (!cfg) return;
    let st = player.trialStage || 0, nStages = cfg.stages.length;
    if (st < 1 || st > nStages) return;
    let stage = cfg.stages[st-1];
    if (questCountId(stage.id) < stage.cnt) { logSys('數量不足，無法交付。'); return; }
    questConsumeId(stage.id, stage.cnt);
    if (st < nStages) { player.trialStage = st + 1; logSys(`<span class="text-emerald-300 font-bold">${cfg.npc}：很好。接著去取得 ${cfg.stages[st].nm}。</span>`); }
    else { player.trialStage = nStages + 1; player.demonTempleOpen = true; logSys(`<span class="c-legend font-bold">${cfg.npc}：你通過了試煉！魔族神殿的大門已對你開啟。</span>`); }
    purgeCompletedElfWhisper();   // 🔥 交付精靈的私語階段完成 → 自動清除剩餘的精靈的私語
    saveGame(); closeNpcInteraction();
}
function trial50Exchange(rewardId, sherine) {   // 🔮 sherine=true：席琳兌換（每個額外 1 席琳結晶，成品必帶隨機套裝效果）
    let cfg = TRIAL_50_CFG[player.cls];
    if (!cfg || (player.trialStage||0) <= cfg.stages.length) return;
    if (!cfg.rewards.some(r => r.id === rewardId)) return;
    if (sherine && !sherineSetEligible(DB.items[rewardId])) sherine = false;   // 🔮 防呆：不可附套裝效果的成品(如盾)不消耗結晶
    let n = trialRun([cfg.exMat], rewardId, sherine);
    if (!n) return;   // trialRun 已提示材料不足
    saveGame();
    logSys(`<span class="text-amber-200">${cfg.npc}：交易成立，你獲得了 ${trialExName(n, rewardId)}。</span>`);
    closeNpcInteraction(); renderTabs();
}
// 🔮 希蓮恩（希培利亞村莊）：幻術士的試煉道具兌換 + 50 級試煉（時空裂痕碎片→魔族神殿、翼龍之血→藍寶石奇古獸）
const SHENIEN_EX = {
    ant:   { cost: [['item_ant_fruit',1],['item_ant_branch',1],['item_ant_bark',1]], rewards: ['wpn_illu_wand','mem_cube_burn'] },
    heart: { cost: [['item_elmore_heart',1]], rewards: ['shd_illu_book','mem_cube_shock'] },
    orb:   { cost: [['item_time_orb',1]], rewards: ['clk_illu'] },
    blood: { cost: [['item_wyvern_blood',5]], rewards: ['wpn_qigu_sapphire'], needTemple: true }
};
function _shenienCostHtml(type) {
    return SHENIEN_EX[type].cost.map(([id,cnt]) => `${DB.items[id].n}×${cnt}（持有 ${questCountId(id)}）`).join('、');
}
function _shenienEnough(type) { return SHENIEN_EX[type].cost.every(([id,cnt]) => questCountId(id) >= cnt); }
function renderShenien(div) {
    if (player.cls !== 'illusion') { div.innerHTML = `<div class="p-6 text-red-400">希蓮恩：這場試煉只屬於幻術士。</div>`; return; }
    let exBtns = (type) => SHENIEN_EX[type].rewards.map(rid => `<button class="btn bg-blue-800 hover:bg-blue-700 py-2 px-3 text-sm font-bold" onclick="shenienEx('${type}','${rid}')">兌換：${DB.items[rid].n}</button>`).join('');
    let h = `<div class="p-4 text-slate-300 leading-relaxed"><div class="text-amber-300 font-bold mb-3">🔮 希蓮恩的試煉與兌換</div>`;
    // 兌換 1：眠龍洞穴 — 污濁安特三件
    h += `<div class="mb-2 p-3 bg-slate-800/60 rounded border border-slate-700"><div class="text-emerald-300 font-bold text-sm">眠龍洞穴的試煉</div>
        <div class="text-xs text-slate-400 mb-2">交付 ${_shenienCostHtml('ant')}</div>${_shenienEnough('ant') ? `<div class="flex flex-wrap gap-2">${exBtns('ant')}</div>` : `<div class="text-red-400 text-xs">尚未備齊。</div>`}</div>`;
    // 兌換 2：艾爾摩將軍之心
    h += `<div class="mb-2 p-3 bg-slate-800/60 rounded border border-slate-700"><div class="text-rose-300 font-bold text-sm">艾爾摩將軍之心</div>
        <div class="text-xs text-slate-400 mb-2">交付 ${_shenienCostHtml('heart')}</div>${_shenienEnough('heart') ? `<div class="flex flex-wrap gap-2">${exBtns('heart')}</div>` : `<div class="text-red-400 text-xs">尚未備齊。</div>`}</div>`;
    // 兌換 3：火龍窟 — 完成的時間水晶球
    h += `<div class="mb-2 p-3 bg-slate-800/60 rounded border border-slate-700"><div class="text-sky-300 font-bold text-sm">火龍窟的試煉</div>
        <div class="text-xs text-slate-400 mb-2">交付 ${_shenienCostHtml('orb')}</div>${_shenienEnough('orb') ? `<div class="flex flex-wrap gap-2">${exBtns('orb')}</div>` : `<div class="text-red-400 text-xs">尚未備齊。</div>`}</div>`;
    // 50 級試煉
    h += `<div class="mt-3 p-3 bg-amber-950/40 rounded border border-amber-800/60"><div class="text-amber-300 font-bold">⚔️ 50 級試煉</div>`;
    if ((player.lv||1) < 50) {
        h += `<div class="text-red-400 text-sm mt-1">等級達到 50 才能參加此試煉。</div>`;
    } else if (!player.demonTempleOpen) {
        let shards = questCountId('mat_rift_shard');
        h += `<div class="text-sm text-slate-400 mt-1">第一階段：交付 <b class="text-cyan-300">時空裂痕碎片</b> ×100（持有 ${shards}）→ 解鎖 <b class="c-legend">魔族神殿</b></div>`;
        h += shards >= 100 ? `<div class="mt-2"><button class="btn bg-emerald-800 hover:bg-emerald-700 py-2 px-4 font-bold" onclick="shenienTrial1()">交付 時空裂痕碎片 ×100</button></div>` : `<div class="text-red-400 text-sm mt-1">尚未備齊。</div>`;
    } else {
        let blood = questCountId('item_wyvern_blood');
        h += `<div class="text-emerald-300 text-sm mt-1">試煉已完成，魔族神殿已對你開放。</div>
            <div class="text-sm text-slate-400 mt-1">第二階段：交付 <b class="text-red-300">翼龍之血</b> ×5（持有 ${blood}）可重複換取 藍寶石奇古獸</div>`;
        h += blood >= 5 ? `<div class="mt-2">${exBtns('blood')}</div>` : `<div class="text-red-400 text-sm mt-1">需要 5 個翼龍之血。</div>`;
    }
    h += `</div></div>`;
    div.innerHTML = h;
}
function shenienEx(type, rewardId) {
    if (player.cls !== 'illusion') return;
    let cfg = SHENIEN_EX[type];
    if (!cfg || !cfg.rewards.includes(rewardId)) return;   // 防作弊：reward 須屬於該兌換
    if (cfg.needTemple && !player.demonTempleOpen) { logSys('需先完成 50 級試煉第一階段。'); return; }
    if (!_shenienEnough(type)) { logSys('試煉道具不足。'); return; }
    cfg.cost.forEach(([id,cnt]) => questConsumeId(id, cnt));
    { let _sv = _tradLootCtx; _tradLootCtx = true; try { gainItem(rewardId, 1); } finally { _tradLootCtx = _sv; } }   // 🏛️ 傳統模式：幻術士兌換裝備自帶隨機強化值
    logSys(`<span class="text-amber-200">希蓮恩：交易成立，你獲得了 <b>${DB.items[rewardId].n}</b>。</span>`);
    saveGame(); renderTabs();
    let _c = document.getElementById('interaction-content'); if (_c) renderShenien(_c);
}
function shenienTrial1() {
    if (player.cls !== 'illusion' || (player.lv||1) < 50 || player.demonTempleOpen) return;
    if (questCountId('mat_rift_shard') < 100) { logSys('時空裂痕碎片不足 100。'); return; }
    questConsumeId('mat_rift_shard', 100);
    player.demonTempleOpen = true;
    logSys('<span class="c-legend font-bold">希蓮恩：你通過了試煉！魔族神殿的大門已對你開啟。</span>');
    saveGame(); renderTabs();
    let _c = document.getElementById('interaction-content'); if (_c) renderShenien(_c);
}
// ⚔️ 多文（海音）：戰士的試煉道具兌換 + 50 級試煉（神秘魔杖×5→魔族神殿、神秘慎重藥水→大匠的斧頭）
const WARRIOR_EX = {
    scroll: { cost: [['new_item_207',1]], rewards: ['wpn_warrior_trial_axe','bk_warrior_dualaxe'] },
    stolen: { cost: [['new_item_226',1],['new_item_225',1]], rewards: ['clk_warrior_corps','bk_warrior_roar'] },
    blood:  { cost: [['item_cyclops_blood',1]], rewards: ['hlm_warrior_corps'] },
    axe:    { cost: [['new_item_234',1]], rewards: ['wpn_master_axe'], needTemple: true }
};
function _duwenCostHtml(type) {
    return WARRIOR_EX[type].cost.map(([id,cnt]) => `${DB.items[id].n}×${cnt}（持有 ${questCountId(id)}）`).join('、');
}
function _duwenEnough(type) { return WARRIOR_EX[type].cost.every(([id,cnt]) => questCountId(id) >= cnt); }
function renderDuwen(div) {
    if (player.cls !== 'warrior') { div.innerHTML = `<div class="p-6 text-red-400">多文：這場試煉只屬於戰士。</div>`; return; }
    let exBtns = (type) => WARRIOR_EX[type].rewards.map(rid => {
        let _nm = DB.items[rid].n;
        let _n = `<button class="btn bg-blue-800 hover:bg-blue-700 py-2 px-3 text-sm font-bold" onclick="duwenEx('${type}','${rid}')">兌換：${_nm}</button>`;
        // 🔮 僅「可附帶套裝效果」的成品（武器/頭盔/斗篷…）提供席琳兌換；印記書等不符 → 只給一般兌換；🎮 經典模式隱藏
        let _s = (!player.classicMode && sherineSetEligible(DB.items[rid]))
            ? `<button class="btn bg-green-900 hover:bg-green-800 border-green-600 py-2 px-3 text-sm font-bold" onclick="duwenEx('${type}','${rid}',true)" title="額外消耗 1 個席琳結晶：成品必定附帶一種席琳套裝效果"><span class="c-sherine">席琳兌換</span>：${_nm}</button>`
            : '';
        return _n + _s;
    }).join('');
    let h = `<div class="p-4 text-slate-300 leading-relaxed"><div class="text-amber-300 font-bold mb-3">⚔️ 多文的試煉與兌換</div>`;
    if (!player.classicMode) h += `<div class="text-xs text-slate-400 mb-2">🔮 <span class="c-sherine font-bold">席琳兌換</span>：每件額外消耗 1 個 <b class="c-sherine">席琳結晶</b>（持有 ${questCountId('sherine_crystal')}），成品必定附帶一種隨機 <span class="c-sherine">席琳套裝效果</span>（僅限可附帶部位）。</div>`;
    h += `<div class="mb-2 p-3 bg-slate-800/60 rounded border border-slate-700"><div class="text-emerald-300 font-bold text-sm">生命的卷軸（二選一）</div>
        <div class="text-xs text-slate-400 mb-2">交付 ${_duwenCostHtml('scroll')}</div>${_duwenEnough('scroll') ? `<div class="flex flex-wrap gap-2">${exBtns('scroll')}</div>` : `<div class="text-red-400 text-xs">尚未備齊。</div>`}</div>`;
    h += `<div class="mb-2 p-3 bg-slate-800/60 rounded border border-slate-700"><div class="text-rose-300 font-bold text-sm">被偷的戒指 + 被偷的項鍊（二選一）</div>
        <div class="text-xs text-slate-400 mb-2">交付 ${_duwenCostHtml('stolen')}</div>${_duwenEnough('stolen') ? `<div class="flex flex-wrap gap-2">${exBtns('stolen')}</div>` : `<div class="text-red-400 text-xs">尚未備齊。</div>`}</div>`;
    h += `<div class="mb-2 p-3 bg-slate-800/60 rounded border border-slate-700"><div class="text-sky-300 font-bold text-sm">獨眼巨人的血</div>
        <div class="text-xs text-slate-400 mb-2">交付 ${_duwenCostHtml('blood')}</div>${_duwenEnough('blood') ? `<div class="flex flex-wrap gap-2">${exBtns('blood')}</div>` : `<div class="text-red-400 text-xs">尚未備齊。</div>`}</div>`;
    h += `<div class="mt-3 p-3 bg-amber-950/40 rounded border border-amber-800/60"><div class="text-amber-300 font-bold">⚔️ 50 級試煉</div>`;
    if ((player.lv||1) < 50) {
        h += `<div class="text-red-400 text-sm mt-1">等級達到 50 才能參加此試煉。</div>`;
    } else if (!player.demonTempleOpen) {
        let wands = questCountId('new_item_219');
        h += `<div class="text-sm text-slate-400 mt-1">第一階段：交付 <b class="text-cyan-300">神秘魔杖</b> ×5（持有 ${wands}）→ 解鎖 <b class="c-legend">魔族神殿</b></div>`;
        h += wands >= 5 ? `<div class="mt-2"><button class="btn bg-emerald-800 hover:bg-emerald-700 py-2 px-4 font-bold" onclick="duwenTrial1()">交付 神秘魔杖 ×5</button></div>` : `<div class="text-red-400 text-sm mt-1">尚未備齊。</div>`;
    } else {
        let pots = questCountId('new_item_234');
        h += `<div class="text-emerald-300 text-sm mt-1">試煉已完成，魔族神殿已對你開放。</div>
            <div class="text-sm text-slate-400 mt-1">第二階段：交付 <b class="text-red-300">神秘慎重藥水</b> ×1（持有 ${pots}）可重複換取 大匠的斧頭</div>`;
        h += pots >= 1 ? `<div class="mt-2">${exBtns('axe')}</div>` : `<div class="text-red-400 text-sm mt-1">需要 1 個神秘慎重藥水。</div>`;
    }
    h += `</div></div>`;
    div.innerHTML = h;
}
function duwenEx(type, rewardId, sherine) {   // 🔮 sherine=true：席琳兌換（額外消耗 1 席琳結晶，成品必帶套裝效果）
    if (player.cls !== 'warrior') return;
    let cfg = WARRIOR_EX[type];
    if (!cfg || !cfg.rewards.includes(rewardId)) return;   // 防作弊：reward 須屬於該兌換
    if (cfg.needTemple && !player.demonTempleOpen) { logSys('需先完成 50 級試煉第一階段。'); return; }
    if (!_duwenEnough(type)) { logSys('試煉道具不足。'); return; }
    if (sherine && (player.classicMode || !sherineSetEligible(DB.items[rewardId]))) sherine = false;   // 🎮 經典／不可附套裝部位 → 強制一般兌換（不浪費結晶）
    if (!sherineExCheck(sherine)) return;   // 🔮 席琳兌換：扣除試煉道具前先確認持有結晶
    cfg.cost.forEach(([id,cnt]) => questConsumeId(id, cnt));
    sherineExGain(rewardId, sherine);   // 🔮 扣 1 結晶(若 sherine)＋_forceSherineSet＋gainItem
    logSys(`<span class="text-amber-200">多文：交易成立，你獲得了 <b>${DB.items[rewardId].n}</b>${sherine ? '（<span class="c-sherine">席琳套裝</span>）' : ''}。</span>`);
    saveGame(); renderTabs();
    let _c = document.getElementById('interaction-content'); if (_c) renderDuwen(_c);
}
function duwenTrial1() {
    if (player.cls !== 'warrior' || (player.lv||1) < 50 || player.demonTempleOpen) return;
    if (questCountId('new_item_219') < 5) { logSys('神秘魔杖不足 5。'); return; }
    questConsumeId('new_item_219', 5);
    player.demonTempleOpen = true;
    logSys('<span class="c-legend font-bold">多文：你通過了試煉！魔族神殿的大門已對你開啟。</span>');
    saveGame(); renderTabs();
    let _c = document.getElementById('interaction-content'); if (_c) renderDuwen(_c);
}
// 🐉 普洛凱爾（貝希摩斯）：龍騎士的試煉道具兌換 + 50 級試煉（時空裂痕碎片→魔族神殿、靈魂之火灰燼→消滅者鎖鏈劍）
const PROCEL_EX = {
    search: { cost: [['item_demon_search',3]], rewards: ['wpn_dragon_2h','bk_dragon_armor'] },
    spy:    { cost: [['item_demon_spy',1]],    rewards: ['armguard_dragonscale','bk_dragon_bloodlust'] },
    yeti:   { cost: [['item_yeti_heart',10]],  rewards: ['clk_dragon'] },
    ash:    { cost: [['item_soulfire_ash',1]], rewards: ['wpn_chain_annihilator'], needTemple: true }
};
function _procelCostHtml(type) { return PROCEL_EX[type].cost.map(([id,cnt]) => `${DB.items[id].n}×${cnt}（持有 ${questCountId(id)}）`).join('、'); }
function _procelEnough(type) { return PROCEL_EX[type].cost.every(([id,cnt]) => questCountId(id) >= cnt); }
function renderProcel(div) {
    if (player.cls !== 'dragon') { div.innerHTML = `<div class="p-6 text-red-400">普洛凱爾：這場試煉只屬於龍騎士。</div>`; return; }
    let exBtns = (type) => PROCEL_EX[type].rewards.map(rid => `<button class="btn bg-amber-800 hover:bg-amber-700 py-2 px-3 text-sm font-bold" onclick="procelEx('${type}','${rid}')">兌換：${DB.items[rid].n}</button>`).join('');
    let h = `<div class="p-4 text-slate-300 leading-relaxed"><div class="text-amber-300 font-bold mb-3">🐉 普洛凱爾的試煉與兌換</div>`;
    h += `<div class="mb-2 p-3 bg-slate-800/60 rounded border border-slate-700"><div class="text-emerald-300 font-bold text-sm">妖魔搜索文件</div>
        <div class="text-xs text-slate-400 mb-2">交付 ${_procelCostHtml('search')}（無次數限制）</div>${_procelEnough('search') ? `<div class="flex flex-wrap gap-2">${exBtns('search')}</div>` : `<div class="text-red-400 text-xs">尚未備齊。</div>`}</div>`;
    h += `<div class="mb-2 p-3 bg-slate-800/60 rounded border border-slate-700"><div class="text-rose-300 font-bold text-sm">妖魔密使首領間諜書</div>
        <div class="text-xs text-slate-400 mb-2">交付 ${_procelCostHtml('spy')}（無次數限制）</div>${_procelEnough('spy') ? `<div class="flex flex-wrap gap-2">${exBtns('spy')}</div>` : `<div class="text-red-400 text-xs">尚未備齊。</div>`}</div>`;
    h += `<div class="mb-2 p-3 bg-slate-800/60 rounded border border-slate-700"><div class="text-sky-300 font-bold text-sm">雪怪之心</div>
        <div class="text-xs text-slate-400 mb-2">交付 ${_procelCostHtml('yeti')}（無次數限制）</div>${_procelEnough('yeti') ? `<div class="flex flex-wrap gap-2">${exBtns('yeti')}</div>` : `<div class="text-red-400 text-xs">尚未備齊。</div>`}</div>`;
    h += `<div class="mt-3 p-3 bg-amber-950/40 rounded border border-amber-800/60"><div class="text-amber-300 font-bold">⚔️ 50 級試煉</div>`;
    if ((player.lv||1) < 50) {
        h += `<div class="text-red-400 text-sm mt-1">龍騎士等級達到 50 才能向普洛凱爾接取此試煉。</div>`;
    } else if (!player.demonTempleOpen) {
        let shards = questCountId('mat_rift_shard');
        h += `<div class="text-sm text-slate-400 mt-1">第一階段：交付 <b class="text-cyan-300">時空裂痕碎片</b> ×100（持有 ${shards}）→ 解鎖 <b class="c-legend">魔族神殿</b></div>`;
        h += shards >= 100 ? `<div class="mt-2"><button class="btn bg-emerald-800 hover:bg-emerald-700 py-2 px-4 font-bold" onclick="procelTrial1()">交付 時空裂痕碎片 ×100</button></div>` : `<div class="text-red-400 text-sm mt-1">尚未備齊。</div>`;
    } else {
        let ash = questCountId('item_soulfire_ash');
        h += `<div class="text-emerald-300 text-sm mt-1">試煉已完成，魔族神殿已對你開放。</div>
            <div class="text-sm text-slate-400 mt-1">第二階段：交付 <b class="text-orange-300">靈魂之火灰燼</b> ×1（持有 ${ash}）可重複換取 消滅者鎖鏈劍</div>`;
        h += ash >= 1 ? `<div class="mt-2">${exBtns('ash')}</div>` : `<div class="text-red-400 text-sm mt-1">需要 1 個靈魂之火灰燼。</div>`;
    }
    h += `</div></div>`;
    div.innerHTML = h;
}
function procelEx(type, rewardId) {
    if (player.cls !== 'dragon') return;
    let cfg = PROCEL_EX[type];
    if (!cfg || !cfg.rewards.includes(rewardId)) return;   // 防作弊：reward 須屬於該兌換
    if (cfg.needTemple && !player.demonTempleOpen) { logSys('需先完成 50 級試煉第一階段。'); return; }
    if (!_procelEnough(type)) { logSys('試煉道具不足。'); return; }
    cfg.cost.forEach(([id,cnt]) => questConsumeId(id, cnt));
    { let _sv = _tradLootCtx; _tradLootCtx = true; try { gainItem(rewardId, 1); } finally { _tradLootCtx = _sv; } }   // 🏛️ 傳統模式：龍騎士兌換裝備自帶隨機強化值
    logSys(`<span class="text-amber-200">普洛凱爾：交易成立，你獲得了 <b>${DB.items[rewardId].n}</b>。</span>`);
    saveGame(); renderTabs();
    let _c = document.getElementById('interaction-content'); if (_c) renderProcel(_c);
}
function procelTrial1() {
    if (player.cls !== 'dragon' || (player.lv||1) < 50 || player.demonTempleOpen) return;
    if (questCountId('mat_rift_shard') < 100) { logSys('時空裂痕碎片不足 100。'); return; }
    questConsumeId('mat_rift_shard', 100);
    player.demonTempleOpen = true;
    logSys('<span class="c-legend font-bold">普洛凱爾：你通過了試煉！魔族神殿的大門已對你開啟。</span>');
    saveGame(); renderTabs();
    let _c = document.getElementById('interaction-content'); if (_c) renderProcel(_c);
}
function renderOsQuest(div) {
    if (player.cls !== 'elf') {
        div.innerHTML = `<div class="p-6 text-red-400">歐斯：我有點事想找妖精幫忙，不相關者請離開。</div>`;
        return;
    }

    let reqIds = ['new_item_199', 'new_item_200', 'new_item_201', 'new_item_202'];
    let hasAll = reqIds.every(id => questCountId(id) >= 1);

    let html = `<div class="p-4 text-slate-300">
        歐斯：收集四大妖魔魔法書（都達瑪拉、那魯加、甘地、阿吐巴）各一本，即可換取精靈專屬頭盔。<br><br>
        目前收集：${hasAll ? '<span class="text-green-400 font-bold">已收集完成！</span>' : '<span class="text-red-400">材料不足</span>'}
    </div>`;

    if (hasAll) {
        html += `<div class="grid grid-cols-1 gap-3 p-4">
            ${trialQtyBar()}
            ${sherineExBtns('精靈敏捷頭盔', "doOsExchange('arm_50')", "doOsExchange('arm_50', true)")}
            ${sherineExBtns('精靈體質頭盔', "doOsExchange('arm_51')", "doOsExchange('arm_51', true)")}
        </div>`;
    }
    div.innerHTML = html;
}
function renderTarasQuest(div) {
    if (player.cls !== 'mage') {
        div.innerHTML = `<div class="p-6 text-red-400">塔拉斯：這是不死族與魔法的試煉，只有法師能夠參與。</div>`;
        return;
    }

    // 水晶試煉：不死族的鑰匙 + 不死族的骨頭 → 水晶魔杖
    let crystalReq = ['new_item_214', 'new_item_212'];
    let hasCrystal = crystalReq.every(id => questCountId(id) >= 1);   // 🔧 含倉庫
    // 瑪那試煉：變形怪的血 → 瑪那魔杖 或 瑪那斗篷
    let manaReq = ['new_item_240'];
    let hasMana = manaReq.every(id => questCountId(id) >= 1);   // 🔧 含倉庫

    let html = `<div class="p-4 text-slate-300">塔拉斯：年輕的法師啊，你想挑戰哪一項試煉？</div>`;
    if (hasCrystal || hasMana) html += `<div class="px-4">${trialQtyBar()}</div>`;

    // ===== 水晶試煉 =====
    html += `<div class="p-4 border-t border-slate-700">
        <div class="text-cyan-300 font-bold text-lg mb-2">水晶試煉</div>
        <div class="text-slate-300 text-sm mb-3">帶來<b>不死族的鑰匙</b>與<b>不死族的骨頭</b>各一個，換取蘊含魔力的水晶魔杖。<br>
        目前收集：${hasCrystal ? '<span class="text-green-400 font-bold">已收集完成！</span>' : '<span class="text-red-400">材料不足</span>'}</div>`;
    if (hasCrystal) {
        html += sherineExBtns('水晶魔杖', "doTarasExchange('wpn_crystalwand')", "doTarasExchange('wpn_crystalwand', true)");
    }
    html += `</div>`;

    // ===== 瑪那試煉 =====
    html += `<div class="p-4 border-t border-slate-700">
        <div class="text-purple-300 font-bold text-lg mb-2">瑪那試煉</div>
        <div class="text-slate-300 text-sm mb-3">帶來<b>變形怪的血</b>一個，選擇換取瑪那魔杖或瑪那斗篷。<br>
        目前收集：${hasMana ? '<span class="text-green-400 font-bold">已收集完成！</span>' : '<span class="text-red-400">材料不足</span>'}</div>`;
    if (hasMana) {
        html += `<div class="grid grid-cols-1 gap-3">
            ${sherineExBtns('瑪那魔杖', "doTarasManaExchange('wpn_manawand')", "doTarasManaExchange('wpn_manawand', true)")}
            ${sherineExBtns('瑪那斗篷', "doTarasManaExchange('arm_89')", "doTarasManaExchange('arm_89', true)")}
        </div>`;
    }
    html += `</div>`;

    div.innerHTML = html;
}
function renderGunterQuest(div) {
    if (player.cls !== 'knight' && player.cls !== 'royal') {
        div.innerHTML = `<div class="p-6 text-red-400">甘特：這是屬於騎士與王族的試煉，你沒有資格參與。</div>`;
        return;
    }
    // 👑 王族試煉：王族搜索狀→紅色斗篷/魔法書(精準目標)；村民的遺物→君主的威嚴/魔法書(呼喚盟友)（無次數限制）
    if (player.cls === 'royal') {
        let searchId = 'new_item_241', relicId = 'new_item_211';
        let hasSearch = questCountId(searchId) >= 1, hasRelic = questCountId(relicId) >= 1;
        let rHtml = `<div class="p-4 text-slate-300">甘特：王族的威嚴需要實力證明。交出<b>王族搜索狀</b>，我給你紅色斗篷或魔法書(精準目標)；交出<b>村民的遺物</b>，我給你君主的威嚴或魔法書(呼喚盟友)。<br><br>
            王族搜索狀：${hasSearch ? '<span class="text-green-400 font-bold">已持有</span>' : '<span class="text-red-400">未持有</span>'}<br>
            村民的遺物：${hasRelic ? '<span class="text-green-400 font-bold">已持有</span>' : '<span class="text-red-400">未持有</span>'}</div>`;
        let rAct = '';
        if (hasSearch) {
            // 🔮 紅色斗篷=斗篷(可附套裝)→席琳兌換；魔法書(精準目標)=技能書(不可附)→只給一般兌換
            rAct += `<div class="text-amber-300 font-bold mb-1 mt-2">交出 王族搜索狀 ×1：</div>
                <div class="mb-1">${sherineExBtns('紅色斗篷', `doGunterRoyalExchange('${searchId}', 'clk_royal_red')`, `doGunterRoyalExchange('${searchId}', 'clk_royal_red', true)`)}</div>
                <button class="btn w-full bg-blue-800 py-2 text-base font-bold" onclick="doGunterRoyalExchange('${searchId}', 'bk_royal_precise')">兌換：魔法書(精準目標)</button>`;
        }
        if (hasRelic) {
            // 🔮 君主的威嚴=斗篷(可附套裝)→席琳兌換；魔法書(呼喚盟友)=技能書(不可附)→只給一般兌換
            rAct += `<div class="text-amber-300 font-bold mb-1 mt-3">交出 村民的遺物 ×1：</div>
                <div class="mb-1">${sherineExBtns('君主的威嚴', `doGunterRoyalExchange('${relicId}', 'clk_royal_majesty')`, `doGunterRoyalExchange('${relicId}', 'clk_royal_majesty', true)`)}</div>
                <button class="btn w-full bg-blue-800 py-2 text-base font-bold" onclick="doGunterRoyalExchange('${relicId}', 'bk_royal_callally')">兌換：魔法書(呼喚盟友)</button>`;
        }
        if (rAct && !player.classicMode) rHtml += `<div class="px-4 text-xs text-slate-400">🔮 <span class="c-sherine font-bold">席琳兌換</span>：每件額外消耗 1 個 <b class="c-sherine">席琳結晶</b>（持有 ${questCountId('sherine_crystal')}），成品必定附帶一種隨機 <span class="c-sherine">席琳套裝效果</span>。</div>`;
        if (rAct) rHtml += `<div class="p-4">${trialQtyBar()}${rAct}</div>`;
        div.innerHTML = rHtml;
        return;
    }

    // 👇 若你的資料庫 ID 不同，請修改這裡的字串
    let clawId = 'new_item_144';   // 夏洛伯之爪 ID
    let scaleId = 'new_item_208';  // 蛇女之鱗 ID
    
    let hasClaw = questCountId(clawId) >= 1;    // 🔧 含倉庫
    let hasScale = questCountId(scaleId) >= 1;  // 🔧 含倉庫

    let html = `<div class="p-4 text-slate-300">
        甘特：騎士的榮耀需要用實力來證明。帶來<b>夏洛伯之爪</b>，我將賜予你紅騎士之劍；帶來<b>蛇女之鱗</b>，你將獲得紅騎士盾牌。<br><br>
        目前狀態：<br>
        夏洛伯之爪：${hasClaw ? '<span class="text-green-400 font-bold">已收集</span>' : '<span class="text-red-400">未收集</span>'}<br>
        蛇女之鱗：${hasScale ? '<span class="text-green-400 font-bold">已收集</span>' : '<span class="text-red-400">未收集</span>'}
    </div>`;

    let actions = '';
    
    // 👇 兌換紅騎士之劍 ('wpn_red_knight')
    if (hasClaw) {
        actions += `<div class="mb-3">${sherineExBtns('紅騎士之劍', `doGunterExchange('${clawId}', 'wpn_redknight')`, `doGunterExchange('${clawId}', 'wpn_redknight', true)`)}</div>`;
    }
    
    // 👇 兌換紅騎士盾牌 ('shd_red_knight')
    if (hasScale) {
        actions += `<button class="btn w-full bg-blue-800 py-3 text-lg font-bold" onclick="doGunterExchange('${scaleId}', 'shd_redknight')">兌換：紅騎士盾牌</button>`;
    }

    if (actions) {
        html += `<div class="p-4">${trialQtyBar()}${actions}</div>`;
    }
    div.innerHTML = html;
}
function renderMotherQuest(div) {
    if (player.cls !== 'elf') {
        div.innerHTML = `<div class="p-6 text-red-400">迷幻森林之母：我的孩子，只有精靈的血脈才能聆聽我的呼喚。</div>`;
        return;
    }

    // 👇 若你的資料庫 ID 不同，請修改這裡的字串
    let bookId = 'new_item_213';   // 受詛咒的精靈書 ID
    
    let hasBook = questCountId(bookId) >= 1;   // 🔧 含倉庫

    let html = `<div class="p-4 text-slate-300">
        迷幻森林之母：年輕的妖精啊，若你能帶來<b>受詛咒的精靈書</b>，我將為你淨化它，並賜予你精靈的力量或防護。<br><br>
        目前狀態：<br>
        受詛咒的精靈書：${hasBook ? '<span class="text-green-400 font-bold">已收集</span>' : '<span class="text-red-400">未收集</span>'}
    </div>`;

    if (hasBook) {
        // 👇 兌換的物品 ID 若有不同，請修改括號內的字串
        html += `<div class="grid grid-cols-1 gap-3 p-4">
            ${trialQtyBar()}
            <button class="btn bg-blue-800 py-3 text-lg font-bold" onclick="doMotherExchange('${bookId}', 'bk_elf_summon')">兌換：精靈水晶(召喚屬性精靈)</button>
            <button class="btn bg-blue-800 py-3 text-lg font-bold" onclick="doMotherExchange('${bookId}', 'arm_85')">兌換：精靈T恤</button>
        </div>`;
    }
    
    div.innerHTML = html;
}

function doMotherExchange(reqId, rewardId) {
    let n = trialRun([reqId], rewardId, false);
    if (!n) return;
    saveGame();   // 兌換取得物品後立即存檔
    logSys(`迷幻森林之母：願精靈的祝福伴隨著你！獲得了 ${trialExName(n, rewardId)}。`);
    closeNpcInteraction();
    renderTabs();
}

function doGunterExchange(reqId, rewardId, sherine) {   // 🔮 sherine=true：席琳兌換（每個額外 1 席琳結晶，必帶套裝效果）
    let n = trialRun([reqId], rewardId, sherine);
    if (!n) return;
    saveGame();   // 兌換取得物品後立即存檔
    logSys(`甘特：你證明了你的實力！獲得了 ${trialExName(n, rewardId)}。`);
    closeNpcInteraction();
    renderTabs();
}
function doGunterRoyalExchange(reqId, rewardId, sherine) {   // 👑 王族兌換（消耗 王族搜索狀／村民的遺物）；🔮 sherine=true：席琳兌換
    if (player.cls !== 'royal') return;
    if (sherine && (player.classicMode || !sherineSetEligible(DB.items[rewardId]))) sherine = false;   // 🎮 經典／不可附套裝部位 → 強制一般兌換（不浪費結晶）
    let n = trialRun([reqId], rewardId, sherine);
    if (!n) return;
    saveGame();
    logSys(`甘特：你展現了王族的威嚴！獲得了 ${trialExName(n, rewardId)}。`);
    closeNpcInteraction();
    renderTabs();
}

function doTarasExchange(rewardId, sherine) {   // 🔮 sherine=true：席琳兌換（每個額外 1 席琳結晶，必帶套裝效果）
    let n = trialRun(['new_item_214', 'new_item_212'], rewardId, sherine);
    if (!n) return;
    saveGame();   // 兌換取得物品後立即存檔
    logSys(`塔拉斯：試煉通過！你獲得了 ${trialExName(n, rewardId)}。`);
    closeNpcInteraction();
    renderTabs();
}

function doTarasManaExchange(rewardId, sherine) {   // 🔮 sherine=true：席琳兌換（每個額外 1 席琳結晶，必帶套裝效果）
    let n = trialRun(['new_item_240'], rewardId, sherine);   // 瑪那試煉：變形怪的血 → 瑪那魔杖 或 瑪那斗篷
    if (!n) return;
    saveGame();   // 兌換取得物品後立即存檔
    logSys(`塔拉斯：試煉通過！你獲得了 ${trialExName(n, rewardId)}。`);
    closeNpcInteraction();
    renderTabs();
}

// ===== 威頓村 馬沙的試煉（妖精限定）：藍色長笛 + 古代鑰匙 → 保護者手套 或 精靈水晶(召喚強力屬性精靈)，無次數限制 =====
function renderMashaQuest(div) {
    // 法師等其他職業：沒有試煉
    if (player.cls !== 'elf' && player.cls !== 'knight' && player.cls !== 'royal') {
        div.innerHTML = `<div class="p-6 text-red-400">馬沙：這裡的試煉只開放給妖精、騎士與王族，恐怕沒有適合你的試煉。</div>`;
        return;
    }
    // 👑 王族的試煉：失去光明的靈魂 → 守護者的戒指（無次數限制）
    if (player.cls === 'royal') {
        let rHas = questCountId('item_lost_soul') >= 1;
        let rHtml = `<div class="p-4 text-slate-300">馬沙：高貴的王族啊，帶來<b>失去光明的靈魂</b>，我便將守護者的戒指交予你。</div>`;
        rHtml += `<div class="p-4 border-t border-slate-700">
            <div class="text-amber-300 font-bold text-lg mb-2">王族的試煉</div>
            <div class="text-slate-300 text-sm mb-3">所需材料：<b>失去光明的靈魂</b> ×1<br>
            目前收集：${rHas ? '<span class="text-green-400 font-bold">已收集完成！</span>' : '<span class="text-red-400">材料不足</span>'}</div>`;
        if (rHas) {
            rHtml += `${trialQtyBar()}<button class="btn w-full bg-blue-800 py-3 text-lg font-bold mt-2" onclick="doMashaRoyalExchange('acc_royal_guard')">兌換：守護者的戒指</button>`;
        }
        rHtml += `</div>`;
        div.innerHTML = rHtml;
        return;
    }
    // 騎士的試煉：夜之視野 + 古代鑰匙 → 勇敢皮帶
    if (player.cls === 'knight') {
        let kReq = ['item_nightvision', 'item_ancientkey'];
        let kHas = kReq.every(id => questCountId(id) >= 1);   // 🔧 含倉庫
        let kHtml = `<div class="p-4 text-slate-300">馬沙：勇敢的騎士啊，帶來<b>夜之視野</b>與<b>古代鑰匙</b>各一個，我便將勇敢皮帶交予你。</div>`;
        kHtml += `<div class="p-4 border-t border-slate-700">
            <div class="text-orange-300 font-bold text-lg mb-2">騎士的試煉</div>
            <div class="text-slate-300 text-sm mb-3">所需材料：<b>夜之視野</b> ×1、<b>古代鑰匙</b> ×1<br>
            目前收集：${kHas ? '<span class="text-green-400 font-bold">已收集完成！</span>' : '<span class="text-red-400">材料不足</span>'}</div>`;
        if (kHas) {
            kHtml += trialQtyBar() + sherineExBtns('勇敢皮帶', "doMashaKnightExchange('acc_134')", "doMashaKnightExchange('acc_134', true)");
        }
        kHtml += `</div>`;
        div.innerHTML = kHtml;
        return;
    }
    // 以下為妖精的試煉
    let reqIds = ['item_blueflute', 'item_ancientkey'];
    let has = reqIds.every(id => questCountId(id) >= 1);

    let html = `<div class="p-4 text-slate-300">馬沙：帶來<b>藍色長笛</b>與<b>古代鑰匙</b>各一個，我可以為你交換以下其中一項。</div>`;
    html += `<div class="p-4 border-t border-slate-700">
        <div class="text-green-300 font-bold text-lg mb-2">妖精的試煉</div>
        <div class="text-slate-300 text-sm mb-3">所需材料：<b>藍色長笛</b> ×1、<b>古代鑰匙</b> ×1<br>
        目前收集：${has ? '<span class="text-green-400 font-bold">已收集完成！</span>' : '<span class="text-red-400">材料不足</span>'}</div>`;
    if (has) {
        html += `<div class="grid grid-cols-1 gap-3">
            ${trialQtyBar()}
            ${sherineExBtns('保護者手套', "doMashaExchange('arm_102')", "doMashaExchange('arm_102', true)")}
            <button class="btn bg-blue-800 py-3 text-lg font-bold" onclick="doMashaExchange('bk_elf_summon2')">兌換：精靈水晶(召喚強力屬性精靈)</button>
        </div>`;
    }
    html += `</div>`;
    div.innerHTML = html;
}

function doMashaExchange(rewardId, sherine) {   // 🔮 sherine=true：席琳兌換（每個額外 1 席琳結晶，必帶套裝效果）
    if (player.cls !== 'elf') return;
    let n = trialRun(['item_blueflute', 'item_ancientkey'], rewardId, sherine);
    if (!n) return;
    saveGame();   // 兌換取得物品後立即存檔
    logSys(`馬沙：試煉通過！你獲得了 ${trialExName(n, rewardId)}。`);
    closeNpcInteraction();
    renderTabs();
}
function doMashaRoyalExchange(rewardId, sherine) {   // 👑 王族兌換（消耗 失去光明的靈魂）
    if (player.cls !== 'royal') return;
    let n = trialRun(['item_lost_soul'], rewardId, sherine);
    if (!n) return;
    saveGame();
    logSys(`馬沙：你已證明王族的力量。獲得了 ${trialExName(n, rewardId)}。`);
    closeNpcInteraction();
    renderTabs();
}

function doMashaKnightExchange(rewardId, sherine) {   // 🔮 sherine=true：席琳兌換（每個額外 1 席琳結晶，必帶套裝效果）
    if (player.cls !== 'knight') return;
    let n = trialRun(['item_nightvision', 'item_ancientkey'], rewardId, sherine);
    if (!n) return;
    saveGame();   // 兌換取得物品後立即存檔
    logSys(`馬沙：試煉通過！你獲得了 ${trialExName(n, rewardId)}。`);
    closeNpcInteraction();
    renderTabs();
}

function doOsExchange(rewardId, sherine) {   // 🔮 sherine=true：席琳兌換（每個額外 1 席琳結晶，必帶套裝效果）
    let n = trialRun(['new_item_199', 'new_item_200', 'new_item_201', 'new_item_202'], rewardId, sherine);
    if (!n) return;
    saveGame();   // 兌換取得物品後立即存檔
    logSys(`歐斯：試煉通過！你獲得了 ${trialExName(n, rewardId)}。`);
    closeNpcInteraction();
    renderTabs();
}

// 🔧 已刪除舊版 renderTownShop（死碼）：原本與後方新版（含 npcId 參數、攻城 8 折）重複定義，
// 靠「後者覆蓋前者」碰巧運作，且內部引用了未宣告的 learned 變數，一旦被呼叫會直接 ReferenceError。
