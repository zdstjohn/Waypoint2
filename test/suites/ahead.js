/* A step ahead (lib/ahead.js): once the screen has settled the phone fetches the next and the previous day's header photo
   and first stop photos (so a swipe shows them at once), but never on Simple view or a saving/slow connection; and the
   evening before a day that moves to a new town it asks for that town's street map: once a day, never on mobile data;
   and while a day of a town with a street map is read, the map's engine (v192), under the same rule. A part of a day that
   nothing in the town's ideas fits asks for more by itself, once a visit per town (v199). */
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
  await M.pg.evaluate(() => { W.offline.save = () => Promise.resolve(); W.offline.tick = () => {}; W.vtEngineWarm = () => {}; });   /* (the phone's own saving also asks for packs; the engine has its own checks below) */
  const mv = await M.pg.evaluate(() => { const P = W.plan(), i = P.days.findIndex(d => d.moveFrom); return { n: i + 1, start: W.S.start }; });
  t.ok(mv.n >= 2, 'the example trip has a day that moves to a new town: day ' + mv.n);
  /* (deterministic: the clock, the connection and the stand-ins are all set in ONE step before the single draw that is under test; setting the clock drew the screen on its own, and the idle work that draw started could land before or after run() cleared __calls) */
  let clk = null;
  const setClock = async (hh) => { clk = hh; };
  const run = async (conn, none) => { await M.pg.evaluate(([c, n, hh]) => { window.__calls = []; window.__conn = c; W.vtFor = () => 'test-slug'; W.vtWarm = s => { window.__calls.push(s); return Promise.resolve(true); };
      if (hh) { const d = new Date(W.S.start + 'T12:00:00'); d.setDate(d.getDate() + n - 2); localStorage.setItem('waypoint-now', W.isoDay(d) + 'T' + hh + ':00:00'); localStorage.removeItem('waypoint-ahead-map'); W.setAppMode && W.setAppMode('plan'); }
      W.render(); }, [conn || null, mv.n, clk]);
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
  await M.pg.evaluate(() => { localStorage.setItem('waypoint-now', W.isoDay(new Date(W.S.start + 'T12:00:00')) + 'T19:00:00'); localStorage.removeItem('waypoint-ahead-map'); }); clk = null;
  const stay = await M.pg.evaluate(() => W.P.days[1] && !W.P.days[1].moveFrom);
  if (stay) t.eq(await run(null, 1), [], 'the evening before a day in the same town nothing is fetched');
  /* ---- the map's engine (v192): asked for in idle time while a day of a town with a street map is read ---- */
  await M.pg.evaluate(() => { localStorage.removeItem('waypoint-now'); });
  const eng = async (conn, view, slug, none) => { await M.pg.evaluate(([c, view, slug]) => { window.__eng = 0; window.__conn = c; W.vtFor = () => slug; W.vtState = () => 'idle'; W.vtEngineWarm = () => { window.__eng++; }; W.goView(view); W.render(); }, [conn || null, view, slug]);
    if (none) await M.pg.waitForTimeout(3000); else await until(() => M.pg.evaluate(() => window.__eng > 0), 14000, 200); return M.pg.evaluate(() => window.__eng); };
  t.ok(await eng(null, 'trip', 'test-slug') > 0, 'on the Day view of a town with a street map the map\'s engine is asked for while idle');
  t.ok(await eng(null, 'go', 'test-slug') > 0, 'and on Today');
  t.eq(await eng(null, 'trip', null, 1), 0, 'not for a town without a street map');
  t.eq(await eng({ saveData: false, effectiveType: '4g', type: 'cellular' }, 'trip', 'test-slug', 1), 0, 'not on mobile data');
  t.eq(await eng({ saveData: true, effectiveType: '4g' }, 'trip', 'test-slug', 1), 0, 'not with Data Saver on');
  t.eq(await eng(null, 'settings', 'test-slug', 1), 0, 'not on a screen that shows no day');
  await M.pg.evaluate(() => { W.setSimple(true); }); t.eq(await eng(null, 'trip', 'test-slug', 1), 0, 'not in Simple view');
  await M.pg.evaluate(() => { W.setSimple(false); W.goView('trip'); });
  const once = await M.pg.evaluate(async () => { let st = 'idle', n = 0; W.vtState = () => st; W.vtEngineWarm = () => { n++; st = 'loading'; }; W.render(); await new Promise(r => setTimeout(r, 2500)); W.render(); W.render(); await new Promise(r => setTimeout(r, 2500)); return n; });
  t.ok(once <= 1, 'and once only: an engine that is loading is not asked for again (' + once + ')');
  t.eq(M.errors(), [], 'no page errors');
  await M.ctx.close();

  /* ---- a part of a day nothing fits (v199): more ideas are asked for by themselves, once a visit per town ---- */
  const mkShort = async (init) => { const o = await open(b, { width: 390, height: 844, db: mkdb({}), init });
    await o.pg.evaluate(() => { W.newTripFrom({ v: 2, algo: 2, styles: ['culture'], countries: [{ mode: 'manual', name: 'Italy', picked: ['Florence'] }], days: 4, start: '2027-06-15', depart: 'Seattle (SEA)', travelers: [41, 40] }); });
    await settle(o.pg, 8000); return o; };
  /* the town's sights cut to three, so its days run short (the meals are untouched: those have their own fill, lib/ideas.js W.mealIdeas) */
  const cut = pg => pg.evaluate(() => { window.__more = []; const o = W.loadCity; W.loadCity = function (co, ci, more) { if (more) window.__more.push(ci); return o.apply(this, arguments); };
    const d = W.P.days[1], c = W.C.city[W.cityKey(d.country, d.city)]; c.spots = c.spots.slice(0, 3); if (c.rest) c.rest.spots = []; c.showN = { spots: 3 };
    W.S.picks = {}; W.S.day = 2; W.S.tview = 'days'; W.goView('trip'); W.replan(); W.dataV = (W.dataV || 0) + 1; W.render();
    return W.P.days.filter(d => d.slots.some(x => W.slotShort(x) && x.slot !== 'eve' && !x.trip)).length; });
  const shortDays = pg => pg.evaluate(() => W.P.days.filter(d => d.slots.some(x => W.slotShort(x) && x.slot !== 'eve' && !x.trip)).map(d => d.n));
  const F = await mkShort(null); const nShort = await cut(F.pg);
  t.ok(nShort >= 2, 'with three sights for four days, days run short (' + nShort + ' days with a part nothing fits)');
  await F.pg.waitForTimeout(1500);
  const asked1 = await F.pg.evaluate(() => window.__more.slice());
  t.eq(asked1, ['Florence'], 'more ideas are asked for at once, with no tap on "Find more ideas"');
  await settle(F.pg, 9000);
  const after = await F.pg.evaluate(() => { const c = W.C.city[W.cityKey('Italy', 'Florence')]; return { spots: c.spots.length, note: !!document.querySelector('#viewTrip .short-note') }; });
  const left = await shortDays(F.pg);
  t.ok(after.spots > 3 && left.length === 0 && !after.note, 'when they come, every day is filled and the note is gone (' + after.spots + ' sights; short days left: ' + (left.join(', ') || 'none') + ')');
  /* the same town short again on this visit: not asked twice (a tap on "Find more ideas" still asks) */
  await F.pg.evaluate(() => { const c = W.C.city[W.cityKey('Italy', 'Florence')]; c.spots = c.spots.slice(0, 3); c.showN = { spots: 3 }; W.S.picks = {}; for (const n of [1, 2, 3]) { W.S.day = n; W.render(); } W.replan(); W.dataV++; W.render(); });
  await F.pg.waitForTimeout(2500);
  const asked2 = await F.pg.evaluate(() => ({ n: window.__more.length, btn: !!document.querySelector('#viewTrip .short-note [data-more]') }));
  t.ok(asked2.n === 1 && asked2.btn, 'short again on the same visit, it is not asked again by itself, and the day offers "Find more ideas" (' + asked2.n + ' asks)');
  /* another trip in the same page asks afresh (the flag was kept for the whole page, so a second trip asked nothing) */
  await F.pg.evaluate(() => { W.S.tripId = 'another-trip'; const c = W.C.city[W.cityKey('Italy', 'Florence')]; c.spots = c.spots.slice(0, 3); c.showN = { spots: 3 }; W.S.picks = {}; W.S.day = 2; W.replan(); W.dataV++; W.render(); });
  await F.pg.waitForTimeout(2000);
  t.ok(await F.pg.evaluate(() => window.__more.length) >= 2, 'a different trip asks again for the same town');
  await settle(F.pg, 9000);
  t.eq(F.errors(), [], 'no page errors');
  await F.ctx.close();
  /* an ask that did not go out (W.loadCity started nothing) leaves the town unmarked, so it is tried again */
  const H = await mkShort(null);
  const none = await H.pg.evaluate(async () => { let n = 0; const real = W.loadCity; W.loadCity = function () { n++; };
    const d = W.P.days[1], c = W.C.city[W.cityKey(d.country, d.city)]; c.spots = c.spots.slice(0, 3); if (c.rest) c.rest.spots = []; c.showN = { spots: 3 };
    W.S.picks = {}; W.S.day = 2; W.S.tview = 'days'; W.goView('trip'); W.replan(); W.dataV = (W.dataV || 0) + 1;
    for (let i = 0; i < 3; i++) { W.render(); await new Promise(r => setTimeout(r, 400)); } W.loadCity = real; return n; });
  t.ok(none >= 2, 'a town whose ask did not start is not marked as asked: it is tried again (' + none + ' tries)');
  await H.ctx.close();
  /* a gap in the sights is judged by the sights alone: a town at its sight cap is full for them, short on food or not */
  const G = await mkShort(null);
  const capped = await G.pg.evaluate(async () => { const co = W.IDEA_CAP.spots; window.__more = []; const o = W.loadCity; W.loadCity = function (a, b2, more) { if (more) window.__more.push(b2); return o.apply(this, arguments); };
    const d = W.P.days[1], c = W.C.city[W.cityKey(d.country, d.city)]; c.spots = c.spots.slice(0, 3); if (c.rest) c.rest.spots = []; c.showN = { spots: 3 }; c.food = (c.food || []).slice(0, 3); if (c.rest) c.rest.food = [];
    W.IDEA_CAP.spots = 3; W.S.picks = {}; W.S.day = 2; W.S.tview = 'days'; W.goView('trip'); W.replan(); W.dataV = (W.dataV || 0) + 1; W.render();
    await new Promise(r => setTimeout(r, 2000)); const out = { asked: window.__more.length, spotsFull: W.listFull(c, 'spots'), all: W.ideasFull(c) }; W.IDEA_CAP.spots = co; return out; });
  t.ok(capped.spotsFull && !capped.all && capped.asked === 0, 'a town at its sight cap but short on food is not asked for more sights: ' + JSON.stringify(capped));
  await G.ctx.close();
  /* never in a trip you only view, and never offline */
  for (const [name, init] of [['a trip you only view', null], ['offline', 'window.__WP_OFFLINE = 1;']]) {
    const R = await mkShort(null);
    if (name === 'offline') await R.pg.evaluate(() => { window.__WP_OFFLINE = 1; }); else await R.pg.evaluate(() => { W.readOnly = true; });
    await cut(R.pg); await R.pg.waitForTimeout(2500);
    t.eq(await R.pg.evaluate(() => window.__more.length), 0, 'nothing is asked for by itself in ' + name);
    await R.ctx.close();
  }
  await b.close();
};
