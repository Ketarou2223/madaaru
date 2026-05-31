"use client"

import BuyModal from "./BuyModal"
import { PackageIcon, CalendarIcon, LeafIcon, TrendingUpIcon, TargetIcon } from "./icons"
import type { ConfidenceLevel } from "@/lib/prediction"

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

interface StillOkTabProps {
  items: StillOkItem[]
}

export default function StillOkTab({ items }: StillOkTabProps) {
  if (items.length === 0) {
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
    <div className="px-4 pt-4 pb-6">
      <p className="text-xs font-medium text-stone-400 uppercase tracking-wider px-1 mb-3">
        所持品 — {items.length}件
      </p>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-sm"
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
              <ConfidenceBadge level={item.prediction.confidence} />
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
              <BuyModal itemId={item.id} itemName={item.name} />
            </div>

            {item.prediction.nextDepleteDate && (
              <p className="mt-1.5 text-xs text-stone-400">
                {nextDateLabel(item.prediction.nextDepleteDate)} ごろ
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
