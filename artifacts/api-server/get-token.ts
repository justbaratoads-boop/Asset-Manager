import { db } from '@workspace/db';
import { usersTable } from '@workspace/db';
import { businessesTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env["SESSION_SECRET"] || "dev-secret-fallback";

async function run() {
  try {
    const [user] = await db.select().from(usersTable).limit(1);
    const [business] = await db.select().from(businessesTable).limit(1);
    if (!user) throw new Error("No user");
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, businessId: business?.id || 1 },
      JWT_SECRET,
      { expiresIn: "30d" }
    );
    console.log(token);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
