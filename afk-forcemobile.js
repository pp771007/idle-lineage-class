/* ============================================================================
 * afk-forcemobile.js — 一律使用手機版面
 *
 * 上游手機版面是 media query(max-width:768px …)＋ innerWidth 判斷觸發的,外掛也各自讀同一條 MQ,
 * 寬螢幕上沒辦法靠樣式「假裝」成手機。作法:寬螢幕直接開 index.html 時導去 phone.html,
 * 由它把 index.html 放進手機寬度的 iframe → 所有條件自然成立,遊戲與外掛完全不用改。
 *
 *   ・只在 http(s) 生效:file:// 下 iframe 的儲存政策各瀏覽器不同,賭輸了玩家會「看不到存檔」。
 *   ・只有真的手機(觸控＋螢幕短邊 ≤600)不導;電腦/平板一律包框,視窗之後再怎麼拉寬都不會跳回桌機版面。
 *   ・已鎖定為一律開啟，不提供開關（舊版玩家存的關閉值一律忽略）。
 *   ・SW 離線退快取可能把 index.html 的內容回在 phone.html 網址上 → 路徑已是 phone.html 就不再導(防無限循環)。
 *
 * 載入順序:緊接 afk-toggles 之後(越早導走,外層白跑的越少)。
 * ========================================================================== */
(function () {
  'use strict';

  // 已鎖定：不進外掛開關面板、玩家關不掉（站長決定所有裝置統一手機版面）。
  var FRAME_PAGE = /\/phone\.html$/;

  var inFrame = false;
  try { inFrame = window.top !== window; } catch (e) { inFrame = true; }

  if (inFrame) return;

  if (!/^https?:$/.test(location.protocol)) return;
  if (FRAME_PAGE.test(location.pathname)) return;
  // 只有「真的手機」不包框。不能看當下視窗寬度：開的時候窄、之後把視窗拉寬，上游版面會即時切回桌機
  //   （玩家回報「還是會跳電腦版」）。包進固定寬的框之後，外面怎麼拉，裡面永遠是手機寬。
  try {
    var phone = window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 600;
    if (phone) return;
  } catch (e) { return; }

  location.replace('phone.html' + location.search + location.hash);
})();
