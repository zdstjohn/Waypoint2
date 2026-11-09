/* Random trips against the planner's promises. A seeded generator builds trips nobody wrote by hand: 1–3 countries from
   the built-in list, 1–4 places each (or "suggest"), 3–21 days, any mix of adults, children (0–17), toddlers and
   grandparents, 0–4 interests, Must-sees / Best of both / Hidden gems, a departure airport near or far (jet lag), random
   rest days and freed slots. Every trip is checked against the rules the hand-built tests check one trip at a time:
     - the plan has exactly the days asked for, each in one of the chosen places, no place scheduled twice in a city
     - every planner-made stop fits its day (your own picks may say "no time"; the planner's never do)
     - stops run in clock order; lunch falls 11:30–14:30 and dinner 17:00–21:00 (18:30 at the latest with children)
     - a toddler's days have a nap (most of them: travel days may not)
     - jet-lag days: no day trip, nothing with timed entry first thing, dinner by 18:30
     - nothing closed for good, nothing shut that weekday, no dinner place that opens too late for children
     - grandparents along: no strenuous outing; a rest day holds one easy thing near the lodging
     - every stop sits within the place's day radius (a far pin means a wrong pin; water is the nightly pin check's job)
   FUZZ=2000 node test/run.js fuzz runs more; a failure prints the seed, and FUZZ_SEED=<n> replays that one trip. */
const { launch, open, exampleTrip, settle } = require('../lib/page');
const N = +process.env.FUZZ || 300, ONLY = process.env.FUZZ_SEED ? +process.env.FUZZ_SEED : null;

