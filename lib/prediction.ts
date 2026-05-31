import type { QtyTag, ReportKind } from "@/lib/db/schema"

// ── Tunable constants ──────────────────────────────────────────────────────
// Adjust these to tune prediction behavior without touching the algorithm.

export const PREDICTION_CONFIG = {
  // How many days a purchase lasts relative to "normal" quantity
  QTY_COEFFICIENTS: {
    more: 1.3,
    normal: 1.0,
    less: 0.7,
  } as Record<QtyTag, number>,

  // Each "still have it" report stretches the interval by this fraction
  STILL_CORRECTION_FACTOR: 0.1,

  // Maximum stretch factor from "still" reports (1.5 = 50% longer max)
  STILL_CORRECTION_MAX_FACTOR: 1.5,
} as const

// ── Types ──────────────────────────────────────────────────────────────────

export type ConfidenceLevel = "学習中" | "そこそこ" | "高め"

export interface PurchaseInput {
  purchasedOn: Date
  qtyTag: QtyTag
}

export interface ReportInput {
  reportedOn: Date
  kind: ReportKind
}

export interface PredictionResult {
  nextDepleteDate: Date | null
  daysRemaining: number | null
  confidence: ConfidenceLevel
  baseIntervalDays: number | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function startOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

function confidenceLevel(spanCount: number): ConfidenceLevel {
  if (spanCount >= 4) return "高め"
  if (spanCount >= 2) return "そこそこ"
  return "学習中"
}

// ── Core algorithm ─────────────────────────────────────────────────────────

/**
 * Predicts when a consumable item will next run out.
 *
 * @param purchases  All purchase records for the item, any order (sorted internally)
 * @param reports    All report records for the item, any order (sorted internally)
 * @param today      Reference date for "days remaining" calculation
 */
export function predict(
  purchases: PurchaseInput[],
  reports: ReportInput[],
  today: Date = new Date()
): PredictionResult {
  const { QTY_COEFFICIENTS, STILL_CORRECTION_FACTOR, STILL_CORRECTION_MAX_FACTOR } =
    PREDICTION_CONFIG

  const sortedPurchases = [...purchases].sort(
    (a, b) => a.purchasedOn.getTime() - b.purchasedOn.getTime()
  )
  const sortedReports = [...reports].sort(
    (a, b) => a.reportedOn.getTime() - b.reportedOn.getTime()
  )

  if (sortedPurchases.length === 0) {
    return { nextDepleteDate: null, daysRemaining: null, confidence: "学習中", baseIntervalDays: null }
  }

  // 1. Collect normalized spans between consecutive purchases
  const normalizedSpans: number[] = []

  for (let i = 0; i < sortedPurchases.length - 1; i++) {
    const from = sortedPurchases[i].purchasedOn
    const to = sortedPurchases[i + 1].purchasedOn
    const qtyTag = sortedPurchases[i].qtyTag

    // Check for an 'out' report between these two purchases — that's the real depletion point
    const outReport = sortedReports.find(
      (r) =>
        r.kind === "out" &&
        r.reportedOn > from &&
        r.reportedOn <= to
    )

    const rawSpan = outReport
      ? daysBetween(from, outReport.reportedOn)
      : daysBetween(from, to)

    // Normalize to "normal quantity" days
    const normalized = rawSpan / QTY_COEFFICIENTS[qtyTag]
    if (normalized > 0) normalizedSpans.push(normalized)
  }

  if (normalizedSpans.length === 0) {
    return {
      nextDepleteDate: null,
      daysRemaining: null,
      confidence: "学習中",
      baseIntervalDays: null,
    }
  }

  // 2. Linear-weighted average (newer spans weighted higher)
  const n = normalizedSpans.length
  const totalWeight = (n * (n + 1)) / 2
  const weightedSum = normalizedSpans.reduce(
    (sum, span, idx) => sum + span * (idx + 1),
    0
  )
  let baseInterval = weightedSum / totalWeight

  // 3. Apply 'still' correction for reports after the last purchase
  const lastPurchase = sortedPurchases[sortedPurchases.length - 1]
  const stillCount = sortedReports.filter(
    (r) => r.kind === "still" && r.reportedOn > lastPurchase.purchasedOn
  ).length

  const correctionFactor = Math.min(
    1 + STILL_CORRECTION_FACTOR * stillCount,
    STILL_CORRECTION_MAX_FACTOR
  )
  baseInterval *= correctionFactor

  // 4. Scale base interval by last purchase's quantity tag
  const lastQtyCoefficient = QTY_COEFFICIENTS[lastPurchase.qtyTag]
  const finalIntervalDays = Math.round(baseInterval * lastQtyCoefficient)

  // 5. Next depletion date = last purchase + final interval
  const nextDepleteDate = addDays(startOfDay(lastPurchase.purchasedOn), finalIntervalDays)
  const daysRemaining = daysBetween(startOfDay(today), nextDepleteDate)

  return {
    nextDepleteDate,
    daysRemaining,
    confidence: confidenceLevel(normalizedSpans.length),
    baseIntervalDays: Math.round(baseInterval),
  }
}
