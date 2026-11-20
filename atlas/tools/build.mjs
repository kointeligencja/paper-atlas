// Build step: Natural Earth borders -> atlas/data/geo.js, flag reference SVGs -> atlas/data/flags.js, populated places -> atlas/data/capitals.js
// usage: node build.mjs <ne50.geojson|ne10m_pp.geojson|-> <playwright-core dir|-> [geo|flags|capitals|all] [ne10m_pp.geojson]
//   geo:      node build.mjs <ne_50m_admin_0_countries> - geo <ne_10m_admin_0_countries> <ne_10m_populated_places>   (tools/clipper.cjs: Clipper 6.4.2, Boost licence)
//   capitals: node build.mjs <ne_10m_populated_places> - capitals
// flags mode also reads tools/flag-overrides.json; env FLAGS_ONLY=JP,CH (subset), FLAGS_OUT=<file> (write elsewhere), FLAGS_NO_OVERRIDES=1 (automatic result only)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'data'), REF = path.join(here, '..', 'flags-ref');
const [, , NE, PWDIR, WHAT = 'all', NE_PP] = process.argv;
const NE_PP_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson';

const UN = 'AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VE VN YE ZM ZW'.split(' ');
const NAMEFIX = { 'Dem. Rep. Congo': 'DR Congo', 'Bosnia and Herz.': 'Bosnia and Herzegovina', 'Central African Rep.': 'Central African Republic', 'Eq. Guinea': 'Equatorial Guinea', 'Dominican Rep.': 'Dominican Republic', 'S. Sudan': 'South Sudan', 'Solomon Is.': 'Solomon Islands', 'Marshall Is.': 'Marshall Islands', 'St. Kitts and Nevis': 'Saint Kitts and Nevis', 'St. Vin. and Gren.': 'Saint Vincent and the Grenadines', 'Antigua and Barb.': 'Antigua and Barbuda', 'United States of America': 'United States', 'eSwatini': 'Eswatini', 'Côte d\'Ivoire': 'Ivory Coast', 'Cabo Verde': 'Cape Verde' };
const CONT = { 'South America': 'sa', 'North America': 'na', 'Europe': 'eu', 'Africa': 'af', 'Asia': 'as', 'Oceania': 'oc' };
const CONTFIX = { RU: 'as', MV: 'as', MU: 'af', SC: 'af' };

