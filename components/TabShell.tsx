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

// Infinite loop via 5 physical panels:
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

  const logicalTab = PHYSICAL_LOGICAL[physicalIdx]

  // Ref copy of physicalIdx for use inside event handler closures (avoids stale closure)
  const physicalIdxRef = useRef(2)
  useEffect(() => { physicalIdxRef.current = physicalIdx }, [physicalIdx])

  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tabBarRef = useRef<HTMLDivElement>(null)

  // Tab bar swipe tracking (all refs — no re-renders during drag)
  const tbStartX = useRef(0)
  const tbStartY = useRef(0)
  const tbDragDir = useRef<"h" | "v" | null>(null)
  const tbDragOffRef = useRef(0)
  const tbDragging = useRef(false)

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

  // After transition lands on a clone panel, jump to the real panel with no animation
  function handleStripTransitionEnd(e: React.TransitionEvent) {
    if (e.propertyName !== "transform") return
    const cur = physicalIdxRef.current
    if (cur === 0 || cur === 4) {
      setIsJumping(true)
      setPhysicalIdx(cur === 0 ? 3 : 1)
    }
  }

  // Re-enable transition after the jump render has painted (double RAF guarantees paint)
  useEffect(() => {
    if (!isJumping) return
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setIsJumping(false)))
    return () => cancelAnimationFrame(raf)
  }, [isJumping])

  // --- Tab bar touch handlers ---
  // These are the ONLY place tab-switching gestures are handled.
  // The panel area has no tab-switching touch listeners, so 3-axis gestures are physically separated:
  //   vertical  → native scroll (overflow-y-auto on each panel)
  //   card horiz → SwipeCard (with stopPropagation)
  //   tab bar horiz → these handlers

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
      if (dx < -SWIPE_THRESHOLD) {
        setPhysicalIdx(cur + 1)
      } else if (dx > SWIPE_THRESHOLD) {
        setPhysicalIdx(cur - 1)
      }
    }
    setDragOffset(0)
    tbDragOffRef.current = 0
    tbDragging.current = false
    tbDragDir.current = null
  }, [])

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

  function navigateToTab(tab: LogicalTab) {
    setPhysicalIdx(CANONICAL_IDX[tab])
    setDragOffset(0)
  }

  const shoppingBadge = shoppingItems.length + suggestedItems.length

  // Disable transition while jumping (to hide the seam) or while dragging (follow finger 1:1)
  const stripTransition =
    isJumping || tbDragging.current
      ? "none"
      : "transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)"

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      {/* Header — slim (tab bar moved to bottom) */}
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

      {/* Tab panels — 5-panel infinite loop strip */}
      <div className="flex-1 overflow-hidden relative">
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
          {/* Physical 0: stillok clone (needed to wrap left from shopping) */}
          <div className="h-full overflow-y-auto" style={{ width: "20%" }}>
            <StillOkTab items={stillOkItems} onShowUndo={showUndo} />
          </div>
          {/* Physical 1: shopping */}
          <div className="h-full overflow-y-auto" style={{ width: "20%" }}>
            <ShoppingTab items={shoppingItems} suggested={suggestedItems} onShowUndo={showUndo} />
          </div>
          {/* Physical 2: home (start here) */}
          <div className="h-full overflow-y-auto" style={{ width: "20%" }}>
            <HomeTab items={homeItems} onShowUndo={showUndo} />
          </div>
          {/* Physical 3: stillok */}
          <div className="h-full overflow-y-auto" style={{ width: "20%" }}>
            <StillOkTab items={stillOkItems} onShowUndo={showUndo} />
          </div>
          {/* Physical 4: shopping clone (needed to wrap right from stillok) */}
          <div className="h-full overflow-y-auto" style={{ width: "20%" }}>
            <ShoppingTab items={shoppingItems} suggested={suggestedItems} onShowUndo={showUndo} />
          </div>
        </div>
      </div>

      {/* Bottom tab bar — swipe here to switch tabs, tap to jump directly */}
      <div
        ref={tabBarRef}
        className="shrink-0 bg-white/95 backdrop-blur border-t border-stone-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-14">
          {TAB_DEFS.map((tab) => {
            const isActive = logicalTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => navigateToTab(tab.id)}
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
                  {tab.id === "home" && homeItems.length > 0 && (
                    <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white">
                      {homeItems.length > 9 ? "9+" : homeItems.length}
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

      {/* FAB positioned above bottom tab bar */}
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
