/* Today's nap and rest cards (screens/travel.js heroCard): the cards a toddler's family follows through the middle of the
   day. On the example trip's day 2 at a pinned clock, each says to the minute what it should:
     at the nap            "Nap time · until 2:30 PM", "Rest back at <stay>", "Nap until 2:30 PM, then the afternoon starts."
     just before the nap   "Next · 1:00 PM nap", "Head back to <stay>", when to head back
     at lunch              the nap as "Next" under the lunch card, with its way back and how long until you leave
     a day out             a nap in the stroller or the car (no way back to the stay), an hour, "the afternoon starts about …"
     a rest day            "Rest time · until …" / "Next · … rest", "Take it easy near <stay>"
   and that Directions go to the stay when one is picked and are not offered when none is. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg, { home: true }); await settle(pg, 3000);
  /* Today at a pinned time on day 2; `pre` runs first in the page */
  const card = (hhmm, pre, post) => pg.evaluate(async ([hhmm, pre, post]) => {
    localStorage.setItem('waypoint-now', '2027-06-08T' + hhmm + ':00'); if (pre) new Function(pre)(); W.S.day = 2; W.replan(); if (post) new Function(post)(); W.dataV = (W.dataV || 0) + 1; W.goView('go'); W.render(); await new Promise(r => setTimeout(r, 600)); W.render();
    const P = W.P, d = P.days[1], T = W.dayTimes(d, P), h = document.querySelector('#viewGo .go-hero'), nx = document.querySelector('#viewGo .gh-next'), nm = W.nowMin(), home = W.homebase(d.country, d.city);
    const txt = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
    const rest = d.slots.find(x => x.rest), RR = rest ? T.rows[rest.slot] : null;
    return { nm, hero: txt(h), kick: txt(h && h.querySelector('.gh-k')), h2: txt(h && h.querySelector('h2')), leave: txt(h && h.querySelector('.leave')), soon: !!(h && h.querySelector('.leave.soon')), note: txt(h && h.querySelector('p.muted')), btn: h && h.querySelector('a.btn') ? h.querySelector('a.btn').getAttribute('href') : null, cls: h ? h.className : '',
      next: txt(nx), nextLeave: txt(nx && nx.querySelector('.leave')), nap: T.nap || null, home: home.label, homeNone: !!home.none, wantDir: home.none ? null : W.gmapsDir(null, home, 'transit'),
      leg: null, rest: RR ? { start: RR.start, end: RR.end } : null, clock: [T.nap ? W.clock(T.nap.start) : '', T.nap ? W.clock(T.nap.end) : '', RR ? W.clock(RR.start) : '', RR ? W.clock(RR.end) : ''] };
  }, [hhmm, pre || '', post || '']);
  const withStay = "var d = W.P.days[1], ck = W.cityKey(d.country, d.city); W.S.stays = W.S.stays || {}; W.S.stays[ck] = { label: 'Hotel Roma', lat: 41.9, lng: 12.5 };";
  const noStay = "var d = W.P.days[1], ck = W.cityKey(d.country, d.city); if (W.S.stays) delete W.S.stays[ck];";

  /* ---- no stay picked yet: the cards say "your stay" and offer no Directions ---- */
  let c = await card('13:30', noStay);
  t.ok(c.nap && c.nap.start === 780 && c.nap.end === 870 && c.homeNone, 'day 2: nap 1:00 to 2:30 pm, no stay picked');
  t.ok(c.kick === 'Nap time · until 2:30 PM' && c.h2 === 'Rest back at your stay' && c.note === 'Nap until 2:30 PM, then the afternoon starts.' && /nap/.test(c.cls), 'at 1:30 the nap card: "' + c.hero + '"');
  t.eq(c.btn, null, 'with no stay picked there is no Directions button (there is nowhere to go)');

  /* ---- with a stay: Directions to it ---- */
  c = await card('13:30', withStay);
  t.ok(c.h2 === 'Rest back at Hotel Roma' && c.btn && c.btn === c.wantDir && /Directions/.test(c.hero), 'with a stay picked: "Rest back at Hotel Roma" and Directions to it: ' + c.btn);
  t.ok(!c.leave, 'and no "leave" line while the nap is on');
  c = await card('12:50', withStay);
  const leg = 15;   /* (lunch's place to the stay: a quarter hour by transit, as the plan says: the nap starts at lunch's end + it) */
  t.ok(c.kick === 'Next · 1:00 PM nap' && c.h2 === 'Head back to Hotel Roma', 'at 12:50, between lunch and the nap: "Next · 1:00 PM nap", "Head back to Hotel Roma": "' + c.hero + '"');
  t.ok(/^Time to head back/.test(c.leave) && c.soon && /15 min transit/.test(c.leave) && c.nap.start - c.nm === 10, 'ten minutes to the nap and a quarter hour\'s way: "' + c.leave + '"');
  c = await card('12:20', withStay);
  t.ok(/^Next · 1:00 PM nap/.test(c.next) && /Back to Hotel Roma/.test(c.next) && c.nextLeave.indexOf('Leave in 25 min') === 0 && /15 min transit/.test(c.nextLeave), 'at lunch the nap is "Next" under it, with the way back and when to leave (1:00 pm minus 15 minutes, at 12:20: 25 minutes): "' + c.nextLeave + '"');
  c = await card('12:44', withStay);
  t.ok(/Leave in 5 min|Time to head back/.test(c.nextLeave || c.leave), 'a minute before lunch ends: ' + (c.nextLeave || c.leave));

  /* ---- a day out: a nap in the stroller or the car ---- */
  /* (the stand-in: this day is spent out; a day trip's own town name, " in Tivoli", is not covered) */
  const away = "window.__dayOut0 = window.__dayOut0 || W.dayOut; W.dayOut = function (d) { return d.n === 2 ? { name: 'Tivoli', far: true, item: null } : null; };", awayPost = '';
  c = await card('13:30', away, awayPost);
  t.ok(c.nap && c.nap.away && c.nap.end - c.nap.start === 60, 'on a day trip the nap is away and an hour: ' + JSON.stringify(c.nap));
  t.ok(c.kick === 'Nap time · until ' + c.clock[1] && c.h2 === 'Nap in the stroller or the car' && c.note === 'You\'re out for the day: a quiet walk or a shady bench does it. The afternoon starts about ' + c.clock[1] + '.', 'the card: "' + c.hero + '"');
  t.eq(c.btn, null, 'with no way back to the stay: no Directions');
  c = await card('12:50', away, awayPost);
  t.ok(c.kick === 'Next · ' + c.clock[0] + ' nap' && c.h2 === 'Nap in the stroller or the car', 'before it: "' + c.kick + '"');
  await pg.evaluate(() => { W.dayOut = window.__dayOut0; });

  /* ---- a rest day ---- */
  const rest = "var d = W.P.days[1]; W.S.rest = W.S.rest || {}; W.S.rest[W.restKey(d)] = 1;";
  c = await card('08:30', rest + withStay);
  t.ok(c.rest && c.rest.start > 0, 'a rest day has a rest in the morning: ' + JSON.stringify(c.rest));
  const rs = c.rest;
  c = await card(String(Math.floor((rs.start + 10) / 60)).padStart(2, '0') + ':' + String((rs.start + 10) % 60).padStart(2, '0'), rest + withStay);
  t.ok(c.kick === 'Rest time · until ' + c.clock[3] && c.h2 === 'Take it easy near Hotel Roma' && c.btn === c.wantDir, 'during it: "' + c.hero + '"');
  /* (the "Next · … rest" wording in heroCard is never reached: what comes next is a stop or the nap, never a rest, so only "Rest time" is shown) */
  c = await card(String(Math.floor((rs.start - 15) / 60)).padStart(2, '0') + ':' + String((rs.start - 15) % 60).padStart(2, '0'), rest + withStay);
  t.ok(!/ rest/.test(c.kick) || /^Now/.test(c.kick), 'before the rest the card is the stop in hand, with what is next under it: "' + c.kick + '"');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
