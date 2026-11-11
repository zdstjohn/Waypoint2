/* Settings > A copy of your trips: every trip on the device saved to one file, and trips brought back from such a file
   on another device. A trip the device already has is never overwritten; a file from outside is checked like a shared
   trip (a link that is not a web link is dropped); a file that is something else is refused. */
const { launch, open, exampleTrip, settle, until } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const A = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(A.pg);
  await A.pg.evaluate(() => {
    W.S.tripName = 'Italy to keep'; W.S.booked = { 'x|y': 1 }; W.S.journal = { 'Italy|Rome|1': { note: 'Gelato twice', photos: [] } }; W.S.share = 'abcdefghjkmn'; W.save(); W.changed();
    /* what the page is asked to save (the test keeps the file's text instead of a download) */
    window.__saved = null; const use = window.claude.use.bind(window.claude);
    window.claude.use = n => n === 'downloads' ? Promise.resolve({ save: async o => { window.__saved = { name: o.filename, text: await o.data.text() }; } }) : use(n);
    W.needLater(); W.goView('settings');
  });
  await A.pg.waitForFunction(() => !!document.querySelector('#set-copy [data-trips="save"]'), null, { timeout: 15000 });
  await A.pg.click('#set-copy [data-trips="save"]');
  const saved = await until(() => A.pg.evaluate(() => window.__saved));
  const doc = saved && JSON.parse(saved.text), mine = doc && doc.trips.find(x => x.name === 'Italy to keep');
  t.ok(saved && /^Waypoint trips \d{4}-\d\d-\d\d\.json$/.test(saved.name) && doc.app === 'Waypoint' && doc.kind === 'trips' && mine && mine.state.journal['Italy|Rome|1'].note === 'Gelato twice' && mine.state.booked['x|y'] === 1,
    'Save a copy writes one file with the trip, its bookings and its journal notes: ' + (saved && saved.name));
  t.ok(/Saved 1 trip as Waypoint trips/.test(await A.pg.textContent('#tripsMsg')), 'and says what it saved');
  /* another device (another person's phone, or this one after a reset) */
  const B = await open(b, { width: 390, height: 844, db: mkdb(), uid: 'u-two' }); await settle(B.pg);
  await B.pg.evaluate(() => { W.needLater(); W.goView('settings'); });
  await B.pg.waitForFunction(() => !!document.querySelector('#tripsFile'), null, { timeout: 15000 });
  /* the file comes from outside: a link that is not a web link, and the share code it was saved with, do not come in */
  mine.state.stays = { 'Italy|Rome': { label: 'Hotel', lat: 41.9, lng: 12.5, live: { src: 'Booking.com', url: 'javascript:alert(1)' } } };
  const give = (pg, text) => pg.setInputFiles('#tripsFile', { name: 'trips.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await give(B.pg, JSON.stringify(doc));
  await B.pg.waitForFunction(() => /Added 1 trip/.test((document.querySelector('#tripsMsg') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
  const got = await B.pg.evaluate(id => { const all = JSON.parse(localStorage.getItem('waypoint-trips-v1') || '{}'), x = all[id]; return { msg: document.querySelector('#tripsMsg').textContent, name: x && x.name, note: x && x.state.journal['Italy|Rome|1'].note, url: x && x.state.stays['Italy|Rome'].live.url, share: x && x.state.share, n: Object.keys(all).length }; }, mine.id);
  t.ok(/Added 1 trip/.test(got.msg) && got.name === 'Italy to keep' && got.note === 'Gelato twice', 'Open a saved copy adds the trip on another device: ' + JSON.stringify(got));
  t.ok(!got.url && !got.share, 'checked on the way in: a link that is not a web link is dropped, and the copy is not shared');
  await give(B.pg, JSON.stringify(doc));
  await B.pg.waitForFunction(() => /already on this device/.test(document.querySelector('#tripsMsg').textContent), null, { timeout: 8000 }).catch(() => {});
  t.ok(await B.pg.evaluate(n => /already on this device/.test(document.querySelector('#tripsMsg').textContent) && Object.keys(JSON.parse(localStorage.getItem('waypoint-trips-v1'))).length === n, got.n), 'opening the same file again adds nothing and overwrites nothing');
  await give(B.pg, '{"hello":"world"}');
  await B.pg.waitForFunction(() => /not a copy of Waypoint trips/.test(document.querySelector('#tripsMsg').textContent), null, { timeout: 8000 }).catch(() => {});
  await give(B.pg, 'not json at all');
  await B.pg.waitForTimeout(400);
  t.ok(await B.pg.evaluate(() => /not a copy of Waypoint trips/.test(document.querySelector('#tripsMsg').textContent)), 'a file that is something else is refused, with a plain message');
  /* the trip opens from the list under the trip name */
  const opened = await B.pg.evaluate(async id => {
    if (!document.querySelector('.trip-menu')) document.querySelector('[data-sync="menu"]').click(); await new Promise(r => setTimeout(r, 500));
    const row = document.querySelector('.trip-menu [data-sync="open"][data-id="' + id + '"]'); if (!row) return { row: false };
    row.click(); await new Promise(r => setTimeout(r, 1000));
    return { row: true, name: W.tripName(), id: W.S.tripId, note: ((W.S.journal || {})['Italy|Rome|1'] || {}).note, rome: !!(W.P && W.P.days.some(d => d.city === 'Rome')) };
  }, mine.id);
  t.ok(opened.row && opened.name === 'Italy to keep' && opened.id === mine.id && opened.note === 'Gelato twice' && opened.rome, 'the trip is in the list under the trip name and opens with its plan and notes: ' + JSON.stringify(opened));
  t.eq(A.errors().concat(B.errors()), [], 'no page errors');
  await A.ctx.close(); await B.ctx.close(); await b.close();
};
