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
  // BOARD_UI_HERE (to be added in Milestone 3b)
})();
