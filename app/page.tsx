import { auth, signIn } from "@/lib/auth"
import { db } from "@/lib/db"
import { items } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { predict } from "@/lib/prediction"
import ItemCard from "@/components/ItemCard"
import AddItemModal from "@/components/AddItemModal"
import InstallPrompt from "@/components/InstallPrompt"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const session = await auth()

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-sky-600">まだある？</h1>
          <p className="mt-2 text-slate-500">消耗品が切れる前に教えてくれるアプリ</p>
        </div>
        <form
          action={async () => {
            "use server"
            await signIn("google", { redirectTo: "/" })
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-6 py-3 text-slate-700 shadow-lg hover:bg-slate-50 active:scale-95 transition-all"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Googleでサインイン
          </button>
        </form>
      </main>
    )
  }

  const userId = session.user.id

  const userItems = await db.query.items.findMany({
    where: eq(items.userId, userId),
    with: {
      purchases: true,
      reports: true,
    },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const enrichedItems = userItems.map((item) => {
    const sortedPurchases = [...item.purchases].sort(
      (a, b) => new Date(a.purchasedOn).getTime() - new Date(b.purchasedOn).getTime()
    )
    const sortedReports = [...item.reports].sort(
      (a, b) => new Date(a.reportedOn).getTime() - new Date(b.reportedOn).getTime()
    )

    const prediction = predict(
      sortedPurchases.map((p) => ({
        purchasedOn: new Date(p.purchasedOn),
        qtyTag: p.qtyTag,
      })),
      sortedReports.map((r) => ({
        reportedOn: new Date(r.reportedOn),
        kind: r.kind,
      })),
      today
    )

    const lastReport = sortedReports[sortedReports.length - 1]
    const lastPurchase = sortedPurchases[sortedPurchases.length - 1]
    const isOnShoppingList =
      !!lastReport &&
      (lastReport.kind === "soon" || lastReport.kind === "out") &&
      (!lastPurchase ||
        new Date(lastPurchase.purchasedOn) <= new Date(lastReport.reportedOn))

    return {
      id: item.id,
      name: item.name,
      category: item.category,
      prediction: {
        nextDepleteDate: prediction.nextDepleteDate?.toISOString() ?? null,
        daysRemaining: prediction.daysRemaining,
        confidence: prediction.confidence,
      },
      isOnShoppingList,
    }
  })

  const sorted = enrichedItems.sort((a, b) => {
    const aDays = a.prediction.daysRemaining
    const bDays = b.prediction.daysRemaining
    if (aDays === null && bDays === null) return 0
    if (aDays === null) return 1
    if (bDays === null) return -1
    return aDays - bDays
  })

  const shoppingCount = sorted.filter((i) => i.isOnShoppingList).length

  return (
    <main className="mx-auto max-w-lg pb-24">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-sky-600">まだある？</h1>
          <div className="flex items-center gap-3">
            {shoppingCount > 0 && (
              <a
                href="/shopping"
                className="relative flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100 transition-colors"
              >
                🛒 買い物リスト
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-[11px] text-white">
                  {shoppingCount}
                </span>
              </a>
            )}
            <form
              action={async () => {
                "use server"
                const { signOut } = await import("@/lib/auth")
                await signOut({ redirectTo: "/" })
              }}
            >
              <button className="text-sm text-slate-400 hover:text-slate-600">
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-3">
        <InstallPrompt />
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="text-5xl">📦</div>
            <p className="text-slate-500">まだ品目がありません</p>
            <p className="text-sm text-slate-400">「＋ 品目を追加」から始めましょう</p>
          </div>
        ) : (
          sorted.map((item) => <ItemCard key={item.id} item={item} />)
        )}
      </div>

      <AddItemModal />
    </main>
  )
}
