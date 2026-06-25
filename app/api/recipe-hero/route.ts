import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db/mongodb"

/**
 * Returns a high-resolution hero photo for a recipe, sourced from Pexels
 * and matched by recipe title. Results are cached in MongoDB per recipe id
 * so each recipe only ever triggers one Pexels request.
 *
 * This exists because the Kaggle dataset's source images are often
 * low-resolution — fine for small grid cards, but visibly blurry when
 * stretched to fill a large detail-page hero. Cloudinary's free
 * enhancement effects (e_improve, e_sharpen) can't add detail that
 * isn't present in the source, so for the hero specifically we prefer
 * a real high-res photo when one is available.
 */

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

async function fetchPexelsHero(title: string): Promise<string> {
  const key = process.env.NEXT_PUBLIC_PEXELS_API_KEY
  if (!key) return ""

  const query = `${title} food photography`

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&size=large`,
      { headers: { Authorization: key } }
    )
    if (!res.ok) return ""
    const data = await res.json()
    const photo = data.photos?.[0]
    return photo?.src?.original || photo?.src?.large2x || ""
  } catch {
    return ""
  }
}

export async function GET(req: NextRequest) {
  const id    = req.nextUrl.searchParams.get("id")?.trim()
  const title = req.nextUrl.searchParams.get("title")?.trim()

  if (!id || !title) return NextResponse.json({ url: "" })

  const inMem = memGet(`hero:${id}`)
  if (inMem !== null) {
    return NextResponse.json({ url: inMem }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    })
  }

  const db = await getDb()

  if (db) {
    const cached = await db.collection("recipe_hero_images").findOne({ recipeId: id })
    if (cached) {
      memSet(`hero:${id}`, cached.url)
      return NextResponse.json({ url: cached.url }, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
      })
    }
  }

  const url = await fetchPexelsHero(title)

  // Cache result (including empty — avoids re-querying recipes with no good match)
  if (db) {
    await db.collection("recipe_hero_images").updateOne(
      { recipeId: id },
      { $set: { recipeId: id, title, url, cachedAt: new Date() } },
      { upsert: true }
    )
  }

  memSet(`hero:${id}`, url)
  return NextResponse.json({ url }, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  })
}
