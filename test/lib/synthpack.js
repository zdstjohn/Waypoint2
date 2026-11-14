/* A made-up street-map pack for Rome's centre, so the tests (and the header screenshots) can draw the app's real map
   engine where the machine has no real pack. NOT real map data: invented streets, a river and parks, in the same
   vector-tile layout the nightly packs use (water, park, transportation, building; z8 to z12 tiles, and the detailed
   z14 ones the day's route is worked out from). Served in place of vt/index.json and vt/italy-rome.wasm for one
   browser context:  await require('./synthpack').serve(ctx);
   layer() also makes single tiles for the street-route tests (class, and optionally subclass and brunnel). */
const zlib = require('zlib');
const SLUG = 'italy-rome';
const C = [12.4964, 41.9028]; /* the middle (lng, lat) */
const Z = 12;

/* ---- the smallest vector-tile (protobuf) writer that will do ---- */
const vint = n => { const o = []; n = Math.floor(n); while (n > 127) { o.push((n % 128) | 128); n = Math.floor(n / 128); } o.push(n); return o; };
const zig = n => (n << 1) ^ (n >> 31);
const tag = (f, w) => vint(f * 8 + w);
const lenField = (f, bytes) => [...tag(f, 2), ...vint(bytes.length), ...bytes];
const str = s => [...Buffer.from(s, 'utf8')];
function geometry(rings, type, tx, ty) {
  const g = []; let cx = 0, cy = 0;
  rings.forEach(r => {
    const pts = r.map(p => [Math.round(tx(p[0])), Math.round(ty(p[1]))]);
    g.push(...vint((1 << 3) | 1), ...vint(zig(pts[0][0] - cx)), ...vint(zig(pts[0][1] - cy))); cx = pts[0][0]; cy = pts[0][1];
    g.push(...vint(((pts.length - 1) << 3) | 2));
    for (let i = 1; i < pts.length; i++) { g.push(...vint(zig(pts[i][0] - cx)), ...vint(zig(pts[i][1] - cy))); cx = pts[i][0]; cy = pts[i][1]; }
    if (type === 3) g.push(...vint((1 << 3) | 7));
  });
  return g;
}
function layer(name, feats, tx, ty) {
  const keys = ['class', 'subclass', 'brunnel'], vals = []; const body = [...tag(1, 2), ...vint(name.length), ...str(name)];
  const val = v => { let i = vals.indexOf(v); if (i < 0) { vals.push(v); i = vals.length - 1; } return i; };
  feats.forEach(f => {
    const tags = [0, val(f.cls)], geom = geometry(f.rings, f.type, tx, ty);
    if (f.sub) tags.push(1, val(f.sub));
    if (f.brunnel) tags.push(2, val(f.brunnel));
    const fb = [...lenField(2, tags.flatMap(vint)), ...tag(3, 0), ...vint(f.type), ...lenField(4, geom)];
    body.push(...lenField(2, fb));
  });
  keys.forEach(k => body.push(...lenField(3, str(k))));
  vals.forEach(v => body.push(...lenField(4, lenField(1, str(v)))));
  body.push(...tag(5, 0), ...vint(4096), ...tag(15, 0), ...vint(2));
  return lenField(3, body);
}

/* ---- the invented town: streets on a tilted grid, two main roads, a river, parks, blocks of buildings ---- */
function town() {
  const rot = 0.35, cs = Math.cos(rot), sn = Math.sin(rot), sx = 0.0145, sy = 0.0105; /* the grid's size in degrees */
  const at = (u, v) => [C[0] + (u * cs - v * sn) * sx, C[1] + (u * sn + v * cs) * sy];
  const lines = [], water = [], parks = [], blocks = [];
  for (let i = -8; i <= 8; i++) {
    lines.push({ cls: i % 4 === 0 ? 'secondary' : 'minor', type: 2, rings: [[at(i * 0.25, -2.2), at(i * 0.25, 2.2)]] });
    lines.push({ cls: i % 4 === 0 ? 'secondary' : 'minor', type: 2, rings: [[at(-2.2, i * 0.25), at(2.2, i * 0.25)]] });
  }
  lines.push({ cls: 'primary', type: 2, rings: [[at(-2.4, -0.6), at(0, 0.1), at(2.4, 0.9)]] });
  lines.push({ cls: 'primary', type: 2, rings: [[at(0.7, -2.4), at(0.2, 0), at(-0.4, 2.4)]] });
  const river = []; for (let t = -2.4; t <= 2.4; t += 0.2) river.push([t, -1.1 + 0.55 * Math.sin(t * 1.3) + t * 0.25]);
  const up = river.map(p => at(p[0], p[1] + 0.09)), down = river.map(p => at(p[0], p[1] - 0.09)).reverse();
  water.push({ cls: 'river', type: 3, rings: [[...up, ...down, up[0]]] });
  [[-1.2, 1.1, 0.5, 0.35], [1.3, 0.9, 0.45, 0.4], [0.2, -1.8, 0.7, 0.3], [-1.6, -0.2, 0.3, 0.3]].forEach(([u, v, w, h]) =>
    parks.push({ cls: 'park', type: 3, rings: [[at(u - w, v - h), at(u + w, v - h), at(u + w, v + h), at(u - w, v + h), at(u - w, v - h)]] }));
  for (let i = -6; i < 6; i++) for (let j = -6; j < 6; j++) if ((i * 7 + j * 3) % 4 !== 0) {
    const u = i * 0.25 + 0.04, v = j * 0.25 + 0.04, e = 0.17;
    blocks.push({ cls: 'building', type: 3, rings: [[at(u, v), at(u + e, v), at(u + e, v + e), at(u, v + e), at(u, v)]] });
  }
  return { lines, water, parks, blocks, bounds: [C[0] - 0.045, C[1] - 0.03, C[0] + 0.045, C[1] + 0.03] };
}

