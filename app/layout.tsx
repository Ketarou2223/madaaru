import type { Metadata, Viewport } from "next"
import "./globals.css"
import SwRegistration from "@/components/SwRegistration"

export const metadata: Metadata = {
  title: "まだある？",
  description: "消耗品が切れる前に教えてくれるアプリ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "まだある？",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full antialiased">
        {children}
        <SwRegistration />
      </body>
    </html>
  )
}
