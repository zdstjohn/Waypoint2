/* Must-sees, Best of both or Hidden gems: the three choices sit above the interests (Must-sees by default); each one
   steers which places the days get (the famous first, the local favorites first, or both in turn); a poorly reviewed
   place falls away whatever the choice; stop cards say "Must-see" or "Hidden gem"; the idea requests lean the same way,
   and lists from before are rated once. */
const { launch, open, exampleTrip, settle } = require('../lib/page');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844 }); await exampleTrip(pg);

  /* the choice, in Plan */
  const ui = await pg.evaluate(() => {
    W.S.stepClosed = { style: false }; W.setView('setup'); W.render();
    const opts = [...document.querySelectorAll('.focus [data-focus]')].map(x => [x.dataset.focus, x.querySelector('b').textContent, x.getAttribute('aria-checked')]);
    const before = document.querySelector('.focus'), chips = document.querySelector('[data-fold="step-style"] .chips');
    return { opts, above: !!(before && chips && (before.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING)), stored: W.S.focus, note: document.querySelector('.focus-note').textContent };
  });
  t.eq(ui.opts.map(o => o[1]), ['Must-sees', 'Best of both', 'Hidden gems'], 'three choices: Must-sees, Best of both, Hidden gems');
  t.ok(ui.opts[0][2] === 'true' && ui.stored === undefined && ui.above, 'Must-sees is the default, and the choice sits above the interests');

  /* rate one city's places: half famous, half hidden gems, all well reviewed except one famous place */
  const city = await pg.evaluate(() => {
    const s = W.P.stops[0], pool = W.pool(s.country, s.name);
    pool.spots.forEach((x, i) => { x.fame = i % 2 ? 0 : 2; x.rating = 4.6; });
    pool.spots[0].rating = 3.4; pool.cityLow = pool.spots[0].n;
    return { country: s.country, name: s.name, low: pool.spots[0].n, n: pool.spots.length };
  });
  const count = () => pg.evaluate(c => {
    const P = W.plan(), pool = W.pool(c.country, c.name), by = {}; pool.spots.forEach(x => by[x.n] = x);
    let icon = 0, gem = 0, low = 0;
    P.days.filter(d => d.city === c.name).forEach(d => (d.slots || []).forEach(x => { if (!x.item || W.isFood(x.slot) || !by[x.item.n]) return; if (x.item.n === c.low) low++; if (by[x.item.n].fame === 2) icon++; else if (by[x.item.n].fame === 0) gem++; }));
    return { icon, gem, low };
  }, city);
  const pick = async f => { await pg.evaluate(f => { W.setView('setup'); W.render(); document.querySelector('[data-focus="' + f + '"]').click(); W.replan && W.replan(); }, f); await pg.waitForTimeout(300); return count(); };

  const icons = await pick('icons'), gems = await pick('gems'), both = await pick('both');
  t.ok(icons.icon > icons.gem, `Must-sees: the famous places lead (${icons.icon} famous, ${icons.gem} hidden)`);
  t.ok(gems.gem > gems.icon, `Hidden gems: the local favorites lead (${gems.gem} hidden, ${gems.icon} famous)`);
  t.ok(both.icon >= 1 && both.gem >= 1 && Math.abs(both.icon - both.gem) <= Math.max(2, (both.icon + both.gem) * 0.4), `Best of both: some of each (${both.icon} famous, ${both.gem} hidden)`);
  t.note(`famous/hidden picks — Must-sees ${icons.icon}/${icons.gem}, Hidden gems ${gems.icon}/${gems.gem}, Best of both ${both.icon}/${both.gem}`);
  t.eq(icons.low + gems.low + both.low, 0, 'a poorly reviewed place is left out whatever the choice');
  t.eq(await pg.evaluate(() => W.S.focus), 'both', 'the choice is saved with the trip');
  const kept = await pg.evaluate(c => {
    const d = W.P.days.find(d => d.city === c.name), x = d.slots.find(y => y.item && !W.isFood(y.slot));
    W.S.mine[x.key] = 1; W.S.picks[x.key] = x.item.n; const n = x.item.n;
    W.setView('setup'); W.render(); document.querySelector('[data-focus="gems"]').click(); W.replan && W.replan();
    const again = W.plan().days.find(e => e.n === d.n).slots.find(y => y.key === x.key);
    document.querySelector('[data-focus="both"]').click();
    return again && again.item && again.item.n === n;
  }, city);
  t.ok(kept, 'a stop you chose yourself stays when the choice changes');

  /* stop cards say which is which */
  const tags = await pg.evaluate(c => { W.S.day = W.P.days.find(d => d.city === c.name).n; W.S.tview = 'days'; W.setView('trip'); W.render(); return [...document.querySelectorAll('#viewTrip .gt.must, #viewTrip .gt.gem')].map(e => e.textContent); }, city);
  t.ok(tags.includes('Must-see') || tags.includes('Hidden gem'), `stop cards are tagged (${[...new Set(tags)].join(', ')})`);

  /* the idea requests lean with the choice; a city whose list predates the ratings is rated once */
  const asks = await pg.evaluate(c => {
    W.S.focus = 'gems';
    const other = W.P.stops.find(s => s.name !== c.name), op = other && W.pool(other.country, other.name);
    if (op) { op.fameAsked = 0; (op.spots || []).forEach(x => { delete x.fame; }); W.loadFame(other.country, other.name); }
    const full = window.__full || [];
    return { fame: !op || full.some(p => /^Rate how essential each of these places/.test(p)), lean: W.focusAsk() };
  }, city);
  t.ok(/hidden gems/.test(asks.lean), 'Hidden gems leans every request for ideas that way');
  t.ok(asks.fame, 'a list from before the ratings is rated once');
  await settle(pg, 4000);
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
