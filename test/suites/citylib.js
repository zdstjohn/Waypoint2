/* v184, the owner: "it shouldn't take more than 3-5 seconds to populate the stops/places to eat", and "dial it down to
   the top 150 countries". The city library (lib/citylib.js): a country's towns and a city's first lists, once Claude has
   written them, are kept in the shared database and answer the same question for everyone after; the cities Plan offers
   are asked for ahead, after everything else; Plan offers the 150 most visited countries. */
const { launch, open, exampleTrip, settle } = require('../lib/page');
const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch();
  const store = mkdb();
  const prompts = pg => pg.evaluate(() => (window.__full || []).map(String));
  /* Plan, with only Croatia, choosing its cities yourself (towns from Claude: the stand-in names them Town 0 to Town 89) */
  const toCroatia = async pg => {
    await pg.evaluate(async () => {
      W.S.countries = [];
      (W.S.stepClosed = W.S.stepClosed || {}).where = false;
      W.needLater(); W.setView('setup'); W.render();
      for (let i = 0; i < 40 && !W.laterReady; i++) await new Promise(r => setTimeout(r, 100));
      W.render();
    });
    await pg.waitForSelector('#countryIn', { timeout: 10000 });
    await pg.fill('#countryIn', 'Croatia'); await pg.click('#addCountry');
    /* "I'll choose": Plan offers cities to tap (in "Suggest cities" it plans them itself) */
    await pg.waitForSelector('.country [data-mode="manual"]'); await pg.click('.country [data-mode="manual"]');
  };
  const offered = pg => pg.evaluate(() => [...document.querySelectorAll('.country .chips .chip[data-pick]')].map(b => b.dataset.pick).slice(0, 3));

  /* ---- 1. the first phone: Claude writes it all, and it is kept ---- */
  const A = await open(b, { width: 390, db: store }); await exampleTrip(A.pg);
  await toCroatia(A.pg);
  await A.pg.waitForFunction(() => document.querySelectorAll('.country .chips .chip[data-pick]').length >= 3, null, { timeout: 15000 });
  const three = await offered(A.pg);
  /* asked for ahead: last in line, and moved up as soon as someone needs that city */
  const low = await A.pg.evaluate(() => { W.holdLoads = true; W.warmCity('Croatia', 'Town 77'); const a = W.loadPrio('spots|Croatia|Town 77');
    W.loadCity('Croatia', 'Town 77'); const b = W.loadPrio('spots|Croatia|Town 77'); W.holdLoads = false; W.pump(); return [a, b]; });
  t.ok(low[0] === 9 && low[1] < 9, 'a city Plan offers is asked for ahead, after everything else, and moves up once it is needed: ' + JSON.stringify(low));
  await A.pg.waitForFunction(three => three.every(c => W.pool('Croatia', c) && W.pool('Croatia', c).spots.length && (W.pool('Croatia', c).food || []).length), three, { timeout: 30000 });
  const pa = await prompts(A.pg);
  const asked = c => pa.filter(p => p.includes('best things to do in and around ' + c + ', Croatia')).length;
  t.ok(pa.some(p => /List the cities, towns and areas that travelers visit in Croatia/.test(p)) && three.every(c => asked(c) === 1),
    'the first phone asks Claude for Croatia\'s towns and, once each, the three offered cities: ' + three.map(asked).join(','));
  /* kept: the towns, each offered city's two lists, and the questions' words in the person's own space */
  await A.pg.waitForTimeout(800);
  const kept = await A.pg.evaluate(async () => { const d = await window.claude.use('db');
    const c = await d.doc('citylib/croatia').get(); const t0 = (await d.collection('citylib').get()).docs.map(x => x.id).sort();
    const q = (await d.collection('data/users/u-test/libq/q').get()).docs.map(x => x.data().kind).sort();
    const any = (await d.doc('citylib/' + t0.find(x => x !== 'croatia')).get()).data();
    return { towns: c.exists && Object.values(c.data().q).some(e => e.r && e.r.cities && e.r.cities.length > 50), docs: t0, q,
      words: JSON.stringify(c.data()).includes('List the cities'), both: Object.keys(any.q).length };
  });
  t.ok(kept.towns && kept.docs.length >= 4 && kept.both === 2, 'kept in the shared library: the towns and each city\'s two lists: ' + JSON.stringify({ docs: kept.docs.length, both: kept.both }));
  t.ok(!kept.words, 'the shared library keeps only answers, never the question\'s words');
  t.ok(kept.q.includes('cities') && kept.q.includes('spots') && kept.q.includes('food'), 'the questions\' words are noted in the person\'s own space, for the nightly task: ' + kept.q.join(','));
  const tpl = await A.pg.evaluate(async () => { const d = await window.claude.use('db'); const q = (await d.collection('data/users/u-test/libq/q').get()).docs.map(x => x.data()).find(x => x.kind === 'spots'); return q.t; });
  t.ok(/\{CITY\}, \{COUNTRY\}/.test(tpl) && !/Croatia/.test(tpl), 'the noted words name no place ({CITY}, {COUNTRY}): ' + tpl.slice(0, 80));
  /* the questions noted ahead (when the app is idle) are word for word the ones a city then asks */
  await A.pg.waitForTimeout(8500);
  const same = await A.pg.evaluate(async c => { const d = await window.claude.use('db');
    const notes = (await d.collection('data/users/u-test/libq/q').get()).docs.map(x => x.id);
    const got = Object.keys((await d.doc('citylib/' + W.citySlug('Croatia', c)).get()).data().q);
    return { notes: notes.length, both: got.every(h => notes.includes(h)) }; }, three[0]);
  t.ok(same.both, 'the questions noted ahead for the nightly task are the very ones a city asks: ' + JSON.stringify(same));
  t.eq(A.errors(), [], 'no page errors (first phone)');
  await A.ctx.close();

  /* ---- 2. someone else's phone, nothing on it yet: the same trip asks nobody ---- */
  /* (another person: the first one's own trips, synced to their account, stay theirs) */
  const B = await open(b, { width: 390, db: store, uid: 'u-other' }); await exampleTrip(B.pg);
  await B.pg.evaluate(() => { window.__full = []; });
  const t0 = Date.now();
  await toCroatia(B.pg);
  await B.pg.waitForFunction(() => document.querySelectorAll('.country .chips .chip[data-pick]').length >= 3, null, { timeout: 15000 });
  const threeB = await offered(B.pg);
  await B.pg.waitForFunction(three => three.every(c => W.pool('Croatia', c) && W.pool('Croatia', c).spots.length), threeB, { timeout: 15000 });
  const ms = Date.now() - t0;
  const pb = await prompts(B.pg);
  const lists = pb.filter(p => /Croatia/.test(p) && /^List (the cities, towns|the \d+ best things to do|\d+ places to eat)/.test(p));
  t.ok(!lists.length, 'the second phone gets Croatia\'s towns and the offered cities from the library, asking Claude for none of those lists: ' + lists.map(p => p.slice(0, 50)).join(' | '));
  t.ok(ms < 8000, 'and they are there within a few seconds (' + ms + ' ms, from adding the country)');
  /* a tap on an offered city: its days fill from what is already here */
  await B.pg.click('.country .chips .chip[data-pick="' + threeB[0] + '"]'); await settle(B.pg, 3000);
  const fill = await B.pg.evaluate(c => ({ picked: W.S.countries[0].picked.includes(c), pool: !!W.pool('Croatia', c), asked: (window.__full || []).filter(p => p.includes(' ' + c + ',')).map(p => p.slice(0, 70)) }), threeB[0]);
  t.ok(fill.picked && fill.pool && !fill.asked.some(p => /^List (the )?\d+ (best things to do|places to eat)/.test(p)), 'a tap on one picks it with its places already there: ' + JSON.stringify(fill));
  /* asked differently (other interests): not the same question, so Claude is asked for that city */
  const other = await B.pg.evaluate(async c => { W.S.styles = ['nightlife']; W.C.city = {}; W.loadCity('Croatia', c); await new Promise(r => setTimeout(r, 2500));
    return (window.__full || []).filter(p => p.includes('best things to do in and around ' + c)).length; }, threeB[1]);
  t.ok(other >= 1, 'the same city asked with other interests is asked of Claude (another question, another answer): ' + other);
  t.eq(B.errors(), [], 'no page errors (second phone)');
  await B.ctx.close();

  /* ---- 3. Plan offers the 150 most visited countries ---- */
  const C = await open(b, { width: 390 }); await exampleTrip(C.pg);
  const names = await C.pg.evaluate(async () => { W.needLater(); for (let i = 0; i < 40 && !W.countryNames; i++) await new Promise(r => setTimeout(r, 100)); return W.countryNames(); });
  t.ok(names.length >= 150 && names.length <= 152 && names.includes('Croatia') && names.includes('Iceland') && !names.includes('Afghanistan') && !names.includes('Yemen'),
    'Plan offers the 150 most visited countries (with every one that has places built in): ' + names.length);
  /* a trip already planned for a country not on the list keeps it */
  const kept2 = await C.pg.evaluate(() => { W.S.countries = [{ name: 'Uganda', mode: 'manual', picked: [] }, { name: 'Tajikistan', mode: 'manual', picked: ['Dushanbe'] }]; W.render(); return W.S.countries.map(c => c.name); });
  t.eq(kept2, ['Uganda', 'Tajikistan'], 'a trip with a country not on the list keeps it');
  t.eq(C.errors(), [], 'no page errors (the list)');
  await C.ctx.close(); await b.close();
};
