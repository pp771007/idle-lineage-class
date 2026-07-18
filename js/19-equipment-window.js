// ===== 可拖曳雙頁角色裝備視窗 =====
(function () {
    const PAGE_SLOTS = [
        [
            { k: 'helm',    x: 50.0, y: 15.81, w: 19.67, h: 8.82 },
            { k: 'ear1',    x: 19.4, y: 18.01, w: 19.67, h: 8.82 },
            { k: 'ear2',    x: 80.1, y: 18.01, w: 19.67, h: 8.82 },
            { k: 'amulet',  x: 50.0, y: 33.46, w: 19.67, h: 8.82 },
            { k: 'gloves',  x: 19.4, y: 31.50, w: 19.67, h: 8.82 },
            { k: 'cloak',   x: 80.1, y: 31.50, w: 19.67, h: 8.82 },
            { k: 'tshirt',  x: 50.0, y: 42.77, w: 19.67, h: 8.82 },
            { k: 'wpn',     x: 19.4, y: 44.98, w: 19.67, h: 8.82 },
            { k: 'shield', alt: 'offwpn', x: 80.1, y: 44.98, w: 19.67, h: 8.82 },
            { k: 'armor',   x: 50.0, y: 52.08, w: 19.67, h: 8.82 },
            { k: 'ring1',   x: 19.4, y: 58.46, w: 19.67, h: 8.82 },
            { k: 'ring2',   x: 80.1, y: 58.46, w: 19.67, h: 8.82 },
            { k: 'belt',    x: 50.0, y: 63.36, w: 19.67, h: 8.82 },
            { k: 'ring3',   x: 19.4, y: 67.77, w: 19.67, h: 8.82 },
            { k: 'ring4',   x: 80.1, y: 67.77, w: 19.67, h: 8.82 },
            { k: 'shin',    x: 50.0, y: 72.67, w: 19.67, h: 8.82 },
            { k: 'boots',   x: 50.0, y: 81.99, w: 19.67, h: 8.82 },
            { k: 'doll',    x: 19.4, y: 80.76, w: 19.67, h: 8.82 },
            { k: 'arrow',   x: 80.1, y: 80.76, w: 19.67, h: 8.82 }
        ],
        [
            { k: 'rem_eye',   x: 50.0, y: 15.81, w: 19.67, h: 8.82 },
            { k: 'rem_blood', x: 80.1, y: 31.50, w: 19.67, h: 8.82 },
            { k: 'rem_scale', x: 50.0, y: 52.08, w: 19.67, h: 8.82 },
            { k: 'rem_bone',  x: 19.4, y: 31.50, w: 19.67, h: 8.82 },
            { k: 'rem_fang',  x: 80.1, y: 44.98, w: 19.67, h: 8.82 },
            { k: 'rem_heart', x: 50.0, y: 63.36, w: 19.67, h: 8.82 },
            { k: 'rem_flesh', x: 50.0, y: 81.99, w: 19.67, h: 8.82 },
            { k: 'rem_claw',  x: 19.4, y: 44.98, w: 19.67, h: 8.82 }
        ]
    ];

    let page = 0;
    let drag = null;
    let sideMode = null;
    let clickTimer = null;

    // 🎬 v3.0.44 變身立繪動畫（用戶提供 morph.spr）：這 15 個變身用 assets/morphanim/<名>/morph_N.png 逐幀循環（8fps），取代舊 assets/morph/<名>.jpg 靜態立繪。其餘變身維持 .jpg 退回鏈。
    // 🎬 v3.0.46 ①大小統一：以「炎魔」畫布高(191px)為基準像素比例——顯示高 = 帶高 × 本形態畫布高/191（炎魔=剛好填滿帶·其餘等比例縮·同一像素倍率）；
    //          ②三層疊放：morph_s(影子·multiply·墊底) + morph(本體) + morph_w(武器特效·screen·最上)——三者 --multi 共畫布→同 rect 疊放即像素級對齊。
    const MORPH_ANIM_PORTRAIT = new Set(['克特', '卡司特王', '思克巴女皇', '死亡騎士', '炎魔', '白金法師', '白金騎士', '艾莉絲', '銀光法師', '銀光騎士', '騎士范德', '黃金法師', '黃金騎士', '黑暗法師', '黑暗騎士',
        '亞力安', '人形殭屍', '侏儒', '哥布林', '地靈', '多羅', '妖魔', '妖魔弓箭手', '小惡魔', '巴列斯', '巴風特', '思克巴', '惡魔', '歐吉', '死亡', '狼人', '萊肯', '食人妖精王', '食屍鬼', '骷髏弓箭手', '骷髏斧手', '骷髏槍兵', '黑暗妖精刺客',   // 🧝 v3.0.50 +23 變身動態立繪
        '反王肯恩', '吸血鬼', '巨人', '白金巡守', '賽尼斯', '銀光巡守', '阿魯巴', '黃金巡守', '黑暗巡守', '黑暗精靈',   // 🧝 v3.0.52 +10 變身動態立繪
        '卡士柏', '史巴托', '妖魔巡守', '妖魔鬥士', '巨大牛人', '巴土瑟', '暴走兔', '果凍怪', '格利芬', '歐姆民兵', '獨眼巨人', '甘地妖魔', '石頭高崙', '紙人', '羅孚妖魔', '西瑪', '那魯加妖魔', '都達瑪拉妖魔', '重裝歐姆', '長老', '阿吐巴妖魔', '雪怪', '食人妖精', '馬庫爾', '骷髏', '黑暗妖精運送員', '黑長者', '黑騎士',   // 🧝 v3.0.57 +28 變身動態立繪（合計 76＝POLY_TIERS 全形態·變身動畫全數到位）
        '真死亡騎士 冥皇丹特斯', '烈焰的死亡騎士', '莉絲安']);   // 🌑 v3.4.67 冥皇執行劍變身＋烈焰死騎立繪；🏹 v3.5.7 莉絲安立繪
    const MORPH_PORTRAIT_REF_H = 191;   // 炎魔 morph 畫布高＝基準（用戶：炎魔目前大小剛好）
    let _morphPortrait = { name: null, body: [], shadow: [], weapon: [], i: 0, timer: null, bandH: 0 };
    function _portraitLayers(image) {   // 影子/武器覆疊層（動態建立→index.html/test.html 免改）
        const box = image.parentElement;
        let sh = document.getElementById('equipment-morph-shadow');
        let wp = document.getElementById('equipment-morph-weapon');
        if (!sh) { sh = document.createElement('img'); sh.id = 'equipment-morph-shadow'; sh.alt = ''; sh.draggable = false; box.insertBefore(sh, image); }
        if (!wp) { wp = document.createElement('img'); wp.id = 'equipment-morph-weapon'; wp.alt = ''; wp.draggable = false; box.appendChild(wp); }
        // 🛡️ v3.0.51 關鍵定位樣式改 JS inline 設定（inline 優先於外部樣式表）：不依賴 floating-ui.css 是否為最新→根治「舊 CSS 快取使覆疊層 position:static→影子與本體垂直排開沒對到」。
        const baseCss = 'position:absolute;pointer-events:none;object-fit:contain;image-rendering:crisp-edges;image-rendering:pixelated;';
        if (sh.getAttribute('data-pmcss') !== '1') { sh.style.cssText = baseCss + 'mix-blend-mode:multiply;z-index:1;visibility:hidden;'; sh.setAttribute('data-pmcss', '1'); }
        if (wp.getAttribute('data-pmcss') !== '1') { wp.style.cssText = baseCss + 'mix-blend-mode:screen;z-index:3;visibility:hidden;'; wp.setAttribute('data-pmcss', '1'); }
        return { sh: sh, wp: wp };
    }
    function _syncPortraitLayerRect(image) {   // 覆疊層幾何 = 本體 img 的 offset box（共畫布→同 rect 即對齊）
        const sh = document.getElementById('equipment-morph-shadow');
        const wp = document.getElementById('equipment-morph-weapon');
        [sh, wp].forEach(l => { if (!l) return; l.style.left = image.offsetLeft + 'px'; l.style.top = image.offsetTop + 'px'; l.style.width = image.offsetWidth + 'px'; l.style.height = image.offsetHeight + 'px'; });
    }
    function _stopMorphPortrait() {
        if (_morphPortrait.timer) { clearInterval(_morphPortrait.timer); _morphPortrait.timer = null; }
        _morphPortrait.name = null; _morphPortrait.body = []; _morphPortrait.shadow = []; _morphPortrait.weapon = [];
        const sh = document.getElementById('equipment-morph-shadow'); if (sh) sh.style.visibility = 'hidden';
        const wp = document.getElementById('equipment-morph-weapon'); if (wp) wp.style.visibility = 'hidden';
    }
    function _startMorphPortrait(dir, image, tree) {   // 逐號探測 morph_0..N（含 _s/_w）→ 8fps 三層同步循環·tree 預設 morphanim（🧝 真夏納職業式變身→classanim）
        _stopMorphPortrait();
        _morphPortrait.name = dir;
        image.classList.add('morph-anim-portrait');
        const base = 'assets/' + (tree || 'morphanim') + '/' + encodeURIComponent(dir) + '/';
        let natH = 0, pending = 3;
        const seqs = { body: [], shadow: [], weapon: [] };
        const done = () => {
            if (--pending > 0 || _morphPortrait.name !== dir) return;
            _morphPortrait.body = seqs.body; _morphPortrait.shadow = seqs.shadow; _morphPortrait.weapon = seqs.weapon; _morphPortrait.i = 0;
            if (!seqs.body.length) { image.classList.remove('morph-anim-portrait'); image.classList.add('no-image'); return; }
            image.classList.remove('no-image');
            // 📏 大小統一：量測帶高（先還原 height 讀 flex 天然高·只量一次快取）→ 顯示高=帶高×natH/191（上限=帶高）
            if (!_morphPortrait.bandH) { image.style.height = ''; image.style.flex = ''; const bh = image.offsetHeight; if (bh > 20) _morphPortrait.bandH = bh; }
            if (_morphPortrait.bandH && natH > 0) {
                const targetH = Math.min(_morphPortrait.bandH, Math.round(_morphPortrait.bandH * natH / MORPH_PORTRAIT_REF_H));
                image.style.height = targetH + 'px'; image.style.flex = '0 0 auto'; image.style.margin = 'auto';
            }
            const L = _portraitLayers(image);
            image.src = seqs.body[0];
            const paint = () => {
                const i = _morphPortrait.i;
                image.src = seqs.body[i];
                if (seqs.shadow.length) { L.sh.style.visibility = 'visible'; L.sh.src = seqs.shadow[i < seqs.shadow.length ? i : i % seqs.shadow.length]; } else L.sh.style.visibility = 'hidden';
                if (seqs.weapon[i]) { L.wp.style.visibility = 'visible'; L.wp.src = seqs.weapon[i]; } else L.wp.style.visibility = 'hidden';   // 武器嚴格逐幀（本幀無→隱藏）
            };
            requestAnimationFrame(() => { _syncPortraitLayerRect(image); paint(); });
            _morphPortrait.timer = setInterval(() => {
                if (!_morphPortrait.body.length) return;
                _morphPortrait.i = (_morphPortrait.i + 1) % _morphPortrait.body.length;
                _syncPortraitLayerRect(image);   // 每幀順手同步幾何（視窗拖曳/縮放後仍對齊·讀 offset 便宜）
                paint();
            }, 125);
        };
        const probe = (pfx, arr, captureH) => {
            const step = (n) => {
                if (_morphPortrait.name !== dir) return;
                const im = new Image();
                im.onload = () => { if (captureH && n === 0) natH = im.naturalHeight; arr.push(base + pfx + n + '.png'); step(n + 1); };
                im.onerror = () => done();
                im.src = base + pfx + n + '.png';
            };
            step(0);
        };
        probe('morph_', seqs.body, true);
        probe('morph_s_', seqs.shadow, false);
        probe('morph_w_', seqs.weapon, false);
    }

    function el(id) { return document.getElementById(id); }
    function signed(n) { n = Number(n) || 0; return n > 0 ? '+' + n : String(n); }

    const EQUIPMENT_TEMPLATE_CLASS = {
        royal: '王族', knight: '騎士', mage: '法師', elf: '妖精',
        dark: '黑妖', illusion: '幻術', dragon: '龍騎', warrior: '戰士'
    };
    function equipmentTemplateUrl() {
        const cls = typeof player !== 'undefined' && player ? EQUIPMENT_TEMPLATE_CLASS[player.cls] : '';
        if (!cls) return 'public/assets/login/EQ%20UI/' + encodeURIComponent('原圖.png') + '?v=20260713';
        const avatar = String(player.avatar || '');
        const female = avatar.startsWith('女') || (player.cls === 'royal' && player.bloodPledge === 'esti');
        return 'public/assets/login/EQ%20UI/' + encodeURIComponent((female ? '女' : '男') + cls + '.png') + '?v=20260713';
    }
    function syncEquipmentBackground() {
        const background = el('equipment-window-frame')?.querySelector('.equipment-window-bg');
        if (!background) return;
        const src = equipmentTemplateUrl();
        if (background.getAttribute('src') !== src) background.src = src;
    }

    function renderStats() {
        if (typeof player === 'undefined' || !player || !player.d) return;
        const d = player.d;
        const expReq = getExpReq(player.lv);
        const expPct = player.lv >= 100 ? 100 : (expReq > 0 && isFinite(expReq) ? (player.exp / expReq) * 100 : 0);
        const values = [
            ['level', player.lv], ['exp', expPct.toFixed(2) + '%'],
            ['hp', `${Math.floor(player.hp)}/${Math.floor(player.mhp)}`],
            ['mp', `${Math.floor(player.mp)}/${Math.floor(player.mmp)}`],
            ['ac', player.d.ac], ['elixir', player.panaceaUsed || 0], ['pk', player.pk || 0],
            ['str', d.str], ['dex', d.dex], ['con', d.con], ['int', d.int], ['wis', d.wis], ['cha', d.cha],
            ['earth', Math.abs(Number(d.resEarth) || 0)], ['water', Math.abs(Number(d.resWater) || 0)],
            ['fire', Math.abs(Number(d.resFire) || 0)], ['wind', Math.abs(Number(d.resWind) || 0)],
            ['er', Math.abs(Number(d.er) || 0)]
        ];
        el('equipment-window-stats').innerHTML = values.map(([key, value]) =>
            `<span class="equipment-stat equipment-stat-${key}">${value}</span>`
        ).join('');
        const weight = el('equipment-window-weight');
        if (weight) {
            const weightPct = Math.max(0, Math.round(Number(d.weightPct) || 0));
            const loadTier = Math.max(0, Math.min(3, Number(d.loadTier) || 0));
            weight.textContent = `負重 ${weightPct} %`;
            weight.dataset.loadTier = String(loadTier);
            weight.setAttribute('aria-label', `目前負重 ${weightPct}%`);
        }
    }

    function renderMorphSnapshot() {
        const box = el('equipment-morph-snapshot');
        if (!box || typeof player === 'undefined' || !player) return;
        const form = player._setPoly || ((player.buffs && player.buffs.poly > 0 && player.poly) ? player.poly : null);
        if (!form || form.keepClassAppearance) { _stopMorphPortrait(); const _im = el('equipment-morph-image'); if (_im) _im.setAttribute('data-morph', ''); box.classList.add('hidden'); return; }
        box.classList.remove('hidden');
        el('equipment-morph-name').textContent = form.n || '變身';
        const aliases = {
            '真‧死亡騎士':'死亡騎士', '真死亡騎士':'死亡騎士',
            '真‧克特':'克特', '真克特':'克特',
            '高等黑暗精靈':'黑暗精靈', '真‧黑暗妖精':'黑暗精靈', '真黑暗妖精':'黑暗精靈',
            '真‧黑暗精靈':'黑暗精靈', '真黑暗精靈':'黑暗精靈',
            // 🆕 v3.0.33 借用同族立繪的別名：本尊動畫部署後即移除（v3.0.50 刪 惡魔→小惡魔/黑暗妖精刺客→黑暗刺客·v3.0.52 刪 反王肯恩→反王肯特·v3.0.57 刪 暴走兔→曼波兔/重裝歐姆→歐姆＝本尊動畫已部署）。
            // ⚠️v3.0.35 古代黑/白銀/黃金/白金 騎士/搜索隊/法師 已改名為 黑暗/銀光/黃金/白金 巡守/騎士/法師（潔尼斯→賽尼斯）＝直接對應同名立繪，故移除其別名。
        };
        const rawName = (form.n || '').replace(/[()（）·‧\s]/g, '');
        const imageName = (aliases[form.n] || form.n || '').replace(/[()（）·‧\s]/g, '');
        const image = el('equipment-morph-image');
        // 🖼️ v3.0.33 圖片退回鏈＋只在「變身名稱改變」時重載：專屬立繪(assets/morph/*.jpg) → 該怪戰鬥動畫首幀(assets/anim/<原名>/idle_0.png) → 隱藏。
        //   守衛避免 500ms 定時刷新每次都把 src 重設回可能 404 的立繪 → 退回鏈重跑造成閃爍。
        const _pKey = form.classMorph ? ((form.n || '') + (player.avatar || '')) : (form.n || '');   // 🧝 v3.5.21 真夏納：立繪逐職業性別（換職業存檔也要換立繪）
        if (image.getAttribute('data-morph') !== _pKey) {
            image.setAttribute('data-morph', _pKey);
            image.classList.remove('no-image');
            image.alt = form.n || '變身快照';
            if (form.classMorph) {   // 🧝 真夏納：職業式變身立繪＝assets/classanim/<形態名><avatar>/morph_*
                image.onerror = null;
                _startMorphPortrait(_pKey, image, 'classanim');
            } else if (MORPH_ANIM_PORTRAIT.has(imageName)) {   // 🎬 v3.0.44 動態立繪（morph.spr 幀循環）
                image.onerror = null;
                _startMorphPortrait(imageName, image);
            } else {   // 其餘：舊 .jpg → 動畫首幀 → 隱藏 退回鏈
                _stopMorphPortrait();
                image.classList.remove('morph-anim-portrait');
                image.style.height = ''; image.style.flex = ''; image.style.margin = '';   // 還原動態立繪的統一尺寸覆寫
                image.setAttribute('data-morphfb', 'assets/anim/' + encodeURIComponent(rawName) + '/idle_0.png');
                image.src = 'assets/morph/' + encodeURIComponent(imageName) + '.jpg';
                image.onerror = function () {
                    const fb = (this.getAttribute('data-morphfb') || '').split('|').filter(Boolean);
                    if (fb.length) { this.setAttribute('data-morphfb', fb.slice(1).join('|')); this.src = fb[0]; }
                    else { this.onerror = null; this.classList.add('no-image'); }
                };
            }
        }
        // 🚫 v3.0.34 用戶要求：只顯示變身「名稱＋圖片」，隱藏下方能力說明文字（之後放對應動態圖）。
        //   用 inline display:none 而非 class，避免 .equipment-morph-bonus{display:flex} 與 .hidden 誰後載入的層疊順序不確定。
        const bonus = el('equipment-morph-bonus');
        bonus.textContent = '';
        bonus.style.display = 'none';
    }

    function renderSlots() {
        if (typeof player === 'undefined' || !player || !player.eq) return;
        const host = el('equipment-window-slots');
        host.innerHTML = '';
        PAGE_SLOTS[page].forEach(pos => {
            const actualKey = pos.alt && player.eq[pos.alt] ? pos.alt : pos.k;
            const item = player.eq[actualKey];
            const data = item && typeof DB !== 'undefined' && DB.items[item.id];
            const slot = document.createElement('button');
            slot.type = 'button';
            slot.className = 'equipment-visual-slot' + (item ? ' is-filled' : ' is-empty');
            slot.style.cssText = `left:${pos.x}%;top:${pos.y}%;width:${pos.w}%;height:${pos.h}%;`;
            if (item && data) {
                const img = document.createElement('img');
                img.src = getIconUrl(data);
                img.alt = data.n || pos.k;
                img.draggable = false;
                img.onerror = function () { this.style.display = 'none'; };
                // 裝備框沿用背包／舊裝備欄的統一圖示光效：祝福金光、遠古紫光、屬性光、遺物與傳說皆由單一判定處理。
                if (typeof getGlowClass === 'function') {
                    const glowClass = getGlowClass(item, data);
                    if (glowClass) img.classList.add(...glowClass.split(/\s+/).filter(Boolean));
                }
                slot.appendChild(img);
                if ((data.type === 'wpn' || data.type === 'arm' || data.type === 'acc') && !data.isArrow) {
                    const equipped = document.createElement('span');
                    equipped.className = 'equipment-slot-equipped';
                    equipped.textContent = 'E';
                    equipped.setAttribute('aria-hidden', 'true');
                    slot.appendChild(equipped);
                }
                if ((Number(item.en) || 0) > 0) {
                    const badge = document.createElement('span');
                    badge.className = 'equipment-slot-enhance';
                    badge.textContent = '+' + capEn(item.en, data);
                    slot.appendChild(badge);
                } else if ((item.cnt || 1) > 1) {
                    const count = document.createElement('span');
                    count.className = 'equipment-slot-count';
                    count.textContent = (item.cnt || 1).toLocaleString();
                    slot.appendChild(count);
                }
                slot.classList.add('tip-host');
                slot.setAttribute('data-tip-uid', item.uid); slot.setAttribute('data-tip-src', 'eq');   // 🖱️ hover 即時顯示已裝備物品完整資訊 tooltip
                slot.onclick = function () {
                    const win = el('equipment-window');
                    if (win && win.classList.contains('equipment-window-embedded')) {
                        if (typeof openModal === 'function') openModal(item, true, actualKey);
                        return;
                    }
                    clearTimeout(clickTimer);
                    clickTimer = setTimeout(function () {
                        openEquipmentSidePanel((data.type === 'wpn' || data.isArrow) ? 'weapons' : 'armors');
                    }, 230);
                };
                slot.ondblclick = function (event) {
                    clearTimeout(clickTimer);
                    event.preventDefault();
                    event.stopPropagation();
                    unequipItem(actualKey);
                };
            } else {
                slot.title = '尚未裝備';
                slot.onclick = function () {
                    const win = el('equipment-window');
                    if (win && win.classList.contains('equipment-window-embedded')) return;
                    openEquipmentSidePanel((pos.k === 'wpn' || pos.k === 'offwpn' || pos.k === 'arrow') ? 'weapons' : 'armors');
                };
            }
            host.appendChild(slot);
        });
        const pageOne = el('equipment-window-prev');
        const pageTwo = el('equipment-window-next');
        pageOne.disabled = false;
        pageTwo.disabled = false;
        pageOne.classList.toggle('active', page === 0);
        pageTwo.classList.toggle('active', page === 1);
        pageOne.setAttribute('aria-pressed', page === 0 ? 'true' : 'false');
        pageTwo.setAttribute('aria-pressed', page === 1 ? 'true' : 'false');
    }

    function plainItemName(item) {
        const d = DB.items[item.id];
        const tmp = document.createElement('span');
        tmp.innerHTML = getItemFullName(item);
        return tmp.textContent || tmp.innerText || (d && d.n) || item.id;
    }

    function renderSidePanel() {
        const panel = el('equipment-side-panel');
        const list = el('equipment-side-list');
        if (!panel || panel.classList.contains('hidden') || !sideMode || typeof player === 'undefined') return;
        el('equipment-side-title').textContent = sideMode === 'weapons' ? '武器' : '防具與飾品';
        list.innerHTML = '';
        const items = player.inv.filter(function (item) {
            const d = DB.items[item.id];
            if (!d) return false;
            return sideMode === 'weapons' ? d.type === 'wpn' : (d.type === 'arm' || d.type === 'acc');
        });
        if (!items.length) {
            list.innerHTML = '<div class="equipment-side-empty">背包中沒有可顯示的裝備</div>';
            return;
        }
        items.forEach(function (item) {
            const d = DB.items[item.id];
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'equipment-side-item tip-host' + (checkCanEquip(item) ? '' : ' cannot-equip');
            row.setAttribute('data-tip-uid', item.uid); row.setAttribute('data-tip-src', 'inv');   // 🖱️ hover 即時顯示完整資訊 tooltip
            const icon = document.createElement('img');
            icon.src = getIconUrl(d);
            icon.alt = '';
            icon.draggable = false;
            icon.onerror = function () { this.style.visibility = 'hidden'; };
            const name = document.createElement('span');
            name.className = 'equipment-side-name ' + getItemColor(item);
            name.innerHTML = getItemFullName(item);
            const count = document.createElement('small');
            count.textContent = (item.cnt || 1) > 1 ? '×' + (item.cnt || 1).toLocaleString() : '';
            row.append(icon, name, count);
            row.onclick = function () {
                clearTimeout(clickTimer);
                clickTimer = setTimeout(function () { openModal(item, false); }, 230);
            };
            row.ondblclick = function (event) {
                clearTimeout(clickTimer);
                event.preventDefault();
                event.stopPropagation();
                equipItem(item);
            };
            list.appendChild(row);
        });
    }

    window.openEquipmentSidePanel = function (mode) {
        const win = el('equipment-window');
        if (win && win.classList.contains('equipment-window-embedded')) return;
        sideMode = mode === 'armors' ? 'armors' : 'weapons';
        const panel = el('equipment-side-panel');
        if (!panel) return;
        panel.classList.remove('hidden');
        const frame = el('equipment-window-frame');
        if (frame) frame.classList.add('side-open');
        renderSidePanel();
        requestAnimationFrame(fitEquipmentWindowToViewport);
    };

    window.closeEquipmentSidePanel = function () {
        const panel = el('equipment-side-panel');
        if (panel) panel.classList.add('hidden');
        const frame = el('equipment-window-frame');
        if (frame) frame.classList.remove('side-open');
        sideMode = null;
        requestAnimationFrame(fitEquipmentWindowToViewport);
    };

    function fitEquipmentWindowToViewport() {
        const frame = el('equipment-window-frame');
        const win = el('equipment-window');
        if (!frame || !win || win.classList.contains('hidden')) return;
        if (win.classList.contains('equipment-window-embedded')) {
            const host = el('tab-content-panel');
            if (!host) return;
            let hostRect = host.getBoundingClientRect();
            const maxFrameWidth = 366;
            if (innerWidth <= 768) {
                const mobileFrameWidth = Math.min(hostRect.width, maxFrameWidth);
                const mobileHeight = Math.ceil(mobileFrameWidth * 408 / 183);
                host.style.setProperty('--equipment-panel-height', mobileHeight + 'px');
                hostRect = host.getBoundingClientRect();
            }
            const frameWidth = Math.max(0, Math.min(
                hostRect.width,
                maxFrameWidth,
                hostRect.height * 183 / 408
            ));
            win.style.left = hostRect.left + 'px';
            win.style.top = hostRect.top + 'px';
            win.style.right = 'auto';
            win.style.bottom = 'auto';
            win.style.width = hostRect.width + 'px';
            win.style.height = hostRect.height + 'px';
            frame.style.left = '50%';
            frame.style.top = '0';
            frame.style.setProperty('width', frameWidth + 'px', 'important');
            frame.style.transform = 'translateX(-50%)';
            frame.classList.remove('side-open');
            return;
        }
        const rect = frame.getBoundingClientRect();
        const side = frame.classList.contains('side-open') ? el('equipment-side-panel') : null;
        const sideWidth = side && !side.classList.contains('hidden') ? side.getBoundingClientRect().width + 8 : 0;
        const totalWidth = rect.width + sideWidth;
        let left = rect.left, top = rect.top;
        left = Math.max(4, Math.min(left, innerWidth - totalWidth - 4));
        top = Math.max(4, Math.min(top, innerHeight - rect.height - 4));
        frame.style.left = left + 'px';
        frame.style.top = top + 'px';
        frame.style.transform = 'none';
    }

    window.refreshEquipmentWindow = function () {
        const win = el('equipment-window');
        if (!win || win.classList.contains('hidden')) return;
        syncEquipmentBackground();
        renderStats();
        renderMorphSnapshot();
        renderSlots();
        renderSidePanel();
    };

    window.setEquipmentPanelEmbedded = function (visible) {
        const win = el('equipment-window');
        if (!win) return;
        const host = el('tab-content-panel');
        if (host) {
            host.classList.toggle('equipment-panel-host', visible);
            if (!visible || innerWidth > 768) host.style.removeProperty('--equipment-panel-height');
            else host.style.setProperty('--equipment-panel-height', Math.ceil(Math.min(host.getBoundingClientRect().width, 366) * 408 / 183) + 'px');
        }
        win.classList.add('equipment-window-embedded');
        win.classList.toggle('hidden', !visible);
        win.setAttribute('aria-hidden', visible ? 'false' : 'true');
        if (!visible) return;
        if (innerWidth <= 768) {
            const scroller = el('game-screen');
            if (scroller && host) {
                const scrollerRect = scroller.getBoundingClientRect();
                const hostRect = host.getBoundingClientRect();
                if (hostRect.bottom > scrollerRect.bottom) scroller.scrollTop += hostRect.bottom - scrollerRect.bottom + 8;
                if (hostRect.top < scrollerRect.top) scroller.scrollTop -= scrollerRect.top - hostRect.top + 8;
            }
        }
        closeEquipmentSidePanel();
        refreshEquipmentWindow();
        requestAnimationFrame(fitEquipmentWindowToViewport);
    };

    window.openEquipmentWindow = function () {
        window.setEquipmentPanelEmbedded(true);
    };

    window.toggleEquipmentWindow = function () {
        const win = el('equipment-window');
        if (!win) return;
        window.setEquipmentPanelEmbedded(win.classList.contains('hidden'));
    };

    window.closeEquipmentWindow = function () {
        const win = el('equipment-window');
        if (!win) return;
        win.classList.add('hidden');
        win.setAttribute('aria-hidden', 'true');
    };

    function init() {
        const frame = el('equipment-window-frame');
        const handle = el('equipment-window-drag');
        if (!frame || !handle) return;
        const win = el('equipment-window');
        if (win) win.classList.add('equipment-window-embedded');
        const background = frame.querySelector('.equipment-window-bg');
        if (background) {
            background.onerror = function () {
                this.onerror = null;
                this.src = 'public/assets/login/EQ%20UI/' + encodeURIComponent('原圖.png') + '?v=20260713';
            };
            syncEquipmentBackground();
        }
        el('equipment-window-close').onclick = closeEquipmentWindow;
        el('equipment-side-close').onclick = closeEquipmentSidePanel;
        el('equipment-window-prev').setAttribute('aria-label', '裝備第 1 頁');
        el('equipment-window-next').setAttribute('aria-label', '裝備第 2 頁');
        el('equipment-window-prev').onclick = function () { page = 0; refreshEquipmentWindow(); };
        el('equipment-window-next').onclick = function () { page = 1; refreshEquipmentWindow(); };

        handle.addEventListener('pointerdown', function (event) {
            const rect = frame.getBoundingClientRect();
            drag = { id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
            handle.setPointerCapture(event.pointerId);
            frame.classList.add('is-dragging');
            event.preventDefault();
        });
        handle.addEventListener('pointermove', function (event) {
            if (!drag || drag.id !== event.pointerId) return;
            const side = frame.classList.contains('side-open') ? el('equipment-side-panel') : null;
            const sideWidth = side && !side.classList.contains('hidden') ? side.getBoundingClientRect().width + 8 : 0;
            const maxX = Math.max(0, innerWidth - frame.offsetWidth - sideWidth);
            const maxY = Math.max(0, innerHeight - frame.offsetHeight);
            frame.style.left = Math.max(0, Math.min(maxX, event.clientX - drag.dx)) + 'px';
            frame.style.top = Math.max(0, Math.min(maxY, event.clientY - drag.dy)) + 'px';
            frame.style.transform = 'none';
        });
        function stopDrag(event) {
            if (!drag || drag.id !== event.pointerId) return;
            drag = null;
            frame.classList.remove('is-dragging');
        }
        handle.addEventListener('pointerup', stopDrag);
        handle.addEventListener('pointercancel', stopDrag);
        window.addEventListener('resize', fitEquipmentWindowToViewport);
        const gameScroller = el('game-screen');
        if (gameScroller) gameScroller.addEventListener('scroll', fitEquipmentWindowToViewport, { passive: true });
        // 純顯示更新：讓卷軸到期、重新變身或套裝切換能即時反映，不改動任何變身判定。
        window.setInterval(function () {
            const win = el('equipment-window');
            if (win && !win.classList.contains('hidden')) renderMorphSnapshot();
        }, 500);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
