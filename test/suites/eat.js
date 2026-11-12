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
  /* a tap that a redraw lands in the middle of still counts. Plan used to be thrown away and rebuilt on every redraw
     (also one that changed nothing on it, when data arrived for somewhere else), so between finger down and finger up
     the chip under the finger had become a new one and the tick was lost. It is now edited in place (lib/patch.js). */
  await pg.click('[data-fold="eat-al"] > summary');
  const chip = await pg.evaluate(() => { const c = [...document.querySelectorAll('[data-eatal]')].find(x => !(W.S.eat.al || []).includes(x.dataset.eatal)); const r = c.getBoundingClientRect(); return { v: c.dataset.eatal, x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await pg.mouse.move(chip.x, chip.y); await pg.mouse.down();
  await pg.evaluate(() => { W.arrived(); W.render(); });   /* data arrives and the screen is drawn again, finger still down */
  await pg.mouse.up(); await pg.waitForTimeout(200);
  t.ok(await pg.evaluate(v => (W.S.eat.al || []).includes(v), chip.v), `a tick still counts when the screen is redrawn while the finger is down (${chip.v})`);
  await pg.evaluate(v => { const a = W.S.eat.al, k = a.indexOf(v); if (k > -1) a.splice(k, 1); W.render(); }, chip.v);   /* (as it was, for the checks below) */
  await pg.click('[data-fold="eat-al"] > summary'); await pg.waitForFunction(() => W.S.eatOpen && W.S.eatOpen.al === false, null, { timeout: 5000 }).catch(() => {});
  t.ok(await pg.evaluate(() => { W.render(); return !document.querySelector('[data-fold="eat-al"]').open && W.S.eatOpen && W.S.eatOpen.al === false; }), 'and stays folded after a redraw');
  await pg.click('[data-fold="eat-al"] > summary'); await pg.click('[data-eatal="peanuts"]'); await pg.click('[data-fold="eat-al"] > summary');
  await pg.fill('#eatLove', 'Pizza, grilled vegetables'); await pg.dispatchEvent('#eatLove', 'change');
  const txt = await pg.evaluate(() => W.eatText());
  t.ok(/allergies: shellfish/.test(txt) && /diet: vegetarian/.test(txt) && /loves Pizza/.test(txt), 'the needs are kept with the trip: ' + txt);
  t.ok(await pg.evaluate(() => /Allergies: shellfish|shellfish/.test(document.querySelector('[data-fold="step-eat"] .sum').textContent)), 'and the step sums them up when folded');
  /* the places already listed are checked; more that fit come with "Find more" */
  await pg.evaluate(() => { W.goView('trip'); }); await settle(pg, 8000);
  await pg.waitForFunction(() => (window.__eatAsks || []).length > 0, null, { timeout: 15000 }).catch(() => {});
  const r = await pg.evaluate(() => {
    const P = W.plan(), rome = P.days.filter(d => d.city === 'Rome'), meals = rome.reduce((a, d) => a.concat(d.slots.filter(x => x.item && W.isFood(x.slot))), []);
    const pool = W.pool('Italy', 'Rome'), checked = pool.food.filter(x => W.eatFit(x)).length, poor = pool.food.filter(x => W.eatFit(x) === 'poor').length;
    const full = (window.__full || []).filter(p => /places to eat/i.test(p));
    return { asked: (window.__eatAsks || []).length, checked, poor, total: pool.food.length, planned: meals.map(x => x.item.n), poorPlanned: meals.filter(x => W.eatFit(x.item) === 'poor').map(x => x.item.n),
      extra: full.filter(p => /suit this group's food needs/.test(p)).length };
  });
  t.ok(r.asked > 0 && r.checked > 0 && r.poor > 0, `Rome's places to eat are checked against the needs (${r.checked} of ${r.total}, ${r.poor} poor fits)`);
  t.eq(r.poorPlanned, [], 'no poor fit is planned (' + r.planned.length + ' meals in Rome)');
  const more = await pg.evaluate(async () => { W.loadCity('Italy', 'Rome', true); await new Promise(res => setTimeout(res, 1500));
    return (window.__full || []).some(p => /MORE places to eat in Rome/.test(p) && /allergies: shellfish/.test(p)); });
  t.ok(r.extra === 0 && more, 'no extra list is fetched on its own; "Find more" asks for places to eat with the needs in the question: ' + JSON.stringify({ extra: r.extra, more }));
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
  await ctx.close();

  /* v152: "Food you love" counts. It is asked about apart from "can they eat here" (like 0, 1, 2), the meals the planner
     chose are chosen again once the marks are in (never the ones you chose), a city with few such places is asked for
     a few, without Claude the words in a place's name and description decide, and Plan says what it has done. The
     stand-in calls a third of the places "a place for it" (like 2). */
  const { pg: p2, ctx: c2, errors: e2 } = await open(b, { width: 390, height: 844, db: mkdb({ 'morefood/italy-rome': { city: 'Rome', country: 'Italy', at: '2027-01-01', items: [{ n: 'Night Trattoria', d: 'Roman classics', cuisine: 'Roman', lat: 41.895, lng: 12.474, meal: 'both', fit: 'poor', fitw: 'stale mark' }] } }) });
  await exampleTrip(p2); await settle(p2, 6000);
  const lv = await p2.evaluate(async () => {
    const real = W.SAMPLE.json; window.__lp = [];
    W.SAMPLE.json = (p, o) => { window.__lp.push(p);
      if (/how well can it feed this group\?/.test(p)) { const names = ((p.split('\nPlaces: ')[1] || '').split('\nReply')[0] || '').split('; ').map(x => x.replace(/ \([^)]*\)$/, '').trim()).filter(Boolean);
        return Promise.resolve({ fit: names.map((n, i) => ({ n, fit: 'ok', fitw: '', like: i % 3 === 0 ? 2 : 0 })) }); }
      return real(p, o); };
    const meals = () => { const o = {}; W.plan().days.forEach(d => d.slots.forEach(x => { if (W.isFood(x.slot) && x.item) o[x.key] = x.item.n; })); return o; };
    const loved = () => W.plan().days.reduce((a, d) => a + d.slots.filter(x => W.isFood(x.slot) && x.item && W.eatLike(x.item) === 2).length, 0);
    const k0 = Object.keys(meals())[0], m0 = meals(), mineName = m0[k0];
    W.S.mine = Object.assign(W.S.mine || {}, { [k0]: 1 });
    const before = loved();
    W.S.eat = { love: 'pizza' }; W.changed(); W.replan(); W.render();
    for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 150)); if (!Object.keys(W.status).some(k => /^eat(fit|love)\|/.test(k) && W.status[k] === 'loading') && i > 8) break; }
    W.replan(); W.render(); await new Promise(r => setTimeout(r, 400));
    const m1 = meals(), after = loved();
    const night = (W.pool('Italy', 'Rome').food || []).find(x => x.n === 'Night Trattoria');
    W.SAMPLE.json = real;
    return { before, after, total: Object.keys(m1).length, mineKept: m1[k0] === mineName,
      likeAsked: window.__lp.some(p => /how well can it feed this group/.test(p) && /like = 2 if it is a place for what they love \(pizza\)/.test(p)),
      lovedAsk: window.__lp.filter(p => /especially good for what this group loves: pizza/.test(p)).length, lovedRome: W.lovedCount('Italy', 'Rome'),
      night: night ? (night.eat ? night.eat.w : 'unmarked') : 'absent' };
  });
  t.ok(lv.likeAsked, '"Food you love" is asked about apart from whether you can eat there (like 0, 1 or 2)');
  t.ok(lv.after > lv.before && lv.after >= Math.round(lv.total / 3) && lv.mineKept, `and the meals go to the places for it: ${lv.before} → ${lv.after} of ${lv.total} meals (a meal you chose yourself stays)`);
  t.ok(lv.lovedRome >= 4 || lv.lovedAsk >= 1, 'a city with few places for it is asked for a few more: ' + JSON.stringify({ rome: lv.lovedRome, asked: lv.lovedAsk }));
  t.ok(lv.night !== 'stale mark', 'a nightly place\'s mark made for other needs is not taken as one for these: ' + lv.night);
  const words = await p2.evaluate(() => { W.S.eat = { love: 'grilled fish, pizza', avoid: 'very spicy food' }; const saved = W.SAMPLE;
    const r = { pizza: W.eatLike({ n: 'Pizzeria da Remo', cuisine: 'Pizza', d: 'Thin Roman pizza' }), fish: W.eatLike({ n: 'Il Pescatore', d: 'Grilled fish and seafood' }), other: W.eatLike({ n: 'Trattoria', d: 'Pasta' }), spicy: W.eatFit({ n: 'Sichuan House', d: 'Spicy Sichuan dishes' }), mild: W.eatFit({ n: 'Gelateria', d: 'Ice cream' }) }; return r; });
  t.eq(words, { pizza: 2, fish: 2, other: 0, spicy: 'poor', mild: '' }, 'without a mark from Claude, the words decide: what you love and what you would rather avoid');
  const rep = await p2.evaluate(async () => { W.S.eat = { love: 'pizza' }; W.needLater(); W.goView('setup'); W.render(); for (let i = 0; i < 40 && !W.laterReady; i++) await new Promise(r => setTimeout(r, 100)); W.render(); await new Promise(r => setTimeout(r, 300)); return (document.querySelector('.eat-rep') || {}).textContent || ''; });
  t.ok(/^\d+ places? for pizza · \d+ of your \d+ meals go to them/.test(rep), 'Plan says what it has done: ' + rep);
  t.eq(e2(), [], 'no page errors there either');
  await c2.close(); await b.close();
};
