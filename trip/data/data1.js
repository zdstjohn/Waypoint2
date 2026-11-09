/* Built-in destination data, part 1 (Europe).
   Spot fields: n name, d short description, t style tags, k kid fit (1 great for little kids, 0 fine, -1 better for older kids/adults), s slot (am|pm|eve|any) */
window.TD = window.TD || {};
Object.assign(window.TD, {
  Italy: { blurb: "Ancient ruins, Renaissance art, pasta and gelato, from Alpine lakes to the Amalfi cliffs.", cities: [
    { name: "Rome", lat: 41.90, lng: 12.50, w: 4, t: ["culture","food","nightlife"], d: "The Eternal City: 2,000 years of history layered under trattorias and piazzas.", spots: [
      { n: "Colosseum & Roman Forum", d: "The 50,000-seat amphitheater where gladiators fought, beside the ruins of ancient Rome's civic center.", t: ["culture"], k: 0, s: "am" },
      { n: "Vatican Museums & Sistine Chapel", d: "Home of Michelangelo's painted ceiling and one of the world's largest art collections.", t: ["culture"], k: -1, s: "am" },
      { n: "Trevi Fountain", d: "Baroque fountain famous for the coin toss that promises a return to Rome.", t: ["culture","family"], k: 1, s: "eve" },
      { n: "Trastevere", d: "Cobblestone neighborhood known for ivy-covered lanes and classic Roman dinners like cacio e pepe.", t: ["food","nightlife"], k: 0, s: "eve" },
      { n: "Villa Borghese gardens", d: "Rome's big central park, with bike and pedal-cart rentals, a small lake and the Borghese Gallery.", t: ["relax","family","nature"], k: 1, s: "pm" },
      { n: "Campo de' Fiori market", d: "Morning produce and flower market in a lively square; good for picnic supplies.", t: ["food","shopping"], k: 1, s: "am" } ] },
    { name: "Florence", lat: 43.77, lng: 11.26, w: 3, t: ["culture","food","shopping"], d: "Birthplace of the Renaissance, packed with masterpieces in a walkable core.", spots: [
      { n: "Uffizi Gallery", d: "Botticelli's Birth of Venus and the largest Renaissance collection anywhere.", t: ["culture"], k: -1, s: "am" },
      { n: "Duomo & Brunelleschi's Dome", d: "The red-brick dome that defined the skyline; 463 steps to the top for the view.", t: ["culture","adventure"], k: 0, s: "am" },
      { n: "Piazzale Michelangelo", d: "Hilltop terrace with the classic sunset view over the city and the Arno.", t: ["relax","scenic"], k: 1, s: "eve" },
      { n: "Mercato Centrale", d: "Two-floor food hall; famous for lampredotto sandwiches and fresh pasta.", t: ["food"], k: 1, s: "pm" },
      { n: "Chianti day trip", d: "Rolling vineyard country between Florence and Siena, known for Sangiovese wine tastings.", t: ["food","scenic"], k: -1, s: "any" } ] },
    { name: "Venice", lat: 45.44, lng: 12.32, w: 2, t: ["culture","relax"], d: "A car-free city of canals and bridges built on 118 islands.", spots: [
      { n: "St. Mark's Basilica & Square", d: "Gold-mosaic basilica facing Venice's grand main square.", t: ["culture"], k: 0, s: "am" },
      { n: "Gondola or vaporetto ride on the Grand Canal", d: "Cruise the main waterway lined with palazzi; the No. 1 water bus is the budget version.", t: ["relax","family","scenic"], k: 1, s: "pm" },
      { n: "Burano island", d: "Fishing village known for rainbow-painted houses and handmade lace.", t: ["scenic","shopping"], k: 1, s: "pm" },
      { n: "Cicchetti crawl in Cannaregio", d: "Venetian bar snacks, small bites on bread, eaten standing at local bacari.", t: ["food","nightlife"], k: 0, s: "eve" } ] },
    { name: "Amalfi Coast", lat: 40.6340, lng: 14.6026, w: 3, t: ["beach","relax","scenic"], d: "Cliffside villages, lemon groves and turquoise coves south of Naples.", spots: [
      { n: "Positano", d: "Pastel houses stacked down a cliff to a pebble beach; the coast's postcard town.", t: ["beach","scenic","shopping"], k: 0, s: "pm" },
      { n: "Path of the Gods hike", d: "Clifftop trail high above the sea from Bomerano to Nocelle, about 3 hours.", t: ["adventure","mountain","nature"], k: -1, s: "am" },
      { n: "Boat trip to Capri", d: "Island famous for the Blue Grotto sea cave and dramatic Faraglioni rocks.", t: ["beach","adventure","scenic"], k: 0, s: "any" },
      { n: "Pompeii", d: "Roman city frozen by Vesuvius in 79 AD, with streets, homes and frescoes intact.", t: ["culture"], k: 0, s: "am" },
      { n: "Limoncello tasting in Amalfi", d: "The coast's lemon liqueur, made from the huge local sfusato lemons.", t: ["food"], k: -1, s: "eve" } ] },
    { name: "Lake Como", lat: 45.9864, lng: 9.2611, w: 2, t: ["relax","mountain","scenic"], d: "Alpine lake ringed by villas and villages, an hour north of Milan.", spots: [
      { n: "Bellagio", d: "The 'pearl of the lake', a village of steep lanes at the lake's fork.", t: ["relax","scenic"], k: 0, s: "pm" },
      { n: "Villa del Balbianello", d: "Lakeside villa and terraced gardens used as a film location in Star Wars and Bond.", t: ["culture","scenic"], k: 0, s: "am" },
      { n: "Ferry hop between villages", d: "Public ferries link Varenna, Menaggio and Bellagio; an easy scenic day.", t: ["relax","family"], k: 1, s: "any" },
      { n: "Monte Brè / Brunate funicular", d: "Cog railway up from Como town to mountain viewpoints and hiking trails.", t: ["mountain","family"], k: 1, s: "am" } ] } ] },

  Spain: { blurb: "Late dinners, tapas, Moorish palaces, Gaudí's Barcelona and long Mediterranean beaches.", cities: [
    { name: "Barcelona", lat: 41.39, lng: 2.17, w: 4, t: ["culture","beach","food","nightlife"], d: "Gaudí architecture, city beaches and a famous food scene.", spots: [
      { n: "Sagrada Família", d: "Gaudí's still-unfinished basilica, under construction since 1882.", t: ["culture"], k: 0, s: "am" },
      { n: "Park Güell", d: "Hillside park with Gaudí's mosaic lizard and city views.", t: ["culture","family"], k: 1, s: "am" },
      { n: "La Boqueria market", d: "Famous market off La Rambla for fresh juice, jamón and seafood counters.", t: ["food"], k: 1, s: "pm" },
      { n: "Barceloneta beach", d: "City beach with a long promenade and seafood paella spots.", t: ["beach","relax","family"], k: 1, s: "pm" },
      { n: "Gothic Quarter & El Born", d: "Medieval lanes, the cathedral and tapas and cocktail bars after dark.", t: ["culture","nightlife","food"], k: 0, s: "eve" },
      { n: "Tibidabo amusement park", d: "Century-old hilltop fun park with rides and sweeping views.", t: ["family"], k: 1, s: "pm" } ] },
    { name: "Madrid", lat: 40.42, lng: -3.70, w: 3, t: ["culture","food","nightlife"], d: "Spain's capital: world-class art museums and the latest dinners in Europe.", spots: [
      { n: "Prado Museum", d: "Masterpieces by Velázquez, Goya and El Greco.", t: ["culture"], k: -1, s: "am" },
      { n: "Retiro Park", d: "Rowboats on the big pond and the glass Crystal Palace.", t: ["relax","family","nature"], k: 1, s: "pm" },
      { n: "Mercado de San Miguel", d: "Iron-and-glass market hall for tapas grazing.", t: ["food"], k: 0, s: "eve" },
      { n: "Chocolatería San Ginés", d: "Serving churros con chocolate since 1894.", t: ["food","family"], k: 1, s: "any" },
      { n: "Toledo day trip", d: "Hilltop medieval city of Christian, Jewish and Muslim heritage, 33 min by train.", t: ["culture","scenic"], k: 0, s: "any" } ] },
    { name: "Seville", lat: 37.39, lng: -5.98, w: 3, t: ["culture","food"], d: "Andalusia's heart: flamenco, orange trees and Moorish palaces.", spots: [
      { n: "Real Alcázar", d: "Royal palace of Mudéjar tilework and gardens, a Game of Thrones filming spot.", t: ["culture"], k: 0, s: "am" },
      { n: "Plaza de España", d: "Grand semicircular plaza with tiled alcoves and rowboats on a canal.", t: ["culture","family"], k: 1, s: "pm" },
      { n: "Flamenco show in Triana", d: "Seville is the home of flamenco; intimate tablaos run nightly.", t: ["culture","nightlife"], k: 0, s: "eve" },
      { n: "Seville Cathedral & Giralda", d: "World's largest Gothic cathedral; the tower has ramps instead of stairs.", t: ["culture"], k: 0, s: "am" } ] },
    { name: "Granada", lat: 37.18, lng: -3.60, w: 2, t: ["culture","mountain"], d: "The Alhambra beneath the Sierra Nevada, and free tapas with every drink.", spots: [
      { n: "Alhambra", d: "Nasrid palace-fortress, the masterpiece of Moorish Spain. Book weeks ahead.", t: ["culture"], k: 0, s: "am" },
      { n: "Mirador de San Nicolás", d: "Albaicín viewpoint facing the Alhambra at sunset.", t: ["scenic","relax"], k: 1, s: "eve" },
      { n: "Free-tapas bar hop", d: "Granada bars still serve a free tapa with each drink ordered.", t: ["food","nightlife"], k: 0, s: "eve" },
      { n: "Sierra Nevada", d: "Mainland Spain's highest peaks, 45 min away, for hiking or winter skiing.", t: ["mountain","adventure"], k: 0, s: "any" } ] },
    { name: "Mallorca", lat: 39.57, lng: 2.65, w: 3, t: ["beach","relax","adventure"], d: "Balearic island of coves, mountain villages and calm swimming water.", spots: [
      { n: "Caló des Moro", d: "Tiny turquoise cove framed by pine cliffs; arrive early.", t: ["beach","nature"], k: 0, s: "am" },
      { n: "Sóller tram & Port de Sóller", d: "Vintage wooden train through orange groves to a sheltered bay.", t: ["scenic","family"], k: 1, s: "any" },
      { n: "Caves of Drach", d: "Huge caverns with an underground lake and a short classical concert on it.", t: ["nature","family"], k: 1, s: "am" },
      { n: "Serra de Tramuntana hike", d: "UNESCO mountain range with trails between stone villages like Deià.", t: ["mountain","adventure"], k: -1, s: "am" } ] } ] },

  Greece: { blurb: "Whitewashed islands, ancient sites, grilled seafood and some of Europe's clearest water.", cities: [
    { name: "Athens", lat: 37.98, lng: 23.73, w: 2, t: ["culture","food"], d: "Cradle of democracy, watched over by the Acropolis.", spots: [
      { n: "Acropolis & Parthenon", d: "The 5th-century BC temple complex above the city. Go at opening to beat heat.", t: ["culture"], k: 0, s: "am" },
      { n: "Acropolis Museum", d: "Glass-floored museum over excavations, holding the original sculptures.", t: ["culture","family"], k: 0, s: "pm" },
      { n: "Plaka & Anafiotika", d: "Old-town lanes of tavernas and a tiny island-style village under the rock.", t: ["food","shopping"], k: 1, s: "eve" },
      { n: "Cape Sounion", d: "Temple of Poseidon on a sea cliff, famed for sunsets, 70 km south.", t: ["scenic","culture"], k: 0, s: "eve" } ] },
    { name: "Santorini", lat: 36.39, lng: 25.46, w: 3, t: ["relax","scenic","beach"], d: "Volcanic caldera island known for blue domes and sunsets.", spots: [
      { n: "Oia sunset", d: "The most famous sunset in Greece, seen from the village's castle ruins.", t: ["relax","scenic"], k: 0, s: "eve" },
      { n: "Caldera catamaran cruise", d: "Sail to the volcano, hot springs and swim stops.", t: ["adventure","beach"], k: 0, s: "pm" },
      { n: "Fira–Oia caldera hike", d: "10 km rim trail with constant views over the caldera.", t: ["adventure","scenic"], k: -1, s: "am" },
      { n: "Akrotiri", d: "Bronze Age town buried by eruption, Greece's 'Minoan Pompeii'.", t: ["culture"], k: 0, s: "am" },
      { n: "Perissa black-sand beach", d: "Long volcanic-sand beach with calm water and sunbeds.", t: ["beach","family"], k: 1, s: "pm" } ] },
    { name: "Crete", lat: 35.34, lng: 25.13, w: 4, t: ["beach","culture","adventure","food"], d: "Greece's largest island: gorges, Minoan palaces and pink-sand beaches.", spots: [
      { n: "Knossos", d: "Palace of the Minoans and the legendary Labyrinth of the Minotaur.", t: ["culture"], k: 0, s: "am" },
      { n: "Elafonisi", d: "Shallow lagoon with pink-tinged sand; ideal for small children.", t: ["beach","family"], k: 1, s: "any" },
      { n: "Balos Lagoon", d: "Turquoise lagoon reached by boat from Kissamos.", t: ["beach","scenic"], k: 0, s: "any" },
      { n: "Samaria Gorge", d: "16 km descent through one of Europe's longest gorges.", t: ["adventure","nature","mountain"], k: -1, s: "am" },
      { n: "Chania old harbor", d: "Venetian harbor and lighthouse lined with tavernas.", t: ["food","relax","nightlife"], k: 1, s: "eve" } ] },
    { name: "Naxos", lat: 37.10, lng: 25.38, w: 3, t: ["beach","relax","food"], d: "Laid-back Cycladic island with long sandy beaches and mountain villages.", spots: [
      { n: "Portara", d: "Giant marble doorway of an unfinished temple of Apollo, best at sunset.", t: ["culture","scenic"], k: 1, s: "eve" },
      { n: "Plaka & Agios Prokopios beaches", d: "Long sandy beaches with shallow, calm water.", t: ["beach","family"], k: 1, s: "pm" },
      { n: "Halki & Apiranthos villages", d: "Marble-paved mountain villages; try local kitron liqueur.", t: ["culture","food","mountain"], k: 0, s: "am" },
      { n: "Mount Zas hike", d: "Highest peak in the Cyclades, 1,004 m, with a cave near the top.", t: ["mountain","adventure"], k: -1, s: "am" } ] },
    { name: "Corfu", lat: 39.62, lng: 19.92, w: 3, t: ["beach","nature","culture"], d: "Green Ionian island with Venetian old town and cliff-backed coves.", spots: [
      { n: "Corfu Old Town", d: "UNESCO-listed Venetian lanes, arcades and two fortresses.", t: ["culture","shopping"], k: 0, s: "pm" },
      { n: "Paleokastritsa", d: "Six coves of clear water with boat trips into sea caves.", t: ["beach","adventure"], k: 1, s: "any" },
      { n: "Achilleion Palace", d: "Empress Sisi's summer palace with gardens above the sea.", t: ["culture"], k: 0, s: "am" } ] } ] },

  France: { blurb: "Paris café life, châteaux, wine country and the Riviera.", cities: [
    { name: "Paris", lat: 48.86, lng: 2.35, w: 4, t: ["culture","food","shopping"], d: "The City of Light, built for wandering and eating.", spots: [
      { n: "Eiffel Tower", d: "The 1889 iron icon; book summit tickets or picnic on the Champ de Mars.", t: ["culture","family"], k: 1, s: "eve" },
      { n: "Louvre", d: "Largest art museum in the world, home of the Mona Lisa.", t: ["culture"], k: -1, s: "am" },
      { n: "Montmartre & Sacré-Cœur", d: "Hilltop artists' village with a white basilica and city views.", t: ["culture","scenic"], k: 0, s: "pm" },
      { n: "Jardin du Luxembourg", d: "Formal gardens with toy sailboats, pony rides and a puppet theater.", t: ["relax","family"], k: 1, s: "pm" },
      { n: "Seine river cruise", d: "An hour past Notre-Dame and the Louvre by boat.", t: ["relax","scenic"], k: 1, s: "eve" },
      { n: "Disneyland Paris", d: "Two theme parks 40 min east by RER train.", t: ["family"], k: 1, s: "any" } ] },
    { name: "Nice", lat: 43.70, lng: 7.27, w: 3, t: ["beach","relax","food"], d: "Riviera city of pebble beaches and a palm-lined promenade.", spots: [
      { n: "Promenade des Anglais", d: "7 km seafront walk along the Baie des Anges.", t: ["relax","beach"], k: 1, s: "eve" },
      { n: "Cours Saleya market", d: "Flower and food market; try socca, a chickpea pancake.", t: ["food","shopping"], k: 1, s: "am" },
      { n: "Èze village", d: "Medieval eagle's-nest village 400 m above the sea.", t: ["scenic","culture"], k: 0, s: "pm" },
      { n: "Monaco day trip", d: "Tiny principality of the casino, harbor and Grand Prix, 20 min by train.", t: ["culture","nightlife"], k: 0, s: "any" } ] },
    { name: "Provence", lat: 43.95, lng: 4.81, w: 3, t: ["relax","food","scenic"], d: "Lavender fields, hill towns, Roman ruins and rosé.", spots: [
      { n: "Lavender fields of Valensole", d: "Purple rows in bloom from late June to July.", t: ["scenic","nature"], k: 1, s: "am" },
      { n: "Pont du Gard", d: "2,000-year-old Roman aqueduct with a river swimming spot beneath.", t: ["culture","family"], k: 1, s: "pm" },
      { n: "Gordes & Roussillon", d: "Hilltop stone village and ochre-red cliffs village.", t: ["scenic","culture"], k: 0, s: "pm" },
      { n: "Châteauneuf-du-Pape tasting", d: "Famous southern Rhône wine appellation.", t: ["food"], k: -1, s: "pm" } ] },
    { name: "Chamonix", lat: 45.92, lng: 6.87, w: 3, t: ["mountain","adventure","nature"], d: "Alpine town under Mont Blanc, Western Europe's highest peak.", spots: [
      { n: "Aiguille du Midi cable car", d: "Ride to 3,842 m and stand in a glass box over the void.", t: ["mountain","adventure"], k: 0, s: "am" },
      { n: "Montenvers train & Mer de Glace", d: "Rack railway to France's largest glacier and an ice cave.", t: ["mountain","family"], k: 1, s: "am" },
      { n: "Lac Blanc hike", d: "Classic alpine lake trail facing the Mont Blanc massif.", t: ["mountain","nature","adventure"], k: -1, s: "am" },
      { n: "Paragliding tandem flight", d: "Chamonix is a world paragliding hub.", t: ["adventure"], k: -1, s: "pm" } ] } ] },

  Portugal: { blurb: "Tiled facades, pastéis de nata, Atlantic surf and the Algarve's golden cliffs.", cities: [
    { name: "Lisbon", lat: 38.72, lng: -9.14, w: 4, t: ["culture","food","nightlife"], d: "Hilly capital of trams, viewpoints and fado.", spots: [
      { n: "Tram 28", d: "Vintage yellow tram rattling through Alfama and Graça.", t: ["culture","family"], k: 1, s: "am" },
      { n: "Belém & Pastéis de Belém", d: "Jerónimos Monastery, the Belém Tower and the original custard tarts.", t: ["culture","food"], k: 1, s: "am" },
      { n: "Oceanário de Lisboa", d: "One of Europe's largest aquariums.", t: ["family","nature"], k: 1, s: "pm" },
      { n: "Fado in Alfama", d: "Portugal's soulful folk song in small dinner houses.", t: ["culture","nightlife"], k: -1, s: "eve" },
      { n: "Time Out Market", d: "Food hall of Lisbon's top chefs under one roof.", t: ["food"], k: 1, s: "pm" } ] },
    { name: "Sintra", lat: 38.80, lng: -9.39, w: 1, t: ["culture","nature"], d: "Fairy-tale palaces in misty hills, 40 min from Lisbon.", spots: [
      { n: "Pena Palace", d: "Red-and-yellow Romantic palace atop a hill.", t: ["culture","family"], k: 1, s: "am" },
      { n: "Quinta da Regaleira", d: "Gardens with an initiation well spiraling underground.", t: ["culture","adventure"], k: 1, s: "pm" },
      { n: "Cabo da Roca", d: "Westernmost point of mainland Europe.", t: ["scenic","nature"], k: 0, s: "eve" } ] },
    { name: "Porto", lat: 41.15, lng: -8.61, w: 3, t: ["food","culture"], d: "Riverside city of port wine cellars and azulejo tiles.", spots: [
      { n: "Ribeira & Dom Luís I Bridge", d: "Colorful riverfront and the two-deck iron bridge.", t: ["culture","scenic"], k: 1, s: "eve" },
      { n: "Port cellars of Vila Nova de Gaia", d: "Tastings at Taylor's, Graham's and others.", t: ["food"], k: -1, s: "pm" },
      { n: "Livraria Lello", d: "Neo-Gothic bookshop with a famous crimson staircase.", t: ["culture","shopping"], k: 0, s: "am" },
      { n: "Douro Valley", d: "Terraced vineyard valley by boat or train.", t: ["scenic","food"], k: 0, s: "any" },
      { n: "Francesinha sandwich", d: "Porto's meat-and-cheese sandwich in beer sauce.", t: ["food"], k: 1, s: "pm" } ] },
    { name: "Algarve", lat: 37.09, lng: -8.25, w: 4, t: ["beach","relax","adventure"], d: "Southern coast of golden cliffs, sea caves and family resorts.", spots: [
      { n: "Benagil sea cave", d: "Cathedral-like cave with a skylight, by boat or kayak.", t: ["adventure","beach"], k: 0, s: "am" },
      { n: "Praia da Marinha", d: "Clifftop trail and one of Europe's most beautiful beaches.", t: ["beach","nature"], k: 0, s: "pm" },
      { n: "Ponta da Piedade", d: "Rock arches and grottoes near Lagos, best by small boat.", t: ["scenic","adventure"], k: 1, s: "am" },
      { n: "Zoomarine", d: "Marine park with dolphins and water slides.", t: ["family"], k: 1, s: "any" } ] } ] }
});
