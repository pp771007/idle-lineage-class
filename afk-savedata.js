/* ============================================================================
 * afk-savedata.js — 存檔匯入 / 匯出外掛
 *
 * 邏輯對齊 D:\Repos\savedata-manager\tool-lite.js:
 *   - 整包匯出「所有 localStorage」(含三個存檔位、倉庫、afk_ts 時間戳…)。
 *   - payload 格式與 tool-lite 相同(type:'savedata-lite-dump'),檔案/字串可互通。
 *   - 匯入 = 整包覆蓋(撞配額自動回滾)→ confirm 確認 → 重新整理。
 *   - 匯入「不」動 afk_ts:匯出到匯入之間的閒置時間,本就該算離線收益(離線外掛
 *     會在下次載入時自然結算;同 slot 15 秒心跳鎖可防雙重結算)。
 *   - Shadow DOM 隔離 UI。
 *
 * 按鈕注入兩處:主選單(#main-menu)、遊戲內「儲存遊戲進度」鈕旁。
 * 掛接:在 index.html </body> 前加一行 <script src="afk-savedata.js"></script>
 * ========================================================================== */
(function () {
  'use strict';
  if (window.__SDM__) { window.__SDM__.open(); return; }

  var VERSION = '1.0.0';
  var DUMP_TYPE = 'savedata-lite-dump';   // 與 tool-lite 對齊 → 檔案/字串互通
  var ORIGIN = location.origin || 'file://';
  var GAME_NAME = '放置天堂';

  /* ---------- localStorage ---------- */
  function snapshot() {
    var o = {};
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); o[k] = localStorage.getItem(k); }
    return o;
  }
  function dataCount(d) { return Object.keys(d).length; }
  // 整包覆蓋:清空現有,寫入匯入內容;撞配額中途失敗就回滾到動手前,再把錯誤往上丟。
  function overwriteData(data) {
    var prev = snapshot();
    Object.keys(prev).forEach(function (k) { localStorage.removeItem(k); });
    try {
      Object.keys(data).forEach(function (k) { localStorage.setItem(k, data[k]); });
    } catch (e) {
      for (var i = localStorage.length - 1; i >= 0; i--) localStorage.removeItem(localStorage.key(i));
      Object.keys(prev).forEach(function (k) { localStorage.setItem(k, prev[k]); });
      throw e;
    }
  }

  /* ---------- 小工具 ---------- */
  function fmtTime(ts) {
    var d = new Date(ts), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function toB64(s) { return btoa(unescape(encodeURIComponent(s))); }
  function fromB64(b) { return decodeURIComponent(escape(atob((b || '').replace(/\s+/g, '')))); }
  function exportPayload(data) {
    return JSON.stringify({
      type: DUMP_TYPE, version: 1, origin: ORIGIN,
      exportedAt: new Date().toISOString(), count: dataCount(data), data: data
    }, null, 2);
  }
  function parseDump(text) {
    var obj = JSON.parse(text);
    if (obj && obj.type === DUMP_TYPE && obj.data && typeof obj.data === 'object') return obj.data;
    throw new Error('檔案格式不對');
  }
  function isQuotaError(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
  }

  /* ---------- UI(Shadow DOM 隔離) ---------- */
  var host = document.createElement('div');
  host.id = '__sdm_host__';
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;';
  (document.body || document.documentElement).appendChild(host);
  var root = host.attachShadow({ mode: 'open' });
  host.style.display = 'none';

  root.innerHTML =
    '<style>' +
    ':host{all:initial;}' +
    '*{box-sizing:border-box;font-family:"Microsoft JhengHei",system-ui,sans-serif;}' +
    '.overlay{position:fixed;inset:0;background:rgba(2,6,23,.55);z-index:1;}' +
    '.panel{position:fixed;top:0;right:0;height:100vh;height:100dvh;width:400px;max-width:100vw;background:#0f172a;color:#e2e8f0;z-index:2;display:flex;flex-direction:column;box-shadow:-12px 0 40px rgba(0,0,0,.5);border-left:1px solid #334155;}' +
    '.hd{display:flex;align-items:center;gap:10px;padding:16px;border-bottom:1px solid #334155;background:#1e293b;}' +
    '.hd .ttl{font-weight:800;font-size:1.1rem;flex:1;}' +
    '.hd .ver{font-size:.7rem;color:#64748b;font-weight:600;margin-left:6px;}' +
    '.x{background:#273449;border:1px solid #334155;color:#e2e8f0;border-radius:8px;cursor:pointer;width:36px;height:36px;font-size:1.15rem;}' +
    '.x:hover{background:#334155;}' +
    '.body{flex:1;overflow-y:auto;padding:18px;}' +
    '.seclabel{font-size:1.02rem;font-weight:800;margin:0 0 12px;display:flex;align-items:center;gap:8px;}' +
    '.hint{font-size:.82rem;color:#94a3b8;line-height:1.7;margin:0 0 12px;background:#1e293b;border-radius:10px;padding:10px 14px;}' +
    '.hint.warn{color:#fcd34d;background:#2a2410;border:1px solid #3f3a1a;}' +
    '.row2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;}' +
    '.mini{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-align:center;border:1px solid #334155;border-radius:10px;padding:14px 8px;cursor:pointer;font-weight:700;font-size:.9rem;background:#1e293b;color:#e2e8f0;transition:border-color .12s,background .12s;}' +
    '.mini:hover{border-color:#38bdf8;background:#22304a;}' +
    '.mini .mic{font-size:1.4rem;line-height:1;}' +
    '.divider{height:1px;background:#334155;margin:20px 0;}' +
    '.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#16a34a;color:#fff;font-weight:700;padding:11px 18px;border-radius:10px;z-index:3;opacity:0;transition:opacity .2s;font-size:.88rem;max-width:90%;text-align:center;}' +
    '.toast.show{opacity:1;}' +
    '.toast.err{background:#ef4444;}' +
    '</style>' +
    '<div class="overlay" data-close></div>' +
    '<div class="panel">' +
      '<div class="hd"><div class="ttl">📦 存檔匯入 / 匯出<span class="ver"></span></div><button class="x" data-close title="關閉">✕</button></div>' +
      '<div class="body">' +
        '<div class="seclabel">📤 把存檔帶走</div>' +
        '<div class="hint">匯出整包存檔(三個角色 + 倉庫等)。可存成檔案,或複製成一段文字貼到別台。</div>' +
        '<div class="row2">' +
          '<button class="mini" id="doExport"><span class="mic">📤</span>存成檔案</button>' +
          '<button class="mini" id="doCopy"><span class="mic">📋</span>複製文字</button>' +
        '</div>' +
        '<div class="divider"></div>' +
        '<div class="seclabel">📥 從別台讀回來</div>' +
        '<div class="hint warn">⚠️ 會整包覆蓋目前存檔,原本的會不見、無法復原。</div>' +
        '<div class="row2">' +
          '<button class="mini" id="doImport"><span class="mic">📥</span>讀取檔案</button>' +
          '<button class="mini" id="doPasteImport"><span class="mic">📝</span>貼上文字</button>' +
        '</div>' +
        '<input type="file" id="fileInput" accept=".json,application/json" style="display:none">' +
        '<textarea id="ioText" placeholder="把存檔字串貼在這裡(貼上後會自動匯入)" style="display:none;width:100%;height:90px;margin-top:10px;background:#0b1220;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:8px;font-size:.78rem;font-family:monospace;resize:vertical;"></textarea>' +
      '</div>' +
    '</div>' +
    '<div class="toast" id="toast"></div>';

  var $ = function (s) { return root.querySelector(s); };
  $('.ver').textContent = 'v' + VERSION;

  var toastTimer = null;
  function toast(msg, isErr) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (isErr ? ' err' : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); toastTimer = null; }, 2200);
  }
  function finishAndReload(msg) { toast(msg); setTimeout(function () { location.reload(); }, 700); }
  function close() { host.style.display = 'none'; }
  function open() { host.style.display = ''; }
  root.querySelectorAll('[data-close]').forEach(function (el) { el.addEventListener('click', close); });

  /* ---- 匯出檔案 ---- */
  $('#doExport').addEventListener('click', function () {
    var data = snapshot();
    if (!dataCount(data)) { toast('目前沒有存檔可以匯出', true); return; }
    download(GAME_NAME + '存檔_' + fmtTime(Date.now()).replace(/[\/: ]/g, '') + '.json', exportPayload(data));
    toast('✓ 已下載存檔檔案');
  });
  /* ---- 複製文字 ---- */
  $('#doCopy').addEventListener('click', function () {
    var data = snapshot();
    if (!dataCount(data)) { toast('目前沒有存檔可以匯出', true); return; }
    var s = toB64(exportPayload(data));
    var ta = $('#ioText'); ta.style.display = 'block'; ta.value = s; ta.focus(); ta.select();
    var manual = function () { toast('✓ 已產生字串(已選取,請按 Ctrl+C 複製)'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(function () { toast('✓ 已複製存檔字串'); }, manual);
    else manual();
  });
  /* ---- 匯入共用 ---- */
  function doOverwrite(data) {
    if (!confirm('用匯入的存檔覆蓋目前進度?\n原本的會被取代、無法復原,完成後重新整理。')) return;
    try { overwriteData(data); }
    catch (e) {
      if (isQuotaError(e)) toast('這份存檔太大,超過瀏覽器容量上限,已取消', true);
      else toast('匯入失敗:' + (e && e.message || e), true);
      return;
    }
    finishAndReload('✓ 已覆蓋,正在重新整理…');
  }
  /* ---- 檔案匯入 ---- */
  $('#doImport').addEventListener('click', function () { $('#fileInput').click(); });
  $('#fileInput').addEventListener('change', function (e) {
    var input = e.target, f = input.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = parseDump(reader.result); }
      catch (err) { toast('匯入失敗:' + err.message, true); input.value = ''; return; }
      input.value = ''; doOverwrite(data);
    };
    reader.readAsText(f);
  });
  /* ---- 貼上匯入 ---- */
  $('#doPasteImport').addEventListener('click', function () {
    var ta = $('#ioText'); ta.style.display = 'block'; ta.value = ''; ta.focus();
    toast('把另一台複製的字串貼到下方框框(貼上後會自動匯入)');
  });
  function importFromText(text) {
    var data;
    try { data = parseDump(fromB64(text)); }
    catch (e1) { try { data = parseDump(text); } catch (e2) { toast('字串無法解析,請確認有完整貼上', true); return; } }
    var ta = $('#ioText'); ta.value = ''; ta.style.display = 'none';
    doOverwrite(data);
  }
  $('#ioText').addEventListener('paste', function () {
    var ta = this;
    setTimeout(function () { if (ta.value.trim()) importFromText(ta.value); }, 0);
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && host.style.display !== 'none') close(); });

  /* ---------- 注入啟動按鈕 ---------- */
  function mkBtn(label, cls) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = cls + ' sdm-launch';
    b.textContent = label;
    b.addEventListener('click', function (ev) { ev.preventDefault(); open(); });
    return b;
  }
  function injectLaunchers() {
    // 主選單:接在 新遊戲/載入 下面
    var mm = document.getElementById('main-menu');
    if (mm && !mm.querySelector('.sdm-launch')) {
      mm.appendChild(mkBtn('📦 匯入 / 匯出存檔', 'btn w-72 py-2 bg-slate-700 hover:bg-slate-600 text-base'));
    }
    // 遊戲內:接在「儲存遊戲進度」鈕後面
    var sb = document.querySelector('[onclick*="saveGame"]');
    if (sb && sb.parentNode && !(sb.nextElementSibling && sb.nextElementSibling.classList && sb.nextElementSibling.classList.contains('sdm-launch'))) {
      var b = mkBtn('📦 匯入 / 匯出存檔', 'btn w-full py-2 bg-slate-700 hover:bg-slate-600 text-base');
      b.style.marginTop = '8px';
      sb.parentNode.insertBefore(b, sb.nextSibling);
    }
  }

  window.__SDM__ = { version: VERSION, open: open, close: close };

  function init() {
    injectLaunchers();
    console.log('[AFK-savedata] hooks OK — 存檔匯入/匯出已啟用(對齊 tool-lite 格式)。');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
