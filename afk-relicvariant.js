/* ============================================================================
 * afk-relicvariant.js — 「怪名的裝備名」那批遺物：物品說明的適用職業照實際規則顯示
 *
 * 上游 v3.9 用 RELIC_EQUIPMENT_VARIANTS 一次補了 100 件遺物變體(id relic_echo_*、欄位 relicBaseId)。
 *   能不能裝:js/08 checkCanEquip 會先換成原型、照原型的完整規則判(黑暗妖精／幻術士／龍騎士／戰士／王族
 *   各有自己的 xxxEquipOk 清單)。
 *   物品說明:js/10 buildItemDescHTML 畫「適用職業」logo 時,遺物仍一律只看 req 白名單——沒換成原型。
 *   兩邊不一致 → 64 處多列或少列職業(例:骷髏槍兵的矛 說明列 8 職業,實際只有騎士/妖精/法師/王族穿得上)。
 *
 * 作法:包 buildItemDescHTML,只對有 relicBaseId 的物品,把那排 class-eq-icon 換成照真實規則算的那排
 *   (順序、檔名、屬性照抄 js/10 的 _EQ_CLASSES 那段)。其他物品原樣放行。
 *   職業規則 canEquip 掛在 window.AFK_EQUIP_CLASS,掉落查詢詳情與小百科裝備篩選也讀它(唯一一份);
 *   它是純規則、不改遊戲行為,所以在開關閘門之前就掛上——關掉本開關只讓物品說明回到原版樣子,
 *   小百科的職業篩選照樣是對的。
 *
 * 掛接:index.html </body> 前(afk-plugin-block.html,排在 afk-wpnfix 之後)。
 * ========================================================================== */
(function () {
  'use strict';

  // 某職業能否裝備:照 js/08 checkCanEquip 的職業部分(不含精通／負重這類看角色當下狀態的放寬)。
  function canEquip(d, id, cls) {
    if (cls === 'all') return true;
    try {
      if (d.relicBaseId !== undefined && typeof d.relicBaseId === 'string' && DB.items[d.relicBaseId]) { id = d.relicBaseId; d = DB.items[id]; }
      if (typeof isRelic === 'function' && isRelic(d) && typeof reqAllowsClass === 'function') return reqAllowsClass(d, cls);
      if (cls === 'dark' && typeof darkEquipOk === 'function') return darkEquipOk(d, id);
      if (cls === 'illusion' && typeof illusionEquipOk === 'function') return illusionEquipOk(d, id);
      if (cls === 'dragon' && typeof dragonEquipOk === 'function') return dragonEquipOk(d, id);
      if (cls === 'warrior' && typeof warriorEquipOk === 'function') return warriorEquipOk(d, id);
      if (cls === 'royal' && typeof royalEquipOk === 'function') return royalEquipOk(d, id);
      if (typeof reqAllowsClass === 'function') return reqAllowsClass(d, cls);
    } catch (e) {}
    return true;
  }
  window.AFK_EQUIP_CLASS = { canEquip: canEquip };

  if (window.AFK_TOGGLES) AFK_TOGGLES.register({
    id: 'relicvariant', name: '修正遺物的適用職業', group: '系統與其他', def: true,
    desc: '「怪名的裝備名」那批遺物，物品說明上的適用職業改成實際穿得上的職業'
  });

  if (typeof buildItemDescHTML !== 'function' || typeof DB === 'undefined') {
    console.warn('[AFK-relicvariant] 找不到 buildItemDescHTML，停用（遊戲照常運作）。');
    return;
  }

  var CLASS_LOGOS = [['knight', '騎士'], ['elf', '妖精'], ['mage', '法師'], ['dark', '黑暗妖精'], ['illusion', '幻術士'], ['dragon', '龍騎士'], ['warrior', '戰士'], ['royal', '王族']];
  var LOGO_RE = /<img\b[^>]*\bclass="[^"]*class-eq-icon[^"]*"[^>]*>/g;
  function fixLogos(html, id) {
    var d = DB.items[id], first = true;
    var logos = CLASS_LOGOS.filter(function (c) { return canEquip(d, id, c[0]); }).map(function (c) {
      return '<img src="assets/logo/' + c[1] + 'icon.png" alt="' + c[1] + '" title="' + c[1] + '" class="class-eq-icon" onerror="this.style.display=\'none\';">';
    }).join('');
    return String(html).replace(LOGO_RE, function () { if (!first) return ''; first = false; return logos; });
  }

  var _orig = buildItemDescHTML;
  buildItemDescHTML = function (item) {
    var html = _orig.apply(this, arguments);
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('relicvariant')) return html;
    try {
      var d = item && DB.items[item.id];
      if (d && d.relicBaseId !== undefined && typeof html === 'string') return fixLogos(html, item.id);
    } catch (e) {}
    return html;
  };

  console.log('[AFK-relicvariant] hooks OK');
})();
