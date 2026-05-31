import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { items, purchases, reports } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import BuyModal from "@/components/BuyModal"

export const dynamic = "force-dynamic"

export default async function ShoppingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/")

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

  // Items on shopping list: last report is soon/out and no purchase after it
  const shoppingItems = userItems.filter((item) => {
    const sortedReports = [...item.reports].sort(
      (a, b) => new Date(a.reportedOn).getTime() - new Date(b.reportedOn).getTime()
    )
    const sortedPurchases = [...item.purchases].sort(
      (a, b) => new Date(a.purchasedOn).getTime() - new Date(b.purchasedOn).getTime()
    )

    const lastReport = sortedReports[sortedReports.length - 1]
    const lastPurchase = sortedPurchases[sortedPurchases.length - 1]

    return (
      lastReport &&
      (lastReport.kind === "soon" || lastReport.kind === "out") &&
      (!lastPurchase || new Date(lastPurchase.purchasedOn) <= new Date(lastReport.reportedOn))
    )
  })

  return (
    <main className="mx-auto max-w-lg pb-24">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <a href="/" className="text-sky-600 hover:text-sky-800">
            ← 戻る
          </a>
          <h1 className="text-xl font-bold text-slate-800">🛒 買い物リスト</h1>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-3">
        {shoppingItems.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="text-5xl">✅</div>
            <p className="text-slate-500">買い物リストは空です</p>
            <p className="text-sm text-slate-400">
              ホームで「そろそろ」「切れた」を押すとここに追加されます
            </p>
          </div>
        ) : (
          shoppingItems.map((item) => {
            const lastReport = [...item.reports]
              .sort((a, b) => new Date(a.reportedOn).getTime() - new Date(b.reportedOn).getTime())
              .at(-1)

            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 shadow-sm ${
                  lastReport?.kind === "out"
                    ? "border-rose-200 bg-rose-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {item.category && (
                      <span className="text-xs text-slate-400">{item.category}</span>
                    )}
                    <h2 className="text-lg font-semibold text-slate-800">{item.name}</h2>
                    <p className={`text-sm mt-0.5 ${
                      lastReport?.kind === "out" ? "text-rose-600" : "text-amber-700"
                    }`}>
                      {lastReport?.kind === "out" ? "切れた" : "そろそろ切れる"}
                    </p>
                  </div>
                  <BuyModal itemId={item.id} itemName={item.name} />
                </div>
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}
