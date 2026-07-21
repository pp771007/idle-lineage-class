/**
 * afk-lzcache.js — 存檔解壓結果快取（同一份壓縮字串只解一次）
 *
 * 為什麼需要：核心把幾包大資料以 LZString 壓在 localStorage（血盟狀態、存檔、圖鑑…），
 * 而 killMob → pvpOnKillMob → npcClanMaybeStartGroupBattle 會在擲骰「要不要開血盟團戰」之前
 * 先 npcClanGetWorld() 讀整包血盟狀態——也就是**每殺一隻怪就完整解壓一次**。線上如此，離線
 * 結算更把它放大成瓶頸：24 小時結算 6 萬多隻怪 ≈ 10 萬次解壓，佔總耗時近八成。
 *
 * 做法：包住 LZString.decompressFromUTF16，用「壓縮字串 → 解壓字串」的 LRU 快取。
 *   兩端都是不可變字串、函式本身是純函式 → 快取不可能改變任何遊戲行為；
 *   有人寫過那個 key（localStorage 內容變了）→ 壓縮字串不同 → 自動未命中重算，不需失效通知。
 *
 * 實測（真實存檔 mageLv97 sunrise_east，24h 離線結算）：43.3s → 10.9s。
 * 另跑過對照組：用快取值但每次仍真解壓一遍比對，近 19 萬次比對 0 次不符。
 */
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('lzcache')) return;   // 🎚️ 外掛開關

    if (typeof LZString === 'undefined' || typeof LZString.decompressFromUTF16 !== 'function') {
        console.warn('[AFK-lzcache] 找不到 LZString.decompressFromUTF16，快取停用（遊戲照常運作）。');
        return;
    }
    if (LZString.decompressFromUTF16.__afkLz) return;   // 冪等：重複載入不疊包

    // 上限以「字元數」計而非筆數：一筆存檔可能幾十萬字元，用筆數當上限等於沒有上限。
    var MAX_CHARS = 3000000;   // 全部快取內容合計上限（≈ 6MB 記憶體）
    var MAX_ENTRY = 1200000;   // 單筆超過就不收（不讓一筆大檔把整個快取擠光）

    var cache = new Map();     // 壓縮字串 → 解壓字串（Map 保留插入序 → 拿它做 LRU）
    var chars = 0;
    var hits = 0, misses = 0;

    var orig = LZString.decompressFromUTF16.bind(LZString);
    LZString.decompressFromUTF16 = function (s) {
        if (typeof s !== 'string' || !s) return orig(s);
        if (cache.has(s)) {
            hits++;
            var v = cache.get(s);
            cache.delete(s); cache.set(s, v);   // 移到最新端（LRU）
            return v;
        }
        misses++;
        var out = orig(s);
        var size = (s.length + (typeof out === 'string' ? out.length : 0));
        if (size <= MAX_ENTRY) {
            while (chars + size > MAX_CHARS && cache.size) {
                var oldK = cache.keys().next().value, oldV = cache.get(oldK);
                chars -= oldK.length + (typeof oldV === 'string' ? oldV.length : 0);
                cache.delete(oldK);
            }
            cache.set(s, out);
            chars += size;
        }
        return out;
    };
    LZString.decompressFromUTF16.__afkLz = true;

    window.AFK_LZCACHE = {   // 供 afk-diag / 問題回報取證（唯讀）
        stats: function () { return { hits: hits, misses: misses, entries: cache.size, chars: chars }; },
        clear: function () { cache.clear(); chars = 0; }
    };

    if (window.AFK_TOGGLES) AFK_TOGGLES.register({
        id: 'lzcache',
        name: '存檔解壓快取',
        desc: '同一份壓縮資料只解壓一次。核心每殺一隻怪都會重讀整包血盟狀態，開著可大幅減少卡頓、離線結算約快 4 倍。',
        group: '系統與其他',
        def: true
    });

    console.log('[AFK-lzcache] hooks OK');
})();
