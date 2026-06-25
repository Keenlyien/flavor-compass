import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db/mongodb"

/* ═══════════════════════════════════════════════════════════
   REJECT PATTERNS — checked after comma-strip
═══════════════════════════════════════════════════════════ */
const REJECT_PATTERNS: RegExp[] = [
  /^\s*(for\s+)?(serving|garnish|garnishing|coating|topping|drizzling|sprinkling)\s*$/i,
  /^\s*(to\s+)?taste\s*$/i,
  /^\s*(divided|beaten|softened|melted|sifted|thawed|drained|optional|needed)\s*$/i,
  /^\s*equipment\s*:?\s*$/i,
  /^\s*for\s+(serving|garnish|coating|drizzling|topping)\b/i,
  /^\s*plus\s+more\s+(for\s+)?(serving|garnish)/i,
  /\bto\s+taste\s*$/i,
  /\bsalt\s+and\b/i,
  /\band\s+pepper\b/i,
  /\band\s+freshly\b/i,
  /^\s*(or\s+more|plus\s+more|as\s+needed|if\s+desired|to\s+serve)\s*$/i,
]

/* ═══════════════════════════════════════════════════════════
   NORMALIZATIONS — built from actual 144k ingredient scan
═══════════════════════════════════════════════════════════ */
const NORMALIZATIONS: [RegExp, string][] = [

  // ── Reject combos ──
  [/\bkosher\s+salt\s+and\s+freshly\s+ground\s+black\s+pepper\b/gi, "REJECT"],
  [/\bsalt\s+and\s+(freshly\s+)?ground\s+black\s+pepper\b/gi,       "REJECT"],
  [/\bsalt\s+and\s+pepper\b/gi,                                      "REJECT"],
  [/\bpepper\s+to\s+taste\b/gi,                                      "REJECT"],
  [/\bsalt\s+to\s+taste\b/gi,                                        "REJECT"],
  [/\bfor\s+(serving|garnish|garnishing|coating|topping)\b/gi,       ""],
  [/\bto\s+taste\b/gi,                                               ""],
  [/\bdivided\b/gi,                                                   ""],
  [/\bequipment\s*:?\b/gi,                                           ""],
  [/\bplus\s+more\s+for\s+\w+\b/gi,                                  ""],

  // ── Meat cuts — normalize to base protein ──
  [/\bbone[\s-]?in\s+(pork|chicken|beef|lamb)\b/gi,                (_, m: string) => m],
  [/\bskin[\s-]?on\s+(chicken|salmon)\b/gi,                        (_, m: string) => m],
  [/\bpork\s+(shoulder(\s+half)?|belly|loin|chops?|tenderloin|ribs?|butt|roast|ham|leg)\b/gi, "pork"],
  [/\bbone[\s-]?in\s+fresh\s+pork\b/gi,                            "pork"],
  [/\bbeef\s+(chuck|brisket|rib|roast|sirloin|tenderloin|flank|skirt|round|rump|shank)\b/gi, "beef"],
  [/\brib[\s-]?eye(\s+steak)?\b/gi,                                "beef"],
  [/\b(strip|flank|skirt|hanger)\s+steak\b/gi,                     "beef"],
  [/\bground\s+(beef|pork|turkey|lamb|chicken)\b/gi,               (_, m: string) => m],
  [/\blamb\s+(chops?|leg|shoulder|rack|shanks?|loin)\b/gi,         "lamb"],
  [/\bchicken\s+(breast|thigh|drumstick|wing|leg|quarter|cutlet|tender|strip)s?\b/gi, "chicken"],
  [/\bboneless\s+(skinless\s+)?chicken\b/gi,                       "chicken"],
  [/\bskinless\s+chicken\b/gi,                                     "chicken"],
  [/\b(salmon|tilapia|cod|halibut|tuna|sea\s+bass|mahi)\s+fillets?\b/gi, (_, f: string) => f.trim().replace(/\s+/g, " ")],
  [/\bprawns?\b/gi,                                                "shrimp"],
  [/\bbacon\s+(strips?|rashers?|slices?)?\b/gi,                    "bacon"],

  // ── Salt & pepper ──
  [/\bfreshly\s+ground\s+black\s+pepper\b/gi,    "black pepper"],
  [/\bfreshly\s+ground\s+white\s+pepper\b/gi,    "white pepper"],
  [/\bfreshly\s+ground\s+pepper\b/gi,            "black pepper"],
  [/\bcoarsely\s+ground\s+pepper\b/gi,           "black pepper"],
  [/\bground\s+black\s+pepper\b/gi,              "black pepper"],
  [/\bblack\s+pepper(corns?)?\b/gi,              "black pepper"],
  [/\bwhite\s+pepper(corns?)?\b/gi,              "white pepper"],
  [/\bred\s+pepper\s+flakes?\b/gi,               "chilli flakes"],
  [/\bcrushed\s+red\s+(chilli\s+)?pepper\b/gi,   "chilli flakes"],
  [/\bcayenne\s+pepper\b/gi,                     "cayenne pepper"],
  [/\bkosher\s+salt\b/gi,                        "salt"],
  [/\b(sea|coarse|fine|flaky|flaked|table|iodized)\s+salt\b/gi, "salt"],

  // ── Chilli — TheMealDB uses double-l "Chilli" ──
  [/\bpoblano\s+chil(e|i)(s|es)?\b/gi,           "chilli"],
  [/\bserrano\s+chil(e|i)(s|es)?\b/gi,           "chilli"],
  [/\bhabanero\s+chil(e|i)(s|es)?\b/gi,          "chilli"],
  [/\bchipotle\s+chil(e|i)(s|es)?\b/gi,          "chipotle"],
  [/\bchiles?\s+en\s+adobo\b/gi,                 "chipotle"],
  [/\bchil(e|i)(s|es)?\b/gi,                     "chilli"],
  [/\bjalape[ñn]os?\b/gi,                        "jalapeno"],
  [/\bchilli\s+flakes?\b/gi,                     "chilli flakes"],
  [/\bchili\s+powder\b/gi,                       "chilli powder"],

  // ── Oils & sprays ──
  [/\bnonstick\s+(vegetable\s+)?(oil\s+)?(cooking\s+)?spray\b/gi, "cooking spray"],
  [/\b(olive|vegetable|canola)\s+oil\s+(cooking\s+)?spray\b/gi,   "cooking spray"],
  [/\bcooking\s+spray\b/gi,                      "cooking spray"],
  [/\bextra[\s-]virgin\s+olive\s+oil\b/gi,       "olive oil"],
  [/\bolive\s+oil\b/gi,                          "olive oil"],
  [/\btoasted\s+sesame\s+oil\b/gi,               "sesame oil"],
  [/\bsesame\s+oil\b/gi,                         "sesame oil"],
  [/\b(vegetable|canola|sunflower|grapeseed|corn)\s+oil\b/gi, "vegetable oil"],
  [/\bpeanut\s+oil\b/gi,                         "peanut oil"],
  [/\bcoconut\s+oil\b/gi,                        "coconut oil"],

  // ── Flour ──
  [/\b(all[\s-]purpose|ap|plain|sifted|unbleached)\s+flour\b/gi, "flour"],
  [/\bself[\s-]rais(e|ing)\s+flour\b/gi,         "self raising flour"],
  [/\b(cake|bread|whole\s+wheat|pastry)\s+flour\b/gi, (_, t: string) => t.includes("whole") ? "wholemeal flour" : "flour"],
  [/\bwholemeal\s+flour\b/gi,                    "wholemeal flour"],
  [/\balmond\s+flour\b/gi,                       "ground almonds"],

  // ── Sugar ──
  [/\b(granulated|caster|white|raw|pure\s+cane)\s+sugar\b/gi,    "sugar"],
  [/\b(light|dark)?\s*brown\s+sugar\b/gi,        "brown sugar"],
  [/\b(powdered|confectioners?|icing)\s+sugar\b/gi, "icing sugar"],
  [/\bdemerara\s+sugar\b/gi,                     "brown sugar"],

  // ── Butter & dairy ──
  [/\b(unsalted|salted|cold|melted|softened|room[\s-]temperature)\s+butter\b/gi, "butter"],
  [/\bheavy\s+(whipping\s+)?cream\b/gi,          "heavy cream"],
  [/\b(whipping|double)\s+cream\b/gi,            "heavy cream"],
  [/\bsour\s+cream\b/gi,                         "sour cream"],
  [/\bcream\s+cheese\b/gi,                       "cream cheese"],
  [/\bhalf[\s-]and[\s-]half\b/gi,                "cream"],
  [/\b(full[\s-]fat\s+)?coconut\s+milk\b/gi,     "coconut milk"],
  [/\b(whole|skim|low[\s-]fat|nonfat|reduced[\s-]fat|plant[\s-]based|oat|almond|soy)\s+milk\b/gi, "milk"],

  // ── Eggs ──
  [/\begg\s+whites?\b/gi,                        "egg white"],
  [/\begg\s+yolks?\b/gi,                         "egg yolk"],
  [/\b(large|medium|small)\s+eggs?\b/gi,         "eggs"],

  // ── Cheese ──
  [/\b(finely|freshly|grated)?\s*grated\s+parmesan(o(\s+reggiano)?)?\b/gi, "parmesan"],
  [/\bparmesan(o)?\s*(reggiano)?\s*cheese\b/gi,  "parmesan"],
  [/\bpecorino(\s+romano)?\b/gi,                 "parmesan"],
  [/\bgoat\s+cheese\b/gi,                        "goat cheese"],
  [/\bfeta\s+cheese\b/gi,                        "feta"],
  [/\bcheddar(\s+cheese)?\b/gi,                  "cheddar"],
  [/\bgruy[eè]re\b/gi,                           "gruyere"],
  [/\bmozzarella(\s+cheese)?\b/gi,               "mozzarella"],
  [/\bricotta(\s+cheese)?\b/gi,                  "ricotta"],

  // ── Citrus zest & juice ──
  [/\b(finely|freshly|grated)?\s*grated\s+lemon\s+(zest|peel)\b/gi, "lemon zest"],
  [/\blemon\s+(zest|peel)\b/gi,                  "lemon zest"],
  [/\b(grated\s+)?orange\s+(zest|peel)\b/gi,     "orange"],
  [/\bfreshly\s+squeezed\s+(lemon|lime|orange)\s+juice\b/gi, (_, f: string) => `${f} juice`],
  [/\bfresh\s+(lemon|lime|orange)\s+juice\b/gi,  (_, f: string) => `${f} juice`],

  // ── Vanilla & extracts ──
  [/\bpure\s+vanilla\s+extract\b/gi,             "vanilla extract"],
  [/\bvanilla\s+extract\b/gi,                    "vanilla extract"],
  [/\bpure\s+almond\s+extract\b/gi,              "almond extract"],
  [/\bpure\s+maple\s+syrup\b/gi,                 "maple syrup"],
  [/\bmaple\s+syrup\b/gi,                        "maple syrup"],

  // ── Baking ──
  [/\bbaking\s+soda\b/gi,                        "baking soda"],
  [/\bbaking\s+powder\b/gi,                      "baking powder"],
  [/\b(corn)?\s*starch\b/gi,                     "corn starch"],
  [/\b(unsweetened\s+)?cocoa\s+powder\b/gi,      "cocoa powder"],
  [/\b(bittersweet|semi[\s-]sweet|dark)\s+chocolate\b/gi, "dark chocolate"],
  [/\bwhite\s+chocolate\b/gi,                    "white chocolate"],
  [/\b(instant|active\s+dry|dry)\s+yeast\b/gi,   "yeast"],

  // ── Broth & stock ──
  [/\b(low[\s-]sodium\s+|reduced[\s-]sodium\s+)?(chicken|beef|vegetable|fish)\s+(broth|stock)\b/gi,
    (_, _p: string, m: string) => `${m} stock`],

  // ── Sauces & condiments ──
  [/\b(low[\s-]sodium\s+|reduced[\s-]sodium\s+)?soy\s+sauce\b/gi, "soy sauce"],
  [/\bfish\s+sauce\b/gi,                         "fish sauce"],
  [/\bhot\s+sauce\b/gi,                          "hot sauce"],
  [/\bworcestershire\s+sauce\b/gi,               "worcestershire sauce"],
  [/\btomato\s+paste\b/gi,                       "tomato puree"],
  [/\btomato\s+(puree|sauce)\b/gi,               "tomato puree"],
  [/\bpassata\b/gi,                              "passata"],
  [/\bdijon\s+mustard\b/gi,                      "dijon mustard"],
  [/\b(whole[\s-]?grain|dry)\s+mustard\b/gi,     "mustard"],
  [/\bmustard\s+powder\b/gi,                     "mustard powder"],
  [/\bapple\s+cider\s+vinegar\b/gi,              "apple cider vinegar"],
  [/\b(red\s+wine|white\s+wine|balsamic|rice(\s+wine)?|sherry)\s+vinegar\b/gi,
    (_, v: string) => `${v.replace(/\s+wine/, "").trim()} vinegar`],

  // ── Cider ── TheMealDB uses "Cider"
  [/\b(unfiltered\s+|hard\s+|dry\s+)?apple\s+cider\b/gi, "cider"],

  // ── Herbs — dried & fresh ──
  [/\b(dried|fresh)\s+(oregano|thyme|basil|rosemary|sage|dill|parsley|mint|coriander|tarragon|chives?)\b/gi,
    (_, _state: string, herb: string) => herb === "chives" ? "chives" : herb],
  [/\bflat[\s-]?leaf\s+parsley\b/gi,             "parsley"],
  [/\bcilantro\b/gi,                             "coriander"],
  [/\bthyme\s+(leaves?|sprigs?)\b/gi,            "thyme"],
  [/\brosemary\s+(leaves?|sprigs?)\b/gi,         "rosemary"],
  [/\b(mint|basil)\s+leaves?\b/gi,               (_, h: string) => h],
  [/\bbay\s+leaves?\b/gi,                        "bay leaf"],

  // ── Vegetables ──
  [/\bscallions?\b/gi,                           "spring onion"],
  [/\bgreen\s+onions?\b/gi,                      "spring onion"],
  [/\bred\s+onion\b/gi,                          "red onion"],
  [/\b(yellow|white|sweet)\s+onion\b/gi,         "onion"],
  [/\b(red|green|yellow)\s+bell\s+pepper\b/gi,   (_, c: string) => `${c} pepper`],
  [/\bbell\s+pepper\b/gi,                        "red pepper"],
  [/\b(cherry|plum|heirloom|roma)\s+tomatoes?\b/gi, "tomatoes"],
  [/\bsun[\s-]dried\s+tomatoes?\b/gi,            "sun-dried tomatoes"],
  [/\b(canned|diced|crushed|whole\s+peeled)\s+tomatoes?\b/gi, "tomatoes"],
  [/\bchick[\s-]?peas?\b/gi,                     "chickpeas"],
  [/\bgarbanzo\s+beans?\b/gi,                    "chickpeas"],
  [/\bblack\s+beans?\b/gi,                       "black beans"],
  [/\bkidney\s+beans?\b/gi,                      "kidney beans"],
  [/\bgreen\s+beans?\b/gi,                       "green beans"],
  [/\bgarlic\s+cloves?\b/gi,                     "garlic"],
  [/\bminced\s+garlic\b/gi,                      "garlic"],
  [/\b(fresh\s+)?ginger\b/gi,                    "ginger"],
  [/\bsweet\s+potatoes?\b/gi,                    "sweet potato"],
  [/\b(yukon\s+gold|red|russet)\s+potatoes?\b/gi,"potatoes"],
  [/\bbaby\s+spinach\b/gi,                       "spinach"],
  [/\b(baby\s+)?arugula\b/gi,                    "rocket"],
  [/\bcelery\s+stalks?\b/gi,                     "celery"],
  [/\bbok\s+choy\b/gi,                           "bok choy"],

  // ── Nuts & seeds ──
  [/\b(toasted|slivered|sliced|ground|blanched)\s+almonds?\b/gi, "almonds"],
  [/\b(toasted\s+)?sesame\s+seeds?\b/gi,         "sesame seeds"],
  [/\bpine\s+nuts?\b/gi,                         "pine nuts"],
  [/\bpecans?\b/gi,                              "pecans"],
  [/\bwalnuts?\b/gi,                             "walnuts"],
  [/\bcashew(\s+nuts?)?\b/gi,                    "cashew nuts"],
  [/\bpistachios?\b/gi,                          "pistachio"],

  // ── Grains & breadcrumbs ──
  [/\b(long[\s-]grain|short[\s-]grain|jasmine|basmati|brown|wild|sushi|arborio)\s+rice\b/gi, "rice"],
  [/\b(panko|dry|fresh|fine)?\s*bread[\s-]?crumbs?\b/gi, "breadcrumbs"],
  [/\bpanko\b/gi,                                "breadcrumbs"],
  [/\b(rolled|quick[\s-]cooking|old[\s-]fashioned|steel[\s-]cut)\s+oats?\b/gi, "oats"],

  // ── Spices ──
  [/\bground\s+(cinnamon|cumin|coriander|nutmeg|ginger|cardamom|turmeric|allspice|cloves?)\b/gi,
    (_, s: string) => s.replace(/s$/, "")],
  [/\bfreshly\s+grated\s+nutmeg\b/gi,            "nutmeg"],
  [/\b(smoked|sweet|hot)\s+paprika\b/gi,         "paprika"],
  [/\bgarlic\s+powder\b/gi,                      "garlic granules"],
  [/\bonion\s+powder\b/gi,                       "onion powder"],
  [/\bgaram\s+masala\b/gi,                       "garam masala"],
  [/\bcurry\s+powder\b/gi,                       "curry powder"],
  [/\b(italian\s+)?seasoning\b/gi,               "mixed herbs"],

  // ── Wine & spirits ──
  [/\bdry\s+(white|red)\s+wine\b/gi,             (_, c: string) => `${c} wine`],
  [/\bdry\s+sherry\b/gi,                         "sherry"],

  // ── Misc ──
  [/\b(canned\s+)?pure\s+pumpkin\b/gi,           "pumpkin"],
  [/\b(light|dark)\s+corn\s+syrup\b/gi,          "corn syrup"],
  [/\bgolden\s+raisins?\b/gi,                    "raisins"],
  [/\bsultanas?\b/gi,                            "raisins"],
  [/\b(plain|greek|nonfat|whole[\s-]milk)\s+yogurt\b/gi, "yogurt"],
  [/\b(instant\s+)?espresso(\s+powder)?\b/gi,    "espresso"],
]

