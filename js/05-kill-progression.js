let _audit = { start: Date.now(), gold0: 0, exp: 0, kills: 0, scrollWpn: 0, scrollArm: 0, watch: [], watchCnt: {} };
let _auditView = 'stats';   // 'stats' = 本圖效率統計；'drops' = 本圖掉落物品
const AUDIT_WATCH_KEY = 'lineage_idle_audit_watch';
function saveAuditWatch() { try { localStorage.setItem(AUDIT_WATCH_KEY, JSON.stringify(_audit.watch)); } catch(e) {} }
(function loadAuditWatch() {   // 自訂掉落追蹤清單跨重開保留（只存名稱；計數仍每段觀測重置）
    try {
        let arr = JSON.parse(localStorage.getItem(AUDIT_WATCH_KEY));
        if (Array.isArray(arr)) { _audit.watch = arr.filter(x => typeof x === 'string'); _audit.watch.forEach(t => { _audit.watchCnt[t] = 0; }); }
    } catch(e) {}
})();
function auditReset() {
    _audit.start = Date.now();
    _audit.gold0 = (typeof player !== 'undefined' && player) ? (player.gold || 0) : 0;
    _audit.exp = 0; _audit.kills = 0; _audit.scrollWpn = 0; _audit.scrollArm = 0;
    _audit.watch.forEach(t => _audit.watchCnt[t] = 0);
    renderAuditTab();
}
function auditTrackKill(mob) {
    if (!mob || typeof getExpGainMult !== 'function') return;
    let g = Math.floor((mob.exp || 0) * getExpGainMult(player.lv));
    if (g > 0) _audit.exp += g;
    _audit.kills++;
}
function auditTrackGain(res) {
    if (!res || !res.id || typeof DB === 'undefined' || !DB.items[res.id]) return;
    let nm = DB.items[res.id].n || '';
    let amt = Number(res.cnt) || 1;
    if (nm.includes('武器施法的卷軸')) _audit.scrollWpn += amt;   // 一般＋祝福的對武器施法卷軸
    else if (nm.includes('盔甲施法的卷軸')) _audit.scrollArm += amt;   // 一般＋祝福的對盔甲施法卷軸
    let lo = nm.toLowerCase();
    _audit.watch.forEach(t => { if (lo.includes(t.toLowerCase())) _audit.watchCnt[t] = (_audit.watchCnt[t] || 0) + amt; });
}
function auditAddTarget(name) {
    name = (name || '').trim(); if (!name) return;
    if (!_audit.watch.includes(name)) { _audit.watch.push(name); if (_audit.watchCnt[name] === undefined) _audit.watchCnt[name] = 0; saveAuditWatch(); }
    renderAuditTab();
}
function auditRemoveIdx(i) {
    let t = _audit.watch[i];
    if (t !== undefined) { _audit.watch.splice(i, 1); delete _audit.watchCnt[t]; saveAuditWatch(); }
    renderAuditTab();
}
function auditAddFromInput() {
    let inp = document.getElementById('audit-add-input');
    if (inp && inp.value.trim()) auditAddTarget(inp.value.trim());
}
function renderAuditTab() {
    let el = document.getElementById('tab-audit');
    if (!el || el.classList.contains('hidden')) return;
    if (_auditView === 'drops') { renderAuditDrops(el); return; }   // 🔧 本圖掉落物品檢視
    let inp = document.getElementById('audit-add-input');
    if (inp && document.activeElement === inp) return;   // 使用者正在輸入 → 跳過此次重繪
    let _val = inp ? inp.value : '';
    let mins = (Date.now() - _audit.start) / 60000;
    let gold = (typeof player !== 'undefined' && player) ? ((player.gold || 0) - _audit.gold0) : 0;
    let sf = 10 / (mins || 0.001);
    let exp10 = Math.floor(_audit.exp * sf), gold10 = Math.floor(gold * sf);
    let watchHtml = _audit.watch.length ? _audit.watch.map((t, i) => {
        let c = _audit.watchCnt[t] || 0;
        return `<div class="flex justify-between items-center bg-slate-800/60 rounded px-2 py-1"><span>🎯 ${t}：<b class="${c>0?'text-green-400':'text-slate-300'}">${c}</b> 個</span><button onclick="auditRemoveIdx(${i})" class="btn px-2 py-0.5 text-xs bg-red-900 border-red-700 text-red-200">移除</button></div>`;
    }).join('') : '<div class="text-slate-500 text-sm">尚無追蹤目標，於下方輸入物品名稱（模糊比對）新增。</div>';
    el.innerHTML = `
    <div class="flex flex-col gap-3 text-sm">
        <div class="flex items-center justify-between">
            <span class="text-purple-300 font-bold text-base">本圖效率統計</span>
            <div class="flex items-center gap-2">
                <button onclick="toggleAuditView()" class="btn px-3 py-1 text-xs bg-indigo-900 border-indigo-600 text-indigo-200 font-bold">掉落物</button>
                <button onclick="auditReset()" class="btn px-3 py-1 text-xs bg-slate-700 border-slate-500 text-slate-200">重置</button>
            </div>
        </div>
        <div class="text-slate-400 text-xs">已觀測 ${mins.toFixed(2)} 分鐘・擊殺 ${_audit.kills.toLocaleString()}（換地圖會自動重置）</div>
        <div class="grid grid-cols-2 gap-2">
            <div class="bg-slate-800/60 rounded p-2"><div class="text-slate-400 text-xs">累積經驗</div><div class="text-yellow-300 font-bold text-base">${_audit.exp.toLocaleString()}</div></div>
            <div class="bg-slate-800/60 rounded p-2"><div class="text-slate-400 text-xs">純金幣淨增</div><div class="text-yellow-400 font-bold text-base">${gold.toLocaleString()}</div></div>
            <div class="bg-slate-800/60 rounded p-2"><div class="text-slate-400 text-xs">經驗 / 10分</div><div class="text-amber-300 font-bold text-base">${exp10.toLocaleString()}</div></div>
            <div class="bg-slate-800/60 rounded p-2"><div class="text-slate-400 text-xs">金幣 / 10分</div><div class="text-green-300 font-bold text-base">${gold10.toLocaleString()}</div></div>
        </div>
        <div class="border-t border-slate-700 pt-2">
            <div class="text-amber-300 font-bold mb-1">強化卷軸掉落</div>
            <div class="flex justify-between"><span>⚔️ 對武器施法的卷軸</span><b class="text-rose-300">${_audit.scrollWpn}</b></div>
            <div class="flex justify-between"><span>🛡️ 對盔甲施法的卷軸</span><b class="text-blue-300">${_audit.scrollArm}</b></div>
        </div>
        <div class="border-t border-slate-700 pt-2">
            <div class="text-cyan-300 font-bold mb-1">自訂掉落追蹤</div>
            <div class="flex flex-col gap-1 mb-2">${watchHtml}</div>
            <div class="flex items-center gap-2">
                <input id="audit-add-input" type="text" placeholder="輸入物品名稱（如：相消）" class="flex-1 bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-sm" value="${_val.replace(/"/g,'&quot;')}">
                <button onclick="auditAddFromInput()" class="btn px-3 py-1 text-sm bg-cyan-900 border-cyan-700 text-cyan-200 font-bold">新增</button>
            </div>
        </div>
    </div>`;
}
// 🔧 統計分頁：本圖效率統計 ⇄ 本圖掉落物品 切換
function toggleAuditView() { _auditView = (_auditView === 'stats') ? 'drops' : 'stats'; try { renderAuditTab(); } catch(e) {} }
// 彙整某怪物的掉落物 ID（合併一般/黑暗武器/黑暗水晶三表，去重；不顯示機率）
function _auditMobDrops(mobName) {
    let ids = [];
    let push = (tbl) => { if (tbl && tbl[mobName]) tbl[mobName].forEach(e => { let id = Array.isArray(e) ? e[0] : e; if (id && DB.items[id] && ids.indexOf(id) === -1 && !trialDropBlocked(id)) ids.push(id); }); };   // 🔒 非本職試煉兌換道具不顯示
    if (typeof MOB_DROPS !== 'undefined') push(MOB_DROPS);
    if (typeof DARK_WEAPON_DROPS !== 'undefined') push(DARK_WEAPON_DROPS);
    if (typeof DARK_CRYSTAL_DROPS !== 'undefined') push(DARK_CRYSTAL_DROPS);
    if (typeof DRAGON_DROPS !== 'undefined') push(DRAGON_DROPS);   // 🐉 龍騎士掉落表全職可掉（書板/鎖鏈劍）；妖魔搜索文件等試煉道具由 push 內 trialDropBlocked 對非龍騎士隱藏
    if (typeof WARRIOR_DROPS !== 'undefined') push(WARRIOR_DROPS);   // ⚔️ 戰士技能印記掉落表（全職可掉）
    if (typeof MEM_DROPS !== 'undefined') push(MEM_DROPS);   // 🔮 記憶水晶掉落表（全職可掉）
    return ids;
}
function renderAuditDrops(el) {
    let pool = (typeof DB !== 'undefined' && DB.maps && typeof mapState !== 'undefined') ? (DB.maps[mapState.current] || null) : null;
    let body;
    if (!pool || !pool.length) {
        body = '<div class="text-slate-500 text-sm">目前地圖沒有怪物掉落資料。</div>';
    } else {
        // 🔧 依怪物等級由低到高排序（同級維持原出現順序）
        let sorted = pool.slice().sort((a, b) => ((DB.mobs[a] && DB.mobs[a].lv) || 0) - ((DB.mobs[b] && DB.mobs[b].lv) || 0));
        body = sorted.map(mid => {
            let mob = DB.mobs[mid]; if (!mob) return '';
            let drops = _auditMobDrops(mob.n);
            let dropHtml = drops.length
                ? drops.map(id => `<span class="${getItemColor({ id })}">${DB.items[id].n}</span>`).join('、')
                : '<span class="text-slate-500">（無掉落物）</span>';
            let _nameCls = mob.boss ? 'text-orange-400' : getMobColor(mob.lv);   // 🔧 BOSS：橘金色標註（不加呼吸光暈）
            return `<div class="bg-slate-800/60 rounded p-2">
                <div class="font-bold ${_nameCls} mb-1">${mob.boss ? '👑 ' : ''}${mob.n} <span class="text-slate-500 text-xs">Lv.${mob.lv}</span></div>
                <div class="text-xs leading-relaxed">${dropHtml}</div>
            </div>`;
        }).join('');
    }
    el.innerHTML = `<div class="flex flex-col gap-3 text-sm">
        <div class="flex items-center justify-between">
            <span class="text-purple-300 font-bold text-base">本圖掉落物品</span>
            <button onclick="toggleAuditView()" class="btn px-3 py-1 text-xs bg-indigo-900 border-indigo-600 text-indigo-200 font-bold">統計表</button>
        </div>
        <div class="text-slate-400 text-xs">目前地圖出沒的怪物與其掉落物品（不含機率）。</div>
        ${body}
    </div>`;
}
setInterval(() => { try { renderAuditTab(); } catch(e) {} }, 2000);   // 開著統計分頁時每 2 秒刷新即時數字
// 🔧 架構#2：死亡兩段式清算 ——
// killMob() 只負責「標記死亡＋發放獎勵/掉落」；輸送帶遞補與目標重映射延後到 settleDeadMobs()。
// tick 內的擊殺由 gameLoop 在 tick 結束後統一清算；手動操作（點技能/道具）觸發的擊殺立即清算。
// 好處：怪物迭代過程中陣列不再位移，徹底杜絕「怪物被跳過回合 / 索引指到錯的怪」這類隱性錯誤。
function classicDropMult() { return player.classicMode ? 0.1 : 1; }   // 🎮 經典模式：所有物品掉落機率 ×1/10
// 🎮 經典模式例外：職業專屬試煉道具（TRIAL_ITEM_CLASS 內者）不受 ×1/10 影響→照原機率掉落（避免 50 級試煉在經典模式難度暴增 10 倍）；非試煉道具仍套用 classicDropMult。用於 MOB_DROPS／DRAGON_DROPS 兩個含試煉道具的掉落表。
function trialItemDropMult(id) { return (typeof TRIAL_ITEM_CLASS !== 'undefined' && TRIAL_ITEM_CLASS[id]) ? 1 : classicDropMult(); }
function killMob(idx) {
    let mob = mapState.mobs[idx];
    if (!mob || mob._dead) return;        // 冪等保護：同一隻怪只結算一次獎勵
    mob._dead = true;
    try { vfxKill(mob); } catch(e){}   // ✨ VFX：擊殺粒子爆裂（趁格子 DOM 仍在、重繪前）
    if (mob.curHp > 0) mob.curHp = 0;     // 待清算期間不可被當成活目標
    let _kbRoom = !!KING_ROOMS[mapState.current];   // 🔧 軍王之室
    let _kbNoReward = _kbRoom && !mob.boss;                     // 除頭目外（地獄束縛犬）：不給金錢/掉落
    _sherineLootCtx = mob._sherine ? { boss: !!mob.boss, grace: !!mob._grace, mad: !!mob._sherineMad } : null;   // 🔮 席琳的世界：本次擊殺掉落套用 詞綴×3(瘋狂×5)／套裝效果判定（恩賜怪套裝機率×5、瘋狂再×3）
    _tradLootCtx = traditionalActive();   // 🏛️ 傳統模式：本次擊殺掉落的裝備隨機自帶強化值＋抑制施法卷軸（於 _sherineLootCtx 清除處一併關閉）
    _vfxLootCtx = true;   // ✨ VFX：本次擊殺掉落期間→gainItem 對潘朵拉權重=1 物品閃光
    try {
    if(typeof auditTrackKill === 'function') auditTrackKill(mob);   // 統計：累計經驗/擊殺
    // 🔧 轉場建築（往上層的樓梯 / 遺忘之島傳送門）：擊敗即進入下一層/島，不顯示「擊敗了…」戰鬥訊息（race 建築且 noAutoTeleport，排除攻城塔/城門）
    let _hideKillMsg = (mob.race === '建築' && mob.noAutoTeleport);
    if(!_hideKillMsg) logCombat(`擊敗了 <span class="${getMobColor(mob.lv)}">${mob.n}</span>！`, 'player-heavy');  // 👈 新增
    player.exp += Math.floor(mob.exp * getExpGainMult(player.lv) * (player.classicMode ? 0.5 : 1));   // 🎮 經典模式：經驗值減半
    checkLvUp();
    // 精神(WIS)：擊殺敵人時立即額外恢復 MP
    { let mpKill = getWisMpOnKill(player.d.wis); if (mpKill > 0 && player.mp < player.mmp) player.mp = Math.min(player.mmp, player.mp + mpKill); }
    
    if (!_kbNoReward && Math.random() < 0.8) {
        let gMin = mob.goldMin || (mob.lv * 5);
        let gMax = mob.goldMax || (mob.lv * 10);
        let g = gMin + Math.floor(Math.random() * (gMax - gMin + 1));
        if (player.classicMode) g = Math.floor(g / 2);   // 🎮 經典模式：怪物金幣僅剩一般模式的 1/2（歷次：×1/10 → ×1/3 → ×1/2）
        player.gold += g;
        // 🔧 金幣不再逐殺輸出於系統日誌；改由 gameLoop 累積、flushAwaySummary 以「掛機期間獲得總金幣」統一顯示。

    }
	// 誘捕判定（誘捕上限改於「使用肉」時以 floor(魅力/7) 判定）
    if (player.buffs.taming > 0) {
        let collarDrop = null;
        if (mob.n.includes("杜賓狗")) collarDrop = 'new_item_184';
        else if (mob.n.includes("狼")) collarDrop = 'new_item_185';
        else if (mob.n.includes("哈士奇")) collarDrop = 'new_item_collar_husky';
        else if (mob.n.includes("牧羊犬")) collarDrop = 'new_item_238'; // 已改為編號

        if (collarDrop) {   // 誘捕擊殺必定捕獲（100%）
            gainItem(collarDrop, 1);
            logSys(`<span class="text-green-300 font-bold">誘捕成功！獲得 ${DB.items[collarDrop].n}。</span>`);
            player.buffs.taming = 0;
        }
    }
    
    // === 🐾 進化果實：擊敗屬性怪物 0.0001%×怪物等級 機率掉落對應屬性果實 ===
    if (!_kbNoReward) {
        let _fruitByEle = { water: 'new_fruit_rabbit', fire: 'new_fruit_fox', earth: 'new_fruit_beagle', wind: 'new_fruit_stbernard' };
        let _fruitId = _fruitByEle[mob.e];
        if (_fruitId && Math.random() < (0.000001 * (mob.lv || 1) * classicDropMult())) {   // 0.0001% × 怪物等級（🎮 經典×1/10）
            gainItem(_fruitId, 1);
            logSys(`<span class="text-green-300 font-bold">✦ 你從敵人殘骸中發現了 ${DB.items[_fruitId].n}！</span>`);
        }
    }

    // === 🔧 卡瑞：擊殺後扣除四樣任務道具各一個 ===
    if (mob.n === '卡瑞') {
        ['item_dragon_claw', 'item_lizard_horn', 'item_crystal_ball', 'item_orc_amulet'].forEach(q => {
            let st = player.inv.find(i => i.id === q && i.cnt > 0);
            if (st) st.cnt--;
        });
        player.inv = player.inv.filter(i => i.cnt > 0);
        logSys('<span class="text-amber-300 font-bold">封印之物失去了力量：</span><span class="text-amber-200">飛龍的爪子、蜥蜴的角、水晶球、妖魔戰士護身符 各消耗了 1 個。</span>');
    }

    // === 🏅 精通任務：接取後擊敗職業對應頭目必得「精通之證」（身上已有一枚則不再掉落）===
    if (player.masteryQuest === 'active' && MASTERY_DATA[player.cls] && mob.n === MASTERY_DATA[player.cls].boss
        && !player.inv.some(i => i.id === 'item_mastery_proof')) {
        gainItem('item_mastery_proof', 1);
        logSys('<span class="text-amber-300 font-bold">✦ 你從強敵的殘骸中拾起了「精通之證」——回威頓村找漢吧。</span>');
    }

    // === 🔥 50級試煉條件掉落 ===
    if (player.cls === 'knight' && player.trialStage === 1 && mob.n === '黑暗妖精將軍' && !player.inv.some(i => i.id === 'item_dantes_letter') && Math.random() < 0.01) { gainItem('item_dantes_letter', 1); logSys('<span class="text-amber-300 font-bold">✦ 你取得了 丹特斯的召書。</span>'); }
    if (player.cls === 'elf' && player.trialStage === 1 && mob.n === '巨大兵蟻' && !player.inv.some(i => i.id === 'item_ancient_book') && Math.random() < 0.01) { gainItem('item_ancient_book', 1); logSys('<span class="text-amber-300 font-bold">✦ 你取得了 古代黑妖之秘笈。</span>'); }
    if (player.cls === 'dark' && player.trialStage === 1 && mob.n === '黑暗棲林者' && !player.inv.some(i => i.id === 'item_chaos_key') && Math.random() < 0.01) { gainItem('item_chaos_key', 1); logSys('<span class="text-amber-300 font-bold">✦ 你取得了 混沌鑰匙。</span>'); }
    if (player.cls === 'royal' && player.trialStage === 1 && mob.n === '小惡魔' && !player.inv.some(i => i.id === 'item_royal_order') && Math.random() < 0.01) { gainItem('item_royal_order', 1); logSys('<span class="text-amber-300 font-bold">✦ 你取得了 調職命令書。</span>'); }   // 👑 王族 50 級試煉（唯一，不受經典掉率影響，與其他職業一致）
    if (player.cls === 'royal' && mob.n === '黑騎士搜索隊' && Math.random() < 0.01 * classicDropMult()) { gainItem('new_item_241', 1); logSys('<span class="text-amber-300 font-bold">✦ 黑騎士搜索隊掉落了 王族搜索狀！</span>'); }   // 👑 王族限定：黑騎士搜索隊 1% 掉王族搜索狀（不影響血盟敵人 100% 掉落）
    if (player.cls === 'knight' && player.trialStage === 2 && mapState.current === 'elf_grave' && questCountId('item_elf_whisper') < 10 && Math.random() < 0.01) { gainItem('item_elf_whisper', 1); logSys('<span class="text-amber-300 font-bold">✦ 你拾起了 精靈的私語。</span>'); }   // 🔧 已持有 10 個則不再掉落（上限）
    if (mob.n === '魔族暗殺團') {
        if (player.cls === 'elf' && player.trialStage === 2 && !player.inv.some(i => i.id === 'item_sealed_intel')) { gainItem('item_sealed_intel', 1); logSys('<span class="text-amber-300 font-bold">✦ 你從魔族暗殺團身上取得了 密封的情報書。</span>'); }
        if (player.cls === 'mage' && player.trialStage === 1 && !player.inv.some(i => i.id === 'item_spy_report')) { gainItem('item_spy_report', 1); logSys('<span class="text-amber-300 font-bold">✦ 你從魔族暗殺團身上取得了 間諜報告書。</span>'); }
    }

    // === 🔥 炎魔友好度（隱藏值）：於魔族神殿擊殺任意敵人 +1（用於解鎖炎魔謁見所；需先完成 50 級試煉才能進入魔族神殿） ===
    if (mapState.current === 'demon_temple') player.flameAffinity = (player.flameAffinity || 0) + 1;

    // === 血盟敵人：擊敗必定掉落「王族搜索狀」（100%）===
    if (mob.race === '血盟' && !isSiegeArea(mapState.current)) {   // 攻城區不掉王族搜索狀
        gainItem('new_item_241', 1);
        logSys(`<span class="text-amber-300 font-bold">擊敗血盟敵人，取得了 王族搜索狀！</span>`);
    }

    // === 野外＋血盟敵人：1% 機率額外掉落一件「攜帶物」（抽法同潘朵拉，裝備可能已強化）===
    if ((mob.wild && mob.race === '血盟') || mob.siegeEnemy) pledgeBonusDrop(mob);   // 野外血盟 或 攻城敵人：擊殺特殊掉寶

    // === 🐉 三大龍：擊敗必得「幼龍蛋」（身上已有一枚則不再掉落，100%・不受經典掉率影響）===
    if (['安塔瑞斯', '法利昂', '巴拉卡斯'].includes(mob.n) && !player.inv.some(i => i.id === 'item_dragon_egg')) {
        gainItem('item_dragon_egg', 1);
        logSys('<span class="text-amber-300 font-bold">✦ 你從巨龍的殘骸中拾起了一顆「幼龍蛋」——它似乎在呼喚著什麼……</span>');
    }

    // === 怪物專屬掉落（依「怪物掉落資料.md」）：每樣物品各自獨立判定一次 ===
    let dropList = _kbNoReward ? [] : (MOB_DROPS[mob.n] || []);   // 🔧 魔獸軍王之室：除頭目外不掉落物品
    let _dropBase = (mob._grace ? 10 : (mob._sherine ? (mob._sherineMad ? 5 : 3) : 1));   // 🔮 席琳的世界 ×3（瘋狂×5）／恩賜怪 ×10（不含經典 ×1/10，供試煉道具用）
    let _dropMult = _dropBase * classicDropMult();   // 🎮 經典模式：×1/10（涵蓋怪物掉落表／黑暗武器／黑精靈水晶／祝福卷軸／區域額外掉落；試煉道具走 _dropBase×trialItemDropMult 不受 ×1/10）
    dropList.forEach(entry => {
        let itemId = entry[0];
        let ratePct = entry[1];               // 機率(%)
        if(!DB.items[itemId]) return;          // 該物品不存在於資料庫則略過
        if(trialDropBlocked(itemId)) return;   // 🔒 試煉兌換道具：僅本職擊殺才掉（非本職直接跳過）
        if(Math.random() < (ratePct * _dropBase * trialItemDropMult(itemId)) / 100) gainItem(itemId, 1);   // 🎮 試煉道具不受經典 ×1/10（trialItemDropMult 回 1）
    });

    // === 🔧 萬能藥稀有掉落：等級 40 以上、非血盟。一般敵人 0.01%；頭目 1%（排除夢幻之島頭目），擊殺後隨機掉落 6 種萬能藥之一 ===
    if ((mob.lv || 0) >= 40 && mob.race !== '血盟') {
        let _panRate = mob.boss ? (mapState.current === 'dream_island' ? 0 : 0.01) : 0.0001;   // 頭目 1%（夢幻之島頭目除外）／一般敵人 0.01%
        if (_panRate > 0 && Math.random() < _panRate * classicDropMult()) {
            const _PANACEA = ['panacea_str', 'panacea_dex', 'panacea_con', 'panacea_int', 'panacea_wis', 'panacea_cha'];
            let _pid = _PANACEA[Math.floor(Math.random() * _PANACEA.length)];
            gainItem(_pid, 1);
            logSys(`<span class="text-pink-300 font-bold">✦ 罕見掉落！</span>你獲得了 <span class="text-pink-300 font-bold">${DB.items[_pid].n}</span>。`);
        }
    }

    // === 🔧 黑魔石掉落（黑暗妖精素材）：沉默洞穴周邊固定掉落（提煉魔石提高）；其餘野外/地監需學提煉魔石才掉（攻城區不掉）===
    {
        let _refine = player.skills.includes('sk_dark_refine');   // 提煉魔石（被動）
        let _cdm = classicDropMult();   // 🎮 經典模式：×1/10
        if (mapState.current === 'silent_outer') {
            if (Math.random() < (_refine ? 0.30 : 0.20) * _cdm) gainItem('mat_blackstone2', 1);
            if (Math.random() < (_refine ? 0.15 : 0.10) * _cdm) gainItem('mat_blackstone3', 1);
        } else if (_refine && typeof mapCategoryOf === 'function' && ['wild','dungeon'].includes(mapCategoryOf(mapState.current))) {   // 🔧 野外＋地監均可掉（攻城區不掉）
            if (Math.random() < 0.01 * _cdm)  gainItem('mat_blackstone2', 1);
            if (Math.random() < 0.005 * _cdm) gainItem('mat_blackstone3', 1);
            if (Math.random() < 0.001 * _cdm) gainItem('mat_blackstone4', 1);
        }
    }
    // === 🔧 銀礦石掉落（黑暗妖精製作材料）===
    {
        let _oreRates = { '石頭高崙':100, '鋼鐵高崙':100, '侏儒':50, '侏儒戰士':50, '黑騎士':50, '哈柏哥布林':50, '蜥蜴人':50 };
        let _or = _oreRates[mob.n];
        if (_or && Math.random() < _or / 100 * classicDropMult()) gainItem('mat_silverore', 1);
    }
    // === 🏛️ 聖地遺物掉落：持有死亡騎士之印記、於拉斯塔巴德區域擊敗任何怪物，0.1% 機率獲得（製作長老之室武器秘笈用） ===
    if (player.inv.some(i => i.id === 'item_dk_insignia') && typeof mapRegionOf === 'function' && mapRegionOf(mapState.current) === 'rastabad') {
        if (Math.random() < 0.001 * classicDropMult()) gainItem('mat_holy_relic', 1);
    }
    // === 🔧 黑暗妖精武器掉落 ===
    { let _dwd = (typeof DARK_WEAPON_DROPS !== 'undefined') ? DARK_WEAPON_DROPS[mob.n] : null;
      if (_dwd) _dwd.forEach(e => { if (DB.items[e[0]] && Math.random() < (e[1] * _dropMult) / 100) gainItem(e[0], 1); }); }
    // === 🔧 三階黑暗精靈水晶掉落 ===
    { let _dcd = (typeof DARK_CRYSTAL_DROPS !== 'undefined') ? DARK_CRYSTAL_DROPS[mob.n] : null;
      if (_dcd) _dcd.forEach(e => { if (DB.items[e[0]] && Math.random() < (e[1] * _dropMult) / 100) gainItem(e[0], 1); }); }
    // === 🐉 龍騎士掉落（任務道具／書板／鎖鏈劍）：僅龍騎士主玩家擊殺時判定 ===
    { let _drd = (typeof DRAGON_DROPS !== 'undefined') ? DRAGON_DROPS[mob.n] : null;   // 🐉 龍騎士掉落表改為全職可掉（書板/鎖鏈劍·就算不能裝備也掉）；妖魔搜索文件等試煉道具由 trialDropBlocked 限定 dragon
      if (_drd) _drd.forEach(e => { if (DB.items[e[0]] && !trialDropBlocked(e[0]) && Math.random() < (e[1] * _dropBase * trialItemDropMult(e[0])) / 100) gainItem(e[0], 1); }); }   // 🎮 龍騎士試煉道具不受經典 ×1/10
    // === ⚔️ 戰士技能印記掉落（全職可掉·僅戰士可學）===
    { let _wrd = (typeof WARRIOR_DROPS !== 'undefined') ? WARRIOR_DROPS[mob.n] : null;
      if (_wrd) _wrd.forEach(e => { if (DB.items[e[0]] && Math.random() < (e[1] * _dropMult) / 100) gainItem(e[0], 1); }); }
    // 🔮 記憶水晶掉落（幻術士法術書·全職可掉，獨立 roll·與 MOB_DROPS 並存）
    { let _memd = (typeof MEM_DROPS !== 'undefined') ? MEM_DROPS[mob.n] : null;
      if (_memd) _memd.forEach(e => { if (DB.items[e[0]] && Math.random() < (e[1] * _dropMult) / 100) gainItem(e[0], 1); }); }
    // 🎴 卡片掉落（血盟標籤以外·一般＝經典機率·不乘 classicDropMult·內部判定自動賣出）
    if (typeof rollCardDrops === 'function') rollCardDrops(mob);

    // === 40等以上 BOSS（夢幻之島 + 攻城區/siegeEnemy 除外）：賦予祝福卷軸稀有掉落，各自獨立判定 ===
    if (mob.boss && mob.lv >= 40 && mapState.current !== 'dream_island' && !isSiegeArea(mapState.current) && !mob.siegeEnemy) {
        if (Math.random() < 0.001 * _dropMult)  gainItem('new_item_bless_wpn', 1);   // 0.1%  賦予武器祝福卷軸（🔮席琳×3）
        if (Math.random() < 0.001 * _dropMult)  gainItem('new_item_bless_arm', 1);   // 0.1%  賦予盔甲祝福卷軸
        if (Math.random() < 0.0001 * _dropMult) gainItem('new_item_bless_acc', 1);   // 0.01% 賦予飾品祝福卷軸
    }

    // === 區域額外掉落：眠龍洞穴1~3樓(zone_15/16/17) / 妖精森林周邊(zone_01) 所有怪物 ===
    // 粗糙的米索莉塊 / 精靈玉 / 元素石，各 20%；學會「世界樹的呼喚」則各 30%
    if (AREA_BONUS_MAPS.includes(mapState.current)) {
        let bonusRate = (player.skills.includes('sk_elf_worldtree') ? 0.30 : 0.20) * _dropMult;   // 🔮 席琳的世界×3
        AREA_BONUS_ITEMS.forEach(itemId => {
            if(DB.items[itemId] && Math.random() < Math.min(1, bonusRate)) gainItem(itemId, 1);
        });
    }

    // === 🔮 席琳結晶：席琳的世界限定掉落（固定機率，不吃掉落倍率）===
    // 血盟與 Lv20 以下不掉（血盟本就無 _sherine）；21~30 非BOSS 0.001%、31~40 非BOSS 0.002%、
    // 41+ 非BOSS 0.003%、夢幻之島BOSS 0.01%、四大龍（安塔瑞斯/法利昂/巴拉卡斯/林德拜爾）10%、其餘BOSS 0.1%
    if (mob._sherine) {
        let _cr = 0;
        if (['安塔瑞斯', '法利昂', '巴拉卡斯', '林德拜爾'].includes(mob.n)) _cr = 0.10;
        else if (mob.boss) _cr = (mapState.current === 'dream_island') ? 0.0001 : 0.001;
        else if ((mob.lv || 1) >= 41) _cr = 0.00003;
        else if ((mob.lv || 1) >= 31) _cr = 0.00002;
        else if ((mob.lv || 1) >= 21) _cr = 0.00001;
        if (_cr > 0 && Math.random() < _cr * classicDropMult() * (mob._sherineMad ? 3 : 1)) {   // 🔮 瘋狂的席琳世界：結晶掉率 ×3（一般怪／頭目皆然）
            gainItem('sherine_crystal', 1);
            logSys(`<span class="c-sherine font-bold">✦✦ 席琳結晶 從 ${mob.n} 的殘骸中浮現！✦✦</span>`);
        }
    }
    
    } finally {
        _sherineLootCtx = null;   // 🔮 掉落判定結束，清除上下文（try/finally：縱使中途拋例外也必清，杜絕 _tradLootCtx 殘留洩漏到兌換/任務/其他 forceNormal=false 獎勵）
        _tradLootCtx = false;     // 🏛️ 傳統模式掠奪上下文一併關閉
        _vfxLootCtx = false;      // ✨ VFX：擊殺掉落上下文一併關閉
    }
    // 🔧 架構#2：不在此處位移輸送帶（呼叫點可能正在迭代怪物陣列）。
    // tick 內的擊殺延後到 gameLoop 的 settleDeadMobs()；手動操作則立即清算。
    if (!state.inTick) settleDeadMobs();

    renderMobs();
    updateUI();
    if(isSiegeArea(mapState.current)) mapState.suppressSiegeBoss = false;   // 攻城區擊殺後，重生開始可出現城門/守護塔(10%)
    handleSiegeKill(mob);   // 攻城戰：擊殺計數 + 城門/守護塔判定
    if (mob.boss && !player.dead) saveGame();   // 🔧 成功擊殺頭目時自動存檔（保護稀有掉落）
    if (_kbRoom && mob.boss && !player.dead) {   // 🔧 軍王之室：擊敗頭目並取得掉落後，於清算時傳送回村/回城（🏛️ 雙BOSS祭壇：場上不再有其他存活BOSS時才算全滅）
        let _krm = KING_ROOMS[mapState.current];
        if (!_krm.dual || !mapState.mobs.some(m => m && m.boss && !m._dead && m.uid !== mob.uid)) state._kbVictory = true;
    }
    if (state.prideClimb && mob.boss && !player.dead) state._prideAdvance = true;   // 🗼 攀登中擊敗頭目(樓梯/潔尼斯)：於清算時前進樓層或結算
    if (state.oblivion === 'travel' && mob.boss && !player.dead) state._oblivionAdvance = true;   // 🏝️ 途中擊敗傳送門「遺忘之島」：清算時進入本島
}

