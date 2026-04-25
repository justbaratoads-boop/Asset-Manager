import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companySettingsTable = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull().default("My Company"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  gstin: text("gstin"),
  pan: text("pan"),
  cin: text("cin"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  logoUrl: text("logo_url"),
  financialYearStart: integer("financial_year_start").notNull().default(4),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  enableGst: boolean("enable_gst").notNull().default(true),
  isComposition: boolean("is_composition").notNull().default(false),
  defaultState: text("default_state"),
  bankName: text("bank_name"),
  bankAccount: text("bank_account"),
  bankIfsc: text("bank_ifsc"),
  upiId: text("upi_id"),
  billFooter: text("bill_footer"),
  defaultPrintFormat: text("default_print_format").notNull().default("a4"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCompanySettingsSchema = createInsertSchema(companySettingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type CompanySettings = typeof companySettingsTable.$inferSelect;
