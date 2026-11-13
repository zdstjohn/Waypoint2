/* Nightly restaurants and menus: places to eat the nightly task found (morefood/<city>) join the city's list once, checked
   like any other and never twice; a planned meal's "Menu" opens its panel at the menu read from the restaurant's own site
   (menus/<city>): sections, dishes, prices in the chosen currency, kids' dishes, where and when it was read; without one,
   it says the menu is read overnight; either way a link to its menu photos on Google Maps. */
const { launch, open, exampleTrip, settle, reveal } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const seed = { 'morefood/italy-rome': { city: 'Rome', country: 'Italy', at: '2026-11-09', items: [
      { n: 'Trattoria Nightly Uno', d: 'Roman classics, kids welcome', cuisine: 'Roman', price: '€€', meal: 'both', k: 1, src: 'https://example.org/uno' },
      { n: 'Pizzeria Nightly Due', d: 'Wood-fired pizza', cuisine: 'Pizza', price: '€', meal: 'both', k: 1, src: 'https://example.org/due', fit: 'good', fitw: 'Margherita and veggie pizzas' },
      { n: '', d: 'no name: dropped' }, { n: '<script>x</script>', d: 'markup in a name' } ] },
    'fx/latest': { base: 'EUR', date: '2026-11-06', rates: { USD: 1.1165 } } };
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844, db: mkdb(seed) }); await exampleTrip(pg); await settle(pg, 4000);
  const r = await pg.evaluate(() => { const pool = W.pool('Italy', 'Rome'), names = pool.food.map(x => x.n); W.pool('Italy', 'Rome'); return { uno: names.includes('Trattoria Nightly Uno'), due: names.filter(n => n === 'Pizzeria Nightly Due').length, again: W.pool('Italy', 'Rome').food.filter(x => /Nightly/.test(x.n)).length, odd: names.filter(n => /script|^$/.test(n)).length }; });
  t.ok(r.uno && r.due === 1 && r.again === 2, 'the nightly places to eat join Rome\'s list, once (' + JSON.stringify(r) + ')');
  t.eq(r.odd, 0, 'what fails the validator (no name, markup) stays out');
  /* a menu for one of the planned meals */
  const meal = await pg.evaluate(() => { const d = W.P.days[W.S.day - 1], x = d.slots.find(y => y.item && W.isFood(y.slot) && y.slot !== 'breakfast'); return { key: x.key, n: x.item.n, slug: W.slug(d.country + ' ' + d.city), norm: W.norm(x.item.n) }; });
  await pg.evaluate(async (m) => {
    const items = {}; items[m.norm] = { n: m.n, src: 'https://example.org/menu', at: '2026-11-08', note: 'Gluten-free pasta on request.',
      sections: [{ h: 'Pasta', items: [{ n: 'Cacio e pepe', p: '€12' }, { n: 'Amatriciana', p: '€13', d: 'guanciale, tomato' }] }, { h: '<b>Bad</b>', items: [{ n: '<img src=x onerror=alert(1)>', p: '€1' }] }],
      kids: [{ n: 'Pasta al pomodoro', p: '€7' }] };
    await window.__dbOp('set', 'menus/' + m.slug, JSON.stringify({ city: 'Rome', country: 'Italy', items }));
  }, meal);
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => { W.S.tview = 'days'; W.render(); });
  const btn = await pg.$(`#viewTrip [data-open="${meal.key}"][data-menu]`);
  t.ok(!!btn, 'a planned meal\'s "Menu" opens it in the app');
  if (btn) { await reveal(pg, `#viewTrip [data-open="${meal.key}"][data-menu]`); await btn.click(); await pg.waitForTimeout(500); }
  const m = await pg.evaluate(() => { const b = document.querySelector('#sheethost .menu-b'); return b ? { txt: b.textContent.replace(/\s+/g, ' '), html: b.innerHTML, gm: !!b.querySelector('a[href*="google"]') } : null; });
  t.ok(m && /Cacio e pepe/.test(m.txt) && /€\s?12/.test(m.txt) && /For the kids/.test(m.txt) && /Pasta al pomodoro/.test(m.txt), 'its panel shows the menu: dishes, prices, the kids\' dishes');
  t.ok(m && /example\.org/.test(m.txt) && /read Nov 8/.test(m.txt) && m.gm, 'with where and when it was read, and its menu photos on Google Maps');
  t.ok(m && !/<img|<b>/i.test(m.html.replace(/<(\/?)(div|h3|h4|ul|li|span|b|p|a)(\s[^>]*)?>/g, '')), 'what the menu says is shown as text, never as markup');
  await pg.evaluate(() => W.setCurView('USD')); await pg.waitForTimeout(300);
  t.ok(await pg.evaluate(() => /≈\$13/.test(document.querySelector('#sheethost .menu-b').textContent)), 'prices follow "Prices in"');
  await pg.evaluate(() => { W.setCurView(''); W.closeStop(); });
  /* a meal with no menu yet */
  const none = await pg.evaluate(() => { const d = W.P.days[W.S.day - 1], x = d.slots.find(y => y.item && y.slot === 'breakfast'); return W.menuBlock(x.item, d); });
  t.ok(/read from restaurants' own sites overnight/.test(none) && /Menu photos on Google Maps/.test(none), 'without one, it says when it comes, and links to the menu photos');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
