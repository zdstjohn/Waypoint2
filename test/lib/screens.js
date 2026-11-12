/* Every screen of the app and how to reach it from a loaded trip; shared by the screenshots, the layout sweep and the smoke test. */
module.exports = [
  { id: 'setup', go: () => W.goView('setup') },
  { id: 'setup-open', go: () => { W.goView('setup'); setTimeout(() => document.querySelectorAll('#viewSetup details').forEach(d => d.open = true), 100); } },
  { id: 'trip-days', go: () => { W.S.tview = 'days'; W.goView('trip'); } },
  { id: 'stop-panel', go: () => { W.S.tview = 'days'; W.goView('trip'); setTimeout(() => { const x = W.P.days[1].slots.find(x => x.item && !W.isFood(x.slot)); if (x) W.openStop(x.key); }, 300); } },
  { id: 'meal-panel', go: () => { W.S.tview = 'days'; W.goView('trip'); setTimeout(() => { const x = W.P.days[1].slots.find(x => x.item && W.isFood(x.slot)); if (x) W.openStop(x.key); }, 300); } },
  { id: 'swap', go: () => { W.S.tview = 'days'; W.goView('trip'); setTimeout(() => { const b = document.querySelector('#viewTrip .slot:not(.food) [data-swap], #viewTrip .slot:not(.food) button[aria-label^="Swap"]'); if (b) b.click(); }, 300); } },
  { id: 'explore', wait: 2500, go: () => W.goView('explore') },
  { id: 'book', go: () => W.goView('book') },
  { id: 'book-add', go: () => { W.goView('book'); setTimeout(() => { document.querySelectorAll('#viewBook details').forEach(d => d.open = true); const a = [...document.querySelectorAll('#viewBook a, #viewBook button')].find(x => /Add a booking by hand/.test(x.textContent)); if (a) a.click(); }, 300); } },
  { id: 'recap', go: () => W.goView('recap') },
  { id: 'today', go: () => W.goView('go') },
  { id: 'settings', go: () => W.goView('settings') },
  { id: 'menu', go: () => { W.goView('trip'); setTimeout(() => { const b = document.querySelector('[data-sync="menu"]'); if (b) b.click(); }, 200); } },
];
