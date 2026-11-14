/* The clock values a family acts on, checked to the minute (v201, the tests audit: four changes to these numbers had
   slipped past every suite because the others only check that a time exists or is in order). On the example trip, at a
   pinned clock, each expected time is worked out here from the plan's own rows and legs, not from the code under test:
     - the toddler's nap: starts when lunch ends plus the way back, lasts 90 minutes, ends by 5:30 pm; a lunch that
       ends so late that the nap would start after 4 pm gives no nap at all
     - "Leave by 11:40 AM for lunch" on the morning's row = the lunch's start minus the walk to it, and the row ends then
     - Today's "Next" card: "Leave in …" / "Leave by …" = the next stop's start minus its leg
     - Today's tomorrow card on a travel day: "leave by" for a booked ticket, "leave about" for an unbooked journey */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg, { home: true }); await settle(pg, 4000);

  /* ---- the nap ---- */
  const nap = await pg.evaluate(() => {
    const P = W.P, out = { days: [], late: null, toddler: !!W.party().toddler };
    const up15 = m => Math.ceil(m / 15) * 15;
    P.days.forEach(d => { const T = d.slots && d.slots.length ? W.dayTimes(d, P) : null; if (!T || !T.nap) return;
      const lunch = T.rows.lunch, home = W.homebase(d.country, d.city), li = d.slots.find(x => x.slot === 'lunch').item, bk = li && !T.nap.away ? W.leg(li, home) : null;
      out.days.push({ n: d.n, start: T.nap.start, end: T.nap.end, away: !!T.nap.away, want: lunch && !lunch.skip ? up15(lunch.end + (bk ? bk.min : 15)) : null, lunchEnd: lunch && lunch.end }); });
    /* a travel day whose lunch place opens at 3 pm: lunch 3:00-4:15, so no nap (it would start after 4 pm) */
    const d0 = P.days.find(d => d.moveFrom), d = Object.assign({}, d0, { slots: d0.slots.map(x => Object.assign({}, x, { item: x.item ? Object.assign({}, x.item) : x.item })) });
    const l = d.slots.find(x => x.slot === 'lunch'); l.item.hours = { o: 900, c: 1380, closed: [] }; l.item.wk = null;
    const T = W.dayTimes(d, P); out.late = { lunch: T.rows.lunch && [T.rows.lunch.start, T.rows.lunch.end], nap: T.nap || null };
    return out; });
  t.ok(nap.toddler && nap.days.length >= 6, 'the example family has toddlers, and most days a nap: ' + nap.days.length);
  t.eq(nap.days.filter(x => !x.away && x.want != null && x.start !== x.want).map(x => 'day ' + x.n + ': ' + x.start + ' wanted ' + x.want), [], 'a nap starts when lunch ends plus the way back to the stay, to the quarter hour');
  t.eq(nap.days.filter(x => x.end - x.start !== (x.away ? 60 : 90)).map(x => x.n), [], 'a nap at the stay lasts 90 minutes (a stroller nap on a day out, an hour)');
  t.eq(nap.days.filter(x => x.end > 17 * 60 + 30 || x.start > 16 * 60).map(x => x.n), [], 'and no nap starts after 4 pm or ends after 5:30 pm');
  const d2 = nap.days.find(x => x.n === 2);
  t.ok(d2 && d2.lunchEnd === 12 * 60 + 45 && d2.start === 13 * 60 && d2.end === 14 * 60 + 30, 'day 2 in Rome: lunch ends 12:45, nap 1:00-2:30 pm: ' + JSON.stringify(d2));
  t.ok(nap.late.lunch && nap.late.lunch[0] === 900 && nap.late.lunch[1] > 960, 'a lunch from 3 pm ends after 4 pm: ' + JSON.stringify(nap.late.lunch));
  t.eq(nap.late.nap, null, 'and then there is no nap (an early night instead), not one at 4:30 pm');

  /* ---- "Leave by … for lunch" on the morning's row, and for dinner on the afternoon's ---- */
  const lv = await pg.evaluate(() => {
    const P = W.P, rows = [];
    /* every day of the trip: whatever "Leave by … for lunch/dinner" the planner wrote equals the meal's start minus the walk to it */
    P.days.forEach(d => { const T = d.slots && d.slots.length ? W.dayTimes(d, P) : null; if (!T) return;
      ['am', 'pm'].forEach(sl => { const R = T.rows[sl], meal = T.rows[sl === 'am' ? 'lunch' : 'dinner']; if (!R || !meal) return;
        const m = (R.info || []).map(s => /^Leave by (.+) for (lunch|dinner)$/.exec(s)).find(Boolean); if (!m) return;
        const x = d.slots.find(y => y.slot === sl), mi = d.slots.find(y => y.slot === (sl === 'am' ? 'lunch' : 'dinner')).item; if (!x.item || x.item.lat == null) return;   /* (a place with no pin is walked from the one before it: not worked out here) */
        const lg = mi ? W.leg(x.item, mi) : null;
        rows.push({ n: d.n, sl, said: m[1], end: R.end, mealStart: meal.start, way: lg ? Math.max(5, lg.min) : 15, clock: W.clock(meal.start - (lg ? Math.max(5, lg.min) : 15)) }); }); });
    /* a morning of three hours at the stay's own day: the planner cuts it short to leave for lunch */
    const d0 = P.days[1], d = Object.assign({}, d0, { slots: d0.slots.map(x => Object.assign({}, x, { item: x.item ? Object.assign({}, x.item) : x.item })) });
    const am = d.slots[1]; am.item.dur = '3 hours'; am.item.hours = null; am.item.wk = null;
    const T = W.dayTimes(d, P), lunchItem = d.slots[2].item, lg = W.leg(am.item, lunchItem);
    return { rows, cut: { info: T.rows.am.info, end: T.rows.am.end, lunchStart: T.rows.lunch.start, way: Math.max(5, lg ? lg.min : 15), clock: W.clock(T.rows.lunch.start - Math.max(5, lg ? lg.min : 15)) } }; });
  t.ok(lv.cut.info.indexOf('Leave by ' + lv.cut.clock + ' for lunch') > -1 && lv.cut.end === lv.cut.lunchStart - lv.cut.way, 'a long morning is cut to leave for lunch: "Leave by ' + lv.cut.clock + ' for lunch", the row ends at ' + lv.cut.end + ' = lunch at ' + lv.cut.lunchStart + ' minus a ' + lv.cut.way + ' minute walk: ' + JSON.stringify(lv.cut.info));
  t.ok(lv.cut.lunchStart === 720 && lv.cut.way === 20 && lv.cut.clock === '11:40 AM', 'on the example\'s day 2: lunch at noon, 20 minutes away, so 11:40 AM');
  t.eq(lv.rows.filter(r => r.said !== r.clock || r.end !== r.mealStart - r.way).map(r => 'day ' + r.n + ' ' + r.sl + ': said ' + r.said + ', wanted ' + r.clock), [], 'every "Leave by … for lunch/dinner" in the example trip is the meal\'s start minus the walk (' + lv.rows.length + ' of them)');

  /* ---- Today's Next card: the next stop's start minus its leg ---- */
  const today = async iso => pg.evaluate(async iso => {
    localStorage.setItem('waypoint-now', iso); W.replan(); W.dataV = (W.dataV || 0) + 1; W.goView('go'); W.render(); await new Promise(r => setTimeout(r, 600)); W.render();
    const P = W.plan(), n = W.todayN(P), d = P.days[n - 1], T = W.dayTimes(d, P), nx = document.querySelector('#viewGo .gh-next'), nm = W.now().getHours() * 60 + W.now().getMinutes();
    const am = d.slots.find(x => x.slot === 'am'), lunch = d.slots.find(x => x.slot === 'lunch'), lg = W.leg(am.item, lunch.item);
    const at = T.rows.lunch.start - lg.min, mins = at - nm;
    return { n, nm, text: nx ? nx.textContent.replace(/\s+/g, ' ').trim() : '', leave: nx && nx.querySelector('.leave') ? nx.querySelector('.leave').textContent.replace(/\s+/g, ' ').trim() : '', lunchStart: T.rows.lunch.start, amStart: T.rows.am.start, amEnd: T.rows.am.end, leg: lg.min, at, mins,
      wantBy: 'Leave by ' + W.clock(at), wantIn: 'Leave in ' + W.fmtMin(Math.max(5, Math.round(mins / 5) * 5)) }; }, iso);
  let a = await today('2027-06-09T10:00:00');
  t.ok(a.n === 3 && a.lunchStart === 720 && a.leg === 15 && a.nm === 600, 'day 3 at 10:00 in the morning stop; lunch at noon, 15 minutes\' walk: ' + JSON.stringify([a.n, a.lunchStart, a.leg, a.nm]));
  t.ok(a.mins > 90 && a.leave.indexOf(a.wantBy + ' ') === 0 && a.wantBy === 'Leave by 11:45 AM', 'more than 90 minutes ahead Today says the clock: "' + a.leave + '" (the stop starts 12:00, the walk is 15 minutes)');
  a = await today('2027-06-09T10:30:00');
  t.ok(a.mins === 75 && a.leave.indexOf(a.wantIn + ' ') === 0 && a.wantIn === 'Leave in 1h 15m', 'within 90 minutes it says how long: "' + a.leave + '"');
  a = await today('2027-06-09T11:25:00');
  t.ok(a.mins === 20 && a.leave.indexOf('Leave in 20 min') === 0, 'at 11:25, in the last minutes of the morning stop (it ends 11:30), it is 20 minutes: "' + a.leave + '"');

  /* ---- the tomorrow card on a travel day ---- */
  const up = async iso => pg.evaluate(async iso => { localStorage.setItem('waypoint-now', iso); W.replan(); W.dataV = (W.dataV || 0) + 1; W.goView('go'); W.render(); await new Promise(r => setTimeout(r, 600)); W.render();
    const u = document.querySelector('#viewGo .go-up'), P = W.plan(), tom = P.days[W.todayN(P)], T = W.dayTimes(tom, P);
    return { text: u ? u.textContent.replace(/\s+/g, ' ').trim() : '', travel: T.travel && { start: T.travel.start, ticket: !!T.travel.ticket }, moveFrom: tom.moveFrom, n: tom.n }; }, iso);
  let u = await up('2027-06-10T19:00:00');
  t.ok(u.moveFrom && u.n === 5 && u.travel && !u.travel.ticket && u.travel.start === 9 * 60 + 30, 'tomorrow, day 5, is a travel day with no ticket, setting off at 9:30: ' + JSON.stringify(u.travel));
  t.ok(/ · leave about 9:30 AM/.test(u.text) && !/leave by/.test(u.text), 'with no ticket the card says "leave about 9:30 AM": ' + u.text);
  await pg.evaluate(() => { const iso = W.isoDay(W.dateOf(5)); W.S.bookings = (W.S.bookings || []).concat([{ id: 'h-tk1', kind: 'train', title: 'Frecciarossa 9521', place: '', to: '', start: iso + 'T14:10', end: iso + 'T15:45', price: 0, cur: 'EUR', ref: 'PNR7Q', provider: '', what: '', url: '', src: 'hand' }]); W.changed(); });
  u = await up('2027-06-10T19:00:00');
  t.ok(u.travel && u.travel.ticket && u.travel.start === 14 * 60 + 10 - 45, 'with a train at 2:10 pm you set off at 1:25 pm: ' + JSON.stringify(u.travel));
  t.ok(/ · leave by 1:25 PM/.test(u.text) && !/leave about/.test(u.text), 'and the card says "leave by 1:25 PM": ' + u.text);
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
