/* The city library when its read is slower than the screen (the tests audit, finding 4: the citylib suite failed under
   load, "asking Claude for none of those lists"). A city whose general lists are in the shared library is opened with the
   library's read delayed by 0, 1.2 s and 4 s (the stand-in database sleeps before it answers). lib/citylib.js lets a
   first screen wait LIB_WAIT = 2.5 s for the library before it asks Claude instead, so:
     0 s and 1.2 s   the days fill from the library's lists (no wait for Claude), and the trip's own question is asked once after
     4 s             Claude is asked at once (the wait ran out); the library's answer, arriving after that, is left unused:
                     nothing is filled twice, nothing breaks
   This pins what the app does today; whether the wait is long enough is the owner's trade-off (a slow phone asks Claude and
   pays for it; a fast one never does). */
const { launch, open, exampleTrip } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch();
  const Q = JSON.parse(require('fs').readFileSync(require('path').join(t.root, 'tools/citylib-questions.json'), 'utf8'));
  const at = [40, 10], now = Date.now();
  const spots = Array.from({ length: 15 }, (_, i) => ({ n: 'General sight ' + i, d: 'A sight.', t: ['culture'], fame: 1, rating: 4.5, k: 0, s: ['am', 'pm', 'eve', 'any'][i % 4], dur: '2h', ticket: 'Free', pic: 'museum', place: 'General sight ' + i, lat: at[0] + (i % 5) * 0.002, lng: at[1] + (i % 3) * 0.002 }));
  const food = Array.from({ length: 15 }, (_, i) => ({ n: 'General eatery ' + i, d: 'Good food.', fame: 1, rating: 4.5, cuisine: 'Croatian', price: '€€', meal: i < 4 ? 'breakfast' : ['lunch', 'dinner', 'both'][i % 3], dur: '1h', fav: false, k: 0, sure: true, reserve: false, pic: 'restaurant', lat: at[0] + (i % 4) * 0.002, lng: at[1] + (i % 5) * 0.002 }));
  const seed = { 'citylib/croatia-town-50': { country: 'Croatia', city: 'Town 50', q: { [Q.spots.h]: { r: { d: 'A town.', lat: at[0], lng: at[1], spots }, at: now }, [Q.food.h]: { r: { food }, at: now } } } };
  /* the stand-in database, sleeping before it answers a read of the library */
  const slow = ms => { const store = mkdb(seed); return async (o, p, body) => { if (o === 'get' && /^citylib\//.test(p)) await new Promise(r => setTimeout(r, ms)); return store(o, p, body); }; };
  const run = async ms => {
    const P = await open(b, { width: 390, db: slow(ms), uid: 'u-slow' }); await exampleTrip(P.pg);
    const r = await P.pg.evaluate(async () => { window.__full = []; const t0 = Date.now(); W.loadCity('Croatia', 'Town 50');
      const have = () => { const c = W.C.city[W.cityKey('Croatia', 'Town 50')]; return c ? c.spots : []; };
      for (let i = 0; i < 120 && !have().length; i++) await new Promise(r => setTimeout(r, 100));
      const first = Date.now() - t0, firstNames = have().map(x => x.n);
      await new Promise(r => setTimeout(r, 4500));   /* (the library's late answer, the trip's own question, anything else that comes) */
      const all = have().map(x => x.n);
      const asks = (window.__full || []).filter(p => /best things to do in and around Town 50, Croatia/.test(p));
      return { first, firstGeneral: firstNames.filter(n => /^General sight/.test(n)).length, firstN: firstNames.length, all: all.length, dup: all.length - new Set(all.map(n => n.toLowerCase())).size, generalAll: all.filter(n => /^General sight/.test(n)).length, asks: asks.length,
        askedBeforeLibrary: asks.length && !/Travelers' ages: 38, 36, 6, 3/.test(asks[0]) ? 'general' : 'own', status: W.status['spots|Croatia|Town 50'] || '' }; });
    const errs = P.errors(); await P.ctx.close(); return Object.assign(r, { errs });
  };
  const fast = await run(0), mid = await run(1200), late = await run(4000);
  t.ok(fast.firstGeneral >= 10 && fast.asks === 1, 'the library at once: the days fill from its lists (' + fast.firstGeneral + ' of its sights, ' + fast.first + ' ms), and Claude is asked once, for the trip\'s own question: ' + JSON.stringify(fast));
  t.ok(mid.firstGeneral >= 10 && mid.asks === 1 && mid.first >= 1100 && mid.first < 2500, 'the library 1.2 s late: still used (' + mid.firstGeneral + ' of its sights after ' + mid.first + ' ms), still one ask: ' + JSON.stringify(mid));
  t.ok(late.firstGeneral === 0 && late.firstN > 0 && late.asks >= 1, 'the library 4 s late (past its 2.5 s wait): Claude is asked and its answer fills the days (' + late.firstN + ' places after ' + late.first + ' ms, none of the library\'s): ' + JSON.stringify(late));
  t.ok(late.dup === 0 && mid.dup === 0 && fast.dup === 0, 'nothing is filled twice, even when the library answers after Claude was asked');
  t.eq([fast.errs, mid.errs, late.errs], [[], [], []], 'no page errors');
  t.note('citylib race: the app asks Claude for lists the library holds only when the read takes longer than LIB_WAIT (2.5 s); then the late library answer is dropped (lib/citylib.js libGet: finish() runs once). first-screen times: ' + [fast.first, mid.first, late.first].join(' / ') + ' ms');
  await b.close();
};
