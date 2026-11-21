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

    const BOARD_GRID = 800;
    const BOARD_HALF = BOARD_GRID * 0.5;
    const BOARD_Y_OFF = 0;
    const PAGE_SCALE = BOARD_GRID / 512;
    const PAGE_COL = '#e2d3b5';

    let page = null;
    let boardSpr = null;
    let lastPortrait = null;

    const hist = K.makeHist();

    function clearPage() {
      if (page) { page.destroy(); page = null; }
    }

    function ensurePage() {
      K.hideMat();
      if (page) return;
      page = K.gamePage({
        cx: GT[0],
        cy: GT[1] + Math.round(39 * PAGE_SCALE),
        w: Math.round(1354 * PAGE_SCALE),
        h: Math.round(670 * PAGE_SCALE),
        frameOrder: 6,
        tableOrder: -20,
      });
      const IN = page.in;
      const pw = IN.w + 38, ph = IN.h + 38;
      const S = 0.75;
      const tex = ctx.shapeTex(Math.round(pw * S), Math.round(ph * S), b => {
        B.paper(b, q => q.rect(0, 0, pw * S, ph * S), PAGE_COL, 0.34);
        const c = b.c, w = pw * S, h = ph * S;
        c.save();
        const edge = (x0, y0, x1, y1) => {
          const g = c.createLinearGradient(x0, y0, x1, y1);
          g.addColorStop(0, 'rgba(122, 92, 54, 0.22)');
          g.addColorStop(0.55, 'rgba(122, 92, 54, 0.05)');
          g.addColorStop(1, 'rgba(122, 92, 54, 0)');
          c.fillStyle = g;
          c.fillRect(0, 0, w, h);
        };
        edge(0, 0, 0, h * 0.14);
        edge(0, h, 0, h * 0.86);
        edge(0, 0, w * 0.08, 0);
        edge(w, 0, w * 0.92, 0);
        c.restore();
      }, { noMip: true });
      page.spr(tex, { x: IN.cx, y: IN.cy, w: pw, h: ph, z: 0.05, zr: 0.08, order: -5, own: true });
    }

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
    function sqSize() { return BOARD_GRID / (st ? st.n : opt.size); }
    function sqCenter(r, c) {
      const sq = sqSize();
      return [
        GT[0] - BOARD_HALF + (c + 0.5) * sq,
        GT[1] + BOARD_Y_OFF - BOARD_HALF + (r + 0.5) * sq,
      ];
    }
    function sqScreen(r, c) {
      const p = sqCenter(r, c);
      const h = ctx.w2h(p[0], p[1]);
      return [h[0] / 1000 * innerHeight, h[1] / 1000 * innerHeight];
    }

    function rrectPath(x, y, w, h, rad) {
      return q => {
        const r = Math.min(rad, w * 0.5, h * 0.5);
        q.moveTo(x + r, y);
        q.lineTo(x + w - r, y);
        q.quadraticCurveTo(x + w, y, x + w, y + r);
        q.lineTo(x + w, y + h - r);
        q.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        q.lineTo(x + r, y + h);
        q.quadraticCurveTo(x, y + h, x, y + h - r);
        q.lineTo(x, y + r);
        q.quadraticCurveTo(x, y, x + r, y);
        q.closePath();
      };
    }

    const FELT = '#2f7256';
    const FELT_RIM = '#215540';
    const FELT_CUT = '#1f4f3c';
    const FELT_DIMPLE = '#245f47';

    function bakeBoardTex(n) {
      const PPU = 1.5;
      const pad = Math.round(44 * PAGE_SCALE);
      const uw = BOARD_GRID + pad, uh = BOARD_GRID + pad;
      const W = Math.round(uw * PPU), H = Math.round(uh * PPU);
      const cx = W * 0.5, cy = H * 0.5;
      const half = BOARD_HALF * PPU;
      const cell = (BOARD_GRID / n) * PPU;
      const ps = PAGE_SCALE * PPU;

      return ctx.shapeTex(W, H, b => {
        // 1. Outer felt rim (relief 0.42)
        const rimPad = 16 * ps;
        B.paper(b, rrectPath(cx - half - rimPad, cy - half - rimPad, (half + rimPad) * 2, (half + rimPad) * 2, 12 * ps), FELT_RIM, 0.42);

        // 2. Inner green felt sheet (relief 0.62)
        const inPad = 9 * ps;
        B.paper(b, rrectPath(cx - half - inPad, cy - half - inPad, (half + inPad) * 2, (half + inPad) * 2, 8 * ps), FELT, 0.62);

        // 3. Subtle felt fibres (colour only)
        const r = ctx.rng(5 + n);
        const c = b.c;
        c.save();
        c.strokeStyle = 'rgba(10,40,28,0.16)';
        c.lineWidth = 1.2 * ps;
        c.beginPath();
        for (let i = 0; i < 900; i++) {
          const x = cx + (r() - 0.5) * half * 2;
          const y = cy + (r() - 0.5) * half * 2;
          const a = r() * 6.3, l = (3 + r() * 5) * ps;
          c.moveTo(x, y);
          c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        }
        c.stroke();
        c.restore();

        // 4. Cut grid lines (colour + depressed relief, works for 6x6 and 8x8)
        for (const [q, col] of [[b.c, FELT_CUT], [b.g, B.grey(0.34)]]) {
          q.save();
          q.strokeStyle = col;
          q.lineWidth = 2.4 * ps;
          q.beginPath();
          for (let i = 0; i <= n; i++) {
            const v = -half + i * cell;
            q.moveTo(cx + v, cy - half);
            q.lineTo(cx + v, cy + half);
            q.moveTo(cx - half, cy + v);
            q.lineTo(cx + half, cy + v);
          }
          q.stroke();
          q.restore();
        }
      });
    }

    function buildBoard() {
      if (boardSpr) { K.kill(boardSpr); boardSpr = null; }
      const tex = bakeBoardTex(st.n);
      const uw = BOARD_GRID + Math.round(44 * PAGE_SCALE);
      boardSpr = K.spr(tex, {
        x: GT[0], y: GT[1] + BOARD_Y_OFF, w: uw, h: uw,
        z: 0.30, zr: 0.10, order: 30, own: true,
      });
    }

    function frameCamera(immediate) {
      lastPortrait = isPortrait();
      if (page) {
        page.fitCam(immediate);
        return;
      }
      const topM = (ctx.topHudBottom() + 10) / 1000;
      const box = [GT[0] - 720, GT[1] - 480, GT[0] + 720, GT[1] + 480];
      const mar = { l: 0.02, r: 0.02, t: topM, b: 0.03 };
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

    const DISC_DARK = '#1b1b1f';
    const DISC_DARK_FACE = '#2e2e33';
    const DISC_DARK_UNDER = '#f1ece0';
    const DISC_LIGHT = '#e6dfcd';
    const DISC_LIGHT_FACE = '#f6f1e4';
    const DISC_LIGHT_UNDER = '#232327';

    function bakeDiscTex(side, look) {
      const S = 200, cx = S / 2, cy = S / 2, R = 86;
      const body = side === 1 ? DISC_DARK : DISC_LIGHT;
      const face = side === 1 ? DISC_DARK_FACE : DISC_LIGHT_FACE;
      const under = side === 1 ? DISC_DARK_UNDER : DISC_LIGHT_UNDER;
      return ctx.shapeTex(S, S, b => {
        // Opposite-side paper glued underneath, offset slightly so the other face peeks out as a rim
        B.paper(b, q => q.arc(cx + 2, cy + 4, R, 0, Math.PI * 2), under, 0.45);
        // Main bevelled disc edge
        B.paper(b, q => q.arc(cx, cy, R - 4, 0, Math.PI * 2), body, 0.72);
        // Raised inner face
        B.paper(b, q => q.arc(cx, cy, R - 14, 0, Math.PI * 2), face, 0.86);
        if (look === 'sunmoon') {
          if (side === 2) {
            const sunCol = ctx.shade(DISC_LIGHT, -0.05);
            const rel = 0.94;
            B.paper(b, q => q.arc(cx, cy, 20, 0, Math.PI * 2), sunCol, rel);
            for (let i = 0; i < 12; i++) {
              const a = (i / 12) * Math.PI * 2;
              const aL = a - 0.14, aR = a + 0.14;
              B.paper(b, q => {
                q.moveTo(cx + Math.cos(a) * 52, cy + Math.sin(a) * 52);
                q.lineTo(cx + Math.cos(aL) * 26, cy + Math.sin(aL) * 26);
                q.lineTo(cx + Math.cos(aR) * 26, cy + Math.sin(aR) * 26);
                q.closePath();
              }, sunCol, rel);
            }
          } else {
            const moonCol = ctx.shade(DISC_DARK_FACE, 0.14);
            const rel = 0.94;
            const R1 = 40, R2 = 33, dx = 17;
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
      // Visual radius is 86/100 of half texture; target radius = 0.39 * sq
      return sqSize() * (0.39 * 2 / 0.86);
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
        z: 0.36, zr: 0.14, order: 40, sx: 1, own: false,
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

    function badgePos(side) {
      return [
        GT[0] + (side === 1 ? -1 : 1) * Math.round(590 * PAGE_SCALE),
        GT[1] + Math.round((279 + 39) * PAGE_SCALE),
      ];
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
      const cnt = logic.count(st);
      const counts = { 1: cnt.x, 2: cnt.o };
      const bSz = Math.round(56 * PAGE_SCALE);
      for (const s of [1, 2]) {
        const bp = badgePos(s);
        badgeSpr[s] = K.spr(K.badge(counts[s]), {
          x: bp[0], y: bp[1], w: bSz, h: bSz,
          z: 0.25, zr: 0.06, order: 35, own: false,
        });
      }
      syncTally(false);
    }

    function syncTally() {
      if (!st) return;
      const cnt = logic.count(st);
      const counts = { 1: cnt.x, 2: cnt.o };
      for (const s of [1, 2]) {
        if (badgeSpr[s]) badgeSpr[s].tex = K.badge(counts[s]);
      }
    }

    function updateTurnTab() {
      if (turnTabSpr) { K.kill(turnTabSpr); turnTabSpr = null; }
    }

    // ---- Move Dots, Preview & Input (PRD 8.3) ----
    let dotTex = null;
    let dotSprs = []; // { r, c, s }
    let previewSpr = null;
    let wobbledDiscs = [];

    function ensureDotTex() {
      if (dotTex) { B.freeTex(dotTex); dotTex = null; }
      dotTex = ctx.shapeTex(48, 48, b => {
        B.paper(b, q => q.arc(24, 24, 16, 0, Math.PI * 2), FELT_DIMPLE, 0.28);
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
      const sz = sqSize() * (0.085 * 2 / (16 / 24)); // dimple radius ~0.085 * sq (5.5 on 68 cell)
      for (let i = 0; i < moves.length; i++) {
        const r = moves[i][0], c = moves[i][1];
        const p = sqCenter(r, c);
        const s = K.spr(dotTex, {
          x: p[0], y: p[1], w: sz, h: sz,
          z: 0.31, zr: 0.02, order: 34, own: false,
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
      const c = Math.floor((wx - (GT[0] - BOARD_HALF)) / sq);
      const r = Math.floor((wy - (GT[1] + BOARD_Y_OFF - BOARD_HALF)) / sq);
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
      const c = Math.floor((wx - (GT[0] - BOARD_HALF)) / sq);
      const r = Math.floor((wy - (GT[1] + BOARD_Y_OFF - BOARD_HALF)) / sq);
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
      ensurePage();
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
      ensurePage();
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
      clearPage();
      ensurePage();
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
      clearPage();
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
