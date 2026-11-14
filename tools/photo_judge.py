"""Decides whether a Commons photo may stand for a place in Waypoint.

Two sides are classified and then checked against each other:
  * the PLACE: what kind of thing it is (a beach, a church, a market…) and whether it is a fixed, photographable
    place at all. A cooking class, a tapas crawl or "kayaking at Almyrida" happens somewhere, but no photo of a
    street nearby shows it, so such things never get a stand-in photo.
  * the PHOTO: what it shows, read from its Commons categories first (far more reliable than file names: a file
    called "Convoy" sits in "Mine rollers"; "Tiger attak…" sits in "Zoos in Italy"), then from its title and
    description. People, vehicles, animals, events, interiors, artefacts, signs, hotels and old prints are never
    accepted; a stand-in must positively show the right kind of scene (a beach for a beach, streets for a town walk).

A name match must rest on a distinctive word: "Spice" (a singer), "Rouda" (a book) and "Watch" are not evidence,
and a file with no coordinates must name the city or be in its category tree, so a tapas bar in Hammersmith can
never stand for one in Granada.

The rules were tuned against ~1,200 photos judged by eye (1,004 kept, 198 thrown out); see judge/validate.py.
"""
import re, unicodedata

# ---------------- text helpers ----------------
_FOLD = {"ł": "l", "ø": "o", "ß": "ss", "đ": "d", "æ": "ae", "þ": "th", "ı": "i"}  # (as the app's W.norm: no base letter plus an accent)


def plain(s):
    s = unicodedata.normalize("NFD", "".join(_FOLD.get(c, c) for c in str(s or "").lower()))
    return "".join(c for c in s if unicodedata.category(c) != "Mn")

def words(s):
    return re.findall(r"[a-z0-9]+", plain(s))

STOP = {"the", "of", "and", "a", "an", "de", "di", "del", "dei", "della", "delle", "degli", "la", "le", "el", "il", "lo", "los", "las",
        "da", "do", "dos", "das", "du", "des", "au", "aux", "en", "in", "al", "alla", "alle", "ai", "agli", "y", "e", "et", "con", "with",
        "at", "on", "to", "for", "near", "by", "from", "or", "s", "i", "o", "u", "ta", "tis", "tou", "ton", "tin", "ti", "sto", "sti", "sta"}

# words that say what kind of place but never which one
GENERIC = set("""beach beaches playa plage spiaggia paralia cove cala bay baia harbour harbor port porto marina waterfront seafront
promenade lungomare paseo church chiesa iglesia cathedral duomo cattedrale catedral basilica chapel cappella capilla monastery monasterio
monastero mosque temple museum museo museu gallery galleria palace palazzo palacio castle castello castillo fortress fortezza fort
tower torre walls gate porta puerta square piazza plaza placa platia street strada via calle carrer rue road avenue corso viale
lane alley vicolo old town centro storico casco antiguo village villaggio pueblo town city citta ciudad quarter district neighbourhood
neighborhood barrio park parco parque garden giardino jardin jardines gardens market mercato mercado bazaar agora ruins ruin ancient
archaeological site temple theatre theater amphitheatre amphitheater stadium bridge ponte puente river fiume rio lake lago lagoon
gorge canyon ravine valley valle mountain monte montana mount peak hill colle cave grotta cueva grotto waterfall cascata cascada
island isola isla islet viewpoint mirador belvedere lookout panorama view views sunset sunrise evening morning afternoon night
walk stroll hike trail path tour visit trip day stop break lunch dinner breakfast coffee cafe caffe bar restaurant taverna tavern
trattoria osteria ristorante pizzeria bakery pasticceria panificio shop shops stalls stall area zone centre center main local
traditional famous historic historical best top free family kids children family-friendly guided private sea mare mar coast costa
north south east west upper lower new nuovo nueva nuova san santa santo saint st sant agios agia agioi aghios""".split())

# a place name with any of these is an experience, not a spot a nearby photo could show
ACTIVITY = re.compile(r"\b(class|classes|lesson|workshop|course|tour|tours|tasting|crawl|hopping|show|performance|concert|opera|gig|"
                      r"night|nightlife|drinks|cocktails|aperitivo|aperitif|happy hour|bar hopping|clubbing|dancing|flamenco|music|"
                      r"live|party|karaoke|kayak\w*|canoe\w*|paddle\w*|surf\w*|windsurf\w*|kite\w*|wakeboard\w*|jet ?ski|snorkel\w*|"
                      r"diving|dive|scuba|sailing|sail|speedboat|boat trip|boat tour|cruise|rental|hire|rent|zip ?line|rafting|"
                      r"canyoning|climbing|bungee|horse\w*|riding|cycling|bike|biking|e-bike|segway|quad|jeep|safari|atv|buggy|"
                      r"picnic|photo walk|photography|cooking|lesson|spa|wellness|massage|hammam|hamam|yoga|gym|fitness|"
                      r"shopping|souvenir|pottery|craft|ceramic|painting class|wine|winery|vineyard tasting|olive oil|cheese|"
                      r"gelato|ice cream|granita|churros|chocolate|pastry|sweets|dessert|coffee break|tea|breakfast|brunch|lunch|"
                      r"dinner|supper|meal|meze|tapas|pintxo|street food|food|eat|eating|dine|dining|aperitivo|"
                      r"taverna|tavernas|tavern|restaurant|restaurants|cafe|cafes|cafes|kafeneio|kafeneia|bar|bars|pub|pubs|club|clubs|"
                      r"bakery|pasticceria|gelateria|ouzeri|rakadiko|enoteca|bodega|bistro|brunch|drinks?)\b")
