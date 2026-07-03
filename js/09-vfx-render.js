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
// 由 _renderMobsImpl 迴圈呼叫（讀 m.justHit 前）：用 HP 差捕捉本幀傷害，免改 50+ 個傷害落點
function _vfxQueueDmg(m) {
    if (window.__vfxOff || !m) { if (m) m._vfxBig = false; return; }
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
    if (window.__vfxOff) { _vfxPending = []; return; }
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
            if (layer.childElementCount < 80) _vfxImpact(cx, cy, it.p.ele, it.p.big);
        }
    }
    _vfxPending = [];
}
function _vfxNumber(x, y, dmg, ele, big) {
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
    let fallback = { vc: 0.66, hc: 0.5 };
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
        let res = { vc: (minY + maxY) / 2 / ch, hc: (minX + maxX) / 2 / cw };
        _mobAnchorCache[key] = res;
        return res;
    } catch (e) { return fallback; }
}

// 擊殺粒子爆裂：在 killMob 標記死亡後、重繪前呼叫（此時格子 DOM 仍在）
function vfxKill(mob) {
    try {
        if (window.__vfxOff || !mob) return;
        let ml = document.getElementById('mob-list');
        let slot = ml && ml.querySelector('.mob-target[data-uid="' + mob.uid + '"]');
        if (!slot) return;
        let box = slot.querySelector('.mob-img-inner') || slot.querySelector('.mob-img-wrap') || slot;   // 🎯 v2.6.41 VFX 錨定「圖層 .mob-img-inner」(帶 translateY/scale·getBoundingClientRect 反映實際位置) 而非「容器 .mob-img-wrap」→修 v2.6.39 單排景深(後排上移30px/前排放大1.55)後 死亡殘影/擊殺特效/傷害數字 錯位
        let r = box.getBoundingClientRect();
        if (r.width === 0) return;
        let _anc = _mobImgAnchor(box.querySelector('img'));   // 🎯 v2.6.45 錨到怪物實體視覺中心(非方框中心)→爆裂/數字落在怪身上
        let bcx = r.left + r.width / 2, bcy = r.top + r.height / 2;   // 方框幾何中心(殘影全圖覆蓋用)
        let cx = r.left + r.width * _anc.hc, cy = r.top + r.height * _anc.vc;   // 怪物身體中心(爆裂環/核心/粒子用)
        _vfxLastKillRect = { left: r.left, top: r.top, width: r.width, height: r.height };   // 供稀有掉落閃光定位
        let layer = _vfxLayer();
        // 🩸 致命一擊的傷害數字：死怪在下一幀渲染前已被 settleDeadMobs 移除→渲染側 HP-delta 抓不到，故在此(格子 DOM 仍在)補顯示，使龍騎士等「一/二擊秒殺」也看得到傷害
        { let _prev = (mob._vfxHp != null) ? mob._vfxHp : (mob.hp || 0);
          let _kdmg = Math.floor(_prev - mob.curHp);   // 自上次渲染以來累積傷害(含致命擊；curHp 可能為負＝溢殺，顯示實際打出的數值)
          let _kbig = mob._vfxBig; mob._vfxBig = false;   // 'crit'|'heavy'：致命擊的爆擊/重擊旗標仍在(渲染未重設)
          if (_kdmg > 0 && layer.childElementCount < 200) {
              let _kele = (mob.justHit && mob.justHit !== true) ? mob.justHit : 'normal';
              _vfxNumber(cx + (Math.random() * 26 - 13), r.top + r.height * Math.max(0.12, _anc.vc - 0.30), _kdmg, _kele, _kbig);   // 🎯 v2.6.45 數字浮於怪身上方(相對身體中心·非固定 0.40 方框位)
          }
        }
        let color = mob.boss ? '#ffd54f' : '#ff8a5c';
        // ✨ 強化死亡表現（讓「怪物被消滅」更明顯）：白閃殘影 + 衝擊波環 + 核心爆閃。場上特效過多(>150)時略過較重的殘影/環，只留粒子，避免大量 AoE 連殺洗版。
        if (layer.childElementCount < 150) {
            // 1) 死亡殘影：複製怪物圖像 → 白化＋放大＋淡出（強烈的「被抹除」感）
            try {
                let _img = box.querySelector('img');
                if (_img && _img.src && _img.naturalWidth !== 0) {
                    let gh = document.createElement('img');
                    gh.className = 'vfx-ghost'; gh.src = _img.src;
                    gh.style.left = bcx + 'px'; gh.style.top = bcy + 'px';   // 殘影＝整張圖複製→定位方框中心以完整覆蓋原圖(對齊)
                    gh.style.width = r.width + 'px'; gh.style.height = r.height + 'px';
                    gh.style.transformOrigin = (_anc.hc * 100).toFixed(1) + '% ' + (_anc.vc * 100).toFixed(1) + '%';   // 🎯 v2.6.45 放大自「怪物身體中心」擴散(非方框中心)→白閃由怪身發散
                    layer.appendChild(gh);
                    let _da = (typeof _mobAnimCache !== 'undefined') ? _mobAnimCache[mob.n] : null;
                    let _deathSeq = (_da && _da !== 'probing' && _da.death) ? _da.death : null;
                    if (_deathSeq) {   // 🎞️ v2.6.86 死亡序列（death_*.png）：殘影原位逐幀播一輪→短淡出（取代白閃；怪卡本體照常移除）
                        gh.src = _deathSeq[0].src;
                        let _fi = 0, _fint = setInterval(() => {
                            _fi++;
                            if (_fi < _deathSeq.length) gh.src = _deathSeq[_fi].src;
                            else { clearInterval(_fint); try { gh.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-out' }).onfinish = () => gh.remove(); } catch (e) { gh.remove(); } }
                        }, 1000 / MOB_ANIM_FPS);
                        setTimeout(() => { try { clearInterval(_fint); if (gh.isConnected) gh.remove(); } catch (e) {} }, _deathSeq.length * (1000 / MOB_ANIM_FPS) + 2000);   // 保險回收
                    } else {
                        gh.animate(
                            [ { transform: 'translate(-50%,-50%) scale(1)', opacity: .85, filter: 'brightness(2.6) saturate(.25)' },
                              { transform: 'translate(-50%,-50%) scale(' + (mob.boss ? 1.62 : 1.42) + ')', opacity: 0, filter: 'brightness(3.4) saturate(0)' } ],
                            { duration: mob.boss ? 520 : 400, easing: 'cubic-bezier(.2,.6,.2,1)' }
                        ).onfinish = () => gh.remove();
                    }
                }
            } catch (e) {}
            // 2) 衝擊波環：自死亡點擴張的圓環
            let ring = document.createElement('div'); ring.className = 'vfx-killring';
            let _rsz = mob.boss ? 64 : 44;
            ring.style.left = cx + 'px'; ring.style.top = cy + 'px';
            ring.style.width = _rsz + 'px'; ring.style.height = _rsz + 'px';
            ring.style.borderColor = color; ring.style.boxShadow = '0 0 12px ' + color + ', inset 0 0 12px ' + color;
            layer.appendChild(ring);
            ring.animate(
                [ { transform: 'translate(-50%,-50%) scale(.3)', opacity: .95 },
                  { transform: 'translate(-50%,-50%) scale(' + (mob.boss ? 2.0 : 1.7) + ')', opacity: 0 } ],
                { duration: mob.boss ? 520 : 420, easing: 'cubic-bezier(.15,.7,.3,1)' }
            ).onfinish = () => ring.remove();
            // 3) 核心爆閃：死亡點一團白熱光迅速擴散消失
            let core = document.createElement('div'); core.className = 'vfx-particle';
            let _csz = mob.boss ? 40 : 26;
            core.style.width = _csz + 'px'; core.style.height = _csz + 'px';
            core.style.left = cx + 'px'; core.style.top = cy + 'px';
            core.style.background = 'radial-gradient(circle, #fff 18%, ' + color + ' 55%, rgba(0,0,0,0) 76%)';
            core.style.boxShadow = '0 0 20px ' + color;
            layer.appendChild(core);
            core.animate(
                [ { transform: 'translate(-50%,-50%) scale(.35)', opacity: 1 },
                  { transform: 'translate(-50%,-50%) scale(1.45)', opacity: 0 } ],
                { duration: 280, easing: 'ease-out' }
            ).onfinish = () => core.remove();
        }
        let n = mob.boss ? 28 : 18;   // ✨ 爆裂粒子數提高（原 22/13）→ 死亡更顯眼
        for (let i = 0; i < n; i++) {
            let pt = document.createElement('div');
            pt.className = 'vfx-particle';
            let sz = (mob.boss ? 6 : 5) + Math.random() * 5;
            pt.style.width = sz + 'px'; pt.style.height = sz + 'px';
            pt.style.left = cx + 'px'; pt.style.top = cy + 'px';
            pt.style.background = color; pt.style.boxShadow = '0 0 7px ' + color;
            layer.appendChild(pt);
            let ang = Math.PI * 2 * (i / n) + Math.random() * 0.6;
            let dist = (mob.boss ? 60 : 42) + Math.random() * 55;
            let dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 12;
            pt.animate(
                [ { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
                  { transform: 'translate(calc(-50% + ' + dx.toFixed(1) + 'px), calc(-50% + ' + dy.toFixed(1) + 'px)) scale(.25)', opacity: 0 } ],
                { duration: 460 + Math.random() * 260, easing: 'cubic-bezier(.2,.7,.3,1)' }
            ).onfinish = () => pt.remove();
        }
        if (mob.boss) {   // 👑 頭目擊殺：戰場金白閃光
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
}
function toggleVfxPref() {
    let off = !window.__vfxOff;
    try { localStorage.setItem(_VFX_PREF_KEY, off ? '1' : '0'); } catch (e) {}
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
    let _order = _back ? [0, 3, 1, 4, 2] : [0, 1, 2];                // 後排(3,4)插在前排之間→交錯前後景深
    for(let _k = 0; _k < _order.length; _k++) {
        let i = _order[_k];
        let m = mapState.mobs[i];
        let _rowCls = (i >= 3) ? ' mob-back' : (_back ? ' mob-front' : '');   // 後排/前排版位 class（三格模式不加→沿用原版面）
        if (m) {
            let act = (i === mapState.targetIdx) ? 'active' : '';
            let _mi = mobStillImg(m.n, m.img, true);   // 🎬 戰鬥初始幀：有動畫→優先 spawn_0（無 spawn 退 idle_0·再退舊靜態）；無動畫→舊靜態
            let hitClass = m.justHit ? (m.justHit === true ? 'anim-hit-normal' : `anim-hit-${m.justHit}`) : '';
            _forceHit[_k] = !!m.justHit;   // 🚀 被擊中→即使字串相同也強制重建該格(重播受擊動畫)
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
            _slotHtmls[_k] = `<div class="mob-target ${act}${_rowCls}${BOSS_BIG_MAPS.includes(mapState.current) ? ' boss-slot' : (m.boss ? ' boss-zoom' : '')}" data-uid="${m.uid}"${_scat}>
                        <div class="flex justify-center text-sm mb-1 mob-name">
                            <span class="${getMobNameClass(m)}">${m.n}</span>
                        </div>
                        ${badges}
                        <div class="flex justify-center mb-1 mob-img-wrap">
                            <span class="mob-img-inner"><img src="${_mi.src}" data-fb="${_mi.fb.concat(['https://placehold.co/100x100/1e293b/ffffff?text=?']).join('|')}" alt="${m.n}" onerror="_mobImgErr(this)" class="w-24 h-24 p-1 object-contain pointer-events-none ${hitClass}${m._grace ? ' grace-glow' : ''}"></span>
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
const MOB_ANIM_MAX_FRAMES = 30;    // 每動作幀數探測上限
let _mobAnimCache = {};            // 怪名 → {idle,spawn,attack,skill,death:各[Image]|null} ｜ 'probing' ｜ null（全無）
// 🎬 有序列幀動畫的怪物名單（單一真相·同步判斷用）：戰鬥/圖鑑靜態顯示點與探測皆據此，避免對 1000+ 無動畫怪發 404。
//    ⚠️ 新增動畫怪：把幀丟進 assets/anim/<怪名>/（跑 spr2png.js）後，把 <怪名> 加進此 Set（一行）。播放幀數由 _mobAnimProbe 自動偵測。
const MOB_ANIM_NAMES = new Set(['安塔瑞斯']);
// 怪物「靜態顯示圖」候選：有動畫→戰鬥優先 spawn_0、圖鑑優先 idle_0，退回舊靜態 PNG；無動畫→直接舊靜態。回傳 {src, fb:[後備...]}（fb 走 onerror 逐張退·各呼叫點自行在末端補佔位符）。
function mobStillImg(name, staticUrl, preferSpawn) {
    let base = staticUrl || `assets/icons/monsters/${name}.png`;
    if (!MOB_ANIM_NAMES.has(name)) return { src: base, fb: [] };
    let list = [];
    if (preferSpawn) list.push(`assets/anim/${name}/spawn_0.png`);
    list.push(`assets/anim/${name}/idle_0.png`, base);
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
function _mobAnimProbe(name) {
    if (_mobAnimCache[name] !== undefined) return;
    _mobAnimCache[name] = 'probing';
    let out = { idle: null, spawn: null, attack: null, skill: null, death: null }, pending = 5;
    let finish = () => { if (--pending > 0) return; _mobAnimCache[name] = (out.idle || out.spawn || out.attack || out.skill || out.death) ? out : null; };
    let probeSeq = (key, prefixes) => {   // 依前綴逐號載入到缺號為止；idle 先試 idle_ 再退裸編號
        let frames = [], pi = 0;
        let done = () => { out[key] = frames.length >= 2 ? frames : null; finish(); };
        let tryLoad = (i) => {
            if (i >= MOB_ANIM_MAX_FRAMES) { done(); return; }
            let im = new Image();
            im.onload = () => { frames.push(im); tryLoad(i + 1); };
            im.onerror = () => { if (i === 0 && pi + 1 < prefixes.length) { pi++; tryLoad(0); } else done(); };
            im.src = `assets/anim/${name}/${prefixes[pi]}${i}.png`;
        };
        tryLoad(0);
    };
    probeSeq('idle', ['idle_', '']);
    probeSeq('spawn', ['spawn_']);
    probeSeq('attack', ['attack_']);
    probeSeq('skill', ['skill_']);
    probeSeq('death', ['death_']);
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
        let img = c.querySelector('.mob-img-wrap img'); if (!img) continue;
        let src = null;
        if (m._animAct) {   // 🎬 單次動作（登場/攻擊/技能）：自觸發時刻起逐幀播一輪，播畢清除回待機
            let seq = a[m._animAct.k];
            if (seq) {
                let f = Math.floor((Date.now() - m._animAct.t) / (1000 / MOB_ANIM_FPS));
                if (f < seq.length) src = seq[f].src; else m._animAct = null;
            } else m._animAct = null;   // 該動作無序列→直接清（維持待機）
        }
        if (!src && a.idle) {
            let _ofs = 0; { let s = String(uid); for (let j = 0; j < s.length; j++) _ofs += s.charCodeAt(j); }   // 同名多隻→依 uid 錯開相位
            src = a.idle[(Math.floor(Date.now() / (1000 / MOB_ANIM_FPS)) + _ofs) % a.idle.length].src;
        }
        if (src && img.src !== src) img.src = src;
    }
}
setInterval(() => { if (!document.hidden) { try { _mobAnimApply(); } catch (e) {} } }, Math.floor(1000 / MOB_ANIM_FPS));

// 🚀 效能：分頁面板重繪保護＋節流。狩獵時扣箭/耗肉/掉寶會每 tick 觸發 renderTabs 重建整個面板，
//    重建會洗掉按鈕→在 mousedown↔mouseup 間重建使「賣出/強化」點擊失效並造成卡頓。