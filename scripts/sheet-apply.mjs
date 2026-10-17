// sheet-apply.mjs — 讀試算表 → 檢查 → 產生 js/00y-my-tweaks-data.js
//
//   node scripts/sheet-apply.mjs                 從 sheet-config.json 的 Google 試算表下載
//   node scripts/sheet-apply.mjs <檔案.xlsx>      用本機的 xlsx(測試用)
//
// 只把「跟原始值不一樣」的寫進輸出檔;有任何一格填錯就整批不寫(exit 1),
// 錯誤用白話列出「哪個分頁、哪一列、哪一欄、該怎麼改」(GitHub Actions 上也寫進執行摘要)。
// 分頁整個不見 = 那一類維持原樣(不是清空),方便之後才補分頁。
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {
  ROOT, CUSTOM_IMG_DIR, DATA_OUT, CONFIG, ID_HEAD, DELETED_SHEET, RATE_SHEET, RATE_ROWS, GIFT_SHEET, GIFT_COLS, GIFT_OPT_COLS, GIFT_TO_ALL, GIFT_KINDS, TPL_HEAD, NEW_PREFIX, MAGIC_SLOTS, loadGame, getPath, setPath, newItemFrom,
  RECORD_SHEETS, HOME_ROWS, HOME_DEFAULTS, zhToReq, dropHidden, mobNamer,
} from './sheet-lib.mjs';

const errors = [];
const err = (msg) => errors.push(msg);
const MAX_ERR = 50;

// ── 取得試算表 ───────────────────────────────────────────
const wb = new ExcelJS.Workbook();
const arg = process.argv[2];
if (arg) {
  await wb.xlsx.readFile(arg);
} else {
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const s = String(cfg.googleSheet || '');
  const m = s.match(/\/d\/([\w-]{20,})/) || s.match(/^([\w-]{20,})$/);
  if (!m) fail('sheet-config.json 裡還沒填 Google 試算表的網址。');
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${m[1]}/export?format=xlsx`, { redirect: 'follow' });
  const buf = Buffer.from(await res.arrayBuffer());
  // 沒開「知道連結的人可以檢視」時 Google 會回登入頁(HTML),不是 xlsx(zip 開頭 PK)
  if (!res.ok || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    fail('讀不到 Google 試算表:請到試算表右上角「共用」,把一般存取權改成「知道連結的任何人」可以「檢視」。');
  }
  await wb.xlsx.load(buf);
}

// 儲存格 → 純值(公式取結果、RichText 接起來、超連結取文字)
function val(cell) {
  let v = cell.value;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) v = v.result;
    else if (v.richText) v = v.richText.map(t => t.text).join('');
    else if ('text' in v) v = v.text;
  }
  if (typeof v === 'string') v = v.trim();
  return v === '' || v === undefined ? null : v;
}
function columnsOf(ws, name, need) {
  const colOf = {};
  ws.getRow(1).eachCell((c, i) => { colOf[String(val(c) || '')] = i; });
  for (const h of need) if (!colOf[h]) err(`「${name}」分頁找不到「${h}」欄(第 1 列的欄名不要改)。`);
  return colOf;
}
function toNumber(raw) {
  return typeof raw === 'number' ? raw : Number(String(raw).replace(/[,%％]/g, ''));
}

const G = loadGame();
const out = { home: {}, items: {}, mobs: {}, skills: {}, sets: {}, maps: {}, drops: {} };

// ── 首頁 ────────────────────────────────────────────────
const home = wb.getWorksheet('首頁');
if (home) {
  const byZh = {};
  home.eachRow((row, i) => { if (i > 1) byZh[val(row.getCell(1))] = { v: val(row.getCell(2)), i }; });
  for (const r of HOME_ROWS) {
    const cell = byZh[r.zh];
    if (!cell || cell.v == null) continue;
    const v = String(cell.v);
    if (/^link\d$/.test(r.key)) {
      const [text, url] = v.split('|').map(s => s && s.trim());
      if (!text || !/^https?:\/\/\S+$/.test(url || '')) { err(`首頁 第 ${cell.i} 列「${r.zh}」:格式要是「顯示文字 | 網址」,網址要以 https:// 開頭。`); continue; }
      out.home[r.key] = [text, url];
    } else if (v !== HOME_DEFAULTS[r.key]) {
      out.home[r.key] = v;
    }
  }
}