# ... except that these are real spots even when the name sounds like an outing
SPOT_ANYWAY = re.compile(r"\b(water ?park|aqua ?park|aquapark|theme park|amusement|fun ?park|adventure park|aquarium|zoo|museum|"
                         r"cave|caves|gorge|beach|lake|waterfall|castle|fortress|monastery|temple|ruins|palace|cathedral|church|"
                         r"market|bazaar|harbou?r|port|marina|lighthouse|bridge|square|piazza|plaza|park|gardens?|viewpoint|mirador|"
                         r"belvedere|island|peninsula|promenade|lungomare|seafront|old town|village|citadel|acropolis|archaeological)\b")
# a title like "Lerou, Rodos 851 00, Greece - panoramio" or "Unnamed Road" is a random roadside snap
ADDRESSY = re.compile(r"\b\d{3} ?\d{2}\b.*panoramio|unnamed road|^\s*[^,]+, [^,]+ \d{3,5}", re.I)

KINDS = [
    ("waterpark", r"water ?park|aqua ?park|aquapark|aquatropic|acqua ?plus|slides?\b"),
    ("themepark", r"theme park|amusement|fun ?park|luna ?park|adventure park|dinosauria|mini ?golf|go.?kart"),
    ("zoo", r"\bzoo\b|aquarium|acquario|acuario|wildlife|sanctuary|turtle|dolphin|safari park|bird park|petting"),
    ("beach", r"beach|beaches|playa|plage|spiaggia|paralia|\bcove\b|\bcala\b|lido\b|\bbay\b|lagoon(?! spa)|sand dunes|surf spot"),
    ("gorge", r"gorge|canyon|ravine|farang|schlucht"),
    ("waterfall", r"waterfall|falls\b|cascad"),
    ("cave", r"\bcaves?\b|grotto|grotta|cueva|cavern|catacomb"),
    ("lake", r"\blake\b|\blago\b|\blimni\b|reservoir|lagoon|salt pans"),
    ("island", r"\bisland|isola|islet|\bisla\b|peninsula|cape\b|capo\b"),
    ("mountain", r"mount\w*|monte\b|peak|summit|\bhike|trail|ridge|plateau|pass\b|foothill|volcano|etna|parnass|dikti|ida\b|sierra|cable car|funicular"),
    ("ruins", r"ruins?|ancient|archaeolog|acropolis|forum|temple|amphitheat|theatre of|theater of|odeion|naumachia|minoan|roman villa|aqueduct|necropolis|tomb|treasury|stadium of|sanctuary|knossos|pompeii|herculaneum|paestum|italica|phaistos|malia|gortyn|zakros|baths? of|thermae|agora\b"),
    ("landmark", r"colosse|coliseum|arena\b|arch of|\barco\b|arc de|obelisk|obelisco|pyramid|piramide|mausoleum|keyhole|bocca della|statue of|monument|memorial|clock tower|city gate|\bgate\b|\bporta\b|puerta de|cistern|baths?\b|hammam|thermal|spa\b"),
    ("castle", r"castle|castello|castillo|fortress|fortezza|\bfort\b|citadel|kastro|kastello|alcazab|alcazar|alhambra|ramparts|walls\b|bastion|tower\b|torre\b|lighthouse|faro\b|palace|palazzo|palacio|generalife|villa\b|windmill|mills?\b"),
    ("church", r"church|chiesa|iglesia|cathedral|duomo|catedral|basilica|chapel|cappella|capilla|monaster|convent|abbey|mosque|synagogue|hermitage|ermita|panagia|agios|agia\b|santa maria|san \w+|sant'"),
    ("museum", r"museum|museo|museu|gallery|galleria|pinacoteca|uffizi|exhibition|planetarium|science cent|noesis|library|biblioteca"),
    ("market", r"market|mercato|mercado|mercat|bazaar|bazar|souk|agora\b|halles|fish market|vucciria|ballar|stalls?\b|street food|vendors"),
    ("bridge", r"bridge|ponte|puente|pont\b|canal|gondola|rialto"),
    ("garden", r"garden|giardin|jardin|botanic|orchard|grove|lavender|rose garden|kipos|parterre"),
    ("park", r"\bpark\b|parco|parque|forest|woods|reserve|wetland|national park|nature|meadow|valley|countryside|farm|vineyard|winery|olive"),
    ("harbor", r"harbou?r|\bport\b|porto|puerto|marina|waterfront|seafront|quay|pier|jetty|dock|limani|fishing village|shipyard|boatyard|neoria"),
    ("square", r"square|piazza|plaza|placa|platia|fountain|fontana|campo de|largo\b"),
    ("viewpoint", r"viewpoint|mirador|belvedere|lookout|panoram|terrace|rooftop|sunset|sunrise|view\b|views\b|skyline"),
    ("street", r"street|strada|\bvia\b|calle|carrer|rue|corso|lane|alley|vicolo|promenade|lungomare|paseo|boulevard|avenue|old town|centro storico|casco|quarter|district|neighbou?rhood|barrio|town\b|village|city|cent(re|er)|lanes|walk|stroll|wander|explore"),
]
KIND_RX = [(k, re.compile(rx)) for k, rx in KINDS]

