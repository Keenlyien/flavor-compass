import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.spoonacular.com" },
      { protocol: "https", hostname: "spoonacular.com" },
    ],
  },
}

export default nextConfig
