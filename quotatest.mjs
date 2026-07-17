import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const LOG = 'D:/ppRepos/_scratch/srv.log';
const PROF = process.env.TEMP + '\pwq';
try { execSync(`rmdir /s /q "${PROF}"`, { shell: 'cmd' }); } catch {}
const QUOTA_MB = 12;   // 壓到 12MB:程式桶就要 4.4MB,圖再抓一點就會逼近上限(模擬手機吃緊)
const ctx = await chromium.launchPersistentContext(PROF, { headless: true, viewport: { width: 390, height: 844 } });
const mark = () => { try { return fs.readFileSync(LOG, 'utf8').length; } catch { return 0; } };
const dl = (off) => fs.readFileSync(LOG, 'utf8').slice(off).split('\n').filter(l => /GET \/assets\/anim\//.test(l)).length;

const play = async (tag) => {
  const off = mark();
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Storage.overrideQuotaForOrigin', { origin: 'http://127.0.0.1:8099', quotaSize: QUOTA_MB * 1048576 });
  await p.goto('http://127.0.0.1:8099/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(5000);
  const hasSave = await p.evaluate(() => !!localStorage.getItem('lineage_idle_save_1'));
  await p.evaluate((hs) => { if (hs) { openSlotSelect('load'); chooseSlot(1); } else { openSlotSelect('new'); chooseSlot(1); selectClass('m_knight'); startGame(); } }, hasSave);
  await p.waitForTimeout(3000);
  await p.evaluate(() => { const s = document.getElementById('map-select'); s.value = 'silver_knight'; changeMap(true); });
  await p.waitForTimeout(12000);
  const st = await p.evaluate(async () => {
    const ks = await (await caches.open('img-v3')).keys().catch(() => []);
    const e = await navigator.storage.estimate();
    return {
      圖桶怪物幀: ks.filter(k => /\/assets\/anim\//.test(k.url)).length,
      存檔還在嗎: !!localStorage.getItem('lineage_idle_save_1'),
      用量MB: +(e.usage / 1048576).toFixed(1), 配額MB: +(e.quota / 1048576).toFixed(1),
    };
  });
  await p.close();
  await new Promise(r => setTimeout(r, 800));
  console.log(`${tag}\n    ${JSON.stringify(st)} | 本輪下載: ${dl(off)} 張`);
  return st;
};

console.log(`=== 配額壓到 ${QUOTA_MB}MB(程式桶本身就要 4.4MB)===`);
await play('[1] v3.2.4 首次');
const a = await play('[2] 沒更新,關掉重開 ← 基準');
execSync('git -C D:/ppRepos/_scratch/wt-swap checkout -f v3.3.0', { stdio: 'pipe' });
console.log('--- 換成 v3.3.0(分頁全關)= 更新程式 ---');
const c = await play('[3] 更新後關掉重開 ← 關鍵');
console.log('\n=== 判讀 ===');
console.log('更新前圖桶:', a.圖桶怪物幀, '→ 更新後:', c.圖桶怪物幀);
console.log('存檔:', c.存檔還在嗎 ? '✅ 還在' : '❌ 不見了');
console.log(c.圖桶怪物幀 < a.圖桶怪物幀 / 2 ? '⚠️ 圖桶被清 = 重現!' : '❌ 圖桶沒被清');
await ctx.close();
