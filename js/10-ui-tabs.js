let _tabPointerDown = false, _tabRebuildPending = false, _tabThrottleTimer = null;
const TAB_REBUILD_THROTTLE_MS = 250;
function _initTabGuard() {
    let panel = document.getElementById('tab-content-panel');
    if (!panel || panel._tabGuardInit) return;
    panel._tabGuardInit = true;
    panel.addEventListener('pointerdown', function(){ _tabPointerDown = true; });
    let _release = function(){ if (!_tabPointerDown) return; _tabPointerDown = false; if (_tabRebuildPending) { _tabRebuildPending = false; setTimeout(function(){ renderTabs(); }, 0); } };   // 放開後(讓 click 先觸發)再補一次重建
    document.addEventListener('pointerup', _release);
    document.addEventListener('pointercancel', _release);
}
function renderTabs(force) {
    if(state.ff) return; // 補跑期間不刷新畫面
    // 🚀 使用者正按住分頁面板(點擊中)：延後非強制重建到放開後，避免按鈕被重繪掉而點擊失效
    if(!force && _tabPointerDown) { _tabRebuildPending = true; return; }
    // 🚀 戰鬥 tick 內的高頻變動(扣箭/耗肉)：合併成一次重建(節流 250ms)，降低狩獵卡頓；使用者操作(非 tick)維持即時回饋
    if(!force && state.inTick) { if(!_tabThrottleTimer) _tabThrottleTimer = setTimeout(function(){ _tabThrottleTimer = null; renderTabs(); }, TAB_REBUILD_THROTTLE_MS); return; }
    if(_tabThrottleTimer) { clearTimeout(_tabThrottleTimer); _tabThrottleTimer = null; }
    // ===== 內容簽章：背包/裝備/技能等實際內容沒變時直接跳過重建 =====
    // 避免戰鬥中(掉寶、射箭扣箭、夥伴耗肉等)頻繁重繪，導致游標所在欄位閃動、捲動跳回頂端、以及 mousedown/mouseup 落在不同元素造成點擊失效。
    let _sig = (function(){
        let inv = player.inv.map(i => itemSig(i) + '.' + (i.cnt||1) + '.' + (i.lock?1:0) + '.' + (i.junk?1:0)).join(';');   // 🔧 架構#3：改用統一簽章（修正先前祝福/詛咒同被壓成 1 的重繪遺漏）
        let eq = Object.keys(player.eq).map(k => { let e = player.eq[k]; return e ? `${k}:${itemSig(e)}.${e.cnt||0}` : k+':'; }).join(',');   // 🔧 補上先前缺漏的 attr / anc
        let dd = player.d;
        return `${inv}#${eq}#${(player.skills||[]).join(',')}#${(player.grantedSkills||[]).join(',')}#${player.cls}#${player.lv}#${player.elfEle||''}#${dd.str+dd.dex+dd.con+dd.int+dd.wis}`;
    })();
    if(!force && _sig === renderTabs._sig) return;
    renderTabs._sig = _sig;
    // 真的要重建時，先記住各分頁的捲動位置，重建後還原（避免跳回頂端）
    let _scroll = {};
    ['tab-items','tab-weapons','tab-armors','tab-equip','tab-skill'].forEach(id => { let el = document.getElementById(id); if(el) _scroll[id] = el.scrollTop; });

    let eDiv = document.getElementById('tab-equip'); eDiv.innerHTML = '';
    { let _wd = player.d || {}; let _t = _wd.loadTier || 0; let _hdr = document.createElement('div'); _hdr.className = 'text-center py-0.5 mb-1 rounded bg-slate-900/60 border border-slate-700 text-sm font-bold leading-tight' + (_t >= 1 ? ' cursor-help' : ''); if (_t >= 1) { _hdr.title = _t === 1 ? '負重50%↑：HP/MP不自然恢復' : (_t === 2 ? '負重82%↑：HP/MP不自然恢復、停自動施法、攻速變慢' : '負重100%↑：HP/MP不自然恢復、停自動施法、攻速大幅變慢'); } _hdr.innerHTML = `<span class="text-slate-400">負重 </span><span class="${getLoadColor(_t)}">${_wd.weightPct||0}%</span>`; eDiv.appendChild(_hdr); }
    const slots = [{k:'wpn',n:'武器'}, ...((player.cls === 'warrior' && (player.skills.includes('sk_warrior_dualaxe') || player.eq.offwpn)) ? [{k:'offwpn',n:'副手武器'}] : []), {k:'shield',n:'副手'},{k:'helm',n:'頭盔'},{k:'armor',n:'盔甲'},{k:'tshirt',n:'T恤'},{k:'cloak',n:'斗篷'},{k:'gloves',n:'手套'},{k:'boots',n:'長靴'},{k:'amulet',n:'項鍊'},{k:'ear1',n:'耳環'},{k:'ear2',n:'耳環'},{k:'ring1',n:'戒指'},{k:'ring2',n:'戒指'},{k:'ring3',n:'戒指'},{k:'ring4',n:'戒指'},{k:'belt',n:'腰帶'},{k:'pet',n:'寵物裝備'},{k:'doll',n:'魔法娃娃'},{k:'arrow',n:'箭矢'}];   // ⚔️ offwpn：戰士學會迅猛雙斧後顯示副手武器欄
    
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
        let eq = player.eq[s.k];
        let isSetActive = false;
        if(eq && DB.items[eq.id].set && activeSets.includes(DB.items[eq.id].set)) isSetActive = true;
        // 🔮 席琳套裝：該裝備的套裝效果組別達 2 件以上（觸發套裝能力）→ 欄位底色變綠
        let isSherineActive = !!(eq && eq.seteff && player._sherineSetCnt && (player._sherineSetCnt[eq.seteff.slice(0, 2)] || 0) >= 2);

        let el = document.createElement('div');
        // 🔧 底色優先序：席琳套裝(綠) > 舊套裝(琥珀金，原綠色讓給席琳) > 一般
        el.className = `list-item text-base rounded mb-1 ${isSherineActive
            ? 'bg-green-900 border border-green-400 ring-1 ring-green-400/60 shadow-[0_0_10px_rgba(74,222,128,0.6)]'
            : (isSetActive ? 'bg-amber-900 border border-amber-400 ring-1 ring-amber-400/60 shadow-[0_0_10px_rgba(245,158,11,0.55)]' : 'bg-slate-800')}`;
        if(eq) {
            let d = DB.items[eq.id];
            let imgUrl = getIconUrl(d);
            // 👇 判斷如果裝備本身是祝福的，或者物品基底(卷軸)是祝福的，就套用螢光特效
            let glowClass = getGlowClass(eq, d);
            let imgHtml = `<img src="${imgUrl}" onerror="this.style.opacity='0';" class="w-6 h-6 ml-2 object-contain pointer-events-none ${glowClass}">`;
            el.innerHTML = `<span class="text-slate-400 w-12">${s.n}</span><div class="flex items-center justify-end flex-1"><span class="${getItemColor(eq)} text-right font-bold">${getItemFullName(eq)}</span>${imgHtml}</div>`;
            el.onclick = () => openModal(eq, true, s.k);
        } else {
            let _rlv = (s.k === 'ring3') ? 55 : (s.k === 'ring4') ? 65 : (s.k === 'ear2') ? 50 : 0;   // 🔧 第3/4戒指欄、第2耳環欄等級需求
            let _locked = _rlv && player.lv < _rlv;
            el.innerHTML = `<span class="text-slate-400 w-12">${s.n}</span><span class="${_locked ? 'text-red-400' : 'text-slate-600'}">${_locked ? '需 Lv' + _rlv : '- 空 -'}</span>`;
        }
        eDiv.appendChild(el);
    });
    
    // 👇 清空新的三個面板
    let wDiv = document.getElementById('tab-weapons'); wDiv.innerHTML = '';
    let aDiv = document.getElementById('tab-armors'); aDiv.innerHTML = '';
    let iDiv = document.getElementById('tab-items'); iDiv.innerHTML = '';

    // ⚡🗑️ 快速操作頭部：武器/防具分頁＝[快速強化][快速廢品]；道具分頁＝[快速廢品]
    wDiv.appendChild(buildQuickHeader('wpn'));
    aDiv.appendChild(buildQuickHeader('arm'));
    iDiv.appendChild(buildQuickHeader('item'));

