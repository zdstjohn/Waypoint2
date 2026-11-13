/* v118 look: an idea's row is its links as pictures (photos, map), nothing else; photo credits are plain text; the kids' banner is centred; Prepare's tabs stay put on a wide screen; the
   street map's outer limit hugs the town and the day's stops. */
const { launch, open, exampleTrip, settle, calm } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch();
  { const { pg, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg);
    await pg.evaluate(() => { W.S.day = 2; W.S.tview = 'map'; W.setView('trip'); W.render(); }); await settle(pg, 4000);
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
    /* a place's name runs on rather than "Sant'Eustach…" */
    const nm = await pg.evaluate(() => { W.S.tview = 'days'; W.render(); return [...document.querySelectorAll('#viewTrip .slot.slim .sl-l')].filter(e => e.querySelector('.nm') && e.querySelector('.nm').textContent.trim()).map(e => { const c = getComputedStyle(e), n = e.querySelector('.nm'), rs = [...n.getClientRects()];
      /* a word split across two lines has two boxes: compare each word's boxes (a hyphen is a fair place to wrap) */
      const words = n.textContent.trim().split(/[\s-]+/).filter(Boolean),   /* (a hyphen is a fair place to wrap) */ range = document.createRange(), split = []; let pos = 0; const tx = n.firstChild && n.firstChild.nodeType === 3 ? n.firstChild : null;
      if (tx) words.forEach(w => { const i = tx.data.indexOf(w, pos); if (i < 0) return; range.setStart(tx, i); range.setEnd(tx, i + w.length); if (range.getClientRects().length > 1) split.push(w); pos = i + w.length; });
      const cn = getComputedStyle(n);
      return { n: n.textContent.trim(), whole: n.scrollHeight <= n.clientHeight + 2, lines: Math.round(n.clientHeight / parseFloat(cn.lineHeight)), clamp: cn.webkitLineClamp, split }; }); });
    /* (v174: the name has the card's width under its time, up to three lines) */
    t.ok(nm.length >= 2 && nm.every(x => x.whole && x.lines <= 3 && x.clamp === '3' && !x.split.length), 'the day\'s places show their whole names, on three lines at most, never split inside a word: ' + nm.map(x => x.n + ' (' + x.lines + (x.split.length ? ', split: ' + x.split.join(' ') : '') + ')').join(', '));
    /* On a phone the banner's last line is the day (city, date, how full, the route), so the day's title is not a block
       of its own under it, and the first stop starts higher up; the heading stays in the page for a screen reader */
    const bd = await pg.evaluate(() => { W.S.tview = 'days'; W.render(); scrollTo(0, 0); const top = document.querySelector('.top'), tl = document.querySelector('#topline .tl-day'), go = tl && tl.querySelector('.tl-go'), h = document.querySelector('#viewTrip .day-h'), gm = document.querySelector('#viewTrip .day-h ~ .day-gm a');
      const vis = e => !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 2; const d = W.P.days[W.S.day - 1];
      return { on: top.hasAttribute('data-day'), text: tl ? tl.innerText.replace(/\s+/g, ' ').trim() : '', city: d.city, greet: vis(document.querySelector('#topline .tl-hi')), go: vis(go) && go.getAttribute('href'), goBox: go ? Math.round(go.getBoundingClientRect().width) + 'x' + Math.round(go.getBoundingClientRect().height) : '', goName: go && go.getAttribute('aria-label'),
        hidden: tl && tl.querySelector('.tl-dt').getAttribute('aria-hidden'), h2: h && h.querySelector('h2').textContent, hBox: h ? Math.round(h.getBoundingClientRect().height) : -1, old: vis(gm), want: W.dayRouteUrl ? 1 : 0, first: Math.round(document.querySelector('#viewTrip .slot').getBoundingClientRect().top), logo: Math.round(document.querySelector('.top .brand svg').getBoundingClientRect().width), pin: document.querySelector('#pin').hidden }; });
    t.ok(bd.on && bd.text.indexOf(bd.city) === 0 && /\w{3}, \w{3} \d+/.test(bd.text) && /day$/i.test(bd.text) && !bd.greet, 'on a phone the banner\'s last line is the day: "' + bd.text + '" (the greeting gives way to it)');
    t.ok(bd.logo >= 120, 'the logo keeps its place and size in the banner (' + bd.logo + ' px wide)');
    t.ok(/^https:\/\/www\.google\.com\/maps\/dir\//.test(bd.go || '') && bd.goBox === '40x40' && /whole route in Google Maps/.test(bd.goName || '') && !bd.old, 'with the whole route in Google Maps as a 40 px button there, in place of the wide one under the title');
    t.ok(bd.h2 === bd.city && bd.hBox <= 1 && bd.hidden === 'true', 'the day\'s heading is still in the page for a screen reader (and the banner\'s copy of it is not read twice), but takes no room');
    t.ok(bd.first < 620 && bd.pin, 'so the first stop starts ' + bd.first + ' px down (it was 738), and nothing is pinned while the banner is in view');
    /* scrolled: one slim row stays, logo and city and where in the trip, with the day strip under it */
    await pg.evaluate(() => scrollTo(0, 460)); await pg.waitForTimeout(450);
    const pn = await pg.evaluate(() => { const p = document.querySelector('#pin'), r = p.getBoundingClientRect(), d = document.querySelector('#viewTrip .daybar').getBoundingClientRect(), l = p.querySelector('.pin-logo');
      return { shown: !p.hidden && getComputedStyle(p).display !== 'none', top: Math.round(r.top), h: Math.round(r.height), logo: l ? Math.round(l.getBoundingClientRect().width) : 0, use: !!p.querySelector('use[href="#wpMark"]') && !!document.querySelector('#wpMark'), text: p.innerText.replace(/\s+/g, ' ').trim(), name: p.getAttribute('aria-label'), day: [Math.round(d.top), Math.round(d.bottom)], ids: document.querySelectorAll('#wpLetters').length }; });
    t.ok(pn.shown && pn.top === 0 && pn.h >= 44 && pn.h <= 52, 'once the banner has scrolled away one slim row stays at the top (' + pn.h + ' px)');
    t.ok(pn.logo >= 80 && pn.use && pn.ids === 1, 'with the logo in it (' + pn.logo + ' px, the same drawing, not a second copy)');
    t.ok(pn.text.indexOf(bd.city) === 0 && /Back to the top/.test(pn.name || ''), 'and the city and where in the trip: "' + pn.text + '"');
    t.ok(pn.day[0] === pn.h && pn.day[1] > pn.day[0] + 40, 'the day strip stays right under it (' + pn.day.join('–') + ' px)');
    await pg.click('#pin'); await pg.waitForFunction(() => scrollY < 5, null, { timeout: 4000 }).catch(() => {}); await pg.waitForTimeout(300);
    t.ok(await pg.evaluate(() => scrollY < 5 && document.querySelector('#pin').hidden), 'a tap on it goes back to the top, and it leaves');
    /* Today (and Plan, Prepare) scroll on without it: it is the Trip's, where the day strip sticks under it */
    const offTrip = await pg.evaluate(async () => { const out = {}; for (const v of ['go', 'setup', 'book']) { W.goView(v); W.render(); scrollTo(0, 900); await new Promise(r => setTimeout(r, 250)); out[v] = !document.querySelector('#pin').hidden; } W.goView('trip'); W.render(); scrollTo(0, 0); return out; });
    t.ok(!offTrip.go && !offTrip.setup && !offTrip.book, 'no slim bar on Today, Plan or Prepare: ' + JSON.stringify(offTrip));
    /* other screens keep the greeting */
    const oth = await pg.evaluate(() => { const out = {}; W.S.tview = 'map'; W.render(); out.map = document.querySelector('.top').hasAttribute('data-day'); out.greet = getComputedStyle(document.querySelector('#topline .tl-hi')).display !== 'none'; W.S.tview = 'days'; W.render(); return out; });
    /* (changed with the Explore header: Explore carries the same day line as Day, so the banner is the same height on both tabs and nothing below it jumps on a switch) */
    t.ok(oth.map && !oth.greet, 'Explore shows the same day line in the banner as Day (the banner keeps one height across the two tabs)');
    /* the stop panel's links and "Not for us" too */
    await pg.evaluate(() => { W.S.tview = 'days'; W.render(); const x = W.P.days[1].slots.find(x => x.item && !W.isFood(x.slot)); W.openStop(x.key); }); await pg.waitForTimeout(700);
    const sh = await pg.evaluate(() => { const s = document.querySelector('#sheethost'); const o = s && s.querySelector('.sh-out-r.danger'); return { btns: s ? [...s.querySelectorAll('.links .pl-a')].map(a => a.textContent.trim() + (a.querySelector('svg') ? '+icon' : '')) : [], red: o ? getComputedStyle(o).borderTopColor === getComputedStyle(o.querySelector('b')).color : false }; });
    t.ok(sh.btns.join() === 'Reviews+icon,Photos+icon,Map+icon' && sh.red, 'the stop panel\'s links are a picture with its word, and its "Not for us" has a red border: ' + JSON.stringify(sh));
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
    const kc = await pg.evaluate(() => { const k = document.querySelector('#viewGo .go-kids'), h = document.querySelector('#viewGo .go-hero'), rt = document.querySelector('#viewGo .go-route'); if (!k) return null; return { below: !!h && !!rt && k.getBoundingClientRect().top > rt.getBoundingClientRect().bottom, loud: /gradient/.test(getComputedStyle(k).backgroundImage), old: !!document.querySelector('.kids-chip') }; });
    t.ok(!kc || (kc.below && !kc.loud && !kc.old), 'the kids\' corner is a quiet row below what is now, what is next and the route (not a banner above them): ' + JSON.stringify(kc));
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