// ── 倍率 ────────────────────────────────────────────────
const rates = {};
{
  const ws = wb.getWorksheet(RATE_SHEET);
  if (ws) {
    const byZh = {};
    ws.eachRow((row, i) => { if (i > 1) byZh[val(row.getCell(1))] = { v: val(row.getCell(2)), i }; });
    for (const r of RATE_ROWS) {
      const c = byZh[r.zh]; if (!c || c.v == null) continue;
      const v = toNumber(c.v);
      if (!Number.isFinite(v) || v < 0 || v > 1000) { err(`${RATE_SHEET} 第 ${c.i} 列「${r.zh}」:要填 0 到 1000 的數字(1＝原版)，現在是「${c.v}」。`); continue; }
      if (v !== 1) rates[r.key] = v;
    }
  }
}

// ── 一般分頁 ─────────────────────────────────────────────
// 每一格:空白＝維持原值;既有的東西記「差異」,新增的東西(my_ 開頭)記「整筆」。
function parseCell(c, raw, where) {
  if (c.type === 'int' || c.type === 'num' || c.type === 'pct') {
    let v = toNumber(raw);
    if (!Number.isFinite(v)) { err(`${where}「${c.zh}」:要填數字,現在是「${raw}」。`); return undefined; }
    if (c.type === 'int' && !Number.isInteger(v)) { err(`${where}「${c.zh}」:要填整數,現在是「${raw}」。`); return undefined; }
    if (c.type === 'pct') {
      if (v < 0 || v > 100) { err(`${where}「${c.zh}」:要在 0 到 100 之間。`); return undefined; }
      v = Math.round(v * 1e4) / 1e6;
    }
    if ((c.key === 'spd' || c.key === 'atkSpd') && v <= 0) { err(`${where}「${c.zh}」:要大於 0。`); return undefined; }
    return v;
  }
  if (c.type === 'req') { try { return zhToReq(raw); } catch (e) { err(`${where}「${c.zh}」:${e.message}`); return undefined; } }
  if (c.type === 'img') {
    const name = String(raw).trim();
    if (!/^[^/\\]+\.(png|jpg|jpeg|webp|gif)$/i.test(name)) { err(`${where}「${c.zh}」:只填檔名就好(例:測試神劍.png),要是 png/jpg/webp/gif。`); return undefined; }
    if (!fs.existsSync(path.join(ROOT, CUSTOM_IMG_DIR, name))) { err(`${where}「${c.zh}」:GitHub 的 assets/custom 資料夾裡找不到「${name}」,先把圖上傳上去(檔名大小寫要一樣)。`); return undefined; }
    return CUSTOM_IMG_DIR + name;
  }
  return String(raw);
}
const newItems = {};      // my_ 開頭的新物品(整筆)
const newMagic = {};      // 新增的怪物魔法 { 怪物ID: { mag2: {...} } }
const prevDeleted = (() => {  // 遊戲裡已經刪掉的新物品:同一個 ID 不准再用(舊試算表殘留的那列會把它復活)
  try { const c = {}; new Function('window', fs.readFileSync(DATA_OUT, 'utf8'))(c); return c.MY_TWEAKS?.deletedNew || []; } catch { return []; }
})();
const prevNew = (() => {  // 目前遊戲裡已經有的新物品:不准從試算表刪掉(玩家背包裡可能已經有)
  try { const c = {}; new Function('window', fs.readFileSync(DATA_OUT, 'utf8'))(c); return Object.keys(c.MY_TWEAKS?.newItems || {}); } catch { return []; }
})();
const seenItemSheets = new Set();

