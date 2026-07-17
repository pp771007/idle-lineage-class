/* ==========================================================================
 * afk-diag.js — 快取/儲存診斷(首頁「⚙ 設定」選單)
 *
 * 用途:玩家回報「圖一直重載 / 只剩無痕能開」這類問題時,拿得到現場數字,不必再靠猜。
 *
 * 🔒 全程唯讀:只 read localStorage / caches / navigator.storage,
 *    絕不 put/delete/清任何東西(見 CLAUDE.md「外掛絕不可盲呼叫會寫入存檔的函式」)。
 *
 * 快照可「📋 複製」成純文字回報。手機沒有 console,這是唯一拿得到這些數字的管道。
 * ========================================================================== */
(function () {
  'use strict';

  // 這支自己的版本:從自己的 <script src="afk-diag.js?v=…"> 取。
  //   為什麼要:玩家回傳截圖時,得認得出「這是哪一版診斷產生的」——否則修好了也分不出他手上是新是舊
  //   (踩過:改完推上去,玩家看到一樣的錯,雙方都無從判斷是沒生效還是沒重載)。
  //   放標題是刻意的:內容整個失敗時,只有標題還會留在畫面上。
  var DIAG_VER = (function () {
    try {
      var s = document.querySelector('script[src*="afk-diag.js"]');
      var m = s && s.getAttribute('src').match(/[?&]v=([^&]+)/);
      return m ? m[1] : '?';
    } catch (e) { return '?'; }
  })();

  var IMG_CACHE = 'img-v3';           // ← 與 sw.js 同名(那邊是固定桶名,不隨版本換)
  var CODE_CACHE = 'code-v1';
  var ANIM_HASH_KEY = '/__afk-anim-hashes__';   // sw.js 存「一怪一雜湊」對帳記錄的合成 entry
  var IMG_HASH_KEY = '/__afk-img-hashes__';

  // 最近的 JS 錯誤:手機沒有 console,玩家回報「怪怪的」時這是唯一拿得到錯誤的管道。
  //   本檔在 </body> 前才載入,更早的錯誤抓不到;被 try/catch 吞掉的也抓不到(如離線結算迴圈內)——
  //   有東西就是線索,空的不代表沒問題。
  var ERRS = [];
  function pushErr(kind, msg, src) {
    if (ERRS.length >= 12) ERRS.shift();
    ERRS.push({ t: new Date().toLocaleTimeString('zh-TW'), kind: kind, msg: String(msg || '').slice(0, 200), src: String(src || '').split('/').pop().slice(0, 40) });
  }
  window.addEventListener('error', function (e) {
    // 資源(img/script/link/audio…)載入失敗時,錯誤物件「沒有 message」——只印 e.message 會得到一行空白的
    //   「錯誤:」,等於白抓(玩家實機回傳的就是這樣,看得到有事、卻不知道是誰)。這種要改抓元素與網址。
    var el = e.target;
    if (el && el !== window && el.tagName) {
      var url = el.src || el.href || '';
      var kind = el.tagName === 'IMG' ? '圖載入失敗' : el.tagName.toLowerCase() + ' 載入失敗';
      return pushErr(kind, url || '(沒有網址)', '');
    }
    pushErr('錯誤', e.message || '(沒有訊息)', e.filename);
  }, true);

  // 逐怪對帳的實際結果:SW 做完會回報。⚠️ 這也是唯一能認出「修正版 SW 有沒有在跑」的方法——
  //   CODE_VERSION 的雜湊不含 sw.js 自己,所以改了 sw.js 版本號不會變,「版本」那行看不出來。
  //   只有修正版會回報 skipped 欄位,舊版沒有。
  var ANIM_RECON = null;
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', function (e) {
      var d = e.data || {};
      if (d.type === 'reconcile-anim-done') ANIM_RECON = d;
    });
  }
  window.addEventListener('unhandledrejection', function (e) { pushErr('未處理的拒絕', e.reason && (e.reason.message || e.reason), ''); });

  function mb(n) { return (n / 1048576).toFixed(1) + ' MB'; }
  function kb(n) { return n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : mb(n); }   // 存檔多在幾百 KB~數 MB,用 MB 顯示會變 0.0

  // 逐桶統計:總筆數、怪物動畫幀數、圖片數。
  //   ⚠️ cache.keys() 在「筆數過多」的桶上會直接拋 Operation too large(玩家實機遇到,圖桶塞太多幀)。
  //      這正是我們最想知道的狀態,所以不能讓它把整份診斷帶走——單桶失敗就記下失敗,其餘照常。
  function bucketStats() {
    if (!window.caches) return Promise.resolve(null);
    return caches.keys().then(function (names) {
      return Promise.all(names.map(function (n) {
        return caches.open(n).then(function (c) { return c.keys(); }).then(function (ks) {
          var anim = 0, img = 0;
          ks.forEach(function (k) {
            if (/\/assets\/(anim|classanim)\//.test(k.url)) anim++;
            else if (/\/assets\/.*\.(png|jpg|jpeg|webp|gif)$/i.test(k.url)) img++;
          });
          return { name: n, total: ks.length, anim: anim, img: img };
        }).catch(function (e) { return { name: n, err: String(e.message || e) }; });
      }));
    }).catch(function (e) { return [{ name: '(列舉快取桶失敗)', err: String(e.message || e) }]; });
  }

  // 對帳記錄:記了幾筆。0 筆 = SW 下次載入會把「所有怪」判定成沒對過而整包清掉重抓
  function hashRecords() {
    if (!window.caches) return Promise.resolve({});
    return caches.open(IMG_CACHE).then(function (c) {
      return Promise.all([c.match(ANIM_HASH_KEY), c.match(IMG_HASH_KEY)]);
    }).then(function (rs) {
      return Promise.all(rs.map(function (r) { return r ? r.json().catch(function () { return null; }) : null; }));
    }).then(function (js) {
      return {
        anim: js[0] ? Object.keys(js[0]).length : null,
        img: js[1] ? Object.keys(js[1]).length : null
      };
    }).catch(function () { return { anim: null, img: null }; });
  }

  // localStorage 有 ~5MB 的硬上限(與 Cache 配額是兩回事)。逼近上限時 saveGame 會寫不進去,
  //   所以這裡要看得到「用了幾 %」與「誰在吃空間」,不能只給一個總數。
  var LS_LIMIT = 5 * 1024 * 1024;
  function localStorageStats() {
    var total = 0, saves = 0, items = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var b = (k.length + (localStorage.getItem(k) || '').length) * 2;   // UTF-16 約 ×2 bytes
        total += b;
        items.push([k, b]);
        if (/^lineage_idle_save_/.test(k)) saves++;
      }
    } catch (e) { return null; }
    items.sort(function (a, b) { return b[1] - a[1]; });
    return { total: total, saves: saves, top: items.slice(0, 5) };
  }

  // UA 原始字串太長沒人讀得下去,解析成人看得懂的;原始字串仍保留在最後一行(型號細節只有它有)
  function uaSummary() {
    var ua = navigator.userAgent, m;
    var browser = (m = ua.match(/(Edg|OPR|SamsungBrowser|Firefox|Chrome)\/([\d.]+)/)) ?
      ({ Edg: 'Edge', OPR: 'Opera', SamsungBrowser: 'Samsung 瀏覽器' }[m[1]] || m[1]) + ' ' + m[2].split('.')[0] :
      (/Safari/.test(ua) ? 'Safari' : '未知瀏覽器');
    var os = (m = ua.match(/Android ([\d.]+)/)) ? 'Android ' + m[1] :
      (m = ua.match(/(?:iPhone )?OS ([\d_]+)/)) ? 'iOS ' + m[1].replace(/_/g, '.') :
      /Windows NT 10/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : '未知系統';
    var dev = (m = ua.match(/Android [\d.]+; ([^;)]+)/)) ? ' / ' + m[1].trim() : '';
    return browser + ' / ' + os + dev;
  }

  // 卡頓類問題:背包/倉庫件數是已知的 O(n) 成本來源,先看這兩個數字比什麼都快。
  //   ⚠️ 一律「讀存檔」而不是讀全域 player——診斷入口在主選單,那裡根本沒載入角色(實測過,
  //      讀 player 只會得到「未載入」的廢資訊)。讀存檔則八格都看得到,且純唯讀。
  //   名稱/職業/等級重用遊戲自己的 slotSummary()(職業已翻中文、也處理得了舊明文存檔),
  //   只有它沒提供的「背包/傭兵件數」才自己讀。格數走 SAVE_SLOT_MAX,別自己寫死。
  function slotMax() { return (typeof SAVE_SLOT_MAX !== 'undefined') ? SAVE_SLOT_MAX : 16; }
  function charSummary() {
    var out = [];
    for (var s = 1; s <= slotMax(); s++) {
      try {
        var sum = (typeof slotSummary === 'function') ? slotSummary(s) : null;
        if (!sum) continue;
        var inv = '?', allies = '?';
        try {
          var d = JSON.parse(_saveUnwrap(_lzGet('lineage_idle_save_' + s)).payload).p;   // 存檔結構 {v,p,ms,ticks},玩家在 p
          inv = (d.inv || []).length; allies = (d.allies || []).length;
        } catch (e) {}
        out.push('第' + s + '格: ' + (sum.name || '(未命名)') + ' / ' + sum.cls + ' Lv' + sum.lv +
          ' / 背包 ' + inv + ' 件 / 傭兵 ' + allies +
          (sum.classic ? ' / 經典' : '') + (sum.traditional ? ' / 傳統' : ''));
      } catch (e) { out.push('第' + s + '格: ⚠️ 讀取失敗(' + String(e.message).slice(0, 40) + ')'); }
    }
    return out.length ? '\n          ' + out.join('\n          ') : '(沒有任何存檔)';
  }

  // 倉庫是「依模式共用桶」、不綁存檔位,故獨立列。
  //   後綴對照 js/12 的 modeSuffix():''=一般 / _classic=經典 / _tradonly=傳統 / _trad=經典+傳統
  var WH_BUCKETS = [['', '一般'], ['_classic', '經典'], ['_tradonly', '傳統'], ['_trad', '經典+傳統']];
  function warehouseSummary() {
    var out = [];
    WH_BUCKETS.forEach(function (b) {
      try {
        var raw = _lzGet('lineage_idle_warehouse' + b[0]);
        if (!raw) return;
        out.push(b[1] + ': ' + (JSON.parse(raw).items || []).length + ' 件');
      } catch (e) { out.push(b[1] + ': 讀取失敗'); }
    });
    return out.length ? out.join(' / ') : '(無)';
  }

  // 離線收益類問題:先看關掉時停在哪張圖、隔多久,比對玩家說法
  function offlineAnchors() {
    var out = [];
    for (var s = 1; s <= slotMax(); s++) {
      var ts = localStorage.getItem('afk_ts_' + s);
      if (!ts) continue;
      var mapId = localStorage.getItem('afk_map_' + s) || '?';
      var mins = Math.round((Date.now() - (+ts)) / 60000);
      var name = mapId;
      try { if (window.AFK_EXTRA && AFK_EXTRA.mapName) name = AFK_EXTRA.mapName(mapId) || mapId; } catch (e) {}
      out.push('第' + s + '格: ' + name + '(' + (mins >= 60 ? Math.floor(mins / 60) + ' 小時前' : mins + ' 分鐘前') + ')');
    }
    return out.length ? out.join('\n          ') : '(無)';
  }

  function collect() {
    var out = {};
    var _jobs = [];
    // 診斷的意義就是「出事時還讀得到」——任一欄位拋錯都不可以把整份帶走(實機踩過:
    //   cache.keys() 拋 Operation too large,整個診斷只印一行「診斷失敗」,其他全沒了)。
    var jobs = { push: function (p) { _jobs.push(Promise.resolve(p).catch(function () {})); } };

    function put(k, fn) { try { out[k] = fn(); } catch (e) { out[k] = '⚠️ 讀取失敗: ' + String(e.message || e).slice(0, 80); } }

    put('診斷版本', function () { return DIAG_VER; });   // 複製成文字回報時也要認得出是哪一版產生的
    put('時間', function () { return new Date().toLocaleString('zh-TW'); });
    put('開啟方式', function () {
      return ((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone)
        ? 'PWA(已安裝的 App)' : '瀏覽器分頁';
    });
    put('網址', function () { return location.origin + location.pathname; });
    put('瀏覽器', uaSummary);
    put('螢幕', function () {
      return innerWidth + '×' + innerHeight + ' / 像素密度 ' + (devicePixelRatio || 1) +
        (document.body.classList.contains('m-mobile') ? ' / 手機版面' : ' / 桌機版面') +
        ' / 上方橫幅 ' + (getComputedStyle(document.documentElement).getPropertyValue('--orig-bar-h').trim() || '0');
    });
    if (navigator.connection) put('網路', function () {
      return (navigator.connection.effectiveType || '?') +
        (navigator.connection.saveData ? ' / ⚠️ 省流量模式(圖可能抓不下來)' : '');
    });
    put('角色', charSummary);
    put('倉庫', warehouseSummary);
    put('離線錨點', offlineAnchors);

    var ls = localStorageStats();
    if (!ls) out.localStorage = '❌ 讀取失敗(可能被瀏覽器擋掉)';
    else {
      var pct = (ls.total / LS_LIMIT * 100).toFixed(1);
      out.localStorage = kb(ls.total) + ' / 上限約 ' + mb(LS_LIMIT) + '(用了 ' + pct + '%)' +
        (ls.total > LS_LIMIT * 0.9 ? '  ⚠️ 快滿了,存檔可能寫不進去!' : '') +
        '\n          存檔 ' + ls.saves + ' 格。吃最多的:\n          ' +
        ls.top.map(function (t) { return '· ' + t[0] + '  ' + kb(t[1]); }).join('\n          ');
    }

    // Service Worker 狀態:沒被控制 = 圖不會走快取,全部走網路
    if (navigator.serviceWorker) {
      out.SW控制中 = navigator.serviceWorker.controller ? '是' : '❌ 否(圖不會走快取!)';
      jobs.push(navigator.serviceWorker.getRegistration().then(function (r) {
        if (!r) { out.SW註冊 = '❌ 無'; return; }
        out.SW註冊 = '有' + (r.waiting ? ' ⚠️ 有新版在等待接手' : '') + (r.installing ? ' ⏳ 安裝中' : '');
      }).catch(function () { out.SW註冊 = '讀取失敗'; }));
    } else out.SW控制中 = '瀏覽器不支援';

    // 這份 index.html 目前引用的 sw 版本(認得出「程式有沒有真的換版」)
    jobs.push(fetch('version.json', { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (v) { out.版本 = '加掛版 ' + v.app + ' / ' + v.code + ' / ' + v.build; })
      .catch(function () { out.版本 = '讀不到 version.json'; }));

    // 配額:用量逼近配額時瀏覽器會開始丟東西
    if (navigator.storage && navigator.storage.estimate) {
      jobs.push(navigator.storage.estimate().then(function (e) {
        var pct = e.quota ? (e.usage / e.quota * 100).toFixed(1) : '?';
        out.儲存用量 = mb(e.usage) + ' / 配額 ' + mb(e.quota) + '(用了 ' + pct + '%)';
      }).catch(function () { out.儲存用量 = '讀取失敗'; }));
    }
    if (navigator.storage && navigator.storage.persisted) {
      jobs.push(navigator.storage.persisted().then(function (p) {
        out.持久化儲存 = p ? '是(不會被系統回收)' : '否(空間不足時可能被回收)';
      }).catch(function () {}));
    }

    jobs.push(bucketStats().then(function (bs) {
      if (!bs) { out.快取桶 = '瀏覽器不支援 Cache'; return; }
      if (!bs.length) { out.快取桶 = '❌ 一個都沒有(完全沒快取)'; return; }
      out.快取桶 = '\n          ' + bs.map(function (b) {
        if (b.err) return b.name + ': ⚠️ 數不出來 —— ' + b.err +
          (/too large/i.test(b.err) ? '\n            ↑ 這桶大到瀏覽器列舉不動。sw.js 的逐怪對帳用的是同一個呼叫,代表它在這台機器上每次載入都會拋錯掛掉。' : '');
        var extra = [];
        if (b.anim) extra.push('怪物幀 ' + b.anim);
        if (b.img) extra.push('圖 ' + b.img);
        return b.name + ': ' + b.total + ' 筆' + (extra.length ? '(' + extra.join(' / ') + ')' : '');
      }).join('\n          ');
    }));

    jobs.push(hashRecords().then(function (h) {
      out.對帳記錄 = '怪物 ' + (h.anim === null ? '❌ 無記錄(下次載入會整包重抓!)' : h.anim + ' 隻') +
        ' / 圖片 ' + (h.img === null ? '❌ 無記錄' : h.img + ' 張');
    }));

    return Promise.all(_jobs).then(function () {
      put('逐怪對帳', function () {
        if (!ANIM_RECON) return '(這次載入沒收到回報)';
        if (ANIM_RECON.skipped) return '⏭️ 跳過 —— ' + ANIM_RECON.skipped + '(✅ 修正版 SW 生效中:沒清任何圖)';
        return '清掉 ' + ANIM_RECON.evicted + ' 張';
      });
      out.最近錯誤 = ERRS.length ?
        '\n          ' + ERRS.map(function (e) { return '· [' + e.t + '] ' + e.kind + ': ' + e.msg + (e.src ? '  (' + e.src + ')' : ''); }).join('\n          ') :
        '(這次開啟後沒抓到;更早的或被 try/catch 吞掉的抓不到)';
      out.UA原始 = navigator.userAgent;
      return out;
    });
  }

  function fmt(o) {
    return Object.keys(o).map(function (k) {
      return k.padEnd ? (k + ':').padEnd(10, '　') + ' ' + o[k] : k + ': ' + o[k];
    }).join('\n');
  }

  function openModal() {
    buildModal();
    var body = document.getElementById('m-diag-body');
    body.textContent = '讀取中…';
    var modal = document.getElementById('m-diag-modal');
    modal.classList.add('open');
    if (window.AFK_UI && AFK_UI.openLayer) _layer = AFK_UI.openLayer(hideModal);
    collect().then(function (o) {
      var txt = fmt(o);
      body.textContent = txt;
      var btn = document.getElementById('m-diag-copy');
      btn.onclick = function () {
        var done = function () { btn.textContent = '✅ 已複製'; setTimeout(function () { btn.textContent = '📋 複製全部'; }, 1500); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback);
        else fallback();
        function fallback() {   // 手機/非安全環境的備援:選取讓使用者自己複製
          var r = document.createRange(); r.selectNodeContents(body);
          var s = getSelection(); s.removeAllRanges(); s.addRange(r);
          btn.textContent = '請長按選取複製';
        }
      };
    }).catch(function (e) { body.textContent = '診斷失敗:' + e.message; });
  }

  var _layer = null;
  function hideModal() { var m = document.getElementById('m-diag-modal'); if (m) m.classList.remove('open'); _layer = null; }
  function closeModal() { if (_layer && window.AFK_UI) AFK_UI.closeLayer(_layer); else hideModal(); }

  function buildModal() {
    if (document.getElementById('m-diag-modal')) return;
    var m = document.createElement('div');
    m.id = 'm-diag-modal';
    m.innerHTML =
      '<div id="m-diag-card">' +
        '<div id="m-diag-head">' +
          '<span id="m-diag-title">🩺 快取診斷 <span id="m-diag-ver">' + DIAG_VER + '</span></span>' +
          '<button id="m-diag-close" title="關閉">✕</button>' +
        '</div>' +
        '<pre id="m-diag-body"></pre>' +
        '<div id="m-diag-foot">' +
          '<button id="m-diag-copy">📋 複製全部</button>' +
          '<span id="m-diag-note">回報問題時,把這份貼給維護者</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    document.getElementById('m-diag-close').addEventListener('click', closeModal);
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(); });
  }

  function injectCSS() {
    if (document.getElementById('m-diag-style')) return;
    var s = document.createElement('style');
    s.id = 'm-diag-style';
    s.textContent =
      '#m-diag-modal{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:100000;display:none;align-items:center;justify-content:center;padding:12px}' +
      '#m-diag-modal.open{display:flex}' +
      '#m-diag-card{background:#111827;border:1px solid #374151;border-radius:12px;max-width:640px;width:100%;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.6)}' +
      '#m-diag-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #374151}' +
      '#m-diag-title{color:#fbbf24;font-weight:700}' +
      '#m-diag-ver{color:#6b7280;font-weight:400;font-size:11px;font-family:monospace}' +
      '#m-diag-close{color:#9ca3af;background:none;border:0;font-size:18px;cursor:pointer;padding:2px 6px}' +
      '#m-diag-body{margin:0;padding:12px 14px;overflow:auto;color:#e5e7eb;font-size:12px;line-height:1.65;white-space:pre-wrap;word-break:break-all;flex:1}' +
      '#m-diag-foot{display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid #374151}' +
      '#m-diag-copy{background:#1d4ed8;color:#fff;border:0;border-radius:6px;padding:6px 12px;font-size:13px;cursor:pointer}' +
      '#m-diag-note{color:#6b7280;font-size:11px}';
    document.head.appendChild(s);
  }

  function init() {
    if (!document.getElementById('main-menu')) { console.warn('[AFK-diag] 找不到 #main-menu,診斷停用。'); return; }
    injectCSS();
    window.AFK_SETTINGS = window.AFK_SETTINGS || { _items: [], add: function (it) { this._items.push(it); } };
    AFK_SETTINGS.add({ label: '🩺 快取診斷', onClick: openModal });
    console.log('[AFK-diag] hooks OK');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