// 🔧 架構#2：統一清算所有已標記死亡的怪 —— 5 格輸送帶遞補（中1→左0→右2→後3→後4）＋目標重映射。
// 把前排(0,1,2)與後排(3,4)視為單一輸送帶：存活怪依優先序往前壓實，後排怪會遞補進空出的前排；
// 常見情境(各格皆滿、單隻死)結果與原 3 格輸送帶一致；多隻同死於一次處理完成（不需迭代）。
function settleDeadMobs() {
    let changed = false;
    const _ORDER = [1, 0, 2, 3, 4];   // 遞補/填補優先序：前排 中→左→右，再後排 左→右（與 getTarget 自動鎖定序一致）
    if (_ORDER.some(i => mapState.mobs[i] && mapState.mobs[i]._dead)) {
        changed = true;
        let _tgtUid = (mapState.targetIdx >= 0 && mapState.mobs[mapState.targetIdx] && !mapState.mobs[mapState.targetIdx]._dead) ? mapState.mobs[mapState.targetIdx].uid : null;
        let _alive = [], _pending = [];
        for (let i of _ORDER) {
            let m = mapState.mobs[i];
            if (m && m._dead) continue;                                                                       // 死亡→移出輸送帶
            if (m) _alive.push(m);
            else if (mapState.spawnAt && mapState.spawnAt[i] != null) _pending.push(mapState.spawnAt[i]);     // 既有空格的「待出怪倒數」保留並順移
        }
        let _seq = _alive.map(m => ({ mob: m })).concat(_pending.map(sa => ({ sa: sa })));                    // 先怪、再待出怪倒數、最後空格
        for (let k = 0; k < _ORDER.length; k++) {
            let slot = _ORDER[k], it = _seq[k];
            if (it && it.mob) { mapState.mobs[slot] = it.mob; if (mapState.spawnAt) mapState.spawnAt[slot] = null; }
            else if (it && it.sa != null) { mapState.mobs[slot] = null; if (mapState.spawnAt) mapState.spawnAt[slot] = it.sa; }
            else { mapState.mobs[slot] = null; if (mapState.spawnAt) mapState.spawnAt[slot] = null; }          // 其餘空格交回出怪迴圈重新排程
        }
        mapState.targetIdx = _tgtUid ? mapState.mobs.findIndex(m => m && m.uid === _tgtUid) : -1;             // 以 uid 重映射目標（目標死亡→-1）
    }
    if (changed) renderMobs();
    // 🔧 軍王之室：擊敗頭目（掉落已於 killMob 發放）後處理；補跑期間延後到回到即時再執行。
    //   身上仍有「軍王的鑰匙」→ 留在室內，清空全部怪物，15 秒後消耗 1 把鑰匙從頭復活軍王；
    //   無鑰匙 → 傳送回村/回城（原行為）。
    if (state._kbVictory) {   // 🔧 背景/離線補跑(ff)時也照常結算，達成掛機自動刷新
        state._kbVictory = false;
        let _krm = KING_ROOMS[mapState.current];
        let _keyId = (_krm && _krm.key) || 'item_king_key';
        let _keyNm = DB.items[_keyId] ? DB.items[_keyId].n : '鑰匙';
        let _hasKey = _krm && player.inv.some(i => i.id === _keyId && (i.cnt || 1) >= 1);
        if (_hasKey) {
            mapState.mobs = [null, null, null, null, null];
            mapState.spawnAt = [null, null, null, null, null];
            mapState.targetIdx = -1;
            state._kbRespawnAt = state.ticks + 150;   // 15 秒（150 tick）後復活
            if (!state.ff) { renderMobs(); updateUI(); }   // 補跑期間不逐次刷新，跑完由 gameLoop 統一刷新
            logSys(`<span class="text-amber-300 font-bold">⚔ ${_krm.dual ? '兩位神祇' : '軍王'}已倒下！室內怪物盡數消散…</span> 15 秒後將消耗 <span class="text-amber-300">1 把${_keyNm}</span>，${_krm.dual ? '神祇' : '軍王'}再度甦醒。`);
        } else {
            kbVictoryTeleport();
        }
    }
    // 🗼 傲慢之塔攀登：擊敗樓梯→前往下一層；擊敗 F10 頭目→開放2~10樓並結算
    if (state._prideAdvance) {
        state._prideAdvance = false;
        prideOnBossKill();
    }
    // 🏝️ 遺忘之島途中：擊敗傳送門後於清算時進入本島
    if (state._oblivionAdvance) {
        state._oblivionAdvance = false;
        oblivionOnPortalKill();
    }
}
// 🔧 魔獸軍王之室：擊敗巴蘭卡後的傳送（目的地同「回村/回城」按鈕：攻城獲勝→獲勝城池城堡，否則→職業/血盟起始村）
function kbVictoryTeleport() {
    logSys('<span class="text-amber-300 font-bold">⚔ 你擊敗了軍王！封印之力消散，將你送回了安全之地。</span>');
    setMapSelectors(siegeVictoryActive() ? victoryCityCfg().castle : getHomeTown());
    changeMap(true);   // force：略過受控狀態檢查與鑰匙消耗
    // 🔧 自軍王之室回城後，將「特殊」分類的記憶位置改為新兵修練場（下次選特殊優先進入，不會自動回到需鑰匙的軍王之室）
    if (!player.lastMapByCat) player.lastMapByCat = {};
    player.lastMapByCat.special = 'training';
    saveGame();        // 傳送後存檔，使重新載入時人物位於村莊（而非已清空的BOSS房）
}
// 🔧 軍王之室：等待 15 秒後消耗 1 把「軍王的鑰匙」，從頭重生中央軍王與兩側小怪；沒鑰匙則保險傳送回村/回城
function kbRoomRespawn() {
    let _kr = KING_ROOMS[mapState.current];
    if (!_kr) { state._kbRespawnAt = null; return; }
    let _keyId = _kr.key || 'item_king_key';
    let _keyNm = DB.items[_keyId] ? DB.items[_keyId].n : '鑰匙';
    let _ki = player.inv.findIndex(i => i.id === _keyId && (i.cnt || 1) >= 1);
    if (_ki < 0) { kbVictoryTeleport(); return; }   // 等待期間鑰匙意外用罄：傳送回村/回城
    let _kit = player.inv[_ki];
    if ((_kit.cnt || 1) > 1) _kit.cnt -= 1; else player.inv.splice(_ki, 1);
    if (_kr.dual) { _kr.bosses.forEach((bid, k) => spawnMob(k)); }   // 🏛️ 雙BOSS祭壇：兩隻BOSS同時復活
    else { spawnMob(1); spawnMob(0); spawnMob(2); }                  // 中央軍王 + 兩側小怪，全新滿血
    mapState.spawnAt = [null, null, null, null, null];
    mapState.targetIdx = -1;
    logSys(`<span class="text-amber-300 font-bold">你消耗了 1 把 ${_keyNm}，${_kr.dual ? '兩位神祇' : '軍王'}再度甦醒！</span>`);
    if (!state.ff) { renderTabs(true); renderMobs(); updateUI(); saveGame(); }   // 🔧 補跑期間不逐次刷新/存檔，跑完由 gameLoop 統一處理（避免大量 localStorage 寫入）
}

