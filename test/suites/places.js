/* Checked place records: a place that has closed is skipped by the planner and its replacement joins the list;
   a verified pin moves the place; the official site fills an empty menu link; an outing finds the photo of the real place behind it;
   a guessed pin found far out in the water is taken off the map (no pin beats a wrong one), and a checked city centre is where
   you stay until you pick a place. */
const { launch, open, exampleTrip } = require('../lib/page'); const mkdb = require('../lib/db');
const px = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
exports.run = async t => {
  const seed = {
    'places/italy-rome': { city: 'Rome', country: 'Italy', items: {
      'rome cafe 0': { st: 'closed', note: 'Closed in 2025', replace: { n: 'Caffè Verifica', d: 'Family-run café by the piazza', cuisine: 'Cafe', price: '€', meal: 'breakfast', k: 1, lat: 41.9, lng: 12.48, site: 'https://caffeverifica.example' } },
      'rome cafe 1': { lat: 41.95, lng: 12.5, site: 'https://cafe1.example', hours: { o: 420, c: 780, closed: [] } },
      'rome cafe 2': { nopin: 1, checked: '2026-11-08' },
      'trastevere side streets': { lat: 41.8894, lng: 12.4698, approx: 1, stay: 1 },
    }, center: [41.8986, 12.4769] },
    'photos/italy-rome': { items: { 'piazza navona': { url: px + '#navona', credit: 'Test', page: 'x' } }, city: 'Rome', country: 'Italy' },
  };
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, db: mkdb(seed) }); await exampleTrip(pg);
  await pg.waitForFunction(() => { const p = W.pool('Italy', 'Rome'); return p && p.food.some(x => x.n === 'Caffè Verifica'); }, null, { timeout: 10000 }).catch(() => {});
  const r = await pg.evaluate(() => {
    const p = W.pool('Italy', 'Rome'); const c0 = p.food.find(x => x.n === 'Rome cafe 0'), c1 = p.food.find(x => x.n === 'Rome cafe 1'), rep = p.food.find(x => x.n === 'Caffè Verifica');
    const scheduled = W.P.days.some(d => d.slots.some(s => s.item && s.item.n === 'Rome cafe 0'));
    const ph = W.photoFor({ n: 'Evening stroll with gelato', place: 'Piazza Navona' }, false, 'Italy', 'Rome');
    const c2 = p.food.find(x => x.n === 'Rome cafe 2'), hb = W.homebase('Italy', 'Rome');
    return { st: c0 && c0.st, scheduled, rep: !!rep, repMenu: rep && rep.menu, pin: c1 && [c1.lat, c1.lng], menu: c1 && c1.menu, hours: c1 && c1.hours && c1.hours.o, photo: ph && ph.url.split('#')[1],
      c2: c2 && [c2.lat, c2.lng], home: W.S.stays['Italy|Rome'] && W.S.stays['Italy|Rome'].lat != null ? 'own' : [hb.lat, hb.lng] };
  });
  t.eq(r.st, 'closed', 'a place the check found closed is marked closed');
  t.ok(!r.scheduled, 'and the planner does not schedule it');
  t.ok(r.rep, 'its replacement joins the list');
  t.eq(r.pin, [41.95, 12.5], 'a verified pin moves the place');
  t.eq(r.menu, 'https://cafe1.example', 'the official site fills an empty menu link');
  t.eq(r.hours, 420, 'checked hours fill in');
  t.eq(r.photo, 'navona', 'an outing finds the photo of the real place behind it');
  t.ok(r.c2 && r.c2[0] == null && r.c2[1] == null, 'a pin the check found far out in the water is taken off the map');
  const stay = await pg.evaluate(() => {
    const S = W.S, keep = S.stays['Italy|Rome'];
    S.stays['Italy|Rome'] = { label: 'Trastevere side streets', lat: 41.95, lng: 12.30 }; const a = W.homebase('Italy', 'Rome');
    S.stays['Italy|Rome'] = { label: 'Trastevere side streets', lat: 41.95, lng: 12.30, live: { src: 'Booking.com' } }; const b = W.homebase('Italy', 'Rome');
    if (keep) S.stays['Italy|Rome'] = keep; else delete S.stays['Italy|Rome'];
    return { named: [a.lat, a.lng], booked: [b.lat, b.lng] };
  });
  t.eq(stay.named, [41.8894, 12.4698], 'a stay chosen by name takes its checked pin (its guessed one was in the water)');
  t.eq(stay.booked, [41.95, 12.3], 'a Booking.com pick keeps the hotel\'s own pin');
  t.ok(r.home === 'own' || (r.home[0] === 41.8986 && r.home[1] === 12.4769), `a checked city centre is the stay pin until you pick a place (${r.home})`);
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
