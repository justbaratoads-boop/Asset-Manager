import { Router } from "express";
import { db } from "@workspace/db";
import { accountGroupsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

const DEFAULT_GROUPS = [
  { name: "Bank Accounts",          nature: "dr", parentGroup: "assets" },
  { name: "Capital Account",        nature: "cr", parentGroup: "capital" },
  { name: "Cash-in-Hand",           nature: "dr", parentGroup: "assets" },
  { name: "Current Assets",         nature: "dr", parentGroup: "assets" },
  { name: "Current Liabilities",    nature: "cr", parentGroup: "liabilities" },
  { name: "Customer",               nature: "dr", parentGroup: "assets" },
  { name: "Deposits (Asset)",       nature: "dr", parentGroup: "assets" },
  { name: "Direct Expenses",        nature: "dr", parentGroup: "expenses" },
  { name: "Direct Incomes",         nature: "cr", parentGroup: "income" },
  { name: "Duties & Taxes",         nature: "cr", parentGroup: "liabilities" },
  { name: "Fixed Assets",           nature: "dr", parentGroup: "assets" },
  { name: "Indirect Expenses",      nature: "dr", parentGroup: "expenses" },
  { name: "Indirect Incomes",       nature: "cr", parentGroup: "income" },
  { name: "Investments",            nature: "dr", parentGroup: "assets" },
  { name: "Loans & Advances (Asset)", nature: "dr", parentGroup: "assets" },
  { name: "Loans (Liability)",      nature: "cr", parentGroup: "liabilities" },
  { name: "Misc. Expenses (ASSET)", nature: "dr", parentGroup: "assets" },
  { name: "Provisions",             nature: "cr", parentGroup: "liabilities" },
  { name: "Purchase Accounts",      nature: "dr", parentGroup: "expenses" },
  { name: "Reserves & Surplus",     nature: "cr", parentGroup: "capital" },
  { name: "Retained Earnings",      nature: "cr", parentGroup: "capital" },
  { name: "Sales Accounts",         nature: "cr", parentGroup: "income" },
  { name: "Secured Loans",          nature: "cr", parentGroup: "liabilities" },
  { name: "Stock-in-Hand",          nature: "dr", parentGroup: "assets" },
  { name: "Sundry Creditors",       nature: "cr", parentGroup: "liabilities" },
  { name: "Sundry Debtors",         nature: "dr", parentGroup: "assets" },
  { name: "Suspense A/c",           nature: "dr", parentGroup: "assets" },
  { name: "Unsecured Loans",        nature: "cr", parentGroup: "liabilities" },
];

async function ensureSeeded() {
  const existing = await db.select().from(accountGroupsTable).limit(1);
  if (existing.length === 0) {
    await db.insert(accountGroupsTable).values(
      DEFAULT_GROUPS.map(g => ({ ...g, isSystem: "true" }))
    );
  }
}

router.get("/account-groups", authMiddleware, async (req, res) => {
  await ensureSeeded();
  const groups = await db.select().from(accountGroupsTable)
    .where(eq(accountGroupsTable.isDeleted, "false"))
    .orderBy(accountGroupsTable.parentGroup, accountGroupsTable.name);
  res.json(groups);
});

router.post("/account-groups", authMiddleware, async (req, res) => {
  const { name, nature, parentGroup } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
  const [group] = await db.insert(accountGroupsTable).values({
    name: name.trim(),
    nature: nature || "dr",
    parentGroup: parentGroup || "assets",
    isSystem: "false",
  }).returning();
  res.status(201).json(group);
});

router.put("/account-groups/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, nature, parentGroup } = req.body;
  const [group] = await db.update(accountGroupsTable).set({
    name: name?.trim(),
    nature,
    parentGroup,
  }).where(eq(accountGroupsTable.id, Number(id))).returning();
  if (!group) return res.status(404).json({ error: "Not found" });
  res.json(group);
});

router.delete("/account-groups/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const [grp] = await db.select().from(accountGroupsTable).where(eq(accountGroupsTable.id, Number(id))).limit(1);
  if (!grp) return res.status(404).json({ error: "Not found" });
  if (grp.isSystem === "true") return res.status(400).json({ error: "System groups cannot be deleted" });
  await db.update(accountGroupsTable).set({ isDeleted: "true" }).where(eq(accountGroupsTable.id, Number(id)));
  res.json({ ok: true });
});

export default router;
