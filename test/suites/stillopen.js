/* v168: "still open". A place the nightly check found shut for a stretch (a renovation, the winter) is kept off the
   days it covers by the planner, and warned about on a day you put it on yourself; a bad closure in the database is
   dropped. And the nightly script's two new steps: which places to ask about, and the answers merged into the records. */
const { launch, open, exampleTrip } = require("../lib/page");
const mkdb = require("../lib/db");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
exports.run = async t => {
  /* the example trip starts on 2027-06-07: Day 2 is Jun 8, where the planner first put "Rome sight 2-2" */
  const seed = {
    "places/italy-rome": {
      city: "Rome",
      country: "Italy",
      items: {
        "rome sight 2 2": {
          st: "open",
          checked: "2026-11-01",
          shut: [
            { f: "2027-06-08", t: "2027-06-09", why: "renovation" },
            { f: "nope", t: "2027-01-01" },
            { f: "2027-07-01", t: "2027-06-01" }
          ]
        },
        "rome eatery 10 6": { st: "open", shut: [{ f: "2027-06-01", t: "2027-06-30", why: '<img src=x onerror="window.__xss=1">' }] }
      }
    }
  };
  const b = await launch();
  const { pg, errors } = await open(b, { width: 390, db: mkdb(seed) });
  await exampleTrip(pg);
  await pg
    .waitForFunction(
      () => {
        const p = W.pool("Italy", "Rome");
        const x = p && p.spots.find(s => s.n === "Rome sight 2-2");
        return x && x.shut;
      },
      null,
      { timeout: 15000 }
    )
    .catch(() => {});
  await pg.waitForTimeout(800);
  const r = await pg.evaluate(() => {
    const p = W.pool("Italy", "Rome"),
      it = p.spots.find(s => s.n === "Rome sight 2-2"),
      food = p.food.find(s => s.n === "Rome eatery 10-6");
    const on = n => W.P.days[n - 1].slots.some(s => s.item && s.item.n === "Rome sight 2-2");
    /* put it on Day 2 yourself: the day says it is shut */
    const d2 = JSON.parse(JSON.stringify(W.P.days[1]));
    const am = d2.slots.find(s => s.slot === "am");
    am.item = it;
    const T = W.dayTimes(d2, W.P);
    return {
      shut: it && it.shut,
      on2: on(2),
      on3: on(3),
      warn: (T.rows.am.warn || []).join(" | "),
      day4: W.shutOn(it, 4),
      bad2: W.badForDay(it, W.weekday(2), "am", null, 2),
      bad4: W.badForDay(it, W.weekday(4), "am", null, 4),
      text: W.shutText({ f: "2027-12-20", t: "2028-01-10", why: "winter" }),
      foodWhy: food && food.shut && food.shut[0].why
    };
  });
  t.ok(
    r.shut && r.shut.length === 1 && r.shut[0].why === "renovation",
    "only real closures are kept from the record: " + JSON.stringify(r.shut)
  );
  t.ok(!r.on2 && !r.on3, "the planner keeps a place off the days it is shut");
  t.ok(/^Closed Jun 8 – Jun 9 \(renovation\)/.test(r.warn), "a day you put it on yourself says it is shut: " + r.warn);
  t.ok(r.bad2 && !r.bad4 && !r.day4, "shut on Day 2, open on Day 4");
  t.eq(r.text, "Closed Dec 20 – Jan 10 (winter)", "how a closure reads");
  /* shown as text: the day with the eatery under a closure that reads like markup */
  await pg.evaluate(() => {
    W.S.day = 2;
    W.goView("trip");
    W.render();
  });
  await pg.waitForTimeout(500);
  t.ok(
    !(await pg.evaluate(() => !!window.__xss || !!document.querySelector('#viewTrip img[src="x"]'))),
    "a closure's words are shown as text"
  );
  t.eq(errors(), [], "no page errors");
  await b.close();

  /* the nightly script */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "so-")),
    db = path.join(dir, "db"),
    work = path.join(dir, "work");
  fs.mkdirSync(path.join(db, "wanted"), { recursive: true });
  fs.mkdirSync(path.join(db, "places"), { recursive: true });
  const soon = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 7),
    today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(
    path.join(db, "wanted", "italy-rome.json"),
    JSON.stringify({
      city: "Rome",
      country: "Italy",
      when: soon + "-01",
      food: ["Caffe Uno", "Trattoria Due"],
      spots: ["Museo Tre"],
      used: [["Caffe Uno"], ["Trattoria Due"], ["Museo Tre"], ["Bar Nuovo"]]
    })
  );
  fs.writeFileSync(
    path.join(db, "wanted", "italy-far.json"),
    JSON.stringify({ city: "Far", country: "Italy", when: "2099-09-01", food: ["X"], used: [["X"]] })
  );
  fs.writeFileSync(
    path.join(db, "places", "italy-rome.json"),
    JSON.stringify({
      city: "Rome",
      country: "Italy",
      items: {
        "caffe uno": { st: "open", checked: "2026-01-01", site: "https://caffeuno.example" },
        "trattoria due": { st: "open", checked: today },
        "museo tre": { checked: "2026-01-01", shut: [{ f: "2020-01-01", t: "2020-02-01", why: "old" }] }
      }
    })
  );
  const py = (...a) =>
    spawnSync("python3", [path.join(__dirname, "..", "..", "trip", "tools", "place_check.py.txt"), ...a], { encoding: "utf8" });
  const todo = py("opentodo", db, work, "40");
  const lines = fs.existsSync(path.join(work, "opentodo.txt"))
    ? fs.readFileSync(path.join(work, "opentodo.txt"), "utf8").trim().split("\n")
    : [];
  t.ok(
    todo.status === 0 &&
      lines.length === 2 &&
      /^italy-rome \| F \| Caffe Uno \| \d{4}-\d{2} \| https:\/\/caffeuno/.test(lines[0]) &&
      /\| S \| Museo Tre \|/.test(lines[1]),
    "opentodo asks about places of a trip coming soon whose last check is old, places to eat first; not one checked today, not one never checked, not a far-off trip: " +
      JSON.stringify(lines) +
      (todo.stderr || "").slice(0, 200)
  );
  fs.writeFileSync(
    path.join(dir, "v.txt"),
    [
      "italy-rome | Caffe Uno | shut | https://caffeuno.example/news | from=2026-12-20; to=2027-01-10; why=winter holidays",
      "italy-rome | Museo Tre | open | https://museo.example |",
      "italy-rome | Trattoria Due | closed | https://x.example |",
      "italy-rome | Made Up | closed | https://x.example |"
    ].join("\n")
  );
  const ap = py("openapply", db, work, path.join(dir, "v.txt"));
  const out = JSON.parse(fs.readFileSync(path.join(work, "places", "italy-rome.json"), "utf8")).items;
  t.ok(
    ap.status === 0 &&
      out["caffe uno"].shut &&
      out["caffe uno"].shut[0].f === "2026-12-20" &&
      out["caffe uno"].oc === today &&
      out["museo tre"].oc === today &&
      !out["museo tre"].shut &&
      out["trattoria due"].st === "open" &&
      !out["made up"],
    "openapply records the closure, the places still open (dropping a closure that has ended), and nothing for places it was not asked about: " +
      ap.stdout.trim()
  );
};
