#!/usr/bin/env node
// 怪物／變身八方向走路動畫補抽工具：從天堂用戶端 .spr 解出走路動作，輸出 assets/anim/<名>/d0..d7/walk_N.png（＋影子 walk_s_N.png）
//
// 用法（在 repo 根目錄跑）：
//   node tools/gen-walk-anim.js --client "<用戶端資料夾，含 Sprite*.idx/.pak>" [--db "<l1jdb.sql>"] [--only 名,名] [--force]
//     --force＝連本工具補過的也重做（換用戶端版本時用）
//   跑完：node tools/gen-anim-manifest.js、node tools/gen-townmap.js --hero-only、node scripts/gen-manifests.mjs
//
// 對象：assets/anim 裡還沒有八方向走路幀的資料夾（怪物），加上 js/09 MORPH_BATTLE_ANIM 的變身形態。
// 名稱 → 圖檔編號：① 拿 repo 現成的圖（怪物待機第 0 幀、變身待機）算形狀簽名，到用戶端全部 .spr 第 0 幀裡找同一張（最準）；
//   ② 模擬器資料庫 npc 表同名的 gfxid（--db，備援）。用戶端沒有這隻（較新的改版內容）或不會走的（城門、守護塔）就略過。
//
// ── .spr 格式（逆向結果，跟 repo 現有八方向動畫逐像素比對過：人形殭屍、哈士奇＋影子全部一致）──
//   檔名 <gfx>-<動作×8＋方向>.spr；動作 0＝走路；方向 0..7＝畫面 西北,北,東北,東,東南,南,西南,西（＝天堂 heading）
//   有調色盤版：[0xff][色數 n(0＝256)][n × RGB555][幀數]；舊版沒調色盤：開頭直接是幀數，像素 2 bytes RGB555
//   每幀：int16 x0,y0,x1,y1、uint16、uint16、uint16 小塊數 k，k × [半格x int8][y int8][圖層][小塊編號 uint16]
//   int32 小塊數 B、B × int32 位移、4 bytes、小塊資料（位移從這 4 bytes 之後算）
//   小塊＝[xo][yo][w][h] 後 h 列：段數，每段 [跳過 bytes/2][像素數][像素]（同 .til 壓縮型）
//   拼法＝地圖物件：半格 (hx,y) 小塊左上角在 (24(cx+y) - (hx奇?0:24), 12(y-cx) - 11)、cx＝hx>>1，依圖層由小到大畫
//   影子＝gfx+1（同動作、同幀數、全是深灰才算）
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const REPO = path.resolve(__dirname, '..');
function arg(n) { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; }
const CLIENT = arg('client'), DB = arg('db'), ONLY = arg('only') ? new Set(arg('only').split(',')) : null;
const MAIN = require.main === module;   // 被 tools/fix-walk-gfx.js 引用時只拿解檔函式，不跑
if (MAIN && !CLIENT) { console.error('用法：node tools/gen-walk-anim.js --client <用戶端資料夾> [--db <l1jdb.sql>] [--only 名,名] [--gfx 名=編號,…] [--walk 名=組,…]'); process.exit(1); }
const BW = 24, BH = 23;
// --gfx 名=編號：直接指定圖檔編號（tools/fix-walk-gfx.js 照長相找出來的；名字對到的編號抓錯隻時用）
const kv = s => Object.fromEntries((s || '').split(',').filter(Boolean).map(s => { const i = s.lastIndexOf('='); return [s.slice(0, i), +s.slice(i + 1)]; }));
const GFX_FIX = kv(arg('gfx'));
// --walk 名=組：走路不在第 0 組（子檔 0~7）的圖檔，指定第幾組（子檔 組×8 ~ 組×8+7）。
//   有些圖檔的動作順序是 攻擊、待機、受傷、死亡、出場、走路（石頭高崙 3914、骷髏 30、史巴托 145、巴風特 53 的走路都在第 5 組；巴蘭卡 3664 在第 1 組），
//   照第 0 組抽就把攻擊（或出場）當走路，地圖上整路揮拳（站長 2026-10-16 回報石頭高崙）。抽完會檢查，跟原作別的動作同一張就警告
const WALK_GRP = kv(arg('walk'));