// Equal Earth, central meridian 11.5E, world = 2000 x ~974 units
const LON0 = 11.5, A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2, S = 2000 / (2 * 2.7066297);
function proj(lon, lat) {
  let l = lon - LON0; if (l < -180) l += 360; if (l > 180) l -= 360;
  const th = Math.asin(M * Math.sin(lat * Math.PI / 180)), t2 = th * th, t6 = t2 * t2 * t2;
  const x = (l * Math.PI / 180) * Math.cos(th) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
  const y = th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
  return [1000 + x * S, 487 - y * S];
}
const area = r => { let a = 0; for (let i = 0, n = r.length; i < n; i++) { const p = r[i], q = r[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
function dp(pts, tol) {
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let md = 0, mi = -1; const ax = pts[a][0], ay = pts[a][1], dx = pts[b][0] - ax, dy = pts[b][1] - ay, L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return pts.filter((_, i) => keep[i]);
}
function simp(ring, tol) { // closed ring
  const n = ring.length; if (n < 8) return ring; const h = n >> 1;
  const a = dp(ring.slice(0, h + 1), tol), b = dp(ring.slice(h).concat([ring[0]]), tol);
  return a.slice(0, -1).concat(b.slice(0, -1));
}

// ---------- geo: polygon tools (Clipper, integer coordinates at 0.01 world units) ----------
const CL = createRequire(import.meta.url)('./clipper.cjs');
const CS = 1000, PT = CL.PolyType, CT = CL.ClipType, PF = CL.PolyFillType;
const cPath = f => { const p = []; for (let i = 0; i < f.length; i += 2) p.push({ X: Math.round(f[i] * CS), Y: Math.round(f[i + 1] * CS) }); return p; };
const cFlat = p => p.flatMap(q => [q.X / CS, q.Y / CS]);
function cOp(a, b, op, fa = PF.pftNonZero) {
  if (!a.length && op !== CT.ctUnion) return []; if (!a.length) { a = b; b = []; }
  const c = new CL.Clipper(); c.AddPaths(a, PT.ptSubject, true); if (b && b.length) c.AddPaths(b, PT.ptClip, true);
  const out = new CL.Paths(); c.Execute(op, out, fa, PF.pftNonZero); return out;
}
const cU = (a, b) => cOp(a, b, CT.ctUnion), cI = (a, b) => cOp(a, b, CT.ctIntersection), cD = (a, b) => cOp(a, b, CT.ctDifference);
const cEO = flats => cOp(flats.map(cPath), [], CT.ctUnion, PF.pftEvenOdd); // game rings (even-odd) -> oriented paths
function cGrow(paths, d) { if (!paths.length) return []; const co = new CL.ClipperOffset(2, 0.01 * CS); co.AddPaths(paths, CL.JoinType.jtRound, CL.EndType.etClosedPolygon); const out = new CL.Paths(); co.Execute(out, d * CS); return out; }
const cTidy = (paths, minA) => CL.Clipper.CleanPolygons(paths, 1.1).filter(p => p.length >= 3 && Math.abs(CL.Clipper.Area(p)) / CS / CS >= minA);
const flatArea = f => { let a = 0; for (let i = 0, n = f.length; i < n; i += 2) { const j = (i + 2) % n; a += f[i] * f[j + 1] - f[j] * f[i + 1]; } return a / 2; };
const flatBox = fs_ => { const b = [1e9, 1e9, -1e9, -1e9]; for (const f of fs_) for (let i = 0; i < f.length; i += 2) { b[0] = Math.min(b[0], f[i]); b[1] = Math.min(b[1], f[i + 1]); b[2] = Math.max(b[2], f[i]); b[3] = Math.max(b[3], f[i + 1]); } return b; };
const boxGap = (a, b) => Math.max(0, a[0] - b[2], b[0] - a[2], a[1] - b[3], b[1] - a[3]);
const eoArea = flats => Math.abs(cEO(flats).reduce((s, p) => s + CL.Clipper.Area(p), 0)) / CS / CS;
const r2 = v => +v.toFixed(2);

// node build.mjs <ne50 admin-0> - geo <ne10m admin-0> <ne10m populated places>
// 1:10m outlines replace the 1:50m ones for small countries (under 40 points or under 2 square units); Kiribati is the Gilbert chain around Tarawa.
// Every 1:50m land ring that is not part of a playable piece is kept in GEO.neutral and labelled: GEO.terr (territories, grouped, with a continent)
// or country.x (land of a playable country that is not part of its drag piece: Hawaii, the Azores, ...).
function buildGeo() {
  const NE10 = process.env.NE10 || (WHAT === 'geo' ? process.argv[5] : null), PP10 = process.env.NE_PP || (WHAT === 'geo' ? process.argv[6] : NE_PP);
  if (!NE10 || !fs.existsSync(NE10)) throw new Error('geo needs the Natural Earth 1:10m admin-0 countries file (4th argument or NE10=...)');
  const gj = JSON.parse(fs.readFileSync(NE, 'utf8'));
  const countries = [], neutral = []; let aq = null; const report = [];
  const raw = []; // unsimplified projected rings of every 1:50m feature: { iso, outer, holes, bb }
  const llOf = R => { let sx = 0, sy = 0; for (const c of R) { sx += c[0]; sy += c[1]; } return [sx / R.length, sy / R.length]; };
  const nItem = (f, kind, iso, p, ll) => neutral.push({ f, kind, iso, name: p.NAME, cont: p.CONTINENT, ll });
  for (const f of gj.features) {
    const p = f.properties; let iso = p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    if (iso === 'AQ') { // coast profile -> one clean white piece
      const bins = new Array(361).fill(-90);
      for (const poly of polys) { const R = poly[0]; for (let i = 0; i < R.length - 1; i++) { let l0 = R[i][0] - LON0, l1 = R[i + 1][0] - LON0; if (l0 < -180) l0 += 360; if (l1 < -180) l1 += 360; if (Math.abs(l1 - l0) > 90) continue; const n = Math.max(1, Math.ceil(Math.abs(l1 - l0) * 2)); for (let k = 0; k <= n; k++) { const l = l0 + (l1 - l0) * k / n, la = R[i][1] + (R[i + 1][1] - R[i][1]) * k / n, b = Math.round(l + 180); if (la > bins[b] && la < -60) bins[b] = la; } } }
      for (let i = 0; i < 361; i++) if (bins[i] <= -85) bins[i] = -85.5; { const b0 = bins.slice(); for (let i = 0; i < 361; i++) { let m = -90; for (let k = -3; k <= 3; k++) m = Math.max(m, b0[Math.min(360, Math.max(0, i + k))]); bins[i] = m; } }
      const ring = []; for (let i = 0; i <= 360; i += 2) ring.push(proj(i - 180 + LON0 + (i === 0 ? 0.01 : i === 360 ? -0.01 : 0), Math.max(bins[i], bins[Math.min(360, i + 1)])));
      for (let i = 360; i >= 0; i -= 20) ring.push(proj(i - 180 + LON0 + (i === 0 ? 0.01 : i === 360 ? -0.01 : 0), -87.5));
      aq = ring; continue;
    }
    // project rings; outer ring first, holes follow
    let rings = [];
    for (const poly of polys) {
      const outer = poly[0].map(c => proj(c[0], c[1])); const xs = outer.map(q => q[0]);
      if (Math.max(...xs) - Math.min(...xs) > 1000) continue; // crosses the map cut
      const allHoles = poly.slice(1).map(h => h.map(c => proj(c[0], c[1])));
      raw.push({ iso, outer, holes: allHoles, bb: flatBox([outer.flat()]) });
      const a = Math.abs(area(outer)); const holes = allHoles.filter(h => Math.abs(area(h)) > 0.6);
      rings.push({ outer, holes, a, cx: outer.reduce((s, q) => s + q[0], 0) / outer.length, cy: outer.reduce((s, q) => s + q[1], 0) / outer.length, ll: llOf(poly[0]) });
    }
    if (!rings.length) continue;
    rings.sort((a, b) => b.a - a.a); const big = rings[0];
    const playable = UN.includes(iso);
    const keep = [], drop = [];
    for (const r of rings) {
      const far = Math.hypot(r.cx - big.cx, r.cy - big.cy) > 25 + Math.sqrt(big.a) * 1.9;
      if (r === big || (!far && (r.a > 0.35 || r.a > big.a * 0.04)) || (far && big.a > 50 && r.a > big.a * 0.18 && Math.hypot(r.cx - big.cx, r.cy - big.cy) < 420)) keep.push(r); else if (r.a > 0.8) drop.push(r);
    }
    const all = keep.flatMap(r => r.outer); const x0 = Math.min(...all.map(q => q[0])), x1 = Math.max(...all.map(q => q[0])), y0 = Math.min(...all.map(q => q[1])), y1 = Math.max(...all.map(q => q[1]));
    const diag = Math.hypot(x1 - x0, y1 - y0), tol = Math.min(0.32, Math.max(0.01, diag / 160));
    const flat = r => simp(r, tol).flatMap(q => [+q[0].toFixed(2), +q[1].toFixed(2)]);
    const out = [], outLL = []; let a0 = 0, a1 = 0;
    for (const r of keep) { const s = simp(r.outer, tol); if (s.length < 3) continue; a0 += r.a; a1 += Math.abs(area(s)); out.push(s.flatMap(q => [+q[0].toFixed(2), +q[1].toFixed(2)])); outLL.push(r.ll); for (const h of r.holes) { out.push(flat(h)); outLL.push(r.ll); } }
    for (const r of drop) nItem(flat(r.outer), playable ? 'drop' : 'terr', iso, p, r.ll);
    if (playable && countries.find(q => q.id === iso)) { const o = countries.find(q => q.id === iso); if (o.A >= big.a) { out.forEach((r, i) => nItem(r, 'terr', iso, p, outLL[i])); continue; } for (const r of o.polys) nItem(r, 'terr', iso, o.src, o.ll); countries.splice(countries.indexOf(o), 1); }
    if (playable) {
      const name = NAMEFIX[p.NAME] || p.NAME; let cont = CONTFIX[iso] || CONT[p.CONTINENT];
      if (!cont) { console.log('no continent', iso, p.CONTINENT); cont = 'oc'; }
      countries.push({ id: iso, A: big.a, name, cont, polys: out, bbox: [x0, y0, x1, y1].map(v => +v.toFixed(2)), c: [+big.cx.toFixed(2), +big.cy.toFixed(2)], src: p, ll: big.ll, tol });
      report.push({ iso, name, rings: out.length, pts: out.reduce((s, r) => s + r.length / 2, 0), areaKept: +(a1 / a0).toFixed(3) });
    } else out.forEach((r, i) => nItem(r, 'terr', iso, p, outLL[i]));
  }
  const missing = UN.filter(u => !countries.find(c => c.id === u));
  console.log('countries', countries.length, 'missing', missing.join(' '), 'neutral rings', neutral.length);
  console.log('names with dots:', countries.filter(c => /\./.test(c.name)).map(c => c.name).join(', '));
  const bad = report.filter(r => r.areaKept < 0.93 || r.areaKept > 1.07); console.log('area drift >7%:', bad.map(b => b.iso + ':' + b.areaKept).join(' '));
  const C = Object.fromEntries(countries.map(c => [c.id, c]));

  // ---------- small countries from Natural Earth 1:10m ----------
  const g10 = JSON.parse(fs.readFileSync(NE10, 'utf8')), a50 = new Set(gj.features.map(f => f.properties.ADM0_A3));
  // every 1:10m polygon, projected; 1:10m-only units (Akrotiri, Dhekelia, the Cyprus buffer zone) belong to the 1:50m country they lie in
  const p10 = [];
  for (const f of g10.features) { const p = f.properties; let iso = p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2; const only = !a50.has(p.ADM0_A3);
    for (const poly of (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)) { const outer = poly[0].map(c => proj(c[0], c[1])), xs = outer.map(v => v[0]); if (Math.max(...xs) - Math.min(...xs) > 1000) continue;
      const q = { iso, only, name: p.NAME, outer, holes: poly.slice(1).map(h => h.map(c => proj(c[0], c[1]))), a: Math.abs(area(outer)), cx: outer.reduce((s, v) => s + v[0], 0) / outer.length, cy: outer.reduce((s, v) => s + v[1], 0) / outer.length }; q.bb = flatBox([outer.flat()]); p10.push(q); } }
  for (const q of p10) if (q.only) { const host = raw.find(r => UN.includes(r.iso) && pipPolys(q.cx, q.cy, [r.outer.flat()])); if (host) { q.iso = host.iso; q.joined = true; } }
  const before = {}; for (const c of countries) before[c.id] = { pts: c.polys.reduce((s, r) => s + r.length / 2, 0), area: eoArea(c.polys) };
  const small = countries.filter(c => before[c.id].pts < 40 || before[c.id].area < 2 || c.id === 'KI').map(c => c.id);
  const order = small.slice().sort((a, b) => before[b].area - before[a].area); // larger first, so the smallest outlines win shared borders
  // the game's inset-card rule (game.js) and the legacy round order (v1 saves) read the bbox: remember both so a new outline cannot change them
  const cardRule = c => { const bw = c.bbox[2] - c.bbox[0], bh = c.bbox[3] - c.bbox[1]; return Math.sqrt(bw * bh) < 7 || Math.max(bw, bh) < 9.5 || (c.cont === 'oc' && Math.max(bw, bh) < 24); };
  const card0 = Object.fromEntries(countries.map(c => [c.id, cardRule(c)])), ctr0 = Object.fromEntries(countries.map(c => [c.id, [(c.bbox[0] + c.bbox[2]) / 2, (c.bbox[1] + c.bbox[3]) / 2]]));
  const E = 0.4; const src10 = {}; const changed = {}, r3 = v => +v.toFixed(3), tidyFlat = (paths, minA) => cTidy(paths, minA).map(p => cFlat(p).map(r3));
  // Kiribati: the island chain (1:10m) that contains the Tarawa capital point; the rest of Kiribati stays as extra land
  let tarawa = null;
  if (PP10 && fs.existsSync(PP10)) { const pp = JSON.parse(fs.readFileSync(PP10, 'utf8')); const t = pp.features.find(f => f.properties.ISO_A2 === 'KI' && String(f.properties.FEATURECLA).startsWith('Admin-0 capital')); if (t) tarawa = proj(t.geometry.coordinates[0], t.geometry.coordinates[1]); }
  if (!tarawa) throw new Error('Kiribati needs the populated places file (Tarawa capital point)');
  for (const id of order) {
    const X = C[id], kb = [X.bbox[0] - 2.5, X.bbox[1] - 2.5, X.bbox[2] + 2.5, X.bbox[3] + 2.5];
    let P = p10.filter(q => q.iso === id);
    if (id === 'KI') { // single-link chain from the ring nearest to Tarawa, at most 12 units between islands
      const d = q => Math.min(...q.outer.map(v => Math.hypot(v[0] - tarawa[0], v[1] - tarawa[1])));
      const chain = [P.slice().sort((a, b) => d(a) - d(b))[0]]; let grew = true;
      while (grew) { grew = false; for (const q of P) if (!chain.includes(q) && chain.some(o => Math.hypot(o.cx - q.cx, o.cy - q.cy) < 12)) { chain.push(q); grew = true; } }
      console.log('Kiribati: Tarawa point', tarawa.map(r2).join(','), 'chain', chain.length, 'of', P.length, '1:10m rings; left out', P.filter(q => !chain.includes(q)).map(q => r2(q.cx) + ',' + r2(q.cy)).join(' '));
      for (const r of X.polys) nItem(r, 'drop', 'KI', X.src, X.ll); // the old piece (Line Islands) stays Kiribati land, outside the piece
      P = chain;
    } else { const nb_ = [X.bbox[0] - 0.5, X.bbox[1] - 0.5, X.bbox[2] + 0.5, X.bbox[3] + 0.5]; P = P.filter(q => q.cx >= nb_[0] && q.cx <= nb_[2] && q.cy >= nb_[1] && q.cy <= nb_[3]); } // the same land as the 1:50m piece, in more detail (no islands added: they would shrink the inset card)
    if (!P.length) { console.log('no 1:10m rings for', id); continue; }
    P = P.slice().sort((a, b) => b.a - a.a); if (P.length > 12 && id !== 'KI') P = P.filter((q, i) => i < 12 || q.a >= 0.002);
    const pb = flatBox(P.map(q => q.outer.flat())); let tl = Math.min(0.32, Math.max(0.01, Math.hypot(pb[2] - pb[0], pb[3] - pb[1]) / 160)), X10, n;
    for (;;) { const rs = []; for (const q of P) { const s = simp(q.outer, tl); if (s.length >= 3) rs.push(s.flat()); for (const h of q.holes) { const t = simp(h, tl); if (t.length >= 3 && Math.abs(area(t)) > 0.0005) rs.push(t.flat()); } }
      X10 = cTidy(cEO(rs), 0.0004); n = X10.reduce((s, p) => s + p.length, 0); if (n >= 24 || tl < 0.0002) break; tl /= 2; }
    // the 1:10m outline stays whole; overlapping neighbours are cut along it, and the gaps between them (1:10m land of the neighbours) go to the nearest neighbour
    const nb = countries.filter(c => c !== X && boxGap(c.bbox, kb) <= 0), nn = neutral.filter(q => boxGap(flatBox([q.f]), kb) <= 0);
    const Nall = cU(nb.flatMap(c => cEO(c.polys)), nn.flatMap(q => cEO([q.f])));
    if (Nall.length) {
      const L = cU(p10.filter(q => boxGap(q.bb, kb) <= 0).flatMap(q => cEO([q.outer.flat(), ...q.holes.map(h => h.flat())])), []);
      const sliv = cTidy(cD(cD(cI(cI(cGrow(X10, E), cGrow(Nall, E)), L), X10), Nall), 0.0004), take = new Map();
      const nbP = new Map(nb.map(c => [c, cEO(c.polys)].concat([]))); for (const q of nn) nbP.set(q, cEO([q.f]));
      // each gap goes to the nearest neighbour, point by point: neighbours grow in steps of 0.03 and claim what they reach first
      let rest = sliv; const near = [...nbP].filter(([, P_]) => rest.length && cI(cGrow(P_, E + 0.1), rest).length);
      for (let d = 0.03; rest.length && d <= E + 0.1; d += 0.03) { let taken = [];
        for (const [c, P_] of near) { let q = cI(rest, cGrow(P_, d)); if (q.length && taken.length) q = cD(q, taken); if (!q.length) continue; taken = cU(taken, q); if (!take.has(c)) take.set(c, []); take.get(c).push(...q); }
        if (taken.length) rest = cD(rest, taken); }
      for (const c of nb) { const own = nbP.get(c), give = take.get(c) || []; if (!cI(own, X10).length && !give.length) continue;
        c.polys = tidyFlat(cD(cU(own, give), X10), 0.02); (changed[c.id] = changed[c.id] || []).push((cI(own, X10).length ? 'cut' : 'gap filled') + ' along ' + id); }
      for (const q of nn) { const own = nbP.get(q), give = take.get(q) || []; if (!cI(own, X10).length && !give.length) continue; const np = tidyFlat(cD(cU(own, give), X10), 0.02).sort((a, b) => Math.abs(flatArea(b)) - Math.abs(flatArea(a))); q.f = np[0] || []; for (const r of np.slice(1)) neutral.push({ ...q, f: r }); console.log('territory ring', q.name, (cI(own, X10).length ? 'cut' : 'gap filled') + ' along', id); }
    }
    X.polys = X10.map(p => cFlat(p).map(r3));
    const nbb = flatBox(X.polys); if (id === 'KI' || Math.max(...nbb.map((v, i) => Math.abs(v - X.bbox[i]))) > 0.005) X.bbox = nbb.map(r2);
    const bigR = X.polys.slice().sort((a, b) => Math.abs(flatArea(b)) - Math.abs(flatArea(a)))[0]; let gx = 0, gy = 0; for (let i = 0; i < bigR.length; i += 2) { gx += bigR[i]; gy += bigR[i + 1]; } X.c = [r2(gx / (bigR.length / 2)), r2(gy / (bigR.length / 2))];
    if (id === 'KI') X.card = 1; // a chain of atolls: always an inset card
    src10[id] = P.reduce((t, q) => t + q.outer.length - 1 + q.holes.reduce((u, h) => u + h.length - 1, 0), 0);
    changed[id] = (changed[id] || []).concat(['1:10m outline' + (P.some(q => q.joined) ? ' (with ' + [...new Set(P.filter(q => q.joined).map(q => q.name))].join(', ') + ')' : '')]);
    console.log('1:10m', id, 'pts', before[id].pts, '->', n, 'rings', X.polys.length, 'tol', +tl.toFixed(4), 'area', +before[id].area.toFixed(3), '->', +eoArea(X.polys).toFixed(3));
  }
  // a neighbour keeps its bbox (so its patchwork is cut the same way) unless the new outline reaches past it
  for (const id in changed) if (!small.includes(id)) { const c = C[id], f = flatBox(c.polys).map(r2), nbb = [Math.min(f[0], c.bbox[0]), Math.min(f[1], c.bbox[1]), Math.max(f[2], c.bbox[2]), Math.max(f[3], c.bbox[3])], mv = Math.max(...nbb.map((v, i) => Math.abs(v - c.bbox[i]))); console.log('neighbour', id, changed[id].join(', '), mv > 0 ? 'bbox grows ' + +mv.toFixed(3) : 'bbox kept'); if (mv > 0) c.bbox = nbb; }
  for (const c of countries) { if (c.card === undefined && cardRule(c) !== card0[c.id]) { c.card = card0[c.id] ? 1 : 0; console.log('inset card kept as before for', c.id, card0[c.id]); }
    const k = ctr0[c.id], cx = (c.bbox[0] + c.bbox[2]) / 2, cy = (c.bbox[1] + c.bbox[3]) / 2; if (Math.hypot(cx - k[0], cy - k[1]) > 1) { c.lc = k.map(r2); console.log('legacy round centre kept for', c.id, c.lc.join(',')); } }

  // ---------- territories and extra land ----------
  const nz = neutral.filter(q => q.f.length >= 6);
  nz.forEach(q => { q.bb = flatBox([q.f]); q.a = Math.abs(flatArea(q.f)); });
  const cluster = (items, link) => { const out = []; for (const q of items) { const hit = out.filter(g => g.some(o => boxGap(o.bb, q.bb) < link)); if (!hit.length) out.push([q]); else { hit[0].push(q); for (const g of hit.slice(1)) { hit[0].push(...g); out.splice(out.indexOf(g), 1); } } } return out; };
  const nearestCont = bb => { let best = null, bd = 1e9; for (const c of countries) { const d = boxGap(c.bbox, bb); if (d < bd) { bd = d; best = c; } } return best.cont; };
  const terr = [], xs = {}, tByKey = {}, xByIso = {};
  for (const q of nz) { if (q.kind === 'drop' && q.iso !== 'FR' && C[q.iso]) (xByIso[q.iso] = xByIso[q.iso] || []).push(q); else (tByKey[q.name] = tByKey[q.name] || []).push(q); }
  const idx = new Map(nz.map((q, i) => [q, i]));
  for (const key of Object.keys(tByKey).sort()) for (const g of cluster(tByKey[key], 40)) {
    const bb = flatBox(g.map(q => q.f)), big = g.slice().sort((a, b) => b.a - a.a)[0];
    const cont = (g[0].kind === 'drop' || !CONT[g[0].cont]) ? nearestCont(bb) : CONT[g[0].cont];
    terr.push({ n: key, cont, r: g.map(q => idx.get(q)).sort((a, b) => a - b), ll: big.ll.map(v => +v.toFixed(1)), a: +g.reduce((s, q) => s + q.a, 0).toFixed(2) });
  }
  for (const iso of Object.keys(xByIso).sort()) { C[iso].x = cluster(xByIso[iso], 40).map(g => g.map(q => idx.get(q)).sort((a, b) => a - b)); }
  console.log('territories', terr.length, 'groups;', terr.map(t => t.n + "/" + t.cont).join(', '));
  console.log('extra land', Object.keys(xByIso).map(iso => iso + ':' + C[iso].x.length).join(' '));
  const terrReport = terr.map(t => ({ ...t })); for (const t of terr) { delete t.ll; delete t.a; }
  for (const c of countries) { delete c.src; delete c.ll; delete c.tol; }
  for (const r of report) { const c = C[r.iso]; r.pts = c.polys.reduce((s, q) => s + q.length / 2, 0); r.rings = c.polys.length; if (changed[r.iso]) r.changed = changed[r.iso]; }
  fs.writeFileSync(path.join(OUT, 'geo-report.json'), JSON.stringify(report));
  if (process.env.GEO_REPORT) fs.writeFileSync(process.env.GEO_REPORT, JSON.stringify({ before, small, src10, changed, terr: terrReport, extra: Object.fromEntries(Object.keys(xByIso).map(iso => [iso, C[iso].x.map(g => ({ r: g, ll: nz[g[0]].ll.map(v => +v.toFixed(1)), a: +g.reduce((s, i) => s + nz[i].a, 0).toFixed(2) }))])) }, null, 1));
  fs.writeFileSync(path.join(OUT, 'geo.js'), 'window.GEO=' + JSON.stringify({ W: 2000, H: 974, lon0: LON0, countries, neutral: nz.map(q => q.f), terr, aq: aq.flatMap(q => [+q[0].toFixed(2), +q[1].toFixed(2)]) }) + ';');
  console.log('geo.js', (fs.statSync(path.join(OUT, 'geo.js')).size / 1e6).toFixed(2), 'MB');
}

async function fetchFlags() {
  const todo = UN.filter(u => !fs.existsSync(path.join(REF, u.toLowerCase() + '.svg')));
  for (let i = 0; i < todo.length; i += 16) await Promise.all(todo.slice(i, i + 16).map(async u => {
    const r = await fetch('https://raw.githubusercontent.com/hampusborgos/country-flags/main/svg/' + u.toLowerCase() + '.svg');
    if (!r.ok) { console.log('flag fetch failed', u); return; } fs.writeFileSync(path.join(REF, u.toLowerCase() + '.svg'), await r.text());
  }));
  fs.writeFileSync(path.join(REF, 'SOURCE.txt'), 'Flag reference set: https://github.com/hampusborgos/country-flags (SVG flags collected from Wikimedia Commons, public domain).\nUsed as the reference for layout, proportions and colours; coats of arms are cropped from these files for the stickers.\nBorders: Natural Earth 1:50m admin 0 countries (public domain), simplified in tools/build.mjs.\n');
}

// runs inside the browser page. OV: hand-checked override for this flag (or null).
// Returns { a, parts, grid, cols, miss } plus diagnostics (model, src, stk) that buildFlags strips before writing.
function pageAnalyse(svgText, PAL, OV) {
  return (async () => {
    const lab = (r, g, b) => { const f = v => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; }; r = f(r); g = f(g); b = f(b);
      let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
      const h = v => v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116; x = h(x); y = h(y); z = h(z); return [116 * y - 16, 500 * (x - y), 200 * (y - z)]; };
    const PL = PAL.map(h => lab(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)));
    const LIGHTBLUE = 8, BLUE = 9; const cache = new Map();
    // nearest paper (weighted Lab); a blue as light as the sky (L >= 53) goes to the light-blue paper, not the mid blue
    const near = (r, g, b) => { const k = (r >> 2) << 12 | (g >> 2) << 6 | (b >> 2); let v = cache.get(k); if (v !== undefined) return v; const L = lab(r, g, b); let bd = 1e9; for (let i = 0; i < PL.length; i++) { const d = (L[0] - PL[i][0]) ** 2 * 0.7 + (L[1] - PL[i][1]) ** 2 + (L[2] - PL[i][2]) ** 2; if (d < bd) { bd = d; v = i; } } if (v === BLUE && L[0] >= 53) v = LIGHTBLUE; cache.set(k, v); return v; };
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
    let vw = parseFloat(doc.getAttribute('width')), vh = parseFloat(doc.getAttribute('height')); const vb = (doc.getAttribute('viewBox') || '').split(/[ ,]+/).map(Number);
    if (vb.length === 4) { vw = vb[2]; vh = vb[3]; }
    const asp = vw / vh; const H = 300, W = Math.round(H * asp), SS = 3, N = W * H, KS = 1200; // KS: sticker bake, px per flag height (old build: 600)
    if (!doc.getAttribute('width')) { doc.setAttribute('width', vw); doc.setAttribute('height', vh); }
    const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(doc)); });
    const cv = document.createElement('canvas'); cv.width = W * SS; cv.height = H * SS; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, W * SS, H * SS);
    const big = cx.getImageData(0, 0, W * SS, H * SS).data; const P = new Uint8Array(N); const cnt = new Uint8Array(16);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { cnt.fill(0); for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) { const o = ((y * SS + j) * W * SS + x * SS + i) * 4; cnt[big[o + 3] < 128 ? 15 : near(big[o], big[o + 1], big[o + 2])]++; } let b = 0; for (let k = 1; k < 16; k++) if (cnt[k] > cnt[b]) b = k; P[y * W + x] = b; }
    // ---------- helpers ----------
    const rect = (x0, y0, x1, y1) => [x0 / H, y0 / H, x1 / H, y0 / H, x1 / H, y1 / H, x0 / H, y1 / H];
    const morph = (m, r, dil) => { if (r <= 0) return m.slice(); const t = new Uint8Array(N), o = new Uint8Array(N); // separable square max/min
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = dil ? 0 : 1; for (let d = -r; d <= r; d++) { const xx = x + d; const s = xx < 0 || xx >= W ? (dil ? 0 : 1) : m[y * W + xx]; if (dil ? s : !s) { v = dil ? 1 : 0; break; } } t[y * W + x] = v; }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = dil ? 0 : 1; for (let d = -r; d <= r; d++) { const yy = y + d; const s = yy < 0 || yy >= H ? (dil ? 0 : 1) : t[yy * W + x]; if (dil ? s : !s) { v = dil ? 1 : 0; break; } } o[y * W + x] = v; }
      return o; };
    const close = (m, r) => morph(morph(m, r, true), r, false);
    const fillHoles = m => { const out = new Uint8Array(N), st = []; for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const o = y * W + x; if (!m[o] && !out[o]) { out[o] = 1; st.push(o); } } for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const o = y * W + x; if (!m[o] && !out[o]) { out[o] = 1; st.push(o); } }
      while (st.length) { const o = st.pop(), x = o % W, y = (o / W) | 0; if (x > 0 && !m[o - 1] && !out[o - 1]) { out[o - 1] = 1; st.push(o - 1); } if (x < W - 1 && !m[o + 1] && !out[o + 1]) { out[o + 1] = 1; st.push(o + 1); } if (y > 0 && !m[o - W] && !out[o - W]) { out[o - W] = 1; st.push(o - W); } if (y < H - 1 && !m[o + W] && !out[o + W]) { out[o + W] = 1; st.push(o + W); } }
      const f = new Uint8Array(N); for (let i = 0; i < N; i++) f[i] = out[i] ? 0 : 1; return f; };
    const trace = mask => { let s = -1; for (let i = 0; i < N; i++) if (mask[i]) { s = i; break; } const sx = s % W, sy = (s / W) | 0; const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x];
      let x = sx, y = sy, d = 0; const pts = []; let guard = 0;
      do { pts.push([x, y]); const AL = d === 0 ? [x, y - 1] : d === 1 ? [x, y] : d === 2 ? [x - 1, y] : [x - 1, y - 1], AR = d === 0 ? [x, y] : d === 1 ? [x - 1, y] : d === 2 ? [x - 1, y - 1] : [x, y - 1];
        if (inside(AL[0], AL[1])) d = (d + 3) % 4; else if (!inside(AR[0], AR[1])) d = (d + 1) % 4;
        x += [1, 0, -1, 0][d]; y += [0, 1, 0, -1][d]; } while ((x !== sx || y !== sy) && ++guard < 800000);
      const dpf = (p, tol) => { const keep = new Uint8Array(p.length); keep[0] = keep[p.length - 1] = 1; const st = [[0, p.length - 1]]; while (st.length) { const [a, b] = st.pop(); let md = 0, mi = -1; const ax = p[a][0], ay = p[a][1], dx = p[b][0] - ax, dy = p[b][1] - ay, L = Math.hypot(dx, dy) || 1e-9; for (let i = a + 1; i < b; i++) { const dd = Math.abs((p[i][0] - ax) * dy - (p[i][1] - ay) * dx) / L; if (dd > md) { md = dd; mi = i; } } if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); } } return p.filter((_, i) => keep[i]); };
      let far = 0, fd = 0; for (let i = 0; i < pts.length; i++) { const dd = (pts[i][0] - sx) ** 2 + (pts[i][1] - sy) ** 2; if (dd > fd) { fd = dd; far = i; } }
      const a = dpf(pts.slice(0, far + 1), 1.2), b = dpf(pts.slice(far).concat([pts[0]]), 1.2); const out = a.slice(0, -1).concat(b.slice(0, -1));
      return out.flatMap(q => [+(q[0] / H).toFixed(4), +(q[1] / H).toFixed(4)]); };
    const onEdge = o => { const x = o % W, y = (o / W) | 0; return x === 0 || y === 0 || x === W - 1 || y === H - 1; };
    const MAXPTS = 440; // flat coordinate count, i.e. 220 corners
    const DBG = []; let parts = [], model = 'override'; const stickerMask = new Uint8Array(N); let stickerRects = null;
    if (!OV) {
      // ---------- background: strips only when every strip is pure on its own ----------
      const bands = axis => { const n = axis ? W : H, m = axis ? H : W, modes = []; for (let i = 0; i < n; i++) { const c = new Uint16Array(16); for (let j = 0; j < m; j++) c[axis ? P[j * W + i] : P[i * W + j]]++; let b = 0; for (let k = 1; k < 16; k++) if (c[k] > c[b]) b = k; modes.push(b); }
        let runs = []; for (let i = 0; i < n; i++) { if (runs.length && runs[runs.length - 1].c === modes[i]) runs[runs.length - 1].e = i + 1; else runs.push({ c: modes[i], s: i, e: i + 1 }); }
        let ch = true; while (ch && runs.length > 1) { ch = false; for (let i = 0; i < runs.length; i++) if (runs[i].e - runs[i].s < n * 0.03) { const a = runs[i - 1], b = runs[i + 1]; if (a && (!b || a.e - a.s >= b.e - b.s)) a.e = runs[i].e; else b.s = runs[i].s; runs.splice(i, 1); ch = true; break; }
          for (let i = 1; i < runs.length; i++) if (runs[i].c === runs[i - 1].c) { runs[i - 1].e = runs[i].e; runs.splice(i, 1); i--; } }
        let ok = 0, tot = 0, minPure = 1; const Mo = new Uint8Array(N);
        for (const r of runs) { let rok = 0, rtot = 0; for (let i = r.s; i < r.e; i++) for (let j = 0; j < m; j++) { const o = axis ? j * W + i : i * W + j; Mo[o] = r.c; if (P[o] !== 15) { rtot++; if (P[o] === r.c) rok++; } } r.pure = rtot ? rok / rtot : 0; ok += rok; tot += rtot; minPure = Math.min(minPure, r.pure); }
        return { runs, score: ok / tot, minPure, Mo, axis }; };
      const bh = bands(0), bv = bands(1); let bm = null;
      for (const b of [bh, bv]) if (b.runs.length >= 2 && b.runs.length <= 13 && b.score >= 0.85 && b.minPure >= 0.92 && !b.runs.some(r => r.c === 15) && (!bm || b.score > bm.score)) bm = b;
      let transp = 0; for (let i = 0; i < N; i++) if (P[i] === 15) transp++;
      // decompose(): peel shapes off a background, layer by layer; returns paper parts and the sticker mask
      // anti-alias fringe: pixels sitting between the background and a third colour (dark red between Albania's red and the black eagle)
      // (only when the pixel's colour lies between the two in colour space: a dark outline around a yellow sun on white is real detail)
      const dl = (i, j) => i > 11 || j > 11 ? 999 : Math.hypot(PL[i][0] - PL[j][0], PL[i][1] - PL[j][1], PL[i][2] - PL[j][2]);
      const fringe = (q, Mloc) => { let tr = 0; for (const o of q) { const x = o % W, y = (o / W) | 0, pc = P[o]; let base = -1, third = -1; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx, c = P[n]; if (c === Mloc[n]) base = c; else if (c !== pc) third = c; } if (base >= 0 && third >= 0 && dl(base, pc) + dl(pc, third) <= 1.2 * dl(base, third)) tr++; } return tr >= q.length * 0.6; };
      const decompose = (Mo, bg) => {
      const SM = new Uint8Array(N);
      const nodes = [];
      const peel = (region, Mloc, depth, parent) => {
        const R = new Uint8Array(N); for (let i = 0; i < N; i++) R[i] = region[i] && P[i] !== Mloc[i] ? 1 : 0;
        const E = new Uint8Array(N); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const o = y * W + x; E[o] = R[o] && R[o - 1] && R[o + 1] && R[o - W] && R[o + W] ? 1 : 0; }
        const O = new Uint8Array(N); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const o = y * W + x; O[o] = R[o] && (E[o] || E[o - 1] || E[o + 1] || E[o - W] || E[o + W]) ? 1 : 0; }
        for (let i = 0; i < N; i++) if (R[i] && !O[i] && onEdge(i)) O[i] = 1; // keep flag-edge pixels
        { // thin line art removed by the opening (script, outlines of an emblem) is detail for the sticker; straight 1-2 px fringes along a seam are not
          const T = new Uint8Array(N); for (let i = 0; i < N; i++) T[i] = R[i] && !O[i] ? 1 : 0; const sn = new Uint8Array(N);
          for (let s0 = 0; s0 < N; s0++) if (T[s0] && !sn[s0]) { const q = [s0]; sn[s0] = 1; let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let h = 0; h < q.length; h++) { const o = q[h], x = o % W, y = (o / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx; if (T[n] && !sn[n]) { sn[n] = 1; q.push(n); } } }
            if (q.length < 12 || x1 - x0 <= 2 || y1 - y0 <= 2) continue;
            if (!fringe(q, Mloc)) for (const o of q) SM[o] = 1; }
        }
        const seen = new Uint8Array(N), comps = [];
        for (let s = 0; s < N; s++) if (O[s] && !seen[s]) { const q = [s]; seen[s] = 1; let edge = false; for (let h = 0; h < q.length; h++) { const o = q[h], x = o % W, y = (o / W) | 0; if (!edge && onEdge(o)) edge = true; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx; if (O[n] && !seen[n]) { seen[n] = 1; q.push(n); } } }
          // a shape clipped by the flag's edge is kept however small the visible piece is
          if (q.length >= N * 0.0008 || (edge && q.length >= Math.max(10, N * 0.00008))) comps.push(q); else if (q.length >= 4 && !fringe(q, Mloc)) for (const o of q) SM[o] = 1; }
        const made = [];
        for (const q of comps) {
          const cm = new Uint8Array(N); for (const o of q) cm[o] = 1; const filled = fillHoles(cm);
          let fa = 0; const hist = new Uint32Array(16), edge = new Uint32Array(16);
          let bx0 = W, by0 = H, bx1 = -1, by1 = -1; for (let i = 0; i < N; i++) if (filled[i]) { fa++; hist[P[i]]++; const x = i % W, y = (i / W) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
          for (const o of q) { const x = o % W, y = (o / W) | 0; if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || !filled[o - 1] || !filled[o + 1] || !filled[o - W] || !filled[o + W]) edge[P[o]]++; }
          let oc = 0; for (let k = 1; k < 15; k++) if (edge[k] > edge[oc]) oc = k;
          const poly = trace(filled), maxp = fa >= N * 0.02 ? MAXPTS * 2 : MAXPTS;
          const node = { id: nodes.length, c: oc, filled, poly, area: fa, bb: [bx0, by0, bx1, by1], parent, depth, rec: false, dead: false };
          DBG.push([depth, oc, fa, hist[oc], poly.length, q.length]);
          // a large mixed region (several colour fields meeting, e.g. rays from one corner) is laid as an under-sheet of its outline colour, or failing that its main colour, and peeled further
          let mc = 0; for (let k = 1; k < 15; k++) if (hist[k] > hist[mc]) mc = k;
          if (fa >= N * 0.02 && hist[oc] < fa * 0.3 && hist[oc] < fa * 0.1 && hist[mc] >= fa * 0.2) { node.c = oc = mc; }
          if ((hist[oc] >= fa * (fa >= N * 0.02 ? 0.1 : 0.3) || Mloc[q[0]] === 15) && depth < 4 && poly.length <= maxp && fa >= N * 0.004) { node.rec = true; nodes.push(node); made.push(node); }
          else if (hist[oc] >= fa * 0.9 && poly.length <= maxp) { nodes.push(node); made.push(node); }
          else for (let i = 0; i < N; i++) if (filled[i]) SM[i] = 1;
        }
        for (const s of made) if (s.rec) peel(s.filled, new Uint8Array(N).fill(s.c), depth + 1, s.id);
      };
      const whole = new Uint8Array(N); for (let i = 0; i < N; i++) whole[i] = P[i] !== 15 || Mo[i] !== 15 ? 1 : 0;
      peel(whole, Mo, 0, -1);
      const kill = nd => { if (nd.dead) return; nd.dead = true; for (let i = 0; i < N; i++) if (nd.filled[i]) SM[i] = 1; for (const ch of nodes) if (ch.parent === nd.id) kill(ch); };
      const hasSticker = () => { for (let i = 0; i < N; i++) if (SM[i]) return true; return false; };
      // emblem fragments next to the sticker join it, so a crest stays one clean sticker
      for (let it = 0; it < 6 && hasSticker(); it++) {
        const core = morph(close(SM, Math.ceil(H * 0.04)), Math.ceil(H * 0.012), true); let changed = false;
        const boxes = [], seen = new Uint8Array(N); // bounding boxes of the sticker blobs
        for (let s0 = 0; s0 < N; s0++) if (core[s0] && !seen[s0]) { const q = [s0]; seen[s0] = 1; const b = [W, H, -1, -1]; for (let h = 0; h < q.length; h++) { const o = q[h], x = o % W, y = (o / W) | 0; if (x < b[0]) b[0] = x; if (x > b[2]) b[2] = x; if (y < b[1]) b[1] = y; if (y > b[3]) b[3] = y; for (const n of [x > 0 ? o - 1 : -1, x < W - 1 ? o + 1 : -1, y > 0 ? o - W : -1, y < H - 1 ? o + W : -1]) if (n >= 0 && core[n] && !seen[n]) { seen[n] = 1; q.push(n); } } boxes.push(b); }
        const m3 = H * 0.03, m2 = H * 0.02, inBox = bb => boxes.some(b => bb[0] >= b[0] - m3 && bb[1] >= b[1] - m3 && bb[2] <= b[2] + m3 && bb[3] <= b[3] + m3), hits = bb => boxes.some(b => bb[0] <= b[2] + m2 && bb[2] >= b[0] - m2 && bb[1] <= b[3] + m2 && bb[3] >= b[1] - m2);
        for (const nd of nodes) { if (nd.dead || nd.area >= N * 0.03) continue; let ov = 0; for (let i = 0; i < N; i++) if (nd.filled[i] && core[i]) ov++; if (ov >= nd.area * 0.3 || inBox(nd.bb) || (nd.area < N * 0.006 && hits(nd.bb))) { kill(nd); changed = true; } }
        if (!changed) break;
      }
      { // a small one-colour blob far from any other detail (Sri Lanka's corner leaves) is paper, not sticker
        const seen = new Uint8Array(N), comps = [];
        for (let s0 = 0; s0 < N; s0++) if (SM[s0] && !seen[s0]) { const q = [s0]; seen[s0] = 1; const b = [W, H, -1, -1]; for (let h = 0; h < q.length; h++) { const o = q[h], x = o % W, y = (o / W) | 0; if (x < b[0]) b[0] = x; if (x > b[2]) b[2] = x; if (y < b[1]) b[1] = y; if (y > b[3]) b[3] = y; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx; if (SM[n] && !seen[n]) { seen[n] = 1; q.push(n); } } } comps.push({ q, b }); }
        const gap = (a, b) => Math.max(0, a[0] - b[2], b[0] - a[2], a[1] - b[3], b[1] - a[3]);
        for (const cpt of comps) { if (cpt.q.length < 40) continue; if (comps.some(o => o !== cpt && o.q.length >= 4 && gap(o.b, cpt.b) < H * 0.08)) continue;
          const hist = new Uint32Array(16); for (const o of cpt.q) hist[P[o]]++; let mc = 0; for (let k = 1; k < 15; k++) if (hist[k] > hist[mc]) mc = k; if (hist[mc] < cpt.q.length * 0.9) continue;
          const cm = new Uint8Array(N); for (const o of cpt.q) if (P[o] === mc) cm[o] = 1; const filled = fillHoles(cm); const poly = trace(filled); if (poly.length > 120) continue;
          let fa = 0; for (let i = 0; i < N; i++) if (filled[i]) fa++; for (const o of cpt.q) SM[o] = 0;
          nodes.push({ id: nodes.length, c: mc, filled, poly, area: fa, bb: cpt.b, parent: -2, depth: 9, rec: false, dead: false }); }
      }
      // parts: same-colour siblings become one group part when there are many of them
      // a sibling much larger than the rest (China's big star, Georgia's big cross) stays its own part
      const units = (forceGroup, noGroup, smallOdd) => { const out = [], used = new Set(); const live = nodes.filter(n => !n.dead);
        for (const n of live) { if (used.has(n.id)) continue; let sib = live.filter(m => m.parent === n.parent && m.c === n.c && !used.has(m.id));
          const ar = sib.map(m => m.area).sort((a, b) => a - b), med = ar[(ar.length - 1) >> 1], odd = m => (m.area > 3 * med && m.area >= N * 0.01) || (smallOdd && m.area < med / 2.5);
          if (sib.length > 1 && odd(n)) { used.add(n.id); out.push([n]); continue; } sib = sib.filter(m => !odd(m));
          if (smallOdd && sib.length > 1) { const te = m => m.bb[0] === 0 || m.bb[1] === 0 || m.bb[2] === W - 1 || m.bb[3] === H - 1, a = sib.filter(te), b = sib.filter(m => !te(m)); if (a.length && b.length) sib = a.includes(n) ? a : b; } // rays clipped by the edge vs the disc
          if (!noGroup && (sib.length > 3 || (forceGroup && sib.length > 1))) { sib.forEach(m => used.add(m.id)); out.push(sib); } else { used.add(n.id); out.push([n]); } }
        return out; };
      { // script and specks are sticker detail: a run of irregular same-colour letters (Iraq), or a loose piece too small to handle
        const te = m => m.bb[0] === 0 || m.bb[1] === 0 || m.bb[2] === W - 1 || m.bb[3] === H - 1;
        for (const u of units(false)) { const tot = u.reduce((t, m) => t + m.area, 0);
          if (tot < N * 0.0015 && !u.some(te)) { u.forEach(kill); continue; }
          const live = nodes.filter(m => !m.dead && m.parent === u[0].parent && m.c === u[0].c); if (live.length < 3 || live.some(m => m.area >= N * 0.015)) continue;
          const corners = live.reduce((t, m) => t + m.poly.length / 2, 0) / live.length; const bb = [Math.min(...live.map(m => m.bb[0])), Math.min(...live.map(m => m.bb[1])), Math.max(...live.map(m => m.bb[2])), Math.max(...live.map(m => m.bb[3]))];
          if (corners >= 14 && (bb[2] - bb[0]) * (bb[3] - bb[1]) < N * 0.12) live.forEach(kill); }
      }
      let U = units(false); const count = () => bg.length + U.length + (hasSticker() ? 1 : 0);
      if (count() < 3 && U.some(u => u.length > 1)) { const V = units(false, true); if (bg.length + V.length + (hasSticker() ? 1 : 0) <= 9) U = V; else U = units(false, false, true); } // fewer than three parts: the identical pieces are laid one by one
      if (count() > 9) U = units(true);
      while (count() > 9) { // keep the large simple shapes; the smallest pieces become sticker detail
        let best = null, ba = 1e12; for (const u of U) { const a = u.reduce((s, n) => s + n.area, 0); if (a < ba) { ba = a; best = u; } }
        best.forEach(kill); U = units(true);
      }
      const ps = bg.concat(U.map(u => u.length > 1 ? { k: 'group', polys: u.map(n => ({ c: n.c, p: n.poly })) } : { k: 'shape', polys: [{ c: u[0].c, p: u[0].poly }] }));
      let sa = 0; const cs = hasSticker() ? close(SM, Math.ceil(H * 0.02)) : SM; for (let i = 0; i < N; i++) if (cs[i]) sa++;
      // does a top-level shape touch background of its own colour (a seam inside one colour)?
      let touch = 0; for (const n of nodes) { if (n.dead || n.parent !== -1) continue; for (let i = 0; i < N; i++) { if (!n.filled[i]) continue; const x = i % W, y = (i / W) | 0; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && !n.filled[j] && Mo[j] === n.c && P[j] === n.c) touch++; } }
      return { parts: ps, SM, stkArea: sa / N, touch };
      };
      let best = null;
      if (bm) { const bg = []; const ps = bm.runs.map(r => ({ c: r.c, p: bm.axis ? rect(r.s, 0, r.e, H) : rect(0, r.s, W, r.e) }));
        if (ps.length <= 5) for (const q of ps) bg.push({ k: 'band', polys: [q] }); else bg.push({ k: 'bands', polys: ps });
        best = decompose(bm.Mo, bg); model = (bm.axis ? 'v' : 'h') + bm.runs.length;
        if (best.touch > H * 0.05) { best = null; bm = null; } } // shapes interlock with the strips (Bahrain's teeth): use one sheet instead
      if (best) {}
      else if (transp > N * 0.02) { best = decompose(new Uint8Array(N).fill(15), []); model = 'cutout'; }
      else { // one background sheet: the dominant colour, unless another large colour (or the colour along the border) leaves far less to the sticker
        const c = new Uint32Array(16), rim = new Uint32Array(16); for (let i = 0; i < N; i++) { c[P[i]]++; if (onEdge(i)) rim[P[i]]++; } let dom = 0; for (let k = 1; k < 15; k++) if (c[k] > c[dom]) dom = k;
        let rimN = 0; for (let k = 0; k < 15; k++) rimN += rim[k];
        const cand = [dom]; for (let k = 0; k < 15; k++) if (k !== dom && (c[k] >= N * 0.15 || rim[k] >= rimN * 0.3)) cand.push(k);
        for (const k of cand) { const r = decompose(new Uint8Array(N).fill(k), [{ k: 'sheet', polys: [{ c: k, p: rect(0, 0, W, H) }] }]); r.score = r.stkArea + (k === dom ? 0 : 0.03); if (!best || r.score < best.score) { best = r; model = 'sheet' + (k === dom ? '' : ':' + k); } }
      }
      parts = best.parts; stickerMask.set(best.SM);
      { // catch-all: any one-colour region of 20+ pixels that the paper parts do not show goes to the sticker
        const rc = document.createElement('canvas'); rc.width = W; rc.height = H; const rg = rc.getContext('2d', { willReadFrequently: true });
        for (const p of parts) for (const q of p.polys) { rg.fillStyle = PAL[q.c]; rg.beginPath(); for (let i = 0; i < q.p.length; i += 2) rg.lineTo(q.p[i] * H, q.p[i + 1] * H); rg.closePath(); rg.fill(); }
        const rd2 = rg.getImageData(0, 0, W, H).data; const Bc = new Uint8Array(N); for (let i = 0; i < N; i++) Bc[i] = rd2[i * 4 + 3] < 128 ? 15 : near(rd2[i * 4], rd2[i * 4 + 1], rd2[i * 4 + 2]);
        const sn = new Uint8Array(N);
        for (let s0 = 0; s0 < N; s0++) { if (sn[s0] || P[s0] === 15 || P[s0] === Bc[s0] || stickerMask[s0]) continue; const c = P[s0], q = [s0]; sn[s0] = 1;
          for (let h = 0; h < q.length; h++) { const o = q[h], x = o % W, y = (o / W) | 0; for (const n of [x > 0 ? o - 1 : -1, x < W - 1 ? o + 1 : -1, y > 0 ? o - W : -1, y < H - 1 ? o + W : -1]) if (n >= 0 && !sn[n] && P[n] === c && Bc[n] !== c && !stickerMask[n]) { sn[n] = 1; q.push(n); } }
          if (q.length < 20 || fringe(q, Bc)) continue; const inq = new Set(q); let core = 0; for (const o of q) if (inq.has(o - 1) && inq.has(o + 1) && inq.has(o - W) && inq.has(o + W)) core++;
          if (core >= 4) for (const o of q) stickerMask[o] = 1; } // a sliver along a traced edge has no inside; a real missing piece does
      }
    } else {
      parts = OV.parts.filter(p => p.polys).map(p => ({ k: p.k, polys: p.polys.map(q => ({ c: q.c, p: q.p.slice() })) }));
      stickerRects = OV.stickers || [];
      const oc = document.createElement('canvas'); oc.width = W; oc.height = H; const og = oc.getContext('2d', { willReadFrequently: true });
      for (const p of parts) for (const q of p.polys) { og.fillStyle = PAL[q.c]; og.beginPath(); for (let i = 0; i < q.p.length; i += 2) og.lineTo(q.p[i] * H, q.p[i + 1] * H); og.closePath(); og.fill(); }
      const od = og.getImageData(0, 0, W, H).data;
      for (const r of stickerRects) for (let y = Math.max(0, Math.floor(r[1] * H)); y < Math.min(H, Math.ceil((r[1] + r[3]) * H)); y++) for (let x = Math.max(0, Math.floor(r[0] * H)); x < Math.min(W, Math.ceil((r[0] + r[2]) * H)); x++) { const o = y * W + x; if (P[o] !== 15 && (od[o * 4 + 3] < 128 || near(od[o * 4], od[o * 4 + 1], od[o * 4 + 2]) !== P[o])) stickerMask[o] = 1; }
    }
    // ---------- sticker clusters ----------
    let clusters = [];
    const anyStk = stickerMask.some(v => v);
    if (anyStk) {
      const cm = morph(close(stickerMask, Math.ceil(H * 0.02)), 2, true);
      const seen = new Uint8Array(N); const comps = [];
      for (let s = 0; s < N; s++) if (cm[s] && !seen[s]) { const q = [s]; seen[s] = 1; let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let h = 0; h < q.length; h++) { const o = q[h], x = o % W, y = (o / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; for (const n of [x > 0 ? o - 1 : -1, x < W - 1 ? o + 1 : -1, y > 0 ? o - W : -1, y < H - 1 ? o + W : -1]) if (n >= 0 && cm[n] && !seen[n]) { seen[n] = 1; q.push(n); } } comps.push({ px: q, b: [x0, y0, x1, y1] }); }
      // merge components into at most three clusters (by bounding-box growth); specks of a few pixels are anti-alias noise, not detail
      let cl = comps.filter(c => c.px.length >= N * 0.00015).map(c => ({ px: c.px, b: c.b.slice() }));
      const ar = b => (b[2] - b[0] + 1) * (b[3] - b[1] + 1), un = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
      const merge1 = list => { let bi = 0, bj = 1, bc = 1e18; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const c = ar(un(list[i].b, list[j].b)) - ar(list[i].b) - ar(list[j].b); if (c < bc) { bc = c; bi = i; bj = j; } } const out = list.slice(); out[bi] = { px: list[bi].px.concat(list[bj].px), b: un(list[bi].b, list[bj].b) }; out.splice(bj, 1); return out; };
      while (cl.length > 3) cl = merge1(cl);
      // fewer stickers unless a split saves a lot of sticker area (each extra sticker costs 4% of the flag) and every piece is real detail
      const cost = list => list.reduce((t, c) => t + ar(c.b), 0) + (list.length - 1) * N * 0.04;
      while (cl.length > 1 && (cost(merge1(cl)) <= cost(cl) || cl.some(c => c.px.length < N * 0.002) || parts.length + cl.length > 9)) cl = merge1(cl);
      clusters = cl;
    }
    // ---------- bake stickers from the reference at KS px per flag height ----------
    const stkCover = new Uint8Array(N); // analysis pixels covered by an opaque sticker pixel
    const field = new Map(); { const cnt = new Map(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = ((y * SS + 1) * W * SS + x * SS + 1) * 4; if (big[o + 3] < 250) continue; const k = P[y * W + x] * 16777216 + (big[o] << 16 | big[o + 1] << 8 | big[o + 2]); cnt.set(k, (cnt.get(k) || 0) + 1); }
      for (const [k, n] of cnt) { const c = Math.floor(k / 16777216), rgb = k % 16777216; if (!field.has(c) || n > field.get(c).n) field.set(c, { n, r: rgb >> 16, g: (rgb >> 8) & 255, b: rgb & 255 }); } }
    const K = KS / H;
    for (const c of clusters) {
      const m = new Uint8Array(N); for (const o of c.px) m[o] = 1;
      const [x0, y0, x1, y1] = c.b; const w = Math.round((x1 - x0 + 1) * K), h = Math.round((y1 - y0 + 1) * K);
      const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const g = c2.getContext('2d', { willReadFrequently: true }); g.drawImage(img, -x0 * K, -y0 * K, W * K, H * K); const rd = g.getImageData(0, 0, w, h);
      const c3 = document.createElement('canvas'); c3.width = w; c3.height = h; const g3 = c3.getContext('2d', { willReadFrequently: true });
      for (const p of parts) if (p.polys) for (const q of p.polys) { const v = q.c * 20; g3.fillStyle = `rgb(${v},${v},${v})`; g3.beginPath(); for (let i = 0; i < q.p.length; i += 2) g3.lineTo((q.p[i] * H - x0) * K, (q.p[i + 1] * H - y0) * K); g3.closePath(); g3.fill(); }
      const ud = g3.getImageData(0, 0, w, h).data; const under = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) under[i] = ud[i * 4 + 3] < 128 ? 15 : Math.round(ud[i * 4] / 20);
      const cls = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) cls[i] = rd.data[i * 4 + 3] < 128 ? 15 : near(rd.data[i * 4], rd.data[i * 4 + 1], rd.data[i * 4 + 2]);
      // one clean piece: the blob around the detail, outline smoothed from the analysis mask; inside it, background that matches the paper below is painted in that paper
      const mc = document.createElement('canvas'); mc.width = x1 - x0 + 1; mc.height = y1 - y0 + 1; const mg = mc.getContext('2d'); const md = mg.createImageData(mc.width, mc.height);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m[y * W + x]) md.data[((y - y0) * mc.width + x - x0) * 4 + 3] = 255;
      mg.putImageData(md, 0, 0); const sm = document.createElement('canvas'); sm.width = w; sm.height = h; const smg = sm.getContext('2d', { willReadFrequently: true }); smg.imageSmoothingEnabled = true; smg.imageSmoothingQuality = 'high'; smg.drawImage(mc, 0, 0, w, h); const sa = smg.getImageData(0, 0, w, h).data;
      const al = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) al[i] = Math.max(0, Math.min(255, Math.round((sa[i * 4 + 3] / 255 - 0.35) / 0.3 * 255)));
      let bx0 = w, by0 = h, bx1 = -1, by1 = -1; for (let i = 0; i < w * h; i++) if (al[i]) { const x = i % w, y = (i / w) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
      if (bx1 < 0) continue;
      const ow = bx1 - bx0 + 1, oh = by1 - by0 + 1; const oc = document.createElement('canvas'); oc.width = ow; oc.height = oh; const og = oc.getContext('2d'); const id = og.createImageData(ow, oh);
      const PR = PAL.map(hh => [parseInt(hh.slice(1, 3), 16), parseInt(hh.slice(3, 5), 16), parseInt(hh.slice(5, 7), 16)]);
      for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) { const i = (y + by0) * w + x + bx0; if (!al[i] || rd.data[i * 4 + 3] < 8) continue; const o = (y * ow + x) * 4; const u = under[i];
        const fc = field.get(u); if (u !== 15 && cls[i] === u && fc && Math.abs(rd.data[i * 4] - fc.r) + Math.abs(rd.data[i * 4 + 1] - fc.g) + Math.abs(rd.data[i * 4 + 2] - fc.b) < 40) { id.data[o] = PR[u][0]; id.data[o + 1] = PR[u][1]; id.data[o + 2] = PR[u][2]; } else { id.data[o] = rd.data[i * 4]; id.data[o + 1] = rd.data[i * 4 + 1]; id.data[o + 2] = rd.data[i * 4 + 2]; }
        id.data[o + 3] = Math.round(al[i] * rd.data[i * 4 + 3] / 255); if (al[i] > 24) stkCover[(y0 + (((y + by0) / K) | 0)) * W + x0 + (((x + bx0) / K) | 0)] = 1; }
      og.putImageData(id, 0, 0);
      parts.push({ k: 'sticker', x: +((x0 + bx0 / K) / H).toFixed(4), y: +((y0 + by0 / K) / H).toFixed(4), w: +(ow / K / H).toFixed(4), h: +(oh / K / H).toFixed(4), img: oc.toDataURL('image/png') });
    }
    // ---------- verify: redraw the paper parts, compare with the reference outside the sticker ----------
    const vc = document.createElement('canvas'); vc.width = W; vc.height = H; const vg = vc.getContext('2d', { willReadFrequently: true });
    for (const p of parts) if (p.polys) for (const q of p.polys) { vg.fillStyle = PAL[q.c]; vg.beginPath(); for (let i = 0; i < q.p.length; i += 2) vg.lineTo(q.p[i] * H, q.p[i + 1] * H); vg.closePath(); vg.fill(); }
    const vd = vg.getImageData(0, 0, W, H).data; let bad = 0, tot = 0;
    for (let i = 0; i < N; i++) { if (stkCover[i] || P[i] === 15) continue; tot++; if (vd[i * 4 + 3] < 128 || near(vd[i * 4], vd[i * 4 + 1], vd[i * 4 + 2]) !== P[i]) bad++; }
    let grid = ''; for (let j = 0; j < 8; j++) for (let i = 0; i < 12; i++) grid += P[Math.min(H - 1, Math.floor((j + 0.5) * H / 8)) * W + Math.min(W - 1, Math.floor((i + 0.5) * W / 12))].toString(16);
    const cw = new Uint32Array(16); for (let i = 0; i < N; i++) cw[P[i]]++; const cols = []; for (let k = 0; k < 15; k++) if (cw[k] > N * 0.02) cols.push([k, +(cw[k] / N).toFixed(3)]);
    const stk = parts.filter(p => p.k === 'sticker').reduce((s, p) => s + p.w * p.h, 0) / asp;
    return { a: +asp.toFixed(4), parts, grid, cols, miss: +(bad / Math.max(1, tot)).toFixed(4), model, DBG, src: OV ? 'override' : 'auto', stk: +stk.toFixed(3) };
  })();
}

