"use client"

import { useState } from "react"
import { recordReport } from "@/app/actions"
import BuyModal from "./BuyModal"
import type { ConfidenceLevel } from "@/lib/prediction"

interface ItemPrediction {
  nextDepleteDate: string | null
  daysRemaining: number | null
  confidence: ConfidenceLevel
}

interface ItemCardProps {
  item: {
    id: string
    name: string
    category: string | null
    prediction: ItemPrediction
    isOnShoppingList: boolean
  }
}

function urgencyStyle(days: number | null) {
  if (days === null) return { card: "border-slate-200 bg-white", badge: "bg-slate-100 text-slate-500" }
  if (days <= 0) return { card: "border-rose-300 bg-rose-50", badge: "bg-rose-100 text-rose-700" }
  if (days <= 3) return { card: "border-rose-200 bg-rose-50", badge: "bg-rose-100 text-rose-600" }
  if (days <= 7) return { card: "border-amber-200 bg-amber-50", badge: "bg-amber-100 text-amber-700" }
  return { card: "border-emerald-200 bg-emerald-50", badge: "bg-emerald-100 text-emerald-700" }
}

function daysLabel(days: number | null) {
  if (days === null) return "学習中"
  if (days < 0) return `${Math.abs(days)}日超過`
  if (days === 0) return "今日切れる"
  if (days === 1) return "明日切れる"
  return `残り約 ${days}日`
}

function confidenceBadge(confidence: ConfidenceLevel) {
  const map: Record<ConfidenceLevel, string> = {
    学習中: "🌱 学習中",
    そこそこ: "📈 そこそこ",
    高め: "✅ 高め",
  }
  return map[confidence]
}

export default function ItemCard({ item }: ItemCardProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const { card, badge } = urgencyStyle(item.prediction.daysRemaining)

  async function handleReport(kind: "soon" | "out" | "still") {
    setLoading(kind)
    await recordReport(item.id, kind)
    setLoading(null)
  }

  return (
    <div className={`rounded-2xl border shadow-sm p-4 ${card}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          {item.category && (
            <p className="text-xs text-slate-400 truncate">{item.category}</p>
          )}
          <h2 className="text-lg font-semibold text-slate-800 truncate">{item.name}</h2>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>
          {item.prediction.confidence === "学習中"
            ? "🌱 学習中"
            : confidenceBadge(item.prediction.confidence)}
        </span>
      </div>

      {/* Days remaining */}
      <p className={`text-sm font-medium mb-4 ${
        item.prediction.daysRemaining !== null && item.prediction.daysRemaining <= 3
          ? "text-rose-600"
          : item.prediction.daysRemaining !== null && item.prediction.daysRemaining <= 7
          ? "text-amber-700"
          : "text-slate-600"
      }`}>
        {daysLabel(item.prediction.daysRemaining)}
      </p>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <BuyModal itemId={item.id} itemName={item.name} />

        <button
          onClick={() => handleReport("soon")}
          disabled={!!loading}
          className="rounded-xl bg-amber-100 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-200 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading === "soon" ? "…" : "そろそろ"}
        </button>

        <button
          onClick={() => handleReport("out")}
          disabled={!!loading}
          className="rounded-xl bg-rose-100 py-2.5 text-sm font-medium text-rose-800 hover:bg-rose-200 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading === "out" ? "…" : "切れた"}
        </button>

        <button
          onClick={() => handleReport("still")}
          disabled={!!loading}
          className="rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading === "still" ? "…" : "まだある"}
        </button>
      </div>

      {item.isOnShoppingList && (
        <div className="mt-3 rounded-lg bg-sky-50 px-3 py-1.5 text-xs text-sky-700">
          🛒 買い物リストに入っています
        </div>
      )}
    </div>
  )
}
