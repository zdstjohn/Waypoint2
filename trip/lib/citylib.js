/* Waypoint's city library (v184, the owner: "it shouldn't take more than 3-5 seconds to populate the stops/places to
   eat"). A shared store of Claude's answers to the questions that fill a country's list of towns and a city's first
   lists (things to do, places to eat), so a question already answered is not asked again: its answer comes from the
   artifact's database in about a second instead of Claude writing it for twenty or more.

     citylib/<place slug>   {country, city, q: {"<question fingerprint>": {r: the answer as Claude gave it, at}}}

   A question's fingerprint is taken over its words with the place left out ({CITY}, {COUNTRY}), so two trips that ask
   in the same words share answers. Two kinds of answer are kept for a place:
     - the general one: the question as the app asks it for no one in particular (no interests, adults, no food needs:
       W.libGeneral). The nightly task (tools/citylib.js) fills these ahead, for the 150 most visited countries, with
       the very words below (tools/citylib-questions.json, which the citylib suite keeps equal to them).
     - a trip's own: the question in its own words (its interests, travelers and food needs), kept once asked.
   A trip's own answer is used when there is one. If there is only the general one, it fills the days at once, and the
   trip's own question is asked after it, last in line, adding what suits the trip (lib/core.js run). The store keeps
   only answers and fingerprints, never a question's words (they can carry food needs).
   An answer from here goes through the same handler and checks as one from Claude, so nothing in it is trusted more.
   Every call here is optional: no database, a slow one (LIB_WAIT) or a refusal just means Claude is asked, as before.
   The website (W.cloud) reads its own copy of the library, which the nightly task sends there (tools/copy_to_cloud.js).
   This file is part of the "ask" piece (build/bundle.js PIECES). */