// ======================= 🗼 傲慢之塔：攀登 / 排名 =======================
// 排名/攀登狀態存於 state（非存檔；重載一律回城，避免重載刷分）
// 傳送禁用：排名模式一律禁止；11F+ 樓層區間需持有對應支配符（dom）。2~10 攀登/farming 不限制。
function prideTeleportBlocked() {
    if (state.riftRun) return true;   // 🌀 時空裂痕：禁止傳送（單一戰場，避免洗怪/逃頭目刷時間）
    if (state.prideRanked) return true;
    let cur = mapState.current;
    if (typeof cur === 'string') {
        let m = cur.match(/^pride_(\d+)_\d+$/);
        if (m) { let tier = parseInt(m[1]); if (tier >= 11 && !prideHasTalisman(tier, ['dom'])) return true; }
    }
    return false;
}
// 進入指定攀登樓層（pride_fN）：複製 changeMap 戰鬥進場流程（補跑期間不操作 DOM）
function enterPrideFloor(n) {
    saveSiegeBossHp();
    mapState.current = 'pride_f' + n;
    player.lastBattleMap = mapState.current;   // 🗼 記錄攀登位置：回村後點「出發」會被導回傲慢之塔1樓（見 departToLastBattle）
    state.prideFloor = n;
    mapState.mobs = [null, null, null, null, null];
    state._kbRespawnAt = null;
    mapState.forceBoss = false;
    mapState.targetIdx = -1;
    let t0 = state.ticks;
    mapState.spawnAt = [t0 + 70, t0 + 50, t0 + 90];
    mapState.suppressSiegeBoss = true;
    if (typeof auditReset === 'function') auditReset();
    if (!state.ff) {
        let mapPanel = document.getElementById('town-view').parentElement;
        document.getElementById('battle-view').classList.remove('hidden');
        document.getElementById('combat-log-panel').classList.remove('hidden');
        document.getElementById('town-view').classList.add('hidden');
        document.getElementById('town-view').classList.remove('flex');
        mapPanel.classList.remove('flex-1', 'overflow-hidden');
        logSys(`<span class="text-rose-200 font-bold">--- 傲慢之塔 ${n}F ---</span>`);
        renderMobs();
        syncMapSelectors();
        updateUI();
    }
}
// 從入口按鈕開始攀登（ranked=排名模式）：自 2F 起
function startPrideClimb(ranked) {
    if (player.statuses && (player.statuses.stone > 0 || player.statuses.paralyze > 0 || player.statuses.freeze > 0 || player.statuses.stun > 0 || player.statuses.sleep > 0)) {
        logSys('你目前無法行動（石化／麻痺／冰凍／暈眩），無法進入傲慢之塔。'); return;
    }
    state.prideClimb = true;
    state.prideRanked = !!ranked;
    state.prideFloor = 2;
    state.prideStartMs = Date.now();
    logSys(ranked
        ? '<span class="text-amber-300 font-bold">🏆 排名挑戰開始！</span><span class="text-amber-200"> 即使持有支配符也無法使用傳送術與瞬間移動卷軸；回村或擊敗 100 樓頭目時結算。</span>'
        : '<span class="text-rose-300 font-bold">🗼 你踏入傲慢之塔，開始向上攀登……</span>');
    enterPrideFloor(2);
    saveGame();
}
// 攀登中擊敗頭目（樓梯／F10 潔尼斯）後：前進樓層或結算
function prideOnBossKill() {
    let floor = state.prideFloor || 2;
    let isBossFloor = (floor % 10 === 0);   // 10 的倍數樓層擊敗的是該樓頭目；其餘擊敗的是「往上層的樓梯」
    if (isBossFloor) {
        if (floor === 10) player.prideBeatJenis = true;   // 首次擊敗潔尼斯女王：開放 2~10 樓直接挑戰
        logSys(`<span class="text-amber-300 font-bold">⚔ 你擊敗了 傲慢之塔 ${floor} 樓的頭目！</span>` + (floor === 10 ? '<span class="text-amber-200"> 傲慢之塔 2~10 樓 已開放，可於入口直接挑戰。</span>' : ''));
    }
    let next = floor + 1;
    if (DB.maps['pride_f' + next]) {   // 下一層已開放 → 前進
        logSys(isBossFloor
            ? `<span class="text-rose-300 font-bold">封印解除，你前往 傲慢之塔 ${next}F！</span>`
            : `<span class="text-rose-300 font-bold">你踏上往上層的樓梯，前往 傲慢之塔 ${next}F！</span>`);
        enterPrideFloor(next);
        if (!state.ff) saveGame();
    } else {   // 下一層尚未開放（目前最高 F20）→ 結算並送回入口
        prideRecord(floor);
        prideEndClimb(`<span class="text-rose-200">你已抵達目前開放樓層的頂端（${floor}F），被送回了傲慢之塔入口。（更高樓層敬請期待後續更新）</span>`);
    }
}
// 結束攀登：送回傲慢之塔入口
function prideEndClimb(msg) {
    state.prideClimb = false; state.prideRanked = false; state.prideFloor = 0;
    setMapSelectors('town_pride');
    changeMap(true);
    if (msg) logSys(msg);
    saveGame();
}

