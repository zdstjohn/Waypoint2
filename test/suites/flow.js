/* Getting around the plan: the actions sheet, moving a stop to another day and undoing it, leaving a slot free and undoing,
   the swap cards, swiping between days, the next-step bar and quick start. */
const { launch, open, exampleTrip, settle, calm, reveal } = require('../lib/page');
exports.run = async t => {
  /* the very first open asks where you're headed, over the example trip; the sheet can be put aside */
  { const b0 = await launch(); const { pg: p0, ctx: c0 } = await open(b0, { width: 390, firstRun: true });
    /* (the questions come with the second script: they appear as soon as it is in, usually under a second) */
    await p0.waitForFunction(() => !!document.querySelector('.qs.sheet'), null, { timeout: 6000 }).catch(() => {});
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
  const sheet = await pg.evaluate(() => { const s = document.querySelector('.sheet'), main = s.querySelector('.sh-main'), det = s.querySelector('.sd');
    return { acts: [...main.children].map(a => a.textContent.trim() || a.getAttribute('aria-label')), title: (s.querySelector('.sh-top b') || {}).textContent, first: main.getBoundingClientRect().bottom <= det.getBoundingClientRect().top + 1, dirMain: !main.querySelector('.sh-dir').classList.contains('quiet') && main.querySelectorAll('.btn:not(.quiet)').length === 1, menu: (m => !!m && m.getBoundingClientRect().top >= det.getBoundingClientRect().bottom - 1)(s.querySelector('.sh-menu')), focus: document.activeElement === s,
      links: [...s.querySelectorAll('.links .pl-a')].map(a => a.textContent.trim()) }; });
  t.ok(sheet.acts[0] === 'Directions' && sheet.acts[sheet.acts.length - 1] === 'Swap' && sheet.first && sheet.dirMain && sheet.menu, 'a stop\'s sheet leads with what you do: Directions (the one main button) and Swap, above the facts; the rarer changes come after them, with no "⋯" to open: ' + sheet.acts.join(' | '));
  t.ok(sheet.title === name0 && sheet.focus, 'the sheet is for the stop that was opened, and the keyboard is in it');
  t.eq(sheet.links, ['Reviews', 'Photos', 'Map'], 'Reviews, Photos and Map are buttons that say what they open');
  const more = await pg.evaluate(() => [...document.querySelectorAll('.sheet .sh-menu [data-sheetact]')].map(b2 => b2.dataset.sheetact));
  t.eq(more, ['move', 'reorder', 'remove', 'nope'], 'the end of the sheet holds the rest: move to another day, reorder today, leave it free, not for us');

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
  await reveal(pg, `#viewTrip [data-reroll="${sl}"]`); await pg.click(`#viewTrip [data-reroll="${sl}"]`); await pg.waitForTimeout(700);
  const sw = await pg.evaluate(() => ({ cards: document.querySelectorAll('.swapcards .scard').length, list: document.querySelectorAll('.swap .opt').length }));
  t.ok(sw.cards === 3, 'three swap cards: ' + JSON.stringify(sw));
  /* a card opens the idea up close, with Add and Skip: nothing is swapped in until Add */
  const nowN = () => pg.evaluate(k => W.P.days[W.S.day - 1].slots.find(x => x.key === k).item.n, k0);
  const was = await nowN();
  const pickN = await pg.evaluate(() => document.querySelector('.scard').dataset.name);
  await pg.click('.scard'); await pg.waitForTimeout(600);
  const pk = await pg.evaluate(() => { const p = document.querySelector('.swap .sw-peek'); return p ? { n: (p.querySelector('.swp-n') || {}).textContent, add: (p.querySelector('.swp-act [data-use]') || {}).textContent, skip: !!p.querySelector('[data-peekskip]'), back: !!p.querySelector('[data-peekback]'), d: !!p.querySelector('.sd-d'), links: p.querySelectorAll('.links a').length, of: (p.querySelector('.swp-top .muted') || {}).textContent } : null; });
  t.ok(pk && pk.n === pickN && /^Add for /.test(pk.add || '') && pk.skip && pk.back && pk.d && pk.links >= 2 && /^1 of \d+$/.test(pk.of || ''), 'tapping a card shows it up close: what it is, Add, Skip, and its links: ' + JSON.stringify(pk));
  t.eq(await nowN(), was, 'and the plan has not changed yet');
  await pg.click('.swap [data-peekskip]'); await pg.waitForTimeout(500);
  const sk = await pg.evaluate(() => ({ n: (document.querySelector('.swap .swp-n') || {}).textContent, of: (document.querySelector('.swap .swp-top .muted') || {}).textContent }));
  t.ok(sk.n && sk.n !== pickN && /^2 of /.test(sk.of || ''), 'Skip shows the next idea: ' + JSON.stringify(sk));
  t.eq(await nowN(), was, 'still nothing swapped');
  await pg.click('.swap [data-peekback]'); await pg.waitForTimeout(400);
  t.ok(await pg.evaluate(() => !document.querySelector('.swap .sw-peek') && document.querySelectorAll('.swapcards .scard').length === 3), 'All ideas goes back to the list');
  await pg.click('.scard'); await pg.waitForTimeout(500);
  await pg.click('.swap .swp-act [data-use]'); await pg.waitForTimeout(700);
  t.eq(await nowN(), pickN, 'Add puts that place in');
  t.ok(await pg.evaluate(() => !!document.querySelector('[data-undo]') && !document.querySelector('.swap')), 'and can be undone, the swap closed');
  /* Next suggestion shows the best idea up close too, rather than swapping it in */
  await reveal(pg, `#viewTrip [data-reroll="${sl}"]`); await pg.click(`#viewTrip [data-reroll="${sl}"]`); await pg.waitForTimeout(600);
  await pg.click('.swap [data-next]'); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(() => !!document.querySelector('.swap .sw-peek .swp-act [data-use]')), 'Next suggestion shows the idea up close, with Add');
  t.eq(await nowN(), pickN, 'and changes nothing until Add');
  await pg.click('.swap [data-swapclose]'); await pg.waitForTimeout(500);

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
  /* the view switch: one row of two, Day and Explore (All days went in v154: the row of day numbers is the way between days) */
  await pg.evaluate(() => scrollTo(0, 0));
  const vs = await pg.evaluate(() => ({ tabs: [...document.querySelectorAll('#viewTrip .vsw [data-vsw]')].map(b => b.textContent.trim() + (b.getAttribute('aria-selected') === 'true' ? '*' : '')), rows: document.querySelectorAll('#viewTrip .vsw, #viewTrip .dsw').length }));
  t.eq(vs, { tabs: ['Day*', 'Explore'], rows: 1 }, 'one row of two: Day and Explore (no All days, no second switch under it)');
  await pg.click('#viewTrip [data-vsw="map"]'); await pg.waitForTimeout(700);
  t.ok(await pg.evaluate(() => W.S.tview === 'map' && !document.querySelector('#viewTrip .rcard') && !!document.querySelector('#placeQ') && !document.querySelector('#viewTrip svg.map')), 'Explore shows the search, and neither the route (it is on Today) nor a sketch map');
  /* nights: To book and the plan give each place the same count (the last place loses the day you fly home) */
  const nights = await pg.evaluate(() => W.P.stops.map((s, si) => {
    const book = W.checklist(W.P).find(x => x.group === 'stay' && x.title.indexOf('Where to stay in ' + s.name + ' (') === 0);
    const num = x => { const m = /(\d+) nights?/.exec(x || ''); return m ? +m[1] : 0; };
    return { book: book ? num(book.title) : 0, nights: W.nightsAt(W.P, si), days: s.days, last: si === W.P.stops.length - 1 };
  }));
  t.ok(nights.length > 1 && nights.every(n => n.book === n.nights && n.book === n.days - (n.last ? 1 : 0)), 'To book and the plan agree on nights, the last place one fewer than its days: ' + JSON.stringify(nights));
  await pg.click('#viewTrip [data-vsw="days"]'); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(() => W.S.tview === 'days' && !!document.querySelector('#viewTrip .day-h') && !document.querySelector('.all-days, .staybar, [data-vsw="all"]')), 'and Day goes back to the day (there is no All days any more)');
  /* the way to each stop, between the cards: Navigate opens Google Maps directions to it */
  const nav = await pg.evaluate(() => { const L = [...document.querySelectorAll('#viewTrip .nav-leg')], cards = [...document.querySelectorAll('#viewTrip article.slot:not(.free)')];
    const before = cards.filter(c => { let p = c.previousElementSibling; while (p && !p.matches('article.slot, .nav-leg')) p = p.previousElementSibling; return p && p.matches('.nav-leg'); }).length;
    return { n: L.length, cards: cards.length, before, hrefs: L.every(a => /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1(&origin=[^&]+)?&destination=/.test(a.href) && a.target === '_blank'), text: L[0] && L[0].textContent.replace(/\s+/g, ' ').trim(), inCard: document.querySelectorAll('#viewTrip article.slot .leg').length }; });
  t.ok(nav.n >= nav.cards && nav.before === nav.cards && nav.hrefs && /\d+ min\b.*Navigate/.test(nav.text || '') && nav.inCard === 0, 'each stop has the way to it before it (how long and how far, then Navigate), opening Google Maps directions, and the card does not repeat the time: ' + JSON.stringify(nav));
  /* back to the top: a round button when you turn back up from far down a screen, above the tab bar; one tap goes up.
     On the way down it stays out of the way (it sits where each row keeps its button) */
  await pg.evaluate(() => { scrollTo(0, 0); W.upCheck(); }); await pg.waitForTimeout(300);
  const up0 = await pg.evaluate(() => { const u = document.getElementById('totop'); return !u || !u.classList.contains('on'); });
  /* (the packing list is long enough to scroll; a short day may not be) */
  await pg.evaluate(() => { W.S.prepTab = 'pack'; W.goView('book'); }); await pg.waitForFunction(() => document.querySelectorAll('#viewBook .pk-list .chk').length > 10, null, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(300);
  await pg.evaluate(() => { scrollTo(0, document.documentElement.scrollHeight); W.upCheck(); }); await pg.waitForTimeout(400);
  const upDown = await pg.evaluate(() => { const u = document.getElementById('totop'); return !u || !u.classList.contains('on'); });
  await pg.evaluate(() => { scrollTo(0, scrollY - 160); W.upCheck(); }); await pg.waitForTimeout(400);
  const up1 = await pg.evaluate(() => { const u = document.getElementById('totop'), tb = document.querySelector('.tabs'); if (!u) return null; const r = u.getBoundingClientRect(), t = tb.getBoundingClientRect(), cs = getComputedStyle(u);
    return { on: u.classList.contains('on'), above: r.bottom <= t.top, right: innerWidth - r.right, w: Math.round(r.width), ring: /gradient/.test(cs.backgroundImage), name: u.getAttribute('aria-label') }; });
  t.ok(up0 && upDown, 'scrolling down a long screen shows no back-to-top button: nothing covers the rows\' own buttons');
  t.ok(up1 && up1.on && up1.above && up1.right >= 15 && up1.w >= 44 && up1.ring && up1.name === 'Back to the top', 'turning back up brings it, above the tab bar, with a gradient ring: ' + JSON.stringify(up1));
  await pg.click('#totop'); await pg.waitForFunction(() => scrollY < 5, null, { timeout: 4000 }).catch(() => {});
  t.ok(await pg.evaluate(() => scrollY < 5), 'and one tap goes back to the top');
  await pg.evaluate(() => { W.goView('trip'); }); await pg.waitForTimeout(400);
  /* v149: Explore's add buttons say what they do and what they replace; the toast leads to the day; "+ Add" is beside the switch */
  t.ok(await pg.evaluate(() => !document.querySelector('#viewTrip .vsw-add')), 'no "+ Add" beside the Day · Explore switch (v150: it was noise)');
  await pg.evaluate(() => { W.S.tview = 'map'; W.render(); }); await pg.waitForTimeout(700);
  /* v152: one "Add to Day N" per idea; a tap shows the parts of the day under it, a free one first */
  const ex0 = await pg.evaluate(() => { const u = document.querySelector('#viewTrip .idea .use'); return u ? { add: (u.querySelector('.use-add') || {}).textContent, rows: u.querySelectorAll('[data-use]').length, h: Math.round(u.querySelector('.use-add').getBoundingClientRect().height), day: W.S.day } : null; });
  t.ok(ex0 && ex0.add.replace(/\s+/g, ' ').trim() === '+ Add to Day ' + ex0.day && ex0.rows === 0 && ex0.h >= 44, 'an idea has one "Add to Day N" button, 44px tall, and no row of times until it is tapped: ' + JSON.stringify(ex0));
  await pg.click('#viewTrip .idea .use .use-add'); await pg.waitForTimeout(400);
  const ex = await pg.evaluate(() => { const u = document.querySelector('#viewTrip .idea .use'), bs = [...u.querySelectorAll('[data-use]')];
    return { open: u.querySelector('.use-add').getAttribute('aria-expanded'), btns: bs.map(b2 => b2.textContent.replace(/\s+/g, ' ').trim()), h: bs.length ? Math.round(bs[0].getBoundingClientRect().height) : 0, aria: bs.length ? bs[0].getAttribute('aria-label') : '', others: document.querySelectorAll('#viewTrip .idea .use-pick').length }; });
  const freeFirst = ex.btns.every((x, i) => !/free now$/.test(x) || ex.btns.slice(0, i).every(y => /free now$/.test(y)));
  t.ok(ex.open === 'true' && ex.others === 1 && ex.btns.length >= 2 && ex.btns.every(x => /^\+ \w+ · (replaces .+|free now)$/.test(x)) && freeFirst && ex.h >= 40 && /^Add .+ to Day \d+, /.test(ex.aria || ''), 'a tap shows the parts of the day, a free one first, each naming what it would replace: ' + ex.btns.join(' | '));
  const tgt = await pg.evaluate(() => { const b2 = document.querySelector('#viewTrip .idea .use [data-use]'); return { slot: b2.dataset.use, name: b2.dataset.name }; });
  await pg.click('#viewTrip .idea .use [data-use]'); await pg.waitForTimeout(700);
  const toast = await pg.evaluate(([slot, name]) => { const u = document.querySelector('#undohost .undo'), x = W.P.days[W.S.day - 1].slots.find(y => y.slot === slot); return { text: u ? u.querySelector('span').textContent : '', see: !!(u && u.querySelector('[data-undosee]')), undo: !!(u && u.querySelector('[data-undo]')), on: !!x.item && x.item.n === name }; }, [tgt.slot, tgt.name]);
  t.ok(toast.on && /^Added to Day \d+ \w+/.test(toast.text) && toast.see && toast.undo, 'adding says what happened ("' + toast.text + '"), with "See day" and Undo');
  await pg.click('#undohost [data-undosee]'); await pg.waitForTimeout(600);
  t.ok(await pg.evaluate(() => W.S.tview === 'days' && W.view() === 'trip' && !document.querySelector('#undohost .undo')), '"See day" goes to the day it was added to');
  /* the storybook is gone: no way in, and a trip saved on it opens on the day */
  t.ok(await pg.evaluate(() => { W.S.tview = 'story'; W.render(); return W.S.tview === 'days' && !document.querySelector('[data-story], [data-sync="story"], .story') && !!document.querySelector('#viewTrip .day-h'); }), 'there is no storybook, and a trip left on it opens on the day');
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
  await calm(pg, 7500);
  const later = await pg.evaluate(() => ({ stops: W.P.stops.map(x => x.name), slots: document.querySelectorAll('.slots .slot[data-slotkey]').length }));
  t.ok(later.stops.length >= 2 && later.slots >= 4, 'and the trip fills in: ' + JSON.stringify(later));
  /* islands: a destination is a town, never a whole island */
  { const { pg: pi, ctx: ci, errors: ei } = await open(b, { width: 390, height: 844 }); await exampleTrip(pi);
    const lists = await pi.evaluate(() => {
      const names = c => W.countryCities(c).map(x => x.name), isl = [];
      Object.keys(TD).forEach(c => names(c).forEach(n => { if (W.isleOf(c, n) || W.findCity(c, n).whole) isl.push(c + ': ' + n); }));
      const g = names('Greece'), f = W.findCity('Greece', 'Santorini');
      return { isl, towns: ['Fira', 'Oia', 'Heraklion', 'Chania', 'Naxos Town', 'Corfu Town'].filter(n => !g.includes(n)), islands: ['Santorini', 'Crete', 'Naxos', 'Corfu'].filter(n => g.includes(n)),
        palma: names('Spain').includes('Palma de Mallorca') && !names('Spain').includes('Mallorca'), patong: names('Thailand').includes('Patong'), italy: names('Italy').slice(0, 5),
        whole: !!(f && f.whole && f.spots.length), spots: (W.findCity('Greece', 'Fira').spots || []).length, base: W.findCity('Greece', 'Fira').isl,
        vancouver: !!W.isleOf('Canada', 'Vancouver'), vi: !!W.isleOf('Canada', 'Vancouver Island'), skye: !!W.isleOf('United Kingdom', 'skye'), typed: !!W.isleOf('Greece', 'the island of Santorini'), victoria: !!W.isleOf('Canada', 'Victoria') };
    });
    t.eq(lists.isl, [], 'no built-in destination is a whole island, in any country');
    t.eq([lists.towns, lists.islands], [[], []], 'Greece offers Fira, Oia, Heraklion, Chania, Naxos Town and Corfu Town, and not Santorini, Crete, Naxos or Corfu');
    t.ok(lists.palma && lists.patong, 'Mallorca gives way to Palma de Mallorca, Phuket & Krabi to its towns');
    t.eq(lists.italy, ['Rome', 'Florence', 'Venice', 'Amalfi Coast', 'Lake Como'], 'a country with no island in its list is as it was');
    t.ok(lists.whole && lists.spots >= 3 && lists.base === 'Santorini', 'an island can still be looked up (an older trip has one), and its towns carry its built-in ideas: ' + JSON.stringify(lists));
    t.ok(!lists.vancouver && lists.vi && lists.skye && lists.typed && !lists.victoria, 'Vancouver is a city and Vancouver Island an island; Skye and "the island of Santorini" are islands; Victoria is a town');
    /* a list Claude gave before this named islands: the ones we know give way to their towns at once, and a new answer
       replaces the others without the towns already there shifting */
    const old = await pi.evaluate(async () => {
      const mk = (name, pop) => ({ name, region: 'Dalmatia', lat: 43.5, lng: 16.4, w: 2, pop, t: [], d: '' });
      W.C.country.Croatia = { blurb: 'b', cities: [mk('Split', 5), mk('Hvar', 5), mk('Vis', 3), mk('Dubrovnik', 5)] };
      const before = W.countryCities('Croatia').map(x => x.name);
      const merged = W.islesInto(W.C.country.Croatia.cities, W.townsOnly([Object.assign(mk('Vis Town', 3), { isl: 'Vis' }), Object.assign(mk('Komiža', 2), { isl: 'Vis' }), Object.assign(mk('Vis', 3), { isl: 'Vis' }), mk('Zadar', 4), Object.assign(mk('Split', 1), { isl: '' })])).map(x => x.name + (x.pop === 5 ? '*' : ''));
      const alone = W.townsOnly([Object.assign(mk('Hydra', 3), { isl: 'Hydra' }), mk('Nafplio', 4)]).map(x => x.name);
      W.loadCountry('Croatia'); for (let i = 0; i < 40 && !(W.C.country.Croatia.v >= 2); i++) await new Promise(r => setTimeout(r, 150));
      return { before, merged, alone, v: W.C.country.Croatia.v, kept: W.C.country.Croatia.cities.map(x => x.name) };
    });
    t.eq(old.before, ['Split', 'Hvar Town', 'Stari Grad', 'Jelsa', 'Vis', 'Dubrovnik'], 'an older list: Hvar gives way to its towns');
    t.eq(old.merged, ['Split*', 'Hvar*', 'Dubrovnik*', 'Vis Town', 'Komiža'], 'a new answer swaps the island it names (Vis) for its towns and leaves the rest as it was, adding nothing else');
    t.eq(old.alone, ['Hydra', 'Nafplio'], 'a small island named alone stays, as its one town');
    t.ok(old.v === 2 && old.kept.slice(0, 4).join() === 'Split,Hvar,Vis,Dubrovnik', 'the older list is asked again once and keeps its towns: ' + JSON.stringify([old.v, old.kept.length]));
    /* choosing places yourself: an island typed as a place offers its towns and adds nothing */
    await pi.evaluate(() => { W.S.countries = [{ name: 'Greece', mode: 'manual', picked: ['Athens'] }]; W.S.cityDays = {}; W.S.days = 9; (W.S.stepClosed = W.S.stepClosed || {}).where = false; W.setView('setup'); W.changed(); });
    await pi.waitForSelector('#cityIn0', { timeout: 15000 });
    const ph = await pi.getAttribute('#cityIn0', 'placeholder');
    await pi.fill('#cityIn0', 'crete'); await pi.click('[data-addcity="0"]'); await pi.waitForTimeout(400);
    const ask = await pi.evaluate(() => { const e = document.querySelector('.country .isle-ask'); return { text: e && e.querySelector('p').textContent, towns: e ? [...e.querySelectorAll('.chip')].map(x => x.textContent) : [], picked: W.S.countries[0].picked.slice() }; });
    t.ok(/Crete is a whole island/.test(ask.text || '') && ask.towns.slice(0, 3).join() === 'Heraklion,Chania,Rethymno' && ask.picked.join() === 'Athens' && !/island/.test(ph), 'typing Crete offers its towns and adds nothing: ' + JSON.stringify(ask) + ' ' + ph);
    await pi.click('.isle-ask .chip[data-pick="Chania"]'); await pi.waitForTimeout(400);
    const picked = await pi.evaluate(() => ({ picked: W.S.countries[0].picked.slice(), on: (document.querySelector('.isle-ask .chip[data-pick="Chania"]') || { getAttribute: () => null }).getAttribute('aria-pressed'), stops: W.P.stops.map(x => x.name) }));
    t.eq(picked, { picked: ['Athens', 'Chania'], on: 'true', stops: ['Athens', 'Chania'] }, 'tapping a town adds it');
    await pi.click('[data-isledone="0"]'); await pi.waitForTimeout(300);
    t.ok(await pi.evaluate(() => !document.querySelector('.isle-ask')), 'Done puts the towns away');
    /* an older trip with an island as a stop still plans, and offers the island's towns in its place */
    await pi.evaluate(() => { W.S.countries[0].picked = ['Athens', 'Santorini']; W.S.cityDays = { 'Greece|Athens': 3, 'Greece|Santorini': 4 }; W.S.stays = { 'Greece|Santorini': { label: 'Hotel Caldera' } }; W.S.days = 7; W.changed(); });
    await pi.waitForSelector('.stop .isle-ask', { timeout: 10000 });
    const was = await pi.evaluate(() => ({ stops: W.P.stops.map(x => x.name + ' ' + x.days), towns: [...document.querySelectorAll('.stop .isle-ask .chip')].map(x => x.textContent) }));
    t.ok(was.stops.join() === 'Athens 3,Santorini 4' && was.towns.includes('Oia'), 'an older trip with Santorini as a stop still plans, with its towns on offer: ' + JSON.stringify(was));
    await pi.click('.stop .isle-ask .chip[data-town="Oia"]'); await pi.waitForTimeout(500);
    const now = await pi.evaluate(() => ({ picked: W.S.countries[0].picked.slice(), days: W.S.cityDays['Greece|Oia'], gone: W.S.cityDays['Greece|Santorini'] === undefined, stay: (W.S.stays['Greece|Oia'] || {}).label, hint: !!document.querySelector('.stop .isle-ask'), stops: W.P.stops.map(x => x.name + ' ' + x.days) }));
    t.eq(now, { picked: ['Athens', 'Oia'], days: 4, gone: true, stay: 'Hotel Caldera', hint: false, stops: ['Athens 3', 'Oia 4'] }, 'choosing a town puts it in the island\'s place, with its days and its lodging');
    /* suggested places: towns only, and one base on a small island */
    const sug = await pi.evaluate(() => {
      W.S.countries = [{ name: 'Greece', mode: 'suggest', picked: [] }]; W.S.cityDays = { 'Greece|Santorini': 5 }; W.S.stays = {}; W.S.days = 21; W.changed();
      const st = W.plan().stops, close = [];
      st.forEach((a, i) => st.forEach((b2, j) => { if (j > i && a.c.isl && a.c.isl === b2.c.isl && W.km(a.c, b2.c) < 40) close.push(a.name + '+' + b2.name); }));
      return { stops: st.map(x => x.name), isl: st.filter(x => W.isleOf('Greece', x.name)).map(x => x.name), close, moved: W.S.cityDays['Greece|Fira'], old: W.S.cityDays['Greece|Santorini'] };
    });
    t.ok(sug.stops.length >= 3 && !sug.isl.length && !sug.close.length, 'suggested places are towns, with no two on the same small island: ' + JSON.stringify(sug));
    t.ok(sug.moved === 5 && sug.old === undefined, 'days once set for a suggested island go to its usual base');
    /* quick start: an island named among the places is turned back with its towns */
    await pi.evaluate(() => W.quickStart()); await pi.waitForTimeout(400);
    await pi.fill('#qsWhere', 'Greece'); await pi.fill('#qsCities', 'Athens, Santorini'); await pi.click('[data-qs="go"]'); await pi.waitForTimeout(500);
    const q1 = await pi.evaluate(() => ({ open: !!document.querySelector('.qs.sheet'), warn: (document.querySelector('.qs .warn') || {}).textContent, kept: (document.getElementById('qsCities') || {}).value, ph: (document.getElementById('qsCities') || {}).placeholder }));
    t.ok(q1.open && /Santorini is a whole island/.test(q1.warn || '') && /Fira/.test(q1.warn) && q1.kept === 'Athens, Santorini' && !/Crete/.test(q1.ph), 'quick start turns an island back and names its towns: ' + JSON.stringify(q1));
    await pi.fill('#qsCities', 'Athens, Fira'); await pi.click('[data-qs="go"]'); await pi.waitForTimeout(800);
    t.eq(await pi.evaluate(() => W.S.countries[0].picked.slice()), ['Athens', 'Fira'], 'and takes the town');
    t.eq(ei(), [], 'islands: no page errors');
    await ci.close(); }
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
