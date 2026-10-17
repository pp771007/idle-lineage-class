/* ============================================================================
 * afk-trackinfo.js — 狀態欄補充（魔物追蹤時間／龍裔／血盟 Buff／生效中套裝／找王／迴避王）
 *
 * 一支外掛、一個開關，補的都是同一件事：**明明生效中、玩家卻在畫面上看不到的東西**，
 * 全部接在能力面板底部那行「狀態:」後面（手機由 afk-battlebuffs 鏡射到戰鬥框下方）。
 *
 *   狀態: 加速 / 保護罩 … / 龍裔 / 血盟Buff / 寒冰套裝 / 🔍 追蹤:黑豹 3時12分
 *
 * 各格的來歷：
 *   ・🔍 魔物追蹤——城堡的追蹤 NPC（奧貝勒／赫特／帝倫）花金幣追蹤指定地圖的指定怪，效期 8 小時，
 *     期間該圖出怪有 50%（戴小獵犬的追蹤鼻 70%）固定變成那隻。上游只有「回去問 NPC」才看得到還剩多久。
 *     人在被追蹤的那張圖 → 青色（正在生效）；在別張圖 → 灰色，滑鼠移上去（或長按）說要去哪張圖。
 *     時間用牆鐘算（追蹤是關遊戲也會流逝的真實時間）。
 *   ・龍裔——龍血套裝 3 件的 10 秒減傷。它不是技能（`DB.skills` 查不到）→ 上游狀態欄的技能迴圈跳過它，
 *     右上角圖示列也沒有對應的圖檔可用（assets/ 是上游鏡像，不能自己塞）→ 只能走文字。
 *   ・血盟 Buff——開著就一直在加數值，但只有血盟分頁看得到。
 *   ・一般裝備套裝（寒冰／真．冥皇／司祭苦行…）——裝備分頁的欄位會亮琥珀金框，但戰鬥中看不到。
 *     （席琳套裝的「組名 n/5」上游本來就有，不重複顯示。）
 *
 * 作法：包核心 renderStatusEffects()（每 tick 會重寫 #dt-buffs 的內容），在原函式跑完後把這幾格補上去
 *   ——不改核心、上游怎麼改那行的內容都不衝突。
 *   ・沒東西可補 → 立刻早退，零 DOM 動作（這是每 tick 都會經過的路徑）。
 *   ・state.ff（離線補跑）期間直接不做事：原函式此時也是 return，畫面本來就不刷新。
 *   ・原函式在「沒有任何增益」時輸出「狀態: 正常」→ 這時把「正常」換掉而不是接在它後面
 *     （顯示「狀態: 正常 / 🔍 追蹤…」很怪）。比對不到「正常」也只是退化成接在後面，不會壞。
 *
 * 兩個「不自己抄一份」的地方（抄了就會跟上游走鐘，而且是安靜的）：
 *   ・套裝門檻直接從核心 recomputeStats 的原始碼撈 setCheck['xxx'] >= N ——
 *     ⚠️ 認的是 js/02（數值真正生效的地方），不是 js/10 那份欄位底色判定：兩邊對抗魔套裝就不一致
 *     （js/02 要 3 件才 MR+5、js/10 亮 2 件）。撈不到任何一組就不顯示套裝那段（安靜降級）。
 *   ・血盟 Buff 不自己查：getClanBuffStats() 內部會讀 localStorage ＋ 解壓 ＋ JSON.parse，
 *     每 tick 呼叫等於每秒做十次。改成「包住它、記下核心自己算出來的結果」——零額外成本，
 *     而且開關／貢獻不足自動關閉都會走 calcStats → 一定會被記到。
 *
 * 掛接：在 index.html 的 </body> 前 <script src="afk-trackinfo.js">；
 *   載入順序要排在 afk-battlebuffs 之前（手機戰鬥框下方的鏡射才含這幾格）。
 * ========================================================================== */
