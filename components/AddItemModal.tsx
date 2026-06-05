"use client"

import { useState, useRef } from "react"
import { PlusIcon, XIcon } from "./icons"

interface AddItemModalProps {
  onAddItem: (name: string, category: string | null) => void
}

export default function AddItemModal({ onAddItem }: AddItemModalProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const name = (fd.get("name") as string)?.trim()
    if (!name) { setError("品名を入力してください"); return }
    const category = (fd.get("category") as string)?.trim() || null
    onAddItem(name, category)
    setOpen(false)
    setError("")
    formRef.current?.reset()
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed right-6 flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg hover:bg-teal-700 active:scale-95 transition-all z-40"
        style={{ bottom: "calc(var(--tab-bar-h) + env(safe-area-inset-bottom) + 1rem)" }}
        aria-label="品目を追加"
      >
        <PlusIcon size={24} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="animate-slide-up w-full max-w-lg bg-white rounded-t-3xl px-6 pb-10 pt-5 shadow-2xl">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-stone-200" />

            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">追加</p>
                <h3 className="text-xl font-semibold text-stone-900">品目を追加</h3>
              </div>
              <button
                onClick={() => { setOpen(false); setError("") }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors"
              >
                <XIcon size={16} />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-600">
                  品名 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="例：シャンプー、トイレットペーパー"
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-800 placeholder-stone-300 focus:border-teal-500 focus:bg-white focus:outline-none transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-600">
                  カテゴリ <span className="text-stone-400 font-normal">（任意）</span>
                </label>
                <input
                  type="text"
                  name="category"
                  placeholder="例：洗剤、食品"
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-800 placeholder-stone-300 focus:border-teal-500 focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              {error && (
                <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setError("") }}
                  className="flex-1 rounded-2xl border border-stone-200 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition-all active:scale-[0.98]"
                >
                  追加する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
