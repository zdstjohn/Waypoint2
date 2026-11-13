/* v173: light or dark chosen in the app (lib/core.js W.setTheme: this phone only, over the phone's setting and over the
   page around the app), a tick box's mark in its middle on a touch screen, and a travel day's card: the state as a
   short tag with what the times are on a line under it, the dashed way through the middle of the mode's icon. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch();
  /* ---- light or dark ---- */
  const db = mkdb();
  const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db });
  await exampleTrip(pg); await settle(pg, 3000);
  const look = () => pg.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor,
    saved: (() => { try { return localStorage.getItem('waypoint-theme'); } catch (e) { return 'x'; } })(),
    pressed: [...document.querySelectorAll('[data-theme-set][aria-pressed="true"]')].map(x => x.getAttribute('data-theme-set')) }));
  await pg.evaluate(() => W.goView('settings')); await settle(pg, 2500);
  const opts = await pg.evaluate(() => [...document.querySelectorAll('#set-theme [data-theme-set]')].map(x => x.textContent.trim()));
  t.eq(opts, ['Auto', 'Light', 'Dark'], 'Settings offers light or dark: auto (the phone\'s own setting), light, dark');
  const before = await look();
  t.ok(!before.attr && before.pressed.join() === '', 'at first it matches the phone (light here): ' + JSON.stringify(before));
  await pg.click('#set-theme [data-theme-set="dark"]'); await pg.waitForTimeout(400);
  const dark = await look();
  t.ok(dark.attr === 'dark' && dark.saved === 'dark' && dark.pressed.join() === 'dark' && dark.bg !== before.bg, 'a tap on Dark turns the app dark and keeps the choice: ' + JSON.stringify(dark));
  /* the page around the app sets its own theme: the person's choice stays on top */
  await pg.evaluate(() => document.documentElement.setAttribute('data-theme', 'light')); await pg.waitForTimeout(300);
  t.eq((await look()).attr, 'dark', 'the page around the app saying "light" does not undo the choice');
  await pg.reload(); await pg.waitForFunction(() => window.W && W.P, null, { timeout: 20000 }); await settle(pg, 2000);
  t.eq((await look()).attr, 'dark', 'after a reload it is still dark');
  /* the trip menu has the same choice */
  await pg.evaluate(() => W.goView('trip')); await settle(pg, 1500);
  await pg.click('[data-sync="menu"]'); await pg.waitForTimeout(400);
  t.ok(await pg.evaluate(() => !!document.querySelector('.trip-menu [data-theme-set="light"]')), 'the trip menu has the light or dark choice');
  await pg.click('.trip-menu [data-theme-set="light"]'); await pg.waitForTimeout(400);
  t.eq((await look()).attr, 'light', 'Light from the trip menu');
  await pg.evaluate(() => W.setTheme('')); await pg.waitForTimeout(300);
  const back = await look();
  t.ok(back.saved === null && !back.attr && back.bg === before.bg && back.pressed.every(v => v === ''), 'Auto forgets the choice and follows the phone again (light here), and every switch shows it: ' + JSON.stringify(back));
  await pg.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await pg.waitForTimeout(300);
  t.eq((await look()).attr, 'dark', 'matching: the page around the app turning dark is followed');
  await pg.evaluate(() => W.setTheme('light')); await pg.waitForTimeout(300);

  /* ---- a tick box's mark sits in its middle (on a touch screen its wider tap area must not move it) ---- */
  await pg.evaluate(() => { W.S.prepTab = 'tobook'; W.goView('book'); }); await settle(pg, 2000);
  await pg.waitForSelector('[data-tick]', { timeout: 15000 }).catch(() => {});
  await pg.keyboard.press('Escape'); /* (the trip menu, still open from above) */
  const box = await pg.evaluate(() => { const b = document.querySelector('[data-tick]'); if (b) b.click(); return !!b; });
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { W.S.prepTab = 'booked'; W.goView('book'); }); await settle(pg, 1500); /* (a ticked row moves to Booked) */
  await pg.evaluate(() => { const g = document.querySelector('[data-chkgroup="u-done"][aria-expanded="false"]'); if (g) g.click(); }); await pg.waitForTimeout(600);
  const mark = await pg.evaluate(() => {
    const b = document.querySelector('.chk .box[aria-pressed="true"]'); if (!b) return null;
    const a = getComputedStyle(b, '::after'), bf = getComputedStyle(b, '::before');
    return { coarse: matchMedia('(pointer:coarse)').matches, pos: a.position, w: a.width, tap: bf.width, tapPos: bf.position };
  });
  t.ok(box && mark, 'a tick box was ticked: ' + JSON.stringify(mark));
  t.ok(mark && mark.pos !== 'absolute' && mark.w === '11px', 'the tick is drawn in the box\'s middle (laid out by the box, not placed at its centre point): ' + JSON.stringify(mark));
  t.ok(mark && (!mark.coarse || (mark.tap === '44px' && mark.tapPos === 'absolute')), 'on a touch screen the 44 px tap area is the other layer');

  /* ---- a travel day's card ---- */
  const leg = await pg.evaluate(() => {
    const n = W.P.days.findIndex(d => d.stop && W.legFor(W.P, d.stop)); if (n < 0) return null;
    W.S.day = n + 1; W.S.tview = 'days'; W.goView('trip'); return n + 1; });
  await settle(pg, 2500);
  const card = await pg.evaluate(() => {
    const st = document.querySelector('#viewTrip .tk-band .tk-st'), sub = document.querySelector('#viewTrip .tk-band .tk-sub'),
      mid = document.querySelector('#viewTrip .tk-band .tk-mid'), ic = mid && mid.querySelector('svg');
    if (!st || !mid || !ic) return null;
    const m = mid.getBoundingClientRect(), i = ic.getBoundingClientRect(), line = m.top + parseFloat(getComputedStyle(mid, '::before').top), lh = parseFloat(getComputedStyle(st).lineHeight);
    return { st: st.textContent, sub: sub && sub.textContent, oneLine: st.getBoundingClientRect().height < lh * 2, lineInIcon: line > i.top + 4 && line < i.bottom - 4, radius: getComputedStyle(st).borderTopLeftRadius };
  });
  t.ok(leg && card, 'a travel day shows its ticket card (day ' + leg + ')');
  t.ok(card && (card.st === 'Not booked yet' || /^Booked/.test(card.st)) && (card.st !== 'Not booked yet' || card.sub === 'Planned times, door to door'), 'the state is a short tag, what the times are on a line of its own: ' + JSON.stringify(card));
  t.ok(card && card.oneLine, 'the tag fits on one line');
  t.ok(card && card.lineInIcon, 'the dashed way runs through the middle of the mode\'s icon');
  t.ok(card && card.radius !== '9999px' && parseFloat(card.radius) < 20, 'the tag\'s corners are half a line high, so a wrapped tag is not a lozenge: ' + (card && card.radius));
  /* at a large text size the tag still reads as one tidy block */
  await pg.evaluate(() => { document.documentElement.style.fontSize = '150%'; W.render(); }); await settle(pg, 1500);
  const big = await pg.evaluate(() => { const st = document.querySelector('#viewTrip .tk-band .tk-st'), r = st && st.getBoundingClientRect(), band = document.querySelector('#viewTrip .tk-band').getBoundingClientRect();
    return st ? { inside: r.left >= band.left && r.right <= band.right + 0.5, h: Math.round(r.height) } : null; });
  t.ok(big && big.inside, 'at 150% text the tag stays inside the card: ' + JSON.stringify(big));
  await pg.evaluate(() => { document.documentElement.style.fontSize = ''; });
  t.eq(errors(), [], 'no page errors');
  await ctx.close();
  await b.close();
};
