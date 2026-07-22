/* ============================================================================
 * afk-retrial.js — 試煉重複挑戰：已完成的職業試煉可以重置、再刷一次獎勵
 *
 * 原版的職業試煉（15/30/45 級＝player.trialQ、50 級＝player.trialStage）每個角色
 * 只能完成一次，完成後試煉裝備就再也拿不到第二件。本外掛在「✅ 已完成」的試煉
 * 區塊補一顆「🔁 重新挑戰」鈕：
 *   ・15/30/45 級 → 把該試煉重置回「未接取」；重新接取後試煉道具照原版規則
 *     再次掉落（100%·達需求即停），收集齊即可再領一次全部獎勵。
 *   ・50 級 → 回到「最終兌換階段」（魔族神殿維持開放）；接取狀態下最終材料
 *     再次掉落，交付後可再領一次全部獎勵。不重跑前面的階段任務——獎勵都在
 *     最終兌換，前段只是開門劇情，重跑只會多折騰玩家。
 *
 * 作法：包核心的 trialQHTML()／build50TrialHTML()，只在「已完成」分支的回傳 HTML
 *   末尾插入自己的按鈕；重置本身只改 player.trialQ[key]／player.trialStage 再走
 *   核心 saveGame()，之後的接取/掉落/完成全部沿用原版流程（單一真相，上游改規則
 *   自動跟著改）。任何核心函式不在 → 印 warn 後安靜停用，不影響遊戲。
 *
 * 掛接：在 index.html 的 </body> 前 <script src="afk-retrial.js">。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'retrial', name: '試煉重複挑戰', group: '遊戲玩法', def: true,
      desc: '已完成的職業試煉（15/30/45/50 級）可按「重新挑戰」重置，再次收集試煉道具即可重複領取獎勵'
    });
  }
  function on() { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('retrial'); }

  // 確認彈窗：有 afk-ui 用它（手機返回鍵/ESC 可關），沒有退回原生 confirm
  function ask(title, message, onOk) {
    if (window.AFK_UI && typeof AFK_UI.confirm === 'function') {
      AFK_UI.confirm({ title: title, message: message, okText: '重新挑戰', onOk: onOk });
    } else if (window.confirm(title + '\n' + message)) onOk();
  }

  // 在區塊 HTML 的最後一個 </div> 之前塞入按鈕（落在同一張卡片內）
  function inject(html, btnHtml) {
    var i = html.lastIndexOf('</div>');
    if (i < 0) return html;
    return html.slice(0, i) + btnHtml + html.slice(i);
  }

  function rerender(rr) {
    if (typeof window._trialRerender === 'function') _trialRerender(rr);
    else if (typeof closeNpcInteraction === 'function') closeNpcInteraction();
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
    reset50: function () {
      if (!on() || !player || !player.cls) return;
      var cfg = TRIAL_50_CFG[player.cls];
      if (!cfg) return;
      var nStages = cfg.stages.length;
      if ((player.trialStage || 0) < nStages + 2) return;
      var need = cfg.exMatCnt || 1;
      ask('重新挑戰 50 級試煉',
        '回到 50 級試煉的最終兌換階段（魔族神殿維持開放）。\n接取狀態下 ' + cfg.exMatNm + ' 會再次掉落（需 ' + need + ' 個），交付後可再領一次全部獎勵。',
        function () {
          if (!player || !player.cls || (player.trialStage || 0) < nStages + 2) return;
          player.trialStage = nStages + 1;
          saveGame();
          logSys('<span class="text-amber-300 font-bold">🔁 外掛：已重置 50 級試煉的最終兌換，去收集 ' + cfg.exMatNm + ' 吧。</span>');
          if (typeof closeNpcInteraction === 'function') closeNpcInteraction();
        });
    }
  };

  function init() {
    var missing = ['trialQHTML', 'build50TrialHTML', 'trialQState', 'saveGame', 'logSys']
      .filter(function (n) { return typeof window[n] !== 'function'; });
    if (missing.length || typeof TRIAL_Q === 'undefined' || typeof TRIAL_50_CFG === 'undefined') {
      console.warn('[AFK-retrial] 缺少核心函式/資料（' + (missing.join(',') || 'TRIAL_Q/TRIAL_50_CFG') + '），試煉重複挑戰停用。');
      return;
    }

    var origQ = window.trialQHTML;
    window.trialQHTML = function (key, rr) {
      var out = origQ.apply(this, arguments);
      try {
        if (!on() || !out || trialQState(key) !== 2) return out;
        return inject(out,
          '<div class="mt-1"><button class="btn bg-amber-800 hover:bg-amber-700 py-2 px-4 font-bold" onclick="AFK_RETRIAL.resetQ(\'' + key + '\',\'' + rr + '\')">🔁 重新挑戰（外掛）</button></div>');
      } catch (e) { return out; }
    };

    var orig50 = window.build50TrialHTML;
    window.build50TrialHTML = function (npcName) {
      var out = orig50.apply(this, arguments);
      try {
        if (!on() || !player || !player.cls) return out;
        var cfg = TRIAL_50_CFG[player.cls];
        if (!cfg || cfg.npc !== npcName || (player.trialStage || 0) < cfg.stages.length + 2) return out;
        return inject(out,
          '<div class="p-4 pt-0"><button class="btn bg-amber-800 hover:bg-amber-700 py-2 px-4 font-bold" onclick="AFK_RETRIAL.reset50()">🔁 重新挑戰最終兌換（外掛）</button></div>');
      } catch (e) { return out; }
    };

    console.log('[AFK-retrial] hooks OK — 已完成的試煉顯示「重新挑戰」鈕。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