// ── 用戶端 idx/pak ───────────────────────────────
const index = new Map(), fds = {};
function openClient(dir) {
    for (const f of fs.readdirSync(dir).filter(f => /^Sprite\d*\.idx$/i.test(f))) {
        const b = fs.readFileSync(path.join(dir, f)), n = b.readInt32LE(0), pak = path.join(dir, f.replace(/\.idx$/i, '.pak'));
        for (let i = 0; i < n; i++) { const o = 4 + i * 28; index.set(b.toString('latin1', o + 4, o + 24).replace(/\0.*$/, '').toLowerCase(), { pak, off: b.readUInt32LE(o), size: b.readInt32LE(o + 24) }); }
    }
}
if (CLIENT) openClient(CLIENT);
function readEntry(e) { const fd = fds[e.pak] || (fds[e.pak] = fs.openSync(e.pak, 'r')); const buf = Buffer.alloc(e.size); fs.readSync(fd, buf, 0, e.size, e.off); return buf; }

// ── .spr ─────────────────────────────────────────
function c555(v) { return [((v >> 10) & 31) * 255 / 31 | 0, ((v >> 5) & 31) * 255 / 31 | 0, (v & 31) * 255 / 31 | 0]; }
function parse(b) {
    let p = 0, pal = null;
    if (b[0] === 0xff) { p = 1; const n = b[p++] || 256; pal = []; for (let i = 0; i < n; i++) { pal.push(c555(b.readUInt16LE(p))); p += 2; } }
    const nF = b[p++], frames = [];
    for (let f = 0; f < nF; f++) {
        const k = b.readUInt16LE(p + 12), parts = []; p += 14;
        for (let i = 0; i < k; i++) { parts.push({ hx: b.readInt8(p), y: b.readInt8(p + 1), layer: b[p + 2], id: b.readUInt16LE(p + 3), n: i }); p += 5; }
        frames.push(parts);
    }
    const nB = b.readInt32LE(p); p += 4;
    const offs = []; for (let i = 0; i < nB; i++) { offs.push(b.readInt32LE(p)); p += 4; }
    return { b, pal, frames, offs, base: p + 4 };
}
function block(s, id) {
    const b = s.b; let p = s.base + s.offs[id];
    const out = new Int32Array(BW * BH).fill(-1), wide = !s.pal;
    const xo = b[p], yo = b[p + 1], h = b[p + 3]; p += 4;
    for (let r = 0; r < h; r++) {
        const segs = b[p++]; let x = xo;
        for (let q = 0; q < segs; q++) { x += b[p++] / 2; const c = b[p++]; for (let i = 0; i < c; i++) { const v = wide ? b.readUInt16LE(p) : b[p]; if (x < BW && yo + r < BH) out[(yo + r) * BW + x] = v; x++; p += wide ? 2 : 1; } }
    }
    return out;
}
function partPos(hx, y) { const cx = hx >> 1; return [24 * (cx + y) - (hx & 1 ? 0 : 24), 12 * (y - cx) - 11]; }
function render(s, f) {   // → { minX, minY, w, h, rgba }（相對格線原點）
    const parts = s.frames[f].slice().sort((a, c) => a.layer - c.layer || a.n - c.n);
    if (!parts.length) return null;
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const q of parts) { const [x, y] = partPos(q.hx, q.y); minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x + BW); maxY = Math.max(maxY, y + BH); }
    const w = maxX - minX, h = maxY - minY, rgba = new Uint8Array(w * h * 4);
    for (const q of parts) {
        let px; try { px = block(s, q.id); } catch (e) { continue; }   // 用戶端少數檔案小塊資料不完整：跳過那塊
        const [ox, oy] = partPos(q.hx, q.y);
        for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
            const c = px[y * BW + x]; if (c < 0) continue;
            const d = ((oy - minY + y) * w + ox - minX + x) * 4, col = s.pal ? s.pal[c] : c555(c);
            if (!col) continue;
            rgba[d] = col[0]; rgba[d + 1] = col[1]; rgba[d + 2] = col[2]; rgba[d + 3] = 255;
        }
    }
    return { minX, minY, w, h, rgba };
}
function load(g, n) { const e = index.get(g + '-' + n + '.spr'); if (!e) return null; try { const s = parse(readEntry(e)); return s.frames.length ? s : null; } catch (x) { return null; } }

