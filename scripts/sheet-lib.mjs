// sheet-lib.mjs — 試算表 ↔ 遊戲數值 共用定義(sheet-export / sheet-apply 都靠這份)
//
// 試算表的分頁、欄位、中文名稱都定義在這裡。要加新分頁/新欄位只改這份,兩支腳本自動跟上。
// 原始數值一律從 js/00-data.js、js/01-drops-config.js 讀(那兩份不手改),試算表只記「改成多少」,
// 產出的 js/00y-my-tweaks-data.js 只放「跟原始不一樣」的部分。
//
// 輸出格式(window.MY_TWEAKS):
//   home  : { title, subtitle, notice, link1:[文字,網址], … }
//   items / mobs / skills : { 記錄ID: { '欄位路徑': 值 } }   路徑可含點,如 'dmg.0'、'mag2.cd'
//   maps  : { 地圖ID: [怪物ID, …] }          整張替換
//   drops : { 怪物名稱: [[物品ID, 機率%], …] } 整隻替換(MOB_DROPS 以怪物「名稱」為鍵)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const DATA_OUT = process.env.SHEET_DATA_OUT || path.join(ROOT, 'js', '00y-my-tweaks-data.js');   // SHEET_DATA_OUT：sheet-rebuild 用暫存檔，不動遊戲裡那份
export const CONFIG = path.join(ROOT, 'sheet-config.json');
// 讀遊戲原始資料的位置;sheet-rebuild 會指到「舊版本」的 js/ 來分辨「誰改的」
const GAME_ROOT = process.env.SHEET_GAME_ROOT || ROOT;
export const ID_HEAD = 'ID(不要改)';
export const DATA_VERSION_LABEL = '(系統用,請勿修改)資料版本:';   // 寫在「使用說明」分頁最後一列
export const TPL_HEAD = '範本ID(新增用)';
export const CUSTOM_IMG_DIR = 'assets/custom/';   // 自訂圖檔放這裡;試算表只填檔名
export const NEW_PREFIX = 'my_';
export const DELETED_SHEET = '刪除的新物品';   // 列在這頁的 my_ 物品＝確定要刪(玩家身上的會在讀檔時被清掉)   // 試算表新增的東西一律用這個開頭,打錯既有 ID 才不會被當成新增

