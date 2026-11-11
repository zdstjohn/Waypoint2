/* Waypoint: replan the rest of today from one sentence (second script).
   On Today, under the one-tap rescues: say what's going on ("it's raining, the little one is tired, we have three
   hours") and Claude decides, stop by stop, what to keep, drop or swap. It chooses only among the day's own other
   options (the same list "Swap" shows), and W.rescueApply (lib/plan.js) checks every action again: nothing that has
   started or is booked changes, and one Undo puts the day back. Nothing is asked until you press the button. */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc;
  var st = { q: "", msg: "", day: "" };
  function key(day) {
    return "replan|" + W.restKey(day);
  }
  /** what Claude is told about a place: only what the plan already knows @param {any} it @param {boolean} food @param {LatLng} home */
  function facts(it, food, home) {
    /** @type {Record<string, any>} */ var o = { name: it.n };
    if (it.d) o.about = String(it.d).slice(0, 90);
    if (!food) {
      var c = W.classify(it, false);
      o.indoor = !!c.indoor;
      o.effort = c.intensity;
    }
    if (it.lat != null && home && home.lat != null) o.km_from_lodging = Math.round(W.km(home, it) * 10) / 10;
    if (it.hours && it.hours.o != null) o.open = W.clock(it.hours.o) + "-" + W.clock(it.hours.c);
    return o;
  }
  /** the stops still to come today, each with the places it may be swapped for @param {Day} day @param {Plan} P */
  W.replanFacts = function (day, P) {
    var T = W.dayTimes(day, P),
      nm = W.nowMin(),
      home = W.homebase(day.country, day.city);
    /** @type {Record<string, any>[]} */ var out = [];
    if (!T) return out;
    (T.order || []).forEach(function (sl) {
      var x = day.slots.filter(function (y) {
          return y.slot === sl;
        })[0],
        R = T.rows[sl];
      if (!x || !R || R.skip || R.start == null || R.start <= nm + 5) return;
      var food = W.isFood(sl),
        e = x.item && W.bookEntryFor ? W.bookEntryFor(P, day, x.item) : null;
      /** @type {Record<string, any>} */ var o = {
        slot: sl,
        what: W.SLOT_NAME[sl],
        from: W.clock(R.start),
        to: W.clock(R.end),
        now: x.item ? facts(x.item, food, home) : null
      };
      if (e && e.done) o.booked = true;
      else
        o.options = W.slotOptions(day, sl, P)
          .slice(0, 6)
          .map(function (q) {
            return facts(q.it, food, home);
          });
      out.push(o);
    });
    return out;
  };
  /** @param {string} q @param {Day} day @param {Plan} P @param {Record<string, any>[]} rest */
  function prompt(q, day, P, rest) {
    var ages = W.ages(),
      kids = ages.filter(function (a) {
        return a < 18;
      }),
      T = W.dayTimes(day, P),
      nap = T && T.nap ? W.clock(T.nap.start) + "-" + W.clock(T.nap.end) : "";
    return (
      "Replan the rest of today for a family on a trip. Change as little as their situation needs.\n" +
      'What they said: "' +
      q +
      '"\n' +
      "Where: " +
      day.city +
      ", " +
      day.country +
      ". Time now: " +
      W.clock(W.nowMin()) +
      ". Travelers: " +
      ages.filter(function (a) {
        return a >= 18;
      }).length +
      " adults" +
      (kids.length ? ", children aged " + kids.join(", ") : "") +
      "." +
      (nap ? " Nap planned " + nap + "." : "") +
      "\n" +
      'The stops still to come, in order. "options" are the only places a stop may be swapped for. effort runs 0 (sit down) to 3 (strenuous).\n' +
      "DATA:" +
      JSON.stringify(rest) +
      "\n" +
      "For each stop choose: keep it, leave its time free, or use one of ITS OWN options (copy the name exactly). A stop marked booked must be kept. " +
      "If they say how much time they have, free what starts after it runs out. Rain: prefer indoor places. Tired, or small children fading: low effort, close to the lodging, fewer stops. " +
      "Keep meals unless they ask otherwise or the time runs out. If nothing needs to change, keep everything.\n" +
      'Answer with JSON only: {"say": "one short friendly sentence on what you changed and why, at most 20 words", "slots": [{"slot": "pm", "do": "keep", "name": ""}]} where do is "keep", "free" or "use", and name is set only with "use".'
    );
  }
  /** the box on Today (inside the rescue card) @param {Day} day */
  W.replanBlock = function (day) {
    if (W.readOnly || window.__WP_OFFLINE || W.sampleState !== "on") return "";
    if (st.day !== W.restKey(day)) {
      st.day = W.restKey(day);
      st.q = "";
      st.msg = "";
    }
    var s = W.status[key(day)],
      busy = s === "loading";
    return (
      '<div class="gr-ask"><label class="gr-l" for="replanQ">Or say what\'s going on, and Claude replans what\'s left:</label>' +
      '<div class="ps-row"><input class="field" id="replanQ" type="text" enterkeyhint="go" autocomplete="off" maxlength="200" placeholder="It\'s raining, the little one is tired, we have three hours" value="' +
      esc(st.q) +
      '"' +
      (busy ? " disabled" : "") +
      ">" +
      '<button type="button" class="btn" data-replan="1"' +
      (busy ? " disabled" : "") +
      ">Replan</button></div>" +
      (busy ? '<p class="loading gr-busy" role="status">Claude is replanning the rest of today…</p>' : "") +
      (!busy && (s || st.msg) ? '<p class="small gr-msg" role="status">' + esc(s || st.msg) + "</p>" : "") +
      "</div>"
    );
  };
  /** @param {Day} day @param {Plan} P @param {string} text */
  W.replanAsk = function (day, P, text) {
    var q = String(text || "")
      .replace(/["\n\r\\]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    st.q = q;
    st.msg = "";
    st.day = W.restKey(day);
    if (q.length < 3) {
      st.msg = "Say what's going on first: the weather, how everyone is, how long you have.";
      return false;
    }
    var rest = W.replanFacts(day, P);
    if (
      !rest.some(function (r) {
        return !r.booked;
      })
    ) {
      st.msg = "Nothing left today that can change.";
      return false;
    }
    var k = key(day);
    if (W.status[k] && W.status[k] !== "loading") delete W.status[k]; /* a failed try: asking again is the retry */
    W.run(k, prompt(q, day, P, rest), "complex", function (res) {
      var can = {};
      rest.forEach(function (r) {
        if (!r.booked) can[r.slot] = r;
      });
      var acts = (res && Array.isArray(res.slots) ? res.slots : []).filter(function (a) {
        if (!a || !can[a.slot] || (a["do"] !== "free" && a["do"] !== "use")) return false;
        return (
          a["do"] === "free" ||
          can[a.slot].options.some(function (/** @type {any} */ o) {
            return W.norm(o.name) === W.norm(a.name || "");
          })
        );
      });
      var r = W.rescueApply(day, W.P || P, acts, res && typeof res.say === "string" ? res.say : "");
      if (!r || !r.changed.length)
        st.msg =
          "Claude would keep the rest of today as it is." +
          (res && typeof res.say === "string" && res.say ? " " + res.say.slice(0, 160) : "");
      else {
        st.q = "";
        st.msg = "";
      }
      W.changed();
    });
    return true;
  };
  document.addEventListener("click", function (e) {
    var t = /** @type {HTMLElement} */ (e.target),
      b = t && t.closest ? /** @type {HTMLElement | null} */ (t.closest("[data-replan]")) : null;
    if (!b) return;
    var P = W.P,
      day = P && P.days[(W.S.day || 1) - 1],
      inp = /** @type {HTMLInputElement | null} */ (document.getElementById("replanQ"));
    if (!day) return;
    W.replanAsk(day, P, inp ? inp.value : "");
    W.render();
  });
  document.addEventListener("keydown", function (e) {
    var t = /** @type {HTMLElement} */ (e.target);
    if (e.key !== "Enter" || !t || t.id !== "replanQ") return;
    e.preventDefault();
    var b = /** @type {HTMLElement | null} */ (document.querySelector("[data-replan]"));
    if (b) b.click();
  });
  /* what's typed survives a redraw (ideas and photos keep arriving while you type) */
  document.addEventListener("input", function (e) {
    var t = /** @type {HTMLInputElement} */ (e.target);
    if (t && t.id === "replanQ") st.q = t.value;
  });
})();
