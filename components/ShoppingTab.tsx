"use client"

import { startTransition, useOptimistic, useCallback } from "react"
import SwipeCard from "./SwipeCard"
import BuyModal from "./BuyModal"
import { recordReport, recordPurchase, undoReport, undoPurchase } from "@/app/actions"
import { ShoppingCartIcon, ChevronRightIcon } from "./icons"
import type { ConfidenceLevel } from "@/lib/prediction"
import type { UndoConfig } from "./UndoToast"
import { SWIPE_ACTIONS } from "@/lib/swipe-config"

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
  onShowUndo: (config: UndoConfig) => void
  onCardDragProgress: (p: number, dir: "left" | "right" | null, label: string, waiting?: boolean) => void
}

function daysHint(days: number | null) {
  if (days === null) return ""
  if (days <= 0) return "すでに切れているかも"
  if (days === 1) return "明日には切れそう"
  return `あと約 ${days}日`
}

function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Left = 買った, Right = 削除 (stage-3, onSwipeRight remains undefined for now)
const LEFT_CFG = SWIPE_ACTIONS.bought
const RIGHT_CFG = SWIPE_ACTIONS.deleteItem

export default function ShoppingTab({ items, suggested, onShowUndo, onCardDragProgress }: ShoppingTabProps) {
  type SuggestedAction = { type: "remove"; id: string } | { type: "addBack"; item: SuggestedItem }

  const [optimisticSuggested, dispatchSuggested] = useOptimistic(
    suggested,
    (state: SuggestedItem[], action: SuggestedAction) => {
      if (action.type === "remove") return state.filter((i) => i.id !== action.id)
      return state.some((i) => i.id === action.item.id) ? state : [...state, action.item]
    }
  )

  type ShoppingAction = { type: "remove"; id: string } | { type: "addBack"; item: ShoppingItem }

  const [optimisticItems, dispatchItems] = useOptimistic(
    items,
    (state: ShoppingItem[], action: ShoppingAction) => {
      if (action.type === "remove") return state.filter((i) => i.id !== action.id)
      return state.some((i) => i.id === action.item.id) ? state : [...state, action.item]
    }
  )

  const handleDragProgress = useCallback((p: number, dir: "left" | "right" | null, waiting?: boolean) => {
    onCardDragProgress(
      p,
      dir,
      dir === "left" ? LEFT_CFG.label : dir === "right" ? RIGHT_CFG.label : "",
      waiting
    )
  }, [onCardDragProgress])

  function handleSwipeLeft(item: ShoppingItem) {
    startTransition(async () => {
      dispatchItems({ type: "remove", id: item.id })
      const result = await recordPurchase(item.id, "normal", todayString())
      if ("id" in result) {
        onShowUndo({
          message: `「${item.name}」の購入を記録しました`,
          onUndo: async () => {
            const res = await undoPurchase(result.id)
            if ("error" in res) throw new Error(res.error)
          },
          onUndoOptimistic: () => dispatchItems({ type: "addBack", item }),
        })
      }
    })
  }

  function handleAddSuggested(suggestedItem: SuggestedItem) {
    startTransition(async () => {
      dispatchSuggested({ type: "remove", id: suggestedItem.id })
      const result = await recordReport(suggestedItem.id, "soon")
      if ("id" in result) {
        onShowUndo({
          message: `「${suggestedItem.name}」を買い物リストへ追加`,
          onUndo: async () => {
            const res = await undoReport(result.id)
            if ("error" in res) throw new Error(res.error)
          },
          onUndoOptimistic: () => dispatchSuggested({ type: "addBack", item: suggestedItem }),
        })
      }
    })
  }

  const isEmpty = optimisticItems.length === 0 && optimisticSuggested.length === 0

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
    <div className="relative z-[2] px-4 pt-4 pb-6 space-y-6">
      {optimisticItems.length > 0 && (
        <section>
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wider px-1 mb-3">
            買う — {optimisticItems.length}件
          </p>
          <div className="space-y-3">
            {optimisticItems.map((item) => (
              <SwipeCard
                key={item.id}
                onSwipeLeft={() => handleSwipeLeft(item)}
                onDragProgress={handleDragProgress}
                // Right swipe (削除) preview only — no onSwipeRight yet
                cardClassName={
                  item.lastReportKind === "out"
                    ? "rounded-2xl border border-rose-200 bg-rose-50 shadow-sm"
                    : "rounded-2xl border border-amber-200 bg-amber-50 shadow-sm"
                }
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
                  <BuyModal
                    itemId={item.id}
                    itemName={item.name}
                    onSuccess={(purchaseId) =>
                      onShowUndo({
                        message: `「${item.name}」の購入を記録しました`,
                        onUndo: async () => {
                          const res = await undoPurchase(purchaseId)
                          if ("error" in res) throw new Error(res.error)
                        },
                        onUndoOptimistic: () => dispatchItems({ type: "addBack", item }),
                      })
                    }
                  />
                </div>
              </SwipeCard>
            ))}
          </div>
        </section>
      )}

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
                  onClick={() => handleAddSuggested(item)}
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
