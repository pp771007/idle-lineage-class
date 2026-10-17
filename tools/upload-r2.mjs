#!/usr/bin/env node
// 把村莊動態地圖的資料（assets/townmap/ 的 towns.json、m<圖>.json、m<圖>/ 的區檔與拼圖）上傳到 Cloudflare R2
//   S3 相容 API、自己簽 AWS SigV4（Node 內建 crypto＋fetch，不用裝套件）。
//
// 用法（在 repo 根目錄跑，先 node tools/gen-townmap.js 產好資料）：
//   node tools/upload-r2.mjs [--dry-run] [--prune]
//   node tools/upload-r2.mjs --local <資料夾> --public <網址>   ← 不上傳，照 R2 的樣子寫到本機資料夾（測試用）
// 金鑰放 repo 根目錄 .env.r2（.gitignore 有擋，不進版控）：
//   R2_ENDPOINT=https://<帳號ID>.r2.cloudflarestorage.com
//   R2_ACCESS_KEY_ID=…
//   R2_SECRET_ACCESS_KEY=…
//   R2_BUCKET=…
//   R2_PUBLIC_URL=https://pub-….r2.dev（或自己的網域）
//
// 檔名帶內容雜湊（r12_3.<雜湊>.bin、p0.<雜湊>.webp、m4.<雜湊>.json…）：
//   - 重產地圖時只有內容變了的檔換名字 → 只上傳那些，沒變的不用重傳
//   - 檔案永遠不改內容 → 快取一年；玩家不會拿到新舊混在一起的資料
//   區檔、拼圖的雜湊檔名寫進各圖總表的 files 欄位；入口寫在 assets/townmap/remote.json（跟遊戲一起發佈，afk-townmap 先讀它）。
//   --prune：刪掉 R2 上這次沒用到的舊檔（確認新版上線、玩家都換過去之後再跑）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets', 'townmap');
const PREFIX = 'townmap/';
const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const flag = n => process.argv.includes('--' + n);
const TYPES = { '.json': 'application/json', '.bin': 'application/octet-stream', '.webp': 'image/webp' };
const CACHE = 'public, max-age=31536000, immutable';

// ── 簽章（AWS SigV4；R2 的 region＝auto、service＝s3）────────────────
const sha256hex = b => crypto.createHash('sha256').update(b).digest('hex');
const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
export function signV4({ method, url, headers = {}, payloadHash, accessKey, secretKey, region, service, now }) {
    const u = new URL(url);
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''), day = amzDate.slice(0, 8);
    const h = { ...headers, host: u.host, 'x-amz-date': amzDate };
    const names = Object.keys(h).map(k => k.toLowerCase()).sort();
    const val = n => String(h[Object.keys(h).find(k => k.toLowerCase() === n)]).trim().replace(/\s+/g, ' ');
    const canonQuery = [...u.searchParams].map(([k, v]) => [enc(k), enc(v)]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1)).map(p => p[0] + '=' + p[1]).join('&');
    const canonPath = u.pathname.split('/').map(s => enc(decodeURIComponent(s))).join('/');
    const creq = [method, canonPath, canonQuery, names.map(n => n + ':' + val(n) + '\n').join(''), names.join(';'), payloadHash].join('\n');
    const scope = day + '/' + region + '/' + service + '/aws4_request';
    const sts = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(creq)].join('\n');
    const key = hmac(hmac(hmac(hmac('AWS4' + secretKey, day), region), service), 'aws4_request');
    h.authorization = 'AWS4-HMAC-SHA256 Credential=' + accessKey + '/' + scope + ', SignedHeaders=' + names.join(';') + ', Signature=' + crypto.createHmac('sha256', key).update(sts).digest('hex');
    return h;
}

// ── 要上傳的東西：檔名換成內容雜湊 ───────────────────────────
const hash = b => crypto.createHash('sha1').update(b).digest('hex').slice(0, 10);
const named = (name, buf) => name.replace(/(\.[a-z]+)$/, '.' + hash(buf) + '$1');
function plan(publicUrl) {
    if (!fs.existsSync(path.join(SRC, 'towns.json'))) throw new Error('沒有 assets/townmap/towns.json：先跑 node tools/gen-townmap.js');
    const objs = new Map();   // R2 上的 key → { file 或 body, type }
    const remote = { v: 1, base: publicUrl.replace(/\/+$/, '') + '/' + PREFIX, towns: '', maps: {} };
    for (const f of fs.readdirSync(SRC).sort()) {
        const m = f.match(/^m(\d+)\.json$/); if (!m) continue;
        const id = m[1], dir = path.join(SRC, 'm' + id), d = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
        d.files = { r: {}, p: [] };
        for (const g of fs.readdirSync(dir).sort()) {
            const file = path.join(dir, g), n = named(g, fs.readFileSync(file));
            objs.set(PREFIX + 'm' + id + '/' + n, { file, type: TYPES[path.extname(g)] });
            let k;
            if ((k = g.match(/^r(\d+_\d+)\.bin$/))) d.files.r[k[1]] = n;
            else if ((k = g.match(/^p(\d+)\.webp$/))) d.files.p[+k[1]] = n;
        }
        if (d.files.p.length !== d.pages || d.files.p.some(x => !x)) throw new Error('m' + id + ' 拼圖頁數對不上：先重跑 gen-townmap');
        const body = Buffer.from(JSON.stringify(d)), n = named('m' + id + '.json', body);
        objs.set(PREFIX + n, { body, type: TYPES['.json'] });
        remote.maps[id] = n;
    }
    const tb = fs.readFileSync(path.join(SRC, 'towns.json')), tn = named('towns.json', tb);
    objs.set(PREFIX + tn, { body: tb, type: TYPES['.json'] });
    remote.towns = tn;
    if (fs.existsSync(path.join(SRC, 'hunts.json'))) {   // 狩獵地圖的起點與怪物重生點
        const hb = fs.readFileSync(path.join(SRC, 'hunts.json')), hn = named('hunts.json', hb);
        objs.set(PREFIX + hn, { body: hb, type: TYPES['.json'] });
        remote.hunts = hn;
    }
    if (fs.existsSync(path.join(SRC, 'portals.json'))) {   // 傳送點（樓梯、洞口、碼頭）
        const pb = fs.readFileSync(path.join(SRC, 'portals.json')), pn = named('portals.json', pb);
        objs.set(PREFIX + pn, { body: pb, type: TYPES['.json'] });
        remote.portals = pn;
    }
    return { objs, remote };
}

