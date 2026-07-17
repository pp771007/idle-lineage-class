/* ============================================================================
 * load-testsave.mjs — 把 .testdata/ 的真實存檔灌進遊戲,供 Playwright 測試用
 *
 * 為什麼要有這支:玩家回報的問題有一大半在「新角色」上重現不出來(空背包/空倉庫/
 *   Lv1 技能/沒傭兵),而「重現不出來」很容易被誤讀成「沒問題」。踩過很多次。
 *
 * 用法(在測試腳本裡):
 *   import { loadTestSave } from '../scripts/load-testsave.mjs';
 *   await loadTestSave(page, { file: 'save1.json', slot: 1 });
 *
 * 灌檔流程比照 js/13 的匯入:存檔 blob 內的 wh(倉庫)/pets 是「共用桶」、不在存檔位裡,
 *   要拆出來各自寫;其餘欄位才寫進 lineage_idle_save_<slot>。
 * ========================================================================== */
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const DIR = new URL('../.testdata/', import.meta.url);

export function listTestSaves() {
  try { return readdirSync(DIR).filter((f) => /\.json$/i.test(f) && !f.startsWith('_')); }
  catch (e) { return []; }
}

export async function loadTestSave(page, opts = {}) {
  const files = listTestSaves();
  if (!files.length) throw new Error('.testdata/ 沒有存檔——請先放一份進去(該資料夾已 gitignore)');
  const file = opts.file || files[0];
  const url = new URL(file, DIR);
  if (!existsSync(url)) throw new Error('找不到 .testdata/' + file + '(現有:' + files.join(', ') + ')');
  const raw = readFileSync(url, 'utf8');

  const r = await page.evaluate(({ raw, slot }) => {
    const u = _saveUnwrap(raw);
    if (!u || !u.payload) return { err: '解不開存檔簽章(檔案格式不對?)' };
    const d = JSON.parse(u.payload);
    const c = {};
    for (const k in d) if (k !== 'wh' && k !== 'pets') c[k] = d[k];   // wh/pets 是共用桶,不屬於存檔位
    if (d.wh) { try { _lzSet(whKey(d.p), JSON.stringify({ items: d.wh.items || [], gold: d.wh.gold || 0 })); } catch (e) {} }
    _lzSet('lineage_idle_save_' + slot, _saveWrap(JSON.stringify(c)));
    currentSlot = slot;
    loadGame();
    let wh = 0;
    try { const w = _lzGet(whKey()); wh = w ? (JSON.parse(w).items || []).length : 0; } catch (e) {}
    return { 職業: player.cls, 等級: player.lv, 背包: (player.inv || []).length, 倉庫: wh, 傭兵: (player.allies || []).length };
  }, { raw, slot: opts.slot || 1 });

  if (r.err) throw new Error(r.err);
  return r;
}