player.inv.forEach(i => {
    if(!DB.items[i.id]) return;
    let d = DB.items[i.id];

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
        // 保留點擊開啟 Modal 功能 (所有項目皆可點擊)
        el.onclick = () => openModal(i, false);
    }
    
    // 🎯 物品分流邏輯
    if (d.type === 'wpn') {
        wDiv.appendChild(el); 
    } else if (d.type === 'arm' || d.type === 'acc') {
        aDiv.appendChild(el); 
    } else {
        iDiv.appendChild(el); 
    }
});
    
    let sDiv = document.getElementById('tab-skill'); sDiv.innerHTML = '';
    let sortedSkills = [...player.skills].filter(s => DB.skills[s] && !DB.skills[s].procOnly).sort((a,b) => (DB.skills[a].tier||0) - (DB.skills[b].tier||0));   // 🏛️ 過濾 procOnly（純武器proc技能如惡魔之吻：不顯示於技能格）

    // 🎨 已學技能：固定大小 ICON 排版；階級文字置左、4 欄格(至少 4×2)置右
    // 🔮 依「學習來源」分區：魔法書／技術書／精靈水晶／黑暗精靈水晶 各自獨立，即使同階也分開；裝備授予(sk_helm_*)歸「裝備授予」
    if (!renderTabs._skillSrc) {   // 由 skillbk 物品名稱前綴建表（一次性快取）：sk → 來源組名（split('(') 避免「黑暗精靈水晶」⊃「精靈水晶」誤判）
        renderTabs._skillSrc = {};
        for (let k in DB.items) { let it = DB.items[k]; if (it && it.type === 'skillbk' && it.sk) renderTabs._skillSrc[it.sk] = String(it.n || '').split('(')[0]; }
    }
    let _SKILL_SRC = renderTabs._skillSrc;
    const _CELL = 'width:46px;height:46px;';

    // 分組：來源 → 階級 → [技能id]
    let _grp = {};
    sortedSkills.forEach(sid => {
        let sk = DB.skills[sid]; if (!sk) return;
        let src = sk.cat ? ({ blood: '熱血', rage: '憤怒', endure: '忍耐', royal: '王族魔法' }[sk.cat] || sk.cat) : (_SKILL_SRC[sid] || '裝備授予');   // ⚔️ 戰士技能依 cat 分熱血/憤怒/忍耐；👑 王族 cat='royal'→王族魔法
        let tier = (sk.tier === undefined || sk.tier === null || sk.tier === '') ? '_' : sk.tier;
        (_grp[src] = _grp[src] || {});
        (_grp[src][tier] = _grp[src][tier] || []).push(sid);
    });
    // 來源顯示順序：固定序（不分職業）魔法書→精靈水晶→黑暗精靈水晶→技術書→記憶水晶(幻術士)→龍騎士書板(龍騎士)，裝備授予最後
    let _srcOrder = ['魔法書', '精靈水晶', '黑暗精靈水晶', '技術書', '記憶水晶', '龍騎士書板', '王族魔法', '熱血', '憤怒', '忍耐'];
    // 🛡️ 安全網：_grp 內若有 _srcOrder 未涵蓋的來源（日後新增任何技能書類型），補在「裝備授予」之前，永不漏顯（修復幻術士記憶水晶/龍騎士書板技能不顯示）
    let _renderOrder = _srcOrder.concat(Object.keys(_grp).filter(s => _srcOrder.indexOf(s) === -1 && s !== '裝備授予')).concat(['裝備授予']);

    let _renderCell = (sid) => {
        let sk = DB.skills[sid];
        let isAvail = true;
        let __granted = player.grantedSkills && player.grantedSkills.includes(sid);
        let needLv = skillReqLv(sk, sid);   // 🏅 集中化：含魔導精通特例
        if(!__granted && (needLv === undefined || player.lv < needLv)) isAvail = false;
        if(!__granted && sk.reqEle && player.elfEle !== sk.reqEle) isAvail = false;
        if(!__granted && sk.reqEleAny && !player.elfEle) isAvail = false;
        let imgUrl = getIconUrl(sk, true);
        let _bd = !isAvail ? 'border-slate-600 opacity-50'
            : (sk.type === 'manual' ? 'border-amber-500'
            : (sk.type === 'atk' ? 'border-cyan-500'
            : (sk.type === 'heal' ? 'border-green-500' : 'border-purple-500')));
        let _img = `<img src="${imgUrl}" onerror="this.style.display='none';" class="object-contain pointer-events-none" style="width:36px;height:36px;">`;
        if(sk.type === 'manual') {
            // 手動施放技能：ICON 本身可點擊施放（右下角「施」標記）；保留 id/data-unavail 供 updateSummonLock 控制(迷魅)
            return `<button id="manual-btn-${sid}" data-tip-skill="${sid}" data-unavail="${isAvail?'0':'1'}" onclick="manualCast('${sid}')" ${isAvail?'':'disabled'} title="${sk.n}"
                class="tip-host relative flex items-center justify-center rounded border ${_bd} bg-slate-900/40 ${isAvail?'hover:bg-amber-900/40 cursor-pointer':'cursor-not-allowed'}" style="${_CELL}">${_img}<span class="absolute right-0 -bottom-px text-[9px] leading-none font-bold text-amber-300 pointer-events-none">施</span></button>`;
        }
        return `<div data-tip-skill="${sid}" title="${sk.n}" class="tip-host flex items-center justify-center rounded border ${_bd} bg-slate-900/40" style="${_CELL}">${_img}</div>`;
    };

    _renderOrder.forEach(src => {
        let byTier = _grp[src]; if (!byTier) return;
        let _tiers = Object.keys(byTier).sort((a,b) => (a === '_' ? 999 : +a) - (b === '_' ? 999 : +b));
        _tiers.forEach(t => {
            let list = byTier[t];
            let _tierLabel = (t === '_') ? '其他' : (t + ' 階');
            let cells = list.map(_renderCell).join('');
            // 補空白格至 4 的倍數、且至少 8 格（4×2），維持 4×2 區塊版型
            let _pad = Math.max(8, Math.ceil(list.length / 4) * 4);
            for(let i = list.length; i < _pad; i++) cells += `<div class="rounded border border-slate-800/40 bg-slate-900/20" style="${_CELL}"></div>`;
            let section = document.createElement('div');
            // 階級文字置左、4×2 ICON 置右；區塊間以細分隔線區隔（首區不畫上邊線）
            let _sepCls = sDiv.children.length ? ' border-t border-slate-700/50' : '';
            section.className = 'flex items-center gap-2 py-2' + _sepCls;
            section.innerHTML = `<div class="flex flex-col justify-center shrink-0" style="width:82px;"><div class="text-sm font-bold text-slate-300 leading-tight">${_tierLabel}</div><div class="text-[11px] text-slate-500 leading-tight">${src}</div></div><div class="grid gap-1.5 shrink-0" style="grid-template-columns:repeat(4,46px);">${cells}</div>`;
            sDiv.appendChild(section);
        });
    });
    // 還原各分頁捲動位置
    ['tab-items','tab-weapons','tab-armors','tab-equip','tab-skill'].forEach(id => { let el = document.getElementById(id); if(el && _scroll[id] != null) el.scrollTop = _scroll[id]; });
    updateSummonLock();
}

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
    if (sk.type === 'heal' && sk.autoBuff) {   // HoT 治癒（體力回復術/生命的祝福）：清掉持續回復
        if (player.hot && (player.hot.skId === sid || player.hot.skId == null)) { player.hot = null; ended = true; }
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
            buffHtml += `<label class="cursor-pointer flex items-center gap-2 ${(isAvail && !__locked && !__awakenLocked)?'':'opacity-50'}"${__ttl}><input type="checkbox" id="auto-sk-${sid}" ${checked} ${__dis}${sumAttr}${__awakenAttr}${__purAttr}${__autoBuffAttr}> <span class="${__span}">${sk.n}</span></label>`;
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
    wpn_dagger2: ['匕首'], wpn_dagger1: ['匕首'], wpn_11: ['匕首'], wpn_33: ['匕首'],
    wpn_longsword: ['單手劍'], wpn_9: ['單手劍'], wpn_scimitar: ['單手劍'], wpn_26: ['單手劍'],
    wpn_elfsword: ['單手劍'], wpn_27: ['單手劍'], wpn_shortsword: ['單手劍'], wpn_redknight: ['單手劍'],
    wpn_invader: ['單手劍'], wpn_34: ['單手劍'], wpn_35: ['單手劍'],
    wpn_36: ['單手劍'], wpn_rapier: ['單手劍'], wpn_mailbreaker: ['單手劍'], wpn_silversword: ['單手劍'], wpn_37: ['單手劍'],
    wpn_21: ['矛'], wpn_24: ['矛'], wpn_25: ['矛'], wpn_28: ['矛'], wpn_39: ['矛'], wpn_40: ['矛'], wpn_41: ['矛'], wpn_17: ['矛'], wpn_4: ['矛'],
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
    wpn_thor_hammer:['單手鈍器'], wpn_osis_hammer:['單手鈍器'], wpn_mapler_punish:['雙手鈍器'], wpn_pagrio_wrath:['單手劍'], wpn_eva_scold:['單手劍']
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
const CLASSIC_HIDDEN_EFF_LABELS = ['共鳴','魔爆','連射','反擊','出血','穿透','切割','居合','魔擊','鈍擊','重擊','格檔'];
function filterClassicEffLabels(effArr){ return (player && player.classicMode) ? effArr.filter(e => !CLASSIC_HIDDEN_EFF_LABELS.some(h => e.startsWith(h))) : effArr; }
function weaponHasBleed(id){ let t = getWeaponTags(id); return t.includes('匕首') || t.includes('矛'); }   // 匕首與矛皆帶出血特效
function buildItemDescHTML(item) {
    let d = DB.items[item.id];
    if(!d) return '';
    let desc = d.d || "";
    // 🔮 席琳套裝效果：寫在資訊欄（綠色標題＋淺綠加成說明），不冠在名稱前
    if (item.seteff) {
        let _g = item.seteff.slice(0, 2);
        let _lines = (SHERINE_SET_TEXT[_g] || []).map(t => `<span class="text-green-200">・${t}</span>`).join('<br>');
        desc = `<span class="c-sherine font-bold">✦ 席琳套裝效果：${_g}</span><br>${_lines}`
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
        if((item.en || 0) >= 1) desc += `<br><span class="text-amber-300">強化最終傷害 ×${enhanceWpnFinalMult(item.en).toFixed(2)}</span>`;   // 🔧 武器強化最終傷害倍率（+1 起·×1.02~×2.50）

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
        if(d.ac !== undefined) desc += `<br><span class="text-blue-300">防禦(AC): -${d.ac}</span>`;
        let isRanged = (d.ranged === true);
        let hitLabel = isRanged ? "遠距離命中" : "近距離命中";
        let dmgLabel = isRanged ? "遠距離傷害" : "近距離傷害";
        if(d.hit !== undefined)        desc += ` / ${hitLabel}: ${formatBonus(d.hit)}`;
        if(d.dmgBonus !== undefined)   desc += ` / ${dmgLabel}: ${formatBonus(d.dmgBonus)}`;
        if(d.mr || d.mrPerEn) { let _en = capEn(item.en, d); desc += ` / 魔防(MR): ${formatBonus((d.mr||0) + (d.mrPerEn||0)*_en)}` + (d.mrPerEn ? `（每強化 +${d.mrPerEn}）` : ''); }
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
        // 🛡️ 臂甲：依強化值動態顯示門檻特效現值＋每強化HP
        if(d.armguard) {
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
        if (typeof WAND_LIGHTARROW_IDS !== 'undefined' && WAND_LIGHTARROW_IDS.includes(item.id)) _eff.push('共鳴');
        _eff = filterClassicEffLabels(_eff);   // 🎮 經典模式：移除已停用特效字樣
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

    // 🛡️ 適用職業：以職業 logo 顯示可裝備此裝備的職業（騎士/妖精/法師/黑暗妖精/幻術士；黑暗妖精走 darkEquipOk 真實規則）
    if (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') {
        const _EQ_CLASSES = [['knight','騎士'], ['elf','妖精'], ['mage','法師'], ['dark','黑暗妖精'], ['illusion','幻術士'], ['dragon','龍騎士'], ['warrior','戰士'], ['royal','王族']];
        let _logos = _EQ_CLASSES
            .filter(([c]) => (c === 'dark') ? darkEquipOk(d, item.id) : (c === 'illusion') ? illusionEquipOk(d, item.id) : (c === 'dragon') ? dragonEquipOk(d, item.id) : (c === 'warrior') ? warriorEquipOk(d, item.id) : (c === 'royal') ? royalEquipOk(d, item.id) : reqAllowsClass(d, c))
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
        if(d.type === 'pot' || d.type === 'skillbk' || (d.type === 'misc' && d.eff && !d.noUse)) {   // 🔧 misc 且有效果(萬能藥/回憶蠟燭/靈魂之球等)亦顯示使用按鈕；noUse 除外
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
        const SLOT_LABEL = { wpn:'武器', offwpn:'副手武器', helm:'頭盔', armor:'盔甲', shield:'副手', cloak:'斗篷', tshirt:'內衣', gloves:'手套', boots:'鞋子', ring1:'戒指 1', ring2:'戒指 2', ring3:'戒指 3', ring4:'戒指 4', amulet:'項鍊', ear1:'耳環 1', ear2:'耳環 2', belt:'腰帶', pet:'寵物裝備' };
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
    let target = st.target || 6;
    let opts = '';
    for (let t = 1; t <= 12; t++) opts += `<option value="${t}" ${t === target ? 'selected' : ''}>+${t}</option>`;
    let _blessId = type === 'wpn' ? 'scroll_weapon_b' : 'scroll_armor_b';   // 🌟 祝福卷（飾品無祝福卷，仍以防具祝福卷數量顯示）
    let _blessCnt = (player.inv.find(i => i.id === _blessId) || {}).cnt || 0;
    hdr.innerHTML = `<div class="flex items-center gap-1 bg-slate-900/80 border border-slate-700 rounded p-1">
        <button onclick="cancelQuickEnhance('${type}')" class="btn border-slate-600 bg-slate-700 hover:bg-slate-600 px-2 py-1 text-xs font-bold text-white rounded">取消</button>
        <button onclick="runQuickEnhance('${type}')" class="btn border-blue-600 bg-blue-800 hover:bg-blue-700 px-2 py-1 text-xs font-bold text-blue-200 rounded">強化</button>
        <label class="flex items-center gap-1 text-xs ${_blessCnt > 0 ? 'text-yellow-300' : 'text-slate-500'} cursor-pointer select-none whitespace-nowrap" title="勾選＝使用『祝福的卷軸』強化（成功時隨機 +1~+3）；不勾＝一般卷軸（+1）。飾品無祝福卷，恆以一般卷強化。"><input type="checkbox" ${st.useBless ? 'checked' : ''} onchange="quickEnh['${type}'].useBless=this.checked"> 祝福卷(${_blessCnt})</label>
        <select id="qe-target-${type}" onchange="quickEnh['${type}'].target=Number(this.value)" class="bg-slate-800 border border-slate-600 text-blue-200 text-xs font-bold rounded px-1 py-1 ml-auto">${opts}</select>
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

function runQuickEnhance(type) {
    if (traditionalActive()) return;   // 🏛️ 縱深防護：傳統模式不可批次強化
    let st = quickEnh[type];
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
        let eligible = _qjEligibleItems(type);
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
function quickJunkSelectAll(type, checked) { let st = quickJunk[type]; st.sel = {}; if (checked) _qjEligibleItems(type).forEach(i => st.sel[i.uid] = true); renderTabs(true); }
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
        if (want) { player.junkPrefs[itemSig(i)] = true; marked++; }
        else { delete player.junkPrefs[itemSig(i)]; unmarked++; }
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
    if (item.junk) { player.junkPrefs[itemSig(item)] = true; _bumpJunkSellTimer(); }   // 🗑️ 標為廢品→重置自動賣出倒數（標完 10 分鐘才賣）
    else delete player.junkPrefs[itemSig(item)];
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

function sortInventory() {
    player.inv.sort(invSortCmp);

    renderTabs();
    saveGame();
    logSys('<span class="text-cyan-300 font-bold">背包已重新排列。</span>');
}

// 一鍵賣出所有已勾為廢品的武器/防具/飾品（鎖定者不會被賣，因鎖定時已自動取消勾選）
// ⏲️ 自動賣出廢品：由主迴圈 tick（每 60 秒）呼叫；賣掉所有標示為廢品(且非鎖定/可販售)的物品。無廢品→靜默不洗版。
function autoSellJunk(manual) {   // manual=true → 玩家按「一鍵賣出」立即賣（無廢品時給提示）；不帶參數＝主迴圈自動賣(靜默)
    if (!player || !Array.isArray(player.inv)) return;
    let toSell = player.inv.filter(i => {
        let d = DB.items[i.id];
        return i.junk && !i.lock && d && !d.noSell;   // 🏅 不可販售物（精通之證）排除
    });
    if (toSell.length === 0) { if (manual) logSys('<span class="text-slate-400">目前沒有標記為廢品的物品可賣出（請先在 武器／防具／道具 分頁用「🗑️ 快速廢品」標記）。</span>'); return; }   // 無廢品→自動靜默、手動給提示
    let totalGold = 0, totalCount = 0;
    toSell.forEach(i => { totalGold += getSellPrice(i) * i.cnt; totalCount += i.cnt; });
    let _grantSold = toSell.some(i => DB.items[i.id] && DB.items[i.id].grantSkills);
    player.inv = player.inv.filter(i => !toSell.includes(i));
    player.gold += totalGold;
    logSys(`<span class="text-amber-300">${manual ? '一鍵賣出' : '系統自動賣出'} ${toSell.length} 件(共 ${totalCount} 個)廢品，獲得 <span class="text-yellow-400 font-bold">${totalGold}</span> 金幣。</span>`);
    renderTabs();
    updateUI();
    if(_grantSold) { calcStats(); renderSkillSelects(); }
    saveGame();
}

// 🗑️ 自動賣出開關（右上角按鈕）：點亮＝開啟自動賣出(每 3 分鐘)；點一下變暗、文字「停止賣出」並暫停。狀態存 player.autoSellOn(預設開·undefined 視為開)，隨存檔持久化。
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
    b.title = on ? '自動賣出已開啟（每 3 分鐘賣出標記為廢品的物品）。點一下暫停。' : '自動賣出已停止。點一下重新開啟。';
}
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
    ['stats', 'equip', 'weapons', 'skill', 'armors', 'items', 'audit'].forEach(id => { let _e = document.getElementById(`tab-${id}`); if(_e) _e.classList.add('hidden'); });
    document.getElementById(`tab-${t}`).classList.remove('hidden');
    if(t === 'audit' && typeof renderAuditTab === 'function') renderAuditTab();
}

// ===== 🤝 協力傭兵隊伍面板（Phase 1：顯示血/魔/經驗條＋每傭兵攻擊技能/治癒魔法設定）=====
let _squadSig = '';          // 結構簽章：名單(slot)變動才重建 DOM，避免每幀 innerHTML 重繪
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
            : ((sk.type === 'heal' && !sk.autoBuff && !['sk_antidote', 'sk_holy_light', 'sk_cancel'].includes(sid)) || (sk.type === 'atk' && sk.healSlot));
        if (!match) return;
        opts += `<option value="${sid}"${cur === sid ? ' selected' : ''}>${sk.n}</option>`;
    });
    return opts;
}

function renderSquadPanel() {
    let panel = document.getElementById('squad-panel');
    if (!panel) return;
    if (!_autoCollapseInit) { _autoCollapseInit = true; try { if (_lsGet('fb5_automation_collapsed') === '1') _applyAutomationCollapse(true); } catch (e) {} try { if (_lsGet('fb5_squad_collapsed') === '1') _applySquadCollapse(true); } catch (e) {} }   // 首次套用收合偏好（自動化設定＋傭兵隊伍）
    let allies = (player && player.allies) ? player.allies.filter(Boolean) : [];
    if (!allies.length) { panel.style.display = 'none'; _squadSig = ''; return; }
    panel.style.display = '';
    let sig = allies.map(a => a._slot + ':' + (a._allyName || '') + ':' + (a._downed ? 'D' : '') + ':' + (a.lv || 1)).join('|');   // 名單/倒地/等級變動才重建結構（升級即更新 Lv 顯示）
    if (sig !== _squadSig) {
        _squadSig = sig;
        document.getElementById('squad-tab-team').innerHTML = allies.map(a => {
            let s = a._slot;
            if (a._downed) {   // 🤝 Phase 3：倒地→灰顯卡片＋兩種復活鈕（返生術：消耗MP·無冷卻立即；復活卷軸：死亡15秒後。鈕文字/可用狀態每幀更新）
                return `<div class="bg-slate-900/70 border border-red-900 rounded p-2 flex items-center justify-between gap-2" style="opacity:0.85;">
                    <div class="text-sm"><span class="font-bold text-slate-400">${a._allyName}</span> <span class="text-slate-600 text-xs">Lv.${a.lv || 1}</span> <span class="text-red-400 font-bold">【倒地】</span></div>
                    <div class="flex gap-1 shrink-0">
                        <button id="squad-rez-${s}" class="py-1 px-2 text-xs font-bold rounded border whitespace-nowrap" style="background:#1e3a8a;border-color:#3b82f6;color:#bfdbfe;" onclick="reviveMercenary('${s}','rez')">返生術</button>
                        <button id="squad-revive-${s}" class="py-1 px-2 text-xs font-bold rounded border whitespace-nowrap" style="background:#7f1d1d;border-color:#b91c1c;color:#fecaca;" onclick="reviveMercenary('${s}','scroll')">卷軸</button>
                    </div>
                </div>`;
            }
            return `<div class="bg-slate-800/60 border border-slate-600 rounded p-2 flex flex-col gap-1">
                <div class="flex justify-between items-center text-sm"><span class="font-bold text-amber-200">${a._allyName}</span><span class="text-slate-400 text-xs">Lv.${a.lv || 1}</span></div>
                <div id="squad-status-${s}" class="text-xs" style="color:#fca5a5;line-height:1.2;"></div>
                <div class="flex items-center gap-1"><span class="text-red-400 text-xs text-right" style="width:1.6rem;">HP</span><div class="bar-bg flex-1 !h-4"><div id="squad-hp-${s}" class="bar-fill bg-red-600" style="width:100%"></div><div id="squad-hp-txt-${s}" class="bar-text text-white text-xs" style="line-height:16px;">0/0</div></div></div>
                <div class="flex items-center gap-1"><span class="text-blue-400 text-xs text-right" style="width:1.6rem;">MP</span><div class="bar-bg flex-1 !h-4"><div id="squad-mp-${s}" class="bar-fill bg-blue-600" style="width:100%"></div><div id="squad-mp-txt-${s}" class="bar-text text-white text-xs" style="line-height:16px;">0/0</div></div></div>
                <div class="flex items-center gap-1"><span class="text-yellow-500 text-xs text-right" style="width:1.6rem;">EXP</span><div class="bar-bg flex-1 !h-4"><div id="squad-exp-${s}" class="bar-fill bg-yellow-500" style="width:0%"></div><div id="squad-exp-txt-${s}" class="bar-text text-white text-xs" style="line-height:16px;">0%</div></div></div>
            </div>`;
        }).join('');
        document.getElementById('squad-tab-skill').innerHTML = allies.map(a => {
            let s = a._slot;
            let hpPct = (a._healHpPct != null) ? a._healHpPct : 70;
            let safePct = (a._hpSafePct != null) ? a._hpSafePct : 0;
            return `<div class="bg-slate-800/60 border border-slate-600 rounded p-2 flex flex-col gap-1">
                <div class="text-sm font-bold text-amber-200">${a._allyName} <span class="text-slate-500 text-xs">Lv.${a.lv || 1}</span></div>
                <div class="flex items-center gap-1 text-xs"><span class="text-cyan-400 font-bold shrink-0" style="width:3rem;">攻擊技能</span><select class="flex-1 bg-slate-900 border border-slate-600 text-cyan-300 px-1 py-1 rounded text-xs outline-none" onchange="setAllyAtkSkill('${s}', this.value)">${_allySkillOptions(a, 'atk', a._atkSkill || '')}</select></div>
                <div class="flex items-center gap-1 text-xs"><span class="text-green-400 font-bold shrink-0" style="width:3rem;">治癒魔法</span><select class="flex-1 bg-slate-900 border border-slate-600 text-green-300 px-1 py-1 rounded text-xs outline-none" onchange="setAllyHealSkill('${s}', this.value)">${_allySkillOptions(a, 'heal', a._healSkill || '')}</select></div>
                <div class="flex items-center justify-end gap-1 text-xs text-slate-400">HP &lt; <input type="number" min="0" max="100" value="${hpPct}" class="w-12 bg-slate-900 border border-slate-600 text-center text-white rounded" onchange="setAllyHealHp('${s}', this.value)">% 施放治癒</div>
                <div class="flex items-center justify-end gap-1 text-xs text-amber-400" title="HP 安全線：低於此％時，喝隊長設定的藥水回血，並暫停施放消耗 HP 的技能（退回普攻）。0 = 關閉。">HP &lt; <input type="number" min="0" max="100" value="${safePct}" class="w-12 bg-slate-900 border border-amber-700 text-center text-white rounded" onchange="setAllyHpSafe('${s}', this.value)">% 喝藥水/停耗HP技</div>
            </div>`;
        }).join('');
        switchSquadTab(_squadTab);   // 重建後還原目前分頁與按鈕高亮
    }
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
            if (b) {
                let cd = a._reviveCd || 0;
                if (cd > 0) { b.textContent = '卷軸 ' + Math.ceil(cd / 10) + 's'; b.style.opacity = '0.45'; b.title = '復活卷軸須死亡 15 秒後才能使用'; }
                else { let sc = player.inv && player.inv.find(i => i.id === 'scroll_revive'); let n = sc ? (sc.cnt || 0) : 0; b.textContent = n > 0 ? ('卷軸×' + n) : '無卷軸'; b.style.opacity = n > 0 ? '1' : '0.6'; b.title = n > 0 ? '使用復活卷軸復活' : '沒有復活卷軸'; }
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

function _findAlly(slot) { return (player.allies || []).find(a => a && String(a._slot) === String(slot)); }
function setAllyAtkSkill(slot, val) { let a = _findAlly(slot); if (a) { a._atkSkill = val || ''; saveGame(); } }   // _atkSkill 即時生效（傭兵攻擊路徑直接讀 ally._atkSkill）
function setAllyHealSkill(slot, val) { let a = _findAlly(slot); if (a) { a._healSkill = val || ''; saveGame(); } }   // _healSkill 儲存待 Phase 3 傭兵自動補血讀取
function setAllyHealHp(slot, val) { let a = _findAlly(slot); if (a) { a._healHpPct = Math.max(0, Math.min(100, parseInt(val) || 0)); saveGame(); } }
function setAllyHpSafe(slot, val) { let a = _findAlly(slot); if (a) { a._hpSafePct = Math.max(0, Math.min(100, parseInt(val) || 0)); saveGame(); } }   // 🍶🛡️ HP 安全線：低於此%→喝隊長藥水＋暫停耗HP技能；0=關閉

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
// 🤝 協力傭兵隊伍面板收合（只留標題）：比照自動化設定。#squad-panel 無 flex-1（內容高度）→ 收合 body 即縮成標題列。
function _applySquadCollapse(collapsed) {
    let body = document.getElementById('squad-body'), arrow = document.getElementById('squad-collapse-arrow');
    if (!body) return;
    body.classList.toggle('hidden', collapsed);
    if (arrow) arrow.textContent = collapsed ? '▶' : '▼';
}
function toggleSquadCollapse() {
    let body = document.getElementById('squad-body');
    let collapsed = !(body && body.classList.contains('hidden'));
    _applySquadCollapse(collapsed);
    try { _lsSet('fb5_squad_collapsed', collapsed ? '1' : '0'); } catch (e) {}
}
