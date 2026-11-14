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
  t.ok(r.wk === 7 && /€22\.27 adults, under 12 free · timed entry, book ahead/.test(r.ticket) && /tickets\.alhambra-patronato\.es/.test(r.book) && r.timed === 1,
    'the Alhambra carries its weekly hours and the official entry rule: ' + r.ticket);
  t.eq(r.pin, [37.1760783, -3.5881413], 'and its pin as looked up again (the place check had it by Plaza Nueva)');
  t.ok(r.catSun === 900 && r.catMon === 600, 'the cathedral opens at 3 pm on Sundays and 10 am on other days: ' + r.catSun + ' / ' + r.catMon);
  t.ok(r.pqMon === true && r.pqTue === false, 'the science park is kept off a Monday (closed) and not a Tuesday');
  t.eq(r.leg, [18, true], "the walk between two of a ready-made day's places is Google's, not an estimate");
  t.ok(/<b>Open<\/b> (8:30 AM–8:00 PM|08:30–20:00)/.test(r.facts) && /Checked Nov 13 on alhambra-patronato\.es/.test(r.facts), 'the details say what was checked, where and when');
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
  await settle(A.pg);
  await b.close();
};
