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
  await ctx.close();

  /* ---- a way of travelling picked and unpicked leaves the day as it was (lib/plan.js: under) ---- */
  const c2 = await open(b, { width: 390, height: 844, db: mkdb() }); const p2 = c2.pg; await exampleTrip(p2); await settle(p2, 4000);
  await p2.evaluate(() => { W.S.day = 5; W.render(); }); await settle(p2, 6000);
  const names = () => p2.evaluate(() => W.plan().days.map(d => (d.slots || []).map(x => x.item ? x.item.n : '').join('|')));
  const LG = await p2.evaluate(() => { const P = W.plan(), d = P.days[4], L = W.legFor(P, d.stop), lg = W.C.legs[L.key]; lg.opts[1].dur = '6h 30m'; return { key: L.key, sigs: lg.opts.map(o => W.legSig(o)), n: lg.opts.length }; });
  const way = async i => { await p2.evaluate(a => { (W.S.legPick || (W.S.legPick = {}))[a[0]] = a[1]; W.changed(); }, [LG.key, LG.sigs[i]]); await settle(p2, 3000); };
  t.ok(LG.n >= 2, 'the travel day offers more than one way to go');
  await way(0); const planA = await names();
  await way(1);
  const slowDay = await p2.evaluate(() => {
    const P = W.plan(), d = P.days[4], U = W.S.under || {}, lost = d.slots.filter(x => !x.item && U[x.key]).map(x => ({ slot: x.slot, was: U[x.key][0], now: U[x.key][1] }));
    /* the place a slot lost is kept for it: no other slot of the day is offered it */
    const offered = d.slots.filter(x => x.item && !W.isFood(x.slot) === !W.isFood((lost[0] || {}).slot || 'lunch')).map(x => (W.slotOptions(d, x.slot, P) || []).map(o => (o.it || o).n));
    return { lost, offered: [].concat(...offered), names: d.slots.map(x => x.item ? x.item.n : '') };
  });
  const planSlow = await names();
  t.ok(slowDay.lost.length >= 1 && planSlow[4] !== planA[4], 'a much slower way takes something off the travel day, and the plan remembers what stood there: ' + JSON.stringify(slowDay.lost));
  t.ok(slowDay.lost.every(l => !slowDay.offered.includes(l.was)), 'while it is off, that place is kept for its slot: no other slot is offered it');
  await way(0); const planBack = await names();
  t.eq(planBack, planA, 'picking the first way again puts every day back exactly as it was');
  t.ok(await p2.evaluate(() => { const d = W.plan().days[4], U = W.S.under || {}; return !d.slots.some(x => x.item && U[x.key]); }), 'and a slot that has its place back is no longer remembered');
  await way(1); t.eq(await names(), planSlow, 'the slower way again gives the same day as it did the first time');
  await way(0);
  /* a place that was swapped (not just taken off) comes back the same way; a pick changed by any other hand, or a memory more than a few days old, is left alone */
  const swap = await p2.evaluate(async () => {
    const P = W.plan(), d = P.days[5], x = d.slots.find(y => y.slot === 'pm' && y.item), X = x.item.n, used = {}; P.days.forEach(y => (y.slots || []).forEach(z => { if (z.item) used[z.item.n] = 1; }));
    const Y = W.pool(d.country, d.city).spots.find(q => !used[q.n]).n, day = Math.floor(Date.now() / 864e5), at = () => { const z = W.plan().days[5].slots.find(y => y.slot === 'pm'); return z.item ? z.item.n : ''; };
    W.S.picks[x.key] = Y; W.S.under = W.S.under || {}; W.S.under[x.key] = [X, Y, day]; W.changed(); const back = at(), cleared = !W.S.under[x.key], pick = W.S.picks[x.key];
    W.S.picks[x.key] = Y; W.S.under[x.key] = [X, 'Something else', day]; W.changed(); const other = at(), gone = !W.S.under[x.key];
    W.S.picks[x.key] = Y; W.S.under[x.key] = [X, Y, day - 9]; W.changed(); const old = at(), gone2 = !W.S.under[x.key];
    W.S.picks[x.key] = X; W.changed();
    return { X, Y, back, cleared, pick, other, gone, old, gone2 };
  });
  t.ok(swap.back === swap.X && swap.cleared && swap.pick === swap.X, 'a place the fit pass had swapped out comes back once it fits again: ' + swap.back);
  t.ok(swap.other === swap.Y && swap.gone, 'not when the stop has been changed by anything else since');
  t.ok(swap.old === swap.Y && swap.gone2, 'and not after more than a few days');
  t.eq(c2.errors(), [], 'no page errors on the second trip');
  /* ---- v159: journeys that end on another day, or on another clock (found by the sweep of awkward trips) ---- */
  const c3 = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(c3.pg);
  const night = await c3.pg.evaluate(async L => {
    const next = W.isoDay(W.dateOf(L.n + 1));
    const put = (kind, dep, arrDay, arr) => { W.S.bookings = [{ id: 'h-n', kind, title: 'Night ' + kind, place: '', to: '', start: L.iso + 'T' + dep, end: arrDay + 'T' + arr, price: 0, cur: 'EUR', ref: 'N1', provider: '', what: '', url: '', src: 'hand' }]; W.changed(); };
    const read = () => { const P = W.plan(), d = P.days[L.n - 1], T = W.dayTimes(d, P); W.S.day = L.n; W.S.tview = 'days'; W.goView('trip'); W.render();
      const band = document.querySelector('#viewTrip .tk-band'), tx = s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
      return { tk: W.legTicket(P, L.stop), end: T.travel.end, zone: !!T.travel.zone, before: !!T.before, dinner: (T.rows.dinner && T.rows.dinner.info || []).join('; '), breakfast: (T.rows.breakfast && T.rows.breakfast.info || []).join('; '),
        dur: tx('#viewTrip .tk-band .tk-d'), to: band ? band.querySelector('.tk-end.r .tk-t').textContent.replace(/\s+/g, ' ') : '', line: tx('#viewTrip .leg-tk'), tonight: tx('#viewTrip .day-end'), night: W.nightOut(T) }; };
    put('ferry', '23:30', next, '05:40'); await new Promise(r => setTimeout(r, 300)); const ferry = read();
    put('flight', '17:20', L.iso, '11:05'); await new Promise(r => setTimeout(r, 300)); const east = read();
    put('train', '17:20', L.iso, '11:05'); await new Promise(r => setTimeout(r, 300)); const typo = read();
    return { ferry, east, typo };
  }, L0);
  t.ok(night.ferry.tk && night.ferry.tk.arr === 1440 + 340 && !night.ferry.tk.zone && night.ferry.end >= 1440, 'a ferry that leaves at 11:30 PM and arrives 5:40 AM the next day counts on past midnight: ' + JSON.stringify(night.ferry.tk));
  t.ok(night.ferry.dur === '6h 10m' && /next day/i.test(night.ferry.to) && /5:40.*next day/i.test(night.ferry.line), `its ticket shows its own length and says the arrival is the next day: "${night.ferry.dur}", "${night.ferry.to}", "${night.ferry.line.slice(0, 70)}"`);
  t.ok(/the day is yours in/.test(night.ferry.line) && /^Breakfast in /.test(night.ferry.breakfast) && /^Dinner in .* before you set off$/.test(night.ferry.dinner), `the day before it is spent where you are: "${night.ferry.breakfast}", "${night.ferry.dinner}"`);
  t.ok(/^On the ferry: you arrive 5:40/.test(night.ferry.night) && /On the ferry: you arrive/.test(night.ferry.tonight) && !/stay picked yet/.test(night.ferry.tonight), 'and "Tonight" says you are on the ferry, not that no stay is picked: ' + night.ferry.tonight.slice(0, 60));
  t.ok(night.east.tk && night.east.tk.zone && night.east.tk.arr === 665 && night.east.zone && night.east.dur === '' && /local time/i.test(night.east.to) && /11:05.*local time/i.test(night.east.line) && night.east.night === '',
    `a flight that lands earlier by the clock than it left (across time zones) keeps its booked times, says "local time" and shows no length: "${night.east.to}", "${night.east.line.slice(0, 60)}"`);
  t.ok(night.typo.tk && night.typo.tk.arr == null && !night.typo.tk.zone, 'a train "arriving" before it leaves is a mistake in the booking: its arrival is left out, as before');
  t.eq(c3.errors(), [], 'no page errors on those days');
  await c3.ctx.close();
  await c2.ctx.close(); await b.close();
};
