/* The desktop workspace (v153): on a window 1024px wide or more the app is panes, not a stretched phone. A rail (the
   views, every day, what to show, tools), the screen you are on in the middle, and the map beside the days; a stop
   opens as an inspector beside the plan, never a pop-up over it; a card and its pin light each other up; the keyboard
   (Ctrl/Cmd+K, [ and ], Esc); a card dragged onto a day in the rail; Plan and Prepare in columns; and none of it
   below 1024px, where the phone layout is untouched and the workspace's stylesheet is never even fetched.
   (No street map pack in the tests: the map pane shows the day's route as a list, and a stand-in pin checks the tie
   between the map and the list. evo/v153/check.js runs the same with Rome's real map.) */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch();
  const { pg, ctx, errors } = await open(b, { width: 1440, height: 900, touch: false, db: mkdb() }); await exampleTrip(pg); await settle(pg, 4000);
  await pg.evaluate(async () => { W.needLater(); for (let i = 0; i < 80 && !(W.laterReady && W.desk()); i++) await new Promise(r => setTimeout(r, 100)); W.S.day = 2; W.S.tview = 'days'; W.goView('trip'); W.render(); });
  await settle(pg, 3000);
  const box = sel => pg.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), display: cs.display, position: cs.position }; }, sel);

  /* ---------- the shell ---------- */
  const sh = await pg.evaluate(() => ({ desk: W.desk(), ws: document.documentElement.classList.contains('ws'), sheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => (l.getAttribute('href') || '') + (l.disabled ? ' off' : '')),
    top: getComputedStyle(document.querySelector('.top')).display, tabs: !!document.querySelector('.top .tabs') && document.querySelector('.top').offsetParent === null, tripbar: !!document.querySelector('#wsRail #tripbar'), brand: !!document.querySelector('#wsRail .brand'), next: !!document.querySelector('#wsRail #nextbar'),
    nav: [...document.querySelectorAll('#wrNav button')].map(x => x.textContent.trim()), days: document.querySelectorAll('#wrScroll .wr-day').length, N: W.P.days.length, cur: (document.querySelector('.wr-day[aria-current="true"]') || {}).dataset, over: document.documentElement.scrollWidth - innerWidth }));
  t.ok(sh.desk && sh.ws, 'a 1440px window is the workspace');
  t.ok(sh.sheets.some(s => /^app\.desk\.css/.test(s) && !/ off$/.test(s)) && sh.sheets.filter(s => /^app\.min\.css|^app2\.css/.test(s)).every(s => / off$/.test(s)), 'its stylesheet is in force and the phone ones are switched off: ' + sh.sheets.join(', '));
  t.ok(sh.top === 'none' && sh.tabs, 'the banner and its tab bar are gone');
  t.ok(sh.tripbar && sh.brand && sh.next, 'the trip switcher, the logo and the next step are in the rail (the same elements, moved)');
  t.ok(['Plan', 'Itinerary', 'Explore ideas', 'Today', 'Prepare'].every(n => sh.nav.includes(n)) && !sh.nav.includes('All days'), 'the rail has the views (no All days: the rail lists the days): ' + sh.nav.join(' · '));
  t.ok(sh.days === sh.N && sh.cur && sh.cur.wsday === '2', 'and every day of the trip, the one you are on marked (' + sh.days + ' days)');
  t.ok(sh.over <= 0, 'nothing runs off the side');
  const rail = await box('#wsRail'), wrap = await box('.wrap'), can = await box('#wsCanvas');
  t.ok(rail.x === 0 && rail.w >= 240 && rail.w <= 280 && wrap.x === rail.w && wrap.w >= 420 && wrap.w <= 520 && can.x === rail.w + wrap.w && can.w > 500 && can.position === 'fixed' && can.h === 900,
    'three panes: the rail ' + rail.w + 'px, the plan ' + wrap.w + 'px, the map the rest (' + can.w + 'px), as tall as the window');
  /* the day is drawn as in a pane that wide (a phone's cards), not as on a 1440px page */
  const dv = await pg.evaluate(() => ({ route: !!document.querySelector('#viewTrip .dayview .explorer'), daybar: (document.querySelector('#viewTrip .daybar') || { offsetParent: null }).offsetParent !== null, vsw: (document.querySelector('.vsw-row') || { offsetParent: null }).offsetParent !== null,
    sum: (document.querySelector('.ws-sum') || {}).textContent || '', buf: document.querySelectorAll('.ws-leg .ws-buf').length, legs: document.querySelectorAll('.ws-leg[data-wsleg]').length, qa: document.querySelectorAll('.slot .ws-qa').length, cards: document.querySelectorAll('#viewTrip .slot[data-slotkey]:not(.free)').length }));
  t.ok(!dv.route && !dv.daybar && !dv.vsw, 'the day has no route card, row of day numbers or Day / Explore switch of its own (the rail and the map are those)');
  t.ok(/\d+ stops?/.test(dv.sum) && /getting around/.test(dv.sum) && /to/.test(dv.sum), 'a line adds the day up: ' + dv.sum.replace(/\s+/g, ' '));
  t.ok(dv.legs >= 2 && dv.buf >= 1, 'each way between two stops is a row, with the time to spare where there is some (' + dv.legs + ' ways, ' + dv.buf + ' with spare time)');
  t.ok(dv.qa === 0, 'a card has no row of quick buttons on the desktop (' + dv.qa + ')');

  /* ---------- the map pane without a street map: the route as a list ---------- */
  const em = await pg.evaluate(() => { const e = document.getElementById('wcEmpty'); return { shown: !e.hidden && e.offsetParent !== null, text: e.textContent, items: e.querySelectorAll('li').length, gm: (e.querySelector('a[href*="google."]') || {}).textContent, title: document.getElementById('wcTitle').textContent, sketch: !!e.querySelector('svg, canvas') }; });
  t.ok(em.shown && /No street map for Rome yet|Looking for the street map/.test(em.text) && em.items >= 3 && /Google Maps/.test(em.gm || '') && !em.sketch, 'a place with no street map shows the day\'s route as a list with the way to Google Maps, never a sketch: ' + em.items + ' stops');
  t.ok(/Day 2 · Rome/.test(em.title), 'the pane says which day it shows: ' + em.title);

  /* ---------- a card and its pin (a stand-in pin: the tests have no map pack) ---------- */
  const key = await pg.evaluate(() => { const x = W.P.days[1].slots.find(x => x.item && !W.isFood(x.slot)); const p = document.createElement('a'); p.className = 'vt-pin'; p.href = 'https://www.google.com/maps'; p.setAttribute('data-keys', x.key); p.innerHTML = '<b>C</b><span>stand-in</span>'; p.style.cssText = 'position:absolute;right:60px;top:300px;z-index:9'; document.getElementById('wsCanvas').appendChild(p); return x.key; });
  await pg.hover('.wrap .slot[data-slotkey="' + key + '"]'); await pg.waitForTimeout(200);
  t.ok(await pg.evaluate(() => document.querySelector('#wsCanvas .vt-pin[data-keys]').classList.contains('hi')), 'the pointer over a card lights its pin');
  await pg.hover('#wrNav'); await pg.waitForTimeout(150);
  t.ok(await pg.evaluate(() => !document.querySelector('#wsCanvas .vt-pin.hi') && !document.querySelector('.wrap .slot.ws-hi')), 'and nothing stays lit when it leaves');
  await pg.hover('#wsCanvas .vt-pin[data-keys]'); await pg.waitForTimeout(200);
  t.ok(await pg.evaluate(k => document.querySelector('.wrap .slot[data-slotkey="' + k + '"]').classList.contains('ws-hi'), key), 'the pointer over a pin lights its card');
  /* v174: a city with a space in its name ("Naxos Town"). The pin's list of stops was split on spaces, so every pin in
     the city shared a piece of its key and the pointer over one lit them all (and never its card). */
  await pg.evaluate(() => { const mk = (k, top, many) => { const p = document.createElement('a'); p.className = 'vt-pin t-sp'; p.setAttribute('data-keys', many ? [k, 'Greece|Naxos Town|3|pm'].join('\n') : k); p.innerHTML = '<b>D</b><span>stand-in</span>'; p.style.cssText = 'position:absolute;right:160px;top:' + top + 'px;z-index:9'; document.getElementById('wsCanvas').appendChild(p); };
    mk('Greece|Naxos Town|1|am', 380); mk('Greece|Naxos Town|2|pm', 440, true);
    const c = document.createElement('div'); c.className = 'slot t-sp'; c.setAttribute('data-slotkey', 'Greece|Naxos Town|1|am'); c.textContent = 'stand-in card'; document.querySelector('.wrap').appendChild(c); });
  await pg.hover('#wsCanvas .vt-pin.t-sp'); await pg.waitForTimeout(200);
  const spc = await pg.evaluate(() => ({ lit: [...document.querySelectorAll('#wsCanvas .vt-pin.t-sp')].map(p => p.classList.contains('hi')), card: document.querySelector('.wrap .slot.t-sp').classList.contains('ws-hi'), keys: W.pinKeys(document.querySelectorAll('#wsCanvas .vt-pin.t-sp')[1]) }));
  t.ok(spc.lit[0] && !spc.lit[1] && spc.card, 'in a city with a space in its name, the pointer over one pin lights that pin and its card, not every pin: ' + JSON.stringify(spc));
  t.eq(spc.keys, ['Greece|Naxos Town|2|pm', 'Greece|Naxos Town|3|pm'], 'a pin for two stops lists both, whole');
  await pg.evaluate(() => document.querySelectorAll('.t-sp').forEach(e => e.remove())); await pg.hover('#wrNav'); await pg.waitForTimeout(150);
  const pagesBefore = ctx.pages().length;
  await pg.click('#wsCanvas .vt-pin[data-keys]'); await pg.waitForSelector('#sheethost .sheet'); await pg.waitForTimeout(400);
  const ins = await pg.evaluate(() => { const s = document.querySelector('#sheethost .sheet'), r = s.getBoundingClientRect(), w = document.querySelector('.wrap').getBoundingClientRect();
    return { modal: s.getAttribute('aria-modal'), back: getComputedStyle(document.querySelector('#sheethost .sheet-back')).display, left: Math.round(r.left), wrapRight: Math.round(w.right), w: Math.round(r.width), h: Math.round(r.height), lock: getComputedStyle(document.documentElement).overflowY, sel: document.querySelectorAll('.wrap .slot.ws-sel').length, pin: document.querySelector('#wsCanvas .vt-pin[data-keys]').classList.contains('sel') }; });
  t.ok(ctx.pages().length === pagesBefore, 'a click on a pin stays in the app (on a phone it opens Google Maps)');
  t.ok(ins.modal === 'false' && ins.back === 'none' && ins.left >= ins.wrapRight && ins.w >= 360 && ins.w <= 440 && ins.h > 400, 'it opens the stop as an inspector beside the plan: no dimmed page, ' + ins.w + 'px wide, to the right of the plan');
  t.ok(ins.lock !== 'hidden' && ins.sel === 1 && ins.pin, 'the plan still scrolls, and the open stop\'s card and pin are marked');
  await pg.evaluate(() => scrollTo(0, 0)); await pg.mouse.move(540, 600); await pg.mouse.wheel(0, 260); await pg.waitForTimeout(250);
  t.ok(await pg.evaluate(() => scrollY) > 100, 'wheel over the plan scrolls it while the inspector is open');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
  t.ok(await pg.evaluate(() => !document.querySelector('#sheethost .sheet')), 'Esc closes the inspector');
  /* a hop in the list and the pane's scroll bar */
  await pg.evaluate(() => scrollTo(0, 0)); await pg.hover('.wrap .ws-leg[data-wsleg]'); await pg.waitForTimeout(150);
  t.ok(await pg.evaluate(() => !!document.querySelector('.wrap .ws-leg.ws-hi') && !document.querySelector('.wrap .slot.ws-hi') && getComputedStyle(document.querySelector('.wrap .ws-leg.ws-hi')).backgroundColor === 'rgba(0, 0, 0, 0)'), 'the pointer over a way between two stops lights the two pins it joins on the map, but nothing in the list glows');
  /* the street map places its pins itself, every frame: nothing may ease where a pin is (v153 eased it for 0.12 s, so
     the pins trailed the map on every zoom and slid in from far away on every new day), and no lines between them */
  const dcss = require('fs').readFileSync(require('path').join(t.root, 'trip', 'app.desk.css'), 'utf8'), vt = require('fs').readFileSync(require('path').join(t.root, 'trip', 'lib', 'vtmap.js'), 'utf8');
  t.ok(!/\.vt-pin\{[^}]*transition:[^};]*transform/.test(dcss) && /\.ws-canvas \.vt-pin b\{transition:transform/.test(dcss), 'a pin\'s dot grows under the pointer, but the pin itself never eases: it stays on its place as the map zooms');
  t.ok(/function spotGroups/.test(vt) && !/W\.vtLegs|"legs-hi"/.test(vt), 'on the desktop each stop keeps its own pin on its own spot at every zoom, with no lines between the pins');
  const bar = await pg.evaluate(async () => { scrollTo(0, 300); await new Promise(r => setTimeout(r, 200)); const b = document.getElementById('wsBar'), r = b.getBoundingClientRect(), w = document.querySelector('.wrap').getBoundingClientRect(); return { on: b.classList.contains('on'), x: Math.round(r.right), wr: Math.round(w.right), native: getComputedStyle(document.documentElement).scrollbarWidth }; });
  t.ok(bar.on && Math.abs(bar.wr - bar.x) <= 12 && bar.native === 'none', 'the plan\'s scroll bar is at the plan\'s own edge, not the window\'s');

  /* ---------- the keyboard ---------- */
  await pg.evaluate(() => scrollTo(0, 0));
  await pg.keyboard.press('Control+k'); await pg.waitForSelector('#wsPal.on input');
  t.ok(await pg.evaluate(() => document.activeElement === document.querySelector('#wsPal input') && document.querySelectorAll('#wsPal .wp-i').length > 5), 'Ctrl+K opens the palette, the keyboard in its box');
  await pg.keyboard.type('3'); await pg.waitForTimeout(150);
  const first = await pg.evaluate(() => document.querySelector('#wsPal .wp-i[aria-selected="true"]').textContent);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
  t.ok(/^Day\s*Day 3/.test(first) && await pg.evaluate(() => W.S.day === 3 && !document.querySelector('#wsPal.on')), '"3" then Enter goes to Day 3: ' + first.slice(0, 40));
  await pg.keyboard.press(']'); await pg.waitForTimeout(350); const d4 = await pg.evaluate(() => W.S.day);
  await pg.keyboard.press('['); await pg.waitForTimeout(350); const d3 = await pg.evaluate(() => W.S.day);
  t.ok(d4 === 4 && d3 === 3, '] goes to the next day and [ back');
  await pg.keyboard.press('Control+k'); await pg.waitForSelector('#wsPal.on input'); await pg.keyboard.type('[budget'); await pg.waitForTimeout(150);
  t.ok(await pg.evaluate(() => W.S.day === 3 && document.querySelector('#wsPal input').value === '[budget'), 'a [ typed into a box is a letter, not a day');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  t.ok(await pg.evaluate(() => !document.querySelector('#wsPal.on')), 'Esc closes the palette');

  /* ---------- a card dropped on a day in the rail (v188: no hover row of quick buttons any more) ---------- */
  await pg.evaluate(() => { W.S.day = 2; W.render(); scrollTo(0, 0); }); await settle(pg, 1500);
  const was = await pg.evaluate(() => { const x = W.P.days[1].slots.find(x => x.item && !W.isFood(x.slot)); return { key: x.key, slot: x.slot, a: x.item.n, b: (W.P.days[2].slots.find(y => y.slot === x.slot).item || {}).n }; });
  const at = slot => pg.evaluate(slot => [(W.P.days[1].slots.find(y => y.slot === slot).item || {}).n, (W.P.days[2].slots.find(y => y.slot === slot).item || {}).n], slot);
  const card = '.wrap .slot[data-slotkey="' + was.key + '"]';
  await pg.hover(card); await pg.waitForTimeout(150);
  const g = await (await pg.$(card + ' > .num, ' + card + ' .thumb')).boundingBox(), dd = await (await pg.$('.wr-day[data-wsday="3"]')).boundingBox(), far = await pg.$('.wr-day[data-wsday="' + (await pg.evaluate(() => W.P.days.find(d => d.stop === 1).n)) + '"]');
  await pg.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await pg.mouse.down(); await pg.mouse.move(g.x - 30, g.y + 30, { steps: 4 }); await pg.mouse.move(dd.x + 70, dd.y + dd.height / 2, { steps: 8 }); await pg.waitForTimeout(120);
  const mid = await pg.evaluate(() => ({ drop: (document.querySelector('.wr-day.drop') || {}).dataset, on: document.documentElement.classList.contains('ws-dragging') }));
  const farCan = await far.evaluate(e => e.classList.contains('can'));
  await pg.mouse.up(); await settle(pg, 1500);
  const now = await at(was.slot);
  t.ok(mid.on && mid.drop && mid.drop.wsday === '3' && now[1] === was.a, 'a card dragged by its handle onto Day 3 in the rail moves there');
  t.ok(!farCan, 'a day in another town is not somewhere to drop it (a place stays in its town)');
  await pg.evaluate(() => { const u = document.querySelector('#undohost [data-undo], #undohost button'); if (u) u.click(); }); await settle(pg, 1200);

  /* ---------- what to show, and the panes ---------- */
  const foodN = await pg.evaluate(() => [...document.querySelectorAll('.wrap .slot.food')].filter(e => e.offsetParent).length);
  await pg.click('.wr-f.food'); await pg.waitForTimeout(400);
  const hid = await pg.evaluate(() => ({ food: [...document.querySelectorAll('.wrap .slot.food')].filter(e => e.offsetParent).length, list: document.querySelectorAll('#wcEmpty li.food').length, pressed: document.querySelector('.wr-f.food').getAttribute('aria-pressed') }));
  t.ok(foodN > 0 && hid.food === 0 && hid.list === 0 && hid.pressed === 'false', '"Meals" off in the rail takes the meals off the plan and the map pane (' + foodN + ' hidden)');
  await pg.click('.wr-f.food'); await pg.waitForTimeout(300);
  await pg.click('#wsRail [data-ws="rail"]'); await pg.waitForTimeout(300);
  t.ok((await box('#wsRail')).w === 64 && (await box('.wrap')).x === 64, 'the rail folds to a strip, and the plan moves up to it');
  await pg.click('#wsRail [data-ws="rail"]'); await pg.waitForTimeout(300);
  const w0 = (await box('.wrap')).w, sp = await (await pg.$('#wsSplit')).boundingBox();
  await pg.mouse.move(sp.x + 5, 420); await pg.mouse.down(); await pg.mouse.move(sp.x + 105, 420, { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(400);
  const w1 = (await box('.wrap')).w, saved = await pg.evaluate(() => JSON.parse(localStorage.getItem('waypoint-ws')));
  t.ok(w1 >= w0 + 90 && saved.center === w1, 'dragging the handle makes the plan wider (' + w0 + ' to ' + w1 + 'px), remembered on this device');
  await pg.dblclick('#wsSplit'); await pg.waitForTimeout(300);
  t.ok((await box('.wrap')).w === w0, 'a double-click on it puts the width back');
  await pg.click('#wsCanvas [data-ws="map"]'); await pg.waitForTimeout(400);
  const noMap = await pg.evaluate(() => ({ wide: document.documentElement.classList.contains('ws-wide'), canvas: getComputedStyle(document.getElementById('wsCanvas')).display, w: document.querySelector('.wrap').clientWidth, back: !!document.querySelector('#wrTools [data-ws="map"]') }));
  t.ok(noMap.wide && noMap.canvas === 'none' && noMap.w > 1000 && noMap.back, 'hiding the map gives the plan the whole width, with "Show the map" in the rail');
  await pg.click('#wrTools [data-ws="map"]'); await pg.waitForTimeout(400);

  /* ---------- Plan and Prepare: the width, in columns ---------- */
  await pg.click('#wrNav [data-ws="view:book"]'); await pg.waitForSelector('#viewBook .bookview'); await settle(pg, 2500);
  const bk = await pg.evaluate(() => { const v = document.querySelector('#viewBook .bookview'), cols = [...v.querySelectorAll(':scope > .bv-main, :scope > .bv-aside')], heads = [...v.querySelectorAll('h2')].map(h => h.textContent.trim());
    const main = v.querySelector('.bv-main'), inMain = [...main.querySelectorAll('h2')].map(h => h.textContent.trim()), pk = [...v.querySelectorAll('.pk-list > li.chk')].slice(0, 30).map(li => Math.round(li.getBoundingClientRect().left)), tb = [...v.querySelectorAll('.bk-ahead .checklist > .chk')].slice(0, 2).map(li => Math.round(li.getBoundingClientRect().top));
    return { all: v.classList.contains('ws-all'), cols: cols.length, tops: cols.map(c => Math.round(c.getBoundingClientRect().top)), lefts: cols.map(c => Math.round(c.getBoundingClientRect().left)), heads, tabs: (v.querySelector('.prep-seg') || { offsetParent: null }).offsetParent !== null, sub: [...document.querySelectorAll('#wrNav .sub')].map(x => x.textContent.trim()), open: [...v.querySelectorAll('.chk-gb')].every(b => b.getAttribute('aria-expanded') !== 'false'), inMain, pkCols: new Set(pk).size, tbRow: tb.length === 2 && tb[0] === tb[1], page: document.documentElement.scrollHeight }; });
  t.ok(bk.all && bk.cols === 2 && new Set(bk.tops).size === 1 && new Set(bk.lefts).size === 2, 'Prepare is a wide column and a side column');
  t.ok(bk.inMain.includes('To book') && bk.inMain.some(h => /Pack/.test(h)) && bk.tbRow && bk.pkCols >= 2, 'the long lists (To book, Pack) are in the wide one, each flowing into columns of its own (' + bk.pkCols + ' packing columns)');
  t.note('Prepare at 1440 px: ' + bk.page + ' px tall');
  t.ok(['To book', 'Booked', 'Budget', 'Take along'].every(h => bk.heads.includes(h)) && bk.heads.some(h => /Pack/.test(h)) && !bk.tabs, 'with every part on the page at once, and no tabs to switch between them: ' + bk.heads.join(' · '));
  t.ok(['To book', 'Booked', 'Budget', 'Pack', 'Take along'].every(s => bk.sub.includes(s)), 'the rail lists Prepare\'s parts, to go to one');
  await pg.click('#wrNav [data-ws="view:setup"]'); await pg.waitForSelector('#viewSetup details.step'); await settle(pg, 2500);
  const pl = await pg.evaluate(() => { const st = [...document.querySelectorAll('#viewSetup details.step')], cols = [...document.querySelectorAll('#viewSetup .su-col')];
    const gaps = cols.map(c => { const k = [...c.children].map(e => e.getBoundingClientRect()); return k.slice(1).map((r, i) => Math.round(r.top - k[i].bottom)); });
    return { n: st.length, open: st.filter(d => d.open).length, cols: cols.map(c => [...c.querySelectorAll('details.step .step-h b, details.step summary b')].map(b => b.textContent.trim()).join(' ')), tops: cols.map(c => Math.round(c.getBoundingClientRect().top)), lefts: cols.map(c => Math.round(c.getBoundingClientRect().left)), gaps, eat: [...document.querySelectorAll('#viewSetup details.eat-f')].every(d => d.open) }; });
  t.ok(pl.n >= 4 && pl.open === pl.n && pl.eat, 'Plan\'s steps are open, the allergy and diet lists too (' + pl.open + ' of ' + pl.n + ')');
  t.ok(pl.cols.length === 2 && pl.tops[0] === pl.tops[1] && pl.lefts[0] < pl.lefts[1] && pl.gaps.every(g => g.every(x => x >= 0 && x <= 24)), 'in two columns side by side, each stacked on its own with no holes: ' + JSON.stringify({ cols: pl.cols, gaps: pl.gaps }));
  /* text is not left to run the width of the screen */
  const prose = await pg.evaluate(() => { const ps = [...document.querySelectorAll('#viewSetup p')].filter(p => p.offsetParent && p.textContent.length > 120); const f = parseFloat(getComputedStyle(document.body).fontSize); return ps.length ? Math.max(...ps.map(p => p.getBoundingClientRect().width / (parseFloat(getComputedStyle(p).fontSize) || f))) : 0; });
  t.ok(prose > 0 && prose < 40, 'a long paragraph is no wider than about 65 characters (' + Math.round(prose) + ' em)');

  /* ---------- the itinerary as a file ---------- */
  const csv = await pg.evaluate(async () => { const P = W.P, it = P.days[1].slots.find(x => x.item).item, was = it.n; it.n = '=SUM(A1:A9), "x"'; let got = null; const real = W.saveFile; W.saveFile = (name, blob) => blob.arrayBuffer().then(buf => { const u = new Uint8Array(buf); got = { name, bom: u[0] === 0xef && u[1] === 0xbb && u[2] === 0xbf, text: new TextDecoder().decode(u) }; });
    await W.csvExport(P); it.n = was; W.saveFile = real; const rows = W.csvRows(P); return { name: got && got.name, bom: got && got.bom, safe: got && got.text.indexOf('"\'=SUM(A1:A9), ""x"""') > -1, head: rows[0].join(','), n: rows.length - 1, items: P.days.reduce((n, d) => n + d.slots.filter(x => x.item).length, 0), tool: !!document.querySelector('#wrTools [data-ws="csv"]') }; });
  t.ok(csv.tool && /itinerary\.csv$/.test(csv.name || '') && csv.bom && csv.n === csv.items && /^Day,Date,Weekday,City,Start,End/.test(csv.head), '"Export itinerary (CSV)" in the rail saves one row per stop (' + csv.n + ' rows)');
  /* (v176) a negative number (a longitude west of Greenwich) stays a number: only text that looks like a formula is guarded */
  const neg = await pg.evaluate(async () => { let text = ''; const real = W.saveFile; W.saveFile = (n, blob) => blob.text().then(x => { text = x; });
    const x = W.P.days[0].slots.find(s => s.item), was = x.item.lng; x.item.lng = -9.1393; await W.csvExport(W.P); x.item.lng = was; W.saveFile = real; return text; });
  t.ok(/,-9\.1393(,|\r|$)/.test(neg) && !/'-9\.1393/.test(neg), 'a negative number stays a number in the CSV');
  t.ok(csv.safe, 'a name that starts with = is written as text, never as a spreadsheet formula');

  /* ---------- narrower: two panes; narrow: the phone layout, and back, with nothing lost ---------- */
  await pg.click('#wrNav [data-ws="view:days"]'); await settle(pg, 1500);
  /* (the rail was folded and opened by hand above, and a choice made by hand holds at every width: back to "by the window's width") */
  await pg.evaluate(() => W.wsSet('rail', null));
  await pg.setViewportSize({ width: 1100, height: 800 }); await pg.waitForTimeout(700);
  const lg = await pg.evaluate(() => ({ rail: document.getElementById('wsRail').getBoundingClientRect().width, wrap: Math.round(document.querySelector('.wrap').getBoundingClientRect().width), can: Math.round(document.getElementById('wsCanvas').getBoundingClientRect().width), over: document.documentElement.scrollWidth - innerWidth, days: document.querySelectorAll('.wr-day').length }));
  t.ok(lg.rail === 64 && lg.wrap >= 400 && lg.can >= 480 && lg.over <= 0 && lg.days > 0, 'at 1100px: two panes (the plan ' + lg.wrap + 'px, the map ' + lg.can + 'px) and the rail as a strip of icons and day numbers');
  await pg.evaluate(() => { W.S.day = 2; W.render(); const x = W.P.days[1].slots.find(x => x.item && !W.isFood(x.slot)); W.openStop(x.key); }); await pg.waitForSelector('#sheethost .sheet'); await pg.waitForTimeout(300);
  const keep0 = await pg.evaluate(() => ({ day: W.S.day, stop: document.querySelector('#sheethost .sheet b').textContent, y: scrollY }));
  await pg.setViewportSize({ width: 800, height: 900 }); await pg.waitForTimeout(800);
  const ph = await pg.evaluate(() => ({ desk: W.desk(), ws: document.documentElement.classList.contains('ws'), top: getComputedStyle(document.querySelector('.top')).display, tripbar: !!document.querySelector('.top #tripbar'), next: document.getElementById('nextbar').parentNode.className, rail: getComputedStyle(document.getElementById('wsRail')).display, canvas: getComputedStyle(document.getElementById('wsCanvas')).display,
    day: W.S.day, stop: (document.querySelector('#sheethost .sheet b') || {}).textContent, modal: (document.querySelector('#sheethost .sheet') || { getAttribute() {} }).getAttribute('aria-modal'), back: getComputedStyle(document.querySelector('#sheethost .sheet-back') || document.body).display, wrap: Math.round(document.querySelector('.wrap').getBoundingClientRect().width), qa: document.querySelectorAll('.ws-qa').length }));
  t.ok(!ph.desk && !ph.ws && ph.top !== 'none' && ph.tripbar && ph.next === 'wrap' && ph.rail === 'none' && ph.canvas === 'none' && ph.qa === 0, 'at 800px the workspace is off: the banner is back with the trip switcher in it, no rail, no map pane, no desktop extras on the cards');
  t.ok(ph.day === keep0.day && ph.stop === keep0.stop && ph.modal === 'true' && ph.back !== 'none', 'the same day and the same open stop, now as the phone\'s sheet over a dimmed page');
  await pg.setViewportSize({ width: 1440, height: 900 }); await pg.waitForTimeout(800);
  const back = await pg.evaluate(() => ({ desk: W.desk(), day: W.S.day, stop: (document.querySelector('#sheethost .sheet b') || {}).textContent, modal: (document.querySelector('#sheethost .sheet') || { getAttribute() {} }).getAttribute('aria-modal'), tripbar: !!document.querySelector('#wsRail #tripbar') }));
  t.ok(back.desk && back.day === keep0.day && back.stop === keep0.stop && back.modal === 'false' && back.tripbar, 'wide again: the workspace, the same day and stop, the stop beside the plan again');
  await pg.keyboard.press('Escape');
  /* words half typed survive the change of layout too */
  await pg.click('#wrNav [data-ws="view:setup"]'); await pg.waitForSelector('#eatLove'); await pg.focus('#eatLove'); await pg.keyboard.type('sushi and pi'); 
  await pg.setViewportSize({ width: 800, height: 900 }); await pg.waitForTimeout(700);
  const typed1 = await pg.evaluate(() => ({ v: (document.getElementById('eatLove') || {}).value, desk: W.desk() }));
  await pg.keyboard.type('zza');
  await pg.setViewportSize({ width: 1440, height: 900 }); await pg.waitForTimeout(700);
  const typed2 = await pg.evaluate(() => ({ v: (document.getElementById('eatLove') || {}).value, desk: W.desk(), focus: document.activeElement && document.activeElement.id }));
  t.ok(typed1.v === 'sushi and pi' && !typed1.desk && typed2.v === 'sushi and pizza' && typed2.desk && typed2.focus === 'eatLove', 'what you were typing is still in its box, the keyboard still in it, after narrow and wide again: "' + typed2.v + '"');
  t.eq(errors(), [], 'no page errors');
  await ctx.close();

  /* ---------- a phone never loads any of it ---------- */
  const p2 = await open(b, { width: 390, height: 844, db: mkdb() }); await exampleTrip(p2.pg); await settle(p2.pg, 3000);
  await p2.pg.evaluate(async () => { W.needLater(); for (let i = 0; i < 80 && !W.laterReady; i++) await new Promise(r => setTimeout(r, 100)); W.render(); });
  const phone = await p2.pg.evaluate(() => ({ desk: W.desk(), asked: performance.getEntriesByType('resource').some(r => /app\.desk\.css/.test(r.name)), sheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.getAttribute('href') + (l.disabled ? ' off' : '')), rail: !!document.getElementById('wsRail'), wait: document.documentElement.classList.contains('ws-wait'), qa: document.querySelectorAll('.ws-qa, .ws-sum, .ws-buf, [data-wsleg], [data-wsidea]').length }));
  t.ok(!phone.desk && !phone.asked && !phone.rail && !phone.wait && phone.qa === 0 && phone.sheets.every(s => !/ off$/.test(s)) && phone.sheets.some(s => /^app\.min\.css/.test(s)), 'on a phone: no workspace, its stylesheet never fetched, the phone stylesheets in force, nothing of it in the page: ' + phone.sheets.join(', '));
  t.eq(p2.errors(), [], 'no page errors on the phone');
  await p2.ctx.close(); await b.close();
};
