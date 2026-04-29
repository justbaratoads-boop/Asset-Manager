import app from "./app";
import { logger } from "./lib/logger";

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
  })
  .on("error", (err: Error) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
