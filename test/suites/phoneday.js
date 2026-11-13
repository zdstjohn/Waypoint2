/* v174, a phone's Trip day (the owner's pick of five): the Day tab has no header of its own (the day's photo is behind
   the top card), and each stop card gives the time a line of its own, the whole name under it, the photo a small square
   at the right and Menu / Swap as buttons with words. Simple view: each card keeps only what you need to run the day
   (no descriptions, no "nice to know" notes, no tags but the booking ones). */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch();
  const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb(), init: () => { try { localStorage.setItem('waypoint-now', '2027-06-08T10:20:00'); } catch (e) {} } });
  await exampleTrip(pg); await settle(pg, 3000);
  await pg.evaluate(() => { W.S.day = 2; W.S.tview = 'days'; W.goView('trip'); scrollTo(0, 0); }); await settle(pg, 2500);
  /* the first stop sits right under Day / Explore */
  const first = await pg.evaluate(() => { const sw = document.querySelector('#viewTrip .vsw-row, #viewTrip .vsw'), s = document.querySelector('#viewTrip .slot[data-slotkey]');
    return { head: !!document.querySelector('#viewTrip .day-h.has-hero'), gap: sw && s ? Math.round(s.getBoundingClientRect().top - sw.getBoundingClientRect().bottom) : null, inView: s ? s.getBoundingClientRect().bottom < innerHeight : false }; });
  t.ok(first.gap !== null && first.gap < 160 && first.inView, 'the first stop starts right under Day / Explore, on the first screen: ' + JSON.stringify(first));
  /* the cards: time on one line, the whole name, the words on the buttons */
  const cards = await pg.evaluate(() => [...document.querySelectorAll('#viewTrip .slot[data-slotkey]:not(.free)')].slice(0, 4).map(s => {
    const tm = s.querySelector('.tm'), nm = s.querySelector('.nm'), lh = nm ? parseFloat(getComputedStyle(nm).lineHeight) : 0;
    const acts = [...s.querySelectorAll('.sl-acts button')].map(b => { const l = b.querySelector('.bt-l'); return l && getComputedStyle(l).display !== 'none' ? l.textContent : ''; });
    return { tmLines: tm ? Math.round(tm.getBoundingClientRect().height / parseFloat(getComputedStyle(tm).lineHeight || '20')) : 0, cut: nm ? nm.scrollHeight > nm.clientHeight + 2 || nm.scrollWidth > nm.clientWidth + 2 : true, acts, w: nm ? Math.round(nm.getBoundingClientRect().width) : 0 }; }));
  t.ok(cards.length >= 3, 'the day has stop cards: ' + cards.length);
  t.ok(cards.every(c => c.tmLines <= 1), 'each time stays on one line: ' + JSON.stringify(cards.map(c => c.tmLines)));
  t.ok(cards.every(c => !c.cut), 'no name is cut short: ' + JSON.stringify(cards.map(c => [c.cut, c.w])));
  t.ok(cards.some(c => c.acts.indexOf('Menu') > -1) && cards.some(c => c.acts.indexOf('Swap') > -1), 'Menu and Swap say what they are: ' + JSON.stringify(cards.map(c => c.acts)));
  /* the same buttons on a wide screen keep their icons only */
  /* Simple view: the cards keep what you need to run the day */
  const full = await pg.evaluate(() => { const s = [...document.querySelectorAll('#viewTrip .slot[data-slotkey]')];
    return { tags: s.reduce((n, c) => n + c.querySelectorAll('.gtags .gt:not(.due):not(.ok)').length, 0), notes: s.map(c => (c.querySelector('.slot-notes') || {}).textContent || '').join(' | ') }; });
  await pg.evaluate(() => W.setSimple(true)); await settle(pg, 1500);
  const simple = await pg.evaluate(() => { const s = [...document.querySelectorAll('#viewTrip .slot[data-slotkey]')];
    return { tags: s.reduce((n, c) => n + c.querySelectorAll('.gtags .gt:not(.due):not(.ok)').length, 0), due: s.reduce((n, c) => n + c.querySelectorAll('.gtags .gt.due, .gtags .gt.ok').length, 0),
      desc: s.filter(c => { const d = c.querySelector('.desc'); return d && getComputedStyle(d).display !== 'none'; }).length, notes: s.map(c => (c.querySelector('.slot-notes') || {}).textContent || '').join(' | '), photo: document.querySelector('header.top').classList.contains('has-photo') }; });
  t.ok(full.tags > 0, 'with Simple view off the cards have their tags (price, indoors, must-see): ' + full.tags);
  t.ok(simple.tags === 0 && simple.desc === 0, 'Simple view: no descriptions and no tags but the booking ones: ' + JSON.stringify(simple));
  t.ok(!/Locals eat around/.test(simple.notes) || !/Locals eat around/.test(full.notes), 'Simple view leaves out the nice-to-know notes ("Locals eat around…")');
  t.ok(!simple.photo, 'Simple view: no photo behind the top card either');
  await pg.evaluate(() => W.setSimple(false));
  t.eq(errors(), [], 'no page errors');
  await ctx.close();
  /* a wide screen keeps its header (the top card there has no photo). (Its plan pane is phone-width, so the cards there
     take the same layout as a phone's, words on the buttons too.) */
  { const { pg, ctx, errors } = await open(b, { width: 1440, height: 900, touch: false, db: mkdb() }); await exampleTrip(pg); await settle(pg, 3000);
    await pg.evaluate(() => { W.S.day = 2; W.S.tview = 'days'; W.goView('trip'); }); await settle(pg, 2500);
    const w = await pg.evaluate(() => ({ head: !!document.querySelector('#viewTrip .day-h'), photo: document.querySelector('header.top').classList.contains('has-photo') }));
    t.ok(w.head && !w.photo, 'a wide screen keeps the day\'s own header, and no photo behind the top card: ' + JSON.stringify(w));
    t.eq(errors(), [], 'no page errors (desktop)'); await ctx.close(); }
  await b.close();
};
