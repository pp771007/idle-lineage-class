import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext()).newPage();
await p.goto('http://127.0.0.1:8099/?cb=' + Date.now(), { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(6000);
const est = await p.evaluate(async () => { const e = await navigator.storage.estimate(); return { 已用MB: +(e.usage / 1048576).toFixed(1), 配額MB: +(e.quota / 1048576).toFixed(0) }; });
console.log('桌機(冷啟):', JSON.stringify(est));
await b.close();
