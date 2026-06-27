function gameLoop() {
    let now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if(_loopLast == null) _loopLast = now;
    let elapsed = now - _loopLast;
    _loopLast = now;

    // 遊戲未進行 / 角色死亡：不累積也不補跑（丟棄這段時間）
    if(!state.running || player.dead) { _tickDebt = 0; return; }

    if(elapsed < 0) elapsed = 0;
    if(elapsed > MAX_CATCHUP_MS) elapsed = MAX_CATCHUP_MS; // 上限保護
    _tickDebt += elapsed;

    let n = Math.floor(_tickDebt / TICK_MS);
    _tickDebt -= n * TICK_MS;
    if(n <= 0) return;

    if(n === 1) {           // 正常情況：每 100ms 跑一個 tick
        // 🔧 前景即時遊玩不顯示金幣（金幣不逐殺輸出，也不在即時累積）；金幣僅於背景補跑回來時由 flushAwaySummary 彙整顯示。
        flushAwaySummary(); // 回到即時：若先前累積了補跑所得，於此統一輸出一次
        state.inTick = true;   // 🔧 架構#2：tick 期間的擊殺只標記，結束後統一清算
        try { tick(); } finally { state.inTick = false; settleDeadMobs(); }
        flushTickRender();   // 🚀 重繪合併：把本 tick 內累積的 updateUI/renderMobs 統一重繪一次
        return;
    }

    // 需要補跑多個 tick：期間關閉逐 tick 的畫面刷新與戰鬥訊息，跑完再統一刷新一次
    // 補跑期間 logSys 被靜音，先記錄背包與金幣，補跑後把增量「累積」起來（不立即輸出，
    // 避免計時抖動/背景降速造成每次小補跑都洗一行訊息）。達門檻並回到即時後由 flushAwaySummary 統一輸出。
    const _invBefore = {};
    player.inv.forEach(i => { _invBefore[i.id] = (_invBefore[i.id] || 0) + i.cnt; });
    const _goldBefore = player.gold;

    state.ff = true;
    state.inTick = true;   // 🔧 架構#2：補跑期間同樣每個 tick 結束才清算死亡
    try {
        for(let k=0; k<n; k++) {
            if(!state.running || player.dead) break;
            tick();
            settleDeadMobs();   // 每個 tick 結束即清算，下一個 tick 以遞補完成的場面開始
        }
    } finally {
        state.ff = false;   // 保證即使 tick() 拋例外也會解除補跑旗標，避免畫面/出怪永久凍結
        state.inTick = false;
        settleDeadMobs();   // 保底：例外中斷時也完成清算
    }

    // 將這次補跑的淨增量併入累積（以前後數量差計算，含被消耗者的負值，最終只輸出淨正值）
    const _invAfter = {};
    player.inv.forEach(i => { _invAfter[i.id] = (_invAfter[i.id] || 0) + i.cnt; });
    let _ids = new Set([...Object.keys(_invBefore), ...Object.keys(_invAfter)]);
    _ids.forEach(id => {
        let delta = (_invAfter[id] || 0) - (_invBefore[id] || 0);
        if (delta !== 0) _awayAcc.items[id] = (_awayAcc.items[id] || 0) + delta;
    });
    let _goldGain = player.gold - _goldBefore;
    if (_goldGain > 0) _awayAcc.gold += _goldGain;
    _awayAcc.ticks += n;

    // 補跑結束，統一刷新畫面（累積所得於下一個即時 tick 開頭由 flushAwaySummary 統一輸出）
    updateUI(); renderMobs(); renderTabs();
}

