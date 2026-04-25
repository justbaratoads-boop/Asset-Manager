import { pgTable, serial, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const saleInvoicesTable = pgTable("sale_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  date: text("date").notNull(),
  partyId: integer("party_id"),
  partyName: text("party_name").notNull(),
  partyGstin: text("party_gstin"),
  billingAddress: text("billing_address"),
  isGst: boolean("is_gst").notNull().default(true),
  isInterstate: boolean("is_interstate").notNull().default(false),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull().default("0"),
  totalDiscount: numeric("total_discount", { precision: 15, scale: 2 }).notNull().default("0"),
  totalTaxable: numeric("total_taxable", { precision: 15, scale: 2 }).notNull().default("0"),
  totalCgst: numeric("total_cgst", { precision: 15, scale: 2 }).notNull().default("0"),
  totalSgst: numeric("total_sgst", { precision: 15, scale: 2 }).notNull().default("0"),
  totalIgst: numeric("total_igst", { precision: 15, scale: 2 }).notNull().default("0"),
  totalGst: numeric("total_gst", { precision: 15, scale: 2 }).notNull().default("0"),
  grandTotal: numeric("grand_total", { precision: 15, scale: 2 }).notNull().default("0"),
  amountPaid: numeric("amount_paid", { precision: 15, scale: 2 }).notNull().default("0"),
  balanceDue: numeric("balance_due", { precision: 15, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  status: text("status").notNull().default("confirmed"),
  isDeleted: text("is_deleted").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const saleInvoiceItemsTable = pgTable("sale_invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
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

export const saleInvoicePaymentsTable = pgTable("sale_invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
  mode: text("mode").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  reference: text("reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SaleInvoice = typeof saleInvoicesTable.$inferSelect;
export type SaleInvoiceItem = typeof saleInvoiceItemsTable.$inferSelect;
export type SaleInvoicePayment = typeof saleInvoicePaymentsTable.$inferSelect;

export const insertSaleInvoiceSchema = createInsertSchema(saleInvoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSaleInvoice = z.infer<typeof insertSaleInvoiceSchema>;