/* ═══════════════════════════════════════════════════════════
   STRIP WORDS — descriptors, adjectives, instruction words
═══════════════════════════════════════════════════════════ */
const STRIP_WORDS = new Set([
  // Articles & prepositions
  "a","an","the","of","in","at","by","on","with","from","into",
  "such","as","if","about","around","up","or","and","to","for",
  // Approximations & connectors
  "approximately","roughly","just","least","plus","more",
  "less","extra","additional","another","any","other",
  // State
  "fresh","dried","frozen","canned","whole","raw","ripe","cooked",
  "prepared","store","bought","homemade","ready","made",
  "warm","cold","chilled","room","temperature",
  // Size
  "large","small","medium","mini","tiny","big","baby","young",
  // Quality
  "unsalted","salted","organic","natural","pure","virgin",
  "low","high","reduced","full","fat","free","range","lean","lite",
  "light","dark","nonstick","sodium","defatted","refined","unrefined",
  "plain","regular","classic","style","grain","unfiltered",
  // Meat descriptors
  "bone","boneless","skinless","skin","preferably","arm","picnic",
  "thick","thin","lengthwise","widthwise","diagonal","crosswise",
  // Preparation
  "peeled","pitted","seeded","deveined","trimmed","butterflied",
  "split","shelled","hulled","husked","marinated","candied",
  "softened","melted","beaten","whipped","sifted","packed","heaped",
  "level","scant","generous","rinsed","drained","thawed","squeezed",
  "zested","juiced","strained","toasted","roasted","smoked","pickled",
  "chopped","minced","diced","sliced","cubed","halved","quartered",
  "crumbled","shredded","ground","crushed","mashed","torn","cut",
  // Adverbs
  "finely","freshly","lightly","thinly","coarsely","gently",
  "slightly","evenly","well","very","thoroughly","carefully",
  "firmly","tightly","loosely","roughly","quickly","slowly",
  // Instruction words
  "divided","optional","needed","desired","garnish","garnishing",
  "serving","taste","coating","topping","drizzling","sprinkling",
  // Noise
  "flat","fine","coarse","flaky","golden","mixed","stems","stalk",
  "stalks","fillets","fillet","spray","equipment","pan","skillet",
  "nonstick","kosher","sea","table","iodized",
])

