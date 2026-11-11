/* Deterministic screenshots of every screen: node test/shots.js <dir> (SHOT_SIZES=n,big,dark,wide,desk for some sizes only). Two runs on the same code give the same pixels, so
   a before/after diff shows exactly what a change to the code moved. */
const { launch, open, exampleTrip, settle, ROOT } = require('./lib/page'); const fs = require('fs'); const path = require('path');
const SCREENS = require('./lib/screens');
/* nothing loading, and no request out, started or answered for quiet ms (test/mocks/mock2.js keeps the count): a list
   that tops itself up asks again a moment after an answer comes in, which a look at the spinners alone can miss */
async function quietly(pg, quiet = 3000, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const ok = await pg.evaluate(q => { const a = window.__asks; return !(W.status && Object.values(W.status).some(v => v === 'loading')) && (!a || (a.out === 0 && Date.now() - a.at >= q)); }, quiet);
    if (ok) return; await pg.waitForTimeout(250);
  }
}
/* every idea's details (hours, visit length, still open?), not only those of places some earlier plan happened to
   pick: the planner uses them, so which places had them followed each run's history */
async function allDetails(pg) {
  for (let k = 0; k < 12; k++) {
    const left = await pg.evaluate(() => Object.values(W.C.city).reduce((n, c) => n + (c.spots || []).concat(c.food || []).filter(x => x.st === undefined).length, 0));
    if (!left) return;
    await pg.evaluate(() => Object.keys(W.C.city).forEach(ck => { const c = W.C.city[ck], [country, city] = ck.split('|'); W.loadBookLinks(country, city, (c.spots || []).concat(c.food || []).map(x => x.n)); }));
    await settle(pg, 15000); await quietly(pg, 1000, 30000);
  }
}
(async () => {
  const dir = path.resolve(process.argv[2] || 'test/shots-out'); fs.mkdirSync(dir, { recursive: true });
  const b = await launch();
  /* SHOT_SIZES=n,big takes only those sizes (GitHub photographs each size in its own run, side by side) */
  const SIZES = [['n', 1, false, 360], ['big', 1.3, false, 360], ['dark', 1, true, 360], ['wide', 1, false, 900], ['desk', 1, false, 1440]];
  const only = (process.env.SHOT_SIZES || '').split(',').map(x => x.trim()).filter(Boolean);
  const sizes = only.length ? SIZES.filter(x => only.includes(x[0])) : SIZES;
  if (only.length && sizes.length !== only.length) { console.error('unknown size in SHOT_SIZES=' + only.join(',') + ' (sizes: ' + SIZES.map(x => x[0]).join(', ') + ')'); process.exit(2); }
  for (const [tag, scale, dark, width] of sizes) {
    const { pg, ctx } = await open(b, { width, dark, scale: 1, mocks: ['test/mocks/mockdur.js', 'test/mocks/mock2.js', 'test/mocks/steady.js'], touch: width < 1000 ? undefined : false }); await exampleTrip(pg);
    /* the planner keeps the picks it made first, and what it knew then depends on which answers had come in: plan again
       once every answer is in (however long that takes: a wide screen asks for more), and ask for no more ideas. Then
       plan afresh until the plan stops changing: each plan asks for its places' details (hours, how long a visit takes),
       which can move it once they're in, so the last plan is made knowing them, and the pictures depend only on the code
       and the data, never on timing */
    await settle(pg, 30000); await pg.evaluate(() => { W.resetPicks(); W.replan(); W.render(); }); await settle(pg, 30000); await quietly(pg);
    await pg.evaluate(() => { ['loadCity', 'loadFame', 'loadIndoor'].forEach(k => { if (typeof W[k] === 'function') W[k] = function () {}; }); });
    await allDetails(pg);
    for (let k = 0, last = ''; k < 5; k++) {
      await pg.evaluate(() => { W.resetPicks(); W.replan(); W.render(); }); await settle(pg, 10000); await quietly(pg, 2000, 30000);
      const now = await pg.evaluate(() => JSON.stringify(W.P.days.map(d => d.slots.map(x => x.item ? x.item.n : ''))));
      if (now === last) break; last = now;
    }
    if (scale !== 1) await pg.addStyleTag({ content: `html{font-size:${scale * 100}% !important}` });
    /* the greeting and the clock in the banner never match from one run to the next: a rule hides them, so a redraw just
       before a picture can't bring them back */
    await pg.addStyleTag({ content: '#topline .tl-hi, #topline .tl-sky, #topline .tl-dot { visibility: hidden !important }' });
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
