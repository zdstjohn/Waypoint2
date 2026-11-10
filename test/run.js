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
   --shard=k/n  one of n groups of suites balanced by time (GitHub runs three side by side) */
const { spawn, spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2); const flags = new Set(args.filter(a => a.startsWith('--'))); const pick = args.filter(a => !a.startsWith('--'));
const ALL = ['smoke', 'layout', 'planner', 'shape', 'flow', 'bookings', 'travel', 'claude', 'draw', 'look', 'airplane', 'standalone', 'cloud', 'tickets', 'holidays', 'firstview', 'together', 'nope', 'eat', 'money', 'menus', 'storage', 'pdf', 'simple', 'sync', 'photos', 'places', 'judge', 'perf', 'offline', 'packing', 'warm', 'focus', 'validate', 'types', 'a11y', 'fuzz', 'vitals', 'desktop', 'explore'].concat(flags.has('--shots') || flags.has('--update-baseline') ? ['visual'] : []);
let suites = pick.length ? pick : ALL;
/* --shard=k/n runs one of n groups, balanced by how long each suite takes (seconds, from the online runs; a suite not
   listed counts as 15): GitHub runs the three groups side by side. Every suite lands in exactly one group. */
const SECS = { simple: 25, smoke: 110, layout: 183, desktop: 166, a11y: 71, flow: 44, together: 37, fuzz: 30, firstview: 23, travel: 22, shape: 21, nope: 20,
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

(async () => {
  await require('../build/bundle.js').build();   /* the page loads app.js; build it from the sources first */
  spawnSync('node', [path.join(ROOT, 'build', 'standalone.js')], { stdio: 'ignore' });   /* and the installable version (dist/) from that */
  const server = await serverUp();
  const report = []; let failed = 0;
  for (const name of suites) {
    const file = path.join(__dirname, 'suites', name + '.js');
    if (!fs.existsSync(file)) { report.push([name, 'missing', ['no such suite']]); failed++; continue; }
    const t0 = Date.now(); const checks = []; const fails = [];
    const t = {
      ok: (cond, what) => { checks.push(what); if (!cond) fails.push(what); return !!cond; },
      eq: (a, b, what) => { const c = JSON.stringify(a) === JSON.stringify(b); checks.push(what); if (!c) fails.push(`${what}: got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`); return c; },
      note: s => checks.push('(note) ' + s), flags, out: OUT, root: ROOT,
      shot: async (pg, name) => { try { await pg.screenshot({ path: path.join(OUT, name + '.png') }); } catch (e) { } },
    };
    try { await require(file).run(t); } catch (e) { fails.push('crashed: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' ')); }
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    report.push([name, fails.length ? 'FAIL' : 'ok', fails, checks.length, secs]); if (fails.length) failed++;
    const notes = checks.filter(c => c.startsWith('(note) ')).map(c => c.slice(7));
    console.log(`${fails.length ? '✗' : '✓'} ${name.padEnd(9)} ${String(checks.length).padStart(3)} checks  ${secs}s` + (fails.length ? '\n    ' + fails.join('\n    ') : '') + (notes.length ? '\n    ' + notes.join('\n    ') : ''));
  }
  if (server) server.kill();
  console.log(failed ? `\n${failed} suite(s) failed` : '\nall suites passed');
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  process.exit(failed ? 1 : 0);
})();
