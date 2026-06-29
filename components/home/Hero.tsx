"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { motion, useMotionValue, useSpring, useTransform, MotionValue } from "framer-motion"

const CUISINE_CATEGORIES = [
  { label: "Italian",  emoji: "🍝" },
  { label: "Japanese", emoji: "🍜" },
  { label: "Mexican",  emoji: "🌮" },
  { label: "Thai",     emoji: "🍛" },
  { label: "Indian",   emoji: "🍛" },
  { label: "Chinese",  emoji: "🥟" },
  { label: "American", emoji: "🍔" },
  { label: "Korean",   emoji: "🥢" },
  { label: "Spanish",  emoji: "🥘" },
]

const HERO_STATS = [
  { value: "13K+", label: "Recipes" },
  { value: "30+",  label: "Cuisines" },
  { value: "100%", label: "Free" },
]

/* ── Cuisine image component ── */
function CuisineImg({ cuisine, fallback }: { cuisine: string; fallback: string }) {
  const [url, setUrl]       = useState("")
  const [loaded, setLoaded] = useState(false)
  const [error, setError]   = useState(false)

  useEffect(() => {
    fetch(`/api/cuisine-image?cuisine=${encodeURIComponent(cuisine.toLowerCase())}`)
      .then(r => r.json())
      .then(d => setUrl(d.url || ""))
      .catch(() => {})
  }, [cuisine])

  return (
    <div style={{
      width: "36px", height: "36px", borderRadius: "50%",
      overflow: "hidden", flexShrink: 0,
      border: "1px solid var(--border)",
      backgroundColor: "var(--bg-accent-strip)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {url && !error ? (
        <img
          src={url} alt={cuisine}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            opacity: loaded ? 1 : 0, transition: "opacity 0.2s ease",
          }}
        />
      ) : (
        <span style={{ fontSize: "18px" }}>{fallback}</span>
      )}
    </div>
  )
}

// 5 curated high-quality Pexels food photo IDs
const HERO_PHOTO_IDS = [1640777, 2097090, 769289, 1279330, 3184183]

const INTERVAL_MS = 5000
const TRANSITION_MS = 700


/* ── Magnified dock item — buildui.com/recipes/magnified-dock ── */
const DOCK_SCALE    = 1.7   // max magnification
const DOCK_DISTANCE = 120   // px of mouse influence radius
const SPRING_CFG    = { mass: 0.1, stiffness: 170, damping: 12 }

