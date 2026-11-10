/* The app icon: the W from the Waypoint wordmark, painted with its night scene (moon, stars, hills, the black cat), on
   the wordmark's cream. Rendered with the app's own font into every size the phones ask for.
     node build/icon/make-icons.js  ->  build/icon/out/*.png (committed; build/standalone.js copies them) */
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const FONT = 'data:font/woff2;base64,' + fs.readFileSync(path.resolve(__dirname, '../../trip/fonts/dela-gothic-one-latin-400-normal.woff2')).toString('base64');
const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="100%" height="100%">
 <defs>
  <filter id="paint" x="-4%" y="-6%" width="108%" height="112%">
   <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="4" result="edge"/>
   <feDisplacementMap in="SourceGraphic" in2="edge" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="shaped"/>
   <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="9" result="grain"/>
   <feColorMatrix in="grain" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.7 1.3" result="speck"/>
   <feComposite in="shaped" in2="speck" operator="in"/>
  </filter>
  <linearGradient id="gNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#363C78"/><stop offset="1" stop-color="#5A65A3"/></linearGradient>
  <clipPath id="w" clipPathUnits="userSpaceOnUse"><text font-family="Dela Gothic One" font-size="120" x="0" y="104" textLength="124" lengthAdjust="spacingAndGlyphs">W</text></clipPath>
 </defs>
 <rect width="140" height="140" fill="#F6F1E6"/>
 <g transform="translate(${70 - 62 * pad} ${70 - 56 * pad}) scale(${pad})">
  <g filter="url(#paint)"><g transform="translate(4 0) skewX(-7)" clip-path="url(#w)">
   <rect x="-20" y="0" width="180" height="140" fill="url(#gNight)"/>
   <circle cx="22" cy="34" r="1.8" fill="#F3E7C4"/><circle cx="104" cy="30" r="1.6" fill="#F3E7C4"/><circle cx="60" cy="40" r="1.4" fill="#F3E7C4"/><circle cx="118" cy="44" r="1.4" fill="#F3E7C4"/>
   <circle cx="38" cy="54" r="13" fill="#F6EAC6"/><circle cx="44" cy="49" r="11.5" fill="#3B4280"/>
   <path d="M-10 96 L14 74 L34 88 L64 60 L94 86 L118 70 L150 92 V140 H-10Z" fill="#2B305C"/>
   <path d="M-10 106 Q70 96 150 102 V140 H-10Z" fill="#3A3F61"/>
   <g fill="#1B1B22" transform="translate(-60 -16)"><ellipse cx="140" cy="113" rx="17" ry="9"/><circle cx="158" cy="104" r="7.5"/><path d="M152 99 L154 90 L158 98Z M160 98 L164 90 L165 100Z"/><path d="M124 112 Q112 100 118 88" stroke="#1B1B22" stroke-width="4" fill="none" stroke-linecap="round"/><rect x="128" y="116" width="4" height="10"/><rect x="146" y="116" width="4" height="10"/></g>
   <g transform="translate(-60 -16)"><circle cx="156" cy="103" r="1.4" fill="#F2C94C"/><circle cx="161" cy="103" r="1.4" fill="#F2C94C"/></g>
  </g></g>
 </g>
</svg>`;
(async () => {
  const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  /* "any" icons fill most of the square; the maskable one keeps the W inside the middle 80%, where every phone's mask shows it */
  const jobs = [['icon-512.png', 512, 1], ['icon-192.png', 192, 1], ['apple-touch-icon.png', 180, 0.92], ['icon-maskable-512.png', 512, 0.72], ['favicon-32.png', 32, 1.05]];
  for (const [name, size, pad] of jobs) {
    const pg = await b.newPage({ viewport: { width: size, height: size } });
    await pg.setContent(`<style>@font-face{font-family:"Dela Gothic One";src:url(${FONT}) format("woff2")}html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden}</style><div style="width:${size}px;height:${size}px">${svg(pad)}</div>`);
    await pg.evaluate(() => document.fonts.load('120px "Dela Gothic One"', 'W')); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(150);
    await pg.screenshot({ path: path.join(out, name), omitBackground: false }); await pg.close();
  }
  fs.writeFileSync(path.join(out, 'icon.svg'), svg(1).replace('font-family="Dela Gothic One"', 'font-family="Dela Gothic One, Arial Black, sans-serif"'));
  await b.close(); console.log('icons:', jobs.map(j => j[0]).join(', '));
})();
