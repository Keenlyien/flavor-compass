import Navbar from "@/components/layout/Navbar"
import Hero from "@/components/home/Hero"
import HowItWorks from "@/components/home/HowItWorks"
import FeaturedRecipes from "@/components/home/FeaturedRecipes"

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <HowItWorks />
      <FeaturedRecipes />
    </main>
  )
}
