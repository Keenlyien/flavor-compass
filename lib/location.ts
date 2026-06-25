import prices from "./prices.json"

export type CountryCode = keyof typeof prices

export interface LocationData {
  countryCode: CountryCode
  currency: string
  symbol: string
  city?: string
}

export interface PriceRow {
  currency: string
  symbol: string
  chicken_breast_kg: number
  eggs_dozen: number
  rice_kg: number
  onion_kg: number
  garlic_kg: number
  tomato_kg: number
  potato_kg: number
  flour_kg: number
  butter_kg: number
  olive_oil_liter: number
  milk_liter: number
  cheese_kg: number
  beef_kg: number
  pork_kg: number
  pasta_kg: number
  bread_loaf: number
  cream_liter: number
  sugar_kg: number
  salt_kg: number
  pepper_kg: number
}

/**
 * Returns the price row for a given country code.
 * Falls back to DEFAULT if country not in the table.
 */
export function getPricesForCountry(countryCode: string): PriceRow {
  const key = countryCode.toUpperCase() as CountryCode
  return (prices[key] ?? prices["DEFAULT"]) as PriceRow
}

/**
 * Spoonacular returns ingredients with name, amount, and unit.
 * This maps common ingredient names to price table keys.
 */
const INGREDIENT_MAP: Record<string, keyof PriceRow> = {
  // Proteins
  "chicken":          "chicken_breast_kg",
  "chicken breast":   "chicken_breast_kg",
  "beef":             "beef_kg",
  "ground beef":      "beef_kg",
  "steak":            "beef_kg",
  "pork":             "pork_kg",
  "bacon":            "pork_kg",
  "ham":              "pork_kg",

  // Dairy
  "egg":              "eggs_dozen",
  "eggs":             "eggs_dozen",
  "milk":             "milk_liter",
  "butter":           "butter_kg",
  "cheese":           "cheese_kg",
  "parmesan":         "cheese_kg",
  "mozzarella":       "cheese_kg",
  "cream":            "cream_liter",
  "heavy cream":      "cream_liter",
  "sour cream":       "cream_liter",

  // Grains
  "rice":             "rice_kg",
  "flour":            "flour_kg",
  "pasta":            "pasta_kg",
  "spaghetti":        "pasta_kg",
  "bread":            "bread_loaf",
  "breadcrumbs":      "bread_loaf",

  // Produce
  "onion":            "onion_kg",
  "onions":           "onion_kg",
  "garlic":           "garlic_kg",
  "tomato":           "tomato_kg",
  "tomatoes":         "tomato_kg",
  "potato":           "potato_kg",
  "potatoes":         "potato_kg",

  // Pantry
  "olive oil":        "olive_oil_liter",
  "oil":              "olive_oil_liter",
  "sugar":            "sugar_kg",
  "salt":             "salt_kg",
  "pepper":           "pepper_kg",
  "black pepper":     "pepper_kg",
}

export interface SpoonacularIngredient {
  name: string
  amount: number
  unit: string
}

export interface CostLineItem {
  name: string
  amount: number
  unit: string
  unitCost: number
  totalCost: number
  priceKey: string | null
}

/**
 * Converts a Spoonacular ingredient unit to kg/liter equivalent.
 * Returns a multiplier to apply to the amount before pricing.
 */
function normalizeToBaseUnit(amount: number, unit: string): number {
  const u = unit.toLowerCase().trim()
  // Weight conversions → kg
  if (u === "kg" || u === "kilogram" || u === "kilograms") return amount
  if (u === "g" || u === "gram" || u === "grams")           return amount / 1000
  if (u === "lb" || u === "lbs" || u === "pound")           return amount * 0.453592
  if (u === "oz" || u === "ounce" || u === "ounces")        return amount * 0.0283495
  // Volume conversions → liter
  if (u === "l" || u === "liter" || u === "liters")         return amount
  if (u === "ml" || u === "milliliter" || u === "milliliters") return amount / 1000
  if (u === "cup" || u === "cups")                          return amount * 0.236588
  if (u === "tbsp" || u === "tablespoon" || u === "tablespoons") return amount * 0.0147868
  if (u === "tsp" || u === "teaspoon" || u === "teaspoons") return amount * 0.00492892
  // Count units — eggs sold by dozen
  if (u === "" || u === "whole" || u === "large" || u === "medium") return amount / 12
  if (u === "dozen") return amount
  // Default — treat as kg
  return amount / 1000
}

/**
 * Estimates cost of a single ingredient for a given country.
 */
export function estimateIngredientCost(
  ingredient: SpoonacularIngredient,
  priceRow: PriceRow
): CostLineItem {
  const nameLower = ingredient.name.toLowerCase().trim()
  const priceKey = INGREDIENT_MAP[nameLower] ?? null

  if (!priceKey || priceKey === "currency" || priceKey === "symbol") {
    return {
      name: ingredient.name,
      amount: ingredient.amount,
      unit: ingredient.unit,
      unitCost: 0,
      totalCost: 0,
      priceKey: null,
    }
  }

  const unitCost = priceRow[priceKey] as number
  const normalizedAmount = normalizeToBaseUnit(ingredient.amount, ingredient.unit)
  const totalCost = unitCost * normalizedAmount

  return {
    name: ingredient.name,
    amount: ingredient.amount,
    unit: ingredient.unit,
    unitCost,
    totalCost: Math.round(totalCost * 100) / 100,
    priceKey,
  }
}

/**
 * Estimates total recipe cost for all ingredients.
 * Returns line items + grand total.
 */
export function estimateRecipeCost(
  ingredients: SpoonacularIngredient[],
  countryCode: string
): { lineItems: CostLineItem[]; total: number; symbol: string; currency: string } {
  const priceRow = getPricesForCountry(countryCode)
  const lineItems = ingredients.map(ing => estimateIngredientCost(ing, priceRow))
  const total = Math.round(lineItems.reduce((sum, item) => sum + item.totalCost, 0) * 100) / 100

  return {
    lineItems,
    total,
    symbol: priceRow.symbol,
    currency: priceRow.currency,
  }
}
