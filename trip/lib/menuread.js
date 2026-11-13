/* Waypoint, a menu read from a photo (v164, the owner's pick "Read a menu photo for your family"). On a meal's sheet,
   "Read the menu" takes up to three photos (a menu's pages, in any language), shrinks them on the phone and asks Claude
   which dishes suit this family: good for everyone, a good pick for the kids, ask first (it may hold something on the
   allergy list, or a diet rule isn't clear from the menu), and skip (against an allergy, a diet or what they'd rather
   avoid), from "What do you eat?" (lib/eat.js W.eatText) and the group's ages. Each dish keeps its printed name, so it
   can be pointed at, with its English name, what it is and its price; and a few phrases in the menu's language to say
   to the waiter about the allergies and diets. Claude reading a photo is not a guarantee, so the result says to check
   allergens with the staff.
   Only where pictures can be sent to Claude (W.menuCanRead: the Claude app when the page declares images; the
   installable app through its server). Part of the second script. The answer lives for the visit, by the stop it was
   read for: reading a menu again is a tap away. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  var MAX = 3,
    SIDE = 1600 /* (the longest side a photo is shrunk to: small print stays readable) */,
    Q = 0.82;
  var FIT = { all: 1, kids: 1, ask: 1, skip: 1 };
  /** the menus read in this visit, by the stop's key: state "reading" | "done" | "error"
      @type {Record<string, {state: string, res?: any, err?: string, n: number}>} */
  var read = {};
  /** can this view send a photo to Claude? (asked once; undefined while not known yet) @type {boolean | undefined} */
  var can;
  W.menuCanRead = function () {
    if (can !== undefined || !W.SAMPLE || !W.SAMPLE.limits) return !!can;
    can = false;
    W.SAMPLE.limits().then(
      function (l) {
        can = !!(l && l.images && l.images.maxCount);
        if (can) W.redraw();
      },
      function () {
        can = false;
      }
    );
    return false;
  };

  /* ---------- the photos: shrunk on the phone (a phone's photo is 3-5 MB; this is about 0.3 MB) ---------- */
  /** @param {File} f @returns {Promise<Blob>} */
  function shrink(f) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(f),
        img = new Image();
      img.onload = function () {
        var s = Math.min(1, SIDE / Math.max(img.naturalWidth, img.naturalHeight)),
          c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * s));
        c.height = Math.max(1, Math.round(img.naturalHeight * s));
        var g = c.getContext("2d");
        if (!g) {
          URL.revokeObjectURL(url);
          return no(new Error("no canvas"));
        }
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(
          function (b) {
            if (b) ok(b);
            else no(new Error("no picture"));
          },
          "image/jpeg",
          Q
        );
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        no(new Error("not a picture"));
      };
      img.src = url;
    });
  }

  /* ---------- the question ---------- */
  function prompt() {
    var needs = W.eatText ? W.eatText() : "";
    return (
      "You are reading photos of a restaurant menu (one or more pages) for a family on holiday. " +
      (W.who ? W.who() : "") +
      " What they eat: " +
      (needs || "no allergies or diets given") +
      ".\nRead every dish you can see on every page. For each dish give: n = its name exactly as printed; en = its name in " +
      'English (the same as n if already English); d = what it is, in one short line; p = the price as printed, or ""; fit = ' +
      'one of "all" (suits everyone in the group), "kids" (a good pick for the children: mild, familiar, easy to eat), ' +
      '"ask" (could be fine, but ask the staff first: it may contain something on the allergy list, or whether it fits ' +
      'a diet is not clear from the menu), "skip" (goes against an allergy, a diet or what they would rather avoid); ' +
      'why = for "ask" and "skip" the reason in a few words tied to their needs (e.g. "may contain tree nuts", "pork"), ' +
      'otherwise "". Use "kids" only when the group has children. Then ask = up to 3 short phrases in the menu\'s language ' +
      'that they can say to the waiter about their allergies or diet, each {"local": the phrase, "en": its meaning} ' +
      "(an empty list when they have no allergies or diet). lang = the menu's language in English. If the photos are not " +
      'a menu or cannot be read, give dishes: [] and note = one short line saying why; otherwise note = "".\n' +
      "At most 60 dishes. Reply with JSON only, in this form: " +
      '{"lang":"Italian","dishes":[{"n":"","en":"","d":"","p":"","fit":"all","why":""}],"ask":[{"local":"","en":""}],"note":""}'
    );
  }
  /* the answer, made safe: plain short strings, a known fit, no more than 60 dishes and 3 phrases */
  function str(v, n) {
    return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "";
  }
  /** @param {any} r */
  W.menuClean = function (r) {
    var o = r && typeof r === "object" ? r : {};
    var dishes = (Array.isArray(o.dishes) ? o.dishes : [])
      .map(function (/** @type {any} */ d) {
        d = d && typeof d === "object" ? d : {};
        var n = str(d.n, 80),
          en = str(d.en, 80) || n,
          fit = FIT[str(d.fit, 8)] ? str(d.fit, 8) : "ask";
        return {
          n: n || en,
          en: en,
          d: str(d.d, 140),
          p: str(d.p, 16),
          fit: fit,
          why: fit === "ask" || fit === "skip" ? str(d.why, 80) : ""
        };
      })
      .filter(function (/** @type {any} */ d) {
        return d.n;
      })
      .slice(0, 60);
    var ask = (Array.isArray(o.ask) ? o.ask : [])
      .map(function (/** @type {any} */ a) {
        a = a && typeof a === "object" ? a : {};
        return { local: str(a.local, 140), en: str(a.en, 140) };
      })
      .filter(function (/** @type {any} */ a) {
        return a.local;
      })
      .slice(0, 3);
    return { lang: str(o.lang, 30), dishes: dishes, ask: ask, note: str(o.note, 160) };
  };

  /* ---------- reading: the photos chosen, shrunk, sent ---------- */
  /** @param {string} key the stop's key @param {FileList | File[]} files */
  W.menuRead = function (key, files) {
    var list = Array.prototype.slice.call(files || [], 0, MAX).filter(function (/** @type {File} */ f) {
      return f && /^image\//.test(f.type || "image/");
    });
    if (!list.length || !W.SAMPLE) return;
    read[key] = { state: "reading", n: list.length };
    W.redraw();
    Promise.all(list.map(shrink))
      .then(function (blobs) {
        return W.SAMPLE.json(prompt(), { modelTier: "default", images: blobs, cache: false });
      })
      .then(
        function (res) {
          var r = W.menuClean(res);
          read[key] = { state: "done", res: r, n: list.length };
        },
        function (/** @type {any} */ e) {
          var code = e && e.code;
          read[key] = {
            state: "error",
            n: list.length,
            err:
              code === "not_granted"
                ? "Claude wasn't allowed to read it. Allow it when asked, then try again."
                : code === "rate_limited"
                  ? "Claude is busy right now. Try again in a minute."
                  : code === "images_unavailable"
                    ? "Photos can't be sent to Claude here."
                    : "Couldn't read that menu. Try again, or a clearer photo."
          };
          if (e && !e.code) W.caught(e, "a menu photo");
        }
      )
      .then(function () {
        W.redraw();
      });
  };
  /* the file picker: the phone offers its camera or its photos (several pages at once) */
  W.menuPick = function (key) {
    var inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.multiple = true;
    inp.style.display = "none";
    inp.addEventListener("change", function () {
      if (inp.files && inp.files.length) W.menuRead(key, inp.files);
      inp.remove();
    });
    document.body.appendChild(inp);
    inp.click();
  };

  /* ---------- on the meal's sheet ---------- */
  var GROUPS = [
    ["all", "Good for everyone"],
    ["kids", "The kids will like"],
    ["ask", "Ask first"],
    ["skip", "Skip"]
  ];
  function dish(/** @type {any} */ d) {
    var same = d.en.toLowerCase() === d.n.toLowerCase();
    return (
      '<li class="mr-d"><div class="mr-dn"><b>' +
      esc(d.en) +
      "</b>" +
      (d.p ? '<span class="mr-p">' + esc(d.p) + "</span>" : "") +
      "</div>" +
      (same ? "" : '<span class="mr-o" lang="">' + esc(d.n) + "</span>") +
      (d.d ? '<span class="small muted">' + esc(d.d) + "</span>" : "") +
      (d.why ? '<span class="mr-why">' + esc(d.why) + "</span>" : "") +
      "</li>"
    );
  }
  /** the menu reader on a meal's sheet (W.menuBlock, lib/nightfood.js, is the menu from its website) @param {string} key @returns {string} */
  W.menuReadBlock = function (key) {
    var m = read[key];
    if (!m && !W.menuCanRead()) return "";
    var pick =
      '<button type="button" class="btn quiet mr-go" data-menuread="' +
      esc(key) +
      '">' +
      W.icon("photo", 2.2) +
      (m ? "Read another menu" : "Read the menu") +
      "</button>";
    if (!m)
      return (
        '<section class="mr" aria-label="Read the menu">' +
        pick +
        '<p class="small muted">Snap the menu, in any language: what suits each of you, from "What do you eat?".</p></section>'
      );
    if (m.state === "reading")
      return (
        '<section class="mr" aria-live="polite"><p class="loading">Reading the menu' +
        (m.n > 1 ? " (" + m.n + " pages)" : "") +
        "…</p></section>"
      );
    if (m.state === "error")
      return '<section class="mr" aria-live="polite"><p class="small mr-err">' + esc(m.err || "") + "</p>" + pick + "</section>";
    var r = m.res,
      has = r.dishes.length;
    var h =
      '<section class="mr" aria-live="polite"><p class="small muted mr-sum">From your photo: ' +
      (has
        ? esc((r.lang ? r.lang + " · " : "") + has + (has === 1 ? " dish" : " dishes")) + ". "
        : esc(r.note || "No dishes could be read.") + " ") +
      "Claude can misread a menu: check allergens with the staff.</p>";
    /* (a dish read as one for the kids is one for everyone when no children come along) */
    var kid = W.party().kid;
    GROUPS.forEach(function (g) {
      if (g[0] === "kids" && !kid) return;
      var ds = r.dishes.filter(function (/** @type {any} */ d) {
        return d.fit === g[0] || (g[0] === "all" && d.fit === "kids" && !kid);
      });
      if (!ds.length) return;
      var list = '<ul class="mr-l">' + ds.map(dish).join("") + "</ul>";
      h +=
        g[0] === "skip"
          ? '<details class="mr-g mr-' + g[0] + '"><summary>' + g[1] + " (" + ds.length + ")</summary>" + list + "</details>"
          : '<div class="mr-g mr-' + g[0] + '"><h4>' + g[1] + " <span>" + ds.length + "</span></h4>" + list + "</div>";
    });
    if (r.ask.length)
      h +=
        '<div class="mr-say"><h4>Say to the waiter</h4><ul>' +
        r.ask
          .map(function (/** @type {any} */ a) {
            return "<li><b>" + esc(a.local) + "</b>" + (a.en ? '<span class="small muted">' + esc(a.en) + "</span>" : "") + "</li>";
          })
          .join("") +
        "</ul></div>";
    return h + pick + "</section>";
  };
  document.addEventListener("click", function (e) {
    var t = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest("[data-menuread]") : null);
    if (!t) return;
    e.preventDefault();
    W.menuPick(t.getAttribute("data-menuread") || "");
  });
  /* (for the tests: what was read, by stop) */
  W.menuState = function (key) {
    return read[key] || null;
  };
})();
