/* Built-in destination data, part 2, plus departure airports. */
window.TD = window.TD || {};
Object.assign(window.TD, {
  Japan: { blurb: "Neon cities, ancient temples, hot springs and the best food-per-block anywhere.", cities: [
    { name: "Tokyo", lat: 35.68, lng: 139.69, w: 4, t: ["food","shopping","nightlife","culture"], d: "Megacity of quiet shrines, tiny bars and endless neighborhoods.", spots: [
      { n: "Senso-ji, Asakusa", d: "Tokyo's oldest temple, entered through the giant Thunder Gate lantern.", t: ["culture"], k: 1, s: "am" },
      { n: "Shibuya Crossing", d: "The world's busiest pedestrian scramble; view it from Shibuya Sky.", t: ["nightlife","scenic"], k: 0, s: "eve" },
      { n: "teamLab Planets", d: "Walk-through digital art installations, some in shin-deep water.", t: ["family","culture"], k: 1, s: "pm" },
      { n: "Tsukiji Outer Market", d: "Stalls of sushi, tamagoyaki and grilled scallops.", t: ["food"], k: 1, s: "am" },
      { n: "Tokyo Disneyland & DisneySea", d: "DisneySea is widely called the best Disney park.", t: ["family"], k: 1, s: "any" },
      { n: "Golden Gai", d: "Six alleys of 200 tiny bars, some seating five people.", t: ["nightlife"], k: -1, s: "eve" } ] },
    { name: "Kyoto", lat: 35.01, lng: 135.77, w: 3, t: ["culture","relax","food"], d: "Imperial capital for 1,000 years, with 1,600 temples.", spots: [
      { n: "Fushimi Inari Shrine", d: "Tunnels of thousands of orange torii gates up a mountain.", t: ["culture","adventure"], k: 1, s: "am" },
      { n: "Arashiyama Bamboo Grove", d: "Towering bamboo path plus a monkey park on the hill.", t: ["nature","family"], k: 1, s: "am" },
      { n: "Kinkaku-ji", d: "The Golden Pavilion, a gold-leafed temple over a mirror pond.", t: ["culture"], k: 0, s: "pm" },
      { n: "Gion at dusk", d: "Geisha district of wooden teahouses.", t: ["culture","nightlife"], k: 0, s: "eve" },
      { n: "Nishiki Market", d: "'Kyoto's Kitchen', 400 m of pickles and street snacks.", t: ["food"], k: 1, s: "pm" } ] },
    { name: "Osaka", lat: 34.69, lng: 135.50, w: 2, t: ["food","nightlife","family"], d: "Japan's street-food capital and home to Universal Studios.", spots: [
      { n: "Dotonbori", d: "Neon canal street of takoyaki and okonomiyaki stalls.", t: ["food","nightlife"], k: 1, s: "eve" },
      { n: "Universal Studios Japan", d: "Includes Super Nintendo World.", t: ["family"], k: 1, s: "any" },
      { n: "Nara day trip", d: "Giant bronze Buddha and 1,200 bowing wild deer.", t: ["culture","family","nature"], k: 1, s: "any" } ] },
    { name: "Hakone", lat: 35.23, lng: 139.11, w: 2, t: ["relax","mountain","wellness"], d: "Hot-spring resort with views of Mt. Fuji.", spots: [
      { n: "Ryokan & onsen stay", d: "Traditional inn with hot-spring baths and kaiseki dinner.", t: ["relax","wellness"], k: 0, s: "eve" },
      { n: "Hakone Loop", d: "Train, cable car, ropeway and pirate ship across Lake Ashi.", t: ["scenic","family"], k: 1, s: "any" },
      { n: "Owakudani", d: "Steaming volcanic valley; eat black eggs said to add 7 years to life.", t: ["nature","mountain"], k: 1, s: "am" } ] } ] },

  Mexico: { blurb: "Ancient pyramids, taco stands, cenotes and Caribbean and Pacific beaches.", cities: [
    { name: "Mexico City", lat: 19.43, lng: -99.13, w: 4, t: ["culture","food","nightlife"], d: "Vast capital of world-class museums and street food.", spots: [
      { n: "Teotihuacan", d: "Pyramids of the Sun and Moon; sunrise hot-air balloons available.", t: ["culture","adventure"], k: 0, s: "am" },
      { n: "National Museum of Anthropology", d: "Home of the Aztec Sun Stone.", t: ["culture","family"], k: 0, s: "am" },
      { n: "Xochimilco trajineras", d: "Painted boats on ancient canals with mariachi floating by.", t: ["family","nightlife"], k: 1, s: "pm" },
      { n: "Taco crawl in Roma & Condesa", d: "Al pastor from the trompo, leafy streets and mezcal bars.", t: ["food","nightlife"], k: 0, s: "eve" },
      { n: "Frida Kahlo Museum", d: "The Blue House where Frida lived and painted.", t: ["culture"], k: 0, s: "pm" } ] },
    { name: "Oaxaca", lat: 17.07, lng: -96.73, w: 3, t: ["food","culture"], d: "Mexico's culinary heart: seven moles, mezcal and Zapotec ruins.", spots: [
      { n: "Monte Albán", d: "Zapotec mountaintop city founded around 500 BC.", t: ["culture","mountain"], k: 0, s: "am" },
      { n: "Mercado 20 de Noviembre", d: "Pick raw meats and grill them in the smoky 'meat hall'.", t: ["food"], k: 1, s: "pm" },
      { n: "Hierve el Agua", d: "Petrified waterfalls and mineral pools on a cliff edge.", t: ["nature","scenic"], k: 0, s: "any" } ] },
    { name: "Tulum & Riviera Maya", lat: 20.21, lng: -87.46, w: 4, t: ["beach","adventure","relax"], d: "Caribbean beaches, Maya ruins and swimmable cenotes.", spots: [
      { n: "Tulum ruins", d: "Maya walled city on a cliff over the Caribbean.", t: ["culture","beach"], k: 0, s: "am" },
      { n: "Gran Cenote", d: "Clear freshwater sinkhole for snorkeling with turtles.", t: ["nature","adventure"], k: 0, s: "am" },
      { n: "Xcaret park", d: "Eco-park with underground rivers and a nightly show.", t: ["family"], k: 1, s: "any" },
      { n: "Chichén Itzá", d: "El Castillo pyramid, a New Seven Wonder.", t: ["culture"], k: 0, s: "any" },
      { n: "Akumal Bay", d: "Calm bay for snorkeling with green sea turtles.", t: ["beach","nature","family"], k: 1, s: "pm" } ] } ] },

  "United Kingdom": { blurb: "Royal London, castles, pubs, the Highlands and the Cotswolds.", cities: [
    { name: "London", lat: 51.51, lng: -0.13, w: 4, t: ["culture","shopping","nightlife"], d: "Free world-class museums, West End shows and royal history.", spots: [
      { n: "Tower of London", d: "Medieval fortress holding the Crown Jewels.", t: ["culture","family"], k: 1, s: "am" },
      { n: "British Museum", d: "Free; home of the Rosetta Stone and Egyptian mummies.", t: ["culture"], k: 0, s: "pm" },
      { n: "Natural History Museum", d: "Free; dinosaur galleries and a blue whale skeleton.", t: ["family","nature"], k: 1, s: "am" },
      { n: "West End show", d: "London's theater district, matinees included.", t: ["culture","nightlife"], k: 0, s: "eve" },
      { n: "Borough Market", d: "London's oldest food market.", t: ["food"], k: 1, s: "pm" } ] },
    { name: "Edinburgh", lat: 55.95, lng: -3.19, w: 3, t: ["culture","nightlife"], d: "Castle-topped Scottish capital of closes and whisky.", spots: [
      { n: "Edinburgh Castle", d: "Fortress on a volcanic rock; the one o'clock gun fires daily.", t: ["culture","family"], k: 1, s: "am" },
      { n: "Arthur's Seat", d: "Extinct volcano hike in the city.", t: ["adventure","nature"], k: 0, s: "am" },
      { n: "Royal Mile", d: "Old Town spine from castle to palace.", t: ["culture","shopping"], k: 1, s: "pm" } ] },
    { name: "Scottish Highlands", lat: 57.48, lng: -4.22, w: 3, t: ["mountain","nature","adventure"], d: "Lochs, glens, castles and the Isle of Skye.", spots: [
      { n: "Loch Ness & Urquhart Castle", d: "Castle ruin on the monster's loch.", t: ["culture","family"], k: 1, s: "am" },
      { n: "Glenfinnan Viaduct", d: "The 'Harry Potter bridge'; the Jacobite steam train crosses it.", t: ["scenic","family"], k: 1, s: "pm" },
      { n: "Isle of Skye", d: "Old Man of Storr and Fairy Pools.", t: ["mountain","nature","adventure"], k: 0, s: "any" } ] },
    { name: "Cotswolds", lat: 51.83, lng: -1.83, w: 2, t: ["relax","scenic","food"], d: "Honey-stone villages and country pubs.", spots: [
      { n: "Bourton-on-the-Water", d: "'Venice of the Cotswolds', with a model village.", t: ["relax","family"], k: 1, s: "pm" },
      { n: "Bibury", d: "Arlington Row cottages, said to be England's prettiest street.", t: ["scenic"], k: 0, s: "am" } ] } ] },

  "Costa Rica": { blurb: "Rainforests, volcanoes, wildlife and two coasts, with a 'pura vida' pace.", cities: [
    { name: "La Fortuna / Arenal", lat: 10.47, lng: -84.64, w: 3, t: ["adventure","nature","wellness"], d: "Volcano views, hot springs and zip lines.", spots: [
      { n: "Tabacón hot springs", d: "Volcano-heated rivers through rainforest.", t: ["relax","wellness"], k: 0, s: "eve" },
      { n: "Arenal hanging bridges", d: "Canopy walkways to spot sloths and toucans.", t: ["nature","family"], k: 1, s: "am" },
      { n: "La Fortuna waterfall", d: "70 m waterfall with a swimming pool at the base.", t: ["nature","adventure"], k: 0, s: "am" },
      { n: "Zip-lining", d: "Cables over the canopy.", t: ["adventure"], k: -1, s: "pm" } ] },
    { name: "Monteverde", lat: 10.30, lng: -84.82, w: 2, t: ["nature","adventure"], d: "Misty cloud forest famous for the resplendent quetzal.", spots: [
      { n: "Cloud Forest Reserve", d: "Guided walks through moss-covered forest.", t: ["nature"], k: 0, s: "am" },
      { n: "Night walk", d: "Tarantulas, tree frogs and sleeping birds.", t: ["nature","family"], k: 1, s: "eve" } ] },
    { name: "Manuel Antonio", lat: 9.39, lng: -84.14, w: 3, t: ["beach","nature","family"], d: "Beaches inside a national park full of monkeys.", spots: [
      { n: "Manuel Antonio National Park", d: "Sloths, capuchins and beach coves.", t: ["nature","beach","family"], k: 1, s: "am" },
      { n: "Playa Espadilla", d: "Wide beach, gentle surf lessons.", t: ["beach","adventure"], k: 1, s: "pm" } ] },
    { name: "Guanacaste", lat: 10.63, lng: -85.44, w: 4, t: ["beach","relax"], d: "Dry Pacific coast with resort beaches.", spots: [
      { n: "Playa Conchal", d: "Beach of crushed shells, calm water.", t: ["beach","family"], k: 1, s: "pm" },
      { n: "Rincón de la Vieja", d: "Mud pots and fumaroles.", t: ["nature","adventure"], k: 0, s: "am" },
      { n: "Tamarindo sunset", d: "Surf town with beach bars.", t: ["nightlife","beach"], k: 0, s: "eve" } ] } ] },

  Thailand: { blurb: "Golden temples, street food, island hopping and elephant sanctuaries.", cities: [
    { name: "Bangkok", lat: 13.76, lng: 100.50, w: 3, t: ["food","culture","nightlife","shopping"], d: "Chaotic capital of temples, markets and rooftop bars.", spots: [
      { n: "Grand Palace & Wat Phra Kaew", d: "Royal complex housing the Emerald Buddha.", t: ["culture"], k: 0, s: "am" },
      { n: "Wat Pho", d: "46 m reclining Buddha.", t: ["culture","wellness"], k: 1, s: "am" },
      { n: "Chatuchak Weekend Market", d: "15,000 stalls.", t: ["shopping","food"], k: 0, s: "am" },
      { n: "Yaowarat street food", d: "Chinatown's night food street.", t: ["food","nightlife"], k: 0, s: "eve" } ] },
    { name: "Chiang Mai", lat: 18.79, lng: 98.98, w: 3, t: ["culture","nature","food"], d: "Mountain city of 300 temples.", spots: [
      { n: "Ethical elephant sanctuary", d: "Feed and bathe rescued elephants, no riding.", t: ["nature","family"], k: 1, s: "any" },
      { n: "Doi Suthep", d: "Golden temple up 306 naga steps.", t: ["culture","mountain"], k: 0, s: "am" },
      { n: "Thai cooking class", d: "Market tour, then cook curries.", t: ["food"], k: 0, s: "pm" } ] },
    { name: "Phuket & Krabi", lat: 8.05, lng: 98.91, w: 4, t: ["beach","relax","adventure"], d: "Limestone karsts and turquoise water.", spots: [
      { n: "Phi Phi islands boat trip", d: "Maya Bay and snorkeling coves.", t: ["beach","adventure"], k: 0, s: "any" },
      { n: "Railay Beach", d: "Boat-only beach, rock climbing.", t: ["beach","adventure"], k: 0, s: "pm" },
      { n: "Phang Nga Bay kayaking", d: "Sea caves and James Bond Island.", t: ["adventure","nature"], k: 0, s: "am" } ] } ] },

  Iceland: { blurb: "Waterfalls, glaciers, geothermal lagoons and northern lights.", cities: [
    { name: "Reykjavík", lat: 64.15, lng: -21.94, w: 2, t: ["culture","food","wellness"], d: "Colorful capital and base for the Golden Circle.", spots: [
      { n: "Blue Lagoon", d: "Milky-blue geothermal spa.", t: ["relax","wellness"], k: 0, s: "pm" },
      { n: "Golden Circle", d: "Þingvellir, Geysir and Gullfoss.", t: ["nature","scenic"], k: 1, s: "any" },
      { n: "Hallgrímskirkja", d: "Basalt-column church tower.", t: ["culture"], k: 1, s: "am" } ] },
    { name: "South Coast (Vík)", lat: 63.42, lng: -19.01, w: 3, t: ["nature","adventure","mountain"], d: "Black beaches, waterfalls and glaciers.", spots: [
      { n: "Seljalandsfoss & Skógafoss", d: "Waterfalls you can walk behind.", t: ["nature","family"], k: 1, s: "am" },
      { n: "Reynisfjara", d: "Black-sand beach; dangerous waves, stay back.", t: ["nature","scenic"], k: 0, s: "pm" },
      { n: "Glacier hike", d: "Crampon walk on Sólheimajökull.", t: ["adventure","mountain"], k: -1, s: "am" },
      { n: "Jökulsárlón lagoon", d: "Icebergs and Diamond Beach.", t: ["scenic","nature"], k: 1, s: "any" } ] } ] }
});

