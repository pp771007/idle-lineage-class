#!/usr/bin/env node
// 怪物攻擊間隔照模擬器：讀模擬器 npc 表 atkspeed（毫秒），比遊戲 DB.mobs.atkSpd 快的才收，輸出 js/00-data.js 的 MOB_EMU_ATK_MS 區塊
//   用法：node tools/gen-mob-atkspd.js --emu "<模擬器資料夾>"（含 db/l1jdb.sql）→ 直接改寫 js/00-data.js 裡兩行標記之間的內容
//   名字對照：先找同名；找不到再拿掉「夢幻之島／象牙塔／遺忘之島…」這類前綴找本尊（同一隻怪的強化版，動作快慢一樣）
//   不收：不攻擊的、攻城建築、血盟／攻城的玩家型敵人、原本間隔 ≥10 秒的（漂浮之眼這類只放技能的）、模擬器反而比較慢的
const fs = require('fs'), path = require('path'), vm = require('vm');
const T = require('./gen-townmap.js');
const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const EMU = arg('emu'); if (!EMU) { console.error('用法：node tools/gen-mob-atkspd.js --emu <模擬器資料夾>'); process.exit(1); }
const REPO = path.resolve(__dirname, '..'), DATA = path.join(REPO, 'js', '00-data.js');
const npc = T.sqlTable(fs.readFileSync(path.join(EMU, 'db', 'l1jdb.sql'), 'utf8'), 'npc');
const byName = {};
for (const r of npc) { const n = String(r.name || '').trim().replace(/\\f./g, ''); if (n && !byName[n] && +r.atkspeed > 0) byName[n] = +r.atkspeed; }
const src = fs.readFileSync(DATA, 'utf8');
const ctx = { window: {}, console: { log() {}, warn() {} }, document: { getElementById: () => null, createElement: () => ({ style: {} }), addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} }, navigator: { userAgent: '' }, location: { search: '', hostname: '' }, setTimeout, clearTimeout, setInterval: () => 0 };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(src + '\n;this.__DB = DB;', ctx);
const PREFIX = /^(夢幻之島|象牙塔|遺忘之島|炎魔的|恐怖的|強化|變種|殘暴的|污染的|深淵|受詛咒的)/;
const out = [];
for (const [id, m] of Object.entries(ctx.__DB.mobs)) {
  if (!m || m.noAttack || m.race === '建築' || m.siegeEnemy || m.pledgeEnemy || !m.dmg) continue;
  const spd = +m.atkSpd || 0; if (!(spd > 0) || spd >= 10) continue;
  const ms = byName[m.n] || byName[String(m.n).replace(PREFIX, '')]; if (!ms) continue;
  if (ms >= spd * 1000) continue;   // 模擬器沒有比較快：照舊
  out.push([id, ms, m.n, spd]);
}
out.sort((a, b) => a[0].localeCompare(b[0]));
const lines = [];
for (let i = 0; i < out.length; i += 4) lines.push('    ' + out.slice(i, i + 4).map(([id, ms, n, spd]) => `"${id}": ${ms}, /* ${n} ${spd}s */`).join(' '));
const BEGIN = '// ⏱️ MOB_EMU_ATK_MS:BEGIN', END = '// ⏱️ MOB_EMU_ATK_MS:END';
const block = BEGIN + '（tools/gen-mob-atkspd.js 產生，勿手改）\nconst MOB_EMU_ATK_MS = {\n' + lines.join('\n') + '\n};\n' + END;
const a = src.indexOf(BEGIN), b = src.indexOf(END);
if (a < 0 || b < 0) { console.error('js/00-data.js 找不到 ' + BEGIN + ' / ' + END + ' 標記'); process.exit(1); }
fs.writeFileSync(DATA, src.slice(0, a) + block + src.slice(b + END.length));
console.log('[gen-mob-atkspd] ' + out.length + ' 隻怪照模擬器加快 → js/00-data.js MOB_EMU_ATK_MS');
