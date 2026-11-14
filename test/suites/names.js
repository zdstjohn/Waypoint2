/* Other names for a country (v186): "UAE", "Holland", "Czech Republic", "Burma" and the rest find the country the list
   calls "United Arab Emirates", "Netherlands", "Czechia", "Myanmar (Burma)": typed and added, and offered as you type. */
const { launch, open } = require("../lib/page");
exports.run = async t => {
  const b = await launch();
  const { pg, ctx, errors } = await open(b, { width: 390, height: 844 });
  await pg.evaluate(() => {
    W.S.stepClosed = { style: false, who: false, long: false, where: false };
    W.setView("setup");
    W.render();
  });
  await pg.waitForSelector("#countryIn");
  /* (the list's names are the browser's own: "Macao" in one, "Macao SAR China" in another: the other names find whichever is there) */
  const names = await pg.evaluate(() => {
    const L = W.countryNames(),
      f = re => L.find(n => re.test(n));
    const asked = [
      "UAE",
      "u.a.e.",
      "Holland",
      "The Netherlands",
      "Czech Republic",
      "Turkey",
      "Burma",
      "Myanmar",
      "South Korea",
      "Korea",
      "Hong Kong",
      "Macau",
      "Bosnia and Herzegovina",
      "Macedonia",
      "USA",
      "Great Britain",
      "Vatican",
      "Japan",
      "Atlantis"
    ];
    const want = [
      "United Arab Emirates",
      "United Arab Emirates",
      "Netherlands",
      "Netherlands",
      f(/^Czech/),
      f(/^T(ü|u)rk(iye|ey)$/),
      f(/^Myanmar/),
      f(/^Myanmar/),
      "South Korea",
      "South Korea",
      f(/^Hong Kong/),
      f(/^Macao/),
      f(/^Bosnia/),
      "North Macedonia",
      "United States",
      "United Kingdom",
      "Vatican City",
      "Japan",
      "Atlantis"
    ];
    return { got: asked.map(n => W.countryName(n)), want };
  });
  t.eq(names.got, names.want, "other names for a country find it (an unknown name stays as typed)");
  const offered = async text => {
    await pg.fill("#countryIn", "");
    await pg.type("#countryIn", text, { delay: 20 });
    await pg.waitForTimeout(150);
    return pg.evaluate(() => [...document.querySelectorAll(".ta-l button b")].map(e => e.textContent));
  };
  const o = {};
  for (const q of ["emir", "holl", "burm", "czech r", "macau"]) o[q] = await offered(q);
  t.ok(
    o.emir.includes("United Arab Emirates") &&
      o.holl.includes("Netherlands") &&
      o.burm.includes("Myanmar (Burma)") &&
      o["czech r"].includes("Czechia") &&
      o.macau.some(n => /^Macao/.test(n)),
    "and they are offered as you type: " + JSON.stringify(o)
  );
  /* (v187) the longest country names fit a small phone: nothing runs off the side or is cut short in Plan */
  await ctx.close();
  await b.close();
  const b2 = await launch();
  const L = await open(b2, { width: 360, height: 740 });
  const fit = await L.pg.evaluate(async () => {
    W.S.countries = [
      { name: "Bosnia & Herzegovina", mode: "manual", picked: ["Sarajevo"] },
      { name: "St. Vincent & Grenadines", mode: "manual", picked: [] },
      { name: "Turks & Caicos Islands", mode: "manual", picked: [] }
    ];
    (W.S.stepClosed = W.S.stepClosed || {}).where = false;
    W.needLater();
    W.setView("setup");
    W.render();
    await new Promise(r => setTimeout(r, 1200));
    W.render();
    const el = document.getElementById("viewSetup") || document.body,
      cut = [...el.querySelectorAll("h3, h4, .chip, .country-h, .cn, button, label")]
        .filter(e => {
          const cs = getComputedStyle(e);
          return (
            e.clientWidth > 0 &&
            e.scrollWidth > e.clientWidth + 4 &&
            (e.textContent || "").trim() &&
            /hidden|clip|ellipsis/.test(cs.overflow + cs.overflowX + cs.textOverflow)
          );
        })
        .map(e => (e.textContent || "").trim().slice(0, 40));
    return {
      wide: document.documentElement.scrollWidth - innerWidth,
      cut,
      seen: /Bosnia & Herzegovina/.test(el.innerText) && /St\. Vincent & Grenadines/.test(el.innerText)
    };
  });
  t.ok(
    fit.seen && fit.wide <= 0 && !fit.cut.length,
    "the longest country names fit a 360 px phone with nothing cut short: " + JSON.stringify(fit)
  );
  t.eq(L.errors(), [], "no page errors");
  await L.ctx.close();
  await b2.close();
};
