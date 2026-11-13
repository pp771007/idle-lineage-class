/* ============================================================================
 * smoke-hooks.mjs — 冒煙測試:用無頭瀏覽器載入 index.html,確認五支外掛都 hook 成功
 *
 * 用途:自動同步原作者 index.html 後,驗證原作者沒有改壞外掛掛點(改 id / DOM 結構)。
 *   - 全部 hooks OK → exit 0(workflow 才會 commit/push)
 *   - 任一外掛沒掛上 → exit 1(workflow 改為開 issue 通知,不自動推壞掉的版本)
 * ========================================================================== */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium, devices } from 'playwright';

const PORT = 8799;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = join(process.cwd(), normalize(p).replace(/^(\.\.[/\\])+/, ''));
    const buf = await readFile(file);
    // content-length 是為了讓「回應被截斷」變成看得見的錯誤:少了它 node 走 chunked,
    // 截斷會以 net::ERR_INCOMPLETE_CHUNKED_ENCODING 出現、而且訊息裡看不出少了多少;
    // 帶上長度後截斷會直接回報 net::ERR_CONTENT_LENGTH_MISMATCH，一眼認得出不是外掛的問題。
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'content-length': buf.length });
    res.end(buf);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const logs = [];
// 「檔案沒載完」與「外掛沒掛上」看起來一模一樣(都是那支外掛沒印 hooks OK),但要修的地方完全不同。
// 每頁都收 pageerror / requestfailed,失敗時先印這兩份 → 不必再靠重跑猜是不是假紅。
const pageErrs = [], netFails = [];
const watch = (pg) => {
  pg.on('console', (m) => logs.push(m.text()));
  pg.on('pageerror', (e) => pageErrs.push(String(e.message).split('\n')[0].slice(0, 140)));
  pg.on('requestfailed', (q) => netFails.push(q.url().split('/').pop().split('?')[0] + ' ← ' + ((q.failure() && q.failure().errorText) || '?')));
};

// 各外掛的開機 log:'[AFK] hooks OK' / '[AFK-mobile] hooks OK' / …(集中定義,goto 後輪詢等待 + 最後判定共用)
// afk-mobile 為「桌機零接觸」設計——只有偵測到手機尺寸/裝置才會 init 並印出 hooks OK(見 afk-mobile.js);
//   故它單獨在「手機模擬」那一輪驗,桌機那輪不列入(否則桌機永遠等不到它、smoke 假性失敗)。
// afk-battlehud 桌機也會 init(只是 CSS 讓它不顯示)→ 放 need 即可;它取代的是核心手機版 #mobile-vitals。
// afk-touchtip 只在觸控裝置 init(桌機有 hover,本來就不該掛)→ 桌機那輪永遠等不到,必須放手機輪。
const needMobileOnly = ['[AFK-touchtip]'];
const need = ['[AFK]', '[AFK-banner]', '[AFK-nobanner]','[AFK-lzcache]', '[AFK-synccompress]', '[AFK-clanroster]', '[AFK-allyslim]', '[AFK-dollcursor]', '[AFK-mobile]', '[AFK-backnav]', '[AFK-battlehud]', '[AFK-mapbar]', '[AFK-nozoom]', '[AFK-statusicon]', '[AFK-petui]', '[AFK-trackinfo]', '[AFK-trackmaps]', '[AFK-relicguard]', '[AFK-wpnfix]', '[AFK-relicvariant]', '[AFK-enhtarget]', '[AFK-retrial]', '[AFK-attrbatch]', '[AFK-cursebatch]', '[AFK-battlebuffs]', '[AFK-skillbar]', '[AFK-slotinfo]', '[AFK-dex]', '[AFK-wiki]', '[AFK-syncinfo]', '[AFK-statpts]', '[AFK-statlist]', '[AFK-pwa]', '[AFK-storage]', '[AFK-fullsave]', '[AFK-quotawarn]', '[AFK-notice]', '[AFK-history]', '[AFK-reissueid]', '[AFK-diag]', '[AFK-mobname]', '[AFK-npclabel]', '[AFK-training]', '[AFK-junkmgr]', '[AFK-bossavoid]', '[AFK-mercguard]', '[AFK-squadsync]', '[AFK-ancdrop]', '[AFK-relicaffix]', '[AFK-relicbatch]', '[AFK-bmprice]', '[AFK-itemsearch]', '[AFK-eqlist]', '[AFK-npclist]', '[AFK-whbatch]', '[AFK-anyclass]', '[AFK-locksafe]', '[AFK-buyercompat]', '[AFK-sellguard]', '[AFK-skin]'];
const seen = (list) => list.every((n) => logs.some((l) => l.includes(n) && l.includes('hooks OK')));

