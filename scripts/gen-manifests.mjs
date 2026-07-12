/* ============================================================================
 * gen-manifests.mjs — 重產 assets-manifest.json / anim-manifest.json
 *   (PWA 圖桶「逐張/逐怪對帳」的依據;邏輯自原 sync-upstream.mjs 抽出,
 *    自動同步停用後,新增/更換 assets 圖時手動跑這支:node scripts/gen-manifests.mjs)
 *
 * - assets-manifest.json:走訪 assets/(排除 anim/)＋ public/assets/,每張圖列 [路徑, git blob sha]。
 *   凡是「URL 路徑含 /assets/、會被 SW 圖桶快取」的圖都必須在對帳清單裡,
 *   否則就是「快取卻不對帳 → 換圖玩家卡舊」(登入圖 public/assets/ 踩過)。
 *   排除 assets/anim/ 是因為 ~3 萬幀會讓 manifest 膨脹到 2-3MB、每次開頁都抓(流量炸)。
 * - anim-manifest.json:每個 assets/anim/<怪>/ 資料夾算一個「合併 sha」(幀增/刪/換就變),
 *   SW(reconcileAnim)逐「怪」對帳,只清有變動的那隻怪的快取。
 *
 * 內容沒變時 sha 不變 → 產出檔 byte 相同、git 不視為改動,放心重跑。
 * ⚠ 改完圖記得連 manifest 一起 commit,否則玩家端(尤其 PWA 離線)對不到新圖。
 * ========================================================================== */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

// git blob SHA(跟 GitHub 樹狀 API 回的 .sha 同演算法)
function gitBlobSha(buf) {
  return createHash('sha1').update('blob ' + buf.length + '\0').update(buf).digest('hex');
}

function walkAssets(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'desktop.ini') continue;
    const p = dir + '/' + name;
    if (statSync(p).isDirectory()) out.push(...walkAssets(p));
    else out.push(p);
  }
  return out;
}

if (existsSync('assets')) {
  const assetFiles = walkAssets('assets').filter((p) => !p.startsWith('assets/anim/') && !p.startsWith('assets/classanim/'));
  const publicFiles = existsSync('public/assets') ? walkAssets('public/assets') : [];
  const manifest = [...assetFiles, ...publicFiles].sort().map((p) => [p, gitBlobSha(readFileSync(p))]);
  writeFileSync('assets-manifest.json', JSON.stringify(manifest) + '\n');
  console.log('[gen-manifests] assets-manifest.json →', manifest.length, '筆');
}

if (existsSync('assets/sfx')) {
  // 音效「檔名 → 實際副檔名」索引。js/17-audio.js 據此直接組正確網址。
  //   沒有它的話,音效一律逐一試 .mp3→.ogg→.wav:音效庫沒有任何 mp3,故每個音效至少撈回一個
  //   404(GitHub Pages 的錯誤頁 ~9KB、進不了快取)→ 每次開遊戲、每張地圖的怪都重付一次。
  const byName = {};
  for (const p of readdirSync('assets/sfx')) {
    const m = p.match(/^(.+)\.(mp3|ogg|wav)$/);
    if (m) byName[m[1]] = m[2];
  }
  const names = Object.keys(byName).sort();
  const body = names.map((n) => JSON.stringify(n) + ':' + JSON.stringify(byName[n])).join(',');
  writeFileSync('js/sfx-index.js',
    '/* 自動產生 — 由 scripts/gen-manifests.mjs 掃 assets/sfx/ 重產,勿手改。\n' +
    ' * 音效檔名 → 實際副檔名。索引裡沒有的名稱＝沒有這個音檔,17-audio.js 直接靜音、不發請求。 */\n' +
    'var SFX_INDEX = {' + body + '};\n');
  console.log('[gen-manifests] js/sfx-index.js →', names.length, '筆');
}

{
  // anim(怪物幀) + classanim(職業戰鬥幀·v3.0.67)都走「一資料夾一合併 sha」,同進 anim-manifest.json
  const animDirs = ['assets/anim', 'assets/classanim'].filter((d) => existsSync(d));
  const byFolder = {};
  for (const dir of animDirs) for (const p of walkAssets(dir)) {
    const parts = p.split('/');           // assets/<anim|classanim>/<資料夾>/<file…>
    if (parts.length < 4) continue;       // 只收「資料夾底下」的幀,直屬檔(若有)略過
    const folder = parts.slice(0, 3).join('/');
    (byFolder[folder] ||= []).push(p);
  }
  const animManifest = Object.keys(byFolder).sort().map((folder) => {
    // 該資料夾內每個檔的 (path, blobSha) 排序後串起再 sha1 → 幀有增/刪/換,資料夾雜湊就變。
    const combined = byFolder[folder].sort().map((p) => p + '\0' + gitBlobSha(readFileSync(p))).join('\n');
    return [folder, createHash('sha1').update(combined).digest('hex')];
  });
  writeFileSync('anim-manifest.json', JSON.stringify(animManifest) + '\n');
  console.log('[gen-manifests] anim-manifest.json →', animManifest.length, '筆');
}
