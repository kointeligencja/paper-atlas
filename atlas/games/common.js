// Shared cut-paper kit for Paper Atlas games (PRD section 3 + 2.6 + Appendix C).
(function () {
  'use strict';
  const PG = window.PAPER_GAMES = window.PAPER_GAMES || { logic: {} };

  const NAME = { airmail: 'Air Mail', borders: 'Border Block', mancala: 'Mancala', othello: 'Othello' };
  const HOME = {
    airmail: ['IN'],
    borders: ['GB'],
    mancala: ['GH', 'KE', 'EG'],
    othello: ['GB', 'JP']
  };
  const FROM = {
    airmail: 'Around the world',
    borders: 'From England',
    mancala: 'From Africa',
    othello: 'From England and Japan'
  };
  const GIFT_LINE = {
    airmail: 'You found the home of Air Mail.',
    borders: 'You found the home of Border Block.',
    mancala: 'You found the homes of Mancala. New: shell seeds.',
    othello: 'You found the homes of Othello. New: sun and moon discs.'
  };
  // DRAFT story texts: owner fact-checks before release (PRD 4.6)
  const STORIES = {
    airmail: 'The first official air mail flew in India in 1911. A young French pilot, Henri Pequet, carried about 6,500 letters in a small plane. He flew from Allahabad to Naini, across a river. The flight took 13 minutes. Today letters cross whole oceans by air, like your paper plane.',
    borders: 'In 1852 a young man in London, Francis Guthrie, was colouring a map of the counties of England. He saw that four colours were enough, so that no two neighbours had the same colour. Is that true for every map? It took more than a hundred years to prove it. Later, people in Cambridge turned map colouring into games for two players. This one is called Snort, after Simon Norton, who thought of it.',
    mancala: 'Mancala is not one game. It is a big family of games, played all over Africa for many hundreds of years. In Ghana it is called Oware. In Kenya and Tanzania people play Bao. Rows of small pits cut into old stone have been found in Egypt and Ethiopia. The name comes from an Arabic word that means to move. All you need is some seeds and a few holes in the ground.',
    othello: 'This game was first sold in London in the 1880s. It was called Reversi, because the pieces are reversed: turned over. Two men, Lewis Waterman and John Mollett, each said it was his idea. In the 1970s Goro Hasegawa, from the town of Mito in Japan, gave it new starting rules and a new name: Othello. People say it takes a minute to learn and a lifetime to master.'
  };

  function defaultOpt(level, isPhone) {
    const young = level === 'help';
    return {
      borders: { players: 1, bot: young ? 'easy' : 'clever', rule: 'snort', board: 'sa' },
      mancala: { players: 1, bot: young ? 'easy' : 'clever', seeds: young ? 3 : 4, sit: 'side', path: young, look: 'beans' },
      othello: { players: 1, bot: young ? 'easy' : 'clever', size: (isPhone || young) ? 6 : 8, dots: true, look: 'plain' }
    };
  }

  function cleanSave(raw, level, isPhone) {
    const def = defaultOpt(level || 'own', !!isPhone);
    const src = raw && typeof raw === 'object' ? raw : {};
    const seen = {
      borders: !!(src.seen && src.seen.borders),
      mancala: !!(src.seen && src.seen.mancala),
      othello: !!(src.seen && src.seen.othello)
    };
    const cleanArr = (arr, allowed) => {
      const out = [];
      if (!Array.isArray(arr)) return out;
      for (const id of arr) if (allowed.includes(id) && !out.includes(id)) out.push(id);
      return out;
    };
    const stamps = {
      airmail: cleanArr(src.stamps && src.stamps.airmail, HOME.airmail),
      borders: cleanArr(src.stamps && src.stamps.borders, HOME.borders),
      mancala: cleanArr(src.stamps && src.stamps.mancala, HOME.mancala),
      othello: cleanArr(src.stamps && src.stamps.othello, HOME.othello)
    };
    const stars = {
      airmail: !!(src.stars && src.stars.airmail),
      borders: !!(src.stars && src.stars.borders),
      mancala: !!(src.stars && src.stars.mancala),
      othello: !!(src.stars && src.stars.othello)
    };
    const cleanStat = o => {
      const p = Number(o && o.played);
      const w = Number(o && o.won);
      return {
        played: Number.isFinite(p) && p > 0 ? Math.floor(p) : 0,
        won: Number.isFinite(w) && w > 0 ? Math.floor(w) : 0
      };
    };
    const n = {
      borders: cleanStat(src.n && src.n.borders),
      mancala: cleanStat(src.n && src.n.mancala),
      othello: cleanStat(src.n && src.n.othello)
    };
    const p2 = typeof src.p2 === 'string' && src.p2.length > 0 && src.p2.length <= 20 ? src.p2 : 'friend';
    const so = src.opt && typeof src.opt === 'object' ? src.opt : {};
    const sb = so.borders && typeof so.borders === 'object' ? so.borders : {};
    const sm = so.mancala && typeof so.mancala === 'object' ? so.mancala : {};
    const sot = so.othello && typeof so.othello === 'object' ? so.othello : {};
    const opt = {
      borders: {
        players: sb.players === 2 ? 2 : 1,
        bot: sb.bot === 'clever' ? 'clever' : (sb.bot === 'easy' ? 'easy' : def.borders.bot),
        rule: sb.rule === 'col' ? 'col' : 'snort',
        board: ['sa', 'eu', 'af', 'as'].includes(sb.board) ? sb.board : 'sa'
      },
      mancala: {
        players: sm.players === 2 ? 2 : 1,
        bot: sm.bot === 'clever' ? 'clever' : (sm.bot === 'easy' ? 'easy' : def.mancala.bot),
        seeds: sm.seeds === 3 ? 3 : (sm.seeds === 4 ? 4 : def.mancala.seeds),
        sit: sm.sit === 'across' ? 'across' : 'side',
        path: typeof sm.path === 'boolean' ? sm.path : def.mancala.path,
        look: sm.look === 'shells' ? 'shells' : 'beans'
      },
      othello: {
        players: sot.players === 2 ? 2 : 1,
        bot: sot.bot === 'clever' ? 'clever' : (sot.bot === 'easy' ? 'easy' : def.othello.bot),
        size: sot.size === 6 ? 6 : (sot.size === 8 ? 8 : def.othello.size),
        dots: typeof sot.dots === 'boolean' ? sot.dots : def.othello.dots,
        look: sot.look === 'sunmoon' ? 'sunmoon' : 'plain'
      }
    };
    return { v: 1, seen, stamps, stars, n, p2, opt };
  }

  PG.cleanSave = cleanSave;
  PG.NAME = NAME;
  PG.HOME = HOME;
  PG.FROM = FROM;
  PG.GIFT_LINE = GIFT_LINE;
  PG.STORIES = STORIES;

  PG.common = function (ctx) {
    const B = ctx.GFX, PAP = ctx.PAP, FONT = ctx.FONT, INK = ctx.INK, CREAM = ctx.CREAM;
    const COL = {
      trayRim: '#cdb995',
      trayFloor: '#b29a72',
      card: '#f2ebdb',
      lid: '#faf6ec',
      band: '#c8a877',
      pencil: 'rgba(66,68,82,0.5)',
      ink: INK,
      dimInk: '#6b6457',
      tabOff: '#d9cdb2',
      tabOn: PAP[5],
      play: PAP[6],
      star: PAP[5],
      p1: PAP[4],
      p1Dark: ctx.shade(PAP[4], -0.18),
      p2: PAP[9],
      p2Light: ctx.shade(PAP[9], 0.25),
      closed: '#8f8676',
      mat: ctx.BLACK
    };

    const GT = [3400, 560]; // centre of the black paper games mat east of the world map
    const sprites = new Set();
    let jobs = [];
    let fastMode = ctx.Q.get('fast') === '1';
    let rndSeed = ctx.Q.has('seed') ? (parseInt(ctx.Q.get('seed'), 10) || 1) : ((Date.now() & 0x7fffffff) || 1);
    let rndFn = ctx.rng(rndSeed);
    let matSprite = null;
    let badgeCache = null;
    let badgeScale = 0;
    let tokCache = {};
    let swatchCache = {};
    let activeNote = null;
    let swatchSprite = null;

    const rnd = () => rndFn();
    const setSeed = n => { rndSeed = (Number(n) | 0) || 1; rndFn = ctx.rng(rndSeed); };
    const setFast = v => { fastMode = !!v; };
    const isFast = () => fastMode;

    function spr(tex, o) {
      const s = ctx.spr(tex, o);
      sprites.add(s);
      return s;
    }

    function kill(s) {
      if (!s) return;
      sprites.delete(s);
      ctx.killTw(s);
      ctx.kill(s);
    }

    function killAll() {
      jobs.length = 0;
      activeNote = null;
      swatchSprite = null;
      matSprite = null;
      const list = [...sprites];
      sprites.clear();
      for (const s of list) {
        ctx.killTw(s);
        ctx.kill(s);
      }
      ctx.clearTimers('games');
      freeSharedCaches();
    }

    function freeSharedCaches() {
      if (badgeCache) {
        for (let i = 0; i < badgeCache.length; i++) if (badgeCache[i]) B.freeTex(badgeCache[i]);
        badgeCache = null;
        badgeScale = 0;
      }
      for (const k in tokCache) { if (tokCache[k]) B.freeTex(tokCache[k]); }
      tokCache = {};
      for (const k in swatchCache) { if (swatchCache[k]) B.freeTex(swatchCache[k]); }
      swatchCache = {};
    }

    function job(fn) {
      if (fastMode) { fn(); return; }
      jobs.push(fn);
    }

    function stepJobs() {
      if (!jobs.length) return;
      if (fastMode) {
        const list = jobs; jobs = [];
        for (const fn of list) fn();
        return;
      }
      const fn = jobs.shift();
      if (fn) fn();
    }

    function clearJobs() { jobs.length = 0; }

    function tw(o, to, dur, opt) {
      if (fastMode || !dur || dur <= 0) {
        ctx.killTw(o, Object.keys(to));
        for (const k in to) o[k] = to[k];
        if (opt && opt.done) opt.done();
        return null;
      }
      return ctx.tw(o, to, dur, opt);
    }

    function after(sec, fn) {
      if (fastMode || sec <= 0) {
        ctx.after(0, fn, 'games');
        return;
      }
      ctx.after(sec, fn, 'games');
    }

    function ensureMat() {
      const asp = ctx.asp ? ctx.asp() : 1.6;
      const needH = Math.max(3000, Math.ceil(2200 / Math.max(0.35, asp)));
      if (matSprite && sprites.has(matSprite) && ctx.S.includes(matSprite)) {
        if (matSprite.h < needH) matSprite.h = needH;
        return matSprite;
      }
      const tex = ctx.shapeTex(1200, 1000, b => {
        B.paper(b, ctx.wob(6, 6, 1194, 994, 8, 9103), COL.mat, 0.2);
      }, { noMip: true });
      matSprite = spr(tex, { x: GT[0], y: GT[1], w: 2400, h: needH, z: 0.045, zr: 0.05, order: 1, own: true });
      return matSprite;
    }

    function hideMat() {
      if (matSprite) { kill(matSprite); matSprite = null; }
    }

    // ---- Shared cut-paper drawing helpers ----
    function cardTex(w, h, draw, seed, sc) {
      const k = sc || ctx.devPerHud();
      const W = Math.max(4, Math.round(w * k)), H = Math.max(4, Math.round(h * k));
      const t = ctx.shapeTex(W, H, b => {
        B.paper(b, ctx.wob(3 * k, 3 * k, W - 3 * k, H - 3 * k, 5 * k, seed || 501), COL.card, 0.5);
        if (draw) draw(b, k, W, H);
      }, { noMip: true });
      t.lw = w; t.lh = h;
      return t;
    }

    function card(w, h, draw, seed, o) {
      const t = cardTex(w, h, draw, seed);
      const s = spr(t, Object.assign({ hud: true, z: 0.15, zr: 0.03, order: 222, w, h, lift: 0.3, own: true }, o));
      tw(s, { lift: 0 }, 0.3, { cut: true });
      return s;
    }

    function tabTex(label, on, o) {
      const opt = o || {};
      const sc = opt.scale || ctx.devPerHud();
      const px = opt.px || 30;
      return ctx.textTex(label, px, {
        strip: opt.colr || (on ? COL.tabOn : COL.tabOff),
        col: opt.ink || (on ? COL.ink : COL.dimInk),
        cut: true,
        seed: opt.seed || ctx.sid(label) + (on ? 17 : 3),
        minW: opt.minW || 0,
        center: !!opt.center,
        scale: sc,
        noMip: true
      });
    }

    function tab(label, on, o) {
      const opt = o || {};
      const t = tabTex(label, on, opt);
      const sc = opt.s || 1;
      const s = spr(t, {
        hud: true, z: 0.155, zr: 0.03, order: opt.order || 223,
        x: opt.x || 0, y: opt.y || 0, w: t.lw * sc, h: t.lh * sc,
        rot: opt.rot || 0, lift: on ? 0.05 : 0, own: true
      });
      s.bw = t.lw; s.bh = t.lh; s.baseTilt = opt.rot || 0;
      s.label = label; s.on = !!on;
      s._opt = { scale: opt.scale, px: opt.px, colr: opt.colr, ink: opt.ink, seed: opt.seed, minW: opt.minW, center: opt.center, s: opt.s, order: opt.order, rot: opt.rot };
      return s;
    }

    function tapTab(s, label) {
      if (ctx.sfx && ctx.sfx.pick) ctx.sfx.pick();
      if (s) {
        if (ctx.startWobble) ctx.startWobble(s);
        else {
          const base = s.baseTilt || 0;
          tw(s, { rot: base + 0.08 }, 1 / 12, {
            cut: true,
            done: () => tw(s, { rot: base - 0.06 }, 1 / 12, {
              cut: true,
              done: () => tw(s, { rot: base }, 1 / 12, { cut: true })
            })
          });
        }
      }
      const txt = label || (s && s.label);
      if (txt && ctx.speakText) ctx.speakText(txt);
    }

    function row(label, tabs, o) {
      const opt = o || {};
      const list = Array.isArray(tabs) ? tabs : [];
      const x0 = opt.x !== undefined ? opt.x : 160;
      const y0 = opt.y !== undefined ? opt.y : 400;
      const maxW = opt.maxW || opt.w || 680;
      const gap = opt.gap !== undefined ? opt.gap : 14;
      const lblGap = opt.lblGap !== undefined ? opt.lblGap : 22;
      const lineH = opt.lineH || 64;
      const order = opt.order || 223;
      const sc = ctx.devPerHud();

      let labelS = null;
      if (label) {
        const lt = ctx.textTex(label, 24, { col: COL.ink, scale: sc, noMip: true });
        labelS = spr(lt, { hud: true, z: 0.155, zr: 0.03, order, x: x0 + lt.lw / 2, y: y0, w: lt.lw, h: lt.lh, own: true });
      }

      const isSpr = item => item && typeof item === 'object' && item.tex && item.bw !== undefined;
      let onIdx = list.findIndex(item => isSpr(item) ? !!item.on : !!(item && item.on));
      if (onIdx < 0 && list.length) onIdx = 0;

      const tabSprs = list.map((item, i) => {
        const isOn = i === onIdx;
        if (isSpr(item)) {
          item.on = isOn;
          item.lift = isOn ? 0.05 : 0;
          return item;
        }
        const lbl = typeof item === 'string' ? item : (item && item.label) || '';
        const tOpt = Object.assign({ order }, item && item.opt);
        const s = tab(lbl, isOn, tOpt);
        s.value = (item && item.value !== undefined) ? item.value : lbl;
        return s;
      });

      const lblW = labelS ? labelS.w : 0;
      const tabsW = tabSprs.reduce((sum, s) => sum + s.w, 0) + gap * Math.max(0, tabSprs.length - 1);
      const totalW = lblW + (lblW && tabSprs.length ? lblGap : 0) + tabsW;
      const wrapped = totalW > maxW && !!labelS;
      const maxTabH = tabSprs.reduce((m, s) => Math.max(m, s.h || 44), 44);
      let rowH = Math.max(labelS ? labelS.h : 0, maxTabH);

      if (!wrapped) {
        let tx = x0 + lblW + (lblW ? lblGap : 0);
        if (labelS) { labelS.x = x0 + lblW / 2; labelS.y = y0; }
        for (const s of tabSprs) {
          s.x = tx + s.w / 2;
          s.y = y0;
          tx += s.w + gap;
        }
      } else {
        labelS.x = x0 + lblW / 2;
        labelS.y = y0 - lineH / 2;
        let tx = x0, ty = y0 + lineH / 2, lines = 1;
        for (const s of tabSprs) {
          if (tx > x0 && tx - x0 + s.w > maxW) {
            tx = x0;
            ty += lineH;
            lines++;
          }
          s.x = tx + s.w / 2;
          s.y = ty;
          tx += s.w + gap;
        }
        rowH = lineH * lines + maxTabH;
      }

      const rowObj = {
        labelS, tabs: tabSprs, wrapped, y: y0, h: rowH,
        select(idxOrVal, silent) {
          const idx = typeof idxOrVal === 'number'
            ? idxOrVal
            : tabSprs.findIndex(s => s.value === idxOrVal || s.label === idxOrVal);
          if (idx < 0 || idx >= tabSprs.length) return -1;
          tabSprs.forEach((s, i) => {
            const on = i === idx;
            if (s.on !== on) {
              const oldTex = s.tex;
              s.tex = tabTex(s.label || '', on, s._opt);
              if (oldTex && s.own) B.freeTex(oldTex);
              s.on = on;
              s.lift = on ? 0.05 : 0;
            }
          });
          if (!silent) tapTab(tabSprs[idx]);
          return idx;
        },
        hit(p) {
          return tabSprs.findIndex(s => ctx.hit(s, p));
        },
        kill() {
          if (labelS) kill(labelS);
          for (const s of tabSprs) kill(s);
        }
      };
      return rowObj;
    }

    function note(head, line, secs) {
      closeNote(true);
      const sc = ctx.devPerHud(), W = 1000 * ctx.asp();
      const cw = Math.min(720, W - 40), ch = line ? 180 : 124, k = sc;
      const t = ctx.shapeTex(Math.round(cw * sc), Math.round(ch * sc), b => {
        const q = b.c;
        B.paper(b, ctx.wob(3 * k, 3 * k, b.w - 3 * k, b.h - 3 * k, 5 * k, 419), COL.card, 0.5);
        ctx.ink(b, head, cw / 2 * k, (line ? 50 : ch / 2) * k, 38 * k, { align: 'center', maxW: (cw - 60) * k });
        if (line) {
          q.save(); q.font = `800 ${26 * k}px ${FONT}`;
          const lines = ctx.wrap(q, line, (cw - 70) * k);
          q.restore();
          lines.forEach((ln, i) => ctx.ink(b, ln, cw / 2 * k, (118 + (i - (lines.length - 1) / 2) * 33) * k, 26 * k, { align: 'center', maxW: (cw - 60) * k }));
        }
      }, { noMip: true });
      const s = spr(t, { hud: true, z: 0.15, zr: 0.03, order: 224, x: W / 2, y: Math.max(268, ctx.topHudBottom() + ch / 2 + 24), w: cw, h: ch, rot: 0.006, lift: 0.3, own: true });
      tw(s, { lift: 0 }, 0.3, { cut: true });
      const nObj = activeNote = { s, head, line };
      if (secs) after(secs, () => { if (activeNote === nObj) closeNote(false); });
      return nObj;
    }

    function closeNote(silent) {
      if (!activeNote) return;
      const nObj = activeNote; activeNote = null;
      if (silent || fastMode) kill(nObj.s);
      else tw(nObj.s, { y: nObj.s.y - 26, lift: 0.32 }, 0.18, { cut: true, done: () => kill(nObj.s) });
    }

    function ribbon(lines, colr) {
      const arr = Array.isArray(lines) ? lines : [lines];
      const sc = ctx.devPerHud(), W = 1000 * ctx.asp();
      const rw = Math.min(W * 0.86, 980), rh = arr.length > 1 ? 176 : 120, k = sc;
      const fill = colr || COL.card;
      const isLight = fill === COL.card || fill === COL.lid || fill === PAP[0] || fill === CREAM || fill === PAP[5];
      const inkCol = isLight ? INK : CREAM;
      const notch = 34;
      const t = ctx.shapeTex(Math.round(rw * sc), Math.round(rh * sc), b => {
        B.paper(b, q => {
          const pad = 4 * k, x0 = pad, y0 = pad, x1 = b.w - pad, y1 = b.h - pad, n = notch * k, ym = (y0 + y1) / 2;
          q.moveTo(x0, y0);
          q.lineTo(x1, y0);
          q.lineTo(x1 - n, ym);
          q.lineTo(x1, y1);
          q.lineTo(x0, y1);
          q.lineTo(x0 + n, ym);
          q.closePath();
        }, fill, 0.55);
        const maxW = (rw - notch * 2 - 44) * k;
        if (arr.length === 1) {
          ctx.ink(b, arr[0], rw / 2 * k, rh / 2 * k, 46 * k, { align: 'center', col: inkCol, maxW });
        } else {
          ctx.ink(b, arr[0], rw / 2 * k, (rh * 0.34) * k, 44 * k, { align: 'center', col: inkCol, maxW });
          ctx.ink(b, arr[1], rw / 2 * k, (rh * 0.70) * k, 34 * k, { align: 'center', col: inkCol, maxW });
        }
      }, { noMip: true });
      const s = spr(t, { hud: true, z: 0.17, zr: 0.03, order: 228, x: W / 2, y: 470, w: rw, h: rh, rot: -0.008, lift: 0.5, own: true });
      tw(s, { lift: 0 }, 4 / 12, { cut: true });
      return s;
    }

    function confetti(hx, hy, count, cols) {
      const n = count === 0 ? 0 : Math.min(28, count || 20);
      if (n <= 0) return [];
      const palette = cols && cols.length ? cols : [PAP[4], PAP[9], PAP[5], PAP[6]];
      const scraps = [];
      const sc = ctx.devPerHud();
      for (let i = 0; i < n; i++) {
        const sz = 14 + (i % 5) * 2;
        const col = palette[i % palette.length];
        const tri = i % 2 === 0;
        const t = ctx.shapeTex(Math.max(8, Math.round(sz * sc)), Math.max(8, Math.round(sz * sc)), b => {
          B.paper(b, q => {
            const p = 1.5 * sc, w = b.w - p, h = b.h - p;
            if (tri) { q.moveTo(b.w / 2, p); q.lineTo(w, h); q.lineTo(p, h); q.closePath(); }
            else { q.rect(p, p, w - p, h - p); }
          }, col, 0.7);
        }, { noMip: true });
        const ang = (i / n) * Math.PI * 2 + (ctx.hs(i, 71, 3) - 0.5) * 0.5;
        const dist = 70 + ctx.hs(i, 73, 5) * 190;
        const tx = hx + Math.cos(ang) * dist;
        const ty = hy + Math.sin(ang) * dist * 0.75 + 20;
        const r0 = (ctx.hs(i, 79, 1) - 0.5) * 3;
        const r1 = r0 + (ctx.hs(i, 83, 2) - 0.5) * 4;
        const s = spr(t, { hud: true, z: 0.175, zr: 0.03, order: 229, x: hx, y: hy, w: sz, h: sz, rot: r0, lift: 0.45, own: true });
        scraps.push(s);
        tw(s, { x: tx, y: ty, rot: r1, lift: 0 }, 8 / 12, { cut: true });
      }
      after(8 / 12 + 2.5, () => {
        for (const s of scraps) {
          if (!sprites.has(s)) continue;
          tw(s, { lift: 0.45, y: s.y - 28 }, 2 / 12, { cut: true, done: () => kill(s) });
        }
      });
      return scraps;
    }

    function ensureBadges() {
      if (badgeCache) return badgeCache;
      badgeCache = new Array(65);
      badgeScale = 96;
      for (let n = 0; n <= 64; n++) {
        badgeCache[n] = ctx.shapeTex(96, 96, b => {
          B.paper(b, q => q.arc(48, 48, 42, 0, Math.PI * 2), CREAM, 0.55);
          b.c.save();
          b.c.strokeStyle = 'rgba(66,68,82,0.35)';
          b.c.lineWidth = 2.5;
          b.c.beginPath(); b.c.arc(48, 48, 37, 0, Math.PI * 2); b.c.stroke();
          b.c.restore();
          ctx.ink(b, String(n), 48, 50, n >= 10 ? 46 : 52, { align: 'center', col: INK });
        }, { noMip: true });
      }
      return badgeCache;
    }

    function badge(n) {
      const arr = ensureBadges();
      return arr[ctx.clamp(Math.round(n) || 0, 0, 64)];
    }

    // ---- Custom tokens: Paper Bot & Friend (PRD 3.3) ----
    function drawBotToken(b, cx, cy, sc) {
      const k = sc;
      // cream folded-paper square head
      B.paper(b, ctx.cutEdge(cx - 26 * k, cy - 20 * k, cx + 26 * k, cy + 24 * k, 3 * k, 901), PAP[0], 0.6);
      // kraft antenna + red paper dot
      B.paper(b, q => q.rect(cx - 2.5 * k, cy - 34 * k, 5 * k, 15 * k), COL.band, 0.55);
      B.paper(b, q => q.arc(cx, cy - 35 * k, 6 * k, 0, Math.PI * 2), PAP[2], 0.78);
      // two punched round eyes
      B.paper(b, q => q.arc(cx - 10 * k, cy - 4 * k, 5.5 * k, 0, Math.PI * 2), PAP[1], 0.2);
      B.paper(b, q => q.arc(cx + 10 * k, cy - 4 * k, 5.5 * k, 0, Math.PI * 2), PAP[1], 0.2);
      // teal mouth strip
      B.paper(b, ctx.cutEdge(cx - 13 * k, cy + 8 * k, cx + 13 * k, cy + 15 * k, 1.4 * k, 907), PAP[11], 0.7);
    }

    function drawFriendToken(b, cx, cy, sc) {
      B.paper(b, ctx.starPath(cx, cy, 29 * sc, 13 * sc), PAP[5], 0.75);
    }

    function drawSpecialToken(b, kind, cx, cy, sc) {
      if (kind === 'bot') drawBotToken(b, cx, cy, sc);
      else if (kind === 'friend') drawFriendToken(b, cx, cy, sc);
      else ctx.drawToken(b, kind, cx, cy, sc);
    }

    function tokenBtnTex(kind, sc) {
      const scale = sc || ctx.devPerHud();
      const key = kind + '@' + Math.round(scale * 100);
      if (tokCache[key]) return tokCache[key];
      const L = 84, W = Math.round(L * scale), k = W / L;
      const t = ctx.shapeTex(W, W, b => {
        B.paper(b, ctx.cutEdge(4 * k, 4 * k, W - 4 * k, W - 4 * k, 5 * k, ctx.sid(kind) + 41), CREAM, 0.2);
        drawSpecialToken(b, kind, W / 2, W / 2, k * 0.92);
      }, { noMip: true });
      t.lw = L; t.lh = L;
      tokCache[key] = t;
      return t;
    }

    // Swatch for mover's colour & pattern (56 x 40 HUD units, PRD 3.4)
    function swatchTex(style, sc) {
      const scale = sc || ctx.devPerHud();
      const key = style + '@' + Math.round(scale * 100);
      if (swatchCache[key]) return swatchCache[key];
      const lw = 56, lh = 40, W = Math.round(lw * scale), H = Math.round(lh * scale), k = W / lw;
      const t = ctx.shapeTex(W, H, b => {
        const edge = ctx.cutEdge(3 * k, 3 * k, W - 3 * k, H - 3 * k, 3 * k, ctx.sid(style) + 7);
        if (style === 'p1') {
          B.paper(b, edge, COL.p1, 0.55);
          b.c.save(); b.g.save();
          b.c.beginPath(); edge(b.c); b.c.clip();
          b.g.beginPath(); edge(b.g); b.g.clip();
          const step = 10 * k, sw = 3 * k;
          for (let d = -H; d < W + H; d += step) {
            B.paper(b, q => {
              q.moveTo(d, 0); q.lineTo(d + sw, 0); q.lineTo(d + sw - H, H); q.lineTo(d - H, H); q.closePath();
            }, COL.p1Dark, 0.75);
          }
          b.c.restore(); b.g.restore();
        } else if (style === 'p2') {
          B.paper(b, edge, COL.p2, 0.55);
          b.c.save(); b.g.save();
          b.c.beginPath(); edge(b.c); b.c.clip();
          b.g.beginPath(); edge(b.g); b.g.clip();
          const step = 12 * k, r = 2.4 * k;
          for (let row = 0, y = 4 * k; y < H; row++, y += step * 0.85) {
            for (let x = (row % 2 ? step * 0.5 : 0); x < W + step; x += step) {
              B.paper(b, q => q.arc(x, y, r, 0, Math.PI * 2), COL.p2Light, 0.25);
            }
          }
          b.c.restore(); b.g.restore();
        } else if (style === 'navy') {
          B.paper(b, edge, PAP[10], 0.65);
          B.paper(b, q => q.arc(W / 2, H / 2, 11 * k, 0, Math.PI * 2), ctx.shade(PAP[10], 0.12), 0.8);
        } else if (style === 'cream') {
          B.paper(b, edge, PAP[0], 0.65);
          b.c.save(); b.c.strokeStyle = 'rgba(66,68,82,0.35)'; b.c.lineWidth = 1.6 * k;
          b.c.beginPath(); b.c.arc(W / 2, H / 2, 11 * k, 0, Math.PI * 2); b.c.stroke(); b.c.restore();
        } else {
          B.paper(b, edge, COL.card, 0.5);
        }
      }, { noMip: true });
      t.lw = lw; t.lh = lh;
      swatchCache[key] = t;
      return t;
    }

    // ---- Origin Postcard (PRD 4.6) ----
    function postcard(gameId, onClose, quiet) {
      const sc = ctx.devPerHud(), W = 1000 * ctx.asp();
      const cw = Math.min(900, W - 40), ch = Math.min(800, 990 - Math.max(130, ctx.topHudBottom() + 18));
      const k = sc, pad = Math.min(54, cw * 0.065);
      const titleStr = NAME[gameId] || gameId;
      const story = STORIES[gameId] || '';
      const homes = HOME[gameId] || [];
      const prog = ctx.prog();
      const doneAll = ctx.Q.get('done') === 'all';
      const tex = ctx.shapeTex(Math.round(cw * sc), Math.round(ch * sc), b => {
        const q = b.c;
        B.paper(b, ctx.wob(3 * k, 3 * k, b.w - 3 * k, b.h - 3 * k, 6 * k, 737 + ctx.sid(gameId)), COL.card, 0.5);
        q.save(); q.strokeStyle = 'rgba(84,80,72,0.22)'; q.lineWidth = 1.6 * k; q.setLineDash([8 * k, 6 * k]);
        q.strokeRect(14 * k, 14 * k, b.w - 28 * k, b.h - 28 * k); q.restore();
        ctx.ink(b, titleStr, pad * k, 64 * k, 46 * k, { maxW: (cw - pad * 2) * k });
        q.save(); q.strokeStyle = PAP[2]; q.lineWidth = 3 * k; q.lineCap = 'round';
        q.beginPath(); q.moveTo(pad * k, 98 * k); q.lineTo((pad + 190) * k, 98 * k); q.stroke(); q.restore();
        // home stamps bottom left
        const sw = 100, sh = 74, sgap = 22;
        const sy = ch - pad - sh - 28;
        homes.forEach((cid, i) => {
          const sx = pad + i * (sw + sgap);
          const built = doneAll || ctx.isBuiltId(prog, cid);
          const cObj = ctx.C[cid];
          const cname = cObj ? ctx.normSaint(cObj.name) : cid;
          if (built && ctx.FL[cid]) {
            B.paper(b, ctx.wob(sx * k, sy * k, (sx + sw) * k, (sy + sh) * k, 2.5 * k, 200 + i * 19), '#fffdf6', 0.62);
            const f = ctx.FL[cid];
            const fh = Math.min((sh - 14), (sw - 14) / f.a);
            const fw = fh * f.a;
            ctx.flagDraw(b, cid, (sx + (sw - fw) / 2) * k, (sy + (sh - fh) / 2) * k, fh * k);
            if (ctx.postmarkDraw) ctx.postmarkDraw(b, (sx + sw - 12) * k, (sy + 14) * k, 16 * k, ctx.sid(cid));
          } else {
            q.save(); q.strokeStyle = COL.pencil; q.lineWidth = 2 * k; q.setLineDash([6 * k, 4 * k]);
            q.strokeRect(sx * k, sy * k, sw * k, sh * k); q.restore();
          }
          ctx.ink(b, cname, (sx + sw / 2) * k, (sy + sh + 20) * k, 22 * k, { align: 'center', maxW: (sw + 14) * k, col: built ? INK : COL.dimInk });
        });
        // body text
        const top = 124, avail = Math.max(80, sy - 24 - top);
        let f = 40, lines = [];
        do {
          f--;
          q.save(); q.font = `800 ${f * k}px ${FONT}`;
          lines = ctx.wrap(q, story, (cw - pad * 2) * k);
          q.restore();
        } while (f > 18 && lines.length * f * 1.38 > avail);
        lines.forEach((ln, i) => ctx.ink(b, ln, pad * k, (top + (i + 0.5) * f * 1.38) * k, f * k));
      }, { noMip: true });
      const topY = Math.max(ctx.topHudBottom() + 14, (1000 - ch) / 2);
      const s = spr(tex, { hud: true, z: 0.16, zr: 0.03, order: 226, x: W / 2, y: topY + ch / 2, w: cw, h: ch, rot: -0.004, lift: 0.35, own: true });
      tw(s, { lift: 0 }, 0.3, { cut: true });
      ctx.setHint('Tap to close');
      if (!quiet) {
        ctx.sfx.turn();
        ctx.speakPhrases([titleStr].concat(ctx.sentences(story)), titleStr + '. ' + story);
      }
      return { s, gameId, onClose, t0: ctx.now() };
    }

    // ---- Press shows, release places (PRD 3.5) ----
    function makePress(cfg) {
      // cfg: { resolve(p), same(a, b), preview(target), clear(), commit(target), reject(p), isBusy() }
      let ptrId = null, downTarget = null, hoverTarget = null;
      return {
        down(e, p) {
          if (cfg.isBusy && cfg.isBusy()) return;
          if (ptrId !== null) { this.cancel(); return; } // second finger cancels
          const tgt = cfg.resolve(p);
          if (tgt === null || tgt === undefined) {
            if (cfg.reject) cfg.reject(p);
            return;
          }
          ptrId = e.pointerId;
          downTarget = tgt;
          hoverTarget = null;
          if (cfg.preview) cfg.preview(tgt);
        },
        move(e, p) {
          if (cfg.isBusy && cfg.isBusy()) {
            if (ptrId !== null || hoverTarget !== null) this.cancel();
            return;
          }
          if (ptrId !== null) {
            if (e.pointerId !== ptrId) return;
            if (downTarget !== null) {
              const tgt = cfg.resolve(p);
              const stillSame = tgt !== null && tgt !== undefined && (cfg.same ? cfg.same(tgt, downTarget) : tgt === downTarget);
              if (!stillSame) {
                downTarget = null;
                if (cfg.clear) cfg.clear();
              }
            }
            return;
          }
          if (e.pointerType === 'mouse' && !e.buttons) {
            const tgt = cfg.resolve(p);
            const eq = (tgt === null || tgt === undefined) && (hoverTarget === null || hoverTarget === undefined)
              || (tgt !== null && tgt !== undefined && hoverTarget !== null && hoverTarget !== undefined && (cfg.same ? cfg.same(tgt, hoverTarget) : tgt === hoverTarget));
            if (!eq) {
              hoverTarget = (tgt !== undefined) ? tgt : null;
              if (hoverTarget !== null) { if (cfg.preview) cfg.preview(hoverTarget); }
              else { if (cfg.clear) cfg.clear(); }
            }
          }
        },
        up(e, p) {
          if (ptrId === null || e.pointerId !== ptrId) return;
          if (cfg.isBusy && cfg.isBusy()) { this.cancel(); return; }
          const tgt = downTarget;
          ptrId = null;
          downTarget = null;
          if (e.type === 'pointercancel' || tgt === null || tgt === undefined) {
            if (cfg.clear) cfg.clear();
            return;
          }
          const upTgt = cfg.resolve(p);
          const ok = upTgt !== null && upTgt !== undefined && (cfg.same ? cfg.same(upTgt, tgt) : upTgt === tgt);
          if (cfg.clear) cfg.clear();
          if (ok && cfg.commit) cfg.commit(tgt);
        },
        cancel() {
          ptrId = null;
          downTarget = null;
          hoverTarget = null;
          if (cfg.clear) cfg.clear();
        },
        active() { return ptrId !== null; }
      };
    }

    // ---- Undo history stack (PRD 3.6) ----
    function makeHist() {
      const stack = [];
      return {
        push(snap) { stack.push(snap); },
        pop() { return stack.pop(); },
        popUntil(pred) {
          let last = null;
          while (stack.length) {
            last = stack.pop();
            if (pred(last)) return last;
          }
          return last;
        },
        clear() { stack.length = 0; },
        len() { return stack.length; },
        peek() { return stack.length ? stack[stack.length - 1] : null; }
      };
    }

    // ---- Sounds (Appendix C) ----
    const snd = {
      slap(quiet) {
        if (quiet) { ctx.noise(0.06, 900, 0.34); ctx.tone(180, 0.08, 'sine', 0.18, 110); }
        else { ctx.noise(0.09, 700, 0.50); ctx.tone(150, 0.12, 'sine', 0.30, 70); }
      },
      clack(i) {
        ctx.tone(Math.min(1160, 760 + 40 * (i || 0)), 0.045, 'triangle', 0.16);
        ctx.noise(0.03, 2600, 0.18);
      },
      store() {
        ctx.tone(520, 0.09, 'triangle', 0.20, 390);
        ctx.noise(0.05, 1200, 0.20);
      },
      extra() {
        ctx.tone(659, 0.30, 'triangle', 0.16);
        after(0.09, () => ctx.tone(880, 0.30, 'triangle', 0.16));
      },
      capture() {
        ctx.tone(392, 0.12, 'triangle', 0.18);
        after(0.07, () => ctx.tone(330, 0.12, 'triangle', 0.18));
        after(0.14, () => { ctx.tone(120, 0.28, 'sine', 0.36, 45); ctx.noise(0.12, 300, 0.28); });
      },
      flip(k) {
        ctx.noise(0.05, 3400, 0.30);
        ctx.tone(420 + 35 * Math.min(k || 1, 12), 0.05, 'triangle', 0.12);
      },
      nope() {
        ctx.noise(0.06, 500, 0.20);
      },
      unwrap() {
        ctx.noise(0.06, 3200, 0.38);
        after(0.06, () => ctx.noise(0.18, 1800, 0.30));
      }
    };

    function displayName(playerObj) {
      if (!playerObj) return 'Friend';
      if (playerObj === 'bot') return 'Paper Bot';
      if (playerObj === 'friend') return 'Friend';
      if (playerObj.name && playerObj.name.trim()) return playerObj.name.trim();
      const t = playerObj.token || 'boat';
      return t[0].toUpperCase() + t.slice(1);
    }

    function turnDisplay(who, swatchStyle, hop) {
      const btn = ctx.playerBtn;
      if (btn) {
        let tex = null;
        if (who === 'bot') tex = tokenBtnTex('bot');
        else if (who === 'friend') tex = tokenBtnTex('friend');
        else if (who && typeof who === 'object' && who.token && ctx.playerBtnTex) tex = ctx.playerBtnTex(who.token);
        else if (typeof who === 'string' && ctx.playerBtnTex) tex = ctx.playerBtnTex(who);
        if (tex) btn.tex = tex;
        if (btn._hopBaseY !== undefined && Math.abs(btn.y - btn._hopBaseY) > 26) {
          delete btn._hopBaseY;
        }
        if (hop && btn.alpha > 0.5) {
          const baseY = btn._hopBaseY !== undefined ? btn._hopBaseY : (btn._hopBaseY = btn.y);
          tw(btn, { y: baseY - 22, lift: 0.24 }, 0.14, {
            cut: true,
            done: () => tw(btn, { y: baseY, lift: 0 }, 0.20, {
              cut: true,
              done: () => { delete btn._hopBaseY; }
            })
          });
        }
      }
      if (swatchStyle) {
        const stex = swatchTex(swatchStyle);
        const swW = 56, swH = 40;
        const W = 1000 * ctx.asp();
        const hintS = ctx.hint ? ctx.hint() : null;
        const visBtn = !!(btn && btn.alpha > 0.5 && (btn.w || 0) > 0 && (btn.h || 0) > 0);
        const visHint = !!(hintS && hintS.alpha > 0.5 && (hintS.w || 0) > 0 && (hintS.h || 0) > 0);
        const visTitle = !!(ctx.title && ctx.title.alpha > 0.5 && (ctx.title.w || 0) > 0 && (ctx.title.h || 0) > 0);
        const btnY = visBtn ? (btn._hopBaseY !== undefined ? btn._hopBaseY : btn.y) : 60;

        const obstacles = [];
        if (visHint) obstacles.push(hintS);
        if (visTitle) obstacles.push(ctx.title);
        if (visBtn) obstacles.push({ x: btn.x, y: btnY, w: btn.w, h: btn.h });
        if (ctx.btn) {
          for (const id of Object.keys(ctx.btn)) {
            const b = ctx.btn[id];
            if (b && b.alpha > 0.5 && (b.w || 0) > 0 && (b.h || 0) > 0) obstacles.push(b);
          }
        }

        const fits = (cx, cy) => {
          if (cx - swW * 0.5 < 8 || cx + swW * 0.5 > W - 8) return false;
          if (cy - swH * 0.5 < 4 || cy + swH * 0.5 > 996) return false;
          for (const o of obstacles) {
            if (Math.abs(cx - o.x) < (swW + o.w) * 0.5 + 6 &&
                Math.abs(cy - o.y) < (swH + o.h) * 0.5 + 4) {
              return false;
            }
          }
          return true;
        };

        const cands = [];
        if (visBtn) {
          cands.push([btn.x + btn.w * 0.5 + 10 + swW * 0.5, btnY]);
        }
        if (visHint) {
          cands.push([hintS.x + hintS.w * 0.5 + 12 + swW * 0.5, hintS.y]);
          cands.push([hintS.x - hintS.w * 0.5 + swW * 0.5, hintS.y + hintS.h * 0.5 + 8 + swH * 0.5]);
        }
        if (visTitle) {
          cands.push([ctx.title.x + ctx.title.w * 0.5 + 12 + swW * 0.5, ctx.title.y]);
        }

        let sx = 0, sy = 0, placed = false;
        for (const [cx, cy] of cands) {
          if (fits(cx, cy)) { sx = cx; sy = cy; placed = true; break; }
        }
        if (!placed) {
          if (visHint) {
            sx = ctx.clamp(hintS.x - hintS.w * 0.5 + swW * 0.5, 8 + swW * 0.5, W - 8 - swW * 0.5);
            sy = hintS.y + hintS.h * 0.5 + 8 + swH * 0.5;
          } else {
            sx = 24 + swW * 0.5;
            sy = (ctx.topHudBottom ? ctx.topHudBottom() : 100) + 8 + swH * 0.5;
          }
        }

        if (!swatchSprite || !sprites.has(swatchSprite)) {
          swatchSprite = spr(stex, { hud: true, z: 0.12, zr: 0.03, order: 215, x: sx, y: sy, w: swW, h: swH, own: false });
        } else {
          swatchSprite.tex = stex;
          swatchSprite.x = sx;
          swatchSprite.y = sy;
        }
      } else if (swatchSprite) {
        kill(swatchSprite);
        swatchSprite = null;
      }
      return swatchSprite;
    }

    function worldTab(label, x, y, o) {
      const opt = o || {};
      const t = ctx.textTex(label, opt.px || 26, {
        strip: opt.colr || COL.tabOn,
        col: opt.ink || COL.ink,
        cut: true,
        seed: opt.seed || ctx.sid(label) + 29,
        scale: opt.scale || 1,
        noMip: true
      });
      const sc = opt.s || 1;
      return spr(t, {
        hud: false, z: opt.z !== undefined ? opt.z : 0.045, zr: 0.05,
        order: opt.order || 120, x: x || 0, y: y || 0,
        w: t.lw * sc, h: t.lh * sc, rot: opt.rot || 0,
        lift: opt.lift || 0, own: true
      });
    }

    return {
      NAME, HOME, FROM, GIFT_LINE, STORIES, COL, GT,
      spr, kill, killAll, sprites,
      job, stepJobs, clearJobs,
      tw, after,
      ensureMat, hideMat,
      cardTex, card, tabTex, tab, tapTab, row, worldTab,
      note, closeNote, ribbon, confetti,
      badge, ensureBadges,
      drawBotToken, drawFriendToken, drawSpecialToken, tokenBtnTex, swatchTex,
      get botTok() { return tokenBtnTex('bot'); },
      get friendTok() { return tokenBtnTex('friend'); },
      postcard, makePress, press: makePress, makeHist, hist: makeHist,
      snd, displayName, turnDisplay,
      rnd, setSeed, setFast, isFast,
      get fast() { return fastMode; },
      set fast(v) { fastMode = !!v; },
      freeSharedCaches,
      botDelay() { return fastMode ? 0 : (0.7 + 0.5 * rnd()); }
    };
  };
})();