// ======================= 🏝️ 遺忘之島：旅程 =======================
// 由海音 NPC 依斯巴搭船開始（費用 10 萬金幣）；先進入「遺忘之島途中(野外)」隨機遭遇，
// 擊敗傳送門「遺忘之島」後進入「遺忘之島」本島。旅程狀態存於 state.oblivion（不存檔；重載一律回村）。
function enterOblivionMap(mapKey) {
    saveSiegeBossHp();
    mapState.current = mapKey;
    player.lastBattleMap = mapKey;
    mapState.mobs = [null, null, null, null, null];
    state._kbRespawnAt = null;
    mapState.forceBoss = false;
    mapState.targetIdx = -1;
    let t0 = state.ticks;
    mapState.spawnAt = [t0 + 70, t0 + 50, t0 + 90];
    mapState.suppressSiegeBoss = true;
    if (typeof auditReset === 'function') auditReset();
    if (!state.ff) {
        let mapPanel = document.getElementById('town-view').parentElement;
        document.getElementById('battle-view').classList.remove('hidden');
        document.getElementById('combat-log-panel').classList.remove('hidden');
        document.getElementById('town-view').classList.add('hidden');
        document.getElementById('town-view').classList.remove('flex');
        mapPanel.classList.remove('flex-1', 'overflow-hidden');
        logSys(`<span class="text-cyan-200 font-bold">--- ${mapKey === 'oblivion_island' ? '遺忘之島' : '遺忘之島途中'} ---</span>`);
        renderMobs();
        syncMapSelectors();
        updatePrideFloorIndicator();
        updateUI();
    }
}
// 由依斯巴搭船：扣 10 萬金幣，進入「遺忘之島途中」
function startOblivion() {
    if (player.statuses && (player.statuses.stone > 0 || player.statuses.paralyze > 0 || player.statuses.freeze > 0 || player.statuses.stun > 0 || player.statuses.sleep > 0)) {
        logSys('你目前無法行動（石化／麻痺／冰凍／暈眩），無法出發。'); return;
    }
    if ((player.gold || 0) < 100000) { logSys('<span class="text-red-400">金幣不足（前往遺忘之島需 100,000 金幣）。</span>'); return; }
    player.gold -= 100000;
    state.oblivion = 'travel';
    state._oblivionAdvance = false;
    logSys('<span class="text-cyan-300 font-bold">⛵ 你搭上依斯巴的船，前往遺忘之島……</span><span class="text-cyan-200"> 旅途中無法選擇地圖，也無法使用傳送術與瞬間移動卷軸。</span>');
    enterOblivionMap('oblivion_travel');
    updateUI();
    saveGame();
}
// 擊敗傳送門「遺忘之島」後：進入遺忘之島本島
function oblivionOnPortalKill() {
    state.oblivion = 'island';
    logSys('<span class="text-cyan-300 font-bold">🏝️ 迷霧散去，你發現了遺忘之島！</span>');
    enterOblivionMap('oblivion_island');
    if (!state.ff) saveGame();
}
// 依斯巴：港口搭船 UI
function renderIsbaTravel(el) {
    el.innerHTML = `
        <div class="flex flex-col gap-3 p-1">
            <div class="text-slate-300 text-sm leading-relaxed">依斯巴：要搭船前往遺忘之島嗎？那是一座被迷霧籠罩的孤島……航程中無法選擇地圖，也無法使用傳送。</div>
            <div class="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-600 rounded p-3">
                <div class="text-sm text-slate-200 leading-relaxed">前往 <span class="text-cyan-300 font-bold">遺忘之島</span><br><span class="text-xs text-slate-400">費用：100,000 金幣（目前持有：${(player.gold||0).toLocaleString()}）</span></div>
                <button class="btn bg-cyan-700 hover:bg-cyan-600 border-cyan-500 py-2 px-4 font-bold shrink-0" onclick="startOblivion()">⛵ 前往遺忘之島</button>
            </div>
        </div>`;
}
// 紀錄結算：更新本次紀錄與最高紀錄（更高樓層優先；同樓層比時間短）
//   席琳的世界 與 一般 兩種狀態各自獨立計算（席琳期間中途無法切換，故以結算當下的狀態歸類）
function prideRecord(floor) {
    let key = sherineWorldActive() ? 'prideRankSherine' : 'prideRank';
    if (!player[key]) player[key] = { best: null, last: null, isNew: false };
    let r = player[key];
    let ms = state.prideStartMs ? (Date.now() - state.prideStartMs) : 0;
    r.last = { floor: floor, ms: ms };
    let b = r.best;
    if (!b || floor > b.floor || (floor === b.floor && ms < b.ms)) {
        r.best = { floor: floor, ms: ms };
        r.isNew = true;
    } else {
        r.isNew = false;
    }
}

