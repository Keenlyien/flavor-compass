"""
create_indexes.py
=================
Creates the MongoDB indexes needed for fast queries.
Run once — safe to re-run (MongoDB skips existing indexes).

  python create_indexes.py
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import os, certifi
from pymongo import MongoClient, ASCENDING, DESCENDING, TEXT
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path("D:/projects/digital_chef/.env.local"))
MONGO_URI = os.environ.get("MONGODB_URI", "")
MONGO_DB  = os.environ.get("MONGODB_DB", "digital_chef")
if not MONGO_URI:
    sys.exit("MONGODB_URI not set.")

client = MongoClient(MONGO_URI, tlsCAFile=certifi.where(),
                     socketTimeoutMS=60000, connectTimeoutMS=30000)
col = client[MONGO_DB]["recipes"]

indexes = [
    # Sort fields — without these every sort is a full 13k-doc scan
    ([("readyInMinutes", ASCENDING)],  "sort_by_time"),
    ([("healthScore",    DESCENDING)], "sort_by_health"),
    ([("createdAt",      DESCENDING)], "sort_by_popularity"),
    # Filter fields — exact match on array elements
    ([("cuisines", ASCENDING)], "filter_cuisine"),
    ([("diets",    ASCENDING)], "filter_diet"),
    # Compound: filter + sort (covers the most common combined queries)
    ([("cuisines", ASCENDING), ("createdAt",      DESCENDING)], "cuisine_popularity"),
    ([("cuisines", ASCENDING), ("readyInMinutes",  ASCENDING)], "cuisine_time"),
    ([("cuisines", ASCENDING), ("healthScore",     DESCENDING)], "cuisine_health"),
    ([("diets",    ASCENDING), ("createdAt",       DESCENDING)], "diet_popularity"),
    # Text search index for the q= search param
    ([("title", TEXT), ("ingredients.raw", TEXT)], "text_search"),
]

print(f"[+] Creating indexes on '{MONGO_DB}.recipes'...\n")
for keys, name in indexes:
    try:
        result = col.create_index(keys, name=name, background=True)
        print(f"  OK  {name}")
    except Exception as e:
        # Index already exists with same spec = fine; different spec = warn
        if "already exists" in str(e).lower() or "IndexKeySpecsConflict" in str(e):
            print(f"  --  {name} (already exists)")
        else:
            print(f"  !!  {name}: {e}")

# Image collections — simple name lookups, always fast but worth confirming
for col_name in ["cuisine_images", "diet_images", "ingredient_images", "recipe_hero_images"]:
    try:
        c = client[MONGO_DB][col_name]
        field = "recipeId" if col_name == "recipe_hero_images" else "name"
        c.create_index([(field, ASCENDING)], unique=True, background=True)
        print(f"  OK  {col_name}.{field} (unique)")
    except Exception as e:
        if "already exists" in str(e).lower():
            print(f"  --  {col_name}.{field} (already exists)")
        else:
            print(f"  !!  {col_name}: {e}")

print(f"\n[+] Done. Run 'python create_indexes.py' any time — safe to repeat.")
client.close()