async function buildFlags() {
  await fetchFlags();
  const require = createRequire(path.join(PWDIR, 'x.js')); const { chromium } = require('playwright-core');
  const br = await chromium.launch({ channel: 'chrome' }); const pg = await br.newPage(); await pg.goto('about:blank');
  const PAL = JSON.parse(fs.readFileSync(path.join(here, 'palette.json'), 'utf8'));
  const ovPath = path.join(here, 'flag-overrides.json'); const OVS = fs.existsSync(ovPath) ? JSON.parse(fs.readFileSync(ovPath, 'utf8')) : {};
  // FLAGS_ONLY=JP,CH limits the run; FLAGS_OUT=<file> writes elsewhere (for checking); FLAGS_NO_OVERRIDES=1 shows the automatic result
  const only = process.env.FLAGS_ONLY ? process.env.FLAGS_ONLY.split(',') : null, outFile = process.env.FLAGS_OUT || path.join(OUT, 'flags.js');
  const flags = {}, rep = [];
  for (const u of UN) { const f = path.join(REF, u.toLowerCase() + '.svg'); if (!fs.existsSync(f) || (only && !only.includes(u))) continue;
    const ov = !process.env.FLAGS_NO_OVERRIDES && OVS[u] && OVS[u].parts ? OVS[u] : null;
    try { const r = await pg.evaluate(`(${pageAnalyse.toString()})(${JSON.stringify(fs.readFileSync(f, 'utf8'))}, ${JSON.stringify(PAL)}, ${JSON.stringify(ov)})`);
      const rm = !process.env.FLAGS_NO_OVERRIDES && OVS[u] && OVS[u].remap; // owner-approved paper remaps, e.g. {"9":10} = blue -> navy
      if (rm) for (const p of r.parts) { if (rm[p.c] !== undefined) p.c = rm[p.c]; if (p.polys) for (const q of p.polys) if (rm[q.c] !== undefined) q.c = rm[q.c]; }
      rep.push({ u, src: r.src, model: r.model, n: r.parts.length, kinds: r.parts.map(p => p.k[0] + (p.polys ? p.polys.length : '')).join(','), stk: r.stk, miss: r.miss });
      if (process.env.FLAGS_DBG) console.log(u, JSON.stringify(r.DBG)); delete r.DBG; delete r.model; delete r.src; delete r.stk; flags[u] = r; }
    catch (e) { console.log('flag failed', u, String(e).slice(0, 200)); } }
  await br.close();
  rep.sort((a, b) => b.miss - a.miss); console.log('worst mismatch:', rep.slice(0, 14).map(r => `${r.u}:${r.miss}(${r.kinds})`).join(' '));
  console.log('flags', Object.keys(flags).length, 'mean miss', (rep.reduce((s, r) => s + r.miss, 0) / rep.length).toFixed(4), 'under 3 parts', rep.filter(r => r.n < 3).length, 'sticker > 40%', rep.filter(r => r.stk > 0.4).length, 'overrides', rep.filter(r => r.src === 'override').length);
  fs.writeFileSync(process.env.FLAGS_OUT ? outFile.replace(/\.js$/, '') + '-report.json' : path.join(OUT, 'flags-report.json'), JSON.stringify(rep, null, 0));
  fs.writeFileSync(outFile, 'window.PAPERS=' + JSON.stringify(PAL) + ';window.FLAGS=' + JSON.stringify(flags) + ';');
  console.log(path.basename(outFile), (fs.statSync(outFile).size / 1e6).toFixed(2), 'MB');
}

