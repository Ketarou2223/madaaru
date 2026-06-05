"use client"

import { useState, useRef, useEffect, useCallback, useOptimistic, startTransition } from "react"
import { createPortal } from "react-dom"
import HomeTab from "./HomeTab"
import ShoppingTab from "./ShoppingTab"
import StillOkTab from "./StillOkTab"
import AddItemModal from "./AddItemModal"
import UndoToast from "./UndoToast"
import type { UndoConfig } from "./UndoToast"
import { ShoppingCartIcon, LayersIcon, PackageIcon, LogOutIcon, SettingsIcon, XIcon, CheckIcon, TrashIcon } from "./icons"
import { addItem, signOutAction } from "@/app/actions"
import type { HomeItem } from "./HomeTab"
import type { ShoppingItem, SuggestedItem } from "./ShoppingTab"
import type { StillOkItem } from "./StillOkTab"
import {
  ZONE_LABEL_COLOR,
  ZONE_LEFT_COLOR,
  ZONE_RIGHT_COLOR,
  ZONE_EDGE_PEEK_PX,
  ZONE_EDGE_PEEK_OPACITY,
  ZONE_FRONT_FEATHER_PX,
  ZONE_ICON_SIZE_PX,
  ZONE_LABEL_FONT_SIZE,
} from "@/lib/swipe-config"

// Solid zone with a thin feather only at the leading (center-facing) edge.
const SOLID_LEFT  = `linear-gradient(to right, ${ZONE_LEFT_COLOR} calc(100% - ${ZONE_FRONT_FEATHER_PX}px), rgba(226,75,74,0) 100%)`
const SOLID_RIGHT = `linear-gradient(to left,  ${ZONE_RIGHT_COLOR} calc(100% - ${ZONE_FRONT_FEATHER_PX}px), rgba(55,138,221,0) 100%)`

const PEEK_LEFT  = "linear-gradient(to right, rgba(226,75,74,0.30), transparent)"
const PEEK_RIGHT = "linear-gradient(to left, rgba(55,138,221,0.30), transparent)"

// Map action label → icon component for the waiting-state zone display.
function ZoneIcon({ label, size }: { label: string; size: number }) {
  if (label === "買い物リストへ") return <ShoppingCartIcon size={size} />
  if (label === "まだ大丈夫")    return <PackageIcon size={size} />
  if (label === "そろそろ…")    return <LayersIcon size={size} />
  if (label === "買った ✓")     return <CheckIcon size={size} />
  if (label === "削除")          return <TrashIcon size={size} />
  return null
}

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

// 7-item tab strip (5 physical slots + 1 extra on each end).
const PHYSICAL_TAB_ITEMS: readonly LogicalTab[] = ["home", "stillok", "shopping", "home", "stillok", "shopping", "home"]

const TAB_DEFS = [
  { id: "shopping" as const, label: "買い物リスト", Icon: ShoppingCartIcon },
  { id: "home" as const, label: "まだある？", Icon: LayersIcon },
  { id: "stillok" as const, label: "まだ大丈夫", Icon: PackageIcon },
]

const SWIPE_THRESHOLD = 50

// Each tab item occupies 1/3 of the viewport width.
const ITEM_VW = 100 / 3

