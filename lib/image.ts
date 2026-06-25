/**
 * Optimize a Cloudinary image URL with free, on-the-fly transformations.
 * These run at Cloudinary's CDN edge and are cached — they do NOT count
 * toward storage quota, only bandwidth (25GB/month free).
 *
 * e_improve:70 — Cloudinary's free AI auto-enhancement: adjusts
 *                 brightness, contrast, and saturation intelligently
 * e_sharpen:60 — additional sharpening on top
 *
 * @param url    Original image URL (Cloudinary or otherwise)
 * @param width  Target width in pixels — choose based on display size:
 *               - grid cards: 500
 *               - featured/hero cards: 600-900
 *               - recipe detail hero: 900
 */
export function optimizeImage(url: string, width: number): string {
  if (!url || !url.includes("res.cloudinary.com")) return url
  return url.replace(
    "/upload/",
    `/upload/w_${width},c_fill,g_auto,q_auto:best,f_auto,e_improve:70,e_sharpen:60/`
  )
}
