/* Every screen renders without a page error, on a phone, in dark mode and on a wide screen; the tabs are there; the day list is full. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const SCREENS = require('../lib/screens');
exports.run = async t => {
  const b = await launch();
  for (const [tag, dark, width] of [['phone', false, 360], ['dark', true, 360], ['wide', false, 1100]]) {
    const { pg, ctx, errors } = await open(b, { width, dark }); await exampleTrip(pg);
    t.ok((await pg.evaluate(() => W.P.days.length)) === 10, `${tag}: the example trip has 10 days`);
    t.ok((await pg.evaluate(() => document.querySelectorAll('#viewTrip .slot[data-slotkey]').length)) >= 5, `${tag}: the day list has its slots`);
    for (const sc of SCREENS) {
      await pg.keyboard.press('Escape').catch(() => {});
      await pg.evaluate(sc.go); await pg.waitForTimeout(sc.wait || 700); await settle(pg);
      const vis = await pg.evaluate(() => [...document.querySelectorAll('main')].filter(m => !m.hidden).map(m => m.id));
      if (!t.ok(vis.length === 1, `${tag}/${sc.id}: exactly one view is showing (${vis.join(',')})`)) await t.shot(pg, `smoke-${tag}-${sc.id}`);
      /* textContent, not innerText: the storybook's pages use content-visibility:auto, and a background tab's skipped
         pages have no innerText until the browser next paints them */
      const txt = await pg.evaluate(() => [...document.querySelectorAll('main:not([hidden])')].map(m => m.textContent.replace(/\s+/g, ' ').trim().length).reduce((a, b) => a + b, 0));
      t.ok(txt > 200, `${tag}/${sc.id}: the screen has content`);
    }
    t.ok(await pg.evaluate(() => !!document.querySelector('.tabs') && getComputedStyle(document.querySelector('.tabs')).display !== 'none'), `${tag}: the tabs are showing`);
    t.eq(errors(), [], `${tag}: no page errors`);
    await ctx.close();
  }
  await b.close();
};