(function () {
  "use strict";
  var W = window.W;
  /* how long a first screen may wait for the library before Claude is asked instead */
  var LIB_WAIT = 2500,
    /* answers kept per place: one per way of asking (old ones go first) */
    KEEP_Q = 6;
  var dbP = /** @type {Promise<any> | null} */ (null),
    docs = /** @type {Record<string, Promise<any>>} */ ({}),
    saving = /** @type {Record<string, Promise<any>>} */ ({}),
    general = /** @type {Record<string, string>} */ ({});
  function db() {
    if (!dbP)
      dbP = new Promise(function (res) {
        try {
          if (window.__WP_OFFLINE || !window.claude || !window.claude.use) return res(null);
          window.claude.use("db").then(
            function (/** @type {any} */ d) {
              res(d || null);
            },
            function () {
              res(null);
            }
          );
        } catch (e) {
          /* no runtime to ask (a test page, an old app): the library is simply not there */
          res(null);
        }
      });
    return dbP;
  }
  /** a place's document as it is now @param {any} ref */
  function fresh(ref) {
    return ref.get().then(function (/** @type {any} */ s) {
      return s && s.exists ? s.data() || null : null;
    });
  }
  /** the place a question is about, as a document id: a country alone, or a country and a city
      @param {string[]} place [country] or [country, city] */
  function slugOf(place) {
    return place.length > 1 ? W.citySlug(place[0], place[1]) : W.slug(place[0]);
  }
  /** the question with its place taken out, so the same words for another place are the same question
      @param {string} text @param {string[]} place */
  function template(text, place) {
    var t = text;
    /* the city first: a city named after its country ("Mexico City") keeps its whole name */
    if (place[1]) t = t.split(place[1]).join("{CITY}");
    if (place[0] && place[0] !== place[1]) t = t.split(place[0]).join("{COUNTRY}");
    return t;
  }
  /** The question of this kind as asked for no one in particular: the app's own words, asked with no interests, the
      usual focus, no ages (adults) and no food needs, and the place left as {CITY} and {COUNTRY}. The nightly task asks
      these. @param {string} kind "cities" | "spots" | "food" */
  W.libGeneral = function (kind) {
    if (general[kind]) return general[kind];
    var S = W.S,
      keep = { styles: S.styles, focus: S.focus, travelers: S.travelers, eat: S.eat },
      none = function () {},
      n = W.FIRST_IDEAS;
    S.styles = [];
    S.focus = undefined;
    S.travelers = [];
    S.eat = undefined;
    try {
      general[kind] =
        kind === "cities"
          ? W.ASKS["ideas.0"].q(null, "{COUNTRY}")
          : kind === "spots"
            ? W.ASKS["ideas.3"].q("{CITY}", "", "{COUNTRY}", n, none, {})
            : W.ASKS["ideas.4"].q("", [], n, none, {}, "{CITY}, {COUNTRY}");
    } finally {
      S.styles = keep.styles;
      S.focus = keep.focus;
      S.travelers = keep.travelers;
      S.eat = keep.eat;
    }
    return general[kind];
  };
  /** what run() needs to look a question up and to keep its answer
      @param {{ place: string[], kind: string, own?: boolean }} lib @param {string} text */
  W.libFor = function (lib, text) {
    var t = template(text, lib.place),
      h = W.textHash(t),
      g = W.textHash(W.libGeneral(lib.kind));
    /* (own: this trip's question after the general answer; only its own answer will do) */
    return { slug: slugOf(lib.place), h: h, gh: lib.own || g === h ? "" : g, kind: lib.kind, place: lib.place };
  };
  /** the answer kept for this question (general: only the general one is there), or null, after LIB_WAIT at most
      @param {any} q @param {(r: any, general?: boolean) => void} cb */
  W.libGet = function (q, cb) {
    var done = false;
    var finish = function (/** @type {any} */ r, /** @type {boolean} */ g) {
      if (done) return;
      done = true;
      cb(r, g);
    };
    var timer = setTimeout(function () {
      finish(null, false);
    }, LIB_WAIT);
    if (!docs[q.slug])
      docs[q.slug] = db().then(function (d) {
        return d ? fresh(d.doc("citylib/" + q.slug)) : null;
      });
    docs[q.slug].then(
      function (x) {
        clearTimeout(timer);
        var at = function (/** @type {string} */ h) {
          var e = h && x && x.q && x.q[h];
          return e && e.r && typeof e.r === "object" ? e.r : null;
        };
        var mine = at(q.h);
        if (mine) finish(mine, false);
        else finish(at(q.gh), !!at(q.gh));
      },
      function () {
        /* refused or no signal: asked again on the next visit; Claude answers this time */
        delete docs[q.slug];
        clearTimeout(timer);
        finish(null, false);
      }
    );
  };
  /** keep a fresh answer from Claude for everyone @param {any} q @param {any} r */
  W.libSave = function (q, r) {
    /* (the website reads the library but doesn't add to it: its copy is the nightly task's, copied from the Claude
       version's each night, and its database lets no one else write there) */
    if (!r || typeof r !== "object" || W.readOnly || W.cloud) return;
    /* one write at a time per place (a city's two lists often arrive together): each reads what the last one wrote */
    saving[q.slug] = (saving[q.slug] || Promise.resolve())
      .then(db)
      .then(function (d) {
        if (!d) return;
        var ref = d.doc("citylib/" + q.slug);
        return fresh(ref).then(function (x) {
          var have = (x && x.q) || {},
            add = /** @type {Record<string, any>} */ ({});
          add[q.h] = { r: r, at: Date.now() };
          /* the oldest answers make room (a place keeps KEEP_Q ways of asking; the general one stays); a dropped one is
             written as a marker, since a merge can't take a field away, and a marker reads as no answer */
          Object.keys(have)
            .filter(function (k) {
              return k !== q.h && k !== q.gh && have[k] && have[k].r;
            })
            .sort(function (a, b) {
              return (have[b].at || 0) - (have[a].at || 0);
            })
            .slice(KEEP_Q - 2)
            .forEach(function (k) {
              add[k] = { drop: 1 };
            });
          var body = { country: q.place[0], city: q.place[1] || "", q: add };
          return (x ? ref.update(body) : ref.set(body)).then(function () {
            docs[q.slug] = fresh(ref);
          });
        });
      })
      .catch(function (/** @type {any} */ e) {
        /* a viewer who may not write, or a full store: the answer is still used here, just not kept for others */
        W.caught(e, "city library");
      });
  };
})();
