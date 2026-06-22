/* ============================================================================
 * afk-sw.js — 註冊「只快取背景大圖」的 Service Worker(實際快取邏輯見 sw.js)
 *
 *   - 只在「能跑 SW 的環境」(HTTPS / localhost)註冊。判斷用 isSecureContext + protocol 為 http(s):
 *     SW 本來就只在 http(s) 跑,正面表列 http(s) 比排除 file:// 穩(連 data:/blob: 等也一併擋)。
 *     ※ 注意:file:// 在 Chromium 的 isSecureContext 其實是 true、location.origin 回 'file://'(Firefox 回 'null'),
 *       故不能只靠 isSecureContext / origin;但兩家的 location.protocol 都是 'file:',用 protocol 判斷才跨瀏覽器一致。
 *     → 載 zip 下來用 file:// 開的玩家:直接略過、零錯誤、遊戲照舊。
 *   - 不掛任何遊戲 DOM,純註冊 SW。所以原作者怎麼改 index.html 都不會影響它
 *     → 也因此「不」列入 scripts/smoke-hooks.mjs 的掛點冒煙檢查(沒有 DOM 掛點可壞)。
 *
 * 掛接:在 index.html </body> 前加一行 <script src="afk-sw.js"></script>
 * ========================================================================== */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || !window.isSecureContext || !/^https?:$/.test(location.protocol)) {
    console.log('[AFK-sw] 非 PWA 環境(file:// 或瀏覽器不支援),略過 Service Worker 註冊,遊戲不受影響。');
    return;
  }
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function () {
      console.log('[AFK-sw] hooks OK — 背景大圖 Service Worker 已註冊(回訪 / 重整秒出)。');
    }).catch(function (err) {
      console.warn('[AFK-sw] Service Worker 註冊失敗(不影響遊戲):', err && err.message);
    });
  });
})();