(function () {
  'use strict';

  function on() { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('trackinfo'); }

  // ⚠ player/state/mapState/DB/BUFF_NAMES 在核心是 let/const/function 宣告＝不掛在 window 上
  //   （window.player 永遠 undefined，寫成 window.player && … 會整支安靜失效）。
  //   外掛是普通 <script>，直接用識別字就讀得到同一個全域繫結。

  // ── 🔍 魔物追蹤（回傳 null＝沒有追蹤／資料不全，呼叫端直接不顯示）───────
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
    span.className = 'afk-statusadd afk-trackinfo font-bold ' + (here ? 'text-cyan-300' : 'text-slate-500');
    span.title = here ? '追蹤中：這張圖該怪的出現率提高' : '追蹤的地圖不是這裡（要到「' + mapName + '」才生效）';
    span.textContent = '🔍 追蹤:' + mobName + ' ' + (h > 0 ? h + '時' : '') + m + '分';
    return span;
  }

  // ── 血盟 Buff：包住核心的查詢函式，只記結果 ──────────────────────────
  var _clanOn = null;   // null＝還沒觀察到（第一次顯示時補問一次）
  function hookClanBuff() {
    if (typeof getClanBuffStats !== 'function') return;
    var orig = getClanBuffStats;
    window.getClanBuffStats = function (p) {
      var r = orig.apply(this, arguments);
      // 傭兵重算也會呼叫（p＝該傭兵）→ 只認玩家自己那次
      if (p == null || (typeof player !== 'undefined' && p === player)) _clanOn = !!r;
      return r;
    };
  }
  function clanActive() {
    if (_clanOn === null) { try { _clanOn = !!getClanBuffStats(); } catch (e) { _clanOn = false; } }
    return _clanOn;
  }

  // ── 套裝：門檻取自核心原始碼，名稱取自 DB.sets ──────────────────────
  var _thr = null;
  function thresholds() {
    if (_thr) return _thr;
    _thr = {};
    try { for (var code in DB.sets) _thr[code] = (typeof setNeed === 'function') ? setNeed(code) : (DB.sets[code].need || DB.sets[code].items.length); } catch (e) {}   // 門檻讀 DB.sets.need（套裝表是單一真相）
    if (!Object.keys(_thr).length) console.warn('[AFK-trackinfo] 讀不到核心的套裝件數門檻（上游可能改了 recomputeStats 的寫法），狀態欄不顯示套裝。');
    return _thr;
  }
  // 套裝代碼 → 中文名：DB.sets 反查（舊 14 組），名字只掛在各件裝備 set 欄位上的較新幾組補在這裡
  //   （同 afk-wiki 的 EQ_SET_CN_EXTRA；上游再新增而這裡沒補時退回第一件裝備的名字，不會露英文代碼）
  var SET_CN_EXTRA = {
    orin: '歐林西瑪套裝', icequeen_charm: '冰之女王魅力套裝', frost: '寒冰套裝',
    bluepirate: '藍海賊套裝', emperor: '真．冥皇套裝', priest: '司祭苦行套裝'
  };
  var _cn = null;
  function setName(code) {
    if (!_cn) {
      _cn = {};
      try {
        for (var k in DB.sets) { if (DB.sets[k] && DB.sets[k].n) _cn[k] = DB.sets[k].n; }   // DB.sets 的鍵＝套裝代碼
      } catch (e) {}
      for (var e2 in SET_CN_EXTRA) if (!_cn[e2]) _cn[e2] = SET_CN_EXTRA[e2];
    }
    if (_cn[code]) return _cn[code];
    try { for (var id in DB.items) if (DB.items[id].set === code) return '套裝：' + DB.items[id].n; } catch (e3) {}
    return code;
  }
  // 換裝才會變 → 每秒重算一次就夠（狀態欄每 0.1 秒重畫一次，不必跟著掃裝備欄）
  var _sets = [], _setsAt = 0;
  function activeSets() {
    var now = Date.now();
    if (now - _setsAt < 1000) return _sets;
    _setsAt = now;
    _sets = [];
    var thr = thresholds(); if (!Object.keys(thr).length) return _sets;
    var cnt = {}, seen = {};
    for (var k in player.eq) {
      var e = player.eq[k]; if (!e || seen[e.id]) continue;
      var d = DB.items[e.id]; if (!d || !d.set) continue;
      seen[e.id] = 1;                                        // 同款物品只算一件（同核心計件）
      cnt[d.set] = (cnt[d.set] || 0) + 1;
    }
    for (var s in cnt) if (thr[s] && cnt[s] >= thr[s]) _sets.push(setName(s));
    return _sets;
  }

  // ── 龍裔／血盟／套裝這三格（追蹤那格自己是 DOM，另外接在最後）──────────
  function buffRows() {
    var out = [];
    if (typeof player === 'undefined' || !player || !player.cls) return out;
    if (player.buffs && (player.buffs.sk_set_dragonscion || 0) > 0) {
      out.push({ t: (typeof BUFF_NAMES !== 'undefined' && BUFF_NAMES.sk_set_dragonscion) || '龍裔', c: 'text-orange-300' });
    }
    if (clanActive()) out.push({ t: '血盟Buff', c: 'text-emerald-300' });
    var s = activeSets();
    for (var i = 0; i < s.length; i++) out.push({ t: s[i], c: 'text-amber-400' });   // 琥珀金＝裝備分頁套裝欄位的框光同色

    // ── 找王／迴避王 ────────────────────────────────────────────
    // 這兩個都設定在別的面板裡，戰鬥中完全看不出「現在到底有沒有在作用」；更麻煩的是它們會互相影響：
    // 沒指定要躲哪幾隻時，找王開著會把迴避整個壓住。玩家回報過「設了躲黑長者、勾與不勾一樣會遇到」
    // 就是這個狀況，而畫面上一點線索都沒有 → 這兩格要能看出「壓住了」。
    // ⚠️ 兩支來源外掛都可以被玩家關掉：關掉找王＝那格不顯示；關掉迴避外掛＝退回上游的「全部都躲」，
    //   而核心那顆勾選框仍在 → 照樣顯示「迴避王:全部」，都是正確的。
    var br = window.AFK_BOSSRING, ba = window.AFK_BOSSAVOID;
    var hunting = false;
    try { hunting = !!(br && typeof br.huntEnabled === 'function' && br.huntEnabled()); } catch (e) {}
    if (hunting) out.push({ t: '找王', c: 'text-sky-300', ti: '傳送控制戒指自動找 BOSS：場上沒王就用瞬移卷軸召一隻來' });
    var tchk = document.getElementById('set-teleport');
    if (tchk && tchk.checked) {
      var ids = null;
      try { ids = (ba && typeof ba.picked === 'function') ? ba.picked(mapState.current) : null; } catch (e2) {}
      var who = (!ids || !ids.length) ? '全部'
        : (ids.length === 1 && DB.mobs[ids[0]] ? DB.mobs[ids[0]].n : ids.length + ' 隻');
      var muted = hunting && (!ids || !ids.length);   // 沒指定＝全部都躲 → 這時才會被找王壓住
      out.push({
        t: '迴避王:' + who,
        c: muted ? 'text-slate-500' : 'text-rose-300',
        strike: muted,   // 灰色還是會被當成「只是比較不重要」，劃掉才一眼看得出「這條現在沒作用」
        ti: muted ? '自動找 BOSS 進行中，這張圖暫時不迴避。到「迴避對象」指定要躲哪幾隻，那幾隻就會照樣躲。'
          : '這張圖遇到這些頭目會用瞬移卷軸離開'
      });
    }
    return out;
  }

  function append() {
    var el = document.getElementById('dt-buffs');
    if (!el || el.querySelector('.afk-statusadd')) return;   // 沒有面板／本輪已補過就不做

    var spans = buffRows().map(function (r) {
      var sp = document.createElement('span');
      sp.className = 'afk-statusadd font-bold ' + r.c;
      sp.textContent = r.t;
      if (r.ti) sp.title = r.ti;
      // ⚠️ 用 inline style 不用 Tailwind 的 line-through:那份 css 是預先建置過的,
      //   grep 過 css/tailwind-built.css **沒有**這條 → 寫了會安靜不生效。
      if (r.strike) sp.style.textDecoration = 'line-through';
      return sp;
    });
    var track = buildSpan(); if (track) spans.push(track);   // 🔍 追蹤固定排最後（時間類，不是身上的增益）
    if (!spans.length) return;

    // 「狀態: 正常」＝沒有任何增益 → 把「正常」讓給我們這幾格；否則以 " / " 接在既有增益後面
    var first = el.firstChild, sep = ' / ';
    if (first && first.nodeType === 3 && /正常\s*$/.test(first.nodeValue)) {
      first.nodeValue = first.nodeValue.replace(/正常\s*$/, '');
      sep = '';
    }
    var abnormal = el.querySelector('div');   // 下方的「異常:」區塊（可能不存在）→ 要插在它前面
    for (var i = 0; i < spans.length; i++) {
      if (sep) el.insertBefore(document.createTextNode(sep), abnormal || null);
      sep = ' / ';
      el.insertBefore(spans[i], abnormal || null);
    }
  }

  function init() {
    if (typeof window.renderStatusEffects !== 'function') {
      console.warn('[AFK-trackinfo] 找不到 renderStatusEffects（上游可能改名），狀態欄補充停用。');
      return;
    }
    hookClanBuff();
    var orig = window.renderStatusEffects;
    window.renderStatusEffects = function () {
      var r = orig.apply(this, arguments);
      if (typeof state !== 'undefined' && state.ff) return r;   // 離線補跑期間不動畫面（原函式同樣早退）
      if (on()) { try { append(); } catch (e) {} }
      return r;
    };
    console.log('[AFK-trackinfo] hooks OK — 狀態欄補上魔物追蹤時間／龍裔／血盟 Buff／生效中套裝／找王／迴避王。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
