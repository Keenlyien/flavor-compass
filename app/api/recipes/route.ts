import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db/mongodb"
import { MOCK_CARDS } from "@/lib/db/mock"
import type { RecipeCardData } from "@/lib/types/recipe"
import { ObjectId } from "mongodb"

const PAGE_SIZE = 12

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const q        = searchParams.get("q")?.trim() ?? ""
  const cuisine  = searchParams.get("cuisine")?.trim() ?? ""
  const diet     = searchParams.get("diet")?.trim() ?? ""
  const sort     = searchParams.get("sort") ?? "popularity"
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit    = Math.min(48, parseInt(searchParams.get("limit") ?? String(PAGE_SIZE)))
  const featured = searchParams.get("featured") === "true"

  /* ── MongoDB path ── */
  const db = await getDb()
  if (db) {
    try {
      const col = db.collection("recipes")

      // Build filter
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filter: Record<string, any> = {}
      if (q) filter.$text = { $search: q }

      // Filter against the `cuisines` array (not the old singular `cuisine`
      // field) so multi-cuisine recipes — e.g. a dish tagged BOTH Korean
      // and Mexican — are correctly matched no matter which of its
      // cuisines the person filters by. MongoDB's $regex against an
      // array field matches if ANY element satisfies it, so this just
      // works without needing $elemMatch.
      // Exact title-case match — update_recipe_data.py stores cuisines/diets
      // as title case ("Italian", "Vegetarian") while the UI sends lowercase.
      // Exact string match uses a MongoDB index; no collection scan needed.
      // Cuisines stored as title case ("Italian"), diets as lowercase ("vegetarian")
      const toTitle = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
      if (cuisine) filter.cuisines = toTitle(cuisine)
      if (diet)    filter.diets    = diet.toLowerCase()

      // Build sort
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sortOpt: Record<string, any> =
        sort === "time"        ? { readyInMinutes: 1 } :
        sort === "healthiness" ? { healthScore: -1 } :  // highest score (healthiest) first
        { createdAt: -1 } // default / popularity = insertion order

      const skip = (page - 1) * limit

      const [docs, total] = await Promise.all([
        col.find(filter).sort(sortOpt).skip(skip).limit(featured ? 4 : limit).toArray(),
        col.countDocuments(filter),
      ])

      const recipes: RecipeCardData[] = docs.map(doc => ({
        id:             (doc._id as ObjectId).toHexString(),
        title:          doc.title,
        image:          doc.image ?? "",
        // doc.cuisine is kept in sync as cuisines[0] by update_recipe_data.py,
        // so the card still shows a single primary cuisine badge.
        cuisine:        doc.cuisine ?? "International",
        readyInMinutes: doc.readyInMinutes ?? 30,
        servings:       doc.servings ?? 4,
        diets:          doc.diets ?? [],
      }))

      return NextResponse.json({ recipes, total }, {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      })
    } catch (err) {
      console.error("[/api/recipes] MongoDB error:", err)
      // Fall through to mock
    }
  }

  /* ── Mock fallback ── */
  let results = [...MOCK_CARDS]

  if (q)       results = results.filter(r => r.title.toLowerCase().includes(q.toLowerCase()))
  if (cuisine) results = results.filter(r => r.cuisine.toLowerCase().includes(cuisine.toLowerCase()))
  if (diet)    results = results.filter(r => r.diets?.some(d => d.toLowerCase().includes(diet.toLowerCase())))

  if (sort === "time") results.sort((a, b) => a.readyInMinutes - b.readyInMinutes)
  // Note: mock data has no healthScore field, so "healthiness" sort has
  // no effect on the mock fallback — this only matters in dev environments
  // without MongoDB configured, real data always goes through the path above.

  const total = results.length
  const paged = featured ? results.slice(0, 4) : results.slice((page - 1) * limit, page * limit)

  return NextResponse.json({ recipes: paged, total })
}
