import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const countersTable = pgTable("counters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  value: integer("value").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Counter = typeof countersTable.$inferSelect;
