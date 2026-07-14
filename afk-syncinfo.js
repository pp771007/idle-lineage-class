/* ============================================================================
 * afk-syncinfo.js — 首頁顯示「原作者 + 加掛版版本號」
 *
 * 本專案自 2026-07 起獨立維護、不再跟進原作者版本;首頁(#main-menu)保留
 * 原作者署名與正版連結,並顯示加掛版自己的版本號(讀根目錄 version.json 的
 * app 欄位,由 /release 發版時 bump),玩家回報問題時能講出所在版本。
 *   - 純讀取 version.json,讀不到就只藏版本列,不影響遊戲。
 *   - 檔名沿用歷史名稱(原本顯示「原版最後同步時間」),避免改名折騰快取與引用。
 *
 * 掛接:在 index.html 的 </body> 前加一行 <script src="afk-syncinfo.js"></script>
 * ========================================================================== */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  // 最後更新時間顯示：優先用 version.json 的 buildAt(完整「YYYY-MM-DD HH:MM」台灣時間)；
  //   舊版 version.json 無 buildAt 時退回 build(「MMDD-HHMM」)格式化成「MM/DD HH:MM」(無年份)。
  function fmtUpdTime(buildAt, build) {
    if (buildAt && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(buildAt)) return buildAt;
    var m = /^(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(build || '');
    return m ? (m[1] + '/' + m[2] + ' ' + m[3] + ':' + m[4]) : '';
  }

  function injectCSS() {
    if (document.getElementById('afk-syncinfo-style')) return;
    var s = document.createElement('style');
    s.id = 'afk-syncinfo-style';
    s.textContent =
      '#afk-syncinfo,#afk-syncinfo-links{color:#64748b;font-size:12px;text-align:center;letter-spacing:.3px;line-height:1.6;}' +
      '.afk-si-row{margin-top:1px;}' +
      '.afk-si-link{color:#7dd3fc;text-decoration:underline;}' +
      '.afk-si-dot{color:#475569;margin:0 5px;}' +
      // 原作者名:彩虹漸層流動(會動)
      '.afk-si-name{font-weight:bold;background:linear-gradient(90deg,#f472b6,#fb923c,#fde047,#34d399,#22d3ee,#a78bfa,#f472b6);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:afk-si-flow 6s linear infinite;}' +
      '@keyframes afk-si-flow{to{background-position:220% 0;}}';
    document.head.appendChild(s);
  }

  function init() {
    var menu = document.getElementById('main-menu');
    if (!menu) { console.warn('[AFK-syncinfo] 找不到 #main-menu,原作者/最後同步資訊不顯示。'); return; }
    if (document.getElementById('afk-syncinfo')) return;
    injectCSS();
    // 頂部:原作者 + 正版最後同步(各自一列;afk-skin 會把這塊排到外掛框最上方)
    var foot = document.createElement('div');
    foot.id = 'afk-syncinfo';
    foot.innerHTML =
      '<div class="afk-si-row"><span class="afk-si-author">原作者：<span class="afk-si-name">秋玥</span> <a class="afk-si-link" href="https://shines871.github.io/idle-lineage-class/" target="_blank" rel="noopener">(正版連結)</a></span></div>' +
      '<div class="afk-si-row afk-si-verrow"><span class="afk-si-ver"></span></div>' +
      '<div class="afk-si-row afk-si-updrow"><span class="afk-si-upd"></span></div>';
    menu.appendChild(foot);
    // 連結:巴哈討論串一列;Line群與Discord群同一列(afk-skin 會排到框內較下方)
    var links = document.createElement('div');
    links.id = 'afk-syncinfo-links';
    links.innerHTML =
      '<div class="afk-si-row"><a class="afk-si-link" href="https://forum.gamer.com.tw/C.php?bsn=84452&amp;snA=8362" target="_blank" rel="noopener">巴哈討論串</a>（本加掛版發布在 <a class="afk-si-link" href="https://forum.gamer.com.tw/Co.php?bsn=84452&amp;sn=37297" target="_blank" rel="noopener">301</a> 樓）</div>' +
      '<div class="afk-si-row"><a class="afk-si-link" href="https://line.me/ti/g2/RRXPx6rMc8ZhxiuNSSziKtcjnhc2AXEPuIOpVA?utm_source=invitation&amp;utm_medium=link_copy&amp;utm_campaign=default" target="_blank" rel="noopener">[加入Line群討論]</a> <a class="afk-si-link" href="https://discord.gg/NNe6Un7PK" target="_blank" rel="noopener">[加入Discord群]</a></div>';
    menu.appendChild(links);
    console.log('[AFK-syncinfo] hooks OK — 首頁顯示原作者與加掛版版本號。');

    var verRow = foot.querySelector('.afk-si-verrow'), verEl = foot.querySelector('.afk-si-ver');
    var updRow = foot.querySelector('.afk-si-updrow'), updEl = foot.querySelector('.afk-si-upd');
    verRow.style.display = 'none'; updRow.style.display = 'none';   // 讀到才顯示,讀不到整列不佔位
    // file:// 無法 fetch(CORS,origin null)→ 直接降級藏版本列,避免 console 噴紅字;http(s) 才去抓
    if (!/^https?:$/.test(location.protocol)) return;
    fetch('version.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.app) return;
        // 第一列:加掛版版本號 · 更新日誌連結
        verEl.innerHTML = '加掛版 v' + j.app +
          '<span class="afk-si-dot">·</span><a class="afk-si-link" href="https://github.com/pp771007/idle-lineage-class/releases" target="_blank" rel="noopener">更新日誌</a>';
        verRow.style.display = '';
        // 第二列:最後更新時間(台灣時間),自成一行放在版本號下面
        var t = fmtUpdTime(j.buildAt, j.build);
        if (t) { updEl.innerHTML = '最後更新 ' + t; updRow.style.display = ''; }
      })
      .catch(function () { /* 讀不到就維持隱藏 */ });
  }

  ready(init);
})();
