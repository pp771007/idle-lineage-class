// sheet-rebuild.mjs — 遊戲資料改版後(有人刪/加了物品、怪物…),把試算表重做成「跟現在的遊戲對得上」的版本
//
//   node scripts/sheet-rebuild.mjs <舊試算表.xlsx> [輸出.xlsx] [--base <git版本>]   輸出預設 ../遊戲數值表(重建).xlsx
//
//   --base:舊試算表是從哪一版遊戲匯出的(例:別人改資料前的那個 commit)。
//     🚨 一定要給:不給的話,舊表裡「別人後來改掉的數值」會被當成「我們改的」寫回去,等於把別人的修改蓋掉。
//
// 做法:
//   1. 把舊表裡「遊戲已經沒有的東西」那幾列拿掉(ID 對不到的物品/怪物/魔法、掉落裡的已刪物品或怪、地圖裡的已刪怪)
//   2. 用清乾淨的表跑一次 sheet-apply,得到「你們改過的地方」(寫到暫存檔,不動遊戲裡的 js/00y)
//   3. 用現在的遊戲資料重新匯出整份試算表,再把「你們改過的地方」疊上去
// → 新加進遊戲的東西會出現、刪掉的會消失、你們改過的數字和新增的 my_ 物品都保留。
// 拿掉了哪些列會印出來,讓人確認裡面沒有自己改過、還想要的東西。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import { ROOT, ID_HEAD, DATA_VERSION_LABEL, DELETED_SHEET, NEW_PREFIX, MAGIC_SLOTS, loadGame, RECORD_SHEETS, mobNamer } from './sheet-lib.mjs';

const args = process.argv.slice(2);
const bi = args.indexOf('--base');
let base = bi >= 0 ? args.splice(bi, 2)[1] : null;
const src = args[0];
if (!src) { console.error('用法:node scripts/sheet-rebuild.mjs <舊試算表.xlsx> [輸出.xlsx] [--base <舊表匯出時的 git 版本>]'); process.exit(1); }
const out = path.resolve(args[1] || path.join(ROOT, '..', '遊戲數值表(重建).xlsx'));
const G = loadGame();
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(src);
// 沒給 --base 就讀表裡記的資料版本;兩者都沒有就不做(猜錯基準會把別人的修改蓋掉)
if (!base) {
  const help = wb.getWorksheet('使用說明');
  help?.eachRow(row => { const t = String(row.getCell(1).value || ''); if (t.startsWith(DATA_VERSION_LABEL)) base = t.slice(DATA_VERSION_LABEL.length).trim() || null; });
}
if (!base) { console.error(`這份試算表沒有記錄是從哪一版遊戲匯出的(「使用說明」分頁最後一列),請用 --base 指定。`); process.exit(1); }
console.log('比對基準(這份表匯出時的遊戲版本):' + base);
const text = (c) => { let v = c.value; if (v && typeof v === 'object') v = v.result ?? v.text ?? (v.richText ? v.richText.map(t => t.text).join('') : null); return v == null ? '' : String(v).trim(); };
const colOf = (ws) => { const m = {}; ws.getRow(1).eachCell((c, i) => { m[text(c)] = i; }); return m; };
const removed = {};
const drop = (sheet, label) => (removed[sheet] ||= []).push(label);

