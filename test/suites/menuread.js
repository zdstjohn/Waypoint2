/* v164: a menu read from a photo (lib/menuread.js). On a meal's sheet, "Read the menu" takes photos (the phone's
   picker), shrinks them, asks Claude with the family's food needs, and shows the dishes by how well they suit them:
   good for everyone, the kids will like, ask first, skip; with phrases for the waiter and a word to check allergens.
   Not on a sight's sheet, not where pictures can't be sent, and an answer that breaks off says so. */
const { launch, open, exampleTrip, settle } = require('../lib/page');
/* a 1x1 PNG, for the phone's picker */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
exports.run = async t => {
  const b = await launch();
  const prep = async pg => { await exampleTrip(pg); await settle(pg, 4000); await pg.evaluate(() => W.needLater && W.needLater());
    await pg.waitForFunction(() => !!W.menuReadBlock && !!W.openStop, null, { timeout: 20000 });
    return pg.evaluate(() => { W.S.eat = { al: ['treenuts'], di: [], love: 'pasta', avoid: 'very spicy food' };   /* (love and avoid: from a trip saved before v202, no longer read) */ const d = W.P.days[W.S.day - 1];
      const f = d.slots.find(x => x.item && W.isFood(x.slot)), s = d.slots.find(x => x.item && !W.isFood(x.slot)); return { food: f && f.key, sight: s && s.key }; }); };
  { const { pg, errors } = await open(b, { width: 390, height: 844 }); const k = await prep(pg);
    await pg.evaluate(k => W.openStop(k), k.food); await pg.waitForSelector('#sheethost .sheet [data-menuread]', { timeout: 8000 });
    const idle = await pg.evaluate(() => { const s = document.querySelector('#sheethost .mr'); return { text: s.textContent, btn: s.querySelector('.btn.quiet[data-menuread]') ? s.querySelector('[data-menuread]').textContent.trim() : '', after: !!s.closest('.menu-b') && s.previousElementSibling && s.previousElementSibling.tagName === 'H3' }; });
    t.ok(idle.btn === 'Read the menu' && /any language/.test(idle.text) && idle.after, 'a meal\'s sheet offers "Read the menu" first thing in its Menu: ' + JSON.stringify(idle));
    /* the phone's picker: two photos */
    const [fc] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 5000 }), pg.click('#sheethost [data-menuread]')]);
    t.ok(fc.isMultiple(), 'the picker takes several pages at once');
    await fc.setFiles([{ name: 'p1.png', mimeType: 'image/png', buffer: PNG }, { name: 'p2.png', mimeType: 'image/png', buffer: PNG }]);
    await pg.waitForFunction(k => { const m = W.menuState(k); return m && m.state === 'done'; }, k.food, { timeout: 10000 });
    await pg.waitForTimeout(300);
    const r = await pg.evaluate(() => { const s = document.querySelector('#sheethost .mr'); const g = c => [...s.querySelectorAll('.mr-' + c + ' .mr-d')].map(d => d.querySelector('b').textContent);
      return { ask: window.__menuAsk, all: g('all'), kids: g('kids'), askG: g('ask'), skip: g('skip'), skipFolded: !!s.querySelector('details.mr-skip:not([open])'), whyAll: !!s.querySelector('.mr-all .mr-why'), why: [...s.querySelectorAll('.mr-ask .mr-why')].map(x => x.textContent),
        orig: [...s.querySelectorAll('.mr-o')].map(x => x.textContent), say: s.querySelector('.mr-say') ? s.querySelector('.mr-say').textContent : '', note: s.querySelector('.mr-sum').textContent, xss: !!window.__xss || !!s.querySelector('img'), again: (s.querySelector('[data-menuread]') || {}).textContent }; });
    t.ok(r.ask && r.ask.n === 2 && r.ask.types.every(x => x === 'image/jpeg') && r.ask.tier === 'default', 'both photos went to Claude, as small JPEGs: ' + JSON.stringify(r.ask && { n: r.ask.n, types: r.ask.types, sizes: r.ask.sizes }));
    t.ok(/tree nuts/.test(r.ask.prompt) && !/pasta|spicy/.test(r.ask.prompt) && /ages/i.test(r.ask.prompt), 'the question carries the family\'s allergies and diets and their ages (not what an older trip saved as loved or avoided)');
    t.eq([r.all, r.kids, r.skip], [['Fish of the day'], ['Spaghetti with tomato sauce'], ['Mussels']], 'dishes by how they suit the family: everyone, the kids, skip');
    t.ok(r.askG.length === 2 && r.askG.includes('Trofie with pesto') && r.why.includes('may contain tree nuts') && !r.whyAll, '"Ask first" says why (a dish of unknown fit lands there too); "good for everyone" has no reason line');
    t.ok(r.skipFolded && r.orig.includes('Trofie al pesto') && /allergico/.test(r.say) && /check allergens with the staff/.test(r.note) && /Italian · 5 dishes/.test(r.note) && /Read another menu/.test(r.again || ''), 'skip is folded away, the printed name is kept, phrases for the waiter, a word to check allergens, and another menu is a tap away');
    t.ok(!r.xss, 'what Claude wrote is shown as text, never as markup');
    /* an answer that breaks off */
    await pg.evaluate(k => { window.__menuFail = true; W.menuRead(k, [new File([new Uint8Array(10)], 'x.png', { type: 'image/png' })]); }, k.food);
    await pg.waitForFunction(k => { const m = W.menuState(k); return m && m.state === 'error'; }, k.food, { timeout: 10000 });
    /* (the sheet is redrawn with the next batch of answers: within a second while you are tapping, v202 lib/core.js) */
    await pg.waitForFunction(() => !!document.querySelector('#sheethost .mr .mr-err'), null, { timeout: 5000 }).catch(() => {});
    const er = await pg.evaluate(() => { const s = document.querySelector('#sheethost .mr'); return { err: (s.querySelector('.mr-err') || {}).textContent, btn: !!s.querySelector('[data-menuread]') }; });
    t.ok(/Couldn't read that menu/.test(er.err || '') && er.btn, 'a photo that is not a picture or an answer that breaks off says so, with the button to try again: ' + er.err);
    /* a sight's sheet: no menu */
    await pg.evaluate(() => W.closeStop && W.closeStop()); await pg.waitForTimeout(300);
    await pg.evaluate(k => W.openStop(k), k.sight); await pg.waitForSelector('#sheethost .sheet', { timeout: 8000 }); await pg.waitForTimeout(300);
    t.ok(await pg.evaluate(() => !document.querySelector('#sheethost [data-menuread]')), 'a sight\'s sheet has no menu to read');
    t.eq(errors(), [], 'no page errors');
  }
  /* where pictures can't be sent to Claude, there is no button */
  { const { pg } = await open(b, { width: 390, height: 844, init: () => { window.__noImages = true; } }); const k = await prep(pg);
    await pg.evaluate(k => W.openStop(k), k.food); await pg.waitForSelector('#sheethost .sheet', { timeout: 8000 }); await pg.waitForTimeout(500);
    t.ok(await pg.evaluate(() => !document.querySelector('#sheethost [data-menuread]')), 'where pictures can\'t be sent to Claude, a meal\'s sheet has no "Read the menu"');
  }
  await b.close();
};