// ======================= 🌀 時空裂痕（Spacetime Rift）=======================
// 單一戰場、時間制：停留越久 → 抽怪等級範圍越高、頭目越多。狀態存於 state（非存檔，重載回村）。
// 進入消耗 1 顆 龜裂之核(mat_crack_core)；離開以「停留時間」記入排名並產生待領獎勵（潘朵拉權重抽 1 件）。
const RIFT_DRAGONS = ['antaras', 'fafurion', 'valakas', 'lindvior'];           // 四大龍：30 分後才入池、場上至多 1 隻
const RIFT_DRAGON_NAMES = ['安塔瑞斯', '法利昂', '巴拉卡斯', '林德拜爾'];
function riftCoreCount() { return player.inv.reduce((s, i) => s + (i.id === 'mat_crack_core' ? (i.cnt || 1) : 0), 0); }
function enterRift() {
    if (player.statuses && (player.statuses.stone > 0 || player.statuses.paralyze > 0 || player.statuses.freeze > 0 || player.statuses.stun > 0 || player.statuses.sleep > 0)) {
        logSys('你目前無法行動（石化／麻痺／冰凍／暈眩），無法進入時空裂痕。'); return;
    }
    if (player.riftRewardMs != null) { logSys('<span class="text-amber-300">請先在時空裂痕入口「領取獎勵」，才能再次進入。</span>'); return; }
    let _ci = player.inv.findIndex(i => i.id === 'mat_crack_core' && (i.cnt || 1) >= 1);
    if (_ci < 0) { logSys('<span class="text-red-400">需要 1 顆 龜裂之核 才能進入時空裂痕（希培利亞村莊・巴特爾，以時空裂痕碎片×100 製作）。</span>'); return; }
    let _c = player.inv[_ci]; if ((_c.cnt || 1) > 1) _c.cnt -= 1; else player.inv.splice(_ci, 1);
    renderTabs(true);
    state.riftRun = true;
    state.riftStartMs = Date.now();
    state.riftBossDue = Date.now() + 300000;   // 首隻強制頭目在 5 分鐘
    enterRiftMap();
    saveGame();
}
function enterRiftMap() {   // 仿 enterPrideFloor 的戰鬥進場（不走 changeMap，避免清掉 riftRun）
    saveSiegeBossHp();
    mapState.current = 'rift_battle';
    player.lastBattleMap = 'rift_battle';
    mapState.mobs = [null, null, null, null, null];
    state._kbRespawnAt = null;
    mapState.forceBoss = false;
    mapState.targetIdx = -1;
    let t0 = state.ticks;
    mapState.spawnAt = [t0 + 30, t0 + 15, t0 + 45];
    mapState.suppressSiegeBoss = true;
    if (typeof auditReset === 'function') auditReset();
    if (!state.ff) {
        let mapPanel = document.getElementById('town-view').parentElement;
        document.getElementById('battle-view').classList.remove('hidden');
        document.getElementById('combat-log-panel').classList.remove('hidden');
        document.getElementById('town-view').classList.add('hidden');
        document.getElementById('town-view').classList.remove('flex');
        mapPanel.classList.remove('flex-1', 'overflow-hidden');
        logSys('<span class="font-bold" style="color:#c4b5fd;">--- 🌀 你撕開時空，踏入了裂痕…… ---</span>');
        renderMobs();
        syncMapSelectors();
        updateUI();
    }
}
function riftEndRun() {   // 離開裂痕：記排名 + 產生待領獎勵
    if (!state.riftRun) return;
    let stayMs = Math.max(0, Date.now() - (state.riftStartMs || Date.now()));
    riftRecord(stayMs);
    player.riftRewardMs = stayMs;
    state.riftRun = false; state.riftStartMs = 0; state.riftBossDue = 0;
    logSys(`<span class="font-bold" style="color:#c4b5fd;">🌀 你離開了時空裂痕，本次停留 ${fmtPrideTime(stayMs)}。請至時空裂痕入口「領取獎勵」。</span>`);
}
function riftEvacuate() {   // 🌀 主動撤離：與戰死等價（照樣記停留時間＋產生待領獎勵），只是不死、回到入口
    if (!state.riftRun) return;
    if (player.statuses && (player.statuses.stone > 0 || player.statuses.paralyze > 0 || player.statuses.freeze > 0 || player.statuses.stun > 0 || player.statuses.sleep > 0)) {
        logSys('你目前無法行動（石化／麻痺／冰凍／暈眩），無法撤離。'); return;
    }
    riftEndRun();            // 記排名 + 產生待領獎勵 + 清 state.riftRun
    setMapSelectors('town_rift');
    changeMap(true);         // 回入口安全區：補滿 HP/MP、清狀態、渲染領獎按鈕
    saveGame();
}
function riftRecord(ms) {
    let key = sherineWorldActive() ? 'riftRankSherine' : 'riftRank';
    if (!player[key]) player[key] = { best: null, last: null, isNew: false };
    let r = player[key];
    r.last = { ms: ms };
    if (!r.best || ms > r.best.ms) { r.best = { ms: ms }; r.isNew = true; } else { r.isNew = false; }
}
function claimRiftReward() {
    if (player.riftRewardMs == null) { logSys('<span class="text-slate-400">目前沒有可領取的時空裂痕獎勵。</span>'); return; }
    let stayMin = Math.floor(player.riftRewardMs / 60000);
    let itemId = drawRiftReward(stayMin);
    player.riftRewardMs = null;
    if (itemId && DB.items[itemId]) {
        gainItem(itemId, 1);
        logSys(`<span class="text-amber-300 font-bold">🎁 時空裂痕獎勵（停留 ${stayMin} 分）：</span>你獲得了 <span class="${DB.items[itemId].c || 'text-white'} font-bold">${DB.items[itemId].n}</span>！`);
    } else {
        logSys('<span class="text-slate-400">這次的時空裂痕未凝聚出任何獎勵。</span>');
    }
    saveGame();
    if (mapState.current === 'town_rift') renderTownNPCs('town_rift');
    updateUI();
}
function drawRiftReward(stayMin) {   // 潘朵拉權重抽 1 件：<30分排除權重1物品；≥30分納入、權重=max(1,分鐘-30)；非權重1物品不額外×2
    let includeW1 = stayMin >= 30;
    let w1w = includeW1 ? Math.max(1, stayMin - 30) : 0;   // 30分→1、1小時(60分)→30
    let total = 0, pool = [];
    for (let id in DB.items) {
        let w = DB.items[id].gachaWeight;
        if (w === undefined) w = 100;
        if (w <= 0) continue;
        if (w === 1) { if (!includeW1) continue; w = w1w; }
        total += w; pool.push({ id: id, w: w });
    }
    if (total <= 0) return null;
    let rand = Math.random() * total, acc = 0;
    for (let it of pool) { acc += it.w; if (rand <= acc) return it.id; }
    return pool[pool.length - 1].id;
}
// 時空裂痕出怪：依停留時間動態抽「等級範圍內」怪物（沿用既有怪定義，故經驗/掉落正常）
// 🌀 時空裂痕難度遞增：停留滿 30 分後，每多 1 整分鐘，怪物「攻擊力與技能傷害」+20%（線性·僅 rift_battle 內生效；30分=×1、31分=×1.2、60分=×7）
function riftDamageMult() {
    if (!state.riftRun) return 1;
    let minutes = Math.floor((Date.now() - (state.riftStartMs || Date.now())) / 60000);
    return 1 + 0.2 * Math.max(0, minutes - 30);
}
// 🔮 席琳的世界：怪物強化＋恩賜（spawnMob 與 spawnRiftMob 共用單一事實來源；時空裂痕也吃席琳世界）
function applySherineBuff(idx) {
    let _m = mapState.mobs[idx];
    if (!_m) return;
    // 攻城區與血盟敵人除外，其餘怪物強化＋報酬翻倍
    if (sherineWorldActive() && !isSiegeArea(mapState.current) && _m.race !== '血盟') {
        let _mad = sherineMadActive();   // 🔮 瘋狂的席琳世界：更高倍率（值＝[一般/瘋狂]）
        _m.hp = Math.floor(_m.hp * (_mad ? 5 : 3)); _m.curHp = _m.hp;   // HP×[3/5]
        _m.ac = Math.floor((_m.ac || 0) * (_mad ? 1.75 : 1.5));         // AC×[1.5/1.75]
        _m.mr = Math.floor((_m.mr || 0) * (_mad ? 3 : 1.5));            // MR×[1.5/3]
        _m.exp = Math.floor((_m.exp || 0) * (_mad ? 10 : 5));           // 經驗×[5/10]
        _m.goldMin = Math.floor((_m.goldMin || 0) * (_mad ? 10 : 5));   // 金錢×[5/10]
        _m.goldMax = Math.floor((_m.goldMax || 0) * (_mad ? 10 : 5));
        _m.hit = Math.floor((_m.hit || 0) * (_mad ? 2 : 1.5));          // 命中×[1.5/2]
        _m.dr = (_m.dr || 0) + Math.floor((_m.lv || 1) / 3);            // 額外減傷：等級/3（兩者相同）
        _m._sherine = true;   // 一般攻擊傷害×[2/3]、技能最終傷害×[2/3]、掉落×[3/5]、掉落附帶席琳詞綴／套裝效果
        if (_mad) _m._sherineMad = true;   // 🔮 瘋狂旗標：供傷害/掉落/結晶/套裝效果倍率分流
    }
}
// 🔮 席琳的恩賜：席琳的世界中每次刷新 1% 機率讓場上一隻怪獲得恩賜（血盟除外）
//  一般席琳＝原版：每 3 分鐘最多一次、場上同時僅一隻、頭目(王)不被祝福；🔥 瘋狂席琳：無 3 分鐘冷卻、無「同時一隻」限制、頭目(王)亦可被祝福
function applySherineGrace(idx) {
    let _mad = sherineMadActive();   // 🔥 瘋狂席琳：無冷卻、無「同時一隻」、含頭目；一般席琳維持原版三限制
    if (sherineWorldActive() && !isSiegeArea(mapState.current)
        && mapState.mobs[idx] && mapState.mobs[idx].race !== '血盟'
        && (_mad || state.ticks >= (mapState.graceCdAt || 0))
        && (_mad || !mapState.mobs.some(m => m && m._grace))
        && Math.random() < 0.01) {
        let _gc = mapState.mobs.filter(m => m && !m._dead && m.curHp > 0 && m.race !== '血盟' && !m._grace && (_mad || !m.boss));   // 一般：排除頭目；瘋狂：含頭目；!m._grace：已恩賜的怪不可再被選中（防瘋狂模式對同一隻 boss 重複 ×10 HP 爆炸）
        if (_gc.length) {
            let g = _gc[Math.floor(Math.random() * _gc.length)];
            g._grace = true;
            g.hp = Math.floor(g.hp * 10); g.curHp = g.hp;        // HP×10 並完全恢復
            g.exp = Math.floor((g.exp || 0) * 10);
            g.goldMin = Math.floor((g.goldMin || 0) * 10);
            g.goldMax = Math.floor((g.goldMax || 0) * 10);
            if (!_mad) mapState.graceCdAt = state.ticks + 1800;  // 3 分鐘冷卻只在一般席琳設定（瘋狂無冷卻）
            logSys(`<span class="grace-badge font-bold">✦ 席琳的恩賜降臨！</span><span class="c-sherine font-bold">${g.n}</span><span class="text-red-300"> 獲得了席琳的力量……擊敗它以奪取豐厚的報酬！</span>`);
        }
    }
}
function spawnRiftMob(idx) {
    let elapsedSec = (Date.now() - (state.riftStartMs || Date.now())) / 1000;
    let inc = Math.floor(elapsedSec / 30);                 // 每 30 秒範圍 +1
    let minLv = Math.min(40, 1 + inc);                     // 最低封頂 40
    let maxLv = Math.min(100, 40 + inc);                   // 最高封頂 100
    let isBoss;
    if (elapsedSec >= 1200) {                              // 20 分後：每次 50/50 抽一般/頭目
        isBoss = Math.random() < 0.5;
    } else {                                               // 20 分內：一般怪為主，每 5 分鐘強制一隻頭目（不限場上頭目數）
        if (Date.now() >= (state.riftBossDue || Infinity)) { isBoss = true; state.riftBossDue = Date.now() + 300000; }
        else isBoss = false;
    }
    let mobId = pickRiftMob(isBoss, minLv, maxLv, elapsedSec) || pickRiftMob(!isBoss, minLv, maxLv, elapsedSec);
    if (!mobId) return;
    let base = DB.mobs[mobId];
    mapState.mobs[idx] = { ...base, curHp: base.hp, uid: uid(), _magCd: {}, justHit: false, st: newMobStatus() };
    applySherineBuff(idx);   // 🔮 時空裂痕也吃席琳世界：怪物強化＋_sherine（詞綴／×3掉／×2傷由 _sherine 帶動）；須在 initHardSkin 前
    if (mapState.mobs[idx].hard) initHardSkin(mapState.mobs[idx]);
    applySherineGrace(idx);   // 🔮 席琳的恩賜（1% 機率）
    if (!state.ff) renderMobs();
}
function pickRiftMob(boss, minLv, maxLv, elapsedSec) {
    let dragonOnField = mapState.mobs.some(m => m && RIFT_DRAGON_NAMES.includes(m.n));
    let pool = [];
    for (let id in DB.mobs) {
        let m = DB.mobs[id];
        if (!m || typeof m.lv !== 'number') continue;
        if (!!m.boss !== !!boss) continue;
        if (m.lv < minLv || m.lv > maxLv) continue;
        if (m.siegeEnemy || m.pledgeEnemy || m.race === '建築' || id === 'kari') continue;   // 排除攻城/血盟/建築/卡瑞
        if (RIFT_DRAGONS.includes(id)) {
            if (elapsedSec < 1800) continue;     // 四大龍：30 分後才入池
            if (dragonOnField) continue;          // 場上至多 1 隻四大龍
        }
        pool.push(id);
    }
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}
function renderRiftEntrance(container) {
    let rankBlock = (r, sherine) => {
        r = r || { best: null, last: null, isNew: false };
        let lastTxt = r.last ? `停留時間 ${fmtPrideTime(r.last.ms)}` : '尚無紀錄';
        let bestTxt = r.best ? `停留時間 ${fmtPrideTime(r.best.ms)}` : '尚無紀錄';
        let newBadge = (r.isNew && r.best) ? ' <span class="text-yellow-300 font-bold animate-pulse">new</span>' : '';
        let titleCls = sherine ? 'c-sherine' : 'text-amber-300';
        let bodyCls = sherine ? 'text-green-300' : 'text-slate-200';
        let title = sherine ? '排名紀錄（席琳的世界）' : '排名紀錄（一般）';
        return `<div class="bg-slate-900/70 border ${sherine ? 'border-green-700/60' : 'border-slate-700'} rounded-lg p-3 text-sm leading-relaxed">
            <div class="${titleCls} font-bold mb-1">${title}</div>
            <div class="${bodyCls}">本次紀錄　${lastTxt}</div>
            <div class="${bodyCls}">最高紀錄　${bestTxt}${newBadge}</div>
        </div>`;
    };
    let cores = riftCoreCount();
    let pending = (player.riftRewardMs != null);
    let box = document.createElement('div');
    box.className = 'w-full mt-2 flex flex-col gap-3';
    box.innerHTML = `
        <button onclick="enterRift()" class="btn w-full py-4 text-xl font-bold bg-violet-800 hover:bg-violet-700 border border-violet-400 text-white shadow-lg">🌀 進入時空裂痕</button>
        <button onclick="claimRiftReward()" class="btn w-full py-4 text-xl font-bold ${pending ? 'bg-amber-700 hover:bg-amber-600 border-amber-400' : 'bg-slate-700 border-slate-500'} text-white shadow-lg">🎁 領取獎勵${pending ? '（可領取）' : '（無）'}</button>
        ${rankBlock(player.riftRank, false)}
        ${player.classicMode ? '' : rankBlock(player.riftRankSherine, true)}
        <div class="text-slate-500 text-xs">進入需消耗 <span class="text-amber-300">1 顆 龜裂之核</span>（目前持有 ${cores}）。停留越久排名越前、獎勵越好；裂痕內無法傳送，離開後須先領取上次獎勵才能再次進入。${player.classicMode ? '' : '一般與席琳的世界排名各自獨立。'}</div>`;
    container.appendChild(box);
}

