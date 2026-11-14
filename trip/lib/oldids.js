/* The ids a place had before v201 (second script): a name in another script was "x" and ł ø ß đ æ þ ı were dropped
   ("wrocaw"), so what was saved under such an id (a photo index, a record, a library document, a map pack) is read from
   there when the id of today has none. Only the places that read such a record ask (lib/photos.js, places.js, world.js,
   citylib.js, nightfood.js); the ids themselves are W.slug and W.citySlug (lib/photos.js). */
(function () {
  "use strict";
  var W = window.W;
  function oldSlug(/** @type {string} */ s) {
    return (
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/ /g, "-")
        .slice(0, 80) || "x"
    );
  }
  /** the id a town had before v201 when it is not the id it has now. "" when the same, when the old one was only the
      country's own id (Tokyo in Japan was "japan", which is not Tokyo's) and, unless withX, when it was "x", the one
      id every town in another script shared (only a document that names its town, like a photo index, can be read
      from there) @param {string} country @param {string} city @param {boolean} [withX] */
  W.citySlugOld = function (country, city, withX) {
    var o = oldSlug(country + " " + city);
    return o !== W.citySlug(country, city) && (o === "x" ? !!withX : o !== oldSlug(country)) ? o : "";
  };
  /** the id a name had before v201, "" when it is the same @param {string} s */
  W.slugOld = function (s) {
    var o = oldSlug(s);
    return o !== W.slug(s) ? o : "";
  };
})();
