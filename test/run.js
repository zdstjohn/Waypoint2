#!/usr/bin/env node
/* Waypoint's test suite. One command runs everything:   node test/run.js [suite ...] [--update-baseline] [--shots]

   Suites (test/suites/*.js) each export async function run(t): they open the app against the mocked Claude runtime and make
   assertions with t.ok / t.eq. The runner starts the CSP test server, runs the suites in order, prints one report and exits
   non-zero on any failure. Screenshots of failures land in test/out/.

   smoke     every screen renders, on a narrow phone, in dark mode and on a wide screen, without errors
   layout    nothing clipped, cut off, off screen or overlapping, at normal and large text sizes
   planner   days fit the clock, meals and naps are where they should be, day trips are day trips, energy levels are sane
   shape     the whole-trip planner: nights per base, day trips instead of hotel moves, order, jet lag, trains vs flights
   flow      the actions sheet, move to another day and undo, leave free and undo, swap cards, glance, quick start
   early     a tap made before the second script has arrived is kept and done when it comes
   bookings  the checklist, the budget, adding a booking by hand
   travel    Travel mode, Today, the storybook
   sync      saved trips: the menu, renaming, a second trip
   photos    which photo a place gets: exact names, variant names of sights, never for places to eat, city found by name
   judge     the photo finder's judge against photos labelled by eye (python)
   focus     Must-sees / Best of both / Hidden gems: which places the days get, reviews, tags, requests
   validate  the one door for Claude's answers: bad names dropped, far-off and 0,0 pins cleared, enums and links checked
   types     TypeScript checks the plain JavaScript against types/waypoint.d.ts (base for all, strictNullChecks for the listed files)
   a11y      axe-core over every screen, light and dark: no WCAG A/AA violations
   fuzz      hundreds of random trips (seeded) checked against the planner's promises; FUZZ=2000 for more, FUZZ_SEED=n replays one
   explore   search any place (list, Mapbox, Claude) and add it; today's route and Google Maps; free time; ideas by nearness
   desktop   a mouse, from a 600 px side panel to a 1920 px monitor: every screen clean, every stay, tab and arrow reachable
   vitals    a mid-range phone (4x slower CPU, slow 4G): first paint, largest paint, layout shift, and every common tap under 200 ms
   warm      names used everywhere, the banner's greeting and sky, postcards, milestones, the kids' view, readiness,
             moods and the highlight reel, a year later
   nope      "Not for us" and the day bag (with the screen kept on)
   eat       food needs (Plan, step 3): asked for with every restaurant list, places checked, poor fits never planned
   money     Prices in: one currency for every cost (converted at the ECB's rates, marked ≈) or each as listed
   menus     the nightly places to eat join the lists; a meal's panel shows its menu (dishes, prices, kids), sourced and dated
   pdf       the Take along PDF: each stop kept whole on one page, no half-empty pages, links to Google Maps
   storage   Settings > Storage: unused files found, shown, deleted only on confirmation, never anything in use
   visual    screenshots against test/base (only with --shots; --update-baseline rewrites the baseline). Changes to the
             screens listed in test/screens-expected.txt are expected (--expect, or SCREENS_EXPECT=<file> as GitHub sets
             it when the commit changed that file); any other changed screen fails. SHOT_SIZES=n,big,dark,wide,desk takes
             only those sizes (GitHub runs each size side by side)
   --shard=k/n  one of n groups of suites balanced by time (GitHub runs three side by side)
   --jobs=n     how many suites run at once (JOBS=n too; 3 by default, 1 on GitHub, where the shards are the side by side).
                The build and the test server are shared; each suite runs in a process of its own, the longest first.
                The suites that time things (perf, vitals) run alone afterwards, and a suite that fails while others
                were running is run once more alone: only a failure on its own counts (the report says "on a second
                run, alone" when that happened, and the last line names every suite that needed it)
   --cov        also measure which code the suites run: test/out/coverage.md lists every source file with the share of
                its built code that ran, and the longest stretches no test runs (perf and vitals are left out) */
