import { NextRequest, NextResponse } from "next/server"
import { getPricesForCountry } from "@/lib/location"

export async function GET(request: NextRequest) {
  try {
    // Get the real client IP — works on Vercel and local
    const forwarded = request.headers.get("x-forwarded-for")
    const ip = forwarded ? forwarded.split(",")[0].trim() : null

    // In development, ip-api returns localhost (127.0.0.1) as a test IP
    // We handle this gracefully by falling back to DEFAULT
    if (!ip || ip === "127.0.0.1" || ip === "::1") {
      const fallback = getPricesForCountry("DEFAULT")
      return NextResponse.json({
        countryCode: "DEFAULT",
        currency: fallback.currency,
        symbol: fallback.symbol,
        city: null,
        source: "fallback-localhost",
      })
    }

    // Call ip-api.com server-side (avoids HTTP/HTTPS browser restriction)
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,countryCode,currency,city`,
      { next: { revalidate: 3600 } } // cache 1 hour
    )

    if (!response.ok) {
      throw new Error(`ip-api responded with ${response.status}`)
    }

    const data = await response.json()

    if (data.status !== "success") {
      throw new Error("ip-api returned non-success status")
    }

    const prices = getPricesForCountry(data.countryCode)

    return NextResponse.json({
      countryCode: data.countryCode,
      currency: prices.currency,
      symbol: prices.symbol,
      city: data.city ?? null,
      source: "ip-api",
    })

  } catch (error) {
    // Always return something usable — never break the UI
    const fallback = getPricesForCountry("DEFAULT")
    return NextResponse.json({
      countryCode: "DEFAULT",
      currency: fallback.currency,
      symbol: fallback.symbol,
      city: null,
      source: "fallback-error",
    })
  }
}