/* Departure airports: city, IATA code, coordinates */
window.AIRPORTS = [
  ["Los Angeles","LAX",33.94,-118.41],["San Francisco","SFO",37.62,-122.38],["Seattle","SEA",47.45,-122.31],
  ["Portland","PDX",45.59,-122.60],["San Diego","SAN",32.73,-117.19],["Las Vegas","LAS",36.08,-115.15],
  ["Phoenix","PHX",33.43,-112.01],["Denver","DEN",39.86,-104.67],["Salt Lake City","SLC",40.79,-111.98],
  ["Dallas","DFW",32.90,-97.04],["Houston","IAH",29.98,-95.34],["Chicago","ORD",41.97,-87.91],
  ["Minneapolis","MSP",44.88,-93.22],["Atlanta","ATL",33.64,-84.43],["Miami","MIA",25.79,-80.29],
  ["Orlando","MCO",28.43,-81.31],["Washington DC","IAD",38.95,-77.46],["New York","JFK",40.64,-73.78],
  ["Boston","BOS",42.36,-71.01],["Philadelphia","PHL",39.87,-75.24],["Toronto","YYZ",43.68,-79.63],
  ["Vancouver","YVR",49.19,-123.18],["Montreal","YUL",45.47,-73.74],["Mexico City","MEX",19.44,-99.07],
  ["London","LHR",51.47,-0.45],["Paris","CDG",49.01,2.55],["Frankfurt","FRA",50.04,8.56],
  ["Amsterdam","AMS",52.31,4.76],["Dubai","DXB",25.25,55.36],["Singapore","SIN",1.36,103.99],
  ["Tokyo","HND",35.55,139.78],["Sydney","SYD",-33.94,151.18],["Honolulu","HNL",21.32,-157.92]
];

/* Trip styles */
window.STYLES = [
  ["relax","Relaxation"],["adventure","Adventure"],["food","Food & drink"],["beach","Beaches"],
  ["mountain","Mountains"],["culture","Culture & history"],["nature","Nature & wildlife"],
  ["nightlife","Nightlife"],["shopping","Shopping"],["family","Kid-friendly"],
  ["wellness","Spa & wellness"],["scenic","Scenic views"]
];
