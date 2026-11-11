(() => {
  /* places sit at fixed spots worked out from their number, never random ones: Math.random is seeded, but which numbers a
     list got would depend on what else drew first, and the plan (nearest first) and its walks with it */
  let calls = {country:0, spots:0, food:0, geo:0}; window.__calls = calls; let seq = 0;
  /* a list's number comes from what was asked, never from the order the requests came in (that order follows timing, and
     with it the places' names, spots and the plan): a city's headline sights are list 1, its other half 2, its places to
     eat 3 and 4, then rainy-day places 7, food-needs places 9, and "more" pages from 8
     (things to do) and 10 (places to eat) up, one more each time for that city */
  const pages = {};
  const listNo = (prompt, city) => {
    const more = k => { const key = city + '|' + k; pages[key] = (pages[key] || 0) + 1; return (k === 'spots' ? 8 : 10) + (pages[key] - 1) * 4; };
    if (/best-known sights and must-do/.test(prompt)) return 1;
    if (/MORE things to do/.test(prompt)) return more('spots');
    if (/indoor things to do/.test(prompt)) return 7;
    if (/things to do|must-do experiences|hidden gems and local favorites/.test(prompt)) return 2;
    if (/MORE places to eat/.test(prompt)) return more('food');
    if (/suit this group's food needs/.test(prompt)) return 9;
    if (/that are not the most famous ones/.test(prompt)) return 4;
    return 3;
  };
  const centers = {Rome:[41.9,12.5],Florence:[43.77,11.25],Venice:[45.44,12.33],Madrid:[40.42,-3.70],Toledo:[39.86,-4.02],Seville:[37.39,-5.98],Granada:[37.18,-3.60],Malaga:[36.72,-4.42],Barcelona:[41.39,2.17]};
  const sample = async (prompt) => { await new Promise(r=>setTimeout(r,300)); window.__paints=(window.__paints||0)+1;
    let shapes=''; for(let i=0;i<60;i++){ shapes+=`<circle cx="${(i*37)%320}" cy="${(i*53)%200}" r="${6+(i%9)}" fill="hsl(${(i*29)%360},60%,60%)"/>`; }
    return {text:'Here you go:\n<svg viewBox="0 0 320 200"><defs><linearGradient id="g"><stop offset="0" stop-color="#8CC6EA"/><stop offset="1" stop-color="#F4BE62"/></linearGradient></defs><rect width="320" height="200" fill="url(#g)"/><g>'+shapes+'</g><script>alert(1)</script><image href="https://evil.example/x.png"/></svg>', truncated:false}; };
  sample.json = async (prompt) => {
    await new Promise(r => setTimeout(r, 150));
    const m = prompt.match(/in (?:and around )?([A-Za-z ]+), ([A-Za-z ]+)/);
    if (/How many days should this group spend/.test(prompt)) { window.__rangeCalls=(window.__rangeCalls||0)+1;
      const names = prompt.match(/Places: (.*?)\n/)[1].split('; ');
      const V = {Rome:[3,5],Florence:[2,4],Venice:[2,3],Naples:[2,4]};
      return { stays: names.map(n => { const c = n.split(',')[0]; const v = V[c] || [2,3]; return { n, sights: v[0], relaxed: v[1] }; }) }; }
    if (/places to stay in/.test(prompt)) { window.__lodgeCalls=(window.__lodgeCalls||[]); window.__lodgeCalls.push(prompt);
      const city = prompt.match(/places to stay in ([A-Za-z ]+),/)[1]; const c = (({Rome:[41.9,12.5],Florence:[43.77,11.25],Venice:[45.44,12.33]})[city] || (function(){ var m = prompt.match(new RegExp(city + ', ([A-Za-z ]+)')); var b = m && window.W && W.findCity && W.findCity(m[1].trim(), city); return b && b.lat != null ? [b.lat, b.lng] : [40,10]; })());
      const more = prompt.match(/4 MORE (budget|mid-range|luxury)/); const tiers = more ? [{'mid-range':'mid'}[more[1]] || more[1]] : ['budget','mid','luxury'];
      const n0 = (window.__lodgeN = (window.__lodgeN||0) + 1); const out = [];
      tiers.forEach(t => { for (let i = 0; i < 4; i++) out.push({ n: city+' '+t+' stay '+n0+'-'+i, tier: t, type: ['hotel','apartment','guesthouse','hotel'][i], area: ['Monti','Trastevere','Centro Storico','Prati'][i], d: 'Family rooms a short walk from the main sights, with breakfast included.', price: {budget:'€85–110',mid:'€170–220',luxury:'€480–650'}[t], site: i%2 ? 'https://www.example-hotel.it/' : (i===2?'https://www.booking.com/hotel/x':''), lat: c[0]+(i-1.5)*0.006, lng: c[1]+(i-1.5)*0.007 }); });
      return { lodging: out }; }
    if (/^For each of these places/.test(prompt)) { window.__linkCalls=(window.__linkCalls||[]); window.__linkCalls.push(prompt);
      const names=[]; prompt.split('\n').forEach(l=>{ const mm=l.match(/^(Things to do|Places to eat): (.*)$/); if(mm) mm[2].split('; ').forEach(n=>names.push(n)); });
      const D=['45m','1-1.5h','2 hours','90 min','1h30','half day','30-45 min','2-3h'];
      const bq=/beach = for beaches only/.test(prompt); return {links: names.map(n=>Object.assign({n, dur:D[[...n].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7)%D.length], book:'', menu:''}, bq ? {beach:{calm:'calm', shallow:true, shade:'trees', lifeguard:false, sand:'pebbles', walk:8, facilities:false, note:'x'}} : {}))}; }
    if (/List the cities/.test(prompt)) { calls.country++; const out = []; for (let i=0;i<90;i++) out.push({name:'Town '+i, region:'Region '+(i%6), lat:38+i*0.05, lng:23+i*0.03, w:2, pop:(i%5)+1, t:['beach'], d:'Known for thing '+i}); return {blurb:'Greek blurb', cities: out}; }
    if (/sketch map/.test(prompt)) { const lat=+prompt.match(/latitude (-?[\d.]+)/)[1], lng=+prompt.match(/longitude (-?[\d.]+)/)[1]; return {places:[{n:'Monti',type:'district',lat:lat+.006,lng:lng+.004},{n:'Trastevere',type:'district',lat:lat-.008,lng:lng-.012},{n:'Villa Borghese',type:'park',lat:lat+.012,lng:lng+.002},{n:'Pantheon',type:'landmark',lat:lat+.002,lng:lng-.006}], water:[{kind:'river',n:'Tiber',side:'IN',pts:[[lat+.02,lng-.01],[lat+.005,lng-.009],[lat-.004,lng-.004],[lat-.02,lng-.006]]},{kind:'sea',n:'Sea',side:'W',pts:[[lat+.03,lng-.028],[lat,lng-.024],[lat-.03,lng-.03]]}]}; }
    if (/coordinates of this lodging/.test(prompt)) { calls.geo++; return {lat:41.905, lng:12.49, label:'Hotel', area:'Monti'}; }
    const city = m ? m[1].trim() : 'X'; const c = centers[city] || [40,10];
    if (/things to do|must-do experiences/.test(prompt)) { calls.spots++; seq = listNo(prompt, city); const n = +((prompt.match(/List (?:the )?(\d+)/)||[])[1]) || (/MORE/.test(prompt)?20:28); const out=[]; for(let i=0;i<n;i++){ const s=['am','pm','eve','any'][i%4===3? (i%8===7?3:2): i%2]; out.push({n:city+' sight '+seq+'-'+i, d:'What '+city+' sight '+i+' is known for.', t:i%3?['culture']:['food'], k:i%5===0?-1:1, s, dur: i%3===0 ? '' : (i%3===1 ? '2h' : '1-2 hours'), ticket:i%2?'Free':'€15, book ahead', book: i%4===0 ? 'https://www.colosseo.it/en/tickets/'+seq+'-'+i : (i%4===2 ? 'https://www.google.com/search?q=x' : ''), lat:c[0]+((i*41+seq*13)%100/100-.5)*0.04, lng:c[1]+((i*67+seq*29)%100/100-.5)*0.05}); } return {d:city+' is known for stuff', lat:c[0], lng:c[1], spots: out}; }
    if (/places to eat/.test(prompt)) { calls.food++; (window.__foodAsks = window.__foodAsks || []).push(prompt); seq = listNo(prompt, city); const out=[]; const nF = +((prompt.match(/List (?:the )?(\d+)/)||[])[1]) || 18;
      /* a list asked for named meals ("2 for dinner near X (41.9, 12.5), …; 2 for breakfast": lib/ideas.js W.mealIdeas)
         comes back as asked: those meals, in that order, each beside the spot it names */
      const asked = []; prompt.replace(/(\d+) for (breakfast|lunch|dinner)(?: near [^;(]*\((-?[\d.]+), (-?[\d.]+)\))?/g, (m0, n, meal, la, lo) => { for (let k = 0; k < +n; k++) asked.push({ meal, at: la ? [+la, +lo] : null }); return m0; });
      const byMeal = asked.length > 0;
      if (byMeal && window.__noMeal) return { food: [] };   /* (a test: the town has no such place) */
      const mealOf = i => byMeal ? (asked[i] || asked[asked.length - 1]).meal : (/breakfast caf/.test(prompt) && i < Math.round(nF/4)) ? 'breakfast' : ['lunch','dinner','both'][i%3];
      const spotOf = i => byMeal && (asked[i] || asked[asked.length - 1]).at;
      for(let i=0;i<nF;i++) out.push({n:city+(mealOf(i) === 'breakfast' ? ' cafe ' : ' eatery ')+seq+'-'+i, d:'Known for pasta', cuisine:'Italian', price:'€€', meal: mealOf(i), menu: i%3===0 ? 'https://www.trattoria-example.it/menu' : '', k:0, lat: spotOf(i) ? spotOf(i)[0] + 0.0004 * (i + 1) : c[0]+((i*41+seq*13)%100/100-.5)*0.03, lng: spotOf(i) ? spotOf(i)[1] + 0.0004 * (i + 1) : c[1]+((i*67+seq*29)%100/100-.5)*0.04}); return {transit:{system:'Metro and buses, €1.50', pass:'72h pass', airport:'Train 32 min', tip:'Validate tickets'}, stay:[{n:'Monti',d:'central',lat:c[0]+.005,lng:c[1]+.004},{n:'Trastevere',d:'charming',lat:c[0]-.006,lng:c[1]-.01}], food: out}; }
    return {};
  };
  const photoPx = 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#a0522d"/><circle cx="8" cy="4.5" r="3" fill="#ffd27f"/></svg>');
  window.__writes = [];
  const db = { collection: (path) => ({ onSnapshot: (next) => { setTimeout(()=>next({ docs: [ { id:'italy-rome', data: () => ({ items: { 'rome sight 1 7': { url: photoPx, credit: 'Jane Doe, CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:X.jpg' } } }) }, { id:'dishes', data: () => ({ items: { pasta: { url: photoPx, credit: 'CC BY 2.0' } } }) } ] }), 400); return () => {}; } }),
    doc: (path) => ({ set: async (body) => { window.__writes.push(path); } }) };
  window.claude = { use: (n) => Promise.resolve(n === 'sample' ? sample : n === 'db' ? db : null) };
})();
