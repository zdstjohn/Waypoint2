/* Travel mode: during the trip the app opens on Today with a timeline, running late shifts the times, the day before and after
   are a tap away. */
const { launch, open, exampleTrip, settle, calm } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg);
  await pg.evaluate(() => { W.save && W.save(); localStorage.setItem('waypoint-now', '2027-06-09T10:40:00'); });
  await pg.reload(); await calm(pg, 5000);
  const s = await pg.evaluate(() => ({ view: W.view(), travel: document.documentElement.classList.contains('travel'), tl: document.querySelectorAll('.go-rt li').length, hero: !!document.querySelector('.go-hero') }));
  t.ok(s.view === 'go' && s.travel, 'during the trip the app opens on Today in Travel mode: ' + JSON.stringify(s));
  t.ok(s.tl >= 3, 'with the day laid out as a route');
  /* today's map: folded behind a Map button in the route's header (where the city has a street map), opened in place */
  const mp = await pg.evaluate(async () => {
    const none = !document.querySelector('#viewGo [data-gomap]');
    const f = W.vtFor, m = W.vtMount, st = W.vtState; W.vtFor = () => 'test-city'; W.vtState = () => 'idle'; W.vtMount = () => false; W.render();
    const btn = document.querySelector('#viewGo .go-route [data-gomap]'), closed = !!btn && btn.getAttribute('aria-expanded') === 'false' && !document.querySelector('#viewGo .map-wrap');
    if (btn) btn.click(); await new Promise(r => setTimeout(r, 300));
    const b2 = document.querySelector('#viewGo .go-route [data-gomap]'), wrap = document.querySelector('#viewGo .go-route .map-wrap'), list = document.querySelector('#viewGo .go-rt');
    const open = !!wrap && !!b2 && b2.getAttribute('aria-expanded') === 'true' && /Hide map/.test(b2.textContent) && !!list && wrap.getBoundingClientRect().bottom <= list.getBoundingClientRect().top + 1 && !!document.querySelector('#viewGo [data-zoom="fit"]');
    W.goView('trip'); W.S.tview = 'map'; W.render(); await new Promise(r => setTimeout(r, 300));
    const explore = !document.querySelector('#viewTrip .map-wrap');
    W.goView('go'); await new Promise(r => setTimeout(r, 300)); if (document.querySelector('#viewGo [data-gomap]')) document.querySelector('#viewGo [data-gomap]').click(); await new Promise(r => setTimeout(r, 200));
    const shut = !document.querySelector('#viewGo .map-wrap');
    W.vtFor = f; W.vtMount = m; W.vtState = st; W.render();
    return { none, closed, open, explore, shut };
  });
  t.ok(mp.none && mp.closed && mp.open && mp.shut && mp.explore, 'Today has a Map button where the city has a street map: closed at first, it opens the map above the stops and hides it again; Explore has no map: ' + JSON.stringify(mp));
  const t0 = await pg.evaluate(() => (document.querySelector('.go-rt li.next .t') || document.querySelector('.go-rt li:not(.done) .t') || {}).textContent);
  if (await pg.$('[data-late="15"]')) {
    await pg.click('[data-late="15"]'); await pg.waitForTimeout(700);
    const t1 = await pg.evaluate(() => (document.querySelector('.go-rt li.next .t') || document.querySelector('.go-rt li:not(.done) .t') || {}).textContent);
    t.ok(t0 !== t1, `running 15 min late shifts the next time (${t0} -> ${t1})`);
    await pg.click('[data-late="0"]'); await pg.waitForTimeout(400);
  } else t.note('no running-late control on this day');
  /* rescue the rest of today: rain swaps the outdoor stops still to come for indoor ones (or frees them); nothing started changes; undo restores */
  const before = await pg.evaluate(() => { const d = W.P.days[W.S.day - 1], T = W.dayTimes(d, W.P), nm = W.nowMin(); return d.slots.map(x => ({ slot: x.slot, n: x.item ? x.item.n : null, started: !!(T.rows[x.slot] && T.rows[x.slot].start != null && T.rows[x.slot].start <= nm), indoor: x.item && !W.isFood(x.slot) ? W.classify(x.item).indoor : null })); });
  if (await pg.$('[data-rescue="rain"]')) {
    await pg.click('[data-rescue="rain"]'); await pg.waitForTimeout(900);
    const after = await pg.evaluate(() => { const d = W.P.days[W.S.day - 1]; return { slots: d.slots.map(x => ({ slot: x.slot, n: x.item ? x.item.n : null, indoor: x.item && !W.isFood(x.slot) ? W.classify(x.item).indoor : null, free: !!(W.S.free || {})[x.key] })), note: (document.querySelector('.go-rescue.done .gr-k') || {}).textContent }; });
    const startedKept = before.filter(b0 => b0.started && b0.n).every(b0 => after.slots.find(a0 => a0.slot === b0.slot).n === b0.n);
    t.ok(startedKept, 'rain rescue leaves what has already started alone');
    const laterOut = after.slots.filter((a0, i) => !before[i].started && a0.n && a0.indoor === false && !/breakfast|lunch|dinner/.test(a0.slot));
    t.eq(laterOut.map(x => x.n), [], 'no outdoor outing is left in the rest of the day: ' + JSON.stringify(after.slots));
    t.ok(/Plan B for the rain/.test(after.note || ''), 'and the screen says what it did: ' + after.note);
    await pg.click('[data-unrescue]'); await pg.waitForTimeout(700);
    const undone = await pg.evaluate(() => W.P.days[W.S.day - 1].slots.map(x => ({ n: x.item ? x.item.n : null, free: !!(W.S.free || {})[x.key] })));
    /* every place that was on the day is back and nothing stays freed; a slot that was empty (no idea fitted it yet) may
       fill from the ideas the rescue asked for meanwhile */
    t.eq(undone.map((u, i) => before[i].n ? u.n : u.free ? 'freed' : 'ok'), before.map(b0 => b0.n || 'ok'), 'undo brings the day back: ' + JSON.stringify(undone));
  } else t.note('no rescue control on this day');
  if (await pg.$('.go-eve [data-goprev]')) { await pg.click('.go-eve [data-goprev]'); await pg.waitForTimeout(800); t.ok(await pg.evaluate(() => !!document.querySelector('[data-gotoday]')), 'another day shows a way back to today'); await pg.click('[data-gotoday]'); await pg.waitForTimeout(400); }
  await pg.click('.go-foot [data-appmode="plan"]'); await pg.waitForTimeout(900);
  t.ok(await pg.evaluate(() => !document.documentElement.classList.contains('travel')), 'the Today footer can turn Travel mode off');
  /* Today's map: the lettered pins only. No line from pin to pin (a straight line is a flight path, not the way you walk) */
  const vt = await pg.evaluate(() => fetch('lib/vtmap.js').then(r => r.text()));
  t.ok(vt.length > 20000 && !/id: "route/.test(vt) && !/route: \{ type: "geojson"/.test(vt) && !/getSource\("route"\)/.test(vt) && /pinEl\(/.test(vt), 'the street map draws the day\'s pins and no line between them (no route layer, no route source)');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
