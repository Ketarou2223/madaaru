"use client"

import BuyModal from "./BuyModal"
import { recordReport } from "@/app/actions"
import { ShoppingCartIcon, ChevronRightIcon } from "./icons"
import { startTransition, useOptimistic } from "react"
import type { ConfidenceLevel } from "@/lib/prediction"

export interface ShoppingItem {
  id: string
  name: string
  category: string | null
  lastReportKind: "soon" | "out"
}

export interface SuggestedItem {
  id: string
  name: string
  category: string | null
  prediction: {
    daysRemaining: number | null
    confidence: ConfidenceLevel
  }
}

interface ShoppingTabProps {
  items: ShoppingItem[]
  suggested: SuggestedItem[]
}

function daysHint(days: number | null) {
  if (days === null) return ""
  if (days <= 0) return "すでに切れているかも"
  if (days === 1) return "明日には切れそう"
  return `あと約 ${days}日`
}

export default function ShoppingTab({ items, suggested }: ShoppingTabProps) {
  const [optimisticSuggested, removeSuggested] = useOptimistic(
    suggested,
    (state: SuggestedItem[], id: string) => state.filter((i) => i.id !== id)
  )

  function handleAddSuggested(itemId: string) {
    startTransition(async () => {
      removeSuggested(itemId)
      await recordReport(itemId, "soon")
    })
  }

  const isEmpty = items.length === 0 && optimisticSuggested.length === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
          <ShoppingCartIcon size={28} className="text-stone-400" />
        </div>
        <div>
          <p className="font-semibold text-stone-700">買い物リストは空です</p>
          <p className="mt-1 text-sm text-stone-400">「まだある？」タブで左スワイプすると追加されます</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-4 pb-6 space-y-6">
      {/* Main shopping list */}
      {items.length > 0 && (
        <section>
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wider px-1 mb-3">
            買う — {items.length}件
          </p>
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border px-5 py-4 shadow-sm ${
                  item.lastReportKind === "out"
                    ? "border-rose-200 bg-rose-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {item.category && (
                      <p className="text-xs text-stone-400 mb-0.5">{item.category}</p>
                    )}
                    <h2 className="text-base font-semibold text-stone-900 truncate">{item.name}</h2>
                    <p className={`text-sm mt-0.5 font-medium ${
                      item.lastReportKind === "out" ? "text-rose-600" : "text-amber-700"
                    }`}>
                      {item.lastReportKind === "out" ? "切れた" : "そろそろ切れる"}
                    </p>
                  </div>
                  <BuyModal itemId={item.id} itemName={item.name} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Suggested items (きれそうでまだ大丈夫にしたもの) */}
      {optimisticSuggested.length > 0 && (
        <section>
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wider px-1 mb-3">
            大丈夫に分類したけど、そろそろかも
          </p>
          <div className="space-y-2">
            {optimisticSuggested.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-stone-200 bg-white/60 px-5 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  {item.category && (
                    <p className="text-xs text-stone-300 mb-0.5">{item.category}</p>
                  )}
                  <h2 className="text-sm font-medium text-stone-500 truncate">{item.name}</h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {daysHint(item.prediction.daysRemaining)}
                  </p>
                </div>
                <button
                  onClick={() => handleAddSuggested(item.id)}
                  className="shrink-0 flex items-center gap-1 rounded-xl bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-200 transition-colors active:scale-95"
                >
                  追加
                  <ChevronRightIcon size={12} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
