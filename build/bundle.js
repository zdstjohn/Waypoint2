/* Waypoint build: the source scripts become two minified files, and app.css becomes app.min.css and app2.css. app.js holds what the
   first screen needs; app2.js (LATER: Plan, drawing the street map, packing, the Prepare screen, the booking autopilot, place search, family, journal, the day bag,
   kids' corner, settings) is fetched by lib/later.js once
   the first screen is up. Sources stay where they are (lib/, screens/, data/); the order below is the dependency order.
     node build/bundle.js            -> trip/app.js, trip/app2.js, trip/app.min.css, trip/app2.css (+ .map files, kept local)
     node build/bundle.js --check    -> only report sizes */
const esbuild = require('esbuild'); const fs = require('fs'); const path = require('path');
const TRIP = path.resolve(__dirname, '..', 'trip');
const ORDER = [
  'data/data1.js', 'data/data2.js',
  'lib/validate.js', 'lib/core.js', 'lib/patch.js', 'lib/eat.js', 'lib/links.js', 'lib/errlog.js', 'lib/later.js', 'lib/classify.js', 'lib/photos.js', 'lib/places.js', 'lib/nightfood.js', 'lib/fx.js', 'lib/vtindex.js', 'lib/vtmap.js', 'lib/offline.js', 'lib/times.js', 'lib/holidays.js', 'lib/shape.js', 'lib/plan.js', 'lib/packing.js', 'lib/warm.js',
  'screens/setup.js', 'lib/sync.js', 'lib/bookcore.js', 'screens/book.js', 'lib/autopilot.js', 'lib/together.js', 'lib/route.js', 'lib/import.js', 'lib/prices.js', 'lib/watch.js', 'lib/search.js', 'lib/replan.js', 'lib/review.js',
  'screens/today.js', 'screens/family.js', 'screens/journal.js', 'lib/daybag.js', 'lib/storage.js', 'screens/kids.js', 'screens/travel.js', 'screens/flow.js', 'screens/settings.js', 'screens/trip.js'
];
const LATER = ['lib/import.js', 'screens/setup.js', 'lib/vtmap.js', 'lib/packing.js', 'lib/prices.js', 'lib/watch.js', 'screens/book.js', 'lib/autopilot.js', 'lib/together.js', 'lib/search.js', 'lib/replan.js', 'lib/review.js', 'screens/family.js', 'screens/journal.js', 'lib/daybag.js', 'lib/storage.js', 'screens/kids.js', 'screens/settings.js'];
module.exports.ORDER = ORDER; module.exports.LATER = LATER;