// 在 Node 裡跑 js/00-data.js + js/01-drops-config.js 拿到原始 DB 與 MOB_DROPS(瀏覽器全域用最小替身頂著)
export function loadGame() {
  const noop = () => {};
  const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, appendChild: noop, setAttribute: noop });
  const ctx = {
    console: { log: noop, warn: noop, error: noop, info: noop },
    document: { readyState: 'complete', addEventListener: noop, createElement: el, body: el(), head: el(),
      documentElement: el(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    location: { hostname: '', href: '', protocol: 'https:' }, localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: '' }, setTimeout: noop, setInterval: noop, addEventListener: noop,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const read = f => fs.readFileSync(path.join(GAME_ROOT, 'js', f), 'utf8');
  vm.runInContext(read('00-data.js') + '\n;globalThis.__DB = DB;', ctx);
  vm.runInContext(read('01-drops-config.js') + '\n;globalThis.__MD = MOB_DROPS;', ctx);
  _lastDB = ctx.__DB;
  return { DB: ctx.__DB, MOB_DROPS: ctx.__MD, MAP_NAMES: loadMapNames() };
}
let _lastDB = null;   // 給只拿得到單筆資料的欄位（例：套裝的「部位」）查物品名稱
const itemName = id => (_lastDB && _lastDB.items[id] && _lastDB.items[id].n) || id;
export const loadDB = () => loadGame().DB;

// 地圖中文名:js/11-world-map.js 的 {v:'zone_15',t:'眠龍洞穴1樓'}(只拿來顯示)
function loadMapNames() {
  const src = fs.readFileSync(path.join(GAME_ROOT, 'js', '11-world-map.js'), 'utf8');
  const names = {};
  for (const m of src.matchAll(/\{\s*v\s*:\s*'([\w-]+)'\s*,\s*t\s*:\s*'([^']+)'/g)) names[m[1]] ??= m[2];
  return names;
}

// ── 路徑讀寫('dmg.0'、'mag2.cd') ─────────────────────────
export function getPath(obj, p) {
  return p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
export function setPath(obj, p, v) {
  const ks = p.split('.'); let o = obj;
  for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) return false; o = o[ks[i]]; }
  o[ks[ks.length - 1]] = v; return true;
}

// ── 中文對照 ─────────────────────────────────────────────
export const CLASS_ZH = {
  all: '全職業', royal: '王族', knight: '騎士', elf: '妖精', mage: '法師', dark: '黑暗妖精',
  illusion: '幻術士', dragon: '龍騎士', warrior: '戰士',
};
const ZH_CLASS = Object.fromEntries(Object.entries(CLASS_ZH).map(([k, v]) => [v, k]));
export const reqToZh = (req) => String(req || '').split(',').filter(Boolean).map(c => CLASS_ZH[c.trim()] || c.trim()).join('、');
export function zhToReq(text) {
  const parts = String(text).split(/[、,，\s]+/).filter(Boolean);
  const bad = parts.filter(p => !ZH_CLASS[p] && !CLASS_ZH[p]);
  if (bad.length) throw new Error(`看不懂的職業「${bad.join('、')}」,只能填:${Object.values(CLASS_ZH).join('、')}`);
  return parts.map(p => ZH_CLASS[p] || p).join(',');
}
const SLOT_ZH = {
  armor: '盔甲', helm: '頭盔', shield: '盾牌', gloves: '手套', boots: '長靴', cloak: '斗篷', tshirt: 'T恤',
  shin: '脛甲', petarm: '寵物防具', amulet: '項鍊', ring: '戒指', ear: '耳環', belt: '腰帶', eye: '眼飾',
  doll: '魔法娃娃', petwpn: '寵物武器',
};
const TYPE_ZH = { pot: '藥水', scroll: '卷軸', misc: '雜物', etc: '材料', skillbk: '技能書', '': '其他' };
const ELE_ZH = { none: '無', fire: '火', water: '水', earth: '地', wind: '風', light: '光', dark: '暗' };
const zh = (map) => (v) => (v == null || v === '' ? '' : (map[v] ?? v));

// ── 欄位小工具 ───────────────────────────────────────────
// type:int=整數、num=可有小數、pct=存小數/顯示百分比、text=文字、req=可用職業
// show=只給人看(灰底,不會套用),值由 show(紀錄, 子物件, 紀錄ID) 算出
const C = {
  int: (key, zhName, note) => ({ key, zh: zhName, type: 'int', note }),
  num: (key, zhName, note) => ({ key, zh: zhName, type: 'num', note }),
  pct: (key, zhName, note) => ({ key, zh: zhName, type: 'pct', note }),
  text: (key, zhName, width) => ({ key, zh: zhName, type: 'text', width }),
  req: () => ({ key: 'req', zh: '可用職業', type: 'req', width: 22 }),
  show: (zhName, fn, width) => ({ key: null, zh: zhName, type: 'show', show: fn, width }),
  // 新增物品用:照哪一件現有的做(類型、外觀、特殊效果都照它);既有物品這格留白
  img: () => ({ key: 'img', zh: '圖檔(自訂)', type: 'img', width: 16, note: '用自己的圖:先把圖上傳到 GitHub 的 assets/custom 資料夾,這格填檔名(例:測試神劍.png)。空白=照原本的圖' }),
  tpl: () => ({ key: null, zh: TPL_HEAD, type: 'tpl', width: 18, note: '新增東西時才填:照哪一件現有的做(ID)。新東西的 ID 要用 my_ 開頭' }),
};
// 有「共鳴」的魔杖名單在 js/03（WAND_LIGHTARROW_IDS），只讀那一行
let _wandReso = null;
function wandResonanceIds() {
  if (_wandReso) return _wandReso;
  try {
    const m = fs.readFileSync(path.join(GAME_ROOT, 'js', '03-combat-core.js'), 'utf8').match(/const WAND_LIGHTARROW_IDS = \[([^\]]*)\]/);
    _wandReso = new Set(m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : []);
  } catch { _wandReso = new Set(); }
  return _wandReso;
}
// 後來才加的欄：舊表沒有也照常讀（沒有那欄＝那欄沒改）
const OPT = c => Object.assign(c, { opt: true });
// 改過名的欄：舊表的欄名還是舊的，照舊名也讀得到
const WAS = (c, oldZh) => Object.assign(c, { was: oldZh });
const STATS = [C.int('str', '力量'), C.int('dex', '敏捷'), C.int('con', '體質'), C.int('int', '智力'), C.int('wis', '精神'), C.int('cha', '魅力')];
const RES = [C.int('resFire', '火抗'), C.int('resWater', '水抗'), C.int('resEarth', '地抗'), C.int('resWind', '風抗')];
const GEAR_COMMON = [
  C.int('ac', '防禦力(AC)', '數字越大越硬'), C.int('mr', '魔防'), C.int('safe', '安定值', '強化到這個數字以內不會爆'), C.int('p', '價格'),
  C.int('mhp', 'HP上限'), C.int('mmp', 'MP上限'), C.int('hpR', 'HP回復'), C.int('mpR', 'MP回復'), C.int('dr', '傷害減免'),
  ...STATS, ...RES,
];
const itemRows = (filter) => (G) => Object.entries(G.DB.items).filter(([, d]) => filter(d)).map(([id]) => [id, id, '']);

