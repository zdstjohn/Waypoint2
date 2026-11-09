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
  /* errors on the phone go to the viewer's own private log (one document a day): the message, where, which screen and
     build, the browser; a repeat only counts up; a connection the viewer didn't allow is not an error */
  const el = await pg.evaluate(async () => {
    const boom = () => window.dispatchEvent(new ErrorEvent('error', { message: 'Test boom', filename: 'http://x/app.js', lineno: 1, colno: 99, error: new Error('Test boom') }));
    boom(); boom();
    window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: { code: 'not_granted' } }));
    W.flushErrors(); await new Promise(r => setTimeout(r, 600));
    const d = new Date(), day = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    const doc = JSON.parse(await window.__dbOp('get', 'data/users/u-test/errlog/' + day, null) || 'null');
    return doc && doc.items;
  });
  const it0 = el && el.find(x => x.msg === 'Test boom');
  t.ok(it0 && it0.n === 2 && it0.at === 'app.js:1:99' && it0.build && it0.view && el.length === 1 && !/http/.test(it0.stack), `errors go to the viewer's private log, repeats counted (${it0 && JSON.stringify({ n: it0.n, at: it0.at, view: it0.view, build: it0.build, ua: it0.ua })})`);
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
