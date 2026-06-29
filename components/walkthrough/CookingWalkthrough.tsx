"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import Lottie from "lottie-react"
import {
  ArrowLeft, ArrowRight, List, X,
  Play, Pause, RotateCcw, Circle,
} from "lucide-react"
import type { RecipeDetailData, RecipeStep } from "@/lib/types/recipe"

/* ── Timer helpers ──────────────────────────────────────────────── */
function guessTimer(step: RecipeStep): number | null {
  if (step.timerSeconds) return step.timerSeconds
  const match = step.step.match(/(\d+)\s*(minute|min|hour|second)/i)
  if (match) {
    const val  = parseInt(match[1])
    const unit = match[2].toLowerCase()
    if (unit.startsWith("hour"))   return val * 3600
    if (unit.startsWith("second")) return val
    return val * 60
  }
  return null
}

function formatTime(s: number) {
  const m   = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

function useTimer(initial: number | null) {
  const [seconds, setSeconds]   = useState(initial ?? 0)
  const [running, setRunning]   = useState(false)
  const [finished, setFinished] = useState(false)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(() => setRunning(true),  [])
  const pause = useCallback(() => setRunning(false), [])
  const reset = useCallback(() => {
    setRunning(false); setFinished(false); setSeconds(initial ?? 0)
  }, [initial])

  useEffect(() => {
    setSeconds(initial ?? 0); setRunning(false); setFinished(false)
  }, [initial])

  useEffect(() => {
    if (!running) { if (ref.current) clearInterval(ref.current); return }
    ref.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { setRunning(false); setFinished(true); return 0 }
        return s - 1
      })
    }, 1000)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [running])

  return { seconds, running, finished, start, pause, reset, hasTimer: initial !== null }
}

/* ── Keyword → Lottie action mapping ───────────────────────────── */
const ACTION_LABELS: Record<string, string> = {
  chop:   "Chopping",
  stir:   "Stirring",
  whisk:  "Whisking",
  pour:   "Pouring",
  flip:   "Flipping",
  bake:   "Baking",
  boil:   "Boiling",
  mix:    "Mixing",
  season: "Seasoning",
  taste:    "Tasting",
  pre_heat: "Preheating",
  idle:     "Cooking",
}

function detectAction(text: string): string {
  const t = text.toLowerCase()
  if (/\b(chop|dice|slice|mince|cut|julienne|slit)\b/.test(t)) return "chop"
  if (/\b(whisk|beat|whip)\b/.test(t))                           return "whisk"
  if (/\b(pour|drizzle|stream)\b/.test(t))                       return "pour"
  if (/\b(flip|turn over|toss)\b/.test(t))                       return "flip"
  if (/\b(bake|roast|oven|broil|preheat)\b/.test(t))             return "bake"
  if (/\b(boil|blanch|parboil)\b/.test(t))                       return "boil"
  if (/\b(season|salt and pepper|spice)\b/.test(t))              return "season"
  if (/\b(taste|adjust seasoning|check seasoning)\b/.test(t))    return "taste"
  if (/\b(stir|simmer|fold)\b/.test(t))                          return "stir"
  if (/\b(mix|combine|blend)\b/.test(t))                         return "mix"
  return "idle"
}

