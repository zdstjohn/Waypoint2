/* v150: what the code review found, held down. One odd answer from Claude cannot jam the queue; the shared list for
   the photo finder carries nothing private (in explore.js); the journal is kept as you type and when the page is
   hidden, and a photo that lands minutes after your last tap is sent; a stay you named whose place is not known yet
   gives directions by its name and town (never the middle of the town under its name), and is asked for again;
   walking counts towards a day's effort; Enter in the trip bar. v151: the country and city boxes; suggested places;
   the build's checks of its own split; no more errors dropped unseen. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  /* v151 safety nets, no browser needed. The stylesheet split stops when a rule moved to app2.css (which loads last)
     would beat a later rule it used to lose to; v148's .nr-b slipped through that way. */
  const { splitCss } = require('../../build/bundle.js');
  const css = '/* ---------- Typeahead: test ---------- */\n.zq-a .zq-b{color:red}\n.zq-a.zq-x .zq-c{color:red}\n/* ---------- Other ---------- */\n.zq-k .zq-b{color:blue}\n.zq-k .zq-c{color:blue}\n.zq-k .zq-b{margin:0}\n';
  const split = splitCss(css, 'zq-k');
  t.ok(split.turned.length === 1 && /zq-a \.zq-b/.test(split.turned[0]), 'the build stops a moved rule from beating, by load order, a later rule as specific that sets the same thing: ' + JSON.stringify(split.turned));
  /* (and across contexts: a plain rule moved over a later touch-screen rule that stays, v148's .nr-b) */
  const split2 = splitCss('/* ---------- Typeahead: test ---------- */\n.zq-a .zq-n{padding:4px}\n/* ---------- Other ---------- */\n@media (hover:none){.zq-k .zq-n{padding:10px}}\n', 'zq-k');
  t.ok(split2.turned.length === 1, 'and when one of the two sits in a touch-screen or screen-size block: ' + JSON.stringify(split2.turned));
  t.eq(splitCss(require('fs').readFileSync(require('path').join(__dirname, '../../trip/app.css'), 'utf8'), require('fs').readFileSync(require('path').join(__dirname, '../../trip/index.html'), 'utf8')).turned.filter(x => /zq-/.test(x)), [], '(the real stylesheet is checked by every build)');
  /* the error catches that drop an error unseen: only ever fewer (each new one either goes to W.caught, or says why not) */
  const SILENT_MAX = 63, FS = require('fs'), PATH = require('path');
  const silent = ['lib', 'screens'].flatMap(d => FS.readdirSync(PATH.join(__dirname, '../../trip', d)).filter(f => /\.js$/.test(f)).map(f => [d + '/' + f, (FS.readFileSync(PATH.join(__dirname, '../../trip', d, f), 'utf8').match(/catch \((e|x|err|_)\) \{\s*\}/g) || []).length])).filter(x => x[1]);
  const nSilent = silent.reduce((a, x) => a + x[1], 0);
  t.ok(nSilent <= SILENT_MAX, `silent catches: ${nSilent} (at most ${SILENT_MAX}; a new one sends its error to W.caught, or says in a comment why it is safe to drop)` + (nSilent > SILENT_MAX ? ' ' + JSON.stringify(silent) : ''));

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
  /* v151: suggesting a trip's places: the well known and well liked first, never a thin town or a day-trip place as a stay
     (the owner: "When I ask for Spain and it suggests Tarifa, it doesn't make sense"). Trips suggested before keep theirs. */
  const sp = await pg.evaluate(() => {
    const C = (n, lat, lng, pop, t, w, extra) => Object.assign({ name: n, region: 'x', lat, lng, pop, t, w, d: '' }, extra || {});
    const list = [C('Madrid', 40.4168, -3.7038, 5, ['culture', 'food', 'nightlife'], 3), C('Barcelona', 41.3874, 2.1686, 5, ['culture', 'beach', 'food'], 3), C('Seville', 37.3891, -5.9845, 5, ['culture', 'food'], 3),
      C('Málaga', 36.7213, -4.4214, 4, ['beach', 'culture', 'food'], 2), C('Valencia', 39.4699, -0.3763, 4, ['beach', 'food', 'family'], 2), C('Tarifa', 36.0143, -5.6044, 3, ['beach', 'adventure'], 2),
      C('Doñana National Park', 37.0, -6.45, 4, ['nature', 'adventure', 'beach'], 1), C('Costa de la Luz', 36.5, -6.2, 4, ['beach', 'relax', 'adventure'], 2), C('Cádiz', 36.5271, -6.2886, 4, ['beach', 'culture', 'food'], 2),
      C('Marbella', 36.5101, -4.8825, 4, ['beach', 'relax'], 2), C('Caminito del Rey', 36.915, -4.7869, 4, ['adventure', 'nature', 'beach'], 1, { day: 1 }), C('Córdoba', 37.8882, -4.7794, 4, ['culture', 'food'], 2)];
    const was = W.C.country.Spain, S0 = JSON.stringify(W.S); W.C.country.Spain = { blurb: '', cities: list, v: W.COUNTRY_V };
    const run = (rank, styles, days) => { W.S.countries = [{ name: 'Spain', mode: 'suggest', picked: [], rank }]; W.S.styles = styles; W.S.days = days; W.replan(); return W.plan().stops.map(s => s.name); };
    const out = { fresh: [], old: run(0, ['beach', 'adventure'], 10) };
    [['beach', 'adventure'], ['culture', 'food'], ['beach', 'relax'], ['adventure', 'nature']].forEach(st => [6, 10, 16].forEach(d => out.fresh.push(run(2, st, d))));
    const keep = JSON.parse(S0); Object.keys(W.S).forEach(k => delete W.S[k]); Object.assign(W.S, keep); W.C.country.Spain = was; W.replan();
    return out;
  });
  const bad = /^(Tarifa|Doñana National Park|Costa de la Luz|Caminito del Rey)$/;
  t.ok(sp.fresh.every(l => l.length && !l.some(n => bad.test(n))), 'a suggested trip never stays in a thin town or a park, coast or other day-trip place: ' + sp.fresh.slice(0, 4).map(l => l.join('+')).join(' | '));
  t.ok(sp.fresh[1].includes('Barcelona') && sp.fresh[4].includes('Madrid'), 'the best known come first, as your style suits them (beach: ' + sp.fresh[1].join(', ') + '; culture: ' + sp.fresh[4].join(', ') + ')');
  t.ok(sp.old.some(n => bad.test(n)), 'a trip suggested before keeps the places it had (no city moves under a planned trip): ' + sp.old.join(', '));
  /* v151: the country and city boxes: a short list under the box once you type, in the page (never over the keyboard) */
  await pg.evaluate(async () => { W.S.countries = [{ name: 'Italy', mode: 'manual', picked: ['Rome'] }]; (W.S.stepClosed = W.S.stepClosed || {}).where = false; W.needLater(); W.setView('setup'); W.render(); for (let i = 0; i < 40 && !W.laterReady; i++) await new Promise(r => setTimeout(r, 100)); W.render(); });
  await pg.waitForSelector('#countryIn', { timeout: 10000 });
  await pg.focus('#countryIn'); await pg.waitForTimeout(200);
  const ta0 = await pg.evaluate(() => ({ list: !!document.querySelector('.ta-l'), dl: document.getElementById('countryIn').getAttribute('list') }));
  await pg.type('#countryIn', 'spa'); await pg.waitForTimeout(250);
  const ta1 = await pg.evaluate(() => { const i = document.getElementById('countryIn'), l = document.querySelector('.ta-l'); if (!l) return null; const r = l.getBoundingClientRect(), ir = i.getBoundingClientRect();
    return { items: [...l.querySelectorAll('li b')].map(b => b.textContent), below: r.top >= ir.bottom - 1, flow: getComputedStyle(l).position === 'static', exp: i.getAttribute('aria-expanded'), h: Math.round(l.querySelector('button').getBoundingClientRect().height) }; });
  t.ok(!ta0.list && !ta0.dl, 'tapping the country box shows no list yet (the browser\'s own list is gone)');
  t.ok(ta1 && ta1.items[0] === 'Spain' && ta1.items.length <= 6 && ta1.below && ta1.flow && ta1.exp === 'true' && ta1.h >= 44, 'typing "spa" shows a short list right under the box, in the page, not over the keyboard: ' + JSON.stringify(ta1));
  await pg.click('.ta-l [data-tapick="0"]'); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(() => W.S.countries.some(c => c.name === 'Spain') && !document.querySelector('.ta-l')), 'a tap on Spain adds it');
  await pg.evaluate(() => { W.S.countries = [{ name: 'Italy', mode: 'manual', picked: ['Rome'] }]; W.render(); }); await pg.waitForSelector('#cityIn0');
  await pg.type('#cityIn0', 'flo'); await pg.waitForTimeout(250);
  const tc = await pg.evaluate(() => [...document.querySelectorAll('.ta-l li b')].map(b => b.textContent));
  await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
  t.ok(tc[0] === 'Florence' && await pg.evaluate(() => W.S.countries[0].picked.includes('Florence')), 'cities too, and the arrow keys and Enter choose: ' + tc.join(', '));
  /* (a city whose name sounds like scenery is still a place to stay; a park never is, whatever the list says) */
  const dt = await pg.evaluate(() => ['Salt Lake City', 'Gold Coast|stay', 'Niagara Falls', 'Costa de la Luz', 'Yosemite National Park|stay', 'Lake Como', 'Barcelona'].map(x => { const [name, s] = x.split('|'); return name + ':' + (W.dayTrip({ name, stay: s ? 1 : 0 }) ? 'day' : 'stay'); }));
  t.eq(dt, ['Salt Lake City:stay', 'Gold Coast:stay', 'Niagara Falls:day', 'Costa de la Luz:day', 'Yosemite National Park:day', 'Lake Como:day', 'Barcelona:stay'], 'which names are day trips');
  t.eq(errors().filter(e => !/answer for odd/.test(e)), [], 'no page errors');
  await ctx.close(); await b.close();
};