// 🛡️ 絕對屏障：與世界隔絕——無法攻擊/施法/用道具、不自然恢復、不受任何傷害（持續期間 player.buffs.sk_abs_barrier>0）
function inAbsBarrier() { return !!(player.buffs && player.buffs.sk_abs_barrier > 0); }
// 🚀 重繪合併：tick 進行中(state.inTick)時 updateUI/renderMobs 只標記 dirty，於 tick 結尾 flushTickRender() 統一重繪一次，
//   避免單一 tick 內(玩家＋多傭兵＋持續傷害＋特效＋擊殺)重複重繪十數次；tick 外(點擊/裝備/用道具/開面板)維持立即重繪、體感不變。
let _uiDirty = false, _mobsDirty = false;
function updateUI() { if (state.inTick) { _uiDirty = true; return; } _uiDirty = false; _updateUIImpl(); }
function renderMobs() { if (state.inTick) { _mobsDirty = true; return; } _mobsDirty = false; _renderMobsImpl(); }
function flushTickRender() { if (_uiDirty) { _uiDirty = false; _updateUIImpl(); } if (_mobsDirty) { _mobsDirty = false; _renderMobsImpl(); } }
// 🚀 怪物卡互動穩定：① 滑鼠所在怪的 uid 以 JS 追蹤(_hoverMobUid)、每次重繪都重新套用「顯示名字」class→避免重繪(每 tick 換掉 #mob-list 內容)使 :hover 瞬間失效造成名字一直閃；② 按住怪物卡期間(_mobPointerDown)延後重繪→避免 mousedown↔mouseup 之間整列被換掉使點擊切換目標失效。
let _hoverMobUid = null, _mobPointerDown = false, _mobRebuildPending = false;
function _applyHoverName() {   // 依 _hoverMobUid 即時切換各卡名字顯示(不整列重繪)
    let ml = document.getElementById('mob-list'); if (!ml) return;
    ml.querySelectorAll('.mob-target').forEach(c => c.classList.toggle('name-show', !!_hoverMobUid && c.getAttribute('data-uid') === _hoverMobUid));
}
function _initMobListGuard() {   // 在 #mob-list(穩定父節點·只換其 innerHTML)上掛委派事件，跨重繪存活
    let ml = document.getElementById('mob-list'); if (!ml || ml._guardInit) return;
    ml._guardInit = true;
    ml.addEventListener('pointerdown', () => { _mobPointerDown = true; });
    ml.addEventListener('mouseover', e => {   // 只有滑到「怪物圖片區」才顯示名字(圖 pointer-events:none→事件落在 .mob-img-inner)
        let inImg = e.target.closest && e.target.closest('.mob-img-wrap');
        let card = e.target.closest && e.target.closest('.mob-target');
        let uid = (card && inImg) ? card.getAttribute('data-uid') : null;
        if (uid !== _hoverMobUid) { _hoverMobUid = uid; _applyHoverName(); }
    });
    ml.addEventListener('mouseleave', () => { if (_hoverMobUid !== null) { _hoverMobUid = null; _applyHoverName(); } });   // 真正離開整個怪物列才清(不受內部重繪影響)
    let release = () => { if (!_mobPointerDown) return; _mobPointerDown = false; if (_mobRebuildPending) { _mobRebuildPending = false; setTimeout(() => _renderMobsImpl(), 0); } };   // 放開後(讓 click→setTarget 先在存活節點上觸發)再補一次重繪
    document.addEventListener('pointerup', release);
    document.addEventListener('pointercancel', release);
}
function tick() {
    if(!state.running || player.dead) return;
    state.ticks++;
    _combatSrc = null;   // ⚔️ 戰鬥日誌來源：每 tick 起始重置（玩家攻擊/施法/DoT 等預設依顏色type推定；友方派發點會各自設定）
    castleGuardTick();   // 🏰 城堡護衛：回血/力竭恢復/城堡擁有結束自動解散
    for(let k in player.manualCd) if(player.manualCd[k] > 0) player.manualCd[k]--;
    
    let canAct = true;
    for(let k in player.statuses) {
        if (player.statuses[k] > 0 && k !== 'poisonDmg' && k !== 'poisonTick' && k !== 'burnDmg' && k !== 'burnTick' && k !== 'scaldDmg' && k !== 'scaldTick' && k !== 'bleedDmg' && k !== 'bleedTick') {
            player.statuses[k]--;
            if(k === 'cleave' && player.statuses.cleave === 0) calcStats();   // 🔧 切割到期：重算攻速
            if(k === 'evilAura' && player.statuses.evilAura === 0) calcStats();   // 🔧 邪靈之氣到期：還原 AC/ER
            if(k === 'stun' || k === 'freeze' || k === 'stone' || k === 'paralyze' || k === 'sleep') canAct = false;
        }
    }
    if (inAbsBarrier()) canAct = false;   // 🛡️ 絕對屏障：無法攻擊/施法/自動行動

    if (state.ticks % 160 === 0 && !inAbsBarrier()) {   // 🛡️ 絕對屏障：不自然恢復 HP/MP
        regenTick();
    }
    if (state.ticks % 10 === 0) siegeTick();   // 攻城戰：每秒檢查時限
    if (state.ticks % 100 === 0) { try { refreshPandoraMarket(false); } catch (e) {} }   // 🔧 潘朵拉黑市：每 10 秒檢查是否到 10 分鐘換商品（含稀有公告）
    
    if(player.statuses.poison > 0 && state.ticks % player.statuses.poisonTick === 0 && !inAbsBarrier()) {
        let _pdmg = player.statuses.poisonDmg;
        if (player.buffs && player.buffs.sk_dark_poisonres > 0) _pdmg = Math.max(1, Math.floor(_pdmg / 2));   // 🔧 毒性抵抗：中毒傷害減半
        player.hp -= _pdmg;
        logCombat(`你受到劇毒傷害 ${_pdmg} 點。`, 'enemy');
        if(player.hp <= 0) { killPlayer(); return; }
        updateUI();
    }
    if(player.statuses.burn > 0 && state.ticks % player.statuses.burnTick === 0 && !inAbsBarrier()) {
        player.hp -= player.statuses.burnDmg;
        logCombat(`你受到灼燒傷害 ${player.statuses.burnDmg} 點。`, 'enemy');
        if(player.hp <= 0) { killPlayer(); return; }
        updateUI();
    }
    if(player.statuses.scald > 0 && state.ticks % player.statuses.scaldTick === 0 && !inAbsBarrier()) {
        player.hp -= player.statuses.scaldDmg;
        logCombat(`你受到燙傷傷害 ${player.statuses.scaldDmg} 點。`, 'enemy');
        if(player.hp <= 0) { killPlayer(); return; }
        updateUI();
    }
    if(player.statuses.bleed > 0 && state.ticks % player.statuses.bleedTick === 0 && !inAbsBarrier()) {
        player.hp -= player.statuses.bleedDmg;
        logCombat(`你受到出血傷害 ${player.statuses.bleedDmg} 點。`, 'enemy');
        if(player.hp <= 0) { killPlayer(); return; }
        updateUI();
    }

    // 🌨️🔥 持續傷害型增益（冰雪颶風/火牢…）：各自間隔（stormInterval ticks）到時對全體敵人造成傷害
    if (player.buffs) for (let _ssid of STORM_BUFF_SKILLS) { let _ssk = DB.skills[_ssid]; if (player.buffs[_ssid] > 0 && _ssk && state.ticks % (_ssk.stormInterval || 40) === 0) stormBuffTick(_ssk); }

    let alerts = [];
    if(player.statuses.stun > 0) alerts.push("暈眩中");
    if(player.statuses.freeze > 0) alerts.push("冰凍中");
    if(player.statuses.stone > 0) alerts.push("石化中");
    if(player.statuses.paralyze > 0) alerts.push("麻痺中");
    if(player.statuses.silence > 0) alerts.push("沉默中");
    if(player.statuses.magicseal > 0) alerts.push("魔法封印中");
    if(player.statuses.poison > 0) alerts.push("中毒");
    if(player.statuses.burn > 0) alerts.push("灼燒");
    if(player.statuses.scald > 0) alerts.push("燙傷");
    if(player.statuses.bleed > 0) alerts.push("出血");
    if(player.statuses.sleep > 0) alerts.push("沉睡中");
    if(!state.ff) {
        document.getElementById('status-alerts').innerText = alerts.length > 0 ? "[" + alerts.join(", ") + "]" : "";
        document.getElementById('status-alerts').className = alerts.length > 0 ? "text-red-400 text-sm font-bold anim-flash" : "text-sm font-normal";
        renderStatusEffects(); // 每個 tick 即時刷新「狀態」欄的增益/減益顯示
    }
    
    // 法術自動施放冷卻：改以 tick(0.1秒) 遞減，讓施法間隔能受攻速效果細緻影響
    if(player.cds.atkSk > 0) player.cds.atkSk--;
    if(player.cds.healSk > 0) player.cds.healSk--;
    if((player.cds.purifySk || 0) > 0) player.cds.purifySk--;   // 🔧 淨化技獨立冷卻
    if(canAct) autoCastSpells();   // 每 tick 嘗試自動施法，實際間隔由上方冷卻控制

    if(state.ticks % 10 === 0) {
        if(player.cds.pot > 0) player.cds.pot--;   // 藥水冷卻維持每秒遞減
        if(player.reviveScrollCd > 0) player.reviveScrollCd--;   // 復活卷軸冷卻：僅存活時倒數（此區塊死亡時不執行）
        if(player.magicShieldCd > 0) player.magicShieldCd--;     // 魔法屏障抵擋後冷卻：僅存活時倒數
        // 🔧 架構統一：所有 buff（以秒計）的「唯一」遞減點，每秒扣 1。
        // 原於 regenTick 每 160 tick 批次扣 16，到期誤差可達 0~16 秒（如 16 秒的魔法屏障可能瞬間過期）；
        // taming 原本另有專屬遞減，一併整合於此。
        let _buffEnded = false;
        for(let k in player.buffs) {
            if(player.buffs[k] > 0) {
                player.buffs[k]--;
                if(player.buffs[k] <= 0) {
                    player.buffs[k] = 0;
                    _buffEnded = true;
                    let buffName = DB.skills[k] ? DB.skills[k].n : (BUFF_NAMES[k] || k);
                    logSys(`狀態 [${buffName}] 結束了。`);
                }
            }
        }
        if(player._waterVitalCd > 0) player._waterVitalCd--;   // 🔧 水之元氣：觸發後 7 秒冷卻（每秒遞減）
        if(_buffEnded) calcStats();   // 到期重算（變身還原、技能加成移除等）
        if(canAct) autoActions();
        else tryEmergencyDispel();   // 🔧 石化/冰凍/暈眩/麻痺/沉睡（行動不能）中：仍允許自動施放「魔法相消術／聖潔之光」自救（沉默/魔法封印中除外）
    }

    // === 出怪判定：以邏輯 tick (state.ticks) 為準，與主迴圈時間補跑同步 ===
    // mapState.spawnAt[i] = 該格子預定出怪的 tick 值；為 null 代表該格目前有怪、無需排程。
    {
        let isPureBossMap = PURE_BOSS_MAPS.includes(mapState.current) && !KING_ROOMS[mapState.current];   // 🔧 軍王之室仍屬純BOSS房(免自動瞬移/追蹤)，但版面用三格
        if(!mapState.spawnAt) mapState.spawnAt = [null, null, null, null, null];
        let nowT = state.ticks;
        if(KING_ROOMS[mapState.current] && state._kbRespawnAt != null) {
            // 🔧 軍王之室復活等待中：15 秒內不刷任何怪；時間到則消耗 1 把鑰匙、從頭重生軍王與兩側小怪（背景/離線補跑期間也照常復活）
            if(nowT >= state._kbRespawnAt) { state._kbRespawnAt = null; kbRoomRespawn(); }
        } else if(KING_ROOMS[mapState.current] && KING_ROOMS[mapState.current].dual) {
            // 🏛️ 雙BOSS祭壇：不逐格自動補怪（初次生成於 changeMap；單隻陣亡不補）。防呆：兩隻皆亡卻未標記全滅 → 補標，交由 settleDeadMobs 啟動 15 秒同時復活
            if(state._kbVictory !== true && !mapState.mobs.some(m => m && m.boss)) state._kbVictory = true;
        } else {
            let slotCount = backSlotsActive() ? 5 : 3;                          // 🆕 一般狩獵地圖開放後排兩格(3,4)→最多 5 隻；特殊版面維持 3 格
            for(let i=0; i<slotCount; i++) {
                if(mapState.mobs[i]) { mapState.spawnAt[i] = null; continue; } // 有怪：清除排程
                if(isPureBossMap && i !== 1) continue;                          // 純 BOSS 房只生中央
                let delay;
                if(isPureBossMap) {
                    delay = 1800;                                               // 🔧 純BOSS房：BOSS死亡後固定 3 分鐘(1800 tick=180秒)才刷新，不受日光術/席琳的世界加速影響
                } else if(KING_ROOMS[mapState.current]) {
                    delay = 50;                                                 // 🔧 軍王之室：固定 5 秒復活，不受日光術/席琳的世界加速影響
                } else {
                    delay = (player.buffs.sk_sunlight > 0) ? 10 : 50;          // 50 tick = 5 秒（日光術約 1 秒）
                    if (sherineWorldActive() && !isSiegeArea(mapState.current)) delay = Math.max(1, delay - 10);   // 🔮 席琳的世界：搜索時間 −1 秒（與日光術疊加）
                }
                if(mapState.spawnAt[i] == null) mapState.spawnAt[i] = nowT + delay; // 空格剛出現：排程 delay 後（一般 5 秒；純BOSS房 3 分鐘）
                if(nowT >= mapState.spawnAt[i]) { spawnMob(i); mapState.spawnAt[i] = null; }
            }
        }
    }
    
    // 🔧 slowAtk / cleave 的遞減已由上方 statuses 通用迴圈處理（先前此處第二次遞減導致持續時間減半：寒冰吐息 8 秒變 4 秒、切割 2 秒變 1 秒）
    if(canAct) {
        state.pDmgTick++;
        let aspdTicks = Math.max(1, Math.floor(player.d.aspd * 10));
        if(player.statuses && player.statuses.slowAtk > 0) aspdTicks *= 2;            // 攻擊速度減慢100%（間隔翻倍）
        if(state.pDmgTick >= aspdTicks) {
            playerAttack();
            state.pDmgTick = 0;
        }
    }
    
    for(let i=0; i<mapState.mobs.length; i++) {   // 🆕 含後排(3,4)：所有在場怪皆會行動攻擊
        let m = mapState.mobs[i];
        if(!m) continue;
        if(m._hasteTicks > 0) { m._hasteTicks--; if(m._hasteTicks <= 0 && m._baseAtkSpd !== undefined) { m.atkSpd = m._baseAtkSpd; m._baseAtkSpd = undefined; } }  // 自我加速到期恢復

        // --- 新增：被動怪物滿血時不主動攻擊 ---
        if (m.beh === '被動' && m.curHp === m.hp) continue;

        // --- 新增：處理被動怪物的 3 秒延遲 (30 ticks) ---
        if (m._delayTicks > 0) {
            m._delayTicks--;
            continue; // 延遲期間不扣減冷卻，跳過此回合行動
        }

        // --- 異常狀態處理（倒數、中毒 DoT），死亡則跳過 ---
        if (processMobStatusTick(m, i)) continue;
        // 常駐被動：HP 未滿 100% 時回復（依等級 15 / 40），不受異常狀態影響；間隔由 regenEvery 決定(預設10 ticks=每1秒)
        if (m.regenHp && state.ticks % (m.regenEvery || 10) === 0 && m.curHp > 0 && m.curHp < m.hp) {
            m.curHp = Math.min(m.hp, m.curHp + m.regenHp);
            if (!state.ff) renderMobs();
        }
        // 🔧 硬皮再生：每 10 秒(100 ticks)恢復 3% 最大硬皮值
        if (m.hardSkinMax > 0 && state.ticks % 100 === 0 && m.hardSkin < m.hardSkinMax) {
            m.hardSkin = Math.min(m.hardSkinMax, m.hardSkin + Math.max(1, Math.ceil(m.hardSkinMax * 0.03)));
        }
        // --- 冰凍 / 暈眩 / 石化 / 沉睡：無法行動 ---
        if (mobActDisabled(m)) continue;
        
        // --- 隱身術 / 隱身斗篷：非BOSS且滿血的怪物停止行動 (一旦受傷就會反擊) ---
        if(!m.boss && isInvisible() && m.curHp === m.hp) continue;
        
        // 👇 新增這行：無所遁形術限定「史巴托」滿血時停止行動 ---
        if(m.n === "史巴托" && (player.buffs.sk_reveal > 0 || player.buffs.sk_helm_str2 > 0) && m.curHp === m.hp) continue;

        // 野外＋血盟：傳送術（HP<20% 時，戰鬥中每 3 秒判定一次，10% 機率直接脫離戰鬥消失；不視為擊殺，玩家無經驗/金錢/掉落）
        if (m.wild && m.race === '血盟' && m.curHp > 0) {
            if (m.curHp < m.hp * 0.2) {
                if (m._tpCd === undefined) m._tpCd = 30;
                if (--m._tpCd <= 0) {
                    m._tpCd = 30;
                    if (Math.random() < 0.1) {
                        logCombat(`<span class="${getMobColor(m.lv)}">${m.n}</span> 施放 傳送術，脫離了戰鬥（未被擊殺，你沒有獲得經驗值、金錢與掉落物）。`, 'enemy');
                        mapState.mobs[i] = null;
                        if (mapState.spawnAt) mapState.spawnAt[i] = null;   // 該格交由出怪排程重生
                        if (mapState.targetIdx === i) mapState.targetIdx = -1;
                        if (!state.ff) renderMobs();
                        continue;
                    }
                }
            } else {
                m._tpCd = 30;   // HP 回到 20% 以上：重置判定計時
            }
        }

        if(m._atkCd === undefined) m._atkCd = Math.max(1, Math.floor(m.atkSpd * 10));
        m._atkCd--;
        // ... (下方保留原有的怪物攻擊與魔法邏輯)

        let slowAdd = (m.st && m.st.slow > 0) ? 10 : 0; // 緩速：攻擊間隔 +1 秒
        if(m._atkCd <= 0) {
            enemyPhysicalAttack(m, i);
            m._atkCd = Math.max(1, Math.floor(m.atkSpd * 10)) + slowAdd;
            m._bluntDelayed = false;   // 攻擊後重置鈍擊延遲標記，下一週期可再被延遲一次
        }

        if(player.dead) break;
        if(m.curHp <= 0) continue;   // 反擊使該怪在自己回合內死亡 → 跳過後續魔法施放
        if(m.st && (m.st.vacuum > 0 || m.st.magicseal > 0)) continue; // 真空 / 魔法封印：無法施放技能
        if(!m._magCd) m._magCd = {};
        ['mag','mag2','mag3'].forEach(mk => {
            if(!m[mk]) return;
            // 檢查發動機率
            if(m[mk].chance !== undefined) {
                 if(m._magCd[mk] === undefined) m._magCd[mk] = m[mk].cd;
                 m._magCd[mk]--;
                 if(m._magCd[mk] <= 0) {
                     m._magCd[mk] = m[mk].cd;
                     if(Math.random() <= m[mk].chance) {
                         if(!player.dead) applyMobMagic(m, m[mk]);
                     }
                 }
            } else {
                 if(m._magCd[mk] === undefined) m._magCd[mk] = m[mk].cd;
                 m._magCd[mk]--;
                 if(m._magCd[mk] <= 0) {
                     m._magCd[mk] = m[mk].cd;
                     if(!player.dead) applyMobMagic(m, m[mk]);
                 }
            }
        });
        if(player.dead) break;
    }

    if(!player.dead) { _combatSrc = 'summon'; summonTick(player.summon, () => { player.summon = null; }); summonTick(player.charmed, () => { player.charmed = null; }); if(player.cls === 'illusion') { cubeTick(); illuSummonTick(); } _combatSrc = 'mercenary'; alliesTick(); _combatSrc = null; }   // ⚔️ 召喚(含迷魅)/傭兵 戰鬥訊息來源情境；🔮 幻術士立方週期效果＋幻術精通幻象
    if(!player.dead) pledgeBlessTick();   // 生命的祝福：場上血盟怪物持續治療
    // 盟主祝福到期清理（每秒檢查；到期即移除並重算屬性）
    if(!player.dead && player.blessings && state.ticks % 10 === 0) {
        let _changed = false;
        for(let k in player.blessings) { if(player.blessings[k] > 0 && player.blessings[k] <= Date.now()) { player.blessings[k] = 0; _changed = true; } }
        if(_changed) { calcStats(); updateUI(); }
    }

    // HoT 持續回復（體力回復術 / 生命的祝福）
    if(player.hot && !player.dead) {
        if(--player.hot.cd <= 0) {
            player.hot.cd = player.hot.interval;
            let _spCoefHot = (1 + (3 * player.d.magicDmg / 16));
            let heal = player.hot.healDice
                ? Math.max(1, Math.floor((rollDice(player.hot.healDice[0], player.hot.healDice[1]) + (player.hot.healBase || 0)) * _spCoefHot))
                : Math.max(1, roll(player.hot.valDice[0], player.hot.valDice[1]) + player.d.magicDmg);
            player.hp = Math.min(player.mhp, player.hp + heal);   // 🔧 水之元氣不套用於持續回復(HoT)，僅瞬間治癒術
            player.hot.ticksLeft--;
            logCombat(`${player.hot.skName} 回復了 ${heal} 點 HP。${player.hot.msg || ''}`, 'heal');
            if(player.hot.ticksLeft <= 0) {
                player.hot = null;
                logCombat('持續回復效果結束。', 'heal');
            } else {
                updateUI();
            }
        }
    }
    // 🔧 誘捕倒數已併入 tick() 每秒區塊的統一 buff 遞減點

    // 夥伴攻擊判定 (每20 ticks = 2秒)：每個夥伴消耗 =項圈數量 的肉，造成 =項圈數量 次屬性傷害
    if (state.ticks % 20 === 0 && !player.dead && player.partners && player.partners.length > 0) {
        // 賣出/丟棄項圈：自動解除沒有對應項圈的夥伴
        player.partners = player.partners.filter(nm => {
            if (petCollarCount(nm) > 0) return true;
            logSys(`因為您丟棄或售出了項圈，夥伴【${nm}】已經離開了您。`);
            return false;
        });
        let target = getTarget();
        let cha = player.d.cha || 0;   // 誘捕夥伴：命中/傷害隨完整魅力提升（含超過60）；僅「項圈數量」另以60封頂
        let pg = petGearBonus();   // 🦴 寵物裝備：夥伴額外傷害/命中（影響所有項圈夥伴）
        if (target && target.curHp > 0 && player.partners.length > 0) {
            _combatSrc = 'pet';   // ⚔️ 夥伴(項圈犬類)戰鬥訊息來源情境
            player.partners.forEach(nm => {
                let pd = PET_DEF[nm]; if(!pd) return;
                let hits = petCollarCount(nm);
                for (let i = 0; i < hits; i++) {
                    if (target.curHp <= 0) break;
                    let meat = player.inv.find(it => it.id === 'new_item_143');
                    if (!meat || meat.cnt <= 0) break;   // 沒有肉就停止
                    meat.cnt--;
                    if (meat.cnt <= 0) player.inv = player.inv.filter(it => it.id !== 'new_item_143');
                    // 命中 = 玩家等級 + 魅力×hitChaMult + 偏移(+寵裝命中) - 怪物等級 + 怪物AC
                    let hv = Math.max(1, Math.min(20, player.lv + Math.floor(cha * ((pd.hitChaMult || 1) * (hasMastery('k_royal_pet') ? 1.2 : 1))) + pd.hitOff + pg.hit - target.lv + mobEffAC(target) + (hasSummonCtrlRing() ? 5 : 0)));   // 🔧 召喚控制戒指：召喚物命中+5；👑 夥伴精通：魅力命中係數×1.2
                    let r = roll(1, 20);
                    if (r === 20 || (r !== 1 && hv >= r) || (r === 19 && hasSummonCtrlRing())) {
                        let dmg = Math.max(1, roll(1, Math.max(1, player.lv + pd.diceOff)) + Math.floor(cha * ((pd.chaMult || 1) * (hasMastery('k_royal_pet') ? 1.2 : 1))) + pg.dmg - (target.dr || 0));   // 👑 夥伴精通：魅力傷害係數×1.2
                        target.curHp -= dmg; target.justHit = pd.ele; mobWake(target);
                        logCombat(`夥伴 [${nm}] 撕咬 <span class="${getMobColor(target.lv)}">${target.n}</span>，造成 ${dmg} 點${pd.eleName}屬性傷害！`, 'player-special');
                    } else {
                        logCombat(`夥伴 [${nm}] 的攻擊未命中。`, 'miss');
                    }
                    // 🐾 進化夥伴：攻擊時 10% 觸發 proc 法術（傷害＝玩家自身施法數值；必定命中、吃魔抗）
                    // 🔧 依技能 target:"all" → 對全場敵人各自結算（各吃自身魔抗/DR）；單體技能僅打當前目標
                    if (pd.proc && target.curHp > 0 && Math.random() < 0.10) {
                        let _ps = DB.skills[pd.proc];
                        if (_ps) {
                            let _pts = (_ps.target === 'all') ? mapState.mobs.filter(m => m && m.curHp > 0) : [target];
                            let _ptexts = [];
                            _pts.forEach(_pm => {
                                let _pdmg = petProcSpellDamage(pd.proc, _pm);
                                if (_pdmg > 0) {
                                    _pm.curHp -= _pdmg; _pm.justHit = _ps.ele || pd.ele; mobWake(_pm);
                                    _ptexts.push(`<span class="${getMobColor(_pm.lv)}">${_pm.n}</span> ${_pdmg}`);
                                }
                            });
                            if (_ptexts.length) logCombat(`夥伴 [${nm}] 額外施展 <span class="text-pink-300 font-bold">${_ps.n}</span> → ${_ptexts.join('、')}`, 'player-special');
                            _pts.forEach(_pm => { if (_pm.curHp <= 0) { let _ri = mapState.mobs.findIndex(m => m && m.uid === _pm.uid); if (_ri !== -1) killMob(_ri); } });
                        }
                    }
                }
            });
            let idx = mapState.mobs.findIndex(m => m && m.uid === target.uid);
            if (target.curHp <= 0 && idx !== -1) killMob(idx);
            else renderMobs();
            renderTabs();   // 肉數量變動需刷新
            _combatSrc = null;   // ⚔️ 結束夥伴來源情境
        }
    }
}

