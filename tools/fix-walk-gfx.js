#!/usr/bin/env node
// 怪物八方向走路圖「抓錯隻」的找出來（站長 2026-10-16：石頭高崙走路是淺色大隻、打起來變深褐小隻）
//   tools/gen-walk-anim.js 找圖檔編號時，原作待機圖的形狀簽名要「一模一樣」才算比到；比不到就退回模擬器資料庫同名 npc 的 gfxid，
//   同名不同隻（象牙塔石頭高崙、帶法術特效的版本）就抓錯了。
//   這支改用「長相」比：原作待機圖（assets/anim/<名>/idle_0.png，面向左）跟用戶端每個圖檔的待機／走路第 0 幀比形狀＋顏色，
//   找最像、而且八個方向都有走路的編號；跟現在的走路圖比，明顯更像的列出來，並印出重抽指令（gen-walk-anim --force --only … --gfx 名=編號）
//
// 用法：node tools/fix-walk-gfx.js --client <用戶端資料夾，含 Sprite*.idx/.pak> [--only 名,名] [--margin 0.06]
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const W = require('./gen-walk-anim.js');
const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const CLIENT = arg('client'), ONLY = arg('only') ? new Set(arg('only').split(',')) : null, MARGIN = +(arg('margin') || 0.06);
if (!CLIENT) { console.error('用法：node tools/fix-walk-gfx.js --client <用戶端資料夾> [--only 名,名]'); process.exit(1); }
W.openClient(CLIENT);

// ── PNG → RGBA（原作圖、現在的走路圖）────────────────────────
function decodePNG(buf) {
    let p = 8, w = 0, h = 0, ct = 6, pal = null, trns = null; const idat = [];
    while (p < buf.length) { const len = buf.readUInt32BE(p), t = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (t === 'PLTE') pal = d; else if (t === 'tRNS') trns = d; else if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break; p += 12 + len; }
    const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct], stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), img = Buffer.alloc(stride * h);
    for (let y = 0; y < h; y++) { const ft = raw[y * (stride + 1)], s = y * (stride + 1) + 1, o = y * stride; for (let i = 0; i < stride; i++) { const a = i >= bpp ? img[o + i - bpp] : 0, b = y ? img[o - stride + i] : 0, c = (i >= bpp && y) ? img[o - stride + i - bpp] : 0; let v = raw[s + i]; if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1; else if (ft === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += (pa <= pb && pa <= pc) ? a : pb <= pc ? b : c; } img[o + i] = v & 255; } }
    const rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        let r, g, b, a = 255;
        if (ct === 6) { r = img[i * 4]; g = img[i * 4 + 1]; b = img[i * 4 + 2]; a = img[i * 4 + 3]; }
        else if (ct === 2) { r = img[i * 3]; g = img[i * 3 + 1]; b = img[i * 3 + 2]; }
        else if (ct === 3) { const k = img[i]; r = pal[k * 3]; g = pal[k * 3 + 1]; b = pal[k * 3 + 2]; a = trns && k < trns.length ? trns[k] : 255; }
        else if (ct === 4) { r = g = b = img[i * 2]; a = img[i * 2 + 1]; }
        else { r = g = b = img[i]; }
        rgba.set([r, g, b, a], i * 4);
    }
    return { w, h, rgba };
}
// ── 長相描述：裁到不透明範圍、縮成 G×G 格，每格「佔多少」＋平均顏色；另記寬高比、高度 ──────
const G = 12;
function describe(w, h, rgba, mirror) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rgba[(y * w + x) * 4 + 3] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, occ = new Float32Array(G * G), col = new Float32Array(G * G * 3), cnt = new Float32Array(G * G);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = (y * w + x) * 4; if (rgba[i + 3] <= 128) continue;
        let gx = Math.min(G - 1, ((x - x0) * G / bw) | 0); if (mirror) gx = G - 1 - gx;
        const c = Math.min(G - 1, ((y - y0) * G / bh) | 0) * G + gx;
        cnt[c]++; col[c * 3] += rgba[i]; col[c * 3 + 1] += rgba[i + 1]; col[c * 3 + 2] += rgba[i + 2];
    }
    const cell = (bw * bh) / (G * G);
    for (let c = 0; c < G * G; c++) { occ[c] = Math.min(1, cnt[c] / cell); if (cnt[c]) { col[c * 3] /= cnt[c]; col[c * 3 + 1] /= cnt[c]; col[c * 3 + 2] /= cnt[c]; } }
    return { bw, bh, ar: Math.log(bw / bh), occ, col };
}
function dist(a, b) {
    let s = 0, cs = 0, cn = 0;
    for (let c = 0; c < G * G; c++) {
        s += Math.abs(a.occ[c] - b.occ[c]);
        if (a.occ[c] > 0.3 && b.occ[c] > 0.3) { cs += (Math.abs(a.col[c * 3] - b.col[c * 3]) + Math.abs(a.col[c * 3 + 1] - b.col[c * 3 + 1]) + Math.abs(a.col[c * 3 + 2] - b.col[c * 3 + 2])) / 765; cn++; }
    }
    const shape = s / (G * G), color = cn ? cs / cn : 0.5, ar = Math.abs(a.ar - b.ar), size = Math.abs(Math.log(a.bh / b.bh));
    return shape + 0.8 * color + 0.25 * ar + 0.15 * size;
}
const both = (w, h, rgba) => { const d = describe(w, h, rgba, false); return d ? [d, describe(w, h, rgba, true)] : null; };

