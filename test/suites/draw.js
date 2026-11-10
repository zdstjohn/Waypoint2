/* Redrawing only what changed (lib/patch.js): a redraw with nothing new touches nothing; after any change the page is
   exactly what a full rebuild would give; what is being typed, the focus and the street map's place survive. */
const { launch, open, exampleTrip, settle } = require('../lib/page'); const mkdb = require('../lib/db');
exports.run = async t => {
  const b = await launch(); const { pg, errors } = await open(b, { width: 1280, height: 900, db: mkdb() }); await exampleTrip(pg);

  /* the editing itself, on small cases */
  const unit = await pg.evaluate(() => {
    const el = document.createElement('div'); document.body.appendChild(el); const out = {};
    const go = (from, to) => { el.innerHTML = from; const kept = [...el.querySelectorAll('[data-t]')]; W.patch(el, to); return { html: el.innerHTML, kept: kept.filter(n => n.isConnected).map(n => n.dataset.t).join('') }; };
    let r = go('<p data-t="a">one</p><p data-t="b">two</p>', '<p data-t="a">one</p><p data-t="b">2</p>'); out.text = r.html === '<p data-t="a">one</p><p data-t="b">2</p>' && r.kept === 'ab';
    r = go('<ul><li data-t="a">a</li><li data-t="c">c</li></ul>', '<ul><li data-t="a">a</li><li data-t="b">b</li><li data-t="c">c</li></ul>'); out.insert = /<li data-t="a">a<\/li><li data-t="b">b<\/li><li data-t="c">c<\/li>/.test(r.html);
    r = go('<h3 data-t="h">x</h3><p class="note" data-t="n">gone</p><section class="card" data-t="s"><b>keep</b></section>', '<h3 data-t="h">x</h3><section class="card" data-t="s"><b>keep</b></section>'); out.remove = r.kept === 'hs' && !/gone/.test(r.html);
    r = go('<div id="a" data-t="a">A</div><div id="b" data-t="b">B</div>', '<div id="b" data-t="b">B</div><div id="a" data-t="a">A</div>'); out.reorder = r.kept === 'ba' || r.kept === 'ab' ? r.html.indexOf('id="b"') < r.html.indexOf('id="a"') && r.kept.length === 2 : false;
    r = go('<section class="hero" data-t="x">a</section>', '<section class="list" data-t="y">b</section>'); out.replace = r.kept === '' && /class="list"/.test(r.html);
    r = go('<a class="btn" href="/1" title="t" data-t="a">go</a>', '<a class="btn on" href="/2" data-t="a">go</a>'); out.attrs = r.kept === 'a' && r.html === '<a class="btn on" href="/2" data-t="a">go</a>';
    /* a box being typed in keeps its text; one the app clears is cleared; one not in use follows the page */
    el.innerHTML = '<input id="q1" value=""><input id="q2" value="x"><input type="checkbox" id="c1">';
    const q1 = el.querySelector('#q1'), q2 = el.querySelector('#q2'), c1 = el.querySelector('#c1'); q1.focus(); q1.value = 'typing'; q2.value = 'stale'; c1.checked = true;
    W.patch(el, '<input id="q1" value=""><input id="q2" value="x"><input type="checkbox" id="c1">');
    out.typing = q1.value === 'typing' && document.activeElement === q1 && q2.value === 'x' && c1.checked === false;
    el.innerHTML = '<input id="q3" value="sent">'; const q3 = el.querySelector('#q3'); q3.focus(); q3.value = 'sent and more';
    W.patch(el, '<input id="q3" value="">'); out.cleared = q3.value === '' && q3.isConnected;
    /* the map's place: its contents are not the page's to touch */
    el.innerHTML = '<div class="wrap"><div class="vt-slot"></div><p>a</p></div>'; const slot = el.querySelector('.vt-slot'), map = document.createElement('canvas'); slot.appendChild(map);
    W.patch(el, '<div class="wrap on"><div class="vt-slot"></div><p>b</p></div>'); out.map = map.isConnected && map.parentNode === slot && el.querySelector('p').textContent === 'b';
    el.remove(); return out;
  });
  Object.keys(unit).forEach(k => t.ok(unit[k], 'edit in place: ' + k));

  /* each screen: nothing new, nothing touched; a change gives exactly the page a rebuild would */
  const screens = [
    ['a day', () => { W.S.tview = 'days'; W.S.glanceOpen = false; W.S.day = 2; W.setView('trip'); W.render(); }, 'viewTrip'],
    ['All days', () => { W.S.glanceOpen = true; W.setView('trip'); W.render(); }, 'viewTrip'],
    ['the map view', () => { W.S.glanceOpen = false; W.S.tview = 'map'; W.S.day = 2; W.setView('trip'); W.render(); }, 'viewTrip'],
  ];
  for (const [name, prep, id] of screens) {
    await pg.evaluate(prep); await settle(pg, 3000);
    const r = await pg.evaluate(async id => {
      const el = document.getElementById(id); let muts = 0; const mo = new MutationObserver(l => { muts += l.length; });
      W.render(); const d0 = Object.assign({}, W.drawn);
      mo.observe(el, { childList: true, subtree: true, characterData: true });
      const img = el.querySelector('img'), btn = el.querySelector('button:not([disabled])'); if (btn) btn.focus();
      W.render(); W.render(); muts += mo.takeRecords().length;
      const quiet = muts, same = W.drawn.same - d0.same, focus = !btn || document.activeElement === btn;
      /* a run of real changes: each time, what the edit left must equal a rebuild */
      const day = W.P.days[W.S.day - 1], diffs = [], steps = [
        () => { const x = day.slots.find(y => y.item && !W.isFood(y.slot)); if (x) W.reroll(day, x.slot, W.P); },
        () => { const r = W.S.rest || (W.S.rest = {}), k = W.restKey(day); if (r[k]) delete r[k]; else r[k] = 1; },
        () => { const x = day.slots.find(y => y.item && W.isFood(y.slot)); if (x) W.reroll(day, x.slot, W.P); },
        () => { W.S.transitOpen = !W.S.transitOpen; },
        () => { const x = W.P.days[W.S.day - 1].slots.find(y => y.item); if (x) (W.S.free || (W.S.free = {}))[x.key] = 1, delete W.S.picks[x.key]; },
        () => { const r = W.S.rest || {}; delete r[W.restKey(day)]; W.S.free = {}; },
        () => { W.setSimple(true); }, () => { W.setSimple(false); },
      ];
      let patched = 0;
      for (let i = 0; i < steps.length; i++) {
        const p0 = W.drawn.patched; steps[i](); W.render(); patched += W.drawn.patched - p0; const a = el.innerHTML;
        el._sig = null; W.render(); const bb = el.innerHTML;
        if (a !== bb) { let j = 0; while (j < a.length && a[j] === bb[j]) j++; diffs.push(i + ': …' + a.slice(Math.max(0, j - 60), j + 80) + '… vs …' + bb.slice(Math.max(0, j - 60), j + 80) + '…'); }
      }
      mo.disconnect();
      return { quiet, same, focus, diffs, patched, img: !img || img.isConnected };
    }, id);
    t.eq(r.quiet, 0, name + ': a redraw with nothing new touches nothing on the page');
    t.ok(r.same >= 2 && r.focus, name + ': and the button in use keeps the focus');
    t.eq(r.diffs, [], name + ': after each change the page equals a full rebuild');
    t.ok(r.patched >= 3, name + ': and changes were made in place (' + r.patched + ' of 8)');
  }
  /* data arriving while you type in a box on these screens redraws around it and keeps the text */
  const typed = await pg.evaluate(async () => {
    W.S.tview = 'map'; W.S.glanceOpen = false; W.setView('trip'); W.render(); await new Promise(r => setTimeout(r, 300));
    const q = document.getElementById('placeQ'); if (!q) return null; q.focus(); q.value = 'gela';
    const d0 = W.drawn.patched + W.drawn.same; W.changed(); await new Promise(r => setTimeout(r, 100));
    return { drew: W.drawn.patched + W.drawn.same > d0, text: document.getElementById('placeQ').value, focus: document.activeElement && document.activeElement.id };
  });
  t.eq(typed, { drew: true, text: 'gela', focus: 'placeQ' }, 'new data redraws Explore while you type, and the box keeps your text and the focus');
  /* Today, during the trip */
  await pg.evaluate(() => { W.setSimple(false); W.save && W.save(); localStorage.setItem('waypoint-now', '2027-06-09T10:40:00'); });
  await pg.reload(); await pg.waitForTimeout(2500); await settle(pg);
  const go = await pg.evaluate(() => {
    const el = document.getElementById('viewGo'); let muts = 0; const mo = new MutationObserver(l => { muts += l.length; });
    W.render(); mo.observe(el, { childList: true, subtree: true, characterData: true }); W.render(); W.render(); muts += mo.takeRecords().length; const quiet = muts;
    const li = el.querySelector('.go-tl li'), p0 = W.drawn.patched;
    document.querySelector('[data-late="15"]') && document.querySelector('[data-late="15"]').click();
    const a = el.innerHTML, kept = !!li && li.isConnected; el._sig = null; W.render(); mo.disconnect();
    return { view: W.view(), quiet, kept, patched: W.drawn.patched - p0, equal: a === el.innerHTML };
  });
  t.ok(go.view === 'go' && go.quiet === 0, 'Today: a redraw with nothing new touches nothing: ' + JSON.stringify(go));
  t.ok(go.patched >= 1 && go.kept && go.equal, 'Today: running late edits the times in place and equals a rebuild: ' + JSON.stringify(go));
  /* another day is another screen: drawn afresh */
  const other = await pg.evaluate(() => { W.setAppMode('plan'); W.S.tview = 'days'; W.S.glanceOpen = false; W.S.day = 1; W.setView('trip'); W.render(); const r0 = W.drawn.rebuilt; W.S.day = 3; W.render(); return W.drawn.rebuilt - r0; });
  t.ok(other >= 1, 'a different day is drawn afresh, not edited from the last one');
  t.eq(errors(), [], 'no page errors');
  await b.close();
};
