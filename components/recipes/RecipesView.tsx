"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Navbar from "@/components/layout/Navbar"
import RecipeCard from "@/components/recipes/RecipeCard"
import RecipeSearch from "@/components/recipes/RecipeSearch"
import RecipeFilters from "@/components/recipes/RecipeFilters"
import CuisineParallaxBackground from "@/components/recipes/CuisineParallaxBackground"
import { SlidersHorizontal, X, ChefHat, Star, Clock, HeartPulse } from "lucide-react"
import type { RecipeCardData } from "@/lib/types/recipe"

const RESULTS_PER_PAGE = 16

function sortLabel(sort: string) {
  if (sort === "time")        return { label: "Quickest",  icon: <Clock      size={11} strokeWidth={2} /> }
  if (sort === "healthiness") return { label: "Healthiest",icon: <HeartPulse size={11} strokeWidth={2} /> }
  return                             { label: "Popular",   icon: <Star       size={11} strokeWidth={2} /> }
}

export default function RecipesView() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const [query,   setQuery]   = useState(searchParams.get("q")       ?? "")
  const [cuisine, setCuisine] = useState(searchParams.get("cuisine") ?? "")
  const [diet,    setDiet]    = useState(searchParams.get("diet")    ?? "")
  const [sort,    setSort]    = useState("popularity")
  const [page,    setPage]    = useState(1)

  const [recipes,     setRecipes]     = useState<RecipeCardData[]>([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(true)
  const [showSticky,  setShowSticky]  = useState(false)

  const filterPanelRef = useRef<HTMLDivElement>(null)

  // ── Sticky bar visibility ──────────────────────────────────────
  useEffect(() => {
    const handleScroll = () => {
      if (!filterPanelRef.current) return
      setShowSticky(filterPanelRef.current.getBoundingClientRect().bottom < 0)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // ── Scroll-reveal cards ────────────────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add("card-visible")
            observer.unobserve(e.target)
          }
        })
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    )
    document.querySelectorAll(".recipe-card-reveal").forEach(c => observer.observe(c))
    return () => observer.disconnect()
  }, [recipes])

  // ── Data fetching ──────────────────────────────────────────────
  const fetchRecipes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page:  String(page),
        limit: String(RESULTS_PER_PAGE),
        sort,
        ...(query   && { q: query }),
        ...(cuisine && { cuisine }),
        ...(diet    && { diet }),
      })
      const res = await fetch(`/api/recipes?${params}`)
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      setRecipes(data.recipes)
      setTotal(data.total)
    } catch {
      setError("Could not load recipes. Please try again.")
      setRecipes([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [query, cuisine, diet, sort, page])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchRecipes()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [fetchRecipes])

  useEffect(() => { fetchRecipes() }, [fetchRecipes])

  const handleSearch = () => {
    setPage(1)
    const p = new URLSearchParams()
    if (query)   p.set("q", query)
    if (cuisine) p.set("cuisine", cuisine)
    if (diet)    p.set("diet", diet)
    router.push(`/recipes?${p.toString()}`)
  }

  const totalPages = Math.ceil(total / RESULTS_PER_PAGE)
  const sl = sortLabel(sort)

  // Active pill state for sticky bar
  const cuisineLabel = cuisine
    ? cuisine.charAt(0).toUpperCase() + cuisine.slice(1)
    : "All"

  const dietLabel = diet
    ? diet.charAt(0).toUpperCase() + diet.slice(1)
    : null

  return (
    <>
      <style>{`
        .recipe-card-reveal {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.45s ease, transform 0.45s ease;
        }
        .recipe-card-reveal.card-visible {
          opacity: 1;
          transform: translateY(0);
        }
        @keyframes pill-drop {
          from { opacity: 0; transform: translateY(-10px) scale(0.93); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .sticky-pill {
          animation: pill-drop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
      `}</style>

      <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>

        {/* Background carousel — always on, cuisine-specific or generic food */}
        <CuisineParallaxBackground cuisine={cuisine} />

        <Navbar />

        {/* ── Sticky filter pills bar ─────────────────────────────
            Slides in when the user scrolls past the filter panel.
            Shows ONLY active filter pills, each highlighted and
            with a spring entrance animation. Clicking any pill
            removes that filter and scrolls back to top.
        ──────────────────────────────────────────────────────── */}
        <div style={{
          position: "fixed",
          top: "64px",
          left: 0,
          right: 0,
          zIndex: 40,
          transform: showSticky ? "translateY(0)" : "translateY(-110%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          backgroundColor: "rgba(20,16,10,0.88)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div
            className="max-w-7xl mx-auto px-6 lg:px-12"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              height: "48px",
            }}
          >
            <span style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: "8px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.3)",
              flexShrink: 0,
              paddingRight: "4px",
            }}>
              Active
            </span>

            {/* Cuisine pill — always shown, "All" when no filter */}
            {showSticky && (
              <button
                key={`cuisine-${cuisine}`}
                className="sticky-pill"
                onClick={() => {
                  setCuisine("")
                  setPage(1)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                style={{
                  animationDelay: "0ms",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 12px",
                  borderRadius: "2px",
                  backgroundColor: cuisine ? "var(--accent-warm)" : "rgba(255,255,255,0.08)",
                  border: cuisine
                    ? "1px solid var(--accent-warm)"
                    : "1px solid rgba(255,255,255,0.15)",
                  color: "#FFFFFF",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "12px",
                  fontWeight: cuisine ? 500 : 400,
                  cursor: cuisine ? "pointer" : "default",
                  whiteSpace: "nowrap",
                }}
              >
                {cuisineLabel}
                {cuisine && <X size={10} strokeWidth={2.5} style={{ opacity: 0.7 }} />}
              </button>
            )}

            {/* Diet pill — only shown when a diet is active */}
            {showSticky && dietLabel && (
              <button
                key={`diet-${diet}`}
                className="sticky-pill"
                onClick={() => {
                  setDiet("")
                  setPage(1)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                style={{
                  animationDelay: "55ms",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 12px",
                  borderRadius: "2px",
                  backgroundColor: "var(--accent-green)",
                  border: "1px solid var(--accent-green)",
                  color: "#FFFFFF",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {dietLabel}
                <X size={10} strokeWidth={2.5} style={{ opacity: 0.7 }} />
              </button>
            )}

            {/* Sort pill — only shown when not default popularity */}
            {showSticky && sort !== "popularity" && (
              <button
                key={`sort-${sort}`}
                className="sticky-pill"
                onClick={() => {
                  setSort("popularity")
                  setPage(1)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                style={{
                  animationDelay: "110ms",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 12px",
                  borderRadius: "2px",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#FFFFFF",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {sl.icon}
                {sl.label}
                <X size={10} strokeWidth={2.5} style={{ opacity: 0.7 }} />
              </button>
            )}

            {total > 0 && (
              <span style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "11px",
                color: "rgba(255,255,255,0.3)",
                marginLeft: "4px",
                whiteSpace: "nowrap",
              }}>
                {total.toLocaleString()} recipes
              </span>
            )}

            <div style={{ flex: 1 }} />

            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "11px",
                color: "rgba(255,255,255,0.35)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 8px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              ↑ Edit filters
            </button>
          </div>
        </div>

        {/* ── Header + filters ───────────────────────────────────── */}
        <div ref={filterPanelRef} style={{ position: "relative", zIndex: 1 }}>
          <div style={{ paddingTop: "64px", paddingBottom: "32px" }}>
            <div className="max-w-7xl mx-auto px-6 lg:px-12" style={{ paddingTop: "28px" }}>

              <div style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                marginBottom: "20px",
                flexWrap: "wrap",
                gap: "12px",
              }}>
                <div>
                  {cuisine && (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                      <div style={{ width: "24px", height: "1px", backgroundColor: "rgba(255,255,255,0.4)" }} />
                      <span style={{
                        fontFamily: "'Courier Prime', monospace",
                        fontSize: "9px",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.5)",
                      }}>
                        Cuisine
                      </span>
                    </div>
                  )}
                  <h1 style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontWeight: 300,
                    fontSize: "clamp(28px, 4vw, 48px)",
                    lineHeight: 1.1,
                    letterSpacing: "0.02em",
                    color: "#FFFFFF",
                    textShadow: "0 2px 20px rgba(0,0,0,0.6)",
                  }}>
                    {query
                      ? `Results for "${query}"`
                      : cuisine
                      ? `${cuisine.charAt(0).toUpperCase() + cuisine.slice(1)} Recipes`
                      : "Discover Recipes"}
                  </h1>
                </div>
                {total > 0 && !loading && (
                  <span style={{
                    fontFamily: "'Courier Prime', monospace",
                    fontSize: "10px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.55)",
                    alignSelf: "flex-end",
                  }}>
                    {total.toLocaleString()} recipes
                  </span>
                )}
              </div>

              <div style={{ marginBottom: "16px" }}>
                <RecipeSearch value={query} onChange={setQuery} onSubmit={handleSearch} />
              </div>

              <button
                onClick={() => setShowFilters(v => !v)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: "rgba(255,255,255,0.12)",
                  color: "#FFFFFF",
                  border: "1px solid rgba(255,255,255,0.22)",
                  padding: "7px 14px",
                  borderRadius: "2px",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  backdropFilter: "blur(8px)",
                }}
              >
                {showFilters
                  ? <X size={13} strokeWidth={1.5} />
                  : <SlidersHorizontal size={13} strokeWidth={1.5} />
                }
                {showFilters ? "Hide Filters" : "Show Filters"}
              </button>

              {showFilters && (
                <div style={{
                  marginTop: "16px",
                  padding: "20px",
                  backgroundColor: "rgba(225, 195, 140, 0.88)",
                  borderRadius: "4px",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(255,255,255,0.22)",
                }}>
                  <RecipeFilters
                    cuisine={cuisine}
                    diet={diet}
                    sort={sort}
                    onCuisineChange={v => { setCuisine(v); setPage(1) }}
                    onDietChange={v    => { setDiet(v);    setPage(1) }}
                    onSortChange={v    => { setSort(v);    setPage(1) }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Recipe grid ────────────────────────────────────────── */}
        <div style={{
          position: "relative",
          zIndex: 1,
          backgroundColor: "rgba(180, 140, 90, 0.45)",
          backdropFilter: "blur(3px)",
          minHeight: "60vh",
        }}>
          <div
            className="max-w-7xl mx-auto px-6 lg:px-12"
            style={{ paddingTop: "40px", paddingBottom: "80px" }}
          >
            {error && (
              <div style={{
                backgroundColor: "rgba(196,126,106,0.1)",
                border: "1px solid var(--accent-rose)",
                borderRadius: "2px", padding: "12px 16px", marginBottom: "20px",
                fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                color: "var(--accent-rose)",
              }}>
                ⚠️ {error}
              </div>
            )}

            {loading && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "20px" }}>
                {Array.from({ length: RESULTS_PER_PAGE }).map((_, i) => (
                  <div key={i} className="card-base" style={{ borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ aspectRatio: "4/3", backgroundColor: "var(--bg-accent-strip)" }} />
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ height: "14px", backgroundColor: "var(--bg-accent-strip)", borderRadius: "2px", marginBottom: "8px", width: "80%" }} />
                      <div style={{ height: "12px", backgroundColor: "var(--bg-accent-strip)", borderRadius: "2px", width: "50%" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && recipes.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "20px",
                alignItems: "stretch",
              }}>
                {recipes.map((recipe, i) => (
                  <div
                    key={recipe.id}
                    className="recipe-card-reveal"
                    style={{
                      transitionDelay: `${(i % 4) * 60}ms`,
                      height: "100%",
                      display: "flex",
                    }}
                  >
                    <RecipeCard recipe={recipe} />
                  </div>
                ))}
              </div>
            )}

            {!loading && recipes.length === 0 && (
              <div style={{ textAlign: "center", padding: "80px 20px" }}>
                <ChefHat size={48} strokeWidth={1} style={{ color: "var(--text-muted)", display: "block", margin: "0 auto 16px" }} />
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "24px", color: "var(--text-primary)", marginBottom: "8px" }}>
                  No recipes found
                </h3>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "14px", color: "var(--text-muted)" }}>
                  Try a different search term or adjust your filters.
                </p>
              </div>
            )}

            {!loading && totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginTop: "48px" }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: "8px 18px", border: "1px solid var(--border)",
                    backgroundColor: "var(--bg-card)", color: "var(--text-primary)",
                    fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                    cursor: page === 1 ? "not-allowed" : "pointer",
                    borderRadius: "2px", opacity: page === 1 ? 0.4 : 1,
                    transition: "all 0.15s ease",
                  }}
                >
                  Previous
                </button>

                {Array.from(
                  { length: Math.min(5, totalPages) },
                  (_, i) => Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                ).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      padding: "8px 14px",
                      border: "1px solid",
                      borderColor: page === p ? "var(--accent-warm)" : "var(--border)",
                      backgroundColor: page === p ? "var(--accent-warm)" : "var(--bg-card)",
                      color: page === p ? "#FFFFFF" : "var(--text-secondary)",
                      fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                      fontWeight: page === p ? 500 : 400,
                      cursor: "pointer", borderRadius: "2px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {p}
                  </button>
                ))}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: "8px 18px", border: "1px solid var(--border)",
                    backgroundColor: "var(--bg-card)", color: "var(--text-primary)",
                    fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                    cursor: page === totalPages ? "not-allowed" : "pointer",
                    borderRadius: "2px", opacity: page === totalPages ? 0.4 : 1,
                    transition: "all 0.15s ease",
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