function DockCuisineItem({
  cat,
  mouseX,
}: {
  cat: { label: string; emoji: string }
  mouseX: MotionValue<number>
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Distance from cursor to center of this item
  const distance = useTransform(mouseX, (val: number) => {
    if (!ref.current) return Infinity
    const rect = ref.current.getBoundingClientRect()
    return val - (rect.left + rect.width / 2)
  })

  // Scale based on distance — peaks at center, falls off toward edges
  const scaleVal = useTransform(
    distance,
    [-DOCK_DISTANCE, 0, DOCK_DISTANCE],
    [1, DOCK_SCALE, 1],
  )

  const scale = useSpring(scaleVal, SPRING_CFG)

  return (
    <motion.div
      ref={ref}
      style={{
        scale,
        originY: 1,
        display: "inline-flex",
        flexShrink: 0,
      }}
    >
      <a
        href={`/recipes?cuisine=${cat.label.toLowerCase()}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
          padding: "5px 14px 5px 5px",
          borderRadius: "100px",
          boxShadow: "0 1px 4px var(--shadow-card)",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "12px",
          color: "var(--text-secondary)",
          textDecoration: "none",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <CuisineImg cuisine={cat.label} fallback={cat.emoji} />
        {cat.label}
      </a>
    </motion.div>
  )
}

export default function Hero() {
  const cuisineMouseX = useMotionValue(-Infinity)
  const [mounted, setMounted]   = useState(false)
  const [photos, setPhotos]     = useState<string[]>([])
  const [current, setCurrent]   = useState(0)
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => setMounted(true), [])

  // Fetch all photos in parallel
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PEXELS_API_KEY
    if (!key) return
    Promise.all(
      HERO_PHOTO_IDS.map(id =>
        fetch(`https://api.pexels.com/v1/photos/${id}`, {
          headers: { Authorization: key },
        })
          .then(r => r.json())
          .then(d => d?.src?.original || d?.src?.large2x || "")
          .catch(() => "")
      )
    ).then(urls => setPhotos(urls.filter(Boolean)))
  }, [])

  const goTo = useCallback((next: number) => {
    setCurrent(next)
  }, [])

  // Auto-advance
  useEffect(() => {
    if (photos.length < 2) return
    intervalRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % photos.length)
    }, INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [photos.length])

  // Reset interval when user clicks a dot
  const handleDotClick = (i: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    goTo(i)
    intervalRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % photos.length)
    }, INTERVAL_MS)
  }

  return (
    <div style={{ backgroundColor: "var(--bg-primary)" }}>

      {/* ── HERO ── */}
      <section style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        paddingTop: "64px",
      }}>

        {/* LEFT */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "60px 64px 60px 80px",
          }}
          className="px-6 lg:pl-20 lg:pr-16"
        >
          <div
            className={mounted ? "anim-fade-up" : "opacity-0"}
            style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}
          >
            <div style={{ width: "32px", height: "1px", backgroundColor: "var(--accent-rose)" }} />
            <span style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: "10px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}>
              Cook Anything
            </span>
          </div>

          <h1
            className={mounted ? "anim-fade-up delay-100" : "opacity-0"}
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontWeight: 300,
              fontSize: "clamp(48px, 5vw, 80px)",
              lineHeight: 1.05,
              color: "var(--text-primary)",
              letterSpacing: "0.01em",
              marginBottom: "24px",
            }}
          >
            Discover recipes{" "}
            <br />
            <em style={{ fontStyle: "italic", color: "var(--accent-warm)" }}>worth</em>
            <br />
            cooking.
          </h1>

          <p
            className={mounted ? "anim-fade-up delay-200" : "opacity-0"}
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: "15px",
              lineHeight: 1.75,
              color: "var(--text-muted)",
              marginBottom: "40px",
              maxWidth: "400px",
            }}
          >
            Over 13,000 curated recipes from around the world.
            Step-by-step walkthroughs with built-in timers
            that make any cuisine approachable.
          </p>

          <div
            className={mounted ? "anim-fade-up delay-300" : "opacity-0"}
            style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", marginBottom: "52px" }}
          >
            <Link
              href="/recipes"
              style={{
                backgroundColor: "var(--text-primary)",
                color: "var(--text-inverse)",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontWeight: 500,
                fontSize: "13px",
                letterSpacing: "0.02em",
                padding: "13px 28px",
                borderRadius: "100px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                transition: "opacity 0.15s ease",
              }}
              className="hover:opacity-80 group"
            >
              Browse Recipes
              <ArrowRight size={14} strokeWidth={2} className="group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/#how-it-works"
              style={{
                color: "var(--text-secondary)",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize: "13px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "2px",
              }}
              className="hover:opacity-60 transition-opacity"
            >
              How it works
            </Link>
          </div>

          <div
            className={mounted ? "anim-fade-up delay-400" : "opacity-0"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "32px",
              paddingTop: "32px",
              borderTop: "1px solid var(--border)",
            }}
          >
            {HERO_STATS.map(s => (
              <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 400,
                  fontSize: "28px",
                  color: "var(--text-primary)",
                  letterSpacing: "0.02em",
                  lineHeight: 1,
                }}>
                  {s.value}
                </span>
                <span style={{
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: "9px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — sliding carousel */}
        <div
          className={mounted ? "anim-fade-in delay-200" : "opacity-0"}
          style={{
            position: "relative",
            overflow: "hidden",
            minHeight: "600px",
            backgroundColor: "var(--bg-accent-strip)",
          }}
        >
          {photos.length === 0 ? (
            <div style={{
              width: "100%", height: "100%",
              display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "80px",
            }}>
              🍽️
            </div>
          ) : (
            /* Sliding track — all images sit side by side, track translates left */
            <div
              style={{
                display: "flex",
                width: `${photos.length * 100}%`,
                height: "100%",
                transform: `translateX(-${(current * 100) / photos.length}%)`,
                transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                willChange: "transform",
              }}
            >
              {photos.map((url, i) => (
                <div
                  key={i}
                  style={{
                    width: `${100 / photos.length}%`,
                    flexShrink: 0,
                    height: "100%",
                    position: "relative",
                  }}
                >
                  <img
                    src={url}
                    alt={`Food photo ${i + 1}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "center",
                      display: "block",
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Left edge fade */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to right, var(--bg-primary) 0%, transparent 8%)",
            pointerEvents: "none",
            zIndex: 10,
          }} />

          {/* Dot indicators */}
          {photos.length > 1 && (
            <div style={{
              position: "absolute",
              bottom: "24px",
              right: "24px",
              display: "flex",
              gap: "6px",
              zIndex: 20,
            }}>
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleDotClick(i)}
                  aria-label={`Go to photo ${i + 1}`}
                  style={{
                    width: i === current ? "20px" : "6px",
                    height: "6px",
                    borderRadius: "3px",
                    border: "none",
                    backgroundColor: i === current ? "#FFFFFF" : "rgba(255,255,255,0.35)",
                    cursor: "pointer",
                    padding: 0,
                    transition: `all ${TRANSITION_MS}ms ease`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Progress bar */}
          {photos.length > 1 && (
            <div style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "2px",
              backgroundColor: "rgba(255,255,255,0.12)",
              zIndex: 20,
            }}>
              <div
                key={current}
                style={{
                  height: "100%",
                  backgroundColor: "rgba(255,255,255,0.55)",
                  animation: `carousel-progress ${INTERVAL_MS}ms linear forwards`,
                }}
              />
            </div>
          )}

          {/* Floating badge */}
          <div style={{
            position: "absolute",
            bottom: "48px",
            left: "40px",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: "4px",
            padding: "14px 18px",
            boxShadow: "0 8px 32px var(--shadow-float)",
            backdropFilter: "blur(8px)",
            zIndex: 20,
          }}>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "28px",
              fontWeight: 300,
              color: "var(--text-primary)",
              lineHeight: 1,
              marginBottom: "4px",
            }}>
              13,493
            </div>
            <div style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: "9px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}>
              Recipes ready to cook
            </div>
          </div>
        </div>
      </section>

      {/* ── CUISINE STRIP ── */}
      <section style={{
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--bg-accent-strip)",
        padding: "20px 0",
        overflow: "visible",
      }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <span style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: "9px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}>
              Browse by Cuisine
            </span>
            <Link
              href="/recipes"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "12px",
                color: "var(--accent-warm)",
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                textDecoration: "none",
              }}
              className="hover:opacity-70 transition-opacity"
            >
              All Recipes
              <ArrowRight size={11} strokeWidth={2} />
            </Link>
          </div>

          {/* Magnified dock — mouse position tracked on the row wrapper */}
          <motion.div
            style={{
              display: "flex", flexWrap: "nowrap", gap: "8px",
              overflowX: "auto", overflowY: "visible",
              paddingTop: "24px", paddingBottom: "8px",
            }}
            onMouseMove={e => cuisineMouseX.set(e.clientX)}
            onMouseLeave={() => cuisineMouseX.set(-Infinity)}
          >
            {CUISINE_CATEGORIES.map(cat => (
              <DockCuisineItem key={cat.label} cat={cat} mouseX={cuisineMouseX} />
            ))}
          </motion.div>
        </div>
      </section>

      <style>{`
        @keyframes carousel-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  )
}