// 體能激發/能量激發：負重狀態下仍可自然恢復 HP、MP（身上任一 loadFreeRegen 增益生效即放行）
function hasLoadFreeRegen() {
    if(!player.buffs) return false;
    for(let _sid in player.buffs) {
        if(player.buffs[_sid] > 0 && DB.skills[_sid] && DB.skills[_sid].loadFreeRegen) return true;
    }
    return false;
}

function regenTick() {
    if(!state.running || player.dead) return;
    let _loadFreeRegen = hasLoadFreeRegen();

    // --- HP 恢復 ---
    if(player.hp < player.mhp && !(player.buffs.sk_berserk > 0) && (_loadFreeRegen || (player.d.loadTier||0) < 1)) {
        let baseHpRegen = player.d.hpRegenMax > 0 ? roll(1, player.d.hpRegenMax) : 0;
        // 使用 Number() 強制轉換為數字，避免 10 + '1' = 101 的字串相加 Bug
        let totalHpRegen = Number(baseHpRegen) + Number(player.d.hpR || 0);
        if (totalHpRegen > 0) {
            player.hp = Math.min(player.mhp, player.hp + totalHpRegen);
        }
    }
    
    // --- MP 恢復 ---
    if(player.mp < player.mmp && (_loadFreeRegen || (player.d.loadTier||0) < 1)) {
        // 同樣加上 Number() 保護
        let totalMpRegen = Number(player.d.mpR || 0);
        if (totalMpRegen > 0) {
            player.mp = Math.min(player.mmp, player.mp + totalMpRegen);
        }
    }

    // 🔧 架構統一：buff 倒數已移至 tick() 的每秒區塊（單一遞減點）。regenTick 現在只負責 HP/MP 恢復與 UI 刷新。
    // 👈 這行是血條與魔條實際上會不會動的關鍵！
    updateUI();
}

// 純BOSS房（不會出現一般怪與血盟特殊敵人）
// 🔧 軍王之室（三格控制型BOSS房）：中央固定BOSS、兩側固定指定小怪；需軍王的鑰匙入場、無傳送/日光、小怪不掉落、擊敗BOSS傳送回村
const KING_ROOMS = {
    king_baranka_room:  { boss: 'de_king_baranka', minion: 'de_train_hellhound', name: '魔獸軍王之室' },
    law_king_room:      { boss: 'de_king_laia',    minion: 'de_lab_mage',        name: '法令軍王之室' },
    necro_king_room:    { boss: 'de_king_heruby',  minion: 'de_necro_warlock',   name: '冥法軍王之室' },
    assassin_king_room: { boss: 'de_king_slayer',  minion: 'de_gate_soldier',    name: '暗殺軍王之室' },
    // 🏛️ 底比斯歐西里斯祭壇：雙BOSS（賀洛斯＋阿努比斯），兩隻皆亡後 15 秒同時復活；入場與再臨各消耗 1 把祭壇鑰匙
    thebes_temple:      { dual: true, bosses: ['thebes_horus', 'thebes_anubis'], key: 'item_thebes_altar_key', name: '底比斯歐西里斯祭壇' }
};
const PURE_BOSS_MAPS = ['antaras_lair', 'fafurion_lair', 'valakas_lair', 'king_baranka_room', 'law_king_room', 'necro_king_room', 'assassin_king_room', 'thebes_temple'];
const BOSS_BIG_MAPS = ['antaras_lair', 'fafurion_lair', 'valakas_lair'];   // 👑 方案B放大版面只套用這3個龍窟(不含底比斯祭壇等其餘純BOSS房)

// 🆕 後排雙格：一般狩獵地圖在原本三格(前排)之外，再追加兩格「後排」小怪→場上最多同時 5 隻。
//    後排(idx 3,4)只出一般怪、不出頭目；純BOSS房/軍王之室/攻城/時空裂痕維持三格不變(避免改動其專屬版面與平衡)。
function backSlotsActive() {
    return !PURE_BOSS_MAPS.includes(mapState.current)
        && !KING_ROOMS[mapState.current]
        && mapState.current !== 'rift_battle'
        && !isSiegeArea(mapState.current);
}

// 血盟敵人：等級與能力隨玩家等級縮放，於生成當下依各自的 scale 參數計算
function applySiegeEnemyScaling(mob) {
    let L = Math.max(1, player.lv);
    let s = mob.siege || {};
    if (s.fixed) {                                  // 攻城塔/城門：HP 固定值或依玩家等級（hpPerLv），其餘屬性不成長
        mob.lv = 1;
        mob.hp = s.hpPerLv ? s.hpPerLv * L : s.hp; mob.curHp = mob.hp;   // 🔧 守護塔 500×等級、城門 300×等級
        mob.ac = s.ac; mob.mr = s.mr;
        mob.exp = 0; mob.goldMin = 0; mob.goldMax = 0;
        if (s.dr) mob.dr = s.dr;
        return;
    }
    mob.lv = L;
    mob.hp = (s.hpC || 10) * L; mob.curHp = mob.hp;
    mob.ac = (s.acBase !== undefined ? s.acBase : -10) - Math.floor(L / (s.acDiv || 4));
    mob.mr = (s.mrBase || 0) + Math.floor(L / (s.mrDiv || 5));
    mob.exp = 30 * L;                               // 攻城怪經驗：30×玩家等級
    mob.goldMin = 0; mob.goldMax = 0;               // 攻城怪不掉金幣
    mob.dmg = [1, s.dmgSides || 10];
    mob.db = s.dbHalf ? Math.floor(L / 2) : L;      // 傷害加成：+(玩家等級)；dbHalf 為 +(玩家等級/2)
    mob.hit = (s.hitBase || 0) + Math.floor(L / 2); // 額外命中：基底 +(玩家等級/2)
    mob.atkSpd = s.atkSpd || 0.67;
    // 常駐被動回復(每2秒)：1~49 → 40HP；50~100 → 60HP
    mob.regenHp = (L >= 50) ? 60 : 40;
    mob.regenEvery = 20;
    if (s.er) mob.er = s.er;
}

function applyPledgeEnemyScaling(mob) {
    let L = Math.max(1, player.lv);
    let s = mob.scale || {};
    mob.lv = L;
    mob.hp = (s.hpC || 20) * L;
    mob.curHp = mob.hp;
    mob.ac = (s.acBase !== undefined ? s.acBase : -10) - Math.floor(L / (s.acDiv || 2));
    mob.mr = (s.mrBase || 0) + Math.floor(L / (s.mrDiv || 10));
    mob.exp = 0;        // 🔧 血盟敵人：經驗值設為 0
    mob.goldMin = 0;    // 🔧 血盟敵人：金錢設為 0
    mob.goldMax = 0;
    mob.dmg = [1, s.dmgSides || 10];
    mob.db = s.dbHalf ? Math.floor(L / 2) : L;   // 一般攻擊傷害加成：+(玩家等級)；喬/賽尼斯(dbHalf) 為 +(玩家等級/2)
    mob.hit = (s.hitBase || 0) + Math.floor(L / 2);      // 額外命中：基底 +(玩家等級/2)
    mob.atkSpd = s.atkSpd || 0.67;
    mob.regenHp = (L >= 50) ? 40 : 15;            // 常駐被動：HP 未滿時的回復量
    mob.regenEvery = (L >= 50) ? 20 : 10;        // 50~100：每2秒回40；50以下：每1秒回15
}

// 生命的祝福：每 tick 推進；達到間隔時為場上所有血盟怪物（HP 未滿）回復，持續期滿自動結束
function pledgeBlessTick() {
    let pb = mapState.pledgeBless;
    if(!pb) return;
    pb.left--;
    pb.nextIn--;
    if(pb.nextIn <= 0) {
        pb.nextIn = pb.interval;
        let healed = false;
        mapState.mobs.forEach(m => {
            if(m && m.race === '血盟' && m.curHp > 0 && m.curHp < m.hp) {
                m.curHp = Math.min(m.hp, m.curHp + roll(pb.dice[0], pb.dice[1]) + pb.bonus);
                healed = true;
            }
        });
        if(healed && !state.ff) renderMobs();
    }
    if(pb.left <= 0) mapState.pledgeBless = null;
}