// ── 對象：有原作待機圖、又有八方向走路圖（本工具補的：d0 只有 walk）的怪 ──────────
const targets = fs.readdirSync(W.animRoot).filter(n => (!ONLY || ONLY.has(n)) && fs.existsSync(path.join(W.animRoot, n, 'idle_0.png'))
    && fs.existsSync(path.join(W.animRoot, n, 'd0', 'walk_0.png')) && !fs.existsSync(path.join(W.animRoot, n, 'd0', 'idle_0.png')));
const T = targets.map(n => {
    const r = decodePNG(fs.readFileSync(path.join(W.animRoot, n, 'idle_0.png'))), rd = describe(r.w, r.h, r.rgba, false);
    let cur = Infinity;
    for (let d = 0; d < 8; d++) { const f = path.join(W.animRoot, n, 'd' + d, 'walk_0.png'); if (!fs.existsSync(f)) continue; const p = decodePNG(fs.readFileSync(f)), ds = both(p.w, p.h, p.rgba); if (ds && rd) cur = Math.min(cur, dist(rd, ds[0]), dist(rd, ds[1])); }
    return { n, rd, cur, best: Infinity, g: null };
}).filter(t => t.rd);
console.log('[fix-walk-gfx] 對象 ' + T.length + ' 隻，掃用戶端圖檔…');

// ── 掃用戶端：每個圖檔的走路（動作 0）、待機（動作 3）八方向第 0 幀 ───────────────
const byG = new Map();
for (const name of W.index.keys()) { const m = name.match(/^(\d+)-(\d+)\.spr$/); if (!m) continue; const g = +m[1], k = +m[2]; if (k < 8 || (k >= 24 && k < 32)) (byG.get(g) || byG.set(g, []).get(g)).push(k); }
let scanned = 0;
for (const [g, ks] of byG) {
    if (ks.filter(k => k < 8).length < 7) continue;   // 八方向走路不齊的不要（抽不出走路圖）
    const descs = [];
    for (const k of ks) { const s = W.load(g, k); if (!s) continue; const r = W.render(s, 0); if (!r) continue; const ds = both(r.w, r.h, r.rgba); if (ds) descs.push(...ds); }
    scanned++;
    for (const t of T) for (const d of descs) {
        if (Math.abs(Math.log(t.rd.bh / d.bh)) > 0.45) continue;   // 高度差太多的不比（省時間）
        const v = dist(t.rd, d); if (v < t.best) { t.best = v; t.g = g; }
    }
}
console.log('[fix-walk-gfx] 比了 ' + scanned + ' 個有八方向走路的圖檔');
const fix = T.filter(t => t.g != null && t.cur - t.best > MARGIN).sort((a, b) => (b.cur - b.best) - (a.cur - a.best));
for (const t of fix) console.log(t.n + '：現在 ' + t.cur.toFixed(3) + ' → 圖檔 ' + t.g + ' ' + t.best.toFixed(3));
console.log('[fix-walk-gfx] 建議重抽 ' + fix.length + ' 隻');
if (fix.length) console.log('node tools/gen-walk-anim.js --client "' + CLIENT + '" --force --only "' + fix.map(t => t.n).join(',') + '" --gfx "' + fix.map(t => t.n + '=' + t.g).join(',') + '"');
fs.writeFileSync(path.join(__dirname, '..', '.scratch', 'fix-walk-gfx.json'), JSON.stringify(T.map(t => ({ n: t.n, cur: +t.cur.toFixed(3), best: +t.best.toFixed(3), g: t.g })), null, 1));
