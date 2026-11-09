/* Which photo a place gets: its own by its exact name; a sight named a little differently finds the sight it names; places
   to eat only ever get their own photo; "nearby" stand-ins are never borrowed by another place; and a city's photos are
   found by the city's name when the country is spelled differently. */
const { launch, open, exampleTrip } = require('../lib/page'); const mkdb = require('../lib/db');
const px = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const ph = (id, near) => Object.assign({ url: px + '#' + id, credit: 'Test, CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:' + id }, near ? { near: true } : {});
exports.run = async t => {
  const seed = {
    'photos/italy-rome': { items: { 'colosseum': ph('colosseum'), 'pantheon': ph('pantheon'), 'santa maria in trastevere': ph('smt'), 'trevi fountain': ph('trevi', true),
      'basilica and expiatory church of the holy family': ph('sf'), 'sagrada familia': ph('sf'), 'roscioli salumeria con cucina': ph('roscioli'), 'castel sant angelo': ph('csa') }, city: 'Rome', country: 'Italy' },
    'photos/united-states-new-york': { items: { 'statue of liberty': ph('liberty') }, city: 'New York', country: 'United States' },
  };
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, db: mkdb(seed) }); await exampleTrip(pg);
  await pg.waitForFunction(() => !!W.photoFor({ n: 'Pantheon' }, false, 'Italy', 'Rome'), null, { timeout: 8000 }).catch(() => {});
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
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
