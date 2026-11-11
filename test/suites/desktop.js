/* The app on a computer: a mouse instead of a finger, from a narrow side panel (600 px, the phone layout) to a big
   monitor (1920 px), with a seven-place trip so the bars have more to hold than fits. Every screen passes the same
   clipping and overlap checks as on a phone (lib/check.js), the page never scrolls sideways, and the parts that a
   phone lets you swipe (the stays, the Prepare tabs, the day pills) can all be reached without swiping:
     - every stay in the stay bar is fully visible (they shrink, then wrap to a second row, rather than hide past the edge)
     - every Prepare tab is fully visible
     - the previous/next day arrows are there at every width
     - the Day / Explore / All days switch spans the full width, in three equal parts
     - Explore: the search across the top, the route on the right below
     - the trip menu opens under the trip's name (right side of the banner), inside the window
     - the kids' corner stays picture-book sized and centred on a big screen */
const { launch, open, exampleTrip, settle, calm } = require('../lib/page'); const SCREENS = require('../lib/screens'); const CHECK = require('../lib/check');
const inside = (a, b, m = 1) => a.left >= b.left - m && a.right <= b.right + m && a.top >= b.top - m && a.bottom <= b.bottom + m;
/* how far the ink of what an element shows sits from the element's middle, in CSS px, with the pointer over it (that
   is when a browser draws its own up and down arrows inside a number box, which pushes the digits to the left) */
