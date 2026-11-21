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
  let cachedGraph = null;
  function getGraph(GEO) {
    if (!cachedGraph && GEO) cachedGraph = graph(GEO);
    return cachedGraph;
  }

  PG.borders = function (ctx, K, host) {
    const B = ctx.GFX;
    const L = PG.logic.borders;
    const G = getGraph(ctx.GEO);

    let opt = { players: 1, bot: 'easy', rule: 'snort', board: 'sa' };
    let state = null;
    let board = null;
    let boardSet = new Set();
    let baseCam = null;
    let boardRegion = null;
    let sheetSpr = null;
    let bridgeSprs = [];
    const pieceSprs = {};
    const markSprs = {};
    const markKinds = {};
    let previewSpr = null;
    let previewId = null;
    let previewTag = null;
    let hintRing = null;
    let ribbonSpr = null;
    let againBtn = null;
    let gamesBtn = null;
    let hist = K.makeHist();
    let placing = false;
    let botPending = false;
    let marksBaking = 0;
    let canZoom = false;
    let zoomLevel = 0;
    let destroyed = false;
    let gen = 0;

    const ZOOM_STEPS = [1, 1.6, 2.6];

    function isBotTurn() {
      return !!(state && !state.over && opt.players === 1 && state.turn === 2);
    }

    function isBusy() {
      return placing || botPending || marksBaking > 0;
    }

    function computeRegion(b) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const id of b.ids) {
        const c = ctx.C[id];
        if (!c) continue;
        if (c.bbox[0] < x0) x0 = c.bbox[0];
        if (c.bbox[1] < y0) y0 = c.bbox[1];
        if (c.bbox[2] > x1) x1 = c.bbox[2];
        if (c.bbox[3] > y1) y1 = c.bbox[3];
      }
      return [x0 - 12, y0 - 12, x1 + 12, y1 + 12];
    }

    function mapInnerBounds() {
      const wf = ctx.worldFrame ? ctx.worldFrame() : null;
      const cx = (wf && typeof wf.x === 'number') ? wf.x : 1000;
      // Inner sea edge inside the world map's black paper frame (~[-28, -28, 2025, 993])
      return [cx - 1022, -22, cx + 1018, 988];
    }

    function computeBaseCam() {
      const m = {
        l: 0.03,
        r: 0.03,
        t: (ctx.topHudBottom() + 12) / 1000,
        b: ctx.PHONE ? 0.06 : 0.04,
      };
      baseCam = ctx.fitCam(boardRegion, m, 0, false);
      const mb = mapInnerBounds();
      if (mb) {
        const asp = ctx.asp();
        const mw = mb[2] - mb[0], mh = mb[3] - mb[1];
        const hw = baseCam.h * asp * 0.5;
        const hh = baseCam.h * 0.5;
        if (hw * 2 <= mw) {
          baseCam.x = ctx.clamp(baseCam.x, mb[0] + hw, mb[2] - hw);
        } else {
          baseCam.x = (mb[0] + mb[2]) * 0.5;
        }
        if (hh * 2 <= mh) {
          baseCam.y = ctx.clamp(baseCam.y, mb[1] + hh, mb[3] - hh);
        } else {
          baseCam.y = (mb[1] + mb[3]) * 0.5;
        }
      }
      const pxPerUnit = Math.max(1e-4, window.innerHeight / Math.max(1, baseCam.h));
      let minPx = 1e9;
      for (const id of board.ids) {
        const c = ctx.C[id];
        if (!c) continue;
        const lenPx = Math.max(c.bw, c.bh) * pxPerUnit;
        if (lenPx < minPx) minPx = lenPx;
      }
      canZoom = minPx < 30;
    }

    function clampCam(x, y, h) {
      if (!baseCam) return { x, y, h };
      const asp = ctx.asp();
      const ch = ctx.clamp(h, baseCam.h / 2.6, baseCam.h);
      const minX = baseCam.x - baseCam.h * asp * 0.5;
      const maxX = baseCam.x + baseCam.h * asp * 0.5;
      const minY = baseCam.y - baseCam.h * 0.5;
      const maxY = baseCam.y + baseCam.h * 0.5;
      const hw = ch * asp * 0.5;
      const hh = ch * 0.5;
      const cx = hw * 2 <= maxX - minX ? ctx.clamp(x, minX + hw, maxX - hw) : baseCam.x;
      const cy = hh * 2 <= maxY - minY ? ctx.clamp(y, minY + hh, maxY - hh) : baseCam.y;
      return { x: cx, y: cy, h: ch };
    }

    function zoom(dir, btnSprite) {
      if (!canZoom || !baseCam || !state || state.over) {
        if (btnSprite) ctx.startWobble(btnSprite);
        return;
      }
      const curScale = baseCam.h / Math.max(1, ctx.cam.h);
      let idx = 0;
      for (let i = 1; i < ZOOM_STEPS.length; i++) {
        if (Math.abs(curScale - ZOOM_STEPS[i]) < Math.abs(curScale - ZOOM_STEPS[idx])) idx = i;
      }
      const next = ctx.clamp(idx + (dir > 0 ? 1 : -1), 0, ZOOM_STEPS.length - 1);
      if (next === idx && ((dir > 0 && curScale >= 2.52) || (dir < 0 && curScale <= 1.04))) {
        if (btnSprite) ctx.startWobble(btnSprite);
        return;
      }
      zoomLevel = next;
      const dur = K.isFast() ? 0 : 0.3;
      if (zoomLevel === 0) {
        if (dur === 0) {
          ctx.killTw(ctx.cam);
          ctx.cam.x = baseCam.x; ctx.cam.y = baseCam.y; ctx.cam.h = baseCam.h;
        } else {
          ctx.camTo(baseCam.x, baseCam.y, baseCam.h, dur);
        }
      } else {
        const cl = clampCam(ctx.cam.x, ctx.cam.y, baseCam.h / ZOOM_STEPS[zoomLevel]);
        if (dur === 0) {
          ctx.killTw(ctx.cam);
          ctx.cam.x = cl.x; ctx.cam.y = cl.y; ctx.cam.h = cl.h;
        } else {
          ctx.camTo(cl.x, cl.y, cl.h, dur);
        }
      }
    }

    function bakeBoardSheet() {
      if (sheetSpr) { K.kill(sheetSpr); sheetSpr = null; }
      const asp = ctx.asp();
      const vx0 = baseCam.x - baseCam.h * asp * 0.5;
      const vx1 = baseCam.x + baseCam.h * asp * 0.5;
      const vy0 = baseCam.y - baseCam.h * 0.5;
      const vy1 = baseCam.y + baseCam.h * 0.5;
      const reg = [
        Math.max(-40, Math.min(boardRegion[0], vx0) - 60),
        Math.max(-40, Math.min(boardRegion[1], vy0) - 60),
        Math.min(2040, Math.max(boardRegion[2], vx1) + 60),
        Math.min(1020, Math.max(boardRegion[3], vy1) + 60),
      ];
      const w = Math.max(10, reg[2] - reg[0]);
      const h = Math.max(10, reg[3] - reg[1]);
      const ppu = Math.min(9, 3800 / w, 2600 / h);
      const b = B.bake(w * ppu, h * ppu);
      b.s = ppu;
      for (const x of [b.c, b.g]) {
        x.setTransform(ppu, 0, 0, ppu, -reg[0] * ppu, -reg[1] * ppu);
      }

      const visC = ctx.GEO.countries.filter(
        cc => cc.bbox[2] >= reg[0] - 8 && cc.bbox[0] <= reg[2] + 8 &&
              cc.bbox[3] >= reg[1] - 8 && cc.bbox[1] <= reg[3] + 8
      );
      const boardC = [];
      const otherC = [];
      for (const cc of visC) {
        if (boardSet.has(cc.id)) boardC.push(cc);
        else otherC.push(cc);
      }
      const hasAq = reg[3] > 800 && ctx.GEO.aq;

      const drawOther = q => {
        for (const cc of otherC) for (const r of cc.polys) ctx.ring(q, r, 0, 0, 1);
        for (const r of (ctx.GEO.neutral || [])) ctx.ring(q, r, 0, 0, 1);
        if (hasAq) ctx.ring(q, ctx.GEO.aq, 0, 0, 1);
      };
      const c = b.c;
      c.fillStyle = ctx.TERR_PAPER;
      c.strokeStyle = ctx.TERR_PAPER;
      c.lineWidth = 0.7;
      c.lineJoin = 'round';
      c.beginPath(); drawOther(c); c.fill('evenodd'); c.stroke();
      b.g.fillStyle = B.grey(0.58);
      b.g.strokeStyle = B.grey(0.58);
      b.g.lineWidth = 0.5;
      b.g.lineJoin = 'round';
      b.g.beginPath(); drawOther(b.g); b.g.fill('evenodd'); b.g.stroke();

      const drawBoard = q => {
        for (const cc of boardC) for (const r of cc.polys) ctx.ring(q, r, 0, 0, 1);
      };
      c.fillStyle = ctx.PALE;
      c.strokeStyle = ctx.PALE;
      c.lineWidth = 0.7;
      c.lineJoin = 'round';
      c.beginPath(); drawBoard(c); c.fill('evenodd'); c.stroke();
      b.g.fillStyle = B.grey(0.66);
      b.g.strokeStyle = B.grey(0.66);
      b.g.lineWidth = 0.5;
      b.g.lineJoin = 'round';
      b.g.beginPath(); drawBoard(b.g); b.g.fill('evenodd'); b.g.stroke();

      for (const cc of boardC) {
        const d = (ctx.hs(ctx.sid(cc.id), 3) - 0.5) * 0.05;
        c.fillStyle = ctx.shade(ctx.PALE, d);
        c.beginPath();
        for (const r of cc.polys) ctx.ring(c, r, 0, 0, 1);
        c.fill('evenodd');
      }
      for (const cc of boardC) {
        for (let pass = 0; pass < 2; pass++) {
          c.strokeStyle = `rgba(72,74,86,${pass ? 0.3 : 0.5})`;
          c.lineWidth = pass ? 0.3 : 0.42;
          c.setLineDash(pass ? [] : [7, 0.6, 3, 0.4]);
          c.beginPath();
          for (const r of cc.polys) ctx.ring(c, r, pass * 0.25, -pass * 0.2, 1);
          c.stroke();
        }
        c.setLineDash([]);
      }

      sheetSpr = K.spr(B.tex(b), {
        x: (reg[0] + reg[2]) / 2,
        y: (reg[1] + reg[3]) / 2,
        w,
        h,
        z: 0.20,
        zr: 0.04,
        order: 30,
        own: true,
      });
    }

    function baseScrPpu() {
      return Math.max(1e-4, window.innerHeight / Math.max(1, baseCam ? baseCam.h : 500));
    }

    function dprScale() {
      return Math.max(1, B.size()[1] / Math.max(1, window.innerHeight));
    }

    function bbPiece(c, p) {
      const scrPpu = baseScrPpu();
      const dpr = dprScale();
      const pad = 4;
      const md = Math.max(c.bw, c.bh, 1);
      const maxPpu = (1400 - pad * 2) / md;
      const ppu = Math.max(1, Math.min(scrPpu * dpr, maxPpu));
      const k = ppu / scrPpu; // texture px per base-frame screen px
      const b = B.bake(c.bw * ppu + pad * 2, c.bh * ppu + pad * 2);
      const ox = c.cx - b.w / (2 * ppu);
      const oy = c.cy - b.h / (2 * ppu);

      b.g.save();
      b.g.beginPath();
      for (const r of c.polys) ctx.ring(b.g, r, ox, oy, ppu);
      b.g.clip('evenodd');

      const baseCol = p === 1 ? K.COL.p1 : K.COL.p2;
      b.c.fillStyle = baseCol;
      b.c.fillRect(0, 0, b.w, b.h);
      b.g.fillStyle = B.grey(0.55);
      b.g.fillRect(0, 0, b.w, b.h);

      if (p === 1) {
        // Raised diagonal strips (45 deg, 3 px wide, every 10 px, shade -0.18, relief 0.72)
        const step = 10 * k;
        const sw = 3 * k;
        const pat = q => {
          q.beginPath();
          for (let d = -b.h; d < b.w + b.h; d += step) {
            q.moveTo(d, 0);
            q.lineTo(d + sw, 0);
            q.lineTo(d + sw - b.h, b.h);
            q.lineTo(d - b.h, b.h);
            q.closePath();
          }
          q.fill();
        };
        b.c.fillStyle = K.COL.p1Dark;
        pat(b.c);
        b.g.fillStyle = B.grey(0.72);
        pat(b.g);
      } else {
        // Punched dots (diameter 4.5 px, every 12 px on staggered grid, shade +0.25, relief 0.25)
        const step = 12 * k;
        const rowStep = step * 0.866;
        const rad = 2.25 * k;
        const pat = q => {
          q.beginPath();
          for (let row = 0, y = rowStep * 0.5; y < b.h + rad; row++, y += rowStep) {
            const x0 = (row % 2) ? step * 0.5 : 0;
            for (let x = x0; x < b.w + rad; x += step) {
              q.moveTo(x + rad, y);
              q.arc(x, y, rad, 0, Math.PI * 2);
            }
          }
          q.fill();
        };
        b.c.fillStyle = K.COL.p2Light;
        pat(b.c);
        b.g.fillStyle = B.grey(0.25);
        pat(b.g);
      }

      b.g.restore();
      const tex = B.tex(b);
      return { tex, w: b.w / ppu, h: b.h / ppu };
    }

    function bbMark(c, kind) {
      const scrPpu = baseScrPpu();
      const dpr = dprScale();
      const pad = 3;
      const md = Math.max(c.bw, c.bh, 1);
      const maxPpu = (512 - pad * 2) / md;
      const ppu = Math.max(1, Math.min(scrPpu * dpr, maxPpu));
      const k = ppu / scrPpu;
      const b = B.bake(c.bw * ppu + pad * 2, c.bh * ppu + pad * 2);
      const ox = c.cx - b.w / (2 * ppu);
      const oy = c.cy - b.h / (2 * ppu);

      const col = kind === 'p1' ? K.COL.p1 : (kind === 'p2' ? K.COL.p2 : K.COL.closed);
      b.c.fillStyle = col;
      b.c.fillRect(0, 0, b.w, b.h);

      b.g.save();
      b.g.beginPath();
      for (const r of c.polys) ctx.ring(b.g, r, ox, oy, ppu);
      b.g.clip('evenodd');
      b.g.fillStyle = B.grey(0.05);

      if (kind === 'p1' || kind === 'closed') {
        const step = 14 * k;
        const sw = 2 * k;
        b.g.beginPath();
        for (let d = -b.h; d < b.w + b.h; d += step) {
          b.g.moveTo(d, 0);
          b.g.lineTo(d + sw, 0);
          b.g.lineTo(d + sw - b.h, b.h);
          b.g.lineTo(d - b.h, b.h);
          b.g.closePath();
        }
        b.g.fill();
      }
      if (kind === 'p2' || kind === 'closed') {
        const step = 14 * k;
        const rowStep = step * 0.866;
        const rad = 1.75 * k;
        b.g.beginPath();
        for (let row = 0, y = rowStep * 0.5; y < b.h + rad; row++, y += rowStep) {
          const x0 = (row % 2) ? step * 0.5 : 0;
          for (let x = x0; x < b.w + rad; x += step) {
            b.g.moveTo(x + rad, y);
            b.g.arc(x, y, rad, 0, Math.PI * 2);
          }
        }
        b.g.fill();
      }
      b.g.restore();

      const tex = B.tex(b);
      return { tex, w: b.w / ppu, h: b.h / ppu };
    }

    function applyMarkNow(id, kind, animate) {
      if (markSprs[id]) { K.kill(markSprs[id]); delete markSprs[id]; }
      const c = ctx.C[id];
      if (!c || !kind) { delete markKinds[id]; return; }
      const m = bbMark(c, kind);
      const lift0 = (animate && !K.isFast()) ? 0.12 : 0;
      const s = K.spr(m.tex, {
        x: c.cx,
        y: c.cy,
        w: m.w,
        h: m.h,
        z: 0.21,
        zr: 0.04,
        order: 34,
        lift: lift0,
        own: true,
      });
      if (lift0 > 0) K.tw(s, { lift: 0 }, 2 / 12, { cut: true });
      markSprs[id] = s;
      markKinds[id] = kind;
    }

    function syncMarks(animate, onDone) {
      const target = L.marks(state, G);
      for (const id of Object.keys(markSprs)) {
        if (!target[id]) {
          K.kill(markSprs[id]);
          delete markSprs[id];
          delete markKinds[id];
        }
      }
      const todo = [];
      for (const id of Object.keys(target)) {
        if (markKinds[id] !== target[id]) {
          todo.push([id, target[id]]);
        }
      }
      if (!todo.length) {
        if (onDone) onDone();
        return;
      }
      if (!animate || K.isFast()) {
        for (const [id, kind] of todo) applyMarkNow(id, kind, false);
        if (onDone) onDone();
        return;
      }
      const myGen = gen;
      marksBaking += todo.length;
      for (const [id, kind] of todo) {
        K.job(() => {
          if (destroyed || myGen !== gen) return;
          marksBaking = Math.max(0, marksBaking - 1);
          applyMarkNow(id, kind, true);
          if (marksBaking === 0 && onDone) onDone();
        });
      }
    }

    function makeCountryTag(c) {
      const name = ctx.normSaint(c.name);
      const sc = ctx.devPerHud();
      const t = ctx.textTex(name, 28, { strip: ctx.HUD_PAPER, col: ctx.INK, cut: true, scale: sc, noMip: true });
      const pt = ctx.w2h(c.cx, c.bbox[1]);
      const W = 1000 * ctx.asp();
      const hw = t.lw * 0.5;
      const hx = ctx.clamp(pt[0], hw + 18, W - hw - 18);
      const topLim = ctx.topHudBottom() + t.lh * 0.5 + 10;
      const hy = Math.max(topLim, pt[1] - t.lh * 0.65 - 10);
      return K.spr(t, {
        hud: true,
        z: 0.16,
        zr: 0.03,
        order: 218,
        x: hx,
        y: hy,
        w: t.lw,
        h: t.lh,
        rot: -0.01,
        lift: 0.08,
        own: true,
      });
    }

    function clearPreview() {
      if (previewSpr) { K.kill(previewSpr); previewSpr = null; }
      if (previewTag) { K.kill(previewTag); previewTag = null; }
      previewId = null;
    }

    function showPreview(id) {
      if (previewId === id && previewSpr) return;
      clearPreview();
      const c = ctx.C[id];
      if (!c || !state) return;
      const pc = bbPiece(c, state.turn);
      previewSpr = K.spr(pc.tex, {
        x: c.cx,
        y: c.cy,
        w: pc.w,
        h: pc.h,
        z: 0.24,
        zr: 0.05,
        order: 40,
        lift: 0.6,
        rot: 3 * ctx.DEG,
        own: true,
      });
      previewTag = makeCountryTag(c);
      previewId = id;
    }

    function closestVertexPair(cA, cB) {
      let bestD2 = Infinity;
      let ax0 = cA.cx, ay0 = cA.cy, bx0 = cB.cx, by0 = cB.cy;
      const polysA = cA.polys || [];
      const polysB = cB.polys || [];
      for (let ia = 0; ia < polysA.length; ia++) {
        const ra = polysA[ia];
        for (let i = 0; i < ra.length; i += 2) {
          const ax = ra[i], ay = ra[i + 1];
          for (let ib = 0; ib < polysB.length; ib++) {
            const rb = polysB[ib];
            for (let j = 0; j < rb.length; j += 2) {
              const dx = ax - rb[j], dy = ay - rb[j + 1];
              const d2 = dx * dx + dy * dy;
              if (d2 < bestD2) {
                bestD2 = d2;
                ax0 = ax; ay0 = ay;
                bx0 = rb[j]; by0 = rb[j + 1];
              }
            }
          }
        }
      }
      return [ax0, ay0, bx0, by0];
    }

    function clearBridges() {
      for (const s of bridgeSprs) K.kill(s);
      bridgeSprs = [];
    }

    function bakeBridges() {
      clearBridges();
      if (!board || !board.bridges || !board.bridges.length) return;
      const ppuBase = Math.max(18, Math.min(48, baseScrPpu() * dprScale() * 2.2));
      const camH = baseCam ? baseCam.h : 400;
      const wid = Math.max(4.2, Math.min(5.6, camH * 0.007));
      const overlap = Math.max(4.5, wid * 1.1);
      const pad = Math.max(1.4, wid * 0.35);
      for (const [idA, idB] of board.bridges) {
        const cA = ctx.C[idA], cB = ctx.C[idB];
        if (!cA || !cB) continue;
        const [ax, ay, bx, by] = closestVertexPair(cA, cB);
        const mx = (ax + bx) * 0.5;
        const my = (ay + by) * 0.5;
        const dist = Math.hypot(bx - ax, by - ay);
        const ang = Math.atan2(by - ay, bx - ax);
        const len = Math.max(11, dist + overlap * 2);
        const ppu = Math.min(ppuBase, 1024 / (len + pad * 2));
        const b = B.bake((len + pad * 2) * ppu, (wid + pad * 2) * ppu);
        b.s = ppu;
        const x0 = pad * ppu, y0 = pad * ppu;
        const x1 = (pad + len) * ppu, y1 = (pad + wid) * ppu;
        const seed = ctx.sid(idA + '-' + idB) + 17;
        const edge = ctx.cutEdge(x0, y0, x1, y1, 0.35 * ppu, seed);
        B.paper(b, edge, '#f6eedc', 0.65);

        // Dark plank cross-lines clipped inside the bridge
        b.c.save(); b.g.save();
        b.c.beginPath(); edge(b.c); b.c.clip();
        b.g.beginPath(); edge(b.g); b.g.clip();
        const nPlanks = Math.max(3, Math.min(10, Math.round(len / (wid * 0.9))));
        const lw = Math.max(1.6, wid * 0.14 * ppu);
        for (let i = 1; i <= nPlanks; i++) {
          const u = i / (nPlanks + 1);
          const px = x0 + (x1 - x0) * u;
          b.c.strokeStyle = 'rgba(34,34,41,0.88)';
          b.c.lineWidth = lw;
          b.c.lineCap = 'round';
          b.c.beginPath();
          b.c.moveTo(px, y0 + 0.12 * ppu);
          b.c.lineTo(px, y1 - 0.12 * ppu);
          b.c.stroke();

          b.g.strokeStyle = B.grey(0.32);
          b.g.lineWidth = lw;
          b.g.beginPath();
          b.g.moveTo(px, y0 + 0.12 * ppu);
          b.g.lineTo(px, y1 - 0.12 * ppu);
          b.g.stroke();
        }
        b.c.restore(); b.g.restore();

        // Dark ink outline around the bridge perimeter so it reads clearly over sea and pale land
        b.c.save();
        b.c.strokeStyle = '#222229';
        b.c.lineWidth = Math.max(2.0, wid * 0.16 * ppu);
        b.c.lineJoin = 'round';
        b.c.beginPath();
        edge(b.c);
        b.c.stroke();
        b.c.restore();

        const s = K.spr(B.tex(b), {
          x: mx,
          y: my,
          w: b.w / ppu,
          h: b.h / ppu,
          rot: ang,
          z: 0.27,
          zr: 0.05,
          order: 41,
          own: true,
        });
        bridgeSprs.push(s);
      }
    }

    const activeTags = [];
    const ptrs = new Map();
    let pressPtrId = null;
    let pressId = null;
    let hoverId = null;
    let pinch = null;
    let pan = null;

    function clearFloatingTags() {
      while (activeTags.length) K.kill(activeTags.pop());
    }

    function clearHintRing() {
      if (hintRing) { K.kill(hintRing); hintRing = null; }
    }

    function countryAnchor(c) {
      if (!c) return [0, 0];
      if (c._bbAnchor) return c._bbAnchor;
      const polys = c.polys || [];
      if (polys.length && ctx.pipPolys(c.cx, c.cy, polys)) {
        return (c._bbAnchor = [c.cx, c.cy]);
      }
      // Pick interior point of largest polygon ring
      let bestRing = null;
      let bestArea = -1;
      for (let i = 0; i < polys.length; i++) {
        const r = polys[i];
        let a = 0;
        const n = r.length >> 1;
        for (let k = 0, j = n - 1; k < n; j = k++) {
          a += r[j * 2] * r[k * 2 + 1] - r[k * 2] * r[j * 2 + 1];
        }
        a = Math.abs(a) * 0.5;
        if (a > bestArea) { bestArea = a; bestRing = r; }
      }
      if (!bestRing || bestRing.length < 6) return (c._bbAnchor = [c.cx, c.cy]);
      const n = bestRing.length >> 1;
      let sx = 0, sy = 0, y0 = 1e9, y1 = -1e9;
      for (let i = 0; i < n; i++) {
        const x = bestRing[i * 2], y = bestRing[i * 2 + 1];
        sx += x; sy += y;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      sx /= n; sy /= n;
      if (ctx.pipPolys(sx, sy, polys)) return (c._bbAnchor = [sx, sy]);
      // Scanline across several horizontal slices, pick midpoint of widest inside span
      let bestSpan = -1;
      let bx = c.cx, by = c.cy;
      for (let s = 1; s <= 7; s++) {
        const ym = y0 + (y1 - y0) * (s / 8);
        const xs = [];
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const xi = bestRing[i * 2], yi = bestRing[i * 2 + 1];
          const xj = bestRing[j * 2], yj = bestRing[j * 2 + 1];
          if ((yi > ym) !== (yj > ym)) xs.push(xi + (xj - xi) * (ym - yi) / (yj - yi));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) {
          const span = xs[i + 1] - xs[i];
          const mx = (xs[i] + xs[i + 1]) * 0.5;
          if (span > bestSpan && ctx.pipPolys(mx, ym, polys)) {
            bestSpan = span;
            bx = mx; by = ym;
          }
        }
      }
      return (c._bbAnchor = [bx, by]);
    }

    function resolveWorldPoint(wx, wy) {
      if (!board) return null;
      // (a) board country containing point (smallest by polyArea)
      let hitId = null;
      let bestArea = Infinity;
      for (const id of board.ids) {
        const c = ctx.C[id];
        if (!c) continue;
        if (wx < c.bbox[0] || wx > c.bbox[2] || wy < c.bbox[1] || wy > c.bbox[3]) continue;
        if (ctx.pipPolys(wx, wy, c.polys)) {
          const a = ctx.polyArea(c);
          if (a < bestArea) { bestArea = a; hitId = id; }
        }
      }
      if (hitId) return { kind: 'board', id: hitId };

      // (b) nearest board country vertex within 22 screen px
      const tol = 22 / Math.max(1e-4, ctx.worldPx());
      const tol2 = tol * tol;
      let nearId = null;
      let nearD2 = tol2;
      for (const id of board.ids) {
        const c = ctx.C[id];
        if (!c) continue;
        if (wx < c.bbox[0] - tol || wx > c.bbox[2] + tol || wy < c.bbox[1] - tol || wy > c.bbox[3] + tol) continue;
        for (const r of c.polys) {
          for (let i = 0; i < r.length; i += 2) {
            const dx = r[i] - wx, dy = r[i + 1] - wy;
            const d2 = dx * dx + dy * dy;
            if (d2 <= nearD2) { nearD2 = d2; nearId = id; }
          }
        }
      }
      if (nearId) return { kind: 'board', id: nearId };

      // (c) resting country or country of another continent under the point
      let otherId = null;
      let otherArea = Infinity;
      for (const c of ctx.GEO.countries) {
        if (boardSet.has(c.id)) continue;
        if (wx < c.bbox[0] || wx > c.bbox[2] || wy < c.bbox[1] || wy > c.bbox[3]) continue;
        if (ctx.pipPolys(wx, wy, c.polys)) {
          const a = ctx.polyArea(c);
          if (a < otherArea) { otherArea = a; otherId = c.id; }
        }
      }
      if (otherId) return { kind: 'other', id: otherId };

      // (d) sea
      return null;
    }

    function showHint(msg) {
      ctx.setHint(msg);
      if (host && host.onLayout) host.onLayout();
    }

    function colorWord(p) {
      return p === 1 ? 'orange' : 'blue';
    }

    function handleIllegal(hit) {
      if (!hit || !state || state.over) return;
      if (hit.kind === 'other') {
        const c = ctx.C[hit.id];
        if (!c) return;
        const msg = ctx.inSent(c, true) + ' is not on this map';
        showHint(msg);
        K.snd.nope();
        ctx.speakText(msg);
        return;
      }
      const id = hit.id;
      const c = ctx.C[id];
      if (!c) return;
      const own = state.owner[id] || 0;
      if (own !== 0) {
        if (pieceSprs[id]) ctx.startWobble(pieceSprs[id]);
        const msg = ctx.inSent(c, true) + ' is taken';
        showHint(msg);
        K.snd.nope();
        ctx.speakText(msg);
        return;
      }
      // Unclaimed but illegal due to adjacency rule
      const p = state.turn;
      const forbid = state.rule === 'snort' ? (3 - p) : p;
      const nbs = (board.adj && board.adj[id]) || [];
      for (const nid of nbs) {
        if (state.owner[nid] === forbid && pieceSprs[nid]) {
          ctx.startWobble(pieceSprs[nid]);
        }
      }
      let msg;
      if (state.rule === 'snort') {
        msg = 'Too close to ' + colorWord(forbid);
      } else {
        const cw = colorWord(p);
        msg = 'No twins: ' + cw + ' cannot touch ' + cw;
      }
      showHint(msg);
      K.snd.nope();
      ctx.speakText(msg);
    }

    function triggerHint(btnSprite) {
      if (!state || state.over || isBusy() || isBotTurn()) return;
      const leg = L.legal(state, G);
      if (!leg.length) {
        const b = btnSprite || (ctx.btn && ctx.btn.hint);
        if (b) ctx.startWobble(b);
        return;
      }
      let bestId = leg[0];
      let bestA = -1;
      for (const id of leg) {
        const c = ctx.C[id];
        const a = c ? ctx.polyArea(c) : 0;
        if (a > bestA) { bestA = a; bestId = id; }
      }
      clearHintRing();
      const c = ctx.C[bestId];
      if (!c) return;
      const anc = countryAnchor(c);
      const sz = ctx.clamp(Math.min(c.bw, c.bh) * 0.85, 18, 62);
      const lift0 = K.isFast() ? 0 : 0.45;
      hintRing = K.spr(ctx.spotTex(), {
        x: anc[0],
        y: anc[1],
        w: sz,
        h: sz,
        z: 0.25,
        zr: 0.04,
        order: 42,
        lift: lift0,
        own: true,
      });
      if (lift0 > 0) K.tw(hintRing, { lift: 0 }, 3 / 12, { cut: true });
      ctx.sfx.pick();
    }

    let botGen = 0;
    let ribbonT0 = 0;
    let zoomTipShown = false;

    function playerWho(p) {
      if (p === 1) return ctx.currentPlayer() || 'boat';
      if (opt.players === 1) return 'bot';
      const p2 = host && host.p2Choice ? host.p2Choice() : null;
      return (p2 && p2.player) ? p2.player : 'friend';
    }

    function playerName(p) {
      return K.displayName(playerWho(p));
    }

    function swatchOf(p) {
      return p === 1 ? 'p1' : 'p2';
    }

    function updateTurnDisplay(hop) {
      if (!state) return null;
      const p = state.over ? state.winner : state.turn;
      return K.turnDisplay(playerWho(p), swatchOf(p), !!hop);
    }

    function clearEndUi() {
      if (ribbonSpr) { K.kill(ribbonSpr); ribbonSpr = null; }
      if (againBtn) { K.kill(againBtn); againBtn = null; }
      if (gamesBtn) { K.kill(gamesBtn); gamesBtn = null; }
      ribbonT0 = 0;
    }

    function layoutEndUi() {
      if (!ribbonSpr) return;
      const W = 1000 * ctx.asp();
      const topLim = ctx.topHudBottom() + 24;
      const availH = 1000 - topLim - 130;
      const ry = topLim + Math.max(ribbonSpr.h * 0.5, availH * 0.48);
      ribbonSpr.x = W * 0.5;
      ribbonSpr.y = ry;
      if (againBtn && gamesBtn) {
        const gap = 24;
        const abw = againBtn.bw || againBtn.w, abh = againBtn.bh || againBtn.h;
        const gbw = gamesBtn.bw || gamesBtn.w, gbh = gamesBtn.bh || gamesBtn.h;
        const totW = abw + gap + gbw;
        const s = Math.min(1, (W - 48) / Math.max(1, totW));
        const aw = abw * s, gw = gbw * s;
        const ah = abh * s, gh = gbh * s;
        const by = Math.min(1000 - Math.max(ah, gh) * 0.5 - 20, ry + ribbonSpr.h * 0.5 + 26 + Math.max(ah, gh) * 0.5);
        const x0 = W * 0.5 - (aw + gap * s + gw) * 0.5;
        againBtn.x = x0 + aw * 0.5;
        againBtn.y = by;
        againBtn.w = aw; againBtn.h = ah;
        gamesBtn.x = x0 + aw + gap * s + gw * 0.5;
        gamesBtn.y = by;
        gamesBtn.w = gw; gamesBtn.h = gh;
      }
    }

    function bakeEndSprites() {
      clearEndUi();
      const win = state.winner;
      const colr = win === 1 ? K.COL.p1 : K.COL.p2;
      const line1 = 'No more room!';
      const line2 = playerName(win) + ' made the last move and wins the map';
      ribbonSpr = K.ribbon([line1, line2], colr);
      againBtn = K.tab('Play again', true, { colr: ctx.PAP[6], ink: ctx.CREAM, order: 230, seed: 801 });
      gamesBtn = K.tab('Games', true, { colr: ctx.PAP[8], ink: ctx.INK, order: 230, seed: 802 });
      againBtn.bw = againBtn.w; againBtn.bh = againBtn.h;
      gamesBtn.bw = gamesBtn.w; gamesBtn.bh = gamesBtn.h;
      againBtn.baseTilt = -0.015; againBtn.rot = againBtn.baseTilt;
      gamesBtn.baseTilt = 0.015; gamesBtn.rot = gamesBtn.baseTilt;
      layoutEndUi();
      return [line1, line2];
    }

    function showEndRibbon() {
      if (!state || !state.over || destroyed) return;
      const lines = bakeEndSprites();
      ribbonT0 = ctx.now();
      const W = 1000 * ctx.asp();
      K.confetti(W * 0.5, ribbonSpr.y, 24, [K.COL.p1, K.COL.p2]);
      ctx.sfx.wake();
      updateTurnDisplay(true);
      showHint(playerName(state.winner) + ' wins');
      if (!K.isFast()) ctx.speakPhrases(lines, lines[0] + ' ' + lines[1]);
    }

    function scheduleBot() {
      if (!isBotTurn() || destroyed) return;
      botPending = true;
      const myGen = gen;
      const myBotGen = ++botGen;
      showHint('Paper Bot is thinking');
      if (!K.isFast() && ctx.playerBtn) ctx.startWobble(ctx.playerBtn);
      const delay = K.botDelay();
      K.after(delay, () => {
        if (destroyed || myGen !== gen || myBotGen !== botGen || !isBotTurn()) {
          botPending = false;
          return;
        }
        const mv = L.bot(state, G, opt.bot, K.rnd);
        if (!mv) {
          botPending = false;
          return;
        }
        if (K.isFast()) {
          botPending = false;
          commitMove(mv, true);
        } else {
          showPreview(mv);
          K.after(0.3, () => {
            if (destroyed || myGen !== gen || myBotGen !== botGen || !isBotTurn()) {
              botPending = false;
              clearPreview();
              return;
            }
            botPending = false;
            commitMove(mv, false);
          });
        }
      });
    }

    function afterMovePlaced() {
      if (!state || destroyed) return;
      if (state.over) {
        clearHintRing();
        if (host && host.onOver) host.onOver(state.winner);
        const myGen = gen;
        if (K.isFast()) {
          showEndRibbon();
        } else {
          K.after(0.6, () => {
            if (destroyed || myGen !== gen) return;
            showEndRibbon();
          });
        }
        return;
      }
      updateTurnDisplay(true);
      if (host && host.onLayout) host.onLayout();
      if (isBotTurn()) {
        scheduleBot();
      } else {
        showHint(playerName(state.turn) + ', your turn');
      }
    }

    function commitMove(id, fromApi) {
      if (!state || state.over) return false;
      if (!L.can(state, G, id, state.turn)) return false;
      const mover = state.turn;
      const c = ctx.C[id];
      if (!c) return false;

      clearHintRing();
      const prevState = state;
      const nextState = L.play(state, G, id);
      if (!nextState) return false;

      hist.push({ state: prevState, mover });
      state = nextState;

      // Adopt preview piece/tag if matching, else bake fresh
      let s, tag;
      if (previewId === id && previewSpr) {
        s = previewSpr;
        tag = previewTag;
        previewSpr = null;
        previewTag = null;
        previewId = null;
      } else {
        clearPreview();
        const pc = bbPiece(c, mover);
        s = K.spr(pc.tex, {
          x: c.cx,
          y: c.cy,
          w: pc.w,
          h: pc.h,
          z: 0.24,
          zr: 0.05,
          order: 40,
          lift: K.isFast() ? 0 : 0.6,
          rot: K.isFast() ? 0 : 3 * ctx.DEG,
          own: true,
        });
        tag = makeCountryTag(c);
      }

      pieceSprs[id] = s;
      if (markSprs[id]) {
        K.kill(markSprs[id]);
        delete markSprs[id];
        delete markKinds[id];
      }

      const myGen = gen;
      if (tag) {
        if (K.isFast()) {
          K.kill(tag);
        } else {
          activeTags.push(tag);
          K.after(1.2, () => {
            if (destroyed || myGen !== gen) return;
            const idx = activeTags.indexOf(tag);
            if (idx >= 0) activeTags.splice(idx, 1);
            K.tw(tag, { lift: 0.35, alpha: 0 }, 2 / 12, { cut: true, done: () => K.kill(tag) });
          });
        }
      }

      const onLand = () => {
        if (destroyed || myGen !== gen) return;
        placing = false;
        K.snd.slap(false);
        if (!K.isFast()) ctx.speakCountry(c, false);
        syncMarks(!fromApi, () => {
          if (destroyed || myGen !== gen) return;
          afterMovePlaced();
        });
      };

      if (K.isFast()) {
        s.lift = 0;
        s.rot = 0;
        onLand();
      } else {
        placing = true;
        K.tw(s, { lift: 0, rot: 0 }, 0.25, { cut: true, done: onLand });
      }
      return true;
    }

    function rebuildPiecesFromState() {
      for (const k of Object.keys(pieceSprs)) { K.kill(pieceSprs[k]); delete pieceSprs[k]; }
      if (!state) return;
      for (const id of board.ids) {
        const own = state.owner[id];
        if (!own) continue;
        const c = ctx.C[id];
        if (!c) continue;
        const pc = bbPiece(c, own);
        pieceSprs[id] = K.spr(pc.tex, {
          x: c.cx,
          y: c.cy,
          w: pc.w,
          h: pc.h,
          z: 0.24,
          zr: 0.05,
          order: 40,
          lift: 0,
          rot: 0,
          own: true,
        });
      }
    }

    function canUndo() {
      if (!state || state.over || isBusy() || isBotTurn()) return false;
      if (!hist.len()) return false;
      if (opt.players === 2) return true;
      // 1-player: at least one human turn snapshot exists in history
      // Check if any move in state.moves was made by human (player 1)
      return state.moves.some(id => state.owner[id] === 1);
    }

    function undo() {
      if (!canUndo()) return;
      gen++;
      botGen++;
      K.clearJobs();
      placing = false;
      botPending = false;
      marksBaking = 0;
      cancelInput();
      clearFloatingTags();
      clearHintRing();

      let snap;
      if (opt.players === 1) {
        snap = hist.popUntil(s => s && s.state && s.state.turn === 1);
      } else {
        snap = hist.pop();
      }
      if (!snap || !snap.state) return;
      state = snap.state;

      // Remove pieces no longer owned
      for (const id of Object.keys(pieceSprs)) {
        if (!state.owner[id]) {
          K.kill(pieceSprs[id]);
          delete pieceSprs[id];
        }
      }
      syncMarks(false);
      ctx.sfx.back();
      updateTurnDisplay(false);
      showHint(playerName(state.turn) + ', your turn');
      if (host && host.onLayout) host.onLayout();
    }

    function cancelInput() {
      pressPtrId = null;
      pressId = null;
      hoverId = null;
      pinch = null;
      pan = null;
      clearPreview();
    }

    function start(inOpt, meta) {
      opt = Object.assign({ players: 1, bot: 'easy', rule: 'snort', board: 'sa' }, inOpt || {});
      const bid = G.boards[opt.board] ? opt.board : 'sa';
      board = G.boards[bid];
      boardSet = new Set(board.ids);
      const starter = (meta && meta.starter === 2) ? 2 : 1;
      state = L.start(board, opt.rule === 'col' ? 'col' : 'snort', starter, G);
      hist.clear();
      zoomLevel = 0;
      gen++;
      botGen++;
      K.clearJobs();
      placing = false;
      botPending = false;
      marksBaking = 0;
      ptrs.clear();
      cancelInput();
      clearFloatingTags();
      clearHintRing();
      clearEndUi();
      for (const k of Object.keys(pieceSprs)) { K.kill(pieceSprs[k]); delete pieceSprs[k]; }
      for (const k of Object.keys(markSprs)) { K.kill(markSprs[k]); delete markSprs[k]; delete markKinds[k]; }

      K.hideMat();
      ctx.clearTags();
      ctx.clearStars();
      ctx.sendAllTwinsHome(true);
      if (ctx.CI && ctx.CI[board.cont]) ctx.ensureBase(ctx.CI[board.cont]);

      boardRegion = computeRegion(board);
      computeBaseCam();
      bakeBoardSheet();
      bakeBridges();

      const immediate = !!(meta && meta.immediate) || K.isFast();
      if (immediate) {
        ctx.killTw(ctx.cam);
        ctx.cam.x = baseCam.x;
        ctx.cam.y = baseCam.y;
        ctx.cam.h = baseCam.h;
      } else {
        ctx.camTo(baseCam.x, baseCam.y, baseCam.h, 0.9);
      }

      updateTurnDisplay(false);
      const myGen = gen;
      if (isBotTurn()) {
        showHint('Paper Bot is thinking');
        scheduleBot();
      } else if (!K.isFast() && canZoom && !zoomTipShown) {
        zoomTipShown = true;
        showHint('Press + to look closer');
        K.after(3, () => {
          if (destroyed || myGen !== gen || !state || state.over || state.moves.length > 0) return;
          showHint(playerName(state.turn) + ', pick a country');
        });
      } else {
        showHint(playerName(state.turn) + ', pick a country');
      }
    }

    function down(e, p) {
      if (!state || destroyed) return;
      if (state.over) {
        if (!ribbonSpr) return;
        if (!K.isFast() && ctx.now() - ribbonT0 < 0.6) return;
        const hPx = ctx.hudPx();
        if (againBtn && againBtn.alpha > 0.5 && ctx.hitMin(againBtn, p.hx, p.hy, 8, hPx)) {
          K.tapTab(againBtn, 'Play again');
          ctx.sfx.snap();
          host.again();
          return;
        }
        if (gamesBtn && gamesBtn.alpha > 0.5 && ctx.hitMin(gamesBtn, p.hx, p.hy, 8, hPx)) {
          K.tapTab(gamesBtn, 'Games');
          host.openBox();
          return;
        }
        return;
      }

      ptrs.set(e.pointerId, { id: e.pointerId, cx: e.clientX, cy: e.clientY });

      // Two fingers: start pinch zoom (cancels any active press)
      if (ptrs.size >= 2) {
        pressPtrId = null;
        pressId = null;
        pan = null;
        clearPreview();
        if (canZoom && baseCam) {
          const pts = [...ptrs.values()].slice(0, 2);
          const midX = (pts[0].cx + pts[1].cx) * 0.5;
          const midY = (pts[0].cy + pts[1].cy) * 0.5;
          const dist = Math.max(8, Math.hypot(pts[1].cx - pts[0].cx, pts[1].cy - pts[0].cy));
          ctx.killTw(ctx.cam);
          const midH = [midX / window.innerHeight * 1000, midY / window.innerHeight * 1000];
          pinch = { id0: pts[0].id, id1: pts[1].id, dist0: dist, h0: ctx.cam.h, wMid: ctx.h2w(midH[0], midH[1]) };
        }
        return;
      }

      // Single pointer while zoomed: allow pan if dragged > 8 px
      if (baseCam && ctx.cam.h < baseCam.h - 0.5) {
        pan = { id: e.pointerId, cx: e.clientX, cy: e.clientY, camX: ctx.cam.x, camY: ctx.cam.y, active: false };
      } else {
        pan = null;
      }

      if (isBusy() || isBotTurn()) return;

      const hit = resolveWorldPoint(p.w[0], p.w[1]);
      if (!hit) return;
      if (hit.kind === 'board' && L.can(state, G, hit.id, state.turn)) {
        pressPtrId = e.pointerId;
        pressId = hit.id;
        hoverId = null;
        showPreview(hit.id);
      } else {
        handleIllegal(hit);
      }
    }

    function move(e, p) {
      if (!state || state.over || destroyed) return;
      if (ptrs.has(e.pointerId)) {
        ptrs.set(e.pointerId, { id: e.pointerId, cx: e.clientX, cy: e.clientY });
      }

      if (pinch && baseCam) {
        const a = ptrs.get(pinch.id0), b = ptrs.get(pinch.id1);
        if (a && b) {
          const dist = Math.max(8, Math.hypot(b.cx - a.cx, b.cy - a.cy));
          const midX = (a.cx + b.cx) * 0.5;
          const midY = (a.cy + b.cy) * 0.5;
          const nh = ctx.clamp(pinch.h0 * pinch.dist0 / dist, baseCam.h / 2.6, baseCam.h);
          const fx = midX / window.innerWidth - 0.5;
          const fy = midY / window.innerHeight - 0.5;
          const asp = ctx.asp();
          const cl = clampCam(pinch.wMid[0] - fx * nh * asp, pinch.wMid[1] - fy * nh, nh);
          ctx.cam.x = cl.x; ctx.cam.y = cl.y; ctx.cam.h = cl.h;
        }
        return;
      }

      if (pan && e.pointerId === pan.id && baseCam) {
        const dx = e.clientX - pan.cx;
        const dy = e.clientY - pan.cy;
        if (!pan.active && Math.hypot(dx, dy) > 8) {
          pan.active = true;
          pressPtrId = null;
          pressId = null;
          clearPreview();
          ctx.killTw(ctx.cam);
        }
        if (pan.active) {
          const wp = Math.max(1e-4, ctx.worldPx());
          const cl = clampCam(pan.camX - dx / wp, pan.camY - dy / wp, ctx.cam.h);
          ctx.cam.x = cl.x; ctx.cam.y = cl.y;
          return;
        }
      }

      if (isBusy() || isBotTurn()) {
        if (pressPtrId !== null || hoverId !== null) {
          pressPtrId = null; pressId = null; hoverId = null; clearPreview();
        }
        return;
      }

      if (pressPtrId !== null) {
        if (e.pointerId !== pressPtrId) return;
        if (pressId !== null) {
          const hit = resolveWorldPoint(p.w[0], p.w[1]);
          const stillSame = hit && hit.kind === 'board' && hit.id === pressId;
          if (!stillSame) {
            pressId = null;
            clearPreview();
          }
        }
        return;
      }

      if (e.pointerType === 'mouse' && !e.buttons) {
        const hit = resolveWorldPoint(p.w[0], p.w[1]);
        const nextHover = (hit && hit.kind === 'board' && L.can(state, G, hit.id, state.turn)) ? hit.id : null;
        if (nextHover !== hoverId) {
          hoverId = nextHover;
          if (hoverId) showPreview(hoverId);
          else clearPreview();
        }
      }
    }

    function up(e, p) {
      ptrs.delete(e.pointerId);
      if (pinch && (e.pointerId === pinch.id0 || e.pointerId === pinch.id1)) {
        pinch = null;
      }
      if (pan && e.pointerId === pan.id) {
        const wasPanning = pan.active;
        pan = null;
        if (wasPanning) return;
      }
      if (pressPtrId === null || e.pointerId !== pressPtrId) return;
      const tgt = pressId;
      pressPtrId = null;
      pressId = null;
      if (e.type === 'pointercancel' || !tgt || !state || state.over || isBusy() || isBotTurn()) {
        clearPreview();
        return;
      }
      const hit = resolveWorldPoint(p.w[0], p.w[1]);
      if (hit && hit.kind === 'board' && hit.id === tgt) {
        commitMove(tgt, false);
      } else {
        clearPreview();
      }
    }

    function cancel() {
      ptrs.clear();
      cancelInput();
    }

    function update(dt) {
      for (const id of Object.keys(pieceSprs)) {
        const s = pieceSprs[id];
        if (s && s.wob !== undefined) s.rot = ctx.wobbleRot(s);
      }
      if (againBtn && againBtn.wob !== undefined) {
        againBtn.rot = (againBtn.baseTilt || 0) + ctx.wobbleRot(againBtn);
      }
      if (gamesBtn && gamesBtn.wob !== undefined) {
        gamesBtn.rot = (gamesBtn.baseTilt || 0) + ctx.wobbleRot(gamesBtn);
      }
    }

    function layoutHud() {
      if (!state || destroyed) return;
      updateTurnDisplay(false);
      if (state.over) layoutEndUi();
    }

    function rebake() {
      if (!state || destroyed || !board) return;
      const oldBaseH = baseCam ? baseCam.h : 0;
      const zoomRatio = oldBaseH > 0 ? ctx.clamp(oldBaseH / Math.max(1, ctx.cam.h), 1, 2.6) : 1;
      const prevCamX = ctx.cam.x, prevCamY = ctx.cam.y;

      cancelInput();
      clearFloatingTags();
      computeBaseCam();
      ctx.killTw(ctx.cam);
      if (zoomRatio > 1.04 && canZoom) {
        const cl = clampCam(prevCamX, prevCamY, baseCam.h / zoomRatio);
        ctx.cam.x = cl.x; ctx.cam.y = cl.y; ctx.cam.h = cl.h;
      } else {
        zoomLevel = 0;
        ctx.cam.x = baseCam.x; ctx.cam.y = baseCam.y; ctx.cam.h = baseCam.h;
      }

      bakeBoardSheet();
      bakeBridges();
      rebuildPiecesFromState();
      for (const k of Object.keys(markSprs)) { K.kill(markSprs[k]); delete markSprs[k]; delete markKinds[k]; }
      syncMarks(false);
      if (state.over && ribbonSpr) {
        bakeEndSprites();
      }
      layoutHud();
    }

    function destroy() {
      destroyed = true;
      gen++;
      botGen++;
      K.clearJobs();
      ctx.clearTimers('games');
      ptrs.clear();
      cancelInput();
      clearFloatingTags();
      clearHintRing();
      clearEndUi();
      clearBridges();
      if (sheetSpr) { K.kill(sheetSpr); sheetSpr = null; }
      for (const k of Object.keys(pieceSprs)) { K.kill(pieceSprs[k]); delete pieceSprs[k]; }
      for (const k of Object.keys(markSprs)) { K.kill(markSprs[k]); delete markSprs[k]; delete markKinds[k]; }
      K.turnDisplay(ctx.currentPlayer(), null, false);
    }

    const api = {
      state() {
        if (!state) return null;
        return {
          board: state.board,
          rule: state.rule,
          owner: Object.assign({}, state.owner),
          turn: state.turn,
          legal: L.legal(state, G),
          marks: L.marks(state, G),
          moves: state.moves.slice(),
          over: state.over,
          winner: state.winner,
        };
      },
      graph(bid) {
        const b = G.boards[bid || (board && board.id) || 'sa'];
        if (!b) return null;
        return {
          ids: b.ids.slice(),
          edges: b.landEdges.slice(),
          bridges: b.bridges.map(x => x.slice()),
        };
      },
      play(id) {
        if (!state || state.over || placing || !L.can(state, G, id, state.turn)) return false;
        botGen++;
        botPending = false;
        return commitMove(id, true);
      },
      bot() {
        if (!state || state.over || placing) return null;
        botGen++;
        botPending = false;
        const mv = L.bot(state, G, opt.bot, K.rnd);
        if (!mv) return null;
        commitMove(mv, true);
        return mv;
      },
      at(id) {
        const c = ctx.C[id];
        if (!c) return null;
        const anc = countryAnchor(c);
        const h = ctx.w2h(anc[0], anc[1]);
        const k = window.innerHeight / 1000;
        return [h[0] * k, h[1] * k];
      },
      zoom(dir) { zoom(dir); },
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
      undo,
      canUndo,
      hint: triggerHint,
      zoom,
      get zoomable() { return canZoom; },
      destroy,
      turn() { return state ? state.turn : 0; },
      winner() { return state ? state.winner : 0; },
      busy() { return isBusy(); },
      moves() { return state ? state.moves.length : 0; },
      api,
    };
  };
})();
