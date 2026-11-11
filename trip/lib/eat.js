/* Waypoint food needs: what the group can and can't eat, in words and as a signature, and how a place fits them.
   Split out of lib/core.js (v116); core.js asks for restaurants with W.eatAsk and marks the answers with W.eatMark. */
(function () {
  "use strict";
  var W = window.W;
  /* ---------- food needs (Plan, step 3): allergies, diets, what the group loves and avoids ---------- */
  /* S.eat = {al: [allergies], di: [diets], love, avoid, note}. Restaurant lists are asked for with them, each place
     comes back with how well it fits ("eat": good / ok / poor and why, tied to these needs by a signature), places
     already listed are checked once, and a poor fit is never planned. */
  W.EAT_AL = [
    ["peanuts", "Peanuts"],
    ["treenuts", "Tree nuts"],
    ["gluten", "Gluten (coeliac)"],
    ["dairy", "Dairy"],
    ["eggs", "Eggs"],
    ["fish", "Fish"],
    ["shellfish", "Shellfish"],
    ["sesame", "Sesame"],
    ["soy", "Soy"]
  ];
  W.EAT_DI = [
    ["vegetarian", "Vegetarian"],
    ["vegan", "Vegan"],
    ["pescatarian", "Pescatarian"],
    ["halal", "Halal"],
    ["kosher", "Kosher"],
    ["nopork", "No pork"],
    ["plain", "Plain food for picky kids"]
  ];
  function eatName(list, k) {
    var x = list.filter(function (y) {
      return y[0] === k;
    })[0];
    return x ? x[1].replace(/ \(.*\)$/, "").toLowerCase() : "";
  }
  W.eatNeeds = function () {
    var e = W.S.eat;
    if (!e || typeof e !== "object") return null;
    var al = (e.al || []).filter(function (k) {
        return eatName(W.EAT_AL, k);
      }),
      di = (e.di || []).filter(function (k) {
        return eatName(W.EAT_DI, k);
      });
    var love = String(e.love || "")
        .trim()
        .slice(0, 120),
      avoid = String(e.avoid || "")
        .trim()
        .slice(0, 120),
      note = String(e.note || "")
        .trim()
        .slice(0, 200);
    return al.length || di.length || love || avoid || note ? { al: al, di: di, love: love, avoid: avoid, note: note } : null;
  };
  /* the needs in words, for Claude and for the screen */
  W.eatText = function () {
    var n = W.eatNeeds();
    if (!n) return "";
    return [
      n.al.length
        ? "allergies: " +
          n.al
            .map(function (k) {
              return eatName(W.EAT_AL, k);
            })
            .join(", ")
        : "",
      n.di.length
        ? "diet: " +
          n.di
            .map(function (k) {
              return eatName(W.EAT_DI, k);
            })
            .join(", ")
        : "",
      n.love ? "loves " + n.love : "",
      n.avoid ? "would rather avoid " + n.avoid : "",
      n.note ? "note: " + n.note : ""
    ]
      .filter(Boolean)
      .join("; ");
  };
  W.eatSig = function () {
    var t = W.eatText(),
      h = 5381;
    for (var i = 0; i < t.length; i++) h = (h * 33 + t.charCodeAt(i)) | 0;
    return t ? (h >>> 0).toString(36) : "";
  };
  /* how a place fits the group's food needs now: "good", "ok", "poor", or "" (no needs, or not checked yet) */
  W.eatFit = function (it) {
    var s = W.eatSig(),
      e = it && it.eat;
    return s && e && e.sig === s ? e.f : "";
  };
  W.eatWhy = function (it) {
    var s = W.eatSig(),
      e = it && it.eat;
    return s && e && e.sig === s ? e.w || "" : "";
  };
  W.eatAsk = function () {
    var t = W.eatText();
    if (!t) return "";
    return (
      " The group's food needs: " +
      t +
      ". Suggest places that can feed them well (clear dishes for their diet; kitchens that handle allergies carefully) and never one where that is hard (for example a seafood-only grill for a shellfish allergy)." +
      " For each place, fit = good (plenty they can eat), ok (some options; tell the staff) or poor, and fitw = one short line on what they can have or what to ask."
    );
  };
  W.eatMark = function (list) {
    var sig = W.eatSig();
    if (!sig) return;
    (list || []).forEach(function (x) {
      if (x && x.fit) x.eat = { f: x.fit, w: x.fitw || "", sig: sig };
      if (x) {
        delete x.fit;
        delete x.fitw;
      }
    });
  };
})();
