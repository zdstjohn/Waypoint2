/* Settings > Storage: finds the stored files nothing uses and deletes them only when you confirm. A file counts as in
   use when its id is in any of the app's lists (a photo, a street-map part), your saved trips (a journal photo) or the
   page; files from the last two days are kept; it refuses when more than half would go, and checks again just before
   deleting (a file that came into use in between stays). */
const { launch, open, exampleTrip } = require('../lib/page'); const mkdb = require('../lib/db');
const id = n => (n.toString(16) + 'abcdef0123456789abcdef0123456789').slice(0, 32);
exports.run = async t => {
  const old = '2026-10-01T10:00:00Z', fresh = new Date(Date.now() - 3600e3).toISOString();
  const IDS = { photo: id(1), map: id(2), journal: id(3), unused1: id(4), unused2: id(5), freshNew: id(6), lateUse: id(7), x8: id(8), x9: id(9), x10: id(10) };
  const seed = {
    'photos/italy-rome': { items: { colosseum: { url: '/_blob/' + IDS.photo, credit: 'Test', page: 'https://commons.wikimedia.org/wiki/File:x' } }, city: 'Rome', country: 'Italy' },
    'maps/nowhere-test': { slug: 'nowhere-test', city: 'Nowhere', country: 'Testland', parts: [{ url: '/_blob/' + IDS.map }], b: [0, 0, 0, 0], places: 0, size: 1, built: old }
  };
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb(seed) }); await exampleTrip(pg);
  await pg.evaluate(I => {
    const a = (k, type, size, at) => ({ id: I[k], url: '/_blob/' + I[k], contentType: type, sizeBytes: size, createdAt: at });
    const old = '2026-10-01T10:00:00Z', fresh = new Date(Date.now() - 3600e3).toISOString();
    window.__assetList = [a('photo', 'image/jpeg', 50e3, old), a('map', 'text/javascript', 4e6, old), a('journal', 'image/jpeg', 300e3, old), a('unused1', 'image/jpeg', 60e3, old),
      a('unused2', 'text/javascript', 2e6, old), a('freshNew', 'image/jpeg', 70e3, fresh), a('lateUse', 'image/jpeg', 40e3, old), a('x8', 'image/jpeg', 1e3, fresh), a('x9', 'image/jpeg', 1e3, fresh), a('x10', 'image/jpeg', 1e3, fresh)];
    W.S.journal = { 'Italy|Rome|1': { photos: [{ id: I.journal }], note: 'hi' } }; W.save();
    W.needLater(); W.goView('settings');
  }, IDS);
  await pg.waitForFunction(() => !!document.querySelector('#set-storage [data-store="find"]'), null, { timeout: 15000 }).catch(() => {});
  t.ok(await pg.evaluate(() => /Settings/.test(document.querySelector('.set-h h2').textContent) && !!document.querySelector('#set-storage')), 'Settings has a Storage card for someone who can edit the app');
  await pg.click('#set-storage [data-store="find"]');
  const settled = () => pg.waitForFunction(() => { const c = document.querySelector('#set-storage'); return c && !/Checking every list|Deleting/.test(c.textContent); }, null, { timeout: 30000 }).catch(() => {});
  await settled();
  const r1 = await pg.evaluate(() => ({ txt: document.querySelector('#set-storage').textContent.replace(/\s+/g, ' '), imgs: [...document.querySelectorAll('#set-storage .st-grid img')].map(i => i.getAttribute('src').split('/').pop()) }));
  t.ok(/3 files nothing uses/.test(r1.txt), 'three old files nothing points at are found: ' + r1.txt.slice(0, 160));
  t.eq(r1.imgs.sort(), [IDS.unused1, IDS.lateUse].sort(), 'the photos among them are shown before anything is deleted');
  t.ok(!r1.imgs.includes(IDS.photo) && !r1.imgs.includes(IDS.journal) && !r1.imgs.includes(IDS.freshNew), 'a place photo, a journal photo and a file from today are never on the list');
  t.eq(await pg.evaluate(() => (window.__deleted || []).length), 0, 'nothing is deleted by looking');
  await pg.click('#set-storage [data-store="ask"]'); await pg.waitForTimeout(200);
  t.ok(await pg.evaluate(() => /can't be undone/.test(document.querySelector('#set-storage').textContent) && (window.__deleted || []).length === 0), 'deleting asks once more, and says it can\'t be undone');
  /* a file comes into use between the look and the delete: it stays */
  await pg.evaluate(I => { W.S.journal['Italy|Rome|2'] = { photos: [{ id: I.lateUse }] }; W.save(); }, IDS);
  await pg.click('#set-storage [data-store="delete"]');
  await settled();
  const r2 = await pg.evaluate(() => ({ del: (window.__deleted || []).slice().sort(), left: window.__assetList.map(a => a.id), txt: document.querySelector('#set-storage').textContent.replace(/\s+/g, ' ') }));
  t.eq(r2.del, [IDS.unused1, IDS.unused2].sort(), 'only the unused files go; one that came into use since stays: ' + r2.txt.slice(0, 80));
  t.ok([IDS.photo, IDS.map, IDS.journal, IDS.freshNew, IDS.lateUse].every(i => r2.left.includes(i)), 'everything in use is still there');
  /* when most files would go, something wasn't read: nothing is deleted */
  await pg.evaluate(() => { window.__assetList.push(...Array.from({ length: 20 }, (_, i) => ({ id: (i + 100).toString(16).padStart(32, 'e'), url: '/_blob/x', contentType: 'image/jpeg', sizeBytes: 1, createdAt: '2026-01-01T00:00:00Z' }))); });
  await pg.click('#set-storage [data-store="find"]');
  await settled();
  t.ok(await pg.evaluate(() => /can't be right/.test(document.querySelector('#set-storage').textContent) && !document.querySelector('#set-storage [data-store="ask"]')), 'when more than half the files look unused it refuses, with no delete button');
  /* someone who can't edit the app sees no Storage card */
  t.ok(await pg.evaluate(() => { W.readOnly = { code: 'x', name: 'x' }; const html = W.storageCard(() => 'card'); W.readOnly = null; return html === ''; }), 'a shared, view-only trip has no Storage card');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
