/* The world library (design: the "Waypoint World Library — design" doc; records made by tools/worldlib.js, read by
   lib/world.js). A trip city with a record gets its checked facts: hours per weekday for the trip's season, the dates
   it is always closed, the official entry rule, a pin looked up again, and Google's walks between its places, each
   with where and when it was checked. The planner keeps a place off a day it is closed or not yet open, the stop's
   details say what was checked, and the phone keeps the trip's own cities for offline use (and nothing else).
   The record here is the first batch's Granada, as built from the artifact's data and the official pages on Nov 13. */
const fs = require('fs'), path = require('path');
const { launch, open, settle, until } = require('../lib/page');
const mkdb = require('../lib/db');
const REC = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'mocks', 'world-spain-granada.json'), 'utf8'));
exports.run = async t => {
  /* the nightly script's rules (tools/worldlib.js): a fact needs a source page and a date; hours by season and weekday;
     what has expired is found */
  const L = require('../../tools/worldlib.js');
  const root = path.join(__dirname, '..', '..');
  t.ok(fs.readFileSync(path.join(root, 'trip', 'tools', 'worldlib.js.txt'), 'utf8') === fs.readFileSync(path.join(root, 'tools', 'worldlib.js'), 'utf8'),
    "the script's published copy (trip/tools/worldlib.js.txt), which the nightly task reads, is the same as tools/worldlib.js");
  t.ok(!!L.checkHours({ seasons: [{ from: '01-01', to: '12-31', wk: Array(7).fill(['09:00', '17:00']) }], src: 'https://x.org/', at: '2026-11-13' }).ok &&
    /source/.test(L.checkHours({ seasons: [{ from: '01-01', to: '12-31', wk: Array(7).fill(['09:00', '17:00']) }] }).bad) &&
    /source/.test(L.checkEntry({ free: true, src: 'not a page', at: '2026-11-13' }).bad), 'a fact without a source page and a date is refused');
  const alh = REC.places['alhambra and nasrid palaces'].hours;
  t.eq([L.hoursOn(alh, '2027-06-14'), L.hoursOn(alh, '2027-01-11'), L.hoursOn(alh, '2027-12-25')], [[510, 1200], [510, 1080], null],
    'the Alhambra: 8:30-20:00 in summer, 8:30-18:00 in winter, closed on Christmas Day');
  const st = L.doctorOne(REC, '2027-03-01');
  t.ok(!L.doctorOne(REC, '2026-11-20').stale.length && st.stale.some(x => /hours from 2026-11-13/.test(x)) && !st.broken.length, 'a record is up to date a week on, and its hours are due again after 60 days');
  /* v199: a record whose places are still mostly unread is looked at again, least read first, and a place whose pages
     gave nothing is left alone for two weeks */
  const os = require('os'), tdb = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-wl-'));
  for (const c of ['citylib', 'places', 'links', 'photos', 'wanted', 'world']) fs.mkdirSync(path.join(tdb, c));
  const thin = JSON.parse(JSON.stringify(REC)); thin.city = 'Thin'; for (const p of Object.values(thin.places)) if (p.kind === 'spot') { delete p.hours; delete p.entry; }
  fs.writeFileSync(path.join(tdb, 'world', 'spain-granada.json'), JSON.stringify({ data: REC, version: 1 }));
  fs.writeFileSync(path.join(tdb, 'world', 'spain-thin.json'), JSON.stringify({ data: thin, version: 1 }));
  const pl = L.plan(tdb, path.join(tdb, 'w'), 10, 0);
  const tried = { name: 'x', kind: 'spot', tried: '2026-11-10' }, stale = { name: 'y', kind: 'spot', tried: '2026-10-01' };
  t.ok(pl.cities[0] === 'spain-thin' && pl.cities.indexOf('spain-granada') > 0 && L.unread(thin, '2026-11-14').share === 0 && L.unread(REC, '2026-11-14').share > 0,
    'the nightly library goes back to a record whose sights are unread, the least read first: ' + JSON.stringify(pl.cities));
  t.ok(!L.wantsCheck(tried, '2026-11-14') && L.wantsCheck(stale, '2026-11-14') && L.wantsCheck(undefined, '2026-11-14'),
    'a place whose pages gave nothing four days ago is left alone; after two weeks it is asked about again');
  fs.rmSync(tdb, { recursive: true, force: true });
  const b = await launch();
  const store = mkdb({ 'world/spain-granada': REC, 'world/spain-seville': Object.assign({}, REC, { v: 2 }) });
  const A = await open(b, { width: 390, height: 844, db: store, init: () => { try { localStorage.setItem('waypoint-world-italy-rome', '{"v":1,"places":{}}'); } catch (e) {} } });
  /* a three-day Granada trip starting on a Sunday (2027-06-13) */
  await A.pg.evaluate(() => {
    W.newTripFrom({ v: 2, algo: 2, styles: ['culture'], countries: [{ mode: 'manual', name: 'Spain', picked: ['Granada'] }], days: 3, start: '2027-06-13', depart: 'Seattle (SEA)', travelers: [41, 40, 6, 3] });
  });
  await A.pg.waitForTimeout(3000);
  await A.pg.evaluate(() => { const x = document.querySelector('button[data-qs="close"]'); if (x) x.click(); W.needLater(); });
  const got = await until(() => A.pg.evaluate(() => W.worldHave && W.worldHave().includes('spain-granada')), 15000);
  t.ok(got, 'the Granada record is read for a trip to Granada');
  const r = await A.pg.evaluate(() => {
    const pool = W.worldPool('Spain', 'Granada');
    W.applyWorld('Spain', 'Granada', pool);
    const by = n => pool.spots.concat(pool.food).find(x => W.norm(x.n) === n);
    const alh = by('alhambra and nasrid palaces'), cat = by('granada cathedral and royal chapel'), pq = by('parque de las ciencias'), esp = by('bodegas espadafor');
    const sun = W.hoursFor(cat, 0), mon = W.hoursFor(cat, 1);
    return {
      wk: alh.wk && alh.wk.length, ticket: alh.ticket, book: alh.book, timed: alh.timed, pin: [alh.lat, alh.lng],
      catSun: sun && sun.o, catMon: mon && mon.o, pqMon: W.badForDay(pq, 1, 'am'), pqTue: W.badForDay(pq, 2, 'am'),
      leg: (() => { const l = W.leg(alh, esp, true); return l && [l.min, !!l.real]; })(),
      facts: W.worldFacts(alh, W.P.days[0]), seville: W.worldHave().includes('spain-seville'),
      kept: Object.keys(localStorage).filter(k => k.indexOf('waypoint-world-') === 0).sort()
    };
  });
  /* v199: one rule for which fact wins: the official page, then Google, then the map, then Claude, in whatever order
     they arrive */
  const ord = await A.pg.evaluate(() => {
    const src = [['claude', 600], ['map', 540], ['google', 525], ['official', 510]], out = [];
    const perms = a => a.length < 2 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(p => [x].concat(p)));
    perms(src).forEach(p => { const it = { n: 'x' }; p.forEach(([by, o]) => W.fact(it, 'hours', { o, c: 1080, closed: [] }, by)); out.push(it.hours.o + '/' + it.fsrc.hours); });
    const kept = Object.keys({ n: 'x', fsrc: 1 }).length, it2 = { n: 'y' }; W.fact(it2, 'book', 'https://a', 'official');
    return { all: [...new Set(out)], saved: JSON.stringify(it2), late: W.fact(it2, 'book', 'https://b', 'claude'), book: it2.book };
  });
  t.ok(ord.all.length === 1 && ord.all[0] === '510/official' && ord.late === false && ord.book === 'https://a' && !/fsrc/.test(ord.saved),
    'one rule for which fact wins: in all 24 orders the official hours stand; a later guess from Claude does not replace an official link; the source is not saved with the stop: ' + JSON.stringify(ord));
  t.ok(r.wk === 7 && /€22\.27 adults, under 12 free · timed entry, book ahead/.test(r.ticket) && /tickets\.alhambra-patronato\.es/.test(r.book) && r.timed === 1,
    'the Alhambra carries its weekly hours and the official entry rule: ' + r.ticket);
  t.eq(r.pin, [37.1760783, -3.5881413], 'and its pin as looked up again (the place check had it by Plaza Nueva)');
  t.ok(r.catSun === 900 && r.catMon === 600, 'the cathedral opens at 3 pm on Sundays and 10 am on other days: ' + r.catSun + ' / ' + r.catMon);
  t.ok(r.pqMon === true && r.pqTue === false, 'the science park is kept off a Monday (closed) and not a Tuesday');
  t.eq(r.leg, [18, true], "the walk between two of a ready-made day's places is Google's, not an estimate");
  t.ok(/<b>Open<\/b> (8:30 AM–8:00 PM|08:30–20:00)/.test(r.facts) && /Checked Nov 13 on alhambra-patronato\.es/.test(r.facts), 'the details say what was checked, where and when');
  /* a fact past its shelf life says so (hours 60 days, entry rule 90, from today): fake today with a Date that starts on a set day */
  const aged = await A.pg.evaluate(() => {
    const pool = W.worldPool('Spain', 'Granada'), d = W.P.days[0];
    W.applyWorld('Spain', 'Granada', pool);
    const alh = pool.spots.find(x => W.norm(x.n) === 'alhambra and nasrid palaces');
    const RealDate = Date, at = RealDate.UTC(2026, 10, 13, 12), out = {};
    const fake = iso => {
      const off = RealDate.parse(iso + 'T12:00:00Z') - RealDate.now();
      window.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + off); } static now() { return RealDate.now() + off; } };
    };
    try {
      fake('2026-11-20'); out.fresh = W.worldFacts(alh, d);
      fake('2027-01-12'); out.d60 = W.worldFacts(alh, d); /* 60 days on: still fresh */
      fake('2027-01-13'); out.d61 = W.worldFacts(alh, d);
      const e = Object.assign({}, alh, { wf: { e: alh.wf.e } });
      fake('2027-02-11'); out.e90 = W.worldFacts(e, d); /* 90 days on: still fresh */
      fake('2027-02-12'); out.e91 = W.worldFacts(e, d);
    } finally { window.Date = RealDate; }
    out.now = W.worldFacts(alh, d);
    return out;
  });
  t.ok(!/wf-old|may have changed/.test(aged.fresh) && aged.fresh === aged.d60 && !/wf-old/.test(aged.e90), 'a fact within its shelf life (hours 60 days, entry rule 90) renders as it always did');
  t.ok(/^<div class="wf wf-old">/.test(aged.d61) && /Checked Nov 13 on alhambra-patronato\.es · may have changed since<\/p>/.test(aged.d61) && /<b>Open<\/b>/.test(aged.d61), 'hours checked 61 days ago: the line says they may have changed, and the box is marked: ' + aged.d61);
  t.ok(/wf-old/.test(aged.e91) && !/Open/.test(aged.e91) && /may have changed since/.test(aged.e91), 'an entry rule is 90 days on its own, and shows the caution after that');
  t.ok(aged.now === aged.fresh.replace(/^/, ''), 'back on the real date, the line is as it was');
  t.ok(!r.seville, 'a record in a shape this version does not know is not used');
  t.eq(r.kept, ['waypoint-world-spain-granada'], "the phone keeps the trip's own city for offline use, and drops a city no trip has");
  /* the planner, from the record's lists: no cathedral on Sunday morning, no science park on Monday */
  const plan = await A.pg.evaluate(() => {
    const pool = W.pool('Spain', 'Granada'), wp = W.worldPool('Spain', 'Granada');
    pool.spots = wp.spots; pool.food = wp.food;
    W.applyWorld('Spain', 'Granada', pool);
    W.S.picks = {}; W.dataV = (W.dataV || 0) + 1;
    const P = W.plan();
    return P.days.map(d => ({ wd: W.weekday(d.n), am: (d.slots.find(x => x.slot === 'am') || {}).item, all: d.slots.map(x => x.item && W.norm(x.item.n)).filter(Boolean) }))
      .map(d => ({ wd: d.wd, am: d.am && W.norm(d.am.n), all: d.all }));
  });
  t.ok(plan[0].wd === 0 && plan[0].am !== 'granada cathedral and royal chapel', 'Sunday morning is not the cathedral (it opens at 3 pm): ' + plan[0].am);
  t.ok(plan[1].wd === 1 && !plan[1].all.includes('parque de las ciencias'), 'Monday has no science park (closed): ' + plan[1].all.join(', '));
  /* ---- v198: the entry rules at work. No entry without a booked ticket -> a deadline, a mark on To book and a
     "Don't miss" card; a paid place whose own page has not been read yet says "not checked yet" ---- */
  const e = await A.pg.evaluate(() => {
    const pool = W.pool('Spain', 'Granada');
    const by = n => pool.spots.find(x => W.norm(x.n) === n);
    const alh = by('alhambra and nasrid palaces'), ham = by('hammam al andalus arab baths'), alb = by('albaicin old quarter stroll'), cat = by('granada cathedral and royal chapel');
    /* a day with the Alhambra on it, whatever the planner chose */
    const d = W.P.days[1], x = d.slots.find(s => s.slot === 'am');
    W.S.picks = {}; W.S.picks[x.key] = alh.n; W.dataV = (W.dataV || 0) + 1;
    const P = W.plan(), ent = W.checklist(P).find(c => c.item && W.norm(c.item.n) === 'alhambra and nasrid palaces');
    const visit = W.dateOf(ent.day);
    return {
      must: [alh.must, cat.must, ham && ham.must], lead: alh.lead, timed: alh.timed,
      ent: ent && { must: ent.must, lead: ent.lead, days: ent.by ? Math.round((visit - ent.by) / 864e5) : null, url: ent.url },
      facts: W.worldFacts(alh, d), q: ham ? W.worldFacts(ham, d) : null, free: alb ? W.worldFacts(alb, d) : null, catFacts: W.worldFacts(cat, d)
    };
  });
  t.ok(e.must[0] === 1 && !e.must[1] && !e.must[2] && e.lead === 30 && e.timed === 1, 'the Alhambra (timed entry, no entry without a ticket, no lead on its page) is to be booked a month ahead; the cathedral is not marked: ' + JSON.stringify([e.must, e.lead]));
  t.ok(e.ent && e.ent.must === 1 && e.ent.days === 30 && /alhambra-patronato\.es/.test(e.ent.url || ''), 'To book carries it: book by 30 days before the visit, at the official ticket site: ' + JSON.stringify(e.ent));
  t.ok(/<b>Tickets<\/b> No entry without a booked ticket/.test(e.facts) && !/No entry without/.test(e.catFacts), "its details say there is no entry without a booked ticket; the cathedral's don't");
  t.ok(/Not checked yet/.test(e.q || '') && e.free === '', 'a paid place whose own page has not been read says "Not checked yet"; a free stroll says nothing');
  /* the official ticket page stays: Claude is not asked for a link the record settles (until v198 its answer, a few
     seconds on, took the official page's place) */
  await settle(A.pg, 6000);
  const kept2 = await A.pg.evaluate(() => { const a = W.pool('Spain', 'Granada').spots.find(x => W.norm(x.n) === 'alhambra and nasrid palaces'); const c = W.checklist(W.plan()).find(c => c.item === a); return { book: a.book, bookV: a.bookV, url: c && c.url, sub: c && c.sub, gsub: (W.checklist(W.plan()).find(c => /Generalife/.test(c.title)) || {}).sub }; });
  t.ok(/tickets\.alhambra-patronato\.es/.test(kept2.book || '') && kept2.bookV === 2 && /tickets\.alhambra-patronato\.es/.test(kept2.url || ''), 'the official ticket page is still its link once every answer is in: ' + JSON.stringify(kept2));
  t.ok(kept2.gsub === 'under 12 free' && !/·\s*$/.test(kept2.sub || ''), "a row's price line ends cleanly where \"book ahead\" was taken off: " + JSON.stringify([kept2.sub, kept2.gsub]));
  await A.pg.evaluate(() => { W.S.prepTab = 'tobook'; W.goView('book'); W.render(); });
  const card = await until(() => A.pg.evaluate(() => { const c = document.querySelector('#viewBook .must-c'); return c ? { text: c.textContent, link: (c.querySelector('a') || {}).href || '', rows: [...document.querySelectorAll('#viewBook .chk-m')].filter(m => /no entry without a ticket/.test(m.textContent)).length } : null; }), 8000);
  t.ok(card && /Don't miss these/.test(card.text) && /Alhambra and Nasrid Palaces/.test(card.text) && /Generalife Gardens/.test(card.text) && /book by|book now/.test(card.text) && /alhambra-patronato\.es/.test(card.link) && card.rows === 2,
    'Prepare > To book opens with "Don\'t miss these": the Alhambra and the Generalife, their deadlines and the official ticket page; their rows say so too: ' + JSON.stringify(card));
  const tick = () => A.pg.evaluate(() => { const c = W.checklist(W.P).find(x => x.must && W.leftToBook(x)); const b = c && document.querySelector('#viewBook .box[data-tick="' + c.key.replace(/"/g, '\\"') + '"]'); if (b) b.click(); return !!b; });
  const t1 = await tick();
  const one = await until(() => A.pg.evaluate(() => { const c = document.querySelector('#viewBook .must-c'); return c && /Don't miss this one/.test(c.textContent) ? c.textContent : ''; }), 5000);
  const t2 = await tick();
  const gone = await until(() => A.pg.evaluate(() => !document.querySelector('#viewBook .must-c')), 5000);
  t.ok(t1 && one && t2 && gone, 'ticked as booked, one leaves the card ("Don\'t miss this one"), and with both booked the card goes: ' + JSON.stringify([t1, !!one, t2, gone]));
  await settle(A.pg);
  await A.ctx.close();
  /* ---- v198: a library city's first lists come from its record, at once: no question to Claude for them ---- */
  const store2 = mkdb({ 'world/spain-granada': REC, 'world/_index': { v: 1, cities: { 'spain-granada': '2026-11-13' } } });
  const C = await open(b, { width: 390, height: 844, db: store2 });
  await C.pg.evaluate(() => W.needLater());
  await until(() => C.pg.evaluate(() => !!W.worldFirst), 15000);
  await C.pg.evaluate(() => { window.__full = []; W.newTripFrom({ v: 2, algo: 2, styles: ['culture'], countries: [{ mode: 'manual', name: 'Spain', picked: ['Granada', 'Seville'] }], days: 4, start: '2027-06-13', depart: 'Seattle (SEA)', travelers: [41, 40] }); });
  const first = await until(() => C.pg.evaluate(() => { const c = W.C.city[W.cityKey('Spain', 'Granada')]; return c && c.spots && c.spots.length ? { lib: c.lib, spots: c.spots.length, food: c.food.length, flag: !!(W.libFromWorld || {})[W.cityKey('Spain', 'Granada')] } : null; }), 8000);
  await C.pg.waitForTimeout(2500);
  const asked2 = await C.pg.evaluate(() => { const f = window.__full || []; const of = city => f.filter(p => p.indexOf(city + ', Spain') > -1 && /things to do|places to eat/i.test(p)).length; return { granada: of('Granada'), seville: of('Seville'), days: W.P.days.filter(d => d.city === 'Granada' && d.slots.filter(x => x.item).length >= 4).length, sev: !!(W.C.city[W.cityKey('Spain', 'Seville')] || {}).lib }; });
  t.ok(first && first.lib === 1 && first.flag && first.spots === 15 && first.food === 15, "Granada's first lists are its record's: 15 things to do and 15 places to eat: " + JSON.stringify(first));
  t.ok(asked2.granada === 0 && asked2.seville >= 1 && !asked2.sev, 'Claude is not asked for them; a city the library does not hold (Seville, here) is asked as before: ' + JSON.stringify(asked2));
  t.ok(asked2.days >= 1, "and Granada's days are planned from them");
  t.eq(C.errors(), [], 'no page errors on the way');
  await b.close();
};
