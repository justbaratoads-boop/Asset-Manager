import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { signToken, authMiddleware } from "../lib/auth";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (users.length === 0) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const user = users[0];
  if (!user.isActive) {
    return res.status(401).json({ error: "Account disabled" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.get("/auth/me", authMiddleware, async (req, res) => {
  const userId = (req as any).user.userId;
  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (users.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  const u = users[0];
  return res.json({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, isActive: u.isActive });
});

router.post("/auth/logout", (_req, res) => {
  res.json({ ok: true });
});

export default router;
