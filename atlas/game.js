// The paper atlas: game logic, baking of paper pieces, input, sound.
'use strict';
(async () => {
  const Q = new URLSearchParams(location.search), G = window.GEO, FL = window.FLAGS, PAP = window.PAPERS, CAP = window.CAPITALS || {};
  const FREEZE = Q.has('t') ? parseFloat(Q.get('t')) : null;
  let windForce = Q.get('wind') === '1';
  const FONT = '"Baloo 2","Arial Rounded MT Bold","Helvetica Neue",Arial,sans-serif';
  const CITY_STATES = new Set(['SG', 'MC', 'SM']), STAR_MAX_W = 8.5, STAR_MIN_PX = 6, TAG_LINE1_HUD = 34 / 820 * 1000;
  const normSaint = s => String(s || '').replace(/\bSt\.\s+/g, 'Saint ');
  // batch 4: names that take "the" in a sentence (never on tags); Czechia, as the data names it, takes none
  const THE_IDS = new Set(['US', 'GB', 'NL', 'PH', 'BS', 'GM', 'MV', 'SC', 'SB', 'MH', 'KM', 'CF', 'DO', 'CD', 'AE']);
  const inSent = (c, start) => { const nm = normSaint(c && c.name); return c && (THE_IDS.has(c.id) || /^(Czech Republic|Netherlands|Philippines|Bahamas)$/.test(nm)) ? (start ? 'The ' : 'the ') + nm : nm; };
  if (document.fonts && document.fonts.load) document.fonts.load('800 40px "Baloo 2"').catch(() => { });
  // ---------- helpers ----------
  const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hs = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + (c || 0) * 2147483647) | 0; h = (h ^ h >>> 13) * 1274126177 | 0; return ((h ^ h >>> 16) >>> 0) / 4294967296; };
  const sid = s => { let h = 7; for (const ch of s) h = h * 31 + ch.charCodeAt(0) | 0; return h; };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const shade = (hex, d) => { const f = i => clamp(Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 + d) + d * 18), 0, 255); return `rgb(${f(1)},${f(3)},${f(5)})`; };
  const pipRing = (x, y, r) => { let inside = false; const n = r.length / 2; for (let i = 0, j = n - 1; i < n; j = i++) { const xi = r[i * 2], yi = r[i * 2 + 1], xj = r[j * 2], yj = r[j * 2 + 1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside; } return inside; };
  const pipPolys = (x, y, polys) => { let inside = false; for (const r of polys) if (pipRing(x, y, r)) inside = !inside; return inside; };
  const ringAbsArea = r => { let a = 0; const n = r.length / 2; for (let i = 0, j = n - 1; i < n; j = i++) a += r[j * 2] * r[i * 2 + 1] - r[i * 2] * r[j * 2 + 1]; return Math.abs(a) * 0.5; };
  const ringInteriorPt = r => {
    const n = r.length / 2;
    let sx = 0, sy = 0, y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < n; i++) { sx += r[i * 2]; sy += r[i * 2 + 1]; y0 = Math.min(y0, r[i * 2 + 1]); y1 = Math.max(y1, r[i * 2 + 1]); }
    sx /= n; sy /= n;
    if (pipRing(sx, sy, r)) return [sx, sy];
    const ym = (y0 + y1) * 0.5, xs = [];
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = r[i * 2], yi = r[i * 2 + 1], xj = r[j * 2], yj = r[j * 2 + 1];
      if ((yi > ym) !== (yj > ym)) xs.push(xi + (xj - xi) * (ym - yi) / (yj - yi));
    }
    xs.sort((a, b) => a - b);
    if (xs.length >= 2) return [(xs[0] + xs[1]) * 0.5, ym];
    return [r[0], r[1]];
  };
  const polyArea = c => {
    if (c._area !== undefined) return c._area;
    const polys = c.polys || [];
    let tot = 0;
    for (let i = 0; i < polys.length; i++) {
      const r = polys[i], a = ringAbsArea(r), pt = ringInteriorPt(r);
      let depth = 0;
      for (let j = 0; j < polys.length; j++) if (i !== j && pipRing(pt[0], pt[1], polys[j])) depth++;
      tot += (depth % 2 === 1) ? -a : a;
    }
    return (c._area = Math.max(1e-6, tot));
  };
  const compareSentence = (c1, c2) => {
    const a1 = polyArea(c1), a2 = polyArea(c2);
    const [A, B, big, small] = a1 >= a2 ? [c1, c2, a1, a2] : [c2, c1, a2, a1];
    const ratio = big / Math.max(1e-9, small);
    const nA = inSent(A, true), nB = inSent(B);
    if (ratio < 1.15) return `${nA} is about the same size as ${nB}`;
    if (ratio < 1.7) return `${nA} is a bit bigger than ${nB}`;
    if (ratio < 2.5) return `${nA} is about twice as big as ${nB}`;
    if (ratio > 1000) return `${nA} is more than 1,000 times as big as ${nB}`;
    const n = ratio <= 20 ? Math.round(ratio) : ratio <= 100 ? Math.round(ratio / 5) * 5 : Math.round(ratio / 50) * 50;
    if (n > 1000) return `${nA} is more than 1,000 times as big as ${nB}`;
    const nStr = n === 1000 ? '1,000' : String(n);
    return `${nA} is about ${nStr} times as big as ${nB}`;
  };
  const BACKING_BOX = [-70, -66, 2070, 1040];
  const R0 = rng(20261114);
  const LON0 = G.lon0, A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, MM = Math.sqrt(3) / 2, PS = 2000 / (2 * 2.7066297);
  const proj = (lon, lat) => { let l = lon - LON0; if (l < -180) l += 360; if (l > 180) l -= 360; const th = Math.asin(MM * Math.sin(lat * Math.PI / 180)), t2 = th * th, t6 = t2 * t2 * t2; return [1000 + (l * Math.PI / 180) * Math.cos(th) / (MM * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))) * PS, 487 - th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) * PS]; };
  const SEA = '#b5cfd0', PALE = '#e3d8bf', BLACK = '#0d0d0f', CREAM = '#efe8d8', INK = '#2a2a30';
  const B = GFX;
  const PHONE = Q.has('phone') ? Q.get('phone') !== '0' && Q.get('phone') !== 'false' : (window.matchMedia ? matchMedia('(pointer: coarse)').matches : false) && Math.min(screen.width, screen.height) < 500;
  const isPhonePortrait = () => PHONE && innerHeight > innerWidth;
  const edgeHud = px => px * 1000 / Math.max(1, innerHeight);
  const uiK = () => PHONE ? clamp(700 / Math.max(1, innerHeight), 1, 1.92) : 1;
  const tokHud = () => 74 * Math.min(uiK(), 1.8);
  const viewMetrics = () => { const r = B.cv.getBoundingClientRect(); return { iw: innerWidth, ih: innerHeight, cw: Math.round(r.width), ch: Math.round(r.height) }; };
  const vpStr = () => { const v = viewMetrics(); return `window ${v.iw}x${v.ih} canvas ${v.cw}x${v.ch}`; };
  const initDpr = Math.min(2, window.devicePixelRatio || 1), initPx = Math.round(innerWidth * initDpr) * Math.round(innerHeight * initDpr);
  if (initPx > 4500000) B.setScale(Math.max(0.5, Math.sqrt(4500000 / initPx)));
  B.resize();
  const devPerHud = () => Math.max(0.5, B.size()[1] / 1000);
  // ---------- state ----------
  let T = 0, frame = 0; const S = []; const tweens = []; let timers = [];
  const cam = { x: 1000, y: 487, h: 1160 }; let asp = innerWidth / innerHeight;
  const spr = (tex, o) => { const s = Object.assign({ tex, x: 0, y: 0, w: tex ? tex.w : 1, h: tex ? tex.h : 1, rot: 0, sc: 1, z: 0.2, zr: 0.03, lift: 0, hud: false, alpha: 1, reveal: 1, wake: -1, glow: 0, cells: 7, seed: R0() * 50, order: 10, flut: 0 }, o); S.push(s); return s; };
  const kill = s => { const i = S.indexOf(s); if (i >= 0) S.splice(i, 1); if (s && s.own) { s.own = false; B.freeTex(s.tex); } };
  const killTw = (o, keys) => { for (let i = tweens.length - 1; i >= 0; i--) { const q = tweens[i]; if (q.o === o && (!keys || keys.some(k => k in q.to))) tweens.splice(i, 1); } };
  const tw = (o, to, dur, opt = {}) => { if (opt.cut) killTw(o, Object.keys(to)); const dly = opt.delay || 0; const t0 = (!opt.smooth && !dly) ? Math.floor(T * 12) / 12 : T + dly; const t = { o, to, from: null, t0, dur, done: opt.done, sm: opt.smooth, tag: opt.tag }; tweens.push(t); return t; };
  const after = (d, fn, tag) => timers.push({ t: T + d, fn, tag });
  const w2h = (x, y) => [((x - cam.x) / (cam.h * asp) + 0.5) * 1000 * asp, ((y - cam.y) / cam.h + 0.5) * 1000];
  const h2w = (x, y) => [(x / (1000 * asp) - 0.5) * cam.h * asp + cam.x, (y / 1000 - 0.5) * cam.h + cam.y];
  const anchorDelta = c => c && c.c ? [c.c[0] - c.cx, c.c[1] - c.cy] : [0, 0];
  const anchorOf = s => { if (!s || !s.c) return [s.x, s.y]; const d = anchorDelta(s.c), co = Math.cos(s.rot), si = Math.sin(s.rot); return [s.x + (d[0] * co - d[1] * si) * s.sc, s.y + (d[0] * si + d[1] * co) * s.sc]; };
  // ---------- continents, rounds, cards ----------
  const CONTS = [
    { id: 'sa', name: 'South America', outlines: true }, { id: 'na', name: 'North America', outlines: true, rotate: true },
    { id: 'eu', name: 'Europe', outlines: true, rotate: true }, { id: 'af', name: 'Africa', outlines: true, rotate: true, memory: true },
    { id: 'as', name: 'Asia', outlines: true, rotate: true, memory: true, decoys: true }, { id: 'oc', name: 'Oceania', outlines: true, rotate: true, memory: true, decoys: true },
    { id: 'all', name: 'The whole world', rotate: true, memory: true, decoys: true }];
  const CI = {}; CONTS.forEach(c => CI[c.id] = c);
  const C = {}; G.countries = G.countries.filter(c => FL[c.id]); G.countries.forEach(c => { if (c.id === 'ST') c.name = 'São Tomé and Príncipe'; C[c.id] = c; c.cx = (c.bbox[0] + c.bbox[2]) / 2; c.cy = (c.bbox[1] + c.bbox[3]) / 2; c.bw = c.bbox[2] - c.bbox[0]; c.bh = c.bbox[3] - c.bbox[1]; c.built = false; });
  const WORLDSET = ['BR', 'CA', 'EG', 'IN', 'AU'].filter(i => C[i]);
  const OLD_ROUNDS = {};
  const nextRoundSize = n => { if (n <= 6) return n; if (n === 7) return 4; return Math.round(n / Math.ceil(n / 5.5)); };
  const splitRounds = list => { const out = []; for (let i = 0; i < list.length;) { const sz = nextRoundSize(list.length - i); out.push(list.slice(i, i + sz)); i += sz; } return out; };
  for (const ct of CONTS) {
    if (ct.id === 'all') { ct.region = [-40, -40, 2040, 1014]; ct.order = WORLDSET.map(i => C[i]); ct.rounds = [ct.order]; OLD_ROUNDS.all = ct.rounds; continue; }
    const L = G.countries.filter(c => c.cont === ct.id);
    L.forEach(c => { c.isCard = c.card !== undefined ? !!c.card : Math.sqrt(c.bw * c.bh) < 7 || Math.max(c.bw, c.bh) < 9.5 || (ct.id === 'oc' && Math.max(c.bw, c.bh) < 24); }); // geo.js card: fixed by the build (Kiribati's atoll chain; outlines from 1:10m keep their 1:50m status)
    const polyArea = pts => { let a = 0; for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) a += pts[j] * pts[i + 1] - pts[i] * pts[j + 1]; return Math.abs(a) * 0.5; };
    const r = [1e9, 1e9, -1e9, -1e9];
    const framed = L.filter(c => !c.isCard);
    (framed.length ? framed : L).forEach(c => {
      const pinfo = c.polys.map(p => {
        const pts = Array.isArray(p) ? p : (p.o || []);
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (let i = 0; i < pts.length; i += 2) { const x = pts[i], y = pts[i + 1]; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
        return { a: polyArea(pts), b: [x0, y0, x1, y1] };
      }).sort((a, b) => b.a - a.a);
      const mb = pinfo[0].b, ma = pinfo[0].a;
      for (const pi of pinfo) {
        const dx = Math.max(0, pi.b[0] - mb[2], mb[0] - pi.b[2]);
        const dy = Math.max(0, pi.b[1] - mb[3], mb[1] - pi.b[3]);
        if (pi.a < 2 && pi.a < ma * 0.01 && Math.hypot(dx, dy) > 60) continue;
        r[0] = Math.min(r[0], pi.b[0]); r[1] = Math.min(r[1], pi.b[1]); r[2] = Math.max(r[2], pi.b[2]); r[3] = Math.max(r[3], pi.b[3]);
      }
    });
    const px = (r[2] - r[0]) * 0.01 + 4, py = (r[3] - r[1]) * 0.01 + 4; r[0] -= px; r[1] -= py; r[2] += px; r[3] += py;
    ct.region = r;
    // old neighbour-chain round lists kept ONLY for migrating old round-count saves
    const lc = c => c.lc || [c.cx, c.cy]; // geo.js lc: the centre the old saves were made with (Kiribati moved in batch 3)
    const oldRest = L.slice().sort((a, b) => (lc(a)[0] + lc(a)[1]) - (lc(b)[0] + lc(b)[1])); const oldOrd = [oldRest.shift()];
    while (oldRest.length) { const p = oldOrd[oldOrd.length - 1]; let bi = 0, bd = 1e9; oldRest.forEach((c, i) => { const d = Math.hypot(lc(c)[0] - lc(p)[0], lc(c)[1] - lc(p)[1]); if (d < bd) { bd = d; bi = i; } }); oldOrd.push(oldRest.splice(bi, 1)[0]); }
    const ok = Math.max(1, Math.ceil(oldOrd.length / 5.4)); OLD_ROUNDS[ct.id] = []; for (let i = 0; i < ok; i++) OLD_ROUNDS[ct.id].push(oldOrd.slice(Math.round(i * oldOrd.length / ok), Math.round((i + 1) * oldOrd.length / ok)));
    // new deterministic easy-to-hard order: non-cards large-to-small, with inset-card countries spread through later rounds
    const nonCards = L.filter(c => !c.isCard).sort((a, b) => ((b.A || 0) - (a.A || 0)) || a.id.localeCompare(b.id));
    const cards = L.filter(c => c.isCard).sort((a, b) => ((b.A || 0) - (a.A || 0)) || a.id.localeCompare(b.id));
    const baseRounds = splitRounds(L);
    let ord;
    if (!cards.length) {
      ord = nonCards;
    } else {
      const nR = baseRounds.length, k = cards.length;
      const cap = k <= 2 * Math.max(1, nR - 2) ? 2 : 3;
      const numCardRounds = Math.min(nR, Math.max(k <= 3 ? k : Math.ceil(k / cap), Math.min(3, nR)));
      const cardCounts = new Array(nR).fill(0);
      let rem = k;
      for (let i = 0; i < numCardRounds && rem > 0; i++) {
        const rIdx = nR - 1 - i;
        const leftRounds = numCardRounds - i;
        cardCounts[rIdx] = Math.min(baseRounds[rIdx].length, Math.ceil(rem / leftRounds));
        rem -= cardCounts[rIdx];
      }
      ord = [];
      let ni = 0, ci = 0;
      for (let rIdx = 0; rIdx < nR; rIdx++) {
        const sz = baseRounds[rIdx].length, kc = cardCounts[rIdx], kn = sz - kc;
        for (let j = 0; j < kn; j++) ord.push(nonCards[ni++]);
        for (let j = 0; j < kc; j++) ord.push(cards[ci++]);
      }
    }
    ct.order = ord;
    ct.rounds = splitRounds(ord);
  }
  const TOKENS = ['boat', 'sun', 'cloud', 'tree', 'mountain', 'wave'];
  const V1_KEY = 'paper-atlas-v1', V2_KEY = 'paper-atlas-v2';
  if (Q.has('reset')) {
    try { localStorage.removeItem(V1_KEY); localStorage.removeItem(V2_KEY); } catch (e) { }
  }
  let storageOk = true, store = { v: 2, current: null, players: [] };
  const allowSave = Q.get('done') !== 'all';
  const LVL_Q = Q.get('level');
  const cleanName = s => String(s || '').replace(/[\r\n]/g, '').trim().slice(0, 12);
  const cleanLevel = l => l === 'help' ? 'help' : 'own';
  const cleanRec = raw => {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const id in raw) {
      if (!C[id] || id === 'AQ') continue;
      const r = raw[id];
      if (!r || typeof r !== 'object') continue;
      const w = Math.max(0, Math.floor(Number(r.w !== undefined ? r.w : r.wrongDrops) || 0));
      const t = Math.max(0, Number(r.t !== undefined ? r.t : r.lastPlaced) || 0);
      out[id] = { w, t };
    }
    return out;
  };
  const cleanPassShown = raw => {
    const out = [], seen = new Set();
    if (!Array.isArray(raw)) return out;
    for (const id of raw) {
      if (C[id] && id !== 'AQ' && !seen.has(id)) { seen.add(id); out.push(id); }
    }
    return out;
  };
  const cleanMail = raw => { // air mail: p.mail = { done: { <letter or chapter id>: { throws, express, wrapped } } }; a save without it loads as empty
    const done = {}, ids = new Set((window.MAIL_LETTERS || []).map(l => l.id)), src = raw && typeof raw === 'object' && raw.done && typeof raw.done === 'object' ? raw.done : {};
    for (const id in src) { const r = src[id]; if (!ids.has(id) || !r || typeof r !== 'object') continue; done[id] = { throws: Math.max(1, Math.floor(Number(r.throws) || 0)), express: !!r.express, wrapped: !!r.wrapped }; }
    return { done };
  };
  function migrateProg(raw) {
    if (!raw || typeof raw !== 'object') return { prog: { built: [], world: false }, changed: false };
    if (Array.isArray(raw.built)) {
      const seen = new Set(), built = [];
      for (const id of raw.built) if (C[id] && id !== 'AQ' && !seen.has(id)) { seen.add(id); built.push(id); }
      return { prog: { built, world: !!raw.world }, changed: false };
    }
    const seen = new Set(), built = [];
    for (const ct of CONTS) if (ct.id !== 'all') {
      const n = Math.min(Math.max(0, Number(raw[ct.id]) || 0), OLD_ROUNDS[ct.id].length);
      for (let r = 0; r < n; r++) for (const c of OLD_ROUNDS[ct.id][r]) if (!seen.has(c.id)) { seen.add(c.id); built.push(c.id); }
    }
    return { prog: { built, world: (Number(raw.all) || 0) >= 1 }, changed: true };
  }
  const nextId = () => { let n = 1; while (store.players.some(p => p.id === 'p' + n)) n++; return 'p' + n; };
  const mkPlayer = (token, name, progObj, level, recObj, shownArr) => ({ id: nextId(), token, name: cleanName(name), level: cleanLevel(level), prog: migrateProg(progObj).prog, rec: cleanRec(recObj), passShown: cleanPassShown(shownArr), created: Date.now() });
  const save = () => {
    if (!allowSave || !storageOk) return;
    try { localStorage.setItem(V2_KEY, JSON.stringify(store)); } catch (e) { storageOk = false; }
  };
  (() => {
    try {
      const raw2 = localStorage.getItem(V2_KEY);
      if (raw2 !== null) {
        const d = JSON.parse(raw2);
        if (d && d.v === 2 && Array.isArray(d.players)) {
          const seenTok = new Set(); let migrated = false;
          for (const p of d.players) {
            if (!p || !TOKENS.includes(p.token) || seenTok.has(p.token) || store.players.length >= 6) continue;
            seenTok.add(p.token);
            const mp = migrateProg(p.prog); if (mp.changed || !p.level) migrated = true;
            store.players.push({ id: String(p.id || nextId()), token: p.token, name: cleanName(p.name), level: cleanLevel(p.level), prog: mp.prog, rec: cleanRec(p.rec), passShown: cleanPassShown(p.passShown), created: Number(p.created) || Date.now(), mail: cleanMail(p.mail) }); // air mail: mail kept
          }
          store.current = store.players.some(p => p.id === d.current) ? d.current : null;
          if (migrated) save();
          return;
        }
      }
      const raw1 = localStorage.getItem(V1_KEY);
      if (raw1 !== null) {
        let p1 = {}; try { const parsed = JSON.parse(raw1); if (parsed && typeof parsed === 'object') p1 = parsed; } catch (e) { p1 = {}; }
        const mp = mkPlayer('boat', '', p1, 'own');
        store.players.push(mp); store.current = mp.id;
        save();
      }
    } catch (e) {
      storageOk = false;
      const mp = mkPlayer('boat', '', null, 'own');
      store = { v: 2, current: mp.id, players: [mp] };
    }
  })();
  if (Q.has('player')) {
    const tok = Q.get('player').toLowerCase();
    if (TOKENS.includes(tok)) {
      let p = store.players.find(q => q.token === tok);
      if (!p && store.players.length < 6) { p = mkPlayer(tok, '', null, 'own'); store.players.push(p); }
      if (p) { store.current = p.id; save(); }
    }
  }
  if (store.players.length === 1 && !store.current) store.current = store.players[0].id;
  const currentPlayer = () => store.players.find(p => p.id === store.current) || null;
  const playerLevel = (p = currentPlayer()) => (LVL_Q === 'own' || LVL_Q === 'help') ? LVL_Q : cleanLevel(p && p.level);
  let ephProg = { built: [], world: false }, ephPassShown = [], justAddedStickers = false;
  let prog = currentPlayer() ? currentPlayer().prog : ephProg;
  if (Q.get('done') === 'all') { prog = { built: G.countries.map(c => c.id), world: true }; }
  const isBuiltId = (pr, id) => !!(pr && Array.isArray(pr.built) && pr.built.includes(id));
  const getPassShown = (p = currentPlayer()) => (Q.get('done') === 'all') ? G.countries.map(c => c.id) : (p ? (p.passShown || (p.passShown = [])) : ephPassShown);
  const unseenStickers = (p = currentPlayer()) => {
    if (Q.get('done') === 'all') return [];
    const pr = p ? p.prog : prog;
    if (!pr || !Array.isArray(pr.built)) return [];
    const shown = new Set(getPassShown(p));
    return pr.built.filter(id => C[id] && id !== 'AQ' && !shown.has(id));
  };
  const markPassShown = (ids, p = currentPlayer()) => {
    if (Q.get('done') === 'all' || !ids || !ids.length) return;
    const arr = getPassShown(p);
    let changed = false;
    for (const id of ids) if (C[id] && id !== 'AQ' && !arr.includes(id)) { arr.push(id); changed = true; }
    if (changed) save();
  };
  const contUnbuilt = (ct, pr = prog) => ct.id === 'all' ? (pr && pr.world ? [] : ct.order) : ct.order.filter(c => !isBuiltId(pr, c.id));
  const contDone = (ct, pr = prog) => ct.id === 'all' ? !!(pr && pr.world) : contUnbuilt(ct, pr).length === 0;
  const nextCont = (pr = prog) => CONTS.find(c => !contDone(c, pr));
  const nextRoundList = ct => { const u = contUnbuilt(ct); return u.slice(0, nextRoundSize(u.length)); };
  // ---------- paper bakes ----------
  const ring = (ctx, f, ox, oy, k) => { ctx.moveTo((f[0] - ox) * k, (f[1] - oy) * k); for (let i = 2; i < f.length; i += 2) ctx.lineTo((f[i] - ox) * k, (f[i + 1] - oy) * k); ctx.closePath(); };
  const land = (() => { const c = document.createElement('canvas'); c.width = 1000; c.height = 487; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); for (const cc of G.countries) for (const r of cc.polys) ring(x, r, 0, 0, 0.5); for (const r of G.neutral) ring(x, r, 0, 0, 0.5); ring(x, G.aq, 0, 0, 0.5); x.fill('evenodd'); x.lineWidth = 6; x.strokeStyle = '#fff'; x.stroke(); const d = x.getImageData(0, 0, 1000, 487).data; return (px, py) => { const i = clamp(Math.round(px / 2), 0, 999), j = clamp(Math.round(py / 2), 0, 486); return d[(j * 1000 + i) * 4 + 3] > 40; }; })();
  // batch 4b: a strip cut by hand with scissors: each side is one to four straight cuts that change angle a little, corners a little
  // off square (the HUD labels, the picker's labels, the world-view tag and the passport's tabs)
  const cutEdge = (x0, y0, x1, y1, a, seed) => ctx => {
    const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map((q, i) => [q[0] + (hs(i, seed, 11) - 0.5) * a, q[1] + (hs(i, seed, 12) - 0.5) * a]), P = [];
    for (let i = 0; i < 4; i++) {
      const p = c[i], q = c[(i + 1) % 4], len = Math.max(1e-3, Math.hypot(q[0] - p[0], q[1] - p[1])), n = clamp(Math.round(len / (a * 7)), 1, 4), nx = -(q[1] - p[1]) / len, ny = (q[0] - p[0]) / len;
      P.push(p);
      for (let j = 1; j < n; j++) { const u = (j + (hs(j, seed + i * 7, 13) - 0.5) * 0.6) / n, o = (hs(j, seed + i * 7, 14) - 0.5) * a * 0.5; P.push([p[0] + (q[0] - p[0]) * u + nx * o, p[1] + (q[1] - p[1]) * u + ny * o]); }
    }
    ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath();
  };
  const wob = (x0, y0, x1, y1, a, seed) => ctx => { const p = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; p.forEach((q, i) => { q[0] += (hs(i, seed, 1) - 0.5) * a; q[1] += (hs(i, seed, 2) - 0.5) * a; }); ctx.moveTo(p[0][0], p[0][1]); for (let i = 0; i < 4; i++) { const q = p[(i + 1) % 4], o = p[i], mx = (q[0] + o[0]) / 2 + (hs(i, seed, 3) - 0.5) * a * 0.6, my = (q[1] + o[1]) / 2 + (hs(i, seed, 4) - 0.5) * a * 0.6; ctx.quadraticCurveTo(mx, my, q[0], q[1]); } ctx.closePath(); };
  function bakeBase(reg, ppu, ct) { // backing, sea, waves, pencil, pale land
    const b = B.bake((reg[2] - reg[0]) * ppu, (reg[3] - reg[1]) * ppu); b.s = ppu;
    for (const x of [b.c, b.g]) { x.setTransform(ppu, 0, 0, ppu, -reg[0] * ppu, -reg[1] * ppu); }
    B.paper(b, wob(-70, -66, 2070, 1040, 7, 1), BLACK, 0.0);
    B.paper(b, wob(-26, -24, 2026, 998, 9, 2), SEA, 0.34);
    // pencil guide lines on the sea sheet
    const c = b.c; c.lineCap = 'round';
    const pencil = (pts, a, w) => { c.strokeStyle = `rgba(70,74,88,${a})`; c.lineWidth = w; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); };
    for (const lat of [-23.4, 0, 23.4]) { const pts = []; for (let lo = -168; lo <= 191; lo += 6) pts.push(proj(lo, lat)); pencil(pts, lat ? 0.13 : 0.2, 0.5); }
    for (const lo of [-120, -60, 0, 60, 120]) { const pts = []; for (let la = -80; la <= 82; la += 6) pts.push(proj(lo, la)); pencil(pts, 0.11, 0.5); }
    // cut waves
    const wr = rng(77); for (let y = 6; y < 980; y += 27) for (let x = -8 + ((y / 27) % 2) * 23; x < 2010; x += 46) {
      const jx = x + (wr() - 0.5) * 16, jy = y + (wr() - 0.5) * 9, sk = wr(), l = 9 + wr() * 9; if (sk < 0.52 || jx < reg[0] - 30 || jx > reg[2] + 30 || jy < reg[1] - 20 || jy > reg[3] + 20) continue;
      if (land(jx - l, jy) || land(jx + l, jy) || land(jx, jy - 5) || land(jx, jy + 5) || jx < -8 || jx > 2008 || jy < -6 || jy > 980) continue;
      const path = q => { q.moveTo(jx - l, jy); q.quadraticCurveTo(jx - l / 2, jy - 3.4 - sk * 2, jx, jy); if (sk > 0.72) q.quadraticCurveTo(jx + l / 2, jy + 3.4, jx + l, jy - 0.5); };
      for (const [q, st] of [[b.c, '#101012'], [b.g, B.grey(0.02)]]) { q.strokeStyle = st; q.lineWidth = (ct ? 0.5 : 0.85) + sk * 0.3; q.lineCap = 'round'; q.beginPath(); path(q); q.stroke(); }
      if (sk > 0.86) for (let k = 0; k < 3; k++) for (const [q, st] of [[b.c, '#101012'], [b.g, B.grey(0.02)]]) { q.fillStyle = st; q.beginPath(); q.arc(jx - 5 + k * 5, jy + 6.5, ct ? 0.6 : 0.85, 0, 7); q.fill(); }
    }
    // pale land: one sheet, then pencil borders (filtered to region for speed on zoomed tiles)
    const visC = G.countries.filter(cc => cc.bbox[2] >= reg[0] - 8 && cc.bbox[0] <= reg[2] + 8 && cc.bbox[3] >= reg[1] - 8 && cc.bbox[1] <= reg[3] + 8);
    const hasAq = reg[3] > 800;
    const all = q => { for (const cc of visC) for (const r of cc.polys) ring(q, r, 0, 0, 1); for (const r of G.neutral) ring(q, r, 0, 0, 1); if (hasAq) ring(q, G.aq, 0, 0, 1); };
    c.fillStyle = PALE; c.strokeStyle = PALE; c.lineWidth = 0.7; c.lineJoin = 'round'; c.beginPath(); all(c); c.fill('evenodd'); c.stroke();
    b.g.fillStyle = B.grey(0.66); b.g.strokeStyle = B.grey(0.66); b.g.lineWidth = 0.5; b.g.beginPath(); all(b.g); b.g.fill('evenodd'); b.g.stroke();
    for (const cc of visC) { const d = (hs(sid(cc.id), 3) - 0.5) * 0.05; c.fillStyle = shade(PALE, d); c.beginPath(); for (const r of cc.polys) ring(c, r, 0, 0, 1); c.fill('evenodd'); }
    c.fillStyle = shade(PALE, -0.035); c.beginPath(); for (const r of G.neutral) ring(c, r, 0, 0, 1); c.fill();
    for (const cc of visC) { const co = CI[cc.cont]; if (!co.outlines) continue; for (let pass = 0; pass < 2; pass++) { c.strokeStyle = `rgba(72,74,86,${pass ? 0.3 : 0.5})`; c.lineWidth = pass ? 0.3 : 0.42; c.setLineDash(pass ? [] : [7, 0.6, 3, 0.4]); c.beginPath(); for (const r of cc.polys) ring(c, r, pass * 0.25, -pass * 0.2, 1); c.stroke(); } c.setLineDash([]); }
    return B.tex(b);
  }
  function patchwork(b, w, h, seed, colourAt, s, o, sr = 1, capTex = 0) { // capTex (batch 4): texture px that make 2.5 screen px when re-baked for a close zoom; 0 = no cap
    const R = rng(seed), th = (R() - 0.5) * 0.9, co = Math.cos(th), si = Math.sin(th), cx = w / 2, cy = h / 2, n = Math.ceil(Math.hypot(w, h) / s / 2) + 1;
    const P = (i, j) => { const u = (i + (hs(i, j, seed) - 0.5) * 0.52) * s, v = (j + (hs(i + 91, j + 17, seed) - 0.5) * 0.52) * s; return [cx + u * co - v * si, cy + u * si + v * co]; };
    const c = b.c, g = b.g;
    for (let j = -n; j < n; j++) for (let i = -n; i < n; i++) {
      const q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]; const mx = (q[0][0] + q[2][0]) / 2, my = (q[0][1] + q[2][1]) / 2; if (mx < -s || my < -s || mx > w + s || my > h + s) continue;
      let pcs = [q]; const sp = R(); if (sp < 0.16) pcs = [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]; else if (sp < 0.3) { const a = [lerp(q[0][0], q[1][0], 0.4 + R() * 0.2), lerp(q[0][1], q[1][1], 0.5)], d = [lerp(q[3][0], q[2][0], 0.4 + R() * 0.2), lerp(q[3][1], q[2][1], 0.5)]; pcs = [[q[0], a, d, q[3]], [a, q[1], q[2], d]]; }
      for (const pc of pcs) {
        const ccx = pc.reduce((a, p) => a + p[0], 0) / pc.length, ccy = pc.reduce((a, p) => a + p[1], 0) / pc.length, gap0 = Math.min(3.2 * sr, s * 0.045 + 0.7 * sr) + R() * 0.8 * sr, gap = capTex ? Math.min(gap0, capTex * 0.5) : gap0; // two insets make the black gap
        const pp = pc.map(p => { const d = Math.hypot(p[0] - ccx, p[1] - ccy) || 1; return [p[0] + (ccx - p[0]) * gap / d * 1.4, p[1] + (ccy - p[1]) * gap / d * 1.4]; });
        const path = x => { x.beginPath(); x.moveTo(pp[0][0], pp[0][1]); for (let k = 1; k < pp.length; k++) x.lineTo(pp[k][0], pp[k][1]); x.closePath(); };
        const rel = 0.3 + R() * 0.45; c.fillStyle = shade(colourAt(ccx / w, ccy / h, R), (R() - 0.5) * 0.1); path(c); c.fill(); g.fillStyle = B.grey(rel); path(g); g.fill();
        if (o) { const ov = Math.round((0.08 + hs(Math.round(ccx * 3), Math.round(ccy * 3), seed + 7) * 0.88) * 255); o.fillStyle = o.strokeStyle = `rgb(${ov},${ov},${ov})`; o.lineWidth = 2 * sr; path(o); o.fill(); o.stroke(); }
        const m = R(), ang = Math.atan2(pp[1][1] - pp[0][1], pp[1][0] - pp[0][0]);
        if (m < 0.42 && pc.length === 4) { // cut marks: dots, dash, square
          // batch 4 correction B: at a close zoom each mark (a dot, the dash, the square) is drawn 7 screen px on its longer side (capTex is 2.5 screen px in texture px),
          // never larger than it was before batch 4 (scale 1); the 2.5 px cap applies to the gaps only
          const longSide = m < 0.2 ? 2 * (s * 0.052 + 0.5 * sr) : m < 0.32 ? s * 0.34 : s * 0.15; // each dot, the dash, the square
          const mk = capTex ? Math.min(1, 7 * capTex / 2.5 / longSide) : 1;
          for (const [x, st] of [[c, '#0b0b0d'], [g, B.grey(0.0)]]) { x.save(); x.translate(ccx, ccy); x.rotate(ang); x.scale(mk, mk); x.fillStyle = st;
            if (m < 0.2) { const k = m < 0.1 ? 3 : 2; for (let d = 0; d < k; d++) { x.beginPath(); x.arc((d - (k - 1) / 2) * s * 0.2, 0, s * 0.052 + 0.5 * sr, 0, 7); x.fill(); } }
            else if (m < 0.32) x.fillRect(-s * 0.17, -s * 0.035 - 0.4 * sr, s * 0.34, s * 0.07 + 0.8 * sr); else x.fillRect(-s * 0.075, -s * 0.075, s * 0.15, s * 0.15);
            x.restore(); }
        }
        const e = R(); if (e < 0.12) { const v = pp[(R() * pp.length) | 0]; g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(v[0], v[1], 0, v[0], v[1], s * 0.55); gr.addColorStop(0, 'rgba(70,70,70,1)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gr; path(g); g.fill(); g.globalCompositeOperation = 'source-over'; }
        else if (e < 0.19) { g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgb(26,26,26)'; g.lineWidth = 1.6 * sr; g.beginPath(); g.moveTo(pp[0][0], pp[0][1]); g.quadraticCurveTo(ccx + (R() - 0.5) * s * 0.5, ccy + (R() - 0.5) * s * 0.5, pp[2][0], pp[2][1]); g.stroke(); g.globalCompositeOperation = 'source-over'; }
        else if (e < 0.3) { const v = pp[0], u = pp[1], d = Math.hypot(u[0] - v[0], u[1] - v[1]) || 1; c.strokeStyle = 'rgba(8,8,10,0.75)'; c.lineWidth = capTex ? Math.min(0.8 * sr, capTex * 0.5) : 0.8 * sr; c.beginPath(); c.moveTo(u[0], u[1]); c.lineTo(u[0] + (u[0] - v[0]) / d * s * 0.22, u[1] + (u[1] - v[1]) / d * s * 0.22); c.stroke(); }
      }
    }
  }
  function bakeCountry(c, reqPpu, scrPpu = 0) { // scrPpu (batch 4): screen px per unit when re-baked for a zoom closer than the continent frame
    const md = Math.max(c.bw, c.bh);
    if (!c.basePpu) {
      let bp = clamp(540 / md, 3.4, c.isCard ? 420 : 46);
      if (md * bp > 2300) bp = 2300 / md;
      c.basePpu = bp; c.padW = 3 / bp;
      c.cellW = Math.max(12 / bp, clamp((c.cellSize || Math.sqrt(c.bw * c.bh)) / 3.6, 0, c.id === 'AQ' ? 60 : 38));
    }
    const maxPpu = (4096 - 16) / Math.max(c.bw + 2 * c.padW, c.bh + 2 * c.padW);
    const ppu = clamp(reqPpu || c.basePpu, c.basePpu, maxPpu);
    if (c.tex && Math.abs(ppu - (c.ppu || 0)) < 0.05 && (c.capScr || 0) === scrPpu) return false;
    c.capScr = scrPpu;
    const pad = Math.max(3, Math.round(c.padW * ppu));
    const polys = c.id === 'AQ' ? [G.aq] : c.polys;
    const b = B.bake(c.bw * ppu + pad * 2, c.bh * ppu + pad * 2);
    const oc = document.createElement('canvas'); oc.width = Math.max(2, Math.ceil(b.w / 2)); oc.height = Math.max(2, Math.ceil(b.h / 2));
    const ox = oc.getContext('2d'); ox.save(); ox.scale(oc.width / b.w, oc.height / b.h);
    // Clip only g (alpha/height) and ox (reveal order) to country silhouette; leave b.c unclipped so edge filters never pull exterior darks
    for (const x of [b.g, ox]) {
      if (x !== ox) x.save();
      x.translate(pad, pad); x.beginPath(); for (const r of polys) ring(x, r, c.bbox[0], c.bbox[1], ppu); x.clip('evenodd'); x.translate(-pad, -pad);
    }
    b.c.fillStyle = '#0b0b0d'; b.c.fillRect(0, 0, b.w, b.h); b.g.fillStyle = B.grey(0); b.g.fillRect(0, 0, b.w, b.h);
    ox.fillStyle = 'rgb(8,8,8)'; ox.fillRect(0, 0, b.w, b.h);
    const f = FL[c.of ? c.of.id : c.id]; let colAt; // c.of: extra land of a country (its flag papers); c.paper: a territory (one paper)
    if (c.paper) colAt = () => c.paper;
    else if (!f) colAt = () => '#f4f1ea';
    else colAt = (u, v, R) => { let k = parseInt(f.grid[clamp(Math.floor(v * 8), 0, 7) * 12 + clamp(Math.floor(u * 12), 0, 11)], 16); if (k > 11 || R() < 0.1) { let t = R(), i = 0; for (; i < f.cols.length - 1; i++) { t -= f.cols[i][1]; if (t <= 0) break; } k = f.cols[i][0]; } return PAP[k]; };
    patchwork(b, b.w, b.h, sid(c.id), colAt, ppu * c.cellW, ox, ppu / c.basePpu, scrPpu > 0 ? 2.5 * ppu / scrPpu : 0);
    b.g.restore(); ox.restore();
    const oldTex = c.tex;
    c.tex = B.tex(b); c.tex.ord = B.ordTex(oc);
    c.ppu = ppu; c.tw = b.w / ppu; c.th = b.h / ppu; c.highRes = ppu > c.basePpu * 1.05;
    if (oldTex) {
      if (csp[c.id]) { csp[c.id].tex = c.tex; csp[c.id].w = c.tw; csp[c.id].h = c.th; }
      if (RD && RD.piece && RD.piece.c === c) { RD.piece.tex = c.tex; RD.piece.w = c.tw; RD.piece.h = c.th; }
      if (RD && RD.ghost && RD.ghost.tex === oldTex) { RD.ghost.tex = c.tex; RD.ghost.w = c.tw; RD.ghost.h = c.th; }
      if (RD && RD.cardLanded && RD.cardLanded.c === c) { RD.cardLanded.tex = c.tex; RD.cardLanded.w = c.tw; RD.cardLanded.h = c.th; }
      for (const s of S) if (s.tex === oldTex && s.c === c) { s.tex = c.tex; s.w = c.tw; s.h = c.th; }
      B.freeTex(oldTex);
    }
    return true;
  }
  await Promise.all(Object.keys(FL).flatMap(id => FL[id].parts.filter(p => p.img).map(p => new Promise(res => { const im = new Image(); im.onload = im.onerror = res; im.src = p.img; p.im = im; }))));
  const jit = (x, y) => [(hs(Math.round(x * 997), Math.round(y * 991), 5) - 0.5) * 0.012, (hs(Math.round(x * 997), Math.round(y * 991), 6) - 0.5) * 0.012];
  const pbox = p => { if (p.k === 'sticker') return [p.x, p.y, p.x + p.w, p.y + p.h]; const r = [9, 9, -9, -9]; for (const q of p.polys) for (let i = 0; i < q.p.length; i += 2) { r[0] = Math.min(r[0], q.p[i]); r[1] = Math.min(r[1], q.p[i + 1]); r[2] = Math.max(r[2], q.p[i]); r[3] = Math.max(r[3], q.p[i + 1]); } return r; };
  // batch 4: the flag data keeps a disc or crescent as 30-40 traced corners (build.mjs simplifies the traced outline with a 1.2 px
  // Douglas-Peucker tolerance), and each corner used to get its own hand-cut jitter, so round parts showed corners at table size.
  // Curved runs (turns under ~35 degrees between short edges) are now drawn as a smooth curve through the data points, resampled
  // every ~2 px at the bake size, without jitter; real corners (star tips, crescent cusps, stripe ends, the flag's edge) stay cut.
  const cutPts = (q, a, k) => {
    if (q._cut && q._cut.k === k) return q._cut.pts;
    let p = q.p;
    if (!q._dp) { // the traced data keeps pixel steps on diagonals (Brazil's diamond, triangles): a 0.005 flag-height pass straightens them
      const m = p.length / 2, P = i => [p[(i % m) * 2], p[(i % m) * 2 + 1]];
      let far = 0, fd = 0; for (let i = 1; i < m; i++) { const d = (p[i * 2] - p[0]) ** 2 + (p[i * 2 + 1] - p[1]) ** 2; if (d > fd) { fd = d; far = i; } }
      const keep = new Uint8Array(m + 1); keep[0] = keep[far] = keep[m] = 1;
      const st = [[0, far], [far, m]];
      while (st.length) { const [a0, b0] = st.pop(); const A = P(a0), Bq = P(b0), dx = Bq[0] - A[0], dy = Bq[1] - A[1], L = Math.hypot(dx, dy) || 1e-9; let md = 0, mi = -1;
        for (let i = a0 + 1; i < b0; i++) { const Q = P(i), d = Math.abs((Q[0] - A[0]) * dy - (Q[1] - A[1]) * dx) / L; if (d > md) { md = d; mi = i; } }
        if (md > 0.005 && mi > 0) { keep[mi] = 1; st.push([a0, mi], [mi, b0]); } }
      const o = []; for (let i = 0; i < m; i++) if (keep[i]) o.push(p[i * 2], p[i * 2 + 1]);
      q._dp = o.length >= 6 ? o : p;
    }
    p = q._dp;
    const n = p.length / 2, out = [];
    const onE = i => { const x = p[i * 2], y = p[i * 2 + 1]; return x < 0.004 || y < 0.004 || x > a - 0.004 || y > 0.996; };
    const V = i => { i = ((i % n) + n) % n; return [p[i * 2], p[i * 2 + 1]]; };
    if (n < 6) { for (let i = 0; i < n; i++) out.push([p[i * 2], p[i * 2 + 1], !onE(i)]); q._cut = { k, pts: out }; return out; }
    const len = [], corner = [];
    for (let i = 0; i < n; i++) { const A = V(i), Bv = V(i + 1); len.push(Math.hypot(Bv[0] - A[0], Bv[1] - A[1])); }
    for (let i = 0; i < n; i++) {
      const A = V(i - 1), Bv = V(i), Cv = V(i + 1), ux = Bv[0] - A[0], uy = Bv[1] - A[1], vx = Cv[0] - Bv[0], vy = Cv[1] - Bv[1];
      const turn = Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy));
      corner.push(onE(i) || turn > 0.62 || len[(i - 1 + n) % n] < 1e-5 || len[i] < 1e-5);
    }
    const straight = i => (corner[i] && corner[(i + 1) % n]) || len[i] > 0.2 || (onE(i) && onE((i + 1) % n));
    const tan = i => { // unit tangent at a smooth vertex (Bessel: each edge direction weighted by the other edge's length)
      const im = (i - 1 + n) % n, A = V(i - 1), Bv = V(i), Cv = V(i + 1), L1 = len[im] || 1e-9, L2 = len[i] || 1e-9;
      const sIn = straight(im), sOut = straight(i);
      let tx, ty;
      if (sIn && !sOut) { tx = (Bv[0] - A[0]) / L1; ty = (Bv[1] - A[1]) / L1; }
      else if (sOut && !sIn) { tx = (Cv[0] - Bv[0]) / L2; ty = (Cv[1] - Bv[1]) / L2; }
      else { tx = (Bv[0] - A[0]) / L1 * L2 + (Cv[0] - Bv[0]) / L2 * L1; ty = (Bv[1] - A[1]) / L1 * L2 + (Cv[1] - Bv[1]) / L2 * L1; }
      const d = Math.hypot(tx, ty) || 1; return [tx / d, ty / d];
    };
    for (let i = 0; i < n; i++) {
      const P0 = V(i), P1 = V(i + 1), L = len[i], j1 = (i + 1) % n;
      out.push([P0[0], P0[1], corner[i] && !onE(i)]);
      if (straight(i) || L * k < 3) continue;
      const c0 = corner[i] || (straight((i - 1 + n) % n) && straight(i)), c1 = corner[j1] || (straight(i) && straight(j1));
      let M0 = c0 ? null : tan(i).map(v => v * L), M1 = c1 ? null : tan(j1).map(v => v * L);
      const dx = P1[0] - P0[0], dy = P1[1] - P0[1];
      if (!M0 && !M1) continue;
      if (!M0) M0 = [(3 * dx - M1[0]) / 2, (3 * dy - M1[1]) / 2]; // natural end at a cusp
      if (!M1) M1 = [(3 * dx - M0[0]) / 2, (3 * dy - M0[1]) / 2];
      const m = clamp(Math.ceil(L * k / 2), 2, 32);
      for (let s = 1; s < m; s++) {
        const t = s / m, t2 = t * t, t3 = t2 * t, h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
        out.push([h00 * P0[0] + h10 * M0[0] + h01 * P1[0] + h11 * M1[0], h00 * P0[1] + h10 * M0[1] + h01 * P1[1] + h11 * M1[1], false]);
      }
    }
    q._cut = { k, pts: out }; return out;
  };
  function drawPart(b, p, k, ox, oy, rel, a) {
    if (p.k === 'sticker') { if (!p.im || !p.im.width) return; const x = (p.x - ox) * k, y = (p.y - oy) * k, w = p.w * k, h = p.h * k;
      const sw = Math.max(1, Math.ceil(w)), sh = Math.max(1, Math.ceil(h)); // the raw sticker is scaled down once to the size it is drawn at (cached on the part), not redrawn full size each time
      if (!p.scaled || p.scaled.width !== sw || p.scaled.height !== sh) { p.scaled = document.createElement('canvas'); p.scaled.width = sw; p.scaled.height = sh; p.scaled.getContext('2d').drawImage(p.im, 0, 0, sw, sh); }
      b.c.drawImage(p.scaled, x, y, w, h); const t = document.createElement('canvas'); t.width = sw; t.height = sh; const tx = t.getContext('2d'); tx.drawImage(p.scaled, 0, 0); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = B.grey(rel); tx.fillRect(0, 0, sw, sh); b.g.drawImage(t, x, y, w, h); return; }
    for (const q of p.polys) { const pts = cutPts(q, a, k); B.paper(b, x => { for (let i = 0; i < pts.length; i++) { const [px, py, jt] = pts[i]; const j = jt ? jit(px, py) : [0, 0]; const X = (px + j[0] - ox) * k, Y = (py + j[1] - oy) * k; i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.closePath(); }, shade(PAP[q.c], (hs(sid(p.k), q.c, Math.round(q.p[0] * 50)) - 0.5) * 0.05), rel); }
  }
  function partTex(f, p, k) { const r = pbox(p), pad = 3 / k; const b = B.bake((r[2] - r[0]) * k + 6, (r[3] - r[1]) * k + 6); drawPart(b, p, k, r[0] - pad, r[1] - pad, 0.5, f.a); return { tex: B.tex(b), cx: (r[0] + r[2]) / 2, cy: (r[1] + r[3]) / 2, w: r[2] - r[0] + 2 * pad, h: r[3] - r[1] + 2 * pad }; }
  function flagTex(id, k) { const f = FL[id]; f.tex = f.tex || {}; if (f.tex[k]) return f.tex[k]; const pad = 3 / k, b = B.bake(f.a * k + 6, k + 6); f.parts.forEach((p, i) => drawPart(b, p, k, -pad, -pad, Math.min(0.95, 0.2 + i * 0.12), f.a)); return f.tex[k] = B.tex(b); }
  function textTex(str, hudPx, o = {}) {
    const sc = o.scale || 1, px = hudPx * sc;
    const s = str || '';
    const m = document.createElement('canvas').getContext('2d'); m.font = `800 ${px}px ${FONT}`; const chars = [...s];
    const ws = chars.length ? chars.map(ch => m.measureText(ch).width + px * 0.035) : [px * 0.4];
    const tw_ = Math.max((o.minW || 0) * sc, ws.reduce((a, b) => a + b, 0)), padx = o.strip ? px * 0.5 : px * 0.15, pady = o.strip ? px * 0.2 : px * 0.1;
    const b = B.bake(tw_ + padx * 2, px * 1.25 + pady * 2); const sd = sid(s || '_') + (o.seed || 0);
    const mg = Math.max(2, Math.round(2 * sc), o.cut ? Math.ceil(px * 0.09) : 0);
    if (o.strip) B.paper(b, (o.cut ? cutEdge : wob)(mg, mg, b.w - mg, b.h - mg, px * 0.14, sd), o.strip, 0.15);
    let x = padx + (o.center ? (tw_ - ws.reduce((a, b) => a + b, 0)) / 2 : 0); chars.forEach((ch, i) => { const cw = ws[i]; if (ch !== ' ') for (const [q, st] of [[b.c, shade(o.col || CREAM, (hs(i, sd, 1) - 0.5) * 0.07)], [b.g, B.grey(0.75 + hs(i, sd, 2) * 0.2)]]) { q.save(); q.font = `800 ${px}px ${FONT}`; q.textAlign = 'center'; q.textBaseline = 'alphabetic'; q.translate(x + cw / 2, pady + px * 0.98 + (hs(i, sd, 3) - 0.5) * px * 0.07); q.rotate((hs(i, sd, 4) - 0.5) * 0.11); q.fillStyle = st; q.fillText(ch, 0, 0); if (q === b.c) { q.strokeStyle = st; q.lineWidth = Math.max(1, sc); q.strokeText(ch, 0, 0); } q.restore(); } x += cw; });
    const t = B.tex(b, { noMip: !!o.noMip }); t.lw = b.w / sc; t.lh = b.h / sc; return t;
  }
  const shapeTex = (w, h, fn, opt) => { const b = B.bake(w, h); fn(b); return B.tex(b, opt); };
  const STAR_FILL = 128 / 160;
  const starPath = (cx, cy, ro, ri) => q => {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 === 0) ? ro : ri;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) q.moveTo(x, y); else q.lineTo(x, y);
    }
    q.closePath();
  };
  const starTex = shapeTex(160, 160, b => { B.paper(b, starPath(80, 80, 64, 27), PAP[5], 0.72); });
  function nameTagTex(c, basePx) {
    const cap = CAP[c.id];
    const s1 = normSaint(c.name);
    if (!cap) {
      const t = textTex(s1, basePx, { strip: CREAM, col: INK });
      t.hRatio = 1;
      t.pxFrac = 1 / 1.65;
      t.h1Frac = 1.15 / 1.65;
      t.h2Frac = 0;
      t.px2Frac = 0;
      t.capRatio = 0;
      return t;
    }
    const px = basePx, px2 = Math.max(24, Math.round(px * 0.78)), s2 = normSaint(cap.name);
    const m = document.createElement('canvas').getContext('2d');
    m.font = `800 ${px}px ${FONT}`;
    const c1 = [...s1], w1s = c1.map(ch => m.measureText(ch).width + px * 0.035), w1 = w1s.reduce((a, b) => a + b, 0);
    m.font = `800 ${px2}px ${FONT}`;
    const c2 = [...s2], w2s = c2.map(ch => m.measureText(ch).width + px2 * 0.035);
    const starR = px2 * 0.44, starGap = px2 * 0.34, starW = starR * 2 + starGap;
    const w2 = starW + w2s.reduce((a, b) => a + b, 0);
    const tw_ = Math.max(w1, w2), padx = px * 0.5, pady = px * 0.22, lineGap = px * 0.14;
    const h1 = px * 1.15, h2 = px2 * 1.15;
    const b = B.bake(tw_ + padx * 2, pady * 2 + h1 + lineGap + h2);
    const sd = sid(s1 + '|' + s2), mg = 2;
    B.paper(b, wob(mg, mg, b.w - mg, b.h - mg, px * 0.14, sd), CREAM, 0.15);
    const drawWord = (chars, ws, fpx, x0, yBase, seedOff) => {
      let x = x0;
      chars.forEach((ch, i) => {
        const cw = ws[i];
        if (ch !== ' ') for (const [q, st] of [[b.c, shade(INK, (hs(i, sd + seedOff, 1) - 0.5) * 0.07)], [b.g, B.grey(0.75 + hs(i, sd + seedOff, 2) * 0.2)]]) {
          q.save(); q.font = `800 ${fpx}px ${FONT}`; q.textAlign = 'center'; q.textBaseline = 'alphabetic';
          q.translate(x + cw / 2, yBase + (hs(i, sd + seedOff, 3) - 0.5) * fpx * 0.07);
          q.rotate((hs(i, sd + seedOff, 4) - 0.5) * 0.11);
          q.fillStyle = st; q.fillText(ch, 0, 0);
          if (q === b.c) { q.strokeStyle = st; q.lineWidth = 1; q.strokeText(ch, 0, 0); }
          q.restore();
        }
        x += cw;
      });
    };
    drawWord(c1, w1s, px, (b.w - w1) * 0.5, pady + px * 0.94, 0);
    const x2 = (b.w - w2) * 0.5;
    B.paper(b, starPath(x2 + starR, pady + h1 + lineGap + h2 * 0.52, starR, starR * 0.42), PAP[5], 0.65);
    drawWord(c2, w2s, px2, x2 + starW, pady + h1 + lineGap + px2 * 0.90, 31);
    const t = B.tex(b);
    t.hRatio = b.h / (px * 1.65);
    t.pxFrac = px / b.h;
    t.px2Frac = px2 / b.h;
    t.h1Frac = h1 / b.h;
    t.h2Frac = h2 / b.h;
    t.capRatio = px2 / px;
    return t;
  }
  function drawToken(b, tok, cx, cy, sc) {
    const P = (fn, col, rel) => B.paper(b, x => { x.save(); x.translate(cx, cy); x.scale(sc, sc); fn(x); x.restore(); }, col, rel);
    if (tok === 'boat') {
      P(x => { x.moveTo(-42, 16); x.lineTo(42, 14); x.lineTo(28, 38); x.lineTo(-28, 39); x.closePath(); }, PAP[2], 0.42);
      P(x => { x.moveTo(-2, -40); x.lineTo(2, 11); x.lineTo(34, 8); x.closePath(); }, PAP[0], 0.72);
      P(x => { x.moveTo(-8, -28); x.lineTo(-6, 11); x.lineTo(-34, 9); x.closePath(); }, PAP[5], 0.62);
    } else if (tok === 'sun') {
      for (let i = 0; i < 10; i++) P(x => { const a = i / 10 * 6.283; x.moveTo(Math.cos(a) * 44, Math.sin(a) * 44); x.lineTo(Math.cos(a + 0.19) * 25, Math.sin(a + 0.19) * 25); x.lineTo(Math.cos(a - 0.19) * 25, Math.sin(a - 0.19) * 25); x.closePath(); }, PAP[4], 0.36);
      P(x => x.arc(0, 0, 25, 0, 7), PAP[5], 0.72);
    } else if (tok === 'cloud') {
      P(x => { x.moveTo(-34, 24); x.bezierCurveTo(-48, 22, -44, -4, -22, 0); x.bezierCurveTo(-20, -28, 12, -32, 20, -10); x.bezierCurveTo(38, -16, 48, 24, 28, 24); x.closePath(); }, PAP[8], 0.42);
      P(x => { x.moveTo(-26, 20); x.bezierCurveTo(-36, 18, -32, -2, -14, 2); x.bezierCurveTo(-12, -20, 14, -22, 20, -4); x.bezierCurveTo(32, -8, 38, 20, 24, 20); x.closePath(); }, PAP[0], 0.74);
    } else if (tok === 'tree') {
      P(x => { x.moveTo(-8, 12); x.lineTo(8, 12); x.lineTo(10, 40); x.lineTo(-10, 40); x.closePath(); }, PAP[3], 0.35);
      P(x => { x.moveTo(0, -42); x.lineTo(34, 2); x.lineTo(-34, 2); x.closePath(); }, PAP[7], 0.52);
      P(x => { x.moveTo(0, -24); x.lineTo(38, 20); x.lineTo(-38, 20); x.closePath(); }, PAP[6], 0.74);
    } else if (tok === 'mountain') {
      P(x => { x.moveTo(-42, 34); x.lineTo(10, -34); x.lineTo(44, 34); x.closePath(); }, PAP[10], 0.42);
      P(x => { x.moveTo(-44, 34); x.lineTo(-14, -22); x.lineTo(20, 34); x.closePath(); }, PAP[9], 0.6);
      P(x => { x.moveTo(10, -34); x.lineTo(22, -10); x.lineTo(10, -4); x.lineTo(0, -12); x.closePath(); }, PAP[0], 0.8);
      P(x => { x.moveTo(-14, -22); x.lineTo(-4, -5); x.lineTo(-14, 0); x.lineTo(-22, -6); x.closePath(); }, PAP[0], 0.82);
    } else if (tok === 'wave') {
      P(x => { x.moveTo(-42, 32); x.lineTo(-42, 8); x.bezierCurveTo(-24, -24, 10, -38, 30, -18); x.bezierCurveTo(42, -4, 34, 14, 16, 12); x.bezierCurveTo(6, 10, 8, -2, 16, -2); x.bezierCurveTo(4, -12, -16, -2, -14, 18); x.lineTo(42, 16); x.lineTo(42, 32); x.closePath(); }, PAP[11], 0.55);
      P(x => { x.moveTo(-42, 34); x.quadraticCurveTo(-10, 14, 16, 26); x.quadraticCurveTo(30, 32, 42, 22); x.lineTo(42, 38); x.lineTo(-42, 38); x.closePath(); }, PAP[8], 0.76);
      P(x => { x.moveTo(16, -24); x.quadraticCurveTo(36, -24, 36, -4); x.quadraticCurveTo(28, 6, 18, 2); x.quadraticCurveTo(24, -12, 10, -14); x.closePath(); }, PAP[0], 0.86);
    }
  }
  const tokTex = {};
  TOKENS.forEach(tok => { tokTex[tok] = shapeTex(240, 240, b => drawToken(b, tok, 120, 120, 2.15)); });
  const playerBtnTex = (tok, sc = devPerHud()) => {
    const L = tokHud(), px = Math.max(96, Math.round(L * sc)), k = px / 124;
    const t = shapeTex(px, px, b => {
      B.paper(b, cutEdge(5 * k, 5 * k, px - 5 * k, px - 5 * k, 7 * k, sid(tok)), CREAM, 0.25);
      drawToken(b, tok, px * 0.5, px * 0.5, 0.96 * k);
    }, { noMip: true });
    t.lw = L; t.lh = L; return t;
  };
  // ---------- static scene ----------
  const flat = shapeTex(8, 8, b => B.paper(b, x => x.rect(-2, -2, 12, 12), '#fff', 0.5));
  spr(flat, { x: 1000, y: 1000, w: 9000, h: 7000, z: 0.0, zr: 0, order: -10, tint: [0.80, 0.74, 0.65] }); // table
  const WREG = [-76, -72, 2076, 1046];
  const wbasePpu = 1.9;
  const wbase = spr(bakeBase(WREG, wbasePpu, null), { x: 1000, y: 487, w: 2152, h: 1118, z: 0.045, zr: 0.11, order: 0 });
  let cbase = null, cbaseFor = null, cbasePpu = 1.9, cbaseZoom = null;
  const desk = spr(shapeTex(1200, 760, b => { B.paper(b, wob(8, 8, 1192, 752, 14, 9), BLACK, 0.2); const c = b.c; c.strokeStyle = 'rgba(200,200,215,0.10)'; c.lineWidth = 1; for (let i = 1; i < 8; i++) { c.beginPath(); c.moveTo(i * 150, 14); c.lineTo(i * 150 + 4, 746); c.stroke(); } }), { x: 1000, y: 1700, w: 800, h: 506, z: 0.045, zr: 0.05, order: 0 });
  // B2: separate crisp cut-paper scrap sprites around the cutting mat (convex hulls, >= 2x screen res)
  function convexHull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
    lo.pop(); hi.pop(); return lo.concat(hi);
  }
  const scraps = (() => {
    const Rs = rng(51), list = [], zones = [
      [1158, 1632, 1212, 1756, 13],
      [848, 1628, 888, 1662, 3],
      [1164, 1784, 1212, 1838, 3]
    ];
    for (const [x0, y0, x1, y1, count] of zones) {
      let tries = 0, made = 0;
      while (made < count && tries++ < 300) {
        const cx = lerp(x0, x1, Rs()), cy = lerp(y0, y1, Rs()), r = 4.5 + Rs() * 5.2;
        if (list.some(o => Math.hypot(o.x - cx, o.y - cy) < o.r + r + 3.2)) continue;
        const nPts = 6 + (Rs() * 4 | 0), pts = [], rot0 = Rs() * 6.283;
        for (let k = 0; k < nPts; k++) {
          const an = rot0 + k / nPts * 6.283 + (Rs() - 0.5) * 0.45, rr = r * (0.62 + Rs() * 0.52);
          pts.push([Math.cos(an) * rr, Math.sin(an) * rr]);
        }
        const hull = convexHull(pts); if (hull.length < 3) continue;
        let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
        for (const [px, py] of hull) { bx0 = Math.min(bx0, px); by0 = Math.min(by0, py); bx1 = Math.max(bx1, px); by1 = Math.max(by1, py); }
        const ppu = 18, padW = 0.8, w = (bx1 - bx0) + padW * 2, h = (by1 - by0) + padW * 2;
        const col = shade(PAP[(Rs() * 12) | 0], (Rs() - 0.5) * 0.08), rel = 0.5 + Rs() * 0.4;
        const t = shapeTex(w * ppu, h * ppu, b => {
          b.s = ppu;
          B.paper(b, q => hull.forEach(([px, py], i) => {
            const sx = (px - bx0 + padW) * ppu, sy = (py - by0 + padW) * ppu;
            i ? q.lineTo(sx, sy) : q.moveTo(sx, sy);
          }), col, rel);
        });
        const sp = spr(t, { x: cx, y: cy, w, h, z: 0.068, zr: 0.025, order: 25, rot: (Rs() - 0.5) * 0.4 });
        list.push({ x: cx, y: cy, r, s: sp }); made++;
      }
    }
    return list;
  })();
  for (const o of scraps) { o.s.own = true; kill(o.s); } // batch 4: replaced by each flag table's own offcuts (tableLayout)
  // accents: boats, clouds, sun
  const boatT = shapeTex(120, 110, b => { B.paper(b, x => { x.moveTo(12, 72); x.lineTo(108, 70); x.lineTo(90, 98); x.lineTo(28, 99); x.closePath(); }, PAP[2], 0.4); B.paper(b, x => { x.moveTo(60, 8); x.lineTo(63, 66); x.lineTo(98, 63); x.closePath(); }, PAP[0], 0.7); B.paper(b, x => { x.moveTo(54, 20); x.lineTo(55, 66); x.lineTo(24, 64); x.closePath(); }, PAP[5], 0.6); });
  const cloudT = shapeTex(220, 120, b => B.paper(b, x => { x.moveTo(30, 96); x.bezierCurveTo(-6, 92, 6, 52, 40, 58); x.bezierCurveTo(40, 22, 92, 10, 108, 44); x.bezierCurveTo(126, 22, 172, 30, 168, 62); x.bezierCurveTo(214, 56, 220, 100, 186, 98); x.closePath(); }, '#f4f1ea', 0.6));
  const sunT = shapeTex(200, 200, b => { for (let i = 0; i < 12; i++) B.paper(b, x => { const a = i / 12 * 6.283, a2 = a + 0.15, a3 = a - 0.15; x.moveTo(100 + Math.cos(a) * 94, 100 + Math.sin(a) * 94); x.lineTo(100 + Math.cos(a2) * 58, 100 + Math.sin(a2) * 58); x.lineTo(100 + Math.cos(a3) * 58, 100 + Math.sin(a3) * 58); x.closePath(); }, PAP[4], 0.35); B.paper(b, x => x.arc(100, 100, 50, 0, 7), PAP[5], 0.7); });
  const birdT = shapeTex(60, 36, b => B.paper(b, x => { x.moveTo(2, 8); x.quadraticCurveTo(18, 4, 30, 18); x.quadraticCurveTo(42, 4, 58, 8); x.quadraticCurveTo(42, 14, 30, 32); x.quadraticCurveTo(18, 14, 2, 8); x.closePath(); }, '#f4f1ea', 0.6));
  const mkRibbonPath = (pts, halfW) => q => {
    const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len, w = halfW[i];
      L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
      R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
    }
    q.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < L.length; i++) q.lineTo(L[i][0], L[i][1]);
    for (let i = R.length - 1; i >= 0; i--) q.lineTo(R[i][0], R[i][1]);
    q.closePath();
  };
  const mkWindCurlTex = (flipY, seed) => shapeTex(360, 170, b => {
    const pts = [], hw = [];
    for (let i = 0; i <= 26; i++) {
      const u = i / 26;
      const x = 14 + u * 256;
      const y = (flipY ? 70 : 102) + (flipY ? 1 : -1) * Math.sin(u * Math.PI * 1.1) * 20;
      pts.push([x, y]);
      hw.push(2.5 + Math.sin(u * Math.PI) * 8.5 + u * 3.0);
    }
    const cx = 274, cy = flipY ? 106 : 64;
    for (let i = 1; i <= 26; i++) {
      const u = i / 26;
      const ang = (flipY ? -Math.PI * 0.5 : Math.PI * 0.5) + (flipY ? 1 : -1) * u * Math.PI * 2.15;
      const rad = 42 * (1 - 0.56 * u);
      pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
      hw.push(Math.max(2.2, 6.2 * (1 - 0.65 * u)));
    }
    B.paper(b, mkRibbonPath(pts, hw), shade('#f4f1ea', (hs(seed, 1, 1) - 0.5) * 0.04), 0.72);
  });
  const windCurlT = [mkWindCurlTex(false, 11), mkWindCurlTex(true, 23), mkWindCurlTex(false, 37)];
  const waveT = shapeTex(120, 48, b => {
    B.paper(b, x => {
      x.moveTo(8, 28);
      x.quadraticCurveTo(32, 8, 60, 24);
      x.quadraticCurveTo(86, 36, 112, 20);
      x.quadraticCurveTo(86, 44, 56, 32);
      x.quadraticCurveTo(30, 18, 8, 28);
      x.closePath();
    }, '#15181f', 0.45);
    B.paper(b, x => x.arc(58, 13, 4.2, 0, 7), '#f4f1ea', 0.68);
  });
  const acc = [];
  const addAcc = (t, lon, lat, w, kind) => { const p = proj(lon, lat); const s = spr(t, { x: p[0], y: p[1], w, h: w * t.h / t.w, z: kind === 'cloud' ? 0.36 : 0.2, zr: 0.03, order: kind === 'cloud' ? 60 : 8 }); s.kind = kind; s.bx = p[0]; s.by = p[1]; s.ph = R0() * 9; acc.push(s); };
  addAcc(boatT, -128, -22, 30, 'boat'); addAcc(boatT, -28, -30, 26, 'boat'); addAcc(boatT, 78, -30, 28, 'boat'); addAcc(boatT, -40, 36, 22, 'boat'); addAcc(boatT, 160, 22, 24, 'boat');
  addAcc(sunT, -138, 26, 62, 'sun'); addAcc(cloudT, -60, 52, 80, 'cloud'); addAcc(cloudT, 88, -52, 90, 'cloud'); addAcc(cloudT, -150, -48, 70, 'cloud');
  // Cut-paper sea-wave crests placed in open ocean pockets so they bob gently and lean with gusts
  const seaWaves = [];
  (() => {
    const rw = rng(20261115);
    const waveSeeds = [
      [-105, -24], [-92, -38], [-115, -6], [-96, 10], [-74, 18], [-64, 24], [-42, 20], [-22, -16], [-18, -34], [-10, 42], [-22, 54], [-30, 62],
      [6, 36], [16, 35], [26, 34], [62, -14], [76, -22], [90, -10], [88, 6], [116, -24], [134, -18], [148, -36], [158, -10], [168, -28],
      [-50, -42], [-16, -46], [38, -42], [108, -44], [140, 20], [156, 32], [-145, -28], [-152, 8], [-134, 38], [174, 6]
    ];
    for (const [lo, la] of waveSeeds) {
      const p = proj(lo, la);
      if (p[0] < 18 || p[0] > 1982 || p[1] < 18 || p[1] > 940) continue;
      if (land(p[0], p[1]) || land(p[0] - 11, p[1]) || land(p[0] + 11, p[1]) || land(p[0], p[1] - 6) || land(p[0], p[1] + 6)) continue;
      const w = 15 + rw() * 7;
      const s = spr(waveT, { x: p[0], y: p[1], w, h: w * waveT.h / waveT.w, z: 0.09, zr: 0.025, order: 6 });
      s.bx = p[0]; s.by = p[1]; s.ph = rw() * 9;
      seaWaves.push(s);
    }
  })();
  // ---------- HUD ----------
  // batch 4b: every HUD label is a strip of cut paper with a hand-cut edge, thickness and shadow. Light paper and dark ink for what the
  // game says (title, hint line); coloured paper for what a child can tap (buttons). Each strip lies a little askew, no two alike, at
  // most 2 degrees. The player token stays whole during a round: a tap on it only wobbles it (2-3 frames at 12 fps).
  const HUD_PAPER = '#f3eee2', DEG = Math.PI / 180;
  const HUD_TILT = { title: -1.3, hint: -0.45, token: -1.8, sound: 1.4, passport: -0.85, world: 1.1, hintBtn: -1.55, undo: 0.3, zoomOut: 1.8, zoomIn: -0.6 };
  const BTN_INK = { undo: CREAM, zoomIn: CREAM, zoomOut: CREAM };
  let hintS = null, hintTxt = '', lastHudDevH = B.size()[1];
  const titleTex = sc => textTex('The paper atlas', 58 * 0.9, { strip: HUD_PAPER, col: INK, cut: true, scale: sc, noMip: true });
  const hintTex = (t, sc) => textTex(t, 38 * 0.86 * Math.min(uiK(), 1.35), { strip: CREAM, col: INK, cut: true, seed: 5, scale: sc, noMip: true });
  const mkTitle = () => { const t = titleTex(devPerHud()); const s = spr(t, { hud: true, z: 0.1, zr: 0.03, order: 200 }); s.bw = s.w = t.lw; s.bh = s.h = t.lh; s.tilt = HUD_TILT.title * DEG; return s; };
  const title = mkTitle();
  const pBtnTex = {};
  const bakePBtn = () => { const sc = devPerHud(); TOKENS.forEach(tok => { if (pBtnTex[tok]) B.freeTex(pBtnTex[tok]); pBtnTex[tok] = playerBtnTex(tok, sc); }); };
  bakePBtn();
  const playerBtn = spr(pBtnTex.boat, { hud: true, z: 0.1, zr: 0.03, order: 200, alpha: 0 });
  playerBtn.bw = playerBtn.w = tokHud(); playerBtn.bh = playerBtn.h = tokHud(); playerBtn.tilt = HUD_TILT.token * DEG;
  function updateHudToken() {
    const L = tokHud();
    playerBtn.bw = playerBtn.w = L; playerBtn.bh = playerBtn.h = L;
    const p = currentPlayer();
    if (!p) { playerBtn.alpha = 0; return; }
    playerBtn.tex = pBtnTex[p.token] || pBtnTex.boat;
    playerBtn.alpha = 1;
  }
  // a small paper wobble: three stop-motion frames at 12 fps, then still (a tap that does nothing else)
  const WOB_ROT = [0.075, -0.055, 0.025], WOB_LIFT = [0.14, 0.08, 0.03];
  const startWobble = s => { s.wob = T; }; // frames of 1/12 s from the tap
  const wobbleRot = s => {
    if (s.wob === undefined) return 0;
    const f = Math.floor((T - s.wob) * 12 + 1e-6);
    if (f > 2) { s.wob = undefined; s.lift = 0; return 0; }
    s.lift = WOB_LIFT[Math.max(0, f)]; return WOB_ROT[Math.max(0, f)];
  };
  function setHint(t) { if (Q.has('vp')) t = vpStr(); if (t === hintTxt) return; hintTxt = t; if (hintS) { hintS.own = true; kill(hintS); } const tx = hintTex(t, devPerHud()); hintS = spr(tx, { hud: true, z: 0.1, zr: 0.03, order: 200 }); hintS.bw = hintS.w = tx.lw; hintS.bh = hintS.h = tx.lh; hintS.tilt = HUD_TILT.hint * DEG; hintS.rot = hintS.tilt; hintS.lift = 0.12; tw(hintS, { lift: 0 }, 0.25, { cut: true }); }
  const btn = {}, btnMeta = {};
  const isZoomBtn = id => id === 'zoomIn' || id === 'zoomOut';
  const zoomBtnHud = () => Math.max(64, (PHONE ? 48 : 46) * 1000 / Math.max(1, innerHeight)); // the + and - buttons: at least 44 px on screen
  const zoomBtnTex = (id, colr, sc) => {
    const L = zoomBtnHud(), W = Math.round(L * sc), k = W / L;
    const t = shapeTex(W, W, b => {
      B.paper(b, cutEdge(5 * k, 5 * k, W - 5 * k, W - 5 * k, 6 * k, sid(id)), colr, 0.2);
      const c = W / 2, a = L * 0.27 * k, th = L * 0.075 * k, bar = (x0, y0, x1, y1, sd) => B.paper(b, cutEdge(x0, y0, x1, y1, 2.4 * k, sd), CREAM, 0.75);
      bar(c - a, c - th, c + a, c + th, sid(id) + 3);
      if (id === 'zoomIn') bar(c - th, c - a, c + th, c + a, sid(id) + 9);
    }, { noMip: true });
    t.lw = L; t.lh = L; return t;
  };
  const mkBtn = (id, label, colr) => {
    btnMeta[id] = { label, colr }; const old = btn[id], sc = devPerHud();
    const tx = isZoomBtn(id) ? zoomBtnTex(id, colr, sc) : textTex(label, 34 * 0.9 * uiK(), { strip: colr || CREAM, col: BTN_INK[id] || INK, cut: true, seed: 11, scale: sc, noMip: true });
    const s = spr(tx, { hud: true, rail: isZoomBtn(id), z: 0.1, zr: 0.03, order: 200 }); s.bw = s.w = tx.lw; s.bh = s.h = tx.lh;
    s.tilt = (HUD_TILT[id === 'hint' ? 'hintBtn' : id] || 0) * DEG; s.rot = s.tilt;
    if (old) { s.wob = old.wob; s.x = old.x; s.y = old.y; s.alpha = old.alpha; old.own = true; kill(old); }
    btn[id] = s; return s;
  };
  const BTN_IDS = ['sound', 'passport', 'world', 'hint', 'undo', 'zoomOut', 'zoomIn'];
  mkBtn('sound', 'Enable sound', PAP[5]); mkBtn('passport', 'Passport', PAP[4]); mkBtn('world', 'World', PAP[8]); mkBtn('hint', 'Hint', shade(PAP[11], 0.12)); mkBtn('undo', 'Undo', PAP[2]);
  mkBtn('zoomOut', '-', PAP[9]); mkBtn('zoomIn', '+', PAP[9]);
  const isZoomedIn = () => (mode === 'map' && playerLevel() === 'own' && RD && RD.baseCam && cam.h < RD.baseCam.h - 2) || (mode === 'world' && twins.length > 0 && cam.h < worldFrame().h - 2);
  // the camera can be zoomed: "On my own" during a map round, and the world view while pieces are lifted for a size comparison
  const zoomable = () => !attract && !picker && !passport && ((mode === 'map' && playerLevel() === 'own' && !!RD && !RD.auto) || (mode === 'world' && twins.length > 0));
  const btnOn = id => id === 'mail' ? amBtnOn() : isZoomBtn(id) ? zoomable() : // air mail
    id === 'sound' || (id === 'passport' ? (mode === 'world' && !attract && !picker && (!!currentPlayer() || Q.get('done') === 'all')) : (mode === 'wind' ? id === 'world' : mode !== 'world'));
  // the + and - buttons: in the top bar, just left of the other buttons (the only place that is never over the map, the flag column or a
  // waiting piece: a round of six flags fills the column to the bottom at 800x560); never scaled below 44 px
  const ZGAP = 10;
  function layoutZoomBtns(rightX, cy) {
    const zs = zoomBtnHud(), portrait = rightX === undefined;
    const y = portrait ? 1000 - 12 - zs / 2 : cy, x1 = portrait ? 24 + zs * 2 + ZGAP : rightX;
    [['zoomOut', x1 - zs * 1.5 - ZGAP], ['zoomIn', x1 - zs / 2]].forEach(([id, x]) => { const s = btn[id], on = btnOn(id); s.alpha = on ? 1 : 0; s.w = s.bw; s.h = s.bh; s.x = x; s.y = y; s.rail = portrait; s.rot = s.tilt + wobbleRot(s); });
  }
  function layoutHud() {
    if (mode === 'mail') { amLayoutHud(); return; } // air mail
    const W = 1000 * asp, hasP = !!currentPlayer();
    playerBtn.alpha = hasP ? 1 : 0;
    title.rot = title.tilt; playerBtn.rot = playerBtn.tilt + wobbleRot(playerBtn); if (hintS) hintS.rot = hintS.tilt;
    for (const id of BTN_IDS) if (!isZoomBtn(id)) btn[id].rot = btn[id].tilt + wobbleRot(btn[id]);
    if (asp < 0.9) {
      title.alpha = 1;
      layoutZoomBtns();
      const pad = 24, maxW = Math.max(120, W - pad * 2), tGap = 10;
      const totW = title.bw + (hasP ? tGap + playerBtn.bw : 0);
      const ts = Math.min(1, maxW / totW);
      title.w = title.bw * ts; title.h = title.bh * ts;
      title.x = pad + title.w / 2; title.y = 20 + title.h / 2;
      playerBtn.w = playerBtn.bw * ts; playerBtn.h = playerBtn.bh * ts;
      playerBtn.x = title.x + title.w / 2 + tGap * ts + playerBtn.w / 2; playerBtn.y = title.y;
      const ids = ['undo', 'hint', 'world', 'mail', 'passport', 'sound']; // air mail
      const vis = ids.filter(btnOn);
      const gap = 10, rawW = vis.reduce((a, id) => a + btn[id].bw, 0) + gap * Math.max(0, vis.length - 1);
      const bs = Math.min(1, maxW / Math.max(1, rawW));
      let x = pad, rowY = title.y + title.h / 2 + 10, rowH = 0;
      for (const id of ids) {
        const s = btn[id], on = btnOn(id);
        s.alpha = on ? 1 : 0; s.w = s.bw * bs; s.h = s.bh * bs;
        if (on) { rowH = Math.max(rowH, s.h); s.x = x + s.w / 2; s.y = rowY + s.h / 2 + (s._hopY || 0); x += s.w + gap * bs; }
      }
      if (hintS) {
        const hs = Math.min(1, maxW / hintS.bw);
        hintS.w = hintS.bw * hs; hintS.h = hintS.bh * hs;
        hintS.x = pad + hintS.w / 2; hintS.y = rowY + rowH + 10 + hintS.h / 2;
      }
      if (typeof layoutPicker === 'function' && picker) { layoutPicker(); fitPickerMat(); }
      return;
    }
    if (PHONE && mode !== 'world' && !picker) {
      title.alpha = 0;
      const padX = 24, gap = 14, zGapOut = 18;
      playerBtn.w = playerBtn.bw; playerBtn.h = playerBtn.bh;
      const ids = ['sound', 'passport', 'mail', 'world', 'hint', 'undo']; // air mail
      const vis = ids.filter(btnOn);
      const hasZ = btnOn('zoomIn');
      const zW = hasZ ? zoomBtnHud() * 2 + ZGAP + zGapOut : 0;
      const leftEdge = hasP ? padX + playerBtn.w + gap : padX;
      const availBtnW = Math.max(120, W - padX - leftEdge - zW);
      const rawW = vis.reduce((a, id) => a + btn[id].bw, 0) + gap * Math.max(0, vis.length - 1);
      const bs = Math.min(1, availBtnW / Math.max(1, rawW));
      const btnH = btn.sound.bh * bs;
      const rowH = Math.max(hasZ ? zoomBtnHud() : 0, btnH, hasP ? playerBtn.h : 0);
      const cy = 8 + rowH / 2;
      playerBtn.x = padX + playerBtn.w / 2; playerBtn.y = cy;
      let x = W - padX;
      for (const id of ids) {
        const s = btn[id], on = btnOn(id);
        s.w = s.bw * bs; s.h = s.bh * bs; s.alpha = on ? 1 : 0;
        if (on) { s.x = x - s.w / 2; s.y = cy + (s._hopY || 0); x -= s.w + gap * bs; }
      }
      const zRight = x - zGapOut + gap * bs;
      layoutZoomBtns(zRight, cy);
      const rightEdge = (hasZ ? zRight - zoomBtnHud() * 2 - ZGAP : x + gap * bs) - gap;
      if (hintS) {
        const availHint = rightEdge - leftEdge;
        if (availHint >= hintS.bw * 0.75) {
          const hs = Math.min(1, availHint / Math.max(1, hintS.bw));
          hintS.w = hintS.bw * hs; hintS.h = hintS.bh * hs;
          hintS.x = leftEdge + hintS.w / 2; hintS.y = cy;
        } else {
          const hasRail = !!(RD && (mode === 'map' || (RD.col && RD.col.length)));
          const hx0 = hasRail ? 186 : padX;
          const hs = Math.min(1, Math.max(120, W - padX - hx0) / Math.max(1, hintS.bw));
          hintS.w = hintS.bw * hs; hintS.h = hintS.bh * hs;
          hintS.x = hx0 + hintS.w / 2;
          hintS.y = 8 + rowH + 8 + hintS.h / 2;
        }
      }
      if (typeof layoutPicker === 'function' && picker) { layoutPicker(); fitPickerMat(); }
      return;
    }
    title.alpha = 1;
    title.w = title.bw; title.h = title.bh; title.x = 34 + title.w / 2; title.y = 26 + title.h / 2;
    playerBtn.w = playerBtn.bw; playerBtn.h = playerBtn.bh;
    playerBtn.x = title.x + title.w / 2 + 14 + playerBtn.w / 2; playerBtn.y = PHONE ? Math.max(title.y, 12 + playerBtn.h / 2) : title.y;
    if (hintS) { hintS.w = hintS.bw; hintS.h = hintS.bh; hintS.x = 34 + hintS.w / 2; hintS.y = (PHONE && hasP ? Math.max(title.y + title.h / 2, playerBtn.y + playerBtn.h / 2) : title.y + title.h / 2) + 8 + hintS.h / 2; }
    const ids = ['sound', 'passport', 'mail', 'world', 'hint', 'undo']; // air mail
    const vis = ids.filter(btnOn);
    const leftLim = (hasP ? playerBtn.x + playerBtn.w / 2 : title.x + title.w / 2) + 20;
    const zW = btnOn('zoomIn') ? zoomBtnHud() * 2 + ZGAP + 22 : 0;
    const availW = Math.max(120, W - 30 - leftLim - zW), gap = 14;
    const rawW = vis.reduce((a, id) => a + btn[id].bw, 0) + gap * Math.max(0, vis.length - 1);
    const bs = Math.min(1, availW / Math.max(1, rawW));
    let x = W - 30;
    for (const id of ids) {
      const s = btn[id], on = btnOn(id);
      s.w = s.bw * bs; s.h = s.bh * bs; s.alpha = on ? 1 : 0;
      if (on) { s.x = x - s.w / 2; s.y = 30 + s.h / 2 + (s._hopY || 0); x -= s.w + gap * bs; }
    }
    layoutZoomBtns(x - 22 + gap * bs, 30 + btn.sound.bh * bs / 2);
    if (typeof layoutPicker === 'function' && picker) { layoutPicker(); fitPickerMat(); }
  }
  const peekTex = () => shapeTex(320, 220, b => { B.paper(b, wob(8, 8, 312, 212, 10, 3), PALE, 0.5); b.c.fillStyle = 'rgba(60,64,80,0.6)'; b.c.font = `800 60px ${FONT}`; b.c.textAlign = 'center'; b.c.fillText('Peek', 160, 132); });
  function mkRailLabel(name) {
    const sc = devPerHud();
    let t = textTex(name, 22, { strip: CREAM, col: INK, cut: true, scale: sc, noMip: true });
    if (t.lw <= 150) return t;
    const k1 = 150 / t.lw;
    B.freeTex(t);
    if (k1 >= 0.75) return textTex(name, 22 * k1, { strip: CREAM, col: INK, cut: true, scale: sc, noMip: true });
    const m = document.createElement('canvas').getContext('2d');
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    const lineW = (str, px) => { m.font = `800 ${px}px ${FONT}`; return [...str].reduce((a, ch) => a + m.measureText(ch).width + px * 0.035, 0); };
    let lines = [name];
    if (words.length >= 2) {
      let best = null, bestMax = 1e9;
      for (let i = 1; i < words.length; i++) {
        const l1 = words.slice(0, i).join(' '), l2 = words.slice(i).join(' ');
        const mw = Math.max(lineW(l1, 22), lineW(l2, 22));
        if (mw < bestMax) { bestMax = mw; best = [l1, l2]; }
      }
      if (best) lines = best;
    }
    const maxW22 = Math.max(...lines.map(l => lineW(l, 22)));
    const fHud = 22 * clamp(144 / Math.max(1, maxW22 + 16), 0.75, 0.88);
    const px = fHud * sc;
    const lineChars = lines.map(ln => {
      m.font = `800 ${px}px ${FONT}`;
      const chs = [...ln], ws = chs.map(ch => m.measureText(ch).width + px * 0.035);
      return { chs, ws, w: ws.reduce((a, b) => a + b, 0) };
    });
    const maxW = Math.max(...lineChars.map(l => l.w)), maxAllowedW = 162 * sc;
    const padx = px * 0.42, pady = px * 0.12, lineGap = px * 0.04, lh = px * 1.04;
    const availW = Math.max(20, maxAllowedW - padx * 2);
    const sx = maxW > availW ? Math.max(0.75 / (fHud / 22), availW / maxW) : 1;
    const b = B.bake(Math.min(maxAllowedW, maxW * sx + padx * 2), pady * 2 + lines.length * lh + (lines.length - 1) * lineGap);
    const sd = sid(name || '_'), mg = Math.max(2, Math.round(2 * sc));
    B.paper(b, cutEdge(mg + 1, mg + 1, b.w - mg - 1, b.h - mg - 1, px * 0.14, sd), CREAM, 0.15);
    lineChars.forEach((ln, li) => {
      let x = (b.w - ln.w * sx) * 0.5;
      const yBase = pady + li * (lh + lineGap) + px * 0.88;
      ln.chs.forEach((ch, i) => {
        const cw = ln.ws[i] * sx;
        if (ch !== ' ') for (const [q, st] of [[b.c, shade(INK, (hs(i + li * 31, sd, 1) - 0.5) * 0.07)], [b.g, B.grey(0.75 + hs(i + li * 31, sd, 2) * 0.2)]]) {
          q.save(); q.font = `800 ${px}px ${FONT}`; q.textAlign = 'center'; q.textBaseline = 'alphabetic';
          q.translate(x + cw / 2, yBase + (hs(i + li * 31, sd, 3) - 0.5) * px * 0.06);
          q.rotate((hs(i + li * 31, sd, 4) - 0.5) * 0.09);
          if (sx < 1) q.scale(sx, 1);
          q.fillStyle = st; q.fillText(ch, 0, 0);
          if (q === b.c) { q.strokeStyle = st; q.lineWidth = Math.max(1, sc); q.strokeText(ch, 0, 0); }
          q.restore();
        }
        x += cw;
      });
    });
    const tw2 = B.tex(b, { noMip: true }); tw2.lw = b.w / sc; tw2.lh = b.h / sc;
    return tw2;
  }
  let turnBg = null, turnCard = null, turnLbl = null, turnCardSize = [360, 316], wasPhonePortrait = false, nextTurnWob = 0;
  let turnBgTex = null;
  function turnCardTex(cw, ch, sc) {
    const W = Math.round(cw * sc), H = Math.round(ch * sc), k = W / cw;
    const t = shapeTex(W, H, b => {
      B.paper(b, wob(8 * k, 8 * k, W - 8 * k, H - 8 * k, 12 * k, 701), '#cdb995', 0.34);
      const q = b.c;
      q.strokeStyle = 'rgba(60,64,80,0.22)'; q.lineWidth = 2.0 * k; q.setLineDash([10 * k, 7 * k]);
      q.strokeRect(22 * k, 22 * k, W - 44 * k, H - 44 * k); q.setLineDash([]);
      const cx = W * 0.5, cy = H * 0.37;
      // ghost landscape phone outline on the right
      const gx = cx + 24 * k, gy = cy + 12 * k, gw = 122 * k, gh = 70 * k;
      q.strokeStyle = 'rgba(60,64,80,0.32)'; q.lineWidth = 2.4 * k; q.setLineDash([8 * k, 5 * k]);
      q.strokeRect(gx - gw * 0.5, gy - gh * 0.5, gw, gh); q.setLineDash([]);
      // upright cut-paper phone on the left
      const px = cx - 44 * k, py = cy + 2 * k, pw = 72 * k, ph = 124 * k;
      B.paper(b, cutEdge(px - pw * 0.5, py - ph * 0.5, px + pw * 0.5, py + ph * 0.5, 5.5 * k, 703), PAP[1], 0.55);
      const sx0 = px - pw * 0.5 + 8 * k, sy0 = py - ph * 0.5 + 15 * k, sx1 = px + pw * 0.5 - 8 * k, sy1 = py + ph * 0.5 - 17 * k;
      B.paper(b, wob(sx0, sy0, sx1, sy1, 2.5 * k, 704), SEA, 0.68);
      // tiny cut-paper continents on the phone screen
      B.paper(b, x => { x.moveTo(px - 16 * k, py - 24 * k); x.lineTo(px + 4 * k, py - 28 * k); x.lineTo(px + 10 * k, py - 10 * k); x.lineTo(px - 8 * k, py - 2 * k); x.closePath(); }, PAP[6], 0.78);
      B.paper(b, x => { x.moveTo(px - 6 * k, py + 8 * k); x.lineTo(px + 18 * k, py + 4 * k); x.lineTo(px + 14 * k, py + 24 * k); x.lineTo(px - 12 * k, py + 20 * k); x.closePath(); }, PAP[5], 0.78);
      B.paper(b, cutEdge(px - 10 * k, py - ph * 0.5 + 6 * k, px + 10 * k, py - ph * 0.5 + 10 * k, 1.5 * k, 705), '#5c5f68', 0.65);
      B.paper(b, x => x.arc(px, py + ph * 0.5 - 9 * k, 4.2 * k, 0, 7), '#5c5f68', 0.65);
      // curved cut-paper arrow sweeping clockwise from upright to sideways
      const acx = cx + 10 * k, acy = cy + 16 * k, R = 60 * k, a0 = -1.45, a1 = -0.28, hw = 7.2 * k, steps = 14;
      B.paper(b, x => {
        for (let i = 0; i <= steps; i++) {
          const a = lerp(a0, a1, i / steps), px_ = acx + Math.cos(a) * (R + hw), py_ = acy + Math.sin(a) * (R + hw);
          if (i === 0) x.moveTo(px_, py_); else x.lineTo(px_, py_);
        }
        const nx = Math.cos(a1), ny = Math.sin(a1), ux = -ny, uy = nx;
        const bx = acx + nx * R, by = acy + ny * R;
        x.lineTo(bx + nx * 16 * k, by + ny * 16 * k);
        x.lineTo(bx + ux * 24 * k, by + uy * 24 * k);
        x.lineTo(bx - nx * 16 * k, by - ny * 16 * k);
        for (let i = steps; i >= 0; i--) {
          const a = lerp(a0, a1, i / steps);
          x.lineTo(acx + Math.cos(a) * (R - hw), acy + Math.sin(a) * (R - hw));
        }
        x.closePath();
      }, PAP[5], 0.80);
    }, { noMip: true });
    t.lw = cw; t.lh = ch; return t;
  }
  function ensureTurnCard() {
    const sc = devPerHud(), W = 1000 * asp;
    if (!turnBgTex) turnBgTex = shapeTex(16, 16, b => B.paper(b, x => x.rect(-2, -2, 20, 20), BLACK, 0.0), { noMip: true });
    if (!turnBg) turnBg = spr(turnBgTex, { hud: true, z: 0.04, zr: 0, order: 240, alpha: 0, _turnCard: true });
    if (!turnLbl) {
      const lt = hintTex('Turn your phone', sc);
      turnLbl = spr(lt, { hud: true, z: 0.16, zr: 0.03, order: 242, alpha: 0, _turnCard: true });
      turnLbl.bw = turnLbl.w = lt.lw; turnLbl.bh = turnLbl.h = lt.lh; turnLbl.tilt = HUD_TILT.hint * DEG;
    }
    const cardW = Math.min(W * 0.85, Math.max(336, turnLbl.bw + 44)), cardH = cardW * 0.88;
    if (!turnCard) {
      turnCardSize = [cardW, cardH];
      const ct = turnCardTex(cardW, cardH, sc);
      turnCard = spr(ct, { hud: true, z: 0.14, zr: 0.03, order: 241, alpha: 0, _turnCard: true });
      turnCard.bw = turnCard.w = ct.lw; turnCard.bh = turnCard.h = ct.lh; turnCard.tilt = -0.8 * DEG;
    }
  }
  function rebakeTurnCard() {
    if (!turnCard || !turnLbl) return;
    const sc = devPerHud(), W = 1000 * asp;
    B.freeTex(turnLbl.tex);
    const lt = hintTex('Turn your phone', sc);
    turnLbl.tex = lt; turnLbl.bw = turnLbl.w = lt.lw; turnLbl.bh = turnLbl.h = lt.lh;
    const cardW = Math.min(W * 0.85, Math.max(336, turnLbl.bw + 44)), cardH = cardW * 0.88;
    turnCardSize = [cardW, cardH];
    B.freeTex(turnCard.tex);
    const ct = turnCardTex(cardW, cardH, sc);
    turnCard.tex = ct; turnCard.bw = turnCard.w = ct.lw; turnCard.bh = turnCard.h = ct.lh;
  }
  function layoutTurnCard() {
    ensureTurnCard();
    const W = 1000 * asp;
    const cardW = Math.min(W * 0.85, Math.max(336, turnLbl.bw + 44)), cardH = cardW * 0.88;
    if (Math.abs(cardW - turnCardSize[0]) > 2) rebakeTurnCard();
    turnBg.x = W * 0.5; turnBg.y = 500; turnBg.w = W + 24; turnBg.h = 1024; turnBg.alpha = 1;
    turnCard.w = cardW; turnCard.h = cardH; turnCard.x = W * 0.5; turnCard.y = 500; turnCard.alpha = 1;
    const ls = Math.min(1, (cardW - 32) / Math.max(1, turnLbl.bw));
    turnLbl.w = turnLbl.bw * ls; turnLbl.h = turnLbl.bh * ls;
    turnLbl.x = W * 0.5; turnLbl.y = 500 + cardH * 0.29; turnLbl.alpha = 1;
    turnCard.rot = turnCard.tilt + wobbleRot(turnCard);
    turnLbl.rot = turnLbl.tilt + wobbleRot(turnLbl);
  }
  function rebakeFonts() {
    B.resize();
    lastHudDevH = B.size()[1];
    const sc = devPerHud();
    B.freeTex(title.tex); const tt = titleTex(sc); title.tex = tt; title.bw = title.w = tt.lw; title.bh = title.h = tt.lh;
    if (hintS && hintTxt) { B.freeTex(hintS.tex); const ht = hintTex(hintTxt, sc); hintS.tex = ht; hintS.bw = hintS.w = ht.lw; hintS.bh = hintS.h = ht.lh; }
    for (const id in btnMeta) mkBtn(id, btnMeta[id].label, btnMeta[id].colr);
    bakePBtn(); updateHudToken();
    if (RD && RD.col) {
      const y0 = asp < 0.9 ? 290 : 236, step = asp < 0.9 ? 112 : 120;
      for (let i = 0; i < RD.col.length; i++) { const q = RD.col[i]; if (q && S.includes(q)) q.y = y0 + i * step; }
    }
    if (RD && RD.colLabels) {
      const y0 = asp < 0.9 ? 290 : 236, step = asp < 0.9 ? 112 : 120;
      for (let i = 0; i < RD.colLabels.length; i++) {
        const it = RD.colLabels[i]; if (!it || !S.includes(it.s)) continue;
        it.cy = y0 + i * step;
        B.freeTex(it.s.tex); const nt = mkRailLabel(it.name); it.s.tex = nt; it.s.w = nt.lw; it.s.h = nt.lh;
        if (it.hh !== undefined) it.s.y = it.cy + it.hh * 0.52 + Math.max(14, nt.lh / 2 + 2);
      }
    }
    if (tag) placeTag();
    if (RD && RD.back) { B.freeTex(RD.back.tex); RD.back.tex = peekTex(); }
    if (picker) rebuildPicker();
    if (typeof rebuildPassport === 'function' && passport) rebuildPassport(false);
    if (mode === 'mail') amRebake(); // air mail
    if (turnCard) rebakeTurnCard();
    layoutHud();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebakeFonts);
  // ---------- sound (WebAudio + speechSynthesis, only after click on sound tab) ----------
  let AC = null, soundOn = false;
  const tone = (f, d, type, vol, slide) => { if (!soundOn || !AC) return; const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, AC.currentTime); if (slide) o.frequency.exponentialRampToValueAtTime(slide, AC.currentTime + d); g.gain.setValueAtTime(vol || 0.15, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + d); o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + d); };
  const noise = (d, fr, vol) => { if (!soundOn || !AC) return; const n = AC.createBufferSource(), b = AC.createBuffer(1, AC.sampleRate * d, AC.sampleRate), a = b.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length); n.buffer = b; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fr; const g = AC.createGain(); g.gain.value = vol; n.connect(f).connect(g).connect(AC.destination); n.start(); };
  const sfxWind = () => {
    if (!soundOn || !AC) return;
    try {
      const dur = 2.2, sr = AC.sampleRate, len = Math.floor(sr * dur), t0 = AC.currentTime;
      const b = AC.createBuffer(1, len, sr), a = b.getChannelData(0);
      for (let i = 0; i < len; i++) a[i] = Math.random() * 2 - 1;
      for (const [f0, f1, f2, q, peak] of [[240, 560, 210, 2.2, 0.56], [130, 260, 115, 1.5, 0.30]]) {
        const src = AC.createBufferSource(); src.buffer = b;
        const flt = AC.createBiquadFilter(); flt.type = 'bandpass'; flt.Q.value = q;
        flt.frequency.setValueAtTime(f0, t0);
        flt.frequency.linearRampToValueAtTime(f1, t0 + 0.85);
        flt.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
        const g = AC.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + 0.42);
        g.gain.setValueAtTime(peak * 0.85, t0 + 1.15);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(flt).connect(g).connect(AC.destination);
        src.start(t0); src.stop(t0 + dur);
      }
    } catch (e) { }
  };
  const sfx = { pick: () => noise(0.08, 2400, 0.40), snap: () => { noise(0.07, 900, 0.42); tone(190, 0.1, 'sine', 0.20, 120); }, thump: () => { tone(120, 0.28, 'sine', 0.42, 45); noise(0.12, 300, 0.32); }, back: () => noise(0.25, 1500, 0.38), wake: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'triangle', 0.16), i * 85)); noise(0.5, 3000, 0.14); }, turn: () => noise(0.06, 3200, 0.38), wind: sfxWind };
  const ss = typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null;
  const NOVELTY_VOICES = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|pipe organ|princess|superstar|trinoids|whisper|wobble|zarvox)\b/i;
  const CHARACTER_VOICES = /^(fred|junior|kathy|ralph|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;
  const PREFERRED_VOICES = ['Samantha', 'Daniel', 'Ava', 'Allison', 'Nicky', 'Karen', 'Moira', 'Serena', 'Kate', 'Oliver', 'Tessa', 'Susan', 'Arthur', 'Martha', 'Catherine', 'Gordon', 'Rishi', 'Google US English', 'Google UK English Female', 'Google UK English Male'];
  let enVoice = null, loggedVoiceName = null, speechSeq = 0, speechTmr = null, speechFailTmr = null;
  let speechActive = false, curSpeechRest = [], queuedPhrase = null;
  const speechLog = [];
  function voicePrefRank(v) {
    const nm = String(v.name || '').toLowerCase();
    for (let i = 0; i < PREFERRED_VOICES.length; i++) {
      const p = PREFERRED_VOICES[i].toLowerCase();
      if (nm === p || nm.startsWith(p + ' ')) return i;
    }
    if (/natural|google|microsoft/i.test(nm)) return PREFERRED_VOICES.length;
    return PREFERRED_VOICES.length + 1;
  }
  function pickVoice() {
    if (!ss || typeof ss.getVoices !== 'function') return null;
    let list = [];
    try { list = ss.getVoices() || []; } catch (e) { return null; }
    const en = list.filter(v => v && /^en([-_]|$)/i.test(String(v.lang || '')));
    if (!en.length) { enVoice = null; return null; }
    // batch 4b: English voices only, in this order: a name with Premium, Enhanced, Natural or Neural; then Google US English or Google UK
    // English Female; then the list used before (the system's default English voice, then PREFERRED_VOICES)
    const nmOf = v => String(v.name || '').trim(), usgb = v => /^en[-_]?(US|GB)$/i.test(v.lang) ? 0 : 1;
    const better = en.filter(v => /\b(premium|enhanced|natural|neural)\b/i.test(nmOf(v)) && !NOVELTY_VOICES.test(nmOf(v)));
    const google = ['google us english', 'google uk english female'].map(g => en.find(v => nmOf(v).toLowerCase() === g)).filter(Boolean);
    const def = en.find(v => v.default);
    if (better.length) {
      const q = v => ['premium', 'enhanced', 'natural', 'neural'].findIndex(w => new RegExp('\\b' + w + '\\b', 'i').test(nmOf(v)));
      enVoice = better.slice().sort((a, b) => (q(a) - q(b)) || (usgb(a) - usgb(b)) || (voicePrefRank(a) - voicePrefRank(b)) || ((b.localService ? 1 : 0) - (a.localService ? 1 : 0)) || nmOf(a).localeCompare(nmOf(b)))[0];
    } else if (google.length) {
      enVoice = google[0];
    } else if (def) {
      enVoice = def;
    } else {
      const clean = en.filter(v => !NOVELTY_VOICES.test(String(v.name || '').trim()));
      const pool = clean.length ? clean : en;
      pool.sort((a, b) => {
        const ra = voicePrefRank(a), rb = voicePrefRank(b);
        if (ra !== rb) return ra - rb;
        const ca = CHARACTER_VOICES.test(String(a.name || '').trim()) ? 1 : 0;
        const cb = CHARACTER_VOICES.test(String(b.name || '').trim()) ? 1 : 0;
        if (ca !== cb) return ca - cb;
        const usa = /^en[-_]?(US|GB)$/i.test(a.lang) ? 1 : 0, usb = /^en[-_]?(US|GB)$/i.test(b.lang) ? 1 : 0;
        if (usa !== usb) return usb - usa;
        const la = a.localService ? 1 : 0, lb = b.localService ? 1 : 0;
        if (la !== lb) return lb - la;
        return (sid(String(a.name || '')) >>> 0) - (sid(String(b.name || '')) >>> 0);
      });
      enVoice = pool[0];
    }
    if (enVoice && enVoice.name !== loggedVoiceName) {
      loggedVoiceName = enVoice.name;
      console.log('[atlas] speech voice:', enVoice.name, enVoice.lang, { default: !!enVoice.default, localService: !!enVoice.localService });
    }
    return enVoice;
  }
  if (ss) {
    pickVoice();
    try {
      if (typeof ss.addEventListener === 'function') ss.addEventListener('voiceschanged', pickVoice);
      else ss.onvoiceschanged = pickVoice;
    } catch (e) { }
  }
  function stopSpeech() {
    speechSeq++;
    speechActive = false; curSpeechRest = []; queuedPhrase = null;
    if (speechTmr) { clearTimeout(speechTmr); speechTmr = null; }
    if (speechFailTmr) { clearTimeout(speechFailTmr); speechFailTmr = null; }
    if (ss && typeof ss.cancel === 'function') { try { ss.cancel(); } catch (e) { } }
  }
  function unlockSpeech() {
    if (!ss || typeof SpeechSynthesisUtterance === 'undefined') return;
    try {
      pickVoice();
      if (!speechActive && !ss.speaking) ss.cancel();
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0; u.rate = 1;
      if (enVoice) { u.voice = enVoice; u.lang = enVoice.lang || 'en-US'; }
      else u.lang = 'en-US';
      ss.speak(u);
    } catch (e) { }
  }
  function playSpeechGroups(groups) {
    if (!groups || !groups.length || !soundOn || attract) { speechActive = false; return; }
    if (!ss || typeof SpeechSynthesisUtterance === 'undefined') { speechActive = false; return; }
    pickVoice();
    if (!enVoice) { speechActive = false; return; }
    speechActive = true;
    const part = groups[0];
    curSpeechRest = groups.slice(1);
    const seq = speechSeq;
    let finished = false;
    const onDone = () => {
      if (finished) return;
      finished = true;
      if (speechFailTmr) { clearTimeout(speechFailTmr); speechFailTmr = null; }
      if (seq !== speechSeq || !soundOn || attract) { speechActive = false; curSpeechRest = []; queuedPhrase = null; return; }
      if (queuedPhrase) {
        const next = queuedPhrase;
        queuedPhrase = null;
        curSpeechRest = [];
        playSpeechGroups(next);
        return;
      }
      if (curSpeechRest.length) {
        const rest = curSpeechRest.slice();
        curSpeechRest = [];
        speechTmr = setTimeout(() => {
          speechTmr = null;
          if (seq === speechSeq && soundOn && !attract) playSpeechGroups(rest);
          else speechActive = false;
        }, 240);
        return;
      }
      speechActive = false;
    };
    try {
      const u = new SpeechSynthesisUtterance(part);
      u.voice = enVoice; u.lang = enVoice.lang || 'en-US'; u.rate = 0.85;
      u.onend = onDone;
      u.onerror = onDone;
      const estMs = Math.max(2500, part.length * 160 + 1000);
      speechFailTmr = setTimeout(() => {
        if (!finished && !(ss.speaking || ss.pending)) onDone();
        else if (!finished) speechFailTmr = setTimeout(onDone, estMs);
      }, estMs);
      ss.speak(u);
    } catch (e) { onDone(); }
  }
  function enqueuePhrase(groups, logText) {
    if (!groups || !groups.length || !soundOn || attract) return;
    speechLog.push({ text: logText, time: +T.toFixed(3) });
    if (speechTmr) {
      clearTimeout(speechTmr); speechTmr = null;
      curSpeechRest = [];
      if (queuedPhrase) return;
      playSpeechGroups(groups);
      return;
    }
    if (speechActive || (ss && (ss.speaking || ss.pending))) {
      curSpeechRest = [];
      if (!queuedPhrase) queuedPhrase = groups;
      return;
    }
    playSpeechGroups(groups);
  }
  function speakCountry(c, withCap) {
    if (!c || !soundOn || attract) return;
    const cap = withCap ? CAP[c.id] : null;
    const capSpoken = cap ? normSaint(cap.say || cap.name) : null;
    const cName = normSaint(c.name);
    const full = capSpoken ? `${cName}. Capital: ${capSpoken}` : cName;
    const groups = capSpoken ? [cName, 'Capital: ' + capSpoken] : [cName];
    enqueuePhrase(groups, full);
  }
  function speakText(txt) {
    if (!txt || !soundOn || attract) return;
    enqueuePhrase([txt], txt);
  }
  // ---------- game state ----------
  let mode = 'world', RD = null, attract = false, drag = null, pan = null, pinch = null, mapTap = null, light = [-0.8, 0.6], ptr = [0.3, 0.3];
  const activePtrs = new Map(), activeTags = [];
  const csp = {}; // placed country sprites
  const view = { ct: null };
  const twins = [];
  let twinDrag = null, worldTap = null, lastComparisonText = '', compareTag = null;
  let idleTime = 0, compareHintDone = false, compareHopSprite = null;
  const worldHintStr = () => {
    const n = nextCont();
    return attract ? 'Tap to play' : !currentPlayer() && Q.get('done') !== 'all' ? 'Tap to play' : n ? (n.id === 'all' ? 'Tap Last round to finish the world' : 'Tap ' + n.name + ' to build it') : 'You built the whole world';
  };
  const restZFor = idx => 0.38 + idx * 0.035;
  const CMP_LINE_HUD = 22 / 820 * 1000;
  const syncTwinLayers = (skipTw = null) => {
    twins.forEach((tw_, idx) => {
      if (!tw_.s || !S.includes(tw_.s)) return;
      if (tw_ === skipTw || (twinDrag && twinDrag.tw === tw_ && twinDrag.moved)) return;
      tw_.s.order = 70 + idx;
      if (!tweens.some(q => q.o === tw_.s && 'z' in q.to)) tw_.s.z = restZFor(idx);
    });
  };
  const canLiftCountry = c => !!(c && c.built && c !== AQ && Math.max(c.bw, c.bh) * (innerHeight / Math.max(1, cam.h)) >= 12);
  const countryAt = (wx, wy) => {
    let hitC = null, bestA = 1e9;
    for (const c of G.countries) {
      if (wx < c.bbox[0] || wx > c.bbox[2] || wy < c.bbox[1] || wy > c.bbox[3]) continue;
      if (pipPolys(wx, wy, c.polys)) {
        const a = polyArea(c);
        if (a < bestA) { bestA = a; hitC = c; }
      }
    }
    return hitC;
  };
  const liftCandidateAt = (wx, wy) => {
    const hitC = countryAt(wx, wy);
    if (hitC) return canLiftCountry(hitC) ? hitC : null;
    const pad = 4 * cam.h / Math.max(1, innerHeight);
    let best = null, bd = 1e9;
    for (const c of G.countries) {
      if (!canLiftCountry(c)) continue;
      if (wx >= c.bbox[0] - pad && wx <= c.bbox[2] + pad && wy >= c.bbox[1] - pad && wy <= c.bbox[3] + pad) {
        const ac = c.c || [c.cx, c.cy], d = Math.hypot(wx - ac[0], wy - ac[1]);
        if (d < bd) { bd = d; best = c; }
      }
    }
    return best;
  };
  const hitTwinAt = (wx, wy) => {
    const padW = 8 * cam.h / Math.max(1, innerHeight);
    for (let i = twins.length - 1; i >= 0; i--) {
      const tw_ = twins[i], s = tw_.s, c = tw_.c;
      if (!s || !S.includes(s)) continue;
      const dx = wx - s.x, dy = wy - s.y, co = Math.cos(-s.rot), si = Math.sin(-s.rot);
      const lx = c.cx + (dx * co - dy * si) / s.sc, ly = c.cy + (dx * si + dy * co) / s.sc;
      if (lx < c.bbox[0] - padW || lx > c.bbox[2] + padW || ly < c.bbox[1] - padW || ly > c.bbox[3] + padW) continue;
      if (pipPolys(lx, ly, c.polys)) return tw_;
      const pxSize = Math.max(c.bw, c.bh) * s.sc * (innerHeight / Math.max(1, cam.h));
      if (pxSize < 34) return tw_;
    }
    return null;
  };
  function clearCompareTag(animate = false) {
    timers = timers.filter(t => t.tag !== 'cmpTag');
    if (!compareTag) return;
    const n = compareTag; compareTag = null;
    const idx = activeTags.indexOf(n); if (idx >= 0) activeTags.splice(idx, 1);
    if (!S.includes(n)) return;
    if (!animate) { kill(n); return; }
    n._dying = true;
    n.lift = 0.12;
    tw(n, { y: n.y - 8 * (cam.h / 330) }, 0.15, { cut: true, done: () => kill(n) });
  }
  function compareTagTex(str, basePx, maxHudW) {
    const m = document.createElement('canvas').getContext('2d');
    m.font = `800 ${basePx}px ${FONT}`;
    const oneW = [...str].reduce((a, ch) => a + m.measureText(ch).width + basePx * 0.035, 0) + basePx;
    const maxPxW = Math.min(maxHudW * 0.36, 540) * (basePx / CMP_LINE_HUD);
    if (oneW <= maxPxW) {
      const t = textTex(str, basePx, { strip: CREAM, col: INK });
      t.pxFrac = 1 / 1.65;
      return t;
    }
    const lines = wrapWords(m, str, Math.max(oneW * 0.54, maxPxW * 0.90), `800 ${basePx}px ${FONT}`);
    if (lines.length <= 1) {
      const t = textTex(str, basePx, { strip: CREAM, col: INK });
      t.pxFrac = 1 / 1.65;
      return t;
    }
    const lineChars = lines.map(ln => {
      const chs = [...ln], ws = chs.map(ch => m.measureText(ch).width + basePx * 0.035);
      return { chs, ws, w: ws.reduce((a, b) => a + b, 0) };
    });
    const tw_ = Math.max(...lineChars.map(l => l.w)), padx = basePx * 0.5, pady = basePx * 0.22, lineGap = basePx * 0.14;
    const lh = basePx * 1.15;
    const b = B.bake(tw_ + padx * 2, pady * 2 + lines.length * lh + (lines.length - 1) * lineGap);
    const sd = sid(str), mg = 2;
    B.paper(b, wob(mg, mg, b.w - mg, b.h - mg, basePx * 0.14, sd), CREAM, 0.15);
    lineChars.forEach((ln, li) => {
      let x = (b.w - ln.w) * 0.5;
      const yBase = pady + li * (lh + lineGap) + basePx * 0.94;
      ln.chs.forEach((ch, i) => {
        const cw = ln.ws[i];
        if (ch !== ' ') for (const [q, st] of [[b.c, shade(INK, (hs(i + li * 31, sd, 1) - 0.5) * 0.07)], [b.g, B.grey(0.75 + hs(i + li * 31, sd, 2) * 0.2)]]) {
          q.save(); q.font = `800 ${basePx}px ${FONT}`; q.textAlign = 'center'; q.textBaseline = 'alphabetic';
          q.translate(x + cw / 2, yBase + (hs(i + li * 31, sd, 3) - 0.5) * basePx * 0.07);
          q.rotate((hs(i + li * 31, sd, 4) - 0.5) * 0.11);
          q.fillStyle = st; q.fillText(ch, 0, 0);
          if (q === b.c) { q.strokeStyle = st; q.lineWidth = 1; q.strokeText(ch, 0, 0); }
          q.restore();
        }
        x += cw;
      });
    });
    const t = B.tex(b);
    t.pxFrac = basePx / b.h;
    return t;
  }
  function showCompareTag(twObj, otherC, txt, dur = 4.0) {
    if (!twObj || !twObj.s || mode !== 'world') return null;
    clearCompareTag(false);
    lastComparisonText = txt;
    const basePx = Math.max(54, Math.ceil(CMP_LINE_HUD * B.size()[1] / 1000 * 1.45));
    const tx = compareTagTex(txt, basePx, 1000 * asp);
    const ac = anchorOf(twObj.s);
    const n = spr(tx, { z: 0.68, zr: 0.02, order: 135, x: ac[0], y: ac[1], w: tx.w, h: tx.h, lift: 0.16 });
    n.own = true; n._ac = ac; n._twin = twObj; n._other = otherC; n._cmp = true; n.pxFrac = tx.pxFrac; n.texAspect = tx.w / tx.h;
    compareTag = n; activeTags.push(n);
    layoutTagSprite(n);
    tw(n, { lift: 0 }, 0.2, { cut: true });
    after(dur, () => { if (compareTag === n) clearCompareTag(true); }, 'cmpTag');
    speakText(txt);
    return n;
  }
  function sendTwinHome(twObj, immediate = false) {
    const idx = twins.indexOf(twObj);
    if (idx >= 0) twins.splice(idx, 1);
    if (compareTag && compareTag._twin === twObj) clearCompareTag(false);
    syncTwinLayers();
    if (twins.length === 0 && mode === 'world' && !immediate && cam.h < worldFrame().h - 2) {
      const wf = worldFrame();
      camTo(wf.x, wf.y, wf.h, 0.55);
    }
    const s = twObj && twObj.s, c = twObj && twObj.c;
    if (!s || !S.includes(s)) return;
    if (immediate) { kill(s); return; }
    s._goingHome = true;
    s.order = 94;
    s.z = Math.max(s.z, 0.48);
    const nr = Math.round(s.rot / (Math.PI * 2)) * Math.PI * 2;
    const dist = Math.hypot(s.x - c.cx, s.y - c.cy);
    const dur = clamp(0.24 + dist / 2200, 0.26, 0.46);
    tw(s, { x: c.cx, y: c.cy, rot: nr, z: 0.20 }, dur, { cut: true, done: () => kill(s) });
  }
  function sendAllTwinsHome(immediate = false) {
    twinDrag = null; worldTap = null;
    clearCompareTag(false);
    const list = twins.slice();
    for (const tw_ of list) sendTwinHome(tw_, immediate);
    if (immediate) {
      for (let i = S.length - 1; i >= 0; i--) if (S[i]._goingHome) kill(S[i]);
    }
  }
  function bringTwinToFront(twObj) {
    const idx = twins.indexOf(twObj);
    if (idx >= 0 && idx < twins.length - 1) {
      twins.splice(idx, 1);
      twins.push(twObj);
    }
    syncTwinLayers();
  }
  function liftTwin(c, opt = {}) {
    while (twins.length >= 3) sendTwinHome(twins[0], false);
    bakeCountry(c);
    const idx = twins.length;
    const s = spr(c.tex, {
      x: opt.x !== undefined ? opt.x : c.cx,
      y: opt.y !== undefined ? opt.y : c.cy,
      w: c.tw, h: c.th, sc: 1, rot: opt.rot || 0,
      z: opt.lifted ? 0.56 : restZFor(idx),
      zr: 0.045,
      order: opt.lifted ? 95 : 70 + idx,
      cells: 6,
      wash: 0.23
    });
    s.c = c;
    const twObj = { c, s };
    twins.push(twObj);
    syncTwinLayers(opt.lifted ? twObj : null);
    return twObj;
  }
  const placeOf = c => ({ x: c.cx, y: c.cy, sc: 1 });
  // batch 4: at the continent frame a capital star is shown only for a country at least 14 px on its shorter side (no cluster of
  // small neighbours' stars); all stars once the camera is closer than the continent frame or a country has been tapped
  let allStars = false, szF = -1, szV = false;
  const starsZoomed = () => { if (szF === frame) return szV; szF = frame; const ct = RD ? RD.ct : view.ct; szV = !!(ct && ct.id !== 'all' && cam.h < contFrame(ct).h * 0.85); return szV; };
  function starLayout(s) {
    if (!s || !s.c || mode !== 'map') return null;
    const c = s.c, cap = CAP[c.id];
    if (!cap || !cap.inside || c === AQ) return null;
    const pxPerW = innerHeight / Math.max(1, cam.h);
    const onCard = !!(RD && RD.cardLanded === s);
    if (!onCard && s.sc > 1.05) return null;
    const shortW = Math.min(c.bw, c.bh);
    const drawnShortPx = shortW * s.sc * pxPerW;
    let starD, atCenter = CITY_STATES.has(c.id);
    if (onCard) {
      const sixthPx = drawnShortPx / 6;
      if (sixthPx < STAR_MIN_PX) atCenter = true;
      starD = clamp(sixthPx, STAR_MIN_PX, 22) / pxPerW;
    } else {
      starD = Math.min(shortW / 6, STAR_MAX_W) * s.sc;
      if (starD * pxPerW < STAR_MIN_PX) return null;
      if (!allStars && drawnShortPx < 14 && !starsZoomed()) return null;
    }
    const pt = atCenter ? (c.c || [c.cx, c.cy]) : [cap.x, cap.y];
    const dx = pt[0] - c.cx, dy = pt[1] - c.cy, co = Math.cos(s.rot), si = Math.sin(s.rot);
    return { x: s.x + (dx * co - dy * si) * s.sc, y: s.y + (dx * si + dy * co) * s.sc, d: starD, order: onCard ? 29 : 28 };
  }
  function syncStar(s) {
    if (!s || !s._starReady) return;
    const lay = starLayout(s);
    if (!lay) { if (s.star) s.star.alpha = 0; return; }
    const w = lay.d / STAR_FILL;
    if (!s.star) {
      s.star = spr(starTex, { x: lay.x, y: lay.y, w, h: w, z: 0.195, zr: 0.025, order: lay.order, alpha: s.alpha });
    } else {
      s.star.x = lay.x; s.star.y = lay.y; s.star.w = w; s.star.h = w;
      s.star.order = lay.order; s.star.alpha = s.alpha;
      s.star.lift = Math.max(s.lift, s.star._wakeLift || 0);
    }
  }
  function clearStars() { for (const id in csp) { const s = csp[id]; if (s.star) { kill(s.star); s.star = null; } } }
  function clearTags(onlyC) {
    for (let i = activeTags.length - 1; i >= 0; i--) {
      const n = activeTags[i];
      if (!onlyC || n._c === onlyC) { activeTags.splice(i, 1); if (RD && RD.cardName === n) RD.cardName = null; kill(n); }
    }
  }
  const pieceBoxes = p => { // world boxes of a piece, its tile, flag and pole
    const out = [], co = Math.abs(Math.cos(p.rot)), si = Math.abs(Math.sin(p.rot)), hw = (co * p.w + si * p.h) * p.sc * 0.5, hh = (si * p.w + co * p.h) * p.sc * 0.5;
    out.push([p.x - hw, p.y - hh, p.x + hw, p.y + hh]);
    for (const q of [p.flag, p.pole]) if (q && S.includes(q)) { const w = q.w * (q.sc || 1) * 0.5, h = q.h * (q.sc || 1) * 0.5; out.push([q.x - w, q.y - h, q.x + w, q.y + h]); }
    return out;
  };
  function layoutTagSprite(n) {
    if (!n || n._dying || !S.includes(n)) return;
    const vs = cam.h / 330;
    const lineHud = n._cmp ? CMP_LINE_HUD : TAG_LINE1_HUD;
    let th = (lineHud / (n.pxFrac || (1 / 1.65))) * (cam.h / 1000);
    let tw_ = th * (n.texAspect || (n.w / Math.max(1e-4, n.h)));
    const maxW = cam.h * (n._cmp ? Math.min(asp * 0.44, 0.58) : asp * 0.90);
    if (tw_ > maxW) { const k = maxW / tw_; tw_ *= k; th *= k; }
    n.w = tw_; n.h = th;
    const leftLim = cam.x - 0.5 * cam.h * asp + tw_ * 0.5 + 8 * vs;
    const rightLim = cam.x + 0.5 * cam.h * asp - tw_ * 0.5 - 8 * vs;
    const topLim = cam.y + (topHudBottom() / 1000 - 0.5) * cam.h + th * 0.5 + 4 * vs;
    const botLim = cam.y + 0.5 * cam.h - th * 0.5 - 6 * vs;
    let nx, ny;
    if (n._cmp && n._twin && n._twin.s && S.includes(n._twin.s)) {
      const ts = n._twin.s, co = Math.abs(Math.cos(ts.rot)), si = Math.abs(Math.sin(ts.rot));
      const twHalf = (co * ts.w + si * ts.h) * ts.sc * 0.5, thHalf = (si * ts.w + co * ts.h) * ts.sc * 0.5;
      const twBox = [ts.x - twHalf, ts.y - thHalf, ts.x + twHalf, ts.y + thHalf];
      const other = n._other;
      const otherBox = other && other.bbox ? other.bbox : null;
      const oc = other ? (other.c || [other.cx, other.cy]) : null;
      const ac = anchorOf(ts);
      const combBox = otherBox
        ? [Math.min(twBox[0], otherBox[0]), Math.min(twBox[1], otherBox[1]), Math.max(twBox[2], otherBox[2]), Math.max(twBox[3], otherBox[3])]
        : twBox;
      const gap = 8 * vs;
      const boxOverlap = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
      const padBox = (b, p) => [b[0] - p, b[1] - p, b[2] + p, b[3] + p];
      const twPad = padBox(twBox, 3 * vs);
      const oPad = otherBox ? padBox(otherBox, 2 * vs) : null;
      const ocPad = oc ? [oc[0] - 8 * vs, oc[1] - 8 * vs, oc[0] + 8 * vs, oc[1] + 8 * vs] : null;
      const acPad = [ac[0] - 8 * vs, ac[1] - 8 * vs, ac[0] + 8 * vs, ac[1] + 8 * vs];
      const otherTwBoxes = twins.filter(t => t !== n._twin && t.s && S.includes(t.s)).map(t => {
        const os = t.s, oco = Math.abs(Math.cos(os.rot)), osi = Math.abs(Math.sin(os.rot));
        const hw = (oco * os.w + osi * os.h) * os.sc * 0.5, hh = (osi * os.w + oco * os.h) * os.sc * 0.5;
        return [os.x - hw, os.y - hh, os.x + hw, os.y + hh];
      });
      const cand = [
        [twBox[2] + gap + tw_ * 0.5, ts.y],
        [twBox[0] - gap - tw_ * 0.5, ts.y],
        [ts.x, twBox[3] + gap + th * 0.5],
        [ts.x, twBox[1] - gap - th * 0.5],
        [twBox[2] + gap + tw_ * 0.5, twBox[1] - gap - th * 0.5],
        [twBox[0] - gap - tw_ * 0.5, twBox[1] - gap - th * 0.5],
        [twBox[2] + gap + tw_ * 0.5, twBox[3] + gap + th * 0.5],
        [twBox[0] - gap - tw_ * 0.5, twBox[3] + gap + th * 0.5],
        [combBox[2] + gap + tw_ * 0.5, ts.y],
        [combBox[0] - gap - tw_ * 0.5, ts.y],
        [ts.x, combBox[3] + gap + th * 0.5],
        [ts.x, combBox[1] - gap - th * 0.5],
        [leftLim, twBox[3] + gap + th * 0.5],
        [rightLim, twBox[3] + gap + th * 0.5],
        [leftLim, twBox[1] - gap - th * 0.5],
        [rightLim, twBox[1] - gap - th * 0.5],
        [leftLim, combBox[3] + gap + th * 0.5],
        [rightLim, combBox[3] + gap + th * 0.5],
        [leftLim, botLim],
        [ts.x, botLim],
        [rightLim, botLim],
        [leftLim, topLim],
        [ts.x, topLim],
        [rightLim, topLim]
      ];
      if (otherBox) {
        cand.push(
          [twBox[2] + gap + tw_ * 0.5, otherBox[3] + gap + th * 0.5],
          [twBox[0] - gap - tw_ * 0.5, otherBox[3] + gap + th * 0.5],
          [twBox[2] + gap + tw_ * 0.5, otherBox[1] - gap - th * 0.5],
          [twBox[0] - gap - tw_ * 0.5, otherBox[1] - gap - th * 0.5],
          [(otherBox[0] + otherBox[2]) * 0.5, otherBox[3] + gap + th * 0.5],
          [(otherBox[0] + otherBox[2]) * 0.5, otherBox[1] - gap - th * 0.5],
          [otherBox[2] + gap + tw_ * 0.5, ts.y],
          [otherBox[0] - gap - tw_ * 0.5, ts.y]
        );
      }
      let bestScore = 1e18, bestX = ts.x, bestY = botLim;
      for (const [rx, ry] of cand) {
        const cx = leftLim <= rightLim ? clamp(rx, leftLim, rightLim) : (leftLim + rightLim) * 0.5;
        const cy = topLim <= botLim ? clamp(ry, topLim, botLim) : (topLim + botLim) * 0.5;
        const tBox = [cx - tw_ * 0.5, cy - th * 0.5, cx + tw_ * 0.5, cy + th * 0.5];
        let score = Math.hypot(cx - ts.x, cy - ts.y) * 0.25;
        const ovTw = boxOverlap(tBox, twPad);
        if (ovTw > 0) score += 1e6 + ovTw * 10000;
        if (oPad) {
          const ovO = boxOverlap(tBox, oPad);
          if (ovO > 0) score += 1e5 + ovO * 1000;
        }
        if (ocPad && boxOverlap(tBox, ocPad) > 0) score += 1e7;
        if (boxOverlap(tBox, acPad) > 0) score += 1e7;
        for (const ob of otherTwBoxes) {
          const ovOt = boxOverlap(tBox, ob);
          if (ovOt > 0) score += 2e4 + ovOt * 500;
        }
        if (score < bestScore) { bestScore = score; bestX = cx; bestY = cy; }
      }
      nx = bestX; ny = bestY;
    } else if (RD && RD.cardName === n && RD.card) {
      nx = RD.card.x;
      ny = RD.card.y + RD.card.h * 0.5 + th * 0.5 + 7 * vs;
      if (ny > botLim) ny = Math.max(topLim, RD.card.y - RD.card.h * 0.5 - th * 0.5 - 7 * vs);
      if (leftLim <= rightLim) nx = clamp(nx, leftLim, rightLim);
    } else {
      // batch 4: below the country by default; nudged to the nearest free side (above, right, left) when it would cover an earlier
      // tag, the waiting piece with its flag, or the card; always inside the screen and below the HUD
      const ac = n._ac || [n.x, n.y], g = 12 * vs, obst = [];
      for (const o of activeTags) { if (o === n) break; if (!S.includes(o) || o._dying || o._cmp) continue; obst.push([o.x - o.w / 2 - 2 * vs, o.y - o.h / 2 - 2 * vs, o.x + o.w / 2 + 2 * vs, o.y + o.h / 2 + 2 * vs]); }
      if (RD && RD.piece && !(drag && drag.s === RD.piece)) obst.push(...pieceBoxes(RD.piece));
      if (RD && RD.card) obst.push([RD.card.x - RD.card.w / 2, RD.card.y - RD.card.h / 2, RD.card.x + RD.card.w / 2, RD.card.y + RD.card.h / 2]);
      const cands = [[ac[0], ac[1] + g + th * 0.5], [ac[0], ac[1] - g - th * 0.5], [ac[0] + g * 1.4 + tw_ * 0.5, ac[1]], [ac[0] - g * 1.4 - tw_ * 0.5, ac[1]]];
      let best = 1e18; nx = ac[0]; ny = ac[1];
      cands.forEach(([rx, ry], i) => {
        const cx = leftLim <= rightLim ? clamp(rx, leftLim, rightLim) : (leftLim + rightLim) * 0.5, cy = topLim <= botLim ? clamp(ry, topLim, botLim) : (topLim + botLim) * 0.5;
        const bx = [cx - tw_ / 2, cy - th / 2, cx + tw_ / 2, cy + th / 2]; let ov = 0;
        for (const o of obst) ov += Math.max(0, Math.min(bx[2], o[2]) - Math.max(bx[0], o[0])) * Math.max(0, Math.min(bx[3], o[3]) - Math.max(bx[1], o[1]));
        const sc = ov * 1e4 + Math.hypot(cx - rx, cy - ry) * 4 + i * g * 0.5 - (n._side === i ? g : 0);
        if (sc < best) { best = sc; nx = cx; ny = cy; n._sideNext = i; }
      });
      n._side = n._sideNext;
    }
    n.x = nx; n.y = ny;
  }
  function showCountryTag(c, s, dur = 3.0, delay = 0) {
    if (!c || !RD || mode !== 'map') return null;
    clearTags(c);
    const onCard = !!(RD.cardLanded && RD.cardLanded.c === c && RD.card);
    const namePx = Math.max(72, Math.ceil(TAG_LINE1_HUD * B.size()[1] / 1000 * 1.5));
    const tx = nameTagTex(c, namePx), hRatio = tx.hRatio || 1;
    const ac = onCard ? [RD.card.x, RD.card.y] : (c.c || [s ? s.x : c.cx, s ? s.y : c.cy]);
    const n = spr(tx, { z: 0.215, zr: 0.02, order: 120, x: ac[0], y: ac[1], w: tx.w, h: tx.h, lift: 0.16 });
    n.own = true; n._c = c; n._ac = ac; n.hRatio = hRatio;
    n.pxFrac = tx.pxFrac; n.px2Frac = tx.px2Frac; n.h1Frac = tx.h1Frac; n.h2Frac = tx.h2Frac; n.capRatio = tx.capRatio;
    n.texAspect = tx.w / tx.h;
    RD.tmp.push(n); activeTags.push(n);
    if (onCard) RD.cardName = n;
    layoutTagSprite(n);
    tw(n, { lift: 0 }, 0.2, { delay });
    after(dur, () => {
      const idx = activeTags.indexOf(n); if (idx >= 0) activeTags.splice(idx, 1);
      if (RD && RD.cardName === n) RD.cardName = null;
      if (!S.includes(n)) return;
      n._dying = true;
      n.lift = 0.12; tw(n, { y: n.y - 8 * (cam.h / 330) }, 0.15, { done: () => kill(n) });
    }, 'rd');
    return n;
  }
  function showCountry(c, pop) { if (csp[c.id]) return csp[c.id]; bakeCountry(c); const p = placeOf(c); const s = spr(c.tex, { x: p.x, y: p.y, w: c.tw, h: c.th, sc: p.sc, z: 0.17, zr: 0.045, order: 20, cells: 6 }); s.c = c; s._starReady = true; csp[c.id] = s; if (pop) { s.reveal = 0; tw(s, { reveal: 1 }, 0.5); } syncStar(s); return s; }
  function hideCountry(c) { const s = csp[c.id]; if (s) { if (s.star) { kill(s.star); s.star = null; } kill(s); delete csp[c.id]; } }
  // batch 4: a card country whose largest island would be under 10 px on its card (Kiribati, Tonga: largest island under 1/13 of the
  // country's extent, as at 1180x820) is grabbed as a small sea-coloured paper tile cut to the atolls' convex outline. Card only.
  const tileInfo = c => {
    if (c._tile !== undefined) return c._tile;
    if (!c.isCard || c === AQ) return (c._tile = null);
    const md = Math.max(c.bw, c.bh); let big = 0; const pts = [];
    for (const r of c.polys) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]); pts.push([r[i] - c.cx, r[i + 1] - c.cy]); } big = Math.max(big, x1 - x0, y1 - y0); }
    if (big / md >= 10 / 130) return (c._tile = null);
    return (c._tile = { hull: convexHull(pts), m: md * 0.07 });
  };
  const tileTex = c => {
    if (c._tileTex) return c._tileTex;
    const ti = tileInfo(c), m = ti.m, W = c.bw + m * 2 + 1, H = c.bh + m * 2 + 1, ppu = 360 / Math.max(W, H);
    const t = shapeTex(W * ppu, H * ppu, b => {
      const path = q => { ti.hull.forEach(([x, y], i) => { const X = (x + W / 2) * ppu, Y = (y + H / 2) * ppu; i ? q.lineTo(X, Y) : q.moveTo(X, Y); }); q.closePath(); };
      for (const [q, col] of [[b.c, shade(SEA, -0.1)], [b.g, B.grey(0.3)]]) { q.fillStyle = q.strokeStyle = col; q.lineJoin = 'bevel'; q.lineWidth = m * 2 * ppu; q.beginPath(); path(q); q.fill(); q.stroke(); }
    });
    return (c._tileTex = { tex: t, w: W, h: H });
  };
  const addTile = s => { if (!s || !s.c || !tileInfo(s.c)) return; const t = tileTex(s.c); s.tile = spr(t.tex, { w: t.w, h: t.h, x: s.x, y: s.y, sc: s.sc, rot: s.rot, z: s.z - 0.004, zr: 0.02, order: s.order - 0.5, lift: s.lift }); RD.tmp.push(s.tile); };
  const syncTile = s => { const t = s && s.tile; if (!t) return; t.x = s.x; t.y = s.y; t.sc = s.sc; t.rot = s.rot; t.lift = s.lift; t.alpha = s.alpha; t.z = s.z - 0.004; t.order = s.order - 0.5; };
  function cardTex(c, cardS, cardSc) {
    return shapeTex(512, 512, b => {
      B.paper(b, wob(14, 14, 498, 498, 20, sid(c.id)), CREAM, 0.52);
      const q = b.c, k = (512 / cardS) * cardSc;
      q.strokeStyle = 'rgba(70,72,86,0.22)'; q.lineWidth = 2.6; q.setLineDash([14, 9]); q.strokeRect(36, 36, 440, 440); q.setLineDash([]);
      q.save(); q.translate(256, 256);
      const ti = tileInfo(c); if (ti) { q.fillStyle = shade(SEA, 0.04); q.strokeStyle = 'rgba(68,70,82,0.5)'; q.lineJoin = 'bevel'; q.beginPath(); ti.hull.forEach(([x, y], i) => i ? q.lineTo(x * k, y * k) : q.moveTo(x * k, y * k)); q.closePath(); q.lineWidth = ti.m * 2 * k; q.stroke(); q.fill(); q.strokeStyle = 'rgba(68,70,82,0.42)'; q.lineWidth = 2.4; q.setLineDash([13, 5]); const mm = ti.m; q.beginPath(); ti.hull.forEach(([x, y], i) => { const d = Math.hypot(x, y) || 1, X = (x + x / d * mm) * k, Y = (y + y / d * mm) * k; i ? q.lineTo(X, Y) : q.moveTo(X, Y); }); q.closePath(); q.stroke(); q.setLineDash([]); } // the tile's place on the card
      q.fillStyle = shade(PALE, -0.045); q.beginPath();
      for (const r of c.polys) ring(q, r, c.cx, c.cy, k);
      q.fill('evenodd');
      for (let pass = 0; pass < 2; pass++) {
        q.strokeStyle = `rgba(68,70,82,${pass ? 0.34 : 0.58})`; q.lineWidth = pass ? 2.0 : 2.9;
        q.setLineDash(pass ? [] : [13, 5]);
        q.beginPath(); for (const r of c.polys) ring(q, r, c.cx - pass * 1.2 / k, c.cy + pass * 0.9 / k, k); q.stroke();
      }
      q.setLineDash([]); q.restore();
      b.g.save(); b.g.translate(256, 256); b.g.fillStyle = B.grey(0.46); b.g.beginPath();
      for (const r of c.polys) ring(b.g, r, c.cx, c.cy, k);
      b.g.fill('evenodd'); b.g.restore();
    });
  }
  const spotTex = () => shapeTex(96, 96, b => {
    for (const [q, st] of [[b.c, 'rgba(54,56,68,0.68)'], [b.g, 'rgba(128,128,128,0.5)']]) {
      q.strokeStyle = st; q.lineWidth = 2.2; q.lineCap = 'round';
      q.beginPath(); q.arc(48, 48, 35, 0.1, 6.38); q.stroke();
      q.lineWidth = 1.2; q.globalAlpha = 0.42; q.beginPath(); q.arc(48.7, 47.4, 35.6, 0.5, 6.75); q.stroke(); q.globalAlpha = 1;
    }
  });
  const leaderTex = pxLen => shapeTex(Math.max(48, Math.ceil(pxLen)), 24, b => {
    const w = b.w;
    for (const [q, st] of [[b.c, 'rgba(54,56,68,0.64)'], [b.g, 'rgba(128,128,128,0.45)']]) {
      q.strokeStyle = st; q.lineWidth = 2.0; q.lineCap = 'round'; q.setLineDash([10, 7]);
      q.beginPath(); q.moveTo(2, 12); q.lineTo(w - 2, 12); q.stroke(); q.setLineDash([]);
    }
  });
  function setView(ct) { view.ct = ct; for (const id in csp) { const p = placeOf(C[id]); tw(csp[id], p, 0.7); } }
  function camTo(x, y, h, d) { tw(cam, { x, y, h }, d === undefined ? 1.3 : d, { smooth: true, cut: true }); }
  const mapMar = () => {
    if (asp < 0.9) return { l: 0.18, r: 0.04, t: 0.27, b: 0.05 };
    const hb = topHudBottom();
    const hasRail = !!(RD && (mode === 'map' || (RD.col && RD.col.length)));
    const railR = hasRail ? 176 : 30;
    return {
      l: clamp(railR / (1000 * asp), 0.03, 0.18),
      r: 0.025,
      t: clamp((hb + 8) / 1000, PHONE ? 0.12 : 0.175, 0.21),
      b: 0.025
    };
  };
  const SEA_BOX = [-20, -18, 2020, 992];
  const worldFrame = () => fitCam(WREG, { l: 0.03, r: 0.03, t: asp < 0.9 ? 0.24 : 0.17, b: 0.03 }, 0, false);
  const contFrame = ct => ct.id === 'all' ? fitCam(WREG, { l: asp < 0.9 ? 0.18 : 0.15, r: 0.03, t: asp < 0.9 ? 0.24 : 0.17, b: 0.03 }, 0, false) : fitCam(ct.region, mapMar(), 0, true);
  function clampCamVals(x, y, h) {
    const base = RD && RD.baseCam ? RD.baseCam : (mode === 'world' ? worldFrame() : contFrame(RD ? RD.ct : CI.all));
    const ch = clamp(h, 90, base.h);
    if (ch >= base.h - 0.25 && ((RD && RD.ct.id === 'all') || mode === 'world')) return { x: base.x, y: base.y, h: base.h };
    const hw = ch * asp * 0.5, hh = ch * 0.5;
    const minX = Math.min(SEA_BOX[0], base.x - base.h * asp * 0.5), maxX = Math.max(SEA_BOX[2], base.x + base.h * asp * 0.5);
    const minY = Math.min(SEA_BOX[1], base.y - base.h * 0.5), maxY = Math.max(SEA_BOX[3], base.y + base.h * 0.5);
    let cx = x, cy = y;
    if (hw * 2 <= maxX - minX) cx = clamp(cx, minX + hw, maxX - hw);
    else cx = base.x;
    if (hh * 2 <= maxY - minY) cy = clamp(cy, minY + hh, maxY - hh);
    else cy = base.y;
    return { x: cx, y: cy, h: ch };
  }
  function fitCam(reg, m, minH = 0, clampSea = true, safeReg = reg) {
    const rw = Math.max(10, reg[2] - reg[0]), rh = Math.max(10, reg[3] - reg[1]);
    const aw = Math.max(0.2, 1 - m.l - m.r), ah = Math.max(0.2, 1 - m.t - m.b);
    const h = Math.max(minH, rh / ah, rw / (aw * asp));
    let cx = (reg[0] + reg[2]) / 2 - (m.l - m.r) / 2 * h * asp;
    let cy = (reg[1] + reg[3]) / 2 - (m.t - m.b) / 2 * h;
    if (clampSea) {
      const hw = h * asp * 0.5, hh = h * 0.5;
      const rXLo = safeReg[2] - (0.5 - m.r) * h * asp, rXHi = safeReg[0] - (m.l - 0.5) * h * asp;
      if (hw * 2 <= SEA_BOX[2] - SEA_BOX[0]) {
        const sLo = SEA_BOX[0] + hw, sHi = SEA_BOX[2] - hw;
        const lo = rXLo <= rXHi ? Math.max(sLo, rXLo) : sLo, hi = rXLo <= rXHi ? Math.min(sHi, rXHi) : sHi;
        if (lo <= hi) cx = clamp(cx, lo, hi);
        else { cx = clamp(cx, sLo, sHi); if (rXLo <= rXHi) cx = clamp(cx, rXLo, rXHi); }
      } else {
        const sLo = SEA_BOX[2] - hw, sHi = SEA_BOX[0] + hw;
        if (sLo <= sHi) cx = clamp(cx, sLo, sHi);
        if (rXLo <= rXHi) cx = clamp(cx, rXLo, rXHi);
      }
      const rYLo = safeReg[3] - (0.5 - m.b) * h, rYHi = safeReg[1] - (m.t - 0.5) * h;
      if (hh * 2 <= SEA_BOX[3] - SEA_BOX[1]) {
        const sLo = SEA_BOX[1] + hh, sHi = SEA_BOX[3] - hh;
        const lo = rYLo <= rYHi ? Math.max(sLo, rYLo) : sLo, hi = rYLo <= rYHi ? Math.min(sHi, rYHi) : sHi;
        if (lo <= hi) cy = clamp(cy, lo, hi);
        else { cy = clamp(cy, sLo, sHi); if (rYLo <= rYHi) cy = clamp(cy, rYLo, rYHi); }
      } else {
        const sLo = SEA_BOX[3] - hh, sHi = Math.min(SEA_BOX[1] + hh, 1340 - hh);
        if (sLo <= sHi) cy = clamp(cy, sLo, sHi);
        if (rYLo <= rYHi) cy = clamp(cy, rYLo, rYHi);
      }
    }
    return { x: cx, y: cy, h };
  }
  function frameRect(reg, m, d, minH = 0, clampSea = true, safeReg = reg) {
    const k = fitCam(reg, m, minH, clampSea, safeReg);
    camTo(k.x, k.y, k.h, d);
    return k;
  }
  function camCont(ct, d) { const k = contFrame(ct); camTo(k.x, k.y, k.h, d); return k.h; }
  function snapWorldCam() { killTw(cam); const k = worldFrame(); cam.x = k.x; cam.y = k.y; cam.h = k.h; }
  function goWorld(d) {
    if (mode === 'mail') amExit(); // air mail
    mode = 'world'; setView(null); allStars = false;
    idleTime = 0; timers = timers.filter(t => t.tag !== 'cmpHint');
    clearStars(); clearTags(); clearCompareTag(false);
    const k = worldFrame();
    if (d === 0) { killTw(cam); cam.x = k.x; cam.y = k.y; cam.h = k.h; }
    else camTo(k.x, k.y, k.h, d);
    placeTag(); if (cbase) cbase.alpha = 1; clearRound();
    if (justAddedStickers && !attract && !picker && btn.passport) {
      justAddedStickers = false;
      setHint('New stickers in your passport');
      btn.passport._hopY = -22; btn.passport.lift = 0.24;
      tw(btn.passport, { _hopY: 0, lift: 0 }, 0.34, { cut: true });
    } else {
      setHint(worldHintStr());
    }
    layoutHud();
  }
  let tag = null;
  // batch 4: the world-view tag ("Start here", "Next", "Last round") is printed at the hint line's size, at least 150 px wide at
  // 1180x820, and laid over open sea next to its target (the continent to build; Antarctica for the last round) with a short paper
  // pointer; never over land, never under the HUD.
  let tagPtr = null, landRingsC = null;
  const killTag = () => { if (tag) { tag.own = true; kill(tag); tag = null; } if (tagPtr) { kill(tagPtr); tagPtr = null; } }; // the pointer's texture is shared
  const ptrTex = (() => { let t = null; return () => t || (t = shapeTex(200, 90, b => { B.paper(b, x => { x.moveTo(4, 8); x.lineTo(196, 45); x.lineTo(4, 82); x.closePath(); }, PAP[5], 0.35); })); })();
  const landRings = () => {
    if (landRingsC) return landRingsC;
    const out = [], add = (r, cont) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]); } out.push({ r, bb: [x0, y0, x1, y1], cont }); };
    for (const c of G.countries) for (const r of c.polys) add(r, c.cont);
    for (const r of G.neutral || []) add(r, '-');
    if (G.aq) add(G.aq, 'all');
    return (landRingsC = out);
  };
  const rectOnLand = (x0, y0, x1, y1, speck = 0) => { // speck: islands smaller than this (world units) do not count
    for (const L of landRings()) {
      const bb = L.bb; if (bb[2] < x0 || bb[0] > x1 || bb[3] < y0 || bb[1] > y1) continue; if (Math.max(bb[2] - bb[0], bb[3] - bb[1]) < speck) continue;
      const r = L.r; for (let i = 0; i < r.length; i += 2) if (r[i] >= x0 && r[i] <= x1 && r[i + 1] >= y0 && r[i + 1] <= y1) return true;
      for (let j = 0; j <= 4; j++) for (let i = 0; i <= 10; i++) if (pipRing(x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * j / 4, r)) return true;
    }
    return false;
  };
  function placeTag() {
    killTag(); const n = nextCont(); if (!n || attract) return;
    const first = !CONTS.some(ct => contDone(ct)), K = worldFrame(), hu = K.h / 1000, wpp = K.h / Math.max(1, innerHeight); // world units per screen px
    const label = n.id === 'all' ? 'Last round' : first ? 'Start here' : 'Next';
    // target outline: the continent's countries, or Antarctica for the world round
    const tp = []; if (n.id === 'all') { for (let i = 0; i < G.aq.length; i += 2) if (G.aq[i + 1] < 960) tp.push(G.aq[i], G.aq[i + 1]); } else for (const c of G.countries) if (c.cont === n.id) { // the body of each country: its largest ring and land within 40 units of it (not French Guiana or St Helena)
      const bbOf = r => { const q = [1e9, 1e9, -1e9, -1e9]; for (let i = 0; i < r.length; i += 2) { q[0] = Math.min(q[0], r[i]); q[2] = Math.max(q[2], r[i]); q[1] = Math.min(q[1], r[i + 1]); q[3] = Math.max(q[3], r[i + 1]); } return q; };
      const main = c.polys.reduce((m, r) => !m || ringAbsArea(r) > ringAbsArea(m) ? r : m, null), mb = bbOf(main);
      for (const r of c.polys) { const b = bbOf(r); if (r !== main && Math.hypot(Math.max(0, b[0] - mb[2], mb[0] - b[2]), Math.max(0, b[1] - mb[3], mb[1] - b[3])) > 40) continue; for (let i = 0; i < r.length; i += 6) tp.push(r[i], r[i + 1]); } }
    const tr = n.id === 'all' ? AQ.bbox : n.region, tcx = (tr[0] + tr[2]) / 2, tcy = n.id === 'all' ? tr[1] : (tr[1] + tr[3]) / 2; // keep the tag beside the body of the target, not a far corner
    const vx0 = Math.max(SEA_BOX[0] + 6, K.x - K.h * asp / 2 + 8 * hu), vx1 = Math.min(SEA_BOX[2] - 6, K.x + K.h * asp / 2 - 8 * hu);
    const vy0 = Math.max(SEA_BOX[1] + 6, K.y + ((topHudBottom() + 14) / 1000 - 0.5) * K.h), vy1 = Math.min(SEA_BOX[3] - 6, K.y + K.h / 2 - 8 * hu), st = 6 * hu;
    const PTR_MAX = 60 * wpp, NEAR = 90 * wpp; // pointer under 60 px; "beside" = within 90 px of the target
    const foreign = (x, y) => { for (const L of landRings()) { if (L.cont === n.id) continue; const bb = L.bb; if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) continue; if (pipRing(x, y, L.r)) return true; } return false; };
    // batch 4 correction C2: a 150 px tag (at 1180x820) within 90 px of its target; failing that, the tag narrows in steps to 110 px (text
    // at the hint size, side padding trimmed) and specks under 4 px may lie under it; only then the nearest open sea far away. The tag
    // stays inside the sea area (never on the frame or under the HUD); its pointer is under 60 px and crosses no land but the target's.
    const geom = (w, h, speckPx, near) => {
      const hw = w / 2 + 4 * hu, hh = h / 2 + 6 * hu, gm = h * 0.4, speck = speckPx * wpp, cand = [];
      for (let y = vy0 + hh; y <= vy1 - hh; y += st) for (let x = vx0 + hw; x <= vx1 - hw; x += st) {
        let bd = 1e9, bi = 0; for (let i = 0; i < tp.length; i += 2) { const dx = Math.max(x - hw - tp[i], 0, tp[i] - x - hw), dy = Math.max(y - hh - tp[i + 1], 0, tp[i + 1] - y - hh), d = dx * dx + dy * dy; if (d < bd) { bd = d; bi = i; } }
        bd = Math.sqrt(bd); if (bd >= gm && (!near || bd <= NEAR)) cand.push([bd + Math.hypot(x - tcx, y - tcy) * 0.5, x, y, bi, bd]);
      }
      cand.sort((a, b) => a[0] - b[0]);
      for (const c of cand) {
        if (rectOnLand(c[1] - hw, c[2] - hh, c[1] + hw, c[2] + hh, speck)) continue;
        const pt = pointerFor(c[1], c[2], w, h, c[3]); if (near && pt && pt.crosses) continue;
        return { c, pt };
      }
      return null;
    };
    const pointerFor = (x, y, w, h, bi) => {
      const txp = tp[bi], typ = tp[bi + 1], ex = clamp(txp, x - w / 2, x + w / 2), ey = clamp(typ, y - h / 2, y + h / 2);
      const ang = Math.atan2(typ - ey, txp - ex), reach = Math.hypot(txp - ex, typ - ey) - 3 * hu;
      if (reach <= 4 * hu) return null;
      const len = Math.min(reach, PTR_MAX); let crosses = false;
      for (let d = 2 * hu; d <= len && !crosses; d += 2 * hu) if (foreign(ex + Math.cos(ang) * d, ey + Math.sin(ang) * d)) crosses = true;
      return { ex, ey, ang, len, crosses };
    };
    const mk = wHud => textTex(label, 38 * 0.86, { strip: PAP[5], col: INK, cut: true, scale: devPerHud(), minW: wHud - 38 * 0.86, center: true, noMip: true });
    let t = null, res = null;
    for (const wpx of [150, 140, 130, 120, 110]) { // widths as at 1180x820 (HUD units: the tag scales with the screen like the hint line)
      const tt = mk(wpx / 0.82);
      res = geom(tt.lw * hu, tt.lh * hu, wpx < 150 ? 4 : 3, true);
      if (t) B.freeTex(t); t = tt; if (res) break;
    }
    if (!res) { if (t) B.freeTex(t); t = mk(150 / 0.82); res = geom(t.lw * hu, t.lh * hu, 3, false); } // no sea beside the target: the nearest open sea
    tag = spr(t, { z: 0.24, zr: 0.02, order: 130 }); tag.own = false; tag.w = t.lw * hu; tag.h = t.lh * hu; tag.rot = -0.03;
    if (!res) { const r = n.id === 'all' ? AQ.bbox : n.region; tag.x = (r[0] + r[2]) / 2; tag.y = n.id === 'all' ? r[1] - 40 : (r[1] + r[3]) / 2; tag.by = tag.y; return; }
    tag.x = res.c[1]; tag.y = res.c[2]; tag.by = tag.y; tag._dist = res.c[4];
    const pt = res.pt;
    if (pt && !pt.crosses) { // pointer: from under the tag's edge toward the nearest coast of the target
      const under = tag.h * 0.45, L = pt.len + under, bx = pt.ex - Math.cos(pt.ang) * under, by = pt.ey - Math.sin(pt.ang) * under;
      tagPtr = spr(ptrTex(), { z: 0.235, zr: 0.02, order: 129, w: L, h: Math.min(tag.h * 0.62, L * 0.5), rot: pt.ang });
      tagPtr.x = bx + Math.cos(pt.ang) * L / 2; tagPtr.y = by + Math.sin(pt.ang) * L / 2; tagPtr.by = tagPtr.y; tagPtr._len = pt.len;
    }
  }
  const h2wAt = (K, hx, hy) => [(hx / (1000 * asp) - 0.5) * K.h * asp + K.x, (hy / 1000 - 0.5) * K.h + K.y];
  function freeBaseZoom() { if (cbaseZoom) { cbaseZoom.s.own = true; kill(cbaseZoom.s); cbaseZoom = null; } }
  function clearRound() { freeBaseZoom(); clearTags(); if (!RD) return; for (const s of RD.tmp) kill(s); RD = null; drag = null; pan = null; pinch = null; mapTap = null; }
  function ensureBase(ct) { if (cbaseFor === ct.id) return; freeBaseZoom(); if (cbase) { cbase.own = true; kill(cbase); } const r = [Math.max(WREG[0], ct.region[0] - 60), Math.max(WREG[1], ct.region[1] - 60), Math.min(WREG[2], ct.region[2] + 60), Math.min(WREG[3], ct.region[3] + 80)]; const ppu = Math.min(3800 / (r[2] - r[0]), 2600 / (r[3] - r[1]), 9); cbasePpu = ppu; cbase = spr(bakeBase(r, ppu, ct), { x: (r[0] + r[2]) / 2, y: (r[1] + r[3]) / 2, w: r[2] - r[0], h: r[3] - r[1], z: 0.045, zr: 0.11, order: 1 }); cbaseFor = ct.id; }
  // ---------- round: flag table ----------
  function beginRound(ct, opt = {}) {
    timers = timers.filter(t => t.tag !== 'cmpHint');
    if (compareHopSprite && S.includes(compareHopSprite) && compareHopSprite.c) {
      killTw(compareHopSprite); compareHopSprite.y = compareHopSprite.c.cy; compareHopSprite.z = 0.17; compareHopSprite = null;
    }
    sendAllTwinsHome(!!opt.skipFlags);
    clearWind(true);
    clearRound(); allStars = false;
    const replay = opt.replay !== undefined ? opt.replay : contDone(ct);
    const r = replay ? (opt.r || 0) : 0;
    const roundHadBuilt = ct.order.some(c => isBuiltId(prog, c.id));
    let list = replay ? ct.rounds[r].slice() : nextRoundList(ct);
    if (opt.only !== undefined) list = [ct.rounds[0][opt.only % ct.rounds[0].length]];
    if (replay && r === 0) {
      ct.order.forEach(c => { hideCountry(c); c.built = false; });
      if (ct.id === 'all' && aqS) { kill(aqS); aqS = null; delete csp.AQ; AQ.built = false; }
    } else if (ct.id === 'all' || replay) list.forEach(c => { hideCountry(c); c.built = false; });
    killTag();
    RD = { ct, r, list, fi: 0, tmp: [], parts: [], hist: [], col: [], colLabels: [], queue: [], placed: [], auto: opt.auto, replay, roundHadBuilt, miss: 0, hintStep: 0 }; view.ctNext = ct;
    if (ct.id !== 'all') ensureBase(ct);
    if (opt.skipFlags) { list.forEach((c, i) => colFlag(c, i, true)); startMap(); } else startFlag();
  }
  const T0 = { x: 1000, y: 1706, h: 312 };
  function colFlag(c, i, instant, from) { const f = FL[c.id], t = flagTex(c.id, 150), hh = Math.min(62, 104 / f.a), y0 = asp < 0.9 ? 290 : 236, cy = y0 + i * (asp < 0.9 ? 112 : 120); const s = spr(t, { hud: true, rail: true, w: hh * f.a * 1.04, h: hh * 1.04, x: 92, y: cy, z: 0.1, zr: 0.04, order: 190 }); s._c = c; RD.tmp.push(s); RD.col[i] = s; const nt = mkRailLabel(c.name); const n = spr(nt, { hud: true, rail: true, z: 0.1, zr: 0.03, order: 191, own: true, w: nt.lw, h: nt.lh }); n._c = c; n.rot = [0.9, -1.3, 1.6, -0.5, 1.2, -1.75][i % 6] * DEG; n.x = 92; n.y = cy + hh * 0.52 + Math.max(14, nt.lh / 2 + 2); RD.tmp.push(n); if (RD.colLabels) RD.colLabels.push({ s: n, name: c.name, cy, hh });
    if (!instant && from) { const tx = s.x, ty = s.y, sw = s.w, sh = s.h; s.x = from[0]; s.y = from[1]; s.w = from[2]; s.h = from[3]; tw(s, { x: tx, y: ty, w: sw, h: sh }, 0.7); n.lift = 0.14; tw(n, { lift: 0 }, 0.22, { delay: 0.65 }); } }
  // batch 4: the flag table uses its space. The mat is as large as fits (up to 60% of the screen height) and every loose part lies at
  // the mat's scale in tidy rows to the right of and below the mat, with the model flag first; nothing under the HUD or the rail.
  // Straight-cut offcuts in the round's flag papers, in three sizes, fill some of the free table.
  const tableRect = camH => { layoutHud(); const K = { x: T0.x, y: T0.y, h: camH }, W = 1000 * asp, hb = (title.alpha > 0.1 ? Math.max(topHudBottom(), title.y + title.h / 2 + 8 + 38 * 0.86 * 1.65 + 4) : topHudBottom()) + 18; // room for the hint line even before it is set
    const a = h2wAt(K, 190, hb), b = h2wAt(K, W - 24, 1000 - Math.max(22, edgeHud(36))); return [a[0], a[1], b[0], b[1]]; };
  const tableFHmax = (f, camH) => { const u = tableRect(camH); return Math.max(40, Math.min(0.6 * camH / (380 / 300), (u[2] - u[0]) * 0.62 / ((f.a * 300 + 80) / 300), (u[3] - u[1]) / (380 / 300))); };
  const matTex = (f, c, k) => shapeTex((f.a * 300 + 80) * k, 380 * k, b => { B.paper(b, wob(6 * k, 6 * k, b.w - 6 * k, b.h - 6 * k, 10 * k, sid(c.id)), '#c9d3bd', 0.5); const x = b.c; x.strokeStyle = 'rgba(60,64,80,0.5)'; x.lineWidth = 1.4 * k; x.setLineDash([10 * k, 4 * k, 3 * k, 4 * k]); x.strokeRect(40 * k, 40 * k, f.a * 300 * k, 300 * k); x.setLineDash([]); x.strokeStyle = 'rgba(60,64,80,0.16)'; x.beginPath(); x.moveTo(40 * k, 190 * k); x.lineTo(b.w - 40 * k, 190 * k); x.moveTo(b.w / 2, 40 * k); x.lineTo(b.w / 2, 340 * k); x.stroke(); });
  function tableLayout(c, f, mat, model, back, parts, R, camH, instant) {
    const u = tableRect(camH), uw = u[2] - u[0], uh = u[3] - u[1];
    if (uw < 120 || uh < 120) return false;
    // batch 4 correction A: the mat is at least 46% of the screen height; the loose parts share one scale ps (1 down to 0.62 of the
    // mat's scale); rows wrap tighter before the mat would shrink below 46%
    const pack = (FH, centred, ps = 1, tight = false, byWidth = false) => {
      const g = tight ? Math.max(3, FH * 0.025) : Math.max(5, FH * 0.055), pd = tight ? 1.0 : 1.04, matW = (f.a * 300 + 80) / 300 * FH, matH = 380 / 300 * FH, mh = FH * 0.41 * Math.max(ps, 0.75);
      const items = [{ s: model, w: mh * f.a * 1.1 + g * 0.4, h: mh * 1.12 + g * 0.4, model: true }, ...parts.map(s => ({ s, w: s._t.w * FH * ps * pd, h: s._t.h * FH * ps * pd })).sort(byWidth ? (p, q) => q.w - p.w || q.h - p.h : (p, q) => q.h - p.h || q.w - p.w)];
      if (matW > u[2] - u[0] - 10) return null;
      const mx0 = centred === true ? (u[0] + u[2]) / 2 - matW / 2 : u[0]; // the mat at the top left, or at the top centre with parts on both sides and below
      const regions = centred === true ? [[mx0 + matW + g * 1.5, u[1], u[2], u[1] + matH], [u[0], u[1], mx0 - g * 1.5, u[1] + matH], [u[0], u[1] + matH + g * 1.5, u[2], u[3]]]
        : centred === 2 ? [[u[0] + matW + g * 1.5, u[1], u[2], u[1] + matH], [u[0], u[1] + matH + g * 1.5, u[2], u[3]]] // mat top left, a full-width band below
        : [[u[0] + matW + g * 1.5, u[1], u[2], u[3]], [u[0], u[1] + matH + g * 1.5, u[0] + matW + g * 1.5, u[3]]], placed = [];
      const shelves = []; // rows: each item goes on the first row with room, else a new row in the first region with room
      for (const it of items) {
        let done = false;
        for (const sh of shelves) {
          const r = regions[sh.r], last = shelves.filter(q => q.r === sh.r).pop() === sh;
          if (sh.x + it.w <= r[2] + 0.01 && (it.h <= sh.h + 0.01 || (last && sh.y + it.h <= r[3] + 0.01))) { placed.push({ it, x: sh.x + it.w / 2, y: sh.y + it.h / 2 }); sh.x += it.w + g; sh.h = Math.max(sh.h, it.h); done = true; break; }
        }
        if (done) continue;
        for (let ri = 0; ri < regions.length && !done; ri++) {
          const r = regions[ri], prev = shelves.filter(q => q.r === ri).pop(), y = prev ? prev.y + prev.h + g : r[1];
          if (it.w <= r[2] - r[0] + 0.01 && y + it.h <= r[3] + 0.01) { const sh = { r: ri, y, h: it.h, x: r[0] + it.w + g }; shelves.push(sh); placed.push({ it, x: r[0] + it.w / 2, y: y + it.h / 2 }); done = true; }
        }
        if (!done) return null;
      }
      let bx0 = mx0, by0 = u[1], bx1 = mx0 + matW, by1 = u[1] + matH; for (const p of placed) { bx0 = Math.min(bx0, p.x - p.it.w / 2); by0 = Math.min(by0, p.y - p.it.h / 2); bx1 = Math.max(bx1, p.x + p.it.w / 2); by1 = Math.max(by1, p.y + p.it.h / 2); }
      return { FH, ps, tight, g, matW, matH, mh, placed, mx0, dx: (u[0] + u[2]) / 2 - (bx0 + bx1) / 2, dy: (u[1] + u[3]) / 2 - (by0 + by1) / 2 };
    };
    const MAT = 380 / 300, FHmin = 0.46 * camH / MAT, FHtop = Math.max(FHmin, Math.min(0.6 * camH / MAT, (u[3] - u[1]) / MAT));
    const tryAll = (FH, ps, tight) => { for (const centred of [false, true, 2]) for (const bw of [false, true]) { const q = pack(FH, centred, ps, tight, bw); if (q) return q; } return null; };
    let L = null;
    search: for (const tight of [false, true]) for (let ps = 1; ps >= 0.619; ps -= 0.02) for (let FH = FHtop; FH >= FHmin - 0.01; FH = FH > FHmin + 0.5 ? Math.max(FHmin, FH * 0.97) : FH - 1) { L = tryAll(FH, ps, tight); if (L) break search; }
    if (!L) for (let FH = FHmin * 0.97; FH >= 50 && !L; FH *= 0.97) L = tryAll(FH, 0.62, true); // the mat must shrink below 46%
    if (!L) return false;
    RD.tableFit = { matPct: +(L.matH / camH * 100).toFixed(1), partScale: +L.ps.toFixed(2), tight: L.tight };
    const FH = L.FH, mx = L.mx0 + L.matW / 2 + L.dx, my = u[1] + L.matH / 2 + L.dy; RD.FH = FH; RD.mx = mx; RD.my = my;
    const k = clamp(L.matH * B.size()[1] / camH / 380, 1, 3); B.freeTex(mat.tex); mat.tex = matTex(f, c, k); mat.x = mx; mat.y = my; mat.w = L.matW; mat.h = L.matH;
    for (const p of L.placed) {
      const s = p.it.s, hx = p.x + L.dx, hy = p.y + L.dy;
      if (p.it.model) { s.x = hx; s.y = hy; s.w = L.mh * f.a * 1.04; s.h = L.mh * 1.04; s.rot = 0.04; back.x = hx; back.y = hy; back.w = L.mh * f.a * 1.1; back.h = L.mh * 1.12; back.rot = 0.04; continue; }
      const t = s._t; s.w = t.w * FH; s.h = t.h * FH; s.ts = L.ps; s.hx = hx; s.hy = hy; s.hr = (R() - 0.5) * 0.08;
      if (s.ok) { s.tx = mx + (t.cx - f.a / 2) * FH; s.ty = my + (t.cy - 0.5) * FH; }
      s.x = s.hx; s.y = instant ? s.hy : s.hy + 120; s.rot = s.hr; s.sc = L.ps; if (!instant) tw(s, { y: s.hy }, 0.5, { delay: 0.5 + parts.indexOf(s) * 0.08 });
    }
    parts.forEach((s, i) => { s.order = 40 + i; s.sig = s.sig.replace(/\|[^|]*\|[^|]*$/, '') + '|' + Math.round(s._t.w * 25) + '|' + Math.round(s._t.h * 25); });
    // offcuts: straight cuts (triangles, slivers, trapezoids) in three sizes, in the papers of this round's flags, on free table only
    const cols = []; for (const q of RD.list) for (const [ci, wgt] of FL[q.id].cols) if (ci < 12) cols.push([ci, wgt]);
    const busy = [[mx - L.matW / 2, my - L.matH / 2, mx + L.matW / 2, my + L.matH / 2], ...L.placed.map(p => [p.x + L.dx - p.it.w / 2, p.y + L.dy - p.it.h / 2, p.x + L.dx + p.it.w / 2, p.y + L.dy + p.it.h / 2])];
    const Rs = rng(sid(c.id) + 77), K = { x: T0.x, y: T0.y, h: camH }, vw = camH * asp;
    const area = [K.x - vw / 2 + 6, u[1] - 4, K.x + vw / 2 - 6, K.y + camH / 2 - 6]; let made = 0;
    for (let tries = 0; tries < 400 && made < 11; tries++) {
      const size = [0.045, 0.08, 0.13][made % 3] * FH * (0.85 + Rs() * 0.3), x = lerp(area[0] + size, area[2] - size, Rs()), y = lerp(area[1] + size, area[3] - size, Rs());
      const bx = [x - size * 0.75, y - size * 0.75, x + size * 0.75, y + size * 0.75];
      if (busy.some(b => bx[2] > b[0] - 4 && bx[0] < b[2] + 4 && bx[3] > b[1] - 4 && bx[1] < b[3] + 4)) continue;
      if (x < h2wAt(K, 180, 0)[0] && y > h2wAt(K, 0, 200)[1]) continue; // the rail
      busy.push(bx);
      let tw_ = 0; for (const q of cols) tw_ += q[1]; let pick = Rs() * tw_, ci = cols.length ? cols[0][0] : 0; for (const q of cols) { pick -= q[1]; if (pick <= 0) { ci = q[0]; break; } }
      const kind = (made + (Rs() * 3 | 0)) % 3, n = size, pts = kind === 0 ? [[-n, n * 0.7], [n, n * 0.55], [(Rs() - 0.5) * n, -n * 0.8]] : kind === 1 ? [[-n * 1.4, -n * 0.16], [n * 1.4, -n * 0.3], [n * 1.3, n * 0.1], [-n * 1.35, n * 0.2]] : [[-n, n * 0.55], [n, n * 0.55], [n * 0.55, -n * 0.55], [-n * 0.4, -n * 0.55]];
      const ppu = clamp(B.size()[1] / camH * 1.4, 2, 8), pw = n * 3.2;
      const t = shapeTex(pw * ppu, pw * ppu, b => { B.paper(b, q => { pts.forEach(([px, py], i) => i ? q.lineTo((px + pw / 2) * ppu, (py + pw / 2) * ppu) : q.moveTo((px + pw / 2) * ppu, (py + pw / 2) * ppu)); q.closePath(); }, shade(PAP[ci], (Rs() - 0.5) * 0.08), 0.45 + Rs() * 0.3); });
      const sp = spr(t, { x, y, w: pw, h: pw, z: 0.068, zr: 0.025, order: 25, rot: Rs() * 6.283 }); sp.own = true; RD.fl.push(sp); made++;
    }
    const pxW = innerHeight / Math.max(1, camH), maxOv = 6 / pxW, botOv = 4 / pxW;
    for (const s of parts) {
      const longPx = Math.max(s.w, s.h) * s.ts * pxW;
      if (!(longPx > 0 && longPx < 44)) continue;
      let fMax = Math.min(2.5, 44 / longPx);
      const hw0 = s.w * s.ts / 2, hh0 = s.h * s.ts / 2;
      const boxes = [[mx - L.matW / 2, my - L.matH / 2, mx + L.matW / 2, my + L.matH / 2]];
      if (model) boxes.push([model.x - model.w / 2, model.y - model.h / 2, model.x + model.w / 2, model.y + model.h / 2]);
      for (const o of parts) if (o !== s) boxes.push([o.hx - o.w * o.ts / 2, o.hy - o.h * o.ts / 2, o.hx + o.w * o.ts / 2, o.hy + o.h * o.ts / 2]);
      for (const b of boxes) {
        const dx = Math.max(0, b[0] - s.hx, s.hx - b[2]);
        const dy = Math.max(0, b[1] - s.hy, s.hy - b[3]);
        const fx = hw0 > 1e-6 ? (dx + maxOv) / hw0 : 1e9;
        const fy = hh0 > 1e-6 ? (dy + maxOv) / hh0 : 1e9;
        const allow = Math.max(fx, fy);
        if (allow >= 1 && allow < fMax) fMax = allow;
      }
      const allowU = Math.min(
        hw0 > 1e-6 ? (s.hx - u[0] + maxOv) / hw0 : 1e9,
        hw0 > 1e-6 ? (u[2] - s.hx + maxOv) / hw0 : 1e9,
        hh0 > 1e-6 ? (s.hy - u[1] + maxOv) / hh0 : 1e9,
        hh0 > 1e-6 ? (u[3] - s.hy + botOv) / hh0 : 1e9
      );
      if (allowU >= 1 && allowU < fMax) fMax = allowU;
      if (fMax > 1) { s.ts *= fMax; s.sc = s.ts; }
    }
    return true;
  }
  function startFlag(instant) {
    mode = 'flags'; const c = RD.list[RD.fi], f = FL[c.id], ct = RD.ct;
    timers = timers.filter(t => t.tag !== 'peek');
    const camH = Math.max(T0.h, 470 / asp);
    const camDur = instant || (Math.hypot(cam.x - T0.x, cam.y - T0.y) + Math.abs(cam.h - camH) < 1) ? 0 : 1.1;
    camTo(T0.x, T0.y, camH, camDur);
    const FH = Math.min(118, 212 / f.a), mx = 1034, my = 1692; RD.FH = FH; RD.mx = mx; RD.my = my; RD.parts = []; RD.hist = []; RD.fl = [];
    const PK = clamp(Math.ceil(0.6 * camH / (380 / 300) * B.size()[1] / camH / 40) * 40, 420, 720); // part bake size (px per flag height) for the table's scale
    const matW = (f.a * 300 + 80) / 300 * FH, matH = 380 / 300 * FH;
    const mat = spr(shapeTex(f.a * 300 + 80, 380, b => { B.paper(b, wob(6, 6, b.w - 6, b.h - 6, 10, sid(c.id)), '#c9d3bd', 0.5); const x = b.c; x.strokeStyle = 'rgba(60,64,80,0.5)'; x.lineWidth = 1.4; x.setLineDash([10, 4, 3, 4]); x.strokeRect(40, 40, f.a * 300, 300); x.setLineDash([]); x.strokeStyle = 'rgba(60,64,80,0.16)'; x.beginPath(); x.moveTo(40, 190); x.lineTo(b.w - 40, 190); x.moveTo(b.w / 2, 40); x.lineTo(b.w / 2, 340); x.stroke(); }), { x: mx, y: my, w: matW, h: matH, z: 0.1, zr: 0.02, order: 30, rot: -0.012 }); mat.own = true; RD.fl.push(mat);
    // model flag anchored to the left side of the mat
    const mh = Math.min(48, 84 / f.a), mw = mh * f.a * 1.04, mhh = mh * 1.04;
    const modelX = mx - matW / 2 - 14 - mw / 2, modelY = my;
    const model = spr(flagTex(c.id, 300), { x: modelX, y: modelY, w: mw, h: mhh, z: 0.12, zr: 0.04, order: 31, rot: 0.05 }); RD.model = model; RD.fl.push(model);
    const back = spr(peekTex(), { x: modelX, y: modelY, w: mh * f.a * 1.1, h: mh * 1.12, z: 0.13, zr: 0.02, order: 32, rot: 0.05, alpha: 0 }); back.own = true; RD.back = back; RD.fl.push(back);
    RD.memory = !attract && playerLevel() === 'own';
    RD.memShowing = true;
    // parts and decoys
    const mk = (p, own) => { const t = partTex(f, p, PK); const s = spr(t.tex, { w: t.w * FH, h: t.h * FH, z: 0.14, zr: 0.02, order: 40 }); s._t = t; s.own = true; s.part = p; s.ok = own; s.tx = mx + (t.cx - f.a / 2) * FH; s.ty = my + (t.cy - 0.5) * FH; s.sig = p.k + '|' + (p.polys ? p.polys.map(q => q.c).join('') : 's') + '|' + Math.round(t.w * 25) + '|' + Math.round(t.h * 25); s.placed = false; RD.fl.push(s); return s; };
    const own = f.parts.map((p, i) => { const s = mk(p, true); s.idx = i; return s; }); let all = own.slice();
    if (ct.decoys) { const cs = new Set(f.cols.map(q => q[0])); const cand = G.countries.filter(o => o.id !== c.id).map(o => { const os = new Set(FL[o.id].cols.map(q => q[0])); let n = 0; cs.forEach(k => { if (os.has(k)) n++; }); return { o, j: n / (cs.size + os.size - n) + hs(sid(o.id), sid(c.id)) * 0.05 }; }).sort((a, b) => b.j - a.j).slice(0, 2);
      const sigs = new Set(own.map(s => s.sig)); let nd = 0; for (const { o } of cand) for (const p of FL[o.id].parts) { if (nd >= 3 || p.k === 'bands') continue; const f2 = FL[o.id]; const t = partTex(f2, p, PK); const s = spr(t.tex, { w: t.w * FH, h: t.h * FH, z: 0.14, zr: 0.02, order: 40 }); s._t = t; s.own = true; s.ok = false; s.sig = p.k + '|' + (p.polys ? p.polys.map(q => q.c).join('') : 's') + '|' + Math.round(t.w * 25) + '|' + Math.round(t.h * 25); if (sigs.has(s.sig)) { kill(s); continue; } sigs.add(s.sig); RD.fl.push(s); all.push(s); nd++; } }
    const R = rng(sid(c.id) + 3); const ordr = all.map((s, i) => [R(), s]).sort((a, b) => a[0] - b[0]).map(q => q[1]); const n = ordr.length, sp = Math.min(96, 420 / n);
    if (!tableLayout(c, f, mat, model, back, ordr, R, camH, instant))
    ordr.forEach((s, i) => { s.ts = Math.min(0.62, sp * 0.9 / s.w, 62 / s.h); s.hx = 1000 + (i - (n - 1) / 2) * sp; s.hy = 1812 + (i % 2) * 7; s.hr = (R() - 0.5) * 0.3; s.x = s.hx; s.y = instant ? s.hy : s.hy + 120; s.rot = s.hr; s.sc = s.ts; s.order = 40 + i; if (!instant) tw(s, { y: s.hy }, 0.5, { delay: 0.5 + i * 0.08 }); });
    RD.parts = all; RD.tmp.push(...RD.fl);
    if (attract) {
      setHint('Tap to play');
    } else if (RD.memory) {
      if (RD.replay) {
        back.alpha = 1; RD.memShowing = false;
        setHint('Build ' + inSent(c) + ' from memory');
      } else {
        setHint('This is ' + inSent(c));
        after(camDur + 3.0, () => {
          peek(false);
          if (RD && mode === 'flags' && RD.list[RD.fi] === c && !RD.parts.every(p => !p.ok || p.placed)) setHint('Build ' + inSent(c) + ' from memory');
        }, 'peek');
      }
    } else {
      setHint(ct.decoys ? 'Pick the right parts for ' + inSent(c) : 'Build the flag of ' + inSent(c));
    }
    if (RD.auto) own.forEach((s, i) => after(1.6 + i * 1.15, () => { if (!RD || mode !== 'flags' || s.placed) return; s.order = 80; tw(s, { lift: 0.3, sc: 1 }, 0.25); tw(s, { x: s.tx, y: s.ty, rot: 0 }, 0.7, { delay: 0.2, done: () => { if (RD && mode === 'flags' && !s.placed) placePart(s, s); } }); }, 'rd'));
  }
  function peek(show) {
    if (!RD || !RD.back) return;
    const m = RD.model, b = RD.back;
    timers = timers.filter(t => t.tag !== 'peek');
    if (show) {
      b.alpha = 0; RD.memShowing = true;
      m.lift = 0.15; tw(m, { lift: 0 }, 0.4, { cut: true });
      after(3.0, () => peek(false), 'peek');
    } else if (RD.memory) {
      b.alpha = 1; RD.memShowing = false;
      b.lift = 0.14; tw(b, { lift: 0 }, 0.2, { cut: true });
    }
  }
  function placePart(s, slot, silent) { // s takes the slot of an equivalent part
    if (slot !== s) { const a = [s.tx, s.ty, s.idx]; s.tx = slot.tx; s.ty = slot.ty; s.idx = slot.idx; slot.tx = a[0]; slot.ty = a[1]; slot.idx = a[2]; }
    s.placed = true; s.order = 41 + s.idx; s.z = 0.14 + s.idx * 0.012;
    if (silent) { killTw(s); s.x = s.tx; s.y = s.ty; s.rot = 0; s.sc = 1; s.lift = 0; }
    else { tw(s, { x: s.tx, y: s.ty, rot: 0, sc: 1, lift: 0 }, 0.2, { cut: true }); sfx.snap(); }
    RD.hist.push(s);
    if (!silent && RD.parts.every(p => !p.ok || p.placed)) { timers = timers.filter(t => t.tag !== 'peek'); after(0.32, flagDone, 'rd'); }
  }
  function flagDone() {
    const c = RD.list[RD.fi], f = FL[c.id]; sfx.thump(); speakCountry(c, false); const own = RD.parts.filter(p => p.ok);
    own.forEach(s => { s.lift = 0.1; s.sc = 1.05; tw(s, { lift: 0, sc: 1 }, 0.18, { cut: true }); }); cam.y += 3; tw(cam, { y: T0.y }, 0.3, { smooth: true });
    RD.parts.filter(p => !p.ok).forEach(s => tw(s, { y: s.y + 140 }, 0.5));
    const px = Math.max(48, Math.ceil(15 * B.size()[1] / T0.h));
    const n = spr(textTex(c.name, px, { strip: CREAM, col: INK }), { z: 0.16, zr: 0.03, order: 60, x: RD.mx, y: RD.my + RD.FH / 2 + 22, lift: 0.16 }); const k = 15 / n.h; n.w *= k; n.h *= k; n.own = true; RD.tmp.push(n); tw(n, { lift: 0 }, 0.2);
    if (!attract) setHint('That is ' + inSent(c));
    after(1.25, () => { const p = w2h(RD.mx, RD.my), sc = 1000 / cam.h; const i = RD.fi; colFlag(c, i, false, [p[0], p[1], RD.FH * f.a * sc, RD.FH * sc]);
      // batch 4: taken away in stop-motion, 5 frames at 12 fps, no longer than before: the built flag flies to the rail as before,
      // the label lifts off first, then the mat slides out with the model, the peek card and the leftover parts
      RD.fl.forEach(s => { if (s.ok && s.placed) kill(s); else { killTw(s); tw(s, { y: s.y + 230, rot: s.rot + 0.05 }, 0.25, { delay: 1 / 12 + 0.001, done: () => kill(s) }); } });
      killTw(n); n.lift = 0.3; tw(n, { y: n.y - 22, lift: 0.46, rot: -0.05 }, 0.17, { cut: true, done: () => kill(n) });
      RD.tmp = RD.tmp.filter(s => S.includes(s)); RD.fi++; if (RD.fi < RD.list.length) after(0.5, startFlag, 'rd'); else after(0.8, startMap, 'rd'); }, 'rd');
  }
  // ---------- round: the map ----------
  const CARD_FRAC = 0.24;
  const tbox = c => c === AQ ? AQ.bbox : c.isCard ? [c.cx - 20, c.cy - 20, c.cx + 20, c.cy + 20] : c.bbox;
  const marginFor = c => { const m = mapMar(); if (c.isCard) m.r = Math.max(m.r, 0.07 + CARD_FRAC / asp); return m; };
  const cardRectAt = Kc => {
    const cs = CARD_FRAC * Kc.h;
    const cx = Kc.x + (0.5 - 0.04 - CARD_FRAC * 0.5 / asp) * Kc.h * asp;
    const cy = Kc.y + ((asp < 0.9 ? 0.58 : 0.54) - 0.5) * Kc.h;
    return { x: cx, y: cy, s: cs, box: [cx - cs * 0.5, cy - cs * 0.5, cx + cs * 0.5, cy + cs * 0.5] };
  };
  const ownCardRect = Kc => {
    const cs = (asp < 0.9 ? 0.20 : 0.22) * Kc.h;
    const topHud = topHudBottom() / 1000;
    const yFrac = Math.max(topHud + 0.03 + 0.055, asp < 0.9 ? 0.28 : 0.19) + (cs / Kc.h) * 0.5; // batch 4: room above the card for the landed flag on its pole (at most 15.5/330 of the view), clear of the HUD
    const cx = Kc.x + (0.5 - 0.03 - (cs * 0.5) / (Kc.h * asp)) * Kc.h * asp;
    const cy = Kc.y + (yFrac - 0.5) * Kc.h;
    return { x: cx, y: cy, s: cs, box: [cx - cs * 0.5, cy - cs * 0.5, cx + cs * 0.5, cy + cs * 0.5] };
  };
  function syncLeader() {
    if (!RD || !RD.card || !RD.spot) return;
    const c = RD.cardSpec; if (!c) return;
    const cr = { x: RD.card.x, y: RD.card.y, s: RD.card.w };
    const spotR = clamp(Math.max(c.bw, c.bh) * 0.68, 2.8, 12);
    const dx = cr.x - c.cx, dy = cr.y - c.cy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const p0 = [c.cx + ux * (spotR * 1.05), c.cy + uy * (spotR * 1.05)];
    const tCard = (cr.s * 0.45) / Math.max(Math.abs(dx), Math.abs(dy), 1e-4);
    const p1 = [cr.x - dx * tCard, cr.y - dy * tCard];
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    if (len > 2 && RD.leader) {
      RD.leader.x = (p0[0] + p1[0]) / 2; RD.leader.y = (p0[1] + p1[1]) / 2;
      RD.leader.w = len; RD.leader.h = 2.4 * (cam.h / 130);
      RD.leader.rot = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    }
  }
  function syncPieceFlags() {
    if (!RD) return;
    const F = Math.floor(T * 12), ownLv = playerLevel() === 'own';
    const vs = (ownLv || !RD.vh ? cam.h : RD.vh) / 330;
    for (const s of [RD.piece, ...RD.placed]) syncTile(s);
    for (const s of [RD.piece, ...RD.placed]) if (s && s.flag) {
      const wg = s.wig !== undefined ? Math.sin((T - s.wig) * 30) * 0.06 : 0;
      const fa = s.flag.fAspect || 1.5;
      if (RD.cardLanded === s && s._onCard && RD.card) {
        const c = s.c;
        const shapeA = (c.A || (c.bw * c.bh * 0.5)) * s.sc * s.sc;
        const maxFh = Math.sqrt((0.14 * shapeA) / fa) / 1.04;
        const fh = Math.min(10 * vs, maxFh);
        const flagW = fh * fa * 1.04, flagH = fh * 1.04;
        const poleH = Math.max(fh * 1.55, 11 * vs);
        const poleW = clamp(fh * 0.08, 0.7 * vs, 1.1 * vs);
        const baseX = RD.card.x - flagW * 0.45, baseY = RD.card.y - RD.card.h * 0.5 + 1.5 * vs;
        s.pole.x = baseX; s.pole.y = baseY - poleH * 0.5; s.pole.w = poleW; s.pole.h = poleH;
        s.pole.lift = s.lift; s.pole.rot = wg;
        s.flag.w = flagW; s.flag.h = flagH; s.flag.sc = 1;
        s.flag.x = baseX + flagW * 0.5 + poleW * 0.4;
        s.flag.y = baseY - poleH + flagH * 0.48;
      } else {
        const anc = anchorOf(s);
        s.pole.x = anc[0]; s.pole.y = anc[1] - 15 * vs; s.pole.w = 1.1 * vs; s.pole.h = 30 * vs;
        s.pole.lift = s.lift; s.pole.rot = wg;
        const fh = 17 * vs;
        if (s.flag.landed) {
          s.flag.w = fh * fa * 1.04; s.flag.h = fh * 1.04;
          s.flag.fx = fh * fa * 0.52 + 0.5 * vs; s.flag.fy = -30 * vs + fh * 0.5;
          s.flag.fs = 1;
        }
        s.flag.x = anc[0] + s.flag.fx; s.flag.y = anc[1] + s.flag.fy; s.flag.sc = s.flag.fs;
      }
      s.flag.lift = s.lift; s.flag.alpha = s.pole.alpha = s.alpha;
      const fu = s.flag.flutT !== undefined ? T - s.flag.flutT : -1;
      s.flag.flut = fu > 0 && fu < 3 ? 0.5 + F * 0.9 : (s === RD.piece ? 0.5 + Math.floor(T * 6) * 0.5 : 0);
    }
  }
  function syncDynamicOverlays() {
    if (mode === 'world') {
      for (const n of activeTags) layoutTagSprite(n);
      return;
    }
    if (mode !== 'map' && mode !== 'wind') return;
    if (RD && playerLevel() === 'own') {
      if (RD.card && !RD.cardDying) {
        const cr = ownCardRect(cam);
        RD.card.x = cr.x; RD.card.y = cr.y; RD.card.w = cr.s; RD.card.h = cr.s;
        if (RD.cardLanded) {
          const lc = RD.cardLanded, cardSc = (0.72 * cr.s) / Math.max(lc.c.bw, lc.c.bh);
          lc.tp = { x: cr.x, y: cr.y, sc: cardSc };
          if (lc._onCard) { lc.x = cr.x; lc.y = cr.y; lc.sc = cardSc; }
        }
        syncLeader();
      }
      if (RD.piece) syncWaitingPiece(RD.piece);
    }
    if (RD && RD.wind) syncWindPile();
    for (const id in csp) syncStar(csp[id]);
    for (const n of activeTags) layoutTagSprite(n);
    syncPieceFlags();
  }
  function waitSlot(s) {
    const pxHud = innerHeight / 1000;
    const maxPx = Math.min(innerWidth, innerHeight) * 0.295;
    const targetLongPx = clamp(innerHeight * 0.20, Math.min(110, maxPx), maxPx);
    const longHud = targetLongPx / Math.max(0.1, pxHud);
    const baseMax = Math.max(s.w, s.h);
    const scHud = longHud / baseMax;
    const scWorld = (longHud * cam.h / 1000) / baseMax;
    const co = Math.abs(Math.cos(s.rot)), si = Math.abs(Math.sin(s.rot));
    const wHud = (co * s.w + si * s.h) * scHud, hHud = (si * s.w + co * s.h) * scHud;
    let hx = 1000 * asp - 28 - wHud * 0.5 - 10;
    let hy = 1000 - Math.max(28, edgeHud(36)) - hHud * 0.5;
    const edge = Math.max(18, 12 / Math.max(0.1, pxHud) + 2); // at least 12 px inside the screen
    if (s.c && s.c !== AQ && FL[s.c.id]) { // batch 4: the flag on its pole stands right of the anchor; keep it on screen
      const d = anchorDelta(s.c), axHud = (d[0] * Math.cos(s.rot) - d[1] * Math.sin(s.rot)) * scHud, flagR = 17 * 1000 / 330 * FL[s.c.id].a * 1.04 + 4;
      hx = Math.min(hx, 1000 * asp - edge - axHud - flagR);
    }
    if (s.c && tileInfo(s.c)) { // batch 4 correction D: the sea tile is larger than the piece; keep all of it inside the screen
      const t = tileTex(s.c), tw2 = (co * t.w + si * t.h) * scHud * 0.5, th2 = (si * t.w + co * t.h) * scHud * 0.5;
      hx = Math.min(hx, 1000 * asp - edge - tw2); hy = Math.min(hy, 1000 - edge - th2);
    }
    const w = h2w(hx, hy);
    return { hx, hy, wx: w[0], wy: w[1], sc: scWorld };
  }
  function syncWaitingPiece(s) {
    if (!s) return;
    if (s.waiting) {
      const slot = waitSlot(s);
      s.x = slot.wx; s.y = slot.wy; s.sc = slot.sc;
    } else if (s.returning) {
      const r = s.returning;
      const slot = waitSlot(s);
      const tq = Math.floor(T * 12) / 12 + 1 / 12;
      const u = clamp((tq - r.t0) / r.dur, 0, 1), e = ease(u);
      s.x = lerp(r.fromX, slot.wx, e);
      s.y = lerp(r.fromY, slot.wy, e);
      s.sc = lerp(r.fromSc, slot.sc, e);
      if (T - r.t0 >= r.dur) { s.returning = null; s.waiting = true; s.lift = 0.12; s.x = slot.wx; s.y = slot.wy; s.sc = slot.sc; }
    }
  }
  function killCardOverlays(immediate) {
    if (!RD) return;
    RD.cardSpec = null;
    if (RD.leader) { kill(RD.leader); RD.leader = null; }
    if (RD.spot) { kill(RD.spot); RD.spot = null; }
    if (RD.cardName) {
      const on = RD.cardName; RD.cardName = null;
      const idx = activeTags.indexOf(on); if (idx >= 0) activeTags.splice(idx, 1);
      if (immediate) kill(on);
      else { killTw(on); on.lift = 0.2; tw(on, { y: on.y - 12 * (cam.h / 330), lift: 0.3 }, 0.22, { cut: true, done: () => kill(on) }); }
    }
    if (RD.card) {
      const oc = RD.card; RD.card = null; RD.cardDying = true;
      if (immediate) { kill(oc); RD.cardDying = false; }
      else tw(oc, { x: oc.x + oc.w * 1.6, lift: 0.28, rot: 0.12 }, 0.26, { cut: true, done: () => { kill(oc); if (RD) RD.cardDying = false; } });
    }
    RD.tmp = RD.tmp.filter(s => S.includes(s));
  }
  function settleCard(immediate) {
    if (!RD) return;
    killCardOverlays(immediate);
    if (RD.cardLanded) {
      const lc = RD.cardLanded; RD.cardLanded = null; lc._onCard = false;
      const pl = lc.pole, fl = lc.flag, st = lc.star, tl = lc.tile; lc.pole = null; lc.flag = null; lc.star = null; lc.tile = null; lc._starReady = false;
      for (const fs of [pl, fl, st, tl]) {
        if (!fs) continue;
        if (immediate) kill(fs);
        else { killTw(fs); tw(fs, { y: fs.y - 28 * (cam.h / 330), lift: 0.34, rot: 0.18 }, 0.28, { cut: true, done: () => kill(fs) }); }
      }
      const p = placeOf(lc.c);
      if (immediate) { killTw(lc); lc.x = p.x; lc.y = p.y; lc.sc = p.sc; lc.order = 20; lc._starReady = true; syncStar(lc); }
      else tw(lc, p, 0.45, { cut: true, done: () => { lc.order = 20; lc._starReady = true; syncStar(lc); } });
    }
  }
  function framePiece(c) {
    const ct = RD.ct, isAll = ct.id === 'all', m = marginFor(c);
    const reg = tbox(c);
    const rw = Math.max(10, reg[2] - reg[0]), rh = Math.max(10, reg[3] - reg[1]), md = Math.max(rw, rh);
    const grown = [reg[0] - 0.6 * rw, reg[1] - 0.6 * rh, reg[2] + 0.6 * rw, reg[3] + 0.6 * rh];
    const hIdeal = md * 3 / Math.min(1, asp);
    const seaMaxH = Math.min((SEA_BOX[2] - SEA_BOX[0]) / asp, SEA_BOX[3] - SEA_BOX[1]);
    const worldH = fitCam([-40, -40, 2040, 1014], { l: 0.03, r: 0.03, t: asp < 0.9 ? 0.24 : 0.17, b: 0.03 }, 0, false).h;
    const contH = isAll ? worldH : Math.min(seaMaxH, fitCam(ct.region, mapMar(), 0, true).h);
    const maxAllowH = isAll ? worldH : seaMaxH;
    const kGrown = fitCam(grown, m, Math.max(130, hIdeal), true, grown);
    let K = kGrown.h <= contH ? kGrown : fitCam(reg, m, contH, true, reg);
    const rot = ct.rotate && c !== AQ ? [1, 2, 3][Math.floor(hs(sid(c.id), 9) * 3)] * Math.PI / 2 : 0;
    const d = anchorDelta(c), co = Math.cos(rot), si = Math.sin(rot), aco = Math.abs(co), asi = Math.abs(si);
    const unbuilt = RD.list.filter(q => !q.built && q !== c);
    const isWater = (px, py) => px < -24 || px > 2024 || py < -22 || py > 996 || !land(px, py);
    const findSpawn = Kc => {
      const cardRect = c.isCard ? cardRectAt(Kc) : null;
      const sc = c.isCard ? (0.72 * cardRect.s) / Math.max(c.bw, c.bh) : 1;
      const adx = (d[0] * co - d[1] * si) * sc, ady = (d[0] * si + d[1] * co) * sc;
      const hw = (aco * c.tw + asi * c.th) * sc * 0.5, hh = (asi * c.tw + aco * c.th) * sc * 0.5;
      const v = Kc.h / 330;
      const sx0 = Kc.x + (m.l + 0.01 - 0.5) * Kc.h * asp, sx1 = Kc.x + (1 - m.r - 0.01 - 0.5) * Kc.h * asp;
      const sy0 = Kc.y + (m.t + 0.01 - 0.5) * Kc.h, sy1 = Kc.y + (1 - m.b - 0.01 - 0.5) * Kc.h;
      const minX = sx0 + hw, maxX = Math.min(sx1 - hw, sx1 - adx - 26 * v);
      const minY = sy0 + Math.max(hh, 32 * v - ady), maxY = sy1 - hh;
      const fxLo = sx0 + Math.max(22 * v, 22 * v - adx), fxHi = sx1 - Math.max(26 * v, 26 * v + adx);
      const fyLo = sy0 + Math.max(32 * v, 32 * v - ady), fyHi = sy1 - Math.max(22 * v, 22 * v + ady);
      const xLo = minX <= maxX ? minX : Math.min(fxLo, (fxLo + fxHi) / 2), xHi = minX <= maxX ? maxX : Math.max(fxHi, (fxLo + fxHi) / 2);
      const yLo = minY <= maxY ? minY : Math.min(fyLo, (fyLo + fyHi) / 2), yHi = minY <= maxY ? maxY : Math.max(fyHi, (fyLo + fyHi) / 2);
      const tp = cardRect ? { x: cardRect.x, y: cardRect.y, sc } : { x: c.cx, y: c.cy, sc: 1 };
      const prefX = Kc.x + (0.5 - m.r - 0.14) * Kc.h * asp - adx, prefY = Kc.y + Kc.h * 0.18 - ady;
      let bX = clamp(prefX, xLo, xHi), bY = clamp(prefY, yLo, yHi), bCost = 1e9, bOwn = 1e9;
      const fits = minX <= maxX && minY <= maxY;
      const pad = 4 * v;
      const nx = 11, ny = 9;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const gx = lerp(xLo, xHi, i / (nx - 1)), gy = lerp(yLo, yHi, j / (ny - 1));
        let own = 0, other = 0;
        const hitBox = b => {
          const ix = Math.max(0, Math.min(gx + hw + pad, b[2]) - Math.max(gx - hw - pad, b[0]));
          const iy = Math.max(0, Math.min(gy + hh + pad, b[3]) - Math.max(gy - hh - pad, b[1]));
          return ix * iy;
        };
        const oTarget = hitBox(reg);
        if (oTarget > 0) own += 1000 + oTarget;
        if (cardRect) { const oCard = hitBox(cardRect.box); if (oCard > 0) own += 1000 + oCard; }
        for (const u of unbuilt) { const oU = hitBox(tbox(u)); if (oU > 0) other += 250 + oU; }
        let waterPts = 0;
        for (const [ox, oy] of [[0, 0], [-hw * 0.55, -hh * 0.55], [hw * 0.55, -hh * 0.55], [-hw * 0.55, hh * 0.55], [hw * 0.55, hh * 0.55]]) {
          if (isWater(gx + ox, gy + oy)) waterPts++;
        }
        const distPref = Math.hypot((gx - prefX) / Math.max(1, Kc.h * asp), (gy - prefY) / Math.max(1, Kc.h));
        const boxGap = b => Math.hypot(Math.max(0, Math.max(b[0] - (gx + hw), (gx - hw) - b[2])), Math.max(0, Math.max(b[1] - (gy + hh), (gy - hh) - b[3])));
        const nearTp = Math.min(boxGap(reg), cardRect ? boxGap(cardRect.box) : 1e9);
        const tooClose = nearTp < 12 * v ? 200 : 0;
        const cost = own + other + tooClose + (5 - waterPts) * 40 + distPref * 15;
        if (cost < bCost) { bCost = cost; bOwn = own + (fits ? 0 : 1000); bX = gx; bY = gy; }
      }
      return { x: bX, y: bY, cost: bCost, own: bOwn, cardRect, tp };
    };
    let best = findSpawn(K);
    if (best.own > 0) {
      for (let h = K.h * 1.06; h <= maxAllowH * 1.001; h *= 1.06) {
        const Kw = fitCam(reg, m, Math.min(h, maxAllowH), true, reg);
        const b2 = findSpawn(Kw);
        if (b2.own === 0 || b2.cost < best.cost - 400) {
          K = Kw; best = b2;
          if (b2.own === 0) break;
        }
      }
    }
    return { K, best, rot };
  }
  function startMap() {
    mode = 'map'; const ct = RD.ct; setView(ct.id === 'all' ? null : ct);
    RD.queue = RD.list.slice();
    if (playerLevel() === 'own') {
      const K0 = contFrame(ct);
      RD.baseCam = K0; RD.cam = K0; RD.vh = K0.h;
      const dist = Math.hypot(cam.x - K0.x, cam.y - K0.y) + Math.abs(cam.h - K0.h);
      const dur = dist < 1 ? 0 : clamp(0.45 + dist / 950, 0.55, 1.0);
      if (dur > 0) {
        RD.spawning = RD.queue[0] || true;
        camTo(K0.x, K0.y, K0.h, dur);
        after(dur, () => { if (!RD || mode !== 'map') return; RD.spawning = null; nextPiece(); }, 'rd');
      } else nextPiece();
      return;
    }
    nextPiece();
  }
  let sessionRounds = 0, wind = null;
  const windStrength = () => {
    if (!wind || wind.phase === 'putback') return 0;
    const el = T - wind.t0;
    if (el < 0) return 0;
    if (el < 0.28) return el / 0.28;
    if (el < 1.65) return 1;
    if (el < 2.25) return Math.max(0, 1 - (el - 1.65) / 0.6);
    return 0;
  };
  function clearWind(killSprites = true) {
    timers = timers.filter(t => t.tag !== 'wind');
    if (!wind) return;
    for (const s of wind.curls) kill(s);
    for (const s of wind.stars) kill(s);
    for (const n of wind.flyingTags) kill(n);
    if (killSprites) {
      for (const it of wind.items) if (it.s && S.includes(it.s) && csp[it.c.id] !== it.s) kill(it.s);
      if (RD && RD.windPile) for (const id in RD.windPile) if (RD.windPile[id]) kill(RD.windPile[id]);
    }
    wind = null;
  }
  function pickWindCountries(ct, excludeList = []) {
    const p = currentPlayer();
    const rec = p && p.rec ? p.rec : {};
    const ex = new Set(excludeList.map(c => c.id));
    const elig = ct.order.filter(c => !c.isCard && isBuiltId(prog, c.id) && !ex.has(c.id));
    if (elig.length < 2) return [];
    const recW = c => (rec[c.id] && rec[c.id].w) || 0;
    const recT = c => (rec[c.id] && rec[c.id].t) || 0;
    elig.sort((a, b) => (recW(b) - recW(a)) || (recT(a) - recT(b)) || a.id.localeCompare(b.id));
    const wrongPos = elig.filter(c => recW(c) > 0).length;
    const n = elig.length < 3 ? elig.length : (elig.length >= 5 || wrongPos >= 3) ? 3 : 2;
    return elig.slice(0, n);
  }
  function pileSlotAt(K, s, idx, total) {
    const pxHud = Math.max(0.1, innerHeight / 1000);
    const maxPx = Math.min(innerWidth, innerHeight) * 0.295;
    const waitLongHud = clamp(innerHeight * 0.20, Math.min(110, maxPx), maxPx) / pxHud;
    const pileLongHud = waitLongHud * 0.72;
    const baseMax = Math.max(s.w, s.h);
    const scHud = pileLongHud / baseMax;
    const scWorld = (pileLongHud * K.h / 1000) / baseMax;
    const offs = total <= 2 ? [[-44, -14, -0.22], [28, 12, 0.16]] : [[-58, -18, -0.24], [24, -6, 0.18], [-12, 22, -0.07]];
    const [dx, dy, rot] = offs[idx % offs.length];
    const co = Math.abs(Math.cos(rot)), si = Math.abs(Math.sin(rot));
    const hwHud = (co * s.w + si * s.h) * scHud * 0.5, hhHud = (si * s.w + co * s.h) * scHud * 0.5;
    if (!pileGust || pileGust.K !== K || pileGust.n !== total) pileGust = { K, n: total, ct: wind ? wind.ct : (RD && RD.ct), a: pileSpot(K, (wind && wind.ct) || (RD && RD.ct) || CI.sa, total <= 2 ? [44 + pileLongHud / 2, 14 + pileLongHud * 0.45, 28 + pileLongHud / 2, 12 + pileLongHud * 0.45] : [58 + pileLongHud / 2, 18 + pileLongHud * 0.45, 24 + pileLongHud / 2, 22 + pileLongHud * 0.45], { x: 1000 * asp - 115, y: 888 }, []) }; // batch 4: off the continent
    const hx = clamp(pileGust.a.x + dx, 190 + hwHud, 1000 * asp - hwHud - 22);
    const hy = clamp(pileGust.a.y + dy, 300 + hhHud, 1000 - hhHud - Math.max(22, edgeHud(36)));
    const w = h2wAt(K, hx, hy);
    return { hx, hy, wx: w[0], wy: w[1], sc: scWorld, rot };
  }
  function mkPileSprite(c, K, idx, total) {
    bakeCountry(c);
    const s = spr(c.tex, { x: c.cx, y: c.cy, w: c.tw, h: c.th, sc: 1, z: 0.2, zr: 0.045, order: 92 + idx, lift: 0.05 + idx * 0.03, cells: 6 });
    s.c = c;
    const sl = pileSlotAt(K, s, idx, total);
    s.x = sl.wx; s.y = sl.wy; s.sc = sl.sc; s.rot = sl.rot;
    return s;
  }
  function syncWindPile() {
    if (!RD || !RD.wind || !RD.windPile) return;
    const K = cam, ownLv = playerLevel() === 'own';
    const rem = RD.queue.filter(c => RD.windPile[c.id]);
    const waitW = (ownLv && RD.piece) ? (Math.max(RD.piece.w, RD.piece.h) * RD.piece.sc * 1000 / Math.max(1, cam.h)) : 0;
    rem.forEach((c, idx) => {
      const s = RD.windPile[c.id];
      if (!s || !S.includes(s)) return;
      const pxHud = Math.max(0.1, innerHeight / 1000);
      const maxPx = Math.min(innerWidth, innerHeight) * 0.295;
      const waitLongHud = clamp(innerHeight * 0.20, Math.min(110, maxPx), maxPx) / pxHud;
      const pileLongHud = waitLongHud * 0.62;
      const baseMax = Math.max(s.w, s.h);
      const scWorld = (pileLongHud * K.h / 1000) / baseMax;
      const A = pileAnchor(rem.length, pileLongHud, ownLv, waitW);
      const hx = A.x - idx * (ownLv ? 46 : 54);
      const hy = A.y + (idx % 2) * 14;
      const w = h2wAt(K, hx, hy);
      s.x = w[0]; s.y = w[1]; s.sc = scWorld;
    });
  }
  // batch 4: the pile of lifted pieces lies where it covers no country of the continent being played (judged for the camera the
  // round is heading to); it moves there in stop-motion when that changes
  function pileSpot(K, ct, ext, def, obst) { // ext: the pile's box around its anchor in HUD units [left, up, right, down]
    const W = 1000 * asp, hb = topHudBottom() + 16, railR = 190, botPad = Math.max(22, edgeHud(36));
    const boxOf = a => [a.x - ext[0], a.y - ext[1], a.x + ext[2], a.y + ext[3]];
    const land = b => { // sample the pile's box against the continent's countries
      const w0 = h2wAt(K, b[0], b[1]), w1 = h2wAt(K, b[2], b[3]); let hits = 0;
      for (const c of ct.order) { const bb = c.bbox; if (bb[2] < w0[0] || bb[0] > w1[0] || bb[3] < w0[1] || bb[1] > w1[1]) continue;
        for (let j = 0; j <= 4; j++) for (let i = 0; i <= 6; i++) if (pipPolys(w0[0] + (w1[0] - w0[0]) * i / 6, w0[1] + (w1[1] - w0[1]) * j / 4, c.polys)) hits++;
        for (const r of c.polys) for (let i = 0; i < r.length; i += 4) if (r[i] > w0[0] && r[i] < w1[0] && r[i + 1] > w0[1] && r[i + 1] < w1[1]) { hits++; break; } }
      return hits; };
    const xs = [def.x, W - 22 - ext[2], W * 0.75, W * 0.5, railR + ext[0]], ys = [def.y, 1000 - botPad - ext[3], 700, 500, hb + ext[1]];
    let best = def, bs = 1e18;
    for (const y of ys) for (const x of xs) {
      const a = { x: clamp(x, railR + ext[0], W - 22 - ext[2]), y: clamp(y, hb + ext[1], 1000 - botPad - ext[3]) }, b = boxOf(a);
      let ov = 0; for (const o of obst) ov += Math.max(0, Math.min(b[2], o[2]) - Math.max(b[0], o[0])) * Math.max(0, Math.min(b[3], o[3]) - Math.max(b[1], o[1]));
      const sc = land(b) * 1e5 + ov * 10 + Math.hypot(a.x - def.x, a.y - def.y);
      if (sc < bs) { bs = sc; best = a; }
    }
    return best;
  }
  function pileAnchor(n, L, ownLv, waitW) {
    const W = 1000 * asp, K = RD.cam || cam, def = { x: ownLv ? W - Math.max(220, waitW + 125) : W - 115, y: 916 };
    const key = [n, Math.round(K.x), Math.round(K.y), Math.round(K.h), Math.round(W), ownLv ? 1 : 0, RD.card ? 1 : 0].join('|');
    if (!RD.pile || RD.pile.key !== key) {
      const obst = [], step = ownLv ? 46 : 54;
      if (RD.card) { const c0 = w2hAt(K, RD.card.x - RD.card.w / 2, RD.card.y - RD.card.h / 2), c1 = w2hAt(K, RD.card.x + RD.card.w / 2, RD.card.y + RD.card.h / 2); obst.push([c0[0] - 10, c0[1] - 60, c1[0] + 10, c1[1] + 60]); }
      if (ownLv && RD.piece) obst.push([W - waitW - 60, 1000 - waitW - 60, W, 1000]);
      const best = pilePrev && pilePrev.key === key ? pilePrev.to : pileSpot(K, RD.ct, [L / 2 + (n - 1) * step, L * 0.45, L / 2, L * 0.45 + 14], def, obst);
      const from = RD.pile ? RD.pile.cur() : (pileGust && pileGust.ct === RD.ct ? pileGust.a : best);
      RD.pile = { key, to: best, from, t0: Math.floor(T * 12) / 12, cur() { const u = clamp((Math.floor(T * 12) / 12 - this.t0) / 0.42, 0, 1), e = ease(u); return { x: lerp(this.from.x, this.to.x, e), y: lerp(this.from.y, this.to.y, e) }; } };
      pilePrev = RD.pile;
    }
    return RD.pile.cur();
  }
  let pileGust = null, pilePrev = null;
  const w2hAt = (K, x, y) => [((x - K.x) / (K.h * asp) + 0.5) * 1000 * asp, ((y - K.y) / K.h + 0.5) * 1000];
  function startWindGust(ct, taken) {
    sendAllTwinsHome(true);
    clearWind(true);
    const takenSet = new Set(taken);
    const flyingTags = [];
    for (let i = activeTags.length - 1; i >= 0; i--) {
      const n = activeTags[i];
      if (n._c && takenSet.has(n._c)) {
        activeTags.splice(i, 1);
        if (RD && RD.cardName === n) RD.cardName = null;
        n._dying = false;
        flyingTags.push(n);
      }
    }
    clearRound();
    mode = 'wind';
    windForce = false;
    setView(ct);
    const K0 = contFrame(ct);
    camCont(ct, 0.85);
    setHint('The wind took ' + (taken.length === 2 ? 'two' : 'three') + ' countries');
    sfx.wind();
    const vs0 = K0.h / 330;
    for (let i = 0; i < flyingTags.length; i++) {
      const n = flyingTags[i];
      killTw(n);
      tw(n, { x: n.x + 120 * vs0, y: n.y - 46 * vs0, rot: 0.28 + i * 0.1, lift: 0.42 }, 0.72, { delay: i * 0.08, done: () => kill(n) });
    }
    const items = [], stars = [];
    taken.forEach((c, i) => {
      let s = csp[c.id];
      if (s) {
        delete csp[c.id];
        if (s.star) {
          const st = s.star; s.star = null; s._starReady = false;
          if (st.alpha > 0.1) {
            stars.push(st);
            killTw(st);
            tw(st, { x: st.x + 75 * vs0, y: st.y - 55 * vs0, rot: 1.4, lift: 0.45 }, 0.75, { delay: i * 0.18, done: () => kill(st) });
          } else kill(st);
        }
      } else {
        bakeCountry(c);
        s = spr(c.tex, { x: c.cx, y: c.cy, w: c.tw, h: c.th, sc: 1, z: 0.17, zr: 0.045, order: 20, cells: 6 });
        s.c = c;
      }
      c.built = false;
      s.order = 110 + i;
      s.z = 0.21;
      const sl = pileSlotAt(K0, s, i, taken.length);
      items.push({ c, s, x0: s.x, y0: s.y, px: sl.wx, py: sl.wy, psc: sl.sc, prot: sl.rot, tStart: T + 0.35 + i * 0.24, settled: false });
    });
    const curls = [];
    const wW = K0.h * asp;
    for (let i = 0; i < 7; i++) {
      const tex = windCurlT[i % windCurlT.length];
      const cw = (96 + (i % 3) * 26) * (K0.h / 400);
      const cy0 = K0.y + (-0.30 + (i / 6) * 0.62) * K0.h;
      const sx0 = K0.x - wW * 0.68, sx1 = K0.x + wW * 0.68;
      const cs = spr(tex, { x: sx0, y: cy0, w: cw, h: cw * tex.h / tex.w, z: 0.30, zr: 0.035, order: 140, lift: 0.18, rot: ((i % 2) ? 0.06 : -0.06) });
      cs.curl = { x0: sx0, x1: sx1, y0: cy0, amp: (10 + (i % 3) * 5) * vs0, ph: i * 1.1, t0: T + i * 0.14, dur: 1.32 + (i % 3) * 0.2 };
      curls.push(cs);
    }
    const doneAt = T + 0.35 + (taken.length - 1) * 0.24 + 1.32 + 0.42;
    wind = { ct, taken, items, curls, stars, flyingTags, K0, t0: T, doneAt, phase: 'sweep' };
    after(doneAt - T, () => { if (wind && wind.phase !== 'putback') startWindPutBack(); }, 'wind');
  }
  function updateWind() {
    if (!wind || wind.phase === 'putback') return;
    const F = Math.floor(T * 12), tq = F / 12;
    const vs = wind.K0.h / 330;
    for (let i = wind.curls.length - 1; i >= 0; i--) {
      const s = wind.curls[i], q = s.curl;
      const u = (tq + 1 / 12 - q.t0) / q.dur;
      if (u >= 1) { kill(s); wind.curls.splice(i, 1); continue; }
      if (u < 0) { s.x = q.x0 - s.w; continue; }
      s.x = lerp(q.x0, q.x1, u);
      s.y = q.y0 + Math.sin(u * Math.PI * 2 + q.ph) * q.amp;
      s.rot = Math.cos(u * Math.PI * 2 + q.ph) * 0.14;
      s.lift = 0.18 + Math.sin(u * Math.PI) * 0.14;
    }
    let allSettled = true;
    for (let i = 0; i < wind.items.length; i++) {
      const it = wind.items[i], s = it.s;
      if (it.settled) continue;
      const el = tq + 1 / 12 - it.tStart;
      if (el < 0) { allSettled = false; continue; }
      if (el < 0.38) {
        allSettled = false;
        const u1 = el / 0.38, e1 = ease(u1);
        s.lift = lerp(0, 0.48, e1);
        s.rot = lerp(0, (i % 2 ? 1 : -1) * 0.24, e1);
        s.sx = 1 - 0.18 * Math.sin(u1 * Math.PI);
        s.flut = 0.6 + F * 1.1;
      } else if (el < 1.32) {
        allSettled = false;
        const u2 = (el - 0.38) / 0.94, e2 = ease(u2);
        s.x = lerp(it.x0, it.px, e2) + Math.sin(u2 * Math.PI) * 18 * vs;
        s.y = lerp(it.y0, it.py, e2) - Math.sin(u2 * Math.PI) * 62 * vs;
        s.sc = lerp(1, it.psc, e2);
        const dir = i % 2 ? -1 : 1;
        s.rot = lerp((i % 2 ? 1 : -1) * 0.24, it.prot + dir * 1.65, e2);
        s.sx = 0.78 + 0.22 * Math.cos(u2 * Math.PI * 2);
        s.lift = 0.48 + 0.24 * Math.sin(u2 * Math.PI);
        s.flut = 0.6 + F * 1.2;
      } else {
        it.settled = true;
        s.x = it.px; s.y = it.py; s.sc = it.psc; s.rot = it.prot;
        s.sx = 1; s.flut = 0; s.lift = 0.05 + i * 0.03; s.order = 92 + i;
        sfx.pick();
      }
    }
    if (allSettled && wind.phase === 'sweep') wind.phase = 'pile';
  }
  function startWindPutBack() {
    if (!wind) return;
    const ct = wind.ct, taken = wind.taken.slice();
    const pileMap = {};
    for (const it of wind.items) {
      if (it.s && S.includes(it.s)) {
        it.s.sx = 1; it.s.flut = 0;
        pileMap[it.c.id] = it.s;
      }
    }
    for (const s of wind.curls) kill(s);
    wind.curls.length = 0;
    wind.phase = 'putback';
    mode = 'map';
    RD = { ct, r: 0, list: taken, fi: 0, tmp: [], parts: [], hist: [], col: [], colLabels: [], queue: taken.slice(), placed: [], auto: false, replay: false, wind: true, windTaken: taken.map(c => c.id), windPile: pileMap, roundHadBuilt: true, miss: 0, hintStep: 0 };
    const K0 = contFrame(ct);
    RD.baseCam = K0; RD.cam = K0; RD.vh = K0.h;
    view.ctNext = ct;
    nextPiece();
  }
  function nextPiece() {
    if (!RD) return;
    settleCard();
    if (!RD.queue.length) {
      if (RD.ct.id === 'all' && !RD.aq) { RD.aq = true; RD.queue.push(AQ); }
      else return roundDone();
    }
    const c = RD.queue.shift();
    if (RD.wind && RD.windPile && RD.windPile[c.id]) {
      kill(RD.windPile[c.id]);
      delete RD.windPile[c.id];
    }
    bakeCountry(c);
    RD.hintStep = 0; RD.miss = 0;
    if (playerLevel() === 'own') {
      const rot = RD.ct.rotate && c !== AQ ? [1, 2, 3][Math.floor(hs(sid(c.id), 9) * 3)] * Math.PI / 2 : 0;
      const K = RD.baseCam || contFrame(RD.ct);
      RD.baseCam = K; RD.cam = K; RD.vh = K.h;
      spawnOwnPiece(c, rot);
      return;
    }
    const { K, best, rot } = framePiece(c);
    RD.cam = K; RD.vh = K.h;
    const dist = Math.hypot(cam.x - K.x, cam.y - K.y) + Math.abs(cam.h - K.h);
    const dur = dist < 1 ? 0 : clamp(0.45 + dist / 750, 0.55, 1.1);
    if (dur > 0) {
      RD.spawning = c;
      camTo(K.x, K.y, K.h, dur);
      after(dur, () => { if (!RD || mode !== 'map') return; RD.spawning = null; spawnPiece(c, K, best, rot); }, 'rd');
    } else {
      spawnPiece(c, K, best, rot);
    }
  }
  function spawnOwnPiece(c, rot) {
    RD.cardDying = false;
    if (c.isCard) {
      const cr = ownCardRect(cam);
      const cardSc = (0.72 * cr.s) / Math.max(c.bw, c.bh);
      const card = spr(cardTex(c, cr.s, cardSc), { x: cr.x, y: cr.y, w: cr.s, h: cr.s, z: 0.15, zr: 0.02, order: 25, rot: (hs(sid(c.id), 1) - 0.5) * 0.05, lift: 0.14 });
      card.own = true; RD.card = card; RD.cardSpec = c; RD.tmp.push(card); tw(card, { lift: 0 }, 0.22, { cut: true });
    }
    const s = spr(c.tex, { w: c.tw, h: c.th, sc: 1, rot, z: 0.2, zr: 0.045, order: 100, lift: 0.12, reveal: RD.wind ? 1 : 0, cells: 6 });
    s.c = c; s.waiting = true; s.tp = { x: c.cx, y: c.cy, sc: 1 };
    syncWaitingPiece(s); addTile(s);
    s.home = [s.x, s.y];
    const anc = anchorOf(s), vs = cam.h / 330;
    RD.piece = s; RD.tmp.push(s); RD.miss = 0; RD.hintStep = 0;
    if (!RD.wind) tw(s, { reveal: 1 }, 0.9);
    sfx.pick();
    if (c !== AQ) {
      const f = FL[c.id];
      const fh = 17 * vs;
      const pole = spr(flat, { w: 1.1 * vs, h: 30 * vs, z: 0.225, zr: 0, order: 101, tint: [0.93, 0.89, 0.8] });
      const fl = spr(flagTex(c.id, 150), { w: fh * f.a * 1.04, h: fh * 1.04, z: 0.24, zr: 0.02, order: 102 });
      fl.fAspect = f.a;
      fl.fx = fh * f.a * 0.52 + 0.5 * vs; fl.fy = -30 * vs + fh * 0.5; fl.fs = 1; fl.landed = true;
      s.pole = pole; s.flag = fl; RD.tmp.push(pole, fl);
      syncPieceFlags();
    }
    if (!attract) setHint(RD.wind ? ('Put ' + inSent(c) + ' back') : (c === AQ ? 'Last piece: Antarctica' : rot ? 'Turn ' + inSent(c) + ' and put it in place' : 'Put ' + inSent(c) + ' in its place'));
    if (RD.wind) speakCountry(c, false);
    if (RD.auto) after(1.5, () => {
      if (!RD || RD.piece !== s) return;
      s.waiting = false; s.returning = null;
      let dst = s.tp;
      if (c.isCard && RD.card) {
        const cr = ownCardRect(cam), cardSc = (0.72 * cr.s) / Math.max(c.bw, c.bh);
        dst = { x: cr.x, y: cr.y, sc: cardSc };
        s.tp = dst;
      }
      tw(s, { lift: 0.32 }, 0.3);
      tw(s, { x: dst.x, y: dst.y, sc: dst.sc, rot: 0 }, 1.7, { delay: 0.3, done: () => { if (RD && RD.piece === s) landPiece(s); } });
    }, 'rd');
  }
  function spawnPiece(c, K, best, rot) {
    const ct = RD.ct, tp = best.tp, vs = RD.vh / 330;
    if (c.isCard && best.cardRect) {
      const cr = best.cardRect;
      const card = spr(cardTex(c, cr.s, tp.sc), { x: cr.x, y: cr.y, w: cr.s, h: cr.s, z: 0.15, zr: 0.02, order: 25, rot: (hs(sid(c.id), 1) - 0.5) * 0.05, lift: 0.14 });
      card.own = true; RD.card = card; RD.cardSpec = c; RD.tmp.push(card); tw(card, { lift: 0 }, 0.22, { cut: true });
      const spotR = clamp(Math.max(c.bw, c.bh) * 0.68, 2.8, 12);
      const spot = spr(spotTex(), { x: c.cx, y: c.cy, w: spotR * 2.6, h: spotR * 2.6, z: 0.122, zr: 0, order: 23 });
      spot.own = true; RD.spot = spot; RD.tmp.push(spot);
      const dx = cr.x - c.cx, dy = cr.y - c.cy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      const p0 = [c.cx + ux * (spotR * 1.05), c.cy + uy * (spotR * 1.05)];
      const tCard = (cr.s * 0.45) / Math.max(Math.abs(dx), Math.abs(dy), 1e-4);
      const p1 = [cr.x - dx * tCard, cr.y - dy * tCard];
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      if (len > 2) {
        const leader = spr(leaderTex(len * 8), { x: (p0[0] + p1[0]) / 2, y: (p0[1] + p1[1]) / 2, w: len, h: 1.6 * (K.h / 130), rot: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), z: 0.122, zr: 0, order: 23 });
        leader.own = true; RD.leader = leader; RD.tmp.push(leader);
      }
    }
    const s = spr(c.tex, { x: best.x, y: best.y, w: c.tw, h: c.th, sc: tp.sc, rot, z: 0.2, zr: 0.045, order: 100, lift: 0.12, reveal: RD.wind ? 1 : 0, cells: 6 }); s.c = c;
    const sp = [s.x, s.y]; if (c.isCard) addTile(s);
    s.home = sp; s.tp = tp; RD.piece = s; RD.tmp.push(s); RD.miss = 0; RD.hintStep = 0;
    if (!RD.wind) tw(s, { reveal: 1 }, 0.9);
    sfx.pick();
    if (c !== AQ) {
      const f = FL[c.id], fh = 17 * vs;
      const pole = spr(flat, { w: 1.1 * vs, h: 30 * vs, z: 0.225, zr: 0, order: 101, tint: [0.93, 0.89, 0.8] });
      const fl = spr(flagTex(c.id, 150), { w: fh * f.a * 1.04, h: fh * 1.04, z: 0.24, zr: 0.02, order: 102 });
      fl.fAspect = f.a; fl.fx = fh * f.a * 0.52 + 0.5 * vs; fl.fy = -30 * vs + fh * 0.5; fl.fs = 1; fl.landed = true;
      s.pole = pole; s.flag = fl; RD.tmp.push(pole, fl);
      syncPieceFlags();
    }
    if (!attract) setHint(RD.wind ? ('Put ' + inSent(c) + ' back') : (c === AQ ? 'Last piece: Antarctica' : rot ? 'Turn ' + inSent(c) + ' and put it in place' : 'Put ' + inSent(c) + ' in its place'));
    if (RD.wind) speakCountry(c, false);
    if (RD.auto) after(1.5, () => { if (!RD || RD.piece !== s) return; tw(s, { lift: 0.3 }, 0.3); tw(s, { x: tp.x, y: tp.y, rot: 0 }, 1.7, { delay: 0.3, done: () => { if (RD && RD.piece === s) landPiece(s); } }); }, 'rd');
  }
  function applyHintStep(step) {
    if (!RD || mode !== 'map' || !RD.piece) return;
    const s = RD.piece, c = s.c;
    RD.hintStep = Math.max(RD.hintStep || 0, step);
    if (step === 1) {
      const m = marginFor(c);
      const rw = Math.max(8, c.bw), rh = Math.max(8, c.bh);
      const aw = Math.max(0.25, 1 - m.l - m.r), ah = Math.max(0.25, 1 - m.t - m.b);
      const hFit = Math.max(180, (rh * 3) / ah, (rw * 3) / (aw * asp));
      const base = RD.baseCam || contFrame(RD.ct);
      const kh = clamp(hFit, Math.min(180, base.h), base.h);
      const ang = hs(sid(c.id), 41) * Math.PI * 2;
      const safeW = aw * kh * asp, safeH = ah * kh;
      const offX = Math.cos(ang) * safeW * 0.24, offY = Math.sin(ang) * safeH * 0.22;
      const safeCx = c.cx - offX, safeCy = c.cy - offY;
      const cxRaw = safeCx - ((m.l + (1 - m.r)) / 2 - 0.5) * kh * asp;
      const cyRaw = safeCy - ((m.t + (1 - m.b)) / 2 - 0.5) * kh;
      let K1 = clampCamVals(cxRaw, cyRaw, kh);
      // ensure target remains within HUD-safe area even near sea edges
      const sxMin = K1.x + (m.l - 0.5) * kh * asp + rw * 0.55, sxMax = K1.x + (0.5 - m.r) * kh * asp - rw * 0.55;
      const syMin = K1.y + (m.t - 0.5) * kh + rh * 0.55, syMax = K1.y + (0.5 - m.b) * kh - rh * 0.55;
      if (c.cx < sxMin) K1 = clampCamVals(K1.x - (sxMin - c.cx), K1.y, kh);
      else if (c.cx > sxMax) K1 = clampCamVals(K1.x + (c.cx - sxMax), K1.y, kh);
      if (c.cy < syMin) K1 = clampCamVals(K1.x, K1.y - (syMin - c.cy), kh);
      else if (c.cy > syMax) K1 = clampCamVals(K1.x, K1.y + (c.cy - syMax), kh);
      camTo(K1.x, K1.y, K1.h, 0.85);
      setHint('It is somewhere here');
    } else if (step >= 2) {
      showGhost();
      setHint(c.isCard ? 'Here it is. Follow the line' : 'Here it is. Match the outline');
      if (c.isCard) {
        if (!RD.spot) {
          const spotR = clamp(Math.max(c.bw, c.bh) * 0.68, 2.8, 12);
          const spot = spr(spotTex(), { x: c.cx, y: c.cy, w: spotR * 2.6, h: spotR * 2.6, z: 0.122, zr: 0, order: 24 });
          spot.own = true; RD.spot = spot; RD.tmp.push(spot);
        }
        if (!RD.leader && RD.card) {
          const leader = spr(leaderTex(320), { x: c.cx, y: c.cy, w: 10, h: 2.4 * (cam.h / 130), z: 0.122, zr: 0, order: 24 });
          leader.own = true; RD.leader = leader; RD.tmp.push(leader);
        }
        syncLeader();
      }
    }
  }
  function landPiece(s) {
    const c = s.c; RD.piece = null; c.built = true; sfx.snap(); speakCountry(c, !!CAP[c.id]);
    if (!RD.replay && !attract && c !== AQ && currentPlayer()) {
      const pl = currentPlayer();
      if (!pl.rec) pl.rec = {};
      s._prevRec = pl.rec[c.id] ? { ...pl.rec[c.id] } : null;
      let maxT = 0;
      for (const id in pl.rec) if (pl.rec[id] && pl.rec[id].t > maxT) maxT = pl.rec[id].t;
      pl.rec[c.id] = { w: RD.miss || 0, t: Math.max(Date.now(), maxT + 1) };
      if (!RD.wind) save();
    }
    s.waiting = false; s.returning = null;
    s._piv = null; s._rotTo = undefined;
    s._starReady = false;
    if (RD.ghost) { kill(RD.ghost); RD.ghost = null; }
    const isOwnCard = playerLevel() === 'own' && c.isCard && RD.card;
    let landTp = s.tp;
    if (isOwnCard) {
      const cr = ownCardRect(cam), cardSc = (0.72 * cr.s) / Math.max(c.bw, c.bh);
      landTp = { x: cr.x, y: cr.y, sc: cardSc };
      s.tp = landTp;
      if (!RD.spot) {
        const spotR = clamp(Math.max(c.bw, c.bh) * 0.68, 2.8, 12);
        const spot = spr(spotTex(), { x: c.cx, y: c.cy, w: spotR * 2.6, h: spotR * 2.6, z: 0.122, zr: 0, order: 24, lift: 0.14 });
        spot.own = true; RD.spot = spot; RD.tmp.push(spot); tw(spot, { lift: 0 }, 0.2, { cut: true });
      }
    }
    csp[c.id] = s; if (c.isCard) RD.cardLanded = s; RD.tmp = RD.tmp.filter(q => q !== s); RD.placed.push(s);
    tw(s, { x: landTp.x, y: landTp.y, sc: landTp.sc, rot: Math.round(s.rot / (Math.PI * 2)) * Math.PI * 2, lift: 0 }, 0.2, { cut: true, done: () => { s.rot = 0; s.z = 0.17; s.order = 20 + (c.isCard ? 6 : 0); if (isOwnCard) s._onCard = true; wake(s, 0); s._starReady = true; syncStar(s); if (s.star && s.star.alpha > 0.5) { s.star.sc = 1.45; s.star._wakeLift = 0.32; s.star.lift = 0.32; tw(s.star, { sc: 1, _wakeLift: 0 }, 0.24, { cut: true }); } sfx.wake(); s.lift = 0.07; tw(s, { lift: 0 }, 0.4, { delay: 0.2 }); } });
    const vs = (playerLevel() === 'own' ? cam.h : RD.vh) / 330;
    const ac = c.isCard ? [landTp.x, landTp.y] : (c.c || [landTp.x, landTp.y]);
    showCountryTag(c, s, 3.6, 0.25);
    if (s.flag) { s.flag.flutT = T + 0.3; }
    for (let i = 0; i < 6; i++) { const b = spr(birdT, { x: ac[0] + (hs(i, 3, frame) - 0.5) * 14 * vs, y: ac[1], w: 9 * vs, h: 5.4 * vs, z: 0.23, zr: 0.01, order: 150, alpha: 0 }); b.bird = { t0: T + 0.3 + i * 0.07, vx: (hs(i, 7, frame) - 0.5) * 60 * vs, vy: -(30 + hs(i, 8, frame) * 40) * vs, ph: i }; }
    if (!attract) setHint(inSent(c, true) + ' is awake');
    if (RD.auto) after(3.4, () => { hideCountry(c); c.built = false; goWorld(1.4); scheduleAttract(2.4, ++attractN); }, 'rd'); else after(1.5, nextPiece, 'rd');
  }
  function wake(s, delay) { s.wakeAt = T + delay; }
  function roundDone() {
    const ct = RD.ct;
    settleCard();
    if (RD.wind) {
      save();
      camCont(ct, 0.9);
      RD.placed.forEach((s, i) => wake(s, i * 0.22));
      sfx.wake();
      setHint('All back in place');
      after(1.85, () => { clearWind(true); beginRound(ct); }, 'rd2');
      return;
    }
    if (!RD.replay) {
      let added = 0;
      if (ct.id === 'all') prog.world = true;
      else for (const c of RD.list) if (!prog.built.includes(c.id)) { prog.built.push(c.id); added++; }
      if (added > 0 && !attract) justAddedStickers = true;
      save();
    }
    const fin = RD.replay ? (RD.r + 1 >= ct.rounds.length) : contDone(ct);
    if (fin) {
      if (!attract && !RD.replay && ct.id !== 'all') sessionRounds++;
      if (ct.id === 'all') { const wf = worldFrame(); camTo(wf.x, wf.y, wf.h, 1.1); }
      else camCont(ct, 1.0);
      for (const id in csp) if (ct.id === 'all' || C[id] && C[id].cont === ct.id) wake(csp[id], (csp[id].x - ct.region[0]) / (ct.region[2] - ct.region[0]) * 1.4);
      if (ct.id === 'all' && aqS) wake(aqS, 1.2);
      sfx.wake(); setHint(ct.id === 'all' ? 'The whole world is awake' : ct.name + ' is finished');
      const leave = () => { const hold = landDoneAt + 1.2 - T; if (hold > 0.02) { after(hold, leave, 'rd2'); return; } goWorld(); if (!nextCont()) after(1.5, wakeAll); }; // hold the finished view 1.2 s after the last territory lands
      after(3.2, leave, 'rd2');
      for (const s of RD.tmp) if (s.hud) s.alpha = 0;
    } else {
      if (!attract && !RD.replay && ct.id !== 'all') sessionRounds++;
      const builtOnCt = ct.order.filter(c => isBuiltId(prog, c.id)).length;
      const taken = (!attract && !RD.replay && ct.id !== 'all' && RD.roundHadBuilt && builtOnCt >= 6) ? pickWindCountries(ct, RD.list) : [];
      if (taken.length >= 2 && (windForce || (sessionRounds > 0 && sessionRounds % 3 === 0))) {
        setHint('Well done');
        after(0.65, () => startWindGust(ct, taken), 'rd2');
      } else {
        setHint('Well done. Next round');
        after(1.6, () => beginRound(ct, RD.replay ? { replay: true, r: RD.r + 1 } : {}), 'rd2');
      }
    }
  }
  function wakeAll() { for (const id in csp) wake(csp[id], csp[id].x / 2000 * 2.6); if (aqS) wake(aqS, 2.6); sfx.wake(); }
  const AQ = { id: 'AQ', name: 'Antarctica', cont: 'all', polys: [G.aq], bbox: (() => { const r = [1e9, 1e9, -1e9, -1e9]; for (let i = 0; i < G.aq.length; i += 2) { r[0] = Math.min(r[0], G.aq[i]); r[1] = Math.min(r[1], G.aq[i + 1]); r[2] = Math.max(r[2], G.aq[i]); r[3] = Math.max(r[3], G.aq[i + 1]); } return r; })() }; AQ.cx = (AQ.bbox[0] + AQ.bbox[2]) / 2; AQ.cy = (AQ.bbox[1] + AQ.bbox[3]) / 2; AQ.bw = AQ.bbox[2] - AQ.bbox[0]; AQ.bh = AQ.bbox[3] - AQ.bbox[1]; AQ.c = [AQ.cx, AQ.cy]; C.AQ = AQ;
  let aqS = null;
  // ---------- land outside play: never a flag, tag, star, round, sticker or size comparison ----------
  // GEO.terr: land of no playable country, laid in one warm-grey paper once its continent is finished.
  // country.x: land of a playable country outside its drag piece (Hawaii, the Azores...), laid in its flag papers whenever the country sits in place.
  const TERR_PAPER = '#a39888';
  const mkLand = (id, rings, o) => {
    const b = [1e9, 1e9, -1e9, -1e9]; let big = 0;
    for (const r of rings) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); y0 = Math.min(y0, r[i + 1]); x1 = Math.max(x1, r[i]); y1 = Math.max(y1, r[i + 1]); } b[0] = Math.min(b[0], x0); b[1] = Math.min(b[1], y0); b[2] = Math.max(b[2], x1); b[3] = Math.max(b[3], y1); big = Math.max(big, (x1 - x0) * (y1 - y0)); }
    const p = Object.assign({ id, polys: rings, bbox: b, cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, bw: b[2] - b[0], bh: b[3] - b[1], cellSize: Math.sqrt(big) }, o); p.c = [p.cx, p.cy]; return p;
  };
  const TERR = (G.terr || []).map((t, k) => mkLand('~t' + k, t.r.map(i => G.neutral[i]), { cont: t.cont, paper: TERR_PAPER, name: t.n }));
  const XLAND = []; for (const c of G.countries) (c.x || []).forEach((g, k) => XLAND.push(mkLand('~' + c.id + k, g.map(i => G.neutral[i]), { of: c })));
  const lsp = new Map(), terrOn = {}; let landDoneAt = 0; // batch 4: when the last territory of a finished continent has landed
  function showLand(p, pop, wakeAt) { if (lsp.has(p)) return; bakeCountry(p); const s = spr(p.tex, { x: p.cx, y: p.cy, w: p.tw, h: p.th, z: 0.17, zr: 0.045, order: 19, cells: 6 }); s.c = p; lsp.set(p, s); if (pop) { s.reveal = 0; tw(s, { reveal: 1 }, 0.5); } if (wakeAt !== undefined) s.wakeAt = wakeAt; }
  function hideLand(p) { const s = lsp.get(p); if (s) { kill(s); lsp.delete(p); } }
  function syncLand() {
    for (const ct of CONTS) {
      if (ct.id === 'all') continue;
      const inRound = !!(RD && RD.ct === ct), want = !pending.length && contDone(ct) && (!inRound || ct.order.every(c => csp[c.id]));
      if (want === !!terrOn[ct.id]) continue;
      terrOn[ct.id] = want;
      const list = TERR.filter(p => p.cont === ct.id).sort((a, b) => a.cx - b.cx);
      if (!want) list.forEach(hideLand);
      else if (inRound && mode === 'map') { list.forEach((p, i) => after(0.45 + i * 0.05, () => { if (terrOn[ct.id]) showLand(p, true); }, 'land')); landDoneAt = T + 0.45 + Math.max(0, list.length - 1) * 0.05 + 0.5 + 1 / 12; } // after the last country, one by one
      else list.forEach(p => showLand(p, T > 0.3));
    }
    for (const p of XLAND) {
      const s = csp[p.of.id], c = p.of;
      const home = !!s && !s._onCard && Math.abs(s.x - c.cx) < 0.5 && Math.abs(s.y - c.cy) < 0.5 && Math.abs(s.sc - 1) < 0.02 && Math.abs(Math.sin(s.rot)) < 0.01;
      if (home && !lsp.has(p)) showLand(p, T > 0.3 && (s.wakeAt !== undefined || s.reveal < 1), s.wakeAt);
      else if (!home && lsp.has(p)) hideLand(p);
      if (home && s.wakeAt !== undefined) lsp.get(p).wakeAt = s.wakeAt;
    }
  }
  // built countries from saved progress, baked a few per frame
  const pending = [];
  function queueProg(pr) {
    pending.length = 0;
    const ids = (pr && Array.isArray(pr.built)) ? pr.built : [];
    for (const id of ids) { const c = C[id]; if (c && c !== AQ) { c.built = true; pending.push(c); } }
    if (pr && pr.world) { AQ.built = true; pending.push(AQ); }
  }
  queueProg(prog);
  function clearBuilt() {
    pending.length = 0;
    for (const c of G.countries) { hideCountry(c); c.built = false; }
    if (aqS) { kill(aqS); aqS = null; }
    delete csp.AQ; AQ.built = false;
  }
  function switchPlayer(p) {
    if (typeof closePassport === 'function' && passport) closePassport(false);
    justAddedStickers = false;
    idleTime = 0; lastComparisonText = '';
    timers = timers.filter(t => t.tag !== 'at' && t.tag !== 'rd' && t.tag !== 'rd2' && t.tag !== 'peek' && t.tag !== 'wind' && t.tag !== 'pass' && t.tag !== 'cmpHint' && t.tag !== 'cmpTag');
    stopSpeech();
    sendAllTwinsHome(true);
    clearWind(true);
    clearRound();
    clearBuilt();
    store.current = p ? p.id : null;
    save();
    prog = p ? p.prog : (ephProg = { built: [], world: false });
    updateHudToken();
    if (p) queueProg(prog);
    if (mode === 'world') {
      snapWorldCam();
      freeBaseZoom();
      placeTag();
      setHint(worldHintStr());
    }
  }
  // ---------- player picker & name input ----------
  const inp = document.getElementById('pname');
  let picker = null, hold = null, needFirstPick = false;
  const pickSprites = [];
  const pSpr = (tex, o) => { const s = spr(tex, Object.assign({ hud: true, pick: true, z: 0.14, zr: 0.03, order: 220, _pickerSpr: true }, o)); pickSprites.push(s); return s; };
  const playerCardTex = (p, cw, ch, active) => {
    const sc = devPerHud(), W = Math.round(cw * sc), H = Math.round(ch * sc), k = W / cw;
    const t = shapeTex(W, H, b => {
      B.paper(b, wob(8 * k, 8 * k, W - 8 * k, H - 8 * k, 10 * k, sid(p.id + p.token)), CREAM, active ? 0.56 : 0.34);
      if (active) B.paper(b, wob(16 * k, 12 * k, W - 16 * k, 22 * k, 3 * k, sid(p.id)), PAP[5], 0.68);
      drawToken(b, p.token, W / 2, H * 0.27, Math.min(cw, ch) * 0.0038 * k);
      const dy = H * 0.88, dx0 = W / 2 - 3 * 22 * k;
      CONTS.forEach((ct, i) => {
        const done = contDone(ct, p.prog), dx = dx0 + i * 22 * k;
        if (done) B.paper(b, q => q.arc(dx, dy, 5.8 * k, 0, 7), PAP[6], 0.68);
        else for (const [q, st] of [[b.c, 'rgba(54,56,68,0.62)'], [b.g, 'rgba(128,128,128,0.45)']]) { q.strokeStyle = st; q.lineWidth = 2 * k; q.beginPath(); q.arc(dx, dy, 5.2 * k, 0.1, 6.38); q.stroke(); }
      });
    }, { noMip: true });
    t.lw = cw; t.lh = ch; return t;
  };
  const tagCardTex = (cw, ch, bg, seed) => {
    const sc = devPerHud(), W = Math.round(cw * sc), H = Math.round(ch * sc), k = W / cw;
    const t = shapeTex(W, H, b => B.paper(b, wob(8 * k, 8 * k, W - 8 * k, H - 8 * k, 10 * k, seed), bg, 0.36), { noMip: true });
    t.lw = cw; t.lh = ch; return t;
  };
  const removeBadgeTex = p => {
    const nm = cleanName(p && p.name), sc = devPerHud();
    if (!nm) {
      const W = Math.round(128 * sc), H = Math.round(108 * sc), k = W / 128;
      const t = shapeTex(W, H, b => {
        B.paper(b, wob(6 * k, 6 * k, W - 6 * k, H - 6 * k, 8 * k, sid(p.id + p.token)), CREAM, 0.36);
        drawToken(b, p.token, W * 0.5, H * 0.5, 0.86 * k);
      }, { noMip: true });
      t.lw = 128; t.lh = 108; return t;
    }
    const m = document.createElement('canvas').getContext('2d'); m.font = `800 30px ${FONT}`;
    const tw_ = Math.min(260, m.measureText(nm).width + 24);
    const lw = Math.max(220, Math.round(108 + tw_ + 22)), lh = 108;
    const W = Math.round(lw * sc), H = Math.round(lh * sc), k = W / lw;
    const t = shapeTex(W, H, b => {
      B.paper(b, wob(6 * k, 6 * k, W - 6 * k, H - 6 * k, 9 * k, sid(p.id + nm)), CREAM, 0.36);
      drawToken(b, p.token, 54 * k, 54 * k, 0.78 * k);
      const sd = sid(nm);
      const chars = [...nm], ws = chars.map(ch => m.measureText(ch).width + 1.1);
      const tot = ws.reduce((a, b) => a + b, 0);
      const tsc = Math.min(1, (lw - 118) / Math.max(1, tot));
      let x = (104 + Math.max(0, (lw - 118 - tot * tsc) * 0.5)) * k;
      chars.forEach((ch, i) => {
        const cw = ws[i] * tsc * k;
        if (ch !== ' ') for (const [q, st] of [[b.c, shade(INK, (hs(i, sd, 1) - 0.5) * 0.06)], [b.g, B.grey(0.75)]]) {
          q.save(); q.font = `800 ${Math.round(30 * tsc * k)}px ${FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle';
          q.translate(x + cw / 2, (55 + (hs(i, sd, 3) - 0.5) * 2) * k); q.rotate((hs(i, sd, 4) - 0.5) * 0.09);
          q.fillStyle = st; q.fillText(ch, 0, 0); q.restore();
        }
        x += cw;
      });
    }, { noMip: true });
    t.lw = lw; t.lh = lh; return t;
  };
  function clearPickerSprites(liftAway) {
    for (const s of pickSprites) {
      if (!liftAway) { killTw(s); kill(s); }
      else { killTw(s); s.lift = 0.22; tw(s, { y: s.y - 26, lift: 0.32 }, 0.18, { cut: true, done: () => kill(s) }); }
    }
    pickSprites.length = 0;
    if (!liftAway) {
      for (let i = S.length - 1; i >= 0; i--) if (S[i]._pickerSpr) { killTw(S[i]); kill(S[i]); }
    }
  }
  function closePicker(liftAway = true) {
    hold = null; idleTime = 0;
    if (inp && document.activeElement === inp) inp.blur();
    clearPickerSprites(liftAway);
    picker = null;
    updateHudToken();
    placeTag();
    setHint(worldHintStr());
  }
  let pendingFocus = false;
  function openPicker(kind, extra = {}) {
    if (typeof closePassport === 'function' && passport) closePassport(false);
    hold = null; pendingFocus = false; idleTime = 0;
    timers = timers.filter(t => t.tag !== 'cmpHint');
    sendAllTwinsHome(false);
    if (mode === 'world') { snapWorldCam(); freeBaseZoom(); }
    clearPickerSprites(false);
    picker = { kind, player: extra.player || null, isNew: !!extra.isNew, items: [], head: null, extraSprites: [] };
    rebuildPicker();
  }
  function seedNameInput(p) {
    if (!inp) return;
    inp.value = p ? (p.name || '') : '';
    pendingFocus = true;
    focusNameInput();
  }
  function focusNameInput() {
    if (!inp || !picker || picker.kind !== 'editName') return;
    try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); }
  }
  function confirmNameEdit() {
    pendingFocus = false;
    if (!picker || picker.kind !== 'editName' || !picker.player) return;
    const p = picker.player;
    p.name = cleanName(inp ? inp.value : p.name);
    save();
    if (inp && document.activeElement === inp) inp.blur();
    if (picker.isNew) closePicker(true);
    else openPicker('pick');
  }
  if (inp) {
    inp.addEventListener('blur', () => { scrollTo(0, 0); });
    inp.addEventListener('input', () => {
      const v = inp.value.replace(/[\r\n]/g, '').slice(0, 12);
      if (inp.value !== v) inp.value = v;
      if (picker && picker.kind === 'editName' && picker.nameSprite) {
        const s = picker.nameSprite;
        B.freeTex(s.tex);
        const tx = textTex(v || ' ', 42 * 0.9, { strip: CREAM, col: INK, minW: 220, scale: devPerHud(), noMip: true });
        s.tex = tx; s.own = true; s.w = tx.lw; s.h = tx.lh;
        layoutPicker();
      }
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); confirmNameEdit(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (picker && picker.kind === 'editName') { if (picker.isNew) closePicker(true); else openPicker('pick'); } }
    });
  }
  function pickerNoteTex(str, hudPx, maxW, sc) {
    const px = hudPx * sc, m = document.createElement('canvas').getContext('2d');
    const lines = wrapWords(m, str, maxW * sc, `800 ${px}px ${FONT}`);
    m.font = `800 ${px}px ${FONT}`;
    const lineW = lines.map(ln => m.measureText(ln).width);
    const tw_ = Math.max(1, ...lineW), padx = px * 0.85, pady = px * 0.48, lh = px * 1.24;
    const b = B.bake(tw_ + padx * 2, pady * 2 + lines.length * lh);
    const sd = sid(str), mg = Math.max(2, Math.round(2 * sc), Math.ceil(px * 0.08));
    B.paper(b, cutEdge(mg, mg, b.w - mg, b.h - mg, px * 0.14, sd), HUD_PAPER, 0.12);
    lines.forEach((ln, li) => {
      const cy = pady + (li + 0.5) * lh;
      for (const [q, st] of [[b.c, '#40424c'], [b.g, B.grey(0.72)]]) {
        q.save(); q.font = `800 ${px}px ${FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle';
        q.fillStyle = st; q.fillText(ln, b.w * 0.5, cy); q.restore();
      }
    });
    const t = B.tex(b, { noMip: true }); t.lw = b.w / sc; t.lh = b.h / sc; return t;
  }
  function rebuildPicker() {
    if (!picker) return;
    clearPickerSprites(false);
    picker.items = []; picker.extraSprites = []; picker.nameSprite = null; picker.head = null; picker.note = null;
    const sc = devPerHud();
    const mkPTex = (str, px, o = {}) => textTex(str, px, Object.assign({ scale: sc, noMip: true, cut: true }, o));
    const headTxt = picker.kind === 'confirmRemove' ? 'Remove this player?' : picker.kind === 'askLevel' ? 'How do you want to play?' : picker.kind === 'askName' ? 'Add a name?' : picker.kind === 'editName' ? 'Your name' : 'Who is playing?';
    const ht = mkPTex(headTxt, 42 * 0.9, { strip: HUD_PAPER, col: INK });
    picker.head = pSpr(ht, { order: 221, own: true, w: ht.lw, h: ht.lh }); picker.head.tilt = -0.9 * DEG;
    picker.head.bw = ht.lw; picker.head.bh = ht.lh;
    // batch 4: the picker's cards and tags lie on a paper mat, not straight on the map (opaque kraft, wobbly cut edge)
    { const mt = shapeTex(Math.round(900 * sc), Math.round(640 * sc), b => B.paper(b, wob(6 * sc, 6 * sc, b.w - 6 * sc, b.h - 6 * sc, 9 * sc, 4471), '#cdb995', 0.3), { noMip: true });
      picker.mat = pSpr(mt, { order: 217, own: true, z: 0.13, zr: 0.02, w: 900, h: 640 }); }
    if (picker.kind === 'pick' || picker.kind === 'tokens') {
      const narrow = asp < 0.9, W = 1000 * asp;
      const noteMaxW = narrow ? Math.min(440, W - 96) : Math.min(720, W - 120);
      const noteStr = "Your players and progress are saved only in this browser on this device. If you clear the browser's data or use another device, you start again.";
      const nt = pickerNoteTex(noteStr, narrow ? 20 : 21, noteMaxW, sc);
      const note = pSpr(nt, { order: 219, own: true, w: nt.lw, h: nt.lh });
      note.bw = nt.lw; note.bh = nt.lh; note.tilt = 0.35 * DEG;
      picker.note = note;
      picker.extraSprites.push({ s: note, role: 'note' });
    }
    if (picker.kind === 'tokens') {
      const taken = new Set(store.players.map(p => p.token));
      const avail = TOKENS.filter(t => !taken.has(t));
      for (const tok of avail) {
        const ct = tagCardTex(240, 174, CREAM, sid(tok) + 19);
        const card = pSpr(ct, { order: 220, own: true, lift: 0.1, w: ct.lw, h: ct.lh });
        const icon = pSpr(tokTex[tok], { order: 221, lift: 0.1 });
        tw(card, { lift: 0 }, 0.18, { cut: true }); tw(icon, { lift: 0 }, 0.18, { cut: true });
        picker.items.push({ kind: 'token', token: tok, card, icon, sprites: [card, icon] });
      }
    } else if (picker.kind === 'pick') {
      for (const p of store.players) {
        const active = p.id === store.current;
        const ct = playerCardTex(p, 240, 192, active);
        const card = pSpr(ct, { order: 220, own: true, lift: 0.08, w: ct.lw, h: ct.lh });
        const nameStr = p.name || 'Add name';
        const nt = mkPTex(nameStr, (p.name ? 25 : 21) * 0.86, { strip: p.name ? CREAM : shade(PALE, 0.05), col: INK });
        const nameS = pSpr(nt, { order: 222, own: true, lift: 0.08, w: nt.lw, h: nt.lh });
        nameS.bw = nt.lw; nameS.bh = nt.lh;
        const lvl = cleanLevel(p.level);
        const lt = mkPTex(lvl === 'help' ? 'With help' : 'On my own', 19 * 0.84, { strip: lvl === 'help' ? PAP[8] : PAP[6], col: INK });
        const levelS = pSpr(lt, { order: 222, own: true, lift: 0.08, w: lt.lw, h: lt.lh });
        levelS.bw = lt.lw; levelS.bh = lt.lh;
        tw(card, { lift: 0 }, 0.18, { cut: true }); tw(nameS, { lift: 0 }, 0.18, { cut: true }); tw(levelS, { lift: 0 }, 0.18, { cut: true });
        picker.items.push({ kind: 'player', player: p, card, nameS, levelS, sprites: [card, nameS, levelS] });
      }
      if (store.players.length < 6) {
        const ct = tagCardTex(240, 192, PAP[5], 77);
        const card = pSpr(ct, { order: 220, own: true, lift: 0.08, w: ct.lw, h: ct.lh });
        const lt = mkPTex('New player', 28 * 0.9, { strip: CREAM, col: INK });
        const lbl = pSpr(lt, { order: 221, own: true, lift: 0.08, w: lt.lw, h: lt.lh });
        lbl.bw = lt.lw; lbl.bh = lt.lh;
        tw(card, { lift: 0 }, 0.18, { cut: true }); tw(lbl, { lift: 0 }, 0.18, { cut: true });
        picker.items.push({ kind: 'new', card, lbl, sprites: [card, lbl] });
      }
    } else if (picker.kind === 'askLevel') {
      const p = picker.player;
      if (p) {
        const preview = pSpr(tokTex[p.token], { order: 221 });
        picker.extraSprites.push({ s: preview, role: 'preview' });
      }
      for (const [kind, label, colr] of [['chooseOwn', 'On my own', PAP[6]], ['chooseHelp', 'With help', PAP[8]]]) {
        const ct = tagCardTex(240, 148, colr, sid(kind) + 11);
        const card = pSpr(ct, { order: 220, own: true, lift: 0.1, w: ct.lw, h: ct.lh });
        const lt = mkPTex(label, 28 * 0.9, { strip: CREAM, col: INK });
        const lbl = pSpr(lt, { order: 221, own: true, lift: 0.1, w: lt.lw, h: lt.lh });
        lbl.bw = lt.lw; lbl.bh = lt.lh;
        tw(card, { lift: 0 }, 0.18, { cut: true }); tw(lbl, { lift: 0 }, 0.18, { cut: true });
        picker.items.push({ kind, card, lbl, sprites: [card, lbl] });
      }
    } else if (picker.kind === 'askName') {
      const p = picker.player;
      if (p) {
        const preview = pSpr(tokTex[p.token], { order: 221 });
        picker.extraSprites.push({ s: preview, role: 'preview' });
      }
      for (const [kind, label, colr] of [['addName', 'Add a name', PAP[5]], ['skip', 'Skip', CREAM]]) {
        const ct = tagCardTex(240, 148, colr, sid(kind));
        const card = pSpr(ct, { order: 220, own: true, lift: 0.1, w: ct.lw, h: ct.lh });
        const lt = mkPTex(label, 30 * 0.9, { strip: CREAM, col: INK });
        const lbl = pSpr(lt, { order: 221, own: true, lift: 0.1, w: lt.lw, h: lt.lh });
        lbl.bw = lt.lw; lbl.bh = lt.lh;
        tw(card, { lift: 0 }, 0.18, { cut: true }); tw(lbl, { lift: 0 }, 0.18, { cut: true });
        picker.items.push({ kind, card, lbl, sprites: [card, lbl] });
      }
    } else if (picker.kind === 'editName') {
      const p = picker.player;
      if (p) {
        const preview = pSpr(tokTex[p.token], { order: 221 });
        picker.extraSprites.push({ s: preview, role: 'preview' });
      }
      const val = inp ? inp.value : (p ? p.name : '');
      const bt = mkPTex(val || ' ', 42 * 0.9, { strip: CREAM, col: INK, minW: 220 });
      const box = pSpr(bt, { order: 221, own: true, w: bt.lw, h: bt.lh });
      box.bw = bt.lw; box.bh = bt.lh;
      picker.nameSprite = box;
      picker.items.push({ kind: 'nameBox', card: box, sprites: [box] });
      const ct = tagCardTex(220, 142, PAP[6], 91);
      const card = pSpr(ct, { order: 220, own: true, w: ct.lw, h: ct.lh });
      const lt = mkPTex('Done', 34 * 0.9, { strip: CREAM, col: INK });
      const lbl = pSpr(lt, { order: 221, own: true, w: lt.lw, h: lt.lh });
      lbl.bw = lt.lw; lbl.bh = lt.lh;
      picker.items.push({ kind: 'done', card, lbl, sprites: [card, lbl] });
    } else if (picker.kind === 'confirmRemove') {
      const p = picker.player;
      if (p) {
        const bt = removeBadgeTex(p);
        const badge = pSpr(bt, { order: 221, own: true, w: bt.lw, h: bt.lh });
        badge.bw = bt.lw; badge.bh = bt.lh;
        picker.extraSprites.push({ s: badge, role: 'badge' });
      }
      for (const [kind, label, colr] of [['yes', 'Yes', PAP[2]], ['no', 'No', CREAM]]) {
        const ct = tagCardTex(220, 148, colr, sid(kind) + 5);
        const card = pSpr(ct, { order: 220, own: true, lift: 0.1, w: ct.lw, h: ct.lh });
        const lt = mkPTex(label, 34 * 0.9, { strip: CREAM, col: INK });
        const lbl = pSpr(lt, { order: 221, own: true, lift: 0.1, w: lt.lw, h: lt.lh });
        lbl.bw = lt.lw; lbl.bh = lt.lh;
        tw(card, { lift: 0 }, 0.18, { cut: true }); tw(lbl, { lift: 0 }, 0.18, { cut: true });
        picker.items.push({ kind, card, lbl, sprites: [card, lbl] });
      }
    }
    layoutPicker();
  }
  function topHudBottom() {
    let yMax = title.alpha > 0.1 ? title.y + title.h / 2 : 0;
    if (hintS && hintS.alpha > 0.1) yMax = Math.max(yMax, hintS.y + hintS.h / 2);
    for (const id in btn) if (btn[id].alpha > 0.1) yMax = Math.max(yMax, btn[id].y + btn[id].h / 2);
    return yMax;
  }
  function layoutPicker() {
    if (!picker) return;
    const W = 1000 * asp, narrow = asp < 0.9;
    const topY = Math.max(narrow ? 210 : 140, topHudBottom() + 26);
    const hs = Math.min(1, (W - 40) / picker.head.bw);
    picker.head.w = picker.head.bw * hs; picker.head.h = picker.head.bh * hs;
    picker.head.x = W / 2; picker.head.y = topY + picker.head.h / 2;
    const gridTop = picker.head.y + picker.head.h / 2 + (narrow ? 28 : 34);
    if (picker.kind === 'tokens' || picker.kind === 'pick') {
      const n = picker.items.length, cols = narrow ? 2 : Math.min(3, Math.max(1, n)), rows = Math.ceil(n / cols);
      const gx = narrow ? 16 : 28, gy = narrow ? 16 : 24;
      const cw = narrow ? Math.min(240, (W - 36 - gx) / 2) : 240;
      const baseCh = picker.kind === 'pick' ? 192 : 174;
      const note = picker.note, noteGap = narrow ? 16 : 20;
      let noteH = 0;
      if (note) {
        const ns = Math.min(1, (W - 60) / note.bw);
        note.w = note.bw * ns; note.h = note.bh * ns;
        noteH = note.h + noteGap;
      }
      const ch = Math.max(136, narrow ? Math.min(baseCh, (965 - noteH - gridTop - gy * Math.max(0, rows - 1)) / Math.max(1, rows)) : baseCh);
      const totalW = cols * cw + (cols - 1) * gx, x0 = (W - totalW) / 2 + cw / 2;
      const availH = 965 - noteH - gridTop, totalH = rows * ch + (rows - 1) * gy;
      const y0 = gridTop + Math.max(0, (availH - totalH) * 0.25) + ch / 2;
      picker.items.forEach((it, idx) => {
        const col = idx % cols, row = Math.floor(idx / cols);
        const cx = x0 + col * (cw + gx), cy = y0 + row * (ch + gy);
        it.hx = cx; it.hy = cy;
        it.card.w = cw; it.card.h = ch; it.card.x = cx; it.card.y = cy;
        if (it.icon) { const is = Math.min(cw, ch) * 0.62; it.icon.w = is; it.icon.h = is; it.icon.x = cx; it.icon.y = cy; it.icon.hx = cx; it.icon.hy = cy; }
        if (it.nameS) {
          const ns = Math.min(1, (cw - 24) / it.nameS.bw);
          it.nameS.w = it.nameS.bw * ns; it.nameS.h = it.nameS.bh * ns;
          it.nameS.x = cx; it.nameS.y = cy + ch * 0.085;
          it.nameS.hx = it.nameS.x; it.nameS.hy = it.nameS.y;
        }
        if (it.levelS) {
          const lvs = Math.min(1, (cw - 32) / it.levelS.bw);
          it.levelS.w = it.levelS.bw * lvs; it.levelS.h = it.levelS.bh * lvs;
          it.levelS.x = cx; it.levelS.y = cy + ch * 0.255;
          it.levelS.hx = it.levelS.x; it.levelS.hy = it.levelS.y;
        }
        if (it.lbl) {
          const ls = Math.min(1, (cw - 24) / it.lbl.bw);
          it.lbl.w = it.lbl.bw * ls; it.lbl.h = it.lbl.bh * ls;
          it.lbl.x = cx; it.lbl.y = cy;
          it.lbl.hx = cx; it.lbl.hy = cy;
        }
      });
      if (note) {
        const gridBot = y0 + Math.max(0, rows - 1) * (ch + gy) + ch / 2;
        note.x = W / 2;
        note.y = gridBot + noteGap + note.h / 2;
        note.rot = note.tilt || 0;
      }
    } else if (picker.kind === 'editName') {
      let y = gridTop;
      const prev = picker.extraSprites[0];
      if (prev) { prev.s.w = 88; prev.s.h = 88; prev.s.x = W / 2; prev.s.y = y + 44; y += 110; }
      const box = picker.items[0], doneIt = picker.items[1];
      const bs = Math.min(1, (W - 60) / Math.max(220, box.card.w));
      box.card.w = Math.max(220, box.card.w) * bs; box.card.h = box.card.h * bs;
      box.card.x = W / 2; box.card.y = y + box.card.h / 2;
      y += box.card.h + 26;
      const dw = narrow ? Math.min(240, W - 80) : 220, dh = 148;
      doneIt.card.w = dw; doneIt.card.h = dh; doneIt.card.x = W / 2; doneIt.card.y = y + dh / 2;
      doneIt.lbl.w = doneIt.lbl.bw; doneIt.lbl.h = doneIt.lbl.bh; doneIt.lbl.x = W / 2; doneIt.lbl.y = doneIt.card.y;
    } else {
      let y = gridTop;
      const prev = picker.extraSprites[0];
      if (prev) {
        if (prev.role === 'badge') {
          const bs = Math.min(1, (W - 60) / Math.max(100, prev.s.bw));
          prev.s.w = prev.s.bw * bs; prev.s.h = prev.s.bh * bs;
          prev.s.x = W / 2; prev.s.y = y + prev.s.h / 2;
          y += prev.s.h + 24;
        } else {
          prev.s.w = 92; prev.s.h = 92; prev.s.x = W / 2; prev.s.y = y + 46; y += 116;
        }
      }
      const gap = narrow ? 16 : 28, cw = narrow ? Math.min(220, (W - 44 - gap) / 2) : 240, ch = 152;
      const x0 = W / 2 - (cw / 2 + gap / 2);
      picker.items.forEach((it, i) => {
        const cx = x0 + i * (cw + gap), cy = y + ch / 2;
        it.card.w = cw; it.card.h = ch; it.card.x = cx; it.card.y = cy;
        const ls = Math.min(1, (cw - 24) / it.lbl.bw);
        it.lbl.w = it.lbl.bw * ls; it.lbl.h = it.lbl.bh * ls; it.lbl.x = cx; it.lbl.y = cy;
      });
    }
    // batch 4b: each paper label lies a little askew (no two alike, at most 2 degrees); a held card keeps its own jitter
    if (picker.head.tilt !== undefined) picker.head.rot = picker.head.tilt;
    picker.items.forEach((it, i) => { if (hold && hold.item === it) return; [it.nameS, it.levelS, it.lbl].forEach((q, j) => { if (q) q.rot = PICK_TILT[(i * 3 + j) % PICK_TILT.length] * DEG; }); });
  }
  const PICK_TILT = [1.2, -1.6, 0.7, -0.45, 1.75, -1.1, 0.4, -1.85, 1.5, -0.7, 0.95, -1.35, 1.9, -0.25, 0.55, -1.95, 1.05, -0.6];
  function fitPickerMat() { // the mat covers the heading and every card with a margin
    if (!picker || !picker.mat || !picker.head) return;
    let x0 = picker.head.x - picker.head.w / 2, y0 = picker.head.y - picker.head.h / 2, x1 = picker.head.x + picker.head.w / 2, y1 = picker.head.y + picker.head.h / 2;
    for (const it of picker.items) { const c = it.card; if (!c) continue; x0 = Math.min(x0, c.x - c.w / 2); y0 = Math.min(y0, c.y - c.h / 2); x1 = Math.max(x1, c.x + c.w / 2); y1 = Math.max(y1, c.y + c.h / 2); }
    for (const e of picker.extraSprites) { const q = e.s || e; if (!q || q.w === undefined) continue; x0 = Math.min(x0, q.x - q.w / 2); y0 = Math.min(y0, q.y - q.h / 2); x1 = Math.max(x1, q.x + q.w / 2); y1 = Math.max(y1, q.y + q.h / 2); }
    const m = picker.mat, pad = 26; m.x = (x0 + x1) / 2; m.y = (y0 + y1) / 2; m.w = x1 - x0 + pad * 2; m.h = y1 - y0 + pad * 2; m.rot = -0.008;
  }
  function handlePickerDown(p, e) {
    const hPx = hudPx(), sb = btn.sound;
    if (sb && sb.alpha > 0.5 && hitMin(sb, p.hx, p.hy, 8, hPx)) { sb.lift = 0.15; tw(sb, { lift: 0 }, 0.3); press('sound'); return; }
    for (const it of picker.items) {
      if (!hit(it.card, p.hx, p.hy, 6)) continue;
      if (it.kind === 'player') {
        let inName = !!(it.nameS && hit(it.nameS, p.hx, p.hy, 2));
        let inLevel = !inName && !!(it.levelS && hit(it.levelS, p.hx, p.hy, 2));
        if (!inName && !inLevel && p.hy > it.card.y + 1) {
          const strips = [];
          if (it.nameS) strips.push({ k: 'name', s: it.nameS });
          if (it.levelS) strips.push({ k: 'level', s: it.levelS });
          const sh = pickHit(strips, p.hx, p.hy, 2, hPx, q => q.s);
          if (sh) { inName = sh.k === 'name'; inLevel = sh.k === 'level'; }
        }
        hold = { id: e.pointerId, item: it, player: it.player, t0: T, sx: e.clientX, sy: e.clientY, inName, inLevel };
        return;
      }
      it.card.lift = 0.15; tw(it.card, { lift: 0 }, 0.25);
      if (it.kind === 'token') {
        const np = mkPlayer(it.token, '', null, 'own');
        store.players.push(np);
        switchPlayer(np);
        openPicker('askLevel', { player: np, isNew: true });
      } else if (it.kind === 'chooseOwn' || it.kind === 'chooseHelp') {
        const target = picker.player || currentPlayer();
        if (target) { target.level = it.kind === 'chooseHelp' ? 'help' : 'own'; save(); }
        openPicker('askName', { player: target, isNew: picker.isNew });
      } else if (it.kind === 'new') {
        openPicker('tokens');
      } else if (it.kind === 'addName') {
        const target = picker.player;
        openPicker('editName', { player: target, isNew: true });
        seedNameInput(target);
      } else if (it.kind === 'skip') {
        closePicker(true);
      } else if (it.kind === 'nameBox') {
        pendingFocus = true;
        focusNameInput();
      } else if (it.kind === 'done') {
        confirmNameEdit();
      } else if (it.kind === 'yes') {
        const target = picker.player;
        store.players = store.players.filter(q => q.id !== target.id);
        if (store.current === target.id) {
          switchPlayer(null);
        } else {
          save();
        }
        if (store.players.length === 0) openPicker('tokens');
        else openPicker('pick');
      } else if (it.kind === 'no') {
        openPicker('pick');
      }
      return;
    }
    if (picker.note && hit(picker.note, p.hx, p.hy, 4)) return;
    if (currentPlayer()) {
      if (picker.kind === 'editName') confirmNameEdit();
      closePicker(true);
    }
  }
  // ---------- the passport ----------
  const PASS_CONTS = CONTS.filter(ct => ct.id !== 'all');
  const PASS_TABS = {
    sa: { bg: PAP[6], ink: CREAM },
    na: { bg: PAP[5], ink: INK },
    eu: { bg: PAP[8], ink: INK },
    af: { bg: PAP[4], ink: INK },
    as: { bg: PAP[2], ink: CREAM },
    oc: { bg: PAP[11], ink: INK }
  };
  let passport = null;
  const passPerSpread = () => asp < 0.9 ? 4 : 20;
  function wrapWords(ctx, str, maxW, fontStr) {
    ctx.font = fontStr;
    const words = String(str || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    if (ctx.measureText(words.join(' ')).width <= maxW) return [words.join(' ')];
    if (words.length === 1) return words;
    let best = null, bestMax = 1e9;
    for (let i = 1; i < words.length; i++) {
      const l1 = words.slice(0, i).join(' '), l2 = words.slice(i).join(' ');
      const w1 = ctx.measureText(l1).width, w2 = ctx.measureText(l2).width;
      const mw = Math.max(w1, w2);
      if (w1 <= maxW && w2 <= maxW && mw < bestMax) { bestMax = mw; best = [l1, l2]; }
    }
    if (best) return best;
    const lines = []; let cur = words[0];
    for (let i = 1; i < words.length; i++) {
      const cand = cur + ' ' + words[i];
      if (ctx.measureText(cand).width <= maxW) cur = cand;
      else { lines.push(cur); cur = words[i]; }
    }
    lines.push(cur);
    return lines;
  }
  function firstUnseenPlace(p = currentPlayer()) {
    const unseen = new Set(unseenStickers(p));
    if (!unseen.size) return null;
    const per = passPerSpread();
    for (const ct of PASS_CONTS) {
      for (let i = 0; i < ct.order.length; i++) {
        if (unseen.has(ct.order[i].id)) return { section: ct.id, spread: Math.floor(i / per) };
      }
    }
    return null;
  }
  function passportLayout(sec) {
    const W = 1000 * asp, single = asp < 0.9, isCover = sec === 'cover';
    const topHud = topHudBottom();
    if (single) {
      const topY = Math.max(178, topHud + 14), botY = 980;
      const bookH = Math.min(760, botY - topY);
      const cy = topY + bookH * 0.5 + Math.max(0, (botY - topY - bookH) * 0.35);
      const tabW = 98, tabOverlap = 14, tabStick = tabW - tabOverlap;
      const pageW = Math.min(W * 0.78, W - tabStick - 24);
      const x0 = (W - (pageW + tabStick)) * 0.5, x1 = x0 + pageW;
      const outerPad = 24, innerPad = 24, headH = 100, footH = 46, rowGap = 14;
      const sw = pageW - outerPad - innerPad;
      const sh = (bookH - headH - footH - rowGap * 3) / 4;
      return { W, single, isCover, topY: cy - bookH * 0.5, botY: cy + bookH * 0.5, cy, bookH, pageW, spreadW: pageW, coverW: pageW, mainW: pageW, x0, x1, spineX: x0, tabW, tabOverlap, tabStick, colsPerPage: 1, rowsPerPage: 4, perSpread: 4, outerPad, innerPad, headH, footH, colGap: 0, rowGap, sw, sh };
    }
    const mg = 24 * 1000 / Math.max(1, innerHeight); // batch 4: the book, its board and corners keep a 24 px margin from the screen edge
    const topY = Math.max(134, topHud + 14), botY = Math.min(980, 1000 - mg - 10);
    const bookH = Math.min(836, botY - topY);
    const cy = topY + bookH * 0.5 + Math.max(0, (botY - topY - bookH) * 0.4);
    const tabW = 140, tabOverlap = 18, tabStick = tabW - tabOverlap;
    const availSpreadW = W - tabStick - Math.max(64, 2 * (mg + 12));
    const spreadW = clamp(Math.min(W * 0.85, availSpreadW), 760, 1340);
    const pageW = spreadW * 0.5, coverW = Math.round(spreadW * 0.56);
    const mainW = isCover ? coverW : spreadW;
    const x0 = (W - (mainW + tabStick)) * 0.5, x1 = x0 + mainW;
    const spineX = isCover ? x0 : x0 + pageW;
    const outerPad = 20, innerPad = 18, headH = 84, footH = 38, colGap = 12, rowGap = 8;
    const sw = (pageW - outerPad - innerPad - colGap) / 2;
    const sh = (bookH - headH - footH - rowGap * 4) / 5;
    return { W, single, isCover, topY: cy - bookH * 0.5, botY: cy + bookH * 0.5, cy, bookH, pageW, spreadW, coverW, mainW, x0, x1, spineX, tabW, tabOverlap, tabStick, colsPerPage: 2, rowsPerPage: 5, perSpread: 20, outerPad, innerPad, headH, footH, colGap, rowGap, sw, sh };
  }
  function passTabTex(label, cw, ch, bg, ink, seed, twoLine, sc) {
    const W = Math.round(cw * sc), H = Math.round(ch * sc), k = W / cw;
    const t = shapeTex(W, H, b => {
      B.paper(b, cutEdge(4 * k, 4 * k, W - 4 * k, H - 4 * k, 5 * k, seed), bg, 0.42); // batch 4b: cut by hand like the HUD strips
      const words = label.split(' ');
      const mctx = b.c;
      const baseF = twoLine ? 15 : 17;
      mctx.font = `800 ${baseF * k}px ${FONT}`;
      const maxW = (cw - (twoLine ? 22 : 28)) * k;
      const useTwo = words.length === 2 && (twoLine || mctx.measureText(label).width > maxW);
      const fHud = useTwo ? (twoLine ? 14.5 : 15.5) : baseF;
      const lines = useTwo ? words : [label];
      const fpx = fHud * k;
      const tx0 = cw * 0.56;
      lines.forEach((ln, li) => {
        const ly = (lines.length === 2 ? (li === 0 ? ch * 0.36 : ch * 0.68) : ch * 0.53) * k;
        mctx.font = `800 ${fpx}px ${FONT}`;
        const tw_ = mctx.measureText(ln).width;
        const scl = Math.min(1, maxW / Math.max(1, tw_));
        for (const [q, st] of [[b.c, ink], [b.g, B.grey(ink === CREAM ? 0.85 : 0.2)]]) {
          q.save(); q.font = `800 ${fpx * scl}px ${FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle';
          q.translate(tx0 * k, ly); q.rotate((hs(li, seed, 4) - 0.5) * 0.03);
          q.fillStyle = st; q.fillText(ln, 0, 0); q.restore();
        }
      });
    }, { noMip: true });
    t.lw = cw; t.lh = ch; return t;
  }
  function passCoverTex(cw, ch, player, builtCount, totalCountries, sc) {
    const W = Math.round(cw * sc), H = Math.round(ch * sc), k = W / cw;
    const KRAFT = '#a37a4c';
    const t = shapeTex(W, H, b => {
      B.paper(b, wob(5 * k, 5 * k, W - 5 * k, H - 5 * k, 9 * k, 501), KRAFT, 0.48);
      const c = b.c, g = b.g;
      // spine strip & stitched border
      c.fillStyle = 'rgba(54,34,14,0.22)'; c.fillRect(6 * k, 7 * k, 18 * k, H - 14 * k);
      c.strokeStyle = 'rgba(242,198,61,0.45)'; c.lineWidth = 2.2 * k; c.setLineDash([12 * k, 8 * k]);
      c.strokeRect(32 * k, 24 * k, W - 52 * k, H - 48 * k); c.setLineDash([]);
      // "Passport" in cut letters
      const word = 'Passport', fpx = Math.min(cw * 0.135, 68) * k;
      const mc = document.createElement('canvas').getContext('2d'); mc.font = `800 ${fpx}px ${FONT}`;
      const chars = [...word], cws = chars.map(ch_ => mc.measureText(ch_).width + fpx * 0.07);
      const totW = cws.reduce((a, x) => a + x, 0);
      let cx = (W - totW) * 0.5 + 8 * k;
      const cy = H * 0.22;
      chars.forEach((ch_, i) => {
        const cw_ = cws[i];
        const col = shade(PAP[5], (hs(i, 99, 1) - 0.5) * 0.07);
        for (const [q, st] of [[c, col], [g, B.grey(0.86)]]) {
          q.save(); q.font = `800 ${fpx}px ${FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle';
          q.translate(cx + cw_ * 0.5, cy + (hs(i, 99, 3) - 0.5) * fpx * 0.08);
          q.rotate((hs(i, 99, 4) - 0.5) * 0.12);
          q.fillStyle = st; q.fillText(ch_, 0, 0);
          if (q === c) { q.strokeStyle = shade(PAP[4], -0.2); q.lineWidth = 1.6 * k; q.strokeText(ch_, 0, 0); }
          q.restore();
        }
        cx += cw_;
      });
      // cream medallion + player token (or cut star if no player active)
      const medR = Math.min(cw, ch) * 0.175 * k, medCx = W * 0.5 + 6 * k, medCy = H * 0.48;
      B.paper(b, q => {
        for (let i = 0; i < 24; i++) {
          const a = i / 24 * Math.PI * 2, rr = medR * (0.96 + hs(i, 313, 1) * 0.08);
          const x = medCx + Math.cos(a) * rr, y = medCy + Math.sin(a) * rr;
          if (i === 0) q.moveTo(x, y); else q.lineTo(x, y);
        }
        q.closePath();
      }, CREAM, 0.58);
      if (player) drawToken(b, player.token, medCx, medCy, (medR / k) * 0.0155 * k);
      else B.paper(b, starPath(medCx, medCy, medR * 0.52, medR * 0.22), PAP[5], 0.72);
      // player name if present
      let nextY = medCy + medR + 34 * k;
      const pName = cleanName(player && player.name);
      if (pName) {
        const nF = Math.min(34, cw * 0.08) * k;
        for (const [q, st] of [[c, CREAM], [g, B.grey(0.76)]]) {
          q.save(); q.font = `800 ${nF}px ${FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle';
          q.fillStyle = st; q.fillText(pName, medCx, nextY); q.restore();
        }
        nextY += nF * 1.45;
      } else {
        nextY += 12 * k;
      }
      // count "37 of 193" in cut strip
      const cntStr = `${builtCount} of ${totalCountries}`;
      const cF = Math.min(30, cw * 0.072) * k;
      mc.font = `800 ${cF}px ${FONT}`;
      const stripW = mc.measureText(cntStr).width + 44 * k, stripH = cF * 1.65;
      B.paper(b, wob(medCx - stripW * 0.5, nextY - stripH * 0.5, medCx + stripW * 0.5, nextY + stripH * 0.5, 6 * k, 404), CREAM, 0.52);
      for (const [q, st] of [[c, INK], [g, B.grey(0.75)]]) {
        q.save(); q.font = `800 ${cF}px ${FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle';
        q.fillStyle = st; q.fillText(cntStr, medCx, nextY + 1 * k); q.restore();
      }
    }, { noMip: true });
    t.lw = cw; t.lh = ch; return t;
  }
  function passPageStackTex(cw, ch, rightOnly, sc) {
    const W = Math.round(cw * sc), H = Math.round(ch * sc), k = W / cw;
    const t = shapeTex(W, H, b => {
      B.paper(b, wob(3 * k, 3 * k, W - 3 * k, H - 3 * k, 6 * k, 611), '#dcd2bc', 0.42);
      const c = b.c; c.strokeStyle = 'rgba(70,66,58,0.28)'; c.lineWidth = 1.2 * k;
      for (let i = 1; i <= 3; i++) {
        c.strokeRect((rightOnly ? 4 : 3 * i) * k, (3 * i) * k, W - (rightOnly ? 4 + 3 * i : 6 * i) * k, H - 6 * i * k);
      }
    }, { noMip: true });
    t.lw = cw; t.lh = ch; return t;
  }
  function passBoardTex(cw, ch, sc) {
    const W = Math.round(cw * sc), H = Math.round(ch * sc), k = W / cw;
    const t = shapeTex(W, H, b => B.paper(b, wob(4 * k, 4 * k, W - 4 * k, H - 4 * k, 8 * k, 613), '#946d41', 0.36), { noMip: true });
    t.lw = cw; t.lh = ch; return t;
  }
  function passPageTex(cw, ch, opt, sc) {
    const W = Math.round(cw * sc), H = Math.round(ch * sc), k = W / cw;
    const t = shapeTex(W, H, b => {
      B.paper(b, wob(3 * k, 3 * k, W - 3 * k, H - 3 * k, 6 * k, opt.seed), '#f2ebdb', 0.5);
      const c = b.c;
      // subtle spine shadow
      const spX = opt.side === 'left' ? W - 18 * k : 0;
      const gr = c.createLinearGradient(spX, 0, spX + 18 * k, 0);
      if (opt.side === 'left') { gr.addColorStop(0, 'rgba(65,55,40,0)'); gr.addColorStop(1, 'rgba(65,55,40,0.16)'); }
      else { gr.addColorStop(0, 'rgba(65,55,40,0.18)'); gr.addColorStop(1, 'rgba(65,55,40,0)'); }
      c.fillStyle = gr; c.fillRect(spX, 6 * k, 18 * k, H - 12 * k);
      // subtle inner dashed passport border
      c.strokeStyle = 'rgba(84,80,72,0.20)'; c.lineWidth = 1.6 * k; c.setLineDash([8 * k, 6 * k]);
      c.strokeRect(14 * k, 14 * k, W - 28 * k, H - 28 * k); c.setLineDash([]);
      // header text (continent name on left/single page, page label on right/single)
      if (opt.title) {
        const hf = (opt.single ? 24 : 28) * k;
        c.save(); c.font = `800 ${hf}px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillStyle = INK; c.fillText(opt.title, opt.outerPad * k, 46 * k); c.restore();
        c.strokeStyle = opt.accent || 'rgba(70,74,88,0.35)'; c.lineWidth = 3 * k; c.lineCap = 'round';
        c.beginPath(); c.moveTo(opt.outerPad * k, 66 * k); c.lineTo(Math.min(W - 30 * k, opt.outerPad * k + 185 * k), 66 * k); c.stroke();
      }
      if (opt.pageStr) {
        const underTitle = !!(opt.single && opt.hasStamp);
        const pf = (underTitle ? 15 : 18) * k;
        c.save(); c.font = `800 ${pf}px ${FONT}`;
        c.textAlign = underTitle ? 'left' : 'right'; c.textBaseline = 'middle';
        c.fillStyle = INK; // batch 4: the ink of the names, not a faint grey
        c.fillText(opt.pageStr, underTitle ? opt.outerPad * k : W - (opt.single ? 24 : Math.max(opt.outerPad, 58)) * k, (underTitle ? 82 : 46) * k);
        c.restore();
      }
      if (opt.stampSlot) { const q = opt.stampSlot; for (let pass = 0; pass < 2; pass++) { c.strokeStyle = pass ? 'rgba(66,68,82,0.22)' : 'rgba(66,68,82,0.40)'; c.lineWidth = (pass ? 1.0 : 1.7) * k; c.setLineDash(pass ? [] : [9 * k, 5 * k]); c.beginPath(); c.arc(q.x * k + pass * 0.7 * k, q.y * k, q.r * k, 0, 7); c.stroke(); } c.setLineDash([]); }
      if (opt.count) { const q = opt.count; c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = INK; c.font = `800 ${q.big * k}px ${FONT}`; c.fillText(q.n, q.x * k, q.y * k); c.font = `800 ${q.small * k}px ${FONT}`; c.fillText(q.line, q.x * k, (q.y + q.big * 0.62 + q.small * 0.4) * k); c.restore(); }
      // empty pencil rectangles for unbuilt slots
      for (const sl of opt.emptySlots) {
        const rx = sl.lx * k, ry = sl.ly * k, rw = sl.w * k, rh = sl.h * k;
        for (let pass = 0; pass < 2; pass++) {
          c.strokeStyle = pass ? 'rgba(66,68,82,0.22)' : 'rgba(66,68,82,0.40)';
          c.lineWidth = (pass ? 1.0 : 1.7) * k;
          c.setLineDash(pass ? [] : [9 * k, 5 * k]);
          c.beginPath();
          wob(rx + pass * 0.7 * k, ry - pass * 0.7 * k, rx + rw + pass * 0.7 * k, ry + rh - pass * 0.7 * k, 3.2 * k, sl.seed)(c);
          c.stroke();
        }
        c.setLineDash([]);
      }
      // corner turn dog-ear marks
      if (opt.cornerPrev) {
        const sz = 28 * k;
        c.fillStyle = 'rgba(216,204,178,0.85)'; c.beginPath();
        c.moveTo(6 * k, H - 6 * k - sz); c.lineTo(6 * k + sz, H - 6 * k); c.lineTo(6 * k, H - 6 * k); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(54,56,68,0.52)'; c.lineWidth = 1.8 * k; c.beginPath();
        c.moveTo(6 * k, H - 6 * k - sz); c.lineTo(6 * k + sz, H - 6 * k - sz); c.lineTo(6 * k + sz, H - 6 * k); c.stroke();
      }
      if (opt.cornerNext) {
        const sz = 28 * k;
        c.fillStyle = 'rgba(216,204,178,0.85)'; c.beginPath();
        c.moveTo(W - 6 * k, H - 6 * k - sz); c.lineTo(W - 6 * k - sz, H - 6 * k); c.lineTo(W - 6 * k, H - 6 * k); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(54,56,68,0.52)'; c.lineWidth = 1.8 * k; c.beginPath();
        c.moveTo(W - 6 * k, H - 6 * k - sz); c.lineTo(W - 6 * k - sz, H - 6 * k - sz); c.lineTo(W - 6 * k - sz, H - 6 * k); c.stroke();
      }
    }, { noMip: true });
    t.lw = cw; t.lh = ch; return t;
  }
  function passStampTex(label, colr, seed, dHud, sc) {
    const W = Math.round(dHud * sc), H = W, cx = W * 0.5, cy = H * 0.5, ro = W * 0.44, ri = W * 0.34;
    const t = shapeTex(W, H, b => {
      // cut-paper annular outer ring using evenodd
      const nr = clamp(Math.round(W / 9), 32, 120), ja = 0.06 * 32 / nr + 0.008; // batch 4: a large stamp keeps a round outline
      B.paper(b, q => {
        for (let i = 0; i < nr; i++) {
          const a = i / nr * Math.PI * 2, r = ro * (1 - ja * 0.66 + hs(i, seed, 1) * ja);
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          if (i === 0) q.moveTo(x, y); else q.lineTo(x, y);
        }
        q.closePath();
        for (let i = nr - 1; i >= 0; i--) {
          const a = i / nr * Math.PI * 2, r = ri * (1 - ja * 0.5 + hs(i, seed, 2) * ja * 0.84);
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          if (i === nr - 1) q.moveTo(x, y); else q.lineTo(x, y);
        }
        q.closePath();
      }, colr, 0.72);
      // tiny stars inside ring + bold cut-paper continent text strip across center
      B.paper(b, starPath(cx, cy - ri * 0.52, W * 0.065, W * 0.028), PAP[5], 0.78);
      B.paper(b, starPath(cx, cy + ri * 0.52, W * 0.065, W * 0.028), PAP[5], 0.78);
      const mc = document.createElement('canvas').getContext('2d');
      const lines = wrapWords(mc, label, W * 0.76, `800 ${W * 0.145}px ${FONT}`);
      const fpx = Math.min(W * 0.145, (W * 0.74) / Math.max(1, Math.max(...lines.map(l => { mc.font = `800 ${W * 0.145}px ${FONT}`; return mc.measureText(l).width; })) / (W * 0.145)));
      const lh = fpx * 1.06, bh = lines.length * lh + fpx * 0.45, bw = W * 0.86;
      B.paper(b, wob(cx - bw * 0.5, cy - bh * 0.5, cx + bw * 0.5, cy + bh * 0.5, 4 * sc, seed + 5), CREAM, 0.78);
      lines.forEach((ln, li) => {
        const ly = cy + (li - (lines.length - 1) * 0.5) * lh;
        for (const [q, st] of [[b.c, colr], [b.g, B.grey(0.82)]]) {
          q.save(); q.font = `800 ${fpx}px ${FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle';
          q.fillStyle = st; q.fillText(ln, cx, ly); q.restore();
        }
      });
    }, { noMip: true });
    t.lw = dHud; t.lh = dHud; return t;
  }
  function passStickerTex(c, sw, sh, accent, sc) {
    const pad = 5, lw = sw + pad * 2, lh = sh + pad * 2;
    const W = Math.round(lw * sc), H = Math.round(lh * sc), k = W / lw;
    const f = FL[c.id], cap = CAP[c.id];
    const cStr = normSaint(c.name), capStr = cap ? normSaint(cap.name) : '';
    const cFontHud = Math.max(20.0, Math.min(23.5, sw * 0.078));
    const capFontHud = Math.max(16.2, Math.min(18.5, sw * 0.062));
    const innerW = sw - 20, innerH = sh - 16;
    const maxFlagW = Math.min(innerW * 0.45, 118), maxFlagH = Math.min(innerH - 8, 86);
    let flagW = maxFlagW, flagH = flagW / f.a;
    if (flagH > maxFlagH) { flagH = maxFlagH; flagW = flagH * f.a; }
    const gapX = 10;
    const textColX = pad + 10 + flagW + gapX;
    const textColW = Math.max(60, pad + sw - 10 - textColX);
    const mc = document.createElement('canvas').getContext('2d');
    const cLines = wrapWords(mc, cStr, textColW, `800 ${cFontHud}px ${FONT}`);
    const starR = capFontHud * 0.38, starGap = capFontHud * 0.28, starTotal = starR * 2 + starGap;
    const capLines = cap ? wrapWords(mc, capStr, Math.max(40, textColW - starTotal), `800 ${capFontHud}px ${FONT}`) : [];
    const cLineH = cFontHud * 1.04, capLineH = capFontHud * 1.04;
    const textH = cLines.length * cLineH + (cap ? (4 + capLines.length * capLineH) : 0);
    const fx0 = pad + 10, fy0 = pad + (sh - flagH) * 0.5;
    const yStart = pad + Math.max(7, (sh - textH) * 0.5);
    const textCx = textColX + textColW * 0.5;
    const sd = sid(c.id);
    const t = shapeTex(W, H, b => {
      B.paper(b, wob(pad * k, pad * k, (pad + sw) * k, (pad + sh) * k, 4.5 * k, sd + 11), '#faf6ec', 0.32);
      const q = b.c;
      q.strokeStyle = accent || 'rgba(70,72,86,0.28)'; q.lineWidth = 1.6 * k;
      q.strokeRect((pad + 5) * k, (pad + 5) * k, (sw - 10) * k, (sh - 10) * k);
      // cut-paper flag (same parts & relief as rail flags)
      const fk = flagH * k, eg = 2.2; // batch 4: every flag sits on a thin darker paper edge, so white stripes stay apart from the cream sticker
      B.paper(b, x => x.rect((fx0 - eg) * k, (fy0 - eg) * k, (flagW + eg * 2) * k, (flagH + eg * 2) * k), '#8f8676', 0.4);
      f.parts.forEach((p, i) => drawPart(b, p, fk, -fx0 / flagH, -fy0 / flagH, Math.min(0.95, 0.45 + i * 0.10), f.a));
      // country name lines
      let ty = yStart;
      mc.font = `800 ${cFontHud}px ${FONT}`;
      cLines.forEach((ln, li) => {
        const yMid = (ty + li * cLineH + cLineH * 0.52) * k;
        const mw = mc.measureText(ln).width;
        const sx = mw > textColW ? (textColW / mw) : 1;
        for (const [qc, st] of [[b.c, '#212228'], [b.g, B.grey(0.76)]]) {
          qc.save(); qc.font = `800 ${cFontHud * k}px ${FONT}`; qc.textAlign = 'center'; qc.textBaseline = 'middle';
          qc.translate(textCx * k, yMid); if (sx < 1) qc.scale(sx, 1);
          qc.fillStyle = st; qc.fillText(ln, 0, 0); qc.restore();
        }
      });
      ty += cLines.length * cLineH + 4;
      // gold cut-paper star + capital lines
      if (cap) {
        mc.font = `800 ${capFontHud}px ${FONT}`;
        const l1W = mc.measureText(capLines[0]).width;
        const row1Raw = starTotal + l1W;
        const row1Scale = row1Raw > textColW ? (textColW / row1Raw) : 1;
        const row1W = Math.min(textColW, row1Raw);
        const rx = textCx - row1W * 0.5;
        const starCy = (ty + capLineH * 0.48) * k;
        B.paper(b, starPath((rx + starR) * k, starCy, starR * k, starR * 0.42 * k), PAP[5], 0.78);
        capLines.forEach((ln, li) => {
          const yMid = (ty + li * capLineH + capLineH * 0.52) * k;
          const mw = mc.measureText(ln).width;
          const sx = li === 0 ? Math.min(1, (textColW - starTotal) / Math.max(1, mw)) : Math.min(1, textColW / Math.max(1, mw));
          const tx = li === 0 ? (rx + starTotal) * k : textCx * k;
          for (const [qc, st] of [[b.c, '#464854'], [b.g, B.grey(0.72)]]) {
            qc.save(); qc.font = `800 ${capFontHud * k}px ${FONT}`;
            qc.textAlign = li === 0 ? 'left' : 'center'; qc.textBaseline = 'middle';
            qc.translate(tx, yMid); if (sx < 1) qc.scale(sx, 1);
            qc.fillStyle = st; qc.fillText(ln, 0, 0); qc.restore();
          }
        });
      }
    }, { noMip: true });
    t.lw = lw; t.lh = lh;
    t.pxCountryFont = +(cFontHud * innerHeight / 1000).toFixed(2);
    t.pxCapitalFont = +(cap ? capFontHud * innerHeight / 1000 : 0).toFixed(2);
    t.pxFlagW = +(flagW * innerHeight / 1000).toFixed(2);
    t.pxFlagH = +(flagH * innerHeight / 1000).toFixed(2);
    t.countryLines = cLines.slice();
    t.capitalLines = capLines.slice();
    return t;
  }
  const passKillArr = (arr, liftAway = false) => {
    for (const s of arr) {
      if (!liftAway) kill(s);
      else { killTw(s); s.lift = 0.22; tw(s, { y: s.y - 36, lift: 0.36 }, 0.18, { cut: true, done: () => kill(s) }); }
    }
    arr.length = 0;
  };
  const passSpr = (arr, tex, o) => {
    const s = spr(tex, Object.assign({ hud: true, pick: true, own: true, z: 0.14, zr: 0.03, order: 212 }, o));
    arr.push(s); return s;
  };
  function sectionSpreads(sec, per) {
    if (sec === 'cover') return 1;
    const ct = CI[sec];
    return ct ? Math.max(1, Math.ceil(ct.order.length / per)) : 1;
  }
  function closePassport(liftAway = true) {
    idleTime = 0;
    timers = timers.filter(t => t.tag !== 'pass');
    if (!passport) return;
    endPassportFlip();
    passKillArr(passport.flipSprites, liftAway);
    passKillArr(passport.pageSprites, liftAway);
    passKillArr(passport.sprites, liftAway);
    passport = null;
    if (mode === 'world') {
      setHint(worldHintStr());
    }
  }
  function buildPassportChrome(L, sec, instant) {
    const sc = devPerHud();
    passport.tabs = [];
    // Close tab + 6 continent index tabs stacked along the right edge
    const tabX = L.x1 - L.tabOverlap + L.tabW * 0.5;
    const closeH = L.single ? 50 : 54, tabH = L.single ? 56 : 62, gap = L.single ? 9 : 11;
    let ty = L.topY + 34;
    const ctTex = passTabTex('Close', L.tabW, closeH, PAP[3], CREAM, 901, L.single, sc);
    const cs = passSpr(passport.sprites, ctTex, { x: tabX, y: ty, w: ctTex.lw, h: ctTex.lh, order: 214, z: 0.15 });
    passport.closeBox = { x0: cs.x - cs.w * 0.5, y0: cs.y - cs.h * 0.5, x1: cs.x + cs.w * 0.5, y1: cs.y + cs.h * 0.5 };
    passport.tabs.push({ kind: 'close', id: 'close', s: cs });
    ty += closeH * 0.5 + gap + tabH * 0.5 + 8;
    PASS_CONTS.forEach((ct, i) => {
      const st = PASS_TABS[ct.id], active = ct.id === sec;
      const tt = passTabTex(ct.name, L.tabW, tabH, st.bg, st.ink, 910 + i, L.single, sc);
      const tx = tabX + (active ? 10 : 0);
      const s = passSpr(passport.sprites, tt, { x: tx, y: ty, w: tt.lw, h: tt.lh, order: active ? 215 : 213, z: active ? 0.165 : 0.145, lift: active ? 0.06 : 0 });
      passport.tabs.push({ kind: 'cont', id: ct.id, s });
      ty += tabH + gap;
    });
    { const active = sec === 'world', tt = passTabTex('World', L.tabW, tabH, PAP[10], CREAM, 917, L.single, sc); // batch 4: the world spread
      const s = passSpr(passport.sprites, tt, { x: tabX + (active ? 10 : 0), y: ty, w: tt.lw, h: tt.lh, order: active ? 215 : 213, z: active ? 0.165 : 0.145, lift: active ? 0.06 : 0 });
      passport.tabs.push({ kind: 'cont', id: 'world', s }); }
    if (!instant) {
      for (const s of passport.sprites) {
        const dstY = s.y, dstL = s.lift || 0;
        s.y = dstY + 34; s.lift = Math.max(dstL, 0.36);
        tw(s, { y: dstY, lift: dstL }, 0.22, { cut: true });
      }
    }
    passport.bounds = { x0: L.x0 - 16, y0: L.topY - 12, x1: L.x1 + L.tabStick + 14, y1: L.botY + 16 };
  }
  function buildPassportPage(L, sec, spread, instant, animateNew = true) {
    const sc = devPerHud(), pl = currentPlayer();
    passKillArr(passport.pageSprites, false);
    passport.stickers = [];
    passport.corners = { prev: null, next: null };
    passport.newIds = [];
    passport.animatingNew = false;
    passport.spreadCount = sectionSpreads(sec, L.perSpread);
    const midX = (L.x0 + L.x1) * 0.5;
    if (sec === 'cover') {
      const stTex = passPageStackTex(L.mainW, L.bookH, true, sc);
      passSpr(passport.pageSprites, stTex, { x: midX + 8, y: L.cy + 7, w: stTex.lw, h: stTex.lh, order: 211, z: 0.14 });
      const builtCnt = (prog && Array.isArray(prog.built)) ? prog.built.length : 0;
      const cvTex = passCoverTex(L.mainW, L.bookH, pl, builtCnt, G.countries.length, sc);
      passSpr(passport.pageSprites, cvTex, { x: midX, y: L.cy, w: cvTex.lw, h: cvTex.lh, order: 214, z: 0.165 });
      if (prog && prog.world) {
        const dStamp = L.single ? 104 : 132;
        const smTex = passStampTex('The whole world', PAP[2], 777, dStamp, sc);
        passSpr(passport.pageSprites, smTex, { x: L.x1 - dStamp * 0.62, y: L.botY - dStamp * 0.58, w: smTex.lw, h: smTex.lh, rot: -0.15, order: 218, z: 0.195 });
      }
      passport.corners.next = { x0: L.x1 - 110, y0: L.botY - 110, x1: L.x1, y1: L.botY };
      if (!instant) {
        for (const s of passport.pageSprites) {
          const dstY = s.y; s.y = dstY + 34; s.lift = 0.36;
          tw(s, { y: dstY, lift: 0 }, 0.22, { cut: true });
        }
      }
      return;
    }
    if (sec === 'world') { // batch 4: the last spread: one large stamp for the world round and the count of countries built
      const bTex = passBoardTex(L.mainW + 24, L.bookH + 18, sc);
      passSpr(passport.pageSprites, bTex, { x: midX, y: L.cy + 1, w: bTex.lw, h: bTex.lh, order: 210, z: 0.125 });
      const sTex = passPageStackTex(L.mainW + 12, L.bookH + 8, L.single, sc);
      passSpr(passport.pageSprites, sTex, { x: midX + (L.single ? 5 : 0), y: L.cy + 4, w: sTex.lw, h: sTex.lh, order: 211, z: 0.14 });
      const done = !!(prog && prog.world), n = (prog && Array.isArray(prog.built)) ? prog.built.length : 0;
      const dStamp = Math.min(L.pageW * 0.66, L.bookH * 0.5), stX = L.pageW * 0.5, stY = L.single ? L.bookH * 0.36 : L.bookH * 0.52;
      const cnt = { n: String(n), line: n === 1 ? 'country built' : 'countries built', big: L.single ? 84 : 120, small: L.single ? 26 : 32, x: L.pageW * 0.5, y: L.single ? L.bookH * 0.74 : L.bookH * 0.46 };
      const base = { single: L.single, seed: 790, title: 'The whole world', accent: PAP[2], outerPad: L.outerPad, pageStr: '', emptySlots: [], stampSlot: done ? null : { x: stX, y: stY, r: dStamp * 0.44 } };
      if (L.single) {
        const pt = passPageTex(L.pageW, L.bookH, Object.assign(base, { side: 'right', count: cnt, cornerPrev: true, cornerNext: false }), sc);
        passSpr(passport.pageSprites, pt, { x: L.x0 + L.pageW * 0.5, y: L.cy, w: pt.lw, h: pt.lh, order: 213, z: 0.155 });
      } else {
        const lt = passPageTex(L.pageW, L.bookH, Object.assign({}, base, { side: 'left', cornerPrev: true, cornerNext: false }), sc);
        const rt = passPageTex(L.pageW, L.bookH, { side: 'right', single: false, seed: 791, title: '', outerPad: L.outerPad, pageStr: '', emptySlots: [], count: cnt, cornerPrev: false, cornerNext: false }, sc);
        passSpr(passport.pageSprites, lt, { x: L.x0 + L.pageW * 0.5, y: L.cy, w: lt.lw, h: lt.lh, order: 213, z: 0.155 });
        passSpr(passport.pageSprites, rt, { x: L.x0 + L.pageW * 1.5, y: L.cy, w: rt.lw, h: rt.lh, order: 213, z: 0.155 });
      }
      if (done) { const smTex = passStampTex('The whole world', PAP[2], 777, dStamp, sc); passSpr(passport.pageSprites, smTex, { x: L.x0 + stX, y: L.topY + stY, w: smTex.lw, h: smTex.lh, rot: -0.12, order: 218, z: 0.195 }); }
      passport.corners.prev = { x0: L.x0, y0: L.botY - 46, x1: L.x0 + 72, y1: L.botY };
      if (!instant && !passport.flipping) for (const q of passport.pageSprites) { const dstY = q.y; q.y = dstY + 34; q.lift = 0.36; tw(q, { y: dstY, lift: 0 }, 0.22, { cut: true }); }
      return;
    }
    const ct = CI[sec], list = ct ? ct.order : [];
    const startIdx = spread * L.perSpread, slice = list.slice(startIdx, startIdx + L.perSpread);
    const stCol = (PASS_TABS[sec] || {}).bg || PAP[6];
    const hasPrev = true; // spread > 0 -> prev spread, spread === 0 -> prev section or cover
    const hasNext = true; // batch 4: after Oceania comes the world spread
    // outer kraft cover board & page thickness stack
    const bTex = passBoardTex(L.mainW + 24, L.bookH + 18, sc);
    passSpr(passport.pageSprites, bTex, { x: midX, y: L.cy + 1, w: bTex.lw, h: bTex.lh, order: 210, z: 0.125 });
    const sTex = passPageStackTex(L.mainW + 12, L.bookH + 8, L.single, sc);
    passSpr(passport.pageSprites, sTex, { x: midX + (L.single ? 5 : 0), y: L.cy + 4, w: sTex.lw, h: sTex.lh, order: 211, z: 0.14 });
    // compute slots in page-local coordinates & screen HUD coordinates
    const pSlots = L.single ? [[]] : [[], []];
    const builtSlots = [];
    for (let idx = 0; idx < slice.length; idx++) {
      const c = slice[idx];
      const pageIdx = L.single ? 0 : Math.floor(idx / 10);
      const localIdx = L.single ? idx : (idx % 10);
      const col = localIdx % L.colsPerPage, row = Math.floor(localIdx / L.colsPerPage);
      const leftMargin = L.single ? L.outerPad : (pageIdx === 0 ? L.outerPad : L.innerPad);
      const lx = leftMargin + col * (L.sw + L.colGap);
      const ly = L.headH + row * (L.sh + L.rowGap);
      const pageX0 = L.x0 + pageIdx * L.pageW;
      const sx = pageX0 + lx + L.sw * 0.5, sy = L.topY + ly + L.sh * 0.5;
      if (isBuiltId(prog, c.id)) builtSlots.push({ c, sx, sy });
      else pSlots[pageIdx].push({ lx, ly, w: L.sw, h: L.sh, seed: sid(c.id) + 55 });
    }
    const pageStr = passport.spreadCount > 1 ? `Page ${spread + 1} of ${passport.spreadCount}` : '';
    const hasStamp = spread === 0 && contDone(ct);
    if (L.single) {
      const pt = passPageTex(L.pageW, L.bookH, { side: 'right', single: true, seed: 700 + spread, title: ct.name, accent: stCol, outerPad: L.outerPad, pageStr, hasStamp, emptySlots: pSlots[0], cornerPrev: hasPrev, cornerNext: hasNext }, sc);
      passSpr(passport.pageSprites, pt, { x: L.x0 + L.pageW * 0.5, y: L.cy, w: pt.lw, h: pt.lh, order: 213, z: 0.155 });
      if (hasPrev) passport.corners.prev = { x0: L.x0, y0: L.botY - 46, x1: L.x0 + 72, y1: L.botY };
      if (hasNext) passport.corners.next = { x0: L.x1 - 72, y0: L.botY - 46, x1: L.x1, y1: L.botY };
    } else {
      const lt = passPageTex(L.pageW, L.bookH, { side: 'left', single: false, seed: 700 + spread * 2, title: ct.name, accent: stCol, outerPad: L.outerPad, pageStr: '', emptySlots: pSlots[0], cornerPrev: hasPrev, cornerNext: false }, sc);
      const rt = passPageTex(L.pageW, L.bookH, { side: 'right', single: false, seed: 701 + spread * 2, title: '', accent: stCol, outerPad: L.outerPad, pageStr, emptySlots: pSlots[1], cornerPrev: false, cornerNext: hasNext }, sc);
      passSpr(passport.pageSprites, lt, { x: L.x0 + L.pageW * 0.5, y: L.cy, w: lt.lw, h: lt.lh, order: 213, z: 0.155 });
      passSpr(passport.pageSprites, rt, { x: L.x0 + L.pageW * 1.5, y: L.cy, w: rt.lw, h: rt.lh, order: 213, z: 0.155 });
      if (hasPrev) passport.corners.prev = { x0: L.x0, y0: L.botY - 46, x1: L.x0 + 72, y1: L.botY };
      if (hasNext) passport.corners.next = { x0: L.x1 - 72, y0: L.botY - 46, x1: L.x1, y1: L.botY };
    }
    // completed continent round cut-paper stamp on its first page (no dates)
    if (spread === 0 && contDone(ct)) {
      const dStamp = L.single ? 92 : 78;
      const smTex = passStampTex(ct.name, stCol, sid(ct.id) + 88, dStamp, sc);
      let sx = L.x0 + L.pageW - (L.single ? 70 : 78), sy = L.topY + (L.single ? 50 : 52);
      if (!L.single) { // batch 4: in the header band right of the title and its underline, never over the title or the first stickers
        const mc = document.createElement('canvas').getContext('2d'); mc.font = `800 28px ${FONT}`;
        const tR = L.outerPad + Math.max(mc.measureText(ct.name).width, 185);
        sx = L.x0 + tR + 22 + dStamp / 2; sy = L.topY + 43;
        if (sx + dStamp / 2 > L.x0 + L.pageW - 14) sx = L.x0 + L.pageW + L.innerPad + 16 + dStamp / 2; // a long title: the right page's header
      }
      passSpr(passport.pageSprites, smTex, { x: sx, y: sy, w: smTex.lw, h: smTex.lh, rot: -0.14, order: 218, z: 0.195 });
    }
    // bake ONLY stickers of the visible spread
    const unseenSet = animateNew ? new Set(unseenStickers(pl)) : new Set();
    const toPress = [];
    for (const slot of builtSlots) {
      const st = passStickerTex(slot.c, L.sw, L.sh, stCol, sc);
      const tilt = (hs(sid(slot.c.id), 17, 3) - 0.5) * 0.085;
      const isNew = unseenSet.has(slot.c.id);
      const sp = passSpr(passport.pageSprites, st, { x: slot.sx, y: slot.sy, w: st.lw, h: st.lh, rot: tilt, order: 216, z: 0.175, alpha: isNew ? 0 : 1 });
      const rec = { c: slot.c, s: sp, x: slot.sx, y: slot.sy, w: L.sw, h: L.sh, pxCountryFont: st.pxCountryFont, pxCapitalFont: st.pxCapitalFont, pxFlagW: st.pxFlagW, pxFlagH: st.pxFlagH, countryLines: st.countryLines, capitalLines: st.capitalLines, pressing: isNew };
      passport.stickers.push(rec);
      if (isNew) toPress.push(rec);
    }
    if (!instant && !passport.flipping) {
      for (const s of passport.pageSprites) {
        if (s.alpha < 0.5) continue;
        const dstY = s.y; s.y = dstY + 34; s.lift = Math.max(s.lift || 0, 0.36);
        tw(s, { y: dstY, lift: 0 }, 0.22, { cut: true });
      }
    }
    if (toPress.length) {
      passport.animatingNew = true;
      passport.newIds = toPress.map(r => r.c.id);
      const baseDelay = (passport.flipping ? 0.5 : 0) + (instant ? 0.14 : 0.28);
      toPress.forEach((rec, i) => {
        const dly = baseDelay + i * 0.42;
        after(dly, () => {
          if (!passport) return;
          const sp = rec.s;
          if (!S.includes(sp)) return;
          sp.alpha = 1; sp.y = rec.y - 42; sp.lift = 0.68; sp.sc = 1.24; sp.order = 219;
          tw(sp, { y: rec.y, lift: 0, sc: 1 }, 0.28, {
            cut: true,
            done: () => {
              sp.order = 216;
              rec.pressing = false;
              sfx.thump();
              markPassShown([rec.c.id]);
              if (passport) {
                passport.newIds = passport.newIds.filter(id => id !== rec.c.id);
                if (!passport.newIds.length) passport.animatingNew = false;
              }
            }
          });
        }, 'pass');
      });
    }
  }
  function rebuildPassport(instant = true, animateNew = true) {
    if (!passport) return;
    timers = timers.filter(t => t.tag !== 'pass');
    endPassportFlip();
    passKillArr(passport.flipSprites, false);
    passKillArr(passport.pageSprites, false);
    passKillArr(passport.sprites, false);
    passport.flipping = false;
    const L = passportLayout(passport.section);
    buildPassportChrome(L, passport.section, instant);
    buildPassportPage(L, passport.section, passport.spread, instant, animateNew);
  }
  function openPassport(opts = {}) {
    if (picker) closePicker(false);
    if (mode !== 'world') return;
    idleTime = 0;
    timers = timers.filter(t => t.tag !== 'cmpHint');
    sendAllTwinsHome(!!opts.instant);
    snapWorldCam();
    freeBaseZoom();
    if (passport) closePassport(false);
    layoutHud();
    let sec = opts.section || 'cover', sp = opts.spread || 0;
    if (!opts.section) {
      const firstNew = firstUnseenPlace();
      if (firstNew) { sec = firstNew.section; sp = firstNew.spread; }
    }
    const per = passPerSpread(), maxSp = sectionSpreads(sec, per);
    sp = clamp(sp, 0, Math.max(0, maxSp - 1));
    passport = { section: sec, spread: sp, spreadCount: maxSp, sprites: [], pageSprites: [], flipSprites: [], stickers: [], tabs: [], corners: { prev: null, next: null }, bounds: null, closeBox: null, flipping: false, animatingNew: false, newIds: [], flip: null };
    const L = passportLayout(sec);
    const instant = !!opts.instant;
    buildPassportChrome(L, sec, instant);
    buildPassportPage(L, sec, sp, instant, true);
    if (!instant) sfx.turn();
  }
  // batch 4: a page turn never shows a blank spread. The next spread is laid at once under the turning leaf; the leaf carries the old
  // page on its front and the new page on its back (the stickers themselves, narrowed about the spine at 12 fps), and the old page
  // on the far side stays until the leaf lands on it.
  function startPassportFlip(nextSec, nextSpread, dir) {
    if (!passport) return;
    if (passport.flip) endPassportFlip();
    timers = timers.filter(t => t.tag !== 'pass');
    passKillArr(passport.flipSprites, false);
    const LPrev = passportLayout(passport.section), LNext = passportLayout(nextSec);
    const old = passport.pageSprites.slice(); passport.pageSprites.length = 0;
    passport.section = nextSec; passport.spread = nextSpread; passport.flipping = true;
    passKillArr(passport.sprites, false);
    buildPassportChrome(LNext, nextSec, true);
    buildPassportPage(LNext, nextSec, nextSpread, true, true);
    const isBase = q => q.order <= 211, departing = (q, L) => dir > 0 ? q.x > L.spineX + 1 : q.x < L.spineX - 1;
    const front = [], stay = [], back = [];
    for (const q of old) { if (isBase(q)) { kill(q); continue; } (departing(q, LPrev) ? front : stay).push(q); }
    for (const q of passport.pageSprites) if (!isBase(q) && !departing(q, LNext)) back.push(q);
    const prep = (q, sp) => { q._fx = q.x; q._fy = q.y; q._sp = sp; q._a = q.alpha; q._o = q.order; q.order = q._o + 10; };
    front.forEach(q => prep(q, LPrev.spineX)); back.forEach(q => { prep(q, LNext.spineX); q.alpha = 0; });
    passport.flip = { dir, t0: T, dur: 0.42, front, back, stay };
    updatePassport();
    sfx.turn();
  }
  function endPassportFlip() {
    const fl = passport && passport.flip; if (!fl) return;
    for (const q of fl.front) kill(q); for (const q of fl.stay) kill(q);
    for (const q of fl.back) if (S.includes(q)) { q.sx = 1; q.x = q._fx; q.y = q._fy; q.lift = 0; q.order = q._o; q.alpha = q._a; }
    passport.flip = null; passport.flipping = false;
  }
  function openPassportSection(sec, spread = 0, withFlip = true) {
    if (!passport) return;
    const per = passPerSpread(), sp = clamp(spread, 0, Math.max(0, sectionSpreads(sec, per) - 1));
    if (passport.section === sec && passport.spread === sp && !passport.flipping) return;
    const order = ['cover', ...PASS_CONTS.map(c => c.id), 'world'];
    const dir = (order.indexOf(sec) > order.indexOf(passport.section) || (sec === passport.section && sp > passport.spread)) ? 1 : -1;
    if (withFlip) startPassportFlip(sec, sp, dir);
    else { passport.section = sec; passport.spread = sp; rebuildPassport(true, true); }
  }
  function turnPassport(dir) {
    if (!passport) return;
    const per = passPerSpread();
    if (passport.section === 'cover') {
      if (dir > 0) openPassportSection('sa', 0, true);
      return;
    }
    if (passport.section === 'world') { if (dir < 0) openPassportSection('oc', sectionSpreads('oc', per) - 1, true); return; }
    const idx = PASS_CONTS.findIndex(c => c.id === passport.section);
    const maxSp = sectionSpreads(passport.section, per);
    const nextSp = passport.spread + dir;
    if (nextSp >= 0 && nextSp < maxSp) {
      openPassportSection(passport.section, nextSp, true);
    } else if (dir > 0 && idx >= 0 && idx + 1 < PASS_CONTS.length) {
      openPassportSection(PASS_CONTS[idx + 1].id, 0, true);
    } else if (dir > 0 && idx === PASS_CONTS.length - 1) {
      openPassportSection('world', 0, true);
    } else if (dir < 0) {
      if (idx > 0) {
        const pId = PASS_CONTS[idx - 1].id;
        openPassportSection(pId, sectionSpreads(pId, per) - 1, true);
      } else if (idx === 0) {
        openPassportSection('cover', 0, true);
      }
    }
  }
  function updatePassport() {
    if (!passport || !passport.flip) return;
    const fl = passport.flip, tq = Math.floor(T * 12) / 12 + 1 / 12, u = clamp((tq - fl.t0) / fl.dur, 0, 1);
    if (u >= 1) { endPassportFlip(); return; }
    const ang = u * Math.PI, f = Math.max(0.06, Math.abs(Math.cos(ang))), lift = 0.12 + 0.36 * Math.sin(ang);
    const leaf = u < 0.5 ? fl.front : fl.back, gone = u < 0.5 ? fl.back : fl.front;
    for (const q of gone) q.alpha = 0;
    for (const q of leaf) { q.alpha = q._a; q.sx = f; q.x = q._sp + (q._fx - q._sp) * f; q.y = q._fy - 12 * Math.sin(ang); q.lift = lift; }
  }
  function handlePassportDown(p) {
    if (!passport) return;
    const hPx = hudPx();
    const inBox = (b, x, y, pad = 6) => !!(b && x >= b.x0 - pad && x <= b.x1 + pad && y >= b.y0 - pad && y <= b.y1 + pad);
    const topBtns = ['sound', 'passport'].map(id => ({ id, s: btn[id] })).filter(q => q.s && q.s.alpha > 0.5);
    const bh = pickHit(topBtns, p.hx, p.hy, 8, hPx, q => q.s);
    if (bh) {
      bh.s.lift = 0.15; tw(bh.s, { lift: 0 }, 0.3);
      return press(bh.id);
    }
    const th = pickHit(passport.tabs, p.hx, p.hy, 6, hPx, t => t.s);
    if (th) {
      if (th.kind === 'close') { th.s.lift = 0.18; closePassport(true); }
      else openPassportSection(th.id, 0, true);
      return;
    }
    if (inBox(passport.corners.next, p.hx, p.hy, 4)) { turnPassport(1); return; }
    if (inBox(passport.corners.prev, p.hx, p.hy, 4)) { turnPassport(-1); return; }
    if (inBoxMin(passport.corners.next, p.hx, p.hy, 4, hPx)) { turnPassport(1); return; }
    if (inBoxMin(passport.corners.prev, p.hx, p.hy, 4, hPx)) { turnPassport(-1); return; }
    if (passport.section !== 'cover') {
      for (const rec of passport.stickers) {
        if (rec.s && rec.s.alpha > 0.5 && hit(rec.s, p.hx, p.hy, 4)) {
          rec.s.lift = 0.34; rec.s.sc = 1.04; rec.s.order = 219;
          tw(rec.s, { lift: 0, sc: 1 }, 0.34, { cut: true, done: () => { if (rec.s) rec.s.order = 216; } });
          if (soundOn) sfx.pick();
          speakCountry(rec.c, !!CAP[rec.c.id]);
          return;
        }
      }
    }
    if (passport.section === 'cover') {
      const b = passport.bounds;
      if (b && p.hx >= (b.x0 + b.x1) * 0.5 && p.hx <= b.x1 && p.hy >= b.y0 && p.hy <= b.y1) {
        turnPassport(1);
        return;
      }
    }
    if (!inBox(passport.bounds, p.hx, p.hy, 4)) {
      closePassport(true);
    }
  }
  // ---------- input ----------
  const toW = e => { const hx = e.clientX / innerHeight * 1000, hy = e.clientY / innerHeight * 1000; return { hx, hy, w: h2w(hx, hy) }; };
  const screen2W = (cx, cy) => h2w(cx / innerHeight * 1000, cy / innerHeight * 1000);
  const hudPx = () => Math.max(1e-4, innerHeight / 1000);
  const worldPx = () => Math.max(1e-4, innerHeight / Math.max(1, cam.h));
  const hit = (s, x, y, pad) => { const dx = x - s.x, dy = y - s.y, c = Math.cos(-s.rot), si = Math.sin(-s.rot), lx = dx * c - dy * si, ly = dx * si + dy * c; return Math.abs(lx) < s.w * s.sc / 2 + pad && Math.abs(ly) < s.h * s.sc / 2 + pad; };
  const hitMin = (s, x, y, pad, unitPx, minPx = 48) => {
    const dx = x - s.x, dy = y - s.y, c = Math.cos(-s.rot), si = Math.sin(-s.rot), lx = dx * c - dy * si, ly = dx * si + dy * c;
    const sw = s.w * s.sc, sh = s.h * s.sc, u = Math.max(1e-6, unitPx);
    const px = Math.max(pad, (minPx / u - sw) / 2), py = Math.max(pad, (minPx / u - sh) / 2);
    return Math.abs(lx) < sw / 2 + px && Math.abs(ly) < sh / 2 + py;
  };
  const inBoxMin = (b, x, y, pad, unitPx, minPx = 48) => {
    if (!b) return false;
    const w = b.x1 - b.x0, h = b.y1 - b.y0, u = Math.max(1e-6, unitPx);
    const px = Math.max(pad, (minPx / u - w) / 2), py = Math.max(pad, (minPx / u - h) / 2);
    return x >= b.x0 - px && x <= b.x1 + px && y >= b.y0 - py && y <= b.y1 + py;
  };
  const pickHit = (items, x, y, pad, unitPx, getS = q => q, minPx = 48, minPad = pad) => {
    for (const it of items) { const s = getS(it); if (s && hit(s, x, y, pad)) return it; }
    let best = null, bd = 1e18;
    for (const it of items) {
      const s = getS(it);
      if (!s || !hitMin(s, x, y, minPad, unitPx, minPx)) continue;
      const d = Math.hypot(x - s.x, y - s.y);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  };
  function placeDragged(e) {
    if (!drag) return;
    const p = toW(e), s = drag.s;
    const k = cam.h / Math.max(1, innerHeight);
    const dragSc = drag.piece ? s.tp.sc : 1;
    const halfH = (Math.abs(Math.sin(s.rot)) * s.w + Math.abs(Math.cos(s.rot)) * s.h) * s.sc / 2;
    const want = drag.touch && Math.max(s.w, s.h) * dragSc / k < 110 ? halfH + 22 * k : 0;
    const room = Math.max(0, innerHeight - 10 - e.clientY) * k, lift = Math.min(want, room);
    const r = want ? clamp(Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) / 40, 0, 1) : 0;
    s.x = p.w[0] + drag.ox * (1 - r);
    s.y = p.w[1] + drag.oy * (1 - r) - lift * r;
  }
  const pieceTolW = s => {
    const pxPerW = innerHeight / Math.max(1, cam.h);
    const shortW = Math.min(s.w, s.h) * (s.tp ? s.tp.sc : s.sc);
    if (playerLevel() === 'own') {
      const minPx = s.c && s.c.isCard ? 40 : 32;
      return Math.max(minPx, 0.35 * shortW * pxPerW) / pxPerW;
    }
    const vs = (RD && RD.vh ? RD.vh : cam.h) / 330;
    return Math.max(15 * vs, shortW * 0.3, 36 * cam.h / Math.max(1, innerHeight));
  };
  const isPieceSnap = s => {
    if (!s || !s.tp || s.waiting || s.returning) return false;
    const rotOk = Math.abs(Math.sin(s.rot / 2)) < 0.05 || Math.abs(((s.rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) < 0.05;
    return Math.hypot(s.x - s.tp.x, s.y - s.tp.y) < pieceTolW(s) && rotOk;
  };
  const isPartSnap = s => { if (!s.ok) return null; const near = RD.parts.filter(q => q.ok && !q.placed && q.sig === s.sig).sort((a, b) => Math.hypot(a.tx - s.x, a.ty - s.y) - Math.hypot(b.tx - s.x, b.ty - s.y))[0]; const tol = Math.max(RD.FH * 0.42, 40 * cam.h / Math.max(1, innerHeight)); return (near && Math.hypot(near.tx - s.x, near.ty - s.y) < tol) ? near : null; };
  let attractN = 0, firstInput = false;
  function stopAttract() {
    attract = false;
    timers = timers.filter(t => t.tag !== 'at' && t.tag !== 'rd' && t.tag !== 'rd2' && t.tag !== 'peek');
    if (RD) { RD.list.forEach(c => { if (!pending.includes(c) && csp[c.id] && !isBuiltId(prog, c.id)) { hideCountry(c); c.built = false; } }); }
    const willPick = store.players.length === 0 || store.players.length >= 2;
    goWorld(willPick ? 0 : 0.8);
    if (store.players.length === 0) openPicker('tokens');
    else if (store.players.length >= 2) openPicker('pick');
  }
  function handleMapTap(p) {
    if (!RD || mode !== 'map') return;
    if (RD.cardLanded && RD.cardLanded.c) {
      const s = RD.cardLanded, c = s.c;
      if (hit(s, p.w[0], p.w[1], 6 * cam.h / 330)) {
        const lx = c.cx + (p.w[0] - s.x) / s.sc, ly = c.cy + (p.w[1] - s.y) / s.sc;
        if (pipPolys(lx, ly, c.polys) || (lx >= c.bbox[0] - 2 && lx <= c.bbox[2] + 2 && ly >= c.bbox[1] - 2 && ly <= c.bbox[3] + 2)) {
          s.lift = 0.08; tw(s, { lift: 0 }, 0.25); allStars = true;
          showCountryTag(c, s, 3.0);
          speakCountry(c, !!CAP[c.id]);
          return;
        }
      }
    }
    let hitC = null, bestA = 1e9;
    for (const id in csp) {
      const s = csp[id], c = s && s.c;
      if (!c || (RD.cardLanded === s && (s._onCard || s.sc > 1.05))) continue;
      if (p.w[0] < c.bbox[0] || p.w[0] > c.bbox[2] || p.w[1] < c.bbox[1] || p.w[1] > c.bbox[3]) continue;
      if (pipPolys(p.w[0], p.w[1], c.polys)) {
        const a = c.A || (c.bw * c.bh);
        if (a < bestA) { bestA = a; hitC = c; }
      }
    }
    if (!hitC) {
      const pad = 8 * cam.h / 330;
      let bd = 1e9;
      for (const id in csp) {
        const s = csp[id], c = s && s.c;
        if (!c || c === AQ || (RD.cardLanded === s && (s._onCard || s.sc > 1.05))) continue;
        if (p.w[0] >= c.bbox[0] - pad && p.w[0] <= c.bbox[2] + pad && p.w[1] >= c.bbox[1] - pad && p.w[1] <= c.bbox[3] + pad) {
          const ac = c.c || [c.cx, c.cy], d = Math.hypot(p.w[0] - ac[0], p.w[1] - ac[1]);
          if (d < bd) { bd = d; hitC = c; }
        }
      }
    }
    if (hitC) {
      const s = csp[hitC.id];
      if (s) { s.lift = 0.08; tw(s, { lift: 0 }, 0.25); }
      allStars = true;
      showCountryTag(hitC, s, 3.0);
      speakCountry(hitC, !!CAP[hitC.id]);
    }
  }
  function handleWorldTap(wx, wy) {
    if (!currentPlayer() && Q.get('done') !== 'all') { openPicker(store.players.length ? 'pick' : 'tokens'); return; }
    if (twins.length > 0) {
      if (wx < BACKING_BOX[0] || wx > BACKING_BOX[2] || wy < BACKING_BOX[1] || wy > BACKING_BOX[3]) {
        sfx.back();
        sendAllTwinsHome(false);
      }
      return;
    }
    const n = nextCont();
    if (n && tag && tag.alpha > 0.5 && hit(tag, wx, wy, 10)) { beginRound(n); return; }
    if (n && n.id === 'all') {
      let hitC = countryAt(wx, wy);
      if (!hitC) {
        const pad = 8;
        let bd = 1e9;
        for (const c of G.countries) {
          if (wx >= c.bbox[0] - pad && wx <= c.bbox[2] + pad && wy >= c.bbox[1] - pad && wy <= c.bbox[3] + pad) {
            const cc = c.c || [c.cx, c.cy], d = Math.hypot(cc[0] - wx, cc[1] - wy);
            if (d < bd) { bd = d; hitC = c; }
          }
        }
      }
      if (hitC) {
        const ct = CI[hitC.cont];
        if (contDone(ct)) { beginRound(ct, { replay: true, r: 0 }); return; }
      }
      beginRound(n);
      return;
    }
    let best = null, bd = 90;
    for (const c of G.countries) { const cc = c.c || [c.cx, c.cy]; const inb = wx > c.bbox[0] - 3 && wx < c.bbox[2] + 3 && wy > c.bbox[1] - 3 && wy < c.bbox[3] + 3; const d = Math.hypot(cc[0] - wx, cc[1] - wy) * (inb ? 0.3 : 1); if (d < bd) { bd = d; best = c; } }
    if (!best) {
      if (!n) { if (wx > AQ.bbox[0] && wx < AQ.bbox[2] && wy > AQ.bbox[1] && wy < AQ.bbox[3]) beginRound(CI.all, { replay: true, r: 0 }); else wakeAll(); return; }
      setHint('Tap ' + n.name + ' to build it'); return;
    }
    const ct = CI[best.cont];
    if (ct === n) beginRound(ct);
    else if (contDone(ct)) beginRound(ct, { replay: true, r: 0 });
    else setHint('First build ' + n.name);
  }
  function onDown(e) {
    if (isPhonePortrait()) return;
    idleTime = 0;
    if (attract) { stopAttract(); return; }
    if (hold || drag || twinDrag || pinch) return;
    activePtrs.set(e.pointerId, { id: e.pointerId, cx: e.clientX, cy: e.clientY });
    const p = toW(e); ptr = [e.clientX / innerWidth, e.clientY / innerHeight];
    if (picker) { handlePickerDown(p, e); return; }
    if (passport) { handlePassportDown(p); return; }
    if (mode === 'mail') { amDown(e, p); return; } // air mail
    if (needFirstPick) { needFirstPick = false; openPicker('pick'); return; }
    if (activePtrs.size >= 2 && ((mode === 'map' && playerLevel() === 'own' && RD && !drag) || (mode === 'world' && twins.length > 0 && !twinDrag))) {
      pan = null; mapTap = null; worldTap = null;
      const pts = [...activePtrs.values()].slice(0, 2);
      const midX = (pts[0].cx + pts[1].cx) / 2, midY = (pts[0].cy + pts[1].cy) / 2;
      const dist = Math.max(8, Math.hypot(pts[1].cx - pts[0].cx, pts[1].cy - pts[0].cy));
      killTw(cam);
      pinch = { id0: pts[0].id, id1: pts[1].id, dist0: dist, h0: cam.h, wMid: screen2W(midX, midY) };
      return;
    }
    const hPx = hudPx(), wPx = worldPx();
    const topHits = [];
    if (currentPlayer() && playerBtn.alpha > 0.5) topHits.push({ kind: 'token', s: playerBtn });
    for (const id of BTN_IDS) { const s = btn[id]; if (s && s.alpha > 0.5) topHits.push({ kind: 'btn', id, s }); }
    const topHit = pickHit(topHits, p.hx, p.hy, 8, hPx, q => q.s);
    if (topHit) {
      if (topHit.kind === 'token') { // batch 4b: during a round the token only wobbles
        if (mode === 'world') { playerBtn.wob = undefined; playerBtn.lift = 0.15; tw(playerBtn, { lift: 0 }, 0.3); openPicker('pick'); } else startWobble(playerBtn);
        return;
      }
      const id = topHit.id, s = topHit.s;
      if (isZoomBtn(id)) return press(id);
      s.lift = 0.15; tw(s, { lift: 0 }, 0.3); return press(id);
    }
    if (RD && (mode === 'flags' || mode === 'map')) {
      const railHits = [];
      for (let i = 0; i < RD.col.length; i++) {
        const fs = RD.col[i], lb = RD.colLabels && RD.colLabels[i] && RD.colLabels[i].s;
        if (fs && fs.alpha > 0.5) railHits.push({ i, fs, lb, s: fs });
        if (lb && lb.alpha > 0.5) railHits.push({ i, fs, lb, s: lb });
      }
      const rh = pickHit(railHits, p.hx, p.hy, 6, hPx, q => q.s);
      if (rh) {
        const rc = (rh.fs && rh.fs._c) || (rh.lb && rh.lb._c) || RD.list[rh.i];
        if (rh.fs) { rh.fs.lift = 0.14; tw(rh.fs, { lift: 0 }, 0.2, { cut: true }); }
        if (rc) speakCountry(rc, !!(rc.built && CAP[rc.id]));
        return;
      }
    }
    if (mode === 'world') {
      if (!currentPlayer() && Q.get('done') !== 'all') { openPicker(store.players.length ? 'pick' : 'tokens'); return; }
      const twHit = hitTwinAt(p.w[0], p.w[1]);
      if (twHit) {
        twinDrag = { id: e.pointerId, tw: twHit, existing: true, moved: false, sx: e.clientX, sy: e.clientY, t: performance.now(), ox: twHit.s.x - p.w[0], oy: twHit.s.y - p.w[1] };
        return;
      }
      const onLastTag = !!nextCont() && tag && tag.alpha > 0.5 && hit(tag, p.w[0], p.w[1], 10);
      worldTap = { id: e.pointerId, sx: e.clientX, sy: e.clientY, wx: p.w[0], wy: p.w[1], t: performance.now(), liftCandidate: onLastTag ? null : liftCandidateAt(p.w[0], p.w[1]) };
      return;
    }
    if (mode === 'flags' && RD) {
      if (RD.memory && hit(RD.model, p.w[0], p.w[1], 6)) { peek(true); return; }
      const loose = RD.parts.filter(s => !s.placed).sort((a, b) => b.order - a.order);
      const partPad = e.pointerType === 'touch' ? Math.max(9, 22 / wPx) : 9;
      const c = pickHit(loose, p.w[0], p.w[1], 9, wPx, q => q, 48, partPad);
      if (c) { drag = { id: e.pointerId, s: c, ox: c.x - p.w[0], oy: c.y - p.w[1], sx: e.clientX, sy: e.clientY, t: performance.now(), inSnap: !!isPartSnap(c), touch: e.pointerType === 'touch' }; c.order = 90; tw(c, { lift: drag.inSnap ? 0.12 : 0.3, sc: 1, rot: 0 }, 0.15, { cut: true }); sfx.pick(); return; }
      if (RD.memory && hitMin(RD.model, p.w[0], p.w[1], 6, wPx)) { peek(true); return; }
      return;
    }
    if (mode === 'map' && RD) {
      if (RD.piece) {
        const s = RD.piece, anc = anchorOf(s);
        if (hitMin(s, p.w[0], p.w[1], 14 * cam.h / 330, wPx) || Math.hypot(p.w[0] - anc[0], p.w[1] - anc[1]) < Math.max(22 * cam.h / 330, 24 / wPx)) {
          const wasWait = !!(s.waiting || s.returning), wasReturning = !!s.returning;
          s.returning = null;
          drag = { id: e.pointerId, s, ox: s.x - p.w[0], oy: s.y - p.w[1], wx: p.w[0], wy: p.w[1], sx: e.clientX, sy: e.clientY, t: performance.now(), piece: true, scaled: !wasWait, wasReturning, inSnap: !wasWait && isPieceSnap(s), touch: e.pointerType === 'touch' };
          tw(s, { lift: drag.inSnap ? 0.14 : 0.32 }, 0.15, { cut: true }); sfx.pick();
          return;
        }
      }
      const visTags = [];
      for (let i = activeTags.length - 1; i >= 0; i--) {
        const n = activeTags[i];
        if (S.includes(n) && n.alpha > 0.5) visTags.push(n);
      }
      const hitTag = pickHit(visTags, p.w[0], p.w[1], 4 * cam.h / 330, wPx);
      if (hitTag) {
        hitTag.lift = 0.14; tw(hitTag, { lift: 0 }, 0.2, { cut: true });
        if (hitTag._c) speakCountry(hitTag._c, !!(hitTag._c.built && CAP[hitTag._c.id]));
        return;
      }
      mapTap = { id: e.pointerId, sx: e.clientX, sy: e.clientY, t: performance.now() };
      if (playerLevel() === 'own') {
        killTw(cam);
        pan = { id: e.pointerId, sx: e.clientX, sy: e.clientY, camX0: cam.x, camY0: cam.y };
      }
    }
  }
  function resetHoldPose() {
    if (!hold) return;
    const it = hold.item;
    it.card.x = it.hx; it.card.y = it.hy; it.card.rot = 0; it.card.lift = 0;
    if (it.nameS) { it.nameS.x = it.nameS.hx; it.nameS.y = it.nameS.hy; it.nameS.rot = it.nameS.tilt || 0; it.nameS.lift = 0; }
    if (it.levelS) { it.levelS.x = it.levelS.hx; it.levelS.y = it.levelS.hy; it.levelS.rot = 0; it.levelS.lift = 0; }
  }
  function onMove(e) {
    if (mode === 'mail') { amMove(e); return; } // air mail
    if (drag && e.pointerId !== drag.id) return;
    if (twinDrag && e.pointerId !== twinDrag.id) return;
    if (hold && e.pointerId !== hold.id) return;
    if (e.movementX || e.movementY || drag || twinDrag || pan || pinch || worldTap) idleTime = 0;
    if (activePtrs.has(e.pointerId)) { const ap = activePtrs.get(e.pointerId); ap.cx = e.clientX; ap.cy = e.clientY; }
    ptr = [e.clientX / innerWidth, e.clientY / innerHeight];
    if (mapTap && e.pointerId === mapTap.id && Math.hypot(e.clientX - mapTap.sx, e.clientY - mapTap.sy) >= 7) mapTap = null;
    if (hold) {
      const p = toW(e);
      if (Math.hypot(e.clientX - hold.sx, e.clientY - hold.sy) > 28 || !hit(hold.item.card, p.hx, p.hy, 10)) {
        resetHoldPose(); hold = null;
      }
      return;
    }
    if (pinch && ((mode === 'map' && playerLevel() === 'own' && RD) || (mode === 'world' && twins.length > 0))) {
      const p0 = activePtrs.get(pinch.id0), p1 = activePtrs.get(pinch.id1);
      if (p0 && p1) {
        const midX = (p0.cx + p1.cx) / 2, midY = (p0.cy + p1.cy) / 2;
        const dist = Math.max(8, Math.hypot(p1.cx - p0.cx, p1.cy - p0.cy));
        const base = mode === 'world' ? worldFrame() : (RD.baseCam || contFrame(RD.ct));
        const ch = clamp(pinch.h0 * (pinch.dist0 / dist), 90, base.h);
        const fx = midX / innerWidth - 0.5, fy = midY / innerHeight - 0.5;
        const cl = clampCamVals(pinch.wMid[0] - fx * ch * asp, pinch.wMid[1] - fy * ch, ch);
        cam.x = cl.x; cam.y = cl.y; cam.h = cl.h;
      }
      return;
    }
    if (worldTap && e.pointerId === worldTap.id && mode === 'world') {
      const moved = Math.hypot(e.clientX - worldTap.sx, e.clientY - worldTap.sy);
      if (moved >= 6) {
        const wt = worldTap; worldTap = null;
        if (wt.liftCandidate) {
          const c = wt.liftCandidate;
          const ox = c.cx - wt.wx, oy = c.cy - wt.wy;
          const p = toW(e);
          clearCompareTag(false);
          const twObj = liftTwin(c, { x: p.w[0] + ox, y: p.w[1] + oy, lifted: true });
          sfx.pick();
          twinDrag = { id: e.pointerId, tw: twObj, existing: false, moved: true, sx: wt.sx, sy: wt.sy, t: wt.t, ox, oy };
          return;
        }
        if (twins.length > 0) {
          killTw(cam);
          pan = { id: e.pointerId, sx: wt.sx, sy: wt.sy, camX0: cam.x, camY0: cam.y };
        }
      }
    }
    if (pan && e.pointerId === pan.id && ((mode === 'map' && playerLevel() === 'own' && RD) || (mode === 'world' && twins.length > 0))) {
      const dx = (e.clientX - pan.sx) / innerHeight * cam.h, dy = (e.clientY - pan.sy) / innerHeight * cam.h;
      const cl = clampCamVals(pan.camX0 - dx, pan.camY0 - dy, cam.h);
      cam.x = cl.x; cam.y = cl.y; cam.h = cl.h;
      return;
    }
    if (twinDrag && e.pointerId === twinDrag.id && mode === 'world') {
      const td = twinDrag, s = td.tw.s;
      if (!td.moved && Math.hypot(e.clientX - td.sx, e.clientY - td.sy) >= 6) {
        td.moved = true;
        bringTwinToFront(td.tw);
        s.order = 95;
        tw(s, { z: 0.56 }, 0.12, { cut: true });
        clearCompareTag(false);
        sfx.pick();
      }
      if (td.moved) {
        const p = toW(e);
        s.x = p.w[0] + td.ox; s.y = p.w[1] + td.oy;
      }
      return;
    }
    if (!drag) return;
    const p = toW(e), s = drag.s;
    if (drag.piece && !drag.scaled && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) >= 5) {
      const ratio = s.tp.sc / s.sc;
      drag.ox = (s.x - drag.wx) * ratio; drag.oy = (s.y - drag.wy) * ratio;
      s.sc = s.tp.sc; s.waiting = false; s.returning = null;
      drag.scaled = true;
    }
    if (drag.piece && !drag.scaled) return;
    if (drag.piece) s.sc = s.tp.sc;
    placeDragged(e);
    if (drag.piece) { const snap = isPieceSnap(s); if (snap !== drag.inSnap) { drag.inSnap = snap; killTw(s, ['lift']); s.lift = snap ? 0.14 : 0.32; } }
    else { const snap = !!isPartSnap(s); if (snap !== drag.inSnap) { drag.inSnap = snap; killTw(s, ['lift']); s.lift = snap ? 0.12 : 0.3; } }
  }
  function turn(s) {
    const nr = (s._rotTo !== undefined ? s._rotTo : s.rot) + Math.PI / 2; s._rotTo = nr;
    if (s.waiting) {
      tw(s, { rot: nr }, 0.22, { cut: true, done: () => { s._piv = null; s._rotTo = undefined; } });
      sfx.turn();
      return;
    }
    const piv = s._piv || anchorOf(s); s._piv = piv;
    const d = anchorDelta(s.c);
    const co = Math.cos(nr), si = Math.sin(nr);
    const nx = piv[0] - (d[0] * co - d[1] * si) * s.sc, ny = piv[1] - (d[0] * si + d[1] * co) * s.sc;
    tw(s, { rot: nr, x: nx, y: ny }, 0.22, { cut: true, done: () => { s._piv = null; s._rotTo = undefined; } });
    sfx.turn();
  }
  function onUp(e) {
    idleTime = 0;
    activePtrs.delete(e.pointerId);
    if (mode === 'mail') { amUp(e); return; } // air mail
    if (pinch && (e.pointerId === pinch.id0 || e.pointerId === pinch.id1)) { pinch = null; }
    if (drag && e.pointerId !== drag.id) return;
    if (twinDrag && e.pointerId !== twinDrag.id) return;
    if (hold && e.pointerId !== hold.id) return;
    const wasPan = pan && e.pointerId === pan.id;
    if (wasPan) { pan = null; }
    const cancelled = e.type === 'pointercancel';
    if (worldTap && e.pointerId === worldTap.id) {
      const wt = worldTap; worldTap = null;
      if (!cancelled && Math.hypot(e.clientX - wt.sx, e.clientY - wt.sy) < 7 && performance.now() - wt.t < 450 && mode === 'world') {
        handleWorldTap(wt.wx, wt.wy);
      }
      return;
    }
    if (twinDrag && e.pointerId === twinDrag.id) {
      const td = twinDrag; twinDrag = null;
      const twObj = td.tw, s = twObj.s;
      const moved = Math.hypot(e.clientX - td.sx, e.clientY - td.sy);
      if (cancelled) {
        if (!td.existing) sendTwinHome(twObj, false);
        else { const idx = twins.indexOf(twObj); s.order = 70 + idx; tw(s, { z: restZFor(idx) }, 0.14, { cut: true }); }
        return;
      }
      if (!td.moved && moved < 7 && performance.now() - td.t < 450) {
        bringTwinToFront(twObj);
        turn(s);
        return;
      }
      const p = toW(e), ac = anchorOf(s);
      const outOfBacking = (wx, wy) => wx < BACKING_BOX[0] || wx > BACKING_BOX[2] || wy < BACKING_BOX[1] || wy > BACKING_BOX[3];
      if (outOfBacking(p.w[0], p.w[1]) || outOfBacking(ac[0], ac[1])) {
        sfx.back();
        sendTwinHome(twObj, false);
        return;
      }
      bringTwinToFront(twObj);
      const idx = twins.indexOf(twObj);
      s.order = 70 + idx;
      tw(s, { z: restZFor(idx) }, 0.14, { cut: true });
      sfx.pick();
      const under = countryAt(ac[0], ac[1]);
      if (under && under.built && under !== twObj.c) {
        showCompareTag(twObj, under, compareSentence(twObj.c, under), 4.0);
      }
      return;
    }
    if (mapTap && e.pointerId === mapTap.id) {
      const mt = mapTap; mapTap = null;
      if (!cancelled && Math.hypot(e.clientX - mt.sx, e.clientY - mt.sy) < 7 && performance.now() - mt.t < 450 && mode === 'map' && RD && !RD.auto) {
        handleMapTap(toW(e));
      }
      if (wasPan) return;
    } else if (wasPan) {
      return;
    }
    if (hold) {
      const h = hold;
      const elapsed = T - h.t0, moved = Math.hypot(e.clientX - h.sx, e.clientY - h.sy);
      resetHoldPose(); hold = null;
      if (!cancelled && elapsed < 0.35 && moved < 14 && picker && picker.kind === 'pick') {
        if (h.inName) { openPicker('editName', { player: h.player, isNew: false }); seedNameInput(h.player); }
        else if (h.inLevel) {
          h.player.level = cleanLevel(h.player.level) === 'help' ? 'own' : 'help';
          save();
          rebuildPicker();
        }
        else { if (h.player.id !== store.current) switchPlayer(h.player); closePicker(true); }
      }
      return;
    }
    if (!drag) return; const d = drag, s = d.s; drag = null; const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
    if (d.piece) {
      if (d.wasReturning && !d.scaled) { s.waiting = true; syncWaitingPiece(s); }
      const rotOk = Math.abs(Math.sin(s.rot / 2)) < 0.05 || Math.abs(((s.rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) < 0.05;
      if (!cancelled && moved < 7 && performance.now() - d.t < 450 && (RD.ct.rotate || !rotOk)) { turn(s); tw(s, { lift: 0.12 }, 0.18, { cut: true }); return; }
      if (s.waiting) { tw(s, { lift: 0.12 }, 0.18, { cut: true }); return; }
      const dist = Math.hypot(s.x - s.tp.x, s.y - s.tp.y), tol = pieceTolW(s);
      if (!cancelled && dist < tol && rotOk) return landPiece(s);
      if (!cancelled) {
        RD.miss++; sfx.back();
        if (dist < tol) { setHint('Turn it first. Tap the piece'); tw(s, { lift: 0.12 }, 0.18, { cut: true }); s.wig = T; return; }
      }
      s._piv = null; s._rotTo = undefined;
      if (playerLevel() === 'own') {
        s.returning = { fromX: s.x, fromY: s.y, fromSc: s.sc, t0: T, dur: 0.42 };
        tw(s, { lift: 0.12 }, 0.42, { cut: true });
        if (!cancelled) {
          setHint(RD.ct.outlines || s.c.isCard ? 'Not there. Find the same shape' : 'Not there. Look at the neighbours');
          if (RD.miss >= 4) applyHintStep(2);
          else if (RD.miss >= 2) applyHintStep(1);
        }
      } else {
        tw(s, { x: s.home[0], y: s.home[1], lift: 0.12 }, 0.42, { cut: true });
        if (!cancelled) {
          setHint(RD.ct.outlines || s.c.isCard ? 'Not there. Find the same shape' : 'Not there. Look at the neighbours');
          if (RD.miss >= 2) showGhost();
        }
      }
      return;
    }
    // flag part
    const near = cancelled ? null : isPartSnap(s);
    const onMat = !cancelled && Math.abs(s.x - RD.mx) < FL[RD.list[RD.fi].id].a * RD.FH / 2 + 20 && Math.abs(s.y - RD.my) < RD.FH / 2 + 20;
    if (near) return placePart(s, near);
    if (!cancelled) sfx.back();
    tw(s, { x: s.hx, y: s.hy, rot: s.hr, sc: s.ts, lift: 0 }, 0.4, { cut: true, done: () => { s.order = 40; } });
    if (onMat) { if (!s.ok) setHint('That part is from another flag'); else setHint('Not there. Look where it sits'); const m = RD.model; if (RD.memory) peek(true); else { m.lift = 0.2; tw(m, { lift: 0 }, 0.8); } } else if (!cancelled && moved > 30) setHint('Drop it on the mat');
  }
  function showGhost() { const s = RD.piece; if (!s || RD.ghost) return; const g = spr(s.tex, { x: s.tp.x, y: s.tp.y, w: s.w, h: s.h, sc: s.tp.sc, z: 0.19, zr: 0.02, order: 19 + 30, alpha: 0.4, tint: [1.25, 1.2, 1.05] }); g.ghost = T; RD.ghost = g; RD.tmp.push(g); after(3, () => { kill(g); if (RD) RD.ghost = null; }, 'rd'); }
  function press(id) {
    if (id === 'mail') { amEnter(); return; } // air mail
    if (id === 'sound') {
      if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
      soundOn = !soundOn;
      if (soundOn) { if (AC) AC.resume(); unlockSpeech(); }
      else stopSpeech();
      mkBtn('sound', soundOn ? 'Sound on' : 'Enable sound', soundOn ? shade(PAP[6], 0.3) : PAP[5]);
      sfx.snap();
      return;
    }
    if (id === 'passport') {
      if (passport) closePassport(true);
      else openPassport();
      return;
    }
    if (id === 'world') {
      timers = timers.filter(t => t.tag !== 'rd' && t.tag !== 'rd2' && t.tag !== 'wind');
      stopSpeech();
      const wasWind = !!(wind || (RD && RD.wind));
      const windCt = wind ? wind.ct : (RD && RD.ct);
      clearWind(true);
      if (RD) {
        const ct = RD.ct, all = ct.id === 'all', rep = RD.replay, P = RD.placed.slice();
        settleCard(true);
        P.forEach(s => {
          s.pole = s.flag = null;
          if (s.star) { kill(s.star); s.star = null; }
          if (!isBuiltId(prog, s.c.id)) { s.c.built = false; hideCountry(s.c); }
          else { killTw(s); s.x = s.c.cx; s.y = s.c.cy; s.sc = 1; s.rot = 0; s.lift = 0; s.z = 0.17; s.order = 20; }
        });
        goWorld();
        if (all || rep || wasWind) {
          ct.order.forEach(c => { if (isBuiltId(prog, c.id)) { c.built = true; showCountry(c, true); } });
          if (all && contDone(CI.all) && !aqS) { bakeCountry(AQ); aqS = spr(AQ.tex, { x: AQ.cx, y: AQ.cy, w: AQ.tw, h: AQ.th, z: 0.17, zr: 0.045, order: 20 }); aqS.c = AQ; csp.AQ = aqS; }
        }
      } else {
        goWorld();
        if (wasWind && windCt) {
          windCt.order.forEach(c => { if (isBuiltId(prog, c.id)) { c.built = true; showCountry(c, true); } });
        }
      }
      return;
    }
    if (id === 'zoomOut' || id === 'zoomIn') { zoomStep(id === 'zoomIn' ? 1 : -1, btn[id]); return; }
    if (!RD) return;
    if (id === 'hint') {
      if (mode === 'flags') {
        const s = RD.parts.filter(q => q.ok && !q.placed).sort((a, b) => a.idx - b.idx)[0];
        if (s) { s.breath = T; const g = spr(s.tex, { x: s.tx, y: s.ty, w: s.w, h: s.h, z: 0.13, zr: 0.01, order: 39, alpha: 0.35 }); g.ghost = T; RD.tmp.push(g); after(2.6, () => kill(g), 'rd'); }
        if (RD.memory) peek(true);
      } else if (mode === 'map') {
        if (playerLevel() === 'own') applyHintStep(RD.hintStep < 1 ? 1 : 2);
        else showGhost();
      }
      return;
    }
    if (id === 'undo') {
      if (mode === 'flags' && RD.hist.length) {
        const s = RD.hist.pop(); s.placed = false; sfx.back(); tw(s, { x: s.hx, y: s.hy, rot: s.hr, sc: s.ts }, 0.4, { cut: true });
      } else if (mode === 'map' && RD.placed.length && !RD.auto) {
        const s = RD.placed.pop(), c = s.c;
        if (!RD.replay && !attract && c !== AQ && currentPlayer()) {
          const pl = currentPlayer();
          if (pl.rec) {
            if (s._prevRec) pl.rec[c.id] = s._prevRec;
            else delete pl.rec[c.id];
            if (!RD.wind) save();
          }
        }
        if (RD.spawning) {
          const sp = RD.spawning; RD.queue.unshift(sp); RD.spawning = null;
          if (RD.wind && RD.windPile && !RD.windPile[sp.id]) RD.windPile[sp.id] = mkPileSprite(sp, cam, 0, RD.queue.length);
        }
        if (RD.piece) {
          const q = RD.piece; RD.queue.unshift(q.c); [q, q.pole, q.flag].forEach(x => x && kill(x)); RD.piece = null;
          if (RD.wind && RD.windPile && !RD.windPile[q.c.id]) RD.windPile[q.c.id] = mkPileSprite(q.c, cam, 0, RD.queue.length);
        }
        if (RD.ghost) { kill(RD.ghost); RD.ghost = null; }
        if (RD.cardLanded === s) RD.cardLanded = null;
        clearTags(c);
        killCardOverlays(true); c.built = false; delete csp[c.id]; [s.pole, s.flag, s.star].forEach(x => x && kill(x)); kill(s);
        timers = timers.filter(t => t.tag !== 'rd'); RD.queue.unshift(c); sfx.back(); nextPiece();
      }
    }
  }
  B.cv.addEventListener('pointerdown', e => { try { B.cv.setPointerCapture(e.pointerId); } catch (_) { } firstInput = true; onDown(e); });
  B.cv.addEventListener('pointermove', onMove);
  B.cv.addEventListener('pointerup', e => { onUp(e); if (pendingFocus) focusNameInput(); });
  B.cv.addEventListener('pointercancel', e => { activePtrs.delete(e.pointerId); onUp(e); });
  // batch 4b: the camera from a mouse wheel, a trackpad and the + and - buttons. A mouse wheel sends large steps; a trackpad's
  // two-finger scroll sends many small ones, so the first 30 px of every event count 2.7 times as much as before; a trackpad pinch
  // arrives as wheel events with ctrlKey set (Chrome, Firefox) or as gesture events (Safari), and a full pinch (about 100-150 px of
  // deltaY) covers the whole zoom range. The page itself never scrolls or zooms.
  const zoomBase = () => mode === 'world' ? worldFrame() : (RD.baseCam || contFrame(RD.ct));
  function zoomAt(sx, sy, factor) {
    const base = zoomBase(), ch = clamp(cam.h * factor, 90, base.h);
    const fx = sx / innerWidth - 0.5, fy = sy / innerHeight - 0.5, wx = cam.x + fx * cam.h * asp, wy = cam.y + fy * cam.h;
    const cl = clampCamVals(wx - fx * ch * asp, wy - fy * ch, ch);
    cam.x = cl.x; cam.y = cl.y; cam.h = cl.h;
  }
  const followCam = e => { // a held piece stays under the pointer while the camera moves
    if (drag && drag.piece && drag.scaled) { drag.s.sc = drag.s.tp.sc; placeDragged(e); }
    if (twinDrag && twinDrag.moved) { const p = toW(e); twinDrag.tw.s.x = p.w[0] + twinDrag.ox; twinDrag.tw.s.y = p.w[1] + twinDrag.oy; }
  };
  let zoomK = null; // the step (0 = the whole continent or world, 3 = the closest) the + and - buttons last aimed at
  function zoomStep(dir, s) { // + zooms toward the screen centre in three steps down to the closest limit; - goes back step by step
    if (!zoomable()) return;
    idleTime = 0;
    const base = zoomBase(); if (base.h <= 92) { startWobble(s); return; }
    const r = Math.pow(90 / base.h, 1 / 3), q = tweens.find(t => t.o === cam), goal = q ? { x: q.to.x, y: q.to.y, h: q.to.h } : { x: cam.x, y: cam.y, h: cam.h };
    const kNow = q && zoomK !== null ? zoomK : Math.log(clamp(goal.h, 90, base.h) / base.h) / Math.log(r);
    if ((dir > 0 && kNow > 2.85) || (dir < 0 && kNow < 0.15)) { startWobble(s); return; } // already at the limit: the button only wobbles
    const k = clamp(dir > 0 ? Math.floor(kNow + 0.15) + 1 : Math.ceil(kNow - 0.15) - 1, 0, 3); zoomK = k;
    s.lift = 0.15; tw(s, { lift: 0 }, 0.3);
    if (k === 0) { if (mode === 'map' && RD) { const b = contFrame(RD.ct); RD.baseCam = b; camTo(b.x, b.y, b.h, 0.45); } else camTo(base.x, base.y, base.h, 0.45); return; }
    const cl = clampCamVals(goal.x, goal.y, base.h * Math.pow(r, k)); camTo(cl.x, cl.y, cl.h, 0.45);
  }
  B.cv.addEventListener('wheel', e => {
    e.preventDefault();
    if (!zoomable()) return;
    idleTime = 0;
    killTw(cam);
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 24; else if (e.deltaMode === 2) dy *= 300;
    let k;
    if (e.ctrlKey) k = clamp(dy, -60, 60) * 0.016; // pinch
    else { const a = Math.min(240, Math.abs(dy)); k = Math.sign(dy) * (Math.min(a, 30) * 0.006 + Math.max(0, a - 30) * 0.0012); } // wheel or two-finger scroll
    zoomAt(e.clientX, e.clientY, Math.exp(k));
    followCam(e);
  }, { passive: false });
  addEventListener('wheel', e => e.preventDefault(), { passive: false });
  let gest = null;
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) addEventListener(t, e => {
    e.preventDefault();
    if (t === 'gesturestart') { gest = zoomable() ? { h0: cam.h } : null; if (gest) killTw(cam); return; }
    if (t === 'gestureend') { gest = null; return; }
    if (!gest || !zoomable() || !(e.scale > 0)) return;
    idleTime = 0; zoomAt(e.clientX, e.clientY, gest.h0 * Math.pow(e.scale, -1.6) / cam.h); followCam(e);
  }, { passive: false });
  B.cv.addEventListener('click', () => { if (pendingFocus) { focusNameInput(); pendingFocus = false; } });
  addEventListener('keydown', e => { if (isPhonePortrait()) return; if (inp && document.activeElement === inp) return; idleTime = 0; if (attract) { stopAttract(); return; } if (needFirstPick) { needFirstPick = false; openPicker('pick'); return; } if (picker) { if (e.key === 'Escape' && currentPlayer()) closePicker(true); return; } if (passport) { if (e.key === 'Escape') { e.preventDefault(); closePassport(true); } else if (e.key === 'ArrowRight') { e.preventDefault(); turnPassport(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); turnPassport(-1); } return; } const k = e.key.toLowerCase(); if (k === 'r' || k === ' ') { if (mode === 'map' && RD && RD.piece) turn(RD.piece); else if (mode === 'world' && nextCont()) beginRound(nextCont()); } else if (k === 'enter' && mode === 'world' && nextCont()) beginRound(nextCont()); else if (k === 'h') press('hint'); else if (k === 'z' || k === 'u') press('undo'); else if (k === 'escape' || k === 'w') press('world'); else if (k === 's') press('sound'); else if (!e.ctrlKey && !e.metaKey && (k === '+' || k === '=' || k === '-') && zoomable()) press(k === '-' ? 'zoomOut' : 'zoomIn'); });
  let resizeTmr = null, lastCam = { x: cam.x, y: cam.y, h: cam.h }, camStill = 0;
  function onResizeSettled() {
    rebakeFonts();
    if (drag || twinDrag || (AM.on && AM.pull) || isPhonePortrait()) return;
    if (mode === 'flags' && RD && RD.parts && RD.parts.length) {
      if (RD.parts.every(p => !p.ok || p.placed)) return;
      const placedIdx = RD.parts.filter(p => p.ok && p.placed).map(p => p.idx);
      const wasMemHidden = RD.memory && !RD.memShowing;
      timers = timers.filter(t => t.tag !== 'peek' && t.tag !== 'rd');
      if (RD.fl) {
        for (const s of RD.fl) kill(s);
        const flSet = new Set(RD.fl);
        RD.tmp = RD.tmp.filter(s => !flSet.has(s) && S.includes(s));
        RD.fl = [];
      }
      for (const s of RD.tmp) if (s.ghost) kill(s);
      RD.tmp = RD.tmp.filter(s => S.includes(s));
      startFlag(true);
      if (wasMemHidden && RD.back) {
        timers = timers.filter(t => t.tag !== 'peek');
        RD.back.alpha = 1; RD.memShowing = false;
        setHint('Build ' + inSent(RD.list[RD.fi]) + ' from memory');
      }
      for (const idx of placedIdx) {
        const p = RD.parts.find(q => q.ok && !q.placed && q.idx === idx);
        if (p) placePart(p, p, true);
      }
    } else if (mode === 'map' && RD && playerLevel() === 'own') {
      const K0 = contFrame(RD.ct);
      RD.baseCam = K0; RD.cam = K0; RD.vh = K0.h;
      camTo(K0.x, K0.y, K0.h, 0.3);
      if (RD.piece && RD.piece.waiting) { syncWaitingPiece(RD.piece); RD.piece.home = [RD.piece.x, RD.piece.y]; }
    } else if (mode === 'map' && RD && playerLevel() !== 'own' && RD.piece) {
      const s = RD.piece, f = framePiece(s.c);
      RD.cam = f.K; RD.vh = f.K.h;
      camTo(f.K.x, f.K.y, f.K.h, 0.3);
      s.tp = f.best.tp; s.home = [f.best.x, f.best.y];
      tw(s, { x: f.best.x, y: f.best.y, sc: f.best.tp.sc }, 0.3, { cut: true });
      if (s.c.isCard && f.best.cardRect && RD.card) {
        const cr = f.best.cardRect;
        RD.card.x = cr.x; RD.card.y = cr.y; RD.card.w = cr.s; RD.card.h = cr.s;
        syncLeader();
      }
      if (RD.ghost) { kill(RD.ghost); RD.ghost = null; }
    } else if (mode === 'world' && !passport && !picker && !isZoomedIn()) {
      const wf = worldFrame();
      camTo(wf.x, wf.y, wf.h, 0.3);
    }
  }
  addEventListener('resize', () => { asp = innerWidth / innerHeight; clearTimeout(resizeTmr); resizeTmr = setTimeout(onResizeSettled, 150); });
  if (window.matchMedia) {
    let mq = null;
    const watchDpr = () => {
      if (mq) mq.onchange = null;
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      mq.onchange = () => { watchDpr(); rebakeFonts(); };
    };
    watchDpr();
  }
  function updateZoomDetail(dt) {
    if (Math.abs(cam.x - lastCam.x) > 0.05 || Math.abs(cam.y - lastCam.y) > 0.05 || Math.abs(cam.h - lastCam.h) > 0.05) {
      lastCam.x = cam.x; lastCam.y = cam.y; lastCam.h = cam.h;
      camStill = 0;
      return;
    }
    camStill += dt;
    if (camStill < 0.3) return;
    if (mode === 'world' && twins.length === 0) {
      if (cbaseZoom && cbaseZoom.ctId === 'world' && !tweens.some(q => q.o === cam)) freeBaseZoom();
      return;
    }
    const worldZoom = mode === 'world' && twins.length > 0;
    if (!worldZoom && (mode !== 'map' || !RD)) return;
    const H = B.size()[1], screenPpu = H / Math.max(40, cam.h);
    const closeZoom = worldZoom ? cam.h < worldFrame().h * 0.85 : cam.h < contFrame(RD.ct).h * 0.85;
    const vx0 = cam.x - cam.h * asp * 0.5, vx1 = cam.x + cam.h * asp * 0.5;
    const vy0 = cam.y - cam.h * 0.5, vy1 = cam.y + cam.h * 0.5;
    let bakesLeft = 2;
    const checkCountry = (c, s) => {
      if (!c || !s || bakesLeft <= 0) return;
      const b = c.bbox;
      if (s === csp[c.id] && (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1)) return;
      const maxPpu = (4096 - 16) / Math.max(c.bw + 2 * (c.padW || 1), c.bh + 2 * (c.padW || 1));
      const curPpu = c.ppu || c.basePpu || 3.4;
      const needed = Math.min(maxPpu, (s.w * s.sc * screenPpu) / Math.max(0.01, c.tw));
      if (needed / curPpu > 1.3 && curPpu < maxPpu - 0.1) {
        if (bakeCountry(c, Math.min(maxPpu, needed * 1.1), closeZoom ? needed : 0)) bakesLeft--;
      } else if (closeZoom ? !(c.capScr && needed / c.capScr < 1.3 && needed / c.capScr > 0.7) : c.capScr) { // batch 4: gaps re-cut for this zoom, or back to the continent-frame cut
        if (bakeCountry(c, closeZoom ? curPpu : c.basePpu, closeZoom ? needed : 0)) bakesLeft--;
      }
    };
    if (RD && RD.piece) checkCountry(RD.piece.c, RD.piece);
    for (const tw_ of twins) if (tw_.s && S.includes(tw_.s)) checkCountry(tw_.c, tw_.s);
    for (const id in csp) { if (bakesLeft <= 0) break; const s = csp[id]; checkCountry(s.c, s); }
    for (const [p, s] of lsp) { if (bakesLeft <= 0) break; const b = p.bbox; if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue; checkCountry(p, s); }
    if (bakesLeft > 0) {
      const curCtId = worldZoom ? 'world' : RD.ct.id;
      const curCt = (worldZoom || RD.ct.id === 'all') ? null : RD.ct;
      const basePpu = (worldZoom || RD.ct.id === 'all') ? wbasePpu : cbasePpu;
      const covered = cbaseZoom && cbaseZoom.ctId === curCtId
        && Math.max(WREG[0], vx0) >= cbaseZoom.reg[0] - 0.5 && Math.min(WREG[2], vx1) <= cbaseZoom.reg[2] + 0.5
        && Math.max(WREG[1], vy0) >= cbaseZoom.reg[1] - 0.5 && Math.min(WREG[3], vy1) <= cbaseZoom.reg[3] + 0.5;
      const curBasePpu = covered ? cbaseZoom.ppu : basePpu;
      if (screenPpu / basePpu <= 1.15) {
        if (cbaseZoom) freeBaseZoom();
      } else if (!covered || screenPpu / curBasePpu > 1.3) {
        const mx = (vx1 - vx0) * 0.3, my = (vy1 - vy0) * 0.3;
        const r = [Math.max(WREG[0], vx0 - mx), Math.max(WREG[1], vy0 - my), Math.min(WREG[2], vx1 + mx), Math.min(WREG[3], vy1 + my)];
        const rw = Math.max(10, r[2] - r[0]), rh = Math.max(10, r[3] - r[1]);
        const tilePpu = Math.min(screenPpu * 1.05, 4096 / rw, 4096 / rh);
        if (tilePpu > basePpu * 1.15 && (!covered || tilePpu > curBasePpu * 1.15)) {
          freeBaseZoom();
          const t = bakeBase(r, tilePpu, curCt);
          const s = spr(t, { x: (r[0] + r[2]) / 2, y: (r[1] + r[3]) / 2, w: rw, h: rh, z: 0.045, zr: 0.11, order: 1.5, own: true });
          cbaseZoom = { s, reg: r, ppu: tilePpu, ctId: curCtId };
          bakesLeft--;
        }
      }
    }
    if (B.texBytes() > 192 * 1024 * 1024) {
      for (const c of G.countries) {
        if (B.texBytes() <= 160 * 1024 * 1024) break;
        if (!c.highRes) continue;
        const b = c.bbox;
        if (b[2] >= vx0 && b[0] <= vx1 && b[3] >= vy0 && b[1] <= vy1) continue;
        if (RD && RD.piece && RD.piece.c === c) continue;
        if (twins.some(tw_ => tw_.c === c)) continue;
        bakeCountry(c, c.basePpu);
      }
    }
  }
  // ---------- air mail ----------
  // Stage A: the throw. Runs only in mode 'mail'. Hooks elsewhere are marked "// air mail".
  const MAIL = { RANGE: 140, T_MIN: 1.2, T_ADD: 2.0, PULL_FULL: 200, PULL_MIN: 30, GRAB_R: 80, CAM_H: 420, PLANE_LEN: 0.06, LIFT_MAX: 0.5, WIND: 42, HALO: 7, SMALL_AREA: 60, RIDE: 170, RIDE_MAX: 1100, RIDE_LAND: 12, NEAR: 30 };
  const AM_NOSE = 0.483; // the nose tip sits this share of the plane length from its centre (the plane texture ends at x = 236 of 240)
  const AM_ENV = [244, 891], ENV_X0 = 24, ENV_Y0 = 806, ENV_W = 440, ENV_H = 170; // envelope centre (HUD, bottom left), top left corner (HUD), size (HUD)
  // latitude table: in this projection y falls as latitude rises
  const LAT_Y = []; for (let i = 0; i <= 1800; i++) LAT_Y.push(proj(LON0, -90 + i * 0.1)[1]);
  const latOf = y => {
    if (y >= LAT_Y[0]) return -90; if (y <= LAT_Y[1800]) return 90;
    let lo = 0, hi = 1800;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (LAT_Y[m] > y) lo = m; else hi = m; }
    const t = (LAT_Y[lo] - y) / (LAT_Y[lo] - LAT_Y[hi]);
    return -90 + (lo + t) * 0.1;
  };
  // true right edge of the world at a height (the Pacific cut); the left edge is 2000 - edgeX(y)
  const edgeX = y => proj(LON0 + 179.99, latOf(y))[0];
  // what is under a point: a UN country, a grey territory, Antarctica, or sea (null)
  function landAt(x, y) {
    const c = countryAt(x, y); if (c) return { kind: 'country', c };
    for (const p of XLAND) if (x >= p.bbox[0] && x <= p.bbox[2] && y >= p.bbox[1] && y <= p.bbox[3] && pipPolys(x, y, p.polys)) return { kind: 'country', c: p.of };
    for (const t of TERR) if (x >= t.bbox[0] && x <= t.bbox[2] && y >= t.bbox[1] && y <= t.bbox[3] && pipPolys(x, y, t.polys)) return { kind: 'terr', t };
    if (x >= AQ.bbox[0] && x <= AQ.bbox[2] && y >= AQ.bbox[1] && y <= AQ.bbox[3] && pipPolys(x, y, AQ.polys)) return { kind: 'aq' };
    return null;
  }
  // small countries (spec 1.3 v2): polyArea(c) < MAIL.SMALL_AREA; the halo distance is to the nearest vertex (their polygons and extra islands)
  const SMALLS = G.countries.filter(c => polyArea(c) < MAIL.SMALL_AREA);
  const SMALL_V = SMALLS.map(c => {
    const v = []; for (const r of c.polys) for (let i = 0; i < r.length; i += 2) v.push(r[i], r[i + 1]);
    for (const p of XLAND) if (p.of === c) for (const r of p.polys) for (let i = 0; i < r.length; i += 2) v.push(r[i], r[i + 1]);
    return v;
  });
  const cenOf = c => c.c || [c.cx, c.cy];
  const amVertDist = (V, x, y) => { let b = 1e18; for (let i = 0; i < V.length; i += 2) { const d = (V[i] - x) * (V[i] - x) + (V[i + 1] - y) * (V[i + 1] - y); if (d < b) b = d; } return Math.sqrt(b); };
  // where the plane came down (section 1.3 v2); targetId is for stage B
  function resolveLanding(x, y, targetId) {
    const tk = targetId ? SMALLS.indexOf(C[targetId]) : -1;
    if (tk >= 0 && amVertDist(SMALL_V[tk], x, y) <= MAIL.HALO) return { kind: 'country', c: SMALLS[tk] };
    const hit0 = landAt(x, y); if (hit0 && hit0.kind === 'country') return hit0;
    let best = null, bd = MAIL.HALO;
    SMALLS.forEach((c, k) => { const d = amVertDist(SMALL_V[k], x, y); if (d <= bd) { bd = d; best = c; } });
    if (best) return { kind: 'country', c: best };
    return hit0;
  }

  // ---- winds (spec 3.1): sine belts on the absolute latitude; trade winds blow west, westerlies blow east; sea only; no trade wind in the northern Indian Ocean
  function amLonOf(x, y) { // longitude of a map point (bisection on proj at its latitude)
    const lat = latOf(y); let lo = LON0 - 180, hi = LON0 + 180;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (proj(m, lat)[0] < x) lo = m; else hi = m; }
    return ((((lo + hi) / 2 + 180) % 360) + 360) % 360 - 180;
  }
  function amWind(x, y) { // world units per second
    const lat = latOf(y), al = Math.abs(lat);
    if (al > 0 && al < 28) {
      if (lat > 3 && lat < 28) { const lon = amLonOf(x, y); if (lon >= 40 && lon <= 100) return 0; }
      return -MAIL.WIND * Math.sin(Math.PI * al / 28);
    }
    if (al > 35 && al < 60) return MAIL.WIND * Math.sin(Math.PI * (al - 35) / 25);
    return 0;
  }

  // ---- wind ribbons (spec 3.1, 3.1b): long white cut-paper ribbons with a chevron arrowhead at the leading end; they flow with the wind at 30 units/s, stepped at 12 fps, and wrap around the world; a ribbon over land (or in the excepted box, or off the paper) is hidden until it is back over sea. Mail mode only.
  const AM_RIB_BELTS = [[0, 28, -1, 21], [-28, 0, -1, 14], [35, 60, 1, 24], [-60, -35, 1, 24]]; // [lo, hi] of the signed latitude, direction (trade west, westerly east)
  const AM_RIB_SPEED = 30, AM_RIB_CACHE = []; // textures cached for the session (never freed)
  function amRibbonTex(r, idx) {
    if (AM_RIB_CACHE[idx]) return AM_RIB_CACHE[idx];
    const L = r.L, ppu = 3, pad = 12, bw = L + pad * 2, bh = 24;
    const X = (xl) => (xl + bw / 2) * ppu, Y = (yl) => (yl + bh / 2) * ppu;
    const dir = r.dir, head = dir > 0 ? L / 2 : -L / 2, tip = head;
    const bx = tip - dir * 10; // the chevron base, 10 units back from the tip: the body ends exactly there, so head and strip read as one arrow
    const tex = shapeTex(bw * ppu, bh * ppu, b => {
      const body = [], N = 24;
      for (let i = 0; i <= N; i++) { // the body: tail at s = 0, the chevron base at s = 1
        const s = i / N, xc = dir * (-L / 2 + s * (L - 10));
        const yl = 3.5 * Math.sin(Math.PI * s * 1.2) * (dir > 0 ? 1 : -1);
        const hw = 1.0 + 0.9 * Math.min(1, s * 3.5);
        body.push([xc, yl, hw]);
      }
      const upper = body.map(([x, y, h]) => [X(x), Y(y - h)]), lower = body.slice().reverse().map(([x, y, h]) => [X(x), Y(y + h)]);
      b.c.fillStyle = '#f4f1ea';
      B.paper(b, x => { upper.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); lower.forEach(([px, py]) => x.lineTo(px, py)); x.closePath(); }, '#f4f1ea', 0.75);
      // the arrowhead: a chevron wider than the strip, notched behind the tip
      const ch = [[tip, 0], [bx, 8.5], [bx + dir * 4, 0], [bx, -8.5]];
      B.paper(b, x => { ch.forEach(([px, py], i) => i ? x.lineTo(X(px), Y(py)) : x.moveTo(X(px), Y(py))); x.closePath(); }, '#f4f1ea', 0.75);
    }, { noMip: true });
    AM_RIB_CACHE[idx] = tex;
    return tex;
  }
  function amRibbonsMake() {
    const R = rng(20261119), out = [];
    for (const [lo, hi, dir, n] of AM_RIB_BELTS) {
       // the westerly belts are cut up by land more, so they carry more (24, the trades 18); shorter ribbons (80 to 130 units) so several lie over open sea in view at once
      for (let k = 0; k < n; k++) {
        const lat = lo + 3 + (((k * 0.618034 + R() * 0.15) % 1)) * (hi - lo - 6), L = 80 + R() * 50; // latitudes staggered across the belt
        out.push({ dir, lat, L, x0: (k * (2000 / n) + R() * 40) % 2000, y: proj(LON0, lat)[1] });
      }
    }
    return out;
  }
  function amRibbonVisible(r, cx, cy) { // hidden when any part is over land, outside the paper, or in the excepted box
    for (let k = 0; k <= 6; k++) {
      const x = cx + (k / 6 - 0.5) * r.L;
      if (x < 20 || x > 1980) return false;
      if (landAt(x, cy)) return false;
      if (amWind(x, cy) === 0) return false;
    }
    return true;
  }
  function amRibbonsSpawn() {
    if (!AM.ribsData) AM.ribsData = amRibbonsMake();
    AM.ribQ = -1;
    AM.ribs = AM.ribsData.map((r, i) => {
      const tex = amRibbonTex(r, i);
      const s = amSpr(tex, { x: r.x0, y: r.y, w: tex.lw || (r.L + 24), h: 24, z: 0.1, zr: 0, order: 5 });
      return { s, r, i };
    });
  }
  function amRibbonsStep() { // stepped at 12 fps: each ribbon moves with the wind; its visibility follows the sea
    const q = Math.floor(T * 12 + 1e-6);
    if (q === AM.ribQ) return;
    AM.ribQ = q;
    for (const e of AM.ribs) {
      const cx = ((e.r.x0 + e.r.dir * AM_RIB_SPEED * q / 12) % 2000 + 2000) % 2000;
      e.s.x = cx; e.s.alpha = amRibbonVisible(e.r, cx, e.r.y) ? 1 : 0;
    }
  }

  // ---- paper ----
  function amPlaneTex(crumpled) {
    return shapeTex(240, 160, b => {
      B.paper(b, x => { x.moveTo(236, 80); x.lineTo(6, 8); x.lineTo(70, 80); x.lineTo(6, 152); x.closePath(); }, crumpled ? shade(PAP[0], -0.16) : PAP[0], 0.7);
      B.paper(b, x => { x.moveTo(236, 80); x.lineTo(70, 80); x.lineTo(6, 152); x.closePath(); }, shade(PAP[0], crumpled ? -0.26 : -0.07), 0.55);
      if (!crumpled) {
        B.paper(b, x => { x.moveTo(18, 18); x.lineTo(180, 70); x.lineTo(180, 76); x.lineTo(18, 24); x.closePath(); }, PAP[2], 0.6);
        B.paper(b, x => { x.moveTo(18, 136); x.lineTo(180, 88); x.lineTo(180, 94); x.lineTo(18, 142); x.closePath(); }, PAP[9], 0.6);
        B.paper(b, x => { x.moveTo(234, 78); x.lineTo(72, 78); x.lineTo(72, 82); x.lineTo(234, 82); x.closePath(); }, shade(PAP[0], -0.4), 0.4);
      } else {
        for (let i = 0; i < 4; i++) { const pts = []; for (let j = 0; j < 7; j++) pts.push([44 + j * 26, 56 + i * 12 + ((j % 2) ? -14 : 14) + hs(i, 5, j) * 6]); B.paper(b, mkRibbonPath(pts, pts.map(() => 1.6)), shade(PAP[0], -0.42), 0.4); }
      }
    });
  }
  const AM_PLANE_T = amPlaneTex(false), AM_CRUMPLED_T = amPlaneTex(true);
  const AM_RED_T = shapeTex(40, 40, b => B.paper(b, x => x.arc(20, 20, 17, 0, 7), PAP[2], 0.6));
  const AM_DOT_T = shapeTex(40, 40, b => B.paper(b, x => x.arc(20, 20, 17, 0, 7), PAP[1], 0.5));
  const AM_CHEV_T = shapeTex(60, 60, b => B.paper(b, x => { x.moveTo(6, 6); x.lineTo(54, 30); x.lineTo(6, 54); x.lineTo(6, 42); x.lineTo(34, 30); x.lineTo(6, 18); x.closePath(); }, PAP[1], 0.5));
  const AM_STRIP_T = shapeTex(60, 10, b => B.paper(b, x => x.rect(0, 0, 60, 10), CREAM, 0.6));
  const AM_DASH_T = shapeTex(60, 16, b => B.paper(b, x => x.rect(0, 0, 60, 16), PAP[3], 0.5));
  const AM_SCRAP_T = [PAP[9], PAP[8], PAP[11]].map((col, i) => {
    const rs = rng(900 + i), pts = [];
    for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283 + (rs() - 0.5) * 0.5, r = 15 + rs() * 8; pts.push([40 + Math.cos(a) * r, 40 + Math.sin(a) * r]); }
    return shapeTex(80, 80, b => B.paper(b, x => { pts.forEach(([px, py], k) => k ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath(); }, col, 0.5));
  });
  function amEnvTex(L) { // the air mail envelope: cream paper, red and blue chevron edge; the back shows the flap line, a letter's front carries the address
    const k = Math.max(2, devPerHud() * 2.2), W = ENV_W * k, H = ENV_H * k;
    return shapeTex(W, H, b => {
      B.paper(b, wob(4 * k, 4 * k, W - 4 * k, H - 4 * k, 2.2 * k, 91), '#faf6ec', 0.36);
      for (const top of [true, false]) {
        const y0 = top ? 6 * k : H - 18 * k, base = top ? y0 + 12 * k : y0, tip = top ? y0 + 18 * k : y0 - 6 * k;
        B.paper(b, x => x.rect(6 * k, y0, W - 12 * k, 12 * k), PAP[2], 0.5);
        let i = 0;
        for (let x = 6 * k; x + 16 * k <= W - 6 * k; x += 16 * k, i++) {
          if (i % 2) B.paper(b, q => { q.moveTo(x, base); q.lineTo(x + 16 * k, base); q.lineTo(x + 8 * k, tip); q.closePath(); }, PAP[9], 0.5);
        }
      }
      if (L) amEnvAddress(b, k, L);
      else B.paper(b, mkRibbonPath([[14 * k, 24 * k], [W / 2, 66 * k], [W - 14 * k, 24 * k]], [1.5 * k, 1.5 * k, 1.5 * k]), shade('#faf6ec', -0.35), 0.3);
    }, { noMip: true });
  }
  // perforated rectangle: half-round bites along each edge
  const amPerf = (W, H, q) => ctx => {
    const r = 1.5 * q, P = [];
    const edge = (x0, y0, x1, y1) => {
      const L = Math.hypot(x1 - x0, y1 - y0), tx = (x1 - x0) / L, ty = (y1 - y0) / L, nx = -ty, ny = tx, n = Math.max(1, Math.round(L / (8 * q)));
      P.push([x0, y0]);
      for (let i = 1; i < n; i++) {
        const s = L * i / n, cx = x0 + tx * s, cy = y0 + ty * s;
        P.push([cx - tx * r, cy - ty * r]);
        for (let a = 1; a < 8; a++) { const th = Math.PI * a / 8; P.push([cx + (-tx * Math.cos(th) + nx * Math.sin(th)) * r, cy + (-ty * Math.cos(th) + ny * Math.sin(th)) * r]); }
        P.push([cx + tx * r, cy + ty * r]);
      }
    };
    edge(0, 0, W, 0); edge(W, 0, W, H); edge(W, H, 0, H); edge(0, H, 0, 0);
    ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath();
  };
  const AM_STAMP_CACHE = new Map(); // one baked stamp per country and size, kept for the session
  function amStampTex(kind, c, cold) { // 64 x 46 HUD units: 'flag' (full colour, or washed for an unvisited-by-the-child country) or 'sea' (blue, a wave)
    const kq = Math.max(2, devPerHud() * 2), W = 64 * kq, H = 46 * kq; // about 2x the on-screen pixels, no more
    const key = kind + '|' + (c ? c.id : '') + '|' + kq;
    if (!cold && AM_STAMP_CACHE.has(key)) return AM_STAMP_CACHE.get(key);
    const tex = shapeTex(W, H, b => {
      const q = kq;
      B.paper(b, amPerf(W, H, q), kind === 'sea' ? PAP[9] : '#fbf8f1', kind === 'sea' ? 0.42 : 0.3);
      if (kind === 'flag') {
        const f = FL[c.id], fh = Math.min(38, 56 / f.a), fw = fh * f.a, fx = (64 - fw) / 2, fy = (46 - fh) / 2;
        B.paper(b, x => x.rect((fx - 0.5) * q, (fy - 0.5) * q, (fw + 1) * q, (fh + 1) * q), '#8f8676', 0.4);
        f.parts.forEach((p, i) => drawPart(b, p, fh * q, -fx / fh, -fy / fh, Math.min(0.95, 0.45 + i * 0.10), f.a));
      } else {
        const u = v => v * q * 1.39;
        B.paper(b, x => { x.moveTo(u(8), u(29)); x.quadraticCurveTo(u(18), u(18), u(30), u(27)); x.quadraticCurveTo(u(42), u(36), u(56), u(26)); x.quadraticCurveTo(u(42), u(42), u(30), u(38)); x.quadraticCurveTo(u(18), u(30), u(8), u(29)); x.closePath(); }, '#f4f1ea', 0.6);
      }
    }, { noMip: true });
    AM_STAMP_CACHE.set(key, tex);
    return tex;
  }
  function amOutlineTex(c) { // a visited country's border: one thin, flat, slightly uneven pencil line (no dashes, no relief); rings under 3 units on both sides are left out
    const pad = 2, W0 = c.bw + pad * 2, H0 = c.bh + pad * 2, ppu = Math.min(3, Math.sqrt(40000 / (W0 * H0))), lw = Math.max(1, 1.2, 1.5 * MAIL.CAM_H / Math.max(1, innerHeight) * ppu); // 1.5 screen px at the plane frame, whatever the window height
    return shapeTex((c.bw + pad * 2) * ppu, (c.bh + pad * 2) * ppu, b => {
      const seed = sid(c.id);
      for (const [q, st] of [[b.c, '#6f6a60'], [b.g, '#ffffff']]) {
        q.strokeStyle = st; q.lineWidth = lw; q.lineJoin = 'round'; q.lineCap = 'round';
        for (const r of c.polys) {
          let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
          for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]); }
          if (x1 - x0 < 3 && y1 - y0 < 3) continue;
          q.beginPath();
          for (let i = 0; i < r.length; i += 2) {
            const k = i >> 1, jx = (hs(k, seed, 1) - 0.5) * 0.35, jy = (hs(k, seed, 2) - 0.5) * 0.35;
            const X = (r[i] + jx - c.bbox[0] + pad) * ppu, Y = (r[i + 1] + jy - c.bbox[1] + pad) * ppu;
            i ? q.lineTo(X, Y) : q.moveTo(X, Y);
          }
          q.closePath(); q.stroke();
        }
      }
    }, { noMip: true });
  }

  // ---- state ----
  const AM = { on: false, envRight: false, frame: 'plane', state: 'rest', rest: { x: 0, y: 0, rot: 0 }, pc: [0, 0], rot: 0, plane: null, redDot: null, strip: null, aid: [], chev: [], ribs: [], ribsData: null, band: [], pins: [], snapT0: null, snapP: 1, slingN: [1, 0], slingD: [1, 0], jobs: [], boatAway: null, settled: true, rng: rng(Q.has('seed') ? (parseInt(Q.get('seed'), 10) || 1) : Math.floor(Math.random() * 1e9) + 1), star: null, env: null, boat: null, pull: null, fly: null, settle: null, dropT0: 0, sea: null, stamps: [], threads: [], tags: [], outl: new Map(), sprs: new Set(), throws: 0, last: null, wrapped: false, letter: null, viaDone: [], lwrap: false, delivered: false, box: null, card: null, tab: null, pm: null, arrow: null, arrowT: 0, ring: null, hintN: 0, hintCam: false, farRun: 0, prevD: 0, ephDone: {} };
  const amSpr = (tex, o) => { const s = spr(tex, o); AM.sprs.add(s); return s; };
  const amKill = s => { if (!s) return; AM.sprs.delete(s); killTw(s); kill(s); };
  const amAlpha = (s, a) => { if (s) s.alpha = a; };
  const amPlaneLen = () => MAIL.PLANE_LEN * cam.h;
  const AM_EDGE = { t: null }; // the texture of the sea strips beyond the north and south edges, baked once
  function amSetPlane(cx, cy, rot, lift, sx) {
    const s = AM.plane, len = amPlaneLen();
    s.x = cx; s.y = cy; s.rot = rot; s.lift = lift; s.sx = sx; s.w = len; s.h = len * 160 / 240;
    AM.pc = [cx, cy]; AM.rot = rot;
  }

  // ---- entering and leaving ----
  const amBtnOn = () => mode === 'world' && !attract && !picker && !passport && !!currentPlayer();
  function amEnter(letterId) {
    if (AM.on || !currentPlayer()) return;
    sendAllTwinsHome(true);
    clearTags(); clearCompareTag(false);
    timers = timers.filter(t => t.tag !== 'cmpHint');
    const built = prog && Array.isArray(prog.built) ? prog.built : [];
    let start = null;
    for (let i = built.length - 1; i >= 0 && !start; i--) { const cp = CAP[built[i]]; if (cp && C[built[i]]) start = cp; }
    if (!start) start = CAP.FR;
    mode = 'mail'; AM.on = true; AM.frame = 'plane'; AM.state = 'rest'; AM.last = null; AM.wrapped = false; AM.stamps = []; AM.throws = 0;
    AM.rest = { x: start.x, y: start.y, rot: 0 }; AM.pc = [start.x, start.y];
    AM.plane = amSpr(AM_PLANE_T, { z: 0.3, zr: 0.03, order: 150, w: 1, h: 1 });
    AM.redDot = amSpr(AM_RED_T, { z: 0.31, zr: 0, order: 151, w: 2, h: 2 });
    AM.aid = []; for (let i = 0; i < 11; i++) AM.aid.push(amSpr(AM_DOT_T, { z: 0.29, zr: 0, order: 149, alpha: 0 }));
    AM.chev = []; for (let i = 0; i < 3; i++) AM.chev.push(amSpr(AM_CHEV_T, { z: 0.29, zr: 0, order: 149, alpha: 0 }));
    AM.star = amSpr(starTex, { x: start.x, y: start.y, w: 26, h: 26, z: 0.22, zr: 0.02, order: 148 });
    AM.env = amSpr(amEnvTex(), { hud: true, z: 0.1, zr: 0.03, order: 192, w: ENV_W, h: ENV_H, x: AM_ENV[0], y: AM_ENV[1] });
    AM.env.own = true;
    AM.boat = null;
    // beyond the north and south edges of the map the plane's close view showed the map's black board and the table as a band under the HUD:
    // two strips carry the board and the sea on (plane's view only; they fade out for the whole map, where the board is the sheet's frame)
    if (!AM_EDGE.t) AM_EDGE.t = shapeTex(2140, 300, b => { B.paper(b, x => x.rect(-20, -20, 2180, 340), BLACK, 0.0); B.paper(b, x => x.rect(44, -20, 2052, 340), SEA, 0.34); });
    // same z and zr as the map sheet (wbase), so the strips lie level with its sea and board: no step, no shadow line where they meet
    AM.edges = [-164, 1138].map(y => amSpr(AM_EDGE.t, { x: 1000, y, w: 2140, h: 300, z: 0.045, zr: 0.11, order: 1, alpha: 0 }));
    amRibbonsSpawn();
    amSetPlane(start.x, start.y, 0, 0, 1);
    setHint('Pull the plane back and let go');
    layoutHud();
    if (letterId && letterId !== 'free' && ML_BY[letterId]) amStart(letterId); // stage B part 2: a letter by id, the Postcard ("free"), or the letter box
    else if (letterId !== 'free') amBoxOpen();
  }
  function amExit() {
    if (!AM.on) return;
    if (AM.card && AM.card.kind === 'story') stopSpeech();
    for (const s of [...AM.sprs]) amKill(s);
    timers = timers.filter(t => t.tag !== 'mail');
    AM.on = false; AM.envRight = false; AM.frame = 'plane'; AM.state = 'rest'; AM.plane = null; AM.redDot = null; AM.band = []; AM.pins = []; AM.snapT0 = null; AM.jobs = []; AM.boatAway = null; AM.aid = []; AM.chev = []; AM.star = null; AM.env = null; AM.boat = null; AM.edges = [];
    AM.ribs = []; AM.pull = null; AM.fly = null; AM.settle = null; AM.sea = null; AM.stamps = []; AM.threads = []; AM.tags = []; AM.outl = new Map(); AM.sprs = new Set(); AM.last = null;
    AM.letter = null; AM.viaDone = []; AM.lwrap = false; AM.delivered = false; AM.box = null; AM.card = null; AM.tab = null; AM.pm = null; AM.arrow = null; AM.ring = null; AM.hintN = 0; AM.hintCam = false; // a letter in progress is not saved
    mkBtn('mailMap', 'Whole map', PAP[6]); btn.mailMap.alpha = 0;
  }

  // ---- stamps, tags, outlines, thread ----
  const amEnvCentre = () => AM.envRight ? [1000 * asp - 24 - ENV_W / 2, AM_ENV[1]] : AM_ENV;
  const amSlot = i => { const e = amEnvCentre(); return [e[0] - ENV_W / 2 + 55 + i * 66, e[1] + 37]; }; // six slots, 66 apart, in the lower half of the envelope (4 units lower than in stage A: the address needs three lines above)
  function amReflow() { AM.stamps.forEach((st, i) => { const sl = amSlot(i); if (st.s.x !== sl[0] || st.s.y !== sl[1]) tw(st.s, { x: sl[0], y: sl[1] }, 0.2, { cut: true }); }); }
  function amStamp(kind, c, built) {
    const id = c ? c.id : 'sea', sl = amSlot(Math.min(AM.stamps.length, 5));
    const s = amSpr(amStampTex(kind, c), { hud: true, z: 0.12, zr: 0.02, order: 194, w: 64, h: 46, lift: 0.3, x: sl[0], y: sl[1], wash: kind === 'flag' && !built ? 0.6 : 0 });
    s.tilt = (hs(AM.stamps.length + 3, sid(id), 3) - 0.5) * 6 * DEG; // the stamp's texture belongs to AM_STAMP_CACHE (kept for the session), so the sprite must not free it: a freed one came back as a wrong picture on the next stamp of that country
    AM.stamps.push({ s, kind, id, c: kind === 'sea' ? null : c });
    if (AM.stamps.length > 6) { const old = AM.stamps.shift(); tw(old.s, { x: -80 }, 0.25, { cut: true, done: () => amKill(old.s) }); }
    amReflow();
    tw(s, { lift: 0 }, 0.34, { cut: true });
    sfx.snap();
  }
  function amEnvMove(right) { // the envelope and its stamps slide together, stepped at 12 fps
    AM.envRight = right;
    const e = amEnvCentre();
    tw(AM.env, { x: e[0], y: e[1] }, 0.25, { cut: true });
    amReflow();
  }
  function amEnvCheck() { // a resting (or flying) plane whose nose is under the envelope (+20 units) makes the envelope step aside
    const len = amPlaneLen(), hp = w2h(AM.pc[0] + Math.cos(AM.rot) * len * AM_NOSE, AM.pc[1] + Math.sin(AM.rot) * len * AM_NOSE);
    const under = hp[0] > AM_ENV[0] - ENV_W / 2 - 20 && hp[0] < AM_ENV[0] + ENV_W / 2 + 20 && hp[1] > AM_ENV[1] - ENV_H / 2 - 20 && hp[1] < AM_ENV[1] + ENV_H / 2 + 20;
    if (under !== AM.envRight) amEnvMove(under);
  }
  function amTag(c, at) { // the name tag, the way it appears after placing a piece
    for (const n of AM.tags.slice()) amFadeTag(n);
    const namePx = Math.max(72, Math.ceil(TAG_LINE1_HUD * B.size()[1] / 1000 * 1.5));
    const tx = nameTagTex(c, namePx);
    const n = amSpr(tx, { z: 0.215, zr: 0.02, order: 150, x: at[0], y: at[1], w: 1, h: 1, lift: 0.16 });
    n.own = true; n._at = at; n._asp = tx.w / tx.h; n._pxFrac = tx.pxFrac || 1 / 1.65;
    AM.tags.push(n); tw(n, { lift: 0 }, 0.2, { cut: true });
    after(3.0, () => amFadeTag(n), 'mail');
  }
  function amFadeTag(n) {
    const i = AM.tags.indexOf(n); if (i >= 0) AM.tags.splice(i, 1);
    if (!AM.sprs.has(n) || n._dying) return;
    n._dying = true; n.lift = 0.12;
    tw(n, { lift: 0 }, 0.15, { cut: true, done: () => amKill(n) });
  }
  function amOutline(c) {
    if (AM.outl.has(c.id)) return;
    const pad = 2, s = amSpr(amOutlineTex(c), { x: c.cx, y: c.cy, w: c.bw + pad * 2, h: c.bh + pad * 2, z: 0.05, zr: 0, order: 24 }); // at the base map's height: a flat line, no shadow
    s.own = true; AM.outl.set(c.id, s);
  }
  function amThread(trail) { // dark red dashes (6 long, every 12) along the path actually flown; no dash across the cut
    const grp = []; let arc = 0;
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1e-6 || L > 30) continue;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (let k = Math.ceil((arc - 3) / 12); 12 * k + 3 <= arc + L; k++) {
        const t = (12 * k + 3 - arc) / L;
        if (t < 0) continue;
        grp.push(amSpr(AM_DASH_T, { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, w: 6, h: 1.6, rot: ang, z: 0.2, zr: 0.01, order: 30 }));
      }
      arc += L;
    }
    AM.threads.push(grp);
    while (AM.threads.length > 12) for (const s of AM.threads.shift()) amKill(s);
  }

  // ---- landing ----
  // Nothing is baked in the flight. After the plane lands, the border, the name tag and the stamp are baked one per step (jobs), so no frame carries more than one of them.
  const amJob = fn => AM.jobs.push(fn);
  function amRunJobs() {
    const t0 = performance.now(); let n = 0;
    while (AM.jobs.length && (n === 0 || performance.now() - t0 < 8)) { AM.jobs.shift()(); n++; }
  }
  function amCountryLanding(c, x, y, byBoat, repeat) {
    const built = isBuiltId(prog, c.id);
    if (!built) amJob(() => amOutline(c));
    amJob(() => amTag(c, [x, y]));
    speakCountry(c, amWouldDeliver(c.id)); // a delivery says the capital too
    setHint((byBoat ? 'The boat took it to ' : 'You landed in ') + inSent(c));
    if (!repeat) amJob(() => amStamp('flag', c, built));
  }
  function amLand(x, y, d) {
    const fl = AM.fly; AM.fly = null; amHideAim();
    const len = amPlaneLen();
    const pose = { x: x - d[0] * len * AM_NOSE, y: y - d[1] * len * AM_NOSE, rot: Math.atan2(d[1], d[0]) };
    const trail = fl.trail; amJob(() => amThread(trail)); // the thread is the flown part only; a long ride makes many dashes, so it is a job
    const res = resolveLanding(x, y, amTargetId());
    if (!res) { amSeaStart([x, y], fl, pose); return; }
    AM.rest = pose; AM.state = 'drop'; AM.dropT0 = T; sfx.snap();
    if (res.kind === 'country') {
      const c = res.c, repeat = !!AM.last && AM.last.kind === 'country' && AM.last.id === c.id;
      amCountryLanding(c, x, y, false, repeat);
      AM.last = { kind: 'country', id: c.id };
      amArrive(c.id);
    } else if (res.kind === 'aq') {
      speakText('Antarctica'); setHint('You landed in Antarctica'); AM.last = { kind: 'aq', id: 'AQ' };
      amArrive(null);
    } else {
      AM.last = { kind: 'terr', id: res.t.id };
      if (amIsStop(res.t.name)) { amTerrLanding(res.t.name, false); amArrive(res.t.name); } // a territory that is a stop of this letter counts as a visit
      else { setHint('No post office here. Fly on'); amArrive(null); }
    }
  }
  function amSeaEdge(n) { // the nearest screen edge the boat can reach over sea
    const hw = cam.h * asp * 0.5 + 12, hh = cam.h * 0.5 + 12;
    const cands = [[cam.x - hw, n[1]], [cam.x + hw, n[1]], [n[0], cam.y - hh], [n[0], cam.y + hh]].sort((a, b) => Math.hypot(a[0] - n[0], a[1] - n[1]) - Math.hypot(b[0] - n[0], b[1] - n[1]));
    for (const e of cands) {
      const L = Math.hypot(e[0] - n[0], e[1] - n[1]), steps = Math.max(1, Math.ceil(L / 6));
      let ok = true;
      for (let i = 1; i <= steps && ok; i++) { const t = i / steps; if (landAt(n[0] + (e[0] - n[0]) * t, n[1] + (e[1] - n[1]) * t)) ok = false; }
      if (ok) return { E: e, path: true };
    }
    return { E: [n[0] + 22, n[1] - 14], path: false };
  }
  // the port: for every UN country its nearest vertex (its sea distance); the five nearest, minus the one thrown from; one at random (AM.rng)
  function amPickPort(n, fromId) {
    const near = [];
    for (const c of G.countries) {
      if (!c.polys || !c.polys.length) continue;
      let best = 1e18, bx = 0, by = 0;
      for (const r of c.polys) for (let i = 0; i < r.length; i += 2) { const d = Math.hypot(r[i] - n[0], r[i + 1] - n[1]); if (d < best) { best = d; bx = r[i]; by = r[i + 1]; } }
      near.push({ c, d: best, v: [bx, by] });
    }
    near.sort((a, b) => a.d - b.d);
    const five = near.slice(0, 5), pool = five.filter(q => q.c.id !== fromId), list = pool.length ? pool : five;
    const q = list[Math.floor(AM.rng() * list.length)];
    const cc = cenOf(q.c), v = q.v, L = Math.hypot(cc[0] - v[0], cc[1] - v[1]) || 1;
    const inl = [v[0] + (cc[0] - v[0]) / L * 3, v[1] + (cc[1] - v[1]) / L * 3];
    const pt = pipPolys(inl[0], inl[1], q.c.polys) ? inl : v;
    return { c: q.c, x: pt[0], y: pt[1], dx: v[0], dy: v[1] };
  }
  function amRayExit(p, u, cx, cy, hw, hh) { // where a ray from p (direction u) leaves the rectangle centred on (cx, cy), plus a margin
    let t = 1e9;
    if (u[0] > 1e-9) t = Math.min(t, (cx + hw - p[0]) / u[0]); else if (u[0] < -1e-9) t = Math.min(t, (cx - hw - p[0]) / u[0]);
    if (u[1] > 1e-9) t = Math.min(t, (cy + hh - p[1]) / u[1]); else if (u[1] < -1e-9) t = Math.min(t, (cy - hh - p[1]) / u[1]);
    t = Math.max(0, t) + 12;
    return [p[0] + u[0] * t, p[1] + u[1] * t];
  }
  function amSeaStart(n, fl, pose) {
    const scraps = [];
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * 6.283 + hs(k, 31, 1) * 0.8, r = 12 + hs(k, 31, 2) * 10;
      scraps.push({ s: amSpr(AM_SCRAP_T[k % 3], { x: n[0], y: n[1], w: 9, h: 9, z: 0.2, zr: 0.02, order: 60, rot: a }), vx: Math.cos(a) * r, vy: Math.sin(a) * r });
    }
    const edge = amSeaEdge(n), port = amNearPlace(n) || amPickPort(n, fl.from), P = [port.x, port.y], D = [port.dx, port.dy]; // close enough to a tiny place this letter needs: the boat goes there
    const hw = cam.h * asp * 0.5, hh = cam.h * 0.5;
    const vis = Math.abs(P[0] - cam.x) < hw - 40 && Math.abs(P[1] - cam.y) < hh - 60;
    const tP = [P[0] - n[0], P[1] - n[1]], Lp = Math.hypot(tP[0], tP[1]) || 1;
    const E2 = amRayExit(n, [tP[0] / Lp, tP[1] / Lp], cam.x, cam.y, hw, hh);
    const tN = [n[0] - P[0], n[1] - P[1]], Ln = Math.hypot(tN[0], tN[1]) || 1;
    const E3 = amRayExit(P, [tN[0] / Ln, tN[1] / Ln], P[0], P[1], hw, hh);
    const dd = [D[0] - n[0], D[1] - n[1]], Ld = Math.hypot(dd[0], dd[1]) || 1;
    const away = vis ? [D[0] + dd[0] / Ld * 150, D[1] + dd[1] / Ld * 150] : E3;
    AM.sea = { t0: T, n, ang: fl.ang, scraps, E: edge.E, path: edge.path, stamp: !(AM.last && AM.last.kind === 'sea'), prevLast: AM.last, port: { c: port.c, terr: port.terr || null, x: P[0], y: P[1] }, dock: D, vis, E2, E3, away, cam0: null };
    AM.boat = amSpr(boatT, { x: edge.E[0], y: edge.E[1], w: 30, h: 27.5, z: 0.2, zr: 0.03, order: 61 });
    AM.state = 'sea'; AM.last = { kind: 'sea', id: 'sea' }; AM.plane.tex = AM_CRUMPLED_T;
    setHint('Splash! Here comes the boat');
    tone(160, 0.35, 'sine', 0.2, 60); noise(0.35, 700, 0.3);
  }
  // the boat's timeline, stepped at 12 fps. Scraps 0-5; approach 0-6; pick-up 7-8; then to the dock (in view) or out of the view and back in from the edge (off view)
  function amSeaStep() {
    const S0 = AM.sea, f = Math.floor((T - S0.t0) * 12 + 1e-6), N = S0.n, P = S0.port, D = S0.dock;
    const lf = [0, 0.3, 0.45, 0.3, 0.12, 0][Math.min(f, 5)], kk = Math.min(f, 5) / 5;
    if (f < 10) for (const q of S0.scraps) { q.s.x = N[0] + q.vx * kk; q.s.y = N[1] + q.vy * kk; q.s.lift = lf; }
    else if (S0.scraps.length) { for (const q of S0.scraps) amKill(q.s); S0.scraps = []; }
    const lerp2 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    const landF = S0.vis ? 29 : 48, hopF = S0.vis ? 25 : 44;
    let bo;
    if (f <= 6) bo = S0.path ? lerp2(S0.E, N, f / 7) : S0.E;
    else if (f <= 8) bo = N;
    else if (S0.vis) bo = f <= 24 ? lerp2(N, D, Math.min(1, (f - 8) / 16)) : D;
    else if (f <= 18) bo = lerp2(N, S0.E2, Math.min(1, (f - 8) / 10));
    else if (f <= 33) bo = S0.E2;
    else if (f <= 43) bo = lerp2(S0.E3, D, Math.min(1, (f - 33) / 10));
    else bo = D;
    AM.boat.x = bo[0]; AM.boat.y = bo[1];
    if (f >= landF) { amPortLanding(); return; }
    if (f >= hopF && f < hopF + 4) { const u = (f - hopF + 1) / 4, pp = lerp2(D, [P.x, P.y], u); amSetPlane(pp[0], pp[1], S0.ang, 0.25 + 0.5 * Math.sin(Math.PI * u), 1); }
    else if (f < 7) amSetPlane(N[0], N[1], S0.ang, 0, 1);
    else amSetPlane(bo[0], bo[1] - 1.2, 0, 0.25, 1);
  }
  function amPortLanding() { // the plane hops on the port, dry; the boat sails away; the country counts as a normal landing
    const S0 = AM.sea, P = S0.port, c = P.c;
    AM.sea = null; AM.plane.tex = AM_PLANE_T;
    AM.rest = { x: P.x, y: P.y, rot: S0.ang }; AM.state = 'drop'; AM.dropT0 = T; sfx.snap();
    AM.boatAway = { from: [AM.boat.x, AM.boat.y], to: S0.away, t0: T, dur: 0.8 };
    if (S0.stamp) amJob(() => amStamp('sea', null));
    if (P.terr) { AM.last = { kind: 'terr', id: P.terr, byBoat: true }; amTerrLanding(P.terr, true); amArrive(P.terr); return; } // a territory stop reached by boat
    const pl = S0.prevLast, repeat = !!pl && pl.kind === 'country' && pl.id === c.id;
    amCountryLanding(c, P.x, P.y, true, repeat);
    AM.last = { kind: 'country', id: c.id, byBoat: true };
    amArrive(c.id);
  }

  // ---- the sling: two pins either side of the rest position, a red band pin -> tail -> pin, the tail at the pointer ----
  const AM_BAND_T = shapeTex(60, 10, b => B.paper(b, x => x.rect(0, 0, 60, 10), PAP[2], 0.6));
  function amPullGeom() { // the tail sits at the pointer (clamped to the pull limit); the launch direction points away from the pointer
    const P = AM.pull.P, R = [AM.rest.x, AM.rest.y], len = amPlaneLen();
    const vx = P[0] - R[0], vy = P[1] - R[1], Lw = Math.hypot(vx, vy), maxW = MAIL.PULL_FULL * cam.h / 1000;
    const k = Lw > maxW ? maxW / Lw : 1;
    const tip = [R[0] + vx * k, R[1] + vy * k];
    const known = Lw >= 2;
    const d = known ? [-vx / Lw, -vy / Lw] : [1, 0];
    const p = clamp(Math.min(Lw, maxW) * 1000 / cam.h / MAIL.PULL_FULL, 0, 1);
    const c = [tip[0] + d[0] * len * 0.5, tip[1] + d[1] * len * 0.5];
    return { d, known, p, tip, c, rot: Math.atan2(d[1], d[0]), len, Lh: Math.min(Lw, maxW) * 1000 / cam.h };
  }
  function amBandDraw(tip, n, p) { // pins at 0.05 * cam.h either side of the rest position, on the axis n; the band strips thin with the pull (100% -> 45%)
    const R = [AM.rest.x, AM.rest.y], pxW = cam.h / Math.max(1, innerHeight), s = 0.05 * cam.h;
    const pinL = [R[0] + n[0] * s, R[1] + n[1] * s], pinR = [R[0] - n[0] * s, R[1] - n[1] * s];
    const pinW = Math.max(2.2, 4 * pxW);
    AM.pins[0].x = pinL[0]; AM.pins[0].y = pinL[1]; AM.pins[0].w = AM.pins[0].h = pinW;
    AM.pins[1].x = pinR[0]; AM.pins[1].y = pinR[1]; AM.pins[1].w = AM.pins[1].h = pinW;
    const w = 3 * pxW * (1 - 0.55 * clamp(p, 0, 1));
    const seg = (a, b, sp) => { sp.x = (a[0] + b[0]) / 2; sp.y = (a[1] + b[1]) / 2; sp.w = Math.hypot(b[0] - a[0], b[1] - a[1]); sp.h = w; sp.rot = Math.atan2(b[1] - a[1], b[0] - a[0]); };
    seg(pinL, tip, AM.band[0]); seg(tip, pinR, AM.band[1]);
  }
  function amSlingMake() {
    amSlingClear();
    AM.band = [amSpr(AM_BAND_T, { z: 0.29, zr: 0, order: 149 }), amSpr(AM_BAND_T, { z: 0.29, zr: 0, order: 149 })];
    AM.pins = [amSpr(AM_DOT_T, { z: 0.29, zr: 0, order: 149 }), amSpr(AM_DOT_T, { z: 0.29, zr: 0, order: 149 })];
  }
  function amSlingClear() { for (const s of [...AM.band, ...AM.pins]) amKill(s); AM.band = []; AM.pins = []; }
  function amSlingRemove() { // band and pins go with the usual paper lift
    for (const s of [...AM.band, ...AM.pins]) { tw(s, { lift: 0.3 }, 0.1, { cut: true }); after(0.2, () => amKill(s), 'mail'); }
    AM.band = []; AM.pins = [];
  }
  function amHideAim() { for (const s of AM.aid) amAlpha(s, 0); for (const s of AM.chev) amAlpha(s, 0); }
  function amDots(g) { // the help dots: the calm-air path from where the nose WILL be at launch (the rest position); kept through the flight
    const len = g.len, help = playerLevel() === 'help', R = [AM.rest.x, AM.rest.y];
    const N0 = [R[0] + g.d[0] * len * AM_NOSE, R[1] + g.d[1] * len * AM_NOSE];
    const n = help ? Math.floor(MAIL.RANGE * g.p / 14) : 0;
    AM.aid.forEach((s, i) => {
      if (i < n) { const k = i + 1; s.alpha = 1; s.x = N0[0] + g.d[0] * 14 * k; s.y = N0[1] + g.d[1] * 14 * k; s.w = s.h = k === n ? 8 : 4; }
      else s.alpha = 0;
    });
  }
  function amAim(g) { // the help dots and own-level chevrons start where the nose WILL be at launch: the rest position
    const len = g.len, help = playerLevel() === 'help', R = [AM.rest.x, AM.rest.y];
    const N0 = [R[0] + g.d[0] * len * AM_NOSE, R[1] + g.d[1] * len * AM_NOSE];
    amDots(g);
    AM.chev.forEach((s, i) => {
      if (help) { s.alpha = 0; return; }
      s.alpha = 1; const k = 8 + i * 7;
      s.x = N0[0] + g.d[0] * k; s.y = N0[1] + g.d[1] * k; s.w = s.h = 6; s.rot = g.rot;
    });
  }
  function amCancelPull() {
    if (!AM.pull) return;
    AM.pull = null; amHideAim();
    AM.state = 'settle'; AM.settle = { x: AM.pc[0], y: AM.pc[1], rot: AM.rot, t0: T };
  }
  function amThrow(d, p) { // the flight always starts from the rest position
    if (AM.state !== 'rest' && AM.state !== 'pull') return false;
    const len = amPlaneLen(), R = [AM.rest.x, AM.rest.y];
    AM.pull = null; for (const s of AM.chev) amAlpha(s, 0);
    const x0 = R[0] + d[0] * len * AM_NOSE, y0 = R[1] + d[1] * len * AM_NOSE;
    const h0 = landAt(R[0], R[1]);
    AM.fly = { x0, y0, d, p, tf: MAIL.T_MIN + MAIL.T_ADD * p, t: 0, off: [0, 0], trail: [[x0, y0]], wrapped: false, ang: Math.atan2(d[1], d[0]), from: h0 && h0.kind === 'country' ? h0.c.id : null, nose: [x0, y0], ride: 0, rideSign: 1, rideSum: 0, rideLift: 0 };
    AM.riding = false;
    AM.state = 'fly'; AM.throws++; AM.wrapped = false;
    if (AM.arrow && AM.throws >= AM.arrowT) { amKill(AM.arrow); AM.arrow = null; } // the hint arrow stays for one throw
    amDots({ d, p, len, rot: AM.fly.ang });
    if (AM.star) { amKill(AM.star); AM.star = null; }
    AM.snapT0 = AM.band.length ? T : null; AM.snapP = p; // the band snaps
    noise(0.22, 1300, 0.3); // a short paper whoosh
    return true;
  }
  function amRelease(e) {
    const g = amPullGeom(), q = toW(e), R = w2h(AM.rest.x, AM.rest.y);
    const grab = Math.max(MAIL.GRAB_R, 44 * 1000 / Math.max(1, innerHeight));
    if (g.Lh < MAIL.PULL_MIN || Math.hypot(q.hx - R[0], q.hy - R[1]) < grab * 0.5) { amCancelPull(); return; }
    AM.pull = null;
    amThrow(g.d, g.p);
  }
  function amToggleMap() {
    if (AM.frame === 'plane') { AM.frame = 'map'; const k = worldFrame(); camTo(k.x, k.y, k.h, 0.55); mkBtn('mailMap', 'Back to plane', PAP[6]); }
    else { AM.frame = 'plane'; killTw(cam); mkBtn('mailMap', 'Whole map', PAP[6]); }
  }
  function amDown(e, p) {
    if (AM.pull) { amCancelPull(); return; } // a second finger cancels the pull and is ignored
    if (AM.card && AM.card.kind === 'story') { if (T - AM.card.t0 > 0.4) amCardClose(); return; } // the story card: a tap anywhere closes it
    const hPx = hudPx();
    const amBtns = ['mailMap', 'world', 'sound', 'hint'].map(id => ({ id, s: btn[id] })).filter(q => q.s && q.s.alpha > 0.5);
    const bh = pickHit(amBtns, p.hx, p.hy, 8, hPx, q => q.s);
    if (bh) { bh.s.lift = 0.15; tw(bh.s, { lift: 0 }, 0.3); if (bh.id === 'mailMap') { AM.hintCam = false; amToggleMap(); } else if (bh.id === 'hint') amHint(Math.min(2, AM.hintN + 1)); else press(bh.id); return; }
    if (AM.box) { amBoxDown(p); return; } // the letter box takes every other tap
    if (playerBtn.alpha > 0.5 && hitMin(playerBtn, p.hx, p.hy, 8, hPx)) { startWobble(playerBtn); return; }
    const sh = pickHit(AM.stamps, p.hx, p.hy, 4, hPx, st => st.s);
    if (sh) { if (sh.c) speakCountry(sh.c, true); return; }
    if (AM.env && hit(AM.env, p.hx, p.hy, 0)) { if (AM.state === 'rest') { AM.env.lift = 0.15; tw(AM.env, { lift: 0 }, 0.25, { cut: true }); amBoxOpen(); } return; } // the envelope is the button of the letter box
    if (AM.frame === 'map') { if (AM.plane && hit(AM.plane, p.w[0], p.w[1], 14 * cam.h / 330)) amToggleMap(); return; }
    if (AM.state !== 'rest') return; // in the air, at sea or landing: only the HUD answers
    const hp = w2h(AM.pc[0], AM.pc[1]), grab = Math.max(MAIL.GRAB_R, 44 * 1000 / Math.max(1, innerHeight));
    if (Math.hypot(p.hx - hp[0], p.hy - hp[1]) < grab) { AM.pull = { id: e.pointerId, P: p.w.slice() }; AM.state = 'pull'; amSlingMake(); sfx.pick(); }
  }
  function amMove(e) { if (AM.pull && e.pointerId === AM.pull.id) AM.pull.P = toW(e).w.slice(); }
  function amUp(e) {
    if (!AM.pull || e.pointerId !== AM.pull.id) return;
    if (e.type === 'pointercancel') amCancelPull(); else amRelease(e);
  }

  // ---- camera: called once per rendered frame with the real frame time (and once per step in advance) ----
  function amCamera(dt, settled) {
    if (AM.frame !== 'plane' || AM.pull) return; // the camera holds still while the pointer pulls
    const S0 = AM.sea;
    if (S0 && !S0.vis) {
      const f = (T - S0.t0) * 12;
      if (f >= 19 && f < 34) { // off the view: the camera travels to the port in 1.2 s, eased
        if (!S0.cam0) S0.cam0 = [cam.x, cam.y];
        const e = ease(clamp((T - (S0.t0 + 19 / 12)) / 1.2, 0, 1)), cl = clampCamVals(S0.cam0[0] + (S0.port.x - S0.cam0[0]) * e, S0.cam0[1] + (S0.port.y - S0.cam0[1]) * e, MAIL.CAM_H);
        cam.x = cl.x; cam.y = cl.y; cam.h = cl.h; return;
      }
      if ((f >= 9 && f < 19) || (f >= 34 && f < 49)) return; // the boat sails out of the view, and comes back in from the edge
    }
    const pc = AM.pc, cl = clampCamVals(pc[0], pc[1], MAIL.CAM_H);
    const k = 1 - Math.pow(AM.riding || settled ? 0.7 : 0.88, dt * 60); // during a ride the camera keeps up with the plane
    cam.x += (cl.x - cam.x) * k; cam.y += (cl.y - cam.y) * k; cam.h += (cl.h - cam.h) * k;
  }

  // ---- per step (60 steps a second, fixed) ----
  function amUpdate(dt) {
    const F = Math.floor(T * 12 + 1e-6), len = amPlaneLen(), pxW = cam.h / Math.max(1, innerHeight);
    amRunJobs();
    if (AM.boatAway) { // the boat sails away after the hop, stepped
      const B0 = AM.boatAway, u = Math.min(1, Math.floor((T - B0.t0) * 12 + 1e-6) / (B0.dur * 12));
      AM.boat.x = B0.from[0] + (B0.to[0] - B0.from[0]) * u; AM.boat.y = B0.from[1] + (B0.to[1] - B0.from[1]) * u;
      if (u >= 1) { amKill(AM.boat); AM.boat = null; AM.boatAway = null; }
    }
    let cx = AM.rest.x, cy = AM.rest.y, rot = AM.rest.rot, lift = 0, sx = 1, settled = true, seaDone = false;
    if (AM.state === 'sea') { amSeaStep(); seaDone = true; settled = false; }
    else if (AM.state === 'pull') {
      const g = amPullGeom(), jit = g.p >= 0.9 ? 1.5 * pxW : 0; // at 90% power and above the plane trembles, 1.5 px, every frame
      const jx = (hs(frame, 11, 1) - 0.5) * 2 * jit, jy = (hs(frame, 11, 2) - 0.5) * 2 * jit;
      cx = g.c[0] + jx; cy = g.c[1] + jy; rot = g.rot; lift = 0.15; settled = false;
      AM.slingN = g.known ? [-g.d[1], g.d[0]] : [1, 0];
      AM.slingD = g.d;
      amBandDraw([g.tip[0] + jx, g.tip[1] + jy], AM.slingN, g.p);
      amAim(g);
    } else if (AM.state === 'settle') { // cancel: the band relaxes back to the tail, then goes
      const f = Math.floor((T - AM.settle.t0) * 12 + 1e-6), k = Math.min(1, (f + 1) / 4);
      cx = AM.settle.x + (AM.rest.x - AM.settle.x) * k; cy = AM.settle.y + (AM.rest.y - AM.settle.y) * k;
      rot = AM.settle.rot + (AM.rest.rot - AM.settle.rot) * k; lift = [0.12, 0.06, 0.02, 0][Math.min(f, 3)];
      if (AM.band.length && AM.slingN) amBandDraw([cx - Math.cos(rot) * len * 0.5, cy - Math.sin(rot) * len * 0.5], AM.slingN, 0);
      if (f >= 3) { AM.state = 'rest'; lift = 0; amSlingClear(); }
      settled = false;
    } else if (AM.state === 'fly') {
      const fl = AM.fly, R = [AM.rest.x, AM.rest.y];
      if (AM.snapT0 !== null) { // the band snaps: the V flips forward past the pins for two stepped frames, then goes
        const sf = Math.floor((T - AM.snapT0) * 12 + 1e-6);
        if (sf < 2) { const kk = sf === 0 ? 0.12 : 0.04; amBandDraw([R[0] + fl.d[0] * kk * cam.h, R[1] + fl.d[1] * kk * cam.h], [-fl.d[1], fl.d[0]], AM.snapP); }
        else { amSlingClear(); AM.snapT0 = null; }
      }
      // the glide clock u; a tailwind over sea stops it and carries the plane (3.1b), once per throw; a headwind keeps the plain drift (3.1)
      const sc = uu => { const gg = 1 - (1 - uu) * (1 - uu), ss = MAIL.RANGE * fl.p * gg; return [fl.x0 + fl.d[0] * ss + fl.off[0], fl.y0 + fl.d[1] * ss + fl.off[1]]; };
      let u = Math.min(1, fl.t / fl.tf), nx, ny;
      [nx, ny] = sc(u);
      if (fl.ride === 0 && u > 0.1 && u < 1) {
        const wv = amWind(nx, ny);
        if (Math.abs(wv) >= 0.3 * MAIL.WIND && Math.sign(wv) * fl.d[0] > 0.25 && !landAt(nx, ny)) {
          fl.ride = 1; fl.rideSign = Math.sign(wv); fl.rideSum = 0; fl.rideLift = 0.6 * MAIL.LIFT_MAX * Math.max(fl.p, 0.35);
          noise(2.2, 600, 0.12); // a longer soft wind for the ride
        }
      }
      AM.riding = fl.ride === 1;
      if (fl.arr) { // the arrival after a ride over land: a short glide down, at most RIDE_LAND, lift easing out
        const a = fl.arr; a.s += dt; const k = Math.min(1, a.s / a.dur), e = k * k * (3 - 2 * k);
        nx = a.x0 + fl.d[0] * a.D * e; ny = a.y0 + fl.d[1] * a.D * e;
      } else if (fl.ride === 1) {
        const stepD = Math.min(MAIL.RIDE * dt, MAIL.RIDE_MAX - fl.rideSum);
        fl.off[0] += fl.rideSign * stepD; fl.rideSum += stepD;
        [nx, ny] = sc(u);
        if (landAt(nx, ny)) { // the ride ends over land: the remaining glide is cut to at most RIDE_LAND along the heading
          fl.ride = 2; AM.riding = false;
          const endP = sc(1), rem = Math.max(0, (endP[0] - nx) * fl.d[0] + (endP[1] - ny) * fl.d[1]), D0 = Math.min(rem, MAIL.RIDE_LAND);
          let D = D0;
          for (let q = 0.5; q <= D0 + 1e-6; q += 0.5) { if (!landAt(nx + fl.d[0] * q, ny + fl.d[1] * q)) { D = Math.max(0, q - 0.5); break; } } // stop at the last land point before any sea
          fl.arr = { x0: nx, y0: ny, D, s: 0, dur: Math.max(0.3, D / 25), lift: fl.rideLift };
        } else if (fl.rideSum >= MAIL.RIDE_MAX - 1e-6) { fl.ride = 2; AM.riding = false; } // at RIDE_MAX over sea: today's behaviour
      } else {
        fl.t += dt;
        u = Math.min(1, fl.t / fl.tf);
        [nx, ny] = sc(u);
        if (u >= 0.1 && u <= 0.9) { const vx = amWind(nx, ny); if (vx !== 0 && !landAt(nx, ny)) { fl.off[0] += vx * dt; nx += vx * dt; } } // the plain drift (3.1)
      }
      if (!fl.wrapped) { // the Pacific cut: once per throw, the plane re-enters on the far side at the same distance past the edge
        const E = edgeX(ny);
        if (nx > E || nx < 2000 - E) {
          const sh = nx > E ? 2000 - 2 * E : 2 * E - 2000;
          fl.off[0] += sh; nx += sh; fl.wrapped = true; AM.wrapped = true; AM.lwrap = true;
          if (AM.frame === 'plane') cam.x += sh;
          sfx.turn();
        }
      }
      let land = fl.arr ? fl.arr.s >= fl.arr.dur : u >= 1;
      if (ny < 4 || ny > G.H - 4) { ny = clamp(ny, 4, G.H - 4); land = true; }
      fl.nose = [nx, ny]; fl.trail.push([nx, ny]);
      if (fl.arr) { const k = Math.min(1, fl.arr.s / fl.arr.dur); lift = fl.arr.lift * (1 - k * k * (3 - 2 * k)); rot = fl.ang + 2 * DEG; sx = 0.96; } // the arrival: the lift comes down smoothly
      else if (fl.ride === 1) { lift = fl.rideLift; rot = fl.ang + 2 * DEG; sx = 0.96; } // the ride: a steady lift and a steady bank
      else {
        lift = MAIL.LIFT_MAX * Math.max(fl.p, 0.35) * 4 * u * (1 - u);
        const bank = fl.t * 2 * Math.PI / 1.6; // a slow smooth bank: +-3 degrees, the wing span 1 to 0.92
        rot = fl.ang + Math.sin(bank) * 3 * DEG; sx = 0.96 + 0.04 * Math.cos(bank);
      }
      cx = nx - fl.d[0] * len * AM_NOSE; cy = ny - fl.d[1] * len * AM_NOSE;
      settled = false;
      if (land) {
        amLand(nx, ny, fl.d);
        if (AM.state === 'sea') { amSeaStep(); seaDone = true; }
        else { cx = AM.rest.x; cy = AM.rest.y; rot = AM.rest.rot; lift = 0; settled = true; }
      }
    } else if (AM.state === 'drop') {
      const f = Math.floor((T - AM.dropT0) * 12 + 1e-6);
      if (f >= 4) AM.state = 'rest';
      lift = [0.22, 0.14, 0.06, 0][Math.min(f, 3)];
    }
    if (!seaDone) {
      amSetPlane(cx, cy, rot, lift, sx);
      const hudRest = AM.state === 'rest';
      if (AM.star) AM.star.alpha = hudRest ? 1 : 0; // the start star is out of the way while the plane is pulled
      AM.redDot.alpha = hudRest ? 1 : 0;
      if (hudRest) { AM.redDot.x = AM.rest.x + Math.cos(AM.rest.rot) * len * AM_NOSE; AM.redDot.y = AM.rest.y + Math.sin(AM.rest.rot) * len * AM_NOSE; AM.redDot.w = AM.redDot.h = Math.max(4 * pxW, 2.2); }
      if (AM.state !== 'pull' && AM.state !== 'fly') amHideAim();
    }
    AM.settled = settled;
    amRibbonsStep();
    amEnvCheck();
    amPlaceTags(len, pxW);
  }
  function amPlaceTags(len, pxW) {
    for (const n of AM.tags) {
      if (n._dying) continue;
      const th = (TAG_LINE1_HUD / n._pxFrac) * (cam.h / 1000);
      n.h = th; n.w = th * n._asp;
      n.x = n._at[0]; n.y = n._at[1] - (len * 0.7 + th * 0.5);
    }
  }
  function amLayoutHud() { // mail mode: title, token, hint, Sound, World, Whole map; the envelope and its stamps
    const W = 1000 * asp, hasP = !!currentPlayer();
    playerBtn.alpha = hasP ? 1 : 0;
    title.rot = title.tilt; playerBtn.rot = playerBtn.tilt + wobbleRot(playerBtn); if (hintS) hintS.rot = hintS.tilt;
    const hintOn = !!AM.letter && !AM.delivered && !AM.box && !(AM.card && AM.card.kind === 'story'); // the Hint button shows during a letter
    for (const id of ['passport', 'undo', 'zoomOut', 'zoomIn', 'mail'].concat(hintOn ? [] : ['hint'])) btn[id].alpha = 0;
    const mIds = hintOn ? ['mailMap', 'world', 'hint', 'sound'] : ['mailMap', 'world', 'sound'], mRight = hintOn ? ['sound', 'world', 'mailMap', 'hint'] : ['sound', 'world', 'mailMap'];
    for (const id of mIds) btn[id].rot = btn[id].tilt + wobbleRot(btn[id]);
    if (asp < 0.9) {
      title.alpha = 1;
      const pad = 24, maxW = Math.max(120, W - pad * 2), tGap = 10;
      const totW = title.bw + (hasP ? tGap + playerBtn.bw : 0), ts = Math.min(1, maxW / totW);
      title.w = title.bw * ts; title.h = title.bh * ts; title.x = pad + title.w / 2; title.y = 20 + title.h / 2;
      playerBtn.w = playerBtn.bw * ts; playerBtn.h = playerBtn.bh * ts; playerBtn.x = title.x + title.w / 2 + tGap * ts + playerBtn.w / 2; playerBtn.y = title.y;
      const ids = mIds, gap = 10;
      const rawW = ids.reduce((a, id) => a + btn[id].bw, 0) + gap * (ids.length - 1), bs = Math.min(1, maxW / rawW);
      let x = pad, rowY = title.y + title.h / 2 + 10, rowH = 0;
      for (const id of ids) { const s = btn[id]; s.alpha = 1; s.w = s.bw * bs; s.h = s.bh * bs; s.x = x + s.w / 2; s.y = rowY + s.h / 2; x += s.w + gap * bs; rowH = Math.max(rowH, s.h); }
      if (hintS) { const k = Math.min(1, maxW / hintS.bw); hintS.w = hintS.bw * k; hintS.h = hintS.bh * k; hintS.x = pad + hintS.w / 2; hintS.y = rowY + rowH + 10 + hintS.h / 2; }
    } else if (PHONE && !picker) {
      title.alpha = 0;
      const padX = 24, gap = 14;
      playerBtn.w = playerBtn.bw; playerBtn.h = playerBtn.bh;
      const leftEdge = hasP ? padX + playerBtn.w + gap : padX;
      const availBtnW = Math.max(120, W - padX - leftEdge);
      const rawW = mRight.reduce((a, id) => a + btn[id].bw, 0) + gap * Math.max(0, mRight.length - 1);
      const bs = Math.min(1, availBtnW / Math.max(1, rawW));
      const btnH = btn.sound.bh * bs;
      const rowH = Math.max(btnH, hasP ? playerBtn.h : 0);
      const cy = 8 + rowH / 2;
      playerBtn.x = padX + playerBtn.w / 2; playerBtn.y = cy;
      let x = W - padX;
      for (const id of mRight) { const s = btn[id]; s.alpha = 1; s.w = s.bw * bs; s.h = s.bh * bs; s.x = x - s.w / 2; s.y = cy; x -= s.w + gap * bs; }
      const rightEdge = x + gap * bs - gap;
      if (hintS) {
        const availHint = rightEdge - leftEdge;
        if (availHint >= hintS.bw * 0.75) {
          const hs = Math.min(1, availHint / Math.max(1, hintS.bw));
          hintS.w = hintS.bw * hs; hintS.h = hintS.bh * hs;
          hintS.x = leftEdge + hintS.w / 2; hintS.y = cy;
        } else {
          const hs = Math.min(1, Math.max(120, W - padX * 2) / Math.max(1, hintS.bw));
          hintS.w = hintS.bw * hs; hintS.h = hintS.bh * hs;
          hintS.x = padX + hintS.w / 2; hintS.y = 8 + rowH + 8 + hintS.h / 2;
        }
      }
    } else {
      title.alpha = 1;
      title.w = title.bw; title.h = title.bh; title.x = 34 + title.w / 2; title.y = 26 + title.h / 2;
      playerBtn.w = playerBtn.bw; playerBtn.h = playerBtn.bh; playerBtn.x = title.x + title.w / 2 + 14 + playerBtn.w / 2; playerBtn.y = title.y;
      if (hintS) { hintS.w = hintS.bw; hintS.h = hintS.bh; hintS.x = 34 + hintS.w / 2; hintS.y = title.y + title.h / 2 + 8 + hintS.h / 2; }
      let x = W - 30;
      for (const id of mRight) { const s = btn[id]; s.alpha = 1; s.w = s.bw; s.h = s.bh; s.x = x - s.w / 2; s.y = 30 + s.h / 2; x -= s.w + 14; }
    }
    for (const q of AM.edges || []) q.alpha = clamp((620 - cam.h) / 160, 0, 1); // the sea strips beyond the north and south edges: the plane's view only
    if (AM.env) AM.env.rot = -1.2 * DEG; // position is tweened by amEnvMove
    for (const st of AM.stamps) st.s.rot = st.s.tilt;
    amLetterHud();
  }
  function amApi_state() {
    const at = AM.state === 'rest' ? [AM.rest.x, AM.rest.y] : AM.pc;
    return { on: AM.on, x: +at[0].toFixed(2), y: +at[1].toFixed(2), flying: !!AM.fly, frame: AM.frame, state: AM.state, stamps: AM.stamps.map(s => s.kind === 'sea' ? 'sea' : s.id), last: AM.last ? { kind: AM.last.kind, id: AM.last.id, byBoat: !!AM.last.byBoat } : null, throws: AM.throws, pull: !!AM.pull, hint: hintTxt, ribs: AM.ribs.length, ribsShown: AM.ribs.filter(e => e.s.alpha > 0.5 && Math.abs(e.s.x - cam.x) < cam.h * asp / 2 + e.r.L / 2 && Math.abs(e.r.y - cam.y) < cam.h / 2).length, riding: !!AM.riding, ride: AM.fly ? AM.fly.ride : null,
      letter: AM.letter ? AM.letter.id : (AM.on ? 'free' : null), viaDone: AM.viaDone.slice(), wrapped: AM.letter ? AM.lwrap : AM.wrapped, throwWrapped: AM.wrapped, aroundOk: amAroundOk(), delivered: AM.delivered, done: Object.keys(amRec()), rec: JSON.parse(JSON.stringify(amRec())), levels: [1, 2, 3, 4].map(amLevelOpen), hintN: AM.hintN, farRun: AM.farRun, hintTarget: AM.letter && !AM.delivered ? amHintTarget().id : null, ringAt: AM.ring ? [+AM.ring.x.toFixed(1), +AM.ring.y.toFixed(1), +AM.ring.w.toFixed(1)] : null, arrowDeg: AM.arrow && AM.arrow.alpha > 0.5 ? +(AM.arrow.rot * 180 / Math.PI).toFixed(1) : null, arrow: !!AM.arrow, ring: !!AM.ring, card: AM.card ? { kind: AM.card.kind, x: AM.card.s.x, y: AM.card.s.y, w: AM.card.s.w, h: AM.card.s.h, fit: AM.card.fit || null } : null, env: AM.env ? { x: AM.env.x, y: AM.env.y, w: AM.env.w, h: AM.env.h } : null,
      box: AM.box ? { rect: AM.box.rect, scale: AM.box.s, pending: AM.box.items.filter(it => !it.s).length, items: AM.box.items.map(it => ({ kind: it.kind, id: it.kind === 'letter' ? it.L.id : it.kind === 'journey' ? it.J.id : 'free', open: it.open, x: it.x, y: it.y, w: it.w, h: it.h })) } : null };
  }
  const amApi = {
    state: amApi_state,
    place: (x, y) => { if (!AM.on || AM.state !== 'rest') return false; AM.rest.x = x; AM.rest.y = y; return true; },
    throw: (deg, p) => { if (!AM.on) return false; const r = deg * Math.PI / 180; return amThrow([Math.cos(r), Math.sin(r)], clamp(p, 0, 1)); },
    seed: n => { AM.rng = rng(n | 0); return true; },
    start: id => amStart(id), // a letter or chapter id, or 'free' for the Postcard
    box: open => { if (!AM.on) return false; if (open === false) amBoxClose(true); else amBoxOpen(); return !!AM.box; },
    story: id => { const J = MJ[id] || (ML_BY[id] && MJ[ML_BY[id].journey]); if (!AM.on || !J) return false; amStoryOpen(J, null); return true; },
    closeCard: () => { amCardClose(); return true; },
    hint: n => { amHint(n || Math.min(2, AM.hintN + 1)); return AM.hintN; },
    letters: () => ML.map(l => ({ id: l.id, level: l.level, journey: l.journey || null, chapter: l.chapter || null, from: l.from, to: l.to, via: l.via.slice(), around: !!l.around, express: l.express })),
    near: (x, y) => { const q = amNearPlace([x, y]); return q ? { id: q.c ? q.c.id : q.terr, x: +q.x.toFixed(2), y: +q.y.toFixed(2) } : null; },
    wind: (x, y) => amWind(x, y),
    landAt: (x, y) => { const h = landAt(x, y); return h ? (h.kind === 'country' ? h.c.id : h.kind) : 'sea'; },
    resolve: (x, y, t) => { const r = resolveLanding(x, y, t || null); return r ? (r.kind === 'country' ? r.c.id : r.kind) : 'sea'; },
    stampCost: ids => (ids || G.countries.map(c => c.id)).map(id => { const c = G.countries.find(q => q.id === id); if (!c || !FL[id]) return [id, -1]; const t0 = performance.now(); amStampTex('flag', c, true); return [id, +(performance.now() - t0).toFixed(1)]; }) // cold build time per country, for the landing-job report
  };
  // ---- letters and famous journeys (stage B part 2, audit/SPEC_airmail_B2.md) ----
  // Data: atlas/data/mail.js. A via stop is a country id or a territory written as in GEO.terr[].n. A letter can never be failed.
  const ML = Array.isArray(window.MAIL_LETTERS) ? window.MAIL_LETTERS : [], ML_BY = {}, MJ = {}, MJ_LIST = [];
  const amIsCountry = id => !!C[id] && id !== 'AQ';
  for (const L of ML) { // every id is checked on load: countries in GEO and CAPITALS, territory names in GEO.terr
    ML_BY[L.id] = L; if (!Array.isArray(L.via)) L.via = [];
    for (const id of [L.from, L.to]) if (!amIsCountry(id) || !CAP[id]) console.error('mail.js: letter ' + L.id + ': "' + id + '" is not a country in GEO and CAPITALS');
    for (const id of L.via) if (!(amIsCountry(id) && CAP[id]) && !(G.terr || []).some(t => t.n === id)) console.error('mail.js: letter ' + L.id + ': stop "' + id + '" is not a country in GEO and CAPITALS and not a territory in GEO.terr');
    if (L.journey) { let J = MJ[L.journey]; if (!J) { J = MJ[L.journey] = { id: L.journey, level: L.level, title: L.title || L.journey, ch: [] }; MJ_LIST.push(J); } J.ch.push(L); }
  }
  for (const J of MJ_LIST) { J.ch.sort((a, b) => a.chapter - b.chapter); J.last = J.ch[J.ch.length - 1]; J.story = J.last.story || ''; J.treasure = J.last.treasure || ''; }
  const AM_PIC = { J1: 'plane', J2: 'goggles', J3: 'bell', J5: 'comb', J6: 'silk', J7: 'pepper', J8: 'giraffe', J9: 'coin', J10: 'compass', J11: 'watch', J12: 'finch' }; // the treasure picture of each journey
  const amRec = () => { const p = currentPlayer(); if (!p) return AM.ephDone; if (!p.mail || typeof p.mail !== 'object' || !p.mail.done) p.mail = { done: {} }; return p.mail.done; }; // this player's delivered letters
  const amJourneyDone = (J, d = amRec()) => J.ch.every(l => d[l.id]);
  // level 2 opens after 3 letters of level 1, level 3 after 3 of level 2, level 4 after 2 complete journeys of level 3
  const amLevelOpen = lv => { const d = amRec(); return lv <= 1 ? true : lv === 2 ? ML.filter(l => l.level === 1 && d[l.id]).length >= 3 : lv === 3 ? ML.filter(l => l.level === 2 && d[l.id]).length >= 3 : MJ_LIST.filter(J => J.level === 3 && amJourneyDone(J, d)).length >= 2; };
  // "around": the edge of the world was crossed in this letter, or (a journey) in any delivered chapter of it
  const amAroundOk = () => { const L = AM.letter; if (!L || !L.around || AM.lwrap) return true; const J = L.journey && MJ[L.journey], d = amRec(); return !!J && J.ch.some(l => d[l.id] && d[l.id].wrapped); };
  const amTerrName = n => { const m = /^(.*) Is\.$/.exec(n); return m ? 'the ' + m[1] + ' Islands' : n; }; // the envelope names a territory: "Faeroe Is." reads "the Faeroe Islands"
  const amStopName = id => amIsCountry(id) ? inSent(C[id]) : amTerrName(id);
  const amTargetId = () => AM.letter && !AM.delivered ? AM.letter.to : null;
  const amIsStop = n => !!AM.letter && !AM.delivered && AM.letter.via.includes(n);
  const amMissing = () => AM.letter ? AM.letter.via.filter(v => !AM.viaDone.includes(v)) : [];
  function amHintTarget() { // what the hints point at: the nearest still-missing stop (from the resting plane), the destination once every stop is visited
    const L = AM.letter, px = AM.rest.x, py = AM.rest.y; let best = null;
    for (const id of amMissing()) {
      const pl = amPlaceOf(id);
      for (const part of pl.c ? pl.parts.slice(0, 1) : pl.parts) {
        const d = Math.hypot(part.cen[0] - px, part.cen[1] - py); if (best && d >= best.d) continue;
        let size; if (pl.c) size = Math.max(pl.c.bw, pl.c.bh); else { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < part.V.length; i += 2) { x0 = Math.min(x0, part.V[i]); x1 = Math.max(x1, part.V[i]); y0 = Math.min(y0, part.V[i + 1]); y1 = Math.max(y1, part.V[i + 1]); } size = Math.max(x1 - x0, y1 - y0); }
        best = { id, x: part.cen[0], y: part.cen[1], d, size };
      }
    }
    if (!best) { const c = C[L.to], cc = cenOf(c); best = { id: L.to, x: cc[0], y: cc[1], d: Math.hypot(cc[0] - px, cc[1] - py), size: Math.max(c.bw, c.bh) }; }
    return best;
  }
  const amWouldDeliver = id => { const L = AM.letter; return !!L && !AM.delivered && id === L.to && amMissing().length === 0 && amAroundOk(); };
  const amLetterHint = () => { const L = AM.letter; return !L ? 'Pull the plane back and let go' : AM.delivered ? 'Delivered to ' + inSent(C[L.to]) : !amAroundOk() ? 'Go all the way around the world' : 'Take this letter to ' + inSent(C[L.to]); };
  const AM_PLACES = {};
  function amPlaceOf(id) { // a country (with its extra islands) or a named territory: its vertices, part by part
    if (AM_PLACES[id]) return AM_PLACES[id];
    const parts = [], flat = polys => { const v = []; for (const r of polys) for (let i = 0; i < r.length; i += 2) v.push(r[i], r[i + 1]); return v; };
    if (amIsCountry(id)) { const c = C[id]; parts.push({ V: flat(c.polys), cen: cenOf(c), polys: c.polys }); for (const p of XLAND) if (p.of === c) parts.push({ V: flat(p.polys), cen: p.c, polys: p.polys }); return (AM_PLACES[id] = { id, c, parts }); }
    for (const t of TERR) if (t.name === id) parts.push({ V: flat(t.polys), cen: t.c, polys: t.polys });
    return (AM_PLACES[id] = { id, c: null, parts });
  }
  // Close enough for tiny places (B2 rule 2): a sea landing within MAIL.NEAR of any vertex of a still-needed stop or destination that is a
  // territory or a small country reaches it. The boat docks 3 units inland of that vertex (as amPickPort does).
  function amNearPlace(n) {
    const L = AM.letter; if (!L || AM.delivered) return null;
    const ids = amMissing(); if (!ids.includes(L.to)) ids.push(L.to);
    let best = null, bd = MAIL.NEAR;
    for (const id of ids) {
      const pl = amPlaceOf(id); if (pl.c && polyArea(pl.c) >= MAIL.SMALL_AREA) continue; // not for big countries
      for (const part of pl.parts) for (let i = 0; i < part.V.length; i += 2) { const d = Math.hypot(part.V[i] - n[0], part.V[i + 1] - n[1]); if (d <= bd) { bd = d; best = { pl, part, v: [part.V[i], part.V[i + 1]] }; } }
    }
    if (!best) return null;
    const cc = best.part.cen, v = best.v, Lc = Math.hypot(cc[0] - v[0], cc[1] - v[1]) || 1, inl = [v[0] + (cc[0] - v[0]) / Lc * 3, v[1] + (cc[1] - v[1]) / Lc * 3], pt = pipPolys(inl[0], inl[1], best.part.polys) ? inl : v;
    return { c: best.pl.c, terr: best.pl.c ? null : best.pl.id, x: pt[0], y: pt[1], dx: v[0], dy: v[1], dist: bd };
  }
  function amTerrLanding(name, byBoat) { // a territory that is a stop: the map stays plain paper, the hint line and the voice name it as the envelope does
    const nm = amTerrName(name);
    setHint((byBoat ? 'The boat took it to ' : 'You landed in ') + nm); speakText(nm.replace(/^the /, 'The '));
  }
  function amArrive(key) { // after every landing (key: a country id, a territory name that is a stop, or null); stops in any order
    const L = AM.letter; if (!L || AM.delivered) return;
    if (key && L.via.includes(key) && !AM.viaDone.includes(key)) { AM.viaDone.push(key); amJob(() => amEnvRefresh(true)); } // a pencil tick on the envelope
    if (key && key === L.to) {
      const miss = amMissing();
      if (miss.length) setHint('Still to visit: ' + miss.map(amStopName).join(', '));
      else if (!amAroundOk()) setHint('Go all the way around the world');
      else { amDeliver(); return; }
    }
    // old 3.3: on "With help" the first hint comes by itself after 4 landings in a row that each ended farther from the target, the second after 8 (not for an around letter)
    // the target is the hints' target (amHintTarget); when it changes (a stop visited, another stop is nearer now) the count starts again
    const tg = amHintTarget(), d = tg.d;
    if (tg.id !== AM.tgtId) { AM.tgtId = tg.id; AM.farRun = 0; } else AM.farRun = d > AM.prevD + 1e-6 ? AM.farRun + 1 : 0;
    AM.prevD = d;
    if (L.around || playerLevel() !== 'help') return;
    if (AM.farRun === 4 && AM.hintN < 1) amHint(1); else if (AM.farRun === 8 && AM.hintN < 2) amHint(2);
  }
  function amDeliver() { // the landing's stamp is already on its way; then the postmark, the wake, the voice (in amCountryLanding), the letter box
    const L = AM.letter, c = C[L.to], d = amRec(), n = Math.max(1, AM.throws), old = d[L.id];
    AM.delivered = true;
    const best = old ? Math.min(old.throws, n) : n; // a replay keeps the better result
    d[L.id] = { throws: best, express: best <= L.express, wrapped: !!(old && old.wrapped) || AM.lwrap };
    save();
    for (const k of ['arrow', 'ring']) if (AM[k]) { amKill(AM[k]); AM[k] = null; }
    amJob(amPostmark);
    const s = csp[c.id]; if (s && isBuiltId(prog, c.id)) wake(s, 0.15);
    sfx.wake();
    setHint('Delivered to ' + inSent(c));
    const next = () => { // 2.5 s later the story card (last chapter), the "Part n of N" card (a middle chapter) or the letter box; if the child has thrown again meanwhile, it waits for the plane to land
      if (!AM.on || AM.letter !== L || AM.box) return;
      if (AM.state !== 'rest') { after(0.4, next, 'mail'); return; }
      const J = L.journey && MJ[L.journey];
      if (J && J.last === L) amStoryOpen(J, () => amBoxOpen(L.id)); else if (J) amPartCard(J, L); else amBoxOpen(L.id); // a middle chapter goes straight on to the next one
    };
    after(2.5, next, 'mail');
  }
  const PM_W = 156, PM_H = 100;
  function amDeliveredTex(sc) { // the envelope's postmark: a round cut-paper ring with a wide strip across it, the word large enough to read in an 800 x 560 window
    const t = shapeTex(Math.round(PM_W * sc), Math.round(PM_H * sc), b => {
      const k = b.w / PM_W, cx = PM_W / 2 * k, cy = PM_H / 2 * k, ro = 46 * k, ri = 36.5 * k, n = 44, col = shade(PAP[3], -0.12);
      B.paper(b, q => {
        for (let i = 0; i < n; i++) { const a = i / n * 6.2832, r = ro * (0.975 + hs(i, 77, 1) * 0.035), X = cx + Math.cos(a) * r, Y = cy + Math.sin(a) * r; i ? q.lineTo(X, Y) : q.moveTo(X, Y); }
        q.closePath();
        for (let i = n - 1; i >= 0; i--) { const a = i / n * 6.2832, r = ri * (0.98 + hs(i, 77, 2) * 0.03), X = cx + Math.cos(a) * r, Y = cy + Math.sin(a) * r; i === n - 1 ? q.moveTo(X, Y) : q.lineTo(X, Y); }
        q.closePath();
      }, PAP[3], 0.72);
      B.paper(b, starPath(cx, cy - 26.5 * k, 7 * k, 3 * k), PAP[5], 0.78); B.paper(b, starPath(cx, cy + 26.5 * k, 7 * k, 3 * k), PAP[5], 0.78);
      B.paper(b, wob(cx - 75 * k, cy - 17.5 * k, cx + 75 * k, cy + 17.5 * k, 2.5 * k, 82), CREAM, 0.78);
      let f = 27 * k; b.c.save(); b.c.font = `800 ${f}px ${FONT}`; const w = b.c.measureText('Delivered').width; b.c.restore(); if (w > 138 * k) f *= 138 * k / w;
      for (const [q, st] of [[b.c, col], [b.g, B.grey(0.82)]]) { q.save(); q.font = `800 ${f}px ${FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillStyle = st; q.fillText('Delivered', cx, cy + 0.5 * k); q.restore(); }
    }, { noMip: true });
    t.lw = PM_W; t.lh = PM_H; return t;
  }
  function amPostmark() {
    if (!AM.env || AM.pm) return;
    AM.pm = amSpr(amDeliveredTex(devPerHud()), { hud: true, z: 0.13, zr: 0.02, order: 195, w: PM_W, h: PM_H, rot: -0.2, lift: 0.4 }); AM.pm.own = true;
    amLetterHud(); tw(AM.pm, { lift: 0 }, 0.25, { cut: true }); sfx.thump();
  }
  // ---- hints (old 3.3): 1 = the whole map for 2.5 s and a paper arrow beside the plane for the next throw; 2 = also a ring on the destination until delivery
  const AM_ARROW_T = shapeTex(200, 84, b => B.paper(b, x => { x.moveTo(6, 30); x.lineTo(120, 30); x.lineTo(120, 6); x.lineTo(194, 42); x.lineTo(120, 78); x.lineTo(120, 54); x.lineTo(6, 54); x.closePath(); }, PAP[4], 0.6));
  const amRingTex = () => shapeTex(512, 512, b => { // spotTex's pencil ring, drawn large enough for a big country
    for (const [q, st] of [[b.c, 'rgba(54,56,68,0.72)'], [b.g, 'rgba(128,128,128,0.5)']]) {
      q.strokeStyle = st; q.lineWidth = 7; q.lineCap = 'round';
      q.beginPath(); q.arc(256, 256, 238, 0.1, 6.38); q.stroke();
      q.lineWidth = 3.5; q.globalAlpha = 0.42; q.beginPath(); q.arc(259, 253, 241, 0.5, 6.75); q.stroke(); q.globalAlpha = 1;
    }
  });
  function amHint(n) {
    const L = AM.letter; if (!L || AM.delivered || AM.box || (AM.card && AM.card.kind === 'story')) return;
    AM.hintN = Math.max(AM.hintN, n);
    if (!AM.arrow) AM.arrow = amSpr(AM_ARROW_T, { z: 0.29, zr: 0.02, order: 149, alpha: 0, w: 1, h: 1 });
    AM.arrowT = AM.throws + 1;
    if (AM.hintN >= 2 && !AM.ring) {
      AM.ring = amSpr(amRingTex(), { x: 0, y: 0, w: 1, h: 1, z: 0.19, zr: 0, order: 26 }); AM.ring.own = true; AM.ring.tid = null; // amLetterHud puts it on the hints' target
    }
    if (AM.frame === 'plane') { amToggleMap(); AM.hintCam = true; after(2.5, () => { if (AM.hintCam && AM.frame === 'map') amToggleMap(); AM.hintCam = false; }, 'mail'); }
    sfx.pick();
  }
  // ---- ink and small paper parts shared by the envelope, the letter box and the cards ----
  const amInk = (b, str, x, y, px, o = {}) => { // printed ink: colour only, flat on the paper under it; shrinks to maxW
    const q = b.c; q.save(); let f = px; q.font = `800 ${f}px ${FONT}`; const w = q.measureText(str).width;
    if (o.maxW && w > o.maxW) { f = px * o.maxW / w; q.font = `800 ${f}px ${FONT}`; }
    q.textAlign = o.align || 'left'; q.textBaseline = 'middle'; q.fillStyle = o.col || INK; q.fillText(str, x, y); q.restore(); return f;
  };
  const amTick = (b, x, y, s) => { const q = b.c; q.save(); q.strokeStyle = '#4a4d5e'; q.lineWidth = Math.max(1.5, s * 0.17); q.lineCap = 'round'; q.lineJoin = 'round'; q.beginPath(); q.moveTo(x, y); q.lineTo(x + s * 0.38, y + s * 0.42); q.lineTo(x + s * 1.1, y - s * 0.6); q.stroke(); q.restore(); }; // a pencil tick
  const amFlagDraw = (b, id, x, y, fh) => { const f = FL[id]; B.paper(b, q => q.rect(x - 0.5, y - 0.5, fh * f.a + 1, fh + 1), '#8f8676', 0.4); f.parts.forEach((p, i) => drawPart(b, p, fh, -x / fh, -y / fh, Math.min(0.95, 0.45 + i * 0.10), f.a)); }; // a flag, fh pixels high, top left at (x, y)
  function amWrap(q, text, maxW) { const words = String(text).split(/\s+/).filter(Boolean), lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cur && q.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
  function amSentences(t) { // for the voice: one sentence at a time ("St. Louis" is not an end)
    const out = []; let st = 0; t = String(t);
    for (let i = 0; i < t.length; i++) {
      if (!'.!?'.includes(t[i])) continue;
      let j = i + 1; if (t[j] === '"') j++;
      if (j < t.length && t[j] !== ' ') continue;
      if (t[i] === '.' && /\bSt$/.test(t.slice(st, i))) continue;
      out.push(t.slice(st, j).trim()); st = j; i = j - 1;
    }
    if (t.slice(st).trim()) out.push(t.slice(st).trim());
    return out;
  }
  function amTally(b, x, y, n, k, maxW, hh) { // pencil tally marks: four strokes and a slash, at most 30
    const q = b.c; n = Math.min(n, 30);
    const groups = Math.ceil(n / 5), w0 = (groups * 4 * 4.6 + (groups - 1) * 7) * k, f = Math.min(1, maxW / Math.max(1, w0)), u = 4.6 * k * f, gp = 4 * u + 7 * k * f;
    q.save(); q.strokeStyle = 'rgba(66,68,82,0.85)'; q.lineWidth = Math.max(1.2, 1.5 * k); q.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const g = Math.floor(i / 5), j = i % 5, gx = x + g * gp; q.beginPath();
      if (j < 4) { const sx = gx + (j + 0.5) * u, lean = (hs(i, 9, 1) - 0.5) * 1.6 * k; q.moveTo(sx + lean, y - hh); q.lineTo(sx - lean, y + hh); }
      else { q.moveTo(gx - 0.5 * u, y + hh * 0.55); q.lineTo(gx + 4.5 * u, y - hh * 0.55); }
      q.stroke();
    }
    q.restore();
  }
  function amPostmarkDraw(b, cx, cy, r, seed) { // a small round postmark: a cut-paper ring with a star
    B.paper(b, q => {
      const n = 28;
      for (let i = 0; i < n; i++) { const a = i / n * 6.2832, rr = r * (0.97 + hs(i, seed, 1) * 0.06), X = cx + Math.cos(a) * rr, Y = cy + Math.sin(a) * rr; i ? q.lineTo(X, Y) : q.moveTo(X, Y); }
      q.closePath();
      for (let i = n - 1; i >= 0; i--) { const a = i / n * 6.2832, rr = r * 0.74, X = cx + Math.cos(a) * rr, Y = cy + Math.sin(a) * rr; i === n - 1 ? q.moveTo(X, Y) : q.lineTo(X, Y); }
      q.closePath();
    }, PAP[3], 0.72);
    B.paper(b, starPath(cx, cy, r * 0.44, r * 0.19), PAP[3], 0.72);
  }
  function amTreasure(b, kind, cx, cy, size) { // the treasures: plain cut-paper pictures in a 100 x 100 box (placeholders: "a plain shape is fine for now")
    const s = size / 100;
    const P = (pts, col, rel) => B.paper(b, x => { pts.forEach(([px, py], i) => { const X = cx + px * s, Y = cy + py * s; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.closePath(); }, col, rel);
    const O = (px, py, r, col, rel, ry) => B.paper(b, x => x.ellipse(cx + px * s, cy + py * s, r * s, (ry || r) * s, 0, 0, 6.2832), col, rel);
    const R = (x0, y0, x1, y1, col, rel) => P([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], col, rel);
    if (kind === 'plane') { // a silver high-wing plane seen from above, nose to the right
      R(-3.5, -47.5, 16.5, 47.5, '#565c67', 0.5); P([[-47.5, -18.5], [-34.6, -18.5], [-32.5, 18.5], [-47.5, 18.5]], '#565c67', 0.5); // a thin dark paper outline under the silver, so it stands out on its pale tile
      P([[-45.7, -3.6], [-40.5, -7.5], [20.2, -9.5], [34.8, -6.3], [39.6, 0], [34.8, 6.3], [20.2, 9.5], [-40.5, 7.5], [-45.7, 3.6]], '#565c67', 0.5);
      R(-2, -46, 15, 46, '#9da5b0', 0.62); P([[-46, -17], [-36, -17], [-34, 17], [-46, 17]], '#9da5b0', 0.62);
      P([[-44, -3], [-40, -6], [20, -8], [34, -5], [38, 0], [34, 5], [20, 8], [-40, 6], [-44, 3]], '#c5cbd3', 0.78);
      R(10, -5, 20, 5, '#7f8791', 0.86); O(38, 0, 5.5, '#55585f', 0.88); R(42, -15, 45, 15, '#3a3a40', 0.92);
    } else if (kind === 'goggles') {
      R(-48, -6, 48, 6, '#6b4a2f', 0.5); O(-20, 0, 23, '#8a5a34', 0.66); O(20, 0, 23, '#8a5a34', 0.66);
      O(-20, 0, 16, '#8fc4e6', 0.82); O(20, 0, 16, '#8fc4e6', 0.82);
      P([[-28, -8], [-20, -11], [-26, -2]], '#eef7fc', 0.9); P([[12, -8], [20, -11], [14, -2]], '#eef7fc', 0.9);
    } else if (kind === 'bell') {
      O(0, -38, 8, '#b98a1e', 0.5); O(0, 40, 7, '#5a4a2a', 0.5);
      P([[-10, -32], [10, -32], [20, -18], [26, 14], [38, 30], [-38, 30], [-26, 14], [-20, -18]], PAP[5], 0.7);
      R(-41, 27, 41, 35, '#d9a92a', 0.82);
    } else if (kind === 'comb') {
      for (let i = 0; i < 12; i++) { const x = -41 + i * 7; P([[x, -4], [x + 4.4, -4], [x + 3.2, 36], [x + 1.2, 36]], '#eadfc2', 0.55); }
      P([[-46, -8], [-38, -24], [38, -24], [46, -8], [46, 0], [-46, 0]], '#d5c296', 0.76);
      for (const x of [-26, 0, 26]) O(x, -12, 2.6, '#7a6a4a', 0.88);
    } else if (kind === 'silk') { // a roll of red silk with a loose end
      P([[-8, -18], [44, -10], [46, 28], [30, 38], [14, 29], [0, 40], [-10, 34]], '#b23a5a', 0.55);
      P([[-40, -30], [2, -22], [2, 20], [-40, 12]], '#cf4f6f', 0.76); P([[-36, -23], [-2, -17], [-2, -12], [-36, -18]], '#e88ba2', 0.84);
      O(-40, -9, 7, '#eadfc2', 0.86, 21); O(-40, -9, 2.6, '#8a2f38', 0.92, 8);
    } else if (kind === 'pepper') { // a small sack and peppercorns
      P([[-32, -8], [-24, -28], [-10, -21], [4, -28], [12, -8], [22, 34], [-38, 34]], '#b89662', 0.6); R(-27, -13, 9, -7, '#7a5a34', 0.78);
      for (const [x, y] of [[30, 30], [40, 21], [45, 34], [34, 40], [21, 41], [46, 9]]) O(x, y, 5.6, '#2b2b2e', 0.86);
    } else if (kind === 'giraffe') {
      for (const x of [-24, -10, 6]) R(x, 8, x + 6, 46, '#dba935', 0.5);
      P([[-28, -4], [-35, 10], [-33, 11], [-27, 0]], '#7a4a24', 0.5);
      P([[-28, -6], [14, -10], [18, 12], [-28, 12]], PAP[5], 0.66); P([[5, -8], [18, -8], [34, -40], [24, -42]], PAP[5], 0.66);
      P([[22, -46], [40, -44], [46, -36], [30, -34]], PAP[5], 0.76); R(26, -52, 28.5, -45, '#7a4a24', 0.8); R(31, -52, 33.5, -45, '#7a4a24', 0.8);
      for (const [x, y] of [[-20, -2], [-8, 3], [4, -3], [-14, 7], [10, 5], [16, -18], [23, -29]]) P([[x - 3, y - 2.5], [x + 3, y - 3], [x + 3.5, y + 2.5], [x - 2.5, y + 3]], '#9a5a24', 0.86);
    } else if (kind === 'coin') {
      O(0, 0, 43, '#5f6670', 0.56); O(0, 0, 37.5, '#b9bfc7', 0.72); // a silver coin: a darker rim, a pale face, beading and an embossed star
      for (let i = 0; i < 16; i++) { const a = i / 16 * 6.2832; O(Math.cos(a) * 30.5, Math.sin(a) * 30.5, 2.3, '#8a919b', 0.8); }
      O(0, 0, 22, '#cfd4da', 0.8); B.paper(b, starPath(cx, cy + 1 * s, 17 * s, 7.4 * s), '#7f8690', 0.9);
    } else if (kind === 'compass') {
      O(0, 0, 43, '#b98a1e', 0.6); O(0, 0, 35, '#f6f1e4', 0.74);
      R(-1.5, -33, 1.5, -27, '#2b2b2e', 0.8); R(27, -1.5, 33, 1.5, '#2b2b2e', 0.8); R(-33, -1.5, -27, 1.5, '#2b2b2e', 0.8); R(-1.5, 27, 1.5, 33, '#2b2b2e', 0.8);
      P([[6, -24], [7, 4], [-7, -4]], PAP[2], 0.9); P([[-6, 24], [7, 4], [-7, -4]], PAP[9], 0.9); O(0, 0, 3.6, '#2b2b2e', 0.95);
    } else if (kind === 'watch') {
      O(0, -45, 7, '#b98a1e', 0.5); R(-5, -42, 5, -32, '#b98a1e', 0.56);
      O(0, 6, 38, PAP[5], 0.64); O(0, 6, 30, '#f9f5ea', 0.76);
      R(-1.5, -21, 1.5, -16, '#2b2b2e', 0.82); R(22, 4.5, 27, 7.5, '#2b2b2e', 0.82); R(-1.5, 28, 1.5, 33, '#2b2b2e', 0.82); R(-27, 4.5, -22, 7.5, '#2b2b2e', 0.82);
      R(-2, -14, 2, 7, '#2b2b2e', 0.9); P([[0, 4], [17, 12], [15.5, 15.5], [-1.5, 8]], '#2b2b2e', 0.9); O(0, 6, 3.4, PAP[2], 0.95);
    } else if (kind === 'finch') { // a small brown bird with a stout beak, facing right
      R(-5, 22, -2.5, 40, '#c9772e', 0.5); R(6, 22, 8.5, 40, '#c9772e', 0.5);
      P([[-46, 2], [-22, -3], [-20, 10], [-44, 17]], '#6d5a3a', 0.52);
      O(-4, 6, 27, '#8a744a', 0.66, 19); O(22, -10, 14, '#8a744a', 0.74);
      P([[33, -17], [48, -8], [33, -2]], PAP[4], 0.84); P([[-22, 0], [8, -2], [2, 16], [-20, 14]], '#5d4c30', 0.82); O(25, -13, 2.5, '#1c1c1e', 0.94);
    }
  }
  // ---- the envelope on the HUD: the address in ink, a journey's tab, the postmark ----
  function amEnvAddress(b, k, L) { // line 1 "To <name>", line 2 the capital, the destination's flag as a small label, line 3 the stops ("by way of <name>", a pencil tick when visited)
    const c = C[L.to], cap = CAP[L.to], f = FL[L.to], q = b.c;
    const fh = Math.min(36, 60 / f.a), fw = fh * f.a, fx = ENV_W - 20 - fw, fy = 31;
    B.paper(b, x => x.rect((fx - 3) * k, (fy - 3) * k, (fw + 6) * k, (fh + 6) * k), '#fffdf6', 0.5);
    amFlagDraw(b, L.to, fx * k, fy * k, fh * k);
    amInk(b, 'To ' + inSent(c), 20 * k, 43 * k, 26 * k, { maxW: (fx - 34) * k });
    if (cap) { B.paper(b, starPath(28 * k, 65.5 * k, 7.5 * k, 3.2 * k), PAP[5], 0.6); amInk(b, normSaint(cap.name), 41 * k, 66 * k, 21 * k, { maxW: (fx - 56) * k }); }
    if (L.via.length) {
      const px0 = 20, tickW = 20, gap = 18, segs = L.via.map(v => 'by way of ' + amStopName(v));
      q.save(); q.font = `800 ${px0 * k}px ${FONT}`;
      const ws = segs.map(t => q.measureText(t).width / k); q.restore();
      const tot = ws.reduce((a, w, i) => a + w + (AM.viaDone.includes(L.via[i]) ? tickW + 4 : 0), 0) + gap * (segs.length - 1), f2 = Math.min(1, (ENV_W - 40) / tot);
      let x = 20;
      segs.forEach((t, i) => {
        amInk(b, t, x * k, 87 * k, px0 * f2 * k); x += ws[i] * f2;
        if (AM.viaDone.includes(L.via[i])) { amTick(b, (x + 5 * f2) * k, 88 * k, 15 * f2 * k); x += (tickW + 4) * f2; }
        x += gap * f2;
      });
    }
  }
  function amEnvRefresh(bump) { // the envelope's paper again: the back for the Postcard, the address for a letter
    if (!AM.env) return;
    B.freeTex(AM.env.tex); AM.env.tex = amEnvTex(AM.letter);
    if (bump) { AM.env.lift = 0.14; tw(AM.env, { lift: 0 }, 0.25, { cut: true }); sfx.pick(); }
  }
  function amTabMake() { // a journey chapter: a paper tab behind the envelope's top edge with the journey title and "Part n of N"
    if (AM.tab) { amKill(AM.tab); AM.tab = null; }
    const L = AM.letter; if (!L || !L.journey) return;
    const J = MJ[L.journey], tx = textTex(J.title + '  ·  Part ' + L.chapter + ' of ' + J.ch.length, 25, { strip: PAP[5], col: INK, cut: true, seed: 3, scale: devPerHud(), noMip: true });
    AM.tab = amSpr(tx, { hud: true, z: 0.1, zr: 0.03, order: 191, w: tx.lw, h: tx.lh }); AM.tab.own = true; AM.tab.bw = tx.lw; AM.tab.bh = tx.lh;
  }
  function amLetterHud() { // each step: the tab and the postmark ride on the envelope; the hint arrow sits beside the resting plane
    const e = AM.env; if (!e) return;
    if (AM.tab) { const k = Math.min(1, (ENV_W - 16) / AM.tab.bw); AM.tab.w = AM.tab.bw * k; AM.tab.h = AM.tab.bh * k; AM.tab.x = e.x - ENV_W / 2 + 8 + AM.tab.w / 2; AM.tab.y = e.y - ENV_H / 2 - AM.tab.h / 2 + 10; AM.tab.rot = e.rot; AM.tab.lift = e.lift; }
    if (AM.pm) { AM.pm.x = e.x + 74; AM.pm.y = e.y - 37; } // over the right half of the address, beside the flag label
    const L = AM.letter, tg = L && !AM.delivered && (AM.arrow || AM.ring) ? amHintTarget() : null; // the arrow and the ring follow the hints' target
    if (AM.ring && tg && AM.ring.tid !== tg.id) { const dd = clamp(tg.size * 1.15, 40, 260); AM.ring.tid = tg.id; AM.ring.x = tg.x; AM.ring.y = tg.y; AM.ring.w = dd; AM.ring.h = dd; AM.ring.lift = 0.2; tw(AM.ring, { lift: 0 }, 0.25, { cut: true }); }
    if (AM.arrow) {
      const show = !!tg && (AM.state === 'rest' || AM.state === 'pull' || AM.state === 'settle');
      AM.arrow.alpha = show ? 1 : 0;
      if (show) { const a = Math.atan2(tg.y - AM.rest.y, tg.x - AM.rest.x), r = 0.125 * cam.h; AM.arrow.x = AM.rest.x + Math.cos(a) * r; AM.arrow.y = AM.rest.y + Math.sin(a) * r; AM.arrow.rot = a; AM.arrow.w = 0.085 * cam.h; AM.arrow.h = AM.arrow.w * 0.42; }
    }
  }
  // ---- starting a letter ----
  function amFreeStartPt() { const built = prog && Array.isArray(prog.built) ? prog.built : []; for (let i = built.length - 1; i >= 0; i--) { const cp = CAP[built[i]]; if (cp && C[built[i]]) return cp; } return CAP.FR; }
  function amLetterClear() { // a new envelope: the stamps, the thread, the tags and the hints of the letter before go
    for (const st of AM.stamps) amKill(st.s); AM.stamps = [];
    for (const g of AM.threads) for (const q of g) amKill(q); AM.threads = [];
    for (const n of AM.tags.slice()) amKill(n); AM.tags = [];
    for (const k of ['tab', 'pm', 'arrow', 'ring']) if (AM[k]) { amKill(AM[k]); AM[k] = null; }
    amSlingClear(); amHideAim();
    timers = timers.filter(t => t.tag !== 'mail'); AM.jobs = [];
  }
  function amStart(id, glide) { // glide: the next chapter of a journey, the camera travels to the new start instead of jumping; id: a letter or chapter id, or 'free' (the Postcard: the stage A toy, no destination)
    if (!AM.on) return false;
    const L = id === 'free' ? null : ML_BY[id]; if (id !== 'free' && !L) return false;
    if (AM.state !== 'rest' && AM.state !== 'drop') return false; // not while the plane is in the air or at sea
    amBoxClose(false); amCardClose(true); amLetterClear();
    AM.letter = L; AM.viaDone = []; AM.lwrap = false; AM.wrapped = false; AM.delivered = false; AM.throws = 0; AM.last = null; AM.hintN = 0; AM.hintCam = false; AM.farRun = 0; AM.pull = null;
    const st = L ? CAP[L.from] : amFreeStartPt(); // a letter starts on the capital of "from", so chapter n + 1 starts where chapter n ended
    AM.rest = { x: st.x, y: st.y, rot: 0 }; AM.state = 'rest';
    if (AM.star) amKill(AM.star);
    AM.star = amSpr(starTex, { x: st.x, y: st.y, w: 26, h: 26, z: 0.22, zr: 0.02, order: 148 });
    if (AM.frame !== 'plane') { AM.frame = 'plane'; mkBtn('mailMap', 'Whole map', PAP[6]); }
    if (!glide) { killTw(cam); const cl = clampCamVals(st.x, st.y, MAIL.CAM_H); cam.x = cl.x; cam.y = cl.y; cam.h = cl.h; }
    amSetPlane(st.x, st.y, 0, 0, 1);
    amEnvRefresh(false); amTabMake();
    if (L) { const tg = amHintTarget(); AM.prevD = tg.d; AM.tgtId = tg.id; }
    setHint(amLetterHint());
    if (L && L.journey && L.chapter === 1) amIntroCard(MJ[L.journey]);
    sfx.snap();
    return true;
  }
  // ---- the letter box (replaces old 3.4): a paper mat; the Postcard on the left; one row for each level ----
  const BOXG = { EW: 168, EH: 112, GAP: 12, PCW: 190, PCH: 250 }; // envelope and Postcard sizes in HUD units at scale 1
  const AM_LOCK = { 2: 'Deliver 3 letters from level 1 first', 3: 'Deliver 3 letters from level 2 first', 4: 'Finish 2 journeys from level 3 first' };
  function amBoxTex(it, sc) {
    const free = it.kind === 'free', lw = free ? BOXG.PCW : BOXG.EW, lh = free ? BOXG.PCH : BOXG.EH, W = Math.round(lw * sc), H = Math.round(lh * sc), k = W / lw, d = amRec();
    const t = shapeTex(W, H, b => {
      const q = b.c, seed = sid(it.kind + it.id);
      if (free) { // the Postcard: a card with a sky panel, the paper plane and an empty stamp frame
        B.paper(b, wob(4 * k, 4 * k, W - 4 * k, H - 4 * k, 3 * k, 5), '#fbf7ee', 0.4);
        B.paper(b, wob(14 * k, 16 * k, W - 14 * k, 172 * k, 3 * k, 8), PAP[8], 0.5);
        const TP = (px, py) => { const a = -0.32, s = 0.52, x = (px - 120) * s, y = (py - 80) * s; return [(95 + x * Math.cos(a) - y * Math.sin(a)) * k, (98 + x * Math.sin(a) + y * Math.cos(a)) * k]; };
        const PP = (pts, col, rel) => B.paper(b, x => { pts.forEach(([px, py], i) => { const [X, Y] = TP(px, py); i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.closePath(); }, col, rel);
        PP([[236, 80], [6, 8], [70, 80], [6, 152]], PAP[0], 0.7); PP([[236, 80], [70, 80], [6, 152]], shade(PAP[0], -0.07), 0.6);
        PP([[18, 18], [180, 70], [180, 76], [18, 24]], PAP[2], 0.66); PP([[18, 136], [180, 88], [180, 94], [18, 142]], PAP[9], 0.66);
        q.save(); q.strokeStyle = 'rgba(66,68,82,0.5)'; q.lineWidth = 1.6 * k; q.setLineDash([6 * k, 4 * k]); q.strokeRect((lw - 56) * k, 24 * k, 34 * k, 42 * k); q.restore();
        amInk(b, 'Postcard', lw / 2 * k, 210 * k, 31 * k, { align: 'center', maxW: (lw - 24) * k });
        return;
      }
      B.paper(b, wob(3 * k, 3 * k, W - 3 * k, H - 3 * k, 2.4 * k, seed), it.open ? '#faf6ec' : '#e3d9c2', 0.36);
      if (!it.open) { B.paper(b, mkRibbonPath([[8 * k, 10 * k], [W / 2, H * 0.56], [W - 8 * k, 10 * k]], [1.1 * k, 1.1 * k, 1.1 * k]), shade('#e3d9c2', -0.3), 0.3); return; } // a closed level: face down, the plain back
      B.paper(b, x => x.rect(5 * k, 5 * k, W - 10 * k, 6 * k), PAP[2], 0.5); // the air-mail edge
      for (let x0 = 5 * k, i = 0; x0 + 12 * k <= W - 5 * k; x0 += 12 * k, i++) if (i % 2) B.paper(b, x => x.rect(x0, 5 * k, 12 * k, 6 * k), PAP[9], 0.5);
      if (it.kind === 'letter') { // the two flags (from, to) and the destination name; delivered: a postmark, a pencil tally of the throws, a gold star for Express
        const L = it.L, r = d[L.id], f1 = FL[L.from], f2 = FL[L.to], w1 = Math.min(30 * f1.a, 46), h1 = w1 / f1.a, w2 = Math.min(30 * f2.a, 46), h2 = w2 / f2.a;
        amFlagDraw(b, L.from, 12 * k, (34 - h1 / 2) * k, h1 * k);
        B.paper(b, x => { const ax = (12 + w1 + 6) * k, ay = 34 * k; x.moveTo(ax, ay - 5 * k); x.lineTo(ax + 7 * k, ay); x.lineTo(ax, ay + 5 * k); x.closePath(); }, INK, 0.5);
        amFlagDraw(b, L.to, (12 + w1 + 19) * k, (34 - h2 / 2) * k, h2 * k);
        amInk(b, normSaint(C[L.to].name), 12 * k, 69 * k, 23 * k, { maxW: (lw - 24) * k });
        if (r) {
          amTally(b, 12 * k, 94 * k, r.throws, k, (r.express ? 116 : 144) * k, 7 * k);
          amPostmarkDraw(b, 140 * k, 35 * k, 20 * k, seed);
          if (r.express) B.paper(b, starPath(148 * k, 92 * k, 13 * k, 5.6 * k), PAP[5], 0.8);
        }
      } else { // a journey: one envelope; the title, a dot for each chapter, the treasure in the corner when complete
        const J = it.J, done = J.ch.map(l => d[l.id]), all = done.every(Boolean), n = J.ch.length;
        let tf = 20, lines; do { tf--; lines = wrapWords(q, J.title, 100 * k, `800 ${tf * k}px ${FONT}`); } while (lines.length > 2 && tf > 12); // the whole title on one or two lines
        lines.forEach((ln, i) => amInk(b, ln, 11 * k, ((lines.length === 1 ? 40 : 30) + i * 21) * k, tf * k, { maxW: 101 * k }));
        const tx = 137 * k, ty = 42 * k;
        if (all) { B.paper(b, wob(tx - 25 * k, ty - 25 * k, tx + 25 * k, ty + 25 * k, 2 * k, seed + 3), '#fffdf6', 0.6); amTreasure(b, AM_PIC[J.id], tx, ty, 42 * k); }
        else { q.save(); q.strokeStyle = 'rgba(66,68,82,0.45)'; q.lineWidth = 1.6 * k; q.setLineDash([6 * k, 4 * k]); q.beginPath(); q.arc(tx, ty, 21 * k, 0, 7); q.stroke(); q.restore(); } // an empty pencil ring waits for the treasure
        for (let i = 0; i < n; i++) { // filled when the chapter is delivered; a gold star when it was Express
          const dx = (18 + i * 19) * k, dy = 80 * k, r = done[i];
          if (r && r.express) B.paper(b, starPath(dx, dy, 8.6 * k, 3.7 * k), PAP[5], 0.8);
          else if (r) B.paper(b, x => x.arc(dx, dy, 6 * k, 0, 7), PAP[9], 0.76);
          else { q.save(); q.strokeStyle = 'rgba(54,56,68,0.62)'; q.lineWidth = 1.7 * k; q.beginPath(); q.arc(dx, dy, 5.4 * k, 0.1, 6.38); q.stroke(); q.restore(); }
        }
        if (all) amPostmarkDraw(b, 141 * k, 87 * k, 15 * k, seed);
        else { const fa = FL[J.ch[0].from], fb = FL[J.last.to], wa = Math.min(16 * fa.a, 23), wb = Math.min(16 * fb.a, 23); amFlagDraw(b, J.ch[0].from, 112 * k, (86 - wa / fa.a / 2) * k, wa / fa.a * k); amFlagDraw(b, J.last.to, 138 * k, (86 - wb / fb.a / 2) * k, wb / fb.a * k); }
        const tot = done.reduce((a, r) => a + (r ? r.throws : 0), 0); if (tot) amTally(b, 11 * k, 100 * k, tot, k, 108 * k, 5.5 * k);
      }
    }, { noMip: true });
    t.lw = lw; t.lh = lh; return t;
  }
  function amBoxOpen(fileId) { // fileId: the letter just delivered; its envelope is filed last, with a bigger drop
    if (!AM.on || AM.box) return false;
    if (AM.pull) amCancelPull();
    if (AM.card) amCardClose(true);
    const sc0 = devPerHud(), W = 1000 * asp, G0 = BOXG;
    const rows = [1, 2, 3, 4].map(lv => ({ lv, items: ML.filter(l => l.level === lv && !l.journey).map(L => ({ kind: 'letter', L, id: L.id })).concat(MJ_LIST.filter(J => J.level === lv).map(J => ({ kind: 'journey', J, id: J.id }))) }));
    const maxN = Math.max(1, ...rows.map(r => r.items.length)), rowW = maxN * G0.EW + (maxN - 1) * G0.GAP;
    const padX = 28, colGap = 34, headH = 54, labH = 30, pitch = labH + 6 + G0.EH + 12, top = 24 + headH + 10;
    const W0 = padX * 2 + G0.PCW + colGap + rowW, H0 = top + rows.length * pitch - 12 + 26;
    const s = Math.min(1, (W - 24) / W0, 980 / H0), x0 = (W - W0 * s) / 2, y0 = Math.max(10, Math.min(158, 990 - H0 * s)), X = u => x0 + u * s, Y = u => y0 + u * s;
    const fl = fileId && ML_BY[fileId], fileKey = fl ? (fl.journey || fl.id) : null;
    const box = { sprs: [], items: [], s, rect: [x0, y0, x0 + W0 * s, y0 + H0 * s], fileKey };
    AM.box = box;
    const mk = (tex, o) => { const q = amSpr(tex, Object.assign({ hud: true, z: 0.14, zr: 0.03, order: 219 }, o)); q.own = true; box.sprs.push(q); return q; };
    const mt = shapeTex(Math.round(W0 * s * sc0), Math.round(H0 * s * sc0), b => B.paper(b, wob(6 * sc0, 6 * sc0, b.w - 6 * sc0, b.h - 6 * sc0, 9 * sc0, 4471), '#cdb995', 0.3), { noMip: true });
    box.mat = mk(mt, { order: 217, z: 0.13, zr: 0.02, x: X(W0 / 2), y: Y(H0 / 2), w: W0 * s, h: H0 * s, rot: -0.004 });
    const ht = textTex('Letter box', 40 * 0.9, { strip: HUD_PAPER, col: INK, cut: true, scale: sc0 * s, noMip: true });
    mk(ht, { order: 218, x: X(padX) + ht.lw * s / 2, y: Y(24 + headH / 2), w: ht.lw * s, h: ht.lh * s, rot: -0.9 * DEG });
    rows.forEach((r, ri) => {
      const open = amLevelOpen(r.lv), ry = top + ri * pitch;
      const lt = textTex('Level ' + r.lv, 21, { strip: open ? PAP[8] : '#b9ad97', col: INK, cut: true, seed: r.lv, scale: sc0 * s, noMip: true });
      mk(lt, { order: 218, x: X(padX + G0.PCW + colGap) + lt.lw * s / 2, y: Y(ry + labH / 2), w: lt.lw * s, h: lt.lh * s, rot: (hs(r.lv, 3, 1) - 0.5) * 2 * DEG });
      r.items.forEach((it, i) => { it.lv = r.lv; it.open = open; it.x = X(padX + G0.PCW + colGap + i * (G0.EW + G0.GAP) + G0.EW / 2); it.y = Y(ry + labH + 6 + G0.EH / 2); it.w = G0.EW * s; it.h = G0.EH * s; it.tilt = (hs(i + 1, r.lv, 5) - 0.5) * 2.2 * DEG; box.items.push(it); });
    });
    box.items.unshift({ kind: 'free', id: 'free', open: true, x: X(padX + G0.PCW / 2), y: Y(top + (rows.length * pitch - 12) / 2), w: G0.PCW * s, h: G0.PCH * s, tilt: -1.6 * DEG });
    // one card is baked and dealt per step, so no frame carries more than one bake
    for (const it of box.items.slice().sort((a, b) => (a.id === fileKey) - (b.id === fileKey))) amJob(() => {
      if (AM.box !== box) return;
      const filed = it.id === fileKey;
      it.s = mk(amBoxTex(it, sc0 * s), { x: it.x, y: it.y, w: it.w, h: it.h, rot: it.tilt, lift: filed ? 0.45 : 0.16 });
      tw(it.s, { lift: 0 }, filed ? 0.4 : 0.18, { cut: true }); if (filed) sfx.snap();
    });
    setHint('Pick a letter'); sfx.turn();
    return true;
  }
  function amBoxClose(restore) {
    const box = AM.box; if (!box) return;
    AM.box = null; for (const q of box.sprs) amKill(q);
    if (restore) setHint(amLetterHint());
  }
  function amBoxDown(p) { // an open envelope starts its letter; a completed journey's treasure re-opens its story; a tap outside the mat closes the box
    const box = AM.box;
    for (const it of box.items) {
      if (!it.s || !hit(it.s, p.hx, p.hy, 2)) continue;
      if (it.kind === 'free') { amStart('free'); return; }
      if (!it.open) { it.s.lift = 0.14; tw(it.s, { lift: 0 }, 0.25, { cut: true }); setHint(AM_LOCK[it.lv] || 'Pick a letter'); return; }
      if (it.kind === 'letter') { amStart(it.L.id); return; }
      const J = it.J, d = amRec(), next = J.ch.find(l => !d[l.id]);
      if (!next && p.hx - it.s.x > (BOXG.EW / 2 - 64) * box.s && p.hy - it.s.y < (-BOXG.EH / 2 + 70) * box.s) { amStoryOpen(J, null); return; }
      amStart((next || J.ch[0]).id); return; // the first undelivered chapter, or chapter 1 again when all are done
    }
    if (!hit(box.mat, p.hx, p.hy, 0)) amBoxClose(true);
  }
  // ---- the cards: a journey's small opening card (4 s) and its story card ----
  function amCardClose(silent) {
    const cd = AM.card; if (!cd) return;
    AM.card = null;
    if (cd.kind === 'story') stopSpeech();
    const q = cd.s;
    if (silent) amKill(q); else { killTw(q); tw(q, { y: q.y - 26, lift: 0.32 }, 0.18, { cut: true, done: () => amKill(q) }); }
    if (cd.kind === 'story' && !silent) { if (cd.done) cd.done(); else setHint(AM.box ? 'Pick a letter' : amLetterHint()); }
  }
  function amSmallCard(kind, head, line, secs, lpx = 26) { // lpx: the line's size // a small paper card with a heading and one line, read by the voice; it does not stop the game
    const sc = devPerHud(), W = 1000 * asp, cw = Math.min(720, W - 40), ch = 180, k = sc;
    const tex = shapeTex(Math.round(cw * sc), Math.round(ch * sc), b => {
      const q = b.c;
      B.paper(b, wob(3 * k, 3 * k, b.w - 3 * k, b.h - 3 * k, 5 * k, 417), '#f2ebdb', 0.5);
      amInk(b, head, cw / 2 * k, 50 * k, 38 * k, { align: 'center', maxW: (cw - 60) * k });
      q.save(); q.font = `800 ${lpx * k}px ${FONT}`; const lines = amWrap(q, line, (cw - 70) * k); q.restore();
      lines.forEach((ln, i) => amInk(b, ln, cw / 2 * k, (118 + (i - (lines.length - 1) / 2) * lpx * 1.27) * k, lpx * k, { align: 'center', maxW: (cw - 60) * k }));
    }, { noMip: true });
    const s = amSpr(tex, { hud: true, z: 0.15, zr: 0.03, order: 205, x: W / 2, y: 268, w: cw, h: ch, rot: 0.006, lift: 0.3 }); s.own = true;
    tw(s, { lift: 0 }, 0.3, { cut: true });
    const cd = AM.card = { kind, s, t0: T, head, line };
    if (secs) after(secs, () => { if (AM.card === cd) amCardClose(); }, 'mail');
    return cd;
  }
  function amIntroCard(J) { // chapter 1: the title and one line (mail.js "intro" for a round trip, else "Follow <title> from <from> to <last destination>")
    const nm = J.title.replace(/^The /, 'the '), line = J.ch[0].intro || 'Follow ' + nm + ' from ' + inSent(C[J.ch[0].from]) + ' to ' + inSent(C[J.last.to]);
    amSmallCard('intro', J.title, line, 4);
    speakText(line);
  }
  function amPartCard(J, L) { // a middle chapter is delivered: 3 s of "Part n of N / Next: to <name>", then the plane stands on the next chapter's start capital
    const nx = J.ch[J.ch.indexOf(L) + 1], head = 'Part ' + nx.chapter + ' of ' + J.ch.length, line = 'Next: to ' + inSent(C[nx.to]);
    const cd = amSmallCard('part', head, line, 0, 34);
    speakText(head + '. ' + line);
    const go = () => { // if the child has thrown again meanwhile, it waits for the plane to land; an open letter box cancels it
      if (!AM.on || AM.letter !== L || AM.box) return;
      if (AM.state !== 'rest') { after(0.4, go, 'mail'); return; }
      if (AM.card === cd) amCardClose();
      amStart(nx.id, true);
    };
    after(3, go, 'mail');
  }
  function amStoryOpen(J, done, quiet) { // paper like the passport pages: the title, the story, the treasure's picture and name; the voice reads it; a tap closes it
    if (!AM.on || !J) return false;
    if (AM.card) amCardClose(true);
    const sc = devPerHud(), W = 1000 * asp, cw = Math.min(900, W - 40), ch = 800, k = sc, pad = 54;
    let fit = null;
    const tex = shapeTex(Math.round(cw * sc), Math.round(ch * sc), b => {
      const q = b.c;
      B.paper(b, wob(3 * k, 3 * k, b.w - 3 * k, b.h - 3 * k, 6 * k, 733), '#f2ebdb', 0.5);
      q.save(); q.strokeStyle = 'rgba(84,80,72,0.20)'; q.lineWidth = 1.6 * k; q.setLineDash([8 * k, 6 * k]); q.strokeRect(14 * k, 14 * k, b.w - 28 * k, b.h - 28 * k); q.restore();
      const tf = amInk(b, J.title, pad * k, 68 * k, 46 * k, { maxW: (cw - pad * 2) * k });
      q.save(); q.strokeStyle = PAP[2]; q.lineWidth = 3 * k; q.lineCap = 'round'; q.beginPath(); q.moveTo(pad * k, 104 * k); q.lineTo((pad + 190) * k, 104 * k); q.stroke(); q.restore();
      const ps = 150, px = pad, py = ch - pad - ps + 10; // the treasure, bottom left
      B.paper(b, wob(px * k, py * k, (px + ps) * k, (py + ps) * k, 4 * k, 91), '#fffdf6', 0.62);
      amTreasure(b, AM_PIC[J.id], (px + ps / 2) * k, (py + ps / 2) * k, ps * 0.8 * k);
      q.save(); q.font = `800 ${32 * k}px ${FONT}`; const tl = amWrap(q, J.treasure, (cw - pad * 2 - ps - 30) * k); q.restore();
      tl.forEach((ln, i) => amInk(b, ln, (px + ps + 30) * k, (py + ps / 2 + (i - (tl.length - 1) / 2) * 40) * k, 32 * k));
      const top = 132, avail = py - 24 - top; let f = 40, lines = [];
      do { f--; q.save(); q.font = `800 ${f * k}px ${FONT}`; lines = amWrap(q, J.story, (cw - pad * 2) * k); q.restore(); } while (f > 18 && lines.length * f * 1.38 > avail); // the story, as large as fits
      lines.forEach((ln, i) => amInk(b, ln, pad * k, (top + (i + 0.5) * f * 1.38) * k, f * k));
      fit = { font: f, lines: lines.length, textBottom: +(top + lines.length * f * 1.38).toFixed(1), textLimit: py - 24, titleFont: +(tf / k).toFixed(1), cw, ch };
    }, { noMip: true });
    const s = amSpr(tex, { hud: true, z: 0.16, zr: 0.03, order: 226, x: W / 2, y: 178 + ch / 2, w: cw, h: ch, rot: -0.004, lift: 0.35 }); s.own = true;
    tw(s, { lift: 0 }, 0.3, { cut: true });
    AM.card = { kind: 'story', s, J, done: done || null, t0: T, fit };
    setHint('Tap to close');
    if (!quiet) { sfx.turn(); enqueuePhrase([J.title].concat(amSentences(J.story)), J.title + '. ' + J.story); }
    return true;
  }
  function amRebake() { // after a resize or a late web font: bake again what carries text
    if (!AM.on) return;
    amEnvRefresh(false); amTabMake();
    if (AM.pm) { B.freeTex(AM.pm.tex); AM.pm.tex = amDeliveredTex(devPerHud()); }
    const cd = AM.card && AM.card.kind === 'story' ? AM.card : null; if (cd) { AM.card = null; amKill(cd.s); } // taken off first: opening the box again closes any card, which lost a story card open over the box
    if (AM.box) { const fk = AM.box.fileKey; amBoxClose(false); amBoxOpen(); if (AM.box) AM.box.fileKey = fk; }
    if (cd) amStoryOpen(cd.J, cd.done, true);
  }
  // hooks for the input and HUD code: "mail" mode answers only to this block
  addEventListener('blur', () => { if (AM.on && AM.pull) amCancelPull(); }); // air mail
  addEventListener('resize', () => { if (AM.on && AM.pull) amCancelPull(); }); // air mail
  BTN_IDS.push('mail'); // air mail
  mkBtn('mail', 'Air Mail', PAP[8]); // air mail
  mkBtn('mailMap', 'Whole map', PAP[6]); btn.mailMap.alpha = 0; // air mail
  // ---------- end air mail ----------

  // ---------- update ----------
  function update(dt) {
    T += dt; const F = Math.floor(T * 12), tq = F / 12;
    for (let i = 0; i < timers.length; i++) if (timers[i].t <= T) { const t = timers.splice(i, 1)[0]; i--; t.fn(); }
    for (let i = 0; i < tweens.length; i++) { const t = tweens[i]; const now = t.sm ? T : tq + 1 / 12; if (now < t.t0) continue; if (!t.from) { t.from = {}; for (const k in t.to) t.from[k] = t.o[k]; } const u = clamp((now - t.t0) / t.dur, 0, 1), e = ease(u); for (const k in t.to) t.o[k] = lerp(t.from[k], t.to[k], e); if (u >= 1) { tweens.splice(i, 1); i--; if (t.done) t.done(); } }
    if (pending.length) { for (let n = 0; n < (T < 0.2 ? 400 : 6) && pending.length; n++) { const c = pending.shift(); if (c === AQ) { bakeCountry(AQ); aqS = spr(AQ.tex, { x: AQ.cx, y: AQ.cy, w: AQ.tw, h: AQ.th, z: 0.17, zr: 0.045, order: 20 }); aqS.c = AQ; csp.AQ = aqS; } else if (c.built) showCountry(c, T > 0.3); } }
    syncLand();
    if (drag && drag.piece && drag.scaled && mode === 'map' && playerLevel() === 'own' && RD) {
      drag.s.sc = drag.s.tp.sc;
      const ex = ptr[0] < 0.06 ? (ptr[0] - 0.06) / 0.06 : ptr[0] > 0.94 ? (ptr[0] - 0.94) / 0.06 : 0;
      const ey = ptr[1] < 0.06 ? (ptr[1] - 0.06) / 0.06 : ptr[1] > 0.94 ? (ptr[1] - 0.94) / 0.06 : 0;
      if (ex !== 0 || ey !== 0) {
        killTw(cam);
        const spd = cam.h * 0.48 * dt;
        const cl = clampCamVals(cam.x + ex * spd * asp, cam.y + ey * spd, cam.h);
        const dx = cl.x - cam.x, dy = cl.y - cam.y;
        cam.x = cl.x; cam.y = cl.y;
        drag.s.x += dx; drag.s.y += dy;
      }
    }
    if (twinDrag && twinDrag.moved && mode === 'world' && cam.h < worldFrame().h - 2) {
      const ex = ptr[0] < 0.06 ? (ptr[0] - 0.06) / 0.06 : ptr[0] > 0.94 ? (ptr[0] - 0.94) / 0.06 : 0;
      const ey = ptr[1] < 0.06 ? (ptr[1] - 0.06) / 0.06 : ptr[1] > 0.94 ? (ptr[1] - 0.94) / 0.06 : 0;
      if (ex !== 0 || ey !== 0) {
        killTw(cam);
        const spd = cam.h * 0.48 * dt;
        const cl = clampCamVals(cam.x + ex * spd * asp, cam.y + ey * spd, cam.h);
        const dx = cl.x - cam.x, dy = cl.y - cam.y;
        cam.x = cl.x; cam.y = cl.y;
        twinDrag.tw.s.x += dx; twinDrag.tw.s.y += dy;
      }
    }
    if (mode === 'world' && !attract && !picker && !passport && !needFirstPick && !twinDrag && !worldTap && !pan && !pinch && twins.length === 0 && !pending.length && !compareHintDone) {
      const builtC = G.countries.filter(c => c.built && c !== AQ && csp[c.id] && S.includes(csp[c.id]));
      if (builtC.length >= 8) {
        idleTime += dt;
        if (idleTime >= 6) {
          compareHintDone = true;
          idleTime = 0;
          const bestC = builtC.slice().sort((a, b) => polyArea(b) - polyArea(a))[0];
          const hs_ = bestC && csp[bestC.id];
          if (hs_) {
            compareHopSprite = hs_;
            const hy = bestC.cy;
            const hopH = Math.max(10, Math.min(20, cam.h * 0.013));
            hs_.order = 26;
            tw(hs_, { y: hy - hopH, z: 0.34 }, 0.18, {
              cut: true,
              done: () => {
                if (!S.includes(hs_)) return;
                tw(hs_, { y: hy, z: 0.17 }, 0.2, {
                  cut: true,
                  done: () => { hs_.order = 20; if (compareHopSprite === hs_) compareHopSprite = null; }
                });
              }
            });
          }
          setHint('Drag a country to compare sizes');
          after(3.5, () => {
            if (mode === 'world' && !attract && !picker && !passport && hintTxt === 'Drag a country to compare sizes') {
              setHint(worldHintStr());
            }
          }, 'cmpHint');
        }
      } else idleTime = 0;
    } else {
      idleTime = 0;
    }
    if (mode === 'mail') amUpdate(dt); // air mail
    updateWind();
    updatePassport();
    syncDynamicOverlays();
    const ws = windStrength();
    // idle accents (stop-motion)
    for (const a of acc) { const j = hs(F, sid(a.kind), Math.round(a.ph * 10)); if (a.kind === 'boat') { a.rot = Math.sin(tq * 1.3 + a.ph) * 0.09 + (j - 0.5) * 0.02 + 0.38 * ws; a.x = a.bx + Math.sin(tq * 0.21 + a.ph) * 9 + 16 * ws; a.y = a.by + Math.sin(tq * 1.3 + a.ph + 1) * 0.8; a.lift = 0.06 * ws; } else if (a.kind === 'sun') { a.rot = F * 0.021; a.sc = 1 + (j - 0.5) * 0.015; } else { a.x = a.bx + ((tq * 3.2 + a.ph * 40) % 260) - 130; a.y = a.by + (j - 0.5) * 0.5; a.alpha = clamp(1.3 - Math.abs(a.x - a.bx) / 100, 0, 1) * (mode === 'world' ? 1 : 0.0); } }
    for (const w of seaWaves) { const j = hs(F, 43, Math.round(w.ph * 10)); w.rot = Math.sin(tq * 1.4 + w.ph) * 0.05 + (j - 0.5) * 0.02 + 0.36 * ws; w.x = w.bx + Math.sin(tq * 0.5 + w.ph) * 1.4 + 10 * ws; w.y = w.by + Math.sin(tq * 1.4 + w.ph + 1) * 0.6; w.lift = 0.05 * ws; w.alpha = (mode === 'world' || mode === 'map' || mode === 'wind') ? 1 : 0; }
    for (let i = S.length - 1; i >= 0; i--) { const s = S[i];
      if (s.wakeAt !== undefined) { const u = (T - s.wakeAt) / 1.25; if (u >= 0 && u < 1.25) { s.wake = Math.floor(u * 15) / 15; s.glow = Math.sin(clamp(u, 0, 1) * Math.PI) * (0.75 + 0.25 * Math.sin(F * 2.1)); } else if (u >= 1.25) { s.wake = -1; s.glow = 0; s.wakeAt = undefined; } }
      if (s.bird) { const u = T - s.bird.t0; if (u > 0) { s.alpha = clamp(2.2 - u, 0, 1); s.x += s.bird.vx * dt; s.y += s.bird.vy * dt; s.sx = (F + s.bird.ph) % 2 ? 1 : 0.55; s.lift = u * 0.05; if (u > 2.2) { S.splice(i, 1); continue; } } }
      if (s.ghost !== undefined) s.alpha = 0.3 + 0.15 * Math.sin((T - s.ghost) * 5);
      if (s.breath !== undefined) { const u = T - s.breath; if (u > 2.6) { s.breath = undefined; s.lift = 0; } else if (!drag || drag.s !== s) s.lift = 0.12 + 0.1 * Math.sin(u * 5); }
      if (s.wig !== undefined) { const u = T - s.wig; if (u > 0.5) s.wig = undefined; }
    }
    if (RD) for (const s of [RD.piece, ...RD.placed]) if (s && s.flag && s.wig !== undefined) {
      s.rot += Math.sin((T - s.wig) * 40) * 0.004;
    }
    if (hold && picker && picker.kind === 'pick') {
      const el = T - hold.t0;
      if (el >= 3.0) {
        const target = hold.player; resetHoldPose(); hold = null; openPicker('confirmRemove', { player: target });
      } else if (el > 0.18) {
        const k = clamp((el - 0.18) / 2.82, 0.2, 1), it = hold.item;
        const jx = (hs(F, 17, 1) - 0.5) * 7 * k, jy = (hs(F, 19, 2) - 0.5) * 6 * k, jr = (hs(F, 23, 3) - 0.5) * 0.08 * k, lf = 0.24 * k;
        it.card.x = it.hx + jx; it.card.y = it.hy + jy; it.card.rot = jr; it.card.lift = lf;
        if (it.nameS) { it.nameS.x = it.nameS.hx + jx; it.nameS.y = it.nameS.hy + jy; it.nameS.rot = jr; it.nameS.lift = lf; }
        if (it.levelS) { it.levelS.x = it.levelS.hx + jx; it.levelS.y = it.levelS.hy + jy; it.levelS.rot = jr; it.levelS.lift = lf; }
      }
    }
    if (tag) { const F2 = Math.floor(T * 12); tag.lift = 0.05 + 0.05 * Math.sin(F2 * 0.5); tag.y = tag.by + Math.sin(F2 * 0.5) * 2.5; tag.rot = -0.03 + Math.sin(F2 * 0.25) * 0.02; tag.alpha = (mode === 'world' && !picker && !passport) ? 1 : 0; if (tagPtr) { tagPtr.lift = tag.lift * 0.8; tagPtr.y = tagPtr.by + Math.sin(F2 * 0.5) * 2.5; tagPtr.alpha = tag.alpha; } }
    if (Q.has('vp')) setHint(vpStr());
    layoutHud();
    syncPhonePortrait();
  }
  function scheduleAttract(delay, onlyIdx) {
    timers = timers.filter(t => t.tag !== 'at');
    after(delay, () => {
      if (!attract) return;
      if (isPhonePortrait()) { scheduleAttract(0.8, onlyIdx); return; }
      beginRound(CI.sa, { auto: true, only: onlyIdx });
    }, 'at');
  }
  function syncPhonePortrait() {
    if (isPhonePortrait()) {
      if (!wasPhonePortrait) {
        wasPhonePortrait = true;
        activePtrs.clear();
        pan = null; pinch = null; mapTap = null; worldTap = null;
        if (hold) { resetHoldPose(); hold = null; }
        if (AM.on && AM.pull) amCancelPull();
        if (drag) onUp({ pointerId: drag.id, type: 'pointercancel', clientX: drag.sx, clientY: drag.sy });
        if (twinDrag) onUp({ pointerId: twinDrag.id, type: 'pointercancel', clientX: twinDrag.sx, clientY: twinDrag.sy });
        nextTurnWob = T + 1.8;
      }
      layoutTurnCard();
      if (T >= nextTurnWob) { startWobble(turnCard); startWobble(turnLbl); nextTurnWob = T + 3.5; }
      for (const s of S) if (s.hud && !s._turnCard) { if (s._savedAlpha === undefined) s._savedAlpha = s.alpha; s.alpha = 0; }
    } else if (wasPhonePortrait) {
      wasPhonePortrait = false;
      if (turnBg) turnBg.alpha = 0;
      if (turnCard) turnCard.alpha = 0;
      if (turnLbl) turnLbl.alpha = 0;
      for (const s of S) if (s._savedAlpha !== undefined) { s.alpha = s._savedAlpha; delete s._savedAlpha; }
      layoutHud();
    }
  }
  // ---------- start ----------
  const vq = (Q.get('view') || '').toLowerCase(); const vct = CONTS.find(c => c.id === vq || c.name.toLowerCase().replace(/ /g, '') === vq.replace(/[ _-]/g, ''));
  cam.h = Math.max(1185, 2230 / asp); cam.y = 474;
  updateHudToken();
  if (vct && contDone(vct) && vct.id !== 'all') { mode = 'map'; ensureBase(vct); setView(vct); camCont(vct, 0); setHint(vct.name + ' is finished'); }
  else if (vct) { beginRound(vct, { skipFlags: true, replay: contDone(vct), r: 0 }); }
  else if (vq === 'flags') { const ct = CI[Q.get('c')] || CI.sa; beginRound(ct, { replay: contDone(ct), r: 0 }); }
  else if (vq === 'passport') {
    goWorld(0);
    const pq = (Q.get('page') || '').toLowerCase();
    const validSec = PASS_CONTS.some(ct => ct.id === pq) || pq === 'world' ? pq : null;
    const spq = Math.max(0, parseInt(Q.get('spread') || '0', 10) || 0);
    openPassport(validSec ? { section: validSec, spread: spq, instant: true } : { instant: true });
  }
  else if (vq === 'mail' && currentPlayer()) { goWorld(0); amEnter(Q.get('letter') || ''); } // air mail: &letter=<id> starts that letter, without it the letter box opens
  else if (vq === 'world' || Q.get('done') === 'all' || Q.has('noattract') || Q.has('player') || Q.has('compare')) { goWorld(0); if (Q.get('done') === 'all') after(0.6, wakeAll); else if (store.players.length >= 2 && !Q.has('player') && !Q.has('noattract') && !Q.has('compare')) needFirstPick = true; }
  else if (store.players.length === 1) { goWorld(0); }
  else if (store.players.length >= 2) { goWorld(0); needFirstPick = true; }
  else { attract = true; goWorld(0); scheduleAttract(2.6, 0); }
  const cmpQ = Q.get('compare');
  if (cmpQ && mode === 'world') {
    while (pending.length) {
      const c = pending.shift();
      if (c === AQ) { bakeCountry(AQ); aqS = spr(AQ.tex, { x: AQ.cx, y: AQ.cy, w: AQ.tw, h: AQ.th, z: 0.17, zr: 0.045, order: 20 }); aqS.c = AQ; csp.AQ = aqS; }
      else if (c.built) showCountry(c, false);
    }
    const parts = cmpQ.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const c1 = C[parts[0]], c2 = C[parts[1]];
    if (c1 && c2 && c1 !== AQ && c2 !== AQ) {
      if (!c1.built) { c1.built = true; showCountry(c1, false); }
      if (!c2.built) { c2.built = true; showCountry(c2, false); }
      const pt = (c2.c && pipPolys(c2.c[0], c2.c[1], c2.polys)) ? c2.c : ringInteriorPt(c2.polys.reduce((best, r) => (!best || ringAbsArea(r) > ringAbsArea(best)) ? r : best, null));
      const d = anchorDelta(c1);
      const twObj = liftTwin(c1, { x: pt[0] - d[0], y: pt[1] - d[1], lifted: false });
      if (c1 !== c2) showCompareTag(twObj, c2, compareSentence(c1, c2), 4.0);
    }
  }
  let last = performance.now(), acc_ = 0, ft = [], miss = 0, frozen = false, good = 0, recov = 0, bakesAtTick = B.bakes();
  if (FREEZE !== null) { while (T < FREEZE) update(1 / 60); frozen = true; }
  window.__atlas = {
    fps: 0,
    view: viewMetrics,
    rounds: () => CONTS.map(ct => ({ id: ct.id, name: ct.name, rounds: ct.rounds.map(rd => rd.map(c => ({ id: c.id, name: c.name, card: !!c.isCard }))) })),
    speechLog: () => speechLog.slice(),
    speechVoice: () => enVoice ? { name: enVoice.name, lang: enVoice.lang, localService: !!enVoice.localService } : null,
    state: () => ({
      mode, T, sprites: S.length, scale: B.getScale(), texMB: +(B.texBytes() / (1024 * 1024)).toFixed(1), hint: hintTxt, current: store.current, level: playerLevel(), soundOn,
      windActive: !!(wind || (RD && RD.wind)),
      windPhase: wind ? wind.phase : (RD && RD.wind ? 'putback' : null),
      windTaken: wind ? wind.taken.map(c => c.id) : (RD && RD.wind ? RD.windTaken.slice() : []),
      windQueue: RD && RD.wind ? (RD.piece ? [RD.piece.c.id, ...RD.queue.map(c => c.id)] : RD.queue.map(c => c.id)) : [],
      records: currentPlayer() ? Object.fromEntries(Object.entries(currentPlayer().rec || {}).map(([k, v]) => [k, { w: v.w, t: v.t }])) : {},
      sessionRounds,
      zoomedIn: isZoomedIn(),
      compareHintDone,
      lastComparison: lastComparisonText || null,
      twins: twins.map(tw_ => {
        const s = tw_.s, turn = ((Math.round(s.rot / (Math.PI / 2)) % 4) + 4) % 4, ac = anchorOf(s);
        return { country: tw_.c.id, name: tw_.c.name, position: [+s.x.toFixed(2), +s.y.toFixed(2)], center: [+ac[0].toFixed(2), +ac[1].toFixed(2)], turn, sc: +s.sc.toFixed(4), w: +s.w.toFixed(2), h: +s.h.toFixed(2), z: +s.z.toFixed(3), order: s.order };
      }),
      players: store.players.map(p => ({ id: p.id, token: p.token, name: p.name, level: cleanLevel(p.level), builtCount: (p.prog.built || []).length, finished: CONTS.filter(ct => contDone(ct, p.prog)).map(ct => ct.id) })),
      passport: (() => {
        const pl = currentPlayer();
        const builtList = (prog && Array.isArray(prog.built)) ? prog.built : [];
        const unseen = unseenStickers(pl);
        if (!passport) {
          return { open: false, section: null, spread: 0, spreadCount: 0, singlePage: asp < 0.9, builtCount: builtList.length, totalCountries: G.countries.length, newStickers: unseen, pageNewIds: [], animatingNew: false, flipping: false, stickers: [] };
        }
        return {
          open: true,
          section: passport.section,
          spread: passport.spread,
          spreadCount: passport.spreadCount || 0,
          singlePage: asp < 0.9,
          builtCount: builtList.length,
          totalCountries: G.countries.length,
          newStickers: unseen,
          pageNewIds: (passport.newIds || []).slice(),
          animatingNew: !!passport.animatingNew,
          flipping: !!passport.flipping,
          bounds: passport.bounds,
          closeBtn: passport.closeBox,
          tabs: passport.tabs.map(t => ({ kind: t.kind, id: t.id, x: t.s.x, y: t.s.y, w: t.s.w, h: t.s.h })),
          corners: passport.corners,
          stickers: passport.stickers.map(it => ({
            id: it.c.id, name: it.c.name, capital: CAP[it.c.id] ? CAP[it.c.id].name : null,
            x: it.s.x, y: it.s.y, w: it.s.w, h: it.s.h,
            pxFlagW: it.pxFlagW, pxFlagH: it.pxFlagH,
            pxCountryFont: it.pxCountryFont, pxCapitalFont: it.pxCapitalFont,
            countryLines: it.countryLines, capitalLines: it.capitalLines, pressing: !!it.pressing
          }))
        };
      })(),
      hudBtn: playerBtn.alpha > 0.5 ? { x: playerBtn.x, y: playerBtn.y, w: playerBtn.w, h: playerBtn.h } : null,
      btn: Object.fromEntries(Object.keys(btn).map(id => [id, btn[id].alpha > 0.5 ? { x: btn[id].x, y: btn[id].y, w: btn[id].w, h: btn[id].h } : null])),
      hud: (() => { const bx = (k, q) => q && S.includes(q) && q.alpha > 0.5 ? { k, x: q.x, y: q.y, w: q.w * q.sc, h: q.h * q.sc, rot: q.rot, rail: !!q.rail } : null; // batch 4b: every HUD strip and the rail, for overlap checks
        return [bx('title', title), bx('hint', hintS), bx('token', playerBtn), ...BTN_IDS.map(id => bx(id, btn[id])), ...(RD ? RD.col.map((q, i) => bx('flag' + i, q)) : []), ...(RD && RD.colLabels ? RD.colLabels.map((q, i) => bx('label' + i, q.s)) : [])].filter(Boolean); })(),
      zoomable: zoomable(), voice: enVoice ? { name: enVoice.name, lang: enVoice.lang, default: !!enVoice.default, localService: !!enVoice.localService } : null,
      hudBottom: topHudBottom(), built: Object.keys(csp),
      land: { terr: [...lsp.keys()].filter(p => p.paper).map(p => p.name + '/' + p.cont), extra: [...lsp.keys()].filter(p => p.of).map(p => p.id), on: { ...terrOn } },
      stars: Object.values(csp).filter(s => s.star && s.star.alpha > 0.5).map(s => ({ id: s.c.id, x: s.star.x, y: s.star.y, d: +(s.star.w * STAR_FILL).toFixed(2), px: +(s.star.w * STAR_FILL * innerHeight / cam.h).toFixed(2), onCard: !!(RD && RD.cardLanded === s) })),
      tags: activeTags.filter(n => S.includes(n)).map(n => {
        const pxPerW = innerHeight / Math.max(1, cam.h);
        return {
          id: n._c && n._c.id, x: n.x, y: n.y, w: n.w, h: n.h, twoLine: !!(n._c && CAP[n._c.id]),
          countryLinePx: +(n.h * (n.pxFrac || 0) * pxPerW).toFixed(2),
          capitalLinePx: +(n.h * (n.px2Frac || 0) * pxPerW).toFixed(2),
          countryBoxPx: +(n.h * (n.h1Frac || 0) * pxPerW).toFixed(2),
          capitalBoxPx: +(n.h * (n.h2Frac || 0) * pxPerW).toFixed(2),
          capRatio: +(n.capRatio || 0).toFixed(3)
        };
      }),
      picker: picker ? { kind: picker.kind, count: picker.items.length, hold: hold ? +(T - hold.t0).toFixed(2) : 0, extraCount: picker.extraSprites.length, head: picker.head && { x: picker.head.x, y: picker.head.y, w: picker.head.w, h: picker.head.h }, note: picker.note && { x: picker.note.x, y: picker.note.y, w: picker.note.w, h: picker.note.h }, items: picker.items.map(it => ({ kind: it.kind, token: it.token || (it.player && it.player.token), id: it.player && it.player.id, name: it.player && it.player.name, level: it.player && cleanLevel(it.player.level), x: it.card.x, y: it.card.y, w: it.card.w, h: it.card.h, nameY: it.nameS && it.nameS.y, nameH: it.nameS && it.nameS.h, levelY: it.levelS && it.levelS.y, levelH: it.levelS && it.levelS.h })) } : null,
      round: RD && { cont: RD.ct.id, r: RD.r, fi: RD.fi, wind: !!RD.wind, list: RD.list.map(c => c.id), spawning: RD.spawning && RD.spawning.id, hintStep: RD.hintStep, miss: RD.miss, memory: !!RD.memory, memShowing: !!RD.memShowing, modelBackAlpha: RD.back ? RD.back.alpha : 0, baseCam: RD.baseCam, zoomedIn: isZoomedIn(), card: RD.card && { x: RD.card.x, y: RD.card.y, w: RD.card.w, h: RD.card.h }, cardFlag: RD.cardLanded && RD.cardLanded._onCard && RD.cardLanded.flag ? (() => { const s = RD.cardLanded, c = s.c, shA = (c.A || (c.bw * c.bh * 0.5)) * s.sc * s.sc, flA = s.flag.w * s.flag.h; return { id: c.id, w: +s.flag.w.toFixed(3), h: +s.flag.h.toFixed(3), x: +s.flag.x.toFixed(3), y: +s.flag.y.toFixed(3), poleBaseY: +(s.pole.y + s.pole.h * 0.5).toFixed(3), cardTopY: +(RD.card.y - RD.card.h * 0.5).toFixed(3), areaPct: +(flA / Math.max(1e-6, shA) * 100).toFixed(2) }; })() : null, spot: RD.spot && { x: RD.spot.x, y: RD.spot.y }, leader: !!RD.leader, cardName: !!RD.cardName, cardLanded: !!RD.cardLanded, col: RD.col.map((s, i) => ({ id: RD.list[i] && RD.list[i].id, x: s.x, y: s.y, w: s.w, h: s.h })), piece: RD.piece && { id: RD.piece.c.id, isCard: !!RD.piece.c.isCard, waiting: !!RD.piece.waiting, flag: RD.piece.flag ? { x: RD.piece.flag.x, y: RD.piece.flag.y, w: RD.piece.flag.w * (RD.piece.flag.sc || 1), h: RD.piece.flag.h * (RD.piece.flag.sc || 1) } : null, tile: !!RD.piece.tile, tileBox: RD.piece.tile ? { x: RD.piece.tile.x, y: RD.piece.tile.y, w: RD.piece.tile.w * RD.piece.tile.sc, h: RD.piece.tile.h * RD.piece.tile.sc, rot: RD.piece.tile.rot } : null, x: RD.piece.x, y: RD.piece.y, w: RD.piece.w, h: RD.piece.h, sc: RD.piece.sc, rot: RD.piece.rot, tp: RD.piece.tp, bbox: RD.piece.c.bbox }, parts: RD.parts.map(s => ({ ok: s.ok, placed: s.placed, x: s.x, y: s.y, tx: s.tx, ty: s.ty, w: s.w * s.sc, h: s.h * s.sc, idx: s.idx })), model: RD.model && S.includes(RD.model) ? { x: RD.model.x, y: RD.model.y, w: RD.model.w, h: RD.model.h } : null, mat: RD.FH ? { x: RD.mx, y: RD.my, FH: RD.FH, fit: RD.tableFit || null } : null },
      worldTag: tag && S.includes(tag) ? { x: tag.x, y: tag.y, w: tag.w, h: tag.h, alpha: tag.alpha, dist: tag._dist, ptrLen: tagPtr ? tagPtr._len : 0, ptr: tagPtr ? { x: tagPtr.x, y: tagPtr.y, w: tagPtr.w, h: tagPtr.h, rot: tagPtr.rot } : null } : null,
      pile: (() => { const bx = q => ({ id: q.c && q.c.id, x: q.x, y: q.y, w: q.w * q.sc, h: q.h * q.sc, rot: q.rot }); return RD && RD.windPile ? Object.values(RD.windPile).filter(q => S.includes(q)).map(bx) : wind ? wind.items.filter(it => S.includes(it.s)).map(it => bx(it.s)) : []; })(),
      cam: { ...cam }, asp
    }),
    w2s: (x, y) => { const h = w2h(x, y); return [h[0] / 1000 * innerHeight, h[1] / 1000 * innerHeight]; },
    freeze: v => { frozen = !!v; }, advance: sec => { for (let t = 0; t < sec - 1e-6; t += 1 / 60) { update(1 / 60); if (mode === 'mail') amCamera(1 / 60, AM.settled); } }, // air mail: camera per step too // batch 4 test hooks: hold the clock, step it (frame-exact screenshots)
    prog: () => prog,
    mail: amApi // air mail
  };
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const baked = B.bakes() !== bakesAtTick;
    if (T > 1 && !baked) {
      ft.push(dt); if (dt > 0.02) miss++;
      if (ft.length >= 45) {
        const a = ft.reduce((x, y) => x + y, 0) / ft.length; window.__atlas.fps = 1 / a;
        if (miss / ft.length > 0.1 && B.getScale() > 0.5) { B.setScale(Math.max(0.5, B.getScale() * 0.85)); good = 0; }
        else if (miss === 0 && a < 0.0175 && B.getScale() < 1 && recov < 2) { if (++good >= 8) { B.setScale(Math.min(1, B.getScale() / 0.85)); recov++; good = 0; } }
        else if (miss > 0) good = 0;
        ft = []; miss = 0;
      }
    }
    if (!frozen) { acc_ += dt; let n = 0; while (acc_ >= 1 / 60 && n++ < 6) { update(1 / 60); acc_ -= 1 / 60; } if (n >= 6) acc_ = 0; }
    if (mode === 'mail' && !frozen) amCamera(dt, AM.settled); // air mail: the camera follows with the real frame time
    updateZoomDetail(dt);
    syncDynamicOverlays();
    syncPhonePortrait();
    const la = Math.atan2(0.6, -0.8) + (ptr[0] - 0.5) * 0.5, ll = 1; light = [Math.cos(la) * ll, Math.sin(la) * ll + (0.5 - ptr[1]) * 0.25]; const ln = Math.hypot(light[0], light[1]); light[0] /= ln; light[1] /= ln;
    S.sort((a, b) => a.order - b.order);
    B.draw(S, cam, light);
    if (Math.abs(B.size()[1] - lastHudDevH) / Math.max(1, lastHudDevH) >= 0.20) rebakeFonts();
    bakesAtTick = B.bakes();
    frame++; requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
