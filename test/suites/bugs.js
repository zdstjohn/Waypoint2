/* Bugs the v200 audit found (v201): a town the trip comes back to has keys of its own on its second visit, names in
   any script keep an id of their own, a finished trip does not say "Everything's booked", a book-by that has gone by is
   read as "overdue", the "how to travel" question has no kids' clause without children, and the jet lag counts from
   the airport you leave, not from where the phone is. */
const { launch, open, calm } = require('../lib/page');
const { spawnSync } = require('child_process');
const path = require('path');
async function trip(b, spec, o = {}) {
  const A = await open(b, Object.assign({ width: 390, height: 844 }, o.open || {}));
  const st = Object.assign({ v: 2, algo: 2, styles: ['culture', 'food'], countries: [{ mode: 'manual', name: 'Spain', picked: ['Madrid'] }], days: 3, start: '2027-06-14', depart: 'Seattle (SEA)', travelers: [41, 40, 6, 3], stays: {}, picks: {}, seen: {}, cityDays: {}, tripName: 'Bugs' }, spec);
  await A.pg.evaluate(s => { W.newTripFrom(s); }, st);
  await A.pg.waitForTimeout(800);
  await A.pg.evaluate(() => { const x = document.querySelector('button[data-qs="close"]'); if (x) x.click(); W.needLater && W.needLater(); W.S.tview = 'days'; W.goView('trip'); W.render(); });
  await calm(A.pg, 15000);
  return A;
}
exports.run = async t => {
  const b = await launch();

  /* 1. Rome, Florence, Rome: the second visit to Rome has its own keys */
  {
    const { pg, ctx, errors } = await trip(b, { days: 8, countries: [{ mode: 'manual', name: 'Italy', picked: ['Rome', 'Florence', 'Rome'] }] });
    const r = await pg.evaluate(() => {
      const P = W.P, keys = {}; P.days.forEach(d => d.slots.forEach(x => { (keys[x.key] = keys[x.key] || []).push(d.n); }));
      const first = P.days.find(d => d.city === 'Rome'), again = P.days.filter(d => d.city === 'Rome' && d.visit > 1)[0];
      return { dups: Object.keys(keys).filter(k => keys[k].length > 1), first: first.n, again: again && again.n, againKey: again && W.restKey(again), firstKey: W.restKey(first),
        amKey: first.slots.find(x => x.slot === 'am').key, towns: P.days.map(d => d.city + '#' + d.dayInCity + (d.visit > 1 ? 'v' + d.visit : '')).join(' ') };
    });
    t.eq(r.dups, [], 'Rome, Florence, Rome: no two days share a slot key: ' + r.towns);
    t.ok(r.again > r.first && r.againKey !== r.firstKey, 'the second visit has its own day key: ' + r.firstKey + ' / ' + r.againKey);
    t.ok(/^Italy\|Rome\|1\|am$/.test(r.amKey), 'the first visit keeps the plain key every saved trip has: ' + r.amKey);
    /* a pick and a free part on day 1 do not appear on the second visit's first day */
    await pg.evaluate(() => {
      const P = W.P, d1 = P.days[0], pm1 = d1.slots.find(x => x.slot === 'pm'), pool = W.pool('Italy', 'Rome');
      window.__pickName = pool.spots[20].n; W.useIdea(d1, 'am', window.__pickName, P); (W.S.free = W.S.free || {})[pm1.key] = 1; W.S.rest = W.S.rest || {}; W.S.rest[W.restKey(d1)] = 1; W.changed();
    });
    await calm(pg, 9000);
    const q = await pg.evaluate(() => {
      const P = W.P, d = P.days.filter(x => x.city === 'Rome'), a = d[0], c = d.filter(x => x.visit > 1)[0];
      const g = x => x.slots.filter(y => /^(am|pm)$/.test(y.slot)).map(y => y.slot + ':' + (y.item ? y.item.n : y.free ? 'FREE' : '-')).join(' ');
      return { pick: window.__pickName, d1: g(a), again: g(c), rest1: !!a.rest, restAgain: !!c.rest, firstDic: c.dayInCity };
    });
    t.ok(q.d1.indexOf(q.pick) > -1 && /pm:FREE/.test(q.d1) || q.rest1, 'day 1 shows the pick and the free part (or is a rest day): ' + q.d1);
    t.ok(q.again.indexOf(q.pick) < 0 && !/FREE/.test(q.again) && !q.restAgain, 'the second visit does not: ' + q.again);
    /* an old saved key (written before the visit number) still finds its day 1 slot */
    const old = await pg.evaluate(() => { const d = W.P.days[0]; return W.S.picks['Italy|Rome|1|am'] === window.__pickName && W.P.days[0].slots.find(x => x.slot === 'am').key === 'Italy|Rome|1|am'; });
    t.ok(old, 'an old key "Italy|Rome|1|am" still finds its day-1 slot');
    t.eq(errors(), [], 'no page errors');
    await ctx.close();
  }

  /* 2. names: the app, the Python tools and the Node tools make the same ids */
  {
    const { pg, ctx, errors } = await open(b, { width: 390 });
    await pg.evaluate(() => W.needLater && W.needLater()); await pg.waitForFunction(() => W.laterReady, null, { timeout: 20000 }).catch(() => {});   /* (the old ids are in the second script) */
    const NAMES = ['Wrocław', 'Straße', 'Ørsted', 'Đà Nẵng', 'Æble', 'Þingvellir', 'Kapalıçarşı', 'ŁÓDŹ', 'ẞ', 'São Paulo', 'Zürich', 'Rome', "Ca'n Molinas", 'Αθήνα', 'Ελλάδα', '東京', '日本', 'Москва', 'Tokyo 東京', '!!!', '', 'القاهرة'];
    const app = await pg.evaluate(ns => ns.map(n => [W.norm(n), W.slug(n)]), NAMES);
    const want = { 'Wrocław': 'wroclaw', 'Straße': 'strasse', 'Ørsted': 'orsted', 'Đà Nẵng': 'da nang', 'Æble': 'aeble', 'Þingvellir': 'thingvellir', 'Kapalıçarşı': 'kapalicarsi', 'ŁÓDŹ': 'lodz', 'São Paulo': 'sao paulo', 'Rome': 'rome', '東京': 'u6771 u4eac', 'Tokyo 東京': 'tokyo' };
    NAMES.forEach((n, i) => { if (want[n] !== undefined) t.eq(app[i][0], want[n], 'W.norm(' + n + ')'); });
    t.ok(NAMES.every((n, i) => n === '!!!' || n === '' || app[i][0] !== ''), 'a name with any letter in any script has a norm');
    t.ok(new Set(['Αθήνα', 'Ελλάδα', '東京', '日本', 'Москва', 'القاهرة'].map(n => app[NAMES.indexOf(n)][1])).size === 6, 'six names in four scripts have six different ids');
    t.eq(app[NAMES.indexOf('Αθήνα')][1], 'u3b1-u3b8-u3b7-u3bd-u3b1', 'a slug made from code points');
    t.eq(app[NAMES.indexOf('!!!')][1], 'x', 'a name with no letters at all is still "x"');
    const ids = await pg.evaluate(() => ({ latin: W.citySlug('Italy', 'Rome'), tokyo: W.citySlug('Japan', '東京'), osaka: W.citySlug('Japan', '大阪'), wro: W.citySlug('Poland', 'Wrocław'), wroOld: W.citySlugOld('Poland', 'Wrocław'),
      tokyoOld: W.citySlugOld('Japan', '東京'), athensOld: W.citySlugOld('Ελλάδα', 'Αθήνα'), athensOldX: W.citySlugOld('Ελλάδα', 'Αθήνα', true), romeOld: W.citySlugOld('Italy', 'Rome'), strOld: W.slugOld('Straße') }));
    t.eq(ids.latin, 'italy-rome', 'a Latin id does not change');
    t.ok(ids.tokyo !== ids.osaka && ids.tokyo.indexOf('japan-') === 0, 'two cities of Japan in kanji have ids of their own: ' + ids.tokyo + ' / ' + ids.osaka);
    t.eq([ids.wro, ids.wroOld, ids.tokyoOld, ids.athensOld, ids.athensOldX, ids.romeOld, ids.strOld], ['poland-wroclaw', 'poland-wroc-aw', '', '', 'x', '', 'stra-e'], 'the id before v201 is known for reading what was saved (never the country\'s own id, "x" only on request)');
    /* a photo index saved under the old id is still read */
    const ph = await pg.evaluate(() => { W.photosSeed({ PHOTOS: { 'poland-wroc-aw': { cathedral: { url: 'https://example.com/c.jpg' } } } }); return (W.photoFor({ n: 'Cathedral' }, false, 'Poland', 'Wrocław') || {}).url || null; });
    t.eq(ph, 'https://example.com/c.jpg', 'photos saved under the old id of Wrocław are still found');
    t.eq(errors(), [], 'no page errors');
    await ctx.close();
    const root = path.join(__dirname, '..', '..', 'tools'), js = JSON.stringify(NAMES);
    const py = spawnSync('python3', ['-c', 'import sys, json; sys.path.insert(0, sys.argv[1])\nimport big_photos, find_photos, official_links, pin_check, place_check, wide_photos\nN = json.loads(sys.argv[2])\nprint(json.dumps({m.__name__: [m.norm(n) for n in N] for m in (big_photos, find_photos, official_links, pin_check, place_check, wide_photos)}))', root, js], { encoding: 'utf8' });
    let got = {}; try { got = JSON.parse(py.stdout); } catch (e) { t.ok(false, 'the Python tools load: ' + (py.stderr || '').slice(-300)); }
    Object.keys(got).forEach(m => t.eq(got[m], app.map(a => a[0]), m + '.py norm gives the app\'s answers'));
    const cl = require(path.join(root, 'citylib.js')), wl = require(path.join(root, 'worldlib.js'));
    t.eq(NAMES.map(cl.norm), app.map(a => a[0]), 'citylib.js norm gives the app\'s answers');
    t.eq(NAMES.map(n => wl.norm ? wl.norm(n) : cl.norm(n)), app.map(a => a[0]), 'worldlib.js norm gives the app\'s answers');
    t.eq([cl.citySlug('Japan', '東京'), cl.citySlug('Poland', 'Wrocław'), cl.citySlug('Italy', 'Rome')], [ids.tokyo, ids.wro, ids.latin], 'citylib.js makes the app\'s city ids');
    const bp = spawnSync('python3', ['-c', 'import sys; sys.path.insert(0, sys.argv[1])\nimport big_photos as b\nprint(b.slug_of("Japan", "東京"), b.slug_of("Poland", "Wrocław"), b.slug_of("Italy", "Rome"))', root], { encoding: 'utf8' });
    t.eq(bp.stdout.trim().split(' '), [ids.tokyo, ids.wro, ids.latin], 'big_photos.py makes the app\'s city ids');
  }

  /* 4. a finished trip does not say it is all booked */
  {
    const { pg, ctx, errors } = await trip(b, { countries: [{ mode: 'manual', name: 'Italy', picked: ['Rome'] }], days: 3, start: '2020-01-10' });
    const r = await pg.evaluate(async () => { W.S.prepTab = 'tobook'; W.goView('book'); W.render(); await new Promise(x => setTimeout(x, 800));
      const L = W.checklist(W.P); return { text: document.getElementById('viewBook').textContent, gone: L.some(c => c.past && !c.done), n: L.length, left: L.filter(W.leftToBook).length }; });
    t.ok(r.n > 0 && r.left === 0 && r.gone, 'a trip whose dates have gone by has nothing left to book: ' + JSON.stringify({ n: r.n, left: r.left, gone: r.gone }));
    t.ok(/Nothing left to book: the dates have gone by\./.test(r.text) && !/Everything's booked/.test(r.text) && !/All booked/.test(r.text), 'and says so, not "Everything\'s booked. Nicely done!"');
    t.eq(errors(), [], 'no page errors');
    await ctx.close();
  }

  /* 5. a book-by that has gone by is not read out as a date; 6. the "how to travel" question asks for a kids' tip only with children */
  {
    const { pg, ctx, errors } = await trip(b, { countries: [{ mode: 'manual', name: 'Italy', picked: ['Rome', 'Florence'] }], days: 6, start: '2027-06-14', travelers: [41, 40] });
    const tl = await pg.evaluate(() => { const now = W.now(), by = new Date(now.getTime() - 6 * 864e5), start = new Date(now.getTime() + 20 * 864e5);
      return W.bookTimeline([{ key: 'x|1', group: 'stay', title: 'Hotel in Rome', short: 'Hotel', by, done: false, past: false }], now, W.isoDay(start)); });
    t.ok(/Hotel · Book now/.test(tl) && /Hotel, Book now/.test(tl) && !/ by [A-Z][a-z]{2} \d/.test(tl), 'an overdue book-by reads "Book now" in the dot\'s tooltip and screen-reader text: ' + tl.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 120));
    const q = await pg.evaluate(() => { const a = { name: 'Rome', country: 'Italy' }, b2 = { name: 'Florence', country: 'Italy' }, keep = W.S.travelers.slice(), out = {};
      W.S.travelers = [41, 40]; out.adults = W.ASKS['asks.0'].q(a, b2, 'k'); W.S.travelers = [41, 40, 6, 3]; out.kids = W.ASKS['asks.0'].q(a, b2, 'k'); W.S.travelers = keep; return out; });
    t.ok(!/kids|famil|child/i.test(q.adults), 'an adults-only trip is not asked for a family or kids tip: ' + (q.adults.match(/note \([^)]*\)/) || [''])[0]);
    t.ok(/for families, e\.g\. which ferries have cabins or decks for kids/.test(q.kids), 'a trip with children still is');
    t.eq(errors(), [], 'no page errors');
    await ctx.close();
  }

  /* 7. jet lag counts from the airport the flight leaves, not from where the phone is */
  {
    const jet = async (tz, depart) => { const A = await trip(b, { countries: [{ mode: 'manual', name: 'Italy', picked: ['Rome'] }], days: 4, start: '2027-06-14', depart, travelers: [41, 40] }, { open: { tz } });
      const r = await A.pg.evaluate(() => ({ jet: W.P.days.filter(d => d.jet).map(d => d.n), J: W.jetlag(W.P) })); await A.ctx.close(); return r; };
    t.eq((await jet('UTC', 'Seattle (SEA)')).jet, [1, 2], 'a phone on UTC, flying Seattle to Rome: nine hours, the first two days are jet-lag days');
    t.eq((await jet('America/Los_Angeles', 'London (LHR)')).jet, [], 'a phone in Seattle that flies from London: one hour, no jet-lag day');
    t.eq((await jet('America/Los_Angeles', '')).jet, [1, 2], 'with no departure known, the phone\'s zone is kept (Seattle phone: nine hours)');
    t.eq((await jet('UTC', 'Boise')).jet, [], 'a departure with no zone known (typed by hand) falls back to the phone (UTC: two hours)');
  }
  await b.close();
};
