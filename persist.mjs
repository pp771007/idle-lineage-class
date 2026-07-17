import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext()).newPage();
await p.goto('http://127.0.0.1:8099/?cb=' + Date.now(), { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(4000);
const r = await p.evaluate(async () => {
  const before = await navigator.storage.persisted();
  const granted = await navigator.storage.persist();
  const after = await navigator.storage.persisted();
  return { 目前是持久化嗎: before, 要求後是否獲准: granted, 要求後狀態: after };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