// ── 1. 清掉對不到的列 ──
for (const def of RECORD_SHEETS) {
  const ws = wb.getWorksheet(def.sheet); if (!ws) continue;
  const c = colOf(ws)[ID_HEAD]; if (!c) continue;
  const valid = new Set(def.rows(G).map(r => r[0]));
  const kill = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const id = text(row.getCell(c)); if (!id) return;
    if (valid.has(id)) return;
    if (def.allowNew === 'item' && id.startsWith(NEW_PREFIX)) return;
    if (def.allowNew === 'magic') { const [mid, slot] = id.split(':'); if (G.DB.mobs[mid] && MAGIC_SLOTS.includes(slot)) return; }
    kill.push(i); drop(def.sheet, id);
  });
  kill.reverse().forEach(i => ws.spliceRows(i, 1));
}
// 遊戲已經刪掉的新物品(js/00y 的 deletedNew)：表裡還有那列就拿掉，並記進「刪除的新物品」分頁
const gameDeleted = (() => { try { const c = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'js', '00y-my-tweaks-data.js'), 'utf8'))(c); return c.MY_TWEAKS?.deletedNew || []; } catch { return []; } })();
if (gameDeleted.length) {
  for (const def of RECORD_SHEETS) if (def.allowNew === 'item') {
    const ws = wb.getWorksheet(def.sheet); const c = ws && colOf(ws)[ID_HEAD]; if (!c) continue;
    const kill = []; ws.eachRow((row, i) => { if (i > 1 && gameDeleted.includes(text(row.getCell(c)))) { kill.push(i); drop(def.sheet, text(row.getCell(c)) + '(已刪除)'); } });
    kill.reverse().forEach(i => ws.spliceRows(i, 1));
  }
  let dws = wb.getWorksheet(DELETED_SHEET);
  if (!dws) { dws = wb.addWorksheet(DELETED_SHEET); dws.addRow(['ID']); }
  const have = new Set(); dws.eachRow((row, i) => { if (i > 1) have.add(text(row.getCell(1))); });
  for (const id of gameDeleted) if (!have.has(id)) dws.addRow([id]);
}
const newIds = new Set();
for (const def of RECORD_SHEETS) if (def.allowNew === 'item') {
  const ws = wb.getWorksheet(def.sheet); const c = ws && colOf(ws)[ID_HEAD];
  if (c) ws.eachRow((row, i) => { const id = text(row.getCell(c)); if (i > 1 && id.startsWith(NEW_PREFIX)) newIds.add(id); });
}
{ // 掉落
  const ws = wb.getWorksheet('掉落');
  if (ws) {
    const c = colOf(ws), mobNames = new Set([...Object.keys(G.MOB_DROPS), ...Object.values(G.DB.mobs).map(m => m.n)]);
    const kill = [];
    ws.eachRow((row, i) => {
      if (i === 1) return;
      const mid = text(row.getCell(c['怪物ID'] || 0)), mob = text(row.getCell(c['怪物名稱'])), item = text(row.getCell(c['物品ID']));
      if (!mid && !mob && !item) return;
      const mobOk = mid ? !!G.DB.mobs[mid] : mobNames.has(mob);
      if (mobOk && (G.DB.items[item] || newIds.has(item))) return;
      kill.push(i); drop('掉落', `${mob || mid} → ${item}`);
    });
    kill.reverse().forEach(i => ws.spliceRows(i, 1));
  }
}
{ // 地圖:整列地圖不見就拿掉;出現怪物裡已刪的怪拿掉
  const ws = wb.getWorksheet('地圖');
  if (ws) {
    const c = colOf(ws), { toId } = mobNamer(G), kill = [];
    ws.eachRow((row, i) => {
      if (i === 1) return;
      const id = text(row.getCell(c[ID_HEAD])); if (!id) return;
      if (!Array.isArray(G.DB.maps[id])) { kill.push(i); drop('地圖', id); return; }
      const names = text(row.getCell(c['出現怪物'])).split(/[、,，\n]+/).map(s => s.trim()).filter(Boolean);
      const keep = names.filter(n => toId(n));
      if (keep.length !== names.length) { names.filter(n => !toId(n)).forEach(n => drop('地圖', `${id} 裡的 ${n}`)); row.getCell(c['出現怪物']).value = keep.join('、'); }
    });
    kill.reverse().forEach(i => ws.spliceRows(i, 1));
  }
}
{ // 禮物:物品已經不在遊戲裡的那幾列拿掉
  const ws = wb.getWorksheet('禮物');
  if (ws) {
    const c = colOf(ws), kill = [];
    ws.eachRow((row, i) => { if (i === 1 || !c['物品ID']) return; const item = text(row.getCell(c['物品ID'])); if (item && !G.DB.items[item] && !newIds.has(item)) { kill.push(i); drop('禮物', item); } });
    kill.reverse().forEach(i => ws.spliceRows(i, 1));
  }
}
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sheet-rebuild-'));
const cleaned = path.join(tmpDir, 'cleaned.xlsx');
const tweaks = path.join(tmpDir, 'tweaks.js');
await wb.xlsx.writeFile(cleaned);

// ── 2./3. 算出改過的地方 → 用現在的遊戲重新匯出並疊上 ──
// 「改過的地方」要跟舊表匯出時的遊戲比,才分得出是我們改的、還是別人後來改的
const baseRoot = path.join(tmpDir, 'base');
fs.mkdirSync(path.join(baseRoot, 'js'), { recursive: true });
for (const f of ['00-data.js', '01-drops-config.js', '11-world-map.js']) {
  fs.writeFileSync(path.join(baseRoot, 'js', f), execFileSync('git', ['show', `${base}:js/${f}`], { cwd: ROOT, maxBuffer: 64 << 20 }));
}
const env = { ...process.env, SHEET_DATA_OUT: tweaks };
try {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'sheet-apply.mjs'), cleaned], { env: { ...env, SHEET_GAME_ROOT: baseRoot }, stdio: 'inherit' });
} catch {
  console.error('\n清掉對不到的列之後,表裡還有上面這些問題,先修好再重跑。');
  process.exit(1);
}
const nowVer = (() => { try { return execFileSync('git', ['log', '-1', '--format=%H', '--', 'js/00-data.js', 'js/01-drops-config.js', 'js/11-world-map.js'], { cwd: ROOT }).toString().trim(); } catch { return ''; } })();
execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'sheet-export.mjs'), out], { env: { ...env, SHEET_DATA_VERSION: nowVer }, stdio: 'inherit' });

console.log('\n拿掉的列(遊戲裡已經沒有這些東西):');
for (const [s, list] of Object.entries(removed)) console.log(`  ${s} ${list.length} 列:${list.slice(0, 12).join('、')}${list.length > 12 ? ' …' : ''}`);
if (!Object.keys(removed).length) console.log('  (沒有)');
fs.rmSync(tmpDir, { recursive: true, force: true });
