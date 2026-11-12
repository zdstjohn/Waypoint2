/* v166: the night-before briefing for a new town (lib/brief.js), in Today's "Tomorrow" when tomorrow is a travel day:
   a button, Claude's answer in four parts (getting to the stay, a first dinner, closed tomorrow, local ways), kept on
   the phone, out of date when the stay changes; nothing when tomorrow stays in the same town. */
const { launch, open, exampleTrip, settle } = require("../lib/page");
exports.run = async t => {
  const b = await launch();
  const { pg, errors } = await open(b, { width: 390, height: 844 });
  await exampleTrip(pg);
  await settle(pg, 4000);
  await pg.evaluate(() => W.needLater && W.needLater());
  await pg.waitForFunction(() => !!W.briefBlock, null, { timeout: 20000 });
  /* the day before the first move */
  const mv = await pg.evaluate(() => {
    const d = W.P.days.find(x => x.moveFrom);
    return { n: d.n, city: d.city, from: d.moveFrom };
  });
  await pg.evaluate(n => {
    W.S.day = n - 1;
    W.goView("go");
    W.render();
  }, mv.n);
  await pg.waitForTimeout(600);
  const btn = await pg.evaluate(() => {
    const b = document.querySelector("#viewGo .go-eve [data-brief]");
    return b ? b.textContent.trim() : "";
  });
  t.ok(btn === "Briefing for " + mv.city, 'the evening before a travel day, "Tomorrow" offers a briefing for the new town: ' + btn);
  await pg.click("#viewGo .go-eve [data-brief]");
  await pg.waitForFunction(() => !!document.querySelector("#viewGo .brief .brief-h"), null, { timeout: 10000 });
  const r = await pg.evaluate(() => {
    const s = document.querySelector("#viewGo .brief");
    return {
      text: s.textContent,
      h4: [...s.querySelectorAll("h4")].map(h => h.textContent),
      li: s.querySelectorAll("li").length,
      ask: window.__briefAsk,
      kept: Object.keys(localStorage).filter(k => /^waypoint-brief\|/.test(k)).length,
      xss: !!s.querySelector("img") || !!window.__xss
    };
  });
  t.ok(
    r.h4.length === 4 &&
      /^From /.test(r.h4[0]) &&
      r.h4.includes("An easy first dinner") &&
      r.h4.includes("Closed tomorrow") &&
      r.h4.includes("Good to know"),
    "four parts: from the station, dinner, closed, local ways: " + JSON.stringify(r.h4)
  );
  t.ok(
    new RegExp("arrives tomorrow in " + mv.city).test(r.ask) && /coming from/.test(r.ask) && /ages/i.test(r.ask),
    "the question names the town, where from, and the family"
  );
  t.ok(
    r.kept === 1 && !r.xss && /check times, prices and opening hours/.test(r.text),
    "kept on the phone, shown as text, with a word to check on the day"
  );
  /* the stay changes: the briefing says it is out of date */
  await pg.evaluate(mv => {
    const d = W.P.days[mv.n - 1];
    W.S.stays[W.cityKey(d.country, d.city)] = { label: "Hotel Somewhere Else", lat: null };
    W.render();
  }, mv);
  await pg.waitForTimeout(400);
  t.ok(
    await pg.evaluate(
      () =>
        /has changed since this briefing/.test(document.querySelector("#viewGo .brief").textContent) &&
        /Update the briefing/.test(document.querySelector("#viewGo .brief").textContent)
    ),
    "a new stay makes it out of date, with a button to update it"
  );
  /* tomorrow in the same town: no briefing */
  const same = await pg.evaluate(() => {
    const i = W.P.days.findIndex((d, k) => k > 0 && !d.moveFrom && W.P.days[k - 1] && !W.P.days[k].moveFrom);
    W.S.day = i;
    W.render();
    return !document.querySelector("#viewGo .go-eve [data-brief]");
  });
  t.ok(same, "no briefing when tomorrow stays in the same town");
  t.eq(errors(), [], "no page errors");
  await b.close();
};
