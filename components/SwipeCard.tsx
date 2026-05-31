"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { ShoppingCartIcon, CheckIcon } from "./icons"
import type { ConfidenceLevel } from "@/lib/prediction"

interface SwipeCardItem {
  id: string
  name: string
  category: string | null
  prediction: {
    nextDepleteDate: string | null
    daysRemaining: number | null
    confidence: ConfidenceLevel
  }
}

interface SwipeCardProps {
  item: SwipeCardItem
  onSwipeLeft: () => void
  onSwipeRight: () => void
}

const SWIPE_THRESHOLD = 72

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

export default function SwipeCard({ item, onSwipeLeft, onSwipeRight }: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const dragDir = useRef<"h" | "v" | null>(null)
  const dragXRef = useRef(0)

  const [dragX, setDragX] = useState(0)
  const [dismissed, setDismissed] = useState<"left" | "right" | null>(null)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.stopPropagation()
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    dragDir.current = null
    dragXRef.current = 0
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.stopPropagation()
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current

    if (dragDir.current === null) {
      if (Math.abs(dx) > Math.abs(dy) + 4) dragDir.current = "h"
      else if (Math.abs(dy) > Math.abs(dx) + 4) dragDir.current = "v"
      else return
    }

    if (dragDir.current === "h") {
      e.preventDefault()
      dragXRef.current = dx
      setDragX(dx)
    }
  }, [])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    e.stopPropagation()
    const dx = dragXRef.current
    if (dragDir.current === "h") {
      if (dx < -SWIPE_THRESHOLD) {
        setDismissed("left")
      } else if (dx > SWIPE_THRESHOLD) {
        setDismissed("right")
      } else {
        setDragX(0)
      }
    }
    dragXRef.current = 0
    dragDir.current = null
  }, [])

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    el.addEventListener("touchstart", handleTouchStart, { passive: false })
    el.addEventListener("touchmove", handleTouchMove, { passive: false })
    el.addEventListener("touchend", handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchmove", handleTouchMove)
      el.removeEventListener("touchend", handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  // Trigger callback after dismiss animation completes
  useEffect(() => {
    if (dismissed === "left") {
      const t = setTimeout(() => onSwipeLeft(), 280)
      return () => clearTimeout(t)
    }
    if (dismissed === "right") {
      const t = setTimeout(() => onSwipeRight(), 280)
      return () => clearTimeout(t)
    }
  }, [dismissed, onSwipeLeft, onSwipeRight])

  const overlayOpacity = Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1)
  const isLeft = dragX < 0
  const isRight = dragX > 0

  return (
    <div
      ref={cardRef}
      className={`relative select-none touch-pan-y ${dismissed === "left" ? "animate-swipe-out-left" : dismissed === "right" ? "animate-swipe-out-right" : ""}`}
      style={dismissed ? {} : { transform: `translateX(${dragX}px)`, transition: dragX === 0 ? "transform 0.25s ease" : "none" }}
    >
      {/* Directional hint overlays */}
      {isLeft && (
        <div
          className="absolute inset-0 z-10 rounded-2xl flex items-center justify-end pr-6 bg-rose-50"
          style={{ opacity: overlayOpacity }}
        >
          <div className="flex flex-col items-center gap-1 text-rose-500">
            <ShoppingCartIcon size={24} />
            <span className="text-xs font-semibold">買い物リストへ</span>
          </div>
        </div>
      )}
      {isRight && (
        <div
          className="absolute inset-0 z-10 rounded-2xl flex items-center justify-start pl-6 bg-teal-50"
          style={{ opacity: overlayOpacity }}
        >
          <div className="flex flex-col items-center gap-1 text-teal-600">
            <CheckIcon size={24} />
            <span className="text-xs font-semibold">まだ大丈夫</span>
          </div>
        </div>
      )}

      {/* Card content */}
      <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
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

        {/* Swipe hint */}
        <div className="mt-4 flex items-center justify-between text-xs text-stone-300 select-none">
          <span className="flex items-center gap-1">
            <ShoppingCartIcon size={12} />
            ← 買う
          </span>
          <span className="flex items-center gap-1">
            まだある →
            <CheckIcon size={12} />
          </span>
        </div>
      </div>
    </div>
  )
}
