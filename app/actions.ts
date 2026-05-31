"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { items, purchases, reports } from "@/lib/db/schema"
import type { QtyTag, ReportKind } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

type ActionResult = { error: string } | { success: true }

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
): Promise<ActionResult> {
  const userId = await getUserId()
  if (!userId) return { error: "ログインが必要です" }

  // Verify the item belongs to this user
  const [item] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.userId, userId)))

  if (!item) return { error: "品目が見つかりません" }

  await db.insert(purchases).values({
    itemId,
    purchasedOn: new Date(purchasedOn),
    qtyTag,
  })

  revalidatePath("/")
  revalidatePath("/shopping")
  return { success: true }
}

export async function recordReport(
  itemId: string,
  kind: ReportKind
): Promise<ActionResult> {
  const userId = await getUserId()
  if (!userId) return { error: "ログインが必要です" }

  const [item] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.userId, userId)))

  if (!item) return { error: "品目が見つかりません" }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  await db.insert(reports).values({
    itemId,
    reportedOn: today,
    kind,
  })

  revalidatePath("/")
  revalidatePath("/shopping")
  return { success: true }
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