// ⚠ 不用 waitUntil:'networkidle':作者新版(.49 起)加了背景音樂 assets/bgm/*.mp3，<audio> 媒體串流會讓網路
//   「永遠不靜止」→ networkidle 等不到逾時、smoke 假性失敗、自動同步整個卡住(踩過 2026-06-30,掛點其實全正常)。
//   改成 domcontentloaded + 輪詢「外掛是否都印出 hooks OK」,既驗到掛點、又完全不受媒體/長連線影響。

// SMOKE_NO_SW=1:這一輪不讓 sw.js 接手。**預設不開**——正常狀態下 SW 那條路本來就該一起走。
//   只在「這台機器進入送出方向壞掉的狀態」時用它拿一次可信的判讀:那個狀態下傳出去的位元組會被
//   截斷/改壞(連 127.0.0.1 都會,判別法見全域 CLAUDE.md),而 SW 會把這一頁要傳的量從 ~9MB 拉到 ~84MB
//   (它把整站資產也抓去快取)→ 幾乎必然踩到 → 核心 js 少載 → 一堆外掛整支不執行 → 報成「外掛沒掛上」。
//   ⚠️ 用了它就是這一輪沒驗到 SW 那條路,判讀時要自己記得。真正的解是重開機。
const SMOKE_CTX = process.env.SMOKE_NO_SW === '1' ? { serviceWorkers: 'block' } : {};

// --- 第一輪:桌機視窗,驗桌機面向的 12 支外掛 + 地圖翻譯 ---
const page = await browser.newPage(SMOKE_CTX);
watch(page);
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
const _deadline = Date.now() + 20000;   // 最多等 20 秒讓全部外掛初始化(CI 較慢)
while (Date.now() < _deadline && !seen(need)) await page.waitForTimeout(200);
await page.waitForTimeout(300);   // 緩衝:讓 hooks 之後的索引(dex/wiki)與 AFK_EXTRA 建好,再做地圖翻譯檢查

// 🚫 只迴避指定頭目(afk-bossavoid):驗「沒挑到的王真的不會觸發瞬移逃離」。
//   為什麼非驗不可:這支的作法是在 autoActions 跑之前,把玩家沒挑到的 BOSS 實例暫時標上 noAutoTeleport,
//   借上游那行 `mobs.some(m => m && m.boss && !m.noAutoTeleport)` 自己少看到牠們。上游哪天改掉那行的
//   寫法(不看這個旗標、或改用別的判斷),wrapper 照掛、旗標照標,但條件根本不讀它 → 變回「全部都躲」,
//   零錯誤訊息、hooks OK 照印,玩家只會覺得「怎麼連我沒選的也躲」。
//   ⚠ smoke 停在主選單(沒載入角色),但 player 是物件、currentSlot=1、autoActions 可直接呼叫(實測);
//     把 useItem 換成計數器就能確定性地看出「有沒有觸發瞬移」,不必真的消耗卷軸。
const bossAvoidProblems = await page.evaluate(() => {
  const bad = [];
  const origUse = window.useItem;
  try {
    if (!window.AFK_BOSSAVOID) return ['AFK_BOSSAVOID 不存在(外掛沒載入或被關掉)'];
    const MAP = 'dragon_valley', PICK = 'blackelder', OTHER = 'wyvern';
    let calls = 0;
    window.useItem = function () { calls++; return true; };
    const tp = document.getElementById('set-teleport');
    if (!tp) return ['找不到上游的「迴避頭目」勾選框 #set-teleport(上游改了 id?)'];
    tp.checked = true;
    mapState.current = MAP;
    player.inv = player.inv || [];
    if (!player.inv.some((i) => i && i.id === 'scroll_teleport')) player.inv.push({ id: 'scroll_teleport', uid: 'smoke_tp', cnt: 9 });
    const put = (id) => {
      const d = DB.mobs[id];
      mapState.mobs = [{ ...d, curHp: d.hp, uid: 'smoke_' + id, _born: 1, _magCd: {}, st: (typeof newMobStatus === 'function' ? newMobStatus() : {}) }, null, null, null, null];
    };
    const run = (id) => { put(id); calls = 0; autoActions(); return calls; };

    AFK_BOSSAVOID.set(MAP, []);                       // 沒挑 = 上游今天的行為(全部躲)
    if (!run(OTHER)) bad.push(`對照組:沒挑任何頭目時 ${DB.mobs[OTHER].n} 也沒觸發瞬移(上游的迴避頭目分支變了?)`);

    AFK_BOSSAVOID.set(MAP, [PICK]);                   // 只挑了黑長者
    if (!run(PICK)) bad.push(`挑到的 ${DB.mobs[PICK].n} 沒有觸發瞬移(縮小範圍把該躲的也擋掉了)`);
    const n = run(OTHER);
    if (n) bad.push(`沒挑到的 ${DB.mobs[OTHER].n} 仍觸發了 ${n} 次瞬移(上游是不是改掉了 autoActions 裡看 noAutoTeleport 的那行?)`);

    const left = mapState.mobs.filter((m) => m && m.noAutoTeleport).length;
    if (left) bad.push(`autoActions 跑完還有 ${left} 隻怪殘留 noAutoTeleport(旗標沒還原,會被寫進存檔並影響離線收益估算)`);

    // 🔗 「自動找BOSS」開著時,挑到要躲的王仍要逃(afk-bossring 的 huntActive 會問 AFK_BOSSAVOID)。
    //   這條耦合在「找王沒開」的狀態下永遠測得過——而找王開著正是玩家回報「設了躲黑長者卻沒用」的情境:
    //   互斥條件看的是「這張圖找王功能有效」而非「正在召喚」,在有王池的圖上恆真 → 一旦耦合斷掉就是
    //   「迴避頭目整個失效」,而且無錯誤訊息、hooks OK 照印。
    const _ring = player.eq && player.eq.ring1;
    const _ringKey = 'afk_bossring_on_' + currentSlot;
    const _ringPrev = localStorage.getItem(_ringKey);
    try {
      player.eq = player.eq || {};
      player.eq.ring1 = { id: 'acc_116', uid: 'smoke_ring', cnt: 1 };   // 傳送控制戒指:找王的前提
      localStorage.setItem(_ringKey, '1');
      if (typeof hasTeleportRing === 'function' && hasTeleportRing() && window.AFK_BOSSRING) {
        if (!run(PICK)) bad.push(`「自動找BOSS」開著時,挑到要躲的 ${DB.mobs[PICK].n} 沒有逃離(找王與迴避頭目的互斥沒有拆到「隻」的層級 → 迴避頭目在有王池的圖上等於整個失效)`);
        if (run(OTHER)) bad.push(`「自動找BOSS」開著時,沒挑到的 ${DB.mobs[OTHER].n} 也被逃離了(找王會被自己的逃離瞬移走,卷軸燒光還打不到王)`);
      }
    } finally {
      if (_ring) player.eq.ring1 = _ring; else delete player.eq.ring1;
      if (_ringPrev === null) localStorage.removeItem(_ringKey); else localStorage.setItem(_ringKey, _ringPrev);
    }

    AFK_BOSSAVOID.set(MAP, []);
    tp.checked = false;
    mapState.mobs = [null, null, null, null, null];
  } catch (e) { bad.push('迴避頭目檢查本身出錯:' + e.message); }
  finally { window.useItem = origUse; }
  return bad;
});

