"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Clock, ArrowRight } from "lucide-react"
import type { RecipeCardData } from "@/lib/types/recipe"
import { optimizeImage } from "@/lib/image"
import { formatTime } from "@/lib/time"

/* ── Single featured card with Cloudinary base + Pexels crossfade ───
   Reuses the same /api/recipe-hero endpoint built for the recipe
   detail page — same MongoDB cache, so a recipe that's already been
   visited (or featured before) loads instantly from cache. The raw
   Kaggle/Cloudinary image shows immediately so nothing is ever blank;
   the sharp Pexels photo fades in on top once it's ready.
──────────────────────────────────────────────────────────────────── */
function FeaturedCard({
  recipe,
  index,
  mounted,
}: {
  recipe: RecipeCardData
  index: number
  mounted: boolean
}) {
  const [heroUrl, setHeroUrl]       = useState("")
  const [heroLoaded, setHeroLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/recipe-hero?id=${encodeURIComponent(recipe.id)}&title=${encodeURIComponent(recipe.title)}`)
      .then(r => r.json())
      .then(d => { if (d.url) setHeroUrl(d.url) })
      .catch(() => {})
  }, [recipe.id, recipe.title])

  const isLarge = index === 0
  const baseImage = recipe.image ? optimizeImage(recipe.image, isLarge ? 900 : 600) : ""

  return (
    <Link href={`/recipes/${recipe.id}`} style={{ textDecoration: "none" }}>
      <article
        className={`card-base ${mounted ? "anim-fade-up" : "opacity-0"}`}
        style={{
          borderRadius: "4px",
          overflow: "hidden",
          cursor: "pointer",
          animationDelay: `${index * 80}ms`,
          height: isLarge ? "380px" : "360px",
          position: "relative",
        }}
      >
        {/* Full-cover image */}
        <div style={{ position: "absolute", inset: 0 }}>
          {baseImage ? (
            <img
              src={baseImage}
              alt={recipe.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transition: "transform 0.5s ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            />
          ) : (
            <div style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(135deg, var(--bg-accent-strip) 0%, var(--bg-secondary) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: isLarge ? "56px" : "40px",
            }}>
              🍽️
            </div>
          )}

          {/* High-res Pexels hero — crossfades over the Cloudinary
              dataset image once loaded, for a clear, non-pixelated
              photo regardless of the source image's original quality. */}
          {heroUrl && (
            <img
              src={heroUrl}
              alt={recipe.title}
              onLoad={() => setHeroLoaded(true)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: heroLoaded ? 1 : 0,
                transition: "opacity 0.5s ease",
              }}
            />
          )}

          {/* Gradient overlay */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)",
          }} />
        </div>

        {/* Content overlay at bottom */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: isLarge ? "24px" : "16px",
        }}>
          <span style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: "9px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.6)",
            display: "block",
            marginBottom: "6px",
          }}>
            {recipe.cuisine}
          </span>

          <h3 style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontWeight: 300,
            fontSize: isLarge ? "22px" : "16px",
            lineHeight: 1.2,
            color: "#FFFFFF",
            marginBottom: "8px",
            letterSpacing: "0.01em",
          }}>
            {recipe.title}
          </h3>

          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "11px",
            color: "rgba(255,255,255,0.5)",
          }}>
            <Clock size={10} strokeWidth={1.5} />
            {formatTime(recipe.readyInMinutes)}
          </span>
        </div>
      </article>
    </Link>
  )
}

export default function FeaturedRecipes() {
  const [recipes, setRecipes] = useState<RecipeCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    fetch("/api/recipes?featured=true")
      .then(r => r.json())
      .then(d => setRecipes(d.recipes))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <section style={{ backgroundColor: "var(--bg-primary)", padding: "100px 0" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-12">

        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: "48px",
          flexWrap: "wrap",
          gap: "16px",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "32px", height: "1px", backgroundColor: "var(--accent-rose)" }} />
              <span style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: "10px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}>
                Editor&apos;s Picks
              </span>
            </div>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontWeight: 300,
              fontSize: "clamp(32px, 4vw, 48px)",
              color: "var(--text-primary)",
              letterSpacing: "0.01em",
              lineHeight: 1.08,
            }}>
              Recipes worth making{" "}
              <em style={{ fontStyle: "italic", color: "var(--accent-warm)" }}>tonight.</em>
            </h2>
          </div>

          <Link
            href="/recipes"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "var(--text-secondary)",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: 400,
              textDecoration: "none",
              borderBottom: "1px solid var(--border)",
              paddingBottom: "2px",
              alignSelf: "flex-end",
            }}
            className="hover:opacity-60 transition-opacity"
          >
            View all recipes
            <ArrowRight size={12} strokeWidth={2} />
          </Link>
        </div>

        {/* Grid — 4 cards, first one larger */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "16px", height: "360px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: "var(--bg-accent-strip)",
                  borderRadius: "4px",
                }}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "16px" }}>
            {recipes.map((recipe, i) => (
              <FeaturedCard key={recipe.id} recipe={recipe} index={i} mounted={mounted} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
