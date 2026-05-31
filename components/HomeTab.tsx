"use client"

import { useState, useOptimistic, startTransition } from "react"
import SwipeCard from "./SwipeCard"
import StockLevelPopup from "./StockLevelPopup"
import { recordReport } from "@/app/actions"
import type { StockLevel } from "@/lib/db/schema"
import type { ConfidenceLevel } from "@/lib/prediction"
import { LayersIcon } from "./icons"

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
}

export default function HomeTab({ items }: HomeTabProps) {
  const [popupItemId, setPopupItemId] = useState<string | null>(null)

  const [optimisticItems, removeItem] = useOptimistic(
    items,
    (state: HomeItem[], id: string) => state.filter((i) => i.id !== id)
  )

  const popupItem = popupItemId ? items.find((i) => i.id === popupItemId) : null

  function handleSwipeLeft(itemId: string) {
    startTransition(async () => {
      removeItem(itemId)
      await recordReport(itemId, "soon")
    })
  }

  function handleRightSwipe(itemId: string) {
    setPopupItemId(itemId)
  }

  function handleStockLevelSelect(stockLevel: StockLevel) {
    if (!popupItemId) return
    const id = popupItemId
    setPopupItemId(null)
    startTransition(async () => {
      removeItem(id)
      await recordReport(id, "still", stockLevel)
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
      <div className="px-4 pt-4 pb-6 space-y-3">
        <p className="text-xs font-medium text-stone-400 uppercase tracking-wider px-1">
          そろそろ切れそう — {optimisticItems.length}件
        </p>
        {optimisticItems.map((item) => (
          <SwipeCard
            key={item.id}
            item={item}
            onSwipeLeft={() => handleSwipeLeft(item.id)}
            onSwipeRight={() => handleRightSwipe(item.id)}
          />
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
