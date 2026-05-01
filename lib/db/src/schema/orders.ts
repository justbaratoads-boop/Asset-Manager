import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  date: text("date").notNull(),
  partyId: integer("party_id"),
  partyName: text("party_name").notNull(),
  partyPhone: text("party_phone"),
  deliveryAddress: text("delivery_address"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  grandTotal: numeric("grand_total", { precision: 15, scale: 2 }).notNull().default("0"),
  convertedInvoiceId: integer("converted_invoice_id"),
  driverName: text("driver_name"),
  vehicleName: text("vehicle_name"),
  vehicleNo: text("vehicle_no"),
  dispatchNotes: text("dispatch_notes"),
  isDeleted: text("is_deleted").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const orderItemsTable = pgTable("order_items", {
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

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
