/* One door for Claude's answers (lib/validate.js): a place with no usable name is dropped; a pin at 0,0, off the
   Earth or on another continent is cleared (the place stays, without a pin); ratings, kid scores, times of day, meals
   and tags must be values the app knows; links go through the own-site rule; duplicates are folded; the city list,
   hours, beaches, ranges and money go through the same door. */
const { launch, open } = require('../lib/page');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390 });
  const r = await pg.evaluate(() => {
    const V = W.V, rome = { lat: 41.9, lng: 12.5 }; V.stats = { dropped: 0, cleared: 0, farPins: 0 };
    const spots = V.list([
      { n: 'Colosseum', d: 'Amphitheatre', t: ['culture', 'bogus'], k: 7, s: 'noon', fame: 2, rating: 4.7, lat: 41.8902, lng: 12.4922, book: 'https://www.getyourguide.com/x', pic: 'oldtown' },
      { n: '', d: 'no name', lat: 41.9, lng: 12.5 },
      { n: 'null', lat: 41.9, lng: 12.5 },
      { n: 'Pantheon', lat: 0, lng: 0, rating: '9', k: '-1', s: 'am', fame: 1 },
      { n: 'Far away', lat: 48.85, lng: 2.35, fame: 0 },
      { n: 'Colosseum ', d: 'again' },
      'not an object', null,
      { n: 'Off the planet', lat: 95, lng: 200 },
      { n: 'Long ' + 'x'.repeat(200), lat: 41.91, lng: 12.49, book: 'https://www.museivaticani.va/tickets' },
    ], x => V.spot(x, rome));
    const food = V.list([{ n: 'Roscioli', meal: 'brunch', price: '€€', reserve: 'yes', menu: 'http://www.roscioli.com/menu', lat: 41.894, lng: 12.473 }], x => V.food(x, rome));
    const cities = V.list([{ name: 'Rome', lat: 41.9, lng: 12.5, w: 9, pop: 0, t: ['culture'] }, { name: '' }, { name: 'Florence', lat: '43.77', lng: '11.25', w: '2.4' }], V.city);
    return {
      names: spots.map(x => x.n.slice(0, 12)), col: spots[0], pan: spots.find(x => x.n === 'Pantheon'), far: spots.find(x => x.n === 'Far away'), off: spots.find(x => x.n === 'Off the planet'),
      longN: spots[spots.length - 1].n.length, longBook: spots[spots.length - 1].book,
      food: food[0], cities, stats: V.stats,
      hours: V.hours({ open: '9:30', close: '01:00', closed: [1, 9, 'x'] }), noHours: V.hours({ open: 'sometimes' }),
      beach: V.beach({ calm: 'calm', shallow: 'yes', shade: 'trees', walk: 500, note: 'Lovely' }),
      range: [V.range({ sights: 3, relaxed: 2 }), V.range({ sights: 0 }), V.range({ sights: 30, relaxed: 40 })],
      money: [V.money(-5), V.money('12.5'), V.currency('usd'), V.currency('dollars', 'EUR')], tz: [V.tz('Europe/Rome'), V.tz('rome')],
    };
  });
  t.eq(r.names, ['Colosseum', 'Pantheon', 'Far away', 'Off the plan', 'Long xxxxxxx'], 'no name, "null", non-objects and the duplicate are dropped; the rest get through');
  t.ok(r.col.t.length === 1 && r.col.t[0] === 'culture' && r.col.k === 0 && r.col.s === 'pm' && r.col.book === '' && r.col.fame === 2 && r.col.rating === 4.7, 'unknown tag, kid score and time fall back; a reseller link is refused; fame and rating kept: ' + JSON.stringify(r.col));
  t.ok(r.pan.lat === null && r.pan.lng === null && r.pan.rating === undefined && r.pan.k === -1 && r.pan.s === 'am', 'a 0,0 pin is cleared, a rating out of range is dropped, "-1" as a string is read: ' + JSON.stringify(r.pan));
  t.ok(r.far.lat === null && r.far.fame === 0, 'a pin on another continent (Paris for a Rome list) is cleared, the place stays');
  t.ok(r.off.lat === null, 'a pin off the Earth is cleared');
  t.ok(r.longN === 90 && r.longBook === 'https://www.museivaticani.va/tickets', 'a name is cut at 90 characters; an official ticket page is kept');
  t.ok(r.food.meal === 'both' && r.food.reserve === false && r.food.menu === 'https://www.roscioli.com/menu' && r.food.price === '€€', 'a place to eat: unknown meal falls back, "yes" is not true, a menu link goes to https: ' + JSON.stringify(r.food));
  t.ok(r.cities.length === 2 && r.cities[0].w === 4 && r.cities[0].pop === 1 && r.cities[1].lat === 43.77 && r.cities[1].w === 2, 'the city list: days and popularity are clamped, strings are read as numbers, the nameless one is dropped');
  t.ok(r.stats.dropped === 5 && r.stats.cleared === 3 && r.stats.farPins === 1, 'the door counts what it turned away (4 spots, 1 city): ' + JSON.stringify(r.stats));
  t.ok(r.hours && r.hours.o === 570 && r.hours.c === 1500 && r.hours.closed.join() === '1' && r.noHours === null, 'hours: past midnight wraps, bad weekdays are dropped, nonsense is null');
  t.ok(r.beach.calm === 'calm' && r.beach.shallow === undefined && r.beach.shade === 'trees' && r.beach.walk === undefined && r.beach.note === 'Lovely', 'beach facts: only typed values');
  t.ok(r.range[0].s === 3 && r.range[0].r === 3 && r.range[1] === null && r.range[2].s === 14 && r.range[2].r === 21, 'days to spend: relaxed is never under sights; clamped; zero is unknown');
  t.ok(r.money[0] === null && r.money[1] === 12.5 && r.money[2] === 'USD' && r.money[3] === 'EUR' && r.tz[0] === 'Europe/Rome' && r.tz[1] === '', 'money, currency and time zone');

  /* the door is on the real path: a list answer with a far-off pin reaches the city without it */
  const live = await pg.evaluate(() => {
    const ck = W.cityKey('Italy', 'Rome'); W.C.city[ck] = { spots: [], food: [], lat: 41.9, lng: 12.5 };
    W.loadCity('Italy', 'Rome'); const n0 = W.C.city[ck].spots.length;
    return { n0, keys: Object.keys(W.status).filter(k => /^spots\|Italy\|Rome/.test(k)).length };
  });
  t.ok(live.keys >= 1, 'a city list is asked for through the usual door');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
