/* Deterministic screenshots of every screen: node test/shots.js <dir> (SHOT_SIZES=n,big,dark,wide,desk for some sizes only). Two runs on the same code give the same pixels, so
   a before/after diff shows exactly what a change to the code moved. */
const { launch, open, exampleTrip, settle, ROOT } = require('./lib/page'); const fs = require('fs'); const path = require('path');
const SCREENS = require('./lib/screens');
(async () => {
  const dir = path.resolve(process.argv[2] || 'test/shots-out'); fs.mkdirSync(dir, { recursive: true });
  const b = await launch();
  /* SHOT_SIZES=n,big takes only those sizes (GitHub photographs each size in its own run, side by side) */
  const SIZES = [['n', 1, false, 360], ['big', 1.3, false, 360], ['dark', 1, true, 360], ['wide', 1, false, 900], ['desk', 1, false, 1440]];
  const only = (process.env.SHOT_SIZES || '').split(',').map(x => x.trim()).filter(Boolean);
  const sizes = only.length ? SIZES.filter(x => only.includes(x[0])) : SIZES;
  if (only.length && sizes.length !== only.length) { console.error('unknown size in SHOT_SIZES=' + only.join(',') + ' (sizes: ' + SIZES.map(x => x[0]).join(', ') + ')'); process.exit(2); }
  for (const [tag, scale, dark, width] of sizes) {
    const { pg, ctx } = await open(b, { width, dark, scale: 1, touch: width < 1000 ? undefined : false }); await exampleTrip(pg);
    /* the planner keeps the picks it made first, and what it knew then depends on which answers had come in: plan again
       once every answer is in (however long that takes: a wide screen asks for more), and then ask for no more ideas,
       so the pictures depend only on the code and the data, never on timing */
    await settle(pg, 30000); await pg.evaluate(() => { W.resetPicks(); W.replan(); W.render(); }); await settle(pg, 30000);
    await pg.evaluate(() => { ['loadCity', 'loadStyleIdeas', 'loadFame', 'loadGems', 'loadBreakfast', 'loadIndoor'].forEach(k => { if (typeof W[k] === 'function') W[k] = function () {}; }); });
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
