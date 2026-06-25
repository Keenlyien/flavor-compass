"""
seed_ingredient_images.py
=========================
Pre-populates the ingredient_images collection in MongoDB with image URLs
for every unique ingredient in the recipes collection.

Sources (in priority order):
  1. TheMealDB CDN  - illustrated food images, no key needed
  2. Spoonacular CDN - photo images, ~5,000 ingredients, no key needed

Run:
  pip install pymongo requests python-dotenv tqdm certifi
  python seed_ingredient_images.py

Options:
  --workers N   Concurrent HTTP workers (default: 15)
  --limit N     Only process first N unique names (for testing)
  --reset       Drop existing ingredient_images cache before running
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import re
import os
import time
import argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter
from datetime import datetime, timezone

import certifi
import requests
from pymongo import MongoClient, UpdateOne
from tqdm import tqdm

try:
    from dotenv import load_dotenv
    load_dotenv(Path("D:/projects/digital_chef/.env.local"))
except ImportError:
    pass

# ---- MongoDB ----------------------------------------------------------------
MONGO_URI = os.environ.get("MONGODB_URI", "")
MONGO_DB  = os.environ.get("MONGODB_DB", "digital_chef")
if not MONGO_URI:
    sys.exit("MONGODB_URI not set. Add it to .env.local or export it.")

client  = MongoClient(
    MONGO_URI,
    tlsCAFile=certifi.where(),
    socketTimeoutMS=180000,
    connectTimeoutMS=60000,
    serverSelectionTimeoutMS=60000,
)
db      = client[MONGO_DB]
recipes = db["recipes"]
images  = db["ingredient_images"]

# ---- Parser (mirrors TypeScript route exactly) ------------------------------
REJECT_PATTERNS = [
    re.compile(r'^\s*(for\s+)?(serving|garnish|garnishing|coating|topping|drizzling|sprinkling)\s*$', re.I),
    re.compile(r'^\s*(to\s+)?taste\s*$', re.I),
    re.compile(r'^\s*(divided|beaten|softened|melted|sifted|thawed|drained|optional|needed)\s*$', re.I),
    re.compile(r'^\s*equipment\s*:?\s*$', re.I),
    re.compile(r'^\s*for\s+(serving|garnish|coating|drizzling|topping)\b', re.I),
    re.compile(r'^\s*plus\s+more\s+(for\s+)?(serving|garnish)', re.I),
    re.compile(r'\bto\s+taste\s*$', re.I),
    re.compile(r'\bsalt\s+and\b', re.I),
    re.compile(r'\band\s+pepper\b', re.I),
    re.compile(r'\band\s+freshly\b', re.I),
    re.compile(r'^\s*(or\s+more|plus\s+more|as\s+needed|if\s+desired|to\s+serve)\s*$', re.I),
]

NORMALIZATIONS = [
    (re.compile(r'\bkosher\s+salt\s+and\s+freshly\s+ground\s+black\s+pepper\b', re.I), "REJECT"),
    (re.compile(r'\bsalt\s+and\s+(freshly\s+)?ground\s+black\s+pepper\b', re.I), "REJECT"),
    (re.compile(r'\bsalt\s+and\s+pepper\b', re.I), "REJECT"),
    (re.compile(r'\bfor\s+(serving|garnish|garnishing|coating|topping)\b', re.I), ""),
    (re.compile(r'\bto\s+taste\b', re.I), ""),
    (re.compile(r'\bdivided\b', re.I), ""),
    (re.compile(r'\bequipment\s*:?\b', re.I), ""),
    (re.compile(r'\bplus\s+more\s+for\s+\w+\b', re.I), ""),
    # Meat cuts
    (re.compile(r'\bbone[\s-]?in\s+(pork|chicken|beef|lamb)\b', re.I), lambda m: m.group(1)),
    (re.compile(r'\bpork\s+(shoulder(\s+half)?|belly|loin|chops?|tenderloin|ribs?|butt|roast|ham|leg)\b', re.I), "pork"),
    (re.compile(r'\bbone[\s-]?in\s+fresh\s+pork\b', re.I), "pork"),
    (re.compile(r'\bbeef\s+(chuck|brisket|rib|roast|sirloin|tenderloin|flank|skirt|round|rump|shank)\b', re.I), "beef"),
    (re.compile(r'\brib[\s-]?eye(\s+steak)?\b', re.I), "beef"),
    (re.compile(r'\b(strip|flank|skirt|hanger)\s+steak\b', re.I), "beef"),
    (re.compile(r'\bground\s+(beef|pork|turkey|lamb|chicken)\b', re.I), lambda m: m.group(1)),
    (re.compile(r'\blamb\s+(chops?|leg|shoulder|rack|shanks?|loin)\b', re.I), "lamb"),
    (re.compile(r'\bchicken\s+(breast|thigh|drumstick|wing|leg|quarter|cutlet|tender|strip)s?\b', re.I), "chicken"),
    (re.compile(r'\bboneless\s+(skinless\s+)?chicken\b', re.I), "chicken"),
    (re.compile(r'\bskinless\s+chicken\b', re.I), "chicken"),
    (re.compile(r'\bprawns?\b', re.I), "shrimp"),
    # Salt & pepper
    (re.compile(r'\bfreshly\s+ground\s+black\s+pepper\b', re.I), "black pepper"),
    (re.compile(r'\bfreshly\s+ground\s+white\s+pepper\b', re.I), "white pepper"),
    (re.compile(r'\bfreshly\s+ground\s+pepper\b', re.I), "black pepper"),
    (re.compile(r'\bground\s+black\s+pepper\b', re.I), "black pepper"),
    (re.compile(r'\bblack\s+pepper(corns?)?\b', re.I), "black pepper"),
    (re.compile(r'\bwhite\s+pepper(corns?)?\b', re.I), "white pepper"),
    (re.compile(r'\bred\s+pepper\s+flakes?\b', re.I), "chilli flakes"),
    (re.compile(r'\bcayenne\s+pepper\b', re.I), "cayenne pepper"),
    (re.compile(r'\bkosher\s+salt\b', re.I), "salt"),
    (re.compile(r'\b(sea|coarse|fine|flaky|flaked|table|iodized)\s+salt\b', re.I), "salt"),
    # Chilli
    (re.compile(r'\bpoblano\s+chil(e|i)(s|es)?\b', re.I), "chilli"),
    (re.compile(r'\bserrano\s+chil(e|i)(s|es)?\b', re.I), "chilli"),
    (re.compile(r'\bchipotle\s+chil(e|i)(s|es)?\b', re.I), "chipotle"),
    (re.compile(r'\bchiles?\s+en\s+adobo\b', re.I), "chipotle"),
    (re.compile(r'\bchil(e|i)(s|es)?\b', re.I), "chilli"),
    (re.compile(r'\bjalape[nn]os?\b', re.I), "jalapeno"),
    (re.compile(r'\bchili\s+powder\b', re.I), "chilli powder"),
    # Oils
    (re.compile(r'\bnonstick\s+(vegetable\s+)?(oil\s+)?(cooking\s+)?spray\b', re.I), "cooking spray"),
    (re.compile(r'\b(olive|vegetable|canola)\s+oil\s+(cooking\s+)?spray\b', re.I), "cooking spray"),
    (re.compile(r'\bcooking\s+spray\b', re.I), "cooking spray"),
    (re.compile(r'\bextra[\s-]virgin\s+olive\s+oil\b', re.I), "olive oil"),
    (re.compile(r'\bolive\s+oil\b', re.I), "olive oil"),
    (re.compile(r'\btoasted\s+sesame\s+oil\b', re.I), "sesame oil"),
    (re.compile(r'\bsesame\s+oil\b', re.I), "sesame oil"),
    (re.compile(r'\b(vegetable|canola|sunflower|grapeseed|corn)\s+oil\b', re.I), "vegetable oil"),
    (re.compile(r'\bcoconut\s+oil\b', re.I), "coconut oil"),
    # Flour
    (re.compile(r'\b(all[\s-]purpose|ap|plain|sifted|unbleached)\s+flour\b', re.I), "flour"),
    (re.compile(r'\bself[\s-]rais(e|ing)\s+flour\b', re.I), "self raising flour"),
    (re.compile(r'\bwhole\s+wheat\s+flour\b', re.I), "wholemeal flour"),
    (re.compile(r'\balmond\s+flour\b', re.I), "ground almonds"),
    # Sugar
    (re.compile(r'\b(granulated|caster|white|raw)\s+sugar\b', re.I), "sugar"),
    (re.compile(r'\b(light|dark)?\s*brown\s+sugar\b', re.I), "brown sugar"),
    (re.compile(r'\b(powdered|confectioners?|icing)\s+sugar\b', re.I), "icing sugar"),
    # Dairy
    (re.compile(r'\b(unsalted|salted|cold|melted|softened)\s+butter\b', re.I), "butter"),
    (re.compile(r'\bheavy\s+(whipping\s+)?cream\b', re.I), "heavy cream"),
    (re.compile(r'\b(whipping|double)\s+cream\b', re.I), "heavy cream"),
    (re.compile(r'\bsour\s+cream\b', re.I), "sour cream"),
    (re.compile(r'\bcream\s+cheese\b', re.I), "cream cheese"),
    (re.compile(r'\bhalf[\s-]and[\s-]half\b', re.I), "cream"),
    (re.compile(r'\bcoconut\s+milk\b', re.I), "coconut milk"),
    # Eggs
    (re.compile(r'\begg\s+whites?\b', re.I), "egg white"),
    (re.compile(r'\begg\s+yolks?\b', re.I), "egg yolk"),
    # Cheese
    (re.compile(r'\b(finely|freshly|grated)?\s*grated\s+parmesan(o(\s+reggiano)?)?\b', re.I), "parmesan"),
    (re.compile(r'\bpecorino(\s+romano)?\b', re.I), "parmesan"),
    (re.compile(r'\bgoat\s+cheese\b', re.I), "goat cheese"),
    (re.compile(r'\bfeta(\s+cheese)?\b', re.I), "feta"),
    (re.compile(r'\bcheddar(\s+cheese)?\b', re.I), "cheddar"),
    # Citrus
    (re.compile(r'\b(finely|freshly|grated)?\s*grated\s+lemon\s+(zest|peel)\b', re.I), "lemon zest"),
    (re.compile(r'\blemon\s+(zest|peel)\b', re.I), "lemon zest"),
    (re.compile(r'\borange\s+zest\b', re.I), "orange"),
    # Extracts & syrups
    (re.compile(r'\bpure\s+vanilla\s+extract\b', re.I), "vanilla extract"),
    (re.compile(r'\bvanilla\s+extract\b', re.I), "vanilla extract"),
    (re.compile(r'\bpure\s+almond\s+extract\b', re.I), "almond extract"),
    (re.compile(r'\bpure\s+maple\s+syrup\b', re.I), "maple syrup"),
    (re.compile(r'\bmaple\s+syrup\b', re.I), "maple syrup"),
    # Baking
    (re.compile(r'\bbaking\s+soda\b', re.I), "baking soda"),
    (re.compile(r'\bbaking\s+powder\b', re.I), "baking powder"),
    (re.compile(r'\b(corn)?starch\b', re.I), "corn starch"),
    (re.compile(r'\b(unsweetened\s+)?cocoa\s+powder\b', re.I), "cocoa powder"),
    (re.compile(r'\b(bittersweet|semi[\s-]sweet|dark)\s+chocolate\b', re.I), "dark chocolate"),
    (re.compile(r'\b(instant|active\s+dry|dry)\s+yeast\b', re.I), "yeast"),
    # Stock & broth
    (re.compile(r'\b(low[\s-]sodium\s+|reduced[\s-]sodium\s+)?(chicken|beef|vegetable|fish)\s+(broth|stock)\b', re.I),
        lambda m: m.group(2) + " stock"),
    # Sauces
    (re.compile(r'\b(low[\s-]sodium\s+|reduced[\s-]sodium\s+)?soy\s+sauce\b', re.I), "soy sauce"),
    (re.compile(r'\bfish\s+sauce\b', re.I), "fish sauce"),
    (re.compile(r'\bhot\s+sauce\b', re.I), "hot sauce"),
    (re.compile(r'\btomato\s+paste\b', re.I), "tomato puree"),
    (re.compile(r'\btomato\s+(puree|sauce)\b', re.I), "tomato puree"),
    (re.compile(r'\bdijon\s+mustard\b', re.I), "dijon mustard"),
    (re.compile(r'\bapple\s+cider\s+vinegar\b', re.I), "apple cider vinegar"),
    (re.compile(r'\bbalsamic\s+vinegar\b', re.I), "balsamic vinegar"),
    (re.compile(r'\bred\s+wine\s+vinegar\b', re.I), "red wine vinegar"),
    (re.compile(r'\bwhite\s+wine\s+vinegar\b', re.I), "white wine vinegar"),
    (re.compile(r'\brice\s+(wine\s+)?vinegar\b', re.I), "rice vinegar"),
    # Herbs
    (re.compile(r'\bflat[\s-]?leaf\s+parsley\b', re.I), "parsley"),
    (re.compile(r'\bcilantro\b', re.I), "coriander"),
    (re.compile(r'\bscallions?\b', re.I), "spring onion"),
    (re.compile(r'\bgreen\s+onions?\b', re.I), "spring onion"),
    (re.compile(r'\b(fresh|dried)\s+(parsley|thyme|basil|rosemary|sage|dill|mint|oregano|coriander|chives?)\b', re.I),
        lambda m: m.group(2)),
    (re.compile(r'\b(thyme|rosemary|mint|basil)\s+(leaves?|sprigs?)\b', re.I), lambda m: m.group(1)),
    (re.compile(r'\bbay\s+leaves?\b', re.I), "bay leaf"),
    # Vegetables
    (re.compile(r'\bred\s+onion\b', re.I), "red onion"),
    (re.compile(r'\b(yellow|white|sweet)\s+onion\b', re.I), "onion"),
    (re.compile(r'\b(red|green|yellow)\s+bell\s+pepper\b', re.I), lambda m: m.group(1).lower() + " pepper"),
    (re.compile(r'\bbell\s+pepper\b', re.I), "red pepper"),
    (re.compile(r'\b(cherry|plum|heirloom|roma)\s+tomatoes?\b', re.I), "tomatoes"),
    (re.compile(r'\bsun[\s-]dried\s+tomatoes?\b', re.I), "sun-dried tomatoes"),
    (re.compile(r'\bchick[\s-]?peas?\b', re.I), "chickpeas"),
    (re.compile(r'\bgarbanzo\s+beans?\b', re.I), "chickpeas"),
    (re.compile(r'\bblack\s+beans?\b', re.I), "black beans"),
    (re.compile(r'\bkidney\s+beans?\b', re.I), "kidney beans"),
    (re.compile(r'\bgreen\s+beans?\b', re.I), "green beans"),
    (re.compile(r'\bgarlic\s+cloves?\b', re.I), "garlic"),
    (re.compile(r'\bminced\s+garlic\b', re.I), "garlic"),
    (re.compile(r'\bsweet\s+potatoes?\b', re.I), "sweet potato"),
    (re.compile(r'\bbaby\s+spinach\b', re.I), "spinach"),
    (re.compile(r'\b(baby\s+)?arugula\b', re.I), "rocket"),
    (re.compile(r'\bcelery\s+stalks?\b', re.I), "celery"),
    (re.compile(r'\bbok\s+choy\b', re.I), "bok choy"),
    # Nuts & seeds
    (re.compile(r'\b(toasted|slivered|sliced|ground|blanched)\s+almonds?\b', re.I), "almonds"),
    (re.compile(r'\b(toasted\s+)?sesame\s+seeds?\b', re.I), "sesame seeds"),
    (re.compile(r'\bpine\s+nuts?\b', re.I), "pine nuts"),
    (re.compile(r'\bcashew(\s+nuts?)?\b', re.I), "cashew nuts"),
    (re.compile(r'\bpistachios?\b', re.I), "pistachio"),
    # Grains
    (re.compile(r'\b(long[\s-]grain|short[\s-]grain|jasmine|basmati|brown|wild|arborio)\s+rice\b', re.I), "rice"),
    (re.compile(r'\b(panko|dry|fresh)?\s*bread[\s-]?crumbs?\b', re.I), "breadcrumbs"),
    (re.compile(r'\bpanko\b', re.I), "breadcrumbs"),
    (re.compile(r'\b(rolled|quick[\s-]cooking|old[\s-]fashioned)\s+oats?\b', re.I), "oats"),
    # Spices
    (re.compile(r'\bground\s+(cinnamon|cumin|coriander|nutmeg|ginger|cardamom|turmeric|allspice)\b', re.I),
        lambda m: m.group(1)),
    (re.compile(r'\bfreshly\s+grated\s+nutmeg\b', re.I), "nutmeg"),
    (re.compile(r'\b(smoked|sweet)\s+paprika\b', re.I), "paprika"),
    (re.compile(r'\bgarlic\s+powder\b', re.I), "garlic granules"),
    (re.compile(r'\bonion\s+powder\b', re.I), "onion powder"),
    (re.compile(r'\bgaram\s+masala\b', re.I), "garam masala"),
    (re.compile(r'\bcurry\s+powder\b', re.I), "curry powder"),
    # Cider & wine
    (re.compile(r'\b(unfiltered\s+|hard\s+)?apple\s+cider\b', re.I), "cider"),
    (re.compile(r'\bdry\s+(white|red)\s+wine\b', re.I), lambda m: m.group(1).lower() + " wine"),
    # Misc
    (re.compile(r'\b(canned\s+)?pure\s+pumpkin\b', re.I), "pumpkin"),
    (re.compile(r'\b(light|dark)\s+corn\s+syrup\b', re.I), "corn syrup"),
    (re.compile(r'\bgolden\s+raisins?\b', re.I), "raisins"),
    (re.compile(r'\bsultanas?\b', re.I), "raisins"),
    (re.compile(r'\b(plain|greek|nonfat)\s+yogurt\b', re.I), "yogurt"),
    (re.compile(r'\b(instant\s+)?espresso(\s+powder)?\b', re.I), "espresso"),
]

STRIP_WORDS = {
    "a","an","the","of","in","at","by","on","with","from","into","such","as","if",
    "about","around","up","or","and","to","for","approximately","roughly","just",
    "least","plus","more","less","extra","additional","another","any","other",
    "fresh","dried","frozen","canned","whole","raw","ripe","cooked","prepared",
    "store","bought","homemade","ready","made","warm","cold","chilled","room",
    "temperature","large","small","medium","mini","tiny","big","baby","young",
    "unsalted","salted","organic","natural","pure","virgin","low","high","reduced",
    "full","fat","free","range","lean","lite","light","dark","nonstick","sodium",
    "defatted","refined","unrefined","plain","regular","classic","style","grain",
    "unfiltered","bone","boneless","skinless","skin","preferably","arm","picnic",
    "thick","thin","lengthwise","widthwise","diagonal","crosswise","peeled",
    "pitted","seeded","deveined","trimmed","butterflied","split","shelled","hulled",
    "husked","marinated","candied","softened","melted","beaten","whipped","sifted",
    "packed","heaped","level","scant","generous","rinsed","drained","thawed",
    "squeezed","zested","juiced","strained","toasted","roasted","smoked","pickled",
    "chopped","minced","diced","sliced","cubed","halved","quartered","crumbled",
    "shredded","ground","crushed","mashed","torn","cut","finely","freshly",
    "lightly","thinly","coarsely","gently","slightly","evenly","well","very",
    "thoroughly","carefully","firmly","tightly","loosely","roughly","quickly",
    "slowly","divided","optional","needed","desired","garnish","garnishing",
    "serving","taste","coating","topping","drizzling","sprinkling","flat","fine",
    "coarse","flaky","golden","mixed","stems","stalk","stalks","fillets","fillet",
    "equipment","pan","skillet","kosher","sea","table","iodized",
}

STRIP_UNITS = {
    "cup","cups","tablespoon","tablespoons","tbsp","tbs","teaspoon","teaspoons",
    "tsp","ml","milliliter","milliliters","liter","liters","fluid","fl","oz",
    "ounce","ounces","pint","pints","quart","quarts","gallon","gallons","gram",
    "grams","kg","kilogram","kilograms","pound","pounds","lb","lbs","clove",
    "cloves","bunch","bunches","sprig","sprigs","stalk","stalks","leaf","leaves",
    "slice","slices","piece","pieces","head","heads","handful","handfuls","wedge",
    "wedges","strip","strips","cube","cubes","floret","florets","half","halves",
    "thirds","quarters","stick","sticks","can","cans","package","packages","pkg",
    "bag","bags","jar","jars","bottle","bottles","dash","dashes","pinch","pinches",
    "drop","drops","scoop","scoops","inch","inches","cm",
}

REJECT_SINGLETONS = {
    "divided","optional","needed","desired","garnish","serving","taste","leaves",
    "leaf","stalks","stalk","spray","wedges","strips","cubes","florets","pieces",
    "slices","garnishing","coating","topping","beaten","melted","softened","sifted",
    "thawed","drained","equipment","pan","skillet","other","style","more","less",
    "mixed","bone","preferably","arm","picnic",
}

def clean(raw):
    s = raw.lower().strip()
    s = re.sub(r'[,;].*$', '', s).strip()
    for pat in REJECT_PATTERNS:
        if pat.search(s):
            return ""
    for pat, repl in NORMALIZATIONS:
        if callable(repl):
            s = pat.sub(repl, s)
        else:
            s = pat.sub(repl, s)
    if "REJECT" in s or not s.strip():
        return ""
    s = re.sub(r'[\d]+', ' ', s)
    s = re.sub(r'\d+/\d+', ' ', s)
    s = re.sub(r'\(.*?\)', ' ', s)
    s = re.sub(r'\s*-\s*', ' ', s)
    words = [re.sub(r'[^a-z]', '', w) for w in s.split()]
    words = [w for w in words if len(w) > 1 and w not in STRIP_UNITS and w not in STRIP_WORDS]
    result = ' '.join(words).strip()
    if not result or len(result) < 2:
        return ""
    if len(words) == 1 and words[0] in REJECT_SINGLETONS:
        return ""
    if re.search(r'\band\b', result):
        return ""
    return result

def title_case(s):
    return ' '.join(w.capitalize() for w in s.split())

# ---- Image lookups ----------------------------------------------------------
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "DigitalChef/1.0"})

def head_ok(url):
    try:
        r = SESSION.head(url, timeout=5, allow_redirects=True)
        return r.status_code == 200
    except Exception:
        return False

def find_image(cleaned):
    tc = title_case(cleaned)
    words = tc.split()

    # TheMealDB passes
    mealdb_candidates = [tc]
    if len(words) > 1:
        mealdb_candidates.append(words[-1])
        mealdb_candidates.append(words[0])
    if len(words) > 2:
        mealdb_candidates.append(f"{words[0]} {words[1]}")

    for name in mealdb_candidates:
        url = f"https://www.themealdb.com/images/ingredients/{requests.utils.quote(name)}.png"
        if head_ok(url):
            return url

    # Spoonacular CDN passes
    slug = cleaned.lower().replace(" ", "-")
    slug = re.sub(r'[^a-z0-9-]', '', slug)
    spoon_candidates = [slug]
    if slug.endswith("s"):
        spoon_candidates.append(slug[:-1])
    if "-" in slug:
        spoon_candidates.append(slug.split("-")[-1])
        spoon_candidates.append(slug.split("-")[0])

    for s in spoon_candidates:
        if not s:
            continue
        url = f"https://spoonacular.com/cdn/ingredients_250x250/{s}.jpg"
        if head_ok(url):
            return url

    return ""

# ---- Main -------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=15)
    parser.add_argument("--limit",   type=int, default=None)
    parser.add_argument("--reset",   action="store_true")
    args = parser.parse_args()

    if args.reset:
        images.drop()
        print("[+] Dropped ingredient_images collection")

    print("\n[1] Scanning recipes collection...")
    total_docs = recipes.count_documents({})
    raw_names = Counter()

    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            raw_names = Counter()
            cursor = recipes.find({}, {"ingredients": 1}, batch_size=500)
            with tqdm(total=total_docs, desc="Scanning recipes") as pbar:
                for recipe in cursor:
                    for ing in recipe.get("ingredients", []):
                        name = ing.get("name", "") or ing.get("raw", "")
                        if name:
                            raw_names[name.strip()] += 1
                    pbar.update(1)
            break
        except Exception as e:
            print(f"\n    [!] Scan interrupted (attempt {attempt}/{max_retries}): {e}")
            if attempt == max_retries:
                sys.exit("    Giving up after repeated connection errors. Check your network/MongoDB Atlas IP allowlist.")
            time.sleep(3)

    print(f"    {sum(raw_names.values()):,} total ingredient uses")
    print(f"    {len(raw_names):,} unique raw strings")

    print("\n[2] Cleaning ingredient names...")
    cleaned_freq = Counter()
    for raw, count in raw_names.items():
        c = clean(raw)
        if c:
            cleaned_freq[c] += count

    unique_cleaned = list(cleaned_freq.keys())
    print(f"    {len(unique_cleaned):,} unique cleaned names to look up")

    if args.limit:
        unique_cleaned = [k for k, _ in cleaned_freq.most_common(args.limit)]
        print(f"    (limited to top {args.limit})")

    print("\n[3] Checking existing cache...")
    existing = {
        doc["name"]
        for doc in images.find({"name": {"$in": unique_cleaned}}, {"name": 1})
    }
    to_process = [n for n in unique_cleaned if n not in existing]
    print(f"    {len(existing):,} already cached")
    print(f"    {len(to_process):,} need lookup")

    if not to_process:
        print("\n[+] All ingredients already cached!")
        client.close()
        return

    print(f"\n[4] Fetching images ({args.workers} workers)...")
    results = {}

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        future_to_name = {executor.submit(find_image, name): name for name in to_process}
        for future in tqdm(as_completed(future_to_name), total=len(to_process), desc="Looking up"):
            name = future_to_name[future]
            try:
                results[name] = future.result()
            except Exception:
                results[name] = ""

    print("\n[5] Saving to MongoDB...")
    now = datetime.now(timezone.utc)
    ops = [
        UpdateOne(
            {"name": name},
            {"$set": {"name": name, "url": url, "cachedAt": now}},
            upsert=True
        )
        for name, url in results.items()
    ]
    if ops:
        images.bulk_write(ops, ordered=False)

    found   = sum(1 for u in results.values() if u)
    missing = sum(1 for u in results.values() if not u)
    total   = len(results)

    print(f"\n{'='*50}")
    print(f"  Total processed : {total:,}")
    print(f"  Images found    : {found:,}  ({found/total*100:.1f}%)")
    print(f"  No image found  : {missing:,}  ({missing/total*100:.1f}%)")
    print(f"\n  Top 20 with no image:")
    no_img = [(n, cleaned_freq[n]) for n, u in results.items() if not u]
    no_img.sort(key=lambda x: -x[1])
    for name, freq in no_img[:20]:
        print(f"    {freq:>5}x  {name}")

    images.create_index("name", unique=True, background=True)
    print(f"\n[+] Done! {images.count_documents({}):,} entries in ingredient_images.")
    client.close()

if __name__ == "__main__":
    main()