def place_profile(name, food=False, city="", country="", common=()):
    """{'kind', 'fixed' (a real spot a photo could show), 'activity', 'distinct' (words that identify it)}"""
    n = plain(name)
    kinds = (["market"] if KIND_RX[[k for k, _ in KINDS].index("market")][1].search(n) else ["food"]) if food else [k for k, rx in KIND_RX if rx.search(n)]
    act = bool(ACTIVITY.search(n)) and not food
    fixed = not act or bool(SPOT_ANYWAY.search(n))
    # an outing *about* a spot still names it: "Keri caves boat trip" may match a photo of the Keri caves
    city_w = set(words(city)) | set(words(country))
    cityish = lambda w: w in city_w or any(len(c) >= 4 and len(w) >= 4 and w[:3] == c[:3] for c in city_w)   # Rome / Roma, Napoli / Naples
    distinct = [w for w in words(n) if w not in STOP and w not in GENERIC and not cityish(w) and w not in set(common) and (len(w) >= 4 or not w.isascii()) and not w.isdigit()]
    # a proper name that fits no kind ("Colosseum", "Aventine Keyhole") is a landmark: a photo of any built thing named for it will do;
    # a nameless one ("evening stroll") is the street
    if not kinds:
        ws = name.split()
        proper = len(ws) <= 2 or any(w[:1].isupper() for w in ws[1:] if plain(w) in distinct)
        kinds = ["landmark"] if distinct and not act and proper else ["street"]
    kind = kinds[0]
    return {"kind": kind, "kinds": kinds, "fixed": fixed, "activity": act, "distinct": distinct, "food": food}


