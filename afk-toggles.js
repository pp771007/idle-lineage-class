/**
 * afk-toggles.js — 外掛開關中樞（所有 afk-* 外掛的地基，必須「最先」載入）
 *
 * 目的：核心永遠是原作者原版；我們的功能全是外掛疊上去。外掛靠「包核心函式」運作，
 *   上游一改名就可能斷。此開關讓「某支外掛壞掉時，玩家自己關掉它 → 遊戲回到原版
 *   行為照常能玩」，作者再慢慢修。
 *
 * 契約：
 *   - 每支外掛在檔案最前面先 `if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('<id>')) return;`（純新增型），
 *     或在「包核心函式」的 wrapper 內每次呼叫先問 `AFK_TOGGLES.enabled('<id>')`，關掉就 `return 原函式(...)`（透明放行）。
 *   - 外掛載入時呼叫 `AFK_TOGGLES.register({id,name,desc,group,def})` 讓自己出現在開關面板。
 *   - 讀不到 AFK_TOGGLES（此檔沒載到）時，外掛一律「當作開啟」照常運作（enabled 預設 true），不因缺開關而失效。
 *
 * 這支自己「不可被關」——它是逃生門。故意不包任何核心函式、不依賴任何其他外掛。
 */
(function () {
    'use strict';
    var LS = 'afk_toggle_';
    var registry = [];   // {id,name,desc,group,def}
    var byId = {};       // id → registry 項目（enabled() 被多支外掛掛在每 tick/每擊殺的熱路徑上，不能線性掃）
    // localStorage 原始值快取（'0'/'1'/null=未設過）。同上，熱路徑不能每次同步讀 LS。
    // 唯一寫入者是本檔的 set() 與面板「全部恢復預設」，都會同步更新快取；多分頁同開互改設定不在支援範圍（重新整理即一致）。
    var lsCache = {};

    function find(id) { return byId[id] || null; }

    var api = {
        // 外掛自我登錄（重複 id 忽略）
        register: function (spec) {
            if (!spec || !spec.id || find(spec.id)) return;
            var entry = {
                id: spec.id,
                name: spec.name || spec.id,
                desc: spec.desc || '',
                group: spec.group || '其他',
                def: spec.def !== false,  // 預設開；傳 def:false 才預設關
                locked: spec.locked || '', // 非空＝暫時停用：一律當關閉、面板上不可勾，字串是給玩家看的原因
                parent: spec.parent || ''  // 非空＝這是某支外掛的子選項：面板上縮排排在該支底下（父項關掉時子項一律當關閉）
            };
            registry.push(entry);
            byId[entry.id] = entry;
        },
        // 這支外掛現在是否啟用（讀 localStorage，未設過→用預設；讀不到 localStorage→啟用）
        enabled: function (id) {
            var r = find(id), def = r ? r.def : true;
            if (r && r.locked) return false;   // 暫時停用中：不管 localStorage 存過什麼都當關閉
            if (r && r.parent && !api.enabled(r.parent)) return false;   // 父項關掉 → 子選項一律失效（子選項自己不必再問一次父項）
            var v;
            if (id in lsCache) v = lsCache[id];
            else { try { v = lsCache[id] = localStorage.getItem(LS + id); } catch (e) { return def; } }
            return v === null ? def : v === '1';
        },
        set: function (id, on) { try { localStorage.setItem(LS + id, on ? '1' : '0'); lsCache[id] = on ? '1' : '0'; } catch (e) {} },
        list: function () { return registry.slice(); },
        openPanel: openPanel
    };
    window.AFK_TOGGLES = api;

    // ── 內建外掛目錄：先自動登錄，面板一定列得出來（就算某支外掛載入失敗也能被關/開）──
    //   id = 外掛檔名去掉 afk- 前綴；def:false 才預設關。infra(afk-ui/extradata/sw/toggles)刻意不列＝不可關。
    //
    //   🚨 **檔頭就早退的外掛（`if (!enabled('x')) return;`）一定要列在這裡**，否則會變成死結：
    //      關掉 → 下次載入在 register 之前就 return → 面板上整項消失 → 玩家再也開不回來（踩過）。
    //      判準：外掛裡的 `AFK_TOGGLES.register` 若排在早退之後，它的 id 就必須出現在這張表。
    //      有 scripts/check-toggle-deadend.mjs 靜態擋。
    [
        { id: 'tapclose', name: '點空白處關閉視窗', desc: '點視窗外面的地方就關掉視窗', group: '遊戲介面' },
        { id: 'mobile', name: '手機版面', desc: '手機專用版面：底部分頁切換、浮動日誌、避開頂端橫幅', group: '遊戲介面' },
        { id: 'npclabel', name: '村莊名牌不出界', desc: '村莊裡站得靠邊的 NPC，名字不會被畫面邊緣切掉', group: '遊戲介面' },
        { id: 'mobname', name: '怪物名稱顯示', desc: '怪物名字要一直顯示、只在鎖定時顯示，還是滑過才顯示', group: '遊戲介面' },
        { id: 'statpts', name: '能力值來源分解', desc: '能力值旁列出「初始／升級／藥水」各給了多少點', group: '遊戲介面' },
        { id: 'itemsearch', name: '背包名稱搜尋', desc: '背包分頁加搜尋框，打字就找得到東西', group: '遊戲介面' },
        { id: 'invlist', name: '背包條列式', desc: '背包改成一行一件，比格子好找', group: '遊戲介面' },
        { id: 'warehouse', name: '倉庫擴充', desc: '倉庫裡穿不了的裝備標紅；手機長按看物品資料', group: '遊戲介面' },
        { id: 'eqlist', name: '裝備條列式', desc: '裝備分頁改成部位條列，不用看 12 格圖', group: '遊戲介面' },
        { id: 'npclist', name: '村莊 NPC 條列式', desc: '村莊改成 NPC 清單，點名字就能互動', group: '遊戲介面' },
        { id: 'mapbar', name: '手機地圖列壓縮', desc: '冒險地圖的標題列壓成兩排，少佔畫面', group: '遊戲介面' },
        { id: 'battlehud', name: '手機戰鬥狀態列', desc: '戰鬥畫面上方多一排：等級、防禦、金幣、經驗與血魔量', group: '遊戲介面' },
        { id: 'nozoom', name: '手機取消雙擊放大', desc: '連點兩下不會放大畫面（兩指縮放照常）', group: '遊戲介面' },
        { id: 'statusicon', name: '手機狀態圖示縮小', desc: '手機上的狀態圖示縮成一半，不會蓋住戰鬥畫面', group: '遊戲介面' },
        { id: 'battlebuffs', name: '手機戰鬥狀態欄', desc: '戰鬥框下方直接顯示增益、異常與魔物追蹤', group: '遊戲介面' },
        { id: 'skillbar', name: '手機主動技能列', desc: '戰鬥框下方多一列已學會的手動技能按鈕（絕對屏障、迷魅術…），不用切到技能分頁', group: '遊戲介面' },
        { id: 'petui', name: '手機寵物保管排版', desc: '寵物保管的每一列改成兩排，一次看得到好幾隻', group: '遊戲介面' },
        { id: 'trackinfo', name: '狀態欄補充', desc: '「狀態」欄補上魔物追蹤剩餘時間、龍裔、血盟 Buff、生效中的套裝，以及找王／迴避王', group: '遊戲介面' },
        { id: 'relicguard', name: '快速廢品不選遺物', desc: '背包「快速廢品」按全選時自動跳過遺物', group: '遊戲介面' },
        { id: 'junkmgr', name: '廢品標記管理', desc: '查看與刪除「以後掉到同款就自動標廢品」的記憶（自動化分頁開啟）', group: '遊戲介面' },
        { id: 'backnav', name: '手機返回鍵', desc: '按返回鍵回上一層，不會直接關掉 App', group: '遊戲介面' },
        { id: 'dex', name: '怪物/掉落查詢', desc: '查怪物、地圖與掉落物（遊戲中設定頁的「🔌 外掛」列）', group: '查詢與資訊', def: false },
        { id: 'history', name: '離線掛機紀錄', desc: '在設定選單查最近幾次的離線結算紀錄', group: '查詢與資訊', parent: 'offline' },
        { id: 'diag', name: '快取診斷', desc: '回報問題時用的取證工具（設定選單）', group: '查詢與資訊', parent: 'storage' },
        { id: 'autobuy', name: '自動購買魔法屏障', desc: '魔法屏障卷軸用完自動買', group: '自動化' },
        { id: 'training', name: '木人場', desc: '木人場：實際打一段時間量出你的每秒傷害（自動化分頁開啟）', group: '遊戲玩法' },
        { id: 'bossring', name: '傳送控制戒指自動找 BOSS', desc: '傳送控制戒指放背包就生效（不必裝備）；場上沒 BOSS 就自動用瞬移卷軸找一隻', group: '自動化' },
        { id: 'bossavoid', name: '只迴避指定頭目', desc: '「迴避頭目(瞬移卷軸)」原本全部都躲；開了可以每張地圖各自挑要躲哪幾隻', group: '自動化' },
        // ⚠️ 名稱避開「解壓」「壓縮」字樣:玩家會誤判成壓縮功能而關掉它（回報過）。
        { id: 'lzcache', name: '資料記憶體暫存', desc: '戰鬥比較不卡、離線結算快好幾倍；會多用一點記憶體', group: '系統與其他' },
        { id: 'reissueid', name: '換發身分證', desc: '⚠️ 把複製出來的角色換成各自獨立的身分；會改寫全部存檔且無法復原', group: '存檔工具', parent: 'storage' },
        { id: 'pwa', name: '安裝成 App / 離線快取', desc: '把遊戲裝成手機／電腦上的 App，圖片存在本機不用每次重抓', group: '系統與其他' },
        { id: 'storage', name: '設定選單', desc: '首頁的 ⚙ 設定選單，可檢查存檔大小', group: '系統與其他' },
        { id: 'synccompress', name: '存檔即時壓縮', desc: '避免存檔爆掉害角色或倉庫消失；代價是存檔時多花一點時間', group: '系統與其他', def: false },
        { id: 'powersave', name: '省電模式', desc: '省電選項：降低畫面更新頻率、關動畫、關光暈濾鏡、關特效與音效', group: '系統與其他' },
        { id: 'skin', name: '首頁外掛入口/資訊', desc: '整理首頁的外掛入口，並顯示原作者連結與最後同步原版的時間', group: '系統與其他' },
        { id: 'offline', name: '離線快速結算', desc: '關掉遊戲回來自動結算掛機收益', group: '遊戲玩法' },
        { id: 'dograce', name: '賽狗場', desc: '賭哪隻狗第一，押金幣或龍鑽、中了自動入袋（自動化分頁開啟）', group: '遊戲玩法' },
        { id: 'anyclass', name: '裝備不限職業/性別', desc: '所有裝備都不看職業與性別，任何角色都能裝；關掉後穿不上的會自動卸回背包', group: '遊戲玩法', def: false }
    ].forEach(api.register);

    // 開啟彈窗當下：實測非官方橫幅(#_orig_pbar)高度,直接寫進 overlay 的 padding-top,讓卡片一定落在橫幅下方。
    //   不依賴 afk-mobile 非同步量測的 --orig-bar-h(橫幅由 gameLoop 晚注入、量測靠每秒 interval,面板開太早會讀到 0 而被蓋)。
    function bannerPadPx() {
        try { var b = document.getElementById('_orig_pbar'); if (b) { var h = b.getBoundingClientRect().height; if (h > 0) return Math.ceil(h) + 14; } } catch (e) {}
        return 14;
    }
    function applyBannerPad(ov) { ov.style.paddingTop = bannerPadPx() + 'px'; }
    api.applyBannerPad = applyBannerPad;   // 供其他外掛面板(傳統/省電…)共用

    // ── 開關面板 ─────────────────────────────────────────────
    function openPanel() {
        if (document.getElementById('afk-toggles-overlay')) return;
        var ov = document.createElement('div');
        ov.id = 'afk-toggles-overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.66);display:flex;align-items:flex-start;justify-content:center;padding:14px 12px 12px;';
        applyBannerPad(ov);
        // 遊戲的橫幅可能比面板晚插進來 → 開著的期間每秒再量一次，標題列與「關閉」才不會被後到的橫幅蓋住
        var padTimer = setInterval(function () { if (!ov.parentNode) { clearInterval(padTimer); return; } applyBannerPad(ov); }, 1000);
        // （以下原註解）開啟當下實測橫幅高度直接設 padding-top（不靠 afk-mobile 的非同步 --orig-bar-h，避免量測未就緒時被橫幅蓋住）
        var card = document.createElement('div');
        // 直向 flex:頭與尾(重新整理鈕)固定,只有中間清單區捲動 → 項目再多,底部按鈕永遠在畫面上
        card.style.cssText = 'background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:14px;max-width:560px;width:100%;max-height:calc(100vh - var(--orig-bar-h,0px) - 30px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.6);';
        // iOS Safari 的 vh 含工具列高度,卡片底(重新整理鈕)會被切出可視範圍 → 覆寫成 dvh+safe-area(舊瀏覽器不認 dvh 就留上面 vh 版)。
        // 頂端扣「開啟當下實測」的橫幅 pad(與 applyBannerPad 同源),不用 --orig-bar-h(非同步、可能還是 0)。
        card.style.maxHeight = 'calc(100dvh - ' + (bannerPadPx() + 16) + 'px - env(safe-area-inset-bottom, 0px))';

        var groups = {};
        registry.forEach(function (r) { if (!r.parent) (groups[r.group] = groups[r.group] || []).push(r); });
        registry.forEach(function (r) {   // 子選項緊接排在自己的父項後面（同一組內）
            if (!r.parent) return;
            var pr = find(r.parent), g = groups[(pr && pr.group) || r.group];
            if (!g) { (groups[r.group] = groups[r.group] || []).push(r); return; }
            var at = -1;
            for (var i = 0; i < g.length; i++) if (g[i].id === r.parent) { at = i; break; }
            if (at < 0) g.push(r); else g.splice(at + 1, 0, r);
        });

        var html = '<div style="padding:16px 18px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;gap:12px;flex:0 0 auto;">'
            + '<div><div style="font-size:17px;font-weight:700;">🎚️ 外掛開關</div>'
            + '<div style="font-size:12px;color:#94a3b8;margin-top:3px;">某個外掛出問題時，先關掉它就能用原版繼續玩，作者修好再打開。改完按「重新整理」生效。</div></div>'
            + '<button id="afk-tg-close" style="flex:none;background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:8px;padding:6px 12px;cursor:pointer;">關閉</button></div>'
            // 工具列：搜尋 ＋「只看我改過的」（玩家關掉某項之後往往忘了自己關過什麼（回報過），要他從幾十項裡捲著找出來不合理）
            //   ⚠ 搜尋框 font-size 一定要 ≥16px：iOS Safari 對小於 16px 的輸入框會在 focus 時自動放大整頁，之後縮不回去。
            + '<div style="padding:9px 14px 0;flex:0 0 auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
            + '<input id="afk-tg-search" type="search" placeholder="搜尋外掛名稱或說明"'
            + ' style="flex:1 1 150px;min-width:0;background:#0b1222;border:1px solid #334155;color:#e2e8f0;border-radius:8px;padding:6px 10px;font-size:16px;font-family:inherit;">'
            + '<button id="afk-tg-onlychanged"'
            + ' style="flex:none;background:#1e293b;border:1px solid #334155;color:#cbd5e1;border-radius:8px;padding:6px 11px;font-size:12px;cursor:pointer;font-family:inherit;">'
            + '只看我改過的（' + changedCount() + '）</button></div>'
            + '<div id="afk-tg-list" style="padding:10px 14px;flex:1 1 auto;overflow-y:auto;min-height:0;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;">'
            + '<div id="afk-tg-empty" style="display:none;color:#94a3b8;padding:14px;text-align:center;">目前全部都是預設值。</div>';

        if (!registry.length) {
            html += '<div style="color:#94a3b8;padding:14px;text-align:center;">目前沒有任何外掛登錄開關。</div>';
        } else {
            Object.keys(groups).forEach(function (g) {
                html += '<div data-tggroup="' + esc(g) + '" style="font-size:12px;color:#7dd3fc;font-weight:700;margin:12px 4px 6px;">' + esc(g) + '</div>';
                groups[g].forEach(function (r) {
                    var on = api.enabled(r.id);
                    html += '<label data-tgrow="' + esc(r.id) + '" data-tggrp="' + esc(g) + '" data-tgchanged="' + (isChanged(r) ? '1' : '0') + '"'
                        + ' style="display:flex;align-items:center;gap:12px;padding:9px 10px;border:1px solid #1e293b;border-radius:10px;margin-bottom:6px;background:#0b1222;' + (r.parent ? 'margin-left:22px;' : '')
                        + (r.locked ? 'cursor:not-allowed;opacity:.6;' : 'cursor:pointer;') + '">'
                        + '<input type="checkbox" data-tgid="' + esc(r.id) + '" ' + (on ? 'checked' : '') + (r.locked ? ' disabled' : '')
                        + ' style="width:18px;height:18px;flex:none;accent-color:#38bdf8;">'
                        + '<span style="flex:1;min-width:0;"><span style="font-weight:600;">' + esc(r.name) + '</span>'
                        + (r.locked ? '<span style="font-size:11px;color:#fbbf24;margin-left:6px;">暫停使用</span>' : '')
                        + (r.desc ? '<span style="display:block;font-size:11px;color:#94a3b8;margin-top:2px;">' + esc(r.desc) + '</span>' : '')
                        + (r.locked ? '<span style="display:block;font-size:11px;color:#fbbf24;margin-top:2px;">' + esc(r.locked) + '</span>' : '')
                        + '</span></label>';
                });
            });
        }
        html += '</div>'
            + '<div id="afk-tg-note" style="display:none;padding:10px 16px;color:#fbbf24;font-size:13px;border-top:1px solid #1e293b;flex:0 0 auto;">已變更，按下方「重新整理」套用。</div>'
            + '<div style="padding:12px 16px;border-top:1px solid #1e293b;display:flex;gap:10px;justify-content:flex-end;flex:0 0 auto;">'
            + '<button id="afk-tg-reset" style="background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:8px;padding:8px 14px;cursor:pointer;">全部恢復預設</button>'
            + '<button id="afk-tg-reload" style="background:#0ea5e9;border:none;color:#04263a;font-weight:700;border-radius:8px;padding:8px 16px;cursor:pointer;">重新整理</button></div>';

        card.innerHTML = html;
        ov.appendChild(card);
        document.body.appendChild(ov);

        function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
        ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
        card.querySelector('#afk-tg-close').addEventListener('click', close);
        var note = card.querySelector('#afk-tg-note');
        card.querySelectorAll('input[data-tgid]').forEach(function (cb) {
            cb.addEventListener('change', function () { api.set(cb.getAttribute('data-tgid'), cb.checked); note.style.display = 'block'; });
        });
        card.querySelector('#afk-tg-reset').addEventListener('click', function () {
            registry.forEach(function (r) { try { localStorage.removeItem(LS + r.id); } catch (e) {} });
            lsCache = {};
            card.querySelectorAll('input[data-tgid]').forEach(function (cb) { cb.checked = api.enabled(cb.getAttribute('data-tgid')); });
            note.style.display = 'block';
        });
        card.querySelector('#afk-tg-reload').addEventListener('click', function () {
            try { location.reload(); } catch (e) { close(); }
        });

        // ── 篩選：搜尋 ＋ 只看我改過的（兩者同時生效，共用同一支 applyFilter）──
        // 勾選當下不重算（剛按到的東西會在眼前消失）；只有按鈕切換／打字才重算。
        var onlyChanged = false, query = '', ocBtn = card.querySelector('#afk-tg-onlychanged');
        var searchBox = card.querySelector('#afk-tg-search'), emptyEl = card.querySelector('#afk-tg-empty');

        function matchQuery(r) {   // 空白分隔＝全部都要中；名稱／說明／分類／id 都算
            if (!query) return true;
            var hay = ((r.name || '') + ' ' + (r.desc || '') + ' ' + (r.group || '') + ' ' + r.id).toLowerCase();
            var toks = query.split(/\s+/);
            for (var i = 0; i < toks.length; i++) if (toks[i] && hay.indexOf(toks[i]) < 0) return false;
            return true;
        }
        function applyFilter() {
            var vis = {};
            registry.forEach(function (r) { vis[r.id] = (!onlyChanged || isChanged(r)) && matchQuery(r); });
            // 子選項被搜到 → 父項一起顯示：縮排那列孤零零掛著看不出是誰的子項，也看不出「父項關掉它就失效」。
            //   只在搜尋時做——「只看我改過的」原本就刻意只列改過的，不能被這條拉回沒改過的父項。
            if (query && !onlyChanged) registry.forEach(function (r) { if (r.parent && vis[r.id]) vis[r.parent] = true; });
            var n = 0;
            card.querySelectorAll('label[data-tgrow]').forEach(function (row) {
                var show = !!vis[row.getAttribute('data-tgrow')];
                row.style.display = show ? 'flex' : 'none';   // ⚠ 不可設成 ''：那會把行內樣式的 display:flex 一起清掉，整列版面散開
                if (show) n++;
            });
            card.querySelectorAll('[data-tggroup]').forEach(function (h) {   // 整組都被濾掉就連標題一起收
                var g = h.getAttribute('data-tggroup');
                var any = [].slice.call(card.querySelectorAll('label[data-tggrp="' + g.replace(/"/g, '\\"') + '"]'))
                    .some(function (row) { return row.style.display !== 'none'; });
                h.style.display = any ? '' : 'none';
            });
            if (emptyEl) {
                emptyEl.textContent = query ? '找不到符合的外掛。' : '目前全部都是預設值。';
                emptyEl.style.display = (registry.length && n === 0) ? '' : 'none';
            }
        }

        ocBtn.addEventListener('click', function () {
            onlyChanged = !onlyChanged;
            ocBtn.textContent = onlyChanged ? '看全部（改過 ' + changedCount() + ' 項）' : '只看我改過的（' + changedCount() + '）';
            ocBtn.style.background = onlyChanged ? '#0e7490' : '#1e293b';
            ocBtn.style.color = onlyChanged ? '#e0f2fe' : '#cbd5e1';
            applyFilter();
        });
        if (searchBox) searchBox.addEventListener('input', function () {
            query = String(searchBox.value || '').trim().toLowerCase();
            applyFilter();
        });
    }

    // 「改過」＝存過設定而且跟預設不同。用存進去的值判斷、不是用 enabled()：
    //   子選項在父項關掉時 enabled() 一律是 false，拿它比就會把玩家沒碰過的東西也算成改過。
    function isChanged(r) {
        var v = null;
        try { v = localStorage.getItem(LS + r.id); } catch (e) { return false; }
        if (v === null) return false;
        return (v === '1') !== !!r.def;
    }
    function changedCount() {
        var n = 0;
        registry.forEach(function (r) { if (isChanged(r)) n++; });
        return n;
    }

    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    // 🚪 玩家沒有任何入口打開這個面板：2026-10-14 站長拿掉左上角「🎚️ 外掛」按鈕，
    //    2026-10-15 站長再拿掉網址入口（?plugins / #plugins），不要有任何連結能打開。
    //    只剩站長自己除錯用：瀏覽器主控台執行 AFK_TOGGLES.openPanel()。外掛壞了只能改程式碼修。
    try { console.log('[AFK-toggles] ready'); } catch (e) {}
})();
