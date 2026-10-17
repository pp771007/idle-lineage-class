/* ============================================================================
 * afk-fullsave.js — 完整資料備份與還原(本機檔案·零後端)
 *
 * 解決什麼:核心 exportSave/importSave 一次只搬「一格角色」,而倉庫/寵物/收集冊/血盟
 *   是附在該格匯出檔裡的快照,匯入還要逐項 confirm。16 格角色要來回 16 次
 *   (afk-reissueid 的警語就是叫玩家每隻各匯一次)。這裡一次搬完整台的遊戲資料。
 *   方案與取捨見 docs/save-transfer.md「方案①」。
 *
 * 🚨 整包搬,不挑 key——連白名單都不要:
 *   一度寫成「只搬 lineage_idle_/fb5_/afk_/dograce_ 前綴」,已否決。任何形式的清單都要跟著
 *   上游走,作者哪天新增一個 key 我們不會知道,漏搬是**安靜失效**(玩家搬完、玩一陣子才發現
 *   東西不見,而且查不出來)。正確性論證很硬:B 變成 A 的完整複本,A 跑得動 B 就跑得動。
 *   → 匯出 localStorage 全部 key,還原時把現有的全部清掉再原樣寫回。新增功能自動涵蓋,零維護。
 *   唯一例外是 LOCAL_ONLY 那兩個「我們自己存的祕密」(理由寫在那裡):不是遊戲資料,這條不適用。
 *
 * 還原的安全設計(每一條都是「弄壞玩家存檔」的防線):
 *   ① 備份只用**文字建議**(確認框裡提醒「先按上面的匯出」),刻意不做「強制自動下載一份」——
 *      瀏覽器擋下載、玩家按取消、手機存到哪都偵測不到,download() 回 true 只代表「觸發了動作」,
 *      拿它當前置條件是假保證,只換來多兩個對話框。
 *      也刻意不做記憶體快照回滾:整包 localStorage 讀進 JS 是 UTF-16、體積 ×2,加上新包本身,
 *      在 iOS 上等於自找記憶體壓力。
 *   ② 寫入前只驗「這是不是我們自己產生的檔、有沒有缺角」——format / schema / keyCount /
 *      每個值都是字串,**全是本檔自己寫進去的欄位**,驗不過一個字都不寫。
 *      🚨 絕不檢查 keys 裡裝什麼(有沒有角色存檔、key 叫什麼):認得內容就是對上游存檔格式
 *      做假設,作者改個名字就會把所有合法備份檔擋在門外,而且是在玩家換裝置時才爆。
 *   ③ clear() 全清再原樣寫回(配額峰值最低);中途寫失敗立刻停手並明講要用備份檔救回來。
 *      在途的背景壓縮不會來搗亂:worker 回來時會比對 _lsGet(key) 是不是它記得的原值
 *      (js/00-data.js:136),clear 過或已被新值覆蓋都對不上 → 自己 return 不寫。
 *   ④ 寫入一律走 _lzSetStoredRaw(原值原樣直寫+bump rev 讓在途壓縮失效)。
 *      不可用 _lzSet:它先寫明文再背景壓縮,明文可能當場撐爆 5MB 配額。
 *   ⑤ 入口在首頁設定選單(afk-storage,掛在 #main-menu)→ 天然只有主選單開得到,
 *      不會發生「遊戲中還原完,記憶體裡的舊 player 又被 saveGame 寫回去」。
 *
 * 🔑 轉移碼(2026-08-01 加·子開關 fullsavecode):同一包資料改用「六碼」搬,免存檔案。
 *   A 按「產生轉移碼」→ 整包上傳到 Litterbox → 拿它回傳的六碼;B 輸入六碼 → 抓回來 → 走上面同一條還原流程。
 *   打包/驗證/寫入完全共用,轉移碼只是換一個「把那包交出去」的管道。
 *
 *   為什麼是 Litterbox(catbox.moe 的暫存版):比較過 Pixeldrain / Catbox / Uguu / Filebin /
 *   file.io / JSONBin,**只有它兩半都在瀏覽器裡通、而且 `file://` 也通**(實機驗過)。
 *     - Pixeldrain / JSONBin:要 API 金鑰 → 金鑰得放進公開 repo,等於把帳號送人
 *     - Catbox(永久版) / Uguu:上傳或下載沒有 CORS 標頭 → 瀏覽器讀不到回應,拿不到網址
 *     - Filebin:上傳可以、**下載不行**——它看 User-Agent,瀏覽器一律拿到導頁 HTML 而不是檔案
 *   詳細比較與實測數字見 docs/save-transfer.md。
 *
 *   🚨 這條路會把玩家整包資料送到第三方主機,所以:
 *     ① 面板文字要講明「暫存在網路上、24 小時後自動刪除」——這是玩家決定按不按的依據。
 *     ② 獨立子開關,關掉只剩檔案那半(它是本機、零依賴的保底,永遠不能被雲端取代)。
 *     ③ 對方掛掉/沒網路時訊息要把玩家導回檔案那半,不要只說「失敗」。
 *
 *   ⚠️ 碼是伺服器給的小寫英數六碼(如 `4wz0fn`)、**大小寫敏感**(`4WZ0FN` → 404)。
 *     跨裝置是「看著 A 的螢幕在 B 上打字」,`0`/`o`、`1`/`l` 一定有人看錯 → 輸入端自動轉小寫、
 *     去空白,找不到時明講可能是看錯了。**絕不可自動把 o 換成 0 再試一次**:那可能抓到
 *     別人的存檔並覆蓋玩家進度。沒機密性歸沒機密性,還原到別人的存檔是災難。
 *
 * 優雅降級:缺 _lzSetStoredRaw / AFK_SETTINGS 就 console.warn 後安靜停用。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) AFK_TOGGLES.register({
    id: 'fullsave', parent: 'storage', name: '完整資料備份與還原', group: '系統與其他', def: true,
    desc: '把整台裝置的遊戲資料存成一個檔案，換手機時一次搬完，也可以傳給作者查問題'
  });
  function on() { try { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('fullsave'); } catch (e) { return true; } }

  if (window.AFK_TOGGLES) AFK_TOGGLES.register({
    id: 'fullsavecode', parent: 'fullsave', name: '用轉移碼搬家', group: '系統與其他', def: true,
    desc: '用六碼把資料搬到另一台裝置；資料會暫存在網路上，24 小時後自動刪除'
  });
  function codeOn() { try { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('fullsavecode'); } catch (e) { return true; } }

  if (typeof window._lzSetStoredRaw !== 'function') {
    try { console.warn('[AFK-fullsave] 缺核心 _lzSetStoredRaw,完整資料備份與還原停用。'); } catch (e) {}
    return;
  }

  var FORMAT = 'idle-lineage-full';
  var SCHEMA = 1;

  // 🔒 只留在這台裝置、不進備份檔也不進轉移碼的 key——全是本專案自己存的祕密,不是遊戲資料:
  //   lineage_login_saved:登入畫面「記住帳號」(js/00z-my-tweaks.js;舊版連玩家的明文密碼一起存)
  //   update_page_token  :舊版 update.html 存在 localStorage 的站長 GitHub 通行碼(同網域)。現在改放 sessionStorage、
  //                       開頁就刪舊的,但還沒打開過新版 update.html 的裝置上舊的那份還在 → 照樣排除
  //   備份檔會被傳給作者查問題、轉移碼整包上傳到公開的 Litterbox,這兩個一出去就收不回來。
  //   這不違反檔頭「整包搬、不挑 key」:那條防的是對**上游遊戲資料**做假設——作者改名我們不會知道,漏搬是安靜失效;
  //   這兩個名字是我們自己取的,而且漏掉的後果只是換裝置後要重新勾一次記住帳號/重貼一次通行碼。
  //   ⚠️ 改了那兩邊的 key 名要回來同步改這裡,否則祕密又會跟著出去。
  //   還原時同理:備份檔裡就算有(舊版匯出的檔)也不寫入,這台自己原本的值留著。
  var LOCAL_ONLY = { lineage_login_saved: 1, update_page_token: 1 };

  function lsKeys() {
    var out = [];
    for (var k in localStorage) { if (Object.prototype.hasOwnProperty.call(localStorage, k)) out.push(k); }
    return out;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function stamp() {
    var d = new Date(), p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  // 檔案裡只有三個「我們自己寫的」欄位:format(認得是不是我們的檔)、exportedAt(給玩家確認)、
  // keyCount(檔案有沒有被截斷)。keys 內容一律原封不動,不解析、不認識、不判斷(LOCAL_ONLY 除外)。
  function buildPack() {
    var keys = {}, n = 0;
    lsKeys().forEach(function (k) { if (LOCAL_ONLY[k]) return; var v = localStorage.getItem(k); if (v != null) { keys[k] = v; n++; } });
    return { format: FORMAT, schema: SCHEMA, exportedAt: new Date().toISOString(), keyCount: n, keys: keys };
  }

  // 🔁 與核心 exportSave(js/13:558)同一套,不要自己另立一種:showSaveFilePicker 可用就用
  //    (Chrome/Edge,含 Android → 跳出「選存到哪」),AbortError=玩家自己取消、不算失敗,
  //    其他錯或不支援(iOS Safari / Firefox)才退回 <a download>。
  //    ⚠️ 少了這段兩個匯出的手感就不一致——玩家實測:核心那顆會跳選擇位置,我們這顆直接下載。
  //    讓玩家自己挑位置順便繞開「Android 存到下載資料夾變 0 byte」的情形。
  function download(text, fname) {
    if (typeof window.showSaveFilePicker === 'function') {
      return window.showSaveFilePicker({
        suggestedName: fname,
        types: [{ description: '備份檔', accept: { 'application/json': ['.json'] } }]
      }).then(function (handle) {
        return handle.createWritable().then(function (w) {
          return w.write(text).then(function () { return w.close(); }).then(function () { return 'saved'; });
        });
      }).catch(function (e) {
        if (e && e.name === 'AbortError') return 'cancel';   // 玩家自己按取消,不是失敗
        return downloadFallback(text, fname);                // 其他錯(權限/沙箱)→ 照舊下載
      });
    }
    return Promise.resolve(downloadFallback(text, fname));
  }
  function downloadFallback(text, fname) {
    try {
      var blob = new Blob([text], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return 'saved';
    } catch (e) { return 'fail'; }
  }

  function doExport() {
    var fname = 'idle-lineage-backup-' + stamp() + '.json';
    var text;
    try { text = JSON.stringify(buildPack()); }
    catch (e) { note('❌ 打包失敗：' + (e && e.message || e), true); return Promise.resolve(null); }
    return download(text, fname).then(function (r) {
      if (r === 'cancel') return null;
      if (r !== 'saved') { note('❌ 存檔失敗（瀏覽器可能擋住了下載）。', true); return null; }
      return { fname: fname };
    });
  }

  // ── 轉移碼(同一包資料,換一個交出去的管道) ────────────────────
  var LB_UPLOAD = 'https://litterbox.catbox.moe/resources/internals/api.php';
  var LB_FILE   = 'https://litter.catbox.moe/';
  var LB_EXPIRY = '24h';        // 1h/12h/24h/72h。選 24h:玩家常常上傳完跑去做別的事,1 小時真的會過期
  var CODE_RE   = /^[a-z0-9]{6}$/;

  // 回傳的是 https://litter.catbox.moe/4wz0fn.json → 取出中間那六碼
  function codeFromUrl(url) {
    var m = String(url || '').trim().match(/([a-z0-9]{6})\.json\s*$/i);
    return m ? m[1].toLowerCase() : '';
  }
  // 玩家可能打成大寫、前後帶空白;整串網址貼進來也一併吃掉(不寫在提示裡,但別讓他走進死路)
  function normalizeCode(s) {
    var t = String(s || '').trim().toLowerCase();
    if (t.indexOf('/') >= 0) t = t.slice(t.lastIndexOf('/') + 1);
    return t.replace(/\.json$/, '').trim();
  }

  function uploadPack() {
    var text;
    try { text = JSON.stringify(buildPack()); }
    catch (e) { return Promise.reject(new Error('打包失敗：' + (e && e.message || e))); }
    var fd = new FormData();
    fd.append('reqtype', 'fileupload');
    fd.append('time', LB_EXPIRY);
    fd.append('fileToUpload', new Blob([text], { type: 'application/json' }), 'save.json');
    return fetch(LB_UPLOAD, { method: 'POST', body: fd }).then(function (r) {
      if (!r.ok) throw new Error('上傳失敗（' + r.status + '）');
      return r.text();
    }).then(function (url) {
      var code = codeFromUrl(url);
      if (!code) throw new Error('上傳結果看不懂');
      return code;
    });
  }

  function downloadByCode(code) {
    return fetch(LB_FILE + code + '.json', { cache: 'no-store' }).then(function (r) {
      if (r.status === 404) throw new Error('NOTFOUND');
      if (!r.ok) throw new Error('讀取失敗（' + r.status + '）');
      return r.text();
    });
  }

  // ── 還原 ───────────────────────────────────────────────────
  // 只驗「是不是我們自己產生的檔、完不完整」——format / schema / keyCount 全是本檔自己寫進去的欄位。
  // 🚨 絕不檢查 keys 裡面裝什麼(有沒有角色存檔、key 叫什麼名字):那是對上游存檔格式的假設,
  //    作者哪天改名,所有合法備份檔都會被拒收,而且是在玩家換裝置時才炸。
  function validate(text) {
    var d;
    try { d = JSON.parse(text); } catch (e) { d = null; }
    // 空檔也走這條(Android 下載到「下載」資料夾有變成 0 byte 的情形)→ 訊息要涵蓋,不然玩家只會以為自己選錯檔
    if (!d || typeof d !== 'object' || d.format !== FORMAT) return { ok: false, err: '這不是備份檔，或檔案是空的。請選你用「📤 匯出備份」存出來的檔案。' };
    if (!(d.schema <= SCHEMA)) return { ok: false, err: '這個備份檔是比較新的版本存的，請先更新遊戲再還原。' };
    var keys = d.keys;
    if (!keys || typeof keys !== 'object' || Array.isArray(keys)) return { ok: false, err: '備份檔不完整，請重新匯出一份。' };
    var names = Object.keys(keys);
    if (!names.length || (d.keyCount != null && d.keyCount !== names.length)) return { ok: false, err: '備份檔不完整，請重新匯出一份。' };
    for (var i = 0; i < names.length; i++) if (typeof keys[names[i]] !== 'string') return { ok: false, err: '備份檔不完整，請重新匯出一份。' };
    return { ok: true, pack: d };
  }

  // 實際寫入:整個清空再原樣寫回。中途失敗立刻停手,回報寫到第幾個。
  // LOCAL_ONLY:備份檔裡的不寫,這台原本的在 clear() 前先拿出來、最後放回去(放不回去也不算還原失敗)。
  function applyPack(pack) {
    var names = Object.keys(pack.keys).filter(function (k) { return !LOCAL_ONLY[k]; });
    var keep = {};
    Object.keys(LOCAL_ONLY).forEach(function (k) { try { var v = localStorage.getItem(k); if (v != null) keep[k] = v; } catch (e) {} });
    try { localStorage.clear(); }
    catch (e) { return { ok: false, done: 0, err: '清除舊資料時失敗：' + (e && e.message || e) }; }
    for (var i = 0; i < names.length; i++) {
      var k = names[i], okw = false;
      try { okw = _lzSetStoredRaw(k, pack.keys[k]) !== false; } catch (e) { okw = false; }
      if (!okw) return { ok: false, err: '儲存空間不足' };
    }
    Object.keys(keep).forEach(function (k) { try { _lzSetStoredRaw(k, keep[k]); } catch (e) {} });
    return { ok: true, done: names.length };
  }

  function startRestore() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = function () {
      var f = input.files && input.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onerror = function () { note('❌ 讀取檔案失敗。', true); };
      reader.onload = function () {
        var v = validate(String(reader.result || ''));
        if (!v.ok) { note('❌ ' + v.err, true); return; }
        confirmAndApply(v);
      };
      reader.readAsText(f);
    };
    input.click();
  }

  function confirmAndApply(v) {
    var pack = v.pack, when = pack.exportedAt || '?';
    try { when = new Date(pack.exportedAt).toLocaleString('zh-TW'); } catch (e) {}
    // 「先關掉其他分頁」不是客套話:還原同一個角色的舊備份時,核心的 _roleSaveAllowed(js/13:426)
    // 因為角色指紋一樣而放行,開著的分頁每 5 秒就把還原的內容蓋回去,而且畫面照樣顯示還原成功。
    // ⚠️ AFK_UI.confirm 會把 message 先 esc() 再把 \n 換成 <br>(afk-ui.js) → 塞 HTML 標籤會被當文字印出來,
    //    要條列只能用純文字編號。
    ask('備份檔：' + when + '\n\n1. 請確認已關閉其他遊戲分頁。\n2. 這台裝置原本的紀錄將被覆蓋。',
      function () { runApply(pack); });
  }

  function runApply(pack) {
    note('還原中…請不要關掉頁面。');
    var r = applyPack(pack);
    if (!r.ok) {
      note('❌ 還原沒有完成（' + r.err + '）。這台裝置的資料現在是不完整的，請重新匯入一次備份檔，或改用空間比較夠的裝置。', true);
      return;
    }
    note('✅ 已還原，重新載入中…');
    setTimeout(function () { try { location.reload(); } catch (e) {} }, 900);
  }

  function ask(message, onOk) {
    if (window.AFK_UI && AFK_UI.confirm) {
      AFK_UI.confirm({ title: '⚠️ 還原完整資料備份', message: message, align: 'left', okText: '我了解，繼續', cancelText: '取消', danger: true, onOk: onOk });
    } else if (window.confirm(message)) { onOk(); }
  }

  // ── 面板 ───────────────────────────────────────────────────
  var _layer = null;
  function note(html, bad) {
    var el = document.getElementById('m-fsv-note');
    if (!el) return;
    el.className = bad ? 'fsv-note fsv-bad' : 'fsv-note';
    el.innerHTML = esc(html).replace(/\n/g, '<br>');
  }
  // 文案只留玩家用得到的:容量、項目數、內部名詞對他們沒有任何幫助,寫了只會讓人不看。
  function renderBody() {
    // 玩家最常見的「存檔不見了」是清快取／換手機／瀏覽器自己回收資料——這句是叫他現在就去按匯出，不是純提醒
    return '<div class="fsv-warn">進度只存在這台裝置的瀏覽器裡，清除瀏覽器資料或換手機就會不見，記得定期匯出備份留一份。</div>'
      + '<div class="fsv-desc">把全部角色的進度存成一個檔案，換手機時一次搬完，也可以傳給作者查問題。</div>'
      + '<div class="fsv-btns">'
      + '<button id="m-fsv-exp" class="fsv-b fsv-go">📤 匯出備份</button>'
      + '<button id="m-fsv-imp" class="fsv-b fsv-danger">📥 還原備份</button>'
      + '</div>'
      + (codeOn() ? ('<div class="fsv-sep">或用轉移碼，不存檔案</div>'
        + '<div class="fsv-desc">在這台按「產生轉移碼」，到另一台輸入那六碼就搬過去了；資料暫存在網路上，24 小時後自動刪除。</div>'
        + '<div class="fsv-btns">'
        + '<button id="m-fsv-gen" class="fsv-b fsv-go">🔑 產生轉移碼</button>'
        + '<div id="m-fsv-codebox" class="fsv-codebox"><span id="m-fsv-code" class="fsv-code"></span>'
        + '<button id="m-fsv-copy" class="fsv-b fsv-mini">📋 複製</button></div>'
        + '<div class="fsv-row"><input id="m-fsv-in" class="fsv-input" maxlength="64" autocomplete="off" '
        + 'autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="輸入六碼">'
        + '<button id="m-fsv-use" class="fsv-b fsv-danger fsv-mini">搬過來</button></div>'
        + '</div>') : '')
      + '<div id="m-fsv-note" class="fsv-note"></div>';
  }

  // 產生轉移碼:上傳整包 → 顯示六碼 + 複製鈕
  // fetch 直接拋 TypeError＝連線根本沒建立(不是伺服器回錯)。最常見的是 DNS 過濾/廣告封鎖把
  //   catbox 整個域名擋掉 —— 那時瀏覽器只給一句 "Failed to fetch",玩家不會聯想到是自己開的 DNS
  //   (2026-08-05 玩家實測 AdGuard DNS 會擋,關掉就通)。
  function netErrMsg(e) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return '沒有網路連線。';
    if (e instanceof TypeError) return '連不上轉移服務，你的 DNS 或廣告封鎖可能把它擋掉了。';
    return null;
  }

  function doGenerate() {
    var btn = document.getElementById('m-fsv-gen');
    if (btn) { btn.disabled = true; btn.textContent = '上傳中…'; }
    note('上傳中…請不要關掉頁面。');
    uploadPack().then(function (code) {
      var box = document.getElementById('m-fsv-codebox'), el = document.getElementById('m-fsv-code');
      if (el) el.textContent = code;
      if (box) box.classList.add('show');
      note('✅ 到另一台裝置輸入這六碼就搬過去了（24 小時內有效）。');
    }).catch(function (e) {
      // 丟出來的 Error 自己就寫清楚是哪一步壞了(上傳失敗（500）/打包失敗：…)→ 直接用,不要再包一層
      note('❌ ' + (netErrMsg(e) || ((e && e.message || '產生轉移碼失敗') + '。'))
        + '\n可以改用上面的「匯出備份」存成檔案再自己傳過去。', true);
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = '🔑 產生轉移碼'; }
    });
  }

  // 輸入轉移碼:抓回來 → 走與檔案還原完全相同的驗證與確認流程
  function doUseCode() {
    var input = document.getElementById('m-fsv-in');
    var code = normalizeCode(input && input.value);
    if (!CODE_RE.test(code)) { note('❌ 請輸入六碼（英文小寫或數字）。', true); return; }
    var btn = document.getElementById('m-fsv-use');
    if (btn) btn.disabled = true;
    note('讀取中…');
    downloadByCode(code).then(function (text) {
      var v = validate(text);
      if (!v.ok) { note('❌ ' + v.err, true); return; }
      note('');
      confirmAndApply(v);
    }).catch(function (e) {
      // 🚨 只講「可能看錯」,不要自己拿相近字元重試——那可能抓到別人的存檔並覆蓋玩家進度
      if (e && e.message === 'NOTFOUND') note('❌ 找不到這組轉移碼。可能是打錯了（注意 0 和 o、1 和 l），或是已經超過 24 小時。', true);
      else note('❌ ' + (netErrMsg(e) || ((e && e.message || '讀取失敗') + '。'))
        + '\n可以改請對方用「匯出備份」存成檔案傳給你。', true);
    }).then(function () { if (btn) btn.disabled = false; });
  }
  function openModal() {
    if (!on()) return;
    buildModal();
    if (_layer) return;
    var m = document.getElementById('m-fsv-modal'); if (!m) return;
    document.getElementById('m-fsv-body').innerHTML = renderBody();
    var e1 = document.getElementById('m-fsv-exp');
    if (e1) e1.addEventListener('click', function () {
      doExport().then(function (b) { if (b) note('✅ 已匯出：' + b.fname); });
    });
    var e2 = document.getElementById('m-fsv-imp');
    if (e2) e2.addEventListener('click', startRestore);
    var e3 = document.getElementById('m-fsv-gen');
    if (e3) e3.addEventListener('click', doGenerate);
    var e4 = document.getElementById('m-fsv-copy');
    if (e4) e4.addEventListener('click', function () {
      var t = (document.getElementById('m-fsv-code') || {}).textContent || '';
      if (!t) return;
      var done = function () { note('✅ 已複製轉移碼 ' + t + '。'); };
      // navigator.clipboard 在 file:// 與部分手機瀏覽器不存在/被擋 → 退回選取整段讓玩家自己複製
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(done).catch(function () { selectCode(); });
      } else selectCode();
    });
    var e5 = document.getElementById('m-fsv-use');
    if (e5) e5.addEventListener('click', doUseCode);
    var e6 = document.getElementById('m-fsv-in');
    if (e6) e6.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') doUseCode(); });
    m.classList.add('open');
    _layer = window.AFK_UI ? AFK_UI.openLayer(hideModal) : null;
  }
  // 複製 API 不能用時的保底:把六碼選起來,玩家長按/Ctrl+C 就能自己複製
  function selectCode() {
    var el = document.getElementById('m-fsv-code');
    if (!el) return;
    try {
      var r = document.createRange(); r.selectNodeContents(el);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      note('請長按（或按 Ctrl+C）複製選取的六碼。');
    } catch (e) { note('請手動抄下上面的六碼。'); }
  }
  function hideModal() { var m = document.getElementById('m-fsv-modal'); if (m) m.classList.remove('open'); _layer = null; }
  function closeModal() { if (_layer && window.AFK_UI) AFK_UI.closeLayer(_layer); else hideModal(); }

  function buildModal() {
    injectCSS();
    if (document.getElementById('m-fsv-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'm-fsv-modal';
    modal.innerHTML = '<div id="m-fsv-card">'
      + '<div id="m-fsv-head"><span id="m-fsv-title">💾 完整資料備份與還原</span><button id="m-fsv-close" title="關閉">✕</button></div>'
      + '<div id="m-fsv-body"></div></div>';
    document.body.appendChild(modal);
    document.getElementById('m-fsv-close').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  }

  // Tailwind 是預建置的(動態拼沒出現過的 class 會安靜失效)→ 一律用自己的具名 class
  function injectCSS() {
    if (document.getElementById('m-fsv-style')) return;
    var s = document.createElement('style'); s.id = 'm-fsv-style';
    s.textContent = [
      '#m-fsv-modal{display:none;position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:1000;background:rgba(2,6,23,.82);align-items:flex-start;justify-content:center;padding:24px 12px;font-family:system-ui,"Segoe UI",sans-serif;}',
      '#m-fsv-modal.open{display:flex;}',
      '#m-fsv-card{background:#0f172a;border:1px solid #334155;border-radius:12px;max-width:520px;width:100%;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.6);}',
      '#m-fsv-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #334155;}',
      '#m-fsv-title{color:#fcd34d;font-weight:700;}',
      '#m-fsv-close{color:#94a3b8;background:none;border:0;font-size:18px;cursor:pointer;padding:2px 6px;}',
      '#m-fsv-body{padding:14px;overflow:auto;color:#e2e8f0;font-size:13px;line-height:1.7;}',
      '.fsv-sum{margin-bottom:6px;}',
      '.fsv-desc{color:#94a3b8;font-size:12px;margin-bottom:12px;}',
      '.fsv-btns{display:flex;flex-direction:column;gap:8px;}',
      '.fsv-b{border-radius:8px;padding:10px 12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid transparent;}',
      '.fsv-go{background:#0e7490;border-color:#0891b2;color:#cffafe;}',
      '.fsv-go:hover{background:#0891b2;}',
      '.fsv-danger{background:#7f1d1d;border-color:#b91c1c;color:#fecaca;}',
      '.fsv-danger:hover{background:#991b1b;}',
      '.fsv-sep{margin:16px 0 8px;padding-top:12px;border-top:1px solid #334155;color:#94a3b8;font-size:12px;}',
      '.fsv-mini{padding:8px 12px;font-size:13px;flex:0 0 auto;}',
      '.fsv-row{display:flex;gap:8px;}',
      // 六碼是「看著另一台螢幕打字」用的 → 等寬字＋拉開字距，讓 0/o、1/l 分得出來
      '.fsv-input{flex:1 1 auto;min-width:0;background:#020617;border:1px solid #475569;border-radius:8px;color:#e2e8f0;padding:10px 12px;font-size:18px;font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.18em;text-align:center;}',
      '.fsv-input:focus{outline:none;border-color:#0891b2;}',
      '.fsv-codebox{display:none;align-items:center;gap:10px;justify-content:center;background:#020617;border:1px solid #475569;border-radius:8px;padding:10px;}',
      '.fsv-codebox.show{display:flex;}',
      '.fsv-code{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:.22em;color:#fcd34d;user-select:all;}',
      '.fsv-note{margin-top:10px;font-size:12.5px;color:#a7f3d0;min-height:1em;}',
      '.fsv-note.fsv-bad{color:#fca5a5;}',
      '.fsv-warn{margin:0 0 12px;padding:8px 10px;border:1px solid #78350f;background:rgba(120,53,15,.28);border-radius:8px;color:#fcd34d;font-size:12px;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  function init() {
    window.AFK_SETTINGS = window.AFK_SETTINGS || { _items: [], add: function (it) { this._items.push(it); } };
    AFK_SETTINGS.add({ label: '💾 完整資料備份與還原', onClick: openModal });
    try { console.log('[AFK-fullsave] hooks OK'); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
