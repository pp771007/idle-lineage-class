/* ============================================================================
 * afk-retrial.js — 試煉批次兌換：試煉道具持續掉落＋自訂數量重複兌換（不動試煉狀態）
 *
 * 原版的職業試煉（15/30/45 級＝player.trialQ、50 級＝player.trialStage）每個角色
 * 只能完成一次，且試煉道具「達需求數量即停止掉落」。本外掛：
 *   ・外掛開啟時試煉道具「持續掉落」：無視「達量即停」與「已完成就不掉」，
 *     照原版規則 100% 掉落，掛機可累積多份材料。
 *   ・原版試煉 UI 下方加「🔌 外掛批次兌換」：顯示持有量，數量輸入＋「全部」＋
 *     兌換鈕，一次扣 N 份材料、發 N 份獎勵（發獎照抄核心 trialQComplete 的流程，
 *     含 _tradLootCtx 傳統模式強化值上下文）。
 *
 * 🔑 設計原則：player.trialQ / player.trialStage 等試煉狀態「只讀不寫」——接取、
 *   完成、開魔族神殿全部走原版流程；外掛兌換只是「扣道具＋發獎勵」，跟一般
 *   NPC 兌換同一類寫入，把出錯面壓到最小。
 *
 * 適用範圍：15/30/45 級試煉「已接取之後」（進行中或已完成）；50 級試煉「走到
 *   最終兌換階段之後」。前置階段照原版打（那些只是開門劇情，沒有可刷的獎勵；
 *   50 級階段道具多半 maxHold 1，也維持原版掉落行為）。
 *
 * 注意：上游離線/背景分頁結算（js/27）本來就不發試煉道具（_offlineTrialItem 一律
 *   跳過），所以「掛機」＝遊戲開著在前景跑才會掉；本外掛不去動那套統計結算。
 *
 * 作法：純外掛，包三支核心全域函式——trialItemActive()（放寬掉落閘）與
 *   trialQHTML()／build50TrialHTML()（注入外掛區塊），不需任何核心補丁。
 *   任何核心函式不在 → 印 warn 後安靜停用，不影響遊戲。
 *
 * 掛接：在 index.html 的 </body> 前 <script src="afk-retrial.js">。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'retrial', name: '試煉批次兌換', group: '遊戲玩法', def: true,
      desc: '試煉道具持續掉落（不再達量即停、已完成也照掉），試煉面板可自訂數量一次兌換多份獎勵；不動原本的試煉狀態'
    });
  }
  function on() { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('retrial'); }

  // 在區塊 HTML 的最後一個 </div> 之前塞入內容（落在同一張卡片內）
  function inject(html, extraHtml) {
    var i = html.lastIndexOf('</div>');
    if (i < 0) return html;
    return html.slice(0, i) + extraHtml + html.slice(i);
  }

  function rerender(rr) {
    if (typeof window._trialRerender === 'function') _trialRerender(rr);
    else if (typeof closeNpcInteraction === 'function') closeNpcInteraction();
  }

  // 15/30/45：目前材料可兌換幾份
  function setsOfQ(c) {
    var n = Infinity;
    c.reqs.forEach(function (p) { n = Math.min(n, Math.floor(questCountId(p[0]) / (p[1] || 1))); });
    return isFinite(n) ? n : 0;
  }
  function qtyVal(id, max) {
    var el = document.getElementById(id), v = el ? parseInt(el.value) : 1;
    if (!v || v < 1) v = 1;
    return Math.min(v, max);
  }
  // 照抄核心 trialQComplete/trialRun 的發獎方式（傳統模式：獎勵裝備隨機自帶強化值）
  function grant(rewardIds, times) {
    var _sv = _tradLootCtx; _tradLootCtx = true;
    try {
      for (var i = 0; i < times; i++) rewardIds.forEach(function (id) { gainItem(id, 1, false, false); });
    } finally { _tradLootCtx = _sv; }
  }

  // ── 外掛區塊 HTML（qk＝qty input id）──
  function blockHTML(matsHtml, sets, qk, exCall, rewardNote) {
    var h = '<div class="mt-2 p-2 rounded border border-slate-600">'
      + '<div class="text-sky-300 font-bold text-xs mb-1">🔌 外掛批次兌換（道具會持續掉落）</div>'
      + '<div class="text-xs text-slate-400 mb-1">目前持有：' + matsHtml + (rewardNote || '') + '</div>';
    if (sets >= 1) {
      h += '<div class="flex items-center gap-2 flex-wrap">'
        + '<input id="' + qk + '" type="number" min="1" max="' + sets + '" value="1" onclick="event.stopPropagation()"'
        + ' class="w-16 bg-slate-900 border border-slate-600 text-white text-center rounded py-1">'
        + '<button class="btn px-3 py-1 text-sm font-bold bg-slate-700 border-slate-500" onclick="document.getElementById(\'' + qk + '\').value=' + sets + '">全部</button>'
        + '<button class="btn bg-emerald-800 hover:bg-emerald-700 py-1 px-4 font-bold text-sm" onclick="' + exCall + '">兌換（最多 ×' + sets + '）</button>'
        + '</div>';
    } else {
      h += '<div class="text-xs text-slate-500">材料不足 1 份，無法兌換。</div>';
    }
    return h + '</div>';
  }

  window.AFK_RETRIAL = {
    exQ: function (key, rr) {
      if (!on()) return;
      var c = TRIAL_Q[key];
      if (!c || !player || !player.cls || player.cls !== c.cls) return;
      var sets = setsOfQ(c);
      if (sets < 1) { logSys('<span class="text-red-400 font-bold">材料不足，無法兌換。</span>'); return; }
      var n = qtyVal('afk-rt-qty-' + key, sets);
      c.reqs.forEach(function (p) { questConsumeId(p[0], (p[1] || 1) * n); });
      grant(c.rewards, n);
      logSys('<span class="c-legend font-bold">🔌 外掛批次兌換 ×' + n + '：</span><span class="text-amber-200">獲得 '
        + c.rewards.map(function (id) { return DB.items[id].n + '×' + n; }).join('、') + '。</span>');
      saveGame(); if (typeof renderTabs === 'function') renderTabs(); rerender(rr);
    },
    ex50: function () {
      if (!on() || !player || !player.cls) return;
      var cfg = TRIAL_50_CFG[player.cls];
      if (!cfg) return;
      var need = cfg.exMatCnt || 1, sets = Math.floor(questCountId(cfg.exMat) / need);
      if (sets < 1) { logSys('<span class="text-red-400 font-bold">材料不足，無法兌換。</span>'); return; }
      var n = qtyVal('afk-rt-qty-t50', sets);
      questConsumeId(cfg.exMat, need * n);
      grant(cfg.rewards.map(function (r) { return r.id; }), n);
      logSys('<span class="c-legend font-bold">🔌 外掛批次兌換 ×' + n + '：</span><span class="text-amber-200">獲得 '
        + cfg.rewards.map(function (r) { return r.nm + '×' + n; }).join('、') + '。</span>');
      saveGame(); if (typeof renderTabs === 'function') renderTabs();
      var f = window['AFK_RETRIAL_R50_' + cfg.npc];   // 由 build50TrialHTML wrapper 記錄的重繪函式
      if (typeof f === 'function') { var _c = document.getElementById('interaction-content'); if (_c) { f(_c); return; } }
      if (typeof closeNpcInteraction === 'function') closeNpcInteraction();
    }
  };

  function init() {
    var missing = ['trialQHTML', 'build50TrialHTML', 'trialQState', 'trialItemActive', 'questCountId', 'questConsumeId', 'gainItem', 'saveGame', 'logSys']
      .filter(function (n) { return typeof window[n] !== 'function'; });
    if (missing.length || typeof TRIAL_Q === 'undefined' || typeof TRIAL_50_CFG === 'undefined'
      || typeof TRIAL_ITEM_Q === 'undefined' || typeof TRIAL50_ITEM === 'undefined') {
      console.warn('[AFK-retrial] 缺少核心函式/資料（' + (missing.join(',') || 'TRIAL_*') + '），試煉批次兌換停用。');
      return;
    }

    // 掉落閘放寬（外掛開著就生效）：
    //   15/30/45：已接取過（進行中或已完成）就掉、無視達量即停；
    //   50 級：走到最終兌換階段之後（含已完成）最終材料照掉。
    //   未接取／前置階段＝原版行為原封不動（orig 回 true 的一律照舊）。
    var origActive = window.trialItemActive;
    window.trialItemActive = function (id) {
      var r = origActive.apply(this, arguments);
      if (r || !on()) return r;
      try {
        if (!player || !player.cls) return r;
        var ks = TRIAL_ITEM_Q[id];
        if (ks) return ks.some(function (k) { return TRIAL_Q[k].cls === player.cls && trialQState(k) >= 1; });
        var t = TRIAL50_ITEM[id];
        if (t && t.ex && player.cls === t.cls) {
          var cfg = TRIAL_50_CFG[player.cls];
          return !!cfg && (player.trialStage || 0) >= cfg.stages.length + 1;
        }
      } catch (e) {}
      return r;
    };

    var origQ = window.trialQHTML;
    window.trialQHTML = function (key, rr) {
      var out = origQ.apply(this, arguments);
      try {
        var c = TRIAL_Q[key];
        if (!on() || !out || !c || trialQState(key) < 1) return out;   // 未接取：維持原版（先走原版接取）
        var matsHtml = c.reqs.map(function (p) { return DB.items[p[0]].n + '×' + questCountId(p[0]); }).join('、');
        var rw = '　→ 每份獎勵：' + c.rewards.map(function (id) { return DB.items[id].n; }).join('＋');
        return inject(out, blockHTML(matsHtml, setsOfQ(c), 'afk-rt-qty-' + key,
          'AFK_RETRIAL.exQ(\'' + key + '\',\'' + rr + '\')', rw));
      } catch (e) {}
      return out;
    };

    var orig50 = window.build50TrialHTML;
    window.build50TrialHTML = function (npcName) {
      var out = orig50.apply(this, arguments);
      try {
        if (!on() || !player || !player.cls) return out;
        var cfg = TRIAL_50_CFG[player.cls];
        if (!cfg || cfg.npc !== npcName) return out;
        var st = player.trialStage || 0, nStages = cfg.stages.length;
        if (st < nStages + 1) return out;   // 還沒走到最終兌換階段：維持原版
        // 記錄「這位 NPC 的重繪函式」給 ex50 就地重繪用（核心沒把呼叫端函式名傳進來，改由已知對照）
        var R50 = { '迪嘉勒廷': 'renderDigallatin', '希蓮恩': 'renderShenien', '多文': 'renderDuwen', '普洛凱爾': 'renderProcel' };
        window['AFK_RETRIAL_R50_' + npcName] = R50[npcName] ? window[R50[npcName]] : null;
        var need = cfg.exMatCnt || 1;
        var matsHtml = cfg.exMatNm + '×' + questCountId(cfg.exMat) + '（每份需 ' + need + ' 個）';
        var rw = '　→ 每份獎勵：' + cfg.rewards.map(function (r) { return r.nm; }).join('＋');
        var block = '<div class="px-4 pb-4">'
          + blockHTML(matsHtml, Math.floor(questCountId(cfg.exMat) / need), 'afk-rt-qty-t50', 'AFK_RETRIAL.ex50()', rw)
          + '</div>';
        return out + block;   // 50 級各分支結尾都已把卡片關掉，直接接在後面
      } catch (e) {}
      return out;
    };

    console.log('[AFK-retrial] hooks OK — 試煉批次兌換/持續掉落就緒。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