/* ═══════════════════════════════════════════════════════════
   STRIP UNITS
═══════════════════════════════════════════════════════════ */
const STRIP_UNITS = new Set([
  "cup","cups","tablespoon","tablespoons","tbsp","tbs",
  "teaspoon","teaspoons","tsp","ml","milliliter","milliliters",
  "liter","liters","fluid","fl","oz","ounce","ounces",
  "pint","pints","quart","quarts","gallon","gallons",
  "gram","grams","kg","kilogram","kilograms",
  "pound","pounds","lb","lbs",
  "clove","cloves","bunch","bunches",
  "sprig","sprigs","stalk","stalks",
  "leaf","leaves","slice","slices",
  "piece","pieces","head","heads",
  "handful","handfuls","wedge","wedges",
  "strip","strips","cube","cubes",
  "floret","florets","half","halves","thirds","quarters",
  "stick","sticks","can","cans",
  "package","packages","pkg","bag","bags",
  "jar","jars","bottle","bottles",
  "dash","dashes","pinch","pinches",
  "drop","drops","scoop","scoops",
  "inch","inches","cm","centimeter","centimeters",
])

const REJECT_SINGLETONS = new Set([
  "divided","optional","needed","desired","garnish","serving","taste",
  "leaves","leaf","stalks","stalk","spray","wedges","strips",
  "cubes","florets","pieces","slices","garnishing","coating","topping",
  "beaten","melted","softened","sifted","thawed","drained","equipment",
  "pan","skillet","other","style","more","less","mixed","bone",
  "preferably","arm","picnic",
])

