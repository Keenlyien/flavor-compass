"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import Navbar from "@/components/layout/Navbar"
import CuisineParallaxBackground from "@/components/recipes/CuisineParallaxBackground"

/* ── All 11 cuisines with a verified fun fact each ───────────────────
   Every fact below was checked against multiple sources before being
   written — see project notes. Reusing the same cuisine list as
   RecipeFilters.tsx and Hero.tsx so this page never references a
   cuisine your filters/database don't actually support.
──────────────────────────────────────────────────────────────────── */
interface CuisineFact {
  label: string
  value: string
  fact: string
}

const CUISINE_FACTS: CuisineFact[] = [
  {
    label: "Italian",
    value: "italian",
    fact: "Noodle-making began in China centuries before pasta appeared in Italy — the popular Marco Polo legend has been debunked by food historians.",
  },
  {
    label: "Japanese",
    value: "japanese",
    fact: "Sushi started as a method for preserving fish in fermented rice, not as a way to serve it fresh — that came many centuries later.",
  },
  {
    label: "Mexican",
    value: "mexican",
    fact: "The Aztecs used cacao beans as actual currency, centuries before chocolate became the sweet treat we know today.",
  },
  {
    label: "French",
    value: "french",
    fact: "The croissant isn't originally French — it descends from the Austrian kipferl, brought to Paris by an Austrian baker in 1839.",
  },
  {
    label: "Thai",
    value: "thai",
    fact: "Chili peppers aren't native to Thailand — Portuguese traders introduced them from the Americas; black pepper provided the heat before that.",
  },
  {
    label: "Indian",
    value: "indian",
    fact: "\"Curry\" isn't a single dish in India at all — it's a British colonial-era umbrella term applied to dozens of unrelated regional dishes.",
  },
  {
    label: "Chinese",
    value: "chinese",
    fact: "Fortune cookies aren't Chinese — they likely originated from Japanese senbei crackers, popularized in early-1900s California bakeries.",
  },
  {
    label: "American",
    value: "american",
    fact: "The hamburger takes its name from Hamburg, Germany, even though the sandwich as we know it was popularized in the United States.",
  },
  {
    label: "Greek",
    value: "greek",
    fact: "Feta is a legally protected name in the EU — only cheese made in specific regions of Greece can officially be called feta.",
  },
  {
    label: "Korean",
    value: "korean",
    fact: "Kimchi was originally white and chili-free — red pepper wasn't introduced to Korea until the 16th century.",
  },
  {
    label: "Spanish",
    value: "spanish",
    fact: "Paella began as a humble lunch for Valencian farm laborers, not the seafood-laden dish often served to tourists today.",
  },
]

/* Fisher–Yates shuffle, then take the first 4 — gives a true random
   sample with no bias toward any particular cuisine over repeated
   visits. */
function pickRandomFour(): CuisineFact[] {
  const arr = [...CUISINE_FACTS]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, 4)
}

/* ── Single cuisine tile with its own cached Pexels photo ───────── */
const TILE_IMAGE_COUNT   = 3
const TILE_INTERVAL_MS   = 4000
const TILE_TRANSITION_MS = 700

