/* Where to stay, searched on Booking.com from the stay panel (lib/prices.js): what you type and the filters you tick
   go to your Booking.com connection with your place, nights and party, the places come back with prices for your
   nights, and one tap stays there; a hotel's name is looked up by name; a filter searches again; without Claude
   (the installable app) the search opens Booking.com's own page with everything filled in. */
const { launch, open, exampleTrip, settle } = require('../lib/page');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390, height: 844 }); await exampleTrip(pg);
  await pg.evaluate(() => { W.S.travelers = [38, 36, 7, 4]; W.goView('setup'); W.render(); }); await settle(pg, 3000);
  const openStay = p => p.evaluate(() => { (W.S.stepClosed = W.S.stepClosed || {}).where = false; W.render(); document.querySelector('[data-openstay="0"]').click(); });
  await openStay(pg); await pg.waitForTimeout(500);
  const ui = await pg.evaluate(() => { const f = document.querySelector('.stay-panel .sfind'); return f ? { h: f.querySelector('.live-h').textContent, input: !!f.querySelector('[data-sfq]'), go: (f.querySelector('[data-sfgo]') || {}).textContent, chips: [...f.querySelectorAll('[data-sf]')].map(c => c.textContent) } : null; });
  t.ok(ui && /Search Booking\.com/.test(ui.h) && /nights? from/.test(ui.h) && /2 adults, 2 children \(7, 4\)/.test(ui.h) && ui.input && ui.go === 'Search', 'the stay panel has a Booking.com search, for your nights and everyone: ' + JSON.stringify(ui));
  t.ok(ui && ui.chips.includes('Family rooms') && ui.chips.includes('Free cancellation') && ui.chips.length === 6, 'with filters to tick: ' + (ui && ui.chips.join(', ')));
  const calls = () => pg.evaluate(() => (window.__mcp || []).filter(c => c[1] === 'accommodations_search').map(c => c[2]));
  /* an area and a filter */
  await pg.fill('.sfind [data-sfq]', 'Trastevere');
  await pg.click('.sfind [data-sf="fam"]'); await pg.waitForTimeout(300);
  t.eq(await pg.evaluate(() => document.querySelector('.sfind [data-sfq]').value), 'Trastevere', 'ticking a filter keeps what you typed');
  await pg.click('.sfind [data-sfgo]'); await pg.waitForTimeout(800);
  const c1 = (await calls()).pop();
  t.ok(c1 && /^Rome/.test(c1.destination) && /Trastevere/.test(c1.user_query) && (c1.facilities || []).includes('FAMILY_ROOMS') && c1.number_of_adults === 2 && JSON.stringify(c1.children_ages) === '[7,4]' && /^\d{4}-\d\d-\d\d$/.test(c1.checkin_date) && !c1.hotel_names, 'the search goes to Booking.com with the place, your words, the filter, your nights and party: ' + JSON.stringify(c1));
  const res = await pg.evaluate(() => [...document.querySelectorAll('.sfind .live-list li')].map(li => li.querySelector('.lv-a b').textContent));
  t.ok(res.length === 2 && /Casa Familia/.test(res[0]), 'the places come back with prices (a link off Booking.com, or no price, left out): ' + res.join(' | '));
  t.ok(await pg.evaluate(() => /See every result on Booking\.com/.test(document.querySelector('.sfind').textContent)), 'with every result one tap away on Booking.com');
  /* a filter with places found searches again at once */
  const n0 = (await calls()).length;
  await pg.click('.sfind [data-sf="fc"]'); await pg.waitForTimeout(800);
  const c2 = (await calls()).pop();
  t.ok((await calls()).length === n0 + 1 && c2.cancellation_type === 'free_cancellation' && (c2.facilities || []).includes('FAMILY_ROOMS'), 'a filter ticked after a search searches again: ' + JSON.stringify(c2 && { fc: c2.cancellation_type, fac: c2.facilities }));
  /* a hotel by its name, and Enter searches */
  await pg.fill('.sfind [data-sfq]', 'Hotel Raphael'); await pg.press('.sfind [data-sfq]', 'Enter'); await pg.waitForTimeout(800);
  const c3 = (await calls()).pop();
  t.ok(c3 && JSON.stringify(c3.hotel_names) === '["Hotel Raphael"]' && /^Hotel Raphael in Rome/.test(c3.user_query), 'a hotel\'s name is looked up by name, and Enter searches: ' + JSON.stringify(c3 && { h: c3.hotel_names, q: c3.user_query }));
  /* stay at one */
  await pg.click('.sfind [data-livepick="0"]'); await pg.waitForTimeout(500);
  const st = await pg.evaluate(() => { const k = Object.keys(W.S.stays).find(k => /^Italy\|Rome/.test(k)); return W.S.stays[k] && { label: W.S.stays[k].label, total: W.S.stays[k].live && W.S.stays[k].live.total }; });
  t.ok(st && /Casa Familia/.test(st.label) && st.total > 0, 'Stay here makes it your stay, with its price: ' + JSON.stringify(st));
  /* without Claude: Booking.com's own search, filled in */
  const url = await pg.evaluate(() => { const s = W.P.stops[0]; return W.bookingSearchUrl(s, W.P, { q: 'Trastevere', f: { fam: 1, fc: 1 } }); });
  const u = new URL(url), sp = u.searchParams;
  t.ok(u.host === 'www.booking.com' && sp.get('ss') === 'Trastevere, Rome, Italy' && /^\d{4}-\d\d-\d\d$/.test(sp.get('checkin')) && sp.get('group_adults') === '2' && sp.getAll('age').join(',') === '7,4' && sp.get('nflt') === 'hotelfacility=28;fc=2', 'without a connection, Search opens Booking.com with the place, dates, party and filters: ' + url);
  t.eq(errors(), [], 'no page errors');
  await ctx.close();
  /* the installable app: Search is a link to Booking.com that follows what you type */
  const { pg: p2, ctx: c2x, errors: e2 } = await open(b, { width: 390, height: 844, init: () => { window.__noClaude = true; } });
  await exampleTrip(p2);
  await p2.evaluate(() => { delete window.claude; W.goView('setup'); W.render(); }); await settle(p2, 2000);
  await openStay(p2); await p2.waitForTimeout(400);
  await p2.fill('.sfind [data-sfq]', 'Monti');
  const href = await p2.evaluate(() => { const a = document.querySelector('.sfind a[data-sfout]'); return a && a.href; });
  t.ok(href && /booking\.com\/searchresults/.test(href) && /ss=Monti%2C%20Rome/.test(href) && await p2.evaluate(() => !document.querySelector('.sfind [data-sfgo]')), 'without Claude, Search is Booking.com\'s own page and follows what you type: ' + href);
  t.eq(e2(), [], 'no page errors there either');
  await c2x.close(); await b.close();
};
