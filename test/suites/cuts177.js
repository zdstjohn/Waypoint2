/* v177, the owner's cuts (from asking each reviewer for one thing to take out): no "Booking sites" links, no Settings
   card for unused stored files, no Mapbox in the place search; and the treasure hunt keeps its ticks on the right finds
   when a re-plan changes a town's list (ticks by the find's words, the list kept from the first tick). */
const { launch, open, exampleTrip, settle } = require('../lib/page');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844 }); await exampleTrip(pg);
  await pg.waitForFunction(() => W.laterReady, null, { timeout: 15000 }).catch(() => {});

  /* nothing left of the cuts on the screens that had them */
  const gone = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    W.goView('book'); await wait(500); const book = document.getElementById('viewBook').textContent;
    W.goView('settings'); await wait(500); const set = document.getElementById('viewSettings').textContent;
    return { sites: /Booking sites|Show links to|Also on/.test(book), files: /Find unused files/.test(set), api: ['sitesRow', 'altUrls', 'altLinksFor', 'storageCard'].filter(k => k in W) };
  });
  t.eq(gone, { sites: false, files: false, api: [] }, 'no booking-site links and no unused-files card');

  /* the treasure hunt: a tick stays on its find when the town's list would now be made differently */
  const hunt = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)), P = W.P, key = W.cityKey(P.stops[0].country, P.stops[0].name);
    /* a tick saved before v177, by position: it still shows on the find at that place */
    W.S.hunt = { [key]: { 0: 1 } };
    W.goView('kids'); await wait(400); document.querySelector('#viewKids [data-ktab="hunt"]').click(); await wait(200);
    const btn = i => document.querySelector('#viewKids [data-hunt="' + key + '"][data-hi="' + i + '"]');
    const before = W.huntFinds(P, key).slice(), old = btn(0).getAttribute('aria-pressed');
    btn(2).click(); await wait(200);
    const saved = JSON.parse(JSON.stringify(W.S.hunt[key]));
    /* the town turns beachy: a fresh list would swap two finds for beach ones; the kept list and its ticks stay */
    const real = W.findCity; W.findCity = (c, n) => Object.assign({}, real(c, n) || {}, { t: ['beach'] });
    W.render(); await wait(200);
    const after = W.huntFinds(P, key), on = [0, 1, 2, 3, 4, 5].filter(i => btn(i) && btn(i).getAttribute('aria-pressed') === 'true');
    W.findCity = real;
    return { old, before, saved, after, on };
  });
  t.ok(hunt.old === 'true', 'a tick saved by position before v177 still shows');
  t.ok(hunt.saved._l && hunt.saved._l.length === 6 && hunt.saved[hunt.before[0]] === 1 && hunt.saved[hunt.before[2]] === 1 && !('0' in hunt.saved), 'ticks are kept by the find\'s words, with the list: ' + JSON.stringify(hunt.saved));
  t.ok(JSON.stringify(hunt.after) === JSON.stringify(hunt.before) && JSON.stringify(hunt.on) === '[0,2]', 'a re-plan that would change the list leaves the list and its ticks as they were: ' + JSON.stringify(hunt.on));
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
