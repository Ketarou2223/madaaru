"use client"

import { useState, useOptimistic, startTransition } from "react"
import { createPortal } from "react-dom"
import SwipeCard from "./SwipeCard"
import BuyModal from "./BuyModal"
import {
  PackageIcon, CalendarIcon, LeafIcon, TrendingUpIcon,
  TargetIcon, TrashIcon, ShoppingCartIcon,
} from "./icons"
import type { ConfidenceLevel } from "@/lib/prediction"
import type { UndoConfig } from "./UndoToast"
import { deleteItem, undoPurchase, undoReport, recordReport } from "@/app/actions"
import { SWIPE_ACTIONS } from "@/lib/swipe-config"

export interface StillOkItem {
  id: string
  name: string
  category: string | null
  prediction: {
    nextDepleteDate: string | null
    daysRemaining: number | null
    confidence: ConfidenceLevel
  }
  lastStockLevel: "plenty" | "normal" | "low" | null
  lastReportId: string | null   // ID of the still report; null for prediction-only items
}

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const map: Record<ConfidenceLevel, { label: string; cls: string; icon: React.ReactNode }> = {
    学習中: {
      label: "学習中",
      cls: "text-stone-400 bg-stone-100",
      icon: <LeafIcon size={11} />,
    },
    そこそこ: {
      label: "そこそこ",
      cls: "text-teal-600 bg-teal-50",
      icon: <TrendingUpIcon size={11} />,
    },
    高め: {
      label: "精度 高め",
      cls: "text-teal-700 bg-teal-100",
      icon: <TargetIcon size={11} />,
    },
  }
  const { label, cls, icon } = map[level]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {icon}
      {label}
    </span>
  )
}

function daysLabel(days: number | null): string {
  if (days === null) return "—"
  if (days < 0) return `${Math.abs(days)}日 超過`
  if (days === 0) return "今日切れそう"
  if (days === 1) return "明日"
  return `約 ${days}日後`
}

function nextDateLabel(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${m}月${day}日ごろ`
}

function stockLevelDot(level: "plenty" | "normal" | "low" | null) {
  if (!level) return null
  const map = { plenty: "bg-teal-400", normal: "bg-stone-300", low: "bg-amber-400" }
  const title = { plenty: "たくさんある", normal: "ふつう", low: "きれそう" }
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${map[level]}`}
      title={title[level]}
    />
  )
}

// Left = そろそろ (amber), Right = 買い物リストへ (amber)
const LEFT_CFG = SWIPE_ACTIONS.sorosoro
const RIGHT_CFG = SWIPE_ACTIONS.toBuyList

interface StillOkTabProps {
  items: StillOkItem[]
  onShowUndo: (config: UndoConfig) => void
}

