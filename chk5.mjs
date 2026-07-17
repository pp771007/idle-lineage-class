import { chromium, devices } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
const errs = [];
p.on('pageerror', e => errs.push('[pageerror] ' + String(e.message).slice(0, 300)));
await p.goto('https://pp771007.github.io/idle-lineage-class/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForTimeout(5000);
await p.evaluate(() => { openSlotSelect('new'); chooseSlot(1); selectClass('m_knight'); startGame(); });
await p.waitForTimeout(6000);

const css = await p.evaluate(() => {
  const cs = getComputedStyle(document.body);
  return {
    '--orig-bar-h': cs.getPropertyValue('--orig-bar-h').trim(),
    '--m-nav-h': cs.getPropertyValue('--m-nav-h').trim(),
    '--fu-avail-h': cs.getPropertyValue('--fu-avail-h').trim(),
    '--app-h': cs.getPropertyValue('--app-h').trim(),
  };
});
console.log('CSS 變數:', JSON.stringify(css));

// 開裝備視窗
await p.evaluate(() => { if (typeof openEquipment === 'function') openEquipment(); }).catch(e => console.log('openEquipment 例外:', e.message));
await p.waitForTimeout(2000);
const eq = await p.evaluate(() => {
  const w = document.querySelector('.equipment-window');
  if (!w) return '找不到 .equipment-window';
  const r = w.getBoundingClientRect(); const cs = getComputedStyle(w);
  return { display: cs.display, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) };
});
console.log('裝備視窗:', JSON.stringify(eq));
await p.screenshot({ path: 'D:/ppRepos/_scratch/screenshots/m-equip.png' });
console.log('螢幕高:', await p.evaluate(() => innerHeight));
console.log('錯誤:', errs.length ? [...new Set(errs)] : 'none');
await b.close();
