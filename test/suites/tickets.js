/* Travel days and real tickets: a booked train with a time plans the day around it (leave in time, the morning free in the
   town you're leaving, lunch there before a mid-afternoon departure, the day picking up from the arrival), the planner
   leaves nothing on that day it can't fit, and Rome2Rio's real journey times, asked for on a tap, set an unbooked leg. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg);
  const legs = await pg.evaluate(() => W.P.days.filter(d => d.moveFrom).map(d => ({ n: d.n, from: d.moveFrom, to: d.city, stop: d.stop, iso: W.isoDay(W.dateOf(d.n)) })));
  t.ok(legs.length >= 1, 'the example trip has a travel day: ' + JSON.stringify(legs));
  if (!legs.length) { await ctx.close(); await b.close(); return; }
  const L0 = legs[0];
  /* a train that leaves at 14:10 and arrives at 15:45, added by hand with its times */
  await pg.evaluate(L => { W.S.bookings = (W.S.bookings || []).concat([{ id: 'h-tk1', kind: 'train', title: 'Frecciarossa 9521', place: '', to: '', start: L.iso + 'T14:10', end: L.iso + 'T15:45', price: 0, cur: 'EUR', ref: 'PNR7Q', provider: '', what: '', url: '', src: 'hand' }]); W.changed(); }, L0);
  await pg.waitForTimeout(400);
  const T = await pg.evaluate(L => {
    const P = W.plan(), d = P.days[L.n - 1], T = W.dayTimes(d, P), rows = {};
    Object.keys(T.rows).forEach(k => { const R = T.rows[k], x = d.slots.find(y => y.slot === k); rows[k] = { start: R.start, skip: !!R.skip, info: (R.info || []).join('; '), item: x && x.item ? x.item.n : '', mine: !!(x && W.S.mine[x.key]) }; });
    return { tr: T.travel && { start: T.travel.start, end: T.travel.end, dep: T.travel.dep, arr: T.travel.arr, tk: !!T.travel.ticket }, before: T.before || null, rows };
  }, L0);
  t.ok(T.tr && T.tr.tk && T.tr.dep === 14 * 60 + 10 && T.tr.arr === 15 * 60 + 45, 'the travel day uses the ticket\'s times: ' + JSON.stringify(T.tr));
  t.ok(T.tr && T.tr.start === 14 * 60 + 10 - 45, 'and you leave 45 minutes before a train');
  t.ok(T.before && T.before.city === L0.from && T.before.start === 9 * 60, 'the morning is free in ' + L0.from + ' before you set off: ' + JSON.stringify(T.before));
  t.ok(T.rows.lunch && T.rows.lunch.skip && /before you set off/.test(T.rows.lunch.info), 'lunch is in the town you leave: ' + JSON.stringify(T.rows.lunch));
  const unfit = Object.keys(T.rows).filter(k => T.rows[k].item && T.rows[k].skip && !T.rows[k].mine);
  t.eq(unfit, [], 'the planner leaves nothing on that day that the ticket leaves no time for');
  t.ok(T.rows.dinner && !T.rows.dinner.skip && T.rows.dinner.start >= T.tr.end, 'dinner comes after you arrive');
  /* the card on the day shows the ticket */
  const card = await pg.evaluate(n => { W.S.day = n; W.S.tview = 'days'; W.render(); const c = document.querySelector('.legcard'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; }, L0.n);
  t.ok(/Your train/.test(card) && /2:10/.test(card) && /3:45/.test(card) && /Leave by 1:25/.test(card) && !/rough/.test(card), 'the journey card shows your train and when to leave: ' + card.slice(0, 220));
  /* Rome2Rio for a leg without a ticket */
  await pg.evaluate(() => { W.S.bookings = (W.S.bookings || []).filter(b => b.id !== 'h-tk1'); W.changed(); });
  await pg.evaluate(n => { W.S.day = n; W.render(); }, L0.n);
  await pg.waitForFunction(() => !!document.querySelector('[data-r2r]'), null, { timeout: 15000 }).catch(() => {});
  const had = await pg.evaluate(() => !!document.querySelector('[data-r2r]'));
  t.ok(had, 'an unbooked journey offers Rome2Rio\'s real times');
  if (had) {
    await pg.click('[data-r2r]'); await pg.waitForTimeout(900);
    const rr = await pg.evaluate(L => { const P = W.plan(), lg = W.legFor(P, L.stop), line = document.querySelector('.lo-r2r'); return { calls: window.__mcp.filter(c => c[0] === 'Rome2Rio').map(c => [c[1], c[2].origin, c[2].destination]), line: line ? line.innerText : '', min: lg.min, mode: lg.best && lg.best.mode, guessed: lg.guessed, r2r: lg.r2r }; }, L0);
    t.ok(rr.calls.length === 1 && rr.calls[0][0] === 'get-routes' && rr.calls[0][1].indexOf(L0.from) === 0 && rr.calls[0][2].indexOf(L0.to) === 0, 'it asks Rome2Rio for the journey: ' + JSON.stringify(rr.calls));
    t.ok(/Rome2Rio: Train 1h 35m/.test(rr.line), 'and lists the real routes: ' + rr.line);
    const want = { train: 95, bus: 210, flight: 180, car: 170 }[String(rr.mode).replace(/.*(train|bus|flight|car).*/, '$1')];
    if (want) t.ok(rr.min === want && !rr.guessed, `the plan uses Rome2Rio's time for the way you go (${rr.mode}: ${rr.min} min)`);
    else t.note('the chosen way (' + rr.mode + ') has no Rome2Rio route in the mock');
  }
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
