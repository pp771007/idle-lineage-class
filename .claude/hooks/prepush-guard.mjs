/* ============================================================================
 * prepush-guard.mjs — PreToolUse hook:git push 前的硬性把關
 *
 * 擋掉 CLAUDE.md 記過、會壞掉線上版本的三類雷:
 *   1. index.html / 外掛 / sw.js 殘留 rebase 衝突標記(<<<<<<< 等)→ 整頁壞掉
 *   2. 某支 afk-*.js 沒在 index.html 補 <script> 引用 → 功能失效 / 被同步洗掉
 *   3. sw.js 的 CODE_VERSION 與當前程式 hash 不一致 → 漏跑 stamp、PWA 不跳更新
 *
 * 任一不過 → exit 2 擋下 git push,並把要修什麼印到 stderr 給 Claude。
 * 非 git push 的指令一律放行(exit 0)。
 * ========================================================================== */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readStdin() {
  return new Promise((r) => {
    let s = '';
    process.stdin.on('data', (c) => (s += c));
    process.stdin.on('end', () => r(s));
    process.stdin.on('error', () => r(s));
  });
}

const raw = await readStdin();
let data = {};
try { data = JSON.parse(raw); } catch {}

const cmd = data?.tool_input?.command || '';
// 只攔 git push;其餘指令直接放行
if (data?.tool_name !== 'Bash' || !/\bgit\s+push\b/.test(cmd)) process.exit(0);
// 明確標記 #afk-tmp-upload 的 push 放行:分塊上傳暫存分支(HEAD 不在 main、工作樹非交付狀態)會誤觸把關
if (cmd.includes('#afk-tmp-upload')) process.exit(0);

const fails = [];
const rd = (p) => readFileSync(resolve(ROOT, p), 'utf8');

// ── 1. 衝突標記 ──────────────────────────────────────────────
const CONFLICT = /^(<{7}|={7}|>{7})/m;
const checkFiles = ['index.html', 'sw.js'];
for (const f of readdirSync(ROOT).filter((n) => /^afk-.*\.js$/.test(n))) checkFiles.push(f);
for (const f of checkFiles) {
  if (existsSync(resolve(ROOT, f)) && CONFLICT.test(rd(f))) fails.push(`衝突標記殘留:${f}(rebase 沒解乾淨,push 會壞掉整頁)`);
}

// ── 2. 外掛 <script> 引用 ────────────────────────────────────
let html = '';
try { html = rd('index.html'); } catch {}
for (const f of readdirSync(ROOT).filter((n) => /^afk-.*\.js$/.test(n))) {
  if (!html.includes(f)) fails.push(`index.html 沒引用 ${f}(漏補 <script>,功能不生效或會被同步覆蓋)`);
}

// ── 3. sw.js CODE_VERSION 是否最新(複製 stamp-sw-version.mjs 的算法)──
try {
  const parts = [];
  // ⚠ CRLF 正規化再雜湊,與 stamp-sw-version.mjs 同步(Windows 工作樹 CRLF vs CI LF)
  const norm = (p) => Buffer.from(readFileSync(p, 'utf8').split('\r\n').join('\n'));
  if (existsSync(resolve(ROOT, 'index.html'))) parts.push(norm(resolve(ROOT, 'index.html')));
  if (existsSync(resolve(ROOT, 'manifest.webmanifest'))) parts.push(norm(resolve(ROOT, 'manifest.webmanifest')));
  for (const f of readdirSync(ROOT).filter((n) => /^afk-.*\.js$/.test(n)).sort()) parts.push(norm(resolve(ROOT, f)));
  for (const dir of ['js', 'css']) {
    const d = resolve(ROOT, dir);
    if (existsSync(d)) for (const f of readdirSync(d).filter((n) => /\.(js|css)$/.test(n)).sort()) parts.push(norm(resolve(d, f)));
  }
  const want = 'code-' + createHash('sha1').update(Buffer.concat(parts)).digest('hex').slice(0, 12);
  const m = rd('sw.js').match(/const CODE_VERSION = '([^']*)';/);
  if (m && m[1] !== want) fails.push(`sw.js CODE_VERSION 過時(現為 ${m[1]},應為 ${want})→ 先跑「node scripts/stamp-sw-version.mjs」再 push,否則 PWA 不跳更新`);
} catch {}

// ── 4. js/sfx-index.js 是否與 assets/sfx/ 與 assets/bgm/ 現況一致 ──────────
//   漏跑 gen-manifests → 新音檔不在索引 → 17-audio 當成「沒有這個檔」直接靜音/不播,無錯誤無警告(安靜失效)
try {
  const idxFile = resolve(ROOT, 'js/sfx-index.js');
  if (existsSync(idxFile)) {
    const src = rd('js/sfx-index.js');
    const wanted = (dir) => {
      const byName = {};
      for (const p of readdirSync(resolve(ROOT, dir))) {
        const m = p.match(/^(.+)\.(mp3|ogg|wav)$/);
        if (m) byName[m[1]] = m[2];
      }
      return Object.keys(byName).sort().map((n) => JSON.stringify(n) + ':' + JSON.stringify(byName[n])).join(',');
    };
    const check = (varName, dir, what) => {
      if (!existsSync(resolve(ROOT, dir))) return;
      const cur = src.match(new RegExp('var ' + varName + ' = \\{([^}]*)\\};'));   // 非貪婪:同檔含多個索引
      if (!cur || cur[1] !== wanted(dir)) fails.push(`js/sfx-index.js 的 ${varName} 與 ${dir}/ 對不上(增刪${what}後漏跑)→ 先跑「node scripts/gen-manifests.mjs」再 push,否則新${what}會安靜失效`);
    };
    check('SFX_INDEX', 'assets/sfx', '音效');
    check('BGM_INDEX', 'assets/bgm', '曲目');
  }
} catch {}

if (fails.length) {
  console.error('⛔ push 前把關沒過,先修這些再 push:\n' + fails.map((x) => '  • ' + x).join('\n'));
  process.exit(2);
}
process.exit(0);
