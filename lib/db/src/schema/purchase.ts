import { pgTable, serial, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const purchaseInvoicesTable = pgTable("purchase_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  supplierInvoiceNumber: text("supplier_invoice_number"),
  date: text("date").notNull(),
  partyId: integer("party_id"),
  partyName: text("party_name").notNull(),
  isGst: boolean("is_gst").notNull().default(true),
  isInterstate: boolean("is_interstate").notNull().default(false),
  isReverseCharge: boolean("is_reverse_charge").notNull().default(false),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull().default("0"),
  totalTaxable: numeric("total_taxable", { precision: 15, scale: 2 }).notNull().default("0"),
  totalCgst: numeric("total_cgst", { precision: 15, scale: 2 }).notNull().default("0"),
  totalSgst: numeric("total_sgst", { precision: 15, scale: 2 }).notNull().default("0"),
  totalIgst: numeric("total_igst", { precision: 15, scale: 2 }).notNull().default("0"),
  grandTotal: numeric("grand_total", { precision: 15, scale: 2 }).notNull().default("0"),
  amountPaid: numeric("amount_paid", { precision: 15, scale: 2 }).notNull().default("0"),
  balanceDue: numeric("balance_due", { precision: 15, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  isDeleted: text("is_deleted").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const purchaseInvoiceItemsTable = pgTable("purchase_invoice_items", {
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

export const purchaseInvoicePaymentsTable = pgTable("purchase_invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
  mode: text("mode").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  reference: text("reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(),
  date: text("date").notNull(),
  partyId: integer("party_id"),
  partyName: text("party_name").notNull(),
  status: text("status").notNull().default("open"),
  grandTotal: numeric("grand_total", { precision: 15, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  isDeleted: text("is_deleted").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const purchaseOrderItemsTable = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
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

export type PurchaseInvoice = typeof purchaseInvoicesTable.$inferSelect;
export type PurchaseInvoiceItem = typeof purchaseInvoiceItemsTable.$inferSelect;
export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItemsTable.$inferSelect;

export const insertPurchaseInvoiceSchema = createInsertSchema(purchaseInvoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseInvoice = z.infer<typeof insertPurchaseInvoiceSchema>;
