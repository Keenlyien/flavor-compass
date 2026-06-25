/* ─────────────────────────────────────────────
   Shared recipe types used across API routes,
   components, and the MongoDB data layer.
───────────────────────────────────────────── */

/** Used in cards / list views */
export interface RecipeCardData {
  id: string
  title: string
  image: string
  cuisine: string
  readyInMinutes: number
  servings: number
  diets?: string[]
}

/** A single ingredient line */
export interface RecipeIngredient {
  name: string
  amount: string | number
  unit: string
  raw?: string // original string from Kaggle / Spoonacular
}

/** A single instruction step */
export interface RecipeStep {
  number: number
  step: string
  timerSeconds?: number // pre-computed from text or Spoonacular's .length field
}

/** Full recipe detail — used by RecipeDetail, CookingWalkthrough */
export interface RecipeDetailData {
  id: string
  title: string
  image: string
  summary: string
  readyInMinutes: number
  preparationMinutes: number
  cookingMinutes: number
  servings: number
  cuisine: string
  diets: string[]
  dishTypes: string[]
  ingredients: RecipeIngredient[]
  instructions: RecipeStep[]
  nutrition?: {
    calories?: number
    carbs?: number
    fat?: number
    protein?: number
  }
  creditsText?: string
}

/** What gets stored in MongoDB (same shape, _id handled by driver) */
export interface RecipeDocument extends Omit<RecipeDetailData, "id"> {
  _id?: unknown
  slug: string        // URL-safe name (from Image_Name in Kaggle)
  source: "kaggle" | "manual"
  createdAt: Date
}