for (const def of RECORD_SHEETS) {
  const ws = wb.getWorksheet(def.sheet);
  if (!ws) continue;
  if (def.store === 'items') seenItemSheets.add(def.sheet);
  const edit = def.cols.filter(c => c.type !== 'show' && c.type !== 'tpl');
  const colOf = columnsOf(ws, def.sheet, [ID_HEAD, ...edit.filter(c => c.type !== 'img' && !c.opt).map(c => c.zh)]);   // 圖檔欄是後來加的,舊表沒有也照樣能用
  if (!colOf[ID_HEAD]) continue;
  for (const c of edit) if (c.was && !colOf[c.zh] && colOf[c.was]) colOf[c.zh] = colOf[c.was];   // 改過名的欄：舊表照舊名讀
  const valid = new Map(def.rows(G).map(([rowKey, recId, prefix]) => [rowKey, [recId, prefix]]));
  const base = { items: G.DB.items, mobs: G.DB.mobs, skills: G.DB.skills, sets: G.DB.sets }[def.store];
  const seen = new Map();

  ws.eachRow((row, i) => {
    if (i === 1) return;
    const rowKey = val(row.getCell(colOf[ID_HEAD]));
    if (rowKey == null) return;
    const key = String(rowKey);
    if (seen.has(key)) { err(`${def.sheet} 第 ${i} 列:ID「${key}」跟第 ${seen.get(key)} 列重複了,同一個東西只能有一列。`); return; }
    seen.set(key, i);

    // ── 新增 ──
    if (!valid.has(key)) {
      if (def.allowNew === 'item') {
        if (!key.startsWith(NEW_PREFIX)) { err(`${def.sheet} 第 ${i} 列:ID「${key}」對不到遊戲裡的東西。要新增的話 ID 請用 ${NEW_PREFIX} 開頭;既有的東西 ID 不能改。`); return; }
        if (G.DB.items[key] || newItems[key]) { err(`${def.sheet} 第 ${i} 列:ID「${key}」已經被用過了,換一個。`); return; }
        if (prevDeleted.includes(key)) { err(`${def.sheet} 第 ${i} 列:「${key}」已經刪除過了，同一個 ID 不能再用。這列刪掉;要重新做請換一個新 ID。`); return; }
        if (!/^my_[A-Za-z0-9_]+$/.test(key)) { err(`${def.sheet} 第 ${i} 列:新 ID「${key}」只能用英文、數字、底線。`); return; }
        const tplId = colOf[TPL_HEAD] ? val(row.getCell(colOf[TPL_HEAD])) : null;
        const tpl = tplId != null && G.DB.items[tplId];
        if (!tpl || !def.filter(tpl)) { err(`${def.sheet} 第 ${i} 列(${key}):「${TPL_HEAD}」要填一個這個分頁裡現有的 ID,新東西會照它做。`); return; }
        const rec = newItemFrom(String(tplId), tpl);
        const where = `${def.sheet} 第 ${i} 列(${key})`;
        for (const c of edit) {
          const raw = colOf[c.zh] ? val(row.getCell(colOf[c.zh])) : null;
          if (raw == null) continue;
          const v = parseCell(c, raw, where);
          if (v !== undefined) setPath(rec, c.key, v);
        }
        if (!rec.n || rec.n === tpl.n) { err(`${where}:新東西要取一個跟範本不一樣的「名稱」。`); return; }
        newItems[key] = rec;
        return;
      }
      if (def.allowNew === 'magic') {
        const [mid, slot] = key.split(':');
        const mob = G.DB.mobs[mid];
        if (!mob || !MAGIC_SLOTS.includes(slot)) { err(`${def.sheet} 第 ${i} 列:ID「${key}」格式要是「怪物ID:mag」(第二招 mag2、第三招 mag3…)。`); return; }
        if (mob[slot]) { err(`${def.sheet} 第 ${i} 列:「${mob.n}」已經有 ${slot},ID 不能重複。`); return; }
        const rec = { skn: '', cd: 0, chance: 0, dmg: [0, 0], ele: 'none' };
        const where = `${def.sheet} 第 ${i} 列(${mob.n} 新增魔法)`;
        for (const c of edit) {
          const raw = colOf[c.zh] ? val(row.getCell(colOf[c.zh])) : null;
          if (raw == null) { err(`${where}「${c.zh}」:新增魔法每一欄都要填。`); continue; }
          const v = parseCell(c, raw, where);
          if (v !== undefined) setPath(rec, c.key, v);
        }
        if (rec.cd < 1) err(`${where}「冷卻(回合)」:至少要 1。`);
        (newMagic[mid] ||= {})[slot] = rec;
        return;
      }
      err(`${def.sheet} 第 ${i} 列:ID「${key}」對不到遊戲裡的東西,ID 欄不能改。`);
      return;
    }

    // ── 既有:只記差異 ──
    const [recId, prefix] = valid.get(key);
    const rec = base[recId];
    const where = `${def.sheet} 第 ${i} 列(${rec.n || recId})`;
    for (const c of edit) {
      if (!colOf[c.zh]) continue;
      const raw = val(row.getCell(colOf[c.zh]));
      if (raw == null) continue;
      const p = prefix + c.key;
      const o = getPath(rec, p);
      if (o === undefined && p.includes('.')) {          // 陣列/子物件本來就不存在(例:這招沒有治療骰)→ 無處可放
        const parent = getPath(rec, p.slice(0, p.lastIndexOf('.')));
        if (parent == null) { err(`${where}「${c.zh}」:這一筆沒有這個項目,請把這格清空。`); continue; }
      }
      const v = parseCell(c, raw, where);
      if (v === undefined) continue;
      const same = c.type === 'req'
        ? String(o || '').split(',').sort().join() === v.split(',').sort().join()
        : c.type === 'pct' ? Math.abs((o ?? NaN) - v) < 1e-9
        : (o ?? null) === v;
      if (!same) (out[def.store][recId] ||= {})[p] = v;
    }
  });
}
// 已經上線過的新物品不能消失(四個物品分頁都在才檢查,少一頁時無從判斷)
// 「刪除的新物品」分頁:確定要刪的 my_ 物品(刪了就是刪了:玩家身上的會在讀檔時被當成不存在的物品清掉)
const deletedNew = [];
{
  const ws = wb.getWorksheet(DELETED_SHEET);
  if (ws) ws.eachRow((row, i) => {
    if (i === 1) return;
    const id = val(row.getCell(1)); if (id == null) return;
    const s = String(id);
    if (!s.startsWith(NEW_PREFIX)) { err(`${DELETED_SHEET} 第 ${i} 列:只能刪自己新增的(${NEW_PREFIX} 開頭),「${s}」是遊戲原本就有的。`); return; }
    if (newItems[s]) { err(`${DELETED_SHEET} 第 ${i} 列:「${s}」還在物品分頁裡。要刪就把那一列也拿掉;不刪就把這一列拿掉。`); return; }
    if (!deletedNew.includes(s)) deletedNew.push(s);
  });
}
for (const id of prevDeleted) if (!deletedNew.includes(id)) deletedNew.push(id);   // 刪除紀錄只增不減(分頁被清空也不會讓舊 ID 復活)
if (seenItemSheets.size === RECORD_SHEETS.filter(d => d.store === 'items').length) {
  for (const id of prevNew) if (!newItems[id] && !deletedNew.includes(id)) err(`新增的物品「${id}」從試算表裡不見了。確定要刪的話,把「${id}」寫進「${DELETED_SHEET}」分頁;只是不想讓人再拿到,把它的掉落刪掉就好。`);
}
// ── 禮物 ────────────────────────────────────────────────
const gifts = [];
{
  const ws = wb.getWorksheet(GIFT_SHEET);
  if (ws) {
    const need = GIFT_COLS.filter(h => !GIFT_OPT_COLS.includes(h));
    const colOf = columnsOf(ws, GIFT_SHEET, need);
    const seen = new Map();
    if (need.every(h => colOf[h])) ws.eachRow((row, i) => {
      if (i === 1) return;
      const g = h => colOf[h] ? val(row.getCell(colOf[h])) : null;
      const id = g('編號'), to = g('收件角色'), kindZh = g('類型'), item = g('物品ID'), raw = g('數量'), note = g('備註');
      if (id == null && to == null && kindZh == null && item == null && raw == null) return;
      const where = `${GIFT_SHEET} 第 ${i} 列`;
      if (id == null) { err(`${where}:「編號」要填(每份禮物一個不重複的編號，例如 1、2、3)。`); return; }
      const key = String(id);
      if (seen.has(key)) { err(`${where}:編號「${key}」跟第 ${seen.get(key)} 列重複了。已經發過的禮物編號不要改、不要重用。`); return; }
      seen.set(key, i);
      if (to == null) { err(`${where}:「收件角色」要填角色名稱，或填「${GIFT_TO_ALL}」。`); return; }
      const kind = GIFT_KINDS[String(kindZh || '')];
      if (!kind) { err(`${where}:「類型」只能填:${Object.keys(GIFT_KINDS).join('、')}。`); return; }
      const cnt = toNumber(raw);
      if (!Number.isInteger(cnt) || cnt < 1) { err(`${where}:「數量」要填 1 以上的整數。`); return; }
      const gift = { id: key, to: String(to), kind, cnt };
      if (kind === 'item') {
        if (item == null || !(G.DB.items[item] || newItems[item])) { err(`${where}:找不到物品ID「${item ?? ''}」，可以到武器/防具/飾品/道具分頁查。`); return; }
        gift.item = String(item);
        const enRaw = g('強化');
        if (enRaw != null && enRaw !== '') {
          const en = toNumber(enRaw), d = G.DB.items[item] || newItems[item];
          const isGear = d && !d.relic && !d.isArrow && ['wpn', 'arm', 'acc'].includes(d.type);
          const cap = d && (d.maxEn || { wpn: 15, arm: 15, acc: 5 }[d.type] || 10);   // 同 js/01 enhanceCap
          if (!isGear) { if (en) { err(`${where}:「強化」只有武器、防具、飾品能填，「${item}」請留空。`); return; } }
          else if (!Number.isInteger(en) || en < 0 || en > cap) { err(`${where}:「強化」要填 0～${cap} 的整數。`); return; }
          else if (en) gift.en = en;
        }
      } else if (g('強化')) { err(`${where}:金幣不能填「強化」，請留空。`); return; }
      if (note != null) gift.note = String(note);
      gifts.push(gift);
    });
  }
}
out.gifts = gifts;
out.newItems = newItems;
out.rates = rates;
out.deletedNew = deletedNew;
out.newMagic = newMagic;

