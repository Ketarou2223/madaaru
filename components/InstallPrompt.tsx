"use client"

import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(true) // start hidden

  useEffect(() => {
    // Already dismissed this session
    if (sessionStorage.getItem("install-dismissed")) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setDismissed(false)
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setDismissed(true)
    }
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    sessionStorage.setItem("install-dismissed", "1")
    setDismissed(true)
  }

  if (dismissed || !deferredPrompt) return null

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-sky-800">ホーム画面に追加しますか？</p>
        <p className="text-xs text-sky-600">いつでもすぐ開けます</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={handleDismiss}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          あとで
        </button>
        <button
          onClick={handleInstall}
          className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
        >
          追加
        </button>
      </div>
    </div>
  )
}