// 💰 黑市收購價(afk-bmprice):驗「成交價區間還算得出來」。
//   為什麼非驗不可:這支不重刻公式,直接借核心的 pandoraBuyOrderAllowed / pandoraBuyOrderPriceProfile /
//   pandoraCardPriceRange 拿行情價區間。上游改名或改結構(minMult/maxMult 換欄位名)時,itemInfo 只會
//   安靜回 null → 收購欄那行與物品詳情那行整個不出現,零錯誤、hooks OK 照印,沒人會發現。
//   ⚠ 不可在這裡呼叫 pandoraBuyOrderPrice——它走 lootRng,會推進存檔內的 committed RNG 序號。
const bmProblems = await page.evaluate(() => {
  const bad = [];
  try {
    if (!window.AFK_BM || !AFK_BM.itemInfo) return ['AFK_BM 不存在(外掛沒載入或被關掉)'];
    if (!AFK_BM.rotateFromCore) bad.push('抓不到核心「每 N 分鐘輪換」那句(上游改了黑市標題寫法?)→「平均等多久」會用猜的 10 分鐘');
    // 一般裝備:區間＝售價×minMult ~ 售價×maxMult,上限至少要大於售價本身
    const eq = Object.keys(DB.items).find((id) => {
      const d = DB.items[id];
      return d && d.p > 0 && d.eff !== 'card' && typeof pandoraBuyOrderAllowed === 'function' && pandoraBuyOrderAllowed(id);
    });
    if (!eq) bad.push('全 DB 找不到任何「可指定收購且有售價」的物品(上游改了 pandoraBuyOrderAllowed 的條件?)');
    else {
      const info = AFK_BM.itemInfo(eq);
      if (!info || !(info.max > DB.items[eq].p) || !(info.min > 0) || !(info.min < info.max)) bad.push(`${DB.items[eq].n} 算不出成交價區間(itemInfo 回 ${JSON.stringify(info)})`);
    }
    // 怪物卡走另一條路徑(固定區間·與售價無關),要分開驗
    const card = Object.keys(DB.items).find((id) => DB.items[id] && DB.items[id].eff === 'card' && DB.items[id].cardTier >= 1);
    if (card) {
      const ci = AFK_BM.itemInfo(card);
      if (!ci || !(ci.max > 0)) bad.push(`${DB.items[card].n} 算不出成交價(pandoraCardPriceRange 改了?)`);
    }
    // 物品詳情那行真的有印出來(afk-dex 與小百科裝備頁共用同一支 itemDetailHTML)
    if (eq && window.AFK_DEX_API && AFK_DEX_API.itemDetailHTML) {
      if (!AFK_DEX_API.itemDetailHTML(eq).includes('黑市成交價')) bad.push('物品詳情裡沒有「黑市成交價」那一行(afk-dex 的插入點掉了?)');
    }
  } catch (e) { bad.push('黑市收購價檢查本身出錯:' + e.message); }
  return bad;
});