// ── 地圖 ────────────────────────────────────────────────
const mapWs = wb.getWorksheet('地圖');
if (mapWs) {
  const colOf = columnsOf(mapWs, '地圖', [ID_HEAD, '出現怪物']);
  const { toId } = mobNamer(G);
  if (colOf[ID_HEAD] && colOf['出現怪物']) mapWs.eachRow((row, i) => {
    if (i === 1) return;
    const id = val(row.getCell(colOf[ID_HEAD]));
    if (id == null) return;
    const orig = G.DB.maps[id];
    if (!Array.isArray(orig)) { err(`地圖 第 ${i} 列:ID「${id}」不是遊戲裡的地圖,ID 欄不能改。`); return; }
    const text = val(row.getCell(colOf['出現怪物']));
    if (text == null) return;                          // 空白 = 維持原樣(地圖不能沒有怪)
    const names = String(text).split(/[、,，\n]+/).map(s => s.trim()).filter(Boolean);
    const ids = []; let bad = false;
    for (const nm of names) {
      const mid = toId(nm);
      if (!mid) { err(`地圖 第 ${i} 列(${G.MAP_NAMES[id] || id})「出現怪物」:找不到怪物「${nm}」。同名的怪要寫成「名稱(ID)」。`); bad = true; }
      else ids.push(mid);
    }
    if (!bad && ids.join() !== orig.join()) out.maps[id] = ids;
  });
}

