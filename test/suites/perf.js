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
  /* (the questions to Claude are a piece of their own, app.ask.js: fetched when the first one is asked, as here, or with the second script) */
  const askAt = await pg.evaluate(() => { const e = performance.getEntriesByType('resource').find(r => /app\.ask\.js$/.test(r.name)); return e ? e.startTime : null; });
  t.eq(st.list.filter(n => /\.js$/.test(n)).sort(), ['app.ask.js', 'app.js', 'app2.js'].filter(n => n === 'app.js' || (n === 'app2.js' ? app2 : askAt != null)), 'the first screen needs one script; the second comes after, and the questions to Claude when one is asked');
  t.ok(await pg.evaluate(() => W.pieceIn('ask') && !W.pieceIn('desk')), 'a phone has the questions to Claude and never fetches the desktop workspace');
  t.ok(app2 && firstPaint != null && app2.start >= firstPaint - 1 && await pg.evaluate(() => W.laterReady && !!W.packBlock && !!W.renderKids), `the second script loads after the first paint (${app2 && Math.round(app2.start)} ms vs ${firstPaint && Math.round(firstPaint)} ms) and brings its screens`);
  t.ok(st.fonts >= 2 && st.fonts <= 3, `the fonts it needs load from the app itself: the text face as one variable file, the serif and the logo's face (${st.fonts})`);
  const kb = Math.round((fs.statSync(path.join(t.root, 'trip', 'app.js')).size + fs.statSync(path.join(t.root, 'trip', 'app.min.css')).size) / 1024);
  /* v183: the questions to Claude and the desktop workspace load when needed (about 481 KB); the limit follows it down.
     v193: 492 KB with what the first screen now draws (a day out's band, a rest day's cards, tomorrow's banner; the tour's
     styles and sunrise times moved to the second script to make room): the limit moved up 4 KB, the one time, on
     purpose. Removing dead code (on hold, the owner's call) is where it comes back down. */
  t.ok(kb < 494, `first script + stylesheet under 494 KB before compression (${kb} KB)`);
  const wide = ['app.min.css', 'app2.css'].map(f => fs.readFileSync(path.join(t.root, 'trip', f)).filter(c => c > 127).length);
  t.eq(wide, [0, 0], 'the stylesheets are plain ASCII, so "·" and "→" in them never show up garbled');
  const css2 = await pg.evaluate(() => { const e = performance.getEntriesByType('resource').find(r => /app2\.css$/.test(r.name)); return e ? e.startTime : null; });
  t.ok(css2 != null && firstPaint != null && css2 >= firstPaint - 1, `the second script's styles (app2.css) come with it, after the first paint (${css2 && Math.round(css2)} ms)`);
  const kb2 = f => Math.round(fs.statSync(path.join(t.root, 'trip', f)).size / 1024);
  t.note(`startup: ${st.n} requests, first script+css ${kb} KB, then app2.js ${kb2('app2.js')} KB + app2.css ${kb2('app2.css')} KB, and app.ask.js ${kb2('app.ask.js')} KB when Claude is first asked`);

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
  await ctx.close();

  /* the second script arriving: its parts that hear from Claude's runtime as they start (family's database and who you
     are, the journal's photo store, planning together, the booking helper) are drawn with the second script's own
     redraw, not one re-plan and redraw each. On a slow phone those were one block of ~0.6 s just after the first screen,
     where a tap waited. Held back here until the counting is in place */
  const hold = new Function(`const add = HTMLHeadElement.prototype.appendChild; HTMLHeadElement.prototype.appendChild = function (n) {
    if (n && n.tagName === 'SCRIPT' && /app2\\.js/.test(n.src || '')) { const self = this; const t = setInterval(function () { if (window.__go) { clearInterval(t); add.call(self, n); } }, 20); return n; }
    return add.call(this, n); };`);
  const o2 = await open(b, { width: 390, init: hold });
  /* and in steps: the task that runs the second script plans nothing and draws nothing, and a plan made for what
     arrived (the second script, or a burst of answers) is drawn in a task after its own. Script, plan and draw were one
     stretch of 0.5-0.9 s at 6x just after the first screen. A task is told apart without any clock: a timeout set in a
     task runs after that task (and before the timeouts set after it), so a flag cleared by one marks the task it was
     set in */
  await o2.pg.evaluate(() => {
    const c = (window.__rc = { draws: 0, plans: 0, atReady: -1, inLoad: 0, loadPlans: 0, loadDraws: 0, apart: 0, sameTask: 0 }), r = W.render, pl = W.plan; let last = W.P, depth = 0, planTask = 0;
    /* (the script's task: while it runs, it is document.currentScript; then its load event, where the flag is set) */
    const app2 = x => !!x && x.tagName === 'SCRIPT' && /app2\.js/.test(x.src || ''), inApp2 = () => c.inLoad || app2(document.currentScript);
    document.addEventListener('load', e => { if (app2(e.target)) { c.inLoad = 1; setTimeout(() => { c.inLoad = 0; }, 0); } }, true);
    W.render = function () { c.draws++; if (W.laterReady && c.atReady < 0) c.atReady = c.draws; if (inApp2()) c.loadDraws++; if (planTask && !depth) c.sameTask++; depth++; try { return r.apply(this, arguments); } finally { depth--; } };
    W.plan = function () { const P = pl.apply(this, arguments); if (P !== last) { c.plans++; last = P; if (inApp2()) c.loadPlans++; if (!depth) { c.apart++; planTask = 1; setTimeout(() => { planTask = 0; }, 0); } } return P; };
    window.__go = 1;
  });
  await o2.pg.waitForFunction(() => W.laterReady, null, { timeout: 15000 }).catch(() => {});
  await calm(o2.pg, 8000);
  const rc = await o2.pg.evaluate(() => window.__rc);
  t.ok(rc.atReady >= 1 && rc.atReady <= 2, `the second script's arrival is drawn once, not once for each of its parts that hears from Claude's runtime (${rc.atReady} draws until it was in; it was 7)`);
  t.ok(rc.loadPlans === 0 && rc.loadDraws === 0, `the task that runs the second script plans and draws nothing (${rc.loadPlans} plans, ${rc.loadDraws} draws there)`);
  t.ok(rc.apart >= 1 && rc.sameTask === 0, `what arrived is planned in a task of its own and drawn in a later one (${rc.apart} plans made apart, ${rc.sameTask} drawn in the plan's own task)`);
  t.note(`second script: ${rc.atReady} draws until it was in, ${rc.draws} draws and ${rc.plans} plans until the page was quiet (${rc.apart} of them made apart from a draw)`);
  t.eq(o2.errors(), [], 'no page errors there either');
  await o2.ctx.close(); await b.close();
};
