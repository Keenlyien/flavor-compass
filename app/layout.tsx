import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/ui/ThemeProvider"
import Footer from "@/components/layout/Footer"

export const metadata: Metadata = {
  title: "Flavor Compass — Your Global Cooking Guide",
  description: "Discover recipes from around the world. Flavor Compass guides home cooks through new cuisines, techniques, and flavors — one recipe at a time.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  )
}
