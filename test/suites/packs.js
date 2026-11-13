/* Street-map packs that draw sooner: a pack made town centre first ("lay": 2) is read as it arrives, so the tiles of the
   screen the map opens at are there after the first small part, and the rest follows in the background. The parts are
   written by the nightly tools' own encoder (tools/pack2json.py: basE91 in JSON, test/lib/mkpack.py makes a small
   made-up pack with it), read by the worker (vt/packworker.js) and by the page's own reader (no worker). Packs made
   before keep working as they are (the perf suite reads a real older one). */
const { spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path'); const os = require('os'); const crypto = require('crypto');
const { launch, open } = require('../lib/page');
exports.run = async t => {
  const ROOT = t.root, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-packs-')), dir = path.join(ROOT, 'trip', 'vt', '_p');
  const r = spawnSync('python3', ['-I', 'test/lib/mkpack.py', tmp], { cwd: ROOT, encoding: 'utf8' });
  t.ok(r.status === 0, 'the made-up pack is written by the tools\' encoder ' + (r.stderr || '').slice(0, 200));
  const M = JSON.parse(r.stdout.trim().split('\n').pop());
  fs.mkdirSync(dir, { recursive: true }); for (const n of M.parts) fs.copyFileSync(path.join(tmp, n), path.join(dir, n));
  const urls = M.parts.map(n => 'vt/_p/' + n);

  /* the layout and the files, before any browser */
  const sz = M.index;
  const endOf = k => sz[k][0] + sz[k][1];
  const openKeys = M.order.filter(k => endOf(k) <= M.open), firstKeys = M.order.filter(k => endOf(k) <= M.first);
  t.ok(openKeys.length >= 1 && openKeys.every(k => +k.split('/')[0] <= 12) && firstKeys.length > openKeys.length && firstKeys.length < M.order.length / 2, `the opening screen's tiles come first (${openKeys.length} tiles, ${M.open} bytes), the rest of the first screen next (${firstKeys.length} in all), the other ${M.order.length - firstKeys.length} after`);
  t.ok(M.sizes[0] < 60000 && M.sizes[0] < M.sizes[1] && M.parts.length >= 4, `the first part is small (${M.sizes[0]} bytes of text; the whole pack is ${M.size} bytes in ${M.parts.length} parts)`);
  const text = M.parts.map(n => fs.readFileSync(path.join(tmp, n), 'latin1'));
  t.ok(text.every(x => /^\{"v":2,/.test(x) && /"d":"[^"\\]*"\}$/.test(x)), 'every part is plain JSON with the bytes in "d", last, with no escapes to read');
  const ratio = text.reduce((a, x) => a + x.length, 0) / M.size;
  t.ok(ratio > 1.2 && ratio < 1.26, `basE91 carries the bytes at ${ratio.toFixed(3)} times their size (base64 is 1.333)`);

  const b = await launch();
  try {
    const { pg, errors } = await open(b, { width: 390 });
    await pg.waitForFunction(() => W.laterReady && !!W.vtLoadTest, null, { timeout: 15000 });
    /* the whole pack arrives and every tile is the tile that was packed */
    const all = await pg.evaluate(async ({ urls, keys }) => {
      const p = await W.vtLoadTest('pack|syn', 'v1', { urls, lay: 2 }); await W.vtReadyTest(p); const out = {};
      for (const k of keys) { const d = await W.vtPieceTest(p, k); const h = await crypto.subtle.digest('SHA-256', d); out[k] = Array.from(new Uint8Array(h)).map(x => x.toString(16).padStart(2, '0')).join(''); }
      return { out, slug: p.hdr.slug, lay: p.hdr.lay, len: p.len, have: p.have, worker: W.vtWorkerUsed() };
    }, { urls, keys: Object.keys(M.tiles) });
    t.ok(all.worker && all.slug === 'syn-town' && all.lay === 2, 'a pack made town centre first is read by the worker');
    t.eq(all.out, M.tiles, `all ${Object.keys(M.tiles).length} tiles read back are the tiles that were packed, byte for byte`);
    t.ok(all.have === all.len, 'the pack is whole at the end');

    /* the second read comes from the cache, whole at once */
    const again = await pg.evaluate(async urls => { const p = await W.vtLoadTest('pack|syn', 'v1', { urls, lay: 2 }); return { cached: p.cached, n: Object.keys(p.hdr.t).length, whole: p.have === undefined }; }, urls);
    t.ok(again.cached && again.whole, 'the next read is from the cache');

    /* the map's first tiles do not wait for the rest: hold the third part back, read the pack */
    let release = null; const gate = new Promise(res => { release = res; });
    await pg.route('**/vt/_p/syn-town.p2.json', async route => { await gate; await route.continue(); });
    const t0 = Date.now();
    const early = await pg.evaluate(async ({ urls, keys, firstKeys }) => {
      const p = await W.vtLoadTest('pack|syn2', 'v1', { urls, lay: 2 });
      const at = p.have; const got = {};
      for (const k of firstKeys) { const d = await W.vtPieceTest(p, k); got[k] = d.byteLength; }
      let waiting = true; const late = keys.filter(k => !firstKeys.includes(k)).slice(-1)[0];
      const lateP = W.vtPieceTest(p, late).then(d => { waiting = false; return d.byteLength; });
      await new Promise(r => setTimeout(r, 600));
      const stillWaiting = waiting; window.__late = lateP; window.__pack = p;
      return { first: Object.keys(got).length, haveWhileHeld: p.have, len: p.len, stillWaiting, late };
    }, { urls, keys: M.order, firstKeys });
    t.ok(early.first === firstKeys.length && early.haveWhileHeld < early.len, `the first screen's ${early.first} tiles are drawn while the rest of the pack is still on its way (${early.haveWhileHeld} of ${early.len} bytes in)`);
    t.ok(early.stillWaiting, 'a tile from a later part waits for its bytes (it is not answered with nothing)');
    release();
    const done = await pg.evaluate(async () => { const n = await window.__late; await W.vtReadyTest(window.__pack); return { n, have: window.__pack.have, len: window.__pack.len }; });
    t.ok(done.n > 1000 && done.have === done.len, `and gets them when they arrive (${done.n} bytes of tile; the pack is whole)`);
    await pg.unroute('**/vt/_p/syn-town.p2.json');

    /* a part that never comes: the waiting tile is told, the tiles already in are fine */
    await pg.route('**/vt/_p/syn-town.p3.json', route => route.abort());
    const failed = await pg.evaluate(async ({ urls, order, firstKeys }) => {
      const p = await W.vtLoadTest('pack|syn3', 'v9', { urls, lay: 2 });
      const ok1 = (await W.vtPieceTest(p, firstKeys[0])).byteLength > 0; let err = '';
      await W.vtPieceTest(p, order[order.length - 1]).then(() => { err = 'answered'; }, e => { err = 'failed: ' + e.message; });
      return { ok1, err };
    }, { urls, order: M.order, firstKeys });
    t.ok(failed.ok1 && /^failed/.test(failed.err), `a part that cannot be fetched fails the tiles waiting for it, not the ones in (${failed.err})`);
    await pg.unroute('**/vt/_p/syn-town.p3.json');

    /* an older pack (base64 parts from before) is read as before */
    const b64 = (() => { const buf = fs.readFileSync(path.join(tmp, 'old.bin')); return JSON.stringify({ v: 1, slug: 'syn-town', part: 0, of: 1, b64: buf.toString('base64') }); })();
    fs.writeFileSync(path.join(dir, 'old.p0.js'), b64);
    const old = await pg.evaluate(async () => { const p = await W.vtLoadTest('pack|old', 'v1', { urls: ['vt/_p/old.p0.js'] }); const k = Object.keys(p.hdr.t)[0]; const d = await W.vtPieceTest(p, k); return { n: Object.keys(p.hdr.t).length, lay: p.hdr.lay || 0, d: d.byteLength > 0, whole: p.have === undefined }; });
    t.ok(old.n === Object.keys(M.tiles).length && old.lay === 0 && old.d && old.whole, 'an older pack (one base64 part, no layout) still reads, whole, as before');
    t.eq(errors(), [], 'no page errors');
  } finally { await b.close(); }

  /* with no worker (a page that may not start one) the page reads the same parts itself */
  const b2 = await launch();
  try {
    const { pg, errors } = await open(b2, { width: 390, init: 'window.Worker = undefined;' });
    await pg.waitForFunction(() => W.laterReady && !!W.vtLoadTest, null, { timeout: 15000 });
    const r2 = await pg.evaluate(async ({ urls, keys }) => {
      const p = await W.vtLoadTest('pack|syn-nw', 'v1', { urls, lay: 2 }); const out = {};
      for (const k of keys) { const d = await W.vtPieceTest(p, k); const h = await crypto.subtle.digest('SHA-256', d); out[k] = Array.from(new Uint8Array(h)).map(x => x.toString(16).padStart(2, '0')).join(''); }
      return { out, worker: W.vtWorkerUsed() };
    }, { urls, keys: Object.keys(M.tiles) });
    t.ok(!r2.worker, 'with no worker the page reads the pack itself');
    t.eq(r2.out, M.tiles, 'and its basE91 reader gives the same tiles, byte for byte');
    t.eq(errors(), [], 'no page errors without the worker');
  } finally { await b2.close(); fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(tmp, { recursive: true, force: true }); }
};
