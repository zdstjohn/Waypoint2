/* The price watch (lib/watch.js): your hotel and your flights are re-checked, and a drop of 3% or more (and at least 10 in
   the money's own units, the same currency) shows on Book ahead as a "Price drop" line and on the row's chip. Checked
   with the watches kept in the account's database (a stand-in here): which ones count as a drop and which don't, what the
   banner and the list say (and that a link that is not https is not made a link), what a re-check writes back for a price
   found, a price not found and a price that is lower, starting a watch from the hotel row, stopping one, and that a trip
   that is only viewed (or another trip's watch) shows none. */
const { launch, open, exampleTrip, settle, until } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg); await settle(pg, 3000);
  const tid = await pg.evaluate(() => { if (!W.S.tripId) W.S.tripId = 'trip-watch-test'; W.changed(); return W.S.tripId; });
  const PATH = 'data/users/u-test/watch/w/';
  const put = (id, doc) => pg.evaluate(([p, d]) => window.__dbOp('set', p, JSON.stringify(d)), [PATH + id, doc]);
  const get = id => pg.evaluate(p => window.__dbOp('get', p, null), PATH + id).then(s => s ? JSON.parse(s) : null);
  const now = Date.now(), H = 3600e3;
  const mk = (o) => Object.assign({ trip: tid, tripName: 'Test', kind: 'fare', key: 'k', server: 'Expedia', tool: 'search_flights', input: { departure_date: '2099-01-01' }, label: 'x', end: '2099-01-01', url: 'https://www.booking.com/x',
    base: { total: 1000, cur: 'EUR', at: now }, last: { total: 1000, cur: 'EUR', at: now }, hist: [], updated: now }, o);
  const at = (base, last, o) => mk(Object.assign({ base: { total: base, cur: 'EUR', at: now }, last: { total: last, cur: 'EUR', at: now } }, o));

  /* ---- what counts as a drop: 3% and at least 10, in one currency, on this trip ---- */
  await put('d1', at(400, 300, { label: 'Rome to Venice fare' }));                       /* 100 off 400: a drop */
  await put('d2', at(900, 860, { label: 'Florence stay', kind: 'stay', url: 'javascript:alert(1)' }));   /* 40 off 900 (4.4%): a drop; the link is not https, so no link */
  await put('n1', at(900, 882, { label: 'Small stay' }));                               /* 18 off 900 is 2%: not */
  await put('n2', at(100, 95, { label: 'Tiny fare' }));                                 /* 5 off 100 is under 10: not */
  await put('n3', mk({ label: 'Other currency', base: { total: 500, cur: 'EUR', at: now }, last: { total: 100, cur: 'USD', at: now } }));   /* a different currency can't be compared */
  await put('n4', at(400, 300, { label: 'Another trip', trip: 'someone-elses-trip' }));
  await put('n5', mk({ label: 'Never checked', last: null }));
  await put('e1', at(2000, 1940, { label: 'Exactly 3 percent' }));                      /* 60 off 2000: exactly 3%: a drop */
  await put('e2', at(2000, 1941, { label: 'Just under 3 percent' }));                   /* 59: not */
  await until(() => pg.evaluate(() => W.watchDrops().length >= 3), 8000, 200);
  const drops = await pg.evaluate(() => W.watchDrops().map(w => w.label).sort());
  t.eq(drops, ['Exactly 3 percent', 'Florence stay', 'Rome to Venice fare'], 'this trip\'s drops: 3% or more and at least 10, same currency; not 2%, not 5 off 100, not a currency change, not another trip\'s, not an unchecked one');
  const dv = await pg.evaluate(() => ({ a: W.watchDrop({ base: { total: 400, cur: 'EUR' }, last: { total: 300, cur: 'EUR' } }), b: W.watchDrop({ base: { total: 400, cur: 'EUR' }, last: { total: 500, cur: 'EUR' } }), c: W.watchDrop({ base: { total: 400, cur: 'EUR' }, last: { total: 0, cur: 'EUR' } }), d: W.watchDrop(null) }));
  t.eq(dv, { a: { save: 100, now: 300, was: 400, cur: 'EUR' }, b: null, c: null, d: null }, 'a drop says what it saves, what it is now and what it was; a rise, a zero and nothing are no drop');

  /* ---- the banner on Book ahead and the list ---- */
  await pg.evaluate(() => { W.goView('book'); W.render(); });
  await until(() => pg.evaluate(() => document.querySelectorAll('#viewBook .wdrop p').length === 3), 6000, 200);
  const ban = await pg.evaluate(() => { const ps = [...document.querySelectorAll('#viewBook .wdrop p')].map(p => ({ text: p.textContent.replace(/\s+/g, ' ').trim(), link: p.querySelector('a') ? p.querySelector('a').getAttribute('href') : null }));
    return { ps, rome: W.money(300, 'EUR'), was: W.money(400, 'EUR') }; });
  t.eq(ban.ps.length, 3, 'Book ahead shows one "Price drop" line for each of the three');
  const rome = ban.ps.find(p => /Rome to Venice/.test(p.text)), flo = ban.ps.find(p => /Florence stay/.test(p.text));
  t.ok(rome && rome.text.indexOf('Price drop Rome to Venice fare: ' + ban.rome + ' (was ' + ban.was + ')') === 0 && rome.link === 'https://www.booking.com/x' && /Book/.test(rome.text), 'the line says the new price and the old one, with a Book link: ' + (rome && rome.text));
  t.ok(flo && flo.link === null && !/Book/.test(flo.text), 'a watch whose link is not https gets no link: ' + (flo && flo.text));
  const list = await pg.evaluate(() => [...document.querySelectorAll('#viewBook .wlist li')].map(li => ({ drop: li.classList.contains('drop'), text: li.textContent.replace(/\s+/g, ' ').trim() })));
  t.ok(list.length === 8 && list.filter(l => l.drop).length === 3 && list.some(l => /^Never checked/.test(l.text)) && !list.some(l => /Another trip/.test(l.text)), 'the list holds this trip\'s eight watches (three marked as drops), not another trip\'s: ' + list.length);
  /* stopping one */
  const stopped = await pg.evaluate(() => { const b = document.querySelector('#viewBook [data-unwatch="n2"]'); if (b) b.click(); return !!b; });
  await until(() => get('n2').then(d => !d), 6000, 200);
  t.ok(stopped && !(await get('n2')), 'Stop takes the watch away: it is deleted from the account');

  /* ---- a re-check (stale ones are re-checked when the trip opens), against what the stand-in's Booking.com and Expedia answer ---- */
  const old = now - 10 * H;
  await put('r1', mk({ kind: 'stay', server: 'Booking.com', tool: 'accommodations_search', input: { destination: 'Rome, Italy', checkin_date: '2099-01-01' }, match: 'Casa Familia Rome', label: 'Casa Familia, Rome', base: { total: 1000, cur: 'EUR', at: old }, last: { total: 1000, cur: 'EUR', at: old }, hist: [[old, 1000]] }));
  await put('r2', mk({ kind: 'stay', server: 'Booking.com', tool: 'accommodations_search', input: { destination: 'Rome, Italy', checkin_date: '2099-01-01' }, match: 'Hotel That Is Not There', label: 'Missing hotel', base: { total: 700, cur: 'EUR', at: old }, last: { total: 700, cur: 'EUR', at: old } }));
  await put('r3', mk({ kind: 'fare', input: { departure_date: '2099-01-01' }, label: 'Seattle to Rome', base: { total: 2800, cur: 'USD', at: old }, last: { total: 2800, cur: 'USD', at: old }, hist: [[old, 2800]] }));
  const r1 = await until(() => get('r1').then(d => d && d.last && d.last.total !== 1000 ? d : null), 12000, 300);
  t.ok(r1 && r1.last.total === 912.4 && r1.last.cur === 'EUR' && r1.base.total === 1000 && r1.hist.length === 2 && r1.low && r1.low.total === 912.4 && r1.miss === false, 'a stale hotel watch is re-checked: found at 912.40, the first price kept as the base, the history grows, the low is noted: ' + JSON.stringify(r1 && { last: r1.last.total, hist: r1.hist.length, low: r1.low, miss: r1.miss }));
  const r2 = await until(() => get('r2').then(d => d && d.miss ? d : null), 12000, 300);
  t.ok(r2 && r2.miss === true && r2.last.total === 700 && r2.last.at > old, 'a hotel the search no longer lists keeps its last price, marked "not found", and is counted as checked: ' + JSON.stringify(r2 && { miss: r2.miss, last: r2.last.total }));
  const r3 = await until(() => get('r3').then(d => d && d.last && d.last.total !== 2800 ? d : null), 12000, 300);
  t.ok(r3 && r3.last.total === 2480 && r3.last.cur === 'USD' && r3.low.total === 2480, 'a flight watch takes the cheapest option: 2,480 USD: ' + JSON.stringify(r3 && r3.last));
  await pg.evaluate(() => { W.render(); });
  const after = await pg.evaluate(() => W.watchDrops().map(w => w.label).sort());
  t.ok(after.includes('Casa Familia, Rome') && after.includes('Seattle to Rome') && !after.includes('Missing hotel'), 'and the re-checked ones that got cheaper now show as drops: ' + JSON.stringify(after));
  const asked = await pg.evaluate(() => window.__mcp.filter(c => c[1] === 'accommodations_search' || c[1] === 'search_flights').length);
  t.ok(asked >= 3 && asked <= 4, 'only the three stale ones were asked about, not the fresh ones: ' + asked);

  /* ---- starting a watch from the hotel row, and the chip it leaves ---- */
  const start = await pg.evaluate(() => { const P = W.P, s = P.stops[0], ck = W.cityKey(s.country, s.name), dt = W.stayDates(s, P);
    W.S.stays[ck] = { label: 'Hotel X', live: { total: 900, cur: 'EUR', url: 'https://www.booking.com/x', at: Date.now(), in: dt.in, out: dt.out, src: 'Booking.com' } }; W.render();
    const chip = W.watchChip('stay', ck, P), ok = W.watchClick({ watch: 'stay', wkey: ck }, P); return { ck, chip, ok, nights: dt.nights }; });
  t.ok(/data-watch="stay"/.test(start.chip) && /Watch price/.test(start.chip) && start.ok, 'a hotel with a price for its nights offers "Watch price", and tapping it starts one');
  const ids = await until(() => pg.evaluate(() => window.__dbOp('list', 'data/users/u-test/watch/w', null)).then(s => { const l = s ? JSON.parse(s) : []; return l.find(x => x.body && x.body.key && /Hotel X/.test(x.body.label || '')) || null; }), 8000, 200);
  t.ok(ids && ids.body.kind === 'stay' && ids.body.base.total === 900 && ids.body.last.total === 900 && ids.body.trip === tid && ids.body.match === 'Hotel X' && ids.body.server === 'Booking.com' && ids.body.label === 'Hotel X, ' + start.ck.split('|')[1] + ' · ' + start.nights + ' night' + (start.nights > 1 ? 's' : ''),
    'the watch is kept with its first price as both the base and the last, the trip, the hotel\'s name and a label with the nights: ' + JSON.stringify(ids && ids.body.label));
  const chip2 = await until(() => pg.evaluate(ck => W.watchChip('stay', ck, W.P), start.ck).then(c => /data-unwatch/.test(c) ? c : null), 6000, 200);
  t.ok(chip2 && /Watching/.test(chip2) && /€900|900/.test(chip2), 'the chip then says "Watching" with the price: ' + (chip2 || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 80));

  /* ---- a trip you only view shows none ---- */
  const ro = await pg.evaluate(() => { W.readOnly = true; const r = { drops: W.watchDrops().length, banner: W.watchBanner(), list: W.watchList(), chip: W.watchChip('stay', 'x|y', W.P) }; W.readOnly = false; return r; });
  t.eq(ro, { drops: 0, banner: '', list: '', chip: '' }, 'a trip you only view shows no drops, no list and no chip');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
