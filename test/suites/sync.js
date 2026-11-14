/* Saved trips: the trips menu, renaming, a second trip and switching back. */
const { launch, open, exampleTrip, settle, calm } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const base = mkdb(), ops = []; const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: (o, p, x) => { ops.push(o + ' ' + p); return base(o, p, x); } }); await exampleTrip(pg);
  await pg.click('[data-sync="menu"]'); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(() => !!document.querySelector('.trip-menu')), 'the trips menu opens');
  const mm = await pg.evaluate(() => { const m = document.querySelector('.trip-menu'); m.scrollTop = m.scrollHeight; const bg = getComputedStyle(m).backgroundColor, a = (bg.match(/rgba?\(([^)]+)\)/) || ['', '0,0,0,0'])[1].split(',').map(Number); const r = { scrolls: m.scrollHeight > m.clientHeight, opaque: a.length === 3 || a[3] === 1, bg }; m.scrollTop = 0; return r; });
  t.ok(mm.opaque, `the trips menu has a solid background all the way down when scrolled, so the page never shows through (${mm.bg}, scrolls: ${mm.scrolls})`);
  await pg.click('[data-sync="rename"]'); await pg.fill('#tripNameIn', 'Italy with the kids'); await pg.click('[data-sync="savename"]'); await pg.waitForTimeout(600);
  t.eq(await pg.evaluate(() => W.tripName()), 'Italy with the kids', 'renaming the trip');
  await pg.evaluate(() => { const m = document.querySelector('.trip-menu'); if (!m) document.querySelector('[data-sync="menu"]').click(); }); await pg.waitForTimeout(300);
  await pg.click('[data-sync="new"]'); await pg.waitForTimeout(500);
  t.ok(await pg.evaluate(() => !!document.querySelector('.qs')), 'a new trip opens quick start');
  await pg.click('[data-qs="slow"]'); await pg.waitForTimeout(800);
  t.ok(await pg.evaluate(() => W.view() === 'setup' && W.tripName() !== 'Italy with the kids'), 'skipping quick start lands on Setup for the new trip');
  await pg.click('[data-sync="menu"]'); await pg.waitForTimeout(400);
  const names = await pg.evaluate(() => [...document.querySelectorAll('.trips li')].map(l => l.innerText.replace(/\s+/g, ' ').trim()));
  t.ok(names.length >= 2 && names.some(n => /Italy with the kids/.test(n)), 'both trips are listed: ' + JSON.stringify(names));
  await pg.click('.trips li [data-sync="open"]:has-text("Italy with the kids")'); await calm(pg, 4000);
  t.ok(await pg.evaluate(() => W.tripName() === 'Italy with the kids' && W.P.days.length === 10), 'opening the first trip brings its 10 days back');
  /* errors on the phone go to the viewer's own private log (one document a day): the message, where, which screen and
     build, the browser; a repeat only counts up; a connection the viewer didn't allow is not an error */
  const dayName = n => { const d = new Date(Date.now() - n * 864e5); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  [45, 31, 10].forEach(n => base('set', 'data/users/u-test/errlog/d/' + dayName(n), JSON.stringify({ items: [{ msg: 'old', at: 'x', n: 1 }], updated: 1 })));
  const el = await pg.evaluate(async () => {
    const boom = () => window.dispatchEvent(new ErrorEvent('error', { message: 'Test boom', filename: 'http://x/app.js', lineno: 1, colno: 99, error: new Error('Test boom') }));
    boom(); boom();
    window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: { code: 'not_granted' } }));
    W.flushErrors(); await new Promise(r => setTimeout(r, 600));
    const d = new Date(), day = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    const doc = JSON.parse(await window.__dbOp('get', 'data/users/u-test/errlog/d/' + day, null) || 'null');
    return doc && doc.items;
  });
  const it0 = el && el.find(x => x.msg === 'Test boom');
  t.ok(it0 && it0.n === 2 && it0.at === 'app.js:1:99' && it0.build && it0.view && el.length === 1 && !/http/.test(it0.stack), `errors go to the viewer's private log, repeats counted (${it0 && JSON.stringify({ n: it0.n, at: it0.at, view: it0.view, build: it0.build, ua: it0.ua })})`);
  /* (v201) the daily tidy (lib/tidy.js, in the second script) deletes the days of the log older than 30 */
  await pg.waitForFunction(() => W.laterReady && W.tidyErrors, null, { timeout: 15000 }); await pg.evaluate(() => W.tidyErrors());
  const left = [45, 31, 10].map(n => base('get', 'data/users/u-test/errlog/d/' + dayName(n)) != null);
  t.eq(left, [false, false, true], 'the error log keeps 30 days: older days are deleted when a new day is written');
  /* a device that can't save says so, and clears nothing */
  const full = await pg.evaluate(() => {
    const real = Storage.prototype.setItem; Storage.prototype.setItem = function () { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; };
    W.S.tripName = 'Full test'; W.save(); const on = !!W.localFull, kept = !!localStorage.getItem('waypoint-cache-v2');
    Storage.prototype.setItem = real; W.S.tripName = 'Full test 2'; W.save();
    return { on, kept, off: !W.localFull };
  });
  t.ok(full.on && full.kept && full.off, 'a refused save is flagged (and nothing cleared), and the flag goes when saving works again: ' + JSON.stringify(full));
  /* two of your devices: each side's own changes survive; the same slot changed on both goes to the other (later) one */
  const m3 = await pg.evaluate(() => {
    const base = { days: 10, start: '2027-06-07', picks: { a: 'Cafe 1', b: 'Museum', c: 'Park' }, free: {}, stays: { 'Italy|Rome': { label: 'Hotel A' } } };
    const mine = JSON.parse(JSON.stringify(base)); mine.picks.a = 'Cafe 9'; mine.picks.c = 'Zoo'; mine.free.d = 1; mine.start = '2027-06-08'; delete mine.picks.b;
    const theirs = JSON.parse(JSON.stringify(base)); theirs.picks.c = 'Garden'; theirs.days = 12; theirs.stays['Italy|Rome'] = { label: 'Hotel B' }; theirs.picks.e = 'Market';
    const r = W.merge3(base, mine, theirs), none = W.merge3(base, base, theirs);
    return { s: r.state, changed: r.changed, none: none.changed, noneSame: JSON.stringify(none.state) === JSON.stringify(theirs) };
  });
  t.ok(m3.s.picks.a === 'Cafe 9' && m3.s.picks.c === 'Garden' && !('b' in m3.s.picks) && m3.s.picks.e === 'Market' && m3.s.free.d === 1 && m3.s.start === '2027-06-08' && m3.s.days === 12 && m3.s.stays['Italy|Rome'].label === 'Hotel B' && m3.changed,
    'your changes here and theirs there are joined (the same slot changed on both: theirs): ' + JSON.stringify(m3.s.picks));
  t.ok(!m3.none && m3.noneSame, 'with nothing changed here, theirs is taken as it is');
  /* (v201, the tests audit) the newer change wins, whichever copy comes first: a break here used to show only in the devices suite */
  const nw = await pg.evaluate(() => { const at = (ms, dev) => ms.toString(36).padStart(9, '0') + dev;
    const A = { days: 10, picks: { a: 'Old cafe', b: 'Only here' }, ct: { 'picks::a': at(1000, 'dA'), 'picks::b': at(1000, 'dA'), days: at(5000, 'dA') } };
    const B = { days: 12, picks: { a: 'New cafe' }, ct: { 'picks::a': at(2000, 'dB'), 'picks::b': at(3000, 'dB'), days: at(4000, 'dB') } };   /* B: a newer pick for a; b taken away later than A set it; days older than A's */
    const ab = W.syncJoin(A, B), ba = W.syncJoin(B, A), pick = j => j.picks || {};
    return { ab: { a: pick(ab).a, b: pick(ab).b, days: ab.days, ct: ab.ct }, ba: { a: pick(ba).a, b: pick(ba).b, days: ba.days }, same: JSON.stringify(ab) === JSON.stringify(ba) }; });
  t.ok(nw.ab.a === 'New cafe' && nw.ba.a === 'New cafe', 'two copies changed one slot: the later change wins, in whichever order they are joined: ' + JSON.stringify([nw.ab.a, nw.ba.a]));
  t.ok(nw.ab.b === undefined && nw.ba.b === undefined, 'a choice taken away after it was made stays away (the removal is the newer change)');
  t.ok(nw.ab.days === 10 && nw.ba.days === 10, 'and an older change does not undo a newer one: days 10 (stamped 5000) beat days 12 (4000)');
  t.ok(nw.same && nw.ab.ct['picks::a'] === (1000 * 0 + 2000).toString(36).padStart(9, '0') + 'dB', 'both orders give the same trip, carrying the winning stamp');
  /* (v181) the stamps of things taken away a month ago go; newer ones and those of things still there stay */
  const pr = await pg.evaluate(() => { const at = d => (Date.now() - d * 864e5).toString(36).padStart(9, '0') + 'dX';
    const st = { days: 3, picks: { a: { n: 'A' } }, ct: { 'picks::gone': at(40), 'picks::gone2': at(1), 'picks::a': at(40) } };
    const n = W.syncPrune(st, 30); return { n, keys: Object.keys(st.ct).sort() }; });
  t.eq(pr, { n: 1, keys: ['picks::a', 'picks::gone2'] }, 'a removal\'s stamp goes after 30 days; a newer one, and one for something still there, stay');
  /* (v181) an edit found minutes after its tap (the app suspended before it saved) is still a person's change */
  await pg.mouse.click(5, 300); await pg.waitForTimeout(150);
  const late = await pg.evaluate(() => { const real = Date.now; Date.now = () => real() + 5 * 60000;
    try { W.S.styles = (W.S.styles || []).concat(['zz-late-edit']); W.save(); return !!(W.S.ct && W.S.ct.styles); } finally { Date.now = real; W.S.styles = W.S.styles.filter(x => x !== 'zz-late-edit'); W.save(); } });
  t.ok(late, 'an edit saved five minutes after its tap gets its stamp');
  /* (v201) the account's copy already came with the snapshot and is joined in as it comes: an edit is one write, not a read and a write */
  await pg.waitForTimeout(3000); ops.length = 0;
  await pg.evaluate(() => { W.S.styles = (W.S.styles || []).concat(['zz-one-write']); W.save(); });
  await pg.waitForTimeout(4500);
  const tripOps = ops.filter(o => /data\/users\/u-test\/trips\/t\/[^/]+$/.test(o));
  t.ok(tripOps.some(o => o.startsWith('set ')) && !tripOps.some(o => o.startsWith('get ')), 'an edit of a trip the account already showed is written without reading it first: ' + JSON.stringify(tripOps));
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