function spawnMob(idx) {
    if (mapState.current === 'rift_battle') { spawnRiftMob(idx); return; }   // 🌀 時空裂痕：自訂動態出怪（不靠 DB.maps）
    let pool = DB.maps[mapState.current];
    if(!pool) return;
    // 🔧 軍王之室：中央(1)固定 BOSS、兩側(0/2)固定指定小怪（不走一般出怪/席琳強化/追蹤邏輯）
    if(KING_ROOMS[mapState.current]) {
        let _kr = KING_ROOMS[mapState.current];
        let _id;
        if(_kr.dual) { _id = _kr.bosses[idx]; if(!_id) { mapState.mobs[idx] = null; return; } }   // 🏛️ 雙BOSS祭壇：0,1 兩格各一隻BOSS（第三格留空）
        else _id = (idx === 1) ? _kr.boss : _kr.minion;
        let _b = DB.mobs[_id]; if(!_b) return;
        mapState.mobs[idx] = { ..._b, curHp: _b.hp, uid: uid(), _magCd: {}, justHit: false, st: newMobStatus() };
        if(mapState.mobs[idx].hard) initHardSkin(mapState.mobs[idx]);
        return;
    }
    // 🆕 2026-06：後排格(3,4)現在也會 roll 頭目——原本後排不出王，但死亡輸送帶把存活怪往前壓實、空格往後堆→補位幾乎都落在後排、跳過頭目判定而稀釋出王率；故 wantBoss/卡瑞/林德拜爾改成全 5 格皆判定（idx>=3 不再排除頭目）
    let bossInBattle = mapState.mobs.some(m => m && m.boss);
    let bossPool = pool.filter(id => DB.mobs[id] && DB.mobs[id].boss);
    let normalPool = pool.filter(id => DB.mobs[id] && !DB.mobs[id].boss);
    // 攻城區：玩家不會遭遇自己陣營的盟主（特羅斯陣營不遇特羅斯王子；依詩蒂陣營不遇依詩蒂公主）
    if (isSiegeArea(mapState.current)) {
        if (player.bloodPledge === 'tros') normalPool = normalPool.filter(id => id !== 'siege_tros');
        else if (player.bloodPledge === 'esti') normalPool = normalPool.filter(id => id !== 'siege_esti');
    }
    
    let mobId;
    let siegeArea = isSiegeArea(mapState.current);
    let allowMultiBoss = backSlotsActive();   // 🆕 5格地圖：5格(0~4)皆可同時出現多隻頭目（不再受 bossInBattle 限制·後排也會出王·同名仍限1隻）；攻城等3格版面維持單頭目
    // 🏛️ 長老之室 BOSS 節流：場上最多同時 2 隻長老 BOSS；已有 1 隻時須該 BOSS 存活滿 3 分鐘才可能出現第 2 隻
    let _elderRoom = mapState.current === 'elder_room';
    let _elderBossOk = true;
    if (_elderRoom) {
        let _ab = mapState.mobs.filter(m => m && m.boss && m.curHp > 0 && !m._dead);
        if (_ab.length >= 2) _elderBossOk = false;
        else if (_ab.length === 1) _elderBossOk = (Date.now() - (_ab[0]._bornMs || Date.now())) >= 180000;
    }
    let wantBoss = (allowMultiBoss || !bossInBattle) && bossPool.length > 0 && (!_elderRoom || _elderBossOk) && (mapState.forceBoss || (siegeArea ? (!mapState.suppressSiegeBoss && Math.random() < 0.10) : (_elderRoom ? Math.random() < 0.05 : Math.random() < 0.01)));
    if(mapState.forceBoss) mapState.forceBoss = false;   // 強制旗標只作用於下一次生怪
    if(wantBoss) {
        // 🔧 同名BOSS限制：場上已有同名BOSS時不再抽到該名→需地圖池有 2 種以上「不同名」BOSS 才可能同時出現多隻；若無不同名可出則退回一般怪
        let _onFieldBoss = mapState.mobs.filter(m => m && m.boss).map(m => m.n);
        let _bossPick = bossPool.filter(id => !_onFieldBoss.includes(DB.mobs[id].n));
        if (_bossPick.length > 0) mobId = _bossPick[Math.floor(Math.random() * _bossPick.length)];
        else wantBoss = false;
    }
    if(!wantBoss) {
        let safePool = normalPool.length > 0 ? normalPool : pool;
        if (siegeArea) {   // 攻城區：避免場上同時出現兩名以上同名敵人
            let onFieldNames = mapState.mobs.filter(m => m).map(m => m.n);
            let uniquePool = safePool.filter(id => DB.mobs[id] && !onFieldNames.includes(DB.mobs[id].n));
            if (uniquePool.length > 0) safePool = uniquePool;
        }
        mobId = safePool[Math.floor(Math.random() * safePool.length)];
        // 血盟特殊敵人：已加入任一血盟陣營者，於非BOSS房狩獵地區有 0.3% 機率遇到敵對血盟。
        // 兩陣營遇到的敵人相同；排除「與自己性別職業對應」的血盟敵人；依詩蒂陣營玩家不論職業都不會遇到依詩蒂本人。
        // 從符合條件者中平均抽一隻；場上可同時有多隻不同名的血盟敵人，但不會有同名兩隻。
        if(player.bloodPledge && !PURE_BOSS_MAPS.includes(mapState.current) && !isSiegeArea(mapState.current) && Math.random() < 0.003) {
            let onField = mapState.mobs.filter(m => m).map(m => m.n);
            let candidates = Object.keys(DB.mobs).filter(id => {
                let d = DB.mobs[id];
                if(!d.pledgeEnemy) return false;
                if(d.excludeAvatar === player.avatar) return false;                 // 不遇到與自己性別職業對應者
                if(player.bloodPledge === 'esti' && id === 'esti_enemy') return false; // 依詩蒂陣營玩家不會遇到依詩蒂
                return !onField.includes(d.n);
            });
            if(candidates.length > 0) mobId = candidates[Math.floor(Math.random() * candidates.length)];
        }
    }
    
    // 魔物追蹤：在追蹤地圖且追蹤有效期間，每次出怪 50% 固定機率改為被追蹤的怪物
    if(player.tracking && player.tracking.until > Date.now() && player.tracking.map === mapState.current
       && DB.maps[mapState.current] && DB.maps[mapState.current].includes(player.tracking.mob)
       && DB.mobs[player.tracking.mob] && !DB.mobs[player.tracking.mob].boss && Math.random() < 0.5) {
        mobId = player.tracking.mob;
    }
    // 🔧 卡瑞（BOSS）：身上「同時」攜帶 飛龍的爪子/蜥蜴的角/水晶球/妖魔戰士護身符 時，
    //    於龍之谷地監6樓 1% 機率出現（場上無其他 BOSS 時才出現，且同時最多一隻）
    if (mapState.current === 'zone_31'
        && !bossInBattle
        && !mapState.mobs.some(m => m && m.n === '卡瑞')
        && ['item_dragon_claw', 'item_lizard_horn', 'item_crystal_ball', 'item_orc_amulet'].every(q => player.inv.some(i => i.id === q && i.cnt > 0))
        && Math.random() < 0.01) {
        mobId = 'kari';
    }
    // 🔥 50級試煉：大洞穴隱遁者村莊地區 1% 出現「魔族暗殺團」（妖精 stage2 收集密封情報書／法師 stage1 收集間諜報告書）
    if (mapState.current === 'hidden_cave' && !mapState.mobs.some(m => m && m.n === '魔族暗殺團')
        && ((player.cls === 'elf' && player.trialStage === 2 && !player.inv.some(i => i.id === 'item_sealed_intel'))
            || (player.cls === 'mage' && player.trialStage === 1 && !player.inv.some(i => i.id === 'item_spy_report')))
        && Math.random() < 0.01) {
        mobId = 'demon_assassin';
    }
    // 🐉 林德拜爾（BOSS）：持有「幼龍蛋」於任一野外地圖時，1% 機率改為刷出林德拜爾
    //    （場上無其他 BOSS 時才出現、同時最多一隻；賣掉幼龍蛋即不再遭遇）
    if (!bossInBattle
        && MAP_CATEGORIES.wild.some(m => m.v === mapState.current)
        && !mapState.mobs.some(m => m && m.n === '林德拜爾')
        && player.inv.some(i => i.id === 'item_dragon_egg' && i.cnt > 0)
        && Math.random() < 0.01) {
        mobId = 'lindvior';
    }
    let base = DB.mobs[mobId];
    if(!base) return;
    mapState.mobs[idx] = { ...base, curHp: base.hp, uid: uid(), _magCd: {}, justHit: false, st: newMobStatus(), _bornMs: Date.now() };   // 🏛️ _bornMs：生成時間（長老之室 BOSS 3 分鐘節流用）
    // 弓：場上原本沒有任何敵人時，第一個出現的敵人不論主動/被動，都強制視為被動（搭配弓攻擊3秒延遲，可先手放風箏）
    if(!base.boss && player.eq.wpn && DB.items[player.eq.wpn.id] && DB.items[player.eq.wpn.id].isBow && !mapState.mobs.some((m, j) => m && j !== idx)) {
        mapState.mobs[idx].beh = '被動';   // 頭目除外，維持主動
    }
    if(base.pledgeEnemy) applyPledgeEnemyScaling(mapState.mobs[idx]);   // 血盟敵人：依玩家等級縮放
    if(base.siegeEnemy) applySiegeEnemyScaling(mapState.mobs[idx]);   // 攻城敵人：依玩家等級縮放
    applySherineBuff(idx);   // 🔮 席琳的世界強化＋_sherine（與時空裂痕共用 applySherineBuff）
    if(mapState.mobs[idx].hard) initHardSkin(mapState.mobs[idx]);   // 🔧 硬皮：依等級/頭目/席琳世界初始化硬皮值（須在席琳 _sherine 標記之後）
    // 🔧 攻城城門/守護塔 HP 跨地圖保留（兩座城共用 gateHp/towerHp，依當前攻城城池的城門/塔名稱判定）
    if(base.siegeEnemy && player.siege) {
        let _sc = siegeCityCfg();
        if(base.n === _sc.gate && player.siege.gateHp > 0) mapState.mobs[idx].curHp = Math.min(mapState.mobs[idx].hp, player.siege.gateHp);
        if(base.n === _sc.tower && player.siege.towerHp > 0) mapState.mobs[idx].curHp = Math.min(mapState.mobs[idx].hp, player.siege.towerHp);
    }

    applySherineGrace(idx);   // 🔮 席琳的恩賜：1% 機率場上一隻一般怪變恩賜怪（與時空裂痕共用 applySherineGrace）
    renderMobs();
}

function getMobColor(mobLv) {
    return "mc-mobname";   // 🔧 戰鬥日誌怪名＝淡金色（2026-06）：怪卡名已統一白色(getMobNameClass 直接回白)，日誌怪名改金色以與其他白色訊息區隔；getMobColor 主要供 logCombat 怪名 span 使用
}

// 怪物名稱顯示用 class：血盟＝固定鮮紅+紅色醒目特效（不受等差影響）；頭目＝保留等差顏色+金色專屬特效
function getMobNameClass(m) {
    // 👑 頭目(含血盟頭目)名稱固定鮮紅(mob-name-boss·紅色由 CSS 設定)；其餘(含血盟一般怪)維持白色
    if (m && m.boss) return 'mc-white font-bold mob-name-boss';
    return 'mc-white font-bold';
}

function getTarget() {
    let t = mapState.mobs[mapState.targetIdx];
    if (t && t._dead) t = null;   // 🔧 架構#2：已死亡待清算的怪不可作為目標
    // 當前目標不存在（如剛開局或剛擊殺）時，依照「中央(1) -> 左邊(0) -> 右邊(2)」順序鎖定第一個活著的敵人
    if(!t) {
        let priorityOrder = [1, 0, 2, 3, 4];   // 🆕 前排(中1→左0→右2)優先，其次後排(3,4)；後排為 undefined 時自動略過
        for(let i of priorityOrder) {
            if(mapState.mobs[i] && !mapState.mobs[i]._dead) {
                setTarget(i);
                return mapState.mobs[i];
            }
        }
    }
    return t;
}

function setTarget(idx) {
    mapState.targetIdx = idx;
    renderMobs();
}

