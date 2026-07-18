/**
 * sync-upstream.mjs — 從上游 clone 同步「核心程式碼」，套加掛版補丁，重組 index，重產 manifest。
 *
 * 這是「純上游核心 + 外掛」架構的自動更新核心步驟，取代舊的整檔合併。
 *   前提：<upstream-dir> 是原作者 repo 的本機 clone，且已 checkout 到要同步的 commit。
 *   資產（assets/ public/）由呼叫端（GitHub Action）先用 rsync --delete 鏡像好，本腳本只碰程式碼與 manifest。
 *
 * 流程：
 *   1. 用上游原版覆蓋核心 js/NN-*.js 與 css/*（保留我方 js/dograce.js、afk-*.js、scripts/、tools/）。
 *   2. index.html = 上游 index.html + 注入外掛區塊（scripts/afk-plugin-block.html）到 </body> 之前。
 *   3. 跑 apply-core-patches.mjs 把加掛版必要的核心鉤子補回去（錨點式，插不進就 exit 1）。
 *   4. 重產 anim-manifest / 對帳 manifest，stamp 版本號與 SW。
 *
 * 用法：node scripts/sync-upstream.mjs <upstream-clone-dir>
 */
import { readFileSync, writeFileSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const UP = process.argv[2];
if (!UP || !existsSync(join(UP, 'index.html'))) {
  console.error('用法: node scripts/sync-upstream.mjs <upstream-clone-dir>（該目錄需已 checkout 到目標 commit）');
  process.exit(1);
}

function run(cmd) { console.log('$ ' + cmd); execSync(cmd, { stdio: 'inherit' }); }

// ── 1) 覆蓋核心 js/NN-*.js 與 css/* ─────────────────────────────
//   只覆蓋「編號核心檔」；我方 js/dograce.js、js/sfx-index.js、js/anim-manifest.js（下面重產）不動。
const upJsFiles = readdirSync(join(UP, 'js')).filter((f) => /^\d\d?-.+\.js$/.test(f));
let copied = 0, added = 0;
for (const f of upJsFiles) {
  const dst = join('js', f);
  if (!existsSync(dst)) added++;
  copyFileSync(join(UP, 'js', f), dst);
  copied++;
}
for (const f of readdirSync(join(UP, 'css'))) copyFileSync(join(UP, 'css', f), join('css', f));
console.log(`[sync] 覆蓋核心 js ${copied} 支（新增 ${added}）+ css`);

// ── 2) 重組 index.html = 上游 + 外掛區塊 ────────────────────────
let idx = readFileSync(join(UP, 'index.html'), 'utf8');
const block = readFileSync('scripts/afk-plugin-block.html', 'utf8');
if (idx.indexOf('</body>') < 0) throw new Error('上游 index.html 找不到 </body>，無法注入外掛區塊。');
if (idx.indexOf('afk-toggles.js') >= 0) throw new Error('上游 index.html 竟已含 afk-toggles.js？請人工檢查。');
idx = idx.replace('</body>', block + '</body>');
writeFileSync('index.html', idx);
console.log('[sync] index.html = 上游 + 外掛區塊');

// ── 3) 套核心補丁（錨點式，插不進就 throw→exit1）──────────────────
run('node scripts/apply-core-patches.mjs');

// ── 4) 重產 manifest + stamp 版本 ──────────────────────────────
run('node tools/gen-anim-manifest.js');
run('node scripts/gen-manifests.mjs');
run('node scripts/stamp-code-versions.mjs');
run('node scripts/stamp-sw-version.mjs');

// ── 5) 冒煙檢查（外掛掛點）──────────────────────────────────────
run('node scripts/smoke-hooks.mjs');

console.log('\n✅ sync-upstream 完成：核心已是上游原版 + 加掛版補丁，index/manifest/版本 已更新，smoke 綠。');
