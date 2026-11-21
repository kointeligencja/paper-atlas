(function () {
  'use strict';
  const PG = window.PAPER_GAMES = window.PAPER_GAMES || { logic: {} };

  const MANCALA = { DEPTH: 4 };

  function start(seeds = 4, firstTurn = 1) {
    const s = Number(seeds) || 4;
    return {
      pits: [s, s, s, s, s, s, 0, s, s, s, s, s, s, 0],
      turn: firstTurn,
      over: false,
      winner: 0,
      seeds: s,
    };
  }

  function legal(state, p = state.turn) {
    if (!state || state.over) return [];
    const startIdx = p === 1 ? 0 : 7;
    const out = [];
    for (let i = startIdx; i < startIdx + 6; i++) {
      if (state.pits[i] > 0) out.push(i);
    }
    return out;
  }

  function play(state, pit) {
    if (!state || state.over) return null;
    const p = state.turn;
    const ownStart = p === 1 ? 0 : 7;
    const ownEnd = p === 1 ? 5 : 12;
    if (pit < ownStart || pit > ownEnd || state.pits[pit] <= 0) return null;

    const pits = state.pits.slice();
    const myStore = p === 1 ? 6 : 13;
    const oppStore = p === 1 ? 13 : 6;

    let hand = pits[pit];
    pits[pit] = 0;
    const steps = [];
    let cur = pit;

    while (hand > 0) {
      cur = (cur + 1) % 14;
      if (cur === oppStore) continue;
      pits[cur]++;
      hand--;
      steps.push({ to: cur });
    }

    // Capture check: last seed lands in mover's own previously-empty pit & opposite has >= 1 seed
    if (cur >= ownStart && cur <= ownEnd && pits[cur] === 1) {
      const opp = 12 - cur;
      const oppSeeds = pits[opp];
      if (oppSeeds >= 1) {
        const captured = 1 + oppSeeds;
        pits[cur] = 0;
        pits[opp] = 0;
        pits[myStore] += captured;
        steps.push({ capture: { pit: cur, opposite: opp, n: captured, store: myStore } });
      }
    }

    // End check after captures and before extra turn
    let s1 = 0;
    for (let i = 0; i < 6; i++) s1 += pits[i];
    let s2 = 0;
    for (let i = 7; i < 13; i++) s2 += pits[i];

    if (s1 === 0 || s2 === 0) {
      const sweep = [];
      if (s1 > 0) {
        for (let i = 0; i < 6; i++) {
          if (pits[i] > 0) {
            sweep.push({ from: i, to: 6, n: pits[i] });
            pits[6] += pits[i];
            pits[i] = 0;
          }
        }
      }
      if (s2 > 0) {
        for (let i = 7; i < 13; i++) {
          if (pits[i] > 0) {
            sweep.push({ from: i, to: 13, n: pits[i] });
            pits[13] += pits[i];
            pits[i] = 0;
          }
        }
      }
      if (sweep.length > 0) steps.push({ sweep });
      const winner = pits[6] > pits[13] ? 1 : pits[13] > pits[6] ? 2 : 0;
      return {
        state: {
          pits,
          turn: p,
          over: true,
          winner,
          seeds: state.seeds,
        },
        steps,
      };
    }

    let nextTurn = 3 - p;
    if (cur === myStore) {
      steps.push({ extra: true });
      nextTurn = p;
    }

    return {
      state: {
        pits,
        turn: nextTurn,
        over: false,
        winner: 0,
        seeds: state.seeds,
      },
      steps,
    };
  }

  // Fast simulation for bot search (mutates/copies small Int32Array)
  function simMove(pits, turn, pit) {
    const next = pits.slice();
    const myStore = turn === 1 ? 6 : 13;
    const oppStore = turn === 1 ? 13 : 6;
    const ownStart = turn === 1 ? 0 : 7;
    const ownEnd = turn === 1 ? 5 : 12;

    let hand = next[pit];
    next[pit] = 0;
    let cur = pit;
    while (hand > 0) {
      cur = (cur + 1) % 14;
      if (cur === oppStore) continue;
      next[cur]++;
      hand--;
    }

    if (cur >= ownStart && cur <= ownEnd && next[cur] === 1) {
      const opp = 12 - cur;
      if (next[opp] >= 1) {
        next[myStore] += 1 + next[opp];
        next[cur] = 0;
        next[opp] = 0;
      }
    }

    let s1 = next[0] + next[1] + next[2] + next[3] + next[4] + next[5];
    let s2 = next[7] + next[8] + next[9] + next[10] + next[11] + next[12];
    if (s1 === 0 || s2 === 0) {
      if (s1 > 0) {
        next[6] += s1;
        for (let i = 0; i < 6; i++) next[i] = 0;
      }
      if (s2 > 0) {
        next[13] += s2;
        for (let i = 7; i < 13; i++) next[i] = 0;
      }
      return { pits: next, turn, over: true };
    }

    const nextTurn = cur === myStore ? turn : (3 - turn);
    return { pits: next, turn: nextTurn, over: false };
  }

  function bot(state, level = 'easy', rnd = Math.random) {
    const moves = legal(state);
    if (!moves.length) return null;

    if (level === 'easy') {
      const myStore = state.turn === 1 ? 6 : 13;
      const extraMoves = [];
      for (let i = 0; i < moves.length; i++) {
        const pit = moves[i];
        if ((state.pits[pit] % 13) === (myStore - pit)) extraMoves.push(pit);
      }
      if (extraMoves.length > 0 && rnd() < 0.35) {
        return extraMoves[Math.floor(rnd() * extraMoves.length)];
      }
      return moves[Math.floor(rnd() * moves.length)];
    }

    const me = state.turn;
    const myStore = me === 1 ? 6 : 13;
    const oppStore = me === 1 ? 13 : 6;

    function evaluate(pits, over) {
      if (over) {
        return (pits[myStore] - pits[oppStore]) * 100;
      }
      const s1 = pits[0] + pits[1] + pits[2] + pits[3] + pits[4] + pits[5];
      const s2 = pits[7] + pits[8] + pits[9] + pits[10] + pits[11] + pits[12];
      const mySide = me === 1 ? s1 : s2;
      const oppSide = me === 1 ? s2 : s1;
      return (pits[myStore] - pits[oppStore]) + 0.25 * (mySide - oppSide);
    }

    function alphabeta(pits, turn, depth, alpha, beta) {
      if (depth <= 0) return evaluate(pits, false);
      const startIdx = turn === 1 ? 0 : 7;
      // Order from right to left (closer to store first) for better pruning
      const mvs = [];
      for (let i = startIdx + 5; i >= startIdx; i--) {
        if (pits[i] > 0) mvs.push(i);
      }
      if (mvs.length === 0) return evaluate(pits, true);

      const maximizing = turn === me;
      if (maximizing) {
        let best = -1e9;
        for (let i = 0; i < mvs.length; i++) {
          const child = simMove(pits, turn, mvs[i]);
          const v = child.over
            ? evaluate(child.pits, true)
            : alphabeta(child.pits, child.turn, depth - 1, alpha, beta);
          if (v > best) best = v;
          if (best > alpha) alpha = best;
          if (alpha >= beta) break;
        }
        return best;
      } else {
        let best = 1e9;
        for (let i = 0; i < mvs.length; i++) {
          const child = simMove(pits, turn, mvs[i]);
          const v = child.over
            ? evaluate(child.pits, true)
            : alphabeta(child.pits, child.turn, depth - 1, alpha, beta);
          if (v < best) best = v;
          if (best < beta) beta = best;
          if (alpha >= beta) break;
        }
        return best;
      }
    }

    // Shuffle moves so ties are broken randomly
    const shuffled = moves.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }

    const pits = state.pits;
    const scored = [];
    for (let i = 0; i < shuffled.length; i++) {
      const pit = shuffled[i];
      const child = simMove(pits, me, pit);
      const val = child.over
        ? evaluate(child.pits, true)
        : alphabeta(child.pits, child.turn, MANCALA.DEPTH - 1, -1e9, 1e9);
      scored.push({ pit, val });
    }
    scored.sort((a, b) => b.val - a.val);

    if (scored.length > 1 && rnd() < 0.1) {
      return scored[1].pit;
    }
    return scored[0].pit;
  }

  PG.logic.mancala = {
    DEPTH: MANCALA.DEPTH,
    start,
    legal,
    play,
    bot,
  };
  PG.mancala = function (ctx, K, host) {
    const B = ctx.GFX, PAP = ctx.PAP, CREAM = ctx.CREAM, INK = ctx.INK;
    const L = PG.logic.mancala;
    const GX = K.GT[0], GY = K.GT[1];

    let opt = { players: 1, bot: 'easy', seeds: 4, sit: 'side', path: true, look: 'beans' };
    let state = L.start(4, 1);
    let busy = false;
    let moves = 0;
    let runGen = 0;
    let overShown = false;
    let alive = true;

    const hist = K.makeHist();

    function cloneState(s) {
      return {
        pits: s.pits.slice(),
        turn: s.turn,
        over: !!s.over,
        winner: s.winner || 0,
        seeds: s.seeds || 4,
      };
    }

    function isAcross() {
      return opt.players === 2 && opt.sit === 'across';
    }

    function p1Obj() {
      return ctx.currentPlayer() || { name: 'Player 1', token: 'boat' };
    }

    function p2Obj() {
      if (opt.players === 1) return 'bot';
      return (host && host.p2Choice && host.p2Choice()) || 'friend';
    }

    function nameOf(p) {
      return K.displayName(p === 1 ? p1Obj() : p2Obj());
    }

    function pitCenter(i) {
      if (i >= 0 && i <= 5) return [GX - 300 + 120 * i, GY + 100];
      if (i === 6) return [GX + 420, GY];
      if (i >= 7 && i <= 12) return [GX + 300 - 120 * (i - 7), GY - 100];
      return [GX - 420, GY];
    }

    const BOARD_W = 1024, BOARD_H = 464, BOARD_S = 2;
    const OX = BOARD_W / 2, OY = BOARD_H / 2;

    let page = null;
    let sceneSprs = [];
    let boardSpr = null;
    let ringTex = null;
    let ringSprs = [];
    let turnTab = null;
    let badges = new Array(14).fill(null);
    let dispCounts = new Array(14).fill(0);
    let lastCamKey = '';

    function strokePaper(b, path, col, rel, lw, cap) {
      for (const [x, st] of [[b.c, col], [b.g, B.grey(rel)]]) {
        x.strokeStyle = st;
        x.lineWidth = lw;
        x.lineCap = cap || 'round';
        x.lineJoin = 'round';
        x.beginPath();
        path(x);
        x.stroke();
      }
    }

    function domePaper(b, x, y, r, col, r0, r1, ry) {
      const c = b.c, g = b.g;
      ry = ry || r;
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
      c.fill();
      g.save();
      g.translate(x, y);
      g.scale(1, ry / r);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, B.grey(r1));
      gr.addColorStop(0.6, B.grey(ctx.lerp(r0, r1, 0.75)));
      gr.addColorStop(1, B.grey(r0));
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    function roundRectPath(q, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      q.moveTo(x + rr, y);
      q.lineTo(x + w - rr, y);
      q.quadraticCurveTo(x + w, y, x + w, y + rr);
      q.lineTo(x + w, y + h - rr);
      q.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      q.lineTo(x + rr, y + h);
      q.quadraticCurveTo(x, y + h, x, y + h - rr);
      q.lineTo(x, y + rr);
      q.quadraticCurveTo(x, y, x + rr, y);
      q.closePath();
    }

    function wobRoundRectPath(q, x, y, w, h, r, amp, seed) {
      const rr = Math.min(r, w / 2, h / 2);
      const pts = [];
      const addSeg = (x0, y0, x1, y1, n) => {
        for (let i = 0; i < n; i++) {
          const t = i / n;
          pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
        }
      };
      const addArc = (cx, cy, a0, a1, n) => {
        for (let i = 0; i < n; i++) {
          const a = a0 + (a1 - a0) * (i / n);
          pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
        }
      };
      addSeg(x + rr, y, x + w - rr, y, 22);
      addArc(x + w - rr, y + rr, -Math.PI / 2, 0, 7);
      addSeg(x + w, y + rr, x + w, y + h - rr, 10);
      addArc(x + w - rr, y + h - rr, 0, Math.PI / 2, 7);
      addSeg(x + w - rr, y + h, x + rr, y + h, 22);
      addArc(x + rr, y + h - rr, Math.PI / 2, Math.PI, 7);
      addSeg(x, y + h - rr, x, y + rr, 10);
      addArc(x + rr, y + rr, Math.PI, Math.PI * 1.5, 7);
      for (let i = 0; i < pts.length; i++) {
        const jx = (ctx.hs(i, seed, 1) - 0.5) * 2 * amp;
        const jy = (ctx.hs(i, seed, 2) - 0.5) * 2 * amp;
        if (i === 0) q.moveTo(pts[i][0] + jx, pts[i][1] + jy);
        else q.lineTo(pts[i][0] + jx, pts[i][1] + jy);
      }
      q.closePath();
    }

    function clearScene() {
      for (const s of sceneSprs) K.kill(s);
      sceneSprs.length = 0;
      if (page) { page.destroy(); page = null; }
    }

    function ensureScene() {
      K.hideMat();
      if (page) return;
      page = K.gamePage({ cx: GX, cy: GY - 88, w: 1320, h: 660, frameOrder: 6, tableOrder: -20 });
      const IN = page.in;
      const sx = IN.w / 1434, sy = IN.h / 709;
      const pyMap = py => IN.y0 + (py + 284) * sy;
      const R = ctx.rng(7);

      const SKY = ['#d9607c', '#e87862', '#f09a50', '#f7c45c'];
      const topH = pyMap(-90) - (IN.y0 - 8);
      page.flat(SKY[0], { x: IN.cx, y: IN.y0 - 8 + topH * 0.5, w: IN.w + 28, h: topH, z: 0.04, zr: 0, order: -10 });
      page.strata(SKY[1], pyMap(-236), pyMap(-90), 7 * sy, 1.0, 0.07, -9);
      page.strata(SKY[2], pyMap(-196), pyMap(-90), 6 * sy, 3.4, 0.10, -8);
      page.strata(SKY[3], pyMap(-160), pyMap(-90), 5 * sy, 5.2, 0.13, -7);

      const sunR = 62 * sy, sunSz = 144, sunS = 2;
      const sunTex = ctx.shapeTex(sunSz * sunS, sunSz * sunS, b => {
        b.s = sunS;
        const c = sunSz * sunS * 0.5;
        B.paper(b, q => q.arc(c, c, sunR * sunS, 0, Math.PI * 2), '#ffe9a6', 0.6);
      }, { noMip: true });
      sceneSprs.push(K.spr(sunTex, {
        x: IN.cx - 360 * sx, y: pyMap(-138), w: sunSz, h: sunSz,
        z: 0.15, zr: 0.03, order: -6, own: true,
      }));

      page.strata('#a8527f', pyMap(-142), pyMap(-80), 16 * sy, 0.4, 0.20, -5);
      page.strata('#743a70', pyMap(-118), pyMap(-80), 12 * sy, 2.3, 0.26, -3);
      page.strata('#ecb94c', pyMap(-96), IN.y1 + 6, 7 * sy, 1.0, 0.30, -2, (b, cy) => {
        for (let i = 0; i < 26; i++) {
          const x = -IN.w * 0.5 + 30 * sx + R() * (IN.w - 60 * sx);
          const y = pyMap(-78 + R() * 26) - cy;
          const s = (5 + R() * 5) * sy;
          strokePaper(b, q => {
            q.moveTo(x - s * 0.5, y); q.lineTo(x - s * 0.9, y - s);
            q.moveTo(x, y); q.lineTo(x, y - s * 1.4);
            q.moveTo(x + s * 0.5, y); q.lineTo(x + s, y - s);
          }, R() < 0.5 ? '#d39a30' : '#f6d57c', 0.58, 1.9);
        }
      });
    }

    function bakeBoardTex() {
      const S = BOARD_S;
      const W = BOARD_W * S, H = BOARD_H * S;
      const R = ctx.rng(7);
      const WOOD = '#c26a2d', WOOD_L = '#d98a40', PIT = '#5b2a12', PIT_D = '#431d0b';
      const PR = 50;
      return ctx.shapeTex(W, H, b => {
        b.s = S;
        for (const g of [b.c, b.g]) g.setTransform(S, 0, 0, S, W * 0.5, H * 0.5);

        // Thick wood base with darker bevel rim, no triangle strips
        B.paper(b, q => roundRectPath(q, -504, -208, 1008, 416, 84), '#84421a', 0.42);
        B.paper(b, q => roundRectPath(q, -496, -201, 992, 398, 78), WOOD, 0.86);

        // Subtle horizontal wood grain ink lines
        b.c.save();
        b.c.strokeStyle = 'rgba(110,50,10,0.15)';
        b.c.lineWidth = 1.8;
        b.c.lineCap = 'round';
        b.c.beginPath();
        for (let i = 0; i < 24; i++) {
          const y = -188 + i * 16 + R() * 5;
          b.c.moveTo(-462 + R() * 50, y);
          b.c.bezierCurveTo(-165, y + R() * 12 - 6, 165, y + R() * 12 - 6, 462 - R() * 50, y + R() * 5);
        }
        b.c.stroke();
        b.c.restore();

        // One cut cream rail line along each rail
        strokePaper(b, q => {
          q.moveTo(-355, -180); q.lineTo(355, -180);
          q.moveTo(-355, 180); q.lineTo(355, 180);
        }, '#f3dca4', 0.90, 3.5);

        // 12 deep concave domed pits at (-300 + 120*i, ±100)
        for (let col = 0; col < 6; col++) {
          const px = -300 + 120 * col;
          for (const py of [-100, 100]) {
            B.paper(b, q => q.arc(px, py, PR + 7, 0, Math.PI * 2), WOOD_L, 0.95);
            domePaper(b, px, py, PR, PIT, 0.34, 0.04);
            B.paper(b, q => q.ellipse(px - 8, py - 10, PR * 0.62, PR * 0.5, 0.6, 0, Math.PI * 2), PIT_D, 0.03);
          }
        }

        // 2 deep stores at x = ±420, y = 0
        for (const sx of [-1, 1]) {
          B.paper(b, q => roundRectPath(q, sx * 420 - 52, -152, 104, 304, 52), WOOD_L, 0.95);
          B.paper(b, q => roundRectPath(q, sx * 420 - 44, -144, 88, 288, 44), PIT, 0.10);
          B.paper(b, q => roundRectPath(q, sx * 420 - 33, -134, 62, 260, 30), PIT_D, 0.03);
        }
      }, { noMip: true });
    }

    function bakeRingTex() {
      const sz = 132, S = 2, c = sz * S / 2;
      return ctx.shapeTex(sz * S, sz * S, b => {
        b.s = S;
        strokePaper(b, q => q.arc(c, c, 57 * S, 0, Math.PI * 2), '#fbf3dc', 0.80, 4.5 * S);
      }, { noMip: true });
    }

    function ensureBoard() {
      ensureScene();
      if (!boardSpr) {
        boardSpr = K.spr(bakeBoardTex(), {
          x: GX, y: GY, w: BOARD_W, h: BOARD_H,
          z: 0.95, zr: 0.42, order: 10, own: true,
        });
      }
      if (!ringTex) ringTex = bakeRingTex();
    }

    function moveCam(immediate) {
      ensureScene();
      page.fitCam(immediate);
      lastCamKey = `${ctx.asp().toFixed(3)}|${Math.round(ctx.topHudBottom())}`;
    }

    function badgePos(i) {
      if (i >= 0 && i <= 5) return [GX - 300 + 120 * i + 42, GY + 100 + 44, 30];
      if (i === 6) return [GX + 492, GY + 160, 50];
      if (i >= 7 && i <= 12) return [GX + 300 - 120 * (i - 7) + 42, GY - 100 - 44, 30];
      return [GX - 492, GY - 160, 50];
    }

    function badgeBaseRot(i) {
      const tilt = i === 13 ? -0.12 : i === 6 ? 0.10 : i >= 7 ? 0.10 : -0.08;
      return tilt + ((i >= 7 && isAcross()) ? Math.PI : 0);
    }

    function setBadge(i, n) {
      dispCounts[i] = n;
      if (badges[i]) badges[i].tex = K.badge(n);
    }

    function buildBadges() {
      for (let i = 0; i < 14; i++) {
        if (badges[i]) { K.kill(badges[i]); badges[i] = null; }
        const [bx, by, d] = badgePos(i);
        dispCounts[i] = state.pits[i];
        badges[i] = K.spr(K.badge(state.pits[i]), {
          x: bx, y: by, w: d, h: d,
          z: (i === 6 || i === 13) ? 1.50 : 1.42, zr: 0.03, order: 70,
          rot: badgeBaseRot(i), own: false,
        });
      }
    }

    function clearRings() {
      for (const s of ringSprs) K.kill(s);
      ringSprs.length = 0;
    }

    function showRings() {
      clearRings();
    }

    function clearTurnTab() {
      if (turnTab) { K.kill(turnTab); turnTab = null; }
    }

    function showTurnTab() {
      clearTurnTab();
    }

    const BEAN_COLS = ['#f6ecd2', '#f4c443', '#e5604d', '#1f8f84'];
    const SEED_TEX_W = 34, SEED_TEX_H = 34, SEED_S = 3;
    const FLOOR = 0.99;
    let beanTexs = null;
    let shellTex = null;
    let allSeeds = [];
    let pitSeeds = Array.from({ length: 14 }, () => []);

    function bakeSeedTexs() {
      const W = SEED_TEX_W * SEED_S, H = SEED_TEX_H * SEED_S;
      beanTexs = BEAN_COLS.map(col => ctx.shapeTex(W, H, b => {
        b.s = SEED_S;
        for (const g of [b.c, b.g]) g.setTransform(SEED_S, 0, 0, SEED_S, W * 0.5, H * 0.5);
        domePaper(b, 0, 0, 14.5, col, 0.3, 1);
        B.paper(b, q => q.ellipse(-4.6, -5.3, 3.5, 2.3, -0.7, 0, Math.PI * 2), '#fffaf0', 1);
      }, { noMip: true }));

      shellTex = ctx.shapeTex(W, H, b => {
        b.s = SEED_S;
        const cx = W * 0.5, cy = H * 0.5;
        const rx = 13 * SEED_S, ry = 9.5 * SEED_S;
        B.paper(b, q => q.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2), '#efe6d2', 0.85);
        B.paper(b, q => {
          q.moveTo(cx - rx * 0.68, cy);
          q.quadraticCurveTo(cx, cy - ry * 0.18, cx + rx * 0.68, cy);
          q.quadraticCurveTo(cx, cy + ry * 0.18, cx - rx * 0.68, cy);
          q.closePath();
        }, '#3d2c1e', 0.30);
        b.c.save();
        b.c.strokeStyle = 'rgba(61,44,30,0.48)';
        b.c.lineWidth = 1.5;
        for (let k = -3; k <= 3; k++) {
          const tx = cx + k * 2.5 * SEED_S;
          b.c.beginPath();
          b.c.moveTo(tx, cy - 2.6 * SEED_S);
          b.c.lineTo(tx, cy + 2.6 * SEED_S);
          b.c.stroke();
        }
        b.c.restore();
      }, { noMip: true });
    }

    function seedTexFor(idx) {
      if (!beanTexs) bakeSeedTexs();
      return opt.look === 'shells' ? shellTex : beanTexs[idx % 4];
    }

    function slotPos(pit, n) {
      const [cx, cy] = pitCenter(pit);
      if (pit === 6 || pit === 13) {
        const layer = Math.floor(n / 14);
        const k = n % 14;
        const ox = (k % 2 ? 12 : -12) + (ctx.hs(pit, n, 1) - 0.5) * 10;
        const oy = -100 + (k >> 1) * 32 + (k % 2) * 14 + (ctx.hs(pit, n, 2) - 0.5) * 10;
        const z = FLOOR + Math.min(layer, 3) * 0.03 + (k % 7) * 0.004;
        const order = 12 + layer * 16 + k * 0.25;
        return { x: cx + ox, y: cy + oy, z, order };
      }

      const layer = n < 7 ? 0 : n < 16 ? 1 : 2;
      const m = layer === 0 ? n : (n - 7) % 9;
      const a = m * 2.4 + pit * 0.73 + layer * 0.45 + (ctx.hs(pit, n, 3) - 0.5) * 0.4;
      const d = Math.min(28, (m === 0 && layer === 0 ? 7 : 10) + Math.sqrt(m) * 8.6);
      let fx = Math.cos(a) * d + (ctx.hs(pit, n, 1) - 0.5) * 5;
      let fy = Math.sin(a) * d * 0.94 + (ctx.hs(pit, n, 2) - 0.5) * 5;
      const dist = Math.hypot(fx, fy);
      if (dist > 29) { fx = fx / dist * 29; fy = fy / dist * 29; }
      const z = FLOOR + Math.min(n, 10) * 0.012;
      const order = 12 + Math.min(n, 24) * 0.5;
      return { x: cx + fx, y: cy + fy, z, order };
    }

    function clearSeeds() {
      for (const sd of allSeeds) K.kill(sd.spr);
      allSeeds.length = 0;
      for (let i = 0; i < 14; i++) pitSeeds[i].length = 0;
    }

    function buildSeedsFromState() {
      clearSeeds();
      if (!beanTexs) bakeSeedTexs();
      let idx = 0;
      for (let p = 0; p < 14; p++) {
        const cnt = state.pits[p] | 0;
        for (let slot = 0; slot < cnt; slot++) {
          const pos = slotPos(p, slot);
          const rot = opt.look === 'shells' ? (ctx.hs(idx, 37, 11) - 0.5) * 1.4 : (ctx.hs(idx, 37, 11) - 0.5) * 0.4;
          const s = K.spr(seedTexFor(idx), {
            x: pos.x, y: pos.y, w: SEED_TEX_W, h: SEED_TEX_H,
            z: pos.z, zr: 0.20, order: pos.order, rot, lift: 0, own: false,
          });
          const obj = { id: idx, rot, spr: s };
          allSeeds.push(obj);
          pitSeeds[p].push(obj);
          idx++;
        }
      }
    }

    function placePitSeedsImmediate(p) {
      const arr = pitSeeds[p];
      for (let slot = 0; slot < arr.length; slot++) {
        const sd = arr[slot];
        const pos = slotPos(p, slot);
        ctx.killTw(sd.spr, ['x', 'y', 'z', 'lift', 'rot']);
        sd.spr.x = pos.x;
        sd.spr.y = pos.y;
        sd.spr.z = pos.z;
        sd.spr.order = pos.order;
        sd.spr.lift = 0;
        sd.spr.rot = sd.rot;
      }
    }

    let dotTex = null;
    let starDotTex = null;
    let previewPit = null;
    let previewSprs = [];

    function ensurePreviewTexs() {
      if (!dotTex) {
        dotTex = ctx.shapeTex(44, 44, b => {
          B.paper(b, q => q.arc(22, 22, 14, 0, Math.PI * 2), CREAM, 0.90);
        }, { noMip: true });
      }
      if (!starDotTex) {
        starDotTex = ctx.shapeTex(68, 68, b => {
          B.paper(b, ctx.starPath(34, 34, 28, 12), PAP[5], 0.92);
        }, { noMip: true });
      }
    }

    function rimPos(hollow, lap) {
      const [cx, cy] = pitCenter(hollow);
      const off = lap ? (lap * 16) : 0;
      if (hollow >= 0 && hollow <= 5) return [cx + off, cy - 52];
      if (hollow >= 7 && hollow <= 12) return [cx - off, cy + 52];
      if (hollow === 6) return [cx - 52, cy - off];
      return [cx + 52, cy + off];
    }

    function isHumanTurn() {
      return !state.over && (opt.players === 2 || state.turn === 1);
    }

    function isOwnPit(p, pit) {
      return p === 1 ? (pit >= 0 && pit <= 5) : (pit >= 7 && pit <= 12);
    }

    function hitPitAt(p) {
      if (!p || !p.w) return null;
      const wx = p.w[0], wy = p.w[1];
      const hitR = Math.max(60, 24 / ctx.worldPx());
      let best = null, bestD = hitR + 1e-3;
      for (let i = 0; i < 13; i++) {
        if (i === 6) continue;
        const [cx, cy] = pitCenter(i);
        const d = Math.hypot(wx - cx, wy - cy);
        if (d <= bestD) { bestD = d; best = i; }
      }
      return best;
    }

    function clearPreview() {
      if (previewPit !== null) {
        const arr = pitSeeds[previewPit];
        for (let i = 0; i < arr.length; i++) {
          K.tw(arr[i].spr, { lift: 0 }, 1 / 12, { cut: true });
        }
        previewPit = null;
      }
      for (const s of previewSprs) K.kill(s);
      previewSprs.length = 0;
    }

    function showPreview(pit) {
      clearPreview();
      if (busy || state.over || !isHumanTurn()) return;
      if (!isOwnPit(state.turn, pit) || state.pits[pit] <= 0) return;
      previewPit = pit;
      const arr = pitSeeds[pit];
      for (let i = 0; i < arr.length; i++) {
        K.tw(arr[i].spr, { lift: 0.15 }, 1 / 12, { cut: true });
      }
      if (opt.path === false) return;
      ensurePreviewTexs();
      const sim = L.play(state, pit);
      if (!sim) return;
      const drops = sim.steps.filter(st => st.to !== undefined);
      const seen = new Array(14).fill(0);
      for (let i = 0; i < drops.length; i++) {
        const h = drops[i].to;
        const lap = seen[h]++;
        const [rx, ry] = rimPos(h, lap);
        const isLast = i === drops.length - 1;
        const s = K.spr(isLast ? starDotTex : dotTex, {
          x: rx, y: ry,
          w: isLast ? 34 : 22, h: isLast ? 34 : 22,
          z: isLast ? 1.46 : 1.44, zr: 0.05,
          order: isLast ? 75 : 74,
          lift: 0.14, own: false,
        });
        K.tw(s, { lift: 0 }, 1 / 12, { cut: true });
        previewSprs.push(s);
      }
    }

    function rejectTap(p) {
      if (busy || state.over || !isHumanTurn()) return;
      const pit = hitPitAt(p);
      if (pit === null) return;
      if (!isOwnPit(state.turn, pit)) {
        if (badges[pit]) ctx.startWobble(badges[pit]);
        ctx.setHint(`Those are ${nameOf(3 - state.turn)}'s seeds`);
        K.snd.nope();
      } else if (state.pits[pit] <= 0) {
        ctx.setHint('That pit is empty');
        K.snd.nope();
      }
    }

    function takeUndoSnap() {
      return {
        state: cloneState(state),
        seedPits: pitSeeds.map(arr => arr.map(sd => sd.id)),
        moves,
      };
    }

    function guardAfter(sec, gen, fn) {
      K.after(sec, () => {
        if (!alive || runGen !== gen) return;
        fn();
      });
    }

    function bunchPos(hollow, idx, total) {
      const [cx, cy] = pitCenter(hollow);
      if (total <= 1) return [cx, cy];
      const a = (idx / Math.min(total, 8)) * Math.PI * 2 + idx * 0.4;
      const r = Math.min(14, 5 + Math.floor(idx / 8) * 5);
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }

    function applyMoveInstant(pit, res, mover) {
      // Transfer seed objects faithfully through sow -> capture -> sweep
      const hand = pitSeeds[pit].slice();
      pitSeeds[pit].length = 0;
      const drops = res.steps.filter(st => st.to !== undefined);
      for (let i = 0; i < drops.length; i++) {
        const sd = hand.shift();
        if (sd) pitSeeds[drops[i].to].push(sd);
      }
      const capStep = res.steps.find(st => st.capture);
      if (capStep) {
        const c = capStep.capture;
        while (pitSeeds[c.pit].length) pitSeeds[c.store].push(pitSeeds[c.pit].shift());
        while (pitSeeds[c.opposite].length) pitSeeds[c.store].push(pitSeeds[c.opposite].shift());
      }
      const swStep = res.steps.find(st => st.sweep);
      if (swStep) {
        for (const item of swStep.sweep) {
          while (pitSeeds[item.from].length) pitSeeds[item.to].push(pitSeeds[item.from].shift());
        }
      }
      state = res.state;
      for (let i = 0; i < 14; i++) {
        placePitSeedsImmediate(i);
        setBadge(i, state.pits[i]);
      }
      busy = false;
      const extraStep = res.steps.find(st => st.extra);
      if (capStep) K.snd.capture();
      if (extraStep) K.snd.extra();
      onMoveFinished(mover, !!extraStep);
    }

    let popTabs = [];

    function clearPopTabs() {
      for (const s of popTabs) K.kill(s);
      popTabs.length = 0;
    }

    function popBoardTab(label, x, y, colr, inkCol, rot) {
      const s = K.worldTab(label, x, y, {
        px: 28,
        scale: 2,
        colr,
        ink: inkCol,
        rot: rot || 0,
        z: 1.55,
        order: 130,
        lift: 0.35,
      });
      popTabs.push(s);
      K.tw(s, { lift: 0 }, 2 / 12, { cut: true });
      const gen = runGen;
      if (!K.isFast()) {
        K.after(1.2, () => {
          if (!alive) return;
          const idx = popTabs.indexOf(s);
          if (idx >= 0) popTabs.splice(idx, 1);
          if (!K.sprites.has(s)) return;
          K.tw(s, { lift: 0.35, alpha: 0 }, 2 / 12, {
            cut: true,
            done: () => K.kill(s),
          });
          void gen;
        });
      }
      return s;
    }

    function hopSeedTo(sd, fromPit, toHollow, k, gen, done) {
      setBadge(fromPit, Math.max(0, dispCounts[fromPit] - 1));
      const slot = pitSeeds[toHollow].length;
      pitSeeds[toHollow].push(sd);
      const pos = slotPos(toHollow, slot);
      const midX = (sd.spr.x + pos.x) * 0.5;
      const midY = (sd.spr.y + pos.y) * 0.5;
      sd.spr.order = 95 + (k % 30);
      K.snd.clack(k);
      K.tw(sd.spr, { x: midX, y: midY, lift: 0.6 }, 1 / 12, {
        cut: true,
        done() {
          if (!alive || runGen !== gen) return;
          K.tw(sd.spr, { x: pos.x, y: pos.y, z: pos.z, lift: 0 }, 2 / 12, {
            cut: true,
            done() {
              if (!alive || runGen !== gen) return;
              sd.spr.order = pos.order;
              setBadge(toHollow, dispCounts[toHollow] + 1);
              if (done) done();
            },
          });
        },
      });
    }

    function runCapture(cap, mover, next, gen) {
      const [px] = pitCenter(cap.pit);
      popBoardTab(
        'Capture!',
        px,
        GY,
        mover === 1 ? K.COL.p1 : K.COL.p2,
        CREAM,
        (mover === 2 && isAcross()) ? Math.PI : 0
      );
      const queue = [];
      while (pitSeeds[cap.pit].length) queue.push({ sd: pitSeeds[cap.pit].shift(), from: cap.pit });
      while (pitSeeds[cap.opposite].length) queue.push({ sd: pitSeeds[cap.opposite].shift(), from: cap.opposite });
      if (!queue.length) { next(); return; }

      let landed = 0;
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        guardAfter(i * (2 / 12), gen, () => {
          hopSeedTo(item.sd, item.from, cap.store, i, gen, () => {
            landed++;
            if (landed === queue.length) {
              K.snd.capture();
              guardAfter(2 / 12, gen, next);
            }
          });
        });
      }
    }

    function runSweep(sweep, next, gen) {
      const queue = [];
      for (const entry of sweep) {
        while (pitSeeds[entry.from].length) {
          queue.push({ sd: pitSeeds[entry.from].shift(), from: entry.from, to: entry.to });
        }
      }
      if (!queue.length) { next(); return; }

      let landed = 0;
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        guardAfter(i * (1 / 12), gen, () => {
          hopSeedTo(item.sd, item.from, item.to, i, gen, () => {
            landed++;
            if (landed === queue.length) {
              guardAfter(1 / 12, gen, next);
            }
          });
        });
      }
    }

    function showExtraTurn(mover) {
      const tx = mover === 1 ? GX + 315 : GX - 315;
      popBoardTab(
        'Extra turn!',
        tx,
        GY,
        PAP[5],
        INK,
        (mover === 2 && isAcross()) ? Math.PI : 0
      );
      K.snd.extra();
    }

    function syncTurnUI(hop, customHint) {
      const p = state.turn;
      const who = p === 1 ? p1Obj() : p2Obj();
      if (customHint) {
        ctx.setHint(customHint);
      } else if (!state.over) {
        if (opt.players === 1 && p === 2) ctx.setHint('Paper Bot is thinking');
        else if (moves === 0) ctx.setHint(`${nameOf(p)}, pick one of your pits`);
        else ctx.setHint(`${nameOf(p)}, your turn`);
      }
      if (host && host.onLayout) host.onLayout();
      K.turnDisplay(who, p === 1 ? 'p1' : 'p2', !!hop);
    }

    function scheduleBotIfNeeded() {
      if (state.over || busy || opt.players !== 1 || state.turn !== 2) return;
      const gen = runGen;
      const delay = K.botDelay();
      guardAfter(delay, gen, () => {
        if (state.over || busy || opt.players !== 1 || state.turn !== 2) return;
        const pit = L.bot(state, opt.bot, K.rnd);
        if (pit !== null) commitMove(pit);
      });
    }

    let endRibbon = null;
    let btnAgain = null;
    let btnGames = null;
    let endConfetti = [];

    function clearEndUI() {
      if (endRibbon) { K.kill(endRibbon); endRibbon = null; }
      if (btnAgain) { K.kill(btnAgain); btnAgain = null; }
      if (btnGames) { K.kill(btnGames); btnGames = null; }
      for (const s of endConfetti) K.kill(s);
      endConfetti.length = 0;
    }

    function layoutEndUI() {
      if (!overShown) return;
      const W = 1000 * ctx.asp();
      const ry = Math.max(360, Math.min(470, ctx.topHudBottom() + 220));
      if (endRibbon) {
        endRibbon.x = W / 2;
        endRibbon.y = ry;
      }
      const by = ry + (endRibbon ? endRibbon.h / 2 : 88) + 56;
      const gap = 24;
      if (btnAgain && btnGames) {
        const tot = btnAgain.w + gap + btnGames.w;
        const sc = Math.min(1, (W - 48) / Math.max(1, tot));
        btnAgain.w = btnAgain.bw * sc; btnAgain.h = btnAgain.bh * sc;
        btnGames.w = btnGames.bw * sc; btnGames.h = btnGames.bh * sc;
        const tw_ = btnAgain.w + gap * sc + btnGames.w;
        const x0 = W / 2 - tw_ / 2;
        btnAgain.x = x0 + btnAgain.w / 2; btnAgain.y = by;
        btnGames.x = x0 + btnAgain.w + gap * sc + btnGames.w / 2; btnGames.y = by;
      }
    }

    function showEndScreen(silent) {
      if (!alive || !state.over) return;
      clearEndUI();
      overShown = true;
      const n1 = nameOf(1), n2 = nameOf(2);
      const s1 = state.pits[6], s2 = state.pits[13];
      const line1 = `${n1}: ${s1}   ${n2}: ${s2}`;
      const line2 = state.winner === 0 ? 'A tie! Well played, both' : `${nameOf(state.winner)} wins`;
      const ribCol = state.winner === 1 ? K.COL.p1 : state.winner === 2 ? K.COL.p2 : K.COL.card;

      ctx.setHint(line2);
      endRibbon = K.ribbon([line1, line2], ribCol);
      btnAgain = K.tab('Play again', true, { colr: PAP[6], ink: CREAM, px: 34, order: 230, rot: -0.012 });
      btnGames = K.tab('Games', true, { colr: PAP[8], ink: INK, px: 34, order: 230, rot: 0.014 });
      layoutEndUI();

      if (!silent) {
        const W = 1000 * ctx.asp();
        endConfetti = K.confetti(W / 2, endRibbon ? endRibbon.y : 470, 24, [K.COL.p1, K.COL.p2]);
        if (ctx.sfx && ctx.sfx.wake) ctx.sfx.wake();
        if (state.winner) {
          K.turnDisplay(state.winner === 1 ? p1Obj() : p2Obj(), state.winner === 1 ? 'p1' : 'p2', true);
        }
        if (ctx.speakText) ctx.speakText(`${n1} ${s1}, ${n2} ${s2}. ${line2}`);
        if (host && host.onOver) host.onOver(state.winner);
      }
    }

    function onMoveFinished(mover, isExtra) {
      if (state.over) {
        clearRings();
        clearTurnTab();
        if (host && host.onLayout) host.onLayout();
        if (K.isFast()) {
          showEndScreen(false);
        } else {
          const gen = runGen;
          guardAfter(0.6, gen, () => showEndScreen(false));
        }
        return;
      }
      showRings();
      showTurnTab();
      syncTurnUI(isExtra, isExtra ? `${nameOf(mover)} goes again` : null);
      if (host && host.onLayout) host.onLayout();
      scheduleBotIfNeeded();
    }

    function commitMove(pit) {
      if (busy || state.over) return false;
      const mover = state.turn;
      const res = L.play(state, pit);
      if (!res) return false;

      hist.push(takeUndoSnap());
      if (mover === 1) humanSnaps++;
      clearPreview();
      clearPopTabs();
      clearRings();
      moves++;
      busy = true;
      const gen = ++runGen;

      if (K.isFast()) {
        applyMoveInstant(pit, res, mover);
        return { steps: res.steps };
      }

      const hand = pitSeeds[pit].slice();
      pitSeeds[pit].length = 0;
      setBadge(pit, 0);

      const drops = res.steps.filter(st => st.to !== undefined);
      const total = hand.length;
      const stepSec = total <= 8 ? (2 / 12) : (1 / 12);

      // Phase 1: Lift (2 frames)
      for (let i = 0; i < hand.length; i++) {
        const sd = hand[i];
        const [bx, by] = bunchPos(pit, i, total);
        sd.spr.order = 90 + i;
        K.tw(sd.spr, { x: bx, y: by, lift: 0.5 }, 2 / 12, { cut: true });
      }

      // Phase 2: Sow (one seed per step)
      function doDrop(idx) {
        if (!alive || runGen !== gen) return;
        if (idx >= drops.length) {
          // Wait for last 2-frame drop to land before resolve
          guardAfter(2 / 12, gen, () => {
            const capStep = res.steps.find(st => st.capture);
            const swStep = res.steps.find(st => st.sweep);
            const extraStep = res.steps.find(st => st.extra);
            const afterCap = () => {
              const afterSw = () => {
                state = res.state;
                for (let i = 0; i < 14; i++) setBadge(i, state.pits[i]);
                busy = false;
                if (extraStep && !state.over) showExtraTurn(mover);
                onMoveFinished(mover, !!(extraStep && !state.over));
              };
              if (swStep) runSweep(swStep.sweep, afterSw, gen);
              else afterSw();
            };
            if (capStep) runCapture(capStep.capture, mover, afterCap, gen);
            else afterCap();
          });
          return;
        }

        const to = drops[idx].to;
        const sd = hand.shift();
        // Hop remaining bunch above `to` in 1 frame
        for (let j = 0; j < hand.length; j++) {
          const [bx, by] = bunchPos(to, j, hand.length);
          hand[j].spr.order = 90 + j;
          K.tw(hand[j].spr, { x: bx, y: by, lift: 0.5 }, 1 / 12, { cut: true });
        }

        if (sd) {
          const slot = pitSeeds[to].length;
          pitSeeds[to].push(sd);
          const pos = slotPos(to, slot);
          sd.spr.order = 89;
          if (to === 6 || to === 13) K.snd.store();
          else K.snd.clack(idx);
          K.tw(sd.spr, { x: pos.x, y: pos.y, z: pos.z, lift: 0 }, 2 / 12, {
            cut: true,
            done() {
              if (!alive || runGen !== gen) return;
              sd.spr.order = pos.order;
              setBadge(to, dispCounts[to] + 1);
            },
          });
        }

        if (idx + 1 < drops.length) {
          guardAfter(stepSec, gen, () => doDrop(idx + 1));
        } else {
          doDrop(idx + 1);
        }
      }

      guardAfter(2 / 12, gen, () => doDrop(0));
      return { steps: res.steps };
    }

    const press = K.makePress({
      resolve(p) {
        if (!isHumanTurn()) return null;
        const pit = hitPitAt(p);
        if (pit === null) return null;
        if (!isOwnPit(state.turn, pit) || state.pits[pit] <= 0) return null;
        return pit;
      },
      preview(pit) { showPreview(pit); },
      clear() { clearPreview(); },
      commit(pit) { commitMove(pit); },
      reject(p) { rejectTap(p); },
      isBusy() { return busy || state.over || !isHumanTurn(); },
    });

    let humanSnaps = 0;

    function start(inOpt, info) {
      opt = Object.assign({ players: 1, bot: 'easy', seeds: 4, sit: 'side', path: true, look: 'beans' }, inOpt || {});
      if (ctx.Q.get('look') === 'shells') opt.look = 'shells';
      const starter = (info && info.starter === 2) ? 2 : 1;
      state = L.start(opt.seeds, starter);
      busy = false;
      moves = 0;
      overShown = false;
      humanSnaps = 0;
      hist.clear();
      runGen++;
      press.cancel();
      clearPreview();
      clearPopTabs();
      clearEndUI();
      ensureBoard();
      buildBadges();
      buildSeedsFromState();
      moveCam(!!(info && info.immediate));
      showRings();
      showTurnTab();
      syncTurnUI(false);
      scheduleBotIfNeeded();
    }

    function down(e, p) {
      if (overShown) {
        const hPx = ctx.hudPx();
        if (btnAgain && ctx.hitMin(btnAgain, p.hx, p.hy, 8, hPx, 48)) {
          K.tapTab(btnAgain, 'Play again');
          if (ctx.sfx && ctx.sfx.snap) ctx.sfx.snap();
          if (host && host.again) host.again();
          return;
        }
        if (btnGames && ctx.hitMin(btnGames, p.hx, p.hy, 8, hPx, 48)) {
          K.tapTab(btnGames, 'Games');
          if (host && host.openBox) host.openBox();
          return;
        }
        return;
      }
      press.down(e, p);
    }
    function move(e, p) { if (!overShown) press.move(e, p); }
    function up(e, p) { if (!overShown) press.up(e, p); }
    function cancel() { press.cancel(); }

    function update() {
      for (let i = 0; i < 14; i++) {
        const b = badges[i];
        if (b) b.rot = badgeBaseRot(i) + ctx.wobbleRot(b);
      }
      if (btnAgain) btnAgain.rot = (btnAgain.baseTilt || 0) + ctx.wobbleRot(btnAgain);
      if (btnGames) btnGames.rot = (btnGames.baseTilt || 0) + ctx.wobbleRot(btnGames);
    }

    function layoutHud() {
      const key = `${ctx.asp().toFixed(3)}|${Math.round(ctx.topHudBottom())}`;
      if (lastCamKey && key !== lastCamKey) moveCam(true);
      if (!state.over) {
        const p = state.turn;
        K.turnDisplay(p === 1 ? p1Obj() : p2Obj(), p === 1 ? 'p1' : 'p2', false);
      } else if (state.winner) {
        K.turnDisplay(state.winner === 1 ? p1Obj() : p2Obj(), state.winner === 1 ? 'p1' : 'p2', false);
      }
      layoutEndUI();
    }

    function freeLocalTexs() {
      if (ringTex) { B.freeTex(ringTex); ringTex = null; }
      if (dotTex) { B.freeTex(dotTex); dotTex = null; }
      if (starDotTex) { B.freeTex(starDotTex); starDotTex = null; }
      if (beanTexs) { for (const t of beanTexs) if (t) B.freeTex(t); beanTexs = null; }
      if (shellTex) { B.freeTex(shellTex); shellTex = null; }
    }

    function rebake() {
      if (boardSpr) {
        K.kill(boardSpr);
        boardSpr = null;
      }
      clearScene();
      freeLocalTexs();
      ensureBoard();
      bakeSeedTexs();
      for (const sd of allSeeds) sd.spr.tex = seedTexFor(sd.id);
      buildBadges();
      for (let i = 0; i < 14; i++) setBadge(i, dispCounts[i]);
      if (!state.over && !busy) {
        showRings();
        showTurnTab();
      }
      if (overShown) showEndScreen(true);
      moveCam(true);
    }

    function canUndo() {
      if (busy || state.over || hist.len() <= 0) return false;
      if (opt.players === 1) return humanSnaps > 0;
      return true;
    }

    function undo() {
      if (!canUndo()) return;
      runGen++;
      busy = false;
      press.cancel();
      clearPreview();
      clearPopTabs();
      clearEndUI();
      overShown = false;

      let snap = null;
      if (opt.players === 1) {
        snap = hist.popUntil(s => s.state.turn === 1);
        if (snap && snap.state.turn === 1) humanSnaps = Math.max(0, humanSnaps - 1);
      } else {
        snap = hist.pop();
        if (snap && snap.state.turn === 1) humanSnaps = Math.max(0, humanSnaps - 1);
      }
      if (!snap) return;

      state = cloneState(snap.state);
      moves = snap.moves;
      const byId = new Map();
      for (const sd of allSeeds) byId.set(sd.id, sd);
      let ok = true;
      for (let p = 0; p < 14; p++) {
        pitSeeds[p].length = 0;
        for (const id of snap.seedPits[p]) {
          const sd = byId.get(id);
          if (!sd) { ok = false; break; }
          pitSeeds[p].push(sd);
        }
        if (!ok) break;
      }
      if (!ok) {
        buildSeedsFromState();
      } else {
        for (let p = 0; p < 14; p++) placePitSeedsImmediate(p);
      }
      for (let i = 0; i < 14; i++) setBadge(i, state.pits[i]);
      showRings();
      showTurnTab();
      syncTurnUI(false);
      if (ctx.sfx && ctx.sfx.back) ctx.sfx.back();
      if (host && host.onLayout) host.onLayout();
      scheduleBotIfNeeded();
    }

    function destroy() {
      alive = false;
      runGen++;
      press.cancel();
      clearPreview();
      clearPopTabs();
      clearEndUI();
      clearRings();
      clearTurnTab();
      clearSeeds();
      for (let i = 0; i < 14; i++) { if (badges[i]) { K.kill(badges[i]); badges[i] = null; } }
      if (boardSpr) { K.kill(boardSpr); boardSpr = null; }
      clearScene();
      freeLocalTexs();
      K.turnDisplay(ctx.currentPlayer(), null, false);
      if (ctx.updateHudToken) ctx.updateHudToken();
      K.hideMat();
    }

    const api = {
      state: () => ({
        pits: state.pits.slice(),
        turn: state.turn,
        legal: L.legal(state),
        over: state.over,
        winner: state.winner,
      }),
      set(pits, turn) {
        if (!Array.isArray(pits) || pits.length !== 14) return;
        runGen++;
        busy = false;
        overShown = false;
        press.cancel();
        clearPreview();
        clearPopTabs();
        clearEndUI();
        hist.clear();
        humanSnaps = 0;
        const clean = pits.map(v => Math.max(0, Math.round(Number(v) || 0)));
        state = {
          pits: clean,
          turn: turn === 2 ? 2 : 1,
          over: false,
          winner: 0,
          seeds: opt.seeds,
        };
        buildSeedsFromState();
        for (let i = 0; i < 14; i++) setBadge(i, state.pits[i]);
        showRings();
        showTurnTab();
        syncTurnUI(false);
        if (host && host.onLayout) host.onLayout();
      },
      play(pit) {
        return commitMove(pit);
      },
      bot() {
        if (busy || state.over) return null;
        runGen++;
        const pit = L.bot(state, opt.bot, K.rnd);
        if (pit === null) return null;
        commitMove(pit);
        return pit;
      },
      at(pit) {
        const c = pitCenter(pit);
        const h = ctx.w2h(c[0], c[1]);
        return [h[0] / 1000 * innerHeight, h[1] / 1000 * innerHeight];
      },
    };

    return {
      start, down, move, up, cancel, update, layoutHud, rebake,
      undo, canUndo, destroy,
      turn: () => state.turn,
      winner: () => state.winner,
      busy: () => busy,
      moves: () => moves,
      api,
    };
  };
})();