// ── 掉落 ────────────────────────────────────────────────
const dropWs = wb.getWorksheet('掉落');
if (dropWs) {
  const H = ['怪物ID', '怪物名稱', '物品ID', '機率(%)'];
  const colOf = columnsOf(dropWs, '掉落', H);
  const knownMobs = new Set([...Object.keys(G.MOB_DROPS), ...Object.values(G.DB.mobs).map(m => m.n)]);
  const sheet = {};
  if (H.every(h => colOf[h])) dropWs.eachRow((row, i) => {
    if (i === 1) return;
    const mid = val(row.getCell(colOf['怪物ID']));
    let mob = val(row.getCell(colOf['怪物名稱']));
    const item = val(row.getCell(colOf['物品ID']));
    const raw = val(row.getCell(colOf['機率(%)']));
    if (mid == null && mob == null && item == null && raw == null) return;
    const where = `掉落 第 ${i} 列`;
    // 怪物ID / 怪物名稱 填一個就好;兩個都填就要對得上(掉落表以名稱為鍵)
    if (mid != null) {
      const m = G.DB.mobs[mid];
      if (!m) { err(`${where}:找不到怪物ID「${mid}」,可以到怪物分頁查 ID。`); return; }
      if (mob != null && String(mob) !== m.n) { err(`${where}:怪物ID「${mid}」是「${m.n}」,跟怪物名稱「${mob}」對不上,兩格只要留一格。`); return; }
      mob = m.n;
    }
    if (mob == null || !knownMobs.has(String(mob))) { err(`${where}:找不到怪物「${mob ?? ''}」(名稱要跟怪物分頁一模一樣)。`); return; }
    if (item == null || !(G.DB.items[item] || newItems[item])) { err(`${where}(${mob}):找不到物品 ID「${item ?? ''}」,可以到武器/防具/飾品/道具分頁查 ID。`); return; }
    const p = toNumber(raw);
    if (raw == null || !Number.isFinite(p) || p < 0 || p > 100) { err(`${where}(${mob}):機率要填 0 到 100 的數字,現在是「${raw ?? ''}」。`); return; }
    if ((sheet[mob] || []).some(([x]) => x === String(item))) { err(`${where}(${mob}):「${item}」這隻怪已經有一列掉它了,同一樣東西只能設一次。`); return; }
    (sheet[mob] ||= []).push([String(item), p]);
  });
  // 跟原始比:只比「試算表看得到的部分」;遺物等隱藏的掉落原樣接回去
  const allMobs = new Set([...Object.keys(G.MOB_DROPS), ...Object.keys(sheet)]);
  const key = (list) => list.map(([a, b]) => a + '@' + b).sort().join('|');
  for (const mob of allMobs) {
    const orig = G.MOB_DROPS[mob] || [];
    const visible = orig.filter(([id]) => !dropHidden(G, id));
    const now = sheet[mob] || [];
    if (key(visible) !== key(now)) out.drops[mob] = [...now, ...orig.filter(([id]) => dropHidden(G, id))];
  }
}

