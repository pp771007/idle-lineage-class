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

  var IMG_CACHE = 'img-v3';           // ← 與 sw.js 同名(那邊是固定桶名,不隨版本換)
  var CODE_CACHE = 'code-v1';
  var ANIM_HASH_KEY = '/__afk-anim-hashes__';   // sw.js 存「一怪一雜湊」對帳記錄的合成 entry
  var IMG_HASH_KEY = '/__afk-img-hashes__';

  function mb(n) { return (n / 1048576).toFixed(1) + ' MB'; }

  // 逐桶統計:總筆數、怪物動畫幀數、圖片數
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
        });
      }));
    });
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

  function localStorageBytes() {
    var total = 0, saves = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var v = localStorage.getItem(k) || '';
        total += k.length + v.length;
        if (/^lineage_idle_save_/.test(k)) saves++;
      }
    } catch (e) { return { total: -1, saves: -1 }; }
    return { total: total * 2, saves: saves };   // UTF-16,約 ×2 bytes
  }

  function collect() {
    var out = {};
    var jobs = [];

    out.時間 = new Date().toLocaleString('zh-TW');
    out.開啟方式 = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) ||
      navigator.standalone ? 'PWA(已安裝的 App)' : '瀏覽器分頁';
    out.網址 = location.origin + location.pathname;
    out.UA = navigator.userAgent;

    var ls = localStorageBytes();
    out.存檔 = ls.saves + ' 格 / localStorage 共 ' + mb(ls.total);

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
      out.快取桶 = bs.map(function (b) {
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

    return Promise.all(jobs).then(function () { return out; });
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
          '<span id="m-diag-title">🩺 快取診斷</span>' +
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
