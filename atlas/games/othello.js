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
  // BOARD_UI_HERE (to be added in Milestone 4b)
})();
