// sheet-export.mjs — 把遊戲目前的數值匯出成 Excel(第一次建立試算表、或之後加新分頁時用)
//
//   node scripts/sheet-export.mjs [輸出路徑]      預設輸出到 repo 外層的 ../遊戲數值表.xlsx
//
// 匯出的是「原始值＋目前已套用的修改」(有 js/00y-my-tweaks-data.js 就疊上去),
// 所以拿它重建試算表不會把已經改過的數字洗回原樣。
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { execFileSync } from 'node:child_process';
import {
  ROOT, CONFIG, CUSTOM_IMG_DIR, DATA_OUT, ID_HEAD, DATA_VERSION_LABEL, DELETED_SHEET, RATE_SHEET, RATE_ROWS, GIFT_SHEET, GIFT_COLS, loadGame, getPath, setPath, RECORD_SHEETS, HOME_ROWS, HOME_DEFAULTS,
  reqToZh, dropHidden, mobNamer,
} from './sheet-lib.mjs';

const out = path.resolve(process.argv[2] || path.join(ROOT, '..', '遊戲數值表.xlsx'));
const G = loadGame();

// 疊上目前已套用的修改
let T = {};
if (fs.existsSync(DATA_OUT)) {
  const ctx = {};
  new Function('window', fs.readFileSync(DATA_OUT, 'utf8'))(ctx);
  T = ctx.MY_TWEAKS || {};
}
for (const [id, o] of Object.entries(T.newItems || {})) G.DB.items[id] = o;
for (const [mid, slots] of Object.entries(T.newMagic || {})) if (G.DB.mobs[mid]) Object.assign(G.DB.mobs[mid], slots);
for (const store of ['items', 'mobs', 'skills', 'sets']) {
  const base = { items: G.DB.items, mobs: G.DB.mobs, skills: G.DB.skills, sets: G.DB.sets }[store];
  for (const [id, kv] of Object.entries(T[store] || {})) for (const [p, v] of Object.entries(kv)) if (base[id]) setPath(base[id], p, v);
}
for (const [id, list] of Object.entries(T.maps || {})) G.DB.maps[id] = list;
for (const [mob, list] of Object.entries(T.drops || {})) G.MOB_DROPS[mob] = list;

