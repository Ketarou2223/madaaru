import { auth, signIn } from "@/lib/auth"
import { db } from "@/lib/db"
import { items } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { predict, PREDICTION_CONFIG } from "@/lib/prediction"
import TabShell from "@/components/TabShell"
import InstallPrompt from "@/components/InstallPrompt"
import type { HomeItem } from "@/components/HomeTab"
import type { ShoppingItem, SuggestedItem } from "@/components/ShoppingTab"
import type { StillOkItem } from "@/components/StillOkTab"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const session = await auth()

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 bg-white">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-teal-700 tracking-tight">まだある？</h1>
          <p className="mt-2 text-stone-400">消耗品が切れる前に教えてくれるアプリ</p>
        </div>
        <form
          action={async () => {
            "use server"
            await signIn("google", { redirectTo: "/" })
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-3 rounded-2xl bg-white border border-stone-200 px-6 py-3.5 text-stone-700 shadow-md hover:bg-stone-50 active:scale-95 transition-all font-medium"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
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

  const homeItems: HomeItem[] = []
  const shoppingItems: ShoppingItem[] = []
  const suggestedItems: SuggestedItem[] = []
  const stillOkItems: StillOkItem[] = []

  for (const item of userItems) {
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
        stockLevel: r.stockLevel ?? undefined,
      })),
      today
    )

    // Find the purchase with the most recent createdAt (actual insertion time)
    const lastPurchase = item.purchases.length > 0
      ? item.purchases.reduce((max, p) =>
          new Date(p.createdAt).getTime() > new Date(max.createdAt).getTime() ? p : max
        )
      : null

    // Find last report created strictly after the most recent purchase (by insertion time)
    const lastReportAfterPurchase = sortedReports
      .filter(
        (r) =>
          !lastPurchase ||
          new Date(r.createdAt).getTime() > new Date(lastPurchase.createdAt).getTime()
      )
      .at(-1)

    const lastKind = lastReportAfterPurchase?.kind ?? null
    const lastStockLevel = lastReportAfterPurchase?.stockLevel ?? null

    const predictionData = {
      nextDepleteDate: prediction.nextDepleteDate?.toISOString() ?? null,
      daysRemaining: prediction.daysRemaining,
      confidence: prediction.confidence,
    }

    if (lastKind === "soon" || lastKind === "out") {
      // On shopping list
      shoppingItems.push({
        id: item.id,
        name: item.name,
        category: item.category,
        lastReportKind: lastKind,
      })
    } else if (lastKind === "still") {
      // Confirmed in stock — appears in まだ大丈夫
      stillOkItems.push({
        id: item.id,
        name: item.name,
        category: item.category,
        prediction: predictionData,
        lastStockLevel: lastStockLevel as "plenty" | "normal" | "low" | null,
      })
      // If stock level is "low", also suggest in shopping list
      if (lastStockLevel === "low") {
        suggestedItems.push({
          id: item.id,
          name: item.name,
          category: item.category,
          prediction: { daysRemaining: prediction.daysRemaining, confidence: prediction.confidence },
        })
      }
    } else {
      // No report since last purchase — check prediction
      const days = prediction.daysRemaining
      if (days !== null && days <= PREDICTION_CONFIG.HOME_TAB_THRESHOLD_DAYS) {
        // Running low → show in まだある？
        homeItems.push({
          id: item.id,
          name: item.name,
          category: item.category,
          prediction: predictionData,
        })
      } else {
        // Plenty of time or still learning → まだ大丈夫
        stillOkItems.push({
          id: item.id,
          name: item.name,
          category: item.category,
          prediction: predictionData,
          lastStockLevel: null,
        })
      }
    }
  }

  // Sort: home by urgency (fewest days first), stillok by days remaining
  homeItems.sort((a, b) => {
    const ad = a.prediction.daysRemaining ?? Infinity
    const bd = b.prediction.daysRemaining ?? Infinity
    return ad - bd
  })
  stillOkItems.sort((a, b) => {
    const ad = a.prediction.daysRemaining ?? Infinity
    const bd = b.prediction.daysRemaining ?? Infinity
    return ad - bd
  })

  return (
    <>
      <InstallPrompt />
      <TabShell
        homeItems={homeItems}
        shoppingItems={shoppingItems}
        suggestedItems={suggestedItems}
        stillOkItems={stillOkItems}
        userImageUrl={session.user.image ?? null}
      />
    </>
  )
}
