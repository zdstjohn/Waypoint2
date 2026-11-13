/* A step ahead (lib/ahead.js): once the screen has settled the phone fetches the next and the previous day's header photo
   and first stop photos (so a swipe shows them at once), but never on Simple view or a saving/slow connection; and the
   evening before a day that moves to a new town it asks for that town's street map: once a day, never on mobile data. */
const { launch, open, exampleTrip, settle, until } = require('../lib/page'); const mkdb = require('../lib/db');
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
/* every place on the trip gets a photo at /_blob/<name>.gif (the plan's own names, once it is drawn) */
async function seedPhotos(pg) {
  const sets = await pg.evaluate(() => { const out = {};
    W.plan().days.forEach(d => { const k = 'photos/' + W.slug(d.country) + '-' + W.slug(d.city), o = out[k] || (out[k] = { items: {}, city: d.city, country: d.country });
      const ph = f => ({ url: '/_blob/' + f + '.gif', credit: 'Test, CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:' + f + '.gif' });
      o.items[W.norm(d.city)] = ph(W.slug(d.city) + '-city');
      d.slots.forEach(x => { if (x.item) o.items[W.norm(x.item.n)] = ph(W.slug(d.city) + '-' + W.slug(x.item.n)); }); });
    return out; });
  for (const k of Object.keys(sets)) await pg.evaluate(([k, v]) => window.__dbOp('set', k, JSON.stringify(v)), [k, sets[k]]);
  await pg.waitForFunction(() => W.plan().days.every(d => !d.slots.some(x => x.item && !W.photoFor(x.item, W.isFood(x.slot), d.country, d.city) && false)) && !!W.cityPhoto(W.P.days[1].country, W.P.days[1].city, []), null, { timeout: 10000 }).catch(() => {});
}
exports.run = async t => {
  const b = await launch();
  const mk = async (init) => { const o = await open(b, { width: 390, db: mkdb({}), init }); const seen = [];
    await o.pg.route('**/_blob/**', r => { seen.push(new URL(r.request().url()).pathname); r.fulfill({ status: 200, contentType: 'image/gif', body: GIF }); });
    o.seen = seen; return o; };
  /* ---- photos ---- */
  const A = await mk(null); await exampleTrip(A.pg); await seedPhotos(A.pg); await settle(A.pg, 3000);
  const plan = await A.pg.evaluate(() => { W.S.day = 2; W.render(); const P = W.P, pics = d => { const day = P.days[d - 1], hero = W.cityPhoto(day.country, day.city, []), out = [];
      day.slots.forEach(x => { if (x.item && out.length < 3) { const p = W.photoFor(x.item, W.isFood(x.slot), day.country, day.city); if (p) out.push(p.url); } }); return { hero: hero && hero.url, pics: out, city: day.city }; };
    return { cur: pics(2), next: pics(3), prev: pics(1), far: pics(Math.min(P.N, 7)) }; });
  A.seen.length = 0;
  await A.pg.evaluate(() => { W.S.day = 3; W.render(); W.S.day = 2; W.render(); });   /* (a fresh plan for day 2) */
  await until(() => A.pg.evaluate(() => 1).then(() => plan.next.pics.filter(u => !plan.cur.pics.includes(u)).every(u => A.seen.includes(u))), 14000, 300);
  const nextOnly = plan.next.pics.filter(u => !plan.cur.pics.includes(u));
  t.ok(nextOnly.length > 0, 'the example has stop photos on the next day that today does not show: ' + nextOnly.length);
  t.ok(nextOnly.every(u => A.seen.includes(u)), 'the next day\'s first stop photos are fetched while idle: ' + JSON.stringify(A.seen.slice(0, 8)));
  const prevOnly = plan.prev.pics.filter(u => !plan.cur.pics.includes(u) && !plan.next.pics.includes(u));
  t.ok(!prevOnly.length || prevOnly.every(u => A.seen.includes(u)), 'and the previous day\'s');
  const farOnly = plan.far.pics.filter(u => ![].concat(plan.cur.pics, plan.next.pics, plan.prev.pics).includes(u));
  t.ok(farOnly.every(u => !A.seen.includes(u)), 'but not a day further away');
  /* a swipe: the fetch for the old day stops, the new day's neighbours start */
  A.seen.length = 0;
  await A.pg.evaluate(() => { W.S.day = 5; W.render(); });
  await A.pg.waitForTimeout(3000);
  const d4 = await A.pg.evaluate(() => { const day = W.P.days[3], out = []; day.slots.forEach(x => { if (x.item && out.length < 3) { const p = W.photoFor(x.item, W.isFood(x.slot), day.country, day.city); if (p) out.push(p.url); } }); return out; });
  t.ok(d4.length === 0 || d4.some(u => A.seen.includes(u)), 'after a swipe to day 5 the neighbours of day 5 are fetched');
  /* a photo with WebP copies: what is fetched ahead is the WebP the screen will show, not the JPEG it never shows */
  const wq = await A.pg.evaluate(() => { const ph = { url: '/_blob/a.jpg', sm: '/_blob/a-sm.jpg', smw: 320, w: 720, webp: { url: '/_blob/a.webp', sm: '/_blob/a-sm.webp' }, credit: 'Test', page: 'https://commons.wikimedia.org/wiki/File:A.jpg' };
    const hero = W.aheadReqOf(W.heroImg(ph, '')), plain = W.aheadReqOf('<img src="/_blob/b.jpg">');
    return { hero, plain }; });
  t.ok(wq.hero && /a(-sm)?\.webp/.test(wq.hero.srcset || ''), 'a header photo with a WebP copy is fetched ahead as WebP: ' + JSON.stringify(wq.hero));
  t.ok(wq.plain && wq.plain.src === '/_blob/b.jpg' && !wq.plain.srcset, 'one without stays the JPEG');
  /* Simple view: nothing */
  A.seen.length = 0;
  await A.pg.evaluate(() => { W.setSimple(true); W.S.day = 8 > W.P.N ? 1 : 8; W.render(); });
  await A.pg.waitForTimeout(2500);
  t.eq(A.seen, [], 'in Simple view nothing is fetched ahead');
  t.eq(A.errors(), [], 'no page errors');
  await A.ctx.close();
  /* a connection that saves data: nothing */
  const S = await mk(() => { Object.defineProperty(navigator, 'connection', { get: () => ({ saveData: true, effectiveType: '4g' }), configurable: true }); });
  await exampleTrip(S.pg); await seedPhotos(S.pg); await settle(S.pg, 3000);
  S.seen.length = 0;
  await S.pg.evaluate(() => { W.S.day = 3; W.render(); }); await S.pg.waitForTimeout(3000);
  const nextFiles = await S.pg.evaluate(() => { const o = []; [2, 4].forEach(n => { const d = W.P.days[n - 1]; d.slots.forEach(x => { if (x.item) { const p = W.photoFor(x.item, W.isFood(x.slot), d.country, d.city); if (p) o.push(p.url); } }); }); return o; });
  const cur3 = await S.pg.evaluate(() => [...document.querySelectorAll('#viewTrip img')].map(i => new URL(i.currentSrc || i.src, location.href).pathname));
  t.ok(S.seen.filter(u => nextFiles.includes(u) && !cur3.includes(u)).length === 0, 'with Data Saver on nothing is fetched ahead');
  await S.ctx.close();

  /* ---- tomorrow's map ---- */
  const M = await mk(() => { Object.defineProperty(navigator, 'connection', { get: () => window.__conn || { saveData: false, effectiveType: '4g' }, configurable: true }); });
  await exampleTrip(M.pg);
  await M.pg.evaluate(() => { W.offline.save = () => Promise.resolve(); W.offline.tick = () => {}; });   /* (the phone's own saving also asks for packs) */
  const mv = await M.pg.evaluate(() => { const P = W.plan(), i = P.days.findIndex(d => d.moveFrom); return { n: i + 1, start: W.S.start }; });
  t.ok(mv.n >= 2, 'the example trip has a day that moves to a new town: day ' + mv.n);
  const setClock = (hh) => M.pg.evaluate(([n, hh]) => { const d = new Date(W.S.start + 'T12:00:00'); d.setDate(d.getDate() + n - 2); const iso = W.isoDay(d);
    localStorage.setItem('waypoint-now', iso + 'T' + hh + ':00:00'); localStorage.removeItem('waypoint-ahead-map'); W.setAppMode && W.setAppMode('plan'); }, [mv.n, hh]);
  const run = async (conn, none) => { await M.pg.evaluate(c => { window.__calls = []; window.__conn = c; W.vtFor = () => 'test-slug'; W.vtWarm = s => { window.__calls.push(s); return Promise.resolve(true); }; W.render(); }, conn || null);
    if (none) await M.pg.waitForTimeout(3000); else await until(() => M.pg.evaluate(() => window.__calls.length > 0), 14000, 200); await M.pg.waitForTimeout(800); return M.pg.evaluate(() => window.__calls.slice()); };
  await setClock('10'); t.eq(await run(null, 1), [], 'in the morning before a moving day the map is not fetched yet');
  await setClock('19'); t.eq(await run(), ['test-slug'], 'the evening before, the next town\'s map pack is asked for');
  t.eq(await M.pg.evaluate(() => { W.render(); W.render(); return new Promise(r => setTimeout(() => r(window.__calls.slice()), 1200)); }), ['test-slug'], 'and only once that day, however often the screen is drawn');
  await setClock('19'); t.eq(await run({ saveData: true, effectiveType: '4g' }, 1), [], 'not with Data Saver on');
  await setClock('19'); t.eq(await run({ saveData: false, effectiveType: '4g', type: 'cellular' }, 1), [], 'not on mobile data');
  await setClock('19'); t.eq(await run({ saveData: false, effectiveType: '2g' }, 1), [], 'not on a slow connection');
  await M.pg.evaluate(() => { W.setSimple(true); }); await setClock('19'); t.eq(await run(null, 1), [], 'not in Simple view');
  await M.pg.evaluate(() => { W.setSimple(false); });
  await M.pg.evaluate(n => { W.S.start = W.S.start; }, 0);
  /* a day that does not move to a new town: nothing */
  await M.pg.evaluate(() => { localStorage.setItem('waypoint-now', W.isoDay(new Date(W.S.start + 'T12:00:00')) + 'T19:00:00'); localStorage.removeItem('waypoint-ahead-map'); });
  const stay = await M.pg.evaluate(() => W.P.days[1] && !W.P.days[1].moveFrom);
  if (stay) t.eq(await run(null, 1), [], 'the evening before a day in the same town nothing is fetched');
  t.eq(M.errors(), [], 'no page errors');
  await M.ctx.close(); await b.close();
};
