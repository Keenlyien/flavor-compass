"use client"

import { useEffect, useState } from "react"
import { Star, Clock, HeartPulse } from "lucide-react"

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

// Sort options use real vector icons instead of emoji or photos — there's
// no sensible "photo" for an abstract sort concept like "Popularity", so
// crisp Lucide icons are the correct fix here rather than a forced image.
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

/* ── Generic batch image pre-fetcher — works for cuisine OR diet ── */
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

/* ── Small circular photo thumbnail (used for cuisine + diet pills) ── */
function PhotoThumb({
  option,
  imgUrl,
  active,
}: {
  option: FilterOption
  imgUrl?: string
  active: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  const showImg = imgUrl && !errored && option.value !== ""

  return (
    <div style={{
      width: "24px",
      height: "24px",
      borderRadius: "50%",
      overflow: "hidden",
      flexShrink: 0,
      border: active ? "2px solid rgba(255,255,255,0.6)" : "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "var(--bg-accent-strip)",
      transition: "border 0.15s ease",
    }}>
      {showImg ? (
        <img
          src={imgUrl}
          alt={option.label}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.2s ease",
          }}
        />
      ) : (
        <span style={{ fontSize: "13px", lineHeight: 1 }}>{option.emoji}</span>
      )}
    </div>
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

function FilterPill({
  option,
  active,
  onClick,
  imgUrl,
  showImage,
  icon,
}: {
  option: FilterOption
  active: boolean
  onClick: () => void
  imgUrl?: string
  showImage?: boolean
  icon?: React.ReactNode
}) {
  return (
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
        transition: "all 0.15s ease",
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
  )
}

export default function RecipeFilters({
  cuisine, diet, sort,
  onCuisineChange, onDietChange, onSortChange,
}: RecipeFiltersProps) {
  const cuisineImgs = useImageMap(CUISINES, "/api/cuisine-image", "cuisine")
  const dietImgs    = useImageMap(DIETS, "/api/diet-image", "diet")

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

      {/* Cuisines */}
      <div>
        <p className="type-label" style={{ fontSize: "9px", marginBottom: "8px" }}>Cuisine</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {CUISINES.map(opt => (
            <FilterPill
              key={opt.value}
              option={opt}
              active={cuisine === opt.value}
              onClick={() => onCuisineChange(opt.value)}
              imgUrl={cuisineImgs[opt.value]}
              showImage
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: "var(--border)" }} />

      {/* Diet + Sort row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "24px" }}>
        <div>
          <p className="type-label" style={{ fontSize: "9px", marginBottom: "8px" }}>Diet</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {DIETS.map(opt => (
              <FilterPill
                key={opt.value}
                option={opt}
                active={diet === opt.value}
                onClick={() => onDietChange(opt.value)}
                imgUrl={dietImgs[opt.value]}
                showImage
              />
            ))}
          </div>
        </div>

        <div>
          <p className="type-label" style={{ fontSize: "9px", marginBottom: "8px" }}>Sort By</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {SORT_OPTIONS.map(opt => (
              <FilterPill
                key={opt.value}
                option={opt}
                active={sort === opt.value}
                onClick={() => onSortChange(opt.value)}
                icon={SORT_ICONS[opt.value]}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
