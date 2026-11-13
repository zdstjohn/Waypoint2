/* The keyboard and the screen reader, beyond what axe checks (lib/a11y.js and the screens): the keyboard keeps its place
   when a tap draws the screen again; a sheet takes the keyboard, keeps it (Tab goes round, the page behind is inert),
   closes on Escape and gives it back; tabs and the one-of-three choice move with the arrow keys; a change made is read
   out; names a screen reader reads have their words apart; a toggle keeps one name; the screens are named; and the
   text grows with the phone's or browser's text size, without the page running off the screen. */
const { launch, open, exampleTrip, settle } = require("../lib/page");
exports.run = async t => {
  const b = await launch();
  const { pg, ctx, errors } = await open(b, { width: 390, height: 844 });
  await exampleTrip(pg);
  await pg.evaluate(() => {
    localStorage.setItem("waypoint-now", "2027-06-09T10:30");
    W.S.names = ["Zach", "Anna", "Mila", "Leo"];
    W.render();
  });
  const on = () =>
    pg.evaluate(() => {
      const a = document.activeElement;
      return !a || a === document.body
        ? "BODY"
        : a.tagName.toLowerCase() +
            (a.id ? "#" + a.id : "") +
            (a.className && typeof a.className === "string" ? "." + a.className.trim().split(/\s+/)[0] : "") +
            ' "' +
            (a.getAttribute("aria-label") || a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40) +
            '"';
    });
  const focus = sel =>
    pg.evaluate(s => {
      const e = document.querySelector(s);
      if (e) e.focus();
      return !!e;
    }, sel);
  const key = async (k, ms = 500) => {
    await pg.keyboard.press(k);
    await pg.waitForTimeout(ms);
  };
  const day = async n => {
    await pg.evaluate(n => {
      W.closeStop();
      W.S.tview = "days";
      W.S.day = n;
      W.goView("trip");
      W.render();
    }, n);
    await settle(pg, 2000);
  };

  /* the keyboard keeps its place: a day pill, the next-day button, a tab */
  await day(2);
  await focus('#viewTrip .dpill[data-day="4"]');
  await key("Enter", 700);
  const pill = await pg.evaluate(() => ({
    day: W.S.day,
    on: document.activeElement && document.activeElement.matches('.dpill[data-day="4"]'),
    cur: document.activeElement && document.activeElement.getAttribute("aria-current")
  }));
  t.ok(
    pill.day === 4 && pill.on && pill.cur === "true",
    "Enter on a day pill: that day, and the keyboard is still on its pill (now current) " + JSON.stringify(pill) + " " + (await on())
  );
  await focus("#viewTrip .dn-b.nx");
  await key("Enter", 900);
  t.ok(
    await pg.evaluate(() => W.S.day === 5 && !!document.activeElement.closest(".dn-b")),
    'Enter on "Next day": the next day, the keyboard on the day buttons ' + (await on())
  );

  /* tabs: arrows move and choose, the keyboard follows */
  await day(2);
  await focus('#viewTrip [role=tab][data-vsw="days"]');
  await key("ArrowRight", 1200);
  t.ok(
    await pg.evaluate(
      () =>
        W.S.tview === "map" &&
        document.activeElement.matches('[role=tab][data-vsw="map"]') &&
        document.activeElement.getAttribute("aria-selected") === "true"
    ),
    "ArrowRight on Day: Explore is chosen and has the keyboard " + (await on())
  );
  await key("ArrowLeft", 1000);
  t.ok(
    await pg.evaluate(() => W.S.tview === "days" && document.activeElement.matches('[data-vsw="days"]')),
    "ArrowLeft goes back to Day " + (await on())
  );
  await pg.evaluate(() => {
    W.S.prepTab = "tobook";
    W.goView("book");
    W.render();
  });
  await settle(pg, 2000);
  await focus('#viewBook [role=tab][data-prep="tobook"]');
  await key("End", 800);
  const last = await pg.evaluate(() => {
    const ts = [...document.querySelectorAll("#viewBook [role=tab]")];
    return {
      last: document.activeElement === ts[ts.length - 1],
      sel: document.activeElement.getAttribute("aria-selected"),
      tab: W.S.prepTab
    };
  });
  t.ok(last.last && last.sel === "true", "End in Prepare's tabs: the last tab, chosen, with the keyboard " + JSON.stringify(last));
  await key("Home", 800);
  t.ok(
    await pg.evaluate(() => document.activeElement.matches('[data-prep="tobook"]') && W.S.prepTab === "tobook"),
    "Home: back to the first tab " + (await on())
  );
  /* the one-of-three choice in Plan */
  await pg.evaluate(() => {
    W.S.stepClosed = { style: false };
    W.goView("setup");
    W.render();
  });
  await settle(pg, 2000);
  await focus('#viewSetup [role=radio][aria-checked="true"]');
  const was = await pg.evaluate(() => document.activeElement.dataset.focus);
  await key("ArrowRight", 700);
  const now = await pg.evaluate(() => ({
    f: document.activeElement.dataset && document.activeElement.dataset.focus,
    checked: document.activeElement.getAttribute("aria-checked")
  }));
  t.ok(
    now.f && now.f !== was && now.checked === "true",
    `ArrowRight in "What to see": the next choice is checked and has the keyboard (${was} -> ${now.f})`
  );
  await pg.evaluate(was => {
    const b = document.querySelector('[data-focus="' + was + '"]');
    if (b) b.click();
  }, was);

  /* a stop's sheet: takes the keyboard, keeps it, the page behind is inert, Escape gives it back */
  await day(2);
  await focus("#viewTrip .slot:not(.food) .slot-toggle");
  const opener = await pg.evaluate(() => document.activeElement.dataset.open);
  await key("Enter", 1200);
  const sh = await pg.evaluate(() => ({
    inSheet: !!document.activeElement.closest("#sheethost .sheet"),
    inert: document.querySelector(".wrap").inert,
    modal: document.querySelector("#sheethost .sheet").getAttribute("aria-modal"),
    heading: !!document.querySelector('#sheethost .sheet [role=heading][aria-level="2"]')
  }));
  t.ok(sh.inSheet && sh.modal === "true", "Enter on a stop: its sheet opens with the keyboard in it " + JSON.stringify(sh));
  t.ok(sh.inert, "the page behind an open sheet is inert (a screen reader's swipe stays in the sheet)");
  t.ok(sh.heading, "the sheet's title is a heading");
  await key("Shift+Tab", 200);
  await key("Shift+Tab", 200);
  const wrapBack = await pg.evaluate(() => !!document.activeElement.closest("#sheethost .sheet"));
  for (let i = 0; i < 25; i++) await key("Tab", 60);
  t.ok(
    wrapBack && (await pg.evaluate(() => !!document.activeElement.closest("#sheethost .sheet"))),
    "Tab and Shift+Tab go round inside the sheet " + (await on())
  );
  /* another page of the sheet: the keyboard stays in it */
  await focus('#sheethost [data-sheetact="move"]');
  await key("Enter", 700);
  t.ok(
    await pg.evaluate(
      () => !!document.activeElement.closest("#sheethost .sheet") && !!document.querySelector("#sheethost [data-sheetback]")
    ),
    '"Move to another day": the sheet\'s next page keeps the keyboard ' + (await on())
  );
  await key("Escape", 700);
  const back = await pg.evaluate(
    o => ({
      open: !!document.querySelector("#sheethost .sheet"),
      on: document.activeElement.dataset && document.activeElement.dataset.open === o,
      inert: document.querySelector(".wrap").inert
    }),
    opener
  );
  t.ok(
    !back.open && back.on && !back.inert,
    "Escape closes it and the keyboard is back on the stop that opened it " + JSON.stringify(back)
  );

  /* the questions for a new trip (the welcome sheet): its first box has the keyboard, the page behind is inert, Escape closes it */
  await day(2);
  await focus('#viewTrip .dpill[data-day="3"]');
  await pg.evaluate(() => W.whenLater(() => W.qsOpen(true)));
  await pg.waitForTimeout(900);
  const qs = await pg.evaluate(() => ({
    on: document.activeElement && document.activeElement.id,
    inert: document.querySelector(".wrap").inert,
    label: (document.querySelector("#qshost [role=dialog]") || { getAttribute: () => "" }).getAttribute("aria-labelledby")
  }));
  t.ok(
    qs.on === "qsWhere" && qs.inert && qs.label === "qsT",
    'the welcome sheet: "Where to?" has the keyboard, the page behind is inert, the sheet is named by its heading ' + JSON.stringify(qs)
  );
  await key("Escape", 700);
  t.ok(
    await pg.evaluate(
      () => !document.querySelector("#qshost .sheet") && !document.querySelector(".wrap").inert && document.activeElement !== document.body
    ),
    "Escape closes it and the keyboard is back on the page " + (await on())
  );

  /* a sheet over another screen: the stay sheet from Prepare */
  await pg.evaluate(() => {
    W.S.prepTab = "tobook";
    W.goView("book");
    W.render();
  });
  await settle(pg, 2000);
  if (await focus("#viewBook button.chip-a.pri")) {
    const lab = await pg.evaluate(() => document.activeElement.textContent.trim());
    await key("Enter", 1200);
    const st = await pg.evaluate(() => ({
      inSheet: !!document.activeElement.closest("#stayhost .sheet"),
      named: [...document.querySelectorAll("#stayhost input.field")].every(
        i => !!(i.getAttribute("aria-label") || (i.labels && i.labels.length))
      )
    }));
    t.ok(st.inSheet && st.named, '"Pick a place": the stay sheet takes the keyboard, and its boxes are named ' + JSON.stringify(st));
    await key("Escape", 700);
    t.ok(
      await pg.evaluate(l => !document.querySelector("#stayhost .sheet") && document.activeElement.textContent.trim() === l, lab),
      'Escape closes it and the keyboard is back on "Pick a place" ' + (await on())
    );
  } else t.note('no "Pick a place" in Prepare to try');

  /* the trips menu: opens and closes from its button, which keeps the keyboard */
  await day(2);
  await focus("#tripbar .trip-sw");
  await key("Enter", 600);
  t.ok(
    await pg.evaluate(
      () =>
        document.activeElement.matches(".trip-sw") &&
        document.activeElement.getAttribute("aria-expanded") === "true" &&
        !!document.querySelector(".trip-menu")
    ),
    "Enter on the trip's name opens the trips menu; the keyboard stays on its button " + (await on())
  );
  await key("Tab", 100);
  await key("Escape", 600);
  t.ok(
    await pg.evaluate(
      () =>
        !document.querySelector(".trip-menu") &&
        document.activeElement.matches(".trip-sw") &&
        document.activeElement.getAttribute("aria-expanded") === "false"
    ),
    "Escape from inside the menu closes it, the keyboard back on its button " + (await on())
  );

  /* a stop's swap: Escape closes it, the keyboard back on Swap */
  await focus("#viewTrip .slot:not(.food) [data-reroll]");
  await key("Enter", 1000);
  t.ok(
    await pg.evaluate(() => document.activeElement.getAttribute("aria-expanded") === "true" && !!document.querySelector("#viewTrip .swap")),
    "Enter on Swap opens the choices (aria-expanded)"
  );
  await key("Tab", 100);
  await key("Escape", 1000);
  t.ok(
    await pg.evaluate(
      () =>
        !document.querySelector("#viewTrip .swap") &&
        document.activeElement.matches("[data-reroll]") &&
        document.activeElement.getAttribute("aria-expanded") === "false"
    ),
    "Escape closes the swap, the keyboard back on Swap " + (await on())
  );

  /* another screen by a link in the page: the keyboard goes to that screen, which is named */
  await pg.evaluate(() => {
    W.goView("setup");
    W.render();
  });
  await settle(pg, 2000);
  if (await focus('#viewSetup .cta .btn[data-view="trip"]')) {
    await key("Enter", 1200);
    const m = await pg.evaluate(() => {
      const a = document.activeElement;
      return {
        view: W.view(),
        main: a.tagName === "MAIN" ? a.getAttribute("aria-label") : null,
        on: a.tagName,
        inTrip: !!a.closest("#viewTrip")
      };
    });
    t.ok(
      m.view === "trip" && (m.main === "Trip" || m.inTrip),
      '"See my trip": the keyboard lands on the Trip screen, not the top of the page ' + JSON.stringify(m)
    );
  }
  t.eq(
    await pg.evaluate(() => [...document.querySelectorAll("main")].filter(m => !m.getAttribute("aria-label")).map(m => m.id)),
    [],
    "every screen (<main>) is named"
  );

  /* names a screen reader reads: the browser's own (Chrome's accessibility tree), with their words apart */
  await day(2);
  const cdp = await ctx.newCDPSession(pg);
  const names = async sel => {
    const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
    const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: sel });
    const out = [];
    for (const id of nodeIds) {
      const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { nodeId: id, fetchRelatives: false });
      out.push((nodes[0].name || {}).value || "");
    }
    return out;
  };
  const tog = await names("#viewTrip .slot-toggle");
  t.ok(
    tog.length > 2 && tog.every(n => !/\b[AP]M[A-Z]/.test(n) && /\b[AP]M /.test(n)),
    'a stop\'s button reads its time apart from what follows ("8:30 AM Rome…"): ' + tog.slice(0, 2).join(" | ")
  );
  await pg.evaluate(() => {
    W.goView("go");
    W.render();
  });
  await settle(pg, 2000);
  const route = await names("#viewGo .rc-stop.next .rc-b");
  t.ok(
    route.every(n => !/\dNEXT|[a-z0-9]next/i.test(n.replace(/, next/i, ""))),
    'Today\'s next stop reads "…, next", not glued to its name: ' + route.join(" | ")
  );

  /* a toggle keeps one name (its state is aria-pressed); a change made is read out */
  await pg.evaluate(() => {
    W.S.prepTab = "pack";
    W.goView("book");
    W.render();
  });
  await settle(pg, 2500);
  const pk = await pg.evaluate(() => {
    const b = document.querySelector("#viewBook .box[data-pack]");
    if (!b) return null;
    const k = b.dataset.pack,
      n0 = b.getAttribute("aria-label");
    b.click();
    const a = document.querySelector('#viewBook .box[data-pack="' + k + '"]');
    const r = { n0, n1: a.getAttribute("aria-label"), p: a.getAttribute("aria-pressed") };
    a.click();
    return r;
  });
  t.ok(pk && pk.n0 === pk.n1 && pk.p === "true", "a packing tick keeps its name and says its state in aria-pressed " + JSON.stringify(pk));
  await day(2);
  await pg.evaluate(() => {
    const b = [...document.querySelectorAll("#viewTrip button")].find(x => /rest day/i.test(x.textContent));
    if (b) b.click();
  });
  await pg.waitForTimeout(1200);
  const said = await pg.evaluate(() => ({
    live: (document.querySelector("#wpSay") || {}).textContent || "",
    role: (document.querySelector("#wpSay") || { getAttribute: () => "" }).getAttribute("role"),
    undo: !!document.querySelector("#undohost [data-undo]")
  }));
  t.ok(
    said.undo && said.role === "status" && /undo/i.test(said.live),
    "a change with Undo is read out from the live region that is always there " + JSON.stringify(said)
  );
  await pg.evaluate(() => {
    const u = document.querySelector("#undohost [data-undo]");
    if (u) u.click();
  });
  await pg.waitForTimeout(500);
  t.eq(errors(), [], "no page errors");
  await ctx.close();

  /* larger text: the type grows with the browser's text size, and the main screens stay on the screen */
  for (const [scale, width] of [
    [1.3, 360],
    [2, 360],
    [2, 390]
  ]) {
    const o = await open(b, { width, height: 800, scale });
    await exampleTrip(o.pg);
    await o.pg.evaluate(() => {
      localStorage.setItem("waypoint-now", "2027-06-09T10:30");
      W.render();
    });
    const sizes = await o.pg.evaluate(() => ({
      html: parseFloat(getComputedStyle(document.documentElement).fontSize),
      body: parseFloat(getComputedStyle(document.body).fontSize)
    }));
    t.ok(Math.abs(sizes.body / 15 - scale) < 0.02, `text at ${scale * 100}%: the body text is ${sizes.body}px (15px at 100%)`);
    const wide = [];
    for (const [v, go] of [
      [
        "Plan",
        () => {
          W.goView("setup");
          W.render();
        }
      ],
      [
        "Trip",
        () => {
          W.S.tview = "days";
          W.S.day = 2;
          W.goView("trip");
          W.render();
        }
      ],
      [
        "Explore",
        () => {
          W.S.tview = "map";
          W.goView("trip");
          W.render();
        }
      ],
      [
        "Today",
        () => {
          W.goView("go");
          W.render();
        }
      ],
      [
        "Prepare",
        () => {
          W.S.prepTab = "tobook";
          W.goView("book");
          W.render();
        }
      ],
      [
        "Pack",
        () => {
          W.S.prepTab = "pack";
          W.render();
        }
      ],
      [
        "Budget",
        () => {
          W.S.prepTab = "budget";
          W.render();
        }
      ],
      [
        "Settings",
        () => {
          W.goView("settings");
          W.render();
        }
      ],
      [
        "Recap",
        () => {
          W.goView("recap");
          W.render();
        }
      ],
      [
        "Kids",
        () => {
          W.goView("kids");
          W.render();
        }
      ]
    ]) {
      await o.pg.evaluate(go);
      await o.pg.waitForTimeout(500);
      await settle(o.pg, 2000);
      const over = await o.pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (over > 0) wide.push(v + " " + over + "px");
    }
    t.eq(wide, [], `text at ${scale * 100}%, ${width} px wide: no screen runs off the side`);
    await o.ctx.close();
  }
  await b.close();
};
