/* v118 look: an idea's row is its links as pictures (photos, map), nothing else; photo credits are plain text; the kids' banner is centred; Prepare's tabs stay put on a wide screen; the
   street map's outer limit hugs the town and the day's stops. */
const { launch, open, exampleTrip, settle, calm } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch();
  { const { pg, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg);
    await pg.evaluate(() => { W.S.day = 2; W.S.tview = 'map'; W.S.glanceOpen = false; W.setView('trip'); W.render(); }); await settle(pg, 4000);
    const r = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll('#viewTrip .idea .idea-meta')], ilinks = [...document.querySelectorAll('#viewTrip .idea .ilink')];
      return { rows: rows.length, words: /Checked|Photos|Google Maps|Not ideal|Not for us/.test(rows.map(m => m.textContent).join(' ')),
        marks: document.querySelectorAll('#viewTrip .idea .ck-badge, #viewTrip .idea .kid-warn, #viewTrip .idea [data-nope]').length,
        links: ilinks.length >= rows.length * 2 && ilinks.every(a => a.getAttribute('aria-label') && a.target === '_blank' && a.querySelector('svg') && !a.textContent.trim()),
        maps: ilinks.filter(a => a.classList.contains('ilink-map')).every(a => /google\.com\/maps/.test(a.href)),
        tap: ilinks.every(a => { const q = a.getBoundingClientRect(); return q.width >= 40 && q.height >= 40; }) };
    });
    t.ok(r.rows > 3 && !r.words && r.marks === 0, 'an idea\'s row is just its links: no "checked" mark, no kids mark, no "Not for us" button');
    /* a place to eat's menu link is the menu picture the One day view uses for a meal's menu, not a second "search" glass */
    const things = await pg.evaluate(() => [...document.querySelectorAll('#viewTrip .idea')].filter(c => c.querySelector('.ilink[aria-label*="menu" i]')).length);
    await pg.click('#viewTrip [data-tab="eat"]'); await pg.waitForTimeout(500);
    const menu = await pg.evaluate(() => { const all = [...document.querySelectorAll('#viewTrip .idea')], eat = all.filter(c => c.querySelector('.ilink[aria-label*="menu" i]')), a = eat[0] && eat[0].querySelector('.ilink[aria-label*="menu" i]');
      const tmp = document.createElement('div'); tmp.innerHTML = W.icon('menu', 2);   /* (read back through the page, as the link's own picture is) */
      const pic = a ? a.querySelector('svg').innerHTML : '', day = tmp.querySelector('svg').innerHTML, glass = (document.querySelector('#viewTrip .idea .ilink-map') || document.createElement('i')).innerHTML;
      return { n: eat.length, all: all.length, same: !!pic && pic === day, label: a ? a.getAttribute('aria-label') : '', other: a ? [...a.parentNode.querySelectorAll('.ilink')].filter(x => x !== a).every(x => x.querySelector('svg').innerHTML !== pic) : false, glass: glass.length }; });
    t.ok(menu.n >= 3 && menu.n === menu.all && menu.same && menu.other, 'Explore: every place to eat has a menu link with the menu picture of the One day view (' + menu.n + ' of ' + menu.all + ' places; "' + menu.label + '")');
    t.ok(things === 0, 'and things to do have none');
    await pg.click('#viewTrip [data-tab="do"]'); await pg.waitForTimeout(300);
    t.ok(r.links && r.maps && r.tap, 'photos and map are picture links, named for screen readers, open outside, and big enough to tap');
    /* photo credits: text, not links */
    const cr = await pg.evaluate(() => ({ links: document.querySelectorAll('a.credit').length, spans: document.querySelectorAll('span.credit').length, pe: [...document.querySelectorAll('span.credit')].every(s => getComputedStyle(s).pointerEvents === 'none') }));
    t.ok(cr.links === 0 && cr.pe, `photo credits are plain text a tap goes through (${cr.spans} shown)`);
    /* the One day / All days switch sits in the middle */
    const ds = await pg.evaluate(() => { W.S.tview = 'days'; W.S.glanceOpen = false; W.render(); const d = document.querySelector('#viewTrip .dsw').getBoundingClientRect(), v = document.querySelector('#viewTrip .vsw').getBoundingClientRect(); return { left: Math.round(d.left - v.left), right: Math.round(v.right - d.right), w: Math.round(d.width), vw: Math.round(v.width) }; });
    t.ok(Math.abs(ds.left - ds.right) <= 2 && ds.w < ds.vw - 40, 'the One day / All days switch is centred under the tabs: ' + JSON.stringify(ds));
    /* the stop panel's links and "Not for us" too */
    await pg.evaluate(() => { W.S.tview = 'days'; W.render(); const x = W.P.days[1].slots.find(x => x.item && !W.isFood(x.slot)); W.openStop(x.key); }); await pg.waitForTimeout(700);
    const sh = await pg.evaluate(() => { const s = document.querySelector('#sheethost'); const o = s && s.querySelector('.sh-out-r.danger'); return { icons: s ? s.querySelectorAll('.links .ilink').length : 0, words: s ? /\bPhotos\b|Google Maps/.test(s.querySelector('.links') ? s.querySelector('.links').textContent : '') : true, red: o ? getComputedStyle(o).borderTopColor === getComputedStyle(o.querySelector('b')).color : false }; });
    t.ok(sh.icons === 2 && !sh.words && sh.red, 'the stop panel uses the same pictures, and its "Not for us" has a red border: ' + JSON.stringify(sh));
    await pg.evaluate(() => W.closeStop && W.closeStop());
    /* the map's outer limit */
    const ar = await pg.evaluate(() => typeof W.vtArea === 'function' || !!W.needLater());
    if (!(await pg.evaluate(() => typeof W.vtArea === 'function'))) await pg.waitForFunction(() => typeof W.vtArea === 'function', null, { timeout: 8000 }).catch(() => {});
    const A = await pg.evaluate(() => { const fira = [25.40, 36.38, 25.45, 36.44]; return { town: W.vtArea(fira, []), withStop: W.vtArea(fira, [[25.36, 36.35]]) }; });
    const span = a => [+(a[1][0] - a[0][0]).toFixed(3), +(a[1][1] - a[0][1]).toFixed(3)];
    t.ok(span(A.town)[0] < 0.13 && span(A.town)[1] < 0.12, 'the map zooms out only a little past the town (about 10 km across): ' + JSON.stringify(span(A.town)));
    t.ok(A.withStop[0][0] < 25.36 && A.withStop[0][1] < 36.35, 'and as far as the day\'s own stops');
    t.eq(errors(), [], 'no page errors (phone)');
  }
  { /* desktop: the kids' banner, Prepare's tabs */
    const { pg, errors } = await open(b, { width: 1440, height: 900, db: mkdb() }); await exampleTrip(pg);
    await pg.evaluate(() => { W.save && W.save(); localStorage.setItem('waypoint-now', '2027-06-09T10:40:00'); });
    await pg.reload(); await calm(pg, 5000);
    const kc = await pg.evaluate(() => { const k = document.querySelector('#viewGo .kids-chip'); if (!k) return null; const r = k.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(k); const tr = rg.getBoundingClientRect(); return { left: Math.round(tr.left - r.left), right: Math.round(r.right - tr.right) }; });
    t.ok(!kc || Math.abs(kc.left - kc.right) <= 4, 'the kids\' banner text is centred: ' + JSON.stringify(kc));
    await pg.evaluate(() => { localStorage.removeItem('waypoint-now'); W.setAppMode && W.setAppMode('plan'); W.goView('book'); }); await calm(pg, 4000);
    const pos = [];
    for (const tab of ['tobook', 'booked', 'budget', 'pack', 'take']) {
      await pg.evaluate(tb => { W.S.prepTab = tb; W.render(); }, tab); await pg.waitForTimeout(tab === 'pack' ? 900 : 300);
      pos.push(await pg.evaluate(() => { const r = document.querySelector('#viewBook .prep-seg').getBoundingClientRect(), q = document.querySelector('#viewBook .ready').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(q.left)]; }));
    }
    t.ok(pos.every(p => JSON.stringify(p) === JSON.stringify(pos[0])), 'Prepare\'s tabs stay in the same place on every tab: ' + JSON.stringify(pos));
    t.eq(errors(), [], 'no page errors (desktop)');
  }
  await b.close();
};
