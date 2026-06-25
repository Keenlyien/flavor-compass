import type { RecipeCardData, RecipeDetailData } from "@/lib/types/recipe"

/* ─── Card-level mock data ─── */
export const MOCK_CARDS: RecipeCardData[] = [
  { id: "1",  title: "Spaghetti alla Carbonara",   image: "", cuisine: "Italian",     readyInMinutes: 30,  servings: 4, diets: [] },
  { id: "2",  title: "Chicken Tikka Masala",        image: "", cuisine: "Indian",      readyInMinutes: 45,  servings: 4, diets: ["gluten free"] },
  { id: "3",  title: "Beef Ramen",                  image: "", cuisine: "Japanese",    readyInMinutes: 60,  servings: 2, diets: [] },
  { id: "4",  title: "Tacos al Pastor",             image: "", cuisine: "Mexican",     readyInMinutes: 35,  servings: 4, diets: [] },
  { id: "5",  title: "Coq au Vin",                  image: "", cuisine: "French",      readyInMinutes: 90,  servings: 6, diets: ["gluten free"] },
  { id: "6",  title: "Pad Thai",                    image: "", cuisine: "Thai",        readyInMinutes: 25,  servings: 2, diets: [] },
  { id: "7",  title: "Margherita Pizza",            image: "", cuisine: "Italian",     readyInMinutes: 40,  servings: 4, diets: ["vegetarian"] },
  { id: "8",  title: "Beef Bulgogi",                image: "", cuisine: "Korean",      readyInMinutes: 30,  servings: 3, diets: ["gluten free"] },
  { id: "9",  title: "Butter Chicken",              image: "", cuisine: "Indian",      readyInMinutes: 50,  servings: 4, diets: ["gluten free"] },
  { id: "10", title: "Greek Moussaka",              image: "", cuisine: "Greek",       readyInMinutes: 75,  servings: 6, diets: [] },
  { id: "11", title: "Tom Yum Soup",                image: "", cuisine: "Thai",        readyInMinutes: 30,  servings: 2, diets: ["gluten free"] },
  { id: "12", title: "Croissant au Beurre",         image: "", cuisine: "French",      readyInMinutes: 120, servings: 8, diets: ["vegetarian"] },
  { id: "13", title: "Shakshuka",                   image: "", cuisine: "Middle Eastern", readyInMinutes: 25, servings: 2, diets: ["vegetarian"] },
  { id: "14", title: "Miso Ramen",                  image: "", cuisine: "Japanese",    readyInMinutes: 40,  servings: 2, diets: [] },
  { id: "15", title: "Enchiladas Verdes",           image: "", cuisine: "Mexican",     readyInMinutes: 55,  servings: 4, diets: [] },
  { id: "16", title: "Dal Tadka",                   image: "", cuisine: "Indian",      readyInMinutes: 40,  servings: 4, diets: ["vegan", "gluten free"] },
  { id: "17", title: "Bouillabaisse",               image: "", cuisine: "French",      readyInMinutes: 80,  servings: 6, diets: [] },
  { id: "18", title: "Kimchi Fried Rice",           image: "", cuisine: "Korean",      readyInMinutes: 20,  servings: 2, diets: [] },
  { id: "19", title: "Spanakopita",                 image: "", cuisine: "Greek",       readyInMinutes: 65,  servings: 8, diets: ["vegetarian"] },
  { id: "20", title: "Green Curry",                 image: "", cuisine: "Thai",        readyInMinutes: 35,  servings: 4, diets: ["gluten free"] },
  { id: "21", title: "Risotto ai Funghi",           image: "", cuisine: "Italian",     readyInMinutes: 45,  servings: 4, diets: ["vegetarian"] },
  { id: "22", title: "Adobo Chicken",               image: "", cuisine: "Filipino",    readyInMinutes: 50,  servings: 4, diets: [] },
  { id: "23", title: "Falafel Wrap",                image: "", cuisine: "Middle Eastern", readyInMinutes: 30, servings: 3, diets: ["vegan"] },
  { id: "24", title: "Tonkatsu",                    image: "", cuisine: "Japanese",    readyInMinutes: 35,  servings: 2, diets: [] },
]

/* ─── Full detail mock (fallback for any id) ─── */
export function getMockDetail(id: string): RecipeDetailData {
  const card = MOCK_CARDS.find(c => c.id === id) ?? MOCK_CARDS[0]
  return {
    id: card.id,
    title: card.title,
    image: "",
    summary:
      "A classic dish made with carefully selected ingredients. Simple, rich, and deeply satisfying — the kind of recipe you'll come back to again and again.",
    readyInMinutes: card.readyInMinutes,
    preparationMinutes: Math.round(card.readyInMinutes * 0.35),
    cookingMinutes: Math.round(card.readyInMinutes * 0.65),
    servings: card.servings,
    cuisine: card.cuisine,
    diets: card.diets ?? [],
    dishTypes: ["main course"],
    ingredients: [
      { name: "main ingredient",    amount: 400,  unit: "g" },
      { name: "seasoning",          amount: 2,    unit: "tsp" },
      { name: "olive oil",          amount: 3,    unit: "tbsp" },
      { name: "garlic cloves",      amount: 3,    unit: "" },
      { name: "sea salt",           amount: 1,    unit: "tsp" },
      { name: "black pepper",       amount: 0.5,  unit: "tsp" },
    ],
    instructions: [
      { number: 1, step: "Prepare all ingredients and bring any liquids to temperature." },
      { number: 2, step: "Heat oil in a large pan over medium heat. Add garlic and cook until fragrant, about 1 minute.", timerSeconds: 60 },
      { number: 3, step: "Add the main ingredient and cook, stirring occasionally, until fully done.", timerSeconds: 600 },
      { number: 4, step: "Season with salt and pepper. Taste and adjust as needed." },
      { number: 5, step: "Remove from heat. Rest for a few minutes before plating." },
      { number: 6, step: "Plate and serve immediately. Enjoy!" },
    ],
    nutrition: { calories: 480, carbs: 52, fat: 18, protein: 28 },
  }
}
