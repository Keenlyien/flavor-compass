"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Navbar from "@/components/layout/Navbar"
import type { RecipeDetailData, RecipeIngredient } from "@/lib/types/recipe"
import { optimizeImage } from "@/lib/image"
import { formatTime } from "@/lib/time"
import { Clock, Users, ChefHat, ArrowLeft, Flame, CheckCircle2 } from "lucide-react"


/* ─── Ingredient image — TheMealDB illustrated only ─── */
function IngredientImage({ name }: { name: string }) {
  const [url, setUrl]         = useState<string | null>(null)
  const [loaded, setLoaded]   = useState(false)
  const [errored, setErrored] = useState(false)
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    if (!name) { setFetched(true); return }
    fetch(`/api/ingredient-image?name=${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(d => { setUrl(d.url || null); setFetched(true) })
      .catch(() => { setUrl(null); setFetched(true) })
  }, [name])

  return (
    <div style={{
      width: "44px",
      height: "44px",
      borderRadius: "6px",
      flexShrink: 0,
      overflow: "hidden",
      backgroundColor: "var(--bg-accent-strip)",
      border: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    }}>
      {/* Shimmer while fetching */}
      {!fetched && (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg, var(--bg-accent-strip) 25%, var(--border) 50%, var(--bg-accent-strip) 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.4s infinite",
        }} />
      )}

      {/* TheMealDB image */}
      {url && !errored && (
        <img
          src={url}
          alt={name}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          style={{
            width: "88%",
            height: "88%",
            objectFit: "contain",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.2s ease",
          }}
        />
      )}

      {/* Neutral placeholder when no image found */}
      {fetched && (!url || errored) && (
        <div style={{
          width: "100%", height: "100%",
          background: "linear-gradient(135deg, var(--bg-accent-strip) 0%, var(--border) 100%)",
          display: "flex", alignItems: "center",
          justifyContent: "center",
          fontSize: "18px", opacity: 0.5,
        }}>
          ✦
        </div>
      )}
    </div>
  )
}

/* ─── Ingredient row ─── */
function IngredientRow({
  ingredient,
  checked,
  onToggle,
}: {
  ingredient: RecipeIngredient
  checked: boolean
  onToggle: () => void
}) {
  const text = ingredient.raw || ingredient.name

  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 0",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        opacity: checked ? 0.38 : 1,
        transition: "opacity 0.15s ease",
      }}
    >
      <IngredientImage name={ingredient.name || text} />

      <span style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: "13px",
        color: "var(--text-secondary)",
        flex: 1,
        lineHeight: 1.4,
        textDecoration: checked ? "line-through" : "none",
      }}>
        {text}
      </span>

      <CheckCircle2
        size={16}
        strokeWidth={1.5}
        style={{
          flexShrink: 0,
          color: checked ? "var(--accent-green)" : "var(--border)",
          transition: "color 0.15s ease",
        }}
      />
    </div>
  )
}

/* ─── Main component ─── */
export default function RecipeDetail({ id }: { id: string }) {
  const [recipe, setRecipe]       = useState<RecipeDetailData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [checked, setChecked]     = useState<Set<number>>(new Set())
  const [heroUrl, setHeroUrl]     = useState("")
  const [heroLoaded, setHeroLoaded] = useState(false)

  const toggleIngredient = (idx: number) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/recipes/${id}`)
        if (!res.ok) throw new Error("api error")
        setRecipe(await res.json())
      } catch {
        const { getMockDetail } = await import("@/lib/db/mock")
        setRecipe(getMockDetail(id))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Fetch a high-resolution hero photo matching the recipe title.
  // Falls back silently to the enhanced Cloudinary image if none found.
  useEffect(() => {
    if (!recipe?.title) return
    fetch(`/api/recipe-hero?id=${encodeURIComponent(id)}&title=${encodeURIComponent(recipe.title)}`)
      .then(r => r.json())
      .then(d => { if (d.url) setHeroUrl(d.url) })
      .catch(() => {})
  }, [id, recipe?.title])



  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>
        <Navbar />
        <div className="recipe-grid" style={{ paddingTop: "64px" }}>
          <div style={{ backgroundColor: "var(--bg-accent-strip)", minHeight: "300px" }} />
          <div style={{ padding: "48px 32px" }}>
            {[60, 40, 90, 70, 85, 55].map((w, i) => (
              <div key={i} style={{
                height: "14px", width: `${w}%`,
                backgroundColor: "var(--bg-accent-strip)",
                borderRadius: "2px", marginBottom: "14px",
              }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!recipe) return null

  const optimizedImage = optimizeImage(recipe.image, 900)

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>
      <Navbar />

      {/* Back button */}
      <div style={{ position: "fixed", top: "80px", left: "24px", zIndex: 40 }}>
        <Link
          href="/recipes"
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            color: "var(--text-secondary)",
            padding: "7px 14px", borderRadius: "100px",
            fontFamily: "'DM Sans', sans-serif", fontSize: "12px",
            textDecoration: "none",
            boxShadow: "0 2px 8px var(--shadow-card)",
            backdropFilter: "blur(8px)",
          }}
        >
          <ArrowLeft size={13} strokeWidth={1.5} />
          Back
        </Link>
      </div>

      {/* ── LAYOUT ── */}
      <div
        className="recipe-grid"
        style={{
          paddingTop: "64px",
          display: "grid",
          gridTemplateColumns: "45% 55%",
          minHeight: "calc(100vh - 64px)",
          alignItems: "start",
        }}
      >

        {/* LEFT — sticky image + meta */}
        <div
          className="recipe-image-pane"
          style={{
            position: "sticky",
            top: "64px",
            height: "calc(100vh - 64px)",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "relative", height: "100%", backgroundColor: "var(--bg-accent-strip)" }}>
            {optimizedImage ? (
              <img
                src={optimizedImage}
                alt={recipe.title}
                style={{
                  width: "100%", height: "100%",
                  objectFit: "cover",
                  objectPosition: "center top",
                }}
              />
            ) : (
              <div style={{
                width: "100%", height: "100%",
                display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: "80px", opacity: 0.3,
              }}>
                🍽️
              </div>
            )}

            {/* High-res Pexels hero — crossfades over the Cloudinary
                image once loaded. Improves on low-resolution source
                images without affecting grid/card thumbnails. */}
            {heroUrl && (
              <img
                src={heroUrl}
                alt={recipe.title}
                onLoad={() => setHeroLoaded(true)}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover",
                  objectPosition: "center top",
                  opacity: heroLoaded ? 1 : 0,
                  transition: "opacity 0.5s ease",
                }}
              />
            )}

            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              height: "180px",
              background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)",
            }} />

            {/* Meta stats */}
            <div style={{
              position: "absolute",
              bottom: "28px", left: "28px", right: "28px",
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "1px",
            }}>
              {[
                { icon: <Clock size={11} strokeWidth={1.5} />, label: "Total",  value: formatTime(recipe.readyInMinutes) },
                { icon: <Clock size={11} strokeWidth={1.5} />, label: "Prep",   value: formatTime(recipe.preparationMinutes) },
                { icon: <Flame size={11} strokeWidth={1.5} />, label: "Cook",   value: formatTime(recipe.cookingMinutes) },
                { icon: <Users size={11} strokeWidth={1.5} />, label: "Serves", value: String(recipe.servings) },
              ].map(m => (
                <div key={m.label} style={{
                  backgroundColor: "rgba(0,0,0,0.42)",
                  backdropFilter: "blur(8px)",
                  padding: "10px 12px", textAlign: "center",
                }}>
                  <div style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "center", gap: "4px",
                    color: "rgba(255,255,255,0.5)", marginBottom: "4px",
                  }}>
                    {m.icon}
                    <span style={{
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase",
                    }}>
                      {m.label}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "20px", fontWeight: 300,
                    color: "#FFFFFF", lineHeight: 1,
                  }}>
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — scrollable content */}
        <div
          className="recipe-content-pane"
          style={{ padding: "52px 52px 80px 52px", maxWidth: "680px" }}
        >
          {/* Tags */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <span style={{
              fontFamily: "'Courier Prime', monospace", fontSize: "9px",
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: "var(--accent-warm)", border: "1px solid var(--accent-warm)",
              padding: "4px 10px", borderRadius: "2px",
            }}>
              {recipe.cuisine}
            </span>
            {recipe.dishTypes?.[0] && (
              <span style={{
                fontFamily: "'Courier Prime', monospace", fontSize: "9px",
                letterSpacing: "0.14em", textTransform: "uppercase",
                color: "var(--text-muted)", border: "1px solid var(--border)",
                padding: "4px 10px", borderRadius: "2px",
              }}>
                {recipe.dishTypes[0]}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontWeight: 300, fontSize: "clamp(32px, 3.5vw, 52px)",
            lineHeight: 1.08, color: "var(--text-primary)",
            letterSpacing: "0.01em", marginBottom: "36px",
          }}>
            {recipe.title}
          </h1>

          {/* INGREDIENTS */}
          {recipe.ingredients.length > 0 && (
            <div style={{ marginBottom: "48px" }}>
              <div style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between", marginBottom: "16px",
              }}>
                <h2 style={{
                  fontFamily: "'Cormorant Garamond', serif", fontWeight: 400,
                  fontSize: "22px", color: "var(--text-primary)", letterSpacing: "0.02em",
                }}>
                  Ingredients
                </h2>
                <span style={{
                  fontFamily: "'Courier Prime', monospace", fontSize: "9px",
                  letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)",
                }}>
                  {recipe.servings} servings · tap to check off
                </span>
              </div>
              <div>
                {recipe.ingredients
                  .filter(ing => {
                    const text = (ing.raw || ing.name || "").trim().toLowerCase()
                    if (!text || text.length < 3) return false
                    // Single-word cooking descriptors that appear as separate
                    // Kaggle rows (e.g. "melted", "divided", "softened") —
                    // these are preparation notes, not real ingredients.
                    const DESCRIPTOR_ONLY = new Set([
                      "melted","divided","softened","beaten","sifted","thawed",
                      "drained","optional","cooled","chilled","toasted",
                      "roasted","cooked","boiled","chopped","minced","sliced",
                      "diced","shredded","crumbled","strained","squeezed",
                      "peeled","pitted","seeded","trimmed","halved","quartered",
                      "rinsed","patted","dry","room","temperature","warm","cold",
                      "hot","fresh","frozen","canned","packed","heaped","level",
                    ])
                    const words = text.split(/\s+/)
                    if (words.length === 1 && DESCRIPTOR_ONLY.has(words[0])) return false
                    // Two-word pairs like "room temperature", "finely chopped"
                    if (words.length === 2) {
                      const PREP_PAIRS = new Set([
                        "room temperature","finely chopped","coarsely chopped",
                        "thinly sliced","roughly chopped","freshly ground",
                        "lightly beaten","well drained","pat dry","to taste",
                      ])
                      if (PREP_PAIRS.has(text)) return false
                    }
                    return true
                  })
                  .map((ing, i) => (
                    <IngredientRow
                      key={i}
                      ingredient={ing}
                      checked={checked.has(i)}
                      onToggle={() => toggleIngredient(i)}
                    />
                  ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: "1px solid var(--border)", marginBottom: "40px" }} />

          {/* INSTRUCTIONS */}
          {recipe.instructions.length > 0 && (
            <div style={{ marginBottom: "52px" }}>
              <h2 style={{
                fontFamily: "'Cormorant Garamond', serif", fontWeight: 400,
                fontSize: "22px", color: "var(--text-primary)",
                letterSpacing: "0.02em", marginBottom: "24px",
              }}>
                Instructions
              </h2>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {recipe.instructions.map((step, i) => (
                  <div key={step.number} style={{
                    display: "flex", gap: "20px", padding: "20px 0",
                    borderBottom: i < recipe.instructions.length - 1
                      ? "1px solid var(--border)" : "none",
                  }}>
                    <div style={{
                      flexShrink: 0, width: "36px", height: "36px",
                      border: "1px solid var(--accent-warm)", borderRadius: "2px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{
                        fontFamily: "'Courier Prime', monospace",
                        fontSize: "11px", fontWeight: 700,
                        color: "var(--accent-warm)", letterSpacing: "0.04em",
                      }}>
                        {String(step.number).padStart(2, "0")}
                      </span>
                    </div>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "14px", lineHeight: 1.8,
                      color: "var(--text-secondary)", paddingTop: "7px",
                    }}>
                      {step.step}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div style={{
            backgroundColor: "var(--bg-accent-strip)",
            border: "1px solid var(--border-card)",
            borderRadius: "4px", padding: "28px 32px",
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            gap: "20px", flexWrap: "wrap",
          }}>
            <div>
              <h3 style={{
                fontFamily: "'Cormorant Garamond', serif", fontWeight: 400,
                fontSize: "22px", color: "var(--text-primary)", marginBottom: "4px",
              }}>
                Ready to cook?
              </h3>
              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px", color: "var(--text-muted)",
              }}>
                Follow the step-by-step walkthrough with built-in timers.
              </p>
            </div>
            <Link
              href={`/recipes/${id}/cook`}
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                backgroundColor: "var(--text-primary)", color: "var(--text-inverse)",
                padding: "12px 28px", borderRadius: "100px",
                fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                fontSize: "13px", textDecoration: "none",
                whiteSpace: "nowrap", transition: "opacity 0.15s ease",
              }}
              className="hover:opacity-80"
            >
              <ChefHat size={15} strokeWidth={1.5} />
              Start Cooking
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }

        /* ── Desktop: side-by-side ── */
        .recipe-grid {
          display: grid;
          grid-template-columns: 45% 55%;
          min-height: calc(100vh - 64px);
          align-items: start;
        }
        .recipe-image-pane {
          position: sticky;
          top: 64px;
          height: calc(100vh - 64px);
          overflow: hidden;
        }
        .recipe-content-pane {
          padding: 52px 52px 80px 52px;
          max-width: 680px;
        }

        /* ── Mobile: stacked ── */
        @media (max-width: 768px) {
          .recipe-grid {
            grid-template-columns: 1fr !important;
          }
          .recipe-image-pane {
            position: relative !important;
            top: 0 !important;
            height: 320px !important;
          }
          .recipe-content-pane {
            padding: 28px 20px 60px 20px !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  )
}
