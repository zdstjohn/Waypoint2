/* Bookings: the checklist has what to book and by when, ticking an item, the budget adds up, a booking added by hand lands
   on its day and in the budget; on the trip, the reminders follow its clock (v152). */
const { launch, open, exampleTrip, settle, calm } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg);
  await pg.waitForFunction(() => W.laterReady, null, { timeout: 15000 }).catch(() => {});
  /* (v176) the booking timeline counts days right */
  const tl = await pg.evaluate(() => { const t0 = new Date(2027, 2, 10, 9, 0), d = n => W.isoDay(new Date(2027, 2, 10 + n));
    const say = n => ((W.bookTimeline([], t0, d(n)).match(/leaving[^<]*/) || [''])[0]); return [say(0), say(1), say(3)]; });
  t.eq(tl, ['leaving today', 'leaving tomorrow', 'leaving in 3 days'], 'the booking timeline counts days right');
  /* (v177, the owner's cuts) no booking-site links on Prepare. (v177 also took out a card for unused stored files, then
     upkeep with nothing to clear; v195 brings a Storage card back at the owner's ask, once the nightly tasks' leftovers
     had filled the store: suite storage) */
  const gone = await pg.evaluate(async () => { const wait = ms => new Promise(r => setTimeout(r, ms));
    W.goView('book'); await wait(500); const book = document.getElementById('viewBook').textContent;
    W.goView('trip'); await wait(300);
    return { sites: /Booking sites|Show links to|Also on/.test(book), api: ['sitesRow', 'altUrls', 'altLinksFor', 'storageCard'].filter(k => k in W) }; });
  t.eq(gone, { sites: false, api: [] }, 'no booking-site links');
  /* (v181) "Watch price" on a stay only while its Booking.com price is for the nights it has now */
  const wch = await pg.evaluate(() => { const P = W.P, s = P.stops[0], ck = W.cityKey(s.country, s.name), dt = W.stayDates(s, P), was = W.S.stays[ck];
    const at = (i, o) => { W.S.stays[ck] = { label: 'Hotel X', live: { total: 900, cur: 'EUR', url: 'https://www.booking.com/x', at: 1, in: i, out: o, src: 'Booking.com' } }; return /Watch price/.test(W.watchChip('stay', ck, P)); };
    const r = { now: at(dt.in, dt.out), old: at('2020-01-01', '2020-01-03') }; if (was) W.S.stays[ck] = was; else delete W.S.stays[ck]; return r; });
  t.eq(wch, { now: true, old: false }, 'a stay\'s price watch is offered only for a price for the nights it has now');
  await pg.click('#tabBook'); await calm(pg, 3700);
  const chk = await pg.evaluate(() => ({ items: document.querySelectorAll('.chk').length, by: document.querySelectorAll('.chk .by').length, stays: [...document.querySelectorAll('.chk')].filter(c => /stay|hotel|place to stay/i.test(c.innerText)).length }));
  t.ok(chk.items >= 5, 'the checklist has things to book: ' + JSON.stringify(chk));
  t.ok(chk.by >= 3, 'with "book by" dates');
  /* (v186) in each group the rows follow the day they are used, soonest first */
  const ord = await pg.evaluate(() => [...document.querySelectorAll('.chk-group')].map(g => [...g.querySelectorAll('.chk [data-goday]')].map(e => +e.dataset.goday)).filter(a => a.length > 1));
  t.ok(ord.length > 0 && ord.every(a => a.every((d, i) => !i || d >= a[i - 1])), 'each group lists what is needed soonest first: ' + JSON.stringify(ord));
  /* the Day button sits at the start of its row (it was centred: ".go" is also the Today screen's class) */
  const dayChip = await pg.evaluate(() => { const c = document.querySelector('.chk-a [data-goday]'); if (!c) return null; const row = c.parentElement.getBoundingClientRect(), r = c.getBoundingClientRect(), sib = c.previousElementSibling;
    return { cls: c.className, left: Math.round(r.left - (sib ? sib.getBoundingClientRect().right + 6 : row.left)) }; });
  t.ok(dayChip && !/\bgo\b/.test(dayChip.cls) && Math.abs(dayChip.left) <= 2, 'the "Day" button lines up with the other buttons in its row: ' + JSON.stringify(dayChip));
  /* with no start date there are no deadlines: the rows go under how far ahead to book them, with no "3 mo ahead" tags */
  const nd = await pg.evaluate(() => { const s0 = W.S.start; W.S.start = ''; W.changed(); W.render();
    const r = { groups: [...document.querySelectorAll('.chk-group .gl')].map(e => e.textContent), tags: [...document.querySelectorAll('.chk .by')].map(e => e.textContent), rows: document.querySelectorAll('.chk').length };
    W.S.start = s0; W.changed(); W.render(); return r; });
  t.ok(nd.rows >= 5 && nd.groups[0] === 'Months ahead' && nd.groups.every(g => /^(Months ahead|Weeks ahead|A few days ahead|To book)$/.test(g)) && !nd.tags.some(x => /ahead/.test(x)),
    'with no start date, rows are grouped by how far ahead to book (no cryptic tags): ' + JSON.stringify(nd));
  const key = await pg.evaluate(() => document.querySelector('[data-tick]').dataset.tick);
  await pg.click('[data-tick]'); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(k => !!(W.S.booked || {})[k] && W.checklist(W.P).find(c => c.key === k).done, key), 'ticking an item marks it booked');
  await pg.evaluate(k => { const b = document.querySelector(`[data-tick="${k}"]`); if (b) b.click(); else { W.S.booked[k] = 0; W.changed(); } }, key); await pg.waitForTimeout(300);
  t.ok(await pg.evaluate(k => !(W.S.booked || {})[k], key), 'and ticking again un-books it');
  /* Prepare is split into segments: Budget, then Booked for the hand-added confirmation */
  await pg.evaluate(() => { W.S.prepTab = 'budget'; W.render(); });
  const bud = await pg.evaluate(() => { const rows = [...document.querySelectorAll('table.budget tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ')); const tot = (document.querySelector('table.budget tfoot') || {}).innerText || ''; return { rows, tot }; });
  t.ok(bud.rows.length >= 3 && /€|\$|£/.test(bud.tot), 'the budget has rows and a total: ' + JSON.stringify(bud).slice(0, 160));
  /* add a booking by hand */
  await pg.evaluate(() => { W.S.prepTab = 'booked'; W.render(); const d = document.querySelector('details.addbk'); if (d) d.open = true; });
  await pg.selectOption('#bkKind', 'lodging'); await pg.fill('#bkTitle', 'Hotel Test Roma'); await pg.fill('#bkDate', '2027-06-08'); await pg.fill('#bkPrice', '420'); await pg.fill('#bkCur', 'EUR');
  await pg.click('[data-addbk]'); await pg.waitForTimeout(900);
  const added = await pg.evaluate(() => { const r = { n: (W.S.bookings || []).length, hand: (W.S.bookings || []).filter(x => x.src === 'hand').map(x => [x.title, x.place, x.price, x.cur]), listed: /Hotel Test Roma/.test(document.body.innerText) }; W.S.prepTab = 'budget'; W.render(); r.booked = (document.querySelector('table.budget tbody') || {}).innerText || ''; return r; });
  t.eq(added.hand, [['Hotel Test Roma', 'Rome', 420, 'EUR']], 'a hotel added by hand lands on its day\'s city with its price');
  t.ok(/420/.test(added.booked), 'and shows under Booked in the budget');
  t.ok(added.listed, 'and is listed under Booked');
  /* the booking autopilot: the book-by list reaches the database where the morning helper reads it, and what the helper
     writes back reaches the page (both are documents under your own private corner, at paths the real store accepts) */
  await pg.evaluate(() => { W.isExample = false; W.S.tripId = 'tauto1'; W.S.start = '2027-06-07'; W.S.prepTab = 'tobook'; W.changed(); W.render(); if (W.autoTick) W.autoTick(W.P); });
  await pg.waitForTimeout(3500);
  const bb = await pg.evaluate(async () => { const r = JSON.parse(await window.__dbOp('get', 'data/users/u-test/bookby/t/tauto1', null) || 'null'); return r && { n: (r.items || []).length, start: r.start, key: r.items && r.items[0] && r.items[0].key }; });
  t.ok(bb && bb.n >= 5 && bb.start === '2027-06-07', 'the book-by list is saved for the morning helper: ' + JSON.stringify(bb));
  if (bb && bb.key) {
    await pg.evaluate(async k => { await window.__dbOp('set', 'data/users/u-test/autopilot/t/tauto1', JSON.stringify({ found: { [k]: { title: 'Casa Test', provider: 'Booking.com', ref: 'HTL-889', when: '2027-06-07' } }, cal: { [k]: { id: 'ev1', by: '2027-01-10' } }, checked: '2027-01-05T15:00:00Z', note: '' })); }, bb.key);
    await pg.waitForTimeout(1500);
    const back = await pg.evaluate(k => { W.render(); const line = document.querySelector('.auto-line'); return { found: !!(W.autoFound && W.autoFound(k)), line: line ? line.innerText : '' }; }, bb.key);
    t.ok(back.found && /checked your inbox/.test(back.line) && /1 reminder/.test(back.line), 'and what the helper found comes back to the list: ' + JSON.stringify(back));
  }
  t.eq(errors(), [], 'no page errors');
  await ctx.close();
  /* v152: the reminders follow the trip's clock. On Day 2, the flight and the first stay are not "Book now": they ask
     "Did you book it?" in their own folded group, out of the count and of how ready you are; a deadline that has gone
     by is never shown as a date ("Book now" on today's card); a day gone by shows no deadline at all. */
  const { pg: p2, ctx: c2, errors: e2 } = await open(b, { width: 390, height: 844, db: mkdb(), init: () => { try { localStorage.setItem('waypoint-now', '2027-06-08T10:20:00'); } catch (e) {} } });
  await exampleTrip(p2); await settle(p2, 4000);
  const ck = await p2.evaluate(async () => {
    W.S.prepTab = 'tobook'; W.goView('book'); W.render(); await new Promise(r => setTimeout(r, 700));
    const L = W.checklist(W.P), past = L.filter(c => c.past);
    const g = [...document.querySelectorAll('#viewBook .chk-group')].map(x => ({ t: x.querySelector('.gl').textContent, n: x.querySelector('.gn').textContent, shut: x.classList.contains('shut') }));
    const tabN = +((document.querySelector('[data-prep="tobook"] .gn') || {}).textContent || 0), ready = (document.querySelector('.ready') || {}).textContent || '';
    W.S.day = 2; W.S.tview = 'days'; W.goView('trip'); W.render(); await new Promise(r => setTimeout(r, 500));
    const today = [...document.querySelectorAll('#viewTrip .gt.due')].map(t => t.textContent);
    W.S.day = 1; W.render(); await new Promise(r => setTimeout(r, 400));
    const day1 = [...document.querySelectorAll('#viewTrip .gt.due')].map(t => t.textContent);
    return { past: past.map(c => c.short || c.title), flight: past.some(c => c.key === 'flight|out'), left: L.filter(W.leftToBook).length, g, tabN, ready, today, day1, text: W.bookByText(past[0]) };
  });
  const pg2 = ck.g.find(x => /Did you book these/.test(x.t));
  t.ok(ck.flight && pg2 && pg2.shut && new RegExp('^' + ck.past.length + ' to check').test(pg2.n) && ck.text === 'Did you book it?', 'on Day 2 the flight and what Day 1 needed ask "Did you book it?", in their own folded group: ' + JSON.stringify({ past: ck.past, group: pg2 }));
  t.ok(ck.tabN === ck.left && new RegExp(ck.left + ' to book').test(ck.ready), 'they are out of the count and of how ready you are: ' + JSON.stringify({ tab: ck.tabN, left: ck.left, ready: ck.ready }));
  t.ok(ck.today.length && ck.today.every(x => !/ by /i.test(x) || !/May|Apr|Jun/.test(x)) && ck.day1.length === 0, 'no deadline that has gone by shows as a date ("Book now" today), and a day gone by shows none: ' + JSON.stringify({ today: ck.today, day1: ck.day1 }));
  t.eq(e2(), [], 'no page errors on the trip either');
  await c2.close(); await b.close();
};
