import { pgTable, serial, text, numeric, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stockBatchesTable = pgTable("stock_batches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  expiryDate: text("expiry_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStockBatchSchema = createInsertSchema(stockBatchesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStockBatch = z.infer<typeof insertStockBatchSchema>;
export type StockBatch = typeof stockBatchesTable.$inferSelect;

export const stockCategoriesTable = pgTable("stock_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const stockItemsTable = pgTable("stock_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  categoryId: integer("category_id"),
  batchId: integer("batch_id"),
  brand: text("brand"),
  hsnCode: text("hsn_code"),
  unit: text("unit").notNull().default("pcs"),
  purchaseRate: numeric("purchase_rate", { precision: 15, scale: 2 }).notNull().default("0"),
  saleRate: numeric("sale_rate", { precision: 15, scale: 2 }).notNull().default("0"),
  minStockLevel: numeric("min_stock_level", { precision: 15, scale: 2 }).notNull().default("0"),
  barcode: text("barcode"),
  physicalStock: numeric("physical_stock", { precision: 15, scale: 2 }).notNull().default("0"),
  gstApplicable: text("gst_applicable").notNull().default("false"),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  isDeleted: text("is_deleted").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const stockTransactionsTable = pgTable("stock_transactions", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  type: text("type").notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 15, scale: 2 }).notNull(),
  reference: text("reference"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStockCategorySchema = createInsertSchema(stockCategoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStockCategory = z.infer<typeof insertStockCategorySchema>;
export type StockCategory = typeof stockCategoriesTable.$inferSelect;

export const insertStockItemSchema = createInsertSchema(stockItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStockItem = z.infer<typeof insertStockItemSchema>;
export type StockItem = typeof stockItemsTable.$inferSelect;

export const insertStockTransactionSchema = createInsertSchema(stockTransactionsTable).omit({ id: true, createdAt: true });
export type InsertStockTransaction = z.infer<typeof insertStockTransactionSchema>;
export type StockTransaction = typeof stockTransactionsTable.$inferSelect;
