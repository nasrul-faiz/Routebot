import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parses a freeform search string and extracts an optional shift keyword.
 *
 * Examples:
 *   "sel 3 am"  → { nameQuery: "sel 3", shiftFilter: "AM" }
 *   "KL 7 PM"   → { nameQuery: "KL 7", shiftFilter: "PM" }
 *   "sel"       → { nameQuery: "sel",   shiftFilter: null }
 *   "am"        → { nameQuery: "",      shiftFilter: "AM" }
 */
export function parseSmartQuery(raw: string): {
  nameQuery: string
  shiftFilter: "AM" | "PM" | null
} {
  const tokens = raw.trim().split(/\s+/)
  let shiftFilter: "AM" | "PM" | null = null
  const nameTokens: string[] = []

  for (const token of tokens) {
    const t = token.toLowerCase()
    if (t === "am") {
      shiftFilter = "AM"
    } else if (t === "pm") {
      shiftFilter = "PM"
    } else if (token) {
      nameTokens.push(token)
    }
  }

  return { nameQuery: nameTokens.join(" "), shiftFilter }
}

/**
 * Returns true if the given delivery schedule is active on the provided date.
 * Uses local noon to avoid DST edge-cases with epoch-day calculation.
 *
 * Delivery types:
 *   Daily     — every day
 *   Alt 1     — alternating odd epoch-days
 *   Alt 2     — alternating even epoch-days
 *   Weekday   — Sun–Thu (0–4)
 *   Weekday 2 — Mon–Fri (1–5)
 *   Weekday 3 — Sun, Tue, Thu (0, 2, 4)
 */
export function isDeliveryActive(delivery: string, date: Date = new Date()): boolean {
  const dayOfWeek = date.getDay()
  const localNoon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
  const epochDay  = Math.floor(localNoon.getTime() / 86400000)
  switch (delivery) {
    case "Daily":     return true
    case "Alt 1":     return epochDay % 2 !== 0
    case "Alt 2":     return epochDay % 2 === 0
    case "Weekday":   return dayOfWeek >= 0 && dayOfWeek <= 4
    case "Weekday 2": return dayOfWeek >= 1 && dayOfWeek <= 5
    case "Weekday 3": return [0, 2, 4].includes(dayOfWeek)
    default:          return true
  }
}
