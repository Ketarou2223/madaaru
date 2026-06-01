"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import HomeTab from "./HomeTab"
import ShoppingTab from "./ShoppingTab"
import StillOkTab from "./StillOkTab"
import AddItemModal from "./AddItemModal"
import UndoToast from "./UndoToast"
import type { UndoConfig } from "./UndoToast"
import { ShoppingCartIcon, LayersIcon, PackageIcon, LogOutIcon } from "./icons"
import { signOutAction } from "@/app/actions"
import type { HomeItem } from "./HomeTab"
import type { ShoppingItem, SuggestedItem } from "./ShoppingTab"
import type { StillOkItem } from "./StillOkTab"

interface TabShellProps {
  homeItems: HomeItem[]
  shoppingItems: ShoppingItem[]
  suggestedItems: SuggestedItem[]
  stillOkItems: StillOkItem[]
  userImageUrl?: string | null
}

// Infinite loop via 5 physical slots:
//   idx: 0=stillok_clone  1=shopping  2=home  3=stillok  4=shopping_clone
// Start at idx=2 (home). After animating to clone 0 → jump to 3. Clone 4 → jump to 1.
type LogicalTab = "shopping" | "home" | "stillok"

const PHYSICAL_LOGICAL: readonly LogicalTab[] = ["stillok", "shopping", "home", "stillok", "shopping"]
const CANONICAL_IDX: Record<LogicalTab, number> = { shopping: 1, home: 2, stillok: 3 }

const TAB_DEFS = [
  { id: "shopping" as const, label: "買い物リスト", Icon: ShoppingCartIcon },
  { id: "home" as const, label: "まだある？", Icon: LayersIcon },
  { id: "stillok" as const, label: "まだ大丈夫", Icon: PackageIcon },
]

const SWIPE_THRESHOLD = 50
const TAB_BAR_H = 56 // h-14 in pixels — used for touch zone detection

