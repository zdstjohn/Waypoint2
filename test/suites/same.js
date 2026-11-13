/* What is drawn, exactly: every screen of test/lib/screens.js at every size the pictures are taken at (phone, large
   text, dark, tablet, desktop), once the app is settled and every piece of it that loads later is in. For each screen
   the record holds the page's rendered markup (every element, attribute and text, form values included) and, for
   every element, where it sits (its box), the styles a person sees (display, position, size and box, colours, fonts,
   visibility: PROPS) and one number made from ALL of its computed styles, and the same for its ::before and ::after.
   The record of this build must equal the baseline's (test/base-same, written by --update-baseline or when there is
   none), element for element, with no tolerance: it catches what a picture's anti-aliasing allowance could let
   through. A change to how the app is split into files must leave it identical.
     TZ=UTC node test/run.js same --update-baseline     write the baseline (from the build that is known good)
     TZ=UTC node test/run.js same                       compare; differences are listed in test/out/same/summary.md
     SHOT_SIZES=n,desk                                   only those sizes
     SAME_ALL=<screen>-<size>:<element number>          also write every computed style of that element (to find
                                                         what a changed number stands for) to test/out/same/
   The clock is set (the same instant at every start, running on from there), so the greeting, "in N days" and what is
   open now are the same in every run. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const SCREENS = require('../lib/screens');
const SIZES = [['n', 1, false, 360], ['big', 1.3, false, 360], ['dark', 1, true, 360], ['wide', 1, false, 900], ['desk', 1, false, 1440]];
const PROPS = ['display', 'position', 'width', 'height', 'box-sizing', 'margin', 'padding', 'border', 'border-radius', 'color', 'background-color', 'background-image', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-transform', 'text-align', 'text-decoration-line', 'white-space', 'text-overflow', 'opacity', 'visibility', 'overflow', 'z-index', 'inset', 'transform', 'filter', 'box-shadow', 'outline', 'gap', 'flex', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'order', 'grid-template-columns', 'grid-column', 'max-width', 'min-width', 'max-height', 'min-height', 'aspect-ratio', 'object-fit', 'fill', 'stroke', 'content'];
/* the clock every page starts at: a Friday mid-morning, far from any change of hour while a run lasts */
const CLOCK = `(() => { const R = Date, off = R.UTC(2026, 10, 13, 10, 5, 0) - R.now();
  window.Date = new Proxy(R, { construct(t, a) { return a.length ? new t(...a) : new t(t.now() + off); }, apply(t) { return new t(t.now() + off).toString(); }, get(t, k) { return k === 'now' ? () => t.now() + off : t[k]; } });
  /* (and the same "random" bytes: a new trip's id is drawn from them, and it is in the trips menu's markup) */
  let s = 987654321; crypto.getRandomValues = a => { for (let i = 0; i < a.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; a[i] = s >>> 24; } return a; }; })();`;
/* (as test/shots.js: nothing loading and no request out for a while) */
async function quietly(pg, quiet = 3000, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const ok = await pg.evaluate(q => { const a = window.__asks; return !(W.status && Object.values(W.status).some(v => v === 'loading')) && (!a || (a.out === 0 && Date.now() - a.at >= q)); }, quiet);
    if (ok) return; await pg.waitForTimeout(250);
  }
}
async function allDetails(pg) {
  for (let k = 0; k < 12; k++) {
    const left = await pg.evaluate(() => Object.values(W.C.city).reduce((n, c) => n + (c.spots || []).concat(c.food || []).filter(x => x.st === undefined).length, 0));
    if (!left) return;
    await pg.evaluate(() => Object.keys(W.C.city).forEach(ck => { const c = W.C.city[ck], [country, city] = ck.split('|'); W.loadBookLinks(country, city, (c.spots || []).concat(c.food || []).map(x => x.n)); }));
    await settle(pg, 15000); await quietly(pg, 1000, 30000);
  }
}
/* every piece of the app that is fetched after the first screen is in, and none is on its way (W.piecesIn says so
   where the app has more pieces than the second script) */
