/* Google Maps through the viewer's own connection (lib/gmaps.js): real times between stops that travel with the trip,
   the forecast with a way indoors, Explore's search on Google's listings, a place from a pasted link, a day's places
   as a list in Google Maps, the switch in Settings; and that nothing changes for a viewer without the connection.
   The connector is mocked (test/mocks/mock2.js, on when window.__gmaps is set before the app starts): its answers have
   the real connector's shape, and its times differ from the app's own estimate so a check can tell them apart. */
const { launch, open, exampleTrip, settle, until } = require('../lib/page'); const mkdb = require('../lib/db');
const G = pg => pg.evaluate(() => (window.__mcp || []).filter(c => c[0] === 'Google Maps').map(c => [c[1], c[2]]));
const idle = pg => until(() => pg.evaluate(() => W.gmOn() && W.gmState().left === 0 && Object.keys(W.S.rl || {}).length > 3), 20000);
exports.run = async t => {
  const b = await launch();

  /* ---- a viewer without the connection: everything as before ---- */
  const a = await open(b, { width: 390, db: mkdb() }); await exampleTrip(a.pg);
  await a.pg.waitForTimeout(1600);
  const plain = await a.pg.evaluate(async () => {
    const d = W.P.days[1], home = W.homebase(d.country, d.city), first = d.slots.find(x => x.item && x.item.lat != null).item, lg = W.leg(home, first), est = W.legEst(home, first);
    W.goView('settings'); await new Promise(r => setTimeout(r, 500)); const card = (document.getElementById('set-gm') || {}).textContent || ''; W.goView('trip');
    return { on: W.gmOn(), why: W.gmState().why, real: !!lg.real, same: lg.min === est.min, note: !!document.querySelector('.gm-note'), wx: !!document.querySelector('.day-wx'), list: !!document.querySelector('[data-gmlist]'), rl: Object.keys(W.S.rl || {}).length, card,
      plan: W.P.days.map(x => (x.slots || []).map(y => y.item ? y.item.n : '').join('|')), calls: (window.__mcp || []).filter(c => c[0] === 'Google Maps').length };
  });
  t.ok(!plain.on && plain.why === 'none' && plain.calls === 0, 'without a Google Maps connection nothing is asked of it: ' + JSON.stringify([plain.on, plain.why, plain.calls]));
  t.ok(!plain.real && plain.same && !plain.note && !plain.wx && !plain.list && !plain.rl, 'and the screens show the estimate, with no forecast, list button or Google note');
  t.ok(/Not connected/.test(plain.card) && /Connectors/.test(plain.card), 'Settings says how to connect it: ' + plain.card.slice(-120));
  /* a long Google Maps link says the place and its pin by itself; a short one needs the connection */
  const noConn = await a.pg.evaluate(async () => {
    W.S.day = 3; W.S.tview = 'map'; W.render(); await new Promise(r => setTimeout(r, 300));
    const go = async q => { document.getElementById('placeQ').value = q; document.querySelector('[data-psearch="1"]').click(); await new Promise(r => setTimeout(r, 700)); return { rows: [...document.querySelectorAll('.ps-it')].map(li => [li.querySelector('b').textContent, li.querySelector('.ps-src').textContent]), text: document.querySelector('.psearch').textContent }; };
    const long = await go('https://www.google.com/maps/place/Trattoria+Da+Enzo+al+29/@41.8885,12.4776,17z/data=!3m1!4b1!4m6!3m5!1s0x132f6038:0x4a1b!8m2!3d41.8884871!4d12.4776618');
    const short = await go('https://maps.app.goo.gl/AbCd1234');
    return { long, short };
  });
  t.eq(noConn.long.rows, [['Trattoria Da Enzo al 29', 'From your link']], 'a long Google Maps link gives its place without any connection');
  t.ok(!noConn.short.rows.length && /short Google Maps link/.test(noConn.short.text), 'a short link says it needs the connection: ' + noConn.short.text.slice(0, 200));
  /* times that came with the trip show on a device that cannot ask for them */
  const carried = await a.pg.evaluate(async () => {
    W.S.tview = 'days'; W.S.day = 2; const d = W.P.days[1], home = W.homebase(d.country, d.city), first = d.slots.find(x => x.item && x.item.lat != null).item;
    W.S.rl = {}; W.S.rl[W.rlKey(home, first)] = [47, 31, 0, 20000]; W.changed(); await new Promise(r => setTimeout(r, 400));
    const lg = W.leg(home, first); return { min: lg.min, real: lg.real, label: lg.label, note: (document.querySelector('.gm-note') || {}).textContent || '', shown: [...document.querySelectorAll('#viewTrip .leg')].map(e => e.textContent).join(' ') };
  });
  t.ok(carried.real && carried.min === 47 && /47 min/.test(carried.shown), 'a real time that came with the trip shows on a device without the connection: ' + carried.shown.slice(0, 80));
  t.ok(/Google Maps/.test(carried.note) && /beta/.test(carried.note), 'with Google\'s note about its walking routes under the day: ' + carried.note);
  t.eq(a.errors(), [], 'no page errors without the connection');
  await a.ctx.close();

  /* ---- with the connection ---- */
  const { pg, ctx, errors } = await open(b, { width: 390, db: mkdb(), init: () => { window.__gmaps = true; } }); await exampleTrip(pg);
  t.ok(await idle(pg), 'with the connection the app asks for the times between stops, and finishes');
  const real = await pg.evaluate(() => {
    const d = W.P.days[1], home = W.homebase(d.country, d.city), first = d.slots.find(x => x.item && x.item.lat != null).item, lg = W.leg(home, first), est = W.legEst(home, first);
    const saved = JSON.parse(localStorage.getItem('waypoint-v2') || '{}');
    return { lg, est, key: W.rlKey(home, first), rl: W.S.rl, inSaved: Object.keys(saved.rl || {}).length, note: !!document.querySelector('#viewTrip .gm-note'), shown: [...document.querySelectorAll('#viewTrip .leg')].map(e => e.textContent).join(' '),
      plan: W.P.days.map(x => (x.slots || []).map(y => y.item ? y.item.n : '').join('|')) };
  });
  const calls = await G(pg), routes = calls.filter(c => c[0] === 'compute_routes').map(c => c[1]);
  t.ok(real.lg.real && real.lg.min !== real.est.min && real.rl[real.key][0] === real.lg.min, 'a stop\'s time is Google\'s, not the estimate: ' + real.lg.min + ' min ' + real.lg.label + ' (estimate ' + real.est.min + ')');
  t.ok(new RegExp('\\b' + real.lg.min + ' min').test(real.shown) && real.note, 'the day shows it, with the note that the times are Google\'s');
  t.ok(real.inSaved > 3, 'the times are saved with the trip, so everyone it is shared with sees the same clock: ' + real.inSaved);
  t.eq(real.plan[1], plain.plan[1], 'the day keeps its places: real times move its clock, not its picks');
  t.ok(routes.length > 3 && routes.every(r => !r.routingPreference && !r.computeAlternativeRoutes && !r.includePolyline && !(r.intermediateWaypoints || []).length), 'only the basic kind of route request is made (no live traffic, alternatives or shapes): ' + routes.length);
  const tr = routes.filter(r => r.travelMode === 'TRANSIT'), now = Date.now();
  t.ok(tr.every(r => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(r.departureTime) && Date.parse(r.departureTime) > now && Date.parse(r.departureTime) < now + 100 * 864e5) && routes.filter(r => r.travelMode !== 'TRANSIT').every(r => !r.departureTime),
    'a transit time is asked for a morning still to come, inside Google\'s 100 days: ' + (tr[0] ? tr[0].departureTime : 'no transit hop in this trip'));
  /* asked once, and only for the day on show: drawing again asks nothing; another day's hops are asked when it is opened */
  t.ok(routes.length <= 20, 'only the hops of the day on show were asked for, not the whole trip\'s: ' + routes.length);
  const again = await pg.evaluate(async () => {
    const n = window.__mcp.length; W.changed(); W.render(); await new Promise(r => setTimeout(r, 1500)); const same = window.__mcp.length - n;
    const d = W.P.days[2], home = W.homebase(d.country, d.city), first = d.slots.find(x => x.item && x.item.lat != null).item, before = !!W.leg(home, first).real;
    W.S.day = 3; W.render(); for (let i = 0; i < 60 && !(W.gmState().left === 0 && W.leg(home, first).real); i++) await new Promise(r => setTimeout(r, 100));
    return { same, before, after: !!W.leg(home, first).real };
  });
  t.eq(again.same, 0, 'a time that is known is not asked for again');
  t.ok(!again.before && again.after, 'another day\'s times are asked for when that day is opened');
  /* no transit between two places: on foot when close, otherwise by car or taxi; and "no route at all" keeps the estimate */
  const fb = await pg.evaluate(async () => {
    window.__gmNoTransit = true; const A = { lat: 41.9, lng: 12.5 }, near = { lat: 41.915, lng: 12.5 }, far = { lat: 41.96, lng: 12.5 };
    W.legWant++; W.leg(A, near); W.leg(A, far); W.legWant--; for (let i = 0; i < 60 && !(W.S.rl[W.rlKey(A, near)] && W.S.rl[W.rlKey(A, far)]); i++) await new Promise(r => setTimeout(r, 100));
    window.__gmNoTransit = false; return { near: W.leg(A, near), far: W.leg(A, far), est: W.legEst(A, far) };
  });
  t.ok(fb.near.real && fb.near.mode === 'walking' && fb.far.real && fb.far.mode === 'driving' && fb.far.label === 'drive or taxi', 'where there is no transit, a close stop is walked and a far one driven: ' + fb.near.min + ' min ' + fb.near.label + ', ' + fb.far.min + ' min ' + fb.far.label);

  /* ---- the forecast ---- */
  await pg.evaluate(() => { localStorage.setItem('waypoint-now', '2027-06-08T10:30:00'); W.goView('go'); });
  const wx = await until(() => pg.evaluate(() => { const p = document.querySelector('#viewGo .day-wx'); return p ? { text: p.textContent, wet: p.classList.contains('wet'), chip: !!p.querySelector('[data-rescue="rain"]'), link: (p.querySelector('a') || {}).href } : null; }), 8000);
  t.ok(wx && /Today's forecast: Rain · 75% chance of rain · (19–21°C|65–70°F)/.test(wx.text) && /^https:\/\/www\.google\.com\//.test(wx.link), 'Today shows the day\'s forecast, from Google: ' + (wx && wx.text));
  t.ok(wx && wx.wet && wx.chip, 'with rain likely and the day under way, going indoors is one tap from it');
  const resc = await pg.evaluate(async () => { document.querySelector('#viewGo .day-wx [data-rescue="rain"]').click(); await new Promise(r => setTimeout(r, 600)); return { done: !!document.querySelector('.go-rescue.done'), chip: !!document.querySelector('#viewGo .day-wx [data-rescue]'), wx: !!document.querySelector('#viewGo .day-wx') }; });
  t.ok(resc.done && !resc.chip && resc.wx, 'the tap moves the rest of the day indoors (and the offer goes, the forecast stays)');
  const wxCalls = (await G(pg)).filter(c => c[0] === 'lookup_weather').map(c => c[1]);
  t.ok(wxCalls.length >= 1 && wxCalls.every(c => c.capabilities.join() === 'WEATHER' && c.date && c.date.year === 2027 && c.date.month === 6 && c.date.day >= 8 && c.date.day <= 17), 'only days inside Google\'s ten are asked for, weather only: ' + JSON.stringify(wxCalls.map(c => c.date.day)));
  const farDay = await pg.evaluate(async () => { const n = window.__mcp.length; W.wxLine(W.P.days[W.P.days.length - 1]); localStorage.setItem('waypoint-now', '2027-05-01T10:00:00'); const none = W.wxLine(W.P.days[1]); await new Promise(r => setTimeout(r, 900)); localStorage.setItem('waypoint-now', '2027-06-08T10:30:00'); return { asked: window.__mcp.length - n, none, days: W.P.days.length }; });
  t.ok(farDay.none === '' && (farDay.days <= 10 || farDay.asked === 0), 'a day further off shows no forecast and asks for none');
  const tripWx = await pg.evaluate(async () => { W.goView('trip'); W.S.tview = 'days'; W.S.day = 3; W.render(); for (let i = 0; i < 40 && !document.querySelector('#viewTrip .day-wx'); i++) await new Promise(r => setTimeout(r, 150)); const p = document.querySelector('#viewTrip .day-wx'); if (!p) return null; const r = p.getBoundingClientRect(), tt = p.querySelector('.wx-t'), q = tt && tt.getBoundingClientRect();
    return { text: p.textContent, chip: !!p.querySelector('[data-rescue]'), inside: !!q && getComputedStyle(tt).position === 'static' && q.right <= r.right + 0.5 && q.top >= r.top - 0.5 && q.bottom <= r.bottom + 0.5 }; });
  t.ok(tripWx && /^Forecast: Rain/.test(tripWx.text) && !tripWx.chip, 'the Trip screen shows a coming day\'s forecast (no rescue there): ' + (tripWx && tripWx.text));
  t.ok(tripWx && tripWx.inside, 'the temperatures sit in the forecast line, not pinned past its edge (they once took the stop badge\'s style)');

  /* ---- Google Maps under the day's stops: one row (Maps, Save as list, About times), nothing stacked ---- */
  const row = await pg.evaluate(async () => {
    W.goView('trip'); W.S.tview = 'days'; W.S.day = 3; W.render(); await new Promise(r => setTimeout(r, 300));
    const g = document.querySelector('#viewTrip .gm-row'); if (!g) return null;
    const cells = [...g.querySelectorAll('.gmr')], tops = cells.map(c => Math.round(c.getBoundingClientRect().top)), note = g.parentNode.querySelector('.gm-row ~ .gm-note');
    const before = !!note && note.hidden; g.querySelector('[data-gmnote]').click(); const after = !note.hidden && g.querySelector('[data-gmnote]').getAttribute('aria-expanded') === 'true'; g.querySelector('[data-gmnote]').click();
    return { labels: cells.map(c => c.textContent.trim()), oneRow: new Set(tops).size === 1, arrows: /↗/.test(g.textContent), before, after, old: !!document.querySelector('.day-gm, .rc-gm, .gm-list') };
  });
  t.ok(row && row.labels.join('|') === 'Maps|Save as list|About times' && row.oneRow && !row.arrows && !row.old, 'Google Maps is one row under the stops: Maps, Save as list, About times: ' + JSON.stringify(row));
  t.ok(row && row.before && row.after, 'About times shows where the times come from, and hides it again');

  /* ---- a day's places as a list in Google Maps ---- */
  const list = await pg.evaluate(async () => {
    const btn = document.querySelector('#viewTrip .gm-row [data-gmlist]'); if (!btn) return null; const total = new Set(W.P.days[2].slots.filter(x => x.item).map(x => x.item.n)).size;
    btn.click(); for (let i = 0; i < 40 && !document.querySelector('#viewTrip .gm-row a[aria-label*="as a list"]'); i++) await new Promise(r => setTimeout(r, 100));
    const a2 = document.querySelector('#viewTrip .gm-row a[aria-label*="as a list"]'); return { href: a2 && a2.href, text: a2 && a2.getAttribute('aria-label') + ' / ' + a2.textContent, total, q: window.__mcp.filter(c => c[1] === 'resolve_names').map(c => c[2]) };
  });
  t.ok(list && /^https:\/\/www\.google\.com\/maps\/@\?api=1&map_action=shortlist&place_ids=/.test(list.href) && list.text.indexOf('these ' + list.total + ' places') > -1 && /Open the list$/.test(list.text), 'one tap on Save as list makes a Google Maps list of the day\'s places, and the button becomes its link: ' + (list && list.text));
  t.ok(list && list.q.length === 1 && list.q[0].queries.length === list.total && list.q[0].queries.every(x => /, Rome, Italy$/.test(x.text)) && list.q[0].locationBias, 'asked once, each place by its name and town');
  const unsure = await pg.evaluate(async () => {
    const d = W.P.days[2], it = d.slots.find(x => x.item).item, old = it.n; it.n = 'Nowhere Cafe'; W.render(); await new Promise(r => setTimeout(r, 200));
    const n0 = window.__mcp.filter(c => c[1] === 'resolve_names').length; document.querySelector('#viewTrip .gm-row [data-gmlist]').click();
    for (let i = 0; i < 40 && !document.querySelector('#viewTrip .gm-row a[aria-label*="as a list"]'); i++) await new Promise(r => setTimeout(r, 100));
    const row = document.querySelector('#viewTrip .gm-row'), box = { textContent: (row.nextElementSibling && row.nextElementSibling.classList.contains('gm-msg') ? row.nextElementSibling.textContent : ''), querySelector: s => row.querySelector('a[aria-label*="as a list"]') }, qs = window.__mcp.filter(c => c[1] === 'resolve_names').slice(n0).map(c => c[2].queries.map(x => x.text));
    const out = { text: box.textContent, href: (box.querySelector('a') || {}).href || '', qs }; it.n = old; W.render(); return out;
  });
  t.ok(unsure.qs.length === 2 && unsure.qs[0].some(x => /Nowhere Cafe/.test(x)) && !unsure.qs[1].some(x => /Nowhere Cafe/.test(x)) && /didn't find: Nowhere Cafe/.test(unsure.text) && unsure.href.split(',').length === unsure.qs[1].length,
    'a place Google only half-recognises is left off the list, and named: ' + unsure.text.slice(0, 140));

  /* ---- Explore's search on Google's listings ---- */
  await pg.evaluate(() => { W.S.day = 3; W.S.tview = 'map'; W.render(); }); await settle(pg, 3000);
  const n0 = (await pg.evaluate(() => window.__mcp.length));
  await pg.fill('#placeQ', 'gelato'); await pg.click('[data-psearch="1"]'); await pg.waitForTimeout(400); await settle(pg, 4000);
  const res = await pg.evaluate(n => ({ rows: [...document.querySelectorAll('.ps-it')].map(li => [li.querySelector('b').textContent, li.querySelector('.ps-src').textContent, (li.querySelector('.ps-d') || {}).textContent || '', (li.querySelector('.ps-l a') || {}).href || '']),
    calls: window.__mcp.slice(n).map(c => [c[0], c[1], c[2]]), note: document.querySelector('.ps-src-note').textContent }), n0);
  const g1 = res.rows.find(r => r[0] === 'Gelateria Gelato');
  t.ok(g1 && g1[1] === 'On Google Maps' && /4\.9★ · Trendy and family-friendly ice cream shop/.test(g1[2]) && /query_place_id=ChIJgoogleOne/.test(g1[3]), 'the search shows Google\'s places, each linked to its own listing: ' + JSON.stringify(g1));
  t.ok(!res.rows.some(r => r[0] === 'Far Google Place') && res.rows.some(r => r[1] === 'Suggested by Claude'), 'a far-off answer is left out, and Claude\'s ideas still come alongside');
  const sp = res.calls.filter(c => c[1] === 'search_places');
  t.ok(sp.length === 1 && sp[0][2].pageSize === 5 && !sp[0][2].includeExtendedDetails && /^gelato in Rome, Italy$/.test(sp[0][2].textQuery) && !res.calls.some(c => c[0] === 'Mapbox'), 'one basic Google request (five places, no extended details), and Mapbox is not asked as well');
  t.ok(/from Google Maps/.test(res.note), 'the list says whose places these are');
  const added = await pg.evaluate(async () => {
    const li = [...document.querySelectorAll('.ps-it')].find(l => /Gelateria Gelato/.test(l.textContent)); li.querySelector('[data-ppick]').click(); await new Promise(r => setTimeout(r, 200));
    document.querySelector('.ps-slot[data-pslot="lunch"]').click(); await new Promise(r => setTimeout(r, 400));
    const imp = ((W.S.imported || {})['Italy|Rome'] || []).find(x => x.n === 'Gelateria Gelato'), it = W.pool('Italy', 'Rome').food.find(x => x.n === 'Gelateria Gelato');
    return { imp, it: it && { gid: it.gid, gpin: it.gpin, lat: it.lat, d: it.d }, on: W.P.days[2].slots.find(x => x.slot === 'lunch').item.n, gm: W.gmapsPlace(it, 'Rome') };
  });
  t.ok(added.on === 'Gelateria Gelato' && added.imp && added.imp.gid === 'ChIJgoogleOne000000000000000' && added.imp.src === 'google' && /^\d{4}-\d\d-\d\d$/.test(added.imp.gat), 'an added Google place keeps its place ID and the day its pin was taken: ' + JSON.stringify(added.imp));
  t.ok(added.imp && !added.imp.d && added.it && added.it.d === 'Added by you', 'Google\'s description and rating are not kept with the trip');
  t.ok(added.it && added.it.gid === added.imp.gid && added.it.gpin === 1 && added.it.lat != null && /query_place_id=ChIJgoogleOne/.test(added.gm), 'its pin is marked as Google\'s (never drawn on the app\'s own street map), and its links open the listing');
  const aged = await pg.evaluate(async () => {
    const imp = W.S.imported['Italy|Rome'].find(x => x.n === 'Gelateria Gelato'); imp.gat = W.isoDay(new Date(Date.now() - 31 * 864e5)); W.changed(); await new Promise(r => setTimeout(r, 400));
    const it = W.pool('Italy', 'Rome').food.find(x => x.n === 'Gelateria Gelato'); return { lat: it.lat, gpin: it.gpin, igp: it.igp, asked: it.pinAsked, gid: it.gid, imp: imp.lat, still: W.P.days[2].slots.some(x => x.item && x.item.n === 'Gelateria Gelato') };
  });
  t.ok(!aged.gpin && !aged.igp && aged.imp == null && (aged.lat == null || aged.asked === 1) && aged.gid === 'ChIJgoogleOne000000000000000' && aged.still,
    'after 30 days Google\'s pin comes off (Claude is asked where the place is instead); the place stays on the day, linked by its place ID: ' + JSON.stringify(aged));
  /* ---- a pasted Google Maps link ---- */
  const n1 = await pg.evaluate(() => window.__mcp.length);
  await pg.fill('#placeQ', 'https://maps.app.goo.gl/AbCd1234'); await pg.click('[data-psearch="1"]');
  const link = await until(() => pg.evaluate(n => { const rows = [...document.querySelectorAll('.ps-it')].map(li => [li.querySelector('b').textContent, li.querySelector('.ps-src').textContent, (li.querySelector('.ps-l a') || {}).href || '']); return rows.length ? { rows, tools: window.__mcp.slice(n).map(c => c[1]), google: !!document.querySelector('.ps-google') } : null; }, n1), 6000);
  t.ok(link && link.rows.length === 1 && link.rows[0][0] === 'Linked Trattoria' && link.rows[0][1] === 'From your link' && /query_place_id=ChIJlinkedPlace/.test(link.rows[0][2]), 'a pasted short link becomes its one place, ready to add: ' + JSON.stringify(link && link.rows));
  t.eq(link && link.tools, ['resolve_maps_urls', 'lookup_weather', 'search_places'], 'read in three requests: the place behind the link, its name, its pin');
  const badLink = await pg.evaluate(async () => { document.getElementById('placeQ').value = 'https://www.google.com/maps/search/pizza'; document.querySelector('[data-psearch="1"]').click(); await new Promise(r => setTimeout(r, 900)); return document.querySelector('.psearch').textContent; });
  t.ok(/couldn't tell which place/.test(badLink), 'a link that is not one place says so: ' + badLink.slice(0, 160));

  /* ---- Settings: the switch, and a refusal ---- */
  const sw = await pg.evaluate(async () => {
    W.goView('settings'); await new Promise(r => setTimeout(r, 500)); const c0 = document.getElementById('set-gm').textContent;
    document.querySelector('[data-gm="off"]').click(); await new Promise(r => setTimeout(r, 400)); const c1 = document.getElementById('set-gm').textContent, off = !W.gmOn();
    const n = window.__mcp.length; W.legWant++; W.leg({ lat: 41.8, lng: 12.4 }, { lat: 41.81, lng: 12.41 }); W.legWant--; await new Promise(r => setTimeout(r, 1200)); const quiet = window.__mcp.length === n;
    document.querySelector('[data-gm="on"]').click(); for (let i = 0; i < 30 && !W.gmOn(); i++) await new Promise(r => setTimeout(r, 100));
    return { c0, c1, off, quiet, on: W.gmOn(), kept: JSON.parse(localStorage.getItem('waypoint-gmaps-v1') || '{}') };
  });
  t.ok(/Connected\./.test(sw.c0) && /Requests today from this device: \d+/.test(sw.c0), 'Settings shows the connection and how much it has been used today');
  t.ok(sw.off && /Turned off on this device/.test(sw.c1) && sw.quiet && sw.on, 'the switch turns it off (nothing more is asked) and on again');
  const no = await pg.evaluate(async () => {
    window.__mcpFail = { compute_routes: 'not_in_manifest' }; W.legWant++; W.leg({ lat: 41.7, lng: 12.3 }, { lat: 41.705, lng: 12.305 }); W.legWant--;
    for (let i = 0; i < 40 && W.gmOn(); i++) await new Promise(r => setTimeout(r, 100)); window.__mcpFail = null;
    const n = window.__mcp.length; W.legWant++; W.leg({ lat: 41.6, lng: 12.2 }, { lat: 41.605, lng: 12.205 }); W.legWant--; await new Promise(r => setTimeout(r, 1200));
    W.goView('settings'); await new Promise(r => setTimeout(r, 400));
    return { st: W.gmState(), more: window.__mcp.length - n, card: document.getElementById('set-gm').textContent, kept: !!JSON.parse(localStorage.getItem('waypoint-gmaps-v1') || '{}').no };
  });
  t.ok(no.st.state === 'off' && no.st.why === 'no' && no.more === 0 && no.kept && /You said no/.test(no.card) && /Ask me again/.test(no.card), 'when the viewer says no to Claude\'s question, the app stops asking and Settings offers to ask again: ' + JSON.stringify(no.st));
  /* asked again, it is back; and when Google does not answer a search, the map search is Mapbox's, as before */
  await pg.evaluate(async () => { document.querySelector('[data-gm="on"]').click(); for (let i = 0; i < 30 && !W.gmOn(); i++) await new Promise(r => setTimeout(r, 100)); W.goView('trip'); W.S.day = 3; W.S.tview = 'map'; W.render(); await new Promise(r => setTimeout(r, 400)); });
  const fell = await pg.evaluate(async () => {
    window.__mcpFail = { search_places: 'server_unavailable' }; document.getElementById('placeQ').value = 'beach'; document.querySelector('[data-psearch="1"]').click(); await new Promise(r => setTimeout(r, 1200));
    window.__mcpFail = null; return { rows: [...document.querySelectorAll('.ps-it')].map(li => li.querySelector('.ps-src').textContent), on: W.gmOn() };
  });
  t.ok(fell.rows.includes('On the map') && !fell.rows.includes('On Google Maps') && fell.on, 'when Google does not answer, the search falls back to Mapbox: ' + JSON.stringify(fell.rows));

  t.eq(errors(), [], 'no page errors with the connection');
  await ctx.close();

  /* ---- on the road: today and the two days after are asked for without being opened ---- */
  const d = await open(b, { width: 390, db: mkdb(), init: () => { window.__gmaps = true; try { localStorage.setItem('waypoint-now', '2027-06-08T09:00:00'); } catch (e) {} } }); await exampleTrip(d.pg);
  const road = await until(() => d.pg.evaluate(() => {
    if (!W.gmOn() || W.gmState().left) return null;
    const has = n => { const x = W.P.days[n - 1], home = W.homebase(x.country, x.city), first = (x.slots.find(y => y.item && y.item.lat != null) || {}).item; return first ? !!W.leg(home, first).real : null; };
    return has(3) && has(4) ? { d2: has(2), d3: has(3), d4: has(4), d7: has(7), n: window.__mcp.filter(c => c[1] === 'compute_routes').length } : null;
  }), 20000);
  t.ok(road && road.d2 && road.d3 && road.d4 && road.d7 === false, 'during the trip, today and the next two days have their real times before they are opened; later days wait: ' + JSON.stringify(road));
  await d.ctx.close();

  /* ---- the day's limit ---- */
  const c = await open(b, { width: 390, db: mkdb(), init: () => { window.__gmaps = true; try { localStorage.setItem('waypoint-gmaps-v1', JSON.stringify({ n: [Math.floor(Date.now() / 864e5), 300] })); } catch (e) {} } }); await exampleTrip(c.pg);
  await c.pg.waitForTimeout(2500);
  const cap = await c.pg.evaluate(() => ({ on: W.gmOn(), calls: (window.__mcp || []).filter(x => x[0] === 'Google Maps').length, rl: Object.keys(W.S.rl || {}).length }));
  t.ok(cap.on && cap.calls === 0 && cap.rl === 0, 'past the day\'s limit of requests from a device, nothing more is asked until tomorrow: ' + JSON.stringify(cap));
  await c.ctx.close(); await b.close();
};
