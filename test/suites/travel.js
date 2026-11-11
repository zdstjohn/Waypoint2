/* Travel mode: during the trip the app opens on Today with a timeline, running late shifts the times, the day before and after
   are a tap away. */
const { launch, open, exampleTrip, settle, calm } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(pg);
  await pg.evaluate(() => { W.save && W.save(); localStorage.setItem('waypoint-now', '2027-06-09T10:40:00'); });
  await pg.reload(); await calm(pg, 5000);
  const s = await pg.evaluate(() => ({ view: W.view(), travel: document.documentElement.classList.contains('travel'), tl: document.querySelectorAll('.go-rt li').length, hero: !!document.querySelector('.go-hero') }));
  t.ok(s.view === 'go' && s.travel, 'during the trip the app opens on Today in Travel mode: ' + JSON.stringify(s));
  t.ok(s.tl >= 3, 'with the day laid out as a route');
  /* today's map: open above the stops (where the city has a street map); "Hide map" folds it, and the phone remembers */
  const mp = await pg.evaluate(async () => {
    const none = !document.querySelector('#viewGo [data-gomap]');
    const f = W.vtFor, m = W.vtMount, st = W.vtState; W.vtFor = () => 'test-city'; W.vtState = () => 'idle'; W.vtMount = () => false; W.render();
    const b2 = document.querySelector('#viewGo .go-route [data-gomap]'), wrap = document.querySelector('#viewGo .go-route .map-wrap'), list = document.querySelector('#viewGo .go-rt');
    const open = !!wrap && !!b2 && b2.getAttribute('aria-expanded') === 'true' && /Hide map/.test(b2.textContent) && !!list && wrap.getBoundingClientRect().bottom <= list.getBoundingClientRect().top + 1 && !!document.querySelector('#viewGo [data-zoom="fit"]') && localStorage.getItem('waypoint-gomap') === null;
    W.goView('trip'); W.S.tview = 'map'; W.render(); await new Promise(r => setTimeout(r, 300));
    const explore = !document.querySelector('#viewTrip .map-wrap');
    W.goView('go'); await new Promise(r => setTimeout(r, 300)); if (document.querySelector('#viewGo [data-gomap]')) document.querySelector('#viewGo [data-gomap]').click(); await new Promise(r => setTimeout(r, 200));
    const shut = !document.querySelector('#viewGo .map-wrap') && document.querySelector('#viewGo [data-gomap]').getAttribute('aria-expanded') === 'false' && localStorage.getItem('waypoint-gomap') === '0';
    document.querySelector('#viewGo [data-gomap]').click(); await new Promise(r => setTimeout(r, 200));
    const again = !!document.querySelector('#viewGo .map-wrap') && localStorage.getItem('waypoint-gomap') === '1';
    W.vtFor = f; W.vtMount = m; W.vtState = st; W.render();
    return { none, open, explore, shut, again };
  });
  t.ok(mp.none && mp.open && mp.explore, 'where the city has a street map, Today shows it open above the stops, with "Hide map"; Explore has no map: ' + JSON.stringify(mp));
  t.ok(mp.shut && mp.again, '"Hide map" folds it and the phone remembers; "Map" brings it back');
  /* a phone saving data, or one where you hid the map, starts with it folded */
  for (const [label, init] of [['saving data', () => { Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true }); }], ['hid it before', () => { try { localStorage.setItem('waypoint-gomap', '0'); } catch (e) {} }]]) {
    const o = await open(b, { width: 390, height: 844, init });
    await o.pg.evaluate(() => { localStorage.setItem('waypoint-now', '2027-06-09T10:30'); W.S.start = '2027-06-07'; W.isExample = false; W.vtFor = () => 'test-city'; W.vtState = () => 'idle'; W.vtMount = () => false; W.goView('go'); W.render(); });
    await settle(o.pg, 8000);   /* (the day's places pinned: the map needs them) */
    const f2 = await o.pg.evaluate(async () => { W.render(); await new Promise(r => setTimeout(r, 300)); const btn = document.querySelector('#viewGo [data-gomap]'); return { ok: !!btn && btn.getAttribute('aria-expanded') === 'false' && !document.querySelector('#viewGo .map-wrap'), btn: btn ? btn.getAttribute('aria-expanded') : 'none', view: W.view() }; });
    t.ok(f2.ok, 'a phone that is ' + label + ' starts with the map folded behind "Map" ' + JSON.stringify(f2));
    await o.ctx.close();
  }
  const t0 = await pg.evaluate(() => (document.querySelector('.go-rt li.next .t') || document.querySelector('.go-rt li:not(.done) .t') || {}).textContent);
  if (await pg.$('[data-late="15"]')) {
    await pg.click('[data-late="15"]'); await pg.waitForTimeout(700);
    const t1 = await pg.evaluate(() => (document.querySelector('.go-rt li.next .t') || document.querySelector('.go-rt li:not(.done) .t') || {}).textContent);
    t.ok(t0 !== t1, `running 15 min late shifts the next time (${t0} -> ${t1})`);
    await pg.click('[data-late="0"]'); await pg.waitForTimeout(400);
  } else t.note('no running-late control on this day');
  /* rescue the rest of today: rain swaps the outdoor stops still to come for indoor ones (or frees them); nothing started changes; undo restores */
  const before = await pg.evaluate(() => { const d = W.P.days[W.S.day - 1], T = W.dayTimes(d, W.P), nm = W.nowMin(); return d.slots.map(x => ({ slot: x.slot, n: x.item ? x.item.n : null, started: !!(T.rows[x.slot] && T.rows[x.slot].start != null && T.rows[x.slot].start <= nm), indoor: x.item && !W.isFood(x.slot) ? W.classify(x.item).indoor : null })); });
  if (await pg.$('#viewGo [data-goplans]')) { await pg.click('#viewGo [data-goplans]'); await pg.waitForTimeout(300); }   /* (the rescues are behind "Change of plans") */
  if (await pg.$('[data-rescue="rain"]')) {
    await pg.click('[data-rescue="rain"]'); await pg.waitForTimeout(900);
    const after = await pg.evaluate(() => { const d = W.P.days[W.S.day - 1]; return { slots: d.slots.map(x => ({ slot: x.slot, n: x.item ? x.item.n : null, indoor: x.item && !W.isFood(x.slot) ? W.classify(x.item).indoor : null, free: !!(W.S.free || {})[x.key] })), note: (document.querySelector('.go-rescue.done .gr-k') || {}).textContent }; });
    const startedKept = before.filter(b0 => b0.started && b0.n).every(b0 => after.slots.find(a0 => a0.slot === b0.slot).n === b0.n);
    t.ok(startedKept, 'rain rescue leaves what has already started alone');
    const laterOut = after.slots.filter((a0, i) => !before[i].started && a0.n && a0.indoor === false && !/breakfast|lunch|dinner/.test(a0.slot));
    t.eq(laterOut.map(x => x.n), [], 'no outdoor outing is left in the rest of the day: ' + JSON.stringify(after.slots));
    t.ok(/Plan B for the rain/.test(after.note || ''), 'and the screen says what it did: ' + after.note);
    await pg.click('[data-unrescue]'); await pg.waitForTimeout(700);
    const undone = await pg.evaluate(() => W.P.days[W.S.day - 1].slots.map(x => ({ n: x.item ? x.item.n : null, free: !!(W.S.free || {})[x.key] })));
    /* every place that was on the day is back and nothing stays freed; a slot that was empty (no idea fitted it yet) may
       fill from the ideas the rescue asked for meanwhile */
    t.eq(undone.map((u, i) => before[i].n ? u.n : u.free ? 'freed' : 'ok'), before.map(b0 => b0.n || 'ok'), 'undo brings the day back: ' + JSON.stringify(undone));
  } else t.note('no rescue control on this day');
  if (await pg.$('.go-eve [data-goprev]')) { await pg.click('.go-eve [data-goprev]'); await pg.waitForTimeout(800); t.ok(await pg.evaluate(() => !!document.querySelector('[data-gotoday]')), 'another day shows a way back to today'); await pg.click('[data-gotoday]'); await pg.waitForTimeout(400); }
  await pg.click('.go-foot [data-appmode="plan"]'); await pg.waitForTimeout(900);
  t.ok(await pg.evaluate(() => !document.documentElement.classList.contains('travel')), 'the Today footer can turn Travel mode off');
  /* Today's map: the lettered pins only. No line from pin to pin (a straight line is a flight path, not the way you walk) */
  const vt = await pg.evaluate(() => fetch('lib/vtmap.js').then(r => r.text()));
  t.ok(vt.length > 20000 && !/id: "route/.test(vt) && !/route: \{ type: "geojson"/.test(vt) && !/getSource\("route"\)/.test(vt) && /pinEl\(/.test(vt), 'the street map draws the day\'s pins and no line between them (no route layer, no route source)');
  t.eq(errors(), [], 'no page errors');
  await ctx.close();

  /* Today while you are at a stop (v148): now and next in one card, with the screen's one main button the way to
     what is next; the route right under it; the rest of the day's jobs folded to a line each; and on the Trip tab
     today's day is one line, opened at the stop you are at */
  {
    const o = await open(b, { width: 390, height: 844, db: mkdb(), touch: true }); await exampleTrip(o.pg); await settle(o.pg, 6000);
    const pin = await o.pg.evaluate(async () => {
      W.S.travelers = [38, 36, 7, 4]; W.replan(); const P = W.plan(), d = P.days[1], T = W.dayTimes(d, P);
      const rows = T.order.map(sl => ({ R: T.rows[sl], x: d.slots.find(y => y.slot === sl) })).filter(r => r.x && r.x.item && r.R && !r.R.skip && r.R.start != null);
      const cur = rows[1], nxt = rows[2], mid = cur.R.start + 25, two = v => String(v).padStart(2, '0');
      localStorage.setItem('waypoint-now', W.isoDay(W.dateOf(2)) + 'T' + two(Math.floor(mid / 60)) + ':' + two(mid % 60) + ':00');
      W.needLater(); W.goView('go'); W.render(); for (let i = 0; i < 40 && !W.laterReady; i++) await new Promise(r => setTimeout(r, 150)); await new Promise(r => setTimeout(r, 700)); W.render();
      return { cur: cur.x.item.n, nxt: nxt.x.item.n, nxtFood: W.isFood(nxt.x.slot), today: W.todayN(W.plan()) };
    });
    const c = await o.pg.evaluate(() => {
      const v = document.querySelector('#viewGo'), hero = v.querySelector('.go-hero'), nx = hero && hero.querySelector('.gh-next'), go = nx && nx.querySelector('a.gh-go'), here = hero && hero.querySelector('a.gh-here');
      const top = e => e ? Math.round(e.getBoundingClientRect().top + scrollY) : -1, shown = e => !!e && e.checkVisibility();
      const dest = a => a ? decodeURIComponent((a.href.match(/destination=([^&]+)/) || [])[1] || '') : '';
      return { isNow: !!hero && hero.classList.contains('is-now'), h2: hero ? hero.querySelector('h2').textContent : '', nextName: nx ? nx.querySelector('.ghn-n').textContent : '', goText: go ? go.textContent.trim() : '', leave: nx ? (nx.querySelector('.leave') || {}).textContent : '',
        goOrigin: go ? /origin=/.test(go.href) : null, hereOrigin: here ? /origin=/.test(here.href) : null, goDest: dest(go), hereDest: dest(here), hereText: here ? here.textContent.trim() : '',
        mains: hero ? hero.querySelectorAll('a.btn:not(.quiet), button.btn:not(.quiet)').length : -1, after: !!v.querySelector('.go-next'),
        order: [top(hero), top(v.querySelector('.go-route')), top(v.querySelector('.go-late')), top(v.querySelector('.go-kids'))], rescue: !!v.querySelector('.go-rescue'), plans: !!v.querySelector('[data-goplans]'),
        late: (l => { if (!l) return null; const q = l.querySelector('.gl-q').getBoundingClientRect(), cs = [...l.querySelectorAll('.gl-b > .chip')].map(x => x.getBoundingClientRect()); return { q: l.querySelector('.gl-q').textContent, n: cs.length, row: cs.every(x => Math.abs(x.top - cs[0].top) < 2), above: q.bottom <= cs[0].top + 1, fits: cs[cs.length - 1].right <= innerWidth - 8 && cs[0].left >= 8, labels: [...l.querySelectorAll('.gl-b > .chip')].map(x => x.textContent.trim()) }; })(v.querySelector('.go-late')),
        bag: (b => b ? { open: b.open, meta: b.querySelector('summary .muted').textContent } : null)(v.querySelector('details.go-fold[data-gofold="bag"]')), journal: (j => j ? { open: j.open } : null)(v.querySelector('details.go-fold[data-gofold="journal"]')),
        topHidden: !shown(v.querySelector('.go-top')), navShown: shown(v.querySelector('.go-nav')), banner: (document.querySelector('#topline .tl-day') || {}).textContent || '', bannerGo: (document.querySelector('#topline .tl-go') || {}).href || '',
        legs: [...v.querySelectorAll('.go-rt .rc-leg a')].map(a => a.textContent.replace(/[^A-Za-z]/g, '')), near: [...v.querySelectorAll('.go-near .nr-go')].map(a => a.textContent.trim()), nearH: [...v.querySelectorAll('.go-near .nr-b .btn')].map(a => Math.round(a.getBoundingClientRect().height)), nearGap: (r => r && r.children.length > 1 ? Math.round(r.children[1].getBoundingClientRect().left - r.children[0].getBoundingClientRect().right) : 12)(v.querySelector('.go-near .nr-b')), kidsChip: !!v.querySelector('.kids-chip') };
    });
    t.ok(pin.today === 2 && c.isNow && c.h2 === pin.cur && c.nextName === pin.nxt && !c.after, 'at a stop, Today shows now and next in one card: ' + c.h2 + ' → ' + c.nextName);
    t.ok(/^Directions to /.test(c.goText) && (!pin.nxtFood || /^Directions to (lunch|dinner|breakfast)$/.test(c.goText)) && c.mains === 1 && /Leave (in|by)|Time to go/.test(c.leave || ''), 'the one main button there is the way to what is next ("' + c.goText + '"), with when to leave: ' + c.leave);
    t.ok(c.goOrigin === false && c.hereOrigin === false && c.goDest && c.hereDest && c.goDest !== c.hereDest && c.hereText === 'Directions here', 'directions start where you are (no starting point sent), to the next stop; "Directions here" is a quiet link to the one you are at, not from it to itself');
    t.ok(c.order[0] < c.order[1] && c.order[1] < c.order[2] && c.order[2] < c.order[3] && !c.rescue && c.plans && !c.kidsChip, 'then the route, then running late and change of plans, and the kids\' corner as a quiet row further down: ' + JSON.stringify(c.order));
    t.ok(c.late && c.late.q === 'Running late?' && c.late.above && c.late.n === 3 && c.late.row && c.late.fits && c.late.labels.join('|') === '+15 min|+30 min|Change of plans', '"Running late?" sits above its three answers, in one row: ' + JSON.stringify(c.late));
    t.ok(c.bag && !c.bag.open && /(\d+ of \d+ packed|All packed)/.test(c.bag.meta) && c.journal && !c.journal.open, 'out and about, the day bag and the journal are one line each: ' + JSON.stringify([c.bag, c.journal]));
    await o.pg.click('#viewGo details.go-fold[data-gofold="bag"] summary'); await o.pg.waitForTimeout(250);
    const bagOpen = await o.pg.evaluate(async () => { W.render(); await new Promise(r => setTimeout(r, 200)); const b2 = document.querySelector('#viewGo details.go-fold[data-gofold="bag"]'); return b2.open && !!b2.querySelector('.gb-l') && !b2.querySelector('.gb-h').checkVisibility(); });
    t.ok(bagOpen, 'a tap opens the day bag in place (one heading, not two), and it stays open when the screen draws again');
    t.ok(c.topHidden && c.navShown && /Rome/.test(c.banner) && /\d:\d\d/.test(c.banner) && /^https:\/\/www\.google\.com\/maps\/dir\//.test(c.bannerGo), 'on a phone the banner carries today (city, date, the time, the whole route), and the days before and after are at the foot: ' + c.banner);
    t.ok(c.legs.length >= 2 && c.legs.every(x => x === 'Navigate') && c.near.length && c.near.every(x => x === 'Directions') && c.nearH.every(h => h >= 44) && c.nearGap >= 12, 'one name for each: "Navigate" from one stop to the next, "Directions" to one place; buttons in a row are 44px on a touch screen: ' + JSON.stringify([c.legs[0], c.near[0], c.nearH[0]]));
    /* the tab of the screen you are on goes back to its top */
    await o.pg.evaluate(() => scrollTo(0, 900)); await o.pg.waitForTimeout(150); await o.pg.click('#tabGo'); await o.pg.waitForFunction(() => scrollY < 5, null, { timeout: 3000 }).catch(() => {});
    t.ok(await o.pg.evaluate(() => scrollY < 5 && W.view() === 'go'), 'tapping the tab you are on goes back to the top of its screen');
    /* the Trip tab on the day itself */
    await o.pg.click('#tabTrip'); await o.pg.waitForTimeout(1600);
    const dv = await o.pg.evaluate(() => { const v = document.querySelector('#viewTrip'), row = v.querySelector('.today-row'), now = v.querySelector('.slots .slot.is-now'), r = now && now.getBoundingClientRect(), sn = v.querySelector('.short-note');
      return { row: row ? row.textContent.replace(/\s+/g, ' ').trim() : '', rowH: row ? Math.round(row.getBoundingClientRect().height) : 0, old: !!v.querySelector('section.today, .now-l, .today-h'), past: v.querySelectorAll('.slots .slot.past').length, pastDim: (p => p ? +getComputedStyle(p).opacity : 1)(v.querySelector('.slots .slot.past')), now: now ? now.querySelector('.nm').textContent : '', tag: now ? (now.querySelector('.now-tag') || {}).textContent : '', top: r ? Math.round(r.top) : -1, y: Math.round(scrollY), dpill: Math.round(v.querySelector('.dpill').getBoundingClientRect().height), sn: sn ? !!sn.closest('article.slot.free') : null }; });
    t.ok(/^Now /.test(dv.row) && dv.row.indexOf(pin.cur) > 0 && /until \d/.test(dv.row) && /Today/.test(dv.row) && dv.rowH <= 70 && !dv.old, 'on the Trip tab today is one line, not a box: "' + dv.row + '" (' + dv.rowH + 'px)');
    t.ok(dv.past >= 1 && dv.pastDim < 0.8 && dv.now === pin.cur && dv.tag === 'Now', 'what is over is dimmed, and the stop you are at is marked "Now"');
    t.ok(dv.y > 100 && dv.top > 60 && dv.top < 844 * 0.5, 'and the day opens at that stop, not at a morning that is over (scrolled ' + dv.y + 'px, the stop ' + dv.top + 'px down)');
    t.ok(dv.dpill >= 44 && dv.sn !== false, 'day numbers are 44px on a touch screen');
    await o.pg.evaluate(() => scrollTo(0, 0)); await o.pg.click('#viewTrip .today-row'); await o.pg.waitForTimeout(900);
    t.ok(await o.pg.evaluate(() => W.view() === 'go'), 'the line opens Today');
    t.eq(o.errors(), [], 'no page errors (now and next)');
    await o.ctx.close();
  }

  /* near you, on Today: the closest ideas to where the plan has you; in the installed app, to your phone's location */
  {
    const { pg: p2, ctx: c2, errors: e2 } = await open(b, { width: 390, height: 844, init: () => { try { localStorage.setItem('waypoint-now', '2027-06-08T12:10:00'); } catch (e) {} } });
    await exampleTrip(p2); await p2.evaluate(() => W.goView('go')); await settle(p2, 3000);
    const n1 = await p2.evaluate(() => { const c = document.querySelector('#viewGo .go-near'); if (!c) return null; const rows = [...c.querySelectorAll('.nr')];
      return { h: c.querySelector('h3').textContent, loc: !!c.querySelector('[data-nearme]'), food: c.querySelector('[data-neartab="food"]').getAttribute('aria-pressed'), n: rows.length, go: rows.every(r => /^https:\/\/www\.google\.com\/maps\/dir\//.test(r.querySelector('.nr-go').href)), dist: rows.map(r => parseFloat(r.querySelector('.small').textContent) * (/ km/.test(r.querySelector('.small').textContent) ? 1000 : 1)) }; });
    t.ok(n1 && /^Near /.test(n1.h) && !n1.loc && n1.food === 'true' && n1.n >= 3 && n1.go && n1.dist.every((d, i) => !i || d >= n1.dist[i - 1]), 'Today shows food near where the plan has you at lunchtime, closest first, each with Go (no location button inside Claude): ' + JSON.stringify(n1));
    await p2.click('#viewGo [data-neartab="do"]'); await p2.waitForTimeout(300);
    t.ok(await p2.evaluate(() => document.querySelector('#viewGo [data-neartab="do"]').getAttribute('aria-pressed') === 'true' && document.querySelectorAll('#viewGo .go-near .nr').length > 0), 'and things to do one tap away');
    /* the installed app: your phone's location */
    await c2.grantPermissions(['geolocation']); await c2.setGeolocation({ latitude: 41.8986, longitude: 12.4769 });
    await p2.evaluate(() => { W.standalone = true; W.render(); }); await p2.waitForTimeout(300);
    await p2.click('#viewGo [data-nearme]'); await p2.waitForFunction(() => /^Near you/.test((document.querySelector('#viewGo .go-near h3') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    const n2 = await p2.evaluate(() => { const c = document.querySelector('#viewGo .go-near'); const r = c.querySelector('.nr'); return { h: c.querySelector('h3').textContent, note: c.textContent.indexOf('used on this phone only') > -1, first: r && r.querySelector('.small').textContent, href: r && r.querySelector('.nr-go').href, add: !!c.querySelector('[data-nearadd]') }; });
    t.ok(/^Near you/.test(n2.h) && n2.note && /\d+ m · \d+ min walk/.test(n2.first || '') && !/origin=/.test(n2.href || ''), 'the installed app finds you: ideas near your phone, Go starts where you are, and it says the location stays on the phone: ' + JSON.stringify(n2));
    /* Add puts it in a free part of today */
    const ad = await p2.evaluate(async () => { { const d = W.P.days[W.S.day - 1], x = d.slots.find(y => y.slot === 'dinner'); (W.S.free = W.S.free || {})[x.key] = 1; delete (W.S.picks || {})[x.key]; W.render(); await new Promise(r => setTimeout(r, 300)); }
      const b = document.querySelector('#viewGo [data-nearadd]'); if (!b) return null; const slot = b.dataset.nearadd, name = b.dataset.name; b.click(); await new Promise(r => setTimeout(r, 400)); const d = W.P.days[W.S.day - 1]; const x = d.slots.find(y => y.slot === slot); return { name, got: x && x.item && x.item.n, undo: !!document.querySelector('[data-undo]') }; });
    t.ok(ad && ad.got === ad.name && ad.undo, 'Add puts it in today\'s free time, with undo: ' + JSON.stringify(ad));
    t.eq(e2(), [], 'no page errors on Today\'s near you');
    await c2.close();
  }
  await b.close();
};
