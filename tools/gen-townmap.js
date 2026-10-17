#!/usr/bin/env node
// 村莊動態地圖資料生成工具（afk-townmap.js 讀的資料）
//
// 用法（在 repo 根目錄跑）：
//   node tools/gen-townmap.js --client "<天堂用戶端資料夾>" --emu "<模擬器資料夾>" [--maps 0,4]
//     讀用戶端 map/<圖>/*.s32、Tile.idx/.pak，模擬器 db/l1jdb.sql（mapids、npc、spawnlist_npc）、maps/<圖>.txt，
//     遊戲的 js/00-data.js（各村莊 NPC 名字）→
//     assets/townmap/towns.js（各村莊在哪張圖、起點、NPC 站位）
//     assets/townmap/m<圖>.js（每張圖的總表）＋ assets/townmap/m<圖>/（各區 r<x>_<y>.js、拼圖 p<頁>.png）
//     --maps：只重產這幾張圖的圖檔（towns.json、hunts.json 一律重產）；--no-build：只重算 towns.json、hunts.json，不產圖檔
//     能不能走照模擬器地圖檔（伺服器實際用的；說話之島村莊附近有 131 格跟用戶端不同，是伺服器那邊修過的）；
//       沒有地圖檔就從用戶端第 3 層換算（跟模擬器檔比對過，說話之島 512×512 格只差 142 格）。
//   node tools/gen-townmap.js --hero-only
//     → 只重量角色落腳點 assets/townmap/hero.js（換過 assets/classanim 的走路／待機幀後要重跑）
//   跑完記得 node scripts/gen-manifests.mjs（assets 有新圖要進對帳清單）。
//
// ── 用戶端格式（逆向結果）────────────────────────────────
// .s32（每檔 64×64 格）：
//   第 1 層：64 列 × 128 個 4 bytes [小塊編號][地磚組 uint16][0]，每格左右兩個半格（偶數＝左半、奇數＝右半）
//   第 2 層：uint16 筆數 × 6 bytes（此圖都是 0）
//   第 3 層：64×64 × 兩個 uint16 屬性 a、b；(a|b)&4＝安全區域。
//     能不能走是「邊」不是「格」：b&1＝往 x+1 那條邊過不去、a&1＝往 y-1 那條邊過不去
//     （＝模擬器地圖檔 maps/<id>.txt 的 0x01、0x02 反過來；0x04/0x08 是箭能不能過，0x10 安全區、0x20 戰鬥區）。
//     一步能不能走照模擬器 L1V1Map.isPassable（afk-townmap 的 canStep 照抄）。
//   第 4 層（物件）：uint32 群數；每群 uint16 index、uint16 count，之後 count 筆 7 bytes [半格x][y][圖層][小塊][地磚組 uint16][未知]
// .til：int32 小塊數 n、(n+1) 個 int32 位移、資料。每小塊＝半格（寬 24、高 23），16 位元 RGB555。
//   類型 bit0＝右半；bit1＝壓縮（逐列：段數，每段 跳過bytes/2、像素數、像素）；bit4＝半透明（物件的影子）。
//   不壓縮時是菱形半邊：第 r 列寬 r<=11 ? 2(r+1) : 2(23-r)，左半靠右、右半靠左。
// 投影（跟用戶端一樣）：格子 (x,y) 中心在 (24(x+y), 12(y-x))，x 往右上、y 往右下。物件也是半格小塊、同一套位置。
// 畫的順序：依「4×畫面列(y-x)＋圖層」排序，跟用戶端依圖層排的結果逐像素相同（量過）；圖層 ≤8 是貼地的（影子、花紋）。

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'assets', 'townmap');

// 能走的格子外還要有幾格地圖：角色走到海邊、鏡頭還置中時畫面不能露出沒資料的地方。需要 (畫面寬/48＋畫面高/24)/2 格：
//   桌機村莊畫面 800×450 → 18；手機天堂M介面整個螢幕 390×844 → 22。
const MARGIN = 23;
const BLOCK = 64;             // 用戶端一個 .s32 / .seg 是 64×64 格
// 一區 32×32 格、拼圖一頁 78×4 塊（2048×100）：量過大陸古魯丁村（進村莊先載畫面 ±22 格）——
//   區 64/頁 624 塊要載約 2.7 萬塊、區 32/頁 312 塊約 2.2 萬塊（理想下限 1.1 萬：頁裡難免混到別區的小塊）。區、頁再小就沒什麼差了。
const RS = 32;
const CS = 512;               // 地面分塊（畫面像素）
const BW = 24, BH = 23, CELL_W = 26, CELL_H = 25, PAGE_W = 2048;   // 小塊尺寸、拼圖格（含 1px 透明邊）
const COLS = Math.floor(PAGE_W / CELL_W), PAGE_ROWS = 4, PER = COLS * PAGE_ROWS;
const OFF = 64;               // 物件相對座標加的偏移（存成無號整數）

function arg(name) { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : null; }

// ── PNG（量角色落腳點用）──────────────────────────
function decodePNG(buf, withRGB) {   // 8bit、不交錯；回傳 { w, h, a: Uint8Array(每像素不透明度) }；withRGB 另回 rgb: Uint8Array(每像素 r,g,b)
    let p = 8, w = 0, h = 0, depth = 8, ct = 6, inter = 0, pal = null, trns = null; const idat = [];
    while (p < buf.length) {
        const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
        if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ct = d[9]; inter = d[12]; }
        else if (type === 'PLTE') pal = d; else if (type === 'tRNS') trns = d; else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break;
        p += 12 + len;
    }
    if (depth !== 8 || inter) throw new Error('不支援的 PNG（' + depth + 'bit／交錯）');
    const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct], stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), img = Buffer.alloc(stride * h);
    for (let y = 0; y < h; y++) {
        const ft = raw[y * (stride + 1)], s = y * (stride + 1) + 1, o = y * stride;
        for (let i = 0; i < stride; i++) {
            const a = i >= bpp ? img[o + i - bpp] : 0, b = y ? img[o - stride + i] : 0, c = (i >= bpp && y) ? img[o - stride + i - bpp] : 0;
            let v = raw[s + i];
            if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
            else if (ft === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += (pa <= pb && pa <= pc) ? a : pb <= pc ? b : c; }
            img[o + i] = v & 255;
        }
    }
    const al = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
        if (ct === 6) al[i] = img[i * 4 + 3];
        else if (ct === 4) al[i] = img[i * 2 + 1];
        else if (ct === 3) al[i] = trns && img[i] < trns.length ? trns[img[i]] : 255;
        else al[i] = 255;
    }
    if (!withRGB) return { w, h, a: al };
    const rgb = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
        if (ct === 6 || ct === 2) { const o = i * bpp; rgb[i * 3] = img[o]; rgb[i * 3 + 1] = img[o + 1]; rgb[i * 3 + 2] = img[o + 2]; }
        else if (ct === 3) { const k = img[i] * 3; rgb[i * 3] = pal[k]; rgb[i * 3 + 1] = pal[k + 1]; rgb[i * 3 + 2] = pal[k + 2]; }
        else { const g = img[i * bpp]; rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = g; }
    }
    return { w, h, a: al, rgb };
}

// ── .til / .s32 ──────────────────────────────────
function parseTil(b) {
    const n = b.readInt32LE(0), base = 4 + (n + 1) * 4, blocks = [];
    for (let i = 0; i < n; i++) blocks.push(base + b.readInt32LE(4 + i * 4));
    return { b, n, blocks };
}
function decodeBlock(til, i, semi) {
    const b = til.b; let p = til.blocks[i];
    const type = b[p++], px = new Uint8Array(BW * BH * 4);
    const put = (x, y, v) => { const k = (y * BW + x) * 4; px[k] = ((v >> 10) & 31) * 255 / 31 | 0; px[k + 1] = ((v >> 5) & 31) * 255 / 31 | 0; px[k + 2] = (v & 31) * 255 / 31 | 0; px[k + 3] = (semi && (type & 0x10)) ? 128 : 255; };
    if (type & 2) {
        const xo = b[p], yo = b[p + 1], h = b[p + 3]; p += 4;
        for (let r = 0; r < h; r++) {
            const segs = b[p++]; let x = xo;
            for (let s = 0; s < segs; s++) { x += b[p++] / 2; const c = b[p++]; for (let k = 0; k < c; k++) { put(x++, yo + r, b.readUInt16LE(p)); p += 2; } }
        }
    } else {
        for (let r = 0; r < BH; r++) {
            const n = r <= 11 ? 2 * (r + 1) : 2 * (23 - r), x0 = type & 1 ? 0 : BW - n;
            for (let k = 0; k < n; k++) { put(x0 + k, r, b.readUInt16LE(p)); p += 2; }
        }
    }
    return px;
}
// .seg＝舊格式（大陸還有約百個區塊只有 .seg）：同樣四層，欄位較窄——地磚 2 bytes [小塊][地磚組 uint8]、
//   第 2 層每筆 4 bytes、屬性 2 bytes [a][b]、物件 5 bytes [半格x][y][圖層][小塊][地磚組 uint8]（跟同區塊的 .s32 逐筆比對過）
function readS32(file) {
    const d = fs.readFileSync(file), seg = /\.seg$/i.test(file);
    const l1 = new Uint32Array(64 * 128);   // tile*256+sub
    for (let i = 0; i < 64 * 128; i++) l1[i] = seg ? d[i * 2 + 1] * 256 + d[i * 2] : d.readUInt16LE(i * 4 + 1) * 256 + d[i * 4];
    let o = 64 * 128 * (seg ? 2 : 4); o += 2 + d.readUInt16LE(o) * (seg ? 4 : 6);
    const attr = new Uint16Array(4096), pass = new Uint8Array(4096);
    for (let i = 0; i < 4096; i++) {
        const a = seg ? d[o + i * 2] : d.readUInt16LE(o + i * 4), b = seg ? d[o + i * 2 + 1] : d.readUInt16LE(o + i * 4 + 2);
        attr[i] = a | b; pass[i] = (b & 1 ? 0 : 1) | (a & 1 ? 0 : 2);   // 換成模擬器地圖檔的 0x01、0x02
    }
    o += seg ? 8192 : 16384;
    const n4 = d.readUInt32LE(o), objs = [], sz = seg ? 5 : 7; o += 4;
    for (let k = 0; k < n4; k++) {
        const cnt = d.readUInt16LE(o + 2); o += 4;
        for (let j = 0; j < cnt; j++) { objs.push({ x: d[o], y: d[o + 1], layer: d[o + 2], key: (seg ? d[o + 4] : d.readUInt16LE(o + 4)) * 256 + d[o + 3] }); o += sz; }
    }
    return { l1, attr, pass, objs };
}
// 模擬器地圖檔：一列一個 y、逗號分隔每個 x 的值（0x03 能不能走；0x30：0x10 安全區、0x20 戰鬥區，同 L1J V1Map）
function readPassTxt(file, W, H) {
    const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l.trim() && l[0] !== '#');
    if (rows.length < H) throw new Error(file + ' 只有 ' + rows.length + ' 列，要 ' + H);
    const pass = new Uint8Array(W * H), zone = new Uint8Array(W * H);
    rows.slice(0, H).forEach((l, y) => l.split(',').slice(0, W).forEach((v, x) => { pass[y * W + x] = +v & 3; zone[y * W + x] = (+v & 0x30) >> 4; }));
    return { pass, zone };
}


