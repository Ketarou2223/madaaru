"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import {
  SWIPE_COMMIT_PX,
  SWIPE_HAPTIC_MS,
  CARD_FOLLOW_FACTOR,
  CARD_MAX_TILT_DEG,
  ZONE_LEFT_COLOR,
  ZONE_RIGHT_COLOR,
  CARD_TINT_MAX_OPACITY,
} from "@/lib/swipe-config"

export interface SwipeCardProps {
  children: React.ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  /** Called each frame during horizontal drag with progress [0,1] and direction, or (0, null) on snap-back/exit. */
  onDragProgress?: (p: number, dir: "left" | "right" | null) => void
  /** Override the card wrapper's className (default: white card with stone border) */
  cardClassName?: string
}

export default function SwipeCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  onDragProgress,
  cardClassName = "rounded-2xl border border-stone-200 bg-white shadow-sm",
}: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const dragDir = useRef<"h" | "v" | null>(null)
  const dragXRef = useRef(0)
  const exitingRef = useRef(false)
  const hasFiredHaptic = useRef(false)

  // Use a ref so the stable touch handlers always call the latest callback without re-registering.
  const onDragProgressRef = useRef(onDragProgress)
  useEffect(() => { onDragProgressRef.current = onDragProgress }, [onDragProgress])

  const [dragX, setDragX] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const exitDirRef = useRef<"left" | "right" | null>(null)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (exitingRef.current) return
    e.stopPropagation()
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    dragDir.current = null
    dragXRef.current = 0
    hasFiredHaptic.current = false
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (exitingRef.current) return
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
      const p = Math.min(Math.abs(dx) / SWIPE_COMMIT_PX, 1)
      const dir = dx < 0 ? "left" as const : "right" as const
      onDragProgressRef.current?.(p, dir)
      if (Math.abs(dx) >= SWIPE_COMMIT_PX && !hasFiredHaptic.current) {
        navigator.vibrate?.(SWIPE_HAPTIC_MS)
        hasFiredHaptic.current = true
      }
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (exitingRef.current) return
    const dx = dragXRef.current
    const wasHorizontal = dragDir.current === "h"
    dragXRef.current = 0
    dragDir.current = null
    hasFiredHaptic.current = false

    if (!wasHorizontal) return

    if (dx < -SWIPE_COMMIT_PX && onSwipeLeft) {
      exitingRef.current = true
      exitDirRef.current = "left"
      onDragProgressRef.current?.(1, "left")  // lock zone at full during fly-off
      setIsExiting(true)
      setDragX(-1500)
    } else if (dx > SWIPE_COMMIT_PX && onSwipeRight) {
      exitingRef.current = true
      exitDirRef.current = "right"
      onDragProgressRef.current?.(1, "right")
      setIsExiting(true)
      setDragX(1500)
    } else {
      onDragProgressRef.current?.(0, null)
      setDragX(0)
    }
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
    if (!isExiting) return
    const dir = exitDirRef.current
    const t = setTimeout(() => {
      if (dir === "left") onSwipeLeft?.()
      else onSwipeRight?.()
      onDragProgressRef.current?.(0, null)
    }, 280)
    return () => clearTimeout(t)
  }, [isExiting, onSwipeLeft, onSwipeRight])

  const absDx = Math.abs(dragX)
  const dragProgress = Math.min(absDx / SWIPE_COMMIT_PX, 1)
  const isLeft  = dragX < -8
  const isRight = dragX > 8

  // Full-card tint in the swipe direction; deepens toward CARD_TINT_MAX_OPACITY at commit.
  const tintColor   = isLeft ? ZONE_LEFT_COLOR : ZONE_RIGHT_COLOR
  const tintOpacity = dragProgress * CARD_TINT_MAX_OPACITY

  // Card moves at CARD_FOLLOW_FACTOR of the raw drag distance.
  const visualX  = dragX * CARD_FOLLOW_FACTOR
  const rotation = Math.sign(dragX) * Math.min(dragProgress * CARD_MAX_TILT_DEG, CARD_MAX_TILT_DEG)

  return (
    // z-10 ensures cards stack above the fixed background zones (z-1) in TabShell.
    <div ref={cardRef} className="relative z-10 select-none touch-pan-y">
      <div
        className={`${cardClassName} overflow-hidden relative`}
        style={{
          transform: `translateX(${visualX}px) rotate(${rotation}deg)`,
          transition: isExiting
            ? "transform 0.28s ease-in"
            : dragX === 0
            ? "transform 0.25s ease"
            : "none",
          willChange: "transform",
        }}
      >
        {/* Full-card color wash in the swipe direction */}
        {tintOpacity > 0 && (
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{ background: tintColor, opacity: tintOpacity }}
          />
        )}

        <div className="relative z-0 px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
