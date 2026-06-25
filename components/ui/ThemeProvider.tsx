"use client"

/**
 * Dark mode has been removed from the app — Digital Chef is light-theme only.
 * This file is kept as an inert pass-through so it doesn't break any
 * existing <ThemeProvider> wrapper in layout.tsx without requiring a
 * second edit. It no longer reads/writes localStorage or toggles theme.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