function pipRing(x, y, r) {
  let inside = false;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = r[i * 2], yi = r[i * 2 + 1], xj = r[j * 2], yj = r[j * 2 + 1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function pipPolys(x, y, polys) {
  let inside = false;
  for (const r of polys) if (pipRing(x, y, r)) inside = !inside;
  return inside;
}

function snapInside(x, y, polys, fallbackCenter) {
  let bestD2 = Infinity, bx = x, by = y, segDx = 0, segDy = 0;
  for (const r of polys) {
    const n = r.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ax = r[j * 2], ay = r[j * 2 + 1], cx = r[i * 2], cy = r[i * 2 + 1];
      const dx = cx - ax, dy = cy - ay, l2 = dx * dx + dy * dy;
      let t = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const px = ax + t * dx, py = ay + t * dy;
      const d2 = (x - px) * (x - px) + (y - py) * (y - py);
      if (d2 < bestD2) { bestD2 = d2; bx = px; by = py; segDx = dx; segDy = dy; }
    }
  }
  const dist = Math.sqrt(bestD2);
  if (dist > 2) return { inside: false, dist: +dist.toFixed(3), snapped: false, step: null, x: +x.toFixed(2), y: +y.toFixed(2) };
  const dirs = [];
  if (dist > 1e-6) dirs.push([(bx - x) / dist, (by - y) / dist]);
  const sl = Math.hypot(segDx, segDy);
  if (sl > 1e-9) dirs.push([-segDy / sl, segDx / sl], [segDy / sl, -segDx / sl]);
  for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; dirs.push([Math.cos(a), Math.sin(a)]); }
  for (const step of [0.3, 0.15, 0.08, 0.03, 0.01, 0.002]) {
    for (const [ux, uy] of dirs) {
      const tx = +(bx + ux * step).toFixed(2), ty = +(by + uy * step).toFixed(2);
      if (pipPolys(tx, ty, polys)) return { inside: true, dist: +dist.toFixed(3), snapped: true, step, x: tx, y: ty };
    }
  }
  if (fallbackCenter && pipPolys(fallbackCenter[0], fallbackCenter[1], polys)) {
    return { inside: true, dist: +dist.toFixed(3), snapped: true, step: 'center', x: +fallbackCenter[0].toFixed(2), y: +fallbackCenter[1].toFixed(2) };
  }
  return { inside: false, dist: +dist.toFixed(3), snapped: false, step: null, x: +x.toFixed(2), y: +y.toFixed(2) };
}

