/* ============================================================================
 * afk-retrial.js — 試煉重複挑戰：重置已完成的試煉＋道具持續掉落＋批次兌換
 *
 * 原版的職業試煉（15/30/45 級＝player.trialQ、50 級＝player.trialStage）每個角色
 * 只能完成一次，且試煉道具「達需求數量即停止掉落」。本外掛做三件事：
 *   1. 已完成的試煉補「🔁 重新挑戰」鈕：15/30/45 級重置回「未接取」；50 級回到
 *      「最終兌換階段」（魔族神殿維持開放；前段階段任務只是開門劇情、沒有獎勵，
 *      不逼玩家重跑）。
 *   2. 接取中的試煉道具「持續掉落」：解除「達需求即停」的量閘（接取/職業/完成
 *      狀態的閘全部保留），掛機期間可以累積多份材料。50 級只放寬最終兌換材料；
 *      階段道具（丹特斯的召書等，多半 maxHold 1）維持原版行為。
 *   3. 面板補「⚡ 批次兌換 ×N」：一次扣 N 份材料、發 N 份獎勵，且「不結束試煉」
 *      （狀態留在進行中，道具繼續掉）。原版「完成試煉」鈕保留＝想收尾時用它。
 *
 * 注意：上游離線/背景分頁結算（js/27）本來就不發試煉道具（_offlineTrialItem 一律
 *   跳過），所以「掛機」＝遊戲開著在前景跑才會掉；本外掛不去動那套統計結算。
 *
 * 作法：包核心的 trialItemActive()（放寬量閘）與 trialQHTML()／build50TrialHTML()
 *   （注入按鈕）；重置/批次兌換照抄核心 trialQComplete/trial50Complete 的消耗與發獎
 *   流程（含 _tradLootCtx 傳統模式強化值上下文），只是不把狀態標成已完成。
 *   任何核心函式不在 → 印 warn 後安靜停用，不影響遊戲。
 *
 * 掛接：在 index.html 的 </body> 前 <script src="afk-retrial.js">。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'retrial', name: '試煉重複挑戰', group: '遊戲玩法', def: true,
      desc: '已完成的職業試煉可重新挑戰；接取中的試煉道具持續掉落（不再達量即停），面板可批次兌換獎勵而不結束試煉'
    });
  }
  function on() { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('retrial'); }

  // 確認彈窗：有 afk-ui 用它（手機返回鍵/ESC 可關），沒有退回原生 confirm
  function ask(title, message, onOk) {
    if (window.AFK_UI && typeof AFK_UI.confirm === 'function') {
      AFK_UI.confirm({ title: title, message: message, okText: '確定', onOk: onOk });
    } else if (window.confirm(title + '\n' + message)) onOk();
  }

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
  // 照抄核心 trialQComplete/trialRun 的發獎方式（傳統模式：獎勵裝備隨機自帶強化值）
  function grant(rewardIds, times) {
    var _sv = _tradLootCtx; _tradLootCtx = true;
    try {
      for (var i = 0; i < times; i++) rewardIds.forEach(function (id) { gainItem(id, 1, false, false); });
    } finally { _tradLootCtx = _sv; }
  }

  window.AFK_RETRIAL = {
    resetQ: function (key, rr) {
      if (!on()) return;
      var c = TRIAL_Q[key];
      if (!c || !player || !player.cls || player.cls !== c.cls || trialQState(key) !== 2) return;
      ask('重新挑戰試煉',
        '將「' + c.lv + ' 級試煉」重置為未接取狀態。\n重新接取後，試煉道具會再次掉落，收集齊即可再領一次全部獎勵。',
        function () {
          if (!player || !player.cls || trialQState(key) !== 2) return;
          player.trialQ[key] = 0;
          saveGame();
          logSys('<span class="text-amber-300 font-bold">🔁 外掛：已重置 ' + c.lv + ' 級試煉，可再次接取。</span>');
          rerender(rr);
        });
    },
    batchQ: function (key, rr) {
      if (!on()) return;
      var c = TRIAL_Q[key];
      if (!c || !player || !player.cls || player.cls !== c.cls || trialQState(key) !== 1) return;
      var sets = setsOfQ(c);
      if (sets < 1) { logSys('<span class="text-red-400 font-bold">材料不足，無法兌換。</span>'); return; }
      ask('批次兌換 ×' + sets,
        '消耗：' + c.reqs.map(function (p) { return DB.items[p[0]].n + '×' + (p[1] || 1) * sets; }).join('、')
        + '\n獲得：' + c.rewards.map(function (id) { return DB.items[id].n + '×' + sets; }).join('、')
        + '\n試煉維持進行中，道具會繼續掉落。',
        function () {
          if (!player || !player.cls || trialQState(key) !== 1) return;
          var n = Math.min(sets, setsOfQ(c));   // 兌換當下重算，材料若有變動以較小者為準
          if (n < 1) return;
          c.reqs.forEach(function (p) { questConsumeId(p[0], (p[1] || 1) * n); });
          grant(c.rewards, n);
          logSys('<span class="c-legend font-bold">⚡ 外掛批次兌換 ×' + n + '：</span><span class="text-amber-200">獲得 '
            + c.rewards.map(function (id) { return DB.items[id].n + '×' + n; }).join('、') + '。（試煉維持進行中）</span>');
          saveGame(); if (typeof renderTabs === 'function') renderTabs(); rerender(rr);
        });
    },
    reset50: function () {
      if (!on() || !player || !player.cls) return;
      var cfg = TRIAL_50_CFG[player.cls];
      if (!cfg) return;
      var nStages = cfg.stages.length;
      if ((player.trialStage || 0) < nStages + 2) return;
      var need = cfg.exMatCnt || 1;
      ask('重新挑戰 50 級試煉',
        '回到 50 級試煉的最終兌換階段（魔族神殿維持開放）。\n接取狀態下 ' + cfg.exMatNm + ' 會再次掉落（每份需 ' + need + ' 個），交付後可再領全部獎勵。',
        function () {
          if (!player || !player.cls || (player.trialStage || 0) < nStages + 2) return;
          player.trialStage = nStages + 1;
          saveGame();
          logSys('<span class="text-amber-300 font-bold">🔁 外掛：已重置 50 級試煉的最終兌換，去收集 ' + cfg.exMatNm + ' 吧。</span>');
          if (typeof closeNpcInteraction === 'function') closeNpcInteraction();
        });
    },
    batch50: function () {
      if (!on() || !player || !player.cls) return;
      var cfg = TRIAL_50_CFG[player.cls];
      if (!cfg) return;
      var nStages = cfg.stages.length, need = cfg.exMatCnt || 1;
      if ((player.trialStage || 0) !== nStages + 1) return;
      var sets = Math.floor(questCountId(cfg.exMat) / need);
      if (sets < 1) { logSys('<span class="text-red-400 font-bold">材料不足，無法兌換。</span>'); return; }
      ask('批次兌換 ×' + sets,
        '消耗：' + cfg.exMatNm + '×' + need * sets
        + '\n獲得：' + cfg.rewards.map(function (r) { return r.nm + '×' + sets; }).join('、')
        + '\n維持在最終兌換階段，' + cfg.exMatNm + ' 會繼續掉落。',
        function () {
          if (!player || !player.cls || (player.trialStage || 0) !== nStages + 1) return;
          var n = Math.min(sets, Math.floor(questCountId(cfg.exMat) / need));
          if (n < 1) return;
          questConsumeId(cfg.exMat, need * n);
          grant(cfg.rewards.map(function (r) { return r.id; }), n);
          logSys('<span class="c-legend font-bold">⚡ 外掛批次兌換 ×' + n + '：</span><span class="text-amber-200">獲得 '
            + cfg.rewards.map(function (r) { return r.nm + '×' + n; }).join('、') + '。（維持最終兌換階段）</span>');
          saveGame(); if (typeof renderTabs === 'function') renderTabs();
          if (typeof closeNpcInteraction === 'function') closeNpcInteraction();
        });
    }
  };

  var BTN = 'btn bg-amber-800 hover:bg-amber-700 py-2 px-4 font-bold';

  function init() {
    var missing = ['trialQHTML', 'build50TrialHTML', 'trialQState', 'trialItemActive', 'questCountId', 'questConsumeId', 'gainItem', 'saveGame', 'logSys']
      .filter(function (n) { return typeof window[n] !== 'function'; });
    if (missing.length || typeof TRIAL_Q === 'undefined' || typeof TRIAL_50_CFG === 'undefined'
      || typeof TRIAL_ITEM_Q === 'undefined' || typeof TRIAL50_ITEM === 'undefined') {
      console.warn('[AFK-retrial] 缺少核心函式/資料（' + (missing.join(',') || 'TRIAL_*') + '），試煉重複挑戰停用。');
      return;
    }

    // 放寬「達需求數量即停止掉落」：接取中(15/30/45)與 50 級最終兌換階段的材料持續掉落。
    // 接取/職業/完成狀態的閘全部沿用原判定（orig 回 true 的一律照舊；只把「僅因達量而 false」翻成 true）。
    var origActive = window.trialItemActive;
    window.trialItemActive = function (id) {
      var r = origActive.apply(this, arguments);
      if (r || !on()) return r;
      try {
        if (!player || !player.cls) return r;
        var ks = TRIAL_ITEM_Q[id];
        if (ks) return ks.some(function (k) { return TRIAL_Q[k].cls === player.cls && trialQState(k) === 1; });
        var t = TRIAL50_ITEM[id];
        if (t && t.ex && player.cls === t.cls) {
          var cfg = TRIAL_50_CFG[player.cls];
          return !!cfg && (player.trialStage || 0) === cfg.stages.length + 1;
        }
      } catch (e) {}
      return r;
    };

    var origQ = window.trialQHTML;
    window.trialQHTML = function (key, rr) {
      var out = origQ.apply(this, arguments);
      try {
        if (!on() || !out) return out;
        var st = trialQState(key), c = TRIAL_Q[key];
        if (st === 2) {
          return inject(out,
            '<div class="mt-1"><button class="' + BTN + '" onclick="AFK_RETRIAL.resetQ(\'' + key + '\',\'' + rr + '\')">🔁 重新挑戰（外掛）</button></div>');
        }
        if (st === 1 && c) {
          var sets = setsOfQ(c);
          var extra = '<div class="text-xs text-slate-400 mt-1">外掛：試煉道具持續掉落中（目前 '
            + c.reqs.map(function (p) { return DB.items[p[0]].n + '×' + questCountId(p[0]); }).join('、') + '）</div>';
          if (sets >= 1) extra += '<div class="mt-1"><button class="' + BTN + '" onclick="AFK_RETRIAL.batchQ(\'' + key + '\',\'' + rr + '\')">⚡ 批次兌換 ×' + sets + '（不結束試煉）</button></div>';
          return inject(out, extra);
        }
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
        if (st >= nStages + 2) {
          return inject(out,
            '<div class="p-4 pt-0"><button class="' + BTN + '" onclick="AFK_RETRIAL.reset50()">🔁 重新挑戰最終兌換（外掛）</button></div>');
        }
        if (st === nStages + 1) {
          var need = cfg.exMatCnt || 1, sets = Math.floor(questCountId(cfg.exMat) / need);
          var extra = '<div class="px-4 pb-2 text-xs text-slate-400">外掛：' + cfg.exMatNm + ' 持續掉落中（目前 ×' + questCountId(cfg.exMat) + '）</div>';
          if (sets >= 1) extra += '<div class="p-4 pt-0"><button class="' + BTN + '" onclick="AFK_RETRIAL.batch50()">⚡ 批次兌換 ×' + sets + '（不結束試煉）</button></div>';
          return inject(out, extra);
        }
      } catch (e) {}
      return out;
    };

    console.log('[AFK-retrial] hooks OK — 試煉重新挑戰/持續掉落/批次兌換就緒。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
