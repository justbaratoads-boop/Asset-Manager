import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const partiesTable = pgTable("parties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("customer"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  gstin: text("gstin"),
  pan: text("pan"),
  phone: text("phone"),
  email: text("email"),
  creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }),
  openingBalance: numeric("opening_balance", { precision: 15, scale: 2 }).notNull().default("0"),
  balanceType: text("balance_type").notNull().default("dr"),
  isDeleted: text("is_deleted").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPartySchema = createInsertSchema(partiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertParty = z.infer<typeof insertPartySchema>;
export type Party = typeof partiesTable.$inferSelect;
