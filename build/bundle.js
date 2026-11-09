/* Waypoint build: the source scripts become two minified files, and app.css becomes app.min.css. app.js holds what the
   first screen needs; app2.js (LATER: packing, the Prepare screen, the booking autopilot, place search, family, journal,
   kids' corner, settings) is fetched by lib/later.js once
   the first screen is up. Sources stay where they are (lib/, screens/, data/); the order below is the dependency order.
     node build/bundle.js            -> trip/app.js, trip/app.min.css (+ app.js.map, kept local)
     node build/bundle.js --check    -> only report sizes */
const esbuild = require('esbuild'); const fs = require('fs'); const path = require('path');
const TRIP = path.resolve(__dirname, '..', 'trip');
const ORDER = [
  'data/data1.js', 'data/data2.js',
  'lib/validate.js', 'lib/core.js', 'lib/errlog.js', 'lib/later.js', 'lib/classify.js', 'lib/photos.js', 'lib/places.js', 'lib/fx.js', 'lib/vtmap.js', 'lib/offline.js', 'lib/times.js', 'lib/shape.js', 'lib/plan.js', 'lib/packing.js', 'lib/warm.js',
  'screens/setup.js', 'lib/sync.js', 'lib/bookcore.js', 'screens/book.js', 'lib/autopilot.js', 'lib/route.js', 'lib/import.js', 'lib/prices.js', 'lib/watch.js', 'lib/search.js',
  'screens/today.js', 'screens/family.js', 'screens/journal.js', 'screens/kids.js', 'screens/travel.js', 'screens/flow.js', 'screens/settings.js', 'screens/trip.js'
];
const LATER = ['lib/packing.js', 'screens/book.js', 'lib/autopilot.js', 'lib/search.js', 'screens/family.js', 'screens/journal.js', 'screens/kids.js', 'screens/settings.js'];
module.exports.ORDER = ORDER; module.exports.LATER = LATER;

async function build() {
  /* the build time goes into the error log, so a report says which version it came from */
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  /* each module starts in its own try: one that throws while starting is reported (the error log, the console) and the
     rest of the app still starts, instead of everything after it silently missing */
  const guard = (f, code) => `try {\n${code}\n;} catch (e) { __wpFail(${JSON.stringify(f)}, e); }`;
  const FAIL = "function __wpFail(f, e) { (window.__wpBoot = window.__wpBoot || []).push(f); try { console.error('[boot] ' + f + ': ' + (e && e.message)); if (window.W && window.W.logError) window.W.logError(String(e && e.message || e), f + ' (start)', e && e.stack); } catch (x) {} }\n";
  const join = list => list.map(f => `/* --- ${f} --- */\n` + guard(f, fs.readFileSync(path.join(TRIP, f), 'utf8').replace('"__BUILD__"', JSON.stringify(stamp)))).join('\n;\n');
  const src = FAIL + join(ORDER.filter(f => !LATER.includes(f))), src2 = FAIL + join(LATER);
  const js = await esbuild.transform(src, { minify: true, target: 'es2017', charset: 'utf8', sourcefile: 'app.src.js', sourcemap: 'external', legalComments: 'none' });
  const js2 = await esbuild.transform(src2, { minify: true, target: 'es2017', charset: 'utf8', sourcefile: 'app2.src.js', sourcemap: 'external', legalComments: 'none' });
  fs.writeFileSync(path.join(TRIP, 'app.js'), js.code + '\n//# sourceMappingURL=app.js.map\n');
  fs.writeFileSync(path.join(TRIP, 'app.js.map'), js.map);
  fs.writeFileSync(path.join(TRIP, 'app2.js'), js2.code + '\n//# sourceMappingURL=app2.js.map\n');
  fs.writeFileSync(path.join(TRIP, 'app2.js.map'), js2.map);
  const css = await esbuild.transform(fs.readFileSync(path.join(TRIP, 'app.css'), 'utf8'), { loader: 'css', minify: true });   /* ASCII only: a stylesheet served without a charset would garble · and → */
  fs.writeFileSync(path.join(TRIP, 'app.min.css'), css.code);
  const kb = n => (n / 1024).toFixed(0) + ' KB';
  console.log(`app.js ${kb(src.length)} -> ${kb(js.code.length)} (+ app2.js ${kb(js2.code.length)} after the first screen); app.min.css ${kb(fs.statSync(path.join(TRIP, 'app.css')).size)} -> ${kb(css.code.length)}`);
}
if (require.main === module) build().catch(e => { console.error(e.message); process.exit(1); });
module.exports.build = build;