function CuisineTile({ cuisine, index }: { cuisine: CuisineFact; index: number }) {
  const [photos, setPhotos] = useState<string[]>([])
  const [current, setCurrent] = useState(0)
  const [loaded, setLoaded] = useState<boolean[]>([])

  // Fetch 3 distinct photos for this cuisine via the cached
  // /api/cuisine-images-multi route (MongoDB-backed) instead of
  // calling Pexels directly from the browser — direct browser calls
  // to Pexels on every page load/reload were hitting Pexels' rate
  // limit, causing photos to intermittently fail to load.
  useEffect(() => {
    fetch(`/api/cuisine-images-multi?cuisine=${encodeURIComponent(cuisine.value)}&count=${TILE_IMAGE_COUNT}`)
      .then(r => r.json())
      .then(d => {
        const urls: string[] = d.urls ?? []
        setPhotos(urls)
        setLoaded(new Array(urls.length).fill(false))
      })
      .catch(() => {})
  }, [cuisine.value])

  // Auto-advance through the 3 photos — each tile's timer is
  // independent (its own useEffect/interval), so tiles are NOT
  // synced to each other; they rotate on their own schedule.
  useEffect(() => {
    if (photos.length < 2) return
    const interval = setInterval(() => {
      setCurrent(c => (c + 1) % photos.length)
    }, TILE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [photos.length])

  return (
    <Link
      href={`/recipes?cuisine=${cuisine.value}`}
      className="anim-fade-up"
      style={{
        textDecoration: "none",
        animationDelay: `${index * 80}ms`,
      }}
    >
      <div style={{
        position: "relative",
        aspectRatio: "3/4",
        borderRadius: "4px",
        overflow: "hidden",
        backgroundColor: "var(--bg-accent-strip)",
        boxShadow: "0 4px 20px var(--shadow-card)",
        transition: "transform 0.3s ease",
      }}
        onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-4px)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
      >
        {/* Crossfade stack — all 3 photos stacked, only the current
            one at opacity 1, rest at 0. Avoids any layout shift or
            flash since every photo is always mounted and ready. */}
        {photos.map((url, i) => (
          <img
            key={url}
            src={url}
            alt={cuisine.label}
            onLoad={() =>
              setLoaded(prev => {
                const next = [...prev]
                next[i] = true
                return next
              })
            }
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              opacity: i === current && loaded[i] ? 1 : 0,
              transition: `opacity ${TILE_TRANSITION_MS}ms ease`,
            }}
          />
        ))}

        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(15,10,5,0.75) 0%, rgba(15,10,5,0.1) 55%, transparent 100%)",
        }} />

        {/* Small dot indicators so it reads clearly as a carousel */}
        {photos.length > 1 && (
          <div style={{
            position: "absolute", top: "14px", right: "14px",
            display: "flex", gap: "4px", zIndex: 2,
          }}>
            {photos.map((_, i) => (
              <div key={i} style={{
                width: i === current ? "14px" : "5px",
                height: "5px",
                borderRadius: "3px",
                backgroundColor: i === current ? "#FFFFFF" : "rgba(255,255,255,0.4)",
                transition: `all ${TILE_TRANSITION_MS}ms ease`,
              }} />
            ))}
          </div>
        )}

        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "20px",
        }}>
          <span style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontWeight: 300,
            fontSize: "24px",
            color: "#FFFFFF",
            letterSpacing: "0.02em",
          }}>
            {cuisine.label}
          </span>
        </div>
      </div>
    </Link>
  )
}

/* ── Fun fact row — small photo + text side by side ──────────────── */
function FactRow({ cuisine, index }: { cuisine: CuisineFact; index: number }) {
  const [imgUrl, setImgUrl] = useState("")

  useEffect(() => {
    fetch(`/api/cuisine-image?cuisine=${encodeURIComponent(cuisine.value)}`)
      .then(r => r.json())
      .then(d => { if (d.url) setImgUrl(d.url) })
      .catch(() => {})
  }, [cuisine.value])

  return (
    <div
      className="anim-fade-up"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "20px",
        padding: "24px 0",
        borderBottom: index < 3 ? "1px solid var(--border)" : "none",
        animationDelay: `${index * 80}ms`,
      }}
    >
      <div style={{
        width: "64px", height: "64px",
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        backgroundColor: "var(--bg-accent-strip)",
        border: "1px solid var(--border-card)",
      }}>
        {imgUrl && (
          <img src={imgUrl} alt={cuisine.label}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>
      <div>
        <span style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: "9px",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--accent-warm)",
          display: "block",
          marginBottom: "6px",
        }}>
          {cuisine.label} · Did you know?
        </span>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "14px",
          lineHeight: 1.7,
          color: "var(--text-secondary)",
          margin: 0,
        }}>
          {cuisine.fact}
        </p>
      </div>
    </div>
  )
}