const allIn = pg => pg.waitForFunction(() => W.laterReady && !W.laterLoading && (!W.piecesIn || W.piecesIn()), null, { timeout: 30000, polling: 100 }).catch(() => {});
/* the record of the page as it stands (run in the page) */
function record([PROPS, all]) {
  /* (one number from a long text: two 32-bit hashes side by side) */
  const num = s => { let a = 0xdeadbeef, b = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
    a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909); return (b >>> 0).toString(36) + (a >>> 0).toString(36); };
  /* (the browser lists an element's custom properties in an order that changes from one page load to the next: by name) */
  const whole = cs => { let s = ''; const vars = []; for (let i = 0; i < cs.length; i++) { const k = cs[i], v = k + ':' + cs.getPropertyValue(k) + ';'; if (k.charCodeAt(0) === 45 && k.charCodeAt(1) === 45) vars.push(v); else s += v; } return s + vars.sort().join(''); };
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/;
  /* the greeting and the sky follow the minute, and the street map draws itself frame by frame: their insides are
     left out (the elements themselves, and where they sit, are in) */
  const inside = el => !el.matches('.tl-hi, .tl-sky, .maplibregl-map');
  let markup = ''; const els = []; let full = null, root = '';
  const walk = el => {
    const tag = el.tagName.toLowerCase();
    /* (what loads the app's files is the thing being changed: the tags that fetch them are not part of what is drawn) */
    if (tag === 'script' || tag === 'link' || tag === 'style') return;
    markup += '<' + tag;
    for (const a of el.attributes) markup += ' ' + a.name + '="' + a.value.replace(/"/g, '&quot;') + '"';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') markup += ' :value="' + String(/** @type {any} */ (el).value).replace(/"/g, '&quot;') + '"' + (/** @type {any} */ (el).checked ? ' :checked' : '');
    if (document.activeElement === el && el !== document.body) markup += ' :focus';
    markup += '>';
    const cs = getComputedStyle(el), r = el.getBoundingClientRect(), w = whole(cs);
    const row = [tag + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
      [r.x, r.y, r.width, r.height].map(v => Math.round(v * 100) / 100).join(','), PROPS.map(p => cs.getPropertyValue(p)).join('|'), num(w)];
    for (const ps of ['::before', '::after']) { const pc = getComputedStyle(el, ps), c = pc.getPropertyValue('content'); row.push(c && c !== 'none' && c !== 'normal' ? PROPS.map(p => pc.getPropertyValue(p)).join('|') + '#' + num(whole(pc)) : ''); }
    if (all === els.length) full = w;
    if (!els.length) root = w;
    els.push(row);
    if (inside(el)) for (const c of el.childNodes) { if (c.nodeType === 1) walk(/** @type {Element} */ (c)); else if (c.nodeType === 3) markup += esc(c.nodeValue || ''); }
    if (!VOID.test(tag)) markup += '</' + tag + '>';
  };
  const h = document.documentElement;
  markup += '<html'; for (const a of h.attributes) markup += ' ' + a.name + '="' + a.value + '"'; markup += '>';
  walk(document.body);
  return { markup, els, full, root, scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight].join('x') };
}
async function size(b, [tag, scale, dark, width], dir, dbg) {
  const { pg, ctx, errors } = await open(b, { width, dark, scale: 1, init: CLOCK, mocks: ['test/mocks/mockdur.js', 'test/mocks/mock2.js', 'test/mocks/steady.js'], touch: width < 1000 ? undefined : false }); await exampleTrip(pg);
  /* (the plan made knowing every answer, as test/shots.js makes it: what is drawn then depends on the code and the
     data, never on which answer came first) */
  await settle(pg, 30000); await pg.evaluate(() => { W.resetPicks(); W.replan(); W.render(); }); await settle(pg, 30000); await quietly(pg);
  await pg.evaluate(() => { ['loadCity', 'loadFame', 'loadIndoor'].forEach(k => { if (typeof W[k] === 'function') W[k] = function () {}; }); });
  await allDetails(pg);
  for (let k = 0, last = ''; k < 5; k++) {
    await pg.evaluate(() => { W.resetPicks(); W.replan(); W.render(); }); await settle(pg, 10000); await quietly(pg, 2000, 30000);
    const now = await pg.evaluate(() => JSON.stringify(W.P.days.map(d => d.slots.map(x => x.item ? x.item.n : ''))));
    if (now === last) break; last = now;
  }
  if (scale !== 1) await pg.addStyleTag({ content: `html{font-size:${scale * 100}% !important}` });
  for (const sc of SCREENS) {
    await pg.keyboard.press('Escape').catch(() => {});
    await pg.evaluate(sc.go); await pg.waitForTimeout(sc.wait || 900); await settle(pg);
    await allIn(pg); await settle(pg); await quietly(pg, 1000, 20000);
    /* (two frames, so what the last answer changed has been laid out and painted) */
    await pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
    const name = `${sc.id}-${tag}`, rec = await pg.evaluate(record, [PROPS, dbg && dbg[0] === name ? dbg[1] : -1]);
    if (rec.full != null) fs.writeFileSync(path.join(dir, name + '.el' + dbg[1] + '.txt'), rec.full.replace(/;/g, ';\n'));
    delete rec.full;
    fs.writeFileSync(path.join(dir, name + '.json.gz'), zlib.gzipSync(JSON.stringify(rec)));
    await pg.evaluate(() => scrollTo(0, 0));
  }
  /* and the first screen as a phone that has been here before draws it, BEFORE anything that loads later has come:
     the page is opened again (its trip and its lists are on the phone by now) with every file but the page, the
     first script, the first stylesheet and the fonts refused. What the first download draws by itself must not change
     either: nothing on the first screen may have moved into a piece that comes later, and no style it needs. (Not on
     the desktop, where the page is held back until the workspace is in.) */
  if (width < 1000) {
    await pg.evaluate(() => { W.goView('trip'); W.save(); }); await settle(pg);
    await pg.route('**/*', r => { const u = r.request().url().split('?')[0]; return /\/(index\.html|app\.js|app\.min\.css)$|\.woff2$/.test(u) || !/^http:\/\/127\.0\.0\.1/.test(u) ? r.continue() : r.abort(); });
    await pg.goto('about:blank'); await pg.goto('http://127.0.0.1:8771/index.html#trip'); await pg.waitForTimeout(2000);
    if (scale !== 1) await pg.addStyleTag({ content: `html{font-size:${scale * 100}% !important}` });
    for (const [id, go] of [['early-trip', () => {}], ['early-today', () => W.goView('go')], ['early-explore', () => W.goView('explore')]]) {
      await pg.evaluate(go); await pg.waitForTimeout(900); await settle(pg); await quietly(pg, 1000, 20000);
      await pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
      const rec = await pg.evaluate(record, [PROPS, -1]); delete rec.full;
      rec.later = await pg.evaluate(() => !!W.laterReady);
      fs.writeFileSync(path.join(dir, `${id}-${tag}.json.gz`), zlib.gzipSync(JSON.stringify(rec)));
    }
  }
  /* (a file refused on purpose is no error of the page's) */
  const errs = errors().filter(e => !/Failed to fetch|Load failed|NetworkError|ERR_FAILED/.test(e)); await ctx.close(); return errs;
}
const read = f => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());
exports.run = async t => {
  const base = path.join(t.root, 'test', 'base-same'), cur = path.join(t.root, 'test', 'out', 'same');
  fs.rmSync(cur, { recursive: true, force: true }); fs.mkdirSync(cur, { recursive: true });
  const only = (process.env.SHOT_SIZES || '').split(',').map(x => x.trim()).filter(Boolean), sizes = only.length ? SIZES.filter(x => only.includes(x[0])) : SIZES;
  const dm = /^(.+):(\d+)$/.exec(process.env.SAME_ALL || ''), dbg = dm ? [dm[1], +dm[2]] : null;
  const b = await launch(), queue = sizes.slice(), errs = [];
  /* two sizes at a time (each is a page of its own) */
  await Promise.all([0, 1].map(async () => { for (let s; (s = queue.shift());) { try { errs.push(...(await size(b, s, cur, dbg)).map(e => s[0] + ': ' + e)); } catch (e) { errs.push(s[0] + ': ' + (e && e.message)); } } }));
  await b.close();
  t.eq(errs, [], 'every screen was opened and recorded at every size, with no page errors');
  const names = fs.readdirSync(cur).filter(n => n.endsWith('.json.gz')).sort();
  const want = SCREENS.length * sizes.length + 3 * sizes.filter(x => x[3] < 1000).length;
  t.eq(names.length, want, `${SCREENS.length} screens at ${sizes.length} sizes recorded, and the first screens before anything later has come`);
  t.eq(names.filter(n => /^early-/.test(n)).filter(n => read(path.join(cur, n)).later).length, 0, 'the first screens were recorded with nothing later in');
  if (t.flags.has('--update-baseline') || !fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true });
    if (!only.length) fs.readdirSync(base).forEach(n => fs.rmSync(path.join(base, n)));
    names.forEach(n => fs.copyFileSync(path.join(cur, n), path.join(base, n)));
    t.note('baseline written to test/base-same' + (only.length ? ' (' + only.join(', ') + ')' : '')); return;
  }
  const out = []; let same = 0, nEls = 0;
  for (const n of names) {
    const id = n.replace(/\.json\.gz$/, '');
    if (!fs.existsSync(path.join(base, n))) { t.ok(false, id + ': not in the baseline'); continue; }
    const A = read(path.join(base, n)), B = read(path.join(cur, n)), diffs = [];
    nEls += B.els.length;
    if (A.markup !== B.markup) { let i = 0; while (i < A.markup.length && A.markup[i] === B.markup[i]) i++; diffs.push(`markup differs from character ${i}: before "${A.markup.slice(Math.max(0, i - 80), i + 120)}" after "${B.markup.slice(Math.max(0, i - 80), i + 120)}"`); }
    if (A.scroll !== B.scroll) diffs.push(`the page's size: ${A.scroll} before, ${B.scroll} after`);
    /* (every computed style of the page's body, by name: most of them are handed down to everything in the page) */
    if (A.root !== B.root) { const x = A.root.split(';'), y = new Set(B.root.split(';')); diffs.push('the body\'s computed styles: ' + x.filter(v => !y.has(v)).slice(0, 6).join('; ') + ' -> ' + B.root.split(';').filter(v => !new Set(x).has(v)).slice(0, 6).join('; ')); }
    if (A.els.length !== B.els.length) diffs.push(`${A.els.length} elements before, ${B.els.length} after`);
    let d = 0;
    for (let i = 0; i < Math.min(A.els.length, B.els.length); i++) {
      const a = A.els[i], e = B.els[i]; if (a.join('\n') === e.join('\n')) continue;
      if (d++ >= 6) continue;
      const what = [];
      if (a[0] !== e[0]) what.push(`is ${e[0]}`);
      if (a[1] !== e[1]) what.push(`box ${a[1]} -> ${e[1]}`);
      if (a[2] !== e[2]) { const x = a[2].split('|'), y = e[2].split('|'); PROPS.forEach((p, k) => { if (x[k] !== y[k]) what.push(`${p}: ${x[k]} -> ${y[k]}`); }); }
      else if (a[3] !== e[3]) what.push('a computed style outside the list changed (SAME_ALL=' + id + ':' + i + ' writes them all)');
      if (a[4] !== e[4]) what.push('::before changed'); if (a[5] !== e[5]) what.push('::after changed');
      diffs.push(`element ${i} ${a[0].slice(0, 80)}: ${what.join('; ').slice(0, 400)}`);
    }
    if (d > 6) diffs.push(`and ${d - 6} more elements`);
    if (diffs.length) { out.push(`- ${id}: ` + diffs.join('\n  - ')); t.ok(false, `${id} is drawn differently: ${diffs[0].slice(0, 300)}${diffs.length > 1 ? ' (+' + (diffs.length - 1) + ' more, test/out/same/summary.md)' : ''}`); }
    else same++;
  }
  fs.writeFileSync(path.join(cur, 'summary.md'), '### What is drawn (markup and computed styles)\n\n' + (out.length ? out.join('\n') : 'Every screen is identical to the baseline.') + '\n');
  t.ok(same === names.length, `${same} of ${names.length} screens are identical to the baseline: the same markup and, for all ${nEls} elements, the same box and computed styles`);
};
