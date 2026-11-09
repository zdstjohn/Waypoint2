/* Saved trips: the trips menu, renaming, a second trip and switching back. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg);
  await pg.click('[data-sync="menu"]'); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(() => !!document.querySelector('.trip-menu')), 'the trips menu opens');
  const mm = await pg.evaluate(() => { const m = document.querySelector('.trip-menu'); m.scrollTop = m.scrollHeight; const bg = getComputedStyle(m).backgroundColor, a = (bg.match(/rgba?\(([^)]+)\)/) || ['', '0,0,0,0'])[1].split(',').map(Number); const r = { scrolls: m.scrollHeight > m.clientHeight, opaque: a.length === 3 || a[3] === 1, bg }; m.scrollTop = 0; return r; });
  t.ok(mm.opaque, `the trips menu has a solid background all the way down when scrolled, so the page never shows through (${mm.bg}, scrolls: ${mm.scrolls})`);
  await pg.click('[data-sync="rename"]'); await pg.fill('#tripNameIn', 'Italy with the kids'); await pg.click('[data-sync="savename"]'); await pg.waitForTimeout(600);
  t.eq(await pg.evaluate(() => W.tripName()), 'Italy with the kids', 'renaming the trip');
  await pg.evaluate(() => { const m = document.querySelector('.trip-menu'); if (!m) document.querySelector('[data-sync="menu"]').click(); }); await pg.waitForTimeout(300);
  await pg.click('[data-sync="new"]'); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(() => !!document.querySelector('.qs')), 'a new trip opens quick start');
  await pg.click('[data-qs="slow"]'); await pg.waitForTimeout(800);
  t.ok(await pg.evaluate(() => W.view() === 'setup' && W.tripName() !== 'Italy with the kids'), 'skipping quick start lands on Setup for the new trip');
  await pg.click('[data-sync="menu"]'); await pg.waitForTimeout(400);
  const names = await pg.evaluate(() => [...document.querySelectorAll('.trips li')].map(l => l.innerText.replace(/\s+/g, ' ').trim()));
  t.ok(names.length >= 2 && names.some(n => /Italy with the kids/.test(n)), 'both trips are listed: ' + JSON.stringify(names));
  await pg.click('.trips li [data-sync="open"]:has-text("Italy with the kids")'); await pg.waitForTimeout(1500); await settle(pg);
  t.ok(await pg.evaluate(() => W.tripName() === 'Italy with the kids' && W.P.days.length === 10), 'opening the first trip brings its 10 days back');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
