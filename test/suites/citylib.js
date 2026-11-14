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
  /* (v191 kept each place's library document in the phone's storage and never cleared it; v192 removes what it wrote) */
  const A = await open(b, { width: 390, db: store, init: () => { try { localStorage.setItem('waypoint-lib-croatia', '{"at":1,"d":{}}'); localStorage.setItem('waypoint-lib-italy-rome', '{"at":1,"d":{}}'); } catch (e) {} } }); await exampleTrip(A.pg);
  await toCroatia(A.pg);
  await A.pg.waitForFunction(() => document.querySelectorAll('.country .chips .chip[data-pick]').length >= 3, null, { timeout: 15000 });
  const three = await offered(A.pg);
  /* asked for ahead: last in line, and moved up as soon as someone needs that city */
  const low = await A.pg.evaluate(() => { W.holdLoads = true; W.warmCity('Croatia', 'Town 77'); const a = W.loadPrio('spots|Croatia|Town 77');
    W.loadCity('Croatia', 'Town 77'); const b = W.loadPrio('spots|Croatia|Town 77'); W.holdLoads = false; W.pump(); return [a, b]; });
  t.ok(low[0] === 9 && low[1] < 9, 'a city Plan offers is asked for ahead, after everything else, and moves up once it is needed: ' + JSON.stringify(low));
  await A.pg.waitForFunction(three => three.every(c => W.pool('Croatia', c) && W.pool('Croatia', c).spots.length && (W.pool('Croatia', c).food || []).length), three, { timeout: 30000 });
  const left = await A.pg.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('waypoint-lib-') === 0));
  t.eq(left, [], 'what v191 kept of the library in the phone\'s storage is gone, and nothing new is kept there');
  const pa = await prompts(A.pg);
  const asked = c => pa.filter(p => p.includes('best things to do in and around ' + c + ', Croatia')).length;
  t.ok(pa.some(p => /List the cities, towns and areas that travelers visit in Croatia/.test(p)) && three.every(c => asked(c) === 1),
    'the first phone asks Claude for Croatia\'s towns and, once each, the three offered cities: ' + three.map(asked).join(','));
  /* kept: the towns and each offered city's two lists (this trip's own questions: it has interests and children) */
  await A.pg.waitForTimeout(800);
  const kept = await A.pg.evaluate(async () => { const d = await window.claude.use('db');
    const c = await d.doc('citylib/croatia').get(); const t0 = (await d.collection('citylib').get()).docs.map(x => x.id).sort();
    const any = (await d.doc('citylib/' + t0.find(x => x !== 'croatia')).get()).data();
    return { towns: c.exists && Object.values(c.data().q).some(e => e.r && e.r.cities && e.r.cities.length > 50), docs: t0,
      words: JSON.stringify(c.data()).includes('List the cities') || JSON.stringify(any).includes('best things to do'), both: Object.keys(any.q).length,
      notes: (await d.collection('data/users/u-test/libq/q').get()).docs.length };
  });
  t.ok(kept.towns && kept.docs.length >= 4 && kept.both === 2, 'kept in the shared library: the towns and each city\'s two lists: ' + JSON.stringify({ docs: kept.docs.length, both: kept.both }));
  t.ok(!kept.words && !kept.notes, 'the library keeps only answers, never a question\'s words (they can carry food needs), and writes nothing else');
  /* the general questions (for no one in particular) are word for word the ones the nightly task asks */
  const gen = await A.pg.evaluate(() => ['cities', 'spots', 'food'].map(k => { const t = W.libGeneral(k); return { k, t, h: W.textHash(t) }; }));
  const file = JSON.parse(require('fs').readFileSync(require('path').join(t.root, 'tools/citylib-questions.json'), 'utf8'));
  if (gen.some(g => !file[g.k] || file[g.k].t !== g.t)) require('fs').writeFileSync(require('path').join(t.root, 'test/out/citylib-questions.json'), JSON.stringify(Object.fromEntries(gen.map(g => [g.k, { t: g.t, h: g.h }])), null, 1) + '\n');
  t.ok(gen.every(g => file[g.k] && file[g.k].t === g.t && file[g.k].h === g.h), 'the app\'s general questions are the nightly task\'s (tools/citylib-questions.json; if not, the new ones are in test/out)');
  t.ok(gen.every(g => !/Lean toward the travelers|food needs|Travelers' ages: \d/.test(g.t)) && /Travelers' ages: adults/.test(gen[1].t), 'and they are asked for no one in particular: no interests, no ages, no food needs');
  t.eq(A.errors(), [], 'no page errors (first phone)');
  /* (v187) a city already seen stays on the phone: after a reload and then with the network gone (a flight), its lists are still there */
  await A.pg.reload(); await A.pg.waitForFunction(() => window.W && W.P && W.P.days && W.P.days.length, null, { timeout: 15000 }).catch(() => {}); await A.pg.waitForTimeout(1200);
  await A.ctx.setOffline(true); await A.pg.waitForTimeout(400);
  const away = await A.pg.evaluate(three => three.map(c => { const p = W.pool('Croatia', c); return !!(p && (p.spots || []).length >= 8 && (p.food || []).length >= 8); }), three);
  t.ok(away.every(Boolean), 'cities already seen still open with no connection after a reload: ' + JSON.stringify(away));
  await A.ctx.setOffline(false);
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

  /* ---- 2b. a city only the nightly task has filled (its general lists): they fill the days at once, and this trip's
     own question (interests, children) is asked after, last in line, adding what suits it ---- */
  const Q = JSON.parse(require('fs').readFileSync(require('path').join(t.root, 'tools/citylib-questions.json'), 'utf8'));
  /* (where the stand-in puts a town it doesn't know, so its own answer's places are near the general ones) */
  const at = [40, 10], now = Date.now();
  const spots = Array.from({ length: 15 }, (_, i) => ({ n: 'General sight ' + i, d: 'A sight.', t: ['culture'], fame: 1, rating: 4.5, k: 0, s: ['am', 'pm', 'eve', 'any'][i % 4], dur: '2h', ticket: 'Free', pic: 'museum', place: 'General sight ' + i, lat: at[0] + (i % 5) * 0.002, lng: at[1] + (i % 3) * 0.002 }));
  const food = Array.from({ length: 15 }, (_, i) => ({ n: 'General eatery ' + i, d: 'Good food.', fame: 1, rating: 4.5, cuisine: 'Croatian', price: '€€', meal: i < 4 ? 'breakfast' : ['lunch', 'dinner', 'both'][i % 3], dur: '1h', fav: false, k: 0, sure: true, reserve: false, pic: 'restaurant', lat: at[0] + (i % 4) * 0.002, lng: at[1] + (i % 5) * 0.002 }));
  const store2 = mkdb({ 'citylib/croatia-town-50': { country: 'Croatia', city: 'Town 50', q: { [Q.spots.h]: { r: { d: 'A town.', lat: at[0], lng: at[1], spots }, at: now }, [Q.food.h]: { r: { food }, at: now } } } });
  const G = await open(b, { width: 390, db: store2, uid: 'u-third' }); await exampleTrip(G.pg);
  const g = await G.pg.evaluate(async () => { window.__full = []; const t0 = Date.now(); W.loadCity('Croatia', 'Town 50');
    for (let i = 0; i < 60 && !(W.pool('Croatia', 'Town 50') && W.pool('Croatia', 'Town 50').spots.length); i++) await new Promise(r => setTimeout(r, 100));
    const first = Date.now() - t0, p0 = W.pool('Croatia', 'Town 50');
    const names0 = p0 ? p0.spots.map(x => x.n) : [];
    /* (all it holds: W.pool hands out only as many as the stay can use) */
    const all = () => (W.C.city[W.cityKey('Croatia', 'Town 50')] || { spots: [] }).spots;
    for (let i = 0; i < 100 && !all().some(x => !/^General sight/.test(x.n)); i++) await new Promise(r => setTimeout(r, 100));
    const own = (window.__full || []).filter(p => /best things to do in and around Town 50, Croatia/.test(p));
    return { first, general: names0.filter(n => /^General sight/.test(n)).length, own: own.length, ages: own.length && /Travelers' ages: 38, 36, 6, 3/.test(own[0]),
      added: all().filter(x => !/^General sight/.test(x.n)).length, kept: all().filter(x => /^General sight/.test(x.n)).length, st: W.status['spots|Croatia|Town 50|own'] || '' }; });
  t.ok(g.first < 3000 && g.general >= 10, 'a city with only the general lists fills from them at once (' + g.first + ' ms, ' + g.general + ' things to do)');
  t.ok(g.own === 1 && g.ages && g.added > 0 && g.kept >= 10, 'then this trip\'s own question is asked once (its travelers\' ages and interests) and adds what suits it: ' + JSON.stringify(g));
  /* the website reads its copy of the library (sent there nightly) but never writes to it */
  const web = await G.pg.evaluate(async () => { const was = W.cloud; W.cloud = true; const n0 = window.__writes.length;
    W.libSave({ slug: 'croatia-town-51', h: 'x', gh: '', kind: 'spots', place: ['Croatia', 'Town 51'] }, { spots: [{ n: 'a' }] });
    await new Promise(r => setTimeout(r, 600)); const wrote = window.__writes.slice(n0).filter(p => /^citylib\//.test(p));
    const read = await new Promise(r => W.libGet({ slug: 'croatia-town-50', h: 'none', gh: W.textHash(W.libGeneral('spots')), kind: 'spots', place: ['Croatia', 'Town 50'] }, (x, g) => r(!!x && g)));
    W.cloud = was; return { wrote, read }; });
  t.ok(!web.wrote.length && web.read, 'the website reads the library and never writes to it: ' + JSON.stringify(web));
  t.eq(G.errors(), [], 'no page errors (general lists)');
  await G.ctx.close();

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