// ── PNG ─────────────────────────────────────────
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); }
function encodePNG(w, h, rgba) {
    const stride = w * 4, raw = Buffer.alloc((stride + 1) * h), prev = Buffer.alloc(stride);
    for (let y = 0; y < h; y++) {
        const cur = Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride);
        let best = null, bestSum = Infinity;
        for (const ft of [0, 1, 2, 4]) {
            const o = Buffer.alloc(stride); let sum = 0;
            for (let i = 0; i < stride; i++) {
                const a = i >= 4 ? cur[i - 4] : 0, b = prev[i], c = i >= 4 ? prev[i - 4] : 0;
                const p = ft === 0 ? 0 : ft === 1 ? a : ft === 2 ? b : (() => { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; })();
                o[i] = (cur[i] - p) & 255; sum += o[i] < 128 ? o[i] : 256 - o[i];
            }
            if (sum < bestSum) { bestSum = sum; best = [ft, o]; }
        }
        raw[y * (stride + 1)] = best[0]; best[1].copy(raw, y * (stride + 1) + 1); cur.copy(prev);
    }
    const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function alphaOf(buf) {   // repo 現成圖 → { w, h, a }
    let p = 8, w = 0, h = 0, ct = 6, trns = null; const idat = [];
    while (p < buf.length) { const len = buf.readUInt32BE(p), t = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (t === 'tRNS') trns = d; else if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break; p += 12 + len; }
    const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct], stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), img = Buffer.alloc(stride * h);
    for (let y = 0; y < h; y++) { const ft = raw[y * (stride + 1)], s = y * (stride + 1) + 1, o = y * stride; for (let i = 0; i < stride; i++) { const a = i >= bpp ? img[o + i - bpp] : 0, b = y ? img[o - stride + i] : 0, c = (i >= bpp && y) ? img[o - stride + i - bpp] : 0; let v = raw[s + i]; if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1; else if (ft === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += (pa <= pb && pa <= pc) ? a : pb <= pc ? b : c; } img[o + i] = v & 255; } }
    const a = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = ct === 6 ? img[i * 4 + 3] : ct === 4 ? img[i * 2 + 1] : ct === 3 ? (trns && img[i] < trns.length ? trns[img[i]] : 255) : 255;
    return { w, h, a };
}
// 形狀簽名：裁到不透明範圍後的寬、高、像素數、每列像素數雜湊（不受顏色換算差異影響）
function sigOf(w, h, alphaAt) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (alphaAt(x, y)) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    let hs = 2166136261;
    for (let y = y0; y <= y1; y++) { let c = 0; for (let x = x0; x <= x1; x++) if (alphaAt(x, y)) c++; hs = Math.imul(hs ^ c, 16777619) >>> 0; }
    return (x1 - x0 + 1) + 'x' + (y1 - y0 + 1) + 'x' + n + 'x' + hs;
}

function framesOf(s) { const out = []; for (let k = 0; k < s.frames.length; k++) out.push(render(s, k)); return out; }
const animRoot = path.join(REPO, 'assets/anim');
if (!MAIN) module.exports = { openClient, index, load, render, framesOf, alphaOf, sigOf, animRoot };
else main();
function main() {
// ── 對象與編號 ─────────────────────────────────────
const vfx = fs.readFileSync(path.join(REPO, 'js/09-vfx-render.js'), 'utf8');
const morphs = [...new Set([...vfx.match(/const MORPH_BATTLE_ANIM = new Set\(\[([\s\S]*?)\]\)/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]))];
// 已經有八方向走路的就不動；--force 時重做本工具補過的（d0 只有 walk、沒有 idle），原本整套八方向的照樣不碰
//   --origin＝對象同 --force，但不重寫圖，只補每個方向的基準點 walk-origin.json（見下方輸出段）
const ORIGIN_ONLY = process.argv.includes('--origin');
const FORCE = process.argv.includes('--force') || ORIGIN_ONLY;
const hasWalk = n => fs.existsSync(path.join(animRoot, n, 'd0', 'walk_0.png')) && (!FORCE || fs.existsSync(path.join(animRoot, n, 'd0', 'idle_0.png')));
function firstPng(dir, prefer) {
    for (const f of prefer) if (fs.existsSync(path.join(dir, f))) return path.join(dir, f);
    const any = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /_0\.png$/.test(f) && !/_s_|_w_/.test(f)) : [];
    return any.length ? path.join(dir, any[0]) : null;
}
const targets = [];
for (const n of fs.readdirSync(animRoot)) if (fs.statSync(path.join(animRoot, n)).isDirectory() && !hasWalk(n)) targets.push({ name: n, img: firstPng(path.join(animRoot, n), ['idle_0.png', 'd6/idle_0.png', 'attack_0.png']) });
for (const n of morphs) if (!hasWalk(n) && !targets.some(t => t.name === n)) targets.push({ name: n, img: firstPng(path.join(REPO, 'assets/morphanim', n), ['idle_0.png', 'attack_0.png']) });
const todo = ONLY ? targets.filter(t => ONLY.has(t.name)) : targets;