/* ── Screen states ──────────────────────────────────────────────── */
type Screen = "loading" | "start" | "steps" | "done"

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function CookingWalkthrough({ id }: { id: string }) {
  const [screen, setScreen]     = useState<Screen>("loading")
  const [progress, setProgress] = useState(0)

  /* ── Resource state ── */
  const [recipe, setRecipe]             = useState<RecipeDetailData | null>(null)
  const [heroUrl, setHeroUrl]           = useState("")
  const [heroLoaded, setHeroLoaded]     = useState(false)
  const [loadingLottie, setLoadingLottie]     = useState<object | null>(null)
  const [startDoneLottie, setStartDoneLottie] = useState<object | null>(null)
  const [stepLottie, setStepLottie]     = useState<object | null>(null)
  const [currentAction, setCurrentAction] = useState("idle")

  /* ── Loading screen carousel ── */
  const [carouselPhotos, setCarouselPhotos] = useState<string[]>([])
  const [carouselIdx, setCarouselIdx]   = useState(0)
  const photosRef   = useRef<string[]>([])
  const idxRef      = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ── Walkthrough state ── */
  const [step, setStep]             = useState(0)
  const [direction, setDirection]   = useState<"next" | "prev">("next")
  const [animKey, setAnimKey]       = useState(0)
  const [doneSteps, setDoneSteps]   = useState<Set<number>>(new Set())
  const [showIngredients, setShowIngredients] = useState(false)

  /* ── Load all resources on mount ─────────────────────────────── */
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setProgress(5)

        /* 1 — Recipe data */
        let data: RecipeDetailData
        try {
          const res = await fetch(`/api/recipes/${id}`)
          if (!res.ok) throw new Error("api")
          data = await res.json()
        } catch {
          const { getMockDetail } = await import("@/lib/db/mock")
          data = getMockDetail(id)
        }
        if (cancelled) return
        setRecipe(data)
        setProgress(25)

        /* 2 — Hero image */
        try {
          const r = await fetch(
            `/api/recipe-hero?id=${encodeURIComponent(id)}&title=${encodeURIComponent(data.title ?? "")}`
          )
          const d = await r.json()
          if (!cancelled && d.url) setHeroUrl(d.url)
        } catch {}
        if (cancelled) return
        setProgress(45)

        /* 3 — loading.json */
        try {
          const r = await fetch("/lottie/loading.json")
          const d = await r.json()
          if (!cancelled) setLoadingLottie(d)
        } catch {}
        if (cancelled) return
        setProgress(60)

        /* 4 — Pexels carousel (same "All" query used on /recipes) */
        const key = process.env.NEXT_PUBLIC_PEXELS_API_KEY
        if (key) {
          try {
            const r = await fetch(
              "https://api.pexels.com/v1/search?query=gourmet+food+photography+colorful+dishes&per_page=5&orientation=landscape&size=large",
              { headers: { Authorization: key } }
            )
            const d = await r.json()
            if (!cancelled && d.photos) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const urls = (d.photos as any[])
                .map((p: { src: { original: string; large2x: string } }) =>
                  p.src?.original || p.src?.large2x || ""
                )
                .filter(Boolean)
              setCarouselPhotos(urls)
              photosRef.current = urls
            }
          } catch {}
        }
        if (cancelled) return
        setProgress(80)

        /* 5 — start_and_done.json */
        try {
          const r = await fetch("/lottie/start_and_done.json")
          const d = await r.json()
          if (!cancelled) setStartDoneLottie(d)
        } catch {}
        if (cancelled) return
        setProgress(100)

        /* Brief pause so user sees 100% */
        await new Promise(resolve => setTimeout(resolve, 500))
        if (!cancelled) setScreen("start")

      } catch {
        if (!cancelled) setScreen("start")
      }
    }

    load()
    return () => { cancelled = true }
  }, [id])

  /* ── Carousel auto-advance on loading screen ─────────────────── */
  useEffect(() => {
    if (carouselPhotos.length < 2) return
    intervalRef.current = setInterval(() => {
      idxRef.current = (idxRef.current + 1) % photosRef.current.length
      setCarouselIdx(idxRef.current)
    }, 4000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [carouselPhotos.length])

  /* ── Load Lottie per step ────────────────────────────────────── */
  useEffect(() => {
    if (screen !== "steps" || !recipe) return
    const stepText = recipe.instructions?.[step]?.step ?? ""
    const action   = detectAction(stepText)
    setCurrentAction(action)
    setStepLottie(null)

    fetch(`/lottie/${action}.json`)
      .then(r => r.json())
      .then(d => setStepLottie(d))
      .catch(() => setStepLottie(null))
  }, [step, screen, recipe])

  /* ── Timer ───────────────────────────────────────────────────── */
  const steps       = recipe?.instructions ?? []
  const currentStep = steps[step]
  const timerSecs   = currentStep ? guessTimer(currentStep) : null
  const timer       = useTimer(timerSecs)

  const goTo = (idx: number, dir: "next" | "prev") => {
    setDoneSteps(prev => new Set([...prev, step]))
    setDirection(dir)
    setAnimKey(k => k + 1)
    setStep(idx)
  }

  const isFirst      = step === 0
  const isLast       = step === steps.length - 1
  const stepProgress = steps.length > 1 ? (step / (steps.length - 1)) * 100 : 0
  const timerPct     = timerSecs && timerSecs > 0
    ? (timer.seconds / timerSecs) * 100 : 0

  /* ══════════════════════════════════════════════════════════════
     SCREEN: LOADING
  ══════════════════════════════════════════════════════════════ */
  if (screen === "loading") {
    return (
      <div style={{
        position: "fixed", inset: 0,
        backgroundColor: "#0E0A06",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "flex-end",
        overflow: "hidden",
        zIndex: 100,
      }}>
        {/* ── Background carousel ── */}
        {carouselPhotos.length > 0 && (
          <>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex",
              width: `${carouselPhotos.length * 100}%`,
              transform: `translateX(-${(carouselIdx * 100) / carouselPhotos.length}%)`,
              transition: "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              willChange: "transform",
            }}>
              {carouselPhotos.map((url, i) => (
                <div key={i} style={{
                  width: `${100 / carouselPhotos.length}%`,
                  flexShrink: 0, height: "100vh",
                }}>
                  <img src={url} alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
            {/* Dot indicators */}
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex", gap: "6px",
            }}>
              {carouselPhotos.map((_, i) => (
                <div key={i} style={{
                  width: i === carouselIdx ? "20px" : "6px",
                  height: "6px", borderRadius: "3px",
                  backgroundColor: i === carouselIdx ? "#C8964A" : "rgba(255,255,255,0.3)",
                  transition: "all 0.4s ease",
                }} />
              ))}
            </div>
          </>
        )}

        {/* Dark overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(10,6,2,0.95) 0%, rgba(10,6,2,0.55) 50%, rgba(10,6,2,0.35) 100%)",
        }} />

        {/* ── Bottom content ── */}
        <div style={{
          position: "relative", zIndex: 1,
          width: "100%", maxWidth: "480px",
          padding: "0 32px 48px",
          display: "flex", flexDirection: "column", alignItems: "center",
        }}>
          {/* Recipe title if already loaded */}
          {recipe?.title && (
            <p style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 300, fontSize: "18px",
              color: "rgba(240,232,220,0.75)",
              textAlign: "center", marginBottom: "8px",
              letterSpacing: "0.03em",
            }}>
              {recipe.title}
            </p>
          )}

          <p style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: "9px", letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(200,150,74,0.8)",
            marginBottom: "24px",
          }}>
            Preparing your walkthrough
          </p>

          {/* Loading Lottie */}
          <div style={{ width: "120px", height: "120px", marginBottom: "24px" }}>
            {loadingLottie ? (
              <Lottie animationData={loadingLottie} loop />
            ) : (
              <div style={{
                width: "100%", height: "100%",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{
                  width: "40px", height: "40px",
                  border: "2px solid rgba(200,150,74,0.3)",
                  borderTop: "2px solid #C8964A",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }} />
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div style={{ width: "100%", marginBottom: "12px" }}>
            <div style={{
              width: "100%", height: "3px",
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: "2px", overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${progress}%`,
                backgroundColor: "#C8964A",
                borderRadius: "2px",
                transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
              }} />
            </div>
          </div>

          <span style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "11px", color: "rgba(255,255,255,0.35)",
          }}>
            {progress < 30  ? "Loading recipe…"
            : progress < 50 ? "Fetching images…"
            : progress < 65 ? "Preparing animations…"
            : progress < 85 ? "Loading resources…"
            : "Almost ready…"}
          </span>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════
     SCREEN: START
  ══════════════════════════════════════════════════════════════ */
  if (screen === "start") {
    return (
      <div style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-primary)",
        display: "flex", flexDirection: "column",
        position: "relative", overflow: "hidden",
      }}>
        {/* Faded hero image background */}
        {(heroUrl || recipe?.image) && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 0,
            backgroundImage: `url(${heroUrl || recipe?.image})`,
            backgroundSize: "cover", backgroundPosition: "center",
            opacity: 0.12,
          }} />
        )}
        {heroUrl && (
          <img src={heroUrl} alt="" onLoad={() => setHeroLoaded(true)}
            style={{ display: "none" }} />
        )}

        {/* Top bar */}
        <div style={{
          position: "relative", zIndex: 1,
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--bg-primary)",
        }}>
          <Link href={`/recipes/${id}`} style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            color: "var(--text-muted)", textDecoration: "none",
            fontFamily: "'DM Sans', sans-serif", fontSize: "12px",
          }}>
            <ArrowLeft size={14} strokeWidth={1.5} />
            Back to recipe
          </Link>
        </div>

        {/* Center content */}
        <div style={{
          position: "relative", zIndex: 1,
          flex: 1, display: "flex",
          flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "40px 24px",
          textAlign: "center",
          animation: "fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}>
          {/* start_and_done animation */}
          <div style={{ width: "180px", height: "180px", marginBottom: "32px" }}>
            {startDoneLottie ? (
              <Lottie animationData={startDoneLottie} loop />
            ) : (
              <div style={{
                width: "100%", height: "100%",
                backgroundColor: "var(--bg-accent-strip)",
                borderRadius: "50%",
              }} />
            )}
          </div>

          <span style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: "9px", letterSpacing: "0.18em",
            textTransform: "uppercase", color: "var(--accent-warm)",
            display: "block", marginBottom: "16px",
          }}>
            Ready to cook
          </span>

          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300, fontSize: "clamp(28px, 4vw, 44px)",
            color: "var(--text-primary)", letterSpacing: "0.02em",
            lineHeight: 1.2, marginBottom: "12px",
            maxWidth: "600px",
          }}>
            {recipe?.title}
          </h1>

          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px", color: "var(--text-muted)",
            marginBottom: "40px",
          }}>
            {steps.length} steps
            {recipe?.readyInMinutes ? ` · ${recipe.readyInMinutes} min` : ""}
            {recipe?.servings ? ` · ${recipe.servings} servings` : ""}
          </p>

          <button
            onClick={() => setScreen("steps")}
            style={{
              backgroundColor: "var(--accent-warm)",
              border: "none", color: "#FFFFFF",
              padding: "16px 40px", borderRadius: "2px",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500, fontSize: "14px",
              cursor: "pointer", letterSpacing: "0.02em",
              transition: "opacity 0.15s ease",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            Start Cooking →
          </button>
        </div>

        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(24px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════
     SCREEN: DONE
  ══════════════════════════════════════════════════════════════ */
  if (screen === "done") {
    return (
      <div style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-primary)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 24px", textAlign: "center",
        position: "relative", overflow: "hidden",
      }}>
        {/* Faded hero background */}
        {(heroUrl || recipe?.image) && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 0,
            backgroundImage: `url(${heroUrl || recipe?.image})`,
            backgroundSize: "cover", backgroundPosition: "center",
            opacity: 0.1,
          }} />
        )}

        <div style={{
          position: "relative", zIndex: 1,
          animation: "fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}>
          {/* start_and_done celebration animation */}
          <div style={{ width: "200px", height: "200px", margin: "0 auto 24px" }}>
            {startDoneLottie ? (
              <Lottie animationData={startDoneLottie} loop={false} />
            ) : (
              <div style={{ fontSize: "64px" }}>🎉</div>
            )}
          </div>

          <span style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: "9px", letterSpacing: "0.18em",
            textTransform: "uppercase", color: "var(--accent-green)",
            display: "block", marginBottom: "16px",
          }}>
            All done!
          </span>

          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300, fontSize: "clamp(32px, 5vw, 52px)",
            color: "var(--text-primary)", letterSpacing: "0.03em",
            marginBottom: "12px",
          }}>
            Bon Appétit!
          </h1>

          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px", color: "var(--text-secondary)",
            marginBottom: "8px", maxWidth: "400px", margin: "0 auto 8px",
          }}>
            {recipe?.title} is ready to serve.
          </p>

          <p style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: "10px", letterSpacing: "0.12em",
            color: "var(--accent-warm)", textTransform: "uppercase",
            marginBottom: "40px",
          }}>
            {steps.length} steps completed · {recipe?.servings} servings
          </p>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href={`/recipes/${id}`} style={{
              backgroundColor: "var(--accent-warm)", color: "#FFFFFF",
              padding: "12px 28px", borderRadius: "2px",
              fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: "13px",
              textDecoration: "none",
            }}>
              View Recipe
            </Link>
            <Link href="/recipes" style={{
              border: "1px solid var(--border)", color: "var(--text-secondary)",
              padding: "12px 28px", borderRadius: "2px",
              fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
              textDecoration: "none",
            }}>
              Find More Recipes
            </Link>
          </div>
        </div>

        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(24px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════
     SCREEN: STEPS (main walkthrough)
  ══════════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(36px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-36px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInDrawer {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes fadeOverlay {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes lottiePop {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-primary)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>

        {/* ── TOP BAR ─────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          display: "flex", alignItems: "center",
          padding: "0 24px", height: "56px",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--bg-primary)",
          gap: "16px",
          position: "sticky", top: 0, zIndex: 10,
        }}>
          <Link href={`/recipes/${id}`} style={{
            display: "flex", alignItems: "center", gap: "6px",
            color: "var(--text-muted)", textDecoration: "none",
            fontFamily: "'DM Sans', sans-serif", fontSize: "12px",
          }}>
            <ArrowLeft size={14} strokeWidth={1.5} />
            Back
          </Link>

          <div style={{ flex: 1, textAlign: "center" }}>
            <span style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 300, fontSize: "16px",
              color: "var(--text-secondary)", letterSpacing: "0.03em",
            }}>
              {recipe?.title}
            </span>
          </div>

          <button
            onClick={() => setShowIngredients(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              backgroundColor: showIngredients ? "var(--accent-warm)" : "transparent",
              border: "1px solid",
              borderColor: showIngredients ? "var(--accent-warm)" : "var(--border)",
              color: showIngredients ? "#FFFFFF" : "var(--text-muted)",
              padding: "6px 12px", borderRadius: "2px",
              fontFamily: "'DM Sans', sans-serif", fontSize: "11px",
              cursor: "pointer", transition: "all 0.15s ease",
            }}
          >
            <List size={12} strokeWidth={1.5} />
            Ingredients
          </button>
        </div>

        {/* ── STEP PROGRESS BAR ───────────────────────────────── */}
        <div style={{ flexShrink: 0, height: "3px", backgroundColor: "var(--border)" }}>
          <div style={{
            height: "100%", backgroundColor: "var(--accent-warm)",
            width: `${stepProgress}%`,
            transition: "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
          }} />
        </div>

        {/* ── MAIN SPLIT LAYOUT ───────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* LEFT PANEL — hero image + action animation + step dots */}
          <div style={{
            width: "38%", flexShrink: 0,
            position: "relative",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            backgroundColor: "var(--bg-accent-strip)",
          }}>
            {/* Hero images */}
            {recipe?.image && (
              <img src={recipe.image} alt={recipe.title}
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover",
                  opacity: heroLoaded ? 0 : 1,
                  transition: "opacity 0.5s ease",
                }}
              />
            )}
            {heroUrl && (
              <img src={heroUrl} alt={recipe?.title}
                onLoad={() => setHeroLoaded(true)}
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover",
                  opacity: heroLoaded ? 1 : 0,
                  transition: "opacity 0.5s ease",
                }}
              />
            )}

            {/* Gradient over image */}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to top, rgba(15,10,5,0.85) 0%, rgba(15,10,5,0.3) 55%, transparent 100%)",
            }} />



            {/* Step dots + counter */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              padding: "20px",
            }}>
              <div style={{
                display: "flex", flexWrap: "wrap",
                gap: "5px", marginBottom: "10px",
              }}>
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i, i > step ? "next" : "prev")}
                    style={{
                      width: i === step ? "20px" : "6px",
                      height: "6px", borderRadius: "3px",
                      backgroundColor: i === step
                        ? "var(--accent-warm)"
                        : doneSteps.has(i)
                        ? "var(--accent-green)"
                        : "rgba(255,255,255,0.3)",
                      border: "none", cursor: "pointer",
                      transition: "all 0.3s ease",
                      padding: 0,
                    }}
                  />
                ))}
              </div>
              <span style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: "10px", letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.7)", textTransform: "uppercase",
              }}>
                Step {step + 1} of {steps.length}
              </span>
            </div>
          </div>

          {/* RIGHT PANEL — step content */}
          <div style={{
            flex: 1, display: "flex",
            flexDirection: "column", overflow: "hidden",
          }}>
            {/* Step content */}
            <div style={{
              flex: 1, display: "flex",
              alignItems: "center", justifyContent: "center",
              padding: "40px 48px", overflow: "auto",
            }}>
              <div
                key={animKey}
                style={{
                  maxWidth: "560px", width: "100%",
                  animation: `${direction === "next" ? "slideInRight" : "slideInLeft"} 0.4s cubic-bezier(0.16, 1, 0.3, 1) both`,
                }}
              >
                {/* Step number */}
                <div style={{
                  display: "flex", alignItems: "center",
                  gap: "12px", marginBottom: "28px",
                }}>
                  <div style={{
                    width: "44px", height: "44px",
                    border: "1px solid var(--accent-warm)",
                    borderRadius: "2px", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{
                      fontFamily: "'Courier Prime', monospace",
                      fontWeight: 700, fontSize: "13px",
                      color: "var(--accent-warm)", letterSpacing: "0.06em",
                    }}>
                      {String(step + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div style={{ height: "1px", flex: 1, backgroundColor: "var(--border)" }} />
                  {isLast && (
                    <span style={{
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: "9px", letterSpacing: "0.14em",
                      color: "var(--accent-green)", textTransform: "uppercase",
                      border: "1px solid var(--accent-green)",
                      padding: "3px 8px", borderRadius: "2px", flexShrink: 0,
                    }}>
                      Final Step
                    </span>
                  )}
                </div>

                {/* Step text + Lottie side by side */}
                <div style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "24px",
                  marginBottom: "36px",
                }}>
                  {/* Lottie animation beside the instruction */}
                  {stepLottie && (
                    <div
                      key={`lottie-${currentAction}-${step}`}
                      style={{
                        flexShrink: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px",
                        animation: "lottiePop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both",
                      }}
                    >
                      <div style={{ width: "100px", height: "100px" }}>
                        <Lottie animationData={stepLottie} loop />
                      </div>
                      <span style={{
                        fontFamily: "'Courier Prime', monospace",
                        fontSize: "8px", letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--accent-warm)",
                      }}>
                        {ACTION_LABELS[currentAction] ?? "Cooking"}
                      </span>
                    </div>
                  )}

                  <p style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontWeight: 300,
                    fontSize: "clamp(22px, 2.5vw, 32px)",
                    lineHeight: 1.55, color: "var(--text-primary)",
                    letterSpacing: "0.02em",
                    flex: 1,
                  }}>
                    {currentStep?.step}
                  </p>
                </div>

                {/* Timer */}
                {timer.hasTimer && (
                  <div style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: "4px", padding: "20px 24px",
                    display: "flex", alignItems: "center", gap: "20px",
                  }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <svg width="64" height="64" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="26"
                          fill="none" stroke="var(--border)" strokeWidth="3" />
                        <circle
                          cx="32" cy="32" r="26" fill="none"
                          stroke={timer.finished ? "var(--accent-green)" : "var(--accent-warm)"}
                          strokeWidth="3" strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 26}`}
                          strokeDashoffset={`${2 * Math.PI * 26 * (1 - timerPct / 100)}`}
                          transform="rotate(-90 32 32)"
                          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease" }}
                        />
                      </svg>
                      <span style={{
                        position: "absolute", inset: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "'Courier Prime', monospace",
                        fontSize: "11px", fontWeight: 700,
                        color: timer.finished ? "var(--accent-green)" : "var(--accent-warm)",
                      }}>
                        {timer.finished ? "✓" : formatTime(timer.seconds)}
                      </span>
                    </div>

                    <div style={{ flex: 1 }}>
                      <span style={{
                        fontFamily: "'Courier Prime', monospace",
                        fontSize: "9px", letterSpacing: "0.14em",
                        textTransform: "uppercase", color: "var(--text-muted)",
                        display: "block", marginBottom: "6px",
                      }}>
                        Step Timer
                      </span>
                      <p style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "13px", color: "var(--text-secondary)",
                      }}>
                        {timer.finished
                          ? "Time's up! Move on when ready."
                          : (() => {
                          const h = Math.floor(timer.seconds / 3600)
                          const m = Math.ceil((timer.seconds % 3600) / 60)
                          if (h === 0) return `${m} min remaining`
                          if (m === 0) return `${h}h remaining`
                          return `${h}h ${m}m remaining`
                        })()}
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      {!timer.finished && (
                        <button onClick={timer.running ? timer.pause : timer.start}
                          style={{
                            width: "36px", height: "36px",
                            backgroundColor: "var(--accent-warm)",
                            border: "none", borderRadius: "2px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          {timer.running
                            ? <Pause size={14} strokeWidth={2} style={{ color: "#FFFFFF" }} />
                            : <Play  size={14} strokeWidth={2} style={{ color: "#FFFFFF" }} />
                          }
                        </button>
                      )}
                      <button onClick={timer.reset}
                        style={{
                          width: "36px", height: "36px",
                          backgroundColor: "transparent",
                          border: "1px solid var(--border)", borderRadius: "2px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <RotateCcw size={13} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── NAVIGATION ── */}
            <div style={{
              flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: "12px", padding: "20px 48px 28px",
              borderTop: "1px solid var(--border)",
              backgroundColor: "var(--bg-primary)",
            }}>
              <button
                onClick={() => !isFirst && goTo(step - 1, "prev")}
                disabled={isFirst}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  backgroundColor: "transparent",
                  border: "1px solid var(--border)",
                  color: isFirst ? "var(--border)" : "var(--text-secondary)",
                  padding: "12px 24px", borderRadius: "2px",
                  fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                  cursor: isFirst ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <ArrowLeft size={14} strokeWidth={1.5} />
                Previous
              </button>

              {isLast ? (
                <button
                  onClick={() => setScreen("done")}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    backgroundColor: "var(--accent-green)",
                    border: "1px solid var(--accent-green)",
                    color: "#FFFFFF", padding: "12px 32px", borderRadius: "2px",
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: "13px",
                    cursor: "pointer", transition: "opacity 0.15s ease",
                  }}
                >
                  Finish Cooking 🎉
                </button>
              ) : (
                <button
                  onClick={() => goTo(step + 1, "next")}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    backgroundColor: "var(--accent-warm)",
                    border: "1px solid var(--accent-warm)",
                    color: "#FFFFFF", padding: "12px 32px", borderRadius: "2px",
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: "13px",
                    cursor: "pointer", transition: "opacity 0.15s ease",
                  }}
                >
                  Next Step
                  <ArrowRight size={14} strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── INGREDIENTS DRAWER ──────────────────────────────── */}
        {showIngredients && (
          <>
            <div onClick={() => setShowIngredients(false)}
              style={{
                position: "fixed", inset: 0,
                backgroundColor: "rgba(0,0,0,0.35)",
                backdropFilter: "blur(2px)",
                zIndex: 40,
                animation: "fadeOverlay 0.2s ease both",
              }}
            />
            <div style={{
              position: "fixed", top: 0, right: 0, bottom: 0,
              width: "min(340px, 90vw)",
              backgroundColor: "var(--bg-card)",
              borderLeft: "1px solid var(--border)",
              zIndex: 50, display: "flex", flexDirection: "column",
              animation: "slideInDrawer 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
            }}>
              <div style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <h2 style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 400, fontSize: "20px",
                  color: "var(--text-primary)",
                }}>
                  Ingredients
                </h2>
                <button onClick={() => setShowIngredients(false)}
                  style={{
                    backgroundColor: "transparent", border: "none",
                    color: "var(--text-muted)", cursor: "pointer", padding: "4px",
                  }}
                >
                  <X size={18} strokeWidth={1.5} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "8px 24px" }}>
                {recipe?.ingredients.map((ing, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "11px 0",
                    borderBottom: i < (recipe.ingredients.length - 1)
                      ? "1px solid var(--border-card)" : "none",
                  }}>
                    <Circle size={14} strokeWidth={1}
                      style={{ flexShrink: 0, color: "var(--border)" }} />
                    <span style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "13px", color: "var(--text-secondary)", flex: 1,
                    }}>
                      {ing.raw ?? ing.name}
                    </span>
                    {!ing.raw && (
                      <span style={{
                        fontFamily: "'Courier Prime', monospace",
                        fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap",
                      }}>
                        {ing.amount} {ing.unit}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)" }}>
                <span style={{
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: "9px", letterSpacing: "0.14em",
                  textTransform: "uppercase", color: "var(--text-muted)",
                }}>
                  {recipe?.servings} servings · {recipe?.ingredients.length} ingredients
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
