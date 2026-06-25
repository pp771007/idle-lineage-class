/* ============================================================================
 * afk-analytics.js — 注入 Cloudflare Web Analytics 的 beacon,統計人數 / 開啟次數
 *
 *   用途:GitHub Pages 查不到實際流量(bytes),只能靠「pageview / 訪客數」回推用量,
 *   判斷會不會撞到 GitHub Pages 100GB/月 的軟上限。Cloudflare Web Analytics 免費、
 *   不用 cookie、隱私友善,就一段 beacon script;資料只看得到 pageview/訪客/來源/路徑/
 *   國家/Core Web Vitals,沒有自訂事件(免費版限制)。
 *
 *   只在「正式站台」注入,避免本機 dev / Playwright / file:// 開的 zip 版污染統計數字:
 *     - 非 https 一律略過(file:// / http 本機)。
 *     - 本機 / 區網主機名(localhost、127.0.0.1、*.local …)略過。
 *   → 換正式網域後仍會自動生效(只擋本機),不必改這支。
 *
 *   不掛任何遊戲 DOM,純注入一個 <script>。原作者怎麼改 index.html 都不影響它,
 *   也因此「不」列入 scripts/smoke-hooks.mjs(沒有 DOM 掛點可壞)。
 *
 * 掛接:在 index.html </body> 前加一行 <script src="afk-analytics.js"></script>
 * ========================================================================== */
(function () {
  'use strict';

  // Cloudflare 後台 Web Analytics 給的 beacon token(Add a site → 程式碼裡的 data-cf-beacon token)。
  var CF_BEACON_TOKEN = 'c5fb974a7cd046c18bf7375a9d7b51e8';
  var CF_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

  // 本機 / 非正式環境的主機名,這些不送 beacon(免得自己測試灌爆數字)。
  var DEV_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1'];

  if (CF_BEACON_TOKEN.indexOf('__') === 0) {
    console.warn('[AFK-analytics] 尚未填入 Cloudflare beacon token,略過(不送統計)。');
    return;
  }
  if (location.protocol !== 'https:') {
    console.log('[AFK-analytics] 非 https(本機 / file://),略過統計注入,遊戲不受影響。');
    return;
  }
  var host = location.hostname;
  if (DEV_HOSTS.indexOf(host) !== -1 || /\.local$/.test(host)) {
    console.log('[AFK-analytics] 本機 / 區網主機(' + host + '),略過統計注入。');
    return;
  }

  var s = document.createElement('script');
  s.defer = true;
  s.src = CF_BEACON_SRC;
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_BEACON_TOKEN }));
  (document.head || document.documentElement).appendChild(s);
  console.log('[AFK-analytics] hooks OK — Cloudflare Web Analytics beacon 已注入。');
})();
