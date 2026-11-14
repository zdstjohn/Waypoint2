/* v193: a day out and a rest day, as the owner chose them ("B" and "E" of five each), and the next day on Today ("E").
   A morning that takes the whole day, 34 km out: its stops under one band titled for it, the parts of the day left open
   while out shown as one free-time row, the toddlers' nap on the go (not back at the hotel from 34 km away), and the map
   of where you go (or none), never the home town's. A rest day's morning and evening: a calm card, nothing to pick (v194). Today: tomorrow in a banner above tonight, its button reading "Next day"; the day bag folded. */
const { launch, open, settle } = require('../lib/page');
exports.run = async t => {
  const b = await launch(); const { pg, errors } = await open(b, { width: 390, height: 844 });
  await pg.evaluate(() => { W.newTripFrom({ v: 2, algo: 2, styles: ['culture', 'food'], countries: [{ mode: 'manual', name: 'Spain', picked: ['Barcelona'] }], days: 6, start: '2027-06-14', depart: 'Seattle (SEA)', travelers: [41, 40, 6, 3], stays: {} }); });
  await pg.waitForFunction(() => W.P && W.P.days && W.P.days.length === 6 && (W.P.days[2].slots || []).some(x => x.item), null, { timeout: 30000 });
  await settle(pg, 3000);
  await pg.evaluate(() => { const x = document.querySelector('button[data-qs="close"]'); if (x) x.click(); W.S.day = 3; W.S.tview = 'days'; W.goView('trip'); W.render(); });
  await pg.waitForTimeout(800);
  /* day 3: a morning that takes the whole day, far out; breakfast and lunch pinned beside it */
  const setUp = await pg.evaluate(() => {
    W.S.stays['Spain|Barcelona'] = { label: 'Generator Barcelona', lat: 41.3989, lng: 2.1645 };
    const d = W.plan().days[2], get = s => d.slots.find(x => x.slot === s), am = get('am').item, lu = get('lunch').item;
    Object.assign(am, { n: 'Montserrat Monastery and mountain day trip', place: 'Montserrat', s: 'any', dur: 'full day', lat: 41.5934, lng: 1.8375 });
    Object.assign(lu, { n: 'Restaurant Abat Cisneros', lat: 41.5932, lng: 1.8381 });
    W.S.picks[get('am').key] = am.n; W.S.picks[get('lunch').key] = lu.n; ['pm', 'dinner', 'eve'].forEach(s => { delete W.S.picks[get(s).key]; });
    W.dataV++; W.render();
    const d2 = W.P.days[2]; return { full: !!d2.fullDay, out: W.dayOut(d2) && W.dayOut(d2).name, am: (d2.slots.find(x => x.slot === 'am').item || {}).n };
  });
  t.ok(setUp.full && setUp.out === 'Montserrat' && /Montserrat/.test(setUp.am), 'a morning that takes the whole day, 34 km out, is a day out: ' + JSON.stringify(setUp));
  const band = await pg.evaluate(() => { const bd = document.querySelector('#viewTrip .slots .dt-band'); if (!bd) return null;
    return { title: bd.querySelector('.dt-band-h').textContent, cards: [...bd.querySelectorAll('article.slot')].map(a => a.dataset.slotkey.split('|').pop()), free: [...bd.querySelectorAll('article.dt-free')].map(a => a.querySelector('.nm').textContent + ' / ' + a.querySelector('.when').textContent),
      emptyRows: [...document.querySelectorAll('#viewTrip .slots article.free:not(.dt-free)')].length, nap: (document.querySelector('#viewTrip .travel-note.nap') || {}).textContent || '' }; });
  t.ok(band && /^Day trip · Montserrat · \d/.test(band.title), 'its stops are grouped under one band, titled for where you go and when: ' + (band && band.title));
  t.ok(band && band.cards[0] === 'am' && band.cards.includes('lunch'), 'the outing and lunch are inside it: ' + JSON.stringify(band && band.cards));
  t.ok(band && band.free.length === 1 && /^Free time at Montserrat \/ Afternoon, dinner and evening$/.test(band.free[0]) && band.emptyRows === 0, 'the afternoon, dinner and evening left open while out are one free-time row: ' + JSON.stringify(band && band.free));
  t.ok(band && /stroller or the car: you're out at Montserrat/.test(band.nap) && !/back at/.test(band.nap), 'the toddlers\' nap is on the go, not back at the hotel: ' + (band && band.nap));
  /* the map of where you go: that place's pack, or none, never the home town's */
  const maps = await pg.evaluate(() => { const f = W.vtFor, d = W.P.days[2], home = W.homebase('Spain', 'Barcelona'), pts = [{ n: 'a', lat: 41.5934, lng: 1.8375 }, { n: 'b', lat: 41.39, lng: 2.17 }];
    W.vtFor = (c, city, lat, lng) => lat > 41.5 ? 'spain-montserrat' : 'spain-barcelona'; const withPack = W.vtForDay(d, home, pts);
    W.vtFor = (c, city, lat, lng) => lat > 41.5 ? null : 'spain-barcelona'; const none = W.vtForDay(d, home, pts);
    const plain = W.vtForDay(W.P.days[1], home, pts); W.vtFor = f; return { withPack, none, plain }; });
  t.ok(maps.withPack.slug === 'spain-montserrat' && maps.withPack.pts.length === 1 && maps.withPack.place === 'Montserrat', 'a far day out shows the map of where you go, framed on the stops there: ' + JSON.stringify(maps.withPack));
  t.ok(maps.none.slug === null && maps.plain.slug === 'spain-barcelona', 'with no map of that place, no street map (not the home town\'s); any other day keeps the town\'s: ' + JSON.stringify([maps.none.slug, maps.plain.slug]));
  /* a rest day */
  await pg.evaluate(() => { W.S.rest = W.S.rest || {}; W.S.rest['Spain|Barcelona|5'] = 1; W.S.day = 5; W.render(); }); await pg.waitForTimeout(500);
  const rest = await pg.evaluate(() => [...document.querySelectorAll('#viewTrip .rest-c')].map(a => ({ cls: a.className, t: a.querySelector('.rc-t').textContent, picks: a.querySelectorAll('button, .chip').length })));
  t.ok(rest.length === 2 && /Rest morning$/.test(rest[0].t) && /Quiet evening$/.test(rest[1].t) && rest.every(r => r.picks === 0), 'a rest day\'s morning and evening are calm cards, with nothing to pick (v194): ' + JSON.stringify(rest));
  t.ok(!(await pg.evaluate(() => /Rest, pool or playground/.test(document.querySelector('#viewTrip .slots').textContent))), 'no more "Rest, pool or playground" rows');
  /* Today, the evening before the day out */
  await pg.evaluate(() => { localStorage.setItem('waypoint-now', '2027-06-15T17:30:00'); W.S.day = 2; W.goView('go'); W.render(); }); await pg.waitForTimeout(1200);
  const today = await pg.evaluate(() => { const up = document.querySelector('#viewGo .go-up'), eve = document.querySelector('#viewGo .go-eve'), bag = document.querySelector('#viewGo details.go-fold[data-gofold="bag"]');
    return { up: up && up.textContent, below: !!(up && eve && eve.compareDocumentPosition(up) & 4), btn: up && (up.querySelector('[data-goprev]') || {}).textContent, rowGone: !(eve && /Tomorrow/.test(eve.textContent)), bag: bag ? bag.open : null }; });
  t.ok(today.up && /^Up next · Day 3/.test(today.up) && /Day trip to Montserrat/.test(today.up) && today.below && today.btn === 'Next day' && today.rowGone, 'Today: tomorrow in a banner below tonight (v202, the owner\'s ask), with "Next day": ' + JSON.stringify(today));
  t.ok(today.bag === false, 'the day bag is folded by default');
  t.eq(errors(), [], 'no page errors');
  await b.close();
};
