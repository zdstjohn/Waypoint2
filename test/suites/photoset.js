/* Photos load faster and softer: a small copy for small places, WebP where the browser has it, and a blurred preview
   until the real picture is in (lib/photos.js; the copies are made by the nightly tools, tools/big_photos.py and photos2.py).
   Records without the new fields draw exactly as before; the copy for the installable app drops what only the Claude
   file store has. Pictures are drawn by test/py/make_fixtures.py and served by test/lib/photofix.js. */
const path = require('path'); const fs = require('fs'); const vm = require('vm');
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db'); const fx = require('../lib/photofix');
const ROOT = path.resolve(__dirname, '..', '..');
exports.run = async t => {
  const man = fx.make(path.join(ROOT, '.photoset-fx'), 4);
  const names = ['Colosseum', 'Pantheon', 'Trevi Fountain', 'Roscioli Salumeria con Cucina'];
  const seed = mode => ({ 'photos/italy-rome': { city: 'Rome', country: 'Italy', items: Object.fromEntries(names.map((n, i) => [n.toLowerCase(), fx.record(man[i], mode)])) } });
  const b = await launch();
  const markup = async mode => {
    const { pg, ctx, errors } = await open(b, { width: 390, db: mkdb(seed(mode)) }); await fx.serve(ctx, man); await exampleTrip(pg);
    await pg.waitForFunction(() => !!W.photoFor({ n: 'Pantheon' }, false, 'Italy', 'Rome'), null, { timeout: 8000 }).catch(() => {});
    return { pg, ctx, errors };
  };

  /* ---- records with every copy ---- */
  let { pg, ctx, errors } = await markup('new');
  const m = await pg.evaluate(() => {
    const thumb = W.picture({ n: 'Pantheon' }, false, 'Italy', 'Rome', { size: 'thumb' }), card = W.picture({ n: 'Colosseum' }, false, 'Italy', 'Rome', { credit: true });
    const ph = W.photoFor({ n: 'Pantheon' }, false, 'Italy', 'Rome'), big = W.photoFor({ n: 'Colosseum' }, false, 'Italy', 'Rome');
    return { thumb, card, ph, hero: W.heroImg(big, 'Rome'), heroSmall: W.heroImg(ph, 'Rome') };
  });
  const set = s => (/srcset="([^"]*)"/.exec(s) || [])[1] || '';
  t.ok(/^<span class="lq" style="background-image:url\(data:image\/webp;base64,[A-Za-z0-9+\/=]+\)"><\/span><picture><source type="image\/webp" /.test(m.thumb), 'a photo with every copy: the blurred preview, then a picture with a WebP source first: ' + m.thumb.slice(0, 200));
  t.ok(/sizes="\(max-width:560px\) 72px, 96px"/.test(m.thumb), 'a thumbnail says how small it is drawn (72 px on a phone, 96 px wider)');
  t.ok(/srcset="[^"]* 320w, [^"]* 720w"/.test(m.thumb) && (m.thumb.match(/srcset=/g) || []).length === 2, 'both the WebP source and the JPEG fallback offer the small (320w) and the normal (720w) copy');
  t.ok(set(m.thumb).indexOf(m.ph.webp.sm.replace('/_blob/', '/_blob/')) === 0 && /<img class="pic photo lqi"/.test(m.thumb) && m.thumb.indexOf('src="' + m.ph.url + '"') > 0, 'the WebP set starts with the small WebP; the img keeps the normal JPEG as its src, and starts hidden (lqi) until loaded');
  t.ok(/sizes="\(max-width:560px\) 100vw, 480px"/.test(m.card), 'a card picture never claims to be small');
  t.ok(/srcset="[^"]* 720w, [^"]* 1920w"/.test(m.hero) && /<picture><source type="image\/webp"/.test(m.hero) && /hero-lq/.test(m.hero), 'a header with a large copy and its WebP twin: WebP 720w and 1920w, and a preview');
  t.ok(/<img class="hero-img lqi"/.test(m.heroSmall) && /<source type="image\/webp" srcset="\/_blob\/[0-9a-f]{32}">/.test(m.heroSmall), 'a header with no large copy: the normal WebP and JPEG');

  /* ---- an incomplete record never offers a size it lacks ---- */
  const part = await pg.evaluate(() => {
    const base = W.photoFor({ n: 'Pantheon' }, false, 'Italy', 'Rome'), clone = o => Object.assign({}, base, o), out = {};
    const orig = W.photoFor; const draw = ph => { W.photoFor = () => ph; try { return W.picture({ n: 'X' }, false, 'Italy', 'Rome', { size: 'thumb' }); } finally { W.photoFor = orig; } };
    out.noSmWebp = draw(clone({ webp: { url: base.webp.url } }));      /* small JPEG but no small WebP: the WebP would be bigger than needed */
    out.noSm = draw(clone({ sm: undefined, webp: { url: base.webp.url } }));
    out.old = draw({ url: base.url, credit: 'x' });
    out.lqOnly = draw({ url: base.url, lq: base.lq });
    const big = W.photoFor({ n: 'Colosseum' }, false, 'Italy', 'Rome');
    out.heroNoBigWebp = W.heroImg(Object.assign({}, big, { webp: { url: big.webp.url } }), 'Rome');
    out.portrait = draw(clone({ smw: 213, w: 480 }));
    return out;
  });
  t.ok(!/<picture>|<source/.test(part.noSmWebp) && /320w/.test(part.noSmWebp), 'a small JPEG without a small WebP: JPEG sizes only (a WebP source would skip the small one)');
  t.ok(/<picture>/.test(part.noSm) && !/ 320w/.test(part.noSm), 'no small copy at all: the normal WebP and JPEG');
  t.eq(part.old, '<img class="pic photo" data-pk="' + m.ph.url + '" src="' + m.ph.url + '" alt="X" decoding="async" loading="lazy">', 'a record with only a url draws a plain picture, no preview, no sets');
  t.ok(/class="lq"/.test(part.lqOnly) && /lqi/.test(part.lqOnly) && !/srcset/.test(part.lqOnly), 'a record with only a preview gets the preview and nothing else');
  t.ok(!/<picture>/.test(part.heroNoBigWebp) && /1920w/.test(part.heroNoBigWebp), 'a large copy without its WebP: the header offers the JPEG sizes only (a wide screen never gets the small one)');
  t.ok(/ 213w, [^"]* 480w/.test(part.portrait), 'the widths of a portrait photo (smw, w) are the ones the browser is told');

  /* ---- offline: pictures come from the phone, as one file each ---- */
  const off = await pg.evaluate(() => { window.__WP_OFFLINE = { blobs: {} }; try { return W.picture({ n: 'Pantheon' }, false, 'Italy', 'Rome', { size: 'thumb' }); } finally { delete window.__WP_OFFLINE; } });
  t.ok(!/srcset|<picture>/.test(off), 'offline, a picture is the one saved file: no sets');
  t.eq(errors(), [], 'no page errors'); await ctx.close();

  /* ---- loading: preview behind, real picture fades in, then no trace of the preview; a redraw changes nothing ---- */
  const names2 = await (async () => { const p = await open(b, { width: 390, db: mkdb() }); await exampleTrip(p.pg); const n = await p.pg.evaluate(() => W.P.days[1].slots.filter(x => x.item && !W.isFood(x.slot)).map(x => x.item.n)); await p.ctx.close(); return n; })();
  const seed2 = mode => ({ 'photos/italy-rome': { city: 'Rome', country: 'Italy', items: Object.fromEntries(names2.map((n, i) => [n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(), fx.record(man[i % man.length], mode)])) } });
  const L = await open(b, { width: 390, height: 844, dpr: 3, db: mkdb(seed2('new')) }); const stats = await fx.serve(L.ctx, man, { delay: 1200 });
  await L.pg.evaluate(() => { W.S.start = '2027-06-07'; W.isExample = false; W.S.day = 2; W.S.tview = 'days'; W.render(); });
  await L.pg.waitForFunction(() => document.querySelectorAll('.slot .thumb img').length > 0, null, { timeout: 20000 });
  const mid = await L.pg.evaluate(() => { const th = document.querySelector('.slot .thumb'), i = th.querySelector('img'), r = th.getBoundingClientRect(); return { w: r.width, h: r.height, lq: !!th.querySelector('.lq'), lqi: i.classList.contains('lqi'), ld: i.classList.contains('ld'), op: getComputedStyle(i).opacity, done: i.complete && i.naturalWidth > 0 }; });
  t.ok(mid.lq && mid.lqi && !mid.ld && mid.op === '0' && !mid.done, 'mid-load: the blurred preview is there and the real picture is not yet shown: ' + JSON.stringify(mid));
  await L.pg.waitForFunction(() => { const i = document.querySelector('.slot .thumb img'); return i && i.classList.contains('ld'); }, null, { timeout: 15000 });
  await L.pg.waitForTimeout(400);
  const end = await L.pg.evaluate(() => { const th = document.querySelector('.slot .thumb'), i = th.querySelector('img'), r = th.getBoundingClientRect(); return { w: r.width, h: r.height, op: getComputedStyle(i).opacity, cur: i.currentSrc, name: (i.getAttribute('src') || '') }; });
  t.eq([end.w, end.h], [mid.w, mid.h], 'the thumbnail is the same size mid-load and loaded: nothing moves');
  t.eq(end.op, '1', 'the loaded picture is fully shown');
  const sm = man.map(e => fx.idOf(e.smwebp));
  t.ok(sm.some(id => end.cur.indexOf(id) > 0), 'on a 3x phone the thumbnail loaded the small WebP, not the 720 one: ' + end.cur.slice(-40));
  /* once loaded, a redraw draws it with no preview and nothing hidden: the picture does not blink */
  await L.pg.evaluate(() => W.render()); await L.pg.waitForTimeout(300);
  const again = await L.pg.evaluate(() => { const th = document.querySelector('.slot .thumb'), i = th.querySelector('img'); return { lq: !!th.querySelector('.lq'), lqi: i.classList.contains('lqi'), op: getComputedStyle(i).opacity, w: !!i.complete }; });
  t.eq(again, { lq: false, lqi: false, op: '1', w: true }, 'after a redraw the loaded picture has no preview and stays shown');
  const asked = stats.urls.filter(u => /\.jpg$/.test(u) && !/big|sm/.test(u)).length;
  t.eq(asked, 0, 'no normal-size JPEG was downloaded by a WebP-capable browser for the day\'s thumbnails');
  /* the header photo, once loaded, is what shows: not its blurred preview over it (the preview and the photo share a level
     under Explore's map layer) */
  await L.pg.waitForFunction(() => { const i = document.querySelector('.hero-img'); return i && (i.classList.contains('ld') || !i.classList.contains('lqi')); }, null, { timeout: 15000 }).catch(() => {});
  const top = await L.pg.evaluate(() => { const h = document.createElement('div'); h.className = 'day-h has-hero'; document.querySelector('#viewTrip').appendChild(h);
    h.innerHTML = W.heroImg({ url: '/_blob/never-shown.jpg', lq: 'UklGRgAAAABXRUJQ', webp: { url: '/_blob/never-shown.webp' }, credit: 'Test' }, 'Rome') + '<div class="hero-alt"></div><div class="grow"><h2>Rome</h2></div>';
    const i = h.querySelector('.hero-img'), q = h.querySelector('.hero-lq');
    if (!i || !q) return { none: true }; const zi = +getComputedStyle(i).zIndex, zq = +getComputedStyle(q).zIndex, after = !!(q.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING);
    h.remove(); return { zi, zq, after, ok: zq < zi || (zq === zi && after) }; });
  t.ok(top.ok, 'the loaded header photo is drawn over its preview, not under it: ' + JSON.stringify(top));
  const heroL = await L.pg.evaluate(() => { const h = document.querySelector('.day-h.has-hero'), g = h && h.querySelector('.grow'); return h ? { pic: !!h.querySelector(':scope > picture'), x: Math.round(g.getBoundingClientRect().left - h.getBoundingClientRect().left) } : null; });
  t.eq(L.errors(), [], 'no page errors while loading'); await L.ctx.close();

  /* ---- the same day with records from before: the plain pictures, no preview, and still shown ---- */
  const O = await open(b, { width: 390, height: 844, dpr: 3, db: mkdb(seed2('old')) }); await fx.serve(O.ctx, man);
  await O.pg.evaluate(() => { W.S.start = '2027-06-07'; W.isExample = false; W.S.day = 2; W.S.tview = 'days'; W.render(); });
  await O.pg.waitForFunction(() => document.querySelectorAll('.slot .thumb img').length > 0, null, { timeout: 20000 }); await O.pg.waitForTimeout(800);
  const old = await O.pg.evaluate(() => { const i = document.querySelector('.slot .thumb img'); return { lq: !!document.querySelector('.slot .thumb .lq'), set: i.hasAttribute('srcset'), pic: !!i.closest('picture'), op: getComputedStyle(i).opacity, nat: i.naturalWidth }; });
  t.eq(old, { lq: false, set: false, pic: false, op: '1', nat: 720 }, 'old records draw as before: one 720 px picture');
  /* the header's <picture> (a photo with a WebP copy) adds no box: the town's name sits where it does with a plain photo */
  const heroO = await O.pg.evaluate(() => { const h = document.querySelector('.day-h.has-hero'), g = h && h.querySelector('.grow'); return h ? { pic: !!h.querySelector(':scope > picture'), x: Math.round(g.getBoundingClientRect().left - h.getBoundingClientRect().left) } : null; });
  t.ok(heroL && heroL.pic && heroO && !heroO.pic, 'the day has a header photo, in a <picture> with the new records and plain with the old: ' + JSON.stringify([heroL, heroO]));
  t.eq(heroL && heroL.x, heroO && heroO.x, 'and the town\'s name starts at the same place in both');
  await O.ctx.close();

  /* ---- the copy for the installable app ---- */
  const src = fs.readFileSync(path.join(ROOT, 'trip/tools/copy_to_cloud.js.txt'), 'utf8');
  const code = src.slice(src.indexOf('function commonsSized'), src.indexOf('const md5'));
  const sandbox = { module: {}, decodeURIComponent, encodeURIComponent, Object, Array, String }; vm.createContext(sandbox); vm.runInContext(code + ';this.forTheWeb = forTheWeb;', sandbox);
  const rec = fx.record(man[0], 'new'); rec.smw = 213; rec.w = 480;
  const web = sandbox.forTheWeb('photos', { items: { x: rec }, city: 'Rome' }).items.x;
  t.ok(/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/.*\?width=960$/.test(web.url) && web.lq === rec.lq, 'the installable app keeps the preview and points at Commons');
  t.ok(!('sm' in web) && !('webp' in web) && !('big' in web) && !('smw' in web) && !('w' in web), 'and drops the file-store copies and their sizes (it asks Commons for those)');
  await b.close();
};