# ---------------- what a photo shows ----------------
# subject words looked for in categories, then (weaker) in titles and descriptions
SUBJECTS = {
    "people": r"\b(people|person|persons|men|women|man\b|woman|boy|boys|girl|girls|child|children|kids|portrait|portraits|family|families|"
              r"crowd|crowds|worker|workers|vendor|vendors|barber|haircut|soldier|soldiers|troops|police|officer|"
              r"player|players|athlete|runner|runners|marathon|dancer|dancers|musician|singer|performer|actor|actress|"
              r"wedding|bride|selfie|smiling|posing|faces?|farmers?|fishermen|monks?|priests?|students?)\b",
    "event": r"\b(festival|festivals|concert|concerts|parade|parades|procession|processions|ceremony|ceremonies|event|events|"
             r"protest|demonstration|rally|race|races|competition|match|game|games|performance|performances|show|exhibition|"
             r"fair|celebration|carnival|conference|meeting|summit|award|awards|graduation|lesson|class|classroom|training)\b",
    "vehicle": r"\b(vehicle|vehicles|car|cars|truck|trucks|lorry|convoy|convoys|bus|buses|taxi|taxis|tram|trams|train|trains|"
               r"locomotive|railway|station|metro|scooter|scooters|motorcycle|motorcycles|moto|vespa|bicycle|bicycles|rickshaw|"
               r"aircraft|airplane|helicopter|helicopters|tank|tanks|armou?red|humvee|mrap|nyala|mine roller|mine rollers|military|army|navy|"
               r"ship|ships|cruise ship|ferry|ferries|warship|"
               r"air force|marines|dvids|isaf|nato|war\b|battle|weapon|weapons|rifle|gun|guns|traffic|parking|garage)\b",
    "animal": r"\b(animal|animals|mammal|mammals|bird|birds|fish|fishes|dog|dogs|cat|cats|tiger|tigers|lion|lions|elephant|"
              r"monkey|monkeys|goat|goats|sheep|cow|cows|cattle|horse|horses|donkey|donkeys|camel|camels|turtle|turtles|"
              r"insect|insects|butterfly|snake|lizard|zoo\b|zoos|pets?)\b",
    "interior": r"\b(interior|interiors|inside|indoor|indoors|rooms|halls|nave|naves|altar|altars|apse|ceiling|ceilings|"
                r"vault|vaults|crypt|crypts|iconostasis|pulpit|pulpits|organ|organs|chandelier|chandeliers|"
                r"corridor|lobby|kitchen|bedroom|bathroom|shop interior|entree|entrance hall)\b",
    "artwork": r"\b(painting|paintings|sculpture|sculptures|statue|statues|bust|busts|relief|reliefs|fresco|frescos|frescoes|artwork|artworks|"
               r"exhibit|exhibits|artefact|artefacts|artifact|artifacts|pottery|vase|vases|kylix|amphora|jewellery|jewelry|"
               r"coin|coins|manuscript|manuscripts|casket|icon|icons|mechanism|skeleton|fossil|fossils|specimen|scale model|"
               r"figurine|carving|carvings|stele|stelae|sarcophag\w*|mummy|mummies|mosaic|mosaics)\b",
    "print": r"\b(engraving|engravings|etching|lithograph|woodcut|xilografia|acquatinta|aquatint|drawing|drawings|sketch|print|"
             r"prints|postcard|postcards|map|maps|plan|plans|diagram|poster|posters|illustration|illustrations|book|books|"
             r"document|documents|scan|scans|black and white|monochrome|19th.century photograph|historical photograph|"
             r"photochrom|daguerreotype|old photograph|photographs from 19\d\d)\b",
    "sign": r"\b(street sign|road sign|signage|plaque|plaques|inscription|inscriptions|memorial|memorials|monument to|monuments and memorials|war memorial|"
            r"cenotaph|grave|graves|cemetery|cemeteries|tombstone|logo|logos|banner|advertisement|graffiti|street art|"
            r"mural|murals|azulejo|azulejos|facade detail|close-?up|detail of)\b",
    "lodging": r"\b(hotel|hotels|hostel|apartments?|apartamentos|resort|resorts|b&b|guesthouse|villa rental|camping|campsite)\b",
    "food": r"\b(food|foods|dish|dishes|meal|meals|cuisine|bread|pastry|pastries|cake|cakes|dessert|pizza|pasta|coffee|drink|"
            r"drinks|wine|beer|bottle|bottles|glass|menu|plate|plates|tapas|seafood dish)\b",
    # positive scenes
    "beach": r"\b(beach|beaches|coast|coasts|coastline|coastal|bay|bays|cove|coves|seaside|shore|shores|sea\b|seas|dunes|"
             r"cliffs?|rocks? of|lido|swimming|bathing)\b",
    "water": r"\b(lake|lakes|river|rivers|waterfall|waterfalls|canal|canals|lagoon|lagoons|pond|ponds|reservoir|spring|springs|"
             r"stream|streams|gulf|strait)\b",
    "harbor": r"\b(harbou?r|harbou?rs|port|ports|marina|marinas|quay|quays|pier|piers|jetty|dock|docks|boats?|fishing boats?|"
              r"yachts?|ferry|ferries|ships?|lighthouse|lighthouses|waterfront|seafront|promenade)\b",
    "nature": r"\b(mountain|mountains|hill|hills|valley|valleys|gorge|gorges|canyon|canyons|ravine|cave|caves|grotto|forest|"
              r"forests|wood|woods|trees?|park|parks|garden|gardens|botanical|nature|landscape|landscapes|countryside|"
              r"fields?|meadow|olive groves?|orchards?|vineyards?|plateau|peak|peaks|summit|volcano|lava|rock formations?|"
              r"national park|reserve|wetland|salt pans?|salinas?|island|islands|islet|peninsula|cape\b)\b",
    "ruins": r"\b(ruins?|archaeological|archeological|ancient|roman|greek|minoan|byzantine|hellenistic|temple|temples|"
             r"amphitheatre|amphitheater|theatre|theater|odeon|odeion|forum|acropolis|necropolis|excavation|excavations|"
             r"columns?|aqueduct|baths|thermae|stadium|sanctuary|villa romana)\b",
    "fortress": r"\b(castle|castles|fortress|fortresses|fort|forts|fortification|fortifications|citadel|walls|city walls|"
                r"rampart|ramparts|bastion|bastions|tower|towers|gate|gates|keep|battlements|palace|palaces|alcazaba|alcazar)\b",
    "church": r"\b(church|churches|cathedral|cathedrals|basilica|basilicas|chapel|chapels|monastery|monasteries|convent|"
              r"abbey|mosque|mosques|synagogue|synagogues|minaret|bell tower|campanile|dome|domes|hermitage)\b",
    "building": r"\b(building|buildings|architecture|facade|facades|exterior|exteriors|house|houses|mansion|mansions|"
                r"townhall|town hall|city hall|theatre building|museum building|library building|school building|windmill|windmills|"
                r"university|hospital building|railway station building|market hall|arcade|loggia|villa|villas|neoclassical|"
                r"baroque|renaissance|gothic|venetian|ottoman|moorish|art nouveau|modernist|brutalist)\b",
    "museum": r"\b(museum|museums|gallery|galleries|planetarium|science centre|science center|aquarium|aquariums)\b",
    "street": r"\b(street|streets|lane|lanes|alley|alleys|road|roads|avenue|avenues|boulevard|square|squares|piazza|piazzas|"
              r"plaza|plazas|fountain|fountains|old town|old towns|historic centre|historic center|city centre|city center|"
              r"town centre|neighbou?rhoods?|quarter|quarters|district|districts|village|villages|town|towns|city|cities|"
              r"cityscape|cityscapes|townscape|urban|pedestrian|arcades|steps|stairway|stairways)\b",
    "market": r"\b(market|markets|bazaar|bazaars|souk|souks|stall|stalls|market hall|fish market|shops?|shopping)\b",
    "view": r"\b(view|views|panorama|panoramas|panoramic|aerial|aerials|aerial photographs?|skyline|skylines|from above|"
            r"vista|overlook|lookout|viewpoint|belvedere|mirador|sunset|sunsets|sunrise|sunrises|dusk|dawn|evening|night|"
            r"nights|illuminated|at night|by night)\b",
    "bridge": r"\b(bridge|bridges|viaduct|footbridge)\b",
}
SUBJ_RX = {k: re.compile(v) for k, v in SUBJECTS.items()}
# the same ideas in Greek, Italian, Spanish, German and French (looked for in titles and descriptions)
LOCAL_SUBJ = {
    "beach": r"παραλ|ακρογιαλ|spiagg|lido|playa|plage|strand|κόλπ|golfo|baia|bahia|baie|costa|scogli|ακτ[ήη]",
    "harbor": r"λιμάν|λιμαν|porto|puerto|hafen|port de|marina|molo|barche|βάρκ|φάρο|faro|phare|leuchtturm|καΐκ",
    "water": r"λίμν|λιμν|ποταμ|lago|fiume|rio|río|fluss|see|cascat|καταρράκτ|canale|λιμνοθάλασσ",
    "nature": r"φαράγγ|φαραγγ|βουν|όρος|σπήλ|σπηλ|δάσος|gola|valle|monte|montagna|montaña|berg|tal|wald|grotta|cueva|höhle|bosco|bosque|πάρκ|parco|parque|giardin|jardín|jardin|garten|κήπ|ελαιών|oliv|vigne|viñed|weinberg|isola|isla|île|insel|νησ|νήσ",
    "ruins": r"αρχαι|ερείπ|ναός|θέατρ|θεατρ|στάδι|ιερό|ανάκτορ|μινω|scavi|rovine|anfiteatro|teatro antico|tempio|templo|ruinas|antik|ausgrab|ruine|forum",
    "fortress": r"κάστρ|καστρ|φρούρ|φρουρ|τείχ|πύλη|πύργ|castell|castillo|fortezza|forte|torre|muralla|mura|bastion|burg|festung|turm|porta|puerta|palazzo|palacio|palais|schloss|ανάκτορ|rocca",
    "church": r"εκκλησ|ναός|μονή|μοναστ|παναγ|άγιος|αγίου|αγία|αγίας|chiesa|duomo|basilica|cattedrale|santuario|convento|monastero|iglesia|catedral|ermita|capilla|monasterio|kirche|kathedrale|kloster|dom|église|cathédrale|abbaye|τζαμ|moschea|mezquita|moschee|καμπαναρ|campanile",
    "street": r"οδός|οδού|πλατεία|πλατεια|στεν|σοκάκ|παλιά πόλη|χωρι|πόλη|κέντρο|via|vicolo|corso|piazza|strada|calle|carrer|plaza|plaça|casco|barrio|pueblo|strasse|straße|gasse|platz|markt|altstadt|dorf|rue|place|ruelle|village|σκαλ|scalinata|κρήν|fontana|fuente|brunnen|fontaine",
    "market": r"αγορά|αγορα|mercato|mercado|mercat|markt|marché|bazar|παζάρ",
    "view": r"θέα|πανοραμ|άποψη|veduta|panorama|vista|aussicht|blick|vue|ηλιοβασίλεμ|tramonto|atardecer|sonnenuntergang|coucher|δύση|aérea|aerea|luftbild|dall'alto|desde el aire|νύχτ|notte|noche|nacht|nuit",
    "bridge": r"γέφυρ|γεφυρ|ponte|puente|brücke|pont|κανάλ",
    "building": r"κτίρι|κτήρι|μέγαρ|δημαρχ|palazz|edificio|municipio|ayuntamiento|rathaus|gebäude|haus|casa|maison|façade|facciata|fachada|fassade|νεοκλασ|βενετ|venezian|veneciano|ενετ",
    "museum": r"μουσεί|μουσει|museo|museu|musée|museum|πινακοθ|galleria|galería|galerie",
    "people": r"άνθρωπ|άνδρ|γυναίκ|παιδ|στρατιώτ|persone|gente|uomini|donne|bambini|soldati|personas|hombres|mujeres|niños|soldados|menschen|männer|frauen|kinder|soldaten|personnes|hommes|femmes|enfants|ritratto|retrato|porträt|portrait",
    "interior": r"εσωτερ|interno|interior|innen|intérieur|navata|nave|altare|altar|coro|cripta|cripta|affresc|fresk|mosaic|ψηφιδ|τοιχογραφ",
    "artwork": r"άγαλμ|αγαλμ|γλυπτ|πίνακ|έκθεμ|statua|scultura|dipinto|quadro|reperto|estatua|escultura|cuadro|pintura|statue|skulptur|gemälde|εύρημα|αμφορ|anfora|ánfora",
    "vehicle": r"αυτοκίν|λεωφορ|τρένο|τραίνο|σιδηρόδρομ|auto|automobile|camion|autobus|treno|stazione|coche|camión|autobús|tren|estación|zug|bahnhof|lkw|voiture|camion|gare|στρατ|militar|esercito|ejército|armee|armée|μηχαν",
    "sign": r"πινακίδ|επιγραφ|μνημείο|μνημειο|targa|lapide|iscrizione|monumento ai caduti|placa|inscripción|monumento a|gedenk|denkmal|tafel|inschrift|plaque|monument aux|τάφ|cimitero|cementerio|friedhof|cimetière|νεκροταφ|πόρτα|porta di|puerta de|tür|finestra|ventana|fenster",
    "print": r"χαρακτικ|incisione|grabado|stich|gravure|litograf|cartolina|postal|postkarte|carte postale|χάρτ|mappa|mapa|karte|carte|disegno|dibujo|zeichnung|dessin|σχέδι",
    "lodging": r"ξενοδοχ|hotel|albergo|hôtel|pension|ξενών|appartament|apartamento|ferienwohnung|résidence|resort|camping",
    "event": r"gegant|castell[ae]rs|correfoc|festa major|merc[eè] \d|fallas|carnaval|carnevale|semana santa|diada|moros y cristianos|γιορτ|πανηγύρ|φεστιβάλ|συναυλ|festa|sagra|concerto|processione|fiesta|procesión|concierto|romería|feria|fest|konzert|umzug|fête|concert|défilé|αγών|gara|partita|carrera|rennen|course|παρέλασ|παράστασ",
    "animal": r"ζώ[οα]|σκύλ|γάτ|πουλ|ψάρ|χελών|animale|cane|gatto|uccell|pesce|tartarug|animal|perro|gato|pájaro|pez|tortuga|tier|hund|katze|vogel|fisch|schildkröte|chien|chat|oiseau|poisson|tortue|ζωολογ|zoo",
}
# each pattern is a word start ("sagra", a village festival, is not in "Sagrada"); short words that are also parts of
# other words must be whole words
WHOLE = {"see", "tal", "dom", "rio", "mura", "porta", "coro", "auto", "tren", "zug", "gare", "gara", "fest", "course", "pez", "chat",
         "cane", "place", "rue", "via", "pont", "gato", "hund", "tier", "berg", "burg", "nave", "forte", "molo", "faro", "lido", "golfo",
         "costa", "vista", "markt", "dorf", "haus", "casa", "tren", "torre", "valle", "monte", "isla", "isola", "insel", "strand", "zoo", "sagra", "gara", "fiera"}
