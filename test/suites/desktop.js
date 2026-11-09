/* The app on a computer: a mouse instead of a finger, from a narrow side panel (600 px, the phone layout) to a big
   monitor (1920 px), with a seven-place trip so the bars have more to hold than fits. Every screen passes the same
   clipping and overlap checks as on a phone (lib/check.js), the page never scrolls sideways, and the parts that a
   phone lets you swipe (the stays, the Prepare tabs, the day pills) can all be reached without swiping:
     - every stay in the stay bar is fully visible (they shrink, then wrap to a second row, rather than hide past the edge)
     - every Prepare tab is fully visible
     - the previous/next day arrows are there at every width
     - the trip menu opens under the trip's name (right side of the banner), inside the window
     - the kids' corner stays picture-book sized and centred on a big screen */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const SCREENS = require('../lib/screens'); const CHECK = require('../lib/check');
const inside = (a, b, m = 1) => a.left >= b.left - m && a.right <= b.right + m && a.top >= b.top - m && a.bottom <= b.bottom + m;
exports.run = async t => {
  const b = await launch();
  for (const width of [600, 1024, 1440, 1920]) {
    const { pg, ctx, errors } = await open(b, { width, height: 900, touch: false }); await exampleTrip(pg);
    await pg.evaluate(() => {
      W.S.countries = [{ name: 'Greece', mode: 'manual', picked: ['Athens', 'Santorini', 'Crete', 'Naxos', 'Corfu'] }, { name: 'Italy', mode: 'manual', picked: ['Amalfi Coast', 'Lake Como'] }];
      W.S.days = 26; W.S.names = ['Zach', 'Anna', 'Mila', 'Leo']; W.replan(); W.render();
    });
    await pg.waitForTimeout(1200); await settle(pg, 8000);
    t.ok(await pg.evaluate(() => matchMedia('(hover:hover) and (pointer:fine)').matches), `@${width}: the page sees a mouse`);
    for (const sc of SCREENS) {
      await pg.keyboard.press('Escape').catch(() => {});
      await pg.evaluate(sc.go); await pg.waitForTimeout(sc.wait || 600); await settle(pg);
      const found = await pg.evaluate(CHECK);
      const wide = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (!t.ok(found.length === 0 && wide <= 1, `${sc.id} @${width}: ${found.length ? found.map(f => f.kind + ' ' + f.el + ' ' + (f.extra || '')).join('; ') : wide > 1 ? 'the page scrolls sideways by ' + wide + ' px' : 'clean'}`)) await t.shot(pg, `desktop-${width}-${sc.id}`);
    }
    /* the stay bar: all seven stays in view */
    const bar = await pg.evaluate(() => {
      W.closeTripMenu && W.closeTripMenu(); W.S.tview = 'days'; W.S.glanceOpen = true; W.setView('trip'); W.render(); window.scrollTo(0, 0);
      const nav = document.querySelector('#viewTrip .staybar'); if (!nav) return null;
      const nb = nav.getBoundingClientRect(), segs = [...nav.querySelectorAll('.sb-seg')];
      return { n: segs.length, hidden: segs.filter(s => { const r = s.getBoundingClientRect(); return r.left < nb.left - 1 || r.right > nb.right + 1 || r.width < 40; }).map(s => s.textContent), rows: new Set(segs.map(s => Math.round(s.getBoundingClientRect().top))).size };
    });
    t.ok(bar && bar.n === 7 && !bar.hidden.length, `@${width}: all ${bar && bar.n} stays are in view (${bar && bar.rows} row${bar && bar.rows > 1 ? 's' : ''})` + (bar && bar.hidden.length ? ': hidden ' + bar.hidden.join(', ') : ''));
    /* the day arrows */
    const arrows = await pg.evaluate(() => {
      W.S.glanceOpen = false; W.S.day = 3; W.render();
      return [...document.querySelectorAll('#viewTrip .daybar > [data-step]')].filter(e => e.getBoundingClientRect().width > 0).length;
    });
    t.eq(arrows, 2, `@${width}: the previous/next day arrows are there`);
    /* the Prepare tabs */
    const tabs = await pg.evaluate(() => {
      W.setView('book'); W.S.prepTab = 'tobook'; W.render();
      const seg = document.querySelector('.prep-seg'), sb = seg.getBoundingClientRect();
      return [...seg.querySelectorAll('button')].filter(x => { const r = x.getBoundingClientRect(); return r.left < sb.left - 1 || r.right > sb.right + 1; }).map(x => x.textContent);
    });
    t.eq(tabs, [], `@${width}: every Prepare tab is in view`);
    /* the trip menu opens under the trip's name */
    const menu = await pg.evaluate(async () => {
      W.setView('trip'); W.render(); window.scrollTo(0, 0);
      const sw = [...document.querySelectorAll('[data-sync="menu"]')].find(e => e.getBoundingClientRect().width > 0); sw.click(); await new Promise(r => setTimeout(r, 250));
      const m = document.querySelector('.top .trip-menu'); if (!m) return null;
      const sw2 = [...document.querySelectorAll('[data-sync="menu"]')].find(e => e.getBoundingClientRect().width > 0);   /* opening the menu redraws the button */
      const mr = m.getBoundingClientRect(), sr = sw2.getBoundingClientRect(), vw = document.documentElement.clientWidth;
      const out = { inWin: mr.left >= 0 && mr.right <= vw, under: mr.left <= sr.left + 1 && mr.right >= sr.right - 1, w: Math.round(mr.width) };
      W.closeTripMenu && W.closeTripMenu(); return out;
    });
    t.ok(menu && menu.inWin && menu.under, `@${width}: the trip menu opens under the trip's name, inside the window (${menu && menu.w} px wide)`);
    /* the kids' corner */
    if (width >= 1024) {
      const kw = await pg.evaluate(() => { W.setView('kids'); W.render(); const k = document.querySelector('.kids'); const r = k.getBoundingClientRect(); return { w: Math.round(r.width), mid: Math.round(r.left + r.width / 2 - document.documentElement.clientWidth / 2) }; });
      t.ok(kw.w <= 820 && Math.abs(kw.mid) <= 12, `@${width}: the kids' corner is ${kw.w} px wide, centred`);
    }
    t.eq(errors(), [], `@${width}: no page errors`);
    await ctx.close();
  }
  await b.close();
};
