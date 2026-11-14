/* Rescuing the day (lib/planacts.js W.rescue / W.rescueApply / W.unrescue, lib/replan.js): when the day goes wrong the
   family taps one button, or says what is going on in a sentence. On the example trip at a pinned clock (day 3 at 9:00,
   and at 10:30 with the first outing under way), this checks to the stop what each does:
     tired     one easy outing close to the stay is kept (the first that is easy and near, or a booked one), every other
               outing still to come is left free, a dinner far from the stay is swapped for one near it, and nothing
               that has started changes; the note records what was done; one Undo puts everything back
     replan    what Claude is told (the stops still to come with their own options only, the time, the ages, the nap, the
               sentence with its quotes removed), and what is done with its answer: a stop that has started or is booked
               is never touched, a name that is not one of that stop's options is ignored, a swap to the same place does
               nothing, "free" frees, and what it says is kept (cut at 160 characters) */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg, { home: true }); await settle(pg, 3000);
  const pin = hh => pg.evaluate(hh => { localStorage.setItem('waypoint-now', '2027-06-09T' + hh); W.S.day = 3; W.replan(); W.dataV = (W.dataV || 0) + 1; W.render(); return W.nowMin(); }, hh);
  const state = () => pg.evaluate(() => { const d = W.P.days[2], home = W.homebase(d.country, d.city);
    return { slots: d.slots.map(x => ({ slot: x.slot, n: x.item ? x.item.n : null, free: !!(W.S.free || {})[x.key], mine: !!(W.S.mine || {})[x.key], pick: (W.S.picks || {})[x.key] || null,
      km: x.item && x.item.lat != null ? Math.round(W.km(home, x.item) * 100) / 100 : null, intensity: x.item && !W.isFood(x.slot) ? W.classify(x.item, false).intensity : null })),
      rescued: W.S.rescued || {}, undo: Object.keys(W.S.rescueUndo || {}), late: JSON.stringify(W.S.late || {}) }; });
  const reset = () => pg.evaluate(() => { const d = W.P.days[2]; if (W.unrescue(d)) { } W.S.rescued = {}; W.S.rescueUndo = {}; W.S.picks = {}; W.S.free = {}; W.S.mine = {}; W.S.booked = {}; W.replan(); W.dataV++; W.render(); });
  const book = slot => pg.evaluate(slot => { const d = W.P.days[2], x = d.slots.find(y => y.slot === slot); W.S.booked = W.S.booked || {}; W.S.booked['item|' + W.cityKey(d.country, d.city) + '|' + W.norm(x.item.n)] = 1; W.replan(); W.dataV++; W.render(); return x.item.n; }, slot);

  /* ---- "tired", at 9:00: nothing has started ---- */
  await pin('09:00:00');
  const s0 = await state(); const by0 = s => Object.fromEntries(s.slots.map(x => [x.slot, x]));
  const a0 = by0(s0);
  t.ok(a0.am.n && a0.pm.n && a0.dinner.n && a0.am.intensity <= 1 && a0.am.km <= 1.5 && a0.pm.km > 1.5 && a0.dinner.km > 1.2, 'the day as it is: an easy morning stop ' + a0.am.km + ' km from the stay, an afternoon stop ' + a0.pm.km + ' km away, a dinner ' + a0.dinner.km + ' km away');
  const res = await pg.evaluate(() => W.rescue(W.P.days[2], W.P, 'tired'));
  const s1 = await state(), a1 = by0(s1);
  t.eq(res, { mode: 'tired', changed: [{ slot: 'pm', why: 'tired' }], freed: 1 }, 'tired: the first easy, near outing (the morning) is kept; the afternoon\'s is freed, and nothing else is reported as changed');
  t.ok(a1.am.n === a0.am.n && a1.lunch.n === a0.lunch.n && a1.breakfast.n === a0.breakfast.n, 'the morning outing, lunch and breakfast stand');
  t.ok(a1.pm.n === null && a1.pm.free && a1.pm.pick === null, 'the afternoon outing is gone and the part of the day is free');
  t.ok(a1.dinner.n === a0.dinner.n || (a1.dinner.km <= 1.2 && a1.dinner.mine), 'dinner: swapped for one within 1.2 km of the stay, or left alone when none such is open: ' + a0.dinner.n + ' -> ' + a1.dinner.n);
  t.eq(s1.rescued, { 'Italy|Rome|3|2027-06-09': { mode: 'tired', n: 1, freed: 1, at: 540 } }, 'what was done is recorded for the day: mode, how many, how many freed, at what time');
  t.eq(s1.undo, ['Italy|Rome|3'], 'and an Undo is kept for the day');
  const un = await pg.evaluate(() => [W.unrescue(W.P.days[2]), W.unrescue(W.P.days[2])]); await pg.evaluate(() => { W.replan(); W.dataV++; W.render(); });
  const s2 = await state();
  t.eq(un, [true, false], 'Undo works once');
  t.eq(s2.slots, s0.slots, 'and puts every part of the day back exactly as it was (places, free, chosen, picks)');
  t.eq([s2.rescued, s2.undo], [{}, []], 'with no record left');

  /* ---- "tired" with the morning booked: the booked outing is the one that is kept, so the afternoon goes ---- */
  await reset(); await pin('09:00:00');
  const bk = await book('am'); const b0 = by0(await state());
  const resB = await pg.evaluate(() => W.rescue(W.P.days[2], W.P, 'tired'));
  const b1 = by0(await state());
  t.ok(b1.am.n === bk && b0.am.n === bk && !b1.am.free, 'a booked outing is never touched: ' + bk);
  t.ok(resB.changed.some(c => c.slot === 'pm' && c.why === 'tired') && b1.pm.n === null && b1.pm.free, 'and, being the one outing kept, it is why the afternoon goes');
  await pg.evaluate(() => W.unrescue(W.P.days[2]));

  /* ---- "tired" at 10:30: the morning stop is under way, and stays ---- */
  await reset(); await pin('10:30:00');
  const c0 = by0(await state());
  const resC = await pg.evaluate(() => W.rescue(W.P.days[2], W.P, 'tired'));
  const c1 = by0(await state());
  t.ok(c1.am.n === c0.am.n && !c1.am.free && c1.breakfast.n === c0.breakfast.n && c1.lunch.n === c0.lunch.n, 'what has started is left alone: ' + c0.am.n);
  const pmOk = c1.pm.n === null ? c1.pm.free : (c1.pm.intensity <= 1 && (c1.pm.km == null || c1.pm.km <= 1.5) && c1.pm.mine);
  t.ok(pmOk && resC.changed.every(c => c.slot !== 'am' && c.slot !== 'lunch'), 'the afternoon is an easy place within 1.5 km, or free: ' + c0.pm.n + ' -> ' + c1.pm.n + ' (' + JSON.stringify(resC.changed) + ')');
  await pg.evaluate(() => W.unrescue(W.P.days[2]));

  /* ---- what Claude is told, and what is done with its answer ---- */
  await reset(); await pin('09:00:00');
  const facts = await pg.evaluate(() => { const d = W.P.days[2], T = W.dayTimes(d, W.P), f = W.replanFacts(d, W.P);
    return { f: f.map(o => ({ slot: o.slot, from: o.from, to: o.to, now: o.now && o.now.name, booked: !!o.booked, opts: (o.options || []).map(q => q.name) })), rows: ['am', 'lunch', 'pm', 'dinner', 'eve'].map(s => [s, W.clock(T.rows[s].start), W.clock(T.rows[s].end)]), nap: T.nap ? W.clock(T.nap.start) + '-' + W.clock(T.nap.end) : '', ages: W.ages() }; });
  t.eq(facts.f.map(o => o.slot), ['am', 'lunch', 'pm', 'dinner', 'eve'], 'Claude is told about the stops still to come (breakfast has started), in order');
  t.eq(facts.f.map(o => [o.slot, o.from, o.to]), facts.rows, 'each with the clock times the day shows');
  t.ok(facts.f.filter(o => o.opts.length).every(o => o.opts.length <= 6 && !o.opts.includes(o.now) && new Set(o.opts).size === o.opts.length), 'and its own other options, at most six, never the place it already has');
  await book('am');
  const fb = await pg.evaluate(() => W.replanFacts(W.P.days[2], W.P).find(o => o.slot === 'am'));
  t.ok(fb.booked === true && !('options' in fb), 'a booked stop is marked booked and offers no options');
  await reset(); await pin('09:00:00');
  const opts = await pg.evaluate(() => W.replanFacts(W.P.days[2], W.P)); const amO = opts.find(o => o.slot === 'am'), pmO = opts.find(o => o.slot === 'pm');
  const pmN = await pg.evaluate(() => { const d = W.P.days[2], q = W.slotOptions(d, 'pm', W.P); return q.length > 6 ? q[6].it.n : null; });
  t.ok(pmN && !pmO.options.includes(pmN), 'the afternoon has a seventh place in the town\'s list that Claude is not told about: ' + pmN);
  const before = await state();
  await pg.evaluate(([amN, pmN, pmNow]) => { window.__replanAnswer = { say: 'S'.repeat(200), slots: [
    { slot: 'am', do: 'use', name: amN },                         /* a real option: swapped */
    { slot: 'pm', do: 'use', name: pmN },                         /* a real place of the town's, but not among the options it was given: ignored */
    { slot: 'eve', do: 'use', name: 'A place nobody listed' },    /* not on the town's list at all: ignored */
    { slot: 'lunch', do: 'use', name: amN },                      /* an option of the morning, not of lunch: ignored */
    { slot: 'breakfast', do: 'free', name: '' },                  /* already started: ignored */
    { slot: 'dinner', do: 'free', name: '' }, { slot: 'nowhere', do: 'free', name: '' }, null] }; }, [amO.options[0].name, pmN, pmO.now.name]);
  const asked = await pg.evaluate(async text => { const ok = W.replanAsk(W.P.days[2], W.P, text); await new Promise(r => setTimeout(r, 900)); return { ok, prompt: window.__replanPrompt || '' }; }, 'It\'s "raining",\nthe little one is tired');
  const after = await state(), A = by0(after), B0 = by0(before);
  t.eq([A.am.n, A.am.pick, A.am.mine], [amO.options[0].name, amO.options[0].name, true], 'Claude\'s swap to one of the morning\'s own options is made, and counts as chosen');
  t.ok(A.pm.n === B0.pm.n && A.lunch.n === B0.lunch.n && A.breakfast.n === B0.breakfast.n && !A.breakfast.free, 'a name that is not that stop\'s option, one that belongs to another stop, and a stop that has started are all ignored');
  t.ok(A.dinner.n === null && A.dinner.free && A.eve.n === B0.eve.n, '"free" frees the dinner; "keep" keeps; a slot that does not exist is ignored');
  const rec = Object.values(after.rescued)[0] || {};
  t.ok(rec.mode === 'ask' && rec.n === 2 && rec.freed === 1 && rec.say === 'S'.repeat(160), 'the record says "ask", two changes, one freed, and Claude\'s words cut at 160: ' + JSON.stringify({ mode: rec.mode, n: rec.n, freed: rec.freed, say: (rec.say || '').length }));
  t.ok(/^Replan the rest of today for a family on a trip\./.test(asked.prompt) && asked.prompt.includes('What they said: "It\'s raining , the little one is tired"'), 'the sentence goes in with its quote marks and line break taken out');
  t.ok(asked.prompt.includes('Time now: 9:00 AM.') && asked.prompt.includes('Travelers: 2 adults, children aged 6, 3.') && asked.prompt.includes('Nap planned ' + facts.nap + '.'), 'and the time, the party and the nap: ' + (asked.prompt.match(/Time now.*?Nap planned [^.]*\./) || [''])[0]);
  const data = JSON.parse(asked.prompt.slice(asked.prompt.indexOf('DATA:') + 5).split('\n')[0]);
  t.eq(data.map(o => o.slot), ['am', 'lunch', 'pm', 'dinner', 'eve'], 'the stops it is given are the ones above');
  t.ok(/A stop marked booked must be kept/.test(asked.prompt) && /copy the name exactly/.test(asked.prompt), 'with the rules for its answer');
  await pg.evaluate(() => W.unrescue(W.P.days[2])); await pg.evaluate(() => { W.replan(); W.dataV++; W.render(); });
  t.eq((await state()).slots, before.slots, 'Undo puts the day back after a sentence too');

  /* ---- W.rescueApply itself checks every action again ---- */
  await reset(); await pin('09:00:00');
  const dir = async (acts) => pg.evaluate(a => { const r = W.rescueApply(W.P.days[2], W.P, a, ''); return r && r.changed.length; }, acts);
  t.eq(await dir([{ slot: 'breakfast', do: 'free' }]), 0, 'a stop that has started is not freed, whoever asks');
  await book('am');
  t.eq(await dir([{ slot: 'am', do: 'free' }]), 0, 'a booked stop is not freed');
  const same = await pg.evaluate(() => W.P.days[2].slots[3].item.n);
  t.eq(await dir([{ slot: 'pm', do: 'use', name: same }]), 0, 'swapping a stop for the place it already is changes nothing');
  const other = await pg.evaluate(() => W.P.days[2].slots[1].item.n);
  t.eq(await dir([{ slot: 'pm', do: 'use', name: other }]), 0, 'a place that is already planned elsewhere on the trip is not planned twice');
  await reset();

  /* ---- an answer that changes nothing, a sentence too short, a day with nothing left ---- */
  await pg.evaluate(() => { window.__replanAnswer = { say: 'It already fits.', slots: [{ slot: 'am', do: 'keep', name: '' }] }; });
  const none = await pg.evaluate(async () => { const ok = W.replanAsk(W.P.days[2], W.P, 'all good here'); await new Promise(r => setTimeout(r, 700)); return { ok, block: W.replanBlock ? W.replanBlock(W.P.days[2]) : '' }; });
  t.ok(none.ok && (await state()).undo.length === 0, 'an answer that keeps everything changes nothing and leaves no Undo');
  const short = await pg.evaluate(() => { const ok = W.replanAsk(W.P.days[2], W.P, '  hi '); return { ok, block: W.replanBlock ? W.replanBlock(W.P.days[2]) : '' }; });
  t.ok(short.ok === false, 'a sentence of under three characters is not sent');
  await pin('23:00:00');
  const late = await pg.evaluate(() => W.replanAsk(W.P.days[2], W.P, 'we are done for the day'));
  t.eq(late, false, 'at 11 pm there is nothing left to change, so Claude is not asked');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
