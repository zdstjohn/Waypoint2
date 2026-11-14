/* Enough places to eat for the days. A town's first lists are sized by the stay, but a meal can still be left without a
   place: none is near that day's stops, the list has too few of that meal, the kitchens open too late for the children.
   After each planning the app counts the meals left empty (lib/plan.js mealGaps) and brings in places for exactly those
   (lib/ideas.js W.mealIdeas): the ones set aside first, then one question to Claude that names each meal and the stop it
   should be near. It asks at most three times per town, and never for a meal the clock cut or one you freed. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg); await settle(pg, 8000);
  const snap = stop => pg.evaluate(stop => { const P = W.plan(), s = P.stops[stop], ck = W.cityKey(s.country, s.name), c = W.C.city[ck], asks = (window.__foodAsks || []);
    const meals = []; P.days.filter(d => d.stop === stop).forEach(d => d.slots.forEach((x, i) => { if (!W.isFood(x.slot)) return;
      let by = null; d.slots.forEach((o, j) => { if (j < i && o.item && o.item.lat != null) by = o.item; });
      meals.push({ day: d.n, slot: x.slot, n: x.item ? x.item.n : '', cut: !!x.cut, free: !!x.free, km: x.item && by ? W.km(by, x.item) : null }); }));
    return { city: s.name, ck, gaps: P.gaps[ck] || null, allGaps: Object.keys(P.gaps).length, asks: asks.length, mealAsks: asks.filter(p => /for the meals this trip has no place for yet/.test(p)), food: c.food.length,
      rest: ((c.rest || {}).food || []).length, count: c.mealAsks || 0, meals, busy: W.cityBusy(ck) }; }, stop);
  const replan = () => pg.evaluate(() => { W.replan(); W.dataV = (W.dataV || 0) + 1; W.render(); });
  const s0 = await snap(0);
  t.ok(s0.allGaps === 0 && s0.mealAsks.length === 0, 'a trip whose lists fill every meal asks for nothing more (' + s0.asks + ' lists of places to eat, none of them a fill)');
  t.ok(s0.meals.filter(m => !m.n).every(m => m.cut || m.free), 'the only meals without a place are the ones the clock leaves out: ' + (s0.meals.filter(m => !m.n).map(m => m.day + ' ' + m.slot).join(', ') || 'none'));

  /* ---- none of the town's dinner places is near the days' stops ---- */
  /* (the keys of a stop's meals of one kind, read before anything is changed: W.plan() plans afresh after every change) */
  await pg.evaluate(() => { window.mealKeys = (stop, re) => { const out = []; W.plan().days.forEach(d => { if (d.stop === stop) d.slots.forEach(x => { if (re.test(x.slot)) out.push(x.key); }); }); return out; }; });
  const before = await pg.evaluate(() => { const s = W.plan().stops[0], c = W.C.city[W.cityKey(s.country, s.name)], keys = mealKeys(0, /dinner/);
    c.food.forEach(x => { if (x.meal === 'dinner') x.lat += 1.2; else if (x.meal === 'both' || x.meal === 'all') x.meal = 'lunch'; });   /* the dinner places are 130 km away */
    keys.forEach(k => { delete W.S.picks[k]; });
    return c.food.length; });
  /* (the day's note is read in the same turn as the planning: the stand-in answers within a fraction of a second) */
  const note = await pg.evaluate(() => { W.replan(); W.dataV = (W.dataV || 0) + 1; const d = W.plan().days.find(d => d.stop === 0 && d.slots.some(x => x.slot === 'dinner' && !x.item && !x.cut));
    if (!d) return 'no day'; W.S.day = d.n; W.S.tview = 'days'; W.goView('trip'); W.render(); const p = document.querySelector('#viewTrip .short-note'); return p ? (p.closest('article.slot') || p).textContent : 'no note'; });
  const fills = () => pg.evaluate(() => (window.__foodAsks || []).filter(p => /for the meals this trip has no place for yet/.test(p)).length);
  await pg.waitForFunction(() => (window.__foodAsks || []).some(p => /for the meals this trip has no place for yet/.test(p)), null, { timeout: 5000 }).catch(() => {});
  const s1 = await snap(0), ask = s1.mealAsks[0] || '';
  t.ok(s1.mealAsks.length === 1, 'dinners that no place in the list can serve are asked for at once, in one question');
  const nD = (ask.match(/\d+ for dinner/g) || []).length;
  t.ok(nD >= 1 && /for dinner near [^;]+ \(\d+\.\d{3}, \d+\.\d{3}\), no more than about \d+ km from it/.test(ask), 'the question says which meal and the stop it should be near: ' + ask.slice(ask.indexOf('yet: ') + 5, ask.indexOf('yet: ') + 120) + '…');
  t.ok(/kitchen open by 18:30: the children eat early/.test(ask), 'and, with children along, that the kitchen must be open by their dinner time');
  t.ok(/Do not repeat: /.test(ask) && /"meal":"both"/.test(ask), 'it is the same question every list of places to eat uses (no repeats, the same fields)');
  t.ok(!/for breakfast|for lunch/.test(ask), 'meals that have a place are not asked for');
  const total = +(ask.match(/^List (\d+) MORE/) || [])[1];
  t.ok(total >= 2 && total <= 12, 'one place to spare for each meal, twelve at most in one question (' + total + ')');
  t.ok(/Nothing in .+'s ideas fits here/.test(note) && /Finding more/.test(note), 'meanwhile the day says more are being found: "' + note.trim().replace(/\s+/g, ' ') + '"');
  t.eq((note.match(/ideas fits here/g) || []).length, 1, 'and says why the row is empty once, not twice (v199)');
  await settle(pg, 9000);
  const s2 = await snap(0), dinners = s2.meals.filter(m => m.slot === 'dinner' && !m.cut && !m.free);
  t.ok(dinners.length >= 2 && dinners.every(m => m.n), 'when they arrive, every dinner has a place: ' + dinners.map(m => m.n).join(', '));
  t.ok(dinners.every(m => m.km == null || m.km < 8), 'each near the stop before it (' + dinners.map(m => m.km == null ? '-' : m.km.toFixed(1) + ' km').join(', ') + ')');
  t.ok(s2.food === before + total && s2.rest === 0, 'the places asked for are on show with the rest, none set aside (' + before + ' → ' + s2.food + ')');
  t.ok(s2.gaps === null && s2.mealAsks.length === 1 && s2.count === 1, 'and nothing more is asked once the meals are filled');
  await replan(); await settle(pg, 3000);
  const s3 = await snap(0);
  t.ok(s3.mealAsks.length === 1 && s3.food === s2.food && JSON.stringify(s3.meals) === JSON.stringify(s2.meals), 'planning again changes nothing and asks nothing');

  /* ---- places set aside come out before Claude is asked ---- */
  const aside = await pg.evaluate(() => { const s = W.plan().stops[1], ck = W.cityKey(s.country, s.name), c = W.C.city[ck]; mealKeys(1, /breakfast/).forEach(k => { delete W.S.picks[k]; });
    const keep = c.food.filter(x => x.meal !== 'breakfast'), out = c.food.filter(x => x.meal === 'breakfast');
    c.food = keep; c.rest = { spots: (c.rest && c.rest.spots) || [], food: out.concat([{ n: 'Florence dinner only', d: 'x', meal: 'dinner', lat: c.lat, lng: c.lng }]) };
    c.showN = { food: keep.length };
    return { out: out.length, keep: keep.length }; });
  await replan(); await settle(pg, 4000);
  const s4 = await snap(1), bf = s4.meals.filter(m => m.slot === 'breakfast' && !m.cut);
  t.ok(s4.mealAsks.length === s3.mealAsks.length && s4.count === 0, 'a town that holds breakfast places it had set aside brings those out, and asks Claude nothing (' + s4.mealAsks.length + ' fills asked so far, ' + s4.count + ' for ' + s4.city + ')');
  t.ok(bf.length >= 2 && bf.every(m => m.n) && s4.rest >= 1, 'the breakfasts are filled from them; a place that serves none of the missing meals stays set aside (' + s4.rest + ' left)');

  /* ---- a town that has no such place: three questions, then it stops ---- */
  await pg.evaluate(() => { window.__noMeal = 1; const s = W.plan().stops[2], c = W.C.city[W.cityKey(s.country, s.name)];
    mealKeys(2, /dinner/).forEach(k => { delete W.S.picks[k]; });
    c.food = c.food.filter(x => x.meal === 'breakfast' || x.meal === 'lunch'); if (c.rest) c.rest.food = []; });
  await replan(); await settle(pg, 9000); await replan(); await settle(pg, 5000); await replan(); await settle(pg, 5000);
  const s5 = await snap(2), mine = s5.mealAsks.filter(p => p.indexOf('in ' + s5.city + ',') > -1);
  t.ok(mine.length === 3 && s5.count === 3, 'when the answers bring nothing, the town is asked three times and no more (' + mine.length + ')');
  const note2 = await pg.evaluate(() => { const d = W.plan().days.find(d => d.stop === 2 && d.slots.some(x => x.slot === 'dinner' && !x.item && !x.cut)); if (!d) return 'no day'; W.S.day = d.n; W.S.tview = 'days'; W.goView('trip'); W.render(); const p = document.querySelector('#viewTrip .short-note'); return p ? (p.closest('article.slot') || p).textContent + '|' + !!p.querySelector('[data-more]') : ''; });
  t.ok(/Nothing in .+'s ideas fits here/.test(note2) && /Find more ideas/.test(note2) && /\|true$/.test(note2), 'the free part of the day then says so itself, with "Find more ideas" to ask yourself: "' + note2.replace(/\s+/g, ' ').trim() + '"');
  const where = await pg.evaluate(() => { const p = document.querySelector('#viewTrip .short-note'); return { inRow: !!(p && p.closest('article.slot.free')), n: document.querySelectorAll('#viewTrip .short-note').length }; });
  t.ok(where.inRow && where.n === 1, 'the note sits in the free row it is about, once a day, not above the plan');
  /* a meal you freed is yours: not counted, not asked for */
  const freed = await pg.evaluate(() => { const P = W.plan(), ck = Object.keys(P.gaps)[0], n0 = P.gaps[ck].at.length; const d = P.days.find(d => d.stop === 2 && d.slots.some(x => x.slot === 'dinner' && !x.item && !x.cut)), x = d.slots.find(y => y.slot === 'dinner');
    (W.S.free || (W.S.free = {}))[x.key] = 1; W.replan(); const P2 = W.plan(), g = P2.gaps[ck]; return { n0, n1: g ? g.at.length : 0 }; });
  t.ok(freed.n1 === freed.n0 - 1, 'a dinner you left free is not counted as missing (' + freed.n0 + ' → ' + freed.n1 + ')');
  /* a new lodging: the meals are somewhere else now, so the town may be asked again */
  await pg.evaluate(() => { window.__noMeal = 0; const s = W.plan().stops[2], ck = W.cityKey(s.country, s.name), c = W.C.city[ck]; W.S.stays[ck] = { label: 'Casa Nuova', lat: c.lat + 0.004, lng: c.lng + 0.004 }; });
  await replan(); await settle(pg, 9000);
  const s6 = await snap(2), d6 = s6.meals.filter(m => m.slot === 'dinner' && !m.cut && !m.free);
  t.ok(s6.count >= 1 && s6.count <= 3 && s6.gaps === null && d6.every(m => m.n), 'after you change where you stay, the count starts again: it asks afresh, and the dinners fill (' + d6.length + ' dinners, ' + s6.count + ' question' + (s6.count > 1 ? 's' : '') + ')');
  /* a shared trip you only read asks for nothing */
  const ro = await pg.evaluate(() => { const P = W.plan(), s = P.stops[0]; W.readOnly = true; const r = W.mealIdeas(s.country, s.name, { country: s.country, city: s.name, breakfast: 0, lunch: 0, dinner: 1, at: [{ meal: 'dinner', day: 1, n: '', lat: null, lng: null, km: 4 }] }); W.readOnly = false; return r; });
  t.eq(ro, '', 'a trip you can only read never asks');
  t.eq(errors(), [], 'no page errors');
  await b.close();
};
