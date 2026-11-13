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
  /* data someone else wrote (a shared trip, the nightly lists): links must be web links, lists lists of named places */
  const sh = await pg.evaluate(() => {
    const V = W.V, bad = 'javascript:alert(1)';
    const web = [V.web('https://example.com/menu?a=1'), V.web(' http://x.it/a '), V.web(bad), V.web('data:text/html,x'), V.web('example.com'), V.web('https://a b.com'), V.web(null), V.web({})];
    const deep = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: 1 } } } } } } } } } };
    const o = V.shared({ book: bad, menu: 'https://ok.example/menu', site: bad, live: { url: bad, src: 'Booking.com' }, imported: [{ n: 'Bar', src: 'map' }, { n: 'X', src: bad }], long: 'x'.repeat(5000), n: NaN, deep, list: new Array(2500).fill(1) });
    const proto = V.shared(JSON.parse('{"__proto__": {"polluted": 1}, "constructor": 2, "ok": 3}'));
    const pool = V.pool({ lat: 91, lng: 0, spots: [{ n: ' Colosseum ', lat: 41.89, lng: 12.49, t: 'culture', d: 5, book: bad }, { n: '' }, 'text', null, { d: 'no name' }], food: 'none', rest: { spots: [{ n: 'Kept aside', menu: bad }, 7] } });
    const menu = W.menuLink({ n: 'Osteria', menu: bad }, 'Rome'), book = W.bookLink({ n: 'Museum', book: bad, ticket: '€10, book ahead' }, 'Rome', false, 'Italy');
    return { web, o: [o.book, o.menu, o.site, o.live.url, o.live.src, o.imported[0].src, o.imported[1].src, o.long.length, o.n, o.list.length, JSON.stringify(o.deep).length < 200], proto: [Object.keys(proto), ({}).polluted === undefined],
      pool: pool && [pool.lat, pool.spots.length, pool.spots[0].n, pool.spots[0].t, 'd' in pool.spots[0], pool.spots[0].book, pool.food.length, pool.rest.spots.length, pool.rest.spots[0].menu, pool.rest.food.length], none: [V.pool(null), V.pool([1]), V.pool('x')],
      menu: /href="https:\/\/www\.google\.com\/search/.test(menu) && !/javascript/.test(menu), book };
  });
  t.eq(sh.web, ['https://example.com/menu?a=1', 'http://x.it/a', '', '', '', '', '', ''], 'a web link is http or https and nothing else');
  t.eq(sh.o, ['', 'https://ok.example/menu', '', '', 'Booking.com', 'map', '', 4000, null, 2000, true], 'shared data: links that are not web links are emptied, a short label stays, long text, long lists and deep nesting are cut');
  t.eq(sh.proto, [['ok'], true], 'shared data cannot reach into every object');
  t.eq(sh.pool, [null, 1, 'Colosseum', [], false, '', 0, 1, '', 0], 'shared ideas: only named places, pins on Earth or none, fields of the wrong kind dropped');
  t.eq(sh.none, [null, null, null], 'something that is not a city\'s ideas is refused');
  t.ok(sh.menu && sh.book === '', 'a planted link is never drawn: the menu falls back to a search, the ticket link is left out');
  /* a link several places share is no one place's page; two sharing one (a combined ticket) is real */
  const one = await pg.evaluate(() => {
    const L = [{ n: 'A', book: 'https://www.colosseo.it/en/tickets?1' }, { n: 'B', book: 'https://colosseo.it/en/tickets/?2' }, { n: 'C', book: 'http://www.colosseo.it/en/tickets#x' },
      { n: 'Colosseum', book: 'https://parcocolosseo.it/en/' }, { n: 'Roman Forum', book: 'https://parcocolosseo.it/en/' }, { n: 'D', book: '' }, { n: 'E', book: 'https://www.museivaticani.va/' }];
    return W.V.oneEach(L, 'book').map(x => x.book);
  });
  t.eq(one, ['', '', '', 'https://parcocolosseo.it/en/', 'https://parcocolosseo.it/en/', '', 'https://www.museivaticani.va/'], 'a ticket link three places share is cleared on all three; a combined ticket for two stays: ' + JSON.stringify(one));
  t.eq(errors(), [], 'no page errors');
  /* v158: a place to eat the answer itself is unsure of starts as "not checked yet"; a sure one, or an answer that
     does not say, carries no status of its own. The question asks for the mark and for real names. */
  /* (wait for the page's own questions about its cities: they go out a little after it starts) */
  await pg.waitForFunction(() => (window.__full || []).some(p => /^List \d+ (MORE )?places to eat/.test(p)), null, { timeout: 20000 }).catch(() => {});
  const sure = await pg.evaluate(() => { const V = W.V, c = { lat: 35.26, lng: 25.73 };
    const f = V.list([{ n: 'Ferryman Taverna', sure: true }, { n: 'Elounda Bakery', sure: false }, { n: 'Nikos Taverna' }, { n: 'Maybe Cafe', sure: 'false' }], x => V.food(x, c));
    const asks = (window.__full || []).filter(p => /^List \d+ (MORE )?places to eat/.test(p));
    return { st: f.map(x => x.st === undefined ? ('st' in x ? 'key' : '-') : x.st), asks: asks.length, marked: asks.every(p => p.indexOf('"sure":true') > -1 && /sure = false when you are not certain/.test(p) && /never a name made from the kind of place and the town/.test(p)) }; });
  t.eq(sure.st, ['-', 'unverified', '-', '-'], 'sure: false makes a place "not checked yet"; true, missing or anything else leaves it alone');
  t.ok(sure.asks > 0 && sure.marked, `every question for places to eat asks for the "sure" mark and exact names (${sure.asks})`);
  /* v174: names that are not one real place (the owner's Greece trip had these on its days) never come in, and a list
     kept from before never has one planned */
  const vague = await pg.evaluate(() => {
    const V = W.V, c = { lat: 36.42, lng: 25.43 };
    const f = V.list([{ n: 'Ammoudara Beach Tavernas' }, { n: 'Kafeneio Santorini (Perissa bakery cafés)' }, { n: 'Kamari Beach Tavernas: Sunrise Taverna' }, { n: 'Taverna Axiotissa' }, { n: "Harry's Bar" }, { n: 'Caffè Florian' }], x => V.food(x, c)).map(x => x.n);
    const sp = V.list([{ n: 'Archaeological Museum / Lost Atlantis Experience' }, { n: 'Evening dinner in Old Town tavernas' }, { n: 'Dinner cruise on the Seine' }, { n: 'Venetian Kastro of Naxos' }], x => V.spot(x, c)).map(x => x.n);
    return { f, sp };
  });
  t.eq(vague, { f: ['Taverna Axiotissa', "Harry's Bar", 'Caffè Florian'], sp: ['Dinner cruise on the Seine', 'Venetian Kastro of Naxos'] }, 'a group of places, two places in one, or a meal as a thing to do is not taken in; real names are');
  await ctx.close(); await b.close();
};
