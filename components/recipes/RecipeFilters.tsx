"use client"

import { useEffect, useState, useRef } from "react"
import { Star, Clock, HeartPulse } from "lucide-react"
import { motion, useMotionValue, useSpring, MotionValue } from "framer-motion"

interface FilterOption {
  label: string
  value: string
  emoji: string
}

const CUISINES: FilterOption[] = [
  { label: "All",      value: "",         emoji: "🌍" },
  { label: "Italian",  value: "italian",  emoji: "🍝" },
  { label: "Japanese", value: "japanese", emoji: "🍜" },
  { label: "Mexican",  value: "mexican",  emoji: "🌮" },
  { label: "French",   value: "french",   emoji: "🥐" },
  { label: "Thai",     value: "thai",     emoji: "🍛" },
  { label: "Indian",   value: "indian",   emoji: "🫓" },
  { label: "Chinese",  value: "chinese",  emoji: "🥟" },
  { label: "American", value: "american", emoji: "🍔" },
  { label: "Greek",    value: "greek",    emoji: "🫒" },
  { label: "Korean",   value: "korean",   emoji: "🥢" },
  { label: "Spanish",  value: "spanish",  emoji: "🥘" },
]

const DIETS: FilterOption[] = [
  { label: "All",         value: "",            emoji: "✨" },
  { label: "Vegetarian",  value: "vegetarian",  emoji: "🥗" },
  { label: "Vegan",       value: "vegan",       emoji: "🌱" },
  { label: "Gluten Free", value: "gluten free", emoji: "🌾" },
  { label: "Keto",        value: "ketogenic",   emoji: "🥩" },
]

const SORT_ICONS: Record<string, React.ReactNode> = {
  popularity:  <Star size={13} strokeWidth={2} />,
  time:        <Clock size={13} strokeWidth={2} />,
  healthiness: <HeartPulse size={13} strokeWidth={2} />,
}

const SORT_OPTIONS: FilterOption[] = [
  { label: "Popularity",  value: "popularity",  emoji: "⭐" },
  { label: "Time",        value: "time",        emoji: "⏱" },
  { label: "Healthiness", value: "healthiness", emoji: "💚" },
]

/* ── Dock config ──────────────────────────────────────────────────
   DOCK_DISTANCE is intentionally tight (55px) relative to pill width
   (~110-150px) so only ONE pill is ever meaningfully magnified at a
   time — wider radii caused 3-4 neighboring pills to scale together,
   which looked chaotic. Combined with a larger row gap (14px instead
   of 6px), each pill's influence zone no longer overlaps its
   neighbors' resting positions.
─────────────────────────────────────────────────────────────────── */
const DOCK_SCALE    = 1.4
const DOCK_DISTANCE = 55
const SPRING_CFG    = { mass: 0.1, stiffness: 170, damping: 14 }

/* ── Generic batch image pre-fetcher ── */
function useImageMap(options: FilterOption[], endpoint: string, paramName: string) {
  const [imgMap, setImgMap] = useState<Record<string, string>>({})

  useEffect(() => {
    const nonAll = options.filter(o => o.value !== "")
    Promise.all(
      nonAll.map(o =>
        fetch(`${endpoint}?${paramName}=${encodeURIComponent(o.value)}`)
          .then(r => r.json())
          .then(d => ({ value: o.value, url: d.url || "" }))
          .catch(() => ({ value: o.value, url: "" }))
      )
    ).then(results => {
      const map: Record<string, string> = {}
      results.forEach(r => { if (r.url) map[r.value] = r.url })
      setImgMap(map)
    })
  }, [])

  return imgMap
}

