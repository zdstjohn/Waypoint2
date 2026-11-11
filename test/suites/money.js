/* Prices in: each phone chooses the currency costs are shown in, as listed (the default) or one currency for everything,
   converted at the European Central Bank's rates (fx/latest in the database) and marked "≈"; prices written in text
   ("€15, book ahead", "£8–12") convert too; Prepare and Settings offer the choice; no rate means "as listed". */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const seed = { 'fx/latest': { base: 'EUR', date: '2026-11-06', rates: { USD: 1.1165, GBP: 0.83415, JPY: 176.77 } } };
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb(seed) }); await exampleTrip(pg);
  await pg.waitForFunction(() => W.fxRate && W.fxRate('EUR', 'USD') > 1, null, { timeout: 8000 }).catch(() => {});
  const r = await pg.evaluate(() => {
    const asListed = W.money(150, 'EUR'); W.setCurView('USD');
    const out = { asListed, usd: W.money(150, 'EUR'), same: W.money(20, 'USD'), raw: W.money(150, 'EUR', true), none: W.money(1000, 'MAD'),
      t1: W.priceText('€15, book ahead', 'EUR'), t2: W.priceText('£8–12 per person', 'GBP'), t3: W.priceText('Free'), t4: W.priceText('USD 20 online'), t5: W.priceText('$12 at the door', 'MXN') };
    W.setCurView(''); out.back = W.priceText('€15, book ahead'); return out;
  });
  t.ok(/^€\s?150$/.test(r.asListed), 'as listed by default: ' + r.asListed);
  t.ok(/^≈\$167$/.test(r.usd) && /^\$20$/.test(r.same) && /^€\s?150$/.test(r.raw), `in dollars, converted and marked "≈": ${r.usd} (a dollar price stays ${r.same})`);
  t.ok(/MAD/.test(r.none), 'a currency with no rate stays as listed: ' + r.none);
  t.eq([r.t1, r.t2, r.t3, r.t4], ['≈$17, book ahead', '≈$11–16 per person', 'Free', 'USD 20 online'], 'prices written in text convert too');
  t.eq(r.t5, '$12 at the door', 'a "$" in a peso country is pesos: no rate, so it stays');
  t.eq(r.back, '€15, book ahead', 'back to "as listed"');
  /* the choice on Prepare: the budget follows it */
  await pg.evaluate(() => { W.needLater(); W.S.prepTab = 'budget'; W.goView('book'); }); await pg.waitForSelector('#viewBook [data-curpick]', { timeout: 15000 });
  const opts = await pg.evaluate(() => [...document.querySelectorAll('#viewBook [data-curpick] option')].map(o => o.value));
  t.ok(opts[0] === '' && opts.includes('USD') && opts.includes('EUR') && opts.length === 5, 'Prepare offers "as listed" and the currencies with a rate: ' + opts.join(','));
  await pg.selectOption('#viewBook [data-curpick]', 'USD'); await pg.waitForTimeout(500);
  const bud = await pg.evaluate(() => ({ view: W.curView(), txt: document.querySelector('#viewBook').textContent, note: (document.querySelector('#viewBook .cur-pick .small') || {}).textContent || '' }));
  t.ok(bud.view === 'USD' && /≈\$/.test(bud.txt) && /European Central Bank/.test(bud.note), 'choosing dollars shows the budget in dollars, with where the rate comes from: ' + bud.note);
  t.ok(await pg.evaluate(() => localStorage.getItem('waypoint-cur') === 'USD' && !('cur' in W.S)), 'the choice is this phone\'s own, not part of the trip');
  /* it lives inside Budget: the header above the tabs is the same height on every tab, so nothing jumps when you change tab */
  const tabsY = [];
  for (const seg of ['budget', 'pack', 'take', 'tobook', 'booked']) { await pg.evaluate(s => document.querySelector('#viewBook [data-prep="' + s + '"]').click(), seg); await pg.waitForTimeout(350);
    tabsY.push(await pg.evaluate(() => { const r = document.querySelector('#viewBook .prep-seg').getBoundingClientRect(), c = document.querySelector('#viewBook .cur-pick'); return Math.round(r.top + scrollY) + (c ? (c.getBoundingClientRect().top > r.bottom ? ' below' : ' ABOVE') : ''); })); }
  t.ok(new Set(tabsY.map(v => parseInt(v, 10))).size === 1 && tabsY[0].endsWith('below') && tabsY.slice(1).every(v => !/below|ABOVE/.test(v)), 'on a phone the tabs stay put from Budget to Pack, Take along, To book and Booked ("Prices in" sits below them, on Budget only): ' + tabsY.join(', '));
  await pg.evaluate(() => document.querySelector('#viewBook [data-prep="budget"]').click()); await pg.waitForTimeout(300);
  /* and in Settings */
  await pg.evaluate(() => W.goView('settings')); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(() => document.querySelector('#set-cur [data-curpick]').value === 'USD'), 'Settings has the same choice');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
