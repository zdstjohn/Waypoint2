#!/usr/bin/env node
/* Waypoint's test suite. One command runs everything:   node test/run.js [suite ...] [--update-baseline] [--shots]

   Suites (test/suites/*.js) each export async function run(t): they open the app against the mocked Claude runtime and make
   assertions with t.ok / t.eq. The runner starts the CSP test server, runs the suites in order, prints one report and exits
   non-zero on any failure. Screenshots of failures land in test/out/.

   layout    every screen draws (one view, with content, no page error; was smoke) and nothing is clipped, cut off,
             off screen or overlapping, at normal and large text sizes
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
   keys      the keyboard and the screen reader: focus kept across redraws, sheets take, keep and give back the keyboard,
             Escape, arrow keys in tabs, names read apart, live messages, and text that grows with the text size
   fuzz      hundreds of random trips (seeded), with their places, journeys, hand picks and bookings, read by the owner's nine
             rules as code (trip/lib/rules.js W.checkPlan); FUZZ=2000 for more, FUZZ_SEED=n replays one (FUZZ_DUMP=1 prints its plan)
   devices   2-4 devices on one trip (seeded): edits, undos, lost signals, the app closed and opened, saves in any order;
             every device and the account end with the same trip, each thing at its latest change; SYNC=2000, SYNC_SEED=n
   explore   search any place (list, Google Maps, Claude) and add it; today's route and Google Maps; free time; ideas by nearness
   desktop   a mouse, from a 600 px side panel to a 1920 px monitor: every screen clean, every stay, tab and arrow reachable
   vitals    a mid-range phone (4x slower CPU, slow 4G): first paint, largest paint, layout shift, and every common tap under 200 ms
   warm      names used everywhere, the banner's greeting and sky, postcards, milestones, the kids' view, readiness,
             moods and the highlight reel, a year later
   nope      "Not for us" and the day bag (with the screen kept on)
   dayout    a day out under one band (its open parts one row, the nap on the go, the map of where you go), a rest day's
             cards, and tomorrow's banner on Today (v193)
   route     the day's route along the streets: the walk between two pins from the map pack's own streets, drawn on the map (v197)
   late      a trip shows the same facts whether Claude's answers come at once or late and out of order (v199)
   exacttimes the clock values a family acts on, to the minute: the toddler's nap (start, 90 minutes, over by 5:30, none from a late
             lunch), "Leave by" for lunch and dinner, Today's "Leave in / Leave by" for the next stop, tomorrow's "leave by"
             (a booked ticket) against "leave about" (v201)
   watch     the price watch: what counts as a drop (3%, at least 10, one currency), Book ahead's banner and list, a re-check,
             starting and stopping a watch, a trip you only view (v201)
   importplan importing an itinerary: Claude's answer full of mistakes becomes a clean trip, to the key (pins, slots, days, ages,
             stays), and the messages for too little text, no places, a busy Claude (v201)
   rescue    rescuing the day: "tired" keeps one easy outing and frees the rest, booked and started stops stay, Undo; what Claude
             is told by "say what's going on" and how its answer is checked (v201)
   napcards  Today's nap and rest cards to the minute, with and without a stay picked, on a day out, on a rest day (v201)
   citylibrace the city library read slower than the screen: used within its 2.5 s wait, Claude asked after it, nothing filled twice (v201)
   photopack a city's photos in one file: made and read back, shown from it, an offline save from it, a library city saved before a trip (v198)
   world     the world library: a city's checked hours, entry rules, pins and walks laid over its lists (v196)
   storage   Settings > Storage: how full the photos' and maps' file store is, and removing the files nothing uses (v195)
   eat       food needs (Plan, step 3): asked for with every restaurant list, places checked, poor fits never planned
   money     Prices in: one currency for every cost (converted at the ECB's rates, marked ≈) or each as listed
   menus     the nightly places to eat join the lists; a meal's panel shows its menu (dishes, prices, kids), sourced and dated
   pdf       the Take along PDF: each stop kept whole on one page, no half-empty pages, links to Google Maps
   packs     street-map packs made town centre first: read as they arrive, the first screen's tiles before the rest, old packs as before
   visual    screenshots against test/base (only with --shots; --update-baseline rewrites the baseline). Changes to the
             screens listed in test/screens-expected.txt are expected (--expect, or SCREENS_EXPECT=<file> as GitHub sets
             it when the commit changed that file); any other changed screen fails. SHOT_SIZES=n,big,dark,wide,desk takes
             only those sizes (GitHub runs each size side by side)
   firstpaint  the first paint is the same with the stylesheet in one piece as split in two (app.min.css + app2.css, build/bundle.js
             splitCss): each first screen, with the second script and stylesheet held back, at 390 px light and dark and 820 px
   same      what is drawn, exactly: every screen at every size, its markup and every element's box and computed styles,
             against test/base-same (written when there is none, or by `same --update-baseline` from a build that is
             known good); no tolerance. A change to how the app is split into files must leave it identical
   --shard=k/n  one of n groups of suites balanced by time (GitHub runs three side by side)
   --jobs=n     how many suites run at once (JOBS=n too; 3 by default, 1 on GitHub, where the shards are the side by side).
                The build and the test server are shared; each suite runs in a process of its own, the longest first.
                The suites that time things (perf, vitals) run alone afterwards, and a suite that fails while others
                were running is run once more alone: only a failure on its own counts. A suite that passes only on that
                second run is a WARNING, not a quiet pass: its line is marked ⚠ with the first failure's message, the
                summary lists every such suite with that message, and test/out/report.json carries it as the sixth
                entry of the suite's row (null for a suite that passed first time). It does not fail the run: fix the flake
   --cov        also measure which code the suites run: test/out/coverage.md lists every source file with the share of
                its built code that ran, and the longest stretches no test runs (perf and vitals are left out) */