def _local(v):
    return re.compile("|".join((r"\b%s\b" if a in WHOLE else r"\b%s") % a for a in v.split("|")))
LOCAL_RX = {k: _local(v) for k, v in LOCAL_SUBJ.items()}
NEGATIVE = {"people", "event", "vehicle", "animal", "interior", "artwork", "print", "sign", "lodging", "food"}
# a category that only lists a detail in the shot (its cars, flags, windows) is not what the photo is of
DETAIL_CAT = re.compile(r"^(automobiles|cars|vehicles|buses|taxis|boats|flags|windows|doors|clocks|columns|stairs|steps|balustrades|utility poles|"
                        r"street lamps|benches|trees|palms|signs|tourists|visitors|cats|dogs|birds|pigeons|seagulls|chairs|tables|umbrellas|"
                        r"heat and smoke vents|architectural elements|oriel windows|bell gables|portals|balconies|roofs|chimneys|fountains)\b", re.I)
# Commons housekeeping categories say nothing about the picture
NOISE_CAT = re.compile(r"^(files|images|photographs|media|pages|cc-|self-published|pd |gfdl|uploaded|taken with|flickr|panoramio|"
                       r"wiki loves|featured|quality|valued|license|licence|photos by|photographs by|images by|works by|"
                       r"commons|category|unidentified|attribution|supported by|wikimedia|geograph|dvids|us army|united states)", re.I)

