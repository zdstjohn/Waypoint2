/* Every screen as the first one the app opens on: the app remembers where you were (Explore, Prepare…), so each one has
   to draw on the very first render, before the second script has arrived, with nothing failing to start. */
const { launch, open, exampleTrip } = require('../lib/page'); const mkdb = require('../lib/db');
const SCREENS = [['#trip', 'days', '#viewTrip .slot'], ['#explore', 'map', '.psearch'], ['#trip', 'map', '#viewTrip .psearch'], ['#prepare', 'days', '#viewBook .bk-card'],
  ['#today', 'days', '#viewGo .go'], ['#plan', 'days', '#viewSetup .sk'], ['#kids', 'days', '#viewKids *'], ['#settings', 'days', '#viewSettings *'], ['#recap', 'days', '#viewRecap *']];
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg);
  for (const [hash, tview, sel] of SCREENS) {
    await pg.evaluate(tv => { W.S.tview = tv; W.save(); }, tview);
    await pg.goto('http://127.0.0.1:' + (process.env.WP_PORT || 8771) + '/index.html' + hash); await pg.waitForTimeout(1800);
    const r = await pg.evaluate(s => ({ boot: window.__wpBoot || [], drawn: !!document.querySelector(s), later: !!(window.W && W.laterReady), view: window.W && W.view && W.view() }), sel);
    const errs = errors().splice(0);
    t.ok(!r.boot.length && !errs.length && r.drawn, `opening on ${hash}${tview === 'map' ? ' (Explore)' : ''} draws it with nothing failing: ` + JSON.stringify({ view: r.view, drawn: r.drawn, boot: r.boot, errs: errs.slice(0, 2) }));
  }
  await ctx.close(); await b.close();
};
