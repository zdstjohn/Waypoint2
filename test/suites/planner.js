/* The day planner and the clock: planner-made days fit (only your own picks may say "no time"), stops run in clock order
   with lunch and dinner where meals go, toddler days get a nap, a short "any time" place is not stretched into a day trip,
   energy levels are spread rather than all heavy, a long ferry day leaves its outings out, and planning is quick. */
const { launch, open, exampleTrip, settle, calm } = require('../lib/page');
const audit = () => {
  const P = W.P, bad = [], mineBad = [], order = [], meals = [], naps = 0, levels = [];
  let napDays = 0;
  P.days.forEach(d => {
    const T = d.slots && d.slots.length ? W.dayTimes(d, P) : null; if (!T) return;
    let last = -1;
    d.slots.forEach(x => {
      const R = T.rows[x.slot]; if (!x.item || !R || R.skip) { if (x.item && R && R.skip) (W.S.mine[x.key] ? mineBad : bad).push('D' + d.n + ' ' + x.slot + ' ' + x.item.n + ' [no time]'); return; }
      if (R.warn.some(w => /^Closed on|^Not open until|before you'd get there|^Kitchen opens/.test(w))) (W.S.mine[x.key] ? mineBad : bad).push('D' + d.n + ' ' + x.slot + ' ' + x.item.n + ' [' + R.warn.join('; ') + ']');
      if (R.start != null) { if (R.start < last) order.push('D' + d.n + ' ' + x.slot + ' starts before the stop before it'); last = R.start; }
      if (x.slot === 'lunch' && R.start != null) meals.push(['lunch', R.start]);
      if (x.slot === 'dinner' && R.start != null) meals.push(['dinner', R.start]);
    });
    if (T.nap) napDays++;
    const E = W.dayEnergy(d, P, T); levels.push(E ? E.level : null);
  });
  return { bad, mineBad, order, meals, napDays, levels, N: P.days.length, toddler: !!W.party().toddler };
};
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390 }); await exampleTrip(pg);
  let a = await pg.evaluate(audit);
  t.eq(a.bad, [], 'example trip: every planner-made stop fits its day');
  t.eq(a.order, [], 'example trip: stops run in clock order');
  t.ok(a.meals.every(([m, s]) => m === 'lunch' ? s >= 11 * 60 + 30 && s <= 14 * 60 + 30 : s >= 17 * 60 && s <= 21 * 60), 'lunch between 11:30 and 14:30, dinner between 17:00 and 21:00: ' + JSON.stringify(a.meals.slice(0, 6)));
  t.ok(!a.toddler || a.napDays >= a.N * 0.6, `a toddler's days have a nap (${a.napDays} of ${a.N})`);
  const lv = a.levels.filter(x => x != null);
  t.ok(lv.some(x => x < 3) && lv.some(x => x >= 2), 'energy levels are spread, not all heavy or all light: ' + JSON.stringify(a.levels));

  /* a place marked "any time" with its own short duration is a 2-hour stop, not a day trip */
  const dt = await pg.evaluate(() => {
    const d = W.P.days.find(d => d.slots.some(x => x.item && x.item.s === 'any' && W.parseDur(x.item.dur) && W.parseDur(x.item.dur) < 240));
    if (!d) return null; const x = d.slots.find(x => x.item && x.item.s === 'any'); const T = W.dayTimes(d, W.P), R = T.rows[x.slot];
    return { info: R.info, mins: R.end != null && R.start != null ? R.end - R.start : null, dur: x.item.dur, cls: W.classify(x.item).min };
  });
  if (dt) { t.ok(!dt.info.some(i => /Day trip/.test(i)), 'a short "any time" place is not called a day trip: ' + JSON.stringify(dt)); t.ok(dt.cls < 240, 'and the classifier agrees it is short'); } else t.note('no short any-time place in the example trip');

  /* the chooser's shape rules: with a toddler, no strenuous outing after another big one */
  const shape = await pg.evaluate(() => W.P.days.map(d => d.slots.filter(x => x.item && !W.isFood(x.slot)).map(x => W.classify(x.item).intensity)));
  t.ok(!a.toddler || shape.every(s => !s.some((v, i) => i && v >= 3 && s[i - 1] >= 3)), 'no two strenuous outings back to back on a toddler day: ' + JSON.stringify(shape));

  /* a long ferry into the second city: that day's outings are left out */
  await pg.evaluate(() => { const P = W.P, a = P.stops[0], b2 = P.stops[1]; W.C.legs[W.legKey(a, b2)] = { v: 2, opts: [{ mode: 'ferry', op: 'Slow Ferry', from: a.name + ' port', to: b2.name + ' port', dur: '8h 30m', price: '€40', book: true, url: '' }] }; W.changed(); });
  await pg.waitForTimeout(1500);
  const mv = await pg.evaluate(() => { const d = W.P.days.find(d => d.moveFrom); const T = W.dayTimes(d, W.P); return { n: d.n, cut: d.slots.filter(x => x.cut).length, kept: d.slots.filter(x => x.item && !W.isFood(x.slot)).length, travel: T.travel && T.travel.end - T.travel.start }; });
  t.ok(mv.cut >= 1 && mv.kept <= 1, 'an 8½-hour ferry day leaves its outings out: ' + JSON.stringify(mv));
  a = await pg.evaluate(audit); t.eq(a.bad, [], 'after the long ferry, planner-made stops still fit');

  /* your own pick may not fit, and then the day says so */
  const own = await pg.evaluate(n => { const d = W.P.days[n - 1], x = d.slots.find(x => x.slot === 'eve'), pool = W.pool(d.country, d.city); const it = pool.spots.find(s => s.s === 'pm' || s.s === 'eve' || s.s === 'any'); W.S.picks[x.key] = it.n; W.S.mine[x.key] = 1; W.changed(); return it.n; }, mv.n);
  await pg.waitForTimeout(1200); a = await pg.evaluate(audit);
  t.eq(a.bad, [], 'your own pick is the only thing allowed not to fit');

  /* an automatic 14-day Greece trip with kids */
  await pg.evaluate(() => { W.S.countries = [{ name: 'Greece', mode: 'auto', picked: [] }]; W.S.days = 14; W.S.cityDays = {}; W.S.mine = {}; W.S.picks = {}; W.S.legPick = {}; W.changed(); });
  await calm(pg, 7500);
  a = await pg.evaluate(audit);
  t.ok(a.N === 14, 'auto Greece: 14 days'); t.eq(a.bad, [], 'auto Greece: every planner-made stop fits'); t.eq(a.order, [], 'auto Greece: clock order');
  const ms = await pg.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 5; i++) W.plan(); return Math.round((performance.now() - t0) / 5); });
  t.ok(ms < 400, `planning a 14-day trip takes under 400 ms (${ms} ms)`);
  /* the same place twice in a trip: two stays a few miles apart (or coming back to a city) share no planner picks */
  const twice = await pg.evaluate(async () => {
    const ps = W.S.countries[0]; ps.mode = 'manual'; ps.picked = ['Corfu', 'Santorini', 'Fira'];
    W.S.cityDays = { 'Greece|Corfu': 4, 'Greece|Santorini': 3, 'Greece|Fira': 3 }; W.S.days = 10; W.S.picks = {}; W.S.mine = {}; W.changed();
    for (let i = 0; i < 60 && W.plan().days.some(d => d.loading); i++) await new Promise(r => setTimeout(r, 250));
    /* Fira is on Santorini: give it the same list, as the real ones overlap */
    const sp = W.pool('Greece', 'Santorini'); if (sp) { if (sp.lat == null) { sp.lat = 36.42; sp.lng = 25.43; } W.C.city['Greece|Fira'] = Object.assign(JSON.parse(JSON.stringify(sp)), { lat: sp.lat + 0.01 }); W.S.picks = {}; W.replan(); }
    const P = W.plan(), seen = {}, rep = [], km = (o, d) => W.km(W.homebase(o.country, o.city), W.homebase(d.country, d.city));
    P.days.forEach(d => (d.slots || []).forEach(x => { if (!x.item) return; const k = W.placeKey(x.item); const near = (seen[k] || []).filter(o => o.stop !== d.stop && (o.city === d.city || (km(o, d) != null && km(o, d) <= 40))); if (near.length) rep.push(x.item.n + ' days ' + near[0].n + '/' + d.n); (seen[k] = seen[k] || []).push(d); }));
    return { stops: P.stops.map(s => s.name), rep: rep.slice(0, 8), same: !!sp };
  });
  if (twice.stops.length >= 2 && twice.same) t.eq(twice.rep, [], 'two stays close together don\'t repeat a place: ' + JSON.stringify(twice)); else t.note('Greece pick trip did not plan: ' + JSON.stringify(twice));
  /* v174: one real place under several names (the owner's Naxos trip had the Kastro on four days, as "Venetian Kastro
     of Naxos", "Naxos Old Town and Kastro wander" and so on): an outing's real place, or Google's place ID for a
     restaurant, counts as the place. A real place that is only the town ("Corfu Town") counts for nothing. */
  const same = await pg.evaluate(async () => {
    const ps = W.S.countries[0]; ps.mode = 'manual'; ps.picked = ['Corfu'];
    W.S.cityDays = { 'Greece|Corfu': 4 }; W.S.days = 4; W.S.picks = {}; W.S.mine = {}; W.changed();
    for (let i = 0; i < 60 && W.plan().days.some(d => d.loading); i++) await new Promise(r => setTimeout(r, 250));
    const pool = W.pool('Greece', 'Corfu'); if (!pool) return null;
    const planned = () => W.plan().days.flatMap(d => (d.slots || []).map(x => x.item).filter(Boolean));
    W.S.picks = {}; W.replan(); const was = planned(), sp = was.filter(x => pool.spots.includes(x)).slice(0, 6), fd = pool.food.filter(x => x.meal !== 'breakfast').slice(0, 4);
    if (sp.length < 6) return { short: sp.length };
    sp.slice(0, 3).forEach(x => { x.place = 'Old Fortress (Palaio Frourio)'; });
    sp.slice(3, 6).forEach(x => { x.place = 'Corfu Town'; });
    fd.slice(0, 2).forEach(x => { x.gid = 'ChIJ_same_restaurant'; });
    W.S.picks = {}; W.replan();
    const on = planned();
    return { fort: on.filter(x => sp.slice(0, 3).includes(x)).map(x => x.n), town: on.filter(x => sp.slice(3, 6).includes(x)).length, rest: on.filter(x => fd.slice(0, 2).includes(x)).map(x => x.n) };
  });
  if (same && !same.short) {
    t.ok(same.fort.length <= 1 && same.rest.length <= 1, 'three outings at one real place, or two names with one Google place ID, are planned once at most: ' + JSON.stringify(same));
    t.ok(same.town === 3, 'outings whose real place is only the town are not taken for one place: ' + same.town + ' of 3 still planned');
  } else t.note('Corfu did not plan six outings: ' + JSON.stringify(same));
  /* (v181) a part of a day the planner couldn't fill says why, on the day */
  const why = await pg.evaluate(async () => { const P = W.P; let hit = null;
    P.days.forEach(d => d.slots.forEach(x => { if (!hit && x.why && W.WHY && W.WHY[x.why]) hit = { n: d.n, why: W.WHY[x.why] }; }));
    if (!hit) return null; W.S.day = hit.n; W.S.tview = 'days'; W.goView('trip'); W.render(); await new Promise(r => setTimeout(r, 300));
    return { why: hit.why, shown: document.getElementById('viewTrip').textContent.indexOf(hit.why) > -1 }; });
  if (why) t.ok(why.shown, 'an empty part of a day says why: ' + why.why); else t.note('no empty part of a day on this trip');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
