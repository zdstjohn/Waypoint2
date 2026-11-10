/* Waypoint photos: real, freely licensed photos (Wikipedia/Wikimedia) stored in this app's own files
   and listed in its database. A place's own photo when there is one, otherwise one taken near it (labelled so),
   otherwise nothing: the row simply has no picture. Places to eat show only a picture of the restaurant itself. */
(function () {
  "use strict";
  var W = window.W, esc = W.esc;

  /* ---------- real photos from the app's database ---------- */
  var PHOTOS = {}, BYCITY = {}, IDX = {}, DB = null, LINKS = {};
  /* official site for a place, checked against Wikidata (the database behind Wikipedia) */
  W.officialLink = function (it, country, city) { var c = LINKS[W.slug(country + " " + city)], l = c && c[W.norm(it.n)]; return l && l.url ? l : null; };
  /* "Photos" link: an image search for the place */
  W.photosUrl = function (name, city) { return "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(name + " " + city); };
  W.slug = function (s) { return W.norm(s).replace(/ /g, "-").slice(0, 80) || "x"; };
  function citySlug(country, city) { return W.slug(country + " " + city); }

  /* words that say what sort of place something is, not which one ("museum", "piazza", "evening") */
  var GENERIC = {};
  ("the and of at in on with from to near for by a an del della delle dei degli di de da la le les los las el il lo l d du des " +
   "san santa santo sant saint st museum museo musee museu church chiesa iglesia eglise basilica cathedral duomo catedral castle castello " +
   "castillo chateau palace palazzo palacio palais park parco parque garden gardens giardino jardin beach beaches spiaggia playa plage " +
   "square piazza plaza place street via calle rue old town city centre center historic quarter district neighborhood neighbourhood " +
   "tour tours visit walk stroll evening morning afternoon day trip sunset sunrise view views viewpoint national tower torre bridge ponte " +
   "market mercato mercado gallery galleria art arts modern royal great grand little new lake lago mount monte island isola river port " +
   "harbour harbor marina cafe food local famous best area hill hills coast village villages region temple fort fortress monastery " +
   "abbey chapel fountain fontana gate porta arch").split(" ").forEach(function (w) { GENERIC[w] = 1; });
  function idWords(s, skip) { return W.norm(s).split(" ").filter(function (w) { return w.length > 2 && !GENERIC[w] && !skip[w]; }); }
  /* a city's own photos (not "nearby" stand-ins), each with the words that identify it */
  function index(slug, items, country, city) {
    if (IDX[slug]) return IDX[slug];
    var skip = {}; idWords(country + " " + city, {}).forEach(function (w) { skip[w] = 1; });
    var out = [];
    Object.keys(items).forEach(function (k) {
      var p = items[k]; if (!p || !p.url || p.near) return;
      var ws = idWords(k, skip);
      /* one identifying word must be long enough to be a name ("pantheon", "uffizi"), not a common word */
      if (ws.length >= 2 || (ws.length === 1 && ws[0].length >= 6)) out.push({ ws: ws, k: k, p: p });
    });
    return (IDX[slug] = { list: out, skip: skip });
  }
  W.photoFor = function (it, food, country, city) {
    var slug = citySlug(country, city), c = PHOTOS[slug] || BYCITY[W.norm(city)];
    if (!c) return null;
    var p = c[W.norm(it.n)];
    if (p && p.url) return p;
    /* the real place behind an outing (its checked record) has its own photo */
    if (it.place) { p = c[W.norm(it.place)]; if (p && p.url && !p.near) return p; }
    /* a place to eat shows only a photo of that restaurant, found by its full name */
    if (food || !it.n) return null;
    /* a sight named a little differently ("Colosseum & Roman Forum", "Sunset at Park Guell"): a stored sight whose
       identifying words are all in this name; the most specific one wins */
    var I = index(slug + "|" + W.norm(city), c, country, city), have = {}; /** @type {{ ws: string[]; k: string; p: Photo } | null} */ var best = null;
    idWords(it.n, I.skip).forEach(function (w) { have[w] = 1; });
    for (var bi = 0; bi < I.list.length; bi++) {
      var e = I.list[bi];
      if (e.ws.every(function (w) { return have[w]; }) && (!best || e.ws.length > best.ws.length || (e.ws.length === best.ws.length && e.k.length < best.k.length))) best = e;
    }
    return best ? best.p : null;
  };
  /* the index as saved on the phone (lib/offline.js): used before the database answers, and instead of it offline */
  var fromDb = false;
  W.photosSnapshot = function () { return { PHOTOS: PHOTOS, BYCITY: BYCITY, LINKS: LINKS }; };
  W.photosSeed = function (v) { if (fromDb || !v) return; PHOTOS = v.PHOTOS || {}; BYCITY = v.BYCITY || {}; LINKS = v.LINKS || {}; IDX = {}; W.changed(); };
  try {
    if (window.claude && window.claude.use) window.claude.use("db").then(function (db) {
      if (!db) return; DB = db;
      db.collection("links").onSnapshot(function (snap) {
        fromDb = true; LINKS = {}; snap.docs.forEach(function (d) { LINKS[d.id] = (d.data() || {}).items || {}; }); W.changed();
      }, function () {});
      db.collection("photos").onSnapshot(function (snap) {
        fromDb = true; PHOTOS = {}; BYCITY = {}; IDX = {};
        var seen = {};
        snap.docs.forEach(function (d) {
          var x = d.data() || {}; PHOTOS[d.id] = x.items || {};
          /* also by the city's name alone, so "USA" and "United States" find the same photos (only when no other country has that city) */
          if (x.city) { var cn = W.norm(x.city); seen[cn] = (seen[cn] || 0) + 1; BYCITY[cn] = seen[cn] > 1 ? null : PHOTOS[d.id]; }
        });
        W.changed();
      }, function () {});
      flushWanted();
    }, function () {});
  } catch (e) {}

  /* tell the photo finder which places this trip uses (one write per city, only when the list changes) */
  var written = {}, pending = {};
  try { written = JSON.parse(localStorage.getItem("waypoint-wanted-v1") || "null") || {}; } catch (e) {}
  W.wantPhotos = function (country, city, pool, P) {
    if (!pool || pool.fallback) return;
    /* the places this trip has on its days come first (with the day's date), then the best of the rest, up to the city's
       cap: the nightly checks and the photo finder work down these lists, the soonest trip first ("when") */
    var used = {}, first = "";
    ((P && P.days) || []).forEach(function (d) {
      if (d.country !== country || d.city !== city) return;
      var dt = W.dateOf ? W.dateOf(d.n) : null, iso = dt ? W.isoDay(dt) : "";
      if (iso && (!first || iso < first)) first = iso;
      (d.slots || []).forEach(function (x) { if (x.item && x.item.n && !(x.item.n in used)) used[x.item.n] = iso; });
    });
    function pick(list, cap) { var a = list.filter(function (x) { return x.n in used; }), b = list.filter(function (x) { return !(x.n in used); }); return a.concat(b).slice(0, Math.max(cap, a.length)); }
    var spotsL = pick(pool.spots || [], W.IDEA_CAP.spots), foodL = pick(pool.food || [], W.IDEA_CAP.food + 30);   /* (the nightly places to eat come on top of the cap) */
    /* one entry per place, in the same order as the names (null where a place has no pin), so the nightly tools can pair them */
    var pts = spotsL.concat(foodL).map(function (x) { var la = x.lat, ln = x.lng; return la != null && ln != null ? [Math.round(la * 1e4) / 1e4, Math.round(ln * 1e4) / 1e4] : null; });
    var hb = W.homebase(country, city);
    var info = (pool.spots || []).filter(function (x) { return W.isPaid(x) || W.needsBooking(x); }).map(function (x) { return { n: x.n, ticket: x.ticket || "", book: x.book || "", lat: x.lat, lng: x.lng }; });
    var st = W.S.stays[W.cityKey(country, city)];
    var stays = (pool.stay || []).filter(function (x) { return x && x.n && x.lat != null; });
    var body = { country: country, city: city, spots: spotsL.map(function (x) { return x.n; }), food: foodL.map(function (x) { return x.n; }), pts: pts,
      /* each place to eat's menu page, when its list gave one (the nightly task reads the menu from it), in the same order */
      menus: foodL.map(function (x) { return x.menu || ""; }),
      when: first || null, used: Object.keys(used).map(function (n) { return [n, used[n]]; }), paid: info, home: hb && hb.lat != null ? [hb.lat, hb.lng] : null, center: pool.lat != null ? [pool.lat, pool.lng] : null,
      /* where-to-stay areas and the stay you chose by name (not a Booking.com pick, whose pin is real): their pins are checked too */
      stays: stays.map(function (x) { return x.n; }), stayPts: stays.map(function (x) { return [Math.round((x.lat || 0) * 1e4) / 1e4, Math.round((x.lng || 0) * 1e4) / 1e4]; }),
      homeLabel: st && st.label && !st.live && st.lat != null ? st.label : null };
    var sig = "v6/" + foodL.length + "/" + (first || "") + "/" + body.used.length + "/" + (body.used.length ? body.used[body.used.length - 1][0] : "") + "/" + (body.homeLabel || "") + "/" + body.stays.length + "/" + info.filter(function (x) { return x.book; }).length + "/" + (body.home ? body.home.join(",") : "") + "/" + body.spots.length + "/" + body.food.length + "/" + (body.spots[body.spots.length - 1] || "") + "/" + (body.food[body.food.length - 1] || "");
    var id = citySlug(country, city);
    if (written[id] === sig || (pending[id] && pending[id].sig === sig)) return;
    pending[id] = { sig: sig, body: body }; flushWanted();
  };
  var flushing = false;
  function flushWanted() {
    if (!DB || flushing) return;
    var id = Object.keys(pending)[0]; if (!id) return;
    var job = pending[id]; flushing = true;
    DB.doc("wanted/" + id).set(job.body).then(function () {
      written[id] = job.sig; try { localStorage.setItem("waypoint-wanted-v1", JSON.stringify(written)); } catch (e) {}
    }, function () {}).then(function () { if (pending[id] === job) delete pending[id]; flushing = false; flushWanted(); });
  }

  /* ---------- the picture element ---------- */
  W.picture = function (it, food, country, city, opts) {
    opts = opts || {};
    if (W.simple && W.simple()) return "";   /* Simple view: no photos */
    var ph = W.photoFor(it, food, country, city);
    /* a place to eat shows a public picture of the restaurant itself or nothing at all (not a photo of the street outside) */
    if (ph && food && ph.near) ph = null;
    /* no photo yet: nothing at all. A drawing in its place looked worse than the plain row */
    if (!ph) return "";
    /* when the place itself has no photo, a photo of what's nearby says so ("Nearby: Piazza IX Aprile") */
    var near = ph.near ? (typeof ph.near === "string" ? "Nearby: " + ph.near : "Taken nearby") : "";
    return '<img class="pic photo" src="' + esc(W.offline ? W.offline.src(ph.url) : ph.url) + '" alt="' + esc(!ph.near ? it.n : typeof ph.near === "string" ? ph.near + ", near " + it.n : "Taken near " + it.n) + '" loading="lazy" decoding="async">' +
      /* the photographer's name stays (the photos' licences ask for it), but as plain text: a tap on the photo never leaves the app */
      (opts.credit ? '<span class="credit">' + (near ? esc(near) + " · " : "") + "Photo: " + esc(ph.credit || "Wikimedia Commons") + "</span>" : "");
  };
})();
