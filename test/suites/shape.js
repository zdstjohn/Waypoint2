/* The whole-trip planner on a 17-day Spain trip with two toddlers and the grandparents, flying from Los Angeles:
   enough nights per place, Toledo as a day trip from Madrid instead of another hotel, a sensible order, the first days
   kept easy for jet lag, trains over flights where they are short, a flight offered where the ground leg is long,
   no strenuous outings for the grandparents, and every planner-made stop still fitting its day. */
const { launch, open, settle, calm } = require('../lib/page');
const SPAIN = [['Madrid', 40.42, -3.70], ['Toledo', 39.86, -4.02], ['Seville', 37.39, -5.98], ['Granada', 37.18, -3.60], ['Malaga', 36.72, -4.42], ['Barcelona', 41.39, 2.17]];
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, tz: 'America/Los_Angeles' });
  await pg.evaluate(SP => {
    W.isExample = false;
    W.C.country.Spain = { cities: SP.filter(c => !W.findCity('Spain', c[0])).map(c => ({ name: c[0], lat: c[1], lng: c[2], w: 2, pop: 3, t: ['culture', 'family'], d: c[0] })) };
    Object.assign(W.S, { styles: ['culture', 'food', 'beach'], travelers: [36, 34, 4, 2, 68, 66], depart: 'Los Angeles', start: '2027-05-10', days: 17, cityDays: {}, picks: {}, seen: {}, mine: {}, legPick: {}, fold: {}, rest: {}, day: 1, tview: 'days',
      countries: [{ name: 'Spain', mode: 'manual', picked: ['Madrid', 'Toledo', 'Malaga', 'Granada', 'Seville', 'Barcelona'] }] });
    W.render();
  }, SPAIN);
  await calm(pg, 14000);

  const shape = () => pg.evaluate(() => {
    const P = W.P, R = W.routeCheck(P);
    return { stops: P.stops.map(s => [s.name, s.days, (s.trips || []).map(x => x.name)]), N: P.N, jet: P.days.filter(d => d.jet).map(d => d.n),
      items: R.map(r => ({ t: r.t, ok: !!r.ok, act: r.act ? r.act.label : null, data: r.act ? r.act.data : null })), p: W.party() };
  });
  let s = await shape();
  t.ok(s.p.toddler && s.p.senior, 'the party has toddlers and grandparents: ' + JSON.stringify(s.p));
  t.ok(s.N === 17, '17 days: ' + s.N);
  t.eq(s.jet, [1, 2], 'nine hours from Los Angeles: the first two days are jet-lag days');
  const foldItem = s.items.find(i => /Toledo/.test(i.t) && /day trip/.test(i.t) && i.act);
  t.ok(!!foldItem, 'the trip shape offers Toledo as a day trip from Madrid: ' + JSON.stringify(s.items.map(i => i.act || i.t.slice(0, 60))));

  /* apply every fix the check offers (day trips first, then nights, then the order), as a person tapping through would */
  for (let round = 0; round < 6; round++) {
    const fixes = (await shape()).items.filter(i => i.act && !i.ok);
    if (!fixes.length) break;
    const f = fixes.find(i => /day trip/.test(i.act)) || fixes.find(i => /night/.test(i.act)) || fixes.find(i => /order/.test(i.act)) || fixes[0];
    await pg.evaluate(data => { const el = document.createElement('button'); el.innerHTML = ''; const tmp = document.createElement('div'); tmp.innerHTML = '<b ' + data + '></b>'; W.routeClick(tmp.firstChild.dataset, W.P); W.changed(); }, f.data);
    await calm(pg, 9000);
  }
  s = await shape();
  const madrid = s.stops.find(x => x[0] === 'Madrid');
  t.ok(madrid && madrid[2].indexOf('Toledo') > -1 && !s.stops.some(x => x[0] === 'Toledo'), 'after the fixes Toledo is a day trip from Madrid, not a stop: ' + JSON.stringify(s.stops));
  t.ok(s.stops.every(x => x[1] >= 3), 'every base has at least three nights: ' + JSON.stringify(s.stops));
  t.ok(s.N === 17, 'and the trip is still 17 days: ' + s.N);
  t.ok(s.stops.length <= 5, 'at most four hotel moves in 17 days: ' + s.stops.length + ' bases');
  const order = s.stops.map(x => x[0]);
  const zig = await pg.evaluate(o => { const at = n => W.stopAt(W.P.stops.find(s => s.name === n)); let d = 0; for (let i = 1; i < o.length; i++) d += W.km(at(o[i - 1]), at(o[i])); const best = W.bestOrder(W.P.stops); let bd = 0; for (let i = 1; i < best.length; i++) bd += W.km(W.stopAt(best[i - 1]), W.stopAt(best[i])); return { d: Math.round(d), bd: Math.round(bd) }; }, order);
  t.ok(zig.d <= zig.bd * 1.2 + 50, 'the order has no big backtracking: ' + order.join(' → ') + ' (' + zig.d + ' km vs ' + zig.bd + ' km best)');
  t.ok(!s.items.some(i => !i.ok && /night|day trip/.test(i.t)), 'nothing left to fix about nights or day trips: ' + JSON.stringify(s.items.filter(i => !i.ok).map(i => i.t.slice(0, 80))));

  /* the day trip itself: morning, lunch and afternoon in Toledo, dinner and evening back in Madrid */
  const trip = await pg.evaluate(() => {
    const d = W.P.days.find(d => d.trip && d.trip.name === 'Toledo'); if (!d) return null;
    const T = W.dayTimes(d, W.P);
    return { n: d.n, jet: !!d.jet, full: !!d.fullDay, out: d.slots.filter(x => x.trip && x.item).map(x => x.item.n), back: d.slots.filter(x => !x.trip && x.item && !W.isFood(x.slot) || (x.slot === 'dinner' && x.item)).map(x => x.item.n), fits: d.slots.every(x => !x.item || !T.rows[x.slot].skip) };
  });
  t.ok(trip && trip.out.length >= 2 && trip.out.every(n => /^Toledo/.test(n)), 'the Toledo day has its morning, lunch and afternoon in Toledo: ' + JSON.stringify(trip));
  t.ok(trip && trip.back.every(n => /^Madrid/.test(n)) && !trip.jet && trip.full, 'and dinner and the evening back in Madrid, not on a jet-lag day: ' + JSON.stringify(trip));

  /* jet-lag days: nothing booked first thing, no day trips, early dinner */
  const jet = await pg.evaluate(() => W.P.days.filter(d => d.jet).map(d => { const T = W.dayTimes(d, W.P); const am = d.slots.find(x => x.slot === 'am'), dn = d.slots.find(x => x.slot === 'dinner'); return { n: d.n, trip: !!d.trip, full: !!d.fullDay, booked: !!(am.item && W.needsBooking(am.item)), dinner: T.rows.dinner.start }; }));
  t.ok(jet.every(j => !j.trip && !j.full && !j.booked && j.dinner <= 18 * 60 + 30), 'jet-lag days: no day trip, nothing timed first thing, dinner by 18:30: ' + JSON.stringify(jet));

  /* grandparents: no strenuous outings anywhere */
  const hard = await pg.evaluate(() => W.P.days.reduce((a, d) => a.concat(d.slots.filter(x => x.item && !W.isFood(x.slot) && W.classify(x.item).intensity >= 3).map(x => x.item.n)), []));
  t.eq(hard, [], 'no strenuous outings with the grandparents along');

  /* the way between bases: a short train beats a flight; a long ground leg gets the flight offered */
  const legs = await pg.evaluate(() => {
    const P = W.P, a = P.stops[0], b2 = P.stops[1], y = P.stops[P.stops.length - 2], z = P.stops[P.stops.length - 1];
    W.C.legs[W.legKey(a, b2)] = { v: 2, opts: [{ mode: 'flight', op: 'Iberia', from: a.name, to: b2.name, dur: '1h 10m', price: '€60', url: '' }, { mode: 'train', op: 'Renfe AVE', from: a.name, to: b2.name, dur: '2h 30m', price: '€45', url: '' }] };
    W.C.legs[W.legKey(y, z)] = { v: 2, opts: [{ mode: 'train', op: 'Renfe', from: y.name, to: z.name, dur: '5h 50m', price: '€80', url: '' }, { mode: 'flight', op: 'Vueling', from: y.name, to: z.name, dur: '1h 35m', price: '€70', url: '' }] };
    W.changed(); const L1 = W.legFor(P, 1), Ln = W.legFor(P, P.stops.length - 1), R = W.routeCheck(P);
    const fly = R.find(r => r.act && /Fly instead/.test(r.act.label));
    return { first: L1.best.mode, last: Ln.best.mode, flyOffered: !!fly, data: fly && fly.act.data };
  });
  t.ok(legs.first === 'train', 'a 2½-hour train beats a flight for toddlers and grandparents: ' + legs.first);
  t.ok(legs.last === 'train' && legs.flyOffered, 'a 6-hour train leg gets "Fly instead" offered');
  if (legs.data) {
    const after = await pg.evaluate(data => { const tmp = document.createElement('div'); tmp.innerHTML = '<b ' + data + '></b>'; W.routeClick(tmp.firstChild.dataset, W.P); W.changed(); return W.legFor(W.P, W.P.stops.length - 1).best.mode; }, legs.data);
    t.ok(/flight/.test(after), 'and tapping it picks the flight: ' + after);
  }

  /* everything the planner made still fits */
  await calm(pg, 6500);
  const bad = await pg.evaluate(() => { const out = []; W.P.days.forEach(d => { const T = W.dayTimes(d, W.P); d.slots.forEach(x => { if (x.item && !W.S.mine[x.key] && T.rows[x.slot] && T.rows[x.slot].skip) out.push('D' + d.n + ' ' + x.slot); }); }); return out; });
  t.eq(bad, [], 'every planner-made stop fits its day');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
