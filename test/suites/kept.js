/* Where ideas are kept on the device (lib/ideastore.js): every city in IndexedDB, one record each; the phone's storage
   entry holds only what the trip on screen uses; a city not in memory comes back from IndexedDB without asking Claude;
   an entry the phone refuses (full) is cut down to this trip's places, so saving recovers by itself; with no IndexedDB
   everything stays in the entry, as before. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg);
  const entry = () => pg.evaluate(() => { const c = JSON.parse(localStorage.getItem('waypoint-cache-v2') || '{}'); return { cities: Object.keys(c.city || {}).sort(), countries: Object.keys(c.country || {}).sort(), size: (localStorage.getItem('waypoint-cache-v2') || '').length }; });
  const keptAll = () => pg.waitForFunction(() => W.ideaStore.keptAll(), null, { timeout: 15000 }).catch(() => {});
  /* 1. ideas for a city this trip does not use (from another trip, say) */
  await pg.evaluate(() => {
    const spot = i => ({ n: 'Madrid kept sight ' + i, d: 'From an earlier trip', t: ['culture'], k: 0, s: 'am', dur: '1-2h', ticket: 'Free', lat: 40.41 + i * 0.002, lng: -3.70 });
    W.C.city['Spain|Madrid'] = { d: 'Kept', lat: 40.4168, lng: -3.7038, spots: Array.from({ length: 16 }, (_, i) => spot(i)), food: Array.from({ length: 16 }, (_, i) => ({ n: 'Madrid kept eatery ' + i, d: 'Tapas', cuisine: 'Spanish', price: '€€', meal: ['lunch', 'dinner', 'both'][i % 3], k: 0, lat: 40.415 + i * 0.001, lng: -3.705 })), askedN: 16, v: 3 };
    W.C.country['Portugal'] = { v: W.COUNTRY_V, blurb: 'Kept', cities: [{ name: 'Lisbon', lat: 38.72, lng: -9.14, w: 3, pop: 5, t: [], d: 'Hills' }, { name: 'Porto', lat: 41.15, lng: -8.61, w: 2, pop: 4, t: [], d: 'River' }] };
    W.arrived(); W.save();
  });
  const e0 = await entry();
  t.ok(e0.cities.includes('Spain|Madrid') && e0.cities.includes('Italy|Rome'), 'until a place is safely in IndexedDB it stays in the phone\'s storage entry: ' + e0.cities.join(', '));
  await keptAll(); await pg.waitForTimeout(600);
  const e1 = await entry();
  t.ok(e1.cities.includes('Italy|Rome') && e1.cities.includes('Italy|Venice') && !e1.cities.includes('Spain|Madrid') && !e1.countries.includes('Portugal') && e1.size < e0.size,
    `once everything is kept, the entry holds only this trip's places (${e1.cities.join(', ')}; ${Math.round(e0.size / 1024)} → ${Math.round(e1.size / 1024)} KB)`);
  /* 2. the app is opened again: this trip's ideas are there at once; the other city comes back from the device, not from Claude */
  await pg.reload(); await pg.waitForFunction(() => window.W && W.P && W.ideaStore, null, { timeout: 15000 }); await settle(pg);
  const r2 = await pg.evaluate(async () => {
    const start = { rome: !!(W.C.city['Italy|Rome'] && W.C.city['Italy|Rome'].spots.length), madrid: !!W.C.city['Spain|Madrid'] };
    window.__askedMadrid = 0; const real = W.SAMPLE.json.bind(W.SAMPLE); W.SAMPLE.json = function (p, o) { if (/Madrid|Portugal/.test(p) && /^List /.test(p) && !/for the meals this trip has no place for yet/.test(p)) window.__askedMadrid++;   /* (the kept list has no breakfast places: asking for those is the meal fill, test/suites/meals.js) */ return real(p, o); };
    W.S.countries = [{ name: 'Spain', mode: 'manual', picked: ['Madrid'] }]; W.S.cityDays = { 'Spain|Madrid': 3 }; W.S.days = 3; W.S.picks = {}; W.S.day = 1; W.changed(); W.loadCountry('Portugal');
    for (let i = 0; i < 60 && !(W.C.city['Spain|Madrid'] && W.C.country['Portugal']); i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 1200));
    const p = W.C.city['Spain|Madrid'] || {}, P = W.plan();
    return { start, back: (p.spots || []).concat((p.rest || {}).spots || []).filter(x => /kept sight/.test(x.n)).length,   /* (on show or set aside: a 3-day stay shows 15) */ country: ((W.C.country['Portugal'] || {}).cities || []).length, asked: window.__askedMadrid, planned: P.days[0].slots.filter(x => x.item && /Madrid kept/.test(x.item.n)).length };
  });
  t.ok(r2.start.rome && !r2.start.madrid, 'opened again, this trip\'s ideas are in memory at once and the other city is not: ' + JSON.stringify(r2.start));
  t.ok(r2.back === 16 && r2.country === 2 && r2.asked === 0 && r2.planned >= 2, 'a city and a country kept on the device come back from it, without asking Claude again: ' + JSON.stringify(r2));
  /* 3. the phone refuses the entry (full): it is cut down to this trip's places and saving carries on */
  const r3 = await pg.evaluate(async () => {
    const LIMIT = 300000, real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      let total = String(v).length; for (let i = 0; i < this.length; i++) { const kk = this.key(i); if (kk !== k) total += (this.getItem(kk) || '').length; }
      if (total > LIMIT) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return real.call(this, k, v);
    };
    const big = n => ({ d: 'Big', lat: 48.85, lng: 2.35, spots: Array.from({ length: 400 }, (_, i) => ({ n: n + ' big sight ' + i, d: 'x'.repeat(300), t: ['culture'], k: 0, s: 'am', lat: 48.85, lng: 2.35 })), food: [], askedN: 400 });
    W.C.city['France|Paris'] = big('Paris'); W.C.city['France|Lyon'] = big('Lyon');
    W.arrived(); W.S.tripName = 'Saved although full'; W.save();   /* (not yet in IndexedDB: the entry would hold all of it, and is refused) */
    const c = JSON.parse(localStorage.getItem('waypoint-cache-v2')), s = JSON.parse(localStorage.getItem('waypoint-v2'));
    const out = { full: !!W.localFull, cities: Object.keys(c.city).sort(), name: s.tripName, inMemory: !!W.C.city['France|Paris'] };
    /* and the trip itself, when there is no room even for that: room is made by cutting the saved ideas */
    Storage.prototype.setItem = real; W.cacheDirty(); localStorage.setItem('waypoint-cache-v2', JSON.stringify(W.C));   /* the entry as an older version left it: everything */
    Storage.prototype.setItem = function (k, v) { let total = String(v).length; for (let i = 0; i < this.length; i++) { const kk = this.key(i); if (kk !== k) total += (this.getItem(kk) || '').length; } if (total > LIMIT) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return real.call(this, k, v); };
    W.S.tripName = 'The trip is saved first'; W.save();
    const s2 = JSON.parse(localStorage.getItem('waypoint-v2')), c2 = JSON.parse(localStorage.getItem('waypoint-cache-v2'));
    Storage.prototype.setItem = real;
    return Object.assign(out, { name2: s2.tripName, cities2: Object.keys(c2.city).sort(), full2: !!W.localFull });
  });
  t.ok(!r3.full && r3.name === 'Saved although full' && r3.cities.join() === 'Spain|Madrid' && r3.inMemory, 'a refused entry is written again with only this trip\'s places, and the save goes through: ' + JSON.stringify({ full: r3.full, cities: r3.cities, name: r3.name }));
  t.ok(!r3.full2 && r3.name2 === 'The trip is saved first' && r3.cities2.join() === 'Spain|Madrid', 'with no room even for the trip, room is made from the saved ideas and the trip is saved: ' + JSON.stringify({ full: r3.full2, cities: r3.cities2, name: r3.name2 }));
  /* the big cities reach IndexedDB all the same, and the note in the error log is written once */
  await keptAll();
  t.ok(await pg.evaluate(() => W.ideaStore.keptAll() && W.cacheCut === true), 'what was left out of the entry is still kept in IndexedDB');
  t.eq(errors(), [], 'no page errors');
  await ctx.close();
  /* 4. no IndexedDB (some private windows): everything stays in the entry, as before */
  const N = await open(b, { width: 390, height: 844, db: mkdb(), init: "try { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); } catch (e) {}" }); await exampleTrip(N.pg);
  const r4 = await N.pg.evaluate(async () => {
    W.C.city['Spain|Madrid'] = { d: 'Kept', lat: 40.4, lng: -3.7, spots: [{ n: 'Madrid kept sight', d: 'x', t: [], k: 0, s: 'am', lat: 40.4, lng: -3.7 }], food: [] };
    W.arrived(); W.save(); await W.ideaStore.ready; await new Promise(r => setTimeout(r, 400)); W.arrived(); W.save();
    return { on: W.ideaStore.isOn(), idb: typeof indexedDB, cities: Object.keys(JSON.parse(localStorage.getItem('waypoint-cache-v2')).city).sort() };
  });
  t.ok(!r4.on && r4.cities.includes('Spain|Madrid') && r4.cities.includes('Italy|Rome'), 'with no IndexedDB, every place stays in the entry: ' + JSON.stringify(r4));
  t.eq(N.errors(), [], 'no page errors without IndexedDB');
  await N.ctx.close(); await b.close();
};
