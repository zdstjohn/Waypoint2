/* Accessibility: axe-core (WCAG 2.0/2.1 A and AA) over every screen, in light and dark, on a phone: contrast, names on
   controls, roles and states, landmarks, headings, form labels. The app must have no violations; the per-screen list of
   what axe looked at is printed so a screen that renders empty cannot pass by accident. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const fs = require('fs'); const path = require('path');
const AXE = path.join(__dirname, '..', '..', 'build', 'node_modules', 'axe-core', 'axe.min.js');
/* every screen and state a traveler can reach, and how to get there */
const SCREENS = [
  ['Plan', () => { W.S.stepClosed = { style: false, who: false, long: false, where: false }; W.setView('setup'); W.render(); }],
  ['Trip · day', () => { W.S.tview = 'days'; W.S.day = 2; W.setView('trip'); W.render(); }],
  ['Trip · stop sheet', () => { const x = W.P.days[1].slots.find(s => s.item && !W.isFood(s.slot)); W.openStop(x.key); }],
  ['Trip · map', () => { W.closeStop && W.closeStop(); W.S.tview = 'map'; W.render(); }],
  ['Trip menu', () => { W.S.tview = 'days'; W.render(); document.querySelector('[data-sync="menu"]').click(); }],
  ['Prepare · To book', () => { W.closeTripMenu && W.closeTripMenu(); W.S.prepTab = 'tobook'; W.setView('book'); W.render(); }],
  ['Prepare · Booked', () => { W.S.prepTab = 'booked'; W.render(); }],
  ['Prepare · Budget', () => { W.S.prepTab = 'budget'; W.render(); }],
  ['Prepare · Pack', () => { W.S.prepTab = 'pack'; W.render(); }],
  ['Prepare · Take along', () => { W.S.prepTab = 'take'; W.render(); }],
  ['Today', () => { W.setView('go'); W.render(); }],
  ['For the kids', () => { W.setView('kids'); W.render(); }],
  ['Recap', () => { W.S.tview = 'days'; W.setView('recap'); W.render(); }],
  ['Import', () => { W.setView('settings'); W.render(); }],
];
exports.run = async t => {
  const axeSrc = fs.readFileSync(AXE, 'utf8');
  const b = await launch();
  const seen = {};
  for (const dark of [false, true]) {
    const { pg, ctx, errors } = await open(b, { width: 390, height: 844, dark }); await exampleTrip(pg);
    await pg.evaluate(() => { localStorage.setItem('waypoint-now', '2027-06-09T10:30'); W.S.names = ['Zach', 'Anna', 'Mila', 'Leo']; W.S.journal = { 2: { mood: 3, note: 'Gelato twice.' } }; W.render(); });
    await pg.addScriptTag({ content: axeSrc });
    for (const [name, go] of SCREENS) {
      await pg.evaluate(go); await pg.waitForTimeout(350); await settle(pg, 2500);
      const r = await pg.evaluate(async () => {
        const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations', 'passes'] });
        return { v: res.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map(n => ({ html: n.html.slice(0, 160), msg: (n.any[0] || n.all[0] || {}).message || '' })) })),
          checked: res.passes.reduce((a, p) => a + p.nodes.length, 0), els: document.querySelectorAll('main:not([hidden]) *').length };
      });
      const key = name + (dark ? ' (dark)' : '');
      seen[key] = r;
      t.ok(r.els > (name === 'Import' ? 8 : 20), `${key}: the screen rendered (${r.els} elements, ${r.checked} checks passed)`);
      t.eq(r.v, [], `${key}: no accessibility violations` + (r.v.length ? '\n      ' + r.v.map(v => `${v.impact} ${v.id}: ${v.help}\n        ` + v.nodes.map(n => n.html + (n.msg ? ' — ' + n.msg : '')).join('\n        ')).join('\n      ') : ''));
    }
    t.eq(errors(), [], (dark ? 'dark' : 'light') + ': no page errors');
    await ctx.close();
  }
  await b.close();
};
