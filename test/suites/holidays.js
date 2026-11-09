/* Holidays and festivals: the national public holidays worked out in the app (Easter and Orthodox Easter, "the last
   Monday of May", Japan's substitute days) match the real calendars; a public holiday is planned like a Sunday (a place
   that shuts on Sundays is not planned that day, and the day says so); the city's own holidays and festivals come from
   Claude for the dates of the stay, out-of-range answers dropped, and show on their day. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg);
  const cal = await pg.evaluate(() => ({
    easter: [2025, 2026, 2027, 2028].map(W.easter), orth: [2025, 2026, 2027, 2028].map(W.orthodoxEaster),
    es: W.holidaysBetween('Spain', '2027-01-01', '2027-12-31').map(h => h.iso + ' ' + h.n.split(' (')[0]),
    gr: W.holidaysOn('Greece', '2027-05-02').map(h => h.n), uk: W.holidaysBetween('United Kingdom', '2027-05-01', '2027-05-31').map(h => h.iso),
    jp: W.holidaysOn('Japan', '2027-03-22').map(h => h.n), it: W.holidaysOn('Italy', '2027-08-15').map(h => h.n + '/' + h.big), none: W.holidaysOn('Italy', '2027-08-16')
  }));
  t.eq(cal.easter, ['2025-04-20', '2026-04-05', '2027-03-28', '2028-04-16'], 'Easter Sunday');
  t.eq(cal.orth, ['2025-04-20', '2026-04-12', '2027-05-02', '2028-04-16'], 'Orthodox Easter');
  t.ok(cal.es.includes('2027-03-26 Good Friday') && cal.es.includes('2027-10-12 National Day of Spain') && cal.es.length === 11, 'Spain\'s national holidays for 2027: ' + cal.es.length);
  t.eq(cal.gr, ['Orthodox Easter Sunday'], 'Greece: Orthodox Easter Sunday 2027 is 2 May');
  t.eq(cal.uk, ['2027-05-03', '2027-05-31'], 'UK May bank holidays (first and last Monday)');
  t.ok(cal.jp.length === 1 && /Substitute/.test(cal.jp[0]), 'Japan: the equinox on a Sunday moves the day off to Monday: ' + JSON.stringify(cal.jp));
  t.eq(cal.it, ['Ferragosto/2'], 'Italy: Ferragosto, a big one'); t.eq(cal.none, [], 'and none the day after');

  /* a trip over Italy's Republic Day (2 June): start on 31 May, so Rome's third day is the holiday */
  const r = await pg.evaluate(async () => {
    W.S.start = '2027-05-31'; W.changed(); W.replan();
    for (let i = 0; i < 40 && W.plan().days.some(d => d.loading); i++) await new Promise(r => setTimeout(r, 200));
    const P = W.plan(), hd = P.days.find(d => W.isoDay(W.dateOf(d.n)) === '2027-06-02');
    if (!hd) return null;
    /* half the city's sights shut on Sundays */
    const pool = W.pool(hd.country, hd.city); let n = 0;
    pool.spots.forEach((s, i) => { if (i % 2 === 0) { s.hours = { o: 540, c: 1080, closed: [0] }; n++; } });
    W.S.picks = {}; W.changed(); W.replan();
    const P2 = W.plan(), d2 = P2.days.find(d => d.n === hd.n), others = P2.days.filter(d => d.city === hd.city && d.n !== hd.n);
    const shutOn = d => (d.slots || []).filter(x => x.item && !W.isFood(x.slot) && x.item.hours && x.item.hours.closed.indexOf(0) > -1 && W.weekday(d.n) !== 0).map(x => x.item.n);
    W.S.day = hd.n; W.S.tview = 'days'; W.render();
    const line = document.querySelector('#viewTrip .day-hol');
    return { n: hd.n, city: hd.city, marked: n, onHoliday: shutOn(d2), elsewhere: others.reduce((a, d) => a.concat(shutOn(d)), []).length, hol: W.dayHolidays(d2).map(h => h.n), line: line ? line.innerText : '' };
  });
  t.ok(r && r.hol.includes('Republic Day'), 'the trip day on 2 June is Republic Day: ' + JSON.stringify(r && r.hol));
  if (r) {
    t.eq(r.onHoliday, [], `nothing that shuts on Sundays is planned on the holiday (${r.marked} of ${r.city}'s sights do)`);
    t.ok(r.elsewhere > 0, 'while those places still appear on the other days in ' + r.city + ' (' + r.elsewhere + ')');
    t.ok(/Public holiday: Republic Day/.test(r.line), 'and the day says so: ' + r.line);
  }
  /* the city's own holidays and festivals, from Claude, for the dates of the stay */
  await pg.evaluate(() => { W.render(); });
  await pg.waitForFunction(() => W.C.events && W.C.events['Italy|Rome'], null, { timeout: 15000 }).catch(() => {});
  const ev = await pg.evaluate(() => {
    const c = W.C.events['Italy|Rome'], P = W.plan(), first = P.days.find(d => d.city === 'Rome'), pr = (window.__eventsPrompts || []).filter(p => /in or near Rome, Italy between 2027-05-31/.test(p)).pop() || '';
    W.S.day = first.n; W.render(); const evl = document.querySelector('#viewTrip .day-ev');
    return { c: c && { from: c.from, to: c.to, items: c.items.map(e => e.n) }, named: /Republic Day/.test(pr) && /do not repeat/.test(pr), line: evl ? evl.innerText : '' };
  });
  t.ok(ev.c && ev.c.from === '2027-05-31', 'Claude is asked about Rome for the days of the stay: ' + JSON.stringify(ev.c));
  t.ok(ev.named, 'the question names the national holidays already known, so they are not repeated');
  t.eq(ev.c && ev.c.items, ['Infiorata'], 'answers outside the stay are dropped');
  t.ok(/Infiorata/.test(ev.line) && /from Claude/.test(ev.line), 'the festival shows on its day, marked as from Claude: ' + ev.line);
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
