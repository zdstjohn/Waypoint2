/* Explore (the tab that replaced the map): search any place and put it on the day; today's route with the way between
   stops and the whole day in Google Maps; the free parts of the day with picks; every idea under the stop it's near.
   Search sources, all mocked here: the city's own list, Mapbox (through the viewer's connection) and Claude. */
const { launch, open, exampleTrip, settle } = require('../lib/page');
exports.run = async t => {
  const b = await launch(); const { pg, ctx, errors } = await open(b, { width: 390 }); await exampleTrip(pg);
  await pg.evaluate(() => { W.S.day = 3; W.S.tview = 'map'; W.render(); }); await settle(pg, 4000);
  const first = await pg.evaluate(() => ({ search: !!document.getElementById('placeQ'), route: !!document.querySelector('.rcard'), sketch: !!document.querySelector('svg.map'),
    gm: (document.querySelector('.rc-gm') || {}).href || '', groups: [...document.querySelectorAll('.idea-group.near-g')].map(h => h.textContent), near: document.querySelectorAll('.idea .near').length,
    label: document.querySelector('[data-vsw="map"]').textContent.trim() }));
  t.eq(first.label, 'Explore', 'the tab is called Explore');
  t.ok(first.search && first.route && !first.sketch, 'Explore has the search and today\'s route, and no sketch map');
  t.ok(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&origin=/.test(first.gm) && /waypoints=/.test(first.gm), 'one button opens the whole day in Google Maps');
  t.ok(first.groups.length >= 2 && first.groups.some(g => /^Near /.test(g)) && first.near > 0, 'ideas are grouped by the stop they are near, with the time to get there: ' + first.groups.slice(0, 4).join(' / '));

  /* the day map (a city with no street-map pack): a real street map from Mapbox, every pinned stop numbered and the
     stay marked, asked for once (not again on every redraw), and tapping it opens the day in Google Maps */
  await pg.waitForFunction(() => { const i = document.querySelector('.rcard .mbmap img'); return i && i.complete; }, null, { timeout: 8000 }).catch(() => {});
  const mb = await pg.evaluate(async () => {
    const calls = () => (window.__mcp || []).filter(c => c[1] === 'static_map_image_tool');
    const n0 = calls().length; W.render(); W.render(); await new Promise(r => setTimeout(r, 300));
    const img = document.querySelector('.rcard .mbmap img'), a = img && img.closest('a'), last = calls()[calls().length - 1];
    const d = W.P.days[W.S.day - 1], pinned = d.slots.filter(x => x.item && x.item.lat != null && !x.item.gpin).length;
    const ov = last ? last[2].overlays : [];
    return { src: img && img.getAttribute('src').slice(0, 5), w: img && Math.round(img.getBoundingClientRect().width), href: a && a.href, gm: (document.querySelector('.rc-gm') || {}).href,
      asked: n0, again: calls().length - n0, nums: ov.filter(o => o.type === 'marker' && /^\d+$/.test(o.label)).length, pinned, home: ov.filter(o => o.label === 'lodging').length, path: ov.filter(o => o.type === 'path').length };
  });
  t.ok(mb.src === 'blob:' && mb.w > 250 && mb.href && mb.href === mb.gm, `the day has a street map from Mapbox (${mb.w} px wide), and tapping it opens the day in Google Maps`);
  t.ok(mb.asked >= 1 && mb.asked <= 3 && mb.again === 0, `the map is asked for once the day has settled, not on every redraw (${mb.asked} while the trip came in, then ${mb.again} more)`);
  /* flipping through days asks only for the day you stop on */
  const flip = await pg.evaluate(async () => {
    const calls = () => (window.__mcp || []).filter(c => c[1] === 'static_map_image_tool').length, n0 = calls(), d0 = W.S.day;
    for (const d of [1, 2, 4, 5, 6]) { W.S.day = d; W.render(); await new Promise(r => setTimeout(r, 60)); }
    await new Promise(r => setTimeout(r, 1300)); W.render(); const n = calls() - n0; W.S.day = d0; W.render(); return n;
  });
  t.ok(flip <= 1, `flipping through five days asks for the map of the last one only (${flip})`);
  t.ok(mb.nums === mb.pinned && mb.home === 1 && mb.path === 1, `every pinned stop is numbered on it (${mb.nums} of ${mb.pinned}), with the stay and the day's loop`);
  /* every pin fits in the picture with room for the pins' heads; Google's own pins are never drawn on it */
  const fit = await pg.evaluate(() => {
    const pts = [{ lat: 36.4184, lng: 25.4313, num: 1 }, { lat: 36.39, lng: 25.47, num: 2, food: true }, { lat: 36.46, lng: 25.375, num: 3 }, { lat: 36.41, lng: 25.44, num: 4, gpin: 1 }];
    const inp = W.mbInput(pts, { lat: 36.4166, lng: 25.4325 }, false), z = inp.zoom, S = 512 * Math.pow(2, z);
    const my = lat => { const s = Math.sin(lat * Math.PI / 180); return Math.log((1 + s) / (1 - s)) / 2; };
    const px = p => ({ x: 320 + (p.longitude - inp.center.longitude) / 360 * S, y: 200 - (my(p.latitude) - my(inp.center.latitude)) / (2 * Math.PI) * S });
    const ms = inp.overlays.filter(o => o.type === 'marker').map(px);
    return { inside: ms.every(p => p.x >= 20 && p.x <= 620 && p.y >= 40 && p.y <= 392), n: ms.length, google: inp.overlays.some(o => o.label === '4') };
  });
  t.ok(fit.inside && fit.n === 4 && !fit.google, `every pin fits in the picture (${fit.n} markers) and a pin from Google is left off`);

  /* search: three sources, one list; the same place from the map and Claude shows once, marked as on the map */
  await pg.fill('#placeQ', 'gelato'); await pg.click('[data-psearch="1"]'); await pg.waitForTimeout(400); await settle(pg, 4000);
  const res = await pg.evaluate(() => ({ rows: [...document.querySelectorAll('.ps-it')].map(li => [li.querySelector('b').textContent, li.querySelector('.ps-src').textContent]),
    google: (document.querySelector('.ps-google a') || {}).href || '', mcp: (window.__mcp || []).filter(c => c[0] === 'Mapbox').map(c => c[1]) }));
  const names = res.rows.map(r => r[0]);
  t.ok(res.mcp.includes('search_and_geocode_tool'), 'the map search goes through the Mapbox connection');
  t.ok(names.filter(n => n === 'Caffè gelato').length === 1 && res.rows.find(r => r[0] === 'Caffè gelato')[1] === 'On the map', 'a place both the map and Claude found shows once, marked as on the map: ' + JSON.stringify(res.rows));
  t.ok(res.rows.some(r => r[1] === 'Suggested by Claude'), 'a place only Claude knows is marked as a suggestion');
  t.ok(!names.includes('Far Away Place'), 'a result far from the city is left out');
  t.ok(/google\.com\/maps\/search\/.*gelato/.test(res.google), 'Google Maps\' own results are one link away');

  /* add: pick the part of the day; the place joins the list as your own and the day shows it */
  const added = await pg.evaluate(async () => {
    const li = [...document.querySelectorAll('.ps-it')].find(l => /Secret Garden/.test(l.textContent)); li.querySelector('[data-ppick]').click();
    await new Promise(r => setTimeout(r, 200));
    const slots = [...document.querySelectorAll('.ps-slot')].map(s => s.querySelector('b').textContent);
    document.querySelector('.ps-slot[data-pslot="pm"]').click(); await new Promise(r => setTimeout(r, 300));
    const d = W.P.days[2], pm = d.slots.find(x => x.slot === 'pm');
    return { slots, pm: pm.item && pm.item.n, ok: (document.querySelector('.ps-ok') || {}).textContent, imp: ((W.S.imported || {})['Italy|Rome'] || []).map(x => [x.n, x.src]), route: [...document.querySelectorAll('.rc-stop b')].map(b => b.textContent) };
  });
  t.eq(added.slots, ['Morning', 'Afternoon', 'Evening'], 'a thing to do can go in the morning, afternoon or evening');
  t.ok(added.pm && /Secret Garden/.test(added.pm) && added.route.some(n => /Secret Garden/.test(n)), 'the place is on the day, in the route too: ' + JSON.stringify(added));
  t.ok(added.imp.some(x => /Secret Garden/.test(x[0]) && x[1] === 'claude'), 'it joins the city\'s list as your own, remembering it came from Claude');
  t.ok(/is on Day 3, afternoon/.test(added.ok || ''), 'and says where it went');
  /* it stays after a reload of the plan (it travels with the trip) */
  const kept = await pg.evaluate(() => { W.replan(); W.render(); return W.P.days[2].slots.find(x => x.slot === 'pm').item.n; });
  t.ok(/Secret Garden/.test(kept), 'and stays there when the plan is made again');

  /* free time: clear the morning and it offers picks for it */
  const ft = await pg.evaluate(async () => {
    const d = W.P.days[2], ev = d.slots.find(x => x.slot === 'am'); (W.S.free || (W.S.free = {}))[ev.key] = 1; W.render(); await new Promise(r => setTimeout(r, 200));
    const sec = document.querySelector('.freetime'); return sec ? { h: [...sec.querySelectorAll('.ft-h b')].map(b => b.textContent), picks: sec.querySelectorAll('.scard').length } : null;
  });
  t.ok(ft && ft.h.length >= 1 && ft.picks >= 2, 'a free part of the day shows picks for it: ' + JSON.stringify(ft));

  /* the Day view: "Add a place of your own" opens Explore with the search ready */
  const ad = await pg.evaluate(async () => { W.S.tview = 'days'; W.render(); const btn = document.querySelector('[data-addplace]'); if (!btn) return null; btn.click(); await new Promise(r => setTimeout(r, 300)); return { view: W.S.tview, focus: document.activeElement && document.activeElement.id }; });
  t.eq(ad, { view: 'map', focus: 'placeQ' }, 'the Day view\'s "Add a place" opens Explore with the search ready');

  /* nothing found, and the map connection missing: says so, and still offers Claude and Google */
  const none = await pg.evaluate(async () => {
    window.__mcpFail = { search_and_geocode_tool: 'server_not_connected' };
    document.getElementById('placeQ').value = 'nothing here'; document.querySelector('[data-psearch="1"]').click(); await new Promise(r => setTimeout(r, 900));
    window.__mcpFail = null; return document.querySelector('.psearch').textContent;
  });
  t.ok(/Connect Mapbox/.test(none) && /Search Google Maps/.test(none), 'without the map connection it says how to add it, and Google Maps is still a link away');
  /* without the Mapbox connection there is no day map at all (and no asking again), and the route is still there */
  const nomap = await pg.evaluate(async () => {
    window.__mcpFail = { static_map_image_tool: 'not_granted' };
    W.S.day = 2; W.S.tview = 'map'; W.render(); await new Promise(r => setTimeout(r, 1300)); W.render();
    const n = (window.__mcp || []).filter(c => c[1] === 'static_map_image_tool').length;
    W.S.day = 4; W.render(); await new Promise(r => setTimeout(r, 1300)); W.render();
    window.__mcpFail = null;
    return { map: !!document.querySelector('.mbmap'), route: !!document.querySelector('.rcard .rc-list'), off: W.mbState().off, more: (window.__mcp || []).filter(c => c[1] === 'static_map_image_tool').length - n };
  });
  t.ok(!nomap.map && nomap.route && nomap.off && nomap.more === 0, 'without the Mapbox connection there is no map and no asking again; the route is still there');
  t.eq(errors(), [], 'no page errors');
  await ctx.close(); await b.close();
};