// ===== 物理傷害與命中核心計算（遠近距離拆分）=====
// 近距離武器：依 力量(近距離傷害/命中/爆擊)；遠距離武器：依 敏捷(遠距離傷害/命中/爆擊)
// 命中判定值重塑：rawHitValue >= 8(約 40% 命中)以上維持原樣；低於此不再急墜到地板，
// 而是把「剩下到地板(hitValue=1)的命中差」用遞減方式分配到接下來 30 點 AC，逐步逼近地板，
// 保留 5% 必中(nat20)＋5% 擦傷(nat19，僅玩家打怪)的命中地板。小數判定值以隨機進位實現期望值。
function stretchHitValue(raw) {
    let hv;
    if (raw >= 8) hv = Math.min(20, raw);
    else {
        let e = Math.min(30, 8 - raw);      // 超出「40% 命中點」的 AC 量 (0~30)
        let frac = e / 30;                  // 0~1
        let h = 2 * frac - frac * frac;     // 凹函數：前段增量大、後段小 → 遞減分配
        hv = 8 - 7 * h;                     // 由 8 遞減到 1（可為小數）
    }
    let lo = Math.floor(hv);
    let hvInt = lo + ((Math.random() < (hv - lo)) ? 1 : 0);
    return Math.max(1, Math.min(20, hvInt));
}
function getPhysicalDmg(diceStr, target, wpn, arrowData, forceHeavy, forceHit, forceLand, forceCrit, wpnInst) {
    let isRanged = !!(wpn && wpn.ranged);
    let hitBonus = (isRanged ? player.d.rangedHit : player.d.meleeHit) + player.d.extraHit + (player._skillHitBonus || 0);   // 🗼 范德之劍：施展衝擊之暈時本次技能近距離命中+1（由 castSkill 設置/重置）
    let dmgBonus = (isRanged ? player.d.rangedDmg : player.d.meleeDmg);
    let critRate = isRanged ? player.d.rangedCrit : player.d.meleeCrit;
    let critDmg  = isRanged ? player.d.rangedCritDmg : player.d.meleeCritDmg;

    // 命中判定 = 投擲一顆20面骰，骰到1必定未命中，骰到20為重擊，2~19 則 命中值 >= 判定即命中
    let rawHitValue = player.lv + hitBonus - target.lv + mobEffAC(target);
    let hitValue = stretchHitValue(rawHitValue);
    if (player.buffs && player.buffs.sk_warrior_outlaw > 0) hitValue = Math.max(hitValue, 10);   // ⚔️ 亡命之徒：一般攻擊最低命中率 50%

    // 🔧 重擊特效武器（雙手鈍器）：骰 19 一律觸發重擊（粉碎），不論本應為擦傷/命中/未命中 → 重擊率 5%→10%
    let _cw = player.eq.wpn && DB.items[player.eq.wpn.id];
    let isCrush = !!(_cw && _cw.eff === 'crush');
    let rollHit = roll(1, 20);
    let hit = false, heavy = false, graze = false, crush = false;
    if (forceHeavy) { hit = true; heavy = true; }   // 魔擊：必定命中且必定重擊
    else if (forceHit) { hit = true; }   // 反擊：必定命中、必定非重擊
    else if (forceLand) { hit = true; if (rollHit === 20) heavy = true; }   // 居合：必定命中，rollHit20 仍自然重擊；不擦傷
    else if (rollHit === 20) { hit = true; heavy = true; }
    else if (isCrush && rollHit === 19) { hit = true; heavy = true; crush = true; }   // 重擊武器：骰19必定重擊（粉碎）
    else if (player.buffs && player.buffs.sk_elf_preciseshot > 0 && rollHit === 1) hit = true;   // 🏹 精準射擊：擲骰1由必定未命中→必定命中（最高命中率可達100%）
    else if (rollHit !== 1 && hitValue >= rollHit) hit = true;
    else if (rollHit === 19) { hit = true; graze = true; }   // 一般武器：擲到19本應未命中時 → 擦傷（傷害剩50%）
    if(!hit) return { dmg: 0, hit: false, heavy: false, crit: false, graze: false, crush: false, ranged: isRanged };

    // 爆擊判定（依遠/近距離爆擊率；🔧 迴避精通：forceCrit 必定爆擊）
    let isCrit = !!forceCrit || (Math.random() * 100 < critRate);
    if (graze) isCrit = false;   // 擦傷不會爆擊
    if (target) { if (isCrit) target._vfxBig = 'crit'; else if (heavy) target._vfxBig = 'heavy'; }   // ✨ VFX：玩家物理命中→爆擊大紅／重擊大金（唯一樞紐 getPhysicalDmg，涵蓋連射/連擊/雙擊/穿透/魔擊/反擊/居合）
    let critMult = isCrit ? (1 + critDmg / 100) : 1;  // 爆擊係數 = 1 + 爆擊傷害%

    // 武器傷害（重擊必定取最大值；🔧 烈焰之魂：持續內近距離一般攻擊武器擲骰必定最大值）
    let _flameSoulMax = (!isRanged && player.buffs && player.buffs.sk_elf_flamesoul > 0);
    let weaponRoll = (heavy || _flameSoulMax) ? diceStr : roll(1, diceStr);

    // [（遠/近距離傷害 x 爆擊係數） + 額外傷害 - 敵人傷害減免]，計算過程最低為1
    let nearFar = weaponRoll + dmgBonus;
    let _ignHard = !!(_cw && _cw.ignHardSkin);   // 🗡️ 貫穿（暗黑十字弓）：攻擊無視硬皮額外減傷（主攻擊與連射皆走本函式 → 一併涵蓋）
    let inner = Math.floor(nearFar * critMult) + player.d.extraDmg - ((target.dr || 0) + (_ignHard ? 0 : mobHardSkin(target)) + ((target._siegeDrEnd > state.ticks) ? (target._siegeDrVal || 0) : 0));   // 堅固防護：怪物傷害減免；🔧 硬皮：額外物理減傷（貫穿時不扣）
    inner = Math.max(1, inner);

    // 固定傷害（屬性/特效，於最低1之後加上）
    let fixed = 0;

    // 0. 屬性詞綴：固定傷害 +1/+3/+5，並對剋屬性怪物額外 +6/+9/+12 固定傷害
    let _attrInst = (wpnInst && wpnInst.attr) ? wpnInst : player.eq.wpn;   // ⚔️ 指定揮擊武器（副手＝offwpn）自身有屬性詞綴則用其屬性，否則沿用主武器（純加成、不減損既有行為）
    let _wAff = getAttrAffix(_attrInst && _attrInst.attr);
    if (_wAff) {
        fixed += _wAff.fix;
        if (isElementCounter(_wAff.ele, target.e)) fixed += _wAff.counter;
    }
    
    // 先判定武器/箭矢本身是否帶「對不死/狼人」加成 (unBonus)
    let hasUnBonus = false;
    // 檢查箭矢 (例如銀箭、米索莉箭)
    if (arrowData && (arrowData.unBonus || arrowData.unDice)) hasUnBonus = true;
    // 檢查近戰武器 (例如銀斧、精靈短劍)
    if (wpn && !arrowData && (wpn.unBonus || wpn.unDice || wpn.sp === 'elf')) hasUnBonus = true;

    // 1. 武器本身的 unBonus 優先：對「不死」或「狼人」+1D20
    if (hasUnBonus && (target.un || target.isWolf)) {
        fixed += roll(1, 20);
    }
    // 2. 神聖武器(魔法)：僅在武器本身「沒有」unBonus 時才生效，且只對「不死」+1D20（狼人無效）。
    //    與武器 unBonus 互斥，不會疊加。
    else if (player.buffs.sk_holy_wpn > 0 && target.un) {
        fixed += roll(1, 20);
    }

    let _outDmg = inner + fixed;
    if (graze) _outDmg = Math.max(1, Math.floor(_outDmg * 0.5));   // 擦傷：最終傷害剩 50%
    _outDmg = Math.max(1, Math.floor(_outDmg * fragileMult(target)));   // 🔮 脆弱（白鳥5）：受所有來源傷害 +20%
    _outDmg = Math.max(1, Math.floor(_outDmg * wpnEnFinalMult(player.eq.wpn)));   // 🔧 武器強化 +11~+20：最終傷害倍率（×1.1~×2.0，取該階段值）
    if (_cw && _cw.finalMult) _outDmg = Math.max(1, Math.floor(_outDmg * _cw.finalMult));   // 🏛️ 武器最終傷害倍率（古老武器 ×1.5）
    if (player._setRedLion5) _outDmg = Math.max(1, Math.floor(_outDmg * 1.2));   // 🔮 紅獅 5/5：最終傷害 +20%（普攻及所有走本函式的物理攻擊：反擊/居合/看破/連擊/連射/穿透/魔擊/物理技能）
    if (heavy && player.mastery === 'k_cleave' && _cw && _cw.eff === 'cleave') _outDmg = Math.max(1, Math.floor(_outDmg * 1.5));   // 🏅 切割精通：觸發重擊時傷害 ×1.5
    return { dmg: _outDmg, hit: true, heavy: heavy, crit: isCrit, graze: graze, crush: crush, ranged: isRanged };
}

function consumeArrow() {
    if (!player.eq.arrow || player.eq.arrow.cnt <= 0) {
        // 1. 嘗試從背包尋找任何箭矢自動裝上
        let invArrow = player.inv.find(i => DB.items[i.id] && DB.items[i.id].isArrow);
        if (invArrow) {
            equipItem(invArrow);
            logSys(`自動裝備了 ${DB.items[invArrow.id].n}。`);
        } else {
            // 2. 背包也沒箭，檢查是否開啟自動購買
            let autoBuyCheckbox = document.getElementById('set-auto-buy-arrow');
            if (autoBuyCheckbox && autoBuyCheckbox.checked) {
                let cost = shopPrice(200); // 1000 銀箭，5 銀箭 = 1 金幣 → 200 金幣（攻城獲勝 8 折亦適用）
                if (player.gold >= cost) {
                    player.gold -= cost;
                    gainItem('wpn_22', 1000, true, true);
                    logSys(`自動花費 ${cost} 金幣購買了 1000 銀箭。`);
                    let freshArrow = player.inv.find(i => i.id === 'wpn_22');
                    if (freshArrow) equipItem(freshArrow);
                } else {
                    logCombat(`沒有箭矢，且金幣不足無法自動購買！`, 'miss');
                    return null;
                }
            } else {
                logCombat(`沒有箭矢，無法進行攻擊！`, 'miss');
                return null;
            }
        }
    }
    
    // 扣除 1 根箭，並回傳箭矢資料提供傷害判定
    let arrowId = player.eq.arrow.id;
    if (arrowId !== 'wpn_shaha_arrow') {   // 🏝️ 沙哈之箭：彈藥無限，不扣減
        player.eq.arrow.cnt--;
        if (player.eq.arrow.cnt <= 0) {
            player.eq.arrow = null; // 耗盡時清空欄位
        }
    }
    renderTabs(); // 👈 移到 if 判斷式外面，每次攻擊扣箭後都會即時刷新畫面！
    return DB.items[arrowId];
}