// Per-slot tab bar. Defined at module level to keep a stable reference across renders.
function SlotTabBar({
  slotLogical,
  shoppingBadge,
  homeItemCount,
  onNavigate,
}: {
  slotLogical: LogicalTab
  shoppingBadge: number
  homeItemCount: number
  onNavigate: (tab: LogicalTab) => void
}) {
  return (
    // solid bg-white (no backdrop-blur) — element lives inside the transform strip,
    // which breaks backdrop-filter in WebKit.
    <div
      className="shrink-0 bg-white border-t border-stone-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-14">
        {TAB_DEFS.map((tab) => {
          const isActive = slotLogical === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? "text-teal-700" : "text-stone-400"
              }`}
            >
              <div className="relative">
                <tab.Icon size={20} />
                {tab.id === "shopping" && shoppingBadge > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                    {shoppingBadge > 9 ? "9+" : shoppingBadge}
                  </span>
                )}
                {tab.id === "home" && homeItemCount > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white">
                    {homeItemCount > 9 ? "9+" : homeItemCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && (
                <span className="absolute top-0 left-4 right-4 h-0.5 rounded-full bg-teal-600" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function TabShell({
  homeItems,
  shoppingItems,
  suggestedItems,
  stillOkItems,
}: TabShellProps) {
  const [physicalIdx, setPhysicalIdx] = useState(2)
  const [dragOffset, setDragOffset] = useState(0)
  const [isJumping, setIsJumping] = useState(false)
  const [undoConfig, setUndoConfig] = useState<UndoConfig | null>(null)

  // physicalIdxRef is updated synchronously in goToPhysical (before React commit) so that
  // back-to-back touch handlers always read the latest intended index. This prevents the
  // rapid-swipe out-of-bounds white-screen bug (physicalIdx > 4 or < 0).
  const physicalIdxRef = useRef(2)

  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // outerRef — the flex-1 overflow-hidden container that holds the entire strip (panels + tab bars).
  // Tab-switch touch listeners live here. The Y-coordinate check separates tab-bar-zone touches
  // from panel-area touches. SwipeCard's native stopPropagation additionally blocks card events
  // from reaching these listeners.
  const outerRef = useRef<HTMLDivElement>(null)

  // Tab bar swipe tracking (all refs — no re-renders during drag)
  const tbStartX = useRef(0)
  const tbStartY = useRef(0)
  const tbDragDir = useRef<"h" | "v" | null>(null)
  const tbDragOffRef = useRef(0)
  const tbDragging = useRef(false)
  const isTabBarZone = useRef(false)

  // Single helper for all physical index changes.
  // Clamps to [0,4] and updates the ref synchronously so rapid consecutive swipes
  // always compute from the latest intended index, never producing an out-of-range value.
  const goToPhysical = useCallback((n: number) => {
    const clamped = Math.max(0, Math.min(4, n))
    physicalIdxRef.current = clamped
    setPhysicalIdx(clamped)
  }, [])

  const navigateToTab = useCallback((tab: LogicalTab) => {
    goToPhysical(CANONICAL_IDX[tab])
    setDragOffset(0)
  }, [goToPhysical])

  function showUndo(config: UndoConfig) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoConfig(config)
    undoTimerRef.current = setTimeout(() => {
      setUndoConfig(null)
      undoTimerRef.current = null
    }, 5000)
  }

  function dismissUndo() {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = null
    setUndoConfig(null)
  }

  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current) }, [])

  // After transition lands on a clone slot, jump to the real slot with no animation
  function handleStripTransitionEnd(e: React.TransitionEvent) {
    if (e.propertyName !== "transform") return
    const cur = physicalIdxRef.current
    if (cur === 0 || cur === 4) {
      setIsJumping(true)
      goToPhysical(cur === 0 ? 3 : 1)
    }
  }

  // Re-enable transition after the jump render has painted (double RAF guarantees paint)
  useEffect(() => {
    if (!isJumping) return
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setIsJumping(false)))
    return () => cancelAnimationFrame(raf)
  }, [isJumping])

  // --- Touch handlers on outerRef (the strip's parent container) ---
  //
  // Touch separation:
  //   tab-bar zone (Y >= window.innerHeight - 56) → tab switch (these handlers)
  //   panel zone (Y < threshold) → ignored here; SwipeCard handles card gestures internally
  //   vertical anywhere → native browser scroll on overflow-y-auto panels
  //
  // SwipeCard uses native stopPropagation on touchstart/touchmove, so card touches
  // never reach these listeners. The Y-check provides a second line of defense.

  const handleTabTouchStart = useCallback((e: TouchEvent) => {
    const touchY = e.touches[0].clientY
    if (touchY < window.innerHeight - TAB_BAR_H) {
      isTabBarZone.current = false
      return
    }
    isTabBarZone.current = true
    tbStartX.current = e.touches[0].clientX
    tbStartY.current = e.touches[0].clientY
    tbDragDir.current = null
    tbDragOffRef.current = 0
    tbDragging.current = false
  }, [])

  const handleTabTouchMove = useCallback((e: TouchEvent) => {
    if (!isTabBarZone.current) return
    const dx = e.touches[0].clientX - tbStartX.current
    const dy = e.touches[0].clientY - tbStartY.current

    if (tbDragDir.current === null) {
      if (Math.abs(dx) > Math.abs(dy) + 6) {
        tbDragDir.current = "h"
        tbDragging.current = true
      } else if (Math.abs(dy) > Math.abs(dx) + 6) {
        tbDragDir.current = "v"
        return
      } else {
        return
      }
    }

    if (tbDragDir.current === "h") {
      e.preventDefault() // suppresses the click event on swipe (tap still fires click)
      tbDragOffRef.current = dx
      setDragOffset(dx)
    }
  }, [])

  const handleTabTouchEnd = useCallback(() => {
    if (!isTabBarZone.current) return
    if (tbDragDir.current === "h" && tbDragging.current) {
      const dx = tbDragOffRef.current
      const cur = physicalIdxRef.current
      if (dx < -SWIPE_THRESHOLD) {
        goToPhysical(cur + 1)
      } else if (dx > SWIPE_THRESHOLD) {
        goToPhysical(cur - 1)
      }
    }
    setDragOffset(0)
    tbDragOffRef.current = 0
    tbDragging.current = false
    tbDragDir.current = null
    isTabBarZone.current = false
  }, [goToPhysical])

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    el.addEventListener("touchstart", handleTabTouchStart, { passive: true })
    el.addEventListener("touchmove", handleTabTouchMove, { passive: false })
    el.addEventListener("touchend", handleTabTouchEnd, { passive: true })
    return () => {
      el.removeEventListener("touchstart", handleTabTouchStart)
      el.removeEventListener("touchmove", handleTabTouchMove)
      el.removeEventListener("touchend", handleTabTouchEnd)
    }
  }, [handleTabTouchStart, handleTabTouchMove, handleTabTouchEnd])

  const shoppingBadge = shoppingItems.length + suggestedItems.length

  // Disable transition while jumping (hides clone seam) or while dragging (finger 1:1)
  const stripTransition =
    isJumping || tbDragging.current
      ? "none"
      : "transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)"

  const tabBarProps = {
    shoppingBadge,
    homeItemCount: homeItems.length,
    onNavigate: navigateToTab,
  }

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      {/* Header — outside the transform strip, so backdrop-blur works correctly */}
      <header
        className="shrink-0 bg-white/95 backdrop-blur border-b border-stone-200 px-5 py-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-teal-700 tracking-tight">まだある？</h1>
          <form action={signOutAction}>
            <button className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors py-1">
              <LogOutIcon size={14} />
              ログアウト
            </button>
          </form>
        </div>
      </header>

      {/* Unified strip: panels + tab bars move as one track.
          Tab-switch touch listeners are on outerRef; Y-coordinate determines tab-bar zone. */}
      <div ref={outerRef} className="flex-1 overflow-hidden">
        <div
          className="flex h-full"
          style={{
            width: "500%",
            transform: `translateX(calc(-${physicalIdx * 20}% + ${dragOffset}px))`,
            transition: stripTransition,
            willChange: "transform",
          }}
          onTransitionEnd={handleStripTransitionEnd}
        >
          {/* Physical 0: stillok_clone */}
          <div className="flex flex-col h-full" style={{ width: "20%" }}>
            <div className="flex-1 overflow-y-auto">
              <StillOkTab items={stillOkItems} onShowUndo={showUndo} />
            </div>
            <SlotTabBar slotLogical="stillok" {...tabBarProps} />
          </div>

          {/* Physical 1: shopping */}
          <div className="flex flex-col h-full" style={{ width: "20%" }}>
            <div className="flex-1 overflow-y-auto">
              <ShoppingTab items={shoppingItems} suggested={suggestedItems} onShowUndo={showUndo} />
            </div>
            <SlotTabBar slotLogical="shopping" {...tabBarProps} />
          </div>

          {/* Physical 2: home (start here) */}
          <div className="flex flex-col h-full" style={{ width: "20%" }}>
            <div className="flex-1 overflow-y-auto">
              <HomeTab items={homeItems} onShowUndo={showUndo} />
            </div>
            <SlotTabBar slotLogical="home" {...tabBarProps} />
          </div>

          {/* Physical 3: stillok */}
          <div className="flex flex-col h-full" style={{ width: "20%" }}>
            <div className="flex-1 overflow-y-auto">
              <StillOkTab items={stillOkItems} onShowUndo={showUndo} />
            </div>
            <SlotTabBar slotLogical="stillok" {...tabBarProps} />
          </div>

          {/* Physical 4: shopping_clone */}
          <div className="flex flex-col h-full" style={{ width: "20%" }}>
            <div className="flex-1 overflow-y-auto">
              <ShoppingTab items={shoppingItems} suggested={suggestedItems} onShowUndo={showUndo} />
            </div>
            <SlotTabBar slotLogical="shopping" {...tabBarProps} />
          </div>
        </div>
      </div>

      {/* FAB positioned above bottom tab bar — fixed calc unchanged (tab bar still h-14) */}
      <AddItemModal />

      {undoConfig && (
        <UndoToast
          {...undoConfig}
          onDismiss={dismissUndo}
          onUndoError={(msg) => showUndo({ message: msg })}
        />
      )}
    </div>
  )
}
