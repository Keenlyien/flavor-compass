"use client"

import { useEffect, useState, useRef } from "react"

const IMAGE_COUNT   = 5
const INTERVAL_MS   = 5000
const TRANSITION_MS = 700
const SCROLL_STEP   = 600  // px scrolled before advancing one slide

interface Props { cuisine: string }

export default function CuisineParallaxBackground({ cuisine }: Props) {
  const [photos, setPhotos]   = useState<string[]>([])
  const [current, setCurrent] = useState(0)
  const [loaded, setLoaded]   = useState<boolean[]>([])

  // Refs so interval/scroll handlers always see fresh values without
  // needing to be re-created — this was the stale-closure bug.
  const photosRef      = useRef<string[]>([])
  const currentRef     = useRef(0)
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  // Initialize to the CURRENT scroll zone (not always -1) so that if
  // the browser preserves scroll position across a client-side route
  // change, the very first scroll event after mount doesn't
  // immediately fire a spurious "advance" just because scrollY is
  // already past zone 0.
  const lastZoneRef    = useRef(
    typeof window !== "undefined" ? Math.floor(window.scrollY / SCROLL_STEP) : -1
  )
  const tickingRef     = useRef(false)
  const isInitialMount = useRef(true)  // skip reset on first render

  // Keep refs in sync with state
  useEffect(() => { photosRef.current = photos }, [photos])
  useEffect(() => { currentRef.current = current }, [current])

  // Reset on cuisine change — skip on initial mount so the first
  // fetch isn't cleared before it resolves (React Strict Mode fires
  // effects twice in dev; without this guard the reset wins the race).
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    setPhotos([])
    setCurrent(0)
    setLoaded([])
    photosRef.current  = []
    currentRef.current = 0
    lastZoneRef.current = -1
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [cuisine])

  // Fetch photos via the cached /api/cuisine-images-multi route
  // (MongoDB-backed) instead of calling Pexels directly from the
  // browser — direct calls on every page load/reload were hitting
  // Pexels' rate limit, causing the background to intermittently
  // fail to appear at all. Fires for any cuisine including empty ("All").
  useEffect(() => {
    fetch(`/api/cuisine-images-multi?cuisine=${encodeURIComponent(cuisine.toLowerCase())}&count=${IMAGE_COUNT}&orientation=landscape`)
      .then(r => r.json())
      .then(d => {
        const urls: string[] = d.urls ?? []
        setPhotos(urls)
        setLoaded(new Array(urls.length).fill(false))
      })
      .catch(() => {})
  }, [cuisine])

  // Auto-advance interval — uses ref so handler never goes stale
  useEffect(() => {
    if (photos.length < 2) return

    intervalRef.current = setInterval(() => {
      const next = (currentRef.current + 1) % photosRef.current.length
      currentRef.current = next
      setCurrent(next)
    }, INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [photos.length])

  // Scroll-driven advance — every SCROLL_STEP px = next image
  useEffect(() => {
    const handleScroll = () => {
      if (tickingRef.current || photosRef.current.length < 2) return
      tickingRef.current = true

      requestAnimationFrame(() => {
        const zone = Math.floor(window.scrollY / SCROLL_STEP)
        if (zone > lastZoneRef.current) {
          lastZoneRef.current = zone
          // Reset timer and advance
          if (intervalRef.current) clearInterval(intervalRef.current)
          const next = (currentRef.current + 1) % photosRef.current.length
          currentRef.current = next
          setCurrent(next)
          intervalRef.current = setInterval(() => {
            const n = (currentRef.current + 1) % photosRef.current.length
            currentRef.current = n
            setCurrent(n)
          }, INTERVAL_MS)
        }
        tickingRef.current = false
      })
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  if (photos.length === 0) return null

  return (
    <div
      aria-hidden="true"
      style={{
        /* Covers the FULL page height so the background persists
           as you scroll all the way down through the recipe grid. */
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        pointerEvents: "none",
        backgroundColor: "var(--bg-accent-strip)",
        overflow: "hidden",
      }}
    >
      {/* Sliding track */}
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
              alt=""
              onLoad={() =>
                setLoaded(prev => {
                  const next = [...prev]
                  next[i] = true
                  return next
                })
              }
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
                display: "block",
                opacity: loaded[i] ? 1 : 0,
                transition: "opacity 0.4s ease",
              }}
            />
          </div>
        ))}
      </div>

      {/* Gradient overlay — stronger at edges, semi-transparent in middle
          so images are visible while text/cards remain readable. */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "rgba(15, 12, 8, 0.58)",
      }} />

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div style={{
          position: "absolute",
          bottom: "28px",
          right: "28px",
          display: "flex",
          gap: "6px",
          zIndex: 10,
          pointerEvents: "auto",
        }}>
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                if (intervalRef.current) clearInterval(intervalRef.current)
                currentRef.current = i
                setCurrent(i)
                intervalRef.current = setInterval(() => {
                  const n = (currentRef.current + 1) % photosRef.current.length
                  currentRef.current = n
                  setCurrent(n)
                }, INTERVAL_MS)
              }}
              aria-label={`Photo ${i + 1}`}
              style={{
                width: i === current ? "20px" : "6px",
                height: "6px",
                borderRadius: "3px",
                border: "none",
                backgroundColor: i === current
                  ? "#FFFFFF"
                  : "rgba(255,255,255,0.35)",
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
          bottom: 0, left: 0, right: 0,
          height: "2px",
          backgroundColor: "rgba(255,255,255,0.1)",
          zIndex: 10,
        }}>
          <div
            key={current}
            style={{
              height: "100%",
              backgroundColor: "rgba(255,255,255,0.5)",
              animation: `cuisine-progress ${INTERVAL_MS}ms linear forwards`,
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes cuisine-progress {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>
    </div>
  )
}