async function build() {
  /* the build time goes into the error log, so a report says which version it came from */
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  /* each module starts in its own try: one that throws while starting is reported (the error log, the console) and the
     rest of the app still starts, instead of everything after it silently missing */
  const guard = (f, code) => `try {\n${code}\n;} catch (e) { __wpFail(${JSON.stringify(f)}, e); }`;
  const FAIL = "function __wpFail(f, e) { (window.__wpBoot = window.__wpBoot || []).push(f); try { console.error('[boot] ' + f + ': ' + (e && e.message)); if (window.W && window.W.logError) window.W.logError(String(e && e.message || e), f + ' (start)', e && e.stack); } catch (x) {} }\n";
  /* in an offline copy the second script is inline and runs right after the first one's first draw: draw again, so a
     screen that was waiting for it (the check of the plan) appears */
  const AFTER = "\n;try { if (window.__WP_LATER && window.W && window.W.changed) { window.W.laterReady = true; window.W.changed(); } } catch (e) {}\n";
  const join = list => list.map(f => `/* --- ${f} --- */\n` + guard(f, fs.readFileSync(path.join(TRIP, f), 'utf8').replace('"__BUILD__"', JSON.stringify(stamp)))).join('\n;\n');
  const src = FAIL + join(ORDER.filter(f => !LATER.includes(f))), src2 = FAIL + join(LATER) + AFTER;
  const js = await esbuild.transform(src, { minify: true, target: 'es2017', charset: 'utf8', sourcefile: 'app.src.js', sourcemap: 'external', legalComments: 'none' });
  const js2 = await esbuild.transform(src2, { minify: true, target: 'es2017', charset: 'utf8', sourcefile: 'app2.src.js', sourcemap: 'external', legalComments: 'none' });
  fs.writeFileSync(path.join(TRIP, 'app.js'), js.code + '\n//# sourceMappingURL=app.js.map\n');
  fs.writeFileSync(path.join(TRIP, 'app.js.map'), js.map);
  fs.writeFileSync(path.join(TRIP, 'app2.js'), js2.code + '\n//# sourceMappingURL=app2.js.map\n');
  fs.writeFileSync(path.join(TRIP, 'app2.js.map'), js2.map);
  /* the stylesheet in two: app2.css carries what only the second script's screens use (see splitCss) */
  const first = ORDER.filter(f => !LATER.includes(f)).map(f => fs.readFileSync(path.join(TRIP, f), 'utf8')).join('\n') + fs.readFileSync(path.join(TRIP, 'index.html'), 'utf8');
  const parts = splitCss(fs.readFileSync(path.join(TRIP, 'app.css'), 'utf8'), first);
  const css = await esbuild.transform(parts.first, { loader: 'css', minify: true });   /* ASCII only: a stylesheet served without a charset would garble · and → */
  const css2 = await esbuild.transform(parts.later, { loader: 'css', minify: true });
  fs.writeFileSync(path.join(TRIP, 'app.min.css'), css.code);
  fs.writeFileSync(path.join(TRIP, 'app2.css'), css2.code);
  const kb = n => (n / 1024).toFixed(0) + ' KB';
  console.log(`app.js ${kb(src.length)} -> ${kb(js.code.length)} (+ app2.js ${kb(js2.code.length)} after the first screen); app.min.css ${kb(fs.statSync(path.join(TRIP, 'app.css')).size)} -> ${kb(css.code.length)} (+ app2.css ${kb(css2.code.length)}, ${parts.moved} rules)`);
}
/* The second script's screens (Plan, Prepare and packing, the journal and recap, settings, the kids' corner) have their
   own sections of app.css. A rule in one of those sections moves to app2.css, which comes with app2.js, only when none
   of its class names appears in the first script's code or index.html: whatever the first screen draws keeps its
   style in app.min.css. Rules keep their order; @media blocks are split rule by rule; @keyframes, @font-face and other
   at-rules stay. */
const LATER_CSS = [/^Setup\b/, /^Bookings\b/, /^journal, recap/, /^Trip settings\b/, /^pack and prepare\b/, /^prepare: segments\b/, /^the kids' corner\b/, /^Settings: stored files\b/, /^Claude: check my plan\b/];
function splitCss(text, firstSrc) {
  const used = new Set(firstSrc.match(/[A-Za-z][\w-]*/g));
  let first = '', later = '', moved = 0, section = '', i = 0;
  const heading = c => { const m = /^\/\*\s*(?:=+|-+)\s*(.*?)\s*(?:=+|-+)\s*\*\/$/.exec(c); return m ? m[1] : null; };
  const goes = sel => { if (!LATER_CSS.some(r => r.test(section))) return false; const cs = sel.match(/\.([A-Za-z][\w-]*)/g); return !!cs && cs.every(c => !used.has(c.slice(1))); };
  const block = (s, at) => { let d = 0; for (let j = at; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}' && --d === 0) return j; } throw new Error('unbalanced braces in app.css'); };
  while (i < text.length) {
    if (/\s/.test(text[i])) { first += text[i++]; continue; }
    if (text.startsWith('/*', i)) { const e = text.indexOf('*/', i) + 2; const c = text.slice(i, e), h = heading(c); if (h != null) section = h; first += c; i = e; continue; }
    const open = text.indexOf('{', i), semi = text.indexOf(';', i);
    if (text[i] === '@' && semi > -1 && (open < 0 || semi < open)) { first += text.slice(i, semi + 1); i = semi + 1; continue; }
    const close = block(text, open), head = text.slice(i, open), body = text.slice(open + 1, close);
    if (/^@media\b/.test(head.trim())) {
      /* split the rules inside */
      let a = '', b = ''; const re = /([^{}]+)\{([^{}]*)\}/g; let m;
      while ((m = re.exec(body))) { if (goes(m[1])) { b += m[0]; moved++; } else a += m[0]; }
      if (a.trim()) first += head + '{' + a + '}'; if (b.trim()) later += head + '{' + b + '}\n';
    } else if (head.trim()[0] !== '@' && goes(head)) { later += head.trim() + '{' + body + '}\n'; moved++; }
    else first += text.slice(i, close + 1);
    i = close + 1;
  }
  return { first, later, moved };
}
module.exports.splitCss = splitCss;
if (require.main === module) build().catch(e => { console.error(e.message); process.exit(1); });
module.exports.build = build;
