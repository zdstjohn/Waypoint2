/* Waypoint live prices and booking sites:
   - real places to stay with today's prices for your dates (Booking.com, through your connected account)
   - real flight fares (Expedia, through your connected account)
   - optional links to the sites you already use, next to the official ones */
(function () {
  "use strict";
  var W = window.W,
    esc = W.esc,
    S = W.S;
  var link = W.extLink;
  function region() {
    var m = /-([A-Za-z]{2})$/.exec(navigator.language || "");
    return m ? m[1].toLowerCase() : "us";
  }
  function locale() {
    return (navigator.language || "en-US").replace("_", "-");
  }
  function kidsAges() {
    return W.ages().filter(function (a) {
      return a < 18;
    });
  }
  function adults() {
    return Math.max(
      1,
      W.ages().filter(function (a) {
        return a >= 18;
      }).length || 2
    );
  }
  var ago = W.ago;
  function live() {
    return W.C.live || (W.C.live = { stay: {}, fare: {} });
  }
  var busy = {},
    msg = {};

  /* ---------- the sites you use ---------- */
  var SITES = [
    ["booking", "Booking.com"],
    ["expedia", "Expedia"],
    ["trip", "Trip.com"],
    ["gyg", "GetYourGuide"],
    ["ferryhopper", "Ferryhopper"]
  ];
  function on(k) {
    return !!(S.sites || {})[k];
  }
  W.sitesRow = function () {
    if (W.readOnly) return "";
    return (
      '<div class="sites"><span class="small muted">Show links to</span>' +
      SITES.map(function (s) {
        return '<button type="button" class="chip sm" data-site="' + s[0] + '" aria-pressed="' + on(s[0]) + '">' + s[1] + "</button>";
      }).join("") +
      "</div>"
    );
  };
  function iso(d) {
    return d ? W.isoDay(d) : "";
  }
  function stayDates(s, P) {
    var si = P.stops.indexOf(s),
      first = P.days.filter(function (d) {
        return d.stop === si;
      })[0];
    var nights = s.days - (si === P.stops.length - 1 ? 1 : 0),
      a = first && W.dateOf(first.n);
    if (!a || nights < 1) return null;
    var b = new Date(a);
    b.setDate(b.getDate() + nights);
    return { in: iso(a), out: iso(b), nights: nights };
  }
  function urls(kind, c) {
    var out = [],
      q,
      kids = kidsAges(),
      A = adults();
    if (kind === "stay") {
      var dt = c.dates || {};
      q = c.s.name + ", " + c.s.country;
      if (on("booking"))
        out.push([
          "Booking.com",
          "https://www.booking.com/searchresults.html?ss=" +
            encodeURIComponent(q) +
            (dt.in ? "&checkin=" + dt.in + "&checkout=" + dt.out : "") +
            "&group_adults=" +
            A +
            "&group_children=" +
            kids.length +
            kids
              .map(function (a) {
                return "&age=" + a;
              })
              .join("") +
            "&no_rooms=1"
        ]);
      if (on("expedia"))
        out.push([
          "Expedia",
          "https://www.expedia.com/Hotel-Search?destination=" +
            encodeURIComponent(q) +
            (dt.in ? "&startDate=" + dt.in + "&endDate=" + dt.out : "") +
            "&adults=" +
            A +
            (kids.length
              ? "&children=" +
                encodeURIComponent(
                  kids
                    .map(function (a) {
                      return "1_" + a;
                    })
                    .join(",")
                )
              : "") +
            "&rooms=1"
        ]);
      if (on("trip"))
        out.push([
          "Trip.com",
          "https://www.trip.com/hotels/list?cityName=" +
            encodeURIComponent(c.s.name) +
            "&destName=" +
            encodeURIComponent(c.s.name) +
            "&searchWord=" +
            encodeURIComponent(c.s.name) +
            "&searchType=CT" +
            (dt.in ? "&checkin=" + dt.in + "&checkout=" + dt.out : "") +
            "&crn=1&adult=" +
            A +
            "&children=" +
            kids.length
        ]);
    } else if (kind === "activity") {
      if (on("gyg") && !c.food && (W.isPaid(c.it) || W.needsBooking(c.it)))
        out.push(["GetYourGuide", "https://www.getyourguide.com/s/?q=" + encodeURIComponent(c.it.n + " " + c.day.city)]);
    } else if (kind === "ferry") {
      if (on("ferryhopper"))
        out.push(["Ferryhopper", "https://www.ferryhopper.com/en/ferry-routes/direct/" + W.slug(c.a.name) + "-to-" + W.slug(c.b.name)]);
    } else if (kind === "flight") {
      var d = c.date,
        md = d ? d.getMonth() + 1 + "/" + d.getDate() + "/" + d.getFullYear() : "";
      if (on("expedia"))
        out.push([
          "Expedia",
          "https://www.expedia.com/Flights-Search?trip=oneway&mode=search&leg1=" +
            encodeURIComponent("from:" + c.from + ",to:" + c.to + (md ? ",departure:" + md + "TANYT" : "")) +
            "&passengers=" +
            encodeURIComponent(
              "adults:" + A + (kids.length ? ",children:" + kids.length + "[" + kids.join(";") + "]" : "") + ",infantinlap:N"
            ) +
            "&options=cabinclass%3Aeconomy"
        ]);
    }
    return out;
  }
  /* "Also on Booking.com · Expedia" */
  W.altLinksFor = function (kind, c) {
    var u = urls(kind, c);
    if (!u.length) return "";
    return (
      '<div class="alt small"><span class="muted">Also on</span> ' +
      u
        .map(function (x) {
          return link(x[1], esc(x[0]) + " ↗");
        })
        .join(" · ") +
      "</div>"
    );
  };
  W.altUrls = urls;

  /* ---------- connected accounts ---------- */
  function call(server, tool, input) {
    return W.getMcp().then(function (m) {
      if (!m) throw { code: "not_granted" };
      return m.callTool(server, tool, input);
    });
  }

  /* ---------- places to stay, live from Booking.com ---------- */
  W.liveStays = function (s, P) {
    if (W.readOnly) return "";
    var ck = W.cityKey(s.country, s.name),
      dt = stayDates(s, P),
      L = live().stay[ck],
      key = "stay|" + ck;
    if (!dt) return '<p class="small muted live-note">Add your start date under How long? to see live prices for your nights.</p>';
    var fresh = L && L.in === dt.in && L.out === dt.out && L.ages === W.ages().join(",");
    var h =
      '<div class="live"><div class="live-h"><span><b>Live prices</b> <span class="small muted">· ' +
      esc(
        dt.nights +
          " night" +
          (dt.nights > 1 ? "s" : "") +
          " from " +
          new Date(dt.in + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
          " · Booking.com" +
          (fresh ? " · " + ago(L.at) : "")
      ) +
      "</span></span>" +
      (busy[key]
        ? '<span class="loading">Checking…</span>'
        : '<button type="button" class="btn quiet sm" data-live="stay" data-ck="' +
          esc(ck) +
          '">' +
          (fresh ? "Refresh" : "See prices") +
          "</button>") +
      "</div>";
    if (msg[key]) h += '<p class="warn">' + esc(msg[key]) + "</p>";
    if (fresh && L.items.length) {
      var cur = S.stays[ck];
      h +=
        '<ul class="live-list">' +
        L.items
          .map(function (x, j) {
            var chosen = cur && cur.label === x.n;
            return (
              '<li class="' +
              (chosen ? "on" : "") +
              '"><div class="lv-a"><b>' +
              esc(x.n) +
              '</b><span class="small muted">' +
              esc(
                [x.type, x.area, x.score ? x.score + (x.reviews ? " (" + x.reviews.toLocaleString() + " reviews)" : "") : ""]
                  .filter(Boolean)
                  .join(" · ")
              ) +
              "</span></div>" +
              '<div class="lv-p"><b>' +
              W.money(x.total, x.cur) +
              '</b><span class="small muted">' +
              (dt ? W.money(x.total / dt.nights, x.cur) + " a night" : "") +
              "</span></div>" +
              '<div class="lo-act">' +
              (chosen
                ? '<span class="picked">✓ Staying here</span>' +
                  (W.watchChip && cur.live ? '<span class="chk-a inl">' + W.watchChip("stay", ck, null) + "</span>" : "")
                : '<button type="button" class="btn quiet sm" data-livepick="' + j + '" data-ck="' + esc(ck) + '">Stay here</button>') +
              link(x.url, "Book on Booking.com ↗") +
              "</div></li>"
            );
          })
          .join("") +
        "</ul>";
    } else if (fresh) h += '<p class="small muted">Nothing available for these dates. Try other dates or check Booking.com directly.</p>';
    return h + "</div>";
  };
  /* the Booking.com search for a place's nights (shared with the price watch) */
  W.stayInput = function (ck, P, hotel) {
    var s = P.stops.filter(function (x) {
        return W.cityKey(x.country, x.name) === ck;
      })[0],
      dt = s && stayDates(s, P);
    if (!dt) return null;
    var kids = kidsAges(),
      input = {
        destination: s.name + ", " + s.country,
        checkin_date: dt.in,
        checkout_date: dt.out,
        number_of_adults: adults(),
        number_of_rooms: 1,
        user_country_code: region(),
        user_locale: locale().toLowerCase(),
        user_query:
          "Places to stay in " + s.name + " for " + adults() + " adults" + (kids.length ? " and children aged " + kids.join(", ") : "")
      };
    if (kids.length) input.children_ages = kids;
    if (hotel) {
      input.hotel_names = [hotel];
      input.user_query = hotel + " in " + s.name;
    }
    return { input: input, dt: dt, s: s };
  };
  function fetchStays(ck, P) {
    var I = W.stayInput(ck, P),
      key = "stay|" + ck,
      dt = I && I.dt;
    if (!I || busy[key]) return;
    busy[key] = true;
    msg[key] = "";
    W.render();
    var input = I.input;
    call("Booking.com", "accommodations_search", input)
      .then(
        function (r) {
          var list = (r && r.payload && r.payload.accommodations) || [];
          live().stay[ck] = {
            in: dt.in,
            out: dt.out,
            ages: W.ages().join(","),
            at: Date.now(),
            items: list
              .filter(function (a) {
                return a && a.name && a.price && +a.price.book > 0 && /^https:\/\/([a-z0-9-]+\.)*booking\.com\//.test(a.url || "");
              })
              .slice(0, 8)
              .map(function (a) {
                var loc = a.location || {},
                  co = loc.coordinates || {},
                  rt = a.rating || {};
                return {
                  n: String(a.name),
                  url: a.url,
                  total: +a.price.book,
                  cur: String(a.price.currency || "USD"),
                  type: String(a.accommodationType || ""),
                  area: String(loc.district_name || ""),
                  score: rt.review_score || null,
                  reviews: rt.number_of_reviews || 0,
                  lat: +co.latitude || null,
                  lng: +co.longitude || null
                };
              })
          };
        },
        function (e) {
          msg[key] = W.mcpMsg(e, "Booking.com");
        }
      )
      .then(function () {
        busy[key] = false;
        W.changed();
      });
  }
  /* staying at a live result: it becomes your lodging, with its real price in the budget */
  function pickStay(ck, j, P) {
    var L = live().stay[ck],
      x = L && L.items[+j];
    if (!x) return;
    S.stays[ck] = {
      label: x.n,
      lat: x.lat,
      lng: x.lng,
      live: { total: x.total, cur: x.cur, url: x.url, at: L.at, in: L.in, out: L.out, src: "Booking.com" }
    };
    var p = ck.split("|");
    if (W.freshPicks) W.freshPicks(p[0], p[1]);
  }

  /* ---------- flight fares, live from Expedia ---------- */
  function fareTrip(dir, P) {
    var ap = P.ap;
    if (!ap || !P.stops.length) return null;
    var out = dir === "out",
      s = out ? P.stops[0] : P.stops[P.stops.length - 1],
      d = W.dateOf(out ? 1 : P.N);
    return {
      from: out ? ap.code || ap.name : s.name,
      to: out ? s.name : ap.code || ap.name,
      date: d,
      key: dir + "|" + (out ? ap.code + ">" + s.name : s.name + ">" + ap.code) + "|" + (d ? iso(d) : "") + "|" + W.ages().join(",")
    };
  }
  W.fareChip = function (dir, P) {
    var F = fareTrip(dir, P);
    if (!F || W.readOnly || !F.date) return "";
    var L = live().fare[F.key],
      k = "fare|" + F.key;
    if (busy[k]) return '<span class="chip-a busy"><span class="loading">Checking fares…</span></span>';
    return L ? "" : '<button type="button" class="chip-a" data-live="fare" data-dir="' + dir + '">Live fares</button>';
  };
  W.liveFares = function (dir, P, compact) {
    var F = fareTrip(dir, P);
    if (!F || W.readOnly) return "";
    if (!F.date) return compact ? "" : '<p class="small muted live-note">Add your start date under Plan to see live fares.</p>';
    var L = live().fare[F.key],
      k = "fare|" + F.key;
    if (compact && !L && !msg[k]) return "";
    var h = compact
      ? '<div class="live fares compact"><div class="live-h"><span class="small muted"><b>Expedia fares</b>' +
        (L ? " · " + ago(L.at) : "") +
        "</span>" +
        (busy[k]
          ? '<span class="loading">Checking…</span>'
          : '<button type="button" class="linkish" data-live="fare" data-dir="' +
            dir +
            '">' +
            (L ? "Refresh" : "Try again") +
            "</button>") +
        "</div>"
      : '<div class="live fares"><div class="live-h"><span><b>Live fares</b> <span class="small muted">· Expedia' +
        (L ? " · " + ago(L.at) : "") +
        "</span></span>" +
        (busy[k]
          ? '<span class="loading">Checking…</span>'
          : '<button type="button" class="btn quiet sm" data-live="fare" data-dir="' +
            dir +
            '">' +
            (L ? "Refresh" : "See fares") +
            "</button>") +
        "</div>";
    if (msg[k]) h += '<p class="warn">' + esc(msg[k]) + "</p>";
    if (L && L.items.length) {
      var ex =
        "https://www.expedia.com/Flights-Search?trip=oneway&mode=search&leg1=" +
        encodeURIComponent(
          "from:" +
            F.from +
            ",to:" +
            F.to +
            ",departure:" +
            (F.date.getMonth() + 1) +
            "/" +
            F.date.getDate() +
            "/" +
            F.date.getFullYear() +
            "TANYT"
        ) +
        "&passengers=" +
        encodeURIComponent(
          "adults:" +
            adults() +
            (kidsAges().length ? ",children:" + kidsAges().length + "[" + kidsAges().join(";") + "]" : "") +
            ",infantinlap:N"
        );
      h +=
        '<ul class="live-list">' +
        L.items
          .map(function (x) {
            return (
              '<li><div class="lv-a"><b>' +
              esc(x.air) +
              '</b><span class="small muted">' +
              esc([x.when, x.stops, x.dur].filter(Boolean).join(" · ")) +
              "</span></div>" +
              '<div class="lv-p"><b>' +
              W.money(x.total, x.cur) +
              '</b><span class="small muted">everyone</span></div></li>'
            );
          })
          .join("") +
        "</ul>" +
        '<div class="lo-act">' +
        link(ex, "See these on Expedia ↗") +
        "</div>";
    } else if (L) h += '<p class="small muted">No fares found for that day.</p>';
    return h + "</div>";
  };
  function fetchFares(dir, P) {
    var F = fareTrip(dir, P),
      k = F && "fare|" + F.key;
    if (!F || !F.date || busy[k]) return;
    busy[k] = true;
    msg[k] = "";
    W.render();
    var input = W.fareInput(dir, P).input;
    call("Expedia", "search_flights", input)
      .then(
        function (r) {
          var opts = (r && r.payload && r.payload.options) || [];
          if (!F) return;
          live().fare[F.key] = {
            at: Date.now(),
            items: opts
              .slice(0, 4)
              .map(function (o) {
                var sl = (o.slices || [])[0] || {},
                  ui = sl.ui_text || {},
                  legs = sl.legs || [],
                  pr = (o.price && o.price.total_price) || {};
                var air =
                  legs
                    .map(function (l) {
                      return l.marketing_airline_name;
                    })
                    .filter(function (v, i, a) {
                      return v && a.indexOf(v) === i;
                    })
                    .join(" + ") ||
                  ui.operating_info ||
                  "Flight";
                return {
                  air: air,
                  when: ui.departs_arrives || [sl.departure_time, sl.arrival_time].filter(Boolean).join(" → "),
                  stops: ui.stops_label || "",
                  dur: ui.flight_duration_display || sl.flight_duration || "",
                  total: +pr.value || 0,
                  cur: pr.currency || "USD"
                };
              })
              .filter(function (x) {
                return x.total > 0;
              })
          };
        },
        function (e) {
          msg[k] = W.mcpMsg(e, "Expedia");
        }
      )
      .then(function () {
        busy[k] = false;
        W.changed();
      });
  }
  /* the Expedia search for a flight (shared with the price watch) */
  W.fareInput = function (dir, P) {
    var F = fareTrip(dir, P);
    if (!F || !F.date) return null;
    var ages = W.ages(),
      kids = ages.filter(function (a) {
        return a >= 2 && a < 18;
      }),
      lap = ages.filter(function (a) {
        return a < 2;
      }).length;
    var input = {
      origin: F.from,
      destination: F.to,
      departure_date: iso(F.date),
      adult_count: adults(),
      limit: 4,
      sort_type: "PRICE",
      user_locale: locale(),
      client_device_info: { device_type: /Mobi|Android/i.test(navigator.userAgent) ? "mobile_web" : "desktop", agent_name: "ClaudeAI" },
      query_text: "Flights from " + F.from + " to " + F.to
    };
    if (kids.length) input.children_age_list = kids;
    if (lap) input.infants_in_lap_count = lap;
    return { input: input, F: F };
  };
  W.callTool = call;
  /* the cheapest live fare each way, for the budget */
  W.fareMin = function (dir, P) {
    var F = fareTrip(dir, P),
      L = F && live().fare[F.key];
    if (!L || !L.items.length) return null;
    return L.items.reduce(function (m, x) {
      return !m || x.total < m.total ? x : m;
    }, null);
  };

  /* A typical fare for a flight from home (one way: half a return booked a few months ahead, the whole group), from
     Claude, for the budget when the flight isn't booked and no live fare was checked. Asked once per route, month and
     group; marked "estimate" wherever it shows */
  /** @param {"out" | "home"} dir @param {Plan} P */
  W.fareGuess = function (dir, P) {
    var F = fareTrip(dir, P);
    if (!F || !F.date) return null;
    var month = F.date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      key = F.from + ">" + F.to + "|" + month + "|" + W.ages().join(","),
      C = W.C.fare || (W.C.fare = {}),
      g = C[key];
    if (g) return g.total > 0 ? g : null;
    if (W.readOnly) return null;
    W.run(
      "fareg|" + key,
      "Typical economy airfare for one way from " +
        F.from +
        " to " +
        F.to +
        " in " +
        month +
        ", booked a few months ahead as half of a return ticket, for this group: " +
        (W.who ? W.who() : "") +
        ' The total for everyone, as a plain number, in the currency of the place they fly from (cur = its ISO 4217 code). If you can\'t tell, say total 0.\nReply with JSON only: {"cur":"USD","total":0}',
      "quick",
      function (r) {
        r = r || {};
        var total = W.V.money(r.total) || 0;
        W.C.fare = W.C.fare || {};
        W.C.fare[key] = { cur: W.V.currency(r.cur, "USD"), total: total > 0 ? total : 0 };
      }
    );
    return null;
  };
  W.fareGuessBusy = function () {
    return Object.keys(W.status).some(function (k) {
      return k.indexOf("fareg|") === 0 && W.status[k] === "loading";
    });
  };

  W.liveClick = function (d, P) {
    if (d.site) {
      var ss = S.sites || (S.sites = {});
      ss[d.site] = !ss[d.site];
      return true;
    }
    if (d.live === "stay") {
      fetchStays(d.ck, P);
      return true;
    }
    if (d.live === "fare") {
      fetchFares(d.dir, P);
      return true;
    }
    if (d.livepick != null) {
      pickStay(d.ck, d.livepick, P);
      return true;
    }
    return false;
  };
})();
