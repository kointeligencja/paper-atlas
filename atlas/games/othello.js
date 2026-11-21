(function () {
  'use strict';
  const PG = window.PAPER_GAMES = window.PAPER_GAMES || { logic: {} };

  const DIRS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  const W8 = [
    [100, -20, 10,  5,  5, 10, -20, 100],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [ 10,  -2,  1,  1,  1,  1,  -2,  10],
    [  5,  -2,  1,  0,  0,  1,  -2,   5],
    [  5,  -2,  1,  0,  0,  1,  -2,   5],
    [ 10,  -2,  1,  1,  1,  1,  -2,  10],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [100, -20, 10,  5,  5, 10, -20, 100],
  ];

  const W6 = [
    [100, -20, 10, 10, -20, 100],
    [-20, -50, -2, -2, -50, -20],
    [ 10,  -2,  1,  1,  -2,  10],
    [ 10,  -2,  1,  1,  -2,  10],
    [-20, -50, -2, -2, -50, -20],
    [100, -20, 10, 10, -20, 100],
  ];

  function start(N = 8, firstTurn = 1) {
    const n = Number(N) === 6 ? 6 : 8;
    const h = n >> 1;
    const grid = [];
    for (let r = 0; r < n; r++) {
      let row = '';
      for (let c = 0; c < n; c++) {
        if ((r === h - 1 && c === h - 1) || (r === h && c === h)) row += 'o';
        else if ((r === h - 1 && c === h) || (r === h && c === h - 1)) row += 'x';
        else row += '.';
      }
      grid.push(row);
    }
    return {
      n,
      grid,
      turn: firstTurn,
      over: false,
      winner: 0,
    };
  }

  function flips(state, r, c, p = state.turn) {
    if (!state || !state.grid) return [];
    const n = state.n;
    if (r < 0 || r >= n || c < 0 || c >= n) return [];
    if (state.grid[r][c] !== '.') return [];
    const me = p === 1 ? 'x' : 'o';
    const opp = p === 1 ? 'o' : 'x';
    const out = [];
    for (let d = 0; d < 8; d++) {
      const dr = DIRS[d][0], dc = DIRS[d][1];
      let nr = r + dr, nc = c + dc;
      const line = [];
      while (nr >= 0 && nr < n && nc >= 0 && nc < n && state.grid[nr][nc] === opp) {
        line.push([nr, nc]);
        nr += dr;
        nc += dc;
      }
      if (line.length > 0 && nr >= 0 && nr < n && nc >= 0 && nc < n && state.grid[nr][nc] === me) {
        for (let i = 0; i < line.length; i++) out.push(line[i]);
      }
    }
    return out;
  }

  function legal(state, p) {
    if (!state || !state.grid) return [];
    if (state.over && p === undefined) return [];
    const who = p === undefined ? state.turn : p;
    const n = state.n;
    const out = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (state.grid[r][c] === '.' && flips(state, r, c, who).length > 0) {
          out.push([r, c]);
        }
      }
    }
    return out;
  }

  function count(state) {
    let x = 0, o = 0, empty = 0;
    const n = state.n;
    for (let r = 0; r < n; r++) {
      const row = state.grid[r];
      for (let c = 0; c < n; c++) {
        const ch = row[c];
        if (ch === 'x') x++;
        else if (ch === 'o') o++;
        else empty++;
      }
    }
    return { x, o, empty };
  }

  function play(state, r, c) {
    if (!state || state.over) return null;
    const p = state.turn;
    const flipped = flips(state, r, c, p);
    if (!flipped.length) return null;

    const n = state.n;
    const me = p === 1 ? 'x' : 'o';
    const rows = state.grid.map(row => row.split(''));
    rows[r][c] = me;

    const rings = {};
    for (let i = 0; i < flipped.length; i++) {
      const fr = flipped[i][0], fc = flipped[i][1];
      rows[fr][fc] = me;
      const dist = Math.max(Math.abs(fr - r), Math.abs(fc - c));
      if (!rings[dist]) rings[dist] = [];
      rings[dist].push([fr, fc]);
    }

    const nextGrid = rows.map(arr => arr.join(''));
    const probe = { n, grid: nextGrid, turn: p, over: false, winner: 0 };

    const other = 3 - p;
    const otherHas = legal(probe, other).length > 0;
    let nextTurn = other;
    let pass = 0;
    let over = false;
    let winner = 0;

    if (!otherHas) {
      const meHas = legal(probe, p).length > 0;
      if (meHas) {
        nextTurn = p;
        pass = other;
      } else {
        over = true;
        const cnt = count(probe);
        winner = cnt.x > cnt.o ? 1 : cnt.o > cnt.x ? 2 : 0;
      }
    }

    return {
      state: {
        n,
        grid: nextGrid,
        turn: nextTurn,
        over,
        winner,
      },
      flipped,
      rings,
      pass,
      over,
    };
  }

  function bot(state, level = 'easy', rnd = Math.random) {
    const moves = legal(state, state.turn);
    if (!moves.length) return null;

    const n = state.n;
    if (level === 'easy') {
      const nonCorners = [];
      for (let i = 0; i < moves.length; i++) {
        const r = moves[i][0], c = moves[i][1];
        if (!((r === 0 || r === n - 1) && (c === 0 || c === n - 1))) {
          nonCorners.push(moves[i]);
        }
      }
      const pool = nonCorners.length ? nonCorners : moves;
      return pool[Math.floor(rnd() * pool.length)];
    }

    const W = n === 6 ? W6 : W8;
    const me = state.turn;
    const opp = 3 - me;
    const grid = new Int8Array(n * n);
    let emptyCount = 0;
    for (let r = 0; r < n; r++) {
      const row = state.grid[r];
      for (let c = 0; c < n; c++) {
        const ch = row[c];
        const v = ch === 'x' ? 1 : ch === 'o' ? 2 : 0;
        grid[r * n + c] = v;
        if (v === 0) emptyCount++;
      }
    }

    function getLegalIdx(arr, p) {
      const oppP = 3 - p;
      const out = [];
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (arr[r * n + c] !== 0) continue;
          let ok = false;
          for (let d = 0; d < 8; d++) {
            const dr = DIRS[d][0], dc = DIRS[d][1];
            let nr = r + dr, nc = c + dc;
            let seenOpp = false;
            while (nr >= 0 && nr < n && nc >= 0 && nc < n && arr[nr * n + nc] === oppP) {
              seenOpp = true;
              nr += dr;
              nc += dc;
            }
            if (seenOpp && nr >= 0 && nr < n && nc >= 0 && nc < n && arr[nr * n + nc] === p) {
              ok = true;
              break;
            }
          }
          if (ok) out.push(r * n + c);
        }
      }
      return out;
    }

    function applyIdx(arr, idx, p) {
      const next = arr.slice();
      const oppP = 3 - p;
      const r = (idx / n) | 0;
      const c = idx % n;
      next[idx] = p;
      for (let d = 0; d < 8; d++) {
        const dr = DIRS[d][0], dc = DIRS[d][1];
        let nr = r + dr, nc = c + dc;
        let len = 0;
        while (nr >= 0 && nr < n && nc >= 0 && nc < n && next[nr * n + nc] === oppP) {
          len++;
          nr += dr;
          nc += dc;
        }
        if (len > 0 && nr >= 0 && nr < n && nc >= 0 && nc < n && next[nr * n + nc] === p) {
          let fr = r + dr, fc = c + dc;
          for (let k = 0; k < len; k++) {
            next[fr * n + fc] = p;
            fr += dr;
            fc += dc;
          }
        }
      }
      return next;
    }

    function discDiff(arr) {
      let myC = 0, oppC = 0;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === me) myC++;
        else if (arr[i] === opp) oppC++;
      }
      return myC - oppC;
    }

    function evalTerminal(arr) {
      const d = discDiff(arr);
      return d > 0 ? 10000 + d : d < 0 ? -10000 + d : 0;
    }

    function evalHeuristic(arr, myMovesLen, oppMovesLen) {
      let wSum = 0;
      for (let r = 0; r < n; r++) {
        const wRow = W[r];
        const base = r * n;
        for (let c = 0; c < n; c++) {
          const v = arr[base + c];
          if (v === me) wSum += wRow[c];
          else if (v === opp) wSum -= wRow[c];
        }
      }
      return wSum + 5 * (myMovesLen - oppMovesLen);
    }

    function orderMoves(mvs) {
      mvs.sort((a, b) => {
        const wa = W[(a / n) | 0][a % n];
        const wb = W[(b / n) | 0][b % n];
        return wb - wa;
      });
    }

    function endgameAB(arr, turn, alpha, beta) {
      const mvs = getLegalIdx(arr, turn);
      if (mvs.length === 0) {
        const otherMvs = getLegalIdx(arr, 3 - turn);
        if (otherMvs.length === 0) return discDiff(arr);
        return endgameAB(arr, 3 - turn, alpha, beta);
      }
      if (mvs.length > 2) orderMoves(mvs);
      const maximizing = turn === me;
      if (maximizing) {
        let best = -1e9;
        for (let i = 0; i < mvs.length; i++) {
          const next = applyIdx(arr, mvs[i], turn);
          const v = endgameAB(next, 3 - turn, alpha, beta);
          if (v > best) best = v;
          if (best > alpha) alpha = best;
          if (alpha >= beta) break;
        }
        return best;
      } else {
        let best = 1e9;
        for (let i = 0; i < mvs.length; i++) {
          const next = applyIdx(arr, mvs[i], turn);
          const v = endgameAB(next, 3 - turn, alpha, beta);
          if (v < best) best = v;
          if (best < beta) beta = best;
          if (alpha >= beta) break;
        }
        return best;
      }
    }

    function alphabeta(arr, turn, depth, alpha, beta) {
      if (depth <= 0) {
        const myMvs = getLegalIdx(arr, me);
        const oppMvs = getLegalIdx(arr, opp);
        if (myMvs.length === 0 && oppMvs.length === 0) return evalTerminal(arr);
        return evalHeuristic(arr, myMvs.length, oppMvs.length);
      }
      const mvs = getLegalIdx(arr, turn);
      if (mvs.length === 0) {
        const otherMvs = getLegalIdx(arr, 3 - turn);
        if (otherMvs.length === 0) return evalTerminal(arr);
        return alphabeta(arr, 3 - turn, depth - 1, alpha, beta);
      }
      if (mvs.length > 2) orderMoves(mvs);
      const maximizing = turn === me;
      if (maximizing) {
        let best = -1e9;
        for (let i = 0; i < mvs.length; i++) {
          const next = applyIdx(arr, mvs[i], turn);
          const v = alphabeta(next, 3 - turn, depth - 1, alpha, beta);
          if (v > best) best = v;
          if (best > alpha) alpha = best;
          if (alpha >= beta) break;
        }
        return best;
      } else {
        let best = 1e9;
        for (let i = 0; i < mvs.length; i++) {
          const next = applyIdx(arr, mvs[i], turn);
          const v = alphabeta(next, 3 - turn, depth - 1, alpha, beta);
          if (v < best) best = v;
          if (best < beta) beta = best;
          if (alpha >= beta) break;
        }
        return best;
      }
    }

    const rootMvs = [];
    for (let i = 0; i < moves.length; i++) {
      rootMvs.push(moves[i][0] * n + moves[i][1]);
    }
    // Shuffle then stable-sort by weight for random tie breaking and good move ordering
    for (let i = rootMvs.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = rootMvs[i]; rootMvs[i] = rootMvs[j]; rootMvs[j] = t;
    }
    orderMoves(rootMvs);

    const depth = n === 6 ? 4 : 3;
    const useEndgame = emptyCount <= 8;

    let bestScore = -1e9;
    let bestIdxs = [];
    for (let i = 0; i < rootMvs.length; i++) {
      const idx = rootMvs[i];
      const next = applyIdx(grid, idx, me);
      const v = useEndgame
        ? endgameAB(next, opp, -1e9, 1e9)
        : alphabeta(next, opp, depth - 1, -1e9, 1e9);
      if (v > bestScore) {
        bestScore = v;
        bestIdxs = [idx];
      } else if (v === bestScore) {
        bestIdxs.push(idx);
      }
    }

    const chosen = bestIdxs[Math.floor(rnd() * bestIdxs.length)];
    return [(chosen / n) | 0, chosen % n];
  }

  PG.logic.othello = {
    W8,
    W6,
    start,
    flips,
    legal,
    count,
    play,
    bot,
  };

  PG.othello = function (ctx, K, host) {
    const logic = PG.logic.othello;
    const B = ctx.GFX, PAP = ctx.PAP, INK = ctx.INK, CREAM = ctx.CREAM;
    const GT = K.GT;

    let opt = { players: 1, bot: 'easy', size: 8, dots: true, look: 'plain' };
    let navySeat = 1; // 1 = child plays navy, 2 = P2/bot plays navy
    let st = null;
    let moveCount = 0;
    let gen = 0;
    let busyFlag = false;
    let destroyed = false;

    let boardSpr = null;
    let lastPortrait = null;

    const hist = K.makeHist();

    function seatOf(side) { return side === 1 ? navySeat : (3 - navySeat); }
    function isBotSide(side) { return opt.players === 1 && seatOf(side) === 2; }
    function whoOfSide(side) {
      if (seatOf(side) === 1) return ctx.currentPlayer() || 'boat';
      if (opt.players === 1) return 'bot';
      const p2 = host.p2Choice && host.p2Choice();
      return (p2 && p2.player) || 'friend';
    }
    function nameOfSide(side) { return K.displayName(whoOfSide(side)); }

    function cloneState(s) {
      return { n: s.n, grid: s.grid.slice(), turn: s.turn, over: s.over, winner: s.winner };
    }

    function isPortrait() { return ctx.asp() < 0.9; }
    function sqSize() { return 800 / (st ? st.n : opt.size); }
    function sqCenter(r, c) {
      const sq = sqSize();
      return [GT[0] - 400 + (c + 0.5) * sq, GT[1] - 400 + (r + 0.5) * sq];
    }
    function sqScreen(r, c) {
      const p = sqCenter(r, c);
      const h = ctx.w2h(p[0], p[1]);
      return [h[0] / 1000 * innerHeight, h[1] / 1000 * innerHeight];
    }

    // Hand-cut rounded rectangle path
    function roundedCutPath(x0, y0, x1, y1, rad, amp, seed) {
      return q => {
        const r = Math.min(rad, (x1 - x0) * 0.45, (y1 - y0) * 0.45);
        const seg = (ax, ay, bx, by, idx) => {
          const steps = 6;
          for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            let px = ax + (bx - ax) * t;
            let py = ay + (by - ay) * t;
            if (i < steps) {
              const nx = -(by - ay), ny = (bx - ax);
              const nl = Math.hypot(nx, ny) || 1;
              const j = (ctx.hs(idx * 17 + i, seed, 1) - 0.5) * amp;
              px += (nx / nl) * j;
              py += (ny / nl) * j;
            }
            q.lineTo(px, py);
          }
        };
        q.moveTo(x0 + r, y0);
        seg(x0 + r, y0, x1 - r, y0, 1);
        q.quadraticCurveTo(x1, y0, x1, y0 + r);
        seg(x1, y0 + r, x1, y1 - r, 2);
        q.quadraticCurveTo(x1, y1, x1 - r, y1);
        seg(x1 - r, y1, x0 + r, y1, 3);
        q.quadraticCurveTo(x0, y1, x0, y1 - r);
        seg(x0, y1 - r, x0, y0 + r, 4);
        q.quadraticCurveTo(x0, y0, x0 + r, y0);
        q.closePath();
      };
    }

    function bakeBoardTex(n) {
      const W = 1800, H = 1800, PPU = 2; // 900x900 world units at 2 px/unit
      const framePad = 8; // 4 world units outer margin inside canvas for hand-cut edge
      const fx0 = framePad, fy0 = framePad, fx1 = W - framePad, fy1 = H - framePad;
      const framePath = roundedCutPath(fx0, fy0, fx1, fy1, 24 * PPU, 4.5, 610 + n);
      const feltX = 50 * PPU, feltY = 50 * PPU, feltW = 800 * PPU, feltH = 800 * PPU;
      const sq = feltW / n;

      return ctx.shapeTex(W, H, b => {
        // 1. Kraft frame (relief 0.90)
        B.paper(b, framePath, '#cdb995', 0.90);

        // 2. Sage green felt (800x800, relief 0.45)
        B.paper(b, ctx.wob(feltX, feltY, feltX + feltW, feltY + feltH, 3.5, 631 + n), '#5e8f66', 0.45);

        // 3. Stitched cream grid lines (colour only, no relief)
        const c = b.c;
        c.save();
        c.strokeStyle = PAP[0];
        c.globalAlpha = 0.85;
        c.lineWidth = 3 * PPU;
        c.lineCap = 'round';
        c.setLineDash([14 * PPU, 8 * PPU]);
        for (let i = 1; i < n; i++) {
          const x = feltX + i * sq;
          c.beginPath();
          c.moveTo(x, feltY + 6 * PPU);
          c.lineTo(x, feltY + feltH - 6 * PPU);
          c.stroke();
          const y = feltY + i * sq;
          c.beginPath();
          c.moveTo(feltX + 6 * PPU, y);
          c.lineTo(feltX + feltW - 6 * PPU, y);
          c.stroke();
        }
        c.restore();

        // 4. Four corner cream pencil stars (radius 0.14 of a square, colour only)
        const starR = 0.14 * sq;
        const corners = [[0, 0], [0, n - 1], [n - 1, 0], [n - 1, n - 1]];
        c.save();
        c.fillStyle = PAP[0];
        c.globalAlpha = 0.65;
        for (const [cr, cc] of corners) {
          const sx = feltX + (cc + 0.5) * sq;
          const sy = feltY + (cr + 0.5) * sq;
          c.beginPath();
          ctx.starPath(sx, sy, starR, starR * 0.45)(c);
          c.fill();
        }
        c.restore();

        // 5. Four photo corners on the frame (PAP[5] ochre, legs 70 units, relief 0.97)
        const leg = 70 * PPU;
        b.c.save(); b.g.save();
        b.c.beginPath(); framePath(b.c); b.c.clip();
        b.g.beginPath(); framePath(b.g); b.g.clip();
        const triCorners = [
          [[fx0, fy0], [fx0 + leg, fy0], [fx0, fy0 + leg]],
          [[fx1, fy0], [fx1 - leg, fy0], [fx1, fy0 + leg]],
          [[fx0, fy1], [fx0 + leg, fy1], [fx0, fy1 - leg]],
          [[fx1, fy1], [fx1 - leg, fy1], [fx1, fy1 - leg]],
        ];
        for (const pts of triCorners) {
          B.paper(b, q => {
            q.moveTo(pts[0][0], pts[0][1]);
            q.lineTo(pts[1][0], pts[1][1]);
            q.lineTo(pts[2][0], pts[2][1]);
            q.closePath();
          }, PAP[5], 0.97);
        }
        b.c.restore(); b.g.restore();
      });
    }

    function buildBoard() {
      if (boardSpr) { K.kill(boardSpr); boardSpr = null; }
      const tex = bakeBoardTex(st.n);
      boardSpr = K.spr(tex, {
        x: GT[0], y: GT[1], w: 900, h: 900,
        z: 0.10, zr: 0.20, order: 30, own: true,
      });
    }

    function frameCamera(immediate) {
      const portrait = isPortrait();
      lastPortrait = portrait;
      const topM = (ctx.topHudBottom() + 10) / 1000;
      let box, mar;
      if (portrait) {
        box = [GT[0] - 480, GT[1] - 660, GT[0] + 480, GT[1] + 660];
        mar = { l: 0.02, r: 0.02, t: topM, b: 0.03 };
      } else if (ctx.PHONE) {
        box = [GT[0] - 720, GT[1] - 455, GT[0] + 720, GT[1] + 455];
        mar = { l: 0.02, r: 0.02, t: topM, b: 0.015 };
      } else {
        box = [GT[0] - 720, GT[1] - 480, GT[0] + 720, GT[1] + 480];
        mar = { l: 0.02, r: 0.02, t: topM, b: 0.03 };
      }
      const f = ctx.fitCam(box, mar, 0, false);
      if (immediate || K.fast) {
        ctx.killTw(ctx.cam);
        ctx.cam.x = f.x;
        ctx.cam.y = f.y;
        ctx.cam.h = f.h;
      } else {
        ctx.camTo(f.x, f.y, f.h, 0.9);
      }
    }

    // ---- Discs & Trays (PRD 8.2) ----
    let discTex = { 1: null, 2: null };
    let discGrid = []; // 2D array [r][c] -> sprite | null
    let traySpr = { 1: null, 2: null };
    let badgeSpr = { 1: null, 2: null };
    let miniSprs = { 1: [], 2: [] };
    let turnTabSpr = null;

    function freeDiscTex() {
      for (const s of [1, 2]) {
        if (discTex[s]) { B.freeTex(discTex[s]); discTex[s] = null; }
      }
    }

    function bakeDiscTex(side, look) {
      const S = 200, cx = S / 2, cy = S / 2, R = 90;
      const base = side === 1 ? PAP[10] : PAP[0];
      const rim = ctx.shade(base, side === 1 ? -0.22 : -0.14);
      return ctx.shapeTex(S, S, b => {
        B.paper(b, q => q.arc(cx, cy, R, 0, Math.PI * 2), rim, 0.78);
        B.paper(b, q => q.arc(cx, cy, R - 9, 0, Math.PI * 2), base, 0.80);
        if (look === 'sunmoon') {
          if (side === 2) {
            // 12-ray embossed sun (relief +0.12)
            const sunCol = ctx.shade(PAP[0], -0.05);
            const rel = 0.92;
            B.paper(b, q => q.arc(cx, cy, 22, 0, Math.PI * 2), sunCol, rel);
            for (let i = 0; i < 12; i++) {
              const a = (i / 12) * Math.PI * 2;
              const aL = a - 0.14, aR = a + 0.14;
              B.paper(b, q => {
                q.moveTo(cx + Math.cos(a) * 56, cy + Math.sin(a) * 56);
                q.lineTo(cx + Math.cos(aL) * 28, cy + Math.sin(aL) * 28);
                q.lineTo(cx + Math.cos(aR) * 28, cy + Math.sin(aR) * 28);
                q.closePath();
              }, sunCol, rel);
            }
          } else {
            // Embossed crescent moon (relief +0.12)
            const moonCol = ctx.shade(PAP[10], 0.12);
            const rel = 0.92;
            const R1 = 42, R2 = 35, dx = 18;
            const ix = (R1 * R1 - R2 * R2 + dx * dx) / (2 * dx);
            const iy = Math.sqrt(Math.max(1, R1 * R1 - ix * ix));
            const t1 = Math.atan2(iy, ix);
            const t2 = Math.atan2(iy, ix - dx);
            const rot = -0.35;
            b.c.save(); b.g.save();
            b.c.translate(cx, cy); b.c.rotate(rot);
            b.g.translate(cx, cy); b.g.rotate(rot);
            B.paper(b, q => {
              q.arc(0, 0, R1, t1, -t1, false);
              q.arc(dx, 0, R2, -t2, t2, true);
              q.closePath();
            }, moonCol, rel);
            b.c.restore(); b.g.restore();
          }
        }
      });
    }

    function ensureDiscTextures() {
      freeDiscTex();
      discTex[1] = bakeDiscTex(1, opt.look);
      discTex[2] = bakeDiscTex(2, opt.look);
    }

    function discWorldSize() {
      // Disc radius is 90/100 of half texture; target radius = 0.39 * sq
      return sqSize() * (0.39 * 2 / 0.90);
    }

    function clearDiscs() {
      for (let r = 0; r < discGrid.length; r++) {
        for (let c = 0; c < discGrid[r].length; c++) {
          if (discGrid[r][c]) K.kill(discGrid[r][c]);
        }
      }
      discGrid = [];
    }

    function makeDiscSpr(r, c, side, extra) {
      const p = sqCenter(r, c);
      const sz = discWorldSize();
      return K.spr(discTex[side], Object.assign({
        x: p[0], y: p[1], w: sz, h: sz,
        z: 0.21, zr: 0.10, order: 40, sx: 1, own: false,
      }, extra || {}));
    }

    function syncDiscsFromState() {
      clearDiscs();
      const n = st.n;
      for (let r = 0; r < n; r++) {
        const row = [];
        for (let c = 0; c < n; c++) {
          const ch = st.grid[r][c];
          if (ch === 'x') row.push(makeDiscSpr(r, c, 1));
          else if (ch === 'o') row.push(makeDiscSpr(r, c, 2));
          else row.push(null);
        }
        discGrid.push(row);
      }
    }

    function trayPos(side) {
      if (isPortrait()) return [GT[0], GT[1] + (side === 1 ? -560 : 560)];
      return [GT[0] + (side === 1 ? -610 : 610), GT[1]];
    }

    function miniPos(side, idx) {
      const tp = trayPos(side);
      if (isPortrait()) {
        const col = idx % 8, row = (idx / 8) | 0;
        return [tp[0] - 90 + col * 36, tp[1] + (row - 1.5) * 29];
      }
      const col = idx % 4, row = (idx / 4) | 0;
      return [tp[0] + (col - 1.5) * 29, tp[1] - 100 + row * 36];
    }

    function clearTrays() {
      for (const s of [1, 2]) {
        if (traySpr[s]) { K.kill(traySpr[s]); traySpr[s] = null; }
        if (badgeSpr[s]) { K.kill(badgeSpr[s]); badgeSpr[s] = null; }
        for (const m of miniSprs[s]) K.kill(m);
        miniSprs[s] = [];
      }
      if (turnTabSpr) { K.kill(turnTabSpr); turnTabSpr = null; }
    }

    function buildTrays() {
      clearTrays();
      const portrait = isPortrait();
      const tw = portrait ? 420 : 150;
      const th = portrait ? 150 : 420;
      const cnt = logic.count(st);
      const counts = { 1: cnt.x, 2: cnt.o };
      for (const s of [1, 2]) {
        const tp = trayPos(s);
        const tex = ctx.shapeTex(tw * 2, th * 2, b => {
          B.paper(b, roundedCutPath(6, 6, tw * 2 - 6, th * 2 - 6, 20, 4, 710 + s), '#cdb995', 0.55);
        });
        traySpr[s] = K.spr(tex, {
          x: tp[0], y: tp[1], w: tw, h: th,
          z: 0.08, zr: 0.10, order: 25, own: true,
        });
        const bx = portrait ? tp[0] - 160 : tp[0];
        const by = portrait ? tp[1] : tp[1] - 158;
        badgeSpr[s] = K.spr(K.badge(counts[s]), {
          x: bx, y: by, w: 60, h: 60,
          z: 0.14, zr: 0.06, order: 35, own: false,
        });
        miniSprs[s] = [];
      }
      syncTally(false);
      updateTurnTab();
    }

    function syncTally(animate) {
      if (!st) return;
      const cnt = logic.count(st);
      const counts = { 1: cnt.x, 2: cnt.o };
      const miniSz = 28; // radius ~12.6 at 0.90 fill — fits 4x8 / 8x4 cleanly inside tray
      for (const s of [1, 2]) {
        if (badgeSpr[s]) badgeSpr[s].tex = K.badge(counts[s]);
        const want = Math.min(32, Math.ceil(counts[s] / 2));
        const arr = miniSprs[s];
        while (arr.length < want) {
          const mp = miniPos(s, arr.length);
          const m = K.spr(discTex[s], {
            x: mp[0], y: mp[1], w: miniSz, h: miniSz,
            z: 0.15, zr: 0.06, order: 36,
            lift: (animate && !K.fast) ? 0.35 : 0, own: false,
          });
          if (animate && !K.fast) K.tw(m, { lift: 0 }, 2 / 12, { cut: true });
          arr.push(m);
        }
        while (arr.length > want) {
          const m = arr.pop();
          if (animate && !K.fast) {
            K.tw(m, { lift: 0.35 }, 2 / 12, { cut: true, done: () => K.kill(m) });
          } else {
            K.kill(m);
          }
        }
      }
    }

    function updateTurnTab() {
      if (turnTabSpr) { K.kill(turnTabSpr); turnTabSpr = null; }
      if (!st || st.over) return;
      const side = st.turn;
      const tp = trayPos(side);
      const portrait = isPortrait();
      const tx = portrait ? GT[0] + 328 : tp[0];
      const ty = portrait ? tp[1] : tp[1] + 252;
      turnTabSpr = K.worldTab('Your turn', tx, ty, {
        colr: side === 1 ? PAP[10] : PAP[0],
        ink: side === 1 ? CREAM : INK,
        px: 30, z: 0.16, order: 45, s: 1,
      });
    }

    // ---- Move Dots, Preview & Input (PRD 8.3) ----
    let dotTex = null;
    let dotSprs = []; // { r, c, s }
    let previewSpr = null;
    let wobbledDiscs = [];

    function ensureDotTex() {
      if (dotTex) { B.freeTex(dotTex); dotTex = null; }
      dotTex = ctx.shapeTex(64, 64, b => {
        B.paper(b, q => q.arc(32, 32, 26, 0, Math.PI * 2), '#4b7553', 0.2);
        const c = b.c;
        c.save();
        c.fillStyle = 'rgba(42,42,48,0.55)';
        c.beginPath();
        c.arc(32, 32, 21, 0, Math.PI * 2);
        c.fill();
        c.restore();
      });
    }

    function clearDots() {
      for (const d of dotSprs) K.kill(d.s);
      dotSprs = [];
    }

    function showDots() {
      clearDots();
      if (!st || st.over || busyFlag || !opt.dots || isBotSide(st.turn)) return;
      const moves = logic.legal(st);
      const sz = sqSize() * (0.09 * 2 / (21 / 32)); // pencil dot radius = 0.09 * sq
      for (let i = 0; i < moves.length; i++) {
        const r = moves[i][0], c = moves[i][1];
        const p = sqCenter(r, c);
        const s = K.spr(dotTex, {
          x: p[0], y: p[1], w: sz, h: sz,
          z: 0.14, zr: 0.04, order: 34, own: false,
        });
        dotSprs.push({ r, c, s });
      }
    }

    function clearPreview() {
      if (previewSpr) { K.kill(previewSpr); previewSpr = null; }
      for (const ds of wobbledDiscs) {
        ctx.killTw(ds, ['rot', 'lift']);
        ds.rot = 0;
        ds.lift = 0;
      }
      wobbledDiscs = [];
    }

    function wobbleDisc(ds) {
      if (!ds) return;
      wobbledDiscs.push(ds);
      if (K.fast) return;
      K.tw(ds, { rot: 0.16, lift: 0.12 }, 1 / 12, {
        cut: true,
        done: () => K.tw(ds, { rot: -0.12, lift: 0.06 }, 1 / 12, {
          cut: true,
          done: () => K.tw(ds, { rot: 0, lift: 0 }, 1 / 12, { cut: true }),
        }),
      });
    }

    function previewSquare(tgt) {
      clearPreview();
      if (!st || st.over || busyFlag || isBotSide(st.turn)) return;
      previewSpr = makeDiscSpr(tgt.r, tgt.c, st.turn, {
        lift: 0.5, order: 60, alpha: 0.92,
      });
      const fl = logic.flips(st, tgt.r, tgt.c);
      for (let i = 0; i < fl.length; i++) {
        const fr = fl[i][0], fc = fl[i][1];
        const ds = discGrid[fr] && discGrid[fr][fc];
        if (ds) wobbleDisc(ds);
      }
    }

    function wobbleNearestDots(wx, wy) {
      if (!dotSprs.length || K.fast) return;
      const ranked = dotSprs.slice().sort((a, b) => {
        const da = Math.hypot(a.s.x - wx, a.s.y - wy);
        const db = Math.hypot(b.s.x - wx, b.s.y - wy);
        return da - db;
      });
      const lim = Math.min(3, ranked.length);
      for (let i = 0; i < lim; i++) {
        const s = ranked[i].s;
        K.tw(s, { sc: 1.45, lift: 0.14 }, 1 / 12, {
          cut: true,
          done: () => K.tw(s, { sc: 0.88, lift: 0.04 }, 1 / 12, {
            cut: true,
            done: () => K.tw(s, { sc: 1, lift: 0 }, 1 / 12, { cut: true }),
          }),
        });
      }
    }

    function resolveSquare(p) {
      if (!st || st.over || busyFlag || isBotSide(st.turn) || !p || !p.w) return null;
      const wx = p.w[0], wy = p.w[1];
      const sq = sqSize(), n = st.n;
      const c = Math.floor((wx - (GT[0] - 400)) / sq);
      const r = Math.floor((wy - (GT[1] - 400)) / sq);
      if (r >= 0 && r < n && c >= 0 && c < n && logic.flips(st, r, c).length > 0) {
        return { r, c };
      }
      // Phone / small target snap: nearest LEGAL square within 30 px (PRD 8.2)
      const wpx = ctx.worldPx ? ctx.worldPx() : 1;
      if (ctx.PHONE || sq * wpx < 48) {
        const moves = logic.legal(st);
        let best = null, bestD = 30.001;
        for (let i = 0; i < moves.length; i++) {
          const mr = moves[i][0], mc = moves[i][1];
          const sp = sqCenter(mr, mc);
          const dPx = Math.hypot(wx - sp[0], wy - sp[1]) * wpx;
          if (dPx < bestD) { bestD = dPx; best = { r: mr, c: mc }; }
        }
        if (best) return best;
      }
      return null;
    }

    function rejectTap(p) {
      if (!st || st.over || busyFlag || isBotSide(st.turn) || !p || !p.w) return;
      const wx = p.w[0], wy = p.w[1];
      const sq = sqSize(), n = st.n;
      const c = Math.floor((wx - (GT[0] - 400)) / sq);
      const r = Math.floor((wy - (GT[1] - 400)) / sq);
      if (r < 0 || r >= n || c < 0 || c >= n) return;
      if (st.grid[r][c] !== '.') return; // occupied square -> nothing
      K.snd.nope();
      wobbleNearestDots(wx, wy);
      const msg = opt.dots ? 'Pick a square with a dot' : 'That move turns nothing over';
      ctx.setHint(msg);
      if (ctx.speakText) ctx.speakText(msg);
    }

    let commitMoveFn = null;

    const presser = K.makePress({
      resolve: resolveSquare,
      same: (a, b) => a.r === b.r && a.c === b.c,
      preview: previewSquare,
      clear: clearPreview,
      commit: tgt => { if (commitMoveFn) commitMoveFn(tgt.r, tgt.c); },
      reject: rejectTap,
      isBusy: () => !st || st.over || busyFlag || isBotSide(st.turn),
    });

    // ---- Placing, Flip Cascade & Pass Notice (PRD 8.3, 8.4) ----
    let anim = null;
    let enterTurnFn = null;
    let onGameOverFn = null;

    function applyAnimStep(a, step) {
      // Drop frames 0..3
      if (step === 0) a.placed.lift = 0.50;
      else if (step === 1) a.placed.lift = 0.30;
      else if (step === 2) a.placed.lift = 0.12;
      else if (step === 3) {
        a.placed.lift = 0;
        a.placed.order = 40;
        K.snd.slap(true);
      }

      // Rings: each turn takes 4 frames:
      // rel 0: sx=0.5, lift=0.2 (play flip(k))
      // rel 1: sx=0.08, lift=0.3 (swap texture!)
      // rel 2: sx=0.5, lift=0.2
      // rel 3: sx=1.0, lift=0.0 (flat)
      for (let i = 0; i < a.rings.length; i++) {
        const ring = a.rings[i];
        const rel = step - ring.startF;
        if (rel === 0) {
          K.snd.flip(ring.k);
          for (const ds of ring.discs) { ds.sx = 0.5; ds.lift = 0.2; ds.order = 52; }
        } else if (rel === 1) {
          for (const ds of ring.discs) { ds.sx = 0.08; ds.lift = 0.3; ds.tex = discTex[a.side]; }
        } else if (rel === 2) {
          for (const ds of ring.discs) { ds.sx = 0.5; ds.lift = 0.2; }
        } else if (rel === 3) {
          for (const ds of ring.discs) { ds.sx = 1; ds.lift = 0; ds.order = 40; }
        }
      }
    }

    function finishMove(res) {
      syncTally(true);
      if (res.over) {
        busyFlag = false;
        updateTurnTab();
        if (onGameOverFn) onGameOverFn();
        return;
      }
      if (res.pass) {
        const passedName = nameOfSide(res.pass);
        const againName = nameOfSide(st.turn);
        K.note('No moves for ' + passedName, againName + ' goes again', 1.8);
        ctx.setHint(againName + ' goes again');
        if (ctx.speakText) ctx.speakText('No moves for ' + passedName + '. ' + againName + ' goes again');
        const myGen = gen;
        busyFlag = true;
        K.after(1.8, () => {
          if (destroyed || myGen !== gen) return;
          busyFlag = false;
          if (enterTurnFn) enterTurnFn(true);
        });
        return;
      }
      busyFlag = false;
      if (enterTurnFn) enterTurnFn(true);
    }

    function commitMove(r, c) {
      if (!st || st.over || busyFlag || anim) return false;
      const res = logic.play(st, r, c);
      if (!res) return false;

      pushHistSnapshot(cloneState(st), moveCount);
      const placedSide = st.turn;
      st = res.state;
      moveCount++;
      clearPreview();
      clearDots();
      presser.cancel();
      if (host.onLayout) host.onLayout();

      if (K.fast) {
        const placed = makeDiscSpr(r, c, placedSide, { lift: 0, order: 40 });
        discGrid[r][c] = placed;
        for (let i = 0; i < res.flipped.length; i++) {
          const fr = res.flipped[i][0], fc = res.flipped[i][1];
          const ds = discGrid[fr] && discGrid[fr][fc];
          if (ds) { ds.tex = discTex[placedSide]; ds.sx = 1; ds.lift = 0; ds.order = 40; }
        }
        K.snd.slap(true);
        finishMove(res);
        return { flipped: res.flipped };
      }

      busyFlag = true;
      const placed = makeDiscSpr(r, c, placedSide, { lift: 0.50, order: 50 });
      discGrid[r][c] = placed;

      const keys = Object.keys(res.rings).map(Number).sort((a, b) => a - b);
      const ringList = [];
      let maxStart = 3;
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const startF = 3 + (k === 1 ? 0 : k);
        if (startF > maxStart) maxStart = startF;
        const coords = res.rings[k];
        const discs = [];
        for (let j = 0; j < coords.length; j++) {
          const ds = discGrid[coords[j][0]] && discGrid[coords[j][0]][coords[j][1]];
          if (ds) discs.push(ds);
        }
        ringList.push({ k, startF, discs });
      }

      anim = {
        t: 0,
        lastF: 0,
        side: placedSide,
        placed,
        rings: ringList,
        endFrame: maxStart + 4,
        res,
      };
      applyAnimStep(anim, 0);
      return { flipped: res.flipped };
    }

    commitMoveFn = commitMove;

    // ---- Turn Display, Bot Turns & Undo (PRD 8.3, 8.5, 1.3) ----
    let humanUndoCount = 0;

    function pushHistSnapshot(stateSnap, moves) {
      hist.push({ state: stateSnap, moveCount: moves });
      if (!isBotSide(stateSnap.turn)) humanUndoCount++;
    }

    function showTurnDisplay(side, hop) {
      K.turnDisplay(whoOfSide(side), side === 1 ? 'navy' : 'cream', !!hop);
    }

    function enterTurn(hop) {
      if (!st || st.over || destroyed) return;
      const side = st.turn;
      updateTurnTab();

      if (isBotSide(side)) {
        clearDots();
        ctx.setHint('Paper Bot is thinking');
        if (host.onLayout) host.onLayout();
        showTurnDisplay(side, hop);
        const myGen = gen;
        const delay = K.botDelay();
        K.after(delay, () => {
          if (destroyed || myGen !== gen || !st || st.over || busyFlag || anim || !isBotSide(st.turn)) return;
          const mv = logic.bot(st, opt.bot, K.rnd);
          if (mv) commitMove(mv[0], mv[1]);
        });
      } else {
        showDots();
        const nm = nameOfSide(side);
        const msg = opt.dots ? (nm + ', pick a square with a dot') : (nm + ', your turn');
        ctx.setHint(msg);
        if (host.onLayout) host.onLayout();
        showTurnDisplay(side, hop);
        if (hop && ctx.speakText) ctx.speakText(nm + ', your turn');
      }
    }

    enterTurnFn = enterTurn;

    // ---- End Screen (PRD 8.6) ----
    let endShown = false;
    let endRibbon = null;
    let btnAgain = null;
    let btnGames = null;

    function clearEndUi() {
      endShown = false;
      if (endRibbon) { K.kill(endRibbon); endRibbon = null; }
      if (btnAgain) { K.kill(btnAgain); btnAgain = null; }
      if (btnGames) { K.kill(btnGames); btnGames = null; }
    }

    function buildEndUi(celebrate) {
      if (endRibbon) { K.kill(endRibbon); endRibbon = null; }
      if (btnAgain) { K.kill(btnAgain); btnAgain = null; }
      if (btnGames) { K.kill(btnGames); btnGames = null; }
      if (!st || !st.over || destroyed) return;
      endShown = true;

      const cnt = logic.count(st);
      const line1 = nameOfSide(1) + ': ' + cnt.x + '   ' + nameOfSide(2) + ': ' + cnt.o;
      const line2 = st.winner === 0
        ? 'A tie! Well played, both'
        : (nameOfSide(st.winner) + ' wins');
      const colr = st.winner === 1 ? PAP[10] : (st.winner === 2 ? PAP[0] : K.COL.card);

      endRibbon = K.ribbon([line1, line2], colr);
      const W = 1000 * ctx.asp();
      const by = endRibbon.y + endRibbon.h / 2 + 54;
      btnAgain = K.tab('Play again', true, {
        colr: PAP[6], ink: CREAM, order: 230, px: 32, minW: 200, center: true,
      });
      btnGames = K.tab('Games', true, {
        colr: PAP[8], ink: INK, order: 230, px: 32, minW: 160, center: true,
      });
      const gap = 28;
      const totW = btnAgain.w + gap + btnGames.w;
      btnAgain.x = W / 2 - totW / 2 + btnAgain.w / 2;
      btnAgain.y = by;
      btnGames.x = W / 2 + totW / 2 - btnGames.w / 2;
      btnGames.y = by;

      if (celebrate) {
        K.confetti(W / 2, 420, 24, [PAP[10], PAP[0]]);
        if (ctx.sfx && ctx.sfx.wake) ctx.sfx.wake();
        ctx.setHint(line2);
        if (host.onLayout) host.onLayout();
        if (st.winner) showTurnDisplay(st.winner, true);
        if (ctx.speakText) ctx.speakText(line1 + '. ' + line2);
      }
    }

    function onGameOver() {
      if (!st || !st.over || destroyed) return;
      clearDots();
      clearPreview();
      updateTurnTab();
      const winnerSeat = st.winner === 0 ? 0 : seatOf(st.winner);
      if (host.onOver) host.onOver(winnerSeat);
      const myGen = gen;
      K.after(0.6, () => {
        if (destroyed || myGen !== gen || !st || !st.over) return;
        buildEndUi(true);
      });
    }

    onGameOverFn = onGameOver;

    function start(o, info) {
      gen++;
      anim = null;
      clearEndUi();
      K.closeNote(true);
      opt = Object.assign({ players: 1, bot: 'easy', size: 8, dots: true, look: 'plain' }, o || {});
      opt.size = Number(opt.size) === 6 ? 6 : 8;
      opt.dots = opt.dots !== false;
      navySeat = (info && info.starter === 2) ? 2 : 1;
      st = logic.start(opt.size, 1);
      moveCount = 0;
      busyFlag = false;
      hist.clear();
      humanUndoCount = 0;
      K.ensureMat();
      ensureDiscTextures();
      ensureDotTex();
      buildBoard();
      syncDiscsFromState();
      buildTrays();
      frameCamera(!!(info && info.immediate));
      enterTurn(false);
    }

    function down(e, p) {
      if (endShown) {
        if (btnAgain && ctx.hit(btnAgain, p.hx, p.hy, 8)) {
          K.tapTab(btnAgain, 'Play again');
          if (host.again) host.again();
          return;
        }
        if (btnGames && ctx.hit(btnGames, p.hx, p.hy, 8)) {
          K.tapTab(btnGames, 'Games');
          if (host.openBox) host.openBox();
          return;
        }
        return;
      }
      presser.down(e, p);
    }
    function move(e, p) {
      if (endShown) return;
      presser.move(e, p);
    }
    function up(e, p) {
      if (endShown) return;
      presser.up(e, p);
    }
    function cancel() { presser.cancel(); }
    function update(dt) {
      if (!anim || destroyed) return;
      anim.t += dt;
      const targetF = Math.floor(anim.t * 12 + 1e-6);
      while (anim && anim.lastF < targetF) {
        anim.lastF++;
        applyAnimStep(anim, anim.lastF);
        if (anim.lastF >= anim.endFrame) {
          const res = anim.res;
          anim = null;
          finishMove(res);
          break;
        }
      }
    }
    function layoutHud() {
      if (!st || destroyed) return;
      K.ensureMat();
      const pNow = isPortrait();
      if (pNow !== lastPortrait) buildTrays();
      frameCamera(true);
      if (!st.over) {
        showTurnDisplay(st.turn, false);
      } else if (endShown) {
        buildEndUi(false);
      }
    }
    function rebake() {
      if (!st || destroyed) return;
      K.ensureMat();
      ensureDiscTextures();
      ensureDotTex();
      buildBoard();
      syncDiscsFromState();
      buildTrays();
      showDots();
      frameCamera(true);
      if (!st.over) {
        showTurnDisplay(st.turn, false);
      } else if (endShown) {
        buildEndUi(false);
      }
    }
    function canUndo() {
      if (!st || st.over || busyFlag || anim) return false;
      return opt.players === 1 ? humanUndoCount > 0 : hist.len() > 0;
    }
    function undo() {
      if (!canUndo()) return;
      gen++;
      anim = null;
      busyFlag = false;
      presser.cancel();
      clearPreview();
      clearDots();
      K.closeNote(true);
      let snap = null;
      if (opt.players === 1) {
        snap = hist.popUntil(s => {
          if (!isBotSide(s.state.turn)) { humanUndoCount--; return true; }
          return false;
        });
      } else {
        snap = hist.pop();
        if (snap && !isBotSide(snap.state.turn)) humanUndoCount--;
      }
      if (!snap) return;
      st = cloneState(snap.state);
      moveCount = snap.moveCount;
      syncDiscsFromState();
      syncTally(false);
      if (ctx.sfx && ctx.sfx.back) ctx.sfx.back();
      enterTurn(false);
    }

    function destroy() {
      destroyed = true;
      gen++;
      anim = null;
      presser.cancel();
      clearEndUi();
      clearPreview();
      clearDots();
      clearDiscs();
      clearTrays();
      if (boardSpr) { K.kill(boardSpr); boardSpr = null; }
      freeDiscTex();
      if (dotTex) { B.freeTex(dotTex); dotTex = null; }
      K.closeNote(true);
      K.turnDisplay(null, null, false);
    }

    const api = {
      state() {
        if (!st) return null;
        const cnt = logic.count(st);
        return {
          n: st.n,
          grid: st.grid.slice(),
          turn: st.turn,
          legal: logic.legal(st),
          count: { x: cnt.x, o: cnt.o },
          over: st.over,
          winner: st.winner,
        };
      },
      set(grid, turn) {
        if (!Array.isArray(grid) || !grid.length || destroyed) return;
        gen++;
        anim = null;
        busyFlag = false;
        presser.cancel();
        clearEndUi();
        clearPreview();
        clearDots();
        K.closeNote(true);
        const n = grid.length === 6 ? 6 : 8;
        const sizeChanged = !st || st.n !== n;
        opt.size = n;
        st = { n, grid: grid.slice(), turn: turn === 2 ? 2 : 1, over: false, winner: 0 };
        hist.clear();
        humanUndoCount = 0;
        if (sizeChanged) buildBoard();
        syncDiscsFromState();
        syncTally(false);
        showTurnDisplay(st.turn, false);
        updateTurnTab();
        showDots();
        if (host.onLayout) host.onLayout();
      },
      play(r, c) {
        return commitMove(r, c);
      },
      bot() {
        if (!st || st.over || busyFlag || anim || destroyed) return null;
        const mv = logic.bot(st, opt.bot, K.rnd);
        if (!mv) return null;
        gen++;
        const ok = commitMove(mv[0], mv[1]);
        return ok ? mv : null;
      },
      at(r, c) { return sqScreen(r, c); },
    };

    return {
      start,
      down,
      move,
      up,
      cancel,
      update,
      layoutHud,
      rebake,
      canUndo,
      undo,
      destroy,
      turn: () => (st ? st.turn : null),
      winner: () => (st && st.over ? st.winner : null),
      busy: () => busyFlag,
      moves: () => moveCount,
      api,
    };
  };
})();
