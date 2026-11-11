/* Speed: the page starts with a handful of same-origin requests (one script, one stylesheet, a few fonts), nothing from
   other sites; a tap that changes nothing about the trip re-renders without re-planning; a render stays quick with the
   CPU throttled 4x (an older phone); map packs decode in a worker and come back from the IndexedDB cache on the next
   visit. The numbers go into the notes so a slowdown shows up in the report. */
const { launch, open, settle, calm } = require('../lib/page'); const fs = require('fs'); const path = require('path');
const SPAIN = [['Madrid', 40.4168, -3.7038], ['Toledo', 39.8628, -4.0273], ['Malaga', 36.7213, -4.4214], ['Granada', 37.1773, -3.5986], ['Seville', 37.3891, -5.9845], ['Barcelona', 41.3874, 2.1686]];
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, tz: 'America/Los_Angeles' });

  /* startup */
  const st = await pg.evaluate(() => {
    const res = performance.getEntriesByType('resource').map(e => ({ n: e.name.replace(/^.*8771\//, ''), kb: Math.round((e.transferSize || e.encodedBodySize || 0) / 1024) }));
    return { n: res.length, external: res.filter(r => /^https?:/.test(r.n)).map(r => r.n), scripts: res.filter(r => /\.js$/.test(r.n)).length, fonts: res.filter(r => /woff2$/.test(r.n)).length, list: res.map(r => r.n) };
  });
  t.ok(st.n <= 12, `startup makes at most 12 requests (${st.n}: ${st.list.join(', ')})`);
  t.eq(st.external, [], 'nothing is fetched from another site at startup');
  /* the first screen needs one script; the second (packing, kids' corner, journal, family, settings) follows when the page is idle */
  const firstPaint = await pg.evaluate(() => { const fp = performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint'); return fp ? fp.startTime : null; });
  const app2 = await pg.evaluate(() => { const e = performance.getEntriesByType('resource').find(r => /app2\.js$/.test(r.name)); return e ? { start: e.startTime } : null; });
  t.eq(st.list.filter(n => /\.js$/.test(n)).sort(), ['app.js', 'app2.js'].filter(n => n === 'app.js' || app2), 'the first screen needs one script; the second comes after');
  t.ok(app2 && firstPaint != null && app2.start >= firstPaint - 1 && await pg.evaluate(() => W.laterReady && !!W.packBlock && !!W.renderKids), `the second script loads after the first paint (${app2 && Math.round(app2.start)} ms vs ${firstPaint && Math.round(firstPaint)} ms) and brings its screens`);
  t.ok(st.fonts >= 3 && st.fonts <= 6, `the fonts it needs load from the app itself (${st.fonts})`);
  const kb = Math.round((fs.statSync(path.join(t.root, 'trip', 'app.js')).size + fs.statSync(path.join(t.root, 'trip', 'app.min.css')).size) / 1024);
  t.ok(kb < 520, `first script + stylesheet under 520 KB before compression (${kb} KB)`);
  const wide = ['app.min.css', 'app2.css'].map(f => fs.readFileSync(path.join(t.root, 'trip', f)).filter(c => c > 127).length);
  t.eq(wide, [0, 0], 'the stylesheets are plain ASCII, so "·" and "→" in them never show up garbled');
  const css2 = await pg.evaluate(() => { const e = performance.getEntriesByType('resource').find(r => /app2\.css$/.test(r.name)); return e ? e.startTime : null; });
  t.ok(css2 != null && firstPaint != null && css2 >= firstPaint - 1, `the second script's styles (app2.css) come with it, after the first paint (${css2 && Math.round(css2)} ms)`);
  const kb2 = f => Math.round(fs.statSync(path.join(t.root, 'trip', f)).size / 1024);
  t.note(`startup: ${st.n} requests, first script+css ${kb} KB, then app2.js ${kb2('app2.js')} KB + app2.css ${kb2('app2.css')} KB`);

  /* a 17-day trip, then timings with the CPU throttled 4x */
  await pg.evaluate(SP => {
    W.isExample = false;
    W.C.country.Spain = { cities: SP.filter(c => !W.findCity('Spain', c[0])).map(c => ({ name: c[0], lat: c[1], lng: c[2], w: 2, pop: 3, t: ['culture', 'family'], d: c[0] })) };
    Object.assign(W.S, { styles: ['culture', 'food', 'beach'], travelers: [36, 34, 4, 2, 68, 66], depart: 'Los Angeles', start: '2027-05-10', days: 17, cityDays: {}, picks: {}, seen: {}, mine: {}, legPick: {}, fold: {}, rest: {}, day: 1, tview: 'days',
      countries: [{ name: 'Spain', mode: 'manual', picked: ['Madrid', 'Toledo', 'Malaga', 'Granada', 'Seville', 'Barcelona'] }] });
    W.render();
  }, SPAIN);
  await calm(pg, 13000);
  const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const tm = await pg.evaluate(() => {
    const T = {}; const time = (k, f, n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) f(); T[k] = +((performance.now() - t0) / n).toFixed(1); };
    const P0 = W.plan(); time('memo', () => W.plan(), 20); T.same = W.plan() === P0;
    time('full', () => { W.replan(); W.plan(); }, 2);
    time('render', () => W.render(), 5);
    W.S.day = 9; time('renderDay9', () => W.render(), 5);
    W.S.picks['x|changed'] = 'a'; const P1 = W.plan(); T.replanned = P1 !== P0; delete W.S.picks['x|changed'];
    return T;
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  t.ok(tm.same && tm.memo < 3, `an unchanged trip reuses its plan (${tm.memo} ms)`);
  t.ok(tm.replanned, 'a changed pick plans again');
  t.ok(tm.render < 120, `a render with the CPU throttled 4x stays under 120 ms (${tm.render} ms; a full plan is ${tm.full} ms)`);
  t.note(`4x throttled: plan ${tm.full} ms, memo ${tm.memo} ms, render ${tm.render} ms / day 9 ${tm.renderDay9} ms`);

  /* map packs: decoded in the worker, cached for next time */
  const dir = path.join(t.root, 'trip', 'vt', '_t'); fs.mkdirSync(dir, { recursive: true });
  const part = path.join(t.root, 'vtassets', 'parts', 'greece-nafplio.p0.js');
  if (fs.existsSync(part)) {
    fs.copyFileSync(part, path.join(dir, 'p0.js'));
    await pg.waitForFunction(() => W.laterReady && !!W.vtLoadTest, null, { timeout: 15000 });   /* drawing maps comes with the second script */
    const r = await pg.evaluate(async () => {
      const t0 = performance.now(); const p = await W.vtLoadTest('pack|perf-test', 'v1', { urls: ['vt/_t/p0.js'] }); const t1 = performance.now();
      const p2 = await W.vtLoadTest('pack|perf-test', 'v1', { urls: ['vt/_t/p0.js'] }); const g = await W.vtLoadTest('glyphs|core', '2', { url: 'vt/glyphs.wasm' });
      return { worker: W.vtWorkerUsed(), ms: Math.round(t1 - t0), slug: p.hdr.slug, tiles: Object.keys(p.hdr.t).length, cached: p2.cached, glyphs: Object.keys(g.hdr.t).length };
    });
    t.ok(r.worker, 'map packs are decoded in a worker');
    t.eq([r.slug, r.tiles > 10], ['greece-nafplio', true], `a pack from asset parts decodes (${r.ms} ms)`);
    t.ok(r.cached, 'the second read comes from the IndexedDB cache');
    t.eq(r.glyphs, 6, 'the core glyph file holds the six everyday ranges');
    await pg.reload(); await pg.waitForTimeout(1500);
    const r2 = await pg.evaluate(async () => { const t0 = performance.now(); const p = await W.vtLoadTest('pack|perf-test', 'v1', { urls: ['vt/_t/p0.js'] }); return { cached: p.cached, ms: Math.round(performance.now() - t0) }; });
    t.ok(r2.cached, `the cache survives a reload (${r2.ms} ms)`);
    fs.rmSync(dir, { recursive: true, force: true });
  } else t.note('no local map part to test with');

  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
