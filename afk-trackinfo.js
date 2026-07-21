/* ============================================================================
 * afk-trackinfo.js — 狀態欄顯示「魔物追蹤」剩餘時間
 *
 * 城堡的魔物追蹤 NPC（奧貝勒／赫特／帝倫）花金幣追蹤指定地圖的指定怪物，效期 8 小時、
 * 期間該圖出怪有 50%（戴小獵犬的追蹤鼻 70%）固定變成被追蹤的那隻。上游只有「回去問 NPC」
 * 才看得到還剩多久 → 本外掛把它直接寫進狀態欄（能力面板底部的「狀態:」那行）：
 *
 *     🔍 追蹤:黑豹 3時12分
 *
 *   人在被追蹤的那張圖 → 青色（正在生效）；在別張圖 → 灰色，滑鼠移上去（或長按）
 *   告訴玩家要去哪張圖才生效。時間用牆鐘算（追蹤是關遊戲也會流逝的真實時間）。
 *
 * 作法：包核心 renderStatusEffects()（每 tick 會重寫 #dt-buffs 的內容），在原函式跑完後
 *   把追蹤這一格補上去——不改核心、上游怎麼改那行的內容都不衝突。
 *   ・沒有追蹤中 → 立刻早退，零 DOM 動作（這是每 tick 都會經過的路徑）。
 *   ・state.ff（離線補跑）期間直接不做事：原函式此時也是 return，畫面本來就不刷新。
 *   ・原函式在「沒有任何增益」時輸出「狀態: 正常」→ 這時把「正常」換掉而不是接在它後面
 *     （顯示「狀態: 正常 / 🔍 追蹤…」很怪）。比對不到「正常」也只是退化成接在後面，不會壞。
 *
 * 掛接：在 index.html 的 </body> 前 <script src="afk-trackinfo.js">。
 * ========================================================================== */
(function () {
  'use strict';

  function on() { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('trackinfo'); }

  // 追蹤中的那一格（回傳 null＝沒有追蹤／資料不全，呼叫端直接不顯示）
  // ⚠ player/state/mapState/DB 在核心是 let/const 宣告＝不掛在 window 上（window.player 永遠 undefined，
  //   寫成 window.player && … 會整支安靜失效）。外掛是普通 <script>，直接用識別字就讀得到同一個全域繫結。
  function buildSpan() {
    var tr = (typeof player !== 'undefined') && player.tracking;
    if (!tr || !tr.until || !(tr.until > Date.now())) return null;

    var left = tr.until - Date.now();
    var h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000);
    var mobName = (typeof DB !== 'undefined' && DB.mobs[tr.mob] && DB.mobs[tr.mob].n);
    if (!mobName) return null;   // 查不到怪（存檔殘值／上游刪怪）→ 寧可不顯示，也不要顯示 undefined
    var here = (typeof mapState !== 'undefined') && tr.map === mapState.current;
    var mapName = (window.AFK_EXTRA && AFK_EXTRA.mapName) ? AFK_EXTRA.mapName(tr.map) : tr.map;

    var span = document.createElement('span');
    span.className = 'afk-trackinfo font-bold ' + (here ? 'text-cyan-300' : 'text-slate-500');
    span.title = here ? '追蹤中：這張圖該怪的出現率提高' : '追蹤的地圖不是這裡（要到「' + mapName + '」才生效）';
    span.textContent = '🔍 追蹤:' + mobName + ' ' + (h > 0 ? h + '時' : '') + m + '分';
    return span;
  }

  function appendTrack() {
    var el = document.getElementById('dt-buffs');
    if (!el || el.querySelector('.afk-trackinfo')) return;   // 沒有面板／本輪已補過就不做
    var span = buildSpan();
    if (!span) return;

    // 「狀態: 正常」＝沒有任何增益 → 把「正常」讓給追蹤這格；否則以 " / " 接在既有增益後面
    var first = el.firstChild, sep = ' / ';
    if (first && first.nodeType === 3 && /正常\s*$/.test(first.nodeValue)) {
      first.nodeValue = first.nodeValue.replace(/正常\s*$/, '');
      sep = '';
    }
    var abnormal = el.querySelector('div');   // 下方的「異常:」區塊（可能不存在）→ 追蹤要插在它前面
    if (sep) el.insertBefore(document.createTextNode(sep), abnormal || null);
    el.insertBefore(span, abnormal || null);
  }

  function init() {
    if (typeof window.renderStatusEffects !== 'function') {
      console.warn('[AFK-trackinfo] 找不到 renderStatusEffects（上游可能改名），魔物追蹤顯示停用。');
      return;
    }
    var orig = window.renderStatusEffects;
    window.renderStatusEffects = function () {
      var r = orig.apply(this, arguments);
      if (typeof state !== 'undefined' && state.ff) return r;   // 離線補跑期間不動畫面（原函式同樣早退）
      if (on()) { try { appendTrack(); } catch (e) {} }
      return r;
    };
    console.log('[AFK-trackinfo] hooks OK — 狀態欄會顯示魔物追蹤剩餘時間。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
