/* v165: your bookings checked against the plan (lib/bookcheck.js), in "Check my plan". Bookings are made up around the
   example trip's own towns and days: a stay that starts a night late, two stays the same night, a train on the wrong
   day, check-in hours after you arrive, a ticket on another day, a table at another time, a ticket for a place not in
   the plan. And bookings that match the plan raise nothing. */
const { launch, open, exampleTrip, settle } = require("../lib/page");
exports.run = async t => {
  const b = await launch();
  const { pg, errors } = await open(b, { width: 390, height: 844 });
  await exampleTrip(pg);
  await settle(pg, 4000);
  await pg.evaluate(() => W.needLater && W.needLater());
  await pg.waitForFunction(() => !!W.bookCheck && !!W.reviewBlock, null, { timeout: 20000 });
  const r = await pg.evaluate(() => {
    const P = W.P,
      iso = n => {
        const d = W.dateOf(n);
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      };
    const town = si => {
      const ds = P.days.filter(d => d.stop === si);
      return { name: P.stops[si].name, first: ds[0].n, last: ds[ds.length - 1].n };
    };
    const A = town(0),
      B = town(1);
    /* a place on day 2, and its planned time */
    const d2 = P.days[1],
      x = d2.slots.find(s => s.item && !W.isFood(s.slot)),
      T = W.dayTimes(d2, P),
      at = T.rows[x.slot].start;
    const hh = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
    const good = [
      /* two hotels one after the other in the same town: a change of hotel, not a problem */
      { kind: "lodging", title: "Hotel Good", place: A.name, start: iso(A.first) + "T14:00", end: iso(A.first + 2) + "T11:00" },
      { kind: "lodging", title: "Hotel Next", place: A.name, start: iso(A.first + 2) + "T14:00", end: iso(B.first) + "T11:00" },
      { kind: "ticket", title: x.item.n, start: iso(2) + "T" + hh(at) }
    ];
    W.S.bookings = good;
    const clean = W.bookCheck(P);
    const bad = [
      { kind: "lodging", title: "Hotel Late", place: A.name, start: iso(A.first + 1) + "T15:00", end: iso(B.first) + "T11:00" },
      { kind: "lodging", title: "Hotel Twice", place: A.name, start: iso(A.first + 1) + "T15:00", end: iso(A.first + 2) + "T10:00" },
      {
        kind: "train",
        title: A.name + " to " + B.name,
        place: A.name,
        to: B.name,
        start: iso(B.first + 1) + "T09:00",
        end: iso(B.first + 1) + "T11:00"
      },
      { kind: "lodging", title: "Casa Early", place: B.name, start: iso(B.first) + "T16:00", end: iso(B.last) + "T10:00" },
      { kind: "ticket", title: x.item.n, start: iso(3) + "T10:00" },
      { kind: "restaurant", title: "Trattoria Nowhere Special", start: iso(2) + "T20:00" }
    ];
    W.S.bookings = bad;
    const got = W.bookCheck(P);
    const facts = W.reviewFacts(P),
      f1 = facts[A.first].booked;
    W.S.bookings = bad;
    W.goView("setup");
    W.render();
    const card = document.querySelector(".bkcheck");
    const txt = card ? card.textContent : "";
    W.S.bookings = [];
    W.render();
    return {
      A,
      B,
      clean,
      got: got.map(i => i.day + ": " + i.text),
      kinds: [...new Set(got.map(i => i.kind))],
      fix: got.every(i => i.fix),
      f1,
      txt,
      open: card ? card.querySelectorAll("[data-goday]").length : 0,
      gone: !document.querySelector(".bkcheck")
    };
  });
  t.eq(r.clean, [], "bookings that match the plan raise nothing");
  const has = re => r.got.some(x => re.test(x));
  t.ok(has(/arrives in .* but Hotel Late starts the night of/), "a stay that starts a night after the plan arrives: " + r.got[0]);
  t.ok(has(/Two stays are booked for the night of/), "two stays the same night");
  t.ok(!has(/The night of .* in .* has no stay booked/) || !has(new RegExp("1: The night of")), "the first night before a late stay is told once, not twice: " + JSON.stringify(r.got));
  t.ok(has(/train from .* is booked for .* but the plan moves on/), "a journey booked on another day than the plan moves");
  t.ok(has(/check-in at Casa Early is from 4:00 PM/), "arriving well before check-in: what to do with the bags");
  t.ok(has(/is booked for .* but the plan has it on Day 2/), "a ticket for another day than the plan has the place: " + JSON.stringify(r.got));
  t.ok(has(/Trattoria Nowhere Special is booked for .* isn't in the plan/), "a booking for a place not in the plan");
  t.ok(r.kinds.join() === "booking" && r.fix, "each is a booking problem with something to try");
  t.ok(
    Array.isArray(r.f1) && r.f1.some(b => b.kind === "lodging"),
    "Claude's own check is told what is booked each day: " + JSON.stringify(r.f1)
  );
  t.ok(
    /Your bookings against the plan/.test(r.txt) && r.open >= 3 && r.gone,
    '"Check my plan" shows them in their own section, each opening its day; with no bookings, no section'
  );
  t.eq(errors(), [], "no page errors");
  await b.close();
};
