import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db/mongodb"

/* ── Server-side in-memory cache — instant on repeat requests within
   the same server process, same pattern as the other image routes. ── */
const _memCache = new Map<string, { urls: string[]; ts: number }>()
const MEM_TTL = 30 * 60 * 1000 // 30 minutes

function memGet(key: string): string[] | null {
  const hit = _memCache.get(key)
  if (hit && Date.now() - hit.ts < MEM_TTL) return hit.urls
  return null
}
function memSet(key: string, urls: string[]) {
  _memCache.set(key, { urls, ts: Date.now() })
}

/* ── Same per-cuisine queries used elsewhere in the app, kept in sync
   so photos feel consistent across the parallax background, filter
   pills, and cuisine tiles. ── */
const CUISINE_QUERIES: Record<string, string> = {
  "":             "gourmet food photography colorful dishes",
  italian:        "italian pasta carbonara food photography",
  japanese:       "japanese ramen sushi bowl food photography",
  mexican:        "mexican tacos enchiladas food photography",
  french:         "french cuisine baguette croissant food",
  thai:           "thai green curry pad thai food",
  indian:         "indian curry butter chicken spices",
  chinese:        "chinese noodles dim sum fried rice",
  american:       "american burger bbq ribs food photography",
  greek:          "greek souvlaki mezze food photography",
  korean:         "korean bibimbap bulgogi food photography",
  spanish:        "spanish paella seafood food photography",
}

async function fetchPexelsMulti(cuisine: string, count: number, orientation: string): Promise<string[]> {
  const key = process.env.NEXT_PUBLIC_PEXELS_API_KEY
  if (!key) return []

  const query = CUISINE_QUERIES[cuisine.toLowerCase()] ?? `${cuisine} food photography`

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=${orientation}&size=large`,
      { headers: { Authorization: key } }
    )
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.photos as any[] ?? [])
      .map((p) => p.src?.[orientation] || p.src?.original || p.src?.large2x || p.src?.large || "")
      .filter(Boolean)
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const cuisine     = req.nextUrl.searchParams.get("cuisine")?.trim().toLowerCase() ?? ""
  const count       = Math.min(10, Math.max(1, parseInt(req.nextUrl.searchParams.get("count") ?? "3")))
  const orientation = req.nextUrl.searchParams.get("orientation") === "landscape" ? "landscape" : "portrait"
  const cacheKey    = `${cuisine}:${count}:${orientation}`

  // 1. In-memory cache first — fastest, no DB roundtrip
  const inMem = memGet(cacheKey)
  if (inMem !== null) {
    return NextResponse.json({ urls: inMem }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    })
  }

  const db = await getDb()

  // 2. MongoDB cache — shared across all users/sessions, avoids
  // repeat Pexels calls entirely once any single visitor triggers
  // the first fetch for a given cuisine + count combination.
  if (db) {
    const cached = await db.collection("cuisine_images_multi").findOne({ key: cacheKey })
    if (cached && Array.isArray(cached.urls) && cached.urls.length > 0) {
      memSet(cacheKey, cached.urls)
      return NextResponse.json({ urls: cached.urls }, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
      })
    }
  }

  // 3. Fetch fresh from Pexels — only happens once per cuisine+count
  // combination across ALL users, since it's cached in MongoDB after.
  const urls = await fetchPexelsMulti(cuisine, count, orientation)

  if (db && urls.length > 0) {
    await db.collection("cuisine_images_multi").updateOne(
      { key: cacheKey },
      { $set: { key: cacheKey, cuisine, count, orientation, urls, cachedAt: new Date() } },
      { upsert: true }
    )
  }

  memSet(cacheKey, urls)
  return NextResponse.json({ urls }, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  })
}
