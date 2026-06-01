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

const TABS = [
  { id: "shopping", label: "買い物リスト", Icon: ShoppingCartIcon },
  { id: "home", label: "まだある？", Icon: LayersIcon },
  { id: "stillok", label: "まだ大丈夫", Icon: PackageIcon },
] as const

const SWIPE_THRESHOLD = 50

export default function TabShell({
  homeItems,
  shoppingItems,
  suggestedItems,
  stillOkItems,
  userImageUrl,
}: TabShellProps) {
  const [activeTab, setActiveTab] = useState(1) // 1 = home (center)
  const [dragOffset, setDragOffset] = useState(0)
  const [undoConfig, setUndoConfig] = useState<UndoConfig | null>(null)

  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const dragDirRef = useRef<"h" | "v" | null>(null)
  const dragOffsetRef = useRef(0)
  const isDraggingRef = useRef(false)

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

  // Clean up timer on unmount
  useEffect(() => () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
  }, [])

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startXRef.current = e.touches[0].clientX
    startYRef.current = e.touches[0].clientY
    dragDirRef.current = null
    dragOffsetRef.current = 0
    isDraggingRef.current = false
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const dx = e.touches[0].clientX - startXRef.current
    const dy = e.touches[0].clientY - startYRef.current

    if (dragDirRef.current === null) {
      if (Math.abs(dx) > Math.abs(dy) + 6) {
        dragDirRef.current = "h"
        isDraggingRef.current = true
      } else if (Math.abs(dy) > Math.abs(dx) + 6) {
        dragDirRef.current = "v"
        return
      } else {
        return
      }
    }

    if (dragDirRef.current === "h") {
      e.preventDefault()
      dragOffsetRef.current = dx
      setDragOffset(dx)
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (dragDirRef.current === "h" && isDraggingRef.current) {
      const dx = dragOffsetRef.current
      setActiveTab((prev) => {
        if (dx < -SWIPE_THRESHOLD && prev < 2) return prev + 1
        if (dx > SWIPE_THRESHOLD && prev > 0) return prev - 1
        return prev
      })
    }
    setDragOffset(0)
    dragOffsetRef.current = 0
    isDraggingRef.current = false
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener("touchstart", handleTouchStart, { passive: true })
    el.addEventListener("touchmove", handleTouchMove, { passive: false })
    el.addEventListener("touchend", handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchmove", handleTouchMove)
      el.removeEventListener("touchend", handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  const shoppingBadge = shoppingItems.length + suggestedItems.length

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      {/* Header */}
      <header className="shrink-0 bg-white/95 backdrop-blur border-b border-stone-200 px-5 pt-3 pb-0 safe-area-inset-top">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-teal-700 tracking-tight">まだある？</h1>
          <form action={signOutAction}>
            <button className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors py-1">
              <LogOutIcon size={14} />
              ログアウト
            </button>
          </form>
        </div>

        {/* Tab bar */}
        <div className="flex">
          {TABS.map((tab, idx) => {
            const isActive = activeTab === idx
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(idx)}
                className={`relative flex flex-1 flex-col items-center gap-1 pb-3 pt-1 text-xs font-medium transition-colors ${
                  isActive ? "text-teal-700" : "text-stone-400 hover:text-stone-600"
                }`}
              >
                <div className="relative">
                  <tab.Icon size={18} />
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
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-teal-600" />
                )}
              </button>
            )
          })}
        </div>
      </header>

      {/* Tab panels with horizontal swipe */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        <div
          className="flex h-full"
          style={{
            width: "300%",
            transform: `translateX(calc(-${activeTab * 33.333}% + ${dragOffset / 3}px))`,
            transition: isDraggingRef.current ? "none" : "transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
            willChange: "transform",
          }}
        >
          {/* Tab 0: Shopping */}
          <div className="h-full overflow-y-auto" style={{ width: "33.333%" }}>
            <ShoppingTab items={shoppingItems} suggested={suggestedItems} onShowUndo={showUndo} />
          </div>

          {/* Tab 1: Home */}
          <div className="h-full overflow-y-auto" style={{ width: "33.333%" }}>
            <HomeTab items={homeItems} onShowUndo={showUndo} />
          </div>

          {/* Tab 2: StillOk */}
          <div className="h-full overflow-y-auto" style={{ width: "33.333%" }}>
            <StillOkTab items={stillOkItems} onShowUndo={showUndo} />
          </div>
        </div>
      </div>

      <AddItemModal />

      {undoConfig && (
        <UndoToast
          message={undoConfig.message}
          onUndo={undoConfig.onUndo}
          onDismiss={dismissUndo}
          onUndoError={(msg) => showUndo({ message: msg })}
        />
      )}
    </div>
  )
}
