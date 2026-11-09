/* Runs inside the page: finds text poking out of the viewport, text clipped or cut off by its box, and text that overlaps
   other text. Hidden-for-screen-readers text, the fixed tab bar, closed <details>, clamped lines and wrapped inline text are not faults. */
module.exports = () => {
  const vw = innerWidth, out = [], seen = new Set();
  const vis = el => { if (el.closest('.vh, .sr-only, .tabs, nav.tabs, [hidden]')) return null; for (let d = el.parentElement; d; d = d.parentElement) if (d.tagName === 'DETAILS' && !d.open && !(el.closest('summary') && el.closest('summary').parentElement === d)) return null; const r = el.getBoundingClientRect(); if (!r.width || !r.height) return null; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') return null; return r; };
  const label = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')) + ' "' + (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40) + '"';
  const push = (kind, el, extra) => { const k = kind + '|' + label(el); if (seen.has(k)) return; seen.add(k); out.push({ kind, el: label(el), extra }); };
  // 1. anything poking out of the viewport sideways
  for (const el of document.querySelectorAll('body *')) {
    const r = vis(el); if (!r) continue;
    if (el.closest('svg') && el.tagName !== 'svg') continue;
    if (r.right > vw + 1 && r.left < vw && getComputedStyle(el).position !== 'fixed' && !el.closest('.day-scroller, .dayscroller, [data-scroll], .scroll-x, .chips, .sp-pages, .pages, .sp-deck')) {
      let p = el, scrollable = false; while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { scrollable = true; break; } p = p.parentElement; }
      if (!scrollable) push('offscreen', el, Math.round(r.right - vw) + 'px');
    }
  }
  // 2. text clipped or overflowing its box (single-line boxes whose content is wider, or taller than they are)
  for (const el of document.querySelectorAll('body *')) {
    const r = vis(el); if (!r) continue; if (el.closest('svg')) continue;
    const cs = getComputedStyle(el);
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) continue;
    if (cs.textOverflow === 'ellipsis' || cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue;
    if (el.scrollWidth > el.clientWidth + 2 && cs.whiteSpace.startsWith('nowrap')) push('clipped', el, (el.scrollWidth - el.clientWidth) + 'px wider than its box');
    if (cs.overflowY === 'hidden' && el.scrollHeight > el.clientHeight + 4 && !el.closest('.credit, .painted') && cs.webkitLineClamp === 'none' && cs.display !== '-webkit-box') push('cut-off', el, (el.scrollHeight - el.clientHeight) + 'px taller than its box');
  }
  // 3. sibling text elements that overlap each other
  const texts = [...document.querySelectorAll('body *')].filter(el => !el.closest('svg') && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && vis(el));
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j]; if (a.contains(b) || b.contains(a)) continue;
    if (a.closest('[aria-hidden="true"]') || b.closest('[aria-hidden="true"]')) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ox > 4 && oy > 4) {
      if (getComputedStyle(a).display.startsWith('inline') && getComputedStyle(b).display.startsWith('inline') && a.parentElement === b.parentElement) continue;   // wrapped inline text
      // not an overlay on purpose (a sheet over the page, a badge on a picture)
      const za = getComputedStyle(a), zb = getComputedStyle(b);
      if ((za.position !== 'static' && za.zIndex !== 'auto') || (zb.position !== 'static' && zb.zIndex !== 'auto')) continue;
      if (a.closest('.sheet, .modal, .undo, .toast, .lifthint, .sheet-back, .tm, .menu, .trip-menu') !== b.closest('.sheet, .modal, .undo, .toast, .lifthint, .sheet-back, .tm, .menu, .trip-menu')) continue;
      if (a.closest('.thumb, .pic-wrap, .sd-pic, .sp-hero, .gh-pic') || b.closest('.thumb, .pic-wrap, .sd-pic, .sp-hero, .gh-pic')) continue;
      push('overlap', a, 'with ' + label(b) + ' (' + Math.round(ox) + 'x' + Math.round(oy) + ')');
    }
  }
  return out;
};
