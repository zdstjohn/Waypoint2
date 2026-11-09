/* Waypoint build: the 28 source scripts become one minified app.js, and app.css becomes app.min.css, so the page
   makes two requests instead of thirty. Sources stay where they are (lib/, screens/, data/); the script order below
   is the dependency order, the same one index.html used to list.
     node build/bundle.js            -> trip/app.js, trip/app.min.css (+ app.js.map, kept local)
     node build/bundle.js --check    -> only report sizes */
const esbuild = require('esbuild'); const fs = require('fs'); const path = require('path');
const TRIP = path.resolve(__dirname, '..', 'trip');
const ORDER = [
  'data/data1.js', 'data/data2.js',
  'lib/validate.js', 'lib/core.js', 'lib/classify.js', 'lib/photos.js', 'lib/places.js', 'lib/map.js', 'lib/fx.js', 'lib/vtmap.js', 'lib/offline.js', 'lib/times.js', 'lib/shape.js', 'lib/plan.js', 'lib/packing.js', 'lib/warm.js',
  'screens/setup.js', 'lib/sync.js', 'screens/book.js', 'lib/autopilot.js', 'lib/route.js', 'lib/import.js', 'lib/prices.js', 'lib/watch.js',
  'screens/today.js', 'screens/family.js', 'screens/journal.js', 'screens/kids.js', 'screens/travel.js', 'screens/flow.js', 'screens/settings.js', 'screens/trip.js'
];
module.exports.ORDER = ORDER;

async function build() {
  const src = ORDER.map(f => `/* --- ${f} --- */\n` + fs.readFileSync(path.join(TRIP, f), 'utf8')).join('\n;\n');
  const js = await esbuild.transform(src, { minify: true, target: 'es2017', charset: 'utf8', sourcefile: 'app.src.js', sourcemap: 'external', legalComments: 'none' });
  fs.writeFileSync(path.join(TRIP, 'app.js'), js.code + '\n//# sourceMappingURL=app.js.map\n');
  fs.writeFileSync(path.join(TRIP, 'app.js.map'), js.map);
  const css = await esbuild.transform(fs.readFileSync(path.join(TRIP, 'app.css'), 'utf8'), { loader: 'css', minify: true });   /* ASCII only: a stylesheet served without a charset would garble · and → */
  fs.writeFileSync(path.join(TRIP, 'app.min.css'), css.code);
  const kb = n => (n / 1024).toFixed(0) + ' KB';
  console.log(`app.js ${kb(src.length)} -> ${kb(js.code.length)}; app.min.css ${kb(fs.statSync(path.join(TRIP, 'app.css')).size)} -> ${kb(css.code.length)}`);
}
if (require.main === module) build().catch(e => { console.error(e.message); process.exit(1); });
module.exports.build = build;
