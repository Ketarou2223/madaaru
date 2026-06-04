"use client"

import { useState, useOptimistic, startTransition, useCallback } from "react"
import SwipeCard from "./SwipeCard"
import StockLevelPopup from "./StockLevelPopup"
import { recordReport, undoReport } from "@/app/actions"
import type { StockLevel } from "@/lib/db/schema"
import type { ConfidenceLevel } from "@/lib/prediction"
import type { UndoConfig } from "./UndoToast"
import { SWIPE_ACTIONS } from "@/lib/swipe-config"

export interface HomeItem {
  id: string
  name: string
  category: string | null
  prediction: {
    nextDepleteDate: string | null
    daysRemaining: number | null
    confidence: ConfidenceLevel
  }
}

interface HomeTabProps {
  items: HomeItem[]
  onShowUndo: (config: UndoConfig) => void
  onCardDragProgress: (p: number, dir: "left" | "right" | null, label: string, waiting?: boolean) => void
}

function daysLabel(days: number | null) {
  if (days === null) return "学習中"
  if (days < 0) return `${Math.abs(days)}日 超過`
  if (days === 0) return "今日切れそう"
  if (days === 1) return "明日切れそう"
  return `残り約 ${days}日`
}

function urgencyColor(days: number | null): string {
  if (days === null) return "text-stone-400"
  if (days <= 0) return "text-rose-600"
  if (days <= 3) return "text-rose-500"
  return "text-amber-600"
}

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const styles: Record<ConfidenceLevel, { cls: string; label: string }> = {
    学習中: { cls: "text-stone-400 bg-stone-100", label: "学習中" },
    そこそこ: { cls: "text-teal-600 bg-teal-50", label: "そこそこ" },
    高め: { cls: "text-teal-700 bg-teal-100", label: "精度 高め" },
  }
  const { cls, label } = styles[level]
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

// Left = 買い物リストへ, Right = まだ大丈夫
const LEFT_CFG = SWIPE_ACTIONS.toBuyList
const RIGHT_CFG = SWIPE_ACTIONS.toStillOk

import { LayersIcon } from "./icons"

export default function HomeTab({ items, onShowUndo, onCardDragProgress }: HomeTabProps) {
  const [popupItemId, setPopupItemId] = useState<string | null>(null)

  type HomeAction = { type: "remove"; id: string } | { type: "addBack"; item: HomeItem }

  const [optimisticItems, dispatchOptimistic] = useOptimistic(
    items,
    (state: HomeItem[], action: HomeAction) => {
      if (action.type === "remove") return state.filter((i) => i.id !== action.id)
      return state.some((i) => i.id === action.item.id) ? state : [...state, action.item]
    }
  )

  const popupItem = popupItemId ? items.find((i) => i.id === popupItemId) : null

  const handleDragProgress = useCallback((p: number, dir: "left" | "right" | null, waiting?: boolean) => {
    onCardDragProgress(
      p,
      dir,
      dir === "left" ? LEFT_CFG.label : dir === "right" ? RIGHT_CFG.label : "",
      waiting
    )
  }, [onCardDragProgress])

  function handleSwipeLeft(itemId: string) {
    const originalItem = items.find((i) => i.id === itemId)
    if (!originalItem) return
    startTransition(async () => {
      dispatchOptimistic({ type: "remove", id: itemId })
      const result = await recordReport(itemId, "soon")
      if ("id" in result) {
        onShowUndo({
          message: `「${originalItem.name}」を買い物リストへ移動`,
          onUndo: async () => {
            const res = await undoReport(result.id)
            if ("error" in res) throw new Error(res.error)
          },
          onUndoOptimistic: () => dispatchOptimistic({ type: "addBack", item: originalItem }),
        })
      }
    })
  }

  function handleRightSwipe(itemId: string) {
    setPopupItemId(itemId)
  }

  function handleStockLevelSelect(stockLevel: StockLevel) {
    if (!popupItemId) return
    const id = popupItemId
    const originalItem = items.find((i) => i.id === id)
    setPopupItemId(null)
    if (!originalItem) return
    startTransition(async () => {
      dispatchOptimistic({ type: "remove", id })
      const result = await recordReport(id, "still", stockLevel)
      if ("id" in result) {
        onShowUndo({
          message: `「${originalItem.name}」をまだ大丈夫へ移動`,
          onUndo: async () => {
            const res = await undoReport(result.id)
            if ("error" in res) throw new Error(res.error)
          },
          onUndoOptimistic: () => dispatchOptimistic({ type: "addBack", item: originalItem }),
        })
      }
    })
  }

  if (optimisticItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
          <LayersIcon size={28} className="text-teal-500" />
        </div>
        <div>
          <p className="font-semibold text-stone-700">今は切れそうなものはありません</p>
          <p className="mt-1 text-sm text-stone-400">そろそろ減ってきたら自動でここに表示されます</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="relative z-[2] px-4 pt-4 pb-6 space-y-3">
        <p className="text-xs font-medium text-stone-400 uppercase tracking-wider px-1">
          そろそろ切れそう — {optimisticItems.length}件
        </p>
        {optimisticItems.map((item) => (
          <SwipeCard
            key={item.id}
            onSwipeLeft={() => handleSwipeLeft(item.id)}
            onSwipeRight={() => handleRightSwipe(item.id)}
            onDragProgress={handleDragProgress}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                {item.category && (
                  <p className="text-xs text-stone-400 mb-0.5">{item.category}</p>
                )}
                <h2 className="text-lg font-semibold text-stone-900 truncate">{item.name}</h2>
              </div>
              <ConfidenceBadge level={item.prediction.confidence} />
            </div>
            <p className={`text-base font-semibold ${urgencyColor(item.prediction.daysRemaining)}`}>
              {daysLabel(item.prediction.daysRemaining)}
            </p>
          </SwipeCard>
        ))}
      </div>

      {popupItem && (
        <StockLevelPopup
          itemName={popupItem.name}
          onSelect={handleStockLevelSelect}
          onCancel={() => setPopupItemId(null)}
        />
      )}
    </>
  )
}
