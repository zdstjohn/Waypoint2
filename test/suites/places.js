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
      'rome cafe 3': { g: 'ChIJtest3', gpin: 1, gat: new Date().toISOString().slice(0, 10), lat: 41.9011, lng: 12.4722 },
      'rome cafe 4': { g: 'ChIJtest4', gpin: 1, gat: new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10), lat: 41.7, lng: 12.7 },
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
  /* stops on (nearly) the same spot share one marker on the detailed map, numbers in a row, so none hides another */
  const g = await pg.evaluate(() => {
    const pts = [{ num: 1, lat: 35.36012, lng: 24.49616 }, { num: 2, lat: 35.36012, lng: 24.49616 }, { num: 3, lat: 35.37, lng: 24.47 }, { num: 4, lat: 35.36013, lng: 24.49617 }];
    const proj = p => ({ x: (p.lng - 24.4) * 20000, y: -(p.lat - 35.3) * 20000 });   /* about 2 px per 10 m */
    return W.pinGroups(pts, proj).map(x => x.items.map(p => p.num).join('·'));
  });
  t.eq(g, ['1·2·4', '3'], 'stops on the same spot share one marker that shows every number');
  /* Explore's route lists every stop; one with no pin says so and links to Google Maps by name, and the whole-day
     Google Maps link carries every stop, pinned or by name */
  const rt = await pg.evaluate(async () => {
    W.S.tview = 'map'; W.render(); await new Promise(r => setTimeout(r, 300));
    const d = W.P.days[W.S.day - 1], stops = (d.slots || []).filter(x => x.item).map(x => x.item);
    const rows = [...document.querySelectorAll('#viewTrip .rc-stop')], gm = (document.querySelector('#viewTrip .rc-gm') || {}).href || '';
    const wp = decodeURIComponent((gm.match(/waypoints=([^&]*)/) || [])[1] || '').split('|').filter(Boolean);
    return { n: rows.length, stops: stops.length, noLL: stops.filter(it => it.lat == null).length, byName: rows.filter(r => /find on Google Maps/.test(r.textContent)).length, wp: wp.length };
  });
  t.ok(rt.n === rt.stops && rt.byName === rt.noLL && rt.wp === Math.min(9, rt.stops), `the route lists every stop (${rt.n}), finds the unpinned ones by name (${rt.byName}), and the Google Maps link carries all of them (${rt.wp})`);
  await pg.evaluate(() => { W.S.tview = 'days'; W.render(); });
  /* Google: a place the nightly check found there carries its place ID, so every "Google Maps" link (the stop, the whole
     day) opens the exact listing; a pin taken from Google is used for 30 days only, and never drawn on the free street map */
  const gg = await pg.evaluate(() => {
    const p = W.pool('Italy', 'Rome'), c3 = p.food.find(x => x.n === 'Rome cafe 3'), c4 = p.food.find(x => x.n === 'Rome cafe 4');
    const d = W.P.days.find(x => x.city === 'Rome'), url = c3 && W.dayRouteUrl(d, [{ n: 'Somewhere', lat: 41.9, lng: 12.5 }, c3], { label: 'Hotel', lat: 41.9, lng: 12.48 });
    return { gid: c3 && c3.gid, link: c3 && W.gmapsPlace(c3, 'Rome'), plain: W.gmapsPlace('Rome cafe 9', 'Rome'), pin: c3 && [c3.lat, c3.lng], gpin: c3 && c3.gpin,
      stale: c4 && [c4.lat, c4.lng], staleG: c4 && c4.gpin, ids: url && decodeURIComponent((url.match(/waypoint_place_ids=([^&]*)/) || [])[1] || '') };
  });
  t.ok(gg.gid === 'ChIJtest3' && /query_place_id=ChIJtest3/.test(gg.link) && !/query_place_id/.test(gg.plain), `a place Google knows links to its exact listing (${gg.link && gg.link.split('?')[1]})`);
  t.eq(gg.ids, '|ChIJtest3', 'the whole-day Google Maps link names each stop Google knows, in order');
  t.ok(gg.pin && gg.pin[0] === 41.9011 && gg.gpin === 1, 'a pin from Google is used while it is fresh');
  t.ok(gg.stale && gg.stale[0] !== 41.7 && !gg.staleG, `a pin from Google older than 30 days is no longer used (${gg.stale})`);
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
  await ctx.close(); await b.close();
};
