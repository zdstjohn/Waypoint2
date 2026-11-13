/* Which photo a place gets: its own by its exact name; a sight named a little differently finds the sight it names; places
   to eat only ever get their own photo; "nearby" stand-ins are never borrowed by another place; and a city's photos are
   found by the city's name when the country is spelled differently. */
const { launch, open, exampleTrip } = require('../lib/page'); const mkdb = require('../lib/db');
const px = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const ph = (id, near) => Object.assign({ url: px + '#' + id, credit: 'Test, CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:' + id }, near ? { near: true } : {});
exports.run = async t => {
  const seed = {
    'photos/italy-rome': { items: { 'colosseum': Object.assign(ph('colosseum'), { big: '/_blob/large1' }), 'pantheon': ph('pantheon'), 'santa maria in trastevere': ph('smt'), 'trevi fountain': ph('trevi', true),
      'basilica and expiatory church of the holy family': ph('sf'), 'sagrada familia': ph('sf'), 'roscioli salumeria con cucina': ph('roscioli'), 'castel sant angelo': ph('csa') }, city: 'Rome', country: 'Italy' },
    'photos/united-states-new-york': { items: { 'statue of liberty': ph('liberty') }, city: 'New York', country: 'United States' },
  };
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, db: mkdb(seed) }); await exampleTrip(pg);
  await pg.waitForFunction(() => !!W.photoFor({ n: 'Pantheon' }, false, 'Italy', 'Rome'), null, { timeout: 8000 }).catch(() => {});
  /* (v182: a town's index comes when it is first looked up; one under another spelling of its country, a moment later) */
  await pg.waitForFunction(() => !!W.photoFor({ n: 'Statue of Liberty' }, false, 'USA', 'New York'), null, { timeout: 8000 }).catch(() => {});
  const r = await pg.evaluate(() => {
    const f = (n, food, country, city) => { const p = W.photoFor({ n }, !!food, country || 'Italy', city || 'Rome'); return p ? p.url.split('#')[1] : null; };
    return {
      exact: f('Pantheon'), variant: f('Colosseum & Roman Forum'), underground: f('Colosseum Underground Tour'), accent: f('Castel Sant’Angelo'),
      food: f('Lunch by the Pantheon', true), foodExact: f('Roscioli Salumeria con Cucina', true), nearOnly: f('Trevi Fountain at night'),
      partial: f('Trastevere evening stroll'), alias: f('Sagrada Família'), otherCity: f('Statue of Liberty'),
      usa: f('Statue of Liberty', false, 'USA', 'New York'), usaVariant: f('Statue of Liberty & Ellis Island', false, 'USA', 'New York'),
    };
  });
  t.eq(r.exact, 'pantheon', 'a sight finds its own photo by its exact name');
  t.eq(r.variant, 'colosseum', '"Colosseum & Roman Forum" finds the Colosseum');
  t.eq(r.underground, 'colosseum', '"Colosseum Underground Tour" finds the Colosseum');
  t.eq(r.accent, 'csa', 'punctuation and accents do not matter');
  t.eq(r.food, null, 'a place to eat never borrows a sight\'s photo');
  t.eq(r.foodExact, 'roscioli', 'a place to eat finds its own photo by its full name');
  t.eq(r.nearOnly, null, 'a "nearby" stand-in is not borrowed by a differently named place');
  t.eq(r.partial, null, '"Trastevere evening stroll" does not take the photo of Santa Maria in Trastevere');
  t.eq(r.alias, 'sf', 'a stored alias (Sagrada Família) is found');
  t.eq(r.otherCity, null, 'another city\'s photo is never used');
  t.eq(r.usa, 'liberty', 'a city\'s photos are found when its country is spelled differently');
  t.eq(r.usaVariant, 'liberty', 'and a variant name works there too');
  const bare = await pg.evaluate(() => [W.picture({ n: 'Lemon Grove Tour and Limoncello Tasting' }, false, 'Italy', 'Rome'), W.picture({ n: 'Evening stroll' }, false, 'Italy', 'Rome', { credit: true }), !!W.sketch]);
  t.eq(bare, ['', '', false], 'a place with no photo shows no picture at all, never a drawing');
  /* the photo that fills a header: the stored large copy when there is one; a small photo fills its band too (v152) */
  const hero = await pg.evaluate(() => {
    const small = W.photoFor({ n: 'Pantheon' }, false, 'Italy', 'Rome'), big = W.photoFor({ n: 'Colosseum' }, false, 'Italy', 'Rome');
    const pick = W.cityPhoto('Italy', 'Rome', [{ n: 'Pantheon' }, { n: 'Colosseum' }]);
    const a = W.heroImg(big, 'Rome'), z = W.heroImg(small, 'Rome');
    return { pick: pick && pick.big, bigSrc: /srcset="[^"]* 720w, \/_blob\/large1 1920w"/.test(a) && /sizes=/.test(a), bigPlain: !/lowres/.test(a), credit: /hero-credit/.test(a) && /Test, CC BY-SA 4\.0/.test(a),
      smallSrc: z.indexOf(small.url.replace(/&/g, '&amp;')) > 0 || z.indexOf(small.url) > 0, smallFills: /class="hero-img"/.test(z) && !/lowres/.test(z), noSet: !/srcset/.test(z) };
  });
  t.eq(hero.pick, '/_blob/large1', 'a header prefers a place whose photo has a large copy');
  t.ok(hero.bigSrc && hero.bigPlain && hero.credit, 'a wide header is offered the large copy (a phone keeps the small one), with the photographer\'s credit');
  t.ok(hero.smallSrc && hero.smallFills && hero.noSet, 'a photo with no large copy fills the whole band, with no side fade');
  /* (v182) a reload no longer downloads every town's photo index: only the trip's towns are asked for, one by one, and
     they are kept on the phone, so the photos are there with the first screen next time */
  {
    const many = Object.assign({}, seed); for (let i = 0; i < 40; i++) many['photos/nowhere-town-' + i] = { items: { x: ph('x' + i) }, city: 'Town ' + i, country: 'Nowhere' };
    const ops = [], db = mkdb(many), rec = (o, p, body) => { ops.push(o + ' ' + p); return db(o, p, body); };
    const c2 = await open(b, { width: 390, db: rec }); await exampleTrip(c2.pg);
    await c2.pg.waitForFunction(() => !!W.photoFor({ n: 'Pantheon' }, false, 'Italy', 'Rome'), null, { timeout: 8000 }).catch(() => {});
    await c2.pg.waitForTimeout(800);
    const got = ops.filter(o => / photos/.test(o)), kept = await c2.pg.evaluate(() => (JSON.parse(localStorage.getItem('waypoint-photo-index-v1') || '{}').order || []));
    t.ok(!got.some(o => /^list photos$/.test(o)) && !got.some(o => /nowhere-town/.test(o)) && got.some(o => o === 'get photos/italy-rome'),
      'only the trip\'s towns are asked for, never the whole list: ' + JSON.stringify(got.slice(0, 8)));
    t.ok(kept.includes('italy-rome'), 'the trip\'s towns are kept on the phone: ' + JSON.stringify(kept));
    t.eq(c2.errors(), [], 'no page errors on the second phone');
    await c2.ctx.close();
  }
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
