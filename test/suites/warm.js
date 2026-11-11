/* Waypoint, warmly: names typed in Plan are used everywhere (the greeting, "Great for Mila & Leo", "Easy for Joe", a
   kid's pick); the banner says the time and sky where you're going; no postcard; milestones cheer once, with the real count; the kids' view saves picks, stamps and finds without re-planning;
   Prepare shows how ready you are; a day's mood is saved and the recap's highlight reel counts it; a year later, the trip
   says hello. A shared (read-only) trip shows none of the nudges. */
const { launch, open, settle, calm } = require('../lib/page'); const mkdb = require('../lib/db');
const GR = [['Chania', 35.5138, 24.018], ['Rethymno', 35.3644, 24.4822], ['Heraklion', 35.3387, 25.1442]];
const px = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
exports.run = async t => {
  const items = {}; GR.forEach(([c]) => ['beach', 'adventure', 'family', 'culture'].forEach(k => { for (let i = 0; i < 16; i++) items[(c + ' ' + k + ' pick ' + i).toLowerCase()] = { url: px + '#' + i, credit: 'Test', page: 'x' }; }));
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, tz: 'America/Los_Angeles', db: mkdb({ 'photos/greece-chania': { items, city: 'Chania', country: 'Greece' } }) });
  await pg.evaluate(G => {
    localStorage.setItem('waypoint-now', '2026-11-08T15:00'); W.isExample = false;
    W.C.country.Greece = { cities: G.map(c => ({ name: c[0], lat: c[1], lng: c[2], w: 3, pop: 3, t: ['beach', 'family'], d: c[0] + ' is a harbour town of Venetian lanes.' })) };
    Object.assign(W.S, { tripName: 'Greece trip', styles: ['beach', 'family', 'food'], travelers: [36, 34, 4, 2, 68], names: [], depart: 'Seattle (SEA)', start: '2027-04-23', days: 20, cityDays: {}, picks: {}, seen: {}, mine: {}, legPick: {}, fold: {}, rest: {},
      day: 2, tview: 'days', glanceOpen: false, stepClosed: { who: false }, celebrated: {}, kidPicks: {}, stamps: {}, hunt: {}, journal: {}, warmSeen: '',
      countries: [{ name: 'Greece', mode: 'manual', picked: ['Chania', 'Rethymno', 'Heraklion'] }] });
    W.setView('setup'); W.render();
  }, GR);

  /* names are typed in Plan, next to each traveler's age */
  const nm = ['Zach', 'Anna', 'Mila', 'Leo', 'Joe'];
  for (let i = 0; i < nm.length; i++) { await pg.fill('#nm' + i, nm[i]); await pg.dispatchEvent('#nm' + i, 'change'); }
  const named = await pg.evaluate(() => ({ names: (W.S.names || []).join(','), fam: W.familyLine(), kids: W.kidNames(13), elders: W.elderNames() }));
  t.eq(named.names, 'Zach,Anna,Mila,Leo,Joe', 'a name typed in Plan is saved with the trip');
  t.ok(/Mila/.test(named.fam) && named.kids.join() === 'Mila,Leo' && named.elders.join() === 'Joe', `the family by name (${named.fam})`);

  await pg.evaluate(() => { W.setView('trip'); W.render(); }); await calm(pg, 10000);
  const trip = await pg.evaluate(() => {
    const top = document.querySelector('.top'), line = document.getElementById('topline'), tags = [...document.querySelectorAll('#viewTrip .gt')].map(e => e.textContent);
    const pc = document.querySelector('#viewTrip .postcard');
    return { line: line ? line.textContent : '', sky: top && top.getAttribute('data-sky'), great: tags.filter(x => /^Great for Mila & Leo$/.test(x)).length, easy: tags.filter(x => /^Easy for Joe$/.test(x)).length,
      pc: !!pc, postcardFn: typeof W.postcard };
  });
  t.ok(/^Good (morning|afternoon|evening), Zach/.test(trip.line) && /in Chania/.test(trip.line), `the banner greets you and says the time there (${trip.line})`);
  t.ok(['dawn', 'day', 'dusk', 'night'].includes(trip.sky), `the banner knows the hour where you're going (${trip.sky}), for the sun or moon by the time`);
  const bg = await pg.evaluate(() => { const top = document.querySelector('.top'), was = top.getAttribute('data-sky'), out = {};
    ['dawn', 'day', 'dusk', 'night'].forEach(k => { top.setAttribute('data-sky', k); out[k] = getComputedStyle(top).backgroundImage; }); top.setAttribute('data-sky', was); return out; });
  t.ok(new Set(Object.values(bg)).size === 1 && /linear-gradient/.test(bg.day), 'the banner keeps its one gradient at every hour');
  t.ok(trip.great > 0 && trip.easy > 0, `stop cards name who they suit (${trip.great} for the kids, ${trip.easy} for Joe)`);
  t.ok(!trip.pc && trip.postcardFn === 'undefined', 'no postcard above the day before the trip (removed)');

  /* milestones: a week out cheers once, with the count the banner shows */
  const ms = await pg.evaluate(async () => {
    localStorage.setItem('waypoint-now', '2027-04-17T09:00'); W.render();
    await new Promise(r => setTimeout(r, 900));
    const cheer = document.querySelector('#cheerhost .cheer'), title = cheer ? cheer.querySelector('b').textContent : '', banner = document.querySelector('.ts-c') ? document.querySelector('.ts-c').textContent : '';
    const cel = Object.assign({}, W.S.celebrated); W.render(); await new Promise(r => setTimeout(r, 700));
    const again = W.milestone(W.P);
    return { title, banner, cel, again: again && again.key };
  });
  t.ok(ms.title === '6 days to go!' && /6/.test(ms.banner), `a milestone cheers with the real count (${ms.title} / ${ms.banner})`);
  t.ok(ms.cel.d7 && ms.cel.d30 === 'skipped' && ms.cel.d100 === 'skipped' && ms.again !== 'd7', 'each milestone cheers once; the bigger ones it passed are not owed');

  /* the kids' view: a pick, a stamp and a find are saved, and the plan is not re-run for them */
  await pg.evaluate(() => W.goView('kids')); await pg.waitForTimeout(600);
  const kids = await pg.evaluate(() => {
    const v = document.getElementById('viewKids'), P0 = W.plan();
    const heart = v.querySelector('[data-kpick][data-kname="Mila"]'), place = heart && heart.getAttribute('data-kpick'); heart.click();
    v.querySelector('[data-ktab="pass"]').click(); const st = document.querySelector('#viewKids .stamp:not([disabled])'); st && st.click();
    document.querySelector('#viewKids [data-ktab="hunt"]').click(); document.querySelector('#viewKids [data-hunt]').click();
    const P1 = W.plan();
    return { shown: !v.hidden, hi: /Mila & Leo/.test(v.textContent), place, picks: JSON.stringify(W.S.kidPicks), stamps: Object.keys(W.S.stamps || {}).length, hunt: JSON.stringify(W.S.hunt), same: P0 === P1 };
  });
  t.ok(kids.shown && kids.hi, 'the kids\' view says hello to the kids by name');
  t.ok(/Mila/.test(kids.picks) && kids.stamps === 1 && /"1"|"0"/.test(kids.hunt), `a pick, a passport stamp and a treasure-hunt find are saved (${kids.picks})`);
  /* the kids' corner is drawn: the night sky, a stamp for every place (inked once stamped), a numbered spot or a coin for
     every find, and the chest that opens when all six are found */
  const drawn = await pg.evaluate(async () => {
    const v = document.querySelector('#viewKids'), wait = ms => new Promise(r => setTimeout(r, ms));
    v.querySelector('[data-ktab="pass"]').click(); await wait(150);
    const pass = { sky: !!v.querySelector('.k-hero .k-sky'), stamps: v.querySelectorAll('.stamp .st-svg').length, places: v.querySelectorAll('.stamp').length, inked: v.querySelectorAll('.stamp.on .st-svg [transform="translate(40 40)"]').length, on: v.querySelectorAll('.stamp.on').length,
      named: [...v.querySelectorAll('.stamp')].every(b => /stamped|not yet/.test(b.getAttribute('aria-label'))) };
    v.querySelector('[data-ktab="hunt"]').click(); await wait(150);
    const before = { spots: v.querySelectorAll('.k-hunt .hk-svg').length, open: !!v.querySelector('.k-treasure.open'), chest: !!v.querySelector('.k-treasure .k-chest') };
    for (const b of [...v.querySelectorAll('.k-hunt button:not(.on)')]) { v.querySelector('[data-hi="' + b.dataset.hi + '"]').click(); await wait(60); }
    return { pass, before, open: !!document.querySelector('#viewKids .k-treasure.open .k-chest.open'), all: document.querySelectorAll('#viewKids .k-hunt button.on').length };
  });
  t.ok(drawn.pass.sky && drawn.pass.stamps === drawn.pass.places && drawn.pass.places > 0 && drawn.pass.on > 0 && drawn.pass.inked === drawn.pass.on && drawn.pass.named, 'the passport is drawn: a stamp for every place, inked where stamped, each still named for screen readers: ' + JSON.stringify(drawn.pass));
  t.ok(drawn.before.spots === 6 && drawn.before.chest && !drawn.before.open && drawn.open && drawn.all === 6, 'the treasure map has six spots and a chest that opens when all are found: ' + JSON.stringify(drawn));
  t.ok(kids.same, 'none of them re-plans the trip');
  const pick = await pg.evaluate(name => { W.goView('trip'); const card = [...document.querySelectorAll('#viewTrip .slot')].find(s => s.textContent.includes(name)); return { found: !!card || W.P.days.some(d => (d.slots || []).some(x => x.item && x.item.n === name)), tag: [...document.querySelectorAll('#viewTrip .gt.pick')].map(e => e.textContent) }; }, kids.place);
  await pg.evaluate(name => { const d = W.P.days.find(d => (d.slots || []).some(x => x.item && x.item.n === name)); if (d) { W.S.day = d.n; W.render(); } }, kids.place);
  const tag = await pg.evaluate(() => [...document.querySelectorAll('#viewTrip .gt.pick')].map(e => e.textContent));
  t.ok(pick.found && tag.includes('♥ Mila\'s pick'), `the trip shows the kid's pick on that stop (${tag.join(', ')})`);

  /* Prepare: how ready you are */
  const ready = await pg.evaluate(() => { W.goView('book'); const r = document.querySelector('.ready'); return r ? r.textContent.replace(/\s+/g, ' ') : ''; });
  t.ok(/\d+% ready/.test(ready), `Prepare shows how ready you are (${ready.slice(0, 40)})`);

  /* during the trip: a great day is saved and the recap counts it */
  await pg.evaluate(() => { localStorage.setItem('waypoint-now', '2027-04-26T19:30'); W.S.appMode = 'plan'; W.S.appModeAt = '2027-04-26'; W.S.day = 4; W.goView('trip'); }); await pg.waitForTimeout(700);
  /* the journal lives on Today: Trip has a button that goes there */
  const jt = await pg.evaluate(() => ({ card: !!document.querySelector('#viewTrip .journal'), btn: !!document.querySelector('#viewTrip .j-go') }));
  t.ok(!jt.card && jt.btn, 'on Trip the journal is a button to Today, not the card itself: ' + JSON.stringify(jt));
  await pg.click('#viewTrip .j-go'); await pg.waitForTimeout(800);
  const jl = await pg.evaluate(() => { const j = document.querySelector('#viewGo .journal'), r = j && j.getBoundingClientRect(), max = document.documentElement.scrollHeight - innerHeight;
    return { go: W.view() === 'go', top: r ? Math.round(r.top) : null, y: Math.round(window.pageYOffset), atEnd: Math.abs(window.pageYOffset - max) < 3, vh: innerHeight }; });
  /* at the top of the screen, or as far as the page goes when the journal is near its end, with the journal in view */
  t.ok(jl.go && jl.top != null && jl.top >= 0 && jl.y > 0 && (jl.top < 80 || (jl.atEnd && jl.top < jl.vh - 120)), 'and it opens Today on that day, scrolled to the journal (not the top): ' + JSON.stringify(jl));
  /* Add photos: the picker lives outside the card, so Today redrawing while you choose doesn't lose the photos */
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAFUlEQVR4XmM8UWHDAANMcBYDAyoHADgUAYI1WdN0AAAAAElFTkSuQmCC', 'base64');
  const [chooser] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null), pg.click('#viewGo .journal [data-jadd]')]);
  await pg.evaluate(() => { W.render(); W.changed(); W.render(); });
  if (chooser) await chooser.setFiles({ name: 'beach.png', mimeType: 'image/png', buffer: png });
  await pg.waitForFunction(() => Object.values(W.S.journal || {}).some(e => (e.photos || []).length), null, { timeout: 8000 }).catch(() => {});
  t.ok(!!chooser && await pg.evaluate(() => Object.values(W.S.journal || {}).some(e => (e.photos || []).length) && window.__assets.length > 0), '"Add photos" opens the photo picker, and a photo chosen while Today redraws is added to the day');
  await pg.click('#viewGo .journal [data-mood="3"]'); await pg.waitForTimeout(400);
  const mood = await pg.evaluate(() => { const k = Object.keys(W.S.journal || {}).find(k => W.S.journal[k].mood === 3); return { k, on: !!document.querySelector('.journal [data-mood="3"][aria-checked="true"]'), cheer: (document.querySelector('#cheerhost b') || {}).textContent }; });
  t.ok(mood.k && mood.on && mood.cheer === 'Wonderful!', 'a great day is saved with the journal, with a cheer');
  const reel = await pg.evaluate(() => { localStorage.setItem('waypoint-now', '2027-05-20T10:00'); W.goView('recap'); const r = document.querySelector('.reel'); return r ? { n: r.querySelectorAll('.rt').length, txt: r.textContent.replace(/\s+/g, ' '), send: !!document.querySelector('[data-sendhome]') } : null; });
  t.ok(reel && reel.n >= 4 && /20\s*days/.test(reel.txt) && /1\s*great day/.test(reel.txt) && reel.send, `the recap's highlight reel (${reel && reel.txt.slice(0, 70)})`);

  /* a year later */
  const ann = await pg.evaluate(() => { localStorage.setItem('waypoint-now', '2028-04-26T10:00'); W.goView('trip'); const a = document.querySelector('.postcard.ann'); return a ? a.textContent.replace(/\s+/g, ' ') : ''; });
  t.ok(/One year ago today/.test(ann) && /You were in Chania/.test(ann), 'a year later, the trip says hello');

  /* a shared copy: no nudges */
  const ro = await pg.evaluate(() => { localStorage.setItem('waypoint-now', '2027-04-10T09:00'); W.readOnly = true; const r = { m: W.milestone(W.P) }; W.readOnly = false; return r; });
  t.ok(ro.m === null, 'a shared, read-only trip gets no milestones');

  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
