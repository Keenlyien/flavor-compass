import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db/mongodb"
import { getMockDetail } from "@/lib/db/mock"
import type { RecipeDetailData } from "@/lib/types/recipe"
import { ObjectId } from "mongodb"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  /* ── MongoDB path ── */
  const db = await getDb()
  if (db) {
    try {
      const col = db.collection("recipes")

      // Support both ObjectId hex strings and slug lookups
      let doc = null
      if (ObjectId.isValid(id)) {
        doc = await col.findOne({ _id: new ObjectId(id) })
      }
      if (!doc) {
        doc = await col.findOne({ slug: id })
      }

      if (doc) {
        const recipe: RecipeDetailData = {
          id:                 (doc._id as ObjectId).toHexString(),
          title:              doc.title,
          image:              doc.image ?? "",
          summary:            doc.summary ?? "",
          readyInMinutes:     doc.readyInMinutes ?? 30,
          preparationMinutes: doc.preparationMinutes ?? 10,
          cookingMinutes:     doc.cookingMinutes ?? 20,
          servings:           doc.servings ?? 4,
          cuisine:            doc.cuisine ?? "International",
          diets:              doc.diets ?? [],
          dishTypes:          doc.dishTypes ?? [],
          ingredients:        doc.ingredients ?? [],
          instructions:       doc.instructions ?? [],
          nutrition:          doc.nutrition ?? undefined,
          creditsText:        doc.creditsText ?? undefined,
        }
        return NextResponse.json(recipe)
      }
    } catch (err) {
      console.error("[/api/recipes/[id]] MongoDB error:", err)
      // Fall through to mock
    }
  }

  /* ── Mock fallback ── */
  return NextResponse.json(getMockDetail(id))
}