/* ── Photo thumbnail ── */
function PhotoThumb({
  option, imgUrl, active,
}: {
  option: FilterOption
  imgUrl?: string
  active: boolean
}) {
  const [loaded, setLoaded]   = useState(false)
  const [errored, setErrored] = useState(false)
  const showImg = imgUrl && !errored && option.value !== ""

  return (
    <div style={{
      width: "24px", height: "24px",
      borderRadius: "50%", overflow: "hidden", flexShrink: 0,
      border: active ? "2px solid rgba(255,255,255,0.6)" : "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "center",
      backgroundColor: "var(--bg-accent-strip)",
      transition: "border 0.15s ease",
    }}>
      {showImg ? (
        <img src={imgUrl} alt={option.label}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            opacity: loaded ? 1 : 0, transition: "opacity 0.2s ease",
          }}
        />
      ) : (
        <span style={{ fontSize: "13px", lineHeight: 1 }}>{option.emoji}</span>
      )}
    </div>
  )
}

/* ── Generic magnified dock pill — shared by Cuisine, Diet, and Sort ──
   Uses TRUE 2D distance (both X and Y) rather than horizontal-only.
   Horizontal-only distance caused a bug where a pill directly above
   or below the hovered one (on a wrapped second line) would also
   magnify, since it shared the same X position — the cursor's Y
   position was never checked. ──────────────────────────────────── */
function DockPill({
  option, active, onClick, imgUrl, showImage, icon, mouseX, mouseY,
}: {
  option: FilterOption
  active: boolean
  onClick: () => void
  imgUrl?: string
  showImage?: boolean
  icon?: React.ReactNode
  mouseX: MotionValue<number>
  mouseY: MotionValue<number>
}) {
  const ref = useRef<HTMLDivElement>(null)

  // A raw MotionValue (not React state) holds the scale target,
  // updated imperatively via .set() inside the recalc function below.
  // This is important: useSpring(plainNumber) only seeds its INITIAL
  // value — it does not react to that number changing on later
  // renders. Feeding useSpring a MotionValue instead means the spring
  // correctly re-targets every time .set() is called, which is what
  // actually drives the magnify animation on every mouse movement.
  const scaleTarget = useMotionValue(1)

  useEffect(() => {
    const recalc = () => {
      if (!ref.current) return
      const mx = mouseX.get()
      const my = mouseY.get()
      if (!isFinite(mx) || !isFinite(my)) {
        scaleTarget.set(1)
        return
      }
      const rect = ref.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      // True Euclidean distance — a pill only magnifies if the cursor
      // is actually close to it in BOTH dimensions, not just aligned
      // horizontally with a pill on a different wrapped line.
      const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2)
      const t = Math.max(0, Math.min(1, 1 - dist / DOCK_DISTANCE))
      scaleTarget.set(1 + t * (DOCK_SCALE - 1))
    }

    const unsubX = mouseX.on("change", recalc)
    const unsubY = mouseY.on("change", recalc)
    return () => { unsubX(); unsubY() }
  }, [mouseX, mouseY, scaleTarget])

  const scale = useSpring(scaleTarget, SPRING_CFG)

  return (
    <motion.div
      ref={ref}
      style={{
        scale,
        originY: 1,        /* scale from bottom so pills grow upward, never downward */
        flexShrink: 0,
      }}
    >
      <button
        onClick={onClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "7px",
          padding: "6px 14px",
          borderRadius: "2px",
          border: active ? "1px solid var(--accent-warm)" : "1px solid var(--border-card)",
          backgroundColor: active ? "var(--accent-warm)" : "var(--bg-card)",
          color: active ? "#FFFFFF" : "var(--text-secondary)",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "12px",
          fontWeight: active ? 500 : 400,
          cursor: "pointer",
          transition: "background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease",
          boxShadow: active ? "none" : "0 1px 4px var(--shadow-card)",
          whiteSpace: "nowrap",
        }}
      >
        {showImage ? (
          <PhotoThumb option={option} imgUrl={imgUrl} active={active} />
        ) : icon ? (
          <span style={{ display: "inline-flex", color: active ? "#FFFFFF" : "var(--accent-warm)" }}>
            {icon}
          </span>
        ) : (
          <span style={{ fontSize: "13px" }}>{option.emoji}</span>
        )}
        {option.label}
      </button>
    </motion.div>
  )
}

