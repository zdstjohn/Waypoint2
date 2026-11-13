/* Every screen draws (one view, with content, no page error) and nothing is clipped, cut off, off screen or overlapping on it, at normal, large and very large text, in dark mode and on
   a 412 px phone. The checks run in the page (see lib/check.js); known-good overlays are excluded there. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const SCREENS = require('../lib/screens'); const CHECK = require('../lib/check'); const DRAWN = require('../lib/drawn');
exports.run = async t => {
  const b = await launch();
  for (const [tag, scale, dark, width] of [['n', 1, false, 360], ['big', 1.3, false, 360], ['huge', 1.6, false, 360], ['dark-big', 1.3, true, 360], ['wide-big', 1.3, false, 412]]) {
    const { pg, ctx, errors } = await open(b, { width, dark }); await exampleTrip(pg);
    t.ok((await pg.evaluate(() => W.P.days.length)) === 10 && (await pg.evaluate(() => document.querySelectorAll('#viewTrip .slot[data-slotkey]').length)) >= 5, `@${tag}: the example trip has its 10 days and the day its stops`);
    if (scale !== 1) await pg.addStyleTag({ content: `html{font-size:${scale * 100}% !important}` });
    for (const sc of SCREENS) {
      await pg.keyboard.press('Escape').catch(() => {});
      await pg.evaluate(sc.go); await pg.waitForTimeout(sc.wait || 700); await settle(pg);
      const dr = await DRAWN(pg);
      if (!t.ok(dr.views.length === 1 && dr.txt > 200, `${sc.id} @${tag}: one view showing, with content (${dr.views.join(',')}, ${dr.txt} characters)`)) await t.shot(pg, `drawn-${tag}-${sc.id}`);
      const found = await pg.evaluate(CHECK);
      if (!t.ok(found.length === 0, `${sc.id} @${tag}: ${found.length ? found.map(f => f.kind + ' ' + f.el + ' ' + (f.extra || '')).join('; ') : 'clean'}`)) await t.shot(pg, `layout-${tag}-${sc.id}`);
    }
    t.ok(await pg.evaluate(() => !!document.querySelector('.tabs') && getComputedStyle(document.querySelector('.tabs')).display !== 'none'), `@${tag}: the tabs are showing`);
    t.eq(errors(), [], `@${tag}: no page errors`);
    await ctx.close();
  }
  await b.close();
};
