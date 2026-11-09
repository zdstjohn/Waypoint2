/* Deterministic screenshots of every screen: node test/shots.js <dir>. Two runs on the same code give the same pixels, so
   a before/after diff shows exactly what a change to the code moved. */
const { launch, open, exampleTrip, settle, ROOT } = require('./lib/page'); const fs = require('fs'); const path = require('path');
const SCREENS = require('./lib/screens');
(async () => {
  const dir = path.resolve(process.argv[2] || 'test/shots-out'); fs.mkdirSync(dir, { recursive: true });
  const b = await launch();
  for (const [tag, scale, dark, width] of [['n', 1, false, 360], ['big', 1.3, false, 360], ['dark', 1, true, 360], ['wide', 1, false, 900], ['desk', 1, false, 1440]]) {
    const { pg, ctx } = await open(b, { width, dark, scale: 1, touch: width < 1000 ? undefined : false }); await exampleTrip(pg);
    if (scale !== 1) await pg.addStyleTag({ content: `html{font-size:${scale * 100}% !important}` });
    for (const sc of SCREENS) {
      await pg.keyboard.press('Escape').catch(() => {});
      await pg.evaluate(sc.go); await pg.waitForTimeout(sc.wait || 900); await settle(pg);
      await pg.evaluate(() => { document.querySelectorAll('.loading, .tl-sky, .tl-hi').forEach(e => e.style.visibility = 'hidden'); });   // spinners and the clock never match
      for (const y of [0, 700]) {
        const h = await pg.evaluate(y => { scrollTo(0, y); return document.documentElement.scrollHeight; }, y); if (y && h < y + 400) break;
        await pg.waitForTimeout(120); await pg.screenshot({ path: path.join(dir, `${sc.id}-${tag}-${y}.png`) });
      }
      await pg.evaluate(() => scrollTo(0, 0));
    }
    await ctx.close();
  }
  await b.close(); console.log('shots in', dir, fs.readdirSync(dir).length);
})();
