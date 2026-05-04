import { Router } from "express";
import { db } from "@workspace/db";
import { accountGroupsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

const DEFAULT_GROUPS: { name: string; nature: string; statement: string; parentGroup: string }[] = [
  { name: "Bank Accounts",             nature: "Asset",     statement: "Balance Sheet",  parentGroup: "assets" },
  { name: "Cash-in-Hand",              nature: "Asset",     statement: "Balance Sheet",  parentGroup: "assets" },
  { name: "Current Assets",            nature: "Asset",     statement: "Balance Sheet",  parentGroup: "assets" },
  { name: "Customer (Sundry Debtors)", nature: "Asset",     statement: "Balance Sheet",  parentGroup: "assets" },
  { name: "Deposits (Asset)",          nature: "Asset",     statement: "Balance Sheet",  parentGroup: "assets" },
  { name: "Fixed Assets",              nature: "Asset",     statement: "Balance Sheet",  parentGroup: "assets" },
  { name: "Investments",               nature: "Asset",     statement: "Balance Sheet",  parentGroup: "assets" },
  { name: "Loans & Advances (Asset)",  nature: "Asset",     statement: "Balance Sheet",  parentGroup: "assets" },
  { name: "Misc. Expenses (ASSET)",    nature: "Asset",     statement: "Balance Sheet",  parentGroup: "assets" },
  { name: "Stock-in-Hand",             nature: "Asset",     statement: "Balance Sheet",  parentGroup: "assets" },
  { name: "Sundry Debtors",            nature: "Asset",     statement: "Balance Sheet",  parentGroup: "assets" },
  { name: "Capital Account",           nature: "Equity",    statement: "Balance Sheet",  parentGroup: "equity" },
  { name: "Reserves & Surplus",        nature: "Equity",    statement: "Balance Sheet",  parentGroup: "equity" },
  { name: "Retained Earnings",         nature: "Equity",    statement: "Balance Sheet",  parentGroup: "equity" },
  { name: "Current Liabilities",       nature: "Liability", statement: "Balance Sheet",  parentGroup: "liabilities" },
  { name: "Duties & Taxes",            nature: "Liability", statement: "Balance Sheet",  parentGroup: "liabilities" },
  { name: "Loans (Liability)",         nature: "Liability", statement: "Balance Sheet",  parentGroup: "liabilities" },
  { name: "Provisions",                nature: "Liability", statement: "Balance Sheet",  parentGroup: "liabilities" },
  { name: "Secured Loans",             nature: "Liability", statement: "Balance Sheet",  parentGroup: "liabilities" },
  { name: "Sundry Creditors",          nature: "Liability", statement: "Balance Sheet",  parentGroup: "liabilities" },
  { name: "Unsecured Loans",           nature: "Liability", statement: "Balance Sheet",  parentGroup: "liabilities" },
  { name: "Direct Expenses",           nature: "Expense",   statement: "Profit & Loss",  parentGroup: "expenses" },
  { name: "Indirect Expenses",         nature: "Expense",   statement: "Profit & Loss",  parentGroup: "expenses" },
  { name: "Purchase Accounts",         nature: "Expense",   statement: "Profit & Loss",  parentGroup: "expenses" },
  { name: "Direct Incomes",            nature: "Income",    statement: "Profit & Loss",  parentGroup: "income" },
  { name: "Indirect Incomes",          nature: "Income",    statement: "Profit & Loss",  parentGroup: "income" },
  { name: "Sales Accounts",            nature: "Income",    statement: "Profit & Loss",  parentGroup: "income" },
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
  const { name, nature, statement, parentGroup } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
  const [group] = await db.insert(accountGroupsTable).values({
    name: name.trim(),
    nature: nature || "Asset",
    statement: statement || "Balance Sheet",
    parentGroup: parentGroup || "assets",
    isSystem: "false",
  }).returning();
  res.status(201).json(group);
});

router.put("/account-groups/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, nature, statement, parentGroup } = req.body;
  const [group] = await db.update(accountGroupsTable).set({
    name: name?.trim(),
    nature,
    statement,
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
