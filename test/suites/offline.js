/* Offline: saving keeps the trip's photos and its photo index on the phone; with the network gone the app says so in
   Travel mode and shows the same photos from the phone; the saved index fills in on the next open before (or without)
   the database; the offline copy is one file that opens with no server at all and shows the trip. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db'); const fs = require('fs'); const path = require('path');
const px = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const ph = id => ({ url: px + '#' + id, credit: 'Test, CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:' + id });
exports.run = async t => {
  /* the mock's Rome ideas are "Rome <style> pick <n>": a photo for each, plus one real name */
  const items = { 'colosseum': ph('colosseum') };
  ['culture', 'food', 'relax', 'beach', 'nature', 'family', 'nightlife', 'adventure', 'shopping', 'history', 'art', 'outdoors', 'kids', 'local', 'markets'].forEach(k => { for (let i = 0; i < 16; i++) items['rome ' + k + ' pick ' + i] = ph(k + i); });
  const seed = { 'photos/italy-rome': { items, city: 'Rome', country: 'Italy' } };
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, db: mkdb(seed) }); await exampleTrip(pg);
  await pg.waitForFunction(() => !!W.photoFor({ n: 'Colosseum' }, false, 'Italy', 'Rome'), null, { timeout: 8000 }).catch(() => {});

  /* save, once every list has arrived (a save made while lists are still coming would miss the items they bring) */
  await settle(pg, 8000);
  /* and once the plan shows photos (a slow machine gets the city's lists later); an automatic save already running is let finish */
  await pg.waitForFunction(() => { const P = W.plan(); return W.offline.state !== 'saving' && P.days.some(d => d.slots.some(x => x.item && W.photoFor(x.item, W.isFood(x.slot), d.country, d.city))); }, null, { timeout: 20000 }).catch(() => {});
  const s = await pg.evaluate(async () => { await W.offline.save(W.P, 'test'); const O = W.offline; return { state: O.state, n: O.n, total: O.total, at: O.at > 0, rec: JSON.parse(localStorage.getItem('waypoint-offline-v1') || 'null') }; });
  t.eq(s.state, 'done', 'saving finishes');
  t.ok(s.n > 0 && s.n === s.total, `every photo the trip shows is saved (${s.n})`);
  t.ok(s.rec && s.rec.n === s.n, 'the save is recorded for next time');
  const before = await pg.evaluate(() => { W.S.appMode = 'travel'; W.S.appModeAt = W.isoDay(W.now()); W.S.day = 2; W.render(); return W.offline.block(W.P).includes('Ready for offline'); });
  t.ok(before, 'Travel mode says the trip is ready for offline');

  /* the signal goes */
  await ctx.setOffline(true); await pg.waitForTimeout(600);
  const off = await pg.evaluate(() => {
    W.setView('go'); W.render();
    const go = document.querySelector('#viewGo'); const srcs = [...document.querySelectorAll('#viewTrip img.photo, #viewGo img.photo')].map(i => i.getAttribute('src'));
    return { cls: document.documentElement.classList.contains('offline'), banner: !!(go && go.querySelector('.go-off.is-off')), text: go && go.querySelector('.go-off') ? go.querySelector('.go-off').textContent : '', blob: srcs.length ? srcs.every(s => /^blob:/.test(s)) : null, n: srcs.length, pill: getComputedStyle(document.querySelector('.brand'), '::after').content };
  });
  t.ok(off.cls, 'the page knows it is offline');
  t.ok(off.banner && /offline/i.test(off.text), 'Travel mode leads with the offline note');
  t.ok(off.blob === true || off.n === 0, `photos come from the phone (${off.n} shown, from blobs: ${off.blob})`);
  t.ok(/Offline/.test(off.pill), 'the header shows an Offline pill');
  const stuck = await pg.evaluate(() => { W.loadCity('Italy', 'Florence'); return Object.values(W.status).filter(v => v === 'loading').length; });
  await pg.waitForTimeout(400);
  const errs = await pg.evaluate(() => Object.values(W.status).filter(v => v && v !== 'loading').length);
  t.eq(errs, 0, 'nothing is asked of Claude while offline, so nothing fails');
  await ctx.setOffline(false); await pg.waitForTimeout(400);
  t.ok(await pg.evaluate(() => !document.documentElement.classList.contains('offline')), 'back online, the pill goes');

  /* next open (same phone), before the database answers: the saved index fills photos in */
  const pg2 = await ctx.newPage(); await pg2.addInitScript(() => { window.__noDb = true; });
  await pg2.goto('http://127.0.0.1:8771/index.html#trip'); await pg2.waitForTimeout(1500);
  const seeded = await pg2.evaluate(() => { const p = W.photoFor({ n: 'Colosseum' }, false, 'Italy', 'Rome'); return p && p.url; });
  t.ok(/colosseum/.test(seeded || ''), 'the photo index saved on the phone fills in without the database');
  await pg2.close();

  /* the offline copy */
  const copy = await pg.evaluate(async () => { await W.offline.exportCopy(W.P); return { state: W.offline.copyState, dl: window.__dl, err: W.offline.copyErr }; });
  t.eq(copy.state, 'done', `the offline copy is made (${copy.err || ''})`);
  t.ok(copy.dl && /offline copy\)\.html$/.test(copy.dl.filename) && copy.dl.size > 300000, `one HTML file is saved (${copy.dl && copy.dl.filename}, ${copy.dl && Math.round(copy.dl.size / 1024)} KB)`);
  /* build the same file here and open it from disk: no server, no runtime */
  const html = await pg.evaluate(async () => {
    const O = W.offline; const dlReal = (await window.claude.use('downloads')).save; let out = '';
    (await window.claude.use('downloads')).save = async ({ data }) => { out = await data.text(); return { status: 'saved' }; };
    O.copyState = 'idle'; await O.exportCopy(W.P); (await window.claude.use('downloads')).save = dlReal; return out;
  });
  const file = path.join(t.out, 'offline-copy.html'); fs.writeFileSync(file, html);
  const c2 = await b.newContext({ viewport: { width: 390, height: 800 } }); const fp = await c2.newPage(); const ferr = []; fp.on('pageerror', e => ferr.push(e.message));
  await fp.goto('file://' + file); await fp.waitForTimeout(2500);
  const fc = await fp.evaluate(() => ({ copy: W.offline.copy, slots: W.P.days.reduce((a, d) => a + (d.slots || []).length, 0), shown: document.querySelectorAll('main:not([hidden]) .slot, main:not([hidden]) .go-tl li').length, photos: [...document.querySelectorAll('img.photo')].map(i => i.getAttribute('src').slice(0, 5)), inFile: Object.keys((window.__WP_OFFLINE || {}).blobs || {}).length, city: W.P.stops[0] && W.P.stops[0].name, block: (W.S.appMode = 'travel', W.S.appModeAt = W.isoDay(W.now()), W.render(), W.offline.block(W.P)), fonts: [...document.fonts].some(f => f.status === 'loaded') }));
  t.ok(fc.copy && fc.slots > 4 && fc.shown > 0 && fc.city === 'Rome', `the copy opens from disk with the trip in it (${fc.slots} slots, ${fc.shown} on screen, ${fc.city})`);
  t.ok(fc.inFile > 0 && fc.photos.every(s => s === 'data:'), `its photos are inside the file (${fc.inFile} in the file, ${fc.photos.length} on screen, all from the file)`);
  t.ok(/Offline copy/.test(fc.block), 'and it says it is the offline copy');
  t.eq(ferr.filter(e => !/forEach/.test(e)), [], 'no errors in the copy');
  await c2.close();

  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
