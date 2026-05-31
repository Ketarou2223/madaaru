"use client"

import type { StockLevel } from "@/lib/db/schema"

interface StockLevelPopupProps {
  itemName: string
  onSelect: (level: StockLevel) => void
  onCancel: () => void
}

const OPTIONS: { level: StockLevel; label: string; desc: string; accent: string }[] = [
  { level: "plenty", label: "たくさんある", desc: "まだしばらく大丈夫", accent: "bg-teal-50 border-teal-200 text-teal-800" },
  { level: "normal", label: "ふつう", desc: "普通に残っている", accent: "bg-stone-50 border-stone-200 text-stone-800" },
  { level: "low", label: "きれそう", desc: "もうそろそろかも", accent: "bg-amber-50 border-amber-200 text-amber-800" },
]

export default function StockLevelPopup({ itemName, onSelect, onCancel }: StockLevelPopupProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="animate-slide-up w-full max-w-lg bg-white rounded-t-3xl px-6 pb-10 pt-5 shadow-2xl">
        {/* Handle */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-stone-200" />

        <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">まだ大丈夫へ</p>
        <h3 className="text-xl font-semibold text-stone-900 mb-1">{itemName}</h3>
        <p className="text-sm text-stone-500 mb-6">今の残量はどのくらい？</p>

        <div className="space-y-3">
          {OPTIONS.map((opt) => (
            <button
              key={opt.level}
              onClick={() => onSelect(opt.level)}
              className={`w-full flex items-center justify-between rounded-2xl border-2 px-5 py-4 text-left transition-all active:scale-[0.98] ${opt.accent}`}
            >
              <div>
                <p className="font-semibold text-base leading-tight">{opt.label}</p>
                <p className="text-sm opacity-70 mt-0.5">{opt.desc}</p>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="mt-4 w-full rounded-2xl py-3 text-sm font-medium text-stone-400 hover:text-stone-600 transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>
  )
}
