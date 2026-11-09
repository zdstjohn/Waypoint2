/* Food needs (Plan, step 3): allergies, diets and likes are asked before restaurants are suggested; once set, every
   request for places to eat carries them, the places already listed are checked for how well they fit, a poor fit is
   never planned (unless you choose it), each meal says what you can have and which allergy to mention, and Explore
   marks the good and the poor fits. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg); await settle(pg, 6000);
  await pg.evaluate(() => { W.needLater(); W.goView('setup'); }); await pg.waitForSelector('#viewSetup [data-fold="step-eat"]', { timeout: 15000 });
  const st = await pg.evaluate(() => { const steps = [...document.querySelectorAll('#viewSetup details.step')].map(d => d.dataset.fold.slice(5)); return { steps, chips: document.querySelectorAll('[data-eatal], [data-eatdi]').length }; });
  t.ok(st.steps.indexOf('eat') > -1 && st.steps.indexOf('eat') < st.steps.indexOf('where'), 'Plan asks what you eat before where you go: ' + st.steps.join(' → '));
  t.ok(st.chips >= 12, 'with allergies and diets to tick (' + st.chips + ')');
  await pg.evaluate(() => { document.querySelector('[data-fold="step-eat"]').open = true; });
  /* the allergy and diet lists fold: folded at first, each line saying what's picked */
  const vis = () => pg.evaluate(() => ['al', 'di'].map(k => { const d = document.querySelector('[data-fold="eat-' + k + '"]'), c = d && d.querySelector('.chip'); return { open: !!(d && d.open), shown: !!(c && c.checkVisibility()), sum: d ? d.querySelector('.eat-s').textContent : '' }; }));
  const f0 = await vis();
  t.ok(f0.every(f => !f.open && !f.shown && f.sum === 'None'), 'the allergy and diet lists start folded, each saying "None": ' + JSON.stringify(f0));
  await pg.click('[data-fold="eat-al"] > summary'); await pg.click('[data-eatal="shellfish"]'); await pg.click('[data-eatal="peanuts"]');
  await pg.click('[data-fold="eat-di"] > summary'); await pg.click('[data-eatdi="vegetarian"]');
  const f1 = await vis();
  t.ok(f1.every(f => f.open && f.shown), 'a list you opened stays open while you tick (the screen redraws on each tap)');
  await pg.click('[data-fold="eat-al"] > summary'); await pg.click('[data-fold="eat-di"] > summary');
  const f2 = await vis();
  t.ok(!f2[0].open && !f2[0].shown && /Peanuts/.test(f2[0].sum) && /Shellfish/.test(f2[0].sum) && f2[1].sum === 'Vegetarian', 'folded again, each line shows what\'s picked: ' + f2.map(f => f.sum).join(' / '));
  t.ok(await pg.evaluate(() => { W.render(); return !document.querySelector('[data-fold="eat-al"]').open && W.S.eatOpen && W.S.eatOpen.al === false; }), 'and stays folded after a redraw');
  await pg.click('[data-fold="eat-al"] > summary'); await pg.click('[data-eatal="peanuts"]'); await pg.click('[data-fold="eat-al"] > summary');
  await pg.fill('#eatLove', 'Pizza, grilled vegetables'); await pg.dispatchEvent('#eatLove', 'change');
  const txt = await pg.evaluate(() => W.eatText());
  t.ok(/allergies: shellfish/.test(txt) && /diet: vegetarian/.test(txt) && /loves Pizza/.test(txt), 'the needs are kept with the trip: ' + txt);
  t.ok(await pg.evaluate(() => /Allergies: shellfish|shellfish/.test(document.querySelector('[data-fold="step-eat"] .sum').textContent)), 'and the step sums them up when folded');
  /* the places already listed are checked, and a few that fit are asked for */
  await pg.evaluate(() => { W.goView('trip'); }); await settle(pg, 8000);
  await pg.waitForFunction(() => (window.__eatAsks || []).length > 0, null, { timeout: 15000 }).catch(() => {});
  const r = await pg.evaluate(() => {
    const P = W.plan(), rome = P.days.filter(d => d.city === 'Rome'), meals = rome.reduce((a, d) => a.concat(d.slots.filter(x => x.item && W.isFood(x.slot))), []);
    const pool = W.pool('Italy', 'Rome'), checked = pool.food.filter(x => W.eatFit(x)).length, poor = pool.food.filter(x => W.eatFit(x) === 'poor').length;
    const full = (window.__full || []).filter(p => /places to eat/i.test(p));
    return { asked: (window.__eatAsks || []).length, checked, poor, total: pool.food.length, planned: meals.map(x => x.item.n), poorPlanned: meals.filter(x => W.eatFit(x.item) === 'poor').map(x => x.item.n),
      more: full.some(p => /suit this group's food needs/.test(p) && /allergies: shellfish/.test(p)) };
  });
  t.ok(r.asked > 0 && r.checked > 0 && r.poor > 0, `Rome's places to eat are checked against the needs (${r.checked} of ${r.total}, ${r.poor} poor fits)`);
  t.eq(r.poorPlanned, [], 'no poor fit is planned (' + r.planned.length + ' meals in Rome)');
  t.ok(r.more, 'and a few places that suit the needs are asked for, with the needs in the question');
  /* each meal says what you can have, and the allergy to mention */
  const row = await pg.evaluate(() => { const P = W.plan(), d = P.days.find(x => x.city === 'Rome' && x.slots.some(y => y.item && W.isFood(y.slot) && W.eatFit(y.item))); if (!d) return null; const x = d.slots.find(y => y.item && W.isFood(y.slot) && W.eatFit(y.item)); const R = W.dayTimes(d, P).rows[x.slot]; return R.info.concat(R.warn); });
  t.ok(row && row.some(l => /Plenty without shellfish/.test(l)) && row.some(l => /Tell the staff: shellfish allergy/.test(l)), 'a meal says what you can have and which allergy to mention: ' + JSON.stringify(row));
  /* Explore marks the fits */
  await pg.evaluate(() => { W.S.tview = 'map'; W.render(); }); await pg.waitForTimeout(500);
  await pg.click('#viewTrip [data-tab="eat"]').catch(() => {}); await pg.waitForTimeout(400);
  const tags = await pg.evaluate(() => ({ good: document.querySelectorAll('#viewTrip .idea .bc.good').length, txt: [...document.querySelectorAll('#viewTrip .idea .bc.good, #viewTrip .idea .warn')].map(e => e.textContent).filter(x => /food needs/.test(x)).length }));
  t.ok(tags.txt > 0, `Explore marks places that fit, or don't (${tags.txt})`);
  /* a new request for places to eat carries the needs */
  await pg.evaluate(() => { W.loadCity('Italy', 'Bologna'); }); await settle(pg, 6000);
  const vq = await pg.evaluate(() => (window.__full || []).filter(p => /places to eat in Bologna/.test(p)));
  t.ok(vq.length > 0 && vq.every(p => /The group's food needs: allergies: shellfish; diet: vegetarian/.test(p) && /"fit":"good"/.test(p)), `a new city's places to eat are asked for with the needs, and how each fits (${vq.length} questions)`);
  /* clearing the needs: nothing is filtered any more */
  t.ok(await pg.evaluate(() => { W.S.eat = {}; W.changed(); W.replan(); return !W.eatSig() && !W.eatFit(W.pool('Italy', 'Rome').food[0]); }), 'with no needs, nothing is marked or filtered');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