// --- 第二輪:手機模擬(iPhone 13),專驗 afk-mobile 的三欄掛點在作者最新 DOM 上仍成立 ---
//   afk-mobile 只在手機時 init,桌機那輪印不出 hooks OK;用真手機模擬(pointer:coarse/UA)讓它跑起來才驗得到。
const mctx = await browser.newContext({ ...devices['iPhone 13'], ...SMOKE_CTX });
const mpage = await mctx.newPage();
watch(mpage);
await mpage.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
const _mDeadline = Date.now() + 20000;
while (Date.now() < _mDeadline && !seen(needMobileOnly)) await mpage.waitForTimeout(200);

// --- 第三輪:手機 + 「手機版面」外掛關閉 ---
//   為什麼要驗這個:玩家可以逐支關外掛,但 afk-toggles 的逃生門按鈕與各外掛入口「不可以跟著消失」——
//   否則玩家關掉某支外掛後連把它開回來的入口都沒有,變成死結(2026-07-20 實際回報)。
//   歷史成因都是「基礎設施依賴了可被關掉的外掛」:逃生門的 top 讀 afk-mobile 設的 --orig-bar-h、
//   afk-skin 靠 afk-mobile 掛的 body.m-mobile 判斷手機。前兩輪都是「全開」狀態,永遠測不到。
const octx = await browser.newContext({ ...devices['iPhone 13'], ...SMOKE_CTX });
const opage = await octx.newPage();
watch(opage);
await opage.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
await opage.evaluate(() => localStorage.setItem('afk_toggle_mobile', '0'));
await opage.reload({ waitUntil: 'domcontentloaded' });
await opage.waitForTimeout(3000);
// 模擬線上的非官方橫幅(本機沒有;逃生門必須避開它)
await opage.evaluate(() => {
  if (document.getElementById('_orig_pbar')) return;
  const d = document.createElement('div');
  d.id = '_orig_pbar';
  d.style.cssText = 'position:fixed;left:0;right:0;top:0;height:92px;background:#123;z-index:2147483647;';   // z-index 要用線上實測值(遊戲橫幅是 int 上限);設低了會蓋不住按鈕、測不出遮蔽
  // ⚠ 文字不可省:外掛認橫幅是靠文字比對(/shines871|官方|非官方|轉載/,見 afk-mobile/afk-battlehud 的 findBanner)。
  //   沒文字的假橫幅在偵測邏輯眼中根本不存在 → 只測得到「z-index 硬蓋」,完全驗不到「量測→讓位」那條路徑。
  d.textContent = '這是非官方轉載版本，前往官方最新版：shines871.github.io/idle-lineage-class';
  document.body.appendChild(d);
});
await opage.waitForTimeout(1500);
const toggleOffProblems = await opage.evaluate(() => {
  const bad = [];
  // 橫幅讓位:必須由 afk-banner(不可停用)提供 → 關掉「手機版面」後依然要生效。
  //   歷史成因:讓位整組寫在 afk-mobile 裡,平板玩家為了換回三欄把它關掉 → 頂端(冒險地圖標題/黑市/瞬移/右欄分頁)
  //   全被橫幅蓋住(2026-07-23 回報)。
  const barH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--orig-bar-h')) || 0;
  const barBottom = document.getElementById('_orig_pbar').getBoundingClientRect().bottom;
  if (barH < barBottom) bad.push(`--orig-bar-h(${barH}px) 沒讓開橫幅(底端 ${barBottom}px)`);
  for (const id of ['app-stage', 'creation-screen']) {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top < barBottom) bad.push(`#${id} 頂端(${Math.round(el.getBoundingClientRect().top)}px)還在橫幅底下,會被蓋住`);
  }
  const btn = document.getElementById('afk-toggles-entry');
  if (!btn) bad.push('左上角「外掛開關」逃生門按鈕不存在');
  else {
    const r = btn.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!(r.width > 0 && r.height > 0)) bad.push('逃生門按鈕沒有尺寸');
    else if (!(top === btn || btn.contains(top))) bad.push(`逃生門按鈕被「${(top && (top.id || top.tagName)) || '未知元素'}」蓋住,點不到`);
  }
  // 入口(掉落查詢/小百科)在手機上必須直接可見,不可被收進桌機用的 Modal
  for (const [sel, nm] of [['.m-dex-entry-main', '掉落查詢入口'], ['.m-wiki-entry-main', '小百科入口']]) {
    const el = document.querySelector(sel);
    if (!el) { bad.push(nm + '不存在'); continue; }
    if (el.getBoundingClientRect().height <= 0) bad.push(nm + '高度為 0(被收進桌機 Modal?)');
  }
  return bad;
});

