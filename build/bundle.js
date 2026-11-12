/* Waypoint build: the source scripts become two minified files, and app.css becomes app.min.css and app2.css. app.js holds what the
   first screen needs; app2.js (LATER: Plan, drawing the street map, packing, the Prepare screen, the booking autopilot, place search, family, journal, the day bag,
   kids' corner, settings) is fetched by lib/later.js once
   the first screen is up. Sources stay where they are (lib/, screens/, data/); the order below is the dependency order.
     node build/bundle.js            -> trip/app.js, trip/app2.js, trip/app.min.css, trip/app2.css (+ .map files, kept local)
     node build/bundle.js --check    -> build in memory, run the checks below and report sizes; write nothing
   Checks (a failed one stops the build): every file of the second script is in ORDER, and the second script is joined
   in ORDER's order (one list decides the order of both); no style rule that moves to app2.css would win over a later
   rule that stays in app.min.css (app2.css loads last, so the move would turn the cascade round: v148's .nr-b). */
const esbuild = require('esbuild'); const fs = require('fs'); const path = require('path');
const TRIP = path.resolve(__dirname, '..', 'trip');
const ORDER = [
  'data/data1.js', 'data/data2.js',
  'lib/validate.js', 'lib/core.js', 'lib/ideastore.js', 'lib/towns.js', 'lib/ideas.js', 'lib/stays.js', 'lib/asks.js', 'lib/icons.js', 'lib/patch.js', 'lib/eat.js', 'lib/links.js', 'lib/errlog.js', 'lib/later.js', 'lib/pwa.js', 'lib/back.js', 'lib/classify.js', 'lib/photos.js', 'lib/places.js', 'lib/nightfood.js', 'lib/fx.js', 'lib/vtindex.js', 'lib/vtmap.js', 'lib/offline.js', 'lib/offcopy.js', 'lib/speedtest.js', 'lib/times.js', 'lib/holidays.js', 'lib/shape.js', 'lib/plan.js', 'lib/packing.js', 'lib/warm.js', 'lib/memories.js',
  'screens/setup.js', 'lib/sharebox.js', 'lib/sync.js', 'lib/bookcore.js', 'screens/book.js', 'lib/autopilot.js', 'lib/together.js', 'lib/route.js', 'lib/import.js', 'lib/prices.js', 'lib/watch.js', 'lib/gmaps.js', 'lib/search.js', 'lib/replan.js', 'lib/review.js',
  'screens/today.js', 'screens/family.js', 'screens/journal.js', 'lib/daybag.js', 'lib/storage.js', 'screens/kids.js', 'screens/near.js', 'screens/travel.js', 'screens/flow.js', 'screens/quickstart.js', 'screens/sheet.js', 'lib/typeahead.js', 'screens/settings.js', 'screens/trip.js'
];
const LATER = ['lib/memories.js', 'screens/near.js', 'screens/quickstart.js', 'screens/sheet.js', 'lib/typeahead.js', 'lib/import.js', 'screens/setup.js', 'lib/vtmap.js', 'lib/packing.js', 'lib/prices.js', 'lib/watch.js', 'screens/book.js', 'lib/autopilot.js', 'lib/together.js', 'lib/gmaps.js', 'lib/search.js', 'lib/replan.js', 'lib/review.js', 'screens/family.js', 'screens/journal.js', 'lib/daybag.js', 'lib/storage.js', 'screens/kids.js', 'screens/settings.js', 'lib/route.js', 'lib/offcopy.js', 'lib/speedtest.js'];
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
  const AFTER = "\n;try { if (window.__WP_LATER && window.W && window.W.changed) { if (window.W.laterDone) window.W.laterDone(); else { window.W.laterReady = true; window.W.changed(); } } } catch (e) {}\n";
  const join = list => list.map(f => `/* --- ${f} --- */\n` + guard(f, fs.readFileSync(path.join(TRIP, f), 'utf8').replace('"__BUILD__"', JSON.stringify(stamp)))).join('\n;\n');
  const lost = LATER.filter(f => !ORDER.includes(f));
  if (lost.length) throw new Error('in LATER but not in ORDER (so not built in a known order): ' + lost.join(', '));
  const src = FAIL + join(ORDER.filter(f => !LATER.includes(f))), src2 = FAIL + join(ORDER.filter(f => LATER.includes(f))) + AFTER;
  const dry = process.argv.includes('--check');
  const out = (f, data) => { if (!dry) fs.writeFileSync(path.join(TRIP, f), data); };
  const js = await esbuild.transform(src, { minify: true, target: 'es2017', charset: 'utf8', sourcefile: 'app.src.js', sourcemap: 'external', legalComments: 'none' });
  const js2 = await esbuild.transform(src2, { minify: true, target: 'es2017', charset: 'utf8', sourcefile: 'app2.src.js', sourcemap: 'external', legalComments: 'none' });
  out('app.js', js.code + '\n//# sourceMappingURL=app.js.map\n');
  out('app.js.map', js.map);
  out('app2.js', js2.code + '\n//# sourceMappingURL=app2.js.map\n');
  out('app2.js.map', js2.map);
  /* the stylesheet in two: app2.css carries what only the second script's screens use (see splitCss) */
  const first = ORDER.filter(f => !LATER.includes(f)).map(f => fs.readFileSync(path.join(TRIP, f), 'utf8')).join('\n') + fs.readFileSync(path.join(TRIP, 'index.html'), 'utf8');
  const parts = splitCss(fs.readFileSync(path.join(TRIP, 'app.css'), 'utf8'), first);
  if (parts.turned.length) throw new Error('moving these rules to app2.css would turn the cascade round (give the later rule a more specific selector, or keep the section in the first stylesheet):\n  ' + parts.turned.join('\n  '));
  const css = await esbuild.transform(parts.first, { loader: 'css', minify: true });   /* ASCII only: a stylesheet served without a charset would garble · and → */
  const css2 = await esbuild.transform(parts.later, { loader: 'css', minify: true });
  out('app.min.css', css.code);
  out('app2.css', css2.code);
  const kb = n => (n / 1024).toFixed(0) + ' KB';
  console.log(`app.js ${kb(src.length)} -> ${kb(js.code.length)} (+ app2.js ${kb(js2.code.length)} after the first screen); app.min.css ${kb(fs.statSync(path.join(TRIP, 'app.css')).size)} -> ${kb(css.code.length)} (+ app2.css ${kb(css2.code.length)}, ${parts.moved} rules)`);
}
/* The second script's screens (Plan, Prepare and packing, the journal and recap, settings, the kids' corner) have their
   own sections of app.css. A rule in one of those sections moves to app2.css, which comes with app2.js, only when none
   of its class names appears in the first script's code or index.html: whatever the first screen draws keeps its
   style in app.min.css. Rules keep their order; @media blocks are split rule by rule; @keyframes, @font-face and other
   at-rules stay. */