const { spawn, spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PORT = +process.env.WP_PORT || 8771; /* (a second copy of the app can test beside this one on another port) */ const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2); const flags = new Set(args.filter(a => a.startsWith('--'))); const pick = args.filter(a => !a.startsWith('--'));
const ALL = ['bugs', 'flight', 'layout', 'planner', 'shape', 'flow', 'dayout', 'back', 'review', 'bookings', 'stays', 'travel', 'claude', 'draw', 'look', 'airplane', 'standalone', 'swphotos', 'ahead', 'cloud', 'accounts', 'tickets', 'holidays', 'firstview', 'together', 'share', 'kept', 'copy', 'tools', 'nope', 'eat', 'money', 'menus', 'pdf', 'simple', 'sync', 'photos', 'places', 'judge', 'perf', 'offline', 'packing', 'warm', 'focus', 'validate', 'types', 'a11y', 'keys', 'fuzz', 'vitals', 'desktop', 'explore', 'gmaps', 'meals', 'clock', 'daytrip', 'workspace', 'early', 'menuread', 'ideaorder', 'bookcheck', 'brief', 'stillopen', 'packs', 'photoset', 'banner', 'theme', 'phoneday', 'devices', 'nokids', 'citylib', 'names', 'storage', 'world', 'route', 'photopack', 'late', 'firstpaint', 'exacttimes', 'watch', 'importplan', 'rescue', 'napcards', 'citylibrace', 'same'].concat(flags.has('--shots') || flags.has('--update-baseline') ? ['visual'] : []);
let suites = pick.length ? pick : ALL;
/* --cov: also collect which code ran (test/lib/cov.js); the suites that time things are left out of such a run */
const COV = flags.has('--cov') || !!process.env.WP_COV;
if (flags.has('--cov')) { process.env.WP_COV = '1'; suites = suites.filter(s => !['perf', 'vitals', 'visual', 'same'].includes(s)); }
/* --shard=k/n runs one of n groups, balanced by how long each suite takes (seconds, measured in v201 with two suites at a time on a busy machine,
   so a little long; a suite not listed counts as 15): GitHub runs the three groups side by side. Every suite lands in exactly one group. */
const SECS = {
  same: 450, fuzz: 185, layout: 168, desktop: 156, ahead: 138, keys: 117, flight: 103, a11y: 78, flow: 78, travel: 62, cloud: 54, late: 54,
  gmaps: 52, claude: 47, tickets: 47, citylib: 46, banner: 42, photoset: 42, types: 41, bookings: 39, citylibrace: 39, workspace: 38, back: 35,
  eat: 35, nope: 34, airplane: 33, packs: 33, storage: 33, devices: 32, share: 32, photopack: 31, route: 31, together: 31, world: 28, look: 27,
  kept: 26, clock: 25, firstview: 25, menuread: 24, money: 24, theme: 24, daytrip: 23, meals: 23, offline: 22, early: 20, explore: 20, phoneday: 20,
  warm: 20, nokids: 19, simple: 19, vitals: 19, watch: 18, copy: 17, focus: 17, photos: 16, review: 16, shape: 16, sync: 16, draw: 15, pdf: 15,
  planner: 15, stays: 15, importplan: 14, names: 14, perf: 14, dayout: 13, menus: 13, napcards: 13, standalone: 13, brief: 12, exacttimes: 12,
  places: 12, packing: 11, rescue: 11, validate: 11, stillopen: 10, swphotos: 10, bookcheck: 9, ideaorder: 9, holidays: 7, tools: 4, judge: 2 };
