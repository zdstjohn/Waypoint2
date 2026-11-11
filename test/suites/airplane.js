/* Airplane mode: the offline copy, opened as a file with the network off, has to carry a whole day of the trip by
   itself. It must show the trip that is inside it even when the phone gives a downloaded file no storage (it used to
   open on the example trip), start cleanly on any screen, ask the network for nothing, offer nothing that needs the
   live app, keep one copy's trip apart from another's, and keep what you change in it when the phone allows. */
const { launch, open, exampleTrip, settle, calm, started } = require('../lib/page'); const mkdb = require('../lib/db'); const fs = require('fs'); const path = require('path');
exports.run = async t => {
  const b = await launch(); const { pg } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg); await settle(pg, 8000);
  const make = () => pg.evaluate(async () => {
    const O = W.offline; let out = ''; const dl = await window.claude.use('downloads'), real = dl.save;
    dl.save = async ({ data }) => { out = await data.text(); return { status: 'saved' }; };
    O.copyState = 'idle'; await O.exportCopy(W.P); dl.save = real; return out;
  });
  await pg.evaluate(() => { const d = W.P.days[1]; W.S.stays = W.S.stays || {}; W.S.stays[W.cityKey(d.country, d.city)] = { label: 'Hotel Test, Via Roma 1', lat: 41.9, lng: 12.49 }; W.save(); W.render(); });
  await pg.waitForTimeout(500);
  const fileA = path.join(t.out, 'air-a.html'); fs.writeFileSync(fileA, await make());
  /* a second copy, of a different trip, saved to the same folder */
  await pg.evaluate(() => { W.newTripFrom({ v: 2, algo: 2, styles: ['culture'], countries: [{ mode: 'manual', name: 'Italy', picked: ['Florence'] }], days: 3, start: '2027-09-01', depart: 'Los Angeles (LAX)', travelers: [38, 36], stays: {}, picks: {}, seen: {}, cityDays: {}, tripName: 'Second trip' }); });
  await calm(pg, 7500);
  const fileB = path.join(t.out, 'air-b.html'); fs.writeFileSync(fileB, await make());

  const walk = async (label, nostore) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); await ctx.setOffline(true);
    const fp = await ctx.newPage(); const errs = [], reqs = [];
    fp.on('pageerror', e => errs.push(e.message)); fp.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
    fp.on('request', r => { const u = r.url(); if (!/^(data|blob|file):/.test(u)) reqs.push(u.slice(0, 90)); });
    await fp.addInitScript(ns => {
      if (ns) { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } }); Object.defineProperty(window, 'indexedDB', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } }); }
    }, nostore);
    await fp.goto('file://' + fileA); await started(fp);
    const first = await fp.evaluate(() => ({ copy: W.offline.copy, name: W.tripName(), N: W.P.N, example: !!W.isExample, start: W.S.start, stay: Object.values(W.S.stays || {}).map(s => s.label)[0] || '', kept: window.__WP_COPY_KEPT,
      full: /storage full/i.test(document.body.innerText), planTab: (() => { const p = document.getElementById('tabSetup'); return !!p && p.getBoundingClientRect().width > 0; })() }));
    t.ok(first.copy && first.N === 10 && !first.example && first.start && /Hotel Test/.test(first.stay), `${label}: the copy opens on the trip inside it, with its dates and lodging (${first.name}, ${first.N} days, from ${first.start})`);
    t.ok(!first.full && !first.planTab, `${label}: no "storage full" warning, and no Plan tab (planning needs the live app)`);
    t.eq(first.kept, !nostore, `${label}: it knows whether this phone keeps changes`);
    /* every screen, every day */
    const seen = await fp.evaluate(async () => {
      const out = {}, m = () => document.querySelector('main:not([hidden])'), wait = ms => new Promise(r => setTimeout(r, ms));
      const live = () => [...m().querySelectorAll('#placeQ, [data-psearch], [data-cal], [data-pdf], [data-live], [data-offcopy], [data-review], [data-replan], [data-gostay]')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.id || Object.keys(e.dataset).join(','));
      const bad = [], dead = [];
      W.S.tview = 'days'; W.S.glanceOpen = false; W.goView('trip'); await wait(300);
      for (let n = 1; n <= W.P.N; n++) { W.S.day = n; W.render(); if (!m().querySelector('.slot')) bad.push(n); }
      dead.push(...live());
      W.S.glanceOpen = true; W.render(); await wait(200); out.all = m().querySelectorAll('.g-day').length; dead.push(...live());
      W.S.glanceOpen = false; W.S.tview = 'map'; W.S.day = 2; W.render(); await wait(400); out.explore = m().querySelectorAll('.idea').length; out.searchNote = /needs the live app/.test((m().querySelector('.psearch') || {}).textContent || ''); dead.push(...live());
      W.S.tview = 'days';
      for (const tab of ['tobook', 'booked', 'budget', 'pack', 'take']) { W.S.prepTab = tab; W.goView('book'); await wait(tab === 'pack' ? 700 : 250); out[tab] = m().innerText.length > 80; dead.push(...live()); }
      out.take = /open Waypoint when you're online/.test(m().innerText);
      W.goView('setup'); await wait(300); out.setup = W.view(); W.goView('settings'); await wait(300); out.settings = W.view();
      document.querySelector('[data-sync="menu"]').click(); await wait(400);
      out.menu = [...document.querySelectorAll('[data-sync]')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.dataset.sync); document.querySelector('[data-sync="menu"]').click();
      out.bad = bad; out.dead = dead; return out;
    });
    t.eq(seen.bad, [], `${label}: every day draws`);
    t.ok(seen.all === 10 && seen.explore > 3 && seen.tobook && seen.booked && seen.budget && seen.pack, `${label}: All days, Explore (${seen.explore} ideas) and every Prepare tab are there`);
    t.eq(seen.dead, [], `${label}: nothing is offered that needs the network (search, calendar, PDF, live prices, a new copy, Claude)`);
    t.ok(seen.searchNote && seen.take, `${label}: Explore and Take along say plainly what needs the live app`);
    t.ok(seen.setup === 'trip' && seen.settings === 'trip' && !seen.menu.some(x => /^(new|del|settings|openshare)$/.test(x)), `${label}: Plan, Settings, New trip and shared trips are out of reach: ` + seen.menu.join(','));
    /* a day on the road: Today, a plan B, a stop's panel, a packed item, a note */
    const day = await fp.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
      W.S.day = 3; W.goView('go'); await wait(500); out.today = W.view() === 'go' && !!document.querySelector('#viewGo .go-tl, #viewGo .go-now, #viewGo .go');
      out.note = (document.querySelector('#viewGo .go-off.copy') || {}).innerText || '';
      W.S.tview = 'days'; W.S.glanceOpen = false; W.S.day = 3; W.goView('trip'); await wait(300);
      const d = W.P.days[2], x = d.slots.find(y => y.item && !W.isFood(y.slot)), was = x.item.n; W.reroll(d, x.slot, W.P); W.render(); out.swapped = W.P.days[2].slots.find(y => y.slot === x.slot).item.n !== was;
      W.openStop(W.P.days[2].slots.find(y => y.item).key); await wait(500); out.panel = ((document.querySelector('#sheethost') || {}).innerText || '').length > 60; W.closeStop && W.closeStop();
      W.S.prepTab = 'pack'; W.goView('book'); await wait(800); const pk = document.querySelector('#viewBook [data-pack]'); if (pk) { pk.click(); await wait(300); }
      out.packed = document.querySelectorAll('#viewBook [data-pack][aria-checked="true"], #viewBook [data-pack].on, #viewBook .chk.on').length; out.packKey = pk ? pk.dataset.pack : '';
      W.S.journal = W.S.journal || {}; W.S.journal[W.restKey(d)] = { note: 'Gelato by the river' }; W.save();
      await wait(700); return out;
    });
    t.ok(day.today && /need no connection/.test(day.note), `${label}: Today opens and says what this copy can do`);
    t.ok(nostore ? /lasts until you close it/.test(day.note) : /stays in this copy/.test(day.note), `${label}: and says honestly whether changes are kept`);
    t.ok(day.swapped && day.panel && day.packKey, `${label}: a swap from the saved ideas, a stop's panel and the packing list all work`);
    /* close and reopen, on Prepare (this used to stop the page's start-up) */
    await fp.reload(); await started(fp);
    const again = await fp.evaluate(() => ({ view: W.view(), N: W.P.N, note: Object.values(W.S.journal || {}).map(j => j.note).filter(Boolean)[0] || '', book: !!document.querySelector('#viewBook .prep-seg'), clicks: (() => { const tb = document.querySelector('nav [data-view="trip"]'); tb.click(); return W.view(); })() }));
    t.ok(again.view === 'book' && again.book && again.N === 10 && again.clicks === 'trip', `${label}: reopened on Prepare, it draws and the tabs still work`);
    t.eq(again.note, nostore ? '' : 'Gelato by the river', nostore ? `${label}: with no storage the note is gone after closing, as the copy said` : `${label}: what you changed is still there after closing and reopening`);
    /* the other copy, opened on the same phone, shows its own trip; and the first is still the first */
    await fp.goto('file://' + fileB); await started(fp);
    const other = await fp.evaluate(() => ({ name: W.tripName(), N: W.P.N, cities: W.P.stops.map(s => s.name).join(','), trips: Object.keys(JSON.parse(localStorage.getItem('waypoint-trips-v1') || localStorage.getItem('waypoint-trips') || '{}')).length }));
    t.ok(other.name === 'Second trip' && other.N === 3 && other.cities === 'Florence', `${label}: a second copy shows its own trip, not the first one's: ` + JSON.stringify(other));
    await fp.goto('file://' + fileA); await started(fp);
    t.ok(await fp.evaluate(() => W.P.N === 10 && W.tripName() !== 'Second trip'), `${label}: and the first copy is still the first trip`);
    t.eq(reqs, [], `${label}: nothing was asked of the network`);
    t.eq(errs, [], `${label}: no errors`);
    await ctx.close();
  };
  await walk('offline copy', false);
  await walk('offline copy, phone keeps nothing', true);
  await b.close();
};