// --- 第四輪:平板幾何(觸控 + 寬 > 768),驗右欄分頁不會「內外兩層都不捲」---
//   afk-mobile 的 detectMobile() 只要 pointer:coarse 就算手機,範圍比上游 CSS 的手機斷點
//   (max-width:768px / max-height:520px and pointer:coarse)大 → 觸控平板在我方眼中是手機、在上游眼中是桌機。
//   我方「把分頁攤平、交給 #game-screen 單層捲」那組規則若沒包進上游同一條 media query,平板就會拿到
//   「分頁不捲(我方規則) + #game-screen 也不捲(上游桌機幾何)」→ 道具/防具/設定超出畫面的部分永遠
//   看不到也滑不到(2026-07-25 玩家回報)。前三輪都是手機或桌機尺寸,正好落在這道縫的兩側,測不到。
const tctx = await browser.newContext({
  ...SMOKE_CTX,
  viewport: { width: 820, height: 1180 }, hasTouch: true, deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const tpage = await tctx.newPage();
watch(tpage);
await tpage.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
await tpage.waitForTimeout(3000);
const tabletProblems = await tpage.evaluate(() => {
  const bad = [];
  const SCROLLABLE = ['auto', 'scroll'];
  const oy = (el) => getComputedStyle(el).overflowY;
  // 前置:只有「我方當手機、上游當桌機」這道縫才有混搭問題;兩邊同調時本檢查不適用。
  if (!document.body.classList.contains('m-mobile')) return bad;
  if (matchMedia('(max-width: 768px), (max-height: 520px) and (pointer: coarse)').matches) return bad;
  const gs = document.getElementById('game-screen');
  if (gs && SCROLLABLE.includes(oy(gs))) return bad;   // 外層自己就是捲動容器 → 分頁攤平是安全的
  const panel = document.getElementById('tab-content-panel');
  if (panel && oy(panel) === 'visible') bad.push('#tab-content-panel 被攤平(overflow-y:visible),但 #game-screen 不是捲動容器');
  for (const id of ['tab-items', 'tab-weapons', 'tab-armors', 'tab-automation']) {
    const el = document.getElementById(id);
    if (!el) { bad.push(`#${id} 不存在(上游改了分頁 id?)`); continue; }
    if (!SCROLLABLE.includes(oy(el))) bad.push(`#${id} 不是捲動容器(overflow-y:${oy(el)}),而 #game-screen 也不捲`);
  }
  return bad;
});

// 🩸 同一道縫的第二個症狀:手機殼在(單欄+底部導覽)但「我方戰鬥狀態列」用上游那條窄 media query 判手機
//   → 平板拿不到頂端血量列,而上游 #mobile-vitals 在它眼中是桌機也不顯示 → 兩條都沒有(2026-07-26 玩家回報)。
//   判準:凡「手機殼套用了就該有」的手機專屬元素,平板尺寸下必須有「一條生效路徑」。
//   ⚠ 不可用「放寬 @media」來補:那條 CSS 是上游手機單欄版面的一員,平板會變成桌機三欄裡的第四欄
//     把戰鬥區/喝水鈕擠掉(2026-07-26 踩過)。正解=外掛自己算出平板缺口、掛自己的 body class 走第二套版面。
//   ⚠ smoke 停在主選單(沒載入角色),戰鬥畫面沒開 → 不能驗「元素看不看得到」,改驗生效路徑:
//     ①某條 @media 條件成立(手機),或 ②有一條 `body.afk-*` 規則,而那個 class 現在真的掛在 body 上(平板)。
const tabletHudProblems = await tpage.evaluate(() => {
  const bad = [];
  if (!document.body.classList.contains('m-mobile')) return bad;   // 沒套手機殼就不適用
  const check = [['afk-battlehud-style', '手機戰鬥狀態列'], ['afk-battlebuffs-style', '手機戰鬥狀態欄']];
  for (const [styleId, label] of check) {
    const st = document.getElementById(styleId);
    if (!st) continue;   // 該外掛被關掉 → 不適用
    let hit = false, seen = [];
    try {
      for (const rule of st.sheet.cssRules) {
        if (rule.type === CSSRule.MEDIA_RULE) {
          seen.push('@media ' + rule.conditionText);
          if (matchMedia(rule.conditionText).matches) { hit = true; break; }
        } else if (rule.type === CSSRule.STYLE_RULE) {
          const m = /body\.(afk-[\w-]+)/.exec(rule.selectorText || '');
          if (!m) continue;
          seen.push('body.' + m[1]);
          if (document.body.classList.contains(m[1])) { hit = true; break; }
        }
      }
    } catch (e) { continue; }
    if (seen.length && !hit) bad.push(label + '在平板沒有任何生效路徑(試過 ' + seen.join(' / ') + ') → 手機殼套上了卻拿不到這個元素');
  }
  return bad;
});

// 🗺️ 地圖名翻譯覆蓋檢查:掉落查詢的「出沒地圖」來源＝DB.maps 的 key,經 AFK_EXTRA.mapName 解析。
//   mapName 查不到任一中文來源時會原樣回傳英文 id(name === id),這就是「漏翻」的精準訊號。
//   作者新增「不在 MAP_CATEGORIES/MAP_REGIONS/DB.towns…」的地圖結構時會被這裡擋下 → 提醒補進 mapName。
const untranslatedMaps = await page.evaluate(() => {
  const out = [];
  try {
    const mn = (window.AFK_EXTRA && AFK_EXTRA.mapName) ? AFK_EXTRA.mapName : null;
    if (mn && typeof DB !== 'undefined' && DB.maps) {
      for (const id of Object.keys(DB.maps)) {
        const nm = String(mn(id));
        if (nm === id || /[A-Za-z]/.test(nm)) out.push([id, nm]);   // 原樣回傳 id 或仍含英文字母 = 漏翻
      }
    }
  } catch (e) {}
  return out;
});

// 🌓 色彩配置宣告:index.html 必須讓 :root 的 color-scheme 是 dark。沒有的話 Android Chrome 的
//   「自動深色主題」會自己疊一層反轉,逐張圖判定 → 部分 NPC/怪物 sprite 變成白色人形(玩家回報過)。
//   症狀完全不像我們的 bug(重繪/重登/清快取都無效、重裝才好),沒有這道檢查掉了不會有人發現。
const colorScheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);

// 🔌 桌機外掛入口區塊(afk-skin 的 #afk-plugin-panel):整塊絕對定位在左欄「版本號正上方」。
//   座標是照上游 4:3 舞台的百分比放的 → 上游改首頁版面(標題變高、搬 #login-meta-layer、換舞台元素)時,
//   入口不會消失、只會疊到標題/版號上或被舞台的 overflow:hidden 切掉,肉眼不掃根本看不出來。
const pluginPanelProblems = await page.evaluate(() => {
  const bad = [];
  const rectOf = (s) => { const el = document.querySelector(s); return el && el.getBoundingClientRect(); };
  const panel = document.getElementById('afk-plugin-panel');
  if (!panel) { bad.push('#afk-plugin-panel 不存在(桌機入口沒被放到左欄)'); return bad; }
  const kids = [...panel.children].map((c) => c.getBoundingClientRect());
  if (!kids.length) { bad.push('#afk-plugin-panel 是空的(入口沒被搬進來)'); return bad; }
  const top = Math.min(...kids.map((r) => r.top)), bottom = Math.max(...kids.map((r) => r.bottom));
  const ver = rectOf('#login-version'), title = rectOf('#login-title-layer'), stage = rectOf('#login-art-stage');
  if (ver && bottom > ver.top) bad.push(`入口區塊底端(${Math.round(bottom)}px)壓到版本號(頂端 ${Math.round(ver.top)}px)`);
  if (title && top < title.bottom) bad.push(`入口區塊頂端(${Math.round(top)}px)壓到標題(底端 ${Math.round(title.bottom)}px)`);
  if (stage && (top < stage.top || bottom > stage.bottom)) bad.push('入口區塊超出 4:3 舞台,會被 overflow:hidden 切掉');
  for (const [sel, nm] of [['.m-dex-entry-main', '掉落查詢入口'], ['.m-wiki-entry-main', '小百科入口'], ['#afk-stg-gear', '⚙ 其他功能']]) {
    const r = rectOf(sel);
    if (!r) { bad.push(nm + '不存在'); continue; }
    if (!(r.width > 0 && r.height > 0)) { bad.push(nm + '沒有尺寸'); continue; }
    const el = document.querySelector(sel);
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!(hit === el || el.contains(hit))) bad.push(`${nm}被「${(hit && (hit.id || hit.tagName)) || '未知元素'}」蓋住,點不到`);
  }
  return bad;
});

