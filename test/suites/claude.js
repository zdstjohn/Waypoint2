/* Asking Claude about the plan: replan the rest of today from one sentence (checked, with undo), and "Check my plan"
   (reads the whole trip, lists problems, changes nothing). */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg);
  await pg.evaluate(() => { W.save && W.save(); localStorage.setItem('waypoint-now', '2027-06-09T10:40:00'); });
  await pg.reload(); await pg.waitForTimeout(2500); await settle(pg);
  await pg.waitForFunction(() => W.laterReady && !!document.getElementById('replanQ'), null, { timeout: 8000 }).catch(() => {});
  t.ok(await pg.$('#replanQ'), 'Today has a box to say what is going on');
  const snap = () => pg.evaluate(() => { const d = W.P.days[W.S.day - 1], T = W.dayTimes(d, W.P), nm = W.nowMin(); return d.slots.map(x => ({ slot: x.slot, n: x.item ? x.item.n : null, free: !!(W.S.free || {})[x.key], started: !!(T.rows[x.slot] && T.rows[x.slot].start != null && T.rows[x.slot].start <= nm + 5) })); });
  const before = await snap();

  /* nothing typed: a hint, and nothing is asked */
  await pg.click('[data-replan]'); await pg.waitForTimeout(300);
  t.ok(/Say what's going on/.test(await pg.evaluate(() => (document.querySelector('.gr-msg') || {}).textContent || '')), 'with nothing typed it asks for a sentence');
  t.ok(!(await pg.evaluate(() => window.__replanPrompt)), 'and asks Claude nothing');

  /* what is typed survives a redraw */
  await pg.fill('#replanQ', "It's raining, the little one is tired, we have three hours");
  await pg.evaluate(() => W.render()); await pg.waitForTimeout(200);
  t.eq(await pg.inputValue('#replanQ'), "It's raining, the little one is tired, we have three hours", 'the sentence survives a redraw');

  await pg.press('#replanQ', 'Enter'); await pg.waitForTimeout(250);
  t.ok(await pg.evaluate(() => !!document.querySelector('.gr-busy') || !!document.querySelector('.go-rescue.done')), 'Enter sends it, with a note while Claude works');
  await pg.waitForFunction(() => !!document.querySelector('.go-rescue.done'), null, { timeout: 6000 }).catch(() => {});
  const pr = await pg.evaluate(() => window.__replanPrompt || '');
  t.ok(/the little one is tired/.test(pr) && /Time now: /.test(pr) && /children aged/.test(pr), 'Claude gets the sentence, the time and who is traveling');
  const rest = JSON.parse(pr.slice(pr.indexOf('DATA:') + 5).split('\n')[0]);
  t.ok(rest.length && rest.every(r => !before.find(x => x.slot === r.slot).started), 'only stops still to come are offered: ' + rest.map(r => r.slot));
  t.ok(rest.some(r => r.options && r.options.length), 'each with other places it may be swapped for');
  const after = await snap(), note = await pg.evaluate(() => (document.querySelector('.go-rescue.done .gr-k') || {}).textContent || '');
  const target = rest.find(r => !r.booked && r.now && r.options.length && !/breakfast|lunch|dinner/.test(r.slot));
  if (target) t.eq(after.find(x => x.slot === target.slot).n, target.options[0].name, 'the stop Claude swapped is on the day');
  else t.note('no outing left to swap on this day');
  if (rest.some(r => r.slot === 'eve' && !r.booked)) t.ok(after.find(x => x.slot === 'eve').free && !after.find(x => x.slot === 'eve').n, 'the evening it freed is free');
  t.ok(before.filter(x => x.started).every(x => after.find(y => y.slot === x.slot).n === x.n), 'what has started is untouched (Claude asked to free breakfast)');
  t.ok(!after.some(x => x.n === 'A place that is not on the list'), 'a place that is not on the list is refused');
  t.ok(/^Replanned: /.test(note) && /Indoors and close by/.test(note), 'the screen says what changed, in Claude\'s words: ' + note);
  await pg.click('[data-unrescue]'); await pg.waitForTimeout(600);
  const undone = await snap();
  t.eq(undone.map((u, i) => before[i].n ? u.n : u.free ? 'freed' : 'ok'), before.map(x => x.n || 'ok'), 'Undo puts the day back');

  /* an answer that changes nothing says so, and leaves no Undo */
  await pg.evaluate(() => { window.__replanAnswer = { say: 'It already fits.', slots: [] }; });
  await pg.fill('#replanQ', 'all good here'); await pg.click('[data-replan]');
  await pg.waitForFunction(() => /keep the rest of today/.test((document.querySelector('.gr-msg') || {}).textContent || ''), null, { timeout: 6000 }).catch(() => {});
  t.ok(/keep the rest of today as it is\. It already fits\./.test(await pg.evaluate(() => (document.querySelector('.gr-msg') || {}).textContent || '')), 'no change needed is said plainly');
  t.ok(!(await pg.$('[data-unrescue]')), 'with nothing to undo');

  /* ---- Check my plan ---- */
  await pg.evaluate(() => { W.setAppMode('plan'); }); await pg.waitForTimeout(900);
  await pg.evaluate(() => { W.S.tview = 'days'; W.S.glanceOpen = true; W.setView('trip'); W.render(); window.scrollTo(0, 0); }); await pg.waitForTimeout(400);
  t.ok(await pg.$('.all-days [data-review]'), 'All days offers "Check my plan"');
  const picks0 = await pg.evaluate(() => JSON.stringify(W.S.picks));
  await pg.click('.all-days [data-review]'); await pg.waitForTimeout(100);
  const rd = await pg.evaluate(() => (document.querySelector('.pcheck .loading') || {}).textContent || document.querySelector('.all-days').innerHTML.slice(0, 600)); t.ok(/reading your \d+ days/.test(rd), 'it says Claude is reading the plan: ' + rd.slice(0, 300));
  await pg.waitForFunction(() => !!document.querySelector('.pcheck .pcheck-l'), null, { timeout: 6000 }).catch(() => {});
  const rv = await pg.evaluate(() => ({ items: [...document.querySelectorAll('.pcheck-i')].map(li => ({ w: li.querySelector('.pcheck-w').textContent, k: li.querySelector('.pcheck-k').textContent, t: li.querySelector('.pcheck-t').textContent, f: (li.querySelector('.pcheck-f') || {}).textContent || '', go: (li.querySelector('[data-day]') || {}).textContent || '' })),
    ok: (document.querySelector('.pcheck-ok') || {}).textContent, imgs: document.querySelectorAll('.pcheck img, .pcheck-f b b').length, xss: window.__xss || 0, stale: !!document.querySelector('.pcheck-stale') }));
  t.eq(rv.items.length, 3, 'the findings are listed; a day that is not in the trip and one with no text are dropped: ' + JSON.stringify(rv.items.map(i => i.w)));
  t.ok(/^Day 2 · /.test(rv.items[0].w) && rv.items[0].k === 'A lot on foot' && /Try: Drop one stop/.test(rv.items[0].f) && /Open Day 2/.test(rv.items[0].go), 'each says which day, what kind, a fix, and opens the day: ' + JSON.stringify(rv.items[0]));
  t.ok(rv.items[2].k === 'Worth a look' && /<img/.test(rv.items[2].t) && rv.imgs === 0 && !rv.xss, 'markup in an answer is shown as text, never run');
  t.ok(/alternate nicely/.test(rv.ok || '') && !rv.stale, 'with what is already good, and no "changed since" note');
  const fp = await pg.evaluate(() => window.__reviewPrompt || ''), facts = JSON.parse(fp.slice(fp.indexOf('DATA:') + 5).split('\n')[0]);
  t.ok(facts.length === await pg.evaluate(() => W.P.N) && facts.every(d => d.weekday && d.date && Array.isArray(d.stops)) && facts.some(d => d.stops.some(s => s.from && s.name && 'indoor' in s)), 'Claude is shown every day with dates, times and what each stop is like');
  t.ok(!/@|gmail|AIza/.test(fp), 'and nothing personal beyond ages: no email, no keys');
  t.eq(await pg.evaluate(() => JSON.stringify(W.S.picks)), picks0, 'checking changes nothing in the plan');

  /* kept across a reload without asking again; a changed plan says so */
  await pg.reload(); await pg.waitForTimeout(2500); await settle(pg);
  await pg.evaluate(() => { W.setAppMode && W.view() === 'go' && W.setAppMode('plan'); }); await pg.waitForTimeout(600);
  await pg.evaluate(() => { W.S.tview = 'days'; W.S.glanceOpen = true; W.setView('trip'); W.render(); }); 
  await pg.waitForFunction(() => !!document.querySelector('.pcheck .pcheck-l'), null, { timeout: 8000 }).catch(() => {});
  t.ok(await pg.evaluate(() => document.querySelectorAll('.pcheck-i').length === 3 && !window.__reviewAsked), 'the check is still there after a reload, without asking again');
  await pg.evaluate(() => { const d = W.P.days[3] || W.P.days[0], x = d.slots.find(y => y.item && !W.isFood(y.slot)); W.reroll(d, x.slot, W.P); W.render(); }); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(() => !!document.querySelector('.pcheck-stale')), 'after the plan changes the card says the check is out of date');
  await pg.click('.pcheck [data-day="2"]'); await pg.waitForTimeout(900);
  t.ok(await pg.evaluate(() => W.S.day === 2 && !W.S.glanceOpen), '"Open Day 2" opens that day');

  /* the trip menu goes straight to it and asks */
  await pg.click('[data-sync="menu"]'); await pg.waitForTimeout(400);
  t.ok(await pg.$('[data-sync="review"]'), 'the trip menu has "Check my plan"');
  await pg.click('[data-sync="review"]');
  await pg.waitForFunction(() => window.__reviewAsked === 1 && !!document.querySelector('.pcheck .pcheck-l') && !document.querySelector('.pcheck-stale'), null, { timeout: 8000 }).catch(() => {});
  t.ok(await pg.evaluate(() => W.S.glanceOpen && window.__reviewAsked === 1 && !document.querySelector('.pcheck-stale')), 'from the menu it opens All days and checks the plan as it is now');
  t.eq(errors(), [], 'no page errors');
  await b.close();
};
