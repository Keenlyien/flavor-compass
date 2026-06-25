import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db/mongodb"

/* ── Diet-specific Pexels search queries — tuned for representative photos ── */
const DIET_QUERIES: Record<string, string> = {
  "vegetarian":  "fresh vegetables colorful food photography",
  "vegan":       "vegan buddha bowl plant based food",
  "gluten free": "quinoa grains gluten free bowl food",
  "ketogenic":   "keto low carb avocado eggs food",
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

async function fetchPexels(diet: string): Promise<string> {
  const key = process.env.NEXT_PUBLIC_PEXELS_API_KEY
  if (!key) return ""

  const query = DIET_QUERIES[diet.toLowerCase()] ?? `${diet} food photography`

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
  const diet = req.nextUrl.searchParams.get("diet")?.trim().toLowerCase()
  if (!diet) return NextResponse.json({ url: "" })

  const inMem = memGet(`diet:${diet}`)
  if (inMem !== null) {
    return NextResponse.json({ url: inMem }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    })
  }

  const db = await getDb()

  if (db) {
    const cached = await db.collection("diet_images").findOne({ name: diet })
    if (cached) {
      memSet(`diet:${cached.name}`, cached.url)
      return NextResponse.json({ url: cached.url }, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
      })
    }
  }

  const url = await fetchPexels(diet)

  if (db) {
    await db.collection("diet_images").updateOne(
      { name: diet },
      { $set: { name: diet, url, cachedAt: new Date() } },
      { upsert: true }
    )
  }

  memSet(`diet:${diet}`, url)
  return NextResponse.json({ url }, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  })
}
