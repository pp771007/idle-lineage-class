// ===== ✨ 戰鬥特效層 VFX（cosmetic-only：傷害數字／擊殺粒子／受擊震動。不改任何遊戲數值，全程 try/catch，壞掉也不影響遊戲。__vfxOff=true 可關閉） =====
let _vfxPending = [];
let _vfxLastKillRect = null;   // 最近一次擊殺的怪物格螢幕位置（供稀有掉落閃光定位）
let _mobRenderCache = null;    // 🚀 怪物列差異更新快取：{ ml節點, structKey, slots:[每格html字串] }→只重建有變動的格子，免每幀整列 innerHTML 重建
const _VFX_ELE_COLOR = { fire:'#ff7a45', water:'#4fc3f7', wind:'#9ccc65', earth:'#d8a657', magic:'#ce93d8', normal:'#f1f5f9' };
// ✨ 適合投射動畫的「非屬性」攻擊技能（屬性魔法已自動涵蓋）：技能id→投射外觀(屬性色 or 'axe'=旋轉金屬斧)
const _VFX_PROJECTILE_SKILLS = { sk_lightarrow:'magic', sk_disintegrate:'magic', sk_illu_mindbreak:'magic', sk_elf_triple:'wind' };   // 戰斧投擲是「下一擊」增益→改在攻擊觸發處射斧，不走 cast 樞紐
function _vfxLayer() {
    let l = document.getElementById('vfx-layer');
    if (!l) { l = document.createElement('div'); l.id = 'vfx-layer'; document.body.appendChild(l); }
    return l;
}
// ===== ⚡ 法術特效疊加層（v2.7.15）：技能命中時於目標怪身上疊播天堂原版法術特效序列幀（一次性·加亮混合 screen·純視覺不影響任何數值·吃 __vfxOff 開關）=====
//   幀來源：assets/fx/<dir>/<prefix>_0.png..N.png（spr2png 單檔轉·gfx 對照 list.spr·10-0.spr=lightning gfx10）。
//   SPELL_FX：技能顯示名(sk.n) → { dir 資料夾, prefix 檔名前綴, n 幀數, fps, blend, h=特效高度為目標圖高的倍數, ax/ay=特效「打擊錨點」在特效圖內的比例(閃電 origin≈底部中央) }。
//   ⚠️ 新增特效：轉檔丟 assets/fx/<名>/ + 這裡加一行；掛點在 js/07 castSkillInner 逐目標迴圈(通用·只有註冊者會播)。
//   SPELL_FX 欄位：{ dir, prefix, n幀, fps, blend(選·如 screen 加亮), ax/ay=特效內「打擊錨點」比例,
//     尺寸/行為三選一：proj=飛行投射物型(冰箭/火箭/光箭/風刃/冰錐/冰矛圍籬)→(a)尺寸=「原生像素 × 怪物顯示縮放」(對等大小·nw/nh=原生像素·首播未解碼後備)＋(b)v3.0.5 由施法者(戰鬥區底部中央)飛向目標命中點·途中循環幀·抵達消失／h=特效高度為目標圖高倍數(範圍型如落雷·原地疊播)／w=特效寬度為目標圖寬倍數(地面型如地裂術·寬≈怪寬·原地)，h/w 另一維依原始比例推導；
//     targetVc(選·覆寫目標垂直錨點·地面型特效設近腳底如0.92), shadowPrefix(選·特效自身影子層檔名前綴·疊在特效下·同畫布同步) }。
const SPELL_FX = {
    '極道落雷': { dir: '極道落雷', prefix: 'fx',    n: 6,  fps: 14, blend: 'screen', h: 2.0, ax: 0.60, ay: 0.98 },   // gfx10 lightning：加亮發光·頂天劈下(高度驅動)
    '地裂術':   { dir: '地裂術',   prefix: '129-1', n: 10, fps: 14, w: 0.85, ax: 0.50, ay: 0.82, targetVc: 0.92, shadowPrefix: '129-1_s' },   // gfx129 earthquake：不透明岩石(無 blend)＋地面裂痕影子層·寬度驅動(寬≈怪寬×0.85)·erupt 自腳底
    '極光雷電': { dir: '極光雷電', prefix: '170-1', n: 6,  fps: 14, blend: 'screen', h: 2.0, ax: 0.50, ay: 0.96 },   // gfx170：高柱雷電(122×255)·加亮·頂天劈下
    '火箭':     { dir: '火箭',     prefix: '171-1', n: 5,  fps: 12, blend: 'screen', proj: true, nw: 43, nh: 49, ax: 0.50, ay: 0.50 },   // gfx171 fireball：飛行投射物(取代丟出的火球)·原生尺寸×怪物顯示縮放(對等大小)·加亮
    '冰箭':     { dir: '冰箭',     prefix: '167-1', n: 4,  fps: 12, blend: 'screen', proj: true, nw: 32, nh: 40, ax: 0.50, ay: 0.50 },   // gfx167 energy bolt：飛行投射物·原生尺寸×怪物縮放·加亮
    '光箭':     { dir: '冰箭',     prefix: '167-1', n: 4,  fps: 12, blend: 'screen', proj: true, nw: 32, nh: 40, ax: 0.50, ay: 0.50 },   // gfx167 energy bolt：光箭與冰箭同 spr(167 也作用於光箭)→複用已部署 167 幀·飛行投射物·原生尺寸×怪物縮放
    // 🔮 v2.7.39 攻擊/減益型法術特效批次(13 支·來源 spr彙整/fx/·單檔 --luma-alpha 去黑邊·screen 加亮·觸發免寫=js/07 castSkillInner 逐目標迴圈通用·名字對上技能 n 自動播)：
    '冰矛圍籬':   { dir: '冰矛圍籬',   prefix: '1809-2', n: 3,  fps: 10, blend: 'screen', proj: true, nw: 70, nh: 48, ax: 0.50, ay: 0.50 },   // v3.0.4 飛行投射物·原生70×48×怪物縮放(對等大小)
    '冰錐':       { dir: '冰錐',       prefix: '1797-1', n: 4,  fps: 12, blend: 'screen', proj: true, nw: 15, nh: 21, ax: 0.50, ay: 0.50 },   // v3.0.4 飛行投射物·原生15×21×怪物縮放(對等大小)
    '冰雪暴':     { dir: '冰雪暴',     prefix: '757-0', n: 23, fps: 16, blend: 'screen', h: 1.35, ax: 0.50, ay: 0.55 },   // gfx757 blizzard·大範圍冰暴蓋身
    '寒冷戰慄':   { dir: '寒冷戰慄',   prefix: '236-1', n: 6,  fps: 12, blend: 'screen', h: 1.00, ax: 0.50, ay: 0.55 },   // gfx236·寒氣直立
    '毒咒':       { dir: '毒咒',       prefix: '745-0', n: 8,  fps: 12, blend: 'screen', h: 0.80, ax: 0.50, ay: 0.55 },   // gfx745 poison·綠毒霧
    '流星雨':     { dir: '流星雨',     prefix: '762-0', n: 20, fps: 16, blend: 'screen', h: 1.90, ax: 0.50, ay: 0.88 },   // gfx762 meteor·天降(高柱·錨近底=衝擊點)
    '烈炎術':     { dir: '烈炎術',     prefix: '1811-0', n: 19, fps: 16, blend: 'screen', h: 1.20, ax: 0.50, ay: 0.55 },   // v2.7.41 換 gfx1811(原764)·317×240
    '燃燒的火球': { dir: '燃燒的火球', prefix: '1669-1', n: 6, fps: 12, blend: 'screen', h: 1.00, ax: 0.50, ay: 0.55 },   // gfx1669 fireball·火球衝擊
    '龍捲風':     { dir: '龍捲風',     prefix: '758-0', n: 20, fps: 16, blend: 'screen', h: 1.50, ax: 0.50, ay: 0.82, targetVc: 0.90 },   // gfx758 tornado·自腳底捲起(錨近腳底)
    '吸血鬼之吻': { dir: '吸血鬼之吻', prefix: '235-1', n: 6, fps: 12, blend: 'screen', h: 1.00, ax: 0.50, ay: 0.55 },   // gfx235·紅色吸血
    '魔法封印':   { dir: '魔法封印',   prefix: '761-0', n: 10, fps: 14, blend: 'screen', h: 1.00, ax: 0.50, ay: 0.55 },   // gfx761 seal(vacuum/沉默)·寬幅符陣
    '緩速術':     { dir: '緩速術',     prefix: '752-0', n: 8,  fps: 12, blend: 'screen', h: 0.85, ax: 0.50, ay: 0.55 },   // gfx752 slow·藍色減速
    '起死回生術': { dir: '起死回生術', prefix: '754-0', n: 21, fps: 16, blend: 'screen', h: 1.30, ax: 0.50, ay: 0.55 },   // gfx754·對不死系 instakill·聖光
    // 🔮 v2.7.41 新增攻擊/proc 型法術特效(來源 spr彙整/fx·單檔 --luma-alpha·screen·觸發免寫=castSkillInner + 武器proc 逐目標通用)：
    '地獄之牙':   { dir: '地獄之牙',   prefix: '1801-0', n: 9,  fps: 14, blend: 'screen', h: 0.70, ax: 0.50, ay: 0.55 },   // gfx1801·橫向獠牙(101×44 寬)
    '寒冰氣息':   { dir: '寒冰氣息',   prefix: '1804-0', n: 21, fps: 16, blend: 'screen', h: 1.20, ax: 0.50, ay: 0.55 },   // gfx1804·冰霜吐息 198×153
    '岩牢':       { dir: '岩牢',       prefix: '1805-0', n: 17, fps: 14, blend: 'screen', h: 1.20, ax: 0.50, ay: 0.55 },   // gfx1805·岩石囚牢包身 85×72
    '火風暴':     { dir: '火風暴',     prefix: '1819-0', n: 14, fps: 14, blend: 'screen', h: 1.30, ax: 0.50, ay: 0.55 },   // gfx1819·火焰風暴 149×165
    '風刃':       { dir: '風刃',       prefix: '1799-0', n: 5,  fps: 12, blend: 'screen', proj: true, nw: 36, nh: 26, ax: 0.50, ay: 0.50 },   // gfx1799·飛行投射物(風刃 36×26)·原生尺寸×怪物縮放·加亮
    '黑闇之影':   { dir: '黑闇之影',   prefix: '1803-0', n: 9,  fps: 14, blend: 'screen', h: 1.00, ax: 0.50, ay: 0.55 },   // gfx1803·暗影 67×53
    // 🎇 v2.7.41 多層同步特效(cfg.layers=額外前綴·3 spr 同畫布 --multi 同時播·screen 疊亮)：
    '究極光裂術': { dir: '究極光裂術', prefix: '1815-0', layers: ['1816-0', '1817-0'], n: 21, fps: 16, blend: 'screen', h: 1.90, ax: 0.50, ay: 0.85 },   // sk_integrate tier10·天降聖光 395×568(3層)
    '震裂術':     { dir: '震裂術',     prefix: '1812-0', layers: ['1813-0', '1814-0'], n: 16, fps: 16, blend: 'screen', h: 1.25, ax: 0.50, ay: 0.60 },   // spellProc earth aoe·地震裂 278×188(3層)
    // 🔮 v2.7.44 屬性變體特效(cfg.byEle·依目標怪 mob.e 選幀組)：能量感測(sk_energy_sense manual·js/07 sense 分支掛點)→火/水/地/風 各 8 幀·目標無屬性不播
    '能量感測':   { dir: '能量感測',   n: 8, fps: 12, blend: 'screen', h: 0.85, ax: 0.50, ay: 0.55,
                    byEle: { fire: { prefix: '火' }, water: { prefix: '水' }, earth: { prefix: '地' }, wind: { prefix: '風' } } },
};
let _spellFxCache = {};    // dir/prefix → [Image]（預載·避免首播閃爍）
let _spellFxActive = {};   // fxKey(技能名|目標uid) → true：同目標同特效同時只保留一個（防「一次顯示兩個」）
function _preloadFxFrames(dir, prefix, n) {
    let key = dir + '/' + prefix;
    if (_spellFxCache[key]) return _spellFxCache[key];
    let arr = [];
    for (let i = 0; i < n; i++) { let im = new Image(); im.src = 'assets/fx/' + encodeURIComponent(dir) + '/' + prefix + '_' + i + '.png'; arr.push(im); }
    _spellFxCache[key] = arr;
    return arr;
}
// 🧊 v2.7.46 死亡特效(death_effect) registry＋預載：怪名→{n幀, ew/eh 特效畫布尺寸, anchored:{ox,oy,bw,bh}}。frames 在 assets/anim/<怪名>/death_effect_N.png(隨本體部署·非 fx 夾)。死亡時(vfxKill)獨立時間軸疊播(可比 body death 長)。
const MOB_ANIM_DEATH_FX = {
    '冰之女王侍女': { n: 25, ew: 158, eh: 115, anchored: { ox: -26, oy: 10, bw: 101, bh: 114 } },
};   // v3.0.13 冰之女王新版動畫無 death_effect→移除(死亡改由 21 幀 death_ 序列本身表現)
let _deathFxCache = {};
function _preloadDeathFx(name, n) {
    if (_deathFxCache[name]) return _deathFxCache[name];
    let arr = [];
    for (let i = 0; i < n; i++) { let im = new Image(); im.src = 'assets/anim/' + encodeURIComponent(name) + '/death_effect_' + i + '.png'; arr.push(im); }
    _deathFxCache[name] = arr;
    return arr;
}
// ⚡ 在目標怪身上疊播一輪法術特效。skn=技能顯示名（須在 SPELL_FX 註冊·未註冊者靜默略過）。
//    v2.7.16：立即渲染（不再等 first.load）＋ _spellFxActive[技能名|uid] 去重（修「一次顯示兩個／忽多忽少」）。
//    v2.7.18：支援 shadowPrefix→特效自身影子層（疊在特效下·同畫布同步·如地裂術地面裂痕）；targetVc→地面型錨點下移。
function playSpellFx(skn, mob) {
    try {
        if (window.__vfxOff || !mob) return;
        let cfg = SPELL_FX[skn]; if (!cfg) return;
        // 🔮 v2.7.44 屬性變體(cfg.byEle)：依「目標怪屬性 mob.e」選對應幀組(如能量感測 火/水/地/風)·目標無對應屬性(none等)→靜默不播
        if (cfg.byEle) { let _v = cfg.byEle[mob.e]; if (!_v) return; cfg = Object.assign({}, cfg, _v); }
        let fxKey = skn + '|' + mob.uid;
        if (_spellFxActive[fxKey]) return;   // 🔒 該目標的此特效還在播 → 不疊第二個
        let ml = document.getElementById('mob-list');
        let slot = ml && ml.querySelector('.mob-target[data-uid="' + mob.uid + '"]');
        if (!slot) return;
        let box = slot.querySelector('.mob-img-inner') || slot.querySelector('.mob-img-wrap') || slot;
        let r = box.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return;
        let layer = _vfxLayer();
        if (layer.childElementCount > 220) return;   // 洗版保護
        let _mobImg = box.querySelector('img:not(.mob-anim-shadow):not(.mob-anim-weapon):not(.mob-anim-weapon2)');
        let _anc = _mobImgAnchor(_mobImg);
        let _vc = (cfg.targetVc != null) ? cfg.targetVc : _anc.vc;   // 🌋 地面型特效可指定較低錨點(近腳底)
        let ax = r.left + r.width * _anc.hc, ay = r.top + r.height * _vc;   // 打擊點螢幕座標
        let frames = _preloadFxFrames(cfg.dir, cfg.prefix, cfg.n);
        let shadowFrames = cfg.shadowPrefix ? _preloadFxFrames(cfg.dir, cfg.shadowPrefix, cfg.n) : null;
        let first = frames[0];
        let _arFallback = !(first.naturalWidth && first.naturalHeight);   // 🩹 v2.7.41 首播未解碼→ar 退 0.93→解碼後 interval 重算一次(修高瘦特效如究極光裂術 395×568 首播被 0.93 撐寬)
        let ar = _arFallback ? 0.93 : (first.naturalWidth / first.naturalHeight);
        let fxW, fxH, left, top;
        let _computeGeom = () => {
            if (cfg.proj) {                                                     // 🎯 v3.0.3 投射物型(冰箭/火箭/光箭/風刃/冰錐/冰矛圍籬)尺寸：原生像素 × 怪物顯示縮放(screen-px/source-px)＝對等大小(不隨怪物身高放大)；v3.0.5 起 proj 另走「飛行」路徑(見下方 mkImg 後分支)
                let mScale = 1;
                if (_mobImg && _mobImg.naturalHeight) { let mr = _mobImg.getBoundingClientRect(); if (mr.height) mScale = mr.height / _mobImg.naturalHeight; }
                let baseW = first.naturalWidth || cfg.nw || 40, baseH = first.naturalHeight || cfg.nh || 40;
                fxW = baseW * mScale; fxH = baseH * mScale;
            }
            else if (cfg.w != null) { fxW = r.width * cfg.w; fxH = fxW / ar; }  // 🌋 寬度驅動(地面型·寬≈怪寬)
            else { fxH = r.height * (cfg.h || 1.8); fxW = fxH * ar; }            // ⚡ 高度驅動(範圍型·如落雷)
            left = (ax - fxW * (cfg.ax != null ? cfg.ax : 0.5)) + 'px';
            top = (ay - fxH * (cfg.ay != null ? cfg.ay : 0.9)) + 'px';
        };
        _computeGeom();
        let mkImg = (src, extraCls, blend) => {
            let el = document.createElement('img');
            el.className = 'vfx-spell' + (extraCls ? ' ' + extraCls : '');
            el.dataset.fxkey = fxKey;
            el.src = src;
            el.style.width = fxW + 'px'; el.style.height = fxH + 'px'; el.style.left = left; el.style.top = top;
            if (blend) el.style.mixBlendMode = blend;
            layer.appendChild(el);
            return el;
        };
        let _applyGeom = (elm) => { if (elm) { elm.style.width = fxW + 'px'; elm.style.height = fxH + 'px'; elm.style.left = left; elm.style.top = top; } };
        // 🎯 v3.0.5 投射物「飛行」：proj 型特效由施法者(戰鬥區底部中央)飛向目標命中點(ax,ay)·途中循環播放幀·抵達即消失(取代原地疊播·符合「取代丟出去的投射物」)。
        if (cfg.proj) {
            let bv = document.getElementById('battle-view');
            let br = bv && bv.getBoundingClientRect();
            let ox = br ? (br.left + br.width * 0.5) : ax;                       // 施法者水平＝戰鬥區中央
            let oy = br ? (br.top + br.height * 0.98) : (ay + (fxH || 40) * 3);  // 施法者垂直＝戰鬥區底部(玩家視角)
            let axf = (cfg.ax != null ? cfg.ax : 0.5), ayf = (cfg.ay != null ? cfg.ay : 0.5);   // 投射物錨點(哪一點沿路徑走)
            let el = mkImg(first.src, null, cfg.blend);
            el.style.left = (ox - fxW * axf) + 'px'; el.style.top = (oy - fxH * ayf) + 'px';   // 立即置於起點(避免首幀閃在終點)
            _spellFxActive[fxKey] = true;
            let dist = Math.hypot(ax - ox, ay - oy);
            let dur = Math.max(140, Math.min(380, dist / 1600 * 1000));         // 飛行時間依距離(近140ms~遠380ms)
            let frameDur = 1000 / (cfg.fps || 12);
            let _now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            let t0 = _now();
            let raf = () => {
                try {
                    let elapsed = _now() - t0, t = Math.min(1, elapsed / dur);
                    if (_arFallback && first.naturalWidth && first.naturalHeight) { _arFallback = false; _computeGeom(); }   // 🩹 解碼後校正尺寸(採真原生像素)
                    let px = ox + (ax - ox) * t, py = oy + (ay - oy) * t;
                    el.style.width = fxW + 'px'; el.style.height = fxH + 'px';
                    el.style.left = (px - fxW * axf) + 'px'; el.style.top = (py - fxH * ayf) + 'px';
                    let fi = Math.floor(elapsed / frameDur) % cfg.n; if (frames[fi]) el.src = frames[fi].src;   // 途中循環幀
                    if (t < 1) requestAnimationFrame(raf);
                    else { el.remove(); delete _spellFxActive[fxKey]; }
                } catch (e) { try { el.remove(); } catch (_) {} delete _spellFxActive[fxKey]; }
            };
            requestAnimationFrame(raf);
            return;
        }
        let sEl = shadowFrames ? mkImg(shadowFrames[0].src, 'vfx-spell-shadow', null) : null;   // 🌑 影子層先加(在後·DOM 順序→特效層疊其上)
        let el = mkImg(first.src, null, cfg.blend);   // 特效層
        // 🎇 v2.7.41 多層同步(cfg.layers=額外前綴陣列·同畫布同幾何同幀·如究極光裂術/震裂術 3 spr 同時播)：每層一個 img·全部同 fxW/fxH/left/top/blend·interval 同步推進
        let extraLayers = [];
        if (cfg.layers) for (let lp of cfg.layers) { let lf = _preloadFxFrames(cfg.dir, lp, cfg.n); extraLayers.push({ el: mkImg(lf[0].src, null, cfg.blend), frames: lf }); }
        _spellFxActive[fxKey] = true;
        let i = 0, iv = setInterval(() => {
            i++;
            if (i >= cfg.n) { clearInterval(iv); el.remove(); if (sEl) sEl.remove(); extraLayers.forEach(L => L.el.remove()); delete _spellFxActive[fxKey]; return; }
            if (_arFallback && first.naturalWidth && first.naturalHeight) { _arFallback = false; ar = first.naturalWidth / first.naturalHeight; _computeGeom(); _applyGeom(el); if (sEl) _applyGeom(sEl); extraLayers.forEach(L => _applyGeom(L.el)); }   // 🩹 解碼後重算幾何一次(僅首播命中)
            el.src = frames[i].src;
            if (sEl && shadowFrames[i]) sEl.src = shadowFrames[i].src;
            extraLayers.forEach(L => { if (L.frames[i]) L.el.src = L.frames[i].src; });
        }, Math.round(1000 / (cfg.fps || 14)));
    } catch (e) {}
}
// 🙏 v2.7.48 自我增益特效（SELF_FX）：治癒/武器附魔/防禦/屏障等 type buff/heal 技能施放時，於 #battle-view 中央疊播（本遊戲戰鬥區無玩家立繪→以戰鬥區為「施法者」錨點）。
//   掛點＝js/07 castSkill 施放成功且 isSupportSkill(sk)→playSelfFx(sk.n)（未註冊者靜默略過）。cfg：{dir,prefix,n,fps,blend,h=高為戰鬥區高倍數,cx/cy=戰鬥區內錨點比例(預設 0.5/0.62 略偏下=玩家視角)}。
const SELF_FX = {
    // 治癒（744 三階同 spr→中/高複用初級 dir·全部治癒術獨立 2173）
    '初級治癒術':   { dir: '初級治癒術', prefix: '744-0', n: 21, fps: 16, blend: 'screen', h: 0.42 },
    '中級治癒術':   { dir: '初級治癒術', prefix: '744-0', n: 21, fps: 16, blend: 'screen', h: 0.50 },
    '高級治癒術':   { dir: '初級治癒術', prefix: '744-0', n: 21, fps: 16, blend: 'screen', h: 0.58 },
    '全部治癒術':   { dir: '全部治癒術', prefix: '2173-0', n: 17, fps: 16, blend: 'screen', h: 0.62 },
    // 武器附魔
    '神聖武器':     { dir: '神聖武器',   prefix: '2165-0', n: 13, fps: 14, blend: 'screen', h: 0.45 },
    '祝福魔法武器': { dir: '祝福魔法武器', prefix: '2176-0', n: 17, fps: 16, blend: 'screen', h: 0.60 },
    '火炎武器':     { dir: '火炎武器',   prefix: '2182-0', n: 11, fps: 14, blend: 'screen', h: 0.50 },
    '擬似魔法武器': { dir: '擬似魔法武器', prefix: '747-0', n: 19, fps: 16, blend: 'screen', h: 0.48 },
    // 防禦/屏障/強化
    '屬性防禦':     { dir: '屬性防禦',   prefix: '2184-0', n: 13, fps: 14, blend: 'screen', h: 0.45 },
    '魔法屏障':     { dir: '魔法屏障',   prefix: '2174-0', n: 15, fps: 14, blend: 'screen', h: 0.55 },
    '鎧甲護持':     { dir: '鎧甲護持',   prefix: '748-0', n: 20, fps: 16, blend: 'screen', h: 0.48 },
    '負重強化':     { dir: '負重強化',   prefix: '2170-0', n: 13, fps: 14, blend: 'screen', h: 0.48 },
    '體魄強健術':   { dir: '體魄強健術', prefix: '750-0', n: 11, fps: 14, blend: 'screen', h: 0.58 },
    '通暢氣脈術':   { dir: '通暢氣脈術', prefix: '751-0', n: 11, fps: 14, blend: 'screen', h: 0.58 },
    '加速術':       { dir: '加速術',     prefix: '755-0', n: 6,  fps: 12, blend: 'screen', h: 0.42 },
    '傳送術':       { dir: '傳送術',     prefix: '169-0', n: 7,  fps: 14, blend: 'screen', h: 0.85, cy: 0.55 },   // 🌀 v2.7.54 高瘦傳送光柱(97×330)·手動施放於 manualCast teleport 分支掛
};
let _selfFxActive = {};   // 技能名 → true：同增益同時只保留一個
function playSelfFx(skn) {
    try {
        if (window.__vfxOff) return;
        let cfg = SELF_FX[skn]; if (!cfg) return;
        if (_selfFxActive[skn]) return;
        let bv = document.getElementById('battle-view');
        if (!bv) return;
        let r = bv.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return;
        let layer = _vfxLayer();
        if (layer.childElementCount > 220) return;
        let frames = _preloadFxFrames(cfg.dir, cfg.prefix, cfg.n);
        let first = frames[0];
        let _arFallback = !(first.naturalWidth && first.naturalHeight);   // 🩹 首播未解碼→退 1·解碼後重算一次
        let ar = _arFallback ? 1 : (first.naturalWidth / first.naturalHeight);
        let fxH, fxW, left, top;
        let _geom = () => {
            fxH = r.height * (cfg.h || 0.5); fxW = fxH * ar;
            left = (r.left + r.width * (cfg.cx != null ? cfg.cx : 0.5) - fxW / 2) + 'px';
            top = (r.top + r.height * (cfg.cy != null ? cfg.cy : 0.62) - fxH / 2) + 'px';
        };
        _geom();
        let el = document.createElement('img');
        el.className = 'vfx-spell vfx-selffx';
        el.src = first.src;
        el.style.width = fxW + 'px'; el.style.height = fxH + 'px'; el.style.left = left; el.style.top = top;
        if (cfg.blend) el.style.mixBlendMode = cfg.blend;
        layer.appendChild(el);
        _selfFxActive[skn] = true;
        let i = 0, iv = setInterval(() => {
            i++;
            if (i >= cfg.n) { clearInterval(iv); el.remove(); delete _selfFxActive[skn]; return; }
            if (_arFallback && first.naturalWidth && first.naturalHeight) { _arFallback = false; ar = first.naturalWidth / first.naturalHeight; _geom(); el.style.width = fxW + 'px'; el.style.height = fxH + 'px'; el.style.left = left; el.style.top = top; }
            el.src = frames[i].src;
        }, Math.round(1000 / (cfg.fps || 14)));
    } catch (e) {}
}
// ===== ❄️ 冰凍「狀態」疊加動畫（v2.7.20）：怪物 st.freeze>0 時於身上循環播冰封 state 幀·解凍(freeze歸0/怪陣亡)時播一次 end 碎裂幀 =====
//   來源 assets/fx/冰凍狀態/state_0..7.png(持續中·全域時鐘循環)＋end_0..3.png(結束碎裂·一次性)。逐怪一個疊層(vfx-layer·每幀重錨定跟隨怪·適用所有怪不限動畫怪)。
//   由 8fps ticker 呼叫(見檔尾 setInterval)。開關吃 window.__vfxOff。與 SPELL_FX(施法瞬間)不同：這是「狀態持續期間」的疊層。
const FREEZE_FX = { dir: '冰凍狀態', stateN: 8, endN: 4, fps: 8, h: 0.38, ax: 0.5, ay: 0.5 };   // h=冰封高度為怪圖高倍數(v2.7.21 用戶要冰塊縮小·寬度=原1/3→h 1.15→0.38 等比縮)·ax/ay=冰封錨點(置中蓋身)
let _freezeFx = {};   // uid → { el, mode:'state'|'end', t0 }
function _freezePosition(el, r) {
    let f0 = _preloadFxFrames(FREEZE_FX.dir, 'state', FREEZE_FX.stateN)[0];
    let ar = (f0.naturalWidth && f0.naturalHeight) ? (f0.naturalWidth / f0.naturalHeight) : 1.1;
    let fxH = r.height * FREEZE_FX.h, fxW = fxH * ar;
    let cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.5;   // 幾何中心蓋住身體
    el.style.width = fxW + 'px'; el.style.height = fxH + 'px';
    el.style.left = (cx - fxW * FREEZE_FX.ax) + 'px';
    el.style.top = (cy - fxH * FREEZE_FX.ay) + 'px';
}
function _updateFreezeFx() {
    try {
        if (window.__vfxOff) { for (let u in _freezeFx) { _freezeFx[u].el.remove(); delete _freezeFx[u]; } return; }
        let ml = document.getElementById('mob-list'); if (!ml) return;
        let byUid = {};
        if (typeof mapState !== 'undefined' && mapState.mobs) for (let m of mapState.mobs) if (m) byUid[m.uid] = m;
        let layer = _vfxLayer();
        // (1) 掃場上卡片：凍結中→建/更新 state 疊層並重錨定
        ml.querySelectorAll('.mob-target[data-uid]').forEach(card => {
            let uid = card.getAttribute('data-uid');
            let m = byUid[uid];
            let frozen = !!(m && m.curHp > 0 && m.st && m.st.freeze > 0);
            let fx = _freezeFx[uid];
            if (frozen) {
                let box = card.querySelector('.mob-img-inner') || card.querySelector('.mob-img-wrap') || card;
                let r = box.getBoundingClientRect(); if (r.width === 0) return;
                if (!fx || fx.mode === 'end') { let el = document.createElement('img'); el.className = 'vfx-spell vfx-freeze'; layer.appendChild(el); fx = _freezeFx[uid] = { el: el, mode: 'state', t0: Date.now() }; }
                _freezePosition(fx.el, r);
                let frames = _preloadFxFrames(FREEZE_FX.dir, 'state', FREEZE_FX.stateN);
                let f = Math.floor(Date.now() / (1000 / FREEZE_FX.fps)) % FREEZE_FX.stateN;
                if (frames[f]) fx.el.src = frames[f].src;
            } else if (fx && fx.mode === 'state') {
                fx.mode = 'end'; fx.t0 = Date.now();   // 解凍/陣亡→切碎裂動畫(位置定格在最後一次錨定·怪離場也能播完)
            }
        });
        // (2) 推進 end 動畫 + 清理殘留
        for (let uid in _freezeFx) {
            let fx = _freezeFx[uid];
            if (fx.mode === 'end') {
                let frames = _preloadFxFrames(FREEZE_FX.dir, 'end', FREEZE_FX.endN);
                let f = Math.floor((Date.now() - fx.t0) / (1000 / FREEZE_FX.fps));
                if (f >= FREEZE_FX.endN) { fx.el.remove(); delete _freezeFx[uid]; }
                else if (frames[f]) fx.el.src = frames[f].src;
            } else if (!byUid[uid]) { fx.el.remove(); delete _freezeFx[uid]; }   // state 中但怪突然消失(未經解凍)→清
        }
    } catch (e) {}
}
// ===== 🔥 怪物技能特效（v2.7.22·skill_effect_start→end）：由 _mobAnimTrigger 於怪施放技能時登記 _mobSkillFx[uid]={t0}·此處(8fps ticker)逐幀推進 =====
//   時間軸：start_0..N-1 播畢接 end_0..M-1(一次性)·置中蓋怪·screen 加亮·大畫布(獨立於本體·assets/anim/<怪名>/skill_effect_start/end_N.png)·播畢或怪離場即移除。
let _mobSkillFx = {};   // uid → { el, t0 }
function _updateMobSkillFx() {
    try {
        if (window.__vfxOff) { for (let u in _mobSkillFx) { if (_mobSkillFx[u].el) _mobSkillFx[u].el.remove(); if (_mobSkillFx[u].el2) _mobSkillFx[u].el2.remove(); delete _mobSkillFx[u]; } return; }
        let ids = Object.keys(_mobSkillFx); if (!ids.length) return;
        let ml = document.getElementById('mob-list');
        let byUid = {};
        if (typeof mapState !== 'undefined' && mapState.mobs) for (let m of mapState.mobs) if (m) byUid[m.uid] = m;
        let layer = _vfxLayer();
        for (let uid of ids) {
            let s = _mobSkillFx[uid];
            let m = byUid[uid];
            let a = m && _mobAnimCache[m.n];
            if (!m || !a || a === 'probing' || !a.skillFx || !a.skillFx.start) { if (s.el) s.el.remove(); if (s.el2) s.el2.remove(); if (s.el3) s.el3.remove(); delete _mobSkillFx[uid]; continue; }
            let startN = a.skillFx.start.length, endN = a.skillFx.end ? a.skillFx.end.length : 0;
            let cfg = MOB_ANIM_SKILL_FX[m.n] || {};
            let total = startN + endN + (cfg.endHoldF || 0);   // ⏸ v2.7.34 endHoldF＝最後一幀額外定格幀數（吐息尾雲消散·讓特效跨過本體動畫尾端）
            let f = Math.floor((Date.now() - s.t0) / (1000 / MOB_ANIM_FPS)) - (cfg.delayF || 0);   // ⏳ v2.7.32 delayF＝延遲起噴幀數（安塔瑞斯張嘴幀才開始）
            let card = ml && ml.querySelector('.mob-target[data-uid="' + uid + '"]');
            if (f >= total || !card) { if (s.el) s.el.remove(); if (s.el2) s.el2.remove(); if (s.el3) s.el3.remove(); delete _mobSkillFx[uid]; continue; }
            if (f < 0) continue;   // ⏳ 尚未到起噴幀（張嘴前不顯示·el 尚未建立）
            let box = card.querySelector('.mob-img-inner') || card.querySelector('.mob-img-wrap') || card;
            let r = box.getBoundingClientRect(); if (r.width === 0) continue;
            if (!s.el) { s.el = document.createElement('img'); s.el.className = 'vfx-spell vfx-mobskill'; layer.appendChild(s.el); }
            if (cfg.startPfx2 && a.skillFx.start2 && !s.el2) { s.el2 = document.createElement('img'); s.el2.className = 'vfx-spell vfx-mobskill'; layer.appendChild(s.el2); }   // 🔥 v2.7.41 第二特效層(不死鳥)
            if (cfg.startPfx3 && a.skillFx.start3 && !s.el3) { s.el3 = document.createElement('img'); s.el3.className = 'vfx-spell vfx-mobskill'; layer.appendChild(s.el3); }   // 🔥 v3.0.13 第三特效層(底比斯阿努比斯 skill_effect1/2/3 三層同時)
            let seq, fi;
            if (f < startN) { seq = a.skillFx.start; fi = f; }
            else if (f < startN + endN) { seq = a.skillFx.end; fi = f - startN; }
            else { seq = endN ? a.skillFx.end : a.skillFx.start; fi = (endN || startN) - 1; }   // ⏸ endHoldF 期間：定格最後一幀（尾雲消散）
            let f0 = a.skillFx.start[0];
            if (cfg.anchored) {   // 🌍 世界格線錨定（v2.7.31·像素級）：特效與本體共用世界格線·單獨轉檔→用 meta latticeOrigin 差算出的固定偏移(ox,oy)貼在本體 img 上（縮放由 rect/畫布尺寸自動吸收）
                let _bimg = box.querySelector('img:not(.mob-anim-shadow):not(.mob-anim-weapon):not(.mob-anim-weapon2)');
                if (_bimg) {
                    let _br = _bimg.getBoundingClientRect();
                    if (_br.width > 0) {
                        let _sx = _br.width / cfg.anchored.bw, _sy = _br.height / cfg.anchored.bh;
                        s.el.style.width = ((f0.naturalWidth || 1) * _sx) + 'px'; s.el.style.height = ((f0.naturalHeight || 1) * _sy) + 'px';
                        s.el.style.left = (_br.left + cfg.anchored.ox * _sx) + 'px'; s.el.style.top = (_br.top + cfg.anchored.oy * _sy) + 'px';
                        if (seq[fi]) s.el.src = seq[fi].src;
                        if (s.el2 && a.skillFx.start2) {   // 🔥 v2.7.41 第二特效層(不死鳥 skill_effect2)：與 start 同畫布(--multi)→同幾何同錨定·同步幀
                            s.el2.style.width = s.el.style.width; s.el2.style.height = s.el.style.height;
                            s.el2.style.left = s.el.style.left; s.el2.style.top = s.el.style.top;
                            let _fi2 = fi < a.skillFx.start2.length ? fi : a.skillFx.start2.length - 1;
                            if (a.skillFx.start2[_fi2]) s.el2.src = a.skillFx.start2[_fi2].src;
                        }
                        if (s.el3 && a.skillFx.start3) {   // 🔥 v3.0.13 第三特效層：同幾何·同步幀(超長定格尾幀)
                            s.el3.style.width = s.el.style.width; s.el3.style.height = s.el.style.height;
                            s.el3.style.left = s.el.style.left; s.el3.style.top = s.el.style.top;
                            let _fi3 = fi < a.skillFx.start3.length ? fi : a.skillFx.start3.length - 1;
                            if (a.skillFx.start3[_fi3]) s.el3.src = a.skillFx.start3[_fi3].src;
                        }
                    }
                }
                continue;
            }
            let ar = (f0.naturalWidth && f0.naturalHeight) ? (f0.naturalWidth / f0.naturalHeight) : 1.5;
            let fxH = r.height * (cfg.h || 1.6), fxW = fxH * ar;
            let cx = r.left + r.width * 0.5, cy;
            if (cfg.feet) {   // 🔥 地面型(敵人施法火環)：錨在本體圖「不透明區底部」＝真實腳底(bc 逐怪逐幀動態偵測·統一畫布 idle 腳底非畫布底也精準)·v2.7.26
                let _bimg = box.querySelector('img:not(.mob-anim-shadow):not(.mob-anim-weapon):not(.mob-anim-weapon2)');
                if (_bimg) { let _br = _bimg.getBoundingClientRect(); cy = _br.top + _br.height * _mobImgAnchor(_bimg).bc; }
                else cy = r.top + r.height * 0.78;
            } else cy = r.top + r.height * 0.5;   // 身體中心(DK/卡瑞 火焰爆發)
            let ay = (cfg.ay != null) ? cfg.ay : 0.55;
            s.el.style.width = fxW + 'px'; s.el.style.height = fxH + 'px';
            s.el.style.left = (cx - fxW * 0.5) + 'px'; s.el.style.top = (cy - fxH * ay) + 'px';
            if (seq[fi]) s.el.src = seq[fi].src;
        }
    } catch (e) {}
}
// 由 _renderMobsImpl 迴圈呼叫（讀 m.justHit 前）：用 HP 差捕捉本幀傷害，免改 50+ 個傷害落點
function _vfxQueueDmg(m) {
    if ((window.__vfxOff && window.__vfxNumOff) || !m) { if (m) m._vfxBig = false; return; }   // 🔢 v3.0.9 傷害數字獨立於特效：只有「特效關且數字也關」才完全略過→數字開時即使關特效仍捕捉 HP 差生成數字
    let prev = (m._vfxHp == null) ? m.curHp : m._vfxHp;
    let d = prev - m.curHp;
    m._vfxHp = m.curHp;
    let big = m._vfxBig; m._vfxBig = false;   // 'crit' | 'heavy' | undefined（只有爆擊/重擊才放大上色，不再用傷害量門檻）
    if (d > 0 && m.curHp > 0) {   // 致命一擊交給 vfxKill 的粒子，這裡只顯示非致命傷害數字
        let ele = (m.justHit && m.justHit !== true) ? m.justHit : 'normal';
        _vfxPending.push({ uid: m.uid, dmg: d, ele: ele, big: big });
    }
}
// innerHTML 重建後呼叫：此時格子已布局，可取螢幕座標生成飄字
function _vfxFlush() {
    if (window.__vfxOff && window.__vfxNumOff) { _vfxPending = []; return; }   // 🔢 v3.0.9 特效關但數字開→仍走 flush 顯示數字（粒子/impact 於下方另由 __vfxOff 個別關）
    if (!_vfxPending.length) return;
    let layer = _vfxLayer();
    let ml = document.getElementById('mob-list');
    if (ml) {
        // 🚀 先一次讀完所有格子座標(批次量測)、再一次產生所有特效→消除「讀-寫-讀」反覆強制重排(layout thrashing)
        let reads = [];
        for (const p of _vfxPending) {
            let slot = ml.querySelector('.mob-target[data-uid="' + p.uid + '"]');
            if (!slot) continue;
            let box = slot.querySelector('.mob-img-inner') || slot.querySelector('.mob-img-wrap') || slot;   // 🎯 v2.6.41 VFX 錨定「圖層 .mob-img-inner」(帶 translateY/scale·getBoundingClientRect 反映實際位置) 而非「容器 .mob-img-wrap」→修 v2.6.39 單排景深(後排上移30px/前排放大1.55)後 死亡殘影/擊殺特效/傷害數字 錯位
            let r = box.getBoundingClientRect();
            if (r.width === 0) continue;
            reads.push({ p: p, cx: r.left + r.width / 2, top: r.top, h: r.height });
        }
        for (const it of reads) {
            let cx = it.cx, cy = it.top + it.h * 0.45;
            // 🩸 傷害數字＝玩家最在意的資訊、單一輕量文字節點→放寬上限至 200，使快速/多段攻擊(龍騎士、AoE、傭兵/召喚同時打)也穩定顯示，不再整批被略過
            if (layer.childElementCount < 200) _vfxNumber(cx + (Math.random() * 26 - 13), it.top + it.h * 0.40, it.p.dmg, it.p.ele, it.p.big);
            // ✨ 命中衝擊環＋屬性火花＝較重(blur/box-shadow/多節點)→維持原防洪上限 80；場上特效過多時只略過「粒子」、傷害數字照常顯示
            if (!window.__vfxOff && layer.childElementCount < 80) _vfxImpact(cx, cy, it.p.ele, it.p.big);   // 🎚️ v3.0.9 命中衝擊環/火花＝純特效→僅特效開時顯示（傷害數字已獨立於上方）
        }
    }
    _vfxPending = [];
}
function _vfxNumber(x, y, dmg, ele, big) {
    if (window.__vfxNumOff) return;   // 🔢 v3.0.2 「只關傷害數字」獨立開關：關掉所有飄動傷害數字(致命/非致命皆走此唯一渲染點)·其餘特效不受影響
    let el = document.createElement('div');
    el.className = 'vfx-dmg' + (big ? ' vfx-crit' : '');
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.color = big === 'crit' ? '#ff3b30' : (big === 'heavy' ? '#ffd54f' : (_VFX_ELE_COLOR[ele] || '#f1f5f9'));   // 爆擊大紅／重擊大金／其餘依屬性
    el.style.fontSize = (big ? 30 : 18) + 'px';
    el.textContent = dmg >= 10000 ? (dmg / 1000).toFixed(1) + 'k' : ('' + dmg);
    _vfxLayer().appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => { if (el.parentNode) el.remove(); }, 1400);
}
// 命中衝擊：擴散圓環 + 數顆屬性火花（大傷害更大更紅、更多火花）
function _vfxImpact(cx, cy, ele, big) {
    let layer = _vfxLayer();
    let col = big === 'crit' ? '#ff3b30' : (big === 'heavy' ? '#ffd54f' : (_VFX_ELE_COLOR[ele] || '#f1f5f9'));   // 爆擊紅／重擊金／其餘依屬性
    let ring = document.createElement('div');
    ring.className = 'vfx-ring';
    let rs = big ? 72 : 44;
    ring.style.left = cx + 'px'; ring.style.top = cy + 'px';
    ring.style.width = rs + 'px'; ring.style.height = rs + 'px';
    ring.style.borderColor = col; ring.style.boxShadow = '0 0 8px ' + col;
    ring.style.animation = 'vfxRing ' + (big ? 0.5 : 0.4) + 's ease-out forwards';
    layer.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });
    setTimeout(() => { if (ring.parentNode) ring.remove(); }, 800);
    let n = big ? 7 : 4;
    for (let i = 0; i < n; i++) {
        let sp = document.createElement('div'); sp.className = 'vfx-particle';
        let sz = 3 + Math.random() * 3;
        sp.style.width = sz + 'px'; sp.style.height = sz + 'px';
        sp.style.left = cx + 'px'; sp.style.top = cy + 'px';
        sp.style.background = col; sp.style.boxShadow = '0 0 5px ' + col;
        layer.appendChild(sp);
        let ang = Math.PI * 2 * Math.random();
        let dist = (big ? 34 : 22) + Math.random() * 26;
        let dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 6;
        sp.animate(
            [ { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
              { transform: 'translate(calc(-50% + ' + dx.toFixed(1) + 'px), calc(-50% + ' + dy.toFixed(1) + 'px)) scale(.2)', opacity: 0 } ],
            { duration: 300 + Math.random() * 220, easing: 'cubic-bezier(.2,.7,.3,1)' }
        ).onfinish = () => sp.remove();
    }
}
// 🎯 v2.6.45 怪物圖「視覺中心」偵測：怪物 PNG 多為方形畫布、實體繪於下方(腳貼底·上方透明)→死亡爆裂/傷害數字若錨在方框幾何中心(0.45~0.5)會浮在怪物「上方」。
//   改抓「不透明像素邊界框」的中心＝真正的怪物身體中心(實測多在 0.68~0.81 縱向)。縮到 96px 掃 alpha(便宜)＋依 src 快取(同種怪只算一次)。
//   ⚠️file:// 下 canvas.getImageData 會 taint(SecurityError)→退回常數 {vc:0.66,hc:0.5}(仍遠優於 0.45)並快取避免每次重試；GitHub/https 同源可正常逐圖精算。
let _mobAnchorCache = {};
function _mobImgAnchor(imgEl) {
    let fallback = { vc: 0.66, hc: 0.5, bc: 0.95 };   // bc=不透明區「底部」比例(最低不透明像素下緣·地面型特效錨腳底用)
    try {
        if (!imgEl) return fallback;
        let key = imgEl.currentSrc || imgEl.src;
        if (!key) return fallback;
        if (_mobAnchorCache[key]) return _mobAnchorCache[key];
        if (!imgEl.complete || !imgEl.naturalWidth) return fallback;   // 尚未載入→先用 fallback、不快取(下次重試)
        let cw = Math.min(imgEl.naturalWidth, 96), ch = Math.min(imgEl.naturalHeight, 96);
        let cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
        let ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(imgEl, 0, 0, cw, ch);
        let d;
        try { d = ctx.getImageData(0, 0, cw, ch).data; }
        catch (e) { _mobAnchorCache[key] = fallback; return fallback; }   // file:// taint→快取 fallback 停止重試
        let minX = cw, maxX = -1, minY = ch, maxY = -1;
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
            if (d[(y * cw + x) * 4 + 3] > 16) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
        }
        if (maxY < 0) { _mobAnchorCache[key] = fallback; return fallback; }   // 全透明→fallback
        let res = { vc: (minY + maxY) / 2 / ch, hc: (minX + maxX) / 2 / cw, bc: (maxY + 1) / ch };
        _mobAnchorCache[key] = res;
        return res;
    } catch (e) { return fallback; }
}

