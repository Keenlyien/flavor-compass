"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft, ArrowRight, ChefHat, List, X,
  Play, Pause, RotateCcw, Circle, PartyPopper,
} from "lucide-react"
import type { RecipeDetailData, RecipeStep } from "@/lib/types/recipe"

/* ── Timer helpers ─────────────────────────────────────────────── */
function guessTimer(step: RecipeStep): number | null {
  if (step.timerSeconds) return step.timerSeconds
  const match = step.step.match(/(\d+)\s*(minute|min|hour|second)/i)
  if (match) {
    const val = parseInt(match[1])
    const unit = match[2].toLowerCase()
    if (unit.startsWith("hour"))   return val * 3600
    if (unit.startsWith("second")) return val
    return val * 60
  }
  return null
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
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

/* ── Main component ─────────────────────────────────────────────── */
export default function CookingWalkthrough({ id }: { id: string }) {
  const [recipe, setRecipe]       = useState<RecipeDetailData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [step, setStep]           = useState(0)
  const [direction, setDirection] = useState<"next" | "prev">("next")
  const [animKey, setAnimKey]     = useState(0)
  const [showIngredients, setShowIngredients] = useState(false)
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set())
  const [heroUrl, setHeroUrl]     = useState("")
  const [heroLoaded, setHeroLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/recipes/${id}`)
        if (!res.ok) throw new Error("api error")
        const data = await res.json()
        setRecipe(data)
        // Fetch Pexels hero image
        fetch(`/api/recipe-hero?id=${encodeURIComponent(id)}&title=${encodeURIComponent(data.title ?? "")}`)
          .then(r => r.json())
          .then(d => { if (d.url) setHeroUrl(d.url) })
          .catch(() => {})
      } catch {
        const { getMockDetail } = await import("@/lib/db/mock")
        setRecipe(getMockDetail(id))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const steps = recipe?.instructions ?? []
  const currentStep  = steps[step]
  const timerSeconds = currentStep ? guessTimer(currentStep) : null
  const timer        = useTimer(timerSeconds)

  const goTo = (idx: number, dir: "next" | "prev") => {
    setDoneSteps(prev => new Set([...prev, step]))
    setDirection(dir)
    setAnimKey(k => k + 1)
    setStep(idx)
  }

  const isFirst = step === 0
  const isLast  = step === steps.length - 1
  const isDone  = doneSteps.size === steps.length

  /* ── Loading ── */
  if (loading) return (
    <div style={{
      minHeight: "100vh", backgroundColor: "var(--bg-primary)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        <ChefHat size={36} style={{ color: "var(--accent-warm)" }} strokeWidth={1} />
        <span style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: "11px", letterSpacing: "0.16em",
          color: "var(--text-muted)", textTransform: "uppercase",
        }}>
          Loading Recipe…
        </span>
      </div>
    </div>
  )

  /* ── Empty ── */
  if (!recipe || steps.length === 0) return (
    <div style={{
      minHeight: "100vh", backgroundColor: "var(--bg-primary)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ textAlign: "center" }}>
        <p style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "24px", color: "var(--text-primary)", marginBottom: "16px",
        }}>
          No steps found
        </p>
        <Link href={`/recipes/${id}`} style={{
          color: "var(--accent-warm)", fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
        }}>
          ← Back to recipe
        </Link>
      </div>
    </div>
  )

  /* ── Finished screen ── */
  if (isDone && step === steps.length - 1 && doneSteps.has(step)) return (
    <div style={{
      minHeight: "100vh", backgroundColor: "var(--bg-primary)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 24px", textAlign: "center",
      position: "relative", overflow: "hidden",
    }}>
      {/* Faded hero image behind celebration screen */}
      {heroUrl && heroLoaded && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: `url(${heroUrl})`,
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: 0.12,
        }} />
      )}
      {heroUrl && (
        <img src={heroUrl} alt="" onLoad={() => setHeroLoaded(true)}
          style={{ display: "none" }} />
      )}
      <div className="anim-scale-in" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: "64px", marginBottom: "24px" }}>🎉</div>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 300, fontSize: "clamp(36px, 5vw, 56px)",
          color: "var(--text-primary)", letterSpacing: "0.03em", marginBottom: "12px",
        }}>
          Bon Appétit!
        </h1>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "15px", color: "var(--text-secondary)",
          marginBottom: "8px", maxWidth: "400px",
        }}>
          {recipe.title} is ready to serve.
        </p>
        <p style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: "11px", letterSpacing: "0.12em",
          color: "var(--accent-warm)", textTransform: "uppercase", marginBottom: "40px",
        }}>
          {steps.length} steps completed · {recipe.servings} servings
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
    </div>
  )

  const progress   = steps.length > 1 ? (step / (steps.length - 1)) * 100 : 0
  const timerPct   = timerSeconds && timerSeconds > 0
    ? (timer.seconds / timerSeconds) * 100 : 0

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "var(--bg-primary)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>

      {/* ── TOP BAR ─────────────────────────────────────────────── */}
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
          transition: "color 0.15s ease",
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
            {recipe.title}
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

      {/* ── PROGRESS BAR ─────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, height: "3px", backgroundColor: "var(--border)" }}>
        <div style={{
          height: "100%", backgroundColor: "var(--accent-warm)",
          width: `${progress}%`,
          transition: "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        }} />
      </div>

      {/* ── MAIN SPLIT LAYOUT ────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: "flex",
        overflow: "hidden",
      }}>

        {/* LEFT PANEL — hero image + step dots */}
        <div style={{
          width: "38%",
          flexShrink: 0,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          backgroundColor: "var(--bg-accent-strip)",
        }}>
          {/* Recipe hero image */}
          {recipe.image && (
            <img
              src={recipe.image}
              alt={recipe.title}
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                objectFit: "cover", objectPosition: "center",
                opacity: heroLoaded ? 0 : 1,
                transition: "opacity 0.5s ease",
              }}
            />
          )}
          {heroUrl && (
            <img
              src={heroUrl}
              alt={recipe.title}
              onLoad={() => setHeroLoaded(true)}
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                objectFit: "cover", objectPosition: "center",
                opacity: heroLoaded ? 1 : 0,
                transition: "opacity 0.5s ease",
              }}
            />
          )}

          {/* Dark gradient over image */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to top, rgba(15,10,5,0.75) 0%, rgba(15,10,5,0.25) 60%, transparent 100%)",
          }} />

          {/* Bottom overlay — progress dots + step count */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "24px",
          }}>
            {/* Step counter pills */}
            <div style={{
              display: "flex", flexWrap: "wrap",
              gap: "5px", marginBottom: "12px",
            }}>
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i, i > step ? "next" : "prev")}
                  style={{
                    width: i === step ? "20px" : "6px",
                    height: "6px",
                    borderRadius: "3px",
                    backgroundColor: i === step
                      ? "var(--accent-warm)"
                      : doneSteps.has(i)
                      ? "var(--accent-green)"
                      : "rgba(255,255,255,0.3)",
                    border: "none", cursor: "pointer",
                    transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    padding: 0,
                  }}
                />
              ))}
            </div>

            <span style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: "10px", letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.7)",
              textTransform: "uppercase",
            }}>
              Step {step + 1} of {steps.length}
            </span>
          </div>
        </div>

        {/* RIGHT PANEL — step content */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>

          {/* Step content area */}
          <div style={{
            flex: 1,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "40px 48px",
            overflow: "auto",
          }}>
            <div
              key={animKey}
              style={{
                maxWidth: "560px", width: "100%",
                animation: `${direction === "next" ? "slideInRight" : "slideInLeft"} 0.4s cubic-bezier(0.16, 1, 0.3, 1) both`,
              }}
            >
              {/* Step number header */}
              <div style={{
                display: "flex", alignItems: "center",
                gap: "12px", marginBottom: "28px",
              }}>
                <div style={{
                  width: "44px", height: "44px",
                  border: "1px solid var(--accent-warm)",
                  borderRadius: "2px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
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

              {/* Step text */}
              <p style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontWeight: 300,
                fontSize: "clamp(22px, 2.5vw, 32px)",
                lineHeight: 1.55,
                color: "var(--text-primary)",
                letterSpacing: "0.02em",
                marginBottom: "36px",
              }}>
                {currentStep?.step}
              </p>

              {/* Timer */}
              {timer.hasTimer && (
                <div style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  padding: "20px 24px",
                  display: "flex", alignItems: "center", gap: "20px",
                }}>
                  {/* Radial progress */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <svg width="64" height="64" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="26"
                        fill="none" stroke="var(--border)" strokeWidth="3" />
                      <circle
                        cx="32" cy="32" r="26"
                        fill="none"
                        stroke={timer.finished ? "var(--accent-green)" : "var(--accent-warm)"}
                        strokeWidth="3"
                        strokeLinecap="round"
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
                        : `${Math.round(timer.seconds / 60)} min remaining`}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    {!timer.finished && (
                      <button
                        onClick={timer.running ? timer.pause : timer.start}
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
                    <button
                      onClick={timer.reset}
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
                onClick={() => {
                  setDoneSteps(prev => new Set([...prev, step]))
                  setAnimKey(k => k + 1)
                }}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  backgroundColor: "var(--accent-green)",
                  border: "1px solid var(--accent-green)",
                  color: "#FFFFFF",
                  padding: "12px 32px", borderRadius: "2px",
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: "13px",
                  cursor: "pointer", transition: "all 0.15s ease",
                }}
              >
                <PartyPopper size={14} strokeWidth={1.5} />
                Finish Cooking
              </button>
            ) : (
              <button
                onClick={() => goTo(step + 1, "next")}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  backgroundColor: "var(--accent-warm)",
                  border: "1px solid var(--accent-warm)",
                  color: "#FFFFFF",
                  padding: "12px 32px", borderRadius: "2px",
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

      {/* ── INGREDIENTS DRAWER ───────────────────────────────────── */}
      {showIngredients && (
        <>
          <div
            onClick={() => setShowIngredients(false)}
            style={{
              position: "fixed", inset: 0,
              backgroundColor: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(2px)",
              zIndex: 40,
              animation: "fadeIn 0.2s ease both",
            }}
          />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0,
            width: "min(340px, 90vw)",
            backgroundColor: "var(--bg-card)",
            borderLeft: "1px solid var(--border)",
            zIndex: 50,
            display: "flex", flexDirection: "column",
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
              <button
                onClick={() => setShowIngredients(false)}
                style={{
                  backgroundColor: "transparent", border: "none",
                  color: "var(--text-muted)", cursor: "pointer", padding: "4px",
                }}
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px 24px" }}>
              {recipe.ingredients.map((ing, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "11px 0",
                  borderBottom: i < recipe.ingredients.length - 1
                    ? "1px solid var(--border-card)" : "none",
                }}>
                  <Circle size={14} strokeWidth={1} style={{ flexShrink: 0, color: "var(--border)" }} />
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
                {recipe.servings} servings · {recipe.ingredients.length} ingredients
              </span>
            </div>
          </div>
        </>
      )}

      {/* ── Animations ── */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInDrawer {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .anim-scale-in { animation: scaleIn 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
