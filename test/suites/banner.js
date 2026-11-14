/* The day's header on Day and Explore. On a wide screen both tabs draw the same band (the town's photo, its name and the
   date), so switching tabs moves nothing. On a phone (v174, the owner's pick) neither tab has a header of its own: the
   day's photo is behind the top card, with its credit, and the day starts right under Day / Explore. The town's street
   map that Explore drew over the photo from v171 to v173 is gone (the owner's call): no second layer, no map picture.
   v176: Today's top card has the day's photo too, and how full a day (the owner liked it on Trip). */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
const px = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#7a6a8a"/></svg>');
const seed = { 'photos/italy-rome': { items: { rome: { url: px, credit: 'Test' } }, city: 'Rome', country: 'Italy' } };
/* where the header and what is above it sit, in either tab */
const boxes = pg => pg.evaluate(() => {
  const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top + scrollY), Math.round(b.width), Math.round(b.height)]; };
  const h = document.querySelector('.day-h'); const above = document.querySelector('#viewTrip .daybar, #viewExplore .daybar, #viewTrip .vsw-row');
  const top = document.querySelector('header.top');
  return { head: r(h), above: r(above), hero: !!(h && h.classList.contains('has-hero')), h2: h && h.querySelector('h2') ? h.querySelector('h2').textContent : '',
    top: { photo: !!(top && top.classList.contains('has-photo')), bg: top ? getComputedStyle(top).backgroundImage : '', credit: top ? getComputedStyle(top, '::after').content : '' },
    old: document.querySelectorAll('.hero-alt, .hero-map, .hero-open, .hero-city').length };
});
const tab = (pg, which, desk) => pg.evaluate(([which, desk]) => { if (desk) W.wsDo('view', which === 'map' ? 'explore' : 'days'); else { W.S.tview = which; W.render(); } }, [which, desk]);
exports.run = async t => {
  const b = await launch();
  for (const [name, width, height, dark, big] of [['phone', 390, 844, false, false], ['phone dark, large text', 390, 844, true, true], ['desktop', 1440, 900, false, false], ['desktop dark', 1440, 900, true, false]]) {
    const desk = width > 1000;
    const { pg, ctx, errors } = await open(b, { width, height, dark, db: mkdb(seed), touch: !desk, scale: big ? 1.3 : 1 });
    await exampleTrip(pg);
    await pg.waitForFunction(() => W.laterReady, null, { timeout: 15000 }).catch(() => {});
    await tab(pg, 'days', desk); await settle(pg);
    const day = await boxes(pg); await tab(pg, 'map', desk); await settle(pg); const ex = await boxes(pg);
    const tag = name + ': ';
    if (desk) {
      t.ok(day.hero && ex.hero, tag + 'both tabs draw the photo header');
      t.eq(ex.head, day.head, tag + 'the header has the same place and size on Explore and on Day');
      t.eq(ex.h2, day.h2, tag + "the town's name is the same in both tabs");
      t.ok(!day.top.photo && !ex.top.photo, tag + 'the top card keeps its own colours');
    } else {
      for (const [tn, x] of [['Day', day], ['Explore', ex]])
        t.ok(!x.head && x.top.photo && /url\(/.test(x.top.bg) && /Photo: /.test(x.top.credit), tag + tn + ": no header of its own, the day's photo and its credit on the top card: " + JSON.stringify(x.top));
      /* v176 (the owner's ask): Today's top card has the day's photo, its credit and how full a day, as on Trip */
      await pg.evaluate(() => { W.goView('go'); W.render(); }); await settle(pg);
      const go = await boxes(pg), line = await pg.evaluate(() => (document.querySelector('#topline .tl-day') || {}).textContent || '');
      t.ok(go.top.photo && /url\(/.test(go.top.bg) && /Photo: /.test(go.top.credit) && /(Easy|Moderate|Full|Heavy|Rest) day/.test(line), tag + "Today: the day's photo, its credit and how full a day on the top card: " + JSON.stringify({ top: go.top, line }));
      await pg.evaluate(() => { W.goView('trip'); W.render(); }); await settle(pg);
      /* v179 (the owner's ask): scrolled down, the slim bar that takes the card's place keeps the photo */
      const pin = await pg.evaluate(async () => { window.scrollTo(0, 900); await new Promise(r => setTimeout(r, 500)); const p = document.getElementById('pin');
        const cs = p ? getComputedStyle(p, '::before') : null, at = getComputedStyle(document.documentElement).getPropertyValue('--pin-photo-at').trim();
        const r = { shown: !!p && !p.hidden, bg: cs ? cs.backgroundImage : '', at, pos: cs ? cs.backgroundPosition : '' }; window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 300)); return r; });
      t.ok(pin.shown && /url\(/.test(pin.bg), tag + 'scrolled down, the slim bar keeps the day\'s photo: ' + pin.bg.slice(0, 80));
      /* (v180) the strip the card's bottom edge showed, not the photo's top: placed lower than the card's top by about its height */
      const y = parseFloat((pin.at.split(' ')[1] || ''));
      t.ok(pin.at && y < -100 && pin.pos.indexOf(pin.at.split(' ')[1]) > -1, tag + 'the slim bar shows the bottom of the card\'s photo: ' + JSON.stringify({ at: pin.at, pos: pin.pos.slice(0, 80) }));
    }
    t.eq(ex.above, day.above, tag + 'what is above the day does not move between the tabs');
    t.ok(day.old === 0 && ex.old === 0, tag + 'no street-map picture or its layers anywhere: ' + ex.old);
    t.eq(errors(), [], tag + 'no page errors');
    await ctx.close();
  }
  /* a day with no photo keeps its plain heading in both tabs, and the top card its colours */
  { const { pg, ctx } = await open(b, { width: 390, db: mkdb() }); await exampleTrip(pg);
    const hh = async () => pg.evaluate(() => { const h = document.querySelector('.day-h'); return { h: !!h, hero: !!(h && h.classList.contains('has-hero')), top: document.querySelector('header.top').classList.contains('has-photo') }; });
    const d = await hh(); await pg.evaluate(() => { W.S.tview = 'map'; W.render(); }); const e = await hh();
    t.ok(d.h && e.h && !d.hero && !e.hero && !d.top && !e.top, 'with no photo both tabs keep the plain heading: ' + JSON.stringify([d, e])); await ctx.close(); }
  /* v202, the owner: the top card was a different size from day to day (a short "Rest day" fitted beside the town and
     "Heavy day" did not): the town is always the first line and the date and how full the day is the second, each one
     line, so every day's card is the same height, a long town name included */
  { const { pg, ctx } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg); await settle(pg, 4000);
    const hs = await pg.evaluate(async () => { const out = []; W.goView('trip'); W.S.tview = 'days';
      for (let n = 1; n <= W.P.days.length; n++) { W.S.day = n; W.render(); await new Promise(r => setTimeout(r, 60));
        const d = document.querySelector('header.top .tl-day'), dt = d && d.querySelector('.tl-dt');
        if (d && d.getBoundingClientRect().height) out.push({ n, h: Math.round(dt.getBoundingClientRect().height), lines: dt.querySelectorAll(':scope > b, :scope > .tl-meta').length, txt: dt.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) }); }
      /* the longest town name, and a rest day */
      const d0 = W.P.days[0], keep = d0.city; W.S.rest = W.S.rest || {}; W.S.rest[W.restKey(W.P.days[1])] = 1; W.replan();
      d0.city = 'Ordesa y Monte Perdido National Park'; W.S.day = 1; W.render(); await new Promise(r => setTimeout(r, 60));
      const dt1 = document.querySelector('header.top .tl-day .tl-dt'); out.push({ n: 'long', h: Math.round(dt1.getBoundingClientRect().height) });
      W.S.day = 2; W.render(); await new Promise(r => setTimeout(r, 60));
      const dt2 = document.querySelector('header.top .tl-day .tl-dt'); out.push({ n: 'rest', h: Math.round(dt2.getBoundingClientRect().height), txt: dt2.textContent.replace(/\s+/g, ' ').trim() });
      d0.city = keep; return out; });
    const heights = [...new Set(hs.map(x => x.h))];
    t.ok(hs.length >= 4 && heights.length === 1 && hs.filter(x => x.lines != null).every(x => x.lines === 2), 'the top card is the same height on every day, a rest day and a long town name included (' + heights.join(', ') + ' px): ' + JSON.stringify(hs.slice(-3)));
    await ctx.close(); }
  await b.close();
};
