"""
seed.py — Digital Chef dataset seeder
======================================
Reads the Kaggle CSV, optionally uploads images to Cloudinary,
then inserts all recipes into MongoDB Atlas.

Usage
-----
1. Install deps:
   pip install pymongo pandas cloudinary python-dotenv tqdm

2. Set environment variables in .env.local (or export them):
   MONGODB_URI=mongodb+srv://...
   MONGODB_DB=digital_chef          # optional, defaults to digital_chef

   # Only needed for image uploads:
   CLOUDINARY_CLOUD_NAME=your_cloud
   CLOUDINARY_API_KEY=your_key
   CLOUDINARY_API_SECRET=your_secret

3. Place this file in digital_chef/scripts/

4. Run:
   python scripts/seed.py \\
     --csv  "path/to/Food Ingredients and Recipe Dataset with Image Name Mapping.csv" \\
     --imgs "path/to/Food Images/Food Images"   # folder with .jpg files
                                                # omit if you have no images yet

Options
-------
  --csv   PATH   path to the Kaggle CSV (required)
  --imgs  PATH   path to the food images folder (optional)
  --limit N      only seed the first N recipes (useful for testing)
  --drop         drop the recipes collection before inserting
"""

import argparse
import ast
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from pymongo import MongoClient, TEXT
from tqdm import tqdm

# ── Load .env.local if present ────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env.local")
except ImportError:
    pass  # dotenv optional — env vars can be set manually

