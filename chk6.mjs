import { chromium, devices } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
const errs = [];
p.on('pageerror', e => errs.push('[pageerror] ' + String(e.message).slice(0, 300)));
await p.goto('https://pp771007.github.io/idle-lineage-class/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForTimeout(5000);
await p.evaluate(() => { openSlotSelect('new'); chooseSlot(1); selectClass('m_knight'); startGame(); });
await p.waitForTimeout(6000);
// 點底部「背包」進到分頁鈕那頁,再逐顆分頁鈕點
const navs = await p.$$('#m-nav button');
await navs[2].click(); await p.waitForTimeout(1200);
const btns = await p.$$eval('button', bs => bs.map((b, i) => ({ i, t: (b.innerText || '').trim() })).filter(x => ['能力','裝備','技能','武器','防具','道具','統計','收藏','自動販賣','自動化設定','存檔','匯出'].includes(x.t)));
console.log('分頁鈕:', btns.map(x => x.t).join(' '));
for (const { t } of btns) {
  const el = await p.$(`button:text-is("${t}")`);
  if (!el) { console.log(`  ${t}: 找不到`); continue; }
  await el.click().catch(() => {});
  await p.waitForTimeout(900);
  const info = await p.evaluate(() => {
    const vis = [...document.querySelectorAll('div,section')].filter(e => {
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return cs.position === 'fixed' && cs.display !== 'none' && r.height > 100 && r.width > 100;
    }).map(e => { const r = e.getBoundingClientRect(); return `${e.className.toString().slice(0,28)}|top${Math.round(r.top)}~${Math.round(r.bottom)}`; });
    return vis.slice(0, 3);
  });
  console.log(`  ${t}: 浮動視窗 ${JSON.stringify(info)}`);
}
console.log('螢幕高:', await p.evaluate(() => innerHeight), '/ nav top:', await p.evaluate(() => { const n = document.getElementById('m-nav'); return n ? Math.round(n.getBoundingClientRect().top) : 'x'; }));
console.log('錯誤:', errs.length ? [...new Set(errs)] : 'none');
await b.close();
