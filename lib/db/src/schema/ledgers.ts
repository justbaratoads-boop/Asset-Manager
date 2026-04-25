import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ledgersTable = pgTable("ledgers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  group: text("group").notNull(),
  nature: text("nature").notNull().default("dr"),
  openingBalance: numeric("opening_balance", { precision: 15, scale: 2 }).notNull().default("0"),
  isDeleted: text("is_deleted").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLedgerSchema = createInsertSchema(ledgersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLedger = z.infer<typeof insertLedgerSchema>;
export type Ledger = typeof ledgersTable.$inferSelect;
