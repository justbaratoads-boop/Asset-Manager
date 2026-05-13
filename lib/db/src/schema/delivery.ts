import { pgTable, serial, text, numeric, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vehiclesTable = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  vehicleNumber: text("vehicle_number").notNull(),
  name: text("name"),
  type: text("type"),
  ownerName: text("owner_name"),
  driverName: text("driver_name"),
  driverPhone: text("driver_phone"),
  driverUserId: integer("driver_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const deliveriesTable = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  challanNumber: text("challan_number").unique(),
  tripNumber: text("trip_number").notNull().unique(),
  date: date("date"),
  driverId: integer("driver_id"),
  vehicleId: integer("vehicle_id"),
  invoiceNumber: text("invoice_number"),
  partyName: text("party_name"),
  destination: text("destination"),
  status: text("status").notNull().default("pending"),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const deliveryInvoicesTable = pgTable("delivery_invoices", {
  id: serial("id").primaryKey(),
  deliveryId: integer("delivery_id").notNull(),
  invoiceId: integer("invoice_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Vehicle = typeof vehiclesTable.$inferSelect;
export type Delivery = typeof deliveriesTable.$inferSelect;

export const insertVehicleSchema = createInsertSchema(vehiclesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;

export const insertDeliverySchema = createInsertSchema(deliveriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDelivery = z.infer<typeof insertDeliverySchema>;