// ── 用戶端封包、模擬器資料庫、遊戲村莊表 ─────────────────
// Tile.idx：int32 筆數，每筆 28 bytes（位移 uint32、檔名 20 bytes、大小 int32），未加密；Tile.pak 照位移讀
function openPak(dir, name) {
    const b = fs.readFileSync(path.join(dir, name + '.idx')), n = b.readInt32LE(0), idx = new Map();
    for (let i = 0; i < n; i++) {
        const o = 4 + i * 28;
        idx.set(b.toString('latin1', o + 4, o + 24).replace(/\0.*$/, '').toLowerCase(), { off: b.readUInt32LE(o), size: b.readInt32LE(o + 24) });
    }
    const fd = fs.openSync(path.join(dir, name + '.pak'), 'r');
    return file => {
        const e = idx.get(file.toLowerCase()); if (!e) return null;
        const buf = Buffer.alloc(e.size); fs.readSync(fd, buf, 0, e.size, e.off); return buf;
    };
}
// l1jdb.sql（MySQL dump）：取一張表的資料列（INSERT INTO `t` VALUES (...),(...);），值一律字串/數字照原樣
function sqlTable(text, name) {
    const ci = text.indexOf('CREATE TABLE `' + name + '`');
    if (ci < 0) throw new Error('l1jdb.sql 沒有資料表 ' + name);
    const cols = [...text.slice(ci, text.indexOf(';', ci)).matchAll(/^\s*`([^`]+)`/gm)].map(m => m[1]);
    const rows = [], re = new RegExp('INSERT INTO `' + name + '`[^V]*VALUES\\s*', 'g');
    let m;
    while ((m = re.exec(text))) {
        let p = re.lastIndex;
        while (text[p] === '(') {
            p++; const row = []; let cur = '', inStr = false;
            for (;;) {
                const c = text[p];
                if (inStr) { if (c === '\\') { cur += text[p + 1]; p += 2; continue; } if (c === "'") inStr = false; else cur += c; p++; continue; }
                if (c === "'") { inStr = true; p++; continue; }
                if (c === ',' || c === ')') { row.push(cur.trim()); cur = ''; p++; if (c === ')') break; continue; }
                cur += c; p++;
            }
            rows.push(Object.fromEntries(cols.map((c, i) => [c, row[i]])));
            if (text[p] === ',') p++;
            while (/\s/.test(text[p] || '')) p++;
        }
        re.lastIndex = p;
    }
    return rows;
}
// 遊戲資料（js/00-data.js 的 towns: {...}、mobs: {...}、maps: {...} 物件字面值，原樣取出來）
function gameData(key) {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'js', '00-data.js'), 'utf8'), st = src.indexOf(key + ': {');
    if (st < 0) throw new Error('js/00-data.js 找不到 ' + key);
    let d = 0, j = st + key.length + 1;
    for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && !--d) break; }
    return eval('(' + src.slice(st + key.length + 1, j + 1) + ')');
}
const gameTowns = () => gameData('towns');

// ── 狩獵地圖 → 用戶端地圖、怪物重生點 ─────────────────────────
// 遊戲的狩獵地圖（DB.maps）對到哪張用戶端地圖：野外的怪（妖魔、狼）到處都有，自動判斷常認錯，一張一張指定
//   （照地名對模擬器 mapids；地名對不上的看怪物池在模擬器重生表上集中在哪張圖）。
//   數字＝整張圖照模擬器重生表放怪；A(圖)＝大地圖（大陸、島）只取這張遊戲地圖的怪最集中的一塊（AREA 格見方）。
//   重生點＝模擬器 spawnlist 在那張圖上、怪物名字對得到這張遊戲地圖怪物池的那些；
//   怪物池裡模擬器沒放的（或整張圖都沒資料）在角色走得到的地方補上（placeHunt）。
//   沒列的＝對不到用戶端地圖（日出之國、隱藏區域）或沒有一般怪（攻城、純頭目房），照原本畫面。
const A = map => ({ map, area: 1 });
const HUNT_MAPS = {
    talking_island: 0, training: A(0), talking_island_port: A(0),
    silver_knight: A(4), zone_01: A(4), elf_forest: A(4), gludio: A(4), windwood: A(4), desert: A(4), kent: A(4),
    dragon_valley: A(4), fire_dragon: A(4), giran: A(4), heine: A(4), twilight_mt: A(4), mirror_forest: A(4),
    zone_02: A(4), zone_03: A(4), zone_04: A(4), zone_05: A(4),
    pirate_wild: 440, pirate_dungeon: 441, silent_outer: 304, elf_grave: 430, hidden_cave: 400, giant_tomb: A(400), demon_temple: 410,
    shadow_temple: 522, dream_island: 303, windwood_dungeon: 23,
    crystal_cave1: 72, crystal_cave2: 73, crystal_cave3: 74,
    zone_06: 7, zone_07: 8, zone_08: 9, zone_09: 10, zone_10: 11, zone_11: 12, zone_12: 13,   // 古魯丁地監＝模擬器「大陸地監」
    zone_13: 1, zone_14: 2,                                                                 // 說話之島地監＝「冒險洞窟」
    zone_15: 19, zone_16: 20, zone_17: 21, zone_18: 53, zone_19: 54, zone_20: 55, zone_21: 56,
    zone_22: 25, zone_23: 26, zone_24: 27, zone_25: 28,
    zone_26: 30, zone_27: 31, zone_28: 32, zone_29: 33, zone_30: 35, zone_31: 36,
    zone_32: 49, zone_33: 50, hidden_antqueen: 51,                                          // 巨蟻洞穴：照怪物分佈
    zone_34: 59, zone_35: 60, zone_36: 61, eva_kingdom: 253,
    zone_37: 78, zone_38: 79, zone_39: 80, zone_40: 81, zone_41: 82,
    rastabad_cave1: 307, rastabad_cave2: 308, rastabad_cave3: 309, rastabad_gate: 450, rastabad_beast: 455,
    dark_magic_lab: 461, necro_training: 473, elder_room: 530, dark_elf_sanctuary: 535,
    thebes_desert: 780, thebes_pyramid: 781, tikal_area: 783, tikal_deep: 783,
    oblivion_travel: 83, oblivion_island: 70, antharas_nest_1: 37, antharas_nest_2: 37, antharas_nest_3: 37,
};
for (let f = 2; f <= 100; f++) HUNT_MAPS['pride_f' + f] = 100 + f;                       // 傲慢之塔 N 樓＝100+N
['2_10', '11_20', '21_30', '31_40', '41_50', '51_60', '61_70', '71_80', '81_90', '91_100']   // 2~10 樓、11~20 樓…：用那一段的第一層
    .forEach(r => { HUNT_MAPS['pride_' + r] = 100 + +r.split('_')[0]; });
const AREA = 160;         // 大地圖取怪最集中的一塊：邊長（格）
const SYN_N = [10, 6];    // 補上的怪每種幾隻：[整張圖都沒資料, 只是缺幾種]
const SPREAD = 25;        // 每隻怪至少分到幾格走得到的地方（重生範圍太小就撐開）
function planHunts(db) {
    const clean = s => String(s || '').replace(/\s/g, '');
    const mobs = gameData('mobs'), maps = gameData('maps');
    const npcName = new Map(db.npc.map(n => [n.npcid, clean(n.name)]));
    const plan = {};
    for (const id in HUNT_MAPS) {
        const cfg = typeof HUNT_MAPS[id] === 'number' ? { map: HUNT_MAPS[id] } : HUNT_MAPS[id];
        const pool = (maps[id] || []).filter(m => mobs[m] && !mobs[m].boss);   // 頭目照遊戲原本的出現率，不放地圖
        if (!pool.length) { console.log('[gen-townmap] 狩獵 ' + id + ' 沒有一般怪，略過'); continue; }
        const byName = new Map(pool.map(m => [clean(mobs[m].n), m]));
        const rows = db.spawnAll.filter(s => +s.mapid === cfg.map && +s.count > 0 && byName.has(npcName.get(s.npc_templateid)));
        plan[id] = {
            name: id, map: cfg.map, area: !!cfg.area, pool, mobName: m => mobs[m].n,
            rows: rows.map(s => ({ mob: byName.get(npcName.get(s.npc_templateid)), n: +s.count, x: +s.locx, y: +s.locy, rx: +s.randomx, ry: +s.randomy,
                x1: +s.locx1, y1: +s.locy1, x2: +s.locx2, y2: +s.locy2, r0: +s.min_respawn_delay, r1: +s.max_respawn_delay })),
        };
    }
    return plan;
}
// 一步能不能走：照 afk-townmap canStep（＝模擬器 L1V1Map.isPassable），不含 NPC 佔位、鏡頭範圍
const STEP8 = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
function canStepAt(P, x, y, k) {
    const nx = x + STEP8[k][0], ny = y + STEP8[k][1];
    if (!P(nx, ny)) return false;
    switch (k) {
        case 0: return !!(P(x, y) & 2);
        case 1: return !!((P(x, y - 1) & 1) || (P(x + 1, y) & 2));
        case 2: return !!(P(x, y) & 1);
        case 3: return !!(P(x, y + 1) & 1);
        case 4: return !!(P(nx, ny) & 2);
        case 5: return true;
        case 6: return !!(P(nx, ny) & 1);
        default: return !!(P(x - 1, y) & 2);
    }
}
// 從 (sx,sy) 走得到的格子（限 box 範圍內）；回傳 Uint8Array（1＝到得了）與格數
function reachFrom(M, sx, sy, box) {
    const { W, H, pass } = M, P = (x, y) => (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) ? 0 : pass[y * W + x] & 3;
    const [bx0, by0, bx1, by1] = box || [0, 0, W - 1, H - 1];
    const seen = new Uint8Array(W * H), q = new Int32Array(W * H); let h = 0, t = 0;
    seen[sy * W + sx] = 1; q[t++] = sy * W + sx;
    while (h < t) {
        const c = q[h++], x = c % W, y = (c - x) / W;
        for (let k = 0; k < 8; k++) {
            const nx = x + STEP8[k][0], ny = y + STEP8[k][1];
            if (nx < bx0 || ny < by0 || nx > bx1 || ny > by1 || seen[ny * W + nx] || !canStepAt(P, x, y, k)) continue;
            seen[ny * W + nx] = 1; q[t++] = ny * W + nx;
        }
    }
    return { seen, n: t };
}
// 狩獵地圖存成地圖格座標：重生點 [怪物 id, 數量, 中心 x, y, 隨機範圍 rx, ry, 方框 x1, y1, x2, y2（沒有就 0）, 重生秒數 最短, 最長, 出生格（見下）]；
//   起點＝怪最多那組重生點的中心附近、四周都能走的格子（一進來附近就有怪打）；角色從起點走不到的重生點不要（隔著牆、要傳送的房間）；
//   怪物池缺的種類補在走得到的地方。隨機用固定種子（同一份資料重跑結果一樣）。
function placeHunt(M, p) {
    const { W, H, pass } = M, at = (x, y) => (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) ? 0 : pass[y * W + x];
    const open3 = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) !== 3) return false; return true; };
    let seed = [...p.name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    // 方框座標：模擬器的「整張圖隨機」方框從地圖邊（換算後＝0）開始，0 會被當成「沒方框」→ 整層的怪擠在中心 ±3 格（玩家回報），所以至少 1
    const L = (v, o) => v ? Math.max(1, v - o) : 0;
    let spawns = p.rows.map(s => [s.mob, s.n, s.x - M.gameX0, s.y - M.gameY0, s.rx, s.ry, L(s.x1, M.gameX0), L(s.y1, M.gameY0), L(s.x2, M.gameX0), L(s.y2, M.gameY0), s.r0, s.r1]);
    // 大地圖：只取這張遊戲地圖的怪最集中的一塊（種類最多、同種類數再比隻數），方框夾進這塊
    let box = null;
    if (p.area && spawns.length) {
        let best = null;
        for (const c of spawns) {
            const inW = spawns.filter(s => Math.abs(s[2] - c[2]) <= AREA / 2 && Math.abs(s[3] - c[3]) <= AREA / 2);
            const kinds = new Set(inW.map(s => s[0])).size, n = inW.reduce((a, s) => a + s[1], 0);
            if (!best || kinds > best.kinds || (kinds === best.kinds && n > best.n)) best = { c, kinds, n, inW };
        }
        box = [Math.max(1, best.c[2] - AREA / 2), Math.max(1, best.c[3] - AREA / 2), Math.min(W - 2, best.c[2] + AREA / 2), Math.min(H - 2, best.c[3] + AREA / 2)];
        spawns = best.inW.map(s => {
            if (!(s[6] && s[8])) return s;
            const t = s.slice();
            t[6] = Math.max(box[0], Math.min(s[6], s[8])); t[8] = Math.min(box[2], Math.max(s[6], s[8]));
            t[7] = Math.max(box[1], Math.min(s[7], s[9])); t[9] = Math.min(box[3], Math.max(s[7], s[9]));
            return t;
        });
    }
    // 起點：怪最多那組重生點附近；沒有重生點（或那裡走不開）→ 整張圖（或那一塊）最大的一片能走的地方、靠它的中間
    const near = (cx, cy, ok, R) => {
        for (let r = 0; r <= R; r++) for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
            if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) === r && ok(x, y)) return [x, y];
        }
        return null;
    };
    let home = null, reach = null;
    if (spawns.length) {
        const big = spawns.reduce((a, s) => (s[1] > a[1] ? s : a));
        home = near(big[2], big[3], open3, 40);
        if (home) { reach = reachFrom(M, home[0], home[1], box); if (reach.n < 400) home = reach = null; }
    }
    if (!home) {   // 找最大的一片：從方格上的種子點一個個灌
        const [x0, y0, x1, y1] = box || [1, 1, W - 2, H - 2], done = new Uint8Array(W * H);
        let best = null;
        for (let y = y0; y <= y1; y += 4) for (let x = x0; x <= x1; x += 4) {
            if (done[y * W + x] || !open3(x, y)) continue;
            const r = reachFrom(M, x, y, box);
            for (let i = 0; i < r.seen.length; i++) if (r.seen[i]) done[i] = 1;
            if (!best || r.n > best.r.n) best = { r, x, y };
        }
        if (!best) return null;
        let sx = 0, sy = 0; for (let i = 0; i < best.r.seen.length; i++) if (best.r.seen[i]) { sx += i % W; sy += (i / W) | 0; }
        reach = best.r;
        home = near(Math.round(sx / reach.n), Math.round(sy / reach.n), (x, y) => reach.seen[y * W + x] && open3(x, y), 200) || [best.x, best.y];
    }
    const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H && reach.seen[y * W + x];
    // 走不到的重生點不要；方框縮成「方框裡走得到的格子」的範圍
    spawns = spawns.filter(s => {
        let x0, y0, x1, y1;
        if (s[6] && s[8]) { x0 = Math.min(s[6], s[8]); x1 = Math.max(s[6], s[8]); y0 = Math.min(s[7], s[9]); y1 = Math.max(s[7], s[9]); }
        else { const rx = Math.max(s[4], 3), ry = Math.max(s[5], 3); x0 = s[2] - rx; x1 = s[2] + rx; y0 = s[3] - ry; y1 = s[3] + ry; }
        let a = Infinity, b = Infinity, c = -1, d = -1;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (ok(x, y)) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
        if (c < 0) return false;
        if (s[6] && s[8]) { s[6] = a; s[8] = c; s[7] = b; s[9] = d; }
        else if (!ok(s[2], s[3])) { const q = near(s[2], s[3], ok, Math.max(s[4], s[5], 3)); if (!q) return false; s[2] = q[0]; s[3] = q[1]; }
        return true;
    });
    // 補上缺的種類：有重生點就挑一組的中心附近，沒有就在起點周圍 8~40 格走得到的地方
    const cells = [];
    for (let y = Math.max(1, home[1] - 40); y <= Math.min(H - 2, home[1] + 40); y++) for (let x = Math.max(1, home[0] - 40); x <= Math.min(W - 2, home[0] + 40); x++) {
        if (ok(x, y) && Math.max(Math.abs(x - home[0]), Math.abs(y - home[1])) >= 8) cells.push([x, y]);
    }
    const have = new Set(spawns.map(s => s[0])), real = spawns.length, missing = p.pool.filter(m => !have.has(m));
    for (const m of missing) {
        let c = null;
        if (real) { const s = spawns[Math.floor(rnd() * real)]; c = near(s[2], s[3], ok, 20); }
        if (!c && cells.length) c = cells[Math.floor(rnd() * cells.length)];
        if (!c) c = home;
        spawns.push([m, SYN_N[real ? 1 : 0], c[0], c[1], 10, 10, 0, 0, 0, 0, 60, 120]);
    }
    // 太擠的撐開：每隻至少 SPREAD 格走得到的地方（模擬器有些是「一個點、好幾十隻」，照原樣會疊成一團）
    const areaOf = s => (s[6] && s[8]) ? [s[6], s[7], s[8], s[9]] : [s[2] - Math.max(s[4], 3), s[3] - Math.max(s[5], 3), s[2] + Math.max(s[4], 3), s[3] + Math.max(s[5], 3)];
    const room = ([x0, y0, x1, y1]) => { let n = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (ok(x, y)) n++; return n; };
    for (const s of spawns) {
        for (let g = 0; g < 60 && room(areaOf(s)) < s[1] * SPREAD; g++) {
            if (s[6] && s[8]) { s[6] = Math.max(1, s[6] - 1); s[7] = Math.max(1, s[7] - 1); s[8] = Math.min(W - 2, s[8] + 1); s[9] = Math.min(H - 2, s[9] + 1); }
            else { s[4] = Math.max(s[4], 3) + 1; s[5] = Math.max(s[5], 3) + 1; }
        }
    }
    // 出生格：範圍裡「角色走得到」的格子先挑好一批（隻數的兩倍、至少 8 格），afk-townmap 只從這些挑。
    //   ⚠ 只給範圍的話執行時是在範圍裡亂挑再找最近能站的格子——懸崖、步道一層一層的地圖（眠龍洞穴）會挑到看得到走不過去的那層，
    //   角色一直找不到路、在原地繞圈不打怪（玩家回報）。存成 y×寬＋x 的數字
    for (const s of spawns) {
        const [x0, y0, x1, y1] = areaOf(s), cells = [], loose = [];
        for (let y = Math.max(1, y0); y <= Math.min(H - 2, y1); y++) for (let x = Math.max(1, x0); x <= Math.min(W - 2, x1); x++) if (ok(x, y)) (at(x, y) === 3 ? cells : loose).push(y * W + x);
        if (!cells.length) cells.push(...loose);   // 範圍裡沒有四邊都通的格子：能站就好
        const want = Math.max(8, s[1] * 2);
        for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = cells[i]; cells[i] = cells[j]; cells[j] = t; }
        if (cells.length) s.push(cells.slice(0, want));
    }
    return { map: M.id, home, spawns, missing: missing.map(p.mobName), real };
}

// ── 傳送點（模擬器 dungeon 表：踩上去就傳送的格子，樓梯、洞口、碼頭）────────────
// 起點、終點都在有動態地圖的用戶端地圖上才收。終點那張用戶端地圖上有好幾張遊戲地圖時（大陸＝各村莊＋各野外、說話之島…），
//   挑起點（村莊起點／狩獵起點）離終點最近的那張；傲慢之塔「2~10 樓」這種合併的不挑，留給單層的。
//   存成 { 用戶端地圖: [[起點 x, y, 目的地遊戲地圖, 終點 x, y], …] }（地圖格座標）
function planPortals(db, towns, hunts) {
    const box = new Map(db.mapids.map(m => [+m.mapid, { x0: +m.startX, y0: +m.startY, w: +m.endX - +m.startX + 1, h: +m.endY - +m.startY + 1 }]));
    const games = {};
    for (const id in towns) (games[towns[id].map] = games[towns[id].map] || []).push({ id, home: towns[id].home });
    for (const id in hunts) if (id[0] !== '_') (games[hunts[id].map] = games[hunts[id].map] || []).push({ id, home: hunts[id].home });
    const out = {}, seen = new Set(); let n = 0;
    for (const r of db.dungeon) {
        const s = +r.src_mapid, dm = +r.new_mapid, sb = box.get(s), tb = box.get(dm);
        if (!games[s] || !games[dm] || !sb || !tb) continue;
        const sx = +r.src_x - sb.x0, sy = +r.src_y - sb.y0, dx = +r.new_x - tb.x0, dy = +r.new_y - tb.y0;
        if (sx < 0 || sy < 0 || sx >= sb.w || sy >= sb.h || dx < 0 || dy < 0 || dx >= tb.w || dy >= tb.h) continue;
        const k = s + ':' + sx + ',' + sy; if (seen.has(k)) continue; seen.add(k);   // 同一格重複列的取第一筆
        let cand = games[dm].filter(g => !/^pride_\d+_\d+$/.test(g.id)); if (!cand.length) cand = games[dm];
        const dist = g => Math.max(Math.abs(g.home[0] - dx), Math.abs(g.home[1] - dy));
        const g = cand.reduce((a, b) => (dist(b) < dist(a) ? b : a));
        (out[s] = out[s] || []).push([sx, sy, g.id, dx, dy]); n++;
    }
    console.log('[gen-townmap] 傳送點 ' + n + ' 個，分在 ' + Object.keys(out).length + ' 張地圖');
    return out;
}

// ── 怪物行為旗標（模擬器 npc 表）：狩獵區地圖的主動判定用 ──────────────
//   主動／被動照遊戲自己的 beh（作者設定、涵蓋全部怪）；這裡只補遊戲沒有的：
//   agrososc＝看穿變身（角色變身中只有這些會主動打）、agrocoi＝看穿隱身、family＋agrofamily＝同族互助（打一隻，附近同族會一起上）。
//   ranged＝射程（弓箭手 10、長槍 2；1＝近戰）：地圖上隔多遠、中間沒牆才打得到角色。
//   照名字對遊戲 DB.mobs，存進 hunts.json 的 _mob：{ 怪物 id: [看穿變身, 看穿隱身, 同族名, 會互助, 射程（近戰記 0）] }（全是 0／空的不存）
function mobFlags(db) {
    const clean = s => String(s || '').replace(/\s/g, '');
    const mobs = gameData('mobs'), byName = new Map();
    for (const r of db.npc) if (/Monster/i.test(r.impl || '') && !byName.has(clean(r.name))) byName.set(clean(r.name), r);
    const out = {};
    for (const id in mobs) {
        const r = byName.get(clean(mobs[id].n)); if (!r) continue;
        const f = [+r.agrososc === 1 ? 1 : 0, +r.agrocoi === 1 ? 1 : 0, r.family || '', +r.agrofamily === 1 ? 1 : 0, +r.ranged > 1 ? +r.ranged : 0];
        if (f[0] || f[1] || (f[2] && f[3]) || f[4]) out[id] = f;
    }
    console.log('[gen-townmap] 怪物行為旗標 ' + Object.keys(out).length + ' 隻');
    return out;
}

// ── 村莊 → 地圖、中心、NPC 位置 ───────────────────────────
// 遊戲村莊的 NPC 名字去對模擬器 spawnlist_npc（npc 名稱或 location 欄）：對到最多的那張圖就是村莊所在，
//   對到的位置取中位數當村莊中心；離中心 48 格外的同名 NPC（別的村莊的）不算。
//   遊戲自己加的 NPC（傭兵公會、依詩蒂、潘朵拉…）對不到，afk-townmap 放在村莊中心附近的空位（spots）。
const TOWN_FIX = {
    town_talking: { map: 0, home: [32588, 32950] },   // 說話之島：維持原本的起點
    town_elder_council: { map: 534 },                  // 兩個 NPC 各在 320、534 一張圖平手；534＝模擬器的「長老會議廳」
};
const SKIP_TOWNS = new Set(['town_rift', 'town_sherine']);   // 沒有 NPC 對得到 / 已關閉
const TOWN_R = 64;   // 模擬器裡有些 NPC 放在離村莊很遠的地方（說話之島的吉倫在村莊南邊 132 格）：太遠的改放村莊附近，點得到
function planTowns(db) {
    const clean = s => String(s || '').replace(/[\s．・.]/g, '');
    const cheb = (p, c) => Math.max(Math.abs(p.x - c[0]), Math.abs(p.y - c[1]));
    const med = a => { const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; };
    const npcById = new Map(db.npc.map(n => [n.npcid, n]));
    const spawns = db.spawn.map(s => ({ nm: clean((npcById.get(s.npc_templateid) || {}).name), loc: clean(s.location), map: +s.mapid, x: +s.locx, y: +s.locy }));
    const towns = gameTowns(), plan = {};
    for (const id in towns) {
        if (SKIP_TOWNS.has(id)) continue;
        const fix = TOWN_FIX[id] || {};
        const list = (towns[id].npcs || []).map(n => {
            const c = clean(n.n);
            return { name: n.n, hits: c ? spawns.filter(s => s.nm === c || s.loc === c || s.nm.endsWith(c) || s.loc.endsWith(c)) : [] };
        });
        let map = fix.map;
        if (map == null) {
            const cnt = {};
            list.forEach(l => new Set(l.hits.map(h => h.map)).forEach(m => { cnt[m] = (cnt[m] || 0) + 1; }));
            const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
            if (!best) { console.log('[gen-townmap] ' + id + ' ' + towns[id].n + '：NPC 都對不到模擬器，維持靜態背景'); continue; }
            map = +best[0];
        }
        const pts = list.flatMap(l => l.hits.filter(h => h.map === map));
        let c = fix.home;
        if (!c) {
            if (!pts.length) continue;
            c = [med(pts.map(p => p.x)), med(pts.map(p => p.y))];
            const near = pts.filter(p => cheb(p, c) <= TOWN_R);
            if (near.length) c = [med(near.map(p => p.x)), med(near.map(p => p.y))];
        }
        const npc = {};
        for (const l of list) {
            const h = l.hits.filter(p => p.map === map && cheb(p, c) <= TOWN_R).sort((p, q) => cheb(p, c) - cheb(q, c))[0];
            if (h) npc[l.name] = [h.x, h.y];
        }
        plan[id] = { name: towns[id].n, map, center: c, npc, total: list.length };
    }
    return plan;
}

// ── 讀一整張地圖 ─────────────────────────────────────────
// 範圍＝模擬器 mapids 的 startX..endX、startY..endY（都對齊 64 格＝用戶端一個 .s32）；格座標以 (startX, startY) 為 0
function readMap(id, b, clientDir, emuDir) {
    const B = BLOCK, nbx = (b.endX - b.startX + 1) / B, nby = (b.endY - b.startY + 1) / B;
    if (nbx % 1 || nby % 1 || (b.startX - 32768) % B || (b.startY - 32768) % B) throw new Error('地圖 ' + id + ' 範圍沒對齊 64 格');
    const W = nbx * B, H = nby * B, bx0 = 0x8000 + (b.startX - 32768) / B, by0 = 0x8000 + (b.startY - 32768) / B;
    const ground = new Uint32Array(W * 2 * H), has = new Uint8Array(nbx * nby), objs = [];
    let pass = new Uint8Array(W * H), zone = new Uint8Array(W * H), rank = 0, blocks = 0;
    for (let by = 0; by < nby; by++) for (let bx = 0; bx < nbx; bx++) {
        const base = path.join(clientDir, 'map', String(id), (bx0 + bx).toString(16) + (by0 + by).toString(16));
        const f = fs.existsSync(base + '.s32') ? base + '.s32' : base + '.seg';   // 兩種都有就用新的 .s32
        if (!fs.existsSync(f)) continue;
        blocks++; has[by * nbx + bx] = 1;
        const m = readS32(f);
        for (let y = 0; y < B; y++) {
            for (let hx = 0; hx < B * 2; hx++) ground[(by * B + y) * W * 2 + bx * B * 2 + hx] = m.l1[y * B * 2 + hx];
            for (let x = 0; x < B; x++) {
                const i = (by * B + y) * W + bx * B + x, a = m.attr[y * B + x];
                pass[i] = m.pass[y * B + x];
                zone[i] = a & 4 ? 1 : a & 8 ? 2 : 0;   // 用戶端屬性 0x04 安全區、0x08 戰鬥區（說話之島對模擬器：3857 格對 3796 格）
            }
        }
        for (const o of m.objs) objs.push({ hx: bx * B * 2 + o.x, gy: by * B + o.y, layer: o.layer, key: o.key, rank: rank++ });
    }
    const txt = path.join(emuDir, 'maps', id + '.txt');
    if (blocks && fs.existsSync(txt)) {
        const { pass: p, zone: z } = readPassTxt(txt, W, H);
        // 用戶端沒有圖的區塊（大陸有幾十塊）模擬器卻標能走：當牆，免得角色走進一片空白
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!has[(y / B | 0) * nbx + (x / B | 0)]) p[y * W + x] = 0;
        let diff = 0, ghost = 0, walk = 0;
        for (let i = 0; i < W * H; i++) { if (p[i] !== pass[i]) diff++; if (pass[i]) walk++; if (p[i] && !pass[i]) ghost++; }
        // 模擬器的檔跟用戶端是不同版本的地圖（水晶洞穴、巨蟻洞穴：「模擬器說能走、畫面上是牆」超過一成）→ 照模擬器會穿牆（玩家回報），改用用戶端。
        //   正常的只差伺服器修過的零星幾格（大陸 0.1%、說話之島 28 格），照模擬器（安全區、戰鬥區也一起照模擬器）
        if (walk && ghost / walk > 0.02) console.log('[gen-townmap] 地圖 ' + id + ' 模擬器 maps/' + id + '.txt 跟用戶端不是同一版（' + ghost + ' 格畫面上是牆卻能走），改照用戶端');
        else { console.log('[gen-townmap] 地圖 ' + id + ' 能不能走照模擬器 maps/' + id + '.txt（跟用戶端換算差 ' + diff + ' 格）'); pass = p; zone = z; }
    }
    const zeroGround = fillGround(ground, W, H);
    return { id, W, H, gameX0: b.startX, gameY0: b.startY, ground, pass, zone, objs, blocks, zeroGround };
}
// 第 0 組地磚＝這格沒有地板（海音地監 1 樓整張都是 0、地板全靠貼地物件畫）。當成一般地磚畫出來就是一塊塊橘色的（站長回報「地板怪怪的」）。
//   → 用 3 格內最近、同一半（左／右半格）的真地板補；附近都沒有就留空（EMPTY_G，畫透明）
const EMPTY_G = 0xFFFFFFFF;
function fillGround(ground, W, H) {
    const src = ground.slice(), W2 = W * 2; let n = 0;
    for (let y = 0; y < H; y++) for (let hx = 0; hx < W2; hx++) {
        const i = y * W2 + hx; if ((src[i] >> 8) !== 0) continue;
        n++;
        const x = hx >> 1, half = hx & 1;
        let v = EMPTY_G;
        for (let r = 1; r <= 3 && v === EMPTY_G; r++) for (let yy = y - r; yy <= y + r && v === EMPTY_G; yy++) {
            if (yy < 0 || yy >= H) continue;
            for (let xx = x - r; xx <= x + r; xx++) {
                if (xx < 0 || xx >= W || Math.max(Math.abs(xx - x), Math.abs(yy - y)) !== r) continue;
                const k = src[yy * W2 + xx * 2 + half]; if ((k >> 8) !== 0) { v = k; break; }
            }
        }
        ground[i] = v;
    }
    return n;   // 原本沒有地板的半格數（有就要重產這張圖）
}
// 安全區／戰鬥區（afk-townmap 地圖名旁邊顯示角色站的地方）：一列一列的連續段，上下列一樣的併成矩形，
//   攤平成 [x 起, y 起, x 迄, y 迄, 1 安全區／2 戰鬥區, …]（一般區域不記；大陸逐列存 113KB、併成矩形小很多）
function zoneRuns(M) {
    const { W, H, zone } = M, out = [];
    let open = new Map();   // 上一列還在延伸的矩形：'x0,x1,z' → 矩形
    for (let y = 0; y < H; y++) {
        const next = new Map();
        for (let x = 0; x < W; x++) {
            const z = zone[y * W + x]; if (!z) continue;
            let x1 = x; while (x1 + 1 < W && zone[y * W + x1 + 1] === z) x1++;
            const k = x + ',' + x1 + ',' + z, r = open.get(k);
            if (r) { r[3] = y; next.set(k, r); open.delete(k); } else { const n = [x, y, x1, y, z]; out.push(n); next.set(k, n); }
            x = x1;
        }
        open = next;
    }
    return [].concat(...out);
}
// 死亡回村、重新登入的落點：模擬器 getback 表的回城座標（每個區域三個點）落在這個村莊附近的，各自找最近能站的格子
function townBack(M, p, rows) {
    const { W, H, pass } = M, pts = new Map();
    const open = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1 && pass[y * W + x] === 3;
    for (const r of rows) {
        if (+r.getback_mapid !== M.id) continue;
        for (const k of [1, 2, 3]) {
            const gx = +r['getback_x' + k], gy = +r['getback_y' + k];
            if (Math.max(Math.abs(gx - p.center[0]), Math.abs(gy - p.center[1])) > TOWN_R) continue;
            const cx = gx - M.gameX0, cy = gy - M.gameY0;
            let c = null;
            for (let d = 0; d <= 6 && !c; d++) for (let y = cy - d; y <= cy + d && !c; y++) for (let x = cx - d; x <= cx + d; x++) if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) === d && open(x, y)) { c = [x, y]; break; }
            if (c) pts.set(c.join(','), c);
        }
    }
    return [...pts.values()];
}

// ── 村莊起點、NPC 站位（地圖格座標）─────────────────────────
function placeTown(M, p) {
    const { W, H, pass } = M, at = (x, y) => (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) ? 0 : pass[y * W + x];
    const open3 = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) !== 3) return false; return true; };
    const npc = {}, taken = new Set();
    for (const n in p.npc) { const x = p.npc[n][0] - M.gameX0, y = p.npc[n][1] - M.gameY0; if (x >= 0 && y >= 0 && x < W && y < H) { npc[n] = [x, y]; taken.add(x + ',' + y); } }
    const cx = p.center[0] - M.gameX0, cy = p.center[1] - M.gameY0;
    // 會不會被房子、樹擋住：角色身體（腳下往上 62px、左右 22px）碰到畫在他前面（4×列＋圖層較大）的立著物件小塊
    const near = new Map();
    for (const o of M.objs) {
        if (o.layer <= 8) continue;
        const x = o.hx >> 1, y = o.gy;
        if (Math.abs(x - cx) > 40 || Math.abs(y - cy) > 40) continue;
        const k = x + ',' + y; (near.get(k) || near.set(k, []).get(k)).push(o);
    }
    const covered = (x, y) => {
        const X = 24 * (x + y), Y = 12 * (y - x), key = 4 * (y - x) + 19.5;
        for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) for (const o of near.get((x + dx) + ',' + (y + dy)) || []) {
            const lx = o.hx >> 1, ly = o.gy, tx = 24 * (lx + ly) - (o.hx & 1 ? 0 : 24), ty = 12 * (ly - lx) - 11;
            if (4 * (ly - lx) + o.layer > key && tx < X + 22 && tx + BW > X - 22 && ty < Y && ty + BH > Y - 62) return true;
        }
        return false;
    };
    // 起點：離中心最近、四周都能走、沒有 NPC、不會一進村莊就被房子擋住的格子（真的找不到才放寬遮擋）
    let home = null;
    for (const strict of [true, false]) for (let r = 0; r <= 30 && !home; r++) for (let y = cy - r; y <= cy + r && !home; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r || !open3(x, y) || taken.has(x + ',' + y) || (strict && covered(x, y))) continue;
        home = [x, y]; break;
    }
    if (!home) return null;
    // 對不到位置的 NPC 用的空位：起點附近四周都能走的格子，彼此、跟 NPC 都隔 3 格以上，近的先
    const cand = [];
    for (let y = home[1] - 24; y <= home[1] + 24; y++) for (let x = home[0] - 24; x <= home[0] + 24; x++) {
        const d = Math.max(Math.abs(x - home[0]), Math.abs(y - home[1]));
        if (d >= 2 && open3(x, y)) cand.push([x, y, d]);
    }
    cand.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
    const spots = [], far = (q, list) => list.every(s => Math.max(Math.abs(s[0] - q[0]), Math.abs(s[1] - q[1])) >= 3);
    const npcPts = Object.values(npc);
    for (const c of cand) { if (far(c, spots) && far(c, npcPts)) spots.push([c[0], c[1]]); if (spots.length >= 24) break; }
    return { map: M.id, home, npc, spots };
}

// ── 地圖圖檔：分區資料＋拼圖 ───────────────────────────────
// 每張圖 RS×RS 格一區，每區一個二進位資料檔；小塊去重複後排進拼圖頁（無損 WebP）：很多區都用到的（草地、海）排最前面，
//   其餘照「用到它的區裡 Z 字序最前的那區」排，同一區自己的小塊連在一起、附近的區也在附近的頁。
//   afk-townmap 只載角色附近的區＋它們用到的頁。只產「離能走的格子 MARGIN 格內」的區（整片海、牆裡、鏡頭照不到的不產）。
// 區檔（little-endian，各段對齊 4 bytes）：uint32 nPal, nFlat, nTall；
//   pal uint32[nPal]（這區用到的小塊在全圖的編號）、g uint16[RS*RS*2]（地磚，pal 位置）、f uint8[RS*RS]（能不能走）、
//   fIdx/fHx/fGy uint16[nFlat]、fOrd uint32[nFlat]（貼地物件）、tIdx/tHx/tGy uint16[nTall]、tLy uint8[nTall]、tSeq uint32[nTall]（立著的）
function morton(x, y) { let z = 0; for (let i = 0; i < 16; i++) z += (((x >> i) & 1) * 2 ** (2 * i)) + (((y >> i) & 1) * 2 ** (2 * i + 1)); return z; }
function packRegion(parts) {
    let n = 0; for (const p of parts) n += (p.byteLength + 3) & ~3;
    const out = Buffer.alloc(n); let o = 0;
    for (const p of parts) { Buffer.from(p.buffer, p.byteOffset, p.byteLength).copy(out, o); o += (p.byteLength + 3) & ~3; }
    return out;
}
async function buildMapData(M, tilePak, webp) {
    const { id, W, H, pass, ground } = M, name = 'm' + id, nbx = W / RS, nby = H / RS;
    const W1 = W + 1, ps = new Int32Array(W1 * (H + 1));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ps[(y + 1) * W1 + x + 1] = (pass[y * W + x] ? 1 : 0) + ps[y * W1 + x + 1] + ps[(y + 1) * W1 + x] - ps[y * W1 + x];
    const walkIn = (ax, ay, bx, by) => {
        ax = Math.max(0, ax); ay = Math.max(0, ay); bx = Math.min(W - 1, bx); by = Math.min(H - 1, by);
        return ax > bx || ay > by ? 0 : ps[(by + 1) * W1 + bx + 1] - ps[ay * W1 + bx + 1] - ps[(by + 1) * W1 + ax] + ps[ay * W1 + ax];
    };
    const live = new Uint8Array(nbx * nby);
    for (let ry = 0; ry < nby; ry++) for (let rx = 0; rx < nbx; rx++) live[ry * nbx + rx] = walkIn(rx * RS - MARGIN, ry * RS - MARGIN, rx * RS + RS - 1 + MARGIN, ry * RS + RS - 1 + MARGIN) > 0 ? 1 : 0;
    const nLive = live.reduce((a, b) => a + b, 0);

    // 世界像素：格 (x,y) 中心 (24(x+y)+OX, 12(y-x)+OY)
    const OX = 48, OY = 12 * W + 32, WW = 24 * (W + H) + 96, WH = 12 * (W + H) + 64;
    const CX = Math.ceil(WW / CS), CY = Math.ceil(WH / CS);

    // 物件照所在的格子分區；全域順序：貼地的照「圖層、檔案順序」，立著的照「4×列＋圖層、圖層、檔案順序」
    const regOf = o => { const x = o.hx >> 1, y = o.gy; return (x < 0 || y < 0 || x >= W || y >= H) ? -1 : (y / RS | 0) * nbx + (x / RS | 0); };
    const kept = M.objs.filter(o => { const r = regOf(o); return r >= 0 && live[r]; });
    const flat = kept.filter(o => o.layer <= 8).sort((a, b) => a.layer - b.layer || a.rank - b.rank);
    flat.forEach((o, i) => { o.ord = i; });
    const keyOf = o => 4 * (o.gy - (o.hx >> 1)) + o.layer;
    const tall = kept.filter(o => o.layer > 8).sort((a, b) => keyOf(a) - keyOf(b) || a.layer - b.layer || a.rank - b.rank);
    tall.forEach((o, i) => { o.seq = i; });

    // 要用到的小塊（先記下，再照地磚檔一個一個解，解完就放掉那個檔）
    const need = new Map();
    const want = (kind, key, ri) => { const mk = kind + key; let n = need.get(mk); if (!n) need.set(mk, n = { kind, key, regs: new Set() }); n.regs.add(ri); return n; };
    const R = [];
    for (let ry = 0; ry < nby; ry++) for (let rx = 0; rx < nbx; rx++) {
        const ri = ry * nbx + rx; if (!live[ri]) continue;
        const g = [];
        for (let y = ry * RS; y < ry * RS + RS; y++) for (let hx = rx * RS * 2; hx < (rx * RS + RS) * 2; hx++) g.push(want('g', ground[y * W * 2 + hx], ri));
        R[ri] = { ri, rx, ry, g, flat: [], tall: [] };
    }
    for (const o of flat) { o.n = want('o', o.key, regOf(o)); R[regOf(o)].flat.push(o); }
    for (const o of tall) { o.n = want('o', o.key, regOf(o)); R[regOf(o)].tall.push(o); }
    const byTile = new Map();
    for (const n of need.values()) { const t = n.key >> 8; (byTile.get(t) || byTile.set(t, []).get(t)).push(n); }
    const EMPTY = new Uint8Array(BW * BH * 4), entries = new Map();
    let missing = 0;
    for (const [t, list] of byTile) {
        const buf = t < 0 ? null : tilePak(t + '.til'), til = buf ? parseTil(buf) : null;   // t < 0：沒有地板的格子（EMPTY_G，見 fillGround）
        for (const n of list) {
            let px = EMPTY;
            if (n.key === EMPTY_G) {}
            else if (til && (n.key & 255) < til.n) { try { px = decodeBlock(til, n.key & 255, n.kind === 'o'); } catch (e) { missing++; } } else missing++;
            const h = crypto.createHash('md5').update(px).digest('hex');
            let e = entries.get(h);
            if (!e) entries.set(h, e = { px, sortKey: n.key, regs: new Set(), idx: -1 });
            n.regs.forEach(r => e.regs.add(r)); n.e = e;
        }
    }
    // 排頁（量過大陸：照平均位置排、照用最多的區排都比這個多載 1.5~2 倍）
    const all = [...entries.values()], G = Math.max(4, Math.ceil(nLive * 0.15)), mo = ri => morton(ri % nbx, ri / nbx | 0);
    for (const e of all) { let z = Infinity; if (e.regs.size >= G) z = -1; else e.regs.forEach(ri => { z = Math.min(z, mo(ri)); }); e.z = z; }
    all.sort((a, b) => a.z - b.z || a.sortKey - b.sortKey);
    all.forEach((e, i) => { e.idx = i; });

    const dir = path.join(OUT_DIR, name);
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    let bytes = 0;
    const pages = Math.ceil(all.length / PER);
    for (let pg = 0; pg < pages; pg++) {
        const part = all.slice(pg * PER, (pg + 1) * PER), PH = Math.ceil(part.length / COLS) * CELL_H, img = Buffer.alloc(PAGE_W * PH * 4);
        part.forEach((e, i) => {
            const ox = (i % COLS) * CELL_W + 1, oy = (i / COLS | 0) * CELL_H + 1;
            for (let y = 0; y < BH; y++) Buffer.from(e.px.buffer, e.px.byteOffset + y * BW * 4, BW * 4).copy(img, ((oy + y) * PAGE_W + ox) * 4);
        });
        const out = await webp(PAGE_W, PH, img);
        fs.writeFileSync(path.join(dir, 'p' + pg + '.webp'), out); bytes += out.length;
    }
    for (const e of all) e.px = null;

    // 各區資料：pal＝這區用到的小塊（全圖編號），其餘欄位存 pal 裡的位置
    const regions = new Array(nbx * nby).fill(-1);
    let maxPages = 0;
    for (const r of R) {
        if (!r) continue;
        const used = [...new Set([...r.g.map(n => n.e), ...r.flat.map(o => o.n.e), ...r.tall.map(o => o.n.e)])].sort((a, b) => a.idx - b.idx);
        if (used.length > 65535) throw new Error('地圖 ' + id + ' 區 ' + r.rx + ',' + r.ry + ' 小塊太多');
        const loc = new Map(used.map((e, i) => [e, i])), ix = e => loc.get(e);
        regions[r.ri] = [...new Set(used.map(e => (e.idx / PER) | 0))];
        maxPages = Math.max(maxPages, regions[r.ri].length);
        const f = new Uint8Array(RS * RS);
        for (let y = 0; y < RS; y++) for (let x = 0; x < RS; x++) f[y * RS + x] = pass[(r.ry * RS + y) * W + r.rx * RS + x];   // bit0 往 x+1 的邊能過、bit1 往 y-1 的邊能過（同模擬器地圖檔）
        const u16 = (a, fn) => new Uint16Array(a.map(fn)), u32 = (a, fn) => new Uint32Array(a.map(fn));
        const buf = packRegion([
            new Uint32Array([used.length, r.flat.length, r.tall.length]), new Uint32Array(used.map(e => e.idx)), u16(r.g, n => ix(n.e)), f,
            u16(r.flat, o => ix(o.n.e)), u16(r.flat, o => o.hx + OFF), u16(r.flat, o => o.gy + OFF), u32(r.flat, o => o.ord),
            u16(r.tall, o => ix(o.n.e)), u16(r.tall, o => o.hx + OFF), u16(r.tall, o => o.gy + OFF), new Uint8Array(r.tall.map(o => o.layer)), u32(r.tall, o => o.seq),
        ]);
        fs.writeFileSync(path.join(dir, 'r' + r.rx + '_' + r.ry + '.bin'), buf); bytes += buf.length;
    }
    // regions[區]：-1＝沒產（整片海、鏡頭照不到），否則＝這區用到的拼圖頁
    const data = {
        v: 5, id, cw: W, ch: H, gameX0: M.gameX0, gameY0: M.gameY0,
        ox: OX, oy: OY, ww: WW, wh: WH, cs: CS, cx: CX, cy: CY, off: OFF, per: PER, cols: COLS, cellW: CELL_W, cellH: CELL_H,
        rs: RS, rnx: nbx, rny: nby, pages, regions, zone: zoneRuns(M),
    };
    const js = JSON.stringify(data);
    fs.writeFileSync(path.join(OUT_DIR, name + '.json'), js); bytes += js.length;
    console.log('[gen-townmap] 地圖 ' + id + '：' + W + '×' + H + ' 格、' + nLive + ' 區、小塊 ' + all.length + '（' + pages + ' 頁，一區最多用 ' + maxPages + ' 頁）、' +
        '貼地物件 ' + flat.length + '、立著 ' + tall.length + (missing ? '、缺圖 ' + missing : '') + '，共 ' + (bytes / 1e6).toFixed(1) + 'MB');
    return bytes;
}
// 無損 WebP：Node 沒有編碼器，借 playwright 的 Chromium（canvas.toBlob('image/webp', 1) 是無損，逐像素比對過）
async function webpEncoder() {
    const { chromium } = require('playwright');
    const browser = await chromium.launch(), page = await browser.newPage();
    const enc = async (w, h, rgba) => {
        const b64 = await page.evaluate(async ([w, h, s]) => {
            const bin = atob(s), a = new Uint8ClampedArray(bin.length);
            for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
            const c = document.createElement('canvas'); c.width = w; c.height = h;
            c.getContext('2d').putImageData(new ImageData(a, w, h), 0, 0);
            const blob = await new Promise(r => c.toBlob(r, 'image/webp', 1));
            const u = new Uint8Array(await blob.arrayBuffer()); let t = '';
            for (let i = 0; i < u.length; i += 32768) t += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
            return btoa(t);
        }, [w, h, rgba.toString('base64')]);
        return Buffer.from(b64, 'base64');
    };
    enc.close = () => browser.close();
    return enc;
}

// ── 角色落腳點 ───────────────────────────────────
// 每個職業 × 武器 × 八方向：走路第 0 幀影子重心、第 1~3 幀影子相對第 0 幀的位移（走路幀本身就往前挪約 1/4 格）、待機第 0 幀影子重心。
// 八方向資料夾共畫布，所以每個方向各量一次即可。量不到（缺幀）就給 null，afk-townmap 會跳過那個武器改用空手。
const DIR_SFX = ['2', 'F', '', 'd3', 'd4', 'd5', 'd6', 'd7'];
function centroid(file) {
    if (!fs.existsSync(file)) return null;
    const { w, h, a } = decodePNG(fs.readFileSync(file));
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = a[y * w + x]; if (v) { sx += x * v; sy += y * v; n += v; } }
    return n ? [sx / n, sy / n] : null;
}
// 沒有影子幀時的後備：腳底（最下面幾列不透明像素的中心，往上 6px≈影子中心的高度）
function foot(file) {
    if (!fs.existsSync(file)) return null;
    const { w, h, a } = decodePNG(fs.readFileSync(file));
    let y1 = -1;
    for (let y = h - 1; y >= 0 && y1 < 0; y--) for (let x = 0; x < w; x++) if (a[y * w + x]) { y1 = y; break; }
    if (y1 < 0) return null;
    let sx = 0, n = 0;
    for (let y = Math.max(0, y1 - 3); y <= y1; y++) for (let x = 0; x < w; x++) if (a[y * w + x]) { sx += x; n++; }
    return [sx / n, y1 - 6];
}
function anchor(dir, act) { return centroid(path.join(dir, act + '_s_0.png')) || foot(path.join(dir, act + '_0.png')); }
// 寵物／怪物八方向動畫(assets/anim/<名>/d0..d7)：每方向 [走路第0幀落腳 x,y, 待機落腳 x,y]（沒走路幀就用待機的）
//   這類走路幀一輪剛好走一格、每幀往前挪 1/N 格（量過哈士奇），afk-townmap 用等分位移扣掉，不必逐幀量。
//   ⚠ 有些是原地踏步（卡司特：tools/gen-walk-anim 補的幀，身體一輪下來沒動）——照扣會每格往後滑再跳回來（玩家回報「走路怪怪的」）。
//   量第 0 幀到最後一幀的影子（沒影子量腳底）往走路方向挪了多少，不到該挪的三成＝原地踏步 → 那個方向多一個 0：[x,y, x,y, 0]
function walkMoves(dd, d) {
    const fr = fs.existsSync(dd) ? fs.readdirSync(dd).filter(f => /^walk_\d+\.png$/.test(f)).length : 0;
    if (fr < 2) return true;
    const m = (k) => centroid(path.join(dd, 'walk_s_' + k + '.png')) || foot(path.join(dd, 'walk_' + k + '.png'));   // 沒影子量腳底（身體重心會跟著揮武器晃）
    const a = m(0), b = m(fr - 1); if (!a || !b) return true;
    const D = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]][d], f = (fr - 1) / fr;
    const ex = 24 * (D[0] + D[1]) * f, ey = 12 * (D[1] - D[0]) * f, len = Math.hypot(ex, ey);
    return ((b[0] - a[0]) * ex + (b[1] - a[1]) * ey) / len > len * 0.3;
}
// 單方向動作圖（根目錄，面向左）對齊八方向：根目錄 idle_0 跟 d4~d7 的待機（沒有就走路）第 0 幀比身形——
//   身體重心疊起來算重疊比例，最像的方向（≥0.12）用它的落腳點換算 → 單方向圖的落腳點；同大小畫布的動作共用。對不上回 null（照舊各量影子）
function maskOf(file) {
    if (!fs.existsSync(file)) return null;
    const { w, h, a } = decodePNG(fs.readFileSync(file));
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[y * w + x] > 128) { sx += x; sy += y; n++; }
    return n ? { w, h, a, cx: sx / n, cy: sy / n, n } : null;
}
function overlap(A, B, dx, dy) {   // B 平移 (dx,dy) 疊到 A 上的 IoU
    let inter = 0;
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
        if (B.a[y * B.w + x] <= 128) continue;
        const X = Math.round(x + dx), Y = Math.round(y + dy);
        if (X >= 0 && Y >= 0 && X < A.w && Y < A.h && A.a[Y * A.w + X] > 128) inter++;
    }
    return inter / (A.n + B.n - inter);
}
function pngSize(file) { if (!fs.existsSync(file)) return null; const b = fs.readFileSync(file); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); }
function alignRoot(rootDir, dirs) {
    const R = maskOf(path.join(rootDir, 'idle_0.png')); if (!R) return null;
    let best = null;
    for (const d of [4, 5, 6, 7]) {
        const dd = path.join(rootDir, 'd' + d), hasIdle = fs.existsSync(path.join(dd, 'idle_0.png'));
        const W = maskOf(path.join(dd, hasIdle ? 'idle_0.png' : 'walk_0.png')); if (!W) continue;
        const dx = R.cx - W.cx, dy = R.cy - W.cy, s = overlap(R, W, dx, dy);
        const an = hasIdle ? [dirs[d][2], dirs[d][3]] : [dirs[d][0], dirs[d][1]];
        if (!best || s > best.s) best = { s, x: an[0] + dx, y: an[1] + dy };
    }
    if (!best || best.s < 0.12) return null;   // 蜘蛛腳細、重疊比例低，但用重心疊身體照樣對得上；太低的（姿勢完全不同）才放棄
    const size0 = pngSize(path.join(rootDir, 'idle_0.png'));
    best.sameCanvas = act => pngSize(path.join(rootDir, act + '_0.png')) === size0;
    return best;
}
// 發光的怪（鬼火、閃電球、火炎蛋…）：地圖上要用 screen（加亮）畫，不然暗色光暈畫成一團黑邊。
//   原本遊戲裡現場量（afk-townmap glowLook）：量的那張圖還沒下載完之前先照一般畫 → 手機上剛進地圖一陣子都是黑邊（站長 2026-10-16 回報「黑邊過一下就不見」）。
//   改成產資料時先量好（算法同 glowLook：資料夾根目錄 idle_0／attack_0／walk_0 第一張有的，只看左上 256×256）
function isGlow(dir) {
    const f = ['idle_0.png', 'attack_0.png', 'walk_0.png'].map(x => path.join(dir, x)).find(x => fs.existsSync(x));
    if (!f) return false;
    let im; try { im = decodePNG(fs.readFileSync(f), true); } catch (e) { return false; }
    const W = Math.min(im.w, 256), H = Math.min(im.h, 256);
    let vis = 0, semiDark = 0, opq = 0, opqDark = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * im.w + x, a = im.a[i]; if (a < 8) continue;
        const hi = Math.max(im.rgb[i * 3], im.rgb[i * 3 + 1], im.rgb[i * 3 + 2]);
        vis++;
        if (a < 230) { if (hi < 110) semiDark++; } else { opq++; if (hi < 90) opqDark++; }
    }
    return vis > 50 && semiDark / vis > 0.5 && (!opq || opqDark / opq < 0.2);
}
// 變身動畫(assets/morphanim/<名>{,2,F})：只有待機/攻擊沒有走路幀 → 每個資料夾 [待機落腳 x,y]
function buildAnims() {
    const r1 = v => Math.round(v * 10) / 10;
    const anim = {}, morph = {}, root = {}, inPlace = [];
    let aligned = 0;
    const aroot = path.join(REPO_ROOT, 'assets', 'anim');
    // tools/gen-walk-anim.js 補的走路幀有 .spr 的基準點（tools/walk-origin.json）：比「猜最下面的像素」準（骷髏的彎刀比腳低會猜錯、每轉一個方向跳一下）
    let ORIGIN = {}; try { ORIGIN = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tools', 'walk-origin.json'), 'utf8')); } catch (e) {}
    for (const n of fs.readdirSync(aroot)) {
        if (!fs.existsSync(path.join(aroot, n, 'd0'))) {   // 只有單方向戰鬥動作（用戶端沒有八方向圖的新怪：底比斯、提卡爾…）：也記落腳點，地圖上用單方向圖畫（不然整隻看不到）
            const r = {};
            for (const act of ['idle', 'attack', 'hurt', 'death', 'skill']) { const a = anchor(path.join(aroot, n), act); if (a) r[act] = [r1(a[0]), r1(a[1])]; }
            if (r.idle) root[n] = r;
            continue;
        }
        const dirs = [0, 1, 2, 3, 4, 5, 6, 7].map(d => {
            const dd = path.join(aroot, n, 'd' + d), og = ORIGIN[n] && ORIGIN[n][d];
            const w0 = (og && !fs.existsSync(path.join(dd, 'walk_s_0.png'))) ? og : anchor(dd, 'walk');   // 有影子照影子量（跟用戶端一致）、沒影子用基準點
            const i = anchor(dd, 'idle') || w0, w = w0 || i;   // 只有走路幀(tools/gen-walk-anim.js 補的)：待機落腳點用走路的
            if (!(i && w)) return null;
            const row = [r1(w[0]), r1(w[1]), r1(i[0]), r1(i[1])];
            if (w0 && !walkMoves(dd, d)) row.push(0);
            return row;
        });
        if (!dirs.every(Boolean)) continue;
        // 同一隻的八個方向是同一種做法：照多數決（5 個以上原地＝全部原地、3 個以下＝全部會走；個別方向是量測雜訊，像揮武器、腳底被裝飾擋住）
        const nIn = dirs.filter(r => r[4] === 0).length;
        if (nIn >= 5) dirs.forEach(r => { if (r.length === 4) r.push(0); });
        else if (nIn <= 3) dirs.forEach(r => { if (r.length === 5) r.pop(); });
        anim[n] = dirs;
        if (dirs.some(r => r[4] === 0)) inPlace.push(n);
        // 單方向的戰鬥動作（狩獵區原本那套：待機/攻擊/受傷/死亡，面向左邊）：各自的落腳點
        const r = {};
        for (const act of ['idle', 'attack', 'hurt', 'death', 'skill']) { const a = anchor(path.join(aroot, n), act); if (a) r[act] = [r1(a[0]), r1(a[1])]; }
        // 跟八方向走路對齊：各動作各量影子會不一致（同一張畫布、骷髏待機跟攻擊差 12px）、也跟走路的落腳點對不上（蜘蛛差 22px、哈維 70px）
        //   → 走路換攻擊、待機換攻擊整隻跳一下。改成：待機第 0 幀跟走路圖最像的那個方向用身體重心疊起來，換算出整張畫布的一個落腳點，同大小的動作共用
        const al = alignRoot(path.join(aroot, n), dirs, aroot + '/' + n);
        if (al) { for (const act of ['idle', 'attack', 'hurt', 'death', 'skill']) if (r[act] && al.sameCanvas(act)) r[act] = [r1(al.x), r1(al.y)]; aligned++; }
        if (Object.keys(r).length) root[n] = r;
    }
    console.log('[gen-townmap] 單方向動作圖跟走路對齊 ' + aligned + ' 個');
    const mroot = path.join(REPO_ROOT, 'assets', 'morphanim');
    for (const n of fs.readdirSync(mroot)) { const i = anchor(path.join(mroot, n), 'idle'); if (i) morph[n] = [r1(i[0]), r1(i[1])]; }
    console.log('[gen-townmap] 原地踏步的走路幀 ' + inPlace.length + ' 個：' + inPlace.slice(0, 40).join('、') + (inPlace.length > 40 ? '…' : ''));
    const glow = { anim: Object.keys(anim).concat(Object.keys(root)).filter((n, i, a) => a.indexOf(n) === i && isGlow(path.join(aroot, n))).sort(),
        morph: Object.keys(morph).filter(n => isGlow(path.join(mroot, n))).sort() };
    console.log('[gen-townmap] 發光的怪 ' + glow.anim.length + ' 個、變身 ' + glow.morph.length + ' 個：' + glow.anim.slice(0, 30).join('、') + (glow.anim.length > 30 ? '…' : ''));
    return { anim, morph, root, glow };
}
function buildHero() {
    const root = path.join(REPO_ROOT, 'assets', 'classanim');
    const names = fs.readdirSync(root);
    const avatars = names.filter(n => DIR_SFX.every(s => names.includes(n + s)));   // 含真夏納（職業式變身，同樣八方向＋走路幀）
    const out = {};
    const r1 = v => Math.round(v * 10) / 10;
    for (const av of avatars) {
        const wpns = fs.readdirSync(path.join(root, av)).map(f => (f.match(/^([a-z0-9]+)_walk_s_0\.png$/) || [])[1]).filter(Boolean);
        out[av] = {};
        for (const wk of wpns) {
            const dirs = DIR_SFX.map(s => {
                const d = path.join(root, av + s);
                const w0 = centroid(path.join(d, wk + '_walk_s_0.png')), i0 = centroid(path.join(d, wk + '_idle_s_0.png'));
                if (!w0 || !i0) return null;
                const row = [r1(w0[0]), r1(w0[1])];
                for (let k = 1; k < 4; k++) { const c = centroid(path.join(d, wk + '_walk_s_' + k + '.png')); if (!c) return null; row.push(r1(c[0] - w0[0]), r1(c[1] - w0[1])); }
                row.push(r1(i0[0]), r1(i0[1]));
                const a0 = centroid(path.join(d, wk + '_attack_s_0.png')) || i0;   // 狩獵區在地圖上打怪用的攻擊幀落腳點
                row.push(r1(a0[0]), r1(a0[1]));
                return row;
            });
            out[av][wk] = dirs.every(Boolean) ? dirs : null;
        }
    }
    const { anim, morph, root: animRoot, glow } = buildAnims();
    const js = '// 🤖 自動生成·勿手改 —— node tools/gen-townmap.js --hero-only 重生（掃 assets/classanim、anim、morphanim 的影子幀量落腳點）\n' +
        '// TOWNMAP_HERO[職業][武器] → 八方向（西北起順時針）各 [走路第0幀影子重心x,y, 第1~3幀相對位移 dx,dy ×3, 待機影子重心x,y]\n' +
        'window.TOWNMAP_HERO = ' + JSON.stringify(out) + ';\n' +
        '// TOWNMAP_ANIM[assets/anim 八方向資料夾] → 八方向各 [走路第0幀落腳x,y, 待機落腳x,y]（寵物、有走路幀的變身）\n' +
        'window.TOWNMAP_ANIM = ' + JSON.stringify(anim) + ';\n' +
        '// TOWNMAP_MORPH[assets/morphanim 資料夾] → [待機落腳x,y]（沒有走路幀的變身）\n' +
        'window.TOWNMAP_MORPH = ' + JSON.stringify(morph) + ';\n' +
        '// TOWNMAP_ANIMROOT[assets/anim 資料夾] → { idle/attack/hurt/death: [落腳x,y] }（單方向的戰鬥動作，狩獵區在地圖上打怪用）\n' +
        'window.TOWNMAP_ANIMROOT = ' + JSON.stringify(animRoot) + ';\n' +
        '// TOWNMAP_GLOW → 發光的怪（anim＝assets/anim 資料夾、morph＝assets/morphanim 資料夾）：地圖上用 screen 畫\n' +
        'window.TOWNMAP_GLOW = ' + JSON.stringify(glow) + ';\n';
    const f = path.join(OUT_DIR, 'hero.js');
    fs.writeFileSync(f, js);
    console.log('[gen-townmap] ' + path.relative(REPO_ROOT, f) + '  ' + avatars.length + ' 個職業外型、' + Object.keys(anim).length + ' 個八方向怪物/寵物、' + Object.keys(morph).length + ' 個變身資料夾');
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
else module.exports = { readMap, planTowns, planHunts, placeHunt, sqlTable, openPak, parseTil, decodeBlock, morton, MARGIN, RS, PER, maskOf, overlap, alignRoot };   // 分析用
const NO_BUILD = process.argv.includes('--no-build');   // 只重算 towns.json／hunts.json，不產圖檔
async function main() {
fs.mkdirSync(OUT_DIR, { recursive: true });
buildHero();
if (!process.argv.includes('--hero-only')) {
    const client = arg('client'), emu = arg('emu');
    if (!client || !emu) { console.error('用法：node tools/gen-townmap.js --client <天堂用戶端資料夾> --emu <模擬器資料夾> [--maps 0,4]（或 --hero-only）'); process.exit(1); }
    const sql = fs.readFileSync(path.join(emu, 'db', 'l1jdb.sql'), 'utf8');
    const db = { mapids: sqlTable(sql, 'mapids'), npc: sqlTable(sql, 'npc'), spawn: sqlTable(sql, 'spawnlist_npc'), spawnAll: sqlTable(sql, 'spawnlist'), dungeon: sqlTable(sql, 'dungeon'), getback: sqlTable(sql, 'getback') };
    const plan = planTowns(db), hplan = planHunts(db), only = arg('maps') ? new Set(arg('maps').split(',').map(Number)) : null;
    const tilePak = openPak(client, 'Tile'), townsOut = {}, huntsOut = {}, webp = await webpEncoder();
    let total = 0;
    for (const id of [...new Set([...Object.values(plan), ...Object.values(hplan)].map(p => p.map))].sort((a, b) => a - b)) {
        const b = db.mapids.find(m => +m.mapid === id);
        if (!b) { console.log('[gen-townmap] 模擬器 mapids 沒有地圖 ' + id + '，略過'); continue; }
        const M = readMap(id, { startX: +b.startX, endX: +b.endX, startY: +b.startY, endY: +b.endY }, client, emu);
        if (!M.blocks) { console.log('[gen-townmap] 用戶端沒有地圖 ' + id + ' 的 .s32，略過'); continue; }
        for (const tid in plan) {
            if (plan[tid].map !== id) continue;
            const t = placeTown(M, plan[tid]);
            if (!t) { console.log('[gen-townmap] ' + tid + ' 找不到能站的起點，略過'); continue; }
            t.back = townBack(M, plan[tid], db.getback);
            townsOut[tid] = t;
            console.log('[gen-townmap] ' + tid + ' ' + plan[tid].name + '：地圖 ' + id + '、起點 ' + (t.home[0] + M.gameX0) + ',' + (t.home[1] + M.gameY0) + '、NPC 對到位置 ' + Object.keys(t.npc).length + '/' + plan[tid].total +
                '、回城點 ' + (t.back.length ? t.back.map(c => (c[0] + M.gameX0) + ',' + (c[1] + M.gameY0)).join(' ') : '沒有（用起點）'));
        }
        for (const hid in hplan) {
            if (hplan[hid].map !== id) continue;
            const h = placeHunt(M, hplan[hid]);
            if (!h) { console.log('[gen-townmap] 狩獵 ' + hid + ' 找不到能站的起點，略過'); continue; }
            huntsOut[hid] = { map: h.map, home: h.home, spawns: h.spawns };
            console.log('[gen-townmap] 狩獵 ' + hid + '：地圖 ' + id + '、重生點 ' + h.spawns.length + ' 組 ' + h.spawns.reduce((a, s) => a + s[1], 0) + ' 隻' +
                (h.missing.length ? '（' + (h.real ? '補上' : '模擬器沒資料，全部補上') + '：' + h.missing.join('、') + '）' : ''));
        }
        if (!NO_BUILD && (!only || only.has(id))) total += await buildMapData(M, tilePak, webp);
        else {   // 這次不產圖：總表已經在的話只換安全區那欄（不用為了它重產整張圖）
            const f = path.join(OUT_DIR, 'm' + id + '.json');
            if (fs.existsSync(f)) { const d = JSON.parse(fs.readFileSync(f, 'utf8')); d.zone = zoneRuns(M); fs.writeFileSync(f, JSON.stringify(d)); }
        }
        { const z = zoneRuns(M); if (z.length) console.log('[gen-townmap] 地圖 ' + id + ' 安全區／戰鬥區 ' + z.length / 5 + ' 個矩形'); }
    }
    await webp.close();
    // towns.json：{ 村莊 id: { map 用戶端地圖, home 起點, npc { NPC 名字: 站的格子 }, spots 對不到的 NPC 用的空位, back 回城點（見 townBack）} }（地圖格座標）
    fs.writeFileSync(path.join(OUT_DIR, 'towns.json'), JSON.stringify(townsOut));
    // hunts.json：{ 狩獵地圖 id: { map, home 起點, spawns 重生點（格式見 placeHunt）}, _mob: 怪物行為旗標（見 mobFlags）}
    huntsOut._mob = mobFlags(db);
    fs.writeFileSync(path.join(OUT_DIR, 'hunts.json'), JSON.stringify(huntsOut));
    // portals.json：{ 用戶端地圖: [[起點 x, y, 目的地遊戲地圖, 終點 x, y], …] }（格式見 planPortals）
    fs.writeFileSync(path.join(OUT_DIR, 'portals.json'), JSON.stringify(planPortals(db, townsOut, huntsOut)));
    // 舊版的檔案（只有說話之島的 talking*、.js 總表／PNG 拼圖）
    fs.rmSync(path.join(OUT_DIR, 'talking'), { recursive: true, force: true });
    for (const f of fs.readdirSync(OUT_DIR)) if (/^(talking(_\d+\.png|\.js)|towns\.js|m\d+\.js)$/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f));
    console.log('[gen-townmap] 村莊 ' + Object.keys(townsOut).length + ' 個；這次產的地圖共 ' + (total / 1e6).toFixed(1) + 'MB');
}
}
