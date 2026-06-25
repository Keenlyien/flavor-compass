"use client"

import { Clock, Users } from "lucide-react"
import Link from "next/link"
import type { RecipeCardData } from "@/lib/types/recipe"
import { optimizeImage } from "@/lib/image"
import { formatTime } from "@/lib/time"

export type { RecipeCardData }

export default function RecipeCard({ recipe }: { recipe: RecipeCardData }) {
  return (
    <Link href={`/recipes/${recipe.id}`} style={{ textDecoration: "none" }}>
      <article
        className="card-base"
        style={{
          borderRadius: "4px",
          overflow: "hidden",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {/* Image */}
        <div style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", backgroundColor: "var(--bg-accent-strip)" }}>
          {recipe.image ? (
            <img
              src={optimizeImage(recipe.image, 500)}
              alt={recipe.title}
              style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.4s ease" }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px" }}>
              🍽️
            </div>
          )}

          {/* Cuisine badge */}
          <div style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            padding: "4px 10px",
            borderRadius: "2px",
            boxShadow: "0 2px 8px var(--shadow-card)",
          }}>
            <span style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: "9px",
              letterSpacing: "0.12em",
              color: "var(--accent-warm)",
              textTransform: "uppercase",
            }}>
              {recipe.cuisine}
            </span>
          </div>
        </div>

        {/* Content */}
        <div style={{
          padding: "14px 16px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}>
          <h3 style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontWeight: 400,
            fontSize: "17px",
            lineHeight: 1.25,
            color: "var(--text-primary)",
            letterSpacing: "0.01em",
            marginBottom: "10px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {recipe.title}
          </h3>

          {/* Meta row */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span style={{
              display: "flex", alignItems: "center", gap: "4px",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "12px", color: "var(--text-muted)",
            }}>
              <Clock size={11} strokeWidth={1.5} />
              {formatTime(recipe.readyInMinutes)}
            </span>
            <span style={{
              display: "flex", alignItems: "center", gap: "4px",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "12px", color: "var(--text-muted)",
            }}>
              <Users size={11} strokeWidth={1.5} />
              {recipe.servings} servings
            </span>
          </div>

          {/* Diet tags removed — confusing on cards (e.g. "vegetarian" badge on desserts) */}
        </div>
      </article>
    </Link>
  )
}