export default function StillOkTab({ items, onShowUndo }: StillOkTabProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  type StillOkAction = { type: "remove"; id: string } | { type: "addBack"; item: StillOkItem }

  const [optimisticItems, dispatchOptimistic] = useOptimistic(
    items,
    (state: StillOkItem[], action: StillOkAction) => {
      if (action.type === "remove") return state.filter((i) => i.id !== action.id)
      return state.some((i) => i.id === action.item.id) ? state : [...state, action.item]
    }
  )

  function handleDeleteConfirm() {
    if (!deleteConfirmId) return
    const id = deleteConfirmId
    setDeleteConfirmId(null)
    startTransition(async () => {
      dispatchOptimistic({ type: "remove", id })
      await deleteItem(id)
    })
  }

  // Left swipe: "そろそろ（まだある？へ）"
  // Undoes the 'still' report so the item falls back to prediction-based classification.
  // Only available for items that have a still report (lastReportId !== null).
  function handleSwipeLeft(item: StillOkItem) {
    if (!item.lastReportId) return
    const reportId = item.lastReportId
    startTransition(async () => {
      dispatchOptimistic({ type: "remove", id: item.id })
      const result = await undoReport(reportId)
      if ("success" in result) {
        onShowUndo({
          message: `「${item.name}」をまだある？へ移動`,
          onUndo: async () => {
            const res = await recordReport(item.id, "still", item.lastStockLevel ?? undefined)
            if ("error" in res) throw new Error(res.error)
          },
          onUndoOptimistic: () => dispatchOptimistic({ type: "addBack", item }),
        })
      }
    })
  }

  // Right swipe: "買い物リストへ"
  function handleSwipeRight(item: StillOkItem) {
    startTransition(async () => {
      dispatchOptimistic({ type: "remove", id: item.id })
      const result = await recordReport(item.id, "soon")
      if ("id" in result) {
        onShowUndo({
          message: `「${item.name}」を買い物リストへ移動`,
          onUndo: async () => {
            const res = await undoReport(result.id)
            if ("error" in res) throw new Error(res.error)
          },
          onUndoOptimistic: () => dispatchOptimistic({ type: "addBack", item }),
        })
      }
    })
  }

  const confirmItem = deleteConfirmId
    ? items.find((i) => i.id === deleteConfirmId)
    : null

  if (optimisticItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
          <PackageIcon size={28} className="text-teal-400" />
        </div>
        <div>
          <p className="font-semibold text-stone-700">所持品がありません</p>
          <p className="mt-1 text-sm text-stone-400">右スワイプで品目を「まだ大丈夫」に移動できます</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="px-4 pt-4 pb-6">
        <p className="text-xs font-medium text-stone-400 uppercase tracking-wider px-1 mb-3">
          所持品 — {optimisticItems.length}件
        </p>
        <div className="space-y-3">
          {optimisticItems.map((item) => (
            <SwipeCard
              key={item.id}
              leftConfig={LEFT_CFG}
              rightConfig={RIGHT_CFG}
              onSwipeLeft={item.lastReportId ? () => handleSwipeLeft(item) : undefined}
              onSwipeRight={() => handleSwipeRight(item)}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    {item.category && (
                      <p className="text-xs text-stone-400">{item.category}</p>
                    )}
                    {stockLevelDot(item.lastStockLevel)}
                  </div>
                  <h2 className="text-base font-semibold text-stone-900 truncate">{item.name}</h2>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <ConfidenceBadge level={item.prediction.confidence} />
                  <button
                    onClick={() => setDeleteConfirmId(item.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-stone-300 hover:text-rose-400 hover:bg-rose-50 transition-colors"
                    aria-label="削除"
                  >
                    <TrashIcon size={13} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-stone-500 text-sm">
                  <CalendarIcon size={14} className="text-stone-400" />
                  <span>
                    {item.prediction.daysRemaining !== null
                      ? `${daysLabel(item.prediction.daysRemaining)}に切れそう`
                      : "切れ時期を学習中"}
                  </span>
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
                      onUndoOptimistic: () => dispatchOptimistic({ type: "addBack", item }),
                    })
                  }
                />
              </div>

              {item.prediction.nextDepleteDate && (
                <p className="mt-1.5 text-xs text-stone-400">
                  {nextDateLabel(item.prediction.nextDepleteDate)} ごろ
                </p>
              )}

              {/* Swipe hint */}
              <div className="mt-3 flex items-center justify-between text-xs text-stone-300 select-none">
                {item.lastReportId ? (
                  <span className="flex items-center gap-1">
                    ← {LEFT_CFG.hintLeft.replace("← ", "")}
                  </span>
                ) : (
                  <span />
                )}
                <span className="flex items-center gap-1">
                  <ShoppingCartIcon size={12} />
                  {RIGHT_CFG.label} →
                </span>
              </div>
            </SwipeCard>
          ))}
        </div>
      </div>

      {confirmItem && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
          onClick={(e) => e.target === e.currentTarget && setDeleteConfirmId(null)}
        >
          <div className="w-full max-w-sm bg-white rounded-3xl px-6 py-6 shadow-2xl">
            <h3 className="text-base font-semibold text-stone-900 mb-1">
              「{confirmItem.name}」を削除しますか？
            </h3>
            <p className="text-sm text-stone-500 mb-6">
              購入履歴や報告もすべて削除されます。この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 rounded-2xl border border-stone-200 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 rounded-2xl bg-rose-500 py-3 text-sm font-semibold text-white hover:bg-rose-600 transition-all active:scale-[0.98]"
              >
                削除する
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
