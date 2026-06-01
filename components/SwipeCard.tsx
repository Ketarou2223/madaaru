"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { SWIPE_THRESHOLD, type SwipeActionConfig } from "@/lib/swipe-config"

export interface SwipeCardProps {
  children: React.ReactNode
  onSwipeLeft?: () => void   // undefined = left swipe disabled (snaps back)
  onSwipeRight?: () => void  // undefined = right swipe disabled (snaps back)
  leftConfig: SwipeActionConfig
  rightConfig: SwipeActionConfig
  /** Override the card wrapper's className (default: white card with stone border) */
  cardClassName?: string
}

export default function SwipeCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftConfig,
  rightConfig,
  cardClassName = "rounded-2xl border border-stone-200 bg-white shadow-sm",
}: SwipeCardProps) {
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

  const handleTouchEnd = useCallback(() => {
    const dx = dragXRef.current
    if (dragDir.current === "h") {
      if (dx < -SWIPE_THRESHOLD && onSwipeLeft) {
        setDismissed("left")
      } else if (dx > SWIPE_THRESHOLD && onSwipeRight) {
        setDismissed("right")
      } else {
        setDragX(0)
      }
    }
    dragXRef.current = 0
    dragDir.current = null
  }, [onSwipeLeft, onSwipeRight])

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

  useEffect(() => {
    if (dismissed === "left") {
      const t = setTimeout(() => onSwipeLeft?.(), 280)
      return () => clearTimeout(t)
    }
    if (dismissed === "right") {
      const t = setTimeout(() => onSwipeRight?.(), 280)
      return () => clearTimeout(t)
    }
  }, [dismissed, onSwipeLeft, onSwipeRight])

  const absDx = Math.abs(dragX)
  const dragProgress = Math.min(absDx / SWIPE_THRESHOLD, 1) // 0→1
  const isPastThreshold = absDx >= SWIPE_THRESHOLD
  const isLeft = dragX < -8
  const isRight = dragX > 8

  // Badge opacity: fades in from 0% drag, reaches 1.0 at threshold
  const badgeOpacity = Math.max(0, (dragProgress - 0.05) / 0.95)
  const badgeScale = isPastThreshold ? 1.08 : 1

  // Background tint opacity: very subtle (max 0.25) to not obscure content
  const tintOpacity = dragProgress * 0.25

  // Card rotation: ±3° at threshold for lifted-card feel
  const rotation = dismissed
    ? 0
    : Math.sign(dragX) * Math.min((absDx / SWIPE_THRESHOLD) * 3, 3)

  const cfg = isLeft ? leftConfig : rightConfig

  return (
    <div
      ref={cardRef}
      className={`relative select-none touch-pan-y ${
        dismissed === "left"
          ? "animate-swipe-out-left"
          : dismissed === "right"
          ? "animate-swipe-out-right"
          : ""
      }`}
      style={
        dismissed
          ? {}
          : {
              transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
              transition: dragX === 0 ? "transform 0.25s ease" : "none",
              willChange: "transform",
            }
      }
    >
      {/* Tinder-style action badge — opposite corner from drag direction */}
      {isLeft && (
        <div
          className="absolute top-3.5 right-4 z-20 pointer-events-none"
          style={{
            opacity: badgeOpacity,
            transform: `rotate(8deg) scale(${badgeScale})`,
            transition: "transform 0.1s ease",
          }}
        >
          <span
            className={`inline-block border-2 rounded-md px-2 py-0.5 text-xs font-bold ${
              isPastThreshold
                ? `${leftConfig.activeBorderClass} ${leftConfig.activeTextClass} ${leftConfig.activeBgClass}`
                : `${leftConfig.borderClass} ${leftConfig.textClass} bg-white/90`
            }`}
          >
            {leftConfig.label}
          </span>
        </div>
      )}
      {isRight && (
        <div
          className="absolute top-3.5 left-4 z-20 pointer-events-none"
          style={{
            opacity: badgeOpacity,
            transform: `rotate(-8deg) scale(${badgeScale})`,
            transition: "transform 0.1s ease",
          }}
        >
          <span
            className={`inline-block border-2 rounded-md px-2 py-0.5 text-xs font-bold ${
              isPastThreshold
                ? `${rightConfig.activeBorderClass} ${rightConfig.activeTextClass} ${rightConfig.activeBgClass}`
                : `${rightConfig.borderClass} ${rightConfig.textClass} bg-white/90`
            }`}
          >
            {rightConfig.label}
          </span>
        </div>
      )}

      {/* Card body — tint overlay inside card, behind content */}
      <div className={`${cardClassName} overflow-hidden relative z-10`}>
        {(isLeft || isRight) && (
          <div
            className={`absolute inset-0 pointer-events-none ${
              isPastThreshold ? cfg.activeBgClass : cfg.bgClass
            }`}
            style={{ opacity: tintOpacity }}
          />
        )}
        <div className="relative px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
