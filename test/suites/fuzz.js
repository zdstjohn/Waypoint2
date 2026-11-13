/* Random trips against the planner's promises. A seeded generator (test/lib/fuzzworld.js) builds trips nobody wrote by
   hand, and the places they are planned from: towns on one island, travel days from half an hour to nine hours with
   and without tickets, day trips, rest days, places chosen and booked by hand, opening hours and closures, mixed
   parties, dates across daylight-saving changes and month ends, and what arrives afterwards (more ideas, places that
   close). Each trip is planned and read three times (laid out, changed by hand, afterwards) by W.checkPlan
   (trip/lib/rules.js), which states the owner's nine rules as code:
     1 every day is full, or says why not      2 the planner's days fit the clock     3 a real place is planned once
     4 a day stays in one area                 5 no train journeys as things to do    6 open when you are there
     7 naps for toddlers, nothing strenuous for grandparents    8 only names that are one real place
     9 what you chose by hand stays put
   The trips run on three clocks (UTC, Madrid, Los Angeles: seed % 3), so a date sum that slips at a daylight-saving
   change shows. FUZZ=2000 node test/run.js fuzz runs more; a failure prints the seed, and FUZZ_SEED=<n> replays that
   one trip (FUZZ_FROM=<n> starts the seeds elsewhere). */
const { launch, open, exampleTrip } = require('../lib/page');
const world = require('../lib/fuzzworld');
const N = +process.env.FUZZ || 300, ONLY = process.env.FUZZ_SEED ? +process.env.FUZZ_SEED : null, FROM = +process.env.FUZZ_FROM || 1000;
const ZONES = ['UTC', 'Europe/Madrid', 'America/Los_Angeles'];

exports.run = async t => {
  const b = await launch();
  const seeds = ONLY != null ? [ONLY] : Array.from({ length: N }, (_, i) => FROM + i);
  let failures = [], planned = 0, loading = 0, slots = 0, filled = 0, days = 0; const why = {}, rules = {}, errs = []; const t0 = Date.now();
  for (let z = 0; z < ZONES.length; z++) {
    const mine = seeds.filter(s => s % ZONES.length === z); if (!mine.length) continue;
    const { pg, ctx, errors } = await open(b, { width: 390, height: 844, tz: ZONES[z] }); await exampleTrip(pg);
    await pg.addScriptTag({ content: '(' + world.toString() + ')();' });
    await pg.evaluate(d => { window.__fuzzDetail = d; return W.needLater && W.needLater(); }, !!process.env.FUZZ_DETAIL);
    await pg.waitForFunction(() => !!(window.W && W.checkPlan && W.useIdea), null, { timeout: 20000 });
    for (let i = 0; i < mine.length; i += 20) {
      const res = await pg.evaluate(ss => ss.map(s => { const spec = window.__fuzz.trip(s); let r; try { r = window.__fuzz.run(spec); } catch (e) { r = { seed: s, bad: ['crashed: ' + (e && e.stack || e).toString().split('\n').slice(0, 4).join(' | ')], rules: {}, why: {}, loading: 0, slots: 0, filled: 0, days: 0 }; } r.spec = spec; return r; }), mine.slice(i, i + 20));
      for (const r of res) {
        planned++; loading += r.loading; slots += r.slots; filled += r.filled; days += r.days;
        for (const k in r.why) why[k] = (why[k] || 0) + r.why[k];
        for (const k in r.rules) rules[k] = (rules[k] || 0) + r.rules[k];
        if (r.bad.length) { r.zone = ZONES[z]; failures.push(r); }
      }
    }
    if (ONLY != null && process.env.FUZZ_DUMP) console.log(await pg.evaluate(() => window.__fuzz.dump()));
    errs.push(...errors());
    await ctx.close();
  }
  failures.sort((a, b2) => a.seed - b2.seed);
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  t.note(`${planned} random trips (${days} days) planned three times each in ${secs}s; ${Math.round(1000 * filled / Math.max(1, slots)) / 10}% of the parts of the days hold a place; the rest say why: ${Object.keys(why).sort().map(k => k + ' ' + why[k]).join(', ')}`);
  t.eq(loading, 0, 'no day is left waiting for its lists');
  const show = f => `seed ${f.seed} [${f.zone}] (${f.spec.countries.map(c => c.name + (c.picked.length ? ': ' + c.picked.join('/') : ' (suggest)')).join(', ')}; ${f.spec.days} days from ${f.spec.start}; ages ${f.spec.travelers.join(',')}; ${f.spec.styles.join('+') || 'no interests'}; ${f.spec.focus}; from ${f.spec.depart})\n        ` + f.bad.slice(0, 6).join('\n        ') + (f.bad.length > 6 ? `\n        (and ${f.bad.length - 6} more)` : '');
  t.eq(failures.map(f => f.seed), [], `every random trip keeps the planner's promises` + (failures.length ? ` — ${failures.length} of ${planned} did not (by rule: ${Object.keys(rules).map(k => k + ': ' + rules[k]).join(', ')}):\n      ` + failures.slice(0, +process.env.FUZZ_SHOW || 12).map(show).join('\n      ') : ''));
  t.eq(errs, [], 'no page errors');
  await b.close();
};
