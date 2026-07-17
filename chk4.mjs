import { chromium, devices } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
const errs = [];
p.on('pageerror', e => errs.push('[pageerror] ' + String(e.message).slice(0, 400)));
await p.goto('https://pp771007.github.io/idle-lineage-class/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForTimeout(5000);
await p.evaluate(() => { openSlotSelect('new'); chooseSlot(1); selectClass('m_knight'); startGame(); });
await p.waitForTimeout(6000);
// 逐個底部導覽鈕點過去,看每頁還能不能操作
const navs = await p.$$('#m-nav button');
console.log('底部導覽鈕:', navs.length);
for (let i = 0; i < navs.length; i++) {
  await navs[i].click().catch(() => {});
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => {
    const bar = document.querySelector('.m-tab-bar');
    const vis = el => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
    return {
      分頁列: bar ? (vis(bar) ? `可見 h${Math.round(bar.getBoundingClientRect().height)} 鈕${bar.querySelectorAll('button').length}` : '存在但隱藏') : '不存在',
      內容區: (() => { const c = document.querySelector('.m-col-center'); return c ? `h${Math.round(c.getBoundingClientRect().height)}` : 'x'; })(),
    };
  });
  console.log(`  [${i}]`, JSON.stringify(info));
  await p.screenshot({ path: `D:/ppRepos/_scratch/screenshots/m-nav-${i}.png` });
}
console.log('錯誤:', errs.length ? [...new Set(errs)] : 'none');
await b.close();
