"use client"

import { startTransition } from "react"
import { createPortal } from "react-dom"

export interface UndoConfig {
  message: string
  onUndo?: () => Promise<void>
  onUndoOptimistic?: () => void
}

interface UndoToastProps extends UndoConfig {
  onDismiss: () => void
  onUndoError: (msg: string) => void
}

export default function UndoToast({ message, onUndo, onUndoOptimistic, onDismiss, onUndoError }: UndoToastProps) {
  function handleUndo() {
    onDismiss()
    startTransition(async () => {
      onUndoOptimistic?.()
      try {
        await onUndo!()
      } catch (e) {
        onUndoError(e instanceof Error ? e.message : "取消に失敗しました")
      }
    })
  }

  return createPortal(
    <div
      className="fixed left-0 right-0 flex justify-center animate-slide-up z-[60] pointer-events-none"
      style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto mx-4 flex w-full max-w-sm items-center gap-3 rounded-2xl bg-stone-800 px-4 py-3.5 shadow-xl">
        <p className="flex-1 text-sm text-stone-100 leading-snug">{message}</p>
        <div className="flex items-center gap-3 shrink-0">
          {onUndo && (
            <button
              onClick={handleUndo}
              className="text-sm font-semibold text-teal-400 hover:text-teal-300 transition-colors active:scale-95"
            >
              元に戻す
            </button>
          )}
          <button
            onClick={onDismiss}
            className="text-stone-500 hover:text-stone-300 transition-colors text-lg leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
