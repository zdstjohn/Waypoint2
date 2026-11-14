/* Photo packs (v198): a city's photos in one file (tools/photopack.js makes one, lib/photopack.js reads it). A pack is
   read back exactly, and anything that is not one is refused; a photo with no file of its own (pk) shows from its
   city's pack, fetched once and then kept on the phone; saving a trip for offline takes a city's photos from its pack
   in one request; and a library city is saved to the phone before any trip goes there (Settings, World library).
   Pictures are drawn by test/py/make_fixtures.py and served by test/lib/photofix.js. */
const path = require('path'); const fs = require('fs'); const os = require('os');
const { launch, open, exampleTrip, settle, until } = require('../lib/page'); const mkdb = require('../lib/db'); const fx = require('../lib/photofix');
const ROOT = path.resolve(__dirname, '..', '..');
const PK = require('../../tools/photopack.js');
const REC = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'mocks', 'world-spain-granada.json'), 'utf8'));
exports.run = async t => {
  const man = fx.make(path.join(ROOT, '.photoset-fx'), 4);
  const u = f => '/_blob/' + fx.idOf(f);
  t.ok(fs.readFileSync(path.join(ROOT, 'trip', 'tools', 'photopack.js.txt'), 'utf8') === fs.readFileSync(path.join(ROOT, 'tools', 'photopack.js'), 'utf8'),
    "the tool's published copy (trip/tools/photopack.js.txt), which a nightly task reads, is the same as tools/photopack.js");
  /* ---- the tool: a pack reads back, and what is not a pack is refused ---- */
  const pics = man.map(e => ({ url: u(e.jpg), type: 'image/webp', bytes: fs.readFileSync(e.webp) }));
  const buf = PK.pack('italy-rome', '2026-11-14', pics), back = PK.read(buf);
  t.ok(back && back.slug === 'italy-rome' && back.items.length === 4 && back.items.every((it, i) => it.url === pics[i].url && buf.subarray(it.start, it.end).equals(pics[i].bytes)),
    'a pack reads back: every picture, byte for byte, under its photo\'s own address');
  const cut = buf.subarray(0, buf.length - 10), twice = PK.pack('x', '2026-11-14', [pics[0], pics[0]]);
  const odd = Buffer.from(buf); odd.write('image/html', odd.indexOf('image/webp'));
  t.ok(PK.read(cut) === null && PK.read(twice) === null && PK.read(odd) === null && PK.read(Buffer.from('WPPK1\n')) === null && PK.read(Buffer.from('<html>not a pack</html>')) === null,
    'a pack cut short, one naming a picture twice, one holding something that is not a picture, and a page that is not a pack are all refused');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-photopack-')), files = path.join(tmp, 'files'); fs.mkdirSync(files);
  /* the city's files as the nightly run has them: by id. Photo 0 has a WebP twin (it goes in), photo 1 only its JPEG,
     photo 2 is a "nearby" stand-in (left out), photo 3's file is missing, and one "picture" is a web page */
  fs.copyFileSync(man[0].webp, path.join(files, fx.idOf(man[0].webp) + '.webp')); fs.copyFileSync(man[0].jpg, path.join(files, fx.idOf(man[0].jpg) + '.jpg'));
  fs.copyFileSync(man[1].jpg, path.join(files, fx.idOf(man[1].jpg)));
  fs.copyFileSync(man[2].jpg, path.join(files, fx.idOf(man[2].jpg) + '.jpg'));
  fs.writeFileSync(path.join(files, 'e'.repeat(32) + '.jpg'), '<html>sign in</html>');
  fs.writeFileSync(path.join(tmp, 'italy-rome.json'), JSON.stringify({ data: { city: 'Rome', items: {
    colosseum: fx.record(man[0], 'new'), pantheon: fx.record(man[1], 'old'), 'near the forum': fx.record(man[2], 'old', { near: 'Roman Forum' }),
    'trevi fountain': fx.record(man[3], 'old'), 'a page': { url: '/_blob/' + 'e'.repeat(32) } } } }));
  const built = PK.build(path.join(tmp, 'italy-rome.json'), files, path.join(tmp, 'out.wpp')), chk = PK.check(path.join(tmp, 'out.wpp'), path.join(tmp, 'italy-rome.json'));
  const made = PK.read(fs.readFileSync(path.join(tmp, 'out.wpp')));
  t.ok(built.n === 2 && built.slug === 'italy-rome' && built.missing.join() === 'trevi fountain' && built.skipped.join() === 'a page' && chk && chk.n === 2 && chk.lacks === 2,
    'built from a city\'s files: its own photos go in, a stand-in from nearby does not, a missing file and a page that is not a picture are named: ' + JSON.stringify(built));
  t.ok(made && made.items[0].url === u(man[0].jpg) && made.items[0].type === 'image/webp' && made.items[1].type === 'image/jpeg',
    'a photo goes in as its WebP when it has one (the smallest good copy), named by its own address; else as its JPEG');

  /* ---- the app ---- */
  /* Granada, from the library's record: four of its places have a photo. Two have no file of their own (pk: only the
     pack has them), two have files as before. The pack holds all four. */
  const names = ['alhambra and nasrid palaces', 'granada cathedral and royal chapel', 'parque de las ciencias', 'mirador de san nicolas'];
  const gpics = man.map(e => ({ url: u(e.jpg), type: 'image/webp', bytes: fs.readFileSync(e.webp) }));
  const PACK_ID = 'f'.repeat(32), gpack = PK.pack('spain-granada', '2026-11-14', gpics);
  const items = pk => Object.fromEntries(names.map((n, i) => [n, pk && i < 2 ? Object.assign(fx.record(man[i], 'old'), { pk: 1, lq: man[i].lq }) : fx.record(man[i], 'old')]));
  const INDEX = { v: 1, at: '2026-11-14', cities: { 'spain-granada': { n: 'Granada', c: 'Spain', p: 30, at: '2026-11-13' } } };
  const seed = pk => ({ 'world/spain-granada': REC, 'world/_index': INDEX, 'photos/spain-granada': { city: 'Granada', country: 'Spain', items: items(pk), pack: { url: '/_blob/' + PACK_ID, n: 4, bytes: gpack.length, at: '2026-11-14' } } });
  const b = await launch();
  /* pk: the first two photos have no file of their own (their addresses answer "not found": only the pack has them) */
  const start = async pk => {
    const A = await open(b, { width: 390, height: 844, db: mkdb(seed(pk)) });
    /* (hold: the pack's answer waits until the test lets it go, to look at the page while it is on its way) */
    const stats = await fx.serve(A.ctx, man); const packs = { n: 0, hold: null };
    await A.ctx.route(/\/_blob\/[0-9a-f]{32}/, async route => {
      const id = /\/_blob\/([0-9a-f]{32})/.exec(route.request().url())[1];
      if (id === PACK_ID) { packs.n++; if (packs.hold) await packs.hold; return route.fulfill({ status: 200, body: gpack, contentType: 'application/octet-stream' }); }
      if (pk && (id === fx.idOf(man[0].jpg) || id === fx.idOf(man[1].jpg))) return route.fulfill({ status: 404, body: '' });
      return route.fallback();
    });
    return Object.assign(A, { stats, packs });
  };
  const granada = pg => pg.evaluate(() => {
    W.newTripFrom({ v: 2, algo: 2, styles: ['culture'], countries: [{ mode: 'manual', name: 'Spain', picked: ['Granada'] }], days: 3, start: '2027-06-13', depart: 'Seattle (SEA)', travelers: [41, 40, 6, 3] });
  });
  let A = await start(true);
  let letGo = () => {}; A.packs.hold = new Promise(r => { letGo = r; });
  await granada(A.pg); await A.pg.waitForTimeout(2500);
  await A.pg.evaluate(() => { const x = document.querySelector('button[data-qs="close"]'); if (x) x.click(); W.needLater(); });
  await until(() => A.pg.evaluate(() => !!(W.photoPack && W.photoFor({ n: 'Alhambra and Nasrid Palaces' }, false, 'Spain', 'Granada'))), 15000);
  const first = await A.pg.evaluate(() => W.picture({ n: 'Alhambra and Nasrid Palaces' }, false, 'Spain', 'Granada', {}));
  t.ok(/<span class="lq"/.test(first) && /src="data:image\/gif;base64,/.test(first) && !/ lqi"/.test(first) && !/srcset=/.test(first),
    'a photo with no file of its own: its blurred preview stands until its pack is here (no address that cannot load is asked for): ' + first.replace(/base64,[A-Za-z0-9+\/=]{30,}/g, 'base64,…').slice(0, 300));
  await A.pg.evaluate(() => W.picture({ n: 'Granada Cathedral and Royal Chapel' }, false, 'Spain', 'Granada', {}));   /* (wanted too, while the pack is on its way) */
  await A.pg.waitForTimeout(300);
  letGo(); A.packs.hold = null;
  const shown = await until(() => A.pg.evaluate(() => /src="blob:/.test(W.picture({ n: 'Alhambra and Nasrid Palaces' }, false, 'Spain', 'Granada', {}))), 8000);
  await until(() => A.pg.evaluate(() => /src="blob:/.test(W.picture({ n: 'Granada Cathedral and Royal Chapel' }, false, 'Spain', 'Granada', {}))), 8000);
  const loaded = await A.pg.evaluate(() => new Promise(res => {
    const m = /src="(blob:[^"]+)"/.exec(W.picture({ n: 'Granada Cathedral and Royal Chapel' }, false, 'Spain', 'Granada', {})), im = new Image();
    if (!m) return res(0); im.onload = () => res(im.naturalWidth); im.onerror = () => res(-1); im.src = m[1];
  }));
  t.ok(shown && loaded > 0 && A.packs.n === 1, 'then it shows from the pack: one request for the city\'s pack, and the picture is a real one (' + loaded + ' px wide; pack requests: ' + A.packs.n + ')');
  const own = await A.pg.evaluate(() => W.picture({ n: 'Parque de las Ciencias' }, false, 'Spain', 'Granada', {}));
  t.ok(own.indexOf('src="' + u(man[2].jpg) + '"') > 0, 'a photo with a file of its own is shown from it, as before');
  /* saving the trip for offline: the city's photos come from the pack already kept, or from it in one request */
  const before = A.stats.n;
  await A.pg.evaluate(() => W.offline.save(W.P, 'test'));
  await until(() => A.pg.evaluate(() => W.offline.state === 'done' || W.offline.state === 'error'), 15000);
  const sv = await A.pg.evaluate(() => ({ st: W.offline.state, n: W.offline.n, total: W.offline.total }));
  t.ok(sv.st === 'done' && sv.n === sv.total && sv.total >= 4 && A.stats.n === before && A.packs.n === 1,
    'saving the trip for offline: every photo is on the phone, none fetched one by one (' + sv.n + ' of ' + sv.total + '; single requests: ' + (A.stats.n - before) + ', pack requests: ' + A.packs.n + ')');
  /* the next visit: the pictures come from the phone, the pack is not fetched again */
  await A.pg.reload(); await A.pg.waitForTimeout(2500);
  await A.pg.evaluate(() => W.needLater());
  const again = await until(() => A.pg.evaluate(() => !!W.photoPack && /src="blob:/.test(W.picture({ n: 'Alhambra and Nasrid Palaces' }, false, 'Spain', 'Granada', {}))), 10000);
  t.ok(again && A.packs.n === 1, 'on the next visit its pictures come from the phone: the pack is not fetched again');
  t.eq(A.errors(), [], 'no page errors');
  await A.ctx.close();

  /* every photo with a file of its own, and a pack beside them (a city on its way to one file): the page shows the
     files as before and never asks for the pack; saving the trip takes the pack, once, for the lot */
  A = await start(false);
  await granada(A.pg); await A.pg.waitForTimeout(2500);
  await A.pg.evaluate(() => { const x = document.querySelector('button[data-qs="close"]'); if (x) x.click(); W.needLater(); });
  await until(() => A.pg.evaluate(() => !!(W.photoPack && W.photoFor({ n: 'Mirador de San Nicolas' }, false, 'Spain', 'Granada'))), 15000);
  await settle(A.pg);
  const s0 = A.stats.n, p0 = A.packs.n;
  await A.pg.evaluate(() => W.offline.save(W.P, 'test'));
  await until(() => A.pg.evaluate(() => W.offline.state === 'done' || W.offline.state === 'error'), 15000);
  const sv2 = await A.pg.evaluate(() => ({ st: W.offline.state, n: W.offline.n, total: W.offline.total }));
  t.ok(p0 === 0 && sv2.st === 'done' && sv2.n === sv2.total && sv2.total >= 4 && A.packs.n === 1 && A.stats.n === s0,
    'photos that have files too: the page never asks for the pack; saving the trip fetches it once and no photo on its own (' + sv2.n + ' of ' + sv2.total + '; pack requests ' + p0 + ' then ' + A.packs.n + ', single requests ' + (A.stats.n - s0) + ')');
  t.eq(A.errors(), [], 'no page errors');
  await A.ctx.close();

  /* ---- Settings, World library: a city saved before any trip goes there ---- */
  A = await start(true);
  await exampleTrip(A.pg);   /* (a trip to Italy: nothing of it is in Granada) */
  await A.pg.evaluate(() => { W.needLater(); });
  await until(() => A.pg.evaluate(() => !!(W.photoPack && W.worldCities && W.worldCities().length)), 12000);
  await A.pg.evaluate(() => { location.hash = '#settings'; }); await A.pg.waitForTimeout(800);
  const row = () => A.pg.evaluate(() => { const r = document.querySelector('#set-world .wl-row'); return r ? r.textContent.replace(/\s+/g, ' ').trim() : ''; });
  const r0 = await row();
  t.ok(/^Granada ?Spain · 30 places ?Save for offline$/.test(r0), 'Settings lists the library\'s cities, each with "Save for offline": ' + r0);
  await A.pg.click('#set-world [data-wl="save"]');
  const savedRow = await until(async () => { const x = await row(); return /saved/.test(x) ? x : ''; }, 15000);
  const kept = await A.pg.evaluate(() => new Promise(res => {
    const out = { rec: !!localStorage.getItem('waypoint-world-spain-granada'), reg: JSON.parse(localStorage.getItem('waypoint-offline-cities-v1') || '{}') };
    const r = indexedDB.open('waypoint-offline', 1);
    r.onsuccess = () => { const q = r.result.transaction('blobs').objectStore('blobs').getAllKeys(); q.onsuccess = () => { out.blobs = q.result.length; res(out); }; };
    r.onerror = () => res(out);
  }));
  t.ok(/Granada ?Spain · saved .* · 4 photos/.test(savedRow) && /Remove$/.test(savedRow) && kept.rec && kept.blobs === 4 && kept.reg['spain-granada'] && kept.reg['spain-granada'].photos === 4 && A.packs.n === 1,
    'tapped: its record, and its four photos from one pack, are on the phone, and the row says so: ' + savedRow + ' (pack requests: ' + A.packs.n + ')');
  /* a trip to Granada made with no signal: its lists come from the saved record, its photo from the phone */
  await A.ctx.setOffline(true);
  await A.pg.evaluate(() => window.dispatchEvent(new Event('offline')));
  await granada(A.pg); await A.pg.waitForTimeout(2500);
  await A.pg.evaluate(() => { const x = document.querySelector('button[data-qs="close"]'); if (x) x.click(); });
  const offl = await until(() => A.pg.evaluate(() => {
    const pool = W.pool('Spain', 'Granada');
    return pool && pool.spots && pool.spots.length >= 8 ? { spots: pool.spots.length, food: pool.food.length, lib: pool.lib || 0, pic: /src="blob:/.test(W.picture({ n: 'Alhambra and Nasrid Palaces' }, false, 'Spain', 'Granada', {})), days: W.P.days.filter(d => d.slots.some(x => x.item)).length } : null;
  }), 12000);
  t.ok(offl && offl.lib === 1 && offl.spots >= 8 && offl.food >= 6 && offl.pic && offl.days >= 1,
    'with no signal, a new trip to the saved city has its lists (from the record), its days and its photos (from the phone): ' + JSON.stringify(offl));
  await A.ctx.setOffline(false);
  await A.pg.evaluate(() => window.dispatchEvent(new Event('online')));
  /* removing it: off the list of saved cities; its photos stay while the open trip goes there */
  await A.pg.evaluate(() => { location.hash = '#settings'; }); await A.pg.waitForTimeout(800);
  await A.pg.click('#set-world [data-wl="drop"]');
  const gone = await until(async () => /Save for offline$/.test(await row()), 8000);
  const after = await A.pg.evaluate(() => JSON.parse(localStorage.getItem('waypoint-offline-cities-v1') || '{}'));
  t.ok(gone && !after['spain-granada'], '"Remove" takes it off the saved cities, and it can be saved again');
  t.eq(A.errors(), [], 'no page errors');
  await A.ctx.close();
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
};
