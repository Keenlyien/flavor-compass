/**
 * Formats a duration in minutes into a readable "Xh Ym" string.
 *
 *   45   -> "45m"
 *   60   -> "1h"
 *   90   -> "1h 30m"
 *   180  -> "3h"
 *   135  -> "2h 15m"
 */
export function formatTime(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return "0m"

  const hours   = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}
