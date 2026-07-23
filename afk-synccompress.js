/* ============================================================================
 * afk-synccompress.js — 存檔即時壓縮（預設關）
 *
 * 為什麼需要:上游 commit d8e583539(2026-07-11)把 _lzSet 從「同步壓縮」改成
 *   「先寫原文、背景 Worker 事後壓」以避免大存檔壓縮卡主線。立意雖好,卻引進一個空窗:
 *   存檔到「Worker 壓完」之間,頁面若被登出/重整/關閉 → Worker 連同還沒壓的工作一起被殺
 *   → 那格永遠留在「未壓縮原文」(比壓縮版大 ~10 倍)。
 *   手機 PWA 每次登出(存檔後 ~32ms 就 location.reload)、多開狂存,都會讓「當前活躍存檔格」
 *   卡在原文 → localStorage 迅速爆滿 → setItem 失敗 → 角色/倉庫資料消失(已有玩家中獎)。
 *
 * 做法:開啟後把 _lzSet 的「網頁路徑」換回作者 d8e583539 之前的同步壓縮——存檔當下就壓成
 *   LZ1 再寫入,沒有非同步空窗;不論登出/關頁/多開,存進去的一定是壓縮版。
 *   關閉(預設)時完全透明放行上游原版(非同步)行為,一個 byte 都不改。
 *
 * 取捨:開啟後每次存檔會當場壓一次(桌機約 17~92ms、手機大存檔可達 ~425ms),故預設關,
 *   讓有「爆滿/存檔消失」困擾的重度或多開玩家自行開啟(在「檢查存檔大小」看到很多「未壓縮」時)。
 *   打包版(window.fableStore=檔案存檔·不受 localStorage 配額限制)不插手。
 *
 * 掛接:在 index.html </body> 前、afk-toggles 之後、任何會存檔的外掛之前載入(緊接 afk-lzcache)。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) AFK_TOGGLES.register({
    id: 'synccompress', name: '存檔即時壓縮', group: '系統與其他', def: false,
    desc: '每次存檔當下就壓縮再寫入(而非交給背景事後壓)。可根治「登出或多開後存檔沒被壓縮、'
      + '佔用暴增導致角色/倉庫消失」。代價:存檔的瞬間會多花一點時間壓縮(手機大存檔可能小卡),'
      + '故預設關閉;若在「檢查存檔大小」看到很多「未壓縮」再打開。'
  });

  if (typeof _lzSet !== 'function' || typeof LZString === 'undefined' || typeof LZString.compressToUTF16 !== 'function') {
    console.warn('[AFK-synccompress] 找不到 _lzSet / LZString，停用（遊戲照常運作）。');
    return;
  }
  if (_lzSet.__afkSync) { console.log('[AFK-synccompress] hooks OK'); return; }   // 冪等:重複載入不疊包

  var _orig = _lzSet;
  var _syncLzSet = function (key, jsonStr) {
    // 開關關 / 讀不到開關中樞 / 打包版 → 完全用回上游原版(非同步)行為,不改任何 byte
    if (!window.AFK_TOGGLES || !AFK_TOGGLES.enabled('synccompress') || window.fableStore) return _orig(key, jsonStr);
    // 同步壓縮(還原作者 d8e583539 之前的版本):存檔當下就壓成 LZ1,無非同步空窗
    try { if (typeof _lzWorkerRev !== 'undefined' && _lzWorkerRev) _lzWorkerRev[key] = (_lzWorkerRev[key] || 0) + 1; } catch (e) {}   // 讓任何在途的舊 Worker 結果失效(rev 不符→其 onmessage 放棄),不會回頭用舊原文蓋掉我們剛壓好的版本
    var packed = null;
    try { packed = 'LZ1:' + LZString.compressToUTF16(jsonStr); } catch (e) { packed = null; }
    if (packed != null && _lsSet(key, packed)) return true;
    if (_lsSet(key, jsonStr)) return true;   // 壓縮或寫入失敗 → 退原文(與作者原版 fallback 一致)
    if (typeof logSys === 'function') logSys('<span class="text-red-400 font-bold">⚠ 儲存空間不足，存檔可能未完整寫入。</span>');
    return false;
  };
  _syncLzSet.__afkSync = true;
  _lzSet = _syncLzSet;   // 覆寫全域:核心 saveGame/saveWarehouse/血盟… 呼叫的 _lzSet 都會指到這裡

  console.log('[AFK-synccompress] hooks OK');
})();
