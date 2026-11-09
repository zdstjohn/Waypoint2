/* Waypoint map-pack worker: fetches a city's street-map pack (JSON parts of base64 from the asset store, or one file),
   decodes it off the main thread, and keeps the decoded pack in IndexedDB so the next visit needs no download.
   Messages in:  { id, key, ver, urls: [...] }  (parts, joined in order)  or  { id, key, ver, url }  (one file)
   Messages out: { id, hdr, body }  (body: an ArrayBuffer, transferred)  or  { id, error, cached }
   The cache entry is keyed by `key` and kept only while `ver` matches (parts have unique asset urls, so a rebuilt pack
   gets a new version on its own). Nothing here is ever deleted except a stale entry being replaced. */
"use strict";
var DB = "waypoint-vt", STORE = "packs", dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise(function (ok, no) {
    try {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE, { keyPath: "key" }); };
      r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; r.onblocked = function () { no(new Error("blocked")); };
    } catch (e) { no(e); }
  });
  dbp.then(null, function () { dbp = null; });
  return dbp;
}
function get(key) {
  return db().then(function (d) { return new Promise(function (ok) { try { var t = d.transaction(STORE, "readonly").objectStore(STORE).get(key); t.onsuccess = function () { ok(t.result || null); }; t.onerror = function () { ok(null); }; } catch (e) { ok(null); } }); }, function () { return null; });
}
function put(rec) {
  return db().then(function (d) { return new Promise(function (ok) { try { var t = d.transaction(STORE, "readwrite"); t.objectStore(STORE).put(rec); t.oncomplete = function () { ok(true); }; t.onerror = function () { ok(false); }; } catch (e) { ok(false); } }); }, function () { return false; });
}
function b64(s) {
  var bin = atob(s), a = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}
function unwrap(u8) {
  /* a pack inside a WebAssembly file's custom section (older packs and the glyph files) -> the bare pack */
  if (u8[0] === 0 && u8[1] === 0x61 && u8[2] === 0x73 && u8[3] === 0x6d) {
    var i = 9, leb = function () { var v = 0, sh = 0, c; do { c = u8[i++]; v += (c & 0x7f) * Math.pow(2, sh); sh += 7; } while (c & 0x80); return v; };
    leb(); var nl = leb(); i += nl; u8 = u8.subarray(i);
  }
  return u8;
}
function parse(u8) {
  u8 = unwrap(u8);
  if (new TextDecoder().decode(u8.subarray(0, 6)) !== "WPVT1\n") throw new Error("bad pack");
  var n = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(6);
  var hdr = JSON.parse(new TextDecoder().decode(u8.subarray(10, 10 + n)));
  var body = u8.slice(10 + n);   /* its own buffer, so it can be stored and transferred */
  return { hdr: hdr, body: body.buffer };
}
function fetchParts(urls) {
  return Promise.all(urls.map(function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error("missing part " + u); return r.json(); }); })).then(function (parts) {
    var bufs = parts.map(function (p) { return b64(p.b64 || ""); }), n = 0;
    bufs.forEach(function (b) { n += b.length; });
    var all = new Uint8Array(n), o = 0;
    bufs.forEach(function (b) { all.set(b, o); o += b.length; });
    return all;
  });
}
function fetchFile(url) {
  return fetch(url).then(function (r) { if (!r.ok) throw new Error("missing " + url); return r.arrayBuffer(); }).then(function (b) { return new Uint8Array(b); });
}
onmessage = function (ev) {
  var m = ev.data || {};
  if (m.ping) { postMessage({ pong: 1 }); return; }
  get(m.key).then(function (rec) {
    if (rec && rec.ver === m.ver && rec.body && rec.hdr) { postMessage({ id: m.id, hdr: rec.hdr, body: rec.body, cached: true }, [rec.body]); return; }
    return (m.urls ? fetchParts(m.urls) : fetchFile(m.url)).then(parse).then(function (p) {
      return put({ key: m.key, ver: m.ver, hdr: p.hdr, body: p.body, at: Date.now() }).then(function () {
        postMessage({ id: m.id, hdr: p.hdr, body: p.body }, [p.body]);
      });
    });
  }).then(null, function (e) { postMessage({ id: m.id, error: String(e && e.message || e) }); });
};
