// 01z-my-tweaks-drops.js — 套用試算表的掉落表修改(資料在 js/00y-my-tweaks-data.js 的 drops)
//
// 載入順序:緊接 js/01-drops-config.js 之後——MOB_DROPS 在那裡建好,後面的擊殺/離線/查詢都讀它。
// 以怪物「名稱」為鍵整隻替換;資料壞掉或缺檔時安靜跳過,遊戲照原始掉落跑。
(function () {
  'use strict';
  var D = window.MY_TWEAKS && window.MY_TWEAKS.drops;
  if (!D || typeof MOB_DROPS === 'undefined') return;
  try {
    for (var mob in D) {
      MOB_DROPS[mob] = D[mob].filter(function (r) { return DB.items[r[0]]; }).map(function (r) { return [r[0], r[1]]; });
    }
  } catch (e) { console.warn('[my-tweaks] 掉落套用失敗', e); }
})();
