let _tabPointerDown = false, _tabWheelActive = false, _tabWheelTimer = null, _tabRebuildPending = false, _tabThrottleTimer = null;
let _tabScrollActive = false, _tabScrollTimer = null, _tabScrollSuppressUntil = 0, _tabRebuildForce = false;   // 🚀 捲動守衛（含觸控慣性/拖曳捲軸）
const TAB_REBUILD_THROTTLE_MS = 250;
const TAB_WHEEL_IDLE_MS = 180;   // 🚀 滾輪停止多久後才補做延後的重建
const TAB_SCROLL_IDLE_MS = 250;  // 🚀 捲動(scroll 事件)停止多久後才補做延後的重建
// 延後重建的統一補跑：期間若有 force 呼叫被延後,補跑也要 force(否則會漏掉簽章蓋不到的變化,如快速強化模式切換)
function _tabFlushPending() {
    if (!_tabRebuildPending) return;
    _tabRebuildPending = false;
    let f = _tabRebuildForce; _tabRebuildForce = false;
    renderTabs(f);
}
// 🔽 分頁/物品彈窗裡有原生 <select> 正展開（快速強化的目標等級）：重建會把該元素刪掉，玩家點開瞬間被關
const TAB_SELECT_HOSTS = '#tab-weapons,#tab-armors,#tab-items,#tab-equip,#tab-skill,#item-modal';
function _tabSelectOpen() {
    let ae = document.activeElement;
    return !!(ae && ae.tagName === 'SELECT' && ae.closest && ae.closest(TAB_SELECT_HOSTS));
}
// 🗑️⚡ 任一分頁的快速廢品/快速強化「選擇模式」進行中（renderTabs 的凍結守衛與 autoSortInventory 共用）
function _anyQuickSelectActive() {
    return quickJunk.wpn.active || quickJunk.arm.active || quickJunk.item.active || quickEnh.wpn.active || quickEnh.arm.active;
}
function _initTabGuard() {
    let panel = document.getElementById('tab-content-panel');
    if (!panel || panel._tabGuardInit) return;
    panel._tabGuardInit = true;
    panel.addEventListener('pointerdown', function(){ _tabPointerDown = true; });
    // 🚀 滾輪捲動期間：戰鬥掉落/扣箭若直接替換背包 DOM，會中斷瀏覽器的慣性捲動，物品越多越像整頁卡住。
    //    改為滾輪進行中把重建標記為 pending、延後到滾輪停止 180ms 後補一次（與 _tabPointerDown 拖曳守衛同理）。
    panel.addEventListener('wheel', function(){
        _tabWheelActive = true;
        if (_tabWheelTimer) clearTimeout(_tabWheelTimer);
        _tabWheelTimer = setTimeout(function(){
            _tabWheelTimer = null;
            _tabWheelActive = false;
            _tabFlushPending();
        }, TAB_WHEEL_IDLE_MS);
    }, { passive:true, capture:true });
    // 🚀 捲動守衛：pointer/wheel 蓋不到的兩個情境——①手機放開手指後的「慣性捲動」（pointerup 已過、清單還在滑,
    //    此時重建會換掉 viewport、慣性被截斷 → 滑動一頓一頓）②桌機拖曳捲軸（捲軌不觸發面板 pointerdown）。
    //    共同訊號是 scroll 事件（慣性期間持續觸發；scroll 不冒泡但走得到 capture）→ 捲動中把重建延後（連 force 都延後,
    //    掉卡/擊殺路徑的 force 重建才不會在捲動中硬插進來）,停止 250ms 後統一補跑。
    //    自家重建結束還原 scrollTop 也會觸發 scroll → 用 _tabScrollSuppressUntil 濾掉,避免每次重建都白進延後窗。
    panel.addEventListener('scroll', function(){
        if (performance.now() < _tabScrollSuppressUntil) return;
        _tabScrollActive = true;
        if (_tabScrollTimer) clearTimeout(_tabScrollTimer);
        _tabScrollTimer = setTimeout(function(){
            _tabScrollTimer = null;
            _tabScrollActive = false;
            _tabFlushPending();
        }, TAB_SCROLL_IDLE_MS);
    }, { passive:true, capture:true });
    let _release = function(){ if (!_tabPointerDown) return; _tabPointerDown = false; if (_tabRebuildPending) { setTimeout(_tabFlushPending, 0); } };   // 放開後(讓 click 先觸發)再補一次重建
    document.addEventListener('pointerup', _release);
    document.addEventListener('pointercancel', _release);
    // 🔽 下拉選單關閉後補做延後的重建。用 setTimeout 讓 inline onchange(更新 quickEnh.target)先跑完、
    //    元素也確實失焦後再重建；此時 _tabSelectOpen() 已為 false（若焦點跳到另一個 select 則 renderTabs 會再度延後）
    let _selectDone = function(e){
        let t = e.target;
        if (t && t.tagName === 'SELECT' && t.closest && t.closest(TAB_SELECT_HOSTS)) setTimeout(_tabFlushPending, 0);
    };
    document.addEventListener('change', _selectDone, true);
    document.addEventListener('blur', _selectDone, true);
}

// ===== 🎨 v3.0.55 1.8 原版風格技能魔法視窗（移植參考版 idle-lineage-class）=====
//   底圖 assets/ui/skill-window-1.8.png（1023×1537）＋左側階級指示 assets/ui/skill-level/539..548.png。
//   模式：一般（reqM 通用魔法·1~10 階 tier strip 導覽）／職業（各職 req 欄位技能）／裝備（頭盔授予）。
//   底部 S.power=玩家魔法傷害(player.d.magicDmg)、M.resist=玩家魔防(player.d.mr) 填入黑框。⚠️格 class 帶 tip-host 讓 Fable5 data-tip-skill tooltip 生效。
let classicSkillBookState = { mode: 'general', tier: 1, page: 0 };
function refreshClassicSkillBookOnly() {
    let div = document.getElementById('tab-skill');
    if (div) renderClassicSkillBook(div);
    if (typeof updateSummonLock === 'function') updateSummonLock();
}
function classicSkillChooseTier(tier) {
    classicSkillBookState.mode = 'general';
    classicSkillBookState.tier = Math.max(1, Math.min(10, parseInt(tier, 10) || 1));
    refreshClassicSkillBookOnly();
    requestAnimationFrame(function(){
        let view = document.querySelector('#tab-skill .classic-skill-grid-scroll');
        let first = document.querySelector('#tab-skill .classic-skill-cell[data-tier="' + classicSkillBookState.tier + '"]');
        if (view && first) view.scrollTop = Math.max(0, first.offsetTop);
    });
}
function classicSkillSelectTier(tier) {
    tier = Math.max(1, Math.min(10, parseInt(tier, 10) || 1));
    classicSkillBookState.tier = tier;
    let strip = document.querySelector('#tab-skill .classic-skill-tier-strip');
    if (strip) strip.style.backgroundImage = "url('assets/ui/skill-level/" + (538 + tier) + ".png')";
    let heading = document.querySelector('#tab-skill .classic-skill-heading');
    if (heading && classicSkillBookState.mode === 'general') heading.textContent = tier + '階一般魔法';
}
function classicSkillSyncTierFromScroll(view) {
    if (!view || classicSkillBookState.mode !== 'general') return;
    let cells = view.querySelectorAll('.classic-skill-cell[data-tier]');
    let line = view.scrollTop + Math.max(4, view.clientHeight * 0.12), tier = classicSkillBookState.tier;
    for (let cell of cells) {
        if (cell.offsetTop <= line) tier = parseInt(cell.dataset.tier, 10) || tier;
        else break;
    }
    if (tier !== classicSkillBookState.tier) classicSkillSelectTier(tier);
}
function classicSkillScrollRows(direction) {
    let view = document.querySelector('#tab-skill .classic-skill-grid-scroll');
    if (!view) return;
    view.scrollBy({ top:(direction < 0 ? -1 : 1) * (view.clientHeight / 8), behavior:'smooth' });
}
function classicSkillChooseMode(mode) {
    classicSkillBookState.mode = mode;
    classicSkillBookState.page = 0;
    refreshClassicSkillBookOnly();
}
function classicSkillClassLabel() {
    return ({ knight:'騎士技術', mage:'法師魔法', elf:'精靈魔法', dark:'黑妖魔法', illusion:'幻術魔法', dragon:'龍騎魔法', warrior:'戰士技能', royal:'王族魔法' })[player.cls] || '職業技能';
}
function classicSkillIsClassSkill(sk) {
    if (!sk || sk.procOnly) return false;
    if (player.cls === 'knight') return sk.reqK !== undefined && sk.reqM === undefined;
    if (player.cls === 'elf') return sk.reqE !== undefined && sk.reqM === undefined;
    if (player.cls === 'dark') return sk.reqD !== undefined;
    if (player.cls === 'illusion') return sk.reqI !== undefined && sk.reqM === undefined;
    if (player.cls === 'dragon') return sk.reqDk !== undefined && sk.reqM === undefined;
    if (player.cls === 'warrior') return sk.reqW !== undefined;
    if (player.cls === 'royal') return sk.reqRoy !== undefined;
    return false;
}
function renderClassicSkillBook(sDiv) {
    if (!sDiv || typeof player === 'undefined' || !player) return;
    let stateBook = classicSkillBookState;
    let allIds = Object.keys(DB.skills).filter(id => DB.skills[id] && !DB.skills[id].procOnly && id.indexOf('sk_helm_') !== 0);
    let accessibleGeneral = allIds.filter(id => { let sk = DB.skills[id]; return sk.reqM !== undefined && skillReqLv(sk, id) !== undefined; });
    let classSkills = allIds.filter(id => classicSkillIsClassSkill(DB.skills[id]));
    let granted = (player.grantedSkills || []).filter(id => DB.skills[id]);
    let classLabel = classicSkillClassLabel();
    if (stateBook.mode === 'class' && !classSkills.length) stateBook.mode = 'general';
    if (stateBook.mode === 'equipment' && !granted.length) stateBook.mode = 'general';
    if (stateBook.mode === 'general' && !accessibleGeneral.length && classSkills.length) stateBook.mode = 'class';   // 🔧 無一般魔法職業(騎士/戰士)→預設顯示職業技能，不留空白格

    let tierAvailable = new Set(accessibleGeneral.map(id => +DB.skills[id].tier));
    let list = [];
    if (stateBook.mode === 'class') list = classSkills.map(id => ({ id:id, tier:null }));
    else if (stateBook.mode === 'equipment') list = granted.map(id => ({ id:id, tier:null }));
    else {
        Array.from(tierAvailable).sort((a,b) => a-b).forEach(tier => {
            let group = accessibleGeneral.filter(id => +DB.skills[id].tier === tier).map(id => ({ id:id, tier:tier }));
            while (group.length % 4) group.push({ id:null, tier:tier });
            list.push.apply(list, group);
        });
    }
    while (list.length < 32) list.push({ id:null, tier:null });
    let cells = list.map(entry => {
        let id = entry.id;
        if (!id) return '<div class="classic-skill-cell classic-skill-empty"></div>';
        let sk = DB.skills[id];
        let learned = (player.skills || []).includes(id);
        let grantedSkill = granted.includes(id);
        let needLv = grantedSkill ? 0 : skillReqLv(sk, id);
        let elementOk = !sk.reqEle || player.elfEle === sk.reqEle;
        let elementChosen = !sk.reqEleAny || !!player.elfEle;
        let usable = learned && elementOk && elementChosen && (grantedSkill || needLv === undefined || player.lv >= needLv);
        let dim = learned ? (usable ? '' : ' classic-skill-unavailable') : ' classic-skill-unlearned';
        let img = '<img src="' + getIconUrl(sk, true) + '" onerror="this.style.display=\'none\';" alt="' + sk.n + '">';
        let tierAttr = entry.tier ? ' data-tier="' + entry.tier + '"' : '';
        let select = entry.tier ? 'classicSkillSelectTier(' + entry.tier + ');' : '';
        if (learned && usable && sk.type === 'manual') return '<button class="classic-skill-cell tip-host' + dim + '"' + tierAttr + ' data-tip-skill="' + id + '" title="' + sk.n + '" onclick="' + select + 'manualCast(\'' + id + '\')">' + img + '</button>';
        return '<div class="classic-skill-cell tip-host' + dim + '"' + tierAttr + ' data-tip-skill="' + id + '" title="' + sk.n + '" onclick="' + select + '">' + img + (!learned ? '<span class="classic-skill-lock">◆</span>' : '') + '</div>';
    }).join('');

    let tierButtons = '';
    for (let t = 1; t <= 10; t++) tierButtons += '<button class="classic-skill-tier-hit tier-' + t + (tierAvailable.has(t) ? '' : ' disabled') + '" ' + (tierAvailable.has(t) ? 'onclick="classicSkillChooseTier(' + t + ')"' : 'disabled') + ' title="' + t + '階一般魔法"></button>';
    let sprite = 538 + stateBook.tier;
    let modeButtons = '<button class="' + (stateBook.mode === 'general' ? 'active' : '') + '" onclick="classicSkillChooseMode(\'general\')">一般</button>'
        + (classSkills.length ? '<button class="' + (stateBook.mode === 'class' ? 'active' : '') + '" onclick="classicSkillChooseMode(\'class\')">' + (player.cls === 'elf' ? '精靈' : '職業') + '</button>' : '')
        + (granted.length ? '<button class="' + (stateBook.mode === 'equipment' ? 'active' : '') + '" onclick="classicSkillChooseMode(\'equipment\')">裝備</button>' : '');
    let heading = stateBook.mode === 'general' ? (stateBook.tier + '階一般魔法') : (stateBook.mode === 'equipment' ? '裝備授予魔法' : classLabel);
    let _spv = (player.d && player.d.magicDmg != null) ? Math.round(player.d.magicDmg) : 0;
    let _mrv = (player.d && player.d.mr != null) ? Math.round(player.d.mr) : 0;
    sDiv.innerHTML = '<div class="classic-skill-window">'
        + '<div class="classic-skill-heading">' + heading + '</div>'
        + '<div class="classic-skill-mode">' + modeButtons + '</div>'
        + '<div class="classic-skill-tier-strip" style="background-image:url(\'assets/ui/skill-level/' + sprite + '.png\')">' + tierButtons + '</div>'
        + '<div class="classic-skill-grid-scroll" onscroll="classicSkillSyncTierFromScroll(this)"><div class="classic-skill-grid">' + cells + '</div></div>'
        + '<button type="button" class="classic-skill-scroll classic-skill-scroll-up" aria-label="技能向上捲動" onclick="classicSkillScrollRows(-1)"></button>'
        + '<button type="button" class="classic-skill-scroll classic-skill-scroll-down" aria-label="技能向下捲動" onclick="classicSkillScrollRows(1)"></button>'
        + '<div class="classic-skill-stat classic-skill-stat-sp">' + _spv + '</div>'
        + '<div class="classic-skill-stat classic-skill-stat-mr">' + _mrv + '</div>'
        + '</div>';
}
// ===== 🚀 分區重建（2026-07-06 效能重構）=====
// 舊版任何變動（掉一件雜物、扣一支箭）都把五個分頁全部 innerHTML 重刻（裝備欄＋武器/防具/道具三清單×全背包＋技能書）,
// 背包大時一次重刻十幾 ms、戰鬥中最密每 250ms 一次。改為五區各自簽章,只重建內容真的變了的分頁：
//   掉雜物 → 只重刻「道具」頁；撿武器 → 只重刻「武器」頁；裝備欄/技能書沒變就完全不動。
// force=true 語意不變 = 全部重建（快速強化/廢品模式切換、傳統模式等「簽章蓋不到的顯示狀態」靠它保底）。
let _tabSecSig = { ctx:'', wpn:'', arm:'', item:'', eq:'' };
function renderTabs(force) {
    if(state.ff) return; // 補跑期間不刷新畫面
    // 🔽 下拉展開中：連 force 都延後（重建會刪掉那個 <select>，玩家點開的瞬間就被關掉）。
    //    選單關閉(change/blur)後由 _initTabGuard 補一次 force 重建，追上延後期間的背包變動。
    if(_tabSelectOpen()) { _tabRebuildPending = true; _tabRebuildForce = true; return; }
    // 🚀 使用者正按住分頁面板(點擊中)：延後非強制重建到放開後，避免按鈕被重繪掉而點擊失效
    if(!force && (_tabPointerDown || _tabWheelActive)) { _tabRebuildPending = true; return; }
    // 🚀 捲動中(含放開手指後的慣性、拖曳捲軸)：連 force 都延後（掉卡/擊殺路徑的 force 重建才不會在捲動途中
    //    硬換掉 viewport、截斷慣性造成頓挫），捲動停止 250ms 後由 _tabFlushPending 補跑（force 旗標保留）。
    if(_tabScrollActive) { _tabRebuildPending = true; if(force) _tabRebuildForce = true; return; }
    // 🗑️⚡ 快速廢品/快速強化「選擇模式」進行中：掉落等非強制重繪一律延後——重建會把整塊 DOM 換掉，
    //    手指還沒放開元素就被換走、點擊失效（玩家表現=物品一直跳動點不到）。使用者自身操作（勾選/全選/確認/取消）
    //    走 force 即時回饋；離開模式的 force 重繪把延後期間的掉落一次補上（_qjSync 已負責把新掉落納入面板狀態）。
    if(!force && _anyQuickSelectActive()) { _tabRebuildPending = true; return; }
    // 🚀 戰鬥 tick 內的高頻變動(扣箭/耗肉)：合併成一次重建(節流 250ms)，降低狩獵卡頓；使用者操作(非 tick)維持即時回饋
    if(!force && state.inTick) { if(!_tabThrottleTimer) _tabThrottleTimer = setTimeout(function(){ _tabThrottleTimer = null; renderTabs(); }, TAB_REBUILD_THROTTLE_MS); return; }
    if(_tabThrottleTimer) { clearTimeout(_tabThrottleTimer); _tabThrottleTimer = null; }
    // ===== 分區內容簽章：只重建簽章有變的分頁（沒變的完全不動,游標/捲動/點擊都不受影響） =====
    let dd = player.d;
    // ctx = 影響「所有分頁」列顯示的共用狀態：職業/等級/技能(無法裝備·可學習判定、裝備欄等級鎖)、
    //       基礎屬性和(裝備判定)、魔傷/魔防(技能書底部 S.power / M.resist)。ctx 一變 → 五頁全 dirty。
    let _ctx = `${player.cls}#${player.lv}#${(player.skills||[]).join(',')}#${(player.grantedSkills||[]).join(',')}#${player.elfEle||''}#${dd.str+dd.dex+dd.con+dd.int+dd.wis}#${dd.magicDmg||0}#${dd.mr||0}`;
    let _sw=[], _sa=[], _si=[];
    player.inv.forEach(i => {
        let d = DB.items[i.id]; if(!d) return;
        let s = itemSig(i) + '.' + (i.cnt||1) + '.' + (i.lock?1:0) + '.' + (i.junk?1:0);   // 🔧 架構#3：統一簽章（祝福/詛咒不會被壓扁）
        if(d.type === 'wpn') _sw.push(s); else if(d.type === 'arm' || d.type === 'acc') _sa.push(s); else _si.push(s);   // 與 _renderInvTabs 的分流一致
    });
    let _wSig=_sw.join(';'), _aSig=_sa.join(';'), _iSig=_si.join(';');
    let _eSig = Object.keys(player.eq).map(k => { let e = player.eq[k]; return e ? `${k}:${itemSig(e)}.${e.cnt||0}` : k+':'; }).join(',')
              + `#${dd.weightPct||0}.${dd.loadTier||0}#${JSON.stringify(player._sherineSetCnt||{})}`;   // 負重標頭與席琳套裝底色都畫在裝備分頁上
    let _ctxChanged = !!force || _ctx !== _tabSecSig.ctx;
    let _dirty = {
        eq:    _ctxChanged || _eSig !== _tabSecSig.eq,
        wpn:   _ctxChanged || _wSig !== _tabSecSig.wpn,
        arm:   _ctxChanged || _aSig !== _tabSecSig.arm,
        item:  _ctxChanged || _iSig !== _tabSecSig.item,
        skill: _ctxChanged
    };
    _tabSecSig = { ctx:_ctx, wpn:_wSig, arm:_aSig, item:_iSig, eq:_eSig };
    if(!_dirty.eq && !_dirty.wpn && !_dirty.arm && !_dirty.item && !_dirty.skill) return;
    // 只記住「要重建的」分頁捲動位置，重建後還原（避免跳回頂端）
    const _tabIds = { eq:'tab-equip', wpn:'tab-weapons', arm:'tab-armors', item:'tab-items', skill:'tab-skill' };
    let _scroll = {};
    Object.keys(_tabIds).forEach(k => { if(!_dirty[k]) return; let el = document.getElementById(_tabIds[k]); if(el) { let sc=el.querySelector('.classic-skill-grid-scroll'); _scroll[k] = sc ? sc.scrollTop : el.scrollTop; } });   // 捲動位置：技能頁存在內層 .classic-skill-grid-scroll（1.8技能視窗皮膚）；裝備/武器/防具/道具四分頁皮膚已移除,捲動在分頁容器本身

    if(_dirty.eq) _renderEquipTab();
    if(_dirty.wpn || _dirty.arm || _dirty.item) _renderInvTabs(_dirty);
    if(_dirty.skill) renderClassicSkillBook(document.getElementById('tab-skill'));   // 🎨 v3.0.55 1.8 原版風格技能魔法視窗

    // 還原捲動位置；程式還原 scrollTop 也會觸發 scroll 事件 → 先標記抑制窗,別讓捲動守衛把自家還原當成使用者捲動
    _tabScrollSuppressUntil = performance.now() + 120;
    Object.keys(_tabIds).forEach(k => { if(_scroll[k] == null) return; let el = document.getElementById(_tabIds[k]); if(el) { let sc=el.querySelector('.classic-skill-grid-scroll'); if(sc)sc.scrollTop=_scroll[k]; else el.scrollTop=_scroll[k]; } });
    updateSummonLock();
    if (typeof refreshEquipmentWindow === 'function') refreshEquipmentWindow();
}

// 裝備分頁：負重標頭＋各部位欄（套裝/席琳套裝底色）。由 renderTabs 依 _dirty.eq 呼叫。
function _renderEquipTab() {
    let eDiv = document.getElementById('tab-equip'); eDiv.innerHTML = '';
    { let _wd = player.d || {}; let _t = _wd.loadTier || 0; let _hdr = document.createElement('div'); _hdr.className = 'text-center py-0.5 mb-1 rounded bg-slate-900/60 border border-slate-700 text-sm font-bold leading-tight' + (_t >= 1 ? ' cursor-help' : ''); if (_t >= 1) { _hdr.title = _t === 1 ? '負重50%↑：HP/MP不自然恢復' : (_t === 2 ? '負重82%↑：HP/MP不自然恢復、停自動施法、攻速變慢' : '負重100%↑：HP/MP不自然恢復、停自動施法、攻速大幅變慢'); } _hdr.innerHTML = `<span class="text-slate-400">負重 </span><span class="${getLoadColor(_t)}">${_wd.weightPct||0}%</span>`; eDiv.appendChild(_hdr); }
    const slots = [{k:'wpn',n:'武器'}, ...((player.cls === 'warrior' && (player.skills.includes('sk_warrior_dualaxe') || player.eq.offwpn)) ? [{k:'offwpn',n:'副手武器'}] : []), {k:'shield',n:'副手'},{k:'helm',n:'頭盔'},{k:'armor',n:'盔甲'},{k:'tshirt',n:'T恤'},{k:'cloak',n:'斗篷'},{k:'gloves',n:'手套'},{k:'shin',n:'脛甲'},{k:'boots',n:'長靴'},{k:'amulet',n:'項鍊'},{k:'ear1',n:'耳環'},{k:'ear2',n:'耳環'},{k:'ring1',n:'戒指'},{k:'ring2',n:'戒指'},{k:'ring3',n:'戒指'},{k:'ring4',n:'戒指'},{k:'belt',n:'腰帶'},{k:'pet',n:'寵物裝備'},{k:'doll',n:'魔法娃娃'},{k:'arrow',n:'箭矢'},
        { sep: '🦴 席琳遺骸' }, ...SHERINE_REMAINS.map(r => ({ k: r.id, n: r.n, rem: true }))];   // ⚔️ offwpn：戰士學會迅猛雙斧後顯示副手武器欄；🦴 席琳遺骸 8 格接在最後（席琳套裝效果只看這 8 格）
    
    let setCheck = {}, _setSeen = {};
    for (let k in player.eq) {
        let e = player.eq[k];
        if(e) {
            let ed = DB.items[e.id];
            if(ed.set && !_setSeen[e.id]) { _setSeen[e.id] = true; setCheck[ed.set] = (setCheck[ed.set]||0) + 1; }   // 🔧 與 calcStats 一致：同款物品只計 1 件
        }
    }
    let activeSets = [];
    if(setCheck['leather'] >= 4) activeSets.push('leather');   // 皮套裝（補上底色判定）
    if(setCheck['bone'] >= 3) activeSets.push('bone');
    if(setCheck['dk'] >= 4) activeSets.push('dk');
    if(setCheck['silver'] >= 4) activeSets.push('silver');
    if(setCheck['oasis'] >= 4) activeSets.push('oasis');
    if(setCheck['gnome'] >= 3) activeSets.push('gnome');
    if(setCheck['mage'] >= 2) activeSets.push('mage');
    if(setCheck['kurt'] >= 4) activeSets.push('kurt');
    if(setCheck['mr'] >= 2) activeSets.push('mr');   // 抗魔套裝僅 2 件，門檻應為 2
    if(setCheck['guard'] >= 3) activeSets.push('guard');
    if(setCheck['steel'] >= 5) activeSets.push('steel');
    if(setCheck['kinglord'] >= 4) activeSets.push('kinglord');   // 🔧 四大軍王套裝：4 件齊→欄位底色亮起
    if(setCheck['demon'] >= 4) activeSets.push('demon');   // 🗼 惡魔套裝：4 件齊→欄位底色亮起
    if(setCheck['orin'] >= 2) activeSets.push('orin');   // 🔱 歐林西瑪套裝：2 件齊→欄位底色亮起
    if(setCheck['icequeen_charm'] >= 3) activeSets.push('icequeen_charm');   // ❄️👸 冰之女王魅力套裝：3 件齊→欄位底色亮起
    if(setCheck['frost'] >= 3) activeSets.push('frost');   // ❄️ 寒冰套裝：3 件齊→欄位底色亮起
    if(setCheck['bluepirate'] >= 4) activeSets.push('bluepirate');   // 🏴‍☠️ 藍海賊套裝：4 件齊→欄位底色亮起

    slots.forEach(s => {
        if (s.sep) {   // 🦴 遺骸區分隔標題
            let h = document.createElement('div');
            h.className = 'text-center text-sm font-bold text-slate-400 mt-2 mb-1 pt-2 border-t border-slate-700';
            h.innerText = s.sep;
            eDiv.appendChild(h);
            return;
        }
        let eq = player.eq[s.k];
        let isSetActive = false;
        if(eq && DB.items[eq.id].set && activeSets.includes(DB.items[eq.id].set)) isSetActive = true;
        // 🔮 席琳套裝：該欄的套裝效果組別達 2 件以上（觸發套裝能力）→ 欄位底色變綠
        //    🦴 一般裝備欄的舊 seteff 已不計入效果（_sherineSetCnt 只數遺骸欄），故底色只會在遺骸欄亮起
        let _grp = (eq && eq.seteff) ? eq.seteff.slice(0, 2) : null;
        let _setN = _grp ? ((player._sherineSetCnt && player._sherineSetCnt[_grp]) || 0) : 0;
        let isSherineActive = _setN >= 2;

        let el = document.createElement('div');
        // 🔧 底色優先序：席琳套裝(綠) > 舊套裝(琥珀金，原綠色讓給席琳) > 一般
        //    🦴 遺骸欄的發光強度分 2/3/5 件三階，走 css/style.css 的 .rem-lit/.rem-tier-N（Tailwind 是 purge 過的建置檔，新的任意值 class 不會存在）
        el.className = `list-item text-base rounded mb-1 ${s.rem ? 'rem-slot ' : ''}${isSherineActive
            ? (s.rem ? `bg-green-900 rem-lit rem-tier-${_setN >= 5 ? 5 : (_setN >= 3 ? 3 : 2)}` : 'bg-green-900 border border-green-400 ring-1 ring-green-400/60 shadow-[0_0_10px_rgba(74,222,128,0.6)]')
            : (isSetActive ? 'bg-amber-900 border border-amber-400 ring-1 ring-amber-400/60 shadow-[0_0_10px_rgba(245,158,11,0.55)]' : 'bg-slate-800')}`;
        if(eq) {
            let d = DB.items[eq.id];
            let imgUrl = getIconUrl(d);
            // 👇 判斷如果裝備本身是祝福的，或者物品基底(卷軸)是祝福的，就套用螢光特效
            let glowClass = getGlowClass(eq, d);
            let imgHtml = `<img src="${imgUrl}" onerror="this.style.opacity='0';" class="w-6 h-6 ml-2 object-contain pointer-events-none ${glowClass}">`;
            let _pg = s.rem ? `<span class="text-xs ${isSherineActive ? 'text-green-300' : 'text-slate-500'} mr-2">${Math.min(5, _setN)}/5</span>` : '';   // 🦴 遺骸欄顯示該組共鳴進度
            el.innerHTML = `<span class="text-slate-400 w-12">${s.n}</span><div class="flex items-center justify-end flex-1">${_pg}<span class="${getItemColor(eq)} text-right font-bold">${getItemFullName(eq)}</span>${imgHtml}</div>`;
            el.onclick = () => openModal(eq, true, s.k);
        } else {
            let _rlv = (s.k === 'ring3') ? 55 : (s.k === 'ring4') ? 65 : (s.k === 'ear2') ? 50 : 0;   // 🔧 第3/4戒指欄、第2耳環欄等級需求
            let _locked = _rlv && player.lv < _rlv;
            el.innerHTML = `<span class="text-slate-400 w-12">${s.n}</span><span class="${_locked ? 'text-red-400' : 'text-slate-600'}">${_locked ? '需 Lv' + _rlv : '- 空 -'}</span>`;
        }
        eDiv.appendChild(el);
    });
}