const { spawn, spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2); const flags = new Set(args.filter(a => a.startsWith('--'))); const pick = args.filter(a => !a.startsWith('--'));
const ALL = ['smoke', 'layout', 'planner', 'shape', 'flow', 'back', 'review', 'bookings', 'stays', 'travel', 'claude', 'draw', 'look', 'airplane', 'standalone', 'cloud', 'accounts', 'tickets', 'holidays', 'firstview', 'together', 'share', 'kept', 'copy', 'tools', 'nope', 'eat', 'money', 'menus', 'storage', 'pdf', 'simple', 'sync', 'photos', 'places', 'judge', 'perf', 'offline', 'packing', 'warm', 'focus', 'validate', 'types', 'a11y', 'fuzz', 'vitals', 'desktop', 'explore', 'gmaps', 'meals', 'clock', 'daytrip', 'workspace', 'early', 'menuread', 'ideaorder'].concat(flags.has('--shots') || flags.has('--update-baseline') ? ['visual'] : []);
let suites = pick.length ? pick : ALL;
/* --cov: also collect which code ran (test/lib/cov.js); the suites that time things are left out of such a run */
const COV = flags.has('--cov') || !!process.env.WP_COV;
if (flags.has('--cov')) { process.env.WP_COV = '1'; suites = suites.filter(s => !['perf', 'vitals', 'visual'].includes(s)); }
/* --shard=k/n runs one of n groups, balanced by how long each suite takes (seconds, from the online runs; a suite not
   listed counts as 15): GitHub runs the three groups side by side. Every suite lands in exactly one group. */
const SECS = { simple: 25, smoke: 110, layout: 183, desktop: 166, a11y: 71, flow: 44, together: 37, share: 40, kept: 30, copy: 20, tools: 5, fuzz: 30, firstview: 23, travel: 22, shape: 21, nope: 20,
  warm: 19, vitals: 19, planner: 17, bookings: 17, packing: 16, storage: 15, offline: 15, explore: 14, perf: 14, sync: 12, places: 11, tickets: 10,
  focus: 9, holidays: 7, photos: 7, types: 4, validate: 2, judge: 1, pdf: 10, eat: 20, money: 12, menus: 12 };
const shard = [...flags].map(f => /^--shard=(\d+)\/(\d+)$/.exec(f)).find(Boolean);
if (shard) {
  const k = +shard[1], n = +shard[2], bins = Array.from({ length: n }, () => ({ t: 0, s: new Set() }));
  [...suites].sort((a, b) => (SECS[b] || 15) - (SECS[a] || 15) || (a < b ? -1 : 1)).forEach(s => { const bin = bins.reduce((m, x) => x.t < m.t ? x : m); bin.s.add(s); bin.t += SECS[s] || 15; });
  suites = suites.filter(s => bins[k - 1].s.has(s));
  console.log(`shard ${k}/${n}: ${suites.join(', ')} (about ${Math.round(bins[k - 1].t / 60)} min)`);
}

async function serverUp() {
  const http = require('http');
  const ok = await new Promise(r => http.get('http://127.0.0.1:8771/index.html', res => r(res.statusCode === 200)).on('error', () => r(false)));
  if (ok) return null;
  const p = spawn('python3', ['csp_server.py', '8771', 'self'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 250)); if (await new Promise(r => http.get('http://127.0.0.1:8771/index.html', res => r(res.statusCode === 200)).on('error', () => r(false)))) return p; }
  throw new Error('test server did not start');
}

