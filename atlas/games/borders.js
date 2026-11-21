(function () {
  'use strict';
  const PG = window.PAPER_GAMES = window.PAPER_GAMES || { logic: {} };

  const EPS = 0.35;
  const L_MIN = 0.7;
  const REMOVE = [['MA', 'MR']];
  const BRIDGES = {
    sa: [],
    eu: [['DK', 'SE'], ['GB', 'FR']],
    af: [['MZ', 'MG']],
    as: [['IN', 'LK'], ['KR', 'JP'], ['MY', 'PH']],
  };
  const BOARD_NAMES = {
    sa: 'South America',
    eu: 'Europe',
    af: 'Africa',
    as: 'Asia',
  };
  const BOARD_ORDER = ['sa', 'eu', 'af', 'as'];

  // Appendix A fixture for start-up self-check
  const FIXTURE = {
    sa: {
      ids: ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE'],
      edges: 23,
    },
    eu: {
      ids: [
        'AL', 'AT', 'BA', 'BE', 'BG', 'BY', 'CH', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB',
        'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LV', 'MD', 'ME', 'MK', 'NL', 'NO', 'PL', 'PT', 'RO',
        'RS', 'SE', 'SI', 'SK', 'UA',
      ],
      edges: 64,
    },
    af: {
      ids: [
        'AO', 'BF', 'BI', 'BJ', 'BW', 'CD', 'CF', 'CG', 'CI', 'CM', 'DJ', 'DZ', 'EG', 'ER', 'ET',
        'GA', 'GH', 'GM', 'GN', 'GQ', 'GW', 'KE', 'LR', 'LS', 'LY', 'MA', 'MG', 'ML', 'MR', 'MW',
        'MZ', 'NA', 'NE', 'NG', 'RW', 'SD', 'SL', 'SN', 'SO', 'SS', 'SZ', 'TD', 'TG', 'TN', 'TZ',
        'UG', 'ZA', 'ZM', 'ZW',
      ],
      edges: 103,
    },
    as: {
      ids: [
        'AE', 'AF', 'AM', 'AZ', 'BD', 'BT', 'CN', 'GE', 'ID', 'IL', 'IN', 'IQ', 'IR', 'JO', 'JP',
        'KG', 'KH', 'KP', 'KR', 'KW', 'KZ', 'LA', 'LB', 'LK', 'MM', 'MN', 'MY', 'NP', 'OM', 'PH',
        'PK', 'QA', 'RU', 'SA', 'SY', 'TH', 'TJ', 'TL', 'TM', 'TR', 'UZ', 'VN', 'YE',
      ],
      edges: 77,
    },
  };

  let lastGraph = null;

  function isCardCountry(c) {
    if (c.card !== undefined) return !!c.card;
    const bw = c.bbox[2] - c.bbox[0];
    const bh = c.bbox[3] - c.bbox[1];
    return Math.sqrt(bw * bh) < 7 || Math.max(bw, bh) < 9.5 || (c.cont === 'oc' && Math.max(bw, bh) < 24);
  }

  function ptSegDistSq(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return (px - ax) * (px - ax) + (py - ay) * (py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    return (px - cx) * (px - cx) + (py - cy) * (py - cy);
  }

  function ringBbox(r) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < r.length; i += 2) {
      const x = r[i], y = r[i + 1];
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    return [x0, y0, x1, y1];
  }

  function boxesClose(a, b, eps) {
    return !(a[2] + eps < b[0] || b[2] + eps < a[0] || a[3] + eps < b[1] || b[3] + eps < a[1]);
  }

  function shared(A, B) {
    if (!boxesClose(A.bbox, B.bbox, EPS)) return 0;
    const eps2 = EPS * EPS;
    let total = 0;
    for (let ia = 0; ia < A.rings.length; ia++) {
      const ra = A.rings[ia];
      const ba = A.rbboxes[ia];
      const candB = [];
      for (let ib = 0; ib < B.rings.length; ib++) {
        if (boxesClose(ba, B.rbboxes[ib], EPS)) candB.push(B.rings[ib]);
      }
      if (!candB.length) continue;
      const n = ra.length >> 1;
      const onB = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const px = ra[i * 2], py = ra[i * 2 + 1];
        let ok = false;
        for (let k = 0; k < candB.length && !ok; k++) {
          const rb = candB[k], m = rb.length >> 1;
          for (let j = 0, p = m - 1; j < m; p = j++) {
            if (ptSegDistSq(px, py, rb[p * 2], rb[p * 2 + 1], rb[j * 2], rb[j * 2 + 1]) <= eps2) {
              ok = true;
              break;
            }
          }
        }
        onB[i] = ok ? 1 : 0;
      }
      for (let i = 0, p = n - 1; i < n; p = i++) {
        if (!onB[p] || !onB[i]) continue;
        const ax = ra[p * 2], ay = ra[p * 2 + 1];
        const bx = ra[i * 2], by = ra[i * 2 + 1];
        const mx = (ax + bx) * 0.5, my = (ay + by) * 0.5;
        let ok = false;
        for (let k = 0; k < candB.length && !ok; k++) {
          const rb = candB[k], m = rb.length >> 1;
          for (let j = 0, q = m - 1; j < m; q = j++) {
            if (ptSegDistSq(mx, my, rb[q * 2], rb[q * 2 + 1], rb[j * 2], rb[j * 2 + 1]) <= eps2) {
              ok = true;
              break;
            }
          }
        }
        if (ok) total += Math.hypot(bx - ax, by - ay);
      }
    }
    return total;
  }

  function graph(GEO) {
    const removeSet = new Set();
    for (const [a, b] of REMOVE) {
      removeSet.add(a + '-' + b);
      removeSet.add(b + '-' + a);
    }

    const playable = [];
    for (const c of (GEO && GEO.countries) || []) {
      if (isCardCountry(c)) continue;
      const rings = (c.polys || []).map(p => (Array.isArray(p) ? p : (p.o || [])));
      playable.push({
        id: c.id,
        cont: c.cont,
        bbox: c.bbox,
        rings,
        rbboxes: rings.map(ringBbox),
      });
    }

    const landAdj = {};
    for (const c of playable) landAdj[c.id] = [];

    for (let i = 0; i < playable.length; i++) {
      const A = playable[i];
      for (let j = i + 1; j < playable.length; j++) {
        const B = playable[j];
        if (removeSet.has(A.id + '-' + B.id)) continue;
        if (Math.max(shared(A, B), shared(B, A)) >= L_MIN) {
          landAdj[A.id].push(B.id);
          landAdj[B.id].push(A.id);
        }
      }
    }

    const boards = {};
    const adj = {};

    for (const cont of BOARD_ORDER) {
      const inCont = playable.filter(c => c.cont === cont).map(c => c.id);
      const inSet = new Set(inCont);
      const contAdj = {};
      for (const id of inCont) {
        contAdj[id] = landAdj[id].filter(o => inSet.has(o));
      }
      const bridges = [];
      for (const [a, b] of BRIDGES[cont]) {
        if (inSet.has(a) && inSet.has(b)) {
          bridges.push([a, b]);
          if (!contAdj[a].includes(b)) contAdj[a].push(b);
          if (!contAdj[b].includes(a)) contAdj[b].push(a);
        }
      }

      // Largest connected component
      const vis = new Set();
      let best = [];
      for (const id of inCont) {
        if (vis.has(id)) continue;
        const comp = [];
        const q = [id];
        vis.add(id);
        for (let qi = 0; qi < q.length; qi++) {
          const u = q[qi];
          comp.push(u);
          for (const v of contAdj[u]) {
            if (!vis.has(v)) {
              vis.add(v);
              q.push(v);
            }
          }
        }
        if (comp.length > best.length) best = comp;
      }

      best.sort();
      const bestSet = new Set(best);
      const boardAdj = {};
      const landEdges = [];
      for (const a of best) {
        boardAdj[a] = contAdj[a].filter(b => bestSet.has(b)).sort();
        adj[a] = boardAdj[a].slice();
        for (const b of landAdj[a]) {
          if (bestSet.has(b) && a < b) landEdges.push(a + '-' + b);
        }
      }
      landEdges.sort();

      const resting = inCont.filter(id => !bestSet.has(id)).sort();

      boards[cont] = {
        id: cont,
        cont,
        name: BOARD_NAMES[cont],
        ids: best,
        adj: boardAdj,
        landEdges,
        bridges,
        resting,
      };

      const fx = FIXTURE[cont];
      if (fx) {
        const sameIds = best.length === fx.ids.length && best.every((v, idx) => v === fx.ids[idx]);
        if (!sameIds || landEdges.length !== fx.edges) {
          console.error('borders graph changed', cont, {
            gotIds: best.length,
            expIds: fx.ids.length,
            gotEdges: landEdges.length,
            expEdges: fx.edges,
          });
        }
      }
    }

    lastGraph = { adj, boards };
    return lastGraph;
  }

  function resolveBoard(board, graphObj) {
    if (board && typeof board === 'object' && Array.isArray(board.ids)) return board;
    const g = graphObj || lastGraph;
    if (g && g.boards && g.boards[board]) return g.boards[board];
    return null;
  }

  function boardIds(state, graphObj) {
    const b = resolveBoard(state.board, graphObj);
    if (b) return b.ids;
    if (FIXTURE[state.board]) return FIXTURE[state.board].ids;
    return Object.keys(state.owner).sort();
  }

  function getAdj(state, graphObj, id) {
    const b = resolveBoard(state.board, graphObj);
    if (b && b.adj && b.adj[id]) return b.adj[id];
    if (graphObj && graphObj.adj && graphObj.adj[id]) return graphObj.adj[id];
    if (lastGraph && lastGraph.adj && lastGraph.adj[id]) return lastGraph.adj[id];
    return [];
  }

  function start(board, rule = 'snort', firstTurn = 1, graphObj) {
    const bObj = resolveBoard(board, graphObj);
    const boardId = bObj ? bObj.id : board;
    const ids = bObj ? bObj.ids : (FIXTURE[boardId] ? FIXTURE[boardId].ids : []);
    const owner = {};
    for (let i = 0; i < ids.length; i++) owner[ids[i]] = 0;
    return {
      board: boardId,
      rule,
      owner,
      turn: firstTurn,
      moves: [],
      over: false,
      winner: 0,
    };
  }

  function can(state, graphObj, id, p = state.turn) {
    if (!state || !state.owner || state.owner[id] !== 0) return false;
    const nbs = getAdj(state, graphObj, id);
    const forbid = state.rule === 'snort' ? (3 - p) : p;
    for (let i = 0; i < nbs.length; i++) {
      if (state.owner[nbs[i]] === forbid) return false;
    }
    return true;
  }

  function legal(state, graphObj, p) {
    if (!state) return [];
    const who = p === undefined ? state.turn : p;
    if (state.over && p === undefined) return [];
    const ids = boardIds(state, graphObj);
    const out = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (can(state, graphObj, id, who)) out.push(id);
    }
    return out;
  }

  function marks(state, graphObj) {
    const out = {};
    if (!state || !state.owner) return out;
    const ids = boardIds(state, graphObj);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (state.owner[id] !== 0) continue;
      const c1 = can(state, graphObj, id, 1);
      const c2 = can(state, graphObj, id, 2);
      if (c1 && c2) continue;
      if (c1) out[id] = 'p1';
      else if (c2) out[id] = 'p2';
      else out[id] = 'closed';
    }
    return out;
  }

  function play(state, graphObj, id) {
    if (!state || state.over || !can(state, graphObj, id, state.turn)) return null;
    const owner = Object.assign({}, state.owner);
    owner[id] = state.turn;
    const moves = state.moves.concat(id);
    const nextTurn = 3 - state.turn;
    const ids = boardIds(state, graphObj);
    const forbid = state.rule === 'snort' ? (3 - nextTurn) : nextTurn;

    let nextHasMove = false;
    for (let i = 0; i < ids.length; i++) {
      const cid = ids[i];
      if (owner[cid] !== 0) continue;
      const nbs = getAdj(state, graphObj, cid);
      let ok = true;
      for (let j = 0; j < nbs.length; j++) {
        if (owner[nbs[j]] === forbid) { ok = false; break; }
      }
      if (ok) { nextHasMove = true; break; }
    }

    const over = !nextHasMove;
    const winner = over ? state.turn : 0;
    return {
      board: state.board,
      rule: state.rule,
      owner,
      turn: nextTurn,
      moves,
      over,
      winner,
    };
  }

  function bot(state, graphObj, level = 'easy', rnd = Math.random) {
    const moves = legal(state, graphObj, state.turn);
    if (!moves.length) return null;
    if (level === 'easy' || moves.length === 1) {
      return moves[Math.floor(rnd() * moves.length)];
    }

    const ids = boardIds(state, graphObj);
    const n = ids.length;
    const idxOf = {};
    for (let i = 0; i < n; i++) idxOf[ids[i]] = i;

    const adjIdx = new Array(n);
    for (let i = 0; i < n; i++) {
      const nbs = getAdj(state, graphObj, ids[i]);
      const arr = [];
      for (let j = 0; j < nbs.length; j++) {
        const k = idxOf[nbs[j]];
        if (k !== undefined) arr.push(k);
      }
      adjIdx[i] = arr;
    }

    const own = new Uint8Array(n);
    for (let i = 0; i < n; i++) own[i] = state.owner[ids[i]] || 0;

    const snort = state.rule === 'snort';
    const me = state.turn;
    const opp = 3 - me;

    function canIdx(arr, i, p) {
      if (arr[i] !== 0) return false;
      const forbid = snort ? (3 - p) : p;
      const nbs = adjIdx[i];
      for (let j = 0; j < nbs.length; j++) {
        if (arr[nbs[j]] === forbid) return false;
      }
      return true;
    }

    // Count countries open to at least one player
    let openAny = 0;
    for (let i = 0; i < n; i++) {
      if (own[i] === 0 && (canIdx(own, i, 1) || canIdx(own, i, 2))) openAny++;
    }

    function heuristic1Ply() {
      let bestScore = -1e9;
      let bestMoves = [];
      const meMoves = [];
      for (let i = 0; i < moves.length; i++) meMoves.push(idxOf[moves[i]]);

      for (let mi = 0; mi < meMoves.length; mi++) {
        const m = meMoves[mi];
        own[m] = me;

        // Gather opponent's replies
        const oppReplies = [];
        for (let i = 0; i < n; i++) {
          if (canIdx(own, i, opp)) oppReplies.push(i);
        }

        let moveScore;
        if (oppReplies.length === 0) {
          moveScore = 1000;
        } else {
          let worst = 1e9;
          for (let ri = 0; ri < oppReplies.length; ri++) {
            const r = oppReplies[ri];
            own[r] = opp;

            let onlyMe = 0;
            let onlyOpp = 0;
            let meHasReply = false;
            for (let i = 0; i < n; i++) {
              if (own[i] !== 0) continue;
              const cMe = canIdx(own, i, me);
              const cOpp = canIdx(own, i, opp);
              if (cMe) meHasReply = true;
              if (cMe && !cOpp) onlyMe++;
              else if (cOpp && !cMe) onlyOpp++;
            }
            const e = meHasReply ? (onlyMe - onlyOpp) : -1000;
            if (e < worst) worst = e;

            own[r] = 0;
          }
          moveScore = worst;
        }

        own[m] = 0;

        if (moveScore > bestScore) {
          bestScore = moveScore;
          bestMoves = [ids[m]];
        } else if (moveScore === bestScore) {
          bestMoves.push(ids[m]);
        }
      }
      return bestMoves[Math.floor(rnd() * bestMoves.length)];
    }

    if (openAny <= 14) {
      const memo = new Map();
      let nodes = 0;
      const NODE_CAP = 20000;
      let aborted = false;

      function keyOf(turn) {
        let s = '';
        for (let i = 0; i < n; i++) s += own[i];
        return s + turn;
      }

      function minimax(turn) {
        if (aborted) return 0;
        if (++nodes > NODE_CAP) {
          aborted = true;
          return 0;
        }
        const key = keyOf(turn);
        const cached = memo.get(key);
        if (cached !== undefined) return cached;

        const mvs = [];
        for (let i = 0; i < n; i++) {
          if (canIdx(own, i, turn)) mvs.push(i);
        }
        if (mvs.length === 0) {
          const val = turn === me ? -1 : 1;
          memo.set(key, val);
          return val;
        }

        const maximizing = turn === me;
        const nextTurn = 3 - turn;
        let best = maximizing ? -1 : 1;
        for (let i = 0; i < mvs.length; i++) {
          const mv = mvs[i];
          own[mv] = turn;
          const v = minimax(nextTurn);
          own[mv] = 0;
          if (aborted) return 0;
          if (maximizing) {
            if (v > best) best = v;
            if (best === 1) break;
          } else {
            if (v < best) best = v;
            if (best === -1) break;
          }
        }
        memo.set(key, best);
        return best;
      }

      let bestVal = -2;
      let bestMoves = [];
      for (let i = 0; i < moves.length; i++) {
        const m = idxOf[moves[i]];
        own[m] = me;
        const v = minimax(opp);
        own[m] = 0;
        if (aborted) break;
        if (v > bestVal) {
          bestVal = v;
          bestMoves = [moves[i]];
        } else if (v === bestVal) {
          bestMoves.push(moves[i]);
        }
      }
      if (!aborted && bestMoves.length > 0) {
        return bestMoves[Math.floor(rnd() * bestMoves.length)];
      }
    }

    return heuristic1Ply();
  }

  PG.logic.borders = {
    EPS,
    L_MIN,
    REMOVE,
    BRIDGES,
    FIXTURE,
    graph,
    start,
    can,
    legal,
    marks,
    play,
    bot,
  };
  // BOARD_UI_HERE (to be added in Milestone 2b)
})();