// Card drag state reported by any active SwipeCard via onDragProgress.
type CardDrag = { p: number; dir: "left" | "right" | null; label: string; waiting: boolean }
const DRAG_IDLE: CardDrag = { p: 0, dir: null, label: "", waiting: false }

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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cardDrag, setCardDrag] = useState<CardDrag>(DRAG_IDLE)

  const physicalIdxRef = useRef(2)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingNavRef = useRef<number | null>(null)
  const tabBarRef = useRef<HTMLDivElement>(null)

  const tbStartX = useRef(0)
  const tbStartY = useRef(0)
  const tbDragDir = useRef<"h" | "v" | null>(null)
  const tbDragOffRef = useRef(0)
  const tbDragging = useRef(false)

  const goToPhysical = useCallback((n: number) => {
    const clamped = Math.max(0, Math.min(4, n))
    physicalIdxRef.current = clamped
    setPhysicalIdx(clamped)
  }, [])

  const navigateToTab = useCallback((tab: LogicalTab) => {
    const target = CANONICAL_IDX[tab]
    const cur = physicalIdxRef.current
    const curCanonical = cur === 0 ? 3 : cur === 4 ? 1 : cur

    if (curCanonical === target) {
      if (cur !== curCanonical) {
        setIsJumping(true)
        goToPhysical(curCanonical)
      }
      setDragOffset(0)
      return
    }

    let dist = target - curCanonical
    if (dist > 1) dist -= 3
    if (dist < -1) dist += 3
    const physicalTarget = curCanonical + dist

    if (cur !== curCanonical) {
      setIsJumping(true)
      goToPhysical(curCanonical)
      pendingNavRef.current = physicalTarget
    } else {
      goToPhysical(physicalTarget)
    }
    setDragOffset(0)
  }, [goToPhysical])

  const [optimisticNewItems, addOptimisticItem] = useOptimistic<StillOkItem[], StillOkItem>(
    [],
    (state, item) => [...state, item]
  )

  function handleAddItem(name: string, category: string | null) {
    const fakeItem: StillOkItem = {
      id: `optimistic-${Date.now()}`,
      name,
      category,
      prediction: { nextDepleteDate: null, daysRemaining: null, confidence: "学習中" },
      lastStockLevel: null,
    }
    startTransition(async () => {
      addOptimisticItem(fakeItem)
      const fd = new FormData()
      fd.set("name", name)
      if (category) fd.set("category", category)
      const result = await addItem(fd)
      if ("error" in result) {
        showUndo({ message: result.error })
      }
    })
  }

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

  function handlePanelTransitionEnd(e: React.TransitionEvent) {
    if (e.propertyName !== "transform") return
    const cur = physicalIdxRef.current
    if (cur === 0 || cur === 4) {
      setIsJumping(true)
      goToPhysical(cur === 0 ? 3 : 1)
    }
  }

  useEffect(() => {
    if (!isJumping) {
      if (pendingNavRef.current !== null) {
        const t = pendingNavRef.current
        pendingNavRef.current = null
        goToPhysical(t)
      }
      return
    }
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setIsJumping(false)))
    return () => cancelAnimationFrame(raf)
  }, [isJumping, goToPhysical])

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

  // Stable callback passed to each tab → each SwipeCard's onDragProgress.
  const handleCardDragProgress = useCallback(
    (p: number, dir: "left" | "right" | null, label: string, waiting?: boolean) => {
      setCardDrag(dir === null ? DRAG_IDLE : { p, dir, label, waiting: waiting ?? false })
    },
    []
  )

  const shoppingBadge = shoppingItems.length + suggestedItems.length
  const homeItemCount = homeItems.length
  const activeLogical = PHYSICAL_LOGICAL[physicalIdx]

  const stripTransition = isJumping || tbDragging.current
    ? "none"
    : "transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)"

  const tabStripTranslate = `translateX(calc(${-physicalIdx * ITEM_VW}vw + ${dragOffset / 3}px))`

  // --- Background zone geometry ---
  const { p: dp, dir: dd, label: dl, waiting: dw } = cardDrag
  const isLeft  = dd === "left"
  const isRight = dd === "right"

  // Zone width: edge-peek at rest, expands with drag progress. In waiting state p=WAIT_FILL.
  const leftWidthVal  = isLeft  ? `calc(${ZONE_EDGE_PEEK_PX}px + ${dp} * (100vw - ${ZONE_EDGE_PEEK_PX}px))` : `${ZONE_EDGE_PEEK_PX}px`
  const rightWidthVal = isRight ? `calc(${ZONE_EDGE_PEEK_PX}px + ${dp} * (100vw - ${ZONE_EDGE_PEEK_PX}px))` : `${ZONE_EDGE_PEEK_PX}px`

  // Opacity: active side = 1; opposite edge recedes during drag.
  const leftOpacity  = isLeft ? 1 : isRight ? ZONE_EDGE_PEEK_OPACITY * (1 - dp) : ZONE_EDGE_PEEK_OPACITY
  const rightOpacity = isRight ? 1 : isLeft  ? ZONE_EDGE_PEEK_OPACITY * (1 - dp) : ZONE_EDGE_PEEK_OPACITY

  // Solid background during active drag/wait; simple peek gradient at rest.
  const leftBg  = isLeft  ? SOLID_LEFT  : PEEK_LEFT
  const rightBg = isRight ? SOLID_RIGHT : PEEK_RIGHT

  // Transition: spring when entering waiting, smooth snap-back at rest, instant during drag.
  const zoneTransition = dd === null
    ? "width 0.25s ease, opacity 0.2s ease"
    : dw
    ? `width 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease`
    : "none"

  const showLeftLabel  = isLeft  && dp > 0
  const showRightLabel = isRight && dp > 0

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>

      {/*
        Background swipe zones — position:fixed, z-1.
        Cards are z-10 (above zones). Header and tab bar are z-30 (cover zones at full expansion).
        pointer-events:none always — tap handling in SwipeCard's document-capture listener.
      */}
      <div
        aria-hidden
        className="pointer-events-none"
        style={{
          position: "fixed",
          top: 0,
          bottom: "calc(var(--tab-bar-h) + env(safe-area-inset-bottom))",
          left: 0,
          zIndex: 1,
          width: leftWidthVal,
          background: leftBg,
          opacity: leftOpacity,
          transition: zoneTransition,
          overflow: "hidden",
        }}
      >
        {showLeftLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div style={{ color: ZONE_LABEL_COLOR }}>
              <ZoneIcon label={dl} size={ZONE_ICON_SIZE_PX} />
            </div>
            <span style={{
              color: ZONE_LABEL_COLOR,
              fontSize: ZONE_LABEL_FONT_SIZE,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              textShadow: "0 2px 8px rgba(0,0,0,0.35)",
              whiteSpace: "nowrap",
            }}>
              {dl}
            </span>
          </div>
        )}
      </div>

      <div
        aria-hidden
        className="pointer-events-none"
        style={{
          position: "fixed",
          top: 0,
          bottom: "calc(var(--tab-bar-h) + env(safe-area-inset-bottom))",
          right: 0,
          zIndex: 1,
          width: rightWidthVal,
          background: rightBg,
          opacity: rightOpacity,
          transition: zoneTransition,
          overflow: "hidden",
        }}
      >
        {showRightLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div style={{ color: ZONE_LABEL_COLOR }}>
              <ZoneIcon label={dl} size={ZONE_ICON_SIZE_PX} />
            </div>
            <span style={{
              color: ZONE_LABEL_COLOR,
              fontSize: ZONE_LABEL_FONT_SIZE,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              textShadow: "0 2px 8px rgba(0,0,0,0.35)",
              whiteSpace: "nowrap",
            }}>
              {dl}
            </span>
          </div>
        )}
      </div>

      {/* Header — z-30 covers the zones when they expand */}
      <header
        className="relative z-30 shrink-0 bg-white/95 backdrop-blur border-b border-stone-200 px-5 py-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-teal-700 tracking-tight">まだある？</h1>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors"
            aria-label="設定"
          >
            <SettingsIcon size={20} />
          </button>
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
            <StillOkTab items={[...stillOkItems, ...optimisticNewItems]} onShowUndo={showUndo} onCardDragProgress={handleCardDragProgress} />
          </div>
          <div className="h-full overflow-y-auto" style={{ width: "20%" }}>
            <ShoppingTab items={shoppingItems} suggested={suggestedItems} onShowUndo={showUndo} onCardDragProgress={handleCardDragProgress} />
          </div>
          <div className="h-full overflow-y-auto" style={{ width: "20%" }}>
            <HomeTab items={homeItems} onShowUndo={showUndo} onCardDragProgress={handleCardDragProgress} />
          </div>
          <div className="h-full overflow-y-auto" style={{ width: "20%" }}>
            <StillOkTab items={[...stillOkItems, ...optimisticNewItems]} onShowUndo={showUndo} onCardDragProgress={handleCardDragProgress} />
          </div>
          <div className="h-full overflow-y-auto" style={{ width: "20%" }}>
            <ShoppingTab items={shoppingItems} suggested={suggestedItems} onShowUndo={showUndo} onCardDragProgress={handleCardDragProgress} />
          </div>
        </div>
      </div>

      {/* Tab bar — z-30 covers the zones */}
      <div
        ref={tabBarRef}
        className="relative z-30 shrink-0 bg-white border-t border-stone-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="relative overflow-hidden" style={{ height: "var(--tab-bar-h)" }}>

          {/* Center marker surface — painted first so tab items render on top.
              Absolutely fixed to center third; never participates in tab-strip transform. */}
          <div
            className="absolute inset-y-0 pointer-events-none"
            style={{
              left: `${ITEM_VW}vw`,
              width: `${ITEM_VW}vw`,
              background: "rgba(20, 184, 166, 0.10)",
            }}
          />

          {/* Flowing tab item strip */}
          <div
            className="flex h-full"
            style={{
              width: `${7 * ITEM_VW}vw`,
              transform: tabStripTranslate,
              transition: stripTransition,
              willChange: "transform",
            }}
          >
            {PHYSICAL_TAB_ITEMS.map((logicalId, i) => {
              const tab = TAB_DEFS.find(t => t.id === logicalId)!
              const isActive = logicalId === activeLogical
              return (
                <button
                  key={i}
                  onClick={() => navigateToTab(logicalId)}
                  className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                    isActive ? "text-teal-700" : "text-stone-400"
                  }`}
                  style={{ width: `${ITEM_VW}vw`, height: "var(--tab-bar-h)" }}
                >
                  <div className="relative">
                    <tab.Icon size={48} />
                    {logicalId === "shopping" && shoppingBadge > 0 && (
                      <span className="absolute -right-3 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                        {shoppingBadge > 9 ? "9+" : shoppingBadge}
                      </span>
                    )}
                    {logicalId === "home" && homeItemCount > 0 && (
                      <span className="absolute -right-3 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-white">
                        {homeItemCount > 9 ? "9+" : homeItemCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>

        </div>
      </div>

      {/* FAB: fixed above tab bar */}
      <AddItemModal onAddItem={handleAddItem} />

      {undoConfig && (
        <UndoToast
          {...undoConfig}
          onDismiss={dismissUndo}
          onUndoError={(msg) => showUndo({ message: msg })}
        />
      )}

      {settingsOpen && createPortal(
        <div
          className="fixed inset-0 z-50 animate-fade-in"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl animate-slide-up"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <span className="font-semibold text-stone-800">設定</span>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-600 transition-colors"
                aria-label="閉じる"
              >
                <XIcon size={20} />
              </button>
            </div>
            <div className="px-5 py-3">
              <form action={signOutAction}>
                <button className="flex items-center gap-2.5 w-full py-3 text-sm text-stone-700 hover:text-stone-900 transition-colors">
                  <LogOutIcon size={18} />
                  ログアウト
                </button>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