// ── 一般分頁:一列一筆紀錄 ─────────────────────────────────
// store:寫進 MY_TWEAKS 的哪一類;rows(G) → [[列ID, 紀錄ID, 欄位路徑前綴], …]
export const RECORD_SHEETS = [
  {
    sheet: '武器', store: 'items', allowNew: 'item', filter: d => d.type === 'wpn' && !d.isArrow, rows: itemRows(d => d.type === 'wpn' && !d.isArrow),
    cols: [
      C.text('n', '名稱', 16), C.int('dmgS', '對小怪傷害'), C.int('dmgL', '對大怪傷害'), C.int('hit', '命中'), C.int('dmgBonus', '額外傷害'),
      C.num('spd', '攻擊間隔(秒)', '每幾秒攻擊一次,數字越小越快'), C.int('safe', '安定值', '強化到這個數字以內不會爆'), C.int('p', '價格'),
      ...STATS.slice(0, 5),
      // 魔杖類常用的魔法欄位（其他武器多半空白）
      OPT(WAS(C.int('mdmg', '魔攻', '每次施法固定加的傷害'), '魔法傷害')), OPT(C.int('extraMp', '額外魔法點數(SP)', '魔法造成的傷害倍率：每 1 點約 +9%')),
      OPT(C.int('extraMpPerEn', '每強化+SP', '每 +1 強化再加幾點額外魔法點數')), OPT(C.int('mmp', 'MP上限')), OPT(C.int('mpR', 'MP回復')),
      OPT(C.int('mpOnHitBase', '命中回MP', '打中時回幾點 MP（強化超過 +6 每級再 +1）')), OPT(C.int('mpROverSafe', '超過安定值每+1 MP回復')),
      OPT(C.int('procRateBase', '觸發機率%', '武器自帶魔法的發動機率')), OPT(C.int('procRatePerEn', '每強化+觸發%')),
      C.show('共鳴', (d, s, id) => (wandResonanceIds().has(id) ? '是' : '')),
      C.req(), C.show('雙手武器', d => (d.w2h ? '是' : '')), C.text('d', '說明', 40), C.img(), C.tpl(),
    ],
  },
  {
    sheet: '防具', store: 'items', allowNew: 'item', filter: d => d.type === 'arm', rows: itemRows(d => d.type === 'arm'),
    cols: [C.text('n', '名稱', 16), C.show('部位', d => zh(SLOT_ZH)(d.slot)), ...GEAR_COMMON, C.req(), C.text('d', '說明', 40), C.img(), C.tpl()],
  },
  {
    sheet: '飾品', store: 'items', allowNew: 'item', filter: d => d.type === 'acc', rows: itemRows(d => d.type === 'acc'),
    cols: [C.text('n', '名稱', 16), C.show('部位', d => zh(SLOT_ZH)(d.slot)), ...GEAR_COMMON, C.int('weightCap', '負重上限'), C.req(), C.text('d', '說明', 40), C.img(), C.tpl()],
  },
  {
    sheet: '道具', store: 'items', allowNew: 'item', filter: d => !['wpn', 'arm', 'acc'].includes(d.type), rows: itemRows(d => !['wpn', 'arm', 'acc'].includes(d.type)),
    cols: [
      C.text('n', '名稱', 18), C.show('類型', d => zh(TYPE_ZH)(d.type ?? '')), C.int('p', '價格'),
      C.int('val', '回復量'), C.int('valMin', '最少回復'), C.int('valMax', '最多回復'), C.int('dur', '持續秒數'),
      C.req(), C.text('d', '說明', 50), C.img(), C.tpl(),
    ],
  },
  {
    // 🛡️ 套裝：成員與變身只顯示（不能改），件數與效果數值可以改；防禦力填正數＝防禦變好（同裝備分頁）
    sheet: '套裝', store: 'sets', rows: (G) => Object.keys(G.DB.sets || {}).map(id => [id, id, '']),
    cols: [
      C.text('n', '名稱', 16), C.show('部位', (s, sub, id) => (s.items || []).map(i => itemName(i)).join('、'), 40),
      C.int('need', '需要件數', '穿幾件才有效果'), C.show('變身', s => s.poly || ''),
      C.int('ac', '防禦力(AC)', '正數＝防禦變好'), C.int('mr', '魔防'), C.int('mhp', 'HP上限'), C.int('mmp', 'MP上限'), C.int('hpR', 'HP回復'), C.int('mpR', 'MP回復'), C.int('dr', '傷害減免'),
      ...STATS, ...RES,
      C.int('meleeDmg', '近距離傷害'), C.int('rangedDmg', '遠距離傷害'), C.int('extraDmg', '額外傷害'), C.int('extraHit', '命中'), C.int('magicDmg', '魔法傷害'), C.int('extraMp', '額外魔法點數'),
      C.int('atkSpdPct', '攻速%'), C.int('meleeCrit', '近距離爆擊%'), C.int('rangedCrit', '遠距離爆擊%'), C.int('magicCrit', '魔法爆擊%'),
      C.int('meleeCritDmg', '近距離爆擊傷害%'), C.int('rangedCritDmg', '遠距離爆擊傷害%'), C.int('magicCritDmg', '魔法爆擊傷害%'),
    ],
  },
  {
    sheet: '怪物', store: 'mobs', rows: (G) => Object.keys(G.DB.mobs).map(id => [id, id, '']),
    cols: [
      C.show('名稱', d => d.n, 16), C.int('lv', '等級'), C.int('hp', 'HP'), C.int('ac', 'AC', '數字越小越硬'), C.int('mr', '魔防'),
      C.int('exp', '經驗值'), C.int('goldMin', '金幣(最少)', '一般怪沒改過的話，金幣依等級自動計算；改了這兩格才照表'), C.int('goldMax', '金幣(最多)', '同左'),
      C.num('atkSpd', '攻擊間隔(秒)'), C.int('dmg.0', '攻擊骰(顆)'), C.int('dmg.1', '攻擊骰(面)'), C.int('db', '額外傷害'), C.int('hit', '命中'),
      C.show('屬性', d => zh(ELE_ZH)(d.e)), C.show('頭目', d => (d.boss ? '是' : '')), C.show('種族', d => d.race),
    ],
  },
  {
    sheet: '怪物魔法', store: 'mobs', allowNew: 'magic',
    rows: (G) => Object.entries(G.DB.mobs).flatMap(([id, m]) =>
      ['mag', 'mag2', 'mag3', 'mag4', 'mag5'].filter(k => m[k]).map(k => [`${id}:${k}`, id, k + '.'])),
    cols: [
      C.show('怪物ID', (d, sub, id) => id, 16), C.show('怪物', (d) => d.n, 16), C.text('skn', '魔法名稱', 14),
      C.int('cd', '冷卻(回合)', '怪物每攻擊一次算一回合'), C.pct('chance', '發動機率(%)'),
      C.int('dmg.0', '傷害骰(顆)'), C.int('dmg.1', '傷害骰(面)'), C.show('屬性', (d, sub) => zh(ELE_ZH)(sub?.ele)),
    ],
  },
  {
    sheet: '魔法', store: 'skills', rows: (G) => Object.keys(G.DB.skills).map(id => [id, id, '']),
    cols: [
      C.text('n', '名稱', 14), C.int('mp', '耗魔'), C.int('hpCost', '耗血'),
      C.int('dmgDice.0', '傷害骰(顆)'), C.int('dmgDice.1', '傷害骰(面)'), C.int('dmgBase', '基礎傷害'),
      C.int('healDice.0', '治療骰(顆)'), C.int('healDice.1', '治療骰(面)'), C.int('healBase', '基礎治療'),
      C.int('dur', '持續秒數'),
      C.int('reqRoy', '王族需求等級'), C.int('reqK', '騎士需求等級'), C.int('reqE', '妖精需求等級'),
      C.int('reqM', '法師需求等級'), C.int('reqD', '黑暗妖精需求等級'),
      C.text('d', '說明', 40),
    ],
  },
];