if (errors.length) {
  const shown = errors.slice(0, MAX_ERR);
  fail(`試算表有 ${errors.length} 個地方要修正,這次沒有更新遊戲:\n\n` + shown.map(e => '• ' + e).join('\n')
    + (errors.length > MAX_ERR ? `\n…還有 ${errors.length - MAX_ERR} 個,先修上面這些再試一次。` : ''));
}

// ── 寫檔 ────────────────────────────────────────────────
for (const k of Object.keys(out)) if (!Object.keys(out[k]).length) delete out[k];
const body = '// 由 scripts/sheet-apply.mjs 從試算表自動產生。不要手改這個檔案:改試算表後到 GitHub 按「更新遊戲」。\n'
  + 'window.MY_TWEAKS = ' + JSON.stringify(out, null, 1) + ';\n';
const changed = !fs.existsSync(DATA_OUT) || fs.readFileSync(DATA_OUT, 'utf8').replace(/\r\n/g, '\n') !== body;
if (changed) fs.writeFileSync(DATA_OUT, body);
const cnt = (k) => Object.keys(out[k] || {}).length;
const msg = changed
  ? `✅ 已套用:首頁 ${cnt('home')} 項、物品 ${cnt('items')}、怪物 ${cnt('mobs')}、魔法 ${cnt('skills')}、地圖 ${cnt('maps')}、掉落 ${cnt('drops')} 隻怪有修改;新增物品 ${cnt('newItems')}、新增怪物魔法 ${Object.values(out.newMagic || {}).reduce((a, m) => a + Object.keys(m).length, 0)}。`
  : '試算表跟目前遊戲一樣,沒有需要更新的。';
console.log(msg);
summary(msg);

function summary(text) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
}
function fail(text) {
  console.error(text);
  summary('## ❌ 沒有更新\n\n' + text.replace(/\n/g, '\n\n'));
  process.exit(1);
}
