/* What every screen must have once it is open (was the smoke suite until v179; now part of layout and desktop, which
   open every screen anyway): exactly one view showing, and something in it. textContent, not innerText: the
   storybook's pages use content-visibility:auto, and a background tab's skipped pages have no innerText until the
   browser next paints them. */
module.exports = async pg => pg.evaluate(() => {
  const vis = [...document.querySelectorAll('main')].filter(m => !m.hidden);
  const txt = vis.map(m => m.textContent.replace(/\s+/g, ' ').trim().length).reduce((a, b) => a + b, 0);
  return { views: vis.map(m => m.id), txt };
});
