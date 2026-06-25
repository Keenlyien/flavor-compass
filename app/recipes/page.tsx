import { Suspense } from "react"
import RecipesView from "@/components/recipes/RecipesView"
import RecipesLoading from "./loading"

export default function RecipesPage() {
  return (
    <Suspense fallback={<RecipesLoading />}>
      <RecipesView />
    </Suspense>
  )
}