REPRO = re.compile(r"^artworks |\bpaintings (by|in|of|from|at)\b|\bpaintings$|google art project|\blithographs?\b|\bengravings?\b|"
                   r"\bdrawings (by|of|in)\b|\b2d work\b|\bin art$|^historical images of|\bprints (by|of|from)\b|\bwatercolou?rs?\b|"
                   r"\betchings?\b|\bwoodcuts?\b|\bpostcards?\b|\bphotochroms?\b", re.I)
REPRO_TITLE = re.compile(r"google art project|\b(painting|gemälde|dipinto|pintura|lithograph|engraving|gravure|stich)\b", re.I)


def photo_profile(title, cats=None, desc="", w=0, h=0):
    """{'subjects': {subject: strength}, 'flags': set(...)}; strength 2 from a category, 1 from the title/description"""
    cats = [c for c in (cats or []) if not NOISE_CAT.match(c)]
    lab = plain(re.sub(r"\.(jpe?g|png|tiff?|webp)$", "", re.sub(r"^File:", "", title), flags=re.I))
    lab = re.sub(r"\(\d{6,}\)|\bimg[_ ]?\d+|\bdsc[_ ]?\d+|\bp\d{6,}|\d{4}-\d\d-\d\d|\bpanoramio\b|\bgeograph\b", " ", lab)
    subj = {}; neg_title = set()
    for k, rx in SUBJ_RX.items():
        s = 0
        for c in cats:
            if rx.search(plain(c)) and not (k in NEGATIVE and DETAIL_CAT.match(c)):
                s = 2; break
        if not s and (rx.search(lab) or rx.search(plain(desc)[:200])):
            s = 1
        if k in NEGATIVE and rx.search(lab):
            neg_title.add(k)
        if not s:
            raw = (str(title) + " " + " ".join(cats) + " " + str(desc)[:200]).lower()
            if LOCAL_RX.get(k) and LOCAL_RX[k].search(raw):
                s = 2 if any(LOCAL_RX[k].search(c.lower()) and not (k in NEGATIVE and DETAIL_CAT.match(c)) for c in cats) else 1
        if s:
            subj[k] = s
    flags = set()
    if ADDRESSY.search(title): flags.add("addressy")
    m = re.search(r"\b(from|da|dal|dalla|desde|vom|depuis|από)\b", lab)
    from_place = (lab[:m.start()], lab[m.end():]) if m else None
    if re.search(r"\b(1[5-8]\d\d|19[0-4]\d)\b", lab) or re.search(r"black and white|monochrome|b&w|b/w|\bbw\b", lab): flags.add("old")
    if any(re.search(r"military|army|armed forces|soldiers|dvids|isaf|nato|war in", plain(c)) for c in cats): flags.add("military")
    if any(re.search(r"\b(people|men|women|children|portraits?) (of|in|at)\b", plain(c)) for c in cats): subj["people"] = 2
    if w and h and (w < 640 or h < 400): flags.add("small")
    # the file is itself an artwork: a painting, engraving or lithograph of the place, not a photo of it
    if any(REPRO.search(c) for c in (cats or [])) or REPRO_TITLE.search(lab): flags.add("repro")
    if w and h and (w / max(1, h) < 0.8): flags.add("portrait")
    return {"subjects": subj, "flags": flags, "neg_from_title": neg_title, "from_place": from_place, "title": lab}


