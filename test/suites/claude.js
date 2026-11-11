/* Asking Claude about the plan: replan the rest of today from one sentence (checked, with undo), and "Check my plan"
   (reads the whole trip, lists problems, changes nothing). */
const { launch, open, exampleTrip, settle, calm } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg);
  await pg.evaluate(() => { W.save && W.save(); localStorage.setItem('waypoint-now', '2027-06-09T10:40:00'); });
  await pg.reload(); await calm(pg, 5000);
  await pg.waitForFunction(() => W.laterReady && !!document.querySelector('#viewGo [data-goplans]'), null, { timeout: 8000 }).catch(() => {});
  t.ok(!(await pg.$('#replanQ')) && !(await pg.$('#viewGo .go-rescue')) && await pg.$('#viewGo [data-goplans]'), 'Today keeps the ways to rescue the day behind one button, "Change of plans", in the row under "Running late?"');
  await pg.click('#viewGo [data-goplans]'); await pg.waitForFunction(() => !!document.getElementById('replanQ'), null, { timeout: 4000 }).catch(() => {});
  t.ok(await pg.$('#replanQ') && await pg.evaluate(() => document.querySelector('[data-goplans]').getAttribute('aria-expanded') === 'true' && document.querySelectorAll('.go-rescue [data-rescue]').length === 4), 'opened, it has the four rescues and a box to say what is going on');
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
  await pg.reload(); await calm(pg, 5000);
  await pg.evaluate(() => { W.setAppMode && W.view() === 'go' && W.setAppMode('plan'); }); await pg.waitForTimeout(600);
  await pg.evaluate(() => { W.S.tview = 'days'; W.S.glanceOpen = true; W.setView('trip'); W.render(); }); 
  await pg.waitForFunction(() => !!document.querySelector('.pcheck .pcheck-l'), null, { timeout: 8000 }).catch(() => {});
  /* each card has the page's card colour, not the kids' storybook page (.k-book once matched a "Book ahead" card) */
  const pcBg = await pg.evaluate(() => { const card = getComputedStyle(document.querySelector('.pcheck')).backgroundColor; return [...document.querySelectorAll('.pcheck-i')].map(li => { const c = getComputedStyle(li); return { bg: c.backgroundColor, img: c.backgroundImage, cls: li.className }; }).concat([{ card }]); });
  t.ok(pcBg.slice(0, -1).every(x => x.img === 'none' && !/(^|\s)k-/.test(x.cls)), 'the plan check\'s cards have their own plain background, none of the kids\' storybook paper: ' + JSON.stringify(pcBg.slice(0, 2)));
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
  /* ---- the first ideas come sooner: lists taken in as they are written, a smaller first question, and a country's
     best-known places before its whole list ---- */
  { const { pg: ps, ctx: cs, errors: es } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(ps);
    /* a stand-in that writes its answer a piece at a time, as Claude does */
    await ps.evaluate(() => {
      window.__asked = []; window.__gate = {};
      const real = W.SAMPLE.json.bind(W.SAMPLE);
      W.SAMPLE.json = function (prompt, opts) {
        window.__asked.push({ head: prompt.slice(0, 90), opts: Object.assign({}, opts, { onText: !!(opts && opts.onText) }), book: /"book"/.test(prompt), menu: /"menu"/.test(prompt) });
        const m = /^List the (\d+) best things to do in and around ([^,]+), ([^,]+), most important first/.exec(prompt), c = /^List the cities, towns and areas that travelers visit in ([A-Za-z ]+), the best known first/.exec(prompt);
        if (!(opts && opts.onText) || !(m || c)) return real(prompt, opts);
        const n = m ? +m[1] : 20, name = m ? m[2] : c[1], list = m ? 'spots' : 'cities';
        const item = i => m ? { n: name + ' written ' + i, d: 'A sight', t: ['culture'], k: 0, s: ['am', 'pm', 'eve'][i % 3], dur: '1-2h', ticket: i % 2 ? '€10, book ahead' : 'Free', pic: 'oldtown', place: 'Place ' + i, lat: 45.81 + i * 0.002, lng: 15.98 + i * 0.002 }
          : { name: ['Zagreb', 'Split', 'Dubrovnik', 'Zadar', 'Rovinj', 'Pula', 'Plitvice', 'Trogir', 'Sibenik', 'Opatija', 'Makarska', 'Osijek', 'Varazdin', 'Rijeka', 'Porec', 'Motovun', 'Omis', 'Nin', 'Ston', 'Cavtat'][i], region: 'Region', isl: '', lat: 45.81 - i * 0.12, lng: 15.98 + i * 0.05, w: 2, pop: 5 - Math.floor(i / 5), t: i > 14 ? ['culture', 'food', 'relax'] : [], d: 'Known for ' + i };
        const all = []; for (let i = 0; i < n; i++) all.push(item(i));
        const whole = m ? { d: 'A city', lat: 45.81, lng: 15.98, spots: all } : { blurb: 'A coast of islands', cities: all }, text = JSON.stringify(whole);
        /* written in three pieces: up to the middle of item 3 (or 9), then to the middle of a later item, then the rest when the test says so */
        const cut = k => text.indexOf(JSON.stringify(all[k])) + 12;
        return new Promise(res => {
          setTimeout(() => opts.onText({ text: text.slice(0, cut(m ? 3 : 9)), delta: 'x' }), 150);
          window.__gate[list] = () => { opts.onText({ text, delta: 'y' }); setTimeout(() => res(whole), 50); };
        });
      };
    });
    /* a long stay in a city with no ideas yet: 12 are asked for first, without links, and taken in as they are written */
    const early = await ps.evaluate(async () => {
      W.S.countries = [{ name: 'Croatia', mode: 'manual', picked: ['Zagreb'] }]; W.S.cityDays = { 'Croatia|Zagreb': 5 }; W.S.days = 5; W.S.picks = {}; W.S.mine = {}; W.S.day = 1; W.changed();
      for (let i = 0; i < 40 && !((W.C.city['Croatia|Zagreb'] || {}).spots || []).length; i++) await new Promise(r => setTimeout(r, 100));
      await new Promise(r => setTimeout(r, 300));
      const pool = W.C.city['Croatia|Zagreb'] || {}, P = W.plan(), d1 = P.days[0];
      const q = window.__asked.filter(x => /^List/.test(x.head) && /Zagreb/.test(x.head));
      W.goView('trip'); W.S.tview = 'days'; W.render();
      return { note: (document.querySelector('#viewTrip .arriving') || {}).textContent || '', got: (pool.spots || []).map(x => x.n), busy: W.status['spots|Croatia|Zagreb'], pin: pool.lat, planned: (d1.slots || []).filter(x => x.item && /written/.test(x.item.n)).length, bookV: (pool.spots[0] || {}).bookV,
        first: q.map(x => x.head.replace(/ in (and around )?Zagreb.*/, '')), links: q.map(x => x.book || x.menu), streamed: q.map(x => x.opts.onText) };
    });
    t.eq(early.got, ['Zagreb written 0', 'Zagreb written 1', 'Zagreb written 2'], 'the places written so far are taken in while the rest is still being written (a half-written one waits)');
    t.ok(early.busy === 'loading' && early.pin === 45.81 && early.planned >= 1, 'the city has its pin and the day already shows some of them: ' + JSON.stringify([early.busy, early.pin, early.planned]));
    t.ok(/More ideas for Zagreb are on the way/.test(early.note), 'and the day says more ideas are on the way (' + early.note + ')');
    t.eq([early.first, early.links, early.streamed], [['List the 12 best things to do', 'List 12 places to eat'], [false, false], [true, true]], 'a 5-day stay asks for 12 of each first, without booking or menu links, each taken in as it is written');
    t.ok(early.bookV === undefined, 'a place from a list without links is left for the later check of its links');
    const whole = await ps.evaluate(async () => {
      window.__gate.spots(); await new Promise(r => setTimeout(r, 400));
      for (let i = 0; i < 60 && W.cityBusy('Croatia|Zagreb'); i++) await new Promise(r => setTimeout(r, 100));
      await new Promise(r => setTimeout(r, 1500));
      const pool = W.C.city['Croatia|Zagreb'], more = window.__asked.filter(x => /MORE/.test(x.head) && /Zagreb/.test(x.head)).map(x => x.head.replace(/ in (and around )?Zagreb.*/, ''));
      W.render();
      return { note: !!document.querySelector('#viewTrip .arriving'), n: pool.spots.filter(x => /written/.test(x.n)).length, order: pool.spots.slice(0, 3).map(x => x.n.slice(-1)).join(''), asked: pool.askedN, more };
    });
    t.ok(whole.n === 12 && whole.order === '012' && !whole.note, 'when the whole list is in, each place is there once, in the list\'s own order, and the note is gone: ' + JSON.stringify(whole));
    t.ok(whole.asked >= 12 && whole.more.some(h => /^List 11 MORE things to do/.test(h)) && whole.more.some(h => /^List 11 MORE places to eat/.test(h)), 'the rest of the stay\'s 23 come afterwards, in the background: ' + JSON.stringify(whole.more));
    /* a short stay asks for its 15 at once */
    const short = await ps.evaluate(async () => {
      window.__asked.length = 0; W.S.countries[0].picked = ['Zagreb', 'Zadar']; W.S.cityDays = { 'Croatia|Zagreb': 5, 'Croatia|Zadar': 2 }; W.S.days = 7; W.changed();
      /* (its lists are asked for a moment later than the rest: the device is first asked whether it already keeps them) */
      for (let i = 0; i < 40 && window.__asked.filter(x => /^List/.test(x.head) && /Zadar/.test(x.head)).length < 2; i++) await new Promise(r => setTimeout(r, 100));
      return window.__asked.filter(x => /Zadar/.test(x.head) && /^List/.test(x.head)).map(x => x.head.replace(/ in (and around )?Zadar.*/, ''));
    });
    t.ok(short.includes('List the 15 best things to do') && short.includes('List 15 places to eat'), 'a 2-day stay asks for its 15 at once: ' + JSON.stringify(short));
    /* suggested places in a country with no list: the plan starts on the first eight (the best known) and keeps them */
    const cz = await ps.evaluate(async () => {
      delete W.C.country.Croatia; Object.keys(W.status).forEach(k => { if (/^country\|/.test(k)) delete W.status[k]; });
      W.S.countries = [{ name: 'Croatia', mode: 'suggest', picked: [] }]; W.S.cityDays = {}; W.S.days = 9; W.changed();
      for (let i = 0; i < 40 && !(W.C.country.Croatia && W.C.country.Croatia.part); i++) await new Promise(r => setTimeout(r, 100));
      const cc = W.C.country.Croatia || {}, part = { n: (cc.cities || []).length, top: (cc.cities || []).every(c => c.top === 1), busy: W.status['country|Croatia'], stops: W.plan().stops.map(s => s.name) };
      window.__gate.cities(); for (let i = 0; i < 40 && !(W.C.country.Croatia.v >= 2); i++) await new Promise(r => setTimeout(r, 100));
      const full = W.C.country.Croatia;
      return { part, n: full.cities.length, first: full.cities.slice(0, 8).map(c => c.name), tops: full.cities.filter(c => c.top).length, isPart: !!full.part, stops: W.plan().stops.map(s => s.name), asked: window.__asked.filter(x => /^List the cities/.test(x.head)).length };
    });
    t.ok(cz.part.n === 8 && cz.part.top && cz.part.busy === 'loading' && cz.part.stops.length >= 2, 'the plan starts on the country\'s first eight places while the rest of its list is written: ' + JSON.stringify(cz.part));
    t.ok(cz.n === 20 && cz.tops === 8 && !cz.isPart && cz.first.join() === 'Zagreb,Split,Dubrovnik,Zadar,Rovinj,Pula,Plitvice,Trogir' && cz.asked === 1, 'the whole list keeps those eight first, from one question: ' + JSON.stringify([cz.n, cz.tops, cz.asked]));
    t.eq(cz.stops, cz.part.stops, 'and the stops chosen do not change when it arrives, though later places would score higher');
    /* the options a request is made with */
    const eo = await ps.evaluate(() => { const a = W.askOpts('spots|Italy|Rome', 'default'); W.EFFORT.spots = 'low'; const b2 = W.askOpts('spots|Italy|Rome', 'default'), c = W.askOpts('food|Italy|Rome'); W.EFFORT = {}; return [a, b2, c]; });
    t.eq(eo, [{ modelTier: 'default' }, { modelTier: 'default', effort: 'low' }, { modelTier: 'default' }], 'how much Claude thinks first can be set by kind of request, and is left alone otherwise');
    t.eq(es(), [], 'faster first ideas: no page errors');
    await cs.close(); }
  t.eq(errors(), [], 'no page errors');
  /* the one-time speed measurement (lib/speedtest.js): the same list asked at the usual setting and at low effort, the
     result kept where it can be read back. Here with the stand-in's answers: what is checked is that it runs, measures
     both, and saves at a path the database accepts (the first version's path was refused, and nothing was saved). */
  { const S2 = await open(b, { width: 390, height: 844, db: mkdb(), init: 'window.__WP_SPEEDTEST = 1;' }); await exampleTrip(S2.pg);
    await S2.pg.evaluate(() => W.needLater());
    const doc = await S2.pg.evaluate(async () => { for (let i = 0; i < 150; i++) { const d = await window.__dbOp('get', 'data/users/u-test/diag/d/effort', null); if (d) return JSON.parse(d); await new Promise(r => setTimeout(r, 200)); } return null; });
    const mark = await S2.pg.evaluate(() => ({ key: localStorage.getItem('waypoint-speedtest-v2'), bad: window.__badPaths || [] }));
    t.ok(doc && doc.usual && doc.low && doc.usual.ok >= 8 && doc.low.ok >= 8 && doc.usual.ms >= 0 && doc.shared >= 8 && typeof doc.usual.pins[0] === 'string' && /Italy/.test(doc.city),
      'the speed measurement asks the list twice and saves what it measured: ' + JSON.stringify(doc && { city: doc.city, usual: [doc.usual.ms, doc.usual.ok], low: [doc.low.ms, doc.low.ok], shared: doc.shared, far: doc.pinsOver1km }));
    t.ok(mark.key === 'done' && !mark.bad.length, 'at a path the database accepts, once: ' + JSON.stringify(mark));
    t.eq(S2.errors(), [], 'no page errors during the measurement');
    await S2.ctx.close(); }
  await b.close();
};
