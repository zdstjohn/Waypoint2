/* v164: Explore lists the ideas with a photo first and those without one last, in every group (the owner: "Find more
   should prioritize things to do with photos"). The test town has no photos, so two of its ideas are given one. */
const { launch, open, exampleTrip, settle } = require('../lib/page');
exports.run = async t => {
  const b = await launch();
  const { pg, errors } = await open(b, { width: 390, height: 844 }); await exampleTrip(pg); await settle(pg, 4000);
  const r = await pg.evaluate(async () => {
    W.S.tview = 'map'; W.render(); await new Promise(r => setTimeout(r, 600));
    const order = () => [...document.querySelectorAll('#viewTrip .idea-list > .idea:not(.on) h4, #viewTrip .idea-list .idea h4')].map(h => h.textContent);
    const before = order();
    /* the last idea of the list and one in the middle get a photo */
    const pick = [before[before.length - 1], before[Math.floor(before.length / 2)]];
    const real = W.photoFor;
    W.photoFor = (it, food, c, city) => (pick.includes(it.n) ? { url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', credit: 'test' } : real(it, food, c, city));
    W.render(); await new Promise(r => setTimeout(r, 600));
    const after = order(), groups = [...document.querySelectorAll('#viewTrip .idea-list .idea-group')].length;
    /* each picked idea is now the first of its group */
    const firsts = pick.map(n => { const h = [...document.querySelectorAll('#viewTrip .idea-list .idea h4')].find(x => x.textContent === n); if (!h) return null; let p = h.closest('.idea').previousElementSibling; while (p && !p.classList.contains('idea-group') && p.querySelector && !p.querySelector('h4')) p = p.previousElementSibling; return p ? (p.classList.contains('idea-group') ? 'first' : 'not first: after ' + (p.querySelector('h4') || {}).textContent) : 'first'; });
    W.photoFor = real; return { before: before.length, pick, firsts, groups, moved: before.join('|') !== after.join('|') };
  });
  t.ok(r.before > 4 && r.moved && r.firsts.every(x => x === 'first'), 'an idea with a photo comes first in its group, ahead of those without: ' + JSON.stringify(r));
  t.eq(errors(), [], 'no page errors');
  await b.close();
};
