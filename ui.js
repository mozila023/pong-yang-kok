/* ==========================================================================
   ปงยางคก — ui.js  (loaded at the end of <body>, after the game + audio.js)
   Settings, onboarding tour, keyboard shortcuts, animated metrics, warnings.
   Everything is null-safe: the game keeps working if any element is absent.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__pykUI) return;
  window.__pykUI = true;

  var doc = document, root = doc.documentElement;
  function $(id) { return doc.getElementById(id); }
  function q(sel, ctx) { try { return (ctx || doc).querySelector(sel); } catch (e) { return null; } }
  function h(tag, props) {
    var n = doc.createElement(tag);
    if (props) {
      for (var k in props) {
        var v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      if (Array.isArray(c)) { for (var j = 0; j < c.length; j++) if (c[j] != null) n.append(c[j]); }
      else n.append(c);
    }
    return n;
  }
  function retrigger(n, cls) { n.classList.remove(cls); void n.offsetWidth; n.classList.add(cls); }
  function audio() { return window.GameAudio || null; }

  /* ---------------- preferences ---------------- */
  var KEY = 'pyk-ui';
  // Audio settings are owned by audio.js (GameAudio); only UI prefs live here.
  var prefs = { reduce: false, tutorial: false };
  try {
    var stored = JSON.parse(localStorage.getItem(KEY));
    if (stored && typeof stored === 'object') for (var pk in prefs) if (pk in stored) prefs[pk] = stored[pk];
  } catch (e) { /* ignore */ }
  function savePrefs() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ } }
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!prefs.reduce || !!(mq && mq.matches); }
  root.classList.toggle('ui-reduce', !!prefs.reduce);

  /* ---------------- audio bridge ---------------- */
  // Fallback only used when audio.js is missing; mirrors the engine defaults.
  var audioFallback = { music: 0.5, sfx: 0.7, muted: false };
  function audioSettings() {
    var A = audio();
    try { if (A && typeof A.getSettings === 'function') return A.getSettings(); } catch (e) { /* ignore */ }
    return audioFallback;
  }
  // Writes exactly one audio setting through the engine.
  function setAudio(field, value) {
    var A = audio();
    try {
      if (A) {
        if (field === 'music' && A.setMusicVolume) A.setMusicVolume(value);
        else if (field === 'sfx' && A.setSfxVolume) A.setSfxVolume(value);
        else if (field === 'muted' && A.mute) A.mute(!!value);
        return;
      }
    } catch (e) { /* ignore */ }
    audioFallback[field] = value;
  }
  function curMuted() { return !!audioSettings().muted; }
  function setMuted(v) { setAudio('muted', !!v); syncMute(); }
  function toggleMute() { setMuted(!curMuted()); }

  /* ---------------- fonts (progressive enhancement) ---------------- */
  function loadFonts() {
    try {
      if (!doc.head || q('link[data-pyk-font]')) return;
      var l = h('link', { rel: 'stylesheet', 'data-pyk-font': '1',
        href: 'https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@600;700&family=Sarabun:wght@400;500;600;700&display=swap' });
      doc.head.append(l);
    } catch (e) { /* ignore */ }
  }

  /* ---------------- layout vars ---------------- */
  function layout() {
    var hd = q('header');
    if (hd) { var hr = hd.getBoundingClientRect(); if (hr.height) root.style.setProperty('--ui-header-h', Math.round(hr.height) + 'px'); }
    var hud = q('.hud');
    if (hud) { var r = hud.getBoundingClientRect(); if (r.height) root.style.setProperty('--ui-dock-top', Math.round(r.bottom + 8) + 'px'); }
  }

  /* ---------------- tooltips ---------------- */
  var TIPS = { play: 'เดินเวลา / หยุด (Space)', next: 'ข้ามไป 1 เดือน (N)', rotate: 'หมุนกล้อง (R)', minus: 'ซูมออก (−)',
    plus: 'ซูมเข้า (+)', home: 'กลับกลางเมือง (H)', gov: 'สภาเมือง (G)', political: 'การเมือง (P)',
    sellTool: 'ทุบ / ขาย (X)', fold: 'พับเมนู (B)', unfold: 'เปิดเมนูก่อสร้าง (B)' };
  function addTips() {
    for (var id in TIPS) { var n = $(id); if (n && !n.getAttribute('title')) n.setAttribute('title', TIPS[id]); }
  }

  /* ---------------- animated metrics ---------------- */
  var lowUntil = 0, lowTimer = 0;
  var cashApi = null;

  function parseNum(t) {
    var m = /[-−]?\d[\d,]*(?:\.\d+)?/.exec(t);
    if (!m) return null;
    var raw = m[0];
    var v = parseFloat(raw.replace(/,/g, '').replace('−', '-'));
    if (!isFinite(v)) return null;
    return { pre: t.slice(0, m.index), suf: t.slice(m.index + raw.length), comma: raw.indexOf(',') >= 0, v: v };
  }
  function fmtNum(v, comma) { v = Math.round(v); return comma ? v.toLocaleString('th-TH') : String(v); }

  function watchMetric(id, icon, onValue) {
    var node = $(id);
    if (!node || !window.MutationObserver) return null;
    var metric = node.closest ? node.closest('.metric') : null;
    if (metric && !q('.ui-ico', metric)) metric.insertBefore(h('span', { class: 'ui-ico', 'aria-hidden': 'true', text: icon }), metric.firstChild);
    var st = { cur: null, target: null, raf: 0, txt: null, parts: null, flashT: 0, floatT: 0 };
    // write() flushes its own records with takeRecords(), so every record the
    // observer sees is a game update and carries the authoritative value.
    var obs = new MutationObserver(function () { handle(node.textContent); });
    function write(t) { st.txt = t; node.textContent = t; obs.takeRecords(); }
    function render(v) { return st.parts.pre + fmtNum(v, st.parts.comma) + st.parts.suf; }
    function cancel() { if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; } }
    function flash(cls) {
      node.classList.remove('ui-up', 'ui-down'); void node.offsetWidth; node.classList.add(cls);
      clearTimeout(st.flashT); st.flashT = setTimeout(function () { node.classList.remove(cls); }, 900);
    }
    function floater(delta, parts) {
      if (!metric || doc.hidden) return;
      var old = q('.ui-float', metric); if (old) old.remove();
      var up = delta > 0;
      var f = h('span', { class: 'ui-float ' + (up ? 'up' : 'down'), 'aria-hidden': 'true',
        text: (up ? '+' : '−') + parts.pre + fmtNum(Math.abs(delta), parts.comma) + parts.suf });
      metric.append(f);
      setTimeout(function () { if (f.parentNode) f.remove(); }, 1600);
    }
    function handle(t) {
      var p = parseNum(t);
      if (!p) { cancel(); st.target = null; st.cur = null; st.txt = t; if (onValue) onValue(null, null); return; }
      if (st.target === null) { st.parts = p; st.target = st.cur = p.v; st.txt = t; if (onValue) onValue(p.v, null); return; }
      if (p.v === st.target) { if (st.raf) write(render(st.cur)); return; }
      var from = st.cur, prev = st.target, delta = p.v - prev;
      cancel();
      st.parts = p; st.target = p.v;
      if (onValue) onValue(p.v, prev);
      flash(delta > 0 ? 'ui-up' : 'ui-down');
      floater(delta, p);
      if (reduced() || doc.hidden || Math.abs(p.v - from) < 1) { st.cur = p.v; st.txt = t; return; }
      var dur = Math.min(900, 420 + Math.abs(p.v - from) * 0.4), t0 = performance.now();
      write(render(from));
      var step = function (now) {
        var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        st.cur = from + (p.v - from) * e;
        if (k >= 1) { st.raf = 0; st.cur = p.v; write(t); return; }
        write(render(st.cur));
        st.raf = requestAnimationFrame(step);
      };
      st.raf = requestAnimationFrame(step);
    }
    obs.observe(node, { childList: true, characterData: true, subtree: true });
    if (node.textContent) handle(node.textContent);
    return { metric: metric, node: node, value: function () { return st.target; } };
  }

  function applyCashState() {
    if (!cashApi || !cashApi.metric) return;
    var v = cashApi.value();
    var danger = (v != null && v < 0) || Date.now() < lowUntil;
    cashApi.metric.classList.toggle('ui-danger', danger);
  }
  function setupMetrics() {
    cashApi = watchMetric('cash', '฿', function () { applyCashState(); });
    watchMetric('pop', '⌂', null);
    var ap = watchMetric('approval', '★', function (v) {
      if (!ap || !ap.metric || v == null) return;
      ap.metric.classList.toggle('ui-danger', v <= 20);
      ap.metric.classList.toggle('ui-warn', v > 20 && v <= 35);
    });
    if (ap && ap.value() != null) {
      var v0 = ap.value();
      ap.metric.classList.toggle('ui-danger', v0 <= 20);
      ap.metric.classList.toggle('ui-warn', v0 > 20 && v0 <= 35);
    }
    applyCashState();
  }

  /* swap animation for date / news text */
  function watchSwap(id) {
    var n = $(id);
    if (!n || !window.MutationObserver) return;
    var last = n.textContent;
    new MutationObserver(function () {
      var t = n.textContent;
      if (t === last) return;
      last = t;
      if (!reduced()) retrigger(n, 'ui-swap');
    }).observe(n, { childList: true, characterData: true, subtree: true });
  }

  /* toast: replay animation, classify warnings */
  var invalidAt = 0;
  var WARN_RE = /ไม่พอ|ไม่ได้|นอกเขต|ไม่มีอำนาจ|ถูกตัดสิทธิ์|ล้มเหลว|แพ้|ห่างถนน|ขาดไฟ|ไม่สำเร็จ/;
  function watchToast() {
    var t = $('toast');
    if (!t || !window.MutationObserver) return;
    var wasHidden = t.classList.contains('hide');
    new MutationObserver(function (recs) {
      var hidden = t.classList.contains('hide');
      var textChanged = recs.some(function (r) { return r.type === 'childList'; });
      var shown = wasHidden && !hidden;
      wasHidden = hidden;
      if (hidden || !(textChanged || shown)) return;
      var warn = WARN_RE.test(t.textContent) || (Date.now() - invalidAt < 500);
      t.classList.toggle('ui-warn', warn);
      if (!reduced()) retrigger(t, 'ui-pop');
    }).observe(t, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  /* play / pause state */
  function isPlaying() { var p = $('play'); return !!p && p.textContent.trim() !== '▶'; }
  function syncPlay() {
    var p = $('play'), hud = q('.hud');
    if (!p) return;
    var on = isPlaying();
    if (hud) hud.classList.toggle('ui-playing', on);
    p.setAttribute('aria-pressed', String(on));
  }
  function watchPlay() {
    var p = $('play');
    if (!p || !window.MutationObserver) return;
    new MutationObserver(syncPlay).observe(p, { childList: true, characterData: true, subtree: true });
    syncPlay();
  }

  /* ---------------- warnings (cash-low) ---------------- */
  var vignette = null, alertEl = null, alertT = 0, alertAt = 0;
  function showAlert(text) {
    if (!alertEl) {
      alertEl = h('div', { class: 'ui-alert', role: 'alert', hidden: true, title: 'แตะเพื่อปิด',
        onclick: function () { hideAlert(); } },
        h('span', { class: 'ui-alert-ico', 'aria-hidden': 'true', text: '!' }), h('span', { class: 'ui-alert-t' }));
      doc.body.append(alertEl);
    }
    q('.ui-alert-t', alertEl).textContent = text;
    alertEl.classList.remove('out');
    alertEl.hidden = false;
    retrigger(alertEl, 'in');
    clearTimeout(alertT);
    alertT = setTimeout(hideAlert, 5200);
  }
  function hideAlert() {
    if (!alertEl || alertEl.hidden) return;
    clearTimeout(alertT);
    if (reduced()) { alertEl.hidden = true; return; }
    alertEl.classList.add('out');
    var el = alertEl;
    setTimeout(function () { if (el.classList.contains('out')) { el.hidden = true; el.classList.remove('out'); } }, 420);
  }
  function cashLow() {
    lowUntil = Date.now() + 9000;
    applyCashState();
    clearTimeout(lowTimer);
    lowTimer = setTimeout(applyCashState, 9100);
    if (!reduced()) {
      if (!vignette) { vignette = h('div', { class: 'ui-vignette', 'aria-hidden': 'true' }); doc.body.append(vignette); }
      retrigger(vignette, 'on');
    }
    if (Date.now() - alertAt > 8000) {
      showAlert('เงินเทศบาลเหลือน้อย — ลองปรับภาษีที่สภาเมือง หรือหยุดก่อสร้างชั่วคราว');
    }
    alertAt = Date.now();
  }

  /* ---------------- dialogs (settings / help) ---------------- */
  var settingsDlg = null, helpDlg = null, settingsParts = null;
  function anyDialogOpen() { return !!q('dialog[open]') || !!tour; }
  function openUiDialog() {
    if (settingsDlg && settingsDlg.open) return settingsDlg;
    if (helpDlg && helpDlg.open) return helpDlg;
    return null;
  }
  function makeDialog(id, title) {
    var d = h('dialog', { class: 'ui-dlg', id: id, 'aria-labelledby': id + '-t' });
    d.append(
      h('button', { type: 'button', class: 'ui-close', 'aria-label': 'ปิด', text: '×', onclick: function () { d.close(); } }),
      h('h2', { id: id + '-t', text: title })
    );
    d.addEventListener('click', function (e) {
      if (e.target !== d) return;
      var r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    });
    doc.body.append(d);
    return d;
  }
  function showDlg(d) {
    if (!d || d.open) return;
    try { d.showModal(); } catch (e) { /* ignore */ }
  }

  function sliderRow(label, sub, key, first) {
    var val = h('span', { class: 'ui-val' });
    var input = h('input', { type: 'range', min: 0, max: 100, step: 1, class: 'ui-range', 'aria-label': label });
    var row = h('div', { class: 'ui-row' + (first ? ' first' : '') },
      h('span', null, h('span', { class: 'ui-lab', text: label }), h('span', { class: 'ui-sub', text: sub })),
      val, h('div', { class: 'ui-range-wrap' }, input));
    function paint() {
      var p = Math.round((audioSettings()[key] || 0) * 100);
      input.value = String(p); input.style.setProperty('--v', p + '%'); val.textContent = p + '%';
    }
    input.addEventListener('input', function () {
      setAudio(key, Number(input.value) / 100); paint();
    });
    input.addEventListener('change', function () {
      if (key !== 'sfx') return;
      try { var A = audio(); if (A && A.play) A.play('ui-click'); } catch (e) { /* ignore */ }
    });
    return { row: row, paint: paint };
  }
  function switchRow(label, sub, get, set) {
    var b = h('button', { type: 'button', class: 'ui-switch', role: 'switch', 'aria-label': label });
    function paint() { b.setAttribute('aria-checked', String(!!get())); }
    b.addEventListener('click', function () { set(!get()); paint(); });
    var row = h('div', { class: 'ui-row' },
      h('span', null, h('span', { class: 'ui-lab', text: label }), h('span', { class: 'ui-sub', text: sub })), b);
    return { row: row, paint: paint };
  }

  function buildSettings() {
    settingsDlg = makeDialog('ui-settings', 'ตั้งค่า');
    var music = sliderRow('เสียงดนตรี', 'ระดับเสียงดนตรีประกอบ', 'music', true);
    var sfx = sliderRow('เสียงเอฟเฟกต์', 'เสียงก่อสร้าง ปุ่มกด และการแจ้งเตือน', 'sfx');
    var mute = switchRow('ปิดเสียงทั้งหมด', 'ปิดทั้งดนตรีและเอฟเฟกต์ (ทางลัด M)', curMuted, setMuted);
    var motion = switchRow('ลดการเคลื่อนไหว', 'ปิดแอนิเมชันของเมนูและตัวเลข', function () { return prefs.reduce; }, function (v) {
      prefs.reduce = !!v; savePrefs(); root.classList.toggle('ui-reduce', prefs.reduce);
    });
    var note = h('p', { class: 'ui-note', hidden: true, text: 'ยังไม่พบระบบเสียงในหน้านี้ ค่าที่ตั้งไว้จะถูกจดจำและใช้เมื่อระบบเสียงพร้อม' });
    settingsDlg.append(music.row, sfx.row, mute.row, motion.row, note,
      h('div', { class: 'ui-actions' },
        h('button', { type: 'button', class: 'ui-btn is-primary', text: 'วิธีเล่น', onclick: function () { settingsDlg.close(); openTour(); } }),
        h('button', { type: 'button', class: 'ui-btn', text: 'ทางลัดคีย์บอร์ด', onclick: function () { settingsDlg.close(); openHelp(); } }),
        h('button', { type: 'button', class: 'ui-btn', text: 'ปิด', onclick: function () { settingsDlg.close(); } })));
    settingsParts = { music: music, sfx: sfx, mute: mute, motion: motion, note: note };
  }
  function syncSettings() {
    if (!settingsParts) return;
    settingsParts.music.paint(); settingsParts.sfx.paint();
    settingsParts.mute.paint(); settingsParts.motion.paint();
    settingsParts.note.hidden = !!audio();
  }
  function openSettings() {
    if (anyDialogOpen()) return;
    if (!settingsDlg) buildSettings();
    syncSettings();
    showDlg(settingsDlg);
  }

  var SHORTCUTS = [
    [['Space'], 'เดินเวลา / หยุดเวลา'], [['N'], 'ถัดไป 1 เดือน'], [['R'], 'หมุนกล้อง'],
    [['+', '−'], 'ซูมเข้า / ซูมออก'], [['H'], 'กลับกลางเมือง'], [['B'], 'เปิด / พับเมนูผังเมือง'],
    [['1–9'], 'เลือกสิ่งก่อสร้างตามลำดับ'], [['X'], 'โหมดทุบ / ขาย'], [['G'], 'สภาเมือง'],
    [['P'], 'การเมือง'], [['M'], 'ปิด / เปิดเสียง'], [[','], 'ตั้งค่า'],
    [['?'], 'หน้าต่างนี้'], [['Esc'], 'ปิดหน้าต่าง / ยกเลิกเครื่องมือ']
  ];
  function buildHelp() {
    helpDlg = makeDialog('ui-help', 'ทางลัดคีย์บอร์ด');
    var grid = h('div', { class: 'ui-keys' });
    SHORTCUTS.forEach(function (s) {
      grid.append(h('div', { class: 'ui-key' },
        h('span', { class: 'ui-kk' }, s[0].map(function (k) { return h('kbd', { text: k }); })),
        h('span', { text: s[1] })));
    });
    helpDlg.append(grid,
      h('div', { class: 'ui-actions' },
        h('button', { type: 'button', class: 'ui-btn is-primary', text: 'ดูวิธีเล่นอีกครั้ง', onclick: function () { helpDlg.close(); openTour(); } }),
        h('button', { type: 'button', class: 'ui-btn', text: 'ปิด', onclick: function () { helpDlg.close(); } })));
  }
  function openHelp() {
    if (anyDialogOpen()) return;
    if (!helpDlg) buildHelp();
    showDlg(helpDlg);
  }
  function toggleHelp() {
    if (helpDlg && helpDlg.open) helpDlg.close(); else openHelp();
  }

  /* ---------------- dock ---------------- */
  var muteBtn = null;
  function syncMute() {
    if (muteBtn) {
      var m = curMuted();
      muteBtn.classList.toggle('is-muted', m);
      muteBtn.setAttribute('aria-pressed', String(m));
    }
    if (settingsParts) settingsParts.mute.paint();
  }
  function buildDock() {
    if (q('.ui-dock')) return;
    muteBtn = h('button', { type: 'button', class: 'ui-fab', id: 'ui-mute', 'aria-label': 'เปิด/ปิดเสียง', title: 'เปิด/ปิดเสียง (M)', text: '♪', onclick: toggleMute });
    var set = h('button', { type: 'button', class: 'ui-fab', id: 'ui-settings-btn', 'aria-label': 'ตั้งค่า', title: 'ตั้งค่า (,)', text: '⚙', onclick: openSettings });
    var help = h('button', { type: 'button', class: 'ui-fab', id: 'ui-help-btn', 'aria-label': 'วิธีเล่นและทางลัด', title: 'ทางลัดคีย์บอร์ด (?)', text: '?', onclick: openHelp });
    doc.body.append(h('div', { class: 'ui-dock' }, muteBtn, set, help));
    syncMute();
  }

  /* ---------------- onboarding tour ---------------- */
  var tour = null;
  var STEPS = [
    { title: 'ยินดีต้อนรับสู่ปงยางคก', text: 'คุณคือผู้บริหารเมืองเล็ก ๆ ริมน้ำในล้านนา สร้างถนน บ้านเรือน ไร่นา และไฟฟ้าให้เมืองเติบโต แล้วนำผลงานไปขอเสียงจากประชาชนในการเลือกตั้ง', t: [] },
    { title: 'เลือกสิ่งที่จะสร้าง', text: 'เปิดผังเมืองเลือกหมวดและสิ่งก่อสร้าง (บนมือถือแตะปุ่ม ☷ ก่อสร้าง) แล้วแตะแปลงว่างบนแผนที่ ถนนต้องต่อถึงทางเข้าเมืองด้านตะวันตก และอาคารส่วนใหญ่ต้องติดถนน', t: ['#panel'], f: ['#unfold'] },
    { title: 'ดูแลคลังและความนิยม', text: 'เงินเทศบาล ประชากร และความนิยมแสดงอยู่ด้านบน ถ้าเงินใกล้หมดตัวเลขจะเป็นสีแดง ปรับภาษีและงบบริการได้ที่ปุ่ม “สภาเมือง”', t: ['#cash', '#pop', '#approval', '#gov'] },
    { title: 'เดินเวลา', text: 'กด ▶ ให้เวลาเดินเอง หรือกด “ถัดไป 1 เดือน” ทีละเดือน เมื่อเวลาผ่านไปเมืองจะมีรายได้และรายจ่าย', t: ['.hud'] },
    { title: 'มุมมองกล้อง', text: 'ลากแผนที่เพื่อเลื่อน เลื่อนล้อเมาส์หรือใช้ปุ่ม ＋ / − เพื่อซูม ⟳ หมุนกล้อง และ ⌖ พากลับกลางเมือง', t: ['.zoom'] },
    { title: 'เสียงจากชุมชนและการเมือง', text: 'ติดตามข่าวชุมชนด้านล่าง และเปิดเมนู “การเมือง” เพื่อลงพื้นที่หาเสียง ก่อนวันเลือกตั้งผลงานและความนิยมจะตัดสินว่าคุณชนะหรือไม่', t: ['.news'] },
    { title: 'พร้อมแล้ว!', text: 'กด ? เพื่อดูทางลัดคีย์บอร์ด หรือปุ่ม ⚙ เพื่อปรับเสียง เปิดคู่มือนี้ใหม่ได้ทุกเมื่อจากเมนูตั้งค่า', t: ['.ui-dock'] }
  ];
  function unionRect(sels) {
    var u = null;
    for (var i = 0; i < sels.length; i++) {
      var n = q(sels[i]);
      if (!n) continue;
      var r = n.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      var cs = window.getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      u = u ? { left: Math.min(u.left, r.left), top: Math.min(u.top, r.top), right: Math.max(u.right, r.right), bottom: Math.max(u.bottom, r.bottom) }
            : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }
    return u;
  }

  function openTour() {
    if (tour) return;
    var d = openUiDialog(); if (d) d.close();
    if (q('dialog[open]')) return; // a game dialog is open — don't stack
    var wasPlaying = isPlaying();
    if (wasPlaying) { var pb = $('play'); if (pb) pb.click(); }
    var prevFocus = doc.activeElement;
    var idx = 0;

    var spot = h('div', { class: 'ui-tour-spot none' });
    var stepEl = h('div', { class: 'ui-tour-step' });
    var title = h('h3', { id: 'ui-tour-t' });
    var body = h('p');
    var dots = h('div', { class: 'ui-dots' });
    STEPS.forEach(function () { dots.append(h('i')); });
    var skip = h('button', { type: 'button', class: 'ui-btn ui-skip', text: 'ข้าม' });
    var back = h('button', { type: 'button', class: 'ui-btn', text: 'ย้อนกลับ' });
    var next = h('button', { type: 'button', class: 'ui-btn is-primary', text: 'ถัดไป' });
    var card = h('div', { class: 'ui-tour-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ui-tour-t', tabindex: '-1' },
      stepEl, title, body, h('div', { class: 'ui-tour-foot' }, dots, skip, back, next));
    var wrap = h('div', { class: 'ui-tour' }, spot, card);
    doc.body.append(wrap);

    function place(rect) {
      var vw = window.innerWidth, vh = window.innerHeight, w = card.offsetWidth, ch = card.offsetHeight, m = 14;
      var L, T;
      function cx(x) { return Math.max(8, Math.min(vw - w - 8, x)); }
      function cy(y) { return Math.max(8, Math.min(vh - ch - 8, y)); }
      if (!rect) { L = (vw - w) / 2; T = (vh - ch) / 2; }
      else {
        var mx = (rect.left + rect.right) / 2, my = (rect.top + rect.bottom) / 2;
        var below = function () { return rect.bottom + m + ch <= vh - 8 ? [cx(mx - w / 2), rect.bottom + m] : null; };
        var above = function () { return rect.top - m - ch >= 8 ? [cx(mx - w / 2), rect.top - m - ch] : null; };
        var right = function () { return vw >= 720 && rect.right + m + w <= vw - 8 ? [rect.right + m, cy(my - ch / 2)] : null; };
        var left = function () { return vw >= 720 && rect.left - m - w >= 8 ? [rect.left - m - w, cy(my - ch / 2)] : null; };
        var tall = (rect.bottom - rect.top) > vh * 0.4 && (rect.right - rect.left) < vw * 0.5;
        var order = tall ? [right, below, above, left] : [below, above, right, left];
        for (var i = 0; i < order.length; i++) { var r = order[i](); if (r) { L = r[0]; T = r[1]; break; } }
        if (L == null) { L = (vw - w) / 2; T = vh - ch - 12; }
      }
      card.style.left = Math.round(L) + 'px';
      card.style.top = Math.round(T) + 'px';
    }
    function render(animate) {
      var s = STEPS[idx];
      stepEl.textContent = 'ขั้นที่ ' + (idx + 1) + ' / ' + STEPS.length;
      title.textContent = s.title; body.textContent = s.text;
      Array.prototype.forEach.call(dots.children, function (dEl, i) { dEl.classList.toggle('on', i === idx); });
      back.hidden = idx === 0;
      skip.hidden = idx === STEPS.length - 1;
      next.textContent = idx === STEPS.length - 1 ? 'เริ่มเล่น' : 'ถัดไป';
      if (animate && !reduced()) retrigger(card, 'swap');
      var rect = unionRect(s.t || []) || unionRect(s.f || []);
      if (rect) {
        var pad = 8;
        spot.classList.remove('none');
        spot.style.left = Math.round(rect.left - pad) + 'px';
        spot.style.top = Math.round(rect.top - pad) + 'px';
        spot.style.width = Math.round(rect.right - rect.left + pad * 2) + 'px';
        spot.style.height = Math.round(rect.bottom - rect.top + pad * 2) + 'px';
        place({ left: rect.left - pad, top: rect.top - pad, right: rect.right + pad, bottom: rect.bottom + pad });
      } else {
        spot.classList.add('none');
        spot.style.left = Math.round(window.innerWidth / 2) + 'px';
        spot.style.top = Math.round(window.innerHeight / 2) + 'px';
        spot.style.width = '0px'; spot.style.height = '0px';
        place(null);
      }
    }
    function close() {
      if (!tour) return;
      tour = null;
      prefs.tutorial = true; savePrefs();
      wrap.classList.add('out');
      setTimeout(function () { wrap.remove(); }, reduced() ? 0 : 260);
      try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) { /* ignore */ }
      if (wasPlaying && !isPlaying()) { var pb2 = $('play'); if (pb2) pb2.click(); }
    }
    function go(delta) {
      var n = idx + delta;
      if (n >= STEPS.length) return close();
      if (n < 0) return;
      idx = n; render(true);
    }
    skip.addEventListener('click', close);
    back.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    tour = { close: close, go: go, render: function () { render(false); }, card: card };
    render(false);
    try { next.focus(); } catch (e) { /* ignore */ }
  }

  /* ---------------- keyboard ---------------- */
  var swallowSpace = false;
  function press(id) {
    var n = $(id);
    if (!n || n.disabled) return false;
    n.click();
    n.classList.add('ui-kbd-press');
    setTimeout(function () { n.classList.remove('ui-kbd-press'); }, 160);
    return true;
  }
  function onKey(e) {
    if (e.key === 'Escape') {
      // Open <dialog>s handle Escape natively, which closes only the topmost one.
      if (tour && !q('dialog[open]')) { e.preventDefault(); e.stopImmediatePropagation(); tour.close(); }
      return;
    }
    if (tour) {
      // The tour is modal: keys never reach the map or game shortcuts.
      e.stopImmediatePropagation();
      if (e.key === 'ArrowRight') { e.preventDefault(); tour.go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); tour.go(-1); }
      else if (e.key === 'Tab') {
        var f = Array.prototype.filter.call(tour.card.querySelectorAll('button'), function (b) { return !b.hidden && !b.disabled; });
        if (f.length) {
          var i = f.indexOf(doc.activeElement), nx = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
          e.preventDefault(); f[nx].focus();
        }
      }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    var code = e.code;
    if ((code === 'Slash' && e.shiftKey) || e.key === '?') {
      if (helpDlg && helpDlg.open) { e.preventDefault(); helpDlg.close(); }
      else if (!anyDialogOpen()) { e.preventDefault(); openHelp(); }
      return;
    }
    if (anyDialogOpen()) return;
    var m = /^(?:Digit|Numpad)([1-9])$/.exec(code || '');
    if (m) {
      var items = doc.querySelectorAll('#items .item'), it = items[Number(m[1]) - 1];
      if (it) { e.preventDefault(); it.click(); }
      return;
    }
    switch (code) {
      case 'Space':
        if (e.repeat) { e.preventDefault(); return; }
        // A focused control keeps its native Space activation.
        if (t && t !== doc.body && t.closest && t.closest('button,a,input,select,textarea,summary,[role=button],[role=switch],[tabindex],#panel,.tools,dialog,.ui-dock')) return;
        if (press('play')) { e.preventDefault(); swallowSpace = true; }
        return;
      case 'KeyN': if (!e.repeat && press('next')) e.preventDefault(); return;
      case 'KeyR': if (!e.repeat && press('rotate')) e.preventDefault(); return;
      case 'KeyH': case 'Digit0': case 'Numpad0': if (!e.repeat && press('home')) e.preventDefault(); return;
      case 'Equal': case 'NumpadAdd': if (press('plus')) e.preventDefault(); return;
      case 'Minus': case 'NumpadSubtract': if (press('minus')) e.preventDefault(); return;
      case 'KeyB': if (!e.repeat) { var p = $('panel'); press(p && p.classList.contains('hide') ? 'unfold' : 'fold'); } return;
      case 'KeyX': if (!e.repeat && press('sellTool')) e.preventDefault(); return;
      case 'KeyG': if (!e.repeat && press('gov')) e.preventDefault(); return;
      case 'KeyP': if (!e.repeat && press('political')) e.preventDefault(); return;
      case 'KeyM': if (!e.repeat) { e.preventDefault(); toggleMute(); } return;
      case 'Comma': if (!e.repeat) { e.preventDefault(); openSettings(); } return;
      default: return;
    }
  }

  /* ---------------- game event bus ---------------- */
  window.addEventListener('pyk', function (ev) {
    var type = ev && ev.detail && ev.detail.type;
    if (type === 'cash-low') cashLow();
    else if (type === 'invalid') {
      invalidAt = Date.now();
      setTimeout(function () {
        var t = $('toast');
        if (t && !t.classList.contains('hide')) { t.classList.add('ui-warn'); if (!reduced()) retrigger(t, 'ui-pop'); }
      }, 0);
    } else if (type === 'play' || type === 'pause') syncPlay();
  });

  /* ---------------- init ---------------- */
  function init() {
    loadFonts();
    addTips();
    layout();
    setupMetrics();
    watchSwap('date');
    watchSwap('news');
    watchToast();
    watchPlay();
    buildDock();
    syncMute();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', function (e) {
      if (e.code === 'Space' && swallowSpace) { e.preventDefault(); swallowSpace = false; }
    }, true);
    window.addEventListener('resize', function () { layout(); if (tour) tour.render(); });
    if (window.ResizeObserver) {
      try { var ro = new ResizeObserver(layout); var hd = q('header'), hud = q('.hud'); if (hd) ro.observe(hd); if (hud) ro.observe(hud); } catch (e) { /* ignore */ }
    }
    window.addEventListener('load', function () { layout(); syncMute(); });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(layout).catch(function () {});
    if (!prefs.tutorial) setTimeout(function () { if (!prefs.tutorial && !q('dialog[open]')) openTour(); }, 700);
  }
  if (doc.body) init(); else doc.addEventListener('DOMContentLoaded', init);

  window.PykUI = { openSettings: openSettings, openHelp: openHelp, openTour: openTour };
})();
