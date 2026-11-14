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

/* Islands, and the towns on them. An island is not a place to stay, so wherever one would be offered as a destination its towns are
   offered instead (lib/core.js: W.isleOf, W.countryCities). One row per island: its names (the first is the one shown; * marks a group of
   islands or an area), then its towns as name@lat,lng with the usual base first. */
window.TI = {
  "Greece": [
    ["Crete", "Heraklion@35.339,25.144;Chania@35.514,24.018;Rethymno@35.364,24.482;Agios Nikolaos@35.19,25.716;Elounda@35.263,25.723;Hersonissos@35.318,25.369"],
    ["Santorini,Thira,Thera", "Fira@36.417,25.432;Oia@36.462,25.375;Imerovigli@36.433,25.423;Kamari@36.372,25.483;Perissa@36.357,25.475"],
    ["Mykonos", "Mykonos Town@37.447,25.329;Ornos@37.423,25.323;Platis Gialos@37.417,25.347;Ano Mera@37.449,25.399"],
    ["Rhodes", "Rhodes Town@36.435,28.218;Lindos@36.092,28.085;Faliraki@36.34,28.2"],
    ["Corfu,Kerkyra", "Corfu Town@39.624,19.922;Paleokastritsa@39.674,19.705;Kassiopi@39.79,19.922;Sidari@39.79,19.7"],
    ["Naxos", "Naxos Town@37.104,25.376;Agios Prokopios@37.075,25.345;Plaka (Naxos)@37.045,25.362;Apeiranthos@37.073,25.523"],
    ["Paros", "Parikia@37.085,25.15;Naoussa@37.123,25.238"],
    ["Milos", "Adamas@36.727,24.446;Plaka (Milos)@36.744,24.425;Pollonia@36.762,24.524"],
    ["Zakynthos,Zante", "Zakynthos Town@37.787,20.899;Laganas@37.73,20.865;Tsilivi@37.817,20.865"],
    ["Kefalonia,Cephalonia", "Argostoli@38.175,20.489;Fiskardo@38.459,20.577;Sami@38.252,20.647"],
    ["Lefkada,Lefkas", "Lefkada Town@38.833,20.706;Nidri@38.706,20.711;Vasiliki@38.629,20.608"],
    ["Kos", "Kos Town@36.893,27.288;Kardamena@36.781,27.143;Kefalos@36.743,26.959"],
    ["Skiathos", "Skiathos Town@39.162,23.49;Koukounaries@39.147,23.404"],
    ["Ios", "Ios Town@36.723,25.282;Mylopotas@36.712,25.294"]
  ],
  "Spain": [
    ["Mallorca,Majorca", "Palma de Mallorca@39.57,2.65;Sóller@39.766,2.715;Alcúdia@39.853,3.121;Pollença@39.877,3.016;Cala d'Or@39.378,3.227"],
    ["Ibiza,Eivissa", "Ibiza Town@38.907,1.421;Sant Antoni de Portmany@38.98,1.303;Santa Eulària des Riu@38.985,1.534"],
    ["Menorca,Minorca", "Mahón@39.889,4.265;Ciutadella@40.002,3.841"],
    ["Tenerife", "Santa Cruz de Tenerife@28.464,-16.252;Puerto de la Cruz@28.414,-16.548;Costa Adeje@28.099,-16.725;La Laguna@28.487,-16.314"],
    ["Gran Canaria", "Las Palmas de Gran Canaria@28.123,-15.436;Maspalomas@27.76,-15.586;Puerto de Mogán@27.817,-15.764"],
    ["Lanzarote", "Arrecife@28.963,-13.548;Puerto del Carmen@28.923,-13.665;Playa Blanca@28.864,-13.828"],
    ["Fuerteventura", "Corralejo@28.73,-13.867;Puerto del Rosario@28.5,-13.862;Morro Jable@28.051,-14.351"],
    ["*Canary Islands,Canaries", "Santa Cruz de Tenerife@28.464,-16.252;Las Palmas de Gran Canaria@28.123,-15.436;Costa Adeje@28.099,-16.725;Puerto del Carmen@28.923,-13.665;Corralejo@28.73,-13.867"],
    ["*Balearic Islands,Balearics", "Palma de Mallorca@39.57,2.65;Ibiza Town@38.907,1.421;Mahón@39.889,4.265"]
  ],
  "Italy": [
    ["Sicily,Sicilia", "Palermo@38.116,13.361;Catania@37.508,15.083;Taormina@37.852,15.285;Syracuse@37.075,15.287;Cefalù@38.039,14.022;Agrigento@37.311,13.576"],
    ["Sardinia,Sardegna", "Cagliari@39.224,9.122;Alghero@40.558,8.319;Olbia@40.923,9.498;Porto Cervo@41.136,9.535"],
    ["Capri", "Capri Town@40.551,14.243;Anacapri@40.554,14.219"],
    ["Ischia", "Ischia Porto@40.74,13.949;Forio@40.737,13.861;Sant'Angelo@40.699,13.893"],
    ["Elba", "Portoferraio@42.814,10.317;Marina di Campo@42.743,10.234"]
  ],
  "France": [
    ["Corsica,Corse", "Ajaccio@41.919,8.739;Bastia@42.697,9.45;Calvi@42.567,8.757;Bonifacio@41.387,9.159;Porto-Vecchio@41.591,9.279"]
  ],
  "Portugal": [
    ["Madeira", "Funchal@32.667,-16.924;Machico@32.716,-16.767;Porto Moniz@32.867,-17.167"],
    ["*Azores,Açores", "Ponta Delgada@37.741,-25.676;Angra do Heroísmo@38.655,-27.217;Horta@38.536,-28.626;Furnas@37.774,-25.315"]
  ],
  "Croatia": [
    ["Hvar", "Hvar Town@43.173,16.441;Stari Grad@43.184,16.595;Jelsa@43.161,16.693"],
    ["Brač,Brac", "Bol@43.262,16.655;Supetar@43.384,16.554"],
    ["Korčula,Korcula", "Korčula Town@42.96,17.135;Vela Luka@42.963,16.717"]
  ],
  "Malta": [
    ["Gozo", "Victoria (Gozo)@36.044,14.239;Marsalforn@36.072,14.257"]
  ],
  "United Kingdom": [
    ["Isle of Skye,Skye", "Portree@57.413,-6.196;Broadford@57.243,-5.908;Dunvegan@57.435,-6.583"],
    ["Isle of Wight", "Cowes@50.763,-1.297;Ventnor@50.595,-1.206;Ryde@50.73,-1.162"]
  ],
  "Germany": [
    ["Rügen,Rugen", "Binz@54.4,13.61;Sassnitz@54.516,13.644"]
  ],
  "Norway": [
    ["*Lofoten,Lofoten Islands", "Svolvær@68.234,14.568;Reine@67.932,13.089;Henningsvær@68.153,14.202"]
  ],
  "Indonesia": [
    ["Bali", "Ubud@-8.507,115.263;Seminyak@-8.691,115.168;Canggu@-8.648,115.138;Uluwatu@-8.829,115.085;Sanur@-8.69,115.262;Nusa Dua@-8.8,115.23"],
    ["Lombok", "Senggigi@-8.492,116.042;Kuta (Lombok)@-8.89,116.28"],
    ["Java", "Yogyakarta@-7.796,110.37;Jakarta@-6.209,106.846;Malang@-7.967,112.633"]
  ],
  "Thailand": [
    ["Phuket", "Phuket Town@7.88,98.392;Patong@7.896,98.296;Kata@7.82,98.299;Karon@7.846,98.295"],
    ["*Phuket & Krabi", "Phuket Town@7.88,98.392;Patong@7.896,98.296;Ao Nang@8.032,98.823;Krabi Town@8.086,98.906"],
    ["Koh Samui,Ko Samui", "Chaweng@9.532,100.061;Bophut@9.558,100.03;Lamai@9.469,100.048"],
    ["Koh Phangan,Ko Pha Ngan,Koh Pha Ngan", "Thong Sala@9.711,99.989;Haad Rin@9.677,100.068"]
  ],
  "Malaysia": [
    ["Langkawi", "Pantai Cenang@6.292,99.728;Kuah@6.32,99.843"],
    ["Penang", "George Town@5.414,100.329;Batu Ferringhi@5.471,100.246"]
  ],
  "Philippines": [
    ["Cebu", "Cebu City@10.316,123.885;Moalboal@9.956,123.396;Oslob@9.522,123.431"],
    ["Palawan", "El Nido@11.18,119.392;Puerto Princesa@9.739,118.735;Coron@11.999,120.204"],
    ["Bohol", "Panglao@9.58,123.75;Tagbilaran@9.65,123.85"]
  ],
  "Vietnam": [
    ["Phu Quoc,Phú Quốc", "Duong Dong@10.217,103.959;An Thoi@10.013,104.013"]
  ],
  "China": [
    ["Hainan", "Sanya@18.253,109.512;Haikou@20.044,110.2"]
  ],
  "Japan": [
    ["Okinawa", "Naha@26.212,127.681;Chatan@26.32,127.764;Onna@26.497,127.853;Motobu@26.658,127.898"],
    ["Hokkaido", "Sapporo@43.062,141.355;Hakodate@41.769,140.729;Otaru@43.191,140.995;Furano@43.342,142.383"]
  ],
  "South Korea": [
    ["Jeju,Jeju Island", "Jeju City@33.5,126.531;Seogwipo@33.254,126.56"]
  ],
  "United States": [
    ["Maui", "Lahaina@20.878,-156.683;Kihei@20.765,-156.445;Wailea@20.687,-156.441;Paia@20.903,-156.369;Hana@20.758,-155.99"],
    ["Kauai,Kauaʻi", "Lihue@21.981,-159.371;Poipu@21.874,-159.453;Hanalei@22.203,-159.501;Kapaa@22.088,-159.338"],
    ["Oahu,Oʻahu", "Honolulu@21.307,-157.858;Haleiwa@21.593,-158.103;Kailua@21.402,-157.739"],
    ["Big Island of Hawaii,Big Island,Hawaii Island,Island of Hawaii,Hawaii (Big Island)", "Kailua-Kona@19.64,-155.997;Hilo@19.724,-155.087;Waikoloa Village@19.937,-155.791;Volcano@19.426,-155.234"],
    ["*Florida Keys", "Key West@24.555,-81.78;Key Largo@25.087,-80.447;Islamorada@24.924,-80.628;Marathon@24.714,-81.09"],
    ["Martha's Vineyard", "Edgartown@41.389,-70.513;Oak Bluffs@41.454,-70.562;Vineyard Haven@41.454,-70.603"],
    ["*Hawaii,Hawaiian Islands,Hawaiʻi", "Honolulu@21.307,-157.858;Lahaina@20.878,-156.683;Kailua-Kona@19.64,-155.997;Lihue@21.981,-159.371;Hilo@19.724,-155.087"]
  ],
  "Canada": [
    ["Vancouver Island", "Victoria@48.428,-123.366;Tofino@49.153,-125.907;Nanaimo@49.166,-123.94"],
    ["Prince Edward Island", "Charlottetown@46.238,-63.131;Cavendish@46.492,-63.379"]
  ],
  "Australia": [
    ["Tasmania", "Hobart@-42.882,147.327;Launceston@-41.433,147.144"],
    ["Kangaroo Island", "Kingscote@-35.655,137.639;Penneshaw@-35.72,137.942"],
    ["*Whitsundays,Whitsunday Islands", "Airlie Beach@-20.267,148.717;Hamilton Island@-20.352,148.956"]
  ],
  "Aruba": [
    ["*Aruba", "Oranjestad@12.524,-70.027;Palm Beach@12.574,-70.044"]
  ],
  "Barbados": [
    ["*Barbados", "Bridgetown@13.097,-59.614;Holetown@13.186,-59.638;Oistins@13.065,-59.54"]
  ],
  "St. Lucia": [
    ["*Saint Lucia,St. Lucia", "Rodney Bay@14.076,-60.952;Soufrière@13.856,-61.057;Castries@14.01,-60.987"]
  ],
  "Cayman Islands": [
    ["Grand Cayman", "George Town@19.287,-81.374;Seven Mile Beach@19.334,-81.381"]
  ],
  "Turks & Caicos Islands": [
    ["*Turks and Caicos,Providenciales", "Grace Bay@21.796,-72.175;Cockburn Town@21.461,-71.139"]
  ],
  "U.S. Virgin Islands": [
    ["St. Thomas,Saint Thomas", "Charlotte Amalie@18.342,-64.931;Red Hook@18.326,-64.85"]
  ],
  "Mexico": [
    ["Cozumel", "San Miguel de Cozumel@20.508,-86.946"]
  ],
  "Tanzania": [
    ["Zanzibar", "Stone Town@-6.162,39.192;Nungwi@-5.726,39.298;Paje@-6.264,39.535"]
  ],
  "Mauritius": [
    ["*Mauritius", "Port Louis@-20.161,57.501;Grand Baie@-20.013,57.58;Flic en Flac@-20.274,57.371;Mahébourg@-20.408,57.7"]
  ],
  "Seychelles": [
    ["*Seychelles,Mahé,Mahe", "Victoria@-4.619,55.451;Beau Vallon@-4.61,55.43;Anse Volbert (Praslin)@-4.317,55.747;La Passe (La Digue)@-4.348,55.83"]
  ],
  "Maldives": [
    ["*Maldives", "Malé@4.176,73.509;Maafushi@3.942,73.49"]
  ],
  "Fiji": [
    ["*Fiji,Viti Levu", "Nadi@-17.776,177.436;Denarau@-17.773,177.38;Suva@-18.142,178.442;Sigatoka@-18.141,177.508"]
  ],
  "French Polynesia": [
    ["Tahiti", "Papeete@-17.535,-149.57"],
    ["Bora Bora", "Vaitape@-16.508,-151.75"]
  ],
  "Ecuador": [
    ["*Galapagos,Galápagos,Galapagos Islands,Galápagos Islands", "Puerto Ayora@-0.743,-90.313;Puerto Baquerizo Moreno@-0.902,-89.61;Puerto Villamil@-0.955,-90.965"]
  ]
};