/* runs in the page: build one random trip from a seed, plan it, audit it */
const inPage = `
(function () {
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function int(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  var STYLES = window.STYLES.map(function (s) { return s[0]; }), FOCUS = ["icons", "both", "gems"];
  var AIR = ["Los Angeles (LAX)", "New York (JFK)", "London (LHR)", "Sydney (SYD)", "Rome (FCO)"];
  window.__fuzzTrip = function (seed) {
    var r = rng(seed), countries = Object.keys(window.TD), nC = int(r, 1, 3), cs = [];
    while (cs.length < nC) { var c = pick(r, countries); if (cs.indexOf(c) < 0) cs.push(c); }
    var spec = { seed: seed, countries: cs.map(function (c) { var all = window.TD[c].cities.map(function (x) { return x.name; }), n = int(r, 0, Math.min(4, all.length)), picked = []; while (picked.length < n) { var x = pick(r, all); if (picked.indexOf(x) < 0) picked.push(x); } return { name: c, mode: n ? "manual" : "suggest", picked: picked }; }),
      days: int(r, 3, 21), start: "2027-" + String(int(r, 1, 12)).padStart(2, "0") + "-" + String(int(r, 1, 28)).padStart(2, "0"), depart: pick(r, AIR),
      travelers: [], styles: [], focus: pick(r, FOCUS) };
    var nA = int(r, 1, 3), nK = int(r, 0, 3), nS = int(r, 0, 2);
    for (var i = 0; i < nA; i++) spec.travelers.push(int(r, 25, 45));
    for (i = 0; i < nK; i++) spec.travelers.push(int(r, 0, 17));
    for (i = 0; i < nS; i++) spec.travelers.push(int(r, 65, 80));
    var nSt = int(r, 0, 4); while (spec.styles.length < nSt) { var st = pick(r, STYLES); if (spec.styles.indexOf(st) < 0) spec.styles.push(st); }
    return spec;
  };
  window.__fuzzRun = function (spec) {
    var r = rng(spec.seed * 7 + 3), S = W.S;
    Object.assign(S, { styles: spec.styles.slice(), countries: JSON.parse(JSON.stringify(spec.countries)), days: spec.days, start: spec.start, depart: spec.depart, travelers: spec.travelers.slice(), focus: spec.focus,
      stays: {}, picks: {}, seen: {}, mine: {}, free: {}, rest: {}, legPick: {}, fold: {}, cityDays: {}, names: [], day: 1 });
    W.isExample = false;
    var P = W.plan(), out = { seed: spec.seed, bad: [], loading: 0, N: P.N, days: P.days.length };
    /* a few rest days and freed slots, chosen at random, then plan again */
    P.days.forEach(function (d) { if (r() < 0.1) S.rest[W.restKey(d)] = 1; (d.slots || []).forEach(function (x) { if (r() < 0.05) S.free[x.key] = 1; }); });
    if (Object.keys(S.rest).length || Object.keys(S.free).length) { W.replan(); P = W.plan(); }
    var p = W.party(), kd = W.kidDinner();
    if (P.days.length !== spec.days) out.bad.push("days: asked " + spec.days + ", got " + P.days.length);
    var allowed = {}; P.stops.forEach(function (s) { allowed[s.country + "|" + s.name] = 1; });
    var seenByCity = {}, napDays = 0, toddlerDays = 0;
    P.days.forEach(function (d) {
      if (!allowed[d.country + "|" + d.city]) out.bad.push("D" + d.n + " in " + d.city + ", not a chosen place");
      if (d.loading) { out.loading++; return; }
      var T = W.dayTimes(d, P); if (!T) return;
      var last = -1, dayAny = 0, home = W.homebase(d.country, d.city), order = T.order || ["breakfast", "am", "lunch", "pm", "dinner", "eve"];
      var pool = W.pool(d.country, d.city), geo = pool ? Math.max(6, Math.min(60, (pool.spots || []).length ? 25 : 60)) : 60;
      order.map(function (sl) { return (d.slots || []).filter(function (y) { return y.slot === sl; })[0]; }).filter(Boolean).forEach(function (x) {
        var R = T.rows[x.slot], it = x.item;
        if (!it) return;
        var key = d.country + "|" + d.city + "|" + W.norm(it.n); if (!W.isFood(x.slot)) { if (seenByCity[key] && !(d.trip)) out.bad.push("D" + d.n + " " + it.n + " scheduled twice in " + d.city); seenByCity[key] = 1; }
        if (W.gone(it)) out.bad.push("D" + d.n + " " + it.n + " is closed/unfound");
        if (it.hours && it.hours.closed.indexOf(W.weekday(d.n)) > -1) out.bad.push("D" + d.n + " " + it.n + " is shut that weekday");
        if (x.slot === "dinner" && kd != null && it.hours && it.hours.o > kd + 30 && it.hours.o < 1440) out.bad.push("D" + d.n + " dinner at " + it.n + " opens " + W.clock(it.hours.o) + ", late for children");
        if (!R) return;
        if (R.skip && !S.mine[x.key]) out.bad.push("D" + d.n + " " + x.slot + " " + it.n + " does not fit [" + (R.info.concat(R.warn)).join("; ") + "]");
        if (R.warn.some(function (w) { return /^Closed on|^Not open until|before you'd get there|^Kitchen opens/.test(w); })) out.bad.push("D" + d.n + " " + x.slot + " " + it.n + " [" + R.warn.join("; ") + "]");
        if (R.start != null && !R.skip) { if (R.start < last) out.bad.push("D" + d.n + " " + x.slot + " starts before the stop before it"); last = R.start; }
        if (x.slot === "lunch" && R.start != null && !R.skip && (R.start < 690 || R.start > 870)) out.bad.push("D" + d.n + " lunch at " + W.clock(R.start));
        var kidCap = Math.max(1110 + (d.jet ? 0 : 30), T.travel ? T.travel.end + 60 : 0);   /* after a journey, dinner follows the landing */
        if (x.slot === "dinner" && R.start != null && !R.skip && (R.start < 1020 || R.start > 1305 || (p.kid && R.start > kidCap))) out.bad.push("D" + d.n + " dinner at " + W.clock(R.start) + (p.kid ? " with children" : ""));
        if (it.s === "any" && !W.isFood(x.slot)) dayAny++;
        if (d.jet && x.slot === "am" && W.needsBooking(it)) out.bad.push("D" + d.n + " jet-lag day starts with a timed entry: " + it.n);
        var c = W.isFood(x.slot) ? null : W.classify(it, false);
        if (c && p.senior && c.intensity >= 3) out.bad.push("D" + d.n + " " + it.n + " is strenuous, grandparents along");
        if (c && d.rest && x.slot === "pm" && c.intensity >= 2) out.bad.push("D" + d.n + " rest day with a strenuous outing: " + it.n);
        var km = W.km(home, it); if (km != null && km > 150 && !(it.s === "any")) out.bad.push("D" + d.n + " " + it.n + " is " + Math.round(km) + " km from the lodging");
      });
      if (dayAny > 1) out.bad.push("D" + d.n + " has two day trips");
      if (d.jet && (d.trip || d.fullDay || dayAny)) out.bad.push("D" + d.n + " jet-lag day has a day trip");
      if (p.toddler && !d.tripFirst && !d.tripLast && !d.moveFrom) { toddlerDays++; if (T.nap) napDays++; }
    });
    if (toddlerDays >= 3 && napDays < toddlerDays * 0.6) out.bad.push("naps on " + napDays + " of " + toddlerDays + " toddler days");
    return out;
  };
})();`;

exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844 }); await exampleTrip(pg);
  await pg.addScriptTag({ content: inPage });
  /* every built-in place's lists first (the mock answers at once), so each random trip plans without waiting */
  await pg.evaluate(() => { W.isExample = false; W.S.countries = Object.keys(window.TD).map(c => ({ name: c, mode: 'manual', picked: window.TD[c].cities.map(x => x.name) })); W.S.days = 60; W.replan(); W.plan(); });
  await pg.waitForFunction(() => Object.keys(window.TD).every(c => window.TD[c].cities.every(x => { const p = W.pool(c, x.name); return p && p.spots.length && p.food.length; })), null, { timeout: 60000 }).catch(() => {});
  await settle(pg, 8000);
  const ready = await pg.evaluate(() => Object.keys(window.TD).reduce((a, c) => a + window.TD[c].cities.filter(x => { const p = W.pool(c, x.name); return p && p.spots.length; }).length, 0));
  t.ok(ready >= 40, `${ready} built-in places have their lists`);
  const seeds = ONLY != null ? [ONLY] : Array.from({ length: N }, (_, i) => 1000 + i);
  let failures = [], planned = 0, loading = 0; const t0 = Date.now();
  for (let i = 0; i < seeds.length; i += 25) {
    const batch = seeds.slice(i, i + 25);
    const res = await pg.evaluate(ss => ss.map(s => { const spec = window.__fuzzTrip(s); const r = window.__fuzzRun(spec); r.spec = spec; return r; }), batch);
    for (const r of res) { planned++; loading += r.loading; if (r.bad.length) failures.push(r); }
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  t.note(`${planned} random trips planned in ${secs}s (${loading} days still loading)`);
  const show = f => `seed ${f.seed} (${f.spec.countries.map(c => c.name + (c.picked.length ? ': ' + c.picked.join('/') : ' (suggest)')).join(', ')}; ${f.spec.days} days from ${f.spec.start}; ages ${f.spec.travelers.join(',')}; ${f.spec.styles.join('+') || 'no interests'}; ${f.spec.focus}; from ${f.spec.depart})\n        ` + f.bad.slice(0, 6).join('\n        ');
  t.eq(failures.map(f => f.seed), [], `every random trip keeps the planner's promises` + (failures.length ? ` — ${failures.length} of ${planned} did not:\n      ` + failures.slice(0, 12).map(show).join('\n      ') : ''));
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
