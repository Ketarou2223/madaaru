import {
  pgTable,
  text,
  timestamp,
  date,
  primaryKey,
  integer,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import type { AdapterAccountType } from "@auth/core/adapters"

// ── Auth.js adapter tables ─────────────────────────────────────────────────

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
})

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
)

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
)

// ── App tables ─────────────────────────────────────────────────────────────

export const items = pgTable("items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
})

export const purchases = pgTable("purchases", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  purchasedOn: date("purchased_on", { mode: "date" }).notNull(),
  qtyTag: text("qty_tag", { enum: ["more", "normal", "less"] })
    .notNull()
    .default("normal"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
})

export const reports = pgTable("reports", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  reportedOn: date("reported_on", { mode: "date" }).notNull(),
  kind: text("kind", { enum: ["soon", "out", "still"] }).notNull(),
  stockLevel: text("stock_level", { enum: ["plenty", "normal", "low"] }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
})

// ── Relations ──────────────────────────────────────────────────────────────

export const itemsRelations = relations(items, ({ many }) => ({
  purchases: many(purchases),
  reports: many(reports),
}))

export const purchasesRelations = relations(purchases, ({ one }) => ({
  item: one(items, { fields: [purchases.itemId], references: [items.id] }),
}))

export const reportsRelations = relations(reports, ({ one }) => ({
  item: one(items, { fields: [reports.itemId], references: [items.id] }),
}))

// ── Inferred types ─────────────────────────────────────────────────────────

export type Item = typeof items.$inferSelect
export type Purchase = typeof purchases.$inferSelect
export type Report = typeof reports.$inferSelect
export type QtyTag = "more" | "normal" | "less"
export type ReportKind = "soon" | "out" | "still"
export type StockLevel = "plenty" | "normal" | "low"
