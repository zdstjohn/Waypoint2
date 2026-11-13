/* Where to stay (the stay panel in Plan, and the same panel as a sheet from "Pick a place"): a stay you booked
   already, and the places to pick from (no links to other booking sites since v177). v175 (you asked for it): the places come from Booking.com when
   it can answer, real ones for your nights and your group with their prices, in the same three tiers by price a night,
   best rated first; Claude's picks when it can't (no connection here, no dates, nothing free, or an error, which says
   so with another try). Still no search box in it (gone since v152). */
const { launch, open, exampleTrip, settle } = require('../lib/page');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844 }); await exampleTrip(pg);
  await pg.evaluate(() => { W.S.travelers = [38, 36, 7, 4]; W.goView('setup'); W.render(); }); await settle(pg, 3000);
  await pg.evaluate(() => { window.__mcp.length = 0; window.__prompts.length = 0; (W.S.stepClosed = W.S.stepClosed || {}).where = false; W.render(); document.querySelector('[data-openstay="0"]').click(); });
  const live = () => pg.waitForFunction(() => !!document.querySelector('.stay-panel .lodge-bk'), null, { timeout: 8000 }).catch(() => {});
  await live();
  const read = () => pg.evaluate(() => { const p = document.querySelector('.stay-panel'), s = W.P.stops[0], dt = W.stayDates(s, W.P);
    const cards = [...p.querySelectorAll('.lodge')].map(c => ({ tier: (c.querySelector('.tier') || {}).textContent, n: (c.querySelector('h4') || {}).textContent || '', bk: c.classList.contains('lodge-bk'),
      price: (c.querySelector('.lprice') || {}).textContent || '', book: (c.querySelector('a[href*="booking.com"]') || {}).href || '', reroll: !!c.querySelector('[data-lreroll]') }));
    return { cards, head: (p.querySelector('.lodges-h') || {}).textContent || '', note: (p.querySelector('.bk-note') || {}).textContent || '', nights: dt && dt.nights, s: s.name,
      search: !!p.querySelector('.sfind, [data-sfq], [data-sfgo]'), booked: !!p.querySelector('#stayIn0'), retry: !!p.querySelector('[data-bkretry]'),
      calls: window.__mcp.filter(c => c[1] === 'accommodations_search').map(c => c[2]), claude: window.__prompts.filter(x => /^Suggest places to stay/.test(x)).length }; });
  let r = await read();
  t.ok(!r.search && r.booked, 'no search box in the panel; "Already booked?" stays: ' + JSON.stringify({ search: r.search, booked: r.booked }));
  const mine = r.calls.filter(c => c.destination === r.s + ', Italy'), I = mine[0] || {};
  t.ok(mine.length === 1 && I.destination === r.s + ', Italy' && /^\d{4}-\d\d-\d\d$/.test(I.checkin_date) && I.number_of_adults === 2 && (I.children_ages || []).join() === '7,4',
    'opening it asks Booking.com once, for this town, your nights and the whole group: ' + JSON.stringify(I));
  const [bud, mid] = r.cards;
  t.ok(r.cards.filter(c => c.n).every(c => c.bk) && bud.n === 'Casa Familia ' + r.s && mid.n === 'Hotel Bambini' && !r.cards.some(c => /Sketchy|No price/.test(c.n)),
    "Booking.com's places, in tiers by price a night; one with no price or a page off Booking.com is left out: " + JSON.stringify(r.cards.map(c => [c.tier, c.n])));
  const want = await pg.evaluate(n => W.money(Math.round(912.4 / n), 'EUR'), r.nights);
  t.ok(bud.price.indexOf(want) === 0 && /\/ night/.test(bud.price) && /^https:\/\/www\.booking\.com\/hotel\//.test(bud.book),
    'each shows its price a night and books on its own Booking.com page: ' + JSON.stringify(bud));
  t.ok(/Booking\.com prices for your \d+ nights/.test(r.head) && r.claude === 0, "the heading says where they're from, and Claude isn't asked as well: " + JSON.stringify({ head: r.head, claude: r.claude }));

  /* staying at one: it becomes your stay, with its price for your nights (the budget) and what the price watch needs */
  await pg.evaluate(() => document.querySelector('.stay-panel .lodge-bk [data-lstay="budget"]').click()); await pg.waitForTimeout(400);
  const kept = await pg.evaluate(() => { const s = W.P.stops[0], ck = W.cityKey(s.country, s.name), st = W.S.stays[ck]; const I = W.stayInput(ck, W.P, st && st.label);
    return { label: st && st.label, live: st && st.live, watch: !!(I && I.input.hotel_names && I.input.hotel_names[0] === (st && st.label)) }; });
  t.ok(kept.live && kept.live.total === 912.4 && kept.live.src === 'Booking.com' && /booking\.com/.test(kept.live.url) && kept.watch,
    'Stay here keeps the place, its Booking.com price and page, and the price watch can follow it: ' + JSON.stringify(kept));

  /* more places: three a tier, a poorly rated one left out, a reroll for another in the same tier */
  const fresh = async (flags) => { await pg.evaluate(f => { Object.assign(window, f); W.C.live.stay = {}; const s = W.P.stops[0]; delete W.S.stays[W.cityKey(s.country, s.name)]; W.S.lodge = {}; W.S.lodgeSeen = {};
    window.__mcp.length = 0; window.__prompts.length = 0; W.render(); if (!document.querySelector('.stay-panel')) document.querySelector('[data-openstay="0"]').click(); }, flags); await pg.waitForTimeout(700); };
  await fresh({ __bkMore: 9 });
  r = await read();
  t.eq(r.cards.map(c => c.n), ['Stay 1 ' + r.s, 'Stay 4 ' + r.s, 'Stay 8 ' + r.s], 'many places: the best rated of the cheapest third, the middle and the dearest');
  await pg.evaluate(() => document.querySelector('.stay-panel [data-lreroll="budget"][data-lsrc="bk"]').click()); await pg.waitForTimeout(300);
  r = await read();
  t.ok(r.cards[0].n === 'Stay 3 ' + r.s && r.cards.every(c => c.reroll), 'another in Budget is the next best rated there (one with 4 reviews comes later): ' + JSON.stringify(r.cards.map(c => c.n)));
  const five = await pg.evaluate(() => [...Array(6)].map(() => { W.liveReroll(W.cityKey(W.P.stops[0].country, W.P.stops[0].name), 'mid'); return W.liveShown(W.cityKey(W.P.stops[0].country, W.P.stops[0].name), 'mid').n; }));
  t.ok(!five.some(n => /^Stay 5 /.test(n)), 'a place rated 6.1 by hundreds is not offered: ' + JSON.stringify(five));

  /* Booking.com fails: it says so, with another try, and Claude's picks are there meanwhile */
  await fresh({ __bkMore: 0, __mcpFail: { accommodations_search: 'server_not_connected' } });
  await pg.waitForFunction(() => /Connect Booking\.com/.test((document.querySelector('.stay-panel .bk-note') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  await pg.waitForFunction(() => !!document.querySelector('.stay-panel .lodge:not(.lodge-bk) h4'), null, { timeout: 8000 }).catch(() => {});
  r = await read();
  t.ok(/Connect Booking\.com in claude\.ai Settings/.test(r.note) && r.retry && r.claude >= 1 && r.cards.some(c => !c.bk && c.n), 'an error says what to do, offers another try, and shows Claude\'s picks: ' + JSON.stringify({ note: r.note, claude: r.claude, cards: r.cards.map(c => c.n) }));
  await pg.evaluate(() => { window.__mcpFail = null; document.querySelector('[data-bkretry]').click(); }); await live();
  r = await read();
  t.ok(r.cards[0].bk && r.cards[0].n === 'Casa Familia ' + r.s && !r.note, 'Try Booking.com again, and its places are back: ' + JSON.stringify(r.cards.map(c => c.n)));

  /* nothing free for your nights: said, and Claude's picks */
  await fresh({ __bkNone: true });
  r = await read();
  t.ok(/has nothing free in/.test(r.note) && r.cards.every(c => !c.bk), 'nothing on Booking.com: it says so and Claude\'s picks show: ' + JSON.stringify(r.note));
  await pg.evaluate(() => { window.__bkNone = false; });

  /* the same panel as a sheet, from another screen */
  await pg.evaluate(() => { W.C.live.stay = {}; W.goView('go'); W.render(); W.staySheet(0); }); await pg.waitForTimeout(800);
  t.ok(await pg.evaluate(() => !!document.querySelector('#stayhost .stay-panel .lodge-bk') && !document.querySelector('#stayhost .sfind')), 'the "Pick a place" sheet is the same panel, Booking.com places and no search');
  await pg.evaluate(() => { const c = document.querySelector('#stayhost [data-stayclose]'); if (c) c.click(); W.goView('setup'); W.render(); });

  /* where no connection answers (the installable app, a view without it): Claude's picks, nothing said */
  await pg.evaluate(() => { W.getMcp = () => Promise.resolve(null); }); await fresh({});
  await pg.waitForFunction(() => !!document.querySelector('.stay-panel .lodge:not(.lodge-bk) h4'), null, { timeout: 8000 }).catch(() => {});
  r = await read();
  t.ok(r.cards.length === 3 && r.cards.every(c => !c.bk && c.n) && !r.note, 'without a connection, Claude\'s picks as before and no note: ' + JSON.stringify({ cards: r.cards.map(c => c.n), note: r.note }));
  /* (v176) a Booking.com price counts only while it is for the nights you have */
  const sl = await pg.evaluate(() => { const s = W.P.stops[0], dt = W.stayDates(s, W.P);
    const ok = W.stayLive({ label: 'X', live: { total: 900, cur: 'EUR', url: '', at: 1, in: dt.in, out: dt.out, src: 'Booking.com' } }, s, W.P);
    const old = W.stayLive({ label: 'X', live: { total: 900, cur: 'EUR', url: '', at: 1, in: '2020-01-01', out: '2020-01-03', src: 'Booking.com' } }, s, W.P);
    return { ok: !!ok, old: !!old }; });
  t.ok(sl.ok && !sl.old, 'a Booking.com price for other nights no longer counts: ' + JSON.stringify(sl));
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
