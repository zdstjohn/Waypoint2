/* Simple view: a switch in the trip menu and in Settings (this phone only) that takes away every place photo and the
   street map, and the lines that aren't needed to follow the day (descriptions, the greeting, the kids' banner), while
   the times, places, walks, directions, what to book and warnings stay. It holds after a reload, and off brings it all back. */
const { launch, open, exampleTrip, settle, calm } = require('../lib/page'); const mkdb = require('../lib/db');
const px = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#a0522d"/></svg>');
exports.run = async t => {
  /* real-looking photos for every Rome sight, so there is something to take away */
  const items = {}; for (const l of [1, 2]) for (let i = 0; i < 14; i++) items[`rome sight ${l} ${i}`] = { url: px, credit: 'Test, CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:X.jpg' };
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb({ 'photos/italy-rome': { items, city: 'Rome', country: 'Italy' } }) });
  await exampleTrip(pg); await settle(pg, 6000);
  const look = () => pg.evaluate(() => {
    const vis = s => [...document.querySelectorAll(s)].filter(e => e.checkVisibility ? e.checkVisibility() : e.getClientRects().length).length;
    return { simple: document.documentElement.classList.contains('simple'), photos: document.querySelectorAll('main:not([hidden]) img.photo').length, map: !!document.querySelector('main:not([hidden]) .vt-slot'),
      desc: vis('main:not([hidden]) .slot .desc, main:not([hidden]) .idea .desc'), stops: document.querySelectorAll('main:not([hidden]) .slot').length,
      walks: /min/.test((document.querySelector('main:not([hidden])') || {}).textContent || ''), greet: vis('#topline .tl-hi') };
  });
  await pg.evaluate(() => { W.S.tview = 'days'; W.S.day = 2; W.goView('trip'); }); await pg.waitForTimeout(800);
  const d0 = await look();
  t.ok(!d0.simple && d0.photos > 0 && d0.desc > 0, 'normally the day has photos and descriptions: ' + JSON.stringify(d0));
  /* on, from the trip menu */
  await pg.click('[data-sync="menu"]'); await pg.waitForTimeout(400);
  t.ok(await pg.evaluate(() => { const s = document.querySelector('.trip-menu [data-simple]'); return !!s && s.getAttribute('role') === 'switch' && s.getAttribute('aria-checked') === 'false'; }), 'the trip menu has a Simple view switch');
  await pg.click('.trip-menu [data-simple]'); await pg.waitForTimeout(500);
  const d1 = await look();
  t.ok(d1.simple && d1.photos === 0 && d1.desc === 0 && d1.greet === 0, 'Simple view: no photos, descriptions or greeting on the day: ' + JSON.stringify(d1));
  t.ok(d1.stops === d0.stops && d1.walks, 'and every stop with its walk is still there');
  await pg.evaluate(() => { W.S.tview = 'map'; W.render(); }); await pg.waitForTimeout(800);
  const e1 = await look();
  t.ok(e1.photos === 0 && !e1.map && e1.desc === 0, 'Explore: no photos and no street map: ' + JSON.stringify(e1));
  const rt1 = await pg.evaluate(async () => { W.goView('go'); await new Promise(r => setTimeout(r, 500)); const v = document.querySelector('#viewGo'), o = { stops: v.querySelectorAll('.go-rt .rc-stop').length, dir: /Directions/.test(v.textContent), photos: v.querySelectorAll('img.photo').length }; W.goView('trip'); await new Promise(r => setTimeout(r, 300)); return o; });
  t.ok(rt1.stops > 2 && rt1.dir, 'Today keeps the route with its directions: ' + JSON.stringify(rt1));
  await pg.evaluate(() => W.goView('go')); await pg.waitForTimeout(800);
  const g1 = await look();
  t.ok(g1.photos === 0 && !(await pg.evaluate(() => { const k = document.querySelector('.kids-chip'); return k && k.checkVisibility(); })), 'Today: no photos and no kids\' banner: ' + JSON.stringify(g1));
  /* a stop's panel: no photo, the actions stay */
  await pg.evaluate(() => { W.goView('trip'); W.S.tview = 'days'; W.render(); const x = W.P.days[1].slots.find(y => y.item && !W.isFood(y.slot)); W.openStop(x.key); }); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(() => !document.querySelector('#sheethost img.photo') && !!document.querySelector('#sheethost [data-sheetact="swap"]')), 'a stop\'s panel has no photo and keeps its actions');
  await pg.evaluate(() => W.closeStop());
  /* this phone keeps it */
  t.eq(await pg.evaluate(() => localStorage.getItem('waypoint-simple')), '1', 'kept on this phone');
  await pg.reload(); await calm(pg, 5000);
  await pg.evaluate(() => { W.S.tview = 'days'; W.S.day = 2; W.goView('trip'); }); await pg.waitForTimeout(800);
  const r1 = await look();
  t.ok(r1.simple && r1.photos === 0, 'and still on after a reload: ' + JSON.stringify(r1));
  /* off, from Settings */
  await pg.evaluate(() => { W.needLater(); W.goView('settings'); }); await pg.waitForFunction(() => !!document.querySelector('#set-simple [data-simple]'), null, { timeout: 15000 }).catch(() => {});
  t.ok(await pg.evaluate(() => document.querySelector('#set-simple [data-simple]').getAttribute('aria-checked') === 'true'), 'Settings has the switch too, on');
  await pg.click('#set-simple [data-simple]'); await pg.waitForTimeout(400);
  await pg.evaluate(() => { W.S.tview = 'days'; W.goView('trip'); }); await pg.waitForTimeout(800);
  const o1 = await look();
  t.ok(!o1.simple && o1.photos > 0 && o1.desc > 0, 'off brings the photos and descriptions back: ' + JSON.stringify(o1));
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
