// Paper Game Box, set-up card, discovery, Games controller and test hooks (PRD sections 2.3, 4, 5, 9).
(function () {
  'use strict';
  const PG = window.PAPER_GAMES = window.PAPER_GAMES || { logic: {} };

  PG.boot = function (ctx) {
    const K = PG.common(ctx);
    const B = ctx.GFX, PAP = ctx.PAP, DEG = ctx.DEG;

    const GAME_IDS = ['airmail', 'borders', 'mancala', 'othello'];
    const PLAY_IDS = ['borders', 'mancala', 'othello'];

    let screen = null;       // null | 'box' | 'story' | 'setup' | 'play' | 'over'
    let activeId = null;     // 'borders' | 'mancala' | 'othello' | null
    let activeGame = null;   // running game controller (or stub)
    let activeOpt = null;
    let activeStarter = 1;
    let memSave = null;      // in-memory save when ?done=all without a player

    let boxState = null;     // { sprs, lids, s, rect, floor, rim, head, celebQueue, celebrating }
    let storyState = null;   // { card, returnTo, gameId }
    let setupState = null;   // { gameId, sprs, card, rows, playBtn, storyTab, s, rect, ruleLine }
    let leaveArmed = { id: null, until: 0 };

    const BOARDS = [
      { id: 'sa', name: 'South America', cont: 'South America', ci: 'SA', need: 0 },
      { id: 'eu', name: 'Europe',        cont: 'Europe',        ci: 'EU', need: 1 },
      { id: 'af', name: 'Africa',        cont: 'Africa',        ci: 'AF', need: 2 },
      { id: 'as', name: 'Asia',          cont: 'Asia',          ci: 'AS', need: 3 }
    ];

    function doneAll() {
      return ctx.Q.get('done') === 'all';
    }

    function cleanSave(raw) {
      return PG.cleanSave(raw, ctx.playerLevel ? ctx.playerLevel() : 'own', ctx.PHONE);
    }

    function getSave() {
      const p = ctx.currentPlayer();
      if (p) {
        if (!p.games || typeof p.games !== 'object' || p.games.v !== 1) {
          p.games = cleanSave(p.games);
        }
        return p.games;
      }
      if (!memSave) memSave = cleanSave(null);
      return memSave;
    }

    function saveNow() {
      if (doneAll() || !ctx.currentPlayer()) return;
      ctx.save();
    }

    function isBuilt(cid) {
      return doneAll() || ctx.isBuiltId(ctx.prog(), cid);
    }

    function isWrapped(id) {
      if (id === 'airmail' || doneAll()) return false;
      return !getSave().seen[id];
    }

    function lidHasStar(id) {
      return doneAll() || !!(getSave().stars && getSave().stars[id]);
    }

    function hasGift(id) {
      if (doneAll()) return true;
      const sv = getSave();
      if (sv.stars && sv.stars[id]) return true;
      const homes = PG.HOME[id] || [];
      return homes.length > 0 && homes.every(isBuilt);
    }

    function builtInBoard(bInfo) {
      const prog = ctx.prog();
      let count = 0;
      for (const k in ctx.C) {
        const c = ctx.C[k];
        if (!c || c.id === 'AQ') continue;
        if (c.cont === bInfo.id && ctx.isBuiltId(prog, c.id)) count++;
      }
      return count;
    }

    function isBoardOpen(boardId) {
      if (doneAll()) return true;
      const info = BOARDS.find(b => b.id === boardId);
      if (!info || info.need === 0) return true;
      const sv = getSave();
      const played = (sv.n && sv.n.borders && sv.n.borders.played) || 0;
      if (played >= info.need) return true;
      return builtInBoard(info) >= 3;
    }

    function boardLockMsg(boardId) {
      const info = BOARDS.find(b => b.id === boardId);
      if (!info) return '';
      const sv = getSave();
      const played = (sv.n && sv.n.borders && sv.n.borders.played) || 0;
      const left = Math.max(1, info.need - played);
      const gamesStr = left === 1 ? 'one more game' : (left + ' more games');
      return 'Build 3 countries in ' + info.name + ', or finish ' + gamesStr + ', to open this map';
    }

    function currentMoves() {
      if (!activeGame) return 0;
      if (typeof activeGame.moves === 'function') return activeGame.moves();
      if (typeof activeGame.state === 'function') {
        const st = activeGame.state();
        if (st && typeof st.moves === 'number') return st.moves;
      }
      return 0;
    }

    function checkLeaveGuard(btnId, btnSprite) {
      if (screen !== 'play') return true;
      if (currentMoves() < 4) return true;
      const now = ctx.now();
      if (leaveArmed.id === btnId && now <= leaveArmed.until) {
        leaveArmed = { id: null, until: 0 };
        return true;
      }
      leaveArmed = { id: btnId, until: now + 3 };
      if (btnSprite) ctx.startWobble(btnSprite);
      ctx.setHint('Tap again to leave the game');
      return false;
    }

    function stopActiveGame() {
      if (activeGame && activeGame.destroy) activeGame.destroy();
      activeGame = null;
      activeId = null;
      activeOpt = null;
      K.closeNote(true);
      K.hideMat();
      leaveArmed = { id: null, until: 0 };
    }

    function btnOn() {
      return ctx.mode() === 'world' && !ctx.attract() && !ctx.pickerOpen() && !ctx.passportOpen()
        && (!!ctx.currentPlayer() || doneAll());
    }

    function press() {
      if (ctx.mode() === 'world') {
        ctx.sendAllTwinsHome(true);
        ctx.clearTags();
        ctx.clearStars();
        ctx.clearCompareTag();
        ctx.setMode('games');
        openBox();
        return;
      }
      if (ctx.mode() === 'games') {
        if (screen === 'box') return;
        if (screen === 'play' && !checkLeaveGuard('games', ctx.btn.games)) return;
        if (storyState) closeStory(true);
        if (setupState) closeSetup(true);
        stopActiveGame();
        ctx.fitCam(ctx.worldFrame(), false);
        openBox();
      }
    }

    function parseUrlOpt(gameId, q) {
      const sv = getSave();
      const base = Object.assign({}, sv.opt[gameId]);
      if (!q) return base;
      const p = q.get('p');
      if (p === '1' || p === '2') base.players = Number(p);
      const bot = q.get('bot');
      if (bot === 'easy' || bot === 'clever') base.bot = bot;
      if (gameId === 'borders') {
        const bd = q.get('board');
        if (['sa', 'eu', 'af', 'as'].includes(bd)) base.board = bd;
        const rl = q.get('rule');
        if (rl === 'snort' || rl === 'col') base.rule = rl;
      } else if (gameId === 'mancala') {
        const sd = q.get('seeds');
        if (sd === '3' || sd === '4') base.seeds = Number(sd);
        const st = q.get('sit');
        if (st === 'side' || st === 'across') base.sit = st;
        const pt = q.get('path');
        if (pt === '1' || pt === '0') base.path = pt === '1';
      } else if (gameId === 'othello') {
        const sz = q.get('size');
        if (sz === '6' || sz === '8') base.size = Number(sz);
        const dt = q.get('dots');
        if (dt === '1' || dt === '0') base.dots = dt === '1';
      }
      return base;
    }

    function enter(view, q) {
      if (q && q.get('fast') === '1') K.setFast(true);
      if (q && q.has('seed')) K.setSeed(parseInt(q.get('seed'), 10) || 1);
      ctx.sendAllTwinsHome(true);
      ctx.clearTags();
      ctx.clearStars();
      ctx.clearCompareTag();
      ctx.setMode('games');
      if (PLAY_IDS.includes(view)) {
        startGame(view, parseUrlOpt(view, q), true);
      } else {
        openBox();
      }
    }

    function exit() {
      if (storyState) ctx.stopSpeech();
      if (activeGame && activeGame.destroy) activeGame.destroy();
      K.killAll();
      screen = null;
      activeId = null;
      activeGame = null;
      activeOpt = null;
      boxState = null;
      storyState = null;
      setupState = null;
      leaveArmed = { id: null, until: 0 };
    }

    // ---- Helper: rounded rect path & continent polygon drawer ----
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

    function contCountries(contId) {
      const out = [];
      for (const k in ctx.C) {
        const c = ctx.C[k];
        if (c && c.cont === contId && c.polys && c.polys.length && c.bbox) out.push(c);
      }
      return out;
    }

    function drawContPolys(b, contId, px, py, pw, ph, k, styleFn) {
      const list = contCountries(contId);
      if (!list.length) return;
      let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
      for (const c of list) {
        if (c.bbox[0] < minX) minX = c.bbox[0];
        if (c.bbox[1] < minY) minY = c.bbox[1];
        if (c.bbox[2] > maxX) maxX = c.bbox[2];
        if (c.bbox[3] > maxY) maxY = c.bbox[3];
      }
      const pad = 8 * k;
      const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
      const sc = Math.min((pw - pad * 2) / bw, (ph - pad * 2) / bh);
      const ox = px + (pw - bw * sc) / 2;
      const oy = py + (ph - bh * sc) / 2;

      for (const c of list) {
        const pathFn = q => {
          for (const poly of c.polys) {
            if (!poly || poly.length < 6) continue;
            q.moveTo(ox + (poly[0] - minX) * sc, oy + (poly[1] - minY) * sc);
            for (let i = 2; i < poly.length; i += 2) {
              q.lineTo(ox + (poly[i] - minX) * sc, oy + (poly[i + 1] - minY) * sc);
            }
            q.closePath();
          }
        };
        const st = styleFn ? styleFn(c) : { col: ctx.PALE, relief: 0.56 };
        B.paper(b, pathFn, st.col, st.relief || 0.56);
        if (st.pattern === 'p1') {
          b.c.save(); b.g.save();
          b.c.beginPath(); pathFn(b.c); b.c.clip();
          b.g.beginPath(); pathFn(b.g); b.g.clip();
          const step = 9 * k, sw = 2.6 * k;
          for (let d = px - ph; d < px + pw + ph; d += step) {
            B.paper(b, q => {
              q.moveTo(d, py); q.lineTo(d + sw, py); q.lineTo(d + sw - ph, py + ph); q.lineTo(d - ph, py + ph); q.closePath();
            }, K.COL.p1Dark, 0.68);
          }
          b.c.restore(); b.g.restore();
        } else if (st.pattern === 'p2') {
          b.c.save(); b.g.save();
          b.c.beginPath(); pathFn(b.c); b.c.clip();
          b.g.beginPath(); pathFn(b.g); b.g.clip();
          const step = 10 * k, r = 2.1 * k;
          for (let row = 0, y = py; y < py + ph; row++, y += step * 0.85) {
            for (let x = px + (row % 2 ? step * 0.5 : 0); x < px + pw + step; x += step) {
              B.paper(b, q => q.arc(x, y, r, 0, Math.PI * 2), K.COL.p2Light, 0.35);
            }
          }
          b.c.restore(); b.g.restore();
        }
        if (st.border !== false) {
          b.c.save();
          b.c.strokeStyle = 'rgba(66,68,82,0.45)';
          b.c.lineWidth = Math.max(0.8, 1.1 * k);
          b.c.beginPath(); pathFn(b.c); b.c.stroke();
          b.c.restore();
        }
      }
    }

    function drawMiniPostcard(b, x, y, w, h, k) {
      B.paper(b, ctx.wob(x * k, y * k, (x + w) * k, (y + h) * k, 2 * k, 613), '#f7f1e3', 0.58);
      // tiny PAP[2] stamp square at top right
      B.paper(b, q => q.rect((x + w - 16) * k, (y + 6) * k, 10 * k, 11 * k), PAP[2], 0.66);
      // three pencil lines
      const q = b.c;
      q.save();
      q.strokeStyle = K.COL.pencil;
      q.lineWidth = Math.max(1, 1.6 * k);
      q.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const ly = (y + 16 + i * 9) * k;
        const lw = (i === 0 ? 30 : i === 1 ? 38 : 26) * k;
        q.beginPath(); q.moveTo((x + 8) * k, ly); q.lineTo((x + 8) * k + lw, ly); q.stroke();
      }
      q.restore();
    }

    function drawLidPicture(b, gameId, k) {
      const px = 14 * k, py = 14 * k, pw = 272 * k, ph = 192 * k;
      const panelEdge = ctx.wob(px, py, px + pw, py + ph, 3.5 * k, 300 + ctx.sid(gameId));
      if (gameId === 'airmail') {
        B.paper(b, panelEdge, PAP[8], 0.5);
        // cream paper dart with red and blue strips
        const cx = px + pw * 0.52, cy = py + ph * 0.52;
        const pts = (dx, dy) => [cx + dx * k, cy + dy * k];
        B.paper(b, q => {
          const p0 = pts(88, -36), p1 = pts(-82, 16), p2 = pts(-24, 24), p3 = pts(-56, 56);
          q.moveTo(p0[0], p0[1]); q.lineTo(p1[0], p1[1]); q.lineTo(p2[0], p2[1]); q.lineTo(p3[0], p3[1]); q.closePath();
        }, PAP[0], 0.72);
        // red stripe
        B.paper(b, q => {
          const a = pts(70, -28), b0 = pts(-68, 13), c0 = pts(-58, 19), d = pts(58, -19);
          q.moveTo(a[0], a[1]); q.lineTo(b0[0], b0[1]); q.lineTo(c0[0], c0[1]); q.lineTo(d[0], d[1]); q.closePath();
        }, PAP[2], 0.76);
        // blue stripe
        B.paper(b, q => {
          const a = pts(52, -16), b0 = pts(-48, 22), c0 = pts(-38, 28), d = pts(44, -9);
          q.moveTo(a[0], a[1]); q.lineTo(b0[0], b0[1]); q.lineTo(c0[0], c0[1]); q.lineTo(d[0], d[1]); q.closePath();
        }, PAP[9], 0.76);
        // folded inner crease
        b.c.save();
        b.c.strokeStyle = 'rgba(66,68,82,0.35)';
        b.c.lineWidth = Math.max(1, 1.5 * k);
        const m0 = pts(88, -36), m1 = pts(-24, 24);
        b.c.beginPath(); b.c.moveTo(m0[0], m0[1]); b.c.lineTo(m1[0], m1[1]); b.c.stroke();
        b.c.restore();
      } else if (gameId === 'borders') {
        B.paper(b, panelEdge, ctx.SEA, 0.5);
        b.c.save(); b.g.save();
        b.c.beginPath(); panelEdge(b.c); b.c.clip();
        b.g.beginPath(); panelEdge(b.g); b.g.clip();
        drawContPolys(b, 'sa', px, py, pw, ph, k, c => {
          if (c.id === 'BR' || c.id === 'UY') return { col: K.COL.p1, relief: 0.64, pattern: 'p1' };
          if (c.id === 'CL' || c.id === 'EC') return { col: K.COL.p2, relief: 0.64, pattern: 'p2' };
          return { col: ctx.PALE, relief: 0.56 };
        });
        b.c.restore(); b.g.restore();
      } else if (gameId === 'mancala') {
        B.paper(b, panelEdge, '#ede2cb', 0.5);
        // clay board
        const bx = px + 14 * k, by = py + 32 * k, bw = pw - 28 * k, bh = ph - 64 * k;
        B.paper(b, q => roundRectPath(q, bx, by, bw, bh, 26 * k), '#b8763c', 0.66);
        // two stores
        const sw = 28 * k, sh = bh - 24 * k;
        B.paper(b, q => roundRectPath(q, bx + 12 * k, by + 12 * k, sw, sh, 14 * k), '#6e3f1c', 0.34);
        B.paper(b, q => roundRectPath(q, bx + bw - 12 * k - sw, by + 12 * k, sw, sh, 14 * k), '#6e3f1c', 0.34);
        // 2 rows x 6 pits + seeds
        const seedCols = [PAP[4], PAP[6], PAP[5], PAP[0]];
        const pitAreaX = bx + 12 * k + sw + 10 * k;
        const pitAreaW = bw - 2 * (12 * k + sw + 10 * k);
        const stepX = pitAreaW / 6;
        const r = Math.min(13.5 * k, stepX * 0.42);
        for (let row = 0; row < 2; row++) {
          const cy = by + (row === 0 ? bh * 0.30 : bh * 0.70);
          for (let col = 0; col < 6; col++) {
            const cx = pitAreaX + (col + 0.5) * stepX;
            B.paper(b, q => q.arc(cx, cy, r, 0, Math.PI * 2), '#6e3f1c', 0.34);
            const sn = (row * 6 + col) % 3 === 0 ? 4 : 3;
            for (let i = 0; i < sn; i++) {
              const ang = (i / sn) * Math.PI * 2 + col * 0.7;
              const sd = r * 0.42;
              const sx = cx + Math.cos(ang) * sd, sy = cy + Math.sin(ang) * sd;
              B.paper(b, q => q.arc(sx, sy, 3.6 * k, 0, Math.PI * 2), seedCols[(col + i + row) % seedCols.length], 0.72);
            }
          }
        }
        // a few seeds in stores
        for (let i = 0; i < 3; i++) {
          B.paper(b, q => q.arc(bx + 26 * k + (i % 2 - 0.5) * 7 * k, by + 48 * k + i * 14 * k, 3.8 * k, 0, Math.PI * 2), seedCols[i % 4], 0.72);
          B.paper(b, q => q.arc(bx + bw - 26 * k + (i % 2 - 0.5) * 7 * k, by + 54 * k + i * 14 * k, 3.8 * k, 0, Math.PI * 2), seedCols[(i + 1) % 4], 0.72);
        }
      } else if (gameId === 'othello') {
        B.paper(b, panelEdge, '#5e8f66', 0.5);
        const gSize = 160 * k, gx = px + (pw - gSize) / 2, gy = py + (ph - gSize) / 2, cell = gSize / 4;
        // cream stitched grid lines
        const q = b.c;
        q.save();
        q.strokeStyle = 'rgba(250,246,236,0.75)';
        q.lineWidth = Math.max(1, 1.8 * k);
        q.setLineDash([6 * k, 4 * k]);
        for (let i = 0; i <= 4; i++) {
          q.beginPath(); q.moveTo(gx + i * cell, gy); q.lineTo(gx + i * cell, gy + gSize); q.stroke();
          q.beginPath(); q.moveTo(gx, gy + i * cell); q.lineTo(gx + gSize, gy + i * cell); q.stroke();
        }
        q.restore();
        const discs = [
          { r: 1, c: 1, col: PAP[0] }, { r: 2, c: 2, col: PAP[0] }, { r: 0, c: 2, col: PAP[0] },
          { r: 1, c: 2, col: PAP[10] }, { r: 2, c: 1, col: PAP[10] }, { r: 2, c: 3, col: PAP[10], half: true }
        ];
        const dr = cell * 0.36;
        for (const d of discs) {
          const cx = gx + (d.c + 0.5) * cell, cy = gy + (d.r + 0.5) * cell;
          if (d.half) {
            B.paper(b, q2 => q2.ellipse(cx + 2 * k, cy, dr * 0.34, dr, -0.15, 0, Math.PI * 2), PAP[0], 0.72);
            B.paper(b, q2 => q2.ellipse(cx - 2 * k, cy, dr * 0.34, dr, -0.15, 0, Math.PI * 2), PAP[10], 0.78);
          } else {
            B.paper(b, q2 => q2.arc(cx, cy, dr, 0, Math.PI * 2), d.col, 0.74);
          }
        }
      }
    }

    function stampShown(gameId, cid) {
      if (doneAll()) return true;
      if (!isBuilt(cid)) return false;
      const sv = getSave();
      return !!(sv.stamps && sv.stamps[gameId] && sv.stamps[gameId].includes(cid));
    }

    function bakeLidTex(gameId, scale, overrideStamps, showStarOverride) {
      const lw = 300, lh = 380;
      const k = scale;
      const W = Math.max(8, Math.round(lw * k)), H = Math.max(8, Math.round(lh * k));
      const t = ctx.shapeTex(W, H, b => {
        B.paper(b, ctx.wob(3 * k, 3 * k, W - 3 * k, H - 3 * k, 4.5 * k, 521 + ctx.sid(gameId)), K.COL.lid, 0.36);
        drawLidPicture(b, gameId, k);
        ctx.ink(b, PG.NAME[gameId] || gameId, 16 * k, 239 * k, 36 * k, { maxW: 268 * k, col: K.COL.ink });
        ctx.ink(b, PG.FROM[gameId] || '', 16 * k, 279 * k, 20 * k, { maxW: 268 * k, col: K.COL.dimInk });
        // home stamps
        const homes = PG.HOME[gameId] || [];
        const sw = homes.length >= 3 ? 58 : 62, sh = 46;
        const sGap = homes.length >= 3 ? 6 : 8;
        const sStart = homes.length >= 3 ? 14 : 16;
        homes.forEach((cid, i) => {
          const sx = sStart + i * (sw + sGap), sy = 308;
          const shown = overrideStamps ? overrideStamps.includes(cid) : stampShown(gameId, cid);
          if (shown && ctx.FL[cid]) {
            B.paper(b, ctx.wob(sx * k, sy * k, (sx + sw) * k, (sy + sh) * k, 1.8 * k, 800 + i * 17), '#fffdf6', 0.62);
            const f = ctx.FL[cid];
            const fh = Math.min(34, (sw - 10) / f.a);
            const fw = fh * f.a;
            ctx.flagDraw(b, cid, (sx + (sw - fw) / 2) * k, (sy + (sh - fh) / 2) * k, fh * k);
            if (ctx.postmarkDraw) ctx.postmarkDraw(b, (sx + sw - 9) * k, (sy + 11) * k, 11 * k, ctx.sid(cid));
          } else {
            const q = b.c;
            q.save();
            q.strokeStyle = K.COL.pencil;
            q.lineWidth = Math.max(1, 1.5 * k);
            q.setLineDash([4.5 * k, 3.5 * k]);
            q.strokeRect(sx * k, sy * k, sw * k, sh * k);
            q.restore();
            const cObj = ctx.C[cid];
            const cname = cObj ? ctx.normSaint(cObj.name) : cid;
            ctx.ink(b, cname, (sx + sw / 2) * k, (sy + sh / 2) * k, 15 * k, { align: 'center', maxW: (sw - 6) * k, col: K.COL.dimInk });
          }
        });
        // story tab at right (x 222..286, y 308..354)
        drawMiniPostcard(b, 222, 308, 64, 46, k);
        // gold star at top right
        const starOn = showStarOverride !== undefined ? showStarOverride : lidHasStar(gameId);
        if (starOn) {
          B.paper(b, ctx.starPath(270 * k, 32 * k, 22 * k, 10 * k), K.COL.star, 0.78);
        }
      }, { noMip: true });
      t.lw = lw; t.lh = lh;
      return t;
    }

    function bakeBandTex(gameId, scale) {
      const lw = 296, lh = 118;
      const k = scale;
      const W = Math.max(8, Math.round(lw * k)), H = Math.max(8, Math.round(lh * k));
      const t = ctx.shapeTex(W, H, b => {
        // kraft band lying across the lid
        B.paper(b, ctx.wob(4 * k, 10 * k, W - 4 * k, H - 10 * k, 3.2 * k, 941 + ctx.sid(gameId)), K.COL.band, 0.52);
        // red & white twine line along middle
        const q = b.c;
        q.save();
        q.lineWidth = Math.max(1.5, 3.5 * k);
        q.lineCap = 'round';
        q.strokeStyle = '#fffdf6';
        q.beginPath(); q.moveTo(8 * k, H / 2); q.lineTo(W - 8 * k, H / 2); q.stroke();
        q.strokeStyle = PAP[2];
        q.setLineDash([10 * k, 10 * k]);
        q.beginPath(); q.moveTo(8 * k, H / 2); q.lineTo(W - 8 * k, H / 2); q.stroke();
        q.restore();
        // cream "New" tag tied at lower left
        const tx = 22 * k, ty = 52 * k, tw0 = 92 * k, th0 = 54 * k;
        B.paper(b, ctx.cutEdge(tx, ty, tx + tw0, ty + th0, 2.5 * k, 977 + ctx.sid(gameId)), '#faf6ec', 0.68);
        // punched hole on tag
        B.paper(b, q2 => q2.arc(tx + 12 * k, ty + th0 / 2, 3.5 * k, 0, Math.PI * 2), K.COL.band, 0.35);
        ctx.ink(b, 'New', tx + tw0 * 0.56, ty + th0 * 0.52, 26 * k, { align: 'center', maxW: (tw0 - 20 * k), col: K.COL.ink });
      }, { noMip: true });
      t.lw = lw; t.lh = lh;
      return t;
    }

    function openBox(opts) {
      const o = opts || {};
      closeBox();
      if (storyState) closeStory(true);
      if (setupState) closeSetup(true);
      K.clearJobs();
      screen = 'box';
      activeId = null;
      layoutHud();

      const asp = ctx.asp(), W = 1000 * asp, sc0 = ctx.devPerHud();
      const twoByTwo = asp < 0.9;
      const LID_W = 300, LID_H = 380, GAP = 24, PAD = 40, HEAD_H = 54, HEAD_GAP = 16;
      const W0 = twoByTwo ? (2 * PAD + 2 * LID_W + GAP) : (2 * PAD + 4 * LID_W + 3 * GAP);
      const H0 = twoByTwo ? (PAD + HEAD_H + HEAD_GAP + 2 * LID_H + GAP + PAD) : (PAD + HEAD_H + HEAD_GAP + LID_H + PAD);
      const top = Math.max(ctx.topHudBottom() + 20, 150);
      const s = Math.min(ctx.PHONE ? 1.5 : 1, (W - 24) / W0, (990 - top) / H0);
      const x0 = (W - W0 * s) / 2, y0 = top;
      const X = u => x0 + u * s, Y = u => y0 + u * s;
      const ks = sc0 * s;

      const box = {
        sprs: [],
        lids: [],
        s,
        ks,
        rect: [x0, y0, x0 + W0 * s, y0 + H0 * s],
        celebQueue: [],
        celebrating: false
      };
      boxState = box;
      const mk = (tex, cfg) => {
        const sp = K.spr(tex, Object.assign({ hud: true, z: 0.14, zr: 0.03, order: 219, own: true }, cfg));
        box.sprs.push(sp);
        return sp;
      };

      // Floor sheet (#b29a72, relief 0.15, z 0.10)
      const fw = W0 - 16, fh = H0 - 16;
      const floorTex = ctx.shapeTex(Math.max(8, Math.round(fw * ks)), Math.max(8, Math.round(fh * ks)), b => {
        B.paper(b, ctx.wob(4 * ks, 4 * ks, b.w - 4 * ks, b.h - 4 * ks, 6 * ks, 4469), K.COL.trayFloor, 0.15);
      }, { noMip: true });
      box.floor = mk(floorTex, { order: 216, z: 0.10, zr: 0.02, x: X(W0 / 2), y: Y(H0 / 2), w: fw * s, h: fh * s, rot: -0.004 });

      // Rim sheet (#cdb995, relief 0.6, wob edge 9 px, z 0.13) with rounded hole 16 units inside edge
      const rimTex = ctx.shapeTex(Math.max(8, Math.round(W0 * ks)), Math.max(8, Math.round(H0 * ks)), b => {
        B.paper(b, ctx.wob(6 * ks, 6 * ks, b.w - 6 * ks, b.h - 6 * ks, 9 * ks, 4481), K.COL.trayRim, 0.6);
        const inset = 22 * ks;
        const hw = Math.max(4, b.w - inset * 2), hh = Math.max(4, b.h - inset * 2);
        for (const q of [b.c, b.g]) {
          q.save();
          q.globalCompositeOperation = 'destination-out';
          q.fillStyle = '#000';
          q.beginPath();
          roundRectPath(q, inset, inset, hw, hh, 14 * ks);
          q.fill();
          q.restore();
        }
      }, { noMip: true });
      box.rim = mk(rimTex, { order: 217, z: 0.13, zr: 0.03, x: X(W0 / 2), y: Y(H0 / 2), w: W0 * s, h: H0 * s, rot: -0.004 });

      // Head strip "Games"
      const ht = ctx.textTex('Games', 40, { strip: ctx.HUD_PAPER, col: ctx.INK, cut: true, scale: ks, noMip: true });
      box.head = mk(ht, {
        order: 218, z: 0.142,
        x: X(PAD) + ht.lw * s / 2,
        y: Y(PAD + HEAD_H / 2),
        w: ht.lw * s, h: ht.lh * s,
        rot: -0.9 * DEG
      });

      const tilts = [-1.15, 0.85, -0.7, 1.2];
      GAME_IDS.forEach((id, i) => {
        const col = twoByTwo ? (i % 2) : i;
        const row = twoByTwo ? Math.floor(i / 2) : 0;
        const lx = X(PAD + col * (LID_W + GAP) + LID_W / 2);
        const ly = Y(PAD + HEAD_H + HEAD_GAP + row * (LID_H + GAP) + LID_H / 2);
        const lid = {
          id,
          x: lx, y: ly,
          w: LID_W * s, h: LID_H * s,
          tilt: tilts[i] * DEG,
          wrapped: isWrapped(id),
          s: null,
          band: null,
          rect: [lx - LID_W * s / 2, ly - LID_H * s / 2, lx + LID_W * s / 2, ly + LID_H * s / 2]
        };
        box.lids.push(lid);
        const deal = () => {
          if (boxState !== box) return;
          lid.s = mk(bakeLidTex(id, ks), {
            order: 219, z: 0.14,
            x: lid.x, y: lid.y, w: lid.w, h: lid.h,
            rot: lid.tilt,
            lift: o.noAnim ? 0 : 0.16
          });
          if (!o.noAnim) K.tw(lid.s, { lift: 0 }, 0.18, { cut: true });
          if (lid.wrapped) {
            lid.band = mk(bakeBandTex(id, ks), {
              order: 220, z: 0.146,
              x: lid.x, y: lid.y - 44 * s,
              w: 296 * s, h: 118 * s,
              rot: lid.tilt - 15 * DEG,
              lift: o.noAnim ? 0 : 0.16
            });
            if (!o.noAnim) K.tw(lid.band, { lift: 0 }, 0.18, { cut: true });
          }
          if (i === GAME_IDS.length - 1 && !o.noAnim && !o.quiet) {
            queueStampCelebrations(box);
          }
        };
        if (o.noAnim) deal(); else K.job(deal);
      });

      if (!o.quiet) {
        ctx.setHint('Pick a game');
        ctx.sfx.turn();
      }
      return box;
    }

    function closeBox() {
      const box = boxState;
      if (!box) return;
      boxState = null;
      K.clearJobs();
      for (const sp of box.sprs) K.kill(sp);
    }

    function rebakeLid(box, lid) {
      if (!lid.s) return;
      const oldTex = lid.s.tex;
      lid.s.tex = bakeLidTex(lid.id, box.ks);
      if (oldTex) B.freeTex(oldTex);
    }

    function flushCelebrations(box) {
      if (!box || !box.celebQueue || !box.celebQueue.length) {
        if (box) box.celebrating = false;
        return;
      }
      const sv = getSave();
      const touched = new Set();
      while (box.celebQueue.length) {
        const item = box.celebQueue.shift();
        const gid = item.lid.id;
        if (!sv.stamps[gid].includes(item.cid)) sv.stamps[gid].push(item.cid);
        const homes = PG.HOME[gid] || [];
        if (homes.length && homes.every(c => sv.stamps[gid].includes(c))) {
          sv.stars[gid] = true;
        }
        touched.add(item.lid);
      }
      box.celebrating = false;
      saveNow();
      for (const lid of touched) rebakeLid(box, lid);
    }

    function queueStampCelebrations(box) {
      if (doneAll() || !ctx.currentPlayer()) return;
      const sv = getSave();
      const q = [];
      for (const lid of box.lids) {
        const homes = PG.HOME[lid.id] || [];
        const seenStamps = sv.stamps[lid.id] || [];
        for (const cid of homes) {
          if (isBuilt(cid) && !seenStamps.includes(cid)) {
            q.push({ lid, cid });
          }
        }
      }
      if (!q.length) return;
      box.celebQueue = q;
      box.celebrating = true;

      const step = () => {
        if (boxState !== box || !box.celebrating || !box.celebQueue.length) {
          if (box) box.celebrating = false;
          return;
        }
        const { lid, cid } = box.celebQueue.shift();
        const gid = lid.id;
        if (!sv.stamps[gid].includes(cid)) sv.stamps[gid].push(cid);
        saveNow();
        rebakeLid(box, lid);
        if (lid.s) {
          const y0 = lid.y;
          lid.s.lift = 0.3;
          lid.s.y = y0 - 22 * box.s;
          K.tw(lid.s, { lift: 0, y: y0 }, 0.34, { cut: true });
        }
        ctx.sfx.snap();
        const cObj = ctx.C[cid];
        const cname = cObj ? ctx.inSent(cObj) : cid;
        const msg = 'New stamp: ' + cname + '. ' + PG.NAME[gid] + ' comes from here.';
        ctx.setHint(msg);
        ctx.speakText(msg);

        const homes = PG.HOME[gid] || [];
        const completed = homes.length > 0 && homes.every(c => sv.stamps[gid].includes(c)) && !sv.stars[gid];
        if (completed) {
          sv.stars[gid] = true;
          saveNow();
          K.after(0.45, () => {
            if (boxState !== box) return;
            const starX = lid.x + (270 - 150) * box.s;
            const starY = lid.y + (32 - 190) * box.s;
            const sz = 52 * box.s;
            const stTex = ctx.shapeTex(Math.max(8, Math.round(sz * ctx.devPerHud())), Math.max(8, Math.round(sz * ctx.devPerHud())), b => {
              B.paper(b, ctx.starPath(b.w / 2, b.h / 2, b.w * 0.42, b.w * 0.19), K.COL.star, 0.78);
            }, { noMip: true });
            const starSp = K.spr(stTex, { hud: true, z: 0.165, zr: 0.03, order: 225, x: starX, y: starY, w: sz, h: sz, lift: 0.5, own: true });
            K.tw(starSp, { lift: 0 }, 4 / 12, {
              cut: true,
              done: () => {
                K.kill(starSp);
                if (boxState === box) rebakeLid(box, lid);
              }
            });
            ctx.sfx.wake();
            K.confetti(starX, starY, 12);
            const gLine = PG.GIFT_LINE[gid];
            if (gLine) { ctx.setHint(gLine); ctx.speakText(gLine); }
          });
        }
        if (box.celebQueue.length) {
          K.after(1.4, step);
        } else {
          box.celebrating = false;
        }
      };
      K.after(0.35, step);
    }

    function openStory(gameId, returnTo, quiet) {
      if (storyState) closeStory(true);
      screen = 'story';
      const card = K.postcard(gameId, null, !!quiet);
      if (card && card.s) { card.s.z = 0.174; card.s.order = 227; }
      storyState = { card, returnTo: returnTo || 'box', gameId };
      layoutHud();
    }

    function closeStory(silent) {
      const st = storyState;
      if (!st) return;
      storyState = null;
      ctx.stopSpeech();
      const sp = st.card && st.card.s;
      if (sp) {
        if (silent || K.isFast()) {
          K.kill(sp);
        } else {
          ctx.killTw(sp);
          K.tw(sp, { y: sp.y - 26, lift: 0.32 }, 0.18, { cut: true, done: () => K.kill(sp) });
        }
      }
      if (!silent) {
        if (st.returnTo === 'setup') {
          openSetup(st.gameId);
        } else {
          screen = 'box';
          ctx.setHint('Pick a game');
          layoutHud();
        }
      }
    }

    function unwrapLid(lid) {
      if (!lid || !lid.wrapped) return;
      lid.wrapped = false;
      const sv = getSave();
      sv.seen[lid.id] = true;
      saveNow();
      K.snd.unwrap();
      const band = lid.band;
      lid.band = null;
      if (!band || K.isFast()) {
        if (band) K.kill(band);
        openStory(lid.id, 'setup');
        return;
      }
      K.tw(band, { lift: 0.4 }, 2 / 12, {
        cut: true,
        done: () => {
          K.tw(band, { x: band.x + lid.w * 1.15, rot: band.rot + 0.12 }, 4 / 12, {
            cut: true,
            done: () => {
              K.kill(band);
              if (boxState && screen === 'box') openStory(lid.id, 'setup');
            }
          });
        }
      });
    }

    function tapLid(lid, p) {
      const box = boxState;
      if (!box || !lid || !lid.s) return;
      const s = box.s;
      const hPx = ctx.hudPx();

      if (p) {
        // Story tab at x 222..286, y 308..354 (in 300x380 lid coordinates)
        const storyBox = {
          x: lid.x + (254 - 150) * s,
          y: lid.y + (331 - 190) * s,
          w: 64 * s,
          h: 46 * s
        };
        if (ctx.hitMin(storyBox, p.hx, p.hy, 4, hPx)) {
          openStory(lid.id, 'box');
          return;
        }
        // Home stamps
        const homes = PG.HOME[lid.id] || [];
        const sw = homes.length >= 3 ? 58 : 62;
        const sGap = homes.length >= 3 ? 6 : 8;
        const sStart = homes.length >= 3 ? 14 : 16;
        for (let i = 0; i < homes.length; i++) {
          const cid = homes[i];
          const stBox = {
            x: lid.x + (sStart + i * (sw + sGap) + sw / 2 - 150) * s,
            y: lid.y + (331 - 190) * s,
            w: sw * s,
            h: 46 * s
          };
          if (ctx.hitMin(stBox, p.hx, p.hy, 2, hPx)) {
            const cObj = ctx.C[cid];
            if (stampShown(lid.id, cid)) {
              ctx.startWobble(lid.s);
              if (cObj) ctx.speakCountry(cObj, true);
            } else {
              const cname = cObj ? ctx.inSent(cObj) : cid;
              const msg = 'Build ' + cname + ' to get this stamp';
              ctx.setHint(msg);
              ctx.speakText(msg);
            }
            return;
          }
        }
      }

      if (lid.wrapped) {
        unwrapLid(lid);
        return;
      }
      if (lid.id === 'airmail') {
        if (!ctx.currentPlayer()) {
          ctx.startWobble(lid.s);
          ctx.setHint('Pick a player first');
          return;
        }
        exit();
        ctx.setMode('world');
        ctx.amEnter();
        return;
      }
      openSetup(lid.id);
    }

    function p2Choices() {
      const cur = ctx.currentPlayer();
      const st = ctx.store();
      const list = (st && Array.isArray(st.players)) ? st.players.filter(p => !cur || p.id !== cur.id) : [];
      const out = list.map(p => ({ id: p.id, token: p.token || 'boat', player: p, label: K.displayName(p) }));
      out.push({ id: 'friend', token: 'friend', player: 'friend', label: 'Friend' });
      return out;
    }

    function currentP2Choice() {
      const sv = getSave();
      const choices = p2Choices();
      let found = choices.find(c => c.id === sv.p2);
      if (!found) {
        found = choices[0];
        sv.p2 = found.id;
      }
      return { choice: found, choices };
    }

    function ruleExplanation(rule) {
      return rule === 'col'
        ? 'Your colour may not touch your own colour.'
        : 'Your colour may not touch the other colour.';
    }

    function buildSetupRows(gameId) {
      const sv = getSave();
      const opt = sv.opt[gameId];
      const rows = [];
      rows.push({
        id: 'players',
        label: 'Players',
        value: opt.players,
        tabs: [
          { value: 1, label: '1 player' },
          { value: 2, label: '2 players' }
        ]
      });
      if (opt.players === 1) {
        rows.push({
          id: 'bot',
          label: 'Paper Bot',
          value: opt.bot,
          tabs: [
            { value: 'easy', label: 'Easy' },
            { value: 'clever', label: 'Clever' }
          ]
        });
      } else {
        const { choice } = currentP2Choice();
        rows.push({
          id: 'p2',
          label: 'Player 2',
          kind: 'p2',
          value: choice.id,
          choice,
          tabs: [{ value: choice.id, label: choice.label }]
        });
      }
      if (gameId === 'borders') {
        if (!isBoardOpen(opt.board)) opt.board = 'sa';
        rows.push({
          id: 'board',
          label: 'Map',
          kind: 'boards',
          value: opt.board,
          tabs: BOARDS.map(b => ({ value: b.id, label: b.name, open: isBoardOpen(b.id) }))
        });
        rows.push({
          id: 'rule',
          label: 'Rule',
          value: opt.rule,
          explain: ruleExplanation(opt.rule),
          tabs: [
            { value: 'snort', label: 'Keep apart' },
            { value: 'col', label: 'No twins' }
          ]
        });
      } else if (gameId === 'mancala') {
        rows.push({
          id: 'seeds',
          label: 'Seeds',
          value: opt.seeds,
          tabs: [
            { value: 3, label: 'Quick: 3' },
            { value: 4, label: 'Classic: 4' }
          ]
        });
        if (opt.players === 2) {
          rows.push({
            id: 'sit',
            label: 'Sitting',
            value: opt.sit,
            tabs: [
              { value: 'side', label: 'Side by side' },
              { value: 'across', label: 'Across' }
            ]
          });
        }
        rows.push({
          id: 'path',
          label: 'Path dots',
          value: opt.path,
          tabs: [
            { value: true, label: 'On' },
            { value: false, label: 'Off' }
          ]
        });
        if (hasGift('mancala')) {
          rows.push({
            id: 'look',
            label: 'Look',
            value: opt.look,
            tabs: [
              { value: 'beans', label: 'Beans' },
              { value: 'shells', label: 'Shells' }
            ]
          });
        }
      } else if (gameId === 'othello') {
        rows.push({
          id: 'size',
          label: 'Board',
          value: opt.size,
          tabs: [
            { value: 6, label: 'Small 6x6' },
            { value: 8, label: 'Big 8x8' }
          ]
        });
        rows.push({
          id: 'dots',
          label: 'Move dots',
          value: opt.dots,
          tabs: [
            { value: true, label: 'On' },
            { value: false, label: 'Off' }
          ]
        });
        if (hasGift('othello')) {
          rows.push({
            id: 'look',
            label: 'Look',
            value: opt.look,
            tabs: [
              { value: 'plain', label: 'Plain' },
              { value: 'sunmoon', label: 'Sun and moon' }
            ]
          });
        }
      }
      return rows;
    }

    function bakeBoardChipTex(boardId, on, open, k) {
      const lw = 112, lh = 66;
      const W = Math.max(8, Math.round(lw * k)), H = Math.max(8, Math.round(lh * k));
      const t = ctx.shapeTex(W, H, b => {
        const fill = !open ? '#cfc5b2' : (on ? K.COL.tabOn : K.COL.tabOff);
        B.paper(b, ctx.cutEdge(3 * k, 3 * k, W - 3 * k, H - 3 * k, 3 * k, 641 + ctx.sid(boardId) + (on ? 11 : 0)), fill, on ? 0.62 : 0.45);
        drawContPolys(b, boardId, 6 * k, 4 * k, W - 12 * k, H - 8 * k, k, () => ({
          col: open ? (on ? '#fffdf6' : '#f4ecda') : '#b0a694',
          relief: open ? 0.72 : 0.48,
          border: open
        }));
        if (!open) {
          const q = b.c;
          q.save();
          q.strokeStyle = K.COL.pencil;
          q.lineWidth = Math.max(1, 1.8 * k);
          q.setLineDash([5 * k, 4 * k]);
          q.strokeRect(7 * k, 7 * k, W - 14 * k, H - 14 * k);
          q.restore();
        }
      }, { noMip: true });
      t.lw = lw; t.lh = lh;
      return t;
    }

    function bakeP2ChipTex(choice, k) {
      const lw = 280, lh = 66;
      const W = Math.max(8, Math.round(lw * k)), H = Math.max(8, Math.round(lh * k));
      const t = ctx.shapeTex(W, H, b => {
        B.paper(b, ctx.cutEdge(3 * k, 3 * k, W - 3 * k, H - 3 * k, 3.5 * k, 709 + ctx.sid(choice.id)), K.COL.tabOn, 0.58);
        K.drawSpecialToken(b, choice.token, 38 * k, H / 2, 0.62 * k);
        ctx.ink(b, choice.label, 76 * k, H / 2, 28 * k, { maxW: (lw - 94) * k, col: K.COL.ink });
      }, { noMip: true });
      t.lw = lw; t.lh = lh;
      return t;
    }

    function bakePlayBtnTex(k) {
      const lw = 300, lh = 92;
      const W = Math.max(8, Math.round(lw * k)), H = Math.max(8, Math.round(lh * k));
      const t = ctx.shapeTex(W, H, b => {
        B.paper(b, ctx.cutEdge(4 * k, 4 * k, W - 4 * k, H - 4 * k, 4.5 * k, 881), K.COL.play, 0.65);
        ctx.ink(b, 'Play', W / 2, H / 2 + 1 * k, 46 * k, { align: 'center', maxW: (lw - 40) * k, col: ctx.CREAM });
      }, { noMip: true });
      t.lw = lw; t.lh = lh;
      return t;
    }

    function openSetup(gameId, noAnim) {
      if (!boxState) openBox({ quiet: true, noAnim: true });
      closeSetup(true);
      if (storyState) closeStory(true);
      screen = 'setup';
      activeId = gameId;
      layoutHud();

      const asp = ctx.asp(), W = 1000 * asp, sc0 = ctx.devPerHud();
      const rows = buildSetupRows(gameId);
      const hasExplain = rows.some(r => r.explain);
      const W0 = Math.min(780, Math.max(580, W - 40));
      const PITCH = 86;
      const H0 = 96 + rows.length * PITCH + (hasExplain ? 28 : 0) + 130;
      const top = ctx.topHudBottom() + 16;
      const s = Math.min(1, (W - 40) / W0, (990 - top) / H0);
      const cw = W0 * s, ch = H0 * s;
      const cx = W / 2, cy = top + Math.max(ch / 2, (990 - top) / 2);
      const x0 = cx - cw / 2, y0 = cy - ch / 2;
      const X = u => x0 + u * s, Y = u => y0 + u * s;
      const ks = sc0 * s;

      const st = {
        gameId,
        sprs: [],
        rows: [],
        s,
        rect: [x0, y0, x0 + cw, y0 + ch],
        storyBox: { x: X(W0 - 38 - 32), y: Y(48), w: 64 * s, h: 46 * s },
        playBtn: null,
        playRect: null,
        card: null
      };
      setupState = st;
      const mk = (tex, cfg) => {
        const sp = K.spr(tex, Object.assign({ hud: true, z: 0.162, zr: 0.03, order: 223, own: true }, cfg));
        st.sprs.push(sp);
        return sp;
      };

      const cardTex = K.cardTex(W0, H0, (b, k) => {
        ctx.ink(b, PG.NAME[gameId] || gameId, 38 * k, 50 * k, 46 * k, { maxW: (W0 - 150) * k, col: K.COL.ink });
        drawMiniPostcard(b, W0 - 38 - 64, 25, 64, 46, k);
        const q = b.c;
        q.save();
        q.strokeStyle = 'rgba(66,68,82,0.18)';
        q.lineWidth = Math.max(1, 1.5 * k);
        q.beginPath(); q.moveTo(36 * k, 86 * k); q.lineTo((W0 - 36) * k, 86 * k); q.stroke();
        q.restore();
        rows.forEach((r, idx) => {
          const ry = 96 + idx * PITCH + PITCH / 2;
          ctx.ink(b, r.label, 38 * k, ry * k, 28 * k, { maxW: 196 * k, col: K.COL.ink });
          if (r.explain) {
            ctx.ink(b, r.explain, 38 * k, (ry + 50) * k, 22 * k, { maxW: (W0 - 76) * k, col: K.COL.dimInk });
          }
        });
      }, 587 + ctx.sid(gameId), ks);

      st.card = mk(cardTex, {
        order: 222, z: 0.158,
        x: cx, y: cy, w: cw, h: ch,
        rot: -0.003,
        lift: noAnim ? 0 : 0.28
      });
      if (!noAnim) K.tw(st.card, { lift: 0 }, 0.25, { cut: true });

      const tabStartX = 248;
      const tabAvailW = W0 - tabStartX - 36;
      rows.forEach((r, idx) => {
        const ry = 96 + idx * PITCH + PITCH / 2;
        const rowRec = { id: r.id, value: r.value, tabs: [] };
        if (r.kind === 'p2') {
          const tex = bakeP2ChipTex(r.choice, ks);
          const tx = X(tabStartX) + tex.lw * s / 2;
          const ty = Y(ry);
          const sp = mk(tex, { x: tx, y: ty, w: tex.lw * s, h: tex.lh * s, rot: -0.4 * DEG, lift: 0.04 });
          rowRec.tabs.push({
            value: r.choice.id,
            s: sp,
            rect: [tx - sp.w / 2, ty - sp.h / 2, tx + sp.w / 2, ty + sp.h / 2]
          });
        } else if (r.kind === 'boards') {
          const gap = 12;
          const chipW = Math.min(112, (tabAvailW - gap * 3) / 4);
          const scChip = chipW / 112;
          let ux = tabStartX;
          r.tabs.forEach((tb, ti) => {
            const on = r.value === tb.value;
            const tex = bakeBoardChipTex(tb.value, on, tb.open, ks * scChip);
            const w = tex.lw * scChip * s, h = tex.lh * scChip * s;
            const tx = X(ux) + w / 2, ty = Y(ry);
            const sp = mk(tex, { x: tx, y: ty, w, h, rot: (ti % 2 ? 0.6 : -0.6) * DEG, lift: on ? 0.05 : 0 });
            rowRec.tabs.push({
              value: tb.value,
              open: tb.open,
              s: sp,
              rect: [tx - w / 2, ty - h / 2, tx + w / 2, ty + h / 2]
            });
            ux += chipW + gap;
          });
        } else {
          const gap = 16;
          const texes = r.tabs.map((tb, ti) => {
            const on = r.value === tb.value;
            return K.tabTex(tb.label, on, { px: 28, minW: 136, center: true, scale: ks, seed: ctx.sid(r.id + tb.label) + ti * 7 });
          });
          const rawW = texes.reduce((a, t) => a + t.lw, 0) + gap * Math.max(0, texes.length - 1);
          const scRow = Math.min(1, tabAvailW / Math.max(1, rawW));
          let ux = tabStartX;
          r.tabs.forEach((tb, ti) => {
            const on = r.value === tb.value;
            const tex = texes[ti];
            const w = tex.lw * scRow * s, h = tex.lh * scRow * s;
            const tx = X(ux) + w / 2, ty = Y(ry);
            const sp = mk(tex, { x: tx, y: ty, w, h, rot: (ti % 2 ? 0.5 : -0.5) * DEG, lift: on ? 0.05 : 0 });
            rowRec.tabs.push({
              value: tb.value,
              s: sp,
              rect: [tx - w / 2, ty - h / 2, tx + w / 2, ty + h / 2]
            });
            ux += tex.lw * scRow + gap;
          });
        }
        st.rows.push(rowRec);
      });

      // Play button at bottom centre
      const playTex = bakePlayBtnTex(ks);
      const pw = playTex.lw * s, ph = playTex.lh * s;
      const px = cx, py = Y(H0 - 66);
      st.playBtn = mk(playTex, { order: 224, z: 0.166, x: px, y: py, w: pw, h: ph, rot: -0.6 * DEG, lift: 0.05 });
      st.playRect = [px - pw / 2, py - ph / 2, px + pw / 2, py + ph / 2];

      ctx.setHint(PG.NAME[gameId] || 'Pick options');
    }

    function closeSetup(silent) {
      const st = setupState;
      if (!st) return;
      setupState = null;
      for (const sp of st.sprs) K.kill(sp);
      if (!silent) {
        screen = 'box';
        activeId = null;
        ctx.setHint('Pick a game');
        layoutHud();
      }
    }

    function setupDown(p) {
      const st = setupState;
      if (!st) return;
      const hPx = ctx.hudPx();
      const sv = getSave();
      const opt = sv.opt[st.gameId];

      // Story tab at top right
      if (ctx.hitMin(st.storyBox, p.hx, p.hy, 4, hPx)) {
        openStory(st.gameId, 'setup');
        return;
      }

      // Play button
      if (st.playBtn && ctx.hitMin(st.playBtn, p.hx, p.hy, 4, hPx)) {
        ctx.sfx.snap();
        const gid = st.gameId;
        const chosenOpt = Object.assign({}, opt);
        if (K.isFast()) {
          closeSetup(true);
          closeBox();
          startGame(gid, chosenOpt, true);
          return;
        }
        for (const sp of st.sprs) K.tw(sp, { lift: 0.45, y: sp.y - 24 }, 2 / 12, { cut: true });
        if (boxState) {
          for (const sp of boxState.sprs) K.tw(sp, { lift: 0.45, y: sp.y - 24 }, 2 / 12, { cut: true });
        }
        K.after(2 / 12, () => {
          closeSetup(true);
          closeBox();
          startGame(gid, chosenOpt, false);
        });
        return;
      }

      // Row tabs
      for (const row of st.rows) {
        for (const tb of row.tabs) {
          if (tb.s && ctx.hitMin(tb.s, p.hx, p.hy, 4, hPx)) {
            if (row.id === 'p2') {
              const { choice, choices } = currentP2Choice();
              const idx = choices.indexOf(choice);
              const next = choices[(idx + 1) % choices.length];
              sv.p2 = next.id;
              saveNow();
              ctx.sfx.pick();
              openSetup(st.gameId, true);
              return;
            }
            if (row.id === 'board' && !tb.open) {
              ctx.startWobble(tb.s);
              K.snd.nope();
              const msg = boardLockMsg(tb.value);
              ctx.setHint(msg);
              ctx.speakText(msg);
              return;
            }
            if (opt[row.id] !== tb.value) {
              opt[row.id] = tb.value;
              saveNow();
              ctx.sfx.pick();
              if (row.id === 'rule') ctx.speakText(ruleExplanation(tb.value));
              openSetup(st.gameId, true);
            } else {
              tb.s.lift = 0.14;
              K.tw(tb.s, { lift: 0.05 }, 0.2, { cut: true });
              if (row.id === 'rule') ctx.speakText(ruleExplanation(tb.value));
            }
            return;
          }
        }
      }

      // Outside card -> back to box
      if (st.card && !ctx.hit(st.card, p.hx, p.hy, 0)) {
        closeSetup(false);
      }
    }

    function boxDown(p) {
      const box = boxState;
      if (!box) return;
      if (box.celebrating) flushCelebrations(box);
      for (const lid of box.lids) {
        if (lid.s && ctx.hit(lid.s, p.hx, p.hy, 2)) {
          tapLid(lid, p);
          return;
        }
      }
      if (box.rim && !ctx.hit(box.rim, p.hx, p.hy, 0)) {
        ctx.goWorld();
      }
    }

    function createStubGame(gameId, opt, immediate) {
      if (gameId === 'borders') {
        K.hideMat();
        try {
          const cf = ctx.contFrame ? ctx.contFrame(opt.board || 'sa') : null;
          ctx.fitCam(cf || ctx.worldFrame(), !immediate);
        } catch (err) {
          ctx.fitCam(ctx.worldFrame(), !immediate);
        }
      } else {
        K.ensureMat();
        if (ctx.camTo) {
          ctx.camTo(K.GT[0], K.GT[1], 1400);
        }
      }
      const nm = PG.NAME[gameId] || gameId;
      K.note('Coming soon', nm + ' is coming soon');
      ctx.setHint(nm);
      return {
        isStub: true,
        moves: () => 0,
        turn: () => activeStarter,
        winner: () => null,
        busy: () => false,
        canUndo: () => false,
        rebake() {
          K.note('Coming soon', nm + ' is coming soon');
        },
        destroy() {
          K.closeNote(true);
        }
      };
    }

    function startGame(gameId, opt, immediate) {
      if (storyState) closeStory(true);
      if (setupState) closeSetup(true);
      closeBox();
      stopActiveGame();

      screen = 'play';
      activeId = gameId;
      activeOpt = Object.assign({}, getSave().opt[gameId], opt || {});
      leaveArmed = { id: null, until: 0 };

      if (typeof PG[gameId] === 'function') {
        activeGame = PG[gameId](ctx, K, {
          onOver(winner) {
            screen = 'over';
            if (!doneAll() && ctx.currentPlayer()) {
              const sv = getSave();
              if (sv.n && sv.n[gameId]) {
                sv.n[gameId].played++;
                if (winner === 1) sv.n[gameId].won++;
                saveNow();
              }
            }
            layoutHud();
          },
          onLayout() { layoutHud(); },
          openBox() { press(); },
          again() {
            activeStarter = activeStarter === 1 ? 2 : 1;
            startGame(gameId, activeOpt, false);
          },
          getSave,
          saveNow,
          p2Choice: () => currentP2Choice().choice
        });
        if (activeGame && activeGame.start) {
          activeGame.start(activeOpt, { starter: activeStarter, immediate: !!immediate });
        }
      } else {
        activeGame = createStubGame(gameId, activeOpt, !!immediate);
      }
      layoutHud();
    }

    function visibleBarIds() {
      if (screen === 'play' || screen === 'over') {
        const ids = ['games', 'world', 'sound'];
        if (screen === 'play' && activeGame && activeGame.canUndo && activeGame.canUndo()) {
          ids.splice(1, 0, 'undo');
        }
        if (screen === 'play' && activeId === 'borders' && activeGame && activeGame.zoomable) {
          ids.push('zoomOut', 'zoomIn');
        }
        return ids;
      }
      return ['world', 'sound'];
    }

    function down(e, p) {
      if (storyState) {
        if (K.isFast() || ctx.now() - storyState.card.t0 > 0.25) closeStory(false);
        return;
      }
      const hPx = ctx.hudPx();
      const visBtns = ['games', 'world', 'sound', 'undo', 'zoomOut', 'zoomIn']
        .map(id => ({ id, s: ctx.btn[id] }))
        .filter(q => q.s && q.s.alpha > 0.5);
      const bh = ctx.pickHit(visBtns, p.hx, p.hy, 8, hPx, q => q.s);
      if (bh) {
        bh.s.lift = 0.15;
        K.tw(bh.s, { lift: 0 }, 0.3);
        if (bh.id === 'games') { press(); return; }
        if (bh.id === 'world') {
          if (screen === 'play' && !checkLeaveGuard('world', bh.s)) return;
          ctx.press('world');
          return;
        }
        if (bh.id === 'undo') { undo(); return; }
        ctx.press(bh.id);
        return;
      }
      if (ctx.playerBtn.alpha > 0.5 && ctx.hitMin(ctx.playerBtn, p.hx, p.hy, 8, hPx)) {
        ctx.startWobble(ctx.playerBtn);
        return;
      }
      if (screen === 'setup' && setupState) { setupDown(p); return; }
      if (screen === 'box' && boxState) { boxDown(p); return; }
      if ((screen === 'play' || screen === 'over') && activeGame && activeGame.down) {
        activeGame.down(e, p);
      }
    }

    function move(e) {
      if ((screen === 'play' || screen === 'over') && activeGame && activeGame.move) {
        activeGame.move(e, ctx.toW(e));
      }
    }

    function up(e) {
      if ((screen === 'play' || screen === 'over') && activeGame && activeGame.up) {
        activeGame.up(e, ctx.toW(e));
      }
    }

    function cancel() {
      if (activeGame && activeGame.cancel) activeGame.cancel();
    }

    function update(dt) {
      K.stepJobs();
      if (boxState) {
        for (const lid of boxState.lids) {
          if (lid.s) lid.s.rot = lid.tilt + ctx.wobbleRot(lid.s);
        }
      }
      if (setupState) {
        for (const r of setupState.rows) {
          for (const tb of r.tabs) {
            if (tb.s && tb.s.wob) tb.s.rot = (tb.s.baseTilt || 0) + ctx.wobbleRot(tb.s);
          }
        }
      }
      if (activeGame && activeGame.update) activeGame.update(dt);
    }

    function layoutHud() {
      const asp = ctx.asp(), W = 1000 * asp, hasP = !!ctx.currentPlayer();
      const title = ctx.title, playerBtn = ctx.playerBtn, btn = ctx.btn, hintS = ctx.hint();
      playerBtn.alpha = hasP ? 1 : 0;
      title.rot = title.tilt;
      playerBtn.rot = playerBtn.tilt + ctx.wobbleRot(playerBtn);
      if (hintS) hintS.rot = hintS.tilt;

      const allHide = ['passport', 'mail', 'mailMap', 'hint', 'games', 'world', 'sound', 'undo', 'zoomOut', 'zoomIn'];
      for (const id of allHide) { if (btn[id]) btn[id].alpha = 0; }

      const showIds = visibleBarIds().filter(id => !!btn[id]);
      const rightIds = showIds.slice().reverse();
      for (const id of showIds) btn[id].rot = btn[id].tilt + ctx.wobbleRot(btn[id]);

      if (asp < 0.9) {
        title.alpha = 1;
        const pad = 24, maxW = Math.max(120, W - pad * 2), tGap = 10;
        const totW = title.bw + (hasP ? tGap + playerBtn.bw : 0), ts = Math.min(1, maxW / totW);
        title.w = title.bw * ts; title.h = title.bh * ts;
        title.x = pad + title.w / 2; title.y = 20 + title.h / 2;
        playerBtn.w = playerBtn.bw * ts; playerBtn.h = playerBtn.bh * ts;
        playerBtn.x = title.x + title.w / 2 + tGap * ts + playerBtn.w / 2; playerBtn.y = title.y;
        const gap = 10;
        const rawW = showIds.reduce((a, id) => a + btn[id].bw, 0) + gap * Math.max(0, showIds.length - 1);
        const bs = Math.min(1, maxW / Math.max(1, rawW));
        let x = pad, rowY = title.y + title.h / 2 + 10, rowH = 0;
        for (const id of showIds) {
          const s = btn[id];
          s.alpha = 1; s.w = s.bw * bs; s.h = s.bh * bs;
          s.x = x + s.w / 2; s.y = rowY + s.h / 2;
          x += s.w + gap * bs;
          rowH = Math.max(rowH, s.h);
        }
        if (hintS) {
          const k = Math.min(1, maxW / Math.max(1, hintS.bw));
          hintS.w = hintS.bw * k; hintS.h = hintS.bh * k;
          hintS.x = pad + hintS.w / 2; hintS.y = rowY + rowH + 10 + hintS.h / 2;
        }
      } else if (ctx.PHONE && !ctx.pickerOpen()) {
        title.alpha = 0;
        const padX = 24, gap = 14;
        playerBtn.w = playerBtn.bw; playerBtn.h = playerBtn.bh;
        const leftEdge = hasP ? padX + playerBtn.w + gap : padX;
        const availBtnW = Math.max(120, W - padX - leftEdge);
        const rawW = rightIds.reduce((a, id) => a + btn[id].bw, 0) + gap * Math.max(0, rightIds.length - 1);
        const bs = Math.min(1, availBtnW / Math.max(1, rawW));
        const btnH = btn.sound.bh * bs;
        const rowH = Math.max(btnH, hasP ? playerBtn.h : 0);
        const cy = 8 + rowH / 2;
        playerBtn.x = padX + playerBtn.w / 2; playerBtn.y = cy;
        let x = W - padX;
        for (const id of rightIds) {
          const s = btn[id];
          s.alpha = 1; s.w = s.bw * bs; s.h = s.bh * bs;
          s.x = x - s.w / 2; s.y = cy;
          x -= s.w + gap * bs;
        }
        const rightEdge = x + gap * bs - gap;
        if (hintS) {
          const availHint = rightEdge - leftEdge;
          if (availHint >= hintS.bw * 0.75) {
            const k = Math.min(1, availHint / Math.max(1, hintS.bw));
            hintS.w = hintS.bw * k; hintS.h = hintS.bh * k;
            hintS.x = leftEdge + hintS.w / 2; hintS.y = cy;
          } else {
            const k = Math.min(1, Math.max(120, W - padX * 2) / Math.max(1, hintS.bw));
            hintS.w = hintS.bw * k; hintS.h = hintS.bh * k;
            hintS.x = padX + hintS.w / 2; hintS.y = 8 + rowH + 8 + hintS.h / 2;
          }
        }
      } else {
        title.alpha = 1;
        title.w = title.bw; title.h = title.bh;
        title.x = 34 + title.w / 2; title.y = 26 + title.h / 2;
        playerBtn.w = playerBtn.bw; playerBtn.h = playerBtn.bh;
        playerBtn.x = title.x + title.w / 2 + 14 + playerBtn.w / 2; playerBtn.y = title.y;
        const leftEnd = hasP ? (playerBtn.x + playerBtn.w / 2 + 16) : (title.x + title.w / 2 + 16);
        const availBtnW = Math.max(120, W - 30 - leftEnd);
        const rawW = rightIds.reduce((a, id) => a + btn[id].bw, 0) + 14 * Math.max(0, rightIds.length - 1);
        const bs = Math.min(1, availBtnW / Math.max(1, rawW));
        let x = W - 30;
        for (const id of rightIds) {
          const s = btn[id];
          s.alpha = 1; s.w = s.bw * bs; s.h = s.bh * bs;
          s.x = x - s.w / 2; s.y = 30 + s.h / 2;
          x -= s.w + 14 * bs;
        }
        if (hintS) {
          const maxH = Math.max(120, W - 68);
          const k = Math.min(1, maxH / Math.max(1, hintS.bw));
          hintS.w = hintS.bw * k; hintS.h = hintS.bh * k;
          hintS.x = 34 + hintS.w / 2; hintS.y = title.y + title.h / 2 + 8 + hintS.h / 2;
        }
      }
      if (activeGame && activeGame.layoutHud) activeGame.layoutHud();
    }

    function rebake() {
      K.freeSharedCaches();
      if (screen === 'box') {
        // a late web font rebakes the box at boot (?view=games): start the stamp celebration again on the new box
        const nb = openBox({ quiet: true, noAnim: true });
        if (nb) queueStampCelebrations(nb);
      } else if (screen === 'setup' && setupState) {
        const gid = setupState.gameId;
        openBox({ quiet: true, noAnim: true });
        openSetup(gid, true);
      } else if (screen === 'story' && storyState) {
        const gid = storyState.gameId, ret = storyState.returnTo;
        if (ret === 'setup') {
          openBox({ quiet: true, noAnim: true });
          openSetup(gid, true);
        } else {
          openBox({ quiet: true, noAnim: true });
        }
        openStory(gid, ret, true);
      } else if ((screen === 'play' || screen === 'over') && activeGame && activeGame.rebake) {
        activeGame.rebake();
      }
      layoutHud();
    }

    function undo() {
      if (activeGame && activeGame.undo) activeGame.undo();
    }

    function gameApi(id) {
      return (activeId === id && activeGame && activeGame.api) ? activeGame.api : null;
    }

    const api = {
      state() {
        return {
          on: ctx.mode() === 'games',
          screen,
          game: activeId,
          sprites: K.sprites.size,
          turn: activeGame && activeGame.turn ? activeGame.turn() : null,
          over: screen === 'over',
          winner: activeGame && activeGame.winner ? activeGame.winner() : null,
          bot: !!(activeOpt && activeOpt.players === 1),
          busy: !!(activeGame && activeGame.busy && activeGame.busy()),
          box: boxState ? {
            s: boxState.s,
            lids: boxState.lids.map(l => ({
              id: l.id,
              wrapped: l.wrapped,
              stamps: (PG.HOME[l.id] || []).filter(cid => stampShown(l.id, cid)),
              star: lidHasStar(l.id),
              rect: l.rect.slice()
            }))
          } : null,
          setup: setupState ? {
            rows: setupState.rows.map(r => ({
              id: r.id,
              value: r.value,
              tabs: r.tabs.map(t => ({ value: t.value, rect: t.rect.slice() }))
            })),
            play: setupState.playRect ? setupState.playRect.slice() : null
          } : null,
          save: getSave()
        };
      },
      open() {
        if (ctx.mode() === 'world') press();
        else if (ctx.mode() === 'games') openBox();
      },
      close() {
        if (ctx.mode() === 'games') ctx.goWorld();
      },
      start(id, opt) {
        if (!PLAY_IDS.includes(id)) return false;
        if (ctx.mode() !== 'games') {
          ctx.sendAllTwinsHome(true);
          ctx.clearTags();
          ctx.clearStars();
          ctx.clearCompareTag();
          ctx.setMode('games');
        }
        startGame(id, opt || {}, true);
        return true;
      },
      tap(id) {
        if (screen !== 'box' || !boxState) return false;
        const lid = boxState.lids.find(l => l.id === id);
        if (!lid) return false;
        tapLid(lid, null);
        return true;
      },
      seed(n) { K.setSeed(n); },
      fast(v) { K.setFast(v); },
      undo() { undo(); },
      again() {
        if (!activeId) return false;
        activeStarter = activeStarter === 1 ? 2 : 1;
        startGame(activeId, activeOpt || {}, false);
        return true;
      },
      borders: {
        state: () => { const a = gameApi('borders'); return a && a.state ? a.state() : null; },
        graph: board => {
          const a = gameApi('borders');
          if (a && a.graph) return a.graph(board);
          if (PG.logic.borders && PG.logic.borders.buildGraph) return PG.logic.borders.buildGraph(ctx.GEO, board || 'sa');
          return null;
        },
        play: id => { const a = gameApi('borders'); return a && a.play ? a.play(id) : false; },
        bot: () => { const a = gameApi('borders'); return a && a.bot ? a.bot() : null; },
        at: id => { const a = gameApi('borders'); return a && a.at ? a.at(id) : null; }
      },
      mancala: {
        state: () => { const a = gameApi('mancala'); return a && a.state ? a.state() : null; },
        set: (pits, turn) => { const a = gameApi('mancala'); if (a && a.set) a.set(pits, turn); },
        play: pit => { const a = gameApi('mancala'); return a && a.play ? a.play(pit) : false; },
        bot: () => { const a = gameApi('mancala'); return a && a.bot ? a.bot() : null; },
        at: pit => { const a = gameApi('mancala'); return a && a.at ? a.at(pit) : null; }
      },
      othello: {
        state: () => { const a = gameApi('othello'); return a && a.state ? a.state() : null; },
        set: (grid, turn) => { const a = gameApi('othello'); if (a && a.set) a.set(grid, turn); },
        play: (r, c) => { const a = gameApi('othello'); return a && a.play ? a.play(r, c) : false; },
        bot: () => { const a = gameApi('othello'); return a && a.bot ? a.bot() : null; },
        at: (r, c) => { const a = gameApi('othello'); return a && a.at ? a.at(r, c) : null; }
      },
      logic: PG.logic
    };

    return {
      btnOn, press, enter, exit,
      down, move, up, cancel,
      update, layoutHud, rebake, undo,
      cleanSave, api
    };
  };
})();
