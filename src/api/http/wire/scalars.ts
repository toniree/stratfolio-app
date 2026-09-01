/**
 * Wire scalar decoding — the place every "absent ≠ zero" decision lives.
 *
 * plt serialises `BigDecimal` as a JSON number and omits nulls entirely
 * (`default-property-inclusion: non_null`), so a missing key means *unknown*,
 * not zero (§7.2). The mnd facade will send money as decimal *strings*
 * (§7.3), so these accept both encodings and never coerce a missing value.
 */

/** A decimal that may arrive as a JSON number (plt) or a string (mnd). */
export type WireDecimal = number | string

/** Decode a possibly-absent decimal. Returns `undefined` for anything that is
 *  not a finite number — never 0. */
export function decimal(value: WireDecimal | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * Decode a decimal the caller has established must be present.
 *
 * Throws rather than substituting 0: a missing `entry_price` is a broken
 * contract, and a silent zero would render a free position.
 */
export function requiredDecimal(value: WireDecimal | null | undefined, field: string): number {
  const parsed = decimal(value)
  if (parsed === undefined) throw new Error(`Missing required decimal field: ${field}`)
  return parsed
}

export function integer(value: number | string | null | undefined): number | undefined {
  const parsed = decimal(value as WireDecimal)
  return parsed === undefined ? undefined : Math.trunc(parsed)
}

export function requiredInteger(value: number | string | null | undefined, field: string): number {
  const parsed = integer(value)
  if (parsed === undefined) throw new Error(`Missing required integer field: ${field}`)
  return parsed
}

export function text(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

export function requiredText(value: string | null | undefined, field: string): string {
  const parsed = text(value)
  if (parsed === undefined) throw new Error(`Missing required string field: ${field}`)
  return parsed
}

/** ISO-8601 instants; plt sets `write-dates-as-timestamps: false`. */
export function instant(value: string | null | undefined): string | undefined {
  const parsed = text(value)
  if (parsed === undefined) return undefined
  return Number.isNaN(Date.parse(parsed)) ? undefined : parsed
}

export function requiredInstant(value: string | null | undefined, field: string): string {
  const parsed = instant(value)
  if (parsed === undefined) throw new Error(`Missing required timestamp field: ${field}`)
  return parsed
}

export function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.filter((item): item is string => typeof item === 'string')
  return items.length > 0 ? items : undefined
}

/**
 * A backend *fraction* (0..1) rendered in the app's 0–100 conviction domain.
 *
 * This is the only ×100 in the codebase (§7.4). plt/ai send `confidence` as a
 * 0..1 `BigDecimal` on theses, plans and episodes; the app's `AIAssessment`,
 * badges and copy all speak 0–100. Doing the conversion anywhere else is how a
 * 0.72 confidence becomes a "0/100 conviction" or a "7200".
 */
export function convictionFromConfidence(
  confidence: WireDecimal | null | undefined,
): number | undefined {
  const fraction = decimal(confidence)
  if (fraction === undefined) return undefined
  // Clamp rather than trust: a provider that ever sends 0..100 would otherwise
  // produce a 7,200-point conviction badge.
  const clamped = Math.max(0, Math.min(1, fraction))
  return Math.round(clamped * 100)
}

/**
 * `profit_target_pct` / `stop_loss_pct` are **fractions**, not percent points
 * (§7.1): 0.25 means 25%. Converting for display happens here and nowhere else.
 */
export function percentPointsFromFraction(
  value: WireDecimal | null | undefined,
): number | undefined {
  const fraction = decimal(value)
  return fraction === undefined ? undefined : fraction * 100
}
