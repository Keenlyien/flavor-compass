"use client"

import { Search, X } from "lucide-react"
import { useRef } from "react"

interface RecipeSearchProps {
  value: string
  onChange: (val: string) => void
  onSubmit: () => void
}

export default function RecipeSearch({ value, onChange, onSubmit }: RecipeSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSubmit()
  }

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: "560px" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "2px",
        boxShadow: "0 2px 12px var(--shadow-card)",
        overflow: "hidden",
      }}>
        <div style={{ padding: "0 14px", display: "flex", alignItems: "center" }}>
          <Search size={16} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Search recipes, ingredients, cuisines..."
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            backgroundColor: "transparent",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: "14px",
            color: "var(--text-primary)",
            padding: "12px 0",
            letterSpacing: "0.01em",
          }}
        />

        {value && (
          <button
            onClick={() => { onChange(""); inputRef.current?.focus() }}
            style={{ padding: "0 12px", display: "flex", alignItems: "center", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        )}

        <button
          onClick={onSubmit}
          style={{
            backgroundColor: "var(--accent-warm)",
            color: "#FFFFFF",
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            fontSize: "13px",
            padding: "12px 20px",
            border: "none",
            cursor: "pointer",
            letterSpacing: "0.02em",
            transition: "opacity 0.15s ease",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          Search
        </button>
      </div>
    </div>
  )
}
