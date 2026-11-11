/* Pack and prepare: the lists come from the plan — toddlers bring the stroller and nap kit, grandparents their own
   bag, a flight brings the carry-on rule, beach days bring swim things; ticks, removals and your own items stay with
   the trip; the grandparents' view narrows the list; the planner is not re-run for a tick. */
const { launch, open, exampleTrip, settle, calm } = require('../lib/page');
const SPAIN = [['Madrid', 40.4168, -3.7038], ['Toledo', 39.8628, -4.0273], ['Malaga', 36.7213, -4.4214], ['Granada', 37.1773, -3.5986], ['Seville', 37.3891, -5.9845], ['Barcelona', 41.3874, 2.1686]];
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, tz: 'America/Los_Angeles' }); await exampleTrip(pg);

  /* the example trip: two adults, two kids (6 and 3), flying in */
  const ex = await pg.evaluate(() => { const L = W.packing(W.P); const txt = l => l.map(i => i.text).join(' | '); return { pack: txt(L.pack), todo: txt(L.todo), n: L.pack.length, nt: L.todo.length, kids: L.pack.filter(i => i.who === 'kids').length, gp: L.pack.filter(i => i.who === 'grandparents').length, f: { toddlers: L.facts.toddlers, flight: L.facts.flight, abroad: L.facts.abroad, plugs: L.facts.plugs } }; });
  t.ok(ex.f.toddlers === 1 && ex.f.flight && ex.f.abroad, `the facts read the trip (toddlers ${ex.f.toddlers}, flight ${ex.f.flight}, abroad ${ex.f.abroad})`);
  t.ok(/stroller/i.test(ex.pack) && /Nap kit/.test(ex.pack), 'a toddler brings the stroller and the nap kit');
  t.ok(/Passports/.test(ex.pack) && /Carry-on/.test(ex.pack), 'abroad by plane: passports and the carry-on rule');
  t.ok(/Plug adapters \(type C\/F\/L\)/.test(ex.pack), `Italy's plugs are named (${(ex.pack.match(/Plug adapters[^|]*/) || [''])[0]})`);
  t.eq(ex.gp, 0, 'no grandparents, no grandparents\' items');
  t.ok(/cot\/crib/.test(ex.todo) && /offline/.test(ex.todo), 'before you go: ask for a crib, save the trip offline');
  t.ok(ex.n >= 15 && ex.n <= 45 && ex.nt >= 6, `a usable length (${ex.n} to pack, ${ex.nt} to do)`);

  /* Bookings shows it; a tick sticks and does not re-plan; remove and add work */
  const ui = await pg.evaluate(() => {
    W.setView('book'); W.S.prepTab = 'pack'; W.render();
    const sec = document.querySelector('.pk-card'); const first = sec && sec.querySelector('[data-pack]'); const key = first && first.getAttribute('data-pack');
    const P0 = W.plan(); first.click(); const P1 = W.plan();
    const after = document.querySelector('[data-pack="' + key + '"]');
    const n0 = document.querySelectorAll('.pk-list .chk').length;
    const hideKey = document.querySelectorAll('[data-packhide]')[1].getAttribute('data-packhide'); document.querySelector('[data-packhide="' + hideKey + '"]').click();
    const n1 = document.querySelectorAll('.pk-list .chk').length;
    document.getElementById('pkNew').value = 'Grandma\'s travel pillow'; document.querySelector('[data-packadd]').click();
    const n2 = document.querySelectorAll('.pk-list .chk').length, has = [...document.querySelectorAll('.pk-list .chk b')].some(e => /travel pillow/.test(e.textContent));
    document.querySelector('[data-packtab="todo"]').click(); const todoRows = document.querySelectorAll('.pk-list .chk').length, top = document.querySelector('.pk-card .bk-h p').textContent;
    document.querySelector('[data-packtab="pack"]').click();
    return { shown: !!sec, ticked: after && after.getAttribute('aria-pressed') === 'true', samePlan: P0 === P1, saved: !!W.S.pack[key], n0, n1, n2, has, own: (W.S.packOwn || []).length, hidden: Object.keys(W.S.packHide || {}).length, todoRows, top };
  });
  t.ok(ui.shown, 'Bookings has the Pack and prepare card');
  t.ok(ui.ticked && ui.saved, 'a tick sticks and is saved with the trip');
  t.ok(ui.samePlan, 'ticking an item does not re-plan the trip');
  t.ok(ui.n1 === ui.n0 - 1 && ui.hidden === 1, 'an item can be removed');
  t.ok(ui.n2 === ui.n1 + 1 && ui.has && ui.own === 1, 'your own item joins the list');
  t.ok(ui.todoRows >= 6 && /done · built from your plan/.test(ui.top), `the Before-you-go tab lists the to-dos (${ui.todoRows})`);

  /* Spain with toddlers and grandparents: grandparents get their own bag, trains show up */
  await pg.evaluate(SP => {
    W.isExample = false;
    W.C.country.Spain = { cities: SP.filter(c => !W.findCity('Spain', c[0])).map(c => ({ name: c[0], lat: c[1], lng: c[2], w: 2, pop: 3, t: ['culture', 'family'], d: c[0] })) };
    Object.assign(W.S, { styles: ['culture', 'food', 'beach'], travelers: [36, 34, 4, 2, 68, 66], depart: 'Los Angeles', start: '2027-05-10', days: 17, cityDays: {}, picks: {}, seen: {}, mine: {}, legPick: {}, fold: {}, rest: {}, day: 1, tview: 'days', pack: {}, packHide: {}, packOwn: [],
      countries: [{ name: 'Spain', mode: 'manual', picked: ['Madrid', 'Toledo', 'Malaga', 'Granada', 'Seville', 'Barcelona'] }] });
    W.setView('trip'); W.render();
  }, SPAIN);
  await calm(pg, 13000);
  const sp = await pg.evaluate(() => {
    const L = W.packing(W.P), f = L.facts; W.setView('book'); W.S.prepTab = 'pack'; W.render();
    document.querySelector('[data-packwho="grandparents"]').click();
    const rows = [...document.querySelectorAll('.pk-list .chk b')].map(e => e.textContent);
    return { seniors: f.seniors, toddlers: f.toddlers, trains: f.train.length, moves: f.moves, gp: L.pack.filter(i => i.who === 'grandparents').map(i => i.text), rows, kidsInGpView: rows.filter(r => /^Lightweight stroller|Nap kit|Swim diapers/.test(r)).length, euroCash: L.todo.some(i => /euros/.test(i.text)), letter: L.todo.some(i => /signed letter/.test(i.text)), cubes: L.pack.some(i => /Packing cubes/.test(i.text)) };
  });
  t.ok(sp.seniors === 2 && sp.toddlers === 2, `Spain facts: ${sp.seniors} grandparents, ${sp.toddlers} toddlers, ${sp.trains} train legs, ${sp.moves} moves`);
  t.ok(sp.gp.length >= 4 && /medications/i.test(sp.gp.join(' ')), 'grandparents get their own items, medications first');
  t.ok(sp.rows.length > 0 && sp.kidsInGpView === 0, 'the grandparents\' bag view leaves the kids\' things out');
  t.ok(sp.euroCash && sp.letter, 'euros for Spain, and the letter for grandparents travelling with the kids');
  t.ok(sp.cubes === sp.moves >= 3, `packing cubes only with 3+ hotel moves (${sp.moves})`);

  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
