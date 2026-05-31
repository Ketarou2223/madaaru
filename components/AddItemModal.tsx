"use client"

import { useState, useRef } from "react"
import { addItem } from "@/app/actions"

export default function AddItemModal() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError("")
    const result = await addItem(formData)
    setLoading(false)
    if ("error" in result) {
      setError(result.error)
    } else {
      setOpen(false)
      formRef.current?.reset()
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-2xl text-white shadow-lg hover:bg-sky-600 active:scale-95 transition-all z-40"
        aria-label="品目を追加"
      >
        ＋
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-5">品目を追加</h3>

            <form ref={formRef} action={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">
                  品名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="例：シャンプー、トイレットペーパー"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 placeholder-slate-300 focus:border-sky-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">
                  カテゴリ <span className="text-slate-400 font-normal">（任意）</span>
                </label>
                <input
                  type="text"
                  name="category"
                  placeholder="例：洗剤、食品"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 placeholder-slate-300 focus:border-sky-500 focus:outline-none"
                />
              </div>

              {error && <p className="text-sm text-rose-600">{error}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setError("")
                  }}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-sky-500 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
                >
                  {loading ? "追加中…" : "追加する"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
