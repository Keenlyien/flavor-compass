# Flavor Compass

> A guide for home cooks looking to explore new recipes and discover new directions in cooking.

A personal, non-commercial recipe discovery app built with Next.js and MongoDB. Browse 13,000+ recipes from the Epicurious dataset, filter by cuisine/diet/health score, and follow an animated step-by-step cooking walkthrough with built-in timers and Lottie action animations.

**Live site:** [flavor-compass-five.vercel.app](https://flavor-compass-five.vercel.app)
**Repository:** [github.com/Keenlyien/flavor-compass](https://github.com/Keenlyien/flavor-compass)

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Getting Started](#getting-started)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [API Key Renewal Guide](#api-key-renewal-guide)
7. [Data Seeding & Enrichment Scripts](#data-seeding--enrichment-scripts)
8. [Architecture Deep Dive](#architecture-deep-dive)
9. [Feature Reference](#feature-reference)
10. [Known Dead Code](#known-dead-code)
11. [Deployment](#deployment)
12. [Troubleshooting](#troubleshooting)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| UI | React 19.2.4, TypeScript, Tailwind CSS v4 |
| Animation | Framer Motion 12 (magnified dock effect), lottie-react (cooking walkthrough) |
| Icons | Lucide React |
| Database | MongoDB Atlas (free M0 tier) |
| Image hosting/CDN | Cloudinary (dataset images), Pexels API (cuisine/diet/hero photos) |
| Hosting | Vercel |
| Data source | [Epicurious recipe dataset](https://www.kaggle.com/datasets/hugodarwood/epirecipes) (Kaggle) |

> **Note:** `gsap`, `motion`, `next-themes`, `@radix-ui/react-slot`, and `class-variance-authority` are listed in `package.json` but are not imported anywhere in the current codebase. See [Known Dead Code](#known-dead-code).

---

## Project Structure

```
digital_chef/
├── app/
│   ├── api/
│   │   ├── cuisine-image/route.ts          # single cached photo per cuisine
│   │   ├── cuisine-images-multi/route.ts   # N cached photos per cuisine (carousels)
│   │   ├── diet-image/route.ts             # single cached photo per diet type
│   │   ├── ingredient-image/route.ts       # ingredient thumbnail lookup
│   │   ├── recipe-hero/route.ts            # Pexels hero photo per recipe
│   │   └── recipes/
│   │       ├── route.ts                    # list/search/filter/sort
│   │       └── [id]/route.ts               # single recipe detail
│   ├── cuisines/page.tsx                   # /cuisines
│   ├── recipes/
│   │   ├── page.tsx                        # /recipes
│   │   ├── loading.tsx                     # route-level loading UI
│   │   └── [id]/
│   │       ├── page.tsx                    # /recipes/:id
│   │       └── cook/page.tsx               # /recipes/:id/cook
│   ├── layout.tsx                          # root layout (fonts, Footer)
│   ├── page.tsx                            # / (homepage)
│   └── globals.css                         # design tokens (CSS variables)
│
├── components/
│   ├── cuisines/
│   │   └── CuisinesView.tsx                # /cuisines page content
│   ├── home/
│   │   ├── Hero.tsx                        # hero carousel + magnified cuisine dock
│   │   ├── HowItWorks.tsx                  # 3-step explainer section
│   │   └── FeaturedRecipes.tsx             # homepage "Editor's Picks" grid
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   └── Footer.tsx
│   ├── recipes/
│   │   ├── RecipesView.tsx                 # main /recipes page (search, filters, grid, pagination)
│   │   ├── RecipeCard.tsx                  # grid card
│   │   ├── RecipeDetail.tsx                # /recipes/:id page content
│   │   ├── RecipeFilters.tsx               # cuisine/diet/sort pills (magnified dock)
│   │   ├── RecipeSearch.tsx                # search input
│   │   └── CuisineParallaxBackground.tsx   # full-page photo carousel background
│   ├── ui/
│   │   └── ThemeProvider.tsx               # inert pass-through (dark mode removed)
│   └── walkthrough/
│       └── CookingWalkthrough.tsx          # /recipes/:id/cook — loading/start/steps/done screens
│
├── lib/
│   ├── db/
│   │   ├── mongodb.ts                      # MongoClient singleton
│   │   └── mock.ts                         # static offline fallback dataset
│   ├── types/
│   │   └── recipe.ts                       # RecipeCardData, RecipeDetailData, etc.
│   ├── image.ts                            # Cloudinary URL optimizer
│   ├── time.ts                             # formatTime() minutes → "1h 30m"
│   ├── utils.ts
│   ├── location.ts                         # ⚠ dead code (see below)
│   ├── route.ts                            # ⚠ dead code (see below)
│   └── prices.json                         # ⚠ dead code (see below)
│
├── public/
│   ├── flavor_compass.png                  # logo
│   └── lottie/                             # cooking action animations (JSON)
│       ├── idle.json,   chop.json,  stir.json,  whisk.json
│       ├── pour.json,   flip.json,  bake.json,  boil.json
│       ├── mix.json,    season.json, taste.json, pre_heat.json
│       ├── loading.json, start_and_done.json
│
└── scripts/
    └── seed.py                             # one-time Kaggle CSV → MongoDB importer
```

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+ (only needed if re-seeding the database from scratch)
- A MongoDB Atlas account (free tier)
- A Pexels API key (free)
- A Cloudinary account (free tier) — only required if re-seeding images

### Installation

```bash
git clone https://github.com/Keenlyien/flavor-compass.git
cd flavor-compass
npm install
```

Create a `.env.local` file in the project root (see [Environment Variables](#environment-variables) below), then:

```bash
npm run dev
```

Visit `http://localhost:3000`.

---

## Environment Variables

Create `.env.local` in the project root with these four variables — **these are the only ones the running app actually reads**:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
MONGODB_DB=digital_chef
NEXT_PUBLIC_PEXELS_API_KEY=your_pexels_api_key
```

| Variable | Used by | Required? |
|---|---|---|
| `MONGODB_URI` | All API routes, `lib/db/mongodb.ts` | Yes — app falls back to `lib/db/mock.ts` static data if missing/unreachable |
| `MONGODB_DB` | Same as above | No — defaults to `digital_chef` if unset |
| `NEXT_PUBLIC_PEXELS_API_KEY` | Cuisine/diet/hero photo routes, parallax background, cuisine tiles | Yes — without it, photo-dependent UI (backgrounds, cuisine pills, hero images) will render blank |

> Cloudinary is **not** read as an environment variable by the running app — `lib/image.ts` optimizes any existing Cloudinary URL purely through string manipulation (no API key needed for this). Cloudinary credentials are only needed inside `scripts/seed.py` if you're re-uploading dataset images from scratch.

---

## Database Setup

1. Create a free MongoDB Atlas cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Under **Network Access**, add your IP — or add `0.0.0.0/0` (allow from anywhere) if you're developing from a dynamic home IP or deploying to Vercel (which uses dynamic IPs on the free tier)
3. Create a database user under **Database Access**
4. Copy your connection string into `MONGODB_URI` in `.env.local`

### Collections used by the app

| Collection | Purpose |
|---|---|
| `recipes` | Main recipe documents (title, ingredients, instructions, cuisines, diets, healthScore, times, servings) |
| `cuisine_images` | Cached single Pexels photo per cuisine |
| `cuisine_images_multi` | Cached multiple Pexels photos per cuisine (used for tile/background carousels) |
| `diet_images` | Cached single Pexels photo per diet type |
| `ingredient_images` | Cached ingredient thumbnail URLs (TheMealDB/Spoonacular sourced) |
| `recipe_hero_images` | Cached Pexels hero photo per individual recipe |

If a collection doesn't exist yet, the relevant API route creates it automatically on first write (MongoDB creates collections implicitly). No manual collection creation is required — just an empty database is enough to start.

---

## API Key Renewal Guide

If a key stops working (expired, revoked, or you're moving to a new account), here's exactly where each one lives and how to regenerate it:

### MongoDB Atlas connection string (`MONGODB_URI`)
1. Log into [cloud.mongodb.com](https://cloud.mongodb.com)
2. Go to **Database** → your cluster → **Connect** → **Drivers**
3. Copy the new connection string, replace `<password>` with your actual database user password
4. Update `.env.local` locally, and **Vercel → Project → Settings → Environment Variables** for production
5. Redeploy on Vercel (or it picks up the new value on next deploy)

**Common failure symptom:** `MongoServerSelectionError` or SSL handshake errors in the console — this is almost always an **IP whitelist issue**, not an expired key. Check **Network Access** in Atlas first before assuming the connection string itself is bad.

### Pexels API key (`NEXT_PUBLIC_PEXELS_API_KEY`)
1. Log into [pexels.com/api](https://www.pexels.com/api/)
2. Your key is shown on the dashboard — Pexels API keys don't expire on their own, but can be rate-limited (200 requests/hour on the free tier)
3. If you hit the rate limit, most image fetches in this app are cached in MongoDB after the first request (see `cuisine-image`, `cuisine-images-multi`, `diet-image`, `recipe-hero` routes) — a temporary rate-limit block should clear itself within the hour without needing a new key
4. If the key itself was revoked, generate a new one from the same dashboard page and update `NEXT_PUBLIC_PEXELS_API_KEY` in `.env.local` and Vercel's environment variables

### Cloudinary (only relevant if re-running `scripts/seed.py` with image uploads)
1. Log into [cloudinary.com/console](https://cloudinary.com/console)
2. Cloud name, API key, and API secret are shown on the dashboard home page
3. These are only passed as arguments/env vars to `scripts/seed.py` at seed time — they are never read by the live Next.js app itself

---

## Data Seeding & Enrichment Scripts

### `scripts/seed.py`
One-time importer: reads the Kaggle Epicurious CSV, optionally uploads recipe images to Cloudinary, and inserts everything into the `recipes` collection in MongoDB.

```bash
pip install pymongo pandas cloudinary python-dotenv tqdm

python scripts/seed.py \
  --csv  "path/to/Food Ingredients and Recipe Dataset with Image Name Mapping.csv" \
  --imgs "path/to/Food Images/Food Images"
```

Options:
- `--csv` (required) — path to the Kaggle CSV
- `--imgs` (optional) — path to the folder of recipe images; omit if you don't have images yet
- `--limit N` — only seed the first N recipes (useful for testing)
- `--drop` — drop the `recipes` collection before inserting

Reads `MONGODB_URI`, `MONGODB_DB` from `.env.local` automatically. Cloudinary variables (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) are only needed if using `--imgs`.

> **Note:** the additional enrichment scripts referenced during this project's development (`update_recipe_data.py` for cuisine/diet/health-score classification, `create_indexes.py` for MongoDB indexes, `seed_cuisine_images.py`, `seed_ingredient_images.py`, `verify_health.py`) have since been removed from the repository. If recreating them, refer to the project's development history for their exact logic — they are not currently present in `scripts/`.

---

## Architecture Deep Dive

### Recipe data model
Each document in the `recipes` collection has (among other fields):

| Field | Type | Notes |
|---|---|---|
| `cuisines` | `string[]` | Multi-label — a recipe can belong to 1–3 cuisines (title case, e.g. `"Italian"`) |
| `cuisine` | `string` | Singular, kept in sync as `cuisines[0]` for backward compatibility |
| `diets` | `string[]` | Lowercase (e.g. `"vegetarian"`, `"gluten free"`) — derived from ingredient presence/absence |
| `healthScore` | `number` (0–100) | FDA "healthy" claim rule-based score — see below |
| `readyInMinutes` / `preparationMinutes` / `cookingMinutes` | `number` | Parsed from instruction text, or reasonable defaults |
| `servings` | `number` | Parsed from instruction/title text, defaults to 4 |

### Cuisine classification
Recipes are classified by scoring title/ingredient/instruction text against per-cuisine keyword lists using **word-boundary regex** (not naive substring matching — an earlier bug had "classic" falsely matching "lassi" via substring search, which word-boundary regex fixes). A recipe can match 1–3 cuisines if it scores highly against more than one keyword set (fusion dishes). Falls back to `"International"` if no cuisine scores above a minimum confidence threshold.

### Diet classification
Purely mechanical, based on ingredient text: absence of meat/fish → `vegetarian`; vegetarian + absence of dairy/egg/honey → `vegan`; absence of wheat/gluten-source keywords → `gluten free` (with an exemption for naturally gluten-free flours like almond/chickpea flour so the word "flour" alone doesn't trigger a false positive); absence of high-carb keywords → `ketogenic`.

### Healthiness score (0–100)
Based on the FDA's December 2024 "healthy" claim rule (21 CFR 101.65):
- **Positive:** presence of real food groups — vegetables, fruit, whole grains, lean protein, legumes, low-fat dairy
- **Neutral/exempt:** healthy fats (olive oil, nuts, fish, avocado, tahini) are **not** penalized, matching the FDA's explicit exemption for fat inherent in seafood/nuts/seeds/soy
- **Negative:** saturated fat (butter, cream, fatty meats), added sugar (natural fruit sugar is exempted via negation-pattern detection for phrases like "no added sugar"), sodium (mild weight only, never disqualifying alone), and frying as a cooking method (a strong penalty regardless of the core ingredient — this is what makes fried "vegetable chips" score low despite the healthy-sounding name)
- A "clean recipe" bonus applies when a recipe has zero negative signals and at least one real food group present

### Image handling — three distinct sources
1. **Dataset images** — original Kaggle recipe photos, hosted on Cloudinary, optimized on-the-fly via URL string rewriting in `lib/image.ts` (`e_improve:70,e_sharpen:60` — Cloudinary's free AI enhancement, no extra cost beyond bandwidth)
2. **Pexels stock photos** — used for cuisine pills, diet pills, hero images (recipe detail + cooking walkthrough + featured recipes crossfade), and the full-page parallax carousel backgrounds. All cached in MongoDB after first fetch (see collections table above) plus a 30-minute in-memory cache per server process, to avoid hitting Pexels' rate limit on repeat page loads
3. **Ingredient thumbnails** — TheMealDB (primary) → Spoonacular CDN (fallback), cached in `ingredient_images`

### Parallax background system
`CuisineParallaxBackground.tsx` renders a full-page, fixed-position photo carousel behind `/recipes` and `/cuisines`. It advances on two independent triggers: a 5-second auto-timer, and every 600px the user scrolls (whichever comes first resets the other's timer so they never double-fire). Fetches photos through `/api/cuisine-images-multi` (cached) rather than calling Pexels directly from the browser. The component is rendered with `key={pathname}` on each page so React fully remounts it on every route change — this avoids a bug where Next.js's client-side router occasionally reused the component instance across navigations when the `cuisine` prop value hadn't changed, leaving it stuck with stale/empty state until a hard reload.

### Magnified dock effect
Used on the homepage's "Browse by Cuisine" strip and all three rows of `/recipes` filter pills (Cuisine, Diet, Sort). Built with Framer Motion: each pill tracks the cursor's true 2D (Euclidean) distance to its own center via `useMotionValue` + a manual `.on("change", ...)` subscription (not the array-input `useTransform` form, to avoid a framer-motion version compatibility issue encountered during development), then feeds a scale target into `useSpring` for the elastic magnify feel. 2D distance (not X-only) was necessary to prevent pills on a different wrapped line from magnifying together just because they shared a horizontal position with the actively-hovered pill.

### Cooking walkthrough (`/recipes/:id/cook`)
Four sequential screens managed by a single `screen` state (`"loading" | "start" | "steps" | "done"`):
1. **Loading** — fetches recipe data, hero image, `loading.json`, a Pexels photo carousel, and `start_and_done.json`, all in parallel where possible, with a real progress bar tied to actual fetch completion (not a fake timer)
2. **Start** — plays `start_and_done.json`, shows recipe title/step count/time, "Start Cooking" button
3. **Steps** — split layout: hero image + step-dot navigator on the left, step text + Lottie action animation + optional timer on the right. The Lottie animation is chosen per-step by keyword-matching the instruction text (see table below) and lazy-loaded from `public/lottie/`
4. **Done** — plays `start_and_done.json` once (non-looping), links back to the recipe or to browse more

**Step → animation keyword mapping:**

| Animation | Trigger keywords |
|---|---|
| `chop` | chop, dice, slice, mince, cut, julienne, slit |
| `whisk` | whisk, beat, whip |
| `pour` | pour, drizzle, stream |
| `flip` | flip, turn over, toss |
| `pre_heat` | preheat/pre-heat **without** the word "oven" present |
| `bake` | bake, roast, oven, broil (oven always wins over preheat if both appear) |
| `boil` | boil, blanch, parboil |
| `season` | season, salt and pepper, spice |
| `taste` | taste, adjust seasoning, check seasoning |
| `stir` | stir, simmer, fold |
| `mix` | mix, combine, blend |
| `idle` | fallback — no keyword matched |

---

## Feature Reference

- **Homepage** (`/`) — Hero carousel, magnified-dock cuisine browser, "How It Works" 3-step explainer, "Editor's Picks" featured recipes grid with Pexels crossfade
- **Recipes** (`/recipes`) — Search, cuisine/diet/sort filter pills (magnified dock), sticky filter summary bar that appears on scroll showing only active filters, scroll-reveal card grid (16 per page), parallax carousel background, pagination
- **Cuisines** (`/cuisines`) — 4 randomly-selected cuisine tiles per page load (client-side only, to avoid SSR/hydration mismatch from `Math.random()`), each with its own independent 3-photo rotating carousel; below that, a matched "fun fact" strip with a verified fact per featured cuisine
- **Recipe detail** (`/recipes/:id`) — Full ingredient list (filtered to exclude standalone prep-descriptor rows like "melted" or "divided" that exist as separate rows in the source dataset), formatted cook time, health score, "Start Cooking" link
- **Cooking walkthrough** (`/recipes/:id/cook`) — See architecture section above

---

## Known Dead Code

These files exist in the repository but are **not used by any current page or route**. They're leftovers from an earlier version of the project (a location-based currency/pricing feature that was never finished) and are safe to delete:

- `lib/location.ts`
- `lib/prices.json`
- `lib/route.ts` — an orphaned API route handler sitting in `lib/` instead of `app/api/`, meaning Next.js never actually serves it as a route regardless

Additionally, these npm packages are installed in `package.json` but never imported anywhere in the codebase — safe to remove with `npm uninstall`:
- `gsap`
- `motion`
- `next-themes`
- `@radix-ui/react-slot`
- `class-variance-authority`

---

## Deployment

1. Push the repository to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo
3. Vercel auto-detects Next.js — no build settings to change
4. Add the three environment variables (see [Environment Variables](#environment-variables)) under **Environment Variables** before deploying
5. Deploy

**Branch strategy used during development:** `main` (production, auto-deployed by Vercel) + `dev` (sandbox for testing changes before merging). Set **Vercel → Settings → Git → Production Branch** to `main` so pushes to `dev` only generate preview deployments.

**After deploying:** add `0.0.0.0/0` to MongoDB Atlas's Network Access list, since Vercel's free tier uses dynamic IPs that can't be individually whitelisted.

---

## Troubleshooting

**`MongoServerSelectionError` / SSL handshake errors on `npm run dev`**
Your current IP isn't whitelisted in MongoDB Atlas. Go to Atlas → Network Access → Add Current IP (or add `0.0.0.0/0` for convenience during development on a dynamic IP).

**Cuisine/diet filter returns no results**
Filter values sent by the UI are lowercase (`"italian"`), but `cuisines` is stored title-case (`"Italian"`) while `diets` is stored lowercase (`"vegetarian"`) in MongoDB — the API route title-cases the cuisine filter value before querying but passes the diet filter value through as-is. If this breaks again after a data migration, check that `app/api/recipes/route.ts`'s filter-building logic matches whatever casing convention the data was written with.

**Background carousel or cuisine tile images intermittently fail to load**
This was previously caused by calling the Pexels API directly from the browser on every page load, which hit Pexels' 200 requests/hour rate limit during repeated testing. Fixed by routing all multi-image fetches through the cached `/api/cuisine-images-multi` endpoint. If it recurs, check that no component has reverted to calling `api.pexels.com` directly instead of going through this cached route.

**Parallax background doesn't appear after client-side navigation (works fine on hard refresh)**
Make sure `<CuisineParallaxBackground key={pathname} cuisine={cuisine} />` includes the `key={pathname}` prop on every page that renders it. Without it, Next.js's router can reuse the component instance across a route change if the `cuisine` prop value is identical on both pages, leaving stale/empty state until a manual reload.

**Hydration error on `/cuisines`**
The 4 random cuisine tiles must only be selected inside a `useEffect`, never in `useMemo` or during initial render — `Math.random()` produces different results during server-side rendering vs. client hydration, which React flags as a mismatch.
