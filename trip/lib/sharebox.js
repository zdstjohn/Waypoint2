/* A shared trip, locked to its code (the audit's S1).
   Everyone admitted to the app's database can read, and list, its shared documents. So a shared trip is kept where only
   its code finds it, in a form only its code reads: the code is stretched (PBKDF2, SHA-256, 150,000 rounds) into the
   document's name, the names of the documents under it, and an AES-GCM key. A listing shows names and sealed text:
   never a code, a traveler, a date or a place. (Whoever may write to the database can still delete a document; that
   is the database's rule, not something a code can change.)
     W.shareBox(code)  -> Promise of { id, name(label), seal(obj), open(doc) }
     W.sharePlain(code) -> the same shape with nothing sealed, for a trip shared before v131 whose owner's app has not
                           saved it since (it is replaced the next time it does) */
(function () {
  "use strict";
  var W = window.W, boxes = {};
  function b64(buf) { var s = "", a = new Uint8Array(buf); for (var i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, /** @type {any} */ (a.subarray(i, i + 0x8000))); return btoa(s); }
  function unb64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function hex(a) { var s = ""; for (var i = 0; i < a.length; i++) s += (a[i] < 16 ? "0" : "") + a[i].toString(16); return s; }
  /* a long list is packed (deflate) before it is sealed, where the browser can, so it stays inside one document */
  W.sharePacks = !!(window.CompressionStream && window.DecompressionStream && window.Response && window.Blob);
  function pipe(bytes, through) { return new Response(new Blob([bytes]).stream().pipeThrough(through)).arrayBuffer(); }
  W.shareCode = function (code) { return String(code || "").toLowerCase().replace(/[^a-z0-9]/g, ""); };
  W.shareBox = function (code) {
    code = W.shareCode(code);
    if (boxes[code]) return boxes[code];
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle || !window.TextEncoder || code.length < 6) return Promise.reject(new Error("no-crypto"));
    var enc = new TextEncoder(), dec = new TextDecoder();
    return (boxes[code] = subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveBits"]).then(function (k) {
      return subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode("waypoint-share-v1"), iterations: 150000 }, k, 512);
    }).then(function (bits) {
      var a = new Uint8Array(bits);
      return Promise.all([subtle.importKey("raw", a.slice(0, 32), "AES-GCM", false, ["encrypt", "decrypt"]),
        subtle.importKey("raw", a.slice(32, 64), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])]);
    }).then(function (ks) {
      var key = ks[0], mac = ks[1], names = {};
      /* the name of a document that belongs to this trip ("trip", "pool:<city>"): the same for everyone with the code, meaningless without it */
      function name(label) {
        if (names[label]) return Promise.resolve(names[label]);
        return subtle.sign("HMAC", mac, enc.encode(label)).then(function (sig) { return (names[label] = "x" + hex(new Uint8Array(sig).subarray(0, 12))); });
      }
      return name("trip").then(function (id) {
        return { id: id, name: name,
          seal: function (obj) {
            var iv = window.crypto.getRandomValues(new Uint8Array(12)), text = enc.encode(JSON.stringify(obj)), z = W.sharePacks && text.length > 150000;
            return Promise.resolve(z ? pipe(text, new window.CompressionStream("deflate-raw")) : text)
              .then(function (pt) { return subtle.encrypt({ name: "AES-GCM", iv: iv }, key, pt); })
              .then(function (ct) { var doc = /** @type {any} */ ({ v: 1, iv: b64(iv), ct: b64(ct), at: Date.now() }); if (z) doc.z = 1; return doc; });
          },
          /* null for anything this code did not seal (another trip's document, a damaged or planted one) */
          open: function (doc) {
            if (!doc || doc.v !== 1 || typeof doc.ct !== "string" || typeof doc.iv !== "string") return Promise.resolve(null);
            return Promise.resolve().then(function () { return subtle.decrypt({ name: "AES-GCM", iv: unb64(doc.iv) }, key, unb64(doc.ct)); })
              .then(function (pt) { return doc.z ? pipe(pt, new window.DecompressionStream("deflate-raw")) : pt; })
              .then(function (pt) { return JSON.parse(dec.decode(pt)); }).catch(function () { return null; });
          } };
      });
    }));
  };
  W.sharePlain = function (code) {
    code = W.shareCode(code);
    return { id: code, plain: 1, name: function (label) { return Promise.resolve(label.replace(/^pool:/, "")); },
      seal: function (obj) { return Promise.resolve(obj); }, open: function (doc) { return Promise.resolve(doc && typeof doc === "object" && doc.v !== 1 ? doc : null); } };
  };
})();
