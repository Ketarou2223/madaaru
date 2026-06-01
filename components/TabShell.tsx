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

// Physical slots: [stillok_clone | shopping | home | stillok | shopping_clone]
// Start at physicalIdx=2 (home). Clones at 0/4 jump to 3/1 after transition.
type LogicalTab = "shopping" | "home" | "stillok"

const PHYSICAL_LOGICAL: readonly LogicalTab[] = ["stillok", "shopping", "home", "stillok", "shopping"]
const CANONICAL_IDX: Record<LogicalTab, number> = { shopping: 1, home: 2, stillok: 3 }

const TAB_DEFS = [
  { id: "shopping" as const, label: "買い物リスト", Icon: ShoppingCartIcon },
  { id: "home" as const, label: "まだある？", Icon: LayersIcon },
  { id: "stillok" as const, label: "まだ大丈夫", Icon: PackageIcon },
]

const SWIPE_THRESHOLD = 50

// Each tab item occupies 1/3 of the viewport width.
// 5 items total → strip is 5/3 ≈ 166.67vw wide.
// translateX = (1 − physicalIdx) × ITEM_VW vw + dragOffset/3 px
//   → item at physicalIdx lands at [ITEM_VW, 2×ITEM_VW) vw = center third of screen.
// Panels move at full speed (100vw/slot); tab items at 1/3 speed (33.33vw/slot).
const ITEM_VW = 100 / 3

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

  // Synchronously updated before setState so rapid-swipe handlers always read latest idx.
  const physicalIdxRef = useRef(2)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // tabBarRef: touch listeners for tab-switching attach here directly.
  // Since the element IS the tab bar, no Y-coordinate check is needed.
  const tabBarRef = useRef<HTMLDivElement>(null)

  const tbStartX = useRef(0)
  const tbStartY = useRef(0)
  const tbDragDir = useRef<"h" | "v" | null>(null)
  const tbDragOffRef = useRef(0)
  const tbDragging = useRef(false)

  // Only route through this helper — it clamps [0,4] and syncs ref before setState.
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

  // When a panel transition lands on a clone slot, jump instantaneously to the real slot.
  // Tab item strip follows automatically because both use physicalIdx state.
  function handlePanelTransitionEnd(e: React.TransitionEvent) {
    if (e.propertyName !== "transform") return
    const cur = physicalIdxRef.current
    if (cur === 0 || cur === 4) {
      setIsJumping(true)
      goToPhysical(cur === 0 ? 3 : 1)
    }
  }

  // Re-enable transition after jump paint (double RAF guarantees the frame committed).
  useEffect(() => {
    if (!isJumping) return
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setIsJumping(false)))
    return () => cancelAnimationFrame(raf)
  }, [isJumping])

  // --- Tab bar touch handlers (attached to tabBarRef, not the panel area) ---
  // Horizontal drag → tab switch. Vertical → ignored (nothing to scroll in tab bar).
  // SwipeCard's native stopPropagation keeps card touches in the panel area.

  const handleTabTouchStart = useCallback((e: TouchEvent) => {
    tbStartX.current = e.touches[0].clientX
    tbStartY.current = e.touches[0].clientY
    tbDragDir.current = null
    tbDragOffRef.current = 0
    tbDragging.current = false
  }, [])

  const handleTabTouchMove = useCallback((e: TouchEvent) => {
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
      e.preventDefault()
      tbDragOffRef.current = dx
      setDragOffset(dx)
    }
  }, [])

  const handleTabTouchEnd = useCallback(() => {
    if (tbDragDir.current === "h" && tbDragging.current) {
      const dx = tbDragOffRef.current
      const cur = physicalIdxRef.current
      if (dx < -SWIPE_THRESHOLD) goToPhysical(cur + 1)
      else if (dx > SWIPE_THRESHOLD) goToPhysical(cur - 1)
    }
    setDragOffset(0)
    tbDragOffRef.current = 0
    tbDragging.current = false
    tbDragDir.current = null
  }, [goToPhysical])

  useEffect(() => {
    const el = tabBarRef.current
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
  const homeItemCount = homeItems.length
  const activeLogical = PHYSICAL_LOGICAL[physicalIdx]

  // Both strips share the same transition timing. Disabled during jump (clone seam) or drag.
  const stripTransition = isJumping || tbDragging.current
    ? "none"
    : "transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)"

  // Tab item strip translateX: centers the item at physicalIdx in the screen's middle third.
  // During drag, moves at 1/3 the speed of panels (dragOffset px → dragOffset/3 px).
  const tabStripTranslate = `translateX(calc(${(1 - physicalIdx) * ITEM_VW}vw + ${dragOffset / 3}px))`

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
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

      {/* Panel strip — 5 slots, panels only (no tab bars) */}
      <div className="flex-1 overflow-hidden">
        <div
          className="flex h-full"
          style={{
            width: "500%",
            transform: `translateX(calc(-${physicalIdx * 20}% + ${dragOffset}px))`,
            transition: stripTransition,
            willChange: "transform",
          }}
          onTransitionEnd={handlePanelTransitionEnd}
        >
          <div className="h-full overflow-y-auto" style={{ width: "20%" }}>
            <StillOkTab items={stillOkItems} onShowUndo={showUndo} />
          </div>
          <div className="h-full overflow-y-auto" style={{ width: "20%" }}>
            <ShoppingTab items={shoppingItems} suggested={suggestedItems} onShowUndo={showUndo} />
          </div>
          <div className="h-full overflow-y-auto" style={{ width: "20%" }}>
            <HomeTab items={homeItems} onShowUndo={showUndo} />
          </div>
          <div className="h-full overflow-y-auto" style={{ width: "20%" }}>
            <StillOkTab items={stillOkItems} onShowUndo={showUndo} />
          </div>
          <div className="h-full overflow-y-auto" style={{ width: "20%" }}>
            <ShoppingTab items={shoppingItems} suggested={suggestedItems} onShowUndo={showUndo} />
          </div>
        </div>
      </div>

      {/* Tab bar: static background + flowing item strip + center marker (never moves) */}
      <div
        ref={tabBarRef}
        className="shrink-0 bg-white border-t border-stone-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="relative h-14 overflow-hidden">

          {/* Flowing tab item strip — same 5-slot order as panels, moves at 1/3 speed */}
          <div
            className="flex h-full"
            style={{
              width: `${5 * ITEM_VW}vw`,
              transform: tabStripTranslate,
              transition: stripTransition,
              willChange: "transform",
            }}
          >
            {PHYSICAL_LOGICAL.map((logicalId, i) => {
              const tab = TAB_DEFS.find(t => t.id === logicalId)!
              const isActive = logicalId === activeLogical
              return (
                <button
                  key={i}
                  onClick={() => navigateToTab(logicalId)}
                  className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                    isActive ? "text-teal-700" : "text-stone-400"
                  }`}
                  style={{ width: `${ITEM_VW}vw`, height: "3.5rem" }}
                >
                  <div className="relative">
                    <tab.Icon size={20} />
                    {logicalId === "shopping" && shoppingBadge > 0 && (
                      <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                        {shoppingBadge > 9 ? "9+" : shoppingBadge}
                      </span>
                    )}
                    {logicalId === "home" && homeItemCount > 0 && (
                      <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white">
                        {homeItemCount > 9 ? "9+" : homeItemCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Center marker — absolutely positioned, never participates in any transform.
              Spans the middle third of the screen [ITEM_VW, 2×ITEM_VW vw).
              pointer-events-none so taps pass through to the tab item buttons. */}
          <div
            className="absolute inset-y-0 pointer-events-none"
            style={{ left: `${ITEM_VW}vw`, width: `${ITEM_VW}vw` }}
          >
            <div className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-teal-600" />
          </div>

        </div>
      </div>

      {/* FAB: fixed above tab bar (h-14 + safe-area) */}
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
