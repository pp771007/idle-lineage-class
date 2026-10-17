/* ============================================================================
 * prepush-guard.mjs — PreToolUse hook:git push 前的硬性把關
 *
 * 0. 使用者沒同意就不准 push:指令尾端要有 #user-approved(使用者親口說了才能加)。
 *    與下面那些「內容把關」分開 —— 一個管「誰決定上線」,一個管「內容夠不夠格上線」。
 *
 * 擋掉 CLAUDE.md 記過、會壞掉線上版本的雷:
 *   1. index.html / 外掛 / sw.js 殘留 rebase 衝突標記(<<<<<<< 等)→ 整頁壞掉
 *   2. 某支 afk-*.js 沒在 index.html 補 <script> 引用 → 功能失效 / 被同步洗掉
 *   3. sw.js 的 CODE_VERSION 與當前程式 hash 不一致 → 漏跑 stamp、PWA 不跳更新
 *   4. js/sfx-index.js 與 assets/sfx|bgm 對不上 → 新音檔安靜失效
 *   5. 某支 js/css/afk-*.js 的 `?v=` 沒對齊內容 → 玩家拿到新舊混搭(低機率、無法重現)
 *   6. 核心補丁沒套上 → 依賴補丁的外掛安靜失效
 *   7. CSS 用 :has() 看 .hidden → 手機戰鬥中整頁樣式一直重算、卡頓(scripts/check-css-has.mjs)
 *
 * 任一不過 → exit 2 擋下 git push,並把要修什麼印到 stderr 給 Claude。
 * 非 git push 的指令一律放行(exit 0)。
 * ========================================================================== */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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
// ⚠ Bash 與 PowerShell 兩個工具都要收:只收 Bash 的話,同一道 git push 改用 PowerShell 下就整個繞過去,把關等於沒有(實測過)
if (!/^(Bash|PowerShell)$/.test(data?.tool_name || '') || !/\bgit\s+push\b/.test(cmd)) process.exit(0);

// ── 0. 使用者同意閘 ─────────────────────────────────────────
//   「內容夠不夠格上線」與「誰決定要上線」是兩件事,下面所有把關只管前者。
//   刻意排在 #afk-tmp-upload 之前:暫存分支上傳可以跳過內容把關,但不能跳過使用者的同意。
if (!cmd.includes('#user-approved')) {
  console.error('⛔ git push 需要使用者明確同意(這個 repo 的規則)。\n' +
    '  • 使用者親口說要 push 之後,在指令尾端加註解 #user-approved 再下一次\n' +
    '  • 沒得到同意不可以自己加 —— 這道把關的意義就在這裡\n' +
    '  • 例:git push origin main   #user-approved');
  process.exit(2);
}

// 明確標記 #afk-tmp-upload 的 push 跳過內容把關:分塊上傳暫存分支(HEAD 不在 main、工作樹非交付狀態)會誤觸
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
  // 刻意停用某支外掛時,要在 index.html 寫明「暫停載入 <完整檔名>」。
  //   單純把 <script> 註解掉是不夠的——那樣「漏補引用」跟「刻意停用」長得一樣,這道把關就廢了。
  if (new RegExp('暫停載入[^\\n]*' + f.replace(/\./g, '\\.')).test(html)) continue;
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

// ── 5+6. 直接跑既有的 --check 腳本(?v= 對齊 / 外掛 DOM 錨點還在)──
//   都是「漏跑會安靜壞掉、且腳本自己就會判」的東西,不要在這裡重刻一份算法。
//   ⚠️ 2026-10-11 起不再同步上游、核心檔可直接改 → 拿掉「核心補丁就位」檢查(apply-core-patches --check):
//      直接改到補丁附近的原文就會讓它誤判失敗、擋住正常的 push。
for (const [script, why] of [
  ['scripts/stamp-code-versions.mjs', '先跑「node scripts/stamp-code-versions.mjs」再 push,否則玩家會拿到新舊混搭'],
  ['scripts/check-dom-ids.mjs', '跑「node scripts/check-dom-ids.mjs」看是哪個 id,改錨到還存在的元素——getElementById 拿到 null 不報錯,那段功能會安靜消失'],
  ['scripts/check-css-has.mjs', '跑「node scripts/check-css-has.mjs」看是哪條,把那個元素加進 js/10 syncViewStateClasses 的 MAP、CSS 改讀 body class——否則手機戰鬥會一直卡頓'],
]) {
  if (!existsSync(resolve(ROOT, script))) continue;
  const r = spawnSync(process.execPath, [resolve(ROOT, script), '--check'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    const lines = ((r.stderr || '') + '\n' + (r.stdout || '')).split('\n').map((s) => s.trim()).filter(Boolean);
    const msg = lines.find((l) => /❌|不一致|尚未|過時/.test(l)) || lines[0] || script + ' --check 失敗';
    fails.push(`${msg} → ${why}`);
  }
}

if (fails.length) {
  console.error('⛔ push 前把關沒過,先修這些再 push:\n' + fails.map((x) => '  • ' + x).join('\n'));
  process.exit(2);
}
process.exit(0);