# ── Cloudinary (optional) ──────────────────────────────────────────────────────
CLOUDINARY_AVAILABLE = False
try:
    import cloudinary
    import cloudinary.uploader
    if all(os.environ.get(k) for k in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")):
        cloudinary.config(
            cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
            api_key=os.environ["CLOUDINARY_API_KEY"],
            api_secret=os.environ["CLOUDINARY_API_SECRET"],
        )
        CLOUDINARY_AVAILABLE = True
except ImportError:
    pass


# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_ingredient_list(raw: str) -> list[dict]:
    """Parse Kaggle ingredient string like "['1 cup flour', '2 eggs']" into structured list."""
    try:
        items = ast.literal_eval(raw) if isinstance(raw, str) else []
    except Exception:
        items = [s.strip() for s in raw.strip("[]").split(",") if s.strip()]

    ingredients = []
    for item in items:
        item = str(item).strip().strip("'\"")
        if not item:
            continue
        # Try to extract amount + unit from start of string
        # e.g. "2 cups flour" → amount="2", unit="cups", name="flour"
        m = re.match(r'^([\d¼½¾⅓⅔⅛⅜⅝⅞\/\.\-]+)\s*([a-zA-Z]*)\s+(.*)', item)
        if m:
            ingredients.append({
                "name":   m.group(3).strip(),
                "amount": m.group(1).strip(),
                "unit":   m.group(2).strip(),
                "raw":    item,
            })
        else:
            ingredients.append({"name": item, "amount": "", "unit": "", "raw": item})

    return ingredients


def parse_instructions(raw: str) -> list[dict]:
    """Split long instruction text into numbered steps."""
    if not isinstance(raw, str) or not raw.strip():
        return []

    # Try to split on existing numbered patterns first: "1. ...", "Step 1:"
    numbered = re.split(r'\n\s*(?:\d+[\.\)]\s+|Step\s+\d+\s*[:.\-]\s*)', raw.strip())
    if len(numbered) > 2:
        steps = [s.strip() for s in numbered if s.strip()]
    else:
        # Split on double newlines or periods followed by space + capital letter
        chunks = re.split(r'\n{2,}|(?<=[.!?])\s+(?=[A-Z])', raw.strip())
        steps = [c.strip() for c in chunks if len(c.strip()) > 20]

    return [{"number": i + 1, "step": s} for i, s in enumerate(steps) if s]


def upload_image(img_path: str, public_id: str) -> str:
    """Upload image to Cloudinary and return the URL. Returns '' on failure."""
    if not CLOUDINARY_AVAILABLE:
        return ""
    try:
        result = cloudinary.uploader.upload(
            img_path,
            public_id=f"digital_chef/recipes/{public_id}",
            overwrite=False,
            resource_type="image",
            transformation=[{"width": 800, "height": 600, "crop": "fill", "quality": "auto"}],
        )
        return result.get("secure_url", "")
    except Exception as e:
        print(f"  ⚠ Cloudinary upload failed for {public_id}: {e}")
        return ""


def slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:80]


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv",   required=True, help="Path to Kaggle CSV")
    parser.add_argument("--imgs",  default=None,  help="Path to food images folder")
    parser.add_argument("--limit", type=int, default=None, help="Seed only first N recipes")
    parser.add_argument("--drop",  action="store_true", help="Drop collection before inserting")
    args = parser.parse_args()

    # ── Connect to MongoDB ────────────────────────────────────────────────────
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        print("❌ MONGODB_URI not set. Add it to .env.local or export it.")
        sys.exit(1)

    db_name = os.environ.get("MONGODB_DB", "digital_chef")
    client = MongoClient(uri)
    db = client[db_name]
    col = db["recipes"]

    if args.drop:
        col.drop()
        print("🗑  Dropped existing recipes collection.")

    # ── Read CSV ──────────────────────────────────────────────────────────────
    print(f"📂 Reading CSV: {args.csv}")
    df = pd.read_csv(args.csv)
    df = df.dropna(subset=["Title", "Instructions"])
    if args.limit:
        df = df.head(args.limit)
    print(f"   {len(df):,} recipes to process.")

    imgs_dir = Path(args.imgs) if args.imgs else None
    if imgs_dir and CLOUDINARY_AVAILABLE:
        print(f"📸 Images: {imgs_dir} → Cloudinary")
    elif imgs_dir:
        print("📸 Image folder set but Cloudinary not configured — images will be skipped.")

    # ── Build and insert documents ────────────────────────────────────────────
    docs = []
    skipped = 0

    for _, row in tqdm(df.iterrows(), total=len(df), desc="Building documents"):
        title = str(row["Title"]).strip()
        if not title:
            skipped += 1
            continue

        slug        = str(row.get("Image_Name", "")).strip() or slugify(title)
        ingredients = parse_ingredient_list(row.get("Cleaned_Ingredients") or row.get("Ingredients", "[]"))
        instructions= parse_instructions(row.get("Instructions", ""))

        if not instructions:
            skipped += 1
            continue

        # Image: upload to Cloudinary if available, else empty string
        image_url = ""
        if imgs_dir and CLOUDINARY_AVAILABLE and slug:
            img_path = imgs_dir / f"{slug}.jpg"
            if img_path.exists():
                image_url = upload_image(str(img_path), slug)

        doc = {
            "title":              title,
            "slug":               slug,
            "image":              image_url,
            "summary":            "",                # Kaggle has no summaries
            "readyInMinutes":     30,                # Kaggle has no timing — default
            "preparationMinutes": 10,
            "cookingMinutes":     20,
            "servings":           4,                 # Kaggle has no servings — default
            "cuisine":            "International",   # Kaggle has no cuisine — default
            "diets":              [],
            "dishTypes":          [],
            "ingredients":        ingredients,
            "instructions":       instructions,
            "nutrition":          None,
            "source":             "kaggle",
            "createdAt":          datetime.now(timezone.utc),
        }
        docs.append(doc)

    print(f"\n✅ Built {len(docs):,} documents ({skipped} skipped).")

    # ── Insert in batches ─────────────────────────────────────────────────────
    BATCH = 500
    inserted = 0
    for i in range(0, len(docs), BATCH):
        batch = docs[i : i + BATCH]
        result = col.insert_many(batch, ordered=False)
        inserted += len(result.inserted_ids)

    print(f"✅ Inserted {inserted:,} recipes into {db_name}.recipes")

    # ── Create text index for search ──────────────────────────────────────────
    col.create_index([("title", TEXT), ("ingredients.name", TEXT)], name="recipe_text_search")
    col.create_index("slug", unique=True, sparse=True)
    col.create_index("cuisine")
    col.create_index("diets")
    print("✅ Indexes created.")

    client.close()
    print("\n🍽️  Seeding complete!")


if __name__ == "__main__":
    main()
