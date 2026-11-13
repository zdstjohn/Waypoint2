/* v176: what the code review found, held down. A spreadsheet keeps negative numbers as numbers; a calendar entry that
   ends after midnight ends the next day; "leaving today/tomorrow" on the booking timeline; a Booking.com price only
   while it is for the nights you have; the latest a stop may start, shared by the planner and "way behind"; an idea
   with half a pin doesn't stop Explore drawing. */
const { launch, open, exampleTrip, settle } = require('../lib/page');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844 }); await exampleTrip(pg);
  await pg.waitForFunction(() => W.laterReady, null, { timeout: 15000 }).catch(() => {});

  /* the itinerary as CSV: -9.1393 stays a number, "=SUM(1)" is still made text */
  const csv = await pg.evaluate(async () => {
    let text = ''; const real = W.saveFile; W.saveFile = (n, blob) => blob.text().then(x => { text = x; });
    const d = W.P.days[0], x = d.slots.find(s => s.item); x.item.lng = -9.1393; x.item.n = '=SUM(1)';
    await W.csvExport(W.P); W.saveFile = real; return text;
  });
  t.ok(/,-9\.1393(,|\r|$)/.test(csv) && !/'-9\.1393/.test(csv) && /'=SUM\(1\)/.test(csv), 'CSV: a negative number stays a number, a formula-looking name is text');

  /* a calendar time after midnight is the next day */
  const iso = await pg.evaluate(() => [W.iso(new Date(2027, 5, 8), 1470), W.iso(new Date(2027, 5, 30), 1440 + 15), W.iso(new Date(2027, 5, 8), 600)]);
  t.eq(iso, ['2027-06-09T00:30:00', '2027-07-01T00:15:00', '2027-06-08T10:00:00'], 'calendar times past midnight fall on the next day');

  /* the booking timeline: today, tomorrow, in 3 days */
  const tl = await pg.evaluate(() => { const t0 = new Date(2027, 2, 10, 9, 0), d = n => W.isoDay(new Date(2027, 2, 10 + n));
    const say = n => ((W.bookTimeline([], t0, d(n)).match(/leaving[^<]*/) || [''])[0]);
    return [say(0), say(1), say(3)]; });
  t.eq(tl, ['leaving today', 'leaving tomorrow', 'leaving in 3 days'], 'the booking timeline counts days right');

  /* a Booking.com price counts only while it is for the nights you have */
  const sl = await pg.evaluate(() => { const s = W.P.stops[0], dt = W.stayDates(s, W.P);
    const ok = W.stayLive({ label: 'X', live: { total: 900, cur: 'EUR', url: '', at: 1, in: dt.in, out: dt.out, src: 'Booking.com' } }, s, W.P);
    const old = W.stayLive({ label: 'X', live: { total: 900, cur: 'EUR', url: '', at: 1, in: '2020-01-01', out: '2020-01-03', src: 'Booking.com' } }, s, W.P);
    return { ok: !!ok, old: !!old }; });
  t.ok(sl.ok && !sl.old, 'a Booking.com price for other nights no longer counts: ' + JSON.stringify(sl));

  /* the latest a stop may start, one rule for the planner and the "way behind" rescue */
  t.eq(await pg.evaluate(() => [W.slotCap('dinner', { kid: true }), W.slotCap('dinner', { kid: false }), W.slotCap('eve', { toddler: true, kid: true })]), [1230, 1305, 1200], 'the latest start of dinner and the evening, by who comes');

  /* an idea with half a pin: Explore still draws */
  await pg.evaluate(() => { const d = W.P.days[1], c = W.C.city[W.cityKey(d.country, d.city)]; c.spots.push({ n: 'Half a pin', d: '', lat: 41.9, lng: null, k: 'all', t: [] });
    W.S.day = 2; W.S.tview = 'map'; W.goView('trip'); W.render(); }); await settle(pg, 1500);
  t.ok(await pg.evaluate(() => !!document.querySelector('#viewTrip .idea, #viewTrip .scard, #viewTrip .psearch')), 'Explore draws with an idea that has half a pin');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