const wanted = new Map();   // 簽名 → 對象名
for (const t of todo) {
    if (!t.img) continue;
    try { const { w, h, a } = alphaOf(fs.readFileSync(t.img)); const s = sigOf(w, h, (x, y) => a[y * w + x]); if (s) (wanted.get(s) || wanted.set(s, []).get(s)).push(t); } catch (e) {}
}
console.log('[gen-walk-anim] 對象', todo.length, '個，掃用戶端 .spr 找同一張圖…');
if (todo.some(t => !GFX_FIX[t.name])) for (const [name, e] of index) {   // 只算第 0 幀簽名，比到對象的就記下編號（全部都 --gfx 指定了就不用掃）
    const m = name.match(/^(\d+)-\d+\.spr$/); if (!m) continue;
    let s; try { s = parse(readEntry(e)); } catch (x) { continue; }
    if (!s.frames.length) continue;
    const r = render(s, 0); if (!r) continue;
    const sg = sigOf(r.w, r.h, (x, y) => r.rgba[(y * r.w + x) * 4 + 3]);
    const hit = wanted.get(sg); if (hit) hit.forEach(t => (t.sigG = t.sigG || new Set()).add(+m[1]));
}
// 模擬器資料庫(MySQL dump)：npc 表的 name → gfxid（逐字元解析 INSERT 的值，字串裡的逗號、跳脫字元都照顧到）
function sqlRows(text, tbl) {
    const ci = text.indexOf('CREATE TABLE `' + tbl + '`'); if (ci < 0) return [];
    const cols = [...text.slice(ci, text.indexOf(';', ci)).matchAll(/^\s*`([^`]+)`/gm)].map(m => m[1]), rows = [];
    const re = new RegExp('INSERT INTO `' + tbl + '`[^V]*VALUES\\s*', 'g'); let m;
    while ((m = re.exec(text))) {
        let p = re.lastIndex;
        while (text[p] === '(') {
            p++; const row = []; let cur = '', inS = false;
            for (;;) {
                const c = text[p];
                if (inS) { if (c === '\\') { cur += text[p + 1]; p += 2; continue; } if (c === "'") { inS = false; p++; continue; } cur += c; p++; continue; }
                if (c === "'") { inS = true; p++; continue; }
                if (c === ',' || c === ')') { row.push(cur.trim()); cur = ''; p++; if (c === ')') break; continue; }
                cur += c; p++;
            }
            rows.push(Object.fromEntries(cols.map((k, i) => [k, row[i]])));
            if (text[p] === ',') p++;
            while (/\s/.test(text[p] || '')) p++;
        }
        re.lastIndex = p;
    }
    return rows;
}
const byName = {};
if (DB) for (const r of sqlRows(fs.readFileSync(DB, 'utf8'), 'npc')) {
    const nm = String(r.name || '').trim().replace(/\\f./g, ''), g = parseInt(r.gfxid, 10);
    if (nm && g) (byName[nm] = byName[nm] || new Set()).add(g);
}

// ── 輸出 ─────────────────────────────────────────
function isShadow(body, sh) {
    if (!sh || sh.length !== body.length) return false;
    for (const r of sh) if (r) for (let i = 0; i < r.rgba.length; i += 4) if (r.rgba[i + 3]) { const R = r.rgba[i], G = r.rgba[i + 1], B = r.rgba[i + 2]; if (Math.max(R, G, B) > 110 || Math.abs(R - G) > 16 || Math.abs(G - B) > 16) return false; }
    return true;
}
let done = 0, files = 0, bytes = 0; const miss = [], origins = {}, warn = [];
for (const t of todo) {
    const db = [...(byName[t.name] || [])], sg = [...(t.sigG || [])];
    const cands = GFX_FIX[t.name] ? [GFX_FIX[t.name]] : [...new Set([...sg.filter(g => db.includes(g)), ...sg, ...db])];
    const W0 = (WALK_GRP[t.name] || 0) * 8;
    let g = null;
    for (const c of cands) { let ok = 0; for (let d = 0; d < 8; d++) if (load(c, W0 + d)) ok++; if (ok >= 7) { g = c; break; } }
    if (g == null) { miss.push(t.name + (cands.length ? '（用戶端沒有八方向走路檔）' : '（找不到圖檔編號）')); continue; }
    // 基準點：.spr 每幀的小塊位置是相對「角色站的那一格中心」，裁成 PNG 後那一點在 (-minX, -minY)＝腳底落點。
    //   存進 tools/walk-origin.json { 名: [[x, y] ×8 方向] }，tools/gen-townmap.js 量落腳點時優先用它
    //   （沒影子的走路幀以前只能猜「最下面的像素」，骷髏的彎刀比腳低就猜錯，每轉一個方向就跳一下：玩家回報「骷髏跟史巴托圖檔怪怪的」）
    const origin = [];   // → origins（存 tools/walk-origin.json，見最後）
    for (let d = 0; d < 8; d++) {
        let s = load(g, W0 + d), dd = d;
        if (!s) { dd = (d + 7) % 8; s = load(g, W0 + dd); }   // 少數方向檔壞掉：借隔壁方向
        if (!s) continue;
        const body = framesOf(s), ss = load(g + 1, W0 + dd), sh = ss ? framesOf(ss) : null, useSh = isShadow(body, sh);
        if (d === 5) {   // 原作單方向圖＝第 5 方向：走路幀跟原作的攻擊／出場／受傷／死亡同一張 → 抓錯動作組（待機常常就是走路，不算）
            const rs = new Map(); for (const f of fs.readdirSync(path.join(animRoot, t.name)).filter(f => /^(attack|spawn|hurt|death|skill)_\d+\.png$/.test(f))) { try { const { w, h, a } = alphaOf(fs.readFileSync(path.join(animRoot, t.name, f))); rs.set(sigOf(w, h, (x, y) => a[y * w + x]), f); } catch (e) {} }
            const same = body.map(r => r && rs.get(sigOf(r.w, r.h, (x, y) => r.rgba[(y * r.w + x) * 4 + 3]))).filter(Boolean);
            if (same.length) warn.push(t.name + '（' + g + ' 第 ' + W0 / 8 + ' 組＝原作 ' + same[0].replace(/_\d+\.png$/, '') + '，用 --walk ' + t.name + '=組 指定走路那組）');
        }
        let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
        for (const r of body.concat(useSh ? sh : [])) if (r) { minX = Math.min(minX, r.minX); minY = Math.min(minY, r.minY); maxX = Math.max(maxX, r.minX + r.w); maxY = Math.max(maxY, r.minY + r.h); }
        minX--; minY--; maxX++; maxY++;
        const W = maxX - minX, H = maxY - minY, dir = path.join(animRoot, t.name, 'd' + d);
        origin[d] = [-minX, -minY];
        if (ORIGIN_ONLY) continue;
        fs.mkdirSync(dir, { recursive: true });
        const put = (r, file) => {
            const img = new Uint8Array(W * H * 4);
            if (r) for (let y = 0; y < r.h; y++) img.set(r.rgba.subarray(y * r.w * 4, (y + 1) * r.w * 4), ((r.minY - minY + y) * W + (r.minX - minX)) * 4);
            const png = encodePNG(W, H, img); fs.writeFileSync(path.join(dir, file), png); files++; bytes += png.length;
        };
        body.forEach((r, k) => put(r, 'walk_' + k + '.png'));
        if (useSh) sh.forEach((r, k) => put(r, 'walk_s_' + k + '.png'));
    }
    if (origin.filter(Boolean).length === 8) origins[t.name] = origin;
    done++;
}
// 基準點集中存一個檔（工具用，不跟遊戲發佈）：{ 名: [[x, y] ×8] }，跟舊的合併
{
    const f = path.join(REPO, 'tools', 'walk-origin.json');
    let all = {}; try { all = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {}
    Object.assign(all, origins);
    const sorted = {}; Object.keys(all).sort().forEach(k => { sorted[k] = all[k]; });
    fs.writeFileSync(f, JSON.stringify(sorted, null, 0).replace(/\],"/g, '],\n"') + '\n');
    console.log('[gen-walk-anim] 基準點 ' + Object.keys(origins).length + ' 個 → tools/walk-origin.json');
}
console.log('[gen-walk-anim] 完成 ' + done + ' / ' + todo.length + ' 個，' + files + ' 個檔，' + (bytes / 1e6).toFixed(1) + 'MB');
if (miss.length) console.log('[gen-walk-anim] 略過：' + miss.join('、'));
if (warn.length) console.log('[gen-walk-anim] ⚠ 走路可能抓錯動作：' + warn.join('、'));
}