const wb = new ExcelJS.Workbook();
const HEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3F3F46' } };
const LOCK = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
const white = { color: { argb: 'FFFFFFFF' }, bold: true };
function header(ws, cols, frozenCols) {
  ws.columns = cols.map(c => ({ header: c.zh, width: c.width || 11 }));
  ws.getRow(1).eachCell((cell, i) => {
    cell.fill = HEAD; cell.font = white; cell.alignment = { wrapText: true, vertical: 'middle' };
    if (cols[i - 1].note) cell.note = cols[i - 1].note;
  });
  ws.views = [{ state: 'frozen', xSplit: frozenCols, ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
}

// ── 使用說明 ─────────────────────────────────────────────
const help = wb.addWorksheet('使用說明');
help.columns = [{ width: 100 }];
// 第一列:「更新遊戲」頁的連結(update.html，網址取 sheet-config.json 的 site)。改完點它就好，不用自己去 GitHub。
{
  let site = '';
  try { site = String(JSON.parse(fs.readFileSync(CONFIG, 'utf8')).site || ''); } catch {}
  if (site) {
    const c = help.addRow([{ text: '👉 改完按這裡更新遊戲', hyperlink: site.replace(/\/?$/, '/') + 'update.html' }]).getCell(1);
    c.font = { bold: true, size: 14, color: { argb: 'FF2563EB' }, underline: true };
    help.addRow([]);
  }
}
[
  '怎麼改:',
  '1. 到下方分頁直接改數字或文字。',
  '2. 灰底的欄位不要改(ID 是遊戲用來認東西的;其他灰底欄只是給你參考,改了也不會套用)。',
  '3. 格子留空白 = 維持原本的數值。想設成 0 就填 0。',
  '',
  '新增武器/防具/飾品/道具:在該分頁最下面加一列——',
  '   ID 用 my_ 開頭(例:my_sword1,只能英文數字底線)、填「範本ID(新增用)」= 照哪一件現有的做、取一個新名稱,再改你要的數值。',
  '   外觀圖、類型、特殊效果都照範本;沒填的數值也照範本。要讓人拿得到,記得到「掉落」分頁加一列。',
  '自訂圖檔:把圖(建議 64x64 的 PNG)上傳到 GitHub 的 assets/custom 資料夾,再到「圖檔(自訂)」欄填檔名。新的、舊的東西都可以換圖。',
  '   不想讓人再拿到:刪掉它的掉落即可。確定要整個刪掉:把那一列拿掉,並把 ID 寫進「刪除的新物品」分頁(玩家身上的也會一起消失)。',
  '新增怪物魔法:在「怪物魔法」分頁加一列,ID 寫「怪物ID:mag」(已經有 mag 就用 mag2、mag3…),每一欄都要填。',
  '查詢:「查詢」分頁輸入怪物ID或物品ID,會列出牠的掉落、魔法、出現地圖,或哪些怪會掉這件東西。',
  '禮物:「禮物」分頁一列一份,按「更新遊戲」後,禮物會出現在收件角色血條右上方的信箱(📬),點「領取」才進背包(每份每個角色只領一次)。發過的編號不要改；送裝備可在「強化」欄填 +幾。',
  '',
  '4. 改完點最上面的「改完按這裡更新遊戲」,按頁面上的按鈕,約 5 分鐘後上線(也可以到 GitHub → Actions → 「更新遊戲」→ Run workflow)。',
  '5. 填錯(例如數字欄填了文字)不會上線,GitHub 上會顯示是哪一格要改。',
  '',
  '可用職業:用「、」分隔,例如:騎士、妖精。全部職業可用就填:全職業',
  '地圖:「出現怪物」欄用「、」分隔,每隻寫成「名稱(ID)」;只填名稱或只填 ID 也可以。怪物 ID 可到怪物分頁查。',
  '掉落:一列 = 一隻怪掉一樣東西。要新增就加一列:怪物ID 或怪物名稱填一個、物品ID、機率;整列刪掉 = 不再掉。',
  '      機率是百分比:填 1 代表 1%,填 0.01 代表 0.01%。物品 ID 可以到武器/防具/飾品/道具分頁查。',
].forEach(t => help.addRow([t]));
help.getRow(1).font = { bold: true };
// 記下這份表是從哪一版遊戲資料匯出的(sheet-rebuild 靠它分辨「我們改的」和「別人後來改的」)。
//   SHEET_DATA_VERSION 由 sheet-rebuild 傳入(它疊的是「現在」的遊戲);否則取資料檔最後一次被改的 commit。
{
  let ver = process.env.SHEET_DATA_VERSION || '';
  if (!ver) try {
    ver = execFileSync('git', ['log', '-1', '--format=%H', '--', 'js/00-data.js', 'js/01-drops-config.js', 'js/11-world-map.js'], { cwd: ROOT }).toString().trim();
  } catch { /* 沒有 git 就不記;rebuild 時要手動給 --base */ }
  help.addRow([]);
  const r = help.addRow([DATA_VERSION_LABEL + ver]);
  r.font = { color: { argb: 'FF9CA3AF' }, size: 9 };
}

// ── 首頁 ────────────────────────────────────────────────
const home = wb.addWorksheet('首頁');
home.columns = [{ header: '項目', width: 12 }, { header: '內容', width: 60 }, { header: '說明', width: 60 }];
home.getRow(1).eachCell(c => { c.fill = HEAD; c.font = white; });
for (const r of HOME_ROWS) {
  const v = T.home?.[r.key] ?? HOME_DEFAULTS[r.key] ?? '';
  const row = home.addRow([r.zh, Array.isArray(v) ? v.join(' | ') : v, r.note]);
  row.getCell(1).fill = LOCK;
  row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  row.getCell(3).font = { color: { argb: 'FF6B7280' } };
}

// ── 倍率 ────────────────────────────────────────────────
{
  const ws = wb.addWorksheet(RATE_SHEET);
  ws.columns = [{ header: '項目', width: 16 }, { header: '倍率', width: 10 }, { header: '說明', width: 60 }];
  ws.getRow(1).eachCell(c => { c.fill = HEAD; c.font = white; });
  for (const r of RATE_ROWS) {
    const row = ws.addRow([r.zh, (T.rates && T.rates[r.key]) || 1, r.note]);
    row.getCell(1).fill = LOCK; row.getCell(3).font = { color: { argb: 'FF6B7280' } };
  }
}

// ── 禮物 ────────────────────────────────────────────────
{
  const ws = wb.addWorksheet(GIFT_SHEET);
  const notes = { '編號': '每份禮物一個不重複的編號。發出去後不要改、不要重用(玩家靠它判斷領過沒)',
    '收件角色': '角色名稱；填「全部」＝每個角色都有', '類型': '物品 或 金幣', '物品ID': '類型是物品才填', '數量': '1 以上', '強化': '武器/防具/飾品才填，例如 6＝+6；留空＝+0', '備註': '會顯示在玩家的信箱裡' };
  header(ws, GIFT_COLS.map(h => ({ zh: h, width: h === '備註' ? 30 : (h === '物品ID' ? 22 : 12), note: notes[h] })), 1);
  for (const g of (T.gifts || [])) ws.addRow([g.id, g.to, g.kind === 'gold' ? '金幣' : '物品', g.item || '', g.cnt, g.en || '', g.note || '']);
}

// ── 一般分頁 ─────────────────────────────────────────────
for (const def of RECORD_SHEETS) {
  const ws = wb.addWorksheet(def.sheet);
  const cols = [{ zh: ID_HEAD, width: 22 }, ...def.cols];
  header(ws, cols, 2);
  const base = { items: G.DB.items, mobs: G.DB.mobs, skills: G.DB.skills, sets: G.DB.sets }[def.store];
  for (const [rowKey, recId, prefix] of def.rows(G)) {
    const rec = base[recId];
    const sub = prefix ? getPath(rec, prefix.slice(0, -1)) : rec;
    const row = ws.addRow([rowKey, ...def.cols.map(c => {
      if (c.type === 'show') return c.show(rec, sub, recId) ?? '';
      if (c.type === 'tpl') return rec._tpl || '';
      if (c.type === 'img') { const v = getPath(rec, c.key); return typeof v === 'string' && v.startsWith(CUSTOM_IMG_DIR) ? v.slice(CUSTOM_IMG_DIR.length) : ''; }
      const v = getPath(rec, prefix + c.key);
      if (v == null) return '';
      if (c.type === 'req') return reqToZh(v);
      if (c.type === 'pct') return Math.round(v * 1e6) / 1e4;
      return typeof v === 'object' ? '' : v;
    })]);
    row.getCell(1).fill = LOCK;
    def.cols.forEach((c, i) => { if (c.type === 'show') row.getCell(i + 2).fill = LOCK; });
  }
}

// ── 地圖 ────────────────────────────────────────────────
{
  const ws = wb.addWorksheet('地圖');
  const cols = [{ zh: ID_HEAD, width: 20 }, { zh: '地圖名稱', width: 18 }, { zh: '出現怪物', width: 100, note: '用「、」分隔' }];
  header(ws, cols, 2);
  const { toText } = mobNamer(G);
  for (const [id, list] of Object.entries(G.DB.maps)) {
    if (!Array.isArray(list)) continue;
    const row = ws.addRow([id, G.MAP_NAMES[id] || '', list.map(toText).join('、')]);
    row.getCell(1).fill = LOCK; row.getCell(2).fill = LOCK;
    row.getCell(3).alignment = { wrapText: true, vertical: 'top' };
  }
}

// ── 掉落 ────────────────────────────────────────────────
{
  const ws = wb.addWorksheet('掉落');
  const cols = [
    { zh: '怪物ID', width: 18, note: '新增掉落時填怪物ID或怪物名稱其中一個就好' }, { zh: '怪物名稱', width: 22 },
    { zh: '物品ID', width: 24 }, { zh: '物品名稱', width: 20 }, { zh: '機率(%)', width: 10, note: '填 1 = 1%' },
  ];
  header(ws, cols, 2);
  // 掉落表以「名稱」為鍵;同名的怪(例:白目玩家 1/2 代)共用一份,ID 欄寫第一個
  const idOf = {};
  for (const [id, m] of Object.entries(G.DB.mobs)) idOf[m.n] ??= id;
  for (const [mob, list] of Object.entries(G.MOB_DROPS)) {
    for (const [itemId, p] of list) {
      if (!G.DB.items[itemId] || dropHidden(G, itemId)) continue;   // 遊戲裡已經沒有的物品(被刪掉的)不列
      const row = ws.addRow([idOf[mob] || '', mob, itemId, G.DB.items[itemId]?.n || '', p]);
      row.getCell(4).fill = LOCK;
    }
  }
}

// ── 刪除的新物品(確定要刪的 my_ 物品;沿用目前遊戲裡的清單) ─────────────
{
  const ws = wb.addWorksheet(DELETED_SHEET);
  header(ws, [{ zh: 'ID', width: 22, note: '要刪掉的新物品 ID(my_ 開頭)。刪掉後玩家身上的也會消失,不能復原' }], 1);
  for (const id of (T.deletedNew || [])) ws.addRow([id]);
}

// ── 查詢(只給人看,套用時不讀;公式由 Google 試算表計算) ─────────────
//   欄位位置對應:掉落 A怪物ID B怪物名稱 C物品ID D物品名稱 E機率;怪物魔法 A列ID B怪物ID … D~I;地圖 A ID B名稱 C出現怪物
{
  const ws = wb.addWorksheet('查詢');
  const INPUT = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };
  ws.columns = [12, 22, 10, 2, 14, 10, 10, 10, 10, 8, 2, 16, 18, 2, 14, 22, 16, 18, 10].map(w => ({ width: w }));
  const put = (addr, v, bold) => { const c = ws.getCell(addr); c.value = v; if (bold) c.font = { bold: true }; return c; };
  // 怪物查詢
  put('A1', '怪物ID ▶', true); const m = put('B1', 'orc'); m.fill = INPUT;
  put('A2', '名稱'); put('B2', { formula: 'IFERROR(VLOOKUP(B1,怪物!A:B,2,FALSE),"找不到這個怪物ID")' });
  put('A4', '會掉落', true); ['物品ID', '物品名稱', '機率(%)'].forEach((h, i) => put(String.fromCharCode(65 + i) + '5', h, true));
  put('A6', { formula: 'IFERROR(FILTER(掉落!C2:E,(掉落!A2:A=B1)+(掉落!B2:B=B2)),"沒有")' });
  put('E4', '會用的魔法', true); ['魔法名稱', '冷卻', '機率(%)', '骰(顆)', '骰(面)', '屬性'].forEach((h, i) => put(String.fromCharCode(69 + i) + '5', h, true));
  put('E6', { formula: 'IFERROR(FILTER(怪物魔法!D2:I,LEFT(怪物魔法!A2:A,LEN(B1)+1)=B1&":"),"沒有")' });
  put('L4', '出現在地圖', true); put('L5', '地圖ID', true); put('M5', '地圖名稱', true);
  put('L6', { formula: 'IFERROR(FILTER(地圖!A2:B,ISNUMBER(SEARCH("("&B1&")",地圖!C2:C))+REGEXMATCH("、"&地圖!C2:C&"、","、"&B1&"、")),"沒有")' });
  // 物品查詢
  put('O1', '物品ID ▶', true); const it = put('P1', 'wpn_katana'); it.fill = INPUT;
  put('O2', '名稱');
  put('P2', { formula: 'IFERROR(VLOOKUP(P1,武器!A:B,2,FALSE),IFERROR(VLOOKUP(P1,防具!A:B,2,FALSE),IFERROR(VLOOKUP(P1,飾品!A:B,2,FALSE),IFERROR(VLOOKUP(P1,道具!A:B,2,FALSE),"找不到這個物品ID"))))' });
  put('O4', '哪些怪會掉', true); ['怪物ID', '怪物名稱', '物品ID', '物品名稱', '機率(%)'].forEach((h, i) => put(String.fromCharCode(79 + i) + '5', h, true));
  put('O6', { formula: 'IFERROR(FILTER(掉落!A2:E,掉落!C2:C=P1),"沒有")' });
  ws.views = [{ state: 'frozen', ySplit: 5 }];
}

await wb.xlsx.writeFile(out);
console.log('已輸出:' + out);
