import app from "./app";
import { logger } from "./lib/logger";

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