/* ═══════════════════════════════════════════════════════════
   MAIN CLEANER
   Order: comma-strip → reject → normalize → strip → validate
═══════════════════════════════════════════════════════════ */
function cleanIngredientName(raw: string): string {
  let s = raw.toLowerCase().trim()

  // 1. Strip after comma/semicolon FIRST
  s = s.replace(/[,;].*$/, "").trim()

  // 2. Reject obvious non-ingredients
  for (const pattern of REJECT_PATTERNS) {
    if (pattern.test(s)) return ""
  }

  // 3. Normalizations
  for (const [pattern, replacement] of NORMALIZATIONS) {
    s = s.replace(pattern, replacement as string)
  }
  if (s.includes("REJECT") || !s.trim()) return ""

  // 4. Strip numbers & fractions
  s = s.replace(/[\d¼½¾⅓⅔⅛⅜⅝⅞]+/g, " ")
  s = s.replace(/\b\d+\/\d+\b/g, " ")

  // 5. Strip parenthetical notes
  s = s.replace(/\(.*?\)/g, " ")

  // 6. Normalize hyphens to spaces
  s = s.replace(/\s*-\s*/g, " ")

  // 7. Word-level filter
  const words = s
    .split(/\s+/)
    .map(w => w.replace(/[^a-z]/g, ""))
    .filter(w => w.length > 1 && !STRIP_UNITS.has(w) && !STRIP_WORDS.has(w))

  const result = words.join(" ").trim()

  // 8. Validate
  if (!result || result.length < 2) return ""
  if (words.length === 1 && REJECT_SINGLETONS.has(words[0])) return ""
  if (/\band\b/.test(result)) return ""

  return result
}


