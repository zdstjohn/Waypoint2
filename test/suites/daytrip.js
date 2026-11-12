/* A day trip day (v152): "Make it a day trip" at the end of a full day in a place opens a choice of the places an
   easy day out from it, and a box for anywhere else. Picking one drops the planner's picks for that day (yours stay)
   and plans it again there: the morning, lunch and afternoon from the place's ideas, the evening back near the stay.
   Undo, or "Undo day trip", gives the day back. Not on the arrival or packing day, nor on a rest day. */
const { launch, open, exampleTrip, settle } = require('../lib/page');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844 }); await exampleTrip(pg); await settle(pg, 4000);
  /* towns an easy day out from Rome, in Italy's list (the test list has none) */
  await pg.evaluate(() => { const C = W.C.country.Italy, I = (name, lat, lng, pop, d) => ({ name, region: 'Lazio', lat, lng, pop, w: 1, t: ['culture'], d });
    C.cities = C.cities.concat([I('Tivoli', 41.963, 12.798, 4, "Hadrian's villa and the fountains of Villa d'Este"), I('Ostia Antica', 41.756, 12.292, 4, 'A Roman port town in ruins'), I('Bracciano', 42.103, 12.176, 3, 'A lake and a castle')]); W.dataV++; W.replan(); });
  const go = n => pg.evaluate(async n => { W.S.tview = 'days'; W.S.day = n; W.goView('trip'); W.render(); await new Promise(r => setTimeout(r, 300)); }, n);
  const look = n => pg.evaluate(n => { const d = W.plan().days[n - 1], l = document.querySelector('[data-daytrip="' + n + '"]');
    return { link: l ? l.textContent : null, trip: d.trip ? { name: d.trip.name, mine: !!d.trip.mine } : null, head: (document.querySelector('.day-h') || {}).textContent || '',
      tripSlots: d.slots.filter(x => x.trip).map(x => x.slot), stored: Object.keys(W.S.dayTrip || {}).length, sheet: !!document.querySelector('#dthost .sheet') }; }, n);
  /* the arrival and packing days have no such link */
  await go(1); const first = await look(1);
  const N = await pg.evaluate(() => W.plan().days.length); await go(N); const last = await look(N);
  t.ok(first.link === null && last.link === null, 'no day trip on the arrival or the packing day');
  /* a full day in Rome */
  const n = await pg.evaluate(() => { const P = W.plan(); const d = P.days.find(d => d.city === P.days[0].city && !d.tripFirst && !d.tripLast && !d.moveFrom && !d.trip); return d ? d.n : 0; });
  t.ok(n > 0, 'there is a full day in the first city without a day trip (Day ' + n + ')');
  await go(n); const d0 = await look(n);
  t.eq(d0.link, 'Make it a day trip', 'at the end of the day, next to "Make it a rest day": "Make it a day trip"');
  const minePick = await pg.evaluate(n => { const d = W.plan().days[n - 1], x = d.slots.find(x => x.slot === 'eve' && x.item); if (!x) return null; (W.S.mine = W.S.mine || {})[x.key] = 1; W.changed(); return { key: x.key, id: W.S.picks[x.key] }; }, n);
  const before = await pg.evaluate(n => W.plan().days[n - 1].slots.filter(x => x.slot === 'am' || x.slot === 'pm').map(x => x.item && x.item.n), n);
  await pg.click('[data-daytrip="' + n + '"]'); await pg.waitForSelector('#dthost .sheet', { timeout: 15000 });
  const sh = await pg.evaluate(() => { const s = document.querySelector('#dthost .sheet'); return { label: s.getAttribute('aria-label'), rows: [...s.querySelectorAll('[data-dtpick]')].map(r => r.querySelector('b').textContent),
    rowText: (s.querySelector('[data-dtpick]') || {}).textContent || '', box: !!s.querySelector('#dtIn[data-ta="city"]'), modal: document.documentElement.classList.contains('modal-open') }; });
  t.ok(/^A day trip from /.test(sh.label) && sh.box && sh.modal, 'the choice opens as a sheet, with a box for anywhere else: ' + sh.label);
  t.ok(sh.rows.length >= 1 && /each way/.test(sh.rowText), 'it lists places an easy day out, each with about how long it takes: ' + sh.rows.join(', ') + ' · ' + sh.rowText);
  /* Escape closes it, and nothing changed */
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  t.ok(await pg.evaluate(() => !document.querySelector('#dthost .sheet') && !(W.S.dayTrip && Object.keys(W.S.dayTrip).length)), 'Escape closes it without changing the day');
  /* somewhere else, typed */
  await pg.click('[data-daytrip="' + n + '"]'); await pg.waitForSelector('#dtIn');
  await pg.fill('#dtIn', 'Tivoli'); await pg.click('#dtGo'); await settle(pg, 3000); await pg.waitForTimeout(500);
  const d1 = await look(n);
  t.ok(d1.trip && d1.trip.name === 'Tivoli' && d1.trip.mine && !d1.sheet && d1.stored === 1, 'typing "Tivoli" makes Day ' + n + ' a day trip there: ' + JSON.stringify(d1.trip));
  t.ok(/Day trip to Tivoli/.test(d1.head), 'the day says so at the top');
  t.eq(d1.tripSlots, ['am', 'lunch', 'pm'], 'the morning, lunch and afternoon are planned there (the evening back near the stay)');
  t.eq(d1.link, 'Undo day trip', 'and the link now reads "Undo day trip"');
  const after = await pg.evaluate(n => W.plan().days[n - 1].slots.filter(x => x.slot === 'am' || x.slot === 'pm').map(x => x.item && x.item.n), n);
  t.ok(before.every((nm, i) => !nm || nm !== after[i]), 'the earlier suggestions for that day are gone: ' + JSON.stringify(before) + ' -> ' + JSON.stringify(after));
  if (minePick) t.ok(await pg.evaluate(k => !!W.S.picks[k.key] && W.S.picks[k.key] === k.id, minePick), 'a place you chose for that day stays');
  t.ok(await pg.evaluate(() => !!document.querySelector('.undo-bar, .toast, [data-undo]')), 'Undo is offered at once');
  /* the planner's own day trips keep off it */
  t.ok(await pg.evaluate(n => W.plan().days.filter(d => d.trip && d.trip.mine).length === 1 && W.plan().days[n - 1].trip.name === 'Tivoli', n), 'the planner does not put its own day trip on that day');
  /* Undo day trip */
  await pg.click('[data-daytrip="' + n + '"]'); await settle(pg, 2000);
  const d2 = await look(n);
  t.ok(d2.stored === 0 && !(d2.trip && d2.trip.mine) && !/Day trip to Tivoli/.test(d2.head) && !d2.sheet, '"Undo day trip" gives the day back: ' + JSON.stringify(d2.trip));
  /* one from the list */
  if (sh.rows.length) {
    await pg.click('[data-daytrip="' + n + '"]'); await pg.waitForSelector('[data-dtpick="0"]'); await pg.click('[data-dtpick="0"]'); await settle(pg, 2000);
    const d3 = await look(n);
    t.ok(d3.trip && d3.trip.name === sh.rows[0], 'picking "' + sh.rows[0] + '" from the list works too');
    await pg.click('[data-daytrip="' + n + '"]'); await settle(pg, 1000);
  }
  /* a rest day is not a day out */
  await pg.click('[data-rest]'); await pg.waitForTimeout(300);
  const d4 = await look(n);
  t.ok(d4.link === null && /Undo rest day/.test(await pg.evaluate(() => document.querySelector('[data-rest]').textContent)), 'a rest day offers no day trip');
  await pg.click('[data-rest]'); await pg.waitForTimeout(300);
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