function checkLvUp() {
    let up = false;
    while(player.lv < 100 && player.exp >= getExpReq(player.lv)) {
        player.exp -= getExpReq(player.lv);   // 達到「升下一等所需經驗」即扣除該需求並升一級（非累積）
        player.lv++;
        if(player.lv >= 50) player.bonus++;
        up = true;
    }
    if (up) {
        logSys(`<span class="text-yellow-400 font-bold text-lg">★★★ 升級了！目前等級 ${player.lv} ★★★</span>`);
        calcStats();
        player.hp = player.mhp; player.mp = player.mmp;
        try { vfxLevelUp(); } catch(e){}   // ✨ VFX：升級慶祝
    }
}

function revive() {
    player.dead = false;
    player.statuses = { stun: 0, freeze: 0, stone: 0, poison: 0, poisonDmg: 0, poisonTick: 0, burn: 0, burnDmg: 0, burnTick: 0, scald: 0, scaldDmg: 0, scaldTick: 0, bleed: 0, bleedDmg: 0, bleedTick: 0, sleep: 0, silence: 0, paralyze: 0, magicseal: 0 };  // 復活清除所有異常(含中毒/灼燒/燙傷)，避免復活後立即被持續傷害再次擊殺
    player.summon = null; player.charmed = null; player.manualCd = {}; player.hot = null; player.buffs.sk_charm = 0;
    if (player.allies && player.allies.length) logSys('<span class="text-emerald-300">回城復活，協力傭兵仍在你身邊。</span>');   // 🔧 玩家死亡/復活不再解散傭兵，只有在傭兵公會選「解散」才會解除
    player.skills.forEach(s => { if(DB.skills[s] && DB.skills[s].summon) player.buffs[s] = 0; });   // 清除召喚 buff，避免復活後召喚消失卻長時間不自動重新召喚
    document.getElementById('btn-revive').classList.add('hidden');
    { let ip = document.getElementById('btn-revive-inplace'); if(ip) ip.classList.add('hidden'); }
    
    // 🗼 傲慢之塔：於塔中死亡回城復活 → 結束攀登（排名先依目前樓層結算）
    if (state.prideClimb) {
        if (state.prideRanked) prideRecord(state.prideFloor || 2);
        state.prideClimb = false; state.prideRanked = false; state.prideFloor = 0;
    }
    if (state.riftRun) riftEndRun();   // 🌀 裂痕內死亡：結算停留時間並產生待領獎勵
    if (state.oblivion) { state.oblivion = null; state._oblivionAdvance = false; }   // 🏝️ 旅程中死亡：回村並結束遺忘之島旅程
    // 👇 正確的新版起點邏輯
    let startMap = 'town_silver_knight';
    if (player.cls === 'mage') startMap = 'town_talking';
    else if (player.cls === 'elf') startMap = 'town_elf';
    else if (player.cls === 'dark') startMap = 'town_silent';
    else if (player.cls === 'illusion') startMap = 'town_hyperia';
    else if (player.cls === 'dragon') startMap = 'town_behemoth';
    else if (player.cls === 'warrior') startMap = 'town_heine';   // ⚔️ 戰士：海音
    else if (player.cls === 'royal') startMap = 'town_talking';   // 👑 王族：說話之島

    setMapSelectors(startMap);

    calcStats();
    changeMap(true);
    
    logSys(`<span class="text-green-300">一股神聖的力量將你的靈魂自虛空中召回，你在村莊甦醒了...</span>`);
    saveGame();   // 城鎮復活成功後自動存檔：固化死亡懲罰（傭兵解散、召喚清除等），避免重載又把狀態帶回
}

