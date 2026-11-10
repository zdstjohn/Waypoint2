/* v118 look: the idea row as pictures (checked, not for little ones, photos, map) with a red bordered "Not for us" apart
   from them; photo credits are plain text; the kids' banner is centred; Prepare's tabs stay put on a wide screen; the
   street map's outer limit hugs the town and the day's stops. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch();
  { const { pg, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg);
    await pg.evaluate(() => { W.S.day = 2; W.S.tview = 'map'; W.S.glanceOpen = false; W.setView('trip'); W.render(); }); await settle(pg, 4000);
    const r = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll('#viewTrip .idea .idea-meta')];
      const words = rows.map(m => m.textContent).join(' ');
      const one = rows.find(m => m.querySelector('.id-no')), no = one && one.querySelector('.id-no'), cs = no && getComputedStyle(no);
      const ilinks = [...document.querySelectorAll('#viewTrip .idea .ilink')];
      const nr = no && no.getBoundingClientRect(), last = one && [...one.querySelectorAll('.im-l > *')].pop(), lr = last && last.getBoundingClientRect();
      return { rows: rows.length, words: /Checked|Photos|Google Maps|Not ideal/.test(words), badges: document.querySelectorAll('#viewTrip .idea .ck-badge svg').length,
        kid: document.querySelectorAll('#viewTrip .idea .kid-warn[aria-label^="Not ideal"] svg').length,
        links: ilinks.length && ilinks.every(a => a.getAttribute('aria-label') && a.target === '_blank' && a.querySelector('svg') && !a.textContent.trim()),
        maps: ilinks.filter(a => a.classList.contains('ilink-map')).every(a => /google\.com\/maps/.test(a.href)),
        tap: ilinks.every(a => { const q = a.getBoundingClientRect(); return q.width >= 40 && q.height >= 40; }),
        border: cs && parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle === 'solid' && cs.borderTopColor === cs.color, red: cs && (() => { const m = cs.color.match(/\d+/g).map(Number); return m[0] > 180 && m[0] > m[1] * 1.6 && m[0] > m[2] * 1.6; })(),
        apart: nr && lr ? Math.round(nr.left - lr.right) : null, sameLine: nr && lr ? Math.abs(nr.top - lr.top) < 30 : null, text: no && no.textContent };
    });
    t.ok(r.rows > 3 && !r.words, 'the idea rows say "Checked", "Photos", "Google Maps" and "Not ideal for kids" with pictures, not words');
    t.ok(r.badges > 0, `a checked place shows a green check in a circle (${r.badges})`);
    t.ok(r.kid > 0, `a place better for older kids shows the crossed-out child (${r.kid})`);
    t.ok(r.links && r.maps && r.tap, 'photos and map are picture links, named for screen readers, open outside, and big enough to tap');
    t.ok(r.border && r.red && r.text === 'Not for us', '"Not for us" is a red button with a red border');
    t.ok(r.apart === null || !r.sameLine || r.apart >= 16, `and it keeps its distance from the links (${r.apart} px)`);
    /* photo credits: text, not links */
    const cr = await pg.evaluate(() => ({ links: document.querySelectorAll('a.credit').length, spans: document.querySelectorAll('span.credit').length, pe: [...document.querySelectorAll('span.credit')].every(s => getComputedStyle(s).pointerEvents === 'none') }));
    t.ok(cr.links === 0 && cr.pe, `photo credits are plain text a tap goes through (${cr.spans} shown)`);
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
    await pg.reload(); await pg.waitForTimeout(2500); await settle(pg);
    const kc = await pg.evaluate(() => { const k = document.querySelector('#viewGo .kids-chip'); if (!k) return null; const r = k.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(k); const tr = rg.getBoundingClientRect(); return { left: Math.round(tr.left - r.left), right: Math.round(r.right - tr.right) }; });
    t.ok(!kc || Math.abs(kc.left - kc.right) <= 4, 'the kids\' banner text is centred: ' + JSON.stringify(kc));
    await pg.evaluate(() => { localStorage.removeItem('waypoint-now'); W.setAppMode && W.setAppMode('plan'); W.goView('book'); }); await pg.waitForTimeout(1500); await settle(pg);
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
