/**
 * afk-eqlist.js — 「裝備」分頁條列式
 *
 * 核心的 renderTabs 本來就把 #tab-equip 畫成完整的部位條列(圖示/E 角標/套裝發光/
 * 鎖定/戒指等級需求/點列開物品視窗),只是 js/19 的嵌入式 12 格圖形視窗會整面蓋在上面。
 * 本外掛只做一件事:包 setEquipmentPanelEmbedded(切到裝備分頁的唯一入口,js/10 switchTab
 * 呼叫),一律以 orig(false) 讓圖形視窗不顯示(false 同時還原 host 占位 class 與高度),
 * 底下核心自己維護的條列就露出來。不自己刻列表 → 零渲染分歧、零維護負擔。
 * 關掉外掛開關 → 完全回原版圖形視窗。
 */
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('eqlist')) return;   // 🎚️ 外掛開關
    if (typeof window.setEquipmentPanelEmbedded !== 'function') {
        try { console.warn('[AFK-eqlist] 缺核心函式(setEquipmentPanelEmbedded),裝備條列式停用。'); } catch (e) {}
        return;
    }

    var _orig = window.setEquipmentPanelEmbedded;
    window.setEquipmentPanelEmbedded = function () { return _orig.call(this, false); };

    try { console.log('[AFK-eqlist] hooks OK — 裝備分頁條列式已啟用(外掛開關可關回圖形視窗)。'); } catch (e) {}
})();
