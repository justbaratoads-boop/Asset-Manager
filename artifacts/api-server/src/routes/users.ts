import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, companySettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

router.get("/users", authMiddleware, async (_req, res) => {
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    phone: usersTable.phone,
    isActive: usersTable.isActive,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.name);
  res.json(users);
});

router.post("/users", authMiddleware, async (req, res) => {
  const data = req.body;
  const passwordHash = await bcrypt.hash(data.password || "Password@123", 10);
  const [user] = await db.insert(usersTable).values({
    name: data.name,
    email: data.email,
    passwordHash,
    role: data.role || "sales_staff",
    phone: data.phone,
    isActive: true,
  }).returning({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    phone: usersTable.phone,
    isActive: usersTable.isActive,
  });
  res.status(201).json(user);
});

router.get("/users/:id", authMiddleware, async (req, res) => {
  const [user] = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    phone: usersTable.phone,
    isActive: usersTable.isActive,
  }).from(usersTable).where(eq(usersTable.id, Number(req.params.id))).limit(1);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
});

router.put("/users/:id", authMiddleware, async (req, res) => {
  const data = req.body;
  const updates: Partial<typeof usersTable.$inferInsert> = {
    name: data.name,
    email: data.email,
    role: data.role,
    phone: data.phone,
    isActive: data.isActive,
  };
  if (data.password) {
    updates.passwordHash = await bcrypt.hash(data.password, 10);
  }
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, Number(req.params.id))).returning({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    isActive: usersTable.isActive,
  });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
});

router.delete("/users/:id", authMiddleware, async (req, res) => {
  await db.update(usersTable).set({ isActive: false }).where(eq(usersTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

// Company settings (both paths for compatibility)
router.get("/company-settings", authMiddleware, async (_req, res) => {
  const settings = await db.select().from(companySettingsTable).limit(1);
  if (settings.length === 0) {
    const [s] = await db.insert(companySettingsTable).values({ companyName: "My Company" }).returning();
    return res.json(s);
  }
  res.json(settings[0]);
});

router.put("/company-settings", authMiddleware, async (req, res) => {
  const data = req.body;
  const existing = await db.select().from(companySettingsTable).limit(1);
  if (existing.length === 0) {
    const [s] = await db.insert(companySettingsTable).values(data).returning();
    return res.json(s);
  }
  const [s] = await db.update(companySettingsTable).set({
    companyName: data.companyName,
    address: data.address,
    city: data.city,
    state: data.state,
    pincode: data.pincode,
    gstin: data.gstin,
    pan: data.pan,
    cin: data.cin,
    phone: data.phone,
    email: data.email,
    website: data.website,
    bankName: data.bankName,
    bankAccount: data.bankAccount,
    bankIfsc: data.bankIfsc,
    upiId: data.upiId,
    billFooter: data.billFooter,
    invoicePrefix: data.invoicePrefix,
    enableGst: data.enableGst,
    defaultPrintFormat: data.defaultPrintFormat,
    financialYearStart: data.financialYearStart,
  }).where(eq(companySettingsTable.id, existing[0].id)).returning();
  res.json(s);
});

router.get("/settings/company", authMiddleware, async (_req, res) => {
  const settings = await db.select().from(companySettingsTable).limit(1);
  if (settings.length === 0) {
    const [s] = await db.insert(companySettingsTable).values({ companyName: "My Company" }).returning();
    return res.json(s);
  }
  res.json(settings[0]);
});

router.put("/settings/company", authMiddleware, async (req, res) => {
  const data = req.body;
  const existing = await db.select().from(companySettingsTable).limit(1);

  if (existing.length === 0) {
    const [s] = await db.insert(companySettingsTable).values(data).returning();
    return res.json(s);
  }

  const [s] = await db.update(companySettingsTable).set({
    companyName: data.companyName,
    address: data.address,
    city: data.city,
    state: data.state,
    pincode: data.pincode,
    gstin: data.gstin,
    pan: data.pan,
    cin: data.cin,
    phone: data.phone,
    email: data.email,
    website: data.website,
    bankName: data.bankName,
    bankAccount: data.bankAccount,
    bankIfsc: data.bankIfsc,
    upiId: data.upiId,
    billFooter: data.billFooter,
    invoicePrefix: data.invoicePrefix,
    enableGst: data.enableGst,
    defaultPrintFormat: data.defaultPrintFormat,
    financialYearStart: data.financialYearStart,
  }).where(eq(companySettingsTable.id, existing[0].id)).returning();
  res.json(s);
});

export default router;
