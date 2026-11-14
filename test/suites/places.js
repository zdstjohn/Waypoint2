/* Checked place records: a place that has closed is skipped by the planner and its replacement joins the list;
   a verified pin moves the place; the official site fills an empty menu link; an outing finds the photo of the real place behind it;
   a guessed pin found far out in the water is taken off the map (no pin beats a wrong one), and a checked city centre is where
   you stay until you pick a place. */
const { launch, open, exampleTrip } = require('../lib/page'); const mkdb = require('../lib/db');
const px = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
exports.run = async t => {
  const seed = {
    'places/italy-rome': { city: 'Rome', country: 'Italy', items: {
      'rome cafe 3 0': { st: 'closed', note: 'Closed in 2025', replace: { n: 'Caffè Verifica', d: 'Family-run café by the piazza', cuisine: 'Cafe', price: '€', meal: 'breakfast', k: 1, lat: 41.9, lng: 12.48, site: 'https://caffeverifica.example' } },
      'rome cafe 3 1': { lat: 41.95, lng: 12.5, site: 'https://cafe1.example', hours: { o: 420, c: 780, closed: [] } },
      'rome cafe 3 2': { nopin: 1, checked: '2026-11-08' },
      'rome eatery 3 7': { g: 'ChIJtest3', gpin: 1, gat: new Date().toISOString().slice(0, 10), lat: 41.9011, lng: 12.4722 },
      'rome eatery 3 8': { g: 'ChIJtest4', gpin: 1, gat: new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10), lat: 41.7, lng: 12.7 },
      'trastevere side streets': { lat: 41.8894, lng: 12.4698, approx: 1, stay: 1 },
      'rome cafe 10 1': { st: 'open', meal: 'both', note: 'A dinner restaurant, not a breakfast café' },
    }, center: [41.8986, 12.4769] },
    'photos/italy-rome': { items: { 'piazza navona': { url: px + '#navona', credit: 'Test', page: 'x' } }, city: 'Rome', country: 'Italy' },
  };
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, db: mkdb(seed) }); await exampleTrip(pg);
  await pg.waitForFunction(() => { const p = W.pool('Italy', 'Rome'); return p && p.food.some(x => x.n === 'Caffè Verifica'); }, null, { timeout: 10000 }).catch(() => {});
  const r = await pg.evaluate(() => {
    const p = W.pool('Italy', 'Rome'); const c0 = p.food.find(x => x.n === 'Rome cafe 3-0'), c1 = p.food.find(x => x.n === 'Rome cafe 3-1'), rep = p.food.find(x => x.n === 'Caffè Verifica');
    const scheduled = W.P.days.some(d => d.slots.some(s => s.item && s.item.n === 'Rome cafe 3-0'));
    const ph = W.photoFor({ n: 'Evening stroll with gelato', place: 'Piazza Navona' }, false, 'Italy', 'Rome');
    const c2 = p.food.find(x => x.n === 'Rome cafe 3-2'), hb = W.homebase('Italy', 'Rome');
    return { st: c0 && c0.st, scheduled, rep: !!rep, repMenu: rep && rep.menu, pin: c1 && [c1.lat, c1.lng], menu: c1 && c1.menu, hours: c1 && c1.hours && c1.hours.o, photo: ph && ph.url.split('#')[1],
      c2: c2 && [c2.lat, c2.lng], home: W.S.stays['Italy|Rome'] && W.S.stays['Italy|Rome'].lat != null ? 'own' : [hb.lat, hb.lng] };
  });
  t.eq(r.st, 'closed', 'a place the check found closed is marked closed');
  /* v174: a place the check found serves no breakfast ("A dinner restaurant, not a breakfast café") is never at breakfast */
  const meal = await pg.evaluate(() => { const p = W.pool('Italy', 'Rome'), c = p.food.find(x => x.n === 'Rome cafe 10-1'); W.S.picks = {}; W.replan(); const at = W.plan().days.flatMap(d => d.slots.filter(s => s.item === c).map(s => s.slot)); return { meal: c && c.meal, at }; });
  t.ok(meal.meal === 'both' && !meal.at.includes('breakfast'), 'the meals a checked record says a place serves win over the list: ' + JSON.stringify(meal));
  t.ok(!r.scheduled, 'and the planner does not schedule it');
  t.ok(r.rep, 'its replacement joins the list');
  /* the replacement and the limit on ideas on show must not take turns (one adding it, the other setting it aside, the
     page redrawing each time): a city holding more than it shows, whose replaced place is on nobody's day, settles */
  const calm = await pg.evaluate(async () => {
    const p = W.pool('Italy', 'Rome'), stay = W.stayDays('Italy', 'Rome'); delete p.showN;
    Object.keys(W.S.picks).forEach(k => { if (W.S.picks[k] === 'Caffè Verifica') delete W.S.picks[k]; });
    for (let i = 0; p.food.length < 60; i++) p.food.splice(1, 0, Object.assign({}, p.food[1], { n: 'Spare eatery ' + i }));
    let moves = 0; for (let i = 0; i < 6; i++) { W.pool('Italy', 'Rome'); if (W.fitIdeas('Italy', 'Rome', stay, true)) moves++; }
    const out = { moves, onShow: W.pool('Italy', 'Rome').food.some(x => x.n === 'Caffè Verifica'), aside: ((p.rest || {}).food || []).length };
    W.replan(); W.changed(); W.render(); await new Promise(r => setTimeout(r, 1200));
    const v0 = W.dataV; await new Promise(r => setTimeout(r, 1500)); out.still = W.dataV - v0;
    return out;
  });
  t.ok(calm.moves <= 1 && calm.onShow && calm.aside > 20 && calm.still === 0, 'a city with more ideas than it shows settles in one pass, its replacement stays on show, and nothing keeps redrawing (' + JSON.stringify(calm) + ')');
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
  /* stops on (nearly) the same spot share one marker on the detailed map, numbers in a row, so none hides another */
  await pg.evaluate(() => W.needLater()); await pg.waitForFunction(() => !!W.pinGroups, null, { timeout: 15000 });   /* map pins come with the second script */
  const g = await pg.evaluate(() => {
    const pts = [{ num: 1, lat: 35.36012, lng: 24.49616 }, { num: 2, lat: 35.36012, lng: 24.49616 }, { num: 3, lat: 35.37, lng: 24.47 }, { num: 4, lat: 35.36013, lng: 24.49617 }];
    const proj = p => ({ x: (p.lng - 24.4) * 20000, y: -(p.lat - 35.3) * 20000 });   /* about 2 px per 10 m */
    return W.pinGroups(pts, proj).map(x => x.items.map(p => p.num).join('·'));
  });
  t.eq(g, ['1·2·4', '3'], 'stops on the same spot share one marker that shows every number');
  /* Today's route lists every stop; one with no pin says so and links to Google Maps by name, and the whole-day
     Google Maps link carries every stop, pinned or by name */
  const rt = await pg.evaluate(async () => {
    W.goView('go'); await new Promise(r => setTimeout(r, 400));
    const d = W.P.days[W.S.day - 1], stops = (d.slots || []).filter(x => x.item).map(x => x.item);
    const rows = [...document.querySelectorAll('#viewGo .rc-stop:not(.rc-nap):not(.rc-trav)')], gm = (document.querySelector('#viewGo .gm-row a[aria-label="Open the whole route in Google Maps"]') || {}).href || '';
    const wp = decodeURIComponent((gm.match(/waypoints=([^&]*)/) || [])[1] || '').split('|').filter(Boolean);
    /* (no stay picked: the route runs from the first stop to the last, so those two are its ends, not waypoints) */
    const none = !!W.homebase(d.country, d.city).none, ends = none ? Math.min(2, stops.length) : 0, o = decodeURIComponent((gm.match(/origin=([^&]*)/) || [])[1] || ''), c = W.findCity(d.country, d.city);
    return { n: rows.length, stops: stops.length, noLL: stops.filter(it => it.lat == null).length, byName: rows.filter(r => { const a = r.querySelector('.rc-go'), d = a ? decodeURIComponent((a.href.match(/destination=([^&]+)/) || [])[1] || '') : ''; return d && !/^-?[\d.]+,-?[\d.]+$/.test(d); }).length, wp: wp.length + ends, none, fromMiddle: !!c && o === c.lat + ',' + c.lng };
  });
  t.ok(!rt.none || !rt.fromMiddle, 'with no stay picked, the whole-day route starts at the first stop, not at the middle of the town');
  t.ok(rt.n === rt.stops && rt.byName === rt.noLL && rt.wp === Math.min(9, rt.stops), `the route lists every stop (${rt.n}), finds the unpinned ones by name (${rt.byName}), and the Google Maps link carries all of them (${rt.wp})`);
  await pg.evaluate(() => { W.goView('trip'); W.S.tview = 'days'; W.render(); });
  /* Google: a place the nightly check found there carries its place ID, so every "Google Maps" link (the stop, the whole
     day) opens the exact listing; a pin taken from Google is used for 30 days only, and never drawn on the free street map */
  const gg = await pg.evaluate(() => {
    const p = W.pool('Italy', 'Rome'), all = p.food.concat((p.rest || {}).food || []),   /* on show or set aside (the city above holds more than it shows) */
      c3 = all.find(x => x.n === 'Rome eatery 3-7'), c4 = all.find(x => x.n === 'Rome eatery 3-8');
    const d = W.P.days.find(x => x.city === 'Rome'), url = c3 && W.dayRouteUrl(d, [{ n: 'Somewhere', lat: 41.9, lng: 12.5 }, c3], { label: 'Hotel', lat: 41.9, lng: 12.48 });
    return { gid: c3 && c3.gid, link: c3 && W.gmapsPlace(c3, 'Rome'), plain: W.gmapsPlace('Rome eatery 3-9', 'Rome'), pin: c3 && [c3.lat, c3.lng], gpin: c3 && c3.gpin,
      stale: c4 && [c4.lat, c4.lng], staleG: c4 && c4.gpin, ids: url && decodeURIComponent((url.match(/waypoint_place_ids=([^&]*)/) || [])[1] || '') };
  });
  t.ok(gg.gid === 'ChIJtest3' && /query_place_id=ChIJtest3/.test(gg.link) && !/query_place_id/.test(gg.plain), `a place Google knows links to its exact listing (${gg.link && gg.link.split('?')[1]})`);
  t.eq(gg.ids, '|ChIJtest3', 'the whole-day Google Maps link names each stop Google knows, in order');
  t.ok(gg.pin && gg.pin[0] === 41.9011 && gg.gpin === 1, 'a pin from Google is used while it is fresh');
  t.ok(gg.stale && gg.stale[0] !== 41.7 && !gg.staleG, `a pin from Google older than 30 days is no longer used (${gg.stale})`);
  /* Explore's ideas: in each group the places the nightly check confirmed come first, marked "Checked" */
  const ck = await pg.evaluate(async () => {
    const rowsOf = h => { const out = []; for (let e = h.nextElementSibling; e && !e.classList.contains('idea-group'); e = e.nextElementSibling) if (e.classList.contains('idea')) out.push(e.querySelector('h4').textContent); return out; };
    /* a group with nothing confirmed in it yet (the mock's own checks confirm some places as the lists arrive) */
    const open = n => { const p = W.pool('Italy', 'Rome'); const x = p && p.spots.concat(p.food).find(y => y.n === n); return !!(x && x.st === 'open'); };
    let g = null;
    for (const d of W.P.days.filter(d => d.city === 'Rome')) {
      W.S.day = d.n; W.S.tview = 'map'; W.S.tab = 'do'; W.render(); await new Promise(r => setTimeout(r, 300));
      g = [...document.querySelectorAll('.idea-list .idea-group.near-g')].find(h => { const r = rowsOf(h); return r.length >= 2 && !open(r[0]); });
      if (g) break;
    }
    if (!g) return null;
    const title = g.textContent, rows = rowsOf(g), last = rows[rows.length - 1];
    const cur = JSON.parse(await window.__dbOp('get', 'places/italy-rome', null)); cur.items[W.norm(last)] = { st: 'open', checked: '2026-11-08' };
    await window.__dbOp('set', 'places/italy-rome', JSON.stringify(cur));
    for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 100)); W.render(); const h = [...document.querySelectorAll('.idea-list .idea-group.near-g')].find(x => x.textContent === title); if (h && rowsOf(h)[0] === last) break; }
    const h = [...document.querySelectorAll('.idea-list .idea-group.near-g')].find(x => x.textContent === title);
    const first = h && h.nextElementSibling;
    W.S.tview = 'days'; W.S.day = 2; W.render();
    return { before: rows, after: h ? rowsOf(h) : [], last };
  });
  if (!ck) t.note('every ideas group in Rome already starts with a confirmed place'); else t.ok(ck.after[0] === ck.last, `a confirmed idea comes first in its group (${ck.before.join(', ')} → ${ck.after.join(', ')})`);
  /* A record that lost a wrong pin (it carries "was"): a stop whose saved list still holds that wrong pin has no own pin
     to go back to, so it is asked for once and lands where the answer says, never back on the wrong spot. */
  const fix = await pg.evaluate(async () => {
    const d = W.P.days.find(x => x.city === 'Rome' && x.slots.some(s => s.item && !W.isFood(s.slot)));
    const x = d.slots.find(s => s.item && !W.isFood(s.slot)), it = x.item, wrong = [41.95, 12.6];
    it.lat = wrong[0]; it.lng = wrong[1]; delete it.g; delete it.pinAsked;   /* as an older version left it: the wrong pin in the saved list */
    const cur = JSON.parse(await window.__dbOp('get', 'places/italy-rome', null)); cur.items[W.norm(it.n)] = { checked: '2026-11-08', was: wrong };
    await window.__dbOp('set', 'places/italy-rome', JSON.stringify(cur));
    W.S.day = d.n; W.S.tview = 'map'; W.render();
    for (let i = 0; i < 60 && (it.lat == null || it.lat === wrong[0]); i++) { await new Promise(r => setTimeout(r, 100)); W.render(); }
    return { n: it.n, lat: it.lat, lng: it.lng, asked: (window.__pinAsk || []).includes(it.n), wrong };
  });
  t.ok(fix.asked && fix.lat != null && Math.abs(fix.lat - fix.wrong[0]) > 0.001, `a stop that only had a wrong pin is placed again (${fix.n}: ${fix.lat && fix.lat.toFixed(4)}, ${fix.lng && fix.lng.toFixed(4)})`);
  await pg.evaluate(() => { W.S.tview = 'days'; W.render(); });
  t.eq(errors(), [], 'no page errors');
  await ctx.close();
  /* (v201) the shared collections (places, morefood, menus) hold a document for every city anyone planned: only the
     trip's cities' documents are watched, never the whole collection, and a city that leaves the trip is let go */
  {
    const many = Object.assign({}, seed);
    for (let i = 0; i < 30; i++) for (const c of ['places', 'morefood', 'menus']) many[c + '/nowhere-town-' + i] = { city: 'Town ' + i, country: 'Nowhere', items: {} };
    const ops = [], db = mkdb(many), rec = (o, p, body) => { ops.push(o + ' ' + p); return db(o, p, body); };
    const c2 = await open(b, { width: 390, db: rec }); await exampleTrip(c2.pg);
    await c2.pg.waitForTimeout(1200);
    const got = ops.filter(o => /^\w+ (places|morefood|menus)(\/|$)/.test(o));
    t.ok(!got.some(o => /^list /.test(o)) && !got.some(o => /nowhere-town/.test(o)) && got.includes('get places/italy-rome') && got.includes('get morefood/italy-rome') && got.includes('get menus/italy-rome'),
      'only the trip\'s cities\' documents are read, never the whole collections: ' + JSON.stringify([...new Set(got)].slice(0, 8)));
    const left = await c2.pg.evaluate(() => { const c = W.S.countries[0], gone = c.picked[0]; c.picked = c.picked.slice(1); W.changed(); return { gone: W.citySlug(c.name, gone), kept: W.citySlug(c.name, c.picked[0]) }; });
    await c2.pg.waitForTimeout(1500); ops.length = 0; await c2.pg.waitForTimeout(1500);
    const after = ops.filter(o => /^get (places|morefood|menus)\//.test(o));
    t.ok(!after.some(o => o.endsWith('/' + left.gone)) && after.some(o => o.endsWith('/' + left.kept)),
      'a city that left the trip is no longer watched, the others still are (' + left.gone + ' gone, ' + left.kept + ' kept): ' + JSON.stringify([...new Set(after)].slice(0, 8)));
    t.eq(c2.errors(), [], 'no page errors there either');
    await c2.ctx.close();
  }
  await b.close();
};
