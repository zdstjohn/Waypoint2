/* Nothing clipped, cut off, off screen or overlapping on any screen, at normal, large and very large text, in dark mode and on
   a 412 px phone. The checks run in the page (see lib/check.js); known-good overlays are excluded there. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const SCREENS = require('../lib/screens'); const CHECK = require('../lib/check');
exports.run = async t => {
  const b = await launch();
  for (const [tag, scale, dark, width] of [['n', 1, false, 360], ['big', 1.3, false, 360], ['huge', 1.6, false, 360], ['dark-big', 1.3, true, 360], ['wide-big', 1.3, false, 412]]) {
    const { pg, ctx } = await open(b, { width, dark }); await exampleTrip(pg);
    if (scale !== 1) await pg.addStyleTag({ content: `html{font-size:${scale * 100}% !important}` });
    for (const sc of SCREENS) {
      await pg.keyboard.press('Escape').catch(() => {});
      await pg.evaluate(sc.go); await pg.waitForTimeout(sc.wait || 700); await settle(pg);
      const found = await pg.evaluate(CHECK);
      if (!t.ok(found.length === 0, `${sc.id} @${tag}: ${found.length ? found.map(f => f.kind + ' ' + f.el + ' ' + (f.extra || '')).join('; ') : 'clean'}`)) await t.shot(pg, `layout-${tag}-${sc.id}`);
    }
    await ctx.close();
  }
  await b.close();
};
