"use client"

import { useState } from "react"
import { recordPurchase } from "@/app/actions"
import type { QtyTag } from "@/lib/db/schema"

function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const QTY_OPTIONS: { tag: QtyTag; label: string; emoji: string }[] = [
  { tag: "more", label: "多い", emoji: "📦" },
  { tag: "normal", label: "ふつう", emoji: "✅" },
  { tag: "less", label: "少なめ", emoji: "📉" },
]

export default function BuyModal({
  itemId,
  itemName,
}: {
  itemId: string
  itemName: string
}) {
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
        className="rounded-xl bg-sky-500 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 active:scale-95 transition-all"
      >
        買った
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-1">
              「{itemName}」を買いました
            </h3>
            <p className="text-sm text-slate-500 mb-5">量はどのくらい？</p>

            {/* Quantity selection */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {QTY_OPTIONS.map((opt) => (
                <button
                  key={opt.tag}
                  onClick={() => setQty(opt.tag)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 py-3 text-sm font-medium transition-all ${
                    qty === opt.tag
                      ? "border-sky-500 bg-sky-50 text-sky-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <span className="text-xl">{opt.emoji}</span>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Date */}
            <div className="mb-5">
              <label className="mb-1 block text-sm font-medium text-slate-600">
                購入日
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-sky-500 focus:outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 rounded-xl bg-sky-500 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
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
