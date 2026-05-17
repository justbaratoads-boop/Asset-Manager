import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { ledgersTable, accountGroupsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const SYSTEM_LEDGERS = [
  { name: "Cash",          group: "Cash-in-Hand",  nature: "dr" },
  { name: "CGST Payable",  group: "Duties & Taxes", nature: "cr" },
  { name: "SGST Payable",  group: "Duties & Taxes", nature: "cr" },
  { name: "IGST Payable",  group: "Duties & Taxes", nature: "cr" },
] as const;

async function ensureSystemLedgers() {
  try {
    // Ensure "Duties & Taxes" account group exists
    const [dtGroup] = await db.select().from(accountGroupsTable)
      .where(eq(accountGroupsTable.name, "Duties & Taxes")).limit(1);
    if (!dtGroup) {
      await db.insert(accountGroupsTable).values({
        name: "Duties & Taxes", nature: "Liability",
        statement: "Balance Sheet", parentGroup: "liabilities", isSystem: "true",
      });
    }

    for (const seed of SYSTEM_LEDGERS) {
      const [existing] = await db.select().from(ledgersTable)
        .where(and(eq(ledgersTable.name, seed.name), eq(ledgersTable.isDeleted, "false")))
        .limit(1);
      if (existing) {
        if (existing.isSystem !== "true") {
          await db.update(ledgersTable).set({ isSystem: "true" }).where(eq(ledgersTable.id, existing.id));
        }
      } else {
        await db.insert(ledgersTable).values({
          name: seed.name, group: seed.group, nature: seed.nature,
          openingBalance: "0", isSystem: "true",
        });
      }
    }
    logger.info("System ledgers ensured");
  } catch (err) {
    logger.error({ err }, "Failed to ensure system ledgers");
  }
}

// Startup diagnostics — helps identify missing env vars on production hosts
logger.info({
  NODE_ENV: process.env["NODE_ENV"] ?? "(not set)",
  PORT: process.env["PORT"] ?? "(not set — will default to 3000)",
  DATABASE_URL: process.env["DATABASE_URL"] ? "✓ set" : "✗ MISSING — server will crash",
  SESSION_SECRET: process.env["SESSION_SECRET"] ? "✓ set" : "(not set — using fallback)",
}, "Startup environment check");

// Default to 3000 if PORT is not set (Hostinger compatibility)
const rawPort = process.env["PORT"] ?? "3000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app
  .listen(port, "0.0.0.0", () => {
    logger.info({ port }, "Server listening");
    ensureSystemLedgers();
  })
  .on("error", (err: Error) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
