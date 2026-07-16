#!/usr/bin/env node
// 幀數 manifest 生成工具：掃 assets/anim|classanim|morphanim，把每個動畫資料夾的
//   「<前綴> → 從 0 起的連續幀數」寫進 js/anim-manifest.js。供 js/09 的 _manifestCount
//   查表用（免除「載到 404 為止」的逐號探測）。
//
// 用法：node tools/gen-anim-manifest.js   （在 repo 根目錄跑）
//
// 對照關係：js/09 探測某動作時走 urlFor(0)＝`<資料夾>/<前綴>0.png`，_manifestCount 反解出
//   資料夾(assets/<tree>/<名>) 與前綴(含八方向的 "d6/" 前置)，回傳連續幀數。因此本工具的
//   key 必須是「相對資料夾根的路徑去掉結尾數字與 .png」，八方向就自然帶 "d0/" 這類前置。

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ROOTS = ['assets/anim', 'assets/classanim', 'assets/morphanim'];

// 收集某資料夾底下所有 .png（含 d0..d7 這類子資料夾），回傳相對該資料夾根的 POSIX 路徑。
function collectPngs(folderAbs, relBase, out) {
    let entries;
    try { entries = fs.readdirSync(folderAbs, { withFileTypes: true }); } catch (e) { return; }
    for (const ent of entries) {
        const rel = relBase ? relBase + '/' + ent.name : ent.name;
        if (ent.isDirectory()) {
            collectPngs(path.join(folderAbs, ent.name), rel, out);
        } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.png')) {
            out.push(rel);
        }
    }
}

// 由「相對路徑」拆出 <前綴> 與 <幀號>：去掉結尾 .png 後，取結尾的連續數字為幀號、其餘為前綴。
//   例 "d0/attack_4.png" → { prefix:"d0/attack_", num:4 }；"skill_effect2_5.png" → { "skill_effect2_", 5 }
function splitPrefix(rel) {
    const base = rel.slice(0, -4);            // 去 .png
    const m = base.match(/(\d+)$/);           // 結尾連續數字＝幀號
    if (!m) return null;                      // 沒有數字結尾的檔（不是動畫幀）→ 略過
    return { prefix: base.slice(0, m.index), num: parseInt(m[1], 10) };
}

function buildFolderEntry(folderAbs) {
    const files = [];
    collectPngs(folderAbs, '', files);
    // 前綴 → 出現過的幀號集合
    const bucket = new Map();
    for (const rel of files) {
        const sp = splitPrefix(rel);
        if (!sp) continue;
        let set = bucket.get(sp.prefix);
        if (!set) { set = new Set(); bucket.set(sp.prefix, set); }
        set.add(sp.num);
    }
    // 每個前綴算「從 0 起的連續幀數」（與 js/09 逐號探測到缺號即止同語意）
    const entry = {};
    for (const [prefix, set] of bucket) {
        let n = 0;
        while (set.has(n)) n++;
        if (n > 0) entry[prefix] = n;         // 幀 0 缺席＝連續段 0＝該序列不存在→不收
    }
    // key 排序，輸出穩定（diff 友善）
    const sorted = {};
    for (const k of Object.keys(entry).sort()) sorted[k] = entry[k];
    return sorted;
}

function main() {
    const manifest = {};
    let folderCount = 0, seqCount = 0;
    for (const root of ROOTS) {
        const rootAbs = path.join(REPO_ROOT, root);
        let dirs;
        try { dirs = fs.readdirSync(rootAbs, { withFileTypes: true }); } catch (e) { continue; }
        for (const d of dirs) {
            if (!d.isDirectory()) continue;
            const entry = buildFolderEntry(path.join(rootAbs, d.name));
            const keyCount = Object.keys(entry).length;
            if (keyCount === 0) continue;     // 空資料夾不收
            manifest[root + '/' + d.name] = entry;
            folderCount++;
            seqCount += keyCount;
        }
    }
    // 資料夾 key 也排序
    const sortedManifest = {};
    for (const k of Object.keys(manifest).sort()) sortedManifest[k] = manifest[k];

    const header =
        '// 🤖 自動生成·勿手改 —— 跑 `node tools/gen-anim-manifest.js` 重生。\n' +
        '// 幀數 manifest：<資料夾> → <前綴> → 連續幀數。用途＝免除 js/09 的「載到 404 為止」探測（零 404·零往返）。\n' +
        '// ⚠️ 新增/重轉任何 assets/anim|classanim|morphanim 的幀後必須重跑此工具，否則引擎會少載幀。\n';
    const body = 'const ANIM_MANIFEST = ' + JSON.stringify(sortedManifest) + ';\n';
    const outPath = path.join(REPO_ROOT, 'js', 'anim-manifest.js');
    fs.writeFileSync(outPath, header + body);
    console.log(`[gen-anim-manifest] 資料夾 ${folderCount} 個、序列 ${seqCount} 條 → js/anim-manifest.js (${(header + body).length} bytes)`);
}

main();
