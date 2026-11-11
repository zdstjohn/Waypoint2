/* The Back button (lib/back.js), as in the installed app: Back closes what is open on top of the screen (a stop's
   details, the trips menu), steps back from a screen reached by a link to the one you came from, and what you close
   yourself leaves nothing behind for Back to trip over. Tabs don't pile up. Inside Claude it is off. */
const { launch, open, exampleTrip, settle } = require('../lib/page');
exports.run = async t => {
  const b = await launch();
  const init = () => { window.__WP_BACK = true; };
  const { pg, ctx, errors } = await open(b, { width: 390, height: 844, init }); await exampleTrip(pg); await settle(pg, 4000);
  const st = () => pg.evaluate(() => ({ view: W.view(), hash: location.hash, sheet: !!document.querySelector('#sheethost .sheet'), menu: !!document.querySelector('.trip-menu'), len: history.length }));
  const back = async () => { await pg.evaluate(() => history.back()); await pg.waitForTimeout(350); };
  const day = () => pg.evaluate(() => { W.S.day = 2; W.S.tview = 'days'; W.S.glanceOpen = false; W.setView('trip'); W.render(); });
  await day(); await pg.waitForTimeout(300);
  const s0 = await st();

  /* a stop's details */
  await pg.evaluate(() => { const x = W.P.days[1].slots.find(x => x.item); W.openStop(x.key); }); await pg.waitForTimeout(200);
  const s1 = await st(); await back(); const s2 = await st();
  t.ok(s1.sheet && s1.len === s0.len + 1, 'opening a stop\'s details puts one entry in the history');
  t.ok(!s2.sheet && s2.view === 'trip' && s2.hash === s0.hash, 'Back closes the stop\'s details and stays on the day');

  /* closed by its own ×: nothing is left for Back to trip over */
  await pg.evaluate(() => { const x = W.P.days[1].slots.find(x => x.item); W.openStop(x.key); }); await pg.waitForTimeout(200);
  await pg.click('#sheethost .sh-top [data-sheetclose]'); await pg.waitForTimeout(350);
  await pg.evaluate(() => W.goView('kids')); await pg.waitForTimeout(700);
  const s3 = await st(); await back(); await pg.waitForTimeout(300); const s4 = await st();
  t.ok(s3.view === 'kids' && !s3.sheet, 'a link to another screen (the kids\' corner) goes there');
  t.ok(s4.view === 'trip' && s4.hash === '#trip', 'and one Back returns to the day: the details closed with × left no dead step behind (' + s4.view + ' ' + s4.hash + ')');

  /* the trips menu */
  await pg.click('[data-sync="menu"]'); await pg.waitForTimeout(250);
  const m1 = await st(); await back(); const m2 = await st();
  t.ok(m1.menu && !m2.menu && m2.view === 'trip', 'Back closes the trips menu');

  /* from the menu to Settings (the menu closes itself as you leave: its entry comes out before the screen's goes in) */
  await pg.click('[data-sync="menu"]'); await pg.waitForTimeout(250); await pg.click('.trip-menu [data-sync="settings"]'); await pg.waitForTimeout(900);
  const n1 = await st(); await back(); await pg.waitForTimeout(300); const n2 = await st();
  t.ok(n1.view === 'settings' && n1.hash === '#settings' && !n1.menu && n2.view === 'trip' && n2.hash === '#trip', 'Settings from the trips menu, then Back: the day again (' + [n1.view, n2.view, n2.hash].join(' ') + ')');

  /* tabs take the place of the screen; they don't pile up */
  const l0 = (await st()).len;
  await pg.click('#tabBook'); await pg.waitForTimeout(600); await pg.click('#tabTrip'); await pg.waitForTimeout(600); await pg.click('#tabBook'); await pg.waitForTimeout(600);
  const tb = await st();
  t.ok(tb.view === 'book' && tb.hash === '#prepare' && tb.len === l0, 'moving between tabs adds nothing to the history (' + tb.len + ' = ' + l0 + ')');
  await pg.click('#tabTrip'); await pg.waitForTimeout(600);

  /* a link from the page is a step; the tab of the screen you came from is that step back */
  await pg.evaluate(() => W.goView('settings')); await pg.waitForTimeout(700);
  const g1 = await st();
  await pg.click('#tabTrip'); await pg.waitForTimeout(700);
  const g2 = await st(); await pg.evaluate(() => W.goView('kids')); await pg.waitForTimeout(700); await back(); await pg.waitForTimeout(300); const g3 = await st();
  t.ok(g1.view === 'settings' && g2.view === 'trip' && g3.view === 'trip', 'going back by the tab, then on to another screen and Back: the day again, not Settings (' + g3.view + ')');

  /* Back with the details open over a screen reached by a link: first the details, then the screen */
  await pg.evaluate(() => W.goView('go')); await pg.waitForTimeout(900);
  const more = await pg.$('#viewGo [data-sheet]');
  if (more) {
    await more.click(); await pg.waitForTimeout(250); const a1 = await st(); await back(); const a2 = await st(); await back(); await pg.waitForTimeout(300); const a3 = await st();
    t.ok(a1.sheet && !a2.sheet && a2.view === 'go' && a3.view === 'trip', 'on Today, Back closes the details first, then returns to where you came from (' + [a2.view, a3.view].join(' → ') + ')');
  } else t.ok(true, '(no stop with details on Today to try the two-step Back on)');
  t.eq(errors(), [], 'no errors');
  await ctx.close();

  /* inside Claude: off. Nothing is added to the history; the address still follows the screen */
  const c = await open(b, { width: 390, height: 844 }); await exampleTrip(c.pg); await settle(c.pg, 3000);
  const off = await c.pg.evaluate(async () => { W.S.day = 2; W.S.tview = 'days'; W.setView('trip'); W.render(); const n0 = history.length; const x = W.P.days[1].slots.find(x => x.item); W.openStop(x.key); const n1 = history.length; W.closeStop(); W.goView('kids'); await new Promise(r => setTimeout(r, 700)); return { n0, n1, n2: history.length, hash: location.hash }; });
  t.ok(off.n1 === off.n0 && off.n2 === off.n0 && off.hash === '#kids', 'in Claude nothing is added to the history, and the address follows the screen (' + JSON.stringify(off) + ')');
  await c.ctx.close(); await b.close();
};
