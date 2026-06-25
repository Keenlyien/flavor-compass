import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db/mongodb"

/* ── Cuisine-specific Pexels search queries ──────────────────────────────
   These are tuned to return beautiful, representative food photos.
──────────────────────────────────────────────────────────────────────── */
const CUISINE_QUERIES: Record<string, string> = {
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

async function fetchPexels(cuisine: string): Promise<string> {
  const key = process.env.NEXT_PUBLIC_PEXELS_API_KEY
  if (!key) return ""

  const query = CUISINE_QUERIES[cuisine.toLowerCase()] ?? `${cuisine} food photography`

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=square&size=medium`,
      { headers: { Authorization: key } }
    )
    const data = await res.json()
    return data.photos?.[0]?.src?.medium || data.photos?.[0]?.src?.small || ""
  } catch {
    return ""
  }
}

export async function GET(req: NextRequest) {
  const cuisine = req.nextUrl.searchParams.get("cuisine")?.trim().toLowerCase()
  if (!cuisine) return NextResponse.json({ url: "" })

  // 1. Check in-memory cache first (fastest — no DB roundtrip)
  const inMem = memGet(`cuisine:${cuisine}`)
  if (inMem !== null) {
    return NextResponse.json({ url: inMem }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    })
  }

  const db = await getDb()

  // 2. Check MongoDB cache
  if (db) {
    const cached = await db.collection("cuisine_images").findOne({ name: cuisine })
    if (cached) {
      memSet(`cuisine:${cached.name}`, cached.url)
      return NextResponse.json({ url: cached.url }, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
      })
    }
  }

  // Fetch from Pexels
  const url = await fetchPexels(cuisine)

  // Cache result
  if (db) {
    await db.collection("cuisine_images").updateOne(
      { name: cuisine },
      { $set: { name: cuisine, url, cachedAt: new Date() } },
      { upsert: true }
    )
  }

  memSet(`cuisine:${cuisine}`, url)
  return NextResponse.json({ url }, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  })
}
