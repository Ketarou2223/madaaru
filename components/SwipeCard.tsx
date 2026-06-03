"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import {
  SWIPE_COMMIT_PX,
  SWIPE_HAPTIC_MS,
  ZONE_LEFT_COLOR,
  ZONE_RIGHT_COLOR,
  ZONE_LABEL_COLOR,
  ZONE_RESTING_PX,
  ZONE_MAX_PX,
  ZONE_OPACITY_RESTING,
  ZONE_OPACITY_ACTIVE,
  CARD_TINT_MAX_OPACITY,
  type SwipeActionConfig,
} from "@/lib/swipe-config"

export interface SwipeCardProps {
  children: React.ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
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
  const exitingRef = useRef(false)
  const hasFiredHaptic = useRef(false)

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
      setIsExiting(true)
      setDragX(-1500)
    } else if (dx > SWIPE_COMMIT_PX && onSwipeRight) {
      exitingRef.current = true
      exitDirRef.current = "right"
      setIsExiting(true)
      setDragX(1500)
    } else {
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
    }, 280)
    return () => clearTimeout(t)
  }, [isExiting, onSwipeLeft, onSwipeRight])

  const absDx = Math.abs(dragX)
  const dragProgress = Math.min(absDx / SWIPE_COMMIT_PX, 1) // 0→1
  const isLeft  = dragX < -8
  const isRight = dragX > 8

  // Zone geometry:
  //   Left-action zone  → red,  anchored to card's RIGHT edge, grows leftward on left swipe.
  //   Right-action zone → blue, anchored to card's LEFT edge,  grows rightward on right swipe.
  // Placing each zone on the card's leading visible edge (the edge that stays on-screen
  // as the card is dragged in that direction) keeps the zone visible throughout the gesture.
  const leftZoneWidth = isLeft
    ? ZONE_RESTING_PX + dragProgress * (ZONE_MAX_PX - ZONE_RESTING_PX)
    : ZONE_RESTING_PX

  const rightZoneWidth = isRight
    ? ZONE_RESTING_PX + dragProgress * (ZONE_MAX_PX - ZONE_RESTING_PX)
    : ZONE_RESTING_PX

  // Active zone ramps up; inactive zone fades slightly to keep focus on active side.
  const leftZoneOpacity = isLeft
    ? ZONE_OPACITY_RESTING + dragProgress * (ZONE_OPACITY_ACTIVE - ZONE_OPACITY_RESTING)
    : isRight
    ? ZONE_OPACITY_RESTING * (1 - dragProgress * 0.5)
    : ZONE_OPACITY_RESTING

  const rightZoneOpacity = isRight
    ? ZONE_OPACITY_RESTING + dragProgress * (ZONE_OPACITY_ACTIVE - ZONE_OPACITY_RESTING)
    : isLeft
    ? ZONE_OPACITY_RESTING * (1 - dragProgress * 0.5)
    : ZONE_OPACITY_RESTING

  // Show the label once the zone is wide enough to start revealing text.
  const showLeftLabel  = isLeft  && dragProgress > 0.1
  const showRightLabel = isRight && dragProgress > 0.1

  // Full-card color wash in the swipe direction; deepens toward CARD_TINT_MAX_OPACITY.
  const tintColor   = isLeft ? ZONE_LEFT_COLOR : ZONE_RIGHT_COLOR
  const tintOpacity = dragProgress * CARD_TINT_MAX_OPACITY

  // Subtle card tilt: ±3° at full commit
  const rotation = Math.sign(dragX) * Math.min(dragProgress * 3, 3)

  return (
    <div
      ref={cardRef}
      className="relative select-none touch-pan-y"
      style={{
        transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
        transition: isExiting
          ? "transform 0.28s ease-in"
          : dragX === 0
          ? "transform 0.25s ease"
          : "none",
        willChange: "transform",
      }}
    >
      <div className={`${cardClassName} overflow-hidden relative`}>

        {/* Left-action zone — red strip at card's right edge, grows leftward */}
        <div
          className="absolute top-0 right-0 bottom-0 z-20 flex items-center justify-start overflow-hidden pointer-events-none"
          style={{
            width: leftZoneWidth,
            background: ZONE_LEFT_COLOR,
            opacity: leftZoneOpacity,
          }}
        >
          {showLeftLabel && (
            <span
              className="whitespace-nowrap px-2 text-sm font-bold"
              style={{ color: ZONE_LABEL_COLOR }}
            >
              {leftConfig.label}
            </span>
          )}
        </div>

        {/* Right-action zone — blue strip at card's left edge, grows rightward */}
        <div
          className="absolute top-0 left-0 bottom-0 z-20 flex items-center justify-start overflow-hidden pointer-events-none"
          style={{
            width: rightZoneWidth,
            background: ZONE_RIGHT_COLOR,
            opacity: rightZoneOpacity,
          }}
        >
          {showRightLabel && (
            <span
              className="whitespace-nowrap px-2 text-sm font-bold"
              style={{ color: ZONE_LABEL_COLOR }}
            >
              {rightConfig.label}
            </span>
          )}
        </div>

        {/* Full-card tint — color wash behind zones, in front of content */}
        {tintOpacity > 0 && (
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{ background: tintColor, opacity: tintOpacity }}
          />
        )}

        {/* Card content */}
        <div className="relative z-0 px-5 py-4">
          {children}
        </div>

      </div>
    </div>
  )
}