/* The countries Plan offers (v184, the owner: "dial it down to the top 150 countries to visit"): the 150 most visited,
   most visited first (international arrivals, rounded into an order), as two-letter region codes. Plan names them in
   the viewer's language. The nightly city library (tools/citylib.js) fills them in this order. A trip already saved
   to a country not on the list keeps it. */
window.TOP_COUNTRIES =
  "FR ES US IT TR MX GB DE GR AT TH CN JP PT NL HR SA AE MY CA PL HK HU VN CH SG ID KR MA DK EG IN CZ IE BE ZA SE NO AU MO TN BG RO DO NZ IL BR AR CL PE CO CR JO IS CY MT PH LK KH LA MM NP AL ME SI SK EE LV LT FI LU GE AM AZ UZ KZ BA RS MK MD QA OM BH KW LB TW BS JM BB CU PR PA GT EC BO UY PY HN NI SV BZ TT AW CW KY BM LC AG KN GD VC MV MU SC FJ PF NC KE TZ UG RW BW NA ZM ZW MZ MG ET GH SN CV MN KG BT BN TL SR GY DM MC LI AD SM VA GI FO GL TC VG VI".split(
    " "
  );
/* what is new, in plain words, for Settings (the newest version first; a line is one thing a traveler would notice) */
window.WHATS_NEW = {
  v: 190,
  items: [
    "On a travel day, fold away the ways to get there once you've chosen one.",
    "Dates read one way everywhere, and long names wrap instead of being cut off.",
    "A shared city library: a city someone has opened already comes up in seconds, and it grows a little every night.",
    "Typing UAE, Holland, Burma and other names finds the right country."
  ]
};
