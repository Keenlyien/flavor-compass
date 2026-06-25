"use client"

import { Menu, X } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      style={{
        backgroundColor: scrolled ? "rgba(250,247,242,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
        transition: "all 0.3s ease",
      }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-16">

          {/* Logo — left */}
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              textDecoration: "none",
            }}
          >
            <Image
              src="/flavor_compass.png"
              alt="Flavor Compass"
              width={44}
              height={44}
              style={{ objectFit: "contain" }}
            />
            <span style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-primary)",
              letterSpacing: "0.02em",
            }}>
              Flavor Compass
            </span>
          </Link>

          {/* Nav links — center */}
          <nav className="hidden lg:flex items-center gap-8">
            {[
              { label: "Recipes",    href: "/recipes" },
              { label: "Cuisines",   href: "/recipes?cuisine=" },
              { label: "How It Works", href: "/#how-it-works" },
            ].map(item => (
              <Link
                key={item.label}
                href={item.href}
                style={{
                  color: "var(--text-secondary)",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontWeight: 400,
                  fontSize: "13px",
                  letterSpacing: "0.02em",
                  textDecoration: "none",
                }}
                className="hover:opacity-60 transition-opacity"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right — CTA */}
          <div className="hidden lg:flex items-center gap-4">
            <Link
              href="/recipes"
              style={{
                backgroundColor: "var(--text-primary)",
                color: "var(--text-inverse)",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontWeight: 500,
                fontSize: "12px",
                letterSpacing: "0.03em",
                padding: "9px 20px",
                borderRadius: "100px",
                textDecoration: "none",
                transition: "opacity 0.15s ease",
              }}
              className="hover:opacity-80"
            >
              Explore Recipes ↗
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden"
            style={{ color: "var(--text-primary)" }}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            {menuOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            borderTop: "1px solid var(--border)",
          }}
          className="lg:hidden px-6 pb-6 pt-4 flex flex-col gap-5"
        >
          {[
            { label: "Recipes",      href: "/recipes" },
            { label: "Cuisines",     href: "/recipes?cuisine=" },
            { label: "How It Works", href: "/#how-it-works" },
          ].map(item => (
            <Link
              key={item.label}
              href={item.href}
              style={{
                color: "var(--text-secondary)",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize: "14px",
                textDecoration: "none",
              }}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}

          <div className="flex items-center gap-4 pt-2">
            <Link
              href="/recipes"
              style={{
                backgroundColor: "var(--text-primary)",
                color: "var(--text-inverse)",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "12px",
                fontWeight: 500,
                padding: "8px 18px",
                borderRadius: "100px",
                textDecoration: "none",
              }}
            >
              Explore Recipes ↗
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
