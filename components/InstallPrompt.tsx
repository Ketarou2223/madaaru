"use client"

import { useEffect, useState } from "react"
import { XIcon } from "./icons"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
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
    if (outcome === "accepted") setDismissed(true)
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    sessionStorage.setItem("install-dismissed", "1")
    setDismissed(true)
  }

  if (dismissed || !deferredPrompt) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between gap-3 bg-teal-600 px-5 py-3 text-white shadow-lg">
      <div>
        <p className="text-sm font-semibold">ホーム画面に追加しますか？</p>
        <p className="text-xs text-teal-100">いつでもすぐ開けます</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstall}
          className="rounded-xl bg-white px-3.5 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 transition-colors"
        >
          追加
        </button>
        <button
          onClick={handleDismiss}
          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-teal-500 transition-colors"
          aria-label="閉じる"
        >
          <XIcon size={14} />
        </button>
      </div>
    </div>
  )
}
