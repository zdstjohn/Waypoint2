/* Getting around the plan: the actions sheet, moving a stop to another day and undoing it, leaving a slot free and undoing,
   the swap cards, the glance, swiping between days, the next-step bar and quick start. */
const { launch, open, exampleTrip, settle, calm } = require('../lib/page');
exports.run = async t => {
  /* the very first open asks where you're headed, over the example trip; the sheet can be put aside */
  { const b0 = await launch(); const { pg: p0, ctx: c0 } = await open(b0, { width: 390, firstRun: true }); await p0.waitForTimeout(800);
    const fr = await p0.evaluate(() => ({ sheet: !!document.querySelector('.qs.sheet'), title: (document.getElementById('qsT') || {}).textContent, look: !!document.querySelector('[data-qs="close"].linkish') }));
    t.ok(fr.sheet && /headed/.test(fr.title || '') && fr.look, 'the first open asks where you are headed: ' + JSON.stringify(fr));
    await p0.click('[data-qs="close"].linkish'); await p0.waitForTimeout(400);
    const gone = await p0.evaluate(() => !document.querySelector('.qs.sheet') && document.querySelectorAll('#viewTrip .slot').length >= 0 && localStorage.getItem('waypoint-welcome') === '1');
    t.ok(gone, 'putting it aside shows the example trip and it does not come back');
    await p0.reload(); await p0.waitForTimeout(1200);
    t.ok(await p0.evaluate(() => !document.querySelector('.qs.sheet')), 'a second open skips the welcome');
    await c0.close(); await b0.close(); }
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844 }); await exampleTrip(pg);
  const k0 = await pg.evaluate(() => { const d = W.P.days[W.S.day - 1]; const x = d.slots.find(y => y.item && y.slot === 'am') || d.slots.find(y => y.item && !W.isFood(y.slot)); return x.key; });
  const name0 = await pg.evaluate(k => W.P.days[W.S.day - 1].slots.find(x => x.key === k).item.n, k0);

  /* the actions sheet */
  await pg.evaluate(k => W.openStop(k), k0); await pg.waitForTimeout(400);
  const sheet = await pg.evaluate(() => ({ acts: [...document.querySelectorAll('.sheet .sh-act')].map(a => a.textContent.trim()), title: (document.querySelector('.sheet .sh-top b') || {}).textContent }));
  t.ok(sheet.acts.length >= 4, 'the actions sheet offers directions, swap, move, reorder and leave free: ' + sheet.acts.join(' | '));
  t.ok(sheet.title === name0, 'the sheet is for the stop that was opened');

  /* move to another day, then undo */
  await pg.click('[data-sheetact="move"]'); await pg.waitForTimeout(250);
  const rows = await pg.evaluate(() => [...document.querySelectorAll('.sh-row')].map(r => +r.dataset.sheetmove));
  t.ok(rows.length >= 1, 'other days of the same city are offered');
  if (rows.length) {
    await pg.click('.sh-row'); await pg.waitForTimeout(700);
    const moved = await pg.evaluate(([k, n, tgt]) => { const P = W.P, here = P.days[W.S.day - 1].slots.find(x => x.key === k); return { hereNow: here.item && here.item.n, there: P.days[tgt - 1].slots.some(y => y.item && y.item.n === n), undo: !!document.querySelector('[data-undo]') }; }, [k0, name0, rows[0]]);
    t.ok(moved.there && moved.hereNow !== name0, 'the stop moved to the chosen day: ' + JSON.stringify(moved));
    t.ok(moved.undo, 'an undo is offered');
    await pg.click('[data-undo]'); await pg.waitForTimeout(500);
    t.eq(await pg.evaluate(k => W.P.days[W.S.day - 1].slots.find(x => x.key === k).item.n, k0), name0, 'undo puts the stop back');
  }

  /* leave it free, then undo */
  await pg.evaluate(k => W.openStop(k), k0); await pg.waitForTimeout(300);
  await pg.click('[data-sheetact="remove"]'); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(k => !!(W.S.free || {})[k], k0), 'the slot is now free time');
  await pg.click('[data-undo]'); await pg.waitForTimeout(500);
  t.eq(await pg.evaluate(k => ({ free: !!(W.S.free || {})[k], n: W.P.days[W.S.day - 1].slots.find(x => x.key === k).item.n }), k0), { free: false, n: name0 }, 'undo brings the stop back');

  /* swap cards */
  const sl = await pg.evaluate(k => W.P.days[W.S.day - 1].slots.find(x => x.key === k).slot, k0);
  await pg.click(`[data-reroll="${sl}"]`); await pg.waitForTimeout(700);
  const sw = await pg.evaluate(() => ({ cards: document.querySelectorAll('.swapcards .scard').length, list: document.querySelectorAll('.swap .opt').length }));
  t.ok(sw.cards === 3, 'three swap cards: ' + JSON.stringify(sw));
  const pickN = await pg.evaluate(() => document.querySelector('.scard').dataset.name);
  await pg.click('.scard'); await pg.waitForTimeout(700);
  t.eq(await pg.evaluate(k => W.P.days[W.S.day - 1].slots.find(x => x.key === k).item.n, k0), pickN, 'tapping a card uses that place');
  t.ok(await pg.evaluate(() => !!document.querySelector('[data-undo]')), 'and can be undone');

  /* the header banner: the trip name, and how far off it is (or where in it you are) */
  const cdn = await pg.evaluate(() => {
    const at = iso => { localStorage.setItem('waypoint-now', iso); W.render(); const c = document.querySelector('.top .ts-c'); return c ? [...c.children].map(x => x.textContent).join(' ').trim() : null; };
    const s = W.S.start, d0 = new Date(s + 'T10:00'), off = n => { const d = new Date(d0); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 16); };
    const r = { months: at(off(-150)), weeks: at(off(-30)), days: at(off(-9)), tomorrow: at(off(-1)), day3: at(off(2)), after: at(off(W.P.N + 3)) };
    localStorage.removeItem('waypoint-now'); W.render();
    r.name = document.querySelector('.top .trip-sw .ts-n b').textContent; r.label = document.querySelector('.top .trip-sw').getAttribute('aria-label'); return r;
  });
  t.eq([cdn.months, cdn.weeks, cdn.days, cdn.tomorrow, cdn.day3, cdn.after], ['5 months to go', '4 weeks to go', '9 days to go', '1 day to go', 'Day 3 of ' + (await pg.evaluate(() => W.P.N)), 'Back home'], 'the header counts down to the trip and follows it: ' + JSON.stringify(cdn));
  t.ok(/^Your trips: .+\. /.test(cdn.label || ''), 'the trip button says the trip and the countdown to a screen reader');
  /* the view switch: one row of three, Day, All days and Explore */
  await pg.evaluate(() => scrollTo(0, 0));
  const vs = await pg.evaluate(() => ({ tabs: [...document.querySelectorAll('#viewTrip .vsw [data-vsw]')].map(b => b.textContent.trim() + (b.getAttribute('aria-selected') === 'true' ? '*' : '')), rows: document.querySelectorAll('#viewTrip .vsw, #viewTrip .dsw').length }));
  t.eq(vs, { tabs: ['Day*', 'All days', 'Explore'], rows: 1 }, 'one row of three: Day, All days and Explore (no second switch under it)');
  await pg.click('#viewTrip [data-vsw="all"]'); await pg.waitForTimeout(500);
  await pg.evaluate(() => scrollTo(0, 0)); await pg.waitForTimeout(300);
  await pg.click('.g-day[data-day="3"]'); await pg.waitForTimeout(900);
  t.eq(await pg.evaluate(() => [W.S.day, document.querySelector('#viewTrip [data-vsw][aria-selected="true"]').dataset.vsw]), [3, 'days'], 'picking a day there opens it');
  await pg.click('#viewTrip [data-vsw="map"]'); await pg.waitForTimeout(700);
  t.ok(await pg.evaluate(() => W.S.tview === 'map' && !document.querySelector('#viewTrip .rcard') && !!document.querySelector('#placeQ') && !document.querySelector('#viewTrip svg.map')), 'Explore shows the search, and neither the route (it is on Today) nor a sketch map');
  /* each of the three goes straight to its view */
  await pg.click('#viewTrip [data-vsw="all"]'); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(() => W.S.glanceOpen && W.S.tview === 'days' && document.querySelectorAll('#viewTrip .g-day').length === W.P.N && document.querySelector('#viewTrip [data-vsw="all"]').getAttribute('aria-selected') === 'true'), 'All days from Explore, in one tap');
  await pg.click('#viewTrip [data-vsw="map"]'); await pg.waitForTimeout(600);
  t.ok(await pg.evaluate(() => W.S.tview === 'map' && !W.S.glanceOpen && document.querySelector('#viewTrip [data-vsw="map"]').getAttribute('aria-selected') === 'true'), 'Explore from All days, in one tap');
  await pg.click('#viewTrip [data-vsw="all"]'); await pg.waitForTimeout(500);
  await pg.click('#viewTrip [data-vsw="days"]'); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(() => !W.S.glanceOpen && !!document.querySelector('#viewTrip .day-h')), 'and Day goes back to the day');
  /* the storybook is gone: no way in, and a trip saved on it opens on the day */
  t.ok(await pg.evaluate(() => { W.S.tview = 'story'; W.render(); return W.S.tview === 'days' && !document.querySelector('[data-story], [data-sync="story"], .story') && !!document.querySelector('#viewTrip .day-h'); }), 'there is no storybook, and a trip left on it opens on the day');
  /* a travel day with long car-rental text stays inside its card on a phone */
  const legOver = await pg.evaluate(() => {
    const P = W.P, L = W.legFor(P, 1); if (!L) return null;
    W.C.legs[L.key] = { v: W.C.legs[L.key] && W.C.legs[L.key].v, opts: [
      { mode: 'car', op: 'Local rental agencies in Rethymno (Avis, Hertz, local operators)', dur: '1h 15m', price: '€35–60/day rental, shared between the group, plus fuel', from: 'Rethymno town (rental pick-up)', to: 'Heraklion city centre', freq: 'Anytime', book: true, note: 'Book a car with extra-large seats or a booster for the 3-year-old.' },
      { mode: 'bus', op: 'KTEL Rethymno / KTEL Heraklion-Lasithi', dur: '1h 30m', price: '€9–12' }] };
    W.S.legPick = {}; W.replan(); W.S.day = W.P.days.find(d => d.stop === 1).n; W.render();
    const c = document.querySelector('#viewTrip .legcard'), r = c.getBoundingClientRect();
    const res = { w: Math.round(r.width), page: document.documentElement.scrollWidth <= innerWidth, out: [...c.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > r.right + 1).map(e => e.className || e.tagName).slice(0, 4) };
    W.S.day = 3; W.render(); scrollTo(0, 0); return res;
  });
  await pg.waitForTimeout(400);
  t.ok(legOver && legOver.out.length === 0 && legOver.page, 'long travel-leg text wraps inside its card: ' + JSON.stringify(legOver));

  /* swipe between days */
  const ys = await pg.evaluate(() => { const s = document.querySelector('.slots'); const r = s.getBoundingClientRect(); return Math.round(r.top + 60); });
  await pg.touchscreen.tap(300, ys).catch(() => {});
  await pg.evaluate(y => { const s = document.querySelector('.slots'); const T = (x, type) => s.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: s, clientX: x, clientY: y })], changedTouches: [new Touch({ identifier: 1, target: s, clientX: x, clientY: y })] })); T(320, 'touchstart'); T(200, 'touchmove'); T(60, 'touchmove'); T(60, 'touchend'); }, ys);
  await pg.waitForTimeout(900);
  t.eq(await pg.evaluate(() => W.S.day), 4, 'a swipe left goes to the next day');

  /* the next-step bar */
  await pg.click('#tabTrip'); await pg.waitForTimeout(600);
  t.eq(await pg.evaluate(() => !!document.querySelector('[data-nextstep]')), false, 'nothing is due within a month, so no next-step bar');
  await pg.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 20); W.S.start = d.toISOString().slice(0, 10); W.changed(); }); await pg.waitForTimeout(1200);
  const nx = await pg.evaluate(() => (document.querySelector('[data-nextstep]') || {}).innerText || '');
  t.ok(/book/i.test(nx), 'with the trip three weeks away, the bar says what to book: ' + nx.replace(/\s+/g, ' ').slice(0, 70));
  await pg.evaluate(() => { W.S.start = '2027-06-07'; W.changed(); }); await pg.waitForTimeout(600);

  /* quick start: a new trip from one sheet */
  await pg.evaluate(() => W.quickStart()); await pg.waitForTimeout(400);
  await pg.fill('#qsWhere', 'portugal'); await pg.fill('#qsStart', '2027-07-05'); await pg.fill('#qsDays', '9');
  await pg.click('[data-qs="k+"]'); await pg.waitForTimeout(150);
  await pg.fill('[data-qskid="' + (await pg.evaluate(() => document.querySelectorAll('[data-qskid]').length - 1)) + '"]', '2');
  await pg.fill('#qsFrom', 'Seattle (SEA)');
  await pg.click('[data-qs="go"]'); await pg.waitForTimeout(800);
  const qs = await pg.evaluate(() => ({ view: W.view(), country: W.S.countries[0] && W.S.countries[0].name, days: W.S.days, start: W.S.start, kids: W.S.travelers.filter(a => a < 18).length, depart: W.S.depart }));
  t.eq(qs, { view: 'trip', country: 'Portugal', days: 9, start: '2027-07-05', kids: qs.kids, depart: 'Seattle (SEA)' }, 'quick start sets up the trip: ' + JSON.stringify(qs));
  t.ok(qs.kids >= 1, 'with the child that was added');
  await calm(pg, 7500);
  const later = await pg.evaluate(() => ({ stops: W.P.stops.map(x => x.name), slots: document.querySelectorAll('.slots .slot[data-slotkey]').length }));
  t.ok(later.stops.length >= 2 && later.slots >= 4, 'and the trip fills in: ' + JSON.stringify(later));
  /* islands: a destination is a town, never a whole island */
  { const { pg: pi, ctx: ci, errors: ei } = await open(b, { width: 390, height: 844 }); await exampleTrip(pi);
    const lists = await pi.evaluate(() => {
      const names = c => W.countryCities(c).map(x => x.name), isl = [];
      Object.keys(TD).forEach(c => names(c).forEach(n => { if (W.isleOf(c, n) || W.findCity(c, n).whole) isl.push(c + ': ' + n); }));
      const g = names('Greece'), f = W.findCity('Greece', 'Santorini');
      return { isl, towns: ['Fira', 'Oia', 'Heraklion', 'Chania', 'Naxos Town', 'Corfu Town'].filter(n => !g.includes(n)), islands: ['Santorini', 'Crete', 'Naxos', 'Corfu'].filter(n => g.includes(n)),
        palma: names('Spain').includes('Palma de Mallorca') && !names('Spain').includes('Mallorca'), patong: names('Thailand').includes('Patong'), italy: names('Italy').slice(0, 5),
        whole: !!(f && f.whole && f.spots.length), spots: (W.findCity('Greece', 'Fira').spots || []).length, base: W.findCity('Greece', 'Fira').isl,
        vancouver: !!W.isleOf('Canada', 'Vancouver'), vi: !!W.isleOf('Canada', 'Vancouver Island'), skye: !!W.isleOf('United Kingdom', 'skye'), typed: !!W.isleOf('Greece', 'the island of Santorini'), victoria: !!W.isleOf('Canada', 'Victoria') };
    });
    t.eq(lists.isl, [], 'no built-in destination is a whole island, in any country');
    t.eq([lists.towns, lists.islands], [[], []], 'Greece offers Fira, Oia, Heraklion, Chania, Naxos Town and Corfu Town, and not Santorini, Crete, Naxos or Corfu');
    t.ok(lists.palma && lists.patong, 'Mallorca gives way to Palma de Mallorca, Phuket & Krabi to its towns');
    t.eq(lists.italy, ['Rome', 'Florence', 'Venice', 'Amalfi Coast', 'Lake Como'], 'a country with no island in its list is as it was');
    t.ok(lists.whole && lists.spots >= 3 && lists.base === 'Santorini', 'an island can still be looked up (an older trip has one), and its towns carry its built-in ideas: ' + JSON.stringify(lists));
    t.ok(!lists.vancouver && lists.vi && lists.skye && lists.typed && !lists.victoria, 'Vancouver is a city and Vancouver Island an island; Skye and "the island of Santorini" are islands; Victoria is a town');
    /* a list Claude gave before this named islands: the ones we know give way to their towns at once, and a new answer
       replaces the others without the towns already there shifting */
    const old = await pi.evaluate(async () => {
      const mk = (name, pop) => ({ name, region: 'Dalmatia', lat: 43.5, lng: 16.4, w: 2, pop, t: [], d: '' });
      W.C.country.Croatia = { blurb: 'b', cities: [mk('Split', 5), mk('Hvar', 5), mk('Vis', 3), mk('Dubrovnik', 5)] };
      const before = W.countryCities('Croatia').map(x => x.name);
      const merged = W.islesInto(W.C.country.Croatia.cities, W.townsOnly([Object.assign(mk('Vis Town', 3), { isl: 'Vis' }), Object.assign(mk('Komiža', 2), { isl: 'Vis' }), Object.assign(mk('Vis', 3), { isl: 'Vis' }), mk('Zadar', 4), Object.assign(mk('Split', 1), { isl: '' })])).map(x => x.name + (x.pop === 5 ? '*' : ''));
      const alone = W.townsOnly([Object.assign(mk('Hydra', 3), { isl: 'Hydra' }), mk('Nafplio', 4)]).map(x => x.name);
      W.loadCountry('Croatia'); for (let i = 0; i < 40 && !(W.C.country.Croatia.v >= 2); i++) await new Promise(r => setTimeout(r, 150));
      return { before, merged, alone, v: W.C.country.Croatia.v, kept: W.C.country.Croatia.cities.map(x => x.name) };
    });
    t.eq(old.before, ['Split', 'Hvar Town', 'Stari Grad', 'Jelsa', 'Vis', 'Dubrovnik'], 'an older list: Hvar gives way to its towns');
    t.eq(old.merged, ['Split*', 'Hvar*', 'Dubrovnik*', 'Vis Town', 'Komiža'], 'a new answer swaps the island it names (Vis) for its towns and leaves the rest as it was, adding nothing else');
    t.eq(old.alone, ['Hydra', 'Nafplio'], 'a small island named alone stays, as its one town');
    t.ok(old.v === 2 && old.kept.slice(0, 4).join() === 'Split,Hvar,Vis,Dubrovnik', 'the older list is asked again once and keeps its towns: ' + JSON.stringify([old.v, old.kept.length]));
    /* choosing places yourself: an island typed as a place offers its towns and adds nothing */
    await pi.evaluate(() => { W.S.countries = [{ name: 'Greece', mode: 'manual', picked: ['Athens'] }]; W.S.cityDays = {}; W.S.days = 9; (W.S.stepClosed = W.S.stepClosed || {}).where = false; W.setView('setup'); W.changed(); });
    await pi.waitForSelector('#cityIn0', { timeout: 15000 });
    const ph = await pi.getAttribute('#cityIn0', 'placeholder');
    await pi.fill('#cityIn0', 'crete'); await pi.click('[data-addcity="0"]'); await pi.waitForTimeout(400);
    const ask = await pi.evaluate(() => { const e = document.querySelector('.country .isle-ask'); return { text: e && e.querySelector('p').textContent, towns: e ? [...e.querySelectorAll('.chip')].map(x => x.textContent) : [], picked: W.S.countries[0].picked.slice() }; });
    t.ok(/Crete is a whole island/.test(ask.text || '') && ask.towns.slice(0, 3).join() === 'Heraklion,Chania,Rethymno' && ask.picked.join() === 'Athens' && !/island/.test(ph), 'typing Crete offers its towns and adds nothing: ' + JSON.stringify(ask) + ' ' + ph);
    await pi.click('.isle-ask .chip[data-pick="Chania"]'); await pi.waitForTimeout(400);
    const picked = await pi.evaluate(() => ({ picked: W.S.countries[0].picked.slice(), on: (document.querySelector('.isle-ask .chip[data-pick="Chania"]') || { getAttribute: () => null }).getAttribute('aria-pressed'), stops: W.P.stops.map(x => x.name) }));
    t.eq(picked, { picked: ['Athens', 'Chania'], on: 'true', stops: ['Athens', 'Chania'] }, 'tapping a town adds it');
    await pi.click('[data-isledone="0"]'); await pi.waitForTimeout(300);
    t.ok(await pi.evaluate(() => !document.querySelector('.isle-ask')), 'Done puts the towns away');
    /* an older trip with an island as a stop still plans, and offers the island's towns in its place */
    await pi.evaluate(() => { W.S.countries[0].picked = ['Athens', 'Santorini']; W.S.cityDays = { 'Greece|Athens': 3, 'Greece|Santorini': 4 }; W.S.stays = { 'Greece|Santorini': { label: 'Hotel Caldera' } }; W.S.days = 7; W.changed(); });
    await pi.waitForSelector('.stop .isle-ask', { timeout: 10000 });
    const was = await pi.evaluate(() => ({ stops: W.P.stops.map(x => x.name + ' ' + x.days), towns: [...document.querySelectorAll('.stop .isle-ask .chip')].map(x => x.textContent) }));
    t.ok(was.stops.join() === 'Athens 3,Santorini 4' && was.towns.includes('Oia'), 'an older trip with Santorini as a stop still plans, with its towns on offer: ' + JSON.stringify(was));
    await pi.click('.stop .isle-ask .chip[data-town="Oia"]'); await pi.waitForTimeout(500);
    const now = await pi.evaluate(() => ({ picked: W.S.countries[0].picked.slice(), days: W.S.cityDays['Greece|Oia'], gone: W.S.cityDays['Greece|Santorini'] === undefined, stay: (W.S.stays['Greece|Oia'] || {}).label, hint: !!document.querySelector('.stop .isle-ask'), stops: W.P.stops.map(x => x.name + ' ' + x.days) }));
    t.eq(now, { picked: ['Athens', 'Oia'], days: 4, gone: true, stay: 'Hotel Caldera', hint: false, stops: ['Athens 3', 'Oia 4'] }, 'choosing a town puts it in the island\'s place, with its days and its lodging');
    /* suggested places: towns only, and one base on a small island */
    const sug = await pi.evaluate(() => {
      W.S.countries = [{ name: 'Greece', mode: 'suggest', picked: [] }]; W.S.cityDays = { 'Greece|Santorini': 5 }; W.S.stays = {}; W.S.days = 21; W.changed();
      const st = W.plan().stops, close = [];
      st.forEach((a, i) => st.forEach((b2, j) => { if (j > i && a.c.isl && a.c.isl === b2.c.isl && W.km(a.c, b2.c) < 40) close.push(a.name + '+' + b2.name); }));
      return { stops: st.map(x => x.name), isl: st.filter(x => W.isleOf('Greece', x.name)).map(x => x.name), close, moved: W.S.cityDays['Greece|Fira'], old: W.S.cityDays['Greece|Santorini'] };
    });
    t.ok(sug.stops.length >= 3 && !sug.isl.length && !sug.close.length, 'suggested places are towns, with no two on the same small island: ' + JSON.stringify(sug));
    t.ok(sug.moved === 5 && sug.old === undefined, 'days once set for a suggested island go to its usual base');
    /* quick start: an island named among the places is turned back with its towns */
    await pi.evaluate(() => W.quickStart()); await pi.waitForTimeout(400);
    await pi.fill('#qsWhere', 'Greece'); await pi.fill('#qsCities', 'Athens, Santorini'); await pi.click('[data-qs="go"]'); await pi.waitForTimeout(500);
    const q1 = await pi.evaluate(() => ({ open: !!document.querySelector('.qs.sheet'), warn: (document.querySelector('.qs .warn') || {}).textContent, kept: (document.getElementById('qsCities') || {}).value, ph: (document.getElementById('qsCities') || {}).placeholder }));
    t.ok(q1.open && /Santorini is a whole island/.test(q1.warn || '') && /Fira/.test(q1.warn) && q1.kept === 'Athens, Santorini' && !/Crete/.test(q1.ph), 'quick start turns an island back and names its towns: ' + JSON.stringify(q1));
    await pi.fill('#qsCities', 'Athens, Fira'); await pi.click('[data-qs="go"]'); await pi.waitForTimeout(800);
    t.eq(await pi.evaluate(() => W.S.countries[0].picked.slice()), ['Athens', 'Fira'], 'and takes the town');
    t.eq(ei(), [], 'islands: no page errors');
    await ci.close(); }
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