async function inkOff(pg, el) {
  const { decode } = require('fast-png'); await el.evaluate(e => e.scrollIntoView({ block: 'center', inline: 'center' })); await pg.waitForTimeout(120);
  const box = await el.boundingBox(), vp = pg.viewportSize();
  if (!box || box.width < 12 || box.height < 12 || box.x < 0 || box.y < 0 || box.x + box.width > vp.width || box.y + box.height > vp.height) return null;   /* not on screen: not measured */
  await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await pg.waitForTimeout(150);
  const png = decode(await pg.screenshot({ clip: { x: box.x + 2, y: box.y + 4, width: box.width - 4, height: box.height - 8 } })), ch = png.channels, d = png.data;
  let lo = png.width, hi = -1;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) { const o = (y * png.width + x) * ch; if (d[o] + d[o + 1] + d[o + 2] < 300) { if (x < lo) lo = x; if (x > hi) hi = x; } }   /* the digits' dark ink only (the light theme): the browser's grey arrows are not ink */
  await pg.mouse.move(2, 2);
  return hi < 0 ? null : ((lo + hi) / 2 - (png.width - 1) / 2) * (box.width - 4) / png.width;
}
exports.run = async t => {
  const b = await launch();
  for (const width of [600, 1024, 1440, 1920]) {
    const { pg, ctx, errors } = await open(b, { width, height: 900, touch: false }); await exampleTrip(pg);
    await pg.evaluate(() => {
      W.S.countries = [{ name: 'Greece', mode: 'manual', picked: ['Athens', 'Santorini', 'Crete', 'Naxos', 'Corfu'] }, { name: 'Italy', mode: 'manual', picked: ['Amalfi Coast', 'Lake Como'] }];
      W.S.days = 26; W.S.names = ['Zach', 'Anna', 'Mila', 'Leo']; W.replan(); W.render();
    });
    await calm(pg, 9200);
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
    /* the Day / Explore / All days switch runs the full width of the page, in three equal parts */
    const vsw = await pg.evaluate(() => {
      const v = [...document.querySelectorAll('#viewTrip .vsw')].find(e => e.getBoundingClientRect().width > 0); if (!v) return null;
      /* (the switch and "+ Add" share one row: the row spans the page) */
      const row = v.closest('.vsw-row') || v, p = row.parentElement, cs = getComputedStyle(p), inner = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const bw = [...v.querySelectorAll('button')].map(b => Math.round(b.getBoundingClientRect().width));
      return { w: Math.round(row.getBoundingClientRect().width), inner: Math.round(inner), bw };
    });
    t.ok(vsw && vsw.w >= vsw.inner - 2 && Math.max(...vsw.bw) - Math.min(...vsw.bw) <= 2, `@${width}: the Day / All days / Explore switch spans the page (${vsw && vsw.w} of ${vsw && vsw.inner} px; buttons ${vsw && vsw.bw.join('/')})`);
    /* a big screen keeps the day's own title and the greeting in the banner (the day in the banner is a phone's) */
    const big = await pg.evaluate(() => { W.S.tview = 'days'; W.S.glanceOpen = false; W.render(); const h = document.querySelector('#viewTrip .day-h'), tl = document.querySelector('#topline .tl-day'); scrollTo(0, 500);
      return { h: Math.round(h.getBoundingClientRect().height), day: tl ? getComputedStyle(tl).display : 'none', greet: getComputedStyle(document.querySelector('#topline .tl-hi')).display, pin: getComputedStyle(document.querySelector('#pin')).display, gm: !!document.querySelector('#viewTrip .gm-row .gmr') && getComputedStyle(document.querySelector('#viewTrip .gm-row .gmr')).display !== 'none' }; });
    await pg.evaluate(() => scrollTo(0, 0));
    t.ok(big.h > 40 && big.day === 'none' && big.greet !== 'none' && big.pin === 'none' && big.gm, `@${width}: the day keeps its title, the banner its greeting, and nothing is pinned on scroll`);
    /* Explore on a big screen: the search across the top, the route on the right below */
    if (width >= 1024) {
      const xp = await pg.evaluate(async () => {
        W.S.tview = 'map'; W.render(); await new Promise(r => setTimeout(r, 300));
        const r = s => { const e = document.querySelector('#viewTrip ' + s); return e && e.getBoundingClientRect(); };
        const ps = r('.psearch'), rc = r('.xp-cols > .explorer'), dv = r('.dayflip'); W.S.tview = 'days'; W.render();
        return ps && dv ? { ps: Math.round(ps.width), dv: Math.round(dv.width), map: !!rc, below: !rc || rc.top >= ps.bottom - 1, right: !rc || rc.left > ps.left + ps.width / 2, story: !!document.querySelector('.dsb') } : null;
      });
      t.ok(xp && Math.abs(xp.ps - xp.dv) <= 2 && xp.below && xp.right && !xp.story, `@${width}: Explore puts the search across the top (${xp && xp.ps} px) and the street map, where there is one, on the right below`);
    }
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
    if (width === 1440) {
      /* Plan, "Where to": the number of days sits midway between − and +, also with the mouse over it */
      await pg.evaluate(() => { W.goView('setup'); setTimeout(() => document.querySelectorAll('#viewSetup details').forEach(d => d.open = true), 100); }); await pg.waitForTimeout(900);
      const boxes = await pg.$$('#viewSetup .stepper input'), offs = [];
      for (const el of boxes.slice(0, 6)) { const o = await inkOff(pg, el); if (o != null) offs.push(o); }
      t.ok(offs.length >= 2 && offs.every(o => Math.abs(o) <= 1.5), `@${width}: each day count is centred between − and + (${offs.length} measured, off by ${offs.map(o => o.toFixed(1)).join(', ')} px)`);
      /* (the check sees it when the browser's own arrows are back) */
      await pg.addStyleTag({ content: '.stepper input{appearance:auto !important;-moz-appearance:auto !important;padding:1px 2px !important}.stepper input::-webkit-inner-spin-button,.stepper input::-webkit-outer-spin-button{-webkit-appearance:inner-spin-button !important;appearance:auto !important;display:block !important;opacity:1 !important}' });
      let bad = null; for (const el of boxes.slice(0, 6)) { bad = await inkOff(pg, el); if (bad != null) break; }
      t.ok(bad != null && Math.abs(bad) > 3, `@${width}: with the browser's own arrows the digits would sit ${bad == null ? '?' : Math.abs(bad).toFixed(1)} px off centre (so the check above means something)`);
      /* Prepare: the row of tabs stays where it is whichever tab is open, and the page never shifts sideways
         (a short tab has no scrollbar, a long one has: the gutter is kept either way) */
      await pg.evaluate(() => { W.needLater(); W.goView('book'); }); await pg.waitForSelector('#viewBook [data-prep]', { timeout: 15000 });
      const pos = [];
      for (const seg of ['tobook', 'booked', 'budget', 'pack', 'take']) {
        await pg.evaluate(s => document.querySelector('#viewBook [data-prep="' + s + '"]').click(), seg); await pg.waitForTimeout(450);
        pos.push(await pg.evaluate(() => { const r = document.querySelector('#viewBook .prep-seg').getBoundingClientRect(), h = document.querySelector('#viewBook .prep-seg').previousElementSibling;
          return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), client: document.documentElement.clientWidth, scrolls: document.documentElement.scrollHeight > innerHeight + 1, cur: !!document.querySelector('#viewBook .cur-pick'), curInBudget: !!document.querySelector('#viewBook .cur-pick') && !document.querySelector('#viewBook .prep-seg ~ .cur-pick') && !(h && h.classList.contains('cur-pick')) }; }));
      }
      t.ok(pos.every(p => p.x === pos[0].x && p.y === pos[0].y && p.w === pos[0].w), `@${width}: Prepare's tabs sit in one place on all five tabs (${pos.map(p => p.x + ',' + p.y).join(' ')})`);
      /* (and a page too short to scroll: every tab is long enough to scroll now, so one is made short) */
      const short = await pg.evaluate(() => { const v = document.querySelector('#viewBook'), keep = v.innerHTML; [...v.children].forEach(c => { if (!c.matches('.ready, .prep-seg')) c.remove(); }); const r = { client: document.documentElement.clientWidth, scrolls: document.documentElement.scrollHeight > innerHeight + 1 }; v.innerHTML = keep; return r; });
      t.ok(pos.concat([short]).every(p => p.client === pos[0].client) && pos.some(p => p.scrolls) && !short.scrolls, `@${width}: the page is as wide with a scrollbar as without (${pos.concat([short]).map(p => p.client + (p.scrolls ? ' scrolls' : '')).join(', ')})`);
      t.ok(pos.map(p => p.cur).join() === 'false,false,true,false,false' && pos[2].curInBudget, `@${width}: "Prices in" is part of Budget, not of the header above the tabs`);
      /* To book (and Booked) on the left, the budget at the top of the right column, the booking sites under it */
      const cols = [];
      for (const seg of ['tobook', 'booked']) {
        await pg.evaluate(s => document.querySelector('#viewBook [data-prep="' + s + '"]').click(), seg); await pg.waitForTimeout(450);
        cols.push(await pg.evaluate(() => { const m = document.querySelector('#viewBook .bk-ahead, #viewBook .bk-done').getBoundingClientRect(), s = document.querySelector('#viewBook .bud-side'), r = s && s.getBoundingClientRect(), nx = s && s.nextElementSibling && s.nextElementSibling.getBoundingClientRect();
          return { left: Math.round(m.left), side: r ? Math.round(r.left) : 0, top: r ? Math.round(r.top - m.top) : 99, below: nx ? Math.round(nx.left - r.left) + '/' + Math.round(nx.top - r.bottom) : 'none', total: s ? /Total/.test(s.textContent) && /Open the budget/.test(s.textContent) : false }; }));
      }
      t.ok(cols.every(c => c.side > c.left + 300 && Math.abs(c.top) <= 2 && c.total) && /^0\//.test(cols[0].below), `@${width}: To book and Booked keep the left column, the budget sits at the top of the right one, with what follows under it (${JSON.stringify(cols)})`);
    }
    t.eq(errors(), [], `@${width}: no page errors`);
    await ctx.close();
  }
  await b.close();
};