async function buildCapitals() {
  const geoRaw = fs.readFileSync(path.join(OUT, 'geo.js'), 'utf8');
  const geo = JSON.parse(geoRaw.slice(geoRaw.indexOf('=') + 1, -1));
  const overridesList = JSON.parse(fs.readFileSync(path.join(here, 'capital-overrides.json'), 'utf8'));
  const overrides = Object.fromEntries(overridesList.map(o => [o.id, o]));
  const ppSrc = NE_PP || (WHAT === 'capitals' && NE && NE !== '-' ? NE : null);
  let pp;
  if (ppSrc && fs.existsSync(ppSrc)) {
    pp = JSON.parse(fs.readFileSync(ppSrc, 'utf8'));
  } else {
    const res = await fetch(NE_PP_URL);
    if (!res.ok) throw new Error('Failed to fetch Natural Earth populated places: ' + res.status);
    pp = await res.json();
  }
  const allByIso = new Map(), capByIso = new Map();
  for (const f of pp.features) {
    const p = f.properties || {};
    const iso = p.ISO_A2 && p.ISO_A2 !== '-99' ? p.ISO_A2 : null;
    if (!iso) continue;
    if (!allByIso.has(iso)) allByIso.set(iso, []);
    allByIso.get(iso).push(f);
    const fc = String(p.FEATURECLA || '');
    if (!fc.startsWith('Admin-0 capital')) continue;
    if (!capByIso.has(iso)) capByIso.set(iso, []);
    capByIso.get(iso).push(f);
  }
  const rank = f => {
    const p = f.properties || {};
    return [
      p.FEATURECLA === 'Admin-0 capital' ? 1 : 0,
      p.ADM0CAP === 1 ? 1 : 0,
      p.CAPALT === 0 ? 1 : 0,
      p.POP_MAX || 0
    ];
  };
  const findCityFeature = (iso, targetName) => {
    const norm = s => String(s || '').toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
    const t = norm(targetName);
    const list = allByIso.get(iso) || [];
    return list.find(f => {
      const p = f.properties || {};
      return norm(p.NAME_EN) === t || norm(p.NAME) === t || norm(p.NAMEASCII) === t;
    }) || list.find(f => {
      const p = f.properties || {};
      return norm(p.NAME_EN).startsWith(t.split(' ')[0]) && t.includes(norm(p.NAME_EN));
    }) || null;
  };
  const capitals = {};
  const report = [], overrideRows = [], snapRows = [];
  for (const c of geo.countries.slice().sort((a, b) => a.name.localeCompare(b.name))) {
    const cands = (capByIso.get(c.id) || []).slice().sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return rb[i] - ra[i];
      return 0;
    });
    const ov = overrides[c.id] || null;
    if (!cands.length && !ov) {
      report.push({ id: c.id, country: c.name, capital: null, featureClass: null, inside: null, alts: [], flags: ['no capital'] });
      continue;
    }
    const nePri = cands[0] || null;
    const neName = nePri ? String((nePri.properties || {}).NAME_EN || (nePri.properties || {}).NAME || '').trim() : null;
    let pri = nePri;
    let name = neName;
    let hasPos = !!pri;
    if (ov) {
      name = ov.name;
      if (ov.id === 'KZ') {
        pri = findCityFeature(c.id, 'Astana') || findCityFeature(c.id, 'Nur-Sultan') || nePri;
      } else if (ov.id === 'US') {
        pri = findCityFeature(c.id, 'Washington') || nePri;
      } else {
        pri = findCityFeature(c.id, ov.name);
      }
      hasPos = !!pri;
    }
    const p = pri ? (pri.properties || {}) : {};
    let x = null, y = null, inside = false, snapped = false, snapDist = null, snapStep = null;
    if (hasPos) {
      const [lon, lat] = pri.geometry.coordinates;
      const [px, py] = proj(lon, lat);
      x = +px.toFixed(2); y = +py.toFixed(2);
      inside = pipPolys(x, y, c.polys); // test the rounded point that is written out
      if (!inside) {
        const res = snapInside(px, py, c.polys, c.c);
        snapDist = res.dist;
        snapStep = res.step;
        if (res.snapped) {
          x = res.x; y = res.y; inside = true; snapped = true;
        }
        snapRows.push({
          id: c.id, country: c.name, capital: name, dist: snapDist,
          outcome: snapped ? `snapped (${snapStep} inside)` : 'kept outside (no star)',
          snapped, step: snapStep, x, y
        });
      }
    }
    if (ov) {
      overrideRows.push({
        id: c.id, country: c.name, oldCapital: neName || '—', newCapital: name,
        spoken: ov.say || null, positionSource: ov.positionSource, reason: ov.reason,
        hasPos, inside, snapped
      });
    }
    const entry = { name };
    if (ov && ov.say) entry.say = ov.say;
    if (hasPos) { entry.x = x; entry.y = y; entry.inside = inside; if (snapped) entry.snapped = true; }
    else { entry.inside = false; }
    capitals[c.id] = entry;
    const alts = cands.slice(1).map(f => {
      const ap = f.properties || {};
      return { name: String(ap.NAME_EN || ap.NAME || '').trim(), featureClass: ap.FEATURECLA, adm0cap: ap.ADM0CAP, capalt: ap.CAPALT, capin: ap.CAPIN || null };
    });
    const flags = [];
    if (ov) flags.push('overridden');
    if (alts.length) flags.push('alternative capital');
    if (!hasPos) flags.push('no position');
    else if (!inside) flags.push('outside shape');
    if (snapped) flags.push('snapped inside');
    if (hasPos && p.ADM0CAP !== 1) flags.push('ADM0CAP=' + p.ADM0CAP);
    report.push({ id: c.id, country: c.name, capital: name, featureClass: p.FEATURECLA || null, inside, snapped, dist: snapDist, alts, flags });
  }
  fs.writeFileSync(path.join(OUT, 'capitals.js'), 'window.CAPITALS=' + JSON.stringify(capitals) + ';');
  if (process.env.CAPITALS_REPORT) fs.writeFileSync(process.env.CAPITALS_REPORT, JSON.stringify({ report, overrides: overrideRows, snaps: snapRows }, null, 2));
  console.log('capitals.js', Object.keys(capitals).length, 'of', report.length, 'countries; overrides:', overrideRows.length, 'snaps:', snapRows.filter(s => s.snapped).length + '/' + snapRows.length, (fs.statSync(path.join(OUT, 'capitals.js')).size / 1e3).toFixed(1), 'KB');
}

if (WHAT !== 'flags' && WHAT !== 'capitals') buildGeo();
if (WHAT !== 'geo' && WHAT !== 'capitals') await buildFlags();
if (WHAT === 'capitals' || WHAT === 'all') await buildCapitals();