// ── 首頁:一列一個項目(A 欄項目名、B 欄內容) ─────────────
export const HOME_ROWS = [
  { key: 'title', zh: '遊戲標題', note: '首頁最上面的大字,也是瀏覽器分頁上的名字' },
  { key: 'subtitle', zh: '副標題', note: '標題下面那行小字' },
  { key: 'notice', zh: '公告', note: '顯示在「開始遊戲」按鈕下方;空白就不顯示。要換行請按 Alt+Enter' },
  { key: 'link1', zh: '連結1', note: '格式:顯示文字 | 網址(例:我們的LINE群 | https://line.me/...)' },
  { key: 'link2', zh: '連結2', note: '同上,空白就不顯示' },
  { key: 'link3', zh: '連結3', note: '同上,空白就不顯示' },
];
export const HOME_DEFAULTS = { title: '放置天堂 - 日出之國', subtitle: '創造您的角色並開始冒險' };

// ── 倍率:一列一個(A 項目、B 倍率);1＝原版。js/05 killMob 讀 window.myRate(key)，離線結算走同一條 ─────
// ── 禮物:一列一份;角色登入時自動領(每份每個角色只領一次，靠「編號」認) ─────
export const GIFT_SHEET = '禮物';
export const GIFT_COLS = ['編號', '收件角色', '類型', '物品ID', '數量', '強化', '備註'];
export const GIFT_OPT_COLS = ['強化'];   // 後來才加的欄：舊表沒有也照常讀(當 0)
export const GIFT_TO_ALL = '全部';
export const GIFT_KINDS = { '物品': 'item', '金幣': 'gold' };