export default function CuisinesView() {
  const pathname = usePathname()
  // Random 4 cuisines must only ever be picked on the CLIENT, never
  // during server rendering — Math.random() produces a different
  // result on the server vs. the client, which causes a React
  // hydration mismatch (the server's HTML won't match what the
  // client expects). Starting with an empty array and filling it in
  // via useEffect (which only ever runs client-side) guarantees the
  // server and the client's first render are identical.
  const [featured, setFeatured] = useState<CuisineFact[]>([])

  useEffect(() => {
    setFeatured(pickRandomFour())
  }, [])

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>
      {/* Parallax background — empty cuisine string triggers the
          general "gourmet food photography" query, same as /recipes
          with no filter active. */}
      <CuisineParallaxBackground key={pathname} cuisine="" />

      <Navbar />

      {/* ── Header section ───────────────────────────────────────── */}
      <section style={{
        position: "relative",
        zIndex: 1,
        paddingTop: "120px",
        paddingBottom: "48px",
      }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div style={{ width: "32px", height: "1px", backgroundColor: "rgba(255,255,255,0.5)" }} />
                <span style={{
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: "10px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.7)",
                }}>
                  Explore
                </span>
              </div>
              <h1 style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontWeight: 300,
                fontSize: "clamp(36px, 5vw, 56px)",
                color: "#FFFFFF",
                letterSpacing: "0.01em",
                lineHeight: 1.08,
                textShadow: "0 2px 20px rgba(0,0,0,0.5)",
              }}>
                Cuisines worth{" "}
                <em style={{ fontStyle: "italic", color: "var(--accent-warm)" }}>
                  discovering.
                </em>
              </h1>
            </div>

            <Link
              href="/recipes"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                color: "var(--accent-warm)",
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500,
                fontSize: "13px",
                textDecoration: "none",
                paddingBottom: "8px",
              }}
              className="hover:opacity-75"
            >
              View All Cuisines
              <ArrowRight size={13} strokeWidth={2} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 4 random cuisine tiles ───────────────────────────────── */}
      <section style={{
        position: "relative",
        zIndex: 1,
        backgroundColor: "rgba(250,247,242,0.92)",
        backdropFilter: "blur(8px)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        padding: "56px 0",
      }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "20px",
          }}>
            {featured.length > 0
              ? featured.map((cuisine, i) => (
                  <CuisineTile key={cuisine.value} cuisine={cuisine} index={i} />
                ))
              : Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{
                    aspectRatio: "3/4",
                    borderRadius: "4px",
                    backgroundColor: "var(--bg-accent-strip)",
                  }} />
                ))
            }
          </div>
        </div>
      </section>

      {/* ── Fun fact strip — matches the 4 tiles shown above ───────
          Separated as its own distinct section with its own
          background, per your reference image's "lines + sections"
          style cue. ──────────────────────────────────────────────── */}
      <section style={{
        position: "relative",
        zIndex: 1,
        backgroundColor: "var(--bg-primary)",
        padding: "64px 0",
      }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
            <div style={{ width: "32px", height: "1px", backgroundColor: "var(--accent-rose)" }} />
            <span style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: "10px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}>
              Food For Thought
            </span>
          </div>

          <div style={{ maxWidth: "640px" }}>
            {featured.length > 0
              ? featured.map((cuisine, i) => (
                  <FactRow key={cuisine.value} cuisine={cuisine} index={i} />
                ))
              : Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: "20px",
                    padding: "24px 0",
                    borderBottom: i < 3 ? "1px solid var(--border)" : "none",
                  }}>
                    <div style={{
                      width: "64px", height: "64px", borderRadius: "50%",
                      backgroundColor: "var(--bg-accent-strip)", flexShrink: 0,
                    }} />
                    <div style={{
                      height: "14px", flex: 1, maxWidth: "400px",
                      backgroundColor: "var(--bg-accent-strip)", borderRadius: "2px",
                    }} />
                  </div>
                ))
            }
          </div>
        </div>
      </section>
    </div>
  )
}