# what kind of scene may stand for what kind of place
COMPAT = {
    "beach": {"beach", "water", "harbor", "view"}, "island": {"beach", "nature", "harbor", "view"},
    "harbor": {"harbor", "beach", "view"}, "lake": {"water", "nature", "view"}, "waterfall": {"water", "nature"},
    "gorge": {"nature", "water"}, "cave": {"nature"}, "mountain": {"nature", "view"}, "park": {"nature", "water"},
    "garden": {"nature"}, "ruins": {"ruins", "fortress"}, "castle": {"fortress", "ruins", "view"},
    "church": {"church"}, "museum": {"museum", "building"}, "landmark": {"ruins", "fortress", "church", "building", "street", "view", "bridge"}, "market": {"market"},
    "bridge": {"bridge", "water", "harbor"}, "square": {"street", "view"},
    "street": {"street", "view"}, "viewpoint": {"view", "nature", "beach"},
    "waterpark": {"beach", "water"}, "themepark": set(), "zoo": set(), "food": {"building", "street"},
}
POSITIVE = set().union(*COMPAT.values())
# a photo named for the place itself may show it as architecture or as a view (a church's "Exterior of …" category)
OWN_EXTRA = {"church": {"building", "view", "street"}, "castle": {"building", "view"}, "ruins": {"view", "building"},
             "landmark": {"view"}, "square": {"building"}, "museum": {"view", "street"}, "bridge": {"view", "street"}}
def compat(place): return set().union(*[COMPAT.get(k, set()) for k in place.get("kinds", [place["kind"]])])

