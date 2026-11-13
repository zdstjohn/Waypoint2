/* v178, two of the owner's asks. On a phone a stop card's Menu and Swap sit behind one "more" button (its menu opens
   under it, closes on a choice, a tap elsewhere or Escape). And nothing is limited or suggested for someone who isn't
   on the trip: with only adults, no nap, no children's hours, no kids' corner, no kids' packing or picky-kids diet, and
   the questions to Claude don't mention children; with a toddler, all of it is back. */
const { launch, open, exampleTrip, settle } = require('../lib/page');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844 }); await exampleTrip(pg);
  await pg.waitForFunction(() => W.laterReady, null, { timeout: 15000 }).catch(() => {});
  const wait = ms => pg.waitForTimeout(ms);

  /* ---- the "more" button ---- */
  const L = '#viewTrip [data-slotkey="Italy|Rome|2|lunch"]';
  const m0 = await pg.evaluate(L => { const c = document.querySelector(L), mb = c.querySelector('.more-btn'), acts = c.querySelector('.sl-acts');
    return { more: !!mb && getComputedStyle(mb).display !== 'none', hidden: getComputedStyle(acts).display === 'none', h: Math.round(c.getBoundingClientRect().height) }; }, L);
  t.ok(m0.more && m0.hidden, 'a phone card shows one "more" button, its Menu and Swap hidden: ' + JSON.stringify(m0));
  await pg.click(L + ' .more-btn'); await wait(150);
  const m1 = await pg.evaluate(L => { const c = document.querySelector(L);
    return { exp: c.querySelector('.more-btn').getAttribute('aria-expanded'), shown: [...c.querySelectorAll('.sl-acts button')].filter(x => x.getBoundingClientRect().height > 30).map(x => x.textContent.trim()) }; }, L);
  t.eq(m1, { exp: 'true', shown: ['Menu', 'Swap'] }, 'a tap opens its menu: Menu and Swap');
  await pg.mouse.click(20, 420); await wait(150);
  t.eq(await pg.evaluate(L => document.querySelector(L + ' .more-btn').getAttribute('aria-expanded'), L), 'false', 'a tap elsewhere closes it');
  await pg.click(L + ' .more-btn'); await wait(100); await pg.keyboard.press('Escape'); await wait(100);
  t.eq(await pg.evaluate(L => document.querySelector(L + ' .more-btn').getAttribute('aria-expanded'), L), 'false', 'Escape closes it');
  await pg.click(L + ' .more-btn'); await wait(100); await pg.click(L + ' .sl-acts [data-reroll]'); await wait(500);
  const sw = await pg.evaluate(L => ({ swap: !!document.querySelector('#viewTrip .swap'), exp: (document.querySelector(L + ' .more-btn') || { getAttribute: () => 'gone' }).getAttribute('aria-expanded') }), L);
  t.ok(sw.swap && sw.exp !== 'true', 'Swap in it opens the swap list, and the menu closes: ' + JSON.stringify(sw));

  /* ---- with a toddler (the example trip: 38, 36, 6, 3) ---- */
  const kidsOn = await pg.evaluate(async () => {
    const d = W.P.days.find(x => !x.trip && !x.move && W.dayTimes(x, W.P) && W.dayTimes(x, W.P).nap);
    W.goView('trip'); document.querySelector('[data-sync="menu"]').click(); await new Promise(r => setTimeout(r, 200));
    const menu = !!document.querySelector('[data-sync="kids"]'); document.querySelector('[data-sync="menu"]').click();
    return { nap: !!d, cap: W.slotCap('eve', W.P.p), menu, plain: (W.EAT_DI.some(x => x[0] === 'plain')), kidsPack: W.packing(W.P).pack.some(i => i.who === 'kids' || i.group === 'kids') };
  });
  t.eq(await pg.evaluate(() => [W.slotCap('dinner', { kid: true }), W.slotCap('dinner', { kid: false }), W.slotCap('eve', { toddler: true, kid: true })]), [1230, 1305, 1200], 'the latest start of dinner and the evening, by who comes (one rule for the planner and "way behind")');
  t.ok(kidsOn.nap && kidsOn.cap === 1200 && kidsOn.menu && kidsOn.kidsPack, 'with a toddler: a nap, the 8 pm cap, the kids\' corner and kids\' packing: ' + JSON.stringify(kidsOn));

  /* ---- only adults ---- */
  await pg.evaluate(() => { W.S.travelers = [38, 36]; W.replan && W.replan(); W.changed ? W.changed() : W.render(); }); await settle(pg, 3000);
  const adults = await pg.evaluate(async () => {
    const P = W.P, wait = ms => new Promise(r => setTimeout(r, ms));
    const naps = P.days.filter(d => { const T = W.dayTimes(d, P); return T && T.nap; }).length;
    W.goView('trip'); await wait(200); document.querySelector('[data-sync="menu"]').click(); await wait(200);
    const menu = !!document.querySelector('[data-sync="kids"]'); document.querySelector('[data-sync="menu"]').click();
    const pk = W.packing(P), packText = pk.pack.concat(pk.todo || []).map(i => i.text).join(' | ');
    W.goView('setup'); await wait(300); const setup = document.getElementById('viewSetup').textContent;
    const day = document.getElementById('viewTrip').textContent;
    return { naps, p: P.p, dinnerCap: W.slotCap('dinner', P.p), eveCap: W.slotCap('eve', P.p), kd: W.kidDinner(), menu,
      kidsPack: /kid|stroller|toddler|child/i.test(packText) ? packText.match(/[^|]*(kid|stroller|toddler|child)[^|]*/i)[0] : '',
      picky: /picky kids/i.test(setup), who: W.who() };
  });
  t.ok(adults.naps === 0 && !adults.p.kid && !adults.p.toddler && adults.kd === null && adults.dinnerCap === 1305 && adults.eveCap === 1350,
    'only adults: no nap, no children\'s dinner hour or caps: ' + JSON.stringify({ naps: adults.naps, kd: adults.kd, caps: [adults.dinnerCap, adults.eveCap] }));
  t.ok(!adults.menu, 'no kids\' corner in the trip menu');
  t.eq(adults.kidsPack, '', 'nothing for children on the packing list');
  t.ok(!adults.picky, 'no "picky kids" diet to tick');
  /* what Claude is asked: the plan check and the evening briefing don't bring up children */
  const asks = await pg.evaluate(async () => {
    const n0 = (window.__full || []).length;
    if (W.reviewStart) W.reviewStart(W.P);
    if (W.briefStart) W.briefStart(W.P.days[1]);
    await new Promise(r => setTimeout(r, 800));
    const got = (window.__full || []).slice(n0).map(String);
    return { n: got.length, kids: got.map(s => (s.match(/[^.]*\b(small children|a small child|with children|the kids|a parent)\b[^.]*/i) || [''])[0]).filter(Boolean) };
  });
  t.ok(asks.n >= 1 && asks.kids.length === 0, 'Claude\'s plan check and briefing don\'t mention children: ' + JSON.stringify(asks));
  /* (v181) a traveler without an age: the plan treats them as an adult, and Plan says so */
  const na = await pg.evaluate(async () => { W.S.travelers = [38, '']; W.goView('setup'); await new Promise(r => setTimeout(r, 400)); const txt = document.getElementById('viewSetup').textContent;
    W.S.travelers = [38, 36]; W.goView('trip'); return /no age yet, so the plan treats them as adults/.test(txt); });
  t.ok(na, 'Plan says a traveler with no age is planned as an adult');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
