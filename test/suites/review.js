/* v150: what the code review found, held down. One odd answer from Claude cannot jam the queue; the shared list for
   the photo finder carries nothing private (in explore.js); the journal is kept as you type and when the page is
   hidden, and a photo that lands minutes after your last tap is sent; a stay you named whose place is not known yet
   gives directions by its name and town (never the middle of the town under its name), and is asked for again;
   walking counts towards a day's effort; Enter in the trip bar. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg); await settle(pg, 5000);

  /* one odd answer: three of them used to leave every list on "Gathering…" until a reload */
  const q = await pg.evaluate(async () => {
    const W0 = window.W, keys = ['odd|1', 'odd|2', 'odd|3', 'odd|4'];
    const real = W0.SAMPLE.json; W0.SAMPLE.json = () => Promise.resolve({ opts: 'none' });
    keys.forEach(k => W0.run(k, 'x', 'quick', r => { r.opts.forEach(() => {}); }));
    await new Promise(r => setTimeout(r, 600));
    W0.SAMPLE.json = () => Promise.resolve({ ok: 1 });
    let got = false; W0.run('odd|after', 'x', 'quick', r => { got = !!(r && r.ok); });
    await new Promise(r => setTimeout(r, 600)); W0.SAMPLE.json = real;
    return { got, status: keys.map(k => W0.status[k]) };
  });
  t.ok(q.got && q.status.every(s => /Try again/.test(s || '')), 'answers in a shape nobody expected end with "try again", and the next request still goes through: ' + JSON.stringify(q));

  /* the journal: typed, then the app goes to the background with the keyboard up, then a reload */
  const jn = await pg.evaluate(async () => {
    localStorage.setItem('waypoint-now', '2027-06-08T20:30:00'); W.needLater(); W.goView('go'); W.render(); await new Promise(r => setTimeout(r, 1200)); W.render();
    const d = document.querySelector('#viewGo details[data-gofold="journal"]'); if (d && !d.open) d.querySelector('summary').click(); await new Promise(r => setTimeout(r, 300));
    const ta = document.querySelector('#viewGo [data-jnote]'); if (!ta) return null; ta.focus(); ta.value = 'Gelato by the river'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
    delete document.visibilityState; const k = ta.dataset.jnote; return { k, kept: ((W.S.journal || {})[k] || {}).note };
  });
  t.ok(jn && jn.kept === 'Gelato by the river', 'the journal line is kept as the app goes to the background, without tapping out of the box: ' + JSON.stringify(jn));
  await pg.reload(); await settle(pg, 4000);
  t.eq(await pg.evaluate(k => ((W.S.journal || {})[k] || {}).note, jn && jn.k), 'Gelato by the river', 'and it is there after a reload');

  /* a stay you named that could not be found: directions by its name and town, and it is asked for again */
  const st = await pg.evaluate(async () => {
    const P = W.plan(), d = P.days[1], ck = W.cityKey(d.country, d.city);
    W.S.stays[ck] = { label: 'Hotel Test Fiori' }; W.status['geo|' + ck + '|' + W.norm('Hotel Test Fiori')] = "Couldn't load this. Try again.";
    const hb = W.homebase(d.country, d.city), c = W.findCity(d.country, d.city);
    const back = W.gmapsDir({ lat: 41.8876, lng: 12.4734 }, hb, 'walk'), from = W.gmapsDir(hb, { n: 'X', lat: 41.8876, lng: 12.4734 }, 'walk');
    let asked = 0; const g = W.geocode; W.geocode = (co, ci, text, done) => { asked++; done({ lat: 41.8955, lng: 12.4720 }); };
    W.S.day = 2; W.S.tview = 'days'; W.goView('trip'); W.render(); await new Promise(r => setTimeout(r, 400)); W.geocode = g;
    return { pending: !!hb.pending, back: decodeURIComponent(back), from: decodeURIComponent(from), centre: c ? c.lat + ',' + c.lng : '', asked, pin: W.S.stays[ck].lat, walk: /travelmode=walking/.test(back) };
  });
  t.ok(st.pending && /destination=Hotel Test Fiori, Rome/.test(st.back) && /origin=Hotel Test Fiori, Rome/.test(st.from) && st.back.indexOf(st.centre) < 0 && st.walk, 'a stay you named whose place is not known yet: directions go by its name and town, not to the middle of the town: ' + st.back.slice(0, 140));
  t.ok(st.asked === 1 && st.pin === 41.8955, 'and its place is asked for again when the day is drawn (once, not on every redraw)');

  /* walking between stops counts towards how tiring a day is */
  const wk = await pg.evaluate(() => { const P = W.plan(), E = P.days.map(d => W.dayEnergy(d, P, W.dayTimes(d, P))).filter(Boolean);
    return { leg: (W.leg({ lat: 41.9, lng: 12.5 }, { lat: 41.905, lng: 12.5 }) || {}).mode, label: E.some(e => e.planScore < e.score), plan: E.every(e => e.planScore <= e.score) }; });
  t.ok(wk.label && wk.plan, 'the walks show in how tiring a day is, but the planner judges a day as before (no outing is taken off for them; your choice, v150)');
  const tsrc = require('fs').readFileSync(require('path').join(__dirname, '../../trip/lib/times.js'), 'utf8');
  t.ok(wk.leg === 'walking' && /\/\^walk\/\.test\(lg\.mode\)/.test(tsrc) && !/lg\.mode === "walk"/.test(tsrc), 'a walk between stops is called "walking", and the day\'s effort counts it (it compared with "walk" and never matched)');

  /* Enter on a button in the trip bar is the button's own */
  const ent = await pg.evaluate(async () => { const m = document.querySelector('[data-sync="menu"]'); m.focus(); const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }); m.dispatchEvent(ev); return { prevented: ev.defaultPrevented }; });
  t.ok(!ent.prevented, 'Enter on a button in the trip bar is left to the button (it was swallowed)');
  t.eq(errors().filter(e => !/answer for odd/.test(e)), [], 'no page errors');
  await ctx.close(); await b.close();
};
