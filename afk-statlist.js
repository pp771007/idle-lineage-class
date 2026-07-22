/* ============================================================================
 * afk-statlist.js — 「能力」分頁條列式：拿掉經典背景圖，改成放大好點的卡片版面
 *
 * 上游的「能力」分頁是一張 400×825 的經典資訊欄底圖(assets/ui/能力.png),
 * 六大能力/詳細能力/狀態全部用絕對定位貼在圖上,字級跟 ± 按鈕都跟著圖縮(2.x cqw),
 * 手機上又小又難點。本外掛比照背包條列式的思路,把同一份 DOM 重新排版:
 *   ・六大能力:2 欄卡片,能力名稱(原本印在背景圖裡)用 CSS ::before 補回來,
 *     ± 按鈕放大到好按的尺寸。
 *   ・詳細能力:左右兩張卡片(近戰/遠程 | 魔法/抗性),字級拉到 14px。
 *   ・狀態(增益)與重置配點列改為一般卡片,不再釘在圖的固定位置。
 *
 * 作法:純 CSS——給 #tab-stats 加一個 class,整套規則都掛在它底下;
 *   DOM 結構、id(dt-*)、核心的 updateUI/配點流程完全不動。
 *   關閉外掛(或本檔沒載到)= class 不加,原版圖面原封不動。
 *   afk-statpts 的「點數來源」區塊插在 shell 後面,不受影響。
 *
 * 掛接:在 index.html 的 </body> 前 <script src="afk-statlist.js">。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) {
    AFK_TOGGLES.register({
      id: 'statlist', name: '能力面板條列式', group: '遊戲介面', def: true,
      desc: '「能力」分頁改為放大的卡片條列版面（原版是貼在經典背景圖上的小字小按鈕）；關閉即回原版圖面'
    });
    if (!AFK_TOGGLES.enabled('statlist')) return;
  }

  var CARD = 'background:#0f172a;border:1px solid #334155;border-radius:8px;';
  var css = [
    '#tab-stats.afk-sl{align-items:stretch !important;}',
    '#tab-stats.afk-sl .ability-window-shell{background:none;aspect-ratio:auto;height:auto;max-width:560px;width:100%;margin:0 auto;overflow:visible;container-type:normal;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 6px;padding:8px 8px 14px;box-sizing:border-box;}',

    /* ── 六大能力(2 欄 × 3 列;名稱原本印在背景圖裡,用 ::before 補回) ──
       ± 欄用 auto:按鈕平常是 .hidden,固定寬會讓窄面板(桌機分頁區約 300px)爆版 */
    '#tab-stats.afk-sl .ability-primary-control{position:static;width:auto;height:auto;min-width:0;grid-template-columns:auto auto minmax(0,1fr) auto;gap:4px;' + CARD + 'padding:6px 8px;font:600 16px/1 Arial,"Microsoft JhengHei",sans-serif;text-shadow:none;white-space:nowrap;}',
    '#tab-stats.afk-sl .ability-primary-control::before{grid-column:1;grid-row:1;font:700 14px/1 "Microsoft JhengHei",Arial,sans-serif;white-space:nowrap;}',
    '#tab-stats.afk-sl .ability-primary-str::before{content:"力量"}',
    '#tab-stats.afk-sl .ability-primary-dex::before{content:"敏捷"}',
    '#tab-stats.afk-sl .ability-primary-con::before{content:"體質"}',
    '#tab-stats.afk-sl .ability-primary-int::before{content:"智力"}',
    '#tab-stats.afk-sl .ability-primary-wis::before{content:"精神"}',
    '#tab-stats.afk-sl .ability-primary-cha::before{content:"魅力"}',
    '#tab-stats.afk-sl .ability-primary-control > span{grid-column:3;}',
    '#tab-stats.afk-sl .ability-primary-control .alloc-minus{grid-column:2;grid-row:1;}',
    '#tab-stats.afk-sl .ability-primary-control .alloc-plus{grid-column:4;grid-row:1;}',
    '#tab-stats.afk-sl .ability-primary-control button{width:32px;height:30px;font:700 17px/1 Arial,sans-serif;border-radius:6px;}',
    '#tab-stats.afk-sl .ability-primary-str{grid-column:1;grid-row:1}',
    '#tab-stats.afk-sl .ability-primary-dex{grid-column:1;grid-row:2}',
    '#tab-stats.afk-sl .ability-primary-con{grid-column:1;grid-row:3}',
    '#tab-stats.afk-sl .ability-primary-int{grid-column:2;grid-row:1}',
    '#tab-stats.afk-sl .ability-primary-wis{grid-column:2;grid-row:2}',
    '#tab-stats.afk-sl .ability-primary-cha{grid-column:2;grid-row:3}',

    /* ── 詳細能力(兩張全寬卡片直列;面板本身不寬,硬排兩欄會擠爆) ── */
    '#tab-stats.afk-sl .ability-detail-column{position:static;left:auto;top:auto;width:auto;height:auto;display:block;' + CARD + 'padding:8px 12px;font:500 14px/1.4 "Microsoft JhengHei",Arial,sans-serif;text-shadow:none;}',
    '#tab-stats.afk-sl .ability-detail-left{grid-column:1/-1;grid-row:4}',
    '#tab-stats.afk-sl .ability-detail-right{grid-column:1/-1;grid-row:5}',
    '#tab-stats.afk-sl .ability-detail-column > div{grid-template-columns:1fr auto;min-height:auto;padding:3px 0;}',
    '#tab-stats.afk-sl .ability-detail-column span{padding-left:0;overflow:visible;}',
    '#tab-stats.afk-sl .ability-detail-column strong{height:auto;padding-right:0;font:600 14px/1.2 Arial,sans-serif;}',
    '#tab-stats.afk-sl .ability-detail-column .ability-magic-crit-dmg span{top:0;}',
    '#tab-stats.afk-sl .ability-detail-column > .ability-detail-spacer{height:10px;}',

    /* ── 狀態(增益)卡片 ── */
    '#tab-stats.afk-sl .ability-buffs{position:static;left:auto;top:auto;width:auto;height:auto;grid-column:1/-1;' + CARD + 'padding:8px 12px;overflow:visible;font:600 13.5px/1.6 "Microsoft JhengHei",Arial,sans-serif;text-shadow:none;}',
    '#tab-stats.afk-sl .ability-buffs:empty{display:none;}',

    /* ── 重置配點(原版是壓在圖上的 overlay;:not(.hidden) 免得把收起狀態撐開) ──
       配點中(is-respec)六大能力改單欄直排:面板窄,2 欄塞不下「− 值 ＋」;配點列固定排最上面 */
    '#tab-stats.afk-sl.is-respec .ability-window-shell{grid-template-columns:1fr;}',
    '#tab-stats.afk-sl.is-respec .ability-primary-control{grid-column:1 !important;grid-row:auto !important;}',
    '#tab-stats.afk-sl.is-respec .ability-detail-left,#tab-stats.afk-sl.is-respec .ability-detail-right{grid-column:1;grid-row:auto;}',
    '#tab-stats.afk-sl .ability-respec-overlay{grid-column:1/-1;}',
    '#tab-stats.afk-sl .ability-respec-overlay:not(.hidden){position:static;inset:auto;pointer-events:auto;grid-row:1;display:flex;flex-direction:column;gap:8px;background:#1b1610;border:1px solid #8b7446;border-radius:8px;padding:10px 12px;}',
    '#tab-stats.afk-sl .ability-respec-points{position:static;left:auto;top:auto;width:auto;height:auto;justify-content:flex-start;font:700 18px/1 Arial,sans-serif;}',
    '#tab-stats.afk-sl .ability-respec-points::before{content:"剩餘點數：";font:600 14px/1 "Microsoft JhengHei",Arial,sans-serif;color:#cfc7b7;margin-right:4px;}',
    '#tab-stats.afk-sl .ability-respec-actions{position:static;left:auto;top:auto;width:auto;min-height:0;padding:0;border:none;background:none;box-shadow:none;font:500 13.5px/1.5 "Microsoft JhengHei",Arial,sans-serif;gap:8px;}',
    '#tab-stats.afk-sl .ability-respec-actions > div{gap:12px;}',
    '#tab-stats.afk-sl .ability-respec-actions button{min-width:96px;padding:9px 16px;font:700 15px/1 "Microsoft JhengHei",Arial,sans-serif;border-radius:6px;}',

    /* ── 極窄螢幕(<340px):六大能力也改單欄直排 ── */
    '@media (max-width:339px){',
    '#tab-stats.afk-sl .ability-window-shell{grid-template-columns:1fr;}',
    '#tab-stats.afk-sl .ability-primary-str,#tab-stats.afk-sl .ability-primary-dex,#tab-stats.afk-sl .ability-primary-con,#tab-stats.afk-sl .ability-primary-int,#tab-stats.afk-sl .ability-primary-wis,#tab-stats.afk-sl .ability-primary-cha{grid-column:1;grid-row:auto;}',
    '#tab-stats.afk-sl .ability-detail-left,#tab-stats.afk-sl .ability-detail-right{grid-column:1;grid-row:auto;}',
    '}'
  ].join('\n');

  function init() {
    var tab = document.getElementById('tab-stats');
    if (!tab || !tab.querySelector('.ability-window-shell')) {
      console.warn('[AFK-statlist] 找不到能力分頁的 DOM(#tab-stats/.ability-window-shell),條列式停用。');
      return;
    }
    var st = document.createElement('style');
    st.id = 'afk-statlist-css';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
    tab.classList.add('afk-sl');
    console.log('[AFK-statlist] hooks OK — 能力分頁已改為條列式版面。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
