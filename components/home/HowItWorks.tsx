"use client"

import { useState, useEffect } from "react"
import { Search, BookOpen, ChefHat, ArrowRight } from "lucide-react"
import Link from "next/link"

const STEPS = [
  {
    number: "01",
    icon: <Search size={20} strokeWidth={1.5} />,
    title: "Find a Recipe",
    description: "Search 13,000+ recipes by cuisine, ingredient, diet, or cook time. Filter until you find exactly what you're craving.",
  },
  {
    number: "02",
    icon: <BookOpen size={20} strokeWidth={1.5} />,
    title: "Review the Details",
    description: "Check ingredients, nutrition per serving, and the full method before you start. Everything on one clean page.",
  },
  {
    number: "03",
    icon: <ChefHat size={20} strokeWidth={1.5} />,
    title: "Cook Step by Step",
    description: "Follow the immersive walkthrough — one step at a time, with built-in timers so nothing gets missed or burned.",
  },
]

export default function HowItWorks() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <section
      id="how-it-works"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderBottom: "1px solid var(--border)",
        padding: "100px 0",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12">

        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", alignItems: "end", marginBottom: "64px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ width: "32px", height: "1px", backgroundColor: "var(--accent-rose)" }} />
              <span style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: "10px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}>
                How It Works
              </span>
            </div>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontWeight: 300,
              fontSize: "clamp(36px, 4vw, 52px)",
              color: "var(--text-primary)",
              letterSpacing: "0.01em",
              lineHeight: 1.08,
            }}>
              From craving to table,{" "}
              <em style={{ fontStyle: "italic", color: "var(--accent-warm)" }}>
                in three steps.
              </em>
            </h2>
          </div>

          <div style={{ textAlign: "right" }}>
            <Link
              href="/recipes"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "var(--text-primary)",
                color: "var(--text-inverse)",
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500,
                fontSize: "13px",
                padding: "12px 24px",
                borderRadius: "100px",
                textDecoration: "none",
                transition: "opacity 0.15s ease",
              }}
              className="hover:opacity-80"
            >
              Start Exploring
              <ArrowRight size={13} strokeWidth={2} />
            </Link>
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", backgroundColor: "var(--border-card)" }}>
          {STEPS.map((s, i) => (
            <div
              key={s.number}
              className={mounted ? "anim-fade-up" : "opacity-0"}
              style={{
                backgroundColor: "var(--bg-card)",
                padding: "40px 36px",
                animationDelay: `${i * 100}ms`,
                position: "relative",
              }}
            >
              {/* Large number watermark */}
              <span style={{
                position: "absolute",
                top: "24px",
                right: "28px",
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "72px",
                fontWeight: 300,
                color: "var(--bg-accent-strip)",
                lineHeight: 1,
                userSelect: "none",
                letterSpacing: "-0.02em",
              }}>
                {s.number}
              </span>

              {/* Icon */}
              <div style={{
                width: "44px",
                height: "44px",
                border: "1px solid var(--border)",
                borderRadius: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-warm)",
                marginBottom: "24px",
              }}>
                {s.icon}
              </div>

              <h3 style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 400,
                fontSize: "22px",
                color: "var(--text-primary)",
                letterSpacing: "0.02em",
                marginBottom: "12px",
              }}>
                {s.title}
              </h3>

              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                lineHeight: 1.8,
                color: "var(--text-muted)",
              }}>
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
