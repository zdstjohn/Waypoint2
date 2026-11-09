/* Bookings: the checklist has what to book and by when, ticking an item, the budget adds up, a booking added by hand lands
   on its day and in the budget. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg);
  await pg.click('#tabBook'); await pg.waitForTimeout(1200); await settle(pg);
  const chk = await pg.evaluate(() => ({ items: document.querySelectorAll('.chk').length, by: document.querySelectorAll('.chk .by').length, stays: [...document.querySelectorAll('.chk')].filter(c => /stay|hotel|place to stay/i.test(c.innerText)).length }));
  t.ok(chk.items >= 5, 'the checklist has things to book: ' + JSON.stringify(chk));
  t.ok(chk.by >= 3, 'with "book by" dates');
  const key = await pg.evaluate(() => document.querySelector('[data-tick]').dataset.tick);
  await pg.click('[data-tick]'); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(k => !!(W.S.booked || {})[k] && W.checklist(W.P).find(c => c.key === k).done, key), 'ticking an item marks it booked');
  await pg.evaluate(k => { const b = document.querySelector(`[data-tick="${k}"]`); if (b) b.click(); else { W.S.booked[k] = 0; W.changed(); } }, key); await pg.waitForTimeout(300);
  t.ok(await pg.evaluate(k => !(W.S.booked || {})[k], key), 'and ticking again un-books it');
  /* Prepare is split into segments: Budget, then Booked for the hand-added confirmation */
  await pg.evaluate(() => { W.S.prepTab = 'budget'; W.render(); });
  const bud = await pg.evaluate(() => { const rows = [...document.querySelectorAll('table.budget tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ')); const tot = (document.querySelector('table.budget tfoot') || {}).innerText || ''; return { rows, tot }; });
  t.ok(bud.rows.length >= 3 && /€|\$|£/.test(bud.tot), 'the budget has rows and a total: ' + JSON.stringify(bud).slice(0, 160));
  /* add a booking by hand */
  await pg.evaluate(() => { W.S.prepTab = 'booked'; W.render(); const d = document.querySelector('details.addbk'); if (d) d.open = true; });
  await pg.selectOption('#bkKind', 'lodging'); await pg.fill('#bkTitle', 'Hotel Test Roma'); await pg.fill('#bkDate', '2027-06-08'); await pg.fill('#bkPrice', '420'); await pg.fill('#bkCur', 'EUR');
  await pg.click('[data-addbk]'); await pg.waitForTimeout(900);
  const added = await pg.evaluate(() => { const r = { n: (W.S.bookings || []).length, hand: (W.S.bookings || []).filter(x => x.src === 'hand').map(x => [x.title, x.place, x.price, x.cur]), listed: /Hotel Test Roma/.test(document.body.innerText) }; W.S.prepTab = 'budget'; W.render(); r.booked = (document.querySelector('table.budget tbody') || {}).innerText || ''; return r; });
  t.eq(added.hand, [['Hotel Test Roma', 'Rome', 420, 'EUR']], 'a hotel added by hand lands on its day\'s city with its price');
  t.ok(/420/.test(added.booked), 'and shows under Booked in the budget');
  t.ok(added.listed, 'and is listed under Booked');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