/* ── Server-side in-memory cache ─────────────────────────────────────
   Survives across requests in the same Node.js process. First request
   hits MongoDB; subsequent requests within TTL are instant (~0ms).
   This is the single biggest speed win for image routes since the same
   handful of cuisine/diet images are requested on every page load.
─────────────────────────────────────────────────────────────────── */
const _memCache = new Map<string, { url: string; ts: number }>()
const MEM_TTL = 30 * 60 * 1000  // 30 minutes

function memGet(key: string): string | null {
  const hit = _memCache.get(key)
  if (hit && Date.now() - hit.ts < MEM_TTL) return hit.url
  return null
}
function memSet(key: string, url: string) {
  _memCache.set(key, { url, ts: Date.now() })
}

function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase())
}

async function tryMealDB(name: string): Promise<string> {
  const url = `https://www.themealdb.com/images/ingredients/${encodeURIComponent(name)}.png`
  try {
    const res = await fetch(url, { method: "HEAD" })
    return res.ok ? url : ""
  } catch {
    return ""
  }
}

/* ── Spoonacular ingredient CDN — ~5,000 ingredients, no API key ── */
async function trySpoonacular(name: string): Promise<string> {
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
  const url = `https://spoonacular.com/cdn/ingredients_250x250/${slug}.jpg`
  try {
    const res = await fetch(url, { method: "HEAD" })
    if (res.ok) return url
    // Try singular if plural fails
    if (slug.endsWith("s")) {
      const singular = `https://spoonacular.com/cdn/ingredients_250x250/${slug.slice(0, -1)}.jpg`
      const res2 = await fetch(singular, { method: "HEAD" })
      return res2.ok ? singular : ""
    }
    return ""
  } catch {
    return ""
  }
}