/* one suite, in this process */
async function runSuite(name) {
  const file = path.join(__dirname, 'suites', name + '.js');
  if (!fs.existsSync(file)) return [name, 'missing', ['no such suite'], 0, '0', []];
  const t0 = Date.now(); const checks = []; const fails = [];
  const t = {
    ok: (cond, what) => { checks.push(what); if (!cond) fails.push(what); return !!cond; },
    eq: (a, b, what) => { const c = JSON.stringify(a) === JSON.stringify(b); checks.push(what); if (!c) fails.push(`${what}: got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`); return c; },
    note: s => checks.push('(note) ' + s), flags, out: OUT, root: ROOT,
    shot: async (pg, name) => { try { await pg.screenshot({ path: path.join(OUT, name + '.png') }); } catch (e) { } },
  };
  try { await require(file).run(t); } catch (e) { fails.push('crashed: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' ')); }
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  return [name, fails.length ? 'FAIL' : 'ok', fails, checks.length, secs, checks.filter(c => c.startsWith('(note) ')).map(c => c.slice(7))];
}
const line = r => `${r[1] === 'ok' ? '✓' : '✗'} ${r[0].padEnd(9)} ${String(r[3]).padStart(3)} checks  ${r[4]}s` + (r[2].length ? '\n    ' + r[2].join('\n    ') : '') + (r[5] && r[5].length ? '\n    ' + r[5].join('\n    ') : '');

/* --child=<suite>: what the parent starts for each suite. The build and the server are the parent's; the result goes
   to a file the parent reads */
const child = [...flags].map(f => /^--child=(.+)$/.exec(f)).find(Boolean);
if (child) {
  flags.delete(child[0]);
  runSuite(child[1]).then(r => { try { require('./lib/cov').save(child[1]); } catch (e) { } fs.writeFileSync(path.join(OUT, '.res-' + child[1] + '.json'), JSON.stringify(r)); process.exit(r[1] === 'ok' ? 0 : 1); });
} else (async () => {
  await require('../build/bundle.js').build();   /* the page loads app.js; build it from the sources first */
  spawnSync('node', [path.join(ROOT, 'build', 'standalone.js')], { stdio: 'ignore' });   /* and the installable version (dist/) from that */
  const server = await serverUp();
  const jf = [...flags].map(f => /^--jobs=(\d+)$/.exec(f)).find(Boolean);
  const jobs = Math.max(1, Math.min(8, jf ? +jf[1] : +process.env.JOBS || (process.env.CI ? 1 : 3)));
  const results = {}; const started = Date.now(), rerun = [];
  if (COV) require('./lib/cov').clear();
  if (jobs === 1 || suites.length === 1) {
    for (const name of suites) { const r = await runSuite(name); results[name] = r; console.log(line(r)); if (COV) require('./lib/cov').save(name); }
  } else {
    /* a suite in a process of its own */
    const one = name => new Promise(done => {
      const rf = path.join(OUT, '.res-' + name + '.json'); try { fs.unlinkSync(rf); } catch (e) { }
      const p = spawn(process.execPath, [__filename, '--child=' + name, ...[...flags].filter(f => !/^--(jobs|shard)=/.test(f))], { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'], env: process.env });
      let err = ''; p.stderr.on('data', d => { err = (err + d).slice(-600); });
      p.on('close', () => { let r; try { r = JSON.parse(fs.readFileSync(rf, 'utf8')); fs.unlinkSync(rf); } catch (e) { r = [name, 'FAIL', ['crashed: the suite stopped without a result. ' + err.trim().split('\n').slice(-3).join(' ')], 0, '0', []]; } done(r); });
    });
    /* the ones that measure time wait until the others are done, so nothing else is using the machine */
    const ALONE = new Set(['perf', 'vitals']);
    const queue = suites.filter(s => !ALONE.has(s)).sort((a, b) => (SECS[b] || 15) - (SECS[a] || 15)), again = [];
    await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      for (let name; (name = queue.shift());) { const r = await one(name); results[name] = r; if (r[1] === 'ok') console.log(line(r)); else again.push(name); }
    }));
    /* failed while others were running: once more, alone. Only that result counts */
    for (const name of again) {
      const first = results[name], r = await one(name);
      if (r[1] === 'ok') { rerun.push(name); r[5] = (r[5] || []).concat('passed on a second run, alone (with others running: ' + String(first[2][0] || '').slice(0, 160) + ')'); }
      results[name] = r; console.log(line(r));
    }
    for (const name of suites.filter(s => ALONE.has(s))) { const r = await one(name); results[name] = r; console.log(line(r)); }
  }
  if (server) server.kill();
  const report = suites.map(n => results[n]), failed = report.filter(r => r[1] !== 'ok').length;
  const took = Math.round((Date.now() - started) / 1000);
  console.log((failed ? `\n${failed} suite(s) failed: ${report.filter(r => r[1] !== 'ok').map(r => r[0]).join(', ')}` : '\nall suites passed') + ` (${suites.length} suites, ${Math.floor(took / 60)} min ${took % 60} s${jobs > 1 && suites.length > 1 ? ', ' + jobs + ' at a time' : ''}${rerun.length ? '; passed only on a second run, alone: ' + rerun.join(', ') : ''})`);
  /* a suite that needed its second run is flaky: the last line names it, and the names are kept for the report */
  if (COV) { const c = require('./lib/cov').report(); console.log(`coverage: ${Math.round(c.all * 100)}% of the app's built code ran in ${c.measured.length} suites (least: ${c.rows.slice(0, 4).map(x => x.f + ' ' + Math.round(x.pct * 100) + '%').join(', ')}); details in test/out/coverage.md`); }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report.map(r => r.slice(0, 5)), null, 1));
  process.exit(failed ? 1 : 0);
})();
