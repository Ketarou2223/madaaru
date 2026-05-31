"use client"

import { useState } from "react"
import { recordPurchase } from "@/app/actions"
import type { QtyTag } from "@/lib/db/schema"
import { CheckIcon, XIcon } from "./icons"

function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const QTY_OPTIONS: { tag: QtyTag; label: string; desc: string }[] = [
  { tag: "more", label: "多め", desc: "いつもより多い" },
  { tag: "normal", label: "ふつう", desc: "いつも通り" },
  { tag: "less", label: "少なめ", desc: "いつもより少ない" },
]

export default function BuyModal({ itemId, itemName }: { itemId: string; itemName: string }) {
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState<QtyTag>("normal")
  const [date, setDate] = useState(todayString())
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    await recordPurchase(itemId, qty, date)
    setLoading(false)
    setOpen(false)
    setQty("normal")
    setDate(todayString())
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 active:scale-95 transition-all"
      >
        <CheckIcon size={14} />
        買った
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="animate-slide-up w-full max-w-lg bg-white rounded-t-3xl px-6 pb-10 pt-5 shadow-2xl">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-stone-200" />

            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">購入を記録</p>
                <h3 className="text-xl font-semibold text-stone-900">{itemName}</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors"
              >
                <XIcon size={16} />
              </button>
            </div>

            {/* Quantity selection */}
            <p className="text-sm font-medium text-stone-500 mb-2">量はどのくらい？</p>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {QTY_OPTIONS.map((opt) => (
                <button
                  key={opt.tag}
                  onClick={() => setQty(opt.tag)}
                  className={`flex flex-col items-center gap-1 rounded-2xl border-2 py-3.5 text-sm transition-all active:scale-95 ${
                    qty === opt.tag
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                  }`}
                >
                  <span className="font-semibold">{opt.label}</span>
                  <span className="text-xs opacity-60">{opt.desc}</span>
                </button>
              ))}
            </div>

            {/* Date */}
            <div className="mb-6">
              <label className="mb-1.5 block text-sm font-medium text-stone-500">
                購入日
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-800 focus:border-teal-500 focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-2xl border border-stone-200 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 rounded-2xl bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {loading ? "記録中…" : "記録する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