def judge(place, photo, own, dist_km=None, name_hit=None, located=True, trusted_name=False, title_hit=None):
    """Should this photo stand for this place?
    own: the photo was matched to the place by name (else it is a stand-in for somewhere nearby)
    name_hit: for own matches, the words of the place's name found in the photo (list)
    located: the photo has coordinates near the city, or names the city or country (category trees leak: a depth-3
             walk from "Jalalabad" reaches a fruit stand in New York)
    title_hit: the subset of name_hit found in the file name itself; hits found only in categories or the description
             are weak (a district category, "near the Colosseum")
    Returns (ok, score, why)."""
    S, F = photo["subjects"], photo["flags"]
    pos = {k for k in S if k in POSITIVE}
    exterior = own and not any(k in S and k in photo.get("neg_from_title", set()) for k in ("artwork", "sign"))
    comp0 = compat(place) if own else set().union(*[COMPAT.get(k, set()) for k in place.get("kinds", [place["kind"]])[:1]])
    best_comp = max([S[k] for k in pos & comp0] or [0])
    # people and vehicles in a busy street, market or beach scene are part of the scene; as the subject they are not
    scene = place["kind"] in ("street", "market", "square", "beach", "harbor", "bridge") and best_comp == 2
    nt = photo.get("neg_from_title", set())
    strong_neg = [k for k in NEGATIVE if S.get(k) == 2 and not (best_comp == 2 and k not in nt and (k in ("people", "vehicle", "food") or (own and k in ("artwork", "sign"))))]
    neg = strong_neg or [k for k in NEGATIVE if k in S and k not in ("food",) and not (best_comp == 2 and k not in nt and k in ("people", "vehicle"))]
    # the photo's main subject must be one that fits the place
    best_other = max([S[k] for k in pos - comp0] or [0])
    if pos & comp0 and best_other > best_comp and not own:
        return False, 0, "mainly shows %s, place is a %s" % ("/".join(k for k in pos - comp0 if S[k] == best_other), place["kind"])
    if "print" in S or "old" in F:
        return False, 0, "old print or photo"
    if "repro" in F:
        return False, 0, "a painting or print of it, not a photo"
    # a market is easy to confuse with the district or square it is named after: the photo itself must show stalls or shops,
    # or be named as the market
    if place["kind"] == "market" and "market" not in S and not re.search(r"market|mercat|mercado|bazaar|bazar|souk|stalls?|αγορ|markt|march", plain(photo.get("title", ""))):
        return False, 0, "no sign of a market"
    if "military" in F:
        return False, 0, "military"
    if strong_neg and not (own and (len(name_hit or []) >= 2 or trusted_name) and not {"people", "event", "animal", "print", "artwork", "interior"} & set(strong_neg)):
        return False, 0, "shows " + "/".join(strong_neg)
    if own:
        name_hit = list(name_hit or [])
        if trusted_name and not name_hit:
            name_hit = ["(wikidata)"]
        # a name that is really just "the town's beach / old town / harbour" matches a clear photo of that, named for the town
        if not name_hit and best_comp == 2 and photo.get("town_hit") and not place["activity"] and (not place["distinct"] or place["kind"] in ("street", "beach", "harbor", "square", "island")):
            name_hit = ["(generic)"]
        if not name_hit:
            return False, 0, "no distinctive word matched"
        special = name_hit[0] in ("(wikidata)", "(generic)")
        nd = len(place["distinct"]); strong = [] if special else list(title_hit or [])
        full = special or len(name_hit) >= nd or len(name_hit) >= 2
        if not located and not (special or (len(strong) >= nd and max(len(w) for w in strong) >= 5)):
            return False, 0, "not in or near the city"
        weak = not special and not strong                       # named only in a district category or the description
        partial = not special and len(name_hit) == 1 and nd >= 3   # one word of a long name
        sure = strong and len(strong[0]) >= 7 and not (pos - compat(place))   # one long distinctive word in the file name, nothing against it
        if (weak or partial) and not (pos & compat(place) and best_comp == 2) and not sure:
            return False, 0, ("named only in its categories or description" if weak else "only part of the name") + ", and no clear sign of a %s" % place["kind"]
        fp = photo.get("from_place")
        if fp and name_hit and name_hit[0] != "(wikidata)":
            before, after = words(fp[0]), words(fp[1])
            if any(any(close(w, t) for t in after) for w in name_hit) and not any(any(close(w, t) for t in before) for w in name_hit):
                return False, 0, "taken from the place, not of it"
        if place["activity"] and not place["fixed"] and len(name_hit) < 2:
            return False, 0, "an outing matched on one word"
        if place["food"] and name_hit[0] != "(wikidata)" and len(name_hit) < max(1, -(-len(place["distinct"]) // 2)):
            return False, 0, "a place to eat needs its full name"
        if neg and not pos:
            return False, 0, "shows " + "/".join(neg)
        comp = compat(place) | (OWN_EXTRA.get(place["kind"], set()) if (title_hit or name_hit[0] == "(wikidata)") else set())
        if pos and comp and not (pos & comp) and len(name_hit) < 2:
            return False, 0, "shows %s, place is a %s" % ("/".join(sorted(pos)), place["kind"])
        score = 2 + len(name_hit) + (1 if pos & comp else 0) - (1 if neg else 0) - (0.5 if "small" in F else 0)
        return True, score, "named"
    # a stand-in
    anchored = bool(name_hit)   # the photo names the spot the outing happens at ("Picnic at Band-e Amir" -> Lake Band-e-Amir)
    if (not place["fixed"] or place["activity"] and place["kind"] in ("street", "viewpoint", "food")) and not anchored:
        return False, 0, "an outing, not a place"
    if place["kind"] in ("themepark", "zoo", "food"):
        return False, 0, "no stand-ins for a %s" % place["kind"]
    if neg:
        return False, 0, "shows " + "/".join(neg)
    comp = comp0
    if not (pos & comp) and not (anchored and not pos):   # a photo named for the spot needs no further proof of the scene
        return False, 0, "shows %s, place is a %s" % ("/".join(sorted(pos)) or "nothing recognisable", place["kind"])
    if "addressy" in F and place["kind"] not in ("street",):
        return False, 0, "roadside snapshot"
    if best_comp < 2 and not anchored:
        return False, 0, "only a weak hint of a %s" % "/".join(sorted(pos & comp))
    if dist_km is not None and dist_km > (0.4 if place["kind"] in ("street", "square", "market", "church", "museum") else 1.2):
        return False, 0, "too far (%.1f km)" % dist_km
    score = sum(2 if S[k] == 2 else 1 for k in pos & comp) + (2 if anchored else 0) - (dist_km or 0) - (0.5 if "small" in F else 0) - (0.5 if "portrait" in F else 0)
    return score >= 1, score, ("named stand-in: " if anchored else "stand-in: ") + "/".join(sorted(pos & comp))


def name_words_in(place, title, cats=(), desc="", only_title=False, city=""):
    """the place's distinctive words that appear in the photo's title, categories or description.
    only_title: the strong form: the file name and the photo's own categories, not a district or town category
    ("Testaccio (Rome)") and not the description"""
    if only_title:
        cw = set(words(city))
        own_cats = [c for c in cats if not (set(sum((words(p) for p in re.findall(r"\(([^)]*)\)", c)), [])) & cw)]
        tw = set(words(title) + sum((words(c) for c in own_cats), []))
    else:
        tw = set(words(title) + sum((words(c) for c in cats), []) + words(desc)[:40])
    hit = []
    for w in place["distinct"]:
        if any(close(w, t) for t in tw):
            hit.append(w)
    return hit

def located_in(city, country, title, cats=(), desc="", dist_km=None):
    """is this photo in or near the city: coordinates within 30 km, or the city named in its title, categories or description
    (the country alone is not enough: a beach on the far side of Greece is still the wrong beach)"""
    if dist_km is not None:
        return dist_km <= 30
    cw = {w for w in words(city) if w not in STOP and len(w) >= 4}
    tw = set(words(title) + sum((words(c) for c in cats), []) + words(desc))
    return bool(cw & tw)

def close(a, b):
    """the same word allowing one slip of spelling or transliteration (Elafonissi/Elafonisi, Palaiochora/Paleochora)"""
    if a == b: return True
    if len(a) < 5 or len(b) < 5: return False
    a2, b2 = re.sub(r"(.)\1", r"\1", a), re.sub(r"(.)\1", r"\1", b)   # double letters
    a2, b2 = a2.replace("ai", "e").replace("ei", "i").replace("oi", "i").replace("ou", "u").replace("y", "i").replace("k", "c").replace("ph", "f").replace("ch", "h"), b2.replace("ai", "e").replace("ei", "i").replace("oi", "i").replace("ou", "u").replace("y", "i").replace("k", "c").replace("ph", "f").replace("ch", "h")
    if a2 == b2: return True
    if abs(len(a2) - len(b2)) > 1: return False
    # one edit
    if len(a2) == len(b2): return sum(x != y for x, y in zip(a2, b2)) <= 1
    s, l = (a2, b2) if len(a2) < len(b2) else (b2, a2)
    for i in range(len(l)):
        if l[:i] + l[i + 1:] == s: return True
    return False