const LATER_CSS = [/^warmly\b/, /^quick start\b/, /^Typeahead\b/, /^Today: near you\b/, /^Today: the day bag\b/, /^Prepare: the tabs\b/, /^Setup\b/, /^Bookings\b/, /^journal, recap/, /^Trip settings\b/, /^pack and prepare\b/, /^prepare: segments\b/, /^the kids' corner\b/, /^Settings: stored files\b/, /^Claude: check my plan\b/];
/* how specific a selector is (ids, classes and the like, elements), as one number to compare */
function spec(sel) {
  const s = sel.replace(/::?[\w-]+\([^)]*\)/g, m => /^:(not|is|has|where)/.test(m) ? m.replace(/^:\w+\(|\)$/g, ' ') : ' .x ').replace(/::[\w-]+/g, ' a ');
  return (s.match(/#[\w-]+/g) || []).length * 100 + (s.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g) || []).length * 10 + (s.match(/(^|[\s>+~(])[a-z][\w-]*/gi) || []).length;
}
/* the class an element must have for a selector to reach it (the last one named in its last part) */
function target(sel) { const last = sel.trim().split(/[\s>+~]+/).pop() || ''; const cs = last.replace(/:[\w-]+(\([^)]*\))?/g, '').match(/\.[\w-]+/g); return cs ? cs[cs.length - 1] : ''; }
function props(body) { return new Set((body.match(/(^|;)\s*([\w-]+)\s*:/g) || []).map(p => p.replace(/[;:\s]/g, ''))); }
function splitCss(text, firstSrc) {
  const used = new Set(firstSrc.match(/[A-Za-z][\w-]*/g));
  let first = '', later = '', moved = 0, section = '', i = 0, n = 0;
  /* every rule in source order: where it went, its context, what it reaches, what it sets (for the cascade check) */
  const all = [];
  const note = (sel, body, media, went) => {
    sel.split(',').forEach(x => { const t = target(x); if (t) all.push({ n, sel: x.trim(), t, sp: spec(x), p: props(body), media, went }); });
    n++;
  };
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
      while ((m = re.exec(body))) { const g = goes(m[1]); note(m[1], m[2], head.trim(), g); if (g) { b += m[0]; moved++; } else a += m[0]; }
      if (a.trim()) first += head + '{' + a + '}'; if (b.trim()) later += head + '{' + b + '}\n';
    } else if (head.trim()[0] !== '@' && goes(head)) { note(head, body, '', true); later += head.trim() + '{' + body + '}\n'; moved++; }
    else { if (head.trim()[0] !== '@') note(head, body, '', false); first += text.slice(i, close + 1); }
    i = close + 1;
  }
  /* a moved rule, and a later rule that stays, reaching the same class and setting the same property, as specific as
     each other, and able to apply at once (the same @media, or either one outside any: v148's .nr-b was a plain rule
     against a touch-screen one): in one stylesheet the later one won; split, the moved one does */
  const turned = [];
  const kept = all.filter(r => !r.went);
  all.filter(r => r.went).forEach(m => kept.forEach(k => {
    if (k.n > m.n && k.t === m.t && (k.media === m.media || !k.media || !m.media) && k.sp === m.sp && [...k.p].some(p => m.p.has(p))) turned.push(m.sel + '  (moves) over  ' + k.sel + (k.media ? '  in ' + k.media : ''));
  }));
  return { first, later, moved, turned };
}
module.exports.splitCss = splitCss;
if (require.main === module) build().catch(e => { console.error(e.message); process.exit(1); });
module.exports.build = build;
