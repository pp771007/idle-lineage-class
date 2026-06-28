/** 遊戲核心資料庫 */
// 🏷️ 遊戲版本號（顯示於登入頁面下方·單一真相來源）：更新版本時只改這一行，登入頁面自動同步。
const GAME_VERSION = 'v2.4.0';
// ===== 💾 存檔壓縮（LZString compressToUTF16/decompressFromUTF16·MIT, Pieroxy）：localStorage 內部以 UTF-16 壓縮，省 ~89%，繞過 5MB 上限 =====
//  ⚠️ 只壓 localStorage（存檔位/倉庫/共用桶/_bak）；匯出檔維持明文 JSON（可攜·importSave 用 JSON.parse 驗證）。_lzGet 相容舊明文存檔（無 'LZ1:' 前綴→原樣回傳）。
var LZString = (function () {
  var f = String.fromCharCode;
  var LZString = {
    compressToUTF16: function (input) { if (input == null) return ""; return LZString._compress(input, 15, function (a) { return f(a + 32); }) + " "; },
    decompressFromUTF16: function (compressed) { if (compressed == null) return ""; if (compressed == "") return null; return LZString._decompress(compressed.length, 16384, function (index) { return compressed.charCodeAt(index) - 32; }); },
    _compress: function (uncompressed, bitsPerChar, getCharFromInt) {
      if (uncompressed == null) return "";
      var i, value, context_dictionary = {}, context_dictionaryToCreate = {}, context_c = "", context_wc = "", context_w = "", context_enlargeIn = 2, context_dictSize = 3, context_numBits = 2, context_data = [], context_data_val = 0, context_data_position = 0, ii;
      for (ii = 0; ii < uncompressed.length; ii += 1) {
        context_c = uncompressed.charAt(ii);
        if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) { context_dictionary[context_c] = context_dictSize++; context_dictionaryToCreate[context_c] = true; }
        context_wc = context_w + context_c;
        if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)) { context_w = context_wc; } else {
          if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
            if (context_w.charCodeAt(0) < 256) {
              for (i = 0; i < context_numBits; i++) { context_data_val = (context_data_val << 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else { context_data_position++; } }
              value = context_w.charCodeAt(0);
              for (i = 0; i < 8; i++) { context_data_val = (context_data_val << 1) | (value & 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else { context_data_position++; } value = value >> 1; }
            } else {
              value = 1;
              for (i = 0; i < context_numBits; i++) { context_data_val = (context_data_val << 1) | value; if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else { context_data_position++; } value = 0; }
              value = context_w.charCodeAt(0);
              for (i = 0; i < 16; i++) { context_data_val = (context_data_val << 1) | (value & 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else { context_data_position++; } value = value >> 1; }
            }
            context_enlargeIn--; if (context_enlargeIn == 0) { context_enlargeIn = Math.pow(2, context_numBits); context_numBits++; }
            delete context_dictionaryToCreate[context_w];
          } else {
            value = context_dictionary[context_w];
            for (i = 0; i < context_numBits; i++) { context_data_val = (context_data_val << 1) | (value & 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else { context_data_position++; } value = value >> 1; }
          }
          context_enlargeIn--; if (context_enlargeIn == 0) { context_enlargeIn = Math.pow(2, context_numBits); context_numBits++; }
          context_dictionary[context_wc] = context_dictSize++; context_w = String(context_c);
        }
      }
      if (context_w !== "") {
        if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
          if (context_w.charCodeAt(0) < 256) {
            for (i = 0; i < context_numBits; i++) { context_data_val = (context_data_val << 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else { context_data_position++; } }
            value = context_w.charCodeAt(0);
            for (i = 0; i < 8; i++) { context_data_val = (context_data_val << 1) | (value & 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else { context_data_position++; } value = value >> 1; }
          } else {
            value = 1;
            for (i = 0; i < context_numBits; i++) { context_data_val = (context_data_val << 1) | value; if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else { context_data_position++; } value = 0; }
            value = context_w.charCodeAt(0);
            for (i = 0; i < 16; i++) { context_data_val = (context_data_val << 1) | (value & 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else { context_data_position++; } value = value >> 1; }
          }
          context_enlargeIn--; if (context_enlargeIn == 0) { context_enlargeIn = Math.pow(2, context_numBits); context_numBits++; }
          delete context_dictionaryToCreate[context_w];
        } else {
          value = context_dictionary[context_w];
          for (i = 0; i < context_numBits; i++) { context_data_val = (context_data_val << 1) | (value & 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else { context_data_position++; } value = value >> 1; }
        }
        context_enlargeIn--; if (context_enlargeIn == 0) { context_enlargeIn = Math.pow(2, context_numBits); context_numBits++; }
      }
      value = 2;
      for (i = 0; i < context_numBits; i++) { context_data_val = (context_data_val << 1) | (value & 1); if (context_data_position == bitsPerChar - 1) { context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0; } else { context_data_position++; } value = value >> 1; }
      while (true) { context_data_val = (context_data_val << 1); if (context_data_position == bitsPerChar - 1) { context_data.push(getCharFromInt(context_data_val)); break; } else context_data_position++; }
      return context_data.join('');
    },
    _decompress: function (length, resetValue, getNextValue) {
      var dictionary = [], next, enlargeIn = 4, dictSize = 4, numBits = 3, entry = "", result = [], i, w, bits, resb, maxpower, power, c, data = { val: getNextValue(0), position: resetValue, index: 1 };
      for (i = 0; i < 3; i += 1) { dictionary[i] = i; }
      bits = 0; maxpower = Math.pow(2, 2); power = 1;
      while (power != maxpower) { resb = data.val & data.position; data.position >>= 1; if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); } bits |= (resb > 0 ? 1 : 0) * power; power <<= 1; }
      switch (next = bits) {
        case 0: bits = 0; maxpower = Math.pow(2, 8); power = 1; while (power != maxpower) { resb = data.val & data.position; data.position >>= 1; if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); } bits |= (resb > 0 ? 1 : 0) * power; power <<= 1; } c = f(bits); break;
        case 1: bits = 0; maxpower = Math.pow(2, 16); power = 1; while (power != maxpower) { resb = data.val & data.position; data.position >>= 1; if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); } bits |= (resb > 0 ? 1 : 0) * power; power <<= 1; } c = f(bits); break;
        case 2: return "";
      }
      dictionary[3] = c; w = c; result.push(c);
      while (true) {
        if (data.index > length) { return ""; }
        bits = 0; maxpower = Math.pow(2, numBits); power = 1;
        while (power != maxpower) { resb = data.val & data.position; data.position >>= 1; if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); } bits |= (resb > 0 ? 1 : 0) * power; power <<= 1; }
        switch (c = bits) {
          case 0: bits = 0; maxpower = Math.pow(2, 8); power = 1; while (power != maxpower) { resb = data.val & data.position; data.position >>= 1; if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); } bits |= (resb > 0 ? 1 : 0) * power; power <<= 1; } dictionary[dictSize++] = f(bits); c = dictSize - 1; enlargeIn--; break;
          case 1: bits = 0; maxpower = Math.pow(2, 16); power = 1; while (power != maxpower) { resb = data.val & data.position; data.position >>= 1; if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); } bits |= (resb > 0 ? 1 : 0) * power; power <<= 1; } dictionary[dictSize++] = f(bits); c = dictSize - 1; enlargeIn--; break;
          case 2: return result.join('');
        }
        if (enlargeIn == 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
        if (dictionary[c]) { entry = dictionary[c]; } else { if (c === dictSize) { entry = w + w.charAt(0); } else { return null; } }
        result.push(entry);
        dictionary[dictSize++] = w + entry.charAt(0); enlargeIn--; w = entry;
        if (enlargeIn == 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
      }
    }
  };
  return LZString;
})();
// 壓縮寫入：把 JSON 字串以 'LZ1:'+UTF16 壓縮存入；壓縮失敗或 quota 時退回明文（再不行則警告）
function _lzSet(key, jsonStr) {
  try { localStorage.setItem(key, 'LZ1:' + LZString.compressToUTF16(jsonStr)); return true; }
  catch (e) { try { localStorage.setItem(key, jsonStr); return true; } catch (e2) { if (typeof logSys === 'function') logSys('<span class="text-red-400 font-bold">⚠ 瀏覽器儲存空間不足，存檔可能未完整寫入。</span>'); return false; } }
}
// 解壓讀取：'LZ1:' 前綴→解壓；否則原樣回傳（相容舊明文存檔）。回傳 JSON 字串或 null（key 不存在）
function _lzGet(key) {
  var raw = localStorage.getItem(key); if (raw == null) return null;
  if (raw.slice(0, 4) === 'LZ1:') { try { return LZString.decompressFromUTF16(raw.slice(4)); } catch (e) { return null; } }
  return raw;
}

// 🎲 種子型亂數（決定論 PRNG·xmur3→mulberry32）：相同的字串輸入永遠得到同一個 [0,1) 值。
//    用途＝把「強化成敗」改成由存檔內種子決定，讓讀檔/匯入舊檔回到強化前也算出完全相同的結果（杜絕 save/load 刷強化值）。
function _seedHash(str) {
  str = String(str); let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}
function _seededFloat(str) {
  let a = (_seedHash(str) + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
// 強化專用決定論亂數：由（角色 player.enSeed＋裝備 uid＋當前強化值[＋標籤]）決定 0~1 的值。
// 三項輸入全在存檔內 → 匯出/讀檔/匯入舊檔回到強化前，輸入全部還原 → 算出一模一樣的成敗，save/load 刷不到。
function enRandomUid(itUid, en, tag) {
  let seed = (typeof player !== 'undefined' && player && player.enSeed) || 'nseed';
  return _seededFloat(seed + '|' + itUid + '|' + (Number(en) || 0) + '|' + (tag || ''));
}
function enRandom(item, tag) { return enRandomUid(item && item.uid, item && item.en, tag); }

// 🛡️ 存檔簽章（防隨手竄改）：在 LZ 壓縮層外再包一層 'SIG1:'+簽章+':'+payload。
//    注意：鹽值內嵌於客戶端原始碼，故僅能擋「解壓→改數值→重壓」這類隨手竄改；擋不了讀原始碼後自行重算簽章的人（純前端無法做到，與整體限制一致）。
const _SAVE_SALT = 'fb5#9c3a7e1d-save-integrity-salt-do-not-edit#a1b2c3';
function _signSave(s) {
  let a = _seedHash(_SAVE_SALT + '::' + s);
  let b = _seedHash(s + '::' + _SAVE_SALT + '::' + a);
  return (a >>> 0).toString(36) + '.' + (b >>> 0).toString(36) + '.' + (s.length).toString(36);
}
// 包簽章：payload 字串 → 'SIG1:'+sig+':'+payload（sig 只含 0-9a-z 與 '.'，不含 ':'，故解析時取第一個 ':' 切開）
function _saveWrap(payloadStr) { return 'SIG1:' + _signSave(payloadStr) + ':' + payloadStr; }
// 解簽章：回傳 {payload, signed, ok}。未簽章（舊檔/舊匯出明文）→ signed:false、ok:true、payload 原樣（向後相容）
function _saveUnwrap(raw) {
  if (raw == null) return { payload: null, signed: false, ok: true };
  if (String(raw).slice(0, 5) === 'SIG1:') {
    let rest = raw.slice(5), i = rest.indexOf(':');
    if (i < 0) return { payload: raw, signed: true, ok: false };   // 🛡️ 有 SIG1 前綴卻缺分隔符＝格式毀損/被竄改：視為簽章不符（交由呼叫端拒絕）
    let sig = rest.slice(0, i), payload = rest.slice(i + 1);
    return { payload: payload, signed: true, ok: (_signSave(payload) === sig) };
  }
  return { payload: raw, signed: false, ok: true };
}
const EXP_T = [0, 125, 175, 200, 250, 546, 1105, 1695, 2465, 3439, 4641, 6095, 7825, 9855, 12209, 14911, 17985, 21455, 25345, 29679, 34481, 40033, 45585, 51935, 58849, 66351, 74465, 83215, 92625, 102719, 113521, 125055, 137345, 150415, 164289, 178991, 194545, 210975, 228305, 246559, 265761, 285935, 307105, 329817, 352529, 729360, 1508416, 3495263, 9912189, 36065092];
function getExpReq(lv) { return lv >= 100 ? Infinity : (lv >= 49 ? 36065092 : EXP_T[lv]); }
// 高等級打怪經驗衰減（依玩家當前等級）：50~69 ×1/2、70~74 ×1/4、75~78 ×1/8、79 ×1/16、
// 80~81 ×1/32、82~83 ×1/64、84~85 ×1/128、86 ×1/256、87~89 ×1/512、90~99 ×1/1024、100滿等不獲得
function getExpGainMult(lv) {
    if (lv >= 100) return 0;
    if (lv >= 90)  return 1/1024;
    if (lv >= 87)  return 1/512;   // 87~89
    if (lv >= 86)  return 1/256;   // 86
    if (lv >= 84)  return 1/128;   // 84~85
    if (lv >= 82)  return 1/64;    // 82~83
    if (lv >= 80)  return 1/32;    // 80~81
    if (lv >= 79)  return 1/16;    // 79
    if (lv >= 75)  return 1/8;     // 75~78
    if (lv >= 70)  return 1/4;     // 70~74
    if (lv >= 50)  return 1/2;     // 50~69
    return 1;
}

const DB = {
        items: {
        "wpn_alien": { n: "亞連", type: "wpn", dmgS: 4, dmgL: 4, hit: 2, spd: 1.3, req: "all", safe: 6, p: 14, gachaWeight: 100 },
        "wpn_katana": { n: "武士刀", type: "wpn", dmgS: 10, dmgL: 12, hit: 1, spd: 1.1, req: "knight,elf", safe: 6, p: 28200, gachaWeight: 10 },
        "wpn_longsword": { n: "長劍", type: "wpn", dmgS: 8, dmgL: 12, hit: 0, spd: 1.1, req: "knight,elf", safe: 6, p: 4200, gachaWeight: 50 },
        "wpn_1": { n: "斧", type: "wpn", dmgS: 3, dmgL: 5, hit: 0, spd: 1.2, req: "all", safe: 6, p: 28, gachaWeight: 100 },
        "wpn_2hsword": { n: "雙手劍", type: "wpn", w2h: true,dmgS: 14, dmgL: 16, hit: 0, spd: 0.9, req: "knight", safe: 6, p: 25200, eff: "cleave", gachaWeight: 10 },
        "wpn_official_2h": { n: "武官雙手劍", type: "wpn", w2h: true, dmgS: 19, dmgL: 23, hit: 1, dmgBonus: 2, spd: 0.9, req: "knight", safe: 6, p: 95940, eff: "cleave", gachaWeight: 10 },   // 🔧 非傳說：權重 10（同武官頭盔/護鎧），避免潘朵拉抽獎誤判為「傳說大獎(權重1)」
        "wpn_dragonslayer": { n: "屠龍劍", type: "wpn", w2h: true, dmgS: 28, dmgL: 35, hit: 2, dmgBonus: 9, spd: 0.9, req: "knight", safe: 6, p: 300000, eff: "cleave", dragonStrike: 12, legend: true, gachaWeight: 1, d: "傳說中為屠龍而鍛造的雙手巨劍，劍身中沉眠著龍魂，一旦甦醒便嗜血咆哮。<br>龍的一擊：發動一般攻擊時，固定機率對場上所有敵人造成無視防禦力的無屬性傷害。" },   // 🔧 卡瑞 100% 掉落；潘朵拉抽不到
        "wpn_vander_sword": { n: "騎士范德之劍", type: "wpn", w2h: true, dmgS: 22, dmgL: 34, hit: 5, dmgBonus: 6, spd: 0.9, req: "knight", safe: 6, p: 210000, eff: "cleave", str: 1, vanderStunHit: true, legend: true, gachaWeight: 1, d: "闇黑騎士范德生前佩持的雙手巨劍，劍上仍纏著未散的殺意。<br>施展 衝擊之暈 時，近距離命中 +1。" },
        "wpn_2": { n: "釘錘", type: "wpn", dmgS: 6, dmgL: 8, hit: 0, spd: 1.3, req: "all", safe: 6, p: 133, gachaWeight: 100 },
        "wpn_3": { n: "弓", type: "wpn", isBow: true, ranged: true, rapidfire: 20, dmgS: 2, dmgL: 2, hit: 0, spd: 1.0, req: "all", safe: 6, p: 70, gachaWeight: 100 },
        "wpn_4": { n: "矛", type: "wpn", dmgS: 6, dmgL: 8, hit: 0, spd: 1.2, req: "all", safe: 6, p: 120, gachaWeight: 100 },
        "wpn_battleaxe": { n: "戰斧", type: "wpn", w2h: true, dmgS: 18, dmgL: 18, hit: 0, spd: 1.0, req: "knight,elf", safe: 6, p: 980, gachaWeight: 100, eff: "crush" },
        "wpn_5": { n: "箭", type: "wpn", isArrow: true, dmgS: 6, dmgL: 5, hit: 0, p: 0, gachaWeight: 0 },
        "wpn_6": { n: "巴迪須", type: "wpn", w2h: true, dmgS: 4, dmgL: 6, hit: 0, spd: 1.0, req: "knight", safe: 6, p: 56, gachaWeight: 100, eff: "pierce", pierceChance: 35 },
        "wpn_7": { n: "柴刀", type: "wpn", w2h: true, dmgS: 4, dmgL: 11, hit: 0, spd: 1.0, req: "knight", safe: 6, p: 252, gachaWeight: 100, eff: "pierce", pierceChance: 35 },
        "wpn_elfbow": { n: "精靈弓", type: "wpn", isBow: true, ranged: true, rapidfire: 45, dmgS: 2, dmgL: 2, hit: 0, dmgBonus: 1, spd: 1.0, req: "all", safe: 6, p: 620, gachaWeight: 100 },
        "wpn_8": { n: "歐西斯弓", type: "wpn", isBow: true, ranged: true, rapidfire: 10, dmgS: 2, dmgL: 2, hit: 0, dmgBonus: -1, spd: 1.0, req: "all", safe: 6, p: 30, gachaWeight: 100 },
        "wpn_9": { n: "闊劍", type: "wpn", dmgS: 4, dmgL: 6, hit: 0, spd: 1.1, req: "all", safe: 6, p: 490, gachaWeight: 100 },
        "wpn_10": { n: "木棒", type: "wpn", dmgS: 6, dmgL: 3, hit: 0, spd: 1.3, req: "all", safe: 6, p: 42, gachaWeight: 100 },
        "wpn_dagger2": { n: "精靈匕首", type: "wpn", dmgS: 4, dmgL: 3, hit: 2, spd: 0.8, req: "all", safe: 6, p: 42, unBonus: true, gachaWeight: 100 },
        "wpn_dagger1": { n: "歐西斯匕首", type: "wpn", dmgS: 2, dmgL: 3, hit: 2, spd: 0.8, req: "all", safe: 6, p: 10, gachaWeight: 100 },
        "wpn_11": { n: "匕首", type: "wpn", dmgS: 4, dmgL: 2, hit: 2, spd: 0.8, req: "all", safe: 6, p: 10, gachaWeight: 100 },
        "wpn_12": { n: "貝卡合金", type: "wpn", w2h: true, dmgS: 11, dmgL: 11, hit: 0, spd: 1.0, req: "knight", safe: 6, p: 22400, eff: "pierce", pierceChance: 100, twohanded: true, gachaWeight: 10 },
        "wpn_halberd": { n: "法丘", type: "wpn", dmgS: 10, dmgL: 10, hit: 0, spd: 1.0, req: "knight,elf", safe: 6, p: 11200, unBonus: true, gachaWeight: 50, eff: "pierce", pierceChance: 40 },
        "wpn_13": { n: "弗萊爾", type: "wpn", dmgS: 6, dmgL: 4, hit: 0, spd: 1.3, req: "all", safe: 6, p: 56, gachaWeight: 100 },
        "wpn_14": { n: "闊矛", type: "wpn", w2h: true, dmgS: 6, dmgL: 10, hit: 0, spd: 1.0, req: "knight,elf", safe: 6, p: 42, gachaWeight: 100, eff: "pierce", pierceChance: 60 },
        "wpn_15": { n: "吉薩", type: "wpn", w2h: true, dmgS: 6, dmgL: 8, hit: 0, spd: 1.0, req: "knight,elf", safe: 6, p: 280, gachaWeight: 100, eff: "pierce", pierceChance: 70 },
        "wpn_16": { n: "戟", type: "wpn", w2h: true, dmgS: 10, dmgL: 6, hit: 0, spd: 1.0, req: "knight", safe: 6, p: 2800, gachaWeight: 50, eff: "pierce", pierceChance: 60 },
        "wpn_17": { n: "槍", type: "wpn", w2h: true, dmgS: 6, dmgL: 8, hit: 0, spd: 1.0, req: "knight", safe: 6, p: 84, gachaWeight: 100 },
        "wpn_18": { n: "露西錘", type: "wpn", w2h: true, dmgS: 9, dmgL: 11, hit: 0, spd: 1.0, req: "knight", safe: 6, p: 14000, gachaWeight: 30, eff: "pierce", pierceChance: 50 },
        "wpn_19": { n: "戰錘", type: "wpn", w2h: true, dmgS: 17, dmgL: 19, hit: 0, spd: 1.1, req: "knight,elf", safe: 6, p: 1400, gachaWeight: 100, eff: "crush" },
        "wpn_20": { n: "流星錘", type: "wpn", dmgS: 9, dmgL: 10, hit: 0, spd: 1.3, req: "knight,elf", safe: 6, p: 4900, gachaWeight: 50 },
        "wpn_21": { n: "帕提森", type: "wpn", dmgS: 6, dmgL: 6, hit: 0, spd: 1.2, req: "knight,elf", safe: 6, p: 700, gachaWeight: 100 },
        "wpn_scimitar": { n: "彎刀", type: "wpn", dmgS: 8, dmgL: 8, hit: 0, spd: 1.1, req: "all", safe: 6, p: 1400, gachaWeight: 100 },
        "wpn_22": { n: "銀箭", type: "wpn", isArrow: true, dmgS: 7, dmgL: 6, hit: 0, p: 0, unBonus: true, gachaWeight: 0 },
        "wpn_23": { n: "侏儒鐵斧", type: "wpn", w2h: true, dmgS: 18, dmgL: 24, hit: 0, spd: 1.0, req: "knight", safe: 6, p: 1376, gachaWeight: 100, eff: "crush" },
        "wpn_24": { n: "精靈之矛", type: "wpn", dmgS: 7, dmgL: 8, hit: 0, spd: 1.2, req: "all", safe: 6, p: 1180, unBonus: true, gachaWeight: 100 },
        "wpn_25": { n: "歐西斯之矛", type: "wpn", dmgS: 4, dmgL: 6, hit: 0, spd: 1.2, req: "all", safe: 6, p: 16, gachaWeight: 100 },
        "wpn_26": { n: "小侏儒短劍", type: "wpn", dmgS: 7, dmgL: 8, hit: 0, spd: 1.0, req: "all", safe: 6, p: 58, gachaWeight: 100 },
        "wpn_elfsword": { n: "精靈短劍", type: "wpn", dmgS: 8, dmgL: 8, hit: 0, spd: 1.0, req: "all", safe: 6, p: 3680, unBonus: true, gachaWeight: 100 },
        "wpn_27": { n: "歐西斯短劍", type: "wpn", dmgS: 4, dmgL: 4, hit: 0, spd: 1.0, req: "all", safe: 6, p: 10, gachaWeight: 100 },
        "wpn_shortsword": { n: "短劍", type: "wpn", dmgS: 6, dmgL: 8, hit: 0, spd: 1.0, req: "all", safe: 6, p: 140, gachaWeight: 100 },
        "wpn_28": { n: "三叉戟", type: "wpn", dmgS: 5, dmgL: 4, hit: 0, spd: 1.2, req: "knight,elf", safe: 6, p: 35, gachaWeight: 100 },
        "wpn_siruge": { n: "瑟魯基之劍", type: "wpn", dmgS: 16, dmgL: 10, hit: 2, spd: 1.1, req: "knight", safe: 6, p: 41196, gachaWeight: 10 },
        "wpn_29": { n: "尤米弓", type: "wpn", isBow: true, ranged: true, rapidfire: 55, dmgS: 3, dmgL: 3, hit: 0, dmgBonus: 3, spd: 1.0, req: "elf", safe: 6, p: 32680, gachaWeight: 10 },
        "wpn_shortbow": { n: "短弓", type: "wpn", isBow: true, ranged: true, rapidfire: 10, dmgS: 2, dmgL: 2, hit: 0, dmgBonus: -1, spd: 1.0, req: "all", safe: 6, p: 10, gachaWeight: 100 },
        "wpn_30": { n: "米索莉箭", type: "wpn", isArrow: true, dmgS: 10, dmgL: 9, hit: 0, p: 1, unBonus: true, gachaWeight: 0 },
        "wpn_31": { n: "十字弓", type: "wpn", isBow: true, ranged: true, rapidfire: 50, dmgS: 3, dmgL: 2, hit: 3, dmgBonus: 2, spd: 1.0, req: "knight,elf", safe: 6, p: 59400, gachaWeight: 10 },
        "wpn_32": { n: "獵人之弓", type: "wpn", isBow: true, ranged: true, rapidfire: 30, dmgS: 2, dmgL: 2, hit: 5, dmgBonus: 1, spd: 1.0, req: "all", safe: 6, p: 11000, gachaWeight: 20 },
		"wpn_flaming_angel": { n: "熾炎天使弓", type: "wpn", isBow: true, ranged: true, rapidfire: 40, dmgS: 3, dmgL: 3, hit: 3, dmgBonus: 4, spd: 1.0, req: "elf", safe: 6, p: 137300, w2h: true, eff: "moonburst", legend: true, gachaWeight: 1 },   // 🔧 潘朵拉抽不到；取得來源：羅賓孫製作、死神(0.001%)、惡魔(0.5%)
        "wpn_redknight": { n: "紅騎士之劍", type: "wpn", dmgS: 8, dmgL: 12, hit: 0, spd: 1.1, req: "all", safe: 6, p: 2400, str: 1, gachaWeight: 20 },
        "wpn_invader": { n: "侵略者之劍", type: "wpn", dmgS: 9, dmgL: 11, hit: 0, spd: 1.1, req: "all", safe: 6, p: 3500, gachaWeight: 100 },
        "wpn_33": { n: "骰子匕首", type: "wpn", dmgS: 3, dmgL: 3, hit: 0, spd: 0.9, eff: "dice_death", req: "all", safe: 6, p: 444, gachaWeight: 10 },
        "wpn_damascus": { n: "大馬士革刀", type: "wpn", dmgS: 10, dmgL: 11, hit: 0, spd: 1.1, req: "knight,elf", safe: 6, p: 22000, eff: "crush", gachaWeight: 20 },   // 🔧 特效由反擊改為重擊（粉碎；粉碎消磨硬皮 -20）
        "wpn_34": { n: "短劍的劍身", type: "wpn", dmgS: 2, dmgL: 2, hit: 0, spd: 1.0, req: "all", safe: 6, p: 320, unBonus: true, gachaWeight: 100 },
        "wpn_35": { n: "長劍的劍身", type: "wpn", dmgS: 3, dmgL: 3, hit: 0, spd: 1.1, req: "all", safe: 6, p: 360, unBonus: true, gachaWeight: 100 },
        "wpn_36": { n: "奧里哈魯根的劍身", type: "wpn", dmgS: 4, dmgL: 4, hit: 0, spd: 1.1, req: "all", safe: 6, p: 960, unBonus: true, gachaWeight: 100 },
        "wpn_rapier": { n: "細劍", type: "wpn", dmgS: 11, dmgL: 6, hit: 0, spd: 1.1, req: "knight,elf", safe: 6, p: 5230, unBonus: true, gachaWeight: 20 },
        "wpn_mailbreaker": { n: "鎖子甲破壞者", type: "wpn", dmgS: 4, dmgL: 5, hit: 10, spd: 1.1, req: "all", safe: 6, p: 12000, unBonus: true, gachaWeight: 10 },
        "wpn_silversword": { n: "銀長劍", type: "wpn", dmgS: 8, dmgL: 12, hit: 0, spd: 1.1, req: "all", safe: 6, p: 18200, unBonus: true, gachaWeight: 50 },
        "wpn_37": { n: "銀劍", type: "wpn", dmgS: 7, dmgL: 7, hit: 0, spd: 1.1, req: "all", safe: 6, p: 2520, unBonus: true, gachaWeight: 70 },
        "wpn_oakwand": { n: "橡木魔法杖", type: "wpn", dmgS: 3, dmgL: 4, hit: 0, spd: 1.0, req: "all", safe: 6, p: 330, gachaWeight: 100, extraMpPerEn: 1 },
        "wpn_38": { n: "美基魔法杖", type: "wpn", dmgS: 4, dmgL: 5, hit: 0, spd: 1.0, req: "mage", safe: 6, p: 3500, gachaWeight: 100, extraMpPerEn: 1 },
        "wpn_witchwand": { n: "巫術魔法杖", type: "wpn", dmgS: 2, dmgL: 3, hit: 0, mdmg: 1, spd: 1.0, req: "mage", safe: 6, p: 12600, gachaWeight: 50, extraMpPerEn: 1 },
        "wpn_strwand": { n: "力量魔法杖", type: "wpn", dmgS: 9, dmgL: 9, hit: 0, dmgBonus: 3, mdmg: -2, str: 3, spd: 1.0, req: "mage", safe: 6, p: 71500, meleeHitPerEn: 1, eff: "magicstrike", gachaWeight: 10 },
        "wpn_manawand": { n: "瑪那魔杖", type: "wpn", dmgS: 3, dmgL: 3, hit: -1, spd: 1.0, req: "mage", safe: 6, p: 10000, eff: "mp_drain", gachaWeight: 20 },
        "wpn_crystalwand": { n: "水晶魔杖", type: "wpn", dmgS: 1, dmgL: 1, hit: 0, spd: 1.0, req: "mage", safe: 6, p: 10000, mpR: 10, mpROverSafe: 2, gachaWeight: 20 },
        "wpn_powerless_baless": { n: "失去魔力的巴列斯魔杖", type: "wpn", dmgS: 1, dmgL: 1, hit: 0, dmgBonus: 0, spd: 1.0, req: "all", safe: 0, p: 0, gachaWeight: 0, d: "魔力早已枯竭的古老魔杖，杖芯卻仍隱隱悸動。攜帶它並使用『靈魂之球』，或許能喚回沉睡的力量……（可販售，售價 0）" },   // 🔧 巴列斯任務武器
        "wpn_baless": { n: "巴列斯魔杖", type: "wpn", dmgS: 2, dmgL: 3, hit: 0, dmgBonus: 0, mdmg: 2, spd: 1.0, req: "mage", safe: 0, p: 250000, mpR: 10, mpROverSafe: 2, legend: true, gachaWeight: 1, d: "重獲魔力的傳說魔杖，杖身蘊含撼動萬物的共鳴之力。" },   // 🏅 傳說武器（共鳴：見 WAND_LIGHTARROW_IDS）；🔧 安定值0：+0 為 MP自然恢復10，每強化+1再+2（10/12/14…）
        "wpn_39": { n: "潘的角", type: "wpn", dmgS: 3, dmgL: 4, hit: 0, spd: 1.2, req: "all", safe: 6, p: 10, gachaWeight: 100 },
        "wpn_40": { n: "覆上米索莉的角", type: "wpn", dmgS: 4, dmgL: 4, hit: 0, spd: 1.2, req: "all", safe: 6, p: 178, unBonus: true, gachaWeight: 100 },
        "wpn_41": { n: "覆上奧里哈魯根的角", type: "wpn", dmgS: 7, dmgL: 8, hit: 0, spd: 1.2, req: "all", safe: 6, p: 1430, unBonus: true, gachaWeight: 100 },
        "wpn_giantaxe": { n: "巨斧", type: "wpn", w2h: true, dmgS: 20, dmgL: 26, hit: 0, spd: 1.0, req: "knight", safe: 6, p: 18200, gachaWeight: 50, eff: "crush" },
        "wpn_berserker": { n: "狂戰士斧", type: "wpn", w2h: true, dmgS: 19, dmgL: 19, hit: 0, spd: 0.8, req: "knight", safe: 6, p: 13520, gachaWeight: 10, eff: "crush" },
		"wpn_silveraxe": { n: "銀斧", type: "wpn", w2h: true, dmgS: 17, dmgL: 24, hit: 0, spd: 1.0, req: "knight", safe: 6, p: 11200, unBonus: true, gachaWeight: 20, eff: "crush" },
        // ===== 黑暗妖精武器：鋼爪（雙手，連擊） =====
        "wpn_claw_bronze":   { n: "青銅鋼爪", type: "wpn", w2h: true, dmgS: 8,  dmgL: 7,  hit: 2, spd: 0.9, req: "dark", safe: 6, p: 250,   eff: "combo", gachaWeight: 100 },
        "wpn_claw_steel":    { n: "鋼鐵鋼爪", type: "wpn", w2h: true, dmgS: 10, dmgL: 8,  hit: 1, spd: 0.9, req: "dark", safe: 6, p: 500,   eff: "combo", gachaWeight: 100 },
        "wpn_claw_shadow":   { n: "暗影鋼爪", type: "wpn", w2h: true, dmgS: 12, dmgL: 10, hit: 1, spd: 0.9, req: "dark", safe: 6, p: 35000, eff: "combo", gachaWeight: 50 },
        "wpn_claw_silver":   { n: "銀光鋼爪", type: "wpn", w2h: true, dmgS: 13, dmgL: 10, hit: 0, dmgBonus: 1, spd: 0.9, req: "dark", safe: 6, p: 3800,  eff: "combo", unBonus: true, gachaWeight: 50 },
        "wpn_claw_dark":     { n: "黑暗鋼爪", type: "wpn", w2h: true, dmgS: 14, dmgL: 11, hit: 0, dmgBonus: 2, spd: 0.9, req: "dark", safe: 6, p: 5000,  eff: "combo", gachaWeight: 50 },
        "wpn_claw_gloom":    { n: "幽暗鋼爪", type: "wpn", w2h: true, dmgS: 17, dmgL: 15, hit: 0, dmgBonus: 3, spd: 0.9, req: "dark", safe: 6, p: 36000, eff: "combo", gachaWeight: 30 },
        "wpn_claw_damascus": { n: "大馬士革鋼爪", type: "wpn", w2h: true, dmgS: 17, dmgL: 13, hit: 0, spd: 0.9, req: "dark", safe: 6, p: 48000, eff: "combo", hardWear: 1, gachaWeight: 50 },
        "wpn_claw_abyss":    { n: "暗黑鋼爪", type: "wpn", w2h: true, dmgS: 22, dmgL: 18, hit: 4, dmgBonus: 5, spd: 0.9, req: "dark", safe: 6, p: 10000, eff: "combo", gachaWeight: 5 },
        // ===== 魔獸軍王巴蘭卡：雙爪（鋼爪類，連擊） =====
        "wpn_baranka_claw":      { n: "魔獸軍王之爪", type: "wpn", w2h: true, dmgS: 12, dmgL: 12, hit: 0, dmgBonus: 2, spd: 0.8, req: "dark", safe: 6, p: 25000,  eff: "combo", gachaWeight: 10 },
        "wpn_baranka_steelclaw": { n: "巴蘭卡鋼爪",   type: "wpn", w2h: true, dmgS: 18, dmgL: 18, hit: 0, dmgBonus: 8, spd: 0.7, req: "dark", safe: 6, p: 125000, eff: "combo", legend: true, gachaWeight: 1 },
        // ===== 傳說單手劍：附帶魔法施放特效（spellProc，不需學會技能、必中、受魔法傷害影響） =====
        "wpn_dk_flameblade": { n: "死亡騎士的烈炎之劍", type: "wpn", dmgS: 16, dmgL: 10, hit: 5, dmgBonus: 2, spd: 1.0, req: "knight", safe: 6, p: 152000, legend: true, gachaWeight: 1, spellProc: { skn: "地獄火", dice: [1, 60], ele: "fire", aoe: true }, procRateBase: 3, procRatePerEn: 1, d: "死亡騎士緊握至死的劍，劍刃終年燃著不滅的地獄業火。<br>3%機率額外施放地獄火，每+1發動機率增加1%。地獄火：對敵方全體造成相當於裂炎術的火屬性魔法傷害。" },
        "wpn_kurt_sword":    { n: "克特之劍", type: "wpn", dmgS: 15, dmgL: 11, hit: 9, dmgBonus: 5, spd: 1.0, req: "knight,elf", safe: 6, p: 152000, legend: true, gachaWeight: 1, spellProc: { skn: "極道落雷", dice: [6, 8], ele: "wind" }, procRateBase: 15, procRatePerEn: 1, d: "克特之劍，劍鋒間遊走著被馴服的雷霆。<br>15%機率額外施放極道落雷，每+1發動機率增加1%。" },
        // ===== 軍王之室：掉落裝備 =====
        "wpn_assassin_mark": { n: "暗殺軍王之痕", type: "wpn", w2h: true, dmgS: 13, dmgL: 13, hit: 0, dmgBonus: 2, spd: 0.7, req: "dark", safe: 6, p: 25000, eff: "combo", gachaWeight: 10 },   // 雙刀・連擊
        "wpn_priest_wand":   { n: "神官魔杖", type: "wpn", w2h: true, dmgS: 9, dmgL: 9, hit: 0, spd: 1.0, req: "mage", safe: 6, p: 13340, unBonus: true, eff: "magicburst", gachaWeight: 10, d: "神官祈禱經年的法杖，能將信仰化為爆裂的魔力。<br>魔爆：施放單體傷害魔法時 智力/100、全體傷害魔法時 智力/60 機率引發魔法能力爆炸，對所有敵人額外造成該次魔法傷害 30% 的無屬性傷害。" },
        "wpn_laia_wand":     { n: "蕾雅魔杖", type: "wpn", dmgS: 1, dmgL: 1, hit: -3, dmgBonus: 0, mdmg: -2, spd: 1.0, req: "mage", safe: 6, p: 23340, legend: true, gachaWeight: 10, meleeHitSpell: { skn: "冰裂術", dice: [6, 10], ele: "water", freezePbase: 200, shatter: 100 }, d: "冰之女王蕾雅愛用的魔杖，杖尖凝結著永不消融的寒霜。<br>一般攻擊命中時觸發冰裂術：以法師8階法術公式造成 6D10×(1+強化/10) 水屬性魔法傷害（受魔法傷害與法術階級係數影響），有機率冰凍目標；對冰凍目標額外造成 100 水屬性傷害並解除其冰凍。" },
        "shd_priest_book":   { n: "神官魔法書", type: "arm", slot: "shield", ac: 3, mmp: 50, mpR: 3, req: "mage", safe: 6, p: 93000, gachaWeight: 5 },
        "amr_laia_robe":     { n: "蕾雅長袍", type: "arm", slot: "armor", ac: 2, mmp: 100, req: "mage", safe: 4, p: 58000, gachaWeight: 1 },
        "acc_necro_king_ring": { n: "冥法軍王之戒", legend: true, type: "acc", slot: "amulet", ac: 0, cha: 3, req: "mage,elf", safe: 0, p: 193000, gachaWeight: 1 },
        "acc_laia_amulet":   { n: "蕾雅項鍊", legend: true, type: "acc", slot: "amulet", ac: 0, con: -2, int: 1, wis: 1, req: "mage", safe: 0, p: 100000, gachaWeight: 1 },
        "acc_darkmage_amulet": { n: "黑法師項鍊", type: "acc", slot: "amulet", ac: 0, con: -1, int: 2, req: "mage", safe: 0, p: 100000, gachaWeight: 1 },
        "acc_summoner_amulet": { n: "喚獸師項鍊", type: "acc", slot: "amulet", ac: 0, wis: -1, cha: 2, req: "mage", safe: 0, p: 100000, gachaWeight: 1 },
        "acc_law_king_chain": { n: "法令軍王之鍊", legend: true, type: "acc", slot: "amulet", ac: 0, mmp: 15, mpR: 5, req: "mage,elf", safe: 0, p: 100000, gachaWeight: 1 },
        "acc_laia_ring":     { n: "蕾雅戒指", legend: true, type: "acc", slot: "ring", ac: 5, req: "all", safe: 0, p: 250000, gachaWeight: 1, stunResist: 5, d: "冰之女王蕾雅指間的戒指，冷冽之氣令神智不致動搖。<br>5%機率抵抗暈眩。" },
        "acc_orin_amulet": { n: "歐林的項鍊", legend: true, type: "acc", slot: "amulet", ac: 0, req: "all", safe: 0, p: 100000, gachaWeight: 1, set: "orin", d: "歐林珍藏的項鍊，與西瑪戒指本是一對，分離已久。<br><span class='text-amber-300'>【歐林西瑪套裝】歐林的項鍊＋西瑪戒指 同時裝備：AC-5、HP+50、力量／敏捷／體質／智力／精神／魅力 各+1。</span>" },
        "acc_sima_ring":   { n: "西瑪戒指", legend: true, type: "acc", slot: "ring", ac: 0, req: "all", safe: 0, p: 100000, gachaWeight: 1, set: "orin", d: "刻著西瑪之名的古老戒指，與歐林的項鍊遙相呼應。<br><span class='text-amber-300'>【歐林西瑪套裝】歐林的項鍊＋西瑪戒指 同時裝備：AC-5、HP+50、力量／敏捷／體質／智力／精神／魅力 各+1。</span>" },
        "hlm_icequeen_charm": { n: "冰之女王魅力頭飾", legend: true, type: "arm", slot: "helm",  ac: 3, req: "royal", reqAvatar: "公主", safe: 4, p: 126000, gachaWeight: 1, set: "icequeen_charm", d: "冰之女王魅力套裝之一（公主限定），頭飾上的冰晶折射出懾人的高貴。<br><span class='text-amber-300'>【冰之女王魅力套裝】頭飾＋禮服＋涼鞋 同時裝備：AC-5、力量+2、魅力+2、HP+100、MP自然恢復+4、水屬性抗性+20。</span>" },
        "amr_icequeen_charm": { n: "冰之女王魅力禮服", legend: true, type: "arm", slot: "armor", ac: 7, req: "royal", reqAvatar: "公主", safe: 4, p: 186000, gachaWeight: 1, set: "icequeen_charm", d: "冰之女王魅力套裝之一（公主限定），禮服如初雪般華美而凜然。<br><span class='text-amber-300'>【冰之女王魅力套裝】頭飾＋禮服＋涼鞋 同時裝備：AC-5、力量+2、魅力+2、HP+100、MP自然恢復+4、水屬性抗性+20。</span>" },
        "bot_icequeen_charm": { n: "冰之女王魅力涼鞋", legend: true, type: "arm", slot: "boots", ac: 3, req: "royal", reqAvatar: "公主", safe: 4, p: 115000, gachaWeight: 1, set: "icequeen_charm", d: "冰之女王魅力套裝之一（公主限定），踏之如行於薄冰，步步生寒。<br><span class='text-amber-300'>【冰之女王魅力套裝】頭飾＋禮服＋涼鞋 同時裝備：AC-5、力量+2、魅力+2、HP+100、MP自然恢復+4、水屬性抗性+20。</span>" },
        "hlm_frost": { n: "寒冰頭盔", legend: true, type: "arm", slot: "helm",  ac: 4, req: "royal,dragon", safe: 4, p: 136000, gachaWeight: 0, set: "frost", d: "寒冰套裝之一，頭盔覆著萬年不化的堅冰。<br><span class='text-amber-300'>【寒冰套裝】頭盔＋盔甲＋長靴 同時裝備：AC-5、體質+3、HP+100、HP自然恢復+8、MP自然恢復+4、MR+15、水屬性抗性+20。</span>" },
        "amr_frost": { n: "寒冰盔甲", legend: true, type: "arm", slot: "armor", ac: 5, req: "royal,dragon", safe: 4, p: 196000, gachaWeight: 0, set: "frost", d: "寒冰套裝之一，盔甲沁出徹骨寒氣，護身如冰封壁壘。<br><span class='text-amber-300'>【寒冰套裝】頭盔＋盔甲＋長靴 同時裝備：AC-5、體質+3、HP+100、HP自然恢復+8、MP自然恢復+4、MR+15、水屬性抗性+20。</span>" },
        "bot_frost": { n: "寒冰長靴", legend: true, type: "arm", slot: "boots", ac: 4, req: "royal,dragon", safe: 4, p: 125000, gachaWeight: 0, set: "frost", d: "千年寒霜凝鑄的長靴，踏處留下不化的冰痕。寒冰套裝之一。<br><span class='text-amber-300'>【寒冰套裝】頭盔＋盔甲＋長靴 同時裝備：AC-5、體質+3、HP+100、HP自然恢復+8、MP自然恢復+4、MR+15、水屬性抗性+20。</span>" },
        "wpn_icequeen_wand": { n: "冰之女王魔杖", type: "wpn", dmgS: 3, dmgL: 4, hit: 5, dmgBonus: 1, spd: 1.0, req: "mage", safe: 6, p: 143340, legend: true, gachaWeight: 1, procSkill: "sk_ice_spike", procRateBase: 8, procRatePerEn: 2, d: "冰之女王御用的魔杖，杖尖凝著永不消融的霜華。攻擊時 8% 機率額外施放冰錐（每強化 +1 機率 +2%，不需學習、不耗MP，效果同法師冰錐）。" },
        "wpn_demon_scythe":  { n: "惡魔鐮刀", type: "wpn", dmgS: 1, dmgL: 1, hit: 0, dmgBonus: 0, mdmg: 5, spd: 1.0, req: "mage", safe: 6, p: 173340, legend: true, gachaWeight: 1, isWand: true },   // 🔮 單手魔杖（共鳴·見 WAND_LIGHTARROW_IDS）；isWand→魔劍精通排除、不轉奇古獸
        // ===== 冥法軍訓練場：掉落武器 =====
        "wpn_blood_2hsword":   { n: "血色巨劍", type: "wpn", w2h: true, dmgS: 13, dmgL: 15, hit: 0, dmgBonus: 0, spd: 0.9, req: "knight",      safe: 6, p: 11140, eff: "cleave", gachaWeight: 30 },   // 切割（雙手劍）
        "wpn_dark_sword":      { n: "黑暗之劍", type: "wpn",            dmgS: 15, dmgL: 12, hit: 0, dmgBonus: 1, spd: 0.9, req: "knight,dark", safe: 6, p: 12000, gachaWeight: 10 },   // 反擊（單手劍 tag 自動）
        "wpn_red_crystalwand": { n: "紅水晶魔杖", type: "wpn", w2h: true, dmgS: 8, dmgL: 8, hit: 0, spd: 1.0, req: "mage", safe: 6, p: 13340, mpR: 5, int: 1, wis: 1, gachaWeight: 10 },   // 共鳴（WAND_LIGHTARROW_IDS）
        // ===== 黑暗妖精武器：雙刀（雙手，連擊） =====
        "wpn_dual_bronze":   { n: "青銅雙刀", type: "wpn", w2h: true, dmgS: 8,  dmgL: 6,  hit: 3, spd: 0.8, req: "dark", safe: 6, p: 960,   eff: "combo", gachaWeight: 100 },
        "wpn_dual_steel":    { n: "鋼鐵雙刀", type: "wpn", w2h: true, dmgS: 10, dmgL: 7,  hit: 1, spd: 0.8, req: "dark", safe: 6, p: 1800,  eff: "combo", gachaWeight: 100 },
        "wpn_dual_silver":   { n: "銀光雙刀", type: "wpn", w2h: true, dmgS: 11, dmgL: 8,  hit: 3, spd: 0.8, req: "dark", safe: 6, p: 3800,  eff: "combo", unBonus: true, gachaWeight: 50 },
        "wpn_dual_gloom":    { n: "幽暗雙刀", type: "wpn", w2h: true, dmgS: 15, dmgL: 10, hit: 3, dmgBonus: 1, spd: 0.8, req: "dark", safe: 6, p: 8800,  eff: "combo", gachaWeight: 30 },
        "wpn_dual_dark":     { n: "黑暗雙刀", type: "wpn", w2h: true, dmgS: 12, dmgL: 8,  hit: 3, spd: 0.8, req: "dark", safe: 6, p: 8800,  eff: "combo", gachaWeight: 50 },
        "wpn_dual_shadow":   { n: "暗影雙刀", type: "wpn", w2h: true, dmgS: 11, dmgL: 7,  hit: 1, spd: 0.8, req: "dark", safe: 6, p: 3600,  eff: "combo", gachaWeight: 100 },
        "wpn_dual_damascus": { n: "大馬士革雙刀", type: "wpn", w2h: true, dmgS: 15, dmgL: 9, hit: 1, spd: 0.8, req: "dark", safe: 6, p: 39600, eff: "combo", hardWear: 1, gachaWeight: 50 },
        "wpn_dual_abyss":    { n: "暗黑雙刀", type: "wpn", w2h: true, dmgS: 18, dmgL: 14, hit: 4, dmgBonus: 3, spd: 0.8, req: "dark", safe: 6, p: 80000, eff: "combo", gachaWeight: 5 },
        // ===== 🏛️ 底比斯·歐西里斯武器（攻擊時 4% 發動「惡魔之吻」：3D20 地屬性魔法傷害，受魔法傷害公式影響；玩家＋傭兵皆觸發） =====
        "wpn_thebes_bow":     { n: "底比斯歐西里斯弓", type: "wpn", isBow: true, ranged: true, rapidfire: 80, dmgS: 3, dmgL: 3, hit: 0, dmgBonus: 1, int: 2, wis: 1, spd: 0.9, req: "elf,illusion", safe: 6, p: 235000, gachaWeight: 1, procSkill: "sk_demon_kiss", procRateBase: 4, procRatePerEn: 0, d: "底比斯亡靈守護者持用的長弓，弓弦低語著歐西里斯的審判。連射 80%。智力+2、精神+1。攻擊時 4% 機率發動惡魔之吻（3D20 地屬性魔法傷害，受魔法傷害公式影響）。" },
        "wpn_thebes_dual":    { n: "底比斯歐西里斯雙刀", type: "wpn", w2h: true, dmgS: 16, dmgL: 11, hit: 0, dmgBonus: 1, dex: 2, wis: 1, spd: 0.7, req: "dark", safe: 6, p: 215000, eff: "combo", comboRate: 30, gachaWeight: 1, procSkill: "sk_demon_kiss", procRateBase: 4, procRatePerEn: 0, d: "自底比斯神殿出土的雙刃，刀身刻滿守墓的咒文。雙擊。敏捷+2、精神+1。攻擊時 4% 機率發動惡魔之吻（3D20 地屬性魔法傷害，受魔法傷害公式影響）。" },
        "wpn_thebes_2hsword": { n: "底比斯歐西里斯雙手劍", type: "wpn", w2h: true, dmgS: 21, dmgL: 26, hit: 5, dmgBonus: 0, str: 1, con: 2, spd: 0.8, req: "knight,dragon", safe: 6, p: 255000, eff: "cleave", gachaWeight: 1, procSkill: "sk_demon_kiss", procRateBase: 4, procRatePerEn: 0, d: "沉睡於歐西里斯祭壇的巨劍，承載著冥府之主的威壓。切割。力量+1、體質+2。攻擊時 4% 機率發動惡魔之吻（3D20 地屬性魔法傷害，受魔法傷害公式影響）。" },
        "wpn_thebes_wand":    { n: "底比斯歐西里斯魔杖", type: "wpn", w2h: true, dmgS: 20, dmgL: 18, hit: 2, dmgBonus: 3, str: 2, mdmg: 2, mpR: 7, spd: 0.9, req: "mage,illusion", safe: 6, p: 185000, eff: "magicstrike", gachaWeight: 1, procSkill: "sk_demon_kiss", procRateBase: 4, procRatePerEn: 0, d: "底比斯祭司執掌的魔杖，引動黃沙與亡魂之力。魔擊。力量+2、魔攻+2、MP自然恢復+7。攻擊時 4% 機率發動惡魔之吻（3D20 地屬性魔法傷害，受魔法傷害公式影響）。" },
        "blt_thebes_osiris":  { n: "底比斯歐西里斯腰帶", type: "acc", slot: "belt", ac: 0, mmp: 10, mpR: 2, weightCap: 250, req: "all", safe: 0, p: 326000, gachaWeight: 1, d: "以歐西里斯之名祝聖的腰帶，繫上者得享冥界的豐沃。MP+10、MP自然恢復+2、負重上限+250。" },
        "acc_thebes_horus":   { n: "底比斯賀洛斯戒指", legend: true, type: "acc", slot: "ring", ac: 0, int: 1, mpR: 1, mdmg: 2, req: "all", safe: 0, p: 600000, gachaWeight: 1, d: "鑲著鷹神賀洛斯之眼的戒指，洞悉魔力的流轉。智力+1、MP自然恢復+1、魔法傷害+2。" },
        "acc_thebes_anubis":  { n: "底比斯阿努比斯戒指", legend: true, type: "acc", slot: "ring", ac: 0, str: 1, mhp: 15, stunResist: 25, req: "all", safe: 0, p: 600000, gachaWeight: 1, d: "鐫刻胡狼神阿努比斯印記的戒指，守護佩戴者免於昏厥。力量+1、HP+15、25%機率抵抗暈眩。" },
        // ===== 黑暗妖精武器：十字弓（雙手，遠程，連射） =====
        "wpn_xbow_dark":  { n: "黑暗十字弓", type: "wpn", isBow: true, ranged: true, rapidfire: 35, w2h: true, dmgS: 2, dmgL: 2, hit: 4, dmgBonus: 0, spd: 1.0, req: "elf,dark", safe: 6, p: 17300, gachaWeight: 70 },
        "wpn_xbow_gloom": { n: "幽暗十字弓", type: "wpn", isBow: true, ranged: true, rapidfire: 70, w2h: true, dmgS: 3, dmgL: 2, hit: 5, dmgBonus: 2, spd: 1.0, req: "elf,dark", safe: 6, p: 33300, gachaWeight: 50 },
        "wpn_xbow_abyss": { n: "暗黑十字弓", type: "wpn", isBow: true, ranged: true, rapidfire: 70, w2h: true, dmgS: 5, dmgL: 5, hit: 4, dmgBonus: 6, spd: 1.0, req: "elf,dark", safe: 6, p: 180000, gachaWeight: 1, ignHardSkin: true, d: "以深淵暗黑之力凝成的十字弓，箭矢能穿透一切血肉與甲冑。連射 70%；貫穿——攻擊（含連射）無視目標硬皮的額外物理減傷。" },
        // ===== 魔力短劍（匕首，全職業） =====
        "wpn_manadagger": { n: "魔力短劍", type: "wpn", dmgS: 6, dmgL: 4, hit: 0, dmgBonus: 1, spd: 0.8, req: "all", safe: 6, p: 191000, eff: "mp_drain", unBonus: true, str: 1, mpR: 1, legend: true, gachaWeight: 1, d: "刃中封藏著流動魔力的短劍，飲血之餘亦能回吐法力。一般攻擊命中恢復 MP，並帶出血。" },   // 🔧 傳說武器：琥珀金名稱＋專屬藍色圖示光芒
        // ===== 拉斯塔巴德地下洞穴：掉落武器 =====
        "wpn_xbow_rasta":   { n: "拉斯塔巴德十字弓", type: "wpn", isBow: true, ranged: true, rapidfire: 45, w2h: true, dmgS: 3, dmgL: 3, hit: 2, dmgBonus: 2, spd: 0.9, req: "elf,dark", safe: 6, p: 2300, gachaWeight: 80 },
        "wpn_bow_rasta":    { n: "拉斯塔巴德弓", type: "wpn", isBow: true, ranged: true, rapidfire: 55, w2h: true, dmgS: 2, dmgL: 2, hit: 2, dmgBonus: 2, spd: 0.9, req: "knight,elf", safe: 6, p: 1800, gachaWeight: 80 },
        "wpn_small_katana": { n: "小武士刀", type: "wpn", dmgS: 8, dmgL: 8, hit: 1, spd: 0.9, req: "all", safe: 6, p: 11000, gachaWeight: 30 },
        "wpn_sword_rasta":  { n: "拉斯塔巴德長劍", type: "wpn", dmgS: 10, dmgL: 12, hit: 1, spd: 1.1, req: "knight,elf,dark", safe: 6, p: 990, gachaWeight: 50 },
        "wpn_dagger_rasta": { n: "拉斯塔巴德短劍", type: "wpn", dmgS: 4, dmgL: 3, hit: 2, spd: 0.8, req: "all", safe: 6, p: 1000, gachaWeight: 80 },
        "wpn_wand_rasta":   { n: "拉斯塔巴德魔杖", type: "wpn", dmgS: 2, dmgL: 3, hit: 0, mdmg: 1, spd: 1.0, req: "mage", safe: 6, p: 10000, gachaWeight: 80 },
        "wpn_darkmage_wand": { n: "黑法師之杖", type: "wpn", dmgS: 1, dmgL: 1, hit: 0, dmgBonus: 0, mdmg: 2, mpR: 5, spd: 1.0, req: "mage", safe: 6, p: 94510, gachaWeight: 5 },   // 共鳴（見 WAND_LIGHTARROW_IDS）
        "wpn_dual_rasta":   { n: "拉斯塔巴德雙刀", type: "wpn", w2h: true, dmgS: 15, dmgL: 10, hit: 0, spd: 0.8, req: "dark", safe: 6, p: 10000, eff: "combo", gachaWeight: 50 },
        "wpn_xbow_heavy_rasta": { n: "拉斯塔巴德重十字弓", type: "wpn", isBow: true, ranged: true, rapidfire: 45, w2h: true, dmgS: 3, dmgL: 3, hit: 2, dmgBonus: 3, spd: 0.9, req: "elf", safe: 6, p: 5300, gachaWeight: 80 },
        "wpn_spear_rasta":  { n: "拉斯塔巴德矛", type: "wpn", dmgS: 8, dmgL: 8, hit: 0, spd: 1.1, req: "knight,elf", safe: 6, p: 1800, gachaWeight: 100 },
        // ===== 🏛️ 格蘭肯神殿．長老之室 新物品（掉落用武器/防具/特殊道具/製作材料；5 把傳說製作武器另於製作階段新增） =====
        "wpn_dual_spike":     { n: "尖刺雙刀", type: "wpn", w2h: true, dmgS: 8, dmgL: 8, hit: 0, dmgBonus: 3, spd: 0.8, req: "dark", safe: 6, p: 2000, gachaWeight: 100, eff: "combo", comboRate: 25, ignHardSkin: true, d: "佈滿尖刺的雙刀，連環撕咬穿透敵人的防護。<br>雙擊 25%；貫穿（無視硬皮額外減傷）。" },
        "wpn_official_blade": { n: "武官之刃", type: "wpn", dmgS: 13, dmgL: 10, hit: 1, dmgBonus: 2, spd: 1.1, req: "knight,elf,royal,dragon", safe: 6, p: 58000, gachaWeight: 10, d: "拉斯塔巴德武官佩帶的單手劍，以靜制動、伺機反擊。<br>反擊（單手劍）。" },
        "arm_official_cloak": { n: "武官斗篷", type: "arm", slot: "cloak", ac: 2, mhp: 20, hpR: 3, req: "knight,dark,royal,dragon", safe: 4, p: 13000, gachaWeight: 20, d: "拉斯塔巴德武官的斗篷，內襯堅韌、護住要害。<br>HP+20、HP自然恢復+3。" },
        "glv_dark": { n: "黑暗手套", type: "arm", slot: "gloves", ac: 1, rangedHit: 2, req: "dark", safe: 4, p: 4000, gachaWeight: 90, d: "黑暗妖精的手套，握持間更顯穩準。<br>遠距離命中+2。" },
        "item_dk_insignia":   { n: "死亡騎士之印記", type: "etc", p: 50000, maxHold: 1, noUse: true, gachaWeight: 0, c: "text-red-400", d: "死亡騎士的印記（唯一）。持有時於拉斯塔巴德區域擊敗怪物，有機率獲得聖地遺物。可賣出。" },
        "mat_holy_relic":     { n: "聖地遺物", type: "etc", p: 100, noUse: true, gachaWeight: 0, c: "text-yellow-200", d: "格蘭肯神殿的聖地遺物。製作材料。" },
        "mat_black_blood":    { n: "黑色血痕", type: "etc", p: 100, noUse: true, gachaWeight: 0, c: "text-red-300", d: "凝結不散的黑色血痕。製作材料。" },
        "mat_black_powder":   { n: "黑魔法粉", type: "etc", p: 100, noUse: true, gachaWeight: 0, c: "text-purple-300", d: "蘊含黑魔法之力的粉末。製作材料。" },
        "mat_history_1": { n: "封印的歷史書第1頁", type: "etc", p: 100, noUse: true, gachaWeight: 0, c: "text-amber-200", d: "封印的歷史書殘頁。集齊 8 頁可製作『拉斯塔巴德製作武器秘笈』。" },
        "mat_history_2": { n: "封印的歷史書第2頁", type: "etc", p: 100, noUse: true, gachaWeight: 0, c: "text-amber-200", d: "封印的歷史書殘頁。集齊 8 頁可製作『拉斯塔巴德製作武器秘笈』。" },
        "mat_history_3": { n: "封印的歷史書第3頁", type: "etc", p: 100, noUse: true, gachaWeight: 0, c: "text-amber-200", d: "封印的歷史書殘頁。集齊 8 頁可製作『拉斯塔巴德製作武器秘笈』。" },
        "mat_history_4": { n: "封印的歷史書第4頁", type: "etc", p: 100, noUse: true, gachaWeight: 0, c: "text-amber-200", d: "封印的歷史書殘頁。集齊 8 頁可製作『拉斯塔巴德製作武器秘笈』。" },
        "mat_history_5": { n: "封印的歷史書第5頁", type: "etc", p: 100, noUse: true, gachaWeight: 0, c: "text-amber-200", d: "封印的歷史書殘頁。集齊 8 頁可製作『拉斯塔巴德製作武器秘笈』。" },
        "mat_history_6": { n: "封印的歷史書第6頁", type: "etc", p: 100, noUse: true, gachaWeight: 0, c: "text-amber-200", d: "封印的歷史書殘頁。集齊 8 頁可製作『拉斯塔巴德製作武器秘笈』。" },
        "mat_history_7": { n: "封印的歷史書第7頁", type: "etc", p: 100, noUse: true, gachaWeight: 0, c: "text-amber-200", d: "封印的歷史書殘頁。集齊 8 頁可製作『拉斯塔巴德製作武器秘笈』。" },
        "mat_history_8": { n: "封印的歷史書第8頁", type: "etc", p: 100, noUse: true, gachaWeight: 0, c: "text-amber-200", d: "封印的歷史書殘頁。集齊 8 頁可製作『拉斯塔巴德製作武器秘笈』。" },
        // ===== 🏛️ 長老之室 5 傳說製作武器（可羅蘭斯製作·潘朵拉0·安定0·無法在商店/抽獎取得） =====
        "wpn_emperor_blade":   { n: "真．冥皇執行劍", type: "wpn", w2h: true, legend: true, dmgS: 28, dmgL: 33, hit: 5, dmgBonus: 20, spd: 0.9, req: "knight,dragon", safe: 0, p: 500000, gachaWeight: 0, eff: "cleave", ignHardSkin: true, str: 2, dex: 1, stunHitBonus: 20, d: "冥皇執行劍的真實之姿，劍勢凝著鎮魂的威壓。<br>切割；貫穿（無視硬皮額外減傷）；力量+2、敏捷+1；施展衝擊之暈時暈眩命中率 +20%。" },
        "wpn_windblade_dagger":{ n: "風刃短劍", type: "wpn", legend: true, dmgS: 23, dmgL: 16, hit: 10, dmgBonus: 10, spd: 0.8, req: "knight,elf,mage,royal,dark", safe: 0, p: 500000, gachaWeight: 0, ignHardSkin: true, mhp: 100, dex: 2, vampPct: 0.1, d: "風之精靈寄宿的短劍，揮斬之間清風奪命。<br>出血（匕首）；貫穿（無視硬皮額外減傷）；HP+100、敏捷+2；恢復一般攻擊造成傷害的 10% HP。" },
        "wpn_redshadow_dual":  { n: "紅影雙刀", type: "wpn", w2h: true, legend: true, dmgS: 27, dmgL: 18, hit: 10, dmgBonus: 18, spd: 0.8, req: "dark", safe: 0, p: 500000, gachaWeight: 0, eff: "combo", comboRate: 35, ignHardSkin: true, dex: 2, wis: 2, procStatusSkill: { skId: "sk_slow", rate: 10 }, d: "殷紅殘影交織的雙刀，刃過之處敵人遲滯難動。<br>雙擊 35%；貫穿（無視硬皮額外減傷）；敏捷+2、精神+2；攻擊時 10% 機率使目標緩速。" },
        "wpn_beastking_claw":  { n: "獸王鋼爪", type: "wpn", w2h: true, legend: true, dmgS: 25, dmgL: 20, hit: 15, dmgBonus: 10, spd: 0.9, req: "dark", safe: 0, p: 500000, gachaWeight: 0, eff: "combo", comboRate: 33, ignHardSkin: true, str: 2, dex: 2, d: "獸王之力灌注的鋼爪，撕咬如百獸之王臨陣。<br>雙擊 33%；貫穿（無視硬皮額外減傷）；力量+2、敏捷+2。" },
        "wpn_holycrystal_wand":{ n: "聖晶魔杖", type: "wpn", w2h: true, legend: true, dmgS: 13, dmgL: 15, hit: 8, dmgBonus: 0, spd: 1.0, req: "mage,illusion", safe: 0, p: 500000, gachaWeight: 0, eff: "magicburst", ignHardSkin: true, int: 2, mdmg: 8, mmp: 50, procSkill: "sk_holy_lightning", procRateBase: 10, procRatePerEn: 1, d: "聖潔水晶鑲嵌的魔杖，杖端雷光蓄勢待發。<br>魔爆；貫穿（無視硬皮額外減傷）；智力+2、魔法傷害+8、MP+50；攻擊時 10% 機率發動致命落雷（每強化 +1 機率 +1%，6D10 風屬性·套法師6階加成）。" },
        "mat_rasta_codex":     { n: "拉斯塔巴德製作武器秘笈", type: "etc", p: 100, noUse: true, gachaWeight: 0, c: "text-amber-300", d: "集封印的歷史書八頁殘篇而成的武器鍛造秘笈。可羅蘭斯製作五件傳說武器的核心材料。" },
        "hlm_elf": { n: "精靈皮盔", type: "arm", slot: "helm", ac: 1, req: "elf,mage", safe: 6, p: 120, gachaWeight: 100 },
        "hlm_oasis": { n: "歐西斯頭盔", type: "arm", slot: "helm", ac: 1, req: "all", safe: 4, p: 10, gachaWeight: 100 },
        "hlm_gnome": { n: "侏儒鐵盔", type: "arm", slot: "helm", ac: 2, req: "all", safe: 4, p: 30, gachaWeight: 100 },
        "arm_42": { n: "頭盔", type: "arm", slot: "helm", ac: 1, req: "all", safe: 4, p: 60, gachaWeight: 100 },
        "arm_43": { n: "騎士面甲", type: "arm", slot: "helm", ac: 3, req: "knight", safe: 4, p: 5500, gachaWeight: 70 },
        "hlm_mr": { n: "抗魔法頭盔", type: "arm", slot: "helm", ac: 2, mr: 4, mrPerEn: 1, req: "all", safe: 4, p: 4200, gachaWeight: 80 },
        "arm_44": { n: "艾爾穆的祝福", type: "arm", slot: "helm", ac: 2, req: "elf", safe: 6, p: 8900, dex: 1, gachaWeight: 10 },
        "arm_45": { n: "治癒魔法頭盔", type: "arm", slot: "helm", ac: 1, req: "knight", safe: 4, p: 21000, grantSkills: ["sk_helm_heal1", "sk_helm_heal2"], gachaWeight: 10 },
        "arm_46": { n: "敏捷魔法頭盔", type: "arm", slot: "helm", ac: 1, req: "knight", safe: 4, p: 30800, grantSkills: ["sk_helm_dex1", "sk_helm_dex2"], gachaWeight: 10 },
        "arm_47": { n: "力量魔法頭盔", type: "arm", slot: "helm", ac: 1, req: "knight", safe: 4, p: 25200, grantSkills: ["sk_helm_str1", "sk_helm_str2", "sk_helm_str3"], gachaWeight: 10 },
        "arm_48": { n: "皮帽子", type: "arm", slot: "helm", ac: 0, req: "all", safe: 4, p: 20, gachaWeight: 100 },
        "hlm_silver": { n: "銀釘皮帽", type: "arm", slot: "helm", ac: 2, req: "all", safe: 4, p: 320, gachaWeight: 100 },
        "arm_49": { n: "皮頭盔", type: "arm", slot: "helm", ac: 1, req: "all", safe: 4, p: 60, gachaWeight: 100 },
        "hlm_bone": { n: "骷髏頭盔", type: "arm", slot: "helm", ac: 3, req: "all", safe: 0, p: 100, gachaWeight: 100 },
        "hlm_steel": { n: "鋼鐵頭盔", type: "arm", slot: "helm", ac: 3, req: "knight", safe: 4, p: 18250, gachaWeight: 20 },
        "hlm_mage": { n: "法師之帽", type: "arm", slot: "helm", ac: 2, req: "mage", safe: 4, p: 4250, gachaWeight: 50 },
        "hlm_dk": { n: "死亡騎士頭盔", legend: true, type: "arm", slot: "helm", ac: 3, req: "knight", safe: 4, p: 36000, gachaWeight: 1, d: "死亡騎士頭盔，殘存的怨念在頭盔深處幽幽燃燒。死亡騎士套裝之一。<br>【死亡騎士套裝】4 件齊：AC-4、變身「真‧死亡騎士」（額外傷害+6、額外命中+6、攻速+35%）。" },
        "arm_50": { n: "精靈敏捷頭盔", type: "arm", slot: "helm", ac: 1, req: "elf", safe: 6, p: 4800, dex: 1, gachaWeight: 20 },
        "arm_51": { n: "精靈體質頭盔", type: "arm", slot: "helm", ac: 1, req: "elf", safe: 6, p: 4800, con: 1, gachaWeight: 20 },
        "arm_52": { n: "騎士頭巾", type: "arm", slot: "helm", ac: 1, req: "knight", p: 1, gachaWeight: 0 },
        "arm_53": { n: "紅騎士頭巾", type: "arm", slot: "helm", ac: 2, req: "knight", safe: 6, p: 6500, gachaWeight: 20 },
        "arm_54": { n: "巴土瑟之帽", legend: true, type: "arm", slot: "helm", ac: 2, req: "mage", safe: 4, p: 23500, mpR: 5, gachaWeight: 1 },
        "arm_55": { n: "卡士柏之帽", legend: true, type: "arm", slot: "helm", ac: 2, req: "mage", safe: 4, p: 23500, mmp: 25, gachaWeight: 1 },
        "arm_56": { n: "馬庫爾之帽", legend: true, type: "arm", slot: "helm", ac: 2, req: "mage", safe: 4, p: 23500, int: 1, gachaWeight: 1 },
        "arm_57": { n: "西瑪之帽", legend: true, type: "arm", slot: "helm", ac: 2, req: "mage", safe: 4, p: 23500, mmp: 15, mpR: 2, gachaWeight: 1 },
        "hlm_kurt": { n: "克特頭盔", legend: true, type: "arm", slot: "helm", ac: 3, req: "knight", safe: 4, p: 32000, gachaWeight: 1, d: "曾屬於墮落者克特的頭盔，盔影下不見生人氣息。克特套裝之一。<br>【克特套裝】4 件齊：AC-4、變身「真‧克特」（額外傷害+4、額外命中+8、攻速+35%）。" },
        "arm_58": { n: "淨化頭飾", type: "arm", slot: "helm", ac: 0, req: "elf", p: 1, gachaWeight: 0 },
        "amr_plate": { n: "金屬盔甲", type: "arm", slot: "armor", ac: 7, req: "knight", safe: 4, p: 51800, gachaWeight: 30 },
        "arm_59": { n: "水晶盔甲", type: "arm", slot: "armor", ac: 8, req: "knight", safe: 4, p: 48000, gachaWeight: 20 },   // 🔧 由 惡魔(10%)／密密(0.1%)／黑暗復仇者(0.1%) 掉落；潘朵拉權重 20（進黑市/血盟野外抽獎池）
        "arm_60": { n: "青銅盔甲", type: "arm", slot: "armor", ac: 6, req: "knight", safe: 4, p: 22400, gachaWeight: 50 },
        "arm_61": { n: "藤甲", type: "arm", slot: "armor", ac: 6, req: "knight", safe: 4, p: 28000, gachaWeight: 50 },
        "arm_62": { n: "皮甲", type: "arm", slot: "armor", ac: 6, req: "knight", safe: 4, p: 32300, gachaWeight: 50 },
        "arm_63": { n: "鏈甲", type: "arm", slot: "armor", ac: 5, req: "knight,elf", safe: 4, p: 1980, gachaWeight: 100 },
        "arm_64": { n: "歐西斯鏈甲", type: "arm", slot: "armor", ac: 4, req: "knight,elf", safe: 4, p: 264, gachaWeight: 100 },
        "arm_65": { n: "鱗甲", type: "arm", slot: "armor", ac: 4, req: "knight,elf", safe: 4, p: 2800, gachaWeight: 100 },
        "arm_66": { n: "銀釘皮甲", type: "arm", slot: "armor", ac: 3, req: "all", safe: 4, p: 420, gachaWeight: 100 },
        "arm_67": { n: "環甲", type: "arm", slot: "armor", ac: 3, req: "all", safe: 4, p: 700, gachaWeight: 100 },
        "amr_oasis": { n: "歐西斯環甲", type: "arm", slot: "armor", ac: 2, req: "all", safe: 4, p: 66, gachaWeight: 100 },
        "arm_68": { n: "小藤甲", type: "arm", slot: "armor", ac: 2, req: "all", safe: 4, p: 140, gachaWeight: 100 },
        "amr_jacket": { n: "皮夾克", type: "arm", slot: "armor", ac: 1, req: "all", safe: 4, p: 1, gachaWeight: 100 },
        "arm_69": { n: "抗魔法鏈甲", type: "arm", slot: "armor", ac: 5, mr: 4, mrPerEn: 1, req: "knight,elf", safe: 4, p: 11200, gachaWeight: 50 },
        "amr_robe": { n: "綿質長袍", type: "arm", slot: "armor", ac: 2, mr: 4, req: "all", safe: 4, p: 1400, gachaWeight: 100 },
        "arm_70": { n: "木甲", type: "arm", slot: "armor", ac: 3, req: "all", safe: 4, p: 240, gachaWeight: 100 },
        "arm_71": { n: "精靈護胸金屬板", type: "arm", slot: "armor", ac: 4, req: "knight,elf", safe: 6, p: 2240, gachaWeight: 50 },
        "arm_72": { n: "精靈金屬盔甲", type: "arm", slot: "armor", ac: 6, req: "knight,elf", safe: 6, p: 57200, gachaWeight: 10 },
        "arm_73": { n: "精靈鏈甲", type: "arm", slot: "armor", ac: 5, req: "knight,elf", safe: 6, p: 2880, gachaWeight: 50 },
        "arm_74": { n: "木製的夾克", type: "arm", slot: "armor", ac: 1, req: "all", safe: 4, p: 1, gachaWeight: 100 },
        "arm_75": { n: "皮背心", type: "arm", slot: "armor", ac: 1, req: "all", safe: 4, p: 10, gachaWeight: 100 },
        "arm_76": { n: "皮盔甲", type: "arm", slot: "armor", ac: 3, req: "all", safe: 4, p: 210, gachaWeight: 100 },
        "arm_77": { n: "銀釘皮背心", type: "arm", slot: "armor", ac: 2, req: "all", safe: 4, p: 280, gachaWeight: 100 },
        "arm_78": { n: "硬皮背心", type: "arm", slot: "armor", ac: 3, req: "all", safe: 4, p: 240, gachaWeight: 100 },
        "amr_bone": { n: "骷髏盔甲", type: "arm", slot: "armor", ac: 5, req: "all", safe: 0, p: 100, gachaWeight: 100 },
        "arm_79": { n: "鋼鐵金屬盔甲", type: "arm", slot: "armor", ac: 7, req: "knight", safe: 4, p: 59800, gachaWeight: 20 },
        "amr_magerobe": { n: "法師長袍", type: "arm", slot: "armor", ac: 3, req: "mage", safe: 4, p: 2800, gachaWeight: 50 },
        "arm_80": { n: "水龍鱗盔甲", legend: true, type: "arm", slot: "armor", ac: 9, resWater: 20, req: "all", safe: 4, p: 336000, gachaWeight: 1 },
        "arm_81": { n: "地龍鱗盔甲", legend: true, type: "arm", slot: "armor", ac: 9, resEarth: 20, req: "all", safe: 4, p: 336000, gachaWeight: 1 },
        "arm_82": { n: "火龍鱗盔甲", legend: true, type: "arm", slot: "armor", ac: 9, resFire: 20, req: "all", safe: 4, p: 336000, gachaWeight: 1 },
        "arm_83": { n: "風龍鱗盔甲", legend: true, type: "arm", slot: "armor", ac: 9, resWind: 20, req: "all", safe: 4, p: 336000, gachaWeight: 1 },
        "amr_dk": { n: "死亡騎士盔甲", legend: true, type: "arm", slot: "armor", ac: 7, req: "knight", safe: 4, p: 128000, gachaWeight: 1, d: "死亡騎士的胸甲，甲面浮現著不滅的死亡紋章。死亡騎士套裝之一。<br>【死亡騎士套裝】4 件齊：AC-4、變身「真‧死亡騎士」（額外傷害+6、額外命中+6、攻速+35%）。" },
        "arm_84": { n: "黑長者長袍", legend: true, type: "arm", slot: "armor", ac: 5, req: "mage", safe: 4, p: 124000, mmp: 50, mpR: 5, gachaWeight: 1 },
        "amr_kurt": { n: "克特盔甲", legend: true, type: "arm", slot: "armor", ac: 7, req: "knight", safe: 4, p: 126000, gachaWeight: 1, d: "克特生前征戰所披的盔甲，鎧縫間仍滲著陳年的血鏽。克特套裝之一。<br>【克特套裝】4 件齊：AC-4、變身「真‧克特」（額外傷害+4、額外命中+8、攻速+35%）。" },
        "tsh_tshirt": { n: "T恤", type: "arm", slot: "tshirt", ac: 0, req: "all", safe: 4, p: 8500, gachaWeight: 50 },
        "arm_85": { n: "精靈T恤", type: "arm", slot: "tshirt", ac: 0, req: "elf", safe: 6, p: 6600, gachaWeight: 20 },
        "clk_elf": { n: "精靈斗篷", type: "arm", slot: "cloak", ac: 1, req: "all", safe: 6, p: 900, gachaWeight: 100 },
        "clk_oasis": { n: "歐西斯斗篷", type: "arm", slot: "cloak", ac: 0, req: "all", safe: 4, p: 15, gachaWeight: 100 },
        "arm_86": { n: "侏儒斗篷", type: "arm", slot: "cloak", ac: 0, req: "all", safe: 4, p: 18, gachaWeight: 100 },
        "arm_87": { n: "保護者斗篷", type: "arm", slot: "cloak", ac: 3, req: "all", safe: 4, p: 8500, gachaWeight: 50 },
        "arm_88": { n: "隱身斗篷", type: "arm", slot: "cloak", ac: 1, legend: true, d: "織入隱匿術法的斗篷，披上便彷彿融入暗影。穿戴時等同維持隱身術：非BOSS敵人在滿血時不會主動攻擊，受創後才會反擊（卸下即失效）。", req: "all", safe: 4, p: 100000, gachaWeight: 1 },
        "clk_mr": { n: "抗魔法斗篷", type: "arm", slot: "cloak", ac: 1, mr: 10, mrPerEn: 2, req: "all", safe: 4, p: 3300, gachaWeight: 100 },
        "arm_89": { n: "瑪那斗篷", type: "arm", slot: "cloak", ac: 2, req: "mage", safe: 4, p: 7200, mpR: 5, gachaWeight: 10 },
        "bot_short": { n: "短統靴", type: "arm", slot: "boots", ac: 1, req: "all", safe: 4, p: 299, gachaWeight: 100 },
        "arm_90": { n: "長靴", type: "arm", slot: "boots", ac: 2, req: "all", safe: 4, p: 3260, gachaWeight: 100 },
        "bot_baless": { n: "巴列斯長靴", legend: true, type: "arm", slot: "boots", ac: 2, str: 1, req: "knight,elf", safe: 6, p: 60000, gachaWeight: 1 },   // 🔧 巴列斯掉落（AC-2＝ac:2；力量+1）
        "arm_91": { n: "皮涼鞋", type: "arm", slot: "boots", ac: 0, req: "all", safe: 4, p: 20, gachaWeight: 100 },
        "arm_92": { n: "銀釘皮涼鞋", type: "arm", slot: "boots", ac: 1, req: "all", safe: 4, p: 230, gachaWeight: 100 },
        "arm_93": { n: "皮長靴", type: "arm", slot: "boots", ac: 2, req: "all", safe: 4, p: 720, gachaWeight: 100 },
        "arm_94": { n: "鋼鐵長靴", type: "arm", slot: "boots", ac: 3, req: "all", safe: 4, p: 16500, gachaWeight: 20 },
        "arm_95": { n: "深水長靴", type: "arm", slot: "boots", ac: 2, req: "all", safe: 4, p: 36500, mpR: 1, gachaWeight: 10 },
        "bot_dk": { n: "死亡騎士長靴", legend: true, type: "arm", slot: "boots", ac: 3, req: "knight", safe: 4, p: 24000, gachaWeight: 1, d: "死亡騎士的戰靴，所踏之地寸草不生。死亡騎士套裝之一。<br>【死亡騎士套裝】4 件齊：AC-4、變身「真‧死亡騎士」（額外傷害+6、額外命中+6、攻速+35%）。" },
        "arm_96": { n: "黑長者涼鞋", legend: true, type: "arm", slot: "boots", ac: 2, req: "mage", safe: 4, p: 21000, mmp: 25, mpR: 5, gachaWeight: 1 },
        "arm_97": { n: "克特長靴", legend: true, type: "arm", slot: "boots", ac: 3, req: "knight", safe: 4, p: 22000, gachaWeight: 1, d: "克特踏遍沙場的長靴，靴底沾染著無數亡者的塵土。克特套裝之一。<br>【克特套裝】4 件齊：AC-4、變身「真‧克特」（額外傷害+4、額外命中+8、攻速+35%）。" },
        "glv_glove": { n: "手套", type: "arm", slot: "gloves", ac: 0, req: "all", safe: 4, p: 1720, gachaWeight: 100 },
        "glv_official": { n: "武官手套", type: "arm", slot: "gloves", ac: 1, mhp: 10, req: "knight,dark", safe: 6, p: 5900, gachaWeight: 10 },
        "bot_official": { n: "武官長靴", type: "arm", slot: "boots", ac: 2, mhp: 20, req: "knight,dark", safe: 6, p: 8900, gachaWeight: 10 },
		"glv_crystal": { n: "水晶手套", type: "arm", slot: "gloves", ac: 3, req: "knight", safe: 4, p: 11500, gachaWeight: 10 },
        "arm_98": { n: "腕甲", type: "arm", slot: "gloves", ac: 0, req: "knight,elf", safe: 4, p: 11550, rangedHit: 2, gachaWeight: 20 },
        "arm_99": { n: "力量手套", type: "arm", slot: "gloves", ac: 0, req: "all", safe: 4, p: 19800, str: 2, gachaWeight: 5 },
        "glv_reaper": { n: "死神之手", type: "arm", slot: "gloves", ac: 1, mmp: 20, mpR: 3, wis: 1, req: "mage,dark", safe: 0, p: 79000, gachaWeight: 1, d: "死神親手脫下的枯骨之手，攥緊時透出徹骨的寒意。" },
        "arm_100": { n: "鋼鐵手套", type: "arm", slot: "gloves", ac: 1, req: "all", safe: 4, p: 11550, gachaWeight: 20 },
        "glv_dk": { n: "死亡騎士手套", legend: true, type: "arm", slot: "gloves", ac: 2, req: "knight", safe: 4, p: 18500, gachaWeight: 1, d: "死亡騎士的鐵手套，曾握緊過奪命的鋒刃。死亡騎士套裝之一。<br>【死亡騎士套裝】4 件齊：AC-4、變身「真‧死亡騎士」（額外傷害+6、額外命中+6、攻速+35%）。" },
        "arm_shadowglove": { n: "影子手套", type: "arm", slot: "gloves", ac: 1, con: 1, req: "dark", safe: 6, p: 1720, gachaWeight: 50 },   // 🔧 黑暗妖精：倫得以死亡誓約兌換
        "arm_shadowmask": { n: "影子面具", type: "arm", slot: "helm", ac: 2, req: "dark", safe: 6, p: 1240, gachaWeight: 50 },   // 🔧 黑暗妖精：康以妖魔長老首級兌換
        "arm_shadowboots": { n: "影子長靴", type: "arm", slot: "boots", ac: 2, mhp: 50, hpR: 4, req: "dark", safe: 4, p: 2660, gachaWeight: 50 },   // 🔧 黑暗妖精：布魯迪卡以雪怪首級兌換
        // ===== 拉斯塔巴德地下洞穴：掉落防具 =====
        "arm_rasta_leather": { n: "拉斯塔巴德皮盔甲", type: "arm", slot: "armor", ac: 3, req: "all", safe: 4, p: 590, gachaWeight: 100 },
        "bot_rasta": { n: "拉斯塔巴德長靴", type: "arm", slot: "boots", ac: 2, req: "all", safe: 4, p: 380, gachaWeight: 100 },
        "clk_dark": { n: "黑暗斗篷", type: "arm", slot: "cloak", ac: 3, mhp: 30, req: "dark", safe: 4, p: 6350, gachaWeight: 60 },
        "amr_rasta_robe": { n: "拉斯塔巴德長袍", type: "arm", slot: "armor", ac: 4, mpR: 5, req: "mage", safe: 4, p: 14000, gachaWeight: 10 },
        "amr_darkmage_robe": { n: "黑法師長袍", type: "arm", slot: "armor", ac: 4, mmp: 5, mpR: 5, req: "mage", safe: 4, p: 53100, gachaWeight: 10 },
        "amr_summoner_robe": { n: "喚獸師長袍", type: "arm", slot: "armor", ac: 4, mhp: 5, mpR: 5, req: "mage", safe: 4, p: 53100, gachaWeight: 10 },
        "shd_rasta": { n: "拉斯塔巴德圓盾", type: "arm", slot: "shield", ac: 2, req: "all", safe: 4, p: 500, gachaWeight: 100, block: 35 },
        "arm_101": { n: "克特手套", legend: true, type: "arm", slot: "gloves", ac: 2, req: "knight", safe: 4, p: 17500, gachaWeight: 1, d: "克特的戰手套，指節間還殘留著最後一戰的握痕。克特套裝之一。<br>【克特套裝】4 件齊：AC-4、變身「真‧克特」（額外傷害+4、額外命中+8、攻速+35%）。" },
        "arm_102": { n: "保護者手套", type: "arm", slot: "gloves", ac: 0, req: "elf", safe: 4, p: 4500, mhp: 20, mmp: 20, gachaWeight: 30 },
        "arm_103": { n: "小盾牌", type: "arm", slot: "shield", ac: 1, req: "all", safe: 4, p: 84, gachaWeight: 100, block: 20 },
        "shd_elf": { n: "精靈盾牌", type: "arm", slot: "shield", ac: 2, req: "all", safe: 6, p: 3200, gachaWeight: 100, block: 40 },
        "arm_104": { n: "阿克海盾牌", type: "arm", slot: "shield", ac: 1, req: "all", safe: 4, p: 28, gachaWeight: 100, block: 30 },
        "arm_105": { n: "大盾牌", type: "arm", slot: "shield", ac: 2, req: "knight,elf", safe: 4, p: 1680, gachaWeight: 100, block: 50 },
        "shd_gnome": { n: "侏儒圓盾", type: "arm", slot: "shield", ac: 2, req: "knight,elf", safe: 4, p: 240, gachaWeight: 100, block: 30 },
        "arm_106": { n: "反射之盾", type: "arm", slot: "shield", ac: 2, req: "knight,elf", safe: 4, p: 28000, immStone: true, magicDrNonEle: 10, d: "盾面如鏡，能將敵人的法術回擲其身。受到無屬性魔法傷害時減少 50%。", gachaWeight: 1, block: 40 },
        "arm_107": { n: "伊娃之盾", type: "arm", slot: "shield", ac: 3, req: "all", safe: 4, p: 5200, mhp: 20, eff: "haste", gachaWeight: 0, block: 40 },
        "arm_108": { n: "塔盾", type: "arm", slot: "shield", ac: 3, req: "knight", safe: 4, p: 9800, gachaWeight: 50, block: 70 },
        "arm_109": { n: "木盾", type: "arm", slot: "shield", ac: 1, req: "all", safe: 4, p: 16, gachaWeight: 100, block: 30 },
        "arm_110": { n: "銀騎士之盾", type: "arm", slot: "shield", ac: 2, mr: 4, req: "knight", safe: 4, p: 2600, gachaWeight: 20, block: 70 },
        "arm_111": { n: "皮盾牌", type: "arm", slot: "shield", ac: 1, req: "all", safe: 4, p: 32, gachaWeight: 100, block: 20 },
        "arm_112": { n: "銀釘皮盾", type: "arm", slot: "shield", ac: 2, req: "all", safe: 4, p: 255, gachaWeight: 100, block: 30 },
        "shd_bone": { n: "骷髏盾牌", type: "arm", slot: "shield", ac: 3, req: "all", safe: 0, p: 255, gachaWeight: 100, block: 30 },
		"shd_redknight": { n: "紅騎士盾牌", type: "arm", slot: "shield", ac: 2, req: "knight", safe: 6, p: 9800, immStone: true, magicDrNonEle: 20, d: "紅騎士團傳承的戰盾，染血的盾面磨礪出抗魔的韌性。受到無屬性魔法傷害時減少 20%。", gachaWeight: 20, block: 50 },
        "arm_113": { n: "鋼鐵盾牌", type: "arm", slot: "shield", ac: 3, req: "knight", safe: 4, p: 16500, gachaWeight: 20, block: 60 },
        "arm_114": { n: "受詛咒的魔法書", type: "arm", slot: "shield", ac: 1, req: "mage", p: 1, gachaWeight: 0, block: 10 },
        "arm_115": { n: "魔法能量之書", type: "arm", slot: "shield", ac: 2, req: "mage", safe: 4, p: 9800, int: 1, gachaWeight: 20, block: 10 },
        "acc_116": { n: "傳送控制戒指", type: "acc", slot: "ring", ac: 0, req: "all", safe: 0, p: 150000, gachaWeight: 1, unique: true, d: "刻著古老座標的戒指，撕裂空間之餘總會引來潛伏的強敵。攜帶在背包即可生效（無需裝備）：手動施放傳送術/使用瞬移卷軸時必定遭遇 BOSS。" },
        "acc_117": { n: "變形控制戒指", type: "acc", slot: "ring", ac: 0, req: "all", safe: 0, p: 150000, gachaWeight: 1, unique: true, d: "嵌著變幻紋路的戒指，讓施術者得以主宰自身形貌的流轉。攜帶在背包即可生效（無需裝備）：使用變形卷軸時可指定變身型態。" },
        "acc_summon_ctrl": { n: "召喚控制戒指", type: "acc", slot: "ring", ac: 0, req: "all", safe: 0, p: 50000, gachaWeight: 1, unique: true, d: "召喚師夢寐以求的戒指，能讓喚出的眷屬更聽從號令、更難失手。裝備後，召喚物命中 +5，且擲骰 19 視為命中。" },
        "rng_earth": { n: "地靈戒指", type: "acc", slot: "ring", ac: 0, resEarth: 10, req: "all", safe: 0, p: 50000, gachaWeight: 1, d: "封存著厚土脈動的戒指，握之如握住一方大地。蘊含大地之力的戒指。" },
        "rng_water": { n: "水靈戒指", type: "acc", slot: "ring", ac: 0, resWater: 10, req: "all", safe: 0, p: 50000, gachaWeight: 1, d: "封存著潺潺水靈的戒指，指尖彷彿淌過清泉。蘊含流水之力的戒指。" },
        "rng_wind": { n: "風靈戒指", type: "acc", slot: "ring", ac: 0, resWind: 10, req: "all", safe: 0, p: 50000, gachaWeight: 1, d: "封存著疾風精魄的戒指，戴上便覺步履輕盈。蘊含疾風之力的戒指。" },
        "rng_fire": { n: "火靈戒指", type: "acc", slot: "ring", ac: 0, resFire: 10, req: "all", safe: 0, p: 50000, gachaWeight: 1, d: "封存著熾烈火魂的戒指，掌心始終餘有一絲溫熱。蘊含烈焰之力的戒指。" },
        "sherine_crystal": { n: "席琳結晶", type: "etc", p: 0, noUse: true, c: "c-sherine", gachaWeight: 0, d: "蘊含席琳力量的珍貴結晶，無法直接使用。進行「席琳製作」時加入材料，可使成品必定附帶一種席琳套裝效果。（席琳的世界掉落限定）" },   // 🔮 潘朵拉抽不到(gachaWeight:0)、無法使用(noUse)、名稱同套裝綠光(c-sherine)
        "item_dragon_claw": { n: "飛龍的爪子", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "鋒利如刃的巨爪，仍殘留著撕裂風與骨的記憶，似乎與龍之谷深處的傳說有關……（無法使用）" },   // 🔧 卡瑞任務道具：飛龍 1% 掉落
        "item_lizard_horn": { n: "蜥蜴的角", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "邪惡蜥蜴額上隆起的尖角，泛著爬蟲類特有的冷光，似乎與龍之谷深處的傳說有關……（無法使用）" },   // 🔧 卡瑞任務道具：邪惡蜥蜴 0.01% 掉落
        "item_crystal_ball": { n: "水晶球", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "巫師用以窺探命運的水晶球，霧色在其中緩緩流轉，似乎與龍之谷深處的傳說有關……（無法使用）" },   // 🔧 卡瑞任務道具：巫師 0.01% 掉落
        "item_orc_amulet": { n: "妖魔戰士護身符", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "妖魔戰士臨陣時緊握於掌心的護身符，沾染著舊日的血與汗，似乎與龍之谷深處的傳說有關……（無法使用）" },   // 🔧 卡瑞任務道具：五種妖魔各 0.01% 掉落
        "item_death_oath": { n: "死亡誓約", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "自強盜屍身上奪來、以鮮血簽署的死亡契約，字裡行間仍透著怨毒。可在沉默洞穴交給「倫得」交換影子手套。（無法使用）" },   // 🔧 任務道具：強盜 1% 掉落
        "item_orc_elder_head": { n: "妖魔長老首級", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "妖魔法師頂禮膜拜、供奉於暗壇的妖魔長老首級。可在沉默洞穴交給「康」交換影子面具。（無法使用）" },   // 🔧 任務道具：妖魔法師 1% 掉落
        "item_yeti_head": { n: "雪怪首級", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "自暴雪中的雪怪斬下、猶帶寒霜的巨大首級。可在沉默洞穴交給「布魯迪卡」交換影子長靴。（無法使用）" },   // 🔧 任務道具：雪怪 1% 掉落
        "item_mastery_proof": { n: "精通之證", p: 0, c: "text-blue-300", noUse: true, noSell: true, gachaWeight: 0, d: "證明你已踏碎自身極限的徽記，灼灼生輝。帶回威頓村交給「漢」，便能開啟職業精通之路。（唯一・無法存入倉庫・無法販售）" },   // 🏅 精通任務道具
        "item_dragon_egg": { n: "幼龍蛋", type: "etc", req: "all", p: 0, c: "text-amber-300", noUse: true, maxHold: 1, gachaWeight: 0, d: "一顆尚在沉睡的幼龍蛋，蛋殼下彷彿有風在流動。擊敗安塔瑞斯／法利昂／巴拉卡斯必得。持有時於任何野外地圖有極微小機率引來傳說中的風龍「林德拜爾」；售價 0，但可隨時賣出以中止這份危險的緣分。（唯一・無法存入倉庫）" },   // 🐉 林德拜爾遭遇觸發道具
        "item_soul_orb": { n: "靈魂之球", type: "misc", p: 0, c: "text-slate-200", eff: "soulorb", gachaWeight: 0, d: "蘊含微弱靈魂之力的水晶球，貼近耳邊彷彿能聽見低語。據說與某把失去魔力的魔杖共鳴時，能喚回沉睡的傳說。" },   // 🔧 巴列斯任務道具（可使用）
        // ===== 🗼 傲慢之塔：道具／素材／裝備 =====（封印傳送符 item_pride_sealed_* 由 initPrideTalismans 程式化產生）
        "mat_chimera_snake":  { n: "奇美拉之皮(蛇)",   type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "奇美拉身上蛇之部位的堅韌皮革。可在傲慢之塔入口交給巴姆特，製作 詛咒的皮革(地)。（製作材料）" },
        "mat_chimera_dragon": { n: "奇美拉之皮(龍)",   type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "奇美拉身上龍之部位的堅韌皮革。可在傲慢之塔入口交給巴姆特，製作 詛咒的皮革(水)。（製作材料）" },
        "mat_chimera_goat":   { n: "奇美拉之皮(山羊)", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "奇美拉身上山羊之部位的堅韌皮革。可在傲慢之塔入口交給巴姆特，製作 詛咒的皮革(風)。（製作材料）" },
        "mat_chimera_lion":   { n: "奇美拉之皮(獅子)", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "奇美拉身上獅子之部位的堅韌皮革。可在傲慢之塔入口交給巴姆特，製作 詛咒的皮革(火)。（製作材料）" },
        "mat_cursed_leather_earth": { n: "詛咒的皮革(地)", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "被大地之詛咒浸染的皮革。製作 地屬性斗篷 的材料。（製作材料）" },
        "mat_cursed_leather_water": { n: "詛咒的皮革(水)", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "被流水之詛咒浸染的皮革。製作 水屬性斗篷 的材料。（製作材料）" },
        "mat_cursed_leather_wind":  { n: "詛咒的皮革(風)", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "被疾風之詛咒浸染的皮革。製作 風屬性斗篷 的材料。（製作材料）" },
        "mat_cursed_leather_fire":  { n: "詛咒的皮革(火)", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "被烈焰之詛咒浸染的皮革。製作 火屬性斗篷 的材料。（製作材料）" },
        "wpn_crystal_dagger": { n: "水晶短劍", type: "wpn", dmgS: 10, dmgL: 4, hit: 0, dmgBonus: 1, spd: 0.8, req: "all", safe: 6, p: 18000, gachaWeight: 10, d: "以整塊水晶細細打磨而成的鋒利匕首，刃緣割裂血肉，攻擊帶有出血。" },
        "arm_pride_medusa_shield": { n: "梅杜莎盾牌", type: "arm", slot: "shield", ac: 2, immStone: true, req: "all", safe: 4, p: 9600, gachaWeight: 10, block: 40, d: "盾面鑲嵌著梅杜莎之眼的圓盾，那凝視至今仍令觸者心生寒意。" },
        "acc_jenis_ring": { n: "潔尼斯戒指", legend: true, type: "acc", slot: "ring", ac: 0, immPoison: true, req: "all", safe: 0, p: 250000, gachaWeight: 1, d: "潔尼斯女王曾佩於指間的戒指，王者氣度不減。也免疫麻痺。" },
        "clk_pride_earth": { n: "地屬性斗篷", type: "arm", slot: "cloak", ac: 3, resEarth: 10, mpR: 2, req: "all", safe: 4, p: 150000, gachaWeight: 0 },
        "clk_pride_water": { n: "水屬性斗篷", type: "arm", slot: "cloak", ac: 3, resWater: 10, mpR: 2, req: "all", safe: 4, p: 150000, gachaWeight: 0 },
        "clk_pride_fire":  { n: "火屬性斗篷", type: "arm", slot: "cloak", ac: 3, resFire: 10,  mpR: 2, req: "all", safe: 4, p: 150000, gachaWeight: 0 },
        "clk_pride_wind":  { n: "風屬性斗篷", type: "arm", slot: "cloak", ac: 3, resWind: 10,  mpR: 2, req: "all", safe: 4, p: 150000, gachaWeight: 1 },
        "bot_dark": { n: "黑暗長靴", type: "arm", slot: "boots", ac: 2, dex: 1, req: "dark", safe: 6, p: 37000, gachaWeight: 10 },
        "hlm_dark": { n: "黑暗頭飾", type: "arm", slot: "helm", ac: 1, mpR: 3, req: "dark", safe: 4, p: 7000, gachaWeight: 30 },
        "shd_phantom_eye": { n: "幻象眼魔的心眼", type: "arm", slot: "shield", ac: 0, int: 1, mmp: 100, mpR: 2, immStone: true, block: 10, req: "mage", safe: 6, p: 127000, gachaWeight: 1, legend: true, d: "挖自幻象眼魔的核心之眼，凝視深處仍翻湧著扭曲的幻象。" },
        "clk_marcus": { n: "馬昆斯斗篷", legend: true, type: "arm", slot: "cloak", ac: 2, mhp: 60, hpR: 4, mr: 3, mrPerEn: 3, req: "mage,dark", safe: 6, p: 123000, gachaWeight: 1 },
        "clk_silver_light": { n: "銀光斗篷", type: "arm", slot: "cloak", ac: 2, mpR: 4, mr: 15, req: "mage,elf,dark", safe: 4, p: 63000, gachaWeight: 1 },
        "clk_lich": { n: "巫妖斗篷", legend: true, type: "arm", slot: "armor", ac: 7, mmp: 50, mpR: 15, mdmgEnFrom4: true, req: "mage", safe: 4, p: 363000, gachaWeight: 1, d: "巫妖未散的怨念縈繞其上的法袍，愈是浸染暗魔力愈見威能。強化 +4 時魔法傷害 +1，之後每強化 +1 魔法傷害再 +1，最高 +9（魔法傷害 +6）；+10 以上不再額外增加。" },
        "hlm_demon": { n: "惡魔頭盔", legend: true, type: "arm", slot: "helm",   ac: 2, req: "all", safe: 4, p: 25000, gachaWeight: 1, d: "惡魔套裝之一。<br>【惡魔套裝】頭盔＋盔甲＋手套＋長靴 集齊：AC-2、HP自然恢復+5、變身「惡魔」（額外傷害+4、額外命中+4、魔法傷害+3、額外MP+3、MP自然恢復+3、攻速+33%，可與加速/勇敢/餅乾疊加）。" },
        "amr_demon": { n: "惡魔盔甲", legend: true, type: "arm", slot: "armor",  ac: 6, req: "all", safe: 4, p: 33000, gachaWeight: 1, d: "惡魔套裝之一。<br>【惡魔套裝】頭盔＋盔甲＋手套＋長靴 集齊：AC-2、HP自然恢復+5、變身「惡魔」（額外傷害+4、額外命中+4、魔法傷害+3、額外MP+3、MP自然恢復+3、攻速+33%，可與加速/勇敢/餅乾疊加）。" },
        "glv_demon": { n: "惡魔手套", legend: true, type: "arm", slot: "gloves", ac: 2, req: "all", safe: 4, p: 18000, gachaWeight: 1, d: "惡魔套裝之一。<br>【惡魔套裝】頭盔＋盔甲＋手套＋長靴 集齊：AC-2、HP自然恢復+5、變身「惡魔」（額外傷害+4、額外命中+4、魔法傷害+3、額外MP+3、MP自然恢復+3、攻速+33%，可與加速/勇敢/餅乾疊加）。" },
        "bot_demon": { n: "惡魔長靴", legend: true, type: "arm", slot: "boots",  ac: 3, req: "all", safe: 4, p: 18000, gachaWeight: 1, d: "惡魔套裝之一。<br>【惡魔套裝】頭盔＋盔甲＋手套＋長靴 集齊：AC-2、HP自然恢復+5、變身「惡魔」（額外傷害+4、額外命中+4、魔法傷害+3、額外MP+3、MP自然恢復+3、攻速+33%，可與加速/勇敢/餅乾疊加）。" },
        "rng_mr": { n: "抗魔戒指", type: "acc", slot: "ring", ac: 0, mr: 5, req: "all", safe: 0, p: 10000, gachaWeight: 1 },
        "acc_demonbane": { n: "滅魔戒指", type: "acc", slot: "ring", ac: 0, mr: 10, req: "all", safe: 0, p: 100000, gachaWeight: 1, d: "蘊含滅魔之力的戒指。" },
        "acc_doro": { n: "多羅戒指", type: "acc", slot: "ring", ac: 0, mhp: 5, weightCap: 5, req: "all", safe: 0, p: 20000, gachaWeight: 20, d: "多羅的戒指。HP+5、負重上限 +5。" },
        "hlm_mummy_crown": { n: "木乃伊王的王冠", type: "arm", slot: "helm", ac: 2, hpR: 3, dex: 2, req: "elf,dark", safe: 6, p: 163000, legend: true, gachaWeight: 1, d: "自木乃伊王枯朽的頭顱上取下的黃金王冠，千年塵封下金光依舊。" },
        "acc_118": { n: "守護戒指", type: "acc", slot: "ring", ac: 1, req: "all", safe: 0, p: 10000, gachaWeight: 1 },
        "acc_119": { n: "長者戒指", type: "acc", slot: "ring", ac: 0, req: "all", safe: 0, p: 10000, mmp: 10, mpR: 1, gachaWeight: 1 },
        "amu_str": { n: "力量項鍊", type: "acc", slot: "amulet", ac: 0, req: "all", safe: 0, p: 25000, str: 1, gachaWeight: 1 },
        "acc_120": { n: "敏捷項鍊", type: "acc", slot: "amulet", ac: 0, req: "all", safe: 0, p: 25000, dex: 1, gachaWeight: 1 },
        "acc_121": { n: "體質項鍊", type: "acc", slot: "amulet", ac: 0, req: "all", safe: 0, p: 25000, con: 1, gachaWeight: 1 },
        "amu_int": { n: "智力項鍊", type: "acc", slot: "amulet", ac: 0, req: "all", safe: 0, p: 25000, int: 1, gachaWeight: 1 },
        "acc_122": { n: "精神項鍊", type: "acc", slot: "amulet", ac: 0, req: "all", safe: 0, p: 25000, wis: 1, gachaWeight: 1 },
        "amu_cha": { n: "魅力項鍊", type: "acc", slot: "amulet", ac: 0, req: "all", safe: 0, p: 100000, cha: 1, gachaWeight: 1 },
        "amu_iris": { n: "艾莉絲項鍊", type: "acc", slot: "amulet", ac: 0, cha: 3, req: "mage", safe: 0, p: 300000, legend: true, gachaWeight: 1, d: "冷酷的艾莉絲貼身佩戴的項鍊，鍊墜映著她無情的眼神。" },
        "acc_123": { n: "妖魔戰士項鍊", type: "acc", slot: "amulet", ac: 0, req: "all", safe: 0, p: 5000, mhp: 20, gachaWeight: 20 },
        "acc_124": { n: "守護項鍊", type: "acc", slot: "amulet", ac: 1, req: "all", safe: 0, p: 15000, gachaWeight: 1 },
        "acc_125": { n: "長老項鍊", type: "acc", slot: "amulet", ac: 0, req: "all", safe: 0, p: 20000, mmp: 30, mpR: 1, gachaWeight: 1 },
        "acc_126": { n: "抗魔項鍊", type: "acc", slot: "amulet", ac: 0, mr: 5, req: "all", safe: 0, p: 15000, gachaWeight: 1 },
        "acc_127": { n: "老舊的身體腰帶", type: "acc", slot: "belt", ac: 0, req: "all", safe: 0, p: 3000, mhp: 30, gachaWeight: 20 },
        "acc_128": { n: "老舊的精神腰帶", type: "acc", slot: "belt", ac: 0, req: "all", safe: 0, p: 3000, mmp: 30, gachaWeight: 20 },
        "acc_129": { n: "老舊的靈魂腰帶", type: "acc", slot: "belt", ac: 0, req: "all", safe: 0, p: 3000, mhp: 15, mmp: 15, gachaWeight: 20 },
        "blt_body": { n: "身體腰帶", type: "acc", slot: "belt", ac: 0, req: "all", safe: 0, p: 7000, mhp: 50, gachaWeight: 10 },
        "blt_dark": { n: "黑暗腰帶", type: "acc", slot: "belt", ac: 1, req: "dark", safe: 0, p: 21000, gachaWeight: 10 },
        // ===== 魔獸軍王巴蘭卡：掉落防具（武官系列／巴蘭卡系列） =====
        "hlm_official":   { n: "武官頭盔", type: "arm", slot: "helm",   ac: 2, mmp: 10,                 req: "knight,dark",     safe: 6, p: 9600,   gachaWeight: 10 },
        "hlm_baranka":    { n: "巴蘭卡頭盔", type: "arm", slot: "helm", ac: 2, con: 1, cha: -1,         req: "knight,elf,dark", safe: 4, p: 39600,  gachaWeight: 1 },
        "amr_official":   { n: "武官護鎧", type: "arm", slot: "armor",  ac: 4, mhp: 50, hpR: 10,        req: "knight",          safe: 6, p: 24600,  gachaWeight: 10 },
        "amr_baranka":    { n: "巴蘭卡盔甲", type: "arm", slot: "armor", ac: 8, str: 1, dex: 1, cha: -2, req: "knight",          safe: 4, p: 134600, gachaWeight: 1 },
        "glv_baranka":    { n: "巴蘭卡手套", type: "arm", slot: "gloves", ac: 3,                        req: "knight,elf,dark", safe: 4, p: 73000,  gachaWeight: 1 },
        "bot_baranka":    { n: "巴蘭卡長靴", type: "arm", slot: "boots", ac: 3,                         req: "all",             safe: 4, p: 63000,  gachaWeight: 1 },
        // ===== 四大軍王套裝（傳統套裝；4 件齊：HP+30/MP+30/HP恢復+10/MP恢復+10/魅力+3） =====
        "bot_kingbeast":    { n: "魔獸軍王長靴", legend: true, type: "arm", slot: "boots",  ac: 4, req: "all", safe: 6, p: 133000, gachaWeight: 1, d: "四大軍王套裝之一。<br><span class='text-amber-300'>【四大軍王套裝】冥法軍王斗篷／法令軍王長袍／暗殺軍王手套／魔獸軍王長靴 集齊：HP+30、MP+30、HP自然恢復+10、MP自然恢復+10、魅力+3。</span>" },
        "clk_kingnecro":    { n: "冥法軍王斗篷", legend: true, type: "arm", slot: "cloak",  ac: 5, req: "all", safe: 4, p: 153000, gachaWeight: 1, d: "四大軍王套裝之一。<br><span class='text-amber-300'>【四大軍王套裝】冥法軍王斗篷／法令軍王長袍／暗殺軍王手套／魔獸軍王長靴 集齊：HP+30、MP+30、HP自然恢復+10、MP自然恢復+10、魅力+3。</span>" },
        "amr_kinglaw":      { n: "法令軍王長袍", legend: true, type: "arm", slot: "armor",  ac: 8, req: "all", safe: 6, p: 178000, gachaWeight: 1, d: "四大軍王套裝之一。<br><span class='text-amber-300'>【四大軍王套裝】冥法軍王斗篷／法令軍王長袍／暗殺軍王手套／魔獸軍王長靴 集齊：HP+30、MP+30、HP自然恢復+10、MP自然恢復+10、魅力+3。</span>" },
        "glv_kingassassin": { n: "暗殺軍王手套", legend: true, type: "arm", slot: "gloves", ac: 4, req: "all", safe: 6, p: 145000, gachaWeight: 1, d: "四大軍王套裝之一。<br><span class='text-amber-300'>【四大軍王套裝】冥法軍王斗篷／法令軍王長袍／暗殺軍王手套／魔獸軍王長靴 集齊：HP+30、MP+30、HP自然恢復+10、MP自然恢復+10、魅力+3。</span>" },
        // ===== 冥法軍訓練場：掉落防具（神官系列／黑暗披肩） =====
        "hlm_priest":    { n: "神官頭飾", type: "arm", slot: "helm",   ac: 1, mhp: 10, mpR: 1, req: "mage,elf", safe: 6, p: 15900, gachaWeight: 10 },
        "amr_priest":    { n: "神官法袍", type: "arm", slot: "armor",  ac: 6, mhp: 10, mpR: 5, req: "mage,elf", safe: 6, p: 25900, gachaWeight: 10 },
        "amr_dark_cape": { n: "黑暗披肩", type: "arm", slot: "armor",  ac: 5, hpR: 5,          req: "dark",     safe: 6, p: 10000, gachaWeight: 20 },
        "bot_priest":    { n: "神官長靴", type: "arm", slot: "boots",  ac: 2, mhp: 5,          req: "mage,elf", safe: 6, p: 18900, gachaWeight: 10 },
        "clk_priest":    { n: "神官斗篷", type: "arm", slot: "cloak",  ac: 2, mhp: 10, mpR: 3, req: "mage,elf", safe: 4, p: 18900, gachaWeight: 10 },
        "glv_priest":    { n: "神官手套", type: "arm", slot: "gloves", ac: 0, mhp: 5,  mpR: 1, req: "mage,elf", safe: 6, p: 15500, gachaWeight: 10 },
        // ===== 巨蟻女皇：掉落斗篷（MR 隨強化成長） =====
        "clk_antqueen_gold":   { n: "巨蟻女皇的金翅膀", legend: true, type: "arm", slot: "cloak", ac: 4, mhp: 50,                mr: 5, mrPerEn: 2, req: "knight,elf",   safe: 4, p: 337200, gachaWeight: 1 },
        "clk_antqueen_silver": { n: "巨蟻女皇的銀翅膀", legend: true, type: "arm", slot: "cloak", ac: 2, mmp: 50, wis: 1, mpR: 3, mr: 5, mrPerEn: 2, req: "elf,mage,dark", safe: 4, p: 337200, gachaWeight: 1 },
        "acc_130": { n: "精神腰帶", type: "acc", slot: "belt", ac: 0, req: "all", safe: 0, p: 7000, mmp: 50, gachaWeight: 10 },
        "acc_131": { n: "靈魂腰帶", type: "acc", slot: "belt", ac: 0, req: "all", safe: 0, p: 7000, mhp: 25, mmp: 25, gachaWeight: 10 },
        "acc_132": { n: "多羅皮帶", type: "acc", slot: "belt", ac: 0, req: "all", safe: 0, p: 2000, weightCap: 160, gachaWeight: 10 },   // 🔧 取消體質+1，改為負重上限+160；全職業可裝備
        "acc_133": { n: "歐吉皮帶", type: "acc", slot: "belt", ac: 0, req: "all", safe: 0, p: 15000, weightCap: 320, gachaWeight: 1 },   // 🔧 取消力量+1，改為負重上限+320
        "acc_134": { n: "勇敢皮帶", type: "acc", slot: "belt", ac: 1, req: "knight", safe: 0, p: 2000, mhp: 30, gachaWeight: 10 },
        "acc_135": { n: "光明身體腰帶", type: "acc", slot: "belt", ac: 0, req: "all", safe: 0, p: 11000, mhp: 50, hpR: 1, gachaWeight: 0 },
        "acc_136": { n: "光明精神腰帶", type: "acc", slot: "belt", ac: 0, req: "all", safe: 0, p: 11000, mmp: 50, mpR: 1, gachaWeight: 0 },
        "acc_137": { n: "光明靈魂腰帶", type: "acc", slot: "belt", ac: 0, req: "all", safe: 0, p: 11000, mhp: 20, mmp: 20, hpR: 1, mpR: 1, gachaWeight: 0 },
        "acc_138": { n: "守護皮帶", type: "acc", slot: "belt", ac: 0, req: "all", safe: 0, p: 11000, weightCap: 130, gachaWeight: 1 },   // 🔧 AC改為0，增加負重上限+130
		"blt_mr": { n: "抗魔皮帶", type: "acc", slot: "belt", ac: 0, req: "all", safe: 0, p: 11000, weightCap: 130, gachaWeight: 1 },   // 🔧 取消MR+5，增加負重上限+130
        "blt_titan": { n: "泰坦皮帶", type: "acc", slot: "belt", ac: 0, weightCap: 500, req: "all", safe: 0, p: 92000, gachaWeight: 1, d: "傳說中泰坦束於腰間的巨帶，承載著撼動山岳之力。負重上限 +500。" },
        "blt_giant_ring": { n: "古代巨人戒指", type: "acc", slot: "belt", legend: true, ac: 2, str: 1, req: "all", safe: 0, p: 352000, gachaWeight: 1, d: "雖名為戒指，實為古代巨人腰間的一環，於常人已是一圈鐵帶（部位：腰帶）。力量 +1。" },
        "potion_heal": { n: "紅色藥水", type: "pot", p: 37, c: "text-red-300", d: "恢復 15 HP", val: 15, gachaWeight: 0 },
        "potion_strong": { n: "橙色藥水", type: "pot", req: "all", p: 200, c: "text-orange-300", d: "恢復 40 HP", val: 40, gachaWeight: 0 },
        "potion_ult": { n: "白色藥水", type: "pot", req: "all", p: 600, c: "text-white", d: "恢復 60 HP", val: 60, gachaWeight: 0 },
        "potion_haste": { n: "自我加速藥水", type: "pot", req: "all", p: 200, c: "text-green-300", d: "玩家攻擊速度加快33%，持續300秒", eff: "haste", dur: 300, gachaWeight: 0 },
        "potion_blue": { n: "藍色藥水", type: "pot", req: "all", p: 1046, c: "text-blue-300", d: "精神10以下MP恢復+1，11以上大幅增加，持續600秒", eff: "blue", dur: 600, gachaWeight: 0 },
        "potion_brave": { n: "勇敢藥水", type: "pot", req: "knight,dragon,warrior,royal", p: 880, c: "text-purple-300", d: "騎士／龍騎士／戰士／王族限定，玩家攻擊速度加快33%（可與加速／覺醒／變身相乘疊加），持續300秒", eff: "brave", dur: 300, gachaWeight: 0 },
        "new_item_139": { n: "精靈餅乾", type: "pot", req: "elf", p: 1980, c: "text-yellow-200", d: "妖精限定，攻擊速度加快15%，持續300秒", eff: "elfcookie", dur: 300, gachaWeight: 0 },
        "new_item_140": { n: "慎重藥水", type: "pot", req: "mage,illusion", p: 600, c: "text-purple-300", d: "法師／幻術士限定，魔法傷害+2、MP恢復+2，持續300秒", eff: "cautious", dur: 300, gachaWeight: 0 },
        "new_item_141": { n: "安特的水果", type: "pot", req: "all", p: 360, c: "text-green-300", d: "恢復 44~107 HP（僅能手動使用）", gachaWeight: 0 },
        "scroll_poly": { n: "變形卷軸", type: "scroll", req: "all", p: 1300, c: "text-gray-300", d: "根據玩家等級改變外觀與能力，持續1800秒", eff: "poly", dur: 1800, gachaWeight: 0 },
        "scroll_magicbarrier": { n: "魔法卷軸(魔法屏障)", type: "scroll", req: "all", p: 1500, c: "text-cyan-300", d: "使用後獲得「魔法屏障」狀態，持續16秒；成功抵擋一次技能傷害後3秒內無法再次施放（自然到期或取消則無冷卻）", eff: "magicbarrier", gachaWeight: 0 },
        "scroll_teleport": { n: "瞬間移動卷軸", type: "scroll", req: "all", p: 82, c: "text-sky-300", d: "使用後發動傳送術", eff: "teleport_scroll", gachaWeight: 0 },
        "scroll_revive": { n: "復活卷軸", type: "scroll", req: "all", p: 1000, c: "text-yellow-300", d: "持有死亡後可選擇原地復活，冷卻15秒", gachaWeight: 0 },
        "item_blueflute": { n: "藍色長笛", p: 1, c: "text-blue-300", d: "試煉所需的材料。", gachaWeight: 0 },   // 🔧 試煉材料統一藍色
        "item_ancientkey": { n: "古代鑰匙", p: 1, c: "text-blue-300", d: "試煉所需的材料。", gachaWeight: 0 },   // 🔧 試煉材料統一藍色
        "item_nightvision": { n: "夜之視野", p: 1, c: "text-blue-300", d: "凝視黑暗也不失方向的祕術之眼，試煉所需的材料。", gachaWeight: 0 },
        "candle": { n: "回憶蠟燭", type: "misc", req: "all", p: 100000, c: "text-red-500", d: "點擊使用：六大屬性回到 Lv1，於資訊面板以 +／- 重新分配能力點數，按「確認」才生效（按「取消」則不消耗蠟燭）。同時退還已使用的萬能藥、賣出並解除所有寵物項圈。", eff: "reset", gachaWeight: 0 },
        "panacea_str": { n: "萬能藥(STR)", type: "misc", req: "all", p: 10000, c: "text-pink-300", d: "傳說中能重塑筋骨的靈藥。可永久提升力量+1，直到使用回憶蠟燭為止（最多60瓶，不可突破屬性上限60）", eff: "panacea", pstat: "str", plv: 50, gachaWeight: 10 },
        "panacea_dex": { n: "萬能藥(DEX)", type: "misc", req: "all", p: 10000, c: "text-pink-300", d: "飲下後身手如風的靈藥。可永久提升敏捷+1，直到使用回憶蠟燭為止（最多60瓶，不可突破屬性上限60）", eff: "panacea", pstat: "dex", plv: 50, gachaWeight: 10 },
        "panacea_con": { n: "萬能藥(CON)", type: "misc", req: "all", p: 10000, c: "text-pink-300", d: "淬鍊體魄、固本培元的靈藥。可永久提升體質+1，直到使用回憶蠟燭為止（最多60瓶，不可突破屬性上限60）", eff: "panacea", pstat: "con", plv: 50, gachaWeight: 10 },
        "panacea_int": { n: "萬能藥(INT)", type: "misc", req: "all", p: 10000, c: "text-pink-300", d: "啟迪心智、開悟靈光的靈藥。可永久提升智力+1，直到使用回憶蠟燭為止（最多60瓶，不可突破屬性上限60）", eff: "panacea", pstat: "int", plv: 50, gachaWeight: 10 },
        "panacea_wis": { n: "萬能藥(WIS)", type: "misc", req: "all", p: 10000, c: "text-pink-300", d: "沉澱心神、堅定意志的靈藥。可永久提升精神+1，直到使用回憶蠟燭為止（最多60瓶，不可突破屬性上限60）", eff: "panacea", pstat: "wis", plv: 50, gachaWeight: 10 },
        "panacea_white": { n: "純白的萬能藥", type: "misc", req: "all", p: 5000, c: "text-slate-100", noUse: true, d: "純白無瑕、尚未沾染屬性的萬能藥原料（無法直接使用，僅作製作材料）。使用回憶蠟燭重置配點時，依已使用過的萬能藥瓶數獲得。可在象牙塔的塔斯處，以 3 個製作成任一屬性的萬能藥。", gachaWeight: 0 },
        "panacea_cha": { n: "萬能藥(CHA)", type: "misc", req: "all", p: 10000, c: "text-pink-300", d: "令人顧盼生輝、風采動人的靈藥。可永久提升魅力+1，直到使用回憶蠟燭為止（最多60瓶，不可突破屬性上限60）", eff: "panacea", pstat: "cha", plv: 50, gachaWeight: 0 },
        
        "new_item_142": { n: "哨子", type: "pot", req: "all", p: 165, d: "可用於呼叫或解散寵物", eff: "whistle", gachaWeight: 0 },
        "new_item_collar_husky": { n: "項圈 (哈士奇)", p: 10, gachaWeight: 0 },
        "new_item_238": { n: "項圈 (牧羊犬)", p: 10, gachaWeight: 0 },
        // ===== 🐾 寵物進化系統：進化果實（消耗道具，Lv30+且有對應基礎項圈才能使用）=====
        "new_fruit_rabbit":    { n: "進化果實：暴走兔", type: "pot", req: "all", p: 0, c: "text-green-300", eff: "evolve", evolveFrom: "new_item_collar_husky", evolveTo: "new_collar_rabbit", d: "玩家等級30以上、且持有 項圈 (哈士奇) 時可使用：將一個 項圈 (哈士奇) 進化為 項圈 (暴走兔)。", gachaWeight: 0 },
        "new_fruit_fox":       { n: "進化果實：狐狸",   type: "pot", req: "all", p: 0, c: "text-green-300", eff: "evolve", evolveFrom: "new_item_184",          evolveTo: "new_collar_fox",    d: "玩家等級30以上、且持有 項圈 (杜賓狗) 時可使用：將一個 項圈 (杜賓狗) 進化為 項圈(狐狸)。", gachaWeight: 0 },
        "new_fruit_beagle":    { n: "進化果實：小獵犬", type: "pot", req: "all", p: 0, c: "text-green-300", eff: "evolve", evolveFrom: "new_item_238",          evolveTo: "new_collar_beagle", d: "玩家等級30以上、且持有 項圈 (牧羊犬) 時可使用：將一個 項圈 (牧羊犬) 進化為 項圈(小獵犬)。", gachaWeight: 0 },
        "new_fruit_stbernard": { n: "進化果實：聖伯納", type: "pot", req: "all", p: 0, c: "text-green-300", eff: "evolve", evolveFrom: "new_item_185",          evolveTo: "new_collar_stbernard", d: "玩家等級30以上、且持有 項圈 (狼) 時可使用：將一個 項圈 (狼) 進化為 項圈 (聖伯納)。", gachaWeight: 0 },
        // 進化項圈（呼叫進化夥伴所需；不可存倉）
        "new_collar_rabbit":    { n: "項圈 (暴走兔)",  p: 10, c: "text-cyan-300", gachaWeight: 0 },
        "new_collar_fox":       { n: "項圈 (狐狸)",   p: 10, c: "text-orange-300", gachaWeight: 0 },
        "new_collar_beagle":    { n: "項圈 (小獵犬)", p: 10, c: "text-amber-300", gachaWeight: 0 },
        "new_collar_stbernard": { n: "項圈 (聖伯納)",  p: 10, c: "text-emerald-300", gachaWeight: 0 },
        // 不死鳥之心（製作材料，不死鳥 1% 掉落）
        "new_phoenix_heart": { n: "不死鳥之心", type: "etc", p: 0, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "不死鳥體內不滅的核心。製作材料。" },
        // ===== 🦴 寵物裝備（之牙）：裝在「寵物裝備」欄，能力只影響項圈夥伴，可用對飾品施法的卷軸強化至+5 =====
        "pet_fang_hound":   { n: "獵犬之牙", type: "acc", slot: "pet", req: "all", safe: 0, p: 10000,  c: "text-white", petHit: 2,            d: "獵犬的尖牙磨成的護符，喚醒項圈夥伴的野性。寵物裝備（裝在「寵物裝備」欄，只加成所有項圈夥伴、不影響玩家；對飾品施法的卷軸可強化，上限+5）。", gachaWeight: 10 },
        "pet_fang_steel":   { n: "鋼鐵之牙", type: "acc", slot: "pet", req: "all", safe: 0, p: 10000,  c: "text-white", petDmg: 2,            d: "以鋼鐵鑄成的森冷利齒，使項圈夥伴撕咬更為兇猛。寵物裝備（裝在「寵物裝備」欄，只加成所有項圈夥伴、不影響玩家；對飾品施法的卷軸可強化，上限+5）。", gachaWeight: 10 },
        "pet_fang_ruin":    { n: "破滅之牙", type: "acc", slot: "pet", req: "all", safe: 0, p: 100000, c: "text-white", petDmg: 2, petHit: 3, d: "沾染破滅氣息的獠牙，令項圈夥伴的撕咬帶來毀滅。寵物裝備（裝在「寵物裝備」欄，只加成所有項圈夥伴、不影響玩家；對飾品施法的卷軸可強化，上限+5）。", gachaWeight: 0 },
        "pet_fang_victory": { n: "勝利之牙", type: "acc", slot: "pet", req: "all", safe: 0, p: 100000, c: "text-white", petDmg: 3, petHit: 1, d: "銘刻無數勝戰的榮耀之牙，激起項圈夥伴的鬥志。寵物裝備（裝在「寵物裝備」欄，只加成所有項圈夥伴、不影響玩家；對飾品施法的卷軸可強化，上限+5）。", gachaWeight: 0 },
        // 🪆 魔法娃娃（slot:doll·全職業·裝備後滑鼠游標變成 assets/doll/<物品名稱>.png；亦帶屬性加成）。dollTier=階級(1~6)；袋子開出/合成取得（價格0·無法強化·不可賣）。
        // 特殊效果引擎欄位：procBonusDmg{rate,dmg}=攻擊機率額外傷害、procPoisonRate=攻擊機率中毒、procSkill+procRateBase=攻擊機率觸發技能、procDmgReduce{rate,amount}=受傷機率減免、abnormalResist=機率抵抗異常、freezeResist/stunResist=抵抗(100=免疫)、immParalyze/immSlow/immPoison=免疫、expBonus/goldBonus=經驗/金錢%、potionBonus=藥水恢復%、weightCap=負重、er/magicHit/extraMp/mdmg=ER/魔法命中/額外魔點/固定魔傷。
        "doll_野狼寶寶":   { n: "魔法娃娃：野狼寶寶", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 1, noEnhance: true, gachaWeight: 0, c: "text-slate-200", procBonusDmg: { rate: 3, dmg: 15 }, d: "一階魔法娃娃。一般攻擊時 3% 機率該次攻擊額外傷害 +15。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_史巴托":     { n: "魔法娃娃：史巴托", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 1, noEnhance: true, gachaWeight: 0, c: "text-slate-200", procDmgReduce: { rate: 4, amount: 3 }, d: "一階魔法娃娃。受到傷害時 4% 機率傷害減免 3。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_奎斯坦修":   { n: "魔法娃娃：奎斯坦修", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 1, noEnhance: true, gachaWeight: 0, c: "text-slate-200", procBonusDmg: { rate: 3, dmg: 15 }, d: "一階魔法娃娃。一般攻擊時 3% 機率該次攻擊額外傷害 +15。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_稻草人":     { n: "魔法娃娃：稻草人", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 1, noEnhance: true, gachaWeight: 0, c: "text-slate-200", mhp: 50, d: "一階魔法娃娃。HP +50。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_蛇女":       { n: "魔法娃娃：蛇女", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 1, noEnhance: true, gachaWeight: 0, c: "text-slate-200", mpR: 4, procPoisonRate: 5, d: "一階魔法娃娃。MP 自然恢復 +4；攻擊時 5% 機率使目標中毒。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_肥肥":       { n: "魔法娃娃：肥肥", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 1, noEnhance: true, gachaWeight: 0, c: "text-slate-200", weightCap: 20, d: "一階魔法娃娃。負重上限 +20。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_希爾黛斯":   { n: "魔法娃娃：希爾黛斯", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 1, noEnhance: true, gachaWeight: 0, c: "text-slate-200", hpR: 10, d: "一階魔法娃娃。HP 自然恢復量 +10。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_石頭高崙":   { n: "魔法娃娃：石頭高崙", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 1, noEnhance: true, gachaWeight: 0, c: "text-slate-200", dr: 1, d: "一階魔法娃娃。傷害減免 +1。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_長老":       { n: "魔法娃娃：長老", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 2, noEnhance: true, gachaWeight: 0, c: "text-green-300", mpR: 4, d: "二階魔法娃娃。MP 自然恢復 +4。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_雪怪":       { n: "魔法娃娃：雪怪", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 2, noEnhance: true, gachaWeight: 0, c: "text-green-300", ac: 3, freezeResist: 5, d: "二階魔法娃娃。防禦力(AC) -3；5% 機率抵抗冰凍。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_亞力安":     { n: "魔法娃娃：亞力安", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 2, noEnhance: true, gachaWeight: 0, c: "text-green-300", rangedDmg: 1, rangedHit: 1, d: "二階魔法娃娃。遠距離傷害 +1、遠距離命中 +1。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_美人魚":     { n: "魔法娃娃：美人魚", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 2, noEnhance: true, gachaWeight: 0, c: "text-green-300", expBonus: 3, d: "二階魔法娃娃。獲得經驗值 +3%。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_小思克巴":   { n: "魔法娃娃：小思克巴", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 2, noEnhance: true, gachaWeight: 0, c: "text-green-300", mpR: 4, d: "二階魔法娃娃。MP 自然恢復 +4。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_巨人":       { n: "魔法娃娃：巨人", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 2, noEnhance: true, gachaWeight: 0, c: "text-green-300", meleeDmg: 1, meleeHit: 1, dr: 1, mhp: 50, d: "二階魔法娃娃。近距離傷害 +1、近距離命中 +1、傷害減免 +1、HP +50。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_王子":       { n: "魔法娃娃：王子", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 3, noEnhance: true, gachaWeight: 0, c: "text-sky-300", hpR: 15, weightCap: 15, str: 1, con: 1, d: "三階魔法娃娃。HP自然恢復+15、負重+15、力量+1、體質+1。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_公主":       { n: "魔法娃娃：公主", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 3, noEnhance: true, gachaWeight: 0, c: "text-sky-300", mpR: 5, weightCap: 15, str: 1, con: 1, d: "三階魔法娃娃。MP自然恢復+5、負重+15、力量+1、體質+1。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_男騎士":     { n: "魔法娃娃：男騎士", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 3, noEnhance: true, gachaWeight: 0, c: "text-sky-300", hpR: 15, con: 2, weightCap: 15, d: "三階魔法娃娃。HP自然恢復+15、體質+2、負重+15。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_女騎士":     { n: "魔法娃娃：女騎士", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 3, noEnhance: true, gachaWeight: 0, c: "text-sky-300", mpR: 5, con: 2, weightCap: 15, d: "三階魔法娃娃。MP自然恢復+5、體質+2、負重+15。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_男妖精":     { n: "魔法娃娃：男妖精", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 3, noEnhance: true, gachaWeight: 0, c: "text-sky-300", hpR: 15, dex: 2, weightCap: 15, d: "三階魔法娃娃。HP自然恢復+15、敏捷+2、負重+15。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_女妖精":     { n: "魔法娃娃：女妖精", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 3, noEnhance: true, gachaWeight: 0, c: "text-sky-300", mpR: 5, dex: 2, weightCap: 15, d: "三階魔法娃娃。MP自然恢復+5、敏捷+2、負重+15。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_男法師":     { n: "魔法娃娃：男法師", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 3, noEnhance: true, gachaWeight: 0, c: "text-sky-300", hpR: 15, int: 2, weightCap: 15, d: "三階魔法娃娃。HP自然恢復+15、智力+2、負重+15。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_女法師":     { n: "魔法娃娃：女法師", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 3, noEnhance: true, gachaWeight: 0, c: "text-sky-300", mpR: 5, int: 2, weightCap: 15, d: "三階魔法娃娃。MP自然恢復+5、智力+2、負重+15。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_男黑暗妖精": { n: "魔法娃娃：男黑暗妖精", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 3, noEnhance: true, gachaWeight: 0, c: "text-sky-300", hpR: 15, str: 1, dex: 1, weightCap: 15, d: "三階魔法娃娃。HP自然恢復+15、力量+1、敏捷+1、負重+15。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_女黑暗妖精": { n: "魔法娃娃：女黑暗妖精", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 3, noEnhance: true, gachaWeight: 0, c: "text-sky-300", mpR: 5, str: 1, dex: 1, weightCap: 15, d: "三階魔法娃娃。MP自然恢復+5、力量+1、敏捷+1、負重+15。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_男龍騎士":   { n: "魔法娃娃：男龍騎士", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 3, noEnhance: true, gachaWeight: 0, c: "text-sky-300", hpR: 15, str: 2, weightCap: 15, d: "三階魔法娃娃。HP自然恢復+15、力量+2、負重+15。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_女龍騎士":   { n: "魔法娃娃：女龍騎士", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 3, noEnhance: true, gachaWeight: 0, c: "text-sky-300", mpR: 5, str: 2, weightCap: 15, d: "三階魔法娃娃。MP自然恢復+5、力量+2、負重+15。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_男幻術士":   { n: "魔法娃娃：男幻術士", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 3, noEnhance: true, gachaWeight: 0, c: "text-sky-300", hpR: 15, int: 1, wis: 1, weightCap: 15, d: "三階魔法娃娃。HP自然恢復+15、智力+1、精神+1、負重+15。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_女幻術士":   { n: "魔法娃娃：女幻術士", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 3, noEnhance: true, gachaWeight: 0, c: "text-sky-300", mpR: 5, int: 1, wis: 1, weightCap: 15, d: "三階魔法娃娃。MP自然恢復+5、智力+1、精神+1、負重+15。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_思克巴女皇": { n: "魔法娃娃：思克巴女皇", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 3, noEnhance: true, gachaWeight: 0, c: "text-sky-300", mpR: 5, mdmg: 1, extraMp: 1, d: "三階魔法娃娃。MP自然恢復+5、魔法傷害+1、額外魔法點數+1。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_阿魯巴":     { n: "魔法娃娃：阿魯巴", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 4, noEnhance: true, gachaWeight: 0, c: "text-purple-300", rangedHit: 2, rangedDmg: 2, dex: 1, mhp: 25, mmp: 25, d: "四階魔法娃娃。遠距離命中+2、遠距離傷害+2、敏捷+1、HP+25、MP+25。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_墮落":       { n: "魔法娃娃：墮落", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 4, noEnhance: true, gachaWeight: 0, c: "text-purple-300", mpR: 3, mdmg: 2, magicHit: 5, abnormalResist: 10, d: "四階魔法娃娃。MP自然恢復+3、魔法傷害+2、魔法命中率+5；10% 機率抵抗異常狀態。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_變形怪":     { n: "魔法娃娃：變形怪", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 4, noEnhance: true, gachaWeight: 0, c: "text-purple-300", ac: 1, hpR: 5, mpR: 2, extraDmg: 1, extraHit: 2, weightCap: 20, d: "四階魔法娃娃。AC-1、HP自然恢復+5、MP自然恢復+2、額外傷害+1、額外命中+2、負重+20。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_飛龍":       { n: "魔法娃娃：飛龍", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 4, noEnhance: true, gachaWeight: 0, c: "text-purple-300", mpR: 5, er: 3, mr: 10, resFire: 3, d: "四階魔法娃娃。MP自然恢復+5、ER+3、MR+10、火屬性抗性+3。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_莫提斯":     { n: "魔法娃娃：莫提斯", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 4, noEnhance: true, gachaWeight: 0, c: "text-purple-300", mpR: 2, expBonus: 10, goldBonus: 10, weightCap: 80, d: "四階魔法娃娃。MP自然恢復+2、獲得經驗+10%、獲得金錢+10%、負重+80。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_黑長者":     { n: "魔法娃娃：黑長者", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 4, noEnhance: true, gachaWeight: 0, c: "text-purple-300", mpR: 10, int: 2, wis: 2, d: "四階魔法娃娃。MP自然恢復+10、智力+2、精神+2。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_獨眼巨人":   { n: "魔法娃娃：獨眼巨人", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 4, noEnhance: true, gachaWeight: 0, c: "text-purple-300", hpR: 30, str: 2, con: 2, d: "四階魔法娃娃。HP自然恢復+30、力量+2、體質+2。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_艾莉絲":     { n: "魔法娃娃：艾莉絲", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 5, noEnhance: true, gachaWeight: 0, c: "text-orange-300", mpR: 5, rangedDmg: 4, rangedHit: 3, d: "五階魔法娃娃。MP自然恢復+5、遠距離傷害+4、遠距離命中+3。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_木乃伊王":   { n: "魔法娃娃：木乃伊王", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 5, noEnhance: true, gachaWeight: 0, c: "text-orange-300", hpR: 20, mhp: 150, d: "五階魔法娃娃。HP自然恢復+20、HP+150。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_死亡騎士":   { n: "魔法娃娃：死亡騎士", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 5, noEnhance: true, gachaWeight: 0, c: "text-orange-300", hpR: 15, meleeDmg: 5, procSkill: "sk_blaze", procRateBase: 1, d: "五階魔法娃娃。HP自然恢復+15、近距離傷害+5；一般攻擊命中 1% 機率觸發烈炎術。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_巴風特":     { n: "魔法娃娃：巴風特", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 5, noEnhance: true, gachaWeight: 0, c: "text-orange-300", mpR: 3, mdmg: 1, magicHit: 1, procSkill: "sk_earthquake", procRateBase: 1, d: "五階魔法娃娃。MP自然恢復+3、魔法傷害+1、魔法命中+1；一般攻擊命中 1% 機率觸發地裂術。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_吸血鬼":     { n: "魔法娃娃：吸血鬼", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 5, noEnhance: true, gachaWeight: 0, c: "text-orange-300", hpR: 35, potionBonus: 10, er: 5, dr: 2, d: "五階魔法娃娃。HP自然恢復+35、藥水恢復量+10%、ER+5、傷害減免+2。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_克特":       { n: "魔法娃娃：克特", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 5, noEnhance: true, gachaWeight: 0, c: "text-orange-300", extraHit: 3, ac: 2, procSkill: "sk_thunder", procRateBase: 1, d: "五階魔法娃娃。額外命中+3、AC-2；一般攻擊命中 1% 機率觸發極道落雷。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_冰之女王":   { n: "魔法娃娃：冰之女王", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 5, noEnhance: true, gachaWeight: 0, c: "text-orange-300", mpR: 10, int: 2, wis: 2, resWater: 10, d: "五階魔法娃娃。MP自然恢復+10、智力+2、精神+2、冰屬性抗性+10。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_巴蘭卡":     { n: "魔法娃娃：巴蘭卡", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 5, noEnhance: true, gachaWeight: 0, c: "text-orange-300", meleeDmg: 3, meleeHit: 3, dr: 3, d: "五階魔法娃娃。近距離傷害+3、近距離命中+3、傷害減免+3。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_巫妖":       { n: "魔法娃娃：巫妖", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 5, noEnhance: true, gachaWeight: 0, c: "text-orange-300", mpR: 5, mdmg: 3, int: 2, mmp: 50, procDmgReduce: { rate: 5, amount: 5 }, d: "五階魔法娃娃。MP自然恢復+5、魔法傷害+3、智力+2、MP+50；受到傷害時 5% 機率傷害減免 5。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_安塔瑞斯":   { n: "魔法娃娃：安塔瑞斯", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 6, noEnhance: true, gachaWeight: 0, c: "text-red-400", hpR: 20, mpR: 10, resEarth: 20, ac: 5, mr: 10, mhp: 100, dr: 10, immPoison: true, immParalyze: true, d: "六階魔法娃娃。HP自然恢復+20、MP自然恢復+10、地屬性抗性+20、AC-5、MR+10、HP+100、傷害減免+10；免疫中毒、麻痺。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_法利昂":     { n: "魔法娃娃：法利昂", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 6, noEnhance: true, gachaWeight: 0, c: "text-red-400", hpR: 20, mpR: 10, resWater: 20, mdmg: 5, int: 2, wis: 2, freezeResist: 100, d: "六階魔法娃娃。HP自然恢復+20、MP自然恢復+10、水屬性抗性+20、魔法傷害+5、智力+2、精神+2；免疫冰凍。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_林德拜爾":   { n: "魔法娃娃：林德拜爾", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 6, noEnhance: true, gachaWeight: 0, c: "text-red-400", hpR: 20, mpR: 10, resWind: 20, rangedDmg: 4, rangedHit: 8, er: 5, immSlow: true, d: "六階魔法娃娃。HP自然恢復+20、MP自然恢復+10、風屬性抗性+20、遠距離傷害+4、遠距離命中+8、ER+5；免疫緩速。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_巴拉卡斯":   { n: "魔法娃娃：巴拉卡斯", type: "acc", slot: "doll", req: "all", safe: 0, p: 0, doll: true, dollTier: 6, noEnhance: true, gachaWeight: 0, c: "text-red-400", hpR: 20, mpR: 10, resFire: 20, meleeDmg: 4, meleeHit: 8, dr: 5, stunResist: 100, d: "六階魔法娃娃。HP自然恢復+20、MP自然恢復+10、火屬性抗性+20、近距離傷害+4、近距離命中+8、傷害減免+5；免疫暈眩。裝於魔法娃娃欄，游標變其模樣。" },
        "doll_bag":        { n: "魔法娃娃的袋子", type: "misc", p: 0, c: "text-pink-300", eff: "doll_bag", noSell: true, gachaWeight: 0, d: "打開可隨機獲得一隻魔法娃娃。於威頓村魔法娃娃商人用多餘金卡兌換取得。" },
        "scroll_weapon": { n: "對武器施法的卷軸", p: 22500, c: "text-white", d: "強化武器 (安定值6)", gachaWeight: 50 },
        "scroll_armor": { n: "對盔甲施法的卷軸", p: 9000, c: "text-white", d: "強化防具 (安定值4/0)", gachaWeight: 100 },
        "scroll_weapon_b": { n: "祝福的 對武器施法的卷軸", p: 22500, c: "text-yellow-300", d: "祝福的：成功時隨機提升 +1~+3 (強化武器，安定值6)", isB: true, gachaWeight: 0 },
        "scroll_armor_b": { n: "祝福的 對盔甲施法的卷軸", p: 9000, c: "text-yellow-300", d: "祝福的：成功時隨機提升 +1~+3 (強化防具，安定值4/0)", isB: true, gachaWeight: 0 },
        "scroll_weapon_c": { n: "詛咒的 對武器施法的卷軸", p: 33334, c: "c-cursed", d: "詛咒的：消耗1個使武器強化值-1（100%成功）", isC: true, gachaWeight: 20 },
        "scroll_armor_c": { n: "詛咒的 對盔甲施法的卷軸", p: 33334, c: "c-cursed", d: "詛咒的：消耗1個使防具強化值-1（100%成功）", isC: true, gachaWeight: 20 },
        "scroll_acc": { n: "對飾品施法的卷軸", p: 50000, c: "text-white", d: "強化飾品 (無安定值)", gachaWeight: 10 },
        "new_item_bless_wpn": { n: "賦予武器祝福卷軸", type: "misc", p: 0, c: "text-purple-300", d: "於象牙塔『碧恩』處用來祝福武器（無法直接使用）。", isAnc: true, noUse: true, gachaWeight: 0 },
        "new_item_bless_arm": { n: "賦予盔甲祝福卷軸", type: "misc", p: 0, c: "text-purple-300", d: "於象牙塔『碧恩』處用來祝福防具（無法直接使用）。", isAnc: true, noUse: true, gachaWeight: 0 },
        "new_item_bless_acc": { n: "賦予飾品祝福卷軸", type: "misc", p: 0, c: "text-purple-300", d: "於象牙塔『碧恩』處用來祝福飾品（無法直接使用）。", isAnc: true, noUse: true, gachaWeight: 0 },
        "new_item_uncurse": { n: "解除詛咒的卷軸", type: "misc", p: 0, c: "text-cyan-200", d: "於象牙塔『碧恩』處用來移除裝備的詛咒（無法直接使用）。", noUse: true, gachaWeight: 0 },   // 🔧 潘朵拉不出（改由克里斯特兌換）
        "new_item_143": { n: "肉", type: "pot", req: "all", p: 1, d: "食用後獲得『誘捕』狀態300秒", eff: "meat", gachaWeight: 0 },
        "new_item_144": { n: "夏洛伯之爪", p: 1, c: "text-blue-300", gachaWeight: 0 },   // 🔧 試煉材料統一藍色
        "new_item_145": { n: "阿吐巴圖騰", p: 667, gachaWeight: 0 },
        "new_item_146": { n: "那魯加圖騰", p: 334, gachaWeight: 0 },
        "new_item_147": { n: "都達瑪拉圖騰", p: 167, gachaWeight: 0 },
        "new_item_148": { n: "甘地圖騰", p: 100, gachaWeight: 0 },
        "new_item_149": { n: "羅孚圖騰", p: 167, gachaWeight: 0 },
        "new_item_150": { n: "魔法寶石", p: 99, gachaWeight: 0 },
        "mat_moonlight_breath": { n: "月光之氣息", type: "etc", p: 5000, noUse: true, gachaWeight: 0, c: "text-sky-200", d: "月華凝鍊而成的氣息，賽巴斯寶石加工的稀有材料。" },
        // ===== 雷德的復仇：任務道具（蕾雅部下的證明物，無法裝備）=====
        "quest_ring_darkdweller": { n: "黑暗棲林者戒指", p: 1, c: "text-amber-300", gachaWeight: 0, d: "自黑暗棲林者指間奪下的戒指。雷德的復仇任務道具，無法裝備。蕾雅部下的證明物。" },
        "quest_ring_beasttamer": { n: "馴獸師戒指", p: 1, c: "text-amber-300", gachaWeight: 0, d: "曾號令群獸的馴獸師遺物。雷德的復仇任務道具，無法裝備。蕾雅部下的證明物。" },
        "quest_ring_elfcaller": { n: "精靈使戒指", p: 1, c: "text-amber-300", gachaWeight: 0, d: "驅使精靈作戰的精靈使所佩之戒。雷德的復仇任務道具，無法裝備。蕾雅部下的證明物。" },
        "quest_ring_summoner": { n: "喚獸師戒指", p: 1, c: "text-amber-300", gachaWeight: 0, d: "喚獸師用以締結召喚契約的戒指。雷德的復仇任務道具，無法裝備。蕾雅部下的證明物。" },
        "quest_ring_darkmage": { n: "黑法師戒指", p: 1, c: "text-amber-300", gachaWeight: 0, d: "染著黑暗魔力的黑法師戒指。雷德的復仇任務道具，無法裝備。蕾雅部下的證明物。" },
        // ===== 倫提斯製作材料：四軍團印記 + 四軍王徽印（暫無掉落怪）=====
        "mat_legion_necro": { n: "冥法軍團印記", p: 500, gachaWeight: 0, d: "倫提斯製作材料。" },
        "mat_legion_law": { n: "法令軍團印記", p: 500, gachaWeight: 0, d: "法令軍團的徽記，由忠於律法的軍士佩於胸前。倫提斯製作材料。" },
        "mat_legion_beast": { n: "魔獸軍團印記", p: 500, gachaWeight: 0, d: "魔獸軍團的徽記，染著野性與血腥的氣味。倫提斯製作材料。" },
        "mat_legion_assassin": { n: "暗殺軍團印記", p: 500, gachaWeight: 0, d: "暗殺軍團的徽記，刻於暗影中流轉的密令。倫提斯製作材料。" },
        "mat_crest_beast": { n: "魔獸軍王徽印", p: 5000, gachaWeight: 0, d: "魔獸軍王的徽印，唯有踏過其領地者方能取得。倫提斯製作材料。" },
        "mat_crest_law": { n: "法令軍王徽印", p: 5000, gachaWeight: 0, d: "法令軍王的徽印，銘刻著不容違逆的鐵律。倫提斯製作材料。" },
        "mat_crest_assassin": { n: "暗殺軍王徽印", p: 5000, gachaWeight: 0, d: "暗殺軍王的徽印，沉默無聲卻奪命於無形。倫提斯製作材料。" },
        "mat_crest_necro": { n: "冥法軍王徽印", p: 5000, gachaWeight: 0, d: "冥法軍王的徽印，縈繞著亡者國度的幽冷氣息。倫提斯製作材料。" },
        "item_king_key": { n: "軍王的鑰匙", p: 1, c: "text-amber-300", gachaWeight: 0, d: "刻有軍王紋章的古老鑰匙，唯有持之者能跨越那道封閉的界線。通往特定區域的鑰匙，持有後方可入場。" },
        "new_item_151": { n: "鑽石", p: 250, gachaWeight: 0 },
        "new_item_152": { n: "品質鑽石", p: 750, gachaWeight: 0 },
        "new_item_153": { n: "高品質鑽石", p: 2500, gachaWeight: 0 },
        "new_item_154": { n: "綠寶石", p: 125, gachaWeight: 0 },
        "new_item_155": { n: "品質綠寶石", p: 500, gachaWeight: 0 },
        "new_item_156": { n: "高品質綠寶石", p: 1250, gachaWeight: 0 },
        "new_item_157": { n: "紅寶石", p: 175, gachaWeight: 0 },
        "new_item_158": { n: "品質紅寶石", p: 550, gachaWeight: 0 },
        "new_item_159": { n: "高品質紅寶石", p: 1750, gachaWeight: 0 },
        "new_item_160": { n: "藍寶石", p: 200, gachaWeight: 0 },
        "new_item_161": { n: "品質藍寶石", p: 650, gachaWeight: 0 },
        "new_item_162": { n: "高品質藍寶石", p: 2000, gachaWeight: 0 },
        "mat_unicorn_horn":   { n: "神聖獨角獸之角", p: 5000, gachaWeight: 0, d: "獨角獸頭上的神聖之角，蘊含純淨之力。製作熾炎天使弓的核心材料。（獨角獸 0.1% 掉落）" },
        "mat_wind_breath":    { n: "風之氣息", p: 1500, gachaWeight: 0, d: "風精靈呼出的一縷靈息，於掌心仍微微鼓動著看不見的氣流。凝聚自風精靈的元素氣息。" },
        "mat_water_breath":   { n: "水之氣息", p: 1500, gachaWeight: 0, d: "水精靈吐納的一抹清涼，似有潺潺水聲在其中流轉不息。凝聚自水精靈的元素氣息。" },
        "mat_fire_breath":    { n: "火之氣息", p: 1500, gachaWeight: 0, d: "火精靈呵出的一息餘溫，貼近時仍能感到躍動的炙熱。凝聚自火精靈的元素氣息。" },
        "mat_earth_breath":   { n: "土之氣息", p: 1500, gachaWeight: 0, d: "地精靈沉吐的一口厚實氣息，蘊著大地深處的沉穩重量。凝聚自地精靈的元素氣息。" },
        "mat_griffon_feather":{ n: "格利芬羽毛", p: 1000, gachaWeight: 0, d: "自翱翔天際的格利芬身上取下的羽毛，輕盈似風卻韌如鋼。（格利芬 1% 掉落）" },
        "new_item_163": { n: "潘的鬃毛", p: 10, gachaWeight: 0 },
        "new_item_164": { n: "粗糙的米索莉塊", p: 20, gachaWeight: 0 },
        "new_item_165": { n: "元素石", p: 20, gachaWeight: 0 },
        "new_item_166": { n: "蘑菇汁", p: 10, gachaWeight: 0 },
        "new_item_167": { n: "食人巨魔的血", p: 10000, gachaWeight: 0 },
        "new_item_168": { n: "線", p: 10, gachaWeight: 0 },
        "new_item_169": { n: "純粹的米索莉塊", p: 1, gachaWeight: 0 },
        "new_item_170": { n: "精靈粉末", p: 1, gachaWeight: 0 },
        "new_item_171": { n: "芮克妮的網", p: 10, gachaWeight: 0 },
        "new_item_172": { n: "安特的樹皮", p: 10, gachaWeight: 0 },
        "new_item_173": { n: "奧里哈魯根", p: 10, gachaWeight: 0 },
        "new_item_174": { n: "米索莉線", p: 10, gachaWeight: 0 },
        "new_item_175": { n: "芮克妮的蛻皮", p: 10, gachaWeight: 0 },
        "new_item_176": { n: "魔法笛子", p: 10, gachaWeight: 0 },
        "new_item_177": { n: "米索莉金屬板", p: 10, gachaWeight: 0 },
        "new_item_178": { n: "奧里哈魯根金屬板", p: 10, gachaWeight: 0 },
        "new_item_179": { n: "皮革", p: 10, gachaWeight: 0 },
        "new_item_180": { n: "金屬塊", p: 10, gachaWeight: 0 },
        "new_item_181": { n: "皮帶", p: 10, gachaWeight: 0 },
        "new_item_182": { n: "高級皮革", p: 10, gachaWeight: 0 },
        "mat_blackstone2": { n: "二級黑魔石", p: 50,   gachaWeight: 0, d: "黑得吸光的礦石，貼近耳畔彷彿能聽見幽幽暗影的低語。黑暗妖精製作的基礎材料。（野外戰鬥掉落，學習提煉魔石後掉落率提高）" },
        "mat_blackstone3": { n: "三級黑魔石", p: 200,  gachaWeight: 0, d: "暗影魔力層層凝結而成的黑石，握於掌中沉甸甸地泛著冷意。黑暗妖精製作的進階材料。（野外戰鬥掉落，學習提煉魔石後掉落率提高）" },
        "mat_blackstone4": { n: "四級黑魔石", p: 1000, gachaWeight: 0, d: "千錘百鍊純化至極的黑魔石，暗影之力濃稠得幾乎要溢出表面。黑暗妖精頂級裝備的關鍵材料。（稀有掉落）" },
        "mat_silverore":   { n: "銀礦石",     p: 100,  gachaWeight: 0, d: "夾雜著銀脈的粗礦，於爐火中提煉方能顯露其皎潔本色。於庫普處以 10 個＋500 金幣可精煉成『銀』。" },
        "mat_silver":      { n: "銀",         p: 500,  gachaWeight: 0, d: "提煉至純的皎潔白銀，自古便是邪祟畏懼之物。可用於打造銀光系武器（對不死/狼人有效）。" },
        "new_item_183": { n: "骨頭碎片", p: 10, gachaWeight: 0 },
        "new_item_184": { n: "項圈 (杜賓狗)", p: 10, gachaWeight: 0 },
        "new_item_185": { n: "項圈 (狼)", p: 10, gachaWeight: 0 },
        "new_item_186": { n: "糖果", p: 10, gachaWeight: 0 },
        "new_item_187": { n: "藍色布料", p: 220, gachaWeight: 0 },
        "new_item_188": { n: "紅色布料", p: 220, gachaWeight: 0 },
        "new_item_189": { n: "白色布料", p: 220, gachaWeight: 0 },
        "new_item_190": { n: "水龍鱗", p: 5000, gachaWeight: 0 },
        "new_item_191": { n: "地龍鱗", p: 5000, gachaWeight: 0 },
        "new_item_192": { n: "火龍鱗", p: 5000, gachaWeight: 0 },
        "new_item_193": { n: "風龍鱗", p: 5000, gachaWeight: 0 },
        "new_item_194": { n: "阿西塔基奧的灰燼", p: 1000, gachaWeight: 0 },
        "new_item_195": { n: "精靈玉", p: 100, gachaWeight: 0 },
        "new_item_196": { n: "古老的交易文件", p: 1, c: "text-blue-300", gachaWeight: 0 },   // 🔧 試煉材料統一藍色
        "new_item_197": { n: "搜索狀", p: 1, gachaWeight: 0 },
        "new_item_198": { n: "黑騎士的誓約", p: 1, c: "text-blue-300", gachaWeight: 0 },   // 🔧 試煉材料統一藍色（198~206、208、212~214、240 同）
        "new_item_199": { n: "都達瑪拉妖魔魔法書", p: 1, c: "text-blue-300", gachaWeight: 0 },
        "new_item_200": { n: "那魯加妖魔魔法書", p: 1, c: "text-blue-300", gachaWeight: 0 },
        "new_item_201": { n: "甘地妖魔魔法書", p: 1, c: "text-blue-300", gachaWeight: 0 },
        "new_item_202": { n: "阿吐巴妖魔魔法書", p: 1, c: "text-blue-300", gachaWeight: 0 },
        "new_item_203": { n: "骷髏頭", p: 1, c: "text-blue-300", gachaWeight: 0 },
        "new_item_204": { n: "食屍鬼的指甲", p: 1, c: "text-blue-300", gachaWeight: 0 },
        "new_item_205": { n: "食屍鬼的牙齒", p: 1, c: "text-blue-300", gachaWeight: 0 },
        "new_item_206": { n: "龍龜甲", p: 1, c: "text-blue-300", gachaWeight: 0 },
        "new_item_207": { n: "生命的卷軸", p: 1, gachaWeight: 0 },
        "new_item_208": { n: "蛇女之鱗", p: 1, c: "text-blue-300", gachaWeight: 0 },
        "new_item_209": { n: "返生藥水", p: 1, gachaWeight: 0 },
        "new_item_210": { n: "感謝信", p: 1, gachaWeight: 0 },
        "new_item_211": { n: "村民的遺物", p: 1, gachaWeight: 0 },
        "new_item_212": { n: "不死族的骨頭", p: 1, c: "text-blue-300", gachaWeight: 0 },
        "new_item_213": { n: "受詛咒的精靈書", p: 1, c: "text-blue-300", gachaWeight: 0 },
        "new_item_214": { n: "不死族的鑰匙", p: 1, c: "text-blue-300", gachaWeight: 0 },
        "new_item_215": { n: "殭屍鑰匙", p: 1, gachaWeight: 0 },
        "new_item_216": { n: "骷髏鑰匙", p: 1, gachaWeight: 0 },
        "new_item_217": { n: "密室鑰匙", p: 1, gachaWeight: 0 },
        "new_item_218": { n: "神秘水晶球", p: 1, gachaWeight: 0 },
        "new_item_219": { n: "神秘魔杖", p: 1, gachaWeight: 0 },
        "new_item_220": { n: "蛇女房間鑰匙", p: 1, gachaWeight: 0 },
        "new_item_221": { n: "光明的鱗片", p: 1, gachaWeight: 0 },
        "item_hatin_diary": { n: "黑暗哈汀的日記本", type: "misc", p: 5000, c: "text-purple-300", noUse: true, gachaWeight: 0, d: "黑暗法師哈汀殘存的日記本，扉頁間滿是癲狂的黑魔法筆記與禁咒草圖。可交給說話之島的尤麗婭兌換 隱藏的魔族武器（六選一）。" },
        "new_item_222": { n: "畢克斯的羽毛", p: 1, gachaWeight: 0 },
        "new_item_223": { n: "畢克斯的沙漏", p: 1, gachaWeight: 0 },
        "new_item_224": { n: "贖罪聖書", p: 1, gachaWeight: 0 },
        "new_item_225": { n: "被偷的項鍊", p: 1, gachaWeight: 0 },
        "new_item_226": { n: "被偷的戒指", p: 1, gachaWeight: 0 },
        "new_item_228": { n: "污染的精靈水晶(水)", p: 1, gachaWeight: 0 },
        "new_item_229": { n: "污染的精靈水晶(火)", p: 1, gachaWeight: 0 },
        "new_item_230": { n: "污染的精靈水晶(地)", p: 1, gachaWeight: 0 },
        "new_item_231": { n: "污染的精靈水晶(風)", p: 1, gachaWeight: 0 },
        "new_item_232": { n: "邪惡蜥蜴之鱗", p: 1, gachaWeight: 0 },
        "new_item_233": { n: "神秘魔力恢復藥水", p: 1, gachaWeight: 0 },
        "new_item_234": { n: "神秘慎重藥水", p: 1, gachaWeight: 0 },
        "new_item_235": { n: "思克巴女皇的神祕魔杖", p: 1, gachaWeight: 0 },
        "new_item_236": { n: "說話之島的回憶", p: 1, gachaWeight: 0 },
		"new_item_237": { n: "安特的樹枝", p: 1, gachaWeight: 0 },
		"new_item_elfwing": { n: "精靈羽翼", p: 10, gachaWeight: 0 },
		"new_item_mermaid_scale": { n: "人魚之鱗", p: 10, gachaWeight: 0 },
		"new_item_239": { n: "潘朵拉抽獎卷", p: 0, gachaWeight: 0 },
		"new_item_240": { n: "變形怪的血", p: 1, c: "text-blue-300", gachaWeight: 0 },
		"new_item_241": { n: "王族搜索狀", p: 10000, gachaWeight: 0, d: "記載著血盟仇敵行蹤的密令文書，沾染著一絲血誓的氣息。擊敗血盟敵人必定取得。可向血盟盟主交出，換取盟主的祝福。" },
		
		        // ===== 🔥 50級試煉擴充：製作材料（潘朵拉權重0）=====
        "mat_demon_anklet_white": { n: "惡魔的白色腳鐐", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "mat_demon_anklet_black": { n: "惡魔的黑色腳鐐", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "mat_demon_anklet_red":   { n: "惡魔的紅色腳鐐", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "mat_demon_anklet_blue":  { n: "惡魔的藍色腳鐐", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "mat_black_mithril":      { n: "黑色米索莉",     type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "mat_fallen_poison":      { n: "墮落之毒",       type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "mat_fallen_hand":        { n: "墮落之手",       type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "mat_fallen_fang":        { n: "墮落之牙",       type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "mat_fallen_tongue":      { n: "墮落之舌",       type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "mat_fallen_scythe":      { n: "墮落鐮刀",       type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "mat_fallen_head":        { n: "墮落首級",       type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "item_fallen_key":        { n: "墮落鑰匙",       type: "etc", p: 1, c: "text-purple-300", noUse: true, gachaWeight: 0, d: "可交給沉默洞窟的布魯迪卡換取獎勵。" },
        "mat_soulstone_shard":    { n: "靈魂石碎片",     type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "mat_silver_plate":       { n: "銀金屬板",       type: "etc", p: 10, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "炎魔鐵匠鍛造的金屬板。製作材料。" },
        "mat_blackmithril_plate": { n: "黑色米索莉金屬板", type: "etc", p: 10, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "炎魔鐵匠鍛造的金屬板。製作材料。" },
        "mat_flame_sword":        { n: "炎魔之劍",       type: "etc", p: 1, c: "text-red-300", noUse: true, gachaWeight: 0, d: "炎魔之力的結晶，可作為試煉交付物。" },
        "mat_flame_claw":         { n: "炎魔之爪",       type: "etc", p: 1, c: "text-red-300", noUse: true, gachaWeight: 0, d: "炎魔之力的結晶，可作為試煉交付物。" },
        "mat_flame_heart":        { n: "炎魔之心",       type: "etc", p: 1, c: "text-red-300", noUse: true, gachaWeight: 0, d: "炎魔之力的結晶，可作為試煉交付物。" },
        "mat_flame_eye":          { n: "炎魔之眼",       type: "etc", p: 1, c: "text-red-300", noUse: true, gachaWeight: 0, d: "炎魔之力的結晶，可作為試煉交付物。" },
        "mat_dragon_heart":       { n: "飛龍之心",       type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "飛龍體內不滅的核心。王族聖器製作材料。" },
        "mat_golem_heart":        { n: "高崙之心",       type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "高崙體內的核心。王族聖器製作材料。" },
        "mat_icequeen_heart":     { n: "冰之女王之心",   type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "冰之女王的寒冰核心。王族聖器製作材料。" },
        // ===== 🔥 50級試煉任務道具 =====
        "item_dantes_letter": { n: "丹特斯的召書", type: "etc", p: 1, c: "text-amber-300", noUse: true, noSell: true, gachaWeight: 0, d: "騎士 50 級試煉任務道具。無法刪除、無法存倉庫、最多持有 1 個。" },
        "item_elf_whisper":   { n: "精靈的私語", type: "etc", p: 1, c: "text-amber-300", noUse: true, noSell: true, gachaWeight: 0, maxHold: 10, d: "騎士 50 級試煉任務道具。最多持有 10 個；完成交付後會自動清除。" },
        "item_ancient_book":  { n: "古代黑妖之秘笈", type: "etc", p: 1, c: "text-amber-300", noUse: true, noSell: true, gachaWeight: 0, d: "妖精 50 級試煉任務道具。無法刪除、無法存倉庫、最多持有 1 個。" },
        "item_sealed_intel":  { n: "密封的情報書", type: "etc", p: 1, c: "text-amber-300", noUse: true, noSell: true, gachaWeight: 0, d: "妖精 50 級試煉任務道具。無法刪除、無法存倉庫、最多持有 1 個。" },
        "item_spy_report":    { n: "間諜報告書", type: "etc", p: 1, c: "text-amber-300", noUse: true, noSell: true, gachaWeight: 0, d: "法師 50 級試煉任務道具。無法刪除、無法存倉庫、最多持有 1 個。" },
        "item_chaos_key":     { n: "混沌鑰匙", type: "etc", p: 1, c: "text-amber-300", noUse: true, noSell: true, gachaWeight: 0, d: "黑暗妖精 50 級試煉任務道具。最多持有 1 個。" },
        "item_royal_order":   { n: "調職命令書", type: "etc", p: 1, c: "text-amber-300", noUse: true, noSell: true, gachaWeight: 0, d: "王族 50 級試煉任務道具。無法刪除、無法存倉庫、最多持有 1 個。" },
        "item_lost_soul":     { n: "失去光明的靈魂", type: "etc", p: 1, c: "text-amber-300", noUse: true, noSell: true, gachaWeight: 0, d: "王族試煉任務道具（馬沙）：可兌換守護者的戒指。" },
        // ===== 🔥 50級試煉擴充：基礎裝備（飾品/手套/防具/斗篷）=====
        "glv_earth_spirit": { n: "地靈手套", type: "arm", slot: "gloves", ac: 0, str: 1, resEarth: 4, mpR: 1, req: "all", safe: 4, p: 120000, gachaWeight: 1 },
        "glv_wind_spirit":  { n: "風靈手套", type: "arm", slot: "gloves", ac: 0, str: 1, resWind: 4,  mpR: 1, req: "all", safe: 4, p: 120000, gachaWeight: 1 },
        "glv_water_spirit": { n: "水靈手套", type: "arm", slot: "gloves", ac: 0, str: 1, resWater: 4, mpR: 1, req: "all", safe: 4, p: 120000, gachaWeight: 1 },
        "glv_fire_spirit":  { n: "火靈手套", type: "arm", slot: "gloves", ac: 0, str: 1, resFire: 4,  mpR: 1, req: "all", safe: 4, p: 120000, gachaWeight: 1 },
        "hlm_mambo": { n: "曼波帽子", type: "arm", slot: "helm", ac: -1, cha: 1, sleepResist: 10, freezeResist: 10, req: "all", safe: 4, p: 59600, gachaWeight: 10, d: "綴著奇異羽飾的輕巧帽子，戴上時心神格外清明安定。額外 10% 機率抵抗沉睡、冰凍。" },
        "amr_mambo": { n: "曼波外套", type: "arm", slot: "armor", ac: 3, resWater: 10, resFire: -10, str: -1, cha: 2, req: "all", safe: 4, p: 89600, gachaWeight: 10 },
        "amr_centipede": { n: "金屬蜈蚣皮盔甲", type: "arm", slot: "armor", ac: 8, req: "knight,dark", safe: 4, p: 39600, gachaWeight: 30 },
        "amr_darkdweller": { n: "黑暗棲林者盔甲", type: "arm", slot: "armor", ac: 4, mmp: 10, req: "all", safe: 4, p: 2300, gachaWeight: 100 },
        "bot_darkdweller": { n: "黑暗棲林者長靴", type: "arm", slot: "boots", ac: 2, mhp: 30, req: "knight,elf,dark", safe: 4, p: 3300, gachaWeight: 50 },
        "clk_blacktiger": { n: "黑虎皮斗篷", type: "arm", slot: "cloak", ac: 3, hpR: 2, req: "all", safe: 4, p: 12000, gachaWeight: 20 },
        "clk_wolf": { n: "狼皮斗篷", type: "arm", slot: "cloak", ac: 3, req: "all", safe: 4, p: 4000, gachaWeight: 50 },
        "acc_bear_ring": { n: "熊戒指", type: "acc", slot: "ring", ac: 0, hpR: 3, resEarth: 10, req: "all", safe: 0, p: 100000, gachaWeight: 1, d: "鑲著熊牙的厚實戒指，蘊含猛獸般堅韌的生命力。" },
        "acc_abyss_ring": { n: "深淵戒指", type: "acc", slot: "ring", ac: 0, mpR: 1, sleepResist: 10, freezeResist: 10, req: "all", safe: 0, p: 100000, gachaWeight: 10, d: "凝望深淵時，深淵也凝望著你；戴上它，神智便不再為寒冷與睡意所惑。額外 10% 機率抵抗沉睡、冰凍。" },
        // ===== 🔥 50級試煉擴充：武器與傳說裝備 =====
        "wpn_mithril_dagger": { n: "米索莉短劍", type: "wpn", dmgS: 6, dmgL: 5, hit: 0, dmgBonus: 0, spd: 0.8, req: "all", safe: 6, p: 70000, gachaWeight: 20, unBonus: true, mpR: 3, mdmg: 1, d: "以稀有米索莉鍛成的鋒銳匕首，寒光所及邪物退避。帶出血、對不死 / 狼人加成。" },
        "wpn_ori_dagger": { n: "奧里哈魯根短劍", type: "wpn", dmgS: 7, dmgL: 7, hit: 0, dmgBonus: 2, spd: 0.8, req: "all", safe: 6, p: 80000, gachaWeight: 10, unBonus: true, d: "以傳說金屬奧里哈魯根鍛成的匕首，刃身流轉著聖潔的微光。帶出血、對不死 / 狼人加成。" },
        "wpn_crimson_spear": { n: "深紅長矛", type: "wpn", w2h: true, dmgS: 21, dmgL: 21, hit: 1, dmgBonus: 0, spd: 1.0, req: "knight", safe: 6, p: 89000, gachaWeight: 1, eff: "pierce", pierceChance: 80, unBonus: true, mhp: 50, d: "矛身被無數鮮血浸透成暗紅，貫穿之勢如奔流不可阻擋。穿透 80%、對不死 / 狼人加成、HP+50。" },
        "wpn_demon_axe": { n: "惡魔斧頭", type: "wpn", w2h: true, dmgS: 30, dmgL: 30, hit: -2, dmgBonus: 0, spd: 1.0, req: "knight", safe: 0, p: 9000, gachaWeight: 30, eff: "crush", d: "惡魔揮舞過的猙獰巨斧，每一擊都帶著地獄的沉重。重擊。" },
        "wpn_vengeance": { n: "復仇之劍", type: "wpn", w2h: true, dmgS: 4, dmgL: 36, hit: 3, dmgBonus: 0, spd: 1.1, req: "knight", safe: 0, p: 10000, gachaWeight: 20, eff: "cleave", d: "凝結著不散怨念的雙手劍，劍鋒所向皆為宿仇而斬。切割。" },
        "wpn_hate_claw": { n: "恨之鋼爪", type: "wpn", w2h: true, dmgS: 26, dmgL: 15, hit: 2, dmgBonus: 5, spd: 0.9, req: "dark", safe: 0, p: 10000, gachaWeight: 20, eff: "combo", comboRate: 50, d: "由純粹恨意鍛成的鋼爪，撕裂時彷彿能聽見亡者的嘶吼。雙擊。" },
        "wpn_demon_sword": { n: "惡魔之劍", type: "wpn", dmgS: 17, dmgL: 9, hit: 4, dmgBonus: 0, spd: 1.1, req: "knight,elf", safe: 6, p: 50000, gachaWeight: 1, eff: "haste", d: "惡魔親手淬煉的單手劍，揮舞間迅疾如魔影掠過。反擊、加速（與自我加速藥水/加速術無法重疊）。" },
        "wpn_demon_dual": { n: "惡魔雙刀", type: "wpn", w2h: true, dmgS: 18, dmgL: 13, hit: 4, dmgBonus: 3, spd: 0.8, req: "dark", safe: 6, p: 50000, gachaWeight: 1, eff: "combo", equipHaste: true, d: "自惡魔利爪幻化而成的一對雙刀，揮舞間殺意如影隨形。雙擊、加速（與自我加速藥水/加速術無法重疊）。" },
        "wpn_demon_claw": { n: "惡魔鋼爪", type: "wpn", w2h: true, dmgS: 20, dmgL: 18, hit: 0, dmgBonus: 3, spd: 0.9, req: "dark", safe: 6, p: 50000, gachaWeight: 1, eff: "combo", equipHaste: true, d: "惡魔指骨淬煉的鋼爪，撕裂血肉只在彈指之間。雙擊、加速（與自我加速藥水/加速術無法重疊）。" },
        "wpn_dual_destroy": { n: "破壞雙刀", type: "wpn", w2h: true, dmgS: 16, dmgL: 10, hit: 6, dmgBonus: 1, str: 1, wis: 2, spd: 0.8, req: "dark", safe: 6, p: 150000, legend: true, gachaWeight: 1, eff: "combo", comboRate: 30, procBurstPoison: { rateBase: 1, ratePerEn: 1 }, d: "蘊含猛爆毒性的漆黑雙刃，揮舞間散逸出腐蝕一切的劇毒。黑暗妖精專屬・雙刀（雙手・近距離）。雙擊 30%；力量+1、精神+2；近距離傷害+1、近距離命中+6。攻擊時 1%（每強化+1%）機率發動猛爆劇毒（每秒 100 固定傷害，持續 5 秒，最多 1 層）。" },
        "wpn_claw_destroy": { n: "破壞鋼爪", type: "wpn", w2h: true, dmgS: 19, dmgL: 18, hit: 6, dmgBonus: 1, str: 1, wis: 2, spd: 0.9, req: "dark", safe: 6, p: 150000, legend: true, gachaWeight: 1, eff: "combo", comboRate: 30, procBurstPoison: { rateBase: 1, ratePerEn: 1 }, d: "凝聚猛爆毒性的漆黑利爪，每一抓都將致命劇毒灌入血肉。黑暗妖精專屬・鋼爪（雙手・近距離）。雙擊 30%；力量+1、精神+2；近距離傷害+1、近距離命中+6。攻擊時 1%（每強化+1%）機率發動猛爆劇毒（每秒 100 固定傷害，持續 5 秒，最多 1 層）。" },
        "wpn_demon_xbow": { n: "惡魔十字弓", type: "wpn", isBow: true, ranged: true, rapidfire: 60, w2h: true, dmgS: 3, dmgL: 3, hit: 2, dmgBonus: 4, spd: 1.0, req: "elf", safe: 6, p: 47300, gachaWeight: 1, equipHaste: true, d: "以惡魔之骨為弦的十字弓，箭雨傾瀉如墮入煉獄。連射 60%、加速（與自我加速藥水/加速術無法重疊）。" },
        "wpn_powerless_baphomet": { n: "失去魔力的巴風特魔杖", type: "wpn", dmgS: 1, dmgL: 1, hit: 0, dmgBonus: 0, spd: 1.0, req: "all", safe: 6, p: 0, gachaWeight: 0, d: "曾屬於魔神巴風特的魔杖，如今魔力枯竭、沉默不語。對靈魂之球使用可恢復為巴風特魔杖。（可販售，售價 0）" },
        "wpn_baphomet_wand": { n: "巴風特魔杖", type: "wpn", dmgS: 7, dmgL: 6, hit: 8, dmgBonus: 5, spd: 1.0, req: "mage", safe: 0, p: 210000, legend: true, gachaWeight: 1, procSkill: "sk_earthquake", procRateBase: 8, procRatePerEn: 2, mdmgEnFrom7Max3: true, d: "魔神巴風特之力重新甦醒，杖身迴盪著大地撕裂的共鳴。攻擊時 8% 機率發動地裂術（每強化 +1 機率 +2%）；強化 +7 起魔法傷害 +1，最高 +3。" },
        "wpn_qigu_obsidian": { n: "黑曜石奇古獸", type: "wpn", qigu: true, dmgS: 24, dmgL: 24, hit: 0, spd: 0.8, mdmg: 1, wis: 1, req: "illusion", safe: 6, p: 100000, gachaWeight: 10, d: "幻術士豢養的奇古獸，化作以心念支配的兵器。幻術士專屬·奇古獸。一般攻擊化為必中的魔法傷害（受魔抗減免）。魔法傷害+1、精神+1。" },
        "wpn_qigu_meditate": { n: "冥想奇古獸", type: "wpn", qigu: true, dmgS: 25, dmgL: 25, hit: 0, spd: 0.8, wis: 1, mpR: 5, mpRPerEn: 1, req: "illusion", safe: 6, p: 100000, gachaWeight: 10, d: "沉入冥想的奇古獸，靜默中源源汲取魔力。幻術士專屬·奇古獸。精神+1、MP自然恢復量+5（每強化+1再+1）。" },
        "wpn_qigu_resonance": { n: "共鳴奇古獸", type: "wpn", qigu: true, dmgS: 25, dmgL: 25, hit: 0, spd: 0.8, mdmg: 1, wis: 3, qiguProc: "phantom", req: "illusion", safe: 6, p: 300000, gachaWeight: 1, d: "與持有者心神共鳴的奇古獸，偶爾爆發出虛幻的衝擊。幻術士專屬·奇古獸。魔法傷害+1、精神+3。攻擊時 1% 機率施展幻影衝擊（每強化+1機率+1%），造成 80~160 無屬性固定傷害。" },
        "wpn_qigu_frost": { n: "寒冰奇古獸", type: "wpn", qigu: true, dmgS: 25, dmgL: 25, hit: 0, spd: 0.8, mdmg: 1, int: 1, qiguProc: "mindbreak", req: "illusion", safe: 6, p: 300000, gachaWeight: 1, d: "凝著寒霜的奇古獸，能撬開敵人最脆弱的心防。幻術士專屬·奇古獸。魔法傷害+1、智力+1。攻擊時 1% 機率施展心靈破壞（每強化+1機率+1%），不消耗MP、造成玩家最大MP 5% 的傷害，再依魔法傷害加成（1＋魔法傷害/16）放大、受目標魔抗減免。" },
        "wpn_qigu_sapphire": { n: "藍寶石奇古獸", type: "wpn", qigu: true, dmgS: 26, dmgL: 26, hit: 0, spd: 0.8, mpR: 10, req: "illusion", safe: 6, p: 10000, gachaWeight: 20, d: "通體湛藍如海的奇古獸，魔力在其中緩緩流轉不息。幻術士專屬·奇古獸。MP自然恢復量+10。" },
        "wpn_illu_wand": { n: "幻術士魔杖", type: "wpn", dmgS: 10, dmgL: 10, hit: 3, dmgBonus: 0, spd: 1.0, mpR: 5, req: "illusion", safe: 6, p: 6000, gachaWeight: 30, d: "幻術士入門的法杖，杖頭水晶迴盪著淡淡共鳴之音。幻術士專屬魔杖。蘊含共鳴之力、MP自然恢復量+5、近距離命中+3。" },
        "shd_illu_book": { n: "幻術士法書", type: "arm", slot: "shield", ac: 2, block: 10, mhp: 20, mmp: 20, wis: 1, mpR: 1, req: "illusion", safe: 6, p: 6000, gachaWeight: 10, d: "記載幻術奧義的副手法書，翻動間護住持書者周身。幻術士專屬副手法書。格檔10%、HP+20、MP+20、精神+1、MP自然恢復量+1。" },
        "clk_illu": { n: "幻術士斗篷", type: "arm", slot: "cloak", ac: 1, mmp: 20, mpR: 4, req: "illusion", safe: 6, p: 6000, gachaWeight: 10, d: "織入幻術絲線的斗篷，披上便覺魔力綿綿不絕。幻術士專屬斗篷。MP+20、MP自然恢復量+4。" },
        // ===== 🐉 龍騎士武器 / 防具 =====
        "wpn_dragon_2h": { n: "龍騎士雙手劍", type: "wpn", w2h: true, dmgS: 19, dmgL: 17, hit: 4, dmgBonus: 2, spd: 0.9, eff: "cleave", req: "dragon", safe: 6, p: 10000, gachaWeight: 20, d: "龍騎士所執的雙手巨劍，劍鋒可斬碎龍鱗。龍騎士的雙手巨劍。切割；近距離傷害+2、近距離命中+4。" },
        "wpn_chain_annihilator": { n: "消滅者鎖鏈劍", type: "wpn", w2h: true, chainsword: true, weakExpose: true, unBonus: true, dmgS: 17, dmgL: 13, hit: 5, dmgBonus: 3, spd: 0.9, req: "dragon", safe: 6, p: 10000, gachaWeight: 20, d: "龍騎士的鎖鏈巨劍，劍刃如蛇竄出、撕開敵人的破綻。龍騎士專屬·鎖鏈劍（雙手・近距離）。對不死 / 狼人加成；弱點曝光（一般攻擊命中 12% 附加，最多 3 層，配合屠宰者爆發）。近距離傷害+3、近距離命中+5。" },
        "wpn_chain_destroyer": { n: "破滅者鎖鏈劍", type: "wpn", w2h: true, chainsword: true, weakExpose: true, str: 1, dmgS: 21, dmgL: 17, hit: 5, dmgBonus: 3, spd: 0.9, req: "dragon", safe: 6, p: 88000, gachaWeight: 30, d: "以毀滅為名的鎖鏈劍，每一擊都逼出敵人的致命弱點。龍騎士專屬·鎖鏈劍（雙手・近距離）。力量+1；弱點曝光。近距離傷害+3、近距離命中+5。" },
        "wpn_chain_bloodthirst": { n: "嗜血者鎖鏈劍", type: "wpn", w2h: true, chainsword: true, weakExpose: true, vampPct: 0.05, dmgS: 21, dmgL: 20, hit: 5, dmgBonus: 3, spd: 0.9, req: "dragon", safe: 6, p: 138000, gachaWeight: 1, d: "渴飲鮮血的鎖鏈劍，斬擊之餘將敵人的生命據為己有。龍騎士專屬·鎖鏈劍（雙手・近距離）。吸取HP（恢復一般攻擊造成傷害的 5% HP）；弱點曝光。近距離傷害+3、近距離命中+5。" },
        "wpn_chain_resonance": { n: "共鳴鎖鏈劍", type: "wpn", w2h: true, chainsword: true, weakExpose: true, str: 1, wis: 2, dmgS: 21, dmgL: 20, hit: 6, dmgBonus: 3, spd: 0.9, req: "dragon", safe: 6, p: 164000, gachaWeight: 1, spellProc: { skn: "共鳴衝擊", dice: [4, 8], ele: "water" }, procRateBase: 1, procRatePerEn: 1, d: "鎖鏈之中迴盪著水之共鳴，揮舞時偶有冰瀾炸裂。龍騎士專屬·鎖鏈劍（雙手・近距離）。力量+1、精神+2；弱點曝光；1% 機率施放共鳴衝擊（每強化+1機率+1%），造成 4D8 單體水屬性魔法傷害（受魔法傷害影響）。近距離傷害+3、近距離命中+6。" },
        "wpn_chain_frost": { n: "寒冰鎖鏈劍", type: "wpn", w2h: true, chainsword: true, weakExpose: true, dmgS: 24, dmgL: 20, hit: 4, dmgBonus: 3, spd: 0.9, req: "dragon", safe: 6, p: 324000, gachaWeight: 1, spellProc: { skn: "冰之地裂術", dice: [8, 4], ele: "water", heal: 0.2 }, procRateBase: 1, procRatePerEn: 1, d: "凍結寒氣纏繞的鎖鏈劍，破地之餘為持劍者奪回生機。龍騎士專屬·鎖鏈劍（雙手・近距離）。弱點曝光；1% 機率施放冰之地裂術（每強化+1機率+1%），造成 8D4 單體水屬性魔法傷害並恢復造成傷害 20% 的 HP（受魔法傷害影響）。近距離傷害+3、近距離命中+4。" },
        "armguard_dragonscale": { n: "龍鱗臂甲", type: "arm", slot: "shield", ac: 0, armguard: { stat: "none", base: 0, th: [0, 0, 0] }, extraDmg: 1, extraHit: 2, req: "dragon", safe: 0, p: 8000, gachaWeight: 30, d: "以龍鱗鍛成的臂甲，越是淬鍊越堅不可摧。龍騎士的臂甲（裝於副手，可與雙手武器並用）。額外傷害+1、額外命中+2；每強化+1，HP+10。" },
        "clk_dragon": { n: "龍騎士斗篷", type: "arm", slot: "cloak", ac: 1, mhp: 30, hpR: 1, req: "dragon", safe: 6, p: 9000, gachaWeight: 20, d: "繡有龍紋的斗篷，披於肩上生機隱隱回流。龍騎士的斗篷。HP+30、HP自然恢復量+1。" },
        "wpn_golden_scepter": { n: "黃金權杖", type: "wpn", dmgS: 14, dmgL: 20, hit: 0, dmgBonus: 5, spd: 1.1, req: "royal", safe: 6, p: 10000, gachaWeight: 20, d: "👑 王族世代相傳的黃金權杖，象徵君臨天下的威儀。單手劍（反擊／居合）、近距離傷害+5。" },
        "clk_royal_red": { n: "紅色斗篷", type: "arm", slot: "cloak", ac: 2, cha: 1, req: "royal", safe: 4, p: 3000, gachaWeight: 100, d: "👑 王族披掛的緋紅斗篷，襯出與生俱來的高貴氣度。魅力+1。" },
        "clk_royal_majesty": { n: "君主的威嚴", type: "arm", slot: "cloak", ac: 2, str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1, req: "royal", safe: 4, p: 6000, gachaWeight: 50, d: "👑 凝聚一身君主威嚴的華服，舉手投足皆是王者風範。力量／敏捷／體質／智力／精神／魅力 各+1。" },
        "acc_royal_guard": { n: "守護者的戒指", type: "acc", slot: "ring", ac: 0, mhp: 30, mmp: 20, req: "royal", safe: 0, p: 5000, gachaWeight: 70, d: "👑 賜予近身守護者的戒指，注入守護王室的堅毅之力。HP+30、MP+20。" },
        // ===== ⚔️ 戰士裝備（多文試煉兌換／琉米埃爾製作）=====
        "wpn_warrior_trial_axe": { n: "試煉斧頭", type: "wpn", dmgS: 13, dmgL: 13, hit: 0, dmgBonus: 0, spd: 1.1, req: "warrior", safe: 6, p: 5000, gachaWeight: 100, d: "戰士試煉所授的斧頭，沉甸甸地考驗著揮斧者的臂力。單手鈍器（鈍擊）。" },
        "wpn_master_axe": { n: "大匠的斧頭", type: "wpn", dmgS: 13, dmgL: 13, hit: 0, dmgBonus: 1, spd: 1.1, req: "warrior", safe: 6, p: 10000, gachaWeight: 20, unBonus: true, d: "出自大匠之手的斧頭，刃口閃著銀輝專剋暗夜之物。單手鈍器（鈍擊）、對不死／狼人加成。近距離傷害+1。" },
        "wpn_demon_axehead": { n: "魔物的斧頭", type: "wpn", dmgS: 18, dmgL: 18, hit: -1, dmgBonus: 0, spd: 1.1, req: "warrior", safe: 0, p: 55000, gachaWeight: 10, d: "由魔物殘骸之力凝鑄的斧頭，揮砍間透著一股戾氣。單手鈍器（鈍擊）。近距離命中-1。" },
        "wpn_iron_axehead": { n: "鐵斧頭", type: "wpn", dmgS: 19, dmgL: 23, hit: 1, dmgBonus: 1, spd: 1.1, req: "warrior", safe: 6, p: 155000, gachaWeight: 1, d: "精鐵反覆鍛打而成的斧頭，紮實順手、無懈可擊。單手鈍器（鈍擊）。近距離傷害+1、近距離命中+1。" },
        "wpn_giant_axehead": { n: "巨人的斧頭", type: "wpn", legend: true, dmgS: 28, dmgL: 36, hit: 2, dmgBonus: 5, spd: 1.1, req: "warrior", safe: 6, p: 355000, gachaWeight: 1, d: "昔日巨人揮舞的巨大斧頭，一斧落下足以撼動大地。單手鈍器（鈍擊）。近距離傷害+5、近距離命中+2。" },
        "hlm_warrior_corps": { n: "戰士團頭盔", type: "arm", slot: "helm", ac: 2, mhp: 20, mrPerEn: 1, req: "warrior", safe: 4, p: 3000, gachaWeight: 50, d: "戰士團精銳所配發的鋼盔，內襯著無數場惡戰的痕跡。HP+20、每強化+1 MR+1。" },
        "clk_warrior_corps": { n: "戰士團斗篷", type: "arm", slot: "cloak", ac: 2, mhp: 20, req: "warrior", safe: 4, p: 3000, gachaWeight: 50, d: "披在戰士團肩上的厚實斗篷，曾為衝鋒者擋下風霜與箭雨。HP+20。" },
        "hlm_holy_corps": { n: "神聖執行團的頭盔", type: "arm", slot: "helm", ac: 3, mhp: 20, hpR: 4, mr: 11, req: "warrior", safe: 4, p: 7000, gachaWeight: 20, d: "神聖執行團的聖盔，鍍金的紋章映照著討伐邪惡的誓言。HP+20、HP自然恢復量+4、MR+11。" },
        "clk_holy_corps": { n: "神聖執行團的斗篷", type: "arm", slot: "cloak", ac: 4, mhp: 30, hpR: 2, mr: 20, req: "warrior", safe: 4, p: 9000, gachaWeight: 20, d: "神聖執行團的聖潔斗篷，受過祝福的織紋能彈開暗影的侵蝕。HP+30、HP自然恢復量+2、MR+20。" },
        "item_cyclops_blood": { n: "獨眼巨人的血", p: 1, gachaWeight: 0, noSell: true, d: "自獨眼巨人胸膛湧出、猶帶餘溫的暗紅鮮血，是勇者試煉的鐵證。戰士試煉任務道具。可向海音的多文兌換戰士團頭盔。" },
        // ===== ⚔️ 戰士技能印記（多文試煉兌換；技能效果於技能階段補完）=====
        "bk_warrior_dualaxe": { type: "skillbk", n: "戰士的印記(迅猛雙斧)", p: 2400, sk: "sk_warrior_dualaxe", gachaWeight: 30, d: "習得「迅猛雙斧」（熱血・被動・常駐）。裝備單手鈍器時副手也可裝單手鈍器，一般攻擊同時判定兩個攻擊來源。可學等級 15。" },
        "bk_warrior_roar": { type: "skillbk", n: "戰士的印記(咆哮)", p: 7200, sk: "sk_warrior_roar", gachaWeight: 30, d: "習得「咆哮」（憤怒・攻擊・全體無屬性）。對所有敵人造成 50+(等級-30) 的固定傷害。可學等級 30。消耗 MP 5。" },
        "bk_warrior_crush": { type: "skillbk", n: "戰士的印記(粉碎)", p: 7200, sk: "sk_warrior_crush", gachaWeight: 10, d: "習得「粉碎」（熱血・被動・常駐）。近距離傷害+2，玩家等級45時額外+1，之後每升一級+1。可學等級 30。" },
        "bk_warrior_armorbody": { type: "skillbk", n: "戰士的印記(護甲身軀)", p: 21600, sk: "sk_warrior_armorbody", gachaWeight: 1, d: "習得「護甲身軀」（熱血・被動・常駐）。傷害減免 +[(10-AC)/10]。可學等級 45。" },
        "bk_warrior_berserk": { type: "skillbk", n: "戰士的印記(狂暴)", p: 43200, sk: "sk_warrior_berserk", gachaWeight: 1, d: "習得「狂暴」（熱血・被動・常駐）。一般攻擊5%機率傷害x2。可學等級 50。" },
        "bk_warrior_titan_rock": { type: "skillbk", n: "戰士的印記(泰坦：岩石)", p: 43200, sk: "sk_warrior_titan_rock", gachaWeight: 1, d: "習得「泰坦：岩石」（忍耐・被動・常駐）。HP低於40%時，受到一般攻擊對攻擊目標造成相同傷害。可學等級 50。" },
        "bk_warrior_titan_magic": { type: "skillbk", n: "戰士的印記(泰坦：魔法)", p: 43200, sk: "sk_warrior_titan_magic", gachaWeight: 1, d: "習得「泰坦：魔法」（忍耐・被動・常駐）。HP低於40%時，受到技能攻擊對攻擊目標造成相同傷害。可學等級 50。" },
        "bk_warrior_titan_bullet": { type: "skillbk", n: "戰士的印記(泰坦：子彈)", p: 43200, sk: "sk_warrior_titan_bullet", gachaWeight: 1, d: "習得「泰坦：子彈」（忍耐・被動・常駐）。HP低於40%時，ER+50。可學等級 60。" },
        "bk_warrior_throwaxe": { type: "skillbk", n: "戰士的印記(戰斧投擲)", p: 2400, sk: "sk_warrior_throwaxe", gachaWeight: 50, d: "習得「戰斧投擲」（憤怒・輔助・狀態）。須裝備單手鈍器或雙手鈍器；下一次一般攻擊附加出血。持續6秒。可學等級 15。消耗 MP 5。" },
        "bk_warrior_endurance": { type: "skillbk", n: "戰士的印記(體能強化)", p: 43200, sk: "sk_warrior_endurance", gachaWeight: 1, d: "習得「體能強化」（憤怒・輔助・狀態）。HP上限增加+(等級/2)%。持續300秒。可學等級 50。消耗 MP 10。" },
        "bk_warrior_outlaw": { type: "skillbk", n: "戰士的印記(亡命之徒)", p: 43200, sk: "sk_warrior_outlaw", gachaWeight: 1, d: "習得「亡命之徒」（憤怒・輔助・狀態）。一般攻擊最低命中率變成50%。持續6秒。可學等級 60。消耗 MP 10。" },
        "bk_royal_precise":    { type: "skillbk", n: "魔法書(精準目標)", p: 4800,  sk: "sk_royal_precise",    gachaWeight: 30, d: "習得「精準目標」（一階王族魔法・輔助・狀態・消耗 MP 2）。場上所有敵人受到的傷害增加 [1+(玩家等級/15)]%，持續 16 秒（結束才再施放）。可學等級 15。" },
        "bk_royal_callally":   { type: "skillbk", n: "魔法書(呼喚盟友)", p: 12400, sk: "sk_royal_callally",   gachaWeight: 30, d: "習得「呼喚盟友」（二階王族魔法・攻擊・特殊・消耗 MP 30）。所有傭兵立即發動一次額外攻擊。可學等級 30。" },
        "bk_royal_burnweapon": { type: "skillbk", n: "魔法書(灼熱武器)", p: 12400, sk: "sk_royal_burnweapon", gachaWeight: 0,  d: "習得「灼熱武器」（特殊級王族魔法・輔助・狀態・消耗 MP 25）。額外傷害+5、額外命中+5，持續 640 秒（結束才再施放）。可學等級 40。" },
        "bk_royal_bravewill":  { type: "skillbk", n: "魔法書(勇猛意志)", p: 12400, sk: "sk_royal_bravewill",  gachaWeight: 0,  d: "習得「勇猛意志」（特殊級王族魔法・輔助・狀態・消耗 MP 25）。10%機率一般攻擊傷害 ×1.5，持續 640 秒（結束才再施放）。可學等級 50。" },
        "bk_royal_shield":     { type: "skillbk", n: "魔法書(閃亮之盾)", p: 12400, sk: "sk_royal_shield",     gachaWeight: 0,  d: "習得「閃亮之盾」（特殊級王族魔法・輔助・狀態・消耗 MP 25）。AC-8，持續 640 秒（結束才再施放）。可學等級 50。" },
        "bk_royal_kingguard":  { type: "skillbk", n: "魔法書(王者加護)", p: 12400, sk: "sk_royal_kingguard",  gachaWeight: 0,  d: "習得「王者加護」（特殊級王族魔法・被動・常駐）。MR+10、20%機率抵抗暈眩。可學等級 50。" },
        // 🐉 龍騎士任務道具（普洛凱爾試煉用）
        "item_demon_search": { n: "妖魔搜索文件", type: "etc", p: 1, c: "text-amber-300", noUse: true, noSell: true, gachaWeight: 0, d: "龍騎士任務道具。可向普洛凱爾兌換龍騎士雙手劍或龍之護鎧書板（3 個）。" },
        "item_demon_spy":    { n: "妖魔密使首領間諜書", type: "etc", p: 1, c: "text-amber-300", noUse: true, noSell: true, gachaWeight: 0, d: "龍騎士任務道具。可向普洛凱爾兌換龍鱗臂甲或血之渴望書板（1 個）。" },
        "item_yeti_heart":   { n: "雪怪之心", type: "etc", p: 1, c: "text-cyan-300", noUse: true, noSell: true, gachaWeight: 0, d: "龍騎士任務道具。可向普洛凱爾兌換龍騎士斗篷（10 個）。" },
        "item_soulfire_ash": { n: "靈魂之火灰燼", type: "etc", p: 1, c: "text-orange-300", noUse: true, noSell: true, gachaWeight: 0, d: "龍騎士任務道具。50 級試煉第二階段，可向普洛凱爾兌換消滅者鎖鏈劍（1 個）。" },
        "amr_baphomet": { n: "巴風特盔甲", type: "arm", slot: "armor", ac: 8, immPoison: true, dr: 2, mrPerEn: 1, req: "knight", safe: 4, p: 225300, legend: true, gachaWeight: 1, d: "自惡魔巴風特身上剝下的傳說重甲，魔氣使穿戴者百毒不侵。免疫中毒、傷害減免 +2；每強化 +1 MR +1。" },
        "clk_flame_blood": { n: "炎魔的血光斗篷", type: "arm", slot: "cloak", ac: 5, stealth: true, req: "all", safe: 4, p: 150000, legend: true, gachaWeight: 0, d: "以炎魔鮮血浸染而成的斗篷，纏身時身影隱沒於灼熱的暗影裡。穿戴時等同維持隱身（卸下即失效）。" },
        "clk_fallen": { n: "墮落斗篷", type: "arm", slot: "cloak", ac: 2, mhp: 100, con: 1, req: "dark", safe: 4, p: 150000, legend: true, gachaWeight: 1, d: "墮落者遺落的傳說斗篷，腐朽中仍透出不滅的生命力。HP+100、體質+1。" },
        "amr_fallen": { n: "墮落長袍", type: "arm", slot: "armor", ac: 13, mmp: 100, mpR: 5, req: "mage", safe: 0, p: 150000, legend: true, gachaWeight: 1, d: "墮落者的傳說長袍，衣襟間流淌著源源不絕的魔力暗潮。MP+100、MP自然恢復+5。" },
        "glv_fallen": { n: "墮落手套", type: "arm", slot: "gloves", ac: 2, mhp: 100, con: 1, req: "knight", safe: 4, p: 150000, legend: true, gachaWeight: 1, d: "墮落者的傳說手套，握緊時彷彿能感受到墮落前殘存的氣力。HP+100、體質+1。" },
        "bot_fallen": { n: "墮落長靴", type: "arm", slot: "boots", ac: 2, mhp: 100, req: "elf", safe: 4, p: 150000, legend: true, gachaWeight: 1, d: "墮落者的傳說長靴，踏過深淵也不曾停下的步伐凝結其上。HP+100。" },
        "wpn_blackflame_sword": { n: "黑焰之劍", type: "wpn", dmgS: 16, dmgL: 10, hit: 2, dmgBonus: 0, spd: 1.1, req: "knight", safe: 6, p: 10000, gachaWeight: 20, unBonus: true, d: "以炎魔之力鍛成的漆黑長劍，劍刃燃著看不見的黑色火焰。反擊、居合、對不死 / 狼人加成。" },
        "wpn_redflame_bow": { n: "赤焰之弓", type: "wpn", isBow: true, ranged: true, rapidfire: 70, w2h: true, dmgS: 3, dmgL: 3, hit: 2, dmgBonus: 4, spd: 1.0, req: "elf", safe: 6, p: 10000, gachaWeight: 20, d: "灌注炎魔之力的長弓，拉滿弦時箭尖泛起赤紅的熱浪。連射 70%。" },
        "wpn_redflame_sword": { n: "赤焰之劍", type: "wpn", dmgS: 14, dmgL: 6, hit: 4, dmgBonus: 0, spd: 1.1, req: "elf", safe: 6, p: 10000, gachaWeight: 20, unBonus: true, d: "灌注炎魔之力的烈焰之劍，揮砍時帶起灼人的赤光。反擊、居合、對不死 / 狼人加成。" },
        "wpn_mana_orb": { n: "瑪那水晶球", type: "arm", slot: "shield", ac: 2, block: 10, mmp: 100, int: 1, req: "mage", safe: 4, p: 10000, gachaWeight: 20, d: "凝聚瑪那之力的水晶球盾，澄澈的核心中緩緩流轉著無盡魔力。格檔 10%、MP+100、智力+1。" },
        // 🔥 50 級試煉長靴（迪嘉勒廷·交付炎魔素材兌換；各職業專屬·AC-3·安定4·重量15·席琳可兌換）
        "bot_divine_will": { n: "神意長靴", type: "arm", slot: "boots", ac: 3, cha: 1, req: "royal", safe: 4, p: 12000, gachaWeight: 10, d: "👑 承載王族神聖意志的長靴，每一步都散發君臨天下的威儀。AC-3、魅力+1。" },
        "bot_courage":     { n: "勇氣長靴", type: "arm", slot: "boots", ac: 3, meleeHit: 1, req: "knight", safe: 4, p: 12000, gachaWeight: 10, d: "鼓舞騎士勇往直前的長靴，踏出無畏的步伐。AC-3、近距離命中+1。" },
        "bot_sephia":      { n: "賽菲亞長靴", type: "arm", slot: "boots", ac: 3, rangedHit: 1, req: "elf", safe: 4, p: 12000, gachaWeight: 10, d: "賽菲亞祝福的輕盈長靴，使妖精的步伐如風、箭矢更準。AC-3、遠距離命中+1。" },
        "bot_mana":        { n: "瑪那長靴", type: "arm", slot: "boots", ac: 3, mpR: 2, req: "mage", safe: 4, p: 12000, gachaWeight: 10, d: "蘊含瑪那之力的長靴，行走間不斷牽引魔力回流。AC-3、MP自然恢復量+2。" },
        "wpn_death_finger": { n: "死亡之指", type: "wpn", w2h: true, dmgS: 17, dmgL: 15, hit: 3, dmgBonus: 2, spd: 0.9, req: "dark", safe: 6, p: 10000, gachaWeight: 20, eff: "combo", comboRate: 20, procPoison: { rate: 2, dur: 15, tick: 3, dmg: [1, 8] }, d: "墮落之力凝成的枯瘦指爪，觸及之物無不沾染腐毒。雙擊；攻擊時 2% 機率對目標觸發毒咒。" },
        // ===== 🌑 暗影神殿：材料 / 鑰匙 =====
        "mat_chaos_head": { n: "混沌首級", type: "etc", p: 1, c: "text-purple-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "mat_death_head": { n: "死亡首級", type: "etc", p: 1, c: "text-purple-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "item_shadow_temple_key": { n: "暗影神殿鑰匙", type: "etc", p: 1, c: "text-amber-300", noUse: true, noSell: true, gachaWeight: 0, d: "進入暗影神殿所需的鑰匙。持有即可進入（不會被消耗），另需炎魔友好度達標。" },
        // ===== 🌑 暗影神殿：混沌系列（混沌 掉落） =====
        "wpn_chaos_thorn": { n: "混沌之刺", type: "wpn", dmgS: 18, dmgL: 2, hit: 0, dmgBonus: 2, spd: 0.8, req: "all", safe: 0, p: 21000, gachaWeight: 10, d: "自混沌中誕生的匕首，刃身扭曲難辨、所傷必裂血不止。攻擊帶有出血。" },
        "hlm_chaos": { n: "混沌頭盔", type: "arm", slot: "helm", ac: 1, stunResist: 100, req: "all", safe: 0, p: 15000, gachaWeight: 10, d: "由混沌之力塑成的頭盔，戴上後心神再不為昏聵所動。免疫暈眩。" },
        "clk_chaos": { n: "混沌斗篷", type: "arm", slot: "cloak", ac: 3, mr: 10, mrPerEn: 3, req: "all", safe: 0, p: 15000, gachaWeight: 10, d: "以混沌織就的斗篷，愈是強化，抵禦魔力的力場便愈深沉。MR+10，每強化額外 MR+3。" },
        "amr_chaos": { n: "混沌法袍", type: "arm", slot: "armor", ac: 6, mpR: 12, req: "mage", safe: 0, p: 25000, gachaWeight: 10, d: "混沌之力編成的法袍，吸納四散的魔力源源回灌。MP自然恢復+12。" },
        "glv_chaos": { n: "混沌手套", type: "arm", slot: "gloves", ac: 3, str: 1, req: "all", safe: 0, p: 25000, gachaWeight: 10, d: "沾染混沌氣息的手套，握拳間湧出原始的蠻力。力量+1。" },
        // ===== 🌑 暗影神殿：死亡系列（死亡 掉落・傳說） =====
        "clk_death": { n: "死亡斗篷", type: "arm", slot: "cloak", ac: 3, str: 1, mhp: 100, mmp: 50, hpR: -10, req: "all", safe: 0, p: 55000, legend: true, gachaWeight: 1, d: "散發死亡氣息的傳說斗篷，以生機為代價換來磅礴之力。力量+1、HP+100、MP+50、HP自然恢復-10。" },
        "amr_death": { n: "死亡盔甲", type: "arm", slot: "armor", ac: 8, str: 2, dex: 2, wis: -2, cha: -2, hpR: 5, req: "knight", safe: 0, p: 85000, legend: true, gachaWeight: 1, d: "亡者之魂縈繞的傳說盔甲，賜予力量與敏捷，卻奪去心神與光采。力量+2、敏捷+2、精神-2、魅力-2、HP自然恢復+5。" },
        "glv_death": { n: "死亡手套", type: "arm", slot: "gloves", ac: 3, str: 1, dex: 1, cha: -2, req: "all", safe: 0, p: 75000, legend: true, gachaWeight: 1, d: "死亡所淬鍊的傳說手套，握者得其力與巧，卻為旁人所畏。力量+1、敏捷+1、魅力-2。" },
        "shd_death": { n: "死亡之盾", type: "arm", slot: "shield", ac: 1, block: 100, stunResist: 100, req: "knight,elf,dark", safe: 0, p: 45000, legend: true, gachaWeight: 1, d: "由死亡本身鑄成的傳說之盾，任何打擊都被它無聲吞沒。格檔100%、免疫暈眩。" },
        // ===== 🛡️ 臂甲（裝於「副手/盾牌」欄，可與雙手武器並用；type:arm 沿用盾牌的祝福/詞綴/上限+15；強化每+1 HP+10；門檻特效達標套用、取最高階非累加）=====
        "armguard_guardian": { n: "守護者臂甲", type: "arm", slot: "shield", ac: 1, req: "knight,elf,dark", safe: 0, p: 52000, gachaWeight: 10, armguard: { stat: "dr", base: 1, th: [1, 2, 3] }, d: "守護者代代相傳的臂甲（裝於副手，可與雙手武器並用），堅實的護面為持有者擋下重擊。額外減傷+1；強化達 +5/+7/+9 時額外減傷改為 +2/+3/+4（取最高階、非累加）。每強化+1，HP+10。" },
        "armguard_mage": { n: "法師臂甲", type: "arm", slot: "shield", ac: 2, int: 2, req: "mage", safe: 0, p: 52000, gachaWeight: 10, armguard: { stat: "magicDmg", base: 0, th: [1, 2, 3] }, d: "刻滿符文的法師臂甲（裝於副手，可與雙手武器並用），引導魔力流轉於指尖。智力+2；強化達 +5/+7/+9 時魔法傷害 +1/+2/+3（取最高階、非累加）。每強化+1，HP+10。" },
        "armguard_con": { n: "體力臂甲", type: "arm", slot: "shield", ac: 0, req: "knight,elf,dark", safe: 0, p: 52000, gachaWeight: 10, armguard: { stat: "mhp", base: 50, th: [25, 50, 75] }, d: "厚重結實的體力臂甲（裝於副手，可與雙手武器並用），承載著千錘百鍊的強韌體魄。HP+50；強化達 +5/+7/+9 時HP再 +25/+50/+75（取最高階、非累加）。每強化+1，HP+10。" },
        "item_olin_diary": { n: "歐林的日記本", type: "etc", p: 0, c: "text-amber-300", gachaWeight: 0, d: "歐林留下的日記本。可交給說話之島的尤麗婭，換取一件臂甲（三選一）。" },
        // ===== 👑 惡魔王武器（炎魔之影 客製製作；強化值/詞綴/席琳套裝由被消耗的惡魔武器繼承） =====
        "wpn_demonking_spear": { n: "惡魔王矛", type: "wpn", w2h: true, dmgS: 25, dmgL: 25, hit: 2, dmgBonus: 3, spd: 1.0, req: "knight", safe: 6, p: 380000, legend: true, gachaWeight: 1, eff: "pierce", pierceChance: 90, procStatusSkill: { skId: "sk_disease", rate: 10 }, d: "惡魔王執掌的雙手長矛，矛尖所向皆化作瘟疫橫行之地。穿透90%；攻擊時10%機率施放疾病術。" },
        "wpn_demonking_dual": { n: "惡魔王雙刀", type: "wpn", w2h: true, dmgS: 18, dmgL: 16, hit: 5, dmgBonus: 3, spd: 0.8, req: "dark", safe: 6, p: 420000, legend: true, gachaWeight: 1, eff: "combo", procStatusSkill: { skId: "sk_disease", rate: 10 }, d: "惡魔王手中的雙刀，交錯的刃光帶來病厄與死亡。雙擊；攻擊時10%機率施放疾病術。" },
        "wpn_demonking_2hsword": { n: "惡魔王雙手劍", type: "wpn", w2h: true, dmgS: 23, dmgL: 24, hit: 1, dmgBonus: 5, spd: 0.8, req: "knight", safe: 6, p: 354510, legend: true, gachaWeight: 1, eff: "cleave", procStatusSkill: { skId: "sk_disease", rate: 10 }, d: "惡魔王曾以此巨劍劈開無數生靈，劍鋒至今仍滲著腐敗的氣息。切割；攻擊時10%機率施放疾病術。" },
        "wpn_demonking_wand": { n: "惡魔王魔杖", type: "wpn", w2h: true, dmgS: 12, dmgL: 12, hit: 6, dmgBonus: 2, spd: 1.0, req: "mage", safe: 6, p: 494510, legend: true, gachaWeight: 1, eff: "magicburst", mdmg: 2, mpR: 10, mpOnHit: true, procStatusSkill: { skId: "sk_disease", rate: 10 }, d: "惡魔王施法用的魔杖，杖端凝著不散的瘴癘之力。魔爆；魔法傷害+2、MP自然恢復+10；一般攻擊命中恢復MP（+7起每強化額外+1）；攻擊時10%機率施放疾病術。" },
        "wpn_demonking_bow": { n: "惡魔王弓", type: "wpn", isBow: true, ranged: true, rapidfire: 90, w2h: true, dmgS: 5, dmgL: 5, hit: 4, dmgBonus: 6, spd: 1.0, req: "elf", safe: 6, p: 547300, legend: true, gachaWeight: 1, procStatusSkill: { skId: "sk_disease", rate: 10 }, d: "惡魔王的長弓，射出的每一箭都帶著瘟疫的詛咒。連射90%；攻擊時10%機率施放疾病術。" },
        // ===== 🏝️ 遺忘之島：武器 =====
        "wpn_greatsword": { n: "巨劍", type: "wpn", w2h: true, dmgS: 20, dmgL: 14, hit: 0, dmgBonus: 0, spd: 0.9, req: "knight", safe: 6, p: 15000, gachaWeight: 80, eff: "cleave", d: "沉重而厚實的雙手巨劍，一揮便能將成排敵人一同斬開。切割。" },
        "wpn_taurus_axe": { n: "牛人斧頭", type: "wpn", w2h: true, dmgS: 22, dmgL: 24, hit: 0, dmgBonus: 0, spd: 1.1, req: "knight", safe: 6, p: 15000, gachaWeight: 30, eff: "crush", d: "牛人族戰士慣用的雙手鈍器，蠻力一砸足以震碎骨骼。重擊。" },
        "wpn_shaha_bow": { n: "沙哈之弓", type: "wpn", isBow: true, ranged: true, w2h: true, legend: true, rapidfire: 70, dmgS: 4, dmgL: 4, hit: 2, dmgBonus: 5, spd: 1.0, req: "elf", safe: 6, p: 230000, gachaWeight: 0, shahaBow: true, d: "傳說中神射手沙哈所遺的名弓，拉滿弦時便有清風自箭袋憑空生出。連射 70%；裝備時箭矢欄位自動變為彈藥無限的沙哈之箭（小型1D15、大型1D12），卸下沙哈之弓即消失。" },
        "wpn_shaha_arrow": { n: "沙哈之箭", type: "wpn", isArrow: true, dmgS: 15, dmgL: 12, hit: 0, p: 0, gachaWeight: 0, shahaArrow: true, noSell: true, d: "沙哈之弓憑風凝成的箭矢，取之不竭（卸下沙哈之弓即消失）。" },
        // ===== 🏝️ 遺忘之島：防具 =====
        "hlm_wind": { n: "風之頭盔", type: "arm", slot: "helm", ac: 2, req: "mage", safe: 4, p: 26000, gachaWeight: 10, windHelm: true, d: "以疾風祝福鍛成的頭盔，戴上時身形彷彿被風托起。施放加速術、強力加速術不消耗 MP（裝備或放在背包都有效）。" },
        "hlm_darkelf": { n: "黑暗妖精頭箍", type: "arm", slot: "helm", ac: 1, req: "elf,dark", safe: 6, p: 6000, gachaWeight: 30, d: "承載著高等黑暗精靈血脈記憶的頭箍，集齊全套方能喚醒沉睡的暗夜之姿。<br>【黑暗妖精套裝】3 件齊：AC-3、HP自然恢復-2、MP自然恢復-7、力量-2、敏捷+2，變身「高等黑暗精靈」（遠距離傷害+5、遠距離命中+5、攻速+30%，可與自我加速藥水/勇水/妖精餅乾疊加）。" },
        "amr_darkelf": { n: "黑暗妖精鱗甲", type: "arm", slot: "armor", ac: 1, req: "elf,dark", safe: 6, p: 10000, gachaWeight: 30, d: "以暗影精煉而成的鱗甲，與其餘部件呼應時便流轉著幽冷光澤。<br>【黑暗妖精套裝】3 件齊：AC-3、HP自然恢復-2、MP自然恢復-7、力量-2、敏捷+2，變身「高等黑暗精靈」（遠距離傷害+5、遠距離命中+5、攻速+30%，可與自我加速藥水/勇水/妖精餅乾疊加）。" },
        "bot_darkelf": { n: "黑暗妖精涼鞋", type: "arm", slot: "boots", ac: 1, req: "elf,dark", safe: 6, p: 6000, gachaWeight: 30, d: "步履無聲的黑暗妖精涼鞋，齊備全套時方顯其敏捷真章。<br>【黑暗妖精套裝】3 件齊：AC-3、HP自然恢復-2、MP自然恢復-7、力量-2、敏捷+2，變身「高等黑暗精靈」（遠距離傷害+5、遠距離命中+5、攻速+30%，可與自我加速藥水/勇水/妖精餅乾疊加）。" },
        // ===== 🏝️ 遺忘之島：飾品 =====
        "rng_harpy": { n: "哈維戒指", type: "acc", slot: "ring", ac: 0, resWind: 10, mpR: 1, req: "all", safe: 0, p: 100000, gachaWeight: 1, d: "鑲嵌哈維羽風的戒指，戴上時指間隱隱有微風盤旋。風屬性抗性+10、MP自然恢復+1。" },
        // ===== 🏝️ 遺忘之島：製作材料 =====
        "item_ancient_scroll": { n: "古代的卷軸", type: "etc", p: 1, c: "text-amber-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "item_wind_tear": { n: "風之淚", type: "etc", p: 1, c: "text-cyan-300", noUse: true, gachaWeight: 0, d: "製作材料。沙哈之弓的材料之一。" },
        "item_unknown_spear": { n: "不為人知的矛", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "mat_unknown_axe": { n: "不為人知的斧", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "item_forgotten_sword": { n: "受封印 被遺忘的劍", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "item_forgotten_greatsword": { n: "受封印 被遺忘的巨劍", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "item_forgotten_xbow": { n: "受封印 被遺忘的弩槍", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "item_forgotten_scale": { n: "被遺忘的鱗甲", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "item_forgotten_leather": { n: "被遺忘的皮盔甲", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "item_forgotten_robe": { n: "被遺忘的長袍", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        "item_forgotten_plate": { n: "被遺忘的金屬盔甲", type: "etc", p: 1, c: "text-blue-300", noUse: true, gachaWeight: 0, d: "製作材料。" },
        // ===== 🏛️ 古代/古老裝備（威頓村 客盧亞 製作）=====
        "armguard_archer": { n: "古代神射臂甲", type: "arm", slot: "shield", ac: 0, mhp: 80, req: "all", safe: 0, p: 100000, gachaWeight: 0, armguard: { stat: "rangedDmg", base: 1, th: [1, 2, 3] }, d: "古代神射手綁縛拉弦之臂的護甲，仍留有他百步穿楊的氣度（裝於副手，可與雙手武器並用）。HP+80、遠距離傷害+1；強化達 +5/+7/+9 時遠距離傷害改為 +2/+3/+4（取最高階、非累加）。每強化+1，HP+10。" },
        "armguard_fighter": { n: "古代鬥士臂甲", type: "arm", slot: "shield", ac: 0, resFire: 5, resWater: 5, resEarth: 5, resWind: 5, req: "all", safe: 0, p: 100000, gachaWeight: 0, armguard: { stat: "meleeDmg", base: 1, th: [1, 2, 3] }, d: "古代競技場鬥士磨礪近身搏殺的臂甲，刻滿了無數場生死搏鬥的痕跡（裝於副手，可與雙手武器並用）。全屬性抗性+5、近距離傷害+1；強化達 +5/+7/+9 時近距離傷害改為 +2/+3/+4（取最高階、非累加）。每強化+1，HP+10。" },
        "wpn_old_sword": { n: "古老的劍", type: "wpn", dmgS: 35, dmgL: 20, hit: 5, dmgBonus: 0, spd: 1.0, req: "knight,elf,dark", safe: 0, p: 15000, gachaWeight: 0, noEnhance: true, finalMult: 1.5, d: "塵封已久的古代單手劍，劍身雖舊，鋒芒卻不減當年。反擊、居合、最終傷害×1.5；無法強化。" },
        "wpn_old_greatsword": { n: "古老的巨劍", type: "wpn", w2h: true, dmgS: 27, dmgL: 45, hit: 3, dmgBonus: 3, spd: 0.8, req: "knight", safe: 0, p: 15000, gachaWeight: 0, eff: "cleave", noEnhance: true, finalMult: 1.5, d: "古老戰場上遺落的雙手巨劍，沉甸甸的劍身仍能一掃千軍。切割、最終傷害×1.5；無法強化。" },
        "wpn_old_xbow": { n: "古老的弩槍", type: "wpn", isBow: true, ranged: true, oneHand: true, rapidfire: 90, dmgS: 3, dmgL: 3, hit: 5, dmgBonus: 2, spd: 0.9, req: "elf,dark", safe: 6, p: 15000, gachaWeight: 0, d: "古代工匠巧製的單手弩槍，是有史以來第一把可單手持握的弓。連射90%；可同時裝備盾牌或臂甲。" },
        "wpn_ancient_spear": { n: "古代神之槍", type: "wpn", w2h: true, legend: true, dmgS: 27, dmgL: 30, hit: 3, dmgBonus: 5, spd: 1.0, req: "knight", safe: 6, p: 465000, gachaWeight: 0, eff: "pierce", pierceChance: 90, d: "傳說由古代神祇親手持握的雙手神槍，槍尖所向無可阻擋。穿透90%。" },
        "wpn_ancient_axe": { n: "古代神之斧", type: "wpn", legend: true, dmgS: 25, dmgL: 28, hit: 3, dmgBonus: 8, spd: 1.2, req: "warrior", safe: 6, p: 465000, gachaWeight: 0, d: "古代神祇腰間配掛的單手神斧，劈下時連神明也為之低首。鈍擊。" },
        "wpn_ancient_darkelf_sword": { n: "古代黑暗妖精之劍", type: "wpn", dmgS: 12, dmgL: 12, hit: 3, dmgBonus: 1, spd: 1.1, req: "elf", safe: 6, p: 68000, gachaWeight: 1, unBonus: true, dex: 1, mhp: 50, d: "古代黑暗妖精所執的單手劍，劍身流轉著暗夜的寒光。反擊、對不死 / 狼人加成；近距離傷害+1、近距離命中+3、敏捷+1、HP+50。" },
        "wpn_ancient_elf_xbow": { n: "古代妖精弩槍", type: "wpn", isBow: true, ranged: true, oneHand: true, rapidfire: 55, dmgS: 3, dmgL: 3, hit: 1, dmgBonus: 2, spd: 1.0, req: "elf", safe: 6, p: 68000, gachaWeight: 1, dex: 1, d: "古代妖精打造的單手弩槍，輕巧迅捷、箭如疾風。連射55%、敏捷+1；遠距離傷害+2、遠距離命中+1；可同時裝備盾牌或臂甲。" },
        // ===== 👹 隱藏的魔族武器（說話之島 尤麗婭以 黑暗哈汀的日記本 六選一兌換；紅惡靈逆襲＝水魔傷+吸HP / 藍惡靈奪魔＝回MP，4%+每強化1%） =====
        "wpn_demon_sword_hidden": { n: "隱藏的魔族之劍", type: "wpn", dmgS: 23, dmgL: 25, hit: 3, dmgBonus: 0, spd: 1.1, req: "royal,knight,elf,dragon", safe: 0, p: 28000, gachaWeight: 1, mhp: 30, ignHardSkin: true, redSpecter: true, d: "潛藏魔族之力的單手劍，劍身浮現赤紅惡靈的低語。反擊、貫穿、HP+30；近距離命中+3。攻擊時 4%（每強化 +1%）機率發動 紅惡靈逆襲：4D10 水屬性魔法傷害（受魔法傷害公式影響），並恢復造成傷害 10% 的 HP。" },
        "wpn_demon_bow_hidden": { n: "隱藏的魔族弓箭", type: "wpn", isBow: true, ranged: true, oneHand: true, rapidfire: 70, dmgS: 2, dmgL: 2, hit: 3, dmgBonus: 6, spd: 1.0, req: "royal,mage,elf,illusion", safe: 0, p: 28000, gachaWeight: 1, blueSpecter: true, d: "潛藏魔族之力的單手弓，弦上纏繞著湛藍惡靈的氣息。連射70%；遠距離傷害+6、遠距離命中+3；可同時裝備盾牌或臂甲。攻擊時 4%（每強化 +1%）機率發動 藍惡靈奪魔：恢復 3D6 MP。" },
        "wpn_demon_wand_hidden": { n: "隱藏的魔族魔杖", type: "wpn", dmgS: 15, dmgL: 16, hit: 3, dmgBonus: 0, spd: 1.0, mdmg: 1, mpR: 3, req: "mage,illusion", safe: 0, p: 28000, gachaWeight: 1, blueSpecter: true, d: "潛藏魔族之力的魔杖，杖頭湛藍惡靈共鳴不息。共鳴、貫穿、魔法傷害+1、MP自然恢復量+3；近距離命中+3。攻擊時 4%（每強化 +1%）機率發動 藍惡靈奪魔：恢復 3D6 MP。" },
        "wpn_demon_claw_hidden": { n: "隱藏的魔族鋼爪", type: "wpn", w2h: true, dmgS: 24, dmgL: 26, hit: 3, dmgBonus: 0, spd: 0.9, eff: "combo", comboRate: 33, req: "dark", safe: 0, p: 28000, gachaWeight: 1, redSpecter: true, d: "潛藏魔族之力的雙手鋼爪，爪尖撕扯間迸出赤紅惡靈之火。雙擊33%、貫穿；近距離命中+3。攻擊時 4%（每強化 +1%）機率發動 紅惡靈逆襲：4D10 水屬性魔法傷害（受魔法傷害公式影響），並恢復造成傷害 10% 的 HP。" },
        "wpn_demon_chain_hidden": { n: "隱藏的魔族鎖鏈劍", type: "wpn", w2h: true, chainsword: true, weakExpose: true, dmgS: 25, dmgL: 26, hit: 3, dmgBonus: 0, spd: 0.9, req: "dragon", safe: 0, p: 28000, gachaWeight: 1, redSpecter: true, d: "潛藏魔族之力的雙手鎖鏈劍，鏈節間糾纏著赤紅惡靈的怨念。弱點曝光、貫穿；近距離命中+3。攻擊時 4%（每強化 +1%）機率發動 紅惡靈逆襲：4D10 水屬性魔法傷害（受魔法傷害公式影響），並恢復造成傷害 10% 的 HP。" },
        "wpn_demon_qigu_hidden": { n: "隱藏的魔族奇古獸", type: "wpn", qigu: true, dmgS: 28, dmgL: 28, hit: 3, dmgBonus: 0, spd: 1.0, mdmg: 1, mpR: 1, req: "illusion", safe: 0, p: 28000, gachaWeight: 1, blueSpecter: true, d: "潛藏魔族之力的奇古獸，獸身散發湛藍惡靈的魔力。奇古獸（魔法傷害）、魔法傷害+1、MP自然恢復量+1；近距離命中+3。攻擊時 4%（每強化 +1%）機率發動 藍惡靈奪魔：恢復 3D6 MP。" },
        "amr_old_plate": { n: "古老的金屬盔甲", type: "arm", slot: "armor", ac: 16, hpR: 1, req: "knight", safe: 0, p: 10000, gachaWeight: 0, noEnhance: true, d: "歷經歲月仍未鏽蝕的古代金屬盔甲，沉默地守護著穿戴者。HP自然恢復+1；無法強化。" },
        "amr_old_scale": { n: "古老的鱗甲", type: "arm", slot: "armor", ac: 14, hpR: 8, mpR: 4, req: "knight,elf,dark", safe: 0, p: 10000, gachaWeight: 0, noEnhance: true, d: "古代工匠以層層鱗片疊織的鎧甲，輕巧卻不失堅韌。HP自然恢復+8、MP自然恢復+4；無法強化。" },
        "amr_old_leather": { n: "古老的皮盔甲", type: "arm", slot: "armor", ac: 14, hpR: 4, mpR: 8, req: "elf,dark", safe: 0, p: 10000, gachaWeight: 0, noEnhance: true, d: "古代遊俠所穿的皮製戰甲，柔軟貼身，行動無拘。HP自然恢復+4、MP自然恢復+8；無法強化。" },
        "amr_old_robe": { n: "古老的長袍", type: "arm", slot: "armor", ac: 12, mpR: 12, req: "mage", safe: 0, p: 10000, gachaWeight: 0, noEnhance: true, d: "古代術士披掛的長袍，織線間仍縈繞著淡淡的魔力餘韻。MP自然恢復+12；無法強化。" },
        // ===== 法師魔法書 =====
        "bk_heal1": { type: "skillbk", n: "魔法書(初級治癒術)", p: 100, sk: "sk_heal1", gachaWeight: 0 },
        "bk_sunlight": { type: "skillbk", n: "魔法書(日光術)", p: 100, sk: "sk_sunlight", gachaWeight: 0 },
        "bk_shield": { type: "skillbk", n: "魔法書(保護罩)", p: 100, sk: "sk_shield", gachaWeight: 0 },
        "bk_lightarrow": { type: "skillbk", n: "魔法書(光箭)", p: 100, sk: "sk_lightarrow", gachaWeight: 0 },
        "bk_teleport": { type: "skillbk", n: "魔法書(指定傳送)", p: 100, sk: "sk_teleport", gachaWeight: 0 },
        "bk_icearrow": { type: "skillbk", n: "魔法書(冰箭)", p: 100, sk: "sk_icearrow", gachaWeight: 0 },
        "bk_windblade": { type: "skillbk", n: "魔法書(風刃)", p: 100, sk: "sk_windblade", gachaWeight: 0 },
        "bk_holy_wpn": { type: "skillbk", n: "魔法書(神聖武器)", p: 100, sk: "sk_holy_wpn", gachaWeight: 0 },
        
        "bk_antidote": { type: "skillbk", n: "魔法書(解毒術)", p: 400, sk: "sk_antidote", gachaWeight: 0 },
        "bk_cold_shiver": { type: "skillbk", n: "魔法書(寒冷戰慄)", p: 400, sk: "sk_cold_shiver", gachaWeight: 0 },
        "bk_poison_curse": { type: "skillbk", n: "魔法書(毒咒)", p: 400, sk: "sk_poison_curse", gachaWeight: 0 },
        "bk_ench_wpn": { type: "skillbk", n: "魔法書(擬似魔法武器)", p: 400, sk: "sk_ench_wpn", gachaWeight: 0 },
        "bk_reveal": { type: "skillbk", n: "魔法書(無所遁形術)", p: 400, sk: "sk_reveal", gachaWeight: 0 },
        "bk_load_up": { type: "skillbk", n: "魔法書(負重強化)", p: 400, sk: "sk_load_up", gachaWeight: 0 },
        "bk_firearrow": { type: "skillbk", n: "魔法書(火箭)", p: 400, sk: "sk_firearrow", gachaWeight: 0 },
        "bk_hell_fang": { type: "skillbk", n: "魔法書(地獄之牙)", p: 400, sk: "sk_hell_fang", gachaWeight: 0 },

        "bk_aurora": { type: "skillbk", n: "魔法書(極光雷電)", p: 1200, sk: "sk_aurora", gachaWeight: 0 },
        "bk_undead_bane": { type: "skillbk", n: "魔法書(起死回生術)", p: 1200, sk: "sk_undead_bane", gachaWeight: 0 },
        "bk_heal_mid": { type: "skillbk", n: "魔法書(中級治癒術)", p: 1200, sk: "sk_heal_mid", gachaWeight: 0 },
        "bk_dark_blind": { type: "skillbk", n: "魔法書(闇盲咒術)", p: 1200, sk: "sk_dark_blind", gachaWeight: 0 },
        "bk_shield2": { type: "skillbk", n: "魔法書(鎧甲護持)", p: 1200, sk: "sk_shield2", gachaWeight: 0 },
        "bk_chill": { type: "skillbk", n: "魔法書(寒冰氣息)", p: 1200, sk: "sk_chill", gachaWeight: 0 },
        "bk_energy_sense": { type: "skillbk", n: "魔法書(能量感測)", p: 1200, sk: "sk_energy_sense", gachaWeight: 0 },
        "bk_fireball": { type: "skillbk", n: "魔法書(燃燒的火球)", p: 1200, sk: "sk_fireball", gachaWeight: 0 },

        "bk_dex_up": { type: "skillbk", n: "魔法書(通暢氣脈術)", p: 3300, sk: "sk_dex_up", gachaWeight: 30 },
        "bk_break": { type: "skillbk", n: "魔法書(壞物術)", p: 3300, sk: "sk_break", gachaWeight: 80 },
        "bk_vampire": { type: "skillbk", n: "魔法書(吸血鬼之吻)", p: 3300, sk: "sk_vampire", gachaWeight: 80 },
        "bk_slow": { type: "skillbk", n: "魔法書(緩速術)", p: 3300, sk: "sk_slow", gachaWeight: 80 },
        "bk_rock_prison": { type: "skillbk", n: "魔法書(岩牢)", p: 3300, sk: "sk_rock_prison", gachaWeight: 80 },
        "bk_magic_shield": { type: "skillbk", n: "魔法書(魔法屏障)", p: 3300, sk: "sk_magic_shield", gachaWeight: 20 },
        "bk_meditation": { type: "skillbk", n: "魔法書(冥想術)", p: 3300, sk: "sk_meditation", gachaWeight: 20 },

        "bk_mummy_curse": { type: "skillbk", n: "魔法書(木乃伊的詛咒)", p: 8250, sk: "sk_mummy_curse", gachaWeight: 70 },
        "bk_charm": { type: "skillbk", n: "魔法書(迷魅術)", p: 8250, sk: "sk_charm", gachaWeight: 70 },
        "bk_thunder": { type: "skillbk", n: "魔法書(極道落雷)", p: 8250, sk: "sk_thunder", gachaWeight: 70 },
        "bk_heal2": { type: "skillbk", n: "魔法書(高級治癒術)", p: 8250, sk: "sk_heal2", gachaWeight: 70 },
        "bk_holy_light": { type: "skillbk", n: "魔法書(聖潔之光)", p: 8250, sk: "sk_holy_light", gachaWeight: 50 },
        "bk_ice_spike": { type: "skillbk", n: "魔法書(冰錐)", p: 8250, sk: "sk_ice_spike", gachaWeight: 70 },
        "bk_mana_drain": { type: "skillbk", n: "魔法書(魔力奪取)", p: 8250, sk: "sk_mana_drain", gachaWeight: 70 },
        "bk_dark_shadow": { type: "skillbk", n: "魔法書(黑闇之影)", p: 8250, sk: "sk_dark_shadow", gachaWeight: 70 },

        "bk_zombie": { type: "skillbk", n: "魔法書(造屍術)", p: 18000, sk: "sk_zombie", gachaWeight: 60 },
        "bk_haste_spell": { type: "skillbk", n: "魔法書(加速術)", p: 18000, sk: "sk_haste_spell", gachaWeight: 60 },
        "bk_cancel": { type: "skillbk", n: "魔法書(魔法相消術)", p: 18000, sk: "sk_cancel", gachaWeight: 10 },
        "bk_earthquake": { type: "skillbk", n: "魔法書(地裂術)", p: 18000, sk: "sk_earthquake", gachaWeight: 20 },
        "bk_str_up": { type: "skillbk", n: "魔法書(體魄強健術)", p: 18000, sk: "sk_str_up", gachaWeight: 10 },
        "bk_bless_wpn": { type: "skillbk", n: "魔法書(祝福魔法武器)", p: 18000, sk: "sk_bless_wpn", gachaWeight: 10 },
        "bk_weaken": { type: "skillbk", n: "魔法書(弱化術)", p: 18000, sk: "sk_weaken", gachaWeight: 60 },

        "bk_regen": { type: "skillbk", n: "魔法書(體力回復術)", p: 36000, sk: "sk_regen", gachaWeight: 50 },
        "bk_greater_haste": { type: "skillbk", n: "魔法書(強力加速術)", p: 36000, sk: "sk_greater_haste", gachaWeight: 50 },
        "bk_ice_lance": { type: "skillbk", n: "魔法書(冰矛圍籬)", p: 36000, sk: "sk_ice_lance", gachaWeight: 20 },
        "bk_tornado": { type: "skillbk", n: "魔法書(龍捲風)", p: 36000, sk: "sk_tornado", gachaWeight: 1 },
        "bk_berserk": { type: "skillbk", n: "魔法書(狂暴術)", p: 36000, sk: "sk_berserk", gachaWeight: 30 },
        "bk_summon": { type: "skillbk", n: "魔法書(召喚術)", p: 36000, sk: "sk_summon", gachaWeight: 1 },
        "bk_holy_dash": { type: "skillbk", n: "魔法書(神聖疾走)", p: 36000, sk: "sk_holy_dash", gachaWeight: 10 },
        "bk_disease": { type: "skillbk", n: "魔法書(疾病術)", p: 36000, sk: "sk_disease", gachaWeight: 50 },

        "bk_full_heal": { type: "skillbk", n: "魔法書(全部治癒術)", p: 54000, sk: "sk_full_heal", gachaWeight: 40 },
        "bk_blizzard": { type: "skillbk", n: "魔法書(冰雪暴)", p: 54000, sk: "sk_blizzard", gachaWeight: 1 },
        "bk_blizzard_storm": { type: "skillbk", n: "魔法書(冰雪颶風)", p: 102400, sk: "sk_blizzard_storm", gachaWeight: 1, d: "習得「冰雪颶風」（十階魔法・水屬性・全體）：於輔助欄勾選維持的傷害技能，持續 32 秒內每 4 秒對全體敵人造成 1D10 水屬性魔法傷害，並依（魔法命中-3）機率使其冰凍；效果結束後才能再次施放。" },
        "bk_fire_prison": { type: "skillbk", n: "魔法書(火牢)", p: 25600, sk: "sk_fire_prison", gachaWeight: 1, d: "習得「火牢」（八階魔法・火屬性・全體）：於輔助欄勾選維持的傷害技能，持續 10 秒內每 2 秒對全體敵人造成 1D15 火屬性魔法傷害；效果結束後才能再次施放。" },
        "bk_quake": { type: "skillbk", n: "魔法書(震裂術)", p: 54000, sk: "sk_quake", gachaWeight: 10 },
        "bk_invisible": { type: "skillbk", n: "魔法書(隱身術)", p: 54000, sk: "sk_invisible", gachaWeight: 1 },
        "bk_resurrection": { type: "skillbk", n: "魔法書(返生術)", p: 54000, sk: "sk_resurrection", gachaWeight: 1 },
        "bk_seal": { type: "skillbk", n: "魔法書(魔法封印)", p: 54000, sk: "sk_seal", gachaWeight: 40 },

        "bk_holy_barrier": { type: "skillbk", n: "魔法書(聖結界)", p: 120000, sk: "sk_holy_barrier", gachaWeight: 1 },
        "bk_sleep_mist": { type: "skillbk", n: "魔法書(沉睡之霧)", p: 120000, sk: "sk_sleep_mist", gachaWeight: 30 },
        "bk_thunder_storm": { type: "skillbk", n: "魔法書(雷霆風暴)", p: 120000, sk: "sk_thunder_storm", gachaWeight: 10 },
        "bk_fire_storm": { type: "skillbk", n: "魔法書(火風暴)", p: 120000, sk: "sk_fire_storm", gachaWeight: 1 },
        "bk_blaze": { type: "skillbk", n: "魔法書(烈炎術)", p: 6400, sk: "sk_blaze", gachaWeight: 0 },

        "bk_meteor": { type: "skillbk", n: "魔法書(流星雨)", p: 250000, sk: "sk_meteor", gachaWeight: 1 },
        "bk_soul_up": { type: "skillbk", n: "魔法書(靈魂昇華)", p: 250000, sk: "sk_soul_up", gachaWeight: 1 },
        "bk_abs_barrier": { type: "skillbk", n: "魔法書(絕對屏障)", p: 102400, sk: "sk_abs_barrier", gachaWeight: 1, d: "習得「絕對屏障」（手動・增益・持續7秒）：施放後與世界隔絕——無法攻擊、施法、使用藥水與道具，不會自然恢復HP/MP，也不會受到任何傷害；效果結束後需等待12秒才能再次使用。" },
        "bk_disintegrate": { type: "skillbk", n: "魔法書(究極光裂術)", p: 250000, sk: "sk_disintegrate", gachaWeight: 1 },

        // ===== 騎士技術書 =====
        "bk_solid_shield": { type: "skillbk", n: "技術書(堅固防護)", p: 30000, sk: "sk_solid_shield", gachaWeight: 10 },
        "bk_reduction_armor": { type: "skillbk", n: "技術書(增幅防禦)", p: 30000, sk: "sk_reduction_armor", gachaWeight: 10 },
        "bk_shock_stun": { type: "skillbk", n: "技術書(衝擊之暈)", p: 30000, sk: "sk_shock_stun", gachaWeight: 10 },
        "bk_spike_armor": { type: "skillbk", n: "技術書(尖刺盔甲)", p: 30000, sk: "sk_spike_armor", gachaWeight: 1 },
        "bk_counter_barrier": { type: "skillbk", n: "技術書(反擊屏障)", p: 30000, sk: "sk_counter_barrier", gachaWeight: 1, d: "習得「反擊屏障」（增益・持續64秒）：裝備雙手武器時可發動反擊；裝備原生有反擊/居合的武器時，反擊與居合最終傷害×2。" },

        // ===== 妖精精靈水晶 =====
        "bk_elf_mr": { type: "skillbk", n: "精靈水晶(魔法防禦)", p: 3000, sk: "sk_elf_mr", gachaWeight: 0 },
        "bk_elf_mind": { type: "skillbk", n: "精靈水晶(心靈轉換)", p: 3000, sk: "sk_elf_mind", gachaWeight: 0 },
        "bk_elf_worldtree": { type: "skillbk", n: "精靈水晶(世界樹的呼喚)", p: 3000, sk: "sk_elf_worldtree", gachaWeight: 0 },
        "bk_elf_triple": { type: "skillbk", n: "精靈水晶(三重矢)", p: 3000, sk: "sk_elf_triple", gachaWeight: 10 },

        "bk_elf_purify": { type: "skillbk", n: "精靈水晶(淨化精神)", p: 7500, sk: "sk_elf_purify", gachaWeight: 0 },
        "bk_elf_eleres": { type: "skillbk", n: "精靈水晶(屬性防禦)", p: 7500, sk: "sk_elf_eleres", gachaWeight: 0 },
        "bk_elf_release": { type: "skillbk", n: "精靈水晶(釋放元素)", p: 7500, sk: "sk_elf_release", gachaWeight: 0 },
        "bk_elf_soul": { type: "skillbk", n: "精靈水晶(魂體轉換)", p: 7500, sk: "sk_elf_soul", gachaWeight: 20 },

        "bk_elf_singleres": { type: "skillbk", n: "精靈水晶(單屬性防禦)", p: 15000, sk: "sk_elf_singleres", gachaWeight: 0 },
        "bk_elf_firewpn": { type: "skillbk", n: "精靈水晶(火焰武器)", p: 15000, sk: "sk_elf_firewpn", gachaWeight: 0 },
        "bk_elf_windshot": { type: "skillbk", n: "精靈水晶(風之神射)", p: 15000, sk: "sk_elf_windshot", gachaWeight: 0 },
        "bk_elf_winddash": { type: "skillbk", n: "精靈水晶(風之疾走)", p: 15000, sk: "sk_elf_winddash", gachaWeight: 0 },
        "bk_elf_earthguard": { type: "skillbk", n: "精靈水晶(大地防護)", p: 15000, sk: "sk_elf_earthguard", gachaWeight: 0 },
        "bk_elf_groundtrap": { type: "skillbk", n: "精靈水晶(地面障礙)", p: 15000, sk: "sk_elf_groundtrap", gachaWeight: 0 },

        "bk_elf_magicerase": { type: "skillbk", n: "精靈水晶(魔法消除)", p: 30000, sk: "sk_elf_magicerase", gachaWeight: 40 },
        "bk_elf_summon": { type: "skillbk", n: "精靈水晶(召喚屬性精靈)", p: 30000, sk: "sk_elf_summon", gachaWeight: 20 },
        "bk_elf_dancefire": { type: "skillbk", n: "精靈水晶(舞躍之火)", p: 30000, sk: "sk_elf_dancefire", gachaWeight: 10 },
        "bk_elf_stormeye": { type: "skillbk", n: "精靈水晶(暴風之眼)", p: 30000, sk: "sk_elf_stormeye", gachaWeight: 10 },
        "bk_elf_mirror": { type: "skillbk", n: "精靈水晶(鏡反射)", p: 16000, sk: "sk_elf_mirror", gachaWeight: 1, d: "習得「鏡反射」（輔助・增益・持續16秒）：受到魔法傷害時，有（精神）% 機率（每 1 點精神 +1%）對施法目標造成與自身所受傷害等量的必中固定傷害。" },
        "bk_elf_earthshield": { type: "skillbk", n: "精靈水晶(大地屏障)", p: 30000, sk: "sk_elf_earthshield", gachaWeight: 10 },
        "bk_elf_lifespring": { type: "skillbk", n: "精靈水晶(生命之泉)", p: 30000, sk: "sk_elf_lifespring", gachaWeight: 10 },
        "bk_elf_earthbless": { type: "skillbk", n: "精靈水晶(大地的祝福)", p: 30000, sk: "sk_elf_earthbless", gachaWeight: 10 },

        "bk_elf_summon2": { type: "skillbk", n: "精靈水晶(召喚強力屬性精靈)", p: 60000, sk: "sk_elf_summon2", gachaWeight: 1 },
        "bk_elf_lifebless": { type: "skillbk", n: "精靈水晶(生命的祝福)", p: 60000, sk: "sk_elf_lifebless", gachaWeight: 5 },
        "bk_elf_seal": { type: "skillbk", n: "精靈水晶(封印禁地)", p: 60000, sk: "sk_elf_seal", gachaWeight: 10 },
        "bk_elf_blazewpn": { type: "skillbk", n: "精靈水晶(烈炎武器)", p: 60000, sk: "sk_elf_blazewpn", gachaWeight: 1 },
        "bk_elf_flamesoul": { type: "skillbk", n: "精靈水晶(烈焰之魂)", p: 16000, sk: "sk_elf_flamesoul", gachaWeight: 1, d: "習得「烈焰之魂」（五階精靈魔法・火屬性）。持續 128 秒內，近距離一般攻擊的武器擲骰必定為最大值；效果結束後才能再次施放。" },
        "bk_elf_physboost": { type: "skillbk", n: "精靈水晶(體能激發)", p: 16000, sk: "sk_elf_physboost", gachaWeight: 20, d: "習得「體能激發」（五階精靈魔法・地屬性・增益）。持續 960 秒內，負重狀態下仍可自然恢復 HP、MP；效果結束後才能再次施放。" },
        "bk_elf_energyboost": { type: "skillbk", n: "精靈水晶(能量激發)", p: 16000, sk: "sk_elf_energyboost", gachaWeight: 20, d: "習得「能量激發」（五階精靈魔法・火屬性・增益）。持續 960 秒內，負重狀態下仍可自然恢復 HP、MP；效果結束後才能再次施放。" },
        "bk_elf_attrfire": { type: "skillbk", n: "精靈水晶(屬性之火)", p: 16000, sk: "sk_elf_attrfire", gachaWeight: 1, d: "習得「屬性之火」（五階精靈魔法・火屬性・增益）。持續 320 秒內，一般攻擊有 30% 機率造成 1.5 倍傷害；效果結束後才能再次施放。" },
        "bk_elf_preciseshot": { type: "skillbk", n: "精靈水晶(精準射擊)", p: 16000, sk: "sk_elf_preciseshot", gachaWeight: 1, d: "習得「精準射擊」（五階精靈魔法・風屬性・輔助・增益）。持續 64 秒內，一般攻擊的最高命中率可提升至 100%；效果結束後才能再次施放。消耗 MP 15。" },
        "bk_elf_stormshot": { type: "skillbk", n: "精靈水晶(暴風神射)", p: 60000, sk: "sk_elf_stormshot", gachaWeight: 1 },
        "bk_elf_steelguard": { type: "skillbk", n: "精靈水晶(鋼鐵防護)", p: 60000, sk: "sk_elf_steelguard", gachaWeight: 1 },
        "bk_elf_watervital": { type: "skillbk", n: "精靈水晶(水之元氣)", p: 4000, sk: "sk_elf_watervital", gachaWeight: 10, d: "習得「水之元氣」（三階精靈魔法・水屬性・增益）。持續 64 秒內，下次受到治癒術治癒時恢復量加倍（持續回復 HoT 不計），觸發後 7 秒冷卻；效果結束後才能再次施放。" },
        // ===== 黑暗精靈水晶（黑暗妖精魔法，賽帝亞販售；潘朵拉抽不到） =====
        "bk_dark_str":       { type: "skillbk", n: "黑暗精靈水晶(力量提升)", p: 500,   sk: "sk_dark_str",       gachaWeight: 0 },
        "bk_dark_mrup":      { type: "skillbk", n: "黑暗精靈水晶(影之防護)", p: 500,   sk: "sk_dark_mrup",      gachaWeight: 0 },
        "bk_dark_stealth":   { type: "skillbk", n: "黑暗精靈水晶(暗隱術)",   p: 500,   sk: "sk_dark_stealth",   gachaWeight: 0 },
        "bk_dark_poison":    { type: "skillbk", n: "黑暗精靈水晶(附加劇毒)", p: 500,   sk: "sk_dark_poison",    gachaWeight: 0 },
        "bk_dark_refine":    { type: "skillbk", n: "黑暗精靈水晶(提煉魔石)", p: 500,   sk: "sk_dark_refine",    gachaWeight: 0 },
        "bk_dark_dex":       { type: "skillbk", n: "黑暗精靈水晶(敏捷提升)", p: 2500,  sk: "sk_dark_dex",       gachaWeight: 0 },
        "bk_dark_poisonres": { type: "skillbk", n: "黑暗精靈水晶(毒性抵抗)", p: 2500,  sk: "sk_dark_poisonres", gachaWeight: 0 },
        "bk_dark_burn":      { type: "skillbk", n: "黑暗精靈水晶(燃燒鬥志)", p: 2500,  sk: "sk_dark_burn",      gachaWeight: 0 },
        "bk_dark_walkhaste": { type: "skillbk", n: "黑暗精靈水晶(行走加速)", p: 2500,  sk: "sk_dark_walkhaste", gachaWeight: 0 },
        "bk_dark_fang":      { type: "skillbk", n: "黑暗精靈水晶(暗影之牙)", p: 12500, sk: "sk_dark_fang",      gachaWeight: 10 },
        "bk_dark_dodge":     { type: "skillbk", n: "黑暗精靈水晶(暗影閃避)", p: 12500, sk: "sk_dark_dodge",     gachaWeight: 10 },
        "bk_dark_crit":      { type: "skillbk", n: "黑暗精靈水晶(會心一擊)", p: 12500, sk: "sk_dark_crit",      gachaWeight: 10 },
        "bk_dark_erup":      { type: "skillbk", n: "黑暗精靈水晶(迴避提升)", p: 12500, sk: "sk_dark_erup",      gachaWeight: 10 },
        "bk_dark_double":    { type: "skillbk", n: "黑暗精靈水晶(雙重破壞)", p: 12500, sk: "sk_dark_double",    gachaWeight: 10 },
        "bk_dark_armorbreak":{ type: "skillbk", n: "黑暗精靈水晶(破壞盔甲)", p: 12500, sk: "sk_dark_armorbreak", gachaWeight: 1 },
        // ===== 記憶水晶（幻術士法術，史菲爾販售）=====
        "mem_ogre":       { type: "skillbk", n: "記憶水晶(幻覺：歐吉)", p: 1800,  sk: "sk_illu_ogre",       gachaWeight: 0 },
        "mem_confuse":    { type: "skillbk", n: "記憶水晶(混亂)",       p: 1800,  sk: "sk_illu_confuse",    gachaWeight: 0 },
        "mem_cube_burn":  { type: "skillbk", n: "記憶水晶(立方：燃燒)", p: 1800,  sk: "sk_illu_cube_burn",  gachaWeight: 0 },
        "mem_crush":      { type: "skillbk", n: "記憶水晶(粉碎能量)",   p: 1800,  sk: "sk_illu_crush",      gachaWeight: 0 },
        "mem_mirror":     { type: "skillbk", n: "記憶水晶(鏡像)",       p: 1800,  sk: "sk_illu_mirror",     gachaWeight: 0 },
        "mem_focus":      { type: "skillbk", n: "記憶水晶(專注)",       p: 4800,  sk: "sk_illu_focus",      gachaWeight: 0 },
        "mem_lich":       { type: "skillbk", n: "記憶水晶(幻覺：巫妖)", p: 4800,  sk: "sk_illu_lich",       gachaWeight: 0 },
        "mem_mindbreak":  { type: "skillbk", n: "記憶水晶(心靈破壞)",   p: 4800,  sk: "sk_illu_mindbreak",  gachaWeight: 20 },
        "mem_cube_quake": { type: "skillbk", n: "記憶水晶(立方：地裂)", p: 4800,  sk: "sk_illu_cube_quake", gachaWeight: 20 },
        "mem_skullbreak": { type: "skillbk", n: "記憶水晶(骷髏毀壞)",   p: 4800,  sk: "sk_illu_skullbreak", gachaWeight: 0 },
        "mem_fantasy":    { type: "skillbk", n: "記憶水晶(幻想)",       p: 10800, sk: "sk_illu_fantasy",    gachaWeight: 10 },
        "mem_golem":      { type: "skillbk", n: "記憶水晶(幻覺：鑽石高崙)", p: 10800, sk: "sk_illu_golem",  gachaWeight: 1 },
        "mem_cube_shock": { type: "skillbk", n: "記憶水晶(立方：衝擊)", p: 10800, sk: "sk_illu_cube_shock", gachaWeight: 0 },
        "mem_endure":     { type: "skillbk", n: "記憶水晶(耐力)",       p: 10800, sk: "sk_illu_endure",     gachaWeight: 0 },
        "mem_avatar":     { type: "skillbk", n: "記憶水晶(幻覺：化身)", p: 43200, sk: "sk_illu_avatar",     gachaWeight: 1 },
        "mem_panic":      { type: "skillbk", n: "記憶水晶(恐慌)",       p: 43200, sk: "sk_illu_panic",      gachaWeight: 10 },
        "mem_insight":    { type: "skillbk", n: "記憶水晶(洞察)",       p: 43200, sk: "sk_illu_insight",    gachaWeight: 10 },
        "mem_cube_harmony":{ type: "skillbk", n: "記憶水晶(立方：和諧)", p: 43200, sk: "sk_illu_cube_harmony", gachaWeight: 1 },
        "mem_pain":       { type: "skillbk", n: "記憶水晶(疼痛的歡愉)", p: 43200, sk: "sk_illu_pain",       gachaWeight: 10 },
        // ===== 🐉 龍騎士書板（龍魔法，森帕爾販售一部分・其餘怪物掉落）=====
        "bk_dragon_armor":          { type: "skillbk", n: "龍騎士書板(龍之護鎧)",     p: 2400,  sk: "sk_dragon_armor",          gachaWeight: 30, d: "習得「龍之護鎧」（一階龍魔法・增益・消耗 HP 12）。傷害減免+5，持續 1800 秒（結束才再施放）。" },
        "bk_dragon_flameslash":     { type: "skillbk", n: "龍騎士書板(燃燒擊砍)",     p: 2400,  sk: "sk_dragon_flameslash",     gachaWeight: 0,  d: "習得「燃燒擊砍」（一階龍魔法・增益・消耗 HP 6）。須裝備近距離武器；下一次一般攻擊額外傷害+7並轉為火屬性，持續 60 秒。" },
        "bk_dragon_guardbreak":     { type: "skillbk", n: "龍騎士書板(護衛毀滅)",     p: 2400,  sk: "sk_dragon_guardbreak",     gachaWeight: 0,  d: "習得「護衛毀滅」（一階龍魔法・攻擊・消耗 HP 20）。10% 機率使目標 AC+10，持續 32 秒。" },
        "bk_dragon_lavaspit":       { type: "skillbk", n: "龍騎士書板(岩漿噴吐)",     p: 2400,  sk: "sk_dragon_lavaspit",       gachaWeight: 30, d: "習得「岩漿噴吐」（一階龍魔法・火屬性・全體・消耗 HP 10）。基礎傷害 5D7。" },
        "bk_dragon_awaken_antares": { type: "skillbk", n: "龍騎士書板(覺醒：安塔瑞斯)", p: 2400,  sk: "sk_dragon_awaken_antares", gachaWeight: 10, d: "習得「覺醒：安塔瑞斯」（一階龍魔法・增益・消耗 HP 10、MP 20）。免疫中毒與麻痺、HP+(2×等級)、AC-8、攻速+20%，可與自我加速/變身/血之渴望疊加；持續 600 秒。龍騎士同時只能使用一種覺醒。" },
        "bk_dragon_bloodlust":      { type: "skillbk", n: "龍騎士書板(血之渴望)",     p: 10800, sk: "sk_dragon_bloodlust",      gachaWeight: 10, d: "習得「血之渴望」（二階龍魔法・增益・消耗 HP 30）。攻速+15%，可與自我加速/變身/覺醒疊加；持續 300 秒。" },
        "bk_dragon_slaughter":      { type: "skillbk", n: "龍騎士書板(屠宰者)",       p: 10800, sk: "sk_dragon_slaughter",      gachaWeight: 0,  d: "習得「屠宰者」（二階龍魔法・單體・近距離・消耗 HP 16）。須裝備近距離武器；立即額外進行 3 次近距離一般攻擊；命中時消耗目標的弱點曝光，每層額外傷害+10。" },
        "bk_dragon_terror":         { type: "skillbk", n: "龍騎士書板(恐懼無助)",     p: 10800, sk: "sk_dragon_terror",         gachaWeight: 0,  d: "習得「恐懼無助」（二階龍魔法・攻擊・消耗 HP 12）。10% 機率使目標陷入恐懼，攻擊大幅落空，持續 16 秒。" },
        "bk_dragon_lavabolt":       { type: "skillbk", n: "龍騎士書板(岩漿之箭)",     p: 10800, sk: "sk_dragon_lavabolt",       gachaWeight: 10, d: "習得「岩漿之箭」（二階龍魔法・單體・火屬性・消耗 HP 16）。基礎傷害 10D8。" },
        "bk_dragon_awaken_falion":  { type: "skillbk", n: "龍騎士書板(覺醒：法利昂)",  p: 10800, sk: "sk_dragon_awaken_falion",  gachaWeight: 1,  d: "習得「覺醒：法利昂」（二階龍魔法・增益・消耗 HP 20、MP 30）。MR+15%、全屬性抗性+15、攻速+20%，可疊加；持續 600 秒。同時只能使用一種覺醒。" },
        "bk_dragon_deadlybody":     { type: "skillbk", n: "龍騎士書板(致命身軀)",     p: 43200, sk: "sk_dragon_deadlybody",     gachaWeight: 10, d: "習得「致命身軀」（三階龍魔法・增益・消耗 HP 50）。受到攻擊時 23% 機率反射相同傷害，持續 300 秒。" },
        "bk_dragon_deathlightning": { type: "skillbk", n: "龍騎士書板(奪命之雷)",     p: 43200, sk: "sk_dragon_deathlightning", gachaWeight: 10, d: "習得「奪命之雷」（三階龍魔法・全體・風屬性・消耗 HP 35）。基礎傷害 6D8，機率使目標暈眩。" },
        "bk_dragon_reaper":         { type: "skillbk", n: "龍騎士書板(驚悚死神)",     p: 43200, sk: "sk_dragon_reaper",         gachaWeight: 1,  d: "習得「驚悚死神」（三階龍魔法・攻擊・消耗 HP 20）。無視目標 MR，機率使其一般攻擊傷害-20、技能傷害-20，持續 32 秒。" },
        "bk_dragon_awaken_baraka":  { type: "skillbk", n: "龍騎士書板(覺醒：巴拉卡斯)", p: 43200, sk: "sk_dragon_awaken_baraka",  gachaWeight: 1,  d: "習得「覺醒：巴拉卡斯」（三階龍魔法・增益・消耗 HP 30、MP 50）。力量/體質/敏捷/智力/精神+3、額外命中+5、攻速+20%，可疊加；持續 600 秒。同時只能使用一種覺醒。" },
        // ===== 幻術士階段5：材料 / 任務道具（巴特爾製作 + 希蓮恩試煉用） =====
        "mat_rough_stone": { n: "原石碎片", p: 1, c: "text-slate-300", noUse: true, gachaWeight: 0, d: "未經雕琢的原石碎片，製作奇古獸的素材。" },
        "mat_crack_core":  { n: "龜裂之核", p: 1, c: "text-amber-300", noUse: true, gachaWeight: 0, d: "時空裂痕的紊亂之力被凝鍊成的核心，握於掌中仍隱隱震動，製作奇古獸的素材。由巴特爾以時空裂痕碎片打造。" },
        "mat_rift_shard":  { n: "時空裂痕碎片", p: 1, c: "text-cyan-300", noUse: true, gachaWeight: 0, d: "自時空裂痕崩落而出的碎片，棱角間流轉著扭曲的微光。由特定怪物掉落；可製作龜裂之核，並用於職業試煉。" },
        // ===== 🏛️ 底比斯：寶箱碎片（製作材料）／上鎖寶箱（可使用·消耗龜裂之核開啟）／祭壇鑰匙 =====
        "mat_osiris_basic_up":   { n: "歐西里斯初級寶箱碎片(上)", p: 1, c: "text-amber-200", noUse: true, gachaWeight: 0, d: "歐西里斯初級寶箱的上半碎片。與下半碎片各 1 個可由巴特爾合成『上鎖的歐西里斯初級寶箱』。" },
        "mat_osiris_basic_down": { n: "歐西里斯初級寶箱碎片(下)", p: 1, c: "text-amber-200", noUse: true, gachaWeight: 0, d: "歐西里斯初級寶箱的下半碎片。與上半碎片各 1 個可由巴特爾合成『上鎖的歐西里斯初級寶箱』。" },
        "mat_osiris_high_up":    { n: "歐西里斯高級寶箱碎片(上)", p: 1, c: "text-amber-300", noUse: true, gachaWeight: 0, d: "歐西里斯高級寶箱的上半碎片。與下半碎片各 1 個可由巴特爾合成『上鎖的歐西里斯高級寶箱』。" },
        "mat_osiris_high_down":  { n: "歐西里斯高級寶箱碎片(下)", p: 1, c: "text-amber-300", noUse: true, gachaWeight: 0, d: "歐西里斯高級寶箱的下半碎片。與上半碎片各 1 個可由巴特爾合成『上鎖的歐西里斯高級寶箱』。" },
        "item_osiris_box_basic": { n: "上鎖的歐西里斯初級寶箱", type: "misc", p: 0, c: "text-amber-300", gachaWeight: 0, eff: "osiris_box", boxTier: "basic", d: "以歐西里斯封印的初級寶箱，箱面銘刻著古老的咒文。使用時可選擇開啟數量，每開啟 1 個消耗 1 顆 龜裂之核，隨機獲得底比斯寶物。" },
        "item_osiris_box_high":  { n: "上鎖的歐西里斯高級寶箱", type: "misc", p: 0, c: "text-amber-300", gachaWeight: 0, eff: "osiris_box", boxTier: "high",  d: "沉睡於底比斯深處的歐西里斯高級寶箱，金封下藏著更豐厚的賜予。使用時可選擇開啟數量，每開啟 1 個消耗 1 顆 龜裂之核，隨機獲得更豐厚的底比斯寶物。" },
        "item_thebes_altar_key": { n: "底比斯歐西里斯祭壇鑰匙", p: 1, c: "text-amber-300", gachaWeight: 0, d: "鑄有冥神紋章的古鑰，唯有持之者能踏入沉眠死神的聖殿。通往底比斯歐西里斯祭壇的鑰匙，持有後方可入場（進入與軍王再臨各消耗 1 把）。" },
        "item_ant_fruit":  { n: "污濁安特的水果", p: 0, c: "text-emerald-300", noUse: true, noSell: true, gachaWeight: 0, d: "自腐化安特身上墜落的果實，外皮蒙著一層揮之不去的污濁。希蓮恩的試煉道具。（無法販售）" },
        "item_ant_branch": { n: "污濁安特的樹枝", p: 0, c: "text-emerald-300", noUse: true, noSell: true, gachaWeight: 0, d: "從受污染的安特折下的枯枝，仍滲著黯沉的樹液。希蓮恩的試煉道具。（無法販售）" },
        "item_ant_bark":   { n: "污濁安特的樹皮", p: 0, c: "text-emerald-300", noUse: true, noSell: true, gachaWeight: 0, d: "剝自腐化安特軀幹的樹皮，紋路間爬滿了黑斑。希蓮恩的試煉道具。（無法販售）" },
        "item_elmore_heart": { n: "艾爾摩將軍之心", p: 0, c: "text-rose-300", noUse: true, noSell: true, gachaWeight: 0, d: "自將軍艾爾摩胸中取出、仍微微跳動的心臟，餘威猶在。希蓮恩的試煉道具。（無法販售）" },
        "item_time_orb":   { n: "完成的時間水晶球", p: 0, c: "text-sky-300", noUse: true, noSell: true, gachaWeight: 0, d: "匯聚流逝歲月而成的水晶球，凝視其中彷彿能窺見時光倒流。希蓮恩的試煉道具。（無法販售）" },
        "item_wyvern_blood": { n: "翼龍之血", p: 0, c: "text-red-300", noUse: true, noSell: true, gachaWeight: 0, d: "自翼龍體內汲取的滾燙血液，蘊藏著飛龍一族的兇暴生命力。希蓮恩 50 級試煉道具。（無法販售）" },
        // ===== 🏴‍☠️ 海賊島 武器 =====
        "wpn_pirate_dagger": { n: "血紅慾望短劍", type: "wpn", dmgS: 10, dmgL: 8, hit: 0, spd: 0.8, req: "elf,dark", safe: 6, p: 12000, gachaWeight: 60, unBonus: true, hpR: -3, d: "沁著血色慾望的短刃，渴飲不死與狼人之血。<br>對不死／狼人加成；出血；HP自然恢復量 -3。" },
        "wpn_glory_sword": { n: "榮耀之劍", type: "wpn", dmgS: 9, dmgL: 12, hit: 0, dmgBonus: 2, spd: 1.0, req: "knight,dragon", safe: 6, p: 6000, gachaWeight: 80, d: "象徵騎士榮耀的單手劍，反擊來犯之敵。<br>反擊。" },
        "wpn_pirate_shortblade": { n: "短刀", type: "wpn", dmgS: 10, dmgL: 12, hit: 1, spd: 1.1, req: "royal,knight,elf,dark,dragon", safe: 6, p: 5000, gachaWeight: 100, d: "輕巧易於揮舞的短刀，適合多數職業使用。<br>反擊。" },
        "wpn_pirate_cutlass": { n: "海賊彎刀", type: "wpn", dmgS: 11, dmgL: 6, hit: 1, spd: 1.1, req: "knight,elf,dark,dragon", safe: 6, p: 8000, gachaWeight: 90, unBonus: true, d: "海賊愛用的彎刀，刃口浸染過無數亡者之血。<br>對不死／狼人加成；反擊。" },
        "wpn_abyss_dualblade": { n: "深淵雙刀", type: "wpn", w2h: true, dmgS: 14, dmgL: 10, hit: 0, spd: 0.8, req: "dark", safe: 6, p: 10000, gachaWeight: 50, eff: "combo", comboRate: 25, ignHardSkin: true, d: "自深淵汲取力量的雙刀，撕裂一切堅硬的防護。<br>雙擊 25%；貫穿（無視硬皮額外減傷）。" },
        "wpn_dark_crystalball": { n: "漆黑水晶球", type: "wpn", dmgS: 1, dmgL: 1, hit: 0, spd: 1.0, req: "mage,illusion", safe: 6, p: 20000, gachaWeight: 1, mdmg: 1, cha: 2, ignHardSkin: true, d: "凝聚漆黑魔力的水晶球，魔力共鳴而出。<br>共鳴；貫穿（無視硬皮額外減傷）；魔法傷害 +1；魅力 +2。" },
        "wpn_silent_crossbow": { n: "寂靜十字弓", type: "wpn", ranged: true, isBow: true, oneHand: true, dmgS: 3, dmgL: 2, hit: 1, dmgBonus: 1, spd: 1.0, req: "elf,illusion", safe: 6, p: 15000, gachaWeight: 30, rapidfire: 50, d: "無聲扣動的十字弓，連發如疾雨。<br>連射 50%。（單手弓，可與盾牌／臂甲並用，需裝備箭矢）" },
        // ===== 🏴‍☠️ 海賊島 防具 =====
        "arm_faith_shield": { n: "信念之盾", type: "arm", slot: "shield", ac: 3, dr: 2, cha: 2, block: 60, req: "royal", safe: 6, p: 15000, gachaWeight: 1, d: "承載著堅定信念的盾牌，守護持有者的意志。<br>格檔 60%、傷害減免 +2、魅力 +2。" },
        "arm_bluepirate_boots": { n: "藍海賊長靴", type: "arm", slot: "boots", ac: 2, req: "all", safe: 4, p: 6000, gachaWeight: 40, set: "bluepirate", d: "藍海賊團的航海長靴。<br><span class='text-amber-300'>【藍海賊套裝】頭巾＋皮盔甲＋手套＋長靴 四件齊：AC-1、HP+10、智力+1。</span>" },
        "arm_bluepirate_helm": { n: "藍海賊頭巾", type: "arm", slot: "helm", ac: 2, req: "all", safe: 4, p: 6000, gachaWeight: 40, set: "bluepirate", d: "藍海賊團的標誌頭巾。<br><span class='text-amber-300'>【藍海賊套裝】頭巾＋皮盔甲＋手套＋長靴 四件齊：AC-1、HP+10、智力+1。</span>" },
        "arm_bluepirate_armor": { n: "藍海賊皮盔甲", type: "arm", slot: "armor", ac: 5, req: "all", safe: 4, p: 8000, gachaWeight: 40, set: "bluepirate", d: "藍海賊團的皮製盔甲。<br><span class='text-amber-300'>【藍海賊套裝】頭巾＋皮盔甲＋手套＋長靴 四件齊：AC-1、HP+10、智力+1。</span>" },
        "arm_bluepirate_gloves": { n: "藍海賊手套", type: "arm", slot: "gloves", ac: 1, req: "all", safe: 4, p: 7000, gachaWeight: 40, set: "bluepirate", d: "藍海賊團的皮手套。<br><span class='text-amber-300'>【藍海賊套裝】頭巾＋皮盔甲＋手套＋長靴 四件齊：AC-1、HP+10、智力+1。</span>" },
        "arm_bluepirate_cloak": { n: "藍海賊斗篷", type: "arm", slot: "cloak", ac: 2, cha: 1, req: "all", safe: 4, p: 9000, gachaWeight: 20, d: "藍海賊團的航海斗篷，隨海風飄揚。<br>魅力 +1。" },
        // ===== 🏴‍☠️ 海賊島 詛咒耳環（裝備欄＝項鍊）＋ 淨化之耳環（裝備欄＝耳環）=====
        "acc_curse_red": { n: "詛咒的紅色耳環", type: "acc", slot: "amulet", ac: 0, req: "all", safe: 0, p: 10000, gachaWeight: 50, d: "纏附紅色詛咒的耳環，雖名為耳環，實際裝於項鍊欄。<br><span class='text-amber-300'>與 淨化之耳環 同時裝備：力量 +2、體質 -2。</span>" },
        "acc_curse_blue": { n: "詛咒的藍色耳環", type: "acc", slot: "amulet", ac: 0, req: "all", safe: 0, p: 10000, gachaWeight: 50, d: "纏附藍色詛咒的耳環，雖名為耳環，實際裝於項鍊欄。<br><span class='text-amber-300'>與 淨化之耳環 同時裝備：智力 +2、精神 -2。</span>" },
        "acc_curse_green": { n: "詛咒的綠色耳環", type: "acc", slot: "amulet", ac: 0, req: "all", safe: 0, p: 10000, gachaWeight: 50, d: "纏附綠色詛咒的耳環，雖名為耳環，實際裝於項鍊欄。<br><span class='text-amber-300'>與 淨化之耳環 同時裝備：敏捷 +2、魅力 -2。</span>" },
        "acc_purify_earring": { n: "淨化之耳環", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 10000, gachaWeight: 30, d: "蘊含淨化之力的耳環，可與任一色詛咒耳環共鳴。<br><span class='text-amber-300'>與 詛咒的紅／藍／綠色耳環 同時裝備可獲得對應加成。</span>（裝於耳環欄）" },
        // ===== ❄️ 冰之女王的耳環 Lv0~Lv8（裝備欄＝耳環）=====
        "acc_icequeen_ear_0": { n: "冰之女王的耳環 Lv0", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 100000, gachaWeight: 1, d: "冰之女王所佩戴耳環的雛形，蘊藏成長的可能。可在歐瑞村 大衛 處以 冰之結晶 逐級精煉。（裝於耳環欄）" },
        "acc_icequeen_ear_1": { n: "冰之女王的耳環 Lv1", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 100000, gachaWeight: 0, noEnhance: true, mhp: 10, d: "經一次精煉的冰之女王耳環。<br>HP +10。（裝於耳環欄）" },
        "acc_icequeen_ear_2": { n: "冰之女王的耳環 Lv2", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 100000, gachaWeight: 0, noEnhance: true, mhp: 10, mmp: 5, d: "經二次精煉的冰之女王耳環。<br>HP +10、MP +5。（裝於耳環欄）" },
        "acc_icequeen_ear_3": { n: "冰之女王的耳環 Lv3", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 100000, gachaWeight: 0, noEnhance: true, mhp: 15, mmp: 5, d: "經三次精煉的冰之女王耳環。<br>HP +15、MP +5。（裝於耳環欄）" },
        "acc_icequeen_ear_4": { n: "冰之女王的耳環 Lv4", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 100000, gachaWeight: 0, noEnhance: true, mhp: 15, mmp: 5, hpR: 1, d: "經四次精煉的冰之女王耳環。<br>HP +15、MP +5、HP自然恢復 +1。（裝於耳環欄）" },
        "acc_icequeen_ear_5": { n: "冰之女王的耳環 Lv5", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 100000, gachaWeight: 0, noEnhance: true, mhp: 15, mmp: 10, hpR: 1, d: "經五次精煉的冰之女王耳環。<br>HP +15、MP +10、HP自然恢復 +1。（裝於耳環欄）" },
        "acc_icequeen_ear_6": { n: "冰之女王的耳環 Lv6", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 100000, gachaWeight: 0, noEnhance: true, mhp: 15, mmp: 10, hpR: 1, mpR: 1, d: "經六次精煉的冰之女王耳環。<br>HP +15、MP +10、HP自然恢復 +1、MP自然恢復 +1。（裝於耳環欄）" },
        "acc_icequeen_ear_7": { n: "冰之女王的耳環 Lv7", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 100000, gachaWeight: 0, noEnhance: true, mhp: 20, mmp: 10, hpR: 2, mpR: 1, d: "經七次精煉的冰之女王耳環。<br>HP +20、MP +10、HP自然恢復 +2、MP自然恢復 +1。（裝於耳環欄）" },
        "acc_icequeen_ear_8_str": { n: "冰之女王的耳環 Lv8 力量", type: "acc", slot: "ear", legend: true, ac: 0, req: "all", safe: 0, p: 100000, gachaWeight: 0, mhp: 20, mmp: 10, hpR: 2, mpR: 1, str: 1, d: "冰之女王耳環的至高型態（力量）。<br>HP +20、MP +10、HP自然恢復 +2、MP自然恢復 +1、力量 +1。（裝於耳環欄）" },
        "acc_icequeen_ear_8_dex": { n: "冰之女王的耳環 Lv8 敏捷", type: "acc", slot: "ear", legend: true, ac: 0, req: "all", safe: 0, p: 100000, gachaWeight: 0, mhp: 20, mmp: 10, hpR: 2, mpR: 1, dex: 1, d: "冰之女王耳環的至高型態（敏捷）。<br>HP +20、MP +10、HP自然恢復 +2、MP自然恢復 +1、敏捷 +1。（裝於耳環欄）" },
        "acc_icequeen_ear_8_int": { n: "冰之女王的耳環 Lv8 智力", type: "acc", slot: "ear", legend: true, ac: 0, req: "all", safe: 0, p: 100000, gachaWeight: 0, mhp: 20, mmp: 10, hpR: 2, mpR: 1, int: 1, d: "冰之女王耳環的至高型態（智力）。<br>HP +20、MP +10、HP自然恢復 +2、MP自然恢復 +1、智力 +1。（裝於耳環欄）" },
        "acc_icequeen_ear_8_con": { n: "冰之女王的耳環 Lv8 體質", type: "acc", slot: "ear", legend: true, ac: 0, req: "all", safe: 0, p: 100000, gachaWeight: 0, mhp: 20, mmp: 10, hpR: 2, mpR: 1, con: 1, d: "冰之女王耳環的至高型態（體質）。<br>HP +20、MP +10、HP自然恢復 +2、MP自然恢復 +1、體質 +1。（裝於耳環欄）" },
        "acc_icequeen_ear_8_wis": { n: "冰之女王的耳環 Lv8 精神", type: "acc", slot: "ear", legend: true, ac: 0, req: "all", safe: 0, p: 100000, gachaWeight: 0, mhp: 20, mmp: 10, hpR: 2, mpR: 1, wis: 1, d: "冰之女王耳環的至高型態（精神）。<br>HP +20、MP +10、HP自然恢復 +2、MP自然恢復 +1、精神 +1。（裝於耳環欄）" },
        "acc_icequeen_ear_8_cha": { n: "冰之女王的耳環 Lv8 魅力", type: "acc", slot: "ear", legend: true, ac: 0, req: "all", safe: 0, p: 100000, gachaWeight: 0, mhp: 20, mmp: 10, hpR: 2, mpR: 1, cha: 1, d: "冰之女王耳環的至高型態（魅力）。<br>HP +20、MP +10、HP自然恢復 +2、MP自然恢復 +1、魅力 +1。（裝於耳環欄）" },
        // ===== 🏴‍☠️ 海賊島 受詛咒戒指 =====
        "acc_curse_diamond_ring": { n: "受詛咒的鑽石戒指", type: "acc", slot: "ring", ac: 0, mr: 10, con: -1, wis: -1, req: "all", safe: 0, p: 10000, gachaWeight: 70, d: "受詛咒的鑽石戒指，魔力護身卻折損心神。<br>MR +10、體質 -1、精神 -1。" },
        "acc_curse_ruby_ring": { n: "受詛咒的紅寶石戒指", type: "acc", slot: "ring", ac: -2, hpR: 1, mpR: 1, req: "all", safe: 0, p: 10000, gachaWeight: 80, d: "受詛咒的紅寶石戒指，加速恢復卻削弱防護。<br>AC +2、HP自然恢復 +1、MP自然恢復 +1。" },
        "acc_curse_sapphire_ring": { n: "受詛咒的藍寶石戒指", type: "acc", slot: "ring", ac: 0, immStone: true, resFire: -10, resWater: -10, resEarth: -10, resWind: -10, req: "all", safe: 0, p: 10000, gachaWeight: 50, d: "受詛咒的藍寶石戒指，免於石化卻喪失屬性抗性。<br>免疫石化；全屬性抗性 -10。" },
        "acc_curse_emerald_ring": { n: "受詛咒的綠寶石戒指", type: "acc", slot: "ring", ac: 0, mhp: 25, mr: -10, req: "all", safe: 0, p: 10000, gachaWeight: 90, d: "受詛咒的綠寶石戒指，增益體魄卻削弱魔防。<br>HP +25、MR -10。" },
        // ===== 💍 賽巴斯（奇岩）寶石加工坊製作：4 屬性戒指 + 4 精靈皮帶 =====
        "acc_ring_magic": { n: "魔力戒指", type: "acc", slot: "ring", ac: 0, mpR: 1, req: "all", safe: 0, p: 10000, gachaWeight: 0, d: "蘊含魔力的戒指。<br>MP自然恢復量+1。" },
        "acc_ring_str":   { n: "力量戒指", type: "acc", slot: "ring", ac: 0, str: 1, req: "all", safe: 0, p: 10000, gachaWeight: 0, d: "灌注力量的戒指。<br>力量+1。" },
        "acc_ring_dex":   { n: "敏捷戒指", type: "acc", slot: "ring", ac: 0, dex: 1, req: "all", safe: 0, p: 10000, gachaWeight: 0, d: "輕盈靈動的戒指。<br>敏捷+1。" },
        "acc_ring_int":   { n: "知識戒指", type: "acc", slot: "ring", ac: 0, int: 1, req: "all", safe: 0, p: 10000, gachaWeight: 0, d: "蘊藏知識的戒指。<br>智力+1。" },
        "acc_belt_fire":  { n: "火精靈的皮帶", type: "acc", slot: "belt", ac: 0, resFire: 10,  weightCap: 165, req: "all", safe: 0, p: 10000, gachaWeight: 0, d: "火精靈祝福的皮帶。<br>火屬性抗性+10、負重+165。" },
        "acc_belt_water": { n: "水精靈的皮帶", type: "acc", slot: "belt", ac: 0, resWater: 10, weightCap: 165, req: "all", safe: 0, p: 10000, gachaWeight: 0, d: "水精靈祝福的皮帶。<br>水屬性抗性+10、負重+165。" },
        "acc_belt_earth": { n: "地精靈的皮帶", type: "acc", slot: "belt", ac: 0, resEarth: 10, weightCap: 165, req: "all", safe: 0, p: 10000, gachaWeight: 0, d: "地精靈祝福的皮帶。<br>地屬性抗性+10、負重+165。" },
        "acc_belt_wind":  { n: "風精靈的皮帶", type: "acc", slot: "belt", ac: 0, resWind: 10,  weightCap: 165, req: "all", safe: 0, p: 10000, gachaWeight: 0, d: "風精靈祝福的皮帶。<br>風屬性抗性+10、負重+165。" },
        // ===== 🏴‍☠️ 海賊島 材料 / 任務道具 =====
        "mat_ice_crystal": { n: "冰之結晶", type: "etc", p: 1, c: "text-cyan-200", noUse: true, gachaWeight: 0, d: "冰之女王凝聚而成的寒冰結晶。可在歐瑞村 大衛 處精煉 冰之女王的耳環。（製作材料）" },
        "item_son_letter": { n: "兒子的信", type: "etc", p: 10, c: "text-amber-200", noUse: true, gachaWeight: 0, d: "一封未能送達的家書，字跡因海水暈染。可交給海賊島村莊的 希米哲。（任務兌換道具）" },
        "item_son_remains": { n: "兒子的遺骸", type: "etc", p: 10, c: "text-amber-200", noUse: true, gachaWeight: 0, d: "葬身海賊島的某人遺骸。可交給海賊島村莊的 希米哲。（任務兌換道具）" },
        "item_son_portrait": { n: "兒子的肖像畫", type: "etc", p: 10, c: "text-amber-200", noUse: true, gachaWeight: 0, d: "一幅褪色的肖像畫，描繪著年輕的面容。可交給海賊島村莊的 希米哲。（任務兌換道具）" },
        // ===== 💎 大衛 寶石加工 耳環（藍系智慧/真實/支配·綠系憤怒/勇猛/不死·紅系熱情/名譽/寬容；中間階無法強化、最終階可強化）=====
        "acc_ear_wisdom":    { n: "智慧耳環", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 0, gachaWeight: 0, noEnhance: true, mmp: 10, d: "凝聚智慧的耳環。<br>MP +10。（裝於耳環欄）" },
        "acc_ear_truth":     { n: "真實耳環", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 0, gachaWeight: 0, noEnhance: true, mmp: 20, mpR: 1, d: "映照真實的耳環。<br>MP +20、MP自然恢復 +1。（裝於耳環欄）" },
        "acc_ear_dominate":  { n: "支配耳環", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 0, gachaWeight: 0, mmp: 30, mpR: 2, d: "蘊含支配之力的耳環。<br>MP +30、MP自然恢復 +2。（裝於耳環欄）" },
        "acc_ear_rage":      { n: "憤怒耳環", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 0, gachaWeight: 0, noEnhance: true, mhp: 10, mmp: 5, d: "燃燒憤怒的耳環。<br>HP +10、MP +5。（裝於耳環欄）" },
        "acc_ear_brave":     { n: "勇猛耳環", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 0, gachaWeight: 0, noEnhance: true, mhp: 20, mmp: 5, d: "象徵勇猛的耳環。<br>HP +20、MP +5。（裝於耳環欄）" },
        "acc_ear_undead":    { n: "不死耳環", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 0, gachaWeight: 0, mhp: 20, mmp: 10, d: "蘊含不死之力的耳環。<br>HP +20、MP +10。（裝於耳環欄）" },
        "acc_ear_passion":   { n: "熱情耳環", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 0, gachaWeight: 0, noEnhance: true, mhp: 20, d: "燃起熱情的耳環。<br>HP +20。（裝於耳環欄）" },
        "acc_ear_honor":     { n: "名譽耳環", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 0, gachaWeight: 0, noEnhance: true, mhp: 30, d: "承載名譽的耳環。<br>HP +30。（裝於耳環欄）" },
        "acc_ear_tolerance": { n: "寬容耳環", type: "acc", slot: "ear", ac: 0, req: "all", safe: 0, p: 0, gachaWeight: 0, mhp: 40, hpR: 3, d: "充滿寬容的耳環。<br>HP +40、HP自然恢復 +3。（裝於耳環欄）" },
        // ===== 🔥 炎魔的輔佐官 靈魂石碎片 耳環（舞動→…→奴隸；前7階無法強化、奴隸可強化）=====
        "acc_ear_dance":    { n: "舞動耳環", type: "acc", slot: "ear", ac: 1, req: "all", safe: 0, p: 0, gachaWeight: 0, noEnhance: true, d: "隨炎舞動的耳環。<br>AC -1。（裝於耳環欄）" },
        "acc_ear_twin":     { n: "雙子耳環", type: "acc", slot: "ear", ac: 2, req: "all", safe: 0, p: 0, gachaWeight: 0, noEnhance: true, d: "成對相映的雙子耳環。<br>AC -2。（裝於耳環欄）" },
        "acc_ear_festival": { n: "慶典耳環", type: "acc", slot: "ear", ac: 3, req: "all", safe: 0, p: 0, gachaWeight: 0, noEnhance: true, d: "炎獄慶典的耳環。<br>AC -3。（裝於耳環欄）" },
        "acc_ear_peak":     { n: "絕頂耳環", type: "acc", slot: "ear", ac: 3, req: "all", safe: 0, p: 0, gachaWeight: 0, noEnhance: true, mhp: 25, mmp: 10, d: "登峰絕頂的耳環。<br>AC -3、HP +25、MP +10。（裝於耳環欄）" },
        "acc_ear_rampage":  { n: "暴走耳環", type: "acc", slot: "ear", ac: 3, req: "all", safe: 0, p: 0, gachaWeight: 0, noEnhance: true, mhp: 50, mmp: 20, d: "失控暴走的耳環。<br>AC -3、HP +50、MP +20。（裝於耳環欄）" },
        "acc_ear_phantom":  { n: "幻魔耳環", type: "acc", slot: "ear", ac: 3, req: "all", safe: 0, p: 0, gachaWeight: 0, noEnhance: true, mhp: 50, mmp: 20, weightCap: 40, d: "幻魔之力的耳環。<br>AC -3、HP +50、MP +20、負重上限 +40。（裝於耳環欄）" },
        "acc_ear_clan":     { n: "族群耳環", type: "acc", slot: "ear", ac: 3, req: "all", safe: 0, p: 0, gachaWeight: 0, noEnhance: true, mhp: 50, mmp: 20, weightCap: 100, d: "凝聚族群的耳環。<br>AC -3、HP +50、MP +20、負重上限 +100。（裝於耳環欄）" },
        "acc_ear_slave":    { n: "奴隸耳環", type: "acc", slot: "ear", legend: true, ac: 3, req: "all", safe: 0, p: 0, gachaWeight: 0, mhp: 50, mmp: 20, weightCap: 200, d: "禁忌的奴隸耳環。<br>AC -3、HP +50、MP +20、負重上限 +200。（裝於耳環欄）" },
    },
    sets: {
        "set_0": { n: "皮套裝", items: ["arm_48", "arm_91", "arm_111", "arm_75"], ac: 3 },
        "set_1": { n: "歐西斯套裝", items: ["hlm_oasis", "amr_oasis", "clk_oasis", "arm_104"], ac: 3 },
        "set_2": { n: "侏儒套裝", items: ["hlm_gnome", "arm_86", "shd_gnome"], ac: 1, hp: 5 },
        "set_3": { n: "銀釘套裝", items: ["hlm_silver", "arm_92", "arm_112", "arm_77"], ac: 3 },
        "set_4": { n: "骷髏套裝", items: ["hlm_bone", "shd_bone", "amr_bone"], ac: 2, hp: 10 },
        "set_5": { n: "鋼鐵套裝", items: ["arm_100", "hlm_steel", "arm_113", "arm_94", "arm_79"], ac: 3 },
        "set_6": { n: "法師套裝", items: ["hlm_mage", "amr_magerobe"], mp: 50 },
        "set_7": { n: "死亡騎士套裝", items: ["glv_dk", "amr_dk", "bot_dk", "hlm_dk"], ac: 4 },
        "set_8": { n: "克特套裝", items: ["arm_101", "amr_kurt", "arm_97", "hlm_kurt"], ac: 4 },
        "set_9": { n: "抗魔套裝", items: ["rng_mr", "acc_126", "blt_mr"], mr: 5 },
        "set_10": { n: "守護套裝", items: ["acc_118", "acc_124", "acc_138"], ac: 1 },
        "set_11": { n: "四大軍王套裝", items: ["clk_kingnecro", "amr_kinglaw", "glv_kingassassin", "bot_kingbeast"], hp: 30, mp: 30 },
        "set_12": { n: "惡魔套裝", items: ["hlm_demon", "amr_demon", "glv_demon", "bot_demon"], ac: 2 },
        "set_13": { n: "黑暗妖精套裝", items: ["hlm_darkelf", "amr_darkelf", "bot_darkelf"], ac: 3 }
    },
            
    mobs: {
        "orc": { n: "妖魔", lv: 2, s: "S", beh: "被動", race: "妖魔", e: "fire", hp: 6, ac: 10, mr: 0, exp: 5, goldMin: 10, goldMax: 30, atkSpd: 2, dmg: [1, 2], db: 0, hit: 0 },
        "goblin": { n: "哥布林", lv: 2, s: "S", beh: "被動", race: "哥布林", e: "earth", hp: 3, ac: 10, mr: 2, exp: 5, goldMin: 10, goldMax: 30, atkSpd: 2, dmg: [1, 2], db: 0, hit: 0 },
        "esti_enemy": { n: "依詩蒂", img: "assets/icons/monsters/依詩蒂.png", lv: 1, s: "S", beh: "主動", race: "血盟", wild: true, e: "none", pledgeEnemy: true, excludeAvatar: "女騎士", seeInsight: true, hp: 20, ac: -10, mr: 0, exp: 100, goldMin: 1136, goldMax: 1136, atkSpd: 0.67, dmg: [1, 10], db: 0, hit: 2, regenHp: 15, scale: { hpC: 20, acBase: -10, acDiv: 3, mrBase: 0, mrDiv: 5, dmgSides: 10, dbDiv: 2, hitBase: 2, hitDiv: 3, atkSpd: 0.67 }, mag: { skn: "衝擊之暈", cd: 50, chance: 0.2, type: "extra_attack", stunChance: 10 } },
        "aton_enemy": { n: "阿頓", img: "assets/icons/monsters/阿頓.png", lv: 1, s: "S", beh: "主動", race: "血盟", wild: true, e: "none", pledgeEnemy: true, excludeAvatar: "男騎士", seeInsight: true, hp: 18, ac: -10, mr: 0, exp: 100, goldMin: 1136, goldMax: 1136, atkSpd: 0.6, dmg: [1, 14], db: 0, hit: 0, regenHp: 15, scale: { hpC: 18, acBase: -10, acDiv: 3, mrBase: 0, mrDiv: 5, dmgSides: 14, dbDiv: 2, hitBase: 0, hitDiv: 3, atkSpd: 0.6 }, mag: { skn: "衝擊之暈", cd: 50, chance: 0.2, type: "extra_attack", stunChance: 10 } },
        "julian_enemy": { n: "朱利安", img: "assets/icons/monsters/朱利安.png", lv: 1, s: "S", beh: "主動", race: "血盟", wild: true, e: "none", pledgeEnemy: true, excludeAvatar: "男妖精", hp: 12, ac: -15, mr: 25, exp: 100, goldMin: 1136, goldMax: 1136, atkSpd: 0.67, dmg: [1, 9], db: 0, hit: 5, regenHp: 15, scale: { hpC: 12, acBase: -15, acDiv: 4, mrBase: 25, mrDiv: 2, dmgSides: 9, dbDiv: 3, hitBase: 5, hitDiv: 3, atkSpd: 0.67 }, mag: { skn: "三重矢", cd: 50, chance: 0.2, type: "multi_attack", times: 3 } },
        "ovi_enemy": { n: "歐薇", img: "assets/icons/monsters/歐薇.png", lv: 1, s: "S", beh: "主動", race: "血盟", wild: true, e: "none", pledgeEnemy: true, excludeAvatar: "女妖精", hp: 10, ac: -18, mr: 25, exp: 100, goldMin: 1136, goldMax: 1136, atkSpd: 0.67, dmg: [1, 8], db: 0, hit: 5, regenHp: 15, scale: { hpC: 10, acBase: -10, acDiv: 5, mrBase: 25, mrDiv: 2, dmgSides: 8, dbDiv: 4, hitBase: 5, hitDiv: 3, atkSpd: 0.67 }, mag: { skn: "生命的祝福", cd: 50, chance: 0.2, type: "pledge_bless", healDice: [1, 20], dur: 18, interval: 3 } },
        "joe_enemy": { n: "喬", img: "assets/icons/monsters/喬.png", lv: 1, s: "S", beh: "主動", race: "血盟", wild: true, e: "none", pledgeEnemy: true, excludeAvatar: "男法師", hp: 10, ac: -10, mr: 15, exp: 100, goldMin: 1136, goldMax: 1136, atkSpd: 0.67, dmg: [1, 4], db: 0, hit: 5, regenHp: 15, scale: { hpC: 10, acBase: -10, acDiv: 6, mrBase: 15, mrDiv: 3, dmgSides: 4, dbDiv: 6, hitBase: 5, hitDiv: 5, atkSpd: 0.67, dbHalf: true }, mag: { skn: "光箭", cd: 20, dmg: [2, 6], dbLv: 1, ele: "none", alwaysHit: true }, mag2: { skn: "地裂術", cd: 50, chance: 0.2, dmg: [8, 8], dbLv: 1, dbLvMult: 2, ele: "earth", alwaysHit: true } },
        "senis_enemy": { n: "賽尼斯", img: "assets/icons/monsters/賽尼斯.png", lv: 1, s: "S", beh: "主動", race: "血盟", wild: true, e: "none", pledgeEnemy: true, excludeAvatar: "女法師", hp: 8, ac: -11, mr: 18, exp: 100, goldMin: 1136, goldMax: 1136, atkSpd: 0.67, dmg: [1, 4], db: 0, hit: 0, regenHp: 15, scale: { hpC: 8, acBase: -11, acDiv: 6, mrBase: 18, mrDiv: 3, dmgSides: 4, dbDiv: 6, hitBase: 0, hitDiv: 5, atkSpd: 0.67, dbHalf: true }, mag: { skn: "冰箭", cd: 20, dmg: [2, 6], dbLv: 1, ele: "water", alwaysHit: true }, mag2: { skn: "冰矛圍籬", cd: 50, chance: 0.2, dmg: [5, 12], dbLv: 1, dbLvMult: 2, ele: "water", alwaysHit: true, sec: { type: "freeze", pbase: 150 } } },
        // ===== 攻城戰（攻城）怪物：等級隨玩家(由 applySiegeEnemyScaling 縮放)，由攻城系統生成 =====
        // 攻城塔/城門：固定HP、不會攻擊；HP 跨地圖保留(siegePersistHp)需攻城系統支援
        "siege_tower": { hard: true, n: "肯特守護塔", img: "assets/icons/monsters/肯特守護塔.png", lv: 1, s: "L", beh: "被動", race: "建築", siegeEnemy: true, siegePersistHp: true, noAttack: true, e: "none", boss: true, hp: 15000, ac: 10, mr: 0, dr: 10, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [0, 0], db: 0, hit: 0, siege: { fixed: true, hpPerLv: 500, ac: 10, mr: 0, dr: 10 } },   // 🔧 HP=500×玩家等級；新增被動：傷害減免10
        "siege_gate": { hard: true, n: "肯特城門", img: "assets/icons/monsters/肯特城門.png", lv: 1, s: "L", beh: "被動", race: "建築", siegeEnemy: true, siegePersistHp: true, noAttack: true, e: "none", boss: true, hp: 10000, ac: 10, mr: 0, dr: 20, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [0, 0], db: 0, hit: 0, siege: { fixed: true, hpPerLv: 300, ac: 10, mr: 0, dr: 20 } },   // 🔧 HP=300×玩家等級
        "siege_tower_heine": { hard: true, n: "海音守護塔", img: "assets/icons/monsters/海音守護塔.png", lv: 1, s: "L", beh: "被動", race: "建築", siegeEnemy: true, siegePersistHp: true, noAttack: true, e: "none", boss: true, hp: 15000, ac: 10, mr: 0, dr: 10, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [0, 0], db: 0, hit: 0, siege: { fixed: true, hpPerLv: 500, ac: 10, mr: 0, dr: 10 } },   // 🔧 海音守護塔：能力同肯特守護塔
        "siege_gate_heine": { hard: true, n: "海音城門", img: "assets/icons/monsters/海音城門.png", lv: 1, s: "L", beh: "被動", race: "建築", siegeEnemy: true, siegePersistHp: true, noAttack: true, e: "none", boss: true, hp: 10000, ac: 10, mr: 0, dr: 20, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [0, 0], db: 0, hit: 0, siege: { fixed: true, hpPerLv: 300, ac: 10, mr: 0, dr: 20 } },   // 🔧 海音城門：能力同肯特城門
        "siege_tower_ww": { hard: true, n: "風木守護塔", img: "assets/icons/monsters/風木守護塔.png", lv: 1, s: "L", beh: "被動", race: "建築", siegeEnemy: true, siegePersistHp: true, noAttack: true, e: "none", boss: true, hp: 15000, ac: 10, mr: 0, dr: 10, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [0, 0], db: 0, hit: 0, siege: { fixed: true, hpPerLv: 500, ac: 10, mr: 0, dr: 10 } },   // 🔧 風木守護塔：HP=500×玩家等級、傷害減免10
        "siege_gate_ww": { hard: true, n: "風木城門", img: "assets/icons/monsters/風木城門.png", lv: 1, s: "L", beh: "被動", race: "建築", siegeEnemy: true, siegePersistHp: true, noAttack: true, e: "none", boss: true, hp: 10000, ac: 10, mr: 0, dr: 20, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [0, 0], db: 0, hit: 0, siege: { fixed: true, hpPerLv: 300, ac: 10, mr: 0, dr: 20 } },   // 🔧 風木城門：HP=300×玩家等級、傷害減免20
        "baless": { hard: true, n: "巴列斯", lv: 53, s: "S", beh: "主動", race: "惡魔", e: "earth", boss: true, hp: 15000, ac: -66, mr: 80, exp: 2802, goldMin: 3852, goldMax: 15514, atkSpd: 1.5, dmg: [1, 100], db: 166, hit: 65,
            mag:  { skn: "燃燒的火球", cd: 50, chance: 0.5, dmg: [4, 100], db: 202, ele: "fire" },
            mag2: { skn: "地獄犬噴吐", cd: 70, dmg: [3, 100], db: 130, ele: "fire" } },   // 🔧 巴列斯 BOSS（風木地監）
        // 特羅斯王子 / 依詩蒂公主：技能「呼喚盟友」(場上敵人<3 立即追加一次普攻，10%暈眩) — 已實作(call_ally)
        "siege_tros": { n: "特羅斯王子", img: "assets/icons/monsters/特羅斯王子.png", lv: 1, s: "S", beh: "主動", race: "血盟", siegeEnemy: true, e: "none", hp: 14, ac: -10, mr: 0, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 0.67, dmg: [1, 16], db: 0, hit: 2, siege: { hpC: 14, acBase: -10, acDiv: 4, mrBase: 0, mrDiv: 5, dmgSides: 16, hitBase: 2, atkSpd: 0.67 }, mag: { skn: "呼喚盟友", type: "call_ally", cd: 10, stunChance: 10 } },
        "siege_esti": { n: "依詩蒂公主", img: "assets/icons/monsters/依詩蒂公主.png", lv: 1, s: "S", beh: "主動", race: "血盟", siegeEnemy: true, e: "none", hp: 15, ac: -10, mr: 0, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 0.67, dmg: [1, 12], db: 0, hit: 2, siege: { hpC: 15, acBase: -10, acDiv: 4, mrBase: 0, mrDiv: 5, dmgSides: 12, hitBase: 2, atkSpd: 0.67 }, mag: { skn: "呼喚盟友", type: "call_ally", cd: 10, stunChance: 10 } },
        // 鋼鐵阿頓：衝擊之暈、堅固防護(self_buff/guard)、看破被動(siegeInsight) — 已實作
        "siege_aton": { n: "鋼鐵阿頓", img: "assets/icons/monsters/鋼鐵阿頓.png", lv: 1, s: "S", beh: "主動", race: "血盟", siegeEnemy: true, siegeInsight: true, e: "none", hp: 18, ac: -15, mr: 0, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 0.35, dmg: [1, 28], db: 0, hit: 0, siege: { hpC: 18, acBase: -15, acDiv: 3, mrBase: 0, mrDiv: 5, dmgSides: 28, hitBase: 0, atkSpd: 0.35 }, mag: { skn: "衝擊之暈", cd: 50, chance: 0.2, type: "extra_attack", stunChance: 10 }, mag2: { skn: "堅固防護", type: "self_buff", buffKind: "guard", cd: 180 } },
        "siege_julian": { n: "月光朱利安", img: "assets/icons/monsters/月光朱利安.png", lv: 1, s: "S", beh: "主動", race: "血盟", siegeEnemy: true, e: "none", hp: 12, ac: -15, mr: 25, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 0.56, dmg: [1, 18], db: 0, hit: 5, siege: { hpC: 12, acBase: -15, acDiv: 4, mrBase: 25, mrDiv: 2, dmgSides: 18, hitBase: 5, atkSpd: 0.56 }, mag: { skn: "三重矢", cd: 50, chance: 0.2, type: "multi_attack", times: 3 }, mag2: { skn: "暴風神射", type: "self_buff", buffKind: "volley", cd: 150 } },
        "siege_ovi": { n: "月之精靈歐薇", img: "assets/icons/monsters/月之精靈歐薇.png", lv: 1, s: "S", beh: "主動", race: "血盟", siegeEnemy: true, e: "none", hp: 10, ac: -10, mr: 25, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 0.67, dmg: [1, 8], db: 0, hit: 5, siege: { hpC: 10, acBase: -10, acDiv: 5, mrBase: 25, mrDiv: 2, dmgSides: 8, hitBase: 5, atkSpd: 0.67 }, mag: { skn: "三重矢", cd: 50, chance: 0.1, type: "multi_attack", times: 3 }, mag2: { skn: "生命的祝福", cd: 50, chance: 0.2, type: "pledge_bless", healDice: [1, 20], dur: 18, interval: 3 } },
        "siege_joe": { n: "魔法師喬", img: "assets/icons/monsters/魔法師喬.png", lv: 1, s: "S", beh: "主動", race: "血盟", siegeEnemy: true, e: "none", hp: 10, ac: -10, mr: 15, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 0.67, dmg: [1, 4], db: 0, hit: 5, siege: { hpC: 10, acBase: -10, acDiv: 6, mrBase: 15, mrDiv: 3, dmgSides: 4, dbHalf: true, hitBase: 5, atkSpd: 0.67 }, mag: { skn: "光箭", cd: 20, dmg: [2, 6], dbLv: 1, ele: "none", alwaysHit: true }, mag2: { skn: "地裂術", cd: 50, chance: 0.2, dmg: [8, 8], dbLv: 1, dbLvMult: 2, ele: "earth", alwaysHit: true }, mag3: { skn: "震裂術", cd: 130, chance: 0.1, dmg: [4, 25], dbLv: 1, dbLvMult: 3, ele: "earth", alwaysHit: true } },
        "siege_senis": { n: "魔女賽尼斯", img: "assets/icons/monsters/魔女賽尼斯.png", lv: 1, s: "S", beh: "主動", race: "血盟", siegeEnemy: true, e: "none", hp: 8, ac: -11, mr: 18, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 0.67, dmg: [1, 4], db: 0, hit: 0, siege: { hpC: 8, acBase: -11, acDiv: 6, mrBase: 18, mrDiv: 3, dmgSides: 4, dbHalf: true, hitBase: 0, atkSpd: 0.67 }, mag: { skn: "冰箭", cd: 20, dmg: [2, 6], dbLv: 1, ele: "water", alwaysHit: true }, mag2: { skn: "冰矛圍籬", cd: 50, chance: 0.2, dmg: [5, 12], dbLv: 1, dbLvMult: 2, ele: "water", alwaysHit: true, sec: { type: "freeze", pbase: 150 } }, mag3: { skn: "冰雪暴", cd: 130, chance: 0.1, dmg: [8, 12], dbLv: 1, dbLvMult: 3, ele: "water", alwaysHit: true, sec: { type: "freeze", pbase: 200 } } },
        // 闇影格立特：ER+12、雙重破壞被動(doubleDestroy)、破壞盔甲(armor_break) — 已實作
        "siege_grit": { n: "闇影格立特", img: "assets/icons/monsters/闇影格立特.png", lv: 1, s: "S", beh: "主動", race: "血盟", siegeEnemy: true, doubleDestroy: true, e: "none", hp: 10, ac: -13, mr: 20, er: 12, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 0.5, dmg: [1, 50], db: 0, hit: 5, siege: { hpC: 10, acBase: -13, acDiv: 5, mrBase: 20, mrDiv: 2, dmgSides: 50, dbHalf: true, hitBase: 5, atkSpd: 0.5, er: 12 }, mag: { skn: "破壞盔甲", type: "armor_break", cd: 50, chance: 0.1 } },
        "orc_archer": { n: "妖魔弓箭手", lv: 3, s: "S", beh: "被動", race: "妖魔", e: "fire", hp: 12, ac: 10, mr: 2, exp: 10, goldMin: 11, goldMax: 32, atkSpd: 2, dmg: [1, 3], db: 0, hit: 0 },
        "gremlin": { n: "地靈", lv: 3, s: "S", beh: "被動", race: "地靈", e: "earth", hp: 7, ac: 10, mr: 2, exp: 10, goldMin: 11, goldMax: 32, atkSpd: 2, dmg: [1, 3], db: 0, hit: 0 },
        "nm_001": { n: "污染的地精靈", lv: 3, s: "S", beh: "被動", race: "元素", elem: true, e: "earth", hp: 10, ac: 10, mr: 10, exp: 10, goldMin: 11, goldMax: 32, atkSpd: 2, dmg: [1, 3], db: 0, hit: 0 },
        "nm_002": { n: "蘑菇", lv: 4, s: "S", beh: "被動", race: "蘑菇", e: "earth", hp: 20, ac: 5, mr: 0, exp: 17, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [1, 4], db: 0, hit: 0, mag: { skn: "中毒", cd: 100, type: "poison", pbase: 30, d: 10, tick: 5, dur: 20 } },
        "nm_003": { n: "狼", lv: 4, s: "S", beh: "被動", race: "動物", e: "wind", hp: 30, ac: 10, mr: 2, exp: 37, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [1, 4], db: 0, hit: 0 },
        "nm_004": { n: "哈士奇", lv: 5, s: "S", beh: "被動", race: "動物", e: "water", hp: 30, ac: 10, mr: 1, exp: 26, goldMin: 13, goldMax: 36, atkSpd: 2, dmg: [1, 5], db: 1, hit: 0 },
        "侏儒": { n: "侏儒", lv: 5, s: "S", beh: "被動", race: "侏儒", e: "earth", hp: 30, ac: 10, mr: 2, exp: 26, goldMin: 13, goldMax: 36, atkSpd: 2, dmg: [1, 5], db: 1, hit: 0 },
        "nm_005": { n: "熊", lv: 5, s: "S", beh: "被動", race: "動物", e: "earth", hp: 50, ac: 10, mr: 80, exp: 26, goldMin: 13, goldMax: 36, atkSpd: 3, dmg: [1, 5], db: 3, hit: 0 },
        "zombie": { n: "人形殭屍", lv: 6, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 45, ac: 8, mr: 5, exp: 37, goldMin: 10, goldMax: 120, atkSpd: 2, dmg: [1, 12], db: 0, hit: 0 },
        "doberman": { n: "杜賓狗", lv: 6, s: "S", beh: "被動", race: "動物", e: "fire", hp: 20, ac: 10, mr: 30, exp: 37, goldMin: 0, goldMax: 0, atkSpd: 1, dmg: [1, 6], db: 0, hit: 0 },
        "nm_006": { n: "安普長老", lv: 6, s: "S", beh: "被動", race: "安普", e: "wind", hp: 100, ac: 10, mr: 30, exp: 37, goldMin: 15, goldMax: 38, atkSpd: 2, dmg: [1, 6], db: 0, hit: 0, mag: { skn: "落石術", cd: 50, dmg: [1, 4], db: 0, ele: "earth" } },
        "nm_007": { n: "污染的安特", lv: 6, s: "S", beh: "被動", race: "安特", e: "none", hp: 50, ac: 6, mr: 0, exp: 37, goldMin: 15, goldMax: 38, atkSpd: 3, dmg: [1, 4], db: 4, hit: 0, mag: { skn: "中毒", cd: 100, type: "poison", pbase: 30, d: 10, tick: 5, dur: 20 } },
        "floating_eye": { n: "漂浮之眼", lv: 7, s: "S", beh: "被動", race: "眼魔", e: "none", hp: 40, ac: 5, mr: 200, exp: 50, goldMin: 0, goldMax: 0, atkSpd: 60, dmg: [0, 0], db: 0, hit: 0, mag: { skn: "木乃伊的詛咒", cd: 50, type: "stone", pbase: 100 } },
        "fighter": { n: "妖魔鬥士", lv: 8, s: "S", beh: "被動", race: "妖魔", e: "fire", hp: 50, ac: 5, mr: 5, exp: 65, goldMin: 20, goldMax: 45, atkSpd: 2, dmg: [1, 16], db: 0, hit: 1 },
        "ice_wolf": { n: "冰原狼人", lv: 8, s: "S", beh: "被動", race: "狼人", isWolf: true, e: "wind", hp: 60, ac: 4, mr: 1, exp: 65, goldMin: 20, goldMax: 45, atkSpd: 2, dmg: [2, 8], db: 0, hit: 1 },
        "nm_008": { n: "怪手", lv: 8, s: "S", beh: "主動", race: "魔法生物", e: "wind", hp: 30, ac: 0, mr: 5, exp: 65, goldMin: 20, goldMax: 45, atkSpd: 1, dmg: [1, 8], db: 3, hit: 3 },
        "wolf": { n: "狼人", lv: 9, s: "S", beh: "被動", race: "狼人", isWolf: true, e: "wind", hp: 50, ac: 4, mr: 10, exp: 82, goldMin: 22, goldMax: 50, atkSpd: 2, dmg: [1, 13], db: 5, hit: 1 },
        "gnome_warrior": { n: "侏儒戰士", lv: 9, s: "S", beh: "被動", race: "侏儒", e: "earth", hp: 70, ac: 5, mr: 1, exp: 82, goldMin: 22, goldMax: 50, atkSpd: 2, dmg: [1, 10], db: 8, hit: 0 },
        "skeleton": { n: "骷髏", lv: 10, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 80, ac: 3, mr: 10, exp: 101, goldMin: 25, goldMax: 54, atkSpd: 1.8, dmg: [1, 20], db: 0, hit: 2 },
        "orc_zombie": { n: "妖魔殭屍", lv: 10, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 100, ac: 0, mr: 1, exp: 101, goldMin: 25, goldMax: 54, atkSpd: 2, dmg: [1, 20], db: 2, hit: 0, mag: { skn: "中毒", cd: 100, type: "poison", pbase: 60, d: 10, tick: 5, dur: 20 } },
        "gandi_orc": { n: "甘地妖魔", lv: 10, s: "S", beh: "主動", race: "妖魔", e: "fire", hp: 80, ac: 0, mr: 15, exp: 101, goldMin: 25, goldMax: 54, atkSpd: 1, dmg: [1, 12], db: 0, hit: 1 },
        "nm_009": { n: "污染的潘", lv: 10, s: "S", beh: "主動", race: "潘", e: "fire", hp: 100, ac: 0, mr: 50, exp: 101, goldMin: 25, goldMax: 54, atkSpd: 2, dmg: [1, 16], db: 0, hit: 2 },
        "croc": { n: "鱷魚", lv: 10, s: "S", beh: "主動", race: "動物", e: "water", hp: 90, ac: 1, mr: 60, exp: 101, goldMin: 25, goldMax: 54, atkSpd: 2, dmg: [1, 9], db: 10, hit: 0 },
        "ant": { n: "巨蟻", lv: 12, s: "S", beh: "主動", race: "昆蟲", e: "earth", hp: 90, ac: -4, mr: 60, exp: 145, goldMin: 33, goldMax: 65, atkSpd: 2, dmg: [1, 20], db: 5, hit: 2 },
        "orc_mage": { n: "妖魔法師", lv: 12, s: "S", beh: "被動", race: "妖魔", e: "fire", hp: 80, ac: 0, mr: 30, exp: 145, goldMin: 33, goldMax: 65, atkSpd: 2, dmg: [1, 24], db: 0, hit: 0, mag: { skn: "燃燒的火球", cd: 50, dmg: [2, 10], db: 0, ele: "fire" } },
        "skel_archer": { n: "骷髏弓箭手", lv: 12, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 80, ac: 0, mr: 10, exp: 145, goldMin: 33, goldMax: 65, atkSpd: 1.5, dmg: [1, 16], db: 0, hit: 4 },
        "roach": { n: "蟑螂人", lv: 12, s: "S", beh: "主動", race: "昆蟲", e: "earth", hp: 100, ac: -1, mr: 0, exp: 145, goldMin: 33, goldMax: 65, atkSpd: 2, dmg: [1, 20], db: 4, hit: 0, mag: { skn: "中毒", cd: 100, type: "poison", pbase: 60, d: 10, tick: 5, dur: 20 } },
        "stone_golem": { hard: true, n: "石頭高崙", lv: 13, s: "L", beh: "被動", race: "高崙", e: "earth", hp: 150, ac: -1, mr: 5, exp: 170, goldMin: 37, goldMax: 72, atkSpd: 3, dmg: [1, 18], db: 14, hit: 0 },
        "rova_orc": { n: "羅孚妖魔", lv: 13, s: "S", beh: "主動", race: "妖魔", e: "fire", hp: 80, ac: -2, mr: 5, exp: 170, goldMin: 37, goldMax: 72, atkSpd: 2, dmg: [1, 18], db: 8, hit: 2 },
        "skel_axe": { n: "骷髏斧手", lv: 13, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 90, ac: 0, mr: 10, exp: 170, goldMin: 37, goldMax: 72, atkSpd: 1, dmg: [1, 13], db: 0, hit: 3 },
        "skel_spear": { n: "骷髏槍兵", lv: 13, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 90, ac: 8, mr: 10, exp: 170, goldMin: 37, goldMax: 72, atkSpd: 2, dmg: [2, 13], db: 7, hit: 4 },
        "spider": { n: "夏洛伯", lv: 14, s: "L", beh: "主動", race: "蜘蛛", e: "earth", hp: 100, ac: 0, mr: 12, exp: 197, goldMin: 41, goldMax: 78, atkSpd: 1, dmg: [1, 14], db: 2, hit: 4 },
        "orc_scout": { n: "妖魔巡守", lv: 14, s: "S", beh: "主動", race: "妖魔", e: "fire", hp: 90, ac: -3, mr: 5, exp: 197, goldMin: 41, goldMax: 78, atkSpd: 1.5, dmg: [1, 21], db: 2, hit: 4 },
        "hobgoblin": { n: "哈柏哥布林", lv: 14, s: "S", beh: "被動", race: "哥布林", e: "earth", hp: 90, ac: 1, mr: 1, exp: 197, goldMin: 41, goldMax: 78, atkSpd: 2, dmg: [1, 28], db: 0, hit: 3 },
        "atuba_orc": { n: "阿吐巴妖魔", lv: 15, s: "S", beh: "主動", race: "妖魔", e: "fire", hp: 120, ac: -5, mr: 10, exp: 226, goldMin: 45, goldMax: 86, atkSpd: 2, dmg: [1, 28], db: 2, hit: 4 },
        "duda_orc": { n: "都達瑪拉妖魔", lv: 15, s: "S", beh: "主動", race: "妖魔", e: "fire", hp: 100, ac: -5, mr: 20, exp: 226, goldMin: 45, goldMax: 86, atkSpd: 3, dmg: [1, 42], db: 3, hit: 6 },
        "bear": { n: "歐熊", lv: 15, s: "L", beh: "主動", race: "動物", e: "earth", hp: 250, ac: -6, mr: 10, exp: 226, goldMin: 45, goldMax: 86, atkSpd: 3, dmg: [1, 20], db: 20, hit: 2 },
        "lizardman": { n: "蜥蜴人", lv: 15, s: "S", beh: "主動", race: "蜥蜴人", e: "water", hp: 90, ac: -2, mr: 5, exp: 226, goldMin: 45, goldMax: 86, atkSpd: 2, dmg: [2, 15], db: 1, hit: 3 },
        "troglodyte": { n: "穴居人", lv: 15, s: "S", beh: "被動", race: "亞人", e: "water", hp: 60, ac: -4, mr: 10, exp: 226, goldMin: 45, goldMax: 86, atkSpd: 2, dmg: [1, 30], db: 5, hit: 9 },
        "sparto": { n: "史巴托", lv: 16, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 120, ac: -3, mr: 18, exp: 257, goldMin: 50, goldMax: 93, atkSpd: 2, dmg: [2, 16], db: 2, hit: 4 },
        "ghoul": { n: "食屍鬼", lv: 16, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 110, ac: -4, mr: 13, exp: 257, goldMin: 50, goldMax: 93, atkSpd: 2, dmg: [3, 16], db: 2, hit: 4, mag: { skn: "麻痺", cd: 100, type: "paralyze", pbase: 50 } },
        "nm_010": { n: "鯊魚", lv: 16, s: "L", beh: "主動", race: "鯊魚", e: "water", hp: 90, ac: -2, mr: 50, exp: 257, goldMin: 50, goldMax: 93, atkSpd: 1.5, dmg: [3, 10], db: 2, hit: 4 },
        "b_knight": { n: "黑騎士", lv: 16, s: "S", beh: "被動", race: "黑騎士", e: "none", hp: 100, ac: -10, mr: 10, exp: 257, goldMin: 50, goldMax: 93, atkSpd: 2, dmg: [2, 16], db: 0, hit: 8 },
        "nm_011": { n: "黑騎士搜索隊", lv: 16, s: "S", beh: "被動", race: "黑騎士", e: "none", hp: 100, ac: -10, mr: 10, exp: 257, goldMin: 50, goldMax: 93, atkSpd: 2, dmg: [2, 16], db: 0, hit: 8 },
        "mermaid": { n: "人魚", lv: 16, s: "S", beh: "主動", race: "人魚", e: "water", hp: 85, ac: -2, mr: 5, exp: 257, goldMin: 50, goldMax: 93, atkSpd: 2, dmg: [1, 33], db: 0, hit: 10 },
        "neruga_orc": { n: "那魯加妖魔", lv: 17, s: "S", beh: "主動", race: "妖魔", e: "fire", hp: 150, ac: -8, mr: 7, exp: 290, goldMin: 56, goldMax: 102, atkSpd: 2, dmg: [1, 35], db: 0, hit: 3 },
        "lycan": { n: "萊肯", lv: 17, s: "S", beh: "主動", race: "狼人", isWolf: true, e: "wind", hp: 120, ac: -4, mr: 7, exp: 290, goldMin: 56, goldMax: 102, atkSpd: 2, dmg: [1, 34], db: 3, hit: 4 },
        "ungoliant": { n: "楊果里恩", lv: 18, s: "L", beh: "主動", race: "蜘蛛", e: "earth", hp: 200, ac: -5, mr: 10, exp: 325, goldMin: 61, goldMax: 110, atkSpd: 1, dmg: [1, 18], db: 1, hit: 6, mag: { skn: "中毒", cd: 100, type: "poison", pbase: 100, d: 10, tick: 5, dur: 20 } },
        "crabman": { n: "蟹人", lv: 18, s: "S", beh: "主動", race: "螃蟹", e: "water", hp: 200, ac: -10, mr: 1, exp: 325, goldMin: 61, goldMax: 110, atkSpd: 2, dmg: [3, 12], db: 1, hit: 4 },
        "giant": { n: "巨人", lv: 30, s: "L", beh: "主動", race: "巨人", e: "earth", hp: 400, ac: -20, mr: 30, exp: 901, goldMin: 138, goldMax: 229, atkSpd: 2, dmg: [2, 30], db: 30, hit: 10 },
        "giant_warrior": { n: "巨人戰士", lv: 33, s: "L", beh: "主動", race: "巨人", e: "earth", hp: 420, ac: -25, mr: 40, exp: 1090, goldMin: 184, goldMax: 302, atkSpd: 2, dmg: [2, 33], db: 33, hit: 10 },
        "giant_elder": { n: "巨人長老", lv: 33, s: "L", beh: "主動", race: "巨人", e: "earth", hp: 1000, ac: -25, mr: 40, exp: 1090, goldMin: 184, goldMax: 302, atkSpd: 2, dmg: [2, 33], db: 33, hit: 11 },
        "giant_ancient": { hard: true, n: "古代巨人", lv: 56, s: "L", beh: "主動", race: "巨人", boss: true, e: "earth", hp: 15000, ac: -63, mr: 70, exp: 3137, goldMin: 10000, goldMax: 20000, atkSpd: 2, dmg: [2, 112], db: 80, hit: 45, mag: { skn: "震裂術", cd: 70, chance: 0.35, dmg: [1, 300], db: 299, ele: "earth", alwaysHit: true, sec: { type: "stun", pbase: 150 } } },
        "giant_ant": { n: "巨大兵蟻", lv: 20, s: "L", beh: "主動", race: "昆蟲", e: "earth", hp: 150, ac: -7, mr: 60, exp: 401, goldMin: 100, goldMax: 200, atkSpd: 2, dmg: [2, 18], db: 6, hit: 8 },
        "ratman": { n: "鼠人", lv: 20, s: "S", beh: "主動", race: "鼠人", e: "earth", hp: 150, ac: -5, mr: 10, exp: 401, goldMin: 73, goldMax: 129, atkSpd: 2, dmg: [3, 10], db: 11, hit: 9 },
        "starfish": { n: "海星", lv: 20, s: "L", beh: "主動", race: "海星", e: "water", hp: 180, ac: -10, mr: 5, exp: 401, goldMin: 73, goldMax: 129, atkSpd: 2, dmg: [1, 40], db: 0, hit: 6, mag: { skn: "麻痺", cd: 100, type: "paralyze", pbase: 50 } },
        "elder": { n: "長老", lv: 21, s: "S", beh: "被動", race: "長老", e: "none", hp: 250, ac: -5, mr: 30, exp: 442, goldMin: 80, goldMax: 140, atkSpd: 2, dmg: [1, 30], db: 0, hit: 3, mag: { skn: "極道落雷", cd: 50, dmg: [1, 20], db: 20, ele: "wind" } },
        "gaster": { n: "卡司特", lv: 21, s: "S", beh: "主動", race: "卡司特", e: "earth", hp: 200, ac: -10, mr: 10, exp: 442, goldMin: 80, goldMax: 140, atkSpd: 1, dmg: [1, 15], db: 6, hit: 10, mag: { skn: "沉默", cd: 100, type: "magicseal", pbase: 60 } },
        "ogre": { n: "食人妖精", lv: 22, s: "L", beh: "主動", race: "食人妖精", e: "fire", hp: 250, ac: -6, mr: 10, exp: 485, goldMin: 46, goldMax: 359, atkSpd: 2, dmg: [2, 15], db: 14, hit: 8, mag: { skn: "火牢", cd: 30, chance: 0.1, dmg: [1, 10], db: 22, ele: "fire" } },
        "lamia": { n: "蛇女", lv: 22, s: "L", beh: "主動", race: "蛇女", e: "water", hp: 200, ac: -6, mr: 10, exp: 485, goldMin: 56, goldMax: 214, atkSpd: 2, dmg: [2, 14], db: 18, hit: 9 },
        "cerberus": { n: "地獄犬", lv: 24, s: "S", beh: "主動", race: "惡魔", e: "fire", hp: 120, ac: -20, mr: 12, exp: 577, goldMin: 102, goldMax: 173, atkSpd: 2, dmg: [3, 18], db: 5, hit: 5, mag: { skn: "噴火", cd: 50, dmg: [2, 10], db: 24, ele: "fire" } },
        "sildeis": { n: "希爾黛斯", lv: 24, s: "S", beh: "主動", race: "元素", elem: true, e: "water", hp: 210, ac: -23, mr: 35, exp: 730, goldMin: 102, goldMax: 173, atkSpd: 2, dmg: [1, 40], db: 5, hit: 4, mag: { skn: "漩渦", cd: 50, dmg: [3, 6], db: 24, ele: "water" } },
        "dragon_turtle": { hard: true, n: "龍龜", lv: 24, s: "L", beh: "主動", race: "龍龜", e: "water", hp: 280, ac: -4, mr: 5, exp: 577, goldMin: 102, goldMax: 173, atkSpd: 3, dmg: [1, 40], db: 20, hit: 3 },
        "scorpion": { n: "毒蠍", lv: 26, s: "L", beh: "主動", race: "毒蠍", e: "fire", hp: 200, ac: -15, mr: 5, exp: 677, goldMin: 60, goldMax: 150, atkSpd: 1.8, dmg: [1, 32], db: 20, hit: 8, mag: { skn: "中毒", cd: 50, type: "poison", pbase: 100, d: 10, tick: 5, dur: 20 } },
        "harpy": { n: "哈維", lv: 26, s: "S", beh: "主動", race: "哈維", e: "wind", hp: 230, ac: -18, mr: 25, exp: 677, goldMin: 118, goldMax: 198, atkSpd: 1.5, dmg: [1, 30], db: 18, hit: 9, mag: { skn: "吸血鬼之吻", cd: 80, dmg: [1, 10], db: 26, ele: "none", vamp: [1, 26] } },
        "skel_sniper": { n: "骷髏神射手", lv: 27, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 250, ac: -15, mr: 25, exp: 730, goldMin: 70, goldMax: 210, atkSpd: 1.5, dmg: [1, 34], db: 20, hit: 13 },
        "skel_guard": { n: "骷髏警衛", lv: 27, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 270, ac: -15, mr: 25, exp: 730, goldMin: 70, goldMax: 210, atkSpd: 2, dmg: [1, 34], db: 30, hit: 11 },
        "dark_elf": { n: "黑暗精靈", lv: 27, s: "S", beh: "主動", race: "黑暗精靈", e: "earth", hp: 350, ac: -24, mr: 30, exp: 730, goldMin: 126, goldMax: 212, atkSpd: 1.5, dmg: [1, 29], db: 21, hit: 13, mag: { skn: "龍捲風", cd: 110, dmg: [1, 27], db: 27, ele: "wind" } },
        "ogre_warrior": { n: "歐吉", lv: 28, s: "L", beh: "主動", race: "歐吉", e: "none", hp: 500, ac: -18, mr: 20, exp: 785, goldMin: 135, goldMax: 225, atkSpd: 3, dmg: [1, 45], db: 40, hit: 10 },
        "troll": { n: "多羅", lv: 28, s: "L", beh: "主動", race: "多羅", e: "earth", hp: 270, ac: -15, mr: 20, exp: 785, goldMin: 135, goldMax: 225, atkSpd: 2, dmg: [1, 35], db: 30, hit: 12 },
        "electon": { n: "伊萊克頓", lv: 28, s: "L", beh: "主動", race: "鮟鱇", e: "water", hp: 350, ac: -20, mr: 46, exp: 1226, goldMin: 135, goldMax: 225, atkSpd: 2, dmg: [2, 25], db: 16, hit: 11, mag: { skn: "防身電擊", cd: 130, dmg: [1, 14], db: 28, ele: "wind" } },
        "bandit": { n: "強盜", lv: 28, s: "S", beh: "主動", race: "強盜", e: "none", hp: 500, ac: -16, mr: 25, exp: 785, goldMin: 135, goldMax: 225, atkSpd: 1.7, dmg: [1, 35], db: 20, hit: 14 },
        "nm_012": { n: "雪人", lv: 28, s: "S", beh: "被動", race: "元素", elem: true, e: "water", hp: 444, ac: -18, mr: 25, exp: 1370, goldMin: 135, goldMax: 225, atkSpd: 2, dmg: [1, 30], db: 20, hit: 13 },
        "nm_013": { n: "紙人", lv: 28, s: "S", beh: "被動", race: "魔法生物", e: "wind", hp: 250, ac: -30, mr: 5, exp: 1370, goldMin: 235, goldMax: 425, atkSpd: 2, dmg: [2, 30], db: 20, hit: 14 },
        "skel_fighter": { n: "骷髏鬥士", lv: 29, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 280, ac: -15, mr: 25, exp: 842, goldMin: 70, goldMax: 210, atkSpd: 2, dmg: [1, 34], db: 32, hit: 12 },
        "crustacean": { hard: true, n: "奎斯坦修", lv: 29, s: "L", beh: "主動", race: "寄居蟹", e: "water", hp: 450, ac: -23, mr: 45, exp: 1090, goldMin: 128, goldMax: 236, atkSpd: 2.5, dmg: [1, 36], db: 42, hit: 12 },
        "bomb_flower": { n: "爆彈花", lv: 29, s: "S", beh: "主動", race: "爆彈花", e: "fire", hp: 230, ac: -10, mr: 25, exp: 677, goldMin: 118, goldMax: 198, atkSpd: 2, dmg: [1, 16], db: 40, hit: 13 },
        "ogre_king": { n: "食人妖精王", lv: 30, s: "L", beh: "主動", race: "食人妖精", e: "fire", hp: 400, ac: -13, mr: 20, exp: 901, goldMin: 153, goldMax: 254, atkSpd: 1.7, dmg: [3, 20], db: 15, hit: 12, mag: { skn: "火牢", cd: 30, chance: 0.1, dmg: [2, 10], db: 30, ele: "fire" } },
        "monia": { n: "莫妮亞", lv: 30, s: "S", beh: "主動", race: "蜘蛛", e: "earth", hp: 350, ac: -12, mr: 35, exp: 901, goldMin: 145, goldMax: 235, atkSpd: 1.5, dmg: [2, 27], db: 20, hit: 14 },
        "nm_014": { n: "艾爾摩士兵", lv: 30, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 250, ac: -15, mr: 0, exp: 901, goldMin: 165, goldMax: 215, atkSpd: 2, dmg: [2, 47], db: 20, hit: 14 },
        "griffon": { n: "格利芬", lv: 31, s: "L", beh: "主動", race: "格利芬", e: "wind", hp: 380, ac: -20, mr: 10, exp: 962, goldMin: 163, goldMax: 270, atkSpd: 1.8, dmg: [2, 28], db: 25, hit: 14 },
        "nm_015": { n: "艾爾摩法師", lv: 31, s: "L", beh: "主動", race: "不死", un: true, e: "earth", hp: 230, ac: -10, mr: 50, exp: 962, goldMin: 163, goldMax: 270, atkSpd: 2, dmg: [1, 30], db: 25, hit: 14, mag: { skn: "冰錐", cd: 30, dmg: [3, 10], db: 31, ele: "water" } },
        "nm_016": { hard: true, n: "密密", lv: 31, s: "S", beh: "主動", race: "魔法生物", e: "earth", hp: 300, ac: -16, mr: 20, exp: 962, goldMin: 163, goldMax: 270, atkSpd: 2, dmg: [1, 30], db: 25, hit: 14 },
        "giant_croc": { hard: true, n: "巨大鱷魚", lv: 32, s: "L", beh: "主動", race: "動物", boss: true, e: "water", hp: 4000, ac: -23, mr: 10, exp: 1025, goldMin: 1730, goldMax: 2850, atkSpd: 2.5, dmg: [4, 28], db: 90, hit: 35 },
        "nm_017": { hard: true, n: "冰石高崙", lv: 32, s: "L", beh: "被動", race: "高崙", e: "water", hp: 400, ac: -31, mr: 7, exp: 1025, goldMin: 173, goldMax: 285, atkSpd: 2.5, dmg: [2, 28], db: 30, hit: 15 },
        "gaster_king": { n: "卡司特王", lv: 33, s: "S", beh: "主動", race: "卡司特", e: "earth", hp: 300, ac: -13, mr: 20, exp: 1090, goldMin: 184, goldMax: 302, atkSpd: 1, dmg: [1, 35], db: 19, hit: 16, mag: { skn: "沉默", cd: 100, type: "magicseal", pbase: 100 } },
        "nm_018": { hard: true, n: "活鎧甲", lv: 33, s: "S", beh: "主動", race: "魔法生物", e: "earth", hp: 300, ac: -25, mr: 40, exp: 1090, goldMin: 183, goldMax: 280, atkSpd: 1, dmg: [1, 36], db: 15, hit: 15 },
        "beholder": { n: "多眼怪", lv: 33, s: "L", beh: "主動", race: "眼魔", e: "wind", hp: 450, ac: -10, mr: 50, exp: 1090, goldMin: 184, goldMax: 302, atkSpd: 1.5, dmg: [1, 48], db: 26, hit: 23, mag: { skn: "木乃伊的詛咒", cd: 80, type: "stone", pbase: 100 } },
        "dragon_fly": { n: "龍蠅", lv: 33, s: "S", beh: "主動", race: "昆蟲", e: "wind", hp: 350, ac: -20, mr: 70, exp: 1090, goldMin: 184, goldMax: 302, atkSpd: 1.5, dmg: [1, 85], db: 0, hit: 21 },
        "nm_019": { n: "冰原老虎", lv: 33, s: "S", beh: "主動", race: "動物", e: "water", hp: 270, ac: -18, mr: 0, exp: 1090, goldMin: 184, goldMax: 302, atkSpd: 1.5, dmg: [1, 40], db: 35, hit: 23 },
        "nm_020": { n: "雪怪", lv: 33, s: "L", beh: "主動", race: "雪怪", e: "water", hp: 400, ac: -18, mr: 0, exp: 1090, goldMin: 184, goldMax: 302, atkSpd: 3, dmg: [1, 45], db: 50, hit: 23 },
        "doppelganger": { n: "變形怪", lv: 33, s: "S", beh: "主動", race: "變形怪", e: "earth", hp: 320, ac: -20, mr: 20, exp: 1090, goldMin: 184, goldMax: 302, atkSpd: 2, dmg: [3, 25], db: 16, hit: 22 },
        "arian": { n: "亞力安", lv: 34, s: "L", beh: "主動", race: "亞力安", e: "earth", hp: 500, ac: -20, mr: 30, exp: 1157, goldMin: 165, goldMax: 365, atkSpd: 1.2, dmg: [1, 34], db: 28, hit: 25, mag: { skn: "石化光線", cd: 90, type: "stone", pbase: 100 } },
        "aruba": { n: "阿魯巴", lv: 35, s: "L", beh: "主動", race: "巨人", e: "earth", hp: 500, ac: -22, mr: 50, exp: 1226, goldMin: 165, goldMax: 253, atkSpd: 1.5, dmg: [2, 24], db: 25, hit: 25, mag: { skn: "加速術", type: "self_haste", cd: 140, spd: 1, dur: 8 } },
        "fire_warrior": { n: "火焰戰士", lv: 35, s: "S", beh: "主動", race: "亞人", e: "fire", hp: 350, ac: -16, mr: 20, exp: 1226, goldMin: 165, goldMax: 253, atkSpd: 1.2, dmg: [1, 30], db: 23, hit: 23 },
        "nm_021": { n: "艾爾摩將軍", lv: 35, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 280, ac: -10, mr: 0, exp: 1226, goldMin: 125, goldMax: 302, atkSpd: 3, dmg: [3, 30], db: 23, hit: 23 },
        "nm_022": { hard: true, n: "鋼鐵高崙", lv: 35, s: "L", beh: "主動", race: "高崙", e: "earth", hp: 650, ac: -18, mr: 50, exp: 1226, goldMin: 125, goldMax: 302, atkSpd: 3, dmg: [2, 30], db: 53, hit: 25 },
        "bandit_boss": { hard: true, n: "強盜頭目", lv: 35, s: "S", beh: "主動", race: "強盜", boss: true, e: "none", hp: 5000, ac: -25, mr: 50, exp: 1226, goldMin: 2050, goldMax: 3360, atkSpd: 1.5, dmg: [1, 100], db: 63, hit: 43 },
        "evil_lizard": { n: "邪惡蜥蜴", lv: 36, s: "L", beh: "主動", race: "邪惡蜥蜴", e: "water", hp: 800, ac: -20, mr: 30, exp: 1297, goldMin: 165, goldMax: 365, atkSpd: 2, dmg: [1, 64], db: 36, hit: 27, mag: { skn: "石化噴吐", cd: 110, type: "stone", pbase: 100 } },
        // 🔧 卡瑞：攜帶四樣任務道具時於龍之谷地監6樓 1% 機率出現（spawnMob 特殊判定）；擊殺 100% 掉屠龍劍並消耗四道具各一
        "kari": { hard: true, n: "卡瑞", lv: 52, s: "S", beh: "主動", race: "不死", un: true, e: "earth", boss: true, noAutoTeleport: true, hp: 10000, ac: -45, mr: 100, exp: 3000, goldMin: 10000, goldMax: 20000, atkSpd: 0.9, dmg: [1, 100], db: 50, hit: 50,   // 🔧 BOSS（但不觸發瞬移卷軸自動使用）
            mag:  { skn: "地面震裂", cd: 50, chance: 0.2, dmg: [4, 100], db: 99, ele: "earth" },                 // 每 5 秒判定，20% 機率施放：必中 4D100+99 地屬性魔法傷害
            mag2: { skn: "龍的一擊", cd: 70, dmg: [1, 100], db: 25, ele: "none", fixedDmg: true } },             // 每 7 秒：必中 1D100+25 無屬性固定傷害（不受屬抗/抗魔/減免影響）
        "fire_archer": { n: "火焰弓箭手", lv: 36, s: "S", beh: "主動", race: "亞人", e: "fire", hp: 320, ac: -5, mr: 20, exp: 1297, goldMin: 165, goldMax: 365, atkSpd: 0.8, dmg: [1, 40], db: 26, hit: 30 },
        "succubus": { n: "思克巴", lv: 37, s: "S", beh: "主動", race: "思克巴", e: "earth", hp: 400, ac: -25, mr: 50, exp: 1370, goldMin: 153, goldMax: 244, atkSpd: 1.8, dmg: [2, 30], db: 37, hit: 26, mag: { skn: "吸血鬼之吻", cd: 80, dmg: [2, 10], db: 37, ele: "none", vamp: [1, 37] } },
        "salamander": { n: "火蜥蜴", lv: 38, s: "S", beh: "主動", race: "元素", elem: true, e: "fire", hp: 383, ac: -23, mr: 11, exp: 1450, goldMin: 165, goldMax: 284, atkSpd: 1.5, dmg: [4, 10], db: 44, hit: 28 },
        "fire_egg": { n: "火炎蛋", lv: 39, s: "S", beh: "主動", race: "元素", elem: true, e: "fire", hp: 500, ac: -36, mr: 40, exp: 1520, goldMin: 153, goldMax: 244, atkSpd: 2, dmg: [4, 15], db: 14, hit: 26 },
        "nm_023": { n: "夢幻之島閃電球", lv: 39, s: "S", beh: "主動", race: "元素", elem: true, e: "wind", hp: 340, ac: -40, mr: 40, exp: 1520, goldMin: 153, goldMax: 244, atkSpd: 1, dmg: [2, 15], db: 14, hit: 26 },
        "nm_024": { hard: true, n: "夢幻之島鎧甲守衛", lv: 39, s: "L", beh: "主動", race: "元素", elem: true, e: "earth", hp: 400, ac: -40, mr: 0, exp: 1520, goldMin: 153, goldMax: 244, atkSpd: 4, dmg: [4, 28], db: 48, hit: 23 },
        "cyclops": { n: "獨眼巨人", lv: 40, s: "L", beh: "主動", race: "巨人", e: "wind", hp: 800, ac: -23, mr: 30, exp: 1601, goldMin: 265, goldMax: 429, atkSpd: 2, dmg: [4, 20], db: 40, hit: 30 },
        "succubus_queen": { n: "思克巴女皇", lv: 41, s: "S", beh: "主動", race: "思克巴", e: "earth", hp: 500, ac: -32, mr: 80, exp: 1682, goldMin: 162, goldMax: 256, atkSpd: 1.8, dmg: [2, 41], db: 41, hit: 33, mag: { skn: "吸血鬼之吻", cd: 80, dmg: [2, 11], db: 41, ele: "none", vamp: [1, 41] } },
        "nm_025": { n: "影魔", lv: 41, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 832, ac: -43, mr: 30, exp: 1682, goldMin: 362, goldMax: 656, atkSpd: 1.5, dmg: [2, 42], db: 35, hit: 33 },
        "nm_026": { n: "鬼魂", lv: 42, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 644, ac: -31, mr: 5, exp: 1765, goldMin: 150, goldMax: 700, atkSpd: 2, dmg: [3, 31], db: 12, hit: 35 },
        "necromancer": { hard: true, n: "巫師", lv: 42, s: "S", beh: "主動", race: "長老", e: "none", hp: 800, ac: -32, mr: 80, exp: 1765, goldMin: 350, goldMax: 500, atkSpd: 2, dmg: [2, 31], db: 42, hit: 35, mag: { skn: "極光雷電", cd: 80, dmg: [1, 80], db: 82, ele: "wind" } },
        "lava_golem": { hard: true, n: "熔岩高崙", lv: 43, s: "L", beh: "主動", race: "高崙", e: "fire", hp: 700, ac: -18, mr: 50, exp: 1850, goldMin: 350, goldMax: 500, atkSpd: 3, dmg: [1, 21], db: 86, hit: 30, mag: { skn: "燃燒的火球", cd: 80, dmg: [1, 20], db: 43, ele: "fire" } },
        "nm_027": { n: "紅鬼魂", lv: 43, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 666, ac: -33, mr: 5, exp: 1850, goldMin: 150, goldMax: 700, atkSpd: 2, dmg: [3, 33], db: 0, hit: 36 },
        "nm_028": { hard: true, n: "夢幻之島火精靈王", lv: 43, s: "L", beh: "主動", race: "元素", elem: true, boss: true, e: "fire", hp: 1500, ac: -53, mr: 45, exp: 3601, goldMin: 450, goldMax: 790, atkSpd: 2, dmg: [3, 41], db: 43, hit: 40, mag: { skn: "爆炎的火球", cd: 50, dmg: [1, 50], db: 53, ele: "fire", alwaysHit: true } },
        "nm_029": { hard: true, n: "夢幻之島水精靈王", lv: 43, s: "L", beh: "主動", race: "元素", elem: true, boss: true, e: "water", hp: 2500, ac: -53, mr: 45, exp: 3601, goldMin: 450, goldMax: 790, atkSpd: 2, dmg: [3, 21], db: 33, hit: 40, mag: { skn: "水柱", cd: 50, dmg: [3, 30], db: 43, ele: "water", alwaysHit: true } },
        "nm_030": { hard: true, n: "夢幻之島風精靈王", lv: 43, s: "L", beh: "主動", race: "元素", elem: true, boss: true, e: "wind", hp: 1500, ac: -53, mr: 45, exp: 3601, goldMin: 450, goldMax: 790, atkSpd: 1, dmg: [3, 41], db: 10, hit: 43, mag: { skn: "龍捲風", cd: 50, dmg: [4, 30], db: 30, ele: "wind", alwaysHit: true } },
        "nm_031": { hard: true, n: "夢幻之島地精靈王", lv: 43, s: "L", beh: "主動", race: "元素", elem: true, boss: true, e: "earth", hp: 2000, ac: -53, mr: 45, exp: 3601, goldMin: 450, goldMax: 790, atkSpd: 3, dmg: [2, 61], db: 80, hit: 49, mag: { skn: "巨石之擊", cd: 50, dmg: [2, 60], db: 23, ele: "earth", alwaysHit: true } },
        "nm_032": { hard: true, n: "獨角獸", lv: 43, s: "L", beh: "主動", race: "獨角獸", boss: true, e: "earth", hp: 3000, ac: -48, mr: 45, exp: 3601, goldMin: 450, goldMax: 790, atkSpd: 1.5, dmg: [2, 31], db: 60, hit: 43 },
        "nm_037": { hard: true, n: "夢魘", lv: 40, s: "L", beh: "主動", race: "惡魔", boss: true, e: "none", hp: 1500, ac: -42, mr: 80, exp: 1601, goldMin: 161, goldMax: 264, atkSpd: 1.5, dmg: [1, 100], db: 20, hit: 40 },
        "nm_038": { n: "夢幻之島蘑菇", lv: 30, s: "S", beh: "主動", race: "蘑菇", e: "earth", hp: 250, ac: -27, mr: 0, exp: 901, goldMin: 165, goldMax: 215, atkSpd: 1, dmg: [1, 47], db: 15, hit: 23, mag: { skn: "中毒", cd: 100, type: "poison", pbase: 100, d: 30, tick: 5, dur: 20 } },
        "nm_039": { n: "夢幻之島鬼火", lv: 30, s: "S", beh: "主動", race: "鬼火", e: "earth", hp: 360, ac: -33, mr: 35, exp: 901, goldMin: 165, goldMax: 215, atkSpd: 2, dmg: [2, 37], db: 25, hit: 24 },
        "nm_040": { n: "夢幻之島火蜥蜴", lv: 38, s: "S", beh: "主動", race: "元素", elem: true, e: "fire", hp: 383, ac: -28, mr: 11, exp: 1450, goldMin: 165, goldMax: 284, atkSpd: 1.5, dmg: [4, 15], db: 34, hit: 28 },
        "nm_041": { n: "夢幻之島殺人蜂", lv: 38, s: "S", beh: "被動", race: "昆蟲", e: "none", hp: 200, ac: -36, mr: 10, exp: 1450, goldMin: 43, goldMax: 444, atkSpd: 0.5, dmg: [1, 36], db: 1, hit: 35 },
        "nm_042": { n: "夢幻之島暴走兔", lv: 38, s: "S", beh: "被動", race: "動物", e: "none", hp: 250, ac: -26, mr: 30, exp: 1450, goldMin: 343, goldMax: 444, atkSpd: 1, dmg: [2, 16], db: 15, hit: 33, mag: { skn: "冰錐", cd: 30, dmg: [1, 30], db: 23, ele: "water", alwaysHit: true } },
        "nm_043": { n: "夢幻之島火炎蛋", lv: 39, s: "S", beh: "主動", race: "元素", elem: true, e: "fire", hp: 500, ac: -36, mr: 40, exp: 1520, goldMin: 153, goldMax: 244, atkSpd: 2, dmg: [4, 15], db: 14, hit: 26 },
        "nm_044": { n: "夢幻之島冰石高崙", lv: 39, s: "L", beh: "被動", race: "高崙", e: "water", hp: 573, ac: -31, mr: 7, exp: 1520, goldMin: 153, goldMax: 244, atkSpd: 2.5, dmg: [5, 15], db: 24, hit: 24 },
        "nm_045": { n: "夢幻之島大鬼火", lv: 40, s: "S", beh: "主動", race: "鬼火", e: "earth", hp: 360, ac: -33, mr: 35, exp: 1520, goldMin: 153, goldMax: 244, atkSpd: 2, dmg: [2, 50], db: 25, hit: 28 },
        "nm_046": { n: "冰人", lv: 30, s: "L", beh: "被動", race: "元素", elem: true, e: "water", hp: 300, ac: -20, mr: 21, exp: 901, goldMin: 143, goldMax: 324, atkSpd: 2, dmg: [2, 40], db: 21, hit: 15 },
        "ice_maid": { n: "冰之女王侍女", lv: 10, s: "S", beh: "主動", race: "元素", elem: true, e: "water", hp: 1000, ac: -35, mr: 60, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [1, 100], db: 10, hit: 29 },
        "ice_queen": { hard: true, n: "冰之女王", lv: 75, s: "S", beh: "主動", race: "元素", elem: true, boss: true, e: "water", hp: 25000, ac: -65, mr: 60, exp: 5000, goldMin: 9000, goldMax: 18000, atkSpd: 2, dmg: [4, 75], db: 150, hit: 71, mag: { skn: "冰雪暴", cd: 80, chance: 0.3, dmg: [7, 150], db: 99, ele: "water", alwaysHit: true, sec: { type: "freeze", pbase: 200 } }, mag2: { skn: "寒冰吐息", cd: 130, type: "frost_breath", pbase: 200, dur: 8 }, mag3: { skn: "冰錐", cd: 50, dmg: [1, 400], db: 99, ele: "water", alwaysHit: true } },
        "ice_demon": { hard: true, n: "冰魔", lv: 65, s: "S", beh: "主動", race: "元素", elem: true, boss: true, e: "none", hp: 18000, ac: -70, mr: 80, exp: 3600, goldMin: 10000, goldMax: 20000, atkSpd: 2, dmg: [2, 130], db: 150, hit: 75, mag: { skn: "冰裂術", cd: 70, chance: 0.3, dmg: [5, 200], db: 99, ele: "water", alwaysHit: true, sec: { type: "freeze", pbase: 250 } }, mag2: { skn: "雷霆風暴", cd: 130, dmg: [3, 200], db: 66, ele: "wind", alwaysHit: true }, mag3: { skn: "衝擊之暈", cd: 90, chance: 0.5, type: "stun", pbase: 200 } },
        "batus": { hard: true, n: "巴土瑟", lv: 43, s: "S", beh: "主動", race: "四色", boss: true, e: "none", hp: 8000, ac: -32, mr: 80, exp: 1850, goldMin: 1500, goldMax: 3000, atkSpd: 2, dmg: [3, 45], db: 62, hit: 55, mag: { skn: "地裂術", cd: 70, dmg: [3, 80], db: 183, ele: "earth" } },
        "casper": { hard: true, n: "卡士柏", lv: 44, s: "S", beh: "主動", race: "四色", boss: true, e: "none", hp: 8000, ac: -32, mr: 80, exp: 1937, goldMin: 1500, goldMax: 3000, atkSpd: 2, dmg: [3, 70], db: 32, hit: 56, mag: { skn: "燃燒的火球", cd: 60, dmg: [2, 100], db: 196, ele: "fire" } },
        "marcus": { hard: true, n: "馬庫爾", lv: 45, s: "S", beh: "主動", race: "四色", boss: true, e: "none", hp: 8000, ac: -32, mr: 80, exp: 2026, goldMin: 1500, goldMax: 3000, atkSpd: 2, dmg: [1, 120], db: 45, hit: 56, mag: { skn: "光箭", cd: 30, dmg: [1, 120], db: 90, ele: "none" } },
        "ashitakio": { n: "阿西塔基奧", lv: 45, s: "L", beh: "主動", race: "阿西塔基奧", e: "fire", hp: 1100, ac: -18, mr: 30, exp: 2026, goldMin: 250, goldMax: 500, atkSpd: 1.5, dmg: [1, 70], db: 32, hit: 38 },
        "nm_033": { n: "死神", lv: 45, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 280, ac: -60, mr: 9, exp: 2026, goldMin: 350, goldMax: 600, atkSpd: 1.5, dmg: [2, 33], db: 44, hit: 40 },
        "ifrit": { hard: true, n: "伊弗利特", lv: 45, s: "L", beh: "主動", race: "惡魔", boss: true, e: "fire", hp: 11000, ac: -38, mr: 40, exp: 2117, goldMin: 2500, goldMax: 4000, atkSpd: 1.5, dmg: [1, 130], db: 72, hit: 58, mag: { skn: "火之矛", cd: 70, dmg: [3, 120], db: 245, ele: "fire" } },
        "fire_beast": { n: "烈炎獸", lv: 48, s: "S", beh: "主動", race: "地獄犬", e: "fire", hp: 1154, ac: -28, mr: 35, exp: 2810, goldMin: 351, goldMax: 430, atkSpd: 1.2, dmg: [1, 70], db: 42, hit: 39, mag: { skn: "火焰噴吐", cd: 50, dmg: [1, 120], db: 45, ele: "fire" } },
        "wyvern": { hard: true, n: "飛龍", lv: 48, s: "L", beh: "主動", race: "飛龍", boss: true, e: "wind", hp: 11000, ac: -58, mr: 80, exp: 2810, goldMin: 2452, goldMax: 11214, atkSpd: 1, dmg: [1, 140], db: 148, hit: 59, mag: { skn: "火焰噴吐", cd: 70, dmg: [3, 120], db: 248, ele: "fire" } },
        "blackelder": { hard: true, n: "黑長者", lv: 50, s: "S", beh: "主動", race: "長老", boss: true, e: "none", hp: 12000, ac: -45, mr: 90, exp: 2501, goldMin: 2452, goldMax: 11214, atkSpd: 2, dmg: [1, 200], db: 121, hit: 57, mag: { skn: "龍捲風", cd: 110, dmg: [4, 100], db: 148, ele: "wind" }, mag2: { skn: "靈光箭", cd: 30, chance: 0.7, dmg: [1, 100], db: 50, ele: "none" } },
        "doppel_boss": { hard: true, n: "變形怪首領", lv: 50, s: "S", beh: "主動", race: "變形怪", boss: true, e: "wind", hp: 13000, ac: -63, mr: 80, exp: 2501, goldMin: 3452, goldMax: 12214, atkSpd: 2, dmg: [1, 100], db: 151, hit: 60, mag: { skn: "冰雪暴", cd: 50, chance: 0.5, dmg: [2, 100], db: 148, ele: "water" }, mag2: { skn: "火風暴", cd: 70, chance: 0.2, dmg: [2, 110], db: 248, ele: "fire" } },
        "baphomet": { hard: true, n: "巴風特", lv: 50, s: "S", beh: "主動", race: "惡魔", boss: true, e: "earth", hp: 14000, ac: -65, mr: 80, exp: 2602, goldMin: 3652, goldMax: 13514, atkSpd: 1.5, dmg: [1, 100], db: 152, hit: 65, mag: { skn: "地裂術", cd: 50, chance: 0.5, dmg: [3, 100], db: 252, ele: "earth" }, mag2: { skn: "震裂術", cd: 60, chance: 0.4, dmg: [6, 100], db: 130, ele: "earth" } },
        "kurt": { hard: true, n: "克特", lv: 51, s: "S", beh: "主動", race: "黑騎士", boss: true, e: "none", hp: 15000, ac: -67, mr: 65, exp: 5185, goldMin: 4216, goldMax: 21515, atkSpd: 1, dmg: [1, 100], db: 120, hit: 67, mag: { skn: "盾擊", cd: 70, chance: 0.3, type: "stun", pbase: 150 }, mag2: { skn: "極道落雷", cd: 110, dmg: [2, 100], db: 199, ele: "wind" } },
        "dk": { hard: true, n: "死亡騎士", lv: 52, s: "S", beh: "主動", race: "不死", boss: true, un: true, e: "earth", hp: 18000, ac: -65, mr: 100, exp: 6185, goldMin: 5216, goldMax: 31515, atkSpd: 0.8, dmg: [1, 100], db: 135, hit: 70, mag: { skn: "地面震裂", cd: 50, chance: 0.2, dmg: [5, 100], db: 499, ele: "earth" }, mag2: { skn: "吸血鬼之吻", cd: 130, dmg: [1, 100], db: 199, ele: "none", vamp: [1, 212] }, mag3: { skn: "光球", cd: 30, chance: 0.2, dmg: [1, 200], db: 199, ele: "none" } },
        "ant_queen": { hard: true, n: "巨蟻女皇", lv: 57, s: "L", beh: "主動", race: "螞蟻", boss: true, e: "earth", hp: 16000, ac: -80, mr: 60, exp: 6500, goldMin: 4216, goldMax: 27845, atkSpd: 1.5, dmg: [1, 300], db: 85, hit: 70, mag: { skn: "震裂術", cd: 70, dmg: [5, 100], db: 99, ele: "earth" } },
        "phoenix": { hard: true, n: "不死鳥", lv: 59, s: "L", beh: "主動", race: "不死鳥", boss: true, un: true, e: "fire", hp: 18500, ac: -63, mr: 150, exp: 6964, goldMin: 9236, goldMax: 37248, atkSpd: 1.2, dmg: [1, 350], db: 65, hit: 75, mag: { skn: "火焰雨", cd: 130, dmg: [2, 100], db: 318, ele: "fire", sec: { type: "burn", tick: 5, d: 100, dur: 20, pbase: 100 } }, mag2: { skn: "流星雨", cd: 60, chance: 0.2, dmg: [4, 100], db: 318, ele: "fire" } },
        "nm_034": { hard: true, n: "惡魔", lv: 61, s: "L", beh: "主動", race: "惡魔", boss: true, e: "earth", hp: 26666, ac: -75, mr: 100, exp: 6666, goldMin: 6666, goldMax: 66666, atkSpd: 1, dmg: [6, 66], db: 66, hit: 76, mag: { skn: "火焰之舞", cd: 60, chance: 0.3, dmg: [6, 66], db: 666, ele: "fire", sec: { type: "burn", tick: 5, d: 66, dur: 20, pbase: 100 } }, mag2: { skn: "禁地封印", cd: 90, chance: 0.3, type: "magicseal", pbase: 200 }, mag3: { skn: "地面震裂", cd: 50, chance: 0.2, dmg: [5, 100], db: 499, ele: "earth" } },
        "antaras": { hard: true, n: "安塔瑞斯", lv: 93, s: "L", beh: "主動", race: "龍", boss: true, e: "earth", hp: 150000, ac: -80, mr: 200, exp: 9200, goldMin: 19236, goldMax: 26524, atkSpd: 1.5, dmg: [2, 250], db: 265, hit: 95, mag: { skn: "毒氣風暴", cd: 130, type: "poison", pbase: 250, d: 200, tick: 3, dur: 12 }, mag2: { skn: "地裂術", cd: 70, dmg: [6, 100], db: 499, ele: "earth" }, mag3: { skn: "大地怒吼", cd: 90, chance: 0.3, dmg: [1, 600], db: 999, ele: "earth" } },
        "fafurion": { hard: true, n: "法利昂", lv: 93, s: "L", beh: "主動", race: "龍", boss: true, e: "water", hp: 130000, ac: -80, mr: 250, exp: 9400, goldMin: 18236, goldMax: 28524, atkSpd: 2, dmg: [2, 350], db: 265, hit: 95, mag: { skn: "巨水炮", cd: 50, dmg: [3, 100], db: 250, ele: "water" }, mag2: { skn: "寒冰噴吐", cd: 70, chance: 0.3, dmg: [4, 100], db: 399, ele: "water", sec: { type: "freeze", pbase: 200 } }, mag3: { skn: "冰裂術", cd: 70, dmg: [1, 100], db: 200, ele: "water", ext_freeze: 666 } },
        "valakas": { hard: true, n: "巴拉卡斯", lv: 95, s: "L", beh: "主動", race: "龍", boss: true, e: "fire", hp: 200000, ac: -99, mr: 200, exp: 10000, goldMin: 20236, goldMax: 36524, atkSpd: 4, dmg: [3, 350], db: 565, hit: 99, mag: { skn: "火牢", cd: 50, chance: 0.1, type: "burn", d: 200, tick: 3, dur: 21 }, mag2: { skn: "流星雨", cd: 100, dmg: [5, 100], db: 560, ele: "fire", sec: { type: "scald", tick: 3, d: 100, dur: 15, pbase: 200 } }, mag3: { skn: "火焰噴吐", cd: 170, dmg: [2, 100], db: 1200, ele: "fire" } },
        "lindvior": { hard: true, n: "林德拜爾", lv: 90, s: "L", beh: "主動", race: "龍", boss: true, noAutoTeleport: true, e: "wind", hp: 120000, ac: -90, mr: 200, exp: 7922, goldMin: 13236, goldMax: 21524, atkSpd: 1, dmg: [2, 200], db: 165, hit: 98, mag: { skn: "封印禁地", cd: 50, chance: 0.1, type: "silence", pbase: 250 }, mag2: { skn: "閃電風暴", cd: 70, dmg: [7, 100], db: 299, ele: "wind" }, mag3: { skn: "電擊", cd: 90, chance: 0.5, dmg: [1, 500], db: 599, ele: "wind", sec: { type: "paralyze", pbase: 200 } } },
        "nm_035": { n: "牧羊犬", lv: 5, s: "S", beh: "被動", race: "動物", e: "earth", hp: 30, ac: 10, mr: 30, exp: 26, goldMin: 13, goldMax: 36, atkSpd: 2, dmg: [1, 5], db: 0, hit: 0 },
        "nm_036": { n: "夢幻之島冰人", lv: 38, s: "L", beh: "被動", race: "元素", elem: true, e: "water", hp: 350, ac: -30, mr: 21, exp: 1450, goldMin: 243, goldMax: 364, atkSpd: 2, dmg: [2, 40], db: 40, hit: 29 },
        "sema": { hard: true, n: "西瑪", lv: 42, s: "S", boss: true, race: "四色", e: "none", hp: 8000, ac: -32, mr: 80, exp: 1765, goldMin: 1500, goldMax: 3000, atkSpd: 2.0, dmg: [4, 31], db: 62, hit: 55, mag: { skn: "極光雷電", sk: 'thunder', cd: 50, dmg: [2, 80], db: 182, ele: 'wind' } },
        // ===== 🏛️ 底比斯（時空裂痕·狩獵區域）：沙漠／金字塔內部／歐西里斯祭壇 =====
        "thebes_mandra_w":  { n: "底比斯 曼陀羅草(白)", lv: 23, s: "S", beh: "被動", race: "底比斯", e: "earth", hp: 280, ac: -10, mr: 50, exp: 530, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [2, 23], db: 11, hit: 11 },
        "thebes_mandra":    { n: "底比斯 曼陀羅草", lv: 26, s: "S", beh: "被動", race: "底比斯", e: "fire", hp: 320, ac: -15, mr: 50, exp: 677, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [2, 26], db: 13, hit: 12 },
        "thebes_scarab":    { n: "底比斯 聖甲蟲", lv: 29, s: "S", beh: "被動", race: "底比斯", e: "earth", hp: 400, ac: -25, mr: 60, exp: 842, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [2, 29], db: 15, hit: 14 },
        "thebes_scarab_b":  { n: "底比斯 聖甲蟲(藍)", lv: 32, s: "S", beh: "主動", race: "底比斯", e: "earth", hp: 480, ac: -25, mr: 65, exp: 1025, goldMin: 0, goldMax: 0, atkSpd: 1, dmg: [1, 29], db: 16, hit: 16 },
        "thebes_kebis_b":   { n: "底比斯 凱比斯(黑)", lv: 35, s: "S", beh: "被動", race: "底比斯", e: "earth", hp: 480, ac: -20, mr: 66, exp: 1025, goldMin: 0, goldMax: 0, atkSpd: 1, dmg: [1, 35], db: 18, hit: 17, mag: { skn: "中毒", cd: 50, type: "poison", pbase: 200, d: 10, tick: 5, dur: 20 } },
        "thebes_kebis_r":   { n: "底比斯 凱比斯(紅)", lv: 39, s: "S", beh: "主動", race: "底比斯", e: "earth", hp: 600, ac: -25, mr: 66, exp: 1522, goldMin: 0, goldMax: 0, atkSpd: 1, dmg: [1, 39], db: 22, hit: 19, mag: { skn: "中毒", cd: 50, type: "poison", pbase: 200, d: 10, tick: 5, dur: 20 } },
        "thebes_obelisk":   { hard: true, n: "底比斯 尖碑石奴", lv: 41, s: "L", beh: "被動", race: "底比斯", e: "water", hp: 700, ac: -25, mr: 80, exp: 1682, goldMin: 0, goldMax: 0, atkSpd: 3, dmg: [3, 41], db: 63, hit: 20, mag: { skn: "龍捲風", cd: 90, dmg: [3, 41], db: 63, ele: "wind" } },
        "thebes_obelisk_b": { hard: true, n: "底比斯 尖碑石奴(黑)", lv: 44, s: "L", beh: "被動", race: "底比斯", e: "fire", hp: 800, ac: -25, mr: 80, exp: 1937, goldMin: 0, goldMax: 0, atkSpd: 3, dmg: [3, 44], db: 65, hit: 21, mag: { skn: "龍捲風", cd: 90, dmg: [3, 44], db: 65, ele: "wind" } },
        "thebes_sphinx":    { n: "底比斯 斯芬克斯", lv: 47, s: "L", beh: "被動", race: "底比斯", e: "none", hp: 880, ac: -29, mr: 100, exp: 2210, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [2, 47], db: 47, hit: 23, mag: { skn: "彩虹波動", cd: 70, chance: 0.5, dmg: [4, 47], db: 50, ele: "none" } },
        "thebes_sphinx_b":  { n: "底比斯 斯芬克斯(黑)", lv: 50, s: "L", beh: "主動", race: "底比斯", e: "earth", hp: 1120, ac: -32, mr: 100, exp: 2501, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [2, 55], db: 51, hit: 25, mag: { skn: "彩虹波動", cd: 70, chance: 0.5, dmg: [4, 50], db: 60, ele: "none" } },
        "thebes_nehos":     { n: "底比斯 尼荷斯", lv: 50, s: "S", beh: "被動", race: "底比斯", e: "fire", hp: 900, ac: -20, mr: 60, exp: 2501, goldMin: 0, goldMax: 0, atkSpd: 1, dmg: [1, 56], db: 27, hit: 27, mag: { skn: "火球", cd: 70, chance: 0.5, dmg: [5, 50], db: 30, ele: "fire" } },
        "thebes_nehos_b":   { n: "底比斯 尼荷斯(藍)", lv: 52, s: "S", beh: "主動", race: "底比斯", e: "fire", hp: 1120, ac: -30, mr: 60, exp: 2705, goldMin: 0, goldMax: 0, atkSpd: 1, dmg: [1, 60], db: 28, hit: 28, mag: { skn: "火球", cd: 70, chance: 0.5, dmg: [5, 50], db: 40, ele: "fire" } },
        "thebes_anus":      { n: "底比斯 阿努斯", lv: 54, s: "S", beh: "被動", race: "底比斯", e: "none", hp: 1200, ac: -40, mr: 65, exp: 2917, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [2, 65], db: 60, hit: 30 },
        "thebes_anus_b":    { n: "底比斯 阿努斯(黑)", lv: 56, s: "S", beh: "主動", race: "底比斯", e: "none", hp: 1300, ac: -40, mr: 65, exp: 3137, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [2, 68], db: 61, hit: 31 },
        "thebes_bas":       { n: "底比斯 巴斯", lv: 58, s: "S", beh: "被動", race: "底比斯", e: "none", hp: 1400, ac: -30, mr: 70, exp: 3365, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [2, 65], db: 60, hit: 31, mag: { skn: "雷霆風暴", cd: 70, chance: 0.5, dmg: [6, 50], db: 40, ele: "wind" } },
        "thebes_bas_r":     { n: "底比斯 巴斯(紅)", lv: 60, s: "S", beh: "主動", race: "底比斯", e: "none", hp: 1500, ac: -30, mr: 70, exp: 3601, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [2, 68], db: 61, hit: 32, mag: { skn: "雷霆風暴", cd: 70, chance: 0.5, dmg: [6, 50], db: 50, ele: "wind" } },
        "thebes_anubis":    { hard: true, n: "底比斯 阿努比斯", lv: 70, s: "L", beh: "主動", race: "底比斯", boss: true, e: "wind", hp: 25000, ac: -140, mr: 80, exp: 4901, goldMin: 0, goldMax: 0, atkSpd: 3, dmg: [3, 140], db: 140, hit: 72, mag: { skn: "震裂踏擊", cd: 70, chance: 0.5, dmg: [6, 100], db: 50, ele: "earth", sec: { type: "stun", pbase: 200, dur: 3 } }, mag2: { skn: "審判之雷", cd: 90, chance: 0.5, dmg: [1, 1000], db: 0, ele: "wind" } },
        "thebes_horus":     { hard: true, n: "底比斯 賀洛斯", lv: 70, s: "L", beh: "主動", race: "底比斯", boss: true, e: "water", hp: 20000, ac: -140, mr: 80, exp: 4901, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [3, 70], db: 100, hit: 71, mag: { skn: "火焰放射", cd: 70, chance: 0.5, dmg: [3, 100], db: 50, ele: "fire", sec: { type: "burn", pbase: 250, d: 100, tick: 3, dur: 18 } }, mag2: { skn: "火球", cd: 110, chance: 0.5, dmg: [1, 800], db: 0, ele: "fire" } },
        // ===== 拉斯塔巴德地下洞穴：歐姆族 =====
        "ohm": { n: "歐姆", lv: 19, s: "S", beh: "被動", race: "歐姆", e: "earth", hp: 152, ac: -10, mr: 19, exp: 362, goldMin: 20, goldMax: 300, atkSpd: 2, dmg: [2, 19], db: 1, hit: 6 },
        "ohm_rage": { n: "狂暴的歐姆", lv: 21, s: "S", beh: "被動", race: "歐姆", e: "earth", hp: 168, ac: -11, mr: 21, exp: 442, goldMin: 20, goldMax: 300, atkSpd: 2, dmg: [2, 21], db: 1, hit: 10 },
        "ohm_armor": { n: "歐姆裝甲兵", lv: 23, s: "L", beh: "被動", race: "歐姆", e: "water", hp: 184, ac: -12, mr: 21, exp: 530, goldMin: 100, goldMax: 400, atkSpd: 3, dmg: [3, 21], db: 8, hit: 10 },
        "ohm_armor_rage": { n: "狂暴的歐姆裝甲兵", lv: 25, s: "L", beh: "被動", race: "歐姆", e: "water", hp: 200, ac: -13, mr: 25, exp: 626, goldMin: 100, goldMax: 400, atkSpd: 2, dmg: [2, 25], db: 8, hit: 11 },
        // ===== 拉斯塔巴德地下洞穴：黑暗妖精殘兵 =====
        "de_remnant_bow": { n: "黑暗妖精殘兵(弓)", lv: 27, s: "S", beh: "被動", race: "黑暗妖精", e: "none", hp: 216, ac: -11, mr: 27, exp: 730, goldMin: 50, goldMax: 400, atkSpd: 1, dmg: [1, 27], db: 8, hit: 13 },
        "de_remnant_sword": { n: "黑暗妖精殘兵(劍)", lv: 29, s: "S", beh: "被動", race: "黑暗妖精", e: "none", hp: 261, ac: -15, mr: 29, exp: 842, goldMin: 50, goldMax: 400, atkSpd: 1.5, dmg: [2, 20], db: 8, hit: 13 },
        "de_remnant_xbow": { n: "黑暗妖精殘兵(十字弓)", lv: 29, s: "S", beh: "被動", race: "黑暗妖精", e: "none", hp: 232, ac: -12, mr: 29, exp: 842, goldMin: 50, goldMax: 400, atkSpd: 1, dmg: [1, 29], db: 9, hit: 11 },
        "de_remnant_mage": { n: "黑暗妖精殘兵(法師)", lv: 30, s: "S", beh: "被動", race: "黑暗妖精", e: "none", hp: 240, ac: -10, mr: 30, exp: 901, goldMin: 50, goldMax: 400, atkSpd: 2, dmg: [2, 29], db: 7, hit: 10, mag: { skn: "冰錐", cd: 70, dmg: [2, 30], db: 38, ele: "water", alwaysHit: true }, mag2: { skn: "龍捲風", cd: 50, chance: 0.2, dmg: [3, 30], db: 48, ele: "wind", alwaysHit: true } },
        "de_remnant_2h": { n: "黑暗妖精殘兵(雙手劍)", lv: 33, s: "S", beh: "被動", race: "黑暗妖精", e: "none", hp: 330, ac: -20, mr: 40, exp: 1090, goldMin: 50, goldMax: 400, atkSpd: 1, dmg: [2, 29], db: 2, hit: 15 },
        "dark_spirit_caller": { n: "黑暗精靈使", lv: 45, s: "S", beh: "被動", race: "黑暗妖精", e: "earth", hp: 550, ac: -38, mr: 45, exp: 2026, goldMin: 50, goldMax: 400, atkSpd: 2, dmg: [2, 45], db: 22, hit: 25, mag: { skn: "邪靈之氣", type: "stat_debuff", cd: 70, acUp: 10, erDown: 10, dur: 6 }, mag2: { skn: "召喚闇之精靈", cd: 30, dmg: [3, 45], db: 48, ele: "none", alwaysHit: true } },
        // ===== 拉斯塔巴德正門：黑暗妖精守軍（主動）=====
        "de_gate_xbow": { n: "黑暗妖精警衛(十字弓)", lv: 36, s: "S", beh: "主動", race: "黑暗妖精", e: "none", hp: 240, ac: -20, mr: 10, exp: 1297, goldMin: 118, goldMax: 198, atkSpd: 2, dmg: [2, 36], db: 18, hit: 18 },
        "de_gate_apprentice": { n: "黑暗妖精魔法學徒", lv: 26, s: "S", beh: "主動", race: "黑暗妖精", e: "none", hp: 180, ac: -8, mr: 75, exp: 2026, goldMin: 120, goldMax: 200, atkSpd: 2, dmg: [2, 21], db: 11, hit: 11, mag: { skn: "冰錐", cd: 50, dmg: [2, 26], db: 40, ele: "water", alwaysHit: true } },
        "de_gate_spear": { n: "黑暗妖精警衛(矛)", lv: 40, s: "S", beh: "主動", race: "黑暗妖精", e: "none", hp: 800, ac: -23, mr: 30, exp: 1601, goldMin: 153, goldMax: 254, atkSpd: 2, dmg: [2, 40], db: 40, hit: 28 },
        "de_gate_patrol": { n: "黑暗妖精巡守", lv: 38, s: "S", beh: "主動", race: "黑暗妖精", e: "none", hp: 500, ac: -20, mr: 40, exp: 1445, goldMin: 241, goldMax: 390, atkSpd: 1, dmg: [1, 38], db: 19, hit: 28 },
        "de_gate_soldier": { n: "黑暗妖精士兵", lv: 38, s: "S", beh: "主動", race: "黑暗妖精", e: "none", hp: 500, ac: -28, mr: 35, exp: 1445, goldMin: 241, goldMax: 390, atkSpd: 2, dmg: [2, 38], db: 41, hit: 28 },
        "de_gate_general": { n: "黑暗妖精將軍", lv: 43, s: "S", beh: "主動", race: "黑暗妖精", e: "none", hp: 900, ac: -40, mr: 45, exp: 1850, goldMin: 50, goldMax: 400, atkSpd: 2, dmg: [2, 43], db: 60, hit: 29 },
        // ===== 魔獸訓練場 =====
        "de_train_blacktiger": { n: "黑虎", lv: 40, s: "S", beh: "主動", race: "野獸", e: "fire", hp: 600, ac: -37, mr: 45, exp: 1601, goldMin: 10, goldMax: 100, atkSpd: 1, dmg: [1, 40], db: 38, hit: 26, tamedByAura: true },
        "de_train_tamer": { n: "拉斯塔巴德馴獸師", lv: 42, s: "S", beh: "主動", race: "拉斯塔巴德", e: "fire", hp: 378, ac: -37, mr: 65, exp: 1765, goldMin: 10, goldMax: 200, atkSpd: 2, dmg: [2, 42], db: 40, hit: 20, tamerAura: true },
        "de_train_cursetamer": { n: "受詛咒的馴獸師", lv: 43, s: "S", beh: "主動", race: "拉斯塔巴德", e: "fire", hp: 728, ac: -39, mr: 65, exp: 1850, goldMin: 110, goldMax: 300, atkSpd: 1, dmg: [1, 42], db: 20, hit: 30, tamerAura: true },
        "de_train_hellhound": { n: "地獄束縛犬", lv: 40, s: "S", beh: "主動", race: "惡魔", e: "earth", hp: 657, ac: -40, mr: 0, exp: 1601, goldMin: 110, goldMax: 300, atkSpd: 1, dmg: [1, 39], db: 20, hit: 20, tamedByAura: true, mag: { skn: "火焰噴吐", cd: 70, dmg: [4, 30], db: 28, ele: "fire", alwaysHit: true } },
        "de_train_soulknight": { n: "魂騎士", lv: 41, s: "S", beh: "主動", race: "拉斯塔巴德", e: "earth", hp: 1080, ac: -43, mr: 50, exp: 1682, goldMin: 110, goldMax: 300, atkSpd: 1, dmg: [1, 41], db: 25, hit: 24, mag: { skn: "地面震裂", cd: 70, dmg: [3, 40], db: 18, ele: "earth", alwaysHit: true } },
        "de_train_hellslave": { n: "地獄奴隸", lv: 43, s: "S", beh: "主動", race: "拉斯塔巴德", e: "earth", hp: 962, ac: -41, mr: 45, exp: 1850, goldMin: 110, goldMax: 300, atkSpd: 1, dmg: [1, 43], db: 30, hit: 25 },
        "de_train_summoner": { n: "喚獸師", lv: 30, s: "S", beh: "主動", race: "拉斯塔巴德", e: "earth", hp: 600, ac: -28, mr: 35, exp: 962, goldMin: 10, goldMax: 200, atkSpd: 2, dmg: [2, 32], db: 20, hit: 15 },
        "de_train_gatekeeper": { n: "拉斯塔巴德守門人", lv: 40, s: "S", beh: "主動", race: "黑暗妖精", e: "none", hp: 800, ac: -27, mr: 30, exp: 1601, goldMin: 110, goldMax: 400, atkSpd: 1.5, dmg: [2, 40], db: 15, hit: 25 },
        // ===== 魔獸軍王之室（純BOSS房，需軍王的鑰匙入場） =====
        "de_king_baranka": { n: "魔獸軍王巴蘭卡", lv: 63, s: "L", beh: "被動", race: "拉斯塔巴德", e: "water", boss: true, hard: true, hp: 17290, ac: -58, mr: 65, exp: 3970, goldMin: 1250, goldMax: 4000, atkSpd: 0.5, dmg: [3, 63], db: 63, hit: 63 },
        // ===== 黑魔法研究室 =====
        "de_lab_earth": { n: "地元素守護者", lv: 42, s: "S", beh: "主動", race: "元素", elem: true, e: "earth", hp: 725, ac: -37, mr: 60, exp: 1765, goldMin: 100, goldMax: 300, atkSpd: 3, dmg: [3, 39], db: 75, hit: 27 },
        "de_lab_water": { n: "水元素守護者", lv: 42, s: "S", beh: "主動", race: "元素", elem: true, e: "water", hp: 725, ac: -37, mr: 60, exp: 1765, goldMin: 100, goldMax: 300, atkSpd: 3, dmg: [3, 39], db: 75, hit: 27 },
        "de_lab_wind":  { n: "風元素守護者", lv: 42, s: "S", beh: "主動", race: "元素", elem: true, e: "wind",  hp: 725, ac: -37, mr: 60, exp: 1765, goldMin: 100, goldMax: 300, atkSpd: 3, dmg: [3, 39], db: 75, hit: 27 },
        "de_lab_fire":  { n: "火元素守護者", lv: 42, s: "S", beh: "主動", race: "元素", elem: true, e: "fire",  hp: 725, ac: -37, mr: 60, exp: 1765, goldMin: 100, goldMax: 300, atkSpd: 3, dmg: [3, 39], db: 75, hit: 27 },
        "de_lab_mage":  { n: "黑暗妖精法師", lv: 40, s: "S", beh: "主動", race: "黑暗妖精", e: "none", hp: 500, ac: -32, mr: 70, exp: 1601, goldMin: 10, goldMax: 100, atkSpd: 2, dmg: [2, 39], db: 5, hit: 20, mag: { skn: "冰錐", cd: 70, dmg: [4, 30], db: 28, ele: "water", alwaysHit: true }, mag2: { skn: "龍捲風", cd: 90, chance: 0.5, dmg: [4, 30], db: 40, ele: "wind", alwaysHit: true } },
        "de_lab_blackmage": { n: "黑法師", lv: 32, s: "S", beh: "主動", race: "黑暗妖精", e: "none", hp: 380, ac: -22, mr: 25, exp: 1025, goldMin: 120, goldMax: 200, atkSpd: 2, dmg: [2, 21], db: 18, hit: 13, mag: { skn: "極寒冰錐", cd: 60, dmg: [3, 26], db: 40, ele: "water", alwaysHit: true, sec: { type: "freeze", pbase: 100 } } },   // 🔧 極寒冰錐：必中、3D26+40水魔法，freeze pbase100 → (100-MR)/2% 機率冰凍6秒
        // ===== 冥法軍訓練場 =====
        "de_necro_avenger":    { n: "黑暗復仇者", lv: 45, s: "S", beh: "主動", race: "拉斯塔巴德", e: "earth", hard: true, hp: 1056, ac: -52, mr: 55, exp: 2026, goldMin: 100, goldMax: 300, atkSpd: 1, dmg: [1, 45], db: 39, hit: 29 },
        "de_necro_warlock":    { n: "血色術士", lv: 46, s: "S", beh: "主動", race: "拉斯塔巴德", e: "earth", hard: true, hp: 1198, ac: -54, mr: 70, exp: 2117, goldMin: 110, goldMax: 300, atkSpd: 2, dmg: [2, 46], db: 25, hit: 24, mag: { skn: "黑霧", cd: 50, dmg: [4, 46], db: 35, ele: "none", alwaysHit: true } },
        "de_necro_omwarrior":  { n: "歐姆戰士", lv: 45, s: "S", beh: "主動", race: "歐姆", e: "earth", hard: true, hp: 828, ac: -50, mr: 40, exp: 2026, goldMin: 200, goldMax: 300, atkSpd: 2, dmg: [2, 40], db: 32, hit: 26 },
        "de_necro_darklord":   { n: "闇黑君王", lv: 47, s: "S", beh: "主動", race: "拉斯塔巴德", e: "earth", hard: true, hp: 1274, ac: -55, mr: 75, exp: 2210, goldMin: 110, goldMax: 300, atkSpd: 2, dmg: [2, 46], db: 27, hit: 24, mag: { skn: "火焰氣息", cd: 70, chance: 0.5, dmg: [5, 46], db: 35, ele: "fire", alwaysHit: true } },
        "de_necro_bloodknight":{ n: "血騎士", lv: 47, s: "S", beh: "主動", race: "拉斯塔巴德", un: true, e: "earth", hp: 1274, ac: -55, mr: 65, exp: 2210, goldMin: 200, goldMax: 500, atkSpd: 1.5, dmg: [2, 30], db: 47, hit: 30, mag: { skn: "迴旋斬", cd: 50, chance: 0.4, dmg: [2, 30], db: 47, ele: "none", alwaysHit: true } },
        "de_necro_omheavy":    { n: "重裝歐姆戰士", lv: 48, s: "L", beh: "主動", race: "歐姆", e: "earth", hard: true, hp: 998, ac: -54, mr: 40, exp: 2305, goldMin: 200, goldMax: 500, atkSpd: 2, dmg: [2, 41], db: 52, hit: 28 },
        // ===== 🏛️ 格蘭肯神殿．長老之室（拉斯塔巴德新狩獵地圖）：3 一般怪 + 8 長老 BOSS（掉落待新物品建立後補；BOSS 出場節流另行實作） =====
        "de_elder_guard":     { n: "拉斯塔巴德近衛隊", lv: 48, s: "S", beh: "主動", race: "拉斯塔巴德", e: "none", hp: 500, ac: -40, mr: 30, exp: 2305, goldMin: 200, goldMax: 400, atkSpd: 3, dmg: [3, 48], db: 100, hit: 22 },
        "de_elder_captain":   { n: "拉斯塔巴德近衛隊隊長", lv: 54, s: "S", beh: "主動", race: "拉斯塔巴德", e: "fire", hp: 3500, ac: -63, mr: 60, exp: 2917, goldMin: 300, goldMax: 600, atkSpd: 1, dmg: [1, 60], db: 40, hit: 28, mag: { skn: "放射斬", cd: 90, chance: 0.5, dmg: [2, 60], db: 80, ele: "none", alwaysHit: true } },
        "de_elder_follower":  { n: "長老隨從", lv: 51, s: "S", beh: "主動", race: "拉斯塔巴德", e: "earth", hp: 1500, ac: -49, mr: 60, exp: 2602, goldMin: 300, goldMax: 600, atkSpd: 2, dmg: [2, 51], db: 70, hit: 20, mag: { skn: "光球．闇", cd: 130, dmg: [2, 51], db: 140, ele: "none", alwaysHit: true } },
        "de_elder_kina":   { n: "長老．琪娜", lv: 78, s: "L", beh: "主動", race: "拉斯塔巴德", e: "none", boss: true, hard: true, hp: 16200, ac: -81, mr: 75, exp: 9612, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [4, 78], db: 160, hit: 70, mag: { skn: "迴旋鞭打", cd: 50, chance: 0.5, dmg: [4, 78], db: 230, ele: "none", alwaysHit: true }, mag2: { skn: "光球．闇", cd: 110, chance: 0.6, dmg: [4, 178], db: 100, ele: "none", alwaysHit: true } },
        "de_elder_andis":  { n: "長老．安迪斯", lv: 91, s: "L", beh: "主動", race: "拉斯塔巴德", e: "none", boss: true, hard: true, hp: 22426, ac: -98, mr: 88, exp: 13326, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [2, 182], db: 190, hit: 89, mag: { skn: "衝擊波動", cd: 70, chance: 0.5, dmg: [5, 150], db: 150, ele: "wind", alwaysHit: true } },
        "de_elder_batas":  { n: "長老．巴塔斯", lv: 85, s: "L", beh: "主動", race: "拉斯塔巴德", e: "none", boss: true, hard: true, hp: 18600, ac: -86, mr: 63, exp: 11562, goldMin: 0, goldMax: 0, atkSpd: 1, dmg: [1, 170], db: 110, hit: 81, mag: { skn: "千刃破軍", cd: 90, chance: 0.5, dmg: [6, 120], db: 120, ele: "wind", alwaysHit: true } },
        "de_elder_balos":  { n: "長老．巴洛斯", lv: 88, s: "L", beh: "主動", race: "拉斯塔巴德", e: "none", boss: true, hard: true, hp: 19997, ac: -89, mr: 85, exp: 12252, goldMin: 0, goldMax: 0, atkSpd: 3, dmg: [2, 230], db: 230, hit: 85, mag: { skn: "闇黑波動", cd: 90, chance: 0.5, dmg: [1, 800], db: 100, ele: "none", alwaysHit: true }, mag2: { skn: "靈魂波動", cd: 40, dmg: [1, 400], db: 0, ele: "none", alwaysHit: true } },
        "de_elder_balud":  { n: "長老．巴陸德", lv: 96, s: "L", beh: "主動", race: "拉斯塔巴德", e: "none", boss: true, hard: true, hp: 23626, ac: -98, mr: 100, exp: 14826, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [2, 200], db: 200, hit: 96, mag: { skn: "光球", cd: 90, chance: 0.5, dmg: [1, 800], db: 200, ele: "none", alwaysHit: true }, mag2: { skn: "靈魂波動", cd: 40, dmg: [1, 500], db: 0, ele: "none", alwaysHit: true } },
        "de_elder_ramas":  { n: "長老．拉曼斯", lv: 93, s: "L", beh: "主動", race: "拉斯塔巴德", e: "none", boss: true, hard: true, hp: 22382, ac: -98, mr: 81, exp: 13692, goldMin: 0, goldMax: 0, atkSpd: 1, dmg: [1, 196], db: 125, hit: 96, mag: { skn: "火焰爆發", cd: 110, chance: 0.5, dmg: [1, 900], db: 100, ele: "fire", alwaysHit: true } },
        "de_elder_taimas": { n: "長老．泰瑪斯", lv: 90, s: "L", beh: "主動", race: "拉斯塔巴德", e: "none", boss: true, hard: true, hp: 21773, ac: -94, mr: 89, exp: 12962, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [2, 180], db: 170, hit: 88, mag: { skn: "黑暗流星雨", cd: 110, chance: 0.4, dmg: [1, 1000], db: 200, ele: "fire", alwaysHit: true } },
        "de_elder_adiel":  { n: "長老．艾迪爾", lv: 80, s: "L", beh: "主動", race: "拉斯塔巴德", e: "none", boss: true, hard: true, hp: 17746, ac: -85, mr: 75, exp: 10242, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [2, 160], db: 140, hit: 77, mag: { skn: "光球．闇", cd: 110, chance: 0.5, dmg: [4, 160], db: 100, ele: "none", alwaysHit: true } },
        // ===== 軍王之室 BOSS（法令／冥法／暗殺） =====
        "de_king_laia":   { n: "法令軍王蕾雅", lv: 65, s: "S", beh: "被動", race: "拉斯塔巴德", e: "earth", boss: true, hard: true, hp: 15070, ac: -57, mr: 80, exp: 4226, goldMin: 1250, goldMax: 4000, atkSpd: 2, dmg: [4, 63], db: 103, hit: 58, mag: { skn: "冰裂術", cd: 50, chance: 0.5, dmg: [8, 30], db: 128, ele: "water", alwaysHit: true, ext_freeze: 200, extUnfreeze: true, sec: { type: "freeze", pbase: 200 } }, mag2: { skn: "高級治癒術", cd: 130, chance: 0.7, type: "heal_allies", healDice: [2, 200] } },
        "de_king_heruby": { n: "冥法軍王海露拜", lv: 70, s: "L", beh: "被動", race: "拉斯塔巴德", e: "earth", boss: true, hard: true, hp: 22672, ac: -78, mr: 85, exp: 4901, goldMin: 2250, goldMax: 5000, atkSpd: 2, dmg: [6, 63], db: 103, hit: 62, mag: { skn: "流星雨", cd: 110, dmg: [8, 50], db: 128, ele: "fire", alwaysHit: true }, mag2: { skn: "黑暗流星雨", cd: 130, chance: 0.5, dmg: [10, 100], db: 250, ele: "none", alwaysHit: true } },
        "de_king_slayer": { n: "暗殺軍王史雷佛", lv: 61, s: "L", beh: "被動", race: "拉斯塔巴德", e: "none", boss: true, hard: true, hp: 16202, ac: -71, mr: 75, exp: 3722, goldMin: 1250, goldMax: 4000, atkSpd: 1, dmg: [4, 63], db: 103, hit: 61, mag: { skn: "放射斬", cd: 50, chance: 0.2, dmg: [4, 100], db: 250, ele: "none", alwaysHit: true } },
        // ===== 🗼 傲慢之塔 怪物 =====
        "pride_stairs":     { n: "往上層的樓梯", lv: 1, s: "L", beh: "被動", race: "建築", boss: true, noAutoTeleport: true, e: "none", hp: 1, ac: 10, mr: 0, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 60, dmg: [1, 1], db: 0, hit: 0 },   // 🗼 攀登用：擊敗即前往上一層（不會攻擊；不觸發自動瞬移）
        "pride_lamia":      { n: "變種蛇女", lv: 32, s: "L", beh: "主動", race: "蛇女", e: "water", hp: 330, ac: -10, mr: 15, exp: 1025, goldMin: 163, goldMax: 265, atkSpd: 2, dmg: [2, 32], db: 32, hit: 16 },
        "pride_ungoliant":  { n: "變種楊果里恩", lv: 33, s: "L", beh: "主動", race: "蜘蛛", e: "earth", hp: 370, ac: -13, mr: 20, exp: 1090, goldMin: 162, goldMax: 266, atkSpd: 1, dmg: [1, 33], db: 20, hit: 20, mag: { skn: "烈毒", cd: 50, type: "poison", pbase: 150, d: 30, tick: 5, dur: 20 } },
        "pride_medusa":     { n: "梅杜莎", lv: 36, s: "S", beh: "主動", race: "梅杜莎", e: "none", hp: 420, ac: -16, mr: 50, exp: 1297, goldMin: 171, goldMax: 280, atkSpd: 2, dmg: [2, 36], db: 36, hit: 18, mag: { skn: "木乃伊的詛咒", cd: 70, type: "stone", pbase: 150 } },
        "pride_chimera":    { n: "奇美拉", lv: 39, s: "S", beh: "主動", race: "奇美拉", e: "none", hp: 550, ac: -25, mr: 35, exp: 1522, goldMin: 171, goldMax: 280, atkSpd: 2, dmg: [2, 39], db: 39, hit: 19, mag: { skn: "烈毒", cd: 50, type: "poison", pbase: 150, d: 30, tick: 5, dur: 20 } },
        "pride_jenis":      { n: "扭曲的潔尼斯女王", lv: 60, s: "L", beh: "主動", race: "惡魔", boss: true, hard: true, e: "none", hp: 15000, ac: -50, mr: 70, exp: 3601, goldMin: 5000, goldMax: 10000, atkSpd: 2, dmg: [2, 120], db: 60, hit: 60, mag: { skn: "劇毒", cd: 50, type: "poison", pbase: 200, d: 50, tick: 3, dur: 18 }, mag2: { skn: "麻痺蜘蛛網", cd: 70, chance: 0.3, type: "paralyze", pbase: 150 }, mag3: { skn: "劇毒龍捲風", cd: 130, chance: 0.3, type: "poison", pbase: 200, d: 80, tick: 3, dur: 18 } },
        // ----- 傲慢之塔 11~20 樓 -----
        "pride_wolf":       { n: "魔狼", lv: 40, s: "L", beh: "主動", race: "魔狼", e: "fire", hp: 600, ac: -30, mr: 35, exp: 1601, goldMin: 161, goldMax: 264, atkSpd: 1, dmg: [1, 45], db: 22, hit: 21 },
        "pride_mimic":      { n: "邪惡密密", lv: 38, s: "S", beh: "主動", race: "魔法生物", hard: true, e: "none", hp: 500, ac: -2, mr: 40, exp: 1445, goldMin: 155, goldMax: 253, atkSpd: 1.5, dmg: [1, 80], db: 12, hit: 20 },
        "pride_beholder":   { n: "邪惡多眼怪", lv: 39, s: "L", beh: "主動", race: "眼魔", e: "wind", hp: 540, ac: -20, mr: 55, exp: 1522, goldMin: 158, goldMax: 260, atkSpd: 2, dmg: [2, 39], db: 39, hit: 19, mag: { skn: "木乃伊的詛咒", cd: 70, type: "stone", pbase: 150 } },
        "pride_deathsword": { n: "死亡之劍", lv: 37, s: "S", beh: "主動", race: "魔法生物", e: "water", hp: 380, ac: -43, mr: 40, exp: 1370, goldMin: 153, goldMax: 244, atkSpd: 1, dmg: [1, 51], db: 37, hit: 22 },
        "pride_phantom_boss": { n: "不幸的幻象眼魔", lv: 60, s: "S", beh: "主動", race: "眼魔", boss: true, hard: true, e: "none", hp: 16000, ac: -53, mr: 75, exp: 3601, goldMin: 5000, goldMax: 10000, atkSpd: 2, dmg: [2, 120], db: 60, hit: 60, mag: { skn: "木乃伊的詛咒", cd: 70, type: "stone", pbase: 200 }, mag2: { skn: "幻象光線", cd: 50, chance: 0.3, dmg: [8, 40], db: 143, ele: "none", alwaysHit: true }, mag3: { skn: "集體相消", cd: 130, chance: 0.3, type: "dispel" } },
        // ----- 傲慢之塔 21~30 樓 -----
        "pride_fireegg":    { n: "恐怖的火炎蛋", lv: 37, s: "S", beh: "主動", race: "元素", e: "none", hp: 500, ac: -36, mr: 40, exp: 1370, goldMin: 153, goldMax: 244, atkSpd: 2, dmg: [2, 37], db: 19, hit: 19 },
        "pride_nightmare":  { n: "恐怖夢魘", lv: 40, s: "L", beh: "主動", race: "惡魔", e: "none", hp: 450, ac: -42, mr: 80, exp: 1601, goldMin: 161, goldMax: 264, atkSpd: 1.5, dmg: [1, 60], db: 20, hit: 21 },
        "pride_hellhound":  { n: "恐怖的地獄犬", lv: 43, s: "S", beh: "主動", race: "惡魔", e: "none", hp: 350, ac: -35, mr: 25, exp: 1850, goldMin: 168, goldMax: 274, atkSpd: 2, dmg: [2, 43], db: 22, hit: 21, mag: { skn: "火焰噴吐", cd: 70, dmg: [4, 40], db: 43, ele: "fire", alwaysHit: true } },
        "pride_imp":        { n: "小惡魔", lv: 44, s: "S", beh: "主動", race: "惡魔", e: "earth", hp: 420, ac: -38, mr: 80, exp: 1937, goldMin: 168, goldMax: 274, atkSpd: 2, dmg: [2, 83], db: 1, hit: 21, mag: { skn: "火焰之陣", cd: 70, dmg: [4, 60], db: 13, ele: "fire", alwaysHit: true } },
        "pride_ifrit":      { n: "恐怖的伊弗利特", lv: 46, s: "L", beh: "主動", race: "惡魔", e: "fire", hp: 1100, ac: -28, mr: 40, exp: 2117, goldMin: 182, goldMax: 293, atkSpd: 1.5, dmg: [1, 83], db: 23, hit: 26, mag: { skn: "火之矛", cd: 70, dmg: [2, 46], db: 83, ele: "fire", alwaysHit: true } },
        "pride_vampire_boss": { n: "恐怖的吸血鬼", lv: 60, s: "S", beh: "主動", race: "吸血鬼", boss: true, hard: true, e: "earth", hp: 15000, ac: -53, mr: 85, exp: 3601, goldMin: 5000, goldMax: 10000, atkSpd: 2, dmg: [2, 150], db: 50, hit: 61, mag: { skn: "吸血鬼之吻", cd: 70, chance: 0.4, dmg: [8, 30], db: 60, ele: "none", alwaysHit: true, vampFull: true }, mag2: { skn: "夜魔飛襲", cd: 150, dmg: [1, 400], db: 243, ele: "none", alwaysHit: true }, mag3: { skn: "血夜月彎刀", cd: 130, chance: 0.2, dmg: [1, 100], db: 143, ele: "none", alwaysHit: true, sec: { type: "bleed", d: 50, tick: 3, dur: 18, pbase: 200 } } },
        // ----- 傲慢之塔 31~40 樓 -----
        "pride_skel_axe":    { n: "殘暴的骷髏斧兵", lv: 39, s: "S", beh: "主動", race: "不死", un: true, e: "none", hp: 500, ac: -30, mr: 25, exp: 1522, goldMin: 161, goldMax: 264, atkSpd: 1, dmg: [1, 39], db: 22, hit: 20 },
        "pride_ghoul2":      { n: "殘暴的食屍鬼", lv: 42, s: "S", beh: "主動", race: "不死", un: true, e: "none", hp: 550, ac: -35, mr: 45, exp: 1764, goldMin: 168, goldMax: 274, atkSpd: 2, dmg: [2, 42], db: 51, hit: 23 },
        "pride_skel_spear":  { n: "殘暴的骷髏槍兵", lv: 39, s: "S", beh: "主動", race: "不死", un: true, e: "none", hp: 450, ac: -30, mr: 35, exp: 1522, goldMin: 161, goldMax: 264, atkSpd: 1.5, dmg: [1, 55], db: 26, hit: 26 },
        "pride_sparto":      { n: "殘暴的史巴托", lv: 42, s: "S", beh: "主動", race: "不死", un: true, e: "none", hp: 550, ac: -38, mr: 40, exp: 1764, goldMin: 168, goldMax: 274, atkSpd: 2, dmg: [2, 42], db: 30, hit: 23 },
        "pride_skel_archer": { n: "殘暴的骷髏神射手", lv: 45, s: "S", beh: "主動", race: "不死", un: true, e: "none", hp: 650, ac: -38, mr: 45, exp: 2026, goldMin: 182, goldMax: 288, atkSpd: 1, dmg: [1, 60], db: 20, hit: 29 },
        "pride_skel_fighter":{ n: "殘暴的骷髏鬥士", lv: 45, s: "S", beh: "主動", race: "不死", un: true, e: "none", hp: 700, ac: -40, mr: 45, exp: 2026, goldMin: 182, goldMax: 288, atkSpd: 2, dmg: [2, 60], db: 25, hit: 23 },
        "pride_zombie_king": { n: "死亡的殭屍王", lv: 62, s: "L", beh: "主動", race: "殭屍", boss: true, hard: true, e: "none", hp: 18000, ac: -58, mr: 50, exp: 3845, goldMin: 10000, goldMax: 20000, atkSpd: 3, dmg: [3, 150], db: 50, hit: 58, mag: { skn: "邪靈之氣", cd: 70, chance: 0.5, dmg: [6, 50], db: 160, ele: "none", alwaysHit: true }, mag2: { skn: "腐蝕之血", cd: 130, chance: 0.5, dmg: [1, 100], db: 153, ele: "none", alwaysHit: true, sec: { type: "poison", d: 50, tick: 3, dur: 18, pbase: 200 } } },
        // ----- 傲慢之塔 41~50 樓 -----
        "pride_drake":       { n: "幼龍", lv: 45, s: "L", beh: "主動", race: "龍", hard: true, e: "none", hp: 800, ac: -45, mr: 80, exp: 2026, goldMin: 180, goldMax: 305, atkSpd: 2, dmg: [2, 45], db: 32, hit: 25, mag: { skn: "火焰噴吐", cd: 70, chance: 0.7, dmg: [4, 60], db: 63, ele: "fire", alwaysHit: true } },
        "pride_flamesoul_r": { n: "火焰之靈魂(紅)", lv: 45, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 500, ac: -45, mr: 45, exp: 2026, goldMin: 180, goldMax: 305, atkSpd: 2, dmg: [2, 46], db: 22, hit: 22 },
        "pride_flamesoul_b": { n: "火焰之靈魂(藍)", lv: 46, s: "S", beh: "主動", race: "不死", un: true, e: "none", hp: 500, ac: -48, mr: 45, exp: 2117, goldMin: 182, goldMax: 294, atkSpd: 2, dmg: [2, 50], db: 22, hit: 23 },
        "pride_irongolem":   { n: "恐怖的鋼鐵高崙", lv: 44, s: "L", beh: "主動", race: "高崙", hard: true, e: "none", hp: 800, ac: -37, mr: 35, exp: 1937, goldMin: 152, goldMax: 335, atkSpd: 3, dmg: [2, 100], db: 12, hit: 21 },
        "pride_flamemage":   { n: "火焰之魔法師", lv: 44, s: "S", beh: "主動", race: "長老", e: "fire", hp: 450, ac: -32, mr: 90, exp: 1937, goldMin: 144, goldMax: 285, atkSpd: 2, dmg: [2, 45], db: 32, hit: 25, mag: { skn: "燃燒的火球", cd: 50, chance: 0.5, dmg: [3, 60], db: 63, ele: "fire", alwaysHit: true } },
        "pride_bonedragon":  { n: "骨龍", lv: 47, s: "L", beh: "主動", race: "龍", hard: true, e: "none", hp: 720, ac: -48, mr: 90, exp: 2210, goldMin: 224, goldMax: 368, atkSpd: 2, dmg: [2, 47], db: 45, hit: 26, mag: { skn: "寒冰噴吐", cd: 50, chance: 0.7, dmg: [4, 60], db: 73, ele: "none", alwaysHit: true } },
        "pride_panther_boss": { n: "地獄的黑豹", lv: 65, s: "L", beh: "主動", race: "野獸", boss: true, hard: true, e: "none", hp: 20000, ac: -65, mr: 75, exp: 4226, goldMin: 10000, goldMax: 20000, atkSpd: 1, dmg: [1, 165], db: 30, hit: 63, mag: { skn: "衝擊之暈", cd: 70, chance: 0.2, dmg: [4, 50], db: 160, ele: "none", alwaysHit: true, sec: { type: "stun", pbase: 250 } }, mag2: { skn: "沉睡打擊", cd: 70, chance: 0.2, dmg: [2, 100], db: 153, ele: "none", alwaysHit: true, sec: { type: "sleep", pbase: 250 } } },
        // ----- 傲慢之塔 51~60 樓 -----
        "pride_curse_zombie":  { n: "受詛咒的妖魔殭屍", lv: 42, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 800, ac: -60, mr: 25, exp: 1765, goldMin: 185, goldMax: 221, atkSpd: 2, dmg: [2, 44], db: 23, hit: 23, mag: { skn: "烈毒", cd: 50, type: "poison", pbase: 150, d: 30, tick: 5, dur: 20 } },
        "pride_curse_soldier": { n: "受詛咒的艾爾摩士兵", lv: 47, s: "S", beh: "主動", race: "不死", un: true, e: "none", hp: 700, ac: -61, mr: 30, exp: 2210, goldMin: 210, goldMax: 305, atkSpd: 2, dmg: [2, 54], db: 33, hit: 26 },
        "pride_curse_mage":    { n: "受詛咒的艾爾摩法師", lv: 45, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 300, ac: -62, mr: 90, exp: 2026, goldMin: 185, goldMax: 221, atkSpd: 3, dmg: [2, 64], db: 13, hit: 22, mag: { skn: "冰錐", cd: 30, dmg: [2, 60], db: 42, ele: "water", alwaysHit: true }, mag2: { skn: "冰矛圍籬", cd: 50, chance: 0.4, dmg: [5, 50], db: 30, ele: "water", alwaysHit: true, sec: { type: "freeze", pbase: 150 } } },
        "pride_curse_general": { n: "受詛咒的艾爾摩將軍", lv: 50, s: "S", beh: "主動", race: "不死", un: true, e: "none", hp: 750, ac: -63, mr: 40, exp: 2501, goldMin: 254, goldMax: 335, atkSpd: 3, dmg: [2, 154], db: 13, hit: 25 },
        "pride_mummy_king":    { n: "不死的木乃伊王", lv: 65, s: "L", beh: "主動", race: "殭屍", boss: true, hard: true, e: "none", hp: 15000, ac: -60, mr: 99, exp: 4226, goldMin: 10000, goldMax: 20000, atkSpd: 1, dmg: [1, 105], db: 65, hit: 65, mag: { skn: "巨石爆裂", cd: 70, chance: 0.25, dmg: [6, 50], db: 160, ele: "none", alwaysHit: true, sec: { type: "stun", pbase: 150 } }, mag2: { skn: "地面障礙", cd: 120, type: "slowatk", pbase: 250, dur: 8 }, mag3: { skn: "鋼鐵防護", type: "self_buff", buffKind: "acguard", cd: 150, chance: 0.5, acDown: 7, dur: 30 } },
        // ----- 傲慢之塔 61~70 樓 -----
        "pride_dark_lycan":  { n: "暗黑萊肯", lv: 44, s: "S", beh: "主動", race: "狼人", isWolf: true, e: "wind", hp: 750, ac: -64, mr: 45, exp: 1937, goldMin: 185, goldMax: 333, atkSpd: 1.5, dmg: [2, 44], db: 13, hit: 23 },
        "pride_ice_tiger":   { n: "冷酷冰原老虎", lv: 48, s: "L", beh: "主動", race: "野獸", e: "none", hp: 850, ac: -64, mr: 20, exp: 2305, goldMin: 198, goldMax: 320, atkSpd: 1, dmg: [1, 90], db: 3, hit: 25 },
        "pride_flame_beast": { n: "火焰烈炎獸", lv: 46, s: "L", beh: "主動", race: "惡魔", e: "fire", hp: 830, ac: -65, mr: 55, exp: 2117, goldMin: 255, goldMax: 422, atkSpd: 2, dmg: [2, 53], db: 23, hit: 24, mag: { skn: "火焰噴吐", cd: 30, dmg: [2, 46], db: 46, ele: "fire", alwaysHit: true } },
        "pride_flame_atki":  { n: "火焰阿西塔基奧", lv: 51, s: "L", beh: "主動", race: "阿西塔基奧", e: "fire", hp: 900, ac: -65, mr: 50, exp: 2602, goldMin: 285, goldMax: 411, atkSpd: 2, dmg: [2, 60], db: 28, hit: 26 },
        "pride_iris_boss":   { n: "冷酷的艾莉絲", lv: 65, s: "L", beh: "主動", race: "惡魔", boss: true, hard: true, e: "none", hp: 20000, ac: -75, mr: 99, exp: 4226, goldMin: 10000, goldMax: 20000, atkSpd: 0.5, dmg: [1, 65], db: 65, hit: 66, mag: { skn: "集體衝暈", cd: 70, chance: 0.15, dmg: [2, 50], db: 163, ele: "none", alwaysHit: true, sec: { type: "stun", pbase: 200 } }, mag2: { skn: "水氣爆裂", cd: 120, dmg: [3, 200], db: 63, ele: "water", alwaysHit: true }, mag3: { skn: "冰錐流星雨", cd: 110, chance: 0.15, dmg: [5, 200], db: 63, ele: "water", alwaysHit: true } },
        // ----- 傲慢之塔 71~80 樓 -----
        "pride_dark_blackknight":    { n: "暗黑黑騎士", lv: 45, s: "S", beh: "主動", race: "黑騎士", hard: true, e: "none", hp: 900, ac: -67, mr: 65, exp: 2026, goldMin: 285, goldMax: 356, atkSpd: 1.5, dmg: [2, 45], db: 11, hit: 22 },
        "pride_dark_flamewarrior":   { n: "暗黑火焰戰士", lv: 50, s: "S", beh: "主動", race: "亞人", e: "fire", hp: 950, ac: -64, mr: 30, exp: 2501, goldMin: 233, goldMax: 386, atkSpd: 2, dmg: [2, 50], db: 41, hit: 25 },
        "pride_dark_flamearcher":    { n: "暗黑火焰弓箭手", lv: 48, s: "S", beh: "主動", race: "亞人", e: "none", hp: 800, ac: -58, mr: 45, exp: 2305, goldMin: 221, goldMax: 354, atkSpd: 1, dmg: [1, 50], db: 19, hit: 29 },
        "pride_dark_succubus_queen": { n: "暗黑思克巴女皇", lv: 53, s: "S", beh: "主動", race: "思克巴", e: "none", hp: 1800, ac: -70, mr: 80, exp: 2810, goldMin: 288, goldMax: 415, atkSpd: 1.8, dmg: [2, 43], db: 70, hit: 38, mag: { skn: "吸血鬼之吻", cd: 80, dmg: [2, 33], db: 61, ele: "none", alwaysHit: true, vamp: [1, 53] } },
        "pride_vander_boss":         { n: "闇黑的騎士范德", lv: 75, s: "L", beh: "主動", race: "亞人", boss: true, hard: true, e: "none", hp: 20000, ac: -70, mr: 80, exp: 5626, goldMin: 10000, goldMax: 20000, atkSpd: 1, dmg: [2, 75], db: 95, hit: 66, mag: { skn: "單刀斬", type: "extra_attack", cd: 50, chance: 0.2 }, mag2: { skn: "雙刀斬", type: "multi_attack", cd: 70, times: 2 }, mag3: { skn: "闇黑波動", cd: 110, chance: 0.2, dmg: [3, 200], db: 187, ele: "none", alwaysHit: true } },
        // ----- 傲慢之塔 81~90 樓 -----
        "pride_proud_jenis":        { n: "傲慢的潔尼斯女王", lv: 53, s: "L", beh: "主動", race: "惡魔", e: "none", hp: 1800, ac: -65, mr: 100, exp: 2810, goldMin: 432, goldMax: 681, atkSpd: 2, dmg: [2, 53], db: 53, hit: 28, mag: { skn: "劇毒", cd: 50, type: "poison", pbase: 200, d: 50, tick: 3, dur: 18 } },
        "pride_small_phantom":      { n: "小幻象眼魔", lv: 54, s: "L", beh: "主動", race: "眼魔", e: "none", hp: 1600, ac: -63, mr: 99, exp: 2917, goldMin: 454, goldMax: 722, atkSpd: 2, dmg: [2, 54], db: 54, hit: 29, mag: { skn: "木乃伊的詛咒", cd: 70, type: "stone", pbase: 200 }, mag2: { skn: "幻象光線", cd: 50, chance: 0.3, dmg: [2, 40], db: 143, ele: "none", alwaysHit: true } },
        "pride_marcus_vampire":     { n: "馬昆斯吸血鬼", lv: 56, s: "S", beh: "主動", race: "吸血鬼", e: "earth", hp: 2500, ac: -63, mr: 65, exp: 3137, goldMin: 481, goldMax: 760, atkSpd: 2, dmg: [2, 60], db: 56, hit: 30, mag: { skn: "吸血鬼之吻", cd: 70, dmg: [2, 50], db: 51, ele: "none", alwaysHit: true, vamp: [1, 56] } },
        "pride_terror_zombie_king": { n: "恐怖的殭屍王", lv: 55, s: "L", beh: "主動", race: "殭屍", e: "earth", hp: 3500, ac: -68, mr: 40, exp: 3026, goldMin: 451, goldMax: 802, atkSpd: 3, dmg: [1, 155], db: 55, hit: 33, mag: { skn: "腐蝕之血", cd: 130, chance: 0.5, dmg: [1, 50], db: 55, ele: "none", alwaysHit: true, sec: { type: "poison", pbase: 150, d: 50, tick: 3, dur: 18 } } },
        "pride_lich_boss":          { n: "不滅的巫妖", lv: 80, s: "L", beh: "主動", race: "巫妖", boss: true, hard: true, e: "none", hp: 25000, ac: -75, mr: 99, exp: 6401, goldMin: 10000, goldMax: 20000, atkSpd: 2, dmg: [4, 80], db: 165, hit: 80, mag: { skn: "闇黑波動", cd: 70, chance: 0.3, dmg: [2, 400], db: 180, ele: "none", alwaysHit: true }, mag2: { skn: "靈光箭", cd: 50, dmg: [2, 200], db: 150, ele: "none", alwaysHit: true }, mag3: { skn: "審判之雷", cd: 130, chance: 0.2, dmg: [5, 300], db: 1, ele: "wind", alwaysHit: true } },
        // ----- 傲慢之塔 91~100 樓 -----
        "pride_earth_king":      { n: "土精靈王", lv: 60, s: "L", beh: "主動", race: "元素", e: "earth", hp: 2500, ac: -66, mr: 50, exp: 3601, goldMin: 600, goldMax: 1200, atkSpd: 2, dmg: [2, 65], db: 105, hit: 35, mag: { skn: "巨石之擊", cd: 70, dmg: [1, 100], db: 40, ele: "earth", alwaysHit: true, sec: { type: "stun", pbase: 150 } }, mag2: { skn: "震裂術", cd: 80, chance: 0.5, dmg: [4, 40], db: 140, ele: "earth", alwaysHit: true } },
        "pride_water_king":      { n: "水精靈王", lv: 60, s: "L", beh: "主動", race: "元素", e: "water", hp: 2500, ac: -66, mr: 50, exp: 3601, goldMin: 600, goldMax: 1200, atkSpd: 2, dmg: [2, 65], db: 95, hit: 35, mag: { skn: "水之矛", cd: 70, dmg: [1, 100], db: 40, ele: "water", alwaysHit: true, sec: { type: "freeze", pbase: 150 } }, mag2: { skn: "水柱", cd: 80, chance: 0.5, dmg: [4, 40], db: 140, ele: "water", alwaysHit: true } },
        "pride_wind_king":       { n: "風精靈王", lv: 60, s: "L", beh: "主動", race: "元素", e: "wind", hp: 2500, ac: -66, mr: 50, exp: 3601, goldMin: 600, goldMax: 1200, atkSpd: 1, dmg: [1, 65], db: 45, hit: 38, mag: { skn: "龍捲風", cd: 90, dmg: [3, 100], db: 40, ele: "wind", alwaysHit: true } },
        "pride_fire_king":       { n: "火精靈王", lv: 60, s: "L", beh: "主動", race: "元素", e: "fire", hp: 2500, ac: -66, mr: 50, exp: 3601, goldMin: 600, goldMax: 1200, atkSpd: 3, dmg: [3, 65], db: 135, hit: 36, mag: { skn: "爆炎的火球", cd: 130, dmg: [3, 100], db: 90, ele: "fire", alwaysHit: true } },
        "pride_iris_mob":        { n: "艾莉絲", lv: 55, s: "S", beh: "主動", race: "惡魔", e: "none", hp: 2500, ac: -70, mr: 80, exp: 3026, goldMin: 550, goldMax: 1200, atkSpd: 1, dmg: [1, 55], db: 50, hit: 34, mag: { skn: "龍捲風", cd: 130, dmg: [1, 150], db: 190, ele: "wind", alwaysHit: true } },
        "pride_mummy_king_mob":  { n: "木乃伊王", lv: 58, s: "L", beh: "主動", race: "殭屍", e: "earth", hp: 4000, ac: -55, mr: 80, exp: 3365, goldMin: 550, goldMax: 1200, atkSpd: 3, dmg: [3, 58], db: 81, hit: 37, mag: { skn: "木乃伊的詛咒", cd: 90, type: "stone", pbase: 150 } },
        "pride_vander_mob":      { n: "騎士范德", lv: 60, s: "S", beh: "主動", race: "亞人", e: "none", hp: 5000, ac: -65, mr: 55, exp: 3601, goldMin: 600, goldMax: 1200, atkSpd: 1, dmg: [1, 60], db: 40, hit: 39, mag: { skn: "震裂術", cd: 90, chance: 0.5, dmg: [4, 40], db: 100, ele: "earth", alwaysHit: true } },
        "pride_reaper_boss":     { n: "邪惡的鐮刀死神", lv: 80, s: "L", beh: "主動", race: "死神", boss: true, hard: true, e: "none", hp: 40000, ac: -80, mr: 80, exp: 6401, goldMin: 10000, goldMax: 20000, atkSpd: 1.5, dmg: [5, 80], db: 99, hit: 80, mag: { skn: "闇黑波動", cd: 70, chance: 0.2, dmg: [5, 400], db: 399, ele: "none", alwaysHit: true }, mag2: { skn: "鐮刀波動", type: "extra_attack", cd: 50 }, mag3: { skn: "鐮刀劍氣斬", type: "multi_attack", cd: 130, chance: 0.2, times: 9, atkDmg: [3, 70], atkDb: 99 } },
        // ===== 🔥 50級試煉擴充：精靈墓穴 =====
        "elf_earthfang":  { n: "地之牙", lv: 40, s: "S", beh: "被動", race: "元素", e: "earth", hp: 1200, ac: -30, mr: 20, exp: 1601, goldMin: 265, goldMax: 429, atkSpd: 2, dmg: [2, 42], db: 41, hit: 21, mag: { skn: "地獄之牙", cd: 70, dmg: [3, 40], db: 88, ele: "earth", alwaysHit: true } },
        "elf_windfang":   { n: "風之牙", lv: 40, s: "S", beh: "被動", race: "元素", e: "wind", hp: 1200, ac: -30, mr: 20, exp: 1601, goldMin: 265, goldMax: 429, atkSpd: 1, dmg: [1, 42], db: 23, hit: 23, mag: { skn: "風刃", cd: 50, dmg: [5, 20], db: 78, ele: "wind", alwaysHit: true } },
        "elf_waterfang":  { n: "水之牙", lv: 40, s: "S", beh: "被動", race: "元素", e: "water", hp: 1200, ac: -30, mr: 20, exp: 1601, goldMin: 265, goldMax: 429, atkSpd: 2, dmg: [2, 40], db: 29, hit: 21, mag: { skn: "冰錐", cd: 60, dmg: [4, 20], db: 98, ele: "water", alwaysHit: true } },
        "elf_firefang":   { n: "火之牙", lv: 40, s: "S", beh: "被動", race: "元素", e: "fire", hp: 1200, ac: -30, mr: 20, exp: 1601, goldMin: 265, goldMax: 429, atkSpd: 2, dmg: [2, 44], db: 29, hit: 21, mag: { skn: "火箭", cd: 30, dmg: [2, 20], db: 68, ele: "fire", alwaysHit: true } },
        "elf_waterlord":  { n: "水靈之主", lv: 45, s: "S", beh: "被動", race: "元素", e: "water", hp: 1400, ac: -40, mr: 35, exp: 2026, goldMin: 265, goldMax: 429, atkSpd: 2, dmg: [2, 49], db: 49, hit: 25, mag: { skn: "冰錐", cd: 50, dmg: [5, 20], db: 98, ele: "water", alwaysHit: true } },
        // ===== 🏝️ 遺忘之島：傳送門（擊敗即進入遺忘之島；不會攻擊、不觸發自動瞬移）=====
        "obli_portal":      { n: "遺忘之島", lv: 1, s: "L", beh: "被動", race: "建築", boss: true, noAutoTeleport: true, e: "none", hp: 1, ac: 10, mr: 0, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 60, dmg: [1, 1], db: 0, hit: 0 },
        // ===== 🏝️ 遺忘之島：怪物 =====
        "obli_croc":        { n: "遺忘之島鱷魚", lv: 20, s: "S", beh: "主動", race: "動物", e: "water", hp: 150, ac: -14, mr: 5, exp: 401, goldMin: 10, goldMax: 100, atkSpd: 2, dmg: [2, 20], db: 30, hit: 10 },
        "obli_werewolf":    { n: "遺忘之島狼人", lv: 34, s: "S", beh: "主動", race: "狼人", e: "wind", hp: 180, ac: -20, mr: 10, exp: 1157, goldMin: 10, goldMax: 100, atkSpd: 2, dmg: [2, 34], db: 56, hit: 17 },
        "obli_sharlob":     { n: "遺忘之島夏洛伯", lv: 34, s: "L", beh: "主動", race: "蜘蛛", e: "none", hp: 170, ac: -15, mr: 12, exp: 1157, goldMin: 10, goldMax: 100, atkSpd: 1, dmg: [1, 34], db: 20, hit: 17 },
        "obli_arian":       { n: "遺忘之島亞力安", lv: 47, s: "L", beh: "主動", race: "亞力安", e: "earth", hp: 600, ac: -25, mr: 30, exp: 2210, goldMin: 10, goldMax: 100, atkSpd: 1.2, dmg: [1, 56], db: 40, hit: 24, mag: { skn: "冷凍光線", type: "stone", cd: 70, pbase: 200 } },
        "obli_darkelf":     { n: "遺忘之島黑暗精靈", lv: 35, s: "S", beh: "主動", race: "黑暗精靈", e: "earth", hp: 350, ac: -29, mr: 30, exp: 1226, goldMin: 10, goldMax: 100, atkSpd: 1.5, dmg: [1, 51], db: 35, hit: 18, mag: { skn: "龍捲風", cd: 70, dmg: [1, 70], db: 70, ele: "wind" } },
        "obli_bear":        { n: "遺忘之島歐熊", lv: 35, s: "L", beh: "主動", race: "動物", e: "earth", hp: 250, ac: -21, mr: 10, exp: 1226, goldMin: 10, goldMax: 100, atkSpd: 3, dmg: [1, 105], db: 70, hit: 18 },
        "obli_lizardman":   { n: "遺忘之島蜥蜴人", lv: 20, s: "S", beh: "主動", race: "蜥蜴人", e: "water", hp: 180, ac: -17, mr: 5, exp: 401, goldMin: 10, goldMax: 100, atkSpd: 2, dmg: [2, 20], db: 30, hit: 10 },
        "obli_kasta":       { n: "遺忘之島卡司特", lv: 36, s: "S", beh: "主動", race: "卡司特", e: "earth", hp: 240, ac: -20, mr: 10, exp: 1370, goldMin: 10, goldMax: 100, atkSpd: 1, dmg: [1, 36], db: 28, hit: 16, mag: { skn: "沉默", type: "magicseal", cd: 100, pbase: 150 } },
        "obli_lamia":       { n: "遺忘之島蛇女", lv: 37, s: "L", beh: "主動", race: "蛇女", e: "water", hp: 240, ac: -16, mr: 10, exp: 1370, goldMin: 10, goldMax: 100, atkSpd: 2, dmg: [2, 37], db: 51, hit: 18, mag: { skn: "烈毒", type: "poison", cd: 70, pbase: 200, d: 50, tick: 3, dur: 12 } },
        "obli_lycan":       { n: "遺忘之島萊肯", lv: 37, s: "S", beh: "主動", race: "狼人", e: "wind", hp: 220, ac: -24, mr: 25, exp: 1370, goldMin: 10, goldMax: 100, atkSpd: 2, dmg: [1, 75], db: 52, hit: 17 },
        "obli_axetaurus":   { n: "遺忘之島巨斧牛人", lv: 37, s: "S", beh: "主動", race: "牛人", e: "earth", hp: 300, ac: -20, mr: 0, exp: 1370, goldMin: 10, goldMax: 100, atkSpd: 3, dmg: [1, 105], db: 74, hit: 17 },
        "obli_troll":       { n: "遺忘之島食人妖精", lv: 37, s: "L", beh: "主動", race: "食人妖精", e: "fire", hp: 300, ac: -16, mr: 10, exp: 1370, goldMin: 10, goldMax: 100, atkSpd: 2, dmg: [2, 37], db: 50, hit: 18, mag: { skn: "火牢", cd: 30, chance: 0.1, dmg: [3, 37], db: 37, ele: "fire" } },
        "obli_ungoliant":   { n: "遺忘之島楊果里恩", lv: 38, s: "L", beh: "主動", race: "蜘蛛", e: "earth", hp: 250, ac: -20, mr: 10, exp: 1445, goldMin: 10, goldMax: 100, atkSpd: 1, dmg: [1, 38], db: 29, hit: 19, mag: { skn: "烈毒", type: "poison", cd: 50, pbase: 200, d: 50, tick: 3, dur: 12 } },
        "obli_griffon":     { n: "遺忘之島格利芬", lv: 41, s: "L", beh: "主動", race: "格利芬", e: "wind", hp: 410, ac: -25, mr: 10, exp: 1682, goldMin: 10, goldMax: 100, atkSpd: 1.8, dmg: [2, 39], db: 63, hit: 21 },
        "obli_hammertaurus":{ n: "遺忘之島鏈鎚牛人", lv: 41, s: "S", beh: "主動", race: "牛人", e: "earth", hp: 430, ac: -20, mr: 0, exp: 1682, goldMin: 10, goldMax: 100, atkSpd: 3, dmg: [1, 123], db: 72, hit: 20 },
        "obli_harpy":       { n: "遺忘之島哈維", lv: 41, s: "S", beh: "主動", race: "哈維", e: "wind", hp: 250, ac: -28, mr: 25, exp: 677, goldMin: 10, goldMax: 100, atkSpd: 1.5, dmg: [1, 62], db: 48, hit: 23, mag: { skn: "吸血鬼之吻", cd: 60, dmg: [1, 50], db: 41, ele: "none", vamp: [1, 41] }, mag2: { skn: "木乃伊的詛咒", type: "stone", cd: 50, pbase: 150 } },
        "obli_shapeshifter":{ n: "遺忘之島變形怪", lv: 42, s: "S", beh: "主動", race: "變形怪", e: "earth", hp: 350, ac: -21, mr: 60, exp: 1765, goldMin: 10, goldMax: 100, atkSpd: 2, dmg: [2, 42], db: 70, hit: 22 },
        "obli_bigcroc":     { n: "遺忘之島巨大鱷魚", lv: 42, s: "L", beh: "主動", race: "動物", e: "water", hp: 440, ac: -28, mr: 10, exp: 1765, goldMin: 10, goldMax: 100, atkSpd: 2.5, dmg: [2, 61], db: 89, hit: 25 },
        "obli_kastaking":   { n: "遺忘之島卡司特王", lv: 42, s: "S", beh: "主動", race: "卡司特", e: "earth", hp: 360, ac: -22, mr: 20, exp: 1765, goldMin: 10, goldMax: 100, atkSpd: 1, dmg: [1, 42], db: 31, hit: 21, mag: { skn: "沉默", type: "magicseal", cd: 70, pbase: 200 } },
        "obli_doro":        { n: "遺忘之島多羅", lv: 43, s: "L", beh: "主動", race: "多羅", e: "earth", hp: 330, ac: -25, mr: 20, exp: 1850, goldMin: 10, goldMax: 100, atkSpd: 2, dmg: [1, 86], db: 72, hit: 22 },
        "obli_aruba":       { n: "遺忘之島阿魯巴", lv: 45, s: "L", beh: "主動", race: "巨人", e: "earth", hp: 550, ac: -27, mr: 0, exp: 2026, goldMin: 10, goldMax: 100, atkSpd: 1.5, dmg: [2, 30], db: 55, hit: 25, mag: { skn: "加速術", type: "self_haste", cd: 70, spd: 1, dur: 8 } },
        "obli_trollking":   { n: "遺忘之島食人妖精王", lv: 45, s: "L", beh: "主動", race: "食人妖精", e: "fire", hp: 480, ac: -18, mr: 20, exp: 2026, goldMin: 10, goldMax: 100, atkSpd: 2, dmg: [2, 45], db: 70, hit: 23, mag: { skn: "火牢", cd: 30, chance: 0.1, dmg: [3, 45], db: 45, ele: "fire" } },
        "obli_evillizard":  { n: "遺忘之島邪惡蜥蜴", lv: 48, s: "L", beh: "主動", race: "邪惡蜥蜴", e: "water", hp: 800, ac: -25, mr: 30, exp: 2305, goldMin: 10, goldMax: 100, atkSpd: 2, dmg: [1, 96], db: 82, hit: 24, mag: { skn: "寒冷噴吐", type: "stone", cd: 90, pbase: 200 } },
        "obli_cyclops":     { n: "遺忘之島獨眼巨人", lv: 50, s: "L", beh: "主動", race: "巨人", e: "wind", hp: 880, ac: -28, mr: 30, exp: 2501, goldMin: 10, goldMax: 100, atkSpd: 2, dmg: [2, 50], db: 85, hit: 32 },
        "obli_wyvern":      { n: "遺忘之島飛龍", lv: 53, s: "L", beh: "主動", race: "飛龍", e: "wind", hp: 1200, ac: -38, mr: 80, exp: 2810, goldMin: 10, goldMax: 100, atkSpd: 1, dmg: [1, 106], db: 60, hit: 35, mag: { skn: "火焰噴吐", cd: 70, dmg: [3, 100], db: 153, ele: "fire" } },
        "obli_bigtaurus":   { hard: true, n: "遺忘之島巨大牛人", lv: 53, s: "L", beh: "主動", race: "牛人", boss: true, e: "earth", hp: 15000, ac: -65, mr: 60, exp: 2810, goldMin: 8000, goldMax: 16000, atkSpd: 3, dmg: [1, 212], db: 120, hit: 55, mag: { skn: "震裂術", cd: 70, chance: 0.5, dmg: [1, 300], db: 399, ele: "earth", sec: { type: "stun", pbase: 200 } } },
        "abyss_ghoul":    { n: "深淵食屍鬼", lv: 45, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 2400, ac: -10, mr: 68, exp: 2026, goldMin: 333, goldMax: 536, atkSpd: 2, dmg: [2, 55], db: 65, hit: 25 },
        "abyss_archer":   { n: "深淵弓箭手", lv: 45, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 600, ac: -65, mr: 58, exp: 2026, goldMin: 333, goldMax: 536, atkSpd: 1, dmg: [1, 55], db: 49, hit: 25 },
        "elf_earthlord":  { n: "地靈之主", lv: 45, s: "S", beh: "被動", race: "元素", e: "earth", hp: 1400, ac: -40, mr: 35, exp: 2026, goldMin: 333, goldMax: 536, atkSpd: 3, dmg: [3, 45], db: 65, hit: 22, mag: { skn: "地裂術", cd: 70, dmg: [5, 40], db: 58, ele: "earth", alwaysHit: true } },
        "elf_windlord":   { n: "風靈之主", lv: 45, s: "S", beh: "被動", race: "元素", e: "wind", hp: 1400, ac: -40, mr: 35, exp: 2026, goldMin: 333, goldMax: 536, atkSpd: 1, dmg: [1, 55], db: 25, hit: 26, mag: { skn: "極道落雷", cd: 70, dmg: [2, 90], db: 18, ele: "wind", alwaysHit: true } },
        "elf_firelord":   { n: "火靈之主", lv: 45, s: "S", beh: "被動", race: "元素", e: "fire", hp: 1400, ac: -40, mr: 35, exp: 2026, goldMin: 333, goldMax: 536, atkSpd: 2, dmg: [2, 55], db: 35, hit: 23, mag: { skn: "燃燒的火球", cd: 70, dmg: [1, 180], db: 28, ele: "fire", alwaysHit: true } },
        "abyss_sith":     { n: "西斯", lv: 50, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 2400, ac: -35, mr: 75, exp: 2501, goldMin: 409, goldMax: 654, atkSpd: 2, dmg: [2, 65], db: 45, hit: 25, mag: { skn: "風之枷鎖", cd: 70, type: "slowatk", pbase: 9999, dur: 6 } },
        "abyss_water":    { n: "深淵水靈", lv: 55, s: "S", beh: "主動", race: "元素", e: "water", hp: 1800, ac: -50, mr: 45, exp: 3026, goldMin: 493, goldMax: 786, atkSpd: 2, dmg: [2, 65], db: 55, hit: 28, mag: { skn: "冰錐", cd: 50, dmg: [5, 30], db: 98, ele: "water", alwaysHit: true } },
        "abyss_earth":    { n: "深淵地靈", lv: 55, s: "S", beh: "主動", race: "元素", e: "earth", hp: 1800, ac: -50, mr: 45, exp: 3026, goldMin: 493, goldMax: 786, atkSpd: 3, dmg: [3, 65], db: 85, hit: 26, mag: { skn: "地裂術", cd: 80, dmg: [5, 30], db: 158, ele: "earth", alwaysHit: true } },
        "abyss_wind":     { n: "深淵風靈", lv: 55, s: "S", beh: "主動", race: "元素", e: "wind", hp: 1800, ac: -50, mr: 45, exp: 3026, goldMin: 493, goldMax: 786, atkSpd: 1, dmg: [1, 85], db: 15, hit: 30, mag: { skn: "極道落雷", cd: 70, dmg: [1, 200], db: 28, ele: "wind", alwaysHit: true } },
        "abyss_fire":     { n: "深淵火靈", lv: 55, s: "S", beh: "主動", race: "元素", e: "fire", hp: 1800, ac: -50, mr: 45, exp: 3026, goldMin: 493, goldMax: 786, atkSpd: 2, dmg: [2, 85], db: 5, hit: 28, mag: { skn: "裂炎術", cd: 90, dmg: [1, 250], db: 28, ele: "fire", alwaysHit: true } },
        "mambo_rabbit":   { n: "曼波兔", lv: 50, s: "S", beh: "被動", hard: true, race: "精靈", e: "none", hp: 4000, ac: -40, mr: 65, exp: 20000, goldMin: 493, goldMax: 786, atkSpd: 2, dmg: [4, 50], db: 0, hit: 30, mag: { skn: "跳躍波動", cd: 90, chance: 0.5, dmg: [1, 250], db: 1, ele: "none", alwaysHit: true, sec: { type: "stun", pbase: 200 } }, mag2: { skn: "冰裂術", cd: 110, chance: 0.7, dmg: [1, 250], db: 1, ele: "water", alwaysHit: true, sec: { type: "freeze", pbase: 200 } } },
        "abyss_lord":     { n: "深淵之主", lv: 60, s: "S", beh: "被動", hard: true, boss: true, race: "惡魔", e: "none", hp: 24000, ac: -60, mr: 60, exp: 3601, goldMin: 1000, goldMax: 5000, atkSpd: 2, dmg: [3, 100], db: 30, hit: 58, mag: { skn: "火焰之舞", cd: 70, chance: 0.3, dmg: [2, 366], db: 66, ele: "fire", alwaysHit: true }, mag2: { skn: "燃燒的火球", cd: 130, dmg: [1, 666], db: 66, ele: "fire", alwaysHit: true } },
        // ===== 🔥 50級試煉擴充：大洞穴隱遁者村莊地區 =====
        "demon_bat":      { n: "魔蝙蝠", lv: 22, s: "S", beh: "被動", race: "野獸", e: "wind", hp: 250, ac: -6, mr: 10, exp: 485, goldMin: 87, goldMax: 150, atkSpd: 2, dmg: [2, 22], db: 13, hit: 9 },
        "de_thief":       { n: "黑暗妖精盜賊", lv: 28, s: "S", beh: "主動", race: "黑暗妖精", e: "wind", hp: 500, ac: -18, mr: 20, exp: 785, goldMin: 87, goldMax: 150, atkSpd: 2, dmg: [2, 28], db: 18, hit: 15 },
        "dark_spirit_mob":{ n: "闇之精靈", lv: 25, s: "S", beh: "主動", race: "元素", e: "earth", hp: 120, ac: -14, mr: 35, exp: 626, goldMin: 109, goldMax: 186, atkSpd: 1, dmg: [1, 28], db: 15, hit: 13 },
        "armadillo":      { n: "犰狳", lv: 25, s: "S", beh: "主動", race: "野獸", e: "earth", hp: 120, ac: -14, mr: 35, exp: 626, goldMin: 109, goldMax: 186, atkSpd: 2, dmg: [2, 28], db: 30, hit: 13 },
        "demon_bear":     { n: "魔熊", lv: 26, s: "L", beh: "被動", race: "野獸", e: "earth", hp: 300, ac: -15, mr: 5, exp: 677, goldMin: 118, goldMax: 198, atkSpd: 3, dmg: [3, 26], db: 40, hit: 12 },
        "ohm_militia":    { n: "歐姆民兵", lv: 26, s: "S", beh: "被動", race: "歐姆", e: "none", hp: 230, ac: -18, mr: 25, exp: 677, goldMin: 118, goldMax: 198, atkSpd: 2, dmg: [2, 26], db: 27, hit: 12 },
        "dark_spirit_king":{ n: "闇精靈王", lv: 28, s: "L", beh: "被動", race: "元素", e: "earth", hp: 270, ac: -15, mr: 20, exp: 785, goldMin: 135, goldMax: 225, atkSpd: 1, dmg: [1, 33], db: 18, hit: 15 },
        "metal_centipede":{ n: "金屬蜈蚣", lv: 30, s: "L", beh: "被動", race: "蜈蚣", e: "earth", hp: 400, ac: -13, mr: 20, exp: 901, goldMin: 153, goldMax: 254, atkSpd: 2, dmg: [2, 33], db: 38, hit: 18, mag: { skn: "毒液噴吐", cd: 50, type: "poison", pbase: 150, d: 30, tick: 5, dur: 20 } },
        "beast_tamer":    { n: "馴獸師", lv: 40, s: "S", beh: "主動", race: "黑暗妖精", e: "none", hp: 600, ac: -30, mr: 35, exp: 1601, goldMin: 265, goldMax: 429, atkSpd: 2, dmg: [2, 45], db: 55, hit: 21 },
        // ===== 🔥 50級試煉擴充：古代巨人之墓 =====
        "tomb_guardian":  { n: "墳墓守護者", lv: 45, s: "L", beh: "主動", hard: true, race: "墳墓守護者", e: "none", hp: 1000, ac: -45, mr: 70, exp: 2026, goldMin: 265, goldMax: 429, atkSpd: 3, dmg: [3, 55], db: 68, hit: 26, mag: { skn: "木乃伊的詛咒", cd: 50, chance: 0.3, type: "stone", pbase: 150 } },
        "tomb_guardian_mage": { n: "墳墓守護者法師", lv: 48, s: "L", beh: "主動", hard: true, race: "墳墓守護者", e: "fire", hp: 1500, ac: -50, mr: 70, exp: 2305, goldMin: 265, goldMax: 429, atkSpd: 3, dmg: [3, 59], db: 58, hit: 24, mag: { skn: "木乃伊的詛咒", cd: 50, chance: 0.3, type: "stone", pbase: 150 }, mag2: { skn: "燃燒的火球", cd: 70, dmg: [3, 40], db: 143, ele: "fire", alwaysHit: true } },
        "tomb_guardian_knight": { n: "墳墓守護者騎士", lv: 50, s: "L", beh: "主動", hard: true, race: "墳墓守護者", e: "fire", hp: 2000, ac: -55, mr: 70, exp: 2305, goldMin: 265, goldMax: 429, atkSpd: 3, dmg: [3, 66], db: 60, hit: 26, mag: { skn: "木乃伊的詛咒", cd: 50, chance: 0.3, type: "stone", pbase: 150 } },
        "tomb_guardian_giant": { n: "巨大墳墓守護者", lv: 56, s: "L", beh: "主動", hard: true, race: "墳墓守護者", e: "fire", hp: 5000, ac: -63, mr: 70, exp: 3137, goldMin: 265, goldMax: 429, atkSpd: 4, dmg: [4, 70], db: 70, hit: 28, mag: { skn: "木乃伊的詛咒", cd: 50, chance: 0.3, type: "stone", pbase: 150 } },
        // ===== 🔥 50級試煉擴充：魔族暗殺團（條件出現）=====
        "demon_assassin": { n: "魔族暗殺團", lv: 53, s: "S", beh: "被動", race: "不死", un: true, e: "none", hp: 1800, ac: -58, mr: 70, exp: 1, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [2, 53], db: 53, hit: 26 },
        // ===== 🔥 50級試煉擴充：魔族神殿 =====
        "flame_avatar":   { n: "炎魔的分身", lv: 57, s: "L", beh: "主動", race: "惡魔", e: "none", hp: 8000, ac: -60, mr: 70, exp: 3250, goldMin: 165, goldMax: 429, atkSpd: 3, dmg: [3, 65], db: 65, hit: 28, mag: { skn: "地面震裂", cd: 70, chance: 0.5, dmg: [5, 40], db: 157, ele: "earth", alwaysHit: true } },
        "darkdweller":    { n: "黑暗棲林者", lv: 33, s: "S", beh: "主動", race: "黑暗棲林者", e: "none", hp: 450, ac: -10, mr: 50, exp: 1090, goldMin: 65, goldMax: 229, atkSpd: 2, dmg: [2, 33], db: 33, hit: 18, mag: { skn: "突刺術", cd: 50, dmg: [2, 33], db: 47, ele: "earth", alwaysHit: true } },
        "flame_skba":     { n: "炎魔的思克巴", lv: 37, s: "S", beh: "主動", race: "思克巴", e: "earth", hp: 400, ac: -25, mr: 50, exp: 1370, goldMin: 65, goldMax: 229, atkSpd: 2, dmg: [2, 37], db: 37, hit: 21, mag: { skn: "吸血鬼之吻", cd: 60, dmg: [2, 37], db: 21, ele: "none", alwaysHit: true, vamp: [1, 37] } },
        "flame_skba_queen": { n: "炎魔的思克巴女皇", lv: 41, s: "S", beh: "主動", race: "思克巴", e: "none", hp: 500, ac: -32, mr: 80, exp: 1682, goldMin: 85, goldMax: 259, atkSpd: 2, dmg: [2, 44], db: 44, hit: 22, mag: { skn: "吸血鬼之吻", cd: 60, dmg: [2, 41], db: 31, ele: "none", alwaysHit: true, vamp: [1, 41] } },
        "flame_imp":      { n: "炎魔的小惡魔", lv: 44, s: "S", beh: "主動", race: "惡魔", e: "earth", hp: 420, ac: -38, mr: 80, exp: 1937, goldMin: 85, goldMax: 359, atkSpd: 2, dmg: [2, 50], db: 49, hit: 22, mag: { skn: "火焰之陣", cd: 80, dmg: [3, 44], db: 66, ele: "fire", alwaysHit: true } },
        "flame_baphomet": { n: "炎魔的巴風特", lv: 51, s: "S", beh: "主動", race: "惡魔", e: "fire", hp: 3000, ac: -65, mr: 80, exp: 2602, goldMin: 285, goldMax: 459, atkSpd: 2, dmg: [2, 66], db: 51, hit: 26, mag: { skn: "地裂術", cd: 70, dmg: [4, 44], db: 56, ele: "earth", alwaysHit: true } },
        "fallen_priest1": { n: "墮落的司祭(一階)", lv: 51, s: "S", beh: "主動", race: "不死", un: true, e: "water", hp: 1500, ac: -50, mr: 70, exp: 2602, goldMin: 285, goldMax: 459, atkSpd: 2, dmg: [2, 55], db: 51, hit: 26, mag: { skn: "裂炎術", cd: 70, dmg: [3, 44], db: 51, ele: "fire", alwaysHit: true } },
        "fallen_priest2": { n: "墮落的司祭(二階)", lv: 51, s: "S", beh: "主動", race: "不死", un: true, e: "water", hp: 1500, ac: -53, mr: 70, exp: 2602, goldMin: 285, goldMax: 459, atkSpd: 2, dmg: [2, 57], db: 54, hit: 27 },
        "fallen_priest3": { n: "墮落的司祭(三階)", lv: 53, s: "S", beh: "主動", race: "不死", un: true, e: "none", hp: 3000, ac: -58, mr: 70, exp: 2810, goldMin: 285, goldMax: 459, atkSpd: 1.5, dmg: [2, 53], db: 53, hit: 29, mag: { skn: "突刺術", cd: 50, dmg: [4, 33], db: 53, ele: "earth", alwaysHit: true } },
        "flame_baless":   { n: "炎魔的巴列斯", lv: 53, s: "S", beh: "主動", hard: true, race: "惡魔", e: "earth", hp: 2100, ac: -66, mr: 80, exp: 2810, goldMin: 285, goldMax: 459, atkSpd: 1.5, dmg: [2, 58], db: 53, hit: 28, mag: { skn: "燃燒的火球", cd: 70, dmg: [1, 200], db: 66, ele: "fire", alwaysHit: true } },
        "fallen_priest4": { n: "墮落的司祭(四階)", lv: 54, s: "S", beh: "主動", race: "不死", un: true, e: "water", hp: 4000, ac: -63, mr: 70, exp: 2917, goldMin: 285, goldMax: 559, atkSpd: 1, dmg: [1, 68], db: 31, hit: 29, mag: { skn: "毒咒", cd: 70, chance: 0.5, type: "poison", pbase: 250, d: 50, tick: 5, dur: 20 } },
        "fallen_priest5": { n: "墮落的司祭(五階)", lv: 56, s: "S", beh: "主動", race: "不死", un: true, e: "water", hp: 3800, ac: -60, mr: 70, exp: 3137, goldMin: 285, goldMax: 559, atkSpd: 1, dmg: [1, 68], db: 31, hit: 29, mag: { skn: "舌頭突擊", cd: 30, chance: 0.5, dmg: [1, 100], db: 99, ele: "none", alwaysHit: true } },
        "flame_demon":    { n: "炎魔的惡魔", lv: 61, s: "L", beh: "主動", race: "惡魔", e: "earth", hp: 6000, ac: -68, mr: 75, exp: 3722, goldMin: 285, goldMax: 559, atkSpd: 1, dmg: [1, 80], db: 41, hit: 32, mag: { skn: "火焰之舞", cd: 70, chance: 0.5, dmg: [2, 166], db: 66, ele: "fire", alwaysHit: true }, mag2: { skn: "燃燒的火球", cd: 130, dmg: [1, 300], db: 66, ele: "fire", alwaysHit: true } },
        "fallen_boss":    { n: "墮落", lv: 68, s: "L", beh: "主動", boss: true, hard: true, race: "不死", un: true, e: "water", hp: 6600, ac: -75, mr: 100, exp: 4625, goldMin: 285, goldMax: 559, atkSpd: 1, dmg: [1, 100], db: 52, hit: 39, mag: { skn: "闇黑波動", cd: 70, chance: 0.5, dmg: [3, 166], db: 66, ele: "none", alwaysHit: true }, mag2: { skn: "爆炎之擊", cd: 130, dmg: [1, 500], db: 0, ele: "fire", alwaysHit: true, sec: { type: "burn", pbase: 200, d: 50, tick: 5, dur: 20 } } },
        // ===== 🌑 暗影神殿 怪物（種族：不死／魔族；以 un:true 套用不死機制） =====
        "death_priest_succubus": { n: "死亡的司祭(思克巴)", lv: 52, s: "L", beh: "主動", race: "不死", un: true, e: "none", hp: 750, ac: -55, mr: 100, exp: 2705, goldMin: 300, goldMax: 486, atkSpd: 2, dmg: [2, 55], db: 55, hit: 25, mag: { skn: "吸血鬼之吻", cd: 60, dmg: [2, 52], db: 52, ele: "none", alwaysHit: true, vamp: [1, 52] } },
        "death_priest_baphomet": { n: "死亡的司祭(巴風特)", lv: 55, s: "L", beh: "主動", race: "不死", un: true, e: "none", hp: 1000, ac: -60, mr: 100, exp: 3026, goldMin: 300, goldMax: 486, atkSpd: 2, dmg: [2, 61], db: 61, hit: 26, mag: { skn: "地裂術", cd: 70, dmg: [4, 52], db: 52, ele: "earth", alwaysHit: true } },
        "chaos_priest_wing": { n: "混沌的司祭(飛翼)", lv: 52, s: "L", beh: "主動", race: "不死", un: true, e: "none", hp: 750, ac: -65, mr: 100, exp: 2705, goldMin: 300, goldMax: 486, atkSpd: 2, dmg: [2, 60], db: 58, hit: 28 },
        "chaos_priest_beast": { n: "混沌的司祭(野獸)", lv: 55, s: "L", beh: "主動", race: "不死", un: true, e: "none", hp: 1000, ac: -70, mr: 100, exp: 3026, goldMin: 300, goldMax: 486, atkSpd: 1, dmg: [1, 91], db: 31, hit: 27, mag: { skn: "衝擊之暈", cd: 70, chance: 0.3, dmg: [1, 91], db: 31, ele: "none", alwaysHit: true, sec: { type: "stun", pbase: 200 } } },
        "flameshadow_guard_baphomet": { n: "火焰之影親衛隊(巴風特)", lv: 65, s: "L", beh: "主動", race: "不死", un: true, e: "fire", hp: 2000, ac: -70, mr: 100, exp: 4226, goldMin: 300, goldMax: 486, atkSpd: 2, dmg: [2, 79], db: 71, hit: 31, mag: { skn: "地裂術", cd: 70, dmg: [4, 100], db: 52, ele: "earth", alwaysHit: true } },
        "chaos_boss": { n: "混沌", lv: 70, s: "L", beh: "主動", boss: true, hard: true, race: "不死", un: true, e: "none", hp: 15000, ac: -60, mr: 100, exp: 3601, goldMin: 3000, goldMax: 4860, atkSpd: 2, dmg: [4, 61], db: 161, hit: 61, mag: { skn: "鐮刀波動", cd: 90, dmg: [4, 170], db: 75, ele: "none", alwaysHit: true }, mag2: { skn: "毒霧", cd: 100, type: "poison", pbase: 200, d: 100, tick: 5, dur: 20 } },
        "death_boss": { n: "死亡", lv: 70, s: "L", beh: "主動", boss: true, hard: true, race: "不死", un: true, e: "none", hp: 20000, ac: -65, mr: 100, exp: 4901, goldMin: 3000, goldMax: 4860, atkSpd: 1, dmg: [1, 151], db: 71, hit: 69, atkDoubleChance: 0.10, mag: { skn: "闇黑波動", cd: 90, dmg: [4, 170], db: 95, ele: "none", alwaysHit: true }, mag2: { skn: "衝擊之暈", cd: 70, chance: 0.2, dmg: [1, 151], db: 71, ele: "none", alwaysHit: true, sec: { type: "stun", pbase: 200 } } },
        // ===== 🏛️ 隱藏狩獵區域：象牙塔系列怪物（無生物研究室／黑魔法研究室／惡靈封印室／魔物封印室／惡魔封印室） =====
        "iv_paper": { n: "象牙塔紙人", lv: 50, s: "S", beh: "被動", race: "魔法生物", e: "wind", hp: 1250, ac: -30, mr: 5, exp: 2501, goldMin: 200, goldMax: 400, atkSpd: 2, dmg: [1, 100], db: 70, hit: 25 },
        "iv_stone_golem": { hard: true, n: "象牙塔石頭高崙", lv: 50, s: "L", beh: "被動", race: "高崙", e: "wind", hp: 875, ac: -50, mr: 45, exp: 2501, goldMin: 300, goldMax: 600, atkSpd: 3, dmg: [1, 150], db: 110, hit: 25 },
        "iv_iron_golem": { hard: true, n: "象牙塔鋼鐵高崙", lv: 51, s: "L", beh: "被動", race: "高崙", e: "wind", hp: 910, ac: -51, mr: 20, exp: 2602, goldMin: 400, goldMax: 800, atkSpd: 3, dmg: [1, 153], db: 112, hit: 26 },
        "iv_jelly": { n: "象牙塔果凍怪", lv: 52, s: "L", beh: "被動", race: "史萊姆", e: "wind", hp: 946, ac: -47, mr: 0, exp: 2705, goldMin: 300, goldMax: 600, atkSpd: 2, dmg: [2, 52], db: 75, hit: 27, mag: { skn: "烈毒", cd: 50, type: "poison", pbase: 200, d: 30, tick: 3, dur: 15 } },
        "iv_armor": { hard: true, n: "象牙塔活鎧甲", lv: 53, s: "S", beh: "被動", race: "魔法生物", e: "wind", hp: 1021, ac: -44, mr: 50, exp: 2917, goldMin: 300, goldMax: 600, atkSpd: 1, dmg: [1, 55], db: 35, hit: 29 },
        "iv_deathsword": { n: "象牙塔死亡之劍", lv: 55, s: "S", beh: "被動", race: "魔法生物", e: "wind", hp: 1059, ac: -50, mr: 40, exp: 3026, goldMin: 300, goldMax: 600, atkSpd: 0.5, dmg: [1, 27], db: 18, hit: 31 },
        "iv_lightball": { n: "象牙塔閃電球", lv: 55, s: "S", beh: "被動", race: "元素", e: "wind", hp: 1059, ac: -50, mr: 45, exp: 3026, goldMin: 300, goldMax: 600, atkSpd: 1, dmg: [1, 56], db: 36, hit: 30 },
        "iv_mimi": { hard: true, n: "象牙塔密密", lv: 50, s: "S", beh: "被動", race: "魔法生物", e: "wind", hp: 1250, ac: -50, mr: 20, exp: 2501, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [2, 52], db: 60, hit: 26 },
        "iv_elder": { n: "象牙塔長者", lv: 55, s: "S", beh: "主動", race: "長者", e: "wind", hp: 1059, ac: -35, mr: 30, exp: 3026, goldMin: 300, goldMax: 600, atkSpd: 2, dmg: [2, 55], db: 75, hit: 28, mag: { skn: "極道落雷", cd: 50, dmg: [1, 150], db: 55, ele: "wind", alwaysHit: true } },
        "iv_blackelder": { n: "象牙塔黑長者", lv: 57, s: "S", beh: "主動", race: "長者", e: "wind", hp: 1137, ac: -37, mr: 90, exp: 3250, goldMin: 500, goldMax: 1200, atkSpd: 2, dmg: [2, 60], db: 80, hit: 29, mag: { skn: "靈光箭", cd: 30, dmg: [1, 100], db: 50, ele: "none", alwaysHit: true } },
        "iv_chimera": { n: "象牙塔奇美拉", lv: 55, s: "S", beh: "主動", race: "奇美拉", e: "wind", hp: 1059, ac: -35, mr: 35, exp: 3026, goldMin: 300, goldMax: 600, atkSpd: 2, dmg: [2, 56], db: 65, hit: 27, mag: { skn: "烈毒", cd: 50, type: "poison", pbase: 200, d: 30, tick: 3, dur: 15 } },
        "iv_lamia": { n: "象牙塔蛇女", lv: 56, s: "L", beh: "主動", race: "蛇女", e: "wind", hp: 1098, ac: -36, mr: 10, exp: 3137, goldMin: 300, goldMax: 600, atkSpd: 2, dmg: [2, 60], db: 75, hit: 30, mag: { skn: "烈毒", cd: 50, type: "poison", pbase: 200, d: 30, tick: 3, dur: 15 } },
        "iv_blackmage": { n: "象牙塔黑魔法師", lv: 58, s: "S", beh: "主動", race: "法師", e: "wind", hp: 1177, ac: -38, mr: 80, exp: 3365, goldMin: 500, goldMax: 1200, atkSpd: 2, dmg: [2, 65], db: 81, hit: 31, mag: { skn: "火球", cd: 30, dmg: [1, 150], db: 40, ele: "fire", alwaysHit: true } },
        "iv_reaper": { n: "象牙塔死神", lv: 58, s: "S", beh: "主動", race: "不死", un: true, e: "wind", hp: 1177, ac: -53, mr: 9, exp: 3365, goldMin: 500, goldMax: 1000, atkSpd: 1, dmg: [1, 65], db: 41, hit: 31, mag: { skn: "風之枷鎖", cd: 80, type: "slowatk", pbase: 200, dur: 8 } },
        "iv_shadow": { n: "象牙塔影魔", lv: 58, s: "S", beh: "主動", race: "不死", un: true, e: "wind", hp: 1177, ac: -53, mr: 30, exp: 3365, goldMin: 300, goldMax: 600, atkSpd: 2, dmg: [2, 65], db: 65, hit: 29 },
        "iv_spirit": { n: "象牙塔惡靈", lv: 59, s: "S", beh: "主動", race: "不死", un: true, e: "wind", hp: 1218, ac: -54, mr: 45, exp: 3482, goldMin: 300, goldMax: 600, atkSpd: 2, dmg: [2, 70], db: 65, hit: 30 },
        "iv_baless": { hard: true, n: "象牙塔巴列斯之影", lv: 60, s: "S", beh: "主動", race: "惡魔", e: "wind", hp: 1260, ac: -55, mr: 80, exp: 3601, goldMin: 300, goldMax: 600, atkSpd: 2, dmg: [2, 70], db: 65, hit: 30, mag: { skn: "火球", cd: 30, dmg: [1, 200], db: 10, ele: "fire", alwaysHit: true } },
        "iv_karuta": { hard: true, n: "卡魯塔", lv: 51, s: "L", beh: "主動", boss: true, race: "靈魂", e: "wind", hp: 12200, ac: -51, mr: 50, exp: 2601, goldMin: 3000, goldMax: 6000, atkSpd: 2, dmg: [4, 70], db: 125, hit: 50, mag: { skn: "龍捲風", cd: 100, dmg: [3, 200], db: 100, ele: "wind", alwaysHit: true }, mag2: { skn: "魅魔之吻", cd: 50, chance: 0.2, dmg: [1, 1], db: 0, ele: "none", alwaysHit: true, sec: { type: "sleep", pbase: 200 } } },
        "iv_hatin": { n: "哈汀之影", lv: 60, s: "S", beh: "主動", noCharm: true, race: "法師", e: "wind", hp: 5000, ac: -50, mr: 99, exp: 3601, goldMin: 2000, goldMax: 4000, atkSpd: 2, dmg: [2, 75], db: 90, hit: 32, mag: { skn: "黑魔法力場", cd: 80, dmg: [2, 200], db: 70, ele: "none", alwaysHit: true } },
        "iv_flameslave": { n: "象牙塔炎魔的奴隸", lv: 59, s: "L", beh: "主動", race: "惡魔", e: "wind", hp: 1218, ac: -54, mr: 75, exp: 3482, goldMin: 400, goldMax: 1000, atkSpd: 2, dmg: [2, 64], db: 77, hit: 30, mag: { skn: "落石術", cd: 70, dmg: [2, 150], db: 20, ele: "earth", alwaysHit: true } },
        "iv_imp": { n: "象牙塔小惡魔", lv: 60, s: "S", beh: "主動", race: "惡魔", e: "wind", hp: 1260, ac: -55, mr: 80, exp: 3601, goldMin: 500, goldMax: 1000, atkSpd: 2, dmg: [2, 65], db: 85, hit: 31, mag: { skn: "火焰之陣", cd: 70, chance: 0.5, dmg: [3, 150], db: 10, ele: "fire", alwaysHit: true } },
        "iv_baphomet": { hard: true, n: "象牙塔巴風特之影", lv: 62, s: "S", beh: "主動", race: "惡魔", e: "wind", hp: 1345, ac: -57, mr: 80, exp: 3845, goldMin: 500, goldMax: 1100, atkSpd: 2, dmg: [2, 75], db: 66, hit: 32, mag: { skn: "地裂術", cd: 30, dmg: [1, 200], db: 30, ele: "earth", alwaysHit: true } },
        "iv_wing": { n: "象牙塔翼魔", lv: 61, s: "L", beh: "主動", race: "惡魔", e: "wind", hp: 1302, ac: -56, mr: 50, exp: 3722, goldMin: 400, goldMax: 1000, atkSpd: 2, dmg: [2, 73], db: 65, hit: 33 },
        "iv_flameshadow": { n: "象牙塔炎魔之影", lv: 63, s: "L", beh: "主動", race: "惡魔", e: "wind", hp: 1389, ac: -58, mr: 70, exp: 3970, goldMin: 600, goldMax: 1200, atkSpd: 2, dmg: [2, 76], db: 66, hit: 33, mag: { skn: "地獄火", cd: 130, dmg: [1, 500], db: 50, ele: "fire", alwaysHit: true } },
        "iv_demonshadow": { n: "象牙塔惡魔之影", lv: 63, s: "L", beh: "主動", race: "惡魔", e: "wind", hp: 1389, ac: -58, mr: 60, exp: 3970, goldMin: 600, goldMax: 1200, atkSpd: 2, dmg: [2, 76], db: 66, hit: 33, mag: { skn: "火焰之舞", cd: 70, chance: 0.5, dmg: [1, 500], db: 50, ele: "fire", alwaysHit: true } },
        // ===== 🐜 螞蟻洞窟新增怪物（1樓/2樓/巨蟻女皇棲息地） =====
        "ant_white": { n: "白螞蟻群", lv: 25, s: "S", beh: "主動", race: "昆蟲", e: "fire", hp: 300, ac: -12, mr: 60, exp: 626, goldMin: 50, goldMax: 80, atkSpd: 2, dmg: [2, 25], db: 12, hit: 12 },
        "ant_giant_white": { n: "巨大白螞蟻", lv: 28, s: "L", beh: "主動", race: "昆蟲", e: "water", hp: 380, ac: -15, mr: 60, exp: 785, goldMin: 50, goldMax: 80, atkSpd: 2, dmg: [2, 28], db: 14, hit: 14 },
        "ant_enh": { n: "強化巨蟻", lv: 31, s: "S", beh: "主動", race: "昆蟲", e: "wind", hp: 440, ac: -15, mr: 60, exp: 962, goldMin: 60, goldMax: 90, atkSpd: 2, dmg: [2, 31], db: 15, hit: 14 },
        "ant_enh_white": { n: "強化白螞蟻群", lv: 34, s: "S", beh: "主動", race: "昆蟲", e: "fire", hp: 580, ac: -16, mr: 60, exp: 1157, goldMin: 65, goldMax: 100, atkSpd: 1, dmg: [1, 34], db: 8, hit: 15 },
        "ant_assault": { n: "巨大突擊螞蟻", lv: 37, s: "S", beh: "主動", race: "昆蟲", e: "wind", hp: 640, ac: -20, mr: 60, exp: 1370, goldMin: 75, goldMax: 110, atkSpd: 2, dmg: [2, 37], db: 19, hit: 18 },
        "ant_giant_enh_white": { n: "巨大強化白螞蟻", lv: 40, s: "L", beh: "主動", race: "昆蟲", e: "fire", hp: 740, ac: -24, mr: 60, exp: 1601, goldMin: 85, goldMax: 115, atkSpd: 2, dmg: [2, 40], db: 20, hit: 20 },
        "ant_guard": { n: "巨大守護螞蟻", lv: 44, s: "L", beh: "主動", race: "昆蟲", e: "none", hp: 4400, ac: -48, mr: 60, exp: 1937, goldMin: 100, goldMax: 135, atkSpd: 2, dmg: [2, 44], db: 22, hit: 22, mag: { skn: "觸角攻擊", cd: 50, dmg: [1, 60], db: 20, ele: "none", alwaysHit: true } },
        // ===== 🏴‍☠️ 海賊島 怪物 =====
        "pirate_wildpoison": { n: "狂野之毒", lv: 18, s: "S", beh: "主動", race: "動物", e: "wind", hp: 180, ac: 0, mr: 5, exp: 325, goldMin: 41, goldMax: 78, atkSpd: 2, dmg: [2, 18], db: 1, hit: 6, mag: { skn: "中毒", cd: 50, type: "poison", pbase: 100, d: 10, tick: 5, dur: 20 } },
        "pirate_lizardrage": { n: "狂暴蜥蜴人", lv: 20, s: "S", beh: "主動", race: "蜥蜴人", e: "wind", hp: 200, ac: -4, mr: 10, exp: 485, goldMin: 50, goldMax: 93, atkSpd: 2, dmg: [2, 20], db: 1, hit: 7 },
        "pirate_wildfang": { n: "狂野毒牙", lv: 18, s: "S", beh: "主動", race: "動物", e: "earth", hp: 180, ac: -6, mr: 10, exp: 325, goldMin: 61, goldMax: 110, atkSpd: 1, dmg: [1, 18], db: 1, hit: 5 },
        "pirate_wilddemon": { n: "狂野之魔", lv: 20, s: "S", beh: "主動", race: "動物", e: "wind", hp: 200, ac: -10, mr: 10, exp: 401, goldMin: 73, goldMax: 129, atkSpd: 1, dmg: [1, 20], db: 1, hit: 6, mag: { skn: "初級治癒術", cd: 70, type: "self_heal", heal: [1, 30] } },
        "pirate_lizardhigh": { n: "高等蜥蜴人", lv: 25, s: "S", beh: "主動", race: "蜥蜴人", e: "water", hp: 160, ac: -10, mr: 15, exp: 626, goldMin: 80, goldMax: 140, atkSpd: 2, dmg: [2, 22], db: 3, hit: 7, mag: { skn: "初級治癒術", cd: 70, type: "self_heal", heal: [1, 30] }, mag2: { skn: "投射水泡", cd: 50, dmg: [2, 25], db: 10, ele: "water", alwaysHit: true } },
        "pirate_bluetail": { n: "藍尾蜥蜴", lv: 24, s: "S", beh: "主動", race: "動物", e: "water", hp: 240, ac: -15, mr: 10, exp: 577, goldMin: 102, goldMax: 173, atkSpd: 2, dmg: [2, 24], db: 3, hit: 7 },
        "pirate_parrot": { n: "奇異鸚鵡", lv: 25, s: "S", beh: "主動", race: "動物", e: "wind", hp: 300, ac: -20, mr: 10, exp: 626, goldMin: 109, goldMax: 186, atkSpd: 2, dmg: [2, 25], db: 4, hit: 7 },
        "pirate_chest": { n: "藏寶箱", lv: 1, s: "S", beh: "被動", race: "寶箱", noAttack: true, e: "none", hp: 1, ac: 0, mr: 0, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 2, dmg: [0, 0], db: 0, hit: 0 },
        "pirate_skeleton": { n: "海賊骷髏", lv: 25, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 220, ac: -18, mr: 40, exp: 626, goldMin: 109, goldMax: 186, atkSpd: 2, dmg: [2, 25], db: 10, hit: 9 },
        "pirate_lizardheavy": { n: "重裝蜥蜴人", lv: 24, s: "S", beh: "主動", race: "蜥蜴人", e: "wind", hp: 250, ac: -15, mr: 15, exp: 577, goldMin: 102, goldMax: 173, atkSpd: 2, dmg: [2, 24], db: 9, hit: 9 },
        "pirate_skelsoldier": { n: "海賊骷髏士兵", lv: 28, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 260, ac: -16, mr: 25, exp: 785, goldMin: 135, goldMax: 225, atkSpd: 2, dmg: [2, 28], db: 12, hit: 11 },
        "pirate_skelblade": { n: "海賊骷髏刀手", lv: 32, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 500, ac: -25, mr: 60, exp: 1025, goldMin: 173, goldMax: 285, atkSpd: 3, dmg: [3, 28], db: 19, hit: 11 },
        "pirate_skelchief": { n: "海賊骷髏首領", lv: 32, s: "S", beh: "主動", race: "不死", un: true, e: "earth", hp: 350, ac: -23, mr: 50, exp: 1025, goldMin: 173, goldMax: 285, atkSpd: 2, dmg: [2, 28], db: 12, hit: 11 },
        "pirate_drake": { n: "德雷克", lv: 42, s: "S", beh: "主動", boss: true, hard: true, race: "不死", un: true, e: "earth", hp: 11200, ac: -35, mr: 50, exp: 1765, goldMin: 292, goldMax: 470, atkSpd: 2, dmg: [2, 84], db: 66, hit: 37, mag: { skn: "迴旋斬", cd: 100, dmg: [5, 42], db: 42, ele: "none", alwaysHit: true } },
    },
	
	    // 👇 完整的城鎮系統資料庫
    towns: {
        "town_silver_knight": {
            n: "銀騎士村",
            npcs: [
                { id: "npc_glin", n: "格林", title: "雜貨商人", type: "shop", d: "櫃檯後堆滿了行囊與雜物，格林笑著招呼上門的冒險者，販賣各種日常消耗品。" },
                { id: "npc_wh_silver", n: "高特", title: "倉庫", type: "warehouse", d: "高特看守著厚重的鐵庫房，替旅人妥善存放物品與金幣，四個存檔角色共用。" },
                { id: "npc_moli", n: "茉莉", title: "製作", type: "craft", d: "茉莉指間的針線從不停歇，能為冒險者製作皮革裝備。" },
				{ id: "npc_finn", n: "芬", title: "製作", type: "craft", d: "芬在工坊裡敲打不停，提供物品製作服務。" },
                { id: "npc_joel", n: "喬爾", title: "製作", type: "craft", d: "喬爾是個沉默而可靠的老匠人，提供物品製作服務。" },
                { id: "npc_ricky", n: "瑞奇", title: "試煉", type: "quest", d: "瑞奇曾是身經百戰的騎士。騎士的試煉：收集特定物品可換取專屬頭部裝備。" },
                { id: "npc_red", n: "雷德", title: "任務", type: "quest", d: "雷德眼中燃著難以平息的怒火。雷德的復仇：打倒蕾雅的部下並帶回證明物。" }
            ]
        },
        "town_kent_castle": {
            n: "肯特城",
            npcs: [
                { id: "npc_nikki", n: "尼奇", title: "雜貨商人", type: "shop", d: "硝煙散去後，尼奇在新得的城裡擺起攤子——攻城獲勝後開放的肯特城雜貨商。" },
                { id: "npc_wh_kent", n: "巴歐", title: "倉庫", type: "warehouse", d: "巴歐替占領者看管著肯特城的庫房，存放物品與金幣，四個存檔角色共用。" },
                { id: "npc_ally_b", n: "傭兵公會", title: "協力", type: "ally", d: "傭兵公會替你牽起命運的絲線，召喚其他存檔位的角色一起作戰。" },
                { id: "npc_ismael", n: "伊賽馬利", title: "交換物品", type: "exchange", traditionalHide: true, d: "伊賽馬利精於以物易物，以卷軸或金幣交換稀有的祝福卷軸與飾品卷軸。" },
                { id: "npc_pandora", n: "潘朵拉", title: "黑市", type: "exchange", d: "潘朵拉的黑市藏匿著來路不明的寶物，每 10 分鐘隨機上架一件商品，可直接購買。" },
                { id: "npc_kent_guard", n: "肯特守衛隊長", title: "城堡護衛", type: "castleguard", d: "肯特守衛隊長以盾為誓，雇用守衛替你承擔 10% 一般攻擊傷害（HP 低於設定門檻時發動）。" },
                { id: "npc_esti", n: "依詩蒂", title: "血盟", type: "pledge", d: "依詩蒂低聲訴說著血盟的古老誓言，為你尋找以血為盟的夥伴。" },
                { id: "npc_tros", n: "特羅斯", title: "血盟", type: "pledge", d: "特羅斯握劍而立，為你尋找以血為盟的夥伴。" },
                { id: "npc_obel", n: "奧貝勒", title: "魔物追蹤", type: "exchange", d: "奧貝勒是追蹤魔物的老手，消耗王族搜索狀，追蹤指定地區的特定魔物。" }
            ]
        },
        "town_windwood_castle": {
            n: "風木城",
            npcs: [
                { id: "npc_landish", n: "藍迪西", title: "雜貨商人", type: "shop", d: "風木城易主後，藍迪西重新支起攤位——攻下風木城後開放的雜貨商。" },
                { id: "npc_wh_windwood", n: "寶金", title: "倉庫", type: "warehouse", d: "寶金在風木城的庫房裡清點貨物，替你存放物品與金幣，四個存檔角色共用。" },
                { id: "npc_ww_guard", n: "風木傭兵隊長", title: "城堡護衛", type: "castleguard", d: "風木傭兵隊長深諳抵禦法術之道，雇用守衛替你承擔 10% 魔法攻擊傷害（HP 低於設定門檻時發動）。" },
                { id: "npc_esti", n: "依詩蒂", title: "血盟", type: "pledge", d: "依詩蒂低聲訴說著血盟的古老誓言，為你尋找以血為盟的夥伴。" },
                { id: "npc_tros", n: "特羅斯", title: "血盟", type: "pledge", d: "特羅斯握劍而立，為你尋找以血為盟的夥伴。" },
                { id: "npc_hert", n: "赫特", title: "魔物追蹤", type: "exchange", d: "赫特循著魔物的氣息而行，消耗王族搜索狀，追蹤指定地區的特定魔物。" }
            ]
        },
        "town_heine_castle": {
            n: "海音城",
            npcs: [
                { id: "npc_suvan", n: "須凡", title: "雜貨商人", type: "shop", d: "海音城歸入麾下後，須凡在港邊開張——攻下海音城後開放的雜貨商。" },
                { id: "npc_wh_heine", n: "哈金", title: "倉庫", type: "warehouse", d: "哈金守著海音城的倉庫，替你存放物品與金幣，四個存檔角色共用。" },
                { id: "npc_heine_guard", n: "海音神官隊長", title: "城堡治療", type: "castleguard", d: "海音神官隊長以聖光庇佑同袍，雇用神官在你 HP 低於設定門檻時，每 5 秒為你施放治癒術。" },
                { id: "npc_esti", n: "依詩蒂", title: "血盟", type: "pledge", d: "依詩蒂低聲訴說著血盟的古老誓言，為你尋找以血為盟的夥伴。" },
                { id: "npc_tros", n: "特羅斯", title: "血盟", type: "pledge", d: "特羅斯握劍而立，為你尋找以血為盟的夥伴。" },
                { id: "npc_diren", n: "帝倫", title: "魔物追蹤", type: "exchange", d: "帝倫熟知各地魔物的蹤跡，消耗王族搜索狀，追蹤指定地區的特定魔物。" }
            ]
        },
        "town_talking": {
            n: "說話之島",
            npcs: [
                { id: "npc_gilen", n: "吉倫", title: "魔法傳授者", type: "skill", d: "吉倫是位循循善誘的魔法導師，提供玩家學習1~3級一般魔法。" },
                { id: "npc_basin", n: "巴辛", title: "妖魔商人", type: "shop", d: "巴辛是混跡市集的妖魔商人，販賣各種日常消耗品。" },
                { id: "npc_wh_talking", n: "朵琳", title: "倉庫", type: "warehouse", d: "朵琳細心地替旅人看管行囊，存放物品與金幣，四個存檔角色共用。" },
                { id: "npc_pandora", n: "潘朵拉", title: "黑市", type: "exchange", d: "潘朵拉的黑市藏匿著來路不明的寶物，每 10 分鐘隨機上架一件商品，可直接購買。" },
                { id: "npc_ladal", n: "拉達爾", title: "製作", type: "craft", d: "拉達爾揉皮裁料樣樣精通，能為冒險者製作皮革裝備。" },
				{ id: "npc_falin", n: "法林", title: "製作", type: "craft", d: "法林手藝獨到，能製作銀釘皮裝備。" },
                { id: "npc_ryan", n: "萊恩", title: "製作", type: "craft", d: "萊恩在爐火旁默默打磨成品，提供物品製作服務。" },
				{ id: "npc_james", n: "詹姆", title: "試煉", type: "quest", d: "法師的試煉：傳說唯有獻上足夠的祭品，才能讀懂封印其中的奧義。收集祭品可換取魔法能量之書。" },
				{ id: "npc_gunter", n: "甘特", title: "試煉", type: "quest", d: "騎士的試煉：榮耀從不輕易賜予。收集特定材料可換取專屬裝備。" },
                { id: "npc_yuria", n: "尤麗婭", title: "兌換", type: "quest", d: "據說歐林曾將自己的鍛甲心得寫進日記。以歐林的日記本兌換臂甲（裝於副手，可與雙手武器並用；三選一）。" },
                { id: "npc_rabiani", n: "拉比安尼", title: "製作", type: "craft", d: "宮廷御用的鍛書師，能將四顆心臟之力封入書頁。以四種心之材料為王族鍛造特殊魔法書（灼熱武器／勇猛意志／閃亮之盾／王者加護）。" }
            ]
        },
        "town_elf": {
            n: "妖精森林",
            npcs: [			
                { id: "npc_elpin", n: "埃爾頻", title: "雜貨商人", type: "shop", d: "店裡擺滿旅人路上少不了的小東西。販售各種日常消耗品。" },
                { id: "npc_wh_elf", n: "艾爾", title: "倉庫", type: "warehouse", d: "沉默寡言的守庫人，替你看顧每一枚硬幣。存放物品與金幣，四個存檔角色共用。" },
				{ id: "npc_linda", n: "琳達", title: "精靈魔法商人", type: "shop", d: "精靈族的水晶在她手中閃著微光。販賣各種基本精靈水晶。" },
                { id: "npc_elion", n: "艾利溫", title: "妖精屬性學習", type: "quest", d: "掌管妖精元素契約的智者，他會引領你做出一生只有一次的抉擇。妖精選擇屬性魔法的重要NPC，四種屬性只能選擇一種。" },
                { id: "npc_nalien", n: "那翰", title: "製作", type: "craft", d: "指間流轉著森林的旋律，他能將你的素材化為動聽之器。提供協助製作魔法笛子。" },
                { id: "npc_narupa", n: "娜魯帕", title: "製作", type: "craft", d: "妖精族的巧手匠人，最懂得貼合妖精身形的工藝。提供協助製作各種妖精專用裝備。" },
                { id: "npc_elfqueen", n: "精靈女皇", title: "製作", type: "craft", d: "端坐於精靈聖域的女皇，唯有她識得奧里哈魯根的鍛造秘法。提供協助製作奧里哈魯根。" },
                { id: "npc_elf", n: "精靈", title: "製作", type: "craft", d: "靜守森林深處的精靈，能將原料淬鍊出純粹的光輝。提供協助製作純粹的米索莉塊、精靈羽翼。" },
                { id: "npc_ent", n: "安特", title: "製作", type: "craft", d: "年歲悠長的樹人，只要奉上一杯蘑菇汁，便願剝下一片自己的樹皮相贈。給予蘑菇汁可獲得安特之樹皮。" },
                { id: "npc_pan", n: "潘", title: "製作", type: "craft", d: "頭頂彎角的牧神，金屬與骨角皆在他的爐火下成形。提供協助製作米索莉金屬板、奧里哈魯根金屬板、潘的角。" },
                { id: "npc_rekne", n: "芮克妮", title: "製作", type: "craft", d: "以蛛絲織就萬物的紡者，她的線能縫合最堅韌之物。提供協助製作線、米索莉線、芮克妮的蛻皮。" },
				{ id: "npc_brabo", n: "布拉伯", title: "製作", type: "craft", d: "精靈軍械的老匠師，弓與刃的每一處部件都出自他手。提供精靈專屬武器與部件的製作。" },
				{ id: "npc_robinson", n: "羅賓孫", title: "製作", type: "craft", d: "傳說中的鑄弓人，唯有集齊精靈王與神獸的精魄，才肯點燃那把傳說之炎。蒐集精靈王與獨角獸、格利芬的稀有素材，可打造傳說的熾炎天使弓。" },
				{ id: "npc_mother", n: "迷幻森林之母", title: "試煉", type: "quest", d: "迷幻森林的守護之母，她的恩賜只賜予能洗淨黑暗之人。妖精的試煉：淨化受詛咒的書來換取精靈的恩賜。" }
            ]
        },
		"town_gludio": {
            n: "燃柳村",
            npcs: [
                { id: "npc_os", n: "歐斯", title: "試煉", type: "quest", d: "考驗妖精意志的試煉者，唯有降服四大妖魔者方能受其加冠。妖精的試煉：收集四大妖魔魔法書可換取專屬頭盔。" }
            ]
        },
        "town_giran": {
            n: "奇岩",
            npcs: [
                { id: "npc_meyer", n: "邁爾", title: "雜貨商人", type: "shop", d: "親切的雜貨老闆，再偏遠的旅途也備齊了該有的補給。販售各種日常消耗品。" },
				{ id: "npc_wino", n: "溫諾", title: "武器商人", type: "shop", d: "識貨的武器商人，架上每一把都曾飲過血。販賣各式各樣強大的武器。" },
				{ id: "npc_vangil", n: "范吉爾", title: "防具商人", type: "shop", d: "防具商人，深知活著回來的人靠的是一身好甲。販售各種堅固耐用的防具。" },
                { id: "npc_evert", n: "愛弗特", title: "布料商人", type: "shop", d: "眼光獨到的布料商，遠渡重洋的織品只為最講究的裁縫而備。販售製作高級服飾所需的進口布料。" },
				{ id: "npc_moliya", n: "莫麗雅", title: "製作", type: "craft", d: "潛心鑽研奧術的女工匠，唯有同道的法師方能托她打造法器。只有法師職業來此，可以製作法師專用的道具。" },
                { id: "npc_hector", n: "海克特", title: "製作", type: "craft", d: "爐火終年不熄的鋼鐵鍛造師，他的鎚聲就是品質的保證。為顧客製造鋼鐵道具。" },
                { id: "npc_herbert", n: "哈巴特", title: "製作", type: "craft", d: "手藝精湛的裁縫師，一針一線都縫進了對穿戴者的庇護。可以為人們縫製布料防具。" },
                { id: "npc_lentis", n: "倫提斯", title: "製作", type: "craft", d: "擅長將軍團之力封入金屬的戒指匠師。以軍團印記與軍王徽印打造四屬性的精靈戒指。" },
                { id: "npc_sebas", n: "賽巴斯", title: "寶石加工", type: "craft", d: "奇岩寶石加工坊的巨匠賽巴斯，能將稀世寶石與龍鱗鍛入飾品。製作四屬性戒指與四精靈皮帶。" }
            ]
        },
        "town_heine": {
            n: "海音",
            npcs: [
                { id: "npc_bit", n: "比特", title: "雜貨商人", type: "shop", d: "笑容可掬的雜貨商，總在你最需要時遞上補給。販售各種日常消耗品。" },
                { id: "npc_wh_heine", n: "哈金", title: "倉庫", type: "warehouse", d: "哈金守著海音城的倉庫，替你存放物品與金幣，四個存檔角色共用。" },
                { id: "npc_ally_heine", n: "傭兵公會", title: "協力", type: "ally", d: "傭兵公會的協力之約，可讓不同命運的自己並肩而戰。召喚其他存檔位的角色一起作戰。" },
				{ id: "npc_lumiel", n: "琉米埃爾", title: "製作", type: "craft", d: "受伊娃眷顧的鍛者，能將神聖的祝福織入凡鐵。交換受到伊娃祝福的裝備。" },
                { id: "npc_duwen", n: "多文", title: "試煉", type: "quest", d: "歷盡沙場的老戰士多文，主持戰士的試煉。以試煉道具兌換戰士裝備與技能印記，並主持戰士的 50 級試煉。" },
                { id: "npc_esti", n: "依詩蒂", title: "血盟", type: "pledge", d: "依詩蒂低聲訴說著血盟的古老誓言，為你尋找以血為盟的夥伴。" },
                { id: "npc_isba", n: "依斯巴", title: "港口", type: "travel", d: "老船長依斯巴守著通往迷霧的航線。搭船前往遺忘之島（費用 10 萬金幣）。" }
            ]
        },
		"town_oren": {
            n: "歐瑞村莊",
            npcs: [
                { id: "npc_piwood", n: "畢伍德", title: "雜貨商人", type: "shop", d: "販售各種日常消耗品。" },
                { id: "npc_wh_oren", n: "希林", title: "倉庫", type: "warehouse", d: "存放物品與金幣，四個存檔角色共用。" },
                { id: "npc_ally_oren", n: "傭兵公會", title: "協力", type: "ally", d: "召喚其他存檔位的角色一起作戰。" },
				{ id: "npc_ibelbin", n: "伊貝爾賓", title: "製作", type: "craft", d: "傳說中的鍛冶名匠伊貝爾賓，爐火曾淬煉過斬龍之鋒。能打造屠龍級神兵與護甲。" },
                { id: "npc_david", n: "大衛", title: "寶石加工", type: "craft", d: "大衛擅長雕琢寶石與寒冰結晶，能將 冰之女王的耳環 逐級精煉至更高型態。" },
                { id: "npc_tros", n: "特羅斯", title: "血盟", type: "pledge", d: "特羅斯握劍而立，為你尋找以血為盟的夥伴。" }
            ]
        },
        "town_aden": {
            n: "亞丁",
            npcs: [
                { id: "npc_lawen", n: "拉溫", title: "雜貨商人", type: "shop", d: "販售各種日常消耗品。" },
                { id: "npc_wh_aden", n: "恬金", title: "倉庫", type: "warehouse", d: "存放物品與金幣，四個存檔角色共用。" },
                { id: "npc_upni", n: "烏普尼", title: "製作", type: "craft", d: "通曉禁忌符文的烏普尼，能將塔之力封入一紙。以 傲慢之塔傳送符 與 移動卷軸 製作 傲慢之塔支配符。" },
                { id: "npc_norse", n: "諾斯", title: "寵物裝備製作", type: "craft", d: "獸語匠人諾斯，懂得讓忠犬之牙更加銳利。鍛造寵物裝備，強化你的項圈夥伴。" },
                { id: "npc_baowu", n: "包武", title: "寵物保管", type: "petstore", d: "和善的看護人包武，願替遠行的旅人照看愛犬。替你保管項圈（最多 8 個，與其他存檔角色不共通）。使用回憶蠟燭不會清除保管中的項圈。" }
            ]
        },
        "town_pride": {
            n: "傲慢之塔入口",
            npcs: [
                { id: "npc_pride_shop", n: "雜貨商人", title: "雜貨商人", type: "shop", d: "販售各種日常消耗品。" },
                { id: "npc_bamut", n: "巴姆特", title: "製作", type: "craft", d: "與墮落之物為伍的巴姆特，能將奇美拉之皮鞣成不祥的革。以奇美拉之皮製作詛咒的皮革，並打造四屬性斗篷。" }
            ]
        },
        "town_rift": {   // 🌀 時空裂痕入口（無 NPC，只有進入/領獎按鈕＋時間排名）
            n: "時空裂痕入口",
            npcs: []
        },
		"town_ivory_tower": {
            n: "象牙塔",
            npcs: [
                { id: "npc_paro", n: "帕羅", title: "雜貨商人", type: "shop", d: "販售各種日常消耗品。" },
                { id: "npc_taras", n: "塔拉斯", title: "試煉", type: "quest", d: "鑽研亡者學識的塔拉斯，主持法師的試煉。收集不死族的遺物換取專屬魔杖。" },
                { id: "npc_tas", n: "塔斯", title: "製作", type: "craft", d: "煉藥師塔斯能將純白之力調和成各色靈藥。以 3 個純白的萬能藥，製作任一屬性的萬能藥。" },
                { id: "npc_bayes", n: "巴耶斯", title: "魔法商人", type: "shop", d: "博覽群書的巴耶斯，書架上盡是深奧的咒文。販售各種高階魔法書。" },
                { id: "npc_krista", n: "克里斯特", title: "交換物品", type: "exchange", classicHide: true, d: "克里斯特掌管著祝福的奧秘。以施法卷軸與金幣交換『賦予祝福卷軸』。" },
                { id: "npc_bian", n: "碧恩", title: "祝福裝備", type: "bless", classicHide: true, d: "祝福匠碧恩，能將神聖之力銘刻於裝備之上。用賦予祝福卷軸為身上裝備附加詞綴。" },
                { id: "npc_digallatin", n: "迪嘉勒廷", title: "試煉", type: "quest", d: "嚴苛的試煉主持者迪嘉勒廷，只認可真正的強者。騎士、妖精、法師的 50 級試煉（需等級 50）。" },
                { id: "npc_dytite", n: "迪泰特", title: "解除封印", type: "craft", d: "通曉古法的迪泰特，能讀懂被歲月遺忘的封印。以古代的卷軸解除被遺忘裝備的封印，還原成古老的武器與防具。" }
            ]
        },
        "town_witon": {
            n: "威頓村",
            npcs: [
                { id: "npc_masha", n: "馬沙", title: "試煉", type: "quest", d: "沉默寡言的試煉者馬沙，靜候挑戰者前來。妖精與騎士的試煉。" },
                { id: "npc_han", n: "漢", title: "精通", type: "mastery", classicHide: true, d: "威頓村的傳奇人物漢，早已超越凡人的極限。等級 50 以上的強者，可在此接受超越自我的精通任務。" },   // 🏅
                { id: "npc_keluya", n: "客盧亞", title: "製作", type: "craft", d: "客盧亞傳承著上古鍛造的失落技藝。以古代材料打造古代臂甲與傳說武器（古代神之槍／古代神之斧）。" },
                { id: "npc_zeus_golem", n: "宙斯之熔岩高崙", title: "製作", type: "craft", d: "由熔岩鑄成的宙斯之熔岩高崙，爐心燃著遠古之火，專為戰士鍛兵。以惡魔斧頭與黑色米索莉金屬板為戰士鍛造「魔物的斧頭」。" },
                { id: "npc_doll_merchant", n: "魔法娃娃商人", title: "卡片合成", type: "synth", d: "蒐羅怪物卡片的魔法娃娃商人。能將你身上重複的卡片合成為更高階的卡片——10 張同名普卡換 1 張銀卡，10 張同名銀卡換 1 張金卡。" }
            ]
        },
        "town_sherine": {   // 🔮 新安全區：席琳神殿
            n: "席琳神殿",
            npcs: [
                { id: "npc_sherine", n: "席琳", title: "祈禱", type: "pray", d: "靜謐的神女席琳，傾聽虔誠者的禱詞。等級 40 以上可向席琳祈禱，開啟或關閉「席琳的世界」。" }
            ]
        },
        "town_silent": {   // 🔧 黑暗妖精出生地：沉默洞穴
            n: "沉默洞穴",
            npcs: [
                { id: "npc_skvati", n: "史克瓦提", title: "雜貨商人", type: "shop", d: "黑暗妖精商人史克瓦提，攤上既有日常所需，也有暗影鍛成的兵刃。販售日常消耗品與基礎的黑暗妖精武器。" },
                { id: "npc_wh_silent", n: "雷亞斯", title: "倉庫", type: "warehouse", d: "存放物品與金幣，四個存檔角色共用。" },
                { id: "npc_saedia", n: "賽帝亞", title: "魔法商人", type: "shop", d: "通曉暗影晶體的賽帝亞。販賣黑暗精靈水晶。" },
                { id: "npc_kupu", n: "庫普", title: "製作", type: "craft", d: "黑暗妖精的鋒刃巨匠庫普，以銀與暗影鍛造致命之器。鍛造銀與黑暗妖精的鋼爪、雙刀、十字弓。" },
                { id: "npc_kororanz", n: "可羅蘭斯", title: "製作", type: "craft", d: "鑽研拉斯塔巴德古史的鍛造師可羅蘭斯。集齊封印的歷史書八頁可製成製作武器秘笈，再以軍王／武官武器與聖地遺物等鍛成五件傳說武器。" },
                { id: "npc_runde", n: "倫得", title: "試煉", type: "quest", darkOnly: true, d: "黑暗妖精的試煉：將以鮮血締結的死亡誓約呈上，便能換得潛行於暗影中的影子手套。" },
                { id: "npc_kang", n: "康", title: "試煉", type: "quest", darkOnly: true, d: "黑暗妖精的試煉：獻上妖魔長老首級為憑，方可換得隱沒氣息的影子面具。" },
                { id: "npc_brudica", n: "布魯迪卡", title: "試煉", type: "quest", darkOnly: true, d: "黑暗妖精的試煉：帶回雪怪首級為證，即可換得踏雪無痕的影子長靴。" }
            ]
        },
        "town_hyperia": {   // 🔧 幻術士出生地：希培利亞村莊（試煉/製作 NPC 於後續階段補上）
            n: "希培利亞村莊",
            npcs: [
                { id: "npc_wh_hyperia", n: "倉庫保管員", title: "倉庫", type: "warehouse", d: "存放物品與金幣，所有存檔角色共用。" },
                { id: "npc_sphere", n: "史菲爾", title: "魔法商人", type: "shop", d: "史菲爾守著幻術士代代相傳的記憶水晶，將虛實之術凝於晶中販售。" },
                { id: "npc_bartel", n: "巴特爾", title: "製作", type: "craft", d: "巴特爾能以時空裂痕碎片打造龜裂之核，更擅長鍛造黑曜石奇古獸。" },
                { id: "npc_shenien", n: "希蓮恩", title: "試煉", type: "quest", d: "希蓮恩以試煉道具兌換幻術士裝備與記憶水晶，並主持幻術士的 50 級試煉。" }
            ]
        },
        "town_behemoth": {   // 🐉 龍騎士出生地：貝希摩斯
            n: "貝希摩斯",
            npcs: [
                { id: "npc_wh_behemoth", n: "倉庫保管員", title: "倉庫", type: "warehouse", d: "存放物品與金幣，所有存檔角色共用。" },
                { id: "npc_sempal", n: "森帕爾", title: "龍魔法商人", type: "shop", d: "森帕爾販賣龍騎士書板與消滅者鎖鏈劍，言談間滿是對龍族秘術的敬畏。" },
                { id: "npc_pir", n: "皮爾", title: "製作", type: "craft", d: "皮爾的爐火終年不熄，能鍛造破滅者鎖鏈劍與古代臂甲。" },
                { id: "npc_procel", n: "普洛凱爾", title: "試煉", type: "quest", d: "普洛凱爾以妖魔搜索文件等試煉道具兌換龍騎士裝備與書板，並主持龍騎士的 50 級試煉。" }
            ]
        },
        "town_flame_audience": {
            n: "炎魔謁見所",
            npcs: [
                { id: "npc_flame_shadow", n: "炎魔之影", title: "製作", type: "craft", d: "自炎獄投影而生的炎魔之影，能以墮落素材編織出炎魔的血光斗篷。" },
                { id: "npc_imp", n: "小惡魔", title: "製作", type: "craft", d: "狡黠的小惡魔以惡魔腳鐐與墮落素材，為人鍛造惡魔系列武器。" },
                { id: "npc_flame_smith", n: "炎魔鐵匠", title: "製作", type: "craft", d: "炎魔鐵匠在熔岩爐前敲打不歇，鍛造銀金屬板、黑色米索莉金屬板等金屬板。" },
                { id: "npc_flame_aide", n: "炎魔的輔佐官", title: "耳環製作", type: "craft", d: "炎魔身旁的輔佐官，以靈魂石碎片為人鍛造各式禁忌耳環。" }
            ]
        },
        "town_pirate_village": {
            n: "海賊島村莊",
            npcs: [
                { id: "npc_boni", n: "波尼", title: "雜貨商人", type: "shop", d: "波尼在棧橋邊擺著攤子，販售各種航海日常與消耗品。" },
                { id: "npc_wh_pirate", n: "庫得", title: "倉庫", type: "warehouse", d: "庫得替往來的海賊看守貨艙，存放物品與金幣，四個存檔角色共用。" },
                { id: "npc_shimizhe", n: "希米哲", title: "任務", type: "quest", d: "希米哲在岸邊久候，盼著尋回亡子的遺物。帶來 兒子的信、兒子的遺骸、兒子的肖像畫 各一，可兌換 藍海賊頭巾。" }
            ]
        }

    },
	
	skills: {
        // ================= 【法師魔法】 =================
        // 一階魔法 (Lv 4)
        "sk_heal1": { n: "初級治癒術", type: "heal", tier: 1, reqM: 4, reqE: 8, reqK: 16, mp: 4, valBase: 0, valDice: [1, 15], healDice: [1, 20], healBase: 20, msg: "你感覺舒服了一點。" },
        "sk_sunlight": { n: "日光術", type: "buff", tier: 1, reqM: 4, reqE: 8, reqK: 16, reqI: 10, reqDk: 15, mp: 4, dur: 7200, msg: "你更容易被怪物發現了。" },
        "sk_shield": { n: "保護罩", type: "buff", tier: 1, reqM: 4, reqE: 8, reqK: 16, mp: 2, dur: 1200, d: { ac: 2 } },
        "sk_lightarrow": { n: "光箭", type: "atk", tier: 1, reqM: 4, reqE: 8, reqK: 16, mp: 3, dmgType: "magic", ele: "none", dmgDice: [1, 6] },
        "sk_teleport": { n: "傳送術", type: "manual", tier: 1, reqM: 4, reqE: 8, reqK: 16, reqI: 10, reqDk: 15, mp: 5, mEff: "teleport" },
        "sk_icearrow": { n: "冰箭", type: "atk", tier: 1, reqM: 4, reqE: 8, reqK: 16, mp: 3, dmgType: "magic", ele: "water", dmgDice: [1, 4] },
        "sk_windblade": { n: "風刃", type: "atk", tier: 1, reqM: 4, reqE: 8, reqK: 16, mp: 3, dmgType: "magic", ele: "wind", dmgDice: [1, 4] },
        "sk_holy_wpn": { n: "神聖武器", type: "buff", tier: 1, reqM: 4, reqE: 8, reqK: 16, mp: 10, dur: 1200, d: { extraDmg: 1, extraHit: 1 }, msg: "你的武器暫時被注入了神聖力量。" },

        // 二階魔法 (Lv 8)
        "sk_antidote": { n: "解毒術", type: "heal", tier: 2, reqM: 8, reqE: 16, mp: 8, msg: "你感覺毒素消退了。" },
        "sk_cold_shiver": { n: "寒冷戰慄", type: "atk", tier: 2, reqM: 8, reqE: 16, mp: 9, dmgType: "magic", ele: "none", dmgDice: [1, 8], lifesteal: true, healSlot: true },
        "sk_poison_curse": { n: "毒咒", type: "atk", tier: 2, reqM: 8, reqE: 16, mp: 10, dmgType: "magic", status: { kind: "poison", pbase: 100, dur: 15, tick: 3, dmg: [1, 8] }, msg: "你使目標中毒了。" },
        "sk_ench_wpn": { n: "擬似魔法武器", type: "buff", tier: 2, reqM: 8, reqE: 16, mp: 20, dur: 1800, d: { extraDmg: 2 }, msg: "你的武器暫時被注入了魔法力量。" },
        "sk_reveal": { n: "無所遁形術", type: "buff", tier: 2, reqM: 8, reqE: 16, mp: 8, dur: 180 },
        "sk_load_up": { n: "負重強化", type: "buff", tier: 2, reqM: 8, reqE: 16, reqD: 16, mp: 10, dur: 1800, label: "增益", loadUpBuff: true, msg: "感覺到身體變輕了。" },   // 🔧 改版：負重上限+50（持續1800秒，效果結束才再施放）
        "sk_firearrow": { n: "火箭", type: "atk", tier: 2, reqM: 8, reqE: 16, mp: 3, dmgType: "magic", ele: "fire", dmgDice: [1, 4] },
        "sk_hell_fang": { n: "地獄之牙", type: "atk", tier: 2, reqM: 8, reqE: 16, mp: 3, dmgType: "magic", ele: "earth", dmgDice: [1, 4] },

        // 三階魔法 (Lv 12)
        "sk_aurora": { n: "極光雷電", type: "atk", tier: 3, reqM: 12, reqE: 24, mp: 13, dmgType: "magic", ele: "wind", target: "all", dmgDice: [2, 14] },
        "sk_undead_bane": { n: "起死回生術", type: "atk", tier: 3, reqM: 12, reqE: 24, mp: 15, dmgType: "magic", instakill: { tag: "undead", cap: 12 } },   // 🔧 即死成功率最高 60%
        "sk_heal_mid": { n: "中級治癒術", type: "heal", tier: 3, reqM: 12, reqE: 24, mp: 11, valDice: [1, 30], healDice: [1, 50], healBase: 50, msg: "你感覺舒服了一點。" },
        "sk_dark_blind": { n: "闇盲咒術", type: "atk", tier: 3, reqM: 12, reqE: 24, mp: 20, dmgType: "magic", status: { kind: "blind", pbase: 150, hit: 4, dur: 10 } },
        "sk_shield2": { n: "鎧甲護持", type: "buff", tier: 3, reqM: 12, reqE: 24, mp: 20, dur: 1800, d: { ac: 3 }, msg: "你的盔甲暫時被注入了魔法力量。" },
        "sk_chill": { n: "寒冰氣息", type: "atk", tier: 3, reqM: 12, reqE: 24, mp: 9, dmgType: "magic", ele: "water", target: "all", dmgDice: [3, 6] },
        "sk_energy_sense": { n: "能量感測", type: "manual", tier: 3, reqM: 12, reqE: 24, mp: 8, mEff: "sense" },

        // 四階魔法 (Lv 16)
        "sk_fireball": { n: "燃燒的火球", type: "atk", tier: 4, reqM: 16, reqE: 32, mp: 16, dmgType: "magic", ele: "fire", target: "all", multiDmg: [[2, 6], [3, 6]] },
        "sk_dex_up": { n: "通暢氣脈術", type: "buff", tier: 4, reqM: 16, reqE: 32, mp: 45, dur: 1200, d: { dex: 5 }, msg: "你覺得身手變得更靈活。" },
        "sk_break": { n: "壞物術", type: "atk", tier: 4, reqM: 16, reqE: 32, mp: 20, dmgType: "magic", status: { kind: "broken", pbase: 150, dur: 25 } },
        "sk_vampire": { n: "吸血鬼之吻", type: "atk", tier: 4, reqM: 16, reqE: 32, mp: 13, dmgType: "magic", ele: "none", dmgDice: [2, 8], lifesteal: true, healSlot: true },
        "sk_slow": { n: "緩速術", type: "atk", tier: 4, reqM: 16, reqE: 32, mp: 20, dmgType: "magic", status: { kind: "slow", pbase: 150, dur: 30 } },
        "sk_holy_lightning": { n: "致命落雷", type: "atk", tier: 6, dmgType: "magic", ele: "wind", dmgDice: [6, 10] },   // 🏛️ 聖晶魔杖 procSkill 用：6D10 風屬性·走 procFreeMagicSkill（武器 proc 不套法師階級加成·非可學技能）
        "sk_rock_prison": { n: "岩牢", type: "atk", tier: 4, reqM: 16, reqE: 32, mp: 11, dmgType: "magic", ele: "earth", target: "all", dmgDice: [4, 5] },
        "sk_magic_shield": { n: "魔法屏障", type: "buff", tier: 4, reqM: 16, reqE: 32, mp: 16, dur: 16 },
        "sk_meditation": { n: "冥想術", type: "buff", tier: 4, reqM: 16, reqE: 32, hpCost: 40, mp: 10, dur: 600, d: { mpR: 5 } },

        // 五階魔法 (Lv 20)
        "sk_mummy_curse": { n: "木乃伊的詛咒", type: "atk", tier: 5, reqM: 20, reqE: 40, mp: 35, dmgType: "magic", status: { kind: "stone", pbase: 100, dur: 6 } },
        "sk_charm": { n: "迷魅術", type: "manual", tier: 5, reqM: 20, reqE: 40, mp: 30, mEff: "charm" },
        "sk_thunder": { n: "極道落雷", type: "atk", tier: 5, reqM: 20, reqE: 40, mp: 25, dmgType: "magic", ele: "wind", dmgDice: [6, 8] },
        "sk_heal2": { n: "高級治癒術", type: "heal", tier: 5, reqM: 20, reqE: 40, mp: 20, valDice: [2, 30], healDice: [1, 100], healBase: 100, msg: "你感覺舒服了一點。" },
        "sk_holy_light": { n: "聖潔之光", type: "heal", tier: 5, reqM: 20, reqE: 40, mp: 10, msg: "神聖光芒驅散了詛咒。" },
        "sk_ice_spike": { n: "冰錐", type: "atk", tier: 5, reqM: 20, reqE: 40, mp: 21, dmgType: "magic", ele: "water", dmgDice: [6, 6] },
        "sk_demon_kiss": { n: "惡魔之吻", type: "atk", tier: 3, mp: 0, dmgType: "magic", ele: "earth", dmgDice: [3, 20], procOnly: true },   // 🏛️ 底比斯歐西里斯武器附魔施放（procSkill·不需學習/不耗MP·受魔法傷害公式影響）；procOnly：純武器proc、不顯示於技能列表/下拉
        "sk_mana_drain": { n: "魔力奪取", type: "convert", tier: 5, reqM: 20, reqE: 40, hpCost: 50, drain: true },   // 🔧 改為轉換技能（法師/妖精）：消耗HP、需對怪物施展且以異常魔法命中判定，命中吸取 MP=1D(怪物等級/2)；其餘機制比照魂體轉換
        "sk_dark_shadow": { n: "黑闇之影", type: "atk", tier: 5, reqM: 20, reqE: 40, mp: 25, dmgType: "magic", status: { kind: "blind", pbase: 150, hit: 5, dur: 20 } },

        // 六階魔法 (Lv 24)
        "sk_zombie": { n: "造屍術", type: "buff", tier: 6, reqM: 24, reqE: 48, mp: 35, dur: 3600, summon: { n: "隨從：人形殭屍", dmgDice: [1, 12], dmgDiv: 5, dmgLvDiv: 20, interval: 20, kind: "melee", hitLvOff: 0 } },
        "sk_haste_spell": { n: "加速術", type: "buff", tier: 6, reqM: 24, reqE: 48, mp: 40, dur: 1200, haste: true, msg: "你感到身體變得非常輕盈。" },
        "sk_cancel": { n: "魔法相消術", type: "heal", tier: 6, reqM: 24, reqE: 48, mp: 40, msg: "你全身上下感到涼意。" },
        "sk_earthquake": { n: "地裂術", type: "atk", tier: 6, reqM: 24, reqE: 48, mp: 25, dmgType: "magic", ele: "earth", dmgDice: [8, 6] },
        "sk_blaze": { n: "烈炎術", type: "atk", tier: 6, reqM: 24, reqE: 48, mp: 30, dmgType: "magic", ele: "fire", dmgDice: [1, 60] },
        "sk_str_up": { n: "體魄強健術", type: "buff", tier: 6, reqM: 24, reqE: 48, mp: 50, dur: 1200, d: { str: 5 }, msg: "你覺得身體充滿了力量。" },
        "sk_bless_wpn": { n: "祝福魔法武器", type: "buff", tier: 6, reqM: 24, reqE: 48, mp: 20, dur: 1200, d: { extraDmg: 2, extraHit: 2 }, msg: "你的武器暫時被注入了魔法力量。" },
        "sk_weaken": { n: "弱化術", type: "atk", tier: 6, reqM: 24, reqE: 48, mp: 25, dmgType: "magic", status: { kind: "weaken", pbase: 150, dur: 30 } },

        // 七階魔法 (Lv 28)
        "sk_regen": { n: "體力回復術", type: "heal", tier: 7, reqM: 28, mp: 35, hot: { interval: 30, ticks: 5 }, valDice: [1, 20], healDice: [1, 30], healBase: 30, msg: "你的傷口逐漸癒合。", autoBuff: true },
        "sk_greater_haste": { n: "強力加速術", type: "buff", tier: 7, reqM: 28, mp: 60, dur: 2400, haste: true, msg: "你感到身體變得非常輕盈。" },
        "sk_ice_lance": { n: "冰矛圍籬", type: "atk", tier: 7, reqM: 28, mp: 30, dmgType: "magic", ele: "water", dmgDice: [5, 10], freeze: 200 },
        "sk_tornado": { n: "龍捲風", type: "atk", tier: 7, reqM: 28, mp: 45, dmgType: "magic", ele: "wind", target: "all", multiDmg: [[1, 18], [1, 18], [1, 18]] },
        "sk_berserk": { n: "狂暴術", type: "buff", tier: 7, reqM: 28, mp: 40, dur: 1200, d: { meleeDmg: 5, ac: -10 }, msg: "你的野性逐漸支配理智。" },
        "sk_summon": { n: "召喚術", type: "buff", tier: 7, reqM: 28, mp: 50, dur: 3600, summon: { tiered: true } },
        "sk_holy_dash": { n: "神聖疾走", type: "buff", tier: 7, reqM: 28, mp: 20, dur: 64, d: { er: 15 }, msg: "你覺得身體變輕了。" },
        "sk_disease": { n: "疾病術", type: "atk", tier: 7, reqM: 28, mp: 30, dmgType: "magic", status: { kind: "disease", pbase: 150, dur: 30 } },

        // 八階魔法 (Lv 32)
        "sk_full_heal": { n: "全部治癒術", type: "heal", tier: 8, reqM: 32, mp: 30, valDice: [3, 30], healDice: [3, 50], healBase: 150, msg: "你感覺舒服了不少。" },
        "sk_blizzard": { n: "冰雪暴", type: "atk", tier: 8, reqM: 32, mp: 60, dmgType: "magic", ele: "water", target: "all", multiDmg: [[2, 8], [2, 8], [2, 8], [2, 8]] },
        "sk_blizzard_storm": { n: "冰雪颶風", type: "buff", tier: 10, reqM: 40, mp: 60, dur: 32, ele: "water", target: "all", noRefresh: true, stormInterval: 40, dmgDice: [1, 10], freezeHitOff: -3, msg: "冰雪颶風在你周身成形。" },   // 🌨️ 輔助勾選維持的傷害增益：每4秒對全體造成1D10水傷+冰凍(魔命-3)；傷害由 stormBuffTick 處理
        "sk_fire_prison": { n: "火牢", type: "buff", tier: 8, reqM: 32, mp: 60, dur: 10, ele: "fire", target: "all", noRefresh: true, stormInterval: 20, dmgDice: [1, 15], msg: "熊熊火牢在你周身燃起。" },   // 🔥 輔助勾選維持的傷害增益：每2秒對全體造成1D15火傷（無異常）；傷害由 stormBuffTick 處理
        "sk_quake": { n: "震裂術", type: "atk", tier: 8, reqM: 32, mp: 40, dmgType: "magic", ele: "earth", target: "all", dmgDice: [4, 11] },
        "sk_invisible": { n: "隱身術", type: "buff", tier: 8, reqM: 32, hpCost: 20, mp: 45, dur: 64 },
        "sk_resurrection": { n: "返生術", type: "passive", tier: 8, reqM: 32, mp: 50 },
        "sk_seal": { n: "魔法封印", type: "atk", tier: 8, reqM: 32, mp: 30, dmgType: "magic", status: { kind: "vacuum", pbase: 100, dur: 16 } },

        // 九階魔法 (Lv 36)
        "sk_holy_barrier": { n: "聖結界", type: "buff", tier: 9, reqM: 36, mp: 30, dur: 32, msg: "一道神聖的防禦屏障保護著你。" },
        "sk_sleep_mist": { n: "沉睡之霧", type: "atk", tier: 9, reqM: 36, mp: 40, dmgType: "magic", target: "all", status: { kind: "sleep", pbase: 100, dur: 8 } },
        "sk_thunder_storm": { n: "雷霆風暴", type: "atk", tier: 9, reqM: 36, mp: 48, dmgType: "magic", ele: "wind", target: "all", multiDmg: [[1, 9], [1, 9], [1, 9], [1, 9], [1, 9]] },
        "sk_fire_storm": { n: "火風暴", type: "atk", tier: 9, reqM: 36, mp: 48, dmgType: "magic", ele: "fire", target: "all", multiDmg: [[3, 9], [3, 9]] },

        // 十階魔法 (Lv 40)
        "sk_meteor": { n: "流星雨", type: "atk", tier: 10, reqM: 40, mp: 60, dmgType: "magic", ele: "fire", target: "all", multiDmg: [[1, 10], [1, 10], [1, 10], [1, 10], [1, 10], [1, 10]] },
        "sk_soul_up": { n: "靈魂昇華", type: "buff", tier: 10, reqM: 40, mp: 20, dur: 1200, msg: "你覺得身體充滿了活力。" },
        "sk_abs_barrier": { n: "絕對屏障", type: "manual", tier: 10, reqM: 40, mp: 30, mEff: "barrier", dur: 7, label: "增益", msg: "你感覺身體與這個世界隔絕了。" },
        "sk_disintegrate": { n: "究極光裂術", type: "atk", tier: 10, reqM: 40, mp: 70, dmgType: "magic", ele: "none", dmgDice: [1, 120] },

        // ================= 【騎士技術】 =================
        "sk_solid_shield": { n: "堅固防護", type: "buff", tier: 2, reqK: 40, hpCost: 30, mp: 5, dur: 180, reqShield: true, d: { er: 15 } },
        "sk_reduction_armor": { n: "增幅防禦", type: "buff", tier: 1, reqK: 30, mp: 10, dur: 1200 },
        "sk_shock_stun": { n: "衝擊之暈", type: "atk", tier: 1, reqK: 30, mp: 12, dmgType: "physical", reqWpn: "nonbow", stun: 150 },
        "sk_spike_armor": { n: "尖刺盔甲", type: "buff", tier: 1, reqK: 30, mp: 10, dur: 1200, d: { meleeHit: 5 } },
        "sk_counter_barrier": { n: "反擊屏障", type: "buff", tier: 1, reqK: 30, mp: 10, dur: 64, label: "增益", msg: "你擺出了反擊的架式。" },   // 🔧 雙手武器可發動反擊；原生反擊/居合武器的反擊與居合最終傷害×2（持續64秒，效果結束才再施放）

        // ================= 【妖精精靈魔法】 =================
        // 一階 (Lv 10)
        "sk_elf_mr": { n: "魔法防禦", type: "buff", tier: 1, reqE: 10, mp: 10, dur: 1200, d: { mr: 10 } },
        "sk_elf_mind": { n: "心靈轉換", type: "convert", tier: 1, reqE: 10, hpCost: 8, mpGain: 2 },
        "sk_elf_worldtree": { n: "世界樹的呼喚", type: "passive", tier: 1, reqE: 10 },
        "sk_elf_triple": { n: "三重矢", type: "atk", tier: 1, reqE: 10, mp: 15, dmgType: "physical", ranged: true, reqWpn: "bow", hits: 3 },

        // 二階 (Lv 20)
        "sk_elf_purify": { n: "淨化精神", type: "buff", tier: 2, reqE: 20, mp: 10, dur: 1200, d: { wis: 3 } },
        "sk_elf_eleres": { n: "屬性防禦", type: "buff", tier: 2, reqE: 20, mp: 10, dur: 1200, d: { resFire: 10, resWater: 10, resEarth: 10, resWind: 10 } },
        "sk_elf_release": { n: "釋放元素", type: "atk", tier: 2, reqE: 20, mp: 30, dmgType: "magic", instakill: { tag: "element", cap: 12 } },   // 🔧 即死成功率最高 60%
        "sk_elf_soul": { n: "魂體轉換", type: "convert", tier: 2, reqE: 20, hpCost: 50, mpGain: 15 },

        // 三階 (Lv 30) - 需要對應屬性
        "sk_elf_singleres": { n: "單屬性防禦", type: "buff", tier: 3, reqE: 30, mp: 10, dur: 64, reqEleAny: true },
        "sk_elf_firewpn": { n: "火焰武器", type: "buff", tier: 3, reqE: 30, mp: 20, dur: 1200, reqEle: "fire", d: { meleeDmg: 3 } },
        "sk_elf_windshot": { n: "風之神射", type: "buff", tier: 3, reqE: 30, mp: 15, dur: 1200, reqEle: "wind", d: { rangedHit: 5 } },
        "sk_elf_winddash": { n: "風之疾走", type: "buff", tier: 3, reqE: 30, mp: 20, dur: 1200, reqEle: "wind", d: { er: 10 } },
        "sk_elf_earthguard": { n: "大地防護", type: "buff", tier: 3, reqE: 30, mp: 15, dur: 1200, reqEle: "earth", d: { ac: 4 } },
        "sk_elf_groundtrap": { n: "地面障礙", type: "atk", tier: 3, reqE: 30, mp: 20, dmgType: "magic", reqEle: "earth", status: { kind: "slow", pbase: 150, dur: 30 } },
        "sk_elf_watervital": { n: "水之元氣", type: "buff", tier: 3, reqE: 30, mp: 1, dur: 64, reqEle: "water", noRefresh: true, waterVital: true, msg: "水之元氣環繞著你。" },   // 🔧 buff 期間內「下次」受到治癒術（玩家自身瞬間治癒，不含持續回復HoT）時恢復量加倍、觸發後7秒冷卻（見 waterVitalHeal）；noRefresh：效果結束才可再施放

        // 四階 (Lv 40)
        "sk_elf_magicerase": { n: "魔法消除", type: "atk", tier: 4, reqE: 40, mp: 30, dmgType: "magic", status: { kind: "mrhalf", pbase: 150, dur: 16 } },
        "sk_elf_summon": { n: "召喚屬性精靈", type: "buff", tier: 4, reqE: 40, mp: 30, dur: 3600, reqEleAny: true, summon: { n: "夥伴：{ele}精靈", dmgDice: [1, 40], elemScale: 20, interval: 10, kind: "ranged", eleFromPlayer: true, hitLvOff: 10 } },
        "sk_elf_dancefire": { n: "舞躍之火", type: "buff", tier: 4, reqE: 40, mp: 30, dur: 1200, reqEle: "fire", d: { meleeDmg: 5 } },
        "sk_elf_stormeye": { n: "暴風之眼", type: "buff", tier: 4, reqE: 40, mp: 40, dur: 1200, reqEle: "wind", d: { rangedDmg: 2, rangedHit: 2 } },
        "sk_elf_earthshield": { n: "大地屏障", type: "buff", tier: 4, reqE: 40, mp: 50, dur: 8, reqEle: "earth" },
        "sk_elf_lifespring": { n: "生命之泉", type: "heal", tier: 4, reqE: 40, mp: 50, reqEle: "water", valDice: [4, 35], healDice: [5, 50], healBase: 250 },
        "sk_elf_earthbless": { n: "大地的祝福", type: "buff", tier: 4, reqE: 40, mp: 35, dur: 1200, reqEle: "earth", d: { ac: 7 } },

        // 五階 (Lv 50)
        "sk_elf_summon2": { n: "召喚強力屬性精靈", type: "buff", tier: 5, reqE: 50, mp: 50, dur: 3600, reqEleAny: true, summon: { n: "夥伴：上級{ele}精靈", dmgDice: [2, 40], elemScale: 10, interval: 10, kind: "ranged", eleFromPlayer: true, hitLvOff: 20 } },
        "sk_elf_lifebless": { n: "生命的祝福", type: "heal", tier: 5, reqE: 50, mp: 30, reqEle: "water", hot: { interval: 30, ticks: 6 }, valDice: [1, 20], healDice: [1, 28], healBase: 28, autoBuff: true },
        "sk_elf_seal": { n: "封印禁地", type: "atk", tier: 5, reqE: 50, mp: 40, dmgType: "magic", reqEleAny: true, status: { kind: "magicseal", pbase: 100, dur: 8 } },
        "sk_elf_blazewpn": { n: "烈炎武器", type: "buff", tier: 5, reqE: 50, mp: 30, dur: 1200, reqEle: "fire", d: { meleeDmg: 5, meleeHit: 5 } },
        "sk_elf_flamesoul": { n: "烈焰之魂", type: "buff", tier: 5, reqE: 50, mp: 30, dur: 1280, reqEle: "fire", noRefresh: true },   // 🔧 持續內近距離一般攻擊武器擲骰必定最大值（見 getPhysicalDmg）；noRefresh：效果結束才可再施放
        "sk_elf_stormshot": { n: "暴風神射", type: "buff", tier: 5, reqE: 50, mp: 30, dur: 1200, reqEle: "wind", d: { rangedDmg: 6, rangedHit: 3 } },
        "sk_elf_preciseshot": { n: "精準射擊", type: "buff", tier: 5, reqE: 50, mp: 15, dur: 64, reqEle: "wind", noRefresh: true, preciseShot: true, msg: "你的目光變得無比銳利，攻擊精準無比。" },   // 🏹 持續內一般攻擊擲骰1由必定未命中→必定命中（最高命中率可達100%·見 getPhysicalDmg）；noRefresh：效果結束才可再施放
        "sk_elf_steelguard": { n: "鋼鐵防護", type: "buff", tier: 5, reqE: 50, mp: 30, dur: 1200, reqEle: "earth", d: { ac: 10 } },
        "sk_elf_attrfire": { n: "屬性之火", type: "buff", tier: 5, reqE: 50, mp: 20, dur: 320, reqEle: "fire", noRefresh: true, attrFireBuff: true, msg: "屬性之火在你的攻擊中燃燒。" },   // 🔧 一般攻擊30%機率傷害×1.5（見 playerAttack，與燃燒鬥志同效）；noRefresh：效果結束才可再施放
        "sk_elf_physboost": { n: "體能激發", type: "buff", tier: 5, reqE: 50, mp: 30, dur: 960, reqEle: "earth", noRefresh: true, loadFreeRegen: true, msg: "體能激發，負重之下仍能調息。" },   // 🔧 負重狀態仍可自然恢復HP/MP（見 regenTick / hasLoadFreeRegen）；noRefresh：效果結束才可再施放
        "sk_elf_energyboost": { n: "能量激發", type: "buff", tier: 5, reqE: 50, mp: 30, dur: 960, reqEle: "fire", noRefresh: true, loadFreeRegen: true, msg: "能量激發，負重之下仍能調息。" },   // 🔧 同體能激發，火屬性版本
        "sk_elf_mirror": { n: "鏡反射", type: "buff", tier: 5, reqE: 50, mp: 10, dur: 16, mirror: true, msg: "你的周身浮現一面鏡子。" },   // 🪞 受魔法傷害時 精神%機率（每1點精神+1%），對施法者造成等量必中固定傷害（見 applyMobMagic）；type:buff → 自動施放且效果結束才再施放
        // ================= 【黑暗妖精魔法】 =================
        // 一階（黑暗妖精 Lv15）
        "sk_dark_str":      { n: "力量提升", type: "buff", tier: 1, reqD: 15, mp: 10, dur: 960, d: { str: 3 }, msg: "你感到力量湧現。" },
        "sk_dark_mrup":     { n: "影之防護", type: "buff", tier: 1, reqD: 15, mp: 12, dur: 960, d: { mr: 5 }, msg: "暗影包覆了你。" },
        "sk_dark_stealth":  { n: "暗隱術", type: "buff", tier: 1, reqD: 15, mp: 10, dur: 32, darkStealth: true, msg: "你隱沒於暗影之中。" },
        "sk_dark_poison":   { n: "附加劇毒", type: "buff", tier: 1, reqD: 15, mp: 10, dur: 320, darkPoison: true, msg: "你的武器淬上了劇毒。" },
        "sk_dark_refine":   { n: "提煉魔石", type: "passive", tier: 1, reqD: 15 },
        // 二階（黑暗妖精 Lv30）
        "sk_dark_dex":      { n: "敏捷提升", type: "buff", tier: 2, reqD: 30, mp: 10, dur: 960, d: { dex: 3 }, msg: "你的身手更敏捷了。" },
        "sk_dark_poisonres":{ n: "毒性抵抗", type: "buff", tier: 2, reqD: 30, mp: 20, dur: 320, darkPoisonRes: true, msg: "你對毒素產生了抵抗。" },
        "sk_dark_burn":     { n: "燃燒鬥志", type: "buff", tier: 2, reqD: 30, mp: 20, dur: 300, darkBurn: true, msg: "鬥志在你體內燃燒。" },
        "sk_dark_walkhaste":{ n: "行走加速", type: "buff", tier: 2, reqD: 30, mp: 10, dur: 960, darkWalkHaste: true, msg: "你的步伐如影般輕快。" },   // 🔧 攻速+15%，可與加速術疊加
        // 三階（黑暗妖精 Lv45）
        "sk_dark_fang":     { n: "暗影之牙", type: "buff", tier: 3, reqD: 45, mp: 20, dur: 192, d: { extraDmg: 5 }, msg: "暗影凝聚成獠牙。" },
        "sk_dark_dodge":    { n: "暗影閃避", type: "buff", tier: 3, reqD: 45, mp: 20, dur: 32, darkMagicDodge: true, msg: "你能看穿魔法的軌跡。" },
        "sk_dark_crit":     { n: "會心一擊", type: "atk", tier: 3, reqD: 45, darkCrit: true, dmgType: "physical", msg: "你凝聚全身之力，致命一擊！" },
        "sk_dark_erup":     { n: "迴避提升", type: "buff", tier: 3, reqD: 45, mp: 20, dur: 192, d: { er: 12 }, msg: "你的迴避能力提升了。" },
        "sk_dark_double":   { n: "雙重破壞", type: "buff", tier: 3, reqD: 45, mp: 20, dur: 192, darkDouble: true, msg: "你的攻擊蘊含雙重之力。" },
        "sk_dark_armorbreak":{ n: "破壞盔甲", type: "atk", tier: 3, reqD: 45, mp: 32, dmgType: "magic", status: { kind: "armorbreak", dur: 8 }, msg: "你撕裂了目標的防護，使其受到的傷害提高。" },
        // ================= 【幻術士 記憶水晶法術】（reqI = 幻術士需求等級；一階10/二階20/三階30/四階40） =================
        // 一階幻術
        "sk_illu_ogre":      { n: "幻覺：歐吉", type: "buff", label: "增益", tier: 1, reqI: 10, mp: 20, dur: 64, d: { extraDmg: 4, extraHit: 4 }, illuSummon: "ogre", msg: "你以幻覺塑造出歐吉的形象。" },
        "sk_illu_confuse":   { n: "混亂", type: "atk", tier: 1, reqI: 10, mp: 15, hpCost: 10, dmgType: "magic", ele: "none", dmgDice: [2, 11], status: { kind: "confuse", pbase: 100, dur: 8 }, noRecastStatus: "confuse", confuseMsg: true },
        "sk_illu_cube_burn": { n: "立方：燃燒", type: "buff", label: "增益", tier: 1, reqI: 10, mp: 30, dur: 20, d: { resFire: 30 }, cube: { iv: 40, kind: "dmg", dice: [1, 20], ele: "fire" }, msg: "燃燒立方在你周身旋轉。" },
        "sk_illu_crush":     { n: "粉碎能量", type: "atk", tier: 1, reqI: 10, mp: 5, dmgType: "physical", weaponDmg: true, magScale: true, msg: "你將能量灌入武器，粉碎目標。", d: "以物理公式計算基礎傷害＝武器傷害（目標大小決定大/小骰）＋近距離或遠距離傷害（依武器）＋強化值加成，整體再乘魔法傷害加成（1＋魔法傷害/16）；不計武器特效。為魔法技能：必定命中，且不受目標防禦力與硬皮減免。" },
        "sk_illu_mirror":    { n: "鏡像", type: "buff", label: "增益", tier: 1, reqI: 10, mp: 10, dur: 1200, d: { er: 25 }, msg: "你分裂出無數鏡像。" },
        // 二階幻術
        "sk_illu_focus":     { n: "專注", type: "buff", label: "增益", tier: 2, reqI: 20, mp: 30, dur: 600, d: { mpR: 4 }, msg: "你進入高度專注。" },
        "sk_illu_lich":      { n: "幻覺：巫妖", type: "buff", label: "增益", tier: 2, reqI: 20, mp: 20, dur: 64, d: { magicDmg: 2 }, illuSummon: "lich", msg: "你以幻覺塑造出巫妖的形象。" },
        "sk_illu_mindbreak": { n: "心靈破壞", type: "atk", tier: 2, reqI: 20, mpDmgPct: 0.05, dmgType: "magic", ele: "none", msg: "你以消耗的魔力撕裂目標的心靈。", d: "基礎傷害＝消耗的 MP 量（最大 MP 的 5%），再依魔法傷害加成（1＋魔法傷害/16）放大；無屬性魔法，受目標魔抗（MR）減免。" },
        "sk_illu_cube_quake":{ n: "立方：地裂", type: "buff", label: "增益", tier: 2, reqI: 20, mp: 35, dur: 20, d: { resEarth: 30 }, cube: { iv: 40, kind: "slow" }, msg: "地裂立方在你周身旋轉。" },
        "sk_illu_skullbreak":{ n: "骷髏毀壞", type: "atk", tier: 2, reqI: 20, mp: 30, dmgType: "physical", weaponDmg: true, magScale: true, instakill: { tag: "undead", cap: 12 }, flatBonus: 20, tagReq: "undead", msg: "你試圖將不死者的骨骸徹底粉碎。" },   // 🦴 效果等同起死回生(即死·不死系·最高60%)；即死失敗才造成傷害＝粉碎能量公式+20固定
        // 三階幻術
        "sk_illu_fantasy":   { n: "幻想", type: "atk", tier: 3, reqI: 30, mp: 30, hpCost: 25, dmgType: "magic", ele: "none", dmgDice: [5, 12], status: { kind: "sleep", pbase: 100, dur: 8 }, msg: "你以幻想擾亂目標的心神。" },
        "sk_illu_golem":     { n: "幻覺：鑽石高崙", type: "buff", label: "增益", tier: 3, reqI: 30, mp: 30, hpCost: 25, dur: 64, d: { ac: 10 }, illuSummon: "golem", msg: "你以幻覺塑造出鑽石高崙的形象。" },
        "sk_illu_cube_shock":{ n: "立方：衝擊", type: "buff", label: "增益", tier: 3, reqI: 30, mp: 55, dur: 20, d: { resWind: 30 }, cube: { iv: 50, kind: "mrdown", dur: 4 }, msg: "衝擊立方在你周身旋轉。" },
        "sk_illu_endure":    { n: "耐力", type: "buff", label: "增益", tier: 3, reqI: 30, mp: 25, dur: 600, d: { dr: 2 }, msg: "你的意志化為堅韌的耐力。" },
        // 四階幻術
        "sk_illu_avatar":    { n: "幻覺：化身", type: "buff", label: "增益", tier: 4, reqI: 40, mp: 50, dur: 64, d: { extraDmg: 10 }, dmgTakenReduce: 10, msg: "你化身為幻象的存在。" },
        "sk_illu_panic":     { n: "恐慌", type: "atk", tier: 4, reqI: 40, mp: 30, hpCost: 30, dmgType: "magic", ele: "none", status: { kind: "panic", pbase: 100, dur: 64 }, noRecastStatus: "panic", panicMsg: true },
        "sk_illu_insight":   { n: "洞察", type: "buff", label: "增益", tier: 4, reqI: 40, mp: 60, dur: 640, d: { str: 1, dex: 1, con: 1, int: 1, wis: 1 }, msg: "你的感官變得無比敏銳。" },
        "sk_illu_cube_harmony":{ n: "立方：和諧", type: "buff", label: "增益", tier: 4, reqI: 40, mp: 0, hpCost: 25, dur: 20, cube: { iv: 10, kind: "mp", val: 5 }, msg: "和諧立方在你周身旋轉，引動魔力。" },
        "sk_illu_pain":      { n: "疼痛的歡愉", type: "buff", label: "增益", tier: 4, reqI: 40, mp: 0, hpCost: 40, dur: 64, painReflect: true, msg: "你迎向疼痛，化痛楚為反擊之力。" },
        // ================= 【龍騎士 龍魔法】（reqDk = 龍騎士需求等級；一階15/二階30/三階45；多數消耗 HP） =================
        // —— 一階龍魔法（Lv15）——
        "sk_dragon_armor":         { n: "龍之護鎧", type: "buff", label: "增益", tier: 1, reqDk: 15, mp: 0, hpCost: 12, dur: 1800, noRefresh: true, d: { dr: 5 }, msg: "龍鱗般的護鎧覆上你的身軀。" },
        "sk_dragon_flameslash":    { n: "燃燒擊砍", type: "buff", label: "增益", tier: 1, reqDk: 15, mp: 0, hpCost: 6, dur: 60, noRefresh: true, reqWpnMelee: true, flameSlash: true, msg: "你的下一擊燃起烈焰。" },
        "sk_dragon_guardbreak":    { n: "護衛毀滅", type: "atk", tier: 1, reqDk: 15, mp: 0, hpCost: 20, fixedStatus: { kind: "guardbreak", chance: 0.10, dur: 32 }, noRecastStatus: "guardbreak" },
        "sk_dragon_lavaspit":      { n: "岩漿噴吐", type: "atk", tier: 1, reqDk: 15, mp: 0, hpCost: 10, dmgType: "magic", ele: "fire", target: "all", multiDmg: [[5, 7]] },
        "sk_dragon_awaken_antares":{ n: "覺醒：安塔瑞斯", type: "buff", label: "增益", tier: 1, reqDk: 15, mp: 20, hpCost: 10, dur: 600, noRefresh: true, awaken: true, d: { ac: 8 }, msg: "你引動安塔瑞斯之力，龍血沸騰、毒麻不侵。" },
        // —— 二階龍魔法（Lv30）——
        "sk_dragon_bloodlust":     { n: "血之渴望", type: "buff", label: "增益", tier: 2, reqDk: 30, mp: 0, hpCost: 30, dur: 300, noRefresh: true, bloodlust: true, msg: "嗜血的渴望湧現，攻勢更為迅猛。" },
        "sk_dragon_slaughter":     { n: "屠宰者", type: "atk", tier: 2, reqDk: 30, mp: 0, hpCost: 16, slaughter: true, hits: 3 },
        "sk_dragon_terror":        { n: "恐懼無助", type: "atk", tier: 2, reqDk: 30, mp: 0, hpCost: 12, fixedStatus: { kind: "terror", chance: 0.10, dur: 16 }, noRecastStatus: "terror" },
        "sk_dragon_lavabolt":      { n: "岩漿之箭", type: "atk", tier: 2, reqDk: 30, mp: 0, hpCost: 16, dmgType: "magic", ele: "fire", multiDmg: [[10, 8]] },
        "sk_dragon_awaken_falion": { n: "覺醒：法利昂", type: "buff", label: "增益", tier: 2, reqDk: 30, mp: 30, hpCost: 20, dur: 600, noRefresh: true, awaken: true, d: { resFire: 15, resWater: 15, resEarth: 15, resWind: 15 }, msg: "你引動法利昂之力，魔抗與全屬性抗性大增。" },
        // —— 三階龍魔法（Lv45）——
        "sk_dragon_deadlybody":    { n: "致命身軀", type: "buff", label: "增益", tier: 3, reqDk: 45, mp: 0, hpCost: 50, dur: 300, noRefresh: true, deadlyBody: true, msg: "你的身軀化為致命的反擊之刃。" },
        "sk_dragon_deathlightning":{ n: "奪命之雷", type: "atk", tier: 3, reqDk: 45, mp: 0, hpCost: 35, dmgType: "magic", ele: "wind", target: "all", multiDmg: [[6, 8]], status: { kind: "stun", dur: 6 } },
        "sk_dragon_reaper":        { n: "驚悚死神", type: "atk", tier: 3, reqDk: 45, mp: 0, hpCost: 20, fixedStatus: { kind: "doom", chance: 0.50, dur: 32 }, noRecastStatus: "doom" },
        "sk_dragon_awaken_baraka": { n: "覺醒：巴拉卡斯", type: "buff", label: "增益", tier: 3, reqDk: 45, mp: 50, hpCost: 30, dur: 600, noRefresh: true, awaken: true, d: { str: 3, con: 3, dex: 3, int: 3, wis: 3, extraHit: 5 }, msg: "你引動巴拉卡斯之力，全身充滿磅礡之力。" },
        // ================= ⚔️【戰士技能·印記習得】 =================（cat:熱血blood/憤怒rage/忍耐endure）
        // —— 熱血 blood ——
        "sk_warrior_dualaxe":     { n: "迅猛雙斧", type: "passive", cat: "blood", reqW: 15, passive: true, dualAxe: true, desc: "裝備單手鈍器時副手也可裝單手鈍器，一般攻擊同時判定兩個攻擊來源。" },
        "sk_warrior_crush":       { n: "粉碎", type: "passive", cat: "blood", reqW: 30, passive: true, crushPassive: true, desc: "近距離傷害+2；玩家等級 45 時額外+1，之後每升一級+1。" },
        "sk_warrior_armorbody":   { n: "護甲身軀", type: "passive", cat: "blood", reqW: 45, passive: true, armorBody: true, desc: "傷害減免 +[(10-AC)/10]。" },
        "sk_warrior_berserk":     { n: "狂暴", type: "passive", cat: "blood", reqW: 50, passive: true, berserk: true, desc: "一般攻擊 5% 機率造成兩倍傷害。" },
        // —— 忍耐 endure ——
        "sk_warrior_titan_rock":  { n: "泰坦：岩石", type: "passive", cat: "endure", reqW: 50, passive: true, titanRock: true, desc: "HP 低於 40% 時，受到一般攻擊對攻擊目標造成相同傷害。" },
        "sk_warrior_titan_magic": { n: "泰坦：魔法", type: "passive", cat: "endure", reqW: 50, passive: true, titanMagic: true, desc: "HP 低於 40% 時，受到技能攻擊對攻擊目標造成相同傷害。" },
        "sk_warrior_titan_bullet":{ n: "泰坦：子彈", type: "passive", cat: "endure", reqW: 60, passive: true, titanBullet: true, desc: "HP 低於 40% 時，ER+50。" },
        // —— 憤怒 rage ——
        "sk_warrior_throwaxe":    { n: "戰斧投擲", type: "buff", label: "增益", cat: "rage", reqW: 15, mp: 5, dur: 60, noRefresh: true, reqWpnBlunt: true, throwAxe: true, msg: "你蓄勢待發，下一擊將撕裂敵人。" },
        "sk_warrior_roar":        { n: "咆哮", type: "atk", cat: "rage", reqW: 30, mp: 5, roarFixed: true, target: "all" },
        "sk_warrior_endurance":   { n: "體能強化", type: "buff", label: "增益", cat: "rage", reqW: 50, mp: 10, dur: 3000, noRefresh: true, vigor: true, msg: "你的體魄變得更加強韌。" },
        "sk_warrior_outlaw":      { n: "亡命之徒", type: "buff", label: "增益", cat: "rage", reqW: 60, mp: 10, dur: 60, noRefresh: true, outlaw: true, msg: "你豁出性命，攻勢勢在必中。" },
        // 👑 王族魔法（reqRoy；cat:'royal' → 技能欄「王族魔法」分區）
        "sk_royal_precise":    { n: "精準目標", type: "buff", label: "增益", cat: "royal", reqRoy: 15, mp: 2, dur: 16, noRefresh: true, preciseTarget: true, msg: "你鎖定全場敵人，使其露出破綻。" },
        "sk_royal_callally":   { n: "呼喚盟友", type: "atk", label: "攻擊", cat: "royal", reqRoy: 30, mp: 30, callAllies: true },
        "sk_royal_burnweapon": { n: "灼熱武器", type: "buff", label: "增益", cat: "royal", reqRoy: 40, mp: 25, dur: 640, noRefresh: true, d: { extraDmg: 5, extraHit: 5 }, msg: "你的武器燃起灼熱之炎。" },
        "sk_royal_bravewill":  { n: "勇猛意志", type: "buff", label: "增益", cat: "royal", reqRoy: 50, mp: 25, dur: 640, noRefresh: true, braveWill: true, msg: "勇猛的意志充盈你的全身。" },
        "sk_royal_shield":     { n: "閃亮之盾", type: "buff", label: "增益", cat: "royal", reqRoy: 50, mp: 25, dur: 640, noRefresh: true, d: { ac: 8 }, msg: "閃亮的護盾環繞著你。" },
        "sk_royal_kingguard":  { n: "王者加護", type: "passive", label: "被動", cat: "royal", reqRoy: 50, passive: true, kingGuard: true, desc: "MR+10、20%機率抵抗暈眩。" },
        // ================= 【魔法頭盔技能】 =================
        // 治癒魔法頭盔技能
        "sk_helm_heal1": { n: "治盔：初級治癒術", mp: 2, type: "heal", valBase: 0, valDice: [1, 15], healDice: [1, 20], healBase: 20, label: "恢復", msg: "你感覺舒服了一點。" },
        "sk_helm_heal2": { n: "治盔：中級治癒術", mp: 7, type: "heal", valBase: 0, valDice: [1, 30], healDice: [1, 50], healBase: 50, label: "恢復", msg: "你感覺舒服了一點。" },

        // 敏捷魔法頭盔技能
        "sk_helm_dex1": { n: "敏盔：通暢氣脈術", mp: 25, type: "buff", label: "增益", dur: 1200, d: { dex: 5 }, msg: "你覺得身手變得更靈活。" },
        "sk_helm_dex2": { n: "敏盔：加速術", mp: 20, type: "buff", label: "增益", dur: 1200, haste: true, msg: "你感到身體變得非常輕盈。" },

        // 力量魔法頭盔技能
        "sk_helm_str1": { n: "力盔：擬似魔法武器", mp: 10, type: "buff", label: "增益", dur: 1800, d: { extraDmg: 2 }, msg: "你的武器暫時被注入了魔法力量。" },
        "sk_helm_str2": { n: "力盔：無所遁形術", mp: 8, type: "buff", label: "增益", dur: 180 },
        "sk_helm_str3": { n: "力盔：體魄強健術", mp: 25, type: "buff", label: "增益", dur: 1200, d: { str: 5 }, msg: "你覺得身體充滿了力量。" }

    },

    maps: {
        "pirate_wild": ["nm_035", "nm_003", "doberman", "pirate_wildpoison", "pirate_lizardrage", "pirate_wildfang", "pirate_wilddemon", "pirate_lizardhigh", "pirate_bluetail", "pirate_parrot", "pirate_chest", "mambo_rabbit"],
        "pirate_dungeon": ["pirate_lizardrage", "pirate_lizardhigh", "pirate_skeleton", "pirate_lizardheavy", "pirate_skelsoldier", "pirate_skelblade", "pirate_skelchief", "pirate_drake"],
        "training": ["orc", "goblin", "orc_archer", "gremlin"],
        "silent_outer": ["orc", "orc_archer", "zombie", "nm_008", "fighter", "nm_002", "wolf", "skeleton", "orc_zombie", "skel_archer", "stone_golem", "bear", "lizardman", "sparto"],
        "elf_grave": ["elf_earthfang","elf_windfang","elf_waterfang","elf_firefang","elf_waterlord","abyss_ghoul","abyss_archer","elf_earthlord","elf_windlord","elf_firelord","abyss_sith","abyss_water","abyss_earth","abyss_wind","abyss_fire","mambo_rabbit","abyss_lord"],
        "hidden_cave": ["demon_bat","de_thief","dark_spirit_mob","armadillo","demon_bear","de_gate_xbow","de_gate_apprentice","ohm_militia","scorpion","dark_spirit_king","de_gate_spear","metal_centipede","monia","darkdweller","ohm_armor","de_train_blacktiger","dark_spirit_caller","de_train_summoner","de_gate_patrol","de_gate_soldier","de_lab_blackmage","fire_beast","beast_tamer","de_gate_general"],
        "giant_tomb": ["tomb_guardian","tomb_guardian_mage","tomb_guardian_knight","tomb_guardian_giant"],
        "demon_temple": ["metal_centipede","flame_avatar","darkdweller","ohm_militia","flame_skba","de_lab_blackmage","flame_skba_queen","ohm_armor","flame_imp","tomb_guardian","flame_baphomet","fallen_priest1","fallen_priest2","fallen_priest3","flame_baless","fallen_priest4","fallen_priest5","flame_demon","fallen_boss"],
        "shadow_temple": ["death_priest_succubus","death_priest_baphomet","chaos_priest_wing","chaos_priest_beast","flameshadow_guard_baphomet","death_boss","chaos_boss"],
        "dream_island": ["nm_038", "nm_039", "nm_040", "nm_036", "nm_041", "nm_042", "nm_043", "nm_044", "nm_023", "nm_024", "nm_045", "nm_028", "nm_029", "nm_030", "nm_031", "nm_032", "nm_037"],
        "kent_outer": ["siege_aton", "siege_julian", "siege_ovi", "siege_joe", "siege_senis", "siege_tros", "siege_esti", "siege_grit", "siege_gate"],
        "kent_inner": ["siege_aton", "siege_julian", "siege_ovi", "siege_joe", "siege_senis", "siege_tros", "siege_esti", "siege_grit", "siege_tower"],
        "ww_outer": ["siege_aton", "siege_julian", "siege_ovi", "siege_joe", "siege_senis", "siege_tros", "siege_esti", "siege_grit", "siege_gate_ww"],
        "ww_inner": ["siege_aton", "siege_julian", "siege_ovi", "siege_joe", "siege_senis", "siege_tros", "siege_esti", "siege_grit", "siege_tower_ww"],
        "heine_outer": ["siege_aton", "siege_julian", "siege_ovi", "siege_joe", "siege_senis", "siege_tros", "siege_esti", "siege_grit", "siege_gate_heine"],
        "heine_inner": ["siege_aton", "siege_julian", "siege_ovi", "siege_joe", "siege_senis", "siege_tros", "siege_esti", "siege_grit", "siege_tower_heine"],
        "windwood_dungeon": ["zombie", "skeleton", "skel_archer", "skel_axe", "skel_spear", "sparto", "ghoul", "ungoliant", "ogre", "cerberus", "ogre_king", "nm_008", "baless"],
        "silver_knight": ["orc", "goblin", "orc_archer", "gremlin", "侏儒", "nm_003", "zombie", "fighter", "ice_wolf", "wolf", "gnome_warrior", "skeleton", "orc_mage", "stone_golem", "hobgoblin", "b_knight", "ghoul", "sparto", "lycan", "dragon_turtle"],
        "talking_island": ["orc", "goblin", "orc_archer", "gremlin", "侏儒", "nm_035", "nm_003", "doberman", "zombie", "floating_eye", "fighter", "wolf", "skeleton", "stone_golem", "spider"],
        "zone_01": ["orc", "orc_archer", "nm_002", "nm_003", "侏儒", "fighter", "zombie", "wolf", "gandi_orc", "orc_mage", "rova_orc", "stone_golem", "atuba_orc", "duda_orc", "neruga_orc", "nm_007", "nm_009"],
        "talking_island_port": ["fighter", "wolf", "stone_golem", "spider", "b_knight", "elder", "kurt"],
        "elf_forest": ["orc_archer", "nm_003", "fighter", "wolf", "gandi_orc", "orc_mage", "rova_orc", "orc_scout", "atuba_orc", "duda_orc", "ghoul", "sparto", "neruga_orc", "lycan", "gaster", "dark_elf", "ogre_warrior", "gaster_king"],
        "gludio": ["orc", "goblin", "orc_archer", "gremlin", "侏儒", "nm_035", "nm_003", "zombie", "doberman", "fighter", "wolf", "skeleton", "orc_mage", "skel_archer", "stone_golem", "hobgoblin", "spider", "ghoul", "sparto", "nm_011", "lycan", "elder", "ogre", "ogre_warrior"],
        "windwood": ["orc_archer", "fighter", "nm_035", "nm_003", "doberman", "floating_eye", "gnome_warrior", "wolf", "orc_mage", "stone_golem", "hobgoblin", "lizardman", "ant", "lycan", "harpy"],
        "desert": ["evil_lizard", "scorpion", "ant", "giant_ant", "lizardman", "stone_golem", "sparto", "wolf", "griffon"],
        "kent": ["orc", "goblin", "orc_archer", "gremlin", "nm_002", "侏儒", "nm_035", "nm_003", "doberman", "nm_006", "fighter", "gnome_warrior", "wolf", "stone_golem", "spider", "hobgoblin", "bear", "lycan", "ungoliant", "elder", "harpy", "ogre_warrior"],
        "dragon_valley": ["侏儒", "nm_003", "wolf", "gnome_warrior", "sparto", "lycan", "scorpion", "harpy", "skel_sniper", "skel_guard", "dark_elf", "ogre_warrior", "skel_fighter", "arian", "wyvern", "blackelder"],
        "fire_dragon": ["侏儒", "gnome_warrior", "fire_archer", "bomb_flower", "dragon_fly", "fire_warrior", "salamander", "fire_egg", "lava_golem", "ashitakio", "ifrit", "fire_beast", "phoenix"],
        "giran": ["goblin", "侏儒", "nm_006", "gnome_warrior", "hobgoblin", "bear", "lizardman", "wolf", "spider", "lycan", "ungoliant", "gaster", "bandit", "bandit_boss", "griffon", "dark_elf", "gaster_king", "fire_egg", "cyclops"],
        "heine": ["croc", "spider", "bear", "lizardman", "troglodyte", "lycan", "ungoliant", "lamia", "giant_croc", "beholder"],
        "twilight_mt": ["giant", "giant_warrior", "giant_elder", "giant_ancient"],
        "mirror_forest": ["doppelganger", "doppel_boss", "crabman", "croc", "dragon_turtle", "beholder", "spider", "ungoliant", "lamia"],
        "zone_02": ["侏儒", "nm_005", "nm_004", "zombie", "ice_wolf", "gnome_warrior", "bear", "troglodyte", "ghoul", "nm_012", "nm_014", "nm_015", "nm_019", "nm_020", "nm_021"],
        "zone_03": ["nm_012", "nm_014", "nm_015", "nm_017", "nm_019", "nm_020", "nm_021", "nm_022"],
        "crystal_cave1": ["nm_002", "nm_012", "nm_046", "nm_017", "nm_019", "nm_020", "nm_022"],
        "crystal_cave2": ["nm_002", "nm_012", "nm_046", "nm_017", "nm_019", "nm_020", "nm_022", "ice_demon"],
        "crystal_cave3": ["nm_046", "nm_017", "nm_019", "nm_020", "ice_maid", "ice_queen"],
        "zone_04": ["zombie", "ghoul", "nm_014", "nm_015", "nm_021"],
        "zone_05": ["nm_004", "nm_012", "nm_014", "nm_046", "nm_015", "nm_017", "nm_019", "nm_020", "nm_022"],
        "zone_06": ["orc", "orc_archer", "zombie", "fighter", "skeleton", "skel_archer", "ghoul", "sparto"],
        "zone_07": ["zombie", "skeleton", "skel_archer", "skel_spear", "spider", "ghoul", "sparto", "ungoliant", "ogre"],
        "zone_08": ["zombie", "skeleton", "skel_archer", "stone_golem", "ghoul", "sparto", "ungoliant", "ogre", "sema", "batus", "casper", "marcus"],
        "zone_09": ["zombie", "skeleton", "skel_archer", "spider", "ghoul", "sparto", "ungoliant", "ogre", "cerberus", "sema", "batus", "casper", "marcus"],
        "zone_10": ["skeleton", "skel_archer", "skel_axe", "skel_spear", "ghoul", "sparto", "ungoliant", "ogre", "cerberus", "dk"],
        "zone_11": ["floating_eye", "nm_008", "skel_archer", "ghoul", "sparto", "ungoliant", "elder", "ogre", "cerberus", "ogre_king", "necromancer", "dk"],
        "zone_12": ["nm_008", "skel_archer", "ghoul", "sparto", "ungoliant", "ogre", "cerberus", "ogre_king", "dk"],
        "zone_13": ["orc", "zombie", "floating_eye", "fighter", "wolf", "skeleton", "skel_archer", "stone_golem", "elder"],
        "zone_14": ["zombie", "floating_eye", "wolf", "skeleton", "skel_archer", "skel_axe", "skel_spear", "stone_golem", "spider", "sparto", "baphomet"],
        "zone_15": ["orc", "orc_archer", "zombie", "fighter", "nm_007", "nm_009", "nm_002"],
        "zone_16": ["nm_002", "fighter", "wolf", "gandi_orc", "rova_orc", "duda_orc", "nm_007", "nm_009"],
        "zone_17": ["nm_002", "atuba_orc", "ghoul", "sparto", "neruga_orc", "gaster", "nm_007", "nm_009"],
        "zone_18": ["orc_zombie", "bear", "ghoul", "sparto"],
        "zone_19": ["orc_zombie", "bear", "ghoul", "lycan"],
        "zone_20": ["orc_zombie", "bear", "gaster"],
        "zone_21": ["bear", "gaster", "cerberus", "dark_elf"],
        "zone_22": ["orc", "zombie", "floating_eye", "fighter", "wolf", "skeleton", "skel_archer", "stone_golem", "spider"],
        "zone_23": ["zombie", "ghoul", "sparto", "ogre"],
        "zone_24": ["skeleton", "skel_archer", "skel_axe", "skel_spear", "ghoul", "sparto", "ogre"],
        "zone_25": ["ogre", "cerberus", "ogre_king"],
        "zone_26": ["sparto", "ungoliant", "skel_sniper", "skel_guard", "troll", "skel_fighter"],
        "zone_27": ["skel_sniper", "skel_guard", "troll", "skel_fighter", "monia"],
        "zone_28": ["skel_sniper", "skel_guard", "troll", "skel_fighter", "monia", "aruba"],
        "zone_29": ["skel_sniper", "skel_guard", "troll", "skel_fighter", "monia", "aruba", "succubus"],
        "zone_30": ["monia", "aruba", "succubus", "succubus_queen"],
        "zone_31": ["aruba", "succubus", "succubus_queen"],
        "zone_32": ["ant", "giant_ant", "ant_white", "ant_giant_white"],
        "zone_33": ["ant", "giant_ant", "ant_enh", "ant_enh_white", "ant_assault", "ant_giant_enh_white"],
        "zone_34": ["croc", "roach", "lizardman", "troglodyte", "ratman", "lamia"],
        "zone_35": ["croc", "roach", "crabman", "ratman", "lamia", "beholder"],
        "zone_36": ["croc", "crabman", "ratman", "lamia", "beholder"],
        "eva_kingdom": ["crabman", "mermaid", "nm_010", "starfish", "sildeis", "electon", "crustacean"],
        "zone_37": ["nm_013", "nm_016", "nm_018", "nm_022"],
        "zone_38": ["nm_013", "nm_016", "nm_018", "nm_022"],
        "zone_39": ["nm_025", "nm_026", "nm_027", "nm_033"],
        "zone_40": ["nm_025", "nm_026", "nm_027", "nm_033"],
        "zone_41": ["nm_025", "nm_026", "nm_027", "nm_033"],
        // ===== 🏛️ 隱藏狩獵區域出怪池（僅能由對應地圖手動傳送進入；不列於地圖選單、魔物追蹤亦無法指定） =====
        "hidden_lab_nolife": ["iv_paper", "iv_stone_golem", "iv_iron_golem", "iv_jelly", "iv_armor", "iv_deathsword", "iv_lightball", "iv_mimi"],
        "hidden_lab_darkmagic": ["iv_elder", "iv_blackelder", "iv_chimera", "iv_lamia", "iv_blackmage"],
        "hidden_seal_spirit": ["iv_blackmage", "iv_reaper", "iv_shadow", "iv_spirit", "iv_baless", "iv_karuta", "iv_hatin"],
        "hidden_seal_monster": ["iv_shadow", "iv_spirit", "iv_baless", "iv_flameslave", "iv_imp", "iv_baphomet", "iv_hatin"],
        "hidden_seal_demon": ["iv_baless", "iv_flameslave", "iv_imp", "iv_baphomet", "iv_wing", "iv_flameshadow", "iv_demonshadow", "nm_034"],
        "hidden_antqueen": ["ant_assault", "ant_giant_enh_white", "ant_guard", "ant_queen"],
        "rastabad_cave1": ["ohm", "ohm_rage", "ohm_armor", "ohm_armor_rage"],
        "rastabad_cave2": ["de_remnant_bow", "de_remnant_sword", "de_remnant_xbow", "de_remnant_mage", "de_remnant_2h"],
        "rastabad_cave3": ["de_remnant_bow", "de_remnant_sword", "de_remnant_xbow", "de_remnant_mage", "de_remnant_2h", "dark_spirit_caller"],
        "rastabad_gate": ["de_gate_xbow", "de_gate_apprentice", "de_gate_spear", "de_gate_patrol", "de_gate_soldier", "de_gate_general"],
        "rastabad_beast": ["de_gate_general", "de_train_blacktiger", "de_train_tamer", "de_train_cursetamer", "de_train_hellhound", "de_train_soulknight", "de_train_hellslave", "de_train_summoner", "de_train_gatekeeper"],
        "king_baranka_room": ["de_king_baranka"],
        "law_king_room": ["de_king_laia"],
        "necro_king_room": ["de_king_heruby"],
        "assassin_king_room": ["de_king_slayer"],
        "thebes_desert": ["thebes_mandra_w", "thebes_mandra", "thebes_scarab", "thebes_scarab_b", "thebes_kebis_b", "thebes_kebis_r", "thebes_obelisk", "thebes_obelisk_b", "thebes_sphinx", "thebes_sphinx_b"],
        "thebes_pyramid": ["thebes_nehos", "thebes_nehos_b", "thebes_bas", "thebes_bas_r", "thebes_anus", "thebes_anus_b"],
        "thebes_temple": ["thebes_horus", "thebes_anubis"],
        "dark_magic_lab": ["de_lab_earth", "de_lab_water", "de_lab_wind", "de_lab_fire", "de_lab_mage", "de_lab_blackmage", "de_train_gatekeeper"],
        "necro_training": ["de_necro_avenger", "de_necro_warlock", "de_necro_omwarrior", "de_necro_darklord", "de_necro_bloodknight", "de_necro_omheavy", "de_train_gatekeeper"],
        "elder_room": ["de_elder_guard", "de_elder_captain", "de_elder_follower", "de_lab_blackmage", "de_train_soulknight", "de_necro_bloodknight", "dark_spirit_king", "darkdweller", "de_lab_earth", "de_lab_water", "de_lab_fire", "de_lab_wind", "dark_spirit_caller", "de_elder_kina", "de_elder_andis", "de_elder_batas", "de_elder_balos", "de_elder_balud", "de_elder_ramas", "de_elder_taimas", "de_elder_adiel"],   // 🏛️ 格蘭肯神殿．長老之室：3 新一般怪 + 既有出沒怪物 + 8 長老 BOSS（BOSS 出場由 spawnMob 節流：場上最多 2 隻、第 1 隻存活滿 3 分鐘才出第 2 隻）
        "antaras_lair": ["antaras"],
        "fafurion_lair": ["fafurion"],
        "valakas_lair": ["valakas"],
        // ===== 🗼 傲慢之塔 =====
        // 攀登樓層（pride_f2~f10）：每層含「往上層的樓梯」(F2~F9) 或頭目(F10)；擊敗即前往下一層
        "pride_f2":  ["pride_lamia", "pride_ungoliant", "pride_medusa", "pride_stairs"],
        "pride_f3":  ["pride_lamia", "pride_ungoliant", "pride_medusa", "pride_chimera", "pride_stairs"],
        "pride_f4":  ["pride_lamia", "pride_ungoliant", "pride_medusa", "pride_chimera", "pride_stairs"],
        "pride_f5":  ["pride_medusa", "pride_chimera", "arian", "pride_stairs"],
        "pride_f6":  ["pride_medusa", "pride_chimera", "arian", "pride_stairs"],
        "pride_f7":  ["pride_medusa", "pride_chimera", "arian", "pride_stairs"],
        "pride_f8":  ["pride_medusa", "pride_chimera", "arian", "pride_stairs"],
        "pride_f9":  ["pride_medusa", "pride_chimera", "arian", "pride_stairs"],
        "pride_f10": ["pride_medusa", "pride_chimera", "arian", "pride_jenis"],
        // 直接挑戰的 2~10 樓farming（擊敗頭目不前進）
        "pride_2_10": ["pride_medusa", "pride_chimera", "arian", "pride_jenis"],
        // 攀登 11~20 樓（succubus=思克巴）
        "pride_f11": ["succubus", "pride_wolf", "pride_stairs"],
        "pride_f12": ["succubus", "pride_wolf", "pride_mimic", "pride_stairs"],
        "pride_f13": ["succubus", "pride_wolf", "pride_mimic", "pride_stairs"],
        "pride_f14": ["succubus", "pride_wolf", "pride_mimic", "pride_stairs"],
        "pride_f15": ["pride_beholder", "pride_wolf", "pride_mimic", "pride_stairs"],
        "pride_f16": ["pride_beholder", "pride_wolf", "pride_mimic", "pride_stairs"],
        "pride_f17": ["pride_beholder", "pride_wolf", "pride_deathsword", "pride_stairs"],
        "pride_f18": ["pride_beholder", "pride_wolf", "pride_deathsword", "pride_stairs"],
        "pride_f19": ["pride_beholder", "pride_wolf", "pride_deathsword", "pride_stairs"],
        "pride_f20": ["pride_beholder", "pride_wolf", "pride_deathsword", "pride_phantom_boss"],
        "pride_11_20": ["succubus", "pride_wolf", "pride_mimic", "pride_beholder", "pride_deathsword", "pride_phantom_boss"],
        // 攀登 21~30 樓
        "pride_f21": ["pride_fireegg", "pride_nightmare", "pride_stairs"],
        "pride_f22": ["pride_fireegg", "pride_nightmare", "pride_hellhound", "pride_stairs"],
        "pride_f23": ["pride_fireegg", "pride_nightmare", "pride_hellhound", "pride_stairs"],
        "pride_f24": ["pride_fireegg", "pride_nightmare", "pride_hellhound", "pride_stairs"],
        "pride_f25": ["pride_nightmare", "pride_hellhound", "pride_imp", "pride_stairs"],
        "pride_f26": ["pride_nightmare", "pride_hellhound", "pride_imp", "pride_stairs"],
        "pride_f27": ["pride_ifrit", "pride_hellhound", "pride_imp", "pride_stairs"],
        "pride_f28": ["pride_ifrit", "pride_hellhound", "pride_imp", "pride_stairs"],
        "pride_f29": ["pride_ifrit", "pride_hellhound", "pride_imp", "pride_stairs"],
        "pride_f30": ["pride_ifrit", "pride_hellhound", "pride_imp", "pride_nightmare", "pride_vampire_boss"],
        "pride_21_30": ["pride_ifrit", "pride_fireegg", "pride_hellhound", "pride_imp", "pride_nightmare", "pride_vampire_boss"],
        // 攀登 31~40 樓
        "pride_f31": ["pride_skel_axe", "pride_ghoul2", "pride_stairs"],
        "pride_f32": ["pride_skel_axe", "pride_skel_spear", "pride_ghoul2", "pride_stairs"],
        "pride_f33": ["pride_sparto", "pride_skel_spear", "pride_ghoul2", "pride_stairs"],
        "pride_f34": ["pride_sparto", "pride_skel_spear", "pride_ghoul2", "pride_stairs"],
        "pride_f35": ["pride_sparto", "pride_skel_archer", "pride_ghoul2", "pride_stairs"],
        "pride_f36": ["pride_sparto", "pride_skel_archer", "pride_ghoul2", "pride_stairs"],
        "pride_f37": ["pride_sparto", "pride_skel_archer", "pride_skel_fighter", "pride_stairs"],
        "pride_f38": ["pride_sparto", "pride_skel_archer", "pride_skel_fighter", "pride_stairs"],
        "pride_f39": ["pride_sparto", "pride_skel_archer", "pride_skel_fighter", "pride_stairs"],
        "pride_f40": ["pride_sparto", "pride_skel_archer", "pride_skel_fighter", "pride_zombie_king"],
        "pride_31_40": ["pride_skel_axe", "pride_skel_spear", "pride_ghoul2", "pride_sparto", "pride_skel_archer", "pride_skel_fighter", "pride_zombie_king"],
        // 攀登 41~50 樓
        "pride_f41": ["pride_drake", "pride_flamesoul_r", "pride_flamesoul_b", "pride_stairs"],
        "pride_f42": ["pride_irongolem", "pride_flamesoul_r", "pride_flamesoul_b", "pride_stairs"],
        "pride_f43": ["pride_drake", "pride_flamesoul_r", "pride_flamesoul_b", "pride_stairs"],
        "pride_f44": ["pride_drake", "pride_flamesoul_r", "pride_flamesoul_b", "pride_stairs"],
        "pride_f45": ["pride_drake", "pride_flamesoul_r", "pride_flamesoul_b", "pride_stairs"],
        "pride_f46": ["pride_drake", "pride_flamesoul_r", "pride_flamesoul_b", "pride_stairs"],
        "pride_f47": ["pride_drake", "pride_flamemage", "pride_bonedragon", "pride_stairs"],
        "pride_f48": ["pride_drake", "pride_flamemage", "pride_bonedragon", "pride_stairs"],
        "pride_f49": ["pride_drake", "pride_flamemage", "pride_bonedragon", "pride_stairs"],
        "pride_f50": ["pride_drake", "pride_flamemage", "pride_bonedragon", "pride_panther_boss"],
        "pride_41_50": ["pride_drake", "pride_flamemage", "pride_bonedragon", "pride_irongolem", "pride_flamesoul_r", "pride_flamesoul_b", "pride_panther_boss"],
        // 攀登 51~60 樓
        "pride_f51": ["pride_curse_zombie", "pride_curse_soldier", "pride_stairs"],
        "pride_f52": ["pride_curse_zombie", "pride_curse_soldier", "pride_curse_mage", "pride_stairs"],
        "pride_f53": ["pride_curse_zombie", "pride_curse_soldier", "pride_curse_general", "pride_stairs"],
        "pride_f54": ["pride_curse_mage", "pride_curse_soldier", "pride_curse_general", "pride_stairs"],
        "pride_f55": ["pride_curse_mage", "pride_curse_soldier", "pride_curse_general", "pride_stairs"],
        "pride_f56": ["pride_curse_mage", "pride_curse_soldier", "pride_curse_general", "pride_stairs"],
        "pride_f57": ["pride_curse_mage", "pride_curse_zombie", "pride_curse_general", "pride_stairs"],
        "pride_f58": ["pride_curse_zombie", "pride_curse_mage", "pride_curse_soldier", "pride_curse_general", "pride_stairs"],
        "pride_f59": ["pride_curse_mage", "pride_curse_soldier", "pride_curse_general", "pride_stairs"],
        "pride_f60": ["pride_curse_mage", "pride_curse_soldier", "pride_curse_general", "pride_mummy_king"],
        "pride_51_60": ["pride_curse_zombie", "pride_curse_mage", "pride_curse_soldier", "pride_curse_general", "pride_mummy_king"],
        // 攀登 61~70 樓
        "pride_f61": ["pride_dark_lycan", "pride_ice_tiger", "pride_stairs"],
        "pride_f62": ["pride_dark_lycan", "pride_ice_tiger", "pride_flame_beast", "pride_stairs"],
        "pride_f63": ["pride_dark_lycan", "pride_ice_tiger", "pride_flame_atki", "pride_stairs"],
        "pride_f64": ["pride_dark_lycan", "pride_ice_tiger", "pride_flame_beast", "pride_flame_atki", "pride_stairs"],
        "pride_f65": ["pride_ice_tiger", "pride_flame_beast", "pride_flame_atki", "pride_stairs"],
        "pride_f66": ["pride_ice_tiger", "pride_flame_beast", "pride_flame_atki", "pride_stairs"],
        "pride_f67": ["pride_dark_lycan", "pride_flame_beast", "pride_flame_atki", "pride_stairs"],
        "pride_f68": ["pride_dark_lycan", "pride_ice_tiger", "pride_flame_beast", "pride_flame_atki", "pride_stairs"],
        "pride_f69": ["pride_ice_tiger", "pride_flame_beast", "pride_flame_atki", "pride_stairs"],
        "pride_f70": ["pride_ice_tiger", "pride_flame_beast", "pride_flame_atki", "pride_iris_boss"],
        "pride_61_70": ["pride_dark_lycan", "pride_ice_tiger", "pride_flame_beast", "pride_flame_atki", "pride_iris_boss"],
        // 攀登 71~80 樓
        "pride_f71": ["pride_dark_blackknight", "pride_dark_flamewarrior", "pride_stairs"],
        "pride_f72": ["pride_dark_blackknight", "pride_dark_flamewarrior", "pride_dark_flamearcher", "pride_stairs"],
        "pride_f73": ["pride_dark_blackknight", "pride_dark_flamewarrior", "pride_dark_succubus_queen", "pride_stairs"],
        "pride_f74": ["pride_dark_blackknight", "pride_dark_flamewarrior", "pride_dark_flamearcher", "pride_dark_succubus_queen", "pride_stairs"],
        "pride_f75": ["pride_dark_flamewarrior", "pride_dark_flamearcher", "pride_dark_succubus_queen", "pride_stairs"],
        "pride_f76": ["pride_dark_flamewarrior", "pride_dark_flamearcher", "pride_dark_succubus_queen", "pride_stairs"],
        "pride_f77": ["pride_dark_blackknight", "pride_dark_flamearcher", "pride_dark_succubus_queen", "pride_stairs"],
        "pride_f78": ["pride_dark_blackknight", "pride_dark_flamewarrior", "pride_dark_flamearcher", "pride_dark_succubus_queen", "pride_stairs"],
        "pride_f79": ["pride_dark_flamewarrior", "pride_dark_flamearcher", "pride_dark_succubus_queen", "pride_stairs"],
        "pride_f80": ["pride_dark_flamewarrior", "pride_dark_flamearcher", "pride_dark_succubus_queen", "pride_vander_boss"],
        "pride_71_80": ["pride_dark_blackknight", "pride_dark_flamewarrior", "pride_dark_flamearcher", "pride_dark_succubus_queen", "pride_vander_boss"],
        // 攀登 81~90 樓
        "pride_f81": ["pride_proud_jenis", "pride_small_phantom", "pride_marcus_vampire", "pride_stairs"],
        "pride_f82": ["pride_proud_jenis", "pride_small_phantom", "pride_marcus_vampire", "pride_stairs"],
        "pride_f83": ["pride_proud_jenis", "pride_small_phantom", "pride_terror_zombie_king", "pride_stairs"],
        "pride_f84": ["pride_proud_jenis", "pride_small_phantom", "pride_marcus_vampire", "pride_terror_zombie_king", "pride_stairs"],
        "pride_f85": ["pride_small_phantom", "pride_marcus_vampire", "pride_terror_zombie_king", "pride_stairs"],
        "pride_f86": ["pride_small_phantom", "pride_marcus_vampire", "pride_terror_zombie_king", "pride_stairs"],
        "pride_f87": ["pride_proud_jenis", "pride_marcus_vampire", "pride_terror_zombie_king", "pride_stairs"],
        "pride_f88": ["pride_proud_jenis", "pride_small_phantom", "pride_marcus_vampire", "pride_terror_zombie_king", "pride_stairs"],
        "pride_f89": ["pride_small_phantom", "pride_marcus_vampire", "pride_terror_zombie_king", "pride_stairs"],
        "pride_f90": ["pride_small_phantom", "pride_marcus_vampire", "pride_terror_zombie_king", "pride_lich_boss"],
        "pride_81_90": ["pride_proud_jenis", "pride_small_phantom", "pride_marcus_vampire", "pride_terror_zombie_king", "pride_lich_boss"],
        // 攀登 91~100 樓
        "pride_f91":  ["pride_earth_king", "pride_water_king", "pride_wind_king", "pride_fire_king", "pride_stairs"],
        "pride_f92":  ["pride_iris_mob", "pride_mummy_king_mob", "pride_earth_king", "pride_water_king", "pride_wind_king", "pride_fire_king", "pride_stairs"],
        "pride_f93":  ["pride_iris_mob", "pride_mummy_king_mob", "pride_earth_king", "pride_water_king", "pride_wind_king", "pride_fire_king", "pride_stairs"],
        "pride_f94":  ["pride_iris_mob", "pride_mummy_king_mob", "pride_earth_king", "pride_water_king", "pride_wind_king", "pride_fire_king", "pride_vander_mob", "pride_stairs"],
        "pride_f95":  ["pride_earth_king", "pride_water_king", "pride_wind_king", "pride_fire_king", "pride_stairs"],
        "pride_f96":  ["pride_earth_king", "pride_water_king", "pride_wind_king", "pride_fire_king", "pride_stairs"],
        "pride_f97":  ["pride_iris_mob", "pride_mummy_king_mob", "pride_fire_king", "pride_vander_mob", "pride_stairs"],
        "pride_f98":  ["pride_iris_mob", "pride_mummy_king_mob", "pride_water_king", "pride_vander_mob", "pride_stairs"],
        "pride_f99":  ["pride_iris_mob", "pride_mummy_king_mob", "pride_water_king", "pride_vander_mob", "pride_stairs"],
        "pride_f100": ["pride_earth_king", "pride_water_king", "pride_wind_king", "pride_fire_king", "pride_reaper_boss"],
        "pride_91_100": ["pride_iris_mob", "pride_mummy_king_mob", "pride_earth_king", "pride_water_king", "pride_wind_king", "pride_fire_king", "pride_vander_mob", "pride_reaper_boss"],
        "oblivion_travel": ["lamia", "mermaid", "harpy", "griffon", "sildeis", "obli_portal"],
        "oblivion_island": ["obli_croc", "obli_werewolf", "obli_sharlob", "obli_arian", "obli_darkelf", "obli_bear", "obli_lizardman", "obli_kasta", "obli_lamia", "obli_lycan", "obli_axetaurus", "obli_troll", "obli_ungoliant", "obli_griffon", "obli_hammertaurus", "obli_harpy", "obli_shapeshifter", "obli_bigcroc", "obli_kastaking", "obli_doro", "obli_aruba", "obli_trollking", "obli_evillizard", "obli_cyclops", "obli_wyvern", "obli_bigtaurus"]
    }
}; // DB 結尾在這裡

// ===== 套裝代碼初始化：將 DB.sets 反向掛到各裝備的 .set 屬性 =====
// 修正：原本沒有任何物品擁有 .set，導致 setCheck 永遠為空、套裝加成與底色判定都不會觸發。
// 註：.set 掛在「基底物品 ID」上，與強化/祝福/遠古/屬性詞綴（存在裝備實例上）無關，
//     因此帶詞綴的裝備一樣會被正確計入套裝。
(function initSetTags() {
    const SET_CODE = {
        set_0: 'leather', set_1: 'oasis', set_2: 'gnome', set_3: 'silver',
        set_4: 'bone',    set_5: 'steel', set_6: 'mage',  set_7: 'dk',
        set_8: 'kurt',    set_9: 'mr',    set_10: 'guard', set_11: 'kinglord',
        set_12: 'demon',  set_13: 'darkelf'
    };
    for (let sid in DB.sets) {
        let code = SET_CODE[sid];
        if (!code) continue;
        (DB.sets[sid].items || []).forEach(iid => {
            if (DB.items[iid]) DB.items[iid].set = code;
        });
    }
})();

// ===== 🗼 傲慢之塔：傳送符 / 支配符 / 移動卷軸（11F~91F 共 9 組，程式化產生）=====
//  prideKind: 'pass'(傳送符) | 'dom'(支配符) | 'scroll'(移動卷軸)；prideTier: 樓層區間起始(11,21,...,91)
//  傳送符＝持有即可進入；支配符＝持有可進入並可在塔內手動傳送；移動卷軸＝無符時進入消耗一張
(function initPrideTalismans() {
    [11, 21, 31, 41, 51, 61, 71, 81, 91].forEach(N => {
        DB.items['item_pride_pass_' + N] = {
            n: `傲慢之塔傳送符(${N}F)`, type: 'misc', p: 0, c: 'text-amber-300', noUse: true, gachaWeight: 0,
            prideKind: 'pass', prideTier: N,
            d: `攜帶在身上即可進入傲慢之塔 ${N}~${N + 9}樓`
        };
        DB.items['item_pride_dom_' + N] = {
            n: `傲慢之塔支配符(${N}F)`, type: 'misc', p: 0, c: 'text-orange-300', noUse: true, gachaWeight: 0,
            prideKind: 'dom', prideTier: N,
            d: `攜帶在身上即可進入傲慢之塔${N}~${N + 9}樓，並可使用傳送術與瞬間移動卷軸`
        };
        DB.items['item_pride_scroll_' + N] = {
            n: `傲慢之塔移動卷軸(${N}F)`, type: 'misc', p: 0, c: 'text-sky-300', noUse: true, gachaWeight: 0,
            prideKind: 'scroll', prideTier: N,
            d: `進入 傲慢之塔${N}~${N + 9}樓 時消耗一張（持有 傳送符 或 支配符 則不消耗）。`
        };
        DB.items['item_pride_sealed_' + N] = {
            n: `封印的傲慢之塔傳送符(${N}F)`, type: 'misc', p: 100000, c: 'text-amber-200', eff: 'pride_unseal',
            prideKind: 'sealed', prideTier: N, gachaWeight: 1,
            d: `封印著傲慢之塔之力的符咒。使用後解除封印，獲得 傲慢之塔傳送符(${N}F)。`
        };
    });
})();

    // ===== 怪物專屬掉落表（依「怪物掉落資料.md」）=====
    // 格式：怪物顯示名稱: [[物品ID, 掉落機率(%)], ...]  每樣獨立判定一次