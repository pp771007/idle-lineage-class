/* ============================================================================
 * afk-notip.js — 關閉物品懸停資訊框（給嫌 hover 資訊框擋路的玩家;預設不啟用）
 *
 * 核心(js/14)在 document 的 mousemove 對 .tip-host 顯示單一 .game-tooltip:
 * 滑鼠掃過武器/防具/道具就彈出大張資訊框,有玩家嫌擋路。本外掛開啟後把
 * 「物品類」的懸停資訊框藏掉;技能說明(_id 前綴 SK:)照常顯示——擋路抱怨
 * 針對的是物品框,技能頁沒有別的地方能看技能能力。
 *
 * 作法:自己在 document 掛一支 mousemove(載入順序在核心之後→同一事件裡core
 * 先顯示、本檔後藏,同幀內完成不閃爍),依 tooltip 元素的 _id 前綴判斷內容類型。
 * 只在「滑鼠環境」(hover:hover + pointer:fine)動作:手機的長按看資料
 * (afk-touchtip/afk-warehouse)走同一顆 tooltip,不能被誤殺。
 *
 * 掛接:在 index.html 的 </body> 前 <script src="afk-notip.js">。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'notip', name: '關閉物品懸停資訊框', group: '遊戲介面', def: false,
      desc: '滑鼠移到武器/防具/道具上不再彈出資訊框（嫌擋路的人再開；技能說明照常顯示、手機長按看資料不受影響）'
    });
    if (!AFK_TOGGLES.enabled('notip')) return;
  } else {
    return;   // 沒有開關中樞就不啟用:本外掛是「預設關」的偏好,不能在讀不到設定時自作主張關掉資訊框
  }

  var mouseEnv = false;
  try { mouseEnv = window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}
  if (!mouseEnv) { console.log('[AFK-notip] 非滑鼠環境(觸控),不動任何資訊框。'); return; }

  document.addEventListener('mousemove', function () {
    var el = document.querySelector('.game-tooltip');
    if (!el || el.style.display === 'none') return;
    if (el._id && String(el._id).indexOf('SK:') === 0) return;   // 技能說明保留
    el.style.display = 'none';
  });

  console.log('[AFK-notip] hooks OK — 物品懸停資訊框已關閉(技能說明保留)。');
})();
