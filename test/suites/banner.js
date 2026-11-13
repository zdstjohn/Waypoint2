/* The header over Day and Explore: both tabs draw the same band (the town's photo; on Explore a second layer over it with
   the town's street map as a still picture, or the photo darkened where there is no map), so switching tabs moves nothing
   below it. The map picture is made by the app's real map engine from an invented pack (test/lib/synthpack.js). */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db'); const synth = require('../lib/synthpack');
const px = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#7a6a8a"/></svg>');
const seed = { 'photos/italy-rome': { items: { rome: { url: px, credit: 'Test' } }, city: 'Rome', country: 'Italy' } };
/* where the header and what is above and below it sit, in either tab */
const boxes = pg => pg.evaluate(() => {
  const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top + scrollY), Math.round(b.width), Math.round(b.height)]; };
  const h = document.querySelector('.day-h'); const above = document.querySelector('#viewTrip .daybar, #viewExplore .daybar, #viewTrip .vsw-row');
  const top = document.querySelector('header.top');
  return { head: r(h), above: r(above), hero: !!(h && h.classList.contains('has-hero')), h2: h && h.querySelector('h2').textContent, alt: !!document.querySelector('.hero-alt'), map: !!document.querySelector('.hero-alt .hero-map'),
    top: { photo: !!(top && top.classList.contains('has-photo')), bg: top ? getComputedStyle(top).backgroundImage : '', credit: top ? getComputedStyle(top, '::after').content : '' },
    dots: document.querySelectorAll('.hero-alt i').length, city: (document.querySelector('.hero-alt .hero-city') || {}).textContent || '', lines: (() => { const g = document.querySelector('.day-h .grow'); return g ? getComputedStyle(g).visibility : ''; })(), open: !!document.querySelector('.hero-open[data-banmap]'), gm: (document.querySelector('a.hero-open') || {}).href || '', altOpacity: document.querySelector('.hero-alt') ? +getComputedStyle(document.querySelector('.hero-alt')).opacity : null };
});
const tab = (pg, which, desk) => pg.evaluate(([which, desk]) => { if (desk) W.wsDo('view', which === 'map' ? 'explore' : 'days'); else { W.S.tview = which; W.render(); } }, [which, desk]);
exports.run = async t => {
  const b = await launch();
  for (const [name, width, height, dark, pack, big] of [['phone, no map pack', 390, 844, false, false, false], ['phone dark, no map pack, large text', 390, 844, true, false, true], ['desktop, no map pack', 1440, 900, false, false, false], ['phone, map', 390, 844, false, true, false], ['phone dark, map', 390, 844, true, true, false], ['desktop, map', 1440, 900, false, true, false]]) {
    const desk = width > 1000;
    const { pg, ctx, errors } = await open(b, { width, height, dark, db: mkdb(seed), touch: !desk, scale: big ? 1.3 : 1 });
    if (pack) { await synth.serve(ctx); }
    await exampleTrip(pg);
    if (pack) await synth.again(pg);
    await pg.waitForFunction(() => W.laterReady, null, { timeout: 15000 }).catch(() => {});
    await tab(pg, 'days', desk); await settle(pg);
    if (pack) { await tab(pg, 'map', desk); await pg.waitForFunction(() => document.querySelector('.hero-map'), null, { timeout: 30000 }).catch(() => {}); await tab(pg, 'days', desk); await settle(pg); }
    const day = await boxes(pg); await tab(pg, 'map', desk); await settle(pg); const ex = await boxes(pg);
    const tag = name + ': ';
    t.ok(day.hero && ex.hero && day.alt && ex.alt, tag + 'both tabs draw the photo header with its second layer');
    t.eq(ex.head, day.head, tag + 'the header has the same place and size on Explore and on Day');
    t.eq(ex.h2, day.h2, tag + "the town's name is the same in both tabs");
    t.ok(day.altOpacity === 0 && ex.altOpacity === 1, tag + 'the second layer is hidden on Day and shows on Explore');
    t.eq(ex.above, day.above, tag + 'what is above the header does not move');
    if (pack) {
      t.ok(ex.map && ex.dots === 0 && ex.city === ex.h2 && ex.open, tag + "Explore shows the town's quiet map (no pins) with the town's name in it, and the banner opens the map: " + JSON.stringify([ex.map, ex.dots, ex.city, ex.open]));
      t.ok(ex.lines === 'hidden' && day.lines === 'visible', tag + "the photo's lines (name, date) leave with the photo on Explore and are there on Day: " + JSON.stringify([day.lines, ex.lines]));
      /* the tap */
      if (desk) {
        await pg.evaluate(() => W.wsSet('map', 0)); await settle(pg); await pg.click('.hero-open[data-banmap]');
        const shown = await pg.evaluate(() => ({ pref: W.wsPrefs.map, wide: document.documentElement.classList.contains('ws-wide') })); t.ok(shown.pref === 1 && !shown.wide, tag + 'a tap shows the map pane again when it was hidden: ' + JSON.stringify(shown));
      } else {
        await pg.click('.hero-open[data-banmap]'); await pg.waitForFunction(() => document.querySelector('#viewGo .go-map'), null, { timeout: 8000 }).catch(() => {});
        const go = await pg.evaluate(() => ({ view: W.view(), map: !!document.querySelector('#viewGo .go-map'), day: W.S.day })); t.ok(go.view === 'go' && go.map && go.day === 2, tag + "a tap opens this day's map on Today: " + JSON.stringify(go));
      }
    } else {
      t.ok(!ex.map && ex.dots === 0 && !ex.city && ex.lines === 'visible' && !ex.open, tag + "with no map pack Explore shows the photo darkened with the day's lines, no map");
      t.ok(/google\.com\/maps\/search\/.*Rome/.test(ex.gm), tag + 'the banner opens the town in Google Maps: ' + ex.gm);
    }
    t.eq(errors(), [], tag + 'no page errors');
    await ctx.close();
  }
  /* the fade: 0.2 s on a switch, none with reduced motion; a day with no photo keeps its plain heading in both tabs */
  { const { pg, ctx } = await open(b, { width: 390, db: mkdb(seed) }); await exampleTrip(pg);
    const n = async () => pg.evaluate(() => document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.classList && a.effect.target.classList.contains('hero-alt')).map(a => a.effect.getTiming().duration));
    await pg.evaluate(() => { W.S.tview = 'map'; W.render(); }); t.eq(await n(), [], 'reduced motion: no fade');
    await pg.emulateMedia({ reducedMotion: 'no-preference' }); await pg.evaluate(() => { W.S.tview = 'days'; W.render(); }); await settle(pg);
    await pg.evaluate(() => { W.S.tview = 'map'; W.render(); }); t.eq(await n(), [200], 'Day to Explore fades the second layer in over 0.2 s');
    await settle(pg); await pg.evaluate(() => { W.S.tview = 'days'; W.render(); }); t.eq(await n(), [200], 'Explore to Day fades it out over 0.2 s');
    await ctx.close(); }
  { const { pg, ctx } = await open(b, { width: 390, db: mkdb() }); await exampleTrip(pg);
    const hh = async () => pg.evaluate(() => { const h = document.querySelector('.day-h'); return h && { hero: h.classList.contains('has-hero'), alt: !!document.querySelector('.hero-alt') }; });
    const d = await hh(); await pg.evaluate(() => { W.S.tview = 'map'; W.render(); }); const e = await hh();
    t.ok(d && e && !d.hero && !e.hero && !d.alt && !e.alt, 'with no photo both tabs keep the plain heading (no band to fade, so nothing jumps)'); await ctx.close(); }
  await b.close();
};
