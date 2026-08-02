import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;

// Enable SSL for hosted databases (Supabase, Neon, etc.)
// Disabled for local connections (localhost / 127.0.0.1)
const isLocal =
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1");

import { AsyncLocalStorage } from "async_hooks";

export const pool = new Pool({
  connectionString,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

export const baseDb = drizzle(pool, { schema });

export const tenantContext = new AsyncLocalStorage<number | null>();
const tenantPools = new Map<number, pg.Pool>();
const tenantDbs = new Map<number, ReturnType<typeof drizzle>>();

export function getTenantDb(companyId: number) {
  if (!tenantDbs.has(companyId)) {
    const hasQuery = connectionString.includes("?");
    const tenantConnectionString = `${connectionString}${hasQuery ? "&" : "?"}options=-c%20search_path=business_${companyId},public`;
    
    const tenantPool = new Pool({
      connectionString: tenantConnectionString,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    });
    
    // Fallback/redundant check just in case, but options in connection string is sync
    tenantPool.on('connect', (client) => {
      client.query(`SET search_path TO business_${companyId}, public`).catch(() => {});
    });
    
    tenantPools.set(companyId, tenantPool);
    tenantDbs.set(companyId, drizzle(tenantPool, { schema }));
  }
  return tenantDbs.get(companyId)!;
}

export const db = new Proxy({} as any, {
  get(target, prop: string | symbol) {
    const companyId = tenantContext.getStore();
    if (companyId) {
      const tdb = getTenantDb(companyId) as any;
      return tdb[prop];
    }
    return (baseDb as any)[prop];
  }
});

export * from "./schema";
