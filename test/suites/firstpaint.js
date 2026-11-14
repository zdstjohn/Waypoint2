/* The first paint, before the second stylesheet has come. build/bundle.js splitCss moves the rules only the second script's
   screens use into app2.css. `same` looks only once everything has loaded, so it cannot see a rule that moved but is
   still needed on the first screen: that would show as a flash of unstyled screen. Here each first screen is opened with
   the second script, its stylesheet, the ask pieces and the desktop files held back (as the page is until they come), and
   every element's box and styles (the PROPS of `same`, as a hash) are read twice in the same instant: as built
   (app.min.css alone), and with app2.css added, which is the sheet in one piece. They must be equal. (One page, one
   moment: a screen's own late changes, a "Finding more..." line turning into its button, cannot tell the two apart.) */
const fs = require('fs'), path = require('path');
const { launch, open, exampleTrip, ROOT } = require('../lib/page'); const mkdb = require('../lib/db');
const { PROPS, CLOCK } = require('./same');
const SCREENS = [['#trip', 'days', '#viewTrip .slot'], ['#explore', 'map', '.psearch'], ['#trip', 'map', '#viewTrip .psearch'], ['#prepare', 'days', '#viewBook .bk-card'],
  ['#today', 'days', '#viewGo .go'], ['#plan', 'days', '#viewSetup .sk'], ['#kids', 'days', '#viewKids *'], ['#settings', 'days', '#viewSettings *'], ['#recap', 'days', '#viewRecap *']];
const SIZES = [[390, 844, false], [390, 844, true], [820, 1100, false]];
const PORT = process.env.WP_PORT || 8771;
/* every element's box and styles, as one line each; with `more` (the second stylesheet's text) added to the page first for the second reading */
const read = (pg, more) => pg.evaluate(([PROPS, more]) => {
  if (more) { const st = document.createElement('style'); st.textContent = more; document.head.appendChild(st); }
  return Array.from(document.querySelectorAll('body *')).map(el => {
    const cs = getComputedStyle(el); let s = ''; for (const p of PROPS) s += p + ':' + cs.getPropertyValue(p) + ';';
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    const r = el.getBoundingClientRect(); return (el.tagName + '.' + (el.getAttribute('class') || '')).slice(0, 60) + '|' + Math.round(r.width) + 'x' + Math.round(r.height) + '|' + h;
  });
}, [PROPS, more || '']);
exports.run = async t => {
  const css2 = fs.readFileSync(path.join(ROOT, 'trip', 'app2.css'), 'utf8');
  t.ok(css2.length > 1000, 'app2.css carries rules (the split is on)');
  const b = await launch();
  for (const [w, h, dark] of SIZES) {
    const { pg, ctx } = await open(b, { width: w, height: h, dark, db: mkdb(), init: CLOCK, mocks: ['test/mocks/mockdur.js', 'test/mocks/mock2.js', 'test/mocks/steady.js'] }); await exampleTrip(pg);
    await pg.route(/\/(app2\.js|app2\.css|app\.ask\.js|app\.desk\.js|app\.desk\.css)(\?.*)?$/, r => r.abort());
    for (const [hash, tv, sel] of SCREENS) {
      await pg.evaluate(tv => { W.S.tview = tv; W.save(); }, tv);
      await pg.goto('about:blank'); await pg.goto('http://127.0.0.1:' + PORT + '/index.html' + hash);
      await pg.waitForSelector(sel, { timeout: 15000 }).catch(() => { }); await pg.waitForTimeout(1200);
      const a = await read(pg), c = await read(pg, css2), at = a.findIndex((x, i) => x !== c[i]);
      t.ok(a.length > 20 && a.length === c.length && at < 0, `first paint of ${hash}${tv === 'map' ? ' (Explore)' : ''} at ${w}px${dark ? ' dark' : ''} is the same with the stylesheet split as whole` + (at >= 0 ? `: first difference ${at} ${a[at]} v ${c[at]}` : ''));
    }
    await ctx.close();
  }
  await b.close();
};