// ===== 法杖共鳴：裝備指定魔法杖時，一般攻擊(不論命中與否)有 智力/60 機率免費施展光箭 =====
const WAND_LIGHTARROW_IDS = ['wpn_oakwand', 'wpn_38', 'wpn_witchwand', 'wpn_manawand', 'wpn_crystalwand', 'wpn_baless', 'wpn_wand_rasta', 'wpn_red_crystalwand', 'wpn_laia_wand', 'wpn_icequeen_wand', 'wpn_demon_scythe', 'wpn_darkmage_wand', 'wpn_baphomet_wand', 'wpn_illu_wand', 'wpn_demon_wand_hidden', 'wpn_dark_crystalball'];   // 🔮 幻術士魔杖：共鳴（👹 隱藏的魔族魔杖亦共鳴；🏴‍☠️ 漆黑水晶球亦共鳴）   // 🏅 共鳴：含蕾雅魔杖／冰之女王魔杖／惡魔鐮刀／黑法師之杖／🔧巴風特魔杖（👑惡魔王魔杖已改為魔爆 eff:magicburst）
function wandLightArrowProc(target) {
    if (player.classicMode) return;   // 🎮 經典模式：停用共鳴
    let wpn = player.eq.wpn;
    if (!wpn || !WAND_LIGHTARROW_IDS.includes(wpn.id)) return;
    if (Math.random() >= ((player.d.int || 0) / 60)) return;   // 觸發機率 = 裝備者智力 / 60
    // 選定光箭目標：主目標仍存活則優先；若主目標已被普攻擊殺，改打場上隨機一隻存活的怪；全部清空則作罷
    let t = (target && target.curHp > 0) ? target : null;
    if (!t) {
        let alive = mapState.mobs.filter(m => m && m.curHp > 0);
        if (alive.length === 0) return;
        t = alive[Math.floor(Math.random() * alive.length)];
    }
    procLightArrow(t);
}
// 光箭傷害：與 castSkill 單體魔法完全相同的公式(魔法/無屬性/tier1/dmgDice[1,6])，但不耗魔力、不吃冷卻
function procLightArrow(t) {
    let sk = DB.skills['sk_lightarrow'];
    if (!sk || !t || t.curHp <= 0) return;
    let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    let mrFactor = hasMastery('m_resonance') ? 1 : mrMult(effMr);   // 🏅 共鳴精通：光箭無視魔抗
    let isCrit = Math.random() * 100 < player.d.magicCrit;
    let skillTier = sk.tier || 1;
    let spCoef = (1 + (3 * player.d.magicDmg / 16)) * (1 + (skillTier / 3));
    let mageDmgMult = (player.cls === 'mage') ? (1.5 + skillTier / 20) : 1.0;   // 與一般攻擊魔法一致
    let magicCritMult = isCrit ? (1 + player.d.magicCritDmg / 100) : 1.0;
    let baseMagicDmg = roll(sk.dmgDice[0], sk.dmgDice[1]);
    let core = baseMagicDmg * spCoef * magicCritMult;
    let extraMagicDmg = (sk.dmgBase || 0) + player.d.extraMp;
    let d = Math.floor((core + extraMagicDmg) * mrFactor) - (t.dr || 0);
    d = Math.max(1, d);   // 光箭無屬性，無剋制固定加值
    d = Math.floor(d * mageDmgMult);
    d = Math.max(1, Math.floor(d * wpnEnFinalMult(player.eq.wpn)));   // 🔧 武器強化 +11~+20：最終傷害倍率（共鳴光箭比照奇古獸/物理武器；與 tooltip 顯示一致）
    d = Math.max(1, Math.floor(d * fragileMult(t)));   // 🔮 脆弱（白鳥5）
    if (hasMastery('m_resonance')) d = Math.max(1, d + 5);   // 🏅 共鳴精通：光箭傷害 +5
    if (player._setRedLion5) d = Math.max(1, Math.floor(d * 1.2));   // 🔮 紅獅 5/5：最終傷害 +20%
    t.curHp -= d;
    t.justHit = 'magic';
    if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
    mobWake(t);
    player.mp = Math.min(player.mmp, player.mp + Math.max(1, Math.floor(d / (hasMastery('m_resonance') ? 5 : 10))));   // 共鳴：恢復 傷害/10（🏅 共鳴精通：傷害/5）
    updateUI();
    logCombat(`<span class="text-cyan-300 font-bold">【共鳴】</span>光箭對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 <span class="${isCrit ? 'text-yellow-500 font-bold' : 'text-cyan-300'}">${d}</span> 點傷害。${isCrit ? ' (爆擊!)' : ''}`, 'magic');
    if (t.curHp <= 0) {
        let realIdx = mapState.mobs.findIndex(m => m && m.uid === t.uid);
        if (realIdx !== -1) killMob(realIdx);
    } else {
        renderMobs();
    }
    // 🔮 魔女 5/5：累計共鳴次數，每 5 次免費施放一次冰矛圍籬
    if (player._setWitch5) {
        player._witchResCnt = (player._witchResCnt || 0) + 1;
        if (player._witchResCnt >= 5) { player._witchResCnt = 0; witchIceLance(); }
    }
}
// ===== 月光爆裂：對指定目標造成 1D30 + 2×強化等級 的風屬性固定傷害（不受魔法公式影響）=====
function procMoonburst(t) {
    if (!t || t.curHp <= 0) return;
    let en = capWpnEn((player.eq.wpn && player.eq.wpn.en) || 0);
    let mbDmg = roll(1, 30) + 2 * en;
    let counterTxt = '';
    if (isElementCounter('wind', t.e)) { mbDmg += 6; counterTxt = ' <span class="text-emerald-300 font-bold">(剋屬性!)</span>'; }   // 風剋水：額外 +6 固定傷害
    mbDmg = Math.max(1, Math.floor(mbDmg * fragileMult(t)));   // 🔮 脆弱（白鳥5）
    mbDmg = Math.max(1, Math.floor(mbDmg * enhanceWpnFinalMult(en)));   // 🔧 武器強化 +11~+20：最終傷害倍率
    if (player._setRedLion5) mbDmg = Math.max(1, Math.floor(mbDmg * 1.2));   // 🔮 紅獅 5/5：最終傷害 +20%
    t.curHp -= mbDmg;
    t.justHit = 'wind';
    logCombat(`<span class="font-bold" style="color:#67e8f9;text-shadow:0 0 6px #06b6d4;">【月光爆裂】</span>對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${mbDmg} 點風屬性傷害！${counterTxt}`, 'player-special');
    if (t.curHp <= 0) {
        let realIdx = mapState.mobs.findIndex(m => m && m.uid === t.uid);
        if (realIdx !== -1) killMob(realIdx);
    } else {
        renderMobs();
    }
}
// 月光爆裂 proc 判定：裝備熾炎天使弓時 8% 觸發；主目標已死則轉移到場上隨機存活怪（與共鳴相同）
function moonburstProc(target) {
    let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
    if (!wpn || wpn.eff !== 'moonburst') return;
    if (Math.random() >= 0.08) return;
    let t = (target && target.curHp > 0) ? target : null;
    if (!t) {
        let alive = mapState.mobs.filter(m => m && m.curHp > 0);
        if (alive.length === 0) return;
        t = alive[Math.floor(Math.random() * alive.length)];
    }
    procMoonburst(t);
}
// ===== 魔擊（力量魔法杖）：對指定目標打一次「必定命中且必定重擊」的物理攻擊，沿用一般攻擊完整傷害計算 =====
// 🏅 魔擊精通：觸發魔擊時「必定」額外觸發「擴散魔擊」——對所有敵人各自造成等同 1 次魔擊的傷害（擴散不再連鎖）
function procMagicStrike(t, isSpread) {
    if (!t || t.curHp <= 0) return;
    let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
    let dice = wpn ? (t.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;
    let res = getPhysicalDmg(dice, t, wpn, null, true);   // forceHeavy=true：必定命中＋重擊
    t.curHp -= res.dmg;
    t.justHit = getWpnEle(player.eq.wpn, wpn);
    mobWake(t);
    wearHardSkin(t, null, true, false);   // 🔧 硬皮消磨：魔擊重擊 → 視為一般重擊 -2
    let mark = res.crit ? '會心一擊' : '重擊';
    logCombat(`<span class="font-bold" style="color:#d8b4fe;text-shadow:0 0 6px #a855f7;">【${isSpread ? '擴散魔擊' : '魔擊'}】</span>對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${res.dmg} 點傷害（${mark}!）。`, res.crit ? 'player-crit' : 'player-special');
    if (t.curHp <= 0) {
        let realIdx = mapState.mobs.findIndex(m => m && m.uid === t.uid);
        if (realIdx !== -1) killMob(realIdx);
    } else {
        renderMobs();
    }
    if (!isSpread && hasMastery('m_strike')) {   // 🏅 魔擊精通：必定額外觸發擴散魔擊
        let _all = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
        if (_all.length) {
            logCombat(`<span class="font-bold" style="color:#e9d5ff;text-shadow:0 0 8px #a855f7;">【魔擊精通】</span>魔力向四方擴散！`, 'player-special');
            _all.forEach(m => procMagicStrike(m, true));
        }
    }
}
// 魔擊 proc 判定：裝備力量魔法杖時，每次攻擊(命中與否) 力量/60 機率；主目標已死則轉移到場上隨機存活怪
function magicStrikeProc(target) {
    if (player.classicMode) return;   // 🎮 經典模式：停用魔擊
    let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
    if (!wpn || wpn.eff !== 'magicstrike') return;
    if (Math.random() >= ((player.d.str || 0) / 60)) return;   // 觸發機率 = 裝備者力量 / 60
    let t = (target && target.curHp > 0) ? target : null;
    if (!t) {
        let alive = mapState.mobs.filter(m => m && m.curHp > 0);
        if (alive.length === 0) return;
        t = alive[Math.floor(Math.random() * alive.length)];
    }
    procMagicStrike(t);
}
// ===== 連射：發動攻擊時依機率追加 1~3 箭；每箭各自接受命中判定(可未命中/重擊/爆擊)，傷害為該箭結算的 30%；每箭也各判定月光爆裂 =====
function rapidfireProc(arrowData) {
    if (player.classicMode) return;   // 🎮 經典模式：停用連射
    let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
    if (!wpn || !wpn.rapidfire) return;
    if (roll(1, 100) > wpn.rapidfire) return;
    let _rfN = roll(1, hasMastery('e_rapid') ? 5 : 3);   // 🏅 連射精通：額外箭數 1~3 → 隨機 1~5
    for (let _r = 0; _r < _rfN; _r++) {
        let _alive = [];
        mapState.mobs.forEach((m, i) => { if (m && m.curHp > 0) _alive.push(i); });
        if (_alive.length === 0) break;
        let _ti = _alive[Math.floor(Math.random() * _alive.length)];
        let _t = mapState.mobs[_ti];
        // 每箭各自接受命中判定（可能未命中，也可能重擊/爆擊）
        let _dice = _t.s === 'L' ? wpn.dmgL : wpn.dmgS;
        if (arrowData) _dice = _t.s === 'L' ? (wpn.dmgL + arrowData.dmgL) : (wpn.dmgS + arrowData.dmgS);
        let _res = getPhysicalDmg(_dice, _t, wpn, arrowData);
        if (!_res.hit) {
            logCombat(`【連射】箭矢射向 <span class="${getMobColor(_t.lv)}">${_t.n}</span> 但未命中。`, 'miss');
            continue;
        }
        let _rfMult = player._setGale5 ? (hasMastery('e_rapid') ? 1.00 : 0.80) : (hasMastery('e_rapid') ? 0.50 : 0.30);   // 30%；🏅連射精通50%；🔮疾風5/5 80%；兩者兼具100%
        let _rfDmg = Math.max(1, Math.floor(_res.dmg * _rfMult));
        _t.curHp -= _rfDmg;
        _t.justHit = getWpnEle(player.eq.wpn, wpn);
        mobWake(_t);
        if (_res.heavy) wearHardSkin(_t, null, true, false);   // 🔧 硬皮消磨：連射箭重擊 → 視為一般重擊 -2
        let _mark = (_res.heavy && _res.crit) ? '會心一擊' : (_res.crit ? '爆擊' : (_res.heavy ? '重擊' : ''));
        logCombat(`【連射】箭矢命中 <span class="${getMobColor(_t.lv)}">${_t.n}</span>，造成 ${_rfDmg} 點傷害${_mark ? '（' + _mark + '!）' : ''}。`, _res.crit ? 'player-crit' : (_res.heavy ? 'player-heavy' : 'player'));
        if (_t.curHp <= 0) killMob(_ti);
        moonburstProc(_t);   // 熾炎天使弓：每支連射箭矢也有機會觸發月光爆裂（主目標死亡自動轉移）
    }
    renderMobs();
}
// 🛡️ 臂甲判定：臂甲裝在副手(slot:shield)但帶 armguard 旗標；反擊/居合用它區分「真盾牌 vs 臂甲」
function _isArmguard(shRef) { return !!(shRef && DB.items[shRef.id] && DB.items[shRef.id].armguard); }
// ===== 反擊（單手劍）：對攻擊者打一次「必定命中、必定非重擊、傷害 50%」的一般攻擊；只打攻擊者，不轉移 =====
function procCounter(t) {
    if (player.classicMode) return;   // 🎮 經典模式：停用反擊
    if (!t || t.curHp <= 0) return;
    let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
    let dice = wpn ? (t.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;
    let res = getPhysicalDmg(dice, t, wpn, null, false, true, false, hasMastery('k_counter'));   // forceHeavy=false, forceHit=true；🏅 反擊精通：必定爆擊
    let dmg = Math.max(1, Math.floor(res.dmg * (hasMastery('k_counter') ? 0.65 : 0.50)));   // 傷害 50%（🏅 反擊精通：+30% → 65%）
    if (player.buffs.sk_counter_barrier > 0 && player.eq.wpn && getWeaponTags(player.eq.wpn.id).includes('單手劍')) dmg = Math.max(1, Math.floor(dmg * 2));   // 🔧 反擊屏障：原生反擊(單手劍)武器最終傷害×2
    t.curHp -= dmg;
    t.justHit = getWpnEle(player.eq.wpn, wpn);
    mobWake(t);
    if (t.curHp > 0 && hasMastery('k_counter')) wearHardSkin(t, null, false, false, true);   // 🏅 反擊精通：反擊命中削減 1 硬皮值
    let mark = res.crit ? '（爆擊!）' : '';
    logCombat(`<span class="font-bold" style="color:#fbbf24;text-shadow:0 0 6px #f59e0b;">【反擊】</span>對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dmg} 點傷害${mark}。`, 'player');
    let idx = mapState.mobs.findIndex(m => m && m.uid === t.uid);
    if (t.curHp <= 0) { if (idx !== -1) killMob(idx); }
    else renderMobs();
    ironGuardSweep('反擊');   // 🔮 鐵衛 5/5
}
// ===== 居合（武士刀）：對攻擊者打一次「必定命中、可自然重擊/爆擊」的一般攻擊；只打攻擊者 =====
function procIai(t) {
    if (player.classicMode) return;   // 🎮 經典模式：停用居合
    if (!t || t.curHp <= 0) return;
    let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
    let dice = wpn ? (t.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;
    let res = getPhysicalDmg(dice, t, wpn, null, false, false, true, hasMastery('k_counter'));   // forceLand=true：必定命中、可重擊；🏅 反擊精通：必定爆擊
    if (hasMastery('k_counter')) res.dmg = Math.max(1, Math.floor(res.dmg * 1.3));   // 🏅 反擊精通：居合傷害 +30%
    if (player.buffs.sk_counter_barrier > 0 && player.eq.wpn && getWeaponTags(player.eq.wpn.id).includes('武士刀')) res.dmg = Math.max(1, Math.floor(res.dmg * 2));   // 🔧 反擊屏障：原生居合(武士刀)武器最終傷害×2
    t.curHp -= res.dmg;
    t.justHit = getWpnEle(player.eq.wpn, wpn);
    mobWake(t);
    wearHardSkin(t, null, res.heavy, false, hasMastery('k_counter'));   // 🔧 居合重擊 -2；🏅 反擊精通：居合命中再削減 1 硬皮值（與重擊 -2 疊加）
    let mark = (res.heavy && res.crit) ? '會心一擊' : (res.crit ? '爆擊' : (res.heavy ? '重擊' : ''));
    logCombat(`<span class="font-bold" style="color:#a5f3fc;text-shadow:0 0 6px #06b6d4;">【居合】</span>對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${res.dmg} 點傷害${mark ? '（' + mark + '!）' : ''}。`, 'player');
    let idx = mapState.mobs.findIndex(m => m && m.uid === t.uid);
    if (t.curHp <= 0) { if (idx !== -1) killMob(idx); }
    else renderMobs();
    ironGuardSweep('居合');   // 🔮 鐵衛 5/5
}
// 雙擊（鋼爪/雙刀）：依武器 comboRate% 機率發動，追加一次「額外一般攻擊」，獨立判定命中、傷害＝完整一般攻擊（🔮 暗影5/5→額外攻擊再×1.5）；本身不再觸發雙擊/穿透等（不遞迴）。fullDmg=false（爆擊精通沿用）保留舊倍率×0.5（暗影5/5×1.0）
// ===== 🐉 弱點曝光（weakExpose）：鎖鏈劍一般攻擊命中時依機率對目標附加堆疊（最多3層，鎖刃精通5層）；屠宰者命中時消耗並轉為額外傷害（見 castSkill 屠宰者）=====
function weakExposeMaxLayers() { return hasMastery('k_chainblade') ? 5 : 3; }   // 🏅 鎖刃精通：上限 5 層
function playerCanWeakExpose() {
    let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
    if (!wpn || wpn.isBow || wpn.ranged) return false;   // 近距離武器專用
    return !!wpn.weakExpose || hasMastery('k_weakness');   // 鎖鏈劍 或 🏅 弱點精通（任意近戰武器）
}
function applyPlayerWeakExpose(target) {
    if (!target || target.curHp <= 0) return;
    if (!playerCanWeakExpose()) return;
    let always = hasMastery('k_chainblade') || hasMastery('k_weakness');   // 鎖刃／弱點精通：必定附加；否則 12%
    if (!always && Math.random() >= 0.12) return;
    let before = target.weakExpose || 0;
    target.weakExpose = Math.min(weakExposeMaxLayers(), before + 1);
}
// 🏅 鎖刃精通：目標每有 1 層弱點曝光，對其最終傷害 +10%（最高 5 層 +50%）
function weakExposeDmgMult(m) { return (hasMastery('k_chainblade') && m && m.weakExpose > 0) ? (1 + 0.1 * Math.min(5, m.weakExpose)) : 1; }
// 🐉 龍血精通：所有技能 HP 消耗減半
function effHpCost(sk) { return Math.ceil((sk.hpCost || 0) * (hasMastery('k_dragonblood') ? 0.5 : 1)); }
// 🐉 龍鱗臂甲 額外攻擊：每攻擊週期追加 d.equipExtraAtk 次全傷害一般近戰攻擊（各自命中判定；不遞迴再觸發額外攻擊）
function dragonExtraAttackProc(target) {
    let n = (player.d && player.d.equipExtraAtk) || 0;
    if (n <= 0) return;
    let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
    if (!wpn || wpn.isBow || wpn.ranged) return;   // 近戰專用（弓另有連射）
    for (let i = 0; i < n; i++) {
        let t = (target && target.curHp > 0 && !target._dead) ? target : getTarget();
        if (!t || t.curHp <= 0) return;
        let dice = t.s === 'L' ? wpn.dmgL : wpn.dmgS;
        let res = getPhysicalDmg(dice, t, wpn, null, false, false, false);
        if (!res.hit) { logCombat(`<span class="font-bold" style="color:#fbbf24;">【額外攻擊】</span>對 <span class="${getMobColor(t.lv)}">${t.n}</span> 未命中。`, 'miss'); continue; }
        // 🏅 鎖刃精通：「每層弱點曝光最終傷害+10%」僅屠宰者生效，額外攻擊不套用
        t.curHp -= res.dmg; t.justHit = getWpnEle(player.eq.wpn, wpn); mobWake(t);
        if (t.curHp > 0) { wearHardSkin(t, player.eq.wpn ? player.eq.wpn.id : null, res.heavy, false, true, player.classicMode); applyPlayerWeakExpose(t); }
        if (wpn.vampPct && res.dmg > 0) player.hp = Math.min(player.mhp, player.hp + Math.floor(res.dmg * wpn.vampPct));
        let mark = (res.heavy && res.crit) ? '會心一擊' : (res.crit ? '爆擊' : (res.heavy ? '重擊' : ''));
        logCombat(`<span class="font-bold" style="color:#fbbf24;text-shadow:0 0 6px #d97706;">【額外攻擊】</span>追擊 <span class="${getMobColor(t.lv)}">${t.n}</span>，造成 ${res.dmg} 點傷害${mark ? '（' + mark + '!）' : ''}。`, 'player');
        let idx = mapState.mobs.findIndex(m => m && m.uid === t.uid);
        if (t.curHp <= 0) { if (idx !== -1) killMob(idx); }
        else renderMobs();
    }
}
function procCombo(t, fullDmg) {
    if (!t || t.curHp <= 0 || t._dead) return;
    let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
    let dice = wpn ? (t.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;
    let res = getPhysicalDmg(dice, t, wpn, null, false, false, false);   // 獨立命中判定（可未命中）
    if (!res.hit) { logCombat(`<span class="font-bold" style="color:#c4b5fd;">【雙擊】</span>追擊 <span class="${getMobColor(t.lv)}">${t.n}</span> 未命中。`, 'miss'); return; }
    // 🔧 黑暗妖精：連擊亦獨立觸發燃燒鬥志(30%×1.5)、雙重破壞(雙刀/鋼爪 45級起10%×2，每5級+1%)，兩者可疊加；先套用於本擊傷害，再依連擊倍率（暗影5/5→100%，否則50%）結算
    let _cdmg = res.dmg;
    if (player.buffs && player.buffs.sk_dark_burn > 0 && Math.random() < 0.30) _cdmg = Math.floor(_cdmg * 1.5);
    if (player.buffs && player.buffs.sk_dark_double > 0) {
        let _ct = getWeaponTags(player.eq.wpn ? player.eq.wpn.id : '');
        if (_ct.includes('雙刀') || _ct.includes('鋼爪')) {
            let _cch = 10 + (player.lv >= 45 ? Math.floor((player.lv - 45) / 5) : 0);
            if (Math.random() * 100 < _cch) _cdmg *= 2;
        }
    }
    let dmg = Math.max(1, Math.floor(_cdmg * (fullDmg ? (player._setShadow5 ? 1.5 : 1.0) : (player._setShadow5 ? 1.0 : 0.5))));   // 🔧 雙擊(fullDmg)：完整一般攻擊·暗影5/5再×1.5；爆擊精通額外攻擊(legacy)：×0.5·暗影5/5×1.0
    t.curHp -= dmg;
    t.justHit = getWpnEle(player.eq.wpn, wpn);
    mobWake(t);
    if (t.curHp > 0) wearHardSkin(t, player.eq.wpn ? player.eq.wpn.id : null, res.heavy, false, true, player.classicMode);   // 連擊亦為一般攻擊：依武器消磨硬皮
    let mark = (res.heavy && res.crit) ? '會心一擊' : (res.crit ? '爆擊' : (res.heavy ? '重擊' : ''));
    logCombat(`<span class="font-bold" style="color:#c4b5fd;text-shadow:0 0 6px #8b5cf6;">【雙擊】</span>追擊 <span class="${getMobColor(t.lv)}">${t.n}</span>，造成 ${dmg} 點傷害${mark?'（'+mark+'!）':''}。`, 'player');
    let idx = mapState.mobs.findIndex(m => m && m.uid === t.uid);
    if (t.curHp <= 0) { if (idx !== -1) killMob(idx); }
    else renderMobs();
}
// ⚔️ 戰士可作雙持的武器：單手鈍器；🏅 巨斧精通(k_giantaxe)時雙手鈍器亦可（雙手鈍器單手化）
function warriorDualWieldWpnOk(id) {
    if (!id) return false;
    let tags = getWeaponTags(id);
    if (tags.includes('單手鈍器')) return true;
    return player.cls === 'warrior' && hasMastery('k_giantaxe') && tags.includes('雙手鈍器');
}
// ⚔️ 🏅 巨斧精通：戰士的雙手鈍器視為單手（可與盾牌／副手並用）；其餘走通用雙手判定
function effTwoHanded(d, id) {
    if (player.cls === 'warrior' && hasMastery('k_giantaxe') && d && d.type === 'wpn' && getWeaponTags(id).includes('雙手鈍器')) return false;
    return isTwoHandedWpn(d);
}
// ⚔️ 反彈精通：忍耐(泰坦)系觸發閾值（k_rebound→HP 80% 以下，否則 40%）
function titanThreshold() { return (player.cls === 'warrior' && hasMastery('k_rebound')) ? 0.8 : 0.4; }
// ⚔️ 迅猛雙斧：為戰士、已學迅猛雙斧、且主手可雙持(單手鈍器／巨斧精通的雙手鈍器)時，可於 offwpn 欄再持一把
function dualWieldOffhandOk() {
    return player.cls === 'warrior' && player.skills.includes('sk_warrior_dualaxe')
        && player.eq.wpn && warriorDualWieldWpnOk(player.eq.wpn.id);
}
// ⚔️ 迅猛雙斧：副手單手鈍器追加一次完整一般攻擊（第二攻擊來源·獨立命中·吃狂暴；副手不重複觸發出血/弱點等主手特效）
function dualWieldOffhandAttack(t) {
    if (!t || t.curHp <= 0 || t._dead) return;
    if (!dualWieldOffhandOk() || !player.eq.offwpn) return;
    let owpn = DB.items[player.eq.offwpn.id];
    let dice = owpn ? (t.s === 'L' ? owpn.dmgL : owpn.dmgS) : 2;
    let res = getPhysicalDmg(dice, t, owpn, null, false, false, false, false, player.eq.offwpn);   // 副手獨立命中判定（可未命中）；傳入副手實例→屬性詞綴用副手自身（祝福/遠古已於 recompute 計入 global d）
    if (!res.hit) { logCombat(`<span class="font-bold" style="color:#fbbf24;">【迅猛雙斧】</span>副手追擊 <span class="${getMobColor(t.lv)}">${t.n}</span> 未命中。`, 'miss'); return; }
    let dmg = res.dmg;
    if (player.skills.includes('sk_warrior_berserk') && Math.random() < 0.05) dmg *= 2;   // ⚔️ 狂暴：副手亦為一般攻擊
    dmg = Math.max(1, dmg);
    t.curHp -= dmg; t.justHit = getWpnEle(player.eq.offwpn, owpn); mobWake(t);
    if (t.curHp > 0) wearHardSkin(t, player.eq.offwpn.id, res.heavy, false, true, player.classicMode);
    let mark = (res.heavy && res.crit) ? '會心一擊' : (res.crit ? '爆擊' : (res.heavy ? '重擊' : ''));
    logCombat(`<span class="font-bold" style="color:#fbbf24;text-shadow:0 0 6px #d97706;">【迅猛雙斧】</span>副手 ${owpn.n} 追擊 <span class="${getMobColor(t.lv)}">${t.n}</span>，造成 ${dmg} 點傷害${mark?'（'+mark+'!）':''}。`, 'player');
    let idx = mapState.mobs.findIndex(m => m && m.uid === t.uid);
    if (t.curHp <= 0) { if (idx !== -1) killMob(idx); }
    else renderMobs();
}
// ⚔️ 迅猛雙斧：副手武器有效性同步——主手不再可雙持／失去迅猛雙斧／副手武器不合格時，退回背包
function syncDualWield() {
    if (player.eq.offwpn && (!dualWieldOffhandOk() || !warriorDualWieldWpnOk(player.eq.offwpn.id))) {
        let e = player.eq.offwpn;
        let ex = player.inv.find(i => sameItemSig(i, e) && !i.lock && !i.junk);
        if (ex) ex.cnt += e.cnt; else player.inv.push(e);
        player.eq.offwpn = null;
        logSys('副手武器已卸下（不符迅猛雙斧雙持條件）。');
    }
}
// ⚔️ 反彈精通：觸發忍耐被動時，額外對攻擊者發動一次普通攻擊（副手有雙持武器則主副手各一次）
function reboundExtraAttack(mob) {
    if (!mob || mob.curHp <= 0 || mob._dead) return;
    let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
    if (wpn && !wpn.isBow && !wpn.ranged) {
        let dice = mob.s === 'L' ? wpn.dmgL : wpn.dmgS;
        let res = getPhysicalDmg(dice, mob, wpn, null, false, false, false);
        if (res.hit) {
            let dmg = res.dmg;
            if (player.skills.includes('sk_warrior_berserk') && Math.random() < 0.05) dmg *= 2;
            dmg = Math.max(1, dmg);
            mob.curHp -= dmg; mob.justHit = getWpnEle(player.eq.wpn, wpn); mobWake(mob);
            if (mob.curHp > 0) wearHardSkin(mob, player.eq.wpn.id, res.heavy, false, true, player.classicMode);
            logCombat(`<span class="font-bold" style="color:#d6d3d1;text-shadow:0 0 6px #78716c;">【反彈】</span>反擊追打 <span class="${getMobColor(mob.lv)}">${mob.n}</span>，造成 ${dmg} 點傷害。`, 'player');
        } else logCombat(`<span class="font-bold" style="color:#d6d3d1;">【反彈】</span>反擊追打未命中。`, 'miss');
    }
    if (mob.curHp > 0 && player.eq.offwpn && warriorDualWieldWpnOk(player.eq.offwpn.id)) dualWieldOffhandAttack(mob);   // 副手：再一次
    let idx = mapState.mobs.findIndex(m => m && m.uid === mob.uid);
    if (mob.curHp <= 0 && idx !== -1) killMob(idx);
}

// 🔮 鐵衛 5/5：觸發反擊或居合時，額外對全體敵人造成一次一般攻擊（各自正常命中判定）
function ironGuardSweep(triggerName) {
    if (!player._setIron5) return;
    let targets = [];
    mapState.mobs.forEach(m => { if (m && m.curHp > 0 && !m._dead) targets.push(m); });
    if (!targets.length) return;
    logCombat(`<span class="font-bold" style="color:#93c5fd;text-shadow:0 0 6px #3b82f6;">【鐵衛 5/5】</span>${triggerName}引動鋼鐵之勢，橫掃全體敵人！`, 'player');
    targets.forEach(m => {
        if (!m || m.curHp <= 0 || m._dead) return;   // 可能已被前一刀的擊殺波及
        let wpn = player.eq.wpn ? DB.items[player.eq.wpn.id] : null;
        let dice = wpn ? (m.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;
        let res = getPhysicalDmg(dice, m, wpn, null);
        if (!res.hit) { logCombat(`橫掃 <span class="${getMobColor(m.lv)}">${m.n}</span> 未命中。`, 'miss'); return; }
        m.curHp -= res.dmg;
        m.justHit = getWpnEle(player.eq.wpn, wpn);
        mobWake(m);
        logCombat(`橫掃命中 <span class="${getMobColor(m.lv)}">${m.n}</span>，造成 ${res.dmg} 點傷害。`, 'player');
        if (m.curHp <= 0) { let ri = mapState.mobs.findIndex(x => x && x.uid === m.uid); if (ri !== -1) killMob(ri); }
    });
    renderMobs();
}

// 🔮 魔女 5/5：每觸發 5 次共鳴，免費施放一次冰矛圍籬（不耗 MP、不需學會；公式同 castSkill 單體魔法）
function witchIceLance() {
    let sk = DB.skills['sk_ice_lance'];
    if (!sk) return;
    let t = getTarget();
    if (!t || t.curHp <= 0 || t._dead) {
        let alive = mapState.mobs.filter(m => m && m.curHp > 0 && !m._dead);
        if (!alive.length) return;
        t = alive[Math.floor(Math.random() * alive.length)];
    }
    let effMr = (t.st && t.st.mrhalf > 0) ? (t.mr / 2) : t.mr;
    let mrFactor = mrMult(effMr);
    let isCrit = Math.random()*100 < player.d.magicCrit;
    let tier = sk.tier || 1;
    let spCoef = (1 + 3*player.d.magicDmg/16) * (1 + tier/3);
    let mageMult = (player.cls === 'mage') ? (1.5 + tier/20) : 1.0;
    let critMult = isCrit ? (1 + player.d.magicCritDmg/100) : 1;
    let core = roll(sk.dmgDice[0], sk.dmgDice[1]) * spCoef * critMult;
    let fixed = (t.e === 'fire') ? 6 : 0;   // 水剋火
    let dmg = Math.max(1, Math.floor((core + player.d.extraMp) * mrFactor) - (t.dr||0)) + fixed;
    dmg = Math.floor(dmg * mageMult);
    if (player._setRedLion5) dmg = Math.floor(dmg * 1.2);   // 🔮 紅獅 5/5 同樣適用（攻擊技能）
    dmg = Math.max(1, Math.floor(dmg * fragileMult(t)));
    t.curHp -= dmg;
    t.justHit = 'water';
    if (t.st && t.st.mrhalf > 0) t.st.mrhalf = 0;
    mobWake(t);
    if (sk.freeze) applyMobStatus(t, { kind:'freeze', pbase:sk.freeze, dur:6 }, sk.n);
    logCombat(`<span class="font-bold" style="color:#7dd3fc;text-shadow:0 0 6px #0ea5e9;">【魔女 5/5】</span>共鳴引動了 冰矛圍籬，對 <span class="${getMobColor(t.lv)}">${t.n}</span> 造成 ${dmg} 點傷害。${isCrit ? ' (爆擊!)' : ''}`, 'magic');
    if (t.curHp <= 0) { let ri = mapState.mobs.findIndex(m => m && m.uid === t.uid); if (ri !== -1) killMob(ri); }
    else renderMobs();
}
// 🔧 水之元氣（sk_elf_watervital）：buff 期間內，下次受到「治癒術」（玩家自身瞬間治癒，不含持續回復 HoT）治癒時恢復量加倍，觸發後 7 秒冷卻（player._waterVitalCd，每秒遞減）。
function waterVitalHeal(heal) {
    if (heal > 0 && player.buffs && player.buffs.sk_elf_watervital > 0 && (player._waterVitalCd || 0) <= 0) {
        player._waterVitalCd = 7;   // 觸發後 7 秒冷卻
        logCombat('💧 水之元氣發動：本次治療恢復量加倍！', 'heal');
        return heal * 2;
    }
    return heal;
}

// 🔮 幻術士 魔力精通：消耗 MP 時，所有有 MP 的傭兵恢復消耗量 10% 的 MP
function manaMasteryRefund(spent) {
    if (!spent || spent <= 0) return;
    let give = Math.max(1, Math.floor(spent * 0.10));
    if (player.allies) player.allies.forEach(a => { if (a && (a.mmp || 0) > 0) a.mp = Math.min(a.mmp, (a.mp || 0) + give); });
}
// 🔮 是否為魔杖/法杖類武器（沿用 js/10 同一套名稱判定，排除黃金權杖＝王族單手劍）：
//    魔劍精通(i_magicsword)只把「非奇古獸的近戰武器」轉成奇古獸必中魔法路徑，魔杖本即施法武器、不應再轉（必中/攻速+30% 皆排除）。
function isWandWeapon(d) { return !!(d && d.type === 'wpn' && (/魔杖|法杖/.test(d.n || '') || (/杖/.test(d.n || '') && !/權杖/.test(d.n || '')))); }
// 🔮 幻術士 奇古獸一般攻擊：[奇古獸骰 × (1 + 魔法傷害/16)] + 額外魔法點數 + 額外傷害；視為魔法傷害、100%命中、受目標MR減免（奇古獸精通無視MR）。
//    觸發路徑：裝備奇古獸(wpn.qigu)恆走此式；或 魔劍精通 + 任意非弓「且非魔杖」武器亦套用此式。屬性詞綴→對應屬性(剋屬性+6)。
// 🔮 幻術士專屬加成：所有傷害(奇古獸普攻/特效/傷害技能/立方/幻覺召喚物)最終 ×(1+等級/50)；非幻術士回 1（玩家傳 player、傭兵傳 ally）
function illuLvMult(a){ return (a && a.cls === 'illusion') ? (1 + (a.lv || 1) / 50) : 1; }
function qiguPlayerAttack(target, wpn) {
    let d = player.d;
    if (target.curHp === target.hp && target.beh === '被動') target._delayTicks = 30;   // 命中滿血被動怪：3秒延遲（同魔法攻擊）
    let dice = (target.s === 'L') ? wpn.dmgL : wpn.dmgS;
    let core = roll(1, dice) * (1 + (d.magicDmg || 0) / 16);
    let raw = core + (d.extraMp || 0) + (d.extraDmg || 0);
    let effMr = (target.st && target.st.mrhalf > 0) ? (target.mr / 2) : target.mr;
    if (target.st && (target.st.confuse > 0 || target.st.panic > 0)) effMr = Math.max(0, effMr - 10);   // 🔮 混亂/恐慌：MR-10（下限0，與其他魔法路徑 mrMult(Math.max(0,...)) 一致）
    let ignoreMr = (player.mastery === 'i_qigu' && wpn.qigu);   // 🔮 奇古獸精通：裝備奇古獸時無視魔抗
    let dmg = Math.max(1, Math.floor(raw * (ignoreMr ? 1 : mrMult(effMr))));
    let ele = 'none';
    if (player.eq.wpn && player.eq.wpn.attr && ATTR_AFFIX[player.eq.wpn.attr]) { ele = ATTR_AFFIX[player.eq.wpn.attr].ele; if (isElementCounter(ele, target.e)) dmg += 6; }
    dmg = Math.max(1, Math.floor(dmg * wpnEnFinalMult(player.eq.wpn)));   // 武器強化 +11~+20 最終倍率
    if (player._setRedLion5) dmg = Math.floor(dmg * 1.2);   // 🔮 紅獅 5/5
    dmg = Math.max(1, Math.floor(dmg * fragileMult(target) * illuLvMult(player)));   // 🔮 脆弱/破甲；🔮 幻術士等級加成 ×(1+等級/50)
    target.curHp -= dmg;
    target.justHit = (ele !== 'none') ? ele : 'magic';
    if (target.st && target.st.mrhalf > 0) target.st.mrhalf = 0;
    mobWake(target);
    logCombat(`<span class="font-bold" style="color:#c4b5fd;text-shadow:0 0 6px #8b5cf6;">【幻術士】</span>奇古獸對 <span class="${getMobColor(target.lv)}">${target.n}</span> 造成 ${dmg} 點魔法傷害。`, 'magic');
    if (target.curHp <= 0) killMob(mapState.targetIdx); else renderMobs();   // 主擊先結算（避免與下方特效各自 killMob 重複擊殺）
    qiguWeaponProc(target, wpn);        // 奇古獸特效（幻影衝擊/心靈破壞；主擊已擊殺則內部 guard 跳過、自行處理擊殺）
    wandLightArrowProc(target);         // 🔮 共鳴（幻術士魔杖在 WAND_LIGHTARROW_IDS；非共鳴武器內部 no-op，主目標已死自動轉移）
    // 🔮 魔劍精通可裝備一般武器：補齊一般武器命中特效（與傭兵 allyQiguAttack/allyWeaponProcs 一致；各函式/分支自帶武器判定，非對應武器即 no-op）
    if (wpn.eff === 'mp_drain' || wpn.mpOnHit) {   // 命中恢復 MP（瑪那魔杖等）
        let _en = capWpnEn((player.eq.wpn && player.eq.wpn.en) || 0);
        player.mp = Math.min(player.mmp, player.mp + 1 + Math.max(0, _en - 6)); updateUI();
    }
    magicStrikeProc(target);            // 魔擊（力量魔法杖）
    weaponSpellProc(target);            // 附魔施放：spellProc/procSkill/procPoison/procStatusSkill（巴風特魔杖/冰之女王魔杖/死亡之指等）
}
// 奇古獸武器特效（隨強化提升機率）：共鳴=幻影衝擊(80~160無屬性固定)、寒冰=心靈破壞(玩家最大MP5%、不耗MP)
function qiguWeaponProc(target, wpn) {
    if (!wpn || !wpn.qiguProc || !target || target.curHp <= 0) return;
    let en = capWpnEn((player.eq.wpn && player.eq.wpn.en) || 0);
    if (Math.random() >= (1 + en) / 100) return;   // 1% + 每強化 +1%
    let ignoreMr = (player.mastery === 'i_qigu' && wpn.qigu);   // 🔮 奇古獸精通：裝備奇古獸時其觸發特效亦無視魔抗（與主擊一致，避免非奇古獸武器誤觸）
    let dmg = 0, label = '', cls = 'magic';
    if (wpn.qiguProc === 'phantom') {
        dmg = 79 + roll(1, 81);   // 80~160 無屬性固定傷害（不受MR）
        label = '幻影衝擊'; cls = 'player-special';
    } else if (wpn.qiguProc === 'mindbreak') {
        let effMr = (target.st && target.st.mrhalf > 0) ? (target.mr / 2) : target.mr;
        dmg = Math.max(1, Math.floor((player.mmp || 0) * 0.05 * (1 + (player.d.magicDmg || 0) / 16) * (ignoreMr ? 1 : mrMult(effMr))));   // 玩家最大MP 5% ×(1+魔法傷害/16)（比照技能心靈破壞·不消耗MP）
        label = '心靈破壞';
    } else return;
    dmg = Math.max(1, Math.floor(dmg * fragileMult(target) * illuLvMult(player) * enhanceWpnFinalMult(en)));   // 🔮 幻術士等級加成 ×(1+等級/50)；🔧 武器強化 +11~+20 最終倍率
    target.curHp -= dmg; target.justHit = 'magic'; mobWake(target);
    logCombat(`<span class="font-bold" style="color:#a78bfa;text-shadow:0 0 6px #7c3aed;">【${label}】</span>對 <span class="${getMobColor(target.lv)}">${target.n}</span> 造成 ${dmg} 點傷害！`, cls);
    if (target.curHp <= 0) killMob(mapState.targetIdx); else renderMobs();
}