function build() {
  const T = town(), parts = [], index = {};
  let off = 0;
  /* the same town at every zoom from 8 to 12 (the real packs' coarse map), 3x3 tiles around the middle at each */
  for (let z = 8; z <= Z; z++) {
    const n = Math.pow(2, z);
    const tileX = lng => ((lng + 180) / 360) * n, tileY = lat => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n; };
    const cx = Math.floor(tileX(C[0])), cy = Math.floor(tileY(C[1]));
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) {
      const tx = lng => (tileX(lng) - x) * 4096, ty = lat => (tileY(lat) - y) * 4096;
      const buf = Buffer.from([...layer('water', T.water, tx, ty), ...layer('park', T.parks, tx, ty), ...layer('transportation', T.lines, tx, ty), ...layer('building', T.blocks, tx, ty)]);
      const gz = zlib.gzipSync(buf); parts.push(gz); index[z + '/' + x + '/' + y] = [off, gz.length]; off += gz.length;
    }
  }
  /* the detailed tiles (z14, 5x5 around the middle), as a real pack has for its city: the day's route along the streets
     is worked out from these (lib/streetroute.js) */
  {
    const z = 14, n = Math.pow(2, z);
    const tileX = lng => ((lng + 180) / 360) * n, tileY = lat => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n; };
    const cx = Math.floor(tileX(C[0])), cy = Math.floor(tileY(C[1]));
    for (let x = cx - 2; x <= cx + 2; x++) for (let y = cy - 2; y <= cy + 2; y++) {
      const tx = lng => (tileX(lng) - x) * 4096, ty = lat => (tileY(lat) - y) * 4096;
      const gz = zlib.gzipSync(Buffer.from([...layer('water', T.water, tx, ty), ...layer('park', T.parks, tx, ty), ...layer('transportation', T.lines, tx, ty), ...layer('building', T.blocks, tx, ty)])); parts.push(gz); index[z + '/' + x + '/' + y] = [off, gz.length]; off += gz.length;
    }
  }
  const hdr = Buffer.from(JSON.stringify({ t: index, places: T.bounds, b: [T.bounds[0] - 0.05, T.bounds[1] - 0.04, T.bounds[2] + 0.05, T.bounds[3] + 0.04], zmin: 8, zmax: 14 }));
  const len = Buffer.alloc(4); len.writeUInt32BE(hdr.length);
  return Buffer.concat([Buffer.from('WPVT1\n'), len, hdr, ...parts]);
}

/* serve it as Rome's pack for one browser context (the rest of vt/ comes from the real server); then `again(pg)` */
async function serve(ctx) {
  const pack = build(), b = [C[0] - 0.045, C[1] - 0.03, C[0] + 0.045, C[1] + 0.03];
  await ctx.route(/\/vt\/index\.json/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ [SLUG]: { b, places: b, city: 'Rome', country: 'Italy', size: pack.length } }) }));
  await ctx.route(new RegExp('/vt/' + SLUG + '\\.wasm'), r => r.fulfill({ contentType: 'application/wasm', body: pack }));
}
/* (the app asked for the list of packs when it started, before this was in place: ask again) */
async function again(pg) { await pg.evaluate(() => { W.vt.idxState = 'idle'; W.vt.idx = null; W.vtFor('Italy', 'Rome', 41.9, 12.5); }); await pg.waitForFunction(() => W.vt.idxState === 'ready', null, { timeout: 8000 }); }
module.exports = { serve, again, build, layer, SLUG };