// 清空分頁內容，但保留標記 data-afk-persist 的常駐節點（背包搜尋框）：整塊 innerHTML='' 會連輸入框一起砍掉，
// 打怪掉東西觸發重建時輸入框被換新 → 手機打字打到一半焦點與軟鍵盤被中斷（玩家回報打不進字）。
function _clearInvTab(div) {
    for (let i = div.children.length - 1; i >= 0; i--) {
        let c = div.children[i];
        if (!c.dataset || c.dataset.afkPersist !== '1') div.removeChild(c);
    }
}
// 武器/防具/道具三清單：一趟走完背包,但只重建 _dirty 標記的分頁（掉雜物就只刻「道具」頁,武器/防具不動）。
function _renderInvTabs(_dirty) {
    let wDiv = null, aDiv = null, iDiv = null;
    // ⚡🗑️ 快速操作頭部：武器/防具分頁＝[快速強化][快速廢品]；道具分頁＝[快速廢品]（插在常駐節點之前，維持 [頭部][搜尋框][清單] 的順序）
    if(_dirty.wpn)  { wDiv = document.getElementById('tab-weapons'); _clearInvTab(wDiv); wDiv.insertBefore(buildQuickHeader('wpn'), wDiv.firstElementChild); }
    if(_dirty.arm)  { aDiv = document.getElementById('tab-armors');  _clearInvTab(aDiv); aDiv.insertBefore(buildQuickHeader('arm'), aDiv.firstElementChild); }
    if(_dirty.item) { iDiv = document.getElementById('tab-items');   _clearInvTab(iDiv); iDiv.insertBefore(buildQuickHeader('item'), iDiv.firstElementChild); }

player.inv.forEach(i => {
    if(!DB.items[i.id]) return;
    let d = DB.items[i.id];

    // 🎯 物品分流：先決定去哪個分頁,該分頁這次沒變(_dirty=false)就直接跳過,不白刻
    let _dest = (d.type === 'wpn') ? wDiv : (d.type === 'arm' || d.type === 'acc') ? aDiv : iDiv;
    if(!_dest) return;

    // ===== 視覺狀態判定 =====
    let statusTag = '';
    let itemBg = 'bg-slate-800'; // 預設背景

    if (d.type === 'skillbk') {
        let sk = DB.skills[d.sk];
        // 檢查該技能是否屬於該職業可學習範圍
        let isClsPossible = skillReqLv(sk, d.sk) !== undefined;   // 🏅 集中化：含魔導精通特例
        
        if (player.skills.includes(d.sk)) {
            statusTag = '<span class="text-slate-500 text-[10px] font-bold">[已學習]</span>';
            itemBg = 'bg-slate-900 opacity-70'; // 已學習變暗
        } else if (!isClsPossible) {
            statusTag = '<span class="text-red-500 text-[10px] font-bold">[無法學習]</span>';
            itemBg = 'bg-red-950/40'; // 職業不符顯示暗紅色底
        }
    } 
    // 2. 裝備職業穿著判定 (修正版)
    else if (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') {
    // 👇 呼叫我們剛剛定義的共用判定函數，這樣就完美支援「負重強化」了！
    let canEquip = checkCanEquip(i);
    
    if (!canEquip) {
        statusTag = '<span class="text-red-500 text-[10px] font-bold">[無法裝備]</span>';
        itemBg = 'bg-red-950/40'; // 職業/技能不符，顯示暗紅色底
    }
}

    // ===== 渲染物品 =====
    let el = document.createElement('div'); 
    // className 這裡移除了 isDisabled 相關的判定，讓所有項目都可以互動
    el.className = `list-item text-base ${itemBg} rounded mb-1 ${i.lock ? 'border-red-900 border-2' : ''}`;
    
    // 判斷如果背包裡的物品是祝福的，套用螢光特效
    let imgUrl = getIconUrl(d);
    let glowClass = getGlowClass(i, d);
    let imgHtml = `<img src="${imgUrl}" onerror="this.style.opacity='0';" class="w-6 h-6 object-contain pointer-events-none ${glowClass}">`;
    
    // 內容組合 (加入了 statusTag)
    let _rowInner = `<div class="flex items-center gap-2">${imgHtml}<span class="${getItemColor(i)} font-bold">${getItemFullName(i)}</span> ${statusTag} ${i.lock ? '<span class="text-xs text-red-500">[🔒]</span>' : ''} ${(i.junk && !i.lock) ? '<span class="text-xs text-amber-400 font-bold">[廢]</span>' : ''}</div>`;

    // ⚡ 快速強化模式：對應分頁啟用且為可強化裝備（未鎖定）時，右側顯示勾選欄，點整列切換勾選
    let _qeType = (d.type === 'wpn' && !d.isArrow) ? 'wpn' : ((d.type === 'arm' || d.type === 'acc') ? 'arm' : null);
    let _qjType = (d.type === 'wpn') ? 'wpn' : ((d.type === 'arm' || d.type === 'acc') ? 'arm' : 'item');   // 🗑️ 快速廢品分頁歸屬（含箭矢→武器分頁、其餘→道具分頁）
    if (_qeType && quickEnh[_qeType].active && !i.lock && !traditionalActive()) {   // 🏛️ 傳統模式：不顯示快速強化勾選列
        let _checked = !!quickEnh[_qeType].sel[i.uid];
        el.innerHTML = `<div class="flex items-center justify-between gap-2">${_rowInner}<input type="checkbox" class="pointer-events-none w-4 h-4 mr-1 flex-shrink-0" ${_checked ? 'checked' : ''}></div>`;
        if (_checked) el.className += ' ring-2 ring-blue-500/70';
        el.onclick = () => toggleQuickItem(_qeType, i.uid);
    } else if (quickJunk[_qjType].active && !i.lock) {
        let _checked = !!quickJunk[_qjType].sel[i.uid];
        el.innerHTML = `<div class="flex items-center justify-between gap-2">${_rowInner}<input type="checkbox" class="pointer-events-none w-4 h-4 mr-1 flex-shrink-0" ${_checked ? 'checked' : ''}></div>`;
        if (_checked) el.className += ' ring-2 ring-amber-500/70';
        el.onclick = () => toggleQuickJunkItem(_qjType, i.uid);
    } else {
        el.innerHTML = _rowInner;
        // 🖱️ v3.0.38 雙擊快速操作（用戶要求）：可使用型道具（藥水/卷軸/技能書/有效果的 misc）雙擊直接使用、
        //    裝備（武器/防具/飾品）雙擊直接裝備（equipItem 內建 checkCanEquip 職業判定）。
        //    單擊延遲 230ms 才開 Modal（雙擊時取消·同 js/19 裝備視窗側欄 clickTimer 模式）；回憶蠟燭維持單擊進配點重置（排除雙擊使用）。
        const _dblAct = (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') ? 'equip'
            : ((i.id !== 'candle' && (d.type === 'pot' || d.type === 'skillbk' || d.type === 'scroll' || (d.type === 'misc' && d.eff && !d.noUse))) ? 'use' : null);
        if (_dblAct) {
            el.onclick = () => { clearTimeout(window._invClickTimer); window._invClickTimer = setTimeout(() => openModal(i, false), 230); };
            el.ondblclick = (ev) => {
                clearTimeout(window._invClickTimer);
                ev.preventDefault(); ev.stopPropagation();
                if (_dblAct === 'equip') equipItem(i); else useItem(i.uid);
            };
        } else {
            // 保留點擊開啟 Modal 功能 (所有項目皆可點擊)
            el.onclick = () => openModal(i, false);
        }
    }
    
    _dest.appendChild(el);   // 🎯 物品分流（_dest 已在迴圈開頭依 type 決定）
});
}
// 🎨 1.8 八格框道具欄皮膚（decorateClassicInventoryTab）已依使用者要求移除（2026-07-06）：
//    裝備/武器/防具/道具四分頁還原為無背景的原始清單；技能書分頁的 1.8 技能視窗皮膚保留。
//    css/style.css 的 .classic-inventory-* 規則因無元素套用而自然失效，留檔無害。

// ===== 召喚類技能互斥：迷魅 / 召喚 / 造屍 / 召喚屬性精靈 / 召喚強力屬性精靈 同時只能開啟一個 =====
const SUMMON_BUFF_IDS = ['sk_zombie', 'sk_summon', 'sk_elf_summon', 'sk_elf_summon2'];
function summonBuffChecked() {
    for (let id of SUMMON_BUFF_IDS) { let c = document.getElementById('auto-sk-' + id); if (c && c.checked) return id; }
    return null;
}
function updateSummonLock() {
    let checkedBuff = summonBuffChecked();
    // 4 個召喚增益勾選框：已勾選一個→其餘三個鎖定（迷魅可與召喚並存，不互鎖）
    SUMMON_BUFF_IDS.forEach(id => {
        let c = document.getElementById('auto-sk-' + id);
        if (!c) return;
        let unavail = c.dataset.unavail === '1';
        let lock = checkedBuff ? (checkedBuff !== id) : false;
        c.disabled = unavail || lock;
        let lbl = c.closest('label');
        if (lbl) lbl.classList.toggle('opacity-50', unavail || lock);
    });
    // 迷魅按鈕：不再被召喚鎖定（可並存），僅受自身等級/條件限制
    let charmBtn = document.getElementById('manual-btn-sk_charm');
    if (charmBtn) {
        let unavail = charmBtn.dataset.unavail === '1';
        charmBtn.disabled = unavail;
        charmBtn.classList.toggle('opacity-50', unavail);
        charmBtn.classList.toggle('cursor-not-allowed', unavail);
    }
}
function onSummonToggle(sid) {
    let c = document.getElementById('auto-sk-' + sid);
    if (c && c.checked) {
        // 4 召喚互斥：只能勾一個，取消其他三個（不影響迷魅，可並存）
        SUMMON_BUFF_IDS.forEach(id => { if (id !== sid) { let o = document.getElementById('auto-sk-' + id); if (o) o.checked = false; } });
    } else {
        // 🔧 取消打勾：該召喚狀態馬上結束（不等增益自然倒數 3600 秒）
        player.buffs[sid] = 0;
        if (player.summon && player.summon.skId === sid) {
            logCombat(`<span class="text-purple-300">${player.summon.n}</span> 消失了。`, 'magic', 'summon');
            player.summon = null;
            calcStats();
            renderStatusEffects();
        }
        if (typeof summonV2DismissAll === 'function' && ((player._summonV2Sk || 'sk_summon') === sid)) summonV2DismissAll();   // 🧙 取消勾選 → v2 召喚物也解散（並關掉自動重施）
    }
    updateSummonLock();
}
// 🐉 覺醒互斥（無覺醒精通）：勾選一種覺醒 → 自動取消另外兩種，並重繪（重繪會把未勾選的兩種設為 disabled 鎖定）；有覺醒精通(k_awaken)則三種可並存、不鎖
function onAwakenToggle(sid) {
    let c = document.getElementById('auto-sk-' + sid);
    if (c && c.checked && player.mastery !== 'k_awaken') {
        ['sk_dragon_awaken_antares','sk_dragon_awaken_falion','sk_dragon_awaken_baraka'].forEach(id => {
            if (id !== sid) { let o = document.getElementById('auto-sk-' + id); if (o) o.checked = false; }
        });
    } else if (c && !c.checked) {
        endAutoBuffNow(sid);   // 🔧 取消打勾：該覺醒立即結束（不等自然倒數；HP/MP 消耗也隨之停止）
    }
    renderSkillSelects();
}
// 🔧 取消打勾即「立即結束」對應的自動輔助增益（不等自然倒數）。回傳是否真的結束了某效果。供 buff 技能 / HoT 治癒 / 覺醒 共用。
function endAutoBuffNow(sid) {
    let sk = DB.skills[sid]; if (!sk) return false;
    let ended = false;
    if (sk.type === 'heal' && sk.autoBuff) {   // HoT 治癒（體力回復術/生命的祝福）：清掉該技能的團隊持續回復（全隊一併停止該 HoT）
        if (player.hots && player.hots[sid]) { delete player.hots[sid]; ended = true; }
    } else {   // 一般 buff 技能（立方/火牢/冰雪颶風/日光/暗隱/力盔敏盔/覺醒…）：歸零該增益計時
        if ((player.buffs[sid] || 0) > 0) { player.buffs[sid] = 0; ended = true; }
    }
    if (ended) { if (typeof calcStats === 'function') calcStats(); if (typeof renderStatusEffects === 'function') renderStatusEffects(); if (typeof updateUI === 'function') updateUI(); }
    return ended;
}
// 一般 buff/HoT 勾選框（auto-sk-*，非召喚/覺醒/淨化）的 onchange：取消打勾即立即結束
function onAutoBuffToggle(sid) {
    let c = document.getElementById('auto-sk-' + sid);
    if (c && !c.checked) endAutoBuffNow(sid);
}
// 🔧 藥水/卷軸類維持型增益（靜態勾選框 set-*）：取消打勾即立即結束對應 buff（不等自然倒數）。於 window.onload 掛一次（勾選框是靜態 DOM、持久存在）。
const POTION_BUFF_ENDERS = [['set-haste','haste'],['set-brave','brave'],['set-blue','blue'],['set-cautious','cautious'],['set-elfcookie','elfcookie'],['set-poly','poly'],['set-magicbarrier','sk_magic_shield']];
function wireBuffEnders() {
    POTION_BUFF_ENDERS.forEach(function(pair){
        let el = document.getElementById(pair[0]);
        if (el && !el._buffEnderWired) {
            el._buffEnderWired = true;
            el.addEventListener('change', function(){
                if (!el.checked && player.buffs && (player.buffs[pair[1]] || 0) > 0) {
                    player.buffs[pair[1]] = 0;   // 🔧 取消打勾：加速/勇敢/慎重/精靈餅乾/變身/魔法護盾立即失效（變身會在 calcStats 還原原形）
                    if (typeof calcStats === 'function') calcStats();
                    if (typeof renderStatusEffects === 'function') renderStatusEffects();
                    if (typeof updateUI === 'function') updateUI();
                }
            });
        }
    });
}

function renderSkillSelects() {
    // 先記住目前選擇，重建後還原（避免穿脫裝備/學技能等呼叫時被重設為「無」）
    let prevAtk = document.getElementById('sel-atk-skill') ? document.getElementById('sel-atk-skill').value : '';
    let prevHeal = document.getElementById('sel-heal-skill') ? document.getElementById('sel-heal-skill').value : '';
    let prevConvert = document.getElementById('sel-convert-skill') ? document.getElementById('sel-convert-skill').value : '';
    let aHtml = '<option value="">無</option>', hHtml = '<option value="">無</option>', cHtml = '<option value="">無</option>';
    let buffHtml = '';
    let sortedSkills = [...player.skills].filter(s => DB.skills[s] && !DB.skills[s].procOnly).sort((a,b) => DB.skills[a].tier - DB.skills[b].tier);   // 🏛️ 過濾 procOnly（惡魔之吻等純武器proc：不顯示於施放下拉/勾選）
    
    sortedSkills.forEach(sid => {
        let sk = DB.skills[sid];
        let isAvail = true;
        let __granted = player.grantedSkills && player.grantedSkills.includes(sid);
        let needLv = skillReqLv(sk, sid);   // 🏅 集中化：含魔導精通特例
        if(!__granted && (needLv === undefined || player.lv < needLv)) isAvail = false;
        if(!__granted && sk.reqEle && player.elfEle !== sk.reqEle) isAvail = false;
        if(!__granted && sk.reqEleAny && !player.elfEle) isAvail = false;
        
        let dis = isAvail ? '' : 'disabled class="text-slate-500"';
        
        if(sk.type === 'atk' && !sk.healSlot) aHtml += `<option value="${sid}" ${dis}>${sk.n}</option>`;
        if((sk.type === 'heal' && !sk.autoBuff && !['sk_antidote','sk_holy_light','sk_cancel'].includes(sid)) || (sk.type === 'atk' && sk.healSlot)) hHtml += `<option value="${sid}" ${dis}>${sk.n}</option>`;
        let __isPurify = (sid === 'sk_antidote' || sid === 'sk_holy_light' || sid === 'sk_cancel');
        if(sk.type === 'buff' || (sk.type === 'heal' && sk.autoBuff) || __isPurify) {
            let checked = document.getElementById(`auto-sk-${sid}`)?.checked ? 'checked' : '';
            let sumAttr = sk.summon ? ` onchange="onSummonToggle('${sid}')" data-summon="1" data-unavail="${isAvail?'0':'1'}"` : '';
            // 魔法相消術涵蓋解毒術與聖潔之光：勾選相消時鎖定這兩者
            let __cancelOn = player.skills.includes('sk_cancel') && document.getElementById('auto-sk-sk_cancel')?.checked;
            let __locked = (sid === 'sk_antidote' || sid === 'sk_holy_light') && __cancelOn;
            // 🐉 覺醒互斥（無覺醒精通）：已勾選一種覺醒時，鎖定另外兩種「未勾選」的覺醒；已勾選那一個維持可點以便取消
            let __awakenLocked = sk.awaken && player.mastery !== 'k_awaken' && !document.getElementById('auto-sk-'+sid)?.checked && ['sk_dragon_awaken_antares','sk_dragon_awaken_falion','sk_dragon_awaken_baraka'].some(a => document.getElementById('auto-sk-'+a)?.checked);
            let __awakenAttr = sk.awaken ? ` onchange="onAwakenToggle('${sid}')"` : '';
            let __dis = (!isAvail || __locked || __awakenLocked) ? 'disabled' : '';
            let __purAttr = (sid === 'sk_cancel') ? ` onchange="renderSkillSelects()"` : '';
            // 🔧 一般 buff / HoT 治癒（非召喚/覺醒/淨化）：取消打勾即立即結束（召喚/覺醒已各自有 onchange；淨化為反應式無常駐增益）
            let __autoBuffAttr = (!__isPurify && !sk.summon && !sk.awaken && (sk.type === 'buff' || (sk.type === 'heal' && sk.autoBuff))) ? ` onchange="onAutoBuffToggle('${sid}')"` : '';
            let __span = __isPurify ? 'text-teal-300' : 'text-purple-300';
            let __ttl = __locked ? ' title="魔法相消術已涵蓋此效果"' : (__awakenLocked ? ' title="同時只能使用一種覺醒（需「覺醒精通」才能三種並用）"' : '');
            // 🧙 召喚術：戴召喚控制戒指可挑要召什麼（沒戴就顯示目前會召的預設）
            let __sumSel = '';
            if (sid === 'sk_summon' && isAvail && typeof summonV2ActiveForm === 'function') {
                let __ring = (typeof hasSummonCtrlRing === 'function') && hasSummonCtrlRing(player);
                let __cur = summonV2ActiveForm() || '—';
                __sumSel = __ring
                    ? ` <button onclick="openSummonSelect()" class="text-cyan-300 underline" style="font-size:11px;" title="召喚控制戒指：挑選要召喚的怪">［${__cur}］</button>`
                    : ` <span class="text-slate-500" style="font-size:11px;" title="裝備召喚控制戒指才能挑選">［${__cur}］</span>`;
            }
            buffHtml += `<label class="cursor-pointer flex items-center gap-2 ${(isAvail && !__locked && !__awakenLocked)?'':'opacity-50'}"${__ttl}><input type="checkbox" id="auto-sk-${sid}" ${checked} ${__dis}${sumAttr}${__awakenAttr}${__purAttr}${__autoBuffAttr}> <span class="${__span}">${sk.n}</span>${__sumSel}</label>`;
        }
        if(sk.type === 'convert') {
            if (needLv !== undefined) cHtml += `<option value="${sid}" ${dis}>${sk.n}</option>`;   // 🔧 該職業無法學習的轉換技直接不顯示（如法師的心靈轉換/魂體轉換）；等級未達者仍顯示為灰字
        }
    });
    
    document.getElementById('sel-atk-skill').innerHTML = aHtml;
    document.getElementById('sel-heal-skill').innerHTML = hHtml;
    // 還原先前選擇（該技能選項仍存在才還原；已不可用則自然回到「無」）
    let _atkEl = document.getElementById('sel-atk-skill');
    let _healEl = document.getElementById('sel-heal-skill');
    if(prevAtk && _atkEl.querySelector(`option[value="${prevAtk}"]`)) _atkEl.value = prevAtk;
    if(prevHeal && _healEl.querySelector(`option[value="${prevHeal}"]`)) _healEl.value = prevHeal;
    let _convEl = document.getElementById('sel-convert-skill');
    if(_convEl) {
        _convEl.innerHTML = cHtml;
        if(prevConvert && _convEl.querySelector(`option[value="${prevConvert}"]`)) _convEl.value = prevConvert;
    }
    let _convRow = document.getElementById('ui-convert-row');
    if(_convRow) _convRow.classList.toggle('hidden', player.cls !== 'elf' && player.cls !== 'mage' && !(player.cls === 'royal' && hasMastery('k_royal_magic')));   // 🔧 轉換技能設置開放給法師/妖精；👑 王族（魔法精通）也開放以使用魔力奪取
    document.getElementById('auto-buff-skills').innerHTML = buffHtml;
    updateSummonLock();
    if (typeof wireBuffEnders === 'function') wireBuffEnders();   // 🔧 確保藥水/卷軸維持型增益勾選框已掛「取消打勾即結束」監聽（_buffEnderWired 守衛→重複呼叫零成本）
}

// 1. 定義輔助函數 (請確保它在 openModal 外面或上方)
function formatBonus(val) {
    return val >= 0 ? `+${val}` : `${val}`;
}

// 武器種類標籤（單手劍 / 武士刀 / 匕首）；武士刀與瑟魯基之劍同時具單手劍與武士刀
const WEAPON_TAGS = {
    wpn_katana: ['單手劍','武士刀'], wpn_siruge: ['單手劍','武士刀'], wpn_golden_scepter: ['單手劍','武士刀'],   // 👑 黃金權杖：反擊＋居合（雙標籤·裝真盾→反擊、無盾→居合）
    wpn_cursed_emperor_blade:['單手劍','武士刀'],   // 🌑 受詛咒的真．冥皇執行劍：反擊(單手劍)＋居合(武士刀)·貫穿=ignHardSkin·裝備變身死亡騎士(js/02)
    wpn_uncursed_emperor_blade:['單手劍','武士刀'],   // 🌑 解除詛咒的真死亡騎士．冥皇執行劍：反擊(單手劍)＋居合(武士刀)·貫穿=ignHardSkin·裝備變身真死亡騎士 冥皇丹特斯(js/02)·對地/風敵×1.4·大地崩裂 proc
    wpn_dagger2: ['匕首'], wpn_dagger1: ['匕首'], wpn_11: ['匕首'], wpn_33: ['匕首'],
    wpn_longsword: ['單手劍'], wpn_9: ['單手劍'], wpn_scimitar: ['單手劍'], wpn_26: ['單手劍'],
    wpn_elfsword: ['單手劍'], wpn_27: ['單手劍'], wpn_shortsword: ['單手劍'], wpn_redknight: ['單手劍'],
    wpn_invader: ['單手劍'], wpn_34: ['單手劍'], wpn_35: ['單手劍'],
    wpn_36: ['單手劍'], wpn_rapier: ['單手劍'], wpn_mailbreaker: ['單手劍'], wpn_silversword: ['單手劍'], wpn_37: ['單手劍'],
    wpn_21: ['矛'], wpn_24: ['矛'], wpn_25: ['矛'], wpn_28: ['矛'], wpn_39: ['矛'], wpn_40: ['矛'], wpn_41: ['矛'], wpn_17: ['矛'], wpn_4: ['矛'], wpn_halberd: ['矛'],   // 🔱 法丘：雙手矛（w2h＋穿透80%）
    wpn_frost_spear:['矛'], wpn_thunder_sword:['單手劍'],   // 🧊 酷寒之矛（矛→出血）／⚡ 雷雨之劍（單手劍→反擊）
    wpn_20: ['單手鈍器'], wpn_10: ['單手鈍器'], wpn_13: ['單手鈍器'], wpn_alien: ['單手鈍器'], wpn_1: ['單手鈍器'], wpn_2: ['單手鈍器'], wpn_ancient_axe: ['單手鈍器'], wpn_warrior_trial_axe: ['單手鈍器'], wpn_master_axe: ['單手鈍器'], wpn_demon_axehead: ['單手鈍器'], wpn_iron_axehead: ['單手鈍器'], wpn_giant_axehead: ['單手鈍器'],   // 🔧 古代神之斧／試煉斧頭／大匠的斧頭／魔物的斧頭／鐵斧頭／巨人的斧頭：單手鈍器（鈍擊）
    wpn_2hsword: ['雙手劍'], wpn_dragonslayer: ['雙手劍'], wpn_official_2h: ['雙手劍'],   // 🔧 雙手劍類型標註
    // 🔧 重擊特效武器標註為「雙手鈍器」
    wpn_battleaxe: ['雙手鈍器'], wpn_19: ['雙手鈍器'], wpn_23: ['雙手鈍器'], wpn_giantaxe: ['雙手鈍器'], wpn_berserker: ['雙手鈍器'], wpn_silveraxe: ['雙手鈍器'], wpn_taurus_axe: ['雙手鈍器'],   // 🔧 牛人斧頭：補上漏標的雙手鈍器 tag（eff:crush 但原無 tag）
    // 🔧 黑暗妖精武器：鋼爪 / 雙刀 / 匕首
    wpn_claw_bronze:['鋼爪'], wpn_claw_steel:['鋼爪'], wpn_claw_shadow:['鋼爪'], wpn_claw_silver:['鋼爪'], wpn_claw_dark:['鋼爪'], wpn_claw_gloom:['鋼爪'], wpn_claw_damascus:['鋼爪'], wpn_claw_abyss:['鋼爪'],
    wpn_baranka_claw:['鋼爪'], wpn_baranka_steelclaw:['鋼爪'],   // 🔧 魔獸軍王雙爪（鋼爪類）
    wpn_blood_2hsword:['雙手劍'], wpn_dark_sword:['單手劍'],   // 🔧 冥法軍訓練場：血色巨劍(切割)／黑暗之劍(反擊)
    wpn_dk_flameblade:['單手劍'], wpn_kurt_sword:['單手劍'],   // 🔧 傳說單手劍（反擊）：死亡騎士的烈炎之劍／克特之劍
    wpn_assassin_mark:['雙刀'],   // 🔧 暗殺軍王之痕（雙刀・連擊）
    wpn_dual_bronze:['雙刀'], wpn_dual_steel:['雙刀'], wpn_dual_silver:['雙刀'], wpn_dual_gloom:['雙刀'], wpn_dual_dark:['雙刀'], wpn_dual_shadow:['雙刀'], wpn_dual_damascus:['雙刀'], wpn_dual_abyss:['雙刀'], wpn_thebes_dual:['雙刀'],
    wpn_manadagger:['匕首'], wpn_crystal_dagger:['匕首'],
    wpn_chaos_thorn:['匕首'], wpn_demonking_dual:['雙刀'], wpn_demonking_2hsword:['雙手劍'],   // 🌑 暗影神殿：混沌之刺(匕首/出血)、惡魔王雙刀(雙刀/連擊)、惡魔王雙手劍(雙手劍/切割)
    // 🔧 拉斯塔巴德掉落武器：匕首(出血)/單手劍(反擊)/雙刀(連擊)
    wpn_small_katana:['匕首'], wpn_dagger_rasta:['匕首'], wpn_sword_rasta:['單手劍'], wpn_dual_rasta:['雙刀'], wpn_spear_rasta:['矛'],
    wpn_dual_spike:['雙刀'], wpn_official_blade:['單手劍'],   // 🏛️ 長老之室：尖刺雙刀(連擊)／武官之刃(反擊)
    wpn_emperor_blade:['雙手劍'], wpn_windblade_dagger:['匕首'], wpn_redshadow_dual:['雙刀'], wpn_beastking_claw:['鋼爪'],   // 🏛️ 長老之室傳說：真.冥皇執行劍(切割)／風刃短劍(出血)／紅影雙刀(連擊)／獸王鋼爪(連擊)；聖晶魔杖=魔杖(免tag)
    // 🔥 50級試煉擴充武器標註
    wpn_mithril_dagger:['匕首'], wpn_ori_dagger:['匕首'], wpn_crimson_spear:['矛'], wpn_demon_axe:['雙手鈍器'],
    wpn_vengeance:['雙手劍'], wpn_blackflame_sword:['單手劍','武士刀'], wpn_hate_claw:['鋼爪'], wpn_demon_claw:['鋼爪'], wpn_death_finger:['鋼爪'],
    wpn_demon_sword:['單手劍'], wpn_redflame_sword:['單手劍','武士刀'], wpn_demon_dual:['雙刀'],
    wpn_dual_destroy:['雙刀'], wpn_claw_destroy:['鋼爪'],   // 💥 破壞雙刀／破壞鋼爪（猛爆劇毒）
    wpn_old_sword:['單手劍','武士刀'],   // 🏛️ 古老的劍：反擊(單手劍)＋居合(武士刀)
    wpn_ancient_darkelf_sword:['單手劍'],   // 🏛️ 古代黑暗妖精之劍：反擊(單手劍)
    wpn_demon_sword_hidden:['單手劍'],   // 👹 隱藏的魔族之劍：反擊(單手劍)
    wpn_demon_claw_hidden:['鋼爪'],   // 👹 隱藏的魔族鋼爪：鋼爪標籤(雙擊33預設＋貫穿＋黑暗妖精可裝)
    // 🏴‍☠️ 海賊島武器：血紅慾望短劍(匕首/出血)、榮耀之劍/短刀/海賊彎刀(單手劍/反擊)、深淵雙刀(雙刀/雙擊)
    wpn_pirate_dagger:['匕首'], wpn_glory_sword:['單手劍'], wpn_pirate_shortblade:['單手劍'], wpn_pirate_cutlass:['單手劍'], wpn_abyss_dualblade:['雙刀'],
    // ⚡ 元素施放傳說武器：雷神之鎚／歐西斯衝撞錘(單手鈍器·鈍擊)・馬普勒的懲罰(雙手鈍器·重擊)・帕格里奧之怒／伊娃的責罵(單手劍·反擊)
    wpn_thor_hammer:['單手鈍器'], wpn_osis_hammer:['單手鈍器'], wpn_mapler_punish:['雙手鈍器'], wpn_pagrio_wrath:['單手劍'], wpn_eva_scold:['單手劍'],
    // 🏺 遺物武器：石刃(單手劍)／木棍・骨棒(單手鈍器)／犬齒(匕首)（弓・魔杖遺物免 tag：isBow／isWand 自判）
    relic_goblin_blade:['單手劍'], relic_gremlin_club:['單手鈍器'], relic_husky_bone:['單手鈍器'], relic_doberman_fang:['匕首'],
    relic_gladiator_scimitar:['單手劍'], relic_icefield_pick:['單手鈍器'], relic_werewolf_mace:['單手鈍器'], relic_orc_nail:['匕首'], relic_pan_staff:['矛'], relic_elastic_rib:['雙刀'],
    relic_golem_fist:['雙手鈍器'], relic_orc_cleaver:['單手劍'], relic_strong_femur:['單手鈍器'], relic_forgotten_spear:['矛'], relic_spider_claw:['鋼爪'], relic_hobgoblin_grinder:['單手劍'], relic_orc_butcher:['單手劍'], relic_orc_pole:['矛'], relic_sparta_grudge:['雙刀'], relic_shark_teeth:['匕首'],
    // 🏺 遺物 第二批（v3.1.1）：單手矛/雙手矛(看 w2h)＝矛、鋼爪、雙手劍；鎖鏈劍(chainsword)/奇古獸(qigu)/弓(isBow)/魔杖(isWand) 靠旗標自判免 tag
    relic_guard_spear:['矛'], relic_crab_claw:['鋼爪'], relic_venom_fang:['雙手劍'], relic_ratman_skewer:['矛'], relic_lizardman_cleaver:['矛'],
    // 🏺 遺物 第三批（v3.1.2）：弓/十字弓(isBow)、單手魔杖(isWand) 靠旗標自判免 tag
    relic_ohm_maul:['雙手鈍器'], relic_parrot_beak:['雙手劍'], relic_pirate_scimitar:['單手劍'], relic_scorpion_sting:['匕首'], relic_harvey_claw:['單手劍'], relic_guard_pike:['矛'], relic_ogi_greataxe:['雙手鈍器'],
    // 🏺 遺物 第四批（v3.1.4）：鎖鏈劍(暗精靈鎖鏈劍)靠 chainsword 旗標自判免 tag
    relic_darkthief_claw:['鋼爪'], relic_fighter_axe:['雙手鈍器'],
    // 🏺 遺物 第五批（v3.1.6）：研磨利刃＝單手劍＋武士刀(反擊＋居合)；奇古獸(qigu·夢幻的蘑菇靈魂)靠旗標自判免 tag
    relic_darkelf_grindblade:['單手劍','武士刀'],
    // 🏺 遺物 第六批（v3.1.13）：幽光=單手劍+武士刀(反擊+居合)、喚獸鞭=單手鈍器(鈍擊)、獅鷲爪=鋼爪(雙擊)、鱷魚牙=雙手劍(切割靠 eff)、冰石鎚=雙手鈍器(重擊)；殘冰死亡氣息(魔杖·isWand)靠旗標自判免 tag
    relic_wisp_remnant:['單手劍','武士刀'], relic_summoner_whip:['單手鈍器'], relic_griffin_claw:['鋼爪'], relic_croc_fang:['雙手劍'], relic_icestone_maul:['雙手鈍器'],
    // 🏺 遺物 第七批（v3.1.18）：蛇女鱗片/刺針=匕首(出血)、牙籤/重型劍=雙手劍(切割靠 eff)、拋投石=雙手鈍器(重擊)、備用刀=雙刀(雙擊)；眼魔凝視(魔杖·isWand)＋雞蛇凝視(鎖鏈劍·chainsword)靠旗標自判免 tag
    relic_mutant_lamia_scale:['匕首'], relic_thorn_needle:['匕首'], relic_giant_toothpick:['雙手劍'], relic_veteran_greatsword:['雙手劍'], relic_giant_throwstone:['雙手鈍器'], relic_armor_spareblade:['雙刀'],
    relic_aruba_haste:['單手鈍器'], relic_ashwarrior_flamesword:['單手劍'], relic_deadgeneral_greatsword:['雙手劍'], relic_darkscorpion_pincers:['雙刀'],
    relic_medusa_stinger:['單手鈍器'], relic_silent_venom:['矛'],
    // 🏺 遺物 第十一批（v3.1.33）：牛頭怪的殘暴巨斧＝雙手鈍器（eff:crush 重擊＋tag 自動貫穿）
    relic_axetaurus_brutalaxe:['雙手鈍器'],
    // 🏺 遺物 第五批新增（v3.1.52）：灼熱蜥蜴長舌/殺人蜂尾刺(出血)、上古蜘蛛之爪=單手劍+武士刀(反擊+居合)、鎧甲守衛巨劍=雙手劍(切割靠 eff)；無所畏懼的突擊(chainsword)/幻夢火炎靈魂(qigu)/光束強化魔杖(isWand)/改造便利箭筒(isArrow) 靠旗標自判免 tag
    relic_lizard_tongue:['矛'], relic_killerbee_sting:['匕首'], relic_ancient_spider_claw:['單手劍','武士刀'], relic_guardian_greatsword:['雙手劍'],
    // 🐍 提卡爾：庫庫爾坎之矛/鞭笞藤/倒勾獠牙=矛(雙手矛·出血)、毒牙=匕首(出血)、易碎泥偶=雙手鈍器(重擊靠 eff)、玩具鎚=單手鈍器(鈍擊)；鐵手甲/吹箭(isBow)/枯竭魔杖(名稱含杖)/獻祭亡靈(qigu) 靠旗標/名稱自判免 tag
    wpn_kukulkan_spear:['矛'], relic_eto_whip:['矛'], relic_serpent_fang:['矛'], relic_kaira_fang:['匕首'], relic_mud_idol:['雙手鈍器'], relic_teo_hammer:['單手鈍器'],
    // 🏺 遺物武器 tag：補跟原版（分家後漏跟這批；原版同一套 WEAPON_TAGS 邏輯，值照原版）。漏標會害巨斧精通+30%攻速/雙持/反擊居合等 tag 特效吃不到（風化方尖碑雙持問題主因）
    relic_executor_axe:['單手鈍器'], relic_healer_wand:['單手鈍器'], relic_minotaur_flail:['單手鈍器'], relic_executor_skewer:['矛'], relic_weathered_obelisk:['雙手鈍器'], relic_shadow_stinger:['匕首'], relic_soulreaper_dual:['雙刀'], relic_ghoul_fang:['單手劍'], relic_sparto_shard:['單手劍'], relic_pirate_dual:['雙刀'], relic_lava_fists:['單手鈍器'],
    // 🗡️ v3.4.33 倫得雙刀＋這批遺物武器:分家後同樣漏跟(玩家回報「倫得雙刀沒有雙刃×2」才抓到)。
    //    tag 決定 雙刃×2/出血/武器精通/雙擊率預設,沒 tag 等於這些特性全部不會發動。值照原版。
    wpn_rond_dual:['雙刀'],
    relic_cerberus_pin:['鋼爪'], relic_dark_metal_club:['單手鈍器'], relic_ash_fist:['單手鈍器'],
    relic_ant_pincer:['單手劍','武士刀'], relic_reaper_scythe:['雙手劍'], relic_mage_dagger:['匕首'],
};
function getWeaponTags(id){ return WEAPON_TAGS[id] || []; }
// ⚔️ 雙擊機率 comboRate：未明定者依武器標籤套預設（鋼爪 33% / 雙刀 25%）；個別武器可在 def 寫 comboRate 覆寫（底比斯歐西里斯雙刀30 / 死亡之指20 / 恨之鋼爪50 / 破壞雙刀·破壞鋼爪30）。日後新增 combo 武器自動取得預設機率。
Object.keys(DB.items).forEach(function(id){ let d = DB.items[id]; if (d && d.eff === 'combo' && d.comboRate == null) { let tg = getWeaponTags(id); d.comboRate = tg.includes('鋼爪') ? 33 : (tg.includes('雙刀') ? 25 : 0); } });
// 🗡️ 貫穿（ignHardSkin）批次標記（2026-06·用戶要求）：攻擊無視硬皮的額外物理減傷；一般＋經典皆生效（傷害公式旁路，非經典停用特效）。
// 涵蓋：所有單手/雙手鈍器、所有鋼爪(死亡之指除外)、所有鎖鏈劍、所有魔杖(排除黃金權杖)＋指定 10 雙刀／7 具名劍／5 特定武器。日後新增同類(鈍器/鋼爪/鎖鏈劍/魔杖)自動取得。
(function(){
    Object.keys(DB.items).forEach(function(id){
        let d = DB.items[id]; if (!d || d.type !== 'wpn') return;
        let tg = getWeaponTags(id);
        if (tg.includes('單手鈍器') || tg.includes('雙手鈍器') || tg.includes('鋼爪')) d.ignHardSkin = true;   // 所有鈍器＋鋼爪
        if (d.chainsword) d.ignHardSkin = true;                                                              // 所有鎖鏈劍
        if (/魔杖|法杖/.test(d.n) || (/杖/.test(d.n) && !/權杖/.test(d.n))) d.ignHardSkin = true;            // 所有魔杖（排除黃金權杖＝王族單手劍）
    });
    ['wpn_dual_dark','wpn_assassin_mark','wpn_dual_damascus','wpn_dual_gloom','wpn_dual_rasta','wpn_dual_abyss','wpn_demon_dual','wpn_thebes_dual','wpn_dual_destroy','wpn_demonking_dual',
     'wpn_ori_dagger','wpn_damascus','wpn_blackflame_sword','wpn_kurt_sword','wpn_demon_sword','wpn_vander_sword','wpn_demonking_2hsword',
     'wpn_18','wpn_16','wpn_halberd','wpn_12','wpn_crimson_spear'
    ].forEach(function(id){ if (DB.items[id]) DB.items[id].ignHardSkin = true; });   // 指定雙刀/具名劍/特定武器
    if (DB.items['wpn_death_finger']) delete DB.items['wpn_death_finger'].ignHardSkin;   // 鋼爪例外：死亡之指不加貫穿
    // 🔮 神官魔杖／惡魔王魔杖：兩版本都保留貫穿(ignHardSkin·無經典閘)＋魔爆(eff:magicburst·經典自動停用)。一般版＝貫穿+魔爆、經典版＝只剩貫穿(魔爆停用)
})();
// 🎮 經典模式：tooltip 不顯示已被停用的武器/盾牌特效字樣（共鳴/魔爆/連射/反擊/出血/穿透/切割/居合/魔擊/鈍擊/重擊/格檔）；連擊/月光爆裂/即死等未停用者照常顯示
const CLASSIC_HIDDEN_EFF_LABELS = ['共鳴','魔爆','連射','反擊','出血','穿透','切割','居合','魔擊','鈍擊','重擊','格檔','雙刃'];   // ⚔️ 雙刃＝雙刀 5% 傷害×2（經典停用）；鋼爪額外重擊以「重擊」開頭已涵蓋
function filterClassicEffLabels(effArr, d){ return (player && player.classicMode && !(d && d.classicOk)) ? effArr.filter(e => !CLASSIC_HIDDEN_EFF_LABELS.some(h => e.startsWith(h))) : effArr; }   // classicOk 的武器（黑虎的雙尾鞭）經典模式仍會觸發→特效字樣照常顯示
function weaponHasBleed(id){ let d = DB.items[id]; if (d && d.noBleed) return false; let t = getWeaponTags(id); return t.includes('匕首') || t.includes('矛'); }   // 匕首與矛皆帶出血特效（noBleed 旗標可個別停用，如遺物雙手矛）
// 🏺 遺物/特殊裝備的機制標籤（武器與防具/飾品共用）：一律寫出實際數值，玩家才知道差在哪。
//    新增帶機制的裝備旗標時，順手在這裡補一條——沒補的話遺物在遊戲裡只看得到風味文字、機制完全隱形。
const _RELIC_ELE_ZH = { fire: '火', water: '水', wind: '風', earth: '地', none: '無' };
function relicEffectLabels(d, item) {
    if (!d) return [];
    let e = [], _skn = id => (DB.skills[id] && DB.skills[id].n) || id;
    let _ele = k => _RELIC_ELE_ZH[k] || k;
    // 🏺 遺物第 15 批(四大精靈王武器等)的效果說明。文字照上游 relicPurposeLabels;我方函式用 e.push 與 _ele() 對照表
    if (d.mrPerWis)            e.push(`精神屏障（每 1 點最終精神，MR+${d.mrPerWis}）`);
    if (d.swordStr)            e.push(`握劍強化（主手裝備單手劍或雙手劍時，力量+${d.swordStr}）`);
    if (d.missGrazeRate)       e.push(`擦傷補正（未命中時 ${d.missGrazeRate}% 改判為擦傷，造成 50% 傷害且不會爆擊）`);
    if (d.hitEchoMagic)        e.push(`元素爆破 ${d.hitEchoMagic.rate}%（命中後追加等同本次一般攻擊傷害的${_ele(d.hitEchoMagic.ele)}屬性魔法傷害）`);
    if (d.windSpellProcRate)   e.push(`風魔法共振 ${d.windSpellProcRate}%（主動施放風屬性傷害魔法時追加龍捲風）`);
    if (d.hurtRapidfire)       e.push('受擊反制（受到傷害時立即觸發一次連射；經典模式亦生效）');
    if (d.counterAllEle)        e.push('一般攻擊剋制所有屬性敵人（傷害 ×1.4）');
    if (d.procBurn)             e.push(`命中附加灼燒：每秒 ${d.procBurn.dmg || 10} 點火傷，持續 ${d.procBurn.dur || 6} 秒${d.procBurn.rate ? `（${d.procBurn.rate}% 機率）` : ''}`);
    if (d.onHitEleDmg)          e.push(`命中額外造成 ${d.onHitEleDmg.dmg} 點${_ele(d.onHitEleDmg.ele)}屬性傷害${d.onHitEleDmg.rate ? `（${d.onHitEleDmg.rate}% 機率）` : ''}`);
    if (d.skillDmgMult)         Object.keys(d.skillDmgMult).forEach(k => e.push(`${_skn(k)} 傷害 ×${d.skillDmgMult[k]}`));
    if (d.silencedBonusDmg)     e.push(`對沉默中的敵人額外 +${d.silencedBonusDmg} 傷害`);
    if (d.poisonedBonusDmg)     e.push(`對中毒的敵人額外 +${d.poisonedBonusDmg} 傷害`);
    if (d.slowedBonusDmg)       e.push(`對緩速中的敵人額外 +${d.slowedBonusDmg} 傷害`);
    if (d.immParalyzeBonusDmg)  e.push(`對免疫麻痺／暈眩的敵人額外 +${d.immParalyzeBonusDmg} 傷害`);
    if (d.eleBonusDmg)          e.push(`對${_ele(d.eleBonusDmg.ele)}屬性敵人額外 +${d.eleBonusDmg.add} 傷害`);
    if (d.eleWpnMult)           e.push(`裝備${_ele(d.eleWpnMult.ele)}屬性武器時，一般攻擊傷害 ×${d.eleWpnMult.mult}`);
    if (d.procInstakill) {
        let k = d.procInstakill, c = [];
        if (k.tag === 'undead') c.push('對不死');
        if (k.maxLv) c.push(`${k.maxLv} 級以下`);
        if (k.hpBelow) c.push(`HP 低於 ${Math.round(k.hpBelow * 100)}%`);
        e.push(`命中時 ${+(k.p * 100).toFixed(2)}% 機率即死${c.length ? `（限${c.join('、')}的敵人）` : ''}${k.healPct ? `，即死後恢復其最大 HP 的 ${Math.round(k.healPct * 100)}%` : ''}（頭目免疫）`);
    }
    if (d.instakillFull)        e.push(`命中滿血的敵人時 ${+(d.instakillFull * 100).toFixed(2)}% 機率即死（頭目免疫）`);
    if (d.stoneInstakill)       e.push('命中石化中的敵人必定即死（頭目免疫）');
    if (d.hasteStrike)          e.push('加速狀態時命中 +30、傷害 +30（一般攻擊命中後會失去加速）');
    if (d.selfBreakProc)        e.push(`一般攻擊 3% 機率傷害 ×1.5，但自身陷入壞物術 ${d.selfBreakProc.dur || 5} 秒（期間物理傷害 -20%）`);
    if (d.onHitEleVuln)         e.push(`命中使敵人獲得${_ele(d.onHitEleVuln)}屬性弱點 3 秒（期間受該屬性攻擊 +30%）`);
    if (d.heavyMult)            e.push(`重擊傷害 ×${d.heavyMult}`);
    if (d.heavyRatePct)         e.push(`重擊觸發的骰面往下擴（重擊率 +${d.heavyRatePct}%）`);
    if (d.hardSkinMult)         e.push(`對有硬皮的敵人傷害 ×${d.hardSkinMult}`);
    if (d.softMult)             e.push(`對沒有硬皮的敵人傷害 ×${d.softMult}`);
    if (d.fullHpMult)           e.push(`對滿血敵人傷害 ×${d.fullHpMult}${d.fullHpMultTriple ? `（三重矢的第一箭 ×${d.fullHpMultTriple}）` : ''}`);
    if (d.raceBonus)            e.push(`對「${d.raceBonus.race}」傷害 ×${d.raceBonus.mult}`);
    if (d.raceFlat)             e.push(`對「${d.raceFlat.race}」額外 +${d.raceFlat.add} 傷害`);
    if (d.giantBonus)           e.push('對巨人額外 +1~20 傷害');
    if (d.strawCurse)           e.push(`命中時 ${d.strawCurse.rate}% 機率種下詛咒稻草人（${d.strawCurse.stacks || 3} 層；之後每次命中額外造成 80 點水屬性魔法傷害）`);
    if (d.onHitCastSkill)       e.push(`命中時施放${_skn(d.onHitCastSkill.skId)}（每 ${d.onHitCastSkill.cdSec || 5} 秒最多 1 次）`);
    if (d.procFireSkillRate)    e.push(`攻擊時 ${d.procFireSkillRate}% 機率隨機施放一個火屬性法術`);
    if (d.procHealFlat)         e.push(`命中時 ${d.procHealFlat.rate}% 機率恢復 ${d.procHealFlat.hp} 點 HP`);
    if (d.poisonMult)           e.push(`附加劇毒的傷害 ×${d.poisonMult}`);
    if (d.mpOnHitAmt)           e.push(`一般攻擊命中恢復 ${d.mpOnHitAmt} 點 MP`);
    if (d.freeChill)            e.push('施放寒冰氣息不消耗 MP');
    if (d.autoCastDmgMult)      e.push(`自動施放的法術傷害 ×${d.autoCastDmgMult}`);
    if (d.hotHealMult)          e.push(`自己施放的持續回復量 ×${d.hotHealMult}`);
    if (d.fullHpMpHalf)         e.push('滿血時技能消耗 MP 減半');
    if (d.counterBarrierX2)     e.push('反擊屏障觸發的反擊傷害 ×2');
    if (d.dotCrit)              e.push('我方造成的持續傷害（中毒／出血／猛爆劇毒）可以爆擊');
    if (d.lowHpPotionX2)        e.push('HP 低於 20% 時，治癒藥水的恢復量 ×2');
    if (d.atkSpdPct)            e.push(`攻擊速度 ${d.atkSpdPct > 0 ? '+' + d.atkSpdPct : d.atkSpdPct}%`);
    if (d.meleeHaste)           e.push(`裝備近距離武器時攻擊速度 +${d.meleeHaste}%`);
    if (d.polyAtkSpdPct)        e.push(`變身狀態時攻擊速度 +${d.polyAtkSpdPct}%`);
    if (d.aggroWeight)          e.push(`被敵人鎖定的權重 ${d.aggroWeight > 0 ? '+' + d.aggroWeight : d.aggroWeight}`);
    if (d.aggroHide)            e.push('敵人會優先攻擊隊上沒有裝備此物品的人');
    if (d.allLures)             e.push('視為持有全部的誘捕道具');
    if (d.counterEles)          e.push(`一般攻擊剋制${(Array.isArray(d.counterEles) ? d.counterEles : [d.counterEles]).map(_ele).join('、')}屬性敵人（傷害 ×1.4）`);
    if (d.onHitWet)             e.push('一般攻擊命中使敵人潮濕（潮濕的敵人下次受到的風屬性傷害 ×2）');
    if (d.noEvade)             e.push('無法迴避敵人的攻擊（暗隱術不受影響）');
    if (d.rapidMax)             e.push('連射必定射出最大箭數');
    if (d.bonespike)            e.push('連射每命中一箭累積 1 層骨刺；一般攻擊引爆全部層數，每層造成 20 點固定傷害');
    if (d.critDmgLowHp)         e.push(`HP 低於 ${d.critDmgLowHp.hp} 時，近距離爆擊傷害 +${d.critDmgLowHp.add}%`);
    if (d.castOnHurt)           e.push(`受到傷害時 ${d.castOnHurt.rate}% 機率免費施放你設定的自動攻擊法術`);
    if (d.fireballBurst)        e.push('施放「燃燒的火球」時改為施放威力更強的「爆裂的火球」');
    if (d.hpRegenFaster)        e.push(`HP 自然恢復的間隔縮短（每級 -1 秒，最短 3 秒；目前 ${Math.max(3, Math.round((160 - 10 * d.hpRegenFaster) / 10))} 秒一次）`);
    if (d.autoReviveScroll)     e.push('傭兵／寵物倒下時自動消耗復活卷軸立即復活（跳過復活冷卻）');
    if (d.summonCtrl)           e.push('視為持有召喚控制戒指（可指定召喚的怪物種類）');
    if (d.petDmgReduce)         e.push(`出戰寵物受到的傷害 -${Math.round(d.petDmgReduce * 100)}%`);
    if (d.petBleed)             e.push(`出戰寵物的一般攻擊附加出血${d.petBleed.rate ? `（${d.petBleed.rate}% 機率）` : ''}`);
    if (d.procOnHit)            e.push('附魔法術僅在一般攻擊命中時才會觸發');
    return e;
}
function buildItemDescHTML(item) {
    let d = DB.items[item.id];
    if(!d) return '';
    let desc = d.d || "";
    // 🔮 席琳套裝效果：寫在資訊欄（綠色標題＋淺綠加成說明），不冠在名稱前
    if (item.seteff) {
        let _g = item.seteff.slice(0, 2);
        let _lines = (SHERINE_SET_TEXT[_g] || []).map(t => `<span class="text-green-200">・${t}</span>`).join('<br>');
        // 🦴 一般裝備上的舊詞綴已不計入套裝效果（只有遺骸欄計件），提示玩家可去神殿拆成遺骸
        let _legacy = d.remains ? '' : `<br><span class="text-amber-300 text-sm">（舊詞綴：已不計入套裝效果，可請席琳神殿的菈克希絲拆分為遺骸）</span>`;
        desc = `<span class="c-sherine font-bold">✦ 席琳套裝效果：${_g}</span><br>${_lines}${_legacy}`
             + (desc ? `<br>${desc}` : '');
    }
    if(d.type === 'wpn') {
        desc += `<br><span class="text-orange-300">小型傷害: ${d.dmgS} / 大型傷害: ${d.dmgL}</span>`;
        
        // 🌟 依照你的規則：根據 ranged: true 決定前綴
        let isRanged = (d.ranged === true);
        let hitLabel = isRanged ? "遠距離命中" : "近距離命中";
        let dmgLabel = isRanged ? "遠距離傷害" : "近距離傷害";

        // 顯示命中與傷害
        if(d.hit) desc += ` / ${hitLabel}: ${formatBonus(d.hit)}`;
        if(d.dmgBonus !== undefined) desc += ` / ${dmgLabel}: ${formatBonus(d.dmgBonus)}`; // 加上 !== undefined 避免 0 被漏掉
        
        if(d.mdmg) desc += ` / 魔法傷害: ${formatBonus(d.mdmg)}`;
        // ⚔️ 攻擊速度依「職業性別×武器種類」查表顯示（以目前角色為準；戰士雙持另依雙斧速度）
        if (typeof atkSpdApm === 'function' && typeof player !== 'undefined' && player && player.cls && atkSpdFamily(item.id)) {   // 箭矢等非揮擊武器不顯示
            let _apm = atkSpdApm(player, item.id);
            if (_apm) desc += `<br><span class="text-orange-200">攻擊速度: 每分鐘 ${_apm} 次（${player.avatar || '依職業性別'}）</span>`;
            // 🏛️ 天堂職業速度：硬直（被擊延遲攻擊）＋施法冷卻下限（皆隨職業·不隨此武器）
            if (typeof hitstunTicks === 'function') desc += `<br><span class="text-slate-400 text-xs">硬直 ${(hitstunTicks(player)/10).toFixed(1)}秒 · 施法冷卻下限 ${(castLockTicks(player)/10).toFixed(1)}秒</span>`;
        }
        if((item.en || 0) >= 1) desc += `<br><span class="text-amber-300">強化最終傷害 ×${enhanceWpnFinalMult(item.en, d).toFixed(2)}</span>`;   // 🔧 武器強化最終傷害倍率（+1 起·依潘朵拉權重分級·最高 ×1.02~×2.50）

        // 瑪那魔杖等「命中恢復MP」武器：依此物品的強化等級(+N)動態顯示恢復量
        if(d.eff === 'mp_drain' || d.mpOnHit) {
            let en = capEn(item.en, d);
            let mpGain = 1 + Math.max(0, en - 6);
            desc += `<br><span class="text-sky-300">命中時恢復 ${mpGain} 點 MP（+7 起每強化 +1）。</span>`;
        }
        if(d.mpROverSafe) {
            let en = capEn(item.en, d);
            let mpRegen = (d.mpR || 0) + Math.max(0, en - (d.safe || 0)) * d.mpROverSafe;
            desc += `<br><span class="text-sky-300">MP自然恢復 ${mpRegen}（+0 為 ${d.mpR || 0}，+${(d.safe || 0) + 1} 起每強化 +${d.mpROverSafe}）。</span>`;
        }
        if(d.extraMpPerEn) {
            let en = capEn(item.en, d);
            desc += `<br><span class="text-sky-300">額外魔法點數 +${en * d.extraMpPerEn}（每強化 +${d.extraMpPerEn}）。</span>`;
        }
        if(d.meleeHitPerEn) {
            let en = capEn(item.en, d);
            desc += `<br><span class="text-sky-300">近距離命中 +${en * d.meleeHitPerEn}（每強化 +${d.meleeHitPerEn}）。</span>`;
        }
    }
    if(d.type === 'arm' || d.type === 'acc') {
        // 順便修復防禦為 0 (例如 T恤) 時不顯示的問題
        if(d.ac !== undefined) desc += `<br><span class="text-blue-300">防禦(AC): ${d.ac === 0 ? '0' : (d.ac > 0 ? '-' + d.ac : '+' + (-d.ac))}</span>`;   // AC 越低越強→正值顯示成 -N；負值(曼波帽子等下向裝)顯示成 +N，不能寫死前綴「-」否則變成「--1」
        let isRanged = (d.ranged === true);
        let hitLabel = isRanged ? "遠距離命中" : "近距離命中";
        let dmgLabel = isRanged ? "遠距離傷害" : "近距離傷害";
        if(d.hit !== undefined)        desc += ` / ${hitLabel}: ${formatBonus(d.hit)}`;
        if(d.dmgBonus !== undefined)   desc += ` / ${dmgLabel}: ${formatBonus(d.dmgBonus)}`;
        if(d.mr || d.mrPerEn) { let _en = capEn(item.en, d); desc += ` / 魔防(MR): ${formatBonus((d.mr||0) + (d.mrPerEn||0)*_en)}` + (d.mrPerEn ? `（每強化 +${d.mrPerEn}）` : ''); }
        if(d.resNone)  desc += ` / 無屬性抗性: ${formatBonus(d.resNone)}（只對魔法）`;   // 🛡️ 改制:取代舊 magicDrNonEle 的直接減傷 %
        if(d.resFire)  desc += ` / 火屬性抗性: ${formatBonus(d.resFire)}`;
        if(d.resWater) desc += ` / 水屬性抗性: ${formatBonus(d.resWater)}`;
        if(d.resWind)  desc += ` / 風屬性抗性: ${formatBonus(d.resWind)}`;
        if(d.resEarth) desc += ` / 地屬性抗性: ${formatBonus(d.resEarth)}`;
        if(d.meleeHit)  desc += ` / 近距離命中: ${formatBonus(d.meleeHit)}`;
        if(d.rangedHit) desc += ` / 遠距離命中: ${formatBonus(d.rangedHit)}`;
        if(d.meleeDmg)  desc += ` / 近距離傷害: ${formatBonus(d.meleeDmg)}`;
        if(d.rangedDmg) desc += ` / 遠距離傷害: ${formatBonus(d.rangedDmg)}`;
        // 🦴 寵物裝備（之牙）：依強化等級(+N，飾品上限+5)動態顯示夥伴加成（每強化+1 → 傷害+1、命中+1）
        if(d.petDmg || d.petHit) {
            let en = capEn(item.en, d);
            let _pd = (d.petDmg || 0) + en, _ph = (d.petHit || 0) + en, _parts = [];
            if(_pd > 0) _parts.push('額外傷害 +' + _pd);
            if(_ph > 0) _parts.push('額外命中 +' + _ph);
            if(_parts.length) desc += `<br><span class="text-amber-300">夥伴${_parts.join('、')}（每強化 +1，上限 +5）。</span>`;
        }
        // 🛡️ 寵物防具：依強化等級動態顯示夥伴加成（每強化 +1 → 防禦再 -1，上限 +5）
        if(d.petAc || d.petMr || d.petInt || d.petWis) {
            let en = capEn(item.en, d);
            let _parts = [];
            if(d.petAc) _parts.push('防禦 -' + ((d.petAc || 0) + en));
            if(d.petMr) _parts.push('魔法防禦 +' + d.petMr);
            if(d.petInt) _parts.push('智力 +' + d.petInt + '（技能傷害 +' + d.petInt + '）');
            if(d.petWis) _parts.push('精神 +' + d.petWis + '（MP上限 +' + (d.petWis * 5) + '·MP恢復 +' + d.petWis + '）');
            if(_parts.length) desc += `<br><span class="text-amber-300">夥伴${_parts.join('、')}（每強化 防禦再 -1，上限 +5）。</span>`;
        }
        // 🛡️ 臂甲：依強化值動態顯示門檻特效現值＋每強化HP（🏺 遺物臂甲 noEnhance：跳過強化相關文字，特效寫在 d:）
        if(d.armguard && !d.noEnhance) {
            let en = capEn(item.en, d);
            let ag = d.armguard;
            let tier = en >= 9 ? ag.th[2] : en >= 7 ? ag.th[1] : en >= 5 ? ag.th[0] : 0;
            let val = (ag.base || 0) + tier;
            let perEnHp = en * 10;
            if(ag.stat === 'mhp') desc += `<br><span class="text-amber-300">HP +${val + perEnHp}（特效 +${val}、每強化 HP+10 共 +${perEnHp}）</span>`;
            else if(ag.stat && ag.stat !== 'none' && val) { let _agLbl = ag.stat === 'dr' ? '額外減傷' : ag.stat === 'magicDmg' ? '魔法傷害' : ag.stat === 'rangedDmg' ? '遠距離傷害' : ag.stat === 'meleeDmg' ? '近距離傷害' : ag.stat; desc += `<br><span class="text-amber-300">${_agLbl} +${val}　HP +${perEnHp}（每強化+1，HP+10）</span>`; }
            else desc += `<br><span class="text-amber-300">HP +${perEnHp}（每強化+1，HP+10）</span>`;   // 🛡️ 無門檻特效臂甲（如龍鱗臂甲 stat:none）：只顯示每強化HP，不顯示「none +0」
        }
    }

    // 👇 裝備特效標籤：只顯示特效名稱（不附解說）。涵蓋 武器/防具/飾品。
    if (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') {
        let _eff = [];
        if (d.unBonus || d.unDice || d.sp === 'elf') _eff.push('不死 / 狼人加成');
        if (d.eff === 'pierce')     _eff.push('穿透' + (d.pierceChance !== undefined ? ' ' + d.pierceChance + '%' : ''));
        if (d.eff === 'moonburst')  _eff.push('月光爆裂');
        if (d.eff === 'dice_death') _eff.push('即死');
        if (d.eff === 'haste')      _eff.push('自我加速');
        if (d.eff === 'crush')      _eff.push('重擊');
        if (d.eff === 'cleave')     _eff.push('切割');
        if (d.eff === 'combo')      _eff.push('雙擊 ' + (d.comboRate||0) + '%');   // 🔧 鋼爪/雙刀：雙擊特效（comboRate%機率發動，額外攻擊＝完整一般攻擊）
        if (d.weakExpose)           _eff.push('弱點曝光');   // 🐉 鎖鏈劍：一般攻擊命中12%附加（最多3層）
        if (d.vampPct)              _eff.push('吸取HP ' + Math.round(d.vampPct * 100) + '%');   // 🐉 嗜血者鎖鏈劍
        if (d.ignHardSkin)          _eff.push('貫穿');   // 🗡️ 暗黑十字弓：攻擊無視硬皮額外減傷
        if (d.redSpecter)           _eff.push('紅惡靈逆襲');   // 👹 隱藏的魔族武器：攻擊4%(+每強化1%)→4D10水魔傷+吸10%HP
        if (d.blueSpecter)          _eff.push('藍惡靈奪魔');   // 👹 隱藏的魔族武器：攻擊4%(+每強化1%)→回3D6 MP
        if (d.rapidfire)            _eff.push('連射 ' + d.rapidfire + '%');
        if (d.block)                _eff.push('格檔：' + d.block + '%');
        if (d.immStone)             _eff.push('免疫石化');
        if (d.immPoison)            _eff.push('免疫中毒');
        if (d.unique)               _eff.push('唯一（最多裝備1個）');
        if (d.eff === 'magicstrike') _eff.push('魔擊');
        if (d.eff === 'magicburst') _eff.push('魔爆');   // 🔧 神官魔杖
        if (d.meleeHitSpell)        _eff.push(d.meleeHitSpell.skn || '命中觸發');   // 🔧 蕾雅魔杖：冰裂術
        if (d.spellProc)            _eff.push('施放' + (d.spellProc.skn || ''));   // 🔧 烈炎之劍/克特之劍等附魔施放
        if (d.procSkill)            _eff.push('施放' + ((DB.skills[d.procSkill] && DB.skills[d.procSkill].n) || ''));   // 🔧 冰之女王魔杖：施放冰錐
        if (typeof weaponHasBleed === 'function' && weaponHasBleed(item.id)) _eff.push('出血');
        if (typeof getWeaponTags === 'function' && getWeaponTags(item.id).includes('單手劍')) _eff.push('反擊');
        if (typeof getWeaponTags === 'function' && getWeaponTags(item.id).includes('武士刀')) _eff.push('居合');
        if (typeof getWeaponTags === 'function' && getWeaponTags(item.id).includes('單手鈍器')) _eff.push('鈍擊');
        if (typeof getWeaponTags === 'function' && getWeaponTags(item.id).includes('雙刀')) _eff.push('雙刃 5%（傷害×2）');   // ⚔️ 雙刀內建特性
        if (typeof getWeaponTags === 'function' && getWeaponTags(item.id).includes('鋼爪')) _eff.push('重擊 +5%');   // ⚔️ 鋼爪內建特性：一般攻擊額外 5% 重擊
        if (typeof WAND_LIGHTARROW_IDS !== 'undefined' && WAND_LIGHTARROW_IDS.includes(item.id)) _eff.push('共鳴');
        _eff = filterClassicEffLabels(_eff, d);   // 🎮 經典模式：移除已停用特效字樣（classicOk 的武器不過濾）
        if (_eff.length) desc += `<br><span class="text-rose-300 font-bold">特效：${_eff.join(' / ')}</span>`;
    }
    // 👆

    // 👇🌟 新增以下這段：統一處理所有裝備的基礎能力加成顯示 🌟👇
    let statsArr = [];
    if(d.str) statsArr.push(`力量(STR)${formatBonus(d.str)}`);
    if(d.dex) statsArr.push(`敏捷(DEX)${formatBonus(d.dex)}`);
    if(d.con) statsArr.push(`體質(CON)${formatBonus(d.con)}`);
    if(d.int) statsArr.push(`智力(INT)${formatBonus(d.int)}`);
    if(d.wis) statsArr.push(`精神(WIS)${formatBonus(d.wis)}`);
    if(d.cha) statsArr.push(`魅力(CHA)${formatBonus(d.cha)}`);
    if(d.mhp) statsArr.push(`HP上限${formatBonus(d.mhp)}`);
    if(d.mmp) statsArr.push(`MP上限${formatBonus(d.mmp)}`);
    if(d.hpR) statsArr.push(`HP恢復${formatBonus(d.hpR)}`);
    if(d.mpR) statsArr.push(`MP恢復${formatBonus(d.mpR)}`);
    
    if (statsArr.length > 0) {
        // 如果前面沒有換行過，就幫它換行
        if (!desc.includes('<br>')) desc += '<br>';
        else desc += ' / ';
        desc += `<span class="text-violet-400 font-bold">${statsArr.join(' / ')}</span>`;
    }
    // 👆 新增結束 👆

    // 🏺 遺物/特殊裝備的機制（帶實際數值·武器與防具飾品共用）：排在能力值之後，每條獨立一行
    {
        let _rel = relicEffectLabels(d, item);
        if (_rel.length) desc += `<br><span class="text-rose-300">${_rel.map(t => '・' + t).join('<br>')}</span>`;
    }

    if(d.slot === 'petwpn' || d.slot === 'petarm') {
        // 🦴 寵物裝備詞綴：以「寵物實際獲得的加成」呈現（之牙=武器→傷害/命中；寵物盔甲=防具→防禦/減傷/魔防/迴避），與 petGearAffix 同源，顯示＝實際效果
        let _petAffTxt = (dl) => {
            let ps = [];
            if(dl.dmg) ps.push('夥伴額外傷害' + formatBonus(dl.dmg));
            if(dl.hit) ps.push('命中' + formatBonus(dl.hit));
            if(dl.ac)  ps.push('防禦(AC)' + (dl.ac < 0 ? '-' + (-dl.ac) : '+' + dl.ac));   // AC 越低越強：祝福 -1 顯示「-1」
            if(dl.dr)  ps.push('傷害減免' + formatBonus(dl.dr));
            if(dl.mr)  ps.push('魔防(MR)' + formatBonus(dl.mr));
            if(dl.er)  ps.push('迴避(ER)' + formatBonus(dl.er));
            return ps.join('，');
        };
        if(item.bless) {
            let _s = _petAffTxt(petGearAffix({ id: item.id, bless: item.bless }));
            desc += `<br><span class="${item.bless==='cursed'?'c-cursed':'text-yellow-400'}">${item.bless==='cursed'?'詛咒的':'祝福的'}：${_s}</span>`;
        }
        if(item.anc) {
            let _s = _petAffTxt(petGearAffix({ id: item.id, anc: item.anc }));
            desc += `<br><span class="${ancColorClass(item.anc)}">${ancName(item.anc)}：${_s}</span>`;
        }
        let _paf = getAttrAffix(item.attr);
        if(_paf) {
            let _s = _petAffTxt(petGearAffix({ id: item.id, attr: item.attr }));
            desc += `<br><span class="c-attr-${item.attr}">${_paf.n}：${_s}</span>`;
        }
    } else {
    if(item.bless) {
        if(item.bless === 'cursed') {
            let _ct;
            if(d.type === 'wpn') _ct = '額外傷害-1，命中-1，額外魔法點數-2';
            else { let _acc = (d.slot==='ring'||d.slot==='amulet'||d.slot==='belt'||d.slot==='ear'); _ct = _acc ? '防禦(AC)+1，魔防(MR)-1' : '防禦(AC)+1，傷害減免-1'; }
            desc += `<br><span class="c-cursed">詛咒的：${_ct}</span>`;
        } else {
            let _bt;
            if(d.type === 'wpn') _bt = '額外傷害+1，額外魔法點數+2，額外命中+1';
            else { let _acc = (d.slot==='ring'||d.slot==='amulet'||d.slot==='belt'||d.slot==='ear'); _bt = _acc ? '防禦(AC)-1，魔防(MR)+1' : '防禦(AC)-1，傷害減免+1'; }
            desc += `<br><span class="text-yellow-400">祝福的：${_bt}</span>`;
        }
    }
    if(item.anc) {
        let _acc = (d.slot==='ring'||d.slot==='amulet'||d.slot==='belt'||d.slot==='ear');
        let _slot = (d.type === 'wpn') ? 'wpn' : (_acc ? 'acc' : 'arm');
        let _v = (item.anc === true) ? 'ancient' : item.anc;
        let _at;
        if(_slot === 'wpn')      _at = (_v==='eternal') ? '額外傷害+4' : (_v==='immortal') ? '額外命中+4' : (_v==='primordial') ? '魔法傷害+2' : '額外傷害+2，魔法傷害+1';
        else if(_slot === 'arm') _at = (_v==='eternal') ? '防禦(AC)-2' : (_v==='immortal') ? '迴避(ER)+2' : (_v==='primordial') ? '魔防(MR)+4' : '傷害減免+2';
        else                     _at = (_v==='eternal') ? '額外傷害+1，防禦(AC)-1' : (_v==='immortal') ? '額外傷害+1，額外命中+1' : (_v==='primordial') ? '魔防(MR)+2，額外魔法點數+2' : '傷害減免+1，魔防(MR)+1';
        desc += `<br><span class="${ancColorClass(item.anc)}">${ancName(item.anc)}：${_at}</span>`;
    }
    let _aff = getAttrAffix(item.attr);
    if(_aff) {
        let eleName = { fire:'火', water:'水', wind:'風', earth:'地' }[_aff.ele];
        if(d.type === 'wpn') {
            let counterName = { fire:'地', water:'火', wind:'水', earth:'風' }[_aff.ele];
            desc += `<br><span class="c-attr-${item.attr}">${_aff.n}：固定傷害+${_aff.fix}，武器轉為${eleName}屬性，對${counterName}屬性怪物額外+${_aff.counter}固定傷害。</span>`;
        } else {
            desc += `<br><span class="c-attr-${item.attr}">${_aff.n}：${eleName}屬性抗性+${_aff.res}，魔防(MR)+${_aff.mr}。</span>`;
        }
    }
    }

    // 🛡️ 適用職業：以職業 logo 顯示可裝備此裝備的職業（騎士/妖精/法師/黑暗妖精/幻術士；黑暗妖精走 darkEquipOk 真實規則）
    if (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') {
        const _EQ_CLASSES = [['knight','騎士'], ['elf','妖精'], ['mage','法師'], ['dark','黑暗妖精'], ['illusion','幻術士'], ['dragon','龍騎士'], ['warrior','戰士'], ['royal','王族']];
        let _logos = _EQ_CLASSES
            .filter(([c]) => isRelic(d) ? reqAllowsClass(d, c) : (c === 'dark') ? darkEquipOk(d, item.id) : (c === 'illusion') ? illusionEquipOk(d, item.id) : (c === 'dragon') ? dragonEquipOk(d, item.id) : (c === 'warrior') ? warriorEquipOk(d, item.id) : (c === 'royal') ? royalEquipOk(d, item.id) : reqAllowsClass(d, c))   // 🏺 遺物：職業適用純以 req 白名單判定（同 checkCanEquip 短路）
            .map(([, nm]) => `<img src="assets/logo/${nm}icon.png" alt="${nm}" title="${nm}" class="class-eq-icon" onerror="this.style.display='none';">`)
            .join('');
        if (_logos) desc += `<br><span class="text-slate-400">適用職業：</span>${_logos}`;
    }

    // ⚖️ 負重：計入負重的裝備（武器/防具/飾品）顯示重量
    if ((d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') && ITEM_WEIGHTS[d.n] !== undefined) {
        desc += `<br><span class="text-amber-300">重量: ${ITEM_WEIGHTS[d.n]}</span>`;
    }

    // 🔧 安定值 / 無法強化（武器/防具/飾品）
    if (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') {
        if (d.noEnhance) desc += `<br><span class="text-rose-300 font-bold">無法強化</span>`;
        else desc += `<br><span class="text-slate-400">安定值: ${d.safe || 0}</span>`;
    }

    return desc;
}

function compareCardHTML(eqItem, slotLabel) {
    let ed = DB.items[eqItem.id];
    if(!ed) return `<div class="text-emerald-300 text-xs font-bold mb-1">【${slotLabel}】</div><div class="text-slate-500 text-sm">（無資料）</div>`;
    let glow = getGlowClass(eqItem, ed);
    let icon = `<img src="${getIconUrl(ed)}" onerror="this.style.display='none';" class="w-7 h-7 mr-2 object-contain pointer-events-none ${glow}">`;
    let header = `<div class="flex items-center font-bold text-lg ${getItemColor(eqItem)} border-b border-slate-700 pb-2 mb-2">${icon}<span>${getItemFullName(eqItem)}</span></div>`;
    let body = buildItemDescHTML(eqItem);
    return `<div class="text-emerald-300 text-xs font-bold mb-1">【${slotLabel}】</div>${header}<div class="text-sm text-slate-300 leading-relaxed">${body}</div>`;
}

function openModal(item, isEq, slot) {
    let d = DB.items[item.id];
    if(!d) return;
    if (!isEq && item.id === 'candle') { startRespec(); return; }   // 🕯️ 回憶蠟燭：點擊物品直接進入配點重置（不開物品視窗、不顯示使用按鈕）

    let lockIcon = item.lock ? '🔒' : '🔓';
    let lockBtnHTML = !isEq ? `<span id="modal-lock-icon" class="text-xl cursor-pointer hover:text-red-400" onclick="toggleLock('${item.uid}')">${lockIcon}</span>` : '';
    
    let imgUrl = getIconUrl(d);
    // 👇 加入螢光判定
    let glowClass = getGlowClass(item, d);
    let iconHtml = `<img src="${imgUrl}" onerror="this.style.display='none';" class="w-8 h-8 mr-2 object-contain pointer-events-none ${glowClass}">`;
    
    let _legendTag = (d && d.legend) ? ` <span class="c-legend text-sm font-bold border border-amber-600/70 rounded px-1.5 py-0.5">傳說</span>` : '';   // 🏅 傳說武器：名字右方標註
    document.getElementById('modal-item-name').innerHTML = `<div class="flex items-center">${iconHtml}<span>${getItemFullName(item)}${_legendTag}</span></div> ${lockBtnHTML}`;
    document.getElementById('modal-item-name').className = `text-2xl font-bold mb-3 border-b border-slate-600 pb-3 flex justify-between items-center ${getItemColor(item)}`;
    
    let desc = buildItemDescHTML(item);
    
    let sellPrice = getSellPrice(item);

    // 只要是放在背包裡的物品，都顯示販賣價格
    if (!isEq) {
         desc += `<br><span class="text-yellow-400 mt-2 block">販賣價格: ${sellPrice} 金幣</span>`;
    }
    
    document.getElementById('modal-item-desc').innerHTML = desc;
    
    let act = '';
    if (isEq) {
        // 🔧 詛咒裝備無法卸下：按鈕變灰並禁用
        if (item.bless === 'cursed') {
            act += `<button class="col-span-2 w-full btn border-slate-600 bg-slate-700 text-slate-400 py-3 text-lg font-bold cursor-not-allowed" disabled title="被詛咒的裝備無法卸下，需先解除詛咒">🔒 詛咒中・無法卸除</button>`;
        } else {
            act += `<button class="col-span-2 w-full btn border-red-700 bg-red-900 hover:bg-red-800 text-red-200 py-3 text-lg font-bold" onclick="unequipItem('${slot}')">卸除</button>`;
        }
    } else {
        if(d.type === 'pot' || d.type === 'skillbk' || ((d.type === 'misc' || d.type === 'etc') && d.eff && !d.noUse)) {   // 🔧 misc/etc 且有效果(萬能藥/回憶蠟燭/靈魂之球/頑皮幼龍蛋等)亦顯示使用按鈕；noUse 除外
            act += `<button class="col-span-2 w-full btn border-green-700 bg-emerald-800 hover:bg-emerald-700 text-green-100 py-3 text-lg font-bold" onclick="useItem('${item.uid}')">使用</button>`;
        }
        if(d.type === 'scroll') {
            act += `<button class="col-span-2 w-full btn border-green-700 bg-emerald-800 hover:bg-emerald-700 text-green-100 py-3 text-lg font-bold" onclick="useItem('${item.uid}')">使用卷軸</button>`;
        }
        if(d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') {
            act += `<button class="col-span-2 w-full btn border-blue-700 bg-blue-900 hover:bg-blue-800 text-blue-200 py-3 text-lg font-bold" onclick="equipItem(${JSON.stringify(item).replace(/"/g, '&quot;')})">裝備</button>`;
        }
        
        // 把販賣按鈕移出來，讓所有道具都可以賣
        if (!item.lock) {
            act += `<button class="btn border-orange-700 bg-orange-900 hover:bg-orange-800 py-2 text-base font-bold" onclick="sellItem('${item.uid}', 1, ${sellPrice})">販賣</button>
                    <button class="btn border-orange-700 bg-orange-900 hover:bg-orange-800 py-2 text-base font-bold" onclick="sellItem('${item.uid}', ${item.cnt}, ${sellPrice})">全部賣出</button>`;
        }
    }

    // 👇 修改：為武器、防具、飾品加入專屬的「強化」按鈕 (加入 !d.isArrow 防呆，箭矢不顯示強化按鈕)
    if (((d.type === 'wpn' && !d.isArrow) || d.type === 'arm' || d.type === 'acc') && !isMaxEnhanced(item) && !d.noEnhance && !traditionalActive()) {   // 🔧 已達淬鍊（強化上限）：隱藏強化按鈕；🏛️ 無法強化的裝備（古老系列）不顯示強化鈕；🏛️ 傳統模式：所有裝備皆無強化選項
        act += `<button class="col-span-2 w-full btn border-purple-700 bg-purple-900 hover:bg-purple-800 text-purple-200 py-3 text-lg font-bold mt-2" onclick="showEnhanceOptions('${item.uid}', ${isEq})">強化</button>`;
    }

    // 廢品勾選（所有背包道具：武器/防具/飾品/藥水/卷軸/魔法書/技能書/材料/試煉道具等）：
    //   勾選後，從「最後一次手動標示」起算 10 分鐘沒有新動作，系統才自動賣出（autoSellJunk·每次手動標示會重置倒數）；鎖定中無法勾選且會自動取消。
    if (!isEq && !(DB.items[item.id] && DB.items[item.id].noJunk)) {   // 🎴 noJunk(收集冊等)：不顯示「標記為廢品」
        let locked = !!item.lock;
        let checked = (item.junk && !locked) ? 'checked' : '';
        act += `<label class="col-span-2 w-full btn ${locked ? 'border-slate-700 bg-slate-800/50 opacity-50 cursor-not-allowed' : 'border-amber-700 bg-amber-950 hover:bg-amber-900 cursor-pointer'} py-2 text-base font-bold flex items-center justify-center gap-2 mt-2">`
             + `<input type="checkbox" class="w-4 h-4" ${checked} ${locked ? 'disabled' : ''} onchange="toggleJunk('${item.uid}')">`
             + `<span class="text-amber-200">標記為廢品${locked ? '（鎖定中無法標記）' : ''}</span></label>`;
    }

    document.getElementById('modal-actions').innerHTML = act;

    // === 旁邊顯示「目前裝備中」對應欄位，方便比對（僅背包中的武器/防具/飾品，箭矢除外）===
    let _cmp = document.getElementById('modal-compare');
    if(_cmp) {
        const SLOT_LABEL = { wpn:'武器', offwpn:'副手武器', helm:'頭盔', armor:'盔甲', shin:'脛甲', shield:'副手', cloak:'斗篷', tshirt:'內衣', gloves:'手套', boots:'鞋子', ring1:'戒指 1', ring2:'戒指 2', ring3:'戒指 3', ring4:'戒指 4', amulet:'項鍊', ear1:'耳環 1', ear2:'耳環 2', belt:'腰帶', pet:'寵物裝備',
            rem_claw:'席琳遺骸・之爪', rem_eye:'席琳遺骸・之眼', rem_blood:'席琳遺骸・之血', rem_flesh:'席琳遺骸・之肉', rem_heart:'席琳遺骸・之心', rem_bone:'席琳遺骸・之骨', rem_fang:'席琳遺骸・之牙', rem_scale:'席琳遺骸・之鱗' };   // 🦵 shin=脛甲（遺物新增部位）；🦴 rem_*＝席琳遺骸 8 格
        if(!isEq && !d.isArrow && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc')) {
            let slots = (d.type === 'wpn') ? ['wpn'] : (d.slot === 'ring' ? ['ring1','ring2','ring3','ring4'] : (d.slot === 'ear' ? ['ear1','ear2'] : [d.slot]));
            let cards = slots.map(sl => {
                let eq = player.eq[sl];
                let label = SLOT_LABEL[sl] || sl;
                return eq ? compareCardHTML(eq, label)
                          : `<div class="text-emerald-300 text-xs font-bold mb-1">【${label}】</div><div class="text-slate-500 text-sm">（此欄位目前未裝備）</div>`;
            });
            _cmp.innerHTML = `<div class="text-slate-300 text-sm font-bold border-b border-slate-600 pb-2 mb-3">目前裝備中（比對）</div>`
                           + cards.join('<div class="my-3 border-t border-dashed border-slate-700"></div>');
            _cmp.classList.remove('hidden');
        } else {
            _cmp.classList.add('hidden');
            _cmp.innerHTML = '';
        }
    }

    document.getElementById('item-modal').classList.remove('hidden');
}
// 👇 新增功能：返回裝備視窗
function returnToItemModal(uid, isEq) {
    let item = isEq ? Object.values(player.eq).find(e => e && e.uid === uid) : player.inv.find(i => i.uid === uid);
    if (item) {
        let slot = isEq ? Object.keys(player.eq).find(k => player.eq[k] === item) : undefined;
        openModal(item, isEq, slot);
    } else {
        closeModal();
    }
}

// 👇 修改後的功能：顯示選擇卷軸的介面
function showEnhanceOptions(uid, isEq) {
    let item = isEq ? Object.values(player.eq).find(e => e && e.uid === uid) : player.inv.find(i => i.uid === uid);
    if (!item) return;
    let d = DB.items[item.id];
    
    let scrollNorm, scrollBless, scrollCurse;
    let scrollNormId = ''; // 🌟 紀錄該裝備對應的一般卷軸 ID
    let scrollCurseId = ''; // 詛咒卷軸 ID（武器/盔甲）

    if (d.type === 'wpn') {
        scrollNormId = 'scroll_weapon';
        scrollNorm = player.inv.find(i => i.id === 'scroll_weapon');
        scrollBless = player.inv.find(i => i.id === 'scroll_weapon_b');
        scrollCurseId = 'scroll_weapon_c';
        scrollCurse = player.inv.find(i => i.id === 'scroll_weapon_c');
    } else if (d.type === 'arm') {
        scrollNormId = 'scroll_armor';
        scrollNorm = player.inv.find(i => i.id === 'scroll_armor');
        scrollBless = player.inv.find(i => i.id === 'scroll_armor_b');
        scrollCurseId = 'scroll_armor_c';
        scrollCurse = player.inv.find(i => i.id === 'scroll_armor_c');
    } else if (d.type === 'acc') {
        scrollNormId = 'scroll_acc';
        scrollNorm = player.inv.find(i => i.id === 'scroll_acc');
    }
    
    // 飾品特殊處理：若有卷軸直接點爆，不用選
    if (d.type === 'acc') {
        if (!scrollNorm) {
            logSys(`<span class="text-red-400 font-bold">強化卷軸不足。</span>`);
            return;
        }
        activeScroll = scrollNorm;
        doEnhance(item.uid, isEq);
        return;
    }
    
    // 武器/防具：如果一般／祝福／詛咒卷軸全都沒有，直接跳錯
    if (!scrollNorm && !scrollBless && !scrollCurse) {
        logSys(`<span class="text-red-400 font-bold">強化卷軸不足。</span>`);
        return;
    }
    
    // 如果有卷軸，將 Modal 畫面替換為「選擇卷軸介面」
    document.getElementById('modal-item-name').innerHTML = `強化 ${getItemFullName(item)}`;
    document.getElementById('modal-item-name').className = `text-xl font-bold mb-3 border-b border-slate-600 pb-3 text-purple-300`;
    document.getElementById('modal-item-desc').innerHTML = "請選擇你要使用的強化卷軸：";
    
    let act = '';
    if (scrollNorm) {
        act += `<button class="col-span-2 w-full btn border-slate-600 bg-slate-800 hover:bg-slate-700 py-3 text-base font-bold text-white shadow" onclick="executeEnhance('${scrollNorm.uid}', '${item.uid}', ${isEq})">使用 ${DB.items[scrollNorm.id].n} (擁有: ${scrollNorm.cnt})</button>`;
    }
    if (scrollBless) {
        act += `<button class="col-span-2 w-full btn border-yellow-600 bg-yellow-900 hover:bg-yellow-800 py-3 text-base font-bold text-yellow-300 shadow" onclick="executeEnhance('${scrollBless.uid}', '${item.uid}', ${isEq})">使用 ${DB.items[scrollBless.id].n} (擁有: ${scrollBless.cnt})</button>`;
    }
    if (scrollCurse) {
        act += `<button class="col-span-2 w-full btn border-red-800 bg-red-950 hover:bg-red-900 py-3 text-base font-bold c-cursed shadow" onclick="executeCurseDeEnhance('${item.uid}', ${isEq}, '${scrollCurseId}')">使用 ${DB.items[scrollCurse.id].n} (擁有: ${scrollCurse.cnt})｜強化值 -1</button>`;
    }
    
    // 🌟 一鍵強化到指定值：右側可選目標強化值（預設＝安定值），逐級嘗試，過程中任一階失敗即視為失敗（爆裝）
    let safe = d.safe || 0;
    if (scrollNorm && (d.type === 'wpn' || d.type === 'arm')) {
        let _cur = Number(item.en) || 0;
        let _max = Math.min(enhanceCap(d), Math.max(safe, _cur) + 6);   // 🔧 可選目標上限不超過淬鍊（強化上限）
        let _def = Math.min(_max, Math.max(safe, _cur + 1));
        let _opts = '';
        for (let _t = _cur + 1; _t <= _max; _t++) {
            _opts += `<option value="${_t}" ${_t === _def ? 'selected' : ''}>+${_t}${_t <= safe ? '（安定）' : ''}</option>`;
        }
        act += `<div class="col-span-2 flex gap-2 mt-2">`
            + `<button class="flex-1 btn border-blue-600 bg-blue-900 hover:bg-blue-800 py-3 text-base font-bold text-blue-300 shadow" onclick="executeAutoSafeEnhance('${item.uid}', ${isEq}, '${scrollNormId}', Number(document.getElementById('auto-enh-target').value))">一鍵強化到指定值</button>`
            + `<select id="auto-enh-target" class="btn border-blue-700 bg-slate-800 text-blue-200 font-bold px-2 py-3 rounded shadow">${_opts}</select>`
            + `</div>`;
    }
    
    act += `<button class="col-span-2 w-full btn py-3 bg-slate-700 text-lg font-bold mt-2" onclick="returnToItemModal('${item.uid}', ${isEq})">返回</button>`;
    
    document.getElementById('modal-actions').innerHTML = act;
}

// 👇 一鍵強化到指定值：逐級嘗試直到目標值。安定值前必定成功；安定值起依固定機率，
//    過程中任一階失敗即爆裝（視為失敗）；卷軸用盡則停在目前等級。
function executeAutoSafeEnhance(targetUid, isEq, scrollId, goal) {
    let target;
    if (isEq) {
        target = Object.values(player.eq).find(e => e && e.uid === targetUid);
    } else {
        target = player.inv.find(i => i.uid === targetUid);
    }

    if (!target) return;
    target.en = Number(target.en) || 0;   // 🔧 舊存檔 en 可能為 undefined：統一正規化為有效數字

    let d = DB.items[target.id];
    let safe = d.safe || 0;
    let slot = isEq ? Object.keys(player.eq).find(k => player.eq[k] === target) : null;

    // 目標值防呆：必須高於目前強化值，且不超過強化上限（淬鍊）
    goal = Math.min(Number(goal) || 0, enhanceCap(d));
    if (goal <= target.en) {
        logSys(`<span class="text-red-400 font-bold">目標強化值必須高於目前 (+${target.en})。</span>`);
        return;
    }

    // 尋找背包裡的一般卷軸
    let scrollItem = player.inv.find(i => i.id === scrollId);
    let scrollName = DB.items[scrollId] ? DB.items[scrollId].n : "強化卷軸";
    if (!scrollItem || scrollItem.cnt <= 0) {
        logSys(`<span class="text-red-400 font-bold">${scrollName} 數量不足。</span>`);
        return;
    }

    // 堆疊保護：若強化的是「背包」裡且數量大於 1 的裝備，拆分出一件來衝
    if (!isEq && target.cnt > 1) {
        target.cnt -= 1;
        let singleItem = { ...target, cnt: 1, uid: uid() };
        player.inv.push(singleItem);
        target = singleItem;
    }

    let fn0 = getItemFullName(target);
    let used = 0, destroyed = false, hadRisk = false, ranOut = false;

    // 逐級強化，直到抵達目標、卷軸用盡或爆裝
    while (target.en < goal) {
        if (!scrollItem || scrollItem.cnt <= 0) { ranOut = true; break; }
        // 消耗一張卷軸
        scrollItem.cnt -= 1; used += 1;
        if (scrollItem.cnt <= 0) {
            player.inv = player.inv.filter(i => i.uid !== scrollItem.uid);
            scrollItem = null;
        }

        if (target.en < safe) {
            target.en += 1;   // 安定值前必定成功
        } else {
            hadRisk = true;
            let en = target.en, rate;
            if (d.type === 'wpn') {                       // 武器一律安定值6
                rate = en === 6 ? 0.60 : en === 7 ? 0.50 : en === 8 ? 0.40 : 0.35;
            } else if (d.type === 'acc') {                // 飾品：一律安定值0
                rate = en === 0 ? 0.50 : en === 1 ? 0.40 : en === 2 ? 0.30 : 0.20;
            } else if (safe === 0) {                      // 防具：安定值0
                rate = en <= 4 ? 0.50 : en === 5 ? 0.40 : en === 6 ? 0.30 : 0.20;
            } else if (safe === 4) {                      // 防具：安定值4
                rate = en === 4 ? 0.50 : en === 5 ? 0.40 : en === 6 ? 0.30 : 0.20;
            } else {                                      // 防具：安定值6（其餘安定值防呆比照）
                rate = en === safe ? 0.30 : 0.20;
            }
            if (Math.random() < rate) {   // 🎲 即時擲骰：成敗純機率（與單抽 doEnhance 同一套機率表）
                target.en += 1;   // 成功
            } else {
                destroyed = true; // 失敗即爆裝，過程視為失敗
                break;
            }
        }
    }

    if (destroyed) {
        if (isEq) { if (slot) player.eq[slot] = null; }
        else { player.inv = player.inv.filter(i => i.uid !== target.uid); }
        logSys(`消耗了 ${used} 張 ${scrollName}。<span class="text-red-500 font-bold">${fn0} 強烈的發出銀色的光芒就消失了。</span>`);
    } else if (ranOut) {
        logSys(`${scrollName} 不足，消耗了 ${used} 張，<span class="text-yellow-400 font-bold">+${target.en} ${d.n} 發出銀色的光芒。</span>`);
    } else {
        let prefix = hadRisk ? `<span class="text-green-300 font-bold">強化成功！</span>` : '';
        logSys(`${prefix}消耗了 ${used} 張 ${scrollName}，<span class="text-yellow-400 font-bold">+${target.en} ${d.n} 發出銀色的光芒。</span>`);
    }

    calcStats();
    renderTabs();
    closeModal();
    saveGame();
}

function executeEnhance(scrollUid, targetUid, isEq) {
    let scroll = player.inv.find(i => i.uid === scrollUid);
    if (!scroll) return;
    activeScroll = scroll;
    doEnhance(targetUid, isEq);
}

// 詛咒卷軸：消耗 1 個，使裝備強化值 -1（100% 成功、不爆裝）
function executeCurseDeEnhance(targetUid, isEq, scrollId) {
    let target = isEq ? Object.values(player.eq).find(e => e && e.uid === targetUid) : player.inv.find(i => i.uid === targetUid);
    if (!target) return;
    target.en = Number(target.en) || 0;
    let d = DB.items[target.id];
    if (target.en <= 0) { logSys(`<span class="text-red-400 font-bold">${d.n} 已是 +0，無法再降低強化值。</span>`); return; }

    let scrollItem = player.inv.find(i => i.id === scrollId);
    let scrollName = DB.items[scrollId] ? DB.items[scrollId].n : "詛咒卷軸";
    if (!scrollItem || scrollItem.cnt <= 0) { logSys(`<span class="text-red-400 font-bold">${scrollName} 數量不足。</span>`); return; }

    // 堆疊保護：背包內數量 > 1 先拆一件出來降階
    if (!isEq && target.cnt > 1) {
        target.cnt -= 1;
        let single = { ...target, cnt: 1, uid: uid() };
        player.inv.push(single);
        target = single;
    }

    // 消耗 1 個詛咒卷軸
    scrollItem.cnt -= 1;
    if (scrollItem.cnt <= 0) player.inv = player.inv.filter(i => i.uid !== scrollItem.uid);

    target.en -= 1;   // 100% 成功降 1 階（強化已改純機率→重爬時各階自然重新擲骰，無需重骰身份）
    logSys(`消耗了 1 個 <span class="c-cursed">${scrollName}</span>，<span class="text-red-300 font-bold">+${target.en} ${d.n} 散發出黯淡的光芒。</span>`);

    calcStats();
    renderTabs();
    closeModal();
    saveGame();
}

// ========== ⚡ 快速強化（批次強化）==========
// 強化成功率（與 doEnhance/executeAutoSafeEnhance 同一套固定機率），安定值之前由呼叫端視為必定成功
function _enhanceRate(d, en, safe) {
    if (d.type === 'wpn') return en === 6 ? 0.60 : en === 7 ? 0.50 : en === 8 ? 0.40 : 0.35;   // 武器一律安定值6
    if (d.type === 'acc') return en === 0 ? 0.50 : en === 1 ? 0.40 : en === 2 ? 0.30 : 0.20;   // 飾品一律安定值0
    if (safe === 0)       return en <= 4 ? 0.50 : en === 5 ? 0.40 : en === 6 ? 0.30 : 0.20;    // 防具安定值0
    if (safe === 4)       return en === 4 ? 0.50 : en === 5 ? 0.40 : en === 6 ? 0.30 : 0.20;   // 防具安定值4
    return en === safe ? 0.30 : 0.20;                                                          // 防具安定值6（其餘比照）
}

// 該分頁可被批次強化的背包裝備（未鎖定；武器分頁＝武器(非箭矢)，防具分頁＝防具/飾品）
function _qeEligibleItems(type) {
    return player.inv.filter(i => {
        let d = DB.items[i.id]; if (!d || i.lock || d.noEnhance) return false;   // 🪆 無法強化(古老系列/魔法娃娃)不列入快速強化
        if (type === 'wpn') return d.type === 'wpn' && !d.isArrow;
        return d.type === 'arm' || d.type === 'acc';
    });
}

// 模擬單一件裝備從 startEn 強化到 goal：每階消耗對應卷軸，安定值前必成功、安定值起依機率，失敗即爆裝。
// scrollStacks 為 {scrollId:{cnt}} 的可變計數器（多件共用同一池），回傳 {en, destroyed, used}
function _quickEnhanceUnit(d, startEn, goal, scrollStacks, useBless) {
    let en = startEn, used = 0, destroyed = false;
    let safe = d.safe || 0;
    let cap = enhanceCap(d);
    goal = Math.min(goal, cap);   // 🔧 批次強化亦不超過各裝備的強化上限（淬鍊）
    let normalId = d.type === 'wpn' ? 'scroll_weapon' : (d.type === 'acc' ? 'scroll_acc' : 'scroll_armor');
    let blessId = d.type === 'wpn' ? 'scroll_weapon_b' : (d.type === 'arm' ? 'scroll_armor_b' : null);   // 🌟 飾品無祝福卷（scroll_acc_b 不存在）
    let bless = !!(useBless && blessId && DB.items[blessId]);   // 此類型有祝福卷才套用；飾品恆走一般卷
    let scrollId = bless ? blessId : normalId;
    while (en < goal) {
        let st = scrollStacks[scrollId];
        if (!st || st.cnt <= 0) break;   // 卷軸用盡：停在目前等級（不爆裝）
        st.cnt -= 1; used += 1;
        let ok = (en < safe) || (Math.random() < _enhanceRate(d, en, safe));   // 安定值前必成功；之後依機率（🎲 即時擲骰，可 save/load 重抽）
        if (!ok) { destroyed = true; break; }   // 失敗即爆裝
        let add = bless ? (1 + Math.floor(Math.random() * 3)) : 1;   // 🌟 祝福卷成功時隨機 +1~+3（純機率）；一般卷 +1
        en = Math.min(cap, en + add);   // 跳級不超過淬鍊上限
    }
    return { en, destroyed, used };
}

function buildQuickEnhanceHeader(type) {
    let st = quickEnh[type];
    let hdr = document.createElement('div');
    hdr.className = 'sticky top-0 z-10 bg-slate-800 pb-2';   // 🔧 遮擋條改用與框底色(.panel=#1e293b=slate-800)相同色→融入面板不突兀；仍為不透明：滾動時物品不會從按鈕上/下方透出
    // 🔧 表頭上緣亦覆蓋容器的 12px 上內距(p-3)：往上拉時 sticky 黏在裁切邊(top/margin-top:-12)、paddingTop:12 維持按鈕原位 → 物品也不會從按鈕「上方」透出（滾動後＝滾動前）。用 inline style（Tailwind CDN JIT 不保證新 class 即時生成）
    hdr.style.top = '-12px'; hdr.style.marginTop = '-12px'; hdr.style.paddingTop = '12px';
    if (!st.active) {
        hdr.innerHTML = `<button onclick="toggleQuickEnhance('${type}')" class="w-full btn border-blue-700 bg-blue-900/70 hover:bg-blue-800 py-1.5 text-sm font-bold text-blue-200 rounded shadow">⚡ 快速強化</button>`;
        return hdr;
    }
    let eligible = _qeEligibleItems(type);
    let allSel = eligible.length > 0 && eligible.every(i => st.sel[i.uid]);
    let someSel = eligible.some(i => st.sel[i.uid]);
    let curse = !!st.useCurse;   // 🔻 詛咒退階模式
    let target = st.target != null ? st.target : 6;   // ⚠ 不可用 `|| 6`：詛咒模式可選 +0，0 會被當 falsy 誤跳成 6
    let opts = '';
    for (let t = (curse ? 0 : 1); t <= 12; t++) opts += `<option value="${t}" ${t === target ? 'selected' : ''}>+${t}</option>`;   // 強化目標 +1~+12；詛咒退階可到 +0
    let _blessId = type === 'wpn' ? 'scroll_weapon_b' : 'scroll_armor_b';   // 🌟 祝福卷（飾品無祝福卷，仍以防具祝福卷數量顯示）
    let _blessCnt = (player.inv.find(i => i.id === _blessId) || {}).cnt || 0;
    let _curseId = type === 'wpn' ? 'scroll_weapon_c' : 'scroll_armor_c';   // 🔻 詛咒卷（飾品無詛咒卷，仍以防具詛咒卷數量顯示）
    let _curseCnt = (player.inv.find(i => i.id === _curseId) || {}).cnt || 0;
    hdr.innerHTML = `<div class="flex items-center gap-1 bg-slate-900/80 border ${curse ? 'border-red-800/70' : 'border-slate-700'} rounded p-1">
        <button onclick="cancelQuickEnhance('${type}')" class="btn border-slate-600 bg-slate-700 hover:bg-slate-600 px-2 py-1 text-xs font-bold text-white rounded">取消</button>
        <button onclick="runQuickEnhance('${type}')" class="btn ${curse ? 'border-red-600 bg-red-800 hover:bg-red-700 text-red-100' : 'border-blue-600 bg-blue-800 hover:bg-blue-700 text-blue-200'} px-2 py-1 text-xs font-bold rounded">${curse ? '退階' : '強化'}</button>
        <label class="flex items-center gap-1 text-xs ${curse ? 'text-slate-600' : (_blessCnt > 0 ? 'text-yellow-300' : 'text-slate-500')} cursor-pointer select-none whitespace-nowrap" title="勾選＝使用『祝福的卷軸』強化（成功時隨機 +1~+3）；不勾＝一般卷軸（+1）。飾品無祝福卷，恆以一般卷強化。"><input type="checkbox" ${st.useBless ? 'checked' : ''} ${curse ? 'disabled' : ''} onchange="setQuickBless('${type}',this.checked)"> 祝福卷(${_blessCnt})</label>
        <label class="flex items-center gap-1 text-xs ${_curseCnt > 0 ? 'text-red-300' : 'text-slate-500'} cursor-pointer select-none whitespace-nowrap" title="勾選＝改用『詛咒的卷軸』退階：把勾選裝備的強化值降回右側指定等級（每 -1 消耗 1 張、100% 成功、不爆裝）。飾品無詛咒卷、無法退階。"><input type="checkbox" ${curse ? 'checked' : ''} onchange="setQuickCurse('${type}',this.checked)"> 詛咒卷(${_curseCnt})</label>
        <select id="qe-target-${type}" onchange="quickEnh['${type}'].target=Number(this.value)" class="bg-slate-800 border border-slate-600 ${curse ? 'text-red-200' : 'text-blue-200'} text-xs font-bold rounded px-1 py-1 ml-auto" title="${curse ? '退回到此強化等級' : '目標強化等級'}">${opts}</select>
        <label class="flex items-center gap-1 text-xs text-slate-300 cursor-pointer select-none whitespace-nowrap"><input type="checkbox" ${allSel ? 'checked' : ''} onchange="quickEnhanceSelectAll('${type}', this.checked)"> 全選</label>
    </div>`;
    let cb = hdr.querySelector('input[onchange*="quickEnhanceSelectAll"]'); if (cb) cb.indeterminate = someSel && !allSel;   // 部分勾選顯示半選（精準選取全選框，避免被新增的祝福卷框搶到）
    return hdr;
}

// 注意：renderTabs 有「背包/裝備內容簽章」快取，內容未變會提早 return。快速強化只改 quickEnh 狀態（不在簽章內），
//       故這些切換一律用 renderTabs(true) 強制重建，否則畫面不會更新。
function toggleQuickEnhance(type) { if (quickJunk[type] && quickJunk[type].active) { quickJunk[type].active = false; quickJunk[type].sel = {}; } let st = quickEnh[type]; st.active = true; if (st.target == null) st.target = 6; st.sel = {}; renderTabs(true); }
function cancelQuickEnhance(type) { let st = quickEnh[type]; st.active = false; st.sel = {}; renderTabs(true); }
function quickEnhanceSelectAll(type, checked) { let st = quickEnh[type]; st.sel = {}; if (checked) _qeEligibleItems(type).forEach(i => st.sel[i.uid] = true); renderTabs(true); }
function toggleQuickItem(type, uid) { let st = quickEnh[type]; if (st.sel[uid]) delete st.sel[uid]; else st.sel[uid] = true; renderTabs(true); }
// 🌟🔻 祝福卷 / 詛咒卷 互斥（強化向上 vs 退階向下）：勾一邊自動取消另一邊；切回強化時把可能為 +0 的目標夾回 +1（強化下拉無 +0）
function setQuickBless(type, checked) { let st = quickEnh[type]; st.useBless = checked; if (checked) st.useCurse = false; if (!st.useCurse && st.target < 1) st.target = 1; renderTabs(true); }
function setQuickCurse(type, checked) { let st = quickEnh[type]; st.useCurse = checked; if (checked) st.useBless = false; else if (st.target < 1) st.target = 1; renderTabs(true); }

function runQuickEnhance(type) {
    if (traditionalActive()) return;   // 🏛️ 縱深防護：傳統模式不可批次強化
    let st = quickEnh[type];
    if (st.useCurse) return runQuickCurse(type);   // 🔻 詛咒退階模式
    let goal = Number((document.getElementById('qe-target-' + type) || {}).value) || st.target || 0;
    let entries = _qeEligibleItems(type).filter(i => st.sel[i.uid]);
    if (!entries.length) { logSys(`<span class="text-red-400 font-bold">尚未勾選任何裝備。</span>`); return; }

    // 三種卷軸共用計數池（武器/防具/飾品各自扣自己的卷軸）
    let scrollStacks = {};
    ['scroll_weapon', 'scroll_armor', 'scroll_acc', 'scroll_weapon_b', 'scroll_armor_b'].forEach(sid => {   // 🌟 含祝福卷（武器/防具）
        let it = player.inv.find(i => i.id === sid);
        scrollStacks[sid] = { cnt: it ? (it.cnt || 0) : 0 };
    });

    let reached = 0, destroyed = 0, partial = 0, skipped = 0, usedTotal = 0;
    let removeUids = new Set();
    let survivors = [];

    entries.forEach(entry => {
        let d = DB.items[entry.id];
        let cnt = entry.cnt || 1;
        removeUids.add(entry.uid);
        for (let u = 0; u < cnt; u++) {
            if ((entry.en || 0) >= Math.min(goal, enhanceCap(d))) { skipped++; survivors.push({ ...entry, cnt: 1, uid: uid() }); continue; }   // 已達/超過目標（或已達淬鍊上限）：原樣保留
            let r = _quickEnhanceUnit(d, entry.en || 0, goal, scrollStacks, st.useBless);   // 🌟 st.useBless＝使用祝福卷（強化成敗為即時擲骰）
            usedTotal += r.used;
            if (r.destroyed) { destroyed++; continue; }   // 爆裝：不保留
            if (r.en >= goal) reached++; else partial++;  // 抵達 or 卷軸不足停在中途
            survivors.push({ ...entry, cnt: 1, uid: uid(), en: r.en, lock: false });
        }
    });

    // 套用結果：移除原件 → 回寫卷軸 → 加入存活件（同簽章疊加）
    player.inv = player.inv.filter(i => !removeUids.has(i.uid));
    ['scroll_weapon', 'scroll_armor', 'scroll_acc', 'scroll_weapon_b', 'scroll_armor_b'].forEach(sid => {   // 🌟 含祝福卷回寫
        let it = player.inv.find(i => i.id === sid);
        if (it) { it.cnt = scrollStacks[sid].cnt; if (it.cnt <= 0) player.inv = player.inv.filter(x => x.uid !== it.uid); }
    });
    survivors.forEach(s => { let ex = player.inv.find(x => sameItemSig(x, s)); if (ex) ex.cnt = (ex.cnt || 1) + 1; else player.inv.push(s); });

    st.active = false; st.sel = {};
    let parts = [`成功 ${reached} 件`];
    if (partial) parts.push(`卷軸不足停 ${partial} 件`);
    if (skipped) parts.push(`已達標 ${skipped} 件`);
    parts.push(`<span class="text-red-400">爆裝 ${destroyed} 件</span>`);
    logSys(`<span class="text-blue-300 font-bold">快速強化完成（目標 +${goal}${st.useBless ? '·祝福卷' : ''}）：</span>${parts.join('、')}，消耗 ${usedTotal} 張${st.useBless ? '祝福' : ''}卷軸。`);
    calcStats();
    renderTabs(true);
    saveGame();
}

// 🔻 快速詛咒退階：用詛咒卷把勾選裝備的強化值降回目標等級（每 -1 消耗 1 張、100% 成功、不爆裝；飾品無詛咒卷跳過）
function runQuickCurse(type) {
    let st = quickEnh[type];
    let goal = Number((document.getElementById('qe-target-' + type) || {}).value);
    if (!Number.isFinite(goal)) goal = st.target || 0;
    let entries = _qeEligibleItems(type).filter(i => st.sel[i.uid]);
    if (!entries.length) { logSys(`<span class="text-red-400 font-bold">尚未勾選任何裝備。</span>`); return; }

    // 武器/防具各自扣自己的詛咒卷（共用計數池，多件同批扣同一池）
    let curseIds = ['scroll_weapon_c', 'scroll_armor_c'];
    let scrollStacks = {};
    curseIds.forEach(sid => { let it = player.inv.find(i => i.id === sid); scrollStacks[sid] = { cnt: it ? (it.cnt || 0) : 0 }; });

    let reached = 0, partial = 0, skipped = 0, noScroll = 0, usedTotal = 0;
    let removeUids = new Set();
    let survivors = [];

    entries.forEach(entry => {
        let d = DB.items[entry.id];
        let curseId = d.type === 'wpn' ? 'scroll_weapon_c' : (d.type === 'arm' ? 'scroll_armor_c' : null);   // 🌟 飾品(acc)無詛咒卷
        let cnt = entry.cnt || 1;
        removeUids.add(entry.uid);
        for (let u = 0; u < cnt; u++) {
            let en = entry.en || 0;
            if (!curseId) { noScroll++; survivors.push({ ...entry, cnt: 1, uid: uid() }); continue; }   // 飾品：原樣保留
            if (en <= goal) { skipped++; survivors.push({ ...entry, cnt: 1, uid: uid() }); continue; }   // 已在目標或更低
            let stk = scrollStacks[curseId];
            while (en > goal && en > 0 && stk.cnt > 0) { stk.cnt -= 1; en -= 1; usedTotal += 1; }   // 每 -1 消耗 1 張，100% 成功
            if (en <= goal) reached++; else partial++;   // 抵達 or 詛咒卷不足停在中途
            survivors.push({ ...entry, cnt: 1, uid: uid(), en: en, lock: false });
        }
    });

    // 套用結果：移除原件 → 回寫詛咒卷 → 加入存活件（同簽章疊加）
    player.inv = player.inv.filter(i => !removeUids.has(i.uid));
    curseIds.forEach(sid => { let it = player.inv.find(i => i.id === sid); if (it) { it.cnt = scrollStacks[sid].cnt; if (it.cnt <= 0) player.inv = player.inv.filter(x => x.uid !== it.uid); } });
    survivors.forEach(s => { let ex = player.inv.find(x => sameItemSig(x, s)); if (ex) ex.cnt = (ex.cnt || 1) + 1; else player.inv.push(s); });

    st.active = false; st.sel = {};
    let parts = [`退階 ${reached} 件`];
    if (partial) parts.push(`詛咒卷不足停 ${partial} 件`);
    if (skipped) parts.push(`已達標 ${skipped} 件`);
    if (noScroll) parts.push(`飾品無法退階 ${noScroll} 件`);
    logSys(`<span class="c-cursed font-bold">快速詛咒退階完成（退回 +${goal}）：</span>${parts.join('、')}，消耗 ${usedTotal} 張詛咒卷軸。`);
    calcStats();
    renderTabs(true);
    saveGame();
}

// ========== 🗑️ 快速廢品（批次標記廢品）==========
// 該分頁可批次標記廢品的背包物品（未鎖定）：wpn=武器(含箭矢)、arm=防具/飾品、item=其餘（藥水/卷軸/書/材料等）
function _qjEligibleItems(type) {
    return player.inv.filter(i => {
        let d = DB.items[i.id]; if (!d || i.lock || d.noJunk) return false;   // 🎴 noJunk(收集冊等)不納入快速廢品
        if (type === 'wpn') return d.type === 'wpn';
        if (type === 'arm') return d.type === 'arm' || d.type === 'acc';
        return d.type !== 'wpn' && d.type !== 'arm' && d.type !== 'acc';
    });
}
// ⚡🗑️ 分頁頂端快速操作表頭：武器/防具＝[快速強化][快速廢品]；道具＝[快速廢品]（強化進行中沿用原強化表頭）
function buildQuickHeader(type) {
    let hasEnh = (type === 'wpn' || type === 'arm') && !traditionalActive();   // 🏛️ 傳統模式：無強化→隱藏「快速強化」按鈕與面板（只保留快速廢品）
    if (hasEnh && quickEnh[type].active) return buildQuickEnhanceHeader(type);   // 強化進行中：沿用原強化表頭
    let jnk = quickJunk[type];
    if (jnk.active) _qjSync(type);   // 🔧 渲染前先同步新掉落物品到面板狀態（新廢品預先勾選），確認時才不會誤取消其標記
    let hdr = document.createElement('div');
    hdr.className = 'sticky top-0 z-10 bg-slate-800 pb-2';   // 🔧 遮擋條改用與框底色(.panel=#1e293b=slate-800)相同色→融入面板不突兀；仍為不透明：滾動時物品不會從按鈕上/下方透出
    // 🔧 表頭上緣亦覆蓋容器的 12px 上內距(p-3)：往上拉時 sticky 黏在裁切邊(top/margin-top:-12)、paddingTop:12 維持按鈕原位 → 物品也不會從按鈕「上方」透出（滾動後＝滾動前）。用 inline style（Tailwind CDN JIT 不保證新 class 即時生成）
    hdr.style.top = '-12px'; hdr.style.marginTop = '-12px'; hdr.style.paddingTop = '12px';
    if (jnk.active) {   // 快速廢品進行中：取消／確認／全選（無數值選擇）
        let eligible = _qjSelectAllItems(type);   // 🏺 全選框只反映非遺物的勾選狀態（遺物不受全選影響）
        let allSel = eligible.length > 0 && eligible.every(i => jnk.sel[i.uid]);
        let someSel = eligible.some(i => jnk.sel[i.uid]);
        hdr.innerHTML = `<div class="flex items-center gap-1 bg-slate-900/80 border border-amber-800/60 rounded p-1">
            <button onclick="cancelQuickJunk('${type}')" class="btn border-slate-600 bg-slate-700 hover:bg-slate-600 px-2 py-1 text-xs font-bold text-white rounded">取消</button>
            <button onclick="runQuickJunk('${type}')" class="btn border-amber-600 bg-amber-800 hover:bg-amber-700 px-2 py-1 text-xs font-bold text-amber-100 rounded">確認</button>
            <label class="flex items-center gap-1 text-xs text-slate-300 cursor-pointer select-none whitespace-nowrap ml-auto"><input type="checkbox" ${allSel ? 'checked' : ''} onchange="quickJunkSelectAll('${type}', this.checked)"> 全選</label>
        </div>`;
        let cb = hdr.querySelector('label input'); if (cb) cb.indeterminate = someSel && !allSel;
        return hdr;
    }
    // 皆未啟用：顯示按鈕（武器/防具有強化＋廢品；道具僅廢品）
    let btns = '';
    if (hasEnh) btns += `<button onclick="toggleQuickEnhance('${type}')" class="flex-1 btn border-blue-700 bg-blue-900/70 hover:bg-blue-800 py-1.5 text-sm font-bold text-blue-200 rounded shadow">⚡ 快速強化</button>`;
    btns += `<button onclick="toggleQuickJunk('${type}')" class="flex-1 btn border-amber-700 bg-amber-900/60 hover:bg-amber-800 py-1.5 text-sm font-bold text-amber-200 rounded shadow">🗑️ 快速廢品</button>`;
    hdr.innerHTML = `<div class="flex gap-1">${btns}</div>`;
    return hdr;
}
// 啟用快速廢品：取消同分頁快速強化＋預先勾選「已是廢品」者（用戶要求：廢品一開始就是勾選中）
function toggleQuickJunk(type) {
    if ((type === 'wpn' || type === 'arm') && quickEnh[type].active) { quickEnh[type].active = false; quickEnh[type].sel = {}; }
    let st = quickJunk[type]; st.active = true; st.sel = {}; st.known = {};
    _qjEligibleItems(type).forEach(i => { st.known[i.uid] = true; if (i.junk) st.sel[i.uid] = true; });   // 開啟當下：全部納入 known，已是廢品者預先勾選
    renderTabs(true);
}
// 🔧 面板開啟後才掉落／新增的可廢品物品：比照「開啟當下」納入面板——標記 known，且「已是廢品(junkPrefs 自動標記)」者預先勾選。
//    這樣確認時不會把這些新廢品當成「未勾選」而誤 i.junk=false＋刪除 junkPrefs（刪簽章＝整類廢品記憶被取消）。已在 known 者不再覆寫其勾選狀態（尊重使用者手動取消勾選）。
function _qjSync(type) {
    let st = quickJunk[type]; if (!st.active) return;
    if (!st.known) st.known = {};
    _qjEligibleItems(type).forEach(i => { if (!st.known[i.uid]) { st.known[i.uid] = true; if (i.junk) st.sel[i.uid] = true; } });
}
function cancelQuickJunk(type) { let st = quickJunk[type]; st.active = false; st.sel = {}; st.known = {}; renderTabs(true); }
// 🏺 「全選」的作用範圍排除遺物（用戶要求：全選不要順手把遺物標成廢品；遺物仍可逐件手動勾選）
function _qjSelectAllItems(type) { return _qjEligibleItems(type).filter(i => !isRelic(DB.items[i.id])); }
function quickJunkSelectAll(type, checked) {
    let st = quickJunk[type];
    _qjSelectAllItems(type).forEach(i => { if (checked) st.sel[i.uid] = true; else delete st.sel[i.uid]; });   // 只動非遺物：手動勾選的遺物不因全選／取消全選被改掉
    renderTabs(true);
}
function toggleQuickJunkItem(type, uid) { let st = quickJunk[type]; if (st.sel[uid]) delete st.sel[uid]; else st.sel[uid] = true; renderTabs(true); }
// 確認：依勾選最終狀態設定每件 junk（勾＝廢品、未勾＝取消廢品），同步 junkPrefs（記憶/取消記憶）
function runQuickJunk(type) {
    let st = quickJunk[type];
    _qjSync(type);   // 🔧 確認前再同步一次：戰鬥節流期間(renderTabs 被合併)剛掉落的廢品也納入並預先勾選，避免被當未勾選誤取消標記
    if (!player.junkPrefs) player.junkPrefs = {};
    let marked = 0, unmarked = 0;
    _qjEligibleItems(type).forEach(i => {
        let want = !!st.sel[i.uid];
        if (want === !!i.junk) return;   // 無變動
        i.junk = want;
        if (want) { player.junkPrefs[itemSig(i)] = true; delete i._userKeep; marked++; }
        else { delete player.junkPrefs[itemSig(i)]; unmarked++; if (i._ruleJunk) { i._userKeep = true; i._ruleJunk = false; delete i.junkSince; delete i._autoSellQty; } }   // 🛡️ v2.6.69 審計#10：取消「規則標記」的廢品→記住玩家意圖，自動販賣不再重標（直到重新儲存規則）
    });
    if (marked > 0) _bumpJunkSellTimer();   // 🗑️ 有新標記廢品→重置自動賣出倒數（標完 10 分鐘才賣）
    st.active = false; st.sel = {}; st.known = {};
    logSys(`<span class="text-amber-300 font-bold">快速廢品完成：</span>標記 ${marked} 件、取消 ${unmarked} 件。`);
    renderTabs(true);
    saveGame();
}

// 計算物品賣價（含詞綴疊乘）：與物品面板顯示價一致
function getSellPrice(item) {
    let d = DB.items[item.id];
    if (!d) return 0;
    let price = Math.floor((d.p || 0) * 0.3);   // 賣價為定價的 30%（經典模式與一般模式相同）
    let mult = 1;
    if (getAttrAffix(item.attr)) mult *= 10;
    if (item.bless === true) mult *= 10;   // 🔧 僅「祝福的」享 10 倍賣價；'cursed'（詛咒的）為負面詞綴不加價
    if (item.anc)   mult *= 10;
    return price * mult;
}

// 🗑️ 玩家手動標示廢品 → 把自動賣出倒數重置為 10 分鐘（標完 10 分鐘沒有新動作才會賣，避免剛標就被賣掉）。
//    ⚠️farming 自動標記（junkPrefs 命中掉落，js/04/js/08 gainItem）刻意不呼叫此函式，否則持續掉落會讓倒數永遠被重置、永不賣出。
function _bumpJunkSellTimer() {
    if (typeof state !== 'undefined' && state) state._junkSellAt = (state.ticks || 0) + JUNK_AUTOSELL_TICKS;
}

// 切換「廢品」勾選（僅背包內武器/防具/飾品；鎖定者無法勾選且自動取消）
function toggleJunk(uid) {
    let item = player.inv.find(i => i.uid === uid);
    if (!item) return;
    let d = DB.items[item.id];
    if (!d) return;
    if (!player.junkPrefs) player.junkPrefs = {};
    if (item.lock) { item.junk = false; openModal(item, false); return; }
    if (d.noJunk) { item.junk = false; delete player.junkPrefs[itemSig(item)]; openModal(item, false); return; }   // 🎴 收集冊等 noJunk：無法標示為廢品
    item.junk = !item.junk;
    // 🔧 記憶廢品勾選（依完整簽章 id＋詞綴）：之後獲得「完全相同詞綴」的同種物品自動標記，直到玩家取消勾選為止
    if (item.junk) { player.junkPrefs[itemSig(item)] = true; delete item._userKeep; _bumpJunkSellTimer(); }   // 🗑️ 標為廢品→重置自動賣出倒數（標完 10 分鐘才賣）
    else { delete player.junkPrefs[itemSig(item)]; if (item._ruleJunk) { item._userKeep = true; item._ruleJunk = false; delete item.junkSince; delete item._autoSellQty; } }   // 🛡️ v2.6.69 審計#10：取消「規則標記」→ 記住玩家意圖，applyAutoSellRules 不再重標（防呆說明「可取消廢品標記」自此屬實）
    openModal(item, false);
    renderTabs();
}

// 一鍵排列：依規則重新排序背包（武器 / 防具飾品 / 道具 各自分頁內排序）
// ===== 🔧 物品排序比較器（背包「一鍵排列」與倉庫「一鍵排列」共用，規則完全相同）=====
const invSortCmp = (function () {
    // 防具/飾品「特效」判定：基底物品具有 AC 以外的加成欄位即視為有特效
    const MUNDANE = new Set(['n','type','slot','ac','req','safe','p','c','d','img','gachaWeight','unBonus']);
    let hasArmEffect = (d) => { for (let k in d) { if (!MUNDANE.has(k) && d[k]) return true; } return false; };
    // 詞綴數量
    let affCount = (i) => (getAttrAffix(i.attr) ? 1 : 0) + (i.bless ? 1 : 0) + (i.anc ? 1 : 0);
    // 詞綴類型優先：屬性 > 遠古 > 祝福（負值代表 a 在上）
    let affixTypeCmp = (a, b) => {
        let x = (getAttrAffix(a.attr) ? 1 : 0) - (getAttrAffix(b.attr) ? 1 : 0); if (x) return -x;
        let y = (a.anc ? 1 : 0) - (b.anc ? 1 : 0); if (y) return -y;
        let z = (a.bless ? 1 : 0) - (b.bless ? 1 : 0); if (z) return -z;
        return 0;
    };
    let catRank = (d) => d.type === 'wpn' ? 0 : ((d.type === 'arm' || d.type === 'acc') ? 1 : 2);
    // 道具是否可手動使用（點選）
    let isUsable = (i, d) => {
        if (d.type === 'pot') return true;
        if (d.type === 'scroll') return i.id !== 'scroll_revive';   // 復活卷軸無法從道具欄使用
        if (d.type === 'misc') return !!d.eff;                       // 有效果(回憶蠟燭等)才可使用
        if (d.type === 'skillbk') {
            let sk = DB.skills[d.sk]; if (!sk) return false;
            let cls = skillReqLv(sk, d.sk);   // 🏅 集中化：含魔導精通特例
            return cls !== undefined && !player.skills.includes(d.sk);   // 可學且未學 → 可點選
        }
        return false;
    };
    // 道具群組：0 消耗道具、1 魔法書、2 精靈水晶、3 技術書
    let bkGroup = (d) => {
        if (d.type !== 'skillbk') return 0;
        let n = d.n || '';
        if (n.startsWith('魔法書')) return 1;
        if (n.startsWith('精靈水晶')) return 2;
        return 3;
    };
    let tierOf = (d) => { let sk = DB.skills[d.sk]; return sk ? (sk.tier || 1) : 0; };
    let nameCmp = (da, db) => (da.n || '').localeCompare(db.n || '');

    return function (ia, ib) {
        let da = DB.items[ia.id], db = DB.items[ib.id];
        if (!da || !db) return 0;
        let ca = catRank(da), cb = catRank(db);
        if (ca !== cb) return ca - cb;

        if (ca === 0) { // 武器：🔧 強化值高→上；相同再依 詞綴數量 → 屬性>遠古>祝福 → 攻擊力 → 名稱
            if ((ib.en || 0) !== (ia.en || 0)) return (ib.en || 0) - (ia.en || 0);   // 強化值高優先
            let c = affCount(ib) - affCount(ia); if (c) return c;                     // 強化值相同→詞綴數量
            let t = affixTypeCmp(ia, ib); if (t) return t;                            // →詞綴類型(屬性>遠古>祝福)
            let pa = (da.dmgS || 0) + (da.dmgL || 0), pb = (db.dmgS || 0) + (db.dmgL || 0);
            if (pa !== pb) return pb - pa;                                            // →攻擊力高→上
            return nameCmp(da, db);
        }
        if (ca === 1) { // 防具/飾品：🔧 強化值高→上；相同再依 詞綴數量 → 屬性>遠古>祝福 → 有特效 → AC高 → 名稱
            if ((ib.en || 0) !== (ia.en || 0)) return (ib.en || 0) - (ia.en || 0);   // 強化值高優先
            let c = affCount(ib) - affCount(ia); if (c) return c;                     // 強化值相同→詞綴數量
            let t = affixTypeCmp(ia, ib); if (t) return t;                            // →詞綴類型
            let ea = hasArmEffect(da) ? 1 : 0, eb = hasArmEffect(db) ? 1 : 0;
            if (ea !== eb) return eb - ea;
            if ((da.ac || 0) !== (db.ac || 0)) return (db.ac || 0) - (da.ac || 0);
            return nameCmp(da, db);
        }
        // 道具：可點選 → 不可點選；可點選內 消耗道具→魔法書→精靈水晶→技術書，書籍依階級高→低；不可點選依名稱
        let ua = isUsable(ia, da) ? 0 : 1, ub = isUsable(ib, db) ? 0 : 1;
        if (ua !== ub) return ua - ub;
        if (ua === 0) {
            let ga = bkGroup(da), gb = bkGroup(db);
            if (ga !== gb) return ga - gb;
            if (ga === 0) return nameCmp(da, db);          // 消耗道具：名稱
            let tdiff = tierOf(db) - tierOf(da); if (tdiff) return tdiff;   // 書籍：階級高→上
            return nameCmp(da, db);
        }
        return nameCmp(da, db);                            // 不可點選：名稱
    };
})();

// 🔧 v2.6.73 一鍵排列改「獲得物品時自動觸發」（gainItem 尾端掛點）：每 10 秒最多 1 次·靜默（不 saveGame·排序結果隨其他存檔點落地）
// 🔧 v2.6.80 與「啟用自動販賣」合併控制（用戶要求）：player.autoSellOn=false 時自動排列一併停用
let _autoSortAt = -99999;
function autoSortInventory() {
    if (!player || !Array.isArray(player.inv) || typeof state === 'undefined' || !state.running) return;   // 遊戲未開始（創角配發起始道具等）不排
    if (player.autoSellOn === false) return;   // 🔗 與自動販賣同開關（undefined 視為開）
    if (_anyQuickSelectActive()) return;   // 🗑️⚡ 選擇模式進行中不排序（sort+force 重繪會繞過凍結守衛，害清單位移點不到）
    if (state.ticks - _autoSortAt < 100) return;   // ⏲️ 10 秒節流（100 ticks）
    _autoSortAt = state.ticks;
    player.inv.sort(invSortCmp);
    renderTabs(true);
}
// 🔧 v2.6.80 規則視窗「立即一鍵排列」：純排序＋提示·不 saveGame（避免把視窗草稿規則一併落地·排序結果隨其他存檔點落地）·視窗保持開啟
function sortInventoryNow() {
    if (!player || !Array.isArray(player.inv)) return;
    player.inv.sort(invSortCmp);
    renderTabs(true);
    logSys('<span class="text-cyan-300 font-bold">背包已重新排列。</span>');
}
// 🔧 v2.6.74 自動化設定改「分頁內嵌」（#tab-automation·與能力/技能同框架·switchTab 切換）；v2.6.73 的浮動視窗與 toggleAutomationWindow 已移除。
//    set-* 控制項恆在 DOM（分頁隱藏時仍可 getElementById 讀值）→ saveGame/自動化邏輯完全不受影響。
function sortInventory() {
    player.inv.sort(invSortCmp);

    renderTabs();
    saveGame();
    logSys('<span class="text-cyan-300 font-bold">背包已重新排列。</span>');
}

// 一鍵賣出所有已勾為廢品的武器/防具/飾品（鎖定者不會被賣，因鎖定時已自動取消勾選）
// ⏲️ 自動賣出廢品：由主迴圈 tick（每 10 秒·JUNK_AUTOSELL_TICKS）呼叫；賣掉所有標示為廢品(且非鎖定/可販售)的物品。無廢品→靜默不洗版。
//    ⚡ 2026-07-01 效能：自動路徑（manual 未帶）賣出後「不 saveGame」——避免每 10 秒都壓縮整包存檔；賣掉的廢品/金幣靠其他既有存檔點(頭目擊殺/換地圖/裝備/操作/手動存檔)落地，崩潰重載最多回到未賣狀態(廢品仍在→下輪重標再賣·自癒)。手動「一鍵賣出」仍立即 saveGame。
function autoSellJunk(manual) {   // manual=true → 玩家按「一鍵賣出」立即賣(並存檔)；不帶參數＝主迴圈自動賣(靜默·不存檔)
    if (!player || !Array.isArray(player.inv)) return;
    if (!manual && typeof applyAutoSellRules === 'function') applyAutoSellRules();
    let _delayMs = manual ? 0 : ((typeof getAutoSellRules === 'function' ? getAutoSellRules().delaySec : 10) * 1000);
    let _now = Date.now();
    let toSell = player.inv.filter(i => {
        let d = DB.items[i.id];
        if (i.junk && !i.junkSince) i.junkSince = _now;
        return i.junk && !i.lock && d && !d.noSell && (manual || (_now - i.junkSince >= _delayMs));
    });
    if (toSell.length === 0) { if (manual) logSys('<span class="text-slate-400">目前沒有標記為廢品的物品可賣出（請先在 武器／防具／道具 分頁用「🗑️ 快速廢品」標記）。</span>'); return; }   // 無廢品→自動靜默、手動給提示
    let totalGold = 0, totalCount = 0;
    toSell.forEach(i => { let q = Math.min(i.cnt, i._autoSellQty || i.cnt); totalGold += getSellPrice(i) * q; totalCount += q; });
    let _grantSold = toSell.some(i => DB.items[i.id] && DB.items[i.id].grantSkills);
    toSell.forEach(i => { let q = Math.min(i.cnt, i._autoSellQty || i.cnt); i.cnt -= q; delete i._autoSellQty; if (i.cnt > 0) { i.junk = false; delete i.junkSince; } });
    player.inv = player.inv.filter(i => i.cnt > 0);
    player.gold += totalGold;
    logSys(`<span class="text-amber-300">${manual ? '一鍵賣出' : '系統自動賣出'} ${toSell.length} 件(共 ${totalCount} 個)廢品，獲得 <span class="text-yellow-400 font-bold">${totalGold}</span> 金幣。</span>`);
    renderTabs();
    updateUI();
    if(_grantSold) { calcStats(); renderSkillSelects(); }
    if(manual) saveGame();   // ⚡ 只有手動「一鍵賣出」才立即存檔；自動賣出不 saveGame（避免每 10 秒壓縮整包存檔·靠其他存檔點落地）
}

// 🗑️ 自動賣出開關（右上角按鈕）：點亮＝開啟自動賣出(每 10 秒)；點一下變暗、文字「停止賣出」並暫停。狀態存 player.autoSellOn(預設開·undefined 視為開)，隨存檔持久化。
function toggleAutoSell() {
    if (!player) return;
    player.autoSellOn = (player.autoSellOn === false);   // false→true(開)；true/undefined→false(停)
    _renderAutoSellBtn();
    if (typeof saveGame === 'function') saveGame();
}
function _renderAutoSellBtn() {
    let b = document.getElementById('btn-autosell'); if (!b) return;
    let on = !player || player.autoSellOn !== false;   // 預設(undefined)＝開
    b.textContent = on ? '自動賣出' : '停止賣出';
    b.style.opacity = on ? '' : '0.4';            // 變暗＝停止
    b.style.filter = on ? '' : 'grayscale(0.85)';
    b.title = on ? '自動販賣＋自動排列已開啟（每 10 秒賣出標記廢品；獲得物品自動排列背包）。' : '自動販賣＋自動排列已停止。';   // 🔗 v2.6.80 兩者合併同一開關（as-on 勾選）
}

// ===== 自動販賣規則（初版） =====
function getAutoSellRules() {
    if (!player.autoSellRules) player.autoSellRules = {
        delaySec: 60,
        protectBless: true, protectAnc: true, protectAttr: true, protectSet: true, protectLegend: true, protectOldSeries: true,
        protectRelic: true,
        protectCraftEquip: true, craftSets: 1,
        equip: { wpn: { on:false, max:0 }, arm: { on:false, max:0 }, acc: { on:false, max:0 } },
        misc: {}, overrides: {}
    };
    let r = player.autoSellRules;
    if (!r.equip) r.equip = {};
    ['wpn','arm','acc'].forEach(k => { if (!r.equip[k]) r.equip[k] = { on:false, max:0 }; });
    if (!r.misc) r.misc = {};
    if (!r.overrides) r.overrides = {};
    if (r.delaySec == null) r.delaySec = 60;
    ['protectBless','protectAnc','protectAttr','protectSet','protectLegend'].forEach(k => { if (r[k] == null) r[k] = true; });   // 🔧 v2.6.77 加 保護傳說裝備（預設開）
    if (r.protectOldSeries == null) r.protectOldSeries = true;   // 🏛️ v2.7.56 保護解封後古老系列（預設開）
    if (r.protectRelic == null) r.protectRelic = true;   // 🏺 保護遺物（預設開）
    if (r.protectCraftEquip == null) r.protectCraftEquip = true;
    if (r.craftSets == null) r.craftSets = 1;
    return r;
}
// ===== 🔧 v2.6.91 合併 2683 參考版 5 功能 =====
// 功能5：套用全部存檔（8 角色共用自動販賣設定·存全域 localStorage·各角色載入時套用）
const AUTOSELL_GLOBAL_KEY = 'lineage_idle_autosell_global_v1';
function _autoSellClone(v){ return JSON.parse(JSON.stringify(v)); }
function _getGlobalAutoSellSettings(){
    try { let s=_lzGet(AUTOSELL_GLOBAL_KEY); if(!s)return null; let x=JSON.parse(s); return x&&x.enabled&&x.rules?x:null; } catch(e){ return null; }
}
function applyGlobalAutoSellSettings(){
    let x=_getGlobalAutoSellSettings();
    if(x){ player.autoSellRules=_autoSellClone(x.rules); player.autoSellOn=x.on!==false; player.autoSellGlobal=true; }
    else player.autoSellGlobal=false;
}
function _saveGlobalAutoSellSettings(enabled){
    player.autoSellGlobal=!!enabled;
    if(enabled) _lzSet(AUTOSELL_GLOBAL_KEY,JSON.stringify({enabled:true,on:player.autoSellOn!==false,rules:_autoSellClone(getAutoSellRules())}));
    else _lsRemove(AUTOSELL_GLOBAL_KEY);
}
// 功能1：娃娃硬保護——原資料雖註明不可販賣，部分項目未帶 noSell/noJunk；資料表載入後統一補上。
Object.values(DB.items).forEach(d=>{if(d&&(d.doll||d.slot==='doll')){d.noSell=true;d.noJunk=true;}});
// 功能3/4：保護製作素材裝備——掃全部製作配方，算出「每種當素材的裝備」需求量（保留可製作 N 次的份量）
let _craftEquipNeedCache=null;
function _craftEquipNeeds(){
    if(_craftEquipNeedCache)return _craftEquipNeedCache;
    let out={};
    let add=rec=>{let mats=(rec&&((rec.req)||(rec.mats)))||[];if(rec&&rec.src)mats=mats.concat([{id:rec.src,cnt:1}]);mats.forEach(m=>{let id=m.id||m[0],n=Number(m.n||m.cnt||m[1]||0),d=DB.items[id];if(id&&n>0&&_asEquipType(d))out[id]=Math.max(out[id]||0,n);});};
    try{if(typeof CRAFT_RECIPES!=='undefined')Object.values(CRAFT_RECIPES).flat().forEach(add);}catch(e){}
    try{if(typeof DEMONKING_RECIPES!=='undefined')DEMONKING_RECIPES.forEach(add);}catch(e){}
    try{if(typeof LUMIEL_RECIPES!=='undefined')LUMIEL_RECIPES.forEach(add);}catch(e){}
    try{if(typeof MYSTICWAND_RECIPES!=='undefined')MYSTICWAND_RECIPES.forEach(add);}catch(e){}   // 🔮 鋼鐵瑪那魔杖改造：來源魔杖（瑪那魔杖／力量魔法杖）也是製作素材，別被自動販賣賣掉
    return (_craftEquipNeedCache=out);
}
function _craftReserveMap(r){let x={};if(r.protectCraftEquip){let sets=Math.max(1,Number(r.craftSets)||1);Object.entries(_craftEquipNeeds()).forEach(([id,n])=>x[id]=n*sets);}return x;}
function _asTypeLabel(t) {
    return ({pot:'藥水',scroll:'卷軸',book:'魔法書／技能書',skillbk:'技能書',mat:'材料',gem:'寶石',etc:'製作材料',misc:'特殊道具',quest:'任務道具',wpn:'武器',arm:'防具',acc:'飾品'})[t] || t;
}
function _asEquipType(d) {
    if (!d) return null;
    if (d.type === 'wpn' && !d.isArrow) return 'wpn';
    if (d.type === 'arm') return 'arm';
    if (d.type === 'acc') return 'acc';
    return null;
}
function _autoSellDecision(i, ruleSnapshot, craftRemain) {   // 🔧 v2.6.77 ruleSnapshot：預覽用「快照複本」判定，不讀（也不寫）live 規則；v2.6.91 craftRemain：製作素材保留額度（逐件扣）
    let r = ruleSnapshot || getAutoSellRules(), d = DB.items[i.id];
    if (!d || i.lock || d.noSell || d.noJunk) return { sell:false };
    if (i._userKeep) return { sell:false };   // 🛡️ v2.6.69 審計#10：玩家曾手動取消規則標記→豁免自動販賣（重新儲存規則時清除）
    let ov = r.overrides[i.id];
    if (ov === 'keep') return { sell:false };
    if (ov === 'sell') return { sell:true, qty:i.cnt };
    // 🏛️ v2.7.56 解除封印後的「古老的○○」是普通武器／防具，沒有詞綴且多數無法強化，會立即符合一般裝備販賣規則；整系列優先保護（個別「永遠販賣」例外仍優先，故置於 overrides 之後）。
    if (r.protectOldSeries && (String(i.id).startsWith('wpn_old_') || String(i.id).startsWith('amr_old_'))) return { sell:false };
    if (r.protectRelic !== false && typeof isRelic === 'function' && isRelic(d)) return { sell:false };   // 🏺 保護遺物（預設開·個別「永遠販賣」例外仍優先）
    let et = _asEquipType(d);
    if (et) {
        let protectedQty=0;   // 🔧 v2.6.91 功能3/4：製作素材裝備保留額度（保留可製作 N 次的數量·多餘才依規則賣）
        if(craftRemain&&craftRemain[i.id]>0){protectedQty=Math.min(Number(i.cnt)||1,craftRemain[i.id]);craftRemain[i.id]-=protectedQty;}
        let er = r.equip[et];
        if (!er || !er.on || (i.en || 0) > Number(er.max || 0)) return { sell:false };
        if ((r.protectBless && i.bless) || (r.protectAnc && i.anc) || (r.protectAttr && i.attr) || (r.protectSet && i.seteff) || (r.protectLegend && d.legend)) return { sell:false };   // 🔧 v2.6.77 保護傳說裝備
        return { sell:(Number(i.cnt)||1)>protectedQty, qty:Math.max(0,(Number(i.cnt)||1)-protectedQty) };
    }
    let mr = r.misc[d.type];
    if (!mr || !mr.on) return { sell:false };
    let keep = Math.max(0, Number(mr.keep || 0));
    return { sell:i.cnt > keep, qty:Math.max(0, i.cnt - keep) };
}
function applyAutoSellRules(force) {
    if (!player || !Array.isArray(player.inv)) return;
    if(player.autoSellOn===false&&!force){player.inv.forEach(i=>{if(i._ruleJunk){i.junk=false;delete i.junkSince;delete i._autoSellQty;delete i._ruleJunk;}});return;}   // 🔧 v2.6.91 功能2：停用自動販賣→清除規則產生的廢品標記（force=立即賣出時不清）
    let now = Date.now();
    let craftRemain=_craftReserveMap(getAutoSellRules());   // 🔧 v2.6.91 功能3/4：製作素材保留額度圖
    player.inv.forEach(i => {
        let x = _autoSellDecision(i,null,craftRemain);
        if (x.sell) {
            if (!i.junk) i.junkSince = now;
            i.junk = true; i._autoSellQty = x.qty;
        } else if (i._ruleJunk) {
            i.junk = false; delete i.junkSince; delete i._autoSellQty;
        }
        i._ruleJunk = !!x.sell;
    });
}
let _asBackup = null;   // 🛡️ v2.6.69 審計#11：規則視窗草稿制——開窗拍快照；Close＝還原（不生效）、儲存規則＝生效
function openAutoSellRules() {
    let r = getAutoSellRules();
    if (!_asBackup) _asBackup = { rules: JSON.parse(JSON.stringify(r)), on: player.autoSellOn, global:!!player.autoSellGlobal };   // 只在「第一次開窗」快照（setAutoSellOverride 重繪不覆蓋草稿基準）
    let old = document.getElementById('autosell-rule-modal'); if (old) old.remove();
    let miscTypes = [...new Set(Object.values(DB.items).filter(d => d && !_asEquipType(d)).map(d => d.type).filter(Boolean))].sort();
    let ids = Object.keys(DB.items).filter(id => DB.items[id]).sort((a,b) => (DB.items[a]?.n || a).localeCompare(DB.items[b]?.n || b, 'zh-Hant'));
    let exceptionTypes = [...new Set(ids.map(id => _asEquipType(DB.items[id]) || DB.items[id].type).filter(Boolean))].sort();
    let equipRows = [['wpn','武器'],['arm','防具'],['acc','飾品']].map(([k,n]) => `<label class="as-row"><input id="as-e-${k}" type="checkbox" ${r.equip[k].on?'checked':''}> ${n}，強化值 ≤ <input id="as-em-${k}" type="number" min="0" max="99" value="${r.equip[k].max}"> 自動販賣</label>`).join('');
    let miscRows = miscTypes.map(t => { let x=r.misc[t]||{on:false,keep:0}; return `<label class="as-row"><input class="as-misc" data-type="${t}" type="checkbox" ${x.on?'checked':''}> ${_asTypeLabel(t)}：每種保留 <input class="as-keep" data-type="${t}" type="number" min="0" value="${x.keep}"> 個，多餘販賣</label>`; }).join('');
    let itemRows = ids.map(id => `<option value="${id}">${DB.items[id]?.n || id}</option>`).join('');
    let exceptionTypeRows = exceptionTypes.map(t => `<option value="${t}">${_asTypeLabel(t)}</option>`).join('');
    let rules = Object.entries(r.overrides).map(([id,v]) => `<div class="as-ex"><span>${DB.items[id]?.n || id}</span><b>${v==='keep'?'永遠保留':'永遠販賣'}</b><button onclick="deleteAutoSellOverride('${id}')">刪除</button></div>`).join('') || '<div class="as-muted">目前沒有個別例外</div>';
    let el=document.createElement('div'); el.id='autosell-rule-modal'; el.innerHTML=`<style>
      #autosell-rule-modal{position:fixed;inset:0;top:var(--orig-bar-h,0px);background:#020617aa;z-index:10050;display:flex;align-items:center;justify-content:center;color:#e2e8f0}
      .as-box{width:min(720px,92vw);max-height:88vh;overflow:auto;background:#172033;border:2px solid #b7791f;border-radius:14px;padding:18px;box-shadow:0 18px 60px #000}
      .as-head{display:flex;justify-content:space-between;align-items:center;font-size:23px;font-weight:bold;color:#fde68a}.as-sec{background:#0f172acc;border:1px solid #475569;border-radius:10px;padding:12px;margin-top:12px}.as-title{font-weight:bold;color:#fbbf24;margin-bottom:7px}.as-row{display:block;padding:5px 0}.as-row input[type=number]{width:72px;background:#020617;border:1px solid #64748b;border-radius:5px;padding:3px;text-align:center}.as-row input[type=checkbox]{width:18px;height:18px;vertical-align:middle}.as-help,.as-muted{font-size:13px;color:#94a3b8}.as-actions{display:flex;gap:8px;margin-top:12px}.as-actions button,.as-head button,.as-ex button,.as-ex-tools button{background:#334155;border:1px solid #64748b;border-radius:6px;padding:6px 12px}.as-actions .primary{background:#92400e;border-color:#f59e0b}.as-ex{display:flex;gap:10px;align-items:center;padding:5px;border-bottom:1px solid #334155}.as-ex span{flex:1}.as-ex b{color:#fcd34d}.as-ex-tools{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.as-ex-tools input,.as-ex-tools select,select{background:#020617;border:1px solid #64748b;padding:6px;border-radius:6px}.as-ex-tools input{min-width:180px;flex:1}.as-btnrow{display:flex;align-items:center;flex-wrap:wrap;gap:6px}.as-sell-now-btn{margin-left:10px;height:38px;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;line-height:1;padding:0 12px;border:2px solid #fb923c;border-radius:7px;background:#7c2d12;color:#ffedd5;font-weight:bold;cursor:pointer;box-shadow:0 2px 7px #0008}.as-sell-now-btn:hover{filter:brightness(1.25)}.as-sort-now-btn{border-color:#22d3ee;background:#164e63;color:#cffafe}.as-override-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.as-override-actions button{padding:7px 13px;border:2px solid;border-radius:7px;font-weight:bold;cursor:pointer;box-shadow:0 2px 7px #0008;transition:filter .15s,transform .15s}.as-override-actions button:hover{filter:brightness(1.25);transform:translateY(-1px)}.as-keep-btn{color:#bbf7d0;background:#14532d;border-color:#4ade80!important}.as-sell-btn{color:#fecaca;background:#7f1d1d;border-color:#f87171!important}#as-item{width:min(100%,390px);margin-bottom:7px}
    </style><div class="as-box"><div class="as-head"><span>自動販賣規則</span><button onclick="closeAutoSellRules()">Close</button></div>
      <div class="as-sec"><label class="as-row"><input id="as-on" type="checkbox" ${player.autoSellOn!==false?'checked':''}> 啟用自動販賣＋自動排列</label><label class="as-row"><input id="as-global" type="checkbox" ${player.autoSellGlobal?'checked':''}> 套用全部存檔（8 個角色共用此設定）</label><div class="as-row as-btnrow"><span>物品取得／符合規則後，等待</span><input id="as-delay" type="number" min="10" max="86400" value="${r.delaySec}"><span>秒才販賣</span><button type="button" class="as-sell-now-btn" onclick="sellAutoSellItemsNow()">立即賣出廢品</button><button type="button" class="as-sell-now-btn as-sort-now-btn" onclick="sortInventoryNow()">立即一鍵排列</button></div><div class="as-help">等待期間可取消廢品標記（取消後該件不再被規則自動標記，直到重新儲存規則）或鎖定物品；「立即賣出廢品」套用目前規則並跳過等待秒數；「立即一鍵排列」立刻重排背包。停用開關並儲存後，規則產生的廢品標記會清除、獲得物品的自動排列也會停止；勾選「套用全部存檔」會在各角色下次載入時共用此設定。</div></div>
      <div class="as-sec"><div class="as-title">裝備條件</div>${equipRows}<label class="as-row"><input id="as-pb" type="checkbox" ${r.protectBless?'checked':''}> 保護祝福裝備</label><label class="as-row"><input id="as-pa" type="checkbox" ${r.protectAnc?'checked':''}> 保護古代裝備</label><label class="as-row"><input id="as-pt" type="checkbox" ${r.protectAttr?'checked':''}> 保護屬性裝備</label><label class="as-row"><input id="as-ps" type="checkbox" ${r.protectSet?'checked':''}> 保護套裝詞綴裝備</label><label class="as-row"><input id="as-pl" type="checkbox" ${r.protectLegend?'checked':''}> 保護傳說裝備</label><label class="as-row"><input id="as-prelic" type="checkbox" ${r.protectRelic!==false?'checked':''}> 保護遺物</label><label class="as-row"><input id="as-pold" type="checkbox" ${r.protectOldSeries?'checked':''}> 保護解封後的「古老的」系列裝備</label><div class="as-help">解除封印完成後立即保護古老的劍、巨劍、弩槍、鱗甲、皮盔甲、長袍及金屬盔甲，避免成品在取得瞬間被規則標為廢品。</div><label class="as-row"><input id="as-pcraft" type="checkbox" ${r.protectCraftEquip?'checked':''}> 保護製作素材裝備；保留可製作 <input id="as-craftsets" type="number" min="1" max="99" value="${r.craftSets}"> 次的數量</label><div class="as-help">系統會掃描全部製作配方，例如配方需要「暗殺軍王之痕 ×1」，保留 1 次就至少留 1 件，多餘數量才依武器規則處理。</div></div>
      <div class="as-sec"><div class="as-title">材料與一般物品</div>${miscRows}<div class="as-help">任務物品、不可販賣物品與系統保護物品不會被處理。</div></div>
      <div class="as-sec"><div class="as-title">個別例外（全遊戲物品）</div><div class="as-ex-tools"><input id="as-item-search" type="search" placeholder="輸入物品名稱搜尋" oninput="refreshAutoSellItemOptions()"><select id="as-item-type" onchange="refreshAutoSellItemOptions()"><option value="all">全部分類</option>${exceptionTypeRows}</select><select id="as-item-scope" onchange="refreshAutoSellItemOptions()"><option value="all">全部物品</option><option value="held">目前持有</option></select></div><div class="as-override-actions"><select id="as-item">${itemRows}</select><button class="as-keep-btn" onclick="setAutoSellOverride('keep')">永遠保留</button><button class="as-sell-btn" onclick="setAutoSellOverride('sell')">永遠販賣</button></div><div class="as-help">例外依物品本體全局套用，包含未取得物品及其所有強化、祝福、屬性與套裝版本。</div><div id="as-overrides">${rules}</div></div>
      <div class="as-actions"><button onclick="previewAutoSellRules()">預覽符合物品</button><button class="primary" onclick="saveAutoSellRules()">儲存規則</button></div></div>`;
    document.body.appendChild(el);
}
function closeAutoSellRules(){ if(_asBackup){ player.autoSellRules=_asBackup.rules; player.autoSellOn=_asBackup.on; player.autoSellGlobal=_asBackup.global; _asBackup=null; try{_renderAutoSellBtn();}catch(e){} }   // 🛡️ 審計#11：Close＝還原快照——預覽/例外操作寫進的草稿全部撤銷，只有「儲存規則」才生效
    let e=document.getElementById('autosell-rule-modal'); if(e)e.remove(); }
function _readAutoSellForm(ruleSnapshot){   // 🔧 v2.6.77 ruleSnapshot：預覽傳入「快照複本」→ 表單只讀進複本、完全不動 live 規則與 player.autoSellOn
    let r=ruleSnapshot || getAutoSellRules(); r.delaySec=Math.max(10,Number(document.getElementById('as-delay').value)||60); if(!ruleSnapshot) player.autoSellOn=document.getElementById('as-on').checked;
    ['wpn','arm','acc'].forEach(k=>{r.equip[k].on=document.getElementById('as-e-'+k).checked;r.equip[k].max=Math.max(0,Number(document.getElementById('as-em-'+k).value)||0)});
    r.protectBless=document.getElementById('as-pb').checked;r.protectAnc=document.getElementById('as-pa').checked;r.protectAttr=document.getElementById('as-pt').checked;r.protectSet=document.getElementById('as-ps').checked;r.protectLegend=document.getElementById('as-pl').checked;r.protectRelic=document.getElementById('as-prelic').checked;r.protectOldSeries=document.getElementById('as-pold').checked;r.protectCraftEquip=document.getElementById('as-pcraft').checked;r.craftSets=Math.max(1,Number(document.getElementById('as-craftsets').value)||1);if(!ruleSnapshot)player.autoSellGlobal=document.getElementById('as-global').checked;
    document.querySelectorAll('.as-misc').forEach(x=>{let t=x.dataset.type,k=document.querySelector(`.as-keep[data-type="${t}"]`);r.misc[t]={on:x.checked,keep:Math.max(0,Number(k.value)||0)}}); return r;
}
function saveAutoSellRules(){_readAutoSellForm();(player.inv||[]).forEach(i=>{delete i._userKeep;});_saveGlobalAutoSellSettings(player.autoSellGlobal);_asBackup=null;applyAutoSellRules();_renderAutoSellBtn();saveGame();renderTabs();closeAutoSellRules();logSys('<span class="text-amber-300">已儲存自動販賣規則；符合的物品會先進入防呆等待期。</span>')}   // 🔧 v2.6.91 功能5：儲存時把設定寫入/移除全域桶   // 🛡️ 審計#10/#11：儲存＝清除 _userKeep 豁免（規則重編→重新評估）＋捨棄草稿快照（此後 Close 不再還原）
// 🔧 v2.6.77 立即賣出廢品：以目前表單規則「提交生效」（比照儲存規則·但不清 _userKeep 豁免——玩家單件取消仍受保護）→ 關窗 → 走手動一鍵賣出（跳過等待秒數·autoSellJunk(true) 內含 saveGame）
function sellAutoSellItemsNow(){_readAutoSellForm();_asBackup=null;applyAutoSellRules(true);_renderAutoSellBtn();closeAutoSellRules();autoSellJunk(true)}   // 🔧 v2.6.91 force=true：即使開關關閉也強制依規則標記後立即賣
function _autoSellPlainItemName(item) {   // 🔧 v2.6.77 預覽清單去 HTML：getItemFullName 回傳含 <span> 上色 → 轉純文字
    let box = document.createElement('div');
    box.innerHTML = getItemFullName(item);
    return (box.textContent || box.innerText || DB.items[item.id]?.n || item.id).trim();
}
function closeAutoSellPreview(){let e=document.getElementById('autosell-preview-modal');if(e)e.remove()}
// 🔧 v2.6.77 預覽重做（參考用戶 2667 修正版）：①表單讀進「快照複本」→ 預覽零副作用、不儲存規則；②自建 DOM 覆蓋層（z-index 10060 高於規則視窗 10050）→ 不被規則頁蓋住；③物品名稱轉純文字 → 不再出現 HTML 語法
function previewAutoSellRules(){
    let previewRules=JSON.parse(JSON.stringify(getAutoSellRules()));
    _readAutoSellForm(previewRules);
    closeAutoSellPreview();
    let previewCraftRemain=_craftReserveMap(previewRules);let a=(player.inv||[]).map(i=>({i,x:_autoSellDecision(i,previewRules,previewCraftRemain)})).filter(o=>o.x.sell);   // 🔧 v2.6.91 預覽也套製作素材保留
    let overlay=document.createElement('div');
    overlay.id='autosell-preview-modal';
    Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'10060',display:'flex',alignItems:'center',justifyContent:'center',background:'#02061799',padding:'20px'});
    let panel=document.createElement('div');
    Object.assign(panel.style,{width:'min(620px,92vw)',maxHeight:'80vh',display:'flex',flexDirection:'column',background:'#172033',border:'2px solid #d69e2e',borderRadius:'12px',boxShadow:'0 20px 70px #000',color:'#e2e8f0'});
    let head=document.createElement('div');
    Object.assign(head.style,{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',borderBottom:'1px solid #475569'});
    let title=document.createElement('strong'); title.textContent='符合自動販賣規則的物品'; title.style.color='#fde68a'; title.style.fontSize='20px';
    let close=document.createElement('button'); close.textContent='Close'; close.onclick=closeAutoSellPreview;
    Object.assign(close.style,{background:'#334155',border:'1px solid #64748b',borderRadius:'6px',padding:'6px 12px',color:'#fff'});
    head.append(title,close); panel.appendChild(head);
    let body=document.createElement('div'); Object.assign(body.style,{padding:'14px 16px',overflow:'auto',lineHeight:'1.65'});
    if(!a.length){body.textContent='目前沒有符合規則的物品。'}
    else {
        let summary=document.createElement('div'); summary.textContent=`目前符合 ${a.length} 種物品：`; summary.style.marginBottom='8px'; body.appendChild(summary);
        a.forEach(o=>{let row=document.createElement('div');row.textContent=`${_autoSellPlainItemName(o.i)} × ${o.x.qty}`;row.style.padding='4px 0';row.style.borderBottom='1px solid #263449';body.appendChild(row)});
    }
    panel.appendChild(body); overlay.appendChild(panel); document.body.appendChild(overlay);
}
function refreshAutoSellItemOptions(){
    let select=document.getElementById('as-item'); if(!select)return;
    let q=(document.getElementById('as-item-search')?.value||'').trim().toLowerCase();
    let type=document.getElementById('as-item-type')?.value||'all';
    let scope=document.getElementById('as-item-scope')?.value||'all';
    let held=new Set((player.inv||[]).map(i=>i.id));
    let ids=Object.keys(DB.items).filter(id=>{let d=DB.items[id];if(!d)return false;let cat=_asEquipType(d)||d.type;if(type!=='all'&&cat!==type)return false;if(scope==='held'&&!held.has(id))return false;return !q||((d.n||id)+' '+id).toLowerCase().includes(q)}).sort((a,b)=>(DB.items[a]?.n||a).localeCompare(DB.items[b]?.n||b,'zh-Hant'));
    select.innerHTML=ids.map(id=>`<option value="${id}">${DB.items[id]?.n||id}${DB.items[id]?.noSell?'（不可販賣）':''}</option>`).join('');
    if(!ids.length)select.innerHTML='<option value="">沒有符合的物品</option>';
}
function setAutoSellOverride(v){let id=document.getElementById('as-item').value;if(!id)return;_readAutoSellForm();getAutoSellRules().overrides[id]=v;openAutoSellRules()}
function deleteAutoSellOverride(id){_readAutoSellForm();delete getAutoSellRules().overrides[id];openAutoSellRules()}
function toggleLock(uid) {
    let item = player.inv.find(i => i.uid === uid);
    if (item) {
        item.lock = !item.lock;
        if (item.lock) item.junk = false;   // 鎖定自動解除廢品勾選
        openModal(item, false);
        renderTabs();
    }
}

function sellItem(uid, count, unitPrice) {
    let item = player.inv.find(i => i.uid === uid);
    if (!item || item.lock) return;
    if (DB.items[item.id] && DB.items[item.id].noSell && !(typeof trialDropBlocked === 'function' && trialDropBlocked(item.id))) { logSys('此物品無法販售。'); return; }   // 🏅 精通之證等不可販售；🔒 例外：「非本職的試煉道具」(誤撿/倉庫帶來、本職用不到)允許賣出清理，本職的試煉道具仍受保護
    let _wasGrant = !!(DB.items[item.id] && DB.items[item.id].grantSkills);   // 賣出授予技能頭盔時需重算
    let sellCount = Math.min(count, item.cnt);
    let totalGot = sellCount * unitPrice;
    player.gold += totalGot;
    item.cnt -= sellCount;
    logSys(`賣出了 ${sellCount} 個 ${DB.items[item.id].n}，獲得 ${totalGot} 金幣。`);
    if (item.cnt <= 0) {
        player.inv = player.inv.filter(i => i.uid !== uid);
        closeModal();
    } else {
        openModal(item, false);
    }
    renderTabs();
    updateUI();
    if(_wasGrant) { calcStats(); renderSkillSelects(); }   // 失去授予技能頭盔：立即更新
}

function closeModal() { document.getElementById('item-modal').classList.add('hidden'); }
function switchTab(t, btn) {
    Array.from(btn.parentElement.children).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // 👇 更新陣列名單
    ['stats', 'equip', 'weapons', 'skill', 'armors', 'items', 'audit', 'automation'].forEach(id => { let _e = document.getElementById(`tab-${id}`); if(_e) _e.classList.add('hidden'); });   // 🔧 v2.6.74 自動化設定改分頁內嵌（tab-automation）
    document.getElementById(`tab-${t}`).classList.remove('hidden');
    if(t === 'audit' && typeof renderAuditTab === 'function') renderAuditTab();
}

// ===== 🤝 協力傭兵隊伍面板（Phase 1：顯示血/魔/經驗條＋每傭兵攻擊技能/治癒魔法設定）=====
let _squadSigTeam = '';      // team 分頁簽章：傭兵名單/等級＋寵物血魔經驗(5%階)＋召喚物血量/倒數 → 變動才重建 DOM，避免每幀 innerHTML 重繪
let _squadSigSkill = '';     // skill 分頁簽章：只看傭兵名單/等級——戰鬥中寵物/召喚掉血不重建，開啟中的技能下拉才不會被關掉
let _squadTab = 'team';      // 目前分頁：team / skill
let _autoCollapseInit = false;   // 自動化設定收合偏好只在首次套用

// 依某個傭兵「自身的可學技能」產生攻擊／治癒下拉選項（比照 renderSkillSelects 過濾，但讀 ally 而非 player）
function _allySkillOptions(ally, kind, cur) {
    let opts = '<option value="">無</option>';
    let skills = (ally && ally.skills) ? ally.skills : [];
    let sorted = [...skills].filter(s => DB.skills[s] && !DB.skills[s].procOnly).sort((a, b) => (DB.skills[a].tier || 0) - (DB.skills[b].tier || 0));
    sorted.forEach(sid => {
        let sk = DB.skills[sid];
        // ⚠️ ally.skills 皆為「該傭兵已學會」的技能→一律可選；不可用 skillReqLv/reqEle 判可用性（那會依『目前玩家』職業誤判，使跨職業傭兵如幻術士的攻擊技全被 disabled）
        let match = (kind === 'atk')
            ? (sk.type === 'atk' && !sk.healSlot)
            : (kind === 'convert')
            ? (sk.type === 'convert' || sid === 'sk_illu_cube_harmony')   // 🔄 轉換技能欄：type:'convert'（魂體/心靈/魔力奪取）＋ 立方和諧
            : ((sk.type === 'heal' && !sk.autoBuff && !['sk_antidote', 'sk_holy_light', 'sk_cancel'].includes(sid)) || (sk.type === 'atk' && sk.healSlot));
        if (!match) return;
        opts += `<option value="${sid}"${cur === sid ? ' selected' : ''}>${sk.n}</option>`;
    });
    return opts;
}
// 🆕 v3.0.97 傭兵「自動維持」勾選列：把受 _mercAutoOn 閘控制的技能（buff/召喚/團隊回復/淨化/持續傷害/立方）列成小勾選，逐兵開關。
//   勾選狀態＝_mercAutoOn(a,sid)（覆寫優先·否則來源角色快照）；toggle→setAllyAutoBuff。無此類技能→不顯示本列。
function _allyAutoBuffChips(a) {
    let list = (typeof allyAutoCastableSkills === 'function') ? allyAutoCastableSkills(a) : [];
    if (!list.length) return '';
    let s = a._slot;
    let chips = list.map(it => {
        let on = (typeof _mercAutoOn === 'function') ? _mercAutoOn(a, it.sid) : false;
        return `<label class="flex items-center gap-0.5 px-1 rounded border cursor-pointer" style="border-color:${on ? '#0891b2' : '#475569'};background:${on ? 'rgba(8,145,178,0.18)' : 'rgba(15,23,42,0.4)'};" title="自動維持 ${it.n}（${it.cat}）"><input type="checkbox" ${on ? 'checked' : ''} onchange="setAllyAutoBuff('${s}','${it.sid}',this.checked)" style="width:11px;height:11px;margin:0;"><span style="color:${on ? '#67e8f9' : '#94a3b8'};">${it.n}</span></label>`;
    }).join('');
    return `<div class="flex flex-col gap-0.5" style="margin-top:1px;"><span class="text-cyan-400 font-bold" style="font-size:10px;">自動維持（增益／召喚／回復／淨化）</span><div class="flex flex-wrap gap-1" style="font-size:10px;line-height:1.4;">${chips}</div></div>`;
}

function renderSquadPanel() {
    if (state.ff) return;   // 🚀 快轉(離線/背景補跑)：傭兵倒地/復活/升級會直接呼叫本函式(繞過 tick 尾端的 !state.ff 渲染守衛)→整塊 innerHTML 重建會在畫面上觸發倒地動畫並白費效能。統一擋在源頭；補跑結束後由正常 updateUI 再畫一次最終狀態。
    let panel = document.getElementById('squad-panel');
    if (!panel) return;
    // ⌨️ 玩家正在面板內的輸入框/下拉打字或選取 → 這一輪不重建：team 分頁的簽章含寵物血量(戰鬥中每秒都在變)，
    //    重建會把正在編輯的元素整個換掉（寵物「%喝水」門檻打到一半就跳掉、選單被關）。失焦後下一輪自然重建。
    { let _ae = document.activeElement; if (_ae && panel.contains(_ae) && (_ae.tagName === 'INPUT' || _ae.tagName === 'SELECT')) return; }
    if (!_autoCollapseInit) { _autoCollapseInit = true; }   // 🔧 v2.6.76 收合偏好停用：自動化設定已改分頁內嵌(v2.6.74)、傭兵隊伍面板取消收合恆展開（舊 fb5_*_collapsed 偏好不再套用·防「收合過就永遠展不開」）
    let allies = (player && player.allies) ? player.allies.filter(Boolean) : [];
    let _pets = (typeof petsOutList === 'function' && player && player.cls) ? petsOutList() : [];   // 🐾 出戰寵物
    let _summons = (typeof summonV2List === 'function' && player && player.cls) ? summonV2List().filter(x => x && !x._downed && (x.hp || 0) > 0) : [];   // 🧙 召喚物
    let _summonSk = (typeof summonV2ActiveSk === 'function') ? summonV2ActiveSk() : '';
    let _summonVisible = _summons.length > 0 || !!(player && player._summonV2On && _summonSk && typeof summonV2Knows === 'function' && summonV2Knows(_summonSk));
    if (!allies.length && !_pets.length && !_summonVisible) { panel.style.display = 'none'; _squadSigTeam = ''; _squadSigSkill = ''; return; }
    panel.style.display = '';
    let _sigAllies = allies.map(a => a._slot + ':' + (a._allyName || '') + ':' + (a._downed ? 'D' : '') + ':' + (a.lv || 1)).join('|');
    // 寵物/召喚物的血條與倒數是「建構時寫死在 HTML」的（不像傭兵有 id 可逐幀改），所以簽章必須含它們的血量/秒數，否則畫面凍在召喚當下不再更新
    let sigTeam = _sigAllies
        + '#P' + _pets.map(p => p.uid + ':' + (p._downed ? 'D' : '') + ':' + (p.lv || 1)
            + ':' + Math.round(p.hp / Math.max(1, p.mhp) * 20) + ':' + Math.round(p.mp / Math.max(1, p.mmp) * 20)
            + ':' + Math.round((p.exp || 0) / Math.max(1, petExpReq(p.lv)) * 20) + ':' + (p.potPct || 0) + ':' + Math.ceil((p._reviveCd || 0) / 10)).join(',')
        + '#S' + ((typeof summonTeamSignature === 'function') ? summonTeamSignature() : '');
    let sigSkill = _sigAllies;
    let _squadRebuilt = false;
    if (sigTeam !== _squadSigTeam) {
        _squadSigTeam = sigTeam;
        document.getElementById('squad-tab-team').innerHTML = allies.map(a => {
            let s = a._slot;
            if (a._downed) {   // 🤝 Phase 3：倒地→灰顯卡片。返生術＝手動鈕（消耗MP·無冷卻立即）；復活卷軸＝v2.6.6 改自動（15秒冷卻結束身上有卷軸即自動使用），此處只顯示狀態文字（不可點）。每幀更新。
                return `<div class="bg-slate-900/70 border border-red-900 rounded p-2 flex flex-col gap-1" style="opacity:0.85;">
                    <div class="flex items-center justify-between gap-2">
                        <div class="text-sm"><span class="font-bold text-slate-400">${a._allyName}</span> <span class="text-slate-600 text-xs">Lv.${a.lv || 1}</span> <span class="text-red-400 font-bold">【倒地】</span></div>
                        <div class="flex items-center gap-1 shrink-0">
                            <button id="squad-rez-${s}" class="py-1 px-2 text-xs font-bold rounded border whitespace-nowrap" style="background:#1e3a8a;border-color:#3b82f6;color:#bfdbfe;" onclick="reviveMercenary('${s}','rez')">返生術</button>
                            <span id="squad-revive-${s}" class="py-1 px-2 text-xs font-bold rounded border whitespace-nowrap" style="background:#3f1d1d;border-color:#7f1d1d;color:#fca5a5;cursor:default;" title="倒地 15 秒後，若身上有復活卷軸將自動使用。">卷軸</span>
                        </div>
                    </div>
                    <button onclick="switchToAllyChar('${s}')" class="mt-0.5 py-1 px-2 text-xs font-bold rounded border whitespace-nowrap" style="background:#065f46;border-color:#10b981;color:#a7f3d0;" title="儲存目前角色進度，並切換到此角色遊玩（倒地只是目前隊伍的戰鬥狀態，不影響切換）">💾 存檔並切換至此角色</button>
                </div>`;
            }
            return `<div class="bg-slate-800/60 border border-slate-600 rounded p-2 flex flex-col gap-1">
                <div class="flex justify-between items-center text-sm"><span class="font-bold text-amber-200">${a._allyName}</span><span class="text-slate-400 text-xs">Lv.${a.lv || 1}</span></div>
                <div id="squad-status-${s}" class="text-xs" style="color:#fca5a5;line-height:1.2;"></div>
                <div class="flex items-center gap-1"><span class="text-red-400 text-xs text-right" style="width:1.6rem;">HP</span><div class="bar-bg flex-1 !h-4"><div id="squad-hp-${s}" class="bar-fill bg-red-600" style="width:100%"></div><div id="squad-hp-txt-${s}" class="bar-text text-white text-xs" style="line-height:16px;">0/0</div></div></div>
                <div class="flex items-center gap-1"><span class="text-blue-400 text-xs text-right" style="width:1.6rem;">MP</span><div class="bar-bg flex-1 !h-4"><div id="squad-mp-${s}" class="bar-fill bg-blue-600" style="width:100%"></div><div id="squad-mp-txt-${s}" class="bar-text text-white text-xs" style="line-height:16px;">0/0</div></div></div>
                <div class="flex items-center gap-1"><span class="text-yellow-500 text-xs text-right" style="width:1.6rem;">EXP</span><div class="bar-bg flex-1 !h-4"><div id="squad-exp-${s}" class="bar-fill bg-yellow-500" style="width:0%"></div><div id="squad-exp-txt-${s}" class="bar-text text-white text-xs" style="line-height:16px;">0%</div></div></div>
                <button onclick="switchToAllyChar('${s}')" class="mt-0.5 py-1 px-2 text-xs font-bold rounded border whitespace-nowrap" style="background:#065f46;border-color:#10b981;color:#a7f3d0;" title="儲存目前角色進度，並切換到此角色遊玩">💾 存檔並切換至此角色</button>
            </div>`;
        }).join('')
            + ((typeof renderPetTeamHTML === 'function') ? renderPetTeamHTML() : '')
            + ((typeof renderSummonTeamHTML === 'function') ? renderSummonTeamHTML() : '')
            + ((typeof renderMercSummonTeamHTML === 'function') ? renderMercSummonTeamHTML() : '');   // 隊伍排列：傭兵 → 寵物 → 玩家召喚物 → 🧱 傭兵召喚物(血條比照玩家)
        _squadRebuilt = true;
    }
    if (sigSkill !== _squadSigSkill) {
        _squadSigSkill = sigSkill;
        document.getElementById('squad-tab-skill').innerHTML = allies.map(a => {
            let s = a._slot;
            let hpPct = (a._healHpPct != null) ? a._healHpPct : 70;
            let potPct = (a._potHpPct != null) ? a._potHpPct : ((a._hpSafePct != null) ? a._hpSafePct : 0);
            let skillPct = (a._hpSkillPct != null) ? a._hpSkillPct : ((a._hpSafePct != null) ? a._hpSafePct : 0);
            let mpPct = (a._castMpPct != null) ? a._castMpPct : 0;   // 🆕 v2.6.27 施法MP門檻
            return `<div class="bg-slate-800/60 border border-slate-600 rounded p-2 flex flex-col gap-1">
                <div class="text-sm font-bold text-amber-200">${a._allyName} <span class="text-slate-500 text-xs">Lv.${a.lv || 1}</span></div>
                <div class="flex items-center gap-1 text-xs"><span class="text-cyan-400 font-bold shrink-0" style="width:3rem;">攻擊技能</span><select class="flex-1 min-w-0 bg-slate-900 border border-slate-600 text-cyan-300 px-1 py-1 rounded text-xs outline-none" onchange="setAllyAtkSkill('${s}', this.value)">${_allySkillOptions(a, 'atk', a._atkSkill || '')}</select><span class="shrink-0 flex items-center text-blue-300 whitespace-nowrap" title="MP％ 高於此值才施放攻擊技（0 = 不限）。">MP&gt;<input type="number" min="0" max="100" value="${mpPct}" class="w-10 bg-slate-900 border border-blue-700 text-center text-white rounded" onchange="setAllyCastMp('${s}', this.value)">%</span></div>
                <div class="flex items-center gap-1 text-xs"><span class="text-green-400 font-bold shrink-0" style="width:3rem;">治癒魔法</span><select class="flex-1 min-w-0 bg-slate-900 border border-slate-600 text-green-300 px-1 py-1 rounded text-xs outline-none" onchange="setAllyHealSkill('${s}', this.value)">${_allySkillOptions(a, 'heal', a._healSkill || '')}</select><span class="shrink-0 flex items-center text-green-300 whitespace-nowrap" title="HP％ 低於此值才施放治癒。">HP&lt;<input type="number" min="0" max="100" value="${hpPct}" class="w-10 bg-slate-900 border border-green-700 text-center text-white rounded" onchange="setAllyHealHp('${s}', this.value)">%</span></div>
                <div class="flex items-center gap-1 text-xs"><span class="text-purple-400 font-bold shrink-0" style="width:3rem;">轉換技能</span><select class="flex-1 min-w-0 bg-slate-900 border border-slate-600 text-purple-300 px-1 py-1 rounded text-xs outline-none" onchange="setAllyConvertSkill('${s}', this.value)">${_allySkillOptions(a, 'convert', a._convertSkill || '')}</select></div>
                <div class="flex items-stretch gap-1 text-xs">
                    <span class="flex-1 flex items-center justify-center gap-0.5 text-amber-400 bg-slate-900/40 border border-amber-800 rounded py-0.5" title="低於此％時，喝隊長設定的藥水回血。0 = 關閉。">HP&lt;<input type="number" min="0" max="100" value="${potPct}" class="w-10 bg-slate-900 border border-amber-700 text-center text-white rounded" onchange="setAllyPotHp('${s}', this.value)">%喝水</span>
                    <span class="flex-1 flex items-center justify-center gap-0.5 text-rose-400 bg-slate-900/40 border border-rose-800 rounded py-0.5" title="低於此％時，暫停施放消耗 HP 的技能（龍騎士 HP 技／轉換技能／立方和諧），退回普攻。0 = 關閉。">HP&lt;<input type="number" min="0" max="100" value="${skillPct}" class="w-10 bg-slate-900 border border-rose-700 text-center text-white rounded" onchange="setAllyHpSkill('${s}', this.value)">%停技</span>
                </div>
                ${_allyAutoBuffChips(a)}
            </div>`;
        }).join('');
        _squadRebuilt = true;
    }
    if (_squadRebuilt) switchSquadTab(_squadTab);   // 有任一分頁重建→還原目前分頁與按鈕高亮
    // 每幀更新血/魔/經驗條（不重建 DOM）
    allies.forEach(a => {
        let s = a._slot, el;
        if (a._downed) {   // 🤝 倒地卡：更新兩種復活鈕（返生術=學會+MP夠即可立即；卷軸=死亡15秒後+持有）
            let rb = document.getElementById('squad-rez-' + s);
            if (rb) {
                let learned = !!(player.skills && player.skills.includes('sk_resurrection'));
                let rk = DB.skills.sk_resurrection;
                let cost = rk ? player.d.getMpCost(rk.mp, rk.tier) : Infinity;
                let ok = learned && !player.dead && (player.mp || 0) >= cost;
                rb.style.display = learned ? '' : 'none';   // 未學會返生術→不顯示此鈕
                rb.style.opacity = ok ? '1' : '0.45';
                rb.title = !learned ? '尚未學會返生術' : (player.dead ? '你已死亡' : ((player.mp || 0) >= cost ? ('立即復活（消耗 ' + cost + ' MP·無冷卻）') : ('MP 不足（需 ' + cost + '）')));
            }
            let b = document.getElementById('squad-revive-' + s);
            if (b) {   // 🎫 v2.6.6：卷軸改自動（狀態顯示·不可點）。倒數中→顯示自動復活秒數；冷卻結束無卷軸→提示補卷軸即自動復活（返生術可手動立即）。
                let cd = a._reviveCd || 0;
                if (cd > 0) { b.textContent = '自動 ' + Math.ceil(cd / 10) + 's'; b.style.opacity = '0.7'; b.title = '倒地 15 秒後，若身上有復活卷軸將自動使用（返生術可手動立即復活）。'; }
                else { let sc = player.inv && player.inv.find(i => i.id === 'scroll_revive'); let n = sc ? (sc.cnt || 0) : 0; b.textContent = n > 0 ? ('卷軸×' + n) : '無卷軸'; b.style.opacity = n > 0 ? '1' : '0.6'; b.title = n > 0 ? '冷卻結束，將自動使用復活卷軸復活。' : '身上無復活卷軸；補充後將自動復活（或用返生術立即復活）。'; }
            }
            return;   // 倒地卡無血條，跳過下面 hp/mp/exp 更新
        }
        if ((el = document.getElementById('squad-hp-' + s))) {
            let mhp = Math.max(1, Math.floor(a.mhp || 1)), cur = Math.max(0, Math.floor(a.curHp || 0));
            el.style.width = Math.max(0, (cur / mhp) * 100) + '%';
            let t = document.getElementById('squad-hp-txt-' + s); if (t) t.innerText = cur + '/' + mhp;
        }
        if ((el = document.getElementById('squad-mp-' + s))) {
            let mmp = Math.max(1, Math.floor(a.mmp || 1)), cur = Math.max(0, Math.floor(a.mp || 0));
            el.style.width = Math.max(0, (cur / mmp) * 100) + '%';
            let t = document.getElementById('squad-mp-txt-' + s); if (t) t.innerText = cur + '/' + mmp;
        }
        if ((el = document.getElementById('squad-exp-' + s))) {
            let req = (typeof getExpReq === 'function') ? getExpReq(a.lv || 1) : 0;
            let pct = (req > 0 && isFinite(req)) ? ((a.exp || 0) / req) * 100 : 0;
            el.style.width = Math.min(100, Math.max(0, pct)) + '%';
            let t = document.getElementById('squad-exp-txt-' + s); if (t) t.innerText = pct >= 100 ? '滿' : pct.toFixed(1) + '%';   // 不即時升級→累積超過一級顯「滿」（解雇可回收）
        }
        if ((el = document.getElementById('squad-status-' + s))) {   // 🤝 Phase4：傭兵異常狀態小字（無狀態時空白不佔版面）
            let _ss = a.statuses || {}, _out = [];
            [['stun', '暈眩'], ['freeze', '冰凍'], ['stone', '石化'], ['paralyze', '麻痺'], ['sleep', '沉睡'], ['silence', '沉默'], ['magicseal', '魔封'], ['poison', '中毒'], ['burn', '灼燒'], ['scald', '燙傷'], ['bleed', '出血'], ['slowAtk', '緩速']].forEach(p => { if ((_ss[p[0]] || 0) > 0) _out.push(p[1]); });
            el.textContent = _out.length ? ('⚠ ' + _out.join('·')) : '';
        }
    });
}

function switchSquadTab(t) {
    _squadTab = t;
    ['team', 'skill'].forEach(id => {
        let e = document.getElementById('squad-tab-' + id); if (e) e.classList.toggle('hidden', id !== t);
        let b = document.getElementById('squad-tab-btn-' + id);
        if (b) {
            let on = (id === t);
            b.style.background = on ? '#b45309' : '#334155';      // amber-700 / slate-700
            b.style.borderColor = on ? '#f59e0b' : '#475569';     // amber-500 / slate-600
            b.style.color = on ? '#ffffff' : '#cbd5e1';
        }
    });
}

// 🪟 全遊戲共用的「確認」入口：一律走自製彈窗（afk-ui.js 的 AFK_UI.confirm），不要直接用原生 confirm。
//   原因：iOS Safari 會抑制連續的原生彈窗 → 玩家點了「確定」卻什麼都沒發生（無聲失敗），且外觀與遊戲不一致。
//   自製彈窗非阻塞 → 一律 callback：確定 onOk、取消鈕 onCancel、點背景/ESC/返回鍵 onDismiss（沒給則同 onCancel）。
//   ⚠ 呼叫端不可寫成 `if (gameConfirm(...))`——它不回傳選擇，後續動作要放進 onOk。
//   afk-ui 沒載入時降級回原生 confirm（單獨開核心也不會壞）。
function gameConfirm(opts) {
    opts = opts || {};
    if (window.AFK_UI && typeof AFK_UI.confirm === 'function') { AFK_UI.confirm(opts); return; }
    let txt = (opts.title ? opts.title + '\n' : '') + (opts.message || '');
    if (confirm(txt)) { if (opts.onOk) opts.onOk(); }
    else { let fn = opts.onDismiss || opts.onCancel; if (fn) fn(); }
}
function _findAlly(slot) { return (player.allies || []).find(a => a && String(a._slot) === String(slot)); }
// 💾 存檔目前角色並切換到指定協力角色(存檔位)遊玩
function switchToAllyChar(slot) {
    slot = String(slot);
    let sum = (typeof slotSummary === 'function') ? slotSummary(slot) : null;
    if (!sum) { alert('存檔 ' + slot + ' 目前沒有可切換的角色。'); return; }
    saveGame();          // 先存目前角色（此時 currentSlot 仍為目前角色）
    currentSlot = slot;  // 切到目標存檔位
    loadGame();          // 載入該角色並切換畫面（同載入畫面「載入」路徑）
}
function setAllyAtkSkill(slot, val) { let a = _findAlly(slot); if (a) { a._atkSkill = val || ''; saveGame(); } }   // _atkSkill 即時生效（傭兵攻擊路徑直接讀 ally._atkSkill）
function setAllyHealSkill(slot, val) { let a = _findAlly(slot); if (a) { a._healSkill = val || ''; saveGame(); } }   // _healSkill 儲存待 Phase 3 傭兵自動補血讀取
function setAllyConvertSkill(slot, val) { let a = _findAlly(slot); if (a) { a._convertSkill = val || ''; saveGame(); } }   // 🔄 v2.6.4 轉換技能（type:'convert'／立方和諧）：即時生效（allyCubeTick/轉換施放路徑直接讀 ally._convertSkill）
function setAllyHealHp(slot, val) { let a = _findAlly(slot); if (a) { a._healHpPct = Math.max(0, Math.min(100, parseInt(val) || 0)); saveGame(); } }
function setAllyPotHp(slot, val) { let a = _findAlly(slot); if (a) { a._potHpPct = Math.max(0, Math.min(100, parseInt(val) || 0)); saveGame(); } }   // 🍶 v2.6.4 喝藥水門檻（獨立·低於此%→喝隊長藥水；0=關閉）
function setAllyHpSkill(slot, val) { let a = _findAlly(slot); if (a) { a._hpSkillPct = Math.max(0, Math.min(100, parseInt(val) || 0)); saveGame(); } }   // 🛡️ v2.6.4 停耗HP技門檻（獨立·低於此%→暫停龍騎HP技/轉換技/立方和諧；0=關閉）
function setAllyCastMp(slot, val) { let a = _findAlly(slot); if (a) { a._castMpPct = Math.max(0, Math.min(100, parseInt(val) || 0)); saveGame(); } }   // 🆕 v2.6.27 施法MP門檻（MP% 高於此才施放攻擊技·0=不限·allyActWithSkillGate 讀 allyCastMpPct）
// 🆕 v3.0.97 逐兵「自動維持」開關（覆寫 _mercAutoOn·存 ally._autoBuff·隨存檔）。關閉 self-buff→立即結束該 buff 並重算（比照玩家取消打勾立即結束）；召喚/HoT/淨化/立方 屬即時或全隊·僅停止再施放不強制解除。
function setAllyAutoBuff(slot, sid, on) {
    let a = _findAlly(slot); if (!a || !sid) return;
    if (!a._autoBuff) a._autoBuff = {};
    a._autoBuff[sid] = !!on;
    if (!on && a.buffs && (a.buffs[sid] || 0) > 0) {   // 關閉→即時結束自我增益 buff（召喚/HoT 走各自到期·不在此強制解）
        let sk = DB.skills[sid]; a.buffs[sid] = 0; if (sk && sk.haste) a.buffs.haste = 0;
        try { if (typeof _allyLevelRecompute === 'function') _allyLevelRecompute(a); } catch (e) {}
    }
    if (typeof TEAM_AURA_SKILLS !== 'undefined' && TEAM_AURA_SKILLS.includes(sid)) { try { if (typeof calcStats === 'function') calcStats(); } catch (e) {} }   // 🌟 v3.0.100 團隊光環開關→刷新玩家 d（化身攻擊光環注入玩家；關閉時傭兵化身已於上方清 0）
    try { saveGame(); } catch (e) {}
    _squadSigSkill = '';   // 強制下一輪重建 skill 分頁→更新勾選外觀（邊框/文字色於建構時決定；勾選列在 skill 分頁）
    try { renderSquadPanel(); } catch (e) {}
}

// 自動化設定面板收合（只留標題）：收合時去掉 flex-1 改 0 0 auto，body 隱藏
function _applyAutomationCollapse(collapsed) {
    let panel = document.getElementById('automation-panel'), body = document.getElementById('automation-body'), arrow = document.getElementById('automation-collapse-arrow');
    if (!panel || !body) return;
    body.classList.toggle('hidden', collapsed);
    panel.style.flex = collapsed ? '0 0 auto' : '';
    if (arrow) arrow.textContent = collapsed ? '▶' : '▼';
}
function toggleAutomationCollapse() {
    let body = document.getElementById('automation-body');
    let collapsed = !(body && body.classList.contains('hidden'));
    _applyAutomationCollapse(collapsed);
    try { _lsSet('fb5_automation_collapsed', collapsed ? '1' : '0'); } catch (e) {}
}
// 🔧 v2.6.76 傭兵隊伍面板收合已移除（恆展開·用戶要求）：_applySquadCollapse/toggleSquadCollapse 刪除、index.html 標題列改純標題無箭頭。

// 🛡️ 適用職業 logo：手機沒有 hover，看不到 title 屬性 → 點一下浮現職業名 1.6 秒。
//    全域委派：物品彈窗與小百科「裝備」分頁用的是同一個 class-eq-icon，一個 handler 兩邊都補。
(function () {
    let tip = null, hideT = null;
    document.addEventListener('click', function (e) {
        let ic = e.target && e.target.closest ? e.target.closest('img.class-eq-icon') : null;
        if (!ic) return;
        let name = ic.getAttribute('title') || ic.getAttribute('alt');
        if (!name) return;
        e.preventDefault();
        if (!tip) { tip = document.createElement('div'); tip.id = 'eqicon-tip'; document.body.appendChild(tip); }
        tip.textContent = '可裝備：' + name;
        tip.style.opacity = '1';   // 先顯示才量得到尺寸
        let r = ic.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
        tip.style.left = Math.min(window.innerWidth - tw - 6, Math.max(6, r.left + r.width / 2 - tw / 2)) + 'px';
        // 上方擺不下就翻到下方。「擺不下」的界線是可用區域上緣（官方版指引橫幅底下），不是視窗頂端 0，
        // 否則 tip 會被塞進橫幅底下看不到（無橫幅時 _origBarH()=0，行為與原本相同）。
        let _tipTop = (typeof _origBarH === 'function') ? _origBarH() : 0;
        tip.style.top = (r.top - th - 6 < _tipTop + 6 ? r.bottom + 6 : r.top - th - 6) + 'px';
        if (hideT) clearTimeout(hideT);
        hideT = setTimeout(() => { tip.style.opacity = '0'; }, 1600);
    }, true);
})();
