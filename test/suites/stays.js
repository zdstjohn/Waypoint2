/* Where to stay (the stay panel in Plan, and the same panel as a sheet from "Pick a place"): a stay you booked
   already, the suggested areas and hotels, and the other sites. v152: no Booking.com search in it any more (you asked
   for it gone); a stay picked from that search before keeps its price, and the price watch still asks Booking.com for
   your nights (W.stayInput). */
const { launch, open, exampleTrip, settle } = require('../lib/page');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844 }); await exampleTrip(pg);
  await pg.evaluate(() => { W.S.travelers = [38, 36, 7, 4]; W.goView('setup'); W.render(); }); await settle(pg, 3000);
  await pg.evaluate(() => { (W.S.stepClosed = W.S.stepClosed || {}).where = false; W.render(); document.querySelector('[data-openstay="0"]').click(); });
  await pg.waitForTimeout(500);
  const ui = await pg.evaluate(() => { const p = document.querySelector('.stay-panel'); return p && { search: !!p.querySelector('.sfind, [data-sfq], [data-sfgo]'), words: /Search Booking\.com/.test(p.textContent), booked: !!p.querySelector('#stayIn0'), sites: p.textContent.length }; });
  t.ok(ui && !ui.search && !ui.words && ui.booked, 'the stay panel has no Booking.com search; "Already booked?" stays: ' + JSON.stringify(ui));
  /* a stay picked from the old search keeps its price in the budget and its booking link */
  const kept = await pg.evaluate(() => { const s = W.P.stops[0], ck = W.cityKey(s.country, s.name);
    W.S.stays[ck] = { label: 'Casa Familia Roma', lat: 41.9, lng: 12.47, live: { total: 1240, cur: 'EUR', url: 'https://www.booking.com/hotel/it/casa-familia.html', at: Date.now(), src: 'Booking.com' } }; W.changed(); W.render();
    const I = W.stayInput(ck, W.P, 'Casa Familia Roma');
    return { label: W.S.stays[ck].label, total: W.S.stays[ck].live.total, watch: !!(I && I.input && I.input.hotel_names && I.input.hotel_names[0] === 'Casa Familia Roma' && /^\d{4}-\d\d-\d\d$/.test(I.input.checkin_date)) }; });
  t.ok(kept.total === 1240 && kept.watch, 'a stay picked from it before keeps its price, and the price watch still asks for your nights: ' + JSON.stringify(kept));
  /* the same panel as a sheet, from another screen */
  await pg.evaluate(() => { W.goView('go'); W.render(); W.staySheet(0); }); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(() => !!document.querySelector('#stayhost .stay-panel') && !document.querySelector('#stayhost .sfind')), 'and the "Pick a place" sheet is the same panel, without the search');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
