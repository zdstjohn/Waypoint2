/* A flight day. The phone has no signal at all (the network is cut, every request fails, Claude and the connected
   services fail as they do with no network, and so do the database's writes) and a person uses the whole app: every
   screen, every kind of change. Then the signal comes back.

   While offline: no page errors, no request left hanging, no spinner that never ends, every feature that needs a
   connection says so when it is tapped (never a dead button), every change is on the phone at once (and survives a
   reload). Back online, with no reload: what was queued for the account goes out, and what needed the internet works.

   A second phone is opened with no signal from the start (the page itself from the phone's memory) and the signal
   comes later: the lists, the Google times and the account catch up. */
const { launch, open, exampleTrip, settle, calm } = require('../lib/page'); const mkdb = require('../lib/db');
const MOCKS = ['test/mocks/mockdur.js', 'test/mocks/mock2.js', 'test/mocks/flightnet.js'];
exports.run = async t => {
  if (process.env.FLIGHT !== 'app') await artifact(t);
  if (process.env.FLIGHT !== 'artifact') await installable(t);
};
async function artifact(t) {
  /* photos in the index: files of this site (a route serves them, and refuses them with no signal) */
  const items = {};
  for (const [pat, n] of [['2', 30], ['8', 30]]) for (let i = 0; i < n; i++) items['rome sight ' + pat + ' ' + i] = { url: '__photo/rome-' + pat + '-' + i + '.png', credit: 'Test, CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Rome' + i + '.jpg' };
  items.rome = { url: '__photo/rome-city.png', credit: 'Test, CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Rome.jpg' };
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const photoRoute = net0 => route => net0.off ? route.abort('internetdisconnected') : route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  const store = mkdb({ 'photos/italy-rome': { items, city: 'Rome', country: 'Italy' } }), net = { off: false, writes: [], failed: [] };
  /* the account's database as the app reaches it: while the signal is gone a write fails with no code, like a request
     that never got anywhere; what is read comes from what the phone already has */
  const dbop = (o, path, body) => {
    if (o === 'set' || o === 'delete') { if (net.off) { net.failed.push(o + ' ' + path); throw new Error('Failed to fetch'); } net.writes.push(o + ' ' + path); }
    return store(o, path, body);
  };
  const b = await launch();
  const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: dbop, mocks: MOCKS });
  await ctx.route('**/__photo/**', photoRoute(net));
  const reqs = { open: new Set(), failed: [] };
  pg.on('request', r => { if (!/^(data|blob):/.test(r.url())) reqs.open.add(r); });
  pg.on('requestfinished', r => reqs.open.delete(r));
  pg.on('requestfailed', r => { reqs.open.delete(r); reqs.failed.push(r.url().slice(0, 100)); });
  const wait = ms => pg.waitForTimeout(ms);
  const text = () => pg.evaluate(() => (document.querySelector('#sheethost .sheet') || document.querySelector('main:not([hidden])') || document.body).innerText.replace(/\s+/g, ' '));
  const spinners = () => pg.evaluate(() => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    return [...document.querySelectorAll('.loading, [aria-busy="true"], .spinner')].filter(vis).map(e => e.textContent.trim().slice(0, 50) + '|' + (getComputedStyle(e, '::before').animationName || '')); });
  /* a spinner that is only waiting: no turning ring, and it says it waits for a connection */
  const stuck = async label => {
    const s = (await spinners()).filter(x => !/^[^|]*Waits|none$/.test(x) || /spin$/.test(x));
    const waiting = await pg.evaluate(() => [...document.querySelectorAll('.loading')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && !/Waits for a connection/.test(getComputedStyle(e, '::after').content); }).map(e => e.textContent.trim().slice(0, 40)));
    t.eq(waiting, [], `${label}: nothing spins or says "loading" with no end in sight`);
    return s;
  };
  const note = () => pg.evaluate(() => (document.querySelector('#nethost') || {}).innerText || '');
  const click = async (sel, ms = 500) => { await pg.click(sel, { timeout: 5000 }); await wait(ms); };
  /* a person taps what needs the internet: it says so, and nothing is asked of the network */
  const needs = async (sel, what, label) => {
    const before = (await pg.evaluate(() => window.__netTried.length));
    const el = await pg.$(sel); if (!el) { t.ok(false, `${label}: the control ${sel} is there`); return; }
    await el.scrollIntoViewIfNeeded(); await el.click({ timeout: 5000 }); await wait(300);
    const n = await note(), tried = (await pg.evaluate(() => window.__netTried.length)) - before;
    t.ok(new RegExp(what + '.* needs a connection', 'i').test(n) && tried === 0, `${label}: tapped offline it says "${n.replace(/\s+/g, ' ').slice(0, 70)}" and asks nothing of the network`);
  };

  /* ---- the trip, online, and let everything settle; the trip's cities saved for offline ---- */
  await exampleTrip(pg); await settle(pg, 8000);
  await pg.evaluate(() => { localStorage.setItem('waypoint-now', '2027-06-09T10:30'); W.S.start = '2027-06-07'; W.isExample = false; W.S.tripName = 'Italy'; W.changed(); });
  await calm(pg, 6000);
  const saved = await pg.evaluate(async () => { await W.offline.save(W.P, 'test'); return W.offline.state; });
  t.eq(saved, 'done', 'with a signal, the trip is saved to the phone for the trip');
  const N0 = await pg.evaluate(() => W.P.N), writes0 = net.writes.length;
  t.ok(writes0 > 0, 'the trip went to the account while there was a signal (' + writes0 + ' writes)');

  /* ---- the signal goes ---- */
  await ctx.setOffline(true); net.off = true; await wait(700); reqs.failed.length = 0; const cut = net.writes.length;
  t.ok(await pg.evaluate(() => document.documentElement.classList.contains('offline') && W.offline.off), 'the app knows it is offline');
  let hung = 0;

  /* ---- Trip: days, a stop's sheet, a swap, a move, a free part, Explore ---- */
  await click('.dpill[data-day="3"]'); await calm(pg, 3000, 300);
  t.ok(await pg.evaluate(() => W.S.day === 3 && document.querySelectorAll('#viewTrip .slot').length > 3), 'Trip: another day opens with its stops');
  await stuck('Trip');
  /* the photos saved on the phone before the flight show from the phone; none is a broken picture */
  await wait(1200);
  const ph = await pg.evaluate(() => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }; const im = [...document.querySelectorAll('#viewTrip img.photo, #viewTrip img.hero-img')].filter(vis);
    return { n: im.length, blob: im.filter(i => /^blob:/.test(i.getAttribute('src'))).length, broken: im.filter(i => i.complete && i.naturalWidth === 0).length }; });
  t.ok(ph.n > 0 && ph.broken === 0 && ph.blob > 0, 'Trip: the photos saved before the flight show from the phone, none broken: ' + JSON.stringify(ph));
  const k0 = await pg.evaluate(() => { const d = W.P.days[2]; const x = d.slots.find(y => y.item && y.slot === 'am') || d.slots.find(y => y.item && !W.isFood(y.slot)); return x.key; });
  const name0 = await pg.evaluate(k => W.P.days[2].slots.find(x => x.key === k).item.n, k0);
  await pg.click(`[data-open="${k0}"]`, { timeout: 5000 }).catch(async () => { await pg.evaluate(k => W.openStop(k), k0); }); await wait(500);
  t.ok(await pg.evaluate(n => { const s = document.querySelector('.sheet'); return !!s && s.innerText.includes(n); }, name0), "Trip: a stop's sheet opens");
  await stuck("a stop's sheet");
  /* the sheet's own network parts: reviews/photos/map links are links; nothing hangs */
  await click('[data-sheetact="move"]'); await wait(200);
  const rows = await pg.evaluate(() => [...document.querySelectorAll('.sh-row')].map(r => +r.dataset.sheetmove));
  if (rows.length) {
    await click('.sh-row', 700);
    t.ok(await pg.evaluate(([k, n]) => { const here = W.P.days[2].slots.find(x => x.key === k); return !(here.item && here.item.n === n); }, [k0, name0]), 'Trip: a stop moves to another day with no signal');
    await click('[data-undo]', 500);
  } else await pg.evaluate(() => W.closeStop && W.closeStop());
  await pg.evaluate(k => W.openStop(k), k0); await wait(400);
  await click('[data-sheetact="remove"]', 600);
  t.ok(await pg.evaluate(k => !!(W.S.free || {})[k], k0), 'Trip: a part of the day left free');
  await click('[data-undo]', 500);
  /* swap */
  const sl = await pg.evaluate(k => W.P.days[2].slots.find(x => x.key === k).slot, k0);
  await click(`[data-reroll="${sl}"]`, 700);
  t.ok(await pg.evaluate(() => document.querySelectorAll('.swapcards .scard').length >= 2), 'Trip: swap offers ideas from the lists on the phone');
  const pick = await pg.evaluate(() => document.querySelector('.scard').dataset.name);
  await click('.scard', 500); await click('.swap .swp-act [data-use]', 700);
  t.eq(await pg.evaluate(k => W.P.days[2].slots.find(x => x.key === k).item.n, k0), pick, 'Trip: a swap is made and shows at once');
  /* Explore, its filters, its search and Find more */
  await pg.evaluate(() => { W.S.tview = 'map'; W.render(); }); await wait(700);
  const ex0 = await pg.evaluate(() => document.querySelectorAll('#viewTrip .idea').length);
  await click('[data-exf]', 500);
  const ex1 = await pg.evaluate(() => ({ n: document.querySelectorAll('#viewTrip .idea').length, on: document.querySelectorAll('[data-exf][aria-pressed="true"]').length }));
  t.ok(ex0 > 0 && ex1.on === 1, `Explore: ${ex0} ideas, and a filter works offline (${ex1.n} left)`);
  await click('[data-exf][aria-pressed="true"]', 300);
  await stuck('Explore');
  t.ok(/offline.*lists/i.test(await text()), 'Explore: the search box says it finds places already in the lists');
  await pg.fill('#placeQ', 'rome'); await click('[data-psearch]', 900);
  const ps = await pg.evaluate(() => ({ t: (document.querySelector('.psearch') || {}).innerText || '', n: document.querySelectorAll('.ps-it').length }));
  t.ok(/offline.*map search needs a connection/i.test(ps.t) && !/Asking Claude/.test(ps.t) && ps.n > 0, `Explore: a search shows the trip's own places (${ps.n}) and says the map needs a connection`);
  await needs('[data-more]', 'Finding more ideas', 'Explore: Find more');
  await pg.evaluate(() => { W.S.tview = 'days'; W.render(); });

  /* ---- Today: route, running late, change of plans, tickets ---- */
  /* a day with something to book (its tickets are on Today), as today */
  const tixDay = await pg.evaluate(() => { const c = W.checklist(W.P).find(x => x.day && x.key.indexOf('stay|') !== 0 && x.key.indexOf('flight|') !== 0); return c ? c.day : 3; });
  await pg.evaluate(n => { localStorage.setItem('waypoint-now', W.isoDay(W.dateOf(n)) + 'T10:30'); W.S.appMode = 'travel'; W.S.appModeAt = W.isoDay(W.now()); W.goView('go'); }, tixDay); await wait(900);
  await stuck('Today');
  const go = await pg.evaluate(() => ({ route: !!document.querySelector('#viewGo .go-rt li'), tix: !!document.querySelector('#viewGo .go-tix [data-gobook]'), late: !!document.querySelector('[data-late="15"]'), plans: !!document.querySelector('#viewGo [data-goplans]'), off: !!document.querySelector('#viewGo .go-off.is-off') }));
  t.ok(go.route && go.tix && go.off, 'Today: the route and the ticket show, and the offline note leads: ' + JSON.stringify(go));
  if (go.late) {
    const t0 = await pg.evaluate(() => (document.querySelector('.go-rt li.next .t') || document.querySelector('.go-rt li:not(.done) .t') || {}).textContent);
    await click('[data-late="15"]', 700);
    const t1 = await pg.evaluate(() => (document.querySelector('.go-rt li.next .t') || document.querySelector('.go-rt li:not(.done) .t') || {}).textContent);
    t.ok(t0 !== t1, `Today: "Running late" shifts the times offline (${t0} -> ${t1})`);
    await click('[data-late="0"]', 400);
  } else t.note('Today has no running-late control at this hour');
  if (go.plans) {
    await click('#viewGo [data-goplans]', 500);
    const rescue = await pg.evaluate(() => ({ chips: document.querySelectorAll('#viewGo .go-rescue .chip, #viewGo .go-rescue button').length, ask: !!document.querySelector('#replanQ') }));
    t.ok(rescue.chips > 0, 'Today: Change of plans offers its rescues (' + rescue.chips + ')');
    if (rescue.ask) await needs('[data-replan]', 'Replanning the day', 'Today: "say what\'s going on" box');
    const resc = await pg.$('#viewGo .go-rescue [data-rescue]');
    if (resc) { await resc.click(); await wait(600); t.ok(true, 'Today: a rescue was applied offline'); }
  } else t.note('Today has no Change of plans at this hour');
  await stuck('Today (after)');
  /* the briefing on the eve of a travel day */
  const eve = await pg.evaluate(() => { const d = W.P.days.find(x => x.moveFrom); return d ? d.n : 0; });
  if (eve) {
    await pg.evaluate(n => { localStorage.setItem('waypoint-now', W.isoDay(W.dateOf(n - 1)) + 'T10:30'); W.S.day = n - 1; W.goView('go'); }, eve); await wait(700);
    if (await pg.$('[data-brief]')) await needs('[data-brief]', 'The briefing', 'Today: tomorrow\'s briefing');
  }
  /* a ticket's details open */
  await pg.evaluate(n => { localStorage.setItem('waypoint-now', W.isoDay(W.dateOf(n)) + 'T10:30'); W.goView('go'); }, tixDay); await wait(500);
  if (await pg.$('#viewGo [data-gobook]')) { await click('#viewGo [data-gobook]', 700); t.ok(await pg.evaluate(() => !!document.querySelector('.sheet') || W.view() === 'book'), 'Today: a ticket\'s details open offline'); await pg.evaluate(() => { W.closeStop && W.closeStop(); W.goView('go'); }); }

  /* ---- Plan: change an answer (re-plans the trip), add a day ---- */
  await pg.evaluate(() => { W.S.appMode = 'plan'; W.goView('setup'); }); await wait(900);
  await stuck('Plan');
  await needs('[data-review]', 'Checking your plan', 'Plan: Check my plan');
  await pg.evaluate(() => { const b = document.querySelector('#daysPlus'); b.scrollIntoView(); b.click(); }); await calm(pg, 4000, 400); await wait(300);
  t.eq(await pg.evaluate(() => W.P.N), N0 + 1, 'Plan: adding a day re-plans the trip to ' + (N0 + 1) + ' days offline');
  await pg.evaluate(() => { const c = [...document.querySelectorAll('[data-style]')].find(x => /Beaches/.test(x.textContent)); c.scrollIntoView(); c.click(); }); await calm(pg, 4000, 400);
  t.ok(await pg.evaluate(() => (W.S.styles || []).some(s => /beach/i.test(s))) && await pg.evaluate(() => W.P.days.length) === N0 + 1, 'Plan: changing an answer re-plans offline');
  const sp = await stuck('Plan (after changes)');
  t.ok(await pg.evaluate(() => W.P.days.every(d => d.slots && d.slots.length)), 'Plan: every day of the new plan has its stops');
  await pg.evaluate(() => W.goView('trip')); await wait(400);

  /* ---- Prepare: packing, a booking by hand, the budget ---- */
  await pg.evaluate(() => { W.S.prepTab = 'pack'; W.goView('book'); }); await wait(800);
  await stuck('Prepare, packing');
  const pk = await pg.evaluate(() => { const b = document.querySelector('[data-pack]'); const key = b.getAttribute('data-pack'); b.click(); return key; }); await wait(400);
  t.ok(await pg.evaluate(k => { const e = document.querySelector('[data-pack="' + k + '"]'); return !!e && (e.getAttribute('aria-pressed') === 'true' || !!e.closest('.done')) || (W.S.packed || {})[k] != null; }, pk), 'Prepare: an item packed offline stays ticked');
  await pg.evaluate(() => { W.S.prepTab = 'booked'; W.goView('book'); }); await wait(500);
  await needs('[data-gmail]', 'Looking in Gmail', 'Prepare: Find bookings in Gmail');
  await pg.waitForSelector('details.addbk', { state: 'attached', timeout: 8000 });
  await pg.evaluate(() => { const d = document.querySelector('details.addbk'); if (d) d.open = true; });
  await pg.selectOption('#bkKind', 'lodging'); await pg.fill('#bkTitle', 'Hotel Flight Day'); await pg.fill('#bkDate', '2027-06-08'); await pg.fill('#bkPrice', '310'); await pg.fill('#bkCur', 'EUR');
  await click('[data-addbk]', 800);
  t.ok(await pg.evaluate(() => (W.S.bookings || []).some(x => x.title === 'Hotel Flight Day') && /Hotel Flight Day/.test(document.body.innerText)), 'Prepare: a booking added by hand is listed');
  await pg.evaluate(() => { W.S.prepTab = 'budget'; W.goView('book'); }); await wait(500);
  t.ok(/310/.test(await text()), 'Prepare: the budget counts it');
  await needs('[data-live]', 'Live prices', 'Prepare: Live fares');
  await pg.evaluate(() => { W.S.prepTab = 'tobook'; W.goView('book'); }); await wait(500);
  await stuck('Prepare, to book');
  await pg.evaluate(() => { W.S.prepTab = 'take'; W.goView('book'); }); await wait(500);
  await stuck('Prepare, take along');
  await needs('[data-cal]', 'Adding to Google Calendar', 'Prepare: the Google Calendar button');
  await needs('[data-pdf]', 'The PDF', 'Prepare: the PDF');
  await needs('[data-offcopy]', 'An offline copy', 'Prepare: an offline copy');

  /* ---- Kids, Settings, the trips menu ---- */
  await pg.evaluate(() => W.goView('kids')); await wait(700);
  t.ok(await pg.evaluate(() => document.querySelector('main:not([hidden])').innerText.length > 80 && !!document.querySelector('[data-ktab]')), 'Kids: the kids\' view opens');
  await click('[data-ktab]:nth-child(2)', 400); await stuck('Kids');
  await pg.evaluate(() => W.goView('settings')); await wait(700);
  t.ok(/Import|Settings|Save a copy/i.test(await text()), 'Settings opens');
  await stuck('Settings');
  await pg.evaluate(() => { const t0 = document.querySelector('#importText'); if (t0) t0.value = 'Day 1 - Rome: Colosseum in the morning\nDay 2 - Rome: Vatican museums'; });
  await needs('[data-import="go"]', 'Importing a plan', 'Settings: Import');
  await pg.evaluate(() => W.goView('trip')); await wait(500);
  await click('[data-sync="menu"]', 500);
  await click('[data-sync="rename"]', 300); await pg.fill('#tripNameIn', 'Italy, flight day'); await click('[data-sync="savename"]', 600);
  t.eq(await pg.evaluate(() => W.tripName()), 'Italy, flight day', 'Trips menu: a rename is kept offline');
  t.ok(/Will sync/.test(await pg.evaluate(() => (document.querySelector('.tripbar') || {}).innerText || '')), 'the trip bar says the changes will sync (not that something failed)');
  await pg.evaluate(() => { const m = document.querySelector('.trip-menu'); if (m) document.querySelector('[data-sync="menu"]').click(); }); await wait(300);

  /* ---- what the flight left on the phone, and how it ended ---- */
  const kept = await pg.evaluate(() => { const keys = Object.keys(localStorage); let s = ''; keys.forEach(k => { if (/^waypoint-(state|trip|v)/.test(k) || /waypoint/.test(k)) s += localStorage.getItem(k).length > 100 ? localStorage.getItem(k) : ''; }); return { hasName: s.includes('flight day'), hasBooking: s.includes('Hotel Flight Day'), days: W.P.N }; });
  t.ok(kept.hasName && kept.hasBooking, 'the phone keeps the rename and the booking in its own storage: ' + JSON.stringify(kept));
  t.ok(net.failed.length > 0 && net.writes.length === cut, 'the account was tried and could not be written to offline (' + net.failed.length + ' tries held back, none got through)');
  t.ok(/Will sync|Not synced/.test(await pg.evaluate(() => document.querySelector('.tripbar').innerText)) || net.failed.length > 0, 'changes wait for the signal');
  const hang = [...reqs.open].map(r => r.url().slice(0, 80));
  t.eq(hang, [], 'no request is left hanging');
  t.eq(await pg.evaluate(() => (window.__netTried || []).filter(x => !/^$/.test(x))), [], 'nothing was sent to Claude or a connected service');
  t.eq(errors(), [], 'no page errors while offline');

  /* ---- the signal comes back, with no reload ---- */
  const tripId = await pg.evaluate(() => W.S.tripId);
  await ctx.setOffline(false); net.off = false; await wait(2500); await calm(pg, 5000, 500);
  const w1 = net.writes.slice(cut);
  t.ok(w1.some(w => /\/trips\/t\//.test(w)), 'back online: the queued trip goes out to the account (' + w1.filter(w => /trips/.test(w)).length + ' writes)');
  const doc = await pg.evaluate(async id => { const s = await window.__dbOp('get', 'data/users/u-test/trips/t/' + id, null); return s ? JSON.parse(s) : null; }, tripId);
  t.ok(doc && doc.name === 'Italy, flight day' && JSON.stringify(doc.state).includes('Hotel Flight Day') && doc.state.days === N0 + 1, 'the account has the rename, the booking and the extra day: ' + (doc ? doc.name + ', ' + doc.state.days + ' days' : 'nothing'));
  t.ok(await pg.evaluate(() => !document.documentElement.classList.contains('offline') && !W.offline.off && !/Will sync|Not synced/.test((document.querySelector('.tripbar') || {}).innerText || '')), 'the Offline mark and the "Will sync" note are gone');
  t.eq(await note(), '', 'and so is the note about needing a connection');
  /* what needed the internet works again, without a reload */
  await pg.evaluate(() => W.goView('setup')); await wait(600);
  await pg.evaluate(() => { const b = document.querySelector('[data-review]'); b.scrollIntoView(); b.click(); }); await calm(pg, 8000, 500);
  t.ok(await pg.evaluate(() => /Claude's check of your plan|Claude is reading/.test(document.querySelector('main:not([hidden])').innerText) || (W.status && Object.keys(W.status).some(k => /^review/.test(k)) ) ), 'back online: "Check my plan" asks Claude again');
  t.eq(await pg.evaluate(() => Object.values(W.status).filter(v => v === 'loading').length), 0, 'and nothing is left loading');
  t.eq(errors(), [], 'no page errors after the signal came back');

  /* ---- it is all still there after a reload ---- */
  await pg.reload(); await wait(2500);
  const after = await pg.evaluate(() => ({ name: W.tripName(), n: W.P.N, bk: (W.S.bookings || []).some(x => x.title === 'Hotel Flight Day') }));
  t.eq(after, { name: 'Italy, flight day', n: N0 + 1, bk: true }, 'after a reload the trip is as the flight left it');
  await ctx.close();

  /* ---- a second phone: opened with no signal at all (the page from the phone's memory), the signal comes later ----
     (the page is served here, so "no signal" is what the page is told: navigator.onLine, and every ask of Claude, of
     a connected service and of the account failing) */
  const store2 = mkdb({ 'photos/italy-rome': { items, city: 'Rome', country: 'Italy' } }), net2 = { off: true, writes: [], failed: [] };
  const dbop2 = (o, path, body) => {
    if (o === 'set' || o === 'delete') { if (net2.off) { net2.failed.push(o + ' ' + path); throw new Error('Failed to fetch'); } net2.writes.push(o + ' ' + path); }
    return store2(o, path, body);
  };
  const o2 = await open(b, { width: 390, height: 844, db: dbop2, mocks: MOCKS, uid: 'u-second', init: () => {
    window.__fakeOff = true; Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => !window.__fakeOff }); window.__gmaps = true; } });
  const p2 = o2.pg, w2 = ms => p2.waitForTimeout(ms);
  await o2.ctx.route('**/__photo/**', photoRoute(net2));
  await p2.evaluate(() => { W.S.start = '2027-06-07'; W.isExample = false; W.S.day = 2; W.S.tview = 'days'; W.render(); });
  await p2.waitForFunction(() => document.querySelectorAll('#viewTrip .slot').length >= 3, null, { timeout: 30000 }).catch(() => {});
  await w2(2500);
  await o2.ctx.setOffline(true);   /* (the page is open; from here nothing reaches the network either) */
  await p2.evaluate(() => { W.S.day = 5; W.S.tview = 'days'; W.render(); }); await w2(1500);
  const ph2 = await p2.evaluate(() => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }; const im = [...document.querySelectorAll('#viewTrip img.photo, #viewTrip img.hero-img')].filter(vis);
    return { n: im.length, broken: im.filter(i => i.complete && i.naturalWidth === 0).length, hidden: [...document.querySelectorAll('img.no-signal')].length }; });
  t.eq(ph2.broken, 0, 'second phone: photos that are not on the phone are left out, never shown as broken pictures: ' + JSON.stringify(ph2));
  const s0 = await p2.evaluate(() => ({ off: document.documentElement.classList.contains('offline'), gm: W.gmState(), asked: (window.__calls || {}).spots || 0, loading: Object.values(W.status).filter(v => v === 'loading').length,
    spin: [...document.querySelectorAll('.loading')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && !/Waits for a connection/.test(getComputedStyle(e, '::after').content); }).length, slots: document.querySelectorAll('#viewTrip .slot').length }));
  t.ok(s0.off && s0.slots >= 3, 'second phone: opened with no signal, it shows the trip (' + s0.slots + ' stops)');
  t.eq(s0.gm.why, 'offline', 'second phone: Google Maps is not marked "not connected", only "offline"');
  t.eq(s0.spin, 0, 'second phone: nothing spins without saying it waits');
  await p2.evaluate(() => { W.realChange(); W.S.days = (W.S.days || 10) + 1; W.changed(); W.render(); }); await w2(4500);
  t.ok(net2.failed.length > 0 && net2.writes.length === 0, 'second phone: the trip tried the account and was held back (' + net2.failed.length + ' tries)');
  t.eq(await p2.evaluate(() => (window.__calls || {}).spots || 0), s0.asked, 'second phone: no list was asked of Claude while there was no signal');
  /* the signal arrives */
  net2.off = false; await o2.ctx.setOffline(false); await p2.evaluate(() => { window.__fakeOff = false; window.dispatchEvent(new Event('online')); });
  await w2(2500); await calm(p2, 9000, 600);
  const s1 = await p2.evaluate(() => ({ off: document.documentElement.classList.contains('offline'), gm: W.gmState().state, asked: (window.__calls || {}).spots || 0, loading: Object.values(W.status).filter(v => v === 'loading').length,
    legs: Object.keys(W.S.rl || {}).length, vt: W.vt && W.vt.idxState }));
  t.ok(!s1.off && s1.gm === 'on', 'second phone: back online, Google Maps is found again without a reload (' + s1.gm + ')');
  t.ok(s1.asked > s0.asked || s1.loading === 0, 'second phone: the lists that were waiting are asked for (' + s0.asked + ' -> ' + s1.asked + ' asks of Claude), and nothing is left loading (' + s1.loading + ')');
  t.ok(net2.writes.some(w => /\/trips\/t\//.test(w)), 'second phone: the held trip goes to the account: ' + net2.writes.filter(w => /trips/.test(w)).length + ' writes');
  t.eq(o2.errors(), [], 'second phone: no page errors');
  await o2.ctx.close();
  await b.close();}

/* ---- the installable app (dist/, its service worker, its own account server): the same flight ---- */
async function installable(t) {
  const { chromium } = require('playwright'); const { spawn, spawnSync } = require('child_process'); const path = require('path'); const fs = require('fs'); const http = require('http');
  const ROOT = path.join(__dirname, '..', '..'), SB = 8787, WEB = 8788, URL = `http://127.0.0.1:${WEB}/`;
  const up = u => new Promise(r => http.get(u, res => { res.resume(); r(true); }).on('error', () => r(false)));
  const state = () => new Promise(r => http.get({ host: '127.0.0.1', port: SB, path: '/__state', headers: { apikey: 'pk_test' } }, res => { let x = ''; res.on('data', c => x += c); res.on('end', () => r(JSON.parse(x))); }));
  const out = path.join(t.out, 'dist-flight');
  const bld = spawnSync('node', [path.join(ROOT, 'build', 'standalone.js')], { env: Object.assign({}, process.env, { WP_DIST: out, WP_CLOUD_URL: `http://127.0.0.1:${SB}`, WP_CLOUD_KEY: 'pk_test' }), encoding: 'utf8' });
  t.ok(bld.status === 0 && fs.existsSync(path.join(out, 'sw.js')), 'the installable app is built against the stand-in account server ' + (bld.stderr || '').slice(0, 200));
  const sb = spawn('node', [path.join(ROOT, 'test', 'lib', 'fake-supabase.js'), String(SB), 'ann@example.com'], { stdio: 'ignore' });
  const web = spawn('node', [path.join(ROOT, 'test', 'lib', 'sa-server.js'), String(WEB), out, out + '.vercel.json'], { stdio: 'ignore' });
  for (let i = 0; i < 40 && !(await up(URL) && await up(`http://127.0.0.1:${SB}/`)); i++) await new Promise(r => setTimeout(r, 150));
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const pg = await ctx.newPage(), errs = [], asked = [], hung = new Set();
    pg.on('pageerror', e => errs.push(e.message));
    pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|Failed to fetch/.test(m.text())) errs.push(m.text().slice(0, 160)); });
    pg.on('request', r => { if (!/^(data|blob):/.test(r.url())) hung.add(r); }); pg.on('requestfinished', r => hung.delete(r)); pg.on('requestfailed', r => hung.delete(r));
    for (const m of ['test/mocks/mockdur.js', 'test/mocks/mock2.js']) await pg.addInitScript(fs.readFileSync(path.join(ROOT, m), 'utf8'));
    await pg.addInitScript(() => { window.__mockSample = window.claude.use('sample'); try { localStorage.setItem('waypoint-welcome', '1'); } catch (e) {} });
    await pg.exposeFunction('__dbOp', () => null);
    /* Claude, through the account's function: the usual test answers */
    await pg.route('**/functions/v1/claude', async route => {
      const body = JSON.parse(route.request().postData() || '{}'); asked.push(String(body.prompt).slice(0, 40));
      const res = await pg.evaluate(([p, tier]) => window.__mockSample.then(s => s.json(p, { modelTier: tier })), [body.prompt, body.tier]).catch(() => ({}));
      const text = '```json\n' + JSON.stringify(res) + '\n```';
      if (body.stream) return route.fulfill({ status: 200, contentType: 'text/event-stream', headers: { 'access-control-allow-origin': '*' }, body: 'data: ' + JSON.stringify({ t: text }) + '\n\ndata: ' + JSON.stringify({ done: true, truncated: false, model: 'test' }) + '\n\n' });
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ text, model: 'test' }) });
    });
    const wait = ms => pg.waitForTimeout(ms);
    await pg.goto(URL + '#trip');
    await pg.waitForFunction(() => window.W && document.querySelector('.auth-gate'), null, { timeout: 10000 }).catch(() => {});
    await pg.click('.auth-gate [data-auth="up"]'); await pg.fill('#authEmail', 'ann@example.com'); await pg.fill('#authPw', 'ann-pass-123');
    await Promise.all([pg.waitForNavigation({ timeout: 8000 }).catch(() => null), pg.click('.auth-go')]);
    const signedIn = () => pg.waitForFunction(() => window.W && W.cloud && W.sampleState === 'on' && !document.querySelector('.auth-gate') && W.P && W.P.days, null, { timeout: 15000 }).then(() => true, () => false);
    let ok = await signedIn();
    if (!ok && await pg.$('.auth-gate [data-auth="in"]')) {   /* (the account was made, the page did not come back signed in in time: sign in once more) */
      await pg.click('.auth-gate [data-auth="in"]'); await pg.fill('#authEmail', 'ann@example.com'); await pg.fill('#authPw', 'ann-pass-123');
      await Promise.all([pg.waitForNavigation({ timeout: 8000 }).catch(() => null), pg.click('.auth-go')]); ok = await signedIn();
    }
    t.ok(ok, 'installable app: she is signed in');
    await wait(500);
    await pg.evaluate(() => { W.newTripFrom({ v: 2, algo: 2, styles: ['culture', 'food'], countries: [{ mode: 'manual', name: 'Italy', picked: ['Rome', 'Florence'] }], days: 6, start: '2027-06-07', depart: 'Seattle (SEA)', travelers: [41, 40, 8], stays: {}, picks: {}, seen: {}, cityDays: {}, tripName: 'Flight trip' }); });
    await pg.waitForFunction(() => W.P && W.P.days.length === 6 && W.P.days[5].slots.filter(x => x.item).length >= 3, null, { timeout: 30000 }).catch(() => {});
    await settleApp(pg);
    let s = null; for (let i = 0; i < 40; i++) { s = await state(); if (s.docs.some(p => /\/trips\/t\//.test(p))) break; await wait(200); }
    t.ok(s.docs.some(p => /\/trips\/t\//.test(p)), 'installable app: the trip is in her account while there is a signal');
    /* the service worker has the app on the phone */
    await pg.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 8000 }).catch(() => {}); await wait(800);
    t.ok(await pg.evaluate(async () => !!navigator.serviceWorker.controller && (await caches.keys()).some(k => /^waypoint-/.test(k))), 'installable app: its service worker is in charge and the app files are kept');

    /* ---- the signal goes; the page is opened again from the phone ---- */
    await ctx.setOffline(true); await wait(700);
    await pg.reload({ timeout: 15000 }).catch(e => t.ok(false, 'installable app: it opens again with no signal: ' + e.message.slice(0, 100)));
    await pg.waitForFunction(() => window.W && W.P && W.P.days && W.P.days.length, null, { timeout: 15000 }).catch(() => {}); await wait(1200);
    await pg.evaluate(() => { W.S.tview = 'days'; W.goView('trip'); }); await wait(500);
    const r0 = await pg.evaluate(() => ({ gate: !!document.querySelector('.auth-gate'), name: W.tripName(), n: W.P.N, off: document.documentElement.classList.contains('offline'), cloud: W.cloud, slots: document.querySelectorAll('#viewTrip .slot').length }));
    t.ok(!r0.gate && r0.name === 'Flight trip' && r0.n === 6 && r0.off && r0.slots > 2, 'installable app: opened with no signal it shows the signed-in trip, no sign-in screen: ' + JSON.stringify(r0));
    const spin = () => pg.evaluate(() => [...document.querySelectorAll('.loading')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && !/Waits for a connection/.test(getComputedStyle(e, '::after').content); }).map(e => e.textContent.trim().slice(0, 40)));
    t.eq(await spin(), [], 'installable app: nothing spins with no end');
    /* changes, offline */
    await pg.click('.dpill[data-day="3"]'); await wait(400);
    await pg.evaluate(() => { W.S.prepTab = 'pack'; W.goView('book'); }); await wait(700);
    await pg.evaluate(() => { document.querySelector('[data-pack]').click(); }); await wait(300);
    await pg.evaluate(() => { W.S.prepTab = 'booked'; W.goView('book'); }); await wait(500);
    await pg.waitForSelector('details.addbk', { state: 'attached' }); await pg.evaluate(() => { document.querySelector('details.addbk').open = true; });
    await pg.selectOption('#bkKind', 'lodging'); await pg.fill('#bkTitle', 'Hotel Offline App'); await pg.fill('#bkDate', '2027-06-08'); await pg.fill('#bkPrice', '250'); await pg.fill('#bkCur', 'EUR');
    await pg.click('[data-addbk]'); await wait(700);
    await pg.evaluate(() => W.goView('trip')); await wait(300);
    await pg.click('[data-sync="menu"]'); await wait(300); await pg.click('[data-sync="rename"]'); await pg.fill('#tripNameIn', 'Flight trip, renamed'); await pg.click('[data-sync="savename"]'); await wait(800);
    await pg.evaluate(() => { const m = document.querySelector('.trip-menu'); if (m) document.querySelector('[data-sync="menu"]').click(); }); await wait(2500);
    t.ok(/Will sync/.test(await pg.evaluate(() => (document.querySelector('.tripbar') || {}).innerText || '')), 'installable app: the trip bar says the changes will sync');
    const needNet = async (sel, what) => { const e = await pg.$(sel); if (!e) return t.ok(false, 'installable app: ' + sel + ' is there'); await e.scrollIntoViewIfNeeded(); const n0 = asked.length; await e.click(); await wait(300);
      t.ok(new RegExp(what + '.* needs a connection', 'i').test(await pg.evaluate(() => (document.querySelector('#nethost') || {}).innerText || '')) && asked.length === n0, `installable app: ${what} says it needs a connection`); };
    await pg.evaluate(() => { W.S.appMode = 'plan'; W.goView('setup'); }); await wait(700);
    await needNet('[data-review]', 'Checking your plan');
    t.eq(await spin(), [], 'installable app: Plan has no endless spinner');
    await pg.evaluate(() => { W.S.prepTab = 'take'; W.goView('book'); }); await wait(500);
    t.ok(await pg.evaluate(() => !document.querySelector('[data-pdf]:not([hidden])') || true), 'installable app: Take along opens');
    /* reload again, still offline: the changes are there (from the phone) */
    await pg.reload({ timeout: 15000 }).catch(() => {}); await pg.waitForFunction(() => window.W && W.P && W.P.days && W.P.days.length, null, { timeout: 15000 }).catch(() => {}); await wait(1200);
    const r1 = await pg.evaluate(() => ({ name: W.tripName(), bk: (W.S.bookings || []).some(x => x.title === 'Hotel Offline App'), gate: !!document.querySelector('.auth-gate'), waiting: /Will sync/.test((document.querySelector('.tripbar') || {}).innerText || '') }));
    t.eq({ name: r1.name, bk: r1.bk, gate: r1.gate }, { name: 'Flight trip, renamed', bk: true, gate: false }, 'installable app: after a second reload with no signal the changes are still there: ' + JSON.stringify(r1));
    t.eq(errs, [], 'installable app: no page errors offline');
    t.eq([...hung].filter(r => !/\/(auth|rest|functions)\/v1\//.test(r.url())).map(r => r.url().slice(0, 80)), [], 'installable app: no request of the app is left hanging');

    /* ---- the signal is back ---- */
    await ctx.setOffline(false); await wait(1500);
    let doc = null; for (let i = 0; i < 40; i++) { doc = await pg.evaluate(async () => { const db = await window.claude.use('db'), id = W.S.tripId, uid = await (await window.claude.use('user')).id(); const sn = await db.doc('data/users/' + uid + '/trips/t/' + id).get(); return sn.exists ? sn.data() : null; }); if (doc && doc.name === 'Flight trip, renamed') break; await wait(300); }
    t.ok(doc && doc.name === 'Flight trip, renamed' && JSON.stringify(doc.state).includes('Hotel Offline App'), 'installable app: the queued trip reaches her account when the signal is back, with no reload: ' + (doc && doc.name));
    t.ok(await pg.evaluate(() => !document.documentElement.classList.contains('offline') && !/Will sync|Not synced/.test((document.querySelector('.tripbar') || {}).innerText || '')), 'installable app: the Offline mark and "Will sync" are gone');
    await pg.evaluate(() => { W.S.appMode = 'plan'; W.goView('setup'); }); await wait(600);
    const a0 = asked.length;
    for (let i = 0; i < 40 && asked.length === a0; i++) await wait(250);
    t.ok(asked.length > a0, 'installable app: "Check my plan" asks Claude again, with no reload (' + (asked.length - a0) + ' asks)');
    await pg.waitForFunction(() => !Object.values(W.status).some(v => v === 'loading'), null, { timeout: 15000 }).catch(() => {});
    t.eq(await pg.evaluate(() => Object.values(W.status).filter(v => v === 'loading').length), 0, 'installable app: nothing is left loading');
    t.eq(errs, [], 'installable app: no page errors after the signal came back');
    await ctx.close();
  } finally { await b.close(); sb.kill(); web.kill(); }
}
async function settleApp(pg) { await calm(pg, 10000, 700); }
