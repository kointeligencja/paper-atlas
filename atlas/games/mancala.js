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

    let boardSpr = null;
    let ringTex = null;
    let ringSprs = [];
    let turnTab = null;
    let badges = new Array(14).fill(null);
    let dispCounts = new Array(14).fill(0);
    let lastCamKey = '';

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

    function bakeBoardTex() {
      const S = BOARD_S;
      const sx = x => (OX + x) * S;
      const sy = y => (OY + y) * S;
      return ctx.shapeTex(BOARD_W * S, BOARD_H * S, b => {
        // Clay paper body: 1000 x 440, rounded 40, hand-cut edge, relief 0.80
        B.paper(b, q => wobRoundRectPath(q, sx(-500), sy(-220), 1000 * S, 440 * S, 40 * S, 2.2 * S, 411), '#b8763c', 0.80);

        // Outer rim 14 wide, #8f5527, relief 0.95 (thicker cardboard layer)
        B.paper(b, q => {
          wobRoundRectPath(q, sx(-500), sy(-220), 1000 * S, 440 * S, 40 * S, 2.2 * S, 411);
          roundRectPath(q, sx(-486), sy(-206), 972 * S, 412 * S, 28 * S);
        }, '#8f5527', 0.95, 'evenodd');

        // Pattern bands at y = [-204..-160] and [160..204], x = [-350..350]
        for (const side of [-1, 1]) {
          const yTop = side < 0 ? -204 : 160;
          B.paper(b, q => q.rect(sx(-350), sy(yTop), 700 * S, 44 * S), PAP[5], 0.86);
          const base = 28, nTri = 25;
          const yA = sy(yTop + 4), yB = sy(yTop + 40);
          for (let i = 0; i < nTri; i++) {
            const x0 = sx(-350 + i * base), x1 = sx(-350 + (i + 1) * base), xm = (x0 + x1) * 0.5;
            const col = (i % 2 === 0) ? PAP[10] : PAP[0];
            B.paper(b, q => {
              if (side > 0) { q.moveTo(x0, yB); q.lineTo(x1, yB); q.lineTo(xm, yA); }
              else { q.moveTo(x0, yA); q.lineTo(x1, yA); q.lineTo(xm, yB); }
              q.closePath();
            }, col, 0.88);
          }
        }

        // Row of small cream diamonds (10 x 10) along middle line y = 0
        for (let dx = -300; dx <= 300; dx += 60) {
          const cx = sx(dx), cy = sy(0), r = 7 * S;
          B.paper(b, q => {
            q.moveTo(cx, cy - r); q.lineTo(cx + r, cy); q.lineTo(cx, cy + r); q.lineTo(cx - r, cy); q.closePath();
          }, PAP[0], 0.88);
        }

        // 12 pits: step ring r=52 (#9a5f2d, relief 0.50), floor r=44 (#6e3f1c, relief 0.12)
        for (let col = 0; col < 6; col++) {
          const px = sx(-300 + 120 * col);
          for (const pyWorld of [-100, 100]) {
            const py = sy(pyWorld);
            B.paper(b, q => q.arc(px, py, 52 * S, 0, Math.PI * 2), '#9a5f2d', 0.50);
            B.paper(b, q => q.arc(px, py, 44 * S, 0, Math.PI * 2), '#6e3f1c', 0.12);
          }
        }

        // 2 stores at x = ±420, y = 0: step 104x300 (relief 0.50), floor 88x284 (relief 0.12)
        for (const stX of [-420, 420]) {
          B.paper(b, q => roundRectPath(q, sx(stX - 52), sy(-150), 104 * S, 300 * S, 52 * S), '#9a5f2d', 0.50);
          B.paper(b, q => roundRectPath(q, sx(stX - 44), sy(-142), 88 * S, 284 * S, 44 * S), '#6e3f1c', 0.12);
        }
      }, { noMip: true });
    }

    function bakeRingTex() {
      const sz = 136, S = 2, c = sz * S / 2;
      return ctx.shapeTex(sz * S, sz * S, b => {
        B.paper(b, q => {
          q.arc(c, c, 62 * S, 0, Math.PI * 2);
          q.moveTo(c + 54 * S, c);
          q.arc(c, c, 54 * S, 0, Math.PI * 2, true);
        }, CREAM, 0.90, 'evenodd');
      }, { noMip: true });
    }

    function ensureBoard() {
      K.ensureMat();
      if (!boardSpr) {
        boardSpr = K.spr(bakeBoardTex(), {
          x: GX, y: GY, w: BOARD_W, h: BOARD_H,
          z: 0.10, zr: 0.34, order: 30, own: true,
        });
      }
      if (!ringTex) ringTex = bakeRingTex();
    }

    function fitBoardCam() {
      const topM = Math.min(0.32, (ctx.topHudBottom() + 10) / 1000);
      return ctx.fitCam([GX - 540, GY - 310, GX + 540, GY + 310], { l: 0.02, r: 0.02, t: topM, b: 0.03 }, 0, false);
    }

    function moveCam(immediate) {
      const fc = fitBoardCam();
      lastCamKey = `${ctx.asp().toFixed(3)}|${Math.round(ctx.topHudBottom())}`;
      if (immediate || K.isFast()) {
        ctx.killTw(ctx.cam, ['x', 'y', 'h']);
        ctx.cam.x = fc.x; ctx.cam.y = fc.y; ctx.cam.h = fc.h;
      } else {
        ctx.camTo(fc.x, fc.y, fc.h, 0.9);
      }
    }

    function badgePos(i) {
      if (i >= 0 && i <= 5) return [GX - 300 + 120 * i, GY + 254, 44];
      if (i === 6) return [GX + 420, GY + 254, 60];
      if (i >= 7 && i <= 12) return [GX + 300 - 120 * (i - 7), GY - 254, 44];
      return [GX - 420, GY - 254, 60];
    }

    function badgeBaseRot(i) {
      return (i >= 7 && isAcross()) ? Math.PI : 0;
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
          z: 0.08, zr: 0.05, order: 34,
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
      if (state.over || busy) return;
      const leg = L.legal(state);
      for (let i = 0; i < leg.length; i++) {
        const [px, py] = pitCenter(leg[i]);
        const s = K.spr(ringTex, {
          x: px, y: py, w: 136, h: 136,
          z: 0.38, zr: 0.05, order: 35, lift: 0.25, own: false,
        });
        K.tw(s, { lift: 0 }, 2 / 12, { cut: true });
        ringSprs.push(s);
      }
    }

    function clearTurnTab() {
      if (turnTab) { K.kill(turnTab); turnTab = null; }
    }

    function showTurnTab() {
      clearTurnTab();
      if (state.over) return;
      const p = state.turn;
      turnTab = K.worldTab('Your turn', GX, GY + (p === 1 ? 296 : -296), {
        px: 30,
        scale: 2,
        colr: p === 1 ? K.COL.p1 : K.COL.p2,
        ink: CREAM,
        rot: (p === 2 && isAcross()) ? Math.PI : 0,
        z: 0.08,
        order: 36,
        lift: 0.18,
      });
      K.tw(turnTab, { lift: 0 }, 2 / 12, { cut: true });
    }

    const BEAN_COLS = ['#e9dcc0', '#c9a26b', '#7a8a6a', PAP[3]];
    const SEED_TEX_W = 32, SEED_TEX_H = 26, SEED_S = 3;
    let beanTexs = null;
    let shellTex = null;
    let allSeeds = [];
    let pitSeeds = Array.from({ length: 14 }, () => []);

    function beanPath(q, cx, cy, rx, ry) {
      q.moveTo(cx + rx, cy);
      q.bezierCurveTo(cx + rx, cy - ry * 0.95, cx - rx, cy - ry * 0.95, cx - rx, cy);
      q.bezierCurveTo(cx - rx, cy + ry * 0.95, cx - rx * 0.22, cy + ry * 0.95, cx - rx * 0.14, cy + ry * 0.78);
      q.lineTo(cx, cy + ry * 0.42);
      q.lineTo(cx + rx * 0.16, cy + ry * 0.80);
      q.bezierCurveTo(cx + rx * 0.30, cy + ry * 0.95, cx + rx, cy + ry * 0.95, cx + rx, cy);
      q.closePath();
    }

    function bakeSeedTexs() {
      const W = SEED_TEX_W * SEED_S, H = SEED_TEX_H * SEED_S, cx = W / 2, cy = H / 2;
      beanTexs = BEAN_COLS.map(col => ctx.shapeTex(W, H, b => {
        B.paper(b, q => beanPath(q, cx, cy, 13 * SEED_S, 10 * SEED_S), col, 0.85);
        // Subtle bevel edge line so stacked seeds read clearly
        b.c.save();
        b.c.strokeStyle = 'rgba(42,28,18,0.22)';
        b.c.lineWidth = 1.6;
        b.c.beginPath();
        beanPath(b.c, cx, cy, 12.2 * SEED_S, 9.2 * SEED_S);
        b.c.stroke();
        b.c.restore();
      }, { noMip: true }));

      shellTex = ctx.shapeTex(W, H, b => {
        const rx = 13 * SEED_S, ry = 9 * SEED_S;
        B.paper(b, q => q.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2), '#efe6d2', 0.85);
        // Dark slit along the middle + small cowrie teeth
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
        // Store: 4 cols x 12 rows, pitch 20 x 22, second layer same
        const layer = Math.floor(n / 48);
        const k = n % 48;
        const col = k % 4;
        const row = Math.floor(k / 4);
        let ox = (col - 1.5) * 20;
        const oy = (row - 5.5) * 22;
        if (row === 0 || row === 11) ox *= 0.62;
        else if (row === 1 || row === 10) ox *= 0.88;
        const jx = (ctx.hs(pit, n, 1) - 0.5) * 5;
        const jy = (ctx.hs(pit, n, 2) - 0.5) * 5;
        const z = 0.15 + Math.min(layer, 2) * 0.04;
        const order = 40 + layer * 24 + (k % 24) * 0.5;
        return { x: cx + ox + jx, y: cy + oy + jy, z, order };
      }

      // Pit: seed 0 centre, 1-6 ring r=24, 7-18 layer 2 (z=0.19) rings r=14 (4) & r=30 (8), 19+ layer 3 (z=0.23)
      let ox = 0, oy = 0, layer = 0;
      if (n === 0) {
        ox = 0; oy = 0; layer = 0;
      } else if (n <= 6) {
        const a = ((n - 1) / 6) * Math.PI * 2 + pit * 0.53;
        ox = Math.cos(a) * 24;
        oy = Math.sin(a) * 24;
        layer = 0;
      } else {
        layer = n <= 18 ? 1 : 2;
        const m = (n - 7) % 12;
        const shift = layer === 2 ? 0.28 : 0;
        if (m < 4) {
          const a = (m / 4) * Math.PI * 2 + 0.4 + pit * 0.37 + shift;
          ox = Math.cos(a) * 14;
          oy = Math.sin(a) * 14;
        } else {
          const a = ((m - 4) / 8) * Math.PI * 2 + 0.2 + pit * 0.37 + shift;
          ox = Math.cos(a) * 30;
          oy = Math.sin(a) * 30;
        }
      }
      const jx = (ctx.hs(pit, n, 1) - 0.5) * 8;
      const jy = (ctx.hs(pit, n, 2) - 0.5) * 8;
      let fx = ox + jx, fy = oy + jy;
      const dist = Math.hypot(fx, fy);
      if (dist > 31) { fx = fx / dist * 31; fy = fy / dist * 31; }
      const z = layer === 0 ? 0.15 : layer === 1 ? 0.19 : 0.23;
      const order = 40 + layer * 14 + (n % 14) * 0.5;
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
          const rot = (ctx.hs(idx, 37, 11) - 0.5) * 1.4;
          const s = K.spr(seedTexFor(idx), {
            x: pos.x, y: pos.y, w: SEED_TEX_W, h: SEED_TEX_H,
            z: pos.z, zr: 0.05, order: pos.order, rot, lift: 0, own: false,
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
          z: isLast ? 0.42 : 0.40, zr: 0.05,
          order: isLast ? 39 : 38,
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
        z: 0.48,
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

    function placeSwatch(sw) {
      if (!sw) return;
      const hintS = ctx.hint && ctx.hint();
      const pBtn = ctx.playerBtn;
      const ttl = ctx.title;
      if (pBtn && pBtn.alpha === 0 && ttl && ttl.alpha > 0) {
        sw.x = ttl.x + ttl.w / 2 + sw.w / 2 + 16;
        sw.y = ttl.y;
      }
      if (hintS && hintS.alpha > 0) {
        const dx = Math.abs(sw.x - hintS.x), dy = Math.abs(sw.y - hintS.y);
        if (dx < (sw.w + hintS.w) * 0.5 + 6 && dy < (sw.h + hintS.h) * 0.5 + 4) {
          sw.x = hintS.x + hintS.w / 2 + sw.w / 2 + 12;
          sw.y = hintS.y;
        }
      }
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
      const sw = K.turnDisplay(who, p === 1 ? 'p1' : 'p2', !!hop);
      placeSwatch(sw);
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
          placeSwatch(K.turnDisplay(state.winner === 1 ? p1Obj() : p2Obj(), state.winner === 1 ? 'p1' : 'p2', true));
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
        placeSwatch(K.turnDisplay(p === 1 ? p1Obj() : p2Obj(), p === 1 ? 'p1' : 'p2', false));
      } else if (state.winner) {
        placeSwatch(K.turnDisplay(state.winner === 1 ? p1Obj() : p2Obj(), state.winner === 1 ? 'p1' : 'p2', false));
      }
      layoutEndUI();
    }

    function rebake() {
      if (boardSpr) {
        K.kill(boardSpr);
        boardSpr = null;
      }
      ringTex = null;
      dotTex = null;
      starDotTex = null;
      beanTexs = null;
      shellTex = null;
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
