import { Router } from "express";
import bcrypt from "bcryptjs";
import { baseDb, db } from "@workspace/db";
import { usersTable, businessesTable } from "@workspace/db/schema";
import { requireRole, authMiddleware } from "../lib/auth";

const router = Router();

router.post("/superadmin/businesses", authMiddleware, requireRole("superadmin"), async (req, res) => {
  const { name, adminEmail, adminPassword } = req.body;
  if (!name || !adminEmail || !adminPassword) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const [business] = await baseDb.insert(businessesTable).values({
      name,
      adminEmail,
    }).returning();

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await baseDb.insert(usersTable).values({
      name: "Admin",
      email: adminEmail,
      passwordHash,
      role: "admin",
      businessId: business.id
    });

    const schemaName = `"business_${business.id}"`;
    await baseDb.execute(`CREATE SCHEMA ${schemaName}`);

    // we will fetch the actual tables from information_schema dynamically
    const { rows } = await baseDb.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name NOT IN ('users', 'businesses', '__drizzle_migrations')
    `);

    for (const row of (rows as any)) {
      const tableName = row.table_name;
      await baseDb.execute(`CREATE TABLE ${schemaName}."${tableName}" (LIKE public."${tableName}" INCLUDING ALL)`);
    }

    res.json(business);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/superadmin/businesses", authMiddleware, requireRole("superadmin"), async (req, res) => {
  const businesses = await baseDb.select().from(businessesTable);
  res.json(businesses);
});

export default router;
