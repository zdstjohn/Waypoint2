/* Getting around the plan: the actions sheet, moving a stop to another day and undoing it, leaving a slot free and undoing,
   the swap cards, the glance, swiping between days, the next-step bar and quick start. */
const { launch, open, exampleTrip, settle } = require('../lib/page');
exports.run = async t => {
  /* the very first open asks where you're headed, over the example trip; the sheet can be put aside */
  { const b0 = await launch(); const { pg: p0, ctx: c0 } = await open(b0, { width: 390, firstRun: true }); await p0.waitForTimeout(800);
    const fr = await p0.evaluate(() => ({ sheet: !!document.querySelector('.qs.sheet'), title: (document.getElementById('qsT') || {}).textContent, look: !!document.querySelector('[data-qs="close"].linkish') }));
    t.ok(fr.sheet && /headed/.test(fr.title || '') && fr.look, 'the first open asks where you are headed: ' + JSON.stringify(fr));
    await p0.click('[data-qs="close"].linkish'); await p0.waitForTimeout(400);
    const gone = await p0.evaluate(() => !document.querySelector('.qs.sheet') && document.querySelectorAll('#viewTrip .slot').length >= 0 && localStorage.getItem('waypoint-welcome') === '1');
    t.ok(gone, 'putting it aside shows the example trip and it does not come back');
    await p0.reload(); await p0.waitForTimeout(1200);
    t.ok(await p0.evaluate(() => !document.querySelector('.qs.sheet')), 'a second open skips the welcome');
    await c0.close(); await b0.close(); }
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844 }); await exampleTrip(pg);
  const k0 = await pg.evaluate(() => { const d = W.P.days[W.S.day - 1]; const x = d.slots.find(y => y.item && y.slot === 'am') || d.slots.find(y => y.item && !W.isFood(y.slot)); return x.key; });
  const name0 = await pg.evaluate(k => W.P.days[W.S.day - 1].slots.find(x => x.key === k).item.n, k0);

  /* the actions sheet */
  await pg.evaluate(k => W.openStop(k), k0); await pg.waitForTimeout(400);
  const sheet = await pg.evaluate(() => ({ acts: [...document.querySelectorAll('.sheet .sh-act')].map(a => a.textContent.trim()), title: (document.querySelector('.sheet .sh-top b') || {}).textContent }));
  t.ok(sheet.acts.length >= 4, 'the actions sheet offers directions, swap, move, reorder and leave free: ' + sheet.acts.join(' | '));
  t.ok(sheet.title === name0, 'the sheet is for the stop that was opened');

  /* move to another day, then undo */
  await pg.click('[data-sheetact="move"]'); await pg.waitForTimeout(250);
  const rows = await pg.evaluate(() => [...document.querySelectorAll('.sh-row')].map(r => +r.dataset.sheetmove));
  t.ok(rows.length >= 1, 'other days of the same city are offered');
  if (rows.length) {
    await pg.click('.sh-row'); await pg.waitForTimeout(700);
    const moved = await pg.evaluate(([k, n, tgt]) => { const P = W.P, here = P.days[W.S.day - 1].slots.find(x => x.key === k); return { hereNow: here.item && here.item.n, there: P.days[tgt - 1].slots.some(y => y.item && y.item.n === n), undo: !!document.querySelector('[data-undo]') }; }, [k0, name0, rows[0]]);
    t.ok(moved.there && moved.hereNow !== name0, 'the stop moved to the chosen day: ' + JSON.stringify(moved));
    t.ok(moved.undo, 'an undo is offered');
    await pg.click('[data-undo]'); await pg.waitForTimeout(500);
    t.eq(await pg.evaluate(k => W.P.days[W.S.day - 1].slots.find(x => x.key === k).item.n, k0), name0, 'undo puts the stop back');
  }

  /* leave it free, then undo */
  await pg.evaluate(k => W.openStop(k), k0); await pg.waitForTimeout(300);
  await pg.click('[data-sheetact="remove"]'); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(k => !!(W.S.free || {})[k], k0), 'the slot is now free time');
  await pg.click('[data-undo]'); await pg.waitForTimeout(500);
  t.eq(await pg.evaluate(k => ({ free: !!(W.S.free || {})[k], n: W.P.days[W.S.day - 1].slots.find(x => x.key === k).item.n }), k0), { free: false, n: name0 }, 'undo brings the stop back');

  /* swap cards */
  const sl = await pg.evaluate(k => W.P.days[W.S.day - 1].slots.find(x => x.key === k).slot, k0);
  await pg.click(`[data-reroll="${sl}"]`); await pg.waitForTimeout(700);
  const sw = await pg.evaluate(() => ({ cards: document.querySelectorAll('.swapcards .scard').length, list: document.querySelectorAll('.swap .opt').length }));
  t.ok(sw.cards === 3, 'three swap cards: ' + JSON.stringify(sw));
  const pickN = await pg.evaluate(() => document.querySelector('.scard').dataset.name);
  await pg.click('.scard'); await pg.waitForTimeout(700);
  t.eq(await pg.evaluate(k => W.P.days[W.S.day - 1].slots.find(x => x.key === k).item.n, k0), pickN, 'tapping a card uses that place');
  t.ok(await pg.evaluate(() => !!document.querySelector('[data-undo]')), 'and can be undone');

  /* the header banner: the trip name, and how far off it is (or where in it you are) */
  const cdn = await pg.evaluate(() => {
    const at = iso => { localStorage.setItem('waypoint-now', iso); W.render(); const c = document.querySelector('.top .ts-c'); return c ? [...c.children].map(x => x.textContent).join(' ').trim() : null; };
    const s = W.S.start, d0 = new Date(s + 'T10:00'), off = n => { const d = new Date(d0); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 16); };
    const r = { months: at(off(-150)), weeks: at(off(-30)), days: at(off(-9)), tomorrow: at(off(-1)), day3: at(off(2)), after: at(off(W.P.N + 3)) };
    localStorage.removeItem('waypoint-now'); W.render();
    r.name = document.querySelector('.top .trip-sw .ts-n b').textContent; r.label = document.querySelector('.top .trip-sw').getAttribute('aria-label'); return r;
  });
  t.eq([cdn.months, cdn.weeks, cdn.days, cdn.tomorrow, cdn.day3, cdn.after], ['5 months to go', '4 weeks to go', '9 days to go', '1 day to go', 'Day 3 of ' + (await pg.evaluate(() => W.P.N)), 'Back home'], 'the header counts down to the trip and follows it: ' + JSON.stringify(cdn));
  t.ok(/^Your trips: .+\. /.test(cdn.label || ''), 'the trip button says the trip and the countdown to a screen reader');
  /* the view switch: labelled; All days, then pick a day; Map. The storybook opens from All days and the trip menu */
  await pg.evaluate(() => scrollTo(0, 0));
  const vs = await pg.evaluate(() => [...document.querySelectorAll('#viewTrip .vsw [data-vsw]')].map(b => b.textContent.trim() + (b.getAttribute('aria-checked') === 'true' ? '*' : '')));
  t.eq(vs, ['Day*', 'Map', 'All days'], 'the trip has a labelled view switch, on Day');
  await pg.click('#viewTrip [data-vsw="all"]'); await pg.waitForTimeout(500);
  const g = await pg.evaluate(() => ({ rows: document.querySelectorAll('.g-day').length, N: W.P.N, slots: document.querySelectorAll('#viewTrip .slot').length, secs: document.querySelectorAll('.g-sec').length, stops: W.P.stops.length, pills: document.querySelectorAll('#viewTrip .dpill').length }));
  t.ok(g.rows === g.N && g.slots === 0 && g.secs === g.stops, 'All days lists every day, grouped by place, in place of the day: ' + JSON.stringify(g));
  /* the stay bar: the places in order instead of day numbers; it follows the scroll, and a tap jumps to a place */
  const sb = await pg.evaluate(() => ({ segs: [...document.querySelectorAll('.staybar .sb-seg b')].map(b => b.textContent), names: W.P.stops.map(s => s.name), lit: document.querySelector('.sb-seg.on b').textContent }));
  t.ok(g.pills === 0 && sb.segs.join() === sb.names.join() && sb.lit === sb.names[0], 'a stay bar in trip order replaces the day numbers: ' + JSON.stringify(sb));
  const last = sb.names.length - 1;
  await pg.click('.sb-seg[data-staygo="' + last + '"]'); await pg.waitForTimeout(900);
  const jump = await pg.evaluate(n => { const sec = document.querySelector('.g-sec[data-stop="' + n + '"]').getBoundingClientRect().top, bar = document.querySelector('.staybar').getBoundingClientRect(); return { gap: Math.round(sec - bar.bottom), stuck: Math.round(bar.top), lit: document.querySelector('.sb-seg.on').dataset.staygo }; }, last);
  t.ok(jump.gap >= 0 && jump.gap < 30 && jump.stuck === 0 && +jump.lit === last, 'tapping the last place brings it under the stuck bar and lights it: ' + JSON.stringify(jump));
  await pg.evaluate(() => { const s = document.querySelector('.g-sec[data-stop="1"]'), bar = document.querySelector('.staybar'); scrollTo(0, s.getBoundingClientRect().top + scrollY - bar.getBoundingClientRect().height - 4); }); await pg.waitForTimeout(400);
  t.eq(await pg.evaluate(() => document.querySelector('.sb-seg.on').dataset.staygo), '1', 'scrolling to the second place lights it');
  /* a day picked far down the list opens at its start, not mid-page */
  await pg.evaluate(() => { const r = document.querySelector('.g-day[data-day="' + W.P.N + '"]'); r.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(300);
  const before = await pg.evaluate(() => Math.round(scrollY));
  await pg.click('.g-day[data-day="' + await pg.evaluate(() => W.P.N) + '"]'); await pg.waitForTimeout(900);
  const opened = await pg.evaluate(() => ({ day: W.S.day, N: W.P.N, y: Math.round(scrollY), head: Math.round(document.querySelector('#viewTrip .day-h').getBoundingClientRect().top), vh: innerHeight }));
  t.ok(before > 200 && opened.day === opened.N && opened.head >= 0 && opened.head < opened.vh / 2, 'a day picked far down All days opens at its start: ' + JSON.stringify([before, opened]));
  /* the day that's already selected opens too */
  await pg.click('#viewTrip [data-vsw="all"]'); await pg.waitForTimeout(500);
  await pg.click('.g-day[data-day="' + await pg.evaluate(() => W.S.day) + '"]'); await pg.waitForTimeout(700);
  t.ok(await pg.evaluate(() => !W.S.glanceOpen && document.querySelectorAll('#viewTrip .g-day').length === 0 && !!document.querySelector('#viewTrip .day-h')), 'tapping the selected day in All days opens it');
  await pg.click('#viewTrip [data-vsw="all"]'); await pg.waitForTimeout(500);
  await pg.evaluate(() => scrollTo(0, 0)); await pg.waitForTimeout(300);
  await pg.click('.g-day[data-day="3"]'); await pg.waitForTimeout(900);
  t.eq(await pg.evaluate(() => [W.S.day, document.querySelector('#viewTrip [data-vsw][aria-checked="true"]').dataset.vsw]), [3, 'days'], 'picking a day there opens it');
  await pg.click('#viewTrip [data-vsw="map"]'); await pg.waitForTimeout(700);
  t.ok(await pg.evaluate(() => W.S.tview === 'map' && !!document.querySelector('#viewTrip .explorer')), 'Map shows the day on the map');
  await pg.click('#viewTrip [data-vsw="all"]'); await pg.waitForTimeout(500);
  await pg.click('#viewTrip .story-link'); await pg.waitForTimeout(1200);
  t.ok(await pg.evaluate(() => W.S.tview === 'story' && !W.S.glanceOpen && document.querySelectorAll('#viewTrip .sp').length === W.P.N), 'All days opens the storybook');
  await pg.click('#viewTrip .ttop [data-story="0"]'); await pg.waitForTimeout(1200);
  t.ok(await pg.evaluate(() => W.S.tview === 'days' && document.querySelectorAll('#viewTrip .slot').length > 2), '"Back to the day" leaves it');
  await pg.evaluate(() => { W.goView('book'); }); await pg.waitForTimeout(700);
  await pg.click('[data-sync="menu"]'); await pg.waitForTimeout(300); await pg.click('[data-sync="story"]'); await pg.waitForTimeout(1500);
  t.ok(await pg.evaluate(() => W.view() === 'trip' && W.S.tview === 'story' && document.querySelectorAll('#viewTrip .sp').length === W.P.N), 'the trip menu opens the storybook from any screen');
  await pg.click('#viewTrip .ttop [data-story="0"]'); await pg.waitForTimeout(1200);
  /* a travel day with long car-rental text stays inside its card on a phone */
  const legOver = await pg.evaluate(() => {
    const P = W.P, L = W.legFor(P, 1); if (!L) return null;
    W.C.legs[L.key] = { v: W.C.legs[L.key] && W.C.legs[L.key].v, opts: [
      { mode: 'car', op: 'Local rental agencies in Rethymno (Avis, Hertz, local operators)', dur: '1h 15m', price: '€35–60/day rental, shared between the group, plus fuel', from: 'Rethymno town (rental pick-up)', to: 'Heraklion city centre', freq: 'Anytime', book: true, note: 'Book a car with extra-large seats or a booster for the 3-year-old.' },
      { mode: 'bus', op: 'KTEL Rethymno / KTEL Heraklion-Lasithi', dur: '1h 30m', price: '€9–12' }] };
    W.S.legPick = {}; W.replan(); W.S.day = W.P.days.find(d => d.stop === 1).n; W.render();
    const c = document.querySelector('#viewTrip .legcard'), r = c.getBoundingClientRect();
    const res = { w: Math.round(r.width), page: document.documentElement.scrollWidth <= innerWidth, out: [...c.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > r.right + 1).map(e => e.className || e.tagName).slice(0, 4) };
    W.S.day = 3; W.render(); scrollTo(0, 0); return res;
  });
  await pg.waitForTimeout(400);
  t.ok(legOver && legOver.out.length === 0 && legOver.page, 'long travel-leg text wraps inside its card: ' + JSON.stringify(legOver));

  /* swipe between days */
  const ys = await pg.evaluate(() => { const s = document.querySelector('.slots'); const r = s.getBoundingClientRect(); return Math.round(r.top + 60); });
  await pg.touchscreen.tap(300, ys).catch(() => {});
  await pg.evaluate(y => { const s = document.querySelector('.slots'); const T = (x, type) => s.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: s, clientX: x, clientY: y })], changedTouches: [new Touch({ identifier: 1, target: s, clientX: x, clientY: y })] })); T(320, 'touchstart'); T(200, 'touchmove'); T(60, 'touchmove'); T(60, 'touchend'); }, ys);
  await pg.waitForTimeout(900);
  t.eq(await pg.evaluate(() => W.S.day), 4, 'a swipe left goes to the next day');

  /* the next-step bar */
  await pg.click('#tabTrip'); await pg.waitForTimeout(600);
  t.eq(await pg.evaluate(() => !!document.querySelector('[data-nextstep]')), false, 'nothing is due within a month, so no next-step bar');
  await pg.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 20); W.S.start = d.toISOString().slice(0, 10); W.changed(); }); await pg.waitForTimeout(1200);
  const nx = await pg.evaluate(() => (document.querySelector('[data-nextstep]') || {}).innerText || '');
  t.ok(/book/i.test(nx), 'with the trip three weeks away, the bar says what to book: ' + nx.replace(/\s+/g, ' ').slice(0, 70));
  await pg.evaluate(() => { W.S.start = '2027-06-07'; W.changed(); }); await pg.waitForTimeout(600);

  /* quick start: a new trip from one sheet */
  await pg.evaluate(() => W.quickStart()); await pg.waitForTimeout(400);
  await pg.fill('#qsWhere', 'portugal'); await pg.fill('#qsStart', '2027-07-05'); await pg.fill('#qsDays', '9');
  await pg.click('[data-qs="k+"]'); await pg.waitForTimeout(150);
  await pg.fill('[data-qskid="' + (await pg.evaluate(() => document.querySelectorAll('[data-qskid]').length - 1)) + '"]', '2');
  await pg.fill('#qsFrom', 'Seattle (SEA)');
  await pg.click('[data-qs="go"]'); await pg.waitForTimeout(800);
  const qs = await pg.evaluate(() => ({ view: W.view(), country: W.S.countries[0] && W.S.countries[0].name, days: W.S.days, start: W.S.start, kids: W.S.travelers.filter(a => a < 18).length, depart: W.S.depart }));
  t.eq(qs, { view: 'trip', country: 'Portugal', days: 9, start: '2027-07-05', kids: qs.kids, depart: 'Seattle (SEA)' }, 'quick start sets up the trip: ' + JSON.stringify(qs));
  t.ok(qs.kids >= 1, 'with the child that was added');
  await pg.waitForTimeout(5000); await settle(pg);
  const later = await pg.evaluate(() => ({ stops: W.P.stops.map(x => x.name), slots: document.querySelectorAll('.slots .slot[data-slotkey]').length }));
  t.ok(later.stops.length >= 2 && later.slots >= 4, 'and the trip fills in: ' + JSON.stringify(later));
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
