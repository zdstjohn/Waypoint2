/* Explore (the tab that replaced the map): search any place and put it on the day; today's route with the way between
   stops and the whole day in Google Maps; the free parts of the day with picks; every idea under the stop it's near.
   Search sources, all mocked here: the city's own list, Mapbox (through the viewer's connection) and Claude. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, db: mkdb() }); await exampleTrip(pg);
  await pg.evaluate(() => { W.S.day = 3; W.S.tview = 'map'; W.render(); }); await settle(pg, 4000);
  const first = await pg.evaluate(() => ({ search: !!document.getElementById('placeQ'), route: !!document.querySelector('.rcard, .rc-list'), sketch: !!document.querySelector('svg.map'),
    gm: (() => { W.S.tview = 'days'; W.render(); const a = document.querySelector('#viewTrip .gm-row a[aria-label="Open the whole route in Google Maps"]'), h = a ? a.href : ''; W.S.tview = 'map'; W.render(); return h; })(), groups: [...document.querySelectorAll('.idea-group.near-g')].map(h => h.textContent), near: document.querySelectorAll('.idea .near').length,
    label: document.querySelector('[data-vsw="map"]').textContent.trim() }));
  t.eq(first.label, 'Explore', 'the tab is called Explore');
  t.ok(first.search && !first.route && !first.sketch, 'Explore has the search, and neither the route (that is on Today) nor a sketch map');
  t.ok(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&origin=/.test(first.gm) && /waypoints=/.test(first.gm), 'the Google Maps row under the day\'s stops opens the whole route');
  t.ok(first.groups.length >= 2 && first.groups.some(g => /^Near /.test(g)) && first.near > 0, 'ideas are grouped by the stop they are near, with the time to get there: ' + first.groups.slice(0, 4).join(' / '));


  /* search: three sources, one list; the same place from the map and Claude shows once, marked as on the map */
  await pg.fill('#placeQ', 'gelato'); await pg.click('[data-psearch="1"]'); await pg.waitForTimeout(400); await settle(pg, 4000);
  const res = await pg.evaluate(() => ({ rows: [...document.querySelectorAll('.ps-it')].map(li => [li.querySelector('b').textContent, li.querySelector('.ps-src').textContent]),
    google: (document.querySelector('.ps-google a') || {}).href || '', mcp: (window.__mcp || []).filter(c => c[0] === 'Mapbox').map(c => c[1]) }));
  const names = res.rows.map(r => r[0]);
  t.ok(res.mcp.includes('search_and_geocode_tool'), 'the map search goes through the Mapbox connection');
  t.ok(names.filter(n => n === 'Caffè gelato').length === 1 && res.rows.find(r => r[0] === 'Caffè gelato')[1] === 'On the map', 'a place both the map and Claude found shows once, marked as on the map: ' + JSON.stringify(res.rows));
  t.ok(res.rows.some(r => r[1] === 'Suggested by Claude'), 'a place only Claude knows is marked as a suggestion');
  t.ok(!names.includes('Far Away Place'), 'a result far from the city is left out');
  t.ok(/google\.com\/maps\/search\/.*gelato/.test(res.google), 'Google Maps\' own results are one link away');

  /* add: pick the part of the day; the place joins the list as your own and the day shows it */
  const added = await pg.evaluate(async () => {
    const li = [...document.querySelectorAll('.ps-it')].find(l => /Secret Garden/.test(l.textContent)); li.querySelector('[data-ppick]').click();
    await new Promise(r => setTimeout(r, 200));
    const slots = [...document.querySelectorAll('.ps-slot')].map(s => s.querySelector('b').textContent);
    document.querySelector('.ps-slot[data-pslot="pm"]').click(); await new Promise(r => setTimeout(r, 300));
    const d = W.P.days[2], pm = d.slots.find(x => x.slot === 'pm');
    return { slots, pm: pm.item && pm.item.n, ok: (document.querySelector('.ps-ok') || {}).textContent, imp: ((W.S.imported || {})['Italy|Rome'] || []).map(x => [x.n, x.src]), route: (() => { W.goView('go'); const r = [...document.querySelectorAll('#viewGo .rc-stop b')].map(b => b.textContent); W.goView('trip'); return r; })() };
  });
  t.eq(added.slots, ['Morning', 'Afternoon', 'Evening'], 'a thing to do can go in the morning, afternoon or evening');
  t.ok(added.pm && /Secret Garden/.test(added.pm) && added.route.some(n => /Secret Garden/.test(n)), 'the place is on the day, and in the route on Today: ' + JSON.stringify(added));
  t.ok(added.imp.some(x => /Secret Garden/.test(x[0]) && x[1] === 'claude'), 'it joins the city\'s list as your own, remembering it came from Claude');
  t.ok(/is on Day 3, afternoon/.test(added.ok || ''), 'and says where it went');
  /* it stays after a reload of the plan (it travels with the trip) */
  const kept = await pg.evaluate(() => { W.replan(); W.render(); return W.P.days[2].slots.find(x => x.slot === 'pm').item.n; });
  t.ok(/Secret Garden/.test(kept), 'and stays there when the plan is made again');

  /* free time: clear the morning and it offers picks for it */
  const ft = await pg.evaluate(async () => {
    const d = W.P.days[2], ev = d.slots.find(x => x.slot === 'am'); (W.S.free || (W.S.free = {}))[ev.key] = 1; W.render(); await new Promise(r => setTimeout(r, 200));
    const sec = document.querySelector('.freetime'); return sec ? { h: [...sec.querySelectorAll('.ft-h b')].map(b => b.textContent), picks: sec.querySelectorAll('.scard').length } : null;
  });
  t.ok(ft && ft.h.length >= 1 && ft.picks >= 2, 'a free part of the day shows picks for it: ' + JSON.stringify(ft));

  /* the Day view: "Add a place of your own" opens Explore with the search ready */
  const ad = await pg.evaluate(async () => { W.S.tview = 'days'; W.render(); const btn = document.querySelector('[data-addplace]'); if (!btn) return null; btn.click(); await new Promise(r => setTimeout(r, 300)); return { view: W.S.tview, focus: document.activeElement && document.activeElement.id }; });
  t.eq(ad, { view: 'map', focus: 'placeQ' }, 'the Day view\'s "Add a place" opens Explore with the search ready');

  /* nothing found, and the map connection missing: says so, and still offers Claude and Google */
  const none = await pg.evaluate(async () => {
    window.__mcpFail = { search_and_geocode_tool: 'server_not_connected' };
    document.getElementById('placeQ').value = 'nothing here'; document.querySelector('[data-psearch="1"]').click(); await new Promise(r => setTimeout(r, 900));
    window.__mcpFail = null; return document.querySelector('.psearch').textContent;
  });
  t.ok(/Connect Mapbox/.test(none) && /Search Google Maps/.test(none), 'without the map connection it says how to add it, and Google Maps is still a link away: ' + none.slice(0, 300));
  /* "Find more" asks for a few more at a time (10 things to do, 8 places to eat), and stops at the city's cap */
  const more = await pg.evaluate(async () => {
    /* an automatic top-up still on its way would make the button wait for it instead of asking: let it land first */
    for (let i = 0; i < 100 && Object.keys(W.status).some(k => /Rome/.test(k) && W.status[k] === 'loading'); i++) await new Promise(r => setTimeout(r, 100));
    /* (automatic top-ups can already have brought the city near its cap: start this check below it) */
    const p0 = W.pool('Italy', 'Rome'), orig = { s: p0.spots.slice(), f: p0.food.slice() };
    if (p0.spots.length > 40) p0.spots.length = 40; if (p0.food.length > 24) p0.food.length = 24;
    W.S.tview = 'map'; W.S.day = 2; W.render(); const n0 = (window.__full || []).length;
    const aside = () => [((p0.rest || {}).spots || []).length, ((p0.rest || {}).food || []).length], a0 = aside();
    document.querySelector('[data-more="1"]').click(); const a1 = aside(); await new Promise(r => setTimeout(r, 900));
    orig.s.forEach(x => { if (!p0.spots.some(y => y.n === x.n)) p0.spots.push(x); }); orig.f.forEach(x => { if (!p0.food.some(y => y.n === x.n)) p0.food.push(x); });
    const asks = (window.__full || []).slice(n0).map(p => (p.match(/List (\d+) MORE (things to do|places to eat)/) || []).slice(1, 3).join(' ')).filter(Boolean);
    const pool = W.pool('Italy', 'Rome'), keep = { s: pool.spots.slice(), f: pool.food.slice() };
    while (pool.spots.length < W.IDEA_CAP.spots) pool.spots.push(Object.assign({}, pool.spots[0], { n: 'Filler sight ' + pool.spots.length }));
    while (pool.food.length < W.IDEA_CAP.food) pool.food.push(Object.assign({}, pool.food[0], { n: 'Filler eatery ' + pool.food.length }));
    W.render(); await new Promise(r => setTimeout(r, 100));
    const full = { btn: !!document.querySelector('.ideas [data-more="1"]'), note: /Plenty to choose from/.test((document.querySelector('.ideas-h') || {}).textContent || '') };
    const n1 = (window.__full || []).length; W.loadCity('Italy', 'Rome', true); await new Promise(r => setTimeout(r, 300));
    full.asked = (window.__full || []).slice(n1).filter(p => /MORE/.test(p)).length;
    pool.spots.length = 0; keep.s.forEach(x => pool.spots.push(x)); pool.food.length = 0; keep.f.forEach(x => pool.food.push(x)); W.render();
    return { asks, full, had: [keep.s.length, keep.f.length], out: [a0[0] - a1[0], a0[1] - a1[1]] };
  });
  const askedN = what => +((more.asks.find(a => a.endsWith(what)) || '0').split(' ')[0]);
  t.ok(askedN('things to do') + more.out[0] === 10 && askedN('places to eat') + more.out[1] === 8, '"Find more" puts 10 more things to do and 8 more places to eat on show: the ones the city had set aside first, Claude for the rest: asked ' + JSON.stringify(more.asks) + ', brought out ' + JSON.stringify(more.out) + ' (Rome had ' + more.had.join(' / ') + ')');
  t.ok(!more.full.btn && more.full.note && more.full.asked === 0, 'a city at its cap (60 things to do, 40 places to eat) asks for no more and says there is plenty');
  /* what the nightly checks are told: this trip's stops first, with their dates, the soonest day as "when", the rest up to the cap */
  const want = await pg.evaluate(async () => {
    const pool = W.pool('Italy', 'Rome'); W.wantPhotos('Italy', 'Rome', pool, W.P); await new Promise(r => setTimeout(r, 600));
    const doc = JSON.parse(await window.__dbOp('get', 'wanted/italy-rome', null) || 'null');
    const onTrip = []; W.P.days.filter(d => d.city === 'Rome').forEach(d => d.slots.forEach(x => { if (x.item && !onTrip.includes(x.item.n)) onTrip.push(x.item.n); }));
    const firstDay = W.isoDay(W.dateOf(W.P.days.find(d => d.city === 'Rome').n));
    return doc && { when: doc.when, firstDay, used: doc.used.length, onTrip: onTrip.length, headOk: onTrip.every(n => doc.spots.concat(doc.food).includes(n)),
      first: onTrip.filter(n => pool.spots.some(x => x.n === n)).every((n, i, a) => doc.spots.indexOf(n) < a.length), pairs: doc.pts.length === doc.spots.length + doc.food.length,
      cap: doc.spots.length <= Math.max(W.IDEA_CAP.spots, onTrip.length) && doc.food.length <= Math.max(W.IDEA_CAP.food + 30, onTrip.length) && (doc.menus || []).length === doc.food.length };   /* (places to eat: the cap plus room for the nightly ones; each with its menu page, in step) */
  });
  t.ok(want && want.when === want.firstDay && want.used === want.onTrip && want.headOk && want.first && want.pairs && want.cap, 'the nightly lists put this trip\'s stops first with their dates (' + JSON.stringify(want) + ')');
  /* a city that holds far more ideas than the stay calls for (lists from before the limit, the nightly restaurants):
     only the stay's worth is on show; the rest is set aside, and comes out first when you ask for more */
  const fit = await pg.evaluate(async () => {
    for (let i = 0; i < 100 && Object.keys(W.status).some(k => /Rome/.test(k) && W.status[k] === 'loading'); i++) await new Promise(r => setTimeout(r, 100));
    const pool = W.pool('Italy', 'Rome'); delete pool.showN; pool.rest = { spots: [], food: [] };
    const stay = W.stayDays('Italy', 'Rome'), lim = W.firstIdeas(stay), used = Object.keys(W.S.picks).filter(k => k.indexOf('Italy|Rome|') === 0).map(k => W.S.picks[k]);
    for (let i = 0; pool.spots.length < 60; i++) pool.spots.push(Object.assign({}, pool.spots[0], { n: 'Extra sight ' + i, s: 'am' }));
    for (let i = 0; pool.food.length < 110; i++) pool.food.push(Object.assign({}, pool.food[0], { n: 'Extra eatery ' + i, meal: i % 9 ? 'both' : 'breakfast' }));
    pool.spots.push(Object.assign({}, pool.spots[0], { n: 'A place I added', imp: true }));
    const n0 = (window.__full || []).length;
    W.replan(); W.plan(); await new Promise(r => setTimeout(r, 300)); W.render();
    const names = l => l.map(x => W.norm(x.n)), on = names(pool.spots.concat(pool.food));
    const first = { spots: pool.spots.length, food: pool.food.length, aside: [pool.rest.spots.length, pool.rest.food.length], lim,
      keptUsed: used.every(n => on.includes(W.norm(n))), keptMine: on.includes('a place i added'), bfast: pool.food.filter(x => x.meal === 'breakfast' || x.meal === 'all').length,
      shown: (document.querySelector('.ideas-t') || document.body).textContent.match(/(\d+) things to do/) };
    W.S.tview = 'map'; W.S.day = 2; W.render(); const btn = document.querySelector('[data-more="1"]'); if (btn) btn.click(); await new Promise(r => setTimeout(r, 400));
    const more = { spots: pool.spots.length, food: pool.food.length, asked: (window.__full || []).slice(n0).filter(p => /MORE/.test(p)).length };
    W.replan(); W.plan(); await new Promise(r => setTimeout(r, 200));
    const again = [pool.spots.length, pool.food.length];
    return { first, more, again, used: used.length };
  });
  const over = Math.max(0, fit.used + 1 - fit.first.lim);   /* (a trip that uses more than the limit keeps all it uses) */
  t.ok(fit.first.spots <= fit.first.lim + over && fit.first.spots >= fit.first.lim && fit.first.food <= fit.first.lim + over && fit.first.food >= fit.first.lim && fit.first.aside[0] > 30 && fit.first.aside[1] > 80,
    'a city holding 60 things to do and 110 places to eat shows the stay\'s worth of each (' + fit.first.lim + ') and sets the rest aside: ' + JSON.stringify(fit.first));
  t.ok(fit.first.keptUsed && fit.first.keptMine && fit.first.bfast >= 4, 'what is on the trip\'s days and what you added yourself stay on show, and breakfast keeps its share (' + fit.first.bfast + ')');
  t.ok(fit.more.spots === fit.first.spots + 10 && fit.more.food === fit.first.food + 8 && fit.more.asked === 0 && fit.again[0] === fit.more.spots && fit.again[1] === fit.more.food,
    '"Find more" brings out 10 and 8 of the ones set aside at once, without asking Claude, and they stay: ' + JSON.stringify([fit.more, fit.again]));
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
