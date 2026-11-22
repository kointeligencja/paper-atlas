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


  // ======================================================================================
  // The view: "Land and Sea" (round 4). The board is a patch of the map's sea. Side 1 raises
  // LAND (sand tile with a green island), side 2 brings the SEA back (deep blue tile, white crest).
  // Everything is drawn in "scene units" of the approved prototype (board 544 wide, centre (0, 24)),
  // and placed in the world with PS world units per scene unit.
  // ======================================================================================
  PG.othello = function (ctx, K, host) {
    const logic = PG.logic.othello;
    const B = ctx.GFX, PAP = ctx.PAP;
    const GT = K.GT;
    const FONT = ctx.FONT;

    let opt = { players: 1, bot: 'easy', size: 8, dots: true, look: 'plain' };
    let navySeat = 1; // 1 = child plays side 1 (land), 2 = P2/bot plays side 1
    let st = null;
    let moveCount = 0;
    let gen = 0;
    let busyFlag = false;
    let destroyed = false;

    // ---- palette: all from the map and its paper set ----
    const SEA = '#b5cfd0', SAND = '#e3d8bf', INKSEA = '#15181f', FOAM = '#f4f1ea';
    const GREEN = PAP[6], GREEN_D = PAP[7], BLUE = PAP[9], BLUE_D = PAP[10];
    const LABEL = '#f6f1e4';

    // ---- geometry ----
    const BOARD_GRID = 800;
    const BOARD_HALF = BOARD_GRID * 0.5;
    const PS = BOARD_GRID / 544;          // world units per scene unit
    const SBY = 24;                       // scene y of the board centre
    const PAGE_SCALE = BOARD_GRID / 512;  // the page rectangle as before
    const SEATX = 500, RAIL_SY = 368;
    const W = (x, y) => [GT[0] + x * PS, GT[1] + (y - SBY) * PS];
    const FLOOR = 0.3;
    // upright page: the green shore along the top, the board, the atoll seat, the rail. Scene units, board centre y = SBY.
    const PORT_ASP = 1.15, PORT_W = 920;
    const P_TOP = -452, P_BOT = 496, P_COAST = -326, P_SEAT1 = -360, P_SEAT2 = 386, P_RAIL = 468;
    const P_H0 = (P_BOT - P_TOP) * PS;     // the page height (world) that holds all of it
    // The page: wide as before; in portrait narrower and taller so the camera (fitting the page to the width) fills the screen.
    function pageSpec() {
      const asp = ctx.asp();
      if (asp >= PORT_ASP) return { w: Math.round(1354 * PAGE_SCALE), h: Math.round(670 * PAGE_SCALE), key: 'L' };
      const mt = Math.min(0.32, (ctx.topHudBottom() + (ctx.PHONE ? 6 : 10)) / 1000);
      const mb = ctx.PHONE ? 0.015 : 0.042, mlr = ctx.PHONE ? 0.02 : 0.064, bw = ctx.PHONE ? 20 : 52;
      const k = (1 - mt - mb) / (1 - mlr);
      let w = PORT_W, h = Math.round(k * (w + 2 * bw) / asp - 2 * bw);
      if (h < P_H0) { h = Math.round(P_H0); w = Math.round(clamp((h + 2 * bw) * asp / k - 2 * bw, PORT_W, 1500)); }
      w = Math.round(w / 12) * 12; h = Math.round(h / 12) * 12;
      return { w, h: Math.max(h, Math.round(P_H0)), key: `${w}x${h}` };
    }
    function setLayout(spec) {
      if (spec.key === 'L') { PL = null; return; }
      const ex = Math.max(0, spec.h / PS - (P_BOT - P_TOP));
      const top = P_TOP - ex * 0.4, bot = P_BOT + ex * 0.6;
      PL = {
        ex, top, bot, cy: (top + bot) / 2, wM: spec.w / PS, hM: spec.h / PS,
        seat1: [0, P_SEAT1 - ex * 0.12], seat2: [0, P_SEAT2 + ex * 0.2], rail: P_RAIL + ex * 0.6,
      };
      PL.railW = Math.min(PL.wM - 36, 600);
    }

    let page = null;
    let pageKey = '';
    let PL = null;   // the portrait layout (scene units) or null for the wide page
    let boardSpr = null;
    let lastPortrait = null;
    let curN = 8;
    let curU = PS;   // world units per tile unit (a tile is 58 units in a 68-unit square)

    const hist = K.makeHist();

    // ---- little helpers (ported from the prototype kit) ----
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const lerp = (a, b, t) => a + (b - a) * t;
    const lim01 = v => Math.max(0, Math.min(1, v));
    const hs = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + (c || 0) * 2147483647) | 0; h = (h ^ h >>> 13) * 1274126177 | 0; return ((h ^ h >>> 16) >>> 0) / 4294967296; };
    const mkRng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const shade = (hex, d) => { const f = i => clamp(Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 + d) + d * 18), 0, 255); return `rgb(${f(1)},${f(3)},${f(5)})`; };
    const P = (b, path, col, rel, rule) => B.paper(b, path, col, rel, rule);
    const circ = (x, y, r) => q => { q.moveTo(x + r, y); q.arc(x, y, r, 0, 6.2832); };
    const ell = (x, y, rx, ry, rot) => q => { q.moveTo(x + rx * Math.cos(rot || 0), y + rx * Math.sin(rot || 0)); q.ellipse(x, y, rx, ry, rot || 0, 0, 6.2832); };
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
    // a domed bead: flat colour, round relief
    function dome(b, x, y, r, col, r0, r1) {
      const c = b.c, g = b.g;
      c.fillStyle = col; c.beginPath(); c.ellipse(x, y, r, r, 0, 0, 7); c.fill();
      g.save(); g.translate(x, y);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, B.grey(r1)); gr.addColorStop(0.6, B.grey(lerp(r0, r1, 0.75))); gr.addColorStop(1, B.grey(r0));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.restore();
    }
    // a texture whose size is given in scene units, baked at k pixels a unit, origin at its centre
    function shape(wu, hu, k, fn, opts) {
      const b = B.bake(wu * k, hu * k);
      b.s = k;
      for (const x of [b.c, b.g]) x.setTransform(k, 0, 0, k, wu * k / 2, hu * k / 2);
      fn(b);
      const t = B.tex(b, opts || {});
      t.uw = wu; t.uh = hu;
      return t;
    }

    function cloneState(s) {
      return { n: s.n, grid: s.grid.slice(), turn: s.turn, over: s.over, winner: s.winner };
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

    function isPortrait() { return ctx.asp() < PORT_ASP; }
    function sqSize() { return BOARD_GRID / (st ? st.n : opt.size); }
    function sqCenter(r, c) {
      const sq = sqSize();
      return [GT[0] - BOARD_HALF + (c + 0.5) * sq, GT[1] - BOARD_HALF + (r + 0.5) * sq];
    }
    function sqScreen(r, c) {
      const p = sqCenter(r, c);
      const h = ctx.w2h(p[0], p[1]);
      return [h[0] / 1000 * innerHeight, h[1] / 1000 * innerHeight];
    }
    function setGeometry() {
      curN = st ? st.n : opt.size;
      curU = PS * (544 / curN) / 68;
    }

    // =========================== the page: the map's own sea, a green shore, an atoll ===========================
    let bobCrests = [];
    let seatSpr = { 1: null, 2: null };

    function clearPage() {
      bobCrests = []; // page sprites: killed with the page
      if (page) { page.destroy(); page = null; }
      if (T.wave) { B.freeTex(T.wave); T.wave = null; }
    }

    // true when the page was (re)built, so the caller lays the trays out again
    function ensurePage() {
      K.hideMat();
      const spec = pageSpec();
      if (page && pageKey === spec.key) return false;
      if (page) clearPage();
      pageKey = spec.key;
      setLayout(spec);
      page = K.gamePage({
        cx: GT[0],
        cy: PL ? W(0, PL.cy)[1] : GT[1] + Math.round(39 * PAGE_SCALE),
        w: spec.w,
        h: spec.h,
        frameOrder: 6,
        tableOrder: -20,
      });
      const IN = page.in;
      const wM = IN.w / PS, hM = IN.h / PS;
      const cyS = SBY + (IN.cy - GT[1]) / PS;      // scene y of the page centre
      const x0S = (IN.x0 - GT[0]) / PS;
      // the sea sheet with its ink wave marks (the map's own)
      const pw = wM + 26, ph = hM + 26;
      const tex = shape(pw, ph, 1.35, b => {
        P(b, q => q.rect(-pw / 2, -ph / 2, pw, ph), SEA, 0.34);
        const wr = mkRng(77);
        for (let y = -hM / 2 + 20; y < hM / 2 + 6; y += 40) {
          for (let x = -wM / 2 + ((Math.round(y / 40) & 1) * 36); x < wM / 2 + 6; x += 72) {
            const jx = x + (wr() - 0.5) * 30, jy = y + (wr() - 0.5) * 16, l = 9 + wr() * 8, sk = wr();
            if (sk < 0.4) continue;
            for (const [q, s] of [[b.c, 'rgba(21,24,31,0.8)'], [b.g, B.grey(0.05)]]) {
              q.strokeStyle = s; q.lineWidth = 1.1 + sk * 0.6; q.lineCap = 'round'; q.beginPath();
              q.moveTo(jx - l, jy); q.quadraticCurveTo(jx - l / 2, jy - 5, jx, jy);
              if (sk > 0.65) q.quadraticCurveTo(jx + l / 2, jy + 4, jx + l, jy - 1);
              q.stroke();
            }
          }
        }
      }, { noMip: true });
      page.spr(tex, { x: IN.cx, y: IN.cy, w: pw * PS, h: ph * PS, z: 0.05 * PS, zr: 0.08 * PS, order: -5, own: true });

      if (PL) { buildPortraitShore(); return true; }
      // the land player's shore (left): three strata of green and a sand coast
      const SW = 340, SCX = x0S - 18 + SW / 2;
      const coast = (y, k) => -428 - k + Math.sin(y * 0.011 + 1) * 16 + Math.sin(y * 0.029 + k) * 7 + 26 * Math.exp(-(((y - SBY) / 110) ** 2));
      const shoreH = hM + 32;
      const shoreTex = shape(SW + 30, shoreH, 1.0, b => {
        const band = (k, col, rel) => P(b, q => {
          q.moveTo(-SW / 2, -shoreH / 2);
          for (let y = -shoreH / 2; y <= shoreH / 2; y += 10) q.lineTo(coast(y + cyS, k) - SCX, y);
          q.lineTo(-SW / 2, shoreH / 2);
          q.closePath();
        }, col, rel);
        band(0, SAND, 0.5); band(24, GREEN, 0.62);
        band(120, shade(GREEN, -0.1), 0.7); band(215, GREEN_D, 0.78);
      }, { noMip: true });
      const sp = W(SCX, cyS);
      page.spr(shoreTex, { x: sp[0], y: sp[1], w: (SW + 30) * PS, h: shoreH * PS, z: 0.12 * PS, zr: 0.08 * PS, order: 2, own: true });

      addCrests([[390, -190, 44], [610, -90, 52], [420, 220, 48], [640, 250, 40], [-345, 250, 40], [-350, -200, 44]]);
      return true;
    }

    // the outside wave crests (the map's own), bobbing a little
    function addCrests(list) {
      T.wave = shape(60, 24, 3, b => {
        b.c.translate(-30, -12); b.g.translate(-30, -12); b.c.scale(0.5, 0.5); b.g.scale(0.5, 0.5);
        P(b, x => { x.moveTo(8, 28); x.quadraticCurveTo(32, 8, 60, 24); x.quadraticCurveTo(86, 36, 112, 20); x.quadraticCurveTo(86, 44, 56, 32); x.quadraticCurveTo(30, 18, 8, 28); x.closePath(); }, INKSEA, 0.45);
        P(b, circ(58, 13, 4.2), FOAM, 0.68);
      });
      for (const [x, y, w] of list) {
        const p = W(x, y);
        const s = page.spr(T.wave, { x: p[0], y: p[1], w: w * PS, h: w * 0.4 * PS, z: 0.09 * PS, zr: 0.025 * PS, order: 3, own: false });
        s.by = p[1];
        bobCrests.push(s);
      }
    }

    // the upright page: the land player's shore runs along the top edge (green strata, sand coast facing the board)
    function buildPortraitShore() {
      const ex = PL.ex, wM = PL.wM;
      const sw = wM + 32, top = PL.top - 16, bot = P_COAST + 60, sh = bot - top, cyT = (top + bot) / 2;
      const coast = (x, k) => P_COAST - k + Math.sin(x * 0.011 + 1) * 16 + Math.sin(x * 0.029 + k) * 7 + 26 * Math.exp(-((x / 110) ** 2));
      const shoreTex = shape(sw, sh, 1.0, b => {
        const band = (k, col, rel) => P(b, q => {
          q.moveTo(-sw / 2, -sh / 2);
          for (let x = -sw / 2; x <= sw / 2 + 5; x += 10) q.lineTo(x, coast(x, k) - cyT);
          q.lineTo(sw / 2, -sh / 2);
          q.closePath();
        }, col, rel);
        band(0, SAND, 0.5); band(20, GREEN, 0.62);
        band(90 + ex * 0.3, shade(GREEN, -0.1), 0.7); band(130 + ex * 0.4, GREEN_D, 0.78);
      }, { noMip: true });
      const sp = W(0, cyT);
      page.spr(shoreTex, { x: sp[0], y: sp[1], w: sw * PS, h: sh * PS, z: 0.12 * PS, zr: 0.08 * PS, order: 2, own: true });
      const cr = [[-205, 396, 44], [215, 402, 40], [-130, 440, 34]];
      const side = wM / 2 - 292;
      if (side > 70) for (const sg of [-1, 1]) cr.push([sg * (292 + side / 2), -120, 44], [sg * (292 + side / 2), 150, 40]);
      addCrests(cr);
    }

    // =========================== the board: a patch of the same sea in a neatline ===========================
    function bakeBoardTex(n) {
      const HALF = 272, CELL = 544 / n, pen = ctx.PHONE ? 2.3 : 1.6;
      return shape(2 * HALF + 60, 2 * HALF + 60, 2, b => {
        P(b, rrectPath(-HALF - 20, -HALF - 20, 2 * HALF + 40, 2 * HALF + 40, 6), SAND, 0.5);
        P(b, q => {
          for (let i = 0; i < n; i++) {
            const v = -HALF + i * CELL;
            if (i % 2 === 0) { q.rect(v, -HALF - 14, CELL, 8); q.rect(HALF + 6, v, 8, CELL); }
            else { q.rect(v, HALF + 6, CELL, 8); q.rect(-HALF - 14, v, 8, CELL); }
          }
        }, INKSEA, 0.52);
        P(b, q => q.rect(-HALF - 3, -HALF - 3, 2 * HALF + 6, 2 * HALF + 6), shade(SEA, 0.035), 0.4);
        for (const [q, s] of [[b.c, 'rgba(60,70,90,0.55)'], [b.g, B.grey(0.33)]]) {
          q.strokeStyle = s; q.lineWidth = pen; q.beginPath();
          for (let i = 0; i <= n; i++) {
            const v = -HALF + i * CELL;
            q.moveTo(v, -HALF); q.lineTo(v, HALF); q.moveTo(-HALF, v); q.lineTo(HALF, v);
          }
          q.stroke();
        }
      }, { noMip: true });
    }

    function buildBoard() {
      if (boardSpr) { K.kill(boardSpr); boardSpr = null; }
      const tex = bakeBoardTex(st.n);
      const uw = (2 * 272 + 60) * PS;
      boardSpr = K.spr(tex, { x: GT[0], y: GT[1], w: uw, h: uw, z: 0.22 * PS, zr: 0.08 * PS, order: 10, own: true });
    }

    function frameCamera(immediate) {
      lastPortrait = isPortrait();
      if (page) { page.fitCam(immediate); return; }
      const topM = (ctx.topHudBottom() + 10) / 1000;
      const box = [GT[0] - 720, GT[1] - 480, GT[0] + 720, GT[1] + 480];
      const mar = { l: 0.02, r: 0.02, t: topM, b: 0.03 };
      const f = ctx.fitCam(box, mar, 0, false);
      if (immediate || K.fast) {
        ctx.killTw(ctx.cam);
        ctx.cam.x = f.x; ctx.cam.y = f.y; ctx.cam.h = f.h;
      } else {
        ctx.camTo(f.x, f.y, f.h, 0.9);
      }
    }

    // =========================== tiles: two papers glued back to back ===========================
    // LAND face: sand tile with a green island in relief. SEA face: deep blue tile with a white paper crest.
    const T = { landB: null, seaB: null, isl: [], hill: [], crest: null, edge: null, pip: [null, null, null], dot: [null, null, null], wave: null };
    const numT = {};
    const TS = 58;

    function freeTileTextures() {
      const list = [T.landB, T.seaB, T.crest, T.edge, T.pip[1], T.pip[2], T.dot[1], T.dot[2]].concat(T.isl, T.hill);
      for (const t of list) if (t) B.freeTex(t);
      T.landB = T.seaB = T.crest = T.edge = null; T.isl = []; T.hill = []; T.pip = [null, null, null]; T.dot = [null, null, null];
      for (const k of Object.keys(numT)) { if (numT[k]) B.freeTex(numT[k]); delete numT[k]; }
    }

    function ensureTileTextures() {
      freeTileTextures();
      const k = 3;
      const tileP = o => rrectPath(-TS / 2 + (o || 0), -TS / 2 + (o || 0) * 2, TS, TS, 15);
      const base = (top, under) => shape(76, 76, k, b => { P(b, tileP(1.6), under, 0.45); P(b, tileP(0), top, 0.7); });
      T.landB = base(SAND, BLUE_D);
      T.seaB = base(BLUE, SAND);
      const isl = sd => shape(60, 60, k, b => {
        const pts = [];
        for (let i = 0; i < 9; i++) { const a = i / 9 * 6.2832, r = 15 + 7 * hs(i, sd, 2); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
        const sm = (pp, col, rel) => P(b, q => {
          const n = pp.length, m = i => [(pp[i % n][0] + pp[(i + 1) % n][0]) / 2, (pp[i % n][1] + pp[(i + 1) % n][1]) / 2];
          q.moveTo(...m(0));
          for (let i = 1; i <= n; i++) q.quadraticCurveTo(pp[i % n][0], pp[i % n][1], ...m(i));
          q.closePath();
        }, col, rel);
        sm(pts, GREEN, 0.86);
        const ox = (hs(sd, 1, 5) < 0.5 ? -1 : 1) * 5, oy = -3 + hs(sd, 2, 5) * 8;
        sm(pts.map(p => [p[0] * 0.34 + ox, p[1] * 0.3 + oy]), GREEN_D, 0.97);
      });
      T.isl = [isl(1), isl(2), isl(3), isl(4)];
      // a small hill left on some islands at the end
      for (let sd = 0; sd < 4; sd++) T.hill.push(shape(40, 40, k, b => P(b, ell(0, 0, 9 + sd * 2, 7 + sd, sd), GREEN_D, 0.97)));
      T.crest = shape(60, 30, k, b => {
        b.c.translate(-29, -13); b.g.translate(-29, -13); b.c.scale(0.49, 0.49); b.g.scale(0.49, 0.49);
        P(b, x => { x.moveTo(8, 28); x.quadraticCurveTo(32, 4, 60, 24); x.quadraticCurveTo(86, 38, 112, 18); x.quadraticCurveTo(86, 50, 56, 36); x.quadraticCurveTo(30, 20, 8, 28); x.closePath(); }, FOAM, 0.9);
        P(b, circ(58, 9, 5), FOAM, 0.95);
      });
      // a tile seen edge-on: two papers glued back to back, sand on the left, blue on the right
      T.edge = shape(76, 76, k, b => {
        P(b, q => q.rect(-TS / 2, -TS / 2, TS / 2, TS), SAND, 0.8);
        P(b, q => q.rect(0, -TS / 2, TS / 2, TS), BLUE, 0.8);
      });
      T.pip[1] = shape(24, 24, k, b => { P(b, circ(0.8, 1.6, 7.6), SAND, 0.45); dome(b, 0, 0, 7.6, GREEN, 0.6, 0.9); });
      T.pip[2] = shape(24, 24, k, b => { P(b, circ(0.8, 1.6, 7.6), SAND, 0.45); dome(b, 0, 0, 7.6, BLUE, 0.6, 0.9); });
      // the dots of the legal squares: a sandy shoal where land may rise, a fleck of foam where the sea may come back
      T.dot[1] = shape(24, 24, k, b => P(b, circ(0, 0, 7), SAND, 0.46));
      T.dot[2] = shape(24, 24, k, b => P(b, circ(0, 0, 6.5), FOAM, 0.46));
    }

    function numTex(n, side) {
      const key = n + (side === 1 ? 'l' : 's');
      if (numT[key]) return numT[key];
      numT[key] = shape(66, 66, 2, b => {
        P(b, circ(0, 0, 29), SAND, 0.6);
        P(b, circ(0, 0, 23.5), side === 1 ? GREEN_D : BLUE, 0.7);
        const c = b.c; c.fillStyle = LABEL; c.font = `800 ${n > 9 ? 27 : 29}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), 0, 2);
      });
      return numT[key];
    }

    // ---- one tile on the board: a base sprite and what lies on it (the island or the crest) ----
    let tileGrid = []; // [r][c] -> tile | null

    function setFace(t, v) {
      t.v = v;
      t.b.tex = v === 1 ? T.landB : T.seaB;
      const tt = v === 1 ? T.isl[t.sd] : T.crest;
      t.top.tex = tt; t.top.w = tt.uw * curU; t.top.h = tt.uh * curU;
    }
    // lay a tile out; o: x y sc sx z order rot alpha, and for what lies on it tx ty (tile units) tsc tz talpha
    function put(t, o) {
      const U = curU;
      const x = o.x !== undefined ? o.x : t.x, y = o.y !== undefined ? o.y : t.y;
      const sc = o.sc !== undefined ? o.sc : 1, sx = o.sx !== undefined ? o.sx : 1;
      const z = o.z !== undefined ? o.z : FLOOR, ord = o.order !== undefined ? o.order : 12;
      const rot = o.rot !== undefined ? o.rot : t.rot, al = o.alpha !== undefined ? o.alpha : 1;
      const b = t.b, tp = t.top;
      b.x = x; b.y = y; b.sc = sc; b.sx = sx; b.z = z * PS; b.order = ord; b.rot = rot; b.alpha = al;
      tp.x = x + (o.tx || 0) * U; tp.y = y + (o.ty || 0) * U; tp.sc = sc * (o.tsc !== undefined ? o.tsc : 1); tp.sx = sx;
      tp.z = (z + 0.12 + (o.tz || 0)) * PS; tp.order = ord + 1; tp.rot = o.rot !== undefined ? o.rot : t.trot;
      tp.alpha = (o.talpha !== undefined ? o.talpha : 1) * al;
    }
    function bindSquare(t, r, c) {
      t.sd = Math.floor(hs(c, r, 4) * 4);
      t.rot = (hs(r, c, 9) - 0.5) * 0.14;
      t.trot = t.rot + (hs(c, r, 6) - 0.5) * 0.5;
      t.ph = (r * 3 + c * 5) % 12;
    }
    function mkTile(x, y, v, r, c) {
      const t = { v, x, y, rot: 0, trot: 0, sd: 0, ph: 0, moving: false };
      bindSquare(t, r, c);
      const sz = 76 * curU;
      t.b = K.spr(T.landB, { x, y, w: sz, h: sz, z: FLOOR * PS, zr: 0.1 * PS, order: 12, rot: t.rot, own: false });
      t.top = K.spr(T.crest, { x, y, w: 1, h: 1, z: (FLOOR + 0.12) * PS, zr: 0.08 * PS, order: 13, rot: t.trot, own: false });
      setFace(t, v);
      put(t, {});
      return t;
    }
    function killTile(t) {
      if (!t) return;
      K.kill(t.b); K.kill(t.top);
    }
    function clearTiles() {
      for (let r = 0; r < tileGrid.length; r++) for (let c = 0; c < tileGrid[r].length; c++) killTile(tileGrid[r][c]);
      tileGrid = [];
    }
    function syncTilesFromState() {
      clearTiles();
      const n = st.n;
      for (let r = 0; r < n; r++) {
        const row = [];
        for (let c = 0; c < n; c++) {
          const ch = st.grid[r][c];
          const p = sqCenter(r, c);
          row.push(ch === 'x' ? mkTile(p[0], p[1], 1, r, c) : ch === 'o' ? mkTile(p[0], p[1], 2, r, c) : null);
        }
        tileGrid.push(row);
      }
    }
    // the crest on a sea tile rides the swell: 1.5 units up for 6 frames, down for 6, each tile out of phase
    function bobTiles() {
      const off = 1.5 * curU;
      for (let r = 0; r < tileGrid.length; r++) {
        const row = tileGrid[r];
        for (let c = 0; c < row.length; c++) {
          const t = row[c];
          if (!t || t.moving || t.v !== 2 || !t.top) continue;
          t.top.y = t.y + (t.jy || 0) - (((frameNo + t.ph) % 12) < 6 ? 0 : off);
        }
      }
      for (let i = 0; i < bobCrests.length; i++) {
        const s = bobCrests[i];
        s.y = s.by + ((((frameNo + i * 3) % 12) < 6) ? 0 : 1.5 * PS);
      }
    }

    // =========================== trays: the shore seat, the atoll seat, the rail ===========================
    let railSpr = null;
    let pipSprs = [];
    let pipsBy = { 1: [], 2: [] }; // pip sprites per side, in well order (0 = that side's outer end)
    let badgeSpr = { 1: null, 2: null };
    let waitTile = null;
    let waitSide = 0;
    let waitBorn = 0;
    let ghost = null;     // the tile that drops onto its seat to say "no move" on a pass
    let seatTex = { 1: null, 2: null };

    function railGeom(n) {
      const total = n * n, pitch = (PL ? PL.railW : 1216) / total, RS = Math.min(1.5, pitch / 19);
      return { total, pitch, RS, wx: i => (i - (total - 1) / 2) * pitch };
    }
    function pipSz() { return 24 * railGeom(curN).RS * PS; }
    function pipPos(side, idx) {
      const L = railGeom(curN);
      return W(L.wx(side === 1 ? idx : L.total - 1 - idx), railSY());
    }
    // the atoll and the rail drop a little when the tiles (and the seat) are bigger, on the 6x6 board
    function bigShift() { return 50 * (Math.min(1.35, curU / PS) - 1); }
    function railSY() { return PL ? PL.rail + bigShift() : RAIL_SY; }
    function seatPos(side) {
      if (PL) return W(...(side === 1 ? PL.seat1 : [PL.seat2[0], PL.seat2[1] + bigShift()]));
      return W(side === 1 ? -SEATX : SEATX, SBY);
    }
    function badgePos(side) {
      if (PL) { const sp = side === 1 ? PL.seat1 : PL.seat2; return W(sp[0] + (side === 1 ? -108 : 108), sp[1] + (side === 1 ? 0 : bigShift())); }
      const L = railGeom(curN);
      return W((side === 1 ? -1 : 1) * (L.total / 2 * L.pitch + 42), RAIL_SY);
    }

    function clearPips() {
      for (const p of pipSprs) K.kill(p);
      pipSprs = [];
      pipsBy = { 1: [], 2: [] };
    }
    function clearTrays() {
      for (const s of [1, 2]) {
        if (seatSpr[s]) { K.kill(seatSpr[s]); seatSpr[s] = null; }
        if (badgeSpr[s]) { K.kill(badgeSpr[s]); badgeSpr[s] = null; }
      }
      if (waitTile) { killTile(waitTile); waitTile = null; }
      if (ghost) { killTile(ghost.t); ghost = null; }
      if (railSpr) { K.kill(railSpr); railSpr = null; }
      clearPips();
    }

    function buildTrays() {
      clearTrays();
      const L = railGeom(st.n);
      const sk = Math.min(1.35, curU / PS);
      // seats: the land tile waits on a sand seat on the shore; the sea tile in a sand ring with a lagoon
      const seatT = side => shape(120, 120, 2, b => {
        if (side === 1) { P(b, circ(0, 0, 50), SAND, 0.74); P(b, circ(0, 0, 41), shade(SAND, -0.07), 0.5); }
        else { P(b, circ(0, 0, 50), SAND, 0.6); P(b, circ(0, 0, 41), '#8fbfd0', 0.3); }
      });
      for (const s of [1, 2]) {
        const p = seatPos(s);
        seatSpr[s] = K.spr(seatT(s), { x: p[0], y: p[1], w: 120 * PS * sk, h: 120 * PS * sk, z: 0.12 * PS, zr: (s === 1 ? 0.08 : 0.06) * PS, order: 3, own: true });
      }
      // the rail: a strip of the land paper with a well for every tile
      const rw = L.total * L.pitch + 40, rh = 56 * L.RS;
      const rTex = shape(rw, rh, 2, b => {
        P(b, rrectPath(-L.total / 2 * L.pitch - 12, -17 * L.RS, L.total * L.pitch + 24, 34 * L.RS, 17 * L.RS), SAND, 0.6);
        for (let i = 0; i < L.total; i++) P(b, circ(L.wx(i), 0, 5.2 * L.RS), shade(SAND, -0.12), 0.34);
        P(b, q => q.rect(-1.5, -17 * L.RS, 3, 34 * L.RS), INKSEA, 0.7);
      }, { noMip: true });
      const rp = W(0, railSY());
      railSpr = K.spr(rTex, { x: rp[0], y: rp[1], w: rw * PS, h: rh * PS, z: 0.2 * PS, zr: 0.06 * PS, order: 10, own: true });
      const cnt = logic.count(st);
      const counts = { 1: cnt.x, 2: cnt.o };
      for (const s of [1, 2]) {
        const bp = badgePos(s);
        badgeSpr[s] = K.spr(numTex(counts[s], s), {
          x: bp[0], y: bp[1], w: 66 * PS, h: 66 * PS, z: 0.3 * PS, zr: 0.03 * PS, order: 13, rot: s === 1 ? -0.06 : 0.06, own: false,
        });
      }
      syncTally();
      updateTurnTab();
    }

    function syncTally() {
      if (!st) return;
      const cnt = logic.count(st);
      const counts = { 1: cnt.x, 2: cnt.o };
      for (const s of [1, 2]) if (badgeSpr[s]) badgeSpr[s].tex = numTex(counts[s], s);
      clearPips();
      if (!T.pip[1]) return;
      const L = railGeom(st.n), sz = pipSz();
      for (const side of [1, 2]) {
        for (let i = 0; i < counts[side] && i < L.total; i++) {
          const p = pipPos(side, i);
          const sp = K.spr(T.pip[side], { x: p[0], y: p[1], w: sz, h: sz, z: 0.24 * PS, zr: 0.05 * PS, order: 12, own: false });
          pipSprs.push(sp); pipsBy[side].push(sp);
        }
      }
    }

    // the mover's next tile waits on its seat and breathes; with drop=true it is set down onto the seat (1.12, 0.96, then breathing)
    function updateTurnTab(drop) {
      if (waitTile && st && !st.over && waitSide === st.turn) return;
      if (waitTile) { killTile(waitTile); waitTile = null; }
      if (!st || st.over || !T.landB) return;
      const dp = seatPos(st.turn);
      waitSide = st.turn;
      waitTile = mkTile(dp[0], dp[1], st.turn, st.turn === 1 ? 9 : 8, 9);
      waitBorn = (drop && !K.fast) ? frameNo : frameNo - 2;
      waitFrame(frameNo);
    }

    // =========================== the hint line: always says whose turn it is ===========================
    function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
    function turnHint(side) {
      const nm = nameOfSide(side);
      if (isBotSide(side)) return nm + ' is thinking';
      if (!opt.dots) return side === 1 ? nm + ', raise some land' : nm + ', bring the sea back';
      return side === 1 ? nm + ', put land on a sandy dot' : nm + ', bring the sea back on a white dot';
    }
    function moveHint(side, n) {
      const nm = nameOfSide(side);
      return side === 1 ? nm + ' raises ' + plural(n, 'island') : nm + ' brings the sea back to ' + plural(n, 'island');
    }
    let hintWant = '';
    function say(msg) { hintWant = msg; ctx.setHint(msg); }
    // re-assert the hint when nothing else owns it (a stale line from another turn must never stay)
    function checkHint() {
      if (!st || destroyed || st.over || busyFlag || anim || hintHold > frameNo) return;
      const want = turnHint(st.turn);
      if (hintWant !== want) say(want);
    }
    let hintHold = 0;

    // =========================== move dots, press, peek ===========================
    let dotSprs = []; // { r, c, s }

    function clearDots() {
      for (const d of dotSprs) K.kill(d.s);
      dotSprs = [];
    }

    function showDots(stagger) {
      clearDots();
      if (!st || st.over || busyFlag || !opt.dots || isBotSide(st.turn) || !T.dot[st.turn]) return;
      const moves = logic.legal(st);
      const sz = 24 * curU;
      for (let i = 0; i < moves.length; i++) {
        const r = moves[i][0], c = moves[i][1];
        const p = sqCenter(r, c);
        const s = K.spr(T.dot[st.turn], { x: p[0], y: p[1], w: sz, h: sz, z: 0.25 * PS, zr: 0.03 * PS, order: 11, own: false });
        dotSprs.push({ r, c, s });
        if (stagger && !K.fast) {
          s.alpha = 0;
          addLater(2 + i, () => { s.alpha = 1; s.sc = 1.25; });
          addLater(3 + i, () => { s.sc = 1; });
        }
      }
    }

    // ---- peek before you play: hold a legal square (4 frames) and the tiles that would turn lift and lean away,
    // their other face lying under them; the pips that would cross the rail lift. No numbers, no text. ----
    let peek = null;   // { tgt, a, want, hang, items: [{ t, under, dx, dy }], pips: [{ s, y0 }] }
    let press = null;  // { id, tgt, f0 }
    const PEEK_SLIDE = 14, PEEK_SHORT = 6, PEEK_HOLD = 4; // slide away from the pressed square; the last tile of a line (next to the one that stays) slides only a little

    function restoreDots() { for (const d of dotSprs) d.s.alpha = 1; }
    function peekKill(pk) {
      if (!pk) return;
      killTile(pk.hang);
      for (const it of pk.items) { killTile(it.under); it.under = null; it.t.moving = false; put(it.t, {}); }
      for (const p of pk.pips) { p.s.y = p.y0; p.s.lift = 0; p.s.sc = 1; p.s.order = 12; }
      restoreDots();
    }
    function peekEnd(instant) {
      if (!peek) return;
      if (instant || K.fast) { const pk = peek; peek = null; peekKill(pk); }
      else peek.want = 0;
    }
    function clearPreview() { peekEnd(true); }
    function peekRender() {
      const pk = peek, a = pk.a, U = curU;
      const p = sqCenter(pk.tgt.r, pk.tgt.c);
      put(pk.hang, { y: p[1] - 10 * U * a, sc: 1 + 0.1 * a, z: FLOOR + 1.1 * a, order: 42, alpha: 0.96 });
      for (const it of pk.items) {
        put(it.t, { x: it.t.x + it.dx * it.sl * U * a, y: it.t.y + it.dy * it.sl * U * a, rot: it.t.rot + ((it.dx || it.dy) > 0 || (it.dx === 0 && it.dy === 0) ? 1 : -1) * 0.13 * a, sc: 1 + 0.05 * a, z: FLOOR + 0.9 * a, order: 40 });
      }
      for (const q of pk.pips) { q.s.y = q.y0 - 7 * PS * a; q.s.lift = 0.6 * a; q.s.sc = 1 + 0.15 * a; q.s.order = 43; }
    }
    function peekStart(tgt) {
      peekEnd(true);
      if (!st || st.over || busyFlag || isBotSide(st.turn)) return;
      const side = st.turn, fl = logic.flips(st, tgt.r, tgt.c), p = sqCenter(tgt.r, tgt.c);
      const hang = mkTile(p[0], p[1], side, tgt.r, tgt.c);
      const items = [];
      for (const [fr, fc] of fl) {
        const t = tileGrid[fr] && tileGrid[fr][fc];
        if (!t) continue;
        const under = mkTile(t.x, t.y, side, fr, fc);
        put(under, { sc: 1.1, order: 11 }); // the other face lies under it, a little wider, so its rim shows all round
        t.moving = true;
        items.push({ t, under, fr, fc, dx: Math.sign(fc - tgt.c), dy: Math.sign(fr - tgt.r), sl: PEEK_SLIDE });
      }
      for (const it of items) if (!items.some(o => o.fr === it.fr + it.dy && o.fc === it.fc + it.dx)) it.sl = PEEK_SHORT;
      const arr = pipsBy[3 - side] || [], pips = [];
      for (let j = 0; j < items.length && j < arr.length; j++) { const s = arr[arr.length - 1 - j]; pips.push({ s, y0: s.y }); }
      peek = { tgt, a: 0, want: 1, hang, items, pips };
      for (const d of dotSprs) d.s.alpha = (d.r === tgt.r && d.c === tgt.c) ? 0 : 0.5;
      if (K.fast) peek.a = 1; else peek.a = 0.5;
      peekRender();
    }
    function peekTick() {
      if (press && !peek && press.tgt && frameNo - press.f0 >= PEEK_HOLD && !pressBusy()) peekStart(press.tgt);
      if (!peek) return;
      const pk = peek;
      if (pk.a < pk.want) pk.a = Math.min(pk.want, pk.a + 0.5);
      else if (pk.a > pk.want) pk.a = Math.max(pk.want, pk.a - 0.5);
      if (pk.a === 0 && pk.want === 0) { peek = null; peekKill(pk); return; }
      peekRender();
    }

    function wobbleNearestDots(wx, wy) {
      if (!dotSprs.length || K.fast) return;
      const ranked = dotSprs.slice().sort((a, b) => Math.hypot(a.s.x - wx, a.s.y - wy) - Math.hypot(b.s.x - wx, b.s.y - wy));
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
      const r = Math.floor((wy - (GT[1] - BOARD_HALF)) / sq);
      if (r >= 0 && r < n && c >= 0 && c < n && logic.flips(st, r, c).length > 0) return { r, c };
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
      const r = Math.floor((wy - (GT[1] - BOARD_HALF)) / sq);
      if (r < 0 || r >= n || c < 0 || c >= n) return;
      if (st.grid[r][c] !== '.') return; // occupied square -> nothing
      K.snd.nope();
      wobbleNearestDots(wx, wy);
      const msg = opt.dots ? (st.turn === 1 ? 'Pick a sandy dot' : 'Pick a white dot') : 'That move turns nothing over';
      hintHold = frameNo + 30;
      say(msg);
      if (ctx.speakText) ctx.speakText(msg);
    }

    let commitMoveFn = null;
    let lastMove = null;

    function pressBusy() { return !st || st.over || busyFlag || isBotSide(st.turn); }
    function pressCancel() { press = null; peekEnd(true); }
    const presser = {
      down(e, p) {
        if (pressBusy()) return;
        if (press) { pressCancel(); return; } // second finger cancels
        const tgt = resolveSquare(p);
        if (!tgt) { rejectTap(p); return; }
        press = { id: e.pointerId, tgt, f0: frameNo, tgt0r: tgt.r, tgt0c: tgt.c };
        if (K.fast) peekStart(tgt);
      },
      move(e, p) {
        if (pressBusy()) { if (press) pressCancel(); return; }
        if (!press || e.pointerId !== press.id) return;
        const tgt = resolveSquare(p);
        if (!tgt) { press.tgt = null; peekEnd(false); return; }
        if (!press.tgt || tgt.r !== press.tgt.r || tgt.c !== press.tgt.c) {
          const showing = !!peek;
          press.tgt = tgt; press.f0 = frameNo;
          if (showing || K.fast) peekStart(tgt); // the peek follows the finger
        }
      },
      up(e, p) {
        if (!press || e.pointerId !== press.id) return;
        const pr = press; press = null;
        if (pressBusy()) { peekEnd(true); return; }
        const tgt = e.type === 'pointercancel' ? null : resolveSquare(p);
        const same = tgt && ((peek && peek.tgt.r === tgt.r && peek.tgt.c === tgt.c) || (tgt.r === pr.tgt0r && tgt.c === pr.tgt0c));
        if (!same) { peekEnd(false); return; }
        if (commitMoveFn) commitMoveFn(tgt.r, tgt.c);
        else peekEnd(true);
      },
      cancel() { pressCancel(); },
      active() { return press !== null; },
    };

    // =========================== motion (12 fps frames) ===========================
    let anim = null;
    let enterTurnFn = null;
    let onGameOverFn = null;
    let frameNo = 0;      // 12 fps frame counter, advanced from update(dt)
    let clk = 0;
    let later = [];       // { f, gen, fn }: things to do on a later frame

    const BREATH = [0, 0.02, 0.04, 0.05, 0.05, 0.04, 0.02, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const SX = [1, 0.82, 0.45, 0.14, 0.5, 1, 1, 1, 1], ZZ = [0, 0.45, 0.8, 1.0, 0.8, 0, 0, 0, 0], SC = [1, 1.06, 1.12, 1.16, 1.12, 0.95, 1, 1, 1];
    const FLIP0 = 8, RING_GAP = 2, FL_N = 8, HOP_N = 4;
    const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C D E G A, then the octave

    function addLater(frames, fn) { later.push({ f: frameNo + frames, gen, fn }); }

    function dropAnim() {
      if (anim && anim.newPip) K.kill(anim.newPip);
      if (anim) for (const f of anim.flips) if (f.peek && f.peek.under) { killTile(f.peek.under); f.peek.under = null; }
      anim = null;
      clearMotion();
    }
    function clearMotion() {
      later = [];
      if (ghost) { killTile(ghost.t); ghost = null; }
      if (boardSpr) boardSpr.sc = 1;
    }

    function waitFrame(fr) {
      const t = waitTile;
      if (!t) return;
      const n = fr - waitBorn;
      if (K.fast) { put(t, {}); return; }
      if (n <= 0) put(t, { sc: 1.12, z: 0.8 });                       // set down: lift ...
      else if (n === 1) put(t, { sc: 0.96 });                         // ... settle ...
      else { const b = BREATH[(n - 2) % 16]; put(t, { sc: 1 + b, z: FLOOR + b * 5 }); } // ... then breathe, quietly
    }

    function sndTock(corner) {
      const f = corner ? 75 : 150;
      ctx.tone(f, 0.10, 'sine', corner ? 0.30 : 0.24, f * 0.62);
      ctx.noise(0.05, corner ? 600 : 900, 0.24);
    }
    // sea to land: a marimba-like note per ring, rising up the pentatonic scale
    function sndLand(ring, loud) {
      const hz = SCALE[Math.min(Math.max(ring, 1), SCALE.length) - 1];
      ctx.tone(hz, 0.34, 'sine', loud ? 0.17 : 0.14);
      ctx.tone(hz * 4, 0.07, 'sine', 0.045);
      ctx.noise(0.02, 2800, 0.07);
    }
    // land to sea: a soft swish as the crest runs in (band-passed noise, 120 ms, falling) ...
    function sndSwish() {
      const AC = ctx.audio && ctx.audio();
      if (!AC || !ctx.soundOn || !ctx.soundOn()) return;
      try {
        const d = 0.12, len = Math.max(8, Math.floor(AC.sampleRate * d)), buf = AC.createBuffer(1, len, AC.sampleRate), a = buf.getChannelData(0);
        for (let i = 0; i < len; i++) a[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * Math.min(1, (i / len) * 1.25)) * (1 - i / len);
        const src = AC.createBufferSource(); src.buffer = buf;
        const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
        const t0 = AC.currentTime; f.frequency.setValueAtTime(2800, t0); f.frequency.exponentialRampToValueAtTime(800, t0 + d);
        const g = AC.createGain(); g.gain.value = 0.2;
        src.connect(f).connect(g).connect(AC.destination); src.start();
      } catch (e) { /* no audio */ }
    }
    // ... then the same scale descending, quieter
    function sndSea(ring) {
      const hz = SCALE[SCALE.length - Math.min(Math.max(ring, 1), SCALE.length)];
      ctx.tone(hz, 0.26, 'sine', 0.09);
      ctx.tone(hz * 4, 0.05, 'sine', 0.02);
    }

    // one frame k (1-based, from the lift) of a move; a stateless function of k
    function animFrame(a, k) {
      const U = a.U, side = a.side, opp = 3 - side, p = a.placed;
      // the placed tile: lift 1, carried 2-4 on an arc, hover 5, press 6 ("tock"), rest 7
      if (k === 1) put(p, { x: a.dx, y: a.dy - 6 * U, sc: 1.12, z: 0.9, order: 42 });
      else if (k <= 4) {
        const u = (k - 1) / 4, e = 1 - (1 - u) * (1 - u);
        put(p, { x: lerp(a.dx, a.tx, e), y: lerp(a.dy, a.ty, e) - Math.sin(u * Math.PI) * 46 * U, sc: 1.14, z: 1.3, order: 42 });
      } else if (k === 5) put(p, { x: a.tx, y: a.ty - 4 * U, sc: 1.1, z: FLOOR + 0.6, order: 42 });
      else if (k === 6) {
        put(p, { x: a.tx, y: a.ty, sc: a.corner ? 0.92 : 0.95, order: 40 });
        sndTock(a.corner);
        if (a.corner && boardSpr) boardSpr.sc = 0.995;
      } else if (k === 7) { put(p, { sc: a.corner ? 0.92 : 1 }); if (boardSpr) boardSpr.sc = 1; }
      else put(p, {});

      // the flip: 8 frames a tile, rings 2 frames apart; each tile tips away from the one just placed
      for (const f of a.flips) {
        const st0 = FLIP0 + (f.ring - 1) * RING_GAP, u = clamp(k - st0, 0, FL_N), t = f.t;
        const mid = Math.sin(Math.min(u, 6) / 6 * Math.PI), air = u > 0 && u < 5;
        const o = {
          sx: SX[u], z: FLOOR + ZZ[u], sc: SC[u], order: (u > 0 && u < 8) ? 40 : 12, rot: air ? f.ang : undefined,
          x: t.x + Math.cos(f.ang) * 5 * U * (air ? mid : 0), y: t.y + Math.sin(f.ang) * 5 * U * (air ? mid : 0),
        };
        t.moving = u < FL_N;
        const edge = u === 3;
        if (edge) t.b.tex = T.edge; else setFace(t, u < 3 ? opp : side);
        if (side === 1) {
          // SEA to LAND: the crest tips off, the sand comes up bare, then the island is pushed up through it
          o.talpha = u < 3 ? 1 : u < 5 ? 0 : 1;
          o.tsc = u === 5 ? 0.55 : u === 6 ? 1.22 : u === 7 ? 0.95 : 1;
          o.tz = u === 6 ? 1.0 : u === 5 ? 0.3 : 0;
          if (u === 6 && k === st0 + 6 && f.first) sndLand(f.ring, f.ringN > 1);
        } else {
          // LAND to SEA: a white crest runs in from the placed tile, covers the island, the tile turns under it, the crest overshoots and slides back
          if (u >= 1 && u <= 2) {
            t.top.tex = T.crest; t.top.w = T.crest.uw * U; t.top.h = T.crest.uh * U;
            o.tsc = 1.6; o.tz = 0.9; o.tx = -Math.cos(f.ang) * (u === 1 ? 30 : 6); o.ty = -Math.sin(f.ang) * (u === 1 ? 30 : 6);
            o.sx = 1; o.z = FLOOR; o.sc = u === 2 ? 0.97 : 1; o.rot = undefined; o.x = t.x; o.y = t.y;
            if (u === 1 && k === st0 + 1 && f.first) sndSwish();
          } else if (u === 3 || u === 4) { o.talpha = 0; }
          else if (u === 5) {
            o.tsc = 1.3; o.tx = Math.cos(f.ang) * 10; o.ty = Math.sin(f.ang) * 10; o.tz = 0.5;
            if (k === st0 + 5 && f.first) sndSea(f.ring);
          } else if (u === 6) { o.tsc = 0.95; o.tx = -Math.cos(f.ang) * 2; o.ty = -Math.sin(f.ang) * 2; }
        }
        if (f.peek) {
          if (u === 0) { // still held up from the peek, waiting for its ring
            o.x = t.x + f.peek.dx * f.peek.sl * U; o.y = t.y + f.peek.dy * f.peek.sl * U;
            o.rot = t.rot + ((f.peek.dx || f.peek.dy) > 0 ? 1 : -1) * 0.13; o.sc = 1.05; o.z = FLOOR + 0.9; o.order = 40; o.sx = 1;
          } else if (f.peek.under) { killTile(f.peek.under); f.peek.under = null; }
        }
        put(t, o);
      }

      // the tally: the placed tile adds one pip; each turned tile sends one pip across the gap, turning over in flight
      const np = a.newPip;
      if (np) {
        np.alpha = k >= 5 ? 1 : 0;
        np.lift = k === 5 ? 0.6 : 0; np.sc = k === 5 ? 1.3 : (k === 6 ? 0.92 : 1);
        np.y = a.npY - (k === 5 ? 8 * U : 0);
      }
      let nP = a.cP0 + (k >= 6 ? 1 : 0), nO = a.cO0;
      for (const h of a.hops) {
        const u = lim01((k - h.arrive) / HOP_N), arc = Math.sin(u * Math.PI);
        const s = h.s;
        s.x = lerp(h.x0, h.x1, u); s.y = lerp(h.y0, h.y1, u) - arc * 34 * PS;
        s.lift = arc * 1.4; s.sx = (u > 0 && u < 1) ? Math.max(0.2, Math.abs(Math.cos(u * Math.PI))) : 1;
        s.tex = T.pip[u >= 0.5 ? side : opp];
        s.order = (u > 0 && u < 1) ? 43 : 12;
        if (u > 0) nO--;
        if (u >= 1) nP++;
      }
      for (const [sd, n] of [[side, nP], [opp, nO]]) {
        const bs = badgeSpr[sd];
        if (!bs) continue;
        const changed = a.shown[sd] !== n;
        if (changed) { a.shown[sd] = n; bs.tex = numTex(n, sd); }
        bs.sc = changed ? 0.94 : 1;
      }
    }

    function endAnim() {
      // all pips down: rebuild the tally from the true state; settle every tile in its final face
      const a = anim;
      anim = null;
      if (a.newPip) K.kill(a.newPip);
      for (const f of a.flips) { f.t.moving = false; if (f.peek && f.peek.under) { killTile(f.peek.under); f.peek.under = null; } setFace(f.t, a.side); put(f.t, {}); }
      put(a.placed, {});
      for (const bs of [badgeSpr[1], badgeSpr[2]]) if (bs) bs.sc = 1;
      syncTally();
      if (a.res.over || a.res.pass) finishMove(a.res);
    }

    // frame clock: everything moves on whole 12 fps frames
    function tickFrame() {
      if (anim) {
        anim.k++;
        animFrame(anim, anim.k);
        if (anim.k === anim.endK + 1 && !anim.tail) {
          anim.tail = true;
          if (!anim.res.over && !anim.res.pass) finishMove(anim.res);
        }
        if (anim && anim.k >= anim.tailEnd) endAnim();
      }
      waitFrame(frameNo);
      bobTiles();
      peekTick();
      if (ghost) {
        const n = frameNo - ghost.born, t = ghost.t;
        if (n === 0) put(t, { sc: 1.12, z: 0.8 });
        else if (n === 1) put(t, { sc: 0.96 });
        else if (n === 2) put(t, { rot: t.rot + 0.16 });
        else if (n === 3) put(t, { rot: t.rot - 0.12 });
        else if (n === 4) put(t, {});
        else if (n === 5) put(t, { sc: 0.7, alpha: 0.7 });
        else if (n === 6) put(t, { sc: 0.35, alpha: 0.35 });
        else { killTile(t); ghost = null; }
      }
      if (later.length) {
        const due = later.filter(e => e.f <= frameNo);
        if (due.length) {
          later = later.filter(e => e.f > frameNo);
          for (const e of due) if (e.gen === gen) e.fn();
        }
      }
      if ((frameNo & 3) === 0) checkHint();
    }

    // a side with no move: its tile drops onto its seat, wobbles "no", sinks; then the other seat's tile comes back
    function passSeat(side) {
      if (K.fast || !T.landB) return;
      const dp = seatPos(side);
      if (ghost) killTile(ghost.t);
      const t = mkTile(dp[0], dp[1], side, side === 1 ? 9 : 8, 9);
      ghost = { t, born: frameNo };
      put(t, { sc: 1.12, z: 0.8 });
      addLater(8, () => updateTurnTab(true));
    }

    // the end: the winner's pips hop once each from the middle mark outward, the number lifts
    function endHopFrames() {
      const w = st && st.winner;
      if (K.fast || !w) return 0;
      const arr = (pipsBy[w] || []).slice().reverse();
      const two = arr.length > 16;
      let last = 0;
      arr.forEach((s, j) => {
        const f0 = two ? (j >> 1) : j;
        const y0 = s.y, up = 12 * PS;
        last = Math.max(last, f0 + 2);
        addLater(1 + f0, () => { s.y = y0 - up; s.lift = 0.9; });
        addLater(2 + f0, () => { s.y = y0; s.lift = 0; });
      });
      const bs = badgeSpr[w];
      if (bs) {
        addLater(1, () => { bs.sc = 1.15; });
        addLater(4, () => { bs.sc = 1; });
      }
      return Math.max(last, 4);
    }

    function finishMove(res) {
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
        say(againName + ' goes again');
        hintHold = frameNo + 24;
        if (ctx.speakText) ctx.speakText('No moves for ' + passedName + '. ' + againName + ' goes again');
        const myGen = gen;
        busyFlag = true;
        passSeat(res.pass);
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

    function isCorner(r, c) {
      const m = st.n - 1;
      return (r === 0 || r === m) && (c === 0 || c === m);
    }

    function commitMove(r, c) {
      if (anim && anim.tail) endAnim();
      if (!st || st.over || busyFlag || anim) return false;
      const res = logic.play(st, r, c);
      if (!res) return false;

      pushHistSnapshot(cloneState(st), moveCount);
      const placedSide = st.turn;
      st = res.state;
      moveCount++;
      const pk = (peek && peek.want === 1 && peek.tgt.r === r && peek.tgt.c === c && !K.fast) ? peek : null;
      if (pk) peek = null; else peekEnd(true);
      press = null;
      clearDots();
      lastMove = { r, c };
      say(moveHint(placedSide, res.flipped.length));
      if (host.onLayout) host.onLayout();

      const tp = sqCenter(r, c);
      if (K.fast) {
        if (waitTile) { killTile(waitTile); waitTile = null; }
        tileGrid[r][c] = mkTile(tp[0], tp[1], placedSide, r, c);
        for (let i = 0; i < res.flipped.length; i++) {
          const t = tileGrid[res.flipped[i][0]] && tileGrid[res.flipped[i][0]][res.flipped[i][1]];
          if (t) { setFace(t, placedSide); put(t, {}); }
        }
        K.snd.slap(true);
        syncTally();
        finishMove(res);
        return { flipped: res.flipped };
      }

      busyFlag = true;
      const side = placedSide, opp = 3 - side;
      const dp = seatPos(side);
      let placed = null;
      if (pk) { placed = pk.hang; if (waitTile) { killTile(waitTile); waitTile = null; } for (const q of pk.pips) { q.s.y = q.y0; q.s.lift = 0; q.s.sc = 1; q.s.order = 12; } }
      else if (waitTile && waitSide === side) { placed = waitTile; waitTile = null; }
      else {
        if (waitTile) { killTile(waitTile); waitTile = null; }
        placed = mkTile(dp[0], dp[1], side, r, c);
      }
      placed.x = tp[0]; placed.y = tp[1];
      bindSquare(placed, r, c);
      setFace(placed, side);
      tileGrid[r][c] = placed;

      // the turned tiles: nearest ring first; ring = distance from the placed tile
      const list = [];
      const keys = Object.keys(res.rings).map(Number).sort((x, y) => x - y);
      let maxRing = 1;
      for (const kk of keys) {
        const coords = res.rings[kk];
        maxRing = Math.max(maxRing, kk);
        coords.forEach((co, j) => {
          const t = tileGrid[co[0]] && tileGrid[co[0]][co[1]];
          if (!t) return;
          const cp = sqCenter(co[0], co[1]);
          list.push({ t, ring: kk, ringN: coords.length, first: j === 0, idx: j, ang: Math.atan2(cp[1] - tp[1], cp[0] - tp[0]), peek: pk ? pk.items.find(it => it.t === t) : null });
        });
      }
      const cnt1 = logic.count(st);
      const cP1 = side === 1 ? cnt1.x : cnt1.o, cO1 = side === 1 ? cnt1.o : cnt1.x;
      const nF = list.length;
      const cP0 = cP1 - 1 - nF, cO0 = cO1 + nF;

      const hops = [];
      list.forEach((f, j) => {
        const s = pipsBy[opp][cO0 - 1 - j];
        if (!s) return;
        const from = pipPos(opp, cO0 - 1 - j), to = pipPos(side, cP0 + 1 + j);
        const st0 = FLIP0 + (f.ring - 1) * RING_GAP;
        hops.push({ s, x0: from[0], y0: from[1], x1: to[0], y1: to[1], arrive: st0 + 5 + (f.idx % 3) });
      });
      const sz = pipSz();
      const np = T.pip[side] ? K.spr(T.pip[side], { x: 0, y: 0, w: sz, h: sz, z: 0.24 * PS, zr: 0.05 * PS, order: 43, own: false, alpha: 0 }) : null;
      const npPos = pipPos(side, cP0);
      if (np) { np.x = npPos[0]; np.y = npPos[1]; }

      const endK = FLIP0 + (maxRing - 1) * RING_GAP + FL_N;
      const tailEnd = Math.max(endK + 2, ...hops.map(h => h.arrive + HOP_N + 1));
      anim = {
        k: 0, side, placed, res, flips: list, hops, newPip: np, npY: npPos[1],
        dx: dp[0], dy: dp[1], tx: tp[0], ty: tp[1], U: curU, cP0, cO0, corner: isCorner(r, c),
        endK, tailEnd, tail: false, shown: { 1: -1, 2: -1 },
      };
      anim.shown[side] = cP0; anim.shown[opp] = cO0;
      anim.k = pk ? 5 : 1; // after a peek the tile is already hanging over its square
      animFrame(anim, anim.k);
      return { flipped: res.flipped };
    }

    commitMoveFn = commitMove;

    // =========================== turn display, bot turns, undo ===========================
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
      updateTurnTab(hop);
      hintHold = 0;

      if (isBotSide(side)) {
        clearDots();
        say(turnHint(side));
        if (host.onLayout) host.onLayout();
        showTurnDisplay(side, hop);
        const myGen = gen;
        const delay = K.botDelay();
        K.after(delay, () => {
          if (destroyed || myGen !== gen || !st || st.over || busyFlag || (anim && !anim.tail) || !isBotSide(st.turn)) return;
          const mv = logic.bot(st, opt.bot, K.rnd);
          if (mv) commitMove(mv[0], mv[1]);
        });
      } else {
        showDots(hop);
        say(turnHint(side));
        if (host.onLayout) host.onLayout();
        showTurnDisplay(side, hop);
        if (hop && ctx.speakText) ctx.speakText(nameOfSide(side) + ', your turn');
      }
    }

    enterTurnFn = enterTurn;

    // =========================== the end: touching tiles join, the board stays as the children's map ===========================
    let endShown = false;
    let endArt = null;     // { spr, stage, decos: [] }
    let endUi = null;      // { strip, again, games }

    function tileDist(r, c) { const m = lastMove || { r: st.n >> 1, c: st.n >> 1 }; return Math.max(Math.abs(r - m.r), Math.abs(c - m.c)); }
    function maxDist() { let m = 0; for (let r = 0; r < st.n; r++) for (let c = 0; c < st.n; c++) if (st.grid[r][c] !== '.') m = Math.max(m, tileDist(r, c)); return m; }

    // one coast texture from the final state, up to ring s from the last tile played:
    // deep sea under every tile edge to edge; every land tile's sand grows to a round, one more between two that touch, one in the middle of four; the green does the same inside
    function bakeCoast(s) {
      const n = st.n, CM = 544 / n, kk = CM / 68, HALF = 272;
      const occ = (c, r) => c >= 0 && r >= 0 && c < n && r < n && st.grid[r][c] !== '.' && tileDist(r, c) <= s;
      const land = (c, r) => occ(c, r) && st.grid[r][c] === 'x';
      const X = c => (c + 0.5) * CM - HALF;
      const coastP = (R, R2) => q => {
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
          if (!land(c, r)) continue;
          const x = X(c), y = X(r), j = k => (hs(c, r, k) - 0.5) * 7 * kk;
          circ(x + j(1), y + j(2), R + j(3) * 0.4)(q);
          if (land(c + 1, r)) circ(x + CM / 2, y + j(4), R2 + j(5) * 0.5)(q);
          if (land(c, r + 1)) circ(x + j(6), y + CM / 2, R2 + j(7) * 0.5)(q);
          if (land(c + 1, r) && land(c, r + 1) && land(c + 1, r + 1)) circ(x + CM / 2, y + CM / 2, R)(q);
        }
      };
      return shape(2 * HALF + 20, 2 * HALF + 20, 1.5, b => {
        P(b, q => { for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (occ(c, r)) q.rect(X(c) - CM / 2 - 0.5, X(r) - CM / 2 - 0.5, CM + 1, CM + 1); }, BLUE, 0.3);
        P(b, coastP(37 * kk, 35 * kk), SAND, 0.66);
        P(b, coastP(28 * kk, 26 * kk), GREEN, 0.84);
      }, { noMip: true });
    }

    function endStage(s, quiet) {
      if (!st || !st.over || destroyed) return;
      const tex = bakeCoast(s);
      if (!endArt) {
        const uw = (2 * 272 + 20) * PS;
        endArt = { spr: K.spr(tex, { x: GT[0], y: GT[1], w: uw, h: uw, z: FLOOR * PS, zr: 0.12 * PS, order: 14, own: true }), decos: [] };
      } else { const old = endArt.spr.tex; endArt.spr.tex = tex; if (old) B.freeTex(old); }
      const U = curU;
      for (let r = 0; r < st.n; r++) for (let c = 0; c < st.n; c++) {
        const t = tileGrid[r] && tileGrid[r][c];
        if (!t || t.joined || tileDist(r, c) > s) continue;
        t.joined = true; t.moving = false;
        t.b.alpha = 0;
        if (t.v === 2) { // about 60% of the sea squares keep their crest
          if (hs(c, r, 12) < 0.62) { t.top.x = t.x + (hs(c, r, 2) - 0.5) * 14 * U; t.jy = (hs(c, r, 3) - 0.5) * 12 * U; t.top.order = 15; }
          else t.top.alpha = 0;
        } else { // about a third of the islands keep a hill
          t.top.alpha = 0;
          if (hs(c, r, 13) < 0.36) {
            const sd = t.sd;
            endArt.decos.push(K.spr(T.hill[sd], { x: t.x + (hs(c, r, 2) - 0.5) * 16 * U, y: t.y + (hs(c, r, 3) - 0.5) * 16 * U, w: 40 * U, h: 40 * U, z: (FLOOR + 0.16) * PS, zr: 0.06 * PS, order: 15, own: false }));
          }
        }
      }
      if (!K.fast && !quiet) ctx.tone(SCALE[Math.min(s, SCALE.length - 1)], 0.3, 'sine', 0.07);
    }

    // after the last flip, 6 frames of rest; then ring by ring from the last tile played (3 frames a ring) the tiles join
    function endSweep() {
      const mx = maxDist();
      if (K.fast) { endStage(mx, true); return 0; }
      for (let s = 0; s <= mx; s++) addLater(6 + 3 * s, () => endStage(s));
      return 6 + 3 * (mx + 1);
    }

    function clearEndUi() {
      endShown = false;
      if (endArt) { K.kill(endArt.spr); for (const d of endArt.decos) K.kill(d); endArt = null; }
      if (endUi) { for (const k of ['strip', 'again', 'games']) if (endUi[k]) { K.kill(endUi[k]); } endUi = null; }
    }

    function labelTex(str, px, bg, ink, maxW) {
      const m = document.createElement('canvas').getContext('2d');
      const meas = f => { m.font = `800 ${f}px ${FONT}`; return m.measureText(str).width + f * 0.9; };
      let f = px, w = meas(f);
      if (maxW && w > maxW) { f = Math.max(14, f * maxW / w); w = meas(f); }
      const h = f * 1.45;
      return shape(w + 12, h + 12, 2, b => {
        P(b, rrectPath(-w / 2, -h / 2, w, h, f * 0.3), bg, 0.6);
        const c = b.c; c.fillStyle = ink; c.font = `800 ${f}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(str, 0, f * 0.06);
      });
    }
    function labelSpr(str, px, bg, ink, sx, sy, rot) {
      const t = labelTex(str, px, bg, ink, 400);
      const p = W(sx, sy);
      return K.spr(t, { x: p[0], y: p[1], w: t.uw * PS, h: t.uh * PS, z: 0.5 * PS, zr: 0.04 * PS, order: 60, rot, own: true });
    }

    function endLine2() {
      if (st.winner === 0) return 'A draw: as much land as sea';
      return st.winner === 1 ? nameOfSide(1) + ' wins: more land than sea' : nameOfSide(2) + ' wins: more sea than land';
    }

    // the score strip and the two buttons stand beside the board, over the sea player's side
    function buildEndUi(celebrate) {
      if (endUi) { for (const k of ['strip', 'again', 'games']) if (endUi[k]) K.kill(endUi[k]); endUi = null; }
      if (!st || !st.over || destroyed) return;
      endShown = true;
      const cnt = logic.count(st);
      const line1 = nameOfSide(1) + ' ' + cnt.x + '   ' + nameOfSide(2) + ' ' + cnt.o;
      const line2 = endLine2();
      endUi = {
        strip: labelSpr(line1, 40, BLUE_D, LABEL, ...(PL ? [0, PL.seat2[1] - 14] : [500, -110]), 0.03),
        again: labelSpr('Play again', 29, GREEN, LABEL, ...(PL ? [-112, PL.seat2[1] + 50] : [500, 150]), -0.02),
        games: labelSpr('Games', 29, PAP[8], ctx.INK, ...(PL ? [112, PL.seat2[1] + 50] : [500, 215]), 0.02),
      };
      if (celebrate) {
        if (ctx.sfx && ctx.sfx.wake) ctx.sfx.wake();
        say(line2);
        if (host.onLayout) host.onLayout();
        if (st.winner) showTurnDisplay(st.winner, true);
        if (ctx.speakText) ctx.speakText(line1 + '. ' + line2);
      }
    }
    function endHit(spr, p) {
      if (!spr || !p || !p.w) return false;
      const wpx = ctx.worldPx ? ctx.worldPx() : 1;
      const hw = Math.max(spr.w * 0.5, 26 / wpx) + 6, hh = Math.max(spr.h * 0.5, 24 / wpx) + 6;
      return Math.abs(p.w[0] - spr.x) <= hw && Math.abs(p.w[1] - spr.y) <= hh;
    }
    function tapEnd(spr, fn) {
      if (!K.fast) K.tw(spr, { sc: 0.94 }, 1 / 12, { cut: true, done: () => K.tw(spr, { sc: 1 }, 1 / 12, { cut: true }) });
      K.snd.slap(true);
      fn();
    }

    function onGameOver() {
      if (!st || !st.over || destroyed) return;
      clearDots();
      clearPreview();
      updateTurnTab();
      const winnerSeat = st.winner === 0 ? 0 : seatOf(st.winner);
      if (host.onOver) host.onOver(winnerSeat);
      const myGen = gen;
      const hopFrames = endHopFrames();
      const sweepFrames = endSweep();
      K.after(Math.max(0.6, (Math.max(hopFrames + 2, sweepFrames) + 2) / 12), () => {
        if (destroyed || myGen !== gen || !st || !st.over) return;
        buildEndUi(true);
      });
    }

    onGameOverFn = onGameOver;

    function buildAll() {
      setGeometry();
      ensurePage();
      ensureTileTextures();
      buildBoard();
      syncTilesFromState();
      buildTrays();
    }

    function start(o, info) {
      gen++;
      dropAnim();
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
      clearPreview();
      clearDots();
      buildAll();
      frameCamera(!!(info && info.immediate));
      enterTurn(false);
    }

    function down(e, p) {
      if (endShown) {
        if (endUi && endHit(endUi.again, p)) { tapEnd(endUi.again, () => { if (host.again) host.again(); }); return; }
        if (endUi && endHit(endUi.games, p)) { tapEnd(endUi.games, () => { if (host.openBox) host.openBox(); }); return; }
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
      if (destroyed) return;
      clk += dt;
      const target = Math.floor(clk * 12 + 1e-6);
      while (frameNo < target) {
        frameNo++;
        tickFrame();
      }
    }
    function layoutHud() {
      if (!st || destroyed) return;
      if (ensurePage()) {
        buildTrays();
        if (endShown) buildEndUi(false);
      }
      frameCamera(true);
      if (!st.over) showTurnDisplay(st.turn, false);
    }
    function rebake() {
      if (!st || destroyed) return;
      clearPage();
      clearPreview();
      const wasEnd = endShown;
      clearEndUi();
      buildAll();
      showDots();
      frameCamera(true);
      if (!st.over) showTurnDisplay(st.turn, false);
      else if (wasEnd) { endArtQuiet(); buildEndUi(false); }
    }
    function endArtQuiet() { endStage(maxDist(), true); }
    function canUndo() {
      if (!st || st.over || busyFlag || (anim && !anim.tail)) return false;
      return opt.players === 1 ? humanUndoCount > 0 : hist.len() > 0;
    }
    function undo() {
      if (!canUndo()) return;
      gen++;
      dropAnim();
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
      syncTilesFromState();
      syncTally();
      if (ctx.sfx && ctx.sfx.back) ctx.sfx.back();
      enterTurn(false);
    }

    function destroy() {
      destroyed = true;
      gen++;
      dropAnim();
      presser.cancel();
      clearEndUi();
      clearPreview();
      clearDots();
      clearTiles();
      clearTrays();
      if (boardSpr) { K.kill(boardSpr); boardSpr = null; }
      clearPage();
      freeTileTextures();
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
        dropAnim();
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
        setGeometry();
        if (sizeChanged) { ensureTileTextures(); buildBoard(); }
        syncTilesFromState();
        if (sizeChanged) buildTrays(); else syncTally();
        showTurnDisplay(st.turn, false);
        updateTurnTab();
        showDots();
        say(turnHint(st.turn));
        if (host.onLayout) host.onLayout();
      },
      play(r, c) {
        return commitMove(r, c);
      },
      bot() {
        if (!st || st.over || busyFlag || (anim && !anim.tail) || destroyed) return null;
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