export const RATE_SHEET = '倍率';
export const RATE_ROWS = [
  { key: 'exp',    zh: '角色經驗倍率', note: '打怪得到的經驗 ×這個數字(傭兵也一樣)。2＝兩倍' },
  { key: 'petExp', zh: '寵物經驗倍率', note: '寵物得到的經驗 ×這個數字' },
  { key: 'drop',   zh: '掉寶倍率',     note: '「掉落」分頁每一列的機率 ×這個數字(最高 100%)' },
  { key: 'gold',   zh: '金幣倍率',     note: '打怪掉的金幣 ×這個數字' },
  { key: 'summonHit', zh: '召喚命中倍率', note: '召喚術／造屍術召出來的怪，命中 ×這個數字。1＝目前的設定' },
  { key: 'compAggro', zh: '夥伴被打倍率', note: '怪物選寵物／召喚物／迷魅的怪來打的機率 ×這個數字。1＝目前的設定，0＝怪物不打夥伴' },
];

// 掉落表不列遺物(遺物系統已隱藏,afk-norelic 會在遊戲裡再切掉);套用時原樣保留
export const dropHidden = (G, itemId) => !!G.DB.items[itemId]?.relic;

// 怪物 ID ↔ 中文(地圖分頁用)。匯出寫「名稱(ID)」(ID 跟名稱一樣時只寫名稱);讀回時名稱、ID、名稱(ID) 都認。
//   ⚠️ 有些怪的 ID 本身就是中文(例:侏儒),名稱也可能自帶括號(白目玩家(王族))
//   → 只有「最後一組括號裡是真的怪物 ID」才當 ID,否則整串當名稱/ID 查。
export function mobNamer(G) {
  const count = {};
  for (const m of Object.values(G.DB.mobs)) count[m.n] = (count[m.n] || 0) + 1;
  const toText = (id) => { const m = G.DB.mobs[id]; return !m ? id : m.n === id ? id : `${m.n}(${id})`; };
  const byName = {};
  for (const [id, m] of Object.entries(G.DB.mobs)) if (count[m.n] === 1) byName[m.n] = id;
  const toId = (t) => {
    const s = t.trim(); const m = s.match(/[(（]([^()（）]+)[)）]$/);
    if (m && G.DB.mobs[m[1].trim()]) return m[1].trim();
    if (G.DB.mobs[s]) return s;
    if (byName[s]) return byName[s];
    return null;
  };
  return { toText, toId };
}

// ── 新增物品:複製範本 → 去掉「會讓它跑進抽獎/遺物系統」的欄位 → 固定外觀圖 ───────
//   圖示路徑規則同核心 getIconUrl(js/01):有 img 用 img,否則依類型＋名稱;新名稱沒有圖檔,所以固定成範本的圖。
export function iconOf(d) {
  if (d.img) return d.img;
  const dir = { wpn: 'weapons', arm: 'armors', acc: 'accessories' }[d.type] || 'items';
  return `assets/icons/${dir}/${d.n}.png`;
}
export function newItemFrom(tplId, tpl) {
  const o = JSON.parse(JSON.stringify(tpl));
  for (const k of ['relic', 'relicRole', 'legend', 'noSell', 'set']) delete o[k];   // 新物品不跟著範本算進套裝
  o.img = iconOf(tpl);
  o.gachaWeight = 0;   // 不進潘朵拉抽獎/黑市
  o.d = '';
  o._tpl = tplId;
  return o;
}
// 新增怪物魔法:最基本的攻擊魔法(有傷害、有冷卻與機率);屬性預設無
export const MAGIC_SLOTS = ['mag', 'mag2', 'mag3', 'mag4', 'mag5'];
