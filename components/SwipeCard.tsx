"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import {
  SWIPE_COMMIT_PX,
  ARM_PX,
  WAIT_FILL,
  WAIT_CARD_X,
  WAIT_CARD_TILT_DEG,
  CONFIRM_HAPTIC_MS,
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
  /** Called each frame during horizontal drag with progress [0,1] and direction, or (0, null) on snap-back/exit.
   *  waiting=true means the card has been released and is in the armed/waiting state. */
  onDragProgress?: (p: number, dir: "left" | "right" | null, waiting?: boolean) => void
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
  const waitingDirRef = useRef<"left" | "right" | null>(null)

  const onDragProgressRef = useRef(onDragProgress)
  useEffect(() => { onDragProgressRef.current = onDragProgress }, [onDragProgress])

  const [dragX, setDragX] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [isSnapping, setIsSnapping] = useState(false)
  const exitDirRef = useRef<"left" | "right" | null>(null)
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── confirm / cancel waiting ──────────────────────────────────────────────

  const confirmWaiting = useCallback(() => {
    const dir = waitingDirRef.current!
    exitingRef.current = true
    exitDirRef.current = dir
    waitingDirRef.current = null
    setIsWaiting(false)
    setIsExiting(true)
    setDragX(dir === "left" ? -1500 : 1500)
    navigator.vibrate?.(CONFIRM_HAPTIC_MS)
    onDragProgressRef.current?.(1, dir, false)
  }, [])

  const cancelWaiting = useCallback(() => {
    waitingDirRef.current = null
    setIsWaiting(false)
    setDragX(0)
    setIsSnapping(true)
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current)
    snapTimerRef.current = setTimeout(() => setIsSnapping(false), 280)
    onDragProgressRef.current?.(0, null)
  }, [])

  // ── document-level capture for waiting state taps ─────────────────────────

  useEffect(() => {
    if (!isWaiting) return

    let tapStartX = 0
    let tapStartY = 0

    function onTouchStart(e: TouchEvent) {
      tapStartX = e.touches[0].clientX
      tapStartY = e.touches[0].clientY
    }

    function onTouchEnd(e: TouchEvent) {
      const endX = e.changedTouches[0].clientX
      const endY = e.changedTouches[0].clientY
      const movedX = Math.abs(endX - tapStartX)
      const movedY = Math.abs(endY - tapStartY)

      if (movedY > 30 || movedX > 40) {
        cancelWaiting()
        return
      }

      const dir = waitingDirRef.current!
      const screenW = window.innerWidth
      const isConfirm =
        dir === "left"
          ? endX < screenW * WAIT_FILL
          : endX > screenW * (1 - WAIT_FILL)

      if (isConfirm) confirmWaiting()
      else cancelWaiting()
    }

    document.addEventListener("touchstart", onTouchStart, { capture: true, passive: true })
    document.addEventListener("touchend", onTouchEnd, { capture: true, passive: true })
    return () => {
      document.removeEventListener("touchstart", onTouchStart, { capture: true })
      document.removeEventListener("touchend", onTouchEnd, { capture: true })
    }
  }, [isWaiting, confirmWaiting, cancelWaiting])

  // ── touch handlers on the card element ───────────────────────────────────

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (exitingRef.current || isWaiting) return
    e.stopPropagation()
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    dragDir.current = null
    dragXRef.current = 0
  }, [isWaiting])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (exitingRef.current || isWaiting) return
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
      // No haptic during drag in OFF mode — fires only on confirm tap
    }
  }, [isWaiting])

  const handleTouchEnd = useCallback(() => {
    if (exitingRef.current || isWaiting) return
    const dx = dragXRef.current
    const wasHorizontal = dragDir.current === "h"
    dragXRef.current = 0
    dragDir.current = null

    if (!wasHorizontal) return

    const dir = dx < 0 ? "left" as const : "right" as const
    const hasHandler = dir === "left" ? !!onSwipeLeft : !!onSwipeRight

    if (Math.abs(dx) >= ARM_PX && hasHandler) {
      // Enter waiting (armed) state
      waitingDirRef.current = dir
      setIsWaiting(true)
      onDragProgressRef.current?.(WAIT_FILL, dir, true)
    } else {
      // Snap back — keep card elevated until animation completes
      setIsSnapping(true)
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current)
      snapTimerRef.current = setTimeout(() => setIsSnapping(false), 280)
      onDragProgressRef.current?.(0, null)
      setDragX(0)
    }
  }, [isWaiting, onSwipeLeft, onSwipeRight])

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

  useEffect(() => () => { if (snapTimerRef.current) clearTimeout(snapTimerRef.current) }, [])

  // ── fly-off callback after exit animation ─────────────────────────────────

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

  // ── visual ────────────────────────────────────────────────────────────────

  let visualX: number
  let rotation: number
  let tintOpacity: number
  let tintColor: string

  if (isWaiting) {
    const wdir = waitingDirRef.current
    visualX = wdir === "left" ? -WAIT_CARD_X : WAIT_CARD_X
    rotation = wdir === "left" ? -WAIT_CARD_TILT_DEG : WAIT_CARD_TILT_DEG
    tintOpacity = 0
    tintColor = "transparent"
  } else {
    const absDx = Math.abs(dragX)
    const dragProgress = Math.min(absDx / SWIPE_COMMIT_PX, 1)
    const isLeft  = dragX < -8
    const isRight = dragX > 8
    tintColor   = isLeft ? ZONE_LEFT_COLOR : ZONE_RIGHT_COLOR
    tintOpacity = dragProgress * CARD_TINT_MAX_OPACITY
    visualX     = dragX * CARD_FOLLOW_FACTOR
    rotation    = Math.sign(dragX) * Math.min(dragProgress * CARD_MAX_TILT_DEG, CARD_MAX_TILT_DEG)
  }

  const transition = isExiting
    ? "transform 0.28s ease-in"
    : isWaiting
    ? "transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)"
    : dragX === 0
    ? "transform 0.25s ease"
    : "none"

  const isCardElevated = dragX !== 0 || isWaiting || isExiting || isSnapping

  return (
    <div ref={cardRef} className={`relative select-none touch-pan-y ${isCardElevated ? "z-[20]" : "z-[0]"}`}>
      <div
        className={`${cardClassName} overflow-hidden relative`}
        style={{
          transform: `translateX(${visualX}px) rotate(${rotation}deg)`,
          transition,
          willChange: "transform",
        }}
      >
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
