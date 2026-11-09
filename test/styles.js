/* The computed style of every element on every screen, as one JSON per screen: node test/styles.js <dir>.
   Two dumps of the same markup differ only where the stylesheet's result changed, so a CSS reorganisation can be checked
   rule by rule rather than by eye. */
const { launch, open, exampleTrip, settle } = require('./lib/page'); const fs = require('fs'); const path = require('path');
const SCREENS = require('./lib/screens');
const PROPS = ['display', 'position', 'width', 'height', 'margin', 'padding', 'border', 'border-radius', 'color', 'background-color', 'background-image', 'font-size', 'font-weight', 'font-family', 'line-height', 'letter-spacing', 'text-transform', 'opacity', 'visibility', 'gap', 'grid-template-columns', 'flex', 'align-items', 'justify-content', 'box-shadow', 'z-index', 'overflow', 'white-space', 'text-overflow', 'transform', 'inset', 'top', 'left', 'right', 'bottom', 'max-width', 'min-width', 'min-height', 'max-height', 'text-align', 'text-decoration-line', 'outline', 'filter', 'aspect-ratio', 'object-fit', 'order', 'flex-wrap', 'column-gap', 'row-gap', 'grid-column'];
(async () => {
  const dir = path.resolve(process.argv[2] || 'test/styles-out'); fs.mkdirSync(dir, { recursive: true });
  const b = await launch();
  for (const [tag, dark, width] of [['n', false, 360], ['dark', true, 360], ['wide', false, 900]]) {
    const { pg, ctx } = await open(b, { width, dark }); await exampleTrip(pg);
    for (const sc of SCREENS) {
      await pg.keyboard.press('Escape').catch(() => {});
      await pg.evaluate(sc.go); await pg.waitForTimeout(sc.wait || 900); await settle(pg);
      const dump = await pg.evaluate(PROPS => {
        const out = [];
        const sel = el => { let p = el, parts = []; while (p && p !== document.body) { let s = p.tagName.toLowerCase(); if (p.id) s += '#' + p.id; else if (p.className && typeof p.className === 'string') s += '.' + p.className.trim().split(/\s+/).join('.'); parts.unshift(s); p = p.parentElement; } return parts.join('>'); };
        for (const el of document.querySelectorAll('body *')) { if (el.closest('svg') && el.tagName !== 'svg') continue; if (el.closest('.vt-slot, .maplibregl-map')) continue; const cs = getComputedStyle(el); const v = PROPS.map(p => cs.getPropertyValue(p)); out.push([sel(el), v.join('|')]); }
        return out;
      }, PROPS);
      fs.writeFileSync(path.join(dir, `${sc.id}-${tag}.json`), JSON.stringify(dump));
    }
    await ctx.close();
  }
  await b.close(); console.log('style dumps in', dir);
})();
