"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { items, purchases, reports } from "@/lib/db/schema"
import type { QtyTag, ReportKind, StockLevel } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

type ActionResult = { error: string } | { success: true }
type ActionResultWithId = { error: string } | { success: true; id: string }

async function getUserId(): Promise<string | null> {
  const session = await auth()
  return session?.user?.id ?? null
}

export async function addItem(formData: FormData): Promise<ActionResult> {
  const userId = await getUserId()
  if (!userId) return { error: "ログインが必要です" }

  const name = (formData.get("name") as string)?.trim()
  if (!name) return { error: "品名を入力してください" }

  const category = (formData.get("category") as string)?.trim() || null
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [item] = await db
    .insert(items)
    .values({ userId, name, category })
    .returning()

  // First registration = first purchase
  await db.insert(purchases).values({
    itemId: item.id,
    purchasedOn: today,
    qtyTag: "normal",
  })

  revalidatePath("/")
  return { success: true }
}

export async function recordPurchase(
  itemId: string,
  qtyTag: QtyTag,
  purchasedOn: string // "YYYY-MM-DD"
): Promise<ActionResultWithId> {
  const userId = await getUserId()
  if (!userId) return { error: "ログインが必要です" }

  const [item] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.userId, userId)))

  if (!item) return { error: "品目が見つかりません" }

  const [purchase] = await db
    .insert(purchases)
    .values({ itemId, purchasedOn: new Date(purchasedOn), qtyTag })
    .returning()

  revalidatePath("/")
  revalidatePath("/shopping")
  return { success: true, id: purchase.id }
}

export async function recordReport(
  itemId: string,
  kind: ReportKind,
  stockLevel?: StockLevel
): Promise<ActionResultWithId> {
  const userId = await getUserId()
  if (!userId) return { error: "ログインが必要です" }

  const [item] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.userId, userId)))

  if (!item) return { error: "品目が見つかりません" }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [report] = await db
    .insert(reports)
    .values({ itemId, reportedOn: today, kind, ...(stockLevel ? { stockLevel } : {}) })
    .returning()

  revalidatePath("/")
  revalidatePath("/shopping")
  return { success: true, id: report.id }
}

export async function undoReport(reportId: string): Promise<ActionResult> {
  const userId = await getUserId()
  if (!userId) return { error: "ログインが必要です" }

  const [row] = await db
    .select({ id: reports.id })
    .from(reports)
    .innerJoin(items, eq(reports.itemId, items.id))
    .where(and(eq(reports.id, reportId), eq(items.userId, userId)))

  if (!row) return { error: "見つかりません" }

  await db.delete(reports).where(eq(reports.id, reportId))

  revalidatePath("/")
  revalidatePath("/shopping")
  return { success: true }
}

export async function undoPurchase(purchaseId: string): Promise<ActionResult> {
  const userId = await getUserId()
  if (!userId) return { error: "ログインが必要です" }

  const [row] = await db
    .select({ id: purchases.id })
    .from(purchases)
    .innerJoin(items, eq(purchases.itemId, items.id))
    .where(and(eq(purchases.id, purchaseId), eq(items.userId, userId)))

  if (!row) return { error: "見つかりません" }

  await db.delete(purchases).where(eq(purchases.id, purchaseId))

  revalidatePath("/")
  revalidatePath("/shopping")
  return { success: true }
}

export async function signOutAction(): Promise<void> {
  const { signOut } = await import("@/lib/auth")
  await signOut({ redirectTo: "/" })
}

export async function deleteItem(itemId: string): Promise<ActionResult> {
  const userId = await getUserId()
  if (!userId) return { error: "ログインが必要です" }

  await db
    .delete(items)
    .where(and(eq(items.id, itemId), eq(items.userId, userId)))

  revalidatePath("/")
  revalidatePath("/shopping")
  return { success: true }
}
