/* v195, the owner: "it says file storage is full ... now my nightly photo check won't do anything". Settings > Storage
   (screens/settings.js): how full the photos' and street maps' file store is, the files no database document points at,
   and, after a confirmation on the page, removing them. Never a file a document uses, never one from the last two
   days, nothing at all when the read looks short; hidden from a view without the store (a shared trip, the phone-only
   version, a viewer who can't edit). */
const { launch, open, exampleTrip, settle, until } = require('../lib/page');
const mkdb = require('../lib/db');
const hex = n => (n.toString(16) + 'f'.repeat(32)).slice(0, 32);
exports.run = async t => {
  const b = await launch();
  const old = new Date(Date.now() - 10 * 864e5).toISOString(), now = new Date().toISOString();
  /* in use: a photo (its JPEG, small copy and WebP), a map pack's two parts, and a file named only in a menus document */
  const seed = {
    'photos/italy-rome': { city: 'Rome', country: 'Italy', items: { colosseum: { url: '/_blob/' + hex(1), sm: '/_blob/' + hex(2), webp: { url: '/_blob/' + hex(3) }, credit: 'x' } } },
    'maps/rome': { parts: ['/_blob/' + hex(4), '/_blob/' + hex(5)] },
    'menus/italy-rome': { x: { img: 'https://claude.ai/_blob/' + hex(6) } }
  };
  const files = (pg, list) => pg.evaluate(l => { window.__assetList = l; window.__deleted = []; }, list);
  const asset = (n, at, size) => ({ id: hex(n), url: '/_blob/' + hex(n), contentType: 'image/jpeg', sizeBytes: size || 2e6, createdAt: at });
  const toSettings = async pg => { await pg.evaluate(() => { W.needLater(); W.goView('settings'); }); await pg.waitForSelector('#set-store', { timeout: 15000 }); };
  const box = pg => pg.evaluate(() => { const e = document.querySelector('#storeBox'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; });

  const A = await open(b, { width: 390, height: 844, db: mkdb(seed) }); await exampleTrip(A.pg);
  /* 6 in use, 3 unused (old), one unused uploaded today (a nightly run may write its document after) */
  await files(A.pg, [1, 2, 3, 4, 5, 6].map(n => asset(n, old)).concat([7, 8, 9].map(n => asset(n, old, 3e6)), [asset(10, now)]));
  await toSettings(A.pg);
  await until(() => A.pg.evaluate(() => !!document.querySelector('#storeBox [data-store="scan"]')));
  t.ok(/10 of 5,000 files/.test(await box(A.pg)), 'the card says how full the store is: ' + (await box(A.pg)));
  await A.pg.click('#storeBox [data-store="scan"]');
  await until(() => A.pg.evaluate(() => !!document.querySelector('#storeBox [data-store="ask"]')));
  t.ok(/3 files \(9 MB\) aren't used/.test(await box(A.pg)), 'it finds the three old files nothing uses (not today\'s): ' + (await box(A.pg)));
  /* nothing goes before the confirmation; Cancel keeps everything */
  await A.pg.click('#storeBox [data-store="ask"]');
  t.ok(/Remove 3 files for good\?.*can't be brought back/.test(await box(A.pg)) && (await A.pg.evaluate(() => window.__deleted.length)) === 0, 'it asks on the page first, and has removed nothing');
  await A.pg.click('#storeBox [data-store="cancel"]');
  t.ok(!!(await A.pg.$('#storeBox [data-store="ask"]')) && (await A.pg.evaluate(() => window.__deleted.length)) === 0, 'Cancel goes back and removes nothing');
  await A.pg.click('#storeBox [data-store="ask"]'); await A.pg.click('#storeBox [data-store="go"]');
  await until(() => A.pg.evaluate(() => /Removed 3 files/.test(document.querySelector('#storeBox').textContent)));
  const del = await A.pg.evaluate(() => window.__deleted.slice().sort());
  t.eq(del, [hex(7), hex(8), hex(9)], 'it removes exactly the unused old files');
  t.ok(/Removed 3 files and freed 9 MB/.test(await box(A.pg)) && /7 of 5,000 files/.test(await box(A.pg)), 'and says what it freed, with the store counted again: ' + (await box(A.pg)));

  /* a read that finds almost nothing in use is a read that went wrong: nothing is removed */
  const B = await open(b, { width: 390, height: 844, db: mkdb({}) }); await exampleTrip(B.pg);
  await files(B.pg, Array.from({ length: 300 }, (_, i) => asset(100 + i, old)));
  await toSettings(B.pg);
  await until(() => B.pg.evaluate(() => !!document.querySelector('#storeBox [data-store="scan"]')));
  await B.pg.click('#storeBox [data-store="scan"]');
  await until(() => B.pg.evaluate(() => /can't be right|Nothing was removed/.test(document.querySelector('#storeBox').textContent)));
  t.ok(!(await B.pg.$('#storeBox [data-store="ask"]')) && (await B.pg.evaluate(() => window.__deleted.length)) === 0, 'an empty or short read offers nothing to remove: ' + (await box(B.pg)));

  /* a photo kept only in its city's pack (pk) names its old file without using it: that file can go, the pack stays,
     and a file another photo still shows stays too (v200) */
  const pkSeed = Object.assign({}, seed, { 'photos/spain-madrid': { city: 'Madrid', country: 'Spain', pack: { url: '/_blob/' + hex(21), n: 2 },
    items: { prado: { url: '/_blob/' + hex(22), pk: 1, credit: 'x' }, retiro: { url: '/_blob/' + hex(1), pk: 1, credit: 'x' }, stand: { url: '/_blob/' + hex(23), near: 1, credit: 'x' } } } });
  const K = await open(b, { width: 390, height: 844, db: mkdb(pkSeed) }); await exampleTrip(K.pg);
  await files(K.pg, [1, 2, 3, 4, 5, 6, 21, 22, 23].map(n => asset(n, old)));
  await toSettings(K.pg);
  await until(() => K.pg.evaluate(() => !!document.querySelector('#storeBox [data-store="scan"]')));
  await K.pg.click('#storeBox [data-store="scan"]');
  await until(() => K.pg.evaluate(() => !!document.querySelector('#storeBox [data-store="ask"]') || /Nothing|can't/.test(document.querySelector('#storeBox').textContent)));
  await K.pg.click('#storeBox [data-store="ask"]'); await K.pg.click('#storeBox [data-store="go"]');
  await until(() => K.pg.evaluate(() => /Removed \d+ file/.test(document.querySelector('#storeBox').textContent)));
  t.eq(await K.pg.evaluate(() => window.__deleted.slice().sort()), [hex(22)], 'a packed photo\'s old file is removed; its pack, a file another photo shows, and a stand-in\'s file stay');

  /* a full store says so */
  const F = await open(b, { width: 390, height: 844, db: mkdb(seed) }); await exampleTrip(F.pg);
  await F.pg.evaluate(() => { const l = []; for (let i = 0; i < 5000; i++) l.push({ id: (i.toString(16) + 'e'.repeat(32)).slice(0, 32), sizeBytes: 1e5, createdAt: new Date(0).toISOString() }); window.__assetList = l; });
  await toSettings(F.pg);
  await until(() => F.pg.evaluate(() => !!document.querySelector('#storeBox [data-store="scan"]')));
  t.ok(/full: new photos can't be added/.test(await box(F.pg)) && !!(await F.pg.$('#storeBox .st-bar.full')), 'a full store says new photos can\'t be added: ' + (await box(F.pg)));

  /* without the store (a viewer who can't edit the artifact), there is no card */
  const C = await open(b, { width: 390, height: 844, db: mkdb(seed), init: () => { window.__noAssets = true; } }); await exampleTrip(C.pg);
  await C.pg.evaluate(() => { window.__noAssets = true; W.needLater(); W.goView('settings'); });
  await C.pg.waitForSelector('#set-lib', { timeout: 15000 });
  await until(() => C.pg.evaluate(() => { const c = document.querySelector('#set-store'); return !c || c.hidden; }));
  t.ok(await C.pg.evaluate(() => { const c = document.querySelector('#set-store'); return !c || c.hidden; }), 'a view without the store has no Storage card');
  await settle(A.pg);
  await b.close();
};
