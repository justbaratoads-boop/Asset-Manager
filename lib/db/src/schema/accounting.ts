import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  voucherNumber: text("voucher_number").notNull().unique(),
  voucherType: text("voucher_type").notNull().default("journal"),
  narration: text("narration").notNull(),
  totalDebit: numeric("total_debit", { precision: 15, scale: 2 }).notNull().default("0"),
  totalCredit: numeric("total_credit", { precision: 15, scale: 2 }).notNull().default("0"),
  isDeleted: text("is_deleted").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const journalLinesTable = pgTable("journal_lines", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull(),
  ledgerId: integer("ledger_id").notNull(),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentsTable = pgTable("payment_vouchers", {
  id: serial("id").primaryKey(),
  voucherNumber: text("voucher_number").notNull().unique(),
  date: text("date").notNull(),
  partyId: integer("party_id"),
  partyName: text("party_name"),
  ledgerId: integer("ledger_id").notNull(),
  paymentMode: text("payment_mode").notNull().default("cash"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  narration: text("narration"),
  reference: text("reference"),
  isDeleted: text("is_deleted").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const receiptsTable = pgTable("receipt_vouchers", {
  id: serial("id").primaryKey(),
  voucherNumber: text("voucher_number").notNull().unique(),
  date: text("date").notNull(),
  partyId: integer("party_id"),
  partyName: text("party_name"),
  ledgerId: integer("ledger_id").notNull(),
  paymentMode: text("payment_mode").notNull().default("cash"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  narration: text("narration"),
  reference: text("reference"),
  isDeleted: text("is_deleted").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const creditNotesTable = pgTable("credit_notes", {
  id: serial("id").primaryKey(),
  noteNumber: text("note_number").notNull().unique(),
  date: text("date").notNull(),
  saleInvoiceId: integer("sale_invoice_id"),
  partyId: integer("party_id"),
  partyName: text("party_name").notNull(),
  reason: text("reason").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull().default("0"),
  isDeleted: text("is_deleted").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const creditNoteItemsTable = pgTable("credit_note_items", {
  id: serial("id").primaryKey(),
  noteId: integer("note_id").notNull(),
  stockItemId: integer("stock_item_id"),
  itemName: text("item_name").notNull(),
  hsnCode: text("hsn_code"),
  quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  rate: numeric("rate", { precision: 15, scale: 2 }).notNull(),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  gstPct: numeric("gst_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  taxableAmount: numeric("taxable_amount", { precision: 15, scale: 2 }).notNull(),
  cgst: numeric("cgst", { precision: 15, scale: 2 }).notNull().default("0"),
  sgst: numeric("sgst", { precision: 15, scale: 2 }).notNull().default("0"),
  igst: numeric("igst", { precision: 15, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const debitNotesTable = pgTable("debit_notes", {
  id: serial("id").primaryKey(),
  noteNumber: text("note_number").notNull().unique(),
  date: text("date").notNull(),
  purchaseInvoiceId: integer("purchase_invoice_id"),
  partyId: integer("party_id"),
  partyName: text("party_name").notNull(),
  reason: text("reason").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull().default("0"),
  isDeleted: text("is_deleted").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const debitNoteItemsTable = pgTable("debit_note_items", {
  id: serial("id").primaryKey(),
  noteId: integer("note_id").notNull(),
  stockItemId: integer("stock_item_id"),
  itemName: text("item_name").notNull(),
  hsnCode: text("hsn_code"),
  quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  rate: numeric("rate", { precision: 15, scale: 2 }).notNull(),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  gstPct: numeric("gst_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  taxableAmount: numeric("taxable_amount", { precision: 15, scale: 2 }).notNull(),
  cgst: numeric("cgst", { precision: 15, scale: 2 }).notNull().default("0"),
  sgst: numeric("sgst", { precision: 15, scale: 2 }).notNull().default("0"),
  igst: numeric("igst", { precision: 15, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type JournalEntry = typeof journalEntriesTable.$inferSelect;
export type JournalLine = typeof journalLinesTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
export type Receipt = typeof receiptsTable.$inferSelect;
export type CreditNote = typeof creditNotesTable.$inferSelect;
export type DebitNote = typeof debitNotesTable.$inferSelect;

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
