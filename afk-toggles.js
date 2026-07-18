/**
 * afk-toggles.js — 外掛開關中樞（所有 afk-* 外掛的地基，必須「最先」載入）
 *
 * 目的：核心永遠是原作者原版；我們的功能全是外掛疊上去。外掛靠「包核心函式」運作，
 *   上游一改名就可能斷。此開關讓「某支外掛壞掉時，玩家自己在首頁關掉它 → 遊戲回到原版
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

    function find(id) { for (var i = 0; i < registry.length; i++) if (registry[i].id === id) return registry[i]; return null; }

    var api = {
        // 外掛自我登錄（重複 id 忽略）
        register: function (spec) {
            if (!spec || !spec.id || find(spec.id)) return;
            registry.push({
                id: spec.id,
                name: spec.name || spec.id,
                desc: spec.desc || '',
                group: spec.group || '其他',
                def: spec.def !== false   // 預設開；傳 def:false 才預設關
            });
        },
        // 這支外掛現在是否啟用（讀 localStorage，未設過→用預設；讀不到 localStorage→啟用）
        enabled: function (id) {
            var r = find(id), def = r ? r.def : true;
            try { var v = localStorage.getItem(LS + id); return v === null ? def : v === '1'; }
            catch (e) { return def; }
        },
        set: function (id, on) { try { localStorage.setItem(LS + id, on ? '1' : '0'); } catch (e) {} },
        list: function () { return registry.slice(); },
        openPanel: openPanel
    };
    window.AFK_TOGGLES = api;

    // ── 內建外掛目錄：先自動登錄，面板一定列得出來（就算某支外掛載入失敗也能被關/開）──
    //   id = 外掛檔名去掉 afk- 前綴；def:false 才預設關。infra(afk-ui/extradata/sw/toggles)刻意不列＝不可關。
    [
        { id: 'mobile', name: '手機版面', desc: '底部導覽/浮動日誌/手機提示 toast/橫幅讓位；版面內部用上游原版', group: '遊戲介面' },
        { id: 'mobname', name: '怪物名稱顯示', desc: '怪物名稱常駐/鎖定中/hover 三選一', group: '遊戲介面' },
        { id: 'statpts', name: '能力值來源分解', desc: '能力值面板顯示始/升/藥/總點數來源', group: '遊戲介面' },
        { id: 'itemsearch', name: '背包名稱搜尋', desc: '背包武器/防具/道具分頁加搜尋框', group: '遊戲介面' },
        { id: 'invlist', name: '背包條列式', desc: '背包改成一行一物品（取代上游格狀皮膚）；桌機/手機通用', group: '遊戲介面' },
        { id: 'dex', name: '怪物/掉落查詢', desc: '首頁入口：查怪名/地圖/掉落物', group: '查詢與資訊' },
        { id: 'wiki', name: '小百科', desc: '首頁入口：職業/裝備/機制/地圖等資料', group: '查詢與資訊' },
        { id: 'slotinfo', name: '選角掛機資訊', desc: '選存檔位顯示掛哪張圖、掛多久', group: '查詢與資訊' },
        { id: 'history', name: '離線掛機紀錄', desc: '設定選單：最近離線結算紀錄', group: '查詢與資訊' },
        { id: 'diag', name: '快取診斷', desc: '設定選單：回報問題用的取證工具', group: '查詢與資訊' },
        { id: 'autobuy', name: '自動購買魔法屏障', desc: '魔法屏障卷軸耗盡自動補貨（肉已被上游移除；箭矢/藥水上游原生已有）', group: '自動化' },
        { id: 'training', name: '木人場', desc: '自動化面板：量測真實 DPS', group: '自動化' },
        { id: 'dograce', name: '奇岩賽狗場', desc: '奇岩城的賭狗小遊戲（浮動球入口，只賺金幣）', group: '自動化' },
        { id: 'bossring', name: '傳送控制戒指自動找 BOSS', desc: '持傳送控制戒指時，場上無 BOSS 自動用瞬移卷軸召來（線上前景；排名/裂痕/軍王/攻城不套用）', group: '自動化' },
        { id: 'backnav', name: '手機返回鍵', desc: '子畫面按返回回首頁而非關 App（僅手機）', group: '系統與其他' },
        { id: 'pwa', name: 'PWA 安裝/離線', desc: '安裝成 App、圖片離線快取對帳', group: '系統與其他' },
        { id: 'storage', name: '設定選單', desc: '首頁 ⚙ 設定鈕與存檔大小檢查', group: '系統與其他' },
        { id: 'analytics', name: '匿名人數統計', desc: '只在正式站台送、不用 cookie', group: '系統與其他' },
        { id: 'powersave', name: '省電模式', desc: '首頁設定→關戰鬥動畫/降畫面更新頻率（補回上游沒有的 2 個省電選項）', group: '系統與其他' },
        { id: 'skin', name: '首頁品牌/公告', desc: '加掛版標記、跑馬燈、外掛入口收納', group: '系統與其他' },
        { id: 'syncinfo', name: '首頁版本資訊', desc: '顯示原作者與加掛版版本號', group: '系統與其他' },
        { id: 'offline', name: '離線快速結算', desc: '關掉遊戲後回來自動結算掛機收益', group: '核心玩法（不建議關）' },
        { id: 'traditional', name: '傳統模式(偽)／自動衝裝', desc: '打到/製作/潘朵拉的裝備自帶隨機強化值（商店除外），每角色各自開關', group: '核心玩法（不建議關）' }
    ].forEach(api.register);

    // ── 開關面板 ─────────────────────────────────────────────
    function openPanel() {
        if (document.getElementById('afk-toggles-overlay')) return;
        var ov = document.createElement('div');
        ov.id = 'afk-toggles-overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.66);display:flex;align-items:flex-start;justify-content:center;padding:calc(var(--orig-bar-h,0px) + 14px) 12px 12px;';
        var card = document.createElement('div');
        card.style.cssText = 'background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:14px;max-width:560px;width:100%;max-height:calc(100vh - var(--orig-bar-h,0px) - 30px);overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.6);';

        var groups = {};
        registry.forEach(function (r) { (groups[r.group] = groups[r.group] || []).push(r); });

        var html = '<div style="padding:16px 18px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;gap:12px;">'
            + '<div><div style="font-size:17px;font-weight:700;">🎚️ 外掛開關</div>'
            + '<div style="font-size:12px;color:#94a3b8;margin-top:3px;">某個外掛出問題時，先關掉它就能用原版繼續玩，作者修好再打開。改完按「重新整理」生效。</div></div>'
            + '<button id="afk-tg-close" style="flex:none;background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:8px;padding:6px 12px;cursor:pointer;">關閉</button></div>'
            + '<div style="padding:10px 14px;">';

        if (!registry.length) {
            html += '<div style="color:#94a3b8;padding:14px;text-align:center;">目前沒有任何外掛登錄開關。</div>';
        } else {
            Object.keys(groups).forEach(function (g) {
                html += '<div style="font-size:12px;color:#7dd3fc;font-weight:700;margin:12px 4px 6px;">' + esc(g) + '</div>';
                groups[g].forEach(function (r) {
                    var on = api.enabled(r.id);
                    html += '<label style="display:flex;align-items:center;gap:12px;padding:9px 10px;border:1px solid #1e293b;border-radius:10px;margin-bottom:6px;cursor:pointer;background:#0b1222;">'
                        + '<input type="checkbox" data-tgid="' + esc(r.id) + '" ' + (on ? 'checked' : '') + ' style="width:18px;height:18px;flex:none;accent-color:#38bdf8;">'
                        + '<span style="flex:1;min-width:0;"><span style="font-weight:600;">' + esc(r.name) + '</span>'
                        + (r.desc ? '<span style="display:block;font-size:11px;color:#94a3b8;margin-top:2px;">' + esc(r.desc) + '</span>' : '')
                        + '</span></label>';
                });
            });
        }
        html += '</div>'
            + '<div id="afk-tg-note" style="display:none;padding:10px 16px;color:#fbbf24;font-size:13px;border-top:1px solid #1e293b;">已變更，按下方「重新整理」套用。</div>'
            + '<div style="padding:12px 16px;border-top:1px solid #1e293b;display:flex;gap:10px;justify-content:flex-end;">'
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
            card.querySelectorAll('input[data-tgid]').forEach(function (cb) { cb.checked = api.enabled(cb.getAttribute('data-tgid')); });
            note.style.display = 'block';
        });
        card.querySelector('#afk-tg-reload').addEventListener('click', function () { try { location.reload(); } catch (e) { close(); } });
    }

    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    // ── 永遠可達的入口（逃生門）：左上角固定小按鈕（首頁 + 遊戲內都在；本按鈕不可被關）──
    //   位置讓開非官方橫幅（--orig-bar-h，由 afk-mobile 量測；無橫幅則為 0）。
    function injectEntry() {
        if (document.getElementById('afk-toggles-entry')) return true;
        if (!document.body) return false;
        var btn = document.createElement('button');
        btn.id = 'afk-toggles-entry';
        btn.textContent = '🎚️';
        btn.title = '外掛開關';
        btn.style.cssText = 'position:fixed;left:6px;top:calc(var(--orig-bar-h,0px) + 6px);z-index:100001;background:rgba(15,23,42,.82);border:1px solid #334155;color:#cbd5e1;border-radius:8px;padding:4px 8px;font-size:17px;line-height:1;cursor:pointer;';
        btn.addEventListener('click', openPanel);
        document.body.appendChild(btn);
        return true;
    }
    injectEntry();
    // 只在首頁顯示：進遊戲（#game-screen 顯示 / #main-menu 隱藏）就把左上角開關鈕藏起來。
    function syncEntryVisibility() {
        var btn = document.getElementById('afk-toggles-entry');
        if (!btn) { injectEntry(); btn = document.getElementById('afk-toggles-entry'); if (!btn) return; }
        // 以「遊戲畫面是否顯示」為準（最可靠）：game-screen 沒隱藏＝在遊戲中→藏開關鈕；否則(首頁/選角/創角)顯示。
        var gs = document.getElementById('game-screen');
        var inGame = gs && !gs.classList.contains('hidden');
        btn.style.display = inGame ? 'none' : '';
    }
    syncEntryVisibility();
    setInterval(syncEntryVisibility, 1000);
    try { console.log('[AFK-toggles] ready'); } catch (e) {}
})();
