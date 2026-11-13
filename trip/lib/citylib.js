/* Waypoint's city library (v184, the owner: "it shouldn't take more than 3-5 seconds to populate the stops/places to
   eat"). A shared store of Claude's answers to the questions that fill a country's list of towns and a city's first
   lists (things to do, places to eat), so a question already answered for anyone is not asked again: its answer comes
   from the artifact's database in about a second instead of Claude writing it for twenty or more.

   What is kept, and where:
     citylib/<place slug>   {country, city, q: {"<question hash>": {r: the answer as Claude gave it, at}}}
                            (shared: every viewer reads it; anyone who may write the database adds to it)
     data/users/<you>/libq/q/<question hash>   {kind, t: the question with the place in it as {CITY} and {COUNTRY}, at}
                            (private: the questions this person's trips ask, word for word, so the nightly task
                            (tools/citylib.js) can ask the same ones for the next cities ahead of time)
   A question's hash is taken over its words with the place left out, so two trips that ask in the same words (the same
   interests, focus, travelers and food needs) share answers, and a trip that asks differently never gets another's.
   The hash is all the shared store holds of the words: the food needs in them stay in the private note.
   An answer from here goes through the same handler and the same checks as one from Claude (lib/core.js run), so
   nothing in it is trusted more. Every call here is optional: no database, a slow one (LIB_WAIT) or a refusal just
   means Claude is asked, as before. This file is part of the "ask" piece (build/bundle.js PIECES). */
(function () {
  "use strict";
  var W = window.W;
  /* how long a first screen may wait for the library before Claude is asked instead */
  var LIB_WAIT = 2500,
    /* answers kept per place: one per way of asking (old ones go first) */
    KEEP_Q = 6;
  var DB = /** @type {any} */ (null),
    dbP = /** @type {Promise<any> | null} */ (null),
    docs = /** @type {Record<string, Promise<any>>} */ ({}),
    saving = /** @type {Record<string, Promise<any>>} */ ({}),
    noted = /** @type {Record<string, number>} */ ({});
  function db() {
    if (!dbP)
      dbP = new Promise(function (res) {
        try {
          if (window.__WP_OFFLINE || !window.claude || !window.claude.use) return res(null);
          window.claude.use("db").then(
            function (/** @type {any} */ d) {
              DB = d || null;
              res(DB);
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
  /** what run() needs to look a question up and to keep its answer
      @param {{ place: string[], kind: string }} lib @param {string} text */
  W.libFor = function (lib, text) {
    var t = template(text, lib.place);
    return { slug: slugOf(lib.place), h: W.textHash(t), t: t, kind: lib.kind, place: lib.place };
  };
  /** the answer kept for this question, or null (after LIB_WAIT at most) @param {any} q @param {(r: any) => void} cb */
  W.libGet = function (q, cb) {
    var done = false;
    var finish = function (/** @type {any} */ r) {
      if (done) return;
      done = true;
      cb(r);
    };
    var timer = setTimeout(function () {
      finish(null);
    }, LIB_WAIT);
    if (!docs[q.slug])
      docs[q.slug] = db().then(function (d) {
        if (!d) return null;
        return fresh(d.doc("citylib/" + q.slug));
      });
    docs[q.slug].then(
      function (x) {
        clearTimeout(timer);
        var e = x && x.q && x.q[q.h];
        finish(e && e.r && typeof e.r === "object" ? e.r : null);
      },
      function () {
        /* refused or no signal: asked again on the next visit; Claude answers this time */
        delete docs[q.slug];
        clearTimeout(timer);
        finish(null);
      }
    );
  };
  /** a place's document as it is now @param {any} ref */
  function fresh(ref) {
    return ref.get().then(function (/** @type {any} */ s) {
      return s && s.exists ? s.data() || null : null;
    });
  }
  /** keep a fresh answer from Claude for everyone, and note the question for the nightly task
      @param {any} q @param {any} r */
  W.libSave = function (q, r) {
    if (!r || typeof r !== "object" || W.readOnly) return;
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
          /* the oldest answers make room (a place keeps KEEP_Q ways of asking); a dropped one is written as a marker,
             since a merge can't take a field away, and a marker reads as no answer */
          Object.keys(have)
            .filter(function (k) {
              return k !== q.h && have[k] && have[k].r;
            })
            .sort(function (a, b) {
              return (have[b].at || 0) - (have[a].at || 0);
            })
            .slice(KEEP_Q - 1)
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
    W.libNote(q);
  };
  /* a note older than this is written again, so the nightly task can tell the questions in use from old ones */
  var NOTE_AGE = 3 * 864e5;
  /** the question's words, kept privately (once a visit, and only when the note is missing or getting old), so the
      nightly task can ask them for the next cities @param {any} q */
  W.libNote = function (q) {
    if (noted[q.h] || W.readOnly) return;
    noted[q.h] = 1;
    Promise.all([db(), window.claude && window.claude.use ? window.claude.use("user") : null])
      .then(function (a) {
        var d = a[0],
          u = a[1];
        if (!d || !u || !u.id) return;
        return u.id().then(function (/** @type {string} */ id) {
          if (!id) return;
          var ref = d.doc("data/users/" + id + "/libq/q/" + q.h);
          return fresh(ref).then(function (x) {
            if (x && x.t === q.t && Date.now() - (x.at || 0) < NOTE_AGE) return;
            return ref.set({ kind: q.kind, t: q.t, at: Date.now() });
          });
        });
      })
      .catch(function (/** @type {any} */ e) {
        /* only the nightly task misses it; the app works the same */
        W.caught(e, "city library note");
      });
  };
  /* The questions this trip would ask for a country's towns and a new city's first lists, noted once the app is idle,
     so the nightly task can fill the library for them before any city is picked (a trip whose lists all came from this
     phone's own store would otherwise never note them). The words are the app's own: the questions themselves, asked
     with {COUNTRY} and {CITY} in the place's stead. */
  setTimeout(function () {
    try {
      if (!W.SAMPLE || W.readOnly || W.standalone || !navigator.onLine || !W.ASKS["ideas.0"]) return;
      var none = function () {},
        n = W.FIRST_IDEAS;
      [
        { kind: "cities", place: ["{COUNTRY}"], t: W.ASKS["ideas.0"].q(null, "{COUNTRY}") },
        { kind: "spots", place: ["{COUNTRY}", "{CITY}"], t: W.ASKS["ideas.3"].q("{CITY}", "", "{COUNTRY}", n, none, {}) },
        { kind: "food", place: ["{COUNTRY}", "{CITY}"], t: W.ASKS["ideas.4"].q("", [], n, none, {}, "{CITY}, {COUNTRY}") }
      ].forEach(function (x) {
        W.libNote({ kind: x.kind, t: x.t, h: W.textHash(x.t) });
      });
    } catch (e) {
      /* a question whose words need a trip that isn't there yet: noted when it is first asked instead */
      W.caught(e, "city library notes");
    }
  }, 8000);
})();
