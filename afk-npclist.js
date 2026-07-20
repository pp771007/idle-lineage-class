/**
 * afk-npclist.js — 村莊 NPC 條列式(比照裝備/背包條列式)
 *
 * 開啟時把村莊畫面的「地圖站位 NPC」(#town-npc-map)換成一行一 NPC 的列表:
 * sprite 圖示+名稱+職稱+一句介紹,點列=開該 NPC 功能(同點地圖上的 NPC)。
 * 作法:包 renderTownNPCMap(村莊 NPC 渲染唯一入口;可見性過濾/入口告示/玩家收購
 * NPC 的規則全在核心內)——讓原函式照跑建好 .town-npc 元素,再從那些元素「鏡射」
 * 出列表列,點列代理原元素的 click(零重複核心規則,核心改過濾/新增 NPC 自動跟上);
 * 地圖本體用 body class + CSS 藏起來。NPC 功能視窗是浮動視窗(不切視圖),列表照常駐。
 * 關掉外掛開關 → 完全回原版地圖站位。
 */
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('npclist')) return;   // 🎚️ 外掛開關
    if (typeof window.renderTownNPCMap !== 'function' || !document.getElementById('town-npc-map')) {
        try { console.warn('[AFK-npclist] 缺核心掛點(renderTownNPCMap/#town-npc-map),村莊 NPC 條列式停用。'); } catch (e) {}
        return;
    }

    var st = document.createElement('style');
    st.id = 'afk-npclist-css';
    st.textContent = [
        'body.afk-npclist #town-npc-map{display:none!important;}',
        '#afk-npclist{width:100%;flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:5px;padding-bottom:12px;}',
        // 🚨 flex:0 0 auto 不可拿掉:列表是 flex column,列預設 flex-shrink:1 → 列數一多就被容器高度「壓扁」,
        //    壓到 min-height 後兩行介紹的字直接被裁掉(看起來像字太擠)。要的是「列各自撐開、整份用捲的」。
        '.afk-npcl-row{flex:0 0 auto;display:flex;align-items:center;gap:10px;min-height:46px;padding:9px 12px;border:1px solid #334155;border-radius:8px;background:rgba(15,23,42,.55);color:#e2e8f0;text-align:left;cursor:pointer;width:100%;font-size:14px;}',
        '.afk-npcl-row:hover{background:rgba(30,41,59,.85);}',
        '.afk-npcl-ico{flex:0 0 40px;width:40px;height:40px;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;}',
        '.afk-npcl-ico img{max-width:100%;max-height:100%;object-fit:contain;}',
        '.afk-npcl-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px;}',
        '.afk-npcl-name{font-weight:700;}',
        '.afk-npcl-title{color:#94a3b8;font-size:12px;font-weight:400;margin-left:6px;}',
        '.afk-npcl-desc{color:#94a3b8;font-size:12.5px;line-height:1.55;overflow-wrap:anywhere;}',
        // 📐 核心給 #town-view 的 16:9 是為了「800×450 的地圖圖片」;地圖已被換成列表 → 這個比例只會把
        //    列表壓成一小條、下面留一大片空白。改成吃滿剩餘高度(整條鏈都要放行,否則某一層 flex:0 0 auto 就卡住)。
        //    只在手機動:桌機 800×450 本來就夠放,不需要改版面。
        '@media (max-width: 768px), (max-height: 520px) and (pointer: coarse){',
        'body.afk-npclist #game-screen:has(#town-view:not(.hidden)) #col-center{flex:1 1 auto !important;min-height:0;}',
        'body.afk-npclist #col-center:has(#town-view:not(.hidden)) #map-view-panel{flex:1 1 auto !important;min-height:0;}',
        'body.afk-npclist #town-view:not(.hidden){aspect-ratio:auto !important;height:auto !important;flex:1 1 auto !important;min-height:200px;}',
        '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
    document.body.classList.add('afk-npclist');

    function buildList(townId) {
        var map = document.getElementById('town-npc-map'); if (!map) return;
        var host = document.getElementById('afk-npclist');
        if (!host) { host = document.createElement('div'); host.id = 'afk-npclist'; map.insertAdjacentElement('afterend', host); }
        host.innerHTML = '';
        var npcs = (typeof DB !== 'undefined' && DB.towns && DB.towns[townId] && DB.towns[townId].npcs) || [];   // DB 是 let 全域,不在 window 上
        map.querySelectorAll('.town-npc').forEach(function (el) {
            var nameEl = el.querySelector('.tn-name'), titleEl = el.querySelector('.tn-title'), bodyImg = el.querySelector('.tn-body');
            var name = nameEl ? nameEl.textContent : '';
            var data = null;
            for (var i = 0; i < npcs.length; i++) if (npcs[i].n === name) { data = npcs[i]; break; }

            var row = document.createElement('button');
            row.type = 'button'; row.className = 'afk-npcl-row';
            var ico = document.createElement('span'); ico.className = 'afk-npcl-ico';
            if (bodyImg && bodyImg.getAttribute('src')) {
                var img = document.createElement('img');
                img.src = bodyImg.getAttribute('src'); img.alt = ''; img.draggable = false;
                var tint = bodyImg.style && bodyImg.style.filter; if (tint) img.style.filter = tint;
                img.onerror = function () { this.remove(); };
                ico.appendChild(img);
            }
            var main = document.createElement('span'); main.className = 'afk-npcl-main';
            var line1 = document.createElement('span');
            var nm = document.createElement('span'); nm.className = 'afk-npcl-name'; nm.textContent = name;
            var tt = document.createElement('span'); tt.className = 'afk-npcl-title'; tt.textContent = titleEl ? titleEl.textContent : '';
            line1.appendChild(nm); line1.appendChild(tt);
            main.appendChild(line1);
            if (data && data.d) {
                var de = document.createElement('span'); de.className = 'afk-npcl-desc'; de.textContent = data.d;
                main.appendChild(de);
            }
            row.appendChild(ico); row.appendChild(main);
            row.addEventListener('click', function () { el.click(); });   // 代理原地圖 NPC 的點擊(interactNPC/浮動入口/玩家收購)
            host.appendChild(row);
        });
    }

    var _orig = window.renderTownNPCMap;
    window.renderTownNPCMap = function (townId) {
        var r = _orig.apply(this, arguments);
        try { buildList(townId); } catch (e) {}
        return r;
    };

    try { console.log('[AFK-npclist] hooks OK — 村莊 NPC 條列式已啟用(外掛開關可關回地圖站位)。'); } catch (e) {}
})();
