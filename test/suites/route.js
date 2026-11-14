/* The day's route along the streets (v197): lib/streetroute.js works out the walk between two pins from the map
   pack's own street lines, and lib/vtmap.js draws the day's hops with it, the line growing when a day opens.
   Part 1 feeds the router tiles made here (in a tile's own units), so every rule is checked on streets whose answer
   is known. Part 2 opens Today on the app's real map engine over a made-up pack (test/lib/synthpack.js). */
const { launch, open, exampleTrip, until } = require('../lib/page');
const sp = require('../lib/synthpack');
const TX = 8000, TY = 6000, SPAN = Math.pow(2, 14) * 4096;
/* a point given in tile units (tile TX+dx, TY) as the pin the app would hand over */
const ll = (x, y, dx = 0) => ({ lng: ((TX + dx) * 4096 + x) / SPAN * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * (TY * 4096 + y) / SPAN))) * 180 / Math.PI });
const tile = feats => [...sp.layer('transportation', feats.map(f => Object.assign({ type: 2 }, f)), x => x, y => y)];
const st = (cls, pts, more) => Object.assign({ cls, rings: [pts] }, more || {});
exports.run = async t => {
  const b = await launch();
  const A = await open(b, { width: 390, height: 844 });
  await A.pg.evaluate(() => W.needLater());
  await until(() => A.pg.evaluate(() => !!W.streetRoute), 15000);
  /* run in the page: tiles in, the walk out as tile units of tile TX (so the checks read like the streets above) */
  const walk = (tiles, from, to) => A.pg.evaluate(([tiles, from, to, TX, TY, SPAN]) => {
    const R = W.streetRoute, G = R.graph(tiles.map(t => ({ x: t.x, y: t.y, buf: new Uint8Array(t.bytes) })));
    const p = R.path(G, from, to);
    if (!p) return null;
    const ux = lng => Math.round((lng + 180) / 360 * SPAN - TX * 4096), uy = lat => { const s = Math.sin(lat * Math.PI / 180); return Math.round((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * SPAN - TY * 4096); };
    const pts = p.map(q => [ux(q[0]), uy(q[1])]);
    let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return { pts, len: Math.round(len) };
  }, [tiles, from, to, TX, TY, SPAN]);
  const near = (r, x, y, d = 3) => !!r && r.pts.some(p => Math.hypot(p[0] - x, p[1] - y) <= d);
  const one = feats => [{ x: TX, y: TY, bytes: tile(feats) }];

  /* a main street with no corner where the side street meets it: the tile kept only its two ends */
  const main = st('minor', [[100, 1000], [3000, 1000]]), side = st('minor', [[1500, 1000], [1500, 3000]]);
  let r = await walk(one([main, side]), ll(200, 990), ll(1510, 2800));
  t.ok(near(r, 1500, 1000) && r.len > 3050 && r.len < 3200, 'a side street joins the street it ends on, though the tile kept no corner there: ' + (r && r.len));
  /* two streets that cross with no corner on either */
  r = await walk(one([main, st('minor', [[2000, 500], [2000, 3500]])]), ll(200, 1000), ll(2000, 3300));
  t.ok(near(r, 2000, 1000) && r.len > 4050 && r.len < 4200, 'two streets that cross are joined where they cross: ' + (r && r.len));
  /* a corner of one street lying on another street's straight run */
  r = await walk(one([main, st('minor', [[2500, 200], [2500, 1000], [2900, 2600]])]), ll(200, 1000), ll(2890, 2500));
  t.ok(near(r, 2500, 1000) && !near(r, 2500, 300, 200), "a street's corner on another street's straight run joins it: " + (r && r.len));
  /* a bridge passes over the street below without joining it: the walk goes round to where they really meet */
  const bridge = st('primary', [[2000, 200], [2000, 1800]], { brunnel: 'bridge' }), ramp = st('minor', [[3000, 1000], [3000, 1800], [2000, 1800]]);
  r = await walk(one([main, bridge, ramp]), ll(1800, 1000), ll(2000, 400));
  t.ok(r && !r.pts.some((p, i) => i > 1 && i < r.pts.length - 2 && p[0] === 2000 && p[1] === 1000) && near(r, 3000, 1800) && r.len > 3500, 'a bridge does not join the street it passes over: ' + (r && r.len));
  r = await walk(one([main, bridge]), ll(1800, 1000), ll(2000, 400));
  t.ok(r === null, 'and with no way up to it there is no walk at all, not a jump onto the bridge');
  /* the same street carrying on into the next tile: each tile holds it as far as its edge (and a little past) */
  r = await walk([{ x: TX, y: TY, bytes: tile([st('minor', [[3000, 1000], [4160, 1000]])]) }, { x: TX + 1, y: TY, bytes: tile([st('minor', [[-64, 1000], [1000, 1000]])]) }], ll(3100, 1000), ll(900, 1000, 1));
  t.ok(r && r.len > 1850 && r.len < 1950, 'a street cut at a tile edge carries on in the next tile: ' + (r && r.len));
  /* what is walked: never a motorway or a railway; a footpath sooner than a main road of the same length */
  const far = [[100, 1000], [100, 3000], [3000, 3000], [3000, 1000]];
  r = await walk(one([st('motorway', [[100, 1000], [3000, 1000]]), st('rail', [[100, 1010], [3000, 1010]]), st('minor', far)]), ll(100, 1100), ll(3000, 1100));
  t.ok(r && r.len > 6000, 'a motorway and a railway are not walked: the walk goes round by the street: ' + (r && r.len));
  r = await walk(one([st('primary', [[100, 1000], [1500, 800], [3000, 1000]]), st('path', [[100, 1000], [1500, 1200], [3000, 1000]], { sub: 'footway' })]), ll(100, 1000), ll(3000, 1000));
  t.ok(near(r, 1500, 1200) && !near(r, 1500, 800), 'a footpath is taken sooner than a main road of the same length');
  /* a pin with no street near it, and pins on the same stretch */
  r = await walk(one([main]), ll(200, 1000), ll(2000, 3000));
  t.ok(r === null, 'a pin far from any street (here about 950 m) has no walk drawn');
  r = await walk(one([main]), ll(400, 990), ll(900, 1010));
  t.ok(r && r.len > 500 && r.len < 540 && r.pts.length === 4, 'two pins on the same stretch: straight along it');
  const tf = await A.pg.evaluate(([a, c]) => ({ near: W.streetRoute.tilesFor([a, c]).length, far: W.streetRoute.tilesFor([a, { lat: a.lat + 0.5, lng: a.lng }]) }), [ll(100, 100), ll(3000, 3000)]);
  t.ok(tf.near >= 1 && tf.near <= 4 && tf.far === null, 'the tiles a walk needs: the ones round its ends (' + tf.near + '), none when the ends are a ride apart');
  /* the line growing: half its length at half way, all of it at the end */
  const fr = await A.pg.evaluate(() => {
    const lines = [[[0, 0], [0.001, 0], [0.002, 0]], [[0.002, 0], [0.002, 0.002]]];
    const h = W.vtRouteFrame(lines, 0.5), q = W.vtRouteFrame(lines, 0.25);
    return { all: W.vtRouteFrame(lines, 1) === lines, half: [h.length, h[0].length, h[1] && h[1].length], quarter: q.map(l => l[l.length - 1]), none: W.vtRouteFrame(lines, 0).length };
  });
  t.ok(fr.all && fr.none === 0 && fr.half[0] === 1 && fr.half[1] === 3 && Math.abs(fr.quarter[0][0] - 0.001) < 1e-9, 'the line grows hop by hop: a quarter is half the first hop, a half all of it, the whole at the end');
  await A.ctx.close();

  /* ---- on the app's own map: Today in Rome, on the made-up pack ---- */
  const B = await open(b, { width: 390, height: 844 });
  await sp.serve(B.ctx);
  await sp.again(B.pg);
  await exampleTrip(B.pg);
  const day = await B.pg.evaluate(() => {
    const d = W.P.days.find(x => x.city === 'Rome' && x.slots.filter(s => s.item && s.item.lat != null).length >= 3);
    if (!d) return null;
    W.S.stays['Italy|Rome'] = { label: 'Hotel in the middle', lat: 41.9028, lng: 12.4964 };
    W.S.day = d.n; W.dataV = (W.dataV || 0) + 1; W.goView('go'); W.render();
    return d.n;
  });
  t.ok(!!day, 'the example trip has a day in Rome');
  const drawn = await until(() => B.pg.evaluate(() => (W.vtRouteLines && W.vtRouteLines().length ? true : null)), 25000);
  const m = await B.pg.evaluate(() => {
    const lines = W.vtRouteLines(), src = W.vt.map.getSource('wp-route'), data = src && (src._data || (src.serialize && src.serialize().data));
    const km = (a, c) => W.km({ lat: a[1], lng: a[0] }, { lat: c[1], lng: c[0] });
    const len = l => l.reduce((s, p, i) => (i ? s + km(l[i - 1], p) : 0), 0);
    return {
      on: W.vtActive(), n: lines.length, pts: lines.map(l => l.length), first: lines[0] && lines[0][0],
      bends: lines.filter(l => l.length > 3).length,
      longer: lines.every(l => len(l) >= km(l[0], l[l.length - 1]) - 1e-6),
      layers: ['wp-route-case', 'wp-route'].map(id => !!W.vt.map.getLayer(id)),
      shown: data && data.features ? data.features.length : -1,
      above: (() => { const ls = W.vt.map.getStyle().layers, i = ls.findIndex(l => l.id === 'wp-route'), j = ls.findIndex(l => l.type === 'symbol'); return j < 0 || i < j; })()
    };
  }).catch(e => ({ err: String(e) }));
  t.ok(drawn && m.on && m.n >= 2 && m.bends >= 1 && m.longer, "Today's map draws the day's hops along the streets, not straight from pin to pin: " + JSON.stringify(m));
  t.ok(m.first && Math.abs(m.first[0] - 12.4964) < 1e-6 && Math.abs(m.first[1] - 41.9028) < 1e-6, "the line starts at where you're staying");
  t.ok(m.layers && m.layers[0] && m.layers[1] && m.above && m.shown === m.n, 'the line (with its edge) lies under the map\'s names, and with reduced motion it is all there at once: ' + m.shown + ' of ' + m.n);
  /* another day: its own route, and nothing left of the last one */
  const other = await B.pg.evaluate(n => {
    const before = JSON.stringify(W.vtRouteLines());
    const d = W.P.days.find(x => x.city === 'Rome' && x.n !== n && x.slots.filter(s => s.item && s.item.lat != null).length >= 2);
    if (!d) return null;
    W.S.day = d.n; W.goView('go'); W.render();
    return { before, n: d.n };
  }, day);
  if (other) {
    const changed = await until(() => B.pg.evaluate(bf => { const l = W.vtRouteLines(); return l.length && JSON.stringify(l) !== bf ? l.length : null; }, other.before), 15000);
    t.ok(!!changed, "another day draws its own route: " + changed + ' hops');
  }
  t.eq(B.errors(), [], 'no page errors with the route on the map');
  await b.close();
};
