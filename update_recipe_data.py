"""
update_recipe_data.py
=====================
Enriches all recipes in MongoDB with:
  - cuisines (PLURAL — list of 1-3 cuisines, classified from title + ingredients)
  - servings (parsed from instructions/title text)
  - readyInMinutes / cookingMinutes / preparationMinutes (parsed from instructions)

A recipe can belong to MULTIPLE cuisines if it scores well against more
than one (e.g. a fusion dish). If nothing matches confidently, it gets
["International"].

Run:
  python update_recipe_data.py

Options:
  --dry-run   Print stats without writing to MongoDB
  --limit N   Only process first N recipes (for testing)
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import re
import os
import argparse
import itertools
from pathlib import Path
from collections import defaultdict

import certifi
from pymongo import MongoClient, UpdateOne
from tqdm import tqdm

try:
    from dotenv import load_dotenv
    load_dotenv(Path("D:/projects/digital_chef/.env.local"))
except ImportError:
    pass

# ── MongoDB ──────────────────────────────────────────────────────────────────
MONGO_URI = os.environ.get("MONGODB_URI", "")
MONGO_DB  = os.environ.get("MONGODB_DB", "digital_chef")
if not MONGO_URI:
    sys.exit("MONGODB_URI not set.")

client = MongoClient(
    MONGO_URI,
    tlsCAFile=certifi.where(),
    socketTimeoutMS=180000,
    connectTimeoutMS=60000,
    serverSelectionTimeoutMS=60000,
)
col = client[MONGO_DB]["recipes"]

# ═════════════════════════════════════════════════════════════════════════════
# CUISINE KEYWORDS
# ═════════════════════════════════════════════════════════════════════════════
CUISINE_KEYWORDS = {
    "Italian": [
        "pasta","spaghetti","risotto","pizza","gnocchi","lasagna","lasagne",
        "penne","fettuccine","linguine","tagliatelle","pappardelle","rigatoni",
        "orecchiette","bucatini","farfalle","conchiglie","tortellini","ravioli",
        "polenta","focaccia","bruschetta","bruschette","tiramisu","cannoli",
        "panna cotta","osso buco","piccata","saltimbocca","marsala","pesto",
        "marinara","bolognese","carbonara","amatriciana","arrabbiata","primavera",
        "alfredo","caprese","antipasto","minestrone","ribollita","caponata",
        "arancini","crostini","calzone","stracciatella","porchetta","bistecca",
        "italian","sicilian","roman","milanese","florentine","venetian","tuscan",
        "ligurian","sardinian","neapolitan","calabrian","umbrian",
        "parmesan","parmigiano","pecorino","mozzarella","burrata","ricotta",
        "pancetta","prosciutto","guanciale","salami","mortadella","bresaola",
        "arborio","orzo","balsamic","fontina","provolone","gorgonzola",
    ],
    "Japanese": [
        "sushi","sashimi","ramen","udon","soba","miso","dashi","tempura",
        "teriyaki","yakitori","gyoza","edamame","matcha","wagyu","katsu",
        "tonkatsu","tonkotsu","shabu","sukiyaki","okonomiyaki","takoyaki",
        "onigiri","yakisoba","donburi","oyakodon","katsudon","gyudon",
        "chirashi","nigiri","maki","california roll","japanese","tokyo",
        "osaka","kyoto","hokkaido","okinawan","mirin","sake","wasabi",
        "nori","seaweed","konbu","kombu","bonito","katsuobushi","ponzu",
        "yuzu","shiso","daikon","lotus","burdock","tamagoyaki","chawanmushi",
        "agedashi","karaage","tsukune","natto",
    ],
    "Mexican": [
        "taco","tacos","enchilada","enchiladas","quesadilla","burrito","tamale",
        "tamales","pozole","mole","salsa","guacamole","tostada","tostadas",
        "chile relleno","chiles rellenos","carnitas","al pastor","carne asada",
        "barbacoa","birria","menudo","elote","esquites","sopes","tlayuda",
        "mexican","oaxacan","yucatan","puebla","veracruz","jalisco",
        "epazote","cotija","queso fresco","crema mexicana","tomatillo",
        "chipotle","ancho chile","mulato","pasilla","masa harina","nixtamal",
    ],
    "Chinese": [
        "stir fry","stir-fry","fried rice","chow mein","lo mein","chop suey",
        "dim sum","dumpling","dumplings","wonton","wontons","spring roll",
        "egg roll","egg foo young","kung pao","mapo tofu","orange chicken",
        "general tso","hot and sour soup","egg drop soup","char siu","peking duck",
        "twice cooked pork","red braised","dongpo","sweet and sour","mu shu",
        "bok choy","napa cabbage","chinese","beijing","shanghai","guangzhou",
        "szechuan","sichuan","cantonese","hunan","shanghainese","taiwanese",
        "oyster sauce","hoisin","five spice","black bean sauce",
        "chinese sausage","lap cheong","potsticker","steamed bun","claypot",
    ],
    "Thai": [
        "pad thai","green curry","red curry","yellow curry","massaman",
        "panang","tom yum","tom kha","larb","som tam","pad see ew",
        "khao pad","khao man gai","pad kra pao","thai basil chicken",
        "thai fried rice","thai","bangkok","chiang mai","lemongrass",
        "galangal","kaffir lime","thai basil","fish sauce","tamarind",
        "palm sugar","sticky rice","sriracha","nam pla","satay","thai curry",
    ],
    "Indian": [
        "curry","dal","dhal","lentil soup","naan","roti","chapati","paratha",
        "biryani","pulao","pilaf","samosa","pakora","bhaji","chutney","raita",
        "lassi","masala","tikka","korma","vindaloo","saag","palak","paneer",
        "butter chicken","chicken tikka","lamb rogan","lamb vindaloo",
        "chana masala","aloo gobi","baingan bharta","kheer","halwa",
        "gulab jamun","jalebi","ladoo","barfi","indian","punjabi","gujarati",
        "rajasthani","bengali","kerala","tamil","hyderabadi","mughal",
        "tandoor","tandoori","garam masala","fenugreek","ghee","curry leaves",
        "asafoetida",
    ],
    "Korean": [
        "kimchi","bulgogi","bibimbap","japchae","galbi","kalbi","samgyeopsal",
        "banchan","doenjang","gochujang","gochugaru","tteok","tteokbokki",
        "dakgalbi","sundubu","jjigae","haemul","pajeon","jeon","bossam",
        "jokbal","naengmyeon","ramyeon","seolleongtang","korean","seoul",
        "korean bbq","ssam","ssamjang","perilla","sesame leaf",
    ],
    "Greek": [
        "spanakopita","moussaka","souvlaki","gyros","gyro","tzatziki",
        "dolma","dolmades","taramasalata","skordalia","horiatiki","pastitsio",
        "baklava","loukoumades","revithia","fasolada","gemista","tiropita",
        "bougatsa","galaktoboureko","greek","athens","thessaloniki","crete",
        "feta","kalamata","kefalotyri","graviera","kasseri","phyllo","filo",
    ],
    "French": [
        "croissant","baguette","quiche","ratatouille","bouillabaisse",
        "coq au vin","beef bourguignon","cassoulet","creme brulee","souffle",
        "crepe","galette","nicoise","lyonnaise","provencal","alsatian",
        "bechamel","velouté","hollandaise","béarnaise","beurre blanc",
        "confit","terrine","pate de foie","foie gras","duck confit",
        "steak frites","croque monsieur","croque madame","vichyssoise",
        "gratin dauphinois","tarte tatin","madeleine","eclair","profiterole",
        "mousse au chocolat","french","paris","lyon","provence","normandy",
        "alsace","burgundy","bordeaux","brittany","dijon mustard",
        "herbes de provence","camembert","comte","roquefort","gruyere",
    ],
    "American": [
        "burger","hamburger","cheeseburger","hot dog","barbecue","bbq",
        "mac and cheese","macaroni and cheese","cornbread","biscuit and gravy",
        "pot roast","meatloaf","sloppy joe","philly cheesesteak","club sandwich",
        "buffalo wing","buffalo wings","chicken tenders","corn dog",
        "clam chowder","new england clam","lobster roll","pulled pork",
        "brisket","baby back ribs","coleslaw","baked beans","banana bread",
        "apple pie","blueberry pie","peach cobbler","brownie",
        "pancake","waffle","french toast","eggs benedict","hash brown",
        "american","southern","cajun","creole","tex mex","new england",
        "chesapeake","thanksgiving","ranch dressing","buffalo sauce",
        "peanut butter and jelly",
    ],
    "Spanish": [
        "paella","tapas","tortilla española","tortilla espanola","gazpacho",
        "salmorejo","pisto","patatas bravas","croquetas","jamon iberico",
        "manchego","romesco","sofrito","alioli","fideuà","fabada","cocido",
        "albondigas","calamares fritos","gambas al ajillo","bacalao","pulpo",
        "morcilla","spanish","barcelona","madrid","valencia","catalan",
        "andalusian","basque","galician","smoked paprika","pimenton","rioja",
    ],
    "Middle Eastern": [
        "hummus","falafel","shawarma","kebab","kofta","baba ghanoush",
        "fattoush","tabbouleh","kibbeh","ma'amoul","knafeh","halva",
        "musakhan","mansaf","maqluba","kabsa","doner","shish kebab",
        "lebanese","israeli","syrian","jordanian","iraqi","iranian persian",
        "turkish","middle eastern","tahini sauce","za'atar","zaatar","sumac",
        "pomegranate molasses","harissa","preserved lemon","baharat","dukkah",
        "freekeh","bulgur wheat","merguez","ras el hanout","chermoula",
    ],
    "Filipino": [
        "adobo","sinigang","kare kare","kare-kare","lechon","lumpia","pancit",
        "mechado","afritada","kaldereta","bistek tagalog","tapa silog",
        "tocino","longganisa","nilaga","tinola","binagoongan","dinuguan",
        "sisig","crispy pata","halo halo","halo-halo","leche flan",
        "maja blanca","bibingka","puto","filipino","philippines","bagoong",
        "patis",
    ],
}

CUISINE_PATTERNS = {}
for cuisine, words in CUISINE_KEYWORDS.items():
    unique = sorted(set(words), key=lambda x: -len(x))
    # Compile each keyword as a word-boundary regex to avoid false
    # substring matches (e.g. "lassi" incorrectly matching inside "classic",
    # "naan" inside "banana", "chai" inside "chair").
    compiled = [
        (kw, re.compile(r'\b' + re.escape(kw) + r'\b', re.IGNORECASE))
        for kw in unique
    ]
    CUISINE_PATTERNS[cuisine] = compiled


def classify_cuisines(title: str, ingredients: list, instructions: str) -> list:
    """
    Score recipe text against each cuisine's keywords using word-boundary
    matching (prevents false positives like "lassi" inside "classic").
    Title matches weighted 5x (per word in phrase), ingredients 2x, instructions 0.5x.

    Returns a LIST — a recipe can match multiple cuisines (fusion dishes).
    Falls back to ["International"] if nothing matches confidently.
    """
    title_lower = title
    ing_text    = " ".join(str(i.get("raw") or i.get("name", "")) for i in ingredients)
    inst_text   = instructions if instructions else ""

    scores: dict = defaultdict(float)

    for cuisine, keyword_patterns in CUISINE_PATTERNS.items():
        for kw, pattern in keyword_patterns:
            if pattern.search(title_lower):
                scores[cuisine] += 5.0 * len(kw.split())
            if pattern.search(ing_text):
                scores[cuisine] += 2.0
            if pattern.search(inst_text):
                scores[cuisine] += 0.5

    if not scores:
        return ["International"]

    STRONG_THRESHOLD = 5.0
    MIN_THRESHOLD    = 3.0

    ranked = sorted(scores.items(), key=lambda x: -x[1])
    top_score = ranked[0][1]

    if top_score < MIN_THRESHOLD:
        return ["International"]

    matches = []
    for cuisine, score in ranked:
        if score >= STRONG_THRESHOLD or score >= top_score * 0.6:
            matches.append(cuisine)
        if len(matches) >= 3:
            break

    if not matches:
        matches = [ranked[0][0]]

    return matches


# ═════════════════════════════════════════════════════════════════════════════
# TIME EXTRACTION
# ═════════════════════════════════════════════════════════════════════════════
TIME_RE = re.compile(
    r'(?:'
    r'(\d+)\s*(?:to|-|or)\s*(\d+)\s*hours?'
    r'|(\d+)\s*hours?\s*(?:and\s*)?(\d+)?\s*minutes?'
    r'|(\d+)\s*hours?'
    r'|(\d+)\s*(?:to|-|or)\s*(\d+)\s*minutes?'
    r'|(\d+)\s*minutes?'
    r')',
    re.IGNORECASE
)

def extract_minutes(text: str) -> list:
    results = []
    for m in TIME_RE.finditer(text):
        g = m.groups()
        if g[0] and g[1]:
            results.append(int((int(g[0]) + int(g[1])) / 2 * 60))
        elif g[2]:
            mins = int(g[2]) * 60 + (int(g[3]) if g[3] else 0)
            results.append(mins)
        elif g[4]:
            results.append(int(g[4]) * 60)
        elif g[5] and g[6]:
            results.append(int((int(g[5]) + int(g[6])) / 2))
        elif g[7]:
            results.append(int(g[7]))
    return [m for m in results if 1 <= m <= 480]


def estimate_cook_time(instructions: str):
    if not instructions:
        return 30, 10, 20

    total_match = re.search(
        r'total\s+time[:\s]+(\d+)\s*(hour|hr|minute|min)',
        instructions, re.I
    )
    if total_match:
        val = int(total_match.group(1))
        unit = total_match.group(2).lower()
        total = val * 60 if 'hour' in unit or unit == 'hr' else val
        prep  = max(5, round(total * 0.3 / 5) * 5)
        cook  = total - prep
        return total, prep, cook

    all_times = extract_minutes(instructions)
    if not all_times:
        return 30, 10, 20

    significant = [t for t in all_times if t >= 5]
    if not significant:
        return 30, 10, 20

    top2 = sorted(significant, reverse=True)[:2]
    total = min(sum(top2), 480)
    total = round(total / 5) * 5
    total = max(10, total)

    prep = max(5, round(total * 0.3 / 5) * 5)
    cook = total - prep

    return total, prep, cook


# ═════════════════════════════════════════════════════════════════════════════
# DIET CLASSIFICATION
# Diet is determined purely from ingredient presence/absence — much more
# mechanical and reliable than cuisine classification, since it doesn't
# require cultural/contextual judgment. A recipe can match multiple diets
# (e.g. a vegan dish is also vegetarian and likely gluten-free).
# ═════════════════════════════════════════════════════════════════════════════
MEAT_FISH_KEYWORDS = [
    "beef","pork","chicken","turkey","lamb","veal","duck","goose","bacon",
    "ham","sausage","prosciutto","pancetta","salami","pepperoni","chorizo",
    "venison","bison","rabbit","mutton","gammon","brisket","steak","rib",
    "meatball","meatloaf",
    "guanciale","speck","capicola","soppressata","mortadella","bresaola",
    "lardon","lardo","pastrami","corned beef","spam",
    "quail","pheasant","ostrich","elk","wild boar","boar","game hen",
    "liver","kidney","tongue","sweetbread","tripe","oxtail","marrow",
    "drumstick","poultry","wing","thigh",
    "fish","salmon","tuna","cod","halibut","tilapia","trout","mackerel",
    "sardine","anchovy","anchovies","bass","snapper","swordfish","mahi",
    "haddock","herring","catfish","sole","flounder","grouper","eel",
    "shrimp","prawn","crab","lobster","scallop","clam","mussel","oyster",
    "squid","octopus","calamari","crawfish","crayfish","urchin",
    "gelatin","lard","tallow","suet","fish sauce","oyster sauce",
    "worcestershire","caviar","foie gras","pate",
]

DAIRY_EGG_KEYWORDS = [
    "milk","cream","butter","cheese","yogurt","yoghurt","ghee","whey",
    "casein","mascarpone","ricotta","mozzarella","parmesan","cheddar",
    "feta","brie","gouda","gruyere","buttermilk","custard",
    "egg","mayonnaise","mayo","meringue","honey",
]

GLUTEN_KEYWORDS = [
    "wheat","flour","barley","rye","malt","semolina","durum","spelt",
    "farro","bulgur","couscous","seitan","bread","breadcrumb","panko",
    "pasta","spaghetti","noodle","macaroni","penne","fettuccine","linguine",
    "lasagna","ravioli","gnocchi","pizza dough","pastry",
    "phyllo","filo","cracker","pretzel","cereal","beer","soy sauce",
    "teriyaki sauce","hoisin","graham cracker","biscuit",
    "cornbread","tortilla","pita","naan","bagel","croissant","wonton",
    "crouton","bun","baguette","focaccia","ciabatta","sourdough",
]

HIGH_CARB_KEYWORDS = [
    "sugar","honey","maple syrup","corn syrup","agave",
    "rice","pasta","spaghetti","noodle","bread","potato","corn","flour",
    "oat","quinoa","barley","couscous","tortilla","bun",
    "bean","lentil","chickpea","banana","mango","grape","raisin",
    "dried fruit","candy","chocolate chip","jam","jelly","ketchup",
    "bbq sauce","cornstarch","breadcrumb","cracker","crouton",
]


def compile_diet_patterns(words):
    # (?:s|es)? handles common English plurals while still respecting
    # word boundaries — "breadcrumb" matches "breadcrumbs" but "ham"
    # still correctly does NOT match inside "hamburger".
    return [
        (w, re.compile(r'\b' + re.escape(w) + r'(?:s|es)?\b', re.IGNORECASE))
        for w in words
    ]

MEAT_PATTERNS   = compile_diet_patterns(MEAT_FISH_KEYWORDS)
DAIRY_PATTERNS  = compile_diet_patterns(DAIRY_EGG_KEYWORDS)
GLUTEN_PATTERNS = compile_diet_patterns(GLUTEN_KEYWORDS)
CARB_PATTERNS   = compile_diet_patterns(HIGH_CARB_KEYWORDS)

# Naturally gluten-free flour types — stripped from the text before the
# generic "flour" keyword check runs, so "chickpea flour" or "almond flour"
# don't get falsely flagged as containing gluten just for the word "flour".
GF_FLOUR_EXEMPTIONS = re.compile(
    r'\b(?:chickpea|almond|coconut|rice|oat|tapioca|arrowroot|buckwheat|'
    r'corn|potato|cassava|gluten[\s-]free)\s+flour\b',
    re.IGNORECASE
)


def classify_diets(ingredients_text: str) -> list:
    """
    Returns a list of diet tags this recipe qualifies for, based purely
    on ingredient presence/absence. A recipe can match multiple diets.
    """
    text = ingredients_text
    # Strip naturally-GF flour mentions before the gluten check so they
    # don't falsely trigger on the bare word "flour".
    gluten_check_text = GF_FLOUR_EXEMPTIONS.sub("", text)

    has_meat_fish = any(p.search(text) for _, p in MEAT_PATTERNS)
    has_dairy_egg = any(p.search(text) for _, p in DAIRY_PATTERNS)
    has_gluten    = any(p.search(gluten_check_text) for _, p in GLUTEN_PATTERNS)
    has_high_carb = any(p.search(text) for _, p in CARB_PATTERNS)

    diets = []
    is_vegetarian = not has_meat_fish
    is_vegan      = is_vegetarian and not has_dairy_egg

    if is_vegetarian:     diets.append("vegetarian")
    if is_vegan:          diets.append("vegan")
    if not has_gluten:    diets.append("gluten free")
    if not has_high_carb: diets.append("ketogenic")

    return diets


# ═════════════════════════════════════════════════════════════════════════════
# HEALTHINESS SCORING
# Reference: FDA's Dec 19, 2024 "healthy" claim rule (21 CFR 101.65).
# A food qualifies as "healthy" if it (1) contains a meaningful amount of
# a real food group (fruit, vegetable, whole grain, lean protein, low-fat
# dairy) and (2) stays under limits for saturated fat, sodium, and ADDED
# sugar. Critically, the FDA rule explicitly EXCLUDES fat inherent in
# seafood, nuts, seeds, and soy — olive oil, salmon, avocado, and tahini
# are NOT penalized the way butter/lard are, even though all contain fat.
# Only ADDED sugar counts against the limit, not sugar naturally
# occurring in whole fruit. This mirrors that real distinction instead
# of penalizing any ingredient just because it "contains fat" or
# "contains sugar" — so hummus and homemade fruit juice score well,
# while fried "vegetable chips" score poorly despite the healthy-sounding
# name, because frying is what actually determines the outcome.
# ═════════════════════════════════════════════════════════════════════════════

# Reference: FDA's Dec 19, 2024 "healthy" claim rule (21 CFR 101.65)
# A food qualifies as "healthy" if it:
#   1. Contains a meaningful amount of a real food group
#      (fruit, vegetable, whole grain, lean protein, low-fat dairy)
#   2. Stays under limits for saturated fat, sodium, and ADDED sugar
#      — critically, the FDA rule explicitly EXCLUDES saturated fat
#        that's inherent in seafood, nuts, seeds, and soy (olive oil,
#        salmon, avocado, tahini are NOT penalized the way butter/lard
#        are, even though all contain fat)
#      — only ADDED sugar counts against the limit, not sugar naturally
#        occurring in whole fruit
# This script mirrors that real distinction rather than penalizing
# any ingredient just because it "contains fat" or "contains sugar".
# ═══════════════════════════════════════════════════════════

# ── Real food groups (FDA's actual qualifying categories) — POSITIVE ──
VEGETABLE_KEYWORDS = [
    "spinach","kale","broccoli","cauliflower","zucchini","cucumber","carrot",
    "celery","pepper","tomato","onion","garlic","mushroom","eggplant",
    "asparagus","artichoke","beet","radish","squash","pumpkin","cabbage",
    "lettuce","arugula","chard","leek","fennel","brussels sprout",
    "green bean","pea","corn","sweet potato","potato","bok choy",
]
FRUIT_KEYWORDS = [
    "apple","banana","orange","lemon","lime","berry","strawberry","blueberry",
    "raspberry","blackberry","grape","mango","pineapple","peach","pear",
    "plum","cherry","melon","watermelon","kiwi","pomegranate","fig",
    "apricot","papaya","fruit",
]
WHOLE_GRAIN_KEYWORDS = [
    "whole wheat","whole grain","brown rice","quinoa","oat","barley",
    "farro","bulgur","buckwheat","wild rice","whole grain bread",
]
LEAN_PROTEIN_KEYWORDS = [
    "chicken breast","turkey breast","salmon","tuna","cod","halibut",
    "tilapia","shrimp","tofu","tempeh","lentil","chickpea","black bean",
    "kidney bean","egg white","egg","white fish","white meat",
]
LOWFAT_DAIRY_KEYWORDS = [
    "low fat","nonfat","fat free","skim milk","greek yogurt","plain yogurt",
]
LEGUME_KEYWORDS = [
    "lentil","chickpea","black bean","kidney bean","pinto bean","white bean",
    "split pea","edamame",
]

# ── Healthy fats — explicitly EXEMPT per FDA rule, NOT penalized ──
HEALTHY_FAT_KEYWORDS = [
    "olive oil","avocado","tahini","sesame oil","almond","walnut","cashew",
    "pistachio","peanut","flaxseed","chia seed","salmon","tuna","sardine",
    "mackerel","trout","soy","tofu","edamame","hummus",
]

# ── Saturated-fat-heavy — these ARE penalized per FDA rule ──
SAT_FAT_KEYWORDS = [
    "butter","lard","tallow","suet","heavy cream","whipping cream",
    "cream cheese","cheddar","mozzarella","parmesan","brie","mascarpone",
    "coconut oil","coconut cream","coconut milk","bacon","sausage",
    "pancetta","prosciutto","salami","chorizo","ground beef","beef brisket",
    "ribeye","pork belly","duck fat","shortening","margarine",
]

# ── ADDED sugar — penalized. Distinguished from natural fruit sugar ──
ADDED_SUGAR_KEYWORDS = [
    "sugar","brown sugar","powdered sugar","icing sugar","corn syrup",
    "maple syrup","honey","agave","molasses","caramel","chocolate chip",
    "candy","marshmallow","condensed milk","frosting","icing",
]
# Whole-fruit / 100%-fruit contexts that should NOT count as "added sugar"
NATURAL_SUGAR_CONTEXT = re.compile(
    r'\b(fresh|whole|ripe)\s+(fruit|apple|banana|orange|berry|mango|peach|pineapple)\b'
    r'|\b100%\s*(fruit|juice)\b'
    r'|\bfruit\s+juice\b(?!\s*concentrate)',
    re.IGNORECASE
)

# ── Sodium-heavy — mild penalty only, never a hard disqualifier ──
SODIUM_KEYWORDS = [
    "salt","soy sauce","fish sauce","bouillon","stock cube","cured",
    "pickled","brined","broth","parmesan","feta","soy sauce",
]

# ── Cooking method red flags — heavy penalty regardless of ingredients ──
FRYING_KEYWORDS = [
    "deep fry","deep-fry","deep fried","deep-fried","fry until crisp",
    "fried until golden","pan fry","pan-fry","shallow fry","fritter",
    "tempura","breaded and fried","crispy fried","fry in oil",
]
# Note: plain "fry"/"sauté" with a small amount of oil for aromatics
# (garlic, onion) is normal cooking technique, not a health red flag —
# only counted when paired with frying-specific phrasing above.

# Dessert/sweet category — title signal that the dish is sugar/fat-dense
DESSERT_KEYWORDS = [
    "cake","cookie","brownie","pie","tart","cupcake","donut","doughnut",
    "candy","fudge","truffle","pastry","cheesecake","pudding","custard",
    "ice cream","sorbet","mousse","macaron","muffin",
]


def compile_patterns(words):
    return [re.compile(r'\b' + re.escape(w) + r'(?:s|es)?\b', re.IGNORECASE) for w in words]

VEG_P    = compile_patterns(VEGETABLE_KEYWORDS)
FRUIT_P  = compile_patterns(FRUIT_KEYWORDS)
GRAIN_P  = compile_patterns(WHOLE_GRAIN_KEYWORDS)
PROTEIN_P = compile_patterns(LEAN_PROTEIN_KEYWORDS)
DAIRY_P  = compile_patterns(LOWFAT_DAIRY_KEYWORDS)
LEGUME_P = compile_patterns(LEGUME_KEYWORDS)
HFAT_P   = compile_patterns(HEALTHY_FAT_KEYWORDS)
SATFAT_P = compile_patterns(SAT_FAT_KEYWORDS)
SUGAR_P  = compile_patterns(ADDED_SUGAR_KEYWORDS)
SODIUM_P = compile_patterns(SODIUM_KEYWORDS)
FRY_P    = compile_patterns(FRYING_KEYWORDS)
DESSERT_P = compile_patterns(DESSERT_KEYWORDS)


def count_matches(patterns, text):
    return sum(1 for p in patterns if p.search(text))


# Negation phrases that mean an ingredient is explicitly ABSENT —
# must be stripped before keyword counting, or "no added sugar" would
# incorrectly count as containing sugar.
NEGATION_PATTERNS = re.compile(
    r"\b(?:no|without|zero|free of)\s+(?:added\s+)?(sugar|salt|sodium|oil|fat)s?\b"
    r"|\b(sugar|salt|sodium|fat)[\s-]free\b"
    r"|\bunsweetened\b"
    r"|\blow[\s-](sugar|salt|sodium|fat)\b",
    re.IGNORECASE
)

def strip_negations(text: str) -> str:
    return NEGATION_PATTERNS.sub(" ", text)


def calculate_health_score(title: str, ingredients_text: str, instructions: str) -> int:
    """
    Returns a 0-100 healthiness score based on the FDA's Dec 2024
    'healthy' claim criteria: food group presence (positive) vs
    saturated fat / added sugar / sodium / frying (negative).

    Healthy fats (olive oil, nuts, fish, avocado, tahini) are NOT
    penalized — matching the FDA's explicit exemption. Natural fruit
    sugar is NOT penalized as "added sugar". Frying is penalized
    regardless of the core ingredient (catches "vegetable chips").
    """
    title_l = title.lower()
    raw_text = f"{ingredients_text} {instructions}".lower()
    text     = strip_negations(raw_text)  # remove 'no added sugar' etc before counting

    score = 50  # neutral baseline

    # ── POSITIVE: real food groups present ──
    veg_count    = count_matches(VEG_P, text)
    fruit_count  = count_matches(FRUIT_P, text)
    grain_count  = count_matches(GRAIN_P, text)
    protein_count = count_matches(PROTEIN_P, text)
    dairy_count  = count_matches(DAIRY_P, text)
    legume_count = count_matches(LEGUME_P, text)
    hfat_count   = count_matches(HFAT_P, text)

    if veg_count    > 0: score += min(15, veg_count * 4)
    if fruit_count  > 0: score += min(15, fruit_count * 5)
    if grain_count  > 0: score += 10
    if protein_count > 0: score += 10
    if dairy_count  > 0: score += 5
    if legume_count > 0: score += 8
    if hfat_count   > 0: score += 5   # healthy fats are a small bonus, not a penalty

    # Explicit 100%/fresh-squeezed/homemade juice or whole-fruit framing —
    # a direct positive signal, not just an exemption from the sugar penalty.
    # Addresses the common misconception that fruit juice is unhealthy.
    if NATURAL_SUGAR_CONTEXT.search(raw_text):
        score += 10

    # "Clean recipe" bonus: if there are NO negative signals at all
    # (no sat fat, no added sugar, no high sodium, no frying) AND at
    # least one real food group is present, the recipe shouldn'''t be
    # stuck near neutral just because it has few total keyword matches.
    has_any_negative = (
        count_matches(SATFAT_P, text) > 0 or
        count_matches(SUGAR_P, text) > 0 or
        count_matches(FRY_P, text) > 0
    )
    has_any_food_group = (veg_count + fruit_count + grain_count +
                           protein_count + legume_count) > 0
    if not has_any_negative and has_any_food_group:
        score += 10

    # ── NEGATIVE: saturated fat (does NOT include healthy fats) ──
    satfat_count = count_matches(SATFAT_P, text)
    score -= min(25, satfat_count * 6)

    # ── NEGATIVE: added sugar (skip if context is whole/natural fruit) ──
    if not NATURAL_SUGAR_CONTEXT.search(text):
        sugar_count = count_matches(SUGAR_P, text)
        score -= min(25, sugar_count * 6)
    else:
        # Still check for OTHER added sugar beyond the natural fruit context
        sugar_count = count_matches(SUGAR_P, text)
        score -= min(10, sugar_count * 3)  # reduced penalty

    # ── NEGATIVE: sodium (mild weight only, never disqualifying alone) ──
    sodium_count = count_matches(SODIUM_P, text)
    score -= min(10, sodium_count * 2)

    # ── NEGATIVE: frying as cooking method (catches "vegetable chips") ──
    if count_matches(FRY_P, text) > 0:
        score -= 20

    # ── NEGATIVE: dessert category (title-level signal, catches cake) ──
    if any(p.search(title_l) for p in DESSERT_P):
        score -= 15

    return max(0, min(100, round(score)))


# ═════════════════════════════════════════════════════════════════════════════
# SERVINGS EXTRACTION
# ═════════════════════════════════════════════════════════════════════════════
SERVINGS_RE = re.compile(
    r'(?:'
    r'(?:serves?|serving[s]?)\s+(\d+)'
    r'|(\d+)\s+servings?'
    r'|makes?\s+(\d+)\s+(?:servings?|portions?)'
    r'|yields?\s*:?\s*(\d+)'
    r'|(?:for|feeds?)\s+(\d+)\s+people'
    r'|(\d+)\s+portions?'
    r')',
    re.IGNORECASE
)

def extract_servings(title: str, instructions: str, ingredients_text: str):
    text = f"{title} {instructions} {ingredients_text}"

    for m in SERVINGS_RE.finditer(text):
        for g in m.groups():
            if g:
                n = int(g)
                if 1 <= n <= 24:
                    return n

    m = re.search(r'\bmakes?\s+(\d+)\b', text, re.I)
    if m:
        n = int(m.group(1))
        if 1 <= n <= 24:
            return n

    return None


# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    total_docs = col.count_documents({})
    print(f"\n[+] Processing {total_docs:,} recipes...")
    if args.dry_run:
        print("    [DRY RUN — no changes will be written]")

    cuisine_counts   = defaultdict(int)
    multi_cuisine_count = 0
    diet_counts      = defaultdict(int)
    health_score_total   = 0
    health_score_buckets = defaultdict(int)
    time_extracted   = 0
    serving_extracted = 0
    ops = []
    BATCH = 500

    cursor = col.find({}, {
        "_id": 1, "title": 1, "ingredients": 1, "instructions": 1
    }, batch_size=500)

    if args.limit:
        cursor = itertools.islice(cursor, args.limit)
        total_docs = args.limit

    with tqdm(total=total_docs, desc="Classifying") as pbar:
        for recipe in cursor:
            title       = recipe.get("title", "")
            ingredients = recipe.get("ingredients", [])
            instructions_raw = recipe.get("instructions", [])

            if isinstance(instructions_raw, list):
                instructions = " ".join(
                    s.get("step", "") if isinstance(s, dict) else str(s)
                    for s in instructions_raw
                )
            else:
                instructions = str(instructions_raw) if instructions_raw else ""

            ing_text = " ".join(
                str(i.get("raw") or i.get("name", ""))
                for i in ingredients
            )

            cuisines = classify_cuisines(title, ingredients, instructions)
            for c in cuisines:
                cuisine_counts[c] += 1
            if len(cuisines) > 1:
                multi_cuisine_count += 1

            diets = classify_diets(ing_text)
            for d in diets:
                diet_counts[d] += 1

            health_score = calculate_health_score(title, ing_text, instructions)
            health_score_total += health_score
            health_score_buckets[health_score // 10 * 10] += 1

            ready, prep, cook = estimate_cook_time(instructions)
            if ready != 30:
                time_extracted += 1

            servings = extract_servings(title, instructions, ing_text)
            if servings:
                serving_extracted += 1
            else:
                servings = 4

            if not args.dry_run:
                ops.append(UpdateOne(
                    {"_id": recipe["_id"]},
                    {"$set": {
                        "cuisines":           cuisines,   # plural array
                        "cuisine":            cuisines[0],  # keep singular for backward compat
                        "diets":              diets,
                        "healthScore":        health_score,
                        "readyInMinutes":     ready,
                        "preparationMinutes": prep,
                        "cookingMinutes":     cook,
                        "servings":           servings,
                    }}
                ))

                if len(ops) >= BATCH:
                    col.bulk_write(ops, ordered=False)
                    ops.clear()

            pbar.update(1)

    if ops and not args.dry_run:
        col.bulk_write(ops, ordered=False)

    processed = args.limit or total_docs
    print(f"\n{'='*55}")
    print(f"  Recipes processed     : {processed:,}")
    print(f"  Multi-cuisine recipes : {multi_cuisine_count:,}  ({multi_cuisine_count/processed*100:.1f}%)")
    print(f"  Times extracted       : {time_extracted:,}  ({time_extracted/processed*100:.1f}%)")
    print(f"  Servings extracted    : {serving_extracted:,}  ({serving_extracted/processed*100:.1f}%)")
    print(f"\n  Cuisine breakdown (recipes can count toward multiple):")
    for cuisine, count in sorted(cuisine_counts.items(), key=lambda x: -x[1]):
        pct = count / processed * 100
        bar = "=" * int(pct / 2)
        print(f"    {cuisine:<20} {count:>5}  ({pct:5.1f}%)  {bar}")

    print(f"\n  Diet breakdown (recipes can count toward multiple):")
    for diet, count in sorted(diet_counts.items(), key=lambda x: -x[1]):
        pct = count / processed * 100
        bar = "=" * int(pct / 2)
        print(f"    {diet:<20} {count:>5}  ({pct:5.1f}%)  {bar}")

    avg_health = health_score_total / processed
    print(f"\n  Health score distribution (avg: {avg_health:.1f}/100):")
    for bucket in sorted(health_score_buckets.keys(), reverse=True):
        count = health_score_buckets[bucket]
        pct = count / processed * 100
        bar = "=" * int(pct / 2)
        label = f"{bucket}-{bucket+9}"
        print(f"    {label:<10} {count:>5}  ({pct:5.1f}%)  {bar}")

    if args.dry_run:
        print("\n  [DRY RUN] No changes written. Remove --dry-run to apply.")
    else:
        print(f"\n[+] Done! All {processed:,} recipes updated in MongoDB.")
        col.create_index("cuisines", background=True)
        col.create_index("diets", background=True)
        col.create_index("healthScore", background=True)
        print("[+] Indexes created on 'cuisines', 'diets', and 'healthScore' fields.")

    client.close()


if __name__ == "__main__":
    main()
