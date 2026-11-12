/* Waypoint's Trip screen, what comes with the second script (what every first screen draws is screens/trip.js): the
   swap under a stop (other ideas for that part of the day, one of them up close), what is known about a place (a
   stop's sheet and the swap's closer look share it), and what the screen's buttons do beyond changing day or view:
   swapping a stop, adding an idea, "not for us", a rest day or a day trip, how you travel between places. The two
   halves share the open swap and a few helpers through W.tripX. */
(function () {
  "use strict";
  var W = window.W,
    X = W.tripX,
    esc = W.esc,
    S = W.S,
    slotEl = X.slotEl,
    swapCards = X.swapCards,
    noBtn = X.noBtn,
    beachNote = X.beachNote,
    ICON_NO = X.ICON_NO,
    ICON_REROLL = X.ICON_REROLL;
  function beachCheck(it) {
    var b = it.bch;
    if (!W.isBeach || !W.isBeach(it) || !b || !b.calm) return "";
    var chips = [
      b.calm === "calm" ? "Calm water" : b.calm === "some waves" ? "Some waves" : "Often rough",
      b.shallow === true ? "Shallow entry" : b.shallow === false ? "Gets deep quickly" : "",
      b.sand ? { sand: "Sandy", pebbles: "Pebbles", mixed: "Sand and pebbles", rocks: "Rocky" }[b.sand] : "",
      b.shade ? { umbrellas: "Umbrellas to rent", trees: "Shade from trees", little: "Little shade", none: "No shade" }[b.shade] : "",
      b.lifeguard === true ? "Lifeguard in summer" : b.lifeguard === false ? "No lifeguard" : "",
      b.walk != null ? (b.walk <= 2 ? "Right by parking" : b.walk + " min walk from parking") : "",
      b.facilities === true ? "Toilets or café" : b.facilities === false ? "No facilities" : ""
    ].filter(Boolean);
    return (
      '<div class="bcheck"><b>Beach check</b><div class="bc-chips">' +
      chips
        .map(function (c) {
          return '<span class="bc">' + esc(c) + "</span>";
        })
        .join("") +
      "</div>" +
      (b.note ? '<p class="small muted">' + esc(b.note) + "</p>" : "") +
      "</div>"
    );
  }
  /* one idea up close, inside the swap: its photo, what it is (the cuisine and price for a meal, the ticket for a
     sight), how far and how long, the notes, then Add or Skip; the menu, reviews and links below for a longer look.
     Skip shows the next idea; nothing changes on the plan until Add. */
  function swapPeekHtml(day, x, P, opts, i) {
    var o = opts[i],
      it = o.it,
      food = W.isFood(x.slot),
      nm = W.SLOT_NAME[x.slot].toLowerCase(),
      ph = W.picture(it, food, day.country, day.city, { credit: true }),
      facts = [
        food ? it.cuisine : "",
        food ? it.price : W.priceText(it.ticket, W.curOf(day.country)),
        o.km != null ? W.fmtKm(o.km) + " away" : "",
        W.stayText(it, food, x.slot)
      ].filter(Boolean),
      notes = placeNotes(it, food, P, ""),
      book = food ? "" : W.bookLink(it, day.city, false, day.country);
    return (
      '<div class="sw-peek" role="group" aria-label="' +
      esc(it.n) +
      '">' +
      '<div class="swp-top"><button type="button" class="linkish" data-peekback="1">' +
      W.arrow() +
      "All ideas</button>" +
      '<span class="small muted">' +
      (i + 1) +
      " of " +
      opts.length +
      "</span></div>" +
      (ph ? '<div class="sd-pic">' + ph + "</div>" : "") +
      '<h4 class="swp-n">' +
      esc(it.n) +
      "</h4>" +
      (facts.length ? '<p class="swp-f">' + esc(facts.join(" · ")) + "</p>" : "") +
      (it.d ? '<p class="sd-d">' + esc(it.d) + "</p>" : "") +
      (notes ? '<div class="slot-notes sd-notes">' + notes + "</div>" : "") +
      placeRev(it) +
      '<div class="swp-act"><button type="button" class="btn" data-use="' +
      x.slot +
      '" data-name="' +
      esc(it.n) +
      '">Add for ' +
      nm +
      '</button><button type="button" class="btn quiet" data-peekskip="' +
      x.slot +
      '">Skip</button>' +
      "</div>" +
      (x.item ? '<p class="small muted swp-was">Adding it takes the place of ' + esc(x.item.n) + ".</p>" : "") +
      (book ? '<div class="slot-act">' + book + "</div>" : "") +
      (food && W.menuBlock ? W.menuBlock(it, day) : "") +
      placeLinks(it, day, "") +
      /* (at the foot, apart from Add and Skip, so a thumb can't take it for Skip) */
      (W.canEdit()
        ? '<div class="swp-out"><button type="button" class="linkish sw-no" data-nope="' +
          x.slot +
          '" data-name="' +
          esc(it.n) +
          '" aria-label="Not for us: ' +
          esc(it.n) +
          '">' +
          ICON_NO +
          "Not for us, don't suggest it again</button></div>"
        : "") +
      "</div>"
    );
  }
  /* swap a slot: the next suggestion, or pick from the best options for that time of day */
  function swapPanel(day, x, P) {
    var opts = W.slotOptions(day, x.slot, P),
      food = W.isFood(x.slot),
      n = X.swapAll ? opts.length : 5,
      ck = W.cityKey(day.country, day.city);
    var busy = W.cityBusy(ck),
      pool = W.pool(day.country, day.city);
    var nm = W.SLOT_NAME[x.slot].toLowerCase();
    var pi = X.swapPeek == null ? -1 : peekIndex(opts, X.swapPeek);
    if (pi < 0) X.swapPeek = null; /* (it was said no to, or added elsewhere: back to the list) */
    if (pi > -1)
      return (
        '<div class="swap sk peek" role="region" aria-label="Swap ' +
        nm +
        '"><div class="swap-h"><b class="swap-l">A closer look for ' +
        nm +
        "</b>" +
        '<button type="button" class="icon-btn" data-swapclose="1" aria-label="Close"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></div>' +
        swapPeekHtml(day, x, P, opts, pi) +
        "</div>"
      );
    return (
      '<div class="swap sk" role="region" aria-label="Swap ' +
      nm +
      '"><div class="swap-h">' +
      '<span class="swap-hl"><button type="button" class="btn sm" data-next="' +
      x.slot +
      '">' +
      ICON_REROLL +
      (x.item ? "Next suggestion" : "Suggest one") +
      "</button>" +
      (x.item && W.canEdit()
        ? '<button type="button" class="linkish sw-no" data-nope="' +
          x.slot +
          '" data-name="' +
          esc(x.item.n) +
          '" aria-label="Not for us: ' +
          esc(x.item.n) +
          '">' +
          ICON_NO +
          "Not for us</button>"
        : "") +
      "</span>" +
      '<button type="button" class="icon-btn" data-swapclose="1" aria-label="Close"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></div>' +
      (opts.length
        ? '<b class="swap-l">or pick one for ' +
          nm +
          "</b>" +
          swapCards(opts.slice(0, 3), x, food, day, nm) +
          (opts.length > 3 ? '<div class="opts">' : "") +
          opts
            .slice(3, n)
            .map(function (o) {
              var it = o.it,
                info = [
                  W.stayText(it, food, x.slot),
                  o.km != null ? W.fmtKm(o.km) + " away" : "",
                  food ? it.cuisine : W.priceText(it.ticket, W.curOf(day.country))
                ]
                  .filter(Boolean)
                  .join(" · ");
              return (
                '<div class="opt-w"><button type="button" class="opt" data-peek="' +
                x.slot +
                '" data-name="' +
                esc(it.n) +
                '" aria-label="' +
                esc(it.n) +
                ": more about it, then add it for " +
                nm +
                ' or skip it"><span class="nm">' +
                esc(it.n) +
                '</span><span class="desc">' +
                esc(it.d) +
                "</span>" +
                (info ? '<span class="info">' + esc(info) + "</span>" : "") +
                "</button>" +
                noBtn(x.slot, it.n, "op-no") +
                "</div>"
              );
            })
            .join("") +
          (opts.length > 3 ? "</div>" : "")
        : '<p class="small muted">No other ideas nearby yet.</p>') +
      '<div class="swap-f">' +
      (opts.length > n
        ? '<button type="button" class="linkish" data-swapall="1">Show all ' + opts.length + "</button>"
        : X.swapAll && opts.length > 5
          ? '<button type="button" class="linkish" data-swapall="1">Show fewer</button>'
          : "") +
      (pool && pool.fallback
        ? ""
        : busy
          ? '<span class="loading">Finding more…</span>'
          : W.ideasFull(pool)
            ? ""
            : '<button type="button" class="linkish" data-more="1">Find more ideas</button>') +
      "</div></div>"
    );
  }
  X.swapPanel = swapPanel;
  /* the idea a "Not for us" button is about, and the city whose list it came from (on a day trip, the other town) */
  function ideaFor(day, slot, name) {
    var x = slot
        ? (day.slots || []).filter(function (y) {
            return y.slot === slot;
          })[0]
        : null,
      c = x && x.trip && day.trip ? [day.trip.country, day.trip.name] : [day.country, day.city];
    var pl = /** @type {Pool} */ (W.pool(c[0], c[1]) || { spots: [], food: [] }),
      n = W.norm(name),
      list = /** @type {Array<Spot | Food>} */ ([]).concat(
        slot ? (W.isFood(slot) ? pl.food : pl.spots) || [] : (pl.spots || []).concat(/** @type {any} */ (pl.food || []))
      );
    var it = list.filter(function (i) {
      return W.norm(i.n) === n;
    })[0];
    return it ? { it: it, c: c } : null;
  }
  /* what is known about a place, planned or not, shared by a stop's panel and the swap's closer look: the warnings
     (not for small children, closed, not found, not checked), what it is listed as, the beach, then `mid` (the
     day's own notes) in the middle */
  function placeNotes(it, food, P, mid) {
    var notes = mid || "";
    if (P.p.kid && it.k === -1)
      notes = '<span class="warn">' + (P.p.toddler ? "Not ideal for toddlers" : "Not ideal for kids") + "</span>" + notes;
    if (it.st === "closed") notes = '<span class="warn">May have closed for good. Check before you go</span>' + notes;
    if (it.st === "unfound") notes = '<span class="warn">Couldn\'t find a place by this name. It may not exist</span>' + notes;
    if (it.st === "unverified" && food) notes = '<span class="warn">Not checked yet. Look it up before you go</span>' + notes;
    if (it.place && W.norm(it.place) !== W.norm(it.n)) notes += "<span>Listed as " + esc(it.place) + "</span>";
    if (it.note) notes += "<span>" + esc(it.note) + "</span>";
    if (!food) notes = beachNote(it, P) + notes;
    return notes;
  }
  /* what reviewers love it for, and what to watch for */
  function placeRev(it) {
    return it.love || it.gripe
      ? '<div class="rev">' +
          (it.love ? "<span><b>Loved for</b> " + esc(it.love) + "</span>" : "") +
          (it.gripe ? "<span><b>Watch for</b> " + esc(it.gripe) + "</span>" : "") +
          "</div>"
      : "";
  }
  /* reviews, photos and the place in Google Maps (between `pre` and `post`) */
  function placeLinks(it, day, pre, post) {
    /* three buttons that say what they open (two of them were bare pictures) */
    var b = function (url, icon, text, label) {
      return (
        '<a class="pl-a" href="' +
        esc(url) +
        '" target="_blank" rel="noopener" aria-label="' +
        esc(label) +
        '">' +
        W.icon(icon, 2) +
        text +
        "</a>"
      );
    };
    return (
      '<div class="links">' +
      (pre || "") +
      '<span class="pl-b">' +
      b(W.reviewsUrl(it.n, day.city), "star", "Reviews", "Reviews of " + it.n) +
      b(W.photosUrl(it.n, day.city), "photo", "Photos", "Photos of " + it.n) +
      b(W.gmapsPlace(it, day.city), "map", "Map", it.n + " in Google Maps") +
      "</span>" +
      (post || "") +
      "</div>"
    );
  }
  function peekIndex(opts, name) {
    for (var i = 0; i < opts.length; i++) if (opts[i].it.n === name) return i;
    return -1;
  }
  /* a stop's panel: the photo, when, the full notes, booking, reviews and links */
  W.stopDetails = function (P, day, x, opt) {
    var it = x.item;
    if (!it) return "";
    var food = W.isFood(x.slot),
      T = W.dayTimes(day, P),
      R = T && T.rows[x.slot],
      label = (R && R.label) || W.SLOT_NAME[x.slot];
    var ph = W.picture(it, food, day.country, day.city, { credit: true });
    var notes = placeNotes(
      it,
      food,
      P,
      R
        ? R.warn
            .map(function (w) {
              return '<span class="warn">' + esc(w) + "</span>";
            })
            .join("") +
            R.info
              .map(function (w) {
                return "<span>" + esc(w) + "</span>";
              })
              .join("")
        : ""
    );
    var meta = (food ? [it.cuisine, it.price] : [W.priceText(it.ticket, W.curOf(day.country))])
      .filter(Boolean)
      .map(function (m) {
        return "<span>" + esc(m) + "</span>";
      })
      .join("");
    var bk = W.bookingFor ? W.bookingFor(it, day) : null,
      bkE = W.bookEntryFor ? W.bookEntryFor(P, day, it) : null;
    var booked = bk
      ? '<span class="booked-tag" title="' + esc(bk.title || "") + '">✓ Booked' + (bk.ref ? " · " + esc(bk.ref) : "") + "</span>"
      : "";
    /* (the sheet shows the tickets or the table as a button of its own, above: then not again here) */
    var main = opt && opt.noMain ? "" : W.bookLink(it, day.city, food, day.country); /* the menu itself is below */
    var rev = placeRev(it);
    var when = [R && R.start != null && !R.skip ? W.clock(R.start) : "", label, W.stayText(it, food, x.slot)].filter(Boolean).join(" · ");
    return (
      '<div class="sd">' +
      (ph ? '<div class="sd-pic">' + ph + "</div>" : "") +
      '<p class="sd-when">' +
      esc(when) +
      "</p>" +
      (it.d ? '<p class="sd-d">' + esc(it.d) + "</p>" : "") +
      (notes ? '<div class="slot-notes sd-notes">' + notes + "</div>" : "") +
      (main || booked ? '<div class="slot-act">' + booked + main + "</div>" : "") +
      (meta ? '<div class="meta">' + meta + "</div>" : "") +
      (food ? "" : beachCheck(it)) +
      rev +
      (food && W.menuBlock ? W.menuBlock(it, day, x.key) : "") +
      (it.st === "unsure" ? "<p class=\"small muted\">Couldn't confirm it's still open. Worth a quick check.</p>" : "") +
      (W.altLinksFor ? W.altLinksFor("activity", { it: it, food: food, day: day }) : "") +
      placeLinks(
        it,
        day,
        bkE
          ? '<button type="button" class="linkish" data-gobook="' +
              esc(bkE.key) +
              '">' +
              (bkE.done ? "Booked · see Prepare" : "On your To book list") +
              "</button>"
          : ""
      ) +
      (W.familyActs ? W.familyActs(it, day, x) : "") +
      "</div>"
    );
  };
  /** what a button on the Trip screen does, beyond changing day or view (screens/trip.js hands it over):
      false when nothing needs drawing again @param {HTMLElement} b @param {DOMStringMap} d */
  X.act = function (b, d) {
    var P = W.P,
      day = P.days[S.day - 1];
    if (d.reroll || d.swapclose) {
      var sw = document.querySelector(".swap");
      if (sw && (d.swapclose || X.swapOpen === d.reroll)) {
        W.fxCollapse(sw, function () {
          X.swapOpen = null;
          X.swapAll = false;
          X.swapPeek = null;
          W.render();
        });
        return false;
      }
      X.swapOpen = d.reroll;
      X.swapAll = false;
      X.swapPeek = null;
      W.fxAfter(function () {
        W.fxExpand(".swap");
      });
    } else if (d.next || d.peek || d.peekskip) {
      /* the next suggestion, an idea tapped, or Skip: shown up close in the swap, with Add and Skip; nothing is
         swapped in yet. With no other idea nearby, the next suggestion looks farther and puts it in (undo is offered) */
      var ps = d.next || d.peek || d.peekskip,
        po = W.slotOptions(day, ps, P);
      if (d.next && !po.length) {
        W.reroll(day, d.next, P);
        W.fxAfter(function () {
          W.fxPulse(slotEl(ps));
        });
      } else {
        var at = d.peek ? peekIndex(po, d.name) : d.peekskip && X.swapPeek != null ? peekIndex(po, X.swapPeek) + 1 : 0;
        X.swapOpen = ps;
        X.swapPeek = at > -1 && at < po.length ? po[at].it.n : null;
        W.fxAfter(function () {
          var sw = document.querySelector(".swap");
          if (!sw) return;
          /* (from Free time today the slot's swap can be far down the day: bring it into view) */
          var top = sw.getBoundingClientRect().top;
          if (top < 60 || top > window.innerHeight * 0.6) sw.scrollIntoView({ block: "start" });
          var f = sw.querySelector(X.swapPeek ? ".swp-act [data-use]" : "[data-peek]");
          if (f && f.focus) f.focus({ preventScroll: true });
        });
      }
    } else if (d.peekback) {
      X.swapPeek = null;
      W.fxAfter(function () {
        W.fxStagger(".swap .scard-w, .swap .opt-w", { y: 6, step: 20 });
      });
    } else if (d.useopen != null) {
      var uk = day.n + "|" + d.useopen;
      X.useOpen = X.useOpen === uk ? null : uk;
      W.render();
      return false;
    } else if (d.use) {
      X.useOpen = null;
      var us = d.use,
        un = d.name,
        sw2 = document.querySelector(".swap");
      /* say what happened, with Undo; from Explore also the way to the day it went to */
      var inSwap = !!(sw2 && b.closest(".swap")),
        was = day.slots.filter(function (y) {
          return y.slot === us;
        })[0],
        b4 = W.snapState ? W.snapState() : null,
        said = inSwap
          ? "Changed a stop"
          : "Added to Day " +
            day.n +
            " " +
            (W.SLOT_NAME[us] || "").toLowerCase() +
            (was && was.item && was.item.n !== un ? ", in place of " + W.clip(was.item.n, 26) : "");
      var apply = function () {
        W.useIdea(day, us, un, P);
        W.save();
        if (W.undoPoint) W.undoPoint(b4, said, inSwap || S.tview !== "map" ? 0 : day.n);
        X.swapOpen = null;
        X.swapAll = false;
        X.swapPeek = null;
        W.fxAfter(function () {
          W.fxPulse(slotEl(us));
        });
        W.render();
      };
      if (inSwap) {
        W.fxCollapse(sw2, apply, { dur: 200 });
        return false;
      }
      apply();
      return false;
    } else if (d.nope != null && d.name) {
      var fi = ideaFor(day, d.nope, d.name);
      if (!fi) return false;
      var ns2 = d.nope;
      W.sayNo(fi.c[0], fi.c[1], fi.it, P);
      if (ns2)
        W.fxAfter(function () {
          W.fxPulse(slotEl(ns2));
        });
    } else if (d.unnope) W.unNope(d.unnope);
    else if ((d.bag || d.awake) && W.bagClick) {
      if (!W.bagClick(d)) return false;
    } else if (d.swapall) {
      X.swapAll = !X.swapAll;
      if (X.swapAll)
        W.fxAfter(function () {
          W.fxStagger(Array.prototype.slice.call(document.querySelectorAll(".swap .opt"), 5), { y: 6, step: 20 });
        });
    } else if (d.zoom) {
      if (W.vtActive && W.vtActive()) W.vtZoom(d.zoom);
      return false;
    } else if (d.addplace) {
      /* "Add a place of your own" on the day: Explore, with the search ready */
      S.tview = "map";
      W.render();
      var q0 = document.getElementById("placeQ");
      if (q0) {
        q0.scrollIntoView({ block: "center" });
        q0.focus();
      }
      return false;
    } else if (W.searchClick && W.searchClick(d, day, P)) {
      if (d.psearch || d.padd)
        W.fxAfter(function () {
          var r = document.querySelector(".psearch");
          if (r && r.getBoundingClientRect().top < 0) r.scrollIntoView({ block: "start" });
        });
    } else if (d.r2r) {
      var ls = W.legFor(P, day.stop);
      if (ls && ls.key === d.r2r) W.checkRoutes(ls.a, ls.b);
      else {
        var lp2 = P.stops.findIndex(function (s, i) {
          return i && W.legKey(P.stops[i - 1], s) === d.r2r;
        });
        if (lp2 > 0) W.checkRoutes(P.stops[lp2 - 1], P.stops[lp2]);
      }
    } else if (d.legpick != null && d.legkey) {
      var lp = S.legPick || (S.legPick = {}),
        lgo = (W.C.legs[d.legkey] || {}).opts || [],
        pk = lgo[+d.legpick];
      if (!pk) return false;
      lp[d.legkey] = W.legSig(pk);
      W.fxAfter(function () {
        var e = document.querySelector(".lo.sel .lo-d");
        if (e) W.fxExpand(e, { reveal: false });
      });
    } else if (d.late != null) W.lateClick(d);
    else if ((d.offsave || d.offcopy) && W.offline) W.offline.click(d, P);
    else if (d.rescue) {
      var rd = P.days[(S.day || 1) - 1];
      if (rd && W.rescue) {
        W.rescue(rd, P, d.rescue);
        W.fxAfter(function () {
          W.fxStagger(".go-tl li", { step: 30 });
        });
      }
    } else if (d.unrescue) {
      var ud = P.days[(S.day || 1) - 1];
      if (ud && W.unrescue) W.unrescue(ud);
    } else if (d.jdel != null && W.journalClick) W.journalClick(d);
    else if (d.journalgo) {
      if (W.goToDay) W.goToDay(+d.journalgo);
      if (W.goOpen) W.goOpen("journal"); /* (on Today it may be folded to a line: this is the way to it, so it opens) */
      W.goView("go", "#viewGo .journal");
      return false;
    } else if ((d.live || d.livepick != null || d.site) && W.liveClick) W.liveClick(d, P);
    else if (d.daytrip) {
      /* "Make it a day trip" / "Change day trip" open the choice; "Undo day trip" gives the day back to its town */
      var dn = +d.daytrip,
        tday = P.days[dn - 1];
      if (!tday) return false;
      if (tday.trip && tday.trip.mine) {
        var b4t = W.snapState ? W.snapState() : null;
        if (S.dayTrip) delete S.dayTrip[W.restKey(tday)];
        var mineT = S.mine || {};
        tday.slots.forEach(function (x) {
          if (!mineT[x.key]) delete S.picks[x.key];
        });
        if (W.realChange) W.realChange();
        if (W.undoPoint) W.undoPoint(b4t, "Day " + dn + " is back in " + tday.city);
        W.changed();
      } else
        W.whenLater(function () {
          W.dayTripOpen(dn);
        });
    } else if (d.rest) {
      var rs = S.rest || (S.rest = {});
      if (rs[d.rest]) delete rs[d.rest];
      else {
        rs[d.rest] = 1;
        if (S.dayTrip) delete S.dayTrip[d.rest]; /* (a rest day is not a day out) */
      }
      W.fxAfter(function () {
        W.fxStagger(".slots > .slot", { step: 30 });
      });
    } else if (d.more) {
      var mk = W.cityKey(day.country, day.city);
      ["spots|", "food|"].forEach(function (p) {
        if (W.status[p + mk] !== "loading") delete W.status[p + mk];
      });
      W.loadCity(day.country, day.city, true);
    } else if (d.retry) {
      var rk = W.cityKey(day.country, day.city);
      ["spots|", "food|"].forEach(function (p) {
        delete W.status[p + rk];
      });
      W.loadCity(day.country, day.city);
    } else return false;
  };
})();