/* ── A dock row — tracks its own mouseX AND mouseY, wraps a set of
   DockPills. Tracking Y as well as X is what allows the 2D distance
   calculation in DockPill to correctly ignore pills on a different
   wrapped line even when they share the same horizontal position. ── */
function DockRow({ children }: {
  children: (mouseX: MotionValue<number>, mouseY: MotionValue<number>) => React.ReactNode
}) {
  const mouseX = useMotionValue(-Infinity)
  const mouseY = useMotionValue(-Infinity)
  return (
    <motion.div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "14px",
        overflow: "visible",
        paddingTop: "20px",
        paddingBottom: "8px",
        paddingLeft: "4px",
        paddingRight: "4px",
        marginTop: "-20px",
        rowGap: "24px",          /* extra vertical gap so wrapped-line pills sit further apart */
      }}
      onMouseMove={e => { mouseX.set(e.clientX); mouseY.set(e.clientY) }}
      onMouseLeave={() => { mouseX.set(-Infinity); mouseY.set(-Infinity) }}
    >
      {children(mouseX, mouseY)}
    </motion.div>
  )
}

interface RecipeFiltersProps {
  cuisine: string
  diet: string
  sort: string
  onCuisineChange: (val: string) => void
  onDietChange:    (val: string) => void
  onSortChange:    (val: string) => void
}

export default function RecipeFilters({
  cuisine, diet, sort,
  onCuisineChange, onDietChange, onSortChange,
}: RecipeFiltersProps) {
  const cuisineImgs = useImageMap(CUISINES, "/api/cuisine-image", "cuisine")
  const dietImgs    = useImageMap(DIETS, "/api/diet-image", "diet")

  return (
    /* overflow: visible at every level so scaled pills are never
       clipped on any side — top, bottom, left, or right            */
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", overflow: "visible" }}>

      {/* ── Cuisines ── */}
      <div style={{ overflow: "visible" }}>
        <p className="type-label" style={{ fontSize: "9px", marginBottom: "12px" }}>Cuisine</p>
        <DockRow>
          {(mouseX, mouseY) => CUISINES.map(opt => (
            <DockPill
              key={opt.value}
              option={opt}
              active={cuisine === opt.value}
              onClick={() => onCuisineChange(opt.value)}
              imgUrl={cuisineImgs[opt.value]}
              showImage
              mouseX={mouseX}
              mouseY={mouseY}
            />
          ))}
        </DockRow>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: "var(--border)" }} />

      {/* ── Diet + Sort — both also get the dock effect, each with its own independent mouseX ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", overflow: "visible" }}>
        <div style={{ overflow: "visible" }}>
          <p className="type-label" style={{ fontSize: "9px", marginBottom: "8px" }}>Diet</p>
          <DockRow>
            {(mouseX, mouseY) => DIETS.map(opt => (
              <DockPill
                key={opt.value}
                option={opt}
                active={diet === opt.value}
                onClick={() => onDietChange(opt.value)}
                imgUrl={dietImgs[opt.value]}
                showImage
                mouseX={mouseX}
                mouseY={mouseY}
              />
            ))}
          </DockRow>
        </div>

        <div style={{ overflow: "visible" }}>
          <p className="type-label" style={{ fontSize: "9px", marginBottom: "8px" }}>Sort By</p>
          <DockRow>
            {(mouseX, mouseY) => SORT_OPTIONS.map(opt => (
              <DockPill
                key={opt.value}
                option={opt}
                active={sort === opt.value}
                onClick={() => onSortChange(opt.value)}
                icon={SORT_ICONS[opt.value]}
                mouseX={mouseX}
                mouseY={mouseY}
              />
            ))}
          </DockRow>
        </div>
      </div>
    </div>
  )
}