// 擊殺粒子爆裂：在 killMob 標記死亡後、重繪前呼叫（此時格子 DOM 仍在）
function vfxKill(mob) {
    try {
        if (!mob) return;   // 🎚️ v3.0.1 關閉特效時「保留死亡動畫」：不再整個 return，改為只擋「傷害數字/頭目閃光」等純裝飾（見下），死亡序列殘影(death_*.png)＋死亡特效層(death_effect)照播＝怪物死亡畫面不消失
        let ml = document.getElementById('mob-list');
        let slot = ml && ml.querySelector('.mob-target[data-uid="' + mob.uid + '"]');
        if (!slot) return;
        let box = slot.querySelector('.mob-img-inner') || slot.querySelector('.mob-img-wrap') || slot;   // 🎯 v2.6.41 VFX 錨定「圖層 .mob-img-inner」(帶 translateY/scale·getBoundingClientRect 反映實際位置) 而非「容器 .mob-img-wrap」→修 v2.6.39 單排景深(後排上移30px/前排放大1.55)後 死亡殘影/擊殺特效/傷害數字 錯位
        let r = box.getBoundingClientRect();
        if (r.width === 0) return;
        let _anc = _mobImgAnchor(box.querySelector('img:not(.mob-anim-shadow):not(.mob-anim-weapon):not(.mob-anim-weapon2)'));   // 🎯 v2.6.45 錨到怪物實體視覺中心(非方框中心)→爆裂/數字落在怪身上
        let bcx = r.left + r.width / 2, bcy = r.top + r.height / 2;   // 方框幾何中心(殘影全圖覆蓋用)
        let cx = r.left + r.width * _anc.hc, cy = r.top + r.height * _anc.vc;   // 怪物身體中心(爆裂環/核心/粒子用)
        _vfxLastKillRect = { left: r.left, top: r.top, width: r.width, height: r.height };   // 供稀有掉落閃光定位
        let layer = _vfxLayer();
        // 🩸 致命一擊的傷害數字：死怪在下一幀渲染前已被 settleDeadMobs 移除→渲染側 HP-delta 抓不到，故在此(格子 DOM 仍在)補顯示，使龍騎士等「一/二擊秒殺」也看得到傷害
        if (!window.__vfxNumOff) { let _prev = (mob._vfxHp != null) ? mob._vfxHp : (mob.hp || 0);   // 🔢 v3.0.9 致命傷害數字改由「傷害數字開關」控制（獨立於特效）：數字開→即使關特效仍顯示致命傷害數字（死亡動畫本就照播）
          let _kdmg = Math.floor(_prev - mob.curHp);   // 自上次渲染以來累積傷害(含致命擊；curHp 可能為負＝溢殺，顯示實際打出的數值)
          let _kbig = mob._vfxBig; mob._vfxBig = false;   // 'crit'|'heavy'：致命擊的爆擊/重擊旗標仍在(渲染未重設)
          if (_kdmg > 0 && layer.childElementCount < 200) {
              let _kele = (mob.justHit && mob.justHit !== true) ? mob.justHit : 'normal';
              _vfxNumber(cx + (Math.random() * 26 - 13), r.top + r.height * Math.max(0.12, _anc.vc - 0.30), _kdmg, _kele, _kbig);   // 🎯 v2.6.45 數字浮於怪身上方(相對身體中心·非固定 0.40 方框位)
          }
        }
        let color = mob.boss ? '#ffd54f' : '#ff8a5c';
        // 🎞️ v2.6.93 有死亡序列(death_*.png)→殘影改播死亡動畫，並略過白光殘影/衝擊波環/核心爆閃/爆裂粒子（死亡幀本身已表達「被擊殺」，白光重疊反而髒）。無死亡動畫則維持原白閃表現。
        let _da = (typeof _mobAnimCache !== 'undefined') ? _mobAnimCache[mob.n] : null;
        let _deathSeq = (_da && _da !== 'probing' && _da.death) ? _da.death : null;
        // ✨ 強化死亡表現（讓「怪物被消滅」更明顯）：白閃殘影 + 衝擊波環 + 核心爆閃。場上特效過多(>150)時略過較重的殘影/環，只留粒子，避免大量 AoE 連殺洗版。
        if (layer.childElementCount < 150) {
            // 1) 死亡殘影：複製怪物圖像 → 白化＋放大＋淡出（強烈的「被抹除」感）
            try {
                let _img = box.querySelector('img:not(.mob-anim-shadow):not(.mob-anim-weapon):not(.mob-anim-weapon2)');
                if (_deathSeq && _img && _img.src && _img.naturalWidth !== 0) {   // 🚫 v2.7.49 只在有死亡序列幀(anim)時播殘影；移除靜態怪的 CSS 白閃殘影
                    let gh = document.createElement('img');
                    gh.className = 'vfx-ghost'; gh.src = _img.src;
                    gh.style.left = bcx + 'px'; gh.style.top = bcy + 'px';   // 殘影＝整張圖複製→定位方框中心以完整覆蓋原圖(對齊)
                    gh.style.width = r.width + 'px'; gh.style.height = r.height + 'px';
                    gh.style.transformOrigin = (_anc.hc * 100).toFixed(1) + '% ' + (_anc.vc * 100).toFixed(1) + '%';   // 🎯 v2.6.45 放大自「怪物身體中心」擴散(非方框中心)→白閃由怪身發散
                    layer.appendChild(gh);
                    if (_deathSeq) {   // 🎞️ v2.6.86 死亡序列（death_*.png）：殘影原位逐幀播一輪→短淡出（取代白閃；怪卡本體照常移除）
                        gh.src = _deathSeq[0].src;
                        // ⚔️ v2.7.44 死亡殘影武器層(death_w/death_w2·screen 疊上)：與 body death 同鐘逐幀(--multi 共畫布同幾何)·如爆彈花爆炸(僅 death_w)/龍死亡火焰。嚴格 1:1(本幀無 _w 幀→不換 src)。
                        let _ghW = [];
                        for (let _wk of ['weapon', 'weapon2']) {
                            let _wd = _da[_wk] && _da[_wk].death;
                            if (_wd && _wd.length && _wd[0]) {
                                let g2 = document.createElement('img');
                                g2.className = 'vfx-ghost'; g2.src = _wd[0].src;
                                g2.style.left = gh.style.left; g2.style.top = gh.style.top;
                                g2.style.width = gh.style.width; g2.style.height = gh.style.height;
                                g2.style.transformOrigin = gh.style.transformOrigin;
                                g2.style.mixBlendMode = 'screen';
                                layer.appendChild(g2);
                                _ghW.push({ el: g2, seq: _wd });
                            }
                        }
                        let _fi = 0, _fint = setInterval(() => {
                            _fi++;
                            if (_fi < _deathSeq.length) { gh.src = _deathSeq[_fi].src; _ghW.forEach(W => { if (W.seq[_fi]) W.el.src = W.seq[_fi].src; }); }
                            else { clearInterval(_fint); try { gh.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-out' }).onfinish = () => gh.remove(); } catch (e) { gh.remove(); } _ghW.forEach(W => { try { W.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-out' }).onfinish = () => W.el.remove(); } catch (e) { W.el.remove(); } }); }
                        }, 1000 / MOB_ANIM_FPS);
                        setTimeout(() => { try { clearInterval(_fint); if (gh.isConnected) gh.remove(); _ghW.forEach(W => { if (W.el.isConnected) W.el.remove(); }); } catch (e) {} }, _deathSeq.length * (1000 / MOB_ANIM_FPS) + 2000);   // 保險回收
                    }   // 🚫 v2.7.49 移除無死亡序列時的 CSS 白閃殘影 else 分支
                }
            } catch (e) {}
            // 🧊 v2.7.46 死亡多重特效：death_effect anchored 疊層(獨立時間軸·可比 body death 長·如冰之女王碎裂 body5幀/effect25幀)。錨定同 skill_effect：殘影錨在 box rect·offset×scale·screen 加亮。
            try {
                let _dfCfg = (typeof MOB_ANIM_DEATH_FX !== 'undefined') ? MOB_ANIM_DEATH_FX[mob.n] : null;
                if (_dfCfg) {
                    let _dfF = _preloadDeathFx(mob.n, _dfCfg.n);
                    let _dsx = r.width / _dfCfg.anchored.bw, _dsy = r.height / _dfCfg.anchored.bh;
                    let de = document.createElement('img'); de.className = 'vfx-spell'; de.style.mixBlendMode = 'screen';
                    de.src = _dfF[0].src;
                    de.style.width = (_dfCfg.ew * _dsx) + 'px'; de.style.height = (_dfCfg.eh * _dsy) + 'px';
                    de.style.left = (r.left + _dfCfg.anchored.ox * _dsx) + 'px'; de.style.top = (r.top + _dfCfg.anchored.oy * _dsy) + 'px';
                    layer.appendChild(de);
                    let _dfi = 0, _dfint = setInterval(() => {
                        _dfi++;
                        if (_dfi < _dfCfg.n) { if (_dfF[_dfi]) de.src = _dfF[_dfi].src; }
                        else { clearInterval(_dfint); try { de.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease-out' }).onfinish = () => de.remove(); } catch (e) { de.remove(); } }
                    }, 1000 / MOB_ANIM_FPS);
                    setTimeout(() => { try { clearInterval(_dfint); if (de.isConnected) de.remove(); } catch (e) {} }, _dfCfg.n * (1000 / MOB_ANIM_FPS) + 2000);   // 保險回收
                }
            } catch (e) {}
            // 🚫 v2.7.49 移除死亡衝擊波環(vfx-killring)/核心爆閃(vfx-particle) CSS 特效——只保留死亡序列幀 anim
        }
        // 🚫 v2.7.49 移除死亡爆裂粒子(vfx-particle) CSS 特效——只保留死亡序列幀 anim
        if (!window.__vfxOff && mob.boss) {   // 👑 頭目擊殺：戰場金白閃光（🎚️ v3.0.1 純裝飾→關閉特效時不閃）
            let bv = document.getElementById('battle-view'); let br = bv && bv.getBoundingClientRect();
            if (br && br.width > 0) {
                let fl = document.createElement('div'); fl.className = 'vfx-areaflash';
                fl.style.left = br.left + 'px'; fl.style.top = br.top + 'px'; fl.style.width = br.width + 'px'; fl.style.height = br.height + 'px';
                fl.style.background = 'radial-gradient(circle, rgba(255,255,255,.6), rgba(255,213,79,.25) 45%, rgba(255,213,79,0) 75%)';
                fl.style.animation = 'vfxBossFlash .7s ease-out forwards';
                layer.appendChild(fl); fl.addEventListener('animationend', () => fl.remove(), { once: true }); setTimeout(() => { if (fl.parentNode) fl.remove(); }, 1200);
            }
        }
    } catch (e) {}
}
// 升級慶祝：金色擴散圓環 + 上升文字 + 戰場金光 + 金色火花
function vfxLevelUp() {
    try {
        if (window.__vfxOff) return;
        let bv = document.getElementById('battle-view');
        let r = bv ? bv.getBoundingClientRect() : null;
        if (!r || r.width === 0) { let hb = document.getElementById('bar-hp'); r = hb ? hb.getBoundingClientRect() : null; }
        if (!r || r.width === 0) return;
        let cx = r.left + r.width / 2, cy = r.top + r.height * 0.5;
        let layer = _vfxLayer();
        if (bv && bv.getBoundingClientRect().width > 0) {
            let br = bv.getBoundingClientRect();
            let fl = document.createElement('div'); fl.className = 'vfx-areaflash';
            fl.style.left = br.left + 'px'; fl.style.top = br.top + 'px'; fl.style.width = br.width + 'px'; fl.style.height = br.height + 'px';
            fl.style.background = 'radial-gradient(circle, rgba(255,213,79,.42), rgba(255,213,79,0) 70%)';
            fl.style.animation = 'vfxLvFlash .9s ease-out forwards';
            layer.appendChild(fl); fl.addEventListener('animationend', () => fl.remove(), { once: true }); setTimeout(() => { if (fl.parentNode) fl.remove(); }, 1500);
        }
        for (let i = 0; i < 2; i++) {
            let ring = document.createElement('div'); ring.className = 'vfx-lvring';
            let sz = 90 + i * 44;
            ring.style.left = cx + 'px'; ring.style.top = cy + 'px'; ring.style.width = sz + 'px'; ring.style.height = sz + 'px';
            ring.style.animation = 'vfxLvRing ' + (0.7 + i * 0.15) + 's ease-out forwards';
            layer.appendChild(ring); ring.addEventListener('animationend', () => ring.remove(), { once: true }); setTimeout(() => { if (ring.parentNode) ring.remove(); }, 1500);
        }
        let t = document.createElement('div'); t.className = 'vfx-lvtext';
        t.style.left = cx + 'px'; t.style.top = cy + 'px'; t.style.fontSize = '26px';
        t.textContent = 'LEVEL UP!  Lv.' + player.lv;
        t.style.animation = 'vfxLvText 1.5s ease-out forwards';
        layer.appendChild(t); t.addEventListener('animationend', () => t.remove(), { once: true }); setTimeout(() => { if (t.parentNode) t.remove(); }, 2200);
        let n = 18;
        for (let i = 0; i < n; i++) {
            let sp = document.createElement('div'); sp.className = 'vfx-particle';
            let sz = 4 + Math.random() * 4; sp.style.width = sz + 'px'; sp.style.height = sz + 'px';
            sp.style.left = cx + 'px'; sp.style.top = cy + 'px'; sp.style.background = '#ffd54f'; sp.style.boxShadow = '0 0 7px #ffca28';
            layer.appendChild(sp);
            let ang = Math.PI * 2 * (i / n) + Math.random() * 0.4; let dist = 60 + Math.random() * 70;
            let dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
            sp.animate(
                [ { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
                  { transform: 'translate(calc(-50% + ' + dx.toFixed(1) + 'px), calc(-50% + ' + dy.toFixed(1) + 'px)) scale(.2)', opacity: 0 } ],
                { duration: 650 + Math.random() * 350, easing: 'cubic-bezier(.15,.7,.3,1)' }
            ).onfinish = () => sp.remove();
        }
    } catch (e) {}
}
// 取得某怪物格的螢幕矩形（不存在/未布局回 null）
function _vfxSlotRect(uid) {
    let ml = document.getElementById('mob-list');
    let slot = ml && ml.querySelector('.mob-target[data-uid="' + uid + '"]');
    if (!slot) return null;
    let box = slot.querySelector('.mob-img-inner') || slot.querySelector('.mob-img-wrap') || slot;   // 🎯 v2.6.41 VFX 錨定「圖層 .mob-img-inner」(帶 translateY/scale·getBoundingClientRect 反映實際位置) 而非「容器 .mob-img-wrap」→修 v2.6.39 單排景深(後排上移30px/前排放大1.55)後 死亡殘影/擊殺特效/傷害數字 錯位
    let r = box.getBoundingClientRect();
    return (r.width > 0) ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
}
// 魔法拋射物：從戰場底部中央飛向目標（本遊戲戰場無玩家 sprite）→ 抵達時小火花；衝擊環/數字由渲染側負責，避免重疊
function _vfxProjectile(rect, ele) {
    try {
        if (window.__vfxOff || !rect) return;
        let bv = document.getElementById('battle-view'); let br = bv && bv.getBoundingClientRect();
        if (!br || br.width === 0) return;
        let layer = _vfxLayer();
        if (layer.childElementCount > 120) return;
        let sx = br.left + br.width / 2, sy = br.bottom - 10;
        let tx = rect.left + rect.width / 2, ty = rect.top + rect.height * 0.45;
        let isAxe = (ele === 'axe');
        let col = isAxe ? '#cbd5e1' : (_VFX_ELE_COLOR[ele] || '#ce93d8');
        let orb = document.createElement('div'); orb.className = 'vfx-particle';
        let osz = isAxe ? 18 : 15; orb.style.width = osz + 'px'; orb.style.height = osz + 'px';
        orb.style.left = sx + 'px'; orb.style.top = sy + 'px';
        orb.style.background = isAxe ? 'radial-gradient(circle, #f8fafc 25%, #94a3b8 78%, rgba(0,0,0,0) 100%)' : 'radial-gradient(circle, #fff 10%, ' + col + ' 55%, rgba(0,0,0,0) 100%)';
        orb.style.boxShadow = isAxe ? '0 0 8px #cbd5e1' : ('0 0 14px ' + col + ', 0 0 26px ' + col);
        layer.appendChild(orb);
        let dx = tx - sx, dy = ty - sy;
        let _endTf = 'translate(calc(-50% + ' + dx.toFixed(1) + 'px), calc(-50% + ' + dy.toFixed(1) + 'px)) scale(1.05)' + (isAxe ? ' rotate(720deg)' : '');
        let anim = orb.animate(
            [ { transform: 'translate(-50%,-50%) scale(.7)' + (isAxe ? ' rotate(0deg)' : ''), opacity: .85 },
              { transform: _endTf, opacity: 1 } ],
            { duration: 180, easing: 'cubic-bezier(.45,.05,.7,1)' }
        );
        anim.onfinish = () => {
            orb.remove();
            for (let i = 0; i < 4; i++) {
                let sp = document.createElement('div'); sp.className = 'vfx-particle';
                let sz = 3 + Math.random() * 3; sp.style.width = sz + 'px'; sp.style.height = sz + 'px';
                sp.style.left = tx + 'px'; sp.style.top = ty + 'px'; sp.style.background = col; sp.style.boxShadow = '0 0 5px ' + col;
                layer.appendChild(sp);
                let ang = Math.PI * 2 * Math.random(), dist = 16 + Math.random() * 20;
                let ex = Math.cos(ang) * dist, ey = Math.sin(ang) * dist;
                sp.animate([ { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: 'translate(calc(-50% + ' + ex.toFixed(1) + 'px), calc(-50% + ' + ey.toFixed(1) + 'px)) scale(.2)', opacity: 0 } ], { duration: 260 + Math.random() * 160, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => sp.remove();
            }
        };
    } catch (e) {}
}
// castSkill 包裝用：對本次施法「掉了血」的怪各射一發拋射物（before=施法前 HP/位置快照）
function _vfxCastProjectiles(before, ele) {
    if (window.__vfxOff || !before) return;
    let e = (ele && ele !== 'none') ? ele : 'magic';
    for (const b of before) {
        if (!b) continue;
        let m = mapState.mobs.find(x => x && x.uid === b.uid);
        let alive = m && !m._dead;
        let hp = alive ? m.curHp : 0;
        if (hp < b.hp) {   // 這隻吃到傷害
            let rect = alive ? _vfxSlotRect(b.uid) : b.rect;   // 活著→現位置；被殺→施法前位置
            if (rect) _vfxProjectile(rect, e);
        }
    }
}
// 稀有掉落（潘朵拉權重=1）：金色名稱上升 + 金色星芒火花，定位於剛擊殺的怪物格
function vfxRareDrop(name) {
    try {
        if (window.__vfxOff) return;
        let rect = _vfxLastKillRect;
        if (!rect || rect.width === 0) { let bv = document.getElementById('battle-view'); let br = bv && bv.getBoundingClientRect(); if (br && br.width > 0) rect = { left: br.left, top: br.top, width: br.width, height: br.height }; }
        if (!rect) return;
        let cx = rect.left + rect.width / 2, cy = rect.top + rect.height * 0.4;
        let layer = _vfxLayer();
        let t = document.createElement('div'); t.className = 'vfx-lvtext';
        t.style.left = cx + 'px'; t.style.top = cy + 'px'; t.style.fontSize = '20px'; t.style.color = '#ffe08a';
        t.textContent = '✦ ' + (name || '稀有掉落') + ' ✦';
        t.style.animation = 'vfxLvText 1.6s ease-out forwards';
        layer.appendChild(t); t.addEventListener('animationend', () => t.remove(), { once: true }); setTimeout(() => { if (t.parentNode) t.remove(); }, 2300);
        let n = 16;
        for (let i = 0; i < n; i++) {
            let sp = document.createElement('div'); sp.className = 'vfx-particle';
            let sz = 4 + Math.random() * 4; sp.style.width = sz + 'px'; sp.style.height = sz + 'px';
            sp.style.left = cx + 'px'; sp.style.top = cy + 'px'; sp.style.background = '#ffe082'; sp.style.boxShadow = '0 0 8px #ffca28, 0 0 14px #ffb300';
            layer.appendChild(sp);
            let ang = Math.PI * 2 * (i / n) + Math.random() * 0.4, dist = 40 + Math.random() * 55;
            let dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 8;
            sp.animate([ { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: 'translate(calc(-50% + ' + dx.toFixed(1) + 'px), calc(-50% + ' + dy.toFixed(1) + 'px)) scale(.2)', opacity: 0 } ], { duration: 600 + Math.random() * 350, easing: 'cubic-bezier(.15,.7,.3,1)' }).onfinish = () => sp.remove();
        }
    } catch (e) {}
}
// 玩家受到較大一擊：戰場輕微震動 + HP 條紅閃
function vfxPlayerHit(dmg) {
    try {
        if (window.__vfxOff) return;
        let frac = (player && player.mhp) ? dmg / player.mhp : 0;
        if (frac < 0.10) return;   // 只在 ≥10% 最大HP 的一擊才震，避免每下都晃
        let bv = document.getElementById('battle-view');
        if (bv) { bv.classList.remove('vfx-shake'); void bv.offsetWidth; bv.classList.add('vfx-shake'); bv.addEventListener('animationend', () => bv.classList.remove('vfx-shake'), { once: true }); }
        let bar = document.getElementById('bar-hp'); bar = bar && bar.parentElement;
        if (bar) { bar.classList.remove('vfx-hurt'); void bar.offsetWidth; bar.classList.add('vfx-hurt'); bar.addEventListener('animationend', () => bar.classList.remove('vfx-hurt'), { once: true }); }
    } catch (e) {}
}

// 🎚️ 戰鬥特效開關（僅標題畫面提供；遊戲中不再出現）：玩家選擇持久化於 localStorage，載入時套用到 window.__vfxOff
const _VFX_PREF_KEY = 'lineage_vfx_off';
const _VFX_NUM_PREF_KEY = 'lineage_vfx_num_off';   // 🔢 v3.0.2 「只關傷害數字」獨立偏好
function _applyVfxPref() {
    let off = false;
    try { off = localStorage.getItem(_VFX_PREF_KEY) === '1'; } catch (e) {}
    window.__vfxOff = off;
    let b = document.getElementById('btn-vfx-toggle');
    if (b) {
        b.textContent = off ? '✨ 戰鬥特效：關閉' : '✨ 戰鬥特效：開啟';
        b.className = 'btn text-base w-72 py-2.5 ' + (off
            ? 'bg-rose-900 hover:bg-rose-800 border-rose-700'
            : 'bg-emerald-800 hover:bg-emerald-700 border-emerald-600');
    }
    // 🔢 v3.0.2 傷害數字獨立開關（與「戰鬥特效」互不影響：可全開只關數字）
    let numOff = false;
    try { numOff = localStorage.getItem(_VFX_NUM_PREF_KEY) === '1'; } catch (e) {}
    window.__vfxNumOff = numOff;
    let bn = document.getElementById('btn-vfxnum-toggle');
    if (bn) {
        bn.textContent = numOff ? '🔢 傷害數字：關閉' : '🔢 傷害數字：開啟';
        bn.className = 'btn text-base w-72 py-2.5 ' + (numOff
            ? 'bg-rose-900 hover:bg-rose-800 border-rose-700'
            : 'bg-emerald-800 hover:bg-emerald-700 border-emerald-600');
    }
}
function toggleVfxPref() {
    let off = !window.__vfxOff;
    try { localStorage.setItem(_VFX_PREF_KEY, off ? '1' : '0'); } catch (e) {}
    _applyVfxPref();
}
function toggleVfxNumPref() {   // 🔢 v3.0.2 切換「只關傷害數字」
    let off = !window.__vfxNumOff;
    try { localStorage.setItem(_VFX_NUM_PREF_KEY, off ? '1' : '0'); } catch (e) {}
    _applyVfxPref();
}

// ✨ VFX：包裝 castSkill → 對本次「攻擊魔法」施法中掉血的目標各射一發拋射物（用 HP 差比對，與內部實作無關；僅有屬性、非武器/投擲類技能觸發）
if (typeof castSkill === 'function' && !castSkill._vfxWrapped) {
    let _vfxOrigCastSkill = castSkill;
    castSkill = function (skId) {
        let sk = DB.skills[skId];
        let _pele = (sk && sk.ele && sk.ele !== 'none' && !sk.weaponDmg && !sk.throwAxe) ? sk.ele : (sk ? _VFX_PROJECTILE_SKILLS[skId] : null);   // 屬性攻擊魔法 ＋ 白名單投射技能(光箭/究極光裂/心靈破壞/三重矢/戰斧投擲)
        let proj = !window.__vfxOff && !!_pele;
        let before = null;
        if (proj) { before = mapState.mobs.map(m => (m && !m._dead) ? { uid: m.uid, hp: m.curHp, rect: _vfxSlotRect(m.uid) } : null); }
        let r = _vfxOrigCastSkill(skId);
        if (proj) { try { _vfxCastProjectiles(before, _pele); } catch (e) {} }
        return r;
    };
    castSkill._vfxWrapped = true;
}

// 🎲 怪物視覺散佈：依 uid 決定論偽隨機(FNV-1a)→每隻怪在版位上加位移＋輕微縮放，看起來「隨機出沒」而非整齊前後排。
//    純視覺·不影響戰鬥/目標/特效命中：transform 套在整張 .mob-target 上→點擊熱區與 VFX(getBoundingClientRect) 皆隨之移動。
//    同一隻怪存活期間 uid 不變→位置固定不抖；死亡換新 uid 才換位置(營造隨機出沒)。頭目(boss-slot/boss-zoom)不散佈、維持置中。
function _mobScatter(uid) {
    let h = 2166136261 >>> 0, su = '' + uid;
    for (let i = 0; i < su.length; i++) { h ^= su.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    let a = (h & 1023) / 1023, b = ((h >>> 10) & 1023) / 1023, c = ((h >>> 20) & 1023) / 1023;
    let dx = Math.round((a * 2 - 1) * 60), dy = Math.round((b * 2 - 1) * 34), sc = (0.88 + c * 0.24).toFixed(3);
    return `transform:translate(${dx}px,${dy}px);--jit-scale:${sc};`;
}
function _renderMobsImpl() {
    if(state.ff) return; // 補跑期間不刷新畫面
    _initMobListGuard();
    if(_mobPointerDown) { _mobRebuildPending = true; return; }   // 🚀 按住怪物卡期間延後重繪→點擊切換目標不被中斷
    let _slotHtmls = [], _forceHit = [];   // 🚀 改差異更新：先各格產生 html 字串，最後只重建有變動的格

    let _back = backSlotsActive();                                   // 🆕 五格模式：原三格(前排)＋後排兩格
    let _order = _back ? [0, 1, 2, 3, 4] : [0, 1, 2];                // 🆕 v2.7.47 前排(0,1,2)由左而右→再後排(3,4)由左而右；視覺左右序＝目標鎖定序一致(不再交錯)
    for(let _k = 0; _k < _order.length; _k++) {
        let i = _order[_k];
        let m = mapState.mobs[i];
        let _rowCls = (i >= 3) ? ' mob-back' : (_back ? ' mob-front' : '');   // 後排/前排版位 class（三格模式不加→沿用原版面）
        if (m) {
            let act = (i === mapState.targetIdx) ? 'active' : '';
            let _mi = mobStillImg(m.n, m.img, true);   // 🎬 戰鬥初始幀：有動畫→優先 spawn_0（無 spawn 退 idle_0·再退舊靜態）；無動畫→舊靜態
            let hitClass = '';   // 🚫 v2.7.49 移除 CSS 受擊晃動/亮起特效（只保留 hurt 序列幀 anim；justHit 仍驅動 hurt 觸發與傷害數字）
            _forceHit[_k] = !!m.justHit;   // 🚀 被擊中→即使字串相同也強制重建該格(重播受擊動畫)
            // 🎬 v2.6.94 受擊序列幀（hurt_*.png）：被擊中且該怪有 hurt 動畫→優先播一輪（非鎖定·可蓋掉攻擊/待機·不打斷登場/技能鎖定）。gate 在「確有 hurt 序列」避免無 hurt 的怪被誤清掉進行中的攻擊動作。
            // 🎯 v2.7.30 頭目受擊門檻（用戶要求）：頭目「只有被 重擊(_vfxBig='heavy') 或 爆擊(_vfxBig='crit')」才播 hurt——一般命中不打斷頭目的待機/攻擊/技能動作，維持頭目氣勢；非頭目維持「任何命中都播」。⚠️ _vfxBig 由本幀攻擊設(js/03:818 getPhysicalDmg 樞紐)·須在下一行 _vfxQueueDmg 重設它「之前」判斷。
            if (m.justHit && MOB_ANIM_NAMES.has(m.n) && (!m.boss || m._vfxBig === 'crit' || m._vfxBig === 'heavy')) { let _ha = _mobAnimCache[m.n]; if (_ha && _ha !== 'probing' && _ha.hurt && typeof _mobAnimTrigger === 'function') _mobAnimTrigger(m, 'hurt'); }
            try { _vfxQueueDmg(m); } catch(e){}   // ✨ VFX：用 HP 差捕捉本幀傷害（須在重設 justHit 前）
            m.justHit = false;

            let _badgeTags = '';
            if(_showMobStatus && m.st) {   // 🩹 狀態開關關閉時不顯示異常狀態徽章
                let order = ['freeze','stun','stone','sleep','blind','weaken','disease','vacuum','broken','slow','mrhalf','magicseal','fragile','armorbreak','confuse','panic','guardbreak','terror','doom'];   // 🔮 含脆弱、🔧 破甲(黑妖破壞盔甲)、🔮 混亂/恐慌、🐉 護衛毀滅/恐懼/死神；中毒不顯示、出血改用 🩸 emoji（見下方圖片下方列）
                _badgeTags = order.filter(k => m.st[k] > 0).map(k =>
                    `<span class="px-1 rounded bg-purple-900/70 text-purple-200 text-[10px]">${STATUS_NAME[k]}</span>`).join(' ');
            }
            // 🐉 弱點曝光：以堆疊層數顯示（非 m.st，獨立 m.weakExpose）；🩹 狀態開關關閉時不顯示
            if(_showMobStatus && m.weakExpose > 0) _badgeTags = (_badgeTags ? _badgeTags + ' ' : '') + `<span class="px-1 rounded bg-amber-900/70 text-amber-200 text-[10px] font-bold">弱點${m.weakExpose}</span>`;
            // 🔮 席琳恩賜：名字下方常駐標誌（置於異常狀態列最前，不會被狀態列覆蓋）；🩹 狀態開關關閉時亦隱藏
            if(_showMobStatus && m._grace) _badgeTags = `<span class="px-1 rounded bg-red-950/80 grace-badge text-[10px] font-bold">席琳恩賜</span>` + (_badgeTags ? ' ' + _badgeTags : '');
            // 🔧 頭目標籤：BOSS 名字下方常駐金色「頭目」標籤（置於最前）；🩹 狀態開關關閉時亦隱藏
            if(_showMobStatus && m.boss) _badgeTags = `<span class="px-1 rounded bg-amber-900/80 text-amber-200 text-[10px] font-bold border border-amber-500/60">頭目</span>` + (_badgeTags ? ' ' + _badgeTags : '');
            // 徽章列固定常駐（單行、固定高度），避免有/無狀態時背景框忽大忽小
            let badges = `<div class="flex justify-center gap-0.5 mb-1 overflow-hidden" style="height:18px;">${_badgeTags}</div>`;
            // 🩹 狀態列（出血/猛爆毒/鈍擊/硬皮）：狀態開關關閉時清空內容（保留固定高度列避免版面跳動）
            let _statRow = !_showMobStatus ? '' : `${(m.bleeds && m.bleeds.length) ? `<span class="text-[11px] font-bold" style="display:inline-flex;align-items:center;line-height:1;" title="出血層數">🩸×${m.bleeds.length}</span>` : ''}${(m._burstPoison && m._burstPoison.left > 0) ? `<span class="text-[11px] font-bold" style="display:inline-flex;align-items:center;line-height:1;color:#a3e635;" title="猛爆劇毒：每秒100固定傷害（5秒）">💥毒</span>` : ''}${(m._bluntShow && state.ticks < m._bluntShow) ? `<span class="text-[11px] font-bold text-amber-300" style="display:inline-flex;align-items:center;line-height:1;" title="鈍擊：攻擊延遲中">🔨鈍</span>` : ''}${(m.hardSkin > 0) ? `<span class="text-[11px] font-bold text-stone-300" style="display:inline-flex;align-items:center;line-height:1;" title="硬皮值：額外物理減傷（魔法不減），可用鈍器/重擊消磨">🛡${m.hardSkin}</span>` : ''}`;

            let _hpBar = !_showMobHp ? '' : `<div class="mob-hp-bar flex justify-center mb-1" style="height:6px;"><div style="width:50px;height:5px;background:#475569;border-radius:3px;overflow:hidden;"><div style="height:100%;background:#ef4444;width:${Math.max(0, Math.min(100, Math.round((m.curHp / (m.hp || 1)) * 100)))}%;"></div></div></div>`;
            let _isBossUnit = BOSS_BIG_MAPS.includes(mapState.current) || m.boss;   // 🎲 頭目不散佈(維持置中大圖)
            let _scat = '';   // ⚠️v2.6.39 用戶要求「取消怪物隨機出現」：不再套 _mobScatter(隨機位移+隨機大小 --jit-scale)→整齊前後排站位（_mobScatter 保留但不再呼叫）
            // 🌑 v2.7.17 真實影子 sprite 圖層：本體圖層下疊一層同步影子 img（idle_s_0 為初始貼圖·_mobAnimApply 逐幀同步）；同時隱藏 CSS 橢圓（比照烙印影子）
            let _spriteShadow = MOB_ANIM_NAMES.has(m.n) && (typeof MOB_ANIM_SPRITE_SHADOW !== 'undefined') && MOB_ANIM_SPRITE_SHADOW.has(m.n);
            let _innerAnimCls = MOB_ANIM_NAMES.has(m.n) ? (' mob-anim' + ((MOB_ANIM_BAKED_SHADOW.has(m.n) || _spriteShadow) ? ' mob-anim-shadowed' : '')) : '';
            let _shadowLayer = _spriteShadow ? `<img class="mob-anim-shadow w-24 h-24 p-1 object-contain pointer-events-none" src="assets/anim/${_animDir(m.n)}/idle_s_0.png" alt="" aria-hidden="true" onerror="this.style.display='none'">` : '';
            // ⚔️ v2.7.22 武器揮動特效層(疊本體「前」·screen)：同影子機制·排在本體 img 之後
            let _weaponFx = MOB_ANIM_NAMES.has(m.n) && (typeof MOB_ANIM_WEAPON_FX !== 'undefined') && MOB_ANIM_WEAPON_FX.has(m.n);
            let _weaponLayer = _weaponFx ? `<img class="mob-anim-weapon w-24 h-24 p-1 object-contain pointer-events-none" src="assets/anim/${_animDir(m.n)}/idle_w_0.png" alt="" aria-hidden="true" onerror="this.style.display='none'">` : '';
            // ⚔️ v2.7.40 第二武器層(_w2·如伊弗利特雙武器/雙火焰)：與 _w 同機制·再疊一層 .mob-anim-weapon2
            let _weaponFx2 = MOB_ANIM_NAMES.has(m.n) && (typeof MOB_ANIM_WEAPON_FX2 !== 'undefined') && MOB_ANIM_WEAPON_FX2.has(m.n);
            let _weaponLayer2 = _weaponFx2 ? `<img class="mob-anim-weapon2 w-24 h-24 p-1 object-contain pointer-events-none" src="assets/anim/${_animDir(m.n)}/idle_w2_0.png" alt="" aria-hidden="true" onerror="this.style.display='none'">` : '';
            _slotHtmls[_k] = `<div class="mob-target ${act}${_rowCls}${BOSS_BIG_MAPS.includes(mapState.current) ? ' boss-slot' : (m.boss ? ' boss-zoom' : '')}" data-uid="${m.uid}"${_scat}>
                        <div class="flex justify-center text-sm mb-1 mob-name">
                            <span class="${getMobNameClass(m)}">${m.n}</span>
                        </div>
                        ${badges}
                        <div class="flex justify-center mb-1 mob-img-wrap">
                            <span class="mob-img-inner${_innerAnimCls}">${_shadowLayer}<img src="${_mi.src}" data-fb="${_mi.fb.concat(['https://placehold.co/100x100/1e293b/ffffff?text=?']).join('|')}" alt="${m.n}" onerror="_mobImgErr(this)" class="w-24 h-24 p-1 object-contain pointer-events-none ${hitClass}${m._grace ? ' grace-glow' : ''}">${_weaponLayer}${_weaponLayer2}</span>
                        </div>
                        <div class="flex justify-center items-center gap-2 mb-1" style="height:16px;display:flex;align-items:center;justify-content:center;gap:8px;">${_statRow}</div>
                        ${_hpBar}
                     </div>`;
        } else {
            // 👇 修改這裡：純 BOSS 房除了中央（i === 1）以外，其餘兩格渲染為透明隱形區塊
            // 🔧 怪物尚未出現的空格：不顯示「搜尋中...」與虛線框，渲染為透明隱形區塊（保留版位、不擾亂背景）
            _forceHit[_k] = false;
            _slotHtmls[_k] = `<div class="mob-target${_rowCls} !border-transparent !bg-transparent cursor-default pointer-events-none"></div>`;
        }
    }
    // 🚀 差異更新提交：結構(格數/地圖/頭目大圖模式)不變時，只重建「字串有變或被擊中」的格子；
    //    單體戰鬥下 5 格只重建 1 格（其餘 4 格 DOM/圖片不動）→ 大幅降低 layout/paint 與卡頓。
    let _ml = document.getElementById('mob-list');
    if (_ml) {
        let _structKey = _order.join(',') + '|' + mapState.current + '|' + (BOSS_BIG_MAPS.includes(mapState.current) ? 'B' : '');
        let _c = _mobRenderCache;
        let _wrote = false;
        if (!_c || _c.ml !== _ml || _c.structKey !== _structKey || _c.slots.length !== _slotHtmls.length || _ml.children.length !== _slotHtmls.length) {
            _ml.innerHTML = _slotHtmls.join('');   // 首次/結構改變/節點被換→整列重建
            _mobRenderCache = { ml: _ml, structKey: _structKey, slots: _slotHtmls };   // _slotHtmls 是每幀新建的暫存陣列→直接存、免 slice 複製
            _wrote = true;
        } else {
            let _changed = [];
            for (let k = 0; k < _slotHtmls.length; k++) if (_forceHit[k] || _slotHtmls[k] !== _c.slots[k]) _changed.push(k);
            if (_changed.length) {
                if (_changed.length * 2 > _slotHtmls.length) {
                    _ml.innerHTML = _slotHtmls.join('');                              // 多數格變動→單次整列重建(不比現況差)
                } else {
                    for (const k of _changed) _ml.children[k].outerHTML = _slotHtmls[k];   // 少數格變動→只換該格
                }
                _c.slots = _slotHtmls;
                _wrote = true;
            }
        }
        // 🖱️ name-show（hover 顯名）不再進 diff 字串、改由 _applyHoverName 單一管理→hover 不再觸發整格重建；
        //    但被重建過的格會丟失 hover class，故只在「有寫入 DOM」時重新套用一次（無重建的幀維持原樣、零成本）。
        if (_wrote) _applyHoverName();
        if (_wrote) { try { _mobAnimApply(); } catch(e){} }   // 🎞️ 重建過的格子立即補上當前動畫幀（同一同步工作內→不閃回靜態圖）
    }
    try { _vfxFlush(); } catch(e){}   // ✨ VFX：格子重建後生成飄動傷害數字
}

// ===== 🎞️ 怪物 PNG 序列幀動畫引擎（v2.6.85·v2.6.86 分動作·v2.6.88 登場＋鎖定播放）=====
// 幀檔約定（assets/anim/<怪物名>/·連續編號·缺號即止·各動作至少 2 幀才啟用·各自獨立可缺）：
//   待機 idle：`0.png、1.png…` 或 `idle_0.png…`（優先 idle_ 前綴·裸編號為相容舊約定）→ 循環播放
//   登場 spawn：`spawn_0.png…` → 怪物首次出現在場上時播一輪（🔒 鎖定），播畢回待機
//   攻擊 attack：`attack_0.png…` → 怪物發動一般攻擊(打玩家或傭兵·含連擊技)時播一輪，播畢回待機
//   技能 skill：`skill_0.png…` → 怪物施放技能(castMobMagic)時播一輪（🔒 鎖定），播畢回待機
//   死亡 death：`death_0.png…` → 死亡時在 VFX 殘影上原位播一輪後淡出（取代白閃殘影·怪卡本體照常移除·殘影獨立層必定播完）
// 🔒 鎖定規則（用戶要求）：登場/技能一旦開播「強制放完」——播放期間的新觸發一律忽略（不打斷·也不排隊重播·
//    避免視覺與實際傷害脫節），播畢回待機再接之後的觸發；攻擊為非鎖定（可被新攻擊重播、可被技能即時蓋掉）。
// 原理：待機幀序由「全域時鐘」決定（renderMobs 隨時整格重建也不重置相位）；單次動作 m._animAct={k,t,lock}
//       存在怪物物件上·跨重建存活·播畢自動清除回待機。ticker 只改 img.src（已預載快取·不進 diff 字串
//       →不觸發格子重建、不重播受擊動畫）。
// 效能：8fps interval 掃描場上 ≤5 張卡；分頁背景(document.hidden)自動暫停；探測每怪一次（結果快取）。
const MOB_ANIM_FPS = 8;            // 全域幀率（動作/秒）
const MOB_ANIM_MAX_FRAMES = 60;    // 每動作幀數探測上限（v2.7.10 30→60：林德拜爾 death 35 幀被 30 截斷·探測逐號載到 404 即止→調高對短動畫零額外成本）
let _mobAnimCache = {};            // 怪名 → {idle,spawn,attack,skill,death:各[Image]|null} ｜ 'probing' ｜ null（全無）
// 🎬 有序列幀動畫的怪物名單（單一真相·同步判斷用）：戰鬥/圖鑑靜態顯示點與探測皆據此，避免對 1000+ 無動畫怪發 404。
//    ⚠️ 新增動畫怪：把幀丟進 assets/anim/<怪名>/（跑 spr2png.js）後，把 <怪名> 加進此 Set（一行）。播放幀數由 _mobAnimProbe 自動偵測。
const MOB_ANIM_NAMES = new Set(['長老．巴塔斯', '長老．艾迪爾', '長老．安迪斯', '長老．拉曼斯', '長老．泰瑪斯', '狂暴的歐姆裝甲兵', '重裝歐姆戰士', '血色術士', '長老隨從', '魂騎士', '闇黑君王', '地獄束縛犬', '地元素守護者', '火元素守護者', '血騎士', '拉斯塔巴德近衛隊隊長', '歐姆民兵', '混沌', '死亡', '混沌的司祭(野獸)', '冥法軍王海露拜', '暗殺軍王史雷佛', '混沌的司祭(飛翼)', '墳墓守護者法師', '海賊骷髏首領', '德雷克', '巨大墳墓守護者', '水元素守護者', '風元素守護者', '狂野毒牙', '狂野之毒', '狂野之魔', '高等蜥蜴人', '海賊骷髏士兵', '海賊骷髏刀手', '海賊骷髏', '曼波兔', '重裝蜥蜴人', '狂暴蜥蜴人', '奇異鸚鵡', '藍尾蜥蜴', '墮落', '楊果里恩', '變種楊果里恩', '遺忘之島楊果里恩', '墳墓守護者騎士', '深淵之主', '火焰之魔法師', '污染的地精靈', '墮落的司祭(三階)', '墮落的司祭(四階)', '墮落的司祭(五階)', '魔族暗殺團', '黑暗棲林者', '法令軍王蕾雅', '黑法師', '喚獸師', '魔獸軍王巴蘭卡', '黑暗復仇者', '金屬蜈蚣', '犰狳', '歐姆', '歐姆裝甲兵', '深淵弓箭手', '黑虎', '藏寶箱', '受詛咒的馴獸師', '拉斯塔巴德馴獸師', '馴獸師', '象牙塔惡靈', '遺忘之島多羅', '拉斯塔巴德守門人', '拉斯塔巴德近衛隊', '黑暗妖精警衛(矛)', '黑暗妖精殘兵(十字弓)', '黑暗妖精盜賊', '黑暗妖精警衛(十字弓)', '黑暗妖精殘兵(雙手劍)', '黑暗妖精殘兵(弓)', '黑暗妖精法師', '黑暗妖精士兵', '恐怖的地獄犬', '喬', '闇之精靈', '黑暗精靈使', '魔熊', '冷酷的艾莉絲', '艾莉絲', '邪惡的鐮刀死神', '不死的木乃伊王', '木乃伊王', '闇黑的騎士范德', '騎士范德', '黑暗妖精將軍', '地獄的黑豹', '黑暗妖精巡守', '黑暗妖精殘兵(法師)', '黑暗妖精魔法學徒', '黑暗妖精殘兵(劍)', '殘暴的食屍鬼', '深淵食屍鬼', '食屍鬼', '象牙塔密密', '邪惡密密', '傲慢的潔尼斯女王', '扭曲的潔尼斯女王', '夢幻之島殺人蜂', '闇影格立特', '闇精靈王', '不幸的幻象眼魔', '小幻象眼魔', '夢幻之島鎧甲守衛', '象牙塔炎魔的奴隸', '夢幻之島蘑菇', '恐怖的吸血鬼', '馬昆斯吸血鬼', '獨角獸', '夢幻之島大鬼火', '地靈之主', '深淵地靈', '深淵火靈', '火靈之主', '深淵風靈', '風靈之主', '水靈之主', '深淵水靈', '夢幻之島暴走兔', '夢幻之島鬼火', '夢幻之島閃電球', '象牙塔閃電球', '象牙塔果凍怪', '炎魔的分身', '象牙塔炎魔之影', '梅杜莎', '小惡魔', '炎魔的小惡魔', '象牙塔小惡魔', '死亡之劍', '象牙塔死亡之劍', '不滅的巫妖', '強盜', '古代巨人', '強盜頭目', '骨龍', '奇美拉', '象牙塔奇美拉', '遺忘之島巨大牛人', '殘暴的史巴托', '變形怪首領', '遺忘之島變形怪', '魔狼', '幼龍', '夢魘', '恐怖夢魘', '象牙塔翼魔', '火精靈王', '水精靈王', '土精靈王', '風精靈王', '夢幻之島火精靈王', '夢幻之島水精靈王', '夢幻之島地精靈王', '夢幻之島風精靈王', '火之牙', '風之牙', '水之牙', '地之牙', '冰人', '夢幻之島冰人', '艾爾摩士兵', '受詛咒的艾爾摩士兵', '艾爾摩將軍', '受詛咒的艾爾摩將軍', '鋼鐵高崙', '恐怖的鋼鐵高崙', '象牙塔鋼鐵高崙', '雪怪', '冰之女王', '冰之女王侍女', '冰原老虎', '冷酷冰原老虎', '夢幻之島火炎蛋', '恐怖的火炎蛋', '暗黑火焰弓箭手', '火炎蛋', '火焰弓箭手', '火焰阿西塔基奧', '爆彈花', '阿西塔基奧', '雪人', '龍蠅', '不死鳥', '伊弗利特', '恐怖的伊弗利特', '火焰烈炎獸', '烈炎獸', '暗黑火焰戰士', '火焰戰士', '夢幻之島火蜥蜴', '海星', '火蜥蜴', '熔岩高崙', '鯊魚', '龍龜', '人魚', '伊萊克頓', '奎斯坦修', '希爾黛斯', '活鎧甲', '穴居人', '蛇女', '蟹人', '變種蛇女', '象牙塔活鎧甲', '象牙塔蛇女', '遺忘之島蛇女', '鼠人', '亞力安', '人形殭屍', '侏儒', '侏儒戰士', '依詩蒂', '依詩蒂公主', '克特', '冰原狼人', '冰石高崙', '卡司特', '卡司特王', '卡士柏', '卡瑞', '受詛咒的妖魔殭屍', '史巴托', '哈士奇', '哈柏哥布林', '哈維', '哥布林', '地獄犬', '地靈', '夏洛伯', '多眼怪', '多羅', '夢幻之島冰石高崙', '妖魔', '妖魔巡守', '妖魔弓箭手', '妖魔殭屍', '妖魔法師', '妖魔鬥士', '安塔瑞斯', '安普長老', '密密', '巨人', '巨人戰士', '巨人長老', '巨大兵蟻', '巨大突擊螞蟻', '巨大鱷魚', '巨蟻', '巨蟻女皇', '巫師', '巴列斯', '巴土瑟', '巴拉卡斯', '巴風特', '強化巨蟻', '思克巴', '思克巴女皇', '怪手', '恐怖的殭屍王', '惡魔', '暗黑思克巴女皇', '暗黑萊肯', '暗黑黑騎士', '月之精靈歐薇', '月光朱利安', '朱利安', '杜賓狗', '林德拜爾', '格利芬', '歐吉', '歐熊', '歐薇', '死亡的司祭(巴風特)', '死亡的司祭(思克巴)', '死亡的殭屍王', '死亡騎士', '死神', '殘暴的骷髏斧兵', '殘暴的骷髏槍兵', '殘暴的骷髏神射手', '殘暴的骷髏鬥士', '毒蠍', '污染的安特', '污染的潘', '法利昂', '漂浮之眼', '火焰之影親衛隊(巴風特)', '火焰之靈魂(紅)', '火焰之靈魂(藍)', '炎魔的巴列斯', '炎魔的巴風特', '炎魔的思克巴', '炎魔的思克巴女皇', '炎魔的惡魔', '熊', '牧羊犬', '特羅斯王子', '狼', '狼人', '獨眼巨人', '甘地妖魔', '石頭高崙', '紅鬼魂', '紙人', '羅孚妖魔', '莫妮亞', '萊肯', '蘑菇', '蜥蜴人', '蟑螂人', '西斯', '西瑪', '變形怪', '象牙塔巴列斯之影', '象牙塔巴風特之影', '象牙塔惡魔之影', '象牙塔死神', '象牙塔石頭高崙', '象牙塔紙人', '象牙塔長者', '象牙塔黑長者', '象牙塔黑魔法師', '卡魯塔', '地獄奴隸', '巨大守護螞蟻', '白螞蟻群', '強化白螞蟻群', '巨大白螞蟻', '巨大強化白螞蟻', '冰魔', '底比斯 尖碑石奴', '底比斯 尖碑石奴(黑)', '底比斯 賀洛斯', '底比斯 凱比斯(紅)', '底比斯 凱比斯(黑)', '底比斯 聖甲蟲', '底比斯 聖甲蟲(藍)', '底比斯 巴斯', '底比斯 巴斯(紅)', '底比斯 曼陀羅草', '底比斯 曼陀羅草(白)', '底比斯 阿努比斯', '影魔', '象牙塔影魔', '墮落的司祭(一階)', '墮落的司祭(二階)', '艾爾摩法師', '受詛咒的艾爾摩法師', '狂暴的歐姆', '歐姆戰士', '魔蝙蝠', '墳墓守護者', '哈汀之影', '長老．琪娜', '長老．巴洛斯', '長老．巴陸德', '賽尼斯', '遺忘之島亞力安', '遺忘之島卡司特', '遺忘之島卡司特王', '遺忘之島哈維', '遺忘之島夏洛伯', '遺忘之島巨大鱷魚', '遺忘之島巨斧牛人', '遺忘之島格利芬', '遺忘之島歐熊', '遺忘之島狼人', '遺忘之島獨眼巨人', '遺忘之島萊肯', '遺忘之島蜥蜴人', '遺忘之島邪惡蜥蜴', '遺忘之島鏈鎚牛人', '遺忘之島阿魯巴', '遺忘之島飛龍', '遺忘之島食人妖精', '遺忘之島食人妖精王', '遺忘之島鱷魚', '遺忘之島黑暗精靈', '那魯加妖魔', '邪惡多眼怪', '邪惡蜥蜴', '都達瑪拉妖魔', '鋼鐵阿頓', '長老', '阿吐巴妖魔', '阿頓', '阿魯巴', '飛龍', '食人妖精', '食人妖精王', '馬庫爾', '骷髏', '骷髏弓箭手', '骷髏斧手', '骷髏槍兵', '骷髏神射手', '骷髏警衛', '骷髏鬥士', '鬼魂', '魔女賽尼斯', '魔法師喬', '鱷魚', '黑暗精靈', '黑長者', '黑騎士', '黑騎士搜索隊']);
// 🌑 v2.7.11 影子分流（天堂的影子是「獨立 spr」·抽怪物 spr 多半不含影子）：
//    本 Set＝spr「自帶烙印影子」的動畫怪→維持隱藏遊戲橢圓陰影(免雙重)；不在此 Set 的動畫怪→恢復顯示橢圓接觸陰影(等同天堂客戶端另畫影子)。
//    🏆 v2.7.12 依 list.spr 官方定義修正：條目「沒有 101.shadow() 屬性」＝影子烙印在本體(最老世代低編號精靈 29~57)＝本 Set；有 101.shadow(id)＝影子獨立→不加。
//    像素複驗吻合(烙印組底輪廓近黑36~59%·乾淨組0~14%)。⚠️ 新增動畫怪：查 list.spr 該 gfx 有無 101.shadow()——沒有→加進來；有→不加(自動有橢圓)。
const MOB_ANIM_BAKED_SHADOW = new Set(['食屍鬼', '殘暴的食屍鬼', '深淵食屍鬼', '妖魔', '妖魔弓箭手', '漂浮之眼', '人形殭屍', '長老', '象牙塔長者', '卡魯塔']);   // v2.7.35 狼人/遺忘之島狼人·v2.7.51 變形怪(現有 _s 真影子)→移入 SPRITE_SHADOW·v2.7.64 食屍鬼×3(spr 無 _s·腳下烙印黑影→隱藏橢圓免雙重)
// 🌑 v2.7.17 真實影子 sprite（天堂「獨立影子 spr」·用戶另外抽出 <動作>_s.spr）：本 Set 的動畫怪在本體圖層下再疊一層「同步影子 img」(assets/anim/<怪名>/<動作>_s_N.png)。
//    ⚠️ 影子 spr 必須與本體 spr「一起 spr2png --multi 轉」共用世界錨定畫布→影子 PNG 與本體 PNG 同尺寸、疊放即像素級對齊(連跳躍幀影子留地面都正確)。單獨轉影子會錯位。
//    這些怪同時隱藏遊戲 CSS 橢圓影子(比照 MOB_ANIM_BAKED_SHADOW→加 .mob-anim-shadowed)免雙重。⚠️新增：本體+影子一起重轉部署+加此 Set+(若新怪)加 MOB_ANIM_NAMES。
const MOB_ANIM_SPRITE_SHADOW = new Set(['長老．巴塔斯', '長老．艾迪爾', '長老．安迪斯', '長老．拉曼斯', '長老．泰瑪斯', '狂暴的歐姆裝甲兵', '重裝歐姆戰士', '血色術士', '長老隨從', '魂騎士', '闇黑君王', '地獄束縛犬', '地元素守護者', '火元素守護者', '血騎士', '拉斯塔巴德近衛隊隊長', '歐姆民兵', '混沌', '死亡', '混沌的司祭(野獸)', '冥法軍王海露拜', '暗殺軍王史雷佛', '混沌的司祭(飛翼)', '墳墓守護者法師', '海賊骷髏首領', '德雷克', '巨大墳墓守護者', '水元素守護者', '風元素守護者', '狂野毒牙', '狂野之毒', '狂野之魔', '高等蜥蜴人', '海賊骷髏士兵', '海賊骷髏刀手', '海賊骷髏', '曼波兔', '重裝蜥蜴人', '狂暴蜥蜴人', '奇異鸚鵡', '藍尾蜥蜴', '墮落', '墳墓守護者騎士', '火焰之魔法師', '墮落的司祭(三階)', '墮落的司祭(四階)', '墮落的司祭(五階)', '魔族暗殺團', '黑暗棲林者', '法令軍王蕾雅', '黑法師', '喚獸師', '魔獸軍王巴蘭卡', '黑暗復仇者', '金屬蜈蚣', '犰狳', '歐姆', '歐姆裝甲兵', '深淵弓箭手', '石頭高崙', '象牙塔石頭高崙', '黑虎', '藏寶箱', '受詛咒的馴獸師', '拉斯塔巴德馴獸師', '馴獸師', '遺忘之島多羅', '月之精靈歐薇', '歐薇', '拉斯塔巴德守門人', '拉斯塔巴德近衛隊', '黑暗妖精警衛(矛)', '黑暗妖精殘兵(十字弓)', '黑暗妖精盜賊', '黑暗妖精警衛(十字弓)', '黑暗妖精殘兵(雙手劍)', '黑暗妖精殘兵(弓)', '黑暗妖精法師', '黑暗妖精士兵', '恐怖的地獄犬', '喬', '黑暗精靈使', '魔熊', '特羅斯王子', '依詩蒂公主', '依詩蒂', '冷酷的艾莉絲', '艾莉絲', '阿頓', '鋼鐵阿頓', '邪惡的鐮刀死神', '不死的木乃伊王', '木乃伊王', '闇黑的騎士范德', '騎士范德', '黑暗妖精將軍', '地獄的黑豹', '黑暗妖精巡守', '黑暗妖精殘兵(法師)', '黑暗妖精魔法學徒', '黑暗妖精殘兵(劍)', '象牙塔密密', '邪惡密密', '傲慢的潔尼斯女王', '扭曲的潔尼斯女王', '夢幻之島殺人蜂', '闇影格立特', '不幸的幻象眼魔', '小幻象眼魔', '夢幻之島鎧甲守衛', '象牙塔炎魔的奴隸', '夢幻之島蘑菇', '恐怖的殭屍王', '死亡的殭屍王', '恐怖的吸血鬼', '馬昆斯吸血鬼', '獨角獸', '夢幻之島暴走兔', '象牙塔果凍怪', '林德拜爾', '炎魔的分身', '象牙塔炎魔之影', '梅杜莎', '小惡魔', '炎魔的小惡魔', '象牙塔小惡魔', '死亡之劍', '象牙塔死亡之劍', '不滅的巫妖', '強盜', '古代巨人', '強盜頭目', '骨龍', '奇美拉', '象牙塔奇美拉', '遺忘之島巨大牛人', '變形怪', '哈士奇', '變形怪首領', '遺忘之島變形怪', '魔狼', '幼龍', '夢魘', '恐怖夢魘', '象牙塔翼魔', '冰人', '夢幻之島冰人', '艾爾摩士兵', '受詛咒的艾爾摩士兵', '艾爾摩將軍', '受詛咒的艾爾摩將軍', '鋼鐵高崙', '恐怖的鋼鐵高崙', '象牙塔鋼鐵高崙', '雪怪', '冰之女王', '冰之女王侍女', '冰原老虎', '冷酷冰原老虎', '夢幻之島火炎蛋', '恐怖的火炎蛋', '暗黑火焰弓箭手', '火炎蛋', '火焰弓箭手', '火焰阿西塔基奧', '爆彈花', '阿西塔基奧', '雪人', '龍蠅', '巴拉卡斯', '不死鳥', '伊弗利特', '恐怖的伊弗利特', '火焰烈炎獸', '烈炎獸', '暗黑火焰戰士', '火焰戰士', '夢幻之島火蜥蜴', '海星', '火蜥蜴', '熔岩高崙', '鯊魚', '龍龜', '熊', '人魚', '伊萊克頓', '奎斯坦修', '希爾黛斯', '活鎧甲', '穴居人', '蛇女', '蟹人', '變種蛇女', '象牙塔活鎧甲', '象牙塔蛇女', '遺忘之島蛇女', '鼠人', '法利昂', '蟑螂人', '亞力安', '侏儒戰士', '克特', '冰原狼人', '冰石高崙', '卡司特', '卡司特王', '卡士柏', '卡瑞', '受詛咒的妖魔殭屍', '哈柏哥布林', '哈維', '哥布林', '地獄犬', '地靈', '多眼怪', '多羅', '夢幻之島冰石高崙', '妖魔巡守', '妖魔殭屍', '妖魔法師', '安塔瑞斯', '安普長老', '密密', '巨人', '巨人戰士', '巨人長老', '巨大兵蟻', '巨大突擊螞蟻', '巨大鱷魚', '巨蟻', '巨蟻女皇', '巫師', '巴列斯', '巴土瑟', '巴風特', '強化巨蟻', '思克巴', '思克巴女皇', '怪手', '惡魔', '暗黑思克巴女皇', '暗黑萊肯', '暗黑黑騎士', '月光朱利安', '朱利安', '杜賓狗', '格利芬', '歐吉', '歐熊', '死亡的司祭(巴風特)', '死亡的司祭(思克巴)', '死亡騎士', '死神', '殘暴的骷髏斧兵', '殘暴的骷髏槍兵', '殘暴的骷髏神射手', '殘暴的骷髏鬥士', '毒蠍', '污染的安特', '污染的潘', '火焰之影親衛隊(巴風特)', '火焰之靈魂(紅)', '火焰之靈魂(藍)', '炎魔的巴列斯', '炎魔的巴風特', '炎魔的思克巴', '炎魔的思克巴女皇', '炎魔的惡魔', '牧羊犬', '狼', '狼人', '獨眼巨人', '甘地妖魔', '紅鬼魂', '紙人', '羅孚妖魔', '莫妮亞', '萊肯', '蘑菇', '蜥蜴人', '西斯', '西瑪', '象牙塔巴列斯之影', '象牙塔巴風特之影', '象牙塔惡魔之影', '象牙塔死神', '象牙塔紙人', '象牙塔黑長者', '象牙塔黑魔法師', '地獄奴隸', '巨大守護螞蟻', '白螞蟻群', '強化白螞蟻群', '巨大白螞蟻', '巨大強化白螞蟻', '冰魔', '底比斯 尖碑石奴', '底比斯 尖碑石奴(黑)', '底比斯 賀洛斯', '底比斯 凱比斯(紅)', '底比斯 凱比斯(黑)', '底比斯 聖甲蟲', '底比斯 聖甲蟲(藍)', '底比斯 巴斯', '底比斯 巴斯(紅)', '底比斯 曼陀羅草', '底比斯 曼陀羅草(白)', '底比斯 阿努比斯', '墮落的司祭(一階)', '墮落的司祭(二階)', '艾爾摩法師', '受詛咒的艾爾摩法師', '狂暴的歐姆', '歐姆戰士', '魔蝙蝠', '墳墓守護者', '哈汀之影', '長老．琪娜', '長老．巴洛斯', '長老．巴陸德', '賽尼斯', '遺忘之島亞力安', '遺忘之島卡司特', '遺忘之島卡司特王', '遺忘之島哈維', '遺忘之島巨大鱷魚', '遺忘之島巨斧牛人', '遺忘之島格利芬', '遺忘之島歐熊', '遺忘之島狼人', '遺忘之島獨眼巨人', '遺忘之島萊肯', '遺忘之島蜥蜴人', '遺忘之島邪惡蜥蜴', '遺忘之島鏈鎚牛人', '遺忘之島阿魯巴', '遺忘之島飛龍', '遺忘之島食人妖精', '遺忘之島食人妖精王', '遺忘之島鱷魚', '遺忘之島黑暗精靈', '那魯加妖魔', '邪惡多眼怪', '邪惡蜥蜴', '都達瑪拉妖魔', '阿吐巴妖魔', '阿魯巴', '飛龍', '食人妖精', '食人妖精王', '馬庫爾', '骷髏', '骷髏弓箭手', '骷髏斧手', '骷髏槍兵', '骷髏神射手', '骷髏警衛', '骷髏鬥士', '鬼魂', '魔女賽尼斯', '魔法師喬', '鱷魚', '黑暗精靈', '黑長者', '黑騎士', '黑騎士搜索隊']);
// ⚔️ v2.7.22 武器揮動特效層（<動作>_w.spr·與本體同 --multi 共畫布→逐幀同步·疊在本體「前」）：本 Set 的動畫怪多疊一層 .mob-anim-weapon(screen 加亮·如死亡騎士金色刀光弧·揮動只在特定幀出現·空幀透明)。⚠️新增：本體+_s+_w 一起 --multi 轉。
const MOB_ANIM_WEAPON_FX = new Set(['長老．艾迪爾', '長老．拉曼斯', '血色術士', '長老隨從', '魂騎士', '闇黑君王', '地獄束縛犬', '地元素守護者', '火元素守護者', '血騎士', '混沌', '死亡', '暗殺軍王史雷佛', '德雷克', '巨大墳墓守護者', '風元素守護者', '墳墓守護者騎士', '深淵之主', '深淵風靈', '火靈之主', '水靈之主', '墮落的司祭(四階)', '墮落的司祭(五階)', '魔族暗殺團', '黑暗棲林者', '法令軍王蕾雅', '黑法師', '喚獸師', '魔獸軍王巴蘭卡', '黑虎', '魔熊', '邪惡的鐮刀死神', '不死的木乃伊王', '闇黑的騎士范德', '夢幻之島殺人蜂', '恐怖的吸血鬼', '馬昆斯吸血鬼', '炎魔的分身', '象牙塔炎魔之影', '死亡之劍', '象牙塔死亡之劍', '遺忘之島巨大牛人', '變形怪首領', '夢魘', '恐怖夢魘', '象牙塔翼魔', '鋼鐵高崙', '恐怖的鋼鐵高崙', '象牙塔鋼鐵高崙', '死亡騎士', '卡瑞', '巨蟻女皇', '伊萊克頓', '希爾黛斯', '法利昂', '夢幻之島火蜥蜴', '火蜥蜴', '熔岩高崙', '伊弗利特', '恐怖的伊弗利特', '火焰烈炎獸', '烈炎獸', '暗黑火焰戰士', '火焰戰士', '不死鳥', '暗黑火焰弓箭手', '火焰弓箭手', '火焰阿西塔基奧', '阿西塔基奧', '爆彈花', '龍蠅', '巴拉卡斯', '冰之女王侍女', '底比斯 尖碑石奴', '底比斯 尖碑石奴(黑)', '底比斯 賀洛斯', '底比斯 阿努比斯', '墳墓守護者', '哈汀之影', '長老．琪娜', '長老．巴洛斯', '墮落的司祭(二階)', '惡魔', '炎魔的惡魔', '象牙塔惡魔之影']);   // v3.0.13 冰之女王新版無 _w→移除；底比斯4怪有 _w
// ⚔️ v2.7.40 第二武器層 _w2(於 _w 之上再疊一層·如伊弗利特雙武器)：本 Set 的怪多探 <動作>_w2_N.png·render 加 .mob-anim-weapon2(同 screen)·須同時在 MOB_ANIM_WEAPON_FX(才有 _w)。⚠️新增：本體+_s+_w+_w2 一起 --multi 轉共畫布。
const MOB_ANIM_WEAPON_FX2 = new Set(['德雷克', '夢幻之島殺人蜂', '伊弗利特', '恐怖的伊弗利特', '龍蠅', '冰之女王侍女']);   // ⚠️冰之女王侍女只有 death_w2(死亡爆發第二武器層)·live 恆隱藏·僅死亡殘影用；夢幻之島殺人蜂 idle_w2/attack_w2 live 顯示(第二翅膀層)；v3.0.13 冰之女王新版動畫無 _w2→移除
// 🔥 v2.7.22 技能特效層（怪施放技能(_mobAnimTrigger skill)時觸發·一次性·screen 加亮·_updateMobSkillFx 推進）：改設定物件(怪名→cfg)。
//   cfg 欄位：{ startPfx:必·主序列前綴, endPfx:選·尾序列前綴(有=start播畢接end), h:特效高為怪高倍數, ay:特效內錨點, feet:true=錨在腳底(地面型·如敵人施法火環)否則錨身體中心 }。
//   來源：DK/卡瑞→assets/anim/<怪名>/skill_effect_start/end_N(中心火焰爆發·226×155)；v2.7.23 敵人施法(7怪)→<怪名>/cast_N(腳底火焰環擴散·單序列·189×105 寬扁)。
const MOB_ANIM_SKILL_FX = {
    '死亡騎士':     { startPfx: 'skill_effect_start', endPfx: 'skill_effect_end', h: 1.6, ay: 0.55 },
    '卡瑞':         { startPfx: 'skill_effect_start', endPfx: 'skill_effect_end', h: 1.6, ay: 0.55 },
    '卡士柏':       { startPfx: 'cast', h: 0.45, ay: 0.5, feet: true },   // 🔥 敵人施法：腳底火焰環·單序列
    '巴土瑟':       { startPfx: 'cast', h: 0.45, ay: 0.5, feet: true },
    '馬庫爾':       { startPfx: 'cast', h: 0.45, ay: 0.5, feet: true },
    '黑長者':       { startPfx: 'cast', h: 0.45, ay: 0.5, feet: true },
    '巫師':         { startPfx: 'cast', h: 0.45, ay: 0.5, feet: true },
    '西瑪':         { startPfx: 'cast', h: 0.45, ay: 0.5, feet: true },
    '象牙塔黑長者':  { startPfx: 'cast', h: 0.45, ay: 0.5, feet: true },
    '地獄犬':       { startPfx: 'skill_effect', h: 1.0, ay: 0.5 },   // 🔥 噴火：單序列 skill_effect(自身畫布 72×62·非影子/武器同步層)·身體中心
    // 🌍 v2.7.31 anchored＝「世界格線錨定」模式（像素級精準·零手調）：特效 spr 與本體共用世界格線但「單獨轉檔」（一起 --multi 會把本體畫布撐大→龍上浮），
    //    由兩份 meta 的 latticeOrigin 換算特效畫布在本體畫布內的精確偏移 (ox,oy)＝(本體ox−特效ox, 本體oy−特效oy)；bw/bh＝本體畫布尺寸（算縮放用）。
    //    渲染：特效疊在本體 img rect + 偏移×縮放（.mob-anim 原生尺寸縮放=1·boss-zoom 等 transform 由 rect/bw 自動吸收）·幀與 skill 動作同鐘同步。
    '安塔瑞斯':     { startPfx: 'skill_effect', anchored: { ox: 161, oy: 135, bw: 425, bh: 307 }, delayF: 8, endHoldF: 2 },   // 🐉 火焰吐息：276×221·本體畫布425×307 origin(188,221)·特效origin(27,86)→偏移(161,135)·delayF8＝張嘴幀(f8 頭壓低)即起噴(v2.7.34 用戶「晚了點」10→8)·endHoldF2＝尾幀定格2幀→吐息跨幀8~18·本體17幀(f16)結束後尾雲再延續2幀
    // 🌍 v2.7.35 批次 anchored 技能特效(18隻·spr彙整 skill_effect 與本體共世界格線·offset 由 meta latticeOrigin 差自動算·delayF 未調＝與 skill 動作同起播·日後可個別加 delayF/endHoldF 微調時序)：
    '亞力安':       { startPfx: 'skill_effect', anchored: { ox: 44, oy: 31, bw: 134, bh: 114 } },
    '遺忘之島亞力安': { startPfx: 'skill_effect', anchored: { ox: 44, oy: 31, bw: 134, bh: 114 } },
    '安普長老':     { startPfx: 'skill_effect', anchored: { ox: -13, oy: 25, bw: 66, bh: 46 } },
    '思克巴':       { startPfx: 'skill_effect', anchored: { ox: -42, oy: -51, bw: 89, bh: 98 } },
    '思克巴女皇':    { startPfx: 'skill_effect', anchored: { ox: -42, oy: -51, bw: 89, bh: 98 } },
    '暗黑思克巴女皇':  { startPfx: 'skill_effect', anchored: { ox: -42, oy: -51, bw: 89, bh: 98 } },
    '死亡的司祭(思克巴)': { startPfx: 'skill_effect', anchored: { ox: -42, oy: -51, bw: 89, bh: 98 } },
    '炎魔的思克巴':   { startPfx: 'skill_effect', anchored: { ox: -42, oy: -51, bw: 89, bh: 98 } },
    '炎魔的思克巴女皇': { startPfx: 'skill_effect', anchored: { ox: -42, oy: -51, bw: 89, bh: 98 } },
    '惡魔':         { startPfx: 'skill_effect', anchored: { ox: -106, oy: -99, bw: 157, bh: 149 } },
    '炎魔的惡魔':     { startPfx: 'skill_effect', anchored: { ox: -106, oy: -99, bw: 157, bh: 149 } },
    '象牙塔惡魔之影':  { startPfx: 'skill_effect', anchored: { ox: -106, oy: -99, bw: 157, bh: 149 } },
    '邪惡蜥蜴':     { startPfx: 'skill_effect', anchored: { ox: 68, oy: -40, bw: 186, bh: 123 } },
    '遺忘之島邪惡蜥蜴': { startPfx: 'skill_effect', anchored: { ox: 68, oy: -40, bw: 186, bh: 123 } },
    '飛龍':         { startPfx: 'skill_effect', anchored: { ox: -179, oy: -2, bw: 370, bh: 307 } },
    '遺忘之島飛龍':   { startPfx: 'skill_effect', anchored: { ox: -179, oy: -2, bw: 370, bh: 307 } },
    '黑暗精靈':     { startPfx: 'skill_effect', anchored: { ox: -45, oy: 30, bw: 56, bh: 85 } },
    '遺忘之島黑暗精靈': { startPfx: 'skill_effect', anchored: { ox: -45, oy: 30, bw: 56, bh: 85 } },
    '黑法師':       { startPfx: 'skill_effect', anchored: { ox: 39, oy: 50, bw: 97, bh: 130 } },   // v2.7.77 黑法師施法特效(3幀·offset 由 meta latticeOrigin 差自動算·本體畫布97×130)
    // 🌍 v2.7.38 新增 anchored 技能特效(offset 由 spr彙整 meta latticeOrigin 差自動算)：
    '伊萊克頓':     { startPfx: 'skill_effect', anchored: { ox: 27, oy: -13, bw: 217, bh: 150 } },
    '希爾黛斯':     { startPfx: 'skill_effect', anchored: { ox: 184, oy: 159, bw: 399, bh: 300 } },
    '法利昂':       { startPfx: 'skill_effect', anchored: { ox: 39, oy: 129, bw: 375, bh: 249 } },
    // 🔥 v2.7.40 火焰系新怪 anchored 技能特效：
    '伊弗利特':     { startPfx: 'skill_effect', anchored: { ox: 19, oy: 77, bw: 135, bh: 203 } },
    '恐怖的伊弗利特': { startPfx: 'skill_effect', anchored: { ox: 19, oy: 77, bw: 135, bh: 203 } },
    '火焰烈炎獸':   { startPfx: 'skill_effect', anchored: { ox: 59, oy: 31, bw: 133, bh: 124 } },
    '烈炎獸':       { startPfx: 'skill_effect', anchored: { ox: 59, oy: 31, bw: 133, bh: 124 } },
    // 🔥 v2.7.41 不死鳥雙特效層(skill_effect + skill_effect2 同畫布 --multi·同一 anchored 偏移·兩層同步播)：
    '不死鳥':       { startPfx: 'skill_effect', startPfx2: 'skill_effect2', anchored: { ox: 252, oy: 8, bw: 640, bh: 477 } },
    // 🐉 v2.7.44 巴拉卡斯(v2.7.10 部署時只有 body·用戶補全套影子/武器/技能特效)：
    '巴拉卡斯':     { startPfx: 'skill_effect', anchored: { ox: 286, oy: 189, bw: 578, bh: 407 } },
    // 🐍 v2.7.57 梅杜莎/小惡魔三兄弟/不滅的巫妖 anchored 技能特效：
    '梅杜莎':       { startPfx: 'skill_effect', anchored: { ox: 18, oy: -10, bw: 101, bh: 71 } },
    '小惡魔':       { startPfx: 'skill_effect', anchored: { ox: 7, oy: -5, bw: 81, bh: 114 } },
    '炎魔的小惡魔':   { startPfx: 'skill_effect', anchored: { ox: 7, oy: -5, bw: 81, bh: 114 } },
    '象牙塔小惡魔':   { startPfx: 'skill_effect', anchored: { ox: 7, oy: -5, bw: 81, bh: 114 } },
    '不滅的巫妖':     { startPfx: 'skill_effect', anchored: { ox: 1, oy: -9, bw: 173, bh: 212 } },
    // ⚡ v2.7.58 林德拜爾 電擊蓄能(3幀 44×66·frame0-2 低頭收攏時吻部光球→抬頭嘶吼=放電·視覺比對確認 delayF:0 正確·勿加 delay 否則錯位到胸口)：
    '林德拜爾':     { startPfx: 'skill_effect', anchored: { ox: 226, oy: 338, bw: 441, bh: 497 } },
    // 💧 v2.7.59 水靈之主/深淵水靈 anchored 技能特效（body 亦 luma-alpha 發光型）：
    '水靈之主':     { startPfx: 'skill_effect', anchored: { ox: 184, oy: 159, bw: 399, bh: 256 } },   // v2.7.78 重匯 spr 更新畫布(163×156→399×256)＋重算 offset
    '深淵水靈':     { startPfx: 'skill_effect', anchored: { ox: 43, oy: 76, bw: 163, bh: 156 } },
    '深淵之主':     { startPfx: 'skill_effect', anchored: { ox: -120, oy: -98, bw: 142, bh: 149 } },   // v2.7.78 新怪·深淵 boss 施法特效(19幀·luma-alpha·本體畫布142×149)
    '高等蜥蜴人':   { startPfx: 'skill_effect', anchored: { ox: 21, oy: 3, bw: 87, bh: 101 } },   // v2.7.80 新怪(12幀)
    '曼波兔':       { startPfx: 'skill_effect', anchored: { ox: -93, oy: 20, bw: 74, bh: 134 } },   // v2.7.80 新怪(9幀)
    '墮落':         { startPfx: 'skill_effect', anchored: { ox: 50, oy: -30, bw: 221, bh: 283 } },   // v2.7.80 新怪(12幀)
    '德雷克':       { startPfx: 'skill_effect', anchored: { ox: 25, oy: 23, bw: 167, bh: 158 } },   // v2.7.81 新怪(28幀·另有 attack_w2 第二武器層)
    '血色術士':     { startPfx: 'skill_effect', anchored: { ox: 70, oy: 108, bw: 163, bh: 214 } },   // v2.7.84 新怪(5幀)
    '長老．艾迪爾':  { startPfx: 'skill_effect', anchored: { ox: 71, oy: 34, bw: 135, bh: 131 } },   // v2.7.85 新怪(3幀)
    '闇黑君王':     { startPfx: 'skill_effect', anchored: { ox: -19, oy: 19, bw: 156, bh: 203 } },   // v2.7.84 新怪(8幀)
    '死亡':         { startPfx: 'skill_effect', anchored: { ox: 3, oy: -36, bw: 153, bh: 122 } },   // v2.7.82 新怪(4幀·attack_w only)
    '冥法軍王海露拜': { startPfx: 'skill_effect', anchored: { ox: -17, oy: 3, bw: 115, bh: 117 } },   // v2.7.82 新怪(6幀)
    // 🧛 v2.7.60 恐怖的吸血鬼/馬昆斯吸血鬼 anchored 技能特效（另有 skill_w 揮動層·live idle_w 404 隱藏·僅 skill 動作出現）：
    '恐怖的吸血鬼': { startPfx: 'skill_effect', anchored: { ox: -40, oy: -39, bw: 74, bh: 92 } },
    '馬昆斯吸血鬼': { startPfx: 'skill_effect', anchored: { ox: -40, oy: -39, bw: 74, bh: 92 } },
    // 👁 v2.7.61 幻象眼魔 boss/小幻象眼魔 幻象光線 anchored(skill_effect 11幀·與 skill 動作同步)：
    '不幸的幻象眼魔': { startPfx: 'skill_effect', anchored: { ox: -24, oy: -31, bw: 172, bh: 246 } },
    '小幻象眼魔':   { startPfx: 'skill_effect', anchored: { ox: -24, oy: -31, bw: 172, bh: 246 } },
    // 🕷 v2.7.62 傲慢的潔尼斯女王/扭曲的潔尼斯女王(boss) 劇毒 anchored(skill_effect 3幀·同底圖蜘蛛惡魔·源 spr huet→hurt 修正)：
    '傲慢的潔尼斯女王': { startPfx: 'skill_effect', anchored: { ox: -58, oy: -30, bw: 128, bh: 116 } },   // v2.7.65 用戶更新 skill/skill_effect/skill_s(effect 3→12幀·重算錨點)
    '扭曲的潔尼斯女王': { startPfx: 'skill_effect', anchored: { ox: 45, oy: 36, bw: 128, bh: 118 } },
    // 🧝 v2.7.70 黑暗精靈使 anchored(skill_effect 10幀·body 54×83)：
    '黑暗精靈使': { startPfx: 'skill_effect', anchored: { ox: 11, oy: -28, bw: 54, bh: 83 } },
    // 🧝🐕 v2.7.72 黑暗妖精法師/恐怖的地獄犬 anchored skill_effect：
    '黑暗妖精法師': { startPfx: 'skill_effect', anchored: { ox: 22, oy: -22, bw: 78, bh: 133 } },
    '恐怖的地獄犬': { startPfx: 'skill_effect', anchored: { ox: -37, oy: 28, bw: 69, bh: 65 } },
    // 🧙 v2.7.88 新怪 anchored skill_effect（offset 由 spr彙整 body/effect meta latticeOrigin 差自動算）：
    '哈汀之影':     { startPfx: 'skill_effect', anchored: { ox: 21, oy: 75, bw: 100, bh: 183 } },   // 象牙塔 Lv60 施法(黑魔法力場·effect 3幀)
    '長老．琪娜':   { startPfx: 'skill_effect', anchored: { ox: 71, oy: -4, bw: 186, bh: 185 } },   // 長老 boss Lv78(effect 5幀)
    '長老．巴洛斯': { startPfx: 'skill_effect', anchored: { ox: -19, oy: -14, bw: 178, bh: 141 } }, // 長老 boss Lv88(effect 7幀·僅 skill_w 武器層)
    '長老．巴陸德': { startPfx: 'skill_effect', anchored: { ox: 26, oy: 87, bw: 130, bh: 220 } },   // 長老 boss Lv96(effect 5幀·無 _w)
    // 🧊 v3.0.13 新版真彩 spr 三隻特效怪（effects 與本體分開轉·--luma-alpha·anchored=兩 meta latticeOrigin 差）：
    '冰之女王':       { startPfx: 'skill_effect', endPfx: 'skill_effect2', anchored: { ox: -48, oy: 50, bw: 165, bh: 162 } },   // 冰雪暴施法：8幀起手→21幀冰暴(序列·共29幀)·eff 238x145
    '底比斯 賀洛斯':   { startPfx: 'skill_effect', anchored: { ox: 16, oy: -41, bw: 221, bh: 174 } },   // 火焰放射：16幀火焰爆發·eff 251x244
    '底比斯 阿努比斯': { startPfx: 'skill_effect1', startPfx2: 'skill_effect2', startPfx3: 'skill_effect3', anchored: { ox: -67, oy: -152, bw: 97, bh: 189 } },   // 震裂踏擊：12/11/11幀三層同時(v3.0.13 引擎新增第三層)·eff 207x368
};
// 怪物「靜態顯示圖」候選：有動畫→戰鬥優先 spawn_0、圖鑑優先 idle_0，退回舊靜態 PNG；無動畫→直接舊靜態。回傳 {src, fb:[後備...]}（fb 走 onerror 逐張退·各呼叫點自行在末端補佔位符）。
function mobStillImg(name, staticUrl, preferSpawn) {
    let base = staticUrl || `assets/icons/monsters/${name}.png`;
    if (!MOB_ANIM_NAMES.has(name)) return { src: base, fb: [] };
    let dir = _animDir(name);   // 🔗 v3.0.7 共用怪→幀 URL 走目標資料夾
    let list = [];
    if (preferSpawn) {
        let _c = (typeof _mobAnimCache !== 'undefined') ? _mobAnimCache[name] : undefined;
        // 🎬 v2.6.93 已探測且確定「無登場動畫」(如哥布林只有 idle/attack/death)→不放 spawn_0，免每次渲染固定 404；未探測/探測中仍嘗試(首見一次無害)。
        if (!(_c && _c !== 'probing' && (!_c.spawn || !_c.spawn.length))) list.push(`assets/anim/${dir}/spawn_0.png`);
    }
    list.push(`assets/anim/${dir}/idle_0.png`, base);
    return { src: list[0], fb: list.slice(1) };
}
// 通用 img onerror：依 data-fb（|分隔清單）逐張退回，用盡則停。
function _mobImgErr(img) {
    try {
        let fb = (img.getAttribute('data-fb') || '').split('|').filter(Boolean);
        if (fb.length) { img.setAttribute('data-fb', fb.slice(1).join('|')); img.src = fb[0]; }
        else { img.onerror = null; }
    } catch (e) { img.onerror = null; }
}
// 🔗 v3.0.7 動畫資料夾共用(alias)：自身無可用 spr 的怪→借用另一隻已部署怪的 assets/anim/<目標>/ 幀(URL 層 redirect·_mobAnimCache 仍以自身名為 key)。
//   ⚠️ 目標怪須已部署且在 MOB_ANIM_NAMES；共用怪自身也要加進 MOB_ANIM_NAMES(+SPRITE_SHADOW 若目標有 _s)。目標更新→共用怪自動跟著(真共用非複製)。
const MOB_ANIM_ALIAS = {};   // 🔗 動畫資料夾共用 alias(名→目標名)·目前無條目(強化白螞蟻群 v3.0.10 已重匯 0xFF 自身幀→移除 alias·改讀自己的資料夾)
function _animDir(name) { return (typeof MOB_ANIM_ALIAS !== 'undefined' && MOB_ANIM_ALIAS[name]) ? MOB_ANIM_ALIAS[name] : name; }
function _mobAnimProbe(name) {
    if (_mobAnimCache[name] !== undefined) return;
    _mobAnimCache[name] = 'probing';
    let animName = _animDir(name);   // 🔗 共用怪：本體/影子/武器幀 URL 走目標資料夾(cache 仍 keyed by name)
    let hasShadow = (typeof MOB_ANIM_SPRITE_SHADOW !== 'undefined') && MOB_ANIM_SPRITE_SHADOW.has(name);   // 🌑 真實影子 sprite→額外探測 <動作>_s_N.png
    let hasWeapon = (typeof MOB_ANIM_WEAPON_FX !== 'undefined') && MOB_ANIM_WEAPON_FX.has(name);           // ⚔️ 武器揮動特效→額外探測 <動作>_w_N.png
    let hasWeapon2 = (typeof MOB_ANIM_WEAPON_FX2 !== 'undefined') && MOB_ANIM_WEAPON_FX2.has(name);        // ⚔️ v2.7.40 第二武器層→額外探測 <動作>_w2_N.png
    let skfCfg = (typeof MOB_ANIM_SKILL_FX !== 'undefined') ? MOB_ANIM_SKILL_FX[name] : null;               // 🔥 技能特效 cfg(怪名→{startPfx,endPfx?,h,ay,feet?})
    let hasSkillFx = !!skfCfg;
    let out = { idle: null, spawn: null, attack: null, skill: null, hurt: null, death: null };
    if (hasShadow) out.shadow = { idle: null, spawn: null, attack: null, skill: null, hurt: null, death: null };
    if (hasWeapon) out.weapon = { idle: null, spawn: null, attack: null, skill: null, hurt: null, death: null };
    if (hasWeapon2) out.weapon2 = { idle: null, spawn: null, attack: null, skill: null, hurt: null, death: null };
    if (hasSkillFx) out.skillFx = { start: null, end: null };
    let pending = 6 + (hasShadow ? 6 : 0) + (hasWeapon ? 6 : 0) + (hasWeapon2 ? 6 : 0) + (hasSkillFx ? (1 + (skfCfg.endPfx ? 1 : 0) + (skfCfg.startPfx2 ? 1 : 0) + (skfCfg.startPfx3 ? 1 : 0)) : 0);
    let finish = () => { if (--pending > 0) return; _mobAnimCache[name] = (out.idle || out.spawn || out.attack || out.skill || out.hurt || out.death) ? out : null; };
    let probeSeq = (target, key, prefixes, minF) => {   // 依前綴逐號載入到缺號為止；idle 先試 idle_ 再退裸編號。minF=最少幀數(受擊 hurt 允許 1 幀)
        let frames = [], pi = 0, _min = minF || 2;
        let done = () => { target[key] = frames.length >= _min ? frames : null; finish(); };
        let tryLoad = (i) => {
            if (i >= MOB_ANIM_MAX_FRAMES) { done(); return; }
            let im = new Image();
            im.onload = () => { frames.push(im); tryLoad(i + 1); };
            im.onerror = () => { if (i === 0 && pi + 1 < prefixes.length) { pi++; tryLoad(0); } else done(); };
            im.src = `assets/anim/${animName}/${prefixes[pi]}${i}.png`;
        };
        tryLoad(0);
    };
    probeSeq(out, 'idle', ['idle_', '']);
    probeSeq(out, 'spawn', ['spawn_']);
    probeSeq(out, 'attack', ['attack_']);
    probeSeq(out, 'skill', ['skill_']);
    probeSeq(out, 'hurt', ['hurt_'], 1);   // 🎬 v2.6.94 受擊動畫（通常 1~2 幀→允許單幀；被擊中優先播放一輪回待機）
    probeSeq(out, 'death', ['death_']);
    if (hasShadow) {   // 🌑 影子層各動作序列（幀數與本體對應動作相同→_mobAnimApply 用同一幀索引同步）
        probeSeq(out.shadow, 'idle', ['idle_s_']);
        probeSeq(out.shadow, 'spawn', ['spawn_s_']);
        probeSeq(out.shadow, 'attack', ['attack_s_']);
        probeSeq(out.shadow, 'skill', ['skill_s_']);
        probeSeq(out.shadow, 'hurt', ['hurt_s_'], 1);
        probeSeq(out.shadow, 'death', ['death_s_']);
    }
    if (hasWeapon) {   // ⚔️ 武器揮動特效層各動作序列（同幀索引·允許單幀·揮動空幀本就透明）
        probeSeq(out.weapon, 'idle', ['idle_w_'], 1);
        probeSeq(out.weapon, 'spawn', ['spawn_w_'], 1);
        probeSeq(out.weapon, 'attack', ['attack_w_'], 1);
        probeSeq(out.weapon, 'skill', ['skill_w_'], 1);
        probeSeq(out.weapon, 'hurt', ['hurt_w_'], 1);
        probeSeq(out.weapon, 'death', ['death_w_'], 1);
    }
    if (hasWeapon2) {   // ⚔️ v2.7.40 第二武器層各動作序列(同 _w 機制·前綴 _w2_)
        probeSeq(out.weapon2, 'idle', ['idle_w2_'], 1);
        probeSeq(out.weapon2, 'spawn', ['spawn_w2_'], 1);
        probeSeq(out.weapon2, 'attack', ['attack_w2_'], 1);
        probeSeq(out.weapon2, 'skill', ['skill_w2_'], 1);
        probeSeq(out.weapon2, 'hurt', ['hurt_w2_'], 1);
        probeSeq(out.weapon2, 'death', ['death_w2_'], 1);
    }
    if (hasSkillFx) {   // 🔥 技能特效：主序列 startPfx(允許單幀·敵人施法 cast)＋選配 endPfx(DK/卡瑞 skill_effect_end 單幀)
        probeSeq(out.skillFx, 'start', [skfCfg.startPfx + '_'], 1);
        if (skfCfg.endPfx) probeSeq(out.skillFx, 'end', [skfCfg.endPfx + '_'], 1);
        if (skfCfg.startPfx2) probeSeq(out.skillFx, 'start2', [skfCfg.startPfx2 + '_'], 1);   // 🔥 v2.7.41 第二特效層(不死鳥 skill_effect2·與 start 同畫布同錨定·同步播)
        if (skfCfg.startPfx3) probeSeq(out.skillFx, 'start3', [skfCfg.startPfx3 + '_'], 1);   // 🔥 v3.0.13 第三特效層(阿努比斯 skill_effect3)
    }
}
// 🎬 觸發單次動作（js/04 攻擊/技能掛點呼叫）：鎖定動作（登場/技能）播放中→忽略新觸發（強制放完）
function _mobAnimTrigger(m, k) {
    if (!m) return;
    let cur = m._animAct;
    if (cur && cur.lock) {   // 鎖定動作播放中？（以快取序列長度判斷是否還沒播完）
        let a = _mobAnimCache[m.n];
        let seq = (a && a !== 'probing') ? a[cur.k] : null;
        if (seq && (Date.now() - cur.t) < seq.length * (1000 / MOB_ANIM_FPS)) return;   // 還在播→不打斷、不排隊
    }
    m._animAct = { k: k, t: Date.now(), lock: (k === 'spawn' || k === 'skill') };
    if (k === 'skill' && (typeof MOB_ANIM_SKILL_FX !== 'undefined') && MOB_ANIM_SKILL_FX[m.n]) {   // 🔥 技能觸發同時登記技能特效(start→end·_updateMobSkillFx 推進)
        if (_mobSkillFx[m.uid] && _mobSkillFx[m.uid].el) _mobSkillFx[m.uid].el.remove();
        if (_mobSkillFx[m.uid] && _mobSkillFx[m.uid].el2) _mobSkillFx[m.uid].el2.remove();   // 🔥 v2.7.41 重觸發也移除第二特效層(不死鳥)·防 DOM 洩漏(審查發現的第4個 cleanup 點)
        _mobSkillFx[m.uid] = { t0: Date.now(), el: null };
    }
}
function _mobAnimApply() {
    let ml = document.getElementById('mob-list'); if (!ml) return;
    if (typeof mapState === 'undefined' || !mapState.mobs) return;
    let cards = ml.querySelectorAll('.mob-target[data-uid]');
    for (let c of cards) {
        let uid = c.getAttribute('data-uid');
        let m = mapState.mobs.find(x => x && String(x.uid) === String(uid));
        if (!m) continue;
        if (!MOB_ANIM_NAMES.has(m.n)) continue;   // 🎬 非動畫名單→維持靜態圖·不探測（免對 1000+ 無動畫怪發 404）
        let a = _mobAnimCache[m.n];
        if (a === undefined) { _mobAnimProbe(m.n); continue; }   // 首次遇到→背景探測幀檔（探測完成前維持靜態圖）
        if (!a || a === 'probing') continue;
        if (!m._animSpawned) { m._animSpawned = true; if (a.spawn) _mobAnimTrigger(m, 'spawn'); }   // 🎬 登場：該怪物物件首次被動畫系統看到→播登場一輪（每隻一次）
        let img = c.querySelector('.mob-img-wrap .mob-img-inner img:not(.mob-anim-shadow):not(.mob-anim-weapon):not(.mob-anim-weapon2)') || c.querySelector('.mob-img-wrap img:not(.mob-anim-shadow):not(.mob-anim-weapon):not(.mob-anim-weapon2)'); if (!img) continue;
        let _act = null, _f = 0;   // 🌑 先決定「動作＋幀索引」，本體與影子共用→逐幀同步
        if (m._animAct) {   // 🎬 單次動作（登場/攻擊/技能/受擊）：自觸發時刻起逐幀播一輪，播畢清除回待機
            let _ak = m._animAct.k;
            let seq = a[_ak];
            if (!seq && _ak === 'skill' && a.attack) { _ak = 'attack'; seq = a.attack; }   // 🎞️ v2.7.50 怪施放技能但無 skill_*.png 幀→改播 attack_*.png（_act 一併改 attack→影子/武器層同步；skill_effect 疊層仍由 _mobAnimTrigger 以原技能意圖登記，不受影響）
            if (seq) {
                let ff = Math.floor((Date.now() - m._animAct.t) / (1000 / MOB_ANIM_FPS));
                if (ff < seq.length) { _act = _ak; _f = ff; } else m._animAct = null;
            } else m._animAct = null;   // 該動作無序列（且無 attack 後備）→直接清（維持待機）
        }
        if (_act === null && a.idle) {
            let _ofs = 0; { let s = String(uid); for (let j = 0; j < s.length; j++) _ofs += s.charCodeAt(j); }   // 同名多隻→依 uid 錯開相位
            _act = 'idle'; _f = (Math.floor(Date.now() / (1000 / MOB_ANIM_FPS)) + _ofs) % a.idle.length;
        }
        if (_act !== null) {
            let _bseq = a[_act];
            if (_bseq && _bseq[_f] && img.src !== _bseq[_f].src) img.src = _bseq[_f].src;
            if (a.shadow) {   // 🌑 真實影子層：同動作同幀（缺該動作退 idle·幀數不足取模）→與本體像素級同步
                let _simg = c.querySelector('.mob-anim-shadow');
                if (_simg) { let _sseq = a.shadow[_act];   // 🌑 v2.7.41 該動作無影子→隱藏(不再退 idle)：不死鳥 death 無 death_s→死亡無影子(用戶要求·全 164 影子怪僅此一例不對稱)
                    if (_sseq && _sseq.length) { if (_simg.style.visibility === 'hidden') _simg.style.visibility = ''; let _sf = _f < _sseq.length ? _f : (_f % _sseq.length); if (_simg.src !== _sseq[_sf].src) _simg.src = _sseq[_sf].src; }
                    else if (_simg.style.visibility !== 'hidden') _simg.style.visibility = 'hidden'; }
            }
            if (a.weapon) {   // ⚔️ 武器揮動特效層：v2.7.36 嚴格「直接對照本動作本幀」(_w 與本體動作 1:1 逐幀對照·不退 idle·不取模)；本動作或本幀無 _w→隱藏(不殘留上一動作的舊武器幀)
                let _wimg = c.querySelector('.mob-anim-weapon');
                if (_wimg) {
                    let _wseq = a.weapon[_act];
                    if (_wseq && _wseq[_f]) { if (_wimg.style.visibility === 'hidden') _wimg.style.visibility = ''; if (_wimg.src !== _wseq[_f].src) _wimg.src = _wseq[_f].src; }
                    else if (_wimg.style.visibility !== 'hidden') _wimg.style.visibility = 'hidden';
                }
            }
            if (a.weapon2) {   // ⚔️ v2.7.40 第二武器層：同 _w 嚴格 1:1 逐幀對照
                let _w2img = c.querySelector('.mob-anim-weapon2');
                if (_w2img) {
                    let _w2seq = a.weapon2[_act];
                    if (_w2seq && _w2seq[_f]) { if (_w2img.style.visibility === 'hidden') _w2img.style.visibility = ''; if (_w2img.src !== _w2seq[_f].src) _w2img.src = _w2seq[_f].src; }
                    else if (_w2img.style.visibility !== 'hidden') _w2img.style.visibility = 'hidden';
                }
            }
        }
    }
}
setInterval(() => { if (!document.hidden) { try { _mobAnimApply(); } catch (e) {} try { _updateFreezeFx(); } catch (e) {} try { _updateMobSkillFx(); } catch (e) {} } }, Math.floor(1000 / MOB_ANIM_FPS));

// 🚀 效能：分頁面板重繪保護＋節流。狩獵時扣箭/耗肉/掉寶會每 tick 觸發 renderTabs 重建整個面板，
//    重建會洗掉按鈕→在 mousedown↔mouseup 間重建使「賣出/強化」點擊失效並造成卡頓。