/* One clock. Everything live (which day is today, now and next, when to leave, the greeting, the banner's time) goes by
   the time of day where the trip is, not by the phone's own clock: a grandparent following a shared trip from Los
   Angeles sees the same "Now" as the family standing in Rome. Before the trip the phone's own clock stands, and the
   banner adds the time where you are going. (lib/times.js: W.instant, W.now, W.tripShift, W.tripZone) */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch();
  /* what the screens say about the time, at a pinned clock */
  const read = (pg, pin) => pg.evaluate(async pin => {
    if (pin) localStorage.setItem('waypoint-now', pin); else localStorage.removeItem('waypoint-now');
    W.replan(); W.dataV = (W.dataV || 0) + 1; W.needLater(); W.goView('go'); W.render(); await new Promise(r => setTimeout(r, 700)); W.render();
    const P = W.plan(), n = W.todayN(P), top = document.querySelector('#topline'), go = document.querySelector('#viewGo');
    const head = go ? (go.querySelector('h2, .go-h, .go-when') || go).textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : '';
    const now = go && go.querySelector('.go-now, .now-card, .gn'); 
    W.S.day = n || W.S.day; W.S.tview = 'days'; W.goView('trip'); W.render();
    const hd = document.querySelector('#viewTrip .today-h'), card = hd && hd.closest('.today');
    return { shift: W.tripShift(), hour: W.now().getHours(), min: W.now().getMinutes(), date: W.isoDay(W.now()), todayN: n, greeting: W.greeting().split(',')[0],
      banner: top ? top.textContent.replace(/\s+/g, ' ').trim() : '', goHead: head, goText: go ? go.textContent.replace(/\s+/g, ' ').trim().slice(0, 400) : '',
      cardHead: card ? hd.textContent.replace(/\s+/g, ' ').trim() : '', card: card ? card.textContent.replace(/\s+/g, ' ').replace(/ · Rome time/, '').trim() : '', devHour: new Date().getTimezoneOffset() };
  }, pin);

  /* ---- a phone that is in Rome (or any phone, as the tests pin it: the trip's own time) ---- */
  const rome = await open(b, { width: 390, height: 844, db: mkdb(), tz: 'Europe/Rome' }); await exampleTrip(rome.pg); await settle(rome.pg, 6000);
  const there = await read(rome.pg, '2027-06-09T08:30:00Z');   /* 10:30 in Rome on day 3 */
  t.ok(there.shift === 0 && there.hour === 10 && there.min === 30 && there.todayN === 3, 'a phone on the trip\'s time reads its own clock: 10:30, day 3, nothing moved');
  t.ok(/^Today ?10:30/.test(there.cardHead) && !/time/.test(there.cardHead) && !/Rome time/.test(there.goText), 'and nothing says "Rome time": it is simply the time (' + there.cardHead + ')');
  t.ok(/Good morning/.test(there.banner) && /10:30\s?AM in Rome/.test(there.banner), 'the banner greets by it and shows it: "' + there.banner + '"');

  /* ---- the same moment, seen from Los Angeles (1:30 at night there, the day before by an hour and a half… no: same date) ---- */
  const la = await open(b, { width: 390, height: 844, db: mkdb(), tz: 'America/Los_Angeles' }); await exampleTrip(la.pg); await settle(la.pg, 6000);
  const far = await read(la.pg, '2027-06-09T08:30:00Z');
  t.ok(far.shift === 540 && far.hour === 10 && far.min === 30, 'from Los Angeles, nine hours behind, the trip\'s clock still reads 10:30 (' + far.shift + ' min ahead of the phone)');
  t.ok(far.todayN === 3 && far.date === '2027-06-09', 'today is the trip\'s day 3');
  t.ok(/^Today ?10:30\s?AM · Rome time/.test(far.cardHead), 'the Today card says whose time it is: "' + far.cardHead + '"');
  t.ok(/Rome time/.test(far.goText), 'and so does the Today tab');
  t.ok(far.card === there.card && far.card.length > 40, 'what is on now and next is word for word what the family in Rome sees');
  t.ok(/Good morning/.test(far.banner) && /10:30\s?AM in Rome/.test(far.banner), 'the banner agrees with it: "' + far.banner + '" (not "Good evening" by the phone, and not a second time)');

  /* ---- the date turns over there first ---- */
  const late = await read(la.pg, '2027-06-08T22:30:00Z');   /* 3:30 pm on the 8th in Los Angeles, half past midnight on the 9th in Rome */
  t.ok(late.date === '2027-06-09' && late.todayN === 3 && late.hour === 0, 'at half past midnight in Rome it is already day 3, though the phone is still on the afternoon before');
  const early = await read(la.pg, '2027-06-09T21:00:00Z');  /* 11 pm in Rome */
  t.ok(early.todayN === 3 && early.hour === 23 && /Good evening/.test(early.banner), 'and at 11 at night there it is still day 3, and evening');

  /* ---- before the trip: your own clock, and the time where you are going beside it ---- */
  const pre = await read(la.pg, '2027-05-20T16:00:00Z');    /* 9 am in Los Angeles, 6 pm in Rome */
  t.ok(pre.shift === 0 && pre.hour === 9 && pre.todayN === null, 'before the trip the clock is the phone\'s own (9:00 in Los Angeles)');
  t.ok(/Good morning/.test(pre.banner) && /6:00\s?PM in Rome/.test(pre.banner), 'the greeting goes by it, and the banner adds the time in Rome: "' + pre.banner + '"');
  const post = await read(la.pg, '2027-08-01T16:00:00Z');
  t.ok(post.shift === 0 && post.todayN === null, 'and after the trip too');

  /* ---- a test's plain time is the trip's own clock, whatever zone the browser is in ---- */
  const plain = await read(la.pg, '2027-06-09T10:30');
  t.ok(plain.shift === 0 && plain.hour === 10 && plain.todayN === 3 && plain.card === there.card && /10:30\s?AM in Rome/.test(plain.banner), 'a time pinned without a zone is read as the trip\'s time, and the banner shows that same time');

  /* ---- countries with several zones ---- */
  const z = await la.pg.evaluate(() => { const f = (c, lng, lat) => W.tripZone(c, lng, lat).tz; return { la: f('United States', -118.2), den: f('United States', -105), chi: f('United States', -87.6), ny: f('United States', -74), hnl: f('United States', -157.8, 21.3), anc: f('United States', -149.9, 61.2),
    syd: f('Australia', 151.2), per: f('Australia', 115.9), van: f('Canada', -123.1), tor: f('Canada', -79.4), can: f('Mexico', -86.8), it: f('Italy', 12.5), rough: W.tripZone('United States', -118).rough, one: W.tripZone('Italy', 12.5).rough }; });
  t.eq([z.la, z.den, z.chi, z.ny, z.hnl, z.anc], ['America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'Pacific/Honolulu', 'America/Anchorage'], 'in a country with several zones the place\'s longitude picks one (Los Angeles, Denver, Chicago, New York; Honolulu and Anchorage told apart by latitude)');
  t.eq([z.syd, z.per, z.van, z.tor, z.can, z.it], ['Australia/Sydney', 'Australia/Perth', 'America/Vancouver', 'America/Toronto', 'America/Cancun', 'Europe/Rome'], 'likewise Sydney, Perth, Vancouver, Toronto, Cancún; a one-zone country keeps its zone');
  t.ok(z.rough === true && z.one === false, 'such a zone is marked as a guess: a phone within the hour of it is taken to be there, and its own clock stands');
  t.eq(rome.errors().concat(la.errors()), [], 'no page errors');
  await b.close();
};