// 原地復活：返生術(消耗MP，無冷卻) 優先；否則用復活卷軸(消耗1張，設定15秒冷卻)。效果相同：恢復1~200 HP、不恢復MP、留在原地。
function reviveInPlace() {
    if(!player.dead) return;
    if((player.reviveScrollCd || 0) > 0) return;   // 冷卻中：返生術與復活卷軸都不可用
    let rk = DB.skills.sk_resurrection;
    let cost = rk ? player.d.getMpCost(rk.mp, rk.tier) : Infinity;
    let hasRez = player.skills.includes('sk_resurrection') && player.mp >= cost;
    let scroll = player.inv.find(i => i.id === 'scroll_revive');
    if(hasRez) {
        player.mp -= cost;   // 返生術：消耗MP，無冷卻
        logCombat('<span class="text-yellow-300 font-bold">返生術 發動！你從死亡邊緣原地復活了。</span>', 'heal');
    } else if(scroll) {
        scroll.cnt--;
        player.inv = player.inv.filter(i => i.cnt > 0);
        player.reviveScrollCd = 15;   // 復活卷軸：15秒冷卻（僅存活時倒數）
        logCombat('<span class="text-yellow-300 font-bold">復活卷軸 發動！你從死亡邊緣原地復活了。</span>', 'heal');
    } else {
        return;
    }
    player.dead = false;
    player.statuses = { stun: 0, freeze: 0, stone: 0, poison: 0, poisonDmg: 0, poisonTick: 0, burn: 0, burnDmg: 0, burnTick: 0, scald: 0, scaldDmg: 0, scaldTick: 0, bleed: 0, bleedDmg: 0, bleedTick: 0, sleep: 0, silence: 0, paralyze: 0, magicseal: 0 };  // 復活清除所有異常(含中毒/灼燒/燙傷)，避免死亡迴圈
    player.hp = Math.min(player.mhp, roll(1, 200));   // 返生術/復活卷軸相同：1~200 隨機 HP、不恢復 MP
    player.summon = null; player.charmed = null; player.manualCd = {}; player.hot = null; player.buffs.sk_charm = 0;
    player.skills.forEach(s => { if(DB.skills[s] && DB.skills[s].summon) player.buffs[s] = 0; });   // 清除召喚 buff，避免復活後召喚消失卻長時間不自動重新召喚
    document.getElementById('btn-revive').classList.add('hidden');
    { let ip = document.getElementById('btn-revive-inplace'); if(ip) ip.classList.add('hidden'); }
    calcStats(); updateUI();
    if (player.allies && player.allies.length) logSys('<span class="text-emerald-300">原地復活，協力傭兵仍在你身邊。</span>');
    saveGame();   // 原地復活成功後自動存檔（傭兵保留）
}

// 依條件決定是否顯示「原地復活」按鈕：未在冷卻中，且(學會返生術且MP足夠 或 持有復活卷軸)
function updateReviveInPlaceBtn() {
    let btn = document.getElementById('btn-revive-inplace');
    if(!btn) return;
    let onCd = (player.reviveScrollCd || 0) > 0;
    let rk = DB.skills.sk_resurrection;
    let cost = rk ? player.d.getMpCost(rk.mp, rk.tier) : Infinity;
    let hasRez = player.skills.includes('sk_resurrection') && player.mp >= cost;
    let hasScroll = player.inv.some(i => i.id === 'scroll_revive');
    if(player.dead && !onCd && (hasRez || hasScroll)) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
}

// ===================== 異常狀態 / 召喚物 / 手動技能 引擎 =====================