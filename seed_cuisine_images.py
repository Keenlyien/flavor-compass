"""
seed_cuisine_images.py
======================
Pre-fetches Pexels images for every cuisine and caches them in MongoDB.
Run this once before deploying so cuisine images load instantly.

Usage:
  python seed_cuisine_images.py
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import os
import requests
import certifi
from pathlib import Path
from datetime import datetime, timezone
from pymongo import MongoClient

try:
    from dotenv import load_dotenv
    load_dotenv(Path("D:/projects/digital_chef/.env.local"))
except ImportError:
    pass

MONGO_URI = os.environ.get("MONGODB_URI", "")
MONGO_DB  = os.environ.get("MONGODB_DB", "digital_chef")
PEXELS_KEY = os.environ.get("NEXT_PUBLIC_PEXELS_API_KEY", "")

if not MONGO_URI:
    sys.exit("MONGODB_URI not set.")
if not PEXELS_KEY:
    sys.exit("NEXT_PUBLIC_PEXELS_API_KEY not set.")

client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
col    = client[MONGO_DB]["cuisine_images"]

# Cuisine -> specific Pexels query for best food photography
CUISINE_QUERIES = {
    "italian":        "italian pasta carbonara spaghetti food photography",
    "japanese":       "japanese ramen bowl food photography",
    "mexican":        "authentic mexican tacos street food",
    "french":         "french cuisine croissant baguette food photography",
    "thai":           "thai green curry pad thai food",
    "indian":         "indian butter chicken curry spices",
    "chinese":        "chinese dim sum dumplings noodles food",
    "american":       "american cheeseburger food photography",
    "greek":          "greek food souvlaki mezze",
    "spanish":        "spanish paella seafood food photography",
    "korean":         "korean bibimbap food photography",
    "mediterranean":  "mediterranean food hummus pita",
    "middle eastern": "middle eastern falafel shawarma food",
    "filipino":       "filipino food adobo lechon",
    "international":  "world cuisine gourmet food photography",
}

session = requests.Session()
session.headers.update({"Authorization": PEXELS_KEY})

def fetch_pexels(query):
    try:
        r = session.get(
            "https://api.pexels.com/v1/search",
            params={"query": query, "per_page": 1, "orientation": "square", "size": "medium"},
            timeout=10
        )
        data = r.json()
        return data.get("photos", [{}])[0].get("src", {}).get("medium", "")
    except Exception as e:
        print(f"  Pexels error: {e}")
        return ""

print("\n[+] Seeding cuisine images...\n")
now = datetime.now(timezone.utc)
found = 0

for cuisine, query in CUISINE_QUERIES.items():
    # Skip if already cached
    existing = col.find_one({"name": cuisine})
    if existing and existing.get("url"):
        print(f"  [skip] {cuisine} (already cached)")
        found += 1
        continue

    url = fetch_pexels(query)
    status = "OK" if url else "NO IMAGE"

    col.update_one(
        {"name": cuisine},
        {"$set": {"name": cuisine, "url": url, "cachedAt": now}},
        upsert=True
    )

    if url:
        found += 1
        print(f"  [OK]   {cuisine}")
    else:
        print(f"  [miss] {cuisine}")

col.create_index("name", unique=True, background=True)

print(f"\n[+] Done! {found}/{len(CUISINE_QUERIES)} cuisines have images.")
client.close()
