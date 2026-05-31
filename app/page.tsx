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
            await signIn("github", { redirectTo: "/" })
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-3 rounded-xl bg-slate-900 px-6 py-3 text-white shadow-lg hover:bg-slate-700 active:scale-95 transition-all"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHubでサインイン
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
