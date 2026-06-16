/* ============================================================================
 * afk-wiki.js — 小百科(玩家用)
 *
 * 首頁(#main-menu)加一顆「📚 小百科」按鈕,開一個分三頁的查詢面板:
 *   1) 職業專精 —— 四職業各 4 個精通,完整效果(讀 MASTERY_DATA,作者更新自動跟著變)。
 *   2) 武器特性 —— 連擊/切割/穿透/共鳴/魔擊… 用白話講清楚(本檔內維護的說明文字)。
 *   3) 職業魔法 —— 依職業 + 學習等級整理所有可學魔法(讀 DB.skills,依 skillReqLv 規則分級)。
 *
 * 設計:純讀取遊戲全域資料,不改原作;桌機/手機共用。文字一律寫成玩家看得懂的講法。
 * 掛接:在 index.html 的 </body> 前加一行 <script src="afk-wiki.js"></script>
 * ========================================================================== */
(function () {
  'use strict';

  var CLASSES = [
    { k: 'knight', n: '騎士' },
    { k: 'mage', n: '法師' },
    { k: 'elf', n: '妖精' },
    { k: 'dark', n: '黑暗妖精' }
  ];

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  ready(init);

  function init() {
    if (typeof DB === 'undefined' || !DB || !DB.skills || typeof MASTERY_DATA === 'undefined') {
      console.warn('[AFK-wiki] 缺少遊戲資料(DB.skills / MASTERY_DATA),小百科停用。');
      return;
    }
    var menu = document.getElementById('main-menu');
    if (!menu) { console.warn('[AFK-wiki] 找不到 #main-menu,小百科停用。'); return; }
    injectCSS();
    injectButton(menu);
    buildModal();
    console.log('[AFK-wiki] hooks OK — 小百科已啟用。');
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ===== 共用:時間 / 屬性 / 骰子 → 玩家講法 ==================================
  var ELE = { none: '無屬性', water: '💧 水', wind: '🌪 風', fire: '🔥 火', earth: '🪨 地' };
  var ELE_REQ = { fire: '火', water: '水', wind: '風', earth: '地' };
  function durTxt(s) {
    if (!s) return '';
    var t;
    if (s >= 3600) { var h = s / 3600; t = (Number.isInteger(h) ? h : h.toFixed(1)) + ' 小時'; }
    else if (s >= 120) { var m = s / 60; t = (Number.isInteger(m) ? m : m.toFixed(1)) + ' 分鐘'; }
    else t = s + ' 秒';
    return '，持續 ' + t;
  }
  function dice(d) { return d[0] + '~' + (d[0] * d[1]); }   // NdM → 最小~最大,用玩家看得懂的數字範圍取代骰子寫法
  function powerTxt(sk) {
    if (sk.multiDmg) return '（威力約 ' + sk.multiDmg.map(dice).join(' ＋ ') + '）';
    if (sk.dmgDice) return '（威力約 ' + dice(sk.dmgDice) + '）';
    return '';
  }
  function healTxt(sk) {
    if (!sk.healDice && !sk.healBase) return '回復 HP';
    var base = sk.healBase || 0;
    var lo = base + (sk.healDice ? sk.healDice[0] : 0);
    var hi = base + (sk.healDice ? sk.healDice[0] * sk.healDice[1] : 0);
    if (sk.hot) return '每 ' + sk.hot.interval + ' 秒回復 HP 約 ' + lo + '~' + hi + '、共 ' + sk.hot.ticks + ' 次';
    return '回復 HP 約 ' + lo + '~' + hi;
  }

  // ===== 魔法:把資料欄位翻成玩家看得懂的效果說明 ============================
  var STAT_LABEL = {
    ac: '防禦', mr: '魔防', dr: '傷害減免', er: '迴避', str: '力量', dex: '敏捷',
    con: '體質', int: '智力', wis: '精神', cha: '魅力', mhp: 'HP上限', mmp: 'MP上限',
    hpR: 'HP回復', mpR: 'MP回復', extraDmg: '額外傷害', extraHit: '額外命中',
    meleeDmg: '近距離傷害', meleeHit: '近距離命中', rangedDmg: '遠距離傷害', rangedHit: '遠距離命中',
    resFire: '火抗性', resWater: '水抗性', resWind: '風抗性', resEarth: '地抗性'
  };
  var STATUS_LABEL = {
    poison: '中毒', blind: '盲目', broken: '破壞(易碎)', slow: '緩速', stone: '石化',
    weaken: '弱化', disease: '疾病', sleep: '沉睡', stun: '暈眩', freeze: '凍結',
    vacuum: '封印', magicseal: '封印', mrhalf: '魔防減半', armorbreak: '盔甲破壞'
  };
  // 少數效果不在數值欄位裡(隱身、解除、傳送、暗系被動等),這裡用白話補上
  var EFFECT_OVERRIDE = {
    sk_sunlight: '打完一批怪後，下一批出現得更快（接戰等待從約 5 秒縮短為約 1 秒），加快打怪節奏',
    sk_reveal: '顯現平時隱形、打不到的怪物（如史巴托），讓你能攻擊牠', sk_helm_str2: '顯現平時隱形、打不到的怪物（如史巴托），讓你能攻擊牠',
    sk_magic_shield: '完全擋下接下來受到的一次攻擊（用掉後消失，3 秒內無法再施展）',
    sk_invisible: '隱身——滿血的一般怪物不會主動攻擊你',
    sk_resurrection: '死亡時有機會自動復活（被動）',
    sk_holy_barrier: '受到的傷害減少 30%',
    sk_soul_up: 'HP 與 MP 上限各提升 20%',
    sk_antidote: '解除中毒狀態',
    sk_holy_light: '驅散身上的詛咒',
    sk_cancel: '解除自己身上的魔法狀態',
    sk_teleport: '讓當前的怪物消失、重新出現一批（可用來換掉難纏的怪；帶傳送控制戒指則會引來強敵）',
    sk_energy_sense: '查看目標怪物的屬性弱點',
    sk_charm: '魅惑一隻非王級怪物，使牠為你作戰（成功率最高約 6 成；有召喚精通時，對比你低等的怪必定成功）',
    sk_mana_drain: '消耗自身 HP，對怪物施放命中後吸取牠的 MP',
    sk_load_up: '提高負重上限（效果結束後才能再次施放）',
    sk_reduction_armor: '提升受到傷害的減免（依等級）',
    sk_shock_stun: '對目標造成物理傷害，並有機率使其暈眩（需非弓武器）',
    sk_elf_worldtree: '讓妖精森林、眠龍洞穴一帶的區域額外掉落率由 20% 提升到 30%（被動）',
    sk_elf_singleres: '提升所選屬性的單一抗性',
    sk_elf_earthshield: '張開一道大地屏障',
    sk_elf_flamesoul: '近距離普攻傷害必定打出最高值（效果結束後才能再施放）',
    sk_elf_mind: '消耗少量 HP 轉換成 MP',
    sk_elf_soul: '消耗較多 HP 轉換成較多 MP',
    sk_elf_summon: '召喚一隻屬性精靈為你作戰（依你的屬性）',
    sk_elf_summon2: '召喚一隻上級屬性精靈為你作戰',
    sk_summon: '召喚一隻生物為你作戰（隨等級提升強度）',
    sk_dark_stealth: '暗影隱身：閃過接下來受到的一次攻擊（用掉後進入冷卻）',
    sk_dark_poison: '攻擊時 50% 機率使目標中毒（每秒造成該次傷害的 30%、持續 5 秒；有劇毒精通則必定中毒）',
    sk_dark_poisonres: '你自己受到的中毒傷害減半',
    sk_dark_burn: '攻擊時 10% 機率打出 1.5 倍傷害',
    sk_dark_walkhaste: '攻擊速度提升 15%（可與加速術疊加）',
    sk_dark_dodge: '有 50% 機率閃過原本「必中」的魔法攻擊（用掉後進入冷卻）',
    sk_dark_crit: '消耗一半當前 HP 與全部 MP，打出一記必中、必重擊的攻擊；剩下的 MP 越多傷害越高（滿 MP 約 10 倍，對血盟敵人再 ×2）',
    sk_dark_double: '使用雙刀或鋼爪時，有機率打出 2 倍傷害（45 級起 5%，每 5 級 +1%）',
    sk_dark_refine: '提高黑魔石（黑暗妖精素材）的取得：沉默洞穴一帶掉率提升，其他野外／地監也才會掉到（被動）'
  };
  function statDeltaTxt(d) {
    var out = [];
    for (var k in d) {
      var v = d[k]; var lbl = STAT_LABEL[k] || k;
      out.push(lbl + ' ' + (v >= 0 ? '+' : '') + v);
    }
    return out.join('、');
  }
  function skillEffect(id, sk) {
    if (EFFECT_OVERRIDE[id]) {
      var ov = EFFECT_OVERRIDE[id];
      if (sk.type === 'buff' && sk.dur) ov += durTxt(sk.dur);   // 持續型增益自動補上實際時間
      return ov;
    }
    if (sk.type === 'atk') {
      if (sk.instakill) {
        var who = sk.instakill.tag === 'undead' ? '不死類' : (sk.instakill.tag === 'element' ? '元素類' : '');
        return '對' + who + '目標有機率使其即死（最高約 6 成，對王級無效）';
      }
      var tgt = sk.target === 'all' ? '全體敵人' : '單體';
      var seg = '對' + tgt + '造成 ' + (ELE[sk.ele] || '') + '魔法傷害' + powerTxt(sk);
      if (sk.lifesteal) seg += '，並吸取部分傷害回復 HP';
      if (sk.status) seg += '，使其' + (STATUS_LABEL[sk.status.kind] || sk.status.kind) + durTxt(sk.status.dur);
      return seg;
    }
    if (sk.type === 'heal') return healTxt(sk);
    if (sk.type === 'convert') return '消耗 HP 轉換成 MP';
    if (sk.type === 'buff') {
      var parts = [];
      if (sk.d) parts.push(statDeltaTxt(sk.d));
      if (sk.haste) parts.push('提升攻擊速度');
      if (sk.summon) parts.push('召喚 ' + (sk.summon.n || '生物').replace(/^.*：/, '') + ' 協助戰鬥');
      var body = parts.join('、') || '提供增益效果';
      return body + durTxt(sk.dur);
    }
    return sk.msg || '特殊效果';
  }

  // 依職業算可學需求等級(複製原作 skillReqLv 規則,但不依賴 player)
  function reqLvFor(cls, id, sk) {
    if (cls === 'dark') {
      if (sk.reqD !== undefined) return sk.reqD;
      if (sk.reqM !== undefined && (sk.tier === 1 || sk.tier === 2)) return sk.tier === 1 ? 12 : 24;
      return undefined;
    }
    var lv = cls === 'mage' ? sk.reqM : (cls === 'knight' ? sk.reqK : sk.reqE);
    if (lv === undefined && cls === 'elf' && typeof MAGIC_MASTERY_SKILLS !== 'undefined' && MAGIC_MASTERY_SKILLS.indexOf(id) >= 0) return sk.reqM;
    return lv;
  }
  function magicListFor(cls) {
    var rows = [];
    for (var id in DB.skills) {
      var sk = DB.skills[id];
      if (!sk || !sk.n) continue;
      var lv = reqLvFor(cls, id, sk);
      if (lv === undefined) continue;
      var needMastery = (cls === 'elf' && cls !== 'mage' && (cls === 'knight' ? sk.reqK : sk.reqE) === undefined && typeof MAGIC_MASTERY_SKILLS !== 'undefined' && MAGIC_MASTERY_SKILLS.indexOf(id) >= 0);
      rows.push({ id: id, sk: sk, lv: lv, needMastery: needMastery });
    }
    rows.sort(function (a, b) { return (a.lv - b.lv) || ((a.sk.tier || 0) - (b.sk.tier || 0)) || a.sk.n.localeCompare(b.sk.n); });
    return rows;
  }

  // ===== 武器特性(玩家用白話;此處為本檔維護的說明) =========================
  var WEAPON_TRAITS = [
    { n: '連擊', d: '每次普通攻擊都會「再追加一次攻擊」（命中或揮空都會追加），追加那擊的傷害是該擊的一半。代表武器：鋼爪、雙刀。' },
    { n: '切割', d: '打出「重擊」時，自己的攻擊速度提升 20%、持續 2 秒。連續重擊就能一直保持加速。代表武器：雙手劍、屠龍劍、血色巨劍。' },
    { n: '穿透', d: '普攻命中後，有機率對「另一隻」敵人也造成同樣的一擊（機率依武器而定，貝卡合金是 100%）。適合清場。代表武器：貝卡合金、吉薩、戟。' },
    { n: '重擊 / 粉碎', d: '重擊率加倍——骰到 19、20 都算重擊（一般武器只有 20），而且能大幅削掉怪物的「硬皮」。代表武器：戰斧、戰錘、巨斧、狂戰士斧。' },
    { n: '月光爆裂', d: '攻擊時 8% 機率追加一發「風屬性」固定傷害，無視防禦直接打。傷害約 1~30，且強化值越高傷害越高（每 +1 再多加成）。代表武器：熾炎天使弓。' },
    { n: '共鳴（魔杖）', d: '裝特定魔杖時，普攻有「智力 ÷ 60」的機率免費射出一發光箭（魔法傷害），還會回一點 MP，邊打邊補魔力。代表武器：水晶魔杖、巴列斯魔杖、橡木魔杖等。' },
    { n: '魔擊（力量魔法杖）', d: '普攻有「力量 ÷ 60」的機率追加一次「必定命中且必定重擊」的物理攻擊。只有「力量魔法杖」有。' },
    { n: '命中恢復 MP', d: '普攻命中時回復 MP。強化值越高回越多：+6 以內每次回 1 點，+7 起每多強化一級就多回 1 點。法師持久作戰很好用。代表武器：瑪那魔杖、魔力短劍。' },
    { n: '即死（骰子匕首）', d: '普攻命中時有 1% 機率讓目標「直接死亡」，但對王級（BOSS）無效。代表武器：骰子匕首。' },
    { n: '龍的一擊（屠龍劍）', d: '攻擊時 12% 機率對「全場敵人」造成一記無視防禦的固定傷害。代表武器：屠龍劍。' },
    { n: '連射（弓）', d: '攻擊時有機率追加 1~3 支箭，每支各自結算命中（傷害為三成）。爆發很高。代表武器：尤米弓、十字弓、獵人之弓。' },
    { n: '武器附魔（傳說武器）', d: '普攻有機率不用學技能就免費施放武器內建的魔法，而且強化值越高越容易觸發（基礎 1%，每強化 +1%）。代表武器：死亡騎士的烈炎之劍、克特之劍、冰之女王魔杖、蕾雅魔杖。' },
    { n: '出血（匕首 / 矛）', d: '普攻命中有「力量 ÷ 60」的機率讓目標流血，之後每秒持續扣血、還能疊層。代表武器：各種匕首、矛。' },
    { n: '反擊（單手劍）', d: '被敵人打中時 50% 機率立刻反擊（若裝盾且這次擋下攻擊，則必定反擊）。代表武器：長劍、彎刀、克特之劍等單手劍。' },
    { n: '居合（武士刀）', d: '不拿盾、裝武士刀時，敵人的攻擊被你「閃過」或「揮空」時，30% 機率反手砍一刀。代表武器：武士刀、瑟魯基之劍。' },
    { n: '不死 / 狼人剋星（銀・精靈）', d: '攻擊「不死類」或「狼人」時額外多加 1~20 傷害。打這兩類怪特別有效。代表武器：銀斧、精靈短劍、銀長劍，以及銀箭、米索莉箭。' },
    { n: '鈍擊（單手鈍器）', d: '命中時讓目標的下一次攻擊延遲 1 秒，拖慢敵人出手。代表武器：流星錘、釘錘、木棒。' },
    { n: '魔爆（神官魔杖）', d: '施放傷害魔法時有機率引發爆炸，對全場敵人各追加「本次魔法傷害的三成」。代表武器：神官魔杖。' }
  ];
  var WEAPON_BASICS = [
    ['小型 / 大型傷害', '武器對「小型怪」與「大型怪」各自的傷害高低；重擊時一律打出最高值。'],
    ['命中', '加在命中判定上，越高越不會揮空（也越容易打到高等怪）。'],
    ['近 / 遠距離傷害', '每一擊額外加上的固定傷害（弓算遠距離、其餘算近距離），可能是負的。'],
    ['魔法傷害', '提升所有魔法、共鳴、武器附魔的威力（法師、魔杖很重要）。'],
    ['安定值', '強化的安全線：在安定值以內強化 100% 成功不爆裝；超過後才有失敗、爆裝的風險（武器多半是 6）。'],
    ['雙手武器', '佔用雙手，裝了就不能再拿盾牌。'],
    ['弓 / 遠距', '走遠距離的命中與傷害、可觸發連射，但需要箭矢。']
  ];

  // ===== 入口按鈕 =========================================================
  function injectButton(menu) {
    if (document.getElementById('m-wiki-open')) return;
    var b = document.createElement('button');
    b.id = 'm-wiki-open';
    b.type = 'button';
    b.className = 'btn text-xl w-72 py-4 bg-indigo-700 hover:bg-indigo-600 border-indigo-500';
    b.textContent = '📚 小百科';
    b.addEventListener('click', openModal);
    menu.appendChild(b);
  }

  // ===== 面板 =============================================================
  var TABS = [
    { k: 'mastery', n: '職業專精' },
    { k: 'weapon', n: '武器特性' },
    { k: 'magic', n: '職業魔法' }
  ];
  var state = { tab: 'mastery', cls: 'knight' };

  function buildModal() {
    if (document.getElementById('m-wiki-modal')) return;
    var m = document.createElement('div');
    m.id = 'm-wiki-modal';
    m.innerHTML =
      '<div id="m-wiki-wrap">' +
        '<div id="m-wiki-head">' +
          '<span id="m-wiki-title">📚 小百科</span>' +
          '<button id="m-wiki-close" type="button" title="關閉">✕</button>' +
        '</div>' +
        '<div id="m-wiki-tabs"></div>' +
        '<div id="m-wiki-cls"></div>' +
        '<div id="m-wiki-body"></div>' +
      '</div>';
    document.body.appendChild(m);
    var tabs = document.getElementById('m-wiki-tabs');
    TABS.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'm-wiki-tab'; b.setAttribute('data-tab', t.k); b.textContent = t.n;
      b.addEventListener('click', function () { state.tab = t.k; render(); });
      tabs.appendChild(b);
    });
    var clsRow = document.getElementById('m-wiki-cls');
    CLASSES.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'm-wiki-clsbtn'; b.setAttribute('data-cls', c.k); b.textContent = c.n;
      b.addEventListener('click', function () { state.cls = c.k; render(); });
      clsRow.appendChild(b);
    });
    document.getElementById('m-wiki-close').addEventListener('click', closeModal);
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(); });
  }
  function openModal() {
    var m = document.getElementById('m-wiki-modal');
    if (!m) return;
    if (typeof player !== 'undefined' && player && player.cls) state.cls = player.cls;   // 已進遊戲就預設自己的職業
    m.classList.add('open');
    render();
  }
  function closeModal() { var m = document.getElementById('m-wiki-modal'); if (m) m.classList.remove('open'); }

  function render() {
    var body = document.getElementById('m-wiki-body');
    if (!body) return;
    document.querySelectorAll('#m-wiki-tabs .m-wiki-tab').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === state.tab); });
    var clsRow = document.getElementById('m-wiki-cls');
    var showCls = (state.tab === 'mastery' || state.tab === 'magic');
    clsRow.style.display = showCls ? 'flex' : 'none';
    document.querySelectorAll('#m-wiki-cls .m-wiki-clsbtn').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-cls') === state.cls); });
    body.scrollTop = 0;
    if (state.tab === 'mastery') body.innerHTML = renderMastery(state.cls);
    else if (state.tab === 'weapon') body.innerHTML = renderWeapon();
    else body.innerHTML = renderMagic(state.cls);
  }

  function renderMastery(cls) {
    var md = MASTERY_DATA[cls];
    if (!md || !md.list) return '<div class="m-wiki-hint">查無此職業的專精資料。</div>';
    var intro = '<div class="m-wiki-note">到 50 等後，到威頓村找「漢」接精通任務，擊敗 <b>' + esc(md.boss) + '</b> 取回「精通之證」，即可從下面四選一（初次免費，之後更換要花費）。</div>';
    var cards = Object.keys(md.list).map(function (id) {
      var m = md.list[id];
      return '<div class="m-wiki-card">' +
        '<div class="m-wiki-name">' + esc(m.n) + '</div>' +
        '<div class="m-wiki-msg">' + esc(m.msg) + '</div>' +
        '<div class="m-wiki-desc">' + esc(m.d) + '</div>' +
      '</div>';
    }).join('');
    return intro + cards;
  }

  function renderWeapon() {
    var traits = WEAPON_TRAITS.map(function (t) {
      return '<div class="m-wiki-card"><div class="m-wiki-name">' + esc(t.n) + '</div><div class="m-wiki-desc">' + esc(t.d) + '</div></div>';
    }).join('');
    var basics = '<div class="m-wiki-sub">武器數值怎麼看</div>' +
      WEAPON_BASICS.map(function (b) { return '<div class="m-wiki-kv"><b>' + esc(b[0]) + '</b>' + esc(b[1]) + '</div>'; }).join('');
    return '<div class="m-wiki-note">武器上常看到的特殊效果，這裡用白話說明。</div>' + traits + basics;
  }

  function renderMagic(cls) {
    var rows = magicListFor(cls);
    if (!rows.length) return '<div class="m-wiki-hint">這個職業沒有可學的魔法。</div>';
    var clsName = (CLASSES.filter(function (c) { return c.k === cls; })[0] || {}).n || '';
    var html = '<div class="m-wiki-note">' + esc(clsName) + '可學的魔法，依「可學等級」由低到高排列。攻擊魔法的「威力」是基礎數字（用來互相比強弱），實際傷害還會再隨智力與魔法傷害提升。' +
      (cls === 'dark' ? '（黑暗妖精另可學一、二階基礎法師魔法，學習等級固定為 12 / 24）' : '') +
      (cls === 'elf' ? '（標示「需魔導精通」者，要先在 50 等專精選「魔導精通」才學得到）' : '') +
      '</div>';
    var curLv = null;
    rows.forEach(function (r) {
      if (r.lv !== curLv) { curLv = r.lv; html += '<div class="m-wiki-lv">Lv ' + r.lv + '</div>'; }
      var sk = r.sk;
      var tags = [];
      if (sk.type === 'atk' && sk.ele) tags.push(ELE[sk.ele] || sk.ele);
      if (sk.mp) tags.push('MP ' + sk.mp);
      if (sk.hpCost) tags.push('HP ' + sk.hpCost);
      var eleReq = sk.reqEle ? '　※需' + (ELE_REQ[sk.reqEle] || sk.reqEle) + '屬性' : (sk.reqEleAny ? '　※需先選定屬性' : '');
      var mastery = r.needMastery ? '　※需魔導精通' : '';
      html += '<div class="m-wiki-spell">' +
        '<div class="m-wiki-spell-top"><span class="m-wiki-spell-n">' + esc(sk.n) + '</span>' +
        (tags.length ? '<span class="m-wiki-spell-tags">' + esc(tags.join('・')) + '</span>' : '') + '</div>' +
        '<div class="m-wiki-spell-eff">' + esc(skillEffect(r.id, sk)) + esc(eleReq) + esc(mastery) + '</div>' +
      '</div>';
    });
    if (cls === 'knight') {
      html += '<div class="m-wiki-sub">魔法頭盔附帶魔法</div>' +
        '<div class="m-wiki-note">騎士裝備「治癒 / 敏捷 / 力量魔法頭盔」時，會額外獲得頭盔自帶的魔法（持有即可用，卸下就消失），不受等級限制。</div>';
    }
    return html;
  }

  // ===== CSS =============================================================
  function injectCSS() {
    if (document.getElementById('m-wiki-style')) return;
    var css = [
      '#m-wiki-modal{display:none;position:fixed;inset:0;z-index:1000;background:rgba(2,6,23,0.82);align-items:flex-start;justify-content:center;padding:20px 10px;}',
      '#m-wiki-modal.open{display:flex;}',
      '#m-wiki-wrap{width:min(680px,96vw);max-height:92vh;max-height:calc(100dvh - 40px);display:flex;flex-direction:column;background:#0f172a;border:1px solid #334155;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden;font-family:system-ui,"Segoe UI",sans-serif;}',
      '#m-wiki-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #1e293b;flex:0 0 auto;}',
      '#m-wiki-title{flex:1 1 auto;font-size:17px;font-weight:bold;color:#fff;}',
      '#m-wiki-close{flex:0 0 auto;width:42px;height:38px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;border-radius:8px;font-size:16px;cursor:pointer;font-family:inherit;}',
      '#m-wiki-close:active{background:#334155;}',
      '#m-wiki-tabs{display:flex;gap:6px;padding:10px 12px 0;flex:0 0 auto;}',
      '.m-wiki-tab{flex:1;padding:9px 4px;border:1px solid #334155;background:#1e293b;color:#cbd5e1;border-radius:8px 8px 0 0;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;}',
      '.m-wiki-tab.on{background:#4338ca;border-color:#6366f1;color:#fff;}',
      '#m-wiki-cls{display:flex;gap:6px;padding:8px 12px;flex:0 0 auto;border-bottom:1px solid #1e293b;flex-wrap:wrap;}',
      '.m-wiki-clsbtn{flex:1 1 auto;padding:7px 4px;border:1px solid #334155;background:#111c30;color:#cbd5e1;border-radius:7px;font-size:13px;font-weight:bold;cursor:pointer;font-family:inherit;}',
      '.m-wiki-clsbtn.on{background:#0e7490;border-color:#22d3ee;color:#fff;}',
      '#m-wiki-body{flex:1 1 auto;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:9px;}',
      '.m-wiki-hint{color:#94a3b8;text-align:center;padding:22px 8px;font-size:14px;}',
      '.m-wiki-note{color:#94a3b8;font-size:12.5px;line-height:1.6;background:#111c30;border:1px solid #1e293b;border-radius:8px;padding:9px 11px;}',
      '.m-wiki-note b{color:#fcd34d;}',
      '.m-wiki-card{background:#111c30;border:1px solid #334155;border-radius:10px;padding:11px 12px;}',
      '.m-wiki-name{font-size:15px;font-weight:bold;color:#fcd34d;margin-bottom:3px;}',
      '.m-wiki-msg{font-size:12.5px;color:#7dd3fc;margin-bottom:5px;}',
      '.m-wiki-desc{font-size:13.5px;color:#e2e8f0;line-height:1.65;}',
      '.m-wiki-sub{font-size:13px;color:#fcd34d;font-weight:bold;margin:10px 2px 2px;border-top:1px solid #1e293b;padding-top:10px;}',
      '.m-wiki-kv{font-size:13px;color:#cbd5e1;line-height:1.6;padding:5px 0;border-bottom:1px solid #16233a;}',
      '.m-wiki-kv b{color:#e2e8f0;margin-right:8px;}',
      '.m-wiki-lv{font-size:13px;font-weight:bold;color:#a5b4fc;background:#1e293b;border-radius:6px;padding:4px 10px;margin-top:4px;}',
      '.m-wiki-spell{background:#111c30;border:1px solid #243049;border-radius:8px;padding:8px 11px;}',
      '.m-wiki-spell-top{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}',
      '.m-wiki-spell-n{font-size:14px;font-weight:bold;color:#fff;}',
      '.m-wiki-spell-tags{font-size:11.5px;color:#94a3b8;}',
      '.m-wiki-spell-eff{font-size:13px;color:#cbd5e1;line-height:1.55;margin-top:3px;}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = 'm-wiki-style';
    s.textContent = css;
    document.head.appendChild(s);
  }
})();