// 🗡️ 裝備頁覆蓋檢查:三件事,都是「畫面正常、只是查不到」的靜默失效。
//   ① 無條件件數 == DB.items 的裝備數 → 沒有裝備在索引階段被漏掉。
//   ② 部位按鈕的件數加總 == 總件數 → 上游新增 slot 時,那個部位在篩選面板裡**沒有按鈕**(索引有、篩不到),
//      而清單只畫前 40 列,不捲到底根本看不到它 —— 加總對不上是唯一會早期爆出來的訊號。
//   ③ 部位按鈕的名稱不可含英文字母 → 沒補進 EQUIP_GROUPS 的 slot 會直接把原始 key 印在畫面上。
//   (歷史:魔法娃娃 50 件 + 地龍之魔眼 1 件曾因部位對不上分組桶而整組消失。)
const equipPageProblems = await page.evaluate(async () => {
  const bad = [];
  try {
    if (!window.AFK_WIKI_API || typeof DB === 'undefined' || !DB.items) return bad;
    AFK_WIKI_API.goto({ tab: 'equip' });
    await new Promise((r) => setTimeout(r, 800));
    const cntEl = document.getElementById('m-eq-cnt');
    if (!cntEl) { bad.push('裝備頁的控制列不見了(找不到 #m-eq-cnt)→ 篩選器沒渲染出來'); return bad; }
    const shown = parseInt(String(cntEl.textContent).replace(/[^0-9]/g, ''), 10);
    let total = 0;
    for (const id in DB.items) {
      const d = DB.items[id];
      if (d && d.n && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc')) total++;
    }
    if (shown !== total) bad.push(`裝備頁無條件時只列 ${shown} 件,DB.items 裡有 ${total} 件裝備 → 有裝備在索引階段被漏掉`);
    const btn = document.querySelector('[data-lfsheet]');
    if (!btn) { bad.push('裝備頁找不到「篩選」按鈕'); return bad; }
    btn.click();
    await new Promise((r) => setTimeout(r, 200));
    const chips = [...document.querySelectorAll('#m-eq-sheet [data-lfchip="slot"]')];
    if (!chips.length) { bad.push('篩選面板裡沒有任何「部位」按鈕'); return bad; }
    let sum = 0;
    for (const c of chips) {
      const i = c.querySelector('i');
      sum += i ? (parseInt(i.textContent.replace(/[^0-9]/g, ''), 10) || 0) : 0;
      const label = c.textContent.replace(/[0-9]/g, '');
      if (/[A-Za-z]/.test(label)) bad.push(`部位按鈕「${label.trim()}」露出英文/原始 key → 該 slot 沒補進 EQUIP_GROUPS`);
    }
    if (sum !== total) bad.push(`部位按鈕件數加總 ${sum} ≠ 總件數 ${total} → 有部位在篩選面板裡沒有按鈕(篩不到那批裝備)`);
    const body = document.getElementById('m-wiki-body');
    if (body && body.scrollWidth > body.clientWidth) bad.push(`裝備頁有橫向捲動(scrollWidth ${body.scrollWidth} > clientWidth ${body.clientWidth})`);
  } catch (e) { bad.push('裝備頁檢查本身出錯:' + e.message); }
  return bad;
});

await browser.close();
server.close();

// 每一種失敗都先報一次「這一輪的檔案有沒有載完」:載入被截斷時,任何一項檢查都可能長成
// 「某某東西不存在」,跟真的壞掉分不出來。判準:兩份都是 0 才是真的要修被測的東西。
function die() {
  if (netFails.length || pageErrs.length) {
    console.error(`  ⚠ 這一輪有 ${netFails.length} 個請求失敗、${pageErrs.length} 個頁面錯誤 —— 檔案沒載完也會長成這樣,先排除這個原因再修上面那條:`);
    for (const f of [...new Set(netFails)].slice(0, 5)) console.error('    ' + f);
    for (const e of [...new Set(pageErrs)].slice(0, 4)) console.error('    ' + e);
  }
  process.exit(1);
}

const okMap = {};
for (const n of [...need, ...needMobileOnly]) okMap[n] = logs.some((l) => l.includes(n) && l.includes('hooks OK'));
const allOK = Object.values(okMap).every(Boolean);

console.log('外掛掛點檢查:', JSON.stringify(okMap, null, 0));
if (!allOK) {
  console.error('冒煙測試失敗:有外掛沒有成功 hook。');
  // 先問「檔案有沒有載完」再怪外掛:載入期炸掉的外掛整支不執行,看起來就跟「掛點被改掉」一模一樣。
  if (netFails.length) {
    console.error(`  ⚠ 有 ${netFails.length} 個請求失敗 → 先修這個,不是外掛的問題:`);
    for (const f of [...new Set(netFails)].slice(0, 8)) console.error('    ' + f);
  }
  if (pageErrs.length) {
    console.error(`  ⚠ 頁面丟出 ${pageErrs.length} 個錯誤(前幾個):`);
    for (const e of [...new Set(pageErrs)].slice(0, 6)) console.error('    ' + e);
  }
  if (!netFails.length && !pageErrs.length) console.error('  (沒有網路失敗也沒有頁面錯誤 → 才是真的掛點被改掉,原作者可能改了 DOM / id)');
  else console.error('  ↑ 這台機器開機久了會進入「送出方向的傳輸壞掉」的狀態(連 127.0.0.1 都會),重開機即可;判別法見全域 CLAUDE.md。');
  die();
}

if (bossAvoidProblems.length) {
  console.error('冒煙測試失敗:「只迴避指定頭目」沒有正確縮小迴避範圍:');
  for (const p of bossAvoidProblems) console.error('  ' + p);
  console.error('  判準:afk-bossavoid 是在 autoActions 之前把「沒挑到的 BOSS」暫時標成 noAutoTeleport,');
  console.error('       借上游自己那行 some(m => m.boss && !m.noAutoTeleport) 少看到牠們;');
  console.error('       上游一旦改掉那行的判斷方式,這支就會安靜失效(hooks OK 照印、無錯誤訊息)。');
  die();
}

if (bmProblems.length) {
  console.error('冒煙測試失敗:黑市成交價算不出來(收購欄與物品詳情那兩行會安靜消失):');
  for (const p of bmProblems) console.error('  ' + p);
  console.error('  判準:afk-bmprice 不重刻公式,借核心 pandoraBuyOrderAllowed / pandoraBuyOrderPriceProfile /');
  console.error('       pandoraCardPriceRange 拿行情價區間。上游改名或改欄位就會回 null。');
  console.error('  ⚠ 修的時候絕不可改用 pandoraBuyOrderPrice——它走 lootRng,查個價就推進玩家存檔的亂數序號。');
  die();
}

if (toggleOffProblems.length) {
  console.error('冒煙測試失敗:關掉「手機版面」外掛後,手機上的逃生門/入口不見了(玩家會無法把外掛開回來):');
  for (const p of toggleOffProblems) console.error('  ' + p);
  console.error('  判準:不可停用的基礎設施不能依賴可被關掉的外掛提供的 CSS 變數 / body class。');
  die();
}

if (pluginPanelProblems.length) {
  console.error('冒煙測試失敗:桌機首頁左欄的外掛入口區塊位置不對(玩家會看到入口疊在標題/版號上或被切掉):');
  for (const p of pluginPanelProblems) console.error('  ' + p);
  console.error('  判準:#afk-plugin-panel 的座標(left/width/top/bottom)是照上游 4:3 舞台算的,');
  console.error('       上游搬動 #login-title-layer / #login-meta-layer 就要跟著調(見 afk-skin.js 的 CSS)。');
  die();
}

if (equipPageProblems.length) {
  console.error('冒煙測試失敗:小百科「裝備」分頁的覆蓋/版面有問題:');
  for (const p of equipPageProblems) console.error('  ' + p);
  console.error('  判準:部位對不上分組桶的裝備要落進「❓ 其他部位」,不可整組消失(見 afk-wiki.js 的 equipGroupKey / EQUIP_GROUPS)。');
  die();
}

if (tabletHudProblems.length) {
  console.error('冒煙測試失敗:平板(觸控·寬 820)拿不到手機專屬的戰鬥狀態列/狀態欄:');
  for (const p of tabletHudProblems) console.error('  ' + p);
  console.error('  判準:不要放寬上游那條 @media(會變成桌機三欄裡的第四欄,擠掉戰鬥區與喝水鈕),');
  console.error('       改由外掛自己判平板缺口、掛自己的 body class 走第二套版面(見 afk-battlehud.js 的 placeStrip)。');
  die();
}

if (tabletProblems.length) {
  console.error('冒煙測試失敗:平板(觸控·寬 820)上右欄分頁內外兩層都不捲,超出畫面的內容看不到也滑不到:');
  for (const p of tabletProblems) console.error('  ' + p);
  console.error('  判準:要覆寫上游「寫在 media query 裡」的樣式時,自己的規則必須包進同一條 media query');
  console.error('       (afk-mobile.js 的 MOBILE_GEOM_MQ);只寫 body.m-mobile 會讓觸控平板拿到混搭幾何。');
  die();
}

if (untranslatedMaps.length) {
  console.error('冒煙測試失敗:掉落查詢有地圖名未翻譯(會顯示英文 id),請補進 afk-extradata.js 的 AFK_EXTRA.mapName:');
  for (const [id, nm] of untranslatedMaps) console.error(`  ${id}  ->  ${nm}`);
  die();
}

if (!/dark/.test(colorScheme)) {
  console.error(`冒煙測試失敗::root 的 color-scheme 是「${colorScheme}」,不是 dark。`);
  console.error('  後果:Android Chrome 的自動深色主題會把部分 sprite 反成白色人形,而且重繪/重登/清快取都無效。');
  console.error('  修法:scripts/afk-plugin-block.html 裡那行 <style>:root{color-scheme:dark}</style> 要在,並同步進 index.html。');
  die();
}

console.log('冒煙測試通過:外掛 hooks OK,且掉落查詢地圖名全部已翻譯。');
