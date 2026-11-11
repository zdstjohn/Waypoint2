/* "Not for us" and the day bag.
   Not for us: a thumbs-down on a stop (swap panel, swap cards, the longer list, Explore, the stop's menu) takes the place
   off the plan, a new suggestion fills its slot, and it is never planned or offered again in that city; Undo and
   "Bring back" undo it; putting it on a day by hand takes it off the list; a co-planner's "not for us" reads in words.
   Day bag: Today lists what to take out for the day, read off its stops (a beach, a church, a market, a travel day),
   each line saying which stop asked; ticks are kept with the trip; while the trip is on, the screen is kept on (the wake
   lock is asked for on Today, let go elsewhere or when switched off). */
const { launch, open, exampleTrip } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg);
  const cityNames = () => pg.evaluate(() => { const d = W.P.days[W.S.day - 1]; return W.P.days.filter(x => x.city === d.city).reduce((a, x) => a.concat((x.slots || []).filter(y => y.item).map(y => y.item.n)), []); });

  /* 1. the swap panel: "Not for us" on the morning's stop */
  const am0 = await pg.evaluate(() => { const d = W.P.days[W.S.day - 1], x = d.slots.find(y => y.slot === 'am'); return x.item.n; });
  await pg.click('#viewTrip [data-reroll="am"]'); await pg.waitForTimeout(500);
  await pg.click('#viewTrip .swap .sw-no'); await pg.waitForTimeout(700);
  const r1 = await pg.evaluate(name => {
    const d = W.P.days[W.S.day - 1], x = d.slots.find(y => y.slot === 'am');
    return { now: x.item && x.item.n, nope: Object.values(W.S.nope || {}), opts: W.slotOptions(d, 'am', W.P).map(o => o.it.n).includes(name), undo: (document.querySelector('#undohost .undo') || {}).textContent || '' };
  }, am0);
  t.ok(r1.now && r1.now !== am0, `the morning gets a new suggestion (${am0} → ${r1.now})`);
  t.eq(r1.nope, [am0], 'and the place goes on the "not for us" list');
  t.ok(!(await cityNames()).includes(am0), 'it is nowhere on the plan in that city');
  t.ok(!r1.opts, 'and never offered among the options');
  t.ok(/won't suggest it again/.test(r1.undo), 'with an Undo: ' + r1.undo.replace(/\s+/g, ' '));
  await pg.click('#undohost [data-undo]'); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(name => !Object.keys(W.S.nope || {}).length && W.P.days[W.S.day - 1].slots.find(y => y.slot === 'am').item.n === name, am0), 'Undo puts it back');

  /* 2. a swap card's thumbs-down, and one in the longer list */
  await pg.evaluate(() => { if (!document.querySelector('#viewTrip .swap')) document.querySelector('#viewTrip [data-reroll="am"]').click(); }); await pg.waitForTimeout(500);
  const c1 = await pg.evaluate(() => { const b = document.querySelector('#viewTrip .swap .sc-no'); return b && b.dataset.name; });
  t.ok(!!c1, 'each swap card has a thumbs-down');
  await pg.click('#viewTrip .swap .sc-no'); await pg.waitForTimeout(600);
  const r2 = await pg.evaluate(name => ({ cards: [...document.querySelectorAll('#viewTrip .swap .scard')].map(c => c.dataset.name), open: !!document.querySelector('#viewTrip .swap'), nope: Object.values(W.S.nope || {}) }), c1);
  t.ok(r2.open && !r2.cards.includes(c1) && r2.nope.includes(c1), 'the card goes, the panel stays open, and the place is on the list');
  const o1 = await pg.evaluate(() => { const b = document.querySelector('#viewTrip .swap .op-no'); return b && b.dataset.name; });
  if (o1) { await pg.click('#viewTrip .swap .op-no'); await pg.waitForTimeout(500); }
  t.ok(!o1 || await pg.evaluate(name => ![...document.querySelectorAll('#viewTrip .swap .opt')].some(o => o.dataset.name === name), o1), 'the longer list has one too');

  /* 3. the stop's menu */
  const pm0 = await pg.evaluate(() => { const d = W.P.days[W.S.day - 1], x = d.slots.find(y => y.slot === 'pm' && y.item); W.openStop(x.key); return x.item.n; });
  await pg.waitForTimeout(300);
  /* it is behind "⋯", away from Directions and Swap, says what it does, and asks once */
  t.ok(await pg.evaluate(() => !document.querySelector('#sheethost [data-sheetact="nope"]') && !!document.querySelector('#sheethost .sh-main [data-sheetact="more"]')), 'a stop\'s sheet keeps "Not for us" out of the way, behind "⋯"');
  await pg.click('#sheethost [data-sheetact="more"]'); await pg.waitForTimeout(250);
  t.ok(await pg.evaluate(() => { const n = document.querySelector('#sheethost .sh-menu [data-sheetact="nope"]'); return !!n && /never suggest it/.test(n.textContent) && n === n.parentNode.lastElementChild; }), 'there it is the last row, and says what it does');
  await pg.click('#sheethost [data-sheetact="nope"]'); await pg.waitForTimeout(300);
  t.ok(await pg.evaluate(name => { const x = W.P.days[W.S.day - 1].slots.find(y => y.slot === 'pm'); return x.item && x.item.n === name && /won't be suggested/.test((document.querySelector('#sheethost .sh-out.ask') || {}).textContent || ''); }, pm0), 'one tap only asks (nothing is taken off yet)');
  await pg.click('#sheethost [data-sheetact="nopeno"]'); await pg.waitForTimeout(300);
  t.ok(await pg.evaluate(() => !document.querySelector('#sheethost .sh-out.ask') && !!document.querySelector('#sheethost [data-sheetact="nope"]')), '"Keep it" takes the question back');
  await pg.click('#sheethost [data-sheetact="nope"]'); await pg.waitForTimeout(300);
  await pg.click('#sheethost [data-sheetact="nopeyes"]'); await pg.waitForTimeout(600);
  t.ok(await pg.evaluate(name => { const x = W.P.days[W.S.day - 1].slots.find(y => y.slot === 'pm'); return !!x.item && x.item.n !== name && !document.querySelector('#sheethost .sheet'); }, pm0), 'and "Yes, not for us" swaps it out and closes');

  /* 4. Explore: hidden from the ideas, listed at the end with a way back */
  await pg.evaluate(() => { W.S.tview = 'map'; W.render(); }); await pg.waitForTimeout(600);
  const r4 = await pg.evaluate(name => {
    const names = [...document.querySelectorAll('#viewTrip .idea h4')].map(h => h.textContent), l = document.querySelector('#viewTrip .nope-l');
    return { shown: names.includes(name), list: l ? [...l.querySelectorAll('li span')].map(s => s.textContent) : [], btn: !!document.querySelector('#viewTrip .idea [data-nope], #viewTrip .idea .id-no') };
  }, pm0);
  t.ok(!r4.shown && r4.list.includes(pm0) && !r4.btn, 'Explore leaves it out and lists it under "Not for us"; the idea cards themselves have no such button (v118): ' + JSON.stringify(r4.list));
  await pg.evaluate(() => { document.querySelector('#viewTrip .nope-l').open = true; });
  const back = await pg.evaluate(name => { const li = [...document.querySelectorAll('#viewTrip .nope-l li')].find(l => l.textContent.includes(name)); li.querySelector('[data-unnope]').click(); return true; }, pm0);
  await pg.waitForTimeout(500);
  t.ok(back && await pg.evaluate(name => !Object.values(W.S.nope || {}).includes(name), pm0), '"Bring back" takes it off the list');

  /* 5. putting one on a day by hand takes it off the list; a co-planner's change in words */
  const r5 = await pg.evaluate(name => {
    const d = W.P.days[W.S.day - 1], pool = W.pool(d.country, d.city), it = pool.spots.find(s => s.n === name);
    W.sayNo(d.country, d.city, it, W.P); W.changed(); const was = W.isNope(d.country, d.city, it);
    W.useIdea(W.P.days[W.S.day - 1], 'am', name, W.P); W.changed();
    return { was, now: W.isNope(d.country, d.city, it), on: W.P.days[W.S.day - 1].slots.find(y => y.slot === 'am').item.n === name, words: W.coDescribe('nope', d.country + '|' + d.city + '|s:x', name) };
  }, am0);
  t.ok(r5.was && !r5.now && r5.on, 'choosing a "not for us" place yourself puts it on the day and takes it off the list');
  t.eq(r5.words, 'said no to ' + am0, 'planning together says it in words');
  await pg.evaluate(() => { W.S.tview = 'days'; W.render(); });

  /* 6. the day bag, read off the day's stops */
  const bag = await pg.evaluate(() => {
    const day = { n: 3, country: 'Greece', city: 'Chania', dayInCity: 1, stop: 0, slots: [
      { slot: 'am', key: 'k1', item: { n: 'Elafonissi Beach', d: 'Pink sand and shallow lagoons', t: ['beach'], k: 1, s: 'am', dur: '3h', ticket: '', book: '', pic: 'beach' } },
      { slot: 'lunch', key: 'k2', item: { n: 'Agora Market Stalls', d: 'Street food at the covered market', cuisine: 'street food', price: '€', meal: 'lunch', k: 1, pic: 'streetfood' } },
      { slot: 'pm', key: 'k3', item: { n: 'Metropolitan Cathedral', d: 'The city\'s cathedral', t: ['culture'], k: 0, s: 'pm', dur: '45m', ticket: '', book: '', pic: 'church' } }
    ] };
    const travel = { n: 4, country: 'Greece', city: 'Naxos', dayInCity: 1, stop: 1, moveFrom: 'Chania', slots: [] };
    return { day: W.dayBag(day, W.P), travel: W.dayBag(travel, W.P).map(o => o.id) };
  });
  const ids = bag.day.map(o => o.id), why = Object.fromEntries(bag.day.map(o => [o.id, o.why]));
  t.ok(['swim', 'sun', 'cover', 'cash'].every(i => ids.includes(i)), 'a beach, a cathedral and a market ask for swimsuits, sunscreen, covered shoulders and cash: ' + ids.join(', '));
  t.ok(/Elafonissi/.test(why.swim) && /Cathedral/.test(why.cover) && /Agora/.test(why.cash), 'each line says which stop asked for it');
  t.ok(['docs', 'snacks'].every(i => bag.travel.includes(i)), 'a travel day asks for tickets in one pocket and snacks: ' + bag.travel.join(', '));

  /* 7. on Today: tick, kept with the trip; the screen kept on while the trip is on */
  await pg.evaluate(() => {
    window.__wl = { req: 0, rel: 0 };
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: () => { __wl.req++; const l = new EventTarget(); l.release = () => { __wl.rel++; l.dispatchEvent(new Event('release')); return Promise.resolve(); }; return Promise.resolve(l); } } });
    try { localStorage.removeItem('waypoint-awake'); } catch (e) {}
    localStorage.setItem('waypoint-now', '2027-06-08T09:00'); W.needLater(); W.goView('go');
  });
  await pg.waitForFunction(() => !!document.querySelector('#viewGo .go-bag'), null, { timeout: 15000 }).catch(() => {});
  const g = await pg.evaluate(() => ({ items: document.querySelectorAll('#viewGo .gb-i').length, sw: !!document.querySelector('#viewGo [data-awake]'), head: (document.querySelector('#viewGo .gb-h .muted') || {}).textContent }));
  t.ok(g.items > 0 && /0 of/.test(g.head || ''), 'Today shows the day bag: ' + g.items + ' things, ' + g.head);
  if (g.items) {
    /* (once the first stop has begun the bag is one line, "0 of 5 packed": a tap opens it) */
    const folded = await pg.evaluate(() => { const d = document.querySelector('#viewGo details[data-gofold="bag"]'); if (d && !d.open) { d.querySelector('summary').click(); return true; } return false; });
    if (folded) await pg.waitForTimeout(300);
    await pg.click('#viewGo .gb-i'); await pg.waitForTimeout(400);
    const tk = await pg.evaluate(() => ({ on: document.querySelector('#viewGo .gb-i').getAttribute('aria-pressed'), saved: JSON.stringify(W.S.bag), head: document.querySelector('#viewGo .gb-h .muted').textContent }));
    t.ok(tk.on === 'true' && /"Italy\|Rome\|2":\{/.test(tk.saved) && /1 of/.test(tk.head), 'a tick is kept with the trip: ' + tk.saved);
  }
  await pg.waitForTimeout(300);
  t.ok(g.sw && await pg.evaluate(() => __wl.req >= 1), 'while the trip is on, Today asks to keep the screen on, with a switch');
  await pg.click('#viewGo [data-awake]'); await pg.waitForTimeout(400);
  t.ok(await pg.evaluate(() => __wl.rel >= 1 && document.querySelector('#viewGo [data-awake]').getAttribute('aria-checked') === 'false'), 'switching it off lets the screen sleep');
  await pg.click('#viewGo [data-awake]'); await pg.waitForTimeout(400);
  const req2 = await pg.evaluate(() => __wl.req);
  await pg.evaluate(() => W.goView('trip')); await pg.waitForTimeout(5600);
  t.ok(await pg.evaluate(n => __wl.req === n && __wl.rel >= 2, req2), 'and leaving Today lets it go');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