// ── R2（S3 API）────────────────────────────────────────────
function loadEnv() {
    const f = path.join(ROOT, '.env.r2');
    if (!fs.existsSync(f)) throw new Error('沒有 .env.r2（金鑰檔，格式見這支檔頭）');
    const env = {};
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2]; }
    for (const k of ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL']) if (!env[k]) throw new Error('.env.r2 少了 ' + k);
    return env;
}
function r2(env) {
    const base = env.R2_ENDPOINT.replace(/\/+$/, '') + '/' + env.R2_BUCKET;
    async function call(method, key, { query = '', body = null, headers = {} } = {}) {
        const url = base + (key ? '/' + key.split('/').map(enc).join('/') : '') + (query ? '?' + query : '');
        const payloadHash = sha256hex(body || '');
        const h = signV4({ method, url, headers: { ...headers, 'x-amz-content-sha256': payloadHash }, payloadHash, accessKey: env.R2_ACCESS_KEY_ID, secretKey: env.R2_SECRET_ACCESS_KEY, region: 'auto', service: 's3', now: new Date() });
        delete h.host;   // fetch 會照網址自己帶
        for (let tryN = 1; ; tryN++) {
            const res = await fetch(url, { method, headers: h, body }).catch(e => ({ ok: false, status: 0, text: async () => String(e) }));
            if (res.ok) return res;
            if (tryN >= 3 || (res.status >= 400 && res.status < 500)) throw new Error(method + ' ' + (key || '') + ' → ' + res.status + ' ' + (await res.text()).slice(0, 300));
            await new Promise(r => setTimeout(r, 1000 * tryN));
        }
    }
    return {
        async list(prefix) {
            const keys = new Set(); let token = null;
            do {
                const q = 'continuation-token=' + (token ? enc(token) : '') + '&list-type=2&prefix=' + enc(prefix);
                const xml = await (await call('GET', '', { query: token ? q : 'list-type=2&prefix=' + enc(prefix) })).text();
                for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.add(m[1].replace(/&amp;/g, '&'));
                token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/) || [])[1] : null;
            } while (token);
            return keys;
        },
        put: (key, body, type) => call('PUT', key, { body, headers: { 'content-type': type, 'cache-control': CACHE } }),
        del: key => call('DELETE', key),
    };
}
async function pool(items, n, fn) {
    let i = 0; const run = async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } };
    await Promise.all(Array.from({ length: n }, run));
}

async function main() {
    const local = arg('local'), dry = flag('dry-run');
    const env = local ? null : loadEnv();
    const publicUrl = local ? arg('public') : env.R2_PUBLIC_URL;
    if (!publicUrl) throw new Error('--local 要配 --public <網址>');
    const { objs, remote } = plan(publicUrl);
    let total = 0; for (const o of objs.values()) total += o.body ? o.body.length : fs.statSync(o.file).size;
    console.log('[upload-r2] 地圖 ' + Object.keys(remote.maps).join(',') + '：' + objs.size + ' 個檔、' + (total / 1e6).toFixed(1) + 'MB');
    const store = local ? {
        list: async () => { const s = new Set(), walk = d => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else s.add(path.relative(local, p).split(path.sep).join('/')); } }; walk(path.join(local, PREFIX)); return s; },
        put: async (key, body) => { const p = path.join(local, key); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); },
        del: async key => fs.rmSync(path.join(local, key), { force: true }),
    } : r2(env);
    const have = await store.list(PREFIX);
    const todo = [...objs.keys()].filter(k => !have.has(k));
    let bytes = 0; for (const k of todo) { const o = objs.get(k); bytes += o.body ? o.body.length : fs.statSync(o.file).size; }
    console.log('[upload-r2] 已經在上面 ' + (objs.size - todo.length) + ' 個，要上傳 ' + todo.length + ' 個（' + (bytes / 1e6).toFixed(1) + 'MB）' + (dry ? '（--dry-run，不傳）' : ''));
    if (!dry) {
        let done = 0, last = 0;
        await pool(todo, 8, async k => {
            const o = objs.get(k);
            await store.put(k, o.body || fs.readFileSync(o.file), o.type);
            if (++done - last >= 200 || done === todo.length) { last = done; console.log('[upload-r2]   ' + done + '/' + todo.length); }
        });
    }
    if (flag('prune')) {
        const old = [...have].filter(k => !objs.has(k));
        console.log('[upload-r2] 刪掉沒用到的舊檔 ' + old.length + ' 個' + (dry ? '（--dry-run，不刪）' : ''));
        if (!dry) await pool(old, 8, k => store.del(k));
    }
    if (dry) return;
    fs.writeFileSync(path.join(SRC, 'remote.json'), JSON.stringify(remote, null, 1) + '\n');
    console.log('[upload-r2] 寫好 assets/townmap/remote.json → 跑 node scripts/gen-manifests.mjs，再把 remote.json 跟遊戲一起 commit');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error('[upload-r2] ' + e.message); process.exit(1); });
