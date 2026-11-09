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
   warm      names used everywhere, the banner's greeting and sky, postcards, milestones, the kids' view, readiness,
             moods and the highlight reel, a year later
   visual    screenshots against test/base (only with --shots; --update-baseline rewrites the baseline) */
const { spawn, spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2); const flags = new Set(args.filter(a => a.startsWith('--'))); const pick = args.filter(a => !a.startsWith('--'));
const ALL = ['smoke', 'layout', 'planner', 'shape', 'flow', 'bookings', 'travel', 'sync', 'photos', 'places', 'judge', 'perf', 'offline', 'packing', 'warm', 'focus', 'validate', 'types', 'a11y'].concat(flags.has('--shots') || flags.has('--update-baseline') ? ['visual'] : []);
const suites = pick.length ? pick : ALL;

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