const shard = [...flags].map(f => /^--shard=(\d+)\/(\d+)$/.exec(f)).find(Boolean);
if (shard) {
  const k = +shard[1], n = +shard[2], bins = Array.from({ length: n }, () => ({ t: 0, s: new Set() }));
  [...suites].sort((a, b) => (SECS[b] || 15) - (SECS[a] || 15) || (a < b ? -1 : 1)).forEach(s => { const bin = bins.reduce((m, x) => x.t < m.t ? x : m); bin.s.add(s); bin.t += SECS[s] || 15; });
  suites = suites.filter(s => bins[k - 1].s.has(s));
  console.log(`shard ${k}/${n}: ${suites.join(', ')} (about ${Math.round(bins[k - 1].t / 60)} min)`);
}

async function serverUp() {
  const http = require('http');
  const ok = await new Promise(r => http.get('http://127.0.0.1:' + PORT + '/index.html', res => r(res.statusCode === 200)).on('error', () => r(false)));
  if (ok) return null;
  const p = spawn('python3', ['csp_server.py', String(PORT), 'self'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 250)); if (await new Promise(r => http.get('http://127.0.0.1:' + PORT + '/index.html', res => r(res.statusCode === 200)).on('error', () => r(false)))) return p; }
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
const line = r => `${r[1] !== 'ok' ? '✗' : r[6] ? '⚠' : '✓'} ${r[0].padEnd(9)} ${String(r[3]).padStart(3)} checks  ${r[4]}s` + (r[2].length ? '\n    ' + r[2].join('\n    ') : '') + (r[5] && r[5].length ? '\n    ' + r[5].join('\n    ') : '');

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
      /* passed alone: a warning, not a quiet pass. The first failure's message goes with it, in the console and in report.json (r[6]) */
      if (r[1] === 'ok') { const msg = String(first[2][0] || '(no message)').replace(/\s+/g, ' ').slice(0, 400); r[6] = 'passed only on a second run, alone. First failure (' + first[2].length + ' in all): ' + msg; rerun.push(name); r[5] = (r[5] || []).concat('WARNING: ' + r[6]); }
      results[name] = r; console.log(line(r));
    }
    for (const name of suites.filter(s => ALONE.has(s))) { const r = await one(name); results[name] = r; console.log(line(r)); }
  }
  if (server) server.kill();
  const report = suites.map(n => results[n]), failed = report.filter(r => r[1] !== 'ok').length;
  const took = Math.round((Date.now() - started) / 1000);
  console.log((failed ? `\n${failed} suite(s) failed: ${report.filter(r => r[1] !== 'ok').map(r => r[0]).join(', ')}` : '\nall suites passed' + (rerun.length ? ' (with warnings)' : '')) + ` (${suites.length} suites, ${Math.floor(took / 60)} min ${took % 60} s${jobs > 1 && suites.length > 1 ? ', ' + jobs + ' at a time' : ''}${rerun.length ? '; passed only on a second run, alone: ' + rerun.join(', ') : ''})`);
  /* a suite that needed its second run is flaky: each is listed again here with its first failure, so a quiet pass cannot hide it */
  if (rerun.length) console.log(`\n⚠ WARNING: ${rerun.length} suite(s) passed only on a second run, alone (flaky):\n` + rerun.map(n => `  ${n}: ${results[n][6].replace(/^passed only on a second run, alone\. /, '')}`).join('\n'));
  if (COV) { const c = require('./lib/cov').report(); console.log(`coverage: ${Math.round(c.all * 100)}% of the app's built code ran in ${c.measured.length} suites (least: ${c.rows.slice(0, 4).map(x => x.f + ' ' + Math.round(x.pct * 100) + '%').join(', ')}); details in test/out/coverage.md`); }
  /* a row: [name, 'ok' | 'FAIL', failures, checks, seconds, warning]; the warning is null, or says the suite passed only on its second run and why the first failed */
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report.map(r => r.slice(0, 5).concat([r[6] || null])), null, 1));
  process.exit(failed ? 1 : 0);
})();