export async function GET(req: NextRequest) {
  const rawName = req.nextUrl.searchParams.get("name")?.trim()
  if (!rawName) return NextResponse.json({ url: "" })

  const cleaned  = cleanIngredientName(rawName)
  const cacheKey = (cleaned || rawName.toLowerCase()).slice(0, 100)
  if (!cleaned) return NextResponse.json({ url: "" })

  const titleCased = toTitleCase(cleaned)
  const db = await getDb()

  // Serve from cache
  if (db) {
    const cached = await db.collection("ingredient_images").findOne({ name: cacheKey })
    if (cached) return NextResponse.json({ url: cached.url })
  }

  // Pass 1: full cleaned name e.g. "Black Pepper"
  let url = await tryMealDB(titleCased)

  // Pass 2: last word e.g. "Cherry Tomatoes" → "Tomatoes"
  if (!url) {
    const words = titleCased.split(" ")
    if (words.length > 1) url = await tryMealDB(words[words.length - 1])
  }

  // Pass 3: first word e.g. "Cheddar Cheese" → "Cheddar"
  if (!url) {
    const words = titleCased.split(" ")
    if (words.length > 1) url = await tryMealDB(words[0])
  }

  // Pass 4: two-word combo if 3+ words e.g. "Apple Cider Vinegar" → "Apple Cider"
  if (!url) {
    const words = titleCased.split(" ")
    if (words.length > 2) url = await tryMealDB(`${words[0]} ${words[1]}`)
  }

  // Pass 5: Spoonacular CDN — covers ~5,000 ingredients TheMealDB misses
  if (!url) url = await trySpoonacular(cleaned)
  // Try Spoonacular with last word too
  if (!url) {
    const words = cleaned.split(" ")
    if (words.length > 1) url = await trySpoonacular(words[words.length - 1])
  }

  // Cache result
  if (db) {
    await db.collection("ingredient_images").updateOne(
      { name: cacheKey },
      { $set: { name: cacheKey, url, cachedAt: new Date() } },
      { upsert: true }
    )
  }

  memSet(`ing:${cacheKey}`, url)
  return NextResponse.json({ url }, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  })
}